-- ═══════════════════════════════════════════════════════════════
--  MIGRACJA #41: word_audio bilingual (PL + EN per słówko)
--
--  Migracja #28 dodała tabelę `word_audio` z jednym audio per słówko
--  (kolumny `audio_url`, `audio_path`). Zakładała de facto, że to
--  audio docelowego języka (EN/FR), bo playback chain w app.html
--  (_speakTargetCurr) używał go tylko przy mówieniu obcego słowa.
--
--  Ta migracja rozszerza schemat o ODRĘBNE kolumny dla obu języków:
--    - audio_url_en + audio_path_en — nagranie wymowy angielskiej
--    - audio_url_pl + audio_path_pl — nagranie wymowy polskiej
--
--  Stare kolumny `audio_url` i `audio_path` zachowane jako LEGACY —
--  treść backfillowana do *_en (zakładamy że dotychczasowe nagrania
--  są w języku docelowym podręcznika, czyli głównie EN).
--
--  Idempotentna (IF NOT EXISTS). Po uruchomieniu kod app.html używa
--  nowych kolumn z fallbackiem do starych dla wstecznej kompatybilności.
--
--  Uruchom w Supabase Dashboard → SQL Editor.
-- ═══════════════════════════════════════════════════════════════

-- 1. Nowe kolumny dla obu języków (idempotentnie)
ALTER TABLE public.word_audio
  ADD COLUMN IF NOT EXISTS audio_url_en TEXT,
  ADD COLUMN IF NOT EXISTS audio_path_en TEXT,
  ADD COLUMN IF NOT EXISTS audio_url_pl TEXT,
  ADD COLUMN IF NOT EXISTS audio_path_pl TEXT;

-- 2. Backfill — istniejące nagrania traktujemy jako EN
UPDATE public.word_audio
SET audio_url_en  = audio_url,
    audio_path_en = audio_path
WHERE audio_url_en IS NULL
  AND audio_url IS NOT NULL;

-- 3. Indeks pod szybkie ładowanie listy nagrań dla unitu
--    (już istnieje z migracji #28, ale dla pewności)
CREATE INDEX IF NOT EXISTS idx_word_audio_lookup
  ON public.word_audio (book_id, unit_key);

-- 4. Status check
SELECT
  COUNT(*) AS total_words_with_any_audio,
  COUNT(audio_url_en) AS with_en,
  COUNT(audio_url_pl) AS with_pl
FROM public.word_audio;

SELECT 'OK — word_audio rozszerzone o audio_url_pl/_en. Stare kolumny audio_url/audio_path zachowane dla wstecznej kompatybilności.' AS status;
