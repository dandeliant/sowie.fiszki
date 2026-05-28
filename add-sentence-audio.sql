-- ═══════════════════════════════════════════════════════════════
--  MIGRACJA #42: sentence_audio — nagrania wymowy zdań przykładowych
--
--  Migracja #41 dodała audio_url_pl/_en dla SŁÓWEK. Każde słówko ma
--  jednak też (czasem) przykładowe zdanie PL + EN — które również
--  można nagrać. Każde słowo ma najwyżej 1 parę zdań (sentence_pl +
--  sentence_target z tabeli word_sentences lub inline format).
--
--  Migracja rozszerza word_audio o 4 dodatkowe kolumny:
--    - audio_url_sent_pl + audio_path_sent_pl — audio zdania PL
--    - audio_url_sent_en + audio_path_sent_en — audio zdania docelowego
--
--  Klucz tabeli niezmienny: (book_id, unit_key, word_pl). Jeden wiersz
--  per słówko trzyma 4 możliwe nagrania:
--    1) Słowo PL (audio_url_pl, audio_path_pl)
--    2) Słowo EN/docelowe (audio_url_en, audio_path_en)
--    3) Zdanie PL (audio_url_sent_pl, audio_path_sent_pl)
--    4) Zdanie EN/docelowe (audio_url_sent_en, audio_path_sent_en)
--
--  Idempotentna. Po uruchomieniu kod app.html automatycznie wykrywa
--  obecność nowych kolumn (próbuje SELECT je z fallbackiem).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.word_audio
  ADD COLUMN IF NOT EXISTS audio_url_sent_pl  TEXT,
  ADD COLUMN IF NOT EXISTS audio_path_sent_pl TEXT,
  ADD COLUMN IF NOT EXISTS audio_url_sent_en  TEXT,
  ADD COLUMN IF NOT EXISTS audio_path_sent_en TEXT;

-- Status check
SELECT
  COUNT(*) AS total_rows,
  COUNT(audio_url_en)      AS with_word_en,
  COUNT(audio_url_pl)      AS with_word_pl,
  COUNT(audio_url_sent_en) AS with_sent_en,
  COUNT(audio_url_sent_pl) AS with_sent_pl
FROM public.word_audio;

SELECT 'OK — word_audio rozszerzone o 4 kolumny dla nagran zdan przykladowych.' AS status;
