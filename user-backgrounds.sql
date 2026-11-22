-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 🖼️ WŁASNE TŁO (TAPETA) UŻYTKOWNIKA
--  Migracja #103 · idempotentna (można uruchomić ponownie) · 22.11.2026, SW v1.267
--
--  Użytkownik Premium może wgrać najwyżej 2 tapety i ustawić jedną jako tło
--  aplikacji (aplikacja pokazuje ją przyciemnioną i rozmytą — „za mgłą”).
--  Tła uczniów widzi i może usunąć ich nauczyciel (_is_teacher_of, #75),
--  wszystkie — admin. (Warunek „tylko Premium” sprawdza aplikacja.)
--
--  1) Storage bucket „user-backgrounds” — PRYWATNY (odczyt tylko po zalogowaniu,
--     przez API), max 400 KB, tylko JPEG. Pliki: {user_id}/{id}.jpg (tło)
--     i {user_id}/{id}_t.jpg (miniatura do podglądu i moderacji).
--  2) Tabela user_backgrounds (id, user_id, path, thumb_path, width, height, bytes,
--     created_at). Ścieżki nadaje trigger (nie da się podszyć pod cudzy folder),
--     najwyżej 2 tła na konto (BG_LIMIT; równoczesne dodania czekają na blokadę
--     wiersza profilu). RLS: odczyt i usuwanie — właściciel, jego nauczyciel, admin;
--     dodawanie — tylko właściciel; bez zmian (UPDATE) — tło się usuwa i wgrywa nowe.
--  3) profiles.bg_active — aktywne tło (wczytywane razem z profilem → zero zapytań
--     przy starcie), profiles.bg_removed_at — tło usunął nauczyciel / admin (aplikacja
--     raz o tym powie). Zmienia je tylko baza: RPC set_my_background i trigger usuwania
--     (strażnik profiles_bg_guard jak w #101).
--  4) Kolejka user_bg_purge_queue — pliki usuniętych teł. Aplikacja kasuje pliki przez
--     Storage API (Supabase nie pozwala kasować plików z SQL) i odhacza je
--     (user_bg_purge_done); pliki kont usuniętych w całości sprząta codzienny
--     przebieg admina (user_bg_purge_list — jak zdjęcia profilowe, #62).
--  5) RPC: set_my_background(p_id uuid) → uuid (null = bez tła; NOT_FOUND — nie moje tło),
--     user_bg_purge_list() (admin), user_bg_purge_done(p_paths text[]).
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

-- ── 1. TABELA TEŁ ────────────────────────────────────────────────
create table if not exists public.user_backgrounds (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  path       text not null unique,
  thumb_path text not null unique,
  width      int,
  height     int,
  bytes      int,
  created_at timestamptz not null default now()
);
create index if not exists user_backgrounds_user_idx on public.user_backgrounds(user_id);
alter table public.user_backgrounds enable row level security;

drop policy if exists "ubg: select own teacher admin" on public.user_backgrounds;
create policy "ubg: select own teacher admin" on public.user_backgrounds
  for select to authenticated using (user_id = auth.uid() or public._is_teacher_of(user_id));
drop policy if exists "ubg: insert own" on public.user_backgrounds;
create policy "ubg: insert own" on public.user_backgrounds
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "ubg: delete own teacher admin" on public.user_backgrounds;
create policy "ubg: delete own teacher admin" on public.user_backgrounds
  for delete to authenticated using (user_id = auth.uid() or public._is_teacher_of(user_id));
revoke all on public.user_backgrounds from anon;
grant select, insert, delete on public.user_backgrounds to authenticated;

-- ── 2. KOLEJKA PLIKÓW DO SKASOWANIA ─────────────────────────────
create table if not exists public.user_bg_purge_queue (
  path       text primary key,
  user_id    uuid,
  created_at timestamptz not null default now()
);
alter table public.user_bg_purge_queue enable row level security;
-- Brak polityk — dostęp wyłącznie przez funkcje SECURITY DEFINER poniżej.
revoke all on public.user_bg_purge_queue from anon, authenticated;

-- ── 3. PROFIL: AKTYWNE TŁO + INFORMACJA O USUNIĘCIU ─────────────
alter table public.profiles add column if not exists bg_active uuid;
alter table public.profiles add column if not exists bg_removed_at timestamptz;

create or replace function public._profiles_bg_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.bg_active := null;
      new.bg_removed_at := null;
    else
      new.bg_active := old.bg_active;
      new.bg_removed_at := old.bg_removed_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_bg_guard on public.profiles;
create trigger profiles_bg_guard
  before insert or update of bg_active, bg_removed_at on public.profiles
  for each row execute function public._profiles_bg_guard();

