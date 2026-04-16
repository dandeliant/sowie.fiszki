-- ═══════════════════════════════════════════════════════════════
--  SYNC: is_teacher <— plan
-- ═══════════════════════════════════════════════════════════════
--
--  Jednorazowa synchronizacja istniejących danych: ustaw is_teacher
--  zgodnie z kolumną plan. Po tym SQL-u plan='teacher' i is_teacher
--  zawsze będą spójne (zgodnie z nową logiką setUserPlan w db.js).
--
--  Nie rusza is_admin. Nie rusza użytkowników, dla których plan
--  i is_teacher już są spójne.
--
--  Uruchom raz w Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- Nadaj rolę nauczyciela tam, gdzie plan='teacher', a is_teacher=false
UPDATE public.profiles
SET is_teacher = TRUE
WHERE plan = 'teacher' AND is_teacher IS DISTINCT FROM TRUE;

-- Zdejmij rolę nauczyciela tam, gdzie plan <> 'teacher', a is_teacher=true
-- (uwaga: nie ruszamy adminów — mogą być też nauczycielami z własnego wyboru)
UPDATE public.profiles
SET is_teacher = FALSE
WHERE plan <> 'teacher'
  AND is_teacher = TRUE
  AND is_admin IS DISTINCT FROM TRUE;

-- Weryfikacja (opcjonalna): lista wynikowa
-- SELECT username, plan, is_teacher, is_admin
-- FROM public.profiles
-- ORDER BY username;
