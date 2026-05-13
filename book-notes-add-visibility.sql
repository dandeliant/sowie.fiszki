-- ═══════════════════════════════════════════════════════════════
--  MIGRACJA #39: book_notes.visibility
--  Dwie kategorie notatek per (podręcznik, unit):
--    'public'  → widoczna dla wszystkich (uczeń, gość, nauczyciel, opiekun, admin)
--    'private' → tylko admin + nauczyciel/opiekun z Premium
--
--  Istniejące notatki dostają wartość 'public' — uczeń od razu zobaczy
--  treści, które były dotąd ukryte za Premium-gate w UI.
--
--  Po migracji: stary UNIQUE(book_id, unit_key) ustępuje miejsca
--  UNIQUE(book_id, unit_key, visibility), tak by możliwa była
--  równolegle publiczna + prywatna notatka per to samo miejsce.
--
--  Idempotentna — można uruchomić wielokrotnie.
-- ═══════════════════════════════════════════════════════════════

-- 1. Dodaj kolumnę visibility (idempotentnie)
ALTER TABLE public.book_notes
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';

-- 2. CHECK constraint na dozwolone wartości
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'book_notes'
      AND constraint_name = 'book_notes_visibility_check'
  ) THEN
    ALTER TABLE public.book_notes
      ADD CONSTRAINT book_notes_visibility_check
      CHECK (visibility IN ('public','private'));
  END IF;
END$$;

-- 3. Backfill: wszystkie istniejące notatki dostają 'public'
UPDATE public.book_notes SET visibility = 'public' WHERE visibility IS NULL;

-- 4. Zamień UNIQUE(book_id, unit_key) na UNIQUE(book_id, unit_key, visibility)
DO $$
DECLARE
  old_constraint TEXT;
BEGIN
  SELECT conname INTO old_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.book_notes'::regclass
    AND contype  = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(book_id, unit_key)%'
    AND pg_get_constraintdef(oid) NOT ILIKE '%visibility%';
  IF old_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.book_notes DROP CONSTRAINT %I', old_constraint);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.book_notes'::regclass
      AND contype  = 'u'
      AND pg_get_constraintdef(oid) ILIKE '%book_id, unit_key, visibility%'
  ) THEN
    ALTER TABLE public.book_notes
      ADD CONSTRAINT book_notes_book_unit_vis_key UNIQUE (book_id, unit_key, visibility);
  END IF;
END$$;

-- 5. Zaktualizuj index lookup (dodaj visibility)
DROP INDEX IF EXISTS idx_book_notes_lookup;
CREATE INDEX IF NOT EXISTS idx_book_notes_lookup
  ON public.book_notes (book_id, unit_key, visibility);

-- Polityki RLS bez zmian — nadal każdy może SELECT (filtr po visibility
-- robi klient). Tylko admin może INSERT/UPDATE/DELETE — to też bez zmian
-- z migracji bazowej book-notes-schema.sql.

SELECT 'OK — book_notes.visibility gotowe (default public, UNIQUE per book+unit+visibility)' AS status;
