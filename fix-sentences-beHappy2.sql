-- ═══════════════════════════════════════════════════════════
-- Fix sentences: BE HAPPY! 2 (klasa 2, szkola podstawowa)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne, starannie napisane przyklady zdan dla wszystkich
-- 89 unikalnych slowek z Be Happy! 2.
--
-- Struktura podrecznika:
-- W data.js sa tylko unity 6, 7, 8 (Unit 1-5 najwyrazniej w innym
-- podreczniku lub do uzupelnienia). Etap 6/11 obejmuje to co jest.
--
-- Tematy unitow:
--   Unit 6 (30): ubrania zimowe + pogoda + pory roku + frazy "What are
--                you wearing?" / "He is wearing..."
--   Unit 7 (26): zwierzeta egzotyczne + czasowniki ich ruchu + ciala
--                + frazy "They can bite." / "It has got..."
--   Unit 8 (33): obozowanie + sprzety + czynnosci na obozie + przyroda
--                + frazy "Let's make a campfire." / "I can take photos."
--
-- Zasady:
--   - Krotkie zdania, 5-10 slow EN, poziom A1 (klasa 2).
--   - Naturalnie uzywaja target slowa, gramatycznie poprawne PL+EN.
--   - Tematyka unitu (ubrania -> noszenie ubran, zwierzeta -> opis,
--     obozowanie -> czynnosci na biwaku).
--   - Bez nawiasow w sentence_pl/sentence_target (mimo ze niektore
--     word_pl je maja, np. "buty (za kostke)").
--   - Pelnie zdaniowe entries -> echo, EN tlumaczenie naturalnie
--     ("don't" -> "do not", "He's" -> "He is" itp.).
--
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.
-- Po uruchomieniu: 89 unikalnych zdan w word_sentences dla beHappy2.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES

-- ─── Unit 6: ubrania + pogoda + pory roku (30) ───────
('beHappy2', 'szalik', 'Mam ciepły szalik.', 'I have a warm scarf.'),
('beHappy2', 'nauszniki', 'Zimą noszę nauszniki.', 'I wear earmuffs in winter.'),
('beHappy2', 'płaszcz, kurtka', 'Załóż płaszcz, jest zimno.', 'Put on your coat, it is cold.'),
('beHappy2', 'sweter', 'Mój sweter jest czerwony.', 'My jumper is red.'),
('beHappy2', 'pidżama', 'Idę spać w pidżamie.', 'I go to sleep in my pyjamas.'),
('beHappy2', 'bluza z kapturem', 'Moja bluza z kapturem jest niebieska.', 'My hoodie is blue.'),
('beHappy2', 'rękawiczki', 'Zimą noszę rękawiczki.', 'I wear gloves in winter.'),
('beHappy2', 'buty (za kostkę)', 'Moje buty są nowe.', 'My boots are new.'),
('beHappy2', 'słonecznie', 'Dziś jest słonecznie.', 'It is sunny today.'),
('beHappy2', 'gorąco', 'Latem jest gorąco.', 'It is hot in summer.'),
('beHappy2', 'deszczowo', 'Jest deszczowo, weź parasol.', 'It is rainy, take an umbrella.'),
('beHappy2', 'burzowo', 'Jest burzowo, zostań w domu.', 'It is stormy, stay at home.'),
('beHappy2', 'ciepło', 'Wiosną jest ciepło.', 'It is warm in spring.'),
('beHappy2', 'chłodno', 'Jesienią jest chłodno.', 'It is cool in autumn.'),
('beHappy2', 'śnieżnie', 'Zimą jest śnieżnie.', 'It is snowy in winter.'),
('beHappy2', 'wiosna', 'Wiosną kwitną kwiaty.', 'Flowers bloom in spring.'),
('beHappy2', 'lato', 'Latem chodzę na plażę.', 'I go to the beach in summer.'),
('beHappy2', 'jesień', 'Jesienią liście spadają.', 'Leaves fall in autumn.'),
('beHappy2', 'zima', 'Zimą lepimy bałwana.', 'We make a snowman in winter.'),
('beHappy2', 'W co jesteś ubrany?', 'W co jesteś ubrany?', 'What are you wearing?'),
('beHappy2', 'Noszę sweter.', 'Noszę sweter.', 'I am wearing a jumper.'),
('beHappy2', 'W co jest on ubrany?', 'W co jest on ubrany?', 'What is he wearing?'),
('beHappy2', 'On nosi płaszcz/kurtkę.', 'On nosi płaszcz. On nosi kurtkę.', 'He is wearing a coat.'),
('beHappy2', 'W co jest ona ubrana?', 'W co jest ona ubrana?', 'What is she wearing?'),
('beHappy2', 'Ona nosi buty (za kostkę).', 'Ona nosi buty.', 'She is wearing boots.'),
('beHappy2', 'On nosi szalik i nauszniki.', 'On nosi szalik i nauszniki.', 'He is wearing a scarf and earmuffs.'),
('beHappy2', 'Ona nosi spodnie i bluzę z kapturem.', 'Ona nosi spodnie i bluzę z kapturem.', 'She is wearing trousers and a hoodie.'),
('beHappy2', 'Czy on nosi rękawiczki? Tak.', 'Czy on nosi rękawiczki? Tak, nosi.', 'Is he wearing gloves? Yes, he is.'),
('beHappy2', 'Czy ona nosi szalik? Nie.', 'Czy ona nosi szalik? Nie, nie nosi.', 'Is she wearing a scarf? No, she is not.'),
('beHappy2', 'Jest słonecznie.', 'Jest słonecznie.', 'It is sunny.'),

