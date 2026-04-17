-- ═══════════════════════════════════════════════════════════════
--  MIGRACJA: Prośby o dostęp — TYLKO admin, wymagane imię i nazwisko
-- ═══════════════════════════════════════════════════════════════
--
--  Zmiany wobec poprzedniego schematu (book-access-requests-schema.sql):
--    1) Nowa kolumna student_name TEXT — imię i nazwisko ucznia
--       (wymagane w UI, żeby administrator mógł zweryfikować osobę)
--    2) RLS: dotąd nauczyciele widzieli wszystkie prośby. Teraz
--       tylko administrator. Polityki staff* są zastępowane
--       politykami admin*.
--    3) RPC approve_book_access_request — wyłącznie dla admina.
--
--  Uruchom jednorazowo w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- 1) Dodaj kolumnę z imieniem i nazwiskiem
ALTER TABLE public.book_access_requests
  ADD COLUMN IF NOT EXISTS student_name TEXT;

-- 2) Zastąp polityki staff → admin-only
DROP POLICY IF EXISTS "bar: staff SELECT all" ON public.book_access_requests;
DROP POLICY IF EXISTS "bar: staff UPDATE"     ON public.book_access_requests;

DROP POLICY IF EXISTS "bar: admin SELECT all" ON public.book_access_requests;
CREATE POLICY "bar: admin SELECT all"
  ON public.book_access_requests FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );

DROP POLICY IF EXISTS "bar: admin UPDATE" ON public.book_access_requests;
CREATE POLICY "bar: admin UPDATE"
  ON public.book_access_requests FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );

-- 3) Zaktualizuj RPC approve — tylko admin
CREATE OR REPLACE FUNCTION public.approve_book_access_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_user_id  UUID;
  v_book_id  TEXT;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Brak uprawnień — tylko administrator może rozpatrywać prośby.';
  END IF;

  SELECT user_id, book_id INTO v_user_id, v_book_id
  FROM public.book_access_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Prośba nie istnieje lub została już rozpatrzona.';
  END IF;

  INSERT INTO public.user_books (user_id, book_id)
  VALUES (v_user_id, v_book_id)
  ON CONFLICT (user_id, book_id) DO NOTHING;

  UPDATE public.book_access_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = NOW()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_book_access_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_book_access_request(UUID) TO authenticated;

SELECT 'OK — book_access_requests jest teraz admin-only + student_name' AS status;
