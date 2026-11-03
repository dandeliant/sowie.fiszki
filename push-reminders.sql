-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🔔 POWIADOMIENIA PUSH (codzienne przypomnienia o nauce i pupilu)
--  Migracja #91 · idempotentna (można uruchomić ponownie)
--
--  Prawdziwe powiadomienia Web Push (VAPID) wysyłane z Supabase raz dziennie
--  o godzinie wybranej przez ucznia — także gdy aplikacja jest zamknięta
--  (iPhone: aplikacja dodana do ekranu początkowego, iOS 16.4+; Android; komputer).
--  Wysyła je Edge Function „push-reminders” uruchamiana co godzinę przez cron
--  (supabase/functions/push-reminders, szablon harmonogramu: push-cron-setup.sql).
--
--  1) push_subscriptions — jedna subskrypcja = jedna przeglądarka / urządzenie:
--       endpoint, p256dh, auth   dane subskrypcji z przeglądarki (endpoint unikalny),
--       remind_hour 7–21, tz     godzina przypomnienia w strefie czasowej urządzenia,
--       due_count, due_ahead,    prognoza z aplikacji: ile słówek będzie do powtórki
--       due_on                   o godzinie przypomnienia w dniu due_on (due_count)
--                                i w kolejnych dniach (due_ahead[1..7] = due_on + 1..7),
--       pet                      stan pupila {e, n, egg, h, m, en, t} (spadek potrzeb
--                                do chwili wysyłki liczy funkcja),
--       ua, last_sent_on, last_test_at, fail_count, seen_at (ostatnie wejście
--       do aplikacji — po 30 dniach bez wejścia przypomnienia ustają).
--     RLS: użytkownik widzi i usuwa tylko swoje wiersze; zapis wyłącznie przez RPC.
--  2) push_status — „bicie serca” funkcji (ostatnie uruchomienie). Aplikacja
--     wyłącza lokalne przypomnienia (timer w otwartej karcie) dopiero wtedy,
--     gdy funkcja działa (ostatnie uruchomienie < 3 h temu) — bez duplikatów
--     i bez ciszy, gdy cron / funkcja nie są jeszcze skonfigurowane.
--  3) RPC zalogowanego użytkownika (authenticated):
--       push_subscribe(p_endpoint, p_p256dh, p_auth, p_hour, p_tz, p_ua) → jsonb
--         {ok, server}: upsert po endpoincie (endpoint przechodzi na bieżące konto;
--         przy zmianie konta prognoza i pupil są zerowane), max 10 urządzeń na konto.
--       push_update(p_endpoint, p_hour, p_due_count, p_pet, p_due_ahead, p_due_on, p_tz)
--         → jsonb {found, server}: tani zapis prognozy, tylko własny wiersz.
--       push_unsubscribe(p_endpoint) → boolean.
--     Błędy: AUTH, BAD_ENDPOINT, BAD_KEYS, BAD_HOUR.
--  4) RPC tylko dla Edge Function (service_role):
--       push_due_now(p_now, p_limit) — subskrypcje, którym właśnie wypada godzina
--         (remind_hour = bieżąca godzina w ich strefie), nie dostały jeszcze dziś
--         przypomnienia, użytkownik dziś się nie uczył (profiles.last_study_date /
--         daily_xp_date — tekst z toDateString(), np. „Tue Nov 03 2026”) i wchodził
--         do aplikacji w ostatnich 30 dniach; + prognoza słówek na dziś i seria dni.
--         Zapisuje push_status (bicie serca).
--       push_mark_sent(p_ids uuid[]) → int, push_mark_failed(p_endpoint, p_gone) → text
--         (404/410 = usuń; inny błąd = fail_count + 1, usuń po 5 kolejnych błędach),
--       push_test_targets(p_user) — subskrypcje użytkownika do próbnego powiadomienia
--         (max 1 na 30 s na urządzenie).
--
--  Wymaga: #20 (konwencje RLS; polityki używają tylko auth.uid()).
--  Uruchom w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TABELE ────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  remind_hour  smallint not null default 17,
  tz           text not null default 'Europe/Warsaw',
  due_count    int not null default 0,
  due_ahead    int[],
  due_on       date,
  pet          jsonb,
  ua           text,
  last_sent_on date,
  last_test_at timestamptz,
  fail_count   int not null default 0,
  seen_at      timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.push_subscriptions add column if not exists due_ahead int[];
