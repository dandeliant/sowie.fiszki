-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🛡️ STRAŻNIK XP: limit tempa XP, alerty i korekta XP
--  Migracja #93 · idempotentna (03.11.2026)
--
--  Po zgłoszeniu: uczeń klikał na zmianę Spację i → w Fiszkach i szybko
--  zdobywał poziomy (do 30.10.2026 samoocena dawała 8 XP za kartę).
--  Aplikacja od SW v1.24x ma „🐢 strażnika tempa” (za szybkie odpowiedzi
--  się nie liczą). Ta migracja dokłada zabezpieczenia w bazie:
--
--  1) add_my_xp (#85) z limitem tempa: najwyżej 400 XP na minutę
--     i 15 000 XP na dzień (w sobotę i niedzielę ×2 — jak weekendXP
--     w aplikacji). Uczciwie: Wpisz +10 co ≥ 2,5 s ≈ 240 XP/min, gry +5
--     za trafienie — limit dotyka tylko „niemożliwego” tempa (np. XP
--     dopisywane z konsoli przeglądarki). Nadwyżka nie jest dodawana,
--     tylko zapisywana w xp_flags (rodzaj 'limit'). Powyżej 3000 XP
--     dziennie (weekend 6000) — sam alert 'day_high' do przejrzenia,
--     bez odejmowania. Licznik minutowy to 2 kolumny w profiles,
--     zapisywane tym samym UPDATE co XP (bez dodatkowych zapisów na dysk).
--  2) Zapis profilu z aplikacji nie zmienia już XP (trigger z #85
--     przepuszczał każdą WIĘKSZĄ wartość — z konsoli dało się ustawić
--     dowolne XP). XP zmieniają tylko add_my_xp i admin_adjust_xp.
--     Rekord serii 🎯 (best_correct_streak) rośnie najwyżej ~1,2 na
--     sekundę od poprzedniej zmiany (max +300 w jednym zapisie);
--     po korekcie (combo_epoch) stara karta ucznia nie przywróci rekordu.
--  3) daily_xp_log: koniec bezpośrednich zapisów z aplikacji (polityki
--     dxl_upsert_own / dxl_update_own z #21) — piszą tylko funkcje bazy;
--     stara log_daily_xp nic już nie dodaje (od #85 XP do logu dopisuje
--     add_my_xp); log_daily_words — najwyżej 500 słówek dziennie.
--  4) report_fast_answers — aplikacja zgłasza zablokowane serie za
--     szybkich odpowiedzi 🐢 (najwyżej raz na 10 min) → xp_flags 'fast'.
--  5) xp_guard_list / xp_adjust_history — alerty i historia korekt
--     (admin — wszyscy, nauczyciel — tylko swoi uczniowie, _is_teacher_of).
--  6) admin_adjust_xp — korekta XP (−/+) z powodem: zmienia profiles.xp
--     (poziom liczy trigger), dzienny log XP (rankingi 📅 tydzień /
--     🗓️ miesiąc — najpierw wybrany dzień, potem najnowsze dni),
--     opcjonalnie obniża rekord serii 🎯; każda korekta trafia do
--     xp_adjustments (kto, kiedy, ile, dlaczego).
--
--  Wymaga: #20 (_is_admin, _is_teacher), #21 (daily_xp_log), #45
--  (best_correct_streak, log_daily_words), #75 (_is_teacher_of), #85
--  (add_my_xp, _profiles_xp_guard). UWAGA: ponowne uruchomienie #85
--  przywraca add_my_xp i trigger bez limitów — wtedy uruchom też #93.
-- ═══════════════════════════════════════════════════════════════

-- ── 1) Kolumny i tabele ─────────────────────────────────────────────
alter table public.profiles add column if not exists best_correct_streak int not null default 0;
alter table public.profiles add column if not exists xp_win_at   timestamptz;            -- początek bieżącego okna minutowego XP
alter table public.profiles add column if not exists xp_win_xp   int not null default 0; -- XP dodane w tym oknie
alter table public.profiles add column if not exists combo_at    timestamptz;            -- ostatnia zmiana rekordu serii 🎯
alter table public.profiles add column if not exists combo_epoch int not null default 0; -- +1 po korekcie serii

