-- ═══════════════════════════════════════════════════════════
-- WORD AUDIO (word_audio) — migracja #28
-- ═══════════════════════════════════════════════════════════
-- Custom nagrania wymowy słówek (przez admina/nauczyciela z mikrofonu).
-- Każdy wpis: (book_id, unit_key, word_pl) → URL pliku audio w Storage.
--
-- Storage bucket „word-audio" (publiczny dla SELECT).
-- RLS:
--  - SELECT: każdy (gość też — odtwarzanie nagrania nie wymaga loginu)
--  - INSERT/UPDATE/DELETE: tylko admin / nauczyciel
--
-- Idempotentna — można uruchomić ponownie.

-- 1. Tabela meta-danych
CREATE TABLE IF NOT EXISTS public.word_audio (
  book_id    TEXT NOT NULL,
  unit_key   TEXT NOT NULL,
  word_pl    TEXT NOT NULL,
  audio_url  TEXT NOT NULL,
  audio_path TEXT NOT NULL,            -- pełna ścieżka w Storage (do późniejszego usunięcia)
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (book_id, unit_key, word_pl)
);

CREATE INDEX IF NOT EXISTS idx_word_audio_lookup ON public.word_audio(book_id, unit_key);

ALTER TABLE public.word_audio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_select_all" ON public.word_audio;
CREATE POLICY "wa_select_all" ON public.word_audio
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "wa_write_staff" ON public.word_audio;
CREATE POLICY "wa_write_staff" ON public.word_audio
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

GRANT SELECT ON public.word_audio TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.word_audio TO authenticated;


-- 2. Storage bucket „word-audio" (publiczny — odtwarzanie z URL bez auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('word-audio', 'word-audio', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;


-- 3. Storage RLS policies
-- SELECT (publiczny bucket — anon też ma dostęp do plików via URL)
DROP POLICY IF EXISTS "wa_storage_select_all" ON storage.objects;
CREATE POLICY "wa_storage_select_all" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'word-audio');

-- INSERT (upload nowego pliku) — tylko admin/nauczyciel
DROP POLICY IF EXISTS "wa_storage_insert_staff" ON storage.objects;
CREATE POLICY "wa_storage_insert_staff" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'word-audio' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE))
    )
  );

-- UPDATE (zmiana metadanych) — tylko admin/nauczyciel
DROP POLICY IF EXISTS "wa_storage_update_staff" ON storage.objects;
CREATE POLICY "wa_storage_update_staff" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'word-audio' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE))
    )
  );

-- DELETE (usunięcie pliku) — tylko admin/nauczyciel
DROP POLICY IF EXISTS "wa_storage_delete_staff" ON storage.objects;
CREATE POLICY "wa_storage_delete_staff" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'word-audio' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE))
    )
  );


SELECT 'OK — tabela word_audio + bucket word-audio + Storage RLS policies utworzone' AS status;
