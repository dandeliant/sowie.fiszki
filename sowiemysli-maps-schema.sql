-- ============================================================
--  SOWIE MYSLI — mapy mysli w chmurze (prywatny link)
--  Migracja #56
--
--  Model dostepu (identyczny jak NoteSownik #55):
--   * odczyt PUBLICZNY tylko po dokladnym, sekretnym slugu
--     (funkcja SECURITY DEFINER sowiemysli_get_map) — bez enumeracji,
--   * zapis / edycja / kasowanie: TYLKO wlasciciel (owner_id = auth.uid()),
--   * wlasciciel widzi wlasne mapy na pulpicie (SELECT wlasnych).
--
--  Uprawnienia do TWORZENIA (kto moze byc wlascicielem) sa dodatkowo
--  egzekwowane po stronie klienta: Admin lub Nauczyciel z Premium.
--
--  Idempotentna — mozna uruchamiac wielokrotnie.
-- ============================================================

create table if not exists public.sowiemysli_maps (
  slug        text primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists sowiemysli_maps_owner_idx
  on public.sowiemysli_maps (owner_id);

alter table public.sowiemysli_maps enable row level security;

drop policy if exists "sowiemysli_select_own" on public.sowiemysli_maps;
create policy "sowiemysli_select_own" on public.sowiemysli_maps
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "sowiemysli_insert_own" on public.sowiemysli_maps;
create policy "sowiemysli_insert_own" on public.sowiemysli_maps
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "sowiemysli_update_own" on public.sowiemysli_maps;
create policy "sowiemysli_update_own" on public.sowiemysli_maps
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "sowiemysli_delete_own" on public.sowiemysli_maps;
create policy "sowiemysli_delete_own" on public.sowiemysli_maps
  for delete to authenticated
  using (owner_id = auth.uid());

-- Publiczny odczyt PO SLUGU (sekretny link). SECURITY DEFINER omija RLS,
-- ale zwraca WYLACZNIE wiersz o podanym slugu — brak enumeracji.
create or replace function public.sowiemysli_get_map(p_slug text)
returns public.sowiemysli_maps
language sql
security definer
set search_path = public
as $$
  select * from public.sowiemysli_maps where slug = p_slug;
$$;

grant execute on function public.sowiemysli_get_map(text) to anon, authenticated;
grant select, insert, update, delete on public.sowiemysli_maps to authenticated;
