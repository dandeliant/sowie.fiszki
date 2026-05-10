-- ═══════════════════════════════════════════════════════════
-- Fix sentences: ENGLISH CLASS A1 (klasa 4, szkola podstawowa)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne, starannie napisane przyklady zdan dla wszystkich
-- 371 unikalnych slowek z English Class A1 (Pearson, klasa 4).
--
-- W data.js jest 372 wpisow:
--  - 'papuga' powtarza sie (Unit 3.3 'parrot' + Unit 7.2 'parrot') — synonim
--    EN, pominiete w SQL (UPSERT trzyma jedna wartosc — bez straty).
--  - 'uroczy' rozni sie znaczeniem (Unit 1.2 'lovely' + Unit 7.5 'cute') —
--    rozdzielone w data.js przez disambiguacje nawiasem:
--    'uroczy (przyjemny)' / 'uroczy (slodki)' — oba zachowane w SQL.
--
-- Tematy unitow:
--   Unit 1 (87): rodzina + znajomi + kraje + narodowosci + przedstawienie
--   Unit 2 (53): ubrania + przymiotniki + dane osobowe + przedmioty
--   Unit 3 (41): pokoje w domu + przyimki miejsca + przyjmowanie gosci
--   Unit 4 (39): twarz + cialo + osobowosc + przepraszanie
--   Unit 5 (41): czasowniki + frazy z "play/ride" + sugestie + alfabet
--   Unit 6 (39): rutyna codzienna + dni tygodnia + godziny + miesiace
--   Unit 7 (39): zwierzeta dzikie + zwierzeta domowe + kupowanie biletu
--   Unit 8 (33): sporty + pogoda + zdrowy styl zycia
--
-- Zasady:
--   - Krotkie zdania, 5-12 slow EN, poziom A1 (klasa 4).
--   - Naturalnie uzywaja target slowa, gramatycznie poprawne PL+EN.
--   - Pelnie zdaniowe entries (typu "Miło cię poznać") -> echo,
--     EN tlumaczenie naturalne ("don't" -> "do not", "I'm" -> "I am").
--   - Apostrof w "o'clock", "What's", "I've" escapowany jako '' (PostgreSQL).
--
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.
-- Po uruchomieniu: 371 unikalnych zdan w word_sentences dla englishA1.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES

-- ═══════════════════════════════════════════════════════════
-- Unit 1 — Rodzina i znajomi (87)
-- ═══════════════════════════════════════════════════════════

-- 1.1 Family (17)
('englishA1', 'ciocia', 'Moja ciocia jest bardzo miła.', 'My aunt is very nice.'),
('englishA1', 'brat', 'Mój brat ma 10 lat.', 'My brother is 10 years old.'),
('englishA1', 'kuzyn / kuzynka', 'Mój kuzyn mieszka w Krakowie.', 'My cousin lives in Krakow.'),
('englishA1', 'tata', 'Mój tata pracuje w biurze.', 'My dad works in an office.'),
('englishA1', 'córka', 'Anna jest córką pani Kowalskiej.', 'Anna is Mrs Kowalska''s daughter.'),
('englishA1', 'ojciec', 'Mój ojciec jest lekarzem.', 'My father is a doctor.'),
('englishA1', 'dziadek', 'Mój dziadek lubi szachy.', 'My grandfather likes chess.'),
('englishA1', 'babcia', 'Moja babcia piecze ciasta.', 'My grandmother bakes cakes.'),
('englishA1', 'matka', 'Moja matka jest nauczycielką.', 'My mother is a teacher.'),
('englishA1', 'mama', 'Moja mama gotuje obiad.', 'My mum is cooking dinner.'),
('englishA1', 'rodzice', 'Moi rodzice pracują razem.', 'My parents work together.'),
('englishA1', 'siostra', 'Moja siostra ma 8 lat.', 'My sister is 8 years old.'),
('englishA1', 'syn', 'Tomek jest synem pana Nowaka.', 'Tomek is Mr Nowak''s son.'),
('englishA1', 'wujek', 'Mój wujek mieszka w Gdańsku.', 'My uncle lives in Gdansk.'),
('englishA1', 'wycieczka szkolna', 'Mamy wycieczkę szkolną w piątek.', 'We have a school trip on Friday.'),
('englishA1', 'Ona ma 70 lat', 'Ona ma 70 lat.', 'She is 70 years old.'),
('englishA1', 'smaczny', 'To ciasto jest smaczne.', 'This cake is yummy.'),

-- 1.2 Out of class (20)
('englishA1', 'Bądź ostrożny!', 'Bądź ostrożny!', 'Be careful!'),
('englishA1', 'Potrzymaj to, proszę', 'Potrzymaj to, proszę.', 'Hold this, please.'),
('englishA1', 'Zajmę się tym!', 'Zajmę się tym!', 'I have got it!'),
('englishA1', 'najlepszy przyjaciel / przyjaciółka', 'Anna jest moją najlepszą przyjaciółką.', 'Anna is my best friend.'),
('englishA1', 'urodziny', 'Moje urodziny są w maju.', 'My birthday is in May.'),
('englishA1', 'tort urodzinowy', 'Mam duży tort urodzinowy.', 'I have a big birthday cake.'),
('englishA1', 'ciasto', 'Mama piecze ciasto.', 'Mum is baking a cake.'),
('englishA1', 'kartka', 'Dostałam kartkę od babci.', 'I got a card from my grandmother.'),
('englishA1', 'klasa', 'Nasza klasa jest duża.', 'Our class is big.'),
('englishA1', 'kolega / koleżanka z klasy', 'Tom jest moim kolegą z klasy.', 'Tom is my classmate.'),
('englishA1', 'jeść', 'Lubię jeść owoce.', 'I like to eat fruit.'),
('englishA1', 'przyjaciel', 'On jest moim przyjacielem.', 'He is my friend.'),
('englishA1', 'z / od', 'Dostałem prezent od mamy.', 'I got a present from mum.'),
('englishA1', 'szczęśliwy', 'Jestem szczęśliwy dzisiaj.', 'I am happy today.'),
('englishA1', 'Wszystkiego najlepszego!', 'Wszystkiego najlepszego!', 'Happy birthday!'),
('englishA1', 'Zróbmy przerwę', 'Zróbmy przerwę.', 'Let us have a break.'),
('englishA1', 'uroczy (przyjemny)', 'Twój kotek jest uroczy.', 'Your kitten is lovely.'),
('englishA1', 'bałagan', 'W moim pokoju jest bałagan.', 'There is a mess in my room.'),
('englishA1', 'mój drogi / moja droga', 'Mój drogi, jestem zmęczona.', 'My darling, I am tired.'),
('englishA1', 'prezent', 'Dostałem prezent na urodziny.', 'I got a present for my birthday.'),

