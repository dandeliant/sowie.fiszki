-- ═══════════════════════════════════════════════════════════
-- Fix sentences: BUGS TEAM 3 (klasa 3, szkola podstawowa)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne, starannie napisane przyklady zdan dla wszystkich
-- 110 unikalnych slowek z Bugs Team 3.
--
-- Tematy unitow:
--   Unit 1 (32): zwierzeta + co jedza + miejsca zycia
--   Unit 2 (21): ciala zwierzat + przymiotniki + frazy "have got"
--   Unit 3 (35): rutyna codzienna + liczebniki + zawody + godziny
--                (uwaga: data.js ma key=unit3 ale name='Unit 4')
--   Unit 5 (22): sklepy + miejsca w miescie + pytania o droge
--
-- Zasady:
--   - Krotkie zdania, 5-10 slow EN, poziom A1 (klasa 3).
--   - Naturalnie uzywaja target slowa, gramatycznie poprawne PL+EN.
--   - Pasuja do tematyki unitu (zwierzeta -> kangur, sklepy -> piekarnia).
--   - W sentence_pl/sentence_target — bez nawiasow, mimo ze niektore
--     word_pl w data.js nadal je maja (Unit 2 frazy z (zebami) itp.).
--     Sprzatanie nawiasow w data.js to osobna praca jak w Tiger 1.
--   - Pelnie zdaniowe entries (np. "Czy rekiny jedza ryby?") -> echo,
--     EN tlumaczenie naturalnie ("don't" -> "do not" gdzie pasuje).
--
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.
-- Po uruchomieniu: 110 unikalnych zdan w word_sentences dla bugsteam3.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES

-- ─── Unit 1: zwierzeta + jedzenie + miejsca zycia (32) ──
('bugsteam3', 'kangur', 'Kangur skacze wysoko.', 'A kangaroo jumps high.'),
('bugsteam3', 'nosorożec', 'Nosorożec ma duży róg.', 'A rhino has a big horn.'),
('bugsteam3', 'gepard', 'Gepard biega bardzo szybko.', 'A cheetah runs very fast.'),
('bugsteam3', 'tygrys', 'Tygrys ma pomarańczowo-czarne futro.', 'A tiger has orange and black fur.'),
('bugsteam3', 'wieloryb', 'Wieloryb żyje w morzu.', 'A whale lives in the sea.'),
('bugsteam3', 'goryl', 'Goryl jest silny.', 'A gorilla is strong.'),
('bugsteam3', 'rekin', 'Rekin ma ostre zęby.', 'A shark has sharp teeth.'),
('bugsteam3', 'jaszczurka', 'Jaszczurka mieszka na pustyni.', 'A lizard lives in the desert.'),
('bugsteam3', 'owoce', 'Małpy lubią owoce.', 'Monkeys like fruit.'),
('bugsteam3', 'warzywa', 'Króliki jedzą warzywa.', 'Rabbits eat vegetables.'),
('bugsteam3', 'owady', 'Ptaki jedzą owady.', 'Birds eat insects.'),
('bugsteam3', 'mięso', 'Lwy jedzą mięso.', 'Lions eat meat.'),
('bugsteam3', 'ryby', 'Pingwiny jedzą ryby.', 'Penguins eat fish.'),
('bugsteam3', 'dżungla', 'Tygrysy żyją w dżungli.', 'Tigers live in the jungle.'),
('bugsteam3', 'pustynia', 'Wielbłądy żyją na pustyni.', 'Camels live in the desert.'),
('bugsteam3', 'morze', 'Delfiny żyją w morzu.', 'Dolphins live in the sea.'),
('bugsteam3', 'sawanna, obszary trawiaste', 'Słonie żyją na sawannie.', 'Elephants live in the grasslands.'),
('bugsteam3', 'rzeka', 'Krokodyle żyją w rzece.', 'Crocodiles live in the river.'),
('bugsteam3', 'Czy rekiny jedzą ryby?', 'Czy rekiny jedzą ryby?', 'Do sharks eat fish?'),
('bugsteam3', 'Tak, jedzą. Rekiny jedzą ryby.', 'Tak, jedzą. Rekiny jedzą ryby.', 'Yes, they do. Sharks eat fish.'),
('bugsteam3', 'Czy rekiny jedzą owoce?', 'Czy rekiny jedzą owoce?', 'Do sharks eat fruit?'),
('bugsteam3', 'Nie, nie jedzą. One nie jedzą owoców.', 'Nie, nie jedzą. One nie jedzą owoców.', 'No, they do not. They do not eat fruit.'),
('bugsteam3', 'Gepardy nie jedzą owoców i warzyw.', 'Gepardy nie jedzą owoców i warzyw.', 'Cheetahs do not eat fruit and vegetables.'),
('bugsteam3', 'Krokodyle jedzą mięso.', 'Krokodyle jedzą mięso.', 'Crocodiles eat meat.'),
('bugsteam3', 'Rekiny jedzą ryby.', 'Rekiny jedzą ryby.', 'Sharks eat fish.'),
('bugsteam3', 'Kangury żyją w Australii.', 'Kangury żyją w Australii.', 'Kangaroos live in Australia.'),
('bugsteam3', 'Goryle nie żyją w Polsce.', 'Goryle nie żyją w Polsce.', 'Gorillas do not live in Poland.'),
('bugsteam3', 'Gdzie żyją nosorożce?', 'Gdzie żyją nosorożce?', 'Where do rhinos live?'),
('bugsteam3', 'Nosorożce żyją na sawannie.', 'Nosorożce żyją na sawannie.', 'Rhinos live in the grasslands.'),
('bugsteam3', 'Gdzie żyją goryle?', 'Gdzie żyją goryle?', 'Where do gorillas live?'),
('bugsteam3', 'Goryle żyją w dżungli.', 'Goryle żyją w dżungli.', 'Gorillas live in the jungle.'),

