-- ═══════════════════════════════════════════════════════════
-- Fix sentences: TIGER AND FRIENDS 1 (klasa 1, szkola podstawowa)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: poprawione i uzupełnione przykładowe zdania dla wszystkich
-- 98 słówek z Tiger and Friends 1. Dotychczas brakowało Unitu 5
-- (zwierzęta i umiejętności) oraz zdarzały się drobne błędy
-- semantyczne (np. „I can listen to birds" zamiast „I can hear birds").
--
-- Każde zdanie:
--   - Krótkie i odpowiednie dla klasy 1.
--   - Gramatycznie poprawne w obu językach.
--   - Naturalnie używa target słowa.
--   - Pasuje do tematyki unitu.
--
-- Konwencja: UPSERT (INSERT ... ON CONFLICT ... DO UPDATE) — bezpiecznie
-- zaktualizuje istniejące wpisy i doda brakujące. Idempotentna.
--
-- Po uruchomieniu: 98 zdań w word_sentences dla tiger1.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES
-- ─── Unit 1: szkoła i czynności (18) ─────────────────
('tiger1', 'długopis', 'Mam niebieski długopis.', 'I have a blue pen.'),
('tiger1', 'kredka', 'To jest czerwona kredka.', 'This is a red crayon.'),
('tiger1', 'plecak', 'Mój plecak jest zielony.', 'My bag is green.'),
('tiger1', 'ołówek', 'Mam ołówek na biurku.', 'I have a pencil on the desk.'),
('tiger1', 'linijka', 'Ta linijka jest długa.', 'This ruler is long.'),
('tiger1', 'gumka do mazania', 'Potrzebuję gumkę do mazania.', 'I need a rubber.'),
('tiger1', 'piórnik', 'Mój piórnik jest w plecaku.', 'My pencil case is in my bag.'),
('tiger1', 'temperówka', 'Mam małą temperówkę.', 'I have a small sharpener.'),
('tiger1', 'mówić, rozmawiać', 'Lubię rozmawiać z mamą.', 'I like to talk to my mum.'),
('tiger1', 'rysować', 'Lubię rysować koty.', 'I like to draw cats.'),
('tiger1', 'kolorować', 'Lubię kolorować obrazki.', 'I like to colour pictures.'),
('tiger1', 'grać, bawić się', 'Lubię się bawić w parku.', 'I like to play in the park.'),
('tiger1', 'śpiewać', 'Lubię śpiewać piosenki.', 'I like to sing songs.'),
('tiger1', 'Czy mogę prosić o ten ołówek?', 'Czy mogę prosić o ten ołówek?', 'Can I have this pencil, please?'),
('tiger1', 'Tak, oczywiście.', 'Tak, oczywiście.', 'Yes, of course.'),
('tiger1', 'Dziękuję.', 'Dziękuję.', 'Thank you.'),
('tiger1', 'Ja rysuję w szkole.', 'Ja rysuję w szkole.', 'I draw at school.'),
('tiger1', 'Czy ty śpiewasz w szkole? Tak. Nie.', 'Czy ty śpiewasz w szkole? Tak, śpiewam. Nie, nie śpiewam.', 'Do you sing at school? Yes, I do. No, I don''t.'),

-- ─── Unit 2: ciało i zmysły (17) ─────────────────────
('tiger1', 'nos', 'Mam mały nos.', 'I have a small nose.'),
('tiger1', 'uszy', 'Moje uszy są małe.', 'My ears are small.'),
('tiger1', 'głowa', 'Moja głowa jest duża.', 'My head is big.'),
('tiger1', 'ręce, ramiona', 'Mam dwa ramiona.', 'I have two arms.'),
('tiger1', 'usta, buzia', 'Smakuję ustami.', 'I taste with my mouth.'),
('tiger1', 'oczy', 'Mam niebieskie oczy.', 'I have blue eyes.'),
('tiger1', 'ręce, dłonie', 'Myję ręce przed obiadem.', 'I wash my hands before lunch.'),
('tiger1', 'nogi', 'Mam dwie nogi.', 'I have two legs.'),
('tiger1', 'słyszeć', 'Słyszę ptaki w parku.', 'I can hear birds in the park.'),
('tiger1', 'widzieć', 'Widzę drzewo w parku.', 'I can see a tree in the park.'),
('tiger1', 'smakować', 'Lubię smak truskawek.', 'I like the taste of strawberries.'),
('tiger1', 'dotykać', 'Dotykam miękkiego kota.', 'I touch the soft cat.'),
('tiger1', 'wąchać / czuć zapach', 'Wącham piękne kwiaty.', 'I smell the beautiful flowers.'),
('tiger1', 'Mam jeden nos.', 'Mam jeden nos.', 'I''ve got one nose.'),
('tiger1', 'Mam dwie ręce.', 'Mam dwie ręce.', 'I''ve got two hands.'),
('tiger1', 'Słucham uszami.', 'Słucham uszami.', 'I listen with my ears.'),
('tiger1', 'Widzę za pomocą oczu.', 'Widzę za pomocą oczu.', 'I see with my eyes.'),

