-- ═══════════════════════════════════════════════════════════════
--  SOWIE FISZKI — WIRTUALNY PUPIL ZAPISYWANY NA SERWERZE
--  Migracja #70 · idempotentna
--
--  Do tej pory pupil (Tamagotchi) był tylko w pamięci przeglądarki
--  (localStorage), więc na innym urządzeniu uczeń zaczynał od nowa.
--  Kolumna profiles.pet trzyma cały stan pupila jako JSON:
--    { "pet": { type, name, gp, happy, fedDate, lastCheck, born } | null,
--      "on":  true | false | null,   -- przełącznik „🐾 Wirtualny pupil” z „Moje konto”
--      "ts":  1729000000000 }        -- czas ostatniej zmiany (wygrywa nowszy zapis)
--
--  RLS bez zmian: użytkownik może już aktualizować własny wiersz profiles
--  (tak zapisują się XP, seria itd.), a nauczyciel/admin czytają profile
--  swoich uczniów według istniejących polityk.
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists pet jsonb;

select 'OK — pupil zapisywany na serwerze' as status;
