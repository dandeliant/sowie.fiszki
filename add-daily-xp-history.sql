-- ═══════════════════════════════════════════════════════════
-- HISTORIA DZIENNEGO XP — tabela daily_xp_log
-- ═══════════════════════════════════════════════════════════
-- Trzyma historie zdobytych punktow XP per dzien per uzytkownik.
-- Wykorzystywana do wykresu "Historia nauki 12 miesiecy" (Premium).
-- Pozwala tez opiekunowi/nauczycielowi widziec aktywnosc dziecka/ucznia.
-- Migracja idempotentna.

CREATE TABLE IF NOT EXISTS public.daily_xp_log (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day        DATE NOT NULL,
  xp         INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_dxl_user_day ON public.daily_xp_log(user_id, day DESC);

ALTER TABLE public.daily_xp_log ENABLE ROW LEVEL SECURITY;

-- User widzi wlasne wpisy
DROP POLICY IF EXISTS "dxl_select_own" ON public.daily_xp_log;
CREATE POLICY "dxl_select_own" ON public.daily_xp_log
  FOR SELECT USING (user_id = auth.uid());

-- Opiekun widzi wpisy swoich dzieci
DROP POLICY IF EXISTS "dxl_select_parent_child" ON public.daily_xp_log;
CREATE POLICY "dxl_select_parent_child" ON public.daily_xp_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.parent_children
            WHERE parent_id = auth.uid() AND child_id = daily_xp_log.user_id)
  );

-- Admin widzi wszystko
DROP POLICY IF EXISTS "dxl_select_admin" ON public.daily_xp_log;
CREATE POLICY "dxl_select_admin" ON public.daily_xp_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Nauczyciel widzi wpisy uczniow, ktorych stworzyl (created_by)
DROP POLICY IF EXISTS "dxl_select_teacher_created" ON public.daily_xp_log;
CREATE POLICY "dxl_select_teacher_created" ON public.daily_xp_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = daily_xp_log.user_id
              AND p.created_by = auth.uid()
              AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_teacher = TRUE))
  );

-- Insert/Update — uzytkownik moze aktualizowac tylko swoj wiersz
DROP POLICY IF EXISTS "dxl_upsert_own" ON public.daily_xp_log;
CREATE POLICY "dxl_upsert_own" ON public.daily_xp_log
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dxl_update_own" ON public.daily_xp_log;
CREATE POLICY "dxl_update_own" ON public.daily_xp_log
  FOR UPDATE USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════
-- RPC: dodaj XP do dzisiejszego dnia (upsert)
-- ═══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.log_daily_xp(p_delta INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_xp INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  IF p_delta IS NULL OR p_delta <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.daily_xp_log (user_id, day, xp, updated_at)
    VALUES (auth.uid(), CURRENT_DATE, p_delta, NOW())
    ON CONFLICT (user_id, day) DO UPDATE
      SET xp = daily_xp_log.xp + EXCLUDED.xp,
          updated_at = NOW()
    RETURNING xp INTO v_new_xp;

  RETURN v_new_xp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_daily_xp(INT) TO authenticated;
