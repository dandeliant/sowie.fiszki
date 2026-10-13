-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — SESJE GIER (punkty i czas gry w statystykach ucznia)
--  Migracja #66 · idempotentna
--
--  Każde wejście do gry z rzędu „🎮 Gry" (Skoczek, Most, Motyle, Wyścig,
--  Rakieta, Słówkoło, Balony, Miodzio, …, Memory, Wisielec, Rywalizacja)
--  zapisuje jedną sesję: gra, podręcznik/rozdział, punkty zdobyte w grze,
--  poprawne odpowiedzi (gdy gra je liczy), czas AKTYWNEJ gry (bez bezczynności
--  >60 s i bez czasu w ukrytej karcie).
--  Klient (game-stats.js) buforuje sesje w localStorage, a app.html wysyła je
--  upsertem po id (sesję można aktualizować, dopóki trwa).
--
--  Widoczność: uczeń — własne; nauczyciel/admin — wszystkie (jak typed_answers);
--  opiekun — swoich dzieci.
--  Wymaga: #20 (_is_admin/_is_teacher/_is_parent_of).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.game_sessions (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  game          text not null check (char_length(game) between 1 and 40),
  book_id       text,
  unit_key      text,
  score         int  not null default 0 check (score between 0 and 1000000),
  correct       int  check (correct between 0 and 100000),
  duration_sec  int  not null default 0 check (duration_sec between 0 and 43200),
  started_at    timestamptz not null default now(),
  day           date not null default current_date,
  updated_at    timestamptz not null default now()
);

create index if not exists idx_game_sessions_user_day on public.game_sessions (user_id, day desc);

alter table public.game_sessions enable row level security;

drop policy if exists gs_select on public.game_sessions;
drop policy if exists gs_insert on public.game_sessions;
drop policy if exists gs_update on public.game_sessions;
drop policy if exists gs_delete on public.game_sessions;

create policy gs_select on public.game_sessions for select using (
  user_id = auth.uid() or public._is_admin() or public._is_teacher() or public._is_parent_of(user_id)
);
create policy gs_insert on public.game_sessions for insert with check (user_id = auth.uid());
create policy gs_update on public.game_sessions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy gs_delete on public.game_sessions for delete using (user_id = auth.uid() or public._is_admin());

grant select, insert, update, delete on public.game_sessions to authenticated;

select 'OK — game_sessions gotowe (#66).' as status;
