-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — ranking klasy dla ucznia wg PRZYSWOJONYCH SŁÓWEK
--  Migracja #54 · idempotentna
--
--  Cel: uczeń widzi ranking klasy uszeregowany wg liczby słów opanowanych
--  BARDZO DOBRZE (interval powtórki > 7 dni). To metryka odporna na
--  „klikanie" — słowo dochodzi do tego progu tylko przez rzetelne, rozłożone
--  w czasie powtórki (a tryby z wpisywaniem są ścisłe).
--
--  1) profiles.well_learned_words INT — licznik utrzymywany przez klienta
--     (liczony z lokalnych word_states przez _acqCompute i zapisywany).
--  2) my_class_rankings() rozszerzone o: level, xp_total, well_learned.
--
--  Wymaga: add-ranking-stats.sql (#45) i student-class-ranking.sql (#47).
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists well_learned_words int not null default 0;

-- RETURNS TABLE zmienia sygnaturę → trzeba DROP przed CREATE.
drop function if exists public.my_class_rankings();

create function public.my_class_rankings()
returns table (
  class_id       uuid,
  class_name     text,
  user_id        uuid,
  username       text,
  xp_today       int,
  xp_week        int,
  xp_month       int,
  longest_streak int,
  best_combo     int,
  level          int,
  xp_total       int,
  well_learned   int
)
language sql
security definer
set search_path = public
as $$
  select
    cl.id, cl.name, p.id, p.username,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = p.id and d.day = current_date), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = p.id and d.day >= current_date - interval '6 days'), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = p.id and d.day >= current_date - interval '30 days'), 0)::int,
    coalesce(p.longest_streak, 0),
    coalesce(p.best_correct_streak, 0),
    coalesce(p.level, 1),
    coalesce(p.xp, 0),
    coalesce(p.well_learned_words, 0)
  from public.class_members me
  join public.class_members cm on cm.class_id = me.class_id
  join public.classes  cl on cl.id = cm.class_id
  join public.profiles p  on p.id = cm.user_id
  where me.user_id = auth.uid()
    and coalesce(p.is_admin, false) = false
    and coalesce(p.is_teacher, false) = false;
$$;

grant execute on function public.my_class_rankings() to authenticated;

select 'OK — migracja #54 (ranking wg przyswojonych slow) gotowa' as status;