-- 1.3 Countries & nationalities (25)
('englishA1', 'amerykański', 'Lubię amerykańskie filmy.', 'I like American films.'),
('englishA1', 'brytyjski', 'Mam brytyjski paszport.', 'I have a British passport.'),
('englishA1', 'Chiny', 'Chiny to duży kraj.', 'China is a big country.'),
('englishA1', 'chiński', 'Uczę się chińskiego.', 'I am learning Chinese.'),
('englishA1', 'Francja', 'Paryż jest we Francji.', 'Paris is in France.'),
('englishA1', 'francuski', 'Mówię trochę po francusku.', 'I speak a little French.'),
('englishA1', 'włoski', 'Włoska pizza jest pyszna.', 'Italian pizza is delicious.'),
('englishA1', 'Włochy', 'Włochy to piękny kraj.', 'Italy is a beautiful country.'),
('englishA1', 'Polska', 'Mieszkam w Polsce.', 'I live in Poland.'),
('englishA1', 'polski', 'Uczę się polskiego.', 'I am learning Polish.'),
('englishA1', 'Hiszpania', 'Hiszpania jest ciepła latem.', 'Spain is warm in summer.'),
('englishA1', 'hiszpański', 'Lubię hiszpańską muzykę.', 'I like Spanish music.'),
('englishA1', 'Wielka Brytania', 'Londyn jest w Wielkiej Brytanii.', 'London is in the UK.'),
('englishA1', 'Stany Zjednoczone', 'Nowy Jork jest w Stanach Zjednoczonych.', 'New York is in the USA.'),
('englishA1', 'Na razie!', 'Na razie!', 'Bye now!'),
('englishA1', 'album rodzinny', 'Mam album rodzinny.', 'I have a family album.'),
('englishA1', 'Pomocy!', 'Pomocy!', 'Help!'),
('englishA1', 'głodny', 'Jestem głodny.', 'I am hungry.'),
('englishA1', 'na zdjęciu', 'Mama jest na zdjęciu.', 'Mum is in the photo.'),
('englishA1', 'imię', 'Moje imię to Anna.', 'My name is Anna.'),
('englishA1', 'Nie mam pojęcia', 'Nie mam pojęcia.', 'No idea.'),
('englishA1', 'przepraszam', 'Przepraszam, jestem spóźniony.', 'Sorry, I am late.'),
('englishA1', 'superbohater', 'Spider-Man jest moim ulubionym superbohaterem.', 'Spider-Man is my favourite superhero.'),
('englishA1', 'A co z tobą?', 'A co z tobą?', 'What about you?'),
('englishA1', 'Masz rację', 'Masz rację.', 'You are right.'),

-- 1.4 Introductions (12)
('englishA1', 'To mój kolega z klasy', 'To mój kolega z klasy.', 'He is my classmate.'),
('englishA1', 'To mój przyjaciel', 'To mój przyjaciel.', 'He is my friend.'),
('englishA1', 'Miło cię poznać', 'Miło cię poznać.', 'Nice to meet you.'),
('englishA1', 'Ciebie też miło poznać', 'Ciebie też miło poznać.', 'Nice to meet you too.'),
('englishA1', 'torba', 'Mam czarną torbę.', 'I have a black bag.'),
('englishA1', 'sławny', 'On jest sławnym aktorem.', 'He is a famous actor.'),
('englishA1', 'gwiazda filmowa', 'Ona jest gwiazdą filmową.', 'She is a film star.'),
('englishA1', 'dzieci', 'Dzieci bawią się w parku.', 'The kids are playing in the park.'),
('englishA1', 'Chodźmy', 'Chodźmy do parku.', 'Let us go to the park.'),
('englishA1', 'sąsiad', 'Mój sąsiad jest miły.', 'My neighbour is nice.'),
('englishA1', 'gwiazda pop', 'Ona jest gwiazdą pop.', 'She is a pop star.'),
('englishA1', 'sportowiec', 'Robert Lewandowski jest sportowcem.', 'Robert Lewandowski is a sports person.'),

-- 1.5 Places (10)
('englishA1', 'na przyjęciu', 'Jestem na przyjęciu urodzinowym.', 'I am at a party.'),
('englishA1', 'w domu', 'Mama jest w domu.', 'Mum is at home.'),
('englishA1', 'w szkole', 'Jestem w szkole o ósmej.', 'I am at school at eight.'),
('englishA1', 'w ogrodzie', 'Pies jest w ogrodzie.', 'The dog is in the garden.'),
('englishA1', 'w parku', 'Bawię się w parku.', 'I play in the park.'),
('englishA1', 'na wakacjach', 'Jesteśmy na wakacjach.', 'We are on holiday.'),
('englishA1', 'ulubiony', 'To mój ulubiony film.', 'This is my favourite film.'),
('englishA1', 'świetny', 'To świetny pomysł.', 'That is a great idea.'),
('englishA1', 'blisko', 'Mieszkam blisko szkoły.', 'I live near the school.'),
('englishA1', 'też', 'Lubię muzykę i tańczyć też.', 'I like music and dancing too.'),

