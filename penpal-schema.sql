-- ═══════════════════════════════════════════════════════════
-- PENPAL „Listy przyjaźni" — migracja #58
-- ═══════════════════════════════════════════════════════════
-- Organizer projektu korespondencyjnego: szkoły zgłaszają uczniów,
-- admin dobiera pary. Port aplikacji PHP na Supabase (Vercel bez PHP).
--
-- Tabele:
--   penpal_config      — ustawienia projektu (1 wiersz, id=1) — PUBLICZNY odczyt
--   penpal_matching    — zapisane dopasowanie (1 wiersz, id=1) — tylko admin
--   penpal_submissions — zgłoszenia szkół (imiona uczniów!) — tylko admin (SELECT)
--
-- Akcje publiczne (formularz nauczyciela, bez logowania) przez RPC
-- SECURITY DEFINER: penpal_submit / penpal_get_own / penpal_update_own.
-- Edycja własnego zgłoszenia po sekretnym tokenie (link #edit=<id>.<token>).
-- Admin (konto is_admin) czyta/edytuje tabele bezpośrednio (RLS _is_admin()).
--
-- Wymaga: helper public._is_admin() (migracja #20). Idempotentna.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Ustawienia -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.penpal_config (
  id           INT PRIMARY KEY DEFAULT 1,
  project_name TEXT NOT NULL DEFAULT 'Listy przyjaźni',
  form_open    BOOLEAN NOT NULL DEFAULT TRUE,
  deadline     DATE,
  intro        TEXT DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT penpal_config_singleton CHECK (id = 1)
);
INSERT INTO public.penpal_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Dopasowanie ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.penpal_matching (
  id         INT PRIMARY KEY DEFAULT 1,
  data       JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT penpal_matching_singleton CHECK (id = 1)
);

-- 3. Zgłoszenia -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.penpal_submissions (
  id          TEXT PRIMARY KEY,               -- hex (encode(gen_random_bytes(8)))
  school      TEXT NOT NULL,
  city        TEXT DEFAULT '',
  school_type TEXT NOT NULL DEFAULT 'sp',
  guardian    TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  note        TEXT DEFAULT '',
  students    JSONB NOT NULL DEFAULT '[]'::jsonb,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  edit_token  TEXT NOT NULL,                  -- sekret do edycji własnego zgłoszenia
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ
);

ALTER TABLE public.penpal_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penpal_matching    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penpal_submissions ENABLE ROW LEVEL SECURITY;

-- config: SELECT publiczny (ustawienia formularza), zapis tylko admin
DROP POLICY IF EXISTS "pp_cfg_select" ON public.penpal_config;
CREATE POLICY "pp_cfg_select" ON public.penpal_config FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "pp_cfg_write" ON public.penpal_config;
CREATE POLICY "pp_cfg_write" ON public.penpal_config FOR ALL
  USING (public._is_admin()) WITH CHECK (public._is_admin());

-- matching: tylko admin (zawiera pary = imiona)
DROP POLICY IF EXISTS "pp_match_admin" ON public.penpal_matching;
CREATE POLICY "pp_match_admin" ON public.penpal_matching FOR ALL
  USING (public._is_admin()) WITH CHECK (public._is_admin());

-- submissions: tylko admin (imiona uczniów!). Publiczne wpisy idą przez RPC.
DROP POLICY IF EXISTS "pp_sub_admin" ON public.penpal_submissions;
CREATE POLICY "pp_sub_admin" ON public.penpal_submissions FOR ALL
  USING (public._is_admin()) WITH CHECK (public._is_admin());

GRANT SELECT ON public.penpal_config TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.penpal_config, public.penpal_matching, public.penpal_submissions TO authenticated;

-- 4. RPC publiczne (SECURITY DEFINER) --------------------------------------

-- Wysłanie zgłoszenia (formularz nauczyciela). Zwraca {ok,id,token} lub {ok:false,error}.
CREATE OR REPLACE FUNCTION public.penpal_submit(p_data JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_open BOOLEAN; v_id TEXT; v_token TEXT;
BEGIN
  SELECT form_open INTO v_open FROM public.penpal_config WHERE id = 1;
  IF v_open IS NULL THEN v_open := TRUE; END IF;
  IF v_open = FALSE THEN RETURN jsonb_build_object('ok', false, 'error', 'Zgłoszenia są obecnie zamknięte.'); END IF;
  IF COALESCE(TRIM(p_data->>'school'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Podaj nazwę szkoły.'); END IF;
  IF jsonb_typeof(p_data->'students') <> 'array' OR jsonb_array_length(COALESCE(p_data->'students', '[]'::jsonb)) < 1
    THEN RETURN jsonb_build_object('ok', false, 'error', 'Dodaj co najmniej jednego ucznia.'); END IF;
  IF jsonb_array_length(p_data->'students') > 500 THEN RETURN jsonb_build_object('ok', false, 'error', 'Za dużo uczniów w jednym zgłoszeniu.'); END IF;

  v_id := encode(gen_random_bytes(8), 'hex');
  v_token := encode(gen_random_bytes(12), 'hex');
  INSERT INTO public.penpal_submissions (id, school, city, school_type, guardian, email, note, students, active, edit_token, created_at)
  VALUES (v_id,
    LEFT(TRIM(p_data->>'school'), 160),
    LEFT(COALESCE(TRIM(p_data->>'city'), ''), 80),
    COALESCE(p_data->>'schoolType', 'sp'),
    LEFT(COALESCE(TRIM(p_data->>'guardian'), ''), 100),
    LEFT(COALESCE(TRIM(p_data->>'email'), ''), 160),
    LEFT(COALESCE(p_data->>'note', ''), 1000),
    COALESCE(p_data->'students', '[]'::jsonb),
    TRUE, v_token, NOW());
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token);
END; $$;

-- Odczyt własnego zgłoszenia po (id, token). Zwraca obiekt camelCase lub NULL.
CREATE OR REPLACE FUNCTION public.penpal_get_own(p_id TEXT, p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r public.penpal_submissions;
BEGIN
  SELECT * INTO r FROM public.penpal_submissions WHERE id = p_id AND edit_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', r.id, 'school', r.school, 'city', r.city, 'schoolType', r.school_type,
    'guardian', r.guardian, 'email', r.email, 'note', r.note, 'students', r.students,
    'active', r.active, 'createdAt', r.created_at, 'updatedAt', r.updated_at);
END; $$;

-- Aktualizacja własnego zgłoszenia po (id, token). Blokowana gdy formularz zamknięty.
CREATE OR REPLACE FUNCTION public.penpal_update_own(p_id TEXT, p_token TEXT, p_data JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_open BOOLEAN; v_hit INT;
BEGIN
  SELECT form_open INTO v_open FROM public.penpal_config WHERE id = 1;
  IF COALESCE(v_open, TRUE) = FALSE THEN RETURN jsonb_build_object('ok', false, 'error', 'Zgłoszenia są zamknięte – edycja niemożliwa.'); END IF;
  IF COALESCE(TRIM(p_data->>'school'), '') = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Podaj nazwę szkoły.'); END IF;
  IF jsonb_typeof(p_data->'students') <> 'array' OR jsonb_array_length(COALESCE(p_data->'students', '[]'::jsonb)) < 1
    THEN RETURN jsonb_build_object('ok', false, 'error', 'Dodaj co najmniej jednego ucznia.'); END IF;

  UPDATE public.penpal_submissions SET
    school = LEFT(TRIM(p_data->>'school'), 160),
    city = LEFT(COALESCE(TRIM(p_data->>'city'), ''), 80),
    school_type = COALESCE(p_data->>'schoolType', 'sp'),
    guardian = LEFT(COALESCE(TRIM(p_data->>'guardian'), ''), 100),
    email = LEFT(COALESCE(TRIM(p_data->>'email'), ''), 160),
    note = LEFT(COALESCE(p_data->>'note', ''), 1000),
    students = COALESCE(p_data->'students', '[]'::jsonb),
    updated_at = NOW()
  WHERE id = p_id AND edit_token = p_token;
  GET DIAGNOSTICS v_hit = ROW_COUNT;
  IF v_hit = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Nieprawidłowy link do edycji.'); END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.penpal_submit(JSONB)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.penpal_get_own(TEXT, TEXT)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.penpal_update_own(TEXT, TEXT, JSONB) TO anon, authenticated;

SELECT 'OK — PenPal: tabele penpal_config/matching/submissions + RLS + RPC utworzone' AS status;
