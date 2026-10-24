-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — PUPILE KOLEGÓW I ODWIEDZINY (❤️ reakcje)
--  Migracja #71 · idempotentna
--
--  • class_pets() — pupile uczniów z mojej klasy (i klas połączonych
--    rankingiem, #60): kto, jaki pupil, etap (gp), nastrój, suma reakcji.
--    Uczeń nie czyta cudzych profili (RLS), dlatego SECURITY DEFINER —
--    zwracamy tylko dane pupila i nazwę z rankingu (ksywka albo login).
--  • pet_react(to, kind) — odwiedziny: gotowe reakcje ❤️ 🌟 👏 🎉 🍪,
--    bez czatu. Tylko między uczniami z tej samej puli klas, max 10
--    reakcji dziennie od jednej osoby dla jednego pupila.
--  • pet_reactions_inbox(since) — co dostał mój pupil (kto, co, ile),
--    np. „Szybka Sowa przekazał(a) Twojemu pupilowi 10 ❤️”.
--
--  Wymaga: #70 (profiles.pet), #60 (class_ranking_links), #61 (ksywki —
--  opcjonalnie), tabel classes / class_members.
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists pet jsonb;

-- ── 1. REAKCJE ───────────────────────────────────────────────────
create table if not exists public.pet_reactions (
  id         bigserial primary key,
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('heart','star','clap','party','cookie')),
  day        date not null default current_date,
  cnt        int  not null default 1,
  last_at    timestamptz not null default now(),
  unique (from_user, to_user, day, kind)
);
create index if not exists pet_reactions_to on public.pet_reactions (to_user, last_at desc);

alter table public.pet_reactions enable row level security;
drop policy if exists "pet_reactions: read own" on public.pet_reactions;
create policy "pet_reactions: read own" on public.pet_reactions for select
  using (to_user = auth.uid() or from_user = auth.uid() or public._is_admin());
grant select on public.pet_reactions to authenticated;   -- zapis tylko przez pet_react()

-- ── 2. PULA KLAS (moja klasa + klasy połączone rankingiem) ──────
create or replace function public._pet_pool()
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if to_regclass('public.class_ranking_links') is not null then
    return query execute $q$
      with my_classes as (select class_id from public.class_members where user_id = auth.uid()),
      pool as (
        select class_id from my_classes
        union
        select l.linked_class_id from public.class_ranking_links l where l.class_id in (select class_id from my_classes)
      )
      select distinct m.user_id from public.class_members m where m.class_id in (select class_id from pool)
    $q$;
  else
    return query
      select distinct m.user_id from public.class_members m
      where m.class_id in (select class_id from public.class_members where user_id = auth.uid());
  end if;
end;
$$;

-- ── 3. PUPILE KOLEGÓW ────────────────────────────────────────────
drop function if exists public.class_pets();
create function public.class_pets()
returns table (user_id uuid, display_name text, pet jsonb, reactions int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_nick boolean;
begin
  if auth.uid() is null then return; end if;
  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'nickname') into v_nick;
  return query execute format($q$
    select p.id,
           coalesce(%s, p.username)::text,
           jsonb_build_object(
             'type',  p.pet->'pet'->>'type',
             'name',  p.pet->'pet'->>'name',
             'gp',    p.pet->'pet'->'gp',
             'happy', p.pet->'pet'->'happy',
             'v',     p.pet->'pet'->'v'),
           coalesce((select sum(r.cnt)::int from public.pet_reactions r where r.to_user = p.id), 0)
      from public.profiles p
     where p.id in (select pp.user_id from public._pet_pool() pp)
       and coalesce(p.is_admin, false) = false
       and coalesce(p.is_teacher, false) = false
       and p.pet is not null
       and p.pet->'pet' is not null
       and jsonb_typeof(p.pet->'pet') = 'object'
       and coalesce(p.pet->>'on', 'true') <> 'false'
  $q$, case when v_nick then 'nullif(p.nickname, '''')' else 'null' end);
end;
$$;

-- ── 4. WYŚLIJ REAKCJĘ ────────────────────────────────────────────
create or replace function public.pet_react(p_to uuid, p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_today int;
begin
  if v_me is null then raise exception 'NOT_LOGGED_IN'; end if;
  if p_to is null or p_to = v_me then raise exception 'BAD_TARGET'; end if;
  if p_kind not in ('heart','star','clap','party','cookie') then raise exception 'BAD_KIND'; end if;
  if not exists (select 1 from public._pet_pool() pp where pp.user_id = p_to)
     or not exists (select 1 from public._pet_pool() pp where pp.user_id = v_me) then
    raise exception 'NOT_IN_CLASS';
  end if;
  select coalesce(sum(cnt), 0) into v_today from public.pet_reactions
   where from_user = v_me and to_user = p_to and day = current_date;
  if v_today >= 10 then raise exception 'LIMIT'; end if;
  insert into public.pet_reactions (from_user, to_user, kind)
  values (v_me, p_to, p_kind)
  on conflict (from_user, to_user, day, kind)
  do update set cnt = public.pet_reactions.cnt + 1, last_at = now();
  return v_today + 1;
end;
$$;

-- Ile reakcji wysłałem dziś danemu pupilowi (do licznika „x/10”).
create or replace function public.pet_react_sent_today(p_to uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(cnt), 0)::int from public.pet_reactions
   where from_user = auth.uid() and to_user = p_to and day = current_date;
$$;

-- ── 5. SKRZYNKA: CO DOSTAŁ MÓJ PUPIL ─────────────────────────────
drop function if exists public.pet_reactions_inbox(timestamptz);
create function public.pet_reactions_inbox(p_since timestamptz)
returns table (from_name text, kind text, cnt int, last_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_nick boolean;
begin
  if auth.uid() is null then return; end if;
  select exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'nickname') into v_nick;
  return query execute format($q$
    select coalesce(%s, p.username)::text, r.kind, sum(r.cnt)::int, max(r.last_at)
      from public.pet_reactions r
      join public.profiles p on p.id = r.from_user
     where r.to_user = auth.uid() and r.last_at > coalesce($1, now() - interval '7 days')
     group by 1, r.kind
     order by max(r.last_at) desc
     limit 50
  $q$, case when v_nick then 'nullif(p.nickname, '''')' else 'null' end) using p_since;
end;
$$;

revoke all on function public._pet_pool() from public;
grant execute on function public._pet_pool()                         to authenticated;
grant execute on function public.class_pets()                        to authenticated;
grant execute on function public.pet_react(uuid, text)               to authenticated;
grant execute on function public.pet_react_sent_today(uuid)          to authenticated;
grant execute on function public.pet_reactions_inbox(timestamptz)    to authenticated;

select 'OK — pupile kolegów i odwiedziny gotowe' as status;