alter table public.push_subscriptions add column if not exists due_on date;
alter table public.push_subscriptions add column if not exists pet jsonb;
alter table public.push_subscriptions add column if not exists ua text;
alter table public.push_subscriptions add column if not exists last_sent_on date;
alter table public.push_subscriptions add column if not exists last_test_at timestamptz;
alter table public.push_subscriptions add column if not exists fail_count int not null default 0;
alter table public.push_subscriptions add column if not exists seen_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.push_subscriptions'::regclass and conname = 'push_subscriptions_endpoint_key') then
    alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key unique (endpoint);
  end if;
end $$;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_hour_chk;
alter table public.push_subscriptions add constraint push_subscriptions_hour_chk check (remind_hour between 7 and 21);
alter table public.push_subscriptions drop constraint if exists push_subscriptions_sizes_chk;
alter table public.push_subscriptions add constraint push_subscriptions_sizes_chk check (
  length(endpoint) <= 1000 and length(p256dh) <= 120 and length(auth) <= 60 and length(tz) <= 64
  and coalesce(length(ua), 0) <= 200 and coalesce(cardinality(due_ahead), 0) <= 7
  and coalesce(length(pet::text), 0) <= 600
);

-- (tz, remind_hour): co godzinę funkcja czyta tylko wiersze z bieżącą godziną w danej strefie
create index if not exists push_subscriptions_tz_hour_idx on public.push_subscriptions (tz, remind_hour);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.push_status (
  id          smallint primary key default 1,
  last_run_at timestamptz,
  last_due    int,
  constraint push_status_one_row check (id = 1)
);

-- ── 2. RLS ───────────────────────────────────────────────────────
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions: własne SELECT" on public.push_subscriptions;
create policy "push_subscriptions: własne SELECT" on public.push_subscriptions
  for select using (user_id = auth.uid());
drop policy if exists "push_subscriptions: własne DELETE" on public.push_subscriptions;
create policy "push_subscriptions: własne DELETE" on public.push_subscriptions
  for delete using (user_id = auth.uid());
-- bez polityk INSERT/UPDATE — zapis tylko przez RPC poniżej
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

alter table public.push_status enable row level security;   -- bez polityk: tylko funkcje
revoke all on public.push_status from anon, authenticated;

-- ── 3. POMOCNICZE ────────────────────────────────────────────────
-- Data z tekstu profilu (last_study_date / daily_xp_date = toDateString(), np. „Tue Nov 03 2026”).
create or replace function public._push_date(p text)
returns date language plpgsql stable set search_path = public as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  if p ~ '^[A-Z][a-z]{2} [A-Z][a-z]{2} [0-9]{2} [0-9]{4}$' then
    return to_date(substr(p, 5), 'Mon DD YYYY');
  end if;
  return p::date;
exception when others then
  return null;
end $$;

-- Strefa czasowa w formacie IANA (np. Europe/Warsaw), inaczej Europe/Warsaw.
create or replace function public._push_tz(p text)
returns text language plpgsql stable set search_path = public as $$
declare v text := btrim(coalesce(p, ''));
begin
  if v = '' or length(v) > 64 or v !~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$' then return 'Europe/Warsaw'; end if;
  perform now() at time zone v;
  return v;
exception when others then
  return 'Europe/Warsaw';
end $$;

-- Prognoza słówek na dzień p_day (due_count = dzień p_on, due_ahead[k] = p_on + k).
create or replace function public._push_due(p_count int, p_ahead int[], p_on date, p_day date)
returns int language sql immutable set search_path = public as $$
  select greatest(0, case
    when p_on is null or p_day <= p_on then coalesce(p_count, 0)
    else coalesce(p_ahead[least(p_day - p_on, coalesce(cardinality(p_ahead), 0))], p_count, 0)
  end);
$$;

-- Funkcja działa, jeśli uruchomiła się w ciągu ostatnich 3 godzin.
create or replace function public._push_server_ok()
returns boolean language sql stable set search_path = public as $$
  select coalesce((select last_run_at > now() - interval '3 hours' from public.push_status where id = 1), false);
$$;

