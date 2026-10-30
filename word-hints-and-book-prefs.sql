-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — wskazówki do fiszek + podręczniki „Uczę się / Nie zapisuj”
--  Migracja #86 · idempotentna
--
--  1) word_hints — wskazówka pod zdaniem z luką w Fiszkach i we Wpisz,
--     np. „u... t... n...” (na karcie: [Wskazówka: u... t... n...] + 🔊).
--     Wpisuje ją twórca podręcznika: admin — każdy podręcznik,
--     nauczyciel — tylko własny (helper _can_edit_book_content z #77).
--     Odczyt publiczny (także goście). Klucz jak w word_sentences: (book_id, word_pl).
--
--  2) profiles.book_prefs — {"ignored": [book_id…], "learning": [book_id…]}
--     dla admina / nauczyciela:
--       ignored  — podręczniki przerabiane na lekcji: nauka się nie zapisuje
--                  i nie pokazuje w statystykach, powtórkach i trudnych słowach,
--       learning — „📌 Uczę się”: na wierzchu ekranu startowego i statystyk.
--     Własny wiersz profiles — RLS bez zmian (trigger profiles_guard z #74
--     nie blokuje tej kolumny).
--
--  Wymaga: #20 (_is_admin/_is_teacher), #77 (_can_edit_book_content).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Wskazówki ────────────────────────────────────────────────
create table if not exists public.word_hints (
  book_id    text        not null,
  word_pl    text        not null,
  hint       text        not null check (char_length(hint) between 1 and 200),
  updated_by uuid        default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (book_id, word_pl)
);

alter table public.word_hints enable row level security;

drop policy if exists "word_hints: read" on public.word_hints;
create policy "word_hints: read" on public.word_hints for select using (true);

drop policy if exists "word_hints: write own book" on public.word_hints;
create policy "word_hints: write own book" on public.word_hints for all
  using (public._can_edit_book_content(book_id))
  with check (public._can_edit_book_content(book_id));

grant select on public.word_hints to anon, authenticated;
grant insert, update, delete on public.word_hints to authenticated;

-- ── 2. Ustawienia podręczników (admin / nauczyciel) ─────────────
alter table public.profiles add column if not exists book_prefs jsonb not null default '{}'::jsonb;

alter table public.profiles drop constraint if exists profiles_book_prefs_check;
alter table public.profiles add constraint profiles_book_prefs_check
  check (jsonb_typeof(book_prefs) = 'object' and pg_column_size(book_prefs) < 16000);

-- Kontrola: obie części powinny zwrócić true
select
  to_regclass('public.word_hints') is not null                                    as word_hints_ok,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'profiles' and column_name = 'book_prefs') as book_prefs_ok;
