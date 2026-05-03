-- ═══════════════════════════════════════════════════════════
-- ADMIN_BOOKS — rozszerzenie CHECK language o 'ru' (migracja #31)
-- ═══════════════════════════════════════════════════════════
-- Wraz z dodaniem rosyjskiego do listy języków w UI (sLang),
-- rozszerzamy CHECK constraint w tabeli admin_books, żeby admin
-- mógł tworzyć podręczniki rosyjskie przez panel „Nowy podręcznik".
--
-- Migracja #29 miała: ('en','fr','de','es','it')
-- Po tej migracji: ('en','fr','de','ru','es','it')
--
-- Idempotentna — można uruchomić ponownie.

DO $$
BEGIN
  -- Drop old constraint if exists, then add wider one
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_books_language_check'
  ) THEN
    ALTER TABLE public.admin_books DROP CONSTRAINT admin_books_language_check;
  END IF;

  ALTER TABLE public.admin_books
    ADD CONSTRAINT admin_books_language_check
    CHECK (language IS NULL OR language IN ('en','fr','de','ru','es','it'));
END $$;

SELECT 'OK — admin_books CHECK language rozszerzone o ''ru''' AS status;
