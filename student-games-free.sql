-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🎮 GRY BEZ BLOKADY DLA WYBRANYCH UCZNIÓW
--  Migracja #101 · idempotentna (można uruchomić ponownie) · 13.11.2026, SW v1.262
--
--  Blokada „najpierw nauka” (SW v1.251): gry i pozostałe tryby odblokowują się
--  dopiero po 10 słówkach wpisanych poprawnie za 1. razem w ✏️ Wpisz.
--  Nauczyciel (albo admin) może teraz wybranym uczniom wyłączyć tę blokadę —
--  gry i wszystkie tryby są dla nich otwarte od razu.
--
--  1) profiles — nowe kolumny (jak „🚀 Tryb na start”, #89 — profil ucznia jest
--     wczytywany przy starcie, lista klasy czyta profile uczniów → zero zapytań):
--       games_free         true = gry bez blokady,
--       games_free_set_by  kto ustawił (konto usunięte → null),
--       games_free_set_at  kiedy.
--  2) Strażnik profiles_games_free_guard (SECURITY INVOKER — działa tylko przy
--     zapisie wprost z aplikacji, current_user authenticated/anon): uczeń nie
--     włączy sobie tego sam, nauczyciel nie ominie sprawdzania — tylko RPC.
--  3) RPC set_students_games_free(p_student_ids uuid[], p_free boolean) → int:
--     admin albo nauczyciel; uczniowie, których wywołujący „ma” (_is_teacher_of,
--     #75), tylko konta uczniów (nie admin / nauczyciel / opiekun, nie siebie);
--     p_free null = false. Max 200 w jednym wywołaniu. Zwraca liczbę uczniów,
--     którym ustawienie jest teraz takie, jak wybrano. Błędy: AUTH, NOT_ALLOWED, TOO_MANY.
--  Odczyt: uczeń — własny profil; nauczyciel — profile swoich uczniów (#75); admin — wszystkie.
--
--  Wymaga: #20 (_is_admin, _is_teacher), #75 (_is_teacher_of).
--  Uruchom w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._is_teacher_of(uuid)') is null then
    raise exception 'Najpierw uruchom migrację #75 (teacher-scope-rls.sql) — brak funkcji _is_teacher_of.';
  end if;
end $$;

-- ── 1. KOLUMNY ───────────────────────────────────────────────────
alter table public.profiles add column if not exists games_free boolean not null default false;
alter table public.profiles add column if not exists games_free_set_by uuid;
alter table public.profiles add column if not exists games_free_set_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass and conname = 'profiles_games_free_set_by_fkey') then
    alter table public.profiles add constraint profiles_games_free_set_by_fkey
      foreign key (games_free_set_by) references auth.users(id) on delete set null;
  end if;
end $$;

-- ── 2. STRAŻNIK — kolumny zmienia tylko RPC ─────────────────────
create or replace function public._profiles_games_free_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.games_free := false;
      new.games_free_set_by := null;
      new.games_free_set_at := null;
    else
      new.games_free := old.games_free;
      new.games_free_set_by := old.games_free_set_by;
      new.games_free_set_at := old.games_free_set_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_games_free_guard on public.profiles;
create trigger profiles_games_free_guard
  before insert or update of games_free, games_free_set_by, games_free_set_at on public.profiles
  for each row execute function public._profiles_games_free_guard();

-- ── 3. RPC NAUCZYCIELA / ADMINA ─────────────────────────────────
create or replace function public.set_students_games_free(p_student_ids uuid[], p_free boolean)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_free boolean := coalesce(p_free, false);
  v_n    int;
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
       set games_free        = v_free,
           games_free_set_by = case when v_free then v_me else null end,
           games_free_set_at = case when v_free then now() else null end
      from ok
     where p.id = ok.id
       and p.games_free is distinct from v_free
    returning p.id
  )
  select count(*)::int into v_n from ok;

  return v_n;
end;
$$;

-- ── 4. UPRAWNIENIA (zasady z #84) ───────────────────────────────
revoke all on function public._profiles_games_free_guard() from public, anon, authenticated;
revoke all on function public.set_students_games_free(uuid[], boolean) from public, anon;
grant execute on function public.set_students_games_free(uuid[], boolean) to authenticated;

select 'OK — migracja #101 (🎮 gry bez blokady dla wybranych uczniów) gotowa' as status;
