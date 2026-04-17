-- ═══════════════════════════════════════════════════════════════
--  RESET HASŁA UCZNIA — RPC admin_reset_user_password
-- ═══════════════════════════════════════════════════════════════
--
--  Admin lub nauczyciel generuje po stronie klienta nowe losowe
--  hasło dla ucznia i wywołuje tę funkcję, żeby je zapisać w
--  auth.users. Hasło NIE jest zapisywane w jawnej postaci nigdzie
--  indziej — po jednorazowym pokazaniu w UI przepada z pamięci.
--
--  Uprawnienia:
--    • admin (is_admin) → może resetować hasło dowolnego ucznia
--    • nauczyciel (is_teacher) → tylko uczniów w klasach,
--      których teacher_id = auth.uid()
--    • nikt nie może resetować hasła admina ani nauczyciela
--      (chyba że wywołujący sam jest adminem i ofiara jest
--       tylko nauczycielem — wówczas dozwolone)
--
--  Uruchom raz w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_user_id      UUID,
  p_new_password TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin    BOOLEAN;
  v_is_teacher  BOOLEAN;
  v_target_admin BOOLEAN;
  v_target_teacher BOOLEAN;
  v_in_my_class BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Hasło musi mieć co najmniej 6 znaków.';
  END IF;

  -- Uprawnienia wywołującego
  SELECT is_admin, is_teacher
  INTO v_is_admin, v_is_teacher
  FROM public.profiles WHERE id = auth.uid();

  IF (v_is_admin IS NOT TRUE) AND (v_is_teacher IS NOT TRUE) THEN
    RAISE EXCEPTION 'Brak uprawnień — wymagana rola administratora lub nauczyciela.';
  END IF;

  -- Rola ofiary
  SELECT is_admin, is_teacher
  INTO v_target_admin, v_target_teacher
  FROM public.profiles WHERE id = p_user_id;

  IF v_target_admin IS NULL AND v_target_teacher IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika o podanym ID.';
  END IF;

  -- Nie wolno resetować hasła admina (nawet adminowi — niech to zrobi sam w ustawieniach)
  IF v_target_admin = TRUE THEN
    RAISE EXCEPTION 'Nie można zresetować hasła administratora.';
  END IF;

  -- Nauczyciel: dodatkowe ograniczenia
  IF v_is_admin IS NOT TRUE THEN
    -- Nauczyciel nie może resetować innego nauczyciela
    IF v_target_teacher = TRUE THEN
      RAISE EXCEPTION 'Nie można zresetować hasła innego nauczyciela.';
    END IF;
    -- Nauczyciel może resetować tylko uczniów w swoich klasach
    SELECT EXISTS (
      SELECT 1 FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE cm.user_id = p_user_id AND c.teacher_id = auth.uid()
    ) INTO v_in_my_class;
    IF v_in_my_class IS NOT TRUE THEN
      RAISE EXCEPTION 'Możesz resetować hasła tylko uczniów w Twoich klasach.';
    END IF;
  END IF;

  -- Zmień hasło w auth.users (wymaga rozszerzenia pgcrypto — standard w Supabase)
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie udało się zaktualizować hasła.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;

SELECT 'OK — admin_reset_user_password gotowe' AS status;
