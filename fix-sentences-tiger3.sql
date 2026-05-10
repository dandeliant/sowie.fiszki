-- ═══════════════════════════════════════════════════════════
-- Fix sentences: TIGER AND FRIENDS 3 (klasa 3, szkola podstawowa)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne przykładowe zdania dla wszystkich 105 słówek z Tiger 3.
-- Stan przed: 98 zdań w sentences-tiger.sql (Unit 1-4 + 7 brakujących z Unit 5).
-- Stan po: 105 unikalnych zdań — uzupełniony Unit 5 (sport/aktywności).
--
-- Tematy unitów:
--   Unit 1 (30): czynności + urządzenia (komputer, telefon, tablet...)
--   Unit 2 (20): cechy zwierząt (zęby, ogon, pióra) + klasyfikacja (ssaki...)
--   Unit 3 (23): jedzenie + smaki (słodki, kwaśny, słony, gorzki)
--   Unit 4 (25): plan dnia + pory dnia + godziny
--   Unit 5 (7): sport i aktywności (UZUPEŁNIONE)
--
-- Klucze word_pl wyrównane do data.js (bez nawiasów — konwencja projektu).
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.
-- Po uruchomieniu: 105 zdań w word_sentences dla tiger3.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES
-- ─── Unit 1: czynności + urządzenia (30) ─────────────
('tiger3', 'grać w gry', 'Lubię grać w gry.', 'I like to play games.'),
('tiger3', 'słuchać muzyki', 'Lubię słuchać muzyki.', 'I like to listen to music.'),
('tiger3', 'oglądać filmy', 'Lubię oglądać filmy.', 'I like to watch films.'),
('tiger3', 'używać komputera', 'Używam komputera w domu.', 'I use a computer at home.'),
('tiger3', 'wyjeżdżać na wycieczki', 'Lubię wyjeżdżać na wycieczki.', 'I like to go on excursions.'),
('tiger3', 'robić zdjęcia', 'Lubię robić zdjęcia w parku.', 'I like to take photos in the park.'),
('tiger3', 'pomagać ludziom', 'Lubię pomagać ludziom.', 'I like to help people.'),
('tiger3', 'malować obrazy', 'Lubię malować obrazy.', 'I like to paint pictures.'),
('tiger3', 'robić różne rzeczy, majsterkować', 'Lubię majsterkować w garażu.', 'I like to make things in the garage.'),
('tiger3', 'uprawiać sport', 'Lubię uprawiać sport.', 'I like to do sports.'),
('tiger3', 'grać w gry online', 'Gram w gry online z bratem.', 'I play online games with my brother.'),
('tiger3', 'pisać e-maile', 'Piszę e-maile do babci.', 'I write emails to my grandma.'),
('tiger3', 'oglądać teledyski', 'Oglądam teledyski w domu.', 'I watch music videos at home.'),
('tiger3', 'pisać na blogu klasowym', 'Piszę na blogu klasowym.', 'I write for our class blog.'),
('tiger3', 'robić projekty', 'Robię projekty w szkole.', 'I do projects at school.'),
('tiger3', 'wyszukiwać informacje', 'Wyszukuję informacje na tablecie.', 'I find out information on a tablet.'),
('tiger3', 'laptop', 'Mam nowy laptop.', 'I have a new laptop.'),
('tiger3', 'komputer', 'Komputer jest na biurku.', 'The computer is on the desk.'),
('tiger3', 'telefon komórkowy', 'Mama ma nowy telefon komórkowy.', 'Mum has got a new mobile phone.'),
('tiger3', 'tablet', 'Gram na tablecie.', 'I play on a tablet.'),
('tiger3', 'klawiatura', 'Klawiatura jest czarna.', 'The keyboard is black.'),
('tiger3', 'aparat fotograficzny', 'Mam nowy aparat fotograficzny.', 'I have a new camera.'),
('tiger3', 'ekran', 'Ekran jest duży i jasny.', 'The screen is big and bright.'),
('tiger3', 'mysz', 'Mysz jest obok klawiatury.', 'The mouse is next to the keyboard.'),
('tiger3', 'Ja gram w gry.', 'Ja gram w gry.', 'I play games.'),
('tiger3', 'Nie maluję obrazów.', 'Nie maluję obrazów.', 'I don''t paint pictures.'),
('tiger3', 'Czy ty używasz komputera?', 'Czy ty używasz komputera?', 'Do you use a computer?'),
('tiger3', 'Tak, używam. / Nie, nie używam.', 'Tak, używam. Nie, nie używam.', 'Yes, I do. No, I don''t.'),
('tiger3', 'Laptopy mają ekran.', 'Laptopy mają ekran.', 'Laptops have got a screen.'),
('tiger3', 'Tablety nie mają klawiatury.', 'Tablety nie mają klawiatury.', 'Tablets haven''t got a keyboard.'),

