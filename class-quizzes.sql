-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — KARTKÓWKA ONLINE Z AUTOMATYCZNYM SPRAWDZANIEM
--  Migracja #64 · idempotentna
--
--  Nauczyciel ustawia kartkówkę dla swojej klasy (słówka, kierunek, czas,
--  godzina startu). Uczniowie wpisują odpowiedzi (jak w trybie „Wpisz").
--  Klucz odpowiedzi NIGDY nie trafia do ucznia — pytania uczeń dostaje przez
--  RPC bez odpowiedzi, a ocenianie odbywa się w bazie (_quiz_regrade).
--  Skala ocen (procenty):
--    1 niedostateczny 0–29 · 2 dopuszczający 30–49 · 3 dostateczny 50–74
--    4 dobry 75–89 · 5 bardzo dobry 90–97 · 6 celujący 98–100
--  Wykrywanie wyjść z kartkówki: licznik przełączeń kart + czas poza kartą.
--
--  Wymaga: #20 (_is_admin/_is_teacher), tabel classes / class_members.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TABELE ────────────────────────────────────────────────────
create table if not exists public.quizzes (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id        uuid not null references public.classes(id) on delete cascade,
  title           text not null,
  book_id         text,
  unit_keys       text[],
  direction       text not null default 'pe' check (direction in ('pe','ep','mix')),
  -- [{p: pytanie, a: odpowiedź (do wyświetlenia), alts: [warianty], d: 'pe'|'ep', wpl, wen}]
  questions       jsonb not null,
  duration_min    int  not null check (duration_min between 1 and 180),
  starts_at       timestamptz not null,
  extra_min       int  not null default 0,
  closed_at       timestamptz,
  show_results    boolean not null default true,
  half_diacritics boolean not null default true,
  shuffle         boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists quizzes_class_start on public.quizzes (class_id, starts_at desc);
create index if not exists quizzes_creator     on public.quizzes (created_by, starts_at desc);

create table if not exists public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  started_at     timestamptz not null default now(),
  last_saved_at  timestamptz,
  submitted_at   timestamptz,
  auto_submitted boolean not null default false,
  answers        jsonb not null default '{}'::jsonb,   -- {"0":"cat","1":"..."}
  overrides      jsonb not null default '{}'::jsonb,   -- {"3":1} — punkty uznane ręcznie przez nauczyciela
  result         jsonb,                                -- [{i,a,pts,ov}]
  score          numeric(6,1),
  max_score      int,
  percent        numeric(5,1),
  grade          int,
  tab_switches   int    not null default 0,
  away_ms        bigint not null default 0,
  unique (quiz_id, user_id)
);
create index if not exists quiz_attempts_quiz on public.quiz_attempts (quiz_id);

alter table public.quizzes       enable row level security;
alter table public.quiz_attempts enable row level security;

-- Nauczyciel (twórca) i admin: pełny dostęp do swoich kartkówek. Uczeń: brak
-- bezpośredniego dostępu (pytania bez kluczy dostaje przez quiz_start).
drop policy if exists "quizzes: owner read"   on public.quizzes;
drop policy if exists "quizzes: owner insert" on public.quizzes;
drop policy if exists "quizzes: owner update" on public.quizzes;
drop policy if exists "quizzes: owner delete" on public.quizzes;
create policy "quizzes: owner read"   on public.quizzes for select using (created_by = auth.uid() or public._is_admin());
create policy "quizzes: owner insert" on public.quizzes for insert with check (
  created_by = auth.uid()
  and (public._is_admin() or exists (select 1 from public.classes c where c.id = class_id and c.admin_id = auth.uid()))
);
create policy "quizzes: owner update" on public.quizzes for update using (created_by = auth.uid() or public._is_admin());
create policy "quizzes: owner delete" on public.quizzes for delete using (created_by = auth.uid() or public._is_admin());

drop policy if exists "quiz_attempts: read" on public.quiz_attempts;
create policy "quiz_attempts: read" on public.quiz_attempts for select using (
  user_id = auth.uid() or public._is_admin()
  or exists (select 1 from public.quizzes q where q.id = quiz_id and q.created_by = auth.uid())
);
-- Brak polityk zapisu w quiz_attempts — tylko przez funkcje poniżej.

grant select, insert, update, delete on public.quizzes to authenticated;
grant select on public.quiz_attempts to authenticated;

-- ── 2. FUNKCJE POMOCNICZE ────────────────────────────────────────
-- Normalizacja jak w trybie „Wpisz" (app.html norm()): małe litery, bez interpunkcji.
create or replace function public._quiz_norm(p text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(
           translate(
             regexp_replace(lower(coalesce(p, '')), '[/–—-]+', ' ', 'g'),
             '.,!?…''"‘’“”„;:()[]{}*_\', ''),
         '\s+', ' ', 'g'));
$$;

-- Bez polskich znaków (do zasady „brak ogonków = ½ punktu").
create or replace function public._quiz_fold(p text)
returns text
language sql
immutable
as $$ select translate(coalesce(p, ''), 'ąćęłńóśźż', 'acelnoszz') $$;

create or replace function public._quiz_grade_from_pct(p numeric)
returns int
language sql
immutable
as $$
  select case when p >= 98 then 6 when p >= 90 then 5 when p >= 75 then 4
              when p >= 50 then 3 when p >= 30 then 2 else 1 end
$$;

-- Termin oddania: start + czas + przedłużenie, albo wcześniejsze zakończenie.
create or replace function public._quiz_deadline(p_quiz uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select least(coalesce(q.closed_at, 'infinity'::timestamptz),
               q.starts_at + make_interval(mins => q.duration_min + q.extra_min))
    from public.quizzes q where q.id = p_quiz
$$;

-- Przeliczenie wyniku podejścia (wołane przy oddaniu, auto-oddaniu i ręcznym uznaniu).
create or replace function public._quiz_regrade(p_attempt uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.quiz_attempts%rowtype;
  q public.quizzes%rowtype;
  i int; n int; ans text; na text; pts numeric; total numeric := 0;
  res jsonb := '[]'::jsonb; alts jsonb; is_ov boolean;
begin
  select * into a from public.quiz_attempts where id = p_attempt;
  if not found then return; end if;
  select * into q from public.quizzes where id = a.quiz_id;
  n := jsonb_array_length(q.questions);
  for i in 0 .. n - 1 loop
    ans  := coalesce(a.answers ->> i::text, '');
    na   := public._quiz_norm(ans);
    alts := coalesce(q.questions -> i -> 'alts', '[]'::jsonb);
    if na <> '' and exists (select 1 from jsonb_array_elements_text(alts) x where public._quiz_norm(x) = na) then
      pts := 1;
    elsif q.half_diacritics and na <> ''
          and exists (select 1 from jsonb_array_elements_text(alts) x
                       where public._quiz_fold(public._quiz_norm(x)) = public._quiz_fold(na)) then
      pts := 0.5;
    else
      pts := 0;
    end if;
    is_ov := a.overrides ? i::text;
    if is_ov then pts := greatest(0, least(1, (a.overrides ->> i::text)::numeric)); end if;
    res   := res || jsonb_build_object('i', i, 'a', ans, 'pts', pts, 'ov', is_ov);
    total := total + pts;
  end loop;
  update public.quiz_attempts
     set result = res, score = total, max_score = n,
         percent = round(total * 100.0 / greatest(n, 1), 1),
         grade = public._quiz_grade_from_pct(total * 100.0 / greatest(n, 1))
   where id = p_attempt;
end;
$$;
revoke all on function public._quiz_regrade(uuid) from public, anon, authenticated;

-- Auto-oddanie podejść, którym minął czas (minuta zapasu na słabe łącze).
create or replace function public._quiz_finalize_expired(p_quiz uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_dl timestamptz := public._quiz_deadline(p_quiz); r record;
begin
  if v_dl is null or now() <= v_dl + interval '60 seconds' then return; end if;
  for r in select id from public.quiz_attempts where quiz_id = p_quiz and submitted_at is null loop
    update public.quiz_attempts set submitted_at = v_dl, auto_submitted = true where id = r.id;
    perform public._quiz_regrade(r.id);
  end loop;
end;
$$;
revoke all on function public._quiz_finalize_expired(uuid) from public, anon, authenticated;

create or replace function public._quiz_is_owner(p_quiz uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._is_admin() or exists (select 1 from public.quizzes where id = p_quiz and created_by = auth.uid())
$$;

-- ── 3. RPC UCZNIA ────────────────────────────────────────────────
-- Moje kartkówki (z ostatnich 7 dni i nadchodzące).
create or replace function public.quiz_my_list()
returns table (id uuid, title text, starts_at timestamptz, deadline timestamptz, duration_min int,
               state text, n_questions int, percent numeric, grade int, server_now timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.title, q.starts_at, public._quiz_deadline(q.id), q.duration_min + q.extra_min,
         case
           when a.submitted_at is not null then 'submitted'
           when now() < q.starts_at then 'upcoming'
           when now() <= public._quiz_deadline(q.id) then 'active'
           else 'closed'
         end,
         jsonb_array_length(q.questions),
         case when q.show_results and a.submitted_at is not null then a.percent end,
         case when q.show_results and a.submitted_at is not null then a.grade end,
         now()
    from public.quizzes q
    join public.class_members m on m.class_id = q.class_id and m.user_id = auth.uid()
    left join public.quiz_attempts a on a.quiz_id = q.id and a.user_id = auth.uid()
   where q.starts_at > now() - interval '7 days'
   order by q.starts_at desc
   limit 20;
$$;

-- Rozpoczęcie / wznowienie kartkówki. Zwraca pytania BEZ odpowiedzi.
create or replace function public.quiz_start(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quizzes%rowtype;
  a public.quiz_attempts%rowtype;
  v_dl timestamptz;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  select * into q from public.quizzes where id = p_id;
  if not found or not exists (select 1 from public.class_members where class_id = q.class_id and user_id = auth.uid()) then
    raise exception 'Ta kartkówka nie jest przeznaczona dla Ciebie.';
  end if;
  v_dl := public._quiz_deadline(p_id);
  perform public._quiz_finalize_expired(p_id);
  select * into a from public.quiz_attempts where quiz_id = p_id and user_id = auth.uid();
  if found and a.submitted_at is not null then
    return jsonb_build_object('state', 'submitted', 'title', q.title,
      'percent', case when q.show_results then a.percent end,
      'grade',   case when q.show_results then a.grade end,
      'score',   case when q.show_results then a.score end,
      'max',     case when q.show_results then a.max_score end);
  end if;
  if now() < q.starts_at then
    return jsonb_build_object('state', 'waiting', 'title', q.title, 'starts_at', q.starts_at,
                              'server_now', now(), 'duration_min', q.duration_min + q.extra_min,
                              'n', jsonb_array_length(q.questions));
  end if;
  if now() > v_dl then
    return jsonb_build_object('state', 'closed', 'title', q.title);
  end if;
  if not found then
    insert into public.quiz_attempts (quiz_id, user_id) values (p_id, auth.uid())
    on conflict (quiz_id, user_id) do nothing;
    select * into a from public.quiz_attempts where quiz_id = p_id and user_id = auth.uid();
  end if;
  return jsonb_build_object(
    'state', 'active', 'id', q.id, 'title', q.title, 'deadline', v_dl, 'server_now', now(),
    'shuffle', q.shuffle, 'answers', a.answers, 'tab_switches', a.tab_switches, 'away_ms', a.away_ms,
    'questions', (select jsonb_agg(jsonb_build_object('i', t.idx - 1, 'p', t.e -> 'p', 'd', t.e -> 'd') order by t.idx)
                    from jsonb_array_elements(q.questions) with ordinality as t(e, idx))
  );
end;
$$;

-- Autozapis odpowiedzi + licznik wyjść z kartkówki.
create or replace function public.quiz_save(p_id uuid, p_answers jsonb, p_tabs int, p_away bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_dl timestamptz := public._quiz_deadline(p_id);
begin
  if v_dl is not null and now() <= v_dl + interval '60 seconds' then
    update public.quiz_attempts
       set answers = coalesce(p_answers, answers),
           tab_switches = greatest(tab_switches, coalesce(p_tabs, 0)),
           away_ms = greatest(away_ms, coalesce(p_away, 0)),
           last_saved_at = now()
     where quiz_id = p_id and user_id = auth.uid() and submitted_at is null;
  end if;
  return jsonb_build_object('deadline', v_dl, 'server_now', now());
end;
$$;

-- Oddanie kartkówki. Wynik zwracany tylko, gdy nauczyciel na to pozwolił.
create or replace function public.quiz_submit(p_id uuid, p_answers jsonb, p_tabs int, p_away bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dl timestamptz := public._quiz_deadline(p_id);
  a public.quiz_attempts%rowtype;
  q public.quizzes%rowtype;
begin
  select * into a from public.quiz_attempts where quiz_id = p_id and user_id = auth.uid();
  if not found then raise exception 'Nie rozpocząłeś / nie rozpoczęłaś tej kartkówki.'; end if;
  select * into q from public.quizzes where id = p_id;
  if a.submitted_at is null then
    if now() <= v_dl + interval '60 seconds' then
      update public.quiz_attempts
         set answers = coalesce(p_answers, answers),
             tab_switches = greatest(tab_switches, coalesce(p_tabs, 0)),
             away_ms = greatest(away_ms, coalesce(p_away, 0)),
             last_saved_at = now()
       where id = a.id;
    end if;
    update public.quiz_attempts
       set submitted_at = least(now(), v_dl), auto_submitted = (now() > v_dl)
     where id = a.id;
    perform public._quiz_regrade(a.id);
    select * into a from public.quiz_attempts where id = a.id;
  end if;
  return jsonb_build_object('state', 'submitted', 'title', q.title,
    'percent', case when q.show_results then a.percent end,
    'grade',   case when q.show_results then a.grade end,
    'score',   case when q.show_results then a.score end,
    'max',     case when q.show_results then a.max_score end);
end;
$$;

-- ── 4. RPC NAUCZYCIELA ───────────────────────────────────────────
-- Lista moich kartkówek z licznikami.
create or replace function public.quiz_teacher_list()
returns table (id uuid, title text, class_id uuid, class_name text, starts_at timestamptz, deadline timestamptz,
               duration_min int, n_questions int, n_members int, n_submitted int, n_started int,
               avg_percent numeric, server_now timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.title, q.class_id, c.name, q.starts_at, public._quiz_deadline(q.id),
         q.duration_min + q.extra_min, jsonb_array_length(q.questions),
         (select count(*) from public.class_members m join public.profiles p on p.id = m.user_id
           where m.class_id = q.class_id and not coalesce(p.is_teacher, false) and not coalesce(p.is_admin, false))::int,
         (select count(*) from public.quiz_attempts a where a.quiz_id = q.id and a.submitted_at is not null)::int,
         (select count(*) from public.quiz_attempts a where a.quiz_id = q.id)::int,
         (select round(avg(a.percent), 1) from public.quiz_attempts a where a.quiz_id = q.id and a.submitted_at is not null),
         now()
    from public.quizzes q
    left join public.classes c on c.id = q.class_id
   where q.created_by = auth.uid() or public._is_admin()
   order by q.starts_at desc
   limit 200;
$$;

-- Wyniki kartkówki: wszyscy uczniowie klasy (także ci, którzy nie zaczęli).
create or replace function public.quiz_results(p_id uuid)
returns table (user_id uuid, username text, attempt_id uuid, started_at timestamptz, last_saved_at timestamptz,
               submitted_at timestamptz, auto_submitted boolean, answers jsonb, result jsonb,
               score numeric, max_score int, percent numeric, grade int, tab_switches int, away_ms bigint,
               deadline timestamptz, server_now timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare v_class uuid;
begin
  if not public._quiz_is_owner(p_id) then raise exception 'Brak dostępu do wyników tej kartkówki.'; end if;
  perform public._quiz_finalize_expired(p_id);
  select class_id into v_class from public.quizzes where quizzes.id = p_id;
  return query
    select p.id, p.username, a.id, a.started_at, a.last_saved_at, a.submitted_at, coalesce(a.auto_submitted, false),
           a.answers, a.result, a.score, a.max_score, a.percent, a.grade,
           coalesce(a.tab_switches, 0), coalesce(a.away_ms, 0),
           public._quiz_deadline(p_id), now()
      from (select m.user_id as uid from public.class_members m where m.class_id = v_class
            union
            select qa.user_id from public.quiz_attempts qa where qa.quiz_id = p_id) u
      join public.profiles p on p.id = u.uid
      left join public.quiz_attempts a on a.quiz_id = p_id and a.user_id = u.uid
     where not coalesce(p.is_teacher, false) and not coalesce(p.is_admin, false)
     order by p.username;
end;
$$;

-- Ręczne uznanie / cofnięcie punktu (np. literówka, synonim). p_pts NULL = cofnij.
create or replace function public.quiz_override(p_attempt uuid, p_index int, p_pts numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_quiz uuid;
begin
  select quiz_id into v_quiz from public.quiz_attempts where id = p_attempt;
  if v_quiz is null or not public._quiz_is_owner(v_quiz) then raise exception 'Brak uprawnień.'; end if;
  if p_pts is null then
    update public.quiz_attempts set overrides = overrides - p_index::text where id = p_attempt;
  else
    update public.quiz_attempts
       set overrides = overrides || jsonb_build_object(p_index::text, greatest(0, least(1, p_pts)))
     where id = p_attempt;
  end if;
  perform public._quiz_regrade(p_attempt);
end;
$$;

-- Zakończ teraz / przedłuż o N minut.
create or replace function public.quiz_close(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._quiz_is_owner(p_id) then raise exception 'Brak uprawnień.'; end if;
  update public.quizzes set closed_at = now() where id = p_id;
end;
$$;

create or replace function public.quiz_extend(p_id uuid, p_min int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._quiz_is_owner(p_id) then raise exception 'Brak uprawnień.'; end if;
  update public.quizzes
     set extra_min = extra_min + greatest(1, least(60, p_min)), closed_at = null
   where id = p_id;
end;
$$;

grant execute on function public.quiz_my_list()                          to authenticated;
grant execute on function public.quiz_start(uuid)                        to authenticated;
grant execute on function public.quiz_save(uuid, jsonb, int, bigint)     to authenticated;
grant execute on function public.quiz_submit(uuid, jsonb, int, bigint)   to authenticated;
grant execute on function public.quiz_teacher_list()                     to authenticated;
grant execute on function public.quiz_results(uuid)                      to authenticated;
grant execute on function public.quiz_override(uuid, int, numeric)       to authenticated;
grant execute on function public.quiz_close(uuid)                        to authenticated;
grant execute on function public.quiz_extend(uuid, int)                  to authenticated;

select 'OK — kartkówki online gotowe' as status;
