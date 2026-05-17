-- ═══════════════════════════════════════════════════════════
--  Angielski MW: Unit 1 (10 słówek + 10 zdań przykładowych)
-- ═══════════════════════════════════════════════════════════
--
-- Skrypt dla podręcznika "Angielski MW" dodanego przez panel admina
-- (zapisany w tabelach `admin_books` / `admin_units` / `admin_words`,
-- a zdania w `word_sentences`).
--
-- Co robi:
--   1. Wyszukuje book_id w `admin_books` po nazwie (LIKE 'Angielski MW%')
--   2. Tworzy `unit1` w `admin_units` (jeśli nie istnieje)
--   3. Wstawia 10 słówek do `admin_words` (skip duplikatów)
--   4. Upsertuje 10 zdań przykładowych do `word_sentences`
--
-- Uruchom raz w Supabase SQL Editor jako admin. Idempotentny.
-- Jeśli nazwa Twojego podręcznika jest inna niż "Angielski MW", zmień
-- wzorzec ILIKE w pierwszym SELECT (lub wstaw bezpośrednio book_id).
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  v_book_id TEXT;
  v_user_id UUID := auth.uid();
  w RECORD;
BEGIN
  -- 1) Znajdź book_id po nazwie
  SELECT book_id INTO v_book_id
  FROM public.admin_books
  WHERE name ILIKE 'Angielski MW%'
  LIMIT 1;

  IF v_book_id IS NULL THEN
    RAISE EXCEPTION 'Nie znaleziono podręcznika "Angielski MW" w admin_books. Sprawdź dokładną nazwę lub wstaw book_id bezpośrednio.';
  END IF;

  RAISE NOTICE 'Znaleziono book_id: %', v_book_id;

  -- 2) Dodaj Unit 1 (jeśli nie istnieje)
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_units
    WHERE book_id = v_book_id AND unit_key = 'unit1'
  ) THEN
    INSERT INTO public.admin_units (book_id, unit_key, name, icon, color, created_by, updated_at)
    VALUES (v_book_id, 'unit1', 'Unit 1', '📖', '#a29bfe', v_user_id, NOW());
    RAISE NOTICE 'Utworzono unit1';
  ELSE
    RAISE NOTICE 'unit1 już istnieje — pomijam tworzenie';
  END IF;

  -- 3) Wstaw 10 słówek do admin_words (skip jeśli istnieją)
  FOR w IN
    SELECT * FROM (VALUES
      ('ile (rzeczowniki policzalne)',    'how many'),
      ('ile (rzeczowniki niepoliczalne)', 'how much'),
      ('dostać, kupić',                   'get (got, got)'),
      ('wymiana, zamieniać',              'swap'),
      ('wyposażenie',                     'equipment'),
      ('kiedy',                           'when'),
      ('potrzebować, potrzeba',           'need'),
      ('pierwszy',                        'the first'),
      ('drugi',                           'the second'),
      ('trzeci',                          'the third')
    ) AS t(pl, en)
  LOOP
    INSERT INTO public.admin_words (book_id, unit_key, word_pl, word_target, is_deleted, created_by, updated_at)
    SELECT v_book_id, 'unit1', w.pl, w.en, false, v_user_id, NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.admin_words
      WHERE book_id = v_book_id
        AND unit_key = 'unit1'
        AND word_pl = w.pl
        AND is_deleted = false
    );
  END LOOP;

  -- 4) Zdania przykładowe (upsert na (book_id, word_pl))
  INSERT INTO public.word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES
    (v_book_id, 'ile (rzeczowniki policzalne)',    'Ile masz książek?',                                  'How many books do you have?'),
    (v_book_id, 'ile (rzeczowniki niepoliczalne)', 'Ile masz wody?',                                     'How much water do you have?'),
    (v_book_id, 'dostać, kupić',                   'Co dostałeś na urodziny?',                           'What did you get for your birthday?'),
    (v_book_id, 'wymiana, zamieniać',              'Zamienię ten plakat na twoją grę.',                  'I will swap this poster for your game.'),
    (v_book_id, 'wyposażenie',                     'Potrzebujemy nowego wyposażenia do laboratorium.',   'We need new equipment for the laboratory.'),
    (v_book_id, 'kiedy',                           'Kiedy zaczyna się lekcja?',                          'When does the lesson start?'),
    (v_book_id, 'potrzebować, potrzeba',           'Potrzebuję nowego plecaka do szkoły.',               'I need a new bag for school.'),
    (v_book_id, 'pierwszy',                        'Zająłem pierwsze miejsce w konkursie.',              'I came first in the competition.'),
    (v_book_id, 'drugi',                           'To już drugi raz, kiedy się spóźniłem.',             'This is the second time I am late.'),
    (v_book_id, 'trzeci',                          'Jego pokój jest na trzecim piętrze.',                'His room is on the third floor.')
  ON CONFLICT (book_id, word_pl) DO UPDATE SET
    sentence_pl = EXCLUDED.sentence_pl,
    sentence_target = EXCLUDED.sentence_target;

  RAISE NOTICE 'OK — Angielski MW Unit 1: 10 słówek + 10 zdań przykładowych zapisanych (book_id: %).', v_book_id;
END$$;

SELECT 'Skrypt zakończony — odśwież podręcznik w app.html (Ctrl+Shift+R).' AS status;