-- ── 4. TRIGGERY TEŁ ──────────────────────────────────────────────
-- Przed dodaniem: ścieżki z user_id i id, limit 2 tła na konto, rozsądne liczby.
create or replace function public._user_bg_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if new.id is null then new.id := gen_random_uuid(); end if;
  new.path       := new.user_id::text || '/' || new.id::text || '.jpg';
  new.thumb_path := new.user_id::text || '/' || new.id::text || '_t.jpg';
  new.created_at := now();
  new.width  := least(greatest(coalesce(new.width, 0), 0), 20000);
  new.height := least(greatest(coalesce(new.height, 0), 0), 20000);
  new.bytes  := least(greatest(coalesce(new.bytes, 0), 0), 10000000);
  perform 1 from public.profiles where id = new.user_id for update;   -- równoczesne dodania po kolei
  select count(*) into n from public.user_backgrounds where user_id = new.user_id;
  if n >= 2 then
    raise exception 'BG_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists user_backgrounds_before_insert on public.user_backgrounds;
create trigger user_backgrounds_before_insert
  before insert on public.user_backgrounds
  for each row execute function public._user_bg_before_insert();

-- Po usunięciu: pliki do kolejki, odpięcie aktywnego tła, informacja dla właściciela,
-- gdy usunął je ktoś inny (nauczyciel / admin).
create or replace function public._user_bg_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_other boolean := auth.uid() is distinct from old.user_id;
begin
  insert into public.user_bg_purge_queue (path, user_id)
  values (old.path, old.user_id), (old.thumb_path, old.user_id)
  on conflict (path) do nothing;
  update public.profiles
     set bg_active     = case when bg_active = old.id then null else bg_active end,
         bg_removed_at = case when v_other then now() else bg_removed_at end
   where id = old.user_id
     and (bg_active = old.id or v_other);
  return old;
end $$;
drop trigger if exists user_backgrounds_after_delete on public.user_backgrounds;
create trigger user_backgrounds_after_delete
  after delete on public.user_backgrounds
  for each row execute function public._user_bg_after_delete();

-- ── 5. RPC ───────────────────────────────────────────────────────
-- Ustaw aktywne tło (null = bez tła). Tylko własne tło.
create or replace function public.set_my_background(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'AUTH' using errcode = '42501';
  end if;
  if p_id is not null and not exists (select 1 from public.user_backgrounds where id = p_id and user_id = v_me) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.profiles set bg_active = p_id where id = v_me;
  return p_id;
end $$;

-- Admin: pliki do skasowania (np. konta usunięte w całości).
create or replace function public.user_bg_purge_list()
returns table(path text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  return query select q.path from public.user_bg_purge_queue q order by q.created_at limit 1000;
end $$;

-- Pliki skasowane przez Storage API → usuń z kolejki. Admin — dowolne; inni — pliki
-- własne albo swoich uczniów. Zwraca liczbę usuniętych wpisów.
create or replace function public.user_bg_purge_done(p_paths text[])
returns int language plpgsql security definer set search_path = public as $$
declare
  v_n int;
begin
  if auth.uid() is null then
    raise exception 'AUTH' using errcode = '42501';
  end if;
  if p_paths is null or cardinality(p_paths) = 0 then return 0; end if;
  delete from public.user_bg_purge_queue q
   where q.path = any(p_paths)
     and (public._is_admin() or q.user_id = auth.uid() or public._is_teacher_of(q.user_id));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 6. STORAGE: PRYWATNY BUCKET + POLITYKI ──────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-backgrounds', 'user-backgrounds', false, 409600, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 409600, allowed_mime_types = array['image/jpeg'];

-- Odczyt: pliki teł widocznych w user_backgrounds (RLS: właściciel / nauczyciel / admin) + admin.
drop policy if exists "ubg_storage_select" on storage.objects;
create policy "ubg_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-backgrounds' and (public._is_admin() or exists (
    select 1 from public.user_backgrounds b
     where b.path = objects.name or b.thumb_path = objects.name)));
-- Wgrywanie: tylko pliki własnego, już dodanego wiersza (ścieżki z triggera).
drop policy if exists "ubg_storage_insert" on storage.objects;
create policy "ubg_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-backgrounds' and exists (
    select 1 from public.user_backgrounds b
     where b.user_id = auth.uid() and (b.path = objects.name or b.thumb_path = objects.name)));
-- Usuwanie: właściciel, jego nauczyciel, admin (także pliki z kolejki po usuniętych kontach).
drop policy if exists "ubg_storage_delete" on storage.objects;
create policy "ubg_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-backgrounds' and (public._is_admin() or exists (
    select 1 from public.user_backgrounds b
     where (b.path = objects.name or b.thumb_path = objects.name)
       and (b.user_id = auth.uid() or public._is_teacher_of(b.user_id)))));

-- ── 7. UPRAWNIENIA (zasady z #84) ───────────────────────────────
revoke all on function public._profiles_bg_guard()      from public, anon, authenticated;
revoke all on function public._user_bg_before_insert()  from public, anon, authenticated;
revoke all on function public._user_bg_after_delete()   from public, anon, authenticated;
revoke all on function public.set_my_background(uuid)   from public, anon;
revoke all on function public.user_bg_purge_list()      from public, anon;
revoke all on function public.user_bg_purge_done(text[]) from public, anon;
grant execute on function public.set_my_background(uuid)    to authenticated;
grant execute on function public.user_bg_purge_list()       to authenticated;
grant execute on function public.user_bg_purge_done(text[]) to authenticated;

select 'OK — migracja #103 (🖼️ własne tło użytkownika) gotowa' as status;
