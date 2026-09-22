-- ═══════════════════════════════════════════════════════════
-- SLOWNIK OBRAZKOWY (dictionary_words) — migracja #57
-- ═══════════════════════════════════════════════════════════
-- Interaktywny slowniczek obrazkowy (flip-book) generowany
-- automatycznie z listy slowek podrecznika. Admin/nauczyciel
-- dodaje per slowko:
--   - obrazek (upload do Storage bucket „dict-images")
--   - link do wymowy (bezposredni URL pliku audio) → z niego
--     generuje sie automatycznie kod QR po stronie klienta
--
-- Slowa + tlumaczenie + wymowa TTS sa zaciagane automatycznie
-- z data.js (BOOKS) — tu trzymamy TYLKO nadpisania per slowko.
--
-- Klucz: (book_id, unit_key, word_pl).
-- RLS:
--   - SELECT: kazdy (gosc tez — podglad/druk slowniczka bez loginu)
--   - INSERT/UPDATE/DELETE: tylko admin / nauczyciel (staff)
--
-- Idempotentna — mozna uruchomic ponownie.

-- 1. Tabela nadpisan per slowko
CREATE TABLE IF NOT EXISTS public.dictionary_words (
  book_id    TEXT NOT NULL,
  unit_key   TEXT NOT NULL,
  word_pl    TEXT NOT NULL,
  image_url  TEXT,                       -- publiczny URL obrazka (Storage)
  image_path TEXT,                       -- pelna sciezka w Storage (do usuniecia)
  audio_link TEXT,                       -- wklejony link do wymowy (zrodlo kodu QR)
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, unit_key, word_pl)
);

CREATE INDEX IF NOT EXISTS idx_dictionary_words_book ON public.dictionary_words(book_id);

ALTER TABLE public.dictionary_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dw_select_all" ON public.dictionary_words;
CREATE POLICY "dw_select_all" ON public.dictionary_words
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "dw_write_staff" ON public.dictionary_words;
CREATE POLICY "dw_write_staff" ON public.dictionary_words
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE))
    )
  );

GRANT SELECT ON public.dictionary_words TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dictionary_words TO authenticated;


-- 2. Storage bucket „dict-images" (publiczny — podglad/druk bez auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dict-images', 'dict-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;


-- 3. Storage RLS policies
-- SELECT (publiczny bucket)
DROP POLICY IF EXISTS "di_storage_select_all" ON storage.objects;
CREATE POLICY "di_storage_select_all" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'dict-images');

-- INSERT (upload) — tylko admin/nauczyciel
DROP POLICY IF EXISTS "di_storage_insert_staff" ON storage.objects;
CREATE POLICY "di_storage_insert_staff" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'dict-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE))
    )
  );

-- UPDATE — tylko admin/nauczyciel
DROP POLICY IF EXISTS "di_storage_update_staff" ON storage.objects;
CREATE POLICY "di_storage_update_staff" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'dict-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE))
    )
  );

-- DELETE — tylko admin/nauczyciel
DROP POLICY IF EXISTS "di_storage_delete_staff" ON storage.objects;
CREATE POLICY "di_storage_delete_staff" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'dict-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE))
    )
  );


SELECT 'OK — tabela dictionary_words + bucket dict-images + Storage RLS policies utworzone' AS status;
