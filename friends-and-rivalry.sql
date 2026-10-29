-- ═══════════════════════════════════════════════════════════════════
--  85) ZNAJOMI + RYWALIZACJA Z KLASAMI Z RANKINGU + DZIEŃ „WPISZ” (29.10.2026)
-- ═══════════════════════════════════════════════════════════════════
--  • Znajomi (tylko konta uczniów):
--      – zaproszenie z wyszukiwarki — tylko osoby z klas, które uczeń widzi
--        w rankingu (własna klasa + klasy połączone przez nauczyciela, #60);
--      – zaproszenie kodem znajomego (8 znaków) — dla kogoś spoza tych klas;
--        kod trzeba przekazać osobiście, obcy nie znajdą dziecka w wyszukiwarce;
--      – zaproszenie trzeba przyjąć; bez wiadomości i czatu;
--      – limity: 20 zaproszeń / dobę, 10 błędnych kodów / godzinę, 200 znajomych.
--    Znajomi dają: rywalizację online 1 na 1, ranking „👫 Znajomi”,
--    odwiedziny pupila (❤️) i zdjęcia w rankingu.
--  • Rywalizacja online: przeciwnik z dowolnej klasy widocznej w rankingu,
--    znajomy albo (jak dotąd) kolega z klasy / nauczyciel klasy.
--  • log_typed_day(): dzień pracy w trybie „Wpisz” liczony wg czasu
--    polskiego (wcześniej UTC — wpisy po północy liczyły się do poprzedniego
--    dnia). Tydzień oceny: poniedziałek 0:00 – niedziela 23:59.
--  • XP i poziom: add_my_xp() dodaje XP w bazie, zapis profilu z aplikacji
--    nie zmniejszy XP, poziom = XP / 60 + 1, utracone XP przywrócone
--    z dziennego logu (część 6).
--  Wymaga: #20, #21, #24, #45, #50, #60, #61, #62, #63, #70, #71. Idempotentna.
-- ═══════════════════════════════════════════════════════════════════

-- ── 0) Dzień „Wpisz” wg czasu polskiego ─────────────────────────────
create or replace function public.log_typed_day()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.daily_xp_log (user_id, day, typed)
  values (auth.uid(), (now() at time zone 'Europe/Warsaw')::date, true)
  on conflict (user_id, day) do update set typed = true;
end;
$$;
revoke all on function public.log_typed_day() from public, anon;
grant execute on function public.log_typed_day() to authenticated;

-- ── 1) Tabele ───────────────────────────────────────────────────────
create table if not exists public.friend_links (
  id           bigserial primary key,
  from_user    uuid not null references auth.users(id) on delete cascade,
  to_user      uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  via          text not null default 'search'  check (via in ('search', 'code')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);
create unique index if not exists friend_links_pair
  on public.friend_links (least(from_user, to_user), greatest(from_user, to_user));
create index if not exists friend_links_to   on public.friend_links (to_user, status);
create index if not exists friend_links_from on public.friend_links (from_user, status);

create table if not exists public.friend_codes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z2-9]{8}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.friend_code_attempts (
  id      bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  at      timestamptz not null default now(),
  ok      boolean not null
);
create index if not exists friend_code_attempts_user on public.friend_code_attempts (user_id, at);

-- dostęp wyłącznie przez funkcje poniżej
alter table public.friend_links         enable row level security;
alter table public.friend_codes         enable row level security;
alter table public.friend_code_attempts enable row level security;
revoke all on public.friend_links, public.friend_codes, public.friend_code_attempts from anon, authenticated;

-- ── 2) Pomocnicze (wewnętrzne) ──────────────────────────────────────
-- konto ucznia (nie admin, nauczyciel ani opiekun)
create or replace function public._fr_is_student(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                  where id = p and coalesce(is_admin, false) = false
                    and coalesce(is_teacher, false) = false and coalesce(is_parent, false) = false);
$$;

