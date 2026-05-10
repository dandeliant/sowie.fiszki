-- ═══════════════════════════════════════════════════════════
-- Fix sentences: LINK 7 (klasa 7, szkola podstawowa, Oxford)
-- ═══════════════════════════════════════════════════════════
--
-- Cel: kompletne, starannie napisane przyklady zdan dla wszystkich
-- 83 unikalnych slowek z Link 7 (Oxford).
--
-- Struktura podrecznika w data.js: tylko Unit 6.
-- (Inne unity nie istnieja w projekcie — stan oryginalny zachowany.)
--
-- Tematy unitu:
--   Unit 6 (83): przymiotniki opisujace + pieniadze + przeprosiny + zakupy
--
-- UPSERT (INSERT ... ON CONFLICT DO UPDATE) — idempotentna.

INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target) VALUES

-- ═══════════════════════════════════════════════════════════
-- Unit 6 — Adjectives, money, apologies, shopping (83)
-- ═══════════════════════════════════════════════════════════
('link7', 'niesamowity', 'Ten film jest niesamowity!', 'This film is amazing!'),
('link7', 'starożytny', 'Egipcjanie zbudowali starożytne piramidy.', 'The Egyptians built ancient pyramids.'),
('link7', 'okropny', 'Pogoda jest okropna.', 'The weather is awful.'),
('link7', 'gotujący się, wrzący', 'Woda jest gotująca się.', 'The water is boiling.'),
('link7', 'smaczny', 'Ta pizza jest smaczna.', 'This pizza is delicious.'),
('link7', 'fantastyczny', 'Ta książka jest fantastyczna.', 'This book is fantastic.'),
('link7', 'fascynujący', 'Ten temat jest fascynujący.', 'This topic is fascinating.'),
('link7', 'mroźno, lodowaty', 'Na zewnątrz jest mroźno.', 'It is freezing outside.'),
('link7', 'wściekły', 'Mama jest wściekła.', 'Mum is furious.'),
('link7', 'przezabawny', 'Ten film jest przezabawny.', 'This film is hilarious.'),
('link7', 'ogromny', 'Słoń jest ogromny.', 'An elephant is huge.'),
('link7', 'nieszczęśliwy', 'Mój brat jest nieszczęśliwy.', 'My brother is miserable.'),
('link7', 'zatłoczony', 'Autobus był zatłoczony.', 'The bus was packed.'),
('link7', 'głodny jak wilk', 'Jestem głodny jak wilk!', 'I am starving!'),
('link7', 'malutki', 'Mam malutkiego kotka.', 'I have a tiny kitten.'),
('link7', 'dziwny', 'To jest dziwne.', 'That is weird.'),
('link7', 'zadziwiający', 'Ten widok jest zadziwiający.', 'This view is astonishing.'),
('link7', 'dźwig', 'Dźwig podnosi materiały.', 'The crane is lifting materials.'),
('link7', 'ohydny', 'To jedzenie jest ohydne.', 'This food is disgusting.'),
('link7', 'wyczerpujący', 'Ten dzień był wyczerpujący.', 'This day was exhausting.'),
('link7', 'niechlujny', 'Mój pokój jest niechlujny.', 'My room is messy.'),
('link7', 'talerz', 'Talerz jest na stole.', 'The plate is on the table.'),
('link7', 'pas bezpieczeństwa', 'Zapnij pas bezpieczeństwa.', 'Fasten your safety belt.'),
('link7', 'zmysły', 'Mamy pięć zmysłów.', 'We have five senses.'),
('link7', 'przerażający', 'Ten film jest przerażający.', 'This film is terrifying.'),
('link7', 'porywający', 'Ten film jest porywający.', 'This film is thrilling.'),
('link7', 'pozwolić sobie', 'Nie mogę sobie pozwolić na nowy telefon.', 'I cannot afford a new phone.'),
('link7', 'opieka nad dziećmi', 'Opieka nad dziećmi to dobra praca.', 'Babysitting is a good job.'),
('link7', 'osoba dużo wydająca pieniądze', 'On jest osobą dużo wydającą pieniądze.', 'He is a big spender.'),
('link7', 'pożyczać (od kogoś)', 'Pożyczam pieniądze od taty.', 'I am borrowing money from dad.'),
('link7', 'kupować', 'Kupuję chleb w piekarni.', 'I am buying bread at the bakery.'),
('link7', 'kosztować', 'Książka kosztuje 30 złotych.', 'The book costs 30 zlotys.'),
('link7', 'zarabiać', 'Tata zarabia w fabryce.', 'Dad earns money at the factory.'),
('link7', 'hojny', 'Mój dziadek jest hojny.', 'My grandfather is generous.'),
('link7', 'pożyczać (komuś)', 'Pożyczam pieniądze bratu.', 'I am lending money to my brother.'),
('link7', 'być winnym', 'Jestem winny tacie 50 złotych.', 'I owe dad 50 zlotys.'),
('link7', 'płacić', 'Płacę za pizzę.', 'I am paying for the pizza.'),
('link7', 'zwrócić pieniądze', 'Zwrócę ci pieniądze jutro.', 'I will pay you back tomorrow.'),
('link7', 'zapłacić za', 'Zapłaciłem za nowe buty.', 'I paid for new shoes.'),
('link7', 'kieszonkowe', 'Dostaję kieszonkowe od taty.', 'I get pocket money from dad.'),
('link7', 'ograniczyć', 'Powinieneś ograniczyć słodycze.', 'You should reduce sweets.'),
('link7', 'bogaty', 'On jest bardzo bogaty.', 'He is very rich.'),
('link7', 'oszczędzać', 'Oszczędzam na rower.', 'I am saving for a bike.'),
('link7', 'oszczędzać na', 'Oszczędzam na nowy telefon.', 'I am saving up for a new phone.'),
('link7', 'sprzedawać', 'Sprzedaję mój stary rower.', 'I am selling my old bike.'),
('link7', 'wydawać', 'Wydaję dużo na książki.', 'I spend a lot on books.'),
('link7', 'marnować', 'Nie marnuj wody.', 'Do not waste water.'),
('link7', 'Nie martw się.', 'Nie martw się.', 'Do not worry.'),
('link7', 'Przepraszam za...', 'Przepraszam za spóźnienie.', 'I apologize for being late.'),
('link7', 'Nie chciałem / Nie chciałam tego.', 'Nie chciałem tego zrobić.', 'I did not mean to do that.'),
('link7', 'Nie wiem, jak to się stało.', 'Nie wiem, jak to się stało.', 'I do not know how it happened.'),
('link7', 'Obawiam się...', 'Obawiam się, że nie mogę przyjść.', 'I am afraid I cannot come.'),
('link7', '(Naprawdę / bardzo) mi przykro.', 'Naprawdę mi przykro.', 'I am really sorry.'),
('link7', 'W porządku.', 'W porządku, nie martw się.', 'It is all right.'),
('link7', 'To był wypadek.', 'To był wypadek.', 'It was an accident.'),
('link7', 'To nie moja wina.', 'To nie moja wina.', 'It was not my fault.'),
('link7', 'To się już nie powtórzy.', 'To się już nie powtórzy.', 'It will not happen again.'),
('link7', 'Nieważne.', 'Nieważne.', 'Never mind.'),
('link7', 'Nie martw się — nie szkodzi.', 'Nie martw się, nie szkodzi.', 'Not to worry.'),
('link7', 'Przepraszam.', 'Przepraszam.', 'Sorry.'),
('link7', 'przyjąć zamówienie', 'Kelner przyjmuje zamówienie.', 'The waiter takes an order.'),
('link7', 'To nie jest zły pomysł.', 'To nie jest zły pomysł.', 'That is not a bad idea.'),
('link7', 'kelnerka', 'Kelnerka przynosi rachunek.', 'The waitress is bringing the bill.'),
('link7', 'Tylko pogarszasz!', 'Tylko pogarszasz sytuację!', 'You are making it worse!'),
('link7', 'okazja', 'To prawdziwa okazja!', 'It is a real bargain!'),
('link7', 'butik', 'Mama kupuje sukienkę w butiku.', 'Mum is buying a dress at the boutique.'),
('link7', 'marka', 'Jaka to marka?', 'What brand is it?'),
('link7', 'przerwa', 'Zrobię sobie przerwę.', 'I will take a break.'),
('link7', 'wybór', 'Mam trudny wybór.', 'I have a difficult choice.'),
('link7', 'rzemiosło', 'Lubię stare rzemiosło.', 'I like old craft.'),
('link7', 'dom handlowy', 'Idziemy do domu handlowego.', 'We are going to the department store.'),
('link7', 'ubrania znanych projektantów', 'Anna nosi ubrania znanych projektantów.', 'Anna wears designer label clothes.'),
('link7', 'dyskont', 'Kupuję w dyskoncie.', 'I am shopping at the discount store.'),
('link7', 'uciekać', 'Złodziej ucieka!', 'The thief is escaping!'),
('link7', 'wykonany ręcznie', 'Mam ręcznie wykonaną torbę.', 'I have a hand-made bag.'),
('link7', 'upewnić się', 'Upewnij się, że masz klucz.', 'Make sure you have the key.'),
('link7', 'stragan', 'Kupuję owoce na straganie.', 'I am buying fruit at the market stall.'),
('link7', 'wykonawca', 'Wykonawca jest profesjonalny.', 'The performer is professional.'),
('link7', 'wybierać', 'Wybierz, co chcesz.', 'Pick what you want.'),
('link7', 'wyprzedaż', 'W styczniu są wyprzedaże.', 'There are sales in January.'),
('link7', 'centrum handlowe', 'Idziemy do centrum handlowego.', 'We are going to the shopping centre.'),
('link7', 'mało czasu', 'Mam mało czasu.', 'I am short of time.'),
('link7', 'oglądanie wystaw sklepowych', 'Lubię oglądanie wystaw sklepowych.', 'I like window shopping.')

ON CONFLICT (book_id, word_pl) DO UPDATE SET
  sentence_pl     = EXCLUDED.sentence_pl,
  sentence_target = EXCLUDED.sentence_target,
  updated_at      = NOW();

DO $$ BEGIN
  RAISE NOTICE 'OK — Link 7: 83 unikalnych zdan zaktualizowanych/dodanych w word_sentences (83 wpisow w data.js, brak duplikatow).';
END $$;
