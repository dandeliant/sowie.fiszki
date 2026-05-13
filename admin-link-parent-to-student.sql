-- ═══════════════════════════════════════════════════════════
-- admin_link_parent_to_student.sql
-- ═══════════════════════════════════════════════════════════
--
-- Migracja #38 — pozwala adminowi/nauczycielowi automatycznie powiazac
-- konto opiekuna z kontem ucznia podczas masowego tworzenia kont.
--
-- Uzycie z app (db.js):
--   await DB.adminLinkParentToStudent(parentId, studentId);
--
-- Co robi:
--   1. Ustawia is_parent = TRUE na profilu opiekuna.
--   2. Wstawia rekord do parent_children (parent_id, child_id).
--   3. Zwraca void.
--
-- Wymagania:
--   - Caller musi byc admin LUB nauczyciel (RLS sprawdza przez helpery
--     _is_admin / _is_teacher z migracji #20).
--   - Migracja #17 (add-parent-role.sql) — tabela parent_children + is_parent.
--   - Migracja #20 (fix-rls-recursion.sql) — helpery _is_admin / _is_teacher.
--
-- Idempotentna: ON CONFLICT DO NOTHING dla wstawiania, UPDATE bezpieczne.

CREATE OR REPLACE FUNCTION admin_link_parent_to_student(
  p_parent_id UUID,
  p_student_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sprawdz uprawnienia: tylko admin LUB nauczyciel
  IF NOT (_is_admin() OR _is_teacher()) THEN
    RAISE EXCEPTION 'Brak uprawnien — tylko admin lub nauczyciel moga linkowac opiekuna do ucznia';
  END IF;

  -- Sprawdz ze parent_id i student_id sa rozne
  IF p_parent_id = p_student_id THEN
    RAISE EXCEPTION 'parent_id i student_id musza byc rozne';
  END IF;

  -- Sprawdz ze oba konta istnieja
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_parent_id) THEN
    RAISE EXCEPTION 'Konto opiekuna nie istnieje (id: %)', p_parent_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_student_id) THEN
    RAISE EXCEPTION 'Konto ucznia nie istnieje (id: %)', p_student_id;
  END IF;

  -- Ustaw is_parent = TRUE na profilu opiekuna
  UPDATE profiles SET is_parent = TRUE WHERE id = p_parent_id;

  -- Powiaz parent_children (idempotentnie)
  INSERT INTO parent_children (parent_id, child_id)
  VALUES (p_parent_id, p_student_id)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_link_parent_to_student(UUID, UUID) TO authenticated;

DO $$ BEGIN
  RAISE NOTICE 'OK — Migracja #38: admin_link_parent_to_student(parent_id, student_id) zainstalowane. Uzywane przez bulkCreateStudentsForClass(withParents=true) w db.js.';
END $$;
