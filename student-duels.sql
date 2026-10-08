-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — RYWALIZACJA ONLINE 1 NA 1 + KSYWKI
--  Migracja #61 · idempotentna
--
--  1) KSYWKI: profiles.nickname (3–20 znaków, unikalna bez względu na
--     wielkość liter). Walidacja + filtr wulgaryzmów w BAZIE (trigger) —
--     nie da się go obejść z przeglądarki. Admin / nauczyciel (dla uczniów
--     swoich klas lub utworzonych przez siebie) może ksywkę usunąć.
--  2) POJEDYNKI: tabela duels. Uczeń 1 (zapraszający) wybiera kolegę
--     z SWOICH klas → zaproszenie widzi tylko Uczeń 2 (bez wiadomości
--     tekstowych). Obaj odpowiadają na te same pytania w tym samym czasie;
--     punkty liczy serwer (poprawność + szybkość).
--  3) my_class_rankings() — dodana kolumna nickname (ranking pokazuje ksywki).
--
--  Wymaga: #20 (_is_admin/_is_teacher), #13 (profiles.created_by),
--          #45, #54, #60 (my_class_rankings z pulą klas).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. KSYWKI ────────────────────────────────────────────────────
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists nickname_cleared_by uuid;
alter table public.profiles add column if not exists nickname_cleared_at timestamptz;

create unique index if not exists profiles_nickname_lower_uq
  on public.profiles (lower(nickname)) where nickname is not null;

-- Czy ksywka jest dozwolona: długość, znaki, filtr wulgaryzmów/obraźliwych słów.
create or replace function public._nickname_ok(p text)
returns boolean
language plpgsql
immutable
as $$
declare
  v text := lower(coalesce(p, ''));
  -- znormalizowana: bez spacji/kropek/kresek/podkreśleń, popularne podmiany cyfr
  n text;
  bad text[] := array[
    'kurw','chuj','huj','jeb','pierd','pizd','spierd','dziwk','cipa','cipk','kutas','fiut',
    'cwel','pedal','pedał','szmat','suka','sukin','dupek','debil','idiot','kretyn','frajer',
    'zjeb','sperm','penis','wagin','cyck','gówn','gown','srac','sraj','zasran',
    'fuck','shit','bitch','dick','cunt','nigg','whore','slut','asshole','bastard',
    'hitler','nazi','sex','porn','zabij'
  ];
  w text;
begin
  if p is null then return true; end if;
  if char_length(btrim(p)) < 3 or char_length(btrim(p)) > 20 then return false; end if;
  -- litery (także polskie), cyfry, spacja, _ - .
  if p !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.-]+$' then return false; end if;
  n := translate(regexp_replace(v, '[ _.-]', '', 'g'), '013457@$', 'oieastas');
  foreach w in array bad loop
    if position(w in n) > 0 or position(w in v) > 0 then return false; end if;
  end loop;
  return true;
end;
$$;

-- Trigger: blokuje zapis niedozwolonej ksywki niezależnie od drogi zapisu.
create or replace function public._profiles_nickname_guard()
returns trigger
language plpgsql
as $$
begin
  if new.nickname is not null then
    new.nickname := regexp_replace(btrim(new.nickname), '\s+', ' ', 'g');
    if new.nickname = '' then new.nickname := null; return new; end if;
    if not public._nickname_ok(new.nickname) then
      raise exception 'Ta ksywka jest niedozwolona (3–20 znaków: litery, cyfry, spacja, _ - . i bez obraźliwych słów).';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_nickname_guard on public.profiles;
create trigger profiles_nickname_guard
  before insert or update of nickname on public.profiles
  for each row execute function public._profiles_nickname_guard();

