-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — wyłączone tygodnie (nauczyciel) do oceny sugerowanej
--  Migracja #52 · idempotentna
--
--  Nauczyciel może wyłączyć wystawianie oceny tygodniowej w konkretnym
--  tygodniu (święta, zielona szkoła). Wyłączony tydzień NIE jest brany
--  pod uwagę przy liczeniu oceny miesięcznej.
--
--  Zakres per-uczeń: (user_id, week_start). week_start = poniedziałek (DATE).
--  Wymaga: fix-rls-recursion.sql (#20) — helpery _is_admin/_is_teacher.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.grade_disabled_weeks (
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,
  disabled_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.grade_disabled_weeks enable row level security;

-- SELECT: własne (uczeń widzi swoje) LUB nauczyciel/admin
drop policy if exists gdw_sel on public.grade_disabled_weeks;
create policy gdw_sel on public.grade_disabled_weeks
  for select using ( user_id = auth.uid() or public._is_admin() or public._is_teacher() );

-- INSERT/DELETE: tylko nauczyciel/admin (uczeń nie wyłącza sobie ocen)
drop policy if exists gdw_ins on public.grade_disabled_weeks;
create policy gdw_ins on public.grade_disabled_weeks
  for insert with check ( public._is_admin() or public._is_teacher() );

drop policy if exists gdw_del on public.grade_disabled_weeks;
create policy gdw_del on public.grade_disabled_weeks
  for delete using ( public._is_admin() or public._is_teacher() );

grant select, insert, delete on public.grade_disabled_weeks to authenticated;