-- 1.6 (3)
('englishA1', 'interesujący', 'Ta książka jest interesująca.', 'This book is interesting.'),
('englishA1', 'Międzynarodowy Dzień Przyjaźni', 'Dzisiaj jest Międzynarodowy Dzień Przyjaźni.', 'Today is International Friendship Day.'),
('englishA1', 'literować', 'Czy możesz przeliterować to słowo?', 'Can you spell this word?'),

-- ═══════════════════════════════════════════════════════════
-- Unit 2 — Ubrania i opisy (53)
-- ═══════════════════════════════════════════════════════════

-- 2.1 Clothes (17)
('englishA1', 'kozaki / buty', 'Moje kozaki są brązowe.', 'My boots are brown.'),
('englishA1', 'czapka', 'Noszę czerwoną czapkę.', 'I am wearing a red cap.'),
('englishA1', 'płaszcz / kurtka', 'Załóż płaszcz, jest zimno.', 'Put on your coat, it is cold.'),
('englishA1', 'sukienka', 'Moja sukienka jest niebieska.', 'My dress is blue.'),
('englishA1', 'bluza z kapturem', 'Lubię moją bluzę z kapturem.', 'I like my hoodie.'),
('englishA1', 'kurtka', 'Mam nową kurtkę.', 'I have a new jacket.'),
('englishA1', 'dżinsy', 'Noszę dżinsy do szkoły.', 'I wear jeans to school.'),
('englishA1', 'bluza / sweter', 'Mój sweter jest zielony.', 'My jumper is green.'),
('englishA1', 'koszula', 'Tata nosi białą koszulę.', 'Dad is wearing a white shirt.'),
('englishA1', 'buty', 'Moje buty są czarne.', 'My shoes are black.'),
('englishA1', 'spódnica', 'Anna ma czerwoną spódnicę.', 'Anna has a red skirt.'),
('englishA1', 'koszulka', 'Noszę żółtą koszulkę.', 'I am wearing a yellow T-shirt.'),
('englishA1', 'bluzka', 'Mam nową bluzkę.', 'I have a new top.'),
('englishA1', 'dres', 'Noszę dres na lekcji wf-u.', 'I wear a tracksuit at PE class.'),
('englishA1', 'trampki / buty sportowe', 'Mam nowe trampki.', 'I have new trainers.'),
('englishA1', 'spodnie', 'Te spodnie są za małe.', 'These trousers are too small.'),
('englishA1', 'w weekend', 'W weekend gram w piłkę.', 'I play football at the weekend.'),

-- 2.2 Adjectives (14)
('englishA1', 'duży', 'Mam duży pokój.', 'I have a big room.'),
('englishA1', 'nudny', 'Ten film jest nudny.', 'This film is boring.'),
('englishA1', 'fajny', 'Twoja czapka jest fajna.', 'Your cap is cool.'),
('englishA1', 'długi', 'Anna ma długie włosy.', 'Anna has long hair.'),
('englishA1', 'nowy', 'Mam nowy plecak.', 'I have a new backpack.'),
('englishA1', 'stary', 'Mój rower jest stary.', 'My bike is old.'),
('englishA1', 'krótki', 'Moja siostra ma krótkie włosy.', 'My sister has short hair.'),
('englishA1', 'mały', 'Mój brat jest mały.', 'My brother is small.'),
('englishA1', 'Poczekaj!', 'Poczekaj!', 'Hang on!'),
('englishA1', 'Proszę bardzo', 'Proszę bardzo.', 'Here you are.'),
('englishA1', 'Tam', 'Tam jest mój dom.', 'Over there is my house.'),
('englishA1', 'Co słychać?', 'Co słychać?', 'What is up?'),
('englishA1', 'odłożyć', 'Odłóż książki, proszę.', 'Put away your books, please.'),
('englishA1', 'za mały', 'Ten sweter jest za mały.', 'This jumper is too small.'),

-- 2.3 (9)
('englishA1', 'Jesteś pewien / pewna?', 'Jesteś pewien?', 'Are you sure?'),
('englishA1', 'pudełko', 'Mam pudełko z kredkami.', 'I have a box of crayons.'),
('englishA1', 'chłopiec', 'Ten chłopiec to mój brat.', 'This boy is my brother.'),
('englishA1', 'sprytny kot', 'Mam sprytnego kota.', 'I have a clever cat.'),
('englishA1', 'dziewczynka', 'Ta dziewczynka to moja siostra.', 'This girl is my sister.'),
('englishA1', 'rozmiar', 'Jaki rozmiar nosisz?', 'What size do you wear?'),
('englishA1', 'garnitur', 'Tata ma czarny garnitur.', 'Dad has a black suit.'),
('englishA1', 'rower górski', 'Mam czerwony rower górski.', 'I have a red mountain bike.'),
('englishA1', 'deskorolka', 'Lubię moją deskorolkę.', 'I like my skateboard.'),

