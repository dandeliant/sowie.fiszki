-- ═══════════════════════════════════════════════════════════════
--  MIGRACJA #44: RPC dla statystyk i sprzatania nagran audio
--
--  Dwa RPC dostepne tylko adminowi (sprawdzenie przez _is_admin()
--  z migracji #20):
--
--  1) audio_storage_stats()    — agregacja po Storage (rozmiar/per book)
--  2) audio_orphan_files()     — pliki w bucket word-audio NIE
--                                referencowane w tabeli word_audio
--                                (osierocone — np. zostawione po
--                                nadpisaniach, gdy upload sie udał ale
--                                stary plik nie został usunięty).
--
--  Te dane nie sa dostepne przez zwykle SELECT-y (storage.objects
--  jest pod RLS i wymaga roli serwisowej), wiec uzywamy SECURITY
--  DEFINER z explicite checkem _is_admin().
-- ═══════════════════════════════════════════════════════════════

-- ── 1) STATYSTYKI ROZMIARU / PER PODRECZNIK ──────────────────────
DROP FUNCTION IF EXISTS public.audio_storage_stats();
CREATE OR REPLACE FUNCTION public.audio_storage_stats()
RETURNS TABLE(book_id TEXT, file_count BIGINT, total_bytes BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'Tylko administrator';
  END IF;
  RETURN QUERY
  SELECT
    SPLIT_PART(o.name, '/', 1) AS book_id,
    COUNT(*) AS file_count,
    COALESCE(SUM((o.metadata->>'size')::BIGINT), 0) AS total_bytes
  FROM storage.objects o
  WHERE o.bucket_id = 'word-audio'
  GROUP BY SPLIT_PART(o.name, '/', 1)
  ORDER BY total_bytes DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.audio_storage_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audio_storage_stats() TO authenticated;

-- ── 2) OSIEROCONE PLIKI ──────────────────────────────────────────
-- Pliki w bucket 'word-audio' KTOREJ NAZWY nie pojawiaja sie w
-- zadnej z 5 path-kolumn tabeli word_audio (audio_path + 4 nowe).
DROP FUNCTION IF EXISTS public.audio_orphan_files();
CREATE OR REPLACE FUNCTION public.audio_orphan_files()
RETURNS TABLE(name TEXT, size_bytes BIGINT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF NOT public._is_admin() THEN
    RAISE EXCEPTION 'Tylko administrator';
  END IF;
  RETURN QUERY
  WITH referenced AS (
    SELECT audio_path             AS p FROM public.word_audio WHERE audio_path             IS NOT NULL
    UNION SELECT audio_path_en      FROM public.word_audio WHERE audio_path_en      IS NOT NULL
    UNION SELECT audio_path_pl      FROM public.word_audio WHERE audio_path_pl      IS NOT NULL
    UNION SELECT audio_path_sent_en FROM public.word_audio WHERE audio_path_sent_en IS NOT NULL
    UNION SELECT audio_path_sent_pl FROM public.word_audio WHERE audio_path_sent_pl IS NOT NULL
  )
  SELECT
    o.name,
    COALESCE((o.metadata->>'size')::BIGINT, 0) AS size_bytes,
    o.created_at
  FROM storage.objects o
  WHERE o.bucket_id = 'word-audio'
    AND o.name NOT IN (SELECT p FROM referenced WHERE p IS NOT NULL)
  ORDER BY o.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.audio_orphan_files() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audio_orphan_files() TO authenticated;

SELECT 'OK — RPC audio_storage_stats + audio_orphan_files gotowe (admin only).' AS status;
