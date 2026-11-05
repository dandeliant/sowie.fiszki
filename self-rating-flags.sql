-- ════════════════════════════════════════════════════════════════════
--  Migracja #95 — 🃏 uczciwa samoocena w Fiszkach (alert dla nauczyciela)
--  (05.11.2026, SW v1.251)
--
--  Uczeń klika „😎 Łatwe” w Fiszkach, a potem w trybie Wpisz przy tym samym
--  słówku (ten sam kierunek, do 36 h później) nie wie — 2 błędy albo pokazana
--  odpowiedź. Aplikacja zgłasza to jako rodzaj 'self_easy'
--  (report_learning_flags, jak 🧹 'junk' / ✋ 'paste' z #94).
--
--  1) xp_flags.kind — dochodzi 'self_easy'
--  2) report_learning_flags — przyjmuje 'self_easy'
--  3) xp_flags_new_count — 'self_easy' od 3 dziennie liczy się jako nowy alert
--  4) class_learning_flags — nowa kolumna self_easy (suma z p_days dni)
--  5) uprawnienia jak w #84
--
--  Wymaga #93 i #94. Idempotentna — można uruchamiać wielokrotnie.
--  UWAGA: ponowne uruchomienie #94 cofa te zmiany — potem uruchom #95 jeszcze raz.
-- ════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.xp_flags') is null then
    raise exception 'Najpierw uruchom migrację #93 (xp-anticheat.sql).';
  end if;
  if to_regclass('public.xp_flag_seen') is null then
    raise exception 'Najpierw uruchom migrację #94 (learning-integrity.sql).';
  end if;
end $$;

-- ── 1) Nowy rodzaj alertu ───────────────────────────────────────────
alter table public.xp_flags drop constraint if exists xp_flags_kind_check;
alter table public.xp_flags add constraint xp_flags_kind_check
  check (kind in ('limit', 'day_high', 'fast', 'junk', 'paste', 'typed_reject', 'self_easy'));

-- ── 2) Zgłoszenia z aplikacji ───────────────────────────────────────
--  p_kind: 'junk' (próby „na chybił-trafił”), 'paste' (próby wklejenia),
--  'fast' (serie 🐢 jak report_fast_answers z #93), 'self_easy' (#95: „Łatwe”
--  w Fiszkach, a potem w Wpisz nie wie). p_count: ile (1–200 naraz), p_info: tryby.
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
  if k not in ('junk', 'paste', 'fast', 'self_easy') then
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

-- ── 3) Licznik nowych alertów ───────────────────────────────────────
--  Liczą się: 🐢 'fast', ⛔ 'limit', 📈 'day_high', ❌ 'typed_reject' (dzień nie zaliczył się
--  później), 🧹 'junk' od 5 prób dziennie, ✋ 'paste' od 2 prób, 🃏 'self_easy' od 3 słówek dziennie.
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
            or (f.kind = 'paste' and f.events >= 2)
            or (f.kind = 'self_easy' and f.events >= 3))
       and (adm or f.user_id in (select id from mine)));
end;
$$;

-- ── 4) Podsumowanie klasy — nowa kolumna self_easy (zmiana zwracanych kolumn = drop + create) ──
drop function if exists public.class_learning_flags(uuid, int);
create function public.class_learning_flags(p_class uuid, p_days int default 7)
returns table (user_id uuid, username text, nickname text,
               fast_bursts int, fast_blocked int, junk int, paste int,
               limit_xp int, limit_events int, day_high int,
               typed_reject int, typed_days int, alert_days int, last_at timestamptz,
               self_easy int)
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
         max(f.last_at),
         (coalesce(sum(f.events)     filter (where f.kind = 'self_easy'), 0))::int
    from (select distinct m.user_id from public.class_members m where m.class_id = p_class) cm
    join public.xp_flags f on f.user_id = cm.user_id and f.day >= since
    join public.profiles p on p.id = cm.user_id
   group by f.user_id, p.username, p.nickname
   order by max(f.last_at) desc;
end;
$$;

-- ── 5) Uprawnienia (zasady z #84) ───────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.report_learning_flags(text,int,text)', 'public.xp_flags_new_count()', 'public.class_learning_flags(uuid,int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select 'OK — migracja #95 (🃏 uczciwa samoocena w Fiszkach: alert „Łatwe, a w Wpisz nie wie”) gotowa' as status;
