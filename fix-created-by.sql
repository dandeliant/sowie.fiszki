-- ═══════════════════════════════════════════════════════════════
--  Tracking twórcy konta (profiles.created_by)
-- ═══════════════════════════════════════════════════════════════
--
--  Po co: żeby nauczyciel widział i zarządzał TYLKO uczniami,
--  których sam utworzył (przez masowe tworzenie kont lub ręcznie
--  przez adminCreateUser). Admin nadal widzi wszystkich.
--
--  Uruchom jednorazowo w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- 1) Kolumna created_by w profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON public.profiles (created_by);

-- 2) Funkcja RPC: ustaw created_by (admin/nauczyciel po utworzeniu konta
--    ucznia poprzez admin_create_user wywołuje ją, żeby przypisać się
--    jako twórca). Jednorazowo — nadpisuje tylko gdy created_by IS NULL.
CREATE OR REPLACE FUNCTION public.set_profile_creator(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  SELECT (is_admin = TRUE OR is_teacher = TRUE) INTO v_is_staff
  FROM public.profiles WHERE id = auth.uid();

  IF v_is_staff IS NOT TRUE THEN
    RAISE EXCEPTION 'Brak uprawnień.';
  END IF;

  UPDATE public.profiles
  SET created_by = auth.uid()
  WHERE id = p_user_id
    AND created_by IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_profile_creator(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_creator(UUID) TO authenticated;

SELECT 'OK — created_by + set_profile_creator gotowe' AS status;
