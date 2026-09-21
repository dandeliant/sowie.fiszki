-- ============================================================
--  NOTESOWNIK — tablice w chmurze (prywatny link)
--  Migracja #55
--
--  Model dostepu:
--   * odczyt PUBLICZNY tylko po dokladnym, sekretnym slugu
--     (funkcja SECURITY DEFINER notesownik_get_board) — bez mozliwosci
--     wylistowania cudzych tablic (anon NIE ma bezposredniego SELECT),
--   * zapis / edycja / kasowanie: TYLKO wlasciciel (owner_id = auth.uid()),
--   * wlasciciel widzi wlasne tablice na pulpicie (SELECT wlasnych).
--
--  Idempotentna — mozna uruchamiac wielokrotnie.
-- ============================================================

create table if not exists public.notesownik_boards (
  slug        text primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notesownik_boards_owner_idx
  on public.notesownik_boards (owner_id);

alter table public.notesownik_boards enable row level security;

-- SELECT: wlasciciel widzi wlasne tablice (pulpit, multi-device).
drop policy if exists "notesownik_select_own" on public.notesownik_boards;
create policy "notesownik_select_own" on public.notesownik_boards
  for select to authenticated
  using (owner_id = auth.uid());

-- INSERT: zalogowany, jako wlasciciel.
drop policy if exists "notesownik_insert_own" on public.notesownik_boards;
create policy "notesownik_insert_own" on public.notesownik_boards
  for insert to authenticated
  with check (owner_id = auth.uid());

-- UPDATE: tylko wlasciciel.
drop policy if exists "notesownik_update_own" on public.notesownik_boards;
create policy "notesownik_update_own" on public.notesownik_boards
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- DELETE: tylko wlasciciel.
drop policy if exists "notesownik_delete_own" on public.notesownik_boards;
create policy "notesownik_delete_own" on public.notesownik_boards
  for delete to authenticated
  using (owner_id = auth.uid());

-- Publiczny odczyt PO SLUGU (sekretny link). SECURITY DEFINER omija RLS,
-- ale zwraca WYLACZNIE wiersz o podanym slugu — brak enumeracji.
create or replace function public.notesownik_get_board(p_slug text)
returns public.notesownik_boards
language sql
security definer
set search_path = public
as $$
  select * from public.notesownik_boards where slug = p_slug;
$$;

grant execute on function public.notesownik_get_board(text) to anon, authenticated;
grant select, insert, update, delete on public.notesownik_boards to authenticated;
