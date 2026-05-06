-- ═══════════════════════════════════════════════════════════════
--  FIX: Migracja #33 — naprawa "column reference 'game_id' is ambiguous"
-- ═══════════════════════════════════════════════════════════════
--
--  Problem: w join_live_game RETURNS TABLE(game_id, player_id, ...)
--  oraz tabela live_game_players ma kolumnę game_id. PostgreSQL
--  rzuca ambiguity przy `WHERE game_id = v_game_id`.
--
--  Fix: prefiks `out_` w RETURNS TABLE — eliminuje kolizję nazw.
--  Wymaga DROP + CREATE (PostgreSQL nie pozwala zmieniać sygnatury
--  funkcji przez CREATE OR REPLACE gdy zmienia się return type).
--
--  Uruchom JEDNORAZOWO w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.join_live_game(TEXT, TEXT);

CREATE FUNCTION public.join_live_game(
  p_pin      TEXT,
  p_nickname TEXT
) RETURNS TABLE(
  out_game_id      UUID,
  out_player_id    UUID,
  out_client_token TEXT,
  out_book_id      TEXT,
  out_unit_key     TEXT,
  out_game_type    TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_id      UUID;
  v_book_id      TEXT;
  v_unit_key     TEXT;
  v_game_type    TEXT;
  v_status       TEXT;
  v_token        TEXT;
  v_player_id    UUID;
  v_player_count INT;
  v_clean_nick   TEXT;
BEGIN
  v_clean_nick := trim(p_nickname);
  IF length(v_clean_nick) < 1 OR length(v_clean_nick) > 24 THEN
    RAISE EXCEPTION 'Nick: 1–24 znaków.';
  END IF;

  -- Znajdź aktywną grę po PIN-ie
  SELECT g.id, g.book_id, g.unit_key, g.game_type, g.status
    INTO v_game_id, v_book_id, v_unit_key, v_game_type, v_status
  FROM public.live_games g
  WHERE g.pin = p_pin
    AND g.status != 'finished'
    AND g.expires_at > NOW()
  ORDER BY g.created_at DESC
  LIMIT 1;

  IF v_game_id IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono gry o podanym kodzie (sprawdź PIN — może gra wygasła).';
  END IF;

  IF v_status != 'waiting' THEN
    RAISE EXCEPTION 'Gra już się zaczęła — dołączanie zamknięte.';
  END IF;

  -- Limit graczy (z aliasem p. by uniknąć ambiguity z OUT parametrem)
  SELECT count(*) INTO v_player_count
  FROM public.live_game_players p
  WHERE p.game_id = v_game_id;
  IF v_player_count >= 50 THEN
    RAISE EXCEPTION 'Maksymalna liczba graczy (50) osiągnięta.';
  END IF;

  -- Sprawdź unikalność nicku w grze
  IF EXISTS (
    SELECT 1 FROM public.live_game_players p
    WHERE p.game_id = v_game_id AND lower(p.nickname) = lower(v_clean_nick)
  ) THEN
    RAISE EXCEPTION 'Ten nick jest już zajęty — wybierz inny.';
  END IF;

  -- Wygeneruj token (32 znaki hex)
  v_token := encode(gen_random_bytes(16), 'hex');

  -- Wstaw gracza (kwalifikujemy schemę dla pewności)
  INSERT INTO public.live_game_players (game_id, user_id, nickname, client_token)
  VALUES (v_game_id, auth.uid(), v_clean_nick, v_token)
  RETURNING public.live_game_players.id INTO v_player_id;

  RETURN QUERY SELECT v_game_id, v_player_id, v_token, v_book_id, v_unit_key, v_game_type;
END;
$$;

REVOKE ALL ON FUNCTION public.join_live_game(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_live_game(TEXT, TEXT) TO authenticated, anon;

SELECT 'OK — join_live_game naprawione (prefiks out_ w RETURNS TABLE).' AS status;
