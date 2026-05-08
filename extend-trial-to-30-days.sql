-- ═══════════════════════════════════════════════════════════
-- Migracja #34: Trial Premium 7 dni -> 30 dni
-- ═══════════════════════════════════════════════════════════
--
-- Cel: nowe konta dostaja 30-dniowy trial Premium zamiast 7-dniowego.
--
-- Co robi:
-- - Aktualizuje RPC activate_trial() — INTERVAL '7 days' -> INTERVAL '30 days'.
-- - Zachowuje istniejaca logike admin-no-trial (z migracji fix-admin-no-trial.sql).
-- - Istniejacy uzytkownicy ktorzy juz uzyli triala — bez zmian (ich expiry zostaje).
--   Jezeli admin chce przedluzyc komus konkretnemu, ma admin_extend_premium(uid, months).
--
-- Idempotentna — moze byc uruchomiona wielokrotnie.

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

  -- Trial juz uzyty (kazde konto otrzymuje go raz w zyciu)
  IF v_already_used IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Juz ma premium (np. przedluzone przez admina recznie)
  IF v_current_plan = 'premium' THEN
    RETURN NULL;
  END IF;

  -- 30 dni darmowego Premium dla nowego konta
  v_new_expires := NOW() + INTERVAL '30 days';

  UPDATE public.profiles
    SET plan = 'premium',
        plan_expires_at = v_new_expires,
        trial_used_at = NOW()
    WHERE id = auth.uid();

  RETURN v_new_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_trial() TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'OK — trial Premium wydluzony do 30 dni dla nowych kont. Istniejace triale pozostaja bez zmian.';
END $$;
