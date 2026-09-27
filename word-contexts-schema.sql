-- ═══════════════════════════════════════════════════════════
-- FISZKI KONTEKSTOWE (word_contexts) — migracja #59
-- ═══════════════════════════════════════════════════════════
-- Do każdego słowa (book_id, word_pl) można przypisać do 20 zdań
-- kontekstowych. Każdy kontekst: zdanie z luką, poprawna odpowiedź do luki
-- (może być inną formą hasła: borrow/borrowed/borrowing), pełne zdanie i
-- polskie tłumaczenie. NIE rusza word_sentences ani data.js — stare fiszki
-- działają bez zmian (fiszka bez kontekstów = zachowanie jak dotąd).
--
-- RLS: SELECT każdy (gość też — nauka), INSERT/UPDATE/DELETE tylko staff.
-- Idempotentna. Wymaga pgcrypto (gen_random_uuid) — na Supabase w schemacie extensions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.word_contexts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id        TEXT NOT NULL,
  word_pl        TEXT NOT NULL,
  ord            INT NOT NULL DEFAULT 0,
  sentence_gap   TEXT NOT NULL,        -- np. "Can I ______ your phone?"
  answer         TEXT NOT NULL,        -- np. "borrow" / "borrowed" / "borrowing"
  full_sentence  TEXT NOT NULL,        -- np. "Can I borrow your phone?"
  translation_pl TEXT NOT NULL,        -- np. "Czy mogę pożyczyć twój telefon?"
  difficulty     INT,
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_word_contexts_lookup ON public.word_contexts(book_id, word_pl);

ALTER TABLE public.word_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wc_select_all" ON public.word_contexts;
CREATE POLICY "wc_select_all" ON public.word_contexts FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "wc_write_staff" ON public.word_contexts;
CREATE POLICY "wc_write_staff" ON public.word_contexts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND (COALESCE(is_admin,FALSE) OR COALESCE(is_teacher,FALSE))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND (COALESCE(is_admin,FALSE) OR COALESCE(is_teacher,FALSE))));

GRANT SELECT ON public.word_contexts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.word_contexts TO authenticated;

SELECT 'OK — tabela word_contexts + RLS utworzone (fiszki kontekstowe #59)' AS status;
