-- ═══════════════════════════════════════════════════════════
-- WORD ERROR REPORTS — zgłoszenia błędów w słówkach
-- ═══════════════════════════════════════════════════════════
-- Tabela do przyjmowania zgłoszeń od użytkowników o błędach
-- w słówkach (literówka, złe tłumaczenie, niepoprawne zdanie).
-- Widoczna tylko dla admina (RLS).
-- Migracja idempotentna — można uruchomić ponownie.

CREATE TABLE IF NOT EXISTS public.word_error_reports (
  id                BIGSERIAL PRIMARY KEY,
  reporter_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_username TEXT,
  book_id           TEXT,
  unit_key          TEXT,
  word_pl           TEXT,
  word_target       TEXT,
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wer_status      ON public.word_error_reports(status);
CREATE INDEX IF NOT EXISTS idx_wer_created_at  ON public.word_error_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wer_reporter_id ON public.word_error_reports(reporter_id);

ALTER TABLE public.word_error_reports ENABLE ROW LEVEL SECURITY;

-- Każdy zalogowany może wstawić zgłoszenie (jako własne).
DROP POLICY IF EXISTS "wer_insert_own" ON public.word_error_reports;
CREATE POLICY "wer_insert_own" ON public.word_error_reports
  FOR INSERT WITH CHECK (
    reporter_id = auth.uid() OR reporter_id IS NULL
  );

-- Użytkownik widzi swoje zgłoszenia.
DROP POLICY IF EXISTS "wer_select_own" ON public.word_error_reports;
CREATE POLICY "wer_select_own" ON public.word_error_reports
  FOR SELECT USING (reporter_id = auth.uid());

-- Admin widzi wszystkie.
DROP POLICY IF EXISTS "wer_select_admin" ON public.word_error_reports;
CREATE POLICY "wer_select_admin" ON public.word_error_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin może aktualizować (oznaczać jako rozwiązane).
DROP POLICY IF EXISTS "wer_update_admin" ON public.word_error_reports;
CREATE POLICY "wer_update_admin" ON public.word_error_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin może usuwać.
DROP POLICY IF EXISTS "wer_delete_admin" ON public.word_error_reports;
CREATE POLICY "wer_delete_admin" ON public.word_error_reports
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
