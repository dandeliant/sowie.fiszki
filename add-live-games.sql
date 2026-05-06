-- ═══════════════════════════════════════════════════════════════
--  Migracja #33: Live Games — multiplayer Kahoot-like
-- ═══════════════════════════════════════════════════════════════
--
--  Nauczyciel/admin tworzy sesje gry (live_games) z 6-cyfrowym
--  PIN-em. Uczniowie dolaczaja anonimowo (live_game_players).
--  Komunikacja w czasie rzeczywistym — Supabase Realtime
--  subscriptions na zmiany w tych tabelach.
--
--  Faza 1: lobby + dolaczanie. Faza 2: gra (kolejne migracje).
--
--  Reguly:
--   • Tylko Premium (admin / plan='teacher' / aktywny premium) moze
--     stworzyc gre
--   • Gracze dolaczaja anonimowo — wpisuja PIN i nick
--   • PIN zyje 4h (auto-expire)
--   • Max 50 graczy per gra (limit aplikacyjny)
--
--  Uruchom jednorazowo w Supabase → SQL Editor → Run.
--  Po uruchomieniu wlacz Realtime dla obu tabel:
--     Database → Replication → tabele 'live_games' + 'live_game_players'
--     → toggle ON
-- ═══════════════════════════════════════════════════════════════

-- 1. Tabela: live_games
CREATE TABLE IF NOT EXISTS public.live_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin TEXT NOT NULL,
  book_id TEXT NOT NULL,
  unit_key TEXT NOT NULL,
  game_type TEXT NOT NULL DEFAULT 'quiz',
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','playing','finished')),
  current_question INT NOT NULL DEFAULT 0,
  question_order JSONB,
  question_started_at TIMESTAMPTZ,
  time_per_question INT NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '4 hours')
);

-- Indeks na PIN — używany przy dołączaniu (tylko aktywne gry)
CREATE INDEX IF NOT EXISTS idx_live_games_pin_active
  ON public.live_games (pin) WHERE status != 'finished';
CREATE INDEX IF NOT EXISTS idx_live_games_host
  ON public.live_games (host_id);
CREATE INDEX IF NOT EXISTS idx_live_games_expires
  ON public.live_games (expires_at) WHERE status != 'finished';

-- 2. Tabela: live_game_players
CREATE TABLE IF NOT EXISTS public.live_game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.live_games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  nickname TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  client_token TEXT NOT NULL,  -- anon-secret do potwierdzania własności wiersza
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, nickname)
);

CREATE INDEX IF NOT EXISTS idx_lgp_game ON public.live_game_players (game_id);

-- 3. Tabela: live_game_answers (Faza 2 — odpowiedzi z timingiem)
CREATE TABLE IF NOT EXISTS public.live_game_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.live_games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.live_game_players(id) ON DELETE CASCADE,
  question_index INT NOT NULL,
  answer TEXT,
  is_correct BOOLEAN,
  response_time_ms INT,
  points_earned INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, player_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_lga_game ON public.live_game_answers (game_id);

-- ═══════════════════════════════════════════════════════════════
--  RLS — bezpieczeństwo na poziomie wiersza
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.live_games          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_game_players   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_game_answers   ENABLE ROW LEVEL SECURITY;

-- Wyczyść stare polityki (idempotentnie)
DROP POLICY IF EXISTS "lg_select_all"     ON public.live_games;
DROP POLICY IF EXISTS "lg_insert_premium" ON public.live_games;
DROP POLICY IF EXISTS "lg_update_host"    ON public.live_games;
DROP POLICY IF EXISTS "lg_delete_host"    ON public.live_games;
DROP POLICY IF EXISTS "lgp_select_all"    ON public.live_game_players;
DROP POLICY IF EXISTS "lgp_insert_all"    ON public.live_game_players;
DROP POLICY IF EXISTS "lgp_update_host"   ON public.live_game_players;
DROP POLICY IF EXISTS "lgp_delete_host"   ON public.live_game_players;
DROP POLICY IF EXISTS "lga_select_all"    ON public.live_game_answers;
DROP POLICY IF EXISTS "lga_insert_all"    ON public.live_game_answers;

-- ─── live_games ───────────────────────────────────────────────
-- SELECT: każdy (anon też) — żeby uczeń mógł znaleźć grę po PIN-ie
CREATE POLICY "lg_select_all" ON public.live_games
  FOR SELECT USING (true);

-- INSERT: tylko gospodarz z planem Premium/Teacher/Admin
CREATE POLICY "lg_insert_premium" ON public.live_games
  FOR INSERT WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.is_admin = TRUE
          OR p.plan = 'teacher'
          OR (p.plan = 'premium' AND (p.plan_expires_at IS NULL OR p.plan_expires_at > NOW()))
        )
    )
  );

-- UPDATE/DELETE: tylko host
CREATE POLICY "lg_update_host" ON public.live_games
  FOR UPDATE USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);
CREATE POLICY "lg_delete_host" ON public.live_games
  FOR DELETE USING (auth.uid() = host_id);

