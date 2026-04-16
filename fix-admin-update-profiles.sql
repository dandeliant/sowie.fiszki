-- ═══════════════════════════════════════════════════════════════
--  FIX: Admin może aktualizować dowolny profil (np. kolumnę `plan`)
-- ═══════════════════════════════════════════════════════════════
--
--  Problem: Istniejąca polityka "profiles: własny UPDATE" pozwala
--  użytkownikowi aktualizować TYLKO własny profil (auth.uid() = id).
--  Admin przez to nie mógł zmienić planu innego użytkownika — update
--  wracał z pustym wynikiem (cicha blokada RLS).
--
--  Rozwiązanie: osobna polityka UPDATE dla administratorów.
--
--  Uruchom ten plik w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- Usuń, jeśli już istnieje (idempotentnie)
DROP POLICY IF EXISTS "profiles: admin UPDATE all" ON public.profiles;

CREATE POLICY "profiles: admin UPDATE all"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- Weryfikacja (opcjonalna): wypisz aktualne polityki UPDATE na profiles
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'profiles' AND schemaname = 'public';
