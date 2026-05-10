-- ═══════════════════════════════════════════════════════════
-- Fix sentences: BUGS TEAM 2 (klasa 2, szkola podstawowa)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne, starannie napisane przyklady zdan dla wszystkich
-- unikalnych slowek z Bugs Team 2 (166 wpisow w data.js, ale
-- Unit 2 i Unit 3 sa identyczne + „ogrod" powtarza sie w Unit 6,
-- wiec realnie 141 unikalnych slow/fraz).
--
-- Tematy unitow:
--   Unit 1 (27): ubrania + pogoda + pory roku + tygodnia
--   Unit 2 (22): pokoje + meble + przyimki miejsca
--   Unit 3 (22): IDENTYCZNY z Unit 2 — wpisy te same po word_pl,
--                ON CONFLICT DO UPDATE poradzi sobie automatycznie.
--   Unit 4 (37): czesci ciala + dolegliwosci + uczucia + porady
--   Unit 5 (32): jedzenie + posilki + dialog w restauracji
--   Unit 6 (24): miejsca rozrywki + czynnosci sportowe + miejsca
--
-- Zasady:
--   - Krotkie zdania, 5-10 slow EN, poziom A1 (klasa 2).
--   - Naturalnie uzywaja target slowa, gramatycznie poprawne PL+EN.
--   - Pasuja do tematyki unitu (ubrania → koszulka, jedzenie → pizza).
--   - Bez nawiasow w polskim/angielskim (konwencja projektu).
--   - Dla pelnych zdan w slowniku (np. „Ja lubie salatke.") —
--     sentence_pl = ten sam tekst (echo), sentence_target = tlumaczenie.
--
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.
-- PostgreSQL nie pozwala na duplikat klucza w jednym INSERT z ON CONFLICT,
-- wiec duplikaty miedzy Unit 2/3 i powtorka „ogrod" sa POMINIETE w SQL
-- (kazdy unikalny word_pl wystepuje raz).
--
-- Po uruchomieniu: 141 unikalnych zdan w word_sentences dla bugsteam2.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES

-- ─── Unit 1: ubrania + pogoda + pory roku (27) ───────
('bugsteam2', 'płaszcz, kurtka', 'Załóż płaszcz, jest zimno.', 'Put on your coat, it is cold.'),
('bugsteam2', 'sweter', 'Mój sweter jest ciepły.', 'My jumper is warm.'),
('bugsteam2', 'buty', 'Moje buty są nowe.', 'My shoes are new.'),
('bugsteam2', 'spodenki', 'Noszę spodenki latem.', 'I wear shorts in summer.'),
('bugsteam2', 'spódnica', 'Moja spódnica jest niebieska.', 'My skirt is blue.'),
('bugsteam2', 'spodnie', 'Te spodnie są brązowe.', 'These trousers are brown.'),
('bugsteam2', 'koszulka', 'Moja koszulka jest biała.', 'My T-shirt is white.'),
('bugsteam2', 'czapka z daszkiem', 'Noszę czapkę w słońcu.', 'I wear a cap in the sun.'),
('bugsteam2', 'wiosna', 'Wiosną kwitną kwiaty.', 'Flowers bloom in spring.'),
('bugsteam2', 'lato', 'Latem jest gorąco.', 'It is hot in summer.'),
('bugsteam2', 'jesień', 'Jesienią liście spadają.', 'Leaves fall in autumn.'),
('bugsteam2', 'zima', 'Zimą pada śnieg.', 'It snows in winter.'),
('bugsteam2', 'pochmurnie', 'Dziś jest pochmurnie.', 'It is cloudy today.'),
('bugsteam2', 'deszczowo', 'Jest deszczowo, weź parasol.', 'It is rainy, take an umbrella.'),
('bugsteam2', 'słonecznie', 'W lecie jest słonecznie.', 'It is sunny in summer.'),
('bugsteam2', 'śnieżnie', 'Zimą jest śnieżnie.', 'It is snowy in winter.'),
('bugsteam2', 'Noszę niebieską koszulkę', 'Noszę niebieską koszulkę.', 'I am wearing a blue T-shirt.'),
('bugsteam2', 'Załóż...', 'Załóż czapkę.', 'Put on your cap.'),
('bugsteam2', 'Zdejmij...', 'Zdejmij płaszcz.', 'Take off your coat.'),
('bugsteam2', 'Załóż buty', 'Załóż buty.', 'Put on your shoes.'),
('bugsteam2', 'Zdejmij buty', 'Zdejmij buty.', 'Take off your shoes.'),
('bugsteam2', 'Jaka jest pogoda?', 'Jaka jest pogoda?', 'What is the weather like?'),
('bugsteam2', 'Jest poniedziałek', 'Jest poniedziałek.', 'It is Monday.'),
('bugsteam2', 'Jest lato', 'Jest lato.', 'It is summer.'),
('bugsteam2', 'Jest słonecznie', 'Jest słonecznie.', 'It is sunny.'),
('bugsteam2', 'Lubię zimę', 'Lubię zimę.', 'I like winter.'),
('bugsteam2', 'Nie lubię zimy', 'Nie lubię zimy.', 'I do not like winter.'),

-- ─── Unit 2: pokoje + meble + przyimki (22) ──────────
-- (Unit 3 = Unit 2, te same word_pl — pominiete)
('bugsteam2', 'łazienka', 'Łazienka jest na górze.', 'The bathroom is upstairs.'),
('bugsteam2', 'sypialnia', 'Śpię w sypialni.', 'I sleep in the bedroom.'),
('bugsteam2', 'jadalnia', 'Jemy obiad w jadalni.', 'We eat lunch in the dining room.'),
('bugsteam2', 'przedpokój', 'Buty są w przedpokoju.', 'The shoes are in the hall.'),
('bugsteam2', 'kuchnia', 'Mama jest w kuchni.', 'Mum is in the kitchen.'),
('bugsteam2', 'salon', 'Telewizor jest w salonie.', 'The TV is in the living room.'),
('bugsteam2', 'toaleta', 'Toaleta jest obok łazienki.', 'The toilet is next to the bathroom.'),
('bugsteam2', 'półka', 'Książki są na półce.', 'The books are on the shelf.'),
('bugsteam2', 'szafka', 'Talerze są w szafce.', 'The plates are in the cupboard.'),
('bugsteam2', 'biurko', 'Komputer jest na biurku.', 'The computer is on the desk.'),
('bugsteam2', 'lodówka', 'Mleko jest w lodówce.', 'The milk is in the fridge.'),
('bugsteam2', 'lampa', 'Lampa jest na biurku.', 'The lamp is on the desk.'),
('bugsteam2', 'prysznic', 'Prysznic jest w łazience.', 'The shower is in the bathroom.'),
('bugsteam2', 'ogród', 'Pies jest w ogrodzie.', 'The dog is in the garden.'),
('bugsteam2', 'pudełko', 'Kot jest w pudełku.', 'The cat is in the box.'),
('bugsteam2', 'Gdzie jest mysz?', 'Gdzie jest mysz?', 'Where is the mouse?'),
('bugsteam2', 'Jest w kuchni.', 'Jest w kuchni.', 'It is in the kitchen.'),
('bugsteam2', 'Czy jest but w jadalni? Nie, nie ma.', 'Czy jest but w jadalni? Nie, nie ma.', 'Is there a shoe in the dining room? No, there is not.'),
('bugsteam2', 'Czy jest but w jadalni? Tak, jest.', 'Czy jest but w jadalni? Tak, jest.', 'Is there a shoe in the dining room? Yes, there is.'),
('bugsteam2', 'Jest szafka w salonie', 'Jest szafka w salonie.', 'There is a cupboard in the living room.'),
('bugsteam2', 'Jest w, na pudełku', 'Jest w, na pudełku.', 'It is in, on the box.'),
('bugsteam2', 'Jest pod pudełkiem', 'Jest pod pudełkiem.', 'It is under the box.'),

-- ─── Unit 4: czesci ciala + dolegliwosci + porady (37) ──
('bugsteam2', 'ucho', 'Mam małe uszy.', 'I have small ears.'),
('bugsteam2', 'plecy', 'Bolą mnie plecy.', 'My back hurts.'),
('bugsteam2', 'palec u ręki', 'Skaleczyłem palec.', 'I cut my finger.'),
('bugsteam2', 'szyja', 'Moja szyja jest długa.', 'My neck is long.'),
('bugsteam2', 'palec u nogi', 'Boli mnie palec u nogi.', 'My toe hurts.'),
('bugsteam2', 'ząb', 'Mam biały ząb.', 'I have a white tooth.'),
('bugsteam2', 'brzuch', 'Mam pełny brzuch.', 'I have a full tummy.'),
('bugsteam2', 'ciało', 'Moje ciało jest silne.', 'My body is strong.'),
('bugsteam2', 'nogi', 'Mam dwie nogi.', 'I have two legs.'),
('bugsteam2', 'nos', 'Mam mały nos.', 'I have a small nose.'),
('bugsteam2', 'buzia', 'Otwórz buzię.', 'Open your mouth.'),
('bugsteam2', 'oczy', 'Mam zielone oczy.', 'I have green eyes.'),
('bugsteam2', 'ręce, ramiona', 'Mam dwa ramiona.', 'I have two arms.'),
('bugsteam2', 'głowa', 'Moja głowa jest okrągła.', 'My head is round.'),
('bugsteam2', 'ból pleców', 'Mam ból pleców.', 'I have a backache.'),
('bugsteam2', 'ból ucha', 'Mam ból ucha.', 'I have an earache.'),
('bugsteam2', 'ból głowy', 'Mam ból głowy.', 'I have a headache.'),
('bugsteam2', 'ból szyi', 'Mam ból szyi.', 'I have neck ache.'),
('bugsteam2', 'ból zęba', 'Mam ból zęba.', 'I have a toothache.'),
('bugsteam2', 'ból brzucha', 'Mam ból brzucha.', 'I have a tummy ache.'),
('bugsteam2', 'znudzony', 'Jestem znudzony.', 'I am bored.'),
('bugsteam2', 'przeziębiony', 'Jestem przeziębiony.', 'I have a cold.'),
('bugsteam2', 'gorący', 'Jest mi gorąco.', 'I am hot.'),
('bugsteam2', 'głodny', 'Jestem głodny.', 'I am hungry.'),
('bugsteam2', 'spragniony', 'Jestem spragniony.', 'I am thirsty.'),
('bugsteam2', 'zmęczony', 'Jestem zmęczony.', 'I am tired.'),
('bugsteam2', 'Dotknij głowy', 'Dotknij głowy.', 'Touch your head.'),
('bugsteam2', 'Co się stało? Co ci dolega?', 'Co się stało? Co ci dolega?', 'What is the matter?'),
('bugsteam2', 'Boli mnie ząb / mam ból zęba', 'Boli mnie ząb. Mam ból zęba.', 'I have a toothache.'),
('bugsteam2', 'Boli mnie ucho.', 'Boli mnie ucho.', 'My ear hurts.'),
('bugsteam2', 'Bolą mnie uszy.', 'Bolą mnie uszy.', 'My ears hurt.'),
('bugsteam2', 'Jestem zmęczony.', 'Jestem zmęczony.', 'I am tired.'),
('bugsteam2', 'Jest mi gorąco.', 'Jest mi gorąco.', 'I am hot.'),
('bugsteam2', 'Zjedz banana', 'Zjedz banana.', 'Have a banana.'),
('bugsteam2', 'Odpocznij.', 'Odpocznij.', 'Have a rest.'),
('bugsteam2', 'Przeczytaj książkę.', 'Przeczytaj książkę.', 'Read a book.'),
('bugsteam2', 'Pograj w grę.', 'Pograj w grę.', 'Play a game.'),
('bugsteam2', 'Napij się trochę wody', 'Napij się trochę wody.', 'Drink some water.'),

-- ─── Unit 5: jedzenie + posilki + restauracja (32) ───
('bugsteam2', 'kapusta', 'Lubię kapustę.', 'I like cabbage.'),
('bugsteam2', 'frytki', 'Frytki są słone.', 'Chips are salty.'),
('bugsteam2', 'pulpety', 'Mama gotuje pulpety.', 'Mum is cooking meatballs.'),
('bugsteam2', 'makaron', 'Lubię makaron z serem.', 'I like pasta with cheese.'),
('bugsteam2', 'pizza', 'Pizza jest moim ulubionym jedzeniem.', 'Pizza is my favourite food.'),
('bugsteam2', 'sałatka', 'Sałatka jest zdrowa.', 'Salad is healthy.'),
('bugsteam2', 'zupa', 'Zupa jest gorąca.', 'The soup is hot.'),
('bugsteam2', 'kurczak', 'Lubię kurczaka z ryżem.', 'I like chicken with rice.'),
('bugsteam2', 'śniadanie', 'Jem śniadanie o ósmej.', 'I have breakfast at eight.'),
('bugsteam2', 'obiad', 'Obiad jest o pierwszej.', 'Lunch is at one.'),
('bugsteam2', 'kolacja', 'Jemy kolację razem.', 'We have dinner together.'),
('bugsteam2', 'podwieczorek', 'Podwieczorek jem o czwartej.', 'I have tea at four.'),
('bugsteam2', 'przekąska', 'Jabłko to zdrowa przekąska.', 'An apple is a healthy snack.'),
('bugsteam2', 'jabłko', 'Mam czerwone jabłko.', 'I have a red apple.'),
('bugsteam2', 'banan', 'Banan jest żółty.', 'A banana is yellow.'),
('bugsteam2', 'jogurt', 'Jem jogurt na śniadanie.', 'I eat yogurt for breakfast.'),
('bugsteam2', 'szarlotka', 'Szarlotka jest słodka.', 'Apple pie is sweet.'),
('bugsteam2', 'herbatniki', 'Lubię herbatniki z mlekiem.', 'I like biscuits with milk.'),
('bugsteam2', 'ryba z frytkami', 'Ryba z frytkami to brytyjskie danie.', 'Fish and chips is a British dish.'),
('bugsteam2', 'ser', 'Ser jest na pizzy.', 'There is cheese on the pizza.'),
('bugsteam2', 'woda', 'Piję dużo wody.', 'I drink a lot of water.'),
('bugsteam2', 'Czy ty lubisz zupę? Tak, lubię.', 'Czy ty lubisz zupę? Tak, lubię.', 'Do you like soup? Yes, I do.'),
('bugsteam2', 'Czy ty lubisz zupę? Nie, nie lubię.', 'Czy ty lubisz zupę? Nie, nie lubię.', 'Do you like soup? No, I do not.'),
('bugsteam2', 'Ja lubię sałatkę.', 'Ja lubię sałatkę.', 'I like salad.'),
('bugsteam2', 'Ja nie lubię pulpetów.', 'Ja nie lubię pulpetów.', 'I do not like meatballs.'),
('bugsteam2', 'Co jest w jadłospisie/menu?', 'Co jest w jadłospisie? Co jest w menu?', 'What is on the menu?'),
('bugsteam2', 'Jest zupa i sałatka.', 'Jest zupa i sałatka.', 'There is soup and salad.'),
('bugsteam2', 'Czy mogę prosić o kurczaka?', 'Czy mogę prosić o kurczaka?', 'Can I have some chicken, please?'),
('bugsteam2', 'Tak, oczywiście.', 'Tak, oczywiście.', 'Yes, of course.'),
('bugsteam2', 'Czy mogę prosić o zupę?', 'Czy mogę prosić o zupę?', 'Can I have some soup, please?'),
('bugsteam2', 'Proszę.', 'Proszę.', 'Here you are.'),
('bugsteam2', 'Dziękuję.', 'Dziękuję.', 'Thank you.'),
('bugsteam2', 'Ja jem jajka na śniadanie.', 'Ja jem jajka na śniadanie.', 'I eat eggs for breakfast.'),

-- ─── Unit 6: miejsca rozrywki + sport + miejsca (23) ─
-- („ogrod" pominiete — duplikat z Unit 2)
('bugsteam2', 'kino', 'Idziemy do kina w sobotę.', 'We are going to the cinema on Saturday.'),
('bugsteam2', 'wesołe miasteczko', 'Lubię wesołe miasteczko.', 'I like the funfair.'),
('bugsteam2', 'muzeum', 'W muzeum są stare obrazy.', 'There are old paintings in the museum.'),
('bugsteam2', 'centrum sportowe', 'Gram w piłkę w centrum sportowym.', 'I play football at the sports centre.'),
('bugsteam2', 'basen', 'Pływam w basenie.', 'I swim in the swimming pool.'),
('bugsteam2', 'park wodny', 'Park wodny jest super.', 'The water park is great.'),
('bugsteam2', 'zoo', 'W zoo są lwy.', 'There are lions at the zoo.'),
('bugsteam2', 'park', 'Bawię się w parku.', 'I play in the park.'),
('bugsteam2', 'grać w piłkę nożną', 'Lubię grać w piłkę nożną.', 'I like to play football.'),
('bugsteam2', 'jeździć rowerem', 'Lubię jeździć rowerem.', 'I like to ride a bike.'),
('bugsteam2', 'jeździć na rolkach/wrotkach', 'Potrafię jeździć na rolkach.', 'I can roller-skate.'),
('bugsteam2', 'pływać', 'Potrafię pływać.', 'I can swim.'),
('bugsteam2', 'chodzić', 'Lubię chodzić w górach.', 'I like to walk in the mountains.'),
('bugsteam2', 'szkoła', 'Idę do szkoły codziennie.', 'I go to school every day.'),
('bugsteam2', 'góry', 'W górach jest pięknie.', 'It is beautiful in the mountains.'),
('bugsteam2', 'Czy w mieście jest wesołe miasteczko? Tak, jest.', 'Czy w mieście jest wesołe miasteczko? Tak, jest.', 'Is there a funfair in town? Yes, there is.'),
('bugsteam2', 'Czy w mieście jest wesołe miasteczko? Nie, nie ma.', 'Czy w mieście jest wesołe miasteczko? Nie, nie ma.', 'Is there a funfair in town? No, there is not.'),
('bugsteam2', 'Czy chcesz pójść do wesołego miasteczka? Tak, chcę.', 'Czy chcesz pójść do wesołego miasteczka? Tak, chcę.', 'Do you want to go to the funfair? Yes, I do.'),
('bugsteam2', 'Czy chcesz pójść do wesołego miasteczka? Nie, nie chcę.', 'Czy chcesz pójść do wesołego miasteczka? Nie, nie chcę.', 'Do you want to go to the funfair? No, I do not.'),
('bugsteam2', 'Ja chcę pójść do zoo.', 'Ja chcę pójść do zoo.', 'I want to go to the zoo.'),
('bugsteam2', 'Ja jeżdżę rowerem w parku.', 'Ja jeżdżę rowerem w parku.', 'I ride a bike in the park.'),
('bugsteam2', 'Ja potrafię pływać dobrze/bardzo dobrze.', 'Ja potrafię pływać dobrze. Ja potrafię pływać bardzo dobrze.', 'I can swim well. I can swim very well.'),
('bugsteam2', 'Ja nie potrafię jeździć rowerem.', 'Ja nie potrafię jeździć rowerem.', 'I cannot ride a bike.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Bugs Team 2: 141 unikalnych zdan zaktualizowanych/dodanych w word_sentences (166 wpisow w data.js, 25 duplikatow miedzy Unit 2/3 i Unit 6 zdedupedowanych przez UPSERT).';
END $$;
