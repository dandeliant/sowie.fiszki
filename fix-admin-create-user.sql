-- ═══════════════════════════════════════════════════════════════
--  FIX — admin_create_user (problem z logowaniem wygenerowanych kont)
-- ═══════════════════════════════════════════════════════════════
--
--  Objaw: nauczyciel/admin tworzy konto przez bulkCreateStudentsForClass,
--  widzi wygenerowane hasło, ale przy logowaniu ucznia pojawia się
--  „Nieprawidłowa nazwa użytkownika lub hasło."
--
--  Przyczyna: poprzednia wersja funkcji wstawiała do auth.users tylko
--  podzbiór kolumn. Nowsze wersje Supabase Auth (gotrue) wymagają,
--  żeby kolumny tokenów (confirmation_token, email_change, recovery_token
--  itd.) miały wartość '' (pusty string), a NIE NULL — inaczej
--  signInWithPassword odrzuca poświadczenia.
--
--  Ta migracja nadpisuje CREATE OR REPLACE funkcję admin_create_user,
--  ustawiając WSZYSTKIE istotne kolumny. Pozostaje idempotentna.
--
--  Dodatkowo: zezwala nauczycielowi (is_teacher) tworzyć konta uczniów.
--  Poprzednia wersja wymagała admina — ale bulkCreateStudentsForClass
--  jest używana również przez nauczycieli (tworzenie klas), więc
--  funkcja musi być dla nich dostępna.
--
--  Uruchom raz w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_username text,
  p_password text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id   uuid;
  v_email       text;
  v_is_admin    boolean;
  v_is_teacher  boolean;
BEGIN
  -- Uprawnienia: admin lub nauczyciel
  SELECT is_admin, is_teacher
  INTO v_is_admin, v_is_teacher
  FROM public.profiles
  WHERE id = auth.uid();

  IF (v_is_admin IS NOT TRUE) AND (v_is_teacher IS NOT TRUE) THEN
    RAISE EXCEPTION 'Brak uprawnień — wymagana rola administratora lub nauczyciela.';
  END IF;

  -- Walidacje
  IF p_username IS NULL OR length(trim(p_username)) < 3 THEN
    RAISE EXCEPTION 'Nazwa użytkownika musi mieć minimum 3 znaki.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username) THEN
    RAISE EXCEPTION 'Nazwa użytkownika "%" jest już zajęta', p_username;
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Hasło musi mieć minimum 6 znaków.';
  END IF;

  v_email     := p_username || '@sowie-fiszki.app';
  new_user_id := extensions.uuid_generate_v4();

  -- INSERT do auth.users — WSZYSTKIE kolumny, które gotrue sprawdza.
  -- Puste stringi ('') dla kolumn tokenów — gotrue NIE akceptuje NULL
  -- dla tych kolumn przy signInWithPassword.
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    email_change_token_current,
    recovery_token,
    reauthentication_token,
    phone_change,
    phone_change_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('username', p_username),
    false,
    now(),
    now(),
    '', '', '', '', '', '', '', ''
  );

  -- auth.identities — nowsze wersje Supabase mają kolumnę id z DEFAULT gen_random_uuid(),
  -- wiec nie ustawiamy jej jawnie. provider_id jako tekst = user_id::text.
  INSERT INTO auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    new_user_id::text,
    jsonb_build_object('sub', new_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  );

  -- Profil tworzy trigger on_auth_user_created, ale fallback dla pewności
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new_user_id) THEN
    INSERT INTO public.profiles (id, username) VALUES (new_user_id, p_username);
  END IF;

  RETURN new_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text) TO authenticated;

SELECT 'OK — admin_create_user zaktualizowane' AS status;
