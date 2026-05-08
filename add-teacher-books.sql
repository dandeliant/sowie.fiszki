-- ═══════════════════════════════════════════════════════════════
-- Migracja #33: Wlasne podreczniki nauczyciela (teacher-owned admin_books)
-- ═══════════════════════════════════════════════════════════════
--
-- Cel:
-- Pozwolic kazdemu nauczycielowi tworzyc wlasne podreczniki/unity/slowa
-- (zapisywane w istniejacych tabelach admin_books / admin_units / admin_words),
-- ktore sa:
--   - widoczne dla samego nauczyciela (panel + edycja),
--   - widoczne dla jego uczniow PO PRZYDZIELENIU przez user_books,
--   - NIEWIDOCZNE dla innych nauczycieli (prywatne).
--
-- Tier: Free (nie wymaga Premium ucznia/nauczyciela).
-- Inni nauczyciele NIE widza tych podrecznikow w swoich panelach.
--
-- Kolumna admin_books.created_by JUZ ISTNIEJE (db.js zawsze ja wypelnia).
-- Migracja zmienia tylko polityki RLS, nie dodaje kolumn.
--
-- Idempotentna — moze byc uruchomiona wielokrotnie.

-- ═══ admin_books ═══════════════════════════════════════════════
ALTER TABLE public.admin_books ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_books_select ON public.admin_books;
DROP POLICY IF EXISTS admin_books_select_all ON public.admin_books;
DROP POLICY IF EXISTS admin_books_insert ON public.admin_books;
DROP POLICY IF EXISTS admin_books_update ON public.admin_books;
DROP POLICY IF EXISTS admin_books_delete ON public.admin_books;
DROP POLICY IF EXISTS admin_books_modify ON public.admin_books;
DROP POLICY IF EXISTS admin_books_admin_only ON public.admin_books;
DROP POLICY IF EXISTS "admin_books: select all" ON public.admin_books;
DROP POLICY IF EXISTS "admin_books: admin all" ON public.admin_books;

-- SELECT:
-- - admin: widzi wszystko
-- - tworca (created_by = self): widzi wlasne (nauczyciel widzi swoje)
-- - kazdy: widzi podreczniki utworzone przez admina (publiczne)
-- - student/parent/nauczyciel: widzi tez te przydzielone (user_books)
CREATE POLICY admin_books_select ON public.admin_books FOR SELECT
  USING (
    public._is_admin()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = admin_books.created_by AND p.is_admin = true
    )
    OR EXISTS (
      SELECT 1 FROM public.user_books ub
      WHERE ub.book_id = admin_books.book_id AND ub.user_id = auth.uid()
    )
  );

-- INSERT:
-- - admin: zawsze
-- - teacher: tylko jesli created_by = self
CREATE POLICY admin_books_insert ON public.admin_books FOR INSERT
  WITH CHECK (
    public._is_admin()
    OR (public._is_teacher() AND created_by = auth.uid())
  );

-- UPDATE: admin lub tworca
CREATE POLICY admin_books_update ON public.admin_books FOR UPDATE
  USING (public._is_admin() OR created_by = auth.uid())
  WITH CHECK (public._is_admin() OR created_by = auth.uid());

-- DELETE: admin lub tworca
CREATE POLICY admin_books_delete ON public.admin_books FOR DELETE
  USING (public._is_admin() OR created_by = auth.uid());


-- ═══ admin_units ═══════════════════════════════════════════════
ALTER TABLE public.admin_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_units_select ON public.admin_units;
DROP POLICY IF EXISTS admin_units_select_all ON public.admin_units;
DROP POLICY IF EXISTS admin_units_insert ON public.admin_units;
DROP POLICY IF EXISTS admin_units_update ON public.admin_units;
DROP POLICY IF EXISTS admin_units_delete ON public.admin_units;
DROP POLICY IF EXISTS admin_units_modify ON public.admin_units;
DROP POLICY IF EXISTS admin_units_admin_only ON public.admin_units;
DROP POLICY IF EXISTS "admin_units: select all" ON public.admin_units;
DROP POLICY IF EXISTS "admin_units: admin all" ON public.admin_units;

-- Unity dziedzicza widocznosc po podreczniku-rodzicu.
-- Jezeli ktos widzi admin_books wpis dla danego book_id, zobaczy tez admin_units.
-- (Polityka admin_books_select juz robi heavy lifting — tu wystarczy EXISTS.)
CREATE POLICY admin_units_select ON public.admin_units FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.admin_books ab WHERE ab.book_id = admin_units.book_id)
  );

-- Modyfikacja: admin lub wlasciciel rodzicowskiego podrecznika
CREATE POLICY admin_units_insert ON public.admin_units FOR INSERT
  WITH CHECK (
    public._is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_books ab
      WHERE ab.book_id = admin_units.book_id
        AND ab.created_by = auth.uid()
    )
  );
CREATE POLICY admin_units_update ON public.admin_units FOR UPDATE
  USING (
    public._is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_books ab
      WHERE ab.book_id = admin_units.book_id
        AND ab.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public._is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_books ab
      WHERE ab.book_id = admin_units.book_id
        AND ab.created_by = auth.uid()
    )
  );
CREATE POLICY admin_units_delete ON public.admin_units FOR DELETE
  USING (
    public._is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_books ab
      WHERE ab.book_id = admin_units.book_id
        AND ab.created_by = auth.uid()
    )
  );


-- ═══ admin_words ═══════════════════════════════════════════════
ALTER TABLE public.admin_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_words_select ON public.admin_words;
DROP POLICY IF EXISTS admin_words_select_all ON public.admin_words;
DROP POLICY IF EXISTS admin_words_insert ON public.admin_words;
DROP POLICY IF EXISTS admin_words_update ON public.admin_words;
DROP POLICY IF EXISTS admin_words_delete ON public.admin_words;
DROP POLICY IF EXISTS admin_words_modify ON public.admin_words;
DROP POLICY IF EXISTS admin_words_admin_only ON public.admin_words;
DROP POLICY IF EXISTS "admin_words: select all" ON public.admin_words;
DROP POLICY IF EXISTS "admin_words: admin all" ON public.admin_words;

-- Slowa dziedzicza widocznosc po podreczniku-rodzicu (jak unity).
CREATE POLICY admin_words_select ON public.admin_words FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.admin_books ab WHERE ab.book_id = admin_words.book_id)
  );

CREATE POLICY admin_words_insert ON public.admin_words FOR INSERT
  WITH CHECK (
    public._is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_books ab
      WHERE ab.book_id = admin_words.book_id
        AND ab.created_by = auth.uid()
    )
  );
CREATE POLICY admin_words_update ON public.admin_words FOR UPDATE
  USING (
    public._is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_books ab
      WHERE ab.book_id = admin_words.book_id
        AND ab.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public._is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_books ab
      WHERE ab.book_id = admin_words.book_id
        AND ab.created_by = auth.uid()
    )
  );
CREATE POLICY admin_words_delete ON public.admin_words FOR DELETE
  USING (
    public._is_admin()
    OR EXISTS (
      SELECT 1 FROM public.admin_books ab
      WHERE ab.book_id = admin_words.book_id
        AND ab.created_by = auth.uid()
    )
  );

-- Komunikat finalny
DO $$ BEGIN
  RAISE NOTICE 'OK — wlasne podreczniki nauczyciela aktywne. Nauczyciel widzi: admin + wlasne. Uczen widzi: admin + przydzielone (user_books).';
END $$;
