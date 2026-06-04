-- ═══════════════════════════════════════════════════════════
-- RANKING KLASY WIDOCZNY DLA UCZNIA (Wave 2, #10 — cd.)
-- ═══════════════════════════════════════════════════════════
-- Uczen nie moze czytac daily_xp_log/profiles kolegow (RLS). Ten RPC
-- (SECURITY DEFINER) zwraca zagregowane statystyki wszystkich (nie-staff)
-- czlonkow KLAS, do ktorych nalezy zalogowany uczen — zeby mogl zobaczyc
-- swoja pozycje w 5 kategoriach (XP dzis/tydzien/miesiac, najdluzszy streak,
-- najwieksza seria poprawnych pod rzad).
--
-- WYMAGA wczesniejszej migracji add-ranking-stats.sql (kolumny
-- profiles.best_correct_streak + daily_xp_log.words). Idempotentna.

CREATE OR REPLACE FUNCTION public.my_class_rankings()
RETURNS TABLE (
  class_id       UUID,
  class_name     TEXT,
  user_id        UUID,
  username       TEXT,
  xp_today       INT,
  xp_week        INT,
  xp_month       INT,
  longest_streak INT,
  best_combo     INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cl.id, cl.name, p.id, p.username,
    COALESCE((SELECT SUM(d.xp) FROM public.daily_xp_log d
                WHERE d.user_id = p.id AND d.day = CURRENT_DATE), 0)::INT,
    COALESCE((SELECT SUM(d.xp) FROM public.daily_xp_log d
                WHERE d.user_id = p.id AND d.day >= CURRENT_DATE - INTERVAL '6 days'), 0)::INT,
    COALESCE((SELECT SUM(d.xp) FROM public.daily_xp_log d
                WHERE d.user_id = p.id AND d.day >= CURRENT_DATE - INTERVAL '30 days'), 0)::INT,
    COALESCE(p.longest_streak, 0),
    COALESCE(p.best_correct_streak, 0)
  FROM public.class_members me
  JOIN public.class_members cm ON cm.class_id = me.class_id
  JOIN public.classes  cl ON cl.id = cm.class_id
  JOIN public.profiles p  ON p.id = cm.user_id
  WHERE me.user_id = auth.uid()
    AND COALESCE(p.is_admin, FALSE) = FALSE
    AND COALESCE(p.is_teacher, FALSE) = FALSE;
$$;

GRANT EXECUTE ON FUNCTION public.my_class_rankings() TO authenticated;