-- ─── Unit 2: cechy zwierząt + klasyfikacja (20) ──────
('tiger3', 'zęby', 'Kot ma ostre zęby.', 'A cat has sharp teeth.'),
('tiger3', 'ogon', 'Pies ma długi ogon.', 'A dog has a long tail.'),
('tiger3', 'pazury', 'Kot ma ostre pazury.', 'A cat has sharp claws.'),
('tiger3', 'pióra', 'Ptak ma kolorowe pióra.', 'A bird has colourful feathers.'),
('tiger3', 'kocie wąsy', 'Kot ma długie wąsy.', 'A cat has long whiskers.'),
('tiger3', 'skrzydła', 'Ptaki mają skrzydła.', 'Birds have wings.'),
('tiger3', 'muszla/skorupa/pancerz', 'Żółw ma twardą skorupę.', 'A turtle has a hard shell.'),
('tiger3', 'futro', 'Kot ma miękkie futro.', 'A cat has soft fur.'),
('tiger3', 'dziób', 'Ptak ma żółty dziób.', 'A bird has a yellow beak.'),
('tiger3', 'łuski', 'Ryby mają łuski.', 'Fish have scales.'),
('tiger3', 'ssaki', 'Koty i psy to ssaki.', 'Cats and dogs are mammals.'),
('tiger3', 'gady', 'Jaszczurki i węże to gady.', 'Lizards and snakes are reptiles.'),
('tiger3', 'płazy', 'Żaby to płazy.', 'Frogs are amphibians.'),
('tiger3', 'ptaki', 'Ptaki latają po niebie.', 'Birds fly in the sky.'),
('tiger3', 'ryby', 'Ryby pływają w morzu.', 'Fish swim in the sea.'),
('tiger3', 'Czy on/ona/ono ma ogon?', 'Czy ono ma ogon?', 'Has it got a tail?'),
('tiger3', 'Tak, ma.', 'Tak, ma.', 'Yes, it has.'),
('tiger3', 'Nie, nie ma.', 'Nie, nie ma.', 'No, it hasn''t.'),
('tiger3', 'On/Ona/Ono ma futro.', 'Ono ma futro.', 'It''s got fur.'),
('tiger3', 'On/Ona/Ono nie ma skorupy.', 'Ono nie ma skorupy.', 'It hasn''t got a shell.'),

-- ─── Unit 3: jedzenie + smaki (23) ───────────────────
('tiger3', 'sok owocowy', 'Piję sok owocowy rano.', 'I drink fruit juice in the morning.'),
('tiger3', 'woda', 'Piję dużo wody.', 'I drink a lot of water.'),
('tiger3', 'kanapki', 'Jem kanapki na obiad.', 'I eat sandwiches for lunch.'),
('tiger3', 'kurczak', 'Lubię kurczaka na obiad.', 'I like chicken for lunch.'),
('tiger3', 'sałatka', 'Sałatka jest zdrowa.', 'Salad is healthy.'),
('tiger3', 'jogurt', 'Jem jogurt na śniadanie.', 'I eat yoghurt for breakfast.'),
('tiger3', 'chipsy', 'Chipsy są słone.', 'Crisps are salty.'),
('tiger3', 'czekolada', 'Czekolada jest słodka.', 'Chocolate is sweet.'),
('tiger3', 'truskawki', 'Truskawki są czerwone i słodkie.', 'Strawberries are red and sweet.'),
('tiger3', 'lody', 'Lubię lody latem.', 'I like ice cream in summer.'),
('tiger3', 'słodki', 'Ten tort jest słodki.', 'This cake is sweet.'),
('tiger3', 'słony', 'Te chipsy są słone.', 'These crisps are salty.'),
('tiger3', 'kwaśny', 'Ta cytryna jest kwaśna.', 'This lemon is sour.'),
('tiger3', 'gorzki', 'Ta czekolada jest gorzka.', 'This chocolate is bitter.'),
('tiger3', 'zdrowy', 'Jogurt jest zdrowy.', 'Yoghurt is healthy.'),
('tiger3', 'deser', 'Na deser mam lody.', 'I have ice cream for dessert.'),
('tiger3', 'Czy lubisz sałatkę z kurczakiem?', 'Czy lubisz sałatkę z kurczakiem?', 'Do you like chicken salad?'),
('tiger3', 'Tak, lubię.', 'Tak, lubię.', 'Yes, I do.'),
('tiger3', 'Nie, nie lubię.', 'Nie, nie lubię.', 'No, I don''t.'),
('tiger3', 'Lubię kanapki.', 'Lubię kanapki.', 'I like sandwiches.'),
('tiger3', 'Nie lubię kanapek.', 'Nie lubię kanapek.', 'I don''t like sandwiches.'),
('tiger3', 'Tom lubi chipsy.', 'Tom lubi chipsy.', 'Tom likes crisps.'),
('tiger3', 'Myślę, że sok pomarańczowy jest słodki.', 'Myślę, że sok pomarańczowy jest słodki.', 'I think orange juice is sweet.'),

