-- ══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — Funkcja tworzenia użytkownika przez admina
--  Uruchom w Supabase SQL Editor (jednorazowo)
-- ══════════════════════════════════════════════════════════════

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
  new_user_id uuid;
  v_email text;
BEGIN
  -- Sprawdź uprawnienia
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  -- Sprawdź czy nazwa jest zajęta
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username) THEN
    RAISE EXCEPTION 'Nazwa użytkownika "%" jest już zajęta', p_username;
  END IF;

  -- Sprawdź minimalna długość hasła
  IF length(p_password) < 6 THEN
    RAISE EXCEPTION 'Hasło musi mieć minimum 6 znaków';
  END IF;

  v_email := p_username || '@sowie-fiszki.app';

  -- Utwórz użytkownika w auth.users
  new_user_id := extensions.uuid_generate_v4();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    aud,
    role,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('username', p_username),
    '{"provider":"email","providers":["email"]}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- Utwórz identyfikator w auth.identities
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    new_user_id,
    new_user_id,
    v_email,
    jsonb_build_object('sub', new_user_id::text, 'email', v_email),
    'email',
    now(),
    now(),
    now()
  );

  -- Profil tworzony automatycznie przez trigger on_auth_user_created
  -- ale na wszelki wypadek sprawdź
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new_user_id) THEN
    INSERT INTO public.profiles (id, username) VALUES (new_user_id, p_username);
  END IF;

  RETURN new_user_id;
END;
$$;

SELECT 'OK — funkcja admin_create_user gotowa' AS status;