-- 2.4 Personal information (9)
('englishA1', 'Ile masz lat?', 'Ile masz lat?', 'How old are you?'),
('englishA1', 'Jaki jest twój ulubiony film / muzyka / sport?', 'Jaki jest twój ulubiony film?', 'What is your favourite film?'),
('englishA1', 'Jak się nazywasz?', 'Jak się nazywasz?', 'What is your name?'),
('englishA1', 'Skąd jesteś?', 'Skąd jesteś?', 'Where are you from?'),
('englishA1', 'Kto jest twoim ulubionym aktorem / piosenkarzem / sportowcem?', 'Kto jest twoim ulubionym aktorem?', 'Who is your favourite actor?'),
('englishA1', 'Dobre pytanie', 'Dobre pytanie.', 'Good question.'),
('englishA1', 'Przybij piątkę', 'Przybij piątkę!', 'High five!'),
('englishA1', 'rock', 'Lubię muzykę rock.', 'I like rock music.'),
('englishA1', 'zespół szkolny', 'Gram w zespole szkolnym.', 'I play in the school band.'),

-- 2.5 My things (4)
('englishA1', 'plecak', 'Mój plecak jest ciężki.', 'My backpack is heavy.'),
('englishA1', 'konsola do gier', 'Mam nową konsolę do gier.', 'I have a new games console.'),
('englishA1', 'laptop', 'Robię lekcje na laptopie.', 'I do homework on my laptop.'),
('englishA1', 'telefon komórkowy', 'Mama ma nowy telefon komórkowy.', 'Mum has a new mobile phone.'),

-- ═══════════════════════════════════════════════════════════
-- Unit 3 — Dom i przedmioty (41)
-- ═══════════════════════════════════════════════════════════

-- 3.1 Parts of the house (10)
('englishA1', 'łazienka', 'Łazienka jest na górze.', 'The bathroom is upstairs.'),
('englishA1', 'sypialnia', 'Śpię w sypialni.', 'I sleep in the bedroom.'),
('englishA1', 'drzwi', 'Zamknij drzwi, proszę.', 'Close the door, please.'),
('englishA1', 'podłoga', 'Podłoga jest zimna.', 'The floor is cold.'),
('englishA1', 'garaż', 'Samochód jest w garażu.', 'The car is in the garage.'),
('englishA1', 'ogród', 'Pies jest w ogrodzie.', 'The dog is in the garden.'),
('englishA1', 'kuchnia', 'Mama jest w kuchni.', 'Mum is in the kitchen.'),
('englishA1', 'salon', 'Telewizor jest w salonie.', 'The TV is in the living room.'),
('englishA1', 'ściana', 'Plakat jest na ścianie.', 'The poster is on the wall.'),
('englishA1', 'okno', 'Otwórz okno, proszę.', 'Open the window, please.'),

-- 3.2 Prepositions (6)
('englishA1', 'za', 'Kot jest za sofą.', 'The cat is behind the sofa.'),
('englishA1', 'w', 'Książka jest w plecaku.', 'The book is in the backpack.'),
('englishA1', 'przed', 'Auto jest przed domem.', 'The car is in front of the house.'),
('englishA1', 'obok', 'Lampa jest obok łóżka.', 'The lamp is next to the bed.'),
('englishA1', 'na', 'Kot jest na krześle.', 'The cat is on the chair.'),
('englishA1', 'pod', 'Pies jest pod stołem.', 'The dog is under the table.'),

-- 3.3 (9)
('englishA1', 'zły', 'Pies jest zły.', 'The dog is bad.'),
('englishA1', 'być mi przykro', 'Jest mi przykro.', 'I am sorry.'),
('englishA1', 'babeczka', 'Lubię babeczki czekoladowe.', 'I like chocolate cupcakes.'),
('englishA1', 'niegrzeczny', 'Mój brat jest niegrzeczny.', 'My brother is naughty.'),
('englishA1', 'tylko', 'Mam tylko jednego brata.', 'I only have one brother.'),
('englishA1', 'papuga', 'Moja papuga mówi.', 'My parrot talks.'),
('englishA1', 'głupi', 'To głupi pomysł.', 'That is a silly idea.'),
('englishA1', 'ulica', 'Moja ulica jest długa.', 'My street is long.'),
('englishA1', 'drzewo', 'W ogrodzie jest drzewo.', 'There is a tree in the garden.'),

-- 3.4 Having a guest (10)
('englishA1', 'Witaj. Proszę, wejdź.', 'Witaj. Proszę, wejdź.', 'Hello. Please, come in.'),
('englishA1', 'Dziękuję', 'Dziękuję.', 'Thank you.'),
('englishA1', 'Czy chciałbyś...?', 'Czy chciałbyś herbaty?', 'Would you like some tea?'),
('englishA1', 'Tak, poproszę / Nie, dziękuję', 'Tak, poproszę. Nie, dziękuję.', 'Yes, please. No, thank you.'),
('englishA1', 'Gdzie jest...?', 'Gdzie jest łazienka?', 'Where is the bathroom?'),
('englishA1', 'Jest na górze / na dole', 'Jest na górze. Jest na dole.', 'It is upstairs. It is downstairs.'),
('englishA1', 'Pozwól, że ci pokażę', 'Pozwól, że ci pokażę.', 'Let me show you.'),
('englishA1', 'jabłko', 'Jem czerwone jabłko.', 'I eat a red apple.'),
('englishA1', 'lody', 'Lubię lody waniliowe.', 'I like vanilla ice cream.'),
('englishA1', 'ketchup', 'Lubię frytki z ketchupem.', 'I like chips with ketchup.'),

-- 3.5 Objects (6)
('englishA1', 'dywan', 'W salonie jest dywan.', 'There is a carpet in the living room.'),
('englishA1', 'poduszka', 'Lubię miękką poduszkę.', 'I like a soft cushion.'),
('englishA1', 'lampa', 'Lampa jest na biurku.', 'The lamp is on the desk.'),
('englishA1', 'roślina', 'Mam zieloną roślinę w pokoju.', 'I have a green plant in my room.'),
('englishA1', 'plakat', 'Plakat jest na ścianie.', 'The poster is on the wall.'),
('englishA1', 'telewizor', 'Telewizor jest w salonie.', 'The TV is in the living room.'),

