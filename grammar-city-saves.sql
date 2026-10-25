-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — GRAMMAR CITY: ZAPIS GRY NA SERWERZE
--  Migracja #72 · idempotentna
--
--  Do tej pory Grammar City zapisywało się tylko w przeglądarce
--  (localStorage) — na innym urządzeniu gra zaczynała się od zera,
--  a na wspólnym komputerze uczniowie dzielili jeden zapis.
--
--  Jeden wiersz = jeden „slot” zapisu konta:
--    'shared'               — wspólne dla wszystkich trybów i rozdziałów:
--                             pieniądze, XP, diamenty, odkrycia (zwierzęta,
--                             urbex, ryby, grzyby), garderoba, pojazdy,
--                             paliwo, kolory i ustawienia
--    'grammar'              — zaliczone misje gry ogólnej (gramatyka)
--    'vocab.<book>.<unit>'  — zaliczone misje trybu słówek danego rozdziału
--  data = JSON z polem ts (czas zmiany; przy starcie gry wygrywa nowszy zapis).
--
--  RLS: każdy czyta i zapisuje tylko swoje wiersze (admin może czytać).
--  Konto usunięte → wiersze znikają (on delete cascade).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.grammar_city_saves (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slot       text not null check (char_length(slot) between 1 and 120),
  data       jsonb not null check (octet_length(data::text) < 300000),
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.grammar_city_saves enable row level security;

drop policy if exists "gc_saves: read own"   on public.grammar_city_saves;
drop policy if exists "gc_saves: insert own" on public.grammar_city_saves;
drop policy if exists "gc_saves: update own" on public.grammar_city_saves;
drop policy if exists "gc_saves: delete own" on public.grammar_city_saves;

create policy "gc_saves: read own"   on public.grammar_city_saves for select using (user_id = auth.uid() or public._is_admin());
create policy "gc_saves: insert own" on public.grammar_city_saves for insert with check (user_id = auth.uid());
create policy "gc_saves: update own" on public.grammar_city_saves for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gc_saves: delete own" on public.grammar_city_saves for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.grammar_city_saves to authenticated;

select 'OK — zapis Grammar City na serwerze gotowy' as status;
