-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — ZDJĘCIE / GRAFIKA PROFILOWA
--  Migracja #62 · idempotentna
--
--  1) profiles.avatar_url / avatar_path / avatar_updated_at + last_seen_at
--     (ostatnie wejście na sowiefiszki — klient „dotyka" raz na kilka godzin).
--  2) Storage bucket „avatars" (publiczny odczyt, max 300 KB, tylko obrazy).
--     Uczeń zapisuje TYLKO do swojego folderu {user_id}/…; admin / nauczyciel
--     (twórca konta lub właściciel klasy ucznia) może zdjęcie usunąć.
--  3) Automatyczne usuwanie:
--     • usunięcie konta (admin_delete_user, delete_own_account, auto-delete,
--       usunięcie w panelu Supabase) → trigger wrzuca plik do kolejki
--       avatar_purge_queue, a klient od razu kasuje plik przez Storage API;
--     • brak wejścia na sowiefiszki > 2 miesiące → zdjęcie odpinane
--       z profilu (codziennie: pg_cron jeśli włączony + przy logowaniu admina),
--       plik kasowany z bucketa przy codziennym przebiegu admina.
--     (Supabase nie pozwala kasować plików Storage bezpośrednio z SQL —
--      dlatego pliki usuwa klient admina przez Storage API na podstawie kolejki.)
--  4) class_avatars() — zdjęcia kolegów z klasy (ranking, rywalizacja).
--
--  Wymaga: #13 (created_by), #20 (_is_admin/_is_teacher), #60 (class_ranking_links).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. KOLUMNY ───────────────────────────────────────────────────
alter table public.profiles add column if not exists avatar_url        text;
alter table public.profiles add column if not exists avatar_path       text;
alter table public.profiles add column if not exists avatar_updated_at timestamptz;
alter table public.profiles add column if not exists last_seen_at      timestamptz;

-- ── 2. KOLEJKA PLIKÓW DO SKASOWANIA ─────────────────────────────
create table if not exists public.avatar_purge_queue (
  path       text primary key,
  user_id    uuid,
  reason     text,                 -- 'deleted' | 'replaced' | 'inactive' | 'removed'
  created_at timestamptz not null default now()
);
alter table public.avatar_purge_queue enable row level security;
-- Brak polityk — dostęp wyłącznie przez funkcje SECURITY DEFINER poniżej.

-- Trigger: stary plik trafia do kolejki, gdy zdjęcie jest zmieniane / usuwane / konto kasowane.
create or replace function public._avatar_queue_old()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.avatar_path is not null then
      insert into public.avatar_purge_queue (path, user_id, reason)
      values (old.avatar_path, old.id, 'deleted') on conflict (path) do nothing;
    end if;
    return old;
  end if;
  if old.avatar_path is not null and old.avatar_path is distinct from new.avatar_path then
    insert into public.avatar_purge_queue (path, user_id, reason)
    values (old.avatar_path, old.id, case when new.avatar_path is null then 'removed' else 'replaced' end)
    on conflict (path) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_avatar_queue_upd on public.profiles;
create trigger profiles_avatar_queue_upd
  after update of avatar_path on public.profiles
  for each row execute function public._avatar_queue_old();

drop trigger if exists profiles_avatar_queue_del on public.profiles;
create trigger profiles_avatar_queue_del
  after delete on public.profiles
  for each row execute function public._avatar_queue_old();

-- ── 3. STORAGE ───────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 307200, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 307200, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Czy zalogowany może moderować użytkownika (admin / nauczyciel twórca konta lub właściciel jego klasy).
-- (ta sama definicja co w #61 — powtórzona, żeby migracja była samodzielna)
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

-- Czy zalogowany może skasować plik z folderu {user_id}/… (nazwa obiektu w bucket).
create or replace function public._can_delete_avatar_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  if auth.uid() is null then return false; end if;
  if public._is_admin() then return true; end if;
  begin
    v_owner := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return v_owner = auth.uid() or public._can_moderate_user(v_owner);
end;
$$;

drop policy if exists "avatars_select_all" on storage.objects;
create policy "avatars_select_all" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "avatars_delete_own_or_mod" on storage.objects;
create policy "avatars_delete_own_or_mod" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and public._can_delete_avatar_object(name));

-- ── 4. RPC ───────────────────────────────────────────────────────
-- Ostatnie wejście na sowiefiszki (klient woła przy starcie; zapis max co 6 h).
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '6 hours');
$$;