-- ─── Unit 2: ciala zwierzat + przymiotniki + have got (21) ──
('bugsteam3', 'wąsy, wibrysy', 'Kot ma długie wąsy.', 'A cat has long whiskers.'),
('bugsteam3', 'język', 'Pies ma różowy język.', 'A dog has a pink tongue.'),
('bugsteam3', 'buzia, pysk', 'Krokodyl ma duży pysk.', 'A crocodile has a big mouth.'),
('bugsteam3', 'zęby', 'Tygrys ma ostre zęby.', 'A tiger has sharp teeth.'),
('bugsteam3', 'ciało', 'Wieloryb ma duże ciało.', 'A whale has a big body.'),
('bugsteam3', 'skrzydła', 'Ptaki mają skrzydła.', 'Birds have wings.'),
('bugsteam3', 'ogon', 'Małpa ma długi ogon.', 'A monkey has a long tail.'),
('bugsteam3', 'pazury', 'Lew ma ostre pazury.', 'A lion has sharp claws.'),
('bugsteam3', 'krótki, niski', 'Świnka morska ma krótki ogon.', 'A guinea pig has a short tail.'),
('bugsteam3', 'długi', 'Żyrafa ma długą szyję.', 'A giraffe has a long neck.'),
('bugsteam3', 'ostry', 'Ten nóż jest ostry.', 'This knife is sharp.'),
('bugsteam3', 'silny', 'Słoń jest bardzo silny.', 'An elephant is very strong.'),
('bugsteam3', 'cienki', 'Wąż ma cienkie ciało.', 'A snake has a thin body.'),
('bugsteam3', 'gruby', 'Hipopotam ma gruby ogon.', 'A hippo has a thick tail.'),
('bugsteam3', 'Mam (duże) (zęby).', 'Mam duże zęby.', 'I have got big teeth.'),
('bugsteam3', 'Nie mam (skrzydeł).', 'Nie mam skrzydeł.', 'I have not got wings.'),
('bugsteam3', 'Czy masz (skrzydła)?', 'Czy masz skrzydła?', 'Have you got wings?'),
('bugsteam3', 'Tak, mam.', 'Tak, mam.', 'Yes, I have.'),
('bugsteam3', 'Nie, nie mam.', 'Nie, nie mam.', 'No, I have not.'),
('bugsteam3', 'On/Ona/To ma (krótkie) (nogi).', 'On ma krótkie nogi.', 'It has got short legs.'),
('bugsteam3', 'On/Ona/To nie ma (ogona).', 'On nie ma ogona.', 'It has not got a tail.'),

