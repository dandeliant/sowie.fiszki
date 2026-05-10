-- ═══════════════════════════════════════════════════════════
-- Fix sentences: KIDS CAN 1 (klasa 1, szkola podstawowa)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne, starannie napisane przyklady zdan dla wszystkich
-- 50 unikalnych slowek z Kids Can 1.
--
-- Struktura podrecznika w data.js: tylko Unit 5 i Unit 6.
-- (Unit 1-4 nie istnieja w projekcie — stan oryginalny zachowany.)
--
-- Tematy unitow:
--   Unit 5 (22): czynnosci ruchowe + frazy "Can you...?" / "I can..."
--   Unit 6 (28): jedzenie fastfood/przekaski + smaki lodow + frazy
--                "I like..." / "Can I have...?"
--
-- Zasady:
--   - Krotkie zdania, 5-10 slow EN, poziom A1 (klasa 1).
--   - Naturalnie uzywaja target slowa, gramatycznie poprawne PL+EN.
--   - Pelnie zdaniowe entries -> echo, EN tlumaczenie naturalnie
--     ("don't" -> "do not", "I'm" -> "I am").
--
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.
-- Po uruchomieniu: 50 unikalnych zdan w word_sentences dla kidscan1.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES

-- ─── Unit 5: czynnosci ruchowe (22) ──────────────────
('kidscan1', 'skakać', 'Potrafię skakać wysoko.', 'I can jump high.'),
('kidscan1', 'wspinać się', 'Małpy potrafią się wspinać.', 'Monkeys can climb.'),
('kidscan1', 'jeździć rowerem', 'Lubię jeździć rowerem.', 'I like to ride a bike.'),
('kidscan1', 'biegać', 'Lubię biegać w parku.', 'I like to run in the park.'),
('kidscan1', 'jeździć konno', 'Mama potrafi jeździć konno.', 'Mum can ride a horse.'),
('kidscan1', 'skakać na skakance', 'Lubię skakać na skakance.', 'I like to skip.'),
('kidscan1', 'łapać piłkę', 'Potrafię łapać piłkę.', 'I can catch a ball.'),
('kidscan1', 'grać w piłkę nożną', 'Lubię grać w piłkę nożną.', 'I like to play football.'),
('kidscan1', 'podskakiwać', 'Króliki potrafią podskakiwać.', 'Rabbits can hop.'),
('kidscan1', 'pływać', 'Pływam w basenie.', 'I swim in the pool.'),
('kidscan1', 'puszczać latawce', 'Lubię puszczać latawce.', 'I like to fly a kite.'),
('kidscan1', 'tańczyć', 'Potrafię tańczyć.', 'I can dance.'),
('kidscan1', 'Czy potrafisz tańczyć?', 'Czy potrafisz tańczyć?', 'Can you dance?'),
('kidscan1', 'Czy potrafisz grać w piłkę nożną? Tak.', 'Czy potrafisz grać w piłkę nożną? Tak, potrafię.', 'Can you play football? Yes, I can.'),
('kidscan1', 'Czy potrafisz grać w piłkę nożną? Nie.', 'Czy potrafisz grać w piłkę nożną? Nie, nie potrafię.', 'Can you play football? No, I cannot.'),
('kidscan1', 'Czy możesz pomóc?', 'Czy możesz pomóc?', 'Can you help?'),
('kidscan1', 'Mogę pomóc.', 'Mogę pomóc.', 'I can help.'),
('kidscan1', 'Czy możesz mi pomóc?', 'Czy możesz mi pomóc?', 'Can you help me, please?'),
('kidscan1', 'Potrafię biegać.', 'Potrafię biegać.', 'I can run.'),
('kidscan1', 'Nie potrafię skakać na skakance.', 'Nie potrafię skakać na skakance.', 'I cannot skip.'),
('kidscan1', 'Potrafię skakać.', 'Potrafię skakać.', 'I can jump.'),
('kidscan1', 'Nie potrafię się wspinać.', 'Nie potrafię się wspinać.', 'I cannot climb.'),

-- ─── Unit 6: jedzenie + smaki + frazy (28) ───────────
('kidscan1', 'hamburgery', 'Lubię hamburgery.', 'I like burgers.'),
('kidscan1', 'jajka', 'Jem jajka na śniadanie.', 'I eat eggs for breakfast.'),
('kidscan1', 'cebule', 'Cebule są na pizzy.', 'There are onions on the pizza.'),
('kidscan1', 'frytki', 'Frytki są słone.', 'Chips are salty.'),
('kidscan1', 'milkshake', 'Lubię milkshake czekoladowy.', 'I like a chocolate milkshake.'),
('kidscan1', 'ciasto', 'Mama piecze ciasto.', 'Mum is baking a cake.'),
('kidscan1', 'sok', 'Piję sok pomarańczowy.', 'I drink orange juice.'),
('kidscan1', 'lody', 'Lubię lody waniliowe.', 'I like vanilla ice cream.'),
('kidscan1', 'cytrynowy', 'Lubię ciasto cytrynowe.', 'I like lemon cake.'),
('kidscan1', 'mango', 'Mango jest słodkie.', 'Mango is sweet.'),
('kidscan1', 'wiśniowy', 'Lubię sok wiśniowy.', 'I like cherry juice.'),
('kidscan1', 'czekoladowy', 'Mam ciasto czekoladowe.', 'I have a chocolate cake.'),
('kidscan1', 'waniliowy', 'Lody waniliowe są pyszne.', 'Vanilla ice cream is delicious.'),
('kidscan1', 'truskawki', 'Truskawki są czerwone.', 'Strawberries are red.'),
('kidscan1', 'marchewki', 'Marchewki są pomarańczowe.', 'Carrots are orange.'),
('kidscan1', 'winogrona', 'Winogrona są zielone.', 'Grapes are green.'),
('kidscan1', 'papryki', 'Lubię czerwone papryki.', 'I like red peppers.'),
('kidscan1', 'owoce', 'Jem owoce codziennie.', 'I eat fruit every day.'),
('kidscan1', 'warzywa', 'Króliki jedzą warzywa.', 'Rabbits eat vegetables.'),
('kidscan1', 'Lubię lody.', 'Lubię lody.', 'I like ice cream.'),
('kidscan1', 'Nie lubię cebul.', 'Nie lubię cebul.', 'I do not like onions.'),
('kidscan1', 'Uwielbiam lody.', 'Uwielbiam lody.', 'I love ice cream.'),
('kidscan1', 'Jestem głodny.', 'Jestem głodny.', 'I am hungry.'),
('kidscan1', 'Czy mogę prosić o hamburgera?', 'Czy mogę prosić o hamburgera?', 'Can I have a burger, please?'),
('kidscan1', 'Tak, proszę.', 'Tak, proszę.', 'Yes, here you are.'),
('kidscan1', 'Dziękuję.', 'Dziękuję.', 'Thank you.'),
('kidscan1', 'Czy lubisz lody czekoladowe? Tak.', 'Czy lubisz lody czekoladowe? Tak, lubię.', 'Do you like chocolate ice cream? Yes, I do.'),
('kidscan1', 'Czy lubisz lody czekoladowe? Nie.', 'Czy lubisz lody czekoladowe? Nie, nie lubię.', 'Do you like chocolate ice cream? No, I do not.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Kids Can 1: 50 unikalnych zdan zaktualizowanych/dodanych w word_sentences (Unit 5: 22, Unit 6: 28).';
END $$;
