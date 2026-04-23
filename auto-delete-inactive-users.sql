-- ═══════════════════════════════════════════════════════════
-- AUTO-USUWANIE KONT NIEAKTYWNYCH ≥ 1 ROK
-- ═══════════════════════════════════════════════════════════
-- RPC public.auto_delete_inactive_users() — wywolywany przez admina
-- (np. automatycznie przy logowaniu, raz dziennie). Usuwa konta uczniow
-- (nie admina / nauczyciela / opiekuna) ktorzy:
--   - mieli last_study_date > 1 rok temu, LUB
--   - nigdy sie nie logowali, a konto starsze niz 1 rok.
-- Zwraca liczbe usunietych kont. Idempotentna — bezpieczna do ponownego
-- uruchomienia (DROP + CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.auto_delete_inactive_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INTEGER := 0;
  v_id    UUID;
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '1 year';
BEGIN
  -- Tylko admin moze wywolac
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE) THEN
    RAISE EXCEPTION 'Tylko admin moze wywolac auto-usuwanie nieaktywnych kont.';
  END IF;

  FOR v_id IN
    SELECT p.id
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE COALESCE(p.is_admin,   FALSE) = FALSE
      AND COALESCE(p.is_teacher, FALSE) = FALSE
      AND COALESCE(p.is_parent,  FALSE) = FALSE
      AND (
            (p.last_study_date IS NOT NULL AND p.last_study_date < v_cutoff)
         OR (p.last_study_date IS NULL AND u.created_at < v_cutoff)
      )
  LOOP
    -- Usuwamy uzytkownika auth (CASCADE usuwa profile, user_books, unit_progress, itd.)
    BEGIN
      DELETE FROM auth.users WHERE id = v_id;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Nie przerywaj petli jesli jeden user sie nie uda — loguj i kontynuuj
      RAISE NOTICE 'Nie udalo sie usunac %: %', v_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_delete_inactive_users() TO authenticated;
