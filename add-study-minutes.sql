-- ═══════════════════════════════════════════════════════════
-- CZAS NAUKI — kolumny `minutes` + `first_active_at` w daily_xp_log
-- ═══════════════════════════════════════════════════════════
-- Pozwala nauczycielowi/opiekunowi/adminowi zobaczyc KIEDY uczen
-- wchodzil na strone (first_active_at) oraz JAK DLUGO sie uczyl danego
-- dnia (minutes). Klient wysyla heartbeat co 1 min aktywnej widocznosci
-- strony -> RPC log_study_minutes(1).
-- Migracja idempotentna — mozna uruchomic ponownie.

-- 1) Kolumny
ALTER TABLE public.daily_xp_log
  ADD COLUMN IF NOT EXISTS minutes INT NOT NULL DEFAULT 0;

ALTER TABLE public.daily_xp_log
  ADD COLUMN IF NOT EXISTS first_active_at TIMESTAMPTZ;

-- 2) RPC: dodaj N minut do dzisiejszego dnia; ustaw first_active_at przy pierwszym insercie
CREATE OR REPLACE FUNCTION public.log_study_minutes(p_minutes INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  IF p_minutes IS NULL OR p_minutes <= 0 THEN
    RETURN 0;
  END IF;
  -- Ograniczenie: jednorazowo max 10 min (sanity check — nigdy nie powinnismy logowac wiecej)
  IF p_minutes > 10 THEN p_minutes := 10; END IF;

  INSERT INTO public.daily_xp_log (user_id, day, xp, minutes, first_active_at, updated_at)
    VALUES (auth.uid(), CURRENT_DATE, 0, p_minutes, NOW(), NOW())
    ON CONFLICT (user_id, day) DO UPDATE
      SET minutes = daily_xp_log.minutes + EXCLUDED.minutes,
          first_active_at = COALESCE(daily_xp_log.first_active_at, EXCLUDED.first_active_at),
          updated_at = NOW()
    RETURNING minutes INTO v_total;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_study_minutes(INT) TO authenticated;

-- 3) Zaktualizuj RPC log_daily_xp zeby tez ustawial first_active_at (jesli jeszcze nie)
CREATE OR REPLACE FUNCTION public.log_daily_xp(p_delta INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_xp INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  IF p_delta IS NULL OR p_delta <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.daily_xp_log (user_id, day, xp, first_active_at, updated_at)
    VALUES (auth.uid(), CURRENT_DATE, p_delta, NOW(), NOW())
    ON CONFLICT (user_id, day) DO UPDATE
      SET xp = daily_xp_log.xp + EXCLUDED.xp,
          first_active_at = COALESCE(daily_xp_log.first_active_at, EXCLUDED.first_active_at),
          updated_at = NOW()
    RETURNING xp INTO v_new_xp;

  RETURN v_new_xp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_daily_xp(INT) TO authenticated;
