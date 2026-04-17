-- ═══════════════════════════════════════════════════════════════
--  DELETE OWN ACCOUNT — funkcja + polityki RLS
-- ═══════════════════════════════════════════════════════════════
--
--  Użytkownik może samodzielnie usunąć swoje konto („prawo do bycia
--  zapomnianym" — RODO art. 17). Funkcja czyści powiązane dane
--  we wszystkich tabelach, a na końcu usuwa wpis z auth.users.
--
--  Nauczyciel: jego klasy są usuwane (uczniowie pozostają; tracą
--  tylko przynależność do tych klas). is_admin NIE może samodzielnie
--  skasować konta admina (bezpieczniej — niech drugi admin to zrobi).
--
--  Uruchom w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany.';
  END IF;

  -- Zabezpieczenie: admin nie może sam sobie usunąć konta
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = v_user_id;
  IF v_is_admin = TRUE THEN
    RAISE EXCEPTION 'Konta administratora nie można usunąć samodzielnie. Skontaktuj się z innym administratorem.';
  END IF;

  -- 1) Jeśli nauczyciel — zerwij powiązania uczniów z jego klasami, potem usuń klasy.
  DELETE FROM public.class_members
    WHERE class_id IN (SELECT id FROM public.classes WHERE teacher_id = v_user_id);
  DELETE FROM public.classes WHERE teacher_id = v_user_id;

  -- 2) Członkostwa w klasach innych nauczycieli (gdy uczeń)
  DELETE FROM public.class_members WHERE user_id = v_user_id;

  -- 3) Dane nauki
  DELETE FROM public.user_books    WHERE user_id = v_user_id;
  DELETE FROM public.unit_progress WHERE user_id = v_user_id;

  -- 4) Ewentualne prośby o uprawnienia admina (jeśli powiązane po username)
  DELETE FROM public.admin_requests
    WHERE username = (SELECT username FROM public.profiles WHERE id = v_user_id);

  -- 5) Profil
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- 6) Konto w auth.users — ostatnia czynność (po tym JWT przestaje być ważny)
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN 'ok';
END;
$$;

-- Pozwól zalogowanym użytkownikom wywołać funkcję
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- Opcjonalna polityka RLS — DELETE na własnym profilu (dla spójności;
-- funkcja wyżej i tak działa przez SECURITY DEFINER)
DROP POLICY IF EXISTS "profiles: własny DELETE" ON public.profiles;
CREATE POLICY "profiles: własny DELETE"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

SELECT 'OK — delete_own_account gotowe' AS status;