create table if not exists public.xp_flags (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  kind       text not null check (kind in ('limit', 'day_high', 'fast')),
  dropped_xp int  not null default 0,   -- 'limit': XP odrzucone przez limit tempa
  events     int  not null default 0,   -- ile razy (odrzucenia / alerty / zgłoszone serie 🐢)
  blocked    int  not null default 0,   -- 'fast': odpowiedzi, które się nie liczyły
  day_xp     int,                        -- XP tego dnia w chwili ostatniego alertu
  info       text,                       -- 'fast': tryby, w których zablokowano (np. card,grammar)
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  primary key (user_id, day, kind)
);
create index if not exists xp_flags_day on public.xp_flags (day desc);

create table if not exists public.xp_adjustments (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  by_user     uuid references public.profiles(id) on delete set null,
  at          timestamptz not null default now(),
  requested   int  not null,           -- o ile chciano zmienić XP
  delta       int  not null,           -- o ile zmieniono (XP nie spada poniżej 0)
  day         date,                    -- dzień historii XP, od którego zaczęto
  log_delta   int  not null default 0, -- zmiana sumy dziennego logu (rankingi tydzień / miesiąc)
  combo_from  int,
  combo_to    int,
  xp_before   int,
  xp_after    int,
  reason      text not null
);
create index if not exists xp_adjustments_user on public.xp_adjustments (user_id, at desc);

-- dostęp wyłącznie przez funkcje poniżej
alter table public.xp_flags       enable row level security;
alter table public.xp_adjustments enable row level security;
revoke all on public.xp_flags, public.xp_adjustments from anon, authenticated;
revoke all on sequence public.xp_adjustments_id_seq from anon, authenticated;

-- ── 2) daily_xp_log: piszą tylko funkcje bazy ──────────────────────
drop policy if exists "dxl_upsert_own" on public.daily_xp_log;
drop policy if exists "dxl_update_own" on public.daily_xp_log;
revoke insert, update, delete on public.daily_xp_log from anon, authenticated;

-- dawny zapis dziennego XP (sprzed #85) — nic nie dodaje, zwraca dzisiejsze XP
create or replace function public.log_daily_xp(p_delta int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select d.xp from public.daily_xp_log d
                    where d.user_id = auth.uid() and d.day = current_date), 0);
$$;

-- opanowane słówka dnia (wyzwania klasowe, ranking) — max 50 naraz i 500 dziennie
create or replace function public.log_daily_words(p_delta int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_total int;
begin
  if auth.uid() is null or p_delta is null or p_delta <= 0 then return 0; end if;
  if p_delta > 50 then p_delta := 50; end if;
  insert into public.daily_xp_log (user_id, day, xp, words, first_active_at, updated_at)
  values (auth.uid(), current_date, 0, p_delta, now(), now())
  on conflict (user_id, day) do update
     set words = least(500, public.daily_xp_log.words + excluded.words),
         first_active_at = coalesce(public.daily_xp_log.first_active_at, excluded.first_active_at),
         updated_at = now()
  returning words into v_total;
  return v_total;
end;
$$;

-- ── 3) add_my_xp z limitem tempa ───────────────────────────────────
create or replace function public.add_my_xp(p_delta int)
returns table (new_xp int, new_level int)
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  d        int  := greatest(0, least(coalesce(p_delta, 0), 2000));
  wk       int  := case when extract(isodow from (now() at time zone 'Europe/Warsaw')) in (6, 7) then 2 else 1 end;
  cap_min  int  := 400 * wk;     -- XP na minutę (uczciwie: Wpisz ≈ 240/min w dzień powszedni)
  cap_day  int  := 15000 * wk;   -- XP na dzień — twardy limit
  soft_day int  := 3000 * wk;    -- XP na dzień — powyżej: alert do przejrzenia (bez odejmowania)
  w_at     timestamptz;
  w_xp     int;
  today    int;
  ok       int;
  v        int;