-- ═══════════════════════════════════════════════════════════
-- Unit 4 — Wyglad i osobowosc (39)
-- ═══════════════════════════════════════════════════════════

-- 4.1 Face & Hair (12)
('englishA1', 'uszy', 'Mam małe uszy.', 'I have small ears.'),
('englishA1', 'oczy', 'Mam zielone oczy.', 'I have green eyes.'),
('englishA1', 'usta', 'Otwórz usta.', 'Open your mouth.'),
('englishA1', 'nos', 'Mam mały nos.', 'I have a small nose.'),
('englishA1', 'zęby', 'Myję zęby dwa razy dziennie.', 'I brush my teeth twice a day.'),
('englishA1', 'blond', 'Anna ma blond włosy.', 'Anna has blond hair.'),
('englishA1', 'kędzierzawy', 'Mam kędzierzawe włosy.', 'I have curly hair.'),
('englishA1', 'ciemny', 'Tata ma ciemne włosy.', 'Dad has dark hair.'),
('englishA1', 'rudy', 'Moja siostra ma rude włosy.', 'My sister has red hair.'),
('englishA1', 'nastroszone', 'On ma nastroszone włosy.', 'He has spiky hair.'),
('englishA1', 'proste', 'Mam proste włosy.', 'I have straight hair.'),
('englishA1', 'falowane', 'Mama ma falowane włosy.', 'Mum has wavy hair.'),

-- 4.2 Body (9)
('englishA1', 'ramię', 'Boli mnie ramię.', 'My arm hurts.'),
('englishA1', 'ciało', 'Moje ciało jest silne.', 'My body is strong.'),
('englishA1', 'palce', 'Mam dziesięć palców.', 'I have ten fingers.'),
('englishA1', 'stopa', 'Boli mnie stopa.', 'My foot hurts.'),
('englishA1', 'dłoń', 'Myję dłonie.', 'I wash my hands.'),
('englishA1', 'głowa', 'Boli mnie głowa.', 'My head hurts.'),
('englishA1', 'noga', 'Skaleczyłem nogę.', 'I cut my leg.'),
('englishA1', 'szyja', 'Żyrafa ma długą szyję.', 'A giraffe has a long neck.'),
('englishA1', 'palce u nóg', 'Mam dziesięć palców u nóg.', 'I have ten toes.'),

-- 4.3 (4)
('englishA1', 'zasilanie', 'Bohater ma zasilanie z baterii.', 'The hero has battery power.'),
('englishA1', 'bohater', 'Spider-Man jest moim bohaterem.', 'Spider-Man is my hero.'),
('englishA1', 'lubić', 'Lubię szkołę.', 'I like school.'),
('englishA1', 'supermoc', 'Bohater ma supermoc.', 'The hero has a super power.'),

-- 4.4 Apologising (8)
('englishA1', 'Czy jesteś ok?', 'Czy jesteś ok?', 'Are you OK?'),
('englishA1', 'Dobrze mi', 'Dobrze mi.', 'I am fine.'),
('englishA1', 'Bardzo mi przykro', 'Bardzo mi przykro.', 'I am so sorry.'),
('englishA1', 'W porządku', 'W porządku.', 'It is OK.'),
('englishA1', 'Żaden problem', 'Żaden problem.', 'No problem.'),
('englishA1', 'Przepraszam za to', 'Przepraszam za to.', 'Sorry about that.'),
('englishA1', 'Przepraszam, mój błąd', 'Przepraszam, mój błąd.', 'Sorry, my mistake.'),
('englishA1', 'Wszystko dobrze', 'Wszystko dobrze.', 'That is all right.'),

-- 4.5 Personality (6)
('englishA1', 'inteligentny', 'Mój brat jest inteligentny.', 'My brother is clever.'),
('englishA1', 'przyjazny', 'Mój pies jest przyjazny.', 'My dog is friendly.'),
('englishA1', 'zabawny', 'Mój kuzyn jest zabawny.', 'My cousin is funny.'),
('englishA1', 'pomocny', 'Moja siostra jest pomocna.', 'My sister is helpful.'),
('englishA1', 'miły', 'Mój nauczyciel jest miły.', 'My teacher is nice.'),
('englishA1', 'sportowy', 'Tata jest sportowy.', 'Dad is sporty.'),

-- ═══════════════════════════════════════════════════════════
-- Unit 5 — Czynnosci i umiejetnosci (41)
-- ═══════════════════════════════════════════════════════════

-- 5.1 Action verbs (14)
('englishA1', 'grać (aktorstwo)', 'Lubię grać w teatrze.', 'I like to act in the theatre.'),
('englishA1', 'wspinać się', 'Małpy potrafią się wspinać.', 'Monkeys can climb.'),
('englishA1', 'gotować', 'Mama lubi gotować.', 'Mum likes to cook.'),
('englishA1', 'nurkować', 'Lubię nurkować w morzu.', 'I like to dive in the sea.'),
('englishA1', 'rysować', 'Lubię rysować zwierzęta.', 'I like to draw animals.'),
('englishA1', 'naprawiać', 'Tata naprawia mój rower.', 'Dad is fixing my bike.'),
('englishA1', 'latać', 'Ptaki potrafią latać.', 'Birds can fly.'),
('englishA1', 'skakać', 'Potrafię skakać wysoko.', 'I can jump high.'),
('englishA1', 'czytać', 'Lubię czytać książki.', 'I like to read books.'),
('englishA1', 'jeździć', 'Lubię jeździć rowerem.', 'I like to ride a bike.'),
('englishA1', 'biegać', 'Lubię biegać w parku.', 'I like to run in the park.'),
('englishA1', 'śpiewać', 'Lubię śpiewać.', 'I like to sing.'),
('englishA1', 'pływać', 'Pływam w basenie.', 'I swim in the pool.'),
('englishA1', 'pisać', 'Piszę list do babci.', 'I am writing a letter to grandma.'),