-- czy p_viewer widzi p_target w rankingu (ta sama klasa albo klasa połączona, #60)
create or replace function public._rank_sees(p_viewer uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_members a
      join public.class_members b on b.user_id = p_target
     where a.user_id = p_viewer
       and (b.class_id = a.class_id
            or exists (select 1 from public.class_ranking_links l
                        where l.class_id = a.class_id and l.linked_class_id = b.class_id)));
$$;

create or replace function public._are_friends(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friend_links f
                  where f.status = 'accepted'
                    and ((f.from_user = p_a and f.to_user = p_b) or (f.from_user = p_b and f.to_user = p_a)));
$$;

-- osoby z klas widocznych w moim rankingu (+ nazwa klasy; moja klasa ma pierwszeństwo)
create or replace function public._rank_pool_users()
returns table (user_id uuid, class_name text)
language sql stable security definer set search_path = public as $$
  with mine as (select class_id from public.class_members where user_id = auth.uid()),
  pool as (
    select class_id from mine
    union
    select l.linked_class_id from public.class_ranking_links l where l.class_id in (select class_id from mine)
  )
  select distinct on (m.user_id) m.user_id, c.name
    from public.class_members m
    join public.classes c on c.id = m.class_id
   where m.class_id in (select class_id from pool)
   order by m.user_id, (m.class_id in (select class_id from mine)) desc, c.name;
$$;

create or replace function public._fr_new_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  a text  := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- bez 0/O/1/I/L
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  s text  := '';
  i int;
begin
  for i in 0..7 loop
    s := s || substr(a, (get_byte(b, i) % length(a)) + 1, 1);
  end loop;
  return s;
end;
$$;

-- wspólna logika zaproszenia (z wyszukiwarki albo kodem)
create or replace function public._fr_invite(p_me uuid, p_to uuid, p_via text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v     public.friend_links%rowtype;
  v_had boolean;
begin
  select * into v from public.friend_links
   where least(from_user, to_user) = least(p_me, p_to) and greatest(from_user, to_user) = greatest(p_me, p_to);
  v_had := found;
  if v_had then
    if v.status = 'accepted' then return jsonb_build_object('ok', true, 'status', 'friends'); end if;
    if v.status = 'pending' then
      if v.to_user = p_me then   -- ta osoba już mnie zaprosiła → przyjmuję
        update public.friend_links set status = 'accepted', responded_at = now() where id = v.id;
        return jsonb_build_object('ok', true, 'status', 'friends');
      end if;
      return jsonb_build_object('ok', true, 'status', 'pending');
    end if;
    -- odrzucone: ponownie może zaprosić ten, kto odrzucił, albo zapraszający po 7 dniach
    if v.to_user <> p_me and coalesce(v.responded_at, v.created_at) > now() - interval '7 days' then
      return jsonb_build_object('ok', false, 'error', 'DECLINED');
    end if;
  end if;
  if (select count(*) from public.friend_links where from_user = p_me and created_at > now() - interval '1 day') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'LIMIT');
  end if;
  if (select count(*) from public.friend_links
       where status = 'accepted' and (from_user = p_me or to_user = p_me)) >= 200 then
    return jsonb_build_object('ok', false, 'error', 'TOO_MANY');
  end if;
  if v_had then
    update public.friend_links
       set from_user = p_me, to_user = p_to, status = 'pending', via = p_via, created_at = now(), responded_at = null
     where id = v.id;
  else
    insert into public.friend_links (from_user, to_user, via) values (p_me, p_to, p_via);
  end if;
  return jsonb_build_object('ok', true, 'status', 'sent');
end;
$$;

-- ── 3) Znajomi — funkcje dla aplikacji ──────────────────────────────
create or replace function public.friend_code_get()
returns text language plpgsql security definer set search_path = public as $$
declare v text; n int := 0;
begin
  if auth.uid() is null or not public._fr_is_student(auth.uid()) then return null; end if;
  select code into v from public.friend_codes where user_id = auth.uid();
  while v is null and n < 20 loop
    n := n + 1;
    begin
      insert into public.friend_codes (user_id, code) values (auth.uid(), public._fr_new_code()) returning code into v;
    exception when unique_violation then
      select code into v from public.friend_codes where user_id = auth.uid();
    end;
  end loop;
  return v;
