-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🛡️ UCZCIWA NAUKA: dzień „Wpisz” sprawdzany w bazie
--  + alerty dla nauczyciela (zgadywanie, wklejanie, odrzucone dni)
--  Migracja #94 · idempotentna (04.11.2026)
--
--  Po zgłoszeniu właściciela: uczniowie próbują sztuczek, żeby szybko
--  zdobyć XP albo zaliczyć dzienne minimum w „Wpisz” bez nauki
--  (1 litera + Enter → podpowiedź pokazywała całe słowo; klikanie byle
--  czego, żeby nabić 20 wpisów; zapis zaliczenia z konsoli przeglądarki).
--  Aplikacja od tej wersji sama nie liczy prób „na chybił-trafił”
--  i blokuje wklejanie. Ta migracja dokłada:
--
--  1) claim_typed_day() — zaliczenie dnia „Wpisz” dopiero po sprawdzeniu
--     w bazie dzisiejszych odpowiedzi (typed_answers, dzień wg czasu
--     polskiego jak w #85): co najmniej 5 poprawnych odpowiedzi za
--     1. razem z co najmniej 2 różnych słówek, nie szybciej niż średnio
--     1 odpowiedź na 1,2 s (aplikacja po trafieniu i tak czeka 1,5 s).
--     Aplikacja zgłasza zaliczenie przy ≥ 6 takich trafieniach (warunek B),
--     więc uczciwy uczeń zawsze przejdzie (zapas na 1 zgubiony zapis).
--     Odmowa → alert 'typed_reject' (bez zaliczenia). Stara funkcja
--     log_typed_day() (stare wersje aplikacji) też sprawdza.
--  2) typed_answers: kolumna first_try (poprawnie za 1. razem; aplikacja
--     wysyła false po poprawce z podpowiedzią — taka odpowiedź nie liczy
--     się do zaliczenia), trigger: czas zapisu ustawia baza (nie aplikacja),
--     najwyżej 40 odpowiedzi na minutę (nadwyżka po cichu pomijana).
--  3) report_learning_flags(rodzaj, ile, tryby) — aplikacja zgłasza próby
--     „na chybił-trafił” ('junk') i próby wklejenia ('paste'), najwyżej
--     raz na 10 min (baza przyjmuje najwyżej 1 zgłoszenie rodzaju na minutę).
--  4) Dla nauczyciela (tylko swoi uczniowie) i admina (wszyscy):
--     xp_flags_new_count() — liczba nowych alertów (chip w „Wymagają
--     Twojej uwagi”), mark_xp_flags_seen() — „przeczytane” (osobno dla
--     każdego nauczyciela), class_learning_flags(klasa, dni) — podsumowanie
--     klasy (znaczki 🛡️ przy uczniach, tydzień w klasie).
--
--  Wymaga: #20, #21, #50, #51, #75 (_is_teacher_of, _owns_class), #85, #93.
--  UWAGA: ponowne uruchomienie #50 albo #85 przywraca log_typed_day() bez
--  sprawdzania — wtedy uruchom też #94 (po #93).
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.xp_flags') is null then
    raise exception 'Najpierw uruchom migrację #93 (xp-anticheat.sql).';
  end if;
  if to_regclass('public.typed_answers') is null then
    raise exception 'Najpierw uruchom migrację #51 (typed-answers-schema.sql).';
  end if;
end $$;

-- ── 1) Tabele i kolumny ─────────────────────────────────────────────
alter table public.xp_flags drop constraint if exists xp_flags_kind_check;
alter table public.xp_flags add constraint xp_flags_kind_check
  check (kind in ('limit', 'day_high', 'fast', 'junk', 'paste', 'typed_reject', 'self_easy'));   -- 'self_easy' — #95 (ponowne #94 nie psuje jego wierszy)
create index if not exists xp_flags_last on public.xp_flags (last_at desc);

