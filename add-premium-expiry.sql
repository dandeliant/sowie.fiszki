-- ═══════════════════════════════════════════════════════════
-- PREMIUM EXPIRY + 7-DNIOWY TRIAL
-- ═══════════════════════════════════════════════════════════
-- Dodaje kolumny:
--   plan_expires_at — kiedy wygasa aktywny plan (NULL = plan darmowy
--                     lub plan bez wygasania, np. nadany przez admina)
--   trial_used_at   — kiedy uzytkownik uzyl darmowego 7-dniowego triala
--                     (NULL = jeszcze nie uzyl)
-- Oraz RPC activate_trial() — aktywuje 7-dniowy trial Premium dla
-- nowego konta, ktory jeszcze go nie uzyl. Wywolywany przy pierwszym
-- boocie aplikacji po rejestracji.
-- Migracja idempotentna.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS trial_used_at    TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_plan_expires ON public.profiles(plan_expires_at);

-- ═══════════════════════════════════════════════════════════
-- RPC: aktywuj 7-dniowy trial (jesli jeszcze nie byl uzyty)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.activate_trial()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_used TIMESTAMPTZ;
  v_current_plan TEXT;
  v_new_expires  TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz byc zalogowany.';
  END IF;

  SELECT trial_used_at, plan
    INTO v_already_used, v_current_plan
    FROM public.profiles
    WHERE id = auth.uid();

  -- Jesli trial juz byl uzyty — nic nie rob (zwroc null)
  IF v_already_used IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Jesli juz ma aktywny plan premium (np. od admina) — nic nie rob
  IF v_current_plan = 'premium' THEN
    RETURN NULL;
  END IF;

  v_new_expires := NOW() + INTERVAL '7 days';

  UPDATE public.profiles
    SET plan = 'premium',
        plan_expires_at = v_new_expires,
        trial_used_at = NOW()
    WHERE id = auth.uid();

  RETURN v_new_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_trial() TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC: admin przedluza plan Premium dla uzytkownika (6/12 mies itd.)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.admin_extend_premium(p_user_id UUID, p_months INTEGER)
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Tylko admin moze przedluzac plan Premium.';
  END IF;

  IF p_months IS NULL OR p_months < 1 OR p_months > 120 THEN
    RAISE EXCEPTION 'Podaj liczbe miesiecy 1-120.';
  END IF;

  SELECT plan_expires_at INTO v_current_expires FROM public.profiles WHERE id = p_user_id;

  -- Jesli plan nadal aktywny → przedluzamy od aktualnej daty koncowej
  -- W przeciwnym wypadku → od teraz
  IF v_current_expires IS NOT NULL AND v_current_expires > NOW() THEN
    v_start_from := v_current_expires;
  ELSE
    v_start_from := NOW();
  END IF;

  v_new_expires := v_start_from + (p_months || ' months')::INTERVAL;

  UPDATE public.profiles
    SET plan = 'premium',
        plan_expires_at = v_new_expires
    WHERE id = p_user_id;

  RETURN v_new_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_extend_premium(UUID, INTEGER) TO authenticated;