-- ─── Unit 3: rodzina (14) ─────────────────────────────
('tiger1', 'mama', 'Moja mama jest miła.', 'My mother is nice.'),
('tiger1', 'tata', 'Mój tata jest wysoki.', 'My father is tall.'),
('tiger1', 'siostra', 'Moja siostra jest mała.', 'My sister is small.'),
('tiger1', 'brat', 'Mój brat lubi grać w piłkę.', 'My brother likes to play football.'),
('tiger1', 'dzidziuś, niemowlak', 'Dzidziuś śpi w łóżeczku.', 'The baby is sleeping in the cot.'),
('tiger1', 'babcia', 'Moja babcia robi pyszne ciasto.', 'My grandmother makes a tasty cake.'),
('tiger1', 'ciocia', 'Moja ciocia mieszka blisko.', 'My aunt lives near me.'),
('tiger1', 'wujek', 'Mój wujek ma duży samochód.', 'My uncle has a big car.'),
('tiger1', 'kuzyni', 'Moi kuzyni lubią piłkę nożną.', 'My cousins like football.'),
('tiger1', 'rodzina', 'Moja rodzina jest duża.', 'My family is big.'),
('tiger1', 'mała', 'Moja siostra jest mała.', 'My sister is small.'),
('tiger1', 'duża', 'Nasza szkoła jest duża.', 'Our school is big.'),
('tiger1', 'Kto to jest?', 'Kto to jest?', 'Who''s this?'),
('tiger1', 'To jest moja siostra.', 'To jest moja siostra.', 'This is my sister.'),

-- ─── Unit 4: jedzenie (23) ────────────────────────────
('tiger1', 'ziemniaki', 'Lubię ziemniaki na obiad.', 'I like potatoes for lunch.'),
('tiger1', 'mleko', 'Piję mleko rano.', 'I drink milk in the morning.'),
('tiger1', 'marchewki', 'Marchewki są pomarańczowe.', 'Carrots are orange.'),
('tiger1', 'groszek', 'Groszek jest zielony.', 'Peas are green.'),
('tiger1', 'jajka', 'Jem jajka na śniadanie.', 'I eat eggs for breakfast.'),
('tiger1', 'szynka', 'Lubię szynkę na kanapce.', 'I like ham on a sandwich.'),
('tiger1', 'ser', 'Lubię żółty ser.', 'I like yellow cheese.'),
('tiger1', 'kiełbaski', 'Kiełbaski są smaczne.', 'Sausages are tasty.'),
('tiger1', 'rośliny', 'Kwiaty to rośliny.', 'Flowers are plants.'),
('tiger1', 'zwierzęta', 'Lubię zwierzęta w zoo.', 'I like animals in the zoo.'),
('tiger1', 'owoce', 'Jabłka i banany to owoce.', 'Apples and bananas are fruit.'),
('tiger1', 'warzywa', 'Marchewki i ziemniaki to warzywa.', 'Carrots and potatoes are vegetables.'),
('tiger1', 'mięso', 'Szynka i kiełbaski to mięso.', 'Ham and sausages are meat.'),
('tiger1', 'ryby', 'Ryby pływają w wodzie.', 'Fish swim in the water.'),
('tiger1', 'Czy lubisz ziemniaki?', 'Czy lubisz ziemniaki?', 'Do you like potatoes?'),
('tiger1', 'Tak, lubię.', 'Tak, lubię.', 'Yes, I do.'),
('tiger1', 'Nie, nie lubię.', 'Nie, nie lubię.', 'No, I don''t.'),
('tiger1', 'Lubię mleko.', 'Lubię mleko.', 'I like milk.'),
('tiger1', 'Nie lubię kiełbasek.', 'Nie lubię kiełbasek.', 'I don''t like sausages.'),
('tiger1', 'Banany są owocami.', 'Banany są owocami.', 'Bananas are fruit.'),
('tiger1', 'Banany są z roślin.', 'Banany są z roślin.', 'Bananas are from plants.'),
('tiger1', 'Szynka to mięso.', 'Szynka to mięso.', 'Ham is meat.'),
('tiger1', 'Szynka jest od zwierząt.', 'Szynka jest od zwierząt.', 'Ham is from animals.'),