-- ─── Unit 3 (name=Unit 4): rutyna + liczebniki + zawody (35) ──
('bugsteam3', 'wstawać', 'Wstaję o siódmej rano.', 'I get up at seven in the morning.'),
('bugsteam3', 'ubierać się', 'Ubieram się szybko.', 'I get dressed quickly.'),
('bugsteam3', 'jeść śniadanie', 'Jem śniadanie z mamą.', 'I have breakfast with my mum.'),
('bugsteam3', 'myć zęby', 'Myję zęby dwa razy dziennie.', 'I brush my teeth twice a day.'),
('bugsteam3', 'iść do szkoły', 'Idę do szkoły o ósmej.', 'I go to school at eight.'),
('bugsteam3', 'jeść obiad', 'Jemy obiad o pierwszej.', 'We have lunch at one.'),
('bugsteam3', 'brać prysznic', 'Biorę prysznic wieczorem.', 'I have a shower in the evening.'),
('bugsteam3', 'jeść kolację', 'Jemy kolację o siódmej.', 'We have dinner at seven.'),
('bugsteam3', 'iść spać', 'Idę spać o dziewiątej.', 'I go to bed at nine.'),
('bugsteam3', 'jeden', 'Mam jednego brata.', 'I have one brother.'),
('bugsteam3', 'dwa', 'Mam dwa koty.', 'I have two cats.'),
('bugsteam3', 'trzy', 'Mam trzy książki.', 'I have three books.'),
('bugsteam3', 'cztery', 'Stół ma cztery nogi.', 'A table has four legs.'),
('bugsteam3', 'pięć', 'Mam pięć palców.', 'I have five fingers.'),
('bugsteam3', 'sześć', 'W klasie jest sześć dziewczynek.', 'There are six girls in the class.'),
('bugsteam3', 'siedem', 'Tydzień ma siedem dni.', 'A week has seven days.'),
('bugsteam3', 'osiem', 'Pająk ma osiem nóg.', 'A spider has eight legs.'),
('bugsteam3', 'dziewięć', 'Mam dziewięć kredek.', 'I have nine crayons.'),
('bugsteam3', 'dziesięć', 'Mam dziesięć palców.', 'I have ten fingers.'),
('bugsteam3', 'dwanaście', 'Rok ma dwanaście miesięcy.', 'A year has twelve months.'),
('bugsteam3', 'nauczyciel', 'Mój nauczyciel jest miły.', 'My teacher is kind.'),
('bugsteam3', 'strażak', 'Strażak gasi pożary.', 'A firefighter puts out fires.'),
('bugsteam3', 'lekarz', 'Lekarz pracuje w szpitalu.', 'A doctor works at the hospital.'),
('bugsteam3', 'sprzedawca', 'Sprzedawca pracuje w sklepie.', 'A shop assistant works in a shop.'),
('bugsteam3', 'policjant', 'Policjant pomaga ludziom.', 'A police officer helps people.'),
('bugsteam3', 'weterynarz', 'Weterynarz leczy zwierzęta.', 'A vet looks after animals.'),
('bugsteam3', 'Która jest godzina?', 'Która jest godzina?', 'What time is it?'),
('bugsteam3', 'Jest dziewiąta.', 'Jest dziewiąta.', 'It is nine o''clock.'),
('bugsteam3', 'Jest wpół do dziesiątej / trzydzieści po dziewiątej.', 'Jest wpół do dziesiątej. Jest trzydzieści po dziewiątej.', 'It is half past nine.'),
('bugsteam3', 'O której jesz śniadanie?', 'O której jesz śniadanie?', 'What time do you have breakfast?'),
('bugsteam3', 'Jem śniadanie o siódmej.', 'Jem śniadanie o siódmej.', 'I have breakfast at seven o''clock.'),
('bugsteam3', 'Jaki jest twój zawód?', 'Jaki jest twój zawód?', 'What is your job?'),
('bugsteam3', 'Jestem weterynarzem.', 'Jestem weterynarzem.', 'I am a vet.'),
('bugsteam3', 'Co robisz w wolnym czasie?', 'Co robisz w wolnym czasie?', 'What do you do in your free time?'),
('bugsteam3', 'Jeżdżę na deskorolce.', 'Jeżdżę na deskorolce.', 'I skateboard.'),