-- 5.2 Phrases (7)
('englishA1', 'robić plakat', 'Robimy plakat na lekcji.', 'We are making a poster in class.'),
('englishA1', 'robić babeczki', 'Robimy babeczki z mamą.', 'We make cupcakes with mum.'),
('englishA1', 'grać w gry komputerowe', 'Lubię grać w gry komputerowe.', 'I like to play computer games.'),
('englishA1', 'grać w piłkę nożną', 'Lubię grać w piłkę nożną.', 'I like to play football.'),
('englishA1', 'grać na pianinie', 'Anna potrafi grać na pianinie.', 'Anna can play the piano.'),
('englishA1', 'jeździć na rowerze', 'Lubię jeździć na rowerze.', 'I like to ride a bike.'),
('englishA1', 'jeździć na koniu', 'Mama potrafi jeździć na koniu.', 'Mum can ride a horse.'),

-- 5.3 (3)
('englishA1', 'łódź', 'Mamy małą łódź.', 'We have a small boat.'),
('englishA1', 'szybki', 'Mój rower jest szybki.', 'My bike is fast.'),
('englishA1', 'uroczy dzień', 'To uroczy dzień.', 'It is a lovely day.'),

-- 5.4 Suggestions (4)
('englishA1', 'Świetny pomysł!', 'Świetny pomysł!', 'Great idea!'),
('englishA1', 'Zgadzam się', 'Zgadzam się.', 'I agree.'),
('englishA1', 'Nie jestem pewien / pewna', 'Nie jestem pewien.', 'I am not sure.'),
('englishA1', 'To nie jest dobry pomysł', 'To nie jest dobry pomysł.', 'It is not a good idea.'),

-- 5.5 (8)
('englishA1', 'alfabet', 'Uczę się alfabetu.', 'I am learning the alphabet.'),
('englishA1', 'kurs', 'Mam kurs angielskiego.', 'I have an English course.'),
('englishA1', 'słyszeć', 'Słyszę ptaki w parku.', 'I can hear the birds in the park.'),
('englishA1', 'ważny', 'To jest ważny dzień.', 'This is an important day.'),
('englishA1', 'język', 'Polski to mój język.', 'Polish is my language.'),
('englishA1', 'uczyć się', 'Uczę się angielskiego.', 'I am learning English.'),
('englishA1', 'litera', 'Litera A jest pierwsza.', 'The letter A is first.'),
('englishA1', 'nauczyciel', 'Mój nauczyciel jest miły.', 'My teacher is nice.'),

-- 5.6 (5)
('englishA1', 'po szkole', 'Gram w piłkę po szkole.', 'I play football after school.'),
('englishA1', 'piłka', 'Mam czerwoną piłkę.', 'I have a red ball.'),
('englishA1', 'klub', 'Należę do klubu szachowego.', 'I am in the chess club.'),
('englishA1', 'gra', 'To moja ulubiona gra.', 'This is my favourite game.'),
('englishA1', 'dzisiaj', 'Dzisiaj jest piątek.', 'Today is Friday.'),

-- ═══════════════════════════════════════════════════════════
-- Unit 6 — Dzien i czas (39)
-- ═══════════════════════════════════════════════════════════

-- 6.1 Daily activities (13)
('englishA1', 'odrabiać lekcje', 'Odrabiam lekcje wieczorem.', 'I do homework in the evening.'),
('englishA1', 'wstawać', 'Wstaję o siódmej.', 'I get up at seven.'),
('englishA1', 'iść spać', 'Idę spać o dziewiątej.', 'I go to bed at nine.'),
('englishA1', 'iść do szkoły', 'Idę do szkoły o ósmej.', 'I go to school at eight.'),
('englishA1', 'spędzać czas z przyjaciółmi', 'Lubię spędzać czas z przyjaciółmi.', 'I like to hang out with friends.'),
('englishA1', 'brać prysznic', 'Biorę prysznic wieczorem.', 'I have a shower in the evening.'),
('englishA1', 'jeść śniadanie', 'Jem śniadanie z mamą.', 'I have breakfast with mum.'),
('englishA1', 'jeść kolację', 'Jemy kolację o siódmej.', 'We have dinner at seven.'),
('englishA1', 'mieć lekcje', 'Mam lekcje od ósmej.', 'I have lessons from eight.'),
('englishA1', 'jeść obiad', 'Jemy obiad w szkole.', 'We have lunch at school.'),
('englishA1', 'słuchać muzyki', 'Lubię słuchać muzyki.', 'I like to listen to music.'),
('englishA1', 'sprzątać pokój', 'Sprzątam pokój w sobotę.', 'I tidy my room on Saturday.'),
('englishA1', 'oglądać telewizję', 'Wieczorem oglądam telewizję.', 'I watch TV in the evening.'),

-- 6.3 Days (7)
('englishA1', 'poniedziałek', 'W poniedziałek mam matematykę.', 'I have maths on Monday.'),
('englishA1', 'wtorek', 'We wtorek gram w piłkę.', 'I play football on Tuesday.'),
('englishA1', 'środa', 'W środę mam plastykę.', 'I have art on Wednesday.'),
('englishA1', 'czwartek', 'W czwartek mam wf.', 'I have PE on Thursday.'),
('englishA1', 'piątek', 'W piątek idę do kina.', 'I go to the cinema on Friday.'),
('englishA1', 'sobota', 'W sobotę odwiedzam babcię.', 'I visit grandma on Saturday.'),
('englishA1', 'niedziela', 'W niedzielę odpoczywam.', 'I rest on Sunday.'),