-- ─── Unit 7: zwierzeta + czasowniki + ciala (26) ─────
('beHappy2', 'tygrysy', 'Tygrysy żyją w dżungli.', 'Tigers live in the jungle.'),
('beHappy2', 'nietoperze', 'Nietoperze latają w nocy.', 'Bats fly at night.'),
('beHappy2', 'pingwiny', 'Pingwiny żyją w Antarktydzie.', 'Penguins live in Antarctica.'),
('beHappy2', 'żyrafy', 'Żyrafy mają długie szyje.', 'Giraffes have long necks.'),
('beHappy2', 'węże', 'Węże potrafią się ślizgać.', 'Snakes can slide.'),
('beHappy2', 'papugi', 'Papugi mają kolorowe pióra.', 'Parrots have colourful feathers.'),
('beHappy2', 'nosorożce', 'Nosorożce są duże i silne.', 'Rhinos are big and strong.'),
('beHappy2', 'krokodyle', 'Krokodyle żyją w rzece.', 'Crocodiles live in the river.'),
('beHappy2', 'stąpać, tupać', 'Słonie tupią głośno.', 'Elephants stamp loudly.'),
('beHappy2', 'ślizgać się, zjeżdżać', 'Węże potrafią się ślizgać.', 'Snakes can slide.'),
('beHappy2', 'mówić, rozmawiać', 'Lubię rozmawiać z mamą.', 'I like to talk to my mum.'),
('beHappy2', 'gryźć, kąsać', 'Krokodyle potrafią gryźć.', 'Crocodiles can bite.'),
('beHappy2', 'dreptać, chodzić kiwając się (jak kaczka)', 'Pingwiny dreptają wolno.', 'Penguins waddle slowly.'),
('beHappy2', 'jeść', 'Tygrysy jedzą mięso.', 'Tigers eat meat.'),
('beHappy2', 'szyja', 'Żyrafa ma długą szyję.', 'A giraffe has a long neck.'),
('beHappy2', 'skrzydła', 'Ptaki mają skrzydła.', 'Birds have wings.'),
('beHappy2', 'ogon', 'Małpa ma długi ogon.', 'A monkey has a long tail.'),
('beHappy2', 'pióra', 'Papugi mają kolorowe pióra.', 'Parrots have colourful feathers.'),
('beHappy2', 'One są duże i zielone.', 'One są duże i zielone.', 'They are big and green.'),
('beHappy2', 'One potrafią gryźć.', 'One potrafią gryźć.', 'They can bite.'),
('beHappy2', 'One mogą jeść mięso.', 'One mogą jeść mięso.', 'They can eat meat.'),
('beHappy2', 'On ma szyję i cztery nogi.', 'On ma szyję i cztery nogi.', 'It has got a neck and four legs.'),
('beHappy2', 'On nie potrafi mówić.', 'On nie potrafi mówić.', 'It cannot talk.'),
('beHappy2', 'Pingwiny nie potrafią mówić.', 'Pingwiny nie potrafią mówić.', 'Penguins cannot talk.'),
('beHappy2', 'Papugi potrafią latać.', 'Papugi potrafią latać.', 'Parrots can fly.'),
('beHappy2', 'One mają pióra.', 'One mają pióra.', 'They have got feathers.'),

