-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — PRACE DOMOWE Z ZADANIEM (GRAMATYKA / CZYTANKA) + WYNIKI
--  Migracja #88 · idempotentna (można uruchomić ponownie)
--
--  Nauczyciel (albo admin) przydziela wybranym uczniom OPUBLIKOWANY zestaw
--  zadań gramatycznych (grammar_sets, #73) albo czytankę (reading_sets, #78)
--  z rozdziału — jako pracę domową z #69 (student_notes: osobny wiersz na
--  ucznia, termin, wiadomość). Uczeń widzi ją na stronie głównej i w okienku
--  „Nowa praca domowa”, robi ćwiczenie, a wynik zapisuje się sam.
--
--  1) student_notes — nowe kolumny:
--     task_kind  'grammar' | 'reading' (null = zwykła notatka / praca domowa),
--     task_id    id zestawu albo czytanki, task_title — tytuł w chwili zadania,
--     result     najlepszy wynik {score, total, pct, at, answers: [{i, q, ans,
--                c, ok}]} + last {score, total, pct, at}, gdy ostatnie podejście
--                było słabsze,
--     result_at  kiedy padł najlepszy wynik, attempts — liczba podejść,
--     seen_at    uczeń zobaczył okienko o nowej pracy (dotychczasowe wiersze
--                dostają created_at — bez okienka po wdrożeniu).
--  2) Strażnik _student_notes_task_guard (SECURITY INVOKER — działa tylko przy
--     zapisie wprost z aplikacji): przy dodaniu zadania sprawdza, że zestaw
--     istnieje i jest OPUBLIKOWANY (uczeń nie odczyta zestawu „czeka na
--     zatwierdzenie” — RLS #78), ustawia podręcznik / rozdział / tytuł z
--     zestawu i kind = 'homework'. Wynik, podejścia i „widziane” zmienia tylko
--     RPC ucznia; przy edycji nie da się zmienić ucznia, autora ani zadania
--     (wcześniej autor mógł przepisać notatkę na dowolne konto).
--  3) RPC ucznia (tylko własny wiersz):
--     student_task_submit(id, score, total, answers) — zapis podejścia
--       (najlepszy wynik zostaje, attempts + 1, done_at przy pierwszym),
--     student_notes_seen(ids[]) — okienko o nowej pracy zostało pokazane.
--     student_note_set_done (#69) nie oznacza ręcznie pracy z zadaniem —
--     zalicza ją dopiero zrobione ćwiczenie.
--  Wynik liczy aplikacja (to praca domowa, nie kartkówka); odpowiedzi zostają
--  zapisane, żeby nauczyciel mógł je przejrzeć. RLS z #69 bez zmian: wynik
--  widzi uczeń, autor pracy (nauczyciel) i admin.
--
--  Wymaga: #69 (student_notes), #73 (grammar_sets), #78 (reading_sets, status).
--  Uruchom w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.student_notes') is null then
    raise exception 'Najpierw uruchom migrację #69 (student-notes.sql) — brak tabeli student_notes.';
  end if;
  if to_regclass('public.grammar_sets') is null then
    raise exception 'Najpierw uruchom migrację #73 (ai-features.sql) — brak tabeli grammar_sets.';
  end if;
  if to_regclass('public.reading_sets') is null then
    raise exception 'Najpierw uruchom migrację #78 (content-review-bank.sql) — brak tabeli reading_sets.';
  end if;
end $$;

-- ── 1. KOLUMNY ───────────────────────────────────────────────────
do $$
declare v_first boolean := not exists (
  select 1 from information_schema.columns
   where table_schema = 'public' and table_name = 'student_notes' and column_name = 'seen_at');
begin
  alter table public.student_notes add column if not exists seen_at timestamptz;
  -- dotychczasowe notatki i prace domowe uczeń już zna — bez okienka po wdrożeniu
  if v_first then
    update public.student_notes set seen_at = created_at where seen_at is null;
  end if;
end $$;

alter table public.student_notes add column if not exists task_kind  text;
alter table public.student_notes add column if not exists task_id    uuid;
alter table public.student_notes add column if not exists task_title text;
alter table public.student_notes add column if not exists result     jsonb;
alter table public.student_notes add column if not exists result_at  timestamptz;
alter table public.student_notes add column if not exists attempts   int not null default 0;

alter table public.student_notes drop constraint if exists student_notes_task_check;
alter table public.student_notes add constraint student_notes_task_check check (
  (task_kind is null and task_id is null)
  or (task_kind in ('grammar', 'reading') and task_id is not null and kind = 'homework'));
alter table public.student_notes drop constraint if exists student_notes_task_title_check;
alter table public.student_notes add constraint student_notes_task_title_check
  check (task_title is null or char_length(task_title) <= 120);
alter table public.student_notes drop constraint if exists student_notes_result_check;
alter table public.student_notes add constraint student_notes_result_check
  check (result is null or (jsonb_typeof(result) = 'object' and octet_length(result::text) < 65000));
alter table public.student_notes drop constraint if exists student_notes_attempts_check;
alter table public.student_notes add constraint student_notes_attempts_check check (attempts between 0 and 9999);

-- wyniki zestawu dla nauczyciela („📊 Wyniki”)
create index if not exists student_notes_task on public.student_notes (task_id) where task_id is not null;

-- ── 2. STRAŻNIK ZAPISU WPROST Z APLIKACJI ────────────────────────
-- SECURITY INVOKER: przy zapisie z aplikacji current_user = authenticated
-- (zestaw sprawdzany z uprawnieniami nauczyciela — RLS #78); w RPC SECURITY
-- DEFINER (uczeń zapisuje wynik) i w SQL Editor strażnik nic nie zmienia.
create or replace function public._student_notes_task_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_book   text;
  v_unit   text;
  v_title  text;
  v_status text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    -- adresata, autora i zadania nie da się zmienić; wynik i „widziane” — tylko RPC ucznia
    new.student_id := old.student_id;
    new.author_id  := old.author_id;
    new.task_kind  := old.task_kind;
    new.task_id    := old.task_id;
    new.task_title := old.task_title;
    new.result     := old.result;
    new.result_at  := old.result_at;
    new.attempts   := old.attempts;
    new.seen_at    := old.seen_at;
    if old.task_kind is not null then
      new.kind     := 'homework';
      new.book_id  := old.book_id;
      new.unit_key := old.unit_key;
      new.done_at  := old.done_at;          -- zalicza zrobione ćwiczenie
    end if;
    return new;
  end if;

  -- INSERT
  new.result := null; new.result_at := null; new.attempts := 0; new.seen_at := null;
  if new.task_kind is null then
    new.task_id := null; new.task_title := null;
    return new;
  end if;
  if new.task_id is null or new.task_kind not in ('grammar', 'reading') then
    raise exception 'TASK_REQUIRED' using hint = 'Wybierz zestaw zadań albo czytankę.';
  end if;
  if new.task_kind = 'grammar' then
    select g.book_id, g.unit_key, g.topic, coalesce(to_jsonb(g) ->> 'status', 'published')
      into v_book, v_unit, v_title, v_status
      from public.grammar_sets g where g.id = new.task_id;
  else
    select r.book_id, r.unit_key, r.title, r.status
      into v_book, v_unit, v_title, v_status
      from public.reading_sets r where r.id = new.task_id;
  end if;
  if v_book is null then
    raise exception 'TASK_NOT_FOUND' using hint = 'Nie znaleziono zestawu — mógł zostać usunięty.';
  end if;
  if v_status <> 'published' then
    raise exception 'TASK_NOT_PUBLISHED' using hint = 'Zadać można tylko zestaw opublikowany (zatwierdzony).';
  end if;
  new.kind       := 'homework';
  new.book_id    := v_book;
  new.unit_key   := v_unit;
  new.task_title := left(v_title, 120);
  new.done_at    := null;
  return new;
end;
$$;

drop trigger if exists student_notes_task_guard on public.student_notes;
create trigger student_notes_task_guard before insert or update on public.student_notes
  for each row execute function public._student_notes_task_guard();

-- ── 3. UCZEŃ: WYNIK, „WIDZIANE”, „ZROBIONE” ─────────────────────
-- Zapis podejścia: najlepszy wynik (z odpowiedziami) zostaje, attempts + 1,
-- done_at przy pierwszym podejściu. Zwraca {best, attempts, done_at, result_at, result (bez odpowiedzi)}.
create or replace function public.student_task_submit(p_id uuid, p_score int, p_total int, p_answers jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  r       public.student_notes;
  v_score int;
  v_pct   int;
  v_ans   jsonb := coalesce(p_answers, '[]'::jsonb);
  v_try   jsonb;
  v_best  boolean;
begin
  if v_me is null then
    raise exception 'AUTH';
  end if;
  select * into r from public.student_notes
   where id = p_id and student_id = v_me and task_kind is not null
   for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if p_total is null or p_total < 1 or p_total > 200 then
    raise exception 'BAD_RESULT';
  end if;
  v_score := greatest(0, least(coalesce(p_score, 0), p_total));
  v_pct   := round(v_score * 100.0 / p_total)::int;
  v_ans   := case when jsonb_typeof(v_ans) <> 'array' then '[]'::jsonb
                  when jsonb_array_length(v_ans) > 200 or octet_length(v_ans::text) > 60000 then '[]'::jsonb
                  else v_ans end;
  v_try   := jsonb_build_object('score', v_score, 'total', p_total, 'pct', v_pct, 'at', now());
  v_best  := r.result is null or v_pct > coalesce((r.result ->> 'pct')::numeric, -1);
  update public.student_notes set
    attempts  = least(attempts + 1, 9999),
    done_at   = coalesce(done_at, now()),
    seen_at   = coalesce(seen_at, now()),
    result    = case when v_best then v_try || jsonb_build_object('answers', v_ans)
                     else jsonb_set(result, '{last}', v_try) end,
    result_at = case when v_best then now() else result_at end
  where id = p_id
  returning * into r;
  return jsonb_build_object('best', v_best, 'attempts', r.attempts, 'done_at', r.done_at,
                            'result_at', r.result_at, 'result', r.result - 'answers');
end;
$$;

-- Okienko „Nowa praca domowa” zostało pokazane (tylko własne wiersze, max 100).
create or replace function public.student_notes_seen(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  if auth.uid() is null or p_ids is null then
    return 0;
  end if;
  update public.student_notes set seen_at = now()
   where student_id = auth.uid() and seen_at is null
     and id = any (p_ids[1:100]);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- #69 + praca z zadaniem zalicza się sama (po zrobieniu ćwiczenia).
create or replace function public.student_note_set_done(p_id uuid, p_done boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_at   timestamptz;
  v_task text;
begin
  select task_kind into v_task from public.student_notes where id = p_id and student_id = auth.uid();
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_task is not null then
    raise exception 'To zadanie zalicza się samo, gdy zrobisz ćwiczenie.';
  end if;
  update public.student_notes
     set done_at = case when p_done then now() else null end
   where id = p_id and student_id = auth.uid()
  returning done_at into v_at;
  return v_at;
end;
$$;

-- ── 4. UPRAWNIENIA (zasady z #84) ───────────────────────────────
do $$
declare f text;
begin
  -- funkcja wyzwalacza — nie do wywołania przez /rest/v1/rpc
  execute 'revoke all on function public._student_notes_task_guard() from public, anon, authenticated';
  -- tylko dla zalogowanych
  foreach f in array array[
    'public.student_task_submit(uuid,int,int,jsonb)', 'public.student_notes_seen(uuid[])',
    'public.student_note_set_done(uuid,boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select 'OK — migracja #88 (prace domowe z zadaniem i wyniki) gotowa' as status;