-- 6.4 Time (4)
('englishA1', 'Która jest godzina?', 'Która jest godzina?', 'What time is it?'),
('englishA1', 'Jest czwarta', 'Jest czwarta.', 'It is four o''clock.'),
('englishA1', 'Jest wpół do...', 'Jest wpół do piątej.', 'It is half past four.'),
('englishA1', 'Jest kwadrans do...', 'Jest kwadrans do siódmej.', 'It is quarter to seven.'),

-- 6.5 Months (12)
('englishA1', 'styczeń', 'W styczniu jest zimno.', 'It is cold in January.'),
('englishA1', 'luty', 'W lutym pada śnieg.', 'It snows in February.'),
('englishA1', 'marzec', 'W marcu zaczyna się wiosna.', 'Spring starts in March.'),
('englishA1', 'kwiecień', 'W kwietniu często pada deszcz.', 'It often rains in April.'),
('englishA1', 'maj', 'Moje urodziny są w maju.', 'My birthday is in May.'),
('englishA1', 'czerwiec', 'W czerwcu kończy się szkoła.', 'School ends in June.'),
('englishA1', 'lipiec', 'W lipcu jadę nad morze.', 'I go to the sea in July.'),
('englishA1', 'sierpień', 'W sierpniu jest gorąco.', 'It is hot in August.'),
('englishA1', 'wrzesień', 'We wrześniu zaczyna się szkoła.', 'School starts in September.'),
('englishA1', 'październik', 'W październiku liście spadają.', 'Leaves fall in October.'),
('englishA1', 'listopad', 'W listopadzie jest chłodno.', 'It is cool in November.'),
('englishA1', 'grudzień', 'W grudniu są święta.', 'Christmas is in December.'),

-- 6.6 (3)
('englishA1', 'dziadkowie', 'Moi dziadkowie mieszkają w Krakowie.', 'My grandparents live in Krakow.'),
('englishA1', 'spotkać przyjaciela', 'Lubię spotkać przyjaciela w parku.', 'I like to meet a friend in the park.'),
('englishA1', 'jechać autobusem', 'Jadę autobusem do szkoły.', 'I take the bus to school.'),

-- ═══════════════════════════════════════════════════════════
-- Unit 7 — Zwierzeta (39)
-- ═══════════════════════════════════════════════════════════

-- 7.1 Wild animals (15)
('englishA1', 'ptak', 'Ptak siedzi na drzewie.', 'A bird is sitting on the tree.'),
('englishA1', 'motyl', 'Motyl jest piękny.', 'The butterfly is beautiful.'),
('englishA1', 'krokodyl', 'Krokodyl ma ostre zęby.', 'A crocodile has sharp teeth.'),
('englishA1', 'słoń', 'Słoń jest bardzo duży.', 'An elephant is very big.'),
('englishA1', 'ryba', 'Ryba żyje w wodzie.', 'A fish lives in the water.'),
('englishA1', 'mucha', 'Mucha lata po kuchni.', 'A fly is flying in the kitchen.'),
('englishA1', 'żaba', 'Żaba potrafi skakać.', 'A frog can jump.'),
('englishA1', 'żyrafa', 'Żyrafa ma długą szyję.', 'A giraffe has a long neck.'),
('englishA1', 'kangur', 'Kangur skacze wysoko.', 'A kangaroo jumps high.'),
('englishA1', 'lew', 'Lew jest królem dżungli.', 'A lion is the king of the jungle.'),
('englishA1', 'małpa', 'Małpa lubi banany.', 'A monkey likes bananas.'),
('englishA1', 'wąż', 'Wąż jest długi i cienki.', 'A snake is long and thin.'),
('englishA1', 'pająk', 'Pająk ma osiem nóg.', 'A spider has eight legs.'),
('englishA1', 'tygrys', 'Tygrys jest pomarańczowy.', 'A tiger is orange.'),
('englishA1', 'wieloryb', 'Wieloryb żyje w morzu.', 'A whale lives in the sea.'),

-- 7.2 Pets (8)
('englishA1', 'kot', 'Mój kot jest czarny.', 'My cat is black.'),
('englishA1', 'pies', 'Mój pies jest miły.', 'My dog is nice.'),
('englishA1', 'złota rybka', 'Mam złotą rybkę.', 'I have a goldfish.'),
('englishA1', 'chomik', 'Mój chomik jest mały.', 'My hamster is small.'),
('englishA1', 'iguana', 'Iguana to duża jaszczurka.', 'An iguana is a big lizard.'),
-- 'papuga' pominiete tutaj — duplikat klucza word_pl z Unit 3.3.
-- PostgreSQL nie pozwala na duplikat klucza w jednym INSERT z ON CONFLICT.
('englishA1', 'królik', 'Mój królik je marchewki.', 'My rabbit eats carrots.'),
('englishA1', 'żółw', 'Mój żółw jest powolny.', 'My tortoise is slow.'),

-- 7.3 (6)
('englishA1', 'język obcy', 'Angielski to mój język obcy.', 'English is my foreign language.'),
('englishA1', 'wywiad', 'Reporter robi wywiad.', 'The reporter is doing an interview.'),
('englishA1', 'magazyn / czasopismo', 'Czytam magazyn dla dzieci.', 'I read a magazine for kids.'),
('englishA1', 'zawodnik', 'On jest zawodnikiem piłki nożnej.', 'He is a football player.'),
('englishA1', 'reporter', 'Reporter pisze artykuły.', 'A reporter writes articles.'),
('englishA1', 'pracować', 'Tata pracuje w biurze.', 'Dad works in an office.'),

