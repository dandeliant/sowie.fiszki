-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🚀 TRYB NA START (nauczyciel ustawia uczniom tryb nauki)
--  Migracja #89 · idempotentna (można uruchomić ponownie)
--
--  Nauczyciel (albo admin) zaznacza uczniów w klasie i wybiera tryb nauki
--  (np. ✏️ Wpisz, 🃏 Fiszki). Raz dziennie, przy pierwszym wejściu do
--  aplikacji, uczeń trafia od razu do tego trybu w rozdziale, którego
--  ostatnio się uczył (z unit_progress — liczy aplikacja). „← Wróć” działa
--  jak zwykle. Podręcznik i rozdział nie są tu zapisywane.
--
--  1) profiles — nowe kolumny (zamiast osobnej tabeli: profil ucznia jest już
--     wczytywany przy starcie — select('*') — a lista klasy nauczyciela czyta
--     profile uczniów, więc tryb przychodzi bez dodatkowych zapytań do bazy):
--       start_mode         tryb nauki (lista w CHECK) albo null = zwykły start,
--       start_mode_set_by  kto ustawił (konto usunięte → null),
--       start_mode_set_at  kiedy.
--  2) Strażnik profiles_start_mode_guard (SECURITY INVOKER — działa tylko przy
--     zapisie wprost z aplikacji, current_user authenticated/anon): tych kolumn
--     nie zmieni zwykły UPDATE / upsert profilu (uczeń nie wyłączy sobie trybu,
--     nauczyciel nie ominie sprawdzania uprawnień) — tylko RPC poniżej.
--     Zapis profilu z aplikacji (_profilePayload w db.js) tych kolumn nie wysyła.
--  3) RPC set_students_start_mode(p_student_ids uuid[], p_mode text) → int:
--     admin albo nauczyciel; dla każdego ucznia z listy, którego wywołujący
--     „ma” — _is_teacher_of (#75: admin każdego; nauczyciel — konto utworzone
--     przez niego albo uczeń w jego klasie), tylko konta uczniów (nie admin /
--     nauczyciel / opiekun, nie siebie). p_mode null / '' = wyłącz. Max 200
--     uczniów w jednym wywołaniu. Zwraca liczbę uczniów, którym tryb jest
--     teraz ustawiony / wyłączony (także tych, którzy już go mieli — zapisywane
--     są tylko rzeczywiste zmiany). Błędy: AUTH, NOT_ALLOWED, BAD_MODE,
--     TOO_MANY.
--  Odczyt: uczeń — własny profil; nauczyciel — profile swoich uczniów
--  (RLS „profiles: teacher SELECT own students”, #75); admin — wszystkie.
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
alter table public.profiles add column if not exists start_mode text;
alter table public.profiles add column if not exists start_mode_set_by uuid;
alter table public.profiles add column if not exists start_mode_set_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass and conname = 'profiles_start_mode_set_by_fkey') then
    alter table public.profiles add constraint profiles_start_mode_set_by_fkey
      foreign key (start_mode_set_by) references auth.users(id) on delete set null;
  end if;
end $$;

-- Tryby nauki słówek (bez gier, bez Speed Quizu i 🤖 Napisz zdanie) — te same
-- nazwy co setMode('…') w app.html. Nowy tryb = nowa migracja (drop + add).
alter table public.profiles drop constraint if exists profiles_start_mode_chk;
alter table public.profiles add constraint profiles_start_mode_chk check (
  start_mode is null or start_mode in (
    'card', 'quiz', 'tf', 'match',
    'type', 'missing', 'gap', 'scramble', 'sentscr', 'typeSent',
    'dictate', 'dictSent', 'speak', 'speakSent'
  )
);

-- ── 2. STRAŻNIK — kolumny zmienia tylko RPC ─────────────────────
create or replace function public._profiles_start_mode_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.start_mode := null;
      new.start_mode_set_by := null;
      new.start_mode_set_at := null;
    else
      new.start_mode := old.start_mode;
      new.start_mode_set_by := old.start_mode_set_by;
      new.start_mode_set_at := old.start_mode_set_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_start_mode_guard on public.profiles;
create trigger profiles_start_mode_guard
  before insert or update of start_mode, start_mode_set_by, start_mode_set_at on public.profiles
  for each row execute function public._profiles_start_mode_guard();

-- ── 3. RPC NAUCZYCIELA / ADMINA ─────────────────────────────────
create or replace function public.set_students_start_mode(p_student_ids uuid[], p_mode text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_mode text := nullif(btrim(coalesce(p_mode, '')), '');
  v_n    int;
begin
  if v_me is null then
    raise exception 'AUTH' using errcode = '42501';
  end if;
  if not (public._is_admin() or public._is_teacher()) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if v_mode is not null and v_mode not in (
    'card', 'quiz', 'tf', 'match',
    'type', 'missing', 'gap', 'scramble', 'sentscr', 'typeSent',
    'dictate', 'dictSent', 'speak', 'speakSent'
  ) then
    raise exception 'BAD_MODE' using errcode = '22023';
  end if;
  if p_student_ids is null or cardinality(p_student_ids) = 0 then
    return 0;
  end if;
  if cardinality(p_student_ids) > 200 then
    raise exception 'TOO_MANY' using errcode = '22023';
  end if;

  -- „moi” uczniowie z listy; zapis tylko tam, gdzie tryb się zmienia
  -- (zmieniający dane WITH wykonuje się zawsze, także gdy wynik nie jest czytany)
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
       set start_mode        = v_mode,
           start_mode_set_by = case when v_mode is null then null else v_me end,
           start_mode_set_at = case when v_mode is null then null else now() end
      from ok
     where p.id = ok.id
       and p.start_mode is distinct from v_mode
    returning p.id
  )
  select count(*)::int into v_n from ok;

  return v_n;
end;
$$;

-- ── 4. UPRAWNIENIA (zasady z #84) ───────────────────────────────
-- funkcja wyzwalacza — nie do wywołania przez /rest/v1/rpc
revoke all on function public._profiles_start_mode_guard() from public, anon, authenticated;
-- tylko dla zalogowanych (sprawdza uprawnienia sama)
revoke all on function public.set_students_start_mode(uuid[], text) from public, anon;
grant execute on function public.set_students_start_mode(uuid[], text) to authenticated;

select 'OK — migracja #89 (🚀 tryb na start dla uczniów) gotowa' as status;