-- Ustawienie własnej ksywki (pusta = usuń).
create or replace function public.set_my_nickname(p_nickname text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := nullif(regexp_replace(btrim(coalesce(p_nickname, '')), '\s+', ' ', 'g'), '');
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if v is not null then
    if not public._nickname_ok(v) then
      raise exception 'Ta ksywka jest niedozwolona (3–20 znaków: litery, cyfry, spacja, _ - . i bez obraźliwych słów).';
    end if;
    if exists (select 1 from public.profiles where lower(nickname) = lower(v) and id <> auth.uid()) then
      raise exception 'Ta ksywka jest już zajęta — wybierz inną.';
    end if;
  end if;
  update public.profiles set nickname = v where id = auth.uid();
  return v;
end;
$$;

-- Czy zalogowany może moderować ucznia (admin / nauczyciel jego klasy lub twórca konta).
create or replace function public._can_moderate_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._is_admin()
      or (public._is_teacher() and (
            exists (select 1 from public.profiles p where p.id = p_user and p.created_by = auth.uid())
         or exists (select 1 from public.class_members m join public.classes c on c.id = m.class_id
                     where m.user_id = p_user and c.admin_id = auth.uid())
      ));
$$;

-- Usunięcie (wyczyszczenie) ksywki przez admina/nauczyciela — albo przez samego ucznia.
create or replace function public.clear_user_nickname(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_user <> auth.uid() and not public._can_moderate_user(p_user) then
    raise exception 'Brak uprawnień do zmiany ksywki tego użytkownika.';
  end if;
  update public.profiles
     set nickname = null,
         nickname_cleared_by = case when p_user = auth.uid() then null else auth.uid() end,
         nickname_cleared_at = case when p_user = auth.uid() then null else now() end
   where id = p_user;
end;
$$;

-- Ksywki członków klasy (do moderacji w widoku klasy nauczyciela/admina).
create or replace function public.class_member_nicknames(p_class uuid)
returns table (user_id uuid, nickname text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nickname
    from public.class_members m
    join public.profiles p on p.id = m.user_id
   where m.class_id = p_class
     and p.nickname is not null
     and (public._is_admin() or exists (select 1 from public.classes c where c.id = p_class and c.admin_id = auth.uid()));
$$;

grant execute on function public.set_my_nickname(text)        to authenticated;
grant execute on function public.clear_user_nickname(uuid)    to authenticated;
grant execute on function public.class_member_nicknames(uuid) to authenticated;

-- ── 2. POJEDYNKI ─────────────────────────────────────────────────
create table if not exists public.duels (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references auth.users(id) on delete cascade,  -- Uczeń 1
  guest_id      uuid not null references auth.users(id) on delete cascade,  -- Uczeń 2
  book_id       text not null,
  unit_key      text,
  title         text,
  questions     jsonb not null,
  status        text not null default 'invited'
                check (status in ('invited','playing','finished','declined','cancelled','expired')),
  host_score    int not null default 0,
  guest_score   int not null default 0,
  host_done     int not null default 0,
  guest_done    int not null default 0,
  host_correct  int not null default 0,
  guest_correct int not null default 0,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists duels_guest_status on public.duels (guest_id, status);
create index if not exists duels_host_status  on public.duels (host_id, status);

alter table public.duels enable row level security;
drop policy if exists "duels: participants read" on public.duels;
create policy "duels: participants read" on public.duels
  for select using (auth.uid() in (host_id, guest_id) or public._is_admin());
-- Brak polityk INSERT/UPDATE/DELETE — wszystkie zmiany tylko przez funkcje poniżej.
grant select on public.duels to authenticated;

-- Czas na jedno pytanie (s) — używany w limicie gry.
create or replace function public._duel_q_seconds() returns int language sql immutable as $$ select 12 $$;

-- Wyszukiwanie przeciwnika: TYLKO uczniowie z klas, do których należy zalogowany.
create or replace function public.duel_search_players(p_query text)
returns table (user_id uuid, display_name text, class_name text)
language sql
stable
security definer
set search_path = public
as $$
  select x.id, x.display_name, x.class_name from (
    select distinct on (p.id) p.id,
           coalesce(p.nickname, p.username) as display_name,
           c.name as class_name
      from public.class_members me
      join public.class_members cm on cm.class_id = me.class_id
      join public.classes c        on c.id = cm.class_id
      join public.profiles p       on p.id = cm.user_id
     where me.user_id = auth.uid()
       and p.id <> auth.uid()
       and coalesce(p.is_admin, false) = false
       and coalesce(p.is_teacher, false) = false
       and (coalesce(btrim(p_query), '') = ''
            or coalesce(p.nickname, '') ilike '%' || btrim(p_query) || '%'
            or p.username ilike '%' || btrim(p_query) || '%')
     order by p.id, c.name
  ) x
  order by x.display_name
  limit 60;
$$;

-- Utworzenie zaproszenia (Uczeń 1 → Uczeń 2).
create or replace function public.duel_create(p_guest uuid, p_book text, p_unit text, p_title text, p_questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n int := jsonb_array_length(coalesce(p_questions, '[]'::jsonb));
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_guest = auth.uid() then raise exception 'Nie możesz zaprosić samego siebie.'; end if;
  if v_n < 5 or v_n > 30 then raise exception 'Nieprawidłowa liczba pytań (5–30).'; end if;
  if not exists (select 1 from public.class_members me join public.class_members cm on cm.class_id = me.class_id
                  where me.user_id = auth.uid() and cm.user_id = p_guest) then
    raise exception 'Możesz zaprosić tylko osobę ze swojej klasy.';
  end if;
  -- ochrona przed spamem: max 8 zaproszeń na 10 minut
  if (select count(*) from public.duels where host_id = auth.uid() and created_at > now() - interval '10 minutes') >= 8 then
    raise exception 'Za dużo zaproszeń — odczekaj kilka minut.';
  end if;
  -- poprzednie otwarte zaproszenia tego ucznia → anulowane
  update public.duels set status = 'cancelled' where host_id = auth.uid() and status = 'invited';
  insert into public.duels (host_id, guest_id, book_id, unit_key, title, questions)
  values (auth.uid(), p_guest, p_book, p_unit, left(coalesce(p_title, ''), 120), p_questions)
  returning id into v_id;
  return v_id;
end;
$$;

-- Zaproszenia czekające na zalogowanego (ważne 15 minut).
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
   order by d.created_at desc
   limit 5;
$$;

-- Stan pojedynku (z nazwami graczy i czasem serwera). Domyka przeterminowane.
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
declare d public.duels%rowtype; v_n int;
begin
  select * into d from public.duels where duels.id = p_id;
  if not found or auth.uid() not in (d.host_id, d.guest_id) then
    raise exception 'Nie znaleziono pojedynku albo nie jesteś jego uczestnikiem.';
  end if;
  v_n := jsonb_array_length(d.questions);
  if d.status = 'invited' and d.created_at < now() - interval '15 minutes' then
    update public.duels set status = 'expired' where duels.id = p_id; d.status := 'expired';
  elsif d.status = 'playing' and now() > d.started_at + make_interval(secs => v_n * public._duel_q_seconds() + 30) then
    update public.duels set status = 'finished', finished_at = now() where duels.id = p_id; d.status := 'finished';
  end if;
  return query
    select d.id, d.status, case when auth.uid() = d.host_id then 1 else 2 end,
           (select coalesce(nickname, username) from public.profiles where profiles.id = d.host_id),
           (select coalesce(nickname, username) from public.profiles where profiles.id = d.guest_id),
           d.title, d.book_id, d.unit_key, d.questions,
           d.host_score, d.guest_score, d.host_done, d.guest_done, d.host_correct, d.guest_correct,
           d.started_at, now(), public._duel_q_seconds();
end;
$$;

-- Odpowiedź Ucznia 2 na zaproszenie. Przyjęcie startuje grę za 5 s.
create or replace function public.duel_respond(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.duels
     set status = case when p_accept then 'playing' else 'declined' end,
         started_at = case when p_accept then now() + interval '5 seconds' else null end
   where id = p_id and guest_id = auth.uid() and status = 'invited'
     and created_at > now() - interval '15 minutes';
  if not found then raise exception 'Zaproszenie jest już nieaktualne.'; end if;
end;
$$;

-- Anulowanie zaproszenia przez Ucznia 1 albo opuszczenie gry przez dowolnego gracza.
create or replace function public.duel_cancel(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.duels set status = 'cancelled', finished_at = now()
   where id = p_id and auth.uid() in (host_id, guest_id) and status in ('invited', 'playing');
end;
$$;

-- Odpowiedź na pytanie p_index. Punkty liczy SERWER: 100 za poprawną + do 50 za szybkość.
create or replace function public.duel_answer(p_id uuid, p_index int, p_correct boolean, p_ms int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.duels%rowtype; v_role int; v_done int; v_n int; v_ms int; v_pts int; v_lim int;
begin
  select * into d from public.duels where id = p_id for update;
  if not found or auth.uid() not in (d.host_id, d.guest_id) then raise exception 'Brak dostępu.'; end if;
  if d.status <> 'playing' or now() < d.started_at then return; end if;
  v_role := case when auth.uid() = d.host_id then 1 else 2 end;
  v_done := case when v_role = 1 then d.host_done else d.guest_done end;
  v_n := jsonb_array_length(d.questions);
  if p_index <> v_done or p_index >= v_n then return; end if;   -- tylko kolejne, bez powtórek
  v_lim := public._duel_q_seconds() * 1000;
  v_ms := greatest(0, least(v_lim, coalesce(p_ms, v_lim)));
  v_pts := case when p_correct then 100 + ((v_lim - v_ms) * 50 / v_lim) else 0 end;
  if v_role = 1 then
    update public.duels set host_done = host_done + 1, host_score = host_score + v_pts,
           host_correct = host_correct + (case when p_correct then 1 else 0 end) where id = p_id;
  else
    update public.duels set guest_done = guest_done + 1, guest_score = guest_score + v_pts,
           guest_correct = guest_correct + (case when p_correct then 1 else 0 end) where id = p_id;
  end if;
  update public.duels set status = 'finished', finished_at = now()
   where id = p_id and host_done >= v_n and guest_done >= v_n and status = 'playing';
end;
$$;

grant execute on function public.duel_search_players(text)                  to authenticated;
grant execute on function public.duel_create(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.duel_my_invites()                          to authenticated;
grant execute on function public.duel_get(uuid)                             to authenticated;
grant execute on function public.duel_respond(uuid, boolean)                to authenticated;
grant execute on function public.duel_cancel(uuid)                          to authenticated;
grant execute on function public.duel_answer(uuid, int, boolean, int)       to authenticated;

-- ── 3. RANKING KLASY Z KSYWKAMI (my_class_rankings z #60 + nickname) ──
drop function if exists public.my_class_rankings();
create function public.my_class_rankings()
returns table (
  class_id uuid, class_name text, user_id uuid, username text,
  xp_today int, xp_week int, xp_month int, longest_streak int, best_combo int,
  level int, xp_total int, well_learned int, member_class_name text, multi_class boolean,
  nickname text
)
language sql
security definer
set search_path = public
as $$
  with mine as (
    select me.class_id from public.class_members me where me.user_id = auth.uid()
  ),
  pool as (
    select m.class_id as pool_id, m.class_id as member_class from mine m
    union
    select m.class_id, l.linked_class_id
      from mine m join public.class_ranking_links l on l.class_id = m.class_id
  ),
  people as (
    select distinct on (p.pool_id, cm.user_id)
           p.pool_id, cm.user_id, cm.class_id as member_class
      from pool p
      join public.class_members cm on cm.class_id = p.member_class
     order by p.pool_id, cm.user_id, (cm.class_id = p.pool_id) desc
  )
  select
    pc.id, pc.name, pr.id, pr.username,
    coalesce((select sum(d.xp) from public.daily_xp_log d where d.user_id = pr.id and d.day = current_date), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d where d.user_id = pr.id and d.day >= current_date - interval '6 days'), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d where d.user_id = pr.id and d.day >= current_date - interval '30 days'), 0)::int,
    coalesce(pr.longest_streak, 0),
    coalesce(pr.best_correct_streak, 0),
    coalesce(pr.level, 1),
    coalesce(pr.xp, 0),
    coalesce(pr.well_learned_words, 0),
    mc.name,
    (select count(*) from pool x where x.pool_id = pe.pool_id) > 1,
    pr.nickname
  from people pe
  join public.classes  pc on pc.id = pe.pool_id
  join public.classes  mc on mc.id = pe.member_class
  join public.profiles pr on pr.id = pe.user_id
  where coalesce(pr.is_admin, false) = false
    and coalesce(pr.is_teacher, false) = false;
$$;
grant execute on function public.my_class_rankings() to authenticated;

select 'OK — migracja #61 (rywalizacja online + ksywki) gotowa' as status;