-- 7.4 Buying a ticket (3)
('englishA1', 'Czy mogę prosić jeden bilet?', 'Czy mogę prosić jeden bilet?', 'Can I have one ticket, please?'),
('englishA1', 'Czy mogę pomóc?', 'Czy mogę pomóc?', 'Can I help you?'),
('englishA1', 'Proszę, oto bilety', 'Proszę, oto bilety.', 'Here are your tickets.'),

-- 7.5 Adjectives (3)
('englishA1', 'uroczy (słodki)', 'Twój kotek jest uroczy.', 'Your kitten is cute.'),
('englishA1', 'niebezpieczny', 'Krokodyl jest niebezpieczny.', 'A crocodile is dangerous.'),
('englishA1', 'wolny', 'Żółw jest wolny.', 'A tortoise is slow.'),

-- 7.6 (4)
('englishA1', 'karma dla psa', 'Kupuję karmę dla psa.', 'I buy dog food.'),
('englishA1', 'łatwy', 'Test jest łatwy.', 'The test is easy.'),
('englishA1', 'opiekować się zwierzęciem', 'Lubię opiekować się zwierzęciem.', 'I like to look after a pet.'),
('englishA1', 'sklep zoologiczny', 'Idę do sklepu zoologicznego.', 'I am going to the pet shop.'),

-- ═══════════════════════════════════════════════════════════
-- Unit 8 — Sport i zdrowie (33)
-- ═══════════════════════════════════════════════════════════

-- 8.1 Sports (16)
('englishA1', 'badminton', 'Lubię grać w badmintona.', 'I like to play badminton.'),
('englishA1', 'koszykówka', 'Koszykówka to mój ulubiony sport.', 'Basketball is my favourite sport.'),
('englishA1', 'kolarstwo', 'Kolarstwo to dobry sport.', 'Cycling is a good sport.'),
('englishA1', 'piłka nożna', 'Piłka nożna jest popularna.', 'Football is popular.'),
('englishA1', 'hokej', 'Lubię oglądać hokej.', 'I like to watch hockey.'),
('englishA1', 'łyżwiarstwo', 'Łyżwiarstwo jest trudne.', 'Ice-skating is difficult.'),
('englishA1', 'jazda na rolkach', 'Lubię jazdę na rolkach.', 'I like roller skating.'),
('englishA1', 'żeglarstwo', 'Żeglarstwo to mój hobby.', 'Sailing is my hobby.'),
('englishA1', 'jazda na deskorolce', 'Jazda na deskorolce jest fajna.', 'Skateboarding is cool.'),
('englishA1', 'narciarstwo', 'Zimą lubię narciarstwo.', 'I like skiing in winter.'),
('englishA1', 'pływanie', 'Pływanie to dobry sport.', 'Swimming is a good sport.'),
('englishA1', 'tenis stołowy', 'Gram w tenisa stołowego w szkole.', 'I play table tennis at school.'),
('englishA1', 'taekwondo', 'Trenuję taekwondo.', 'I train taekwondo.'),
('englishA1', 'tenis', 'Lubię grać w tenisa.', 'I like to play tennis.'),
('englishA1', 'siatkówka', 'Siatkówka jest popularna w Polsce.', 'Volleyball is popular in Poland.'),
('englishA1', 'windsurfing', 'Latem uprawiam windsurfing.', 'I do windsurfing in summer.'),

-- 8.4 Weather (8)
('englishA1', 'pochmurny', 'Dzień jest pochmurny.', 'It is a cloudy day.'),
('englishA1', 'zimny', 'Zimą jest zimno.', 'It is cold in winter.'),
('englishA1', 'gorący', 'Latem jest gorąco.', 'It is hot in summer.'),
('englishA1', 'deszczowy', 'Dzisiaj jest deszczowo.', 'It is rainy today.'),
('englishA1', 'śnieżny', 'Zimą jest śnieżnie.', 'It is snowy in winter.'),
('englishA1', 'słoneczny', 'Dzisiaj jest słoneczny dzień.', 'It is a sunny day today.'),
('englishA1', 'ciepły', 'Wiosną jest ciepło.', 'It is warm in spring.'),
('englishA1', 'wietrzny', 'Jest wietrzno, weź czapkę.', 'It is windy, take a cap.'),

-- 8.5 Healthy lifestyle (6)
('englishA1', 'myć zęby', 'Myję zęby dwa razy dziennie.', 'I brush my teeth twice a day.'),
('englishA1', 'ćwiczyć', 'Codziennie ćwiczę.', 'I do exercise every day.'),
('englishA1', 'pić dużo wody', 'Powinieneś pić dużo wody.', 'You should drink a lot of water.'),
('englishA1', 'jeść owoce i warzywa', 'Jem owoce i warzywa codziennie.', 'I eat fruit and vegetables every day.'),
('englishA1', 'wcześnie chodzić spać', 'Powinieneś wcześnie chodzić spać.', 'You should go to bed early.'),
('englishA1', 'mieć przyjaciół', 'Ważne jest mieć przyjaciół.', 'It is important to have friends.'),

-- 8.6 (3)
('englishA1', 'mistrz', 'On jest mistrzem szachów.', 'He is a chess champion.'),
('englishA1', 'zawody', 'Mam zawody w sobotę.', 'I have a competition on Saturday.'),
('englishA1', 'rano', 'Wstaję wcześnie rano.', 'I get up early in the morning.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — English Class A1: 371 unikalnych zdan zaktualizowanych/dodanych w word_sentences (372 wpisow w data.js, 1 duplikat synonimu papuga zdedupedowany przez UPSERT, uroczy rozdzielony disambiguacja nawiasem).';
END $$;
