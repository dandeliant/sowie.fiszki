-- ═══════════════════════════════════════════════════════════
-- FIX: RLS INFINITE RECURSION (profiles ↔ parent_children ↔ profiles)
-- ═══════════════════════════════════════════════════════════
-- Problem: migracja add-parent-role.sql dodala polityke na profiles,
-- ktora robi EXISTS na parent_children. Jednoczesnie parent_children
-- ma polityke ktora robi EXISTS na profiles. Gdy PostgreSQL ewaluuje
-- RLS, zaczyna petle. Serwer zwraca HTTP 500 na kazde SELECT profiles
-- → logowanie sie wywala ("Nieprawidlowa nazwa uzytkownika lub haslo").
--
-- Fix: zastapic polityki helperami SECURITY DEFINER. Funkcje te
-- uruchamiaja sie z uprawnieniami wlasciciela (postgres) i pomijaja
-- RLS — nie powoduja rekurencji. Idempotentne, mozna uruchomic raz.

-- ═══════════════════════════════════════════════════════════
-- 1. Helpery SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════

-- Czy aktualnie zalogowany user jest adminem?
CREATE OR REPLACE FUNCTION public._is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE);
$$;

GRANT EXECUTE ON FUNCTION public._is_admin() TO authenticated;

-- Czy aktualnie zalogowany user jest nauczycielem (lub adminem)?
CREATE OR REPLACE FUNCTION public._is_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin OR is_teacher FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_teacher() TO authenticated;

-- Czy aktualnie zalogowany user jest opiekunem wskazanego dziecka?
CREATE OR REPLACE FUNCTION public._is_parent_of(p_child_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.parent_children
    WHERE parent_id = auth.uid() AND child_id = p_child_id
  );
$$;

GRANT EXECUTE ON FUNCTION public._is_parent_of(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- 2. Przebuduj polityki WINOWAJCE
-- ═══════════════════════════════════════════════════════════

-- profiles: opiekun widzi profile swoich dzieci — teraz przez helper (bez rekurencji)
DROP POLICY IF EXISTS "prof_select_parent_child" ON public.profiles;
CREATE POLICY "prof_select_parent_child" ON public.profiles
  FOR SELECT USING (public._is_parent_of(profiles.id));

-- user_books: opiekun widzi user_books dzieci
DROP POLICY IF EXISTS "ub_select_parent_child" ON public.user_books;
CREATE POLICY "ub_select_parent_child" ON public.user_books
  FOR SELECT USING (public._is_parent_of(user_books.user_id));

-- unit_progress: opiekun widzi postepy dzieci
DROP POLICY IF EXISTS "up_select_parent_child" ON public.unit_progress;
CREATE POLICY "up_select_parent_child" ON public.unit_progress
  FOR SELECT USING (public._is_parent_of(unit_progress.user_id));

-- parent_children: admin widzi wszystkie relacje — teraz przez _is_admin()
DROP POLICY IF EXISTS "pc_select_admin" ON public.parent_children;
CREATE POLICY "pc_select_admin" ON public.parent_children
  FOR SELECT USING (public._is_admin());

-- ═══════════════════════════════════════════════════════════
-- 3. Przebuduj inne polityki ktore odwoluja sie do profiles
--    (przez EXISTS) — uzywamy helperow zeby uniknac rekurencji
-- ═══════════════════════════════════════════════════════════

-- word_error_reports — admin widzi wszystkie, aktualizuje, usuwa
DROP POLICY IF EXISTS "wer_select_admin" ON public.word_error_reports;
CREATE POLICY "wer_select_admin" ON public.word_error_reports
  FOR SELECT USING (public._is_admin());

DROP POLICY IF EXISTS "wer_update_admin" ON public.word_error_reports;
CREATE POLICY "wer_update_admin" ON public.word_error_reports
  FOR UPDATE USING (public._is_admin());

DROP POLICY IF EXISTS "wer_delete_admin" ON public.word_error_reports;
CREATE POLICY "wer_delete_admin" ON public.word_error_reports
  FOR DELETE USING (public._is_admin());

-- conversations — admin widzi wszystkie, aktualizuje
DROP POLICY IF EXISTS "conv_select_admin" ON public.conversations;
CREATE POLICY "conv_select_admin" ON public.conversations
  FOR SELECT USING (public._is_admin());

DROP POLICY IF EXISTS "conv_update_admin" ON public.conversations;
CREATE POLICY "conv_update_admin" ON public.conversations
  FOR UPDATE USING (public._is_admin());

-- conversation_messages — admin widzi wszystkie, moze pisac
DROP POLICY IF EXISTS "msg_select_admin" ON public.conversation_messages;
CREATE POLICY "msg_select_admin" ON public.conversation_messages
  FOR SELECT USING (public._is_admin());

DROP POLICY IF EXISTS "msg_insert_admin" ON public.conversation_messages;
CREATE POLICY "msg_insert_admin" ON public.conversation_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND sender_is_admin = TRUE
    AND public._is_admin()
  );

-- daily_xp_log — jesli istnieje (z add-daily-xp-history.sql) i ma polityke admina
-- (brak throw jesli nie istnieje: DROP IF EXISTS jest bezpieczny)
DROP POLICY IF EXISTS "dxp_select_admin"  ON public.daily_xp_log;
DROP POLICY IF EXISTS "dxp_select_teacher" ON public.daily_xp_log;
DROP POLICY IF EXISTS "dxp_select_parent"  ON public.daily_xp_log;

-- Recreate jesli tabela istnieje
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='daily_xp_log') THEN
    EXECUTE 'CREATE POLICY "dxp_select_admin"   ON public.daily_xp_log FOR SELECT USING (public._is_admin())';
    EXECUTE 'CREATE POLICY "dxp_select_teacher" ON public.daily_xp_log FOR SELECT USING (public._is_teacher())';
    EXECUTE 'CREATE POLICY "dxp_select_parent"  ON public.daily_xp_log FOR SELECT USING (public._is_parent_of(daily_xp_log.user_id))';
  END IF;
END$$;