end;
$$;

create or replace function public.friend_code_new()
returns text language plpgsql security definer set search_path = public as $$
declare v text; n int := 0;
begin
  if auth.uid() is null or not public._fr_is_student(auth.uid()) then return null; end if;
  perform public.friend_code_get();
  while n < 20 loop
    n := n + 1;
    begin
      update public.friend_codes set code = public._fr_new_code(), created_at = now()
       where user_id = auth.uid() returning code into v;
      return v;
    exception when unique_violation then null;
    end;
  end loop;
  return null;
end;
$$;

create or replace function public.friend_invite(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  if not public._fr_is_student(v_me) then return jsonb_build_object('ok', false, 'error', 'NOT_STUDENT'); end if;
  if p_user is null or p_user = v_me or not public._fr_is_student(p_user) then
    return jsonb_build_object('ok', false, 'error', 'BAD_TARGET');
  end if;
  if not exists (select 1 from public._rank_pool_users() r where r.user_id = p_user) then
    return jsonb_build_object('ok', false, 'error', 'NOT_IN_POOL');
  end if;
  return public._fr_invite(v_me, p_user, 'search');
end;
$$;

create or replace function public.friend_invite_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  v_code  text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_owner uuid;
  v_res   jsonb;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  if not public._fr_is_student(v_me) then return jsonb_build_object('ok', false, 'error', 'NOT_STUDENT'); end if;
  if (select count(*) from public.friend_code_attempts
       where user_id = v_me and not ok and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'error', 'LIMIT_CODE');
  end if;
  select user_id into v_owner from public.friend_codes where code = v_code;
  if v_owner = v_me then return jsonb_build_object('ok', false, 'error', 'SELF'); end if;
  if v_owner is null or not public._fr_is_student(v_owner) then
    insert into public.friend_code_attempts (user_id, ok) values (v_me, false);
    return jsonb_build_object('ok', false, 'error', 'BAD_CODE');
  end if;
  insert into public.friend_code_attempts (user_id, ok) values (v_me, true);
  delete from public.friend_code_attempts where user_id = v_me and at < now() - interval '1 day';
  v_res := public._fr_invite(v_me, v_owner, 'code');
  return v_res || jsonb_build_object('name',
    (select coalesce(nullif(p.nickname, ''), p.username) from public.profiles p where p.id = v_owner));
end;
$$;

create or replace function public.friend_respond(p_from uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'AUTH'); end if;
  update public.friend_links
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where from_user = p_from and to_user = auth.uid() and status = 'pending';
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  return jsonb_build_object('ok', true, 'status', case when p_accept then 'friends' else 'declined' end);
end;
$$;

-- anulowanie mojego zaproszenia albo usunięcie znajomego
create or replace function public.friend_remove(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friend_links
   where ((from_user = auth.uid() and to_user = p_user) or (from_user = p_user and to_user = auth.uid() and status = 'accepted'))
     and status in ('pending', 'accepted');
$$;

-- znajomi + zaproszenia (status: friend / in = do mnie / out = ode mnie)
create or replace function public.my_friends()
returns table (user_id uuid, display_name text, status text, via text, since timestamptz, class_name text)
language sql stable security definer set search_path = public as $$
  with mine as (
    select f.*, case when f.from_user = auth.uid() then f.to_user else f.from_user end as other
      from public.friend_links f
     where (f.from_user = auth.uid() or f.to_user = auth.uid()) and f.status in ('pending', 'accepted')
  )
  select m.other,
         coalesce(nullif(p.nickname, ''), p.username)::text,
         case when m.status = 'accepted' then 'friend' when m.from_user = auth.uid() then 'out' else 'in' end,
         m.via,
         coalesce(m.responded_at, m.created_at),
         r.class_name
    from mine m
    join public.profiles p on p.id = m.other
    left join public._rank_pool_users() r on r.user_id = m.other
   order by 3, 2;
$$;

-- wyszukiwarka: tylko osoby z klas widocznych w moim rankingu
create or replace function public.friend_search(p_query text)
returns table (user_id uuid, display_name text, class_name text, status text)
language sql stable security definer set search_path = public as $$
  select r.user_id,
         coalesce(nullif(p.nickname, ''), p.username)::text,
         r.class_name,
         coalesce((select case when f.status = 'accepted' then 'friend'
                               when f.status = 'pending' and f.from_user = auth.uid() then 'out'
                               when f.status = 'pending' then 'in' else 'none' end
                     from public.friend_links f
                    where least(f.from_user, f.to_user) = least(auth.uid(), r.user_id)
                      and greatest(f.from_user, f.to_user) = greatest(auth.uid(), r.user_id)), 'none')
    from public._rank_pool_users() r
    join public.profiles p on p.id = r.user_id
   where r.user_id <> auth.uid()
     and public._fr_is_student(auth.uid())
     and coalesce(p.is_admin, false) = false and coalesce(p.is_teacher, false) = false and coalesce(p.is_parent, false) = false
     and (coalesce(btrim(p_query), '') = ''
          or p.nickname ilike '%' || btrim(p_query) || '%'
          or p.username ilike '%' || btrim(p_query) || '%')
   order by 2
   limit 60;
$$;

create or replace function public.friend_pending_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.friend_links where to_user = auth.uid() and status = 'pending';
$$;

-- ranking „👫 Znajomi” — te same kolumny co my_class_rankings (#61), bez klasy
create or replace function public.friends_rankings()
returns table (
  user_id uuid, username text, nickname text,
  xp_today int, xp_week int, xp_month int, longest_streak int, best_combo int,
  level int, xp_total int, well_learned int
)
language sql stable security definer set search_path = public as $$
  with fr as (
    select case when f.from_user = auth.uid() then f.to_user else f.from_user end as id
      from public.friend_links f
     where f.status = 'accepted' and (f.from_user = auth.uid() or f.to_user = auth.uid())
  ), ppl as (
    select id from fr
    union
    select auth.uid() where exists (select 1 from fr)
  )
  select pr.id, pr.username, pr.nickname,
    coalesce((select sum(d.xp) from public.daily_xp_log d where d.user_id = pr.id and d.day = current_date), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d where d.user_id = pr.id and d.day >= current_date - interval '6 days'), 0)::int,
    coalesce((select sum(d.xp) from public.daily_xp_log d where d.user_id = pr.id and d.day >= current_date - interval '30 days'), 0)::int,
    coalesce(pr.longest_streak, 0),
    coalesce(pr.best_correct_streak, 0),
    coalesce(pr.level, 1),
    coalesce(pr.xp, 0),
    coalesce(pr.well_learned_words, 0)
  from ppl join public.profiles pr on pr.id = ppl.id;
$$;

-- ── 4) Rywalizacja online: klasy z rankingu + znajomi ───────────────
create or replace function public._duel_can_pair(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members x join public.class_members y on y.class_id = x.class_id
                  where x.user_id = p_a and y.user_id = p_b)
      or exists (select 1 from public.classes c join public.class_members m on m.class_id = c.id
                  where (c.admin_id = p_a and m.user_id = p_b)
                     or (c.admin_id = p_b and m.user_id = p_a))
      or public._rank_sees(p_a, p_b)
      or public._rank_sees(p_b, p_a)
      or public._are_friends(p_a, p_b);
$$;

create or replace function public.duel_search_players(p_query text)
returns table (user_id uuid, display_name text, class_name text)
language sql stable security definer set search_path = public as $$
  with cand as (
    -- znajomi
    select p.id, coalesce(nullif(p.nickname, ''), p.username) as display_name, '👫 Znajomy' as class_name, 1 as ord
      from public.friend_links f
      join public.profiles p on p.id = case when f.from_user = auth.uid() then f.to_user else f.from_user end
     where f.status = 'accepted' and (f.from_user = auth.uid() or f.to_user = auth.uid())
    union all
    -- uczniowie z klas widocznych w rankingu (moja klasa + klasy połączone)
    select p.id, coalesce(nullif(p.nickname, ''), p.username), r.class_name, 2
      from public._rank_pool_users() r
      join public.profiles p on p.id = r.user_id
     where p.id <> auth.uid()
       and coalesce(p.is_admin, false) = false
       and coalesce(p.is_teacher, false) = false
    union all
    -- nauczyciel, który utworzył moją klasę
    select p.id, coalesce(nullif(p.nickname, ''), p.username), '👩‍🏫 Nauczyciel · ' || c.name, 0
      from public.class_members me
      join public.classes c  on c.id = me.class_id
      join public.profiles p on p.id = c.admin_id
     where me.user_id = auth.uid()
       and c.admin_id <> auth.uid()
    union all
    -- uczniowie klas, które utworzyłem (gdy szuka nauczyciel)
    select p.id, coalesce(nullif(p.nickname, ''), p.username), c.name, 2
      from public.classes c
      join public.class_members cm on cm.class_id = c.id
      join public.profiles p       on p.id = cm.user_id
     where c.admin_id = auth.uid()
       and p.id <> auth.uid()
       and coalesce(p.is_admin, false) = false
       and coalesce(p.is_teacher, false) = false
  ), filtered as (
    select distinct on (id) id, display_name, class_name, ord
      from cand
     where coalesce(btrim(p_query), '') = ''
        or display_name ilike '%' || btrim(p_query) || '%'
        or exists (select 1 from public.profiles pp where pp.id = cand.id and pp.username ilike '%' || btrim(p_query) || '%')
     order by id, ord, class_name
  )
  select id, display_name, class_name from filtered
   order by ord, display_name
   limit 80;
$$;

create or replace function public.duel_create(p_guest uuid, p_book text, p_unit text, p_title text, p_questions jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_n int := jsonb_array_length(coalesce(p_questions, '[]'::jsonb));
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_guest = auth.uid() then raise exception 'Nie możesz zaprosić samego siebie.'; end if;
  if v_n < 5 or v_n > 30 then raise exception 'Nieprawidłowa liczba pytań (5–30).'; end if;
  if not public._duel_can_pair(auth.uid(), p_guest) then
    raise exception 'Możesz zaprosić osobę z klas widocznych w Twoim rankingu, znajomego albo swojego nauczyciela.';
  end if;
  if (select count(*) from public.duels where host_id = auth.uid() and created_at > now() - interval '10 minutes') >= 8 then
    raise exception 'Za dużo zaproszeń — odczekaj kilka minut.';
  end if;
  update public.duels set status = 'cancelled' where host_id = auth.uid() and status = 'invited';
  insert into public.duels (host_id, guest_id, book_id, unit_key, title, questions)
  values (auth.uid(), p_guest, p_book, p_unit, left(coalesce(p_title, ''), 120), p_questions)
  returning id into v_id;
  return v_id;
end;
$$;

-- ── 5) Pupile i zdjęcia: także znajomi ──────────────────────────────
create or replace function public._pet_pool()
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  with fr as (
    select case when f.from_user = auth.uid() then f.to_user else f.from_user end as id
      from public.friend_links f
     where f.status = 'accepted' and (f.from_user = auth.uid() or f.to_user = auth.uid())
  )
  select r.user_id from public._rank_pool_users() r
  union
  select id from fr
  union
  select auth.uid() where exists (select 1 from fr);
$$;

create or replace function public.class_avatars()
returns table (user_id uuid, avatar_url text)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.avatar_url
    from public.profiles p
   where p.id in (select pp.user_id from public._pet_pool() pp)
     and p.avatar_url is not null;
$$;

-- ── 6) XP i poziom: bez cofania i bez utraty punktów ────────────────
--  Uczniowie widzieli wyższy poziom, a potem niższy. Przyczyny: zapis całego
--  profilu ze starej karty / drugiego urządzenia nadpisywał nowsze XP, a XP
--  z ćwiczeń gramatyki, czytanek i rozmów z AI nie trafiało do bazy.
--  Teraz aplikacja dodaje XP przez add_my_xp (xp = xp + delta w jednym kroku),
--  zapis profilu z aplikacji nie może zmniejszyć XP ani rekordów, a poziom
--  zawsze wynika z XP (60 XP na poziom — XP_PER w app.html).
alter table public.profiles add column if not exists xp_synced_at timestamptz;