-- ── 4. RPC UŻYTKOWNIKA ──────────────────────────────────────────
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_hour int, p_tz text, p_ua text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'AUTH' using errcode = '42501'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://[^[:space:]]+$' or length(p_endpoint) > 1000 then
    raise exception 'BAD_ENDPOINT' using errcode = '22023';
  end if;
  if p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_+/-]{80,100}={0,2}$'
     or p_auth is null or p_auth !~ '^[A-Za-z0-9_+/-]{16,40}={0,2}$' then
    raise exception 'BAD_KEYS' using errcode = '22023';
  end if;
  if p_hour is null or p_hour not between 7 and 21 then raise exception 'BAD_HOUR' using errcode = '22023'; end if;

  insert into public.push_subscriptions as s (user_id, endpoint, p256dh, auth, remind_hour, tz, ua, seen_at, updated_at)
  values (v_me, p_endpoint, p_p256dh, p_auth, p_hour, public._push_tz(p_tz), left(nullif(btrim(coalesce(p_ua, '')), ''), 200), now(), now())
  on conflict (endpoint) do update set
    p256dh       = excluded.p256dh,
    auth         = excluded.auth,
    remind_hour  = excluded.remind_hour,
    tz           = excluded.tz,
    ua           = excluded.ua,
    fail_count   = 0,
    seen_at      = now(),
    updated_at   = now(),
    -- urządzenie przechodzi na inne konto (np. wspólny tablet) → bez cudzej prognozy i pupila
    due_count    = case when s.user_id = excluded.user_id then s.due_count else 0 end,
    due_ahead    = case when s.user_id = excluded.user_id then s.due_ahead end,
    due_on       = case when s.user_id = excluded.user_id then s.due_on end,
    pet          = case when s.user_id = excluded.user_id then s.pet end,
    last_sent_on = case when s.user_id = excluded.user_id then s.last_sent_on end,
    user_id      = excluded.user_id;

  -- max 10 urządzeń na konto (najdawniej używane wypadają)
  delete from public.push_subscriptions d
   where d.user_id = v_me
     and d.id not in (select x.id from public.push_subscriptions x where x.user_id = v_me order by x.seen_at desc limit 10);

  return jsonb_build_object('ok', true, 'server', public._push_server_ok());
end;
$$;

