-- ═══════════════════════════════════════════════════════════
-- Migracja #36: RPC admin_grant_trial — admin nadaje N dni Premium
-- ═══════════════════════════════════════════════════════════
--
-- Cel: pozwolic adminowi nadac uzytkownikowi (najczesciej nauczycielowi
-- lub opiekunowi po wygasnieciu pierwotnego 30-dniowego trialu) kolejny
-- okres Premium o zadanej dlugosci (domyslnie 30 dni).
--
-- Zachowanie:
-- - Jezeli plan Premium jest nadal aktywny -> przedluzamy od aktualnej
--   daty wygasniecia.
-- - W przeciwnym razie -> Premium liczone od NOW().
-- - trial_used_at ustawiany na NOW() — semantycznie nowy trial.
-- - Plan ustawiany na 'premium'.
--
-- Idempotentna (CREATE OR REPLACE).
-- Tylko admin moze wywolac (gate w body).

CREATE OR REPLACE FUNCTION public.admin_grant_trial(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_expires TIMESTAMPTZ;
  v_start_from      TIMESTAMPTZ;
  v_new_expires     TIMESTAMPTZ;
BEGIN
  -- Tylko admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Tylko admin moze nadawac trial Premium.';
  END IF;

  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'Podaj liczbe dni 1-365.';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Brak ID uzytkownika.';
  END IF;

  SELECT plan_expires_at INTO v_current_expires
    FROM public.profiles WHERE id = p_user_id;

  -- Jezeli aktualnie aktywny Premium → przedluz od daty koncowej.
  -- W przeciwnym razie (Free, expired, NULL) → liczymy od teraz.
  IF v_current_expires IS NOT NULL AND v_current_expires > NOW() THEN
    v_start_from := v_current_expires;
  ELSE
    v_start_from := NOW();
  END IF;

  v_new_expires := v_start_from + (p_days || ' days')::INTERVAL;

  UPDATE public.profiles
    SET plan = 'premium',
        plan_expires_at = v_new_expires,
        trial_used_at = NOW()  -- semantycznie: nowy trial
    WHERE id = p_user_id;

  RETURN v_new_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grant_trial(UUID, INTEGER) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'OK — RPC admin_grant_trial(uid, days) gotowe. Domyslnie 30 dni.';
END $$;
