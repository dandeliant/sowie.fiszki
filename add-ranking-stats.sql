-- ═══════════════════════════════════════════════════════════
-- STATYSTYKI DO ROZSZERZONYCH RANKINGOW (Wave 2, #10)
-- ═══════════════════════════════════════════════════════════
-- Dodaje dwie rzeczy potrzebne do rankingow i wyzwan klasowych:
--   1) profiles.best_correct_streak  — najwiecej poprawnych odpowiedzi
--      pod rzad (rekord per uczen). Synchronizowane przez zwykly upsert
--      profilu (self-update RLS), aktualizowane client-side gdy seria
--      pobije rekord.
--   2) daily_xp_log.words            — ile slow opanowano danego dnia.
--      Logowane przez RPC log_daily_words(delta) gdy slowo przechodzi
--      w stan "known". Uzywane przez wyzwania klasowe typu 'words'.
-- Migracja idempotentna — mozna uruchomic ponownie.

-- 1) Kolumna best_correct_streak w profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS best_correct_streak INT NOT NULL DEFAULT 0;

-- 2) Kolumna words w daily_xp_log
ALTER TABLE public.daily_xp_log
  ADD COLUMN IF NOT EXISTS words INT NOT NULL DEFAULT 0;

-- 3) RPC: dodaj N opanowanych slow do dzisiejszego dnia
CREATE OR REPLACE FUNCTION public.log_daily_words(p_delta INT)
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
  IF p_delta IS NULL OR p_delta <= 0 THEN
    RETURN 0;
  END IF;
  -- Sanity: jednorazowo max 50 slow
  IF p_delta > 50 THEN p_delta := 50; END IF;

  INSERT INTO public.daily_xp_log (user_id, day, xp, words, first_active_at, updated_at)
    VALUES (auth.uid(), CURRENT_DATE, 0, p_delta, NOW(), NOW())
    ON CONFLICT (user_id, day) DO UPDATE
      SET words = daily_xp_log.words + EXCLUDED.words,
          first_active_at = COALESCE(daily_xp_log.first_active_at, EXCLUDED.first_active_at),
          updated_at = NOW()
    RETURNING words INTO v_total;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_daily_words(INT) TO authenticated;
