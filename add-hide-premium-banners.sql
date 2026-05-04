-- ═══════════════════════════════════════════════════════════════
--  Migracja #32: Flaga "hide_premium_banners" — admin/nauczyciel
--  może wyłączyć wyświetlanie bannerów Premium uczniowi.
-- ═══════════════════════════════════════════════════════════════
--
--  Po co: niektórzy uczniowie (np. szkoły publiczne, klasy
--  nauczyciela używającego aplikacji bez intencji monetyzacji)
--  nie powinni widzieć "🎁 Masz 7 dni Premium" oraz "🎁 Darmowy
--  trial kończy się za 7 dni — Przedłuż / Dzisiaj nie".
--
--  Reguły:
--   • Admin może ustawić flagę dla DOWOLNEGO ucznia
--   • Nauczyciel tylko dla SWOICH (created_by = auth.uid())
--   • Sam uczeń NIE może zmienić flagi (zapobiega obejściu trialu)
--
--  Uruchom jednorazowo w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- 1. Kolumna w profiles (idempotentnie)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_premium_banners BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. RPC: ustaw flagę dla użytkownika (admin → wszystkim, teacher → swoim)
CREATE OR REPLACE FUNCTION public.admin_set_hide_premium_banners(
  p_user_id UUID,
  p_value   BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller        UUID := auth.uid();
  v_caller_admin  BOOLEAN;
  v_target_creator UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  SELECT is_admin INTO v_caller_admin
  FROM public.profiles WHERE id = v_caller;

  IF v_caller_admin IS NOT TRUE THEN
    -- Nie-admin: musi być nauczycielem-twórcą tego ucznia
    SELECT created_by INTO v_target_creator
    FROM public.profiles WHERE id = p_user_id;

    IF v_target_creator IS DISTINCT FROM v_caller THEN
      RAISE EXCEPTION 'Brak uprawnień: możesz zmieniać tylko swoich uczniów.';
    END IF;
  END IF;

  UPDATE public.profiles
  SET hide_premium_banners = COALESCE(p_value, FALSE)
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_hide_premium_banners(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_hide_premium_banners(UUID, BOOLEAN) TO authenticated;

SELECT 'OK — hide_premium_banners + RPC gotowe' AS status;