-- ─── live_game_players ───────────────────────────────────────
-- SELECT: każdy (potrzebne do live ranking u wszystkich)
CREATE POLICY "lgp_select_all" ON public.live_game_players
  FOR SELECT USING (true);

-- INSERT: każdy (też anon) — gracz dołącza do gry
-- Sprawdzamy czy gra istnieje i jest 'waiting' (nie skończona)
CREATE POLICY "lgp_insert_all" ON public.live_game_players
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_games g
      WHERE g.id = game_id
        AND g.status = 'waiting'
        AND g.expires_at > NOW()
    )
  );

-- UPDATE/DELETE: host gry może zarządzać graczami (kick, etc.)
CREATE POLICY "lgp_update_host" ON public.live_game_players
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.live_games g
      WHERE g.id = game_id AND g.host_id = auth.uid()
    )
  );
CREATE POLICY "lgp_delete_host" ON public.live_game_players
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.live_games g
      WHERE g.id = game_id AND g.host_id = auth.uid()
    )
  );

-- ─── live_game_answers ──────────────────────────────────────
-- SELECT: każdy (do leaderboard)
CREATE POLICY "lga_select_all" ON public.live_game_answers
  FOR SELECT USING (true);

-- INSERT: każdy (anon player może zapisać swoja odpowiedz)
-- Sprawdzamy że gra jest 'playing'
CREATE POLICY "lga_insert_all" ON public.live_game_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.live_games g
      WHERE g.id = game_id AND g.status = 'playing'
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  RPC: generowanie unikalnego PIN-u i tworzenie gry
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_live_game(
  p_book_id   TEXT,
  p_unit_key  TEXT,
  p_game_type TEXT DEFAULT 'quiz'
) RETURNS TABLE(id UUID, pin TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_premium BOOLEAN;
  v_pin TEXT;
  v_attempts INT := 0;
  v_game_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  -- Sprawdź uprawnienia (Premium / Teacher / Admin)
  SELECT (
    p.is_admin = TRUE
    OR p.plan = 'teacher'
    OR (p.plan = 'premium' AND (p.plan_expires_at IS NULL OR p.plan_expires_at > NOW()))
  ) INTO v_premium
  FROM public.profiles p WHERE p.id = v_caller;

  IF v_premium IS NOT TRUE THEN
    RAISE EXCEPTION 'Funkcja Premium — gospodarzowanie gry wymaga aktywnego planu.';
  END IF;

  -- Wygeneruj unikalny 6-cyfrowy PIN (do 10 prob)
  LOOP
    v_pin := lpad((floor(random() * 1000000))::TEXT, 6, '0');
    -- Sprawdź czy PIN nie jest aktywnie używany (status != finished AND not expired)
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.live_games g
      WHERE g.pin = v_pin
        AND g.status != 'finished'
        AND g.expires_at > NOW()
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Nie udało się wygenerować unikalnego PIN-u.';
    END IF;
  END LOOP;

  -- Wstaw grę
  INSERT INTO public.live_games (pin, book_id, unit_key, game_type, host_id)
  VALUES (v_pin, p_book_id, p_unit_key, p_game_type, v_caller)
  RETURNING public.live_games.id INTO v_game_id;

  RETURN QUERY SELECT v_game_id, v_pin;
END;
$$;

REVOKE ALL ON FUNCTION public.create_live_game(TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_live_game(TEXT,TEXT,TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════════
--  RPC: dołączanie do gry przez PIN (dostępne też dla anonimowych)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.join_live_game(
  p_pin      TEXT,
  p_nickname TEXT
) RETURNS TABLE(
  game_id UUID,
  player_id UUID,
  client_token TEXT,
  book_id TEXT,
  unit_key TEXT,
  game_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_id UUID;
  v_book_id TEXT;
  v_unit_key TEXT;
  v_game_type TEXT;
  v_status TEXT;
  v_token TEXT;
  v_player_id UUID;
  v_player_count INT;
  v_clean_nick TEXT;
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

  -- Limit graczy
  SELECT count(*) INTO v_player_count
  FROM public.live_game_players WHERE game_id = v_game_id;
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

  -- Wstaw gracza
  INSERT INTO public.live_game_players (game_id, user_id, nickname, client_token)
  VALUES (v_game_id, auth.uid(), v_clean_nick, v_token)
  RETURNING public.live_game_players.id INTO v_player_id;

  RETURN QUERY SELECT v_game_id, v_player_id, v_token, v_book_id, v_unit_key, v_game_type;
END;
$$;

REVOKE ALL ON FUNCTION public.join_live_game(TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_live_game(TEXT,TEXT) TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════
--  RPC: cleanup — usuń wygasłe gry (opcjonalne, do uruchomienia
--  okresowo lub przed listowaniem aktywnych)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.cleanup_expired_live_games()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM public.live_games
  WHERE expires_at < NOW() - INTERVAL '1 day';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_live_games() TO authenticated;

SELECT 'OK — live_games + RPCs gotowe. Pamiętaj: włącz Realtime dla tabel live_games i live_game_players w Database → Replication.' AS status;
