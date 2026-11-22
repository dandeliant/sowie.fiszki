-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🔓 TRYBY OD RAZU DLA WYBRANYCH UCZNIÓW
--  Migracja #102 · idempotentna (można uruchomić ponownie) · 22.11.2026, SW v1.266
--
--  Blokada „najpierw ✏️ Wpisz” (SW v1.266): na początku dnia uczeń ma tylko ✏️ Wpisz.
--  Gry i pozostałe tryby (także 🃏 Fiszki) odblokowują się, gdy zaliczy dzisiejszą
--  naukę w Wpisz. Nauczyciel (albo admin) może teraz wybranym uczniom otworzyć od razu
--  WYBRANE tryby (np. młodszemu: Fiszki, Quiz i gry) — albo, jak w #101, wszystko.
--
--  1) profiles — nowe kolumny (profil ucznia jest wczytywany przy starcie, lista klasy
--     czyta profile uczniów → zero dodatkowych zapytań):
--       open_modes         text[] — tryby otwarte od razu (null = brak wyjątków);
--                          'games' = rząd „🎮 Gry”, gry z listy rozdziałów i INNE,
--       open_modes_set_by  kto ustawił (konto usunięte → null),
--       open_modes_set_at  kiedy.
--     CHECK profiles_open_modes_known — tylko znane tryby (lista jak w RPC niżej).
--  2) Strażnik profiles_open_modes_guard (SECURITY INVOKER — działa tylko przy zapisie
--     wprost z aplikacji, current_user authenticated/anon): uczeń nie otworzy sobie
--     trybów sam — tylko RPC.
--  3) RPC set_students_open_modes(p_student_ids uuid[], p_modes text[], p_all boolean) → int:
--     p_all = true  → games_free = true (wszystko od razu, #101), open_modes = null;
--     p_all = false → games_free = false, open_modes = p_modes (nieznane tryby pomijane,
--                     pusta lista = null — zwykła blokada).
--     Kto może i komu — jak #101: admin albo nauczyciel; uczniowie, których wywołujący
--     „ma” (_is_teacher_of, #75), tylko konta uczniów (nie admin / nauczyciel / opiekun,
--     nie siebie). Max 200 w jednym wywołaniu. Zwraca liczbę uczniów, którym ustawienie
--     jest teraz takie, jak wybrano. Błędy: AUTH, NOT_ALLOWED, TOO_MANY.
--  Odczyt: uczeń — własny profil; nauczyciel — profile swoich uczniów (#75); admin — wszystkie.
--
--  Wymaga: #20 (_is_admin, _is_teacher), #75 (_is_teacher_of), #101 (games_free).
--  Uruchom w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._is_teacher_of(uuid)') is null then
    raise exception 'Najpierw uruchom migrację #75 (teacher-scope-rls.sql) — brak funkcji _is_teacher_of.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'games_free') then
    raise exception 'Najpierw uruchom migrację #101 (student-games-free.sql) — brak kolumny profiles.games_free.';
  end if;
end $$;

-- ── 1. KOLUMNY ───────────────────────────────────────────────────
alter table public.profiles add column if not exists open_modes text[];
alter table public.profiles add column if not exists open_modes_set_by uuid;
alter table public.profiles add column if not exists open_modes_set_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass and conname = 'profiles_open_modes_set_by_fkey') then
    alter table public.profiles add constraint profiles_open_modes_set_by_fkey
      foreign key (open_modes_set_by) references auth.users(id) on delete set null;
  end if;
end $$;
-- tylko znane tryby (te same co w RPC); przy zmianie listy — ponowne uruchomienie odtwarza CHECK
alter table public.profiles drop constraint if exists profiles_open_modes_known;
alter table public.profiles add constraint profiles_open_modes_known check (
  open_modes is null or (cardinality(open_modes) <= 20 and open_modes <@ array[
    'card', 'quiz', 'speed', 'match', 'tf', 'missing', 'gap', 'scramble', 'sentscr', 'typeSent', 'write',
    'dictate', 'dictSent', 'speak', 'speakSent', 'games']::text[]));

-- ── 2. STRAŻNIK — kolumny zmienia tylko RPC ─────────────────────
create or replace function public._profiles_open_modes_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.open_modes := null;
      new.open_modes_set_by := null;
      new.open_modes_set_at := null;
    else
      new.open_modes := old.open_modes;
      new.open_modes_set_by := old.open_modes_set_by;
      new.open_modes_set_at := old.open_modes_set_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_open_modes_guard on public.profiles;
create trigger profiles_open_modes_guard
  before insert or update of open_modes, open_modes_set_by, open_modes_set_at on public.profiles
  for each row execute function public._profiles_open_modes_guard();

-- ── 3. RPC NAUCZYCIELA / ADMINA ─────────────────────────────────
create or replace function public.set_students_open_modes(p_student_ids uuid[], p_modes text[], p_all boolean default false)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_all   boolean := coalesce(p_all, false);
  v_modes text[];
  v_n     int;
begin
  if v_me is null then
    raise exception 'AUTH' using errcode = '42501';
  end if;
  if not (public._is_admin() or public._is_teacher()) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    return 0;
  end if;
  if cardinality(p_student_ids) > 200 then
    raise exception 'TOO_MANY' using errcode = '22023';
  end if;

  -- znane tryby, bez powtórek, po kolei (pusta lista → null = zwykła blokada)
  if not v_all then
    select array_agg(m order by m) into v_modes
      from (select distinct m from unnest(coalesce(p_modes, '{}'::text[])) as t(m)
             where m = any(array['card', 'quiz', 'speed', 'match', 'tf', 'missing', 'gap', 'scramble', 'sentscr',
                                 'typeSent', 'write', 'dictate', 'dictSent', 'speak', 'speakSent', 'games']::text[])) s;
  end if;

  -- „moi” uczniowie z listy; zapis tylko tam, gdzie ustawienie się zmienia
  with ok as (
    select p.id
      from public.profiles p
     where p.id = any(p_student_ids)
       and p.id <> v_me
       and not coalesce(p.is_admin, false)
       and not coalesce(p.is_teacher, false)
       and not coalesce(p.is_parent, false)
       and public._is_teacher_of(p.id)
  ), upd as (
    update public.profiles p
       set games_free        = v_all,
           games_free_set_by = case when v_all then v_me else null end,
           games_free_set_at = case when v_all then now() else null end,
           open_modes        = v_modes,
           open_modes_set_by = case when v_modes is not null then v_me else null end,
           open_modes_set_at = case when v_modes is not null then now() else null end
      from ok
     where p.id = ok.id
       and (p.games_free is distinct from v_all or p.open_modes is distinct from v_modes)
    returning p.id
  )
  select count(*)::int into v_n from ok;

  return v_n;
end;
$$;

-- ── 4. UPRAWNIENIA (zasady z #84) ───────────────────────────────
revoke all on function public._profiles_open_modes_guard() from public, anon, authenticated;
revoke all on function public.set_students_open_modes(uuid[], text[], boolean) from public, anon;
grant execute on function public.set_students_open_modes(uuid[], text[], boolean) to authenticated;

select 'OK — migracja #102 (🔓 tryby od razu dla wybranych uczniów) gotowa' as status;
