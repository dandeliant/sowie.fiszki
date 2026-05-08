-- ═══════════════════════════════════════════════════════════
-- Migracja #35: Prywatna etykieta (private_note) w user_labels
-- ═══════════════════════════════════════════════════════════
--
-- Cel: rozdzielenie dwoch konceptow w user_labels:
--   - `label` (juz istniejaca) — Grupa, uzywana do grupowania nauczycieli
--     w widoku „Konta nauczycieli" (np. „British Studio"), wciaz prywatna
--     dla autora.
--   - `private_note` (NOWA) — Prywatna etykieta, krotka notatka o
--     uzytkowniku wyswietlana inline obok loginu (np. inicjaly, numer
--     z dziennika, dodatkowy opis). Tez prywatna dla autora.
--
-- Idempotentna — moze byc uruchomiona wielokrotnie.

ALTER TABLE public.user_labels
  ADD COLUMN IF NOT EXISTS private_note TEXT NULL;

-- Limit dlugosci na poziomie aplikacji (UI walidacja w app.html: max 80 znakow).
-- Brak constraint'u bazy zeby zachowac elastycznosc.

DO $$ BEGIN
  RAISE NOTICE 'OK — user_labels.private_note dodany. Modal etykiet ma teraz 2 pola: Grupa + Prywatna etykieta.';
END $$;