-- kiedy nauczyciel / admin ostatnio przejrzał alerty („nowe” = zmienione później)
create table if not exists public.xp_flag_seen (
  viewer  uuid primary key references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.xp_flag_seen enable row level security;
revoke all on public.xp_flag_seen from anon, authenticated;

-- poprawnie za 1. razem? (null = stara wersja aplikacji — liczone jak „tak”)
alter table public.typed_answers add column if not exists first_try boolean;

-- ── 2) typed_answers: czas zapisu z bazy, limit na minutę ───────────
create or replace function public._typed_answers_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.created_at := now();   -- aplikacja nie ustawia czasu odpowiedzi
    -- uczciwie najwyżej ~1 odpowiedź na 1,5 s; więcej niż 40 na minutę — pomijamy
    if (select count(*) from (select 1 from public.typed_answers t
                               where t.user_id = new.user_id
                                 and t.created_at > now() - interval '1 minute'
                               limit 40) x) >= 40 then
      return null;
    end if;
    new.word_pl  := left(new.word_pl, 300);
    new.word_en  := left(new.word_en, 300);
    new.prompt   := left(new.prompt, 500);
    new.expected := left(new.expected, 500);
    new.answer   := left(new.answer, 500);
    if not new.correct then new.first_try := null; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists typed_answers_guard on public.typed_answers;
create trigger typed_answers_guard before insert on public.typed_answers
  for each row execute function public._typed_answers_guard();

-- ── 3) Zaliczenie dnia „Wpisz” po sprawdzeniu w bazie ───────────────
--  Zwraca jsonb: {ok, status: 'credited' | 'already' | 'rejected' | 'auth',
--  reason: 'hits' | 'words' | 'pace' | 'wait', hits, words, need_hits, need_words}.
create or replace function public.claim_typed_day()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me        uuid := auth.uid();
  d         date := (now() at time zone 'Europe/Warsaw')::date;   -- dzień wg czasu polskiego (#85)
  t0        timestamptz := (d::timestamp at time zone 'Europe/Warsaw');
  need_hits int := 5;      -- aplikacja zgłasza przy ≥ 6 (zapas na zgubiony zapis)
  need_wds  int := 2;
  hits      int;
  wds       int;
  span      numeric;
  total     int;
  mins      int;
  why       text;
  last_rej  timestamptz;
begin
  if me is null then return jsonb_build_object('ok', false, 'status', 'auth'); end if;
  if exists (select 1 from public.daily_xp_log x where x.user_id = me and x.day = d and x.typed) then
    return jsonb_build_object('ok', true, 'status', 'already');
  end if;
  -- po odmowie: kolejna próba najwcześniej po 20 s (aplikacja ponawia co ≥ 45 s)
  select f.last_at into last_rej from public.xp_flags f
   where f.user_id = me and f.day = d and f.kind = 'typed_reject';
  if last_rej is not null and last_rej > now() - interval '20 seconds' then
    return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', 'wait',
                              'need_hits', need_hits, 'need_words', need_wds);
  end if;

  select (count(*) filter (where t.correct and t.first_try is not false))::int,
         (count(distinct coalesce(t.book_id, '') || '|' || coalesce(t.unit_key, '') || '|'
                         || lower(btrim(coalesce(t.word_pl, ''))))
            filter (where t.correct and t.first_try is not false))::int,
         coalesce(extract(epoch from
            max(t.created_at) filter (where t.correct and t.first_try is not false)
          - min(t.created_at) filter (where t.correct and t.first_try is not false)), 0),
         count(*)::int
    into hits, wds, span, total
    from public.typed_answers t
   where t.user_id = me and t.created_at >= t0;
  select coalesce(max(x.minutes), 0) into mins
    from public.daily_xp_log x where x.user_id = me and x.day in (d, current_date);

  why := case when hits < need_hits then 'hits'
              when wds < need_wds then 'words'
              when span < 1.2 * (hits - 1) then 'pace'   -- szybciej niż da się w aplikacji
              else null end;

  if why is null then
    insert into public.daily_xp_log (user_id, day, typed)
    values (me, d, true)
    on conflict (user_id, day) do update set typed = true;
    -- wcześniejsza odmowa tego dnia — dopisz, że dzień w końcu się zaliczył
    update public.xp_flags f set info = left(coalesce(f.info, '') || ';ok=1', 120)
     where f.user_id = me and f.day = d and f.kind = 'typed_reject'
       and coalesce(f.info, '') not like '%ok=1%';
    return jsonb_build_object('ok', true, 'status', 'credited', 'hits', hits, 'words', wds);
  end if;

  insert into public.xp_flags (user_id, day, kind, events, blocked, info)
  values (me, d, 'typed_reject', 1, hits,
          format('r=%s;n=%s;w=%s;s=%s;a=%s;m=%s', why, hits, wds, round(span), total, mins))
  on conflict (user_id, day, kind) do update
     set events  = least(100000, public.xp_flags.events + 1),
         blocked = excluded.blocked,
         info    = excluded.info,
         last_at = now();
  return jsonb_build_object('ok', false, 'status', 'rejected', 'reason', why, 'hits', hits, 'words', wds,
                            'need_hits', need_hits, 'need_words', need_wds);
