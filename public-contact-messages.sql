-- ═══════════════════════════════════════════════════════════
-- PUBLIC CONTACT MESSAGES (public_contact_messages) — migracja #30
-- ═══════════════════════════════════════════════════════════
-- Wiadomości z publicznego formularza kontaktowego na home.html.
-- Każdy odwiedzający (anon) może wysłać wiadomość — do walidacji
-- używamy CHECK constraints na poziomie bazy + anty-bot logiki
-- po stronie klienta (honeypot, time-check).
--
-- Admin czyta wiadomości w panelu (ekran sContactMessages w app.html),
-- może oznaczyć jako przeczytane / odpowiedziane / dodać notatki.
--
-- RLS:
--  - INSERT: anon (z CHECK na długość pól + format e-maila)
--  - SELECT/UPDATE/DELETE: tylko admin
--
-- Idempotentna — można uruchomić ponownie.

CREATE TABLE IF NOT EXISTS public.public_contact_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT,
  message     TEXT NOT NULL,
  user_agent  TEXT,           -- dla diagnostyki spamu (jaka przeglądarka / bot)
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  is_replied  BOOLEAN NOT NULL DEFAULT FALSE,
  notes       TEXT,           -- prywatne notatki admina
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CHECK constraints — zapora przed pustymi/za długimi wpisami
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pcm_name_length') THEN
    ALTER TABLE public.public_contact_messages
      ADD CONSTRAINT pcm_name_length
      CHECK (length(btrim(name)) BETWEEN 2 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pcm_email_format') THEN
    ALTER TABLE public.public_contact_messages
      ADD CONSTRAINT pcm_email_format
      CHECK (length(email) BETWEEN 5 AND 200 AND email LIKE '%_@_%._%');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pcm_subject_length') THEN
    ALTER TABLE public.public_contact_messages
      ADD CONSTRAINT pcm_subject_length
      CHECK (subject IS NULL OR length(subject) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pcm_message_length') THEN
    ALTER TABLE public.public_contact_messages
      ADD CONSTRAINT pcm_message_length
      CHECK (length(btrim(message)) BETWEEN 5 AND 5000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pcm_created_at ON public.public_contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pcm_is_read    ON public.public_contact_messages(is_read);

ALTER TABLE public.public_contact_messages ENABLE ROW LEVEL SECURITY;

-- INSERT: każdy (anon + authenticated). CHECK constraints chronią treść.
DROP POLICY IF EXISTS "pcm_insert_anyone" ON public.public_contact_messages;
CREATE POLICY "pcm_insert_anyone" ON public.public_contact_messages
  FOR INSERT WITH CHECK (TRUE);

-- SELECT/UPDATE/DELETE: tylko admin
DROP POLICY IF EXISTS "pcm_admin_select" ON public.public_contact_messages;
CREATE POLICY "pcm_admin_select" ON public.public_contact_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND COALESCE(is_admin, FALSE) = TRUE
    )
  );

DROP POLICY IF EXISTS "pcm_admin_update" ON public.public_contact_messages;
CREATE POLICY "pcm_admin_update" ON public.public_contact_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND COALESCE(is_admin, FALSE) = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND COALESCE(is_admin, FALSE) = TRUE
    )
  );

DROP POLICY IF EXISTS "pcm_admin_delete" ON public.public_contact_messages;
CREATE POLICY "pcm_admin_delete" ON public.public_contact_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND COALESCE(is_admin, FALSE) = TRUE
    )
  );

GRANT INSERT ON public.public_contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.public_contact_messages TO authenticated;

-- RPC: helper do zliczania nieprzeczytanych — dla badge'a
-- Uniwersalny: dostępny dla każdego, ale RLS i tak filtruje.
-- Dla admina: zwraca pełen licznik.
-- Dla nie-admina: zwraca 0 (bo SELECT zablokowane).
CREATE OR REPLACE FUNCTION public.count_unread_contact_messages()
RETURNS INTEGER
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM public.public_contact_messages
  WHERE is_read = FALSE;
$$;

GRANT EXECUTE ON FUNCTION public.count_unread_contact_messages() TO authenticated;

SELECT 'OK — tabela public_contact_messages + RLS + RPC count_unread_contact_messages utworzone' AS status;