create or replace function public.add_my_xp(p_delta int)
returns table (new_xp int, new_level int)
language plpgsql
security definer
set search_path = public
as $$
declare
  d int := greatest(0, least(coalesce(p_delta, 0), 2000));
  v int;
begin
  if auth.uid() is null then return; end if;
  update public.profiles p
     set xp = coalesce(p.xp, 0) + d,
         level = floor((coalesce(p.xp, 0) + d) / 60.0)::int + 1,
         xp_synced_at = now()
   where p.id = auth.uid()
  returning p.xp into v;
  if v is null then return; end if;
  if d > 0 then
    insert into public.daily_xp_log (user_id, day, xp, first_active_at, updated_at)
    values (auth.uid(), current_date, d, now(), now())
    on conflict (user_id, day) do update
       set xp = public.daily_xp_log.xp + excluded.xp,
           first_active_at = coalesce(public.daily_xp_log.first_active_at, excluded.first_active_at),
           updated_at = now();
  end if;
  return query select v, floor(v / 60.0)::int + 1;
end;
$$;

-- zapis z aplikacji (stara wersja albo stara karta) nie zmniejszy XP ani rekordów
create or replace function public._profiles_xp_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') then
    new.xp := greatest(coalesce(new.xp, 0), coalesce(old.xp, 0));
    new.longest_streak := greatest(coalesce(new.longest_streak, 0), coalesce(old.longest_streak, 0));
    if to_jsonb(new) ? 'best_correct_streak' then
      new.best_correct_streak := greatest(coalesce(new.best_correct_streak, 0), coalesce(old.best_correct_streak, 0));
    end if;
  end if;
  new.level := floor(coalesce(new.xp, 0) / 60.0)::int + 1;
  return new;
