-- ═══════════════════════════════════════════════════════════
-- BOOK ACCESS OVERRIDES (book_access_overrides) — migracja #27
-- ═══════════════════════════════════════════════════════════
-- Globalne ustawienia widoczności podręcznika per rola + tier (Free/Premium).
-- Domyślnie podręczniki w data.js mają flagi `defaultAccess` i `adminOnly`,
-- z których wyprowadzane są początkowe wartości w UI. Admin może je
-- nadpisać dla konkretnego podręcznika przez modal "🔓 Dostęp → ⚙️ Globalnie".
--
-- Każdy wiersz reprezentuje pełny zestaw ustawień dla jednego podręcznika.
-- Brak wiersza = używaj domyślnych z data.js (defaultAccess/adminOnly).
--
-- Idempotentna — można uruchomić ponownie.

CREATE TABLE IF NOT EXISTS public.book_access_overrides (
  book_id            TEXT PRIMARY KEY CHECK (length(btrim(book_id)) > 0),
  visible_to_guest   BOOLEAN NOT NULL,
  visible_to_student BOOLEAN NOT NULL,
  visible_to_teacher BOOLEAN NOT NULL,
  visible_to_parent  BOOLEAN NOT NULL,
  tier               TEXT    NOT NULL CHECK (tier IN ('free', 'premium')),
  updated_by         UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.book_access_overrides ENABLE ROW LEVEL SECURITY;

-- SELECT: każdy zalogowany + gość (bo każdy klient musi znać ustawienia,
-- żeby filtrować listę podręczników). Anon też potrzebuje (tryb gościa).
DROP POLICY IF EXISTS "bao_select_all" ON public.book_access_overrides;
CREATE POLICY "bao_select_all" ON public.book_access_overrides
  FOR SELECT USING (TRUE);

-- INSERT/UPDATE/DELETE: tylko admin (helper _is_admin z migracji #20).
-- Fallback do bezpośredniego query, jeśli helper niedostępny.
DROP POLICY IF EXISTS "bao_write_admin" ON public.book_access_overrides;
CREATE POLICY "bao_write_admin" ON public.book_access_overrides
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND COALESCE(is_admin, FALSE) = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND COALESCE(is_admin, FALSE) = TRUE
    )
  );

GRANT SELECT ON public.book_access_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.book_access_overrides TO authenticated;

SELECT 'OK — tabela book_access_overrides utworzona, RLS aktywne (SELECT all, write admin only)' AS status;
