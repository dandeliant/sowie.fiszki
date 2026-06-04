-- ═══════════════════════════════════════════════════════════
-- WYZWANIA KLASY DZIECKA/UCZNIA — widok dla opiekuna/nauczyciela (Wave 2, #8 cd.)
-- ═══════════════════════════════════════════════════════════
-- Opiekun (i nauczyciel/admin) ogladajac postep konkretnego ucznia widzi
-- aktywne wyzwania klas, do ktorych ten uczen nalezy, wraz ze wspolnym
-- postepem calej klasy. RPC SECURITY DEFINER, autoryzacja:
--   _is_admin() OR _is_teacher() OR _is_parent_of(p_child_id).
-- Wymaga class-challenges-schema.sql (#46) + add-ranking-stats.sql (#45).
-- Idempotentna.

CREATE OR REPLACE FUNCTION public.child_active_challenges(p_child_id UUID)
RETURNS TABLE (
  id          UUID,
  class_id    UUID,
  class_name  TEXT,
  title       TEXT,
  goal_type   TEXT,
  goal_amount INT,
  ends_at     DATE,
  progress    INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT (public._is_admin() OR public._is_teacher() OR public._is_parent_of(p_child_id)) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT c.id, c.class_id, cl.name, c.title, c.goal_type, c.goal_amount, c.ends_at,
      COALESCE((
        SELECT SUM(CASE WHEN c.goal_type = 'words' THEN d.words ELSE d.xp END)
          FROM public.daily_xp_log d
          JOIN public.class_members m2 ON m2.user_id = d.user_id AND m2.class_id = c.class_id
         WHERE d.day BETWEEN c.starts_at AND c.ends_at
      ), 0)::INT AS progress
    FROM public.class_challenges c
    JOIN public.classes cl ON cl.id = c.class_id
    WHERE c.ends_at >= CURRENT_DATE
      AND EXISTS (
        SELECT 1 FROM public.class_members m
         WHERE m.class_id = c.class_id AND m.user_id = p_child_id
      )
    ORDER BY c.ends_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.child_active_challenges(UUID) TO authenticated;
