-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — WIADOMOŚCI NAUCZYCIELA + ZAPROSZENIA DO GRY NA ŻYWO
--  Migracja #87 · idempotentna (można uruchomić ponownie)
--
--  1) teacher_messages — krótka wiadomość (1–500 znaków) od nauczyciela do
--     konkretnego ucznia, wyświetlana uczniowi w okienku. Wysłać może TYLKO
--     admin albo nauczyciel tego ucznia (_is_teacher_of z #75) — sprawdza
--     RPC teacher_message_send. Odczyt: wyłącznie nadawca i odbiorca (RLS).
--     Zapis tylko przez RPC. Limity: 30 wiadomości / 10 min od nadawcy,
--     5 / min do jednego ucznia. Wiadomości starsze niż 30 dni są kasowane
--     przy wysyłaniu kolejnych (mało danych osobowych w bazie).
--     Uczeń: teacher_message_mark(id, 'shown' | 'read' | 'dismiss').
--     Nauczyciel: teacher_messages_sent(uczeń) — status (wyświetlona /
--     przeczytana / zamknięta).
--  2) Rywalizacja online (duels z #61 / #63 / #85) — wspólny widok:
--     • host_answers / guest_answers — historia odpowiedzi {i, o, ok, ms, pts}
--       (o = wybrana odpowiedź, -1 = czas minął); duel_answer2 sprawdza
--       poprawność w bazie i zwraca klucz dopiero po odpowiedzi,
--     • duel_state(id, full) — stan dla widoku podzielonego: obaj gracze
--       (nazwa, zdjęcie, wynik, postęp, odpowiedzi, sygnał obecności).
--       Wybór przeciwnika w pytaniu, na które jeszcze nie odpowiedziałem,
--       jest ukryty (żeby nie podpowiadał),
--     • host_seen_at / guest_seen_at — sygnał obecności (zapis co ≥ 4 s
--       w trakcie odpytywania; także w starym duel_get) → „rozłączył(a) się”,
--     • host_left_at / guest_left_at + duel_leave — wyjście jednej osoby nie
--       przerywa gry drugiej; gra kończy się, gdy każdy skończył albo wyszedł,
--       albo gdy ja skończyłem, a przeciwnik milczy ≥ 20 s,
--     • zaproszenie wygasa także wtedy, gdy zapraszający zamknął aplikację
--       (brak sygnału > 90 s),
--     • duel_create: nauczyciel / admin może zaprosić swojego ucznia
--       (_is_teacher_of) — np. z okna „🟢 Teraz na Sowich Fiszkach”;
--       pojedynki starsze niż 30 dni są kasowane przy tworzeniu nowych.
--  3) live_inbox() — jedno zapytanie: wiadomości do wyświetlenia + aktualne
--     zaproszenia do gry + trwająca gra, z której ekranu wyszedłem
--     („↩️ Wróć do gry”) — zapas, gdy Realtime nie działa.
--  4) Realtime: teacher_messages i duels w publikacji supabase_realtime —
--     aplikacja nasłuchuje tylko INSERT z filtrem recipient_id / guest_id =
--     zalogowany (RLS sprawdza uprawnienia), więc wiadomość i zaproszenie
--     docierają od razu, bez częstego odpytywania bazy.
--
--  Wymaga: #20 (_is_admin), #61 (duels), #75 (_is_teacher_of),
--          #85 (_duel_can_pair). Opcjonalnie #62 (zdjęcia profilowe).
--  Uruchom w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public._is_teacher_of(uuid)') is null then
    raise exception 'Najpierw uruchom migrację #75 (teacher-scope-rls.sql) — brak funkcji _is_teacher_of.';
  end if;
  if to_regclass('public.duels') is null then
    raise exception 'Najpierw uruchom migrację #61 (student-duels.sql) — brak tabeli duels.';
  end if;
  if to_regprocedure('public._duel_can_pair(uuid, uuid)') is null then
    raise exception 'Najpierw uruchom migracje #63 i #85 (duel-invite-teacher.sql, friends-and-rivalry.sql) — brak funkcji _duel_can_pair.';
  end if;
end $$;

