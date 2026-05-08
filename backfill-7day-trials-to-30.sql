-- ═══════════════════════════════════════════════════════════
-- Migracja #37: Backfill aktywnych 7-dniowych triali do 30 dni
-- ═══════════════════════════════════════════════════════════
--
-- Cel: konta ktore aktywowaly trial pod stara regula (7 dni — przed
-- migracja #34) maja teraz plan_expires_at = trial_used_at + 7 dni.
-- Migracja przedluza je do 30 dni od trial_used_at, zeby byly spojne
-- z aktualnym brzmieniem regulaminu i komunikatow w UI.
--
-- Reguly bezpieczenstwa:
-- - Tykna tylko triale ktore wciaz sa aktywne (plan_expires_at > NOW()).
-- - Wykryjemy „7-dniowy trial" przez warunek:
--     plan_expires_at - trial_used_at <= INTERVAL '8 days' (tolerancja 1 dzien)
--   Konta z manualnym przedluzeniem przez admina (np. 1 miesiac) nie beda
--   modyfikowane (roznica > 8 dni).
-- - Admin-grant z migracji #36 daje 30 dni — tez nie zostanie zmieniony.
-- - Admini sa pomijani (ich trial_used_at jest NULL po migracji
--   fix-admin-no-trial.sql).
--
-- Idempotentna — wielokrotne uruchomienie nie zaszkodzi (po pierwszym
-- przebiegu warunek przestaje pasowac).

DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH upd AS (
    UPDATE public.profiles
      SET plan_expires_at = trial_used_at + INTERVAL '30 days'
      WHERE plan = 'premium'
        AND trial_used_at IS NOT NULL
        AND plan_expires_at IS NOT NULL
        AND plan_expires_at > NOW()
        AND (plan_expires_at - trial_used_at) <= INTERVAL '8 days'
        AND COALESCE(is_admin, FALSE) = FALSE
      RETURNING id
  )
  SELECT COUNT(*) INTO v_updated FROM upd;

  RAISE NOTICE 'OK — przedluzono % aktywnych 7-dniowych triali do 30 dni od trial_used_at.', v_updated;
END $$;
