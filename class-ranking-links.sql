-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — RANKING MIĘDZYKLASOWY (nauczyciel wybiera klasy)
--  Migracja #60 · idempotentna
--
--  Nauczyciel przy edycji klasy X zaznacza, które INNE jego klasy mają być
--  widoczne w rankingu uczniów klasy X. Uczeń klasy X widzi wtedy wspólny
--  ranking (top 10) uczniów z klasy X + wybranych klas.
--  Brak wyboru = jak dotąd (ranking tylko własnej klasy).
--
--  1) tabela class_ranking_links(class_id, linked_class_id)
--  2) my_class_rankings() przepisane: class_id/class_name = klasa ucznia
--     („pula"), członkowie = uczniowie z klasy ucznia + klas powiązanych.
--     Nowe kolumny: member_class_name (klasa danego ucznia), multi_class.
--
--  Wymaga: #20 (_is_admin), #45 (best_correct_streak), #54 (well_learned_words).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.class_ranking_links (
  class_id        uuid not null references public.classes(id) on delete cascade,
  linked_class_id uuid not null references public.classes(id) on delete cascade,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  primary key (class_id, linked_class_id),
  check (class_id <> linked_class_id)
);

alter table public.class_ranking_links enable row level security;

-- Odczyt: admin albo właściciel klasy (nauczyciel, który ją utworzył).
drop policy if exists "crl: select owner" on public.class_ranking_links;
create policy "crl: select owner" on public.class_ranking_links
  for select using (
    public._is_admin()
    or exists (select 1 from public.classes c
                where c.id = class_ranking_links.class_id and c.admin_id = auth.uid())
  );

-- Zapis: admin dowolnie; nauczyciel tylko między WŁASNYMI klasami.
drop policy if exists "crl: insert owner" on public.class_ranking_links;
create policy "crl: insert owner" on public.class_ranking_links
  for insert with check (
    public._is_admin()
    or (
      exists (select 1 from public.classes c
               where c.id = class_ranking_links.class_id and c.admin_id = auth.uid())
      and exists (select 1 from public.classes c2
               where c2.id = class_ranking_links.linked_class_id and c2.admin_id = auth.uid())
    )
  );

drop policy if exists "crl: delete owner" on public.class_ranking_links;
create policy "crl: delete owner" on public.class_ranking_links
  for delete using (
    public._is_admin()
    or exists (select 1 from public.classes c
                where c.id = class_ranking_links.class_id and c.admin_id = auth.uid())
  );

grant select, insert, delete on public.class_ranking_links to authenticated;

-- ── RPC rankingu ucznia z pulą klas ──────────────────────────────
-- RETURNS TABLE zmienia sygnaturę → DROP przed CREATE.
drop function if exists public.my_class_rankings();

create function public.my_class_rankings()
returns table (
  class_id          uuid,
  class_name        text,
  user_id           uuid,
  username          text,
  xp_today          int,
  xp_week           int,
  xp_month          int,
  longest_streak    int,
  best_combo        int,
  level             int,
  xp_total          int,
  well_learned      int,
  member_class_name text,
  multi_class       boolean
)
language sql
security definer
set search_path = public
as $$
  with mine as (
    select me.class_id from public.class_members me where me.user_id = auth.uid()
  ),
  pool as (
    -- własna klasa zawsze w puli + klasy wybrane przez nauczyciela
    select m.class_id as pool_id, m.class_id as member_class from mine m
    union
    select m.class_id, l.linked_class_id
      from mine m join public.class_ranking_links l on l.class_id = m.class_id
  ),
  people as (
    -- uczeń w kilku klasach puli liczony raz (preferuj klasę-pulę)
    select distinct on (p.pool_id, cm.user_id)
           p.pool_id, cm.user_id, cm.class_id as member_class
      from pool p
      join public.class_members cm on cm.class_id = p.member_class
     order by p.pool_id, cm.user_id, (cm.class_id = p.pool_id) desc
  )
  select
    pc.id, pc.name, pr.id, pr.username,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = pr.id and d.day = current_date), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = pr.id and d.day >= current_date - interval '6 days'), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d
                where d.user_id = pr.id and d.day >= current_date - interval '30 days'), 0)::int,
    coalesce(pr.longest_streak, 0),
    coalesce(pr.best_correct_streak, 0),
    coalesce(pr.level, 1),
    coalesce(pr.xp, 0),
    coalesce(pr.well_learned_words, 0),
    mc.name,
    (select count(*) from pool x where x.pool_id = pe.pool_id) > 1
  from people pe
  join public.classes  pc on pc.id = pe.pool_id
  join public.classes  mc on mc.id = pe.member_class
  join public.profiles pr on pr.id = pe.user_id
  where coalesce(pr.is_admin, false) = false
    and coalesce(pr.is_teacher, false) = false;
$$;

grant execute on function public.my_class_rankings() to authenticated;

select 'OK — migracja #60 (ranking miedzyklasowy) gotowa' as status;