end $$;
drop trigger if exists profiles_xp_guard on public.profiles;
create trigger profiles_xp_guard before insert or update on public.profiles
  for each row execute function public._profiles_xp_guard();
revoke all on function public._profiles_xp_guard() from public, anon, authenticated;

-- przywrócenie XP utraconego przez nadpisanie: profiles.xp nie może być mniejsze
-- niż suma dziennego logu (daily_xp_log dodaje XP w bazie, więc go nie stracił)
update public.profiles p
   set xp = s.total
  from (select user_id, sum(xp)::int as total from public.daily_xp_log group by user_id) s
 where s.user_id = p.id and coalesce(p.xp, 0) < s.total;
update public.profiles
   set level = floor(coalesce(xp, 0) / 60.0)::int + 1
 where level is distinct from floor(coalesce(xp, 0) / 60.0)::int + 1;

-- ── 7) Uprawnienia (zasady z #84) ───────────────────────────────────
do $$
declare f text;
begin
  -- wewnętrzne: tylko właściciel (wołają je funkcje SECURITY DEFINER)
  foreach f in array array[
    'public._fr_is_student(uuid)', 'public._rank_sees(uuid,uuid)', 'public._are_friends(uuid,uuid)',
    'public._rank_pool_users()', 'public._fr_new_code()', 'public._fr_invite(uuid,uuid,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- dla zalogowanych
  foreach f in array array[
    'public.friend_code_get()', 'public.friend_code_new()', 'public.friend_invite(uuid)',
    'public.friend_invite_by_code(text)', 'public.friend_respond(uuid,boolean)', 'public.friend_remove(uuid)',
    'public.my_friends()', 'public.friend_search(text)', 'public.friend_pending_count()',
    'public.friends_rankings()', 'public.duel_search_players(text)',
    'public.duel_create(uuid,text,text,text,jsonb)', 'public.class_avatars()', 'public._pet_pool()',
    'public.add_my_xp(int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

select 'OK — migracja #85 (znajomi, rywalizacja z klasami z rankingu, dzień Wpisz) gotowa' as status;
