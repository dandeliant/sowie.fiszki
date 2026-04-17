-- ═══════════════════════════════════════════════════════════════
--  TEACHER SETS — tabele + RLS
-- ═══════════════════════════════════════════════════════════════
--
--  Zestawy słownictwa tworzone przez nauczyciela, przypisywane do
--  klas, prywatne (widoczne tylko właścicielowi i przypisanym
--  uczniom — uczeń SELECT zostanie dołożony w Etapie 3).
--
--  Uruchom jednorazowo w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1) Tabela: teacher_sets ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_sets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  school_type TEXT,                    -- 'primary' | 'secondary' | 'other'
  grade       INT,                     -- 1..8 (null dla 'other')
  topic       TEXT,                    -- np. 'Food', 'School', 'Custom'
  source_note TEXT,                    -- informacyjne — „np. używany podręcznik"
  is_public   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teacher_sets_owner ON public.teacher_sets (owner_id);

-- ── 2) Tabela: teacher_words ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_words (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      UUID        NOT NULL REFERENCES public.teacher_sets(id) ON DELETE CASCADE,
  word        TEXT        NOT NULL,   -- słowo w języku obcym
  translation TEXT        NOT NULL,   -- tłumaczenie (zwykle polskie)
  example     TEXT,                   -- przykład zdania (opcjonalny)
  position    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teacher_words_set ON public.teacher_words (set_id);

-- ── 3) Tabela: teacher_assignments (zestaw → klasa) ──────────────
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      UUID        NOT NULL REFERENCES public.teacher_sets(id) ON DELETE CASCADE,
  class_id    UUID        NOT NULL REFERENCES public.classes(id)      ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(set_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON public.teacher_assignments (class_id);

-- ── 4) RLS ───────────────────────────────────────────────────────
ALTER TABLE public.teacher_sets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_words       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

-- Nauczyciel-właściciel: pełny dostęp do swoich zestawów
DROP POLICY IF EXISTS "teacher_sets: owner ALL" ON public.teacher_sets;
CREATE POLICY "teacher_sets: owner ALL"
  ON public.teacher_sets FOR ALL
  USING      (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Admin: pełny dostęp do wszystkich zestawów
DROP POLICY IF EXISTS "teacher_sets: admin ALL" ON public.teacher_sets;
CREATE POLICY "teacher_sets: admin ALL"
  ON public.teacher_sets FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Słowa: dostęp przez właściciela zestawu
DROP POLICY IF EXISTS "teacher_words: owner ALL" ON public.teacher_words;
CREATE POLICY "teacher_words: owner ALL"
  ON public.teacher_words FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.teacher_sets s WHERE s.id = set_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teacher_sets s WHERE s.id = set_id AND s.owner_id = auth.uid()));

-- Słowa: admin
DROP POLICY IF EXISTS "teacher_words: admin ALL" ON public.teacher_words;
CREATE POLICY "teacher_words: admin ALL"
  ON public.teacher_words FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- Przypisania: dostęp przez właściciela zestawu
DROP POLICY IF EXISTS "teacher_assignments: owner ALL" ON public.teacher_assignments;
CREATE POLICY "teacher_assignments: owner ALL"
  ON public.teacher_assignments FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.teacher_sets s WHERE s.id = set_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teacher_sets s WHERE s.id = set_id AND s.owner_id = auth.uid()));

-- Przypisania: admin
DROP POLICY IF EXISTS "teacher_assignments: admin ALL" ON public.teacher_assignments;
CREATE POLICY "teacher_assignments: admin ALL"
  ON public.teacher_assignments FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE));

-- ── 5) Trigger aktualizujący updated_at na teacher_sets ──────────
CREATE OR REPLACE FUNCTION public.tf_teacher_sets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teacher_sets_updated_at ON public.teacher_sets;
CREATE TRIGGER trg_teacher_sets_updated_at
  BEFORE UPDATE ON public.teacher_sets
  FOR EACH ROW EXECUTE FUNCTION public.tf_teacher_sets_updated_at();

SELECT 'OK — teacher_sets / teacher_words / teacher_assignments + RLS gotowe' AS status;
