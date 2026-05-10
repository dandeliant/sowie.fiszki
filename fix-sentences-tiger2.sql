-- ═══════════════════════════════════════════════════════════
-- Fix sentences: TIGER AND FRIENDS 2 (klasa 2, szkola podstawowa)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne przykładowe zdania dla wszystkich 125 słówek z Tiger 2.
-- Stan przed: 96 zdań w sentences-tiger.sql (Unit 1-4 + część Unit 5).
-- Stan po: 125 unikalnych zdań — uzupełniony cały Unit 5 (29 brakujących).
--
-- Tematy unitów:
--   Unit 1 (25): pokoje + przyimki miejsca (in/on/under/behind...)
--   Unit 2 (22): zwierzęta domowe + co jedzą
--   Unit 3 (21): ubrania + pory roku
--   Unit 4 (28): gry + miejsca w szkole + dni tygodnia
--   Unit 5 (29): choroby + zdrowe nawyki (UZUPEŁNIONE)
--
-- Każde zdanie:
--   - Krótkie i odpowiednie dla klasy 2 (5-10 słów EN).
--   - Gramatycznie poprawne w obu językach.
--   - Naturalnie używa target słowa.
--   - Pasuje do tematyki unitu.
--   - Bez nawiasów (konwencja projektu).
--
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.
-- Po uruchomieniu: 125 zdań w word_sentences dla tiger2.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES
-- ─── Unit 1: pokoje i przyimki miejsca (25) ─────────
('tiger2', 'łazienka', 'Łazienka jest duża.', 'The bathroom is big.'),
('tiger2', 'sypialnia', 'Śpię w sypialni.', 'I sleep in the bedroom.'),
('tiger2', 'jadalnia', 'Jemy obiad w jadalni.', 'We eat lunch in the dining room.'),
('tiger2', 'przedpokój', 'Buty są w przedpokoju.', 'The shoes are in the hall.'),
('tiger2', 'kuchnia', 'Mama jest w kuchni.', 'Mum is in the kitchen.'),
('tiger2', 'salon', 'Sofa jest w salonie.', 'The sofa is in the living room.'),
('tiger2', 'toaleta', 'Toaleta jest obok łazienki.', 'The toilet is next to the bathroom.'),
('tiger2', 'garaż', 'Samochód jest w garażu.', 'The car is in the garage.'),
('tiger2', 'łóżko', 'Moje łóżko jest miękkie.', 'My bed is soft.'),
('tiger2', 'lodówka', 'Mleko jest w lodówce.', 'The milk is in the fridge.'),
('tiger2', 'zegar', 'Zegar jest na ścianie.', 'The clock is on the wall.'),
('tiger2', 'kuchenka', 'Kuchenka jest w kuchni.', 'The cooker is in the kitchen.'),
('tiger2', 'prysznic', 'Prysznic jest w łazience.', 'The shower is in the bathroom.'),
('tiger2', 'sofa', 'Sofa jest wygodna.', 'The sofa is comfortable.'),
('tiger2', 'za', 'Kot jest za sofą.', 'The cat is behind the sofa.'),
('tiger2', 'w', 'Piłka jest w pudełku.', 'The ball is in the box.'),
('tiger2', 'obok', 'Krzesło jest obok stołu.', 'The chair is next to the table.'),
('tiger2', 'pod', 'Kot jest pod łóżkiem.', 'The cat is under the bed.'),
('tiger2', 'Gdzie jest Jay?', 'Gdzie jest Jay?', 'Where''s Jay?'),
('tiger2', 'Czy on jest w przedpokoju?', 'Czy on jest w przedpokoju?', 'Is he in the hall?'),
('tiger2', 'Tak, jest.', 'Tak, jest.', 'Yes, he is.'),
('tiger2', 'Nie, nie jest.', 'Nie, nie jest.', 'No, he isn''t.'),
('tiger2', 'Gdzie jest lodówka?', 'Gdzie jest lodówka?', 'Where''s the fridge?'),
('tiger2', 'Jest w kuchni.', 'Jest w kuchni.', 'It''s in the kitchen.'),
('tiger2', 'Prysznic jest w łazience.', 'Prysznic jest w łazience.', 'The shower is in the bathroom.'),

