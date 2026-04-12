-- ══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — Funkcja usuwania użytkownika przez admina
--  Uruchom w Supabase SQL Editor (jednorazowo)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sprawdź czy wywołujący jest adminem
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Brak uprawnień administratora';
  END IF;

  -- Nie pozwól usunąć samego siebie
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Nie możesz usunąć własnego konta';
  END IF;

  -- Nie pozwól usunąć innego admina
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Nie możesz usunąć konta administratora';
  END IF;

  -- Usuń powiązane dane
  DELETE FROM public.user_books WHERE user_id = target_user_id;
  DELETE FROM public.class_members WHERE user_id = target_user_id;
  DELETE FROM public.unit_progress WHERE user_id = target_user_id;
  DELETE FROM public.admin_requests WHERE user_id = target_user_id;
  DELETE FROM public.word_sentences WHERE updated_by = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Usuń z auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

SELECT 'OK — funkcja admin_delete_user gotowa' AS status;