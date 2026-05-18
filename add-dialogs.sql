-- ═══════════════════════════════════════════════════════════════
--  MIGRACJA #40: mini-dialogi audio (Listening Comprehension)
-- ═══════════════════════════════════════════════════════════════
--
-- Tabela `dialogs` przechowuje:
--   - tytuł dialogu (np. „W kawiarni", „Pytanie o drogę")
--   - speakers JSONB (lista mówców z głosem TTS: female/male)
--   - lines JSONB (linie dialogu: speaker index + text EN + tłumaczenie PL)
--   - questions JSONB (pytania komprehensji multiple choice z poprawną odp.)
--   - book_id / unit_key (z BOOKS lub admin_books, '' dla globalnego)
--
-- Przykład struktury speakers / lines / questions:
--   speakers: [{"name":"Anna","voice":"female"},{"name":"Tom","voice":"male"}]
--   lines:    [{"speaker":0,"text":"Hi! Where are you going?","pl":"Cześć! Dokąd idziesz?"}, ...]
--   questions:[{"q":"Where is Tom going?","options":["School","Shop","Home","Park"],"correct":1}]
--
-- RLS:
--   SELECT — każdy zalogowany użytkownik (materiał edukacyjny)
--   INSERT/UPDATE/DELETE — admin lub nauczyciel (created_by = self)
--
-- Idempotentna.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.dialogs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     TEXT        NOT NULL,
  unit_key    TEXT        NOT NULL DEFAULT '',
  title       TEXT        NOT NULL,
  speakers    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  lines       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  questions   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_premium  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_by  UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialogs_book_unit
  ON public.dialogs (book_id, unit_key);

ALTER TABLE public.dialogs ENABLE ROW LEVEL SECURITY;

-- Każdy zalogowany może czytać (zgodne z modelem book_notes)
DROP POLICY IF EXISTS "dialogs: anyone SELECT" ON public.dialogs;
CREATE POLICY "dialogs: anyone SELECT"
  ON public.dialogs FOR SELECT
  USING (TRUE);

-- INSERT/UPDATE/DELETE: admin lub nauczyciel (tworca)
DROP POLICY IF EXISTS "dialogs: staff INSERT" ON public.dialogs;
CREATE POLICY "dialogs: staff INSERT"
  ON public.dialogs FOR INSERT
  WITH CHECK (
    public._is_admin() OR (public._is_teacher() AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "dialogs: staff UPDATE" ON public.dialogs;
CREATE POLICY "dialogs: staff UPDATE"
  ON public.dialogs FOR UPDATE
  USING (
    public._is_admin() OR (public._is_teacher() AND created_by = auth.uid())
  )
  WITH CHECK (
    public._is_admin() OR (public._is_teacher() AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "dialogs: staff DELETE" ON public.dialogs;
CREATE POLICY "dialogs: staff DELETE"
  ON public.dialogs FOR DELETE
  USING (
    public._is_admin() OR (public._is_teacher() AND created_by = auth.uid())
  );

-- Automatyczny updated_at
CREATE OR REPLACE FUNCTION public.tf_dialogs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dialogs_updated_at ON public.dialogs;
CREATE TRIGGER trg_dialogs_updated_at
  BEFORE UPDATE ON public.dialogs
  FOR EACH ROW EXECUTE FUNCTION public.tf_dialogs_updated_at();

-- GRANTS dla Data API (zgodnie z polityką Supabase od 2026-10-30)
GRANT SELECT ON public.dialogs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dialogs TO authenticated;
GRANT ALL ON public.dialogs TO service_role;

SELECT 'OK — dialogs gotowe (RLS + grants)' AS status;
