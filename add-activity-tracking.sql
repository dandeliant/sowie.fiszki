-- ═══════════════════════════════════════════════════════════════
--  ACTIVITY TRACKING — dziennik aktywności użytkownika
-- ═══════════════════════════════════════════════════════════════
--
--  Tabela `activity_events` zapisuje:
--    • sesje aktywności (gra/nauka) z czasem AKTYWNYM (kind='session')
--    • otwarcia gier standalone (kind='game_open')
--    • odpowiedzi na słowa (kind='word_correct' / 'word_wrong')
--
--  `seconds_active` zlicza tylko czas, gdy uzytkownik ruszal mysza
--  lub klawiatura w ciagu ostatnich 60 sekund. Po >60s bezruchu
--  zegar sie zatrzymuje (uzytkownik mogl odejsc od komputera).
--
--  RLS:
--    • uzytkownik widzi tylko swoje
--    • admin widzi wszystkie
--    • nauczyciel widzi tylko uczniow z created_by = self
--    • opiekun widzi tylko swoje dzieci (parent_children)
--
--  Wymaga helperow `_is_admin()`, `_is_teacher()`, `_is_parent_of(uuid)`
--  z migracji `fix-rls-recursion.sql`.
--
--  Uruchom raz w Supabase → SQL Editor → Run. Idempotentne.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.activity_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL,
  activity TEXT,
  book_id TEXT,
  unit_key TEXT,
  seconds_active INT DEFAULT 0,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_activity_events_user_ts
  ON public.activity_events (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_kind_ts
  ON public.activity_events (user_id, kind, ts DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity insert own" ON public.activity_events;
CREATE POLICY "Activity insert own" ON public.activity_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Activity select" ON public.activity_events;
CREATE POLICY "Activity select" ON public.activity_events
  FOR SELECT USING (
    user_id = auth.uid()
    OR _is_admin()
    OR (
      _is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = activity_events.user_id AND p.created_by = auth.uid()
      )
    )
    OR _is_parent_of(activity_events.user_id)
  );

DROP POLICY IF EXISTS "Activity delete own or admin" ON public.activity_events;
CREATE POLICY "Activity delete own or admin" ON public.activity_events
  FOR DELETE USING (user_id = auth.uid() OR _is_admin());

CREATE OR REPLACE FUNCTION public.log_activity_event(
  p_kind          TEXT,
  p_activity      TEXT,
  p_book_id       TEXT,
  p_unit_key      TEXT,
  p_seconds_active INT,
  p_meta          JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;
  INSERT INTO public.activity_events (user_id, kind, activity, book_id, unit_key, seconds_active, meta)
  VALUES (auth.uid(), p_kind, p_activity, p_book_id, p_unit_key, COALESCE(p_seconds_active, 0), p_meta);

  -- RETENCJA 60 DNI: oportunistyczne czyszczenie wlasnych starych zdarzen.
  -- Dziala w 5% wywolan (random) — wystarczy aby kazdy aktywny uczen czyscil
  -- swoje wpisy regularnie, bez narzutu na kazdy insert.
  -- Pelne czyszczenie globalne: cleanup_old_activity_events() (admin-only).
  IF random() < 0.05 THEN
    DELETE FROM public.activity_events
    WHERE user_id = auth.uid() AND ts < NOW() - INTERVAL '60 days';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_activity_event(TEXT,TEXT,TEXT,TEXT,INT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_activity_event(TEXT,TEXT,TEXT,TEXT,INT,JSONB) TO authenticated;

-- ───────────────────────────────────────────────────────────────
--  CZYSZCZENIE GLOBALNE — admin-only RPC
-- ───────────────────────────────────────────────────────────────
--  Klient-side: wywolaj raz dziennie przy logowaniu admina (jak
--  auto_delete_inactive_users). Usuwa wpisy starsze niz 60 dni
--  ze WSZYSTKICH uzytkownikow.
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_activity_events()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_count    BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = auth.uid();
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Tylko administrator może uruchomić globalne czyszczenie aktywności.';
  END IF;
  DELETE FROM public.activity_events WHERE ts < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_activity_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_activity_events() TO authenticated;

SELECT 'OK — activity_events gotowe (60-day retention + cleanup RPC)' AS status;
