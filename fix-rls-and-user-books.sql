-- ══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — Fix RLS + user_books
--  Uruchom CAŁY ten skrypt w Supabase SQL Editor (jednorazowo)
-- ══════════════════════════════════════════════════════════════

-- 1. Upewnij się że funkcja is_admin() istnieje (nie-rekurencyjna)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    FALSE
  );
$$;

-- 2. Usuń STARĄ rekurencyjną politykę na profiles (ta powoduje infinite loop)
DROP POLICY IF EXISTS "profiles: admin SELECT all" ON public.profiles;

-- 3. Dodaj NOWĄ politykę opartą na is_admin() (nie-rekurencyjną)
CREATE POLICY "profiles: admin SELECT all"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- 4. Polityki dla user_books
ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;

-- Użytkownik widzi swoje przypisania
DROP POLICY IF EXISTS "user_books: own select" ON public.user_books;
CREATE POLICY "user_books: own select"
  ON public.user_books FOR SELECT
  USING (auth.uid() = user_id);

-- Admin ma pełny dostęp
DROP POLICY IF EXISTS "user_books: admin all" ON public.user_books;
CREATE POLICY "user_books: admin all"
  ON public.user_books FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. Polityki dla classes (jeśli nie istnieją)
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classes: admin all" ON public.classes;
CREATE POLICY "classes: admin all"
  ON public.classes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. Polityki dla class_members (jeśli nie istnieją)
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_members: admin all" ON public.class_members;
CREATE POLICY "class_members: admin all"
  ON public.class_members FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. Sprawdź wynik
SELECT 'OK — RLS naprawione, user_books gotowe' AS status;