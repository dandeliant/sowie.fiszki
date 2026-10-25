-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — nauczyciel widzi TYLKO SWOICH uczniów (RLS)
--  Migracja #75 · idempotentna
--
--  Problem: kilka polityk wpuszczało KAŻDEGO nauczyciela (_is_teacher()
--  / is_teacher()) do danych WSZYSTKICH uczniów, a konto nauczyciela może
--  założyć każdy przez formularz rejestracji (wybór roli „Nauczyciel").
--    • daily_xp_log      — dxp_select_teacher (fix-rls-recursion.sql)
--    • typed_answers     — typed_answers_sel (#51)
--    • grade_disabled_weeks — gdw_sel / gdw_ins / gdw_del (#52)
--    • game_sessions     — gs_select (#66)
--    • profiles          — „profiles: teacher SELECT all" (add-teacher-role.sql)
--    • classes           — „classes: teacher all"  (każda klasa, także cudza!)
--    • class_members     — „class_members: teacher all"
--    • user_books        — „user_books: teacher all" (nadawanie podręczników komukolwiek)
--  oraz RPC, którymi dało się „przejąć" cudzego ucznia:
--    • set_profile_creator — nauczyciel mógł wpisać się jako twórca KAŻDEGO
--      konta z created_by IS NULL (wszystkie konta z samodzielnej rejestracji)
--    • admin_link_parent_to_student — nauczyciel mógł podpiąć dowolne konto
--      (także własne) jako opiekuna dowolnego ucznia → dostęp jak rodzic
--    • child_active_challenges — wyzwania klas dowolnego ucznia
--
--  Nowa reguła — „nauczyciel tego ucznia" (helper _is_teacher_of):
--    admin  LUB  (nauczyciel  AND  ( profiles.created_by = auth.uid()
--                                    LUB uczeń jest w klasie z classes.admin_id = auth.uid() ))
--  Opiekun (_is_parent_of) zachowuje dostęp tam, gdzie go miał.
--  Helpery są SECURITY DEFINER (jak w #20) — bez rekurencji RLS.
--
--  Wymaga: #13 (created_by), #17 (parent_children), #20 (_is_admin/_is_teacher/
--  _is_parent_of). Tabele z #46/#51/#52/#66/activity_events — tylko jeśli istnieją.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Helpery ───────────────────────────────────────────────────

-- Czy zalogowany jest właścicielem klasy? (classes.admin_id)
create or replace function public._owns_class(p_class uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.classes c where c.id = p_class and c.admin_id = auth.uid());
$$;

-- Czy zalogowany jest adminem albo nauczycielem tego ucznia?
create or replace function public._is_teacher_of(p_student uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public._is_admin()
      or (p_student is not null and public._is_teacher() and (
            exists (select 1 from public.profiles p
                     where p.id = p_student and p.created_by = auth.uid())
         or exists (select 1 from public.class_members m
                      join public.classes c on c.id = m.class_id
                     where m.user_id = p_student and c.admin_id = auth.uid())
      ));
$$;

grant execute on function public._owns_class(uuid)    to anon, authenticated;
grant execute on function public._is_teacher_of(uuid) to anon, authenticated;

-- ── 2. Tabele z bazowego schematu ───────────────────────────────

-- profiles: nauczyciel widzi tylko swoich uczniów (i konta, które sam utworzył,
-- np. opiekunów z masowego tworzenia kont). Własny profil, admin i opiekun — bez zmian.
drop policy if exists "profiles: teacher SELECT all" on public.profiles;
drop policy if exists "profiles: teacher SELECT own students" on public.profiles;
create policy "profiles: teacher SELECT own students" on public.profiles
  for select using (public._is_teacher_of(id));

-- classes: nauczyciel zarządza tylko własnymi klasami (admin — „classes: admin all").
drop policy if exists "classes: teacher all" on public.classes;
drop policy if exists "classes: teacher own" on public.classes;
create policy "classes: teacher own" on public.classes
  for all
  using (public._is_teacher() and admin_id = auth.uid())
  with check (public._is_teacher() and admin_id = auth.uid());

-- class_members: tylko w swoich klasach; dodać można tylko swojego ucznia
-- (inaczej: login → id z find_user_by_username → dopisanie do klasy → dostęp).
drop policy if exists "class_members: teacher all" on public.class_members;
drop policy if exists "class_members: teacher own class" on public.class_members;
create policy "class_members: teacher own class" on public.class_members
  for all
  using (public._is_teacher() and public._owns_class(class_id))
  with check (public._is_teacher() and public._owns_class(class_id) and public._is_teacher_of(user_id));

-- user_books: nauczyciel nadaje/odbiera/czyta podręczniki tylko swoich uczniów.
drop policy if exists "user_books: teacher all" on public.user_books;
drop policy if exists "user_books: teacher own students" on public.user_books;
create policy "user_books: teacher own students" on public.user_books
  for all
  using (public._is_teacher() and public._is_teacher_of(user_id))
  with check (public._is_teacher() and public._is_teacher_of(user_id));

-- unit_progress: postęp ucznia w widoku nauczyciela (loadUserProgress).
drop policy if exists "up_select_teacher_of" on public.unit_progress;
create policy "up_select_teacher_of" on public.unit_progress
  for select using (public._is_teacher_of(user_id));

-- ── 3. Tabele z późniejszych migracji (jeśli istnieją) ─────────

do $$
begin
  -- daily_xp_log (#21): historia XP / aktywność / oceny tygodniowe
  if to_regclass('public.daily_xp_log') is not null then
    execute 'drop policy if exists "dxp_select_teacher" on public.daily_xp_log';
    execute 'drop policy if exists "dxl_select_teacher_created" on public.daily_xp_log';
    execute 'create policy "dxp_select_teacher" on public.daily_xp_log
               for select using (public._is_teacher_of(user_id))';
  end if;

  -- typed_answers (#51): Szczegóły „Wpisz"
  if to_regclass('public.typed_answers') is not null then
    execute 'drop policy if exists typed_answers_sel on public.typed_answers';
    execute 'create policy typed_answers_sel on public.typed_answers
               for select using (user_id = auth.uid() or public._is_teacher_of(user_id))';
  end if;

  -- grade_disabled_weeks (#52): wyłączone tygodnie oceny
  if to_regclass('public.grade_disabled_weeks') is not null then
    execute 'drop policy if exists gdw_sel on public.grade_disabled_weeks';
    execute 'drop policy if exists gdw_ins on public.grade_disabled_weeks';
    execute 'drop policy if exists gdw_upd on public.grade_disabled_weeks';
    execute 'drop policy if exists gdw_del on public.grade_disabled_weeks';
    execute 'create policy gdw_sel on public.grade_disabled_weeks
               for select using (user_id = auth.uid() or public._is_teacher_of(user_id))';
    execute 'create policy gdw_ins on public.grade_disabled_weeks
               for insert with check (public._is_teacher_of(user_id))';
    -- setDisabledWeek robi upsert — przy konflikcie potrzebny UPDATE
    execute 'create policy gdw_upd on public.grade_disabled_weeks
               for update using (public._is_teacher_of(user_id)) with check (public._is_teacher_of(user_id))';
    execute 'create policy gdw_del on public.grade_disabled_weeks
               for delete using (public._is_teacher_of(user_id))';
    execute 'grant select, insert, update, delete on public.grade_disabled_weeks to authenticated';
  end if;

  -- game_sessions (#66): sesje gier
  if to_regclass('public.game_sessions') is not null then
    execute 'drop policy if exists gs_select on public.game_sessions';
    execute 'create policy gs_select on public.game_sessions for select using (
               user_id = auth.uid() or public._is_teacher_of(user_id) or public._is_parent_of(user_id))';
  end if;

  -- activity_events: było created_by — teraz także uczniowie z klas nauczyciela
  if to_regclass('public.activity_events') is not null then
    execute 'drop policy if exists "Activity select" on public.activity_events';
    execute 'create policy "Activity select" on public.activity_events for select using (
               user_id = auth.uid() or public._is_teacher_of(user_id) or public._is_parent_of(user_id))';
  end if;
end$$;

-- ── 4. RPC ───────────────────────────────────────────────────────

-- set_profile_creator: nauczyciel przypisuje się tylko do konta utworzonego
-- przed chwilą przez admin_create_user (nigdy niezalogowanego). Wcześniej mógł
-- „przejąć" każde konto z samodzielnej rejestracji (created_by IS NULL).
create or replace function public.set_profile_creator(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin   boolean;
  v_is_teacher boolean;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany.';
  end if;

  select coalesce(is_admin, false), coalesce(is_teacher, false)
    into v_is_admin, v_is_teacher
    from public.profiles where id = auth.uid();

  if v_is_admin is not true and v_is_teacher is not true then
    raise exception 'Brak uprawnień.';
  end if;

  if v_is_admin is not true and not exists (
       select 1 from auth.users u
        where u.id = p_user_id
          and u.last_sign_in_at is null
          and u.created_at > now() - interval '15 minutes') then
    raise exception 'Możesz przypisać sobie tylko konto, które właśnie utworzyłeś.';
  end if;

  update public.profiles
     set created_by = auth.uid()
   where id = p_user_id
     and id <> auth.uid()
     and created_by is null;
end;
$$;

revoke all on function public.set_profile_creator(uuid) from public;
grant execute on function public.set_profile_creator(uuid) to authenticated;

-- admin_link_parent_to_student (#38): nauczyciel łączy tylko SWOJEGO ucznia
-- z kontem opiekuna, które SAM utworzył (masowe tworzenie kont z opiekunami).
create or replace function public.admin_link_parent_to_student(
  p_parent_id uuid,
  p_student_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public._is_admin() or public._is_teacher()) then
    raise exception 'Brak uprawnien — tylko admin lub nauczyciel moga linkowac opiekuna do ucznia';
  end if;

  if p_parent_id = p_student_id then
    raise exception 'parent_id i student_id musza byc rozne';
  end if;

  if not exists (select 1 from public.profiles where id = p_parent_id) then
    raise exception 'Konto opiekuna nie istnieje (id: %)', p_parent_id;
  end if;
  if not exists (select 1 from public.profiles where id = p_student_id) then
    raise exception 'Konto ucznia nie istnieje (id: %)', p_student_id;
  end if;

  if not public._is_admin() then
    if not public._is_teacher_of(p_student_id) then
      raise exception 'Mozesz powiazac opiekuna tylko ze swoim uczniem.';
    end if;
    if not exists (select 1 from public.profiles
                    where id = p_parent_id and created_by = auth.uid()
                      and coalesce(is_admin, false) = false
                      and coalesce(is_teacher, false) = false) then
      raise exception 'Mozesz powiazac tylko konto opiekuna, ktore sam utworzyles.';
    end if;
  end if;

  update public.profiles set is_parent = true where id = p_parent_id;

  insert into public.parent_children (parent_id, child_id)
  values (p_parent_id, p_student_id)
  on conflict do nothing;
end;
$$;

grant execute on function public.admin_link_parent_to_student(uuid, uuid) to authenticated;

-- child_active_challenges (#48): nauczyciel tylko dla swojego ucznia.
create or replace function public.child_active_challenges(p_child_id uuid)
returns table (
  id          uuid,
  class_id    uuid,
  class_name  text,
  title       text,
  goal_type   text,
  goal_amount int,
  ends_at     date,
  progress    int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if not (public._is_teacher_of(p_child_id) or public._is_parent_of(p_child_id)) then
    return;
  end if;

  return query
    select c.id, c.class_id, cl.name, c.title, c.goal_type, c.goal_amount, c.ends_at,
      coalesce((
        select sum(case when c.goal_type = 'words' then d.words else d.xp end)
          from public.daily_xp_log d
          join public.class_members m2 on m2.user_id = d.user_id and m2.class_id = c.class_id
         where d.day between c.starts_at and c.ends_at
      ), 0)::int as progress
    from public.class_challenges c
    join public.classes cl on cl.id = c.class_id
    where c.ends_at >= current_date
      and exists (
        select 1 from public.class_members m
         where m.class_id = c.class_id and m.user_id = p_child_id
      )
    order by c.ends_at asc;
end;
$$;

grant execute on function public.child_active_challenges(uuid) to authenticated;

-- ── 5. Kontrola: pozostałe polityki z is_teacher (do przejrzenia) ──
-- Polityki dodane kiedyś ręcznie w panelu Supabase nie są w repozytorium.
-- Poniższa lista pokazuje polityki, które wpuszczają nauczyciela BEZ zawężenia
-- do jego uczniów/klas (brak _is_teacher_of / _owns_class / created_by / admin_id).
-- Pusty wynik = OK. Jeśli coś się pojawi — przejrzyj to przed udostępnieniem.
select schemaname, tablename, policyname, cmd,
       coalesce(qual, '') as using_expr, coalesce(with_check, '') as check_expr
  from pg_policies
 where coalesce(qual, '') || ' ' || coalesce(with_check, '') ~* 'is_teacher'
   and coalesce(qual, '') || ' ' || coalesce(with_check, '') !~* '_is_teacher_of|_owns_class|created_by|admin_id'
 order by tablename, policyname;
