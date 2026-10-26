-- ═══════════════════════════════════════════════════════════════
--  Migracja #81 — wypowiedzi pupila edytowane przez administratora
-- ═══════════════════════════════════════════════════════════════
--  pet_phrases: jedna lista zwrotów na kategorię (greet, hungry, sleep…),
--  items = [["English", "polskie tłumaczenie"], …]. Wiersz zastępuje domyślną
--  listę z app.html (PH); brak wiersza = zwroty domyślne.
--  • odczyt — wszyscy (także gość: anon), bo pupil mówi u każdego ucznia
--  • zapis i usuwanie — tylko administrator (RLS + _is_admin z #20)
--  Wymaga: #20. Idempotentna.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.pet_phrases (
  cat         text primary key check (cat ~ '^[a-z]{2,20}$'),
  items       jsonb not null check (
                jsonb_typeof(items) = 'array'
                and jsonb_array_length(items) between 1 and 80
                and pg_column_size(items) < 30000),
  updated_by  uuid default auth.uid() references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.pet_phrases enable row level security;
drop policy if exists "pet_phrases: read all"     on public.pet_phrases;
drop policy if exists "pet_phrases: admin insert" on public.pet_phrases;
drop policy if exists "pet_phrases: admin update" on public.pet_phrases;
drop policy if exists "pet_phrases: admin delete" on public.pet_phrases;
create policy "pet_phrases: read all"     on public.pet_phrases for select using (true);
create policy "pet_phrases: admin insert" on public.pet_phrases for insert with check (public._is_admin());
create policy "pet_phrases: admin update" on public.pet_phrases for update using (public._is_admin()) with check (public._is_admin());
create policy "pet_phrases: admin delete" on public.pet_phrases for delete using (public._is_admin());

grant select on public.pet_phrases to anon, authenticated;
grant insert, update, delete on public.pet_phrases to authenticated;

-- kto i kiedy zmienił — zawsze bieżący administrator i bieżący czas
create or replace function public._pet_phrases_stamp()
returns trigger language plpgsql as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists pet_phrases_stamp on public.pet_phrases;
create trigger pet_phrases_stamp before insert or update on public.pet_phrases
  for each row execute function public._pet_phrases_stamp();