-- ─── Unit 2: zwierzęta domowe + co jedzą (22) ───────
('tiger2', 'jaszczurka', 'To jest zielona jaszczurka.', 'This is a green lizard.'),
('tiger2', 'chomik', 'Mój chomik jest mały.', 'My hamster is small.'),
('tiger2', 'kotek', 'Kotek pije mleko.', 'The kitten drinks milk.'),
('tiger2', 'ptak', 'Ptak śpiewa na drzewie.', 'The bird sings in the tree.'),
('tiger2', 'szczeniak', 'Szczeniak bawi się w ogrodzie.', 'The puppy plays in the garden.'),
('tiger2', 'królik', 'Królik je marchewkę.', 'The rabbit eats a carrot.'),
('tiger2', 'ryba', 'Ryba pływa w wodzie.', 'The fish swims in water.'),
('tiger2', 'żółw', 'Żółw jest powolny.', 'The turtle is slow.'),
('tiger2', 'trawa', 'Trawa jest zielona.', 'The grass is green.'),
('tiger2', 'owady', 'Owady są w ogrodzie.', 'The insects are in the garden.'),
('tiger2', 'nasiona', 'Ptak je nasiona.', 'The bird eats seeds.'),
('tiger2', 'mięso', 'Pies lubi mięso.', 'The dog likes meat.'),
('tiger2', 'liście', 'Liście spadają z drzewa.', 'Leaves fall from the tree.'),
('tiger2', 'Czy Tom ma królika?', 'Czy Tom ma królika?', 'Has Tom got a rabbit?'),
('tiger2', 'Tak, on ma.', 'Tak, on ma.', 'Yes, he has.'),
('tiger2', 'Nie, on nie ma.', 'Nie, on nie ma.', 'No, he hasn''t.'),
('tiger2', 'Czy Monica ma jaszczurkę?', 'Czy Monica ma jaszczurkę?', 'Has Monica got a lizard?'),
('tiger2', 'Tak, ona ma.', 'Tak, ona ma.', 'Yes, she has.'),
('tiger2', 'Nie, ona nie ma.', 'Nie, ona nie ma.', 'No, she hasn''t.'),
('tiger2', 'Tom ma rybkę.', 'Tom ma rybkę.', 'Tom has got a fish.'),
('tiger2', 'Tom nie ma jaszczurki.', 'Tom nie ma jaszczurki.', 'Tom hasn''t got a lizard.'),
('tiger2', 'Króliki jedzą trawę i liście.', 'Króliki jedzą trawę i liście.', 'Rabbits eat grass and leaves.'),

-- ─── Unit 3: ubrania + pory roku (21) ───────────────
('tiger2', 'spódnica', 'Mam czerwoną spódnicę.', 'I have a red skirt.'),
('tiger2', 'spodnie', 'Moje spodnie są niebieskie.', 'My trousers are blue.'),
('tiger2', 'płaszcz', 'Noszę płaszcz zimą.', 'I wear a coat in winter.'),
('tiger2', 'buty', 'Moje buty są nowe.', 'My shoes are new.'),
('tiger2', 'koszulka', 'Mam białą koszulkę.', 'I have a white T-shirt.'),
('tiger2', 'sweter', 'Mój sweter jest ciepły.', 'My jumper is warm.'),
('tiger2', 'koszula', 'Tata nosi koszulę.', 'My dad wears a shirt.'),
('tiger2', 'krótkie spodenki', 'Noszę krótkie spodenki latem.', 'I wear shorts in summer.'),
('tiger2', 'wiosna', 'Wiosną kwitną kwiaty.', 'In spring, flowers grow.'),
('tiger2', 'lato', 'Latem jest ciepło.', 'In summer, it is warm.'),
('tiger2', 'jesień', 'Jesienią liście spadają z drzew.', 'In autumn, leaves fall from the trees.'),
('tiger2', 'zima', 'Zimą pada śnieg.', 'In winter, it snows.'),
('tiger2', 'kwiaty', 'Kwiaty są piękne.', 'The flowers are beautiful.'),
('tiger2', 'drzewo', 'Drzewo jest duże i zielone.', 'The tree is big and green.'),
('tiger2', 'śnieg', 'Śnieg jest biały i zimny.', 'The snow is white and cold.'),
('tiger2', 'Noszę płaszcz.', 'Noszę płaszcz.', 'I''m wearing a coat.'),
('tiger2', 'Noszę krótkie spodenki.', 'Noszę krótkie spodenki.', 'I''m wearing shorts.'),
('tiger2', 'Jaka jest twoja ulubiona pora roku?', 'Jaka jest twoja ulubiona pora roku?', 'What''s your favourite season?'),
('tiger2', 'Moja ulubiona pora roku to wiosna.', 'Moja ulubiona pora roku to wiosna.', 'My favourite season is spring.'),
('tiger2', 'Lubię lato.', 'Lubię lato.', 'I like summer.'),
('tiger2', 'Wiosną możesz zobaczyć kwiaty na drzewie.', 'Wiosną możesz zobaczyć kwiaty na drzewie.', 'In spring, you can see flowers on the tree.'),