end;
$$;

-- stare wersje aplikacji (przed #94) wołają log_typed_day() — też ze sprawdzeniem
create or replace function public.log_typed_day()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform public.claim_typed_day();
end;
$$;

-- ── 4) Zgłoszenia z aplikacji: zgadywanie, wklejanie ────────────────
--  p_kind: 'junk' (próby „na chybił-trafił”), 'paste' (próby wklejenia),
--  'fast' (serie 🐢 jak report_fast_answers z #93, bez liczby odpowiedzi).
--  p_count: ile (1–200 naraz), p_info: tryby (np. type,typeSent).
create or replace function public.report_learning_flags(p_kind text, p_count int, p_info text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  k  text := lower(btrim(coalesce(p_kind, '')));
  n  int  := least(coalesce(p_count, 0), 200);
  d  date;
  i  text := nullif(left(regexp_replace(coalesce(p_info, ''), '[^a-zA-Z0-9_,]', '', 'g'), 60), '');
begin
  if me is null then return false; end if;
  if k not in ('junk', 'paste', 'fast') then
    raise exception 'Nieznany rodzaj zgłoszenia.' using errcode = '22023';
  end if;
  if n <= 0 then return false; end if;
  -- 'fast' w tym samym wierszu co report_fast_answers (#93: current_date); nowe rodzaje — dzień polski
  d := case when k = 'fast' then current_date else (now() at time zone 'Europe/Warsaw')::date end;
  -- najwyżej 1 zgłoszenie danego rodzaju na minutę (aplikacja wysyła co ≥ 10 min)
  if exists (select 1 from public.xp_flags f
              where f.user_id = me and f.day = d and f.kind = k and f.last_at > now() - interval '1 minute') then
    return false;
  end if;
  insert into public.xp_flags (user_id, day, kind, events, info)
  values (me, d, k, n, i)
  on conflict (user_id, day, kind) do update
     set events  = least(100000, public.xp_flags.events + excluded.events),
         info    = left(array_to_string(array(
                     select distinct t from unnest(string_to_array(
                       coalesce(public.xp_flags.info, '') || ',' || coalesce(excluded.info, ''), ',')) t
                      where t <> '' order by t), ','), 60),
         last_at = now();
  return true;
end;
$$;

-- ── 5) Nowe alerty: licznik i „przeczytane” (nauczyciel — swoi uczniowie, admin — wszyscy) ──
--  Liczą się: 🐢 'fast', ⛔ 'limit', 📈 'day_high', ❌ 'typed_reject' (dzień nie zaliczył się
--  później), 🧹 'junk' od 5 prób dziennie, ✋ 'paste' od 2 prób dziennie.
create or replace function public.xp_flags_new_count()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  adm   boolean := public._is_admin();
  since timestamptz;
begin
  if me is null or not (adm or public._is_teacher()) then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  select s.seen_at into since from public.xp_flag_seen s where s.viewer = me;
  since := greatest(coalesce(since, '-infinity'::timestamptz), now() - interval '7 days');
  return (
    with mine as (
      select p.id from public.profiles p where not adm and p.created_by = me
      union
      select m.user_id from public.class_members m join public.classes c on c.id = m.class_id
       where not adm and c.admin_id = me
    )
    select count(*)::int
      from public.xp_flags f
     where f.last_at > since
       and f.day >= current_date - 8
       and f.user_id <> me
       and (f.kind in ('fast', 'limit', 'day_high')
            or (f.kind = 'typed_reject' and coalesce(f.info, '') not like '%ok=1%')
            or (f.kind = 'junk' and f.events >= 5)
            or (f.kind = 'paste' and f.events >= 2))
       and (adm or f.user_id in (select id from mine)));
end;
$$;

-- zapisuje „przeczytane teraz”; zwraca poprzedni znacznik (null = pierwszy raz)
create or replace function public.mark_xp_flags_seen()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  me   uuid := auth.uid();
  prev timestamptz;
begin
  if me is null or not (public._is_admin() or public._is_teacher()) then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  select s.seen_at into prev from public.xp_flag_seen s where s.viewer = me;
  insert into public.xp_flag_seen (viewer, seen_at) values (me, now())
  on conflict (viewer) do update set seen_at = now();
  return prev;
end;
$$;

-- ── 6) Podsumowanie klasy (znaczki 🛡️ przy uczniach, „tydzień w klasie”) ──
--  Tylko uczniowie z jakimkolwiek alertem w ostatnich p_days dniach (1–60, domyślnie 7).
drop function if exists public.class_learning_flags(uuid, int);   -- #95 dodaje kolumnę — ponowne #94 musi móc ją usunąć
create or replace function public.class_learning_flags(p_class uuid, p_days int default 7)
returns table (user_id uuid, username text, nickname text,
               fast_bursts int, fast_blocked int, junk int, paste int,
               limit_xp int, limit_events int, day_high int,
               typed_reject int, typed_days int, alert_days int, last_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  since date := (now() at time zone 'Europe/Warsaw')::date - (greatest(1, least(coalesce(p_days, 7), 60)) - 1);
begin
  if auth.uid() is null or p_class is null
     or not (public._is_admin() or (public._is_teacher() and public._owns_class(p_class))) then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  return query
  select f.user_id, p.username, p.nickname,
         (coalesce(sum(f.events)     filter (where f.kind = 'fast'), 0))::int,
         (coalesce(sum(f.blocked)    filter (where f.kind = 'fast'), 0))::int,
         (coalesce(sum(f.events)     filter (where f.kind = 'junk'), 0))::int,
         (coalesce(sum(f.events)     filter (where f.kind = 'paste'), 0))::int,
         (coalesce(sum(f.dropped_xp) filter (where f.kind = 'limit'), 0))::int,
         (coalesce(sum(f.events)     filter (where f.kind = 'limit'), 0))::int,
         (count(*) filter (where f.kind = 'day_high'))::int,
         (coalesce(sum(f.events)     filter (where f.kind = 'typed_reject'), 0))::int,
         (count(*) filter (where f.kind = 'typed_reject' and coalesce(f.info, '') not like '%ok=1%'))::int,
         (count(distinct f.day))::int,
         max(f.last_at)
    from (select distinct m.user_id from public.class_members m where m.class_id = p_class) cm
    join public.xp_flags f on f.user_id = cm.user_id and f.day >= since
    join public.profiles p on p.id = cm.user_id
   group by f.user_id, p.username, p.nickname
   order by max(f.last_at) desc;
end;
$$;

-- ── 7) Uprawnienia (zasady z #84) ───────────────────────────────────
revoke all on function public._typed_answers_guard() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.claim_typed_day()', 'public.log_typed_day()', 'public.report_learning_flags(text,int,text)',
    'public.xp_flags_new_count()', 'public.mark_xp_flags_seen()', 'public.class_learning_flags(uuid,int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select 'OK — migracja #94 (uczciwa nauka: dzień Wpisz sprawdzany w bazie, alerty dla nauczyciela) gotowa' as status;
