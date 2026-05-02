-- ═══════════════════════════════════════════════════════════
-- ADMIN_BOOKS — meta-dane kategorii i języka (migracja #29)
-- ═══════════════════════════════════════════════════════════
-- Po restrukturyzacji ekranu wyboru poziomu (sSchool: Podstawowa /
-- Średnia / Kursy tematyczne / Gramatyka i dodatki, commit 104fc74),
-- filtr w refreshBooks używa pól `language` i `schoolType` na obiekcie
-- BOOKS. Tabela `admin_books` (podręczniki dodane przez panel admina)
-- nie ma tych kolumn — przez co wszystkie podręczniki dodane przez
-- modal „📚 Nowy podręcznik" są niewidoczne we wszystkich 4 kafelkach.
--
-- Ta migracja:
--  1. Dodaje kolumny `school_type`, `language`, `grade` (idempotentnie)
--  2. Wypełnia istniejące wiersze rozsądnymi defaultami:
--       school_type='courses' (Kursy tematyczne — bez klas)
--       language='en'         (angielski — domyślnie)
--  3. Po migracji + deploy'u nowego kodu, wszystkie istniejące
--     admin-added books pojawią się w kafelku „💼 Kursy tematyczne".
--     Admin może je przesunąć do innej kategorii przez UI „✏️ Edytuj".
--
-- Idempotentna — można uruchomić ponownie.

ALTER TABLE public.admin_books
  ADD COLUMN IF NOT EXISTS school_type TEXT,
  ADD COLUMN IF NOT EXISTS language    TEXT,
  ADD COLUMN IF NOT EXISTS grade       INTEGER;

-- CHECK constraint dla school_type — pasuje do _NO_GRADE_SCHOOL_TYPES
-- z app.html + szkoły z klasami. 'other' zachowane dla wstecznej
-- kompatybilności (legacy z poprzedniej wersji modala).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_books_school_type_check'
  ) THEN
    ALTER TABLE public.admin_books
      ADD CONSTRAINT admin_books_school_type_check
      CHECK (school_type IS NULL OR school_type IN ('primary','secondary','courses','grammar','other'));
  END IF;
END $$;

-- CHECK constraint dla language — angielski/francuski (rozszerzalne)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_books_language_check'
  ) THEN
    ALTER TABLE public.admin_books
      ADD CONSTRAINT admin_books_language_check
      CHECK (language IS NULL OR language IN ('en','fr','de','es','it'));
  END IF;
END $$;

-- Wypełnij istniejące wiersze defaultami (bezpieczne — tylko gdy NULL)
UPDATE public.admin_books
   SET school_type = 'courses'
 WHERE school_type IS NULL;

UPDATE public.admin_books
   SET language = 'en'
 WHERE language IS NULL;

-- Po update wszystkie istniejące podręczniki (np. „Konkursy (advanced)",
-- „Angielski MW") sa w „💼 Kursy tematyczne" + język angielski.
-- Admin moze je później przeniesc przez UI „✏️ Edytuj podrecznik".

SELECT
  'OK — admin_books wzbogacone o school_type, language, grade. Wierszy zaktualizowanych: '
  || COUNT(*)::text AS status
FROM public.admin_books
WHERE school_type IS NOT NULL OR language IS NOT NULL;