-- ─── Unit 4: plan dnia + godziny (25) ────────────────
('tiger3', 'wstawać', 'Wstaję o siódmej rano.', 'I get up at seven in the morning.'),
('tiger3', 'jeść śniadanie', 'Jem śniadanie o ósmej.', 'I have breakfast at eight.'),
('tiger3', 'myć zęby', 'Myję zęby rano i wieczorem.', 'I brush my teeth in the morning and in the evening.'),
('tiger3', 'iść do szkoły', 'Idę do szkoły o ósmej.', 'I go to school at eight.'),
('tiger3', 'jeść obiad', 'Jem obiad w szkole.', 'I have lunch at school.'),
('tiger3', 'iść do domu', 'Idę do domu po lekcjach.', 'I go home after school.'),
('tiger3', 'jeść kolację', 'Jem kolację z rodziną.', 'I have dinner with my family.'),
('tiger3', 'brać prysznic', 'Biorę prysznic wieczorem.', 'I have a shower in the evening.'),
('tiger3', 'zakładać piżamę', 'Zakładam piżamę przed snem.', 'I put on my pyjamas before bed.'),
('tiger3', 'iść spać', 'Idę spać o dziewiątej.', 'I go to bed at nine.'),
('tiger3', 'rano', 'Jem śniadanie rano.', 'I eat breakfast in the morning.'),
('tiger3', 'po południu', 'Bawię się po południu.', 'I play in the afternoon.'),
('tiger3', 'wieczorem', 'Czytam książkę wieczorem.', 'I read a book in the evening.'),
('tiger3', 'w południe', 'Jem obiad w południe.', 'I eat lunch at midday.'),
('tiger3', 'w nocy', 'Śpię w nocy.', 'I sleep at night.'),
('tiger3', 'o północy', 'Jest ciemno o północy.', 'It is dark at midnight.'),
('tiger3', 'Która jest godzina?', 'Która jest godzina?', 'What time is it?'),
('tiger3', 'Jest pierwsza.', 'Jest pierwsza.', 'It''s one o''clock.'),
('tiger3', 'Jest wpół do drugiej / pierwsza trzydzieści.', 'Jest wpół do drugiej.', 'It''s half past one.'),
('tiger3', 'Wstaję o wpół do siódmej.', 'Wstaję o wpół do siódmej.', 'I get up at half past six.'),
('tiger3', 'Czy jesz śniadanie o siódmej?', 'Czy jesz śniadanie o siódmej?', 'Do you have breakfast at seven o''clock?'),
('tiger3', 'Tak.', 'Tak.', 'Yes, I do.'),
('tiger3', 'Nie.', 'Nie.', 'No, I don''t.'),
('tiger3', 'Kiedy bierzesz prysznic?', 'Kiedy bierzesz prysznic?', 'When do you have a shower?'),
('tiger3', 'Biorę prysznic wieczorem.', 'Biorę prysznic wieczorem.', 'I have a shower in the evening.'),

-- ─── Unit 5: sport i aktywności (7) — UZUPEŁNIONE ───
('tiger3', 'nurkować', 'Lubię nurkować w morzu.', 'I like to dive in the sea.'),
('tiger3', 'wiosłować', 'Mój brat lubi wiosłować po jeziorze.', 'My brother likes to row on the lake.'),
('tiger3', 'grać w tenisa stołowego', 'Lubię grać w tenisa stołowego.', 'I like to play table tennis.'),
('tiger3', 'uprawiać judo', 'Mój kuzyn uprawia judo.', 'My cousin does judo.'),
('tiger3', 'uprawiać karate', 'Lubię uprawiać karate.', 'I like to do karate.'),
('tiger3', 'jeździć rowerem', 'Codziennie jeżdżę rowerem do szkoły.', 'I ride a bike to school every day.'),
('tiger3', 'jeździć konno', 'Moja siostra lubi jeździć konno.', 'My sister likes to ride a horse.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Tiger 3: 105 zdan zaktualizowanych/dodanych w word_sentences.';
END $$;
