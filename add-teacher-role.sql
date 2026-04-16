-- Dodaj kolumnę is_teacher do profiles + RLS
-- Uruchom w Supabase SQL Editor (jednorazowo)

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_teacher BOOLEAN DEFAULT false;

-- Funkcja is_teacher() (jak is_admin)
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_teacher FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    FALSE
  );
$$;

-- Nauczyciel może czytać profile (żeby widzieć uczniów)
DROP POLICY IF EXISTS "profiles: teacher SELECT all" ON public.profiles;
CREATE POLICY "profiles: teacher SELECT all"
  ON public.profiles FOR SELECT
  USING (public.is_teacher());

-- Nauczyciel może zarządzać klasami
DROP POLICY IF EXISTS "classes: teacher all" ON public.classes;
CREATE POLICY "classes: teacher all"
  ON public.classes FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "class_members: teacher all" ON public.class_members;
CREATE POLICY "class_members: teacher all"
  ON public.class_members FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- Nauczyciel może zarządzać dostępem (user_books)
DROP POLICY IF EXISTS "user_books: teacher all" ON public.user_books;
CREATE POLICY "user_books: teacher all"
  ON public.user_books FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

SELECT 'OK — is_teacher + RLS dla nauczyciela gotowe' AS status;