-- ─── Unit 8: obozowanie + sprzety + przyroda (33) ────
('beHappy2', 'domek na drzewie', 'Mam domek na drzewie w ogrodzie.', 'I have a treehouse in the garden.'),
('beHappy2', 'namiot', 'Śpimy w namiocie.', 'We sleep in a tent.'),
('beHappy2', 'śpiwór', 'Mój śpiwór jest ciepły.', 'My sleeping bag is warm.'),
('beHappy2', 'ognisko', 'Siedzimy przy ognisku.', 'We sit by the campfire.'),
('beHappy2', 'kiełbaski', 'Pieczemy kiełbaski.', 'We are roasting sausages.'),
('beHappy2', 'aparat', 'Mój aparat jest nowy.', 'My camera is new.'),
('beHappy2', 'frisbee', 'Bawimy się frisbee w parku.', 'We play frisbee in the park.'),
('beHappy2', 'latarka', 'Mam latarkę w plecaku.', 'I have a torch in my backpack.'),
('beHappy2', 'biegać', 'Lubię biegać w parku.', 'I like to run in the park.'),
('beHappy2', 'grać na gitarze', 'Tata potrafi grać na gitarze.', 'Dad can play the guitar.'),
('beHappy2', 'wspinać się na drzewa', 'Lubię wspinać się na drzewa.', 'I like to climb trees.'),
('beHappy2', 'pływać', 'Pływam w jeziorze.', 'I swim in the lake.'),
('beHappy2', 'rozbijać, rozstawiać namiot', 'Rozbijamy namiot w lesie.', 'We put up a tent in the forest.'),
('beHappy2', 'spać w śpiworze', 'Lubię spać w śpiworze.', 'I like to sleep in a sleeping bag.'),
('beHappy2', 'rozpalać ognisko', 'Rozpalamy ognisko wieczorem.', 'We make a campfire in the evening.'),
('beHappy2', 'budować domek na drzewie', 'Lubimy budować domek na drzewie.', 'We like to build a treehouse.'),
('beHappy2', 'bawić się frisbee', 'Bawimy się frisbee na plaży.', 'We play frisbee on the beach.'),
('beHappy2', 'robić zdjęcia', 'Lubię robić zdjęcia.', 'I like to take photos.'),
('beHappy2', 'jezioro', 'Pływamy w jeziorze.', 'We swim in the lake.'),
('beHappy2', 'skały', 'Wspinamy się na skały.', 'We climb the rocks.'),
('beHappy2', 'las', 'W lesie są drzewa.', 'There are trees in the forest.'),
('beHappy2', 'góry', 'W górach jest pięknie.', 'It is beautiful in the mountains.'),
('beHappy2', 'Czy on potrafi biegać?', 'Czy on potrafi biegać?', 'Can he run?'),
('beHappy2', 'Nie jedz kiełbasek w klasie.', 'Nie jedz kiełbasek w klasie.', 'Do not eat sausages in the classroom.'),
('beHappy2', 'Ryby żyją w jeziorze.', 'Ryby żyją w jeziorze.', 'Fish live in the lake.'),
('beHappy2', 'Jaszczurki żyją w lesie.', 'Jaszczurki żyją w lesie.', 'Lizards live in the forest.'),
('beHappy2', 'Potrafię robić zdjęcia.', 'Potrafię robić zdjęcia.', 'I can take photos.'),
('beHappy2', 'Nie potrafię rozbijać namiotu.', 'Nie potrafię rozbijać namiotu.', 'I cannot put up a tent.'),
('beHappy2', 'Mam kiełbaski i kamerę.', 'Mam kiełbaski i kamerę.', 'I have got sausages and a camera.'),
('beHappy2', 'Nie mam domku na drzewie.', 'Nie mam domku na drzewie.', 'I have not got a treehouse.'),
('beHappy2', 'Rozpalmy ognisko.', 'Rozpalmy ognisko.', 'Let us make a campfire.'),
('beHappy2', 'Zróbmy zdjęcia.', 'Zróbmy zdjęcia.', 'Let us take photos.'),
('beHappy2', 'A ty?', 'A ty?', 'What about you?')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Be Happy! 2: 89 unikalnych zdan zaktualizowanych/dodanych w word_sentences (Unit 6: 30, Unit 7: 26, Unit 8: 33).';
END $$;