begin
  if me is null then return; end if;
  select p.xp_win_at, coalesce(p.xp_win_xp, 0) into w_at, w_xp
    from public.profiles p where p.id = me for update;
  if not found then return; end if;
  if w_at is null or now() - w_at >= interval '1 minute' then w_at := now(); w_xp := 0; end if;
  select coalesce(sum(x.xp), 0)::int into today
    from public.daily_xp_log x where x.user_id = me and x.day = current_date;
  ok := greatest(0, least(d, cap_min - w_xp, cap_day - today));

  update public.profiles p
     set xp = coalesce(p.xp, 0) + ok,
         level = floor((coalesce(p.xp, 0) + ok) / 60.0)::int + 1,
         xp_synced_at = now(),
         xp_win_at = w_at,
         xp_win_xp = w_xp + ok
   where p.id = me
  returning p.xp into v;

  if ok > 0 then
    insert into public.daily_xp_log (user_id, day, xp, first_active_at, updated_at)
    values (me, current_date, ok, now(), now())
    on conflict (user_id, day) do update
       set xp = public.daily_xp_log.xp + excluded.xp,
           first_active_at = coalesce(public.daily_xp_log.first_active_at, excluded.first_active_at),
           updated_at = now();
  end if;
  if d > ok then   -- odrzucona nadwyżka (rzadko — tylko przy „niemożliwym” tempie)
    insert into public.xp_flags (user_id, day, kind, dropped_xp, events, day_xp)
    values (me, current_date, 'limit', d - ok, 1, today + ok)
    on conflict (user_id, day, kind) do update
       set dropped_xp = public.xp_flags.dropped_xp + excluded.dropped_xp,
           events = public.xp_flags.events + 1,
           day_xp = excluded.day_xp,
           last_at = now();
  end if;
  if today < soft_day and today + ok >= soft_day then   -- raz dziennie: bardzo dużo XP jednego dnia
    insert into public.xp_flags (user_id, day, kind, events, day_xp)
    values (me, current_date, 'day_high', 1, today + ok)
    on conflict (user_id, day, kind) do update
       set events = public.xp_flags.events + 1, day_xp = excluded.day_xp, last_at = now();
  end if;
  return query select v, floor(v / 60.0)::int + 1;
end;
$$;