-- ─── Unit 4: gry + szkoła + dni tygodnia (28) ────────
('tiger2', 'gra komputerowa', 'Lubię grać w gry komputerowe.', 'I like to play computer games.'),
('tiger2', 'koszykówka', 'Lubię grać w koszykówkę.', 'I like to play basketball.'),
('tiger2', 'karty', 'Gramy w karty z bratem.', 'I play cards with my brother.'),
('tiger2', 'gra planszowa', 'Lubię gry planszowe.', 'I like board games.'),
('tiger2', 'gra w klasy', 'Gramy w klasy na dworze.', 'We play hopscotch outside.'),
('tiger2', 'piłka nożna', 'Gram w piłkę nożną w parku.', 'I play football in the park.'),
('tiger2', 'zabawa w chowanego', 'Lubię zabawę w chowanego.', 'I like hide and seek.'),
('tiger2', 'zabawa w berka', 'Gramy w berka na przerwie.', 'We play tag at break time.'),
('tiger2', 'klasa', 'Nasza klasa jest duża.', 'Our classroom is big.'),
('tiger2', 'sala gimnastyczna', 'Ćwiczymy w sali gimnastycznej.', 'We do exercise in the gym.'),
('tiger2', 'korytarz', 'Korytarz jest długi.', 'The corridor is long.'),
('tiger2', 'biblioteka', 'Czytam książki w bibliotece.', 'I read books in the library.'),
('tiger2', 'stołówka', 'Jem obiad w stołówce.', 'I eat lunch in the canteen.'),
('tiger2', 'plac zabaw', 'Bawimy się na placu zabaw.', 'We play in the playground.'),
('tiger2', 'poniedziałek', 'W poniedziałek idę do szkoły.', 'On Monday, I go to school.'),
('tiger2', 'wtorek', 'We wtorek mam angielski.', 'On Tuesday, I have English.'),
('tiger2', 'środa', 'W środę gram w piłkę nożną.', 'On Wednesday, I play football.'),
('tiger2', 'czwartek', 'W czwartek mam matematykę.', 'On Thursday, I have maths.'),
('tiger2', 'piątek', 'W piątek idę do parku.', 'On Friday, I go to the park.'),
('tiger2', 'sobota', 'W sobotę bawię się w domu.', 'On Saturday, I play at home.'),
('tiger2', 'niedziela', 'W niedzielę odwiedzam babcię.', 'On Sunday, I visit my grandma.'),
('tiger2', 'Czy chcesz zagrać w grę planszową?', 'Czy chcesz zagrać w grę planszową?', 'Do you want to play a board game?'),
('tiger2', 'Dobry pomysł!', 'Dobry pomysł!', 'Good idea!'),
('tiger2', 'Nie, dzięki, chcę zagrać w grę komputerową.', 'Nie, dzięki, chcę zagrać w grę komputerową.', 'No, thanks, I want to play a computer game.'),
('tiger2', 'Czy mogę bawić się na placu zabaw?', 'Czy mogę bawić się na placu zabaw?', 'Can I play in the playground?'),
('tiger2', 'Tak, możesz.', 'Tak, możesz.', 'Yes, you can.'),
('tiger2', 'Nie, nie możesz.', 'Nie, nie możesz.', 'No, you can''t.'),
('tiger2', 'Możesz / nie możesz grać w gry z piłką w klasie.', 'Nie możesz grać w piłkę w klasie.', 'You can''t play ball games in the classroom.'),

