-- ═══════════════════════════════════════════════════════════
-- FIX: Admin nie moze miec triala/Premium (ma pelny dostep z racji roli)
-- ═══════════════════════════════════════════════════════════
-- Bug: activate_trial() aktywowal 7-dniowy trial dla admina przy
-- pierwszym logowaniu po wdrozeniu Etapu A. Admin widzial "Trial
-- aktywny", banner wygasania itd.
-- Fix: (1) czyscimy plan_expires_at + trial_used_at dla wszystkich
-- adminow, (2) RPC activate_trial zwraca NULL dla adminow.
-- Migracja idempotentna.

-- 1. Czyszczenie stanu dla istniejacych adminow
UPDATE public.profiles
SET plan_expires_at = NULL,
    trial_used_at   = NULL
WHERE is_admin = TRUE;

-- 2. RPC odmawia adminom
CREATE OR REPLACE FUNCTION public.activate_trial()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_used TIMESTAMPTZ;
  v_current_plan TEXT;
  v_is_admin     BOOLEAN;
  v_new_expires  TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz byc zalogowany.';
  END IF;

  SELECT trial_used_at, plan, COALESCE(is_admin, FALSE)
    INTO v_already_used, v_current_plan, v_is_admin
    FROM public.profiles
    WHERE id = auth.uid();

  -- Admin ma pelny dostep z racji roli — zero triala
  IF v_is_admin THEN
    RETURN NULL;
  END IF;

  -- Trial juz uzyty
  IF v_already_used IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Juz ma premium (np. przedluzone przez admina recznie)
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
