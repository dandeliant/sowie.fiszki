-- ═══════════════════════════════════════════════════════════════
--  BOOK NOTES — notatki administratora do podręczników i unitów
-- ═══════════════════════════════════════════════════════════════
--
--  Admin może dodawać krótkie notatki (z linkami np. do gier w "INNE")
--  widoczne dla wszystkich użytkowników — na ekranie wyboru unitów
--  danego podręcznika oraz w widoku słówek konkretnego unitu.
--
--  Konwencja:
--    unit_key = ''      → notatka na poziomie PODRĘCZNIKA
--    unit_key = 'unit5' → notatka na poziomie konkretnego UNITU
--
--  Uruchom jednorazowo w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.book_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    TEXT        NOT NULL,
  unit_key   TEXT        NOT NULL DEFAULT '',
  content    TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        REFERENCES auth.users(id),
  UNIQUE(book_id, unit_key)
);

CREATE INDEX IF NOT EXISTS idx_book_notes_lookup
  ON public.book_notes (book_id, unit_key);

ALTER TABLE public.book_notes ENABLE ROW LEVEL SECURITY;

-- Wszyscy (także goście) mogą czytać notatki.
DROP POLICY IF EXISTS "book_notes: public SELECT" ON public.book_notes;
CREATE POLICY "book_notes: public SELECT"
  ON public.book_notes FOR SELECT
  USING (TRUE);

-- Tylko admin może dodawać / edytować / usuwać.
DROP POLICY IF EXISTS "book_notes: admin ALL" ON public.book_notes;
CREATE POLICY "book_notes: admin ALL"
  ON public.book_notes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );

-- Automatyczny updated_at przy zmianie
CREATE OR REPLACE FUNCTION public.tf_book_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_book_notes_updated_at ON public.book_notes;
CREATE TRIGGER trg_book_notes_updated_at
  BEFORE UPDATE ON public.book_notes
  FOR EACH ROW EXECUTE FUNCTION public.tf_book_notes_updated_at();

SELECT 'OK — book_notes gotowe' AS status;
