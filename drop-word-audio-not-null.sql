-- ═══════════════════════════════════════════════════════════════
--  MIGRACJA #43: usun NOT NULL z legacy kolumn word_audio
--
--  Migracja #28 zalozyla tabele `word_audio` z kolumnami:
--    audio_url  TEXT NOT NULL
--    audio_path TEXT NOT NULL
--
--  W migracji #41 zostaly dodane nowe kolumny audio_url_pl/_en bez NOT NULL.
--  W migracji #42 doszły kolejne dla zdan (audio_url_sent_*).
--  Stare kolumny audio_url/audio_path nie sa juz wymagane — sa zachowane
--  tylko dla wstecznej kompatybilnosci ze starszym kodem klienta.
--
--  Problem: gdy uzytkownik zapisuje tylko nagranie PL (lub zdania)
--  na slowo ktore nie ma jeszcze zadnego rekordu w bazie, INSERT
--  probuje wlozyc NULL do audio_url -> constraint violation -> blad.
--
--  Fix: usuwamy NOT NULL z obu legacy kolumn.
--
--  Idempotentna (DROP NOT NULL is no-op gdy juz nullable).
--  Po uruchomieniu nagrywanie PL/zdan dziala bez bledu.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.word_audio
  ALTER COLUMN audio_url  DROP NOT NULL,
  ALTER COLUMN audio_path DROP NOT NULL;

-- Status check
SELECT 'OK — audio_url + audio_path moga byc NULL (zapis tylko PL lub tylko zdania bez slowa EN).' AS status;
