-- ═══════════════════════════════════════════════════════════════
--  BOOK ACCESS REQUESTS — prośby ucznia o dostęp do podręcznika
-- ═══════════════════════════════════════════════════════════════
--
--  Uczeń wysyła prośbę o dostęp do konkretnego podręcznika, podając
--  szkołę i klasę. Admin/nauczyciel widzi listę próśb i może
--  zaakceptować (dodaje user_books) lub odrzucić.
--
--  Uruchom jednorazowo w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.book_access_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id      TEXT        NOT NULL,     -- np. 'brainy6', 'together4' (z data.js)
  school_type  TEXT,                     -- 'primary' | 'secondary' | 'other'
  grade        INT,                      -- 1..8 (jeśli podano)
  message      TEXT,                     -- opcjonalna wiadomość od ucznia
  status       TEXT        NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  reviewed_by  UUID        REFERENCES auth.users(id),
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bar_user    ON public.book_access_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_bar_status  ON public.book_access_requests (status);

ALTER TABLE public.book_access_requests ENABLE ROW LEVEL SECURITY;

-- Uczeń: wstawia własną prośbę, czyta własne, może anulować (DELETE) tylko gdy jeszcze pending
DROP POLICY IF EXISTS "bar: own INSERT" ON public.book_access_requests;
CREATE POLICY "bar: own INSERT"
  ON public.book_access_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "bar: own SELECT" ON public.book_access_requests;
CREATE POLICY "bar: own SELECT"
  ON public.book_access_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bar: own DELETE pending" ON public.book_access_requests;
CREATE POLICY "bar: own DELETE pending"
  ON public.book_access_requests FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

-- Admin/nauczyciel: SELECT wszystko, UPDATE status
DROP POLICY IF EXISTS "bar: staff SELECT all" ON public.book_access_requests;
CREATE POLICY "bar: staff SELECT all"
  ON public.book_access_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (p.is_admin = TRUE OR p.is_teacher = TRUE))
  );

DROP POLICY IF EXISTS "bar: staff UPDATE" ON public.book_access_requests;
CREATE POLICY "bar: staff UPDATE"
  ON public.book_access_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND (p.is_admin = TRUE OR p.is_teacher = TRUE))
  );

-- Funkcja RPC: zaakceptuj prośbę (dodaje user_books + ustawia status)
CREATE OR REPLACE FUNCTION public.approve_book_access_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN;
  v_user_id  UUID;
  v_book_id  TEXT;
BEGIN
  -- Tylko admin lub nauczyciel
  SELECT (is_admin = TRUE OR is_teacher = TRUE) INTO v_is_staff
  FROM public.profiles WHERE id = auth.uid();
  IF v_is_staff IS NOT TRUE THEN
    RAISE EXCEPTION 'Brak uprawnień.';
  END IF;

  SELECT user_id, book_id INTO v_user_id, v_book_id
  FROM public.book_access_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Prośba nie istnieje lub została już rozpatrzona.';
  END IF;

  -- Dodaj dostęp do podręcznika (jeśli już jest — ignoruj)
  INSERT INTO public.user_books (user_id, book_id)
  VALUES (v_user_id, v_book_id)
  ON CONFLICT (user_id, book_id) DO NOTHING;

  -- Oznacz prośbę jako zaakceptowaną
  UPDATE public.book_access_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_book_access_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_book_access_request(UUID) TO authenticated;

SELECT 'OK — book_access_requests gotowe' AS status;
