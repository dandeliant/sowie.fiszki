-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — Schemat bazy danych Supabase
--
--  Uruchom ten plik w Supabase Dashboard → SQL Editor
--  (wklej całość i kliknij "Run")
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. TABELA: profiles ────────────────────────────────────────
--  Jeden wiersz na użytkownika. Powiązana z auth.users przez id.
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username         TEXT        UNIQUE NOT NULL,
  xp               INTEGER     NOT NULL DEFAULT 0,
  level            INTEGER     NOT NULL DEFAULT 1,
  streak           INTEGER     NOT NULL DEFAULT 0,
  longest_streak   INTEGER     NOT NULL DEFAULT 0,
  last_study_date  TEXT,
  total_sessions   INTEGER     NOT NULL DEFAULT 0,
  total_answers    INTEGER     NOT NULL DEFAULT 0,
  correct_answers  INTEGER     NOT NULL DEFAULT 0,
  achievements     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  daily_xp         INTEGER     NOT NULL DEFAULT 0,
  daily_xp_date    TEXT,
  speed_best       INTEGER     NOT NULL DEFAULT 0,
  is_admin         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. TABELA: unit_progress ───────────────────────────────────
--  Postęp na każdy podręcznik × unit. UPSERT po (user_id, book_key, unit_key).
CREATE TABLE IF NOT EXISTS public.unit_progress (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_key     TEXT        NOT NULL,
  unit_key     TEXT        NOT NULL,
  word_states  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  known_count  INTEGER     NOT NULL DEFAULT 0,
  total        INTEGER     NOT NULL DEFAULT 0,
  last_studied BIGINT,
  UNIQUE (user_id, book_key, unit_key)
);

-- ─── 3. TABELA: admin_requests ──────────────────────────────────
--  Prośby o uprawnienia administratora.
CREATE TABLE IF NOT EXISTS public.admin_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

-- ── profiles ──────────────────────────────────────────────────
-- Każdy widzi i edytuje tylko swój profil
CREATE POLICY "profiles: własny SELECT"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: własny INSERT"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: własny UPDATE"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin widzi wszystkie profile (potrzebne do zarządzania)
CREATE POLICY "profiles: admin SELECT all"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- ── unit_progress ─────────────────────────────────────────────
CREATE POLICY "unit_progress: własny ALL"
  ON public.unit_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── admin_requests ────────────────────────────────────────────
-- Użytkownik może dodać własną prośbę
CREATE POLICY "admin_requests: INSERT własna"
  ON public.admin_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Użytkownik widzi swoje prośby
CREATE POLICY "admin_requests: SELECT własne"
  ON public.admin_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Admin widzi i edytuje wszystkie prośby
CREATE POLICY "admin_requests: admin ALL"
  ON public.admin_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- ═══════════════════════════════════════════════════════════════
--  FUNKCJE RPC (wywoływane z klienta przez supabase.rpc(...))
-- ═══════════════════════════════════════════════════════════════

-- ── approve_admin_request ──────────────────────────────────────
--  Nadaje uprawnienia admina użytkownikowi i aktualizuje status prośby.
--  SECURITY DEFINER — uruchamia się z uprawnieniami właściciela funkcji,
--  więc może aktualizować profil innego użytkownika.
CREATE OR REPLACE FUNCTION public.approve_admin_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Sprawdź, czy wywołujący jest adminem
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  -- Pobierz user_id z prośby
  SELECT user_id INTO v_user_id
  FROM public.admin_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Prośba nie istnieje lub już rozpatrzona';
  END IF;

  -- Nadaj uprawnienia adminowi
  UPDATE public.profiles SET is_admin = TRUE WHERE id = v_user_id;

  -- Zaktualizuj status prośby
  UPDATE public.admin_requests SET status = 'approved' WHERE id = p_request_id;
END;
$$;

-- ── reject_admin_request ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_admin_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  UPDATE public.admin_requests
  SET status = 'rejected'
  WHERE id = p_request_id AND status = 'pending';
END;
$$;

-- ── check_username_exists ──────────────────────────────────────
--  Sprawdza czy nazwa użytkownika jest zajęta (używane przy rejestracji).
CREATE OR REPLACE FUNCTION public.check_username_exists(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username);
$$;

-- ── get_profile_by_username ────────────────────────────────────
--  Pobiera podstawowe dane profilu po nazwie użytkownika.
--  Używane przy prośbach o admina (bez ujawniania UUID).
CREATE OR REPLACE FUNCTION public.get_profile_by_username(p_username TEXT)
RETURNS TABLE(id UUID, is_admin BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, is_admin FROM public.profiles WHERE username = p_username;
$$;

-- ═══════════════════════════════════════════════════════════════
--  KONTA DEMO (opcjonalne — uruchom po wdrożeniu)
-- ═══════════════════════════════════════════════════════════════
--
--  Konto demo tworzy się przez normalną rejestrację w aplikacji.
--  Aby ręcznie nadać uprawnienia admina kontu "admin":
--
--    UPDATE public.profiles SET is_admin = TRUE
--    WHERE username = 'admin';
--
-- ═══════════════════════════════════════════════════════════════