-- ─── Unit 5: choroby + zdrowe nawyki (29) ────────────
-- Choroby (single-word entries):
('tiger2', 'ból głowy', 'Mam ból głowy.', 'I have a headache.'),
('tiger2', 'kaszel', 'Mój brat ma kaszel.', 'My brother has a cough.'),
('tiger2', 'ból gardła', 'Mam ból gardła.', 'I have a sore throat.'),
('tiger2', 'ból ucha', 'Mam ból ucha.', 'I have an earache.'),
('tiger2', 'ból brzucha', 'Mam ból brzucha.', 'I have a tummy ache.'),
('tiger2', 'przeziębienie', 'Mam przeziębienie.', 'I have a cold.'),
('tiger2', 'ból zęba', 'Mam ból zęba.', 'I have a toothache.'),
('tiger2', 'skaleczenie, zacięcie', 'Mam skaleczenie na palcu.', 'I have a cut on my finger.'),
-- Pełne zdania (echo):
('tiger2', 'Boli mnie głowa.', 'Boli mnie głowa.', 'I''ve got a headache.'),
('tiger2', 'Mam kaszel.', 'Mam kaszel.', 'I''ve got a cough.'),
('tiger2', 'Boli mnie gardło.', 'Boli mnie gardło.', 'I''ve got a sore throat.'),
('tiger2', 'Boli mnie ucho.', 'Boli mnie ucho.', 'I''ve got an earache.'),
('tiger2', 'Boli mnie brzuch.', 'Boli mnie brzuch.', 'I''ve got a tummy ache.'),
('tiger2', 'Boli mnie ząb.', 'Boli mnie ząb.', 'I''ve got a toothache.'),
('tiger2', 'Czuję się chory/chora.', 'Czuję się chory.', 'I''m feeling ill.'),
('tiger2', 'Czy boli cię głowa? Tak.', 'Czy boli cię głowa? Tak, boli.', 'Have you got a headache? Yes, I have.'),
('tiger2', 'Czy boli cię ząb? Nie.', 'Czy boli cię ząb? Nie, nie boli.', 'Have you got a toothache? No, I haven''t.'),
-- Zdrowe nawyki (czasowniki):
('tiger2', 'pić wodę', 'Powinieneś dużo pić wody.', 'You should drink a lot of water.'),
('tiger2', 'myć', 'Myję ręce przed jedzeniem.', 'I wash my hands before eating.'),
('tiger2', 'ćwiczyć', 'Codziennie ćwiczę.', 'I do exercise every day.'),
('tiger2', 'zdrowo się odżywiać', 'Zdrowo się odżywiam.', 'I eat well.'),
('tiger2', 'dobrze się wysypiać', 'Dobrze się wysypiam w nocy.', 'I sleep well at night.'),
-- Pełne zdania (echo):
('tiger2', 'Musisz zdrowo się odżywiać.', 'Musisz zdrowo się odżywiać.', 'You need to eat well.'),
('tiger2', 'Musisz ćwiczyć.', 'Musisz ćwiczyć.', 'You need to do exercise.'),
('tiger2', 'Ćwiczę codziennie.', 'Ćwiczę codziennie.', 'I do exercise every day.'),
('tiger2', 'Piję wodę codziennie.', 'Piję wodę codziennie.', 'I drink water every day.'),
('tiger2', 'Czy codziennie pijesz wodę? Tak.', 'Czy codziennie pijesz wodę? Tak, piję.', 'Do you drink water every day? Yes, I do.'),
('tiger2', 'Czy ćwiczysz codziennie? Nie.', 'Czy ćwiczysz codziennie? Nie, nie ćwiczę.', 'Do you do exercise every day? No, I don''t.'),
('tiger2', 'bawić się', 'Lubię bawić się z przyjaciółmi.', 'I like to play with my friends.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Tiger 2: 125 zdan zaktualizowanych/dodanych w word_sentences.';
END $$;
