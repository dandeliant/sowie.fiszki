-- ═══════════════════════════════════════════════════════════
-- Fix sentences: LINK 8 (klasa 8, szkola podstawowa, Oxford)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne, starannie napisane przyklady zdan dla wszystkich
-- 126 unikalnych slowek z Link 8 (Oxford).
--
-- Statystyki:
--   - 127 wpisow w data.js (tylko Unit 7)
--   - 1 duplikat synonimu word_pl ('badania' — Unit 7 'investigation' +
--     Unit 7 'research') — pominiete w SQL, UPSERT trzyma jedna wartosc
--     (synonim, brak straty informacji).
--   - 126 unikalnych zdan w word_sentences
--
-- Tematy unitu:
--   Unit 7 (126): nauka + kryminalistyka + opinie + ewolucja + genetyka
--
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES

-- ═══════════════════════════════════════════════════════════
-- Unit 7 — Science, forensics, opinions, evolution (126)
-- ═══════════════════════════════════════════════════════════
('link8', 'alkohol', 'Alkohol jest niezdrowy.', 'Alcohol is unhealthy.'),
('link8', 'przeprowadzać', 'Naukowcy przeprowadzają eksperymenty.', 'Scientists carry out experiments.'),
('link8', 'komórka', 'Komórka jest podstawową jednostką życia.', 'A cell is the basic unit of life.'),
('link8', 'DNA', 'DNA zawiera informacje genetyczne.', 'DNA contains genetic information.'),
('link8', 'efekt, rezultat', 'Efekt eksperymentu był zaskakujący.', 'The effect of the experiment was surprising.'),
('link8', 'sprzęt', 'Naukowcy używają specjalnego sprzętu.', 'Scientists use special equipment.'),
('link8', 'eksperyment', 'Robimy eksperyment chemiczny.', 'We are doing a chemistry experiment.'),
('link8', 'badania', 'Naukowcy prowadzą badania.', 'Scientists are doing an investigation.'),
('link8', 'laboratorium', 'Pracujemy w laboratorium.', 'We are working in the laboratory.'),
('link8', 'mikroskop', 'Oglądam komórki przez mikroskop.', 'I am looking at cells through the microscope.'),
('link8', 'obserwacja', 'Moja obserwacja była dokładna.', 'My observation was accurate.'),
('link8', 'pipeta', 'Używam pipety do mierzenia.', 'I am using a pipette for measuring.'),
('link8', 'rezultat, wynik', 'Wynik eksperymentu jest pozytywny.', 'The result of the experiment is positive.'),
('link8', 'okulary ochronne', 'Załóż okulary ochronne.', 'Put on safety goggles.'),
('link8', 'okaz', 'Zebraliśmy okaz rośliny.', 'We collected a plant specimen.'),
('link8', 'probówka', 'Płyn jest w probówce.', 'The liquid is in the test tube.'),
('link8', 'teoria', 'Mam teorię na ten temat.', 'I have a theory about this topic.'),
('link8', 'analityk', 'Analityk bada dane.', 'The analyst is studying the data.'),
('link8', 'balistyka', 'Eksperci od balistyki badają pociski.', 'Ballistics experts study bullets.'),
('link8', 'pocisk', 'Policja znalazła pocisk.', 'The police found a bullet.'),
('link8', 'trop', 'Detektyw szuka tropu.', 'The detective is looking for a clue.'),
('link8', 'przyznawać się', 'Złodziej przyznał się do winy.', 'The thief confessed to the crime.'),
('link8', 'kryminalistyka', 'Studiuję kryminalistykę.', 'I study criminalistics.'),
('link8', 'analiza DNA', 'Naukowiec robi analizę DNA.', 'The scientist is doing a DNA analysis.'),
('link8', 'dron', 'Dron lata nad miastem.', 'The drone is flying over the city.'),
('link8', 'dowód', 'Policja ma dowód.', 'The police have evidence.'),
('link8', 'ekspert', 'On jest ekspertem od techniki.', 'He is a technology expert.'),
('link8', 'zafascynowany', 'Jestem zafascynowany kosmosem.', 'I am fascinated by space.'),
('link8', 'odcisk palca', 'Policja znalazła odcisk palca.', 'The police found a fingerprint.'),
('link8', 'ślad, odcisk', 'Detektyw znalazł ślad.', 'The detective found a footprint.'),
('link8', 'profilowanie kryminalne', 'Profilowanie kryminalne pomaga w sprawach.', 'Forensic profiling helps with cases.'),
('link8', 'kryminalistyka (jako nauka)', 'Kryminalistyka to ważna nauka.', 'Forensic science is an important science.'),
('link8', 'charakter pisma', 'Ekspert bada charakter pisma.', 'The expert studies the handwriting.'),
('link8', 'trucizna', 'Niektóre rośliny zawierają truciznę.', 'Some plants contain poison.'),
('link8', 'psycholog', 'Mama jest psychologiem.', 'Mum is a psychologist.'),
('link8', 'rewolwer', 'Policjant ma rewolwer.', 'The police officer has a revolver.'),
('link8', 'skaner', 'Skaner czyta dokumenty.', 'The scanner reads documents.'),
('link8', 'miejsce', 'Policja przybyła na miejsce.', 'The police arrived at the scene.'),
('link8', 'rozwiązywać', 'Detektyw rozwiązuje sprawę.', 'The detective is solving the case.'),
('link8', 'podejrzany', 'Policja przesłuchuje podejrzanego.', 'The police are questioning the suspect.'),
('link8', 'technik', 'Technik naprawia komputer.', 'The technician is fixing the computer.'),
('link8', 'toksykologia', 'Toksykologia bada trucizny.', 'Toxicology studies poisons.'),
('link8', 'świadek', 'Świadek widział wypadek.', 'The witness saw the accident.'),
('link8', 'duży przemysł', 'To jest duży przemysł.', 'This is a big business.'),
('link8', 'fartuch', 'Naukowiec nosi biały fartuch.', 'The scientist wears a white coat.'),
('link8', 'program komputerowy', 'Mam nowy program komputerowy.', 'I have a new computer program.'),
('link8', 'niebezpieczny', 'Krokodyl jest niebezpieczny.', 'A crocodile is dangerous.'),
('link8', 'sprzęt (wyposażenie)', 'Mamy nowoczesny sprzęt.', 'We have modern facilities.'),
('link8', 'dzięki (komuś / czemuś)', 'Dzięki tobie wygraliśmy.', 'Thanks to you, we won.'),
('link8', 'analiza', 'Robimy analizę chemiczną.', 'We are doing a chemical analysis.'),
('link8', 'analizy', 'Wyniki analiz są pozytywne.', 'The results of the analyses are positive.'),
('link8', 'komentarz', 'Napisz komentarz pod postem.', 'Write a comment under the post.'),
('link8', 'wniosek, konkluzja', 'Mój wniosek jest następujący.', 'My conclusion is as follows.'),
('link8', 'dane', 'Komputer analizuje dane.', 'The computer is analysing the data.'),
('link8', 'wyniki badań', 'Wyniki badań są zaskakujące.', 'The findings are surprising.'),
('link8', 'hipoteza', 'Mam hipotezę naukową.', 'I have a scientific hypothesis.'),
('link8', 'hipotezy', 'Naukowiec testuje hipotezy.', 'The scientist tests hypotheses.'),
('link8', 'zauważać', 'Zauważyłem, że jest zimno.', 'I noticed that it is cold.'),
('link8', 'przewidywanie', 'Moje przewidywanie się sprawdziło.', 'My prediction came true.'),
('link8', 'zabieg, procedura badania', 'Procedura badania jest długa.', 'The procedure is long.'),
-- 'badania' (research) pominiete — duplikat klucza z 'badania' (investigation) wczesniej w tym unicie
('link8', 'źródło', 'Sprawdź źródło informacji.', 'Check the source of the information.'),
('link8', 'krok', 'Pierwszy krok jest najtrudniejszy.', 'The first step is the hardest.'),
('link8', 'być ostrożnym', 'Bądź ostrożny w laboratorium.', 'Be careful in the lab.'),
('link8', 'brać udział w burzy mózgów', 'Bierzemy udział w burzy mózgów.', 'We are brainstorming.'),
('link8', 'odkrycie', 'To wielkie odkrycie naukowe.', 'It is a great scientific discovery.'),
('link8', 'próba', 'Mamy próbę zespołu jutro.', 'We have a band rehearsal tomorrow.'),
('link8', 'przesyłać plik', 'Przesyłam plik na chmurę.', 'I am uploading the file to the cloud.'),
('link8', 'Łatwizna!', 'Łatwizna! Zrobię to szybko.', 'A piece of cake! I will do it quickly.'),
('link8', 'Jeśli o mnie chodzi...', 'Jeśli o mnie chodzi, zgadzam się.', 'As far as I am concerned, I agree.'),
('link8', 'Popatrz na ...', 'Popatrz na ten obraz.', 'Check this picture out.'),
('link8', 'Czy myślisz, że to / one ...?', 'Czy myślisz, że to dobry pomysł?', 'Do you think it is a good idea?'),
('link8', 'wejść do internetu', 'Wchodzę do internetu codziennie.', 'I go online every day.'),
('link8', 'Co sądzisz o ...?', 'Co sądzisz o tym filmie?', 'How do you feel about this film?'),
('link8', 'Myślę, że powinniśmy ...', 'Myślę, że powinniśmy iść do parku.', 'I feel we should go to the park.'),
('link8', 'Wiem, o co ci chodzi, ale ...', 'Wiem, o co ci chodzi, ale nie zgadzam się.', 'I see what you mean, but I do not agree.'),
('link8', 'Nie jestem pewny / pewna.', 'Nie jestem pewny.', 'I am not sure.'),
('link8', 'Wydaje mi się, że ...', 'Wydaje mi się, że masz rację.', 'It seems to me you are right.'),
('link8', 'Mam takie samo odczucie.', 'Mam takie samo odczucie.', 'My feelings exactly.'),
('link8', 'Moja opinia jest taka, że ...', 'Moja opinia jest taka, że to dobry pomysł.', 'My opinion is that it is a good idea.'),
('link8', 'Nie do końca ...', 'Nie do końca się zgadzam.', 'Not exactly, I do not agree.'),
('link8', 'Och, daj spokój!', 'Och, daj spokój!', 'Oh, come on!'),
('link8', 'wyszukiwarka', 'Używam wyszukiwarki Google.', 'I use the Google search engine.'),
('link8', 'hasło wpisywane w wyszukiwarce', 'Wpisz hasło w wyszukiwarce.', 'Enter the search term.'),
('link8', 'Dla mnie brzmi dobrze.', 'Dla mnie brzmi dobrze.', 'Sounds good to me.'),
('link8', 'To dobry argument.', 'To dobry argument.', 'That is a good point.'),
('link8', 'Myślę dokładnie tak samo.', 'Myślę dokładnie tak samo.', 'That is exactly what I think.'),
('link8', 'To prawda, ale ...', 'To prawda, ale nie zgadzam się.', 'True, but I do not agree.'),
('link8', 'Co myślisz o ...?', 'Co myślisz o tej książce?', 'What do you think about this book?'),
('link8', 'Co jest grane?', 'Co jest grane?', 'What is up?'),
('link8', 'Jaka jest twoja opinia na temat ...?', 'Jaka jest twoja opinia na temat tego filmu?', 'What is your opinion on this film?'),
('link8', 'Jej!', 'Jej, to niesamowite!', 'Wow, this is amazing!'),
('link8', 'Czeka cię niespodzianka!', 'Czeka cię niespodzianka!', 'You are in for a surprise!'),
('link8', 'przodek', 'Mój przodek mieszkał w Krakowie.', 'My ancestor lived in Krakow.'),
('link8', 'przodkowie', 'Moi przodkowie byli rolnikami.', 'My ancestry includes farmers.'),
('link8', 'kość', 'Pies lubi kość.', 'A dog likes a bone.'),
('link8', 'ewolucja', 'Ewolucja człowieka jest interesująca.', 'Human evolution is interesting.'),
('link8', 'ewoluować, rozwijać się', 'Gatunki ewoluują z czasem.', 'Species evolve over time.'),
('link8', 'dowiadywać się', 'Chcę dowiedzieć się więcej.', 'I want to find out more.'),
('link8', 'gen', 'Każdy ma unikalne geny.', 'Everyone has unique genes.'),
('link8', 'genetyczny', 'To choroba genetyczna.', 'It is a genetic disease.'),
('link8', 'stopniowy', 'Postęp jest stopniowy.', 'The progress is gradual.'),
('link8', 'dziedziczyć', 'Dziedziczę cechy po rodzicach.', 'I inherit traits from my parents.'),
('link8', 'linia', 'Narysuj linię.', 'Draw a line.'),
('link8', 'rodowód', 'Mój rodowód sięga XV wieku.', 'My lineage goes back to the 15th century.'),
('link8', 'migrować', 'Ptaki migrują na zimę.', 'Birds migrate in winter.'),
('link8', 'migracja', 'Migracja ptaków jest fascynująca.', 'Bird migration is fascinating.'),
('link8', 'mieszać się', 'Kultury mieszają się ze sobą.', 'Cultures mix with each other.'),
('link8', 'przekazywać', 'Rodzice przekazują dzieciom geny.', 'Parents pass on genes to their children.'),
('link8', 'planeta', 'Ziemia to nasza planeta.', 'Earth is our planet.'),
('link8', 'liczba mieszkańców', 'Liczba mieszkańców rośnie.', 'The population is growing.'),
('link8', 'otrzymywać', 'Otrzymuję list od babci.', 'I am receiving a letter from grandma.'),
('link8', 'środek, zasób', 'Woda to ważny zasób.', 'Water is an important resource.'),
('link8', 'osobny', 'To osobny problem.', 'It is a separate problem.'),
('link8', 'gatunek', 'Tygrys to gatunek zagrożony.', 'A tiger is an endangered species.'),
('link8', 'taki jak', 'Lubię owoce, takie jak jabłka.', 'I like fruits such as apples.'),
('link8', 'podczas gdy', 'Czytam, podczas gdy mama gotuje.', 'I am reading while mum is cooking.'),
('link8', 'od końca', 'Czytaj od końca.', 'Read backwards.'),
('link8', 'być blisko', 'Sklep jest blisko.', 'The shop is near.'),
('link8', 'informacje', 'Potrzebuję informacji.', 'I need details.'),
('link8', 'inżynieria', 'Inżynieria jest fascynująca.', 'Engineering is fascinating.'),
('link8', 'pokolenie', 'Moje pokolenie używa internetu.', 'My generation uses the internet.'),
('link8', 'kończyć się', 'Mleko nam się kończy.', 'The milk is running out.'),
('link8', 'a więc widzisz ...', 'A więc widzisz, miałem rację.', 'So you see, I was right.'),
('link8', 'nazwisko', 'Moje nazwisko to Kowalski.', 'My surname is Kowalski.'),
('link8', 'wskazówka, porada', 'Daj mi dobrą wskazówkę.', 'Give me a good tip.'),
('link8', 'różnić się', 'Polskie zwyczaje różnią się od chińskich.', 'Polish customs vary from Chinese ones.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Link 8: 126 unikalnych zdan zaktualizowanych/dodanych w word_sentences (127 wpisow w data.js, 1 duplikat synonimu badania investigation/research zdedupedowany przez UPSERT).';
END $$;