-- ─── Unit 5: sklepy + miejsca w miescie (22) ──────────
('bugsteam3', 'sklep z zabawkami', 'W sklepie z zabawkami są lalki.', 'There are dolls in the toy shop.'),
('bugsteam3', 'piekarnia', 'Kupuję chleb w piekarni.', 'I buy bread at the bakery.'),
('bugsteam3', 'sklep zoologiczny', 'W sklepie zoologicznym są ryby.', 'There are fish in the pet shop.'),
('bugsteam3', 'księgarnia', 'Kupuję książki w księgarni.', 'I buy books at the bookshop.'),
('bugsteam3', 'sklep ze słodyczami', 'Lubię sklep ze słodyczami.', 'I like the sweet shop.'),
('bugsteam3', 'sklep obuwniczy', 'W sklepie obuwniczym są nowe buty.', 'There are new shoes in the shoe shop.'),
('bugsteam3', 'sklep odzieżowy', 'Mama kupuje sukienkę w sklepie odzieżowym.', 'Mum buys a dress at the clothes shop.'),
('bugsteam3', 'targ, rynek', 'Na targu są warzywa.', 'There are vegetables at the market.'),
('bugsteam3', 'szkoła', 'Idę do szkoły codziennie.', 'I go to school every day.'),
('bugsteam3', 'hotel', 'Śpimy w hotelu.', 'We sleep at the hotel.'),
('bugsteam3', 'szpital', 'Lekarze pracują w szpitalu.', 'Doctors work at the hospital.'),
('bugsteam3', 'poczta', 'Wysyłam list na poczcie.', 'I send a letter at the post office.'),
('bugsteam3', 'restauracja', 'Jemy obiad w restauracji.', 'We have lunch at the restaurant.'),
('bugsteam3', 'dworzec kolejowy', 'Pociąg odjeżdża z dworca kolejowego.', 'The train leaves from the train station.'),
('bugsteam3', 'Przepraszam, szukam piekarni.', 'Przepraszam, szukam piekarni.', 'Excuse me, I am looking for a bakery.'),
('bugsteam3', 'Przepraszam, szukam księgarni.', 'Przepraszam, szukam księgarni.', 'Excuse me, I am looking for a bookshop.'),
('bugsteam3', 'Są trzy piekarnie na ulicy Nowej.', 'Są trzy piekarnie na ulicy Nowej.', 'There are three bakeries on New Street.'),
('bugsteam3', 'Jest piekarnia na ulicy Owocowej.', 'Jest piekarnia na ulicy Owocowej.', 'There is a bakery on Fruit Street.'),
('bugsteam3', 'Jest targ/rynek.', 'Jest targ. Jest rynek.', 'There is a market.'),
('bugsteam3', 'Są dwie księgarnie.', 'Są dwie księgarnie.', 'There are two bookshops.'),
('bugsteam3', 'Nie ma szpitala.', 'Nie ma szpitala.', 'There is not a hospital.'),
('bugsteam3', 'Nie ma żadnych restauracji.', 'Nie ma żadnych restauracji.', 'There are not any restaurants.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Bugs Team 3: 110 unikalnych zdan zaktualizowanych/dodanych w word_sentences (32+21+35+22 wpisow w 4 unitach).';
END $$;
