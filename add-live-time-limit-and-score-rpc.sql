-- ═══════════════════════════════════════════════════════════════
--  Migracja #34: Live Games faza 3 — time_limit + RPC do update score
-- ═══════════════════════════════════════════════════════════════
--
--  Po co:
--  1) Host przy tworzeniu gry wybiera limit czasu (3 min) lub bez
--     limitu (manualne zakończenie).
--  2) Gracze grający w mini-grę (np. Most/Crossing) potrzebują
--     wysyłać aktualny wynik do bazy. RLS na live_game_players
--     pozwala UPDATE tylko hostowi — gracz (anon) potrzebuje RPC
--     z weryfikacją przez client_token.
--
--  Uruchom JEDNORAZOWO w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- 1. Kolumna z limitem czasu (NULL = manualne zakończenie)
ALTER TABLE public.live_games
  ADD COLUMN IF NOT EXISTS time_limit_seconds INT;

-- 2. RPC: gracz wysyła swój aktualny wynik
--    Weryfikacja przez client_token (zwrócony przy join_live_game).
CREATE OR REPLACE FUNCTION public.update_live_player_score(
  p_player_id UUID,
  p_token     TEXT,
  p_score     INT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_ok BOOLEAN;
BEGIN
  IF p_player_id IS NULL OR p_token IS NULL THEN
    RAISE EXCEPTION 'Brak identyfikacji.';
  END IF;
  SELECT TRUE INTO v_token_ok
  FROM public.live_game_players
  WHERE id = p_player_id AND client_token = p_token;
  IF v_token_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'Nieprawidłowy token gracza.';
  END IF;
  UPDATE public.live_game_players
  SET score = GREATEST(COALESCE(p_score, 0), 0)
  WHERE id = p_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_live_player_score(UUID,TEXT,INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_live_player_score(UUID,TEXT,INT) TO authenticated, anon;

SELECT 'OK — time_limit_seconds + update_live_player_score gotowe.' AS status;