-- Ustawienie własnego zdjęcia (plik musi leżeć w folderze użytkownika). Pusta ścieżka = usuń.
create or replace function public.set_my_avatar(p_url text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_path is not null and split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'Nieprawidłowa ścieżka pliku.';
  end if;
  update public.profiles
     set avatar_url = nullif(p_url, ''),
         avatar_path = nullif(p_path, ''),
         avatar_updated_at = case when nullif(p_path, '') is null then null else now() end,
         last_seen_at = now()
   where id = auth.uid();
end;
$$;

-- Usunięcie zdjęcia: własne albo przez admina / nauczyciela (np. nieodpowiednie).
-- Zwraca ścieżkę pliku, żeby klient od razu skasował go ze Storage.
create or replace function public.clear_user_avatar(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_path text;
begin
  if auth.uid() is null then raise exception 'Musisz być zalogowany.'; end if;
  if p_user <> auth.uid() and not public._can_moderate_user(p_user) then
    raise exception 'Brak uprawnień do usunięcia zdjęcia tego użytkownika.';
  end if;
  select avatar_path into v_path from public.profiles where id = p_user;
  update public.profiles set avatar_url = null, avatar_path = null, avatar_updated_at = null where id = p_user;
  return v_path;
end;
$$;

-- Bezpieczna zamiana tekstu na datę (last_study_date to tekst, np. „Wed Oct 08 2026”).
create or replace function public._safe_ts(p text)
returns timestamptz
language plpgsql
stable
as $$
begin
  if p is null or btrim(p) = '' then return null; end if;
  return p::timestamptz;
exception when others then
  return null;
end;
$$;

-- Odpięcie zdjęć użytkowników nieaktywnych > 2 miesiące (bez admina).
-- Aktywność = najpóźniejsze z: wejście (last_seen_at), logowanie, nauka, wgranie zdjęcia.
create or replace function public._avatar_mark_inactive()
returns int
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_n int;
begin
  create temporary table if not exists _avatar_inactive (id uuid primary key, path text) on commit drop;
  delete from _avatar_inactive;
  insert into _avatar_inactive (id, path)
  select p.id, p.avatar_path
    from public.profiles p
    left join auth.users u on u.id = p.id
   where p.avatar_path is not null
     and coalesce(p.is_admin, false) = false
     and greatest(
           coalesce(p.last_seen_at,                       'epoch'::timestamptz),
           coalesce(u.last_sign_in_at,                    'epoch'::timestamptz),
           coalesce(public._safe_ts(p.last_study_date::text),'epoch'::timestamptz),
           coalesce(p.avatar_updated_at,                  'epoch'::timestamptz)
         ) < now() - interval '2 months';
  -- najpierw do kolejki z powodem „inactive” (trigger przy UPDATE nie nadpisze — on conflict do nothing)
  insert into public.avatar_purge_queue (path, user_id, reason)
  select path, id, 'inactive' from _avatar_inactive
  on conflict (path) do update set reason = 'inactive';
  update public.profiles p
     set avatar_url = null, avatar_path = null, avatar_updated_at = null
   where p.id in (select id from _avatar_inactive);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public._avatar_mark_inactive() from public, anon, authenticated;

-- Admin: odepnij zdjęcia nieaktywnych i pobierz listę plików do skasowania ze Storage.
create or replace function public.avatar_purge_list()
returns table (path text, reason text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public._is_admin() then raise exception 'Tylko administrator.'; end if;
  perform public._avatar_mark_inactive();
  return query select q.path, q.reason from public.avatar_purge_queue q order by q.created_at limit 1000;
end;
$$;

-- Po skasowaniu plików przez Storage API: usunięcie wpisów z kolejki.
-- Admin — dowolne; użytkownik/moderator — tylko pliki, które sam mógł skasować.
create or replace function public.avatar_purge_done(p_paths text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  delete from public.avatar_purge_queue q
   where q.path = any(p_paths)
     and (public._is_admin() or public._can_delete_avatar_object(q.path));
end;
$$;

-- Zdjęcia kolegów z klas zalogowanego (+ klas powiązanych rankingiem #60).
create or replace function public.class_avatars()
returns table (user_id uuid, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  with my_classes as (
    select class_id from public.class_members where user_id = auth.uid()
  ), pool as (
    select class_id from my_classes
    union
    select l.linked_class_id from public.class_ranking_links l where l.class_id in (select class_id from my_classes)
  )
  select distinct p.id, p.avatar_url
    from public.class_members m
    join public.profiles p on p.id = m.user_id
   where m.class_id in (select class_id from pool)
     and p.avatar_url is not null;
$$;

grant execute on function public.touch_last_seen()                to authenticated;
grant execute on function public.set_my_avatar(text, text)        to authenticated;
grant execute on function public.clear_user_avatar(uuid)          to authenticated;
grant execute on function public.avatar_purge_list()              to authenticated;
grant execute on function public.avatar_purge_done(text[])        to authenticated;
grant execute on function public.class_avatars()                  to authenticated;

-- ── 5. CODZIENNY PRZEBIEG W BAZIE (jeśli włączone rozszerzenie pg_cron) ──
-- Odpina zdjęcia nieaktywnych o 3:15 każdej nocy (pliki kasuje potem przebieg admina).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('sowie-avatar-inactive');
    exception when others then null;
    end;
    perform cron.schedule('sowie-avatar-inactive', '15 3 * * *', 'select public._avatar_mark_inactive()');
  end if;
end;
$$;

-- Startowo: ostatnie wejście = ostatnia nauka (żeby nikt nie był od razu „nieaktywny”).
update public.profiles
   set last_seen_at = coalesce(public._safe_ts(last_study_date::text), created_at, now())
 where last_seen_at is null;

select 'OK — zdjęcia profilowe (bucket avatars + kolejka czyszczenia) gotowe' as status;
