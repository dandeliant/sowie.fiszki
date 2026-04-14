-- Dodaj kolumnę image_url do word_sentences
-- Uruchom w Supabase SQL Editor (jednorazowo)
ALTER TABLE public.word_sentences ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

SELECT 'OK — kolumna image_url dodana' AS status;