create or replace function public.push_update(
  p_endpoint text, p_hour int, p_due_count int, p_pet jsonb,
  p_due_ahead int[] default null, p_due_on date default null, p_tz text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_n     int;
  v_ahead int[];
  v_pet   jsonb := case when p_pet is not null and jsonb_typeof(p_pet) = 'object' and length(p_pet::text) <= 600 then p_pet end;
begin
  if v_me is null then raise exception 'AUTH' using errcode = '42501'; end if;
  if p_hour is not null and p_hour not between 7 and 21 then raise exception 'BAD_HOUR' using errcode = '22023'; end if;
  if p_due_ahead is not null then
    select array_agg(greatest(0, least(coalesce(x, 0), 100000)) order by i) into v_ahead
      from unnest(p_due_ahead[1:7]) with ordinality as t(x, i);
  end if;

  update public.push_subscriptions s set
    remind_hour = coalesce(p_hour, s.remind_hour),
    due_count   = greatest(0, least(coalesce(p_due_count, 0), 100000)),
    due_ahead   = v_ahead,
    due_on      = case when p_due_on between current_date - 2 and current_date + 2 then p_due_on end,
    pet         = v_pet,
    tz          = case when p_tz is null then s.tz else public._push_tz(p_tz) end,
    seen_at     = now(),
    updated_at  = now()
   where s.endpoint = p_endpoint and s.user_id = v_me;
  get diagnostics v_n = row_count;

  return jsonb_build_object('found', v_n > 0, 'server', public._push_server_ok());
end;
$$;

create or replace function public.push_unsubscribe(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if auth.uid() is null then raise exception 'AUTH' using errcode = '42501'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- ── 5. RPC EDGE FUNCTION (service_role) ─────────────────────────
-- Usuwamy starsze wersje o innym typie wyniku (create or replace nie zmienia RETURNS TABLE).
drop function if exists public.push_due_now(timestamptz, int);
create function public.push_due_now(p_now timestamptz default now(), p_limit int default 5000)
returns table (id uuid, endpoint text, p256dh text, auth text, tz text, remind_hour int,
               due_count int, pet jsonb, streak int)
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.push_status as st (id, last_run_at) values (1, now())
  on conflict on constraint push_status_pkey do update set last_run_at = excluded.last_run_at;

  with z as (
    select distinct s.tz from public.push_subscriptions s
  ), zh as (
    select z.tz,
           extract(hour from (p_now at time zone z.tz))::int as h,
           (p_now at time zone z.tz)::date as d
      from z
  )
  select s.id, s.endpoint, s.p256dh, s.auth, s.tz, s.remind_hour::int,
         public._push_due(s.due_count, s.due_ahead, s.due_on, zh.d) as due_count,
         s.pet,
         case when public._push_date(p.last_study_date::text) = zh.d - 1 then coalesce(p.streak, 0) else 0 end as streak
    from zh
    join public.push_subscriptions s on s.tz = zh.tz and s.remind_hour = zh.h
    join public.profiles p on p.id = s.user_id
   where (s.last_sent_on is null or s.last_sent_on < zh.d)
     and s.seen_at > p_now - interval '30 days'
     -- dziś już była nauka → bez przypomnienia
     and coalesce(public._push_date(p.last_study_date::text), date '1900-01-01') < zh.d
     and not (coalesce(p.daily_xp, 0) > 0 and coalesce(public._push_date(p.daily_xp_date::text), date '1900-01-01') >= zh.d)
   limit greatest(1, least(coalesce(p_limit, 5000), 20000));
$$;

create or replace function public.push_mark_sent(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update public.push_subscriptions s
     set last_sent_on = (now() at time zone s.tz)::date, fail_count = 0
   where s.id = any(coalesce(p_ids, '{}'::uuid[]));
  get diagnostics v_n = row_count;
  update public.push_status set last_due = v_n where id = 1;
  return v_n;
end;
$$;

create or replace function public.push_mark_failed(p_endpoint text, p_gone boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_fails int;
begin
  if coalesce(p_gone, false) then
    delete from public.push_subscriptions where endpoint = p_endpoint;
    return 'deleted';
  end if;
  update public.push_subscriptions set fail_count = fail_count + 1
   where endpoint = p_endpoint
   returning fail_count into v_fails;
  if v_fails is null then return 'missing'; end if;
  if v_fails >= 5 then
    delete from public.push_subscriptions where endpoint = p_endpoint;
    return 'deleted';
  end if;
  return 'counted';
end;
$$;

drop function if exists public.push_test_targets(uuid);
create function public.push_test_targets(p_user uuid)
returns table (id uuid, endpoint text, p256dh text, auth text, tz text, remind_hour int,
               due_count int, pet jsonb, streak int)
language sql
volatile
security definer
set search_path = public
as $$
  with t as (
    update public.push_subscriptions s
       set last_test_at = now()
     where s.user_id = p_user
       and (s.last_test_at is null or s.last_test_at < now() - interval '30 seconds')
    returning s.*
  )
  select t.id, t.endpoint, t.p256dh, t.auth, t.tz, t.remind_hour::int,
         public._push_due(t.due_count, t.due_ahead, t.due_on, (now() at time zone t.tz)::date),
         t.pet,
         case when public._push_date(p.last_study_date::text) >= (now() at time zone t.tz)::date - 1
              then coalesce(p.streak, 0) else 0 end
    from t
    left join public.profiles p on p.id = t.user_id;
$$;

-- ── 6. UPRAWNIENIA (zasady z #84) ───────────────────────────────
-- pomocnicze — wołane tylko przez funkcje powyżej
revoke all on function public._push_date(text) from public, anon, authenticated;
revoke all on function public._push_tz(text) from public, anon, authenticated;
revoke all on function public._push_due(int, int[], date, date) from public, anon, authenticated;
revoke all on function public._push_server_ok() from public, anon, authenticated;
-- zalogowany użytkownik (sprawdzają auth.uid() same)
revoke all on function public.push_subscribe(text, text, text, int, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, int, text, text) to authenticated;
revoke all on function public.push_update(text, int, int, jsonb, int[], date, text) from public, anon;
grant execute on function public.push_update(text, int, int, jsonb, int[], date, text) to authenticated;
revoke all on function public.push_unsubscribe(text) from public, anon;
grant execute on function public.push_unsubscribe(text) to authenticated;
-- tylko Edge Function (klucz service_role)
revoke all on function public.push_due_now(timestamptz, int) from public, anon, authenticated;
grant execute on function public.push_due_now(timestamptz, int) to service_role;
revoke all on function public.push_mark_sent(uuid[]) from public, anon, authenticated;
grant execute on function public.push_mark_sent(uuid[]) to service_role;
revoke all on function public.push_mark_failed(text, boolean) from public, anon, authenticated;
grant execute on function public.push_mark_failed(text, boolean) to service_role;
revoke all on function public.push_test_targets(uuid) from public, anon, authenticated;
grant execute on function public.push_test_targets(uuid) to service_role;

select 'OK — migracja #91 (🔔 powiadomienia push) gotowa' as status;
