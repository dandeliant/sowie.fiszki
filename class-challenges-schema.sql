-- ═══════════════════════════════════════════════════════════
-- WYZWANIA KLASOWE (Wave 2, #8)
-- ═══════════════════════════════════════════════════════════
-- Nauczyciel ustawia wspolny cel dla klasy: "Cala klasa razem opanuje
-- 500 slow do piatku" (typ 'words') albo "zdobedzie 5000 XP" (typ 'xp').
-- Kazdy uczen kontrybuuje, klasa ma wspolny pasek postepu. Postep liczony
-- z daily_xp_log (kolumny xp / words, patrz add-ranking-stats.sql) w oknie
-- [starts_at, ends_at] po wszystkich czlonkach klasy.
-- Wymaga helperow _is_admin()/_is_teacher() z fix-rls-recursion.sql.
-- Migracja idempotentna.

CREATE TABLE IF NOT EXISTS public.class_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL DEFAULT auth.uid(),
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  goal_type   TEXT NOT NULL CHECK (goal_type IN ('words','xp')),
  goal_amount INT  NOT NULL CHECK (goal_amount > 0 AND goal_amount <= 1000000),
  starts_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_at     DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_challenges_class ON public.class_challenges(class_id);

ALTER TABLE public.class_challenges ENABLE ROW LEVEL SECURITY;

-- SELECT: admin, czlonek klasy (uczen widzi swoje wyzwania), wlasciciel klasy
DROP POLICY IF EXISTS cc_select ON public.class_challenges;
CREATE POLICY cc_select ON public.class_challenges FOR SELECT
  USING (
    public._is_admin()
    OR EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = class_challenges.class_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_challenges.class_id AND c.admin_id = auth.uid())
  );

-- INSERT: admin lub nauczyciel-wlasciciel klasy; created_by musi byc autorem
DROP POLICY IF EXISTS cc_insert ON public.class_challenges;
CREATE POLICY cc_insert ON public.class_challenges FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public._is_admin()
      OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_challenges.class_id AND c.admin_id = auth.uid())
    )
  );

-- UPDATE/DELETE: admin lub wlasciciel klasy
DROP POLICY IF EXISTS cc_update ON public.class_challenges;
CREATE POLICY cc_update ON public.class_challenges FOR UPDATE
  USING (
    public._is_admin()
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_challenges.class_id AND c.admin_id = auth.uid())
  );

DROP POLICY IF EXISTS cc_delete ON public.class_challenges;
CREATE POLICY cc_delete ON public.class_challenges FOR DELETE
  USING (
    public._is_admin()
    OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_challenges.class_id AND c.admin_id = auth.uid())
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_challenges TO authenticated;

-- ─── RPC: postep pojedynczego wyzwania ───────────────────────
-- Sumuje xp/words po wszystkich czlonkach klasy w oknie wyzwania.
-- Autoryzacja: caller musi byc adminem, czlonkiem lub wlascicielem klasy.
CREATE OR REPLACE FUNCTION public.class_challenge_progress(p_challenge_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c   public.class_challenges%ROWTYPE;
  v_ok BOOLEAN;
  v_sum INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT * INTO c FROM public.class_challenges WHERE id = p_challenge_id;
  IF c.id IS NULL THEN RETURN 0; END IF;

  SELECT (
    public._is_admin()
    OR EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = c.class_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.classes cl WHERE cl.id = c.class_id AND cl.admin_id = auth.uid())
  ) INTO v_ok;
  IF NOT v_ok THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(CASE WHEN c.goal_type = 'words' THEN d.words ELSE d.xp END), 0)::INT
    INTO v_sum
    FROM public.daily_xp_log d
    JOIN public.class_members m ON m.user_id = d.user_id AND m.class_id = c.class_id
   WHERE d.day BETWEEN c.starts_at AND c.ends_at;

  RETURN COALESCE(v_sum, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.class_challenge_progress(UUID) TO authenticated;

-- ─── RPC: aktywne wyzwania zalogowanego ucznia (z postepem) ──
-- Zwraca wyzwania klas, do ktorych nalezy caller i ktore jeszcze trwaja.
CREATE OR REPLACE FUNCTION public.list_my_active_challenges()
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
       WHERE m.class_id = c.class_id AND m.user_id = auth.uid()
    )
  ORDER BY c.ends_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_active_challenges() TO authenticated;
