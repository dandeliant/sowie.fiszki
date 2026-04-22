-- ═══════════════════════════════════════════════════════════
-- ROLA RODZIC/OPIEKUN + relacja parent_children
-- ═══════════════════════════════════════════════════════════
-- Dodaje flage is_parent do profiles oraz tabele parent_children
-- mapujaca relacje opiekun-dziecko. Opiekun moze byc rodzicem lub
-- innym prawnym opiekunem. Premium opiekun (plan='premium') moze
-- przydzielac dzieciom dostep do podrecznikow i widziec ich postepy.
-- Migracja idempotentna.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_parent BOOLEAN NOT NULL DEFAULT FALSE;

-- Relacja opiekun ↔ dziecko
CREATE TABLE IF NOT EXISTS public.parent_children (
  id         BIGSERIAL PRIMARY KEY,
  parent_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  child_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_pc_parent ON public.parent_children(parent_id);
CREATE INDEX IF NOT EXISTS idx_pc_child  ON public.parent_children(child_id);

ALTER TABLE public.parent_children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pc_select_own_parent" ON public.parent_children;
CREATE POLICY "pc_select_own_parent" ON public.parent_children
  FOR SELECT USING (parent_id = auth.uid());

DROP POLICY IF EXISTS "pc_select_own_child" ON public.parent_children;
CREATE POLICY "pc_select_own_child" ON public.parent_children
  FOR SELECT USING (child_id = auth.uid());

DROP POLICY IF EXISTS "pc_select_admin" ON public.parent_children;
CREATE POLICY "pc_select_admin" ON public.parent_children
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS "pc_insert_parent" ON public.parent_children;
CREATE POLICY "pc_insert_parent" ON public.parent_children
  FOR INSERT WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_parent = TRUE)
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = child_id AND is_admin = FALSE AND is_teacher = FALSE AND is_parent = FALSE)
  );

DROP POLICY IF EXISTS "pc_delete_parent" ON public.parent_children;
CREATE POLICY "pc_delete_parent" ON public.parent_children
  FOR DELETE USING (parent_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- RLS na istniejacych tabelach — opiekun widzi dane swoich dzieci
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "prof_select_parent_child" ON public.profiles;
CREATE POLICY "prof_select_parent_child" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.parent_children WHERE parent_id = auth.uid() AND child_id = profiles.id)
  );

DROP POLICY IF EXISTS "ub_select_parent_child" ON public.user_books;
CREATE POLICY "ub_select_parent_child" ON public.user_books
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.parent_children WHERE parent_id = auth.uid() AND child_id = user_books.user_id)
  );

DROP POLICY IF EXISTS "up_select_parent_child" ON public.unit_progress;
CREATE POLICY "up_select_parent_child" ON public.unit_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.parent_children WHERE parent_id = auth.uid() AND child_id = unit_progress.user_id)
  );

-- ═══════════════════════════════════════════════════════════
-- RPC: wyszukiwanie uzytkownika po username (dla "dodaj dziecko")
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.find_user_by_username(p_username TEXT)
RETURNS TABLE(id UUID, username TEXT, is_admin BOOLEAN, is_teacher BOOLEAN, is_parent BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, username, is_admin, is_teacher, is_parent
  FROM public.profiles
  WHERE username = trim(p_username)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_user_by_username(TEXT) TO authenticated;

-- ═══════════════════════════════════════════════════════════
-- RPC: opiekun Premium przydziela podrecznik swojemu dziecku
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.parent_assign_book_to_child(p_child_id UUID, p_book_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_parent = TRUE) THEN
    RAISE EXCEPTION 'Tylko opiekun moze przydzielac podreczniki dzieciom.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND plan = 'premium') THEN
    RAISE EXCEPTION 'Ta funkcja wymaga planu Premium (Opiekun Premium).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parent_children WHERE parent_id = auth.uid() AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'To nie jest Twoje dziecko.';
  END IF;
  INSERT INTO public.user_books(user_id, book_id)
  VALUES (p_child_id, p_book_id)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.parent_assign_book_to_child(UUID, TEXT) TO authenticated;

-- Opiekun Premium moze tez cofac przydzial
CREATE OR REPLACE FUNCTION public.parent_unassign_book_from_child(p_child_id UUID, p_book_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_parent = TRUE) THEN
    RAISE EXCEPTION 'Tylko opiekun.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.parent_children WHERE parent_id = auth.uid() AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'To nie jest Twoje dziecko.';
  END IF;
  DELETE FROM public.user_books WHERE user_id = p_child_id AND book_id = p_book_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.parent_unassign_book_from_child(UUID, TEXT) TO authenticated;
