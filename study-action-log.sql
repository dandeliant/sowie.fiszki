-- ════════════════════════════════════════════════════════════════════
--  Migracja #96 — 📜 przebieg nauki ucznia (dziennik kliknięć dla nauczyciela)
--  (06.11.2026, SW v1.253)
--
--  Aplikacja zbiera poczynania ucznia w nauce: oceny w Fiszkach (z czasem od
--  odwrócenia karty), odpowiedzi w trybach (co wpisał / co wybrał, dobrze /
--  źle), „Nie wiem”, zmiany trybów, wejścia do gier, próby wejścia do
--  zablokowanych gier, 🙈 Ignoruj — i wysyła je paczkami (najwyżej co ~45 s)
--  jako JEDEN wiersz z tablicą zdarzeń (mało zapisów — limit Disk IO na Nano).
--
--  1) tabela study_actions (user_id, day, events jsonb) — bez dostępu z REST,
--     tylko przez funkcje; dane starsze niż 30 dni usuwane przy zapisie
--  2) log_study_actions(p_events jsonb) — zapis paczki (uczeń)
--  3) student_action_days(p_user, p_days) — dni z zapisami (liczba zdarzeń)
--  4) student_action_log(p_user, p_day) — zdarzenia z jednego dnia
--     Widzi: sam uczeń, jego nauczyciel (_is_teacher_of), opiekun (_is_parent_of), admin.
--  5) uprawnienia jak w #84
--
--  Idempotentna — można uruchamiać wielokrotnie.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) Tabela ───────────────────────────────────────────────────────
create table if not exists public.study_actions (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  n          int not null default 0,
  events     jsonb not null
);
create index if not exists study_actions_user_day on public.study_actions (user_id, day, created_at);
alter table public.study_actions enable row level security;
-- brak polityk = brak dostępu przez /rest/v1/study_actions; czytanie i zapis tylko przez funkcje niżej
revoke all on table public.study_actions from public, anon, authenticated;
revoke all on sequence public.study_actions_id_seq from public, anon, authenticated;

-- ── 2) Zapis paczki zdarzeń ─────────────────────────────────────────
--  p_events: tablica obiektów (najwyżej 300, ~64 KB). Dzień: z czasu pierwszego
--  zdarzenia (pole t, ms) w strefie Europe/Warsaw, gdy mieści się w ostatnich
--  2 dniach — inaczej dzisiejszy. Najwyżej 500 paczek na ucznia dziennie.
create or replace function public.log_study_actions(p_events jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  me    uuid := auth.uid();
  today date := (now() at time zone 'Europe/Warsaw')::date;
  d     date;
  n     int;
  t0    double precision;
begin
  if me is null then return 0; end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'Zła paczka zdarzeń.' using errcode = '22023';
  end if;
  n := jsonb_array_length(p_events);
  if n = 0 then return 0; end if;
  if n > 300 or length(p_events::text) > 65536 then
    raise exception 'Za duża paczka zdarzeń.' using errcode = '22023';
  end if;
  begin
    t0 := (p_events -> 0 ->> 't')::double precision;
  exception when others then t0 := null;
  end;
  d := case when t0 is null then today
            else (to_timestamp(t0 / 1000.0) at time zone 'Europe/Warsaw')::date end;
  if d is null or d > today or d < today - 2 then d := today; end if;
  if (select count(*) from public.study_actions s where s.user_id = me and s.day = today) >= 500 then
    return 0;
  end if;
  insert into public.study_actions (user_id, day, n, events) values (me, d, n, p_events);
  -- porządek: tylko ostatnie 30 dni (indeks user_id, day)
  delete from public.study_actions s where s.user_id = me and s.day < today - 30;
  return n;
end;
$$;

-- ── 3) Dni z zapisami ───────────────────────────────────────────────
create or replace function public.student_action_days(p_user uuid, p_days int default 30)
returns table (day date, events int, batches int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_user is null
     or not (auth.uid() = p_user or public._is_teacher_of(p_user) or public._is_parent_of(p_user)) then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  return query
  select s.day, sum(s.n)::int, count(*)::int
    from public.study_actions s
   where s.user_id = p_user
     and s.day >= (now() at time zone 'Europe/Warsaw')::date - (greatest(1, least(coalesce(p_days, 30), 31)) - 1)
   group by s.day
   order by s.day desc;
end;
$$;

-- ── 4) Zdarzenia z jednego dnia (paczki po kolei) ───────────────────
create or replace function public.student_action_log(p_user uuid, p_day date)
returns table (created_at timestamptz, events jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or p_user is null
     or not (auth.uid() = p_user or public._is_teacher_of(p_user) or public._is_parent_of(p_user)) then
    raise exception 'Brak uprawnień.' using errcode = '42501';
  end if;
  return query
  select s.created_at, s.events
    from public.study_actions s
   where s.user_id = p_user and s.day = p_day
   order by s.created_at, s.id
   limit 600;
end;
$$;

-- ── 5) Uprawnienia (zasady z #84) ───────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.log_study_actions(jsonb)', 'public.student_action_days(uuid,int)', 'public.student_action_log(uuid,date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select 'OK — migracja #96 (📜 przebieg nauki ucznia dla nauczyciela) gotowa' as status;