-- ─── Unit 5: zwierzęta i umiejętności (26) ──────────
-- Zwierzęta z charakterystycznymi cechami / umiejętnościami:
('tiger1', 'wąż', 'Wąż jest długi.', 'A snake is long.'),
('tiger1', 'żaba', 'Żaba potrafi pływać i skakać.', 'A frog can swim and jump.'),
('tiger1', 'papuga', 'Papuga potrafi latać i mówić.', 'A parrot can fly and talk.'),
('tiger1', 'słoń', 'Słoń jest bardzo duży.', 'An elephant is very big.'),
('tiger1', 'małpa', 'Małpa potrafi się wspinać.', 'A monkey can climb.'),
('tiger1', 'mysz', 'Mysz jest mała i szybka.', 'A mouse is small and fast.'),
('tiger1', 'żyrafa', 'Żyrafa jest bardzo wysoka.', 'A giraffe is very tall.'),
('tiger1', 'krokodyl', 'Krokodyl potrafi pływać.', 'A crocodile can swim.'),
-- Umiejętności (czasowniki):
('tiger1', 'chodzić', 'Codziennie chodzę do szkoły.', 'I walk to school every day.'),
('tiger1', 'biegać', 'Lubię biegać w parku.', 'I like to run in the park.'),
('tiger1', 'wspinać się', 'Małpy potrafią się wspinać po drzewach.', 'Monkeys can climb trees.'),
('tiger1', 'skakać', 'Żaby potrafią skakać wysoko.', 'Frogs can jump high.'),
('tiger1', 'pływać', 'Ryby potrafią pływać szybko.', 'Fish can swim fast.'),
('tiger1', 'latać', 'Ptaki potrafią latać.', 'Birds can fly.'),
-- Pełne zdania (już są kompletnymi przykładami — echo):
('tiger1', 'Spójrz na małpę.', 'Spójrz na małpę.', 'Look at the monkey.'),
('tiger1', 'Ta małpa potrafi się wspinać.', 'Ta małpa potrafi się wspinać.', 'The monkey can climb.'),
('tiger1', 'Żyrafa potrafi biegać.', 'Żyrafa potrafi biegać.', 'A giraffe can run.'),
('tiger1', 'Potrafisz skakać? Tak, potrafię.', 'Czy potrafisz skakać? Tak, potrafię.', 'Can you jump? Yes, I can.'),
('tiger1', 'Potrafisz latać? Nie, nie potrafię.', 'Czy potrafisz latać? Nie, nie potrafię.', 'Can you fly? No, I can''t.'),
-- „Dziękuję." pominięte tutaj — ten sam klucz word_pl jest w Unit 1.
-- PostgreSQL nie pozwala na duplikat klucza w jednym INSERT z ON CONFLICT.
('tiger1', 'Czy możesz mi pomóc?', 'Czy możesz mi pomóc?', 'Can you help me, please?'),
('tiger1', 'Tak, oczywiście, że mogę.', 'Tak, oczywiście, że mogę.', 'Yes, of course I can.'),
('tiger1', 'Nie, przepraszam, nie mogę.', 'Nie, przepraszam, nie mogę.', 'No, sorry, I can''t.'),
('tiger1', 'Żaba potrafi skakać.', 'Żaba potrafi skakać.', 'A frog can jump.'),
('tiger1', 'Krokodyl potrafi pływać.', 'Krokodyl potrafi pływać.', 'A crocodile can swim.'),
('tiger1', 'Papuga potrafi latać.', 'Papuga potrafi latać.', 'A parrot can fly.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Tiger 1: 97 unikalnych zdan zaktualizowanych/dodanych w word_sentences (98 slow, 1 duplikat „Dziekuje." dzielony miedzy Unit 1 i Unit 5).';
END $$;
