-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — 📒 KOREPETYCJE (TutorFlow) NA KONCIE NAUCZYCIELA
--  Migracja #104 · idempotentna (można uruchomić ponownie) · 24.11.2026, SW v1.273
--
--  korepetycje.html — narzędzie dla nauczyciela z Premium i admina do prowadzenia
--  własnych korepetycji (uczniowie, zajęcia, płatności, pakiety, wydatki, zadania,
--  notatki, materiały, cele, prace domowe + ustawienia). TutorFlow zapisuje cały stan
--  naraz, więc w bazie jest JEDEN dokument JSON na konto, z numerem wersji — dzięki
--  niemu dwa urządzenia nie nadpiszą sobie danych po cichu.
--
--  1) tutoring_data (user_id PK → auth.users, kaskadowo; data jsonb; version int;
--     updated_at) — RLS: odczyt tylko własnego wiersza; zapis wyłącznie przez RPC.
--  2) tutoring_load() → (o_data, o_version, o_updated_at) — własny wiersz (brak = brak wierszy).
--  3) tutoring_save(p_data jsonb, p_version int, p_force boolean) →
--     (o_version, o_conflict, o_updated_at): admin albo nauczyciel (NOT_ALLOWED), obiekt
--     JSON (BAD_DATA), najwyżej 5 MB (TOO_BIG). Zapis tylko wtedy, gdy p_version = wersja
--     w bazie — inaczej o_conflict = true i nic się nie zmienia (dane zmieniono na innym
--     urządzeniu); p_force = true nadpisuje. Nowa wersja = poprzednia + 1.
--  4) tutoring_clear() — usuwa własny wiersz („Usuń wszystkie dane” w aplikacji).
--  Usunięcie konta → wiersz znika (cascade). Warunek „Premium” sprawdza aplikacja.
--
--  Wymaga: #20 (_is_admin, _is_teacher).
--  Uruchom w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. TABELA ────────────────────────────────────────────────────
create table if not exists public.tutoring_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  version    int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.tutoring_data enable row level security;
drop policy if exists "tutoring: select own" on public.tutoring_data;
create policy "tutoring: select own" on public.tutoring_data
  for select to authenticated using (user_id = auth.uid());
revoke all on public.tutoring_data from anon;
revoke insert, update, delete on public.tutoring_data from authenticated;
grant select on public.tutoring_data to authenticated;

-- ── 2. ODCZYT ────────────────────────────────────────────────────
create or replace function public.tutoring_load()
returns table(o_data jsonb, o_version int, o_updated_at timestamptz)
language plpgsql security definer stable set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH' using errcode = '42501';
  end if;
  return query
    select t.data, t.version, t.updated_at from public.tutoring_data t where t.user_id = auth.uid();
end $$;

-- ── 3. ZAPIS Z WERSJĄ ────────────────────────────────────────────
create or replace function public.tutoring_save(p_data jsonb, p_version int, p_force boolean default false)
returns table(o_version int, o_conflict boolean, o_updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_me  uuid := auth.uid();
  v_cur int;
  v_at  timestamptz;
begin
  if v_me is null then
    raise exception 'AUTH' using errcode = '42501';
  end if;
  if not (public._is_admin() or public._is_teacher()) then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'BAD_DATA' using errcode = '22023';
  end if;
  if octet_length(p_data::text) > 5000000 then
    raise exception 'TOO_BIG' using errcode = '22023';
  end if;

  select t.version, t.updated_at into v_cur, v_at
    from public.tutoring_data t where t.user_id = v_me for update;

  if found then
    if not coalesce(p_force, false) and v_cur is distinct from coalesce(p_version, 0) then
      return query select v_cur, true, v_at;   -- zmienione na innym urządzeniu
      return;
    end if;
    update public.tutoring_data t
       set data = p_data, version = v_cur + 1, updated_at = now()
     where t.user_id = v_me
    returning t.version, t.updated_at into v_cur, v_at;
  else
    -- brak wiersza, a urządzenie znało wersję > 0 → dane usunięto na innym urządzeniu
    if not coalesce(p_force, false) and coalesce(p_version, 0) <> 0 then
      return query select 0, true, null::timestamptz;
      return;
    end if;
    insert into public.tutoring_data as t (user_id, data, version, updated_at)
    values (v_me, p_data, 1, now())
    on conflict (user_id) do nothing
    returning t.version, t.updated_at into v_cur, v_at;
    if v_cur is null then   -- równoczesny pierwszy zapis z innego urządzenia
      select t.version, t.updated_at into v_cur, v_at from public.tutoring_data t where t.user_id = v_me;
      return query select v_cur, true, v_at;
      return;
    end if;
  end if;
  return query select v_cur, false, v_at;
end $$;

-- ── 4. USUNIĘCIE WSZYSTKICH DANYCH ───────────────────────────────
create or replace function public.tutoring_clear()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if auth.uid() is null then
    raise exception 'AUTH' using errcode = '42501';
  end if;
  delete from public.tutoring_data t where t.user_id = auth.uid();
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 5. UPRAWNIENIA (zasady z #84) ───────────────────────────────
revoke all on function public.tutoring_load()                     from public, anon;
revoke all on function public.tutoring_save(jsonb, int, boolean)  from public, anon;
revoke all on function public.tutoring_clear()                    from public, anon;
grant execute on function public.tutoring_load()                    to authenticated;
grant execute on function public.tutoring_save(jsonb, int, boolean) to authenticated;
grant execute on function public.tutoring_clear()                   to authenticated;

select 'OK — migracja #104 (📒 Korepetycje na koncie nauczyciela) gotowa' as status;
