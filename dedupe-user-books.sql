-- ═══════════════════════════════════════════════════════════
-- DEDUPLIKACJA user_books + UNIQUE(user_id, book_id)
-- ═══════════════════════════════════════════════════════════
-- Naprawia problem: uczniowie widzieli duplikaty tych samych podrecznikow
-- w sekcji "Twoje podreczniki" (np. Brainy 6 pokazywal sie dwa razy).
-- Powod: brak UNIQUE constraint na (user_id, book_id) — przez co kolejne
-- przydzielenia tego samego podrecznika tworzyly nowe wiersze zamiast
-- byc no-opem.
--
-- Co robi:
--   1. Usuwa zduplikowane wiersze (zostawia najstarszy per pare user+book)
--   2. Dodaje UNIQUE constraint na (user_id, book_id)
--
-- Idempotentna — bezpieczna do ponownego uruchomienia.
-- Wymaga wczesniejszego uruchomienia: supabase-schema.sql,
-- fix-rls-and-user-books.sql.

BEGIN;

-- 1) Usun duplikaty: zostaw jeden wiersz per (user_id, book_id).
-- Tabela user_books nie ma kolumny created_at, wiec sortujemy wg ctid
-- (fizyczna lokalizacja wiersza — deterministyczne). Wybor "ktorego
-- duplikatu zachowac" nie ma znaczenia funkcjonalnego: wiersze roznia
-- sie tylko wartoscia user_id+book_id (reszta identyczna).
DELETE FROM public.user_books ub
USING (
  SELECT ctid,
         ROW_NUMBER() OVER (PARTITION BY user_id, book_id ORDER BY ctid) AS rn
  FROM public.user_books
) d
WHERE ub.ctid = d.ctid AND d.rn > 1;

-- 2) Dodaj UNIQUE constraint jesli jeszcze nie istnieje.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_books'::regclass
      AND conname  = 'user_books_user_book_unique'
  ) THEN
    ALTER TABLE public.user_books
      ADD CONSTRAINT user_books_user_book_unique UNIQUE (user_id, book_id);
  END IF;
END $$;

COMMIT;

-- Informacja zwrotna — ile wierszy zostalo (zero duplikatow)
SELECT 'OK — duplikaty usuniete, UNIQUE(user_id, book_id) aktywne' AS status,
       (SELECT COUNT(*) FROM public.user_books) AS total_rows;