-- ── 4) Zapis profilu z aplikacji: XP bez zmian, rekord serii z limitem ──
create or replace function public._profiles_xp_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allow int;
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.xp := 0;   -- nowy profil zakłada baza (handle_new_user); z aplikacji — bez XP
    else
      -- XP zmieniają tylko add_my_xp i admin_adjust_xp (#93)
      new.xp := old.xp;
      new.longest_streak := greatest(coalesce(new.longest_streak, 0), coalesce(old.longest_streak, 0));
      new.xp_win_at := old.xp_win_at;
      new.xp_win_xp := old.xp_win_xp;
      if new.combo_epoch is distinct from old.combo_epoch then
        -- karta sprzed korekty serii (inna „epoka”) — rekord zostaje taki, jak w bazie
        new.best_correct_streak := old.best_correct_streak;
      elsif coalesce(new.best_correct_streak, 0) > coalesce(old.best_correct_streak, 0) then
        allow := coalesce(old.best_correct_streak, 0) + least(300, greatest(5,
                 floor(extract(epoch from (now() - coalesce(old.combo_at, now() - interval '1 day'))) * 1.2)::int));
        new.best_correct_streak := least(new.best_correct_streak, allow);
        new.combo_at := now();
      else
        new.best_correct_streak := coalesce(old.best_correct_streak, 0);   -- rekord nie maleje
      end if;
      if new.best_correct_streak = coalesce(old.best_correct_streak, 0) then new.combo_at := old.combo_at; end if;
      new.combo_epoch := old.combo_epoch;
    end if;
  end if;
  new.level := floor(coalesce(new.xp, 0) / 60.0)::int + 1;
  return new;
end;
$$;
drop trigger if exists profiles_xp_guard on public.profiles;
create trigger profiles_xp_guard before insert or update on public.profiles
  for each row execute function public._profiles_xp_guard();

-- ── 5) Zgłoszenie z aplikacji: serie za szybkich odpowiedzi 🐢 ─────────
create or replace function public.report_fast_answers(p_bursts int, p_blocked int, p_info text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  b  int  := greatest(0, least(coalesce(p_bursts, 0), 50));
  n  int  := greatest(0, least(coalesce(p_blocked, 0), 1000));
  i  text := nullif(left(regexp_replace(coalesce(p_info, ''), '[^a-zA-Z0-9_,]', '', 'g'), 60), '');
begin
  if me is null or (b = 0 and n = 0) then return; end if;
  insert into public.xp_flags (user_id, day, kind, events, blocked, info)
  values (me, current_date, 'fast', b, n, i)
  on conflict (user_id, day, kind) do update
     set events  = least(100000, public.xp_flags.events + excluded.events),
         blocked = least(1000000, public.xp_flags.blocked + excluded.blocked),
         info    = left(array_to_string(array(
                     select distinct t from unnest(string_to_array(
                       coalesce(public.xp_flags.info, '') || ',' || coalesce(excluded.info, ''), ',')) t
                      where t <> '' order by t), ','), 60),
         last_at = now();
end;
$$;

-- ── 6) Alerty i historia korekt (admin — wszyscy, nauczyciel — swoi uczniowie) ──
create or replace function public.xp_guard_list(p_user uuid default null, p_days int default 30)
returns table (user_id uuid, username text, nickname text, day date, kind text, dropped_xp int,
               events int, blocked int, day_xp int, info text, first_at timestamptz, last_at timestamptz,
               xp int, level int, best_combo int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not (public._is_admin() or public._is_teacher()) then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  return query
  select f.user_id, p.username, p.nickname, f.day, f.kind, f.dropped_xp, f.events, f.blocked, f.day_xp,
         f.info, f.first_at, f.last_at, coalesce(p.xp, 0), coalesce(p.level, 1), coalesce(p.best_correct_streak, 0)
    from public.xp_flags f
    join public.profiles p on p.id = f.user_id
   where f.day >= current_date - greatest(1, least(coalesce(p_days, 30), 400))
     and (p_user is null or f.user_id = p_user)
     and public._is_teacher_of(f.user_id)
   order by f.last_at desc
   limit 500;
end;
$$;

create or replace function public.xp_adjust_history(p_user uuid)
returns table (id bigint, at timestamptz, by_name text, requested int, delta int, day date, log_delta int,
               combo_from int, combo_to int, xp_before int, xp_after int, reason text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_user is null or not public._is_teacher_of(p_user) then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  return query
  select a.id, a.at, coalesce(nullif(b.nickname, ''), b.username), a.requested, a.delta, a.day, a.log_delta,
         a.combo_from, a.combo_to, a.xp_before, a.xp_after, a.reason
    from public.xp_adjustments a
    left join public.profiles b on b.id = a.by_user
   where a.user_id = p_user
   order by a.at desc
   limit 100;
end;
$$;

-- ── 7) Korekta XP (−/+) i rekordu serii ──────────────────────────────
--  p_delta < 0: odejmij (XP nie spada poniżej 0); z dziennego logu najpierw
--  z dnia p_day, potem z najnowszych dni — rankingi tydzień/miesiąc też się
--  poprawią. p_delta > 0: przywróć (np. XP odrzucone przez limit) — do logu
--  dnia p_day (domyślnie dziś). p_set_combo: nowy rekord serii 🎯 (tylko
--  w dół). Zwraca stan po korekcie.
create or replace function public.admin_adjust_xp(p_user uuid, p_delta int, p_reason text,
                                                  p_day date default null, p_set_combo int default null)
returns table (new_xp int, new_level int, applied int, log_applied int, combo_before int, combo_after int)
language plpgsql
security definer
set search_path = public
as $$
declare
  me        uuid := auth.uid();
  why       text := left(btrim(coalesce(p_reason, '')), 300);
  want      int  := coalesce(p_delta, 0);
  cur_xp    int;
  cur_combo int;
  new_combo int;
  got       int  := 0;
  rest      int;
  take      int;
  logd      int  := 0;
  r         record;
begin
  if me is null then raise exception 'Musisz być zalogowany.' using errcode = '42501'; end if;
  if p_user is null or not public._is_teacher_of(p_user) then
    raise exception 'Brak uprawnień do tego ucznia.' using errcode = '42501';
  end if;
  if p_user = me and not public._is_admin() then
    raise exception 'Nie możesz poprawiać własnych punktów.' using errcode = '42501';
  end if;
  if char_length(why) < 3 then raise exception 'Podaj powód korekty (co najmniej 3 znaki).' using errcode = '22023'; end if;
  if want < -1000000 or want > 100000 then raise exception 'Za duża korekta.' using errcode = '22023'; end if;
  if want = 0 and p_set_combo is null then raise exception 'Nic do zmiany.' using errcode = '22023'; end if;
  if p_day is not null and (p_day > current_date or p_day < current_date - 400) then
    raise exception 'Nieprawidłowy dzień.' using errcode = '22023';
  end if;
  if p_set_combo is not null and p_set_combo < 0 then raise exception 'Nieprawidłowy rekord serii.' using errcode = '22023'; end if;

  select coalesce(p.xp, 0), coalesce(p.best_correct_streak, 0) into cur_xp, cur_combo
    from public.profiles p where p.id = p_user for update;
  if not found then raise exception 'Nie ma takiego konta.' using errcode = 'P0002'; end if;

  if want < 0 then
    got := -least(-want, cur_xp);
    rest := -got;
    for r in select x.day, x.xp from public.daily_xp_log x
              where x.user_id = p_user and x.xp > 0
              order by coalesce(x.day = p_day, false) desc, x.day desc loop
      exit when rest <= 0;
      take := least(rest, r.xp);
      update public.daily_xp_log x set xp = x.xp - take, updated_at = now()
       where x.user_id = p_user and x.day = r.day;
      rest := rest - take;
      logd := logd - take;
    end loop;
  elsif want > 0 then
    got := want;
    insert into public.daily_xp_log (user_id, day, xp, updated_at)
    values (p_user, coalesce(p_day, current_date), got, now())
    on conflict (user_id, day) do update set xp = public.daily_xp_log.xp + excluded.xp, updated_at = now();
    logd := got;
  end if;

  new_combo := case when p_set_combo is null then cur_combo else least(p_set_combo, cur_combo) end;
  update public.profiles p
     set xp = cur_xp + got,
         best_correct_streak = new_combo,
         combo_epoch = case when new_combo <> cur_combo then coalesce(p.combo_epoch, 0) + 1 else p.combo_epoch end,
         combo_at    = case when new_combo <> cur_combo then now() else p.combo_at end
   where p.id = p_user;

  insert into public.xp_adjustments (user_id, by_user, requested, delta, day, log_delta,
                                     combo_from, combo_to, xp_before, xp_after, reason)
  values (p_user, me, want, got, p_day, logd,
          case when new_combo <> cur_combo then cur_combo end,
          case when new_combo <> cur_combo then new_combo end,
          cur_xp, cur_xp + got, why);

  return query select cur_xp + got, floor((cur_xp + got) / 60.0)::int + 1, got, logd, cur_combo, new_combo;
end;
$$;

-- ── 8) Uprawnienia (zasady z #84) ───────────────────────────────────
revoke all on function public._profiles_xp_guard() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.add_my_xp(int)', 'public.log_daily_xp(int)', 'public.log_daily_words(int)',
    'public.report_fast_answers(int,int,text)', 'public.xp_guard_list(uuid,int)',
    'public.xp_adjust_history(uuid)', 'public.admin_adjust_xp(uuid,int,text,date,int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select 'OK — migracja #93 (strażnik XP: limit tempa, alerty, korekta XP) gotowa' as status;
