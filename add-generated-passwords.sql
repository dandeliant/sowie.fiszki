-- ═══════════════════════════════════════════════════════════════
--  GENEROWANE HASŁA UCZNIÓW — kolumna profiles.generated_password
-- ═══════════════════════════════════════════════════════════════
--
--  Po wygenerowaniu hasła przez system (masowe tworzenie kont,
--  pojedyncze konto z auto-hasłem, reset hasła) zapisujemy je w
--  kolumnie generated_password — żeby nauczyciel/admin mógł
--  ponownie wydrukować dane logowania.
--
--  RLS: SELECT na profiles już filtruje po created_by = auth.uid()
--  dla nauczycieli (z migracji fix-rls-recursion.sql), więc
--  nauczyciel widzi hasła tylko swoich uczniów. Admin widzi
--  wszystko. Hasło jest jawne — to świadoma decyzja, bo dotyczy
--  TYLKO haseł, które program sam wygenerował (uczeń ich i tak
--  nie wybrał, są zapisane na wydruku, więc nic nie ujawniamy
--  prywatnego).
--
--  Uruchom raz w Supabase → SQL Editor → Run. Idempotentne.
-- ═══════════════════════════════════════════════════════════════

-- 1. Dodaj kolumnę
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS generated_password TEXT;

-- 2. RPC: zapisanie/wyczyszczenie hasła generowanego
--    Wywołuje to klient po admin_create_user (bulk lub single).
CREATE OR REPLACE FUNCTION public.set_generated_password(
  p_user_id  UUID,
  p_password TEXT  -- NULL = usuwa zapisane hasło
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_teacher BOOLEAN;
  v_creator UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  SELECT is_admin, is_teacher
    INTO v_is_admin, v_is_teacher
    FROM public.profiles WHERE id = auth.uid();

  IF (v_is_admin IS NOT TRUE) AND (v_is_teacher IS NOT TRUE) THEN
    RAISE EXCEPTION 'Brak uprawnień — wymagana rola administratora lub nauczyciela.';
  END IF;

  -- Sprawdź, że ofiara została utworzona przez wywołującego (lub wywołujący jest adminem)
  SELECT created_by INTO v_creator FROM public.profiles WHERE id = p_user_id;

  IF (v_is_admin IS NOT TRUE) AND (v_creator IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Możesz zapisać hasło tylko utworzonych przez siebie uczniów.';
  END IF;

  UPDATE public.profiles
  SET generated_password = p_password
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika o podanym ID.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_generated_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_generated_password(UUID, TEXT) TO authenticated;

-- 3. Zaktualizuj admin_reset_user_password tak, aby zapisywał nowe
--    hasło w generated_password (replikacja istniejącej walidacji,
--    bo CREATE OR REPLACE musi zachować całe ciało).
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
  v_is_admin       BOOLEAN;
  v_is_teacher     BOOLEAN;
  v_target_admin   BOOLEAN;
  v_target_teacher BOOLEAN;
  v_in_my_class    BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Hasło musi mieć co najmniej 6 znaków.';
  END IF;

  SELECT is_admin, is_teacher
    INTO v_is_admin, v_is_teacher
    FROM public.profiles WHERE id = auth.uid();

  IF (v_is_admin IS NOT TRUE) AND (v_is_teacher IS NOT TRUE) THEN
    RAISE EXCEPTION 'Brak uprawnień — wymagana rola administratora lub nauczyciela.';
  END IF;

  SELECT is_admin, is_teacher
    INTO v_target_admin, v_target_teacher
    FROM public.profiles WHERE id = p_user_id;

  IF v_target_admin IS NULL AND v_target_teacher IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika o podanym ID.';
  END IF;

  IF v_target_admin = TRUE THEN
    RAISE EXCEPTION 'Nie można zresetować hasła administratora.';
  END IF;

  IF v_is_admin IS NOT TRUE THEN
    IF v_target_teacher = TRUE THEN
      RAISE EXCEPTION 'Nie można zresetować hasła innego nauczyciela.';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.class_members cm
      JOIN public.classes c ON c.id = cm.class_id
      WHERE cm.user_id = p_user_id AND c.teacher_id = auth.uid()
    ) INTO v_in_my_class;
    IF v_in_my_class IS NOT TRUE THEN
      RAISE EXCEPTION 'Możesz resetować hasła tylko uczniów w Twoich klasach.';
    END IF;
  END IF;

  -- Zmień hasło w auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie udało się zaktualizować hasła.';
  END IF;

  -- Zapisz nowe hasło w profiles (jawne — nauczyciel może je później ponownie wydrukować)
  UPDATE public.profiles
  SET generated_password = p_new_password
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_user_password(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(UUID, TEXT) TO authenticated;

SELECT 'OK — generated_password gotowe (kolumna + set_generated_password + admin_reset_user_password update)' AS status;
