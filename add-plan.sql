-- Dodaj kolumnę plan do profiles
-- Uruchom w Supabase SQL Editor (jednorazowo)
-- Wartości: 'free' | 'premium' | 'teacher'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

SELECT 'OK — kolumna plan dodana' AS status;