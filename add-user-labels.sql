-- ═══════════════════════════════════════════════════════════
-- PRYWATNE ETYKIETY UZYTKOWNIKOW (user_labels)
-- ═══════════════════════════════════════════════════════════
-- Admin / nauczyciel / opiekun moga podpisywac sobie uczniow/dzieci
-- wlasna notatka (np. imie + pierwsze 4 litery nazwiska). Etykieta
-- jest widoczna TYLKO dla osoby, ktora ja dodala (autora etykiety).
--
-- Typowy uzytkowanie:
--   - admin doda: "jankowalski22" -> "Jan Kowa" (widzi to tylko admin)
--   - nauczyciel A doda: "pb2314" -> "Piotr Babi" (widzi to tylko nauczyciel A)
--   - nauczyciel B moze miec inna etykiete dla tego samego ucznia
--
-- Jeden wiersz per para (labeler_id, target_user_id).
-- Idempotentna — mozna ponowic.

CREATE TABLE IF NOT EXISTS public.user_labels (
  labeler_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label          TEXT NOT NULL CHECK (length(btrim(label)) > 0 AND length(label) <= 80),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (labeler_id, target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_labels_labeler ON public.user_labels(labeler_id);

ALTER TABLE public.user_labels ENABLE ROW LEVEL SECURITY;

-- SELECT: tylko autor widzi swoje etykiety
DROP POLICY IF EXISTS "ul_select_own" ON public.user_labels;
CREATE POLICY "ul_select_own" ON public.user_labels
  FOR SELECT USING (labeler_id = auth.uid());

-- INSERT: tylko autor moze dodac, i tylko dla siebie (labeler_id = auth.uid()).
-- Dodatkowo: tylko admin/nauczyciel/opiekun moga nadawac etykiety.
-- Uzywamy helperow _is_admin/_is_teacher/_is_parent_of z migracji #20,
-- jesli nie sa dostepne — fallback do bezposredniego query profiles.
DROP POLICY IF EXISTS "ul_insert_own" ON public.user_labels;
CREATE POLICY "ul_insert_own" ON public.user_labels
  FOR INSERT WITH CHECK (
    labeler_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND (COALESCE(is_admin, FALSE) OR COALESCE(is_teacher, FALSE) OR COALESCE(is_parent, FALSE))
    )
  );

-- UPDATE: tylko autor moze edytowac swoje etykiety
DROP POLICY IF EXISTS "ul_update_own" ON public.user_labels;
CREATE POLICY "ul_update_own" ON public.user_labels
  FOR UPDATE USING (labeler_id = auth.uid())
  WITH CHECK (labeler_id = auth.uid());

-- DELETE: tylko autor moze usunac swoje etykiety
DROP POLICY IF EXISTS "ul_delete_own" ON public.user_labels;
CREATE POLICY "ul_delete_own" ON public.user_labels
  FOR DELETE USING (labeler_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_labels TO authenticated;

SELECT 'OK — tabela user_labels utworzona, RLS aktywne' AS status;
