-- ═══════════════════════════════════════════════════════════
-- WIADOMOSCI: konwersacje uzytkownik ↔ admin
-- ═══════════════════════════════════════════════════════════
-- Prosty system ticketow — uzytkownik zaklada konwersacje z tematem,
-- admin odpowiada. Obie strony widza historie. Uzywane m.in. do
-- zglaszania chęci zakupu Premium (platnosci nieaktywne na teraz).
-- Migracja idempotentna.

CREATE TABLE IF NOT EXISTS public.conversations (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username        TEXT,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_user     ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_status   ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conv_last_msg ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_conv      ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_created   ON public.conversation_messages(created_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- conversations: user widzi swoje; admin widzi wszystkie
DROP POLICY IF EXISTS "conv_select_own" ON public.conversations;
CREATE POLICY "conv_select_own" ON public.conversations
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "conv_select_admin" ON public.conversations;
CREATE POLICY "conv_select_admin" ON public.conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS "conv_insert_own" ON public.conversations;
CREATE POLICY "conv_insert_own" ON public.conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "conv_update_admin" ON public.conversations;
CREATE POLICY "conv_update_admin" ON public.conversations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS "conv_update_last_msg_self" ON public.conversations;
CREATE POLICY "conv_update_last_msg_self" ON public.conversations
  FOR UPDATE USING (user_id = auth.uid());

-- conversation_messages: autor konwersacji widzi wszystkie w swojej; admin widzi wszystkie
DROP POLICY IF EXISTS "msg_select_own_conv" ON public.conversation_messages;
CREATE POLICY "msg_select_own_conv" ON public.conversation_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "msg_select_admin" ON public.conversation_messages;
CREATE POLICY "msg_select_admin" ON public.conversation_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Autor konwersacji moze pisac w niej; admin moze pisac wszedzie
DROP POLICY IF EXISTS "msg_insert_user" ON public.conversation_messages;
CREATE POLICY "msg_insert_user" ON public.conversation_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND sender_is_admin = FALSE
    AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "msg_insert_admin" ON public.conversation_messages;
CREATE POLICY "msg_insert_admin" ON public.conversation_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND sender_is_admin = TRUE
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- RPC: liczba otwartych konwersacji (admin badge)
CREATE OR REPLACE FUNCTION public.count_open_conversations()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) FROM public.conversations WHERE status = 'open';
$$;

GRANT EXECUTE ON FUNCTION public.count_open_conversations() TO authenticated;