-- ── 1. WIADOMOŚCI NAUCZYCIELA ────────────────────────────────────
create table if not exists public.teacher_messages (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  sender_name  text not null default '' check (char_length(sender_name) <= 40),
  body         text not null check (char_length(body) between 1 and 500),
  created_at   timestamptz not null default now(),
  shown_at     timestamptz,
  read_at      timestamptz,
  dismissed_at timestamptz
);
create index if not exists teacher_messages_recipient on public.teacher_messages (recipient_id, created_at desc);
create index if not exists teacher_messages_sender    on public.teacher_messages (sender_id, created_at desc);
create index if not exists teacher_messages_created   on public.teacher_messages (created_at);

alter table public.teacher_messages enable row level security;
drop policy if exists "teacher_messages: own read" on public.teacher_messages;
create policy "teacher_messages: own read" on public.teacher_messages
  for select using (auth.uid() = recipient_id or auth.uid() = sender_id);
-- Brak polityk INSERT/UPDATE/DELETE — zmiany tylko przez funkcje poniżej.
-- SELECT dla zalogowanych jest potrzebny do Realtime (RLS wybiera wiersze).
revoke all on public.teacher_messages from anon, authenticated;
grant select on public.teacher_messages to authenticated;

-- Wysłanie wiadomości do ucznia (admin albo nauczyciel tego ucznia).
create or replace function public.teacher_message_send(p_to uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_body text;
  v_name text;
  v_id   uuid;
begin
  if v_me is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_to is null or p_to = v_me then raise exception 'Wybierz ucznia, do którego chcesz napisać.'; end if;
  if not public._is_teacher_of(p_to) then
    raise exception 'Wiadomość możesz wysłać tylko swojemu uczniowi.';
  end if;
  -- bez znaków sterujących (poza nową linią), bez spacji na brzegach
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '[\x01-\x09\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
  if char_length(v_body) < 1 then raise exception 'Wpisz treść wiadomości.'; end if;
  if char_length(v_body) > 500 then raise exception 'Wiadomość może mieć najwyżej 500 znaków.'; end if;
  if (select count(*) from public.teacher_messages
       where sender_id = v_me and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Wysłano już dużo wiadomości — odczekaj kilka minut.';
  end if;
  if (select count(*) from public.teacher_messages
       where sender_id = v_me and recipient_id = p_to and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Do tego ucznia wysłano już kilka wiadomości — odczekaj minutę.';
  end if;
  select left(coalesce(nullif(btrim(to_jsonb(p)->>'nickname'), ''), p.username, 'Nauczyciel'), 40)
    into v_name from public.profiles p where p.id = v_me;
  -- sprzątanie: wiadomości starsze niż 30 dni (indeks po created_at)
  delete from public.teacher_messages where created_at < now() - interval '30 days';
  insert into public.teacher_messages (sender_id, recipient_id, sender_name, body)
  values (v_me, p_to, coalesce(v_name, 'Nauczyciel'), v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- Wiadomości czekające na wyświetlenie (nieprzeczytane i niezamknięte).
create or replace function public.teacher_messages_pending()
returns table (id uuid, sender_name text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.sender_name, m.body, m.created_at
    from public.teacher_messages m
   where m.recipient_id = auth.uid()
     and m.read_at is null and m.dismissed_at is null
     and m.created_at > now() - interval '30 days'
   order by m.created_at
   limit 20;
$$;

-- Uczeń: 'shown' (okienko się pokazało), 'read' (✓ Przeczytane), 'dismiss' (zamknięte).
create or replace function public.teacher_message_mark(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_action = 'shown' then
    update public.teacher_messages set shown_at = coalesce(shown_at, now())
     where id = p_id and recipient_id = auth.uid() and shown_at is null;
  elsif p_action = 'read' then
    update public.teacher_messages set read_at = coalesce(read_at, now()), shown_at = coalesce(shown_at, now())
     where id = p_id and recipient_id = auth.uid();
  elsif p_action = 'dismiss' then
    update public.teacher_messages set dismissed_at = coalesce(dismissed_at, now()), shown_at = coalesce(shown_at, now())
     where id = p_id and recipient_id = auth.uid();
  else
    raise exception 'Nieznana akcja.';
  end if;
end;
$$;

-- Nauczyciel: ostatnie wiadomości wysłane do ucznia (albo wszystkie) ze statusem.
create or replace function public.teacher_messages_sent(p_to uuid default null, p_limit int default 20)
returns table (id uuid, recipient_id uuid, body text, created_at timestamptz,
               shown_at timestamptz, read_at timestamptz, dismissed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.recipient_id, m.body, m.created_at, m.shown_at, m.read_at, m.dismissed_at
    from public.teacher_messages m
   where m.sender_id = auth.uid()
     and (p_to is null or m.recipient_id = p_to)
   order by m.created_at desc
   limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

-- ── 2. RYWALIZACJA ONLINE — WSPÓLNY WIDOK ────────────────────────
alter table public.duels add column if not exists host_answers  jsonb not null default '[]'::jsonb;
alter table public.duels add column if not exists guest_answers jsonb not null default '[]'::jsonb;
alter table public.duels add column if not exists host_seen_at  timestamptz;
alter table public.duels add column if not exists guest_seen_at timestamptz;
alter table public.duels add column if not exists host_left_at  timestamptz;
alter table public.duels add column if not exists guest_left_at timestamptz;
create index if not exists duels_created on public.duels (created_at);

-- Koniec gry, gdy każdy gracz skończył albo wyszedł (obaj wyszli = przerwana).
create or replace function public._duel_maybe_finish(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.duels d
     set status = case when d.host_left_at is not null and d.guest_left_at is not null
                            and d.host_done < jsonb_array_length(d.questions)
                            and d.guest_done < jsonb_array_length(d.questions)
                       then 'cancelled' else 'finished' end,
         finished_at = now()
   where d.id = p_id and d.status = 'playing'
     and (d.host_done  >= jsonb_array_length(d.questions) or d.host_left_at  is not null)
     and (d.guest_done >= jsonb_array_length(d.questions) or d.guest_left_at is not null);
end;
$$;

-- Zapis odpowiedzi na pytanie p_index. p_choice = indeks odpowiedzi (-1 = czas minął)
-- — wtedy poprawność sprawdza baza; p_choice NULL = stara wersja aplikacji (p_correct).
create or replace function public._duel_record(p_id uuid, p_index int, p_choice int, p_correct boolean, p_ms int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels%rowtype;
  v_role int; v_done int; v_n int; v_ms int; v_pts int; v_lim int; v_c int; v_ok boolean;
  v_entry jsonb;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or auth.uid() is null or auth.uid() not in (d.host_id, d.guest_id) then
    raise exception 'Brak dostępu.';
  end if;
  v_n := jsonb_array_length(d.questions);
  if p_index is not null and p_index >= 0 and p_index < v_n
     and jsonb_typeof(d.questions -> p_index -> 'c') = 'number' then
    v_c := (d.questions -> p_index ->> 'c')::int;
  end if;
  if d.status <> 'playing' or now() < d.started_at then
    return jsonb_build_object('accepted', false, 'c', v_c);
  end if;
  v_role := case when auth.uid() = d.host_id then 1 else 2 end;
  if (v_role = 1 and d.host_left_at is not null) or (v_role = 2 and d.guest_left_at is not null) then
    return jsonb_build_object('accepted', false, 'c', v_c);
  end if;
  v_done := case when v_role = 1 then d.host_done else d.guest_done end;
  if p_index is null or p_index <> v_done or p_index >= v_n then      -- tylko kolejne, bez powtórek
    return jsonb_build_object('accepted', false, 'c', v_c);
  end if;
  v_ok := case when p_choice is not null then (v_c is not null and p_choice = v_c)
               else coalesce(p_correct, false) end;
  v_lim := public._duel_q_seconds() * 1000;
  v_ms  := greatest(0, least(v_lim, coalesce(p_ms, v_lim)));
  v_pts := case when v_ok then 100 + ((v_lim - v_ms) * 50 / v_lim) else 0 end;
  v_entry := jsonb_build_object('i', p_index,
                                'o', case when p_choice between -1 and 9 then p_choice end,
                                'ok', v_ok, 'ms', v_ms, 'pts', v_pts);
  if v_role = 1 then
    update public.duels
       set host_done = host_done + 1, host_score = host_score + v_pts,
           host_correct = host_correct + (case when v_ok then 1 else 0 end),
           host_answers = coalesce(host_answers, '[]'::jsonb) || jsonb_build_array(v_entry),
           host_seen_at = now()
     where id = p_id;
  else
    update public.duels
       set guest_done = guest_done + 1, guest_score = guest_score + v_pts,
           guest_correct = guest_correct + (case when v_ok then 1 else 0 end),
           guest_answers = coalesce(guest_answers, '[]'::jsonb) || jsonb_build_array(v_entry),
           guest_seen_at = now()
     where id = p_id;
  end if;
  perform public._duel_maybe_finish(p_id);
  return jsonb_build_object('accepted', true, 'ok', v_ok, 'c', v_c, 'pts', v_pts);
end;
$$;

-- Stara odpowiedź (aplikacja przed #87): poprawność podaje klient.
create or replace function public.duel_answer(p_id uuid, p_index int, p_correct boolean, p_ms int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._duel_record(p_id, p_index, null, p_correct, p_ms);
end;
$$;

-- Nowa odpowiedź: wybrana opcja (−1 = czas minął); zwraca {accepted, ok, c, pts}.
create or replace function public.duel_answer2(p_id uuid, p_index int, p_choice int, p_ms int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public._duel_record(p_id, p_index, coalesce(p_choice, -1), null, p_ms);
end;
$$;

-- Wyjście z pojedynku: zaproszenie → anulowane / odrzucone; odliczanie → gra
-- przerwana; w trakcie → tylko ja wychodzę, druga osoba może dokończyć.
create or replace function public.duel_leave(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare d public.duels%rowtype; v_role int;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or auth.uid() is null or auth.uid() not in (d.host_id, d.guest_id) then
    raise exception 'Brak dostępu.';
  end if;
  v_role := case when auth.uid() = d.host_id then 1 else 2 end;
  if d.status = 'invited' then
    update public.duels
       set status = case when v_role = 1 then 'cancelled' else 'declined' end, finished_at = now()
     where id = p_id;
  elsif d.status = 'playing' then
    if now() < d.started_at then
      update public.duels
         set status = 'cancelled', finished_at = now(),
             host_left_at  = case when v_role = 1 then now() else host_left_at end,
             guest_left_at = case when v_role = 2 then now() else guest_left_at end
       where id = p_id;
    else
      update public.duels
         set host_left_at  = case when v_role = 1 then coalesce(host_left_at, now()) else host_left_at end,
             guest_left_at = case when v_role = 2 then coalesce(guest_left_at, now()) else guest_left_at end
       where id = p_id;
      perform public._duel_maybe_finish(p_id);
    end if;
  end if;
  return (select status from public.duels where id = p_id);
end;
$$;

-- Domknięcia przeterminowanych + sygnał obecności wołającego (zapis co ≥ 4 s).
create or replace function public._duel_housekeep(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels%rowtype; v_role int; v_n int;
  v_my_done int; v_my_left timestamptz; v_op_done int; v_op_left timestamptz; v_op_seen timestamptz;
begin
  select * into d from public.duels where id = p_id;
  if not found or auth.uid() not in (d.host_id, d.guest_id) then return; end if;
  v_role := case when auth.uid() = d.host_id then 1 else 2 end;
  v_n := jsonb_array_length(d.questions);
  if d.status = 'invited' and (d.created_at < now() - interval '15 minutes'
       or (d.host_seen_at is not null and d.host_seen_at < now() - interval '90 seconds')) then
    update public.duels set status = 'expired', finished_at = now() where id = p_id and status = 'invited';
    return;
  end if;
  if d.status = 'playing' and now() > d.started_at + make_interval(secs => v_n * public._duel_q_seconds() + 30) then
    update public.duels set status = 'finished', finished_at = now() where id = p_id and status = 'playing';
    return;
  end if;
  if d.status = 'playing' and now() >= d.started_at then
    v_my_done  := case when v_role = 1 then d.host_done    else d.guest_done    end;
    v_my_left  := case when v_role = 1 then d.host_left_at else d.guest_left_at end;
    v_op_done  := case when v_role = 1 then d.guest_done    else d.host_done    end;
    v_op_left  := case when v_role = 1 then d.guest_left_at else d.host_left_at end;
    v_op_seen  := case when v_role = 1 then d.guest_seen_at else d.host_seen_at end;
    -- ja skończyłem, a przeciwnik (niedokończony) milczy ≥ 20 s → koniec gry
    if v_my_done >= v_n and v_my_left is null and v_op_done < v_n and v_op_left is null
       and coalesce(v_op_seen, d.started_at) < now() - interval '20 seconds' then
      update public.duels
         set host_left_at  = case when v_role = 2 then coalesce(host_seen_at, now())  else host_left_at end,
             guest_left_at = case when v_role = 1 then coalesce(guest_seen_at, now()) else guest_left_at end
       where id = p_id;
      perform public._duel_maybe_finish(p_id);
      return;
    end if;
  end if;
  if d.status in ('invited', 'playing') then
    if v_role = 1 and (d.host_seen_at is null or d.host_seen_at < now() - interval '4 seconds') then
      update public.duels set host_seen_at = now() where id = p_id;
    elsif v_role = 2 and (d.guest_seen_at is null or d.guest_seen_at < now() - interval '4 seconds') then
      update public.duels set guest_seen_at = now() where id = p_id;
    end if;
  end if;
end;
$$;

-- Stan dla widoku podzielonego. p_full = false → bez listy pytań (lżej przy odpytywaniu).
create or replace function public.duel_state(p_id uuid, p_full boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.duels%rowtype; v_role int; v_n int; v_my_done int; v_reveal boolean;
  v_host jsonb; v_guest jsonb;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  perform public._duel_housekeep(p_id);
  select * into d from public.duels where id = p_id;
  if not found or auth.uid() not in (d.host_id, d.guest_id) then
    raise exception 'Nie znaleziono pojedynku albo nie jesteś jego uczestnikiem.';
  end if;
  v_role := case when auth.uid() = d.host_id then 1 else 2 end;
  v_n := jsonb_array_length(d.questions);
  v_my_done := case when v_role = 1 then d.host_done else d.guest_done end;
  -- po zakończeniu albo po moim wyjściu wszystko jawne
  v_reveal := d.status in ('finished', 'cancelled', 'expired', 'declined')
           or (case when v_role = 1 then d.host_left_at else d.guest_left_at end) is not null;

  select jsonb_build_object(
           'name', coalesce(nullif(btrim(pj->>'nickname'), ''), pj->>'username', '?'),
           'avatar', case when coalesce(pj->>'avatar_url', '') ~ '^https://' then pj->>'avatar_url' end,
           'staff', coalesce((pj->>'is_admin')::boolean, false) or coalesce((pj->>'is_teacher')::boolean, false))
    into v_host
    from (select to_jsonb(p) as pj from public.profiles p where p.id = d.host_id) x;
  select jsonb_build_object(
           'name', coalesce(nullif(btrim(pj->>'nickname'), ''), pj->>'username', '?'),
           'avatar', case when coalesce(pj->>'avatar_url', '') ~ '^https://' then pj->>'avatar_url' end,
           'staff', coalesce((pj->>'is_admin')::boolean, false) or coalesce((pj->>'is_teacher')::boolean, false))
    into v_guest
    from (select to_jsonb(p) as pj from public.profiles p where p.id = d.guest_id) x;

  v_host := coalesce(v_host, '{}'::jsonb) || jsonb_build_object(
    'score', d.host_score, 'done', d.host_done, 'correct', d.host_correct,
    'left', d.host_left_at is not null,
    'seen_sec', case when d.host_seen_at is not null then greatest(0, extract(epoch from (now() - d.host_seen_at)))::int end,
    'answers', coalesce((
      select jsonb_agg(case when v_role = 1 or v_reveal or (a->>'i')::int < v_my_done then a
                            else jsonb_build_object('i', a->'i', 'hidden', true) end order by (a->>'i')::int)
        from jsonb_array_elements(coalesce(d.host_answers, '[]'::jsonb)) a), '[]'::jsonb));
  v_guest := coalesce(v_guest, '{}'::jsonb) || jsonb_build_object(
    'score', d.guest_score, 'done', d.guest_done, 'correct', d.guest_correct,
    'left', d.guest_left_at is not null,
    'seen_sec', case when d.guest_seen_at is not null then greatest(0, extract(epoch from (now() - d.guest_seen_at)))::int end,
    'answers', coalesce((
      select jsonb_agg(case when v_role = 2 or v_reveal or (a->>'i')::int < v_my_done then a
                            else jsonb_build_object('i', a->'i', 'hidden', true) end order by (a->>'i')::int)
        from jsonb_array_elements(coalesce(d.guest_answers, '[]'::jsonb)) a), '[]'::jsonb));

  return jsonb_build_object(
    'id', d.id, 'status', d.status, 'my_role', v_role,
    'title', d.title, 'book_id', d.book_id, 'unit_key', d.unit_key,
    'n', v_n, 'q_seconds', public._duel_q_seconds(),
    'started_at', d.started_at, 'finished_at', d.finished_at, 'created_at', d.created_at,
    'server_now', now(),
    'expires_in', case when d.status = 'invited'
                       then greatest(0, 900 - extract(epoch from (now() - d.created_at)))::int end,
    'questions', case when p_full then d.questions end,
    'host', v_host, 'guest', v_guest);
end;
$$;

-- Stary duel_get (aplikacja przed #87) — ten sam wynik + sygnał obecności i domknięcia.
create or replace function public.duel_get(p_id uuid)
returns table (
  id uuid, status text, my_role int, host_name text, guest_name text, title text,
  book_id text, unit_key text, questions jsonb,
  host_score int, guest_score int, host_done int, guest_done int, host_correct int, guest_correct int,
  started_at timestamptz, server_now timestamptz, q_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare d public.duels%rowtype;
begin
  select * into d from public.duels where duels.id = p_id;
  if not found or auth.uid() not in (d.host_id, d.guest_id) then
    raise exception 'Nie znaleziono pojedynku albo nie jesteś jego uczestnikiem.';
  end if;
  perform public._duel_housekeep(p_id);
  select * into d from public.duels where duels.id = p_id;
  return query
    select d.id, d.status, case when auth.uid() = d.host_id then 1 else 2 end,
           (select coalesce(nickname, username) from public.profiles where profiles.id = d.host_id),
           (select coalesce(nickname, username) from public.profiles where profiles.id = d.guest_id),
           d.title, d.book_id, d.unit_key, d.questions,
           d.host_score, d.guest_score, d.host_done, d.guest_done, d.host_correct, d.guest_correct,
           d.started_at, now(), public._duel_q_seconds();
end;
$$;

-- Przyjęcie / odrzucenie zaproszenia (przyjęcie startuje grę za 5 s).
create or replace function public.duel_respond(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.duels%rowtype;
begin
  select * into d from public.duels where id = p_id and guest_id = auth.uid() for update;
  if not found or d.status <> 'invited' or d.created_at < now() - interval '15 minutes' then
    raise exception 'Zaproszenie jest już nieaktualne.';
  end if;
  -- (status „expired” zapisze _duel_housekeep przy kolejnym odczycie)
  if d.host_seen_at is not null and d.host_seen_at < now() - interval '90 seconds' then
    raise exception 'Zaproszenie wygasło — osoba zapraszająca wyszła z aplikacji.';
  end if;
  update public.duels
     set status = case when p_accept then 'playing' else 'declined' end,
         started_at = case when p_accept then now() + interval '5 seconds' else null end,
         finished_at = case when p_accept then null else now() end,
         guest_seen_at = now()
   where id = p_id;
end;
$$;

-- Zaproszenie: zasady z #85 + nauczyciel / admin zaprasza swojego ucznia.
create or replace function public.duel_create(p_guest uuid, p_book text, p_unit text, p_title text, p_questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n int := case when jsonb_typeof(p_questions) = 'array' then jsonb_array_length(p_questions) else 0 end;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_guest is null or p_guest = auth.uid() then raise exception 'Nie możesz zaprosić samego siebie.'; end if;
  if v_n < 5 or v_n > 30 then raise exception 'Nieprawidłowa liczba pytań (5–30).'; end if;
  if not (public._duel_can_pair(auth.uid(), p_guest) or public._is_teacher_of(p_guest)) then
    raise exception 'Możesz zaprosić osobę z klas widocznych w Twoim rankingu, znajomego albo swojego nauczyciela.';
  end if;
  if (select count(*) from public.duels where host_id = auth.uid() and created_at > now() - interval '10 minutes') >= 8 then
    raise exception 'Za dużo zaproszeń — odczekaj kilka minut.';
  end if;
  update public.duels set status = 'cancelled', finished_at = now() where host_id = auth.uid() and status = 'invited';
  -- sprzątanie: pojedynki starsze niż 30 dni (mało danych w bazie)
  delete from public.duels where created_at < now() - interval '30 days';
  insert into public.duels (host_id, guest_id, book_id, unit_key, title, questions, host_seen_at)
  values (auth.uid(), p_guest, left(coalesce(p_book, ''), 80), left(p_unit, 80), left(coalesce(p_title, ''), 120), p_questions, now())
  returning id into v_id;
  return v_id;
end;
$$;

-- Zaproszenia czekające na zalogowanego (bez tych, których autor już wyszedł).
create or replace function public.duel_my_invites()
returns table (id uuid, host_name text, title text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, coalesce(p.nickname, p.username), d.title, d.created_at
    from public.duels d join public.profiles p on p.id = d.host_id
   where d.guest_id = auth.uid() and d.status = 'invited'
     and d.created_at > now() - interval '15 minutes'
     and (d.host_seen_at is null or d.host_seen_at > now() - interval '90 seconds')
   order by d.created_at desc
   limit 5;
$$;

-- ── 3. SKRZYNKA „NA ŻYWO” (jedno zapytanie zamiast dwóch) ─────────
create or replace function public.live_inbox()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'sender_name', m.sender_name, 'body', m.body,
                                          'created_at', m.created_at) order by m.created_at)
        from (select * from public.teacher_messages
               where recipient_id = auth.uid() and read_at is null and dismissed_at is null
                 and created_at > now() - interval '30 days'
               order by created_at limit 20) m), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'title', d.title, 'n', jsonb_array_length(d.questions), 'created_at', d.created_at,
               'expires_in', greatest(0, 900 - extract(epoch from (now() - d.created_at)))::int,
               'host_name', coalesce(nullif(btrim(to_jsonb(p)->>'nickname'), ''), p.username),
               'host_staff', coalesce(p.is_admin, false) or coalesce(p.is_teacher, false))
             order by d.created_at desc)
        from public.duels d join public.profiles p on p.id = d.host_id
       where d.guest_id = auth.uid() and d.status = 'invited'
         and d.created_at > now() - interval '15 minutes'
         and (d.host_seen_at is null or d.host_seen_at > now() - interval '90 seconds')), '[]'::jsonb),
    -- trwająca gra, z której wyszedłem z ekranu bez „Wyjdź” (np. inna zakładka) — „↩️ Wróć do gry”
    'active', (
      select jsonb_build_object('id', d.id, 'title', d.title,
               'name', coalesce(nullif(btrim(to_jsonb(p)->>'nickname'), ''), p.username))
        from public.duels d
        join public.profiles p on p.id = case when d.host_id = auth.uid() then d.guest_id else d.host_id end
       where (d.host_id = auth.uid() or d.guest_id = auth.uid())
         and d.status = 'playing'
         and now() < d.started_at + make_interval(secs => jsonb_array_length(d.questions) * public._duel_q_seconds() + 30)
         and (case when d.host_id = auth.uid() then d.host_left_at else d.guest_left_at end) is null
         and (case when d.host_id = auth.uid() then d.host_done else d.guest_done end) < jsonb_array_length(d.questions)
       order by d.started_at desc
       limit 1),
    'server_now', now());
$$;

-- ── 4. REALTIME (natychmiastowe dostarczanie) ───────────────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and not puballtables) then
    foreach t in array array['teacher_messages', 'duels'] loop
      if not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  else
    raise notice 'Brak publikacji supabase_realtime — aplikacja będzie sprawdzać wiadomości co minutę.';
  end if;
end $$;

-- ── 5. UPRAWNIENIA (zasady z #84) ───────────────────────────────
do $$
declare f text;
begin
  -- wewnętrzne: wołają je tylko inne funkcje SECURITY DEFINER
  foreach f in array array[
    'public._duel_maybe_finish(uuid)', 'public._duel_record(uuid,int,int,boolean,int)', 'public._duel_housekeep(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- tylko dla zalogowanych
  foreach f in array array[
    'public.teacher_message_send(uuid,text)', 'public.teacher_messages_pending()',
    'public.teacher_message_mark(uuid,text)', 'public.teacher_messages_sent(uuid,int)',
    'public.duel_answer(uuid,int,boolean,int)', 'public.duel_answer2(uuid,int,int,int)',
    'public.duel_leave(uuid)', 'public.duel_state(uuid,boolean)', 'public.duel_get(uuid)',
    'public.duel_respond(uuid,boolean)', 'public.duel_create(uuid,text,text,text,jsonb)',
    'public.duel_my_invites()', 'public.live_inbox()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select 'OK — migracja #87 (wiadomości nauczyciela + zaproszenia do gry na żywo) gotowa' as status;
