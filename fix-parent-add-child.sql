-- ═══════════════════════════════════════════════════════════
-- FIX: dodawanie dziecka przez Rodzica/Opiekuna (parent_children)
-- ═══════════════════════════════════════════════════════════
-- Problem: polityka INSERT pc_insert_parent (z add-parent-role.sql)
-- wymaga sprawdzenia profilu dziecka:
--   EXISTS (SELECT 1 FROM profiles WHERE id = child_id AND is_admin=FALSE ...)
-- Ale polityka SELECT na profiles dla rodzica (prof_select_parent_child)
-- wymaga juz istniejacej relacji w parent_children (helper _is_parent_of).
-- Powstaje petla: rodzic nie moze wstawic, bo nie widzi profilu dziecka,
-- a nie widzi profilu, bo nie ma jeszcze relacji.
--
-- Skutek: blad "new row violates row-level security policy".
--
-- Rozwiazanie: RPC parent_add_child(p_child_id) z SECURITY DEFINER —
-- omija RLS, waliduje serwerowo (rola rodzica + rola dziecka), wstawia
-- wpis. Polityka pc_insert_parent zostaje uproszczona — tylko
-- parent_id = auth.uid() + rodzic ma is_parent=TRUE. RPC robi reszte.
--
-- Idempotentna.

-- 1) Uproszczona polityka INSERT (bez sprawdzania roli dziecka — robi to RPC)
DROP POLICY IF EXISTS "pc_insert_parent" ON public.parent_children;
CREATE POLICY "pc_insert_parent" ON public.parent_children
  FOR INSERT WITH CHECK (
    parent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_parent = TRUE)
  );

-- 2) RPC: bezpieczne dodanie dziecka z walidacja roli (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.parent_add_child(p_child_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_relid     UUID;
  v_is_parent BOOLEAN;
  v_child_ok  BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Brak sesji.';
  END IF;
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'Brak ID dziecka.';
  END IF;
  IF p_child_id = v_uid THEN
    RAISE EXCEPTION 'Nie mozesz dodac siebie jako dziecka.';
  END IF;

  -- Czy zalogowany jest opiekunem?
  SELECT COALESCE(is_parent, FALSE) INTO v_is_parent
    FROM public.profiles WHERE id = v_uid;
  IF NOT v_is_parent THEN
    RAISE EXCEPTION 'Tylko opiekun moze dodawac dzieci.';
  END IF;

  -- Czy docelowe konto jest uczniem (nie admin/nauczyciel/opiekun)?
  SELECT (COALESCE(is_admin, FALSE) = FALSE
       AND COALESCE(is_teacher, FALSE) = FALSE
       AND COALESCE(is_parent, FALSE) = FALSE)
    INTO v_child_ok
    FROM public.profiles WHERE id = p_child_id;
  IF v_child_ok IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono konta o podanym ID.';
  END IF;
  IF NOT v_child_ok THEN
    RAISE EXCEPTION 'Tego konta nie mozna dodac jako podopiecznego (admin/nauczyciel/opiekun).';
  END IF;

  -- Sprawdz duplikat
  IF EXISTS (SELECT 1 FROM public.parent_children
             WHERE parent_id = v_uid AND child_id = p_child_id) THEN
    RAISE EXCEPTION 'To dziecko juz jest przypisane.';
  END IF;

  -- Insert (omija RLS bo SECURITY DEFINER)
  INSERT INTO public.parent_children(parent_id, child_id)
    VALUES (v_uid, p_child_id)
    RETURNING id INTO v_relid;

  RETURN v_relid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.parent_add_child(UUID) TO authenticated;

SELECT 'OK — pc_insert_parent uproszczona, parent_add_child gotowy' AS status;
