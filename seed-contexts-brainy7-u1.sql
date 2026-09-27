-- ═══════════════════════════════════════════════════════════
-- SEED fiszek kontekstowych — Brainy 7, Unit 1 (film/kino) — PRÓBKA
-- ═══════════════════════════════════════════════════════════
-- Wymaga migracji #59 (word-contexts-schema.sql). Idempotentny: najpierw
-- kasuje konteksty dla tych słów, potem wstawia. book_id='brainy7'.
-- To PRÓBKA-wzorzec (9 haseł × ~5 zdań) do akceptacji formatu/jakości.

DELETE FROM public.word_contexts WHERE book_id='brainy7' AND word_pl IN
 ('obsada','reżyser','komedia','horror, film grozy','główny bohater','fabuła','napisy','film akcji','nakręcić film');

INSERT INTO public.word_contexts (book_id, word_pl, ord, sentence_gap, answer, full_sentence, translation_pl) VALUES
-- obsada = cast
('brainy7','obsada',0,'The ______ of this film is amazing.','cast','The cast of this film is amazing.','Obsada tego filmu jest niesamowita.'),
('brainy7','obsada',1,'Who is in the ______ of this movie?','cast','Who is in the cast of this movie?','Kto jest w obsadzie tego filmu?'),
('brainy7','obsada',2,'The whole ______ came to the premiere.','cast','The whole cast came to the premiere.','Cała obsada przyszła na premierę.'),
('brainy7','obsada',3,'She joined the ______ last year.','cast','She joined the cast last year.','Dołączyła do obsady w zeszłym roku.'),
('brainy7','obsada',4,'The ______ includes many famous actors.','cast','The cast includes many famous actors.','Obsada obejmuje wielu znanych aktorów.'),
-- reżyser = director
('brainy7','reżyser',0,'The ______ shouted "Action!".','director','The director shouted "Action!".','Reżyser krzyknął „Akcja!".'),
('brainy7','reżyser',1,'Who is the ______ of this movie?','director','Who is the director of this movie?','Kto jest reżyserem tego filmu?'),
('brainy7','reżyser',2,'She wants to be a film ______.','director','She wants to be a film director.','Ona chce zostać reżyserką filmową.'),
('brainy7','reżyser',3,'The ______ won an important award.','director','The director won an important award.','Reżyser zdobył ważną nagrodę.'),
('brainy7','reżyser',4,'Famous ______ make great films.','directors','Famous directors make great films.','Znani reżyserzy tworzą świetne filmy.'),
-- komedia = comedy
('brainy7','komedia',0,'We watched a funny ______ last night.','comedy','We watched a funny comedy last night.','Wczoraj wieczorem oglądaliśmy zabawną komedię.'),
('brainy7','komedia',1,'I love watching ______.','comedies','I love watching comedies.','Uwielbiam oglądać komedie.'),
('brainy7','komedia',2,'This ______ made me laugh a lot.','comedy','This comedy made me laugh a lot.','Ta komedia bardzo mnie rozśmieszyła.'),
('brainy7','komedia',3,'Do you prefer ______ or horror?','comedy','Do you prefer comedy or horror?','Wolisz komedię czy horror?'),
('brainy7','komedia',4,'It is the best ______ of the year.','comedy','It is the best comedy of the year.','To najlepsza komedia roku.'),
-- horror, film grozy = horror film
('brainy7','horror, film grozy',0,'I cannot sleep after a ______.','horror film','I cannot sleep after a horror film.','Nie mogę spać po horrorze.'),
('brainy7','horror, film grozy',1,'She loves scary ______.','horror films','She loves scary horror films.','Ona uwielbia straszne horrory.'),
('brainy7','horror, film grozy',2,'This ______ is really frightening.','horror film','This horror film is really frightening.','Ten horror jest naprawdę przerażający.'),
('brainy7','horror, film grozy',3,'We watched a ______ on Halloween.','horror film','We watched a horror film on Halloween.','Oglądaliśmy horror w Halloween.'),
('brainy7','horror, film grozy',4,'Do you like ______?','horror films','Do you like horror films?','Lubisz horrory?'),
-- główny bohater = main character
('brainy7','główny bohater',0,'The ______ is a young wizard.','main character','The main character is a young wizard.','Głównym bohaterem jest młody czarodziej.'),
('brainy7','główny bohater',1,'Who is the ______ in this book?','main character','Who is the main character in this book?','Kto jest głównym bohaterem tej książki?'),
('brainy7','główny bohater',2,'The ______ saves the whole world.','main character','The main character saves the whole world.','Główny bohater ratuje cały świat.'),
('brainy7','główny bohater',3,'I really like the ______ of this film.','main character','I really like the main character of this film.','Bardzo lubię głównego bohatera tego filmu.'),
('brainy7','główny bohater',4,'The ______ is very brave and clever.','main character','The main character is very brave and clever.','Główny bohater jest bardzo odważny i sprytny.'),
-- fabuła = plot
('brainy7','fabuła',0,'The ______ of this film is exciting.','plot','The plot of this film is exciting.','Fabuła tego filmu jest ekscytująca.'),
('brainy7','fabuła',1,'I did not understand the ______.','plot','I did not understand the plot.','Nie zrozumiałem fabuły.'),
('brainy7','fabuła',2,'The ______ has a surprising ending.','plot','The plot has a surprising ending.','Fabuła ma zaskakujące zakończenie.'),
('brainy7','fabuła',3,'Can you explain the ______ to me?','plot','Can you explain the plot to me?','Możesz wyjaśnić mi fabułę?'),
('brainy7','fabuła',4,'The film has a complicated ______.','plot','The film has a complicated plot.','Film ma skomplikowaną fabułę.'),
-- napisy = subtitles
('brainy7','napisy',0,'I watch English films with ______.','subtitles','I watch English films with subtitles.','Oglądam angielskie filmy z napisami.'),
('brainy7','napisy',1,'Can you turn on the ______, please?','subtitles','Can you turn on the subtitles, please?','Możesz włączyć napisy, proszę?'),
('brainy7','napisy',2,'The ______ are too fast to read.','subtitles','The subtitles are too fast to read.','Napisy są za szybkie do przeczytania.'),
('brainy7','napisy',3,'This film has Polish ______.','subtitles','This film has Polish subtitles.','Ten film ma polskie napisy.'),
('brainy7','napisy',4,'I read the ______ at the bottom of the screen.','subtitles','I read the subtitles at the bottom of the screen.','Czytam napisy na dole ekranu.'),
-- film akcji = action film
('brainy7','film akcji',0,'I love watching ______.','action films','I love watching action films.','Uwielbiam oglądać filmy akcji.'),
('brainy7','film akcji',1,'This ______ is full of car chases.','action film','This action film is full of car chases.','Ten film akcji jest pełen pościgów samochodowych.'),
('brainy7','film akcji',2,'______ are usually very exciting.','Action films','Action films are usually very exciting.','Filmy akcji są zwykle bardzo ekscytujące.'),
('brainy7','film akcji',3,'He only watches ______.','action films','He only watches action films.','On ogląda tylko filmy akcji.'),
('brainy7','film akcji',4,'The new ______ comes out on Friday.','action film','The new action film comes out on Friday.','Nowy film akcji wchodzi na ekrany w piątek.'),
-- nakręcić film = shoot a film  (różne FORMY: shoot / shot / shooting)
('brainy7','nakręcić film',0,'They will ______ in our town next month.','shoot a film','They will shoot a film in our town next month.','Nakręcą film w naszym mieście w przyszłym miesiącu.'),
('brainy7','nakręcić film',1,'The director wants to ______ about the sea.','shoot a film','The director wants to shoot a film about the sea.','Reżyser chce nakręcić film o morzu.'),
('brainy7','nakręcić film',2,'Last year they ______ about pirates.','shot a film','Last year they shot a film about pirates.','W zeszłym roku nakręcili film o piratach.'),
('brainy7','nakręcić film',3,'We are ______ in the mountains this summer.','shooting a film','We are shooting a film in the mountains this summer.','Tego lata nakręcamy film w górach.'),
('brainy7','nakręcić film',4,'It is not easy to ______ without money.','shoot a film','It is not easy to shoot a film without money.','Nie jest łatwo nakręcić film bez pieniędzy.');

SELECT 'OK — wstawiono próbkę kontekstów Brainy 7 Unit 1 (9 haseł)' AS status;
