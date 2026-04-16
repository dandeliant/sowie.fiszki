#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate SQL INSERT statements with example sentences for vocabulary words."""

import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))

def load_words_from_json():
    with open(os.path.join(BASE, 'all_words.json'), 'r', encoding='utf-8') as f:
        d = json.load(f)
    books = ['brainy6', 'brainy7', 'together4', 'together5', 'together6', 'newpassword', 'czasowniki', 'englishA1']
    result = {}
    for b in books:
        if b in d:
            result[b] = [(w['pl'], w['en']) for w in d[b]['words']]
    return result

def esc(s):
    return s.replace("'", "''")

def is_sentence(pl, en):
    if pl.endswith('.') or pl.endswith('!') or pl.endswith('?'):
        return True
    if '...' in pl or '...' in en:
        return True
    return False

def is_long_phrase(pl, en):
    return len(pl.split()) >= 5 and len(en.split()) >= 5

def is_number(pl):
    try:
        int(pl)
        return True
    except ValueError:
        return False

VERB_SENTENCES = {
    'become': ('Ona stala sie lekarzem po studiach.', 'She became a doctor after university.'),
    'begin': ('Lekcja zaczela sie o osmej rano.', 'The lesson began at eight in the morning.'),
    'blow': ('Wiatr wial bardzo mocno wczoraj wieczorem.', 'The wind blew very hard yesterday evening.'),
    'break': ('Tomek zlamal sobie reke na boisku.', 'Tom broke his arm on the playground.'),
    'bring': ('Ona przyniosla nam pyszne ciasto.', 'She brought us a delicious cake.'),
    'build': ('Zbudowali nowy most w naszym miescie.', 'They built a new bridge in our town.'),
    'buy': ('Mama kupila mi nowy plecak do szkoly.', 'Mum bought me a new backpack for school.'),
    'catch': ('Zlapalem pilke podczas meczu koszykowki.', 'I caught the ball during the basketball game.'),
    'choose': ('Wybralem czerwona koszulke na wycieczke.', 'I chose the red T-shirt for the trip.'),
    'come': ('Przyszedl do szkoly bardzo wczesnie dzisiaj.', 'He came to school very early today.'),
    'cost': ('Ta ksiazka kosztowala dwadziescia zlotych.', 'This book cost twenty zlotys.'),
    'cut': ('Mama pokroila chleb na sniadanie.', 'Mum cut the bread for breakfast.'),
    'do': ('Zrobilem prace domowa zaraz po szkole.', 'I did my homework right after school.'),
    'draw': ('Narysowala piekny obraz na lekcji plastyki.', 'She drew a beautiful picture in art class.'),
    'dream': ('Snilem o podrozy do Londynu.', 'I dreamt about travelling to London.'),
    'drink': ('Wypilem szlanke soku pomaranczowego.', 'I drank a glass of orange juice.'),
    'drive': ('Tata jechal samochodem do pracy.', 'Dad drove the car to work.'),
    'eat': ('Zjedlismy obiad w szkolnej stolowce.', 'We ate lunch in the school canteen.'),
    'fall': ('Upadl na lodzie przed wejsciem do szkoly.', 'He fell on the ice in front of the school.'),
    'feed': ('Nakarmilam kota przed wyjsciem z domu.', 'I fed the cat before leaving home.'),
    'feel': ('Czulem sie zmeczony po dlugim treningu.', 'I felt tired after the long training.'),
    'find': ('Znalazlem zgubiony portfel w parku.', 'I found the lost wallet in the park.'),
    'fly': ('Samolot polecial do Paryza rano.', 'The plane flew to Paris in the morning.'),
    'forget': ('Zapomnialem przyniesc zeszyt na lekcje.', 'I forgot to bring my notebook to class.'),
    'get': ('Dostalem dobra ocene z matematyki.', 'I got a good mark in maths.'),
    'give': ('Dala mi prezent na urodziny.', 'She gave me a present for my birthday.'),
    'go': ('Poszedlem do szkoly wczoraj rano.', 'I went to school yesterday morning.'),
    'grow': ('Rosliny urosly bardzo szybko tego lata.', 'The plants grew very fast this summer.'),
    'have': ('Mielismy wspanialy czas na wycieczce.', 'We had a wonderful time on the trip.'),
    'hear': ('Slyszalem dziwny dzwiek w nocy.', 'I heard a strange sound at night.'),
    'hide': ('Ukryl prezent pod lozkiem.', 'He hid the present under the bed.'),
    'hurt': ('Zranilem sie w kolano na boisku.', 'I hurt my knee on the playground.'),
    'keep': ('Trzymalem psa na smyczy w parku.', 'I kept the dog on the lead in the park.'),
    'know': ('Wiedzialem odpowiedz na to pytanie.', 'I knew the answer to that question.'),
    'learn': ('Nauczylem sie nowych slow po angielsku.', 'I learnt new English words today.'),
    'leave': ('Wyszlismy z domu o siodmej rano.', 'We left home at seven in the morning.'),
    'let': ('Mama pozwolila mi isc na impreze.', 'Mum let me go to the party.'),
    'lose': ('Zgubil klucze w drodze do szkoly.', 'He lost his keys on the way to school.'),
    'make': ('Zrobila pyszna zupe na obiad.', 'She made a delicious soup for dinner.'),
    'mean': ('To slowo znaczylo cos innego po angielsku.', 'That word meant something different in English.'),
    'meet': ('Spotkalem sie z przyjaciolmi w parku.', 'I met my friends in the park.'),
    'pay': ('Zaplacilem za bilet do kina gotowka.', 'I paid for the cinema ticket in cash.'),
    'put': ('Polozyl ksiazke na polce w pokoju.', 'He put the book on the shelf in his room.'),
    'read': ('Przeczytalam cala ksiazke w weekend.', 'I read the whole book at the weekend.'),
    'ride': ('Jechalem na rowerze do szkoly codziennie.', 'I rode my bike to school every day.'),
    'ring': ('Telefon zadzwonil w trakcie lekcji.', 'The phone rang during the lesson.'),
    'run': ('Bieglem przez park po lekcjach.', 'I ran through the park after school.'),
    'say': ('Powiedzial ze przyjdzie o piatej.', 'He said he would come at five.'),
    'see': ('Widzialem nowy film w kinie wczoraj.', 'I saw a new film at the cinema yesterday.'),
    'sell': ('Sprzedali stare meble na targu.', 'They sold old furniture at the market.'),
    'send': ('Wyslalem wiadomosc do kolegi z klasy.', 'I sent a message to my classmate.'),
    'set': ('Ustawilam budzik na szosta rano.', 'I set the alarm for six in the morning.'),
    'show': ('Pokazal nam swoj nowy rower po szkole.', 'He showed us his new bike after school.'),
    'sing': ('Spiewala piekna piosenke na szkolnym koncercie.', 'She sang a beautiful song at the school concert.'),
    'sit': ('Siedzielismy w pierwszym rzedzie w klasie.', 'We sat in the front row in class.'),
    'sleep': ('Spalem bardzo dlugo w sobote rano.', 'I slept very long on Saturday morning.'),
    'smell': ('Jedzenie pachnialo wspaniale w kuchni.', 'The food smelt wonderful in the kitchen.'),
    'speak': ('Mowila po angielsku na lekcji.', 'She spoke English during the lesson.'),
    'spend': ('Spedzilismy wakacje nad morzem w lipcu.', 'We spent our holiday by the sea in July.'),
    'stand': ('Stalem w kolejce przez dwadziescia minut.', 'I stood in the queue for twenty minutes.'),
    'swim': ('Plywalem w jeziorze w zeszlym tygodniu.', 'I swam in the lake last week.'),
    'take': ('Wzielam parasol bo padal deszcz.', 'I took an umbrella because it was raining.'),
    'teach': ('Pani Kowalska uczyla nas historii.', 'Mrs Kowalska taught us history.'),
    'tell': ('Powiedzial mi ciekawa historie o podrozy.', 'He told me an interesting story about a trip.'),
    'think': ('Myslalem o tym przez caly dzien.', 'I thought about it all day long.'),
    'throw': ('Rzucil pilke do kolegi na boisku.', 'He threw the ball to his friend on the field.'),
    'understand': ('Zrozumialem to zadanie dopiero wieczorem.', 'I understood the task only in the evening.'),
    'wake': ('Obudzilam sie o szostej rano dzisiaj.', 'I woke up at six in the morning today.'),
    'wear': ('Nosil nowa kurtke w szkole dzisiaj.', 'He wore a new jacket at school today.'),
    'win': ('Nasz zespol wygral turniej szkolny.', 'Our team won the school tournament.'),
    'write': ('Napisala list do swojej babci.', 'She wrote a letter to her grandmother.'),
    'admit': ('Przyznal ze nie odrobil pracy domowej.', 'He admitted that he had not done his homework.'),
}

# Large dictionary for specific English words
S = {
    'cashier': ('Kasjer wydal mi reszte w sklepie.', 'The cashier gave me change at the shop.'),
    'engineer': ('Inzynier zaprojektowal nowy most w miescie.', 'The engineer designed a new bridge in the city.'),
    'farmer': ('Rolnik wstaje wczesnie zeby nakarmicx zwierzeta.', 'The farmer gets up early to feed the animals.'),
    'nurse': ('Pielegniarka zmierzyla mi temperature.', 'The nurse took my temperature.'),
    'lawyer': ('Prawnik pomogl nam w sprawie sadowej.', 'The lawyer helped us with the court case.'),
    'scientist': ('Naukowiec odkryl nowy gatunek rosliny.', 'The scientist discovered a new plant species.'),
    'plumber': ('Hydraulik naprawil cieknacy kran w kuchni.', 'The plumber fixed the leaking tap in the kitchen.'),
    'airport': ('Lotnisko bylo pelne ludzi w wakacje.', 'The airport was full of people during the holidays.'),
    'bank': ('Poszlismy do banku wyplacic pieniadze.', 'We went to the bank to withdraw money.'),
    'factory': ('Fabryka produkuje samochody od wielu lat.', 'The factory has been making cars for many years.'),
    'farm': ('Na farmie bylo duzo krow i owiec.', 'There were many cows and sheep on the farm.'),
    'hospital': ('Szpital jest otwarty calodobowo.', 'The hospital is open twenty-four hours a day.'),
    'office': ('Mama pracuje w biurze od poniedzialku do piatku.', 'Mum works in an office from Monday to Friday.'),
    'warehouse': ('Magazyn jest pelny pudelek z towarem.', 'The warehouse is full of boxes with goods.'),
    'library': ('Poszlam do biblioteki zeby pozyczyc ksiazke.', 'I went to the library to borrow a book.'),
    'armchair': ('Fotel stoi w rogu salonu.', 'The armchair is in the corner of the living room.'),
    'bookcase': ('Na biblioteczce stoja moje ulubione ksiazki.', 'My favourite books are on the bookcase.'),
    'cupboard': ('Talerze sa w szafce w kuchni.', 'The plates are in the cupboard in the kitchen.'),
    'curtains': ('Zaslony w moim pokoju sa niebieskie.', 'The curtains in my room are blue.'),
    'cushion': ('Polozylam poduszke na kanapie w salonie.', 'I put the cushion on the sofa in the living room.'),
    'pillow': ('Potrzebuje miekkiej poduszki do spania.', 'I need a soft pillow to sleep on.'),
    'mirror': ('Spojrzalem w lustro przed wyjsciem.', 'I looked in the mirror before leaving.'),
    'rug': ('Na podlodze lezy kolorowy dywanik.', 'There is a colourful rug on the floor.'),
    'shelf': ('Poloz ksiazke na polce w pokoju.', 'Put the book on the shelf in the room.'),
    'sofa': ('Usiadlem na kanapie i wlaczylem telewizor.', 'I sat on the sofa and turned on the TV.'),
    'towel': ('Wzialem recznik i poszedlem pod prysznic.', 'I took a towel and went for a shower.'),
    'wardrobe': ('Moje ubrania wisza w szafie w sypialni.', 'My clothes hang in the wardrobe in the bedroom.'),
    'basin': ('Umylem rece w umywalce w lazience.', 'I washed my hands in the basin in the bathroom.'),
    'bath': ('Lubie brac ciepla kapiel wieczorem.', 'I like to have a warm bath in the evening.'),
    'dishwasher': ('Wloz brudne talerze do zmywarki.', 'Put the dirty plates in the dishwasher.'),
    'cooker': ('Mama gotuje obiad na kuchence.', 'Mum is cooking dinner on the cooker.'),
    'freezer': ('Lody sa w zamrazarce w kuchni.', 'The ice cream is in the freezer in the kitchen.'),
    'fridge': ('Mleko jest w lodowce na dolnej polce.', 'The milk is in the fridge on the bottom shelf.'),
    'heater': ('Wlacz grzejnik bo jest zimno w pokoju.', 'Turn on the heater because it is cold in the room.'),
    'radiator': ('Kaloryfer grzeje dobrze w zimie.', 'The radiator heats well in winter.'),
    'shower': ('Biore prysznic codziennie rano przed szkola.', 'I take a shower every morning before school.'),
    'sink': ('Umyj talerze w zlewie po obiedzie.', 'Wash the plates in the sink after dinner.'),
    'tap': ('Zakrecx kran po myciu rak.', 'Turn off the tap after washing your hands.'),
    'washing machine': ('Pralka pierze ubrania w czterdziesci minut.', 'The washing machine washes clothes in forty minutes.'),
    'bed': ('Posciel lozko przed pojsciem do szkoly.', 'Make your bed before going to school.'),
    'lamp': ('Wlacz lampe bo jest ciemno w pokoju.', 'Turn on the lamp because it is dark in the room.'),
    'table': ('Nakryj stol do kolacji prosze.', 'Set the table for dinner please.'),
    'chair': ('Usiadz na krzesle przy biurku.', 'Sit on the chair at the desk.'),
    'carpet': ('Nowy dywan jest miekki i wygodny.', 'The new carpet is soft and comfortable.'),
    'poster': ('Powiesilem plakat na scianie w moim pokoju.', 'I put a poster on the wall in my room.'),
    'cap': ('Zaloz czapke bo swieci mocne slonce.', 'Put on your cap because the sun is strong.'),
    'dress': ('Wlozyla ladna sukienke na impreze.', 'She put on a nice dress for the party.'),
    'hoodie': ('Bluza z kapturem jest wygodna na co dzien.', 'A hoodie is comfortable for everyday wear.'),
    'jacket': ('Wez kurtke bo na dworze jest chlodno.', 'Take a jacket because it is cool outside.'),
    'jeans': ('Nosze dzinsy prawie kazdego dnia.', 'I wear jeans almost every day.'),
    'jumper': ('Wloz ciepky sweter bo jest zimno.', 'Put on a warm jumper because it is cold.'),
    'shirt': ('Tata nosi biala koszule do pracy.', 'Dad wears a white shirt to work.'),
    'shoes': ('Moje nowe buty sa bardzo wygodne.', 'My new shoes are very comfortable.'),
    'shorts': ('Latem nosze szorty i koszulke.', 'In summer I wear shorts and a T-shirt.'),
    'skirt': ('Mama kupila mi nowa spodnice do szkoly.', 'Mum bought me a new skirt for school.'),
    'socks': ('Potrzebuje czystych skarpetek na jutro.', 'I need clean socks for tomorrow.'),
    'trainers': ('Moje trampki sa idealne do biegania.', 'My trainers are perfect for running.'),
    'trousers': ('Te spodnie sa za dlugie na mnie.', 'These trousers are too long for me.'),
    'coat': ('Zaloz plaszcz bo na dworze pada deszcz.', 'Put on your coat because it is raining outside.'),
    'boots': ('Wloz kozaki bo na dworze jest snieg.', 'Put on your boots because there is snow outside.'),
    'tracksuit': ('Nosze dres na lekcje wf.', 'I wear a tracksuit for PE lessons.'),
    'backpack': ('Spakuj plecak wieczorem przed szkola.', 'Pack your backpack in the evening before school.'),
    'glasses': ('Nosze okulary do czytania na lekcjach.', 'I wear glasses for reading in lessons.'),
    'helmet': ('Zawsze zakladam kask gdy jezdzene rowerze.', 'I always wear a helmet when I ride my bike.'),
    'angry': ('Tata byl zly bo spoznilem sie do domu.', 'Dad was angry because I came home late.'),
    'bored': ('Jestem znudzony bo nie mam co robic.', 'I am bored because I have nothing to do.'),
    'confident': ('Czuje sie pewny siebie przed prezentacja.', 'I feel confident before the presentation.'),
    'excited': ('Jestem podekscytowany wycieczka w przyszlym tygodniu.', 'I am excited about the trip next week.'),
    'lonely': ('Czula sie samotna w nowej szkole.', 'She felt lonely at the new school.'),
    'nervous': ('Jestem zdenerwowany przed egzaminem z matematyki.', 'I am nervous before the maths exam.'),
    'proud': ('Bylem dumny ze swojej oceny.', 'I was proud of my test mark.'),
    'scared': ('Bylem przestraszony podczas burzy w nocy.', 'I was scared during the storm at night.'),
    'stressed': ('Jestem zestresowany bo mam duzo pracy domowej.', 'I am stressed because I have a lot of homework.'),
    'surprised': ('Bylam zaskoczona prezentem od przyjacioluci.', 'I was surprised by the present from my friend.'),
    'worried': ('Mama jest zmartwiona bo wracam pozno.', 'Mum is worried because I come home late.'),
    'happy': ('Jestem szczesliwy bo dostalem dobra ocene.', 'I am happy because I got a good mark.'),
    'tired': ('Jestem zmeczony po calym dniu w szkole.', 'I am tired after a whole day at school.'),
    'hungry': ('Jestem glodny bo nie jadlem sniadania.', 'I am hungry because I did not eat breakfast.'),
    'thirsty': ('Jestem spragniony po grze w pilke nozna.', 'I am thirsty after playing football.'),
    'pleased': ('Bylem zadowolony z wynikow sprawdzianu.', 'I was pleased with the test results.'),
    'clever': ('Jest bardzo madra i dostaje same piatki.', 'She is very clever and gets top marks.'),
    'friendly': ('Nowa uczennica jest bardzo przyjazna i mila.', 'The new student is very friendly and nice.'),
    'funny': ('Jest zabawny i zawsze opowiada dowcipy.', 'He is funny and always tells jokes.'),
    'helpful': ('Nasz sasiad jest bardzo pomocny.', 'Our neighbour is very helpful.'),
    'kind': ('Nasza nauczycielka jest bardzo mila dla uczniow.', 'Our teacher is very kind to students.'),
    'quiet': ('Badz cichy w bibliotece ludzie czytaja.', 'Be quiet in the library people are reading.'),
    'shy': ('Na poczatku byla niesmiale w nowej klasie.', 'At first she was shy in the new class.'),
    'lazy': ('Nie badz leniwy odrabiaj prace domowa.', 'Do not be lazy do your homework.'),
    'art': ('Plastyka to moja ulubiona lekcja w szkole.', 'Art is my favourite lesson at school.'),
    'biology': ('Na biologii uczymy sie o zwierzetach.', 'In biology we learn about animals.'),
    'geography': ('Na geografii poznajemy kontynenty i kraje.', 'In geography we learn about continents and countries.'),
    'history': ('Historia to moj ulubiony przedmiot.', 'History is my favourite subject.'),
    'maths': ('Matematyka jest trudna ale przydatna.', 'Maths is difficult but useful.'),
    'science': ('Lubie nauki scisle szczegolnie fizyke.', 'I like science especially physics.'),
    'chemistry': ('Na chemii robimy ciekawe eksperymenty.', 'In chemistry we do interesting experiments.'),
    'physics': ('Fizyka jest trudna ale bardzo ciekawa.', 'Physics is difficult but very interesting.'),
    'basketball': ('Gram w koszykowke w druzynie szkolnej.', 'I play basketball on the school team.'),
    'football': ('Gramy w pilke nozna na boisku po lekcjach.', 'We play football on the pitch after lessons.'),
    'tennis': ('Gram w tenisa na korcie w parku.', 'I play tennis at the court in the park.'),
    'volleyball': ('Siatkowka to popularny sport w naszej szkole.', 'Volleyball is a popular sport at our school.'),
    'swimming': ('Plywanie to moj ulubiony sport w lecie.', 'Swimming is my favourite sport in summer.'),
    'skiing': ('Jezdzimy na narty w gory zima.', 'We go skiing in the mountains in winter.'),
    'cycling': ('Kolarstwo to swietny sport na swiezym powietrzu.', 'Cycling is a great outdoor sport.'),
    'judo': ('Cwicze judo dwa razy w tygodniu.', 'I practise judo twice a week.'),
    'running': ('Bieganie pomaga mi sie zrelaksowac po szkole.', 'Running helps me relax after school.'),
    'Monday': ('W poniedzialek mam szesc lekcji w szkole.', 'On Monday I have six lessons at school.'),
    'Tuesday': ('We wtorek ide na trening koszykowki.', 'On Tuesday I go to basketball practice.'),
    'Wednesday': ('W srode mamy dluga przerwe obiadowa.', 'On Wednesday we have a long lunch break.'),
    'Thursday': ('W czwartek mam dodatkowe lekcje angielskiego.', 'On Thursday I have extra English lessons.'),
    'Friday': ('W piatek konczymy lekcje wczesniej.', 'On Friday we finish lessons earlier.'),
    'Saturday': ('W sobote gram w pilke z kolegami.', 'On Saturday I play football with my friends.'),
    'Sunday': ('W niedziele odpoczywam z rodzina w domu.', 'On Sunday I rest with my family at home.'),
    'brother': ('Moj brat jest starszy ode mnie o trzy lata.', 'My brother is three years older than me.'),
    'sister': ('Moja siostra chodzi do tej samej szkoly.', 'My sister goes to the same school.'),
    'mother': ('Moja matka jest nauczycielka angielskiego.', 'My mother is an English teacher.'),
    'father': ('Moj ojciec pracuje w biurze w centrum miasta.', 'My father works in an office in the city centre.'),
    'parents': ('Moi rodzice zabiaja nas nad morze latem.', 'My parents take us to the seaside in summer.'),
    'grandmother': ('Babcia piecze najlepsze ciasto na swiecie.', 'Grandmother bakes the best cake in the world.'),
    'grandfather': ('Dziadek opowiada mi ciekawe historie.', 'Grandfather tells me interesting stories.'),
    'aunt': ('Ciotka mieszka w Krakowie i odwiedza nas czesto.', 'My aunt lives in Krakow and visits us often.'),
    'uncle': ('Wujek zabiera nas na ryby w weekendy.', 'My uncle takes us fishing at weekends.'),
    'cousin': ('Moj kuzyn przyezdza do nas na wakacje.', 'My cousin comes to visit us for the holidays.'),
    'behind': ('Kot schowal sie za kanapa w salonie.', 'The cat hid behind the sofa in the living room.'),
    'in front of': ('Czekam na ciebie przed wejsciem do szkoly.', 'I am waiting for you in front of the school entrance.'),
    'next to': ('Usiadz obok mnie na lekcji angielskiego.', 'Sit next to me in the English lesson.'),
    'under': ('Pilka jest pod lozkiem w moim pokoju.', 'The ball is under the bed in my room.'),
    'behind': ('Kot schowal sie za kanapa.', 'The cat hid behind the sofa.'),
    'on': ('Telefon lezy na biurku w moim pokoju.', 'The phone is on the desk in my room.'),
    'in': ('Ksiazka jest w plecaku na gornej polce.', 'The book is in the backpack on the top shelf.'),
    'now': ('Nie moge teraz rozmawiac jestem na lekcji.', 'I cannot talk now I am in a lesson.'),
    'today': ('Dzisiaj mamy sprawdzian z angielskiego.', 'Today we have an English test.'),
    'yesterday': ('Wczoraj bylismy w kinie z klasa.', 'Yesterday we went to the cinema with our class.'),
    'always': ('Zawsze odrabiam prace domowa po obiedzie.', 'I always do my homework after dinner.'),
    'sometimes': ('Czasami chodze do szkoly pieszo.', 'Sometimes I walk to school on foot.'),
    'usually': ('Zazwyczaj wstaje o siodmej w dni szkolne.', 'I usually get up at seven on school days.'),
    'never': ('Nigdy nie spozniam sie na lekcje.', 'I never come late to lessons.'),
    'every day': ('Cwicze angielski codziennie po szkole.', 'I practise English every day after school.'),
    'cloudy': ('Jest pochmurno ale nie pada deszcz.', 'It is cloudy but it is not raining.'),
    'cold': ('Dzisiaj jest bardzo zimno ubierz sie cieplo.', 'It is very cold today dress warmly.'),
    'hot': ('Jest goraco wiec zjemy lody w parku.', 'It is hot so we will eat ice cream in the park.'),
    'rainy': ('W deszczowe dni zostaje w domu i czytam.', 'On rainy days I stay at home and read.'),
    'snowy': ('Sniezna zima jest idealna na lepienie balwana.', 'A snowy winter is perfect for building a snowman.'),
    'sunny': ('Jest slonecznie chodzmy do parku po szkole.', 'It is sunny let us go to the park after school.'),
    'warm': ('Jest cieplo nie potrzebujesz kurtki dzisiaj.', 'It is warm you do not need a jacket today.'),
    'windy': ('Jest wietrznie nie wychodz bez czapki.', 'It is windy do not go out without a hat.'),
    'laptop': ('Uzywam laptopa do odrabiania pracy domowej.', 'I use my laptop for doing my homework.'),
    'keyboard': ('Naucz sie pisac szybko na klawiaturze.', 'Learn to type quickly on the keyboard.'),
    'mouse': ('Kliknij myszka na ikone na pulpicie.', 'Click the mouse on the icon on the desktop.'),
    'printer': ('Drukarka wydrukowala moj projekt szkolny.', 'The printer printed my school project.'),
    'monitor': ('Monitor komputera jest duzy i wyrazny.', 'The computer monitor is big and clear.'),
    'screen': ('Nie patrz na ekran zbyt dlugo.', 'Do not look at the screen for too long.'),
    'tablet': ('Czytam ksiazki na tablecie w podrozy.', 'I read books on the tablet while travelling.'),
    'charger': ('Nie zapomnij zabrac ladowarki do szkoly.', 'Do not forget to take the charger to school.'),
    'smartphone': ('Uzywam smartfona do komunikacji z przyjaciolmi.', 'I use my smartphone to communicate with friends.'),
    'beach': ('Spedzilismy caly dzien na plazy w lipcu.', 'We spent the whole day at the beach in July.'),
    'forest': ('Chodzilismy na spacer do lasu z rodzina.', 'We went for a walk in the forest with the family.'),
    'river': ('Rzeka plynie przez centrum naszego miasta.', 'The river flows through the centre of our town.'),
    'lake': ('Plywalismy w jeziorze w zeszle lato.', 'We swam in the lake last summer.'),
    'island': ('Marzy mi sie wakacje na tropikalnej wyspie.', 'I dream of a holiday on a tropical island.'),
    'sea': ('Morze bylo spokojne i cieple w sierpniu.', 'The sea was calm and warm in August.'),
    'bridge': ('Most laczy dwie czesci naszego miasta.', 'The bridge connects two parts of our town.'),
    'tower': ('Z wiezy widac panorame calego miasta.', 'From the tower you can see the whole town.'),
    'statue': ('W parku stoi posag znanego poety.', 'There is a statue of a famous poet in the park.'),
    'action film': ('Film akcji byl pelen ekscytujacych scen.', 'The action film was full of exciting scenes.'),
    'comedy': ('Komedia rozbawila nas do lez.', 'The comedy made us laugh until we cried.'),
    'horror film': ('Horror byl tak straszny ze zakrylem oczy.', 'The horror film was so scary that I covered my eyes.'),
    'thriller': ('Film sensacyjny trzymal nas w napieciu.', 'The thriller kept us on the edge of our seats.'),
    'customer': ('Klient chcial zwrocic buty do sklepu.', 'The customer wanted to return the shoes to the shop.'),
    'discount': ('Kupilismy gre z duza znizka.', 'We bought this game with a big discount.'),
    'receipt': ('Zachowaj paragon na wypadek zwrotu.', 'Keep the receipt in case of a return.'),
    'bargain': ('To byla swietna okazja cenowa w sklepie.', 'It was a great bargain at the shop.'),
    'expensive': ('Ten telefon jest za drogi dla mnie.', 'This phone is too expensive for me.'),
    'cheap': ('Te buty sa tanie i wygodne.', 'These shoes are cheap and comfortable.'),
    'comfortable': ('Te buty sa bardzo wygodne do chodzenia.', 'These shoes are very comfortable for walking.'),
    'useful': ('Slownik jest bardzo przydatny na lekcjach.', 'A dictionary is very useful in lessons.'),
    'dangerous': ('Jest niebezpiecznie przechodzic przez ulice tutaj.', 'It is dangerous to cross the street here.'),
    'boring': ('Ten film byl nudny i szybko zasnalem.', 'This film was boring and I fell asleep quickly.'),
    'exciting': ('Wycieczka do Londynu byla ekscytujaca.', 'The trip to London was exciting.'),
    'fresh': ('Kupilismy swieze warzywa na targu.', 'We bought fresh vegetables at the market.'),
    'famous': ('Ten aktor jest slawny na calym swiecie.', 'This actor is famous all over the world.'),
    'modern': ('Nasz dom jest nowoczesny i energooszczedny.', 'Our house is modern and energy-efficient.'),
    'old-fashioned': ('Te meble sa staromodne ale ladne.', 'This furniture is old-fashioned but nice.'),
    'Poland': ('Polska lezy w centrum Europy.', 'Poland is in the centre of Europe.'),
    'the UK': ('Wielka Brytania jest wyspa w Europie.', 'The UK is an island in Europe.'),
    'France': ('Francja slynie z wiezy Eiffla i serow.', 'France is famous for the Eiffel Tower and cheeses.'),
    'Spain': ('Hiszpania ma piekne plaze nad morzem.', 'Spain has beautiful beaches by the sea.'),
    'China': ('Chiny to najwiekszy kraj w Azji.', 'China is the biggest country in Asia.'),
    'Australia': ('Australia jest znana z kengurow i koali.', 'Australia is famous for kangaroos and koalas.'),
    'Polish': ('Jestem Polakiem i mieszkam w Warszawie.', 'I am Polish and I live in Warsaw.'),
    'British': ('Brytyjczycy pija duzo herbaty z mlekiem.', 'The British drink a lot of tea with milk.'),
    'French': ('Francuski chleb jest pyszny i chrupiacy.', 'French bread is delicious and crunchy.'),
    'Spanish': ('Hiszpanski jezyk jest piekny i melodyjny.', 'The Spanish language is beautiful and melodic.'),
    'Chinese': ('Chinskie jedzenie jest popularne na calym swiecie.', 'Chinese food is popular all over the world.'),
    'American': ('Amerykanski film wygral nagrode na festiwalu.', 'The American film won an award at the festival.'),
    'bread': ('Kupilismy swiezy chleb w piekarni rano.', 'We bought fresh bread at the bakery this morning.'),
    'cheese': ('Lubie ser na kanapkach do szkoly.', 'I like cheese in my sandwiches for school.'),
    'milk': ('Pije szlanke mleka na sniadanie.', 'I drink a glass of milk for breakfast.'),
    'rice': ('Na obiad jedlismy ryz z kurczakiem.', 'We had rice with chicken for dinner.'),
    'egg': ('Zjadlem jajko na miekko na sniadanie.', 'I ate a soft-boiled egg for breakfast.'),
    'cake': ('Mama upiekla ciasto na moje urodziny.', 'Mum baked a cake for my birthday.'),
    'dog': ('Wyprowadzam psa na spacer dwa razy dziennie.', 'I walk the dog twice a day.'),
    'cat': ('Moj kot lubi spac na kanapie caly dzien.', 'My cat likes to sleep on the sofa all day.'),
    'bird': ('Ptak spiewa pieknie rano za oknem.', 'A bird sings beautifully in the morning outside.'),
    'fish': ('Ryby plywaja w akwarium w naszej klasie.', 'The fish swim in the aquarium in our classroom.'),
    'rabbit': ('Krolik lubi marchewke i salate.', 'The rabbit likes carrots and lettuce.'),
    'owl': ('Sowa poluje w nocy i ma doskonaly wzrok.', 'An owl hunts at night and has excellent eyesight.'),
    'shark': ('Rekin jest szybkim drapieznikiem morskim.', 'A shark is a fast sea predator.'),
    'penguin': ('Pingwiny zyja w zimnym klimacie.', 'Penguins live in a cold climate.'),
    'arm': ('Boli mnie reka po dlugim treningu.', 'My arm hurts after the long training.'),
    'back': ('Bola mnie plecy od noszenia ciezkiego plecaka.', 'My back hurts from carrying a heavy backpack.'),
    'head': ('Bolala mnie glowa po calym dniu nauki.', 'My head hurt after a whole day of studying.'),
    'leg': ('Zlamal noge podczas jazdy na nartach.', 'He broke his leg while skiing.'),
    'hand': ('Podaj mi dlon i pomoz mi wstac.', 'Give me your hand and help me get up.'),
    'foot': ('Boli mnie stopa po dlugim marszu.', 'My foot hurts after the long walk.'),
    'knee': ('Zadrapalem kolano podczas gry w pilke.', 'I scratched my knee while playing football.'),
    'mouth': ('Otworz usta i powiedz aaa u dentysty.', 'Open your mouth and say aah at the dentist.'),
    'nose': ('Mam katar ciagle musze wycierac nos.', 'I have a cold I keep wiping my nose.'),
    'teeth': ('Myj zeby dwa razy dziennie.', 'Brush your teeth twice a day.'),
    'neck': ('Mam sztywna szyje od siedzenia przy komputerze.', 'I have a stiff neck from sitting at the computer.'),
    'shoulder': ('Boli mnie ramie po grze w tenisa.', 'My shoulder hurts after playing tennis.'),
    'advice': ('Mama dala mi dobra rade przed egzaminem.', 'Mum gave me good advice before the exam.'),
    'friendship': ('Przyjazn jest jedna z najwazniejszych wartosci.', 'Friendship is one of the most important values.'),
    'present': ('Dostalem super prezent na Gwiazdke.', 'I got a great present for Christmas.'),
    'birthday': ('Moje urodziny sa w maju tego roku.', 'My birthday is in May this year.'),
    'favourite': ('Moj ulubiony kolor to niebieski.', 'My favourite colour is blue.'),
    'interesting': ('Ta ksiazka jest bardzo interesujaca.', 'This book is very interesting.'),
    'important': ('Nauka angielskiego jest bardzo wazna dzisiaj.', 'Learning English is very important today.'),
    'new': ('Mam nowy rower od rodzicow na urodziny.', 'I have a new bike from my parents for my birthday.'),
    'old': ('Nasza szkola jest stara ale piekna.', 'Our school is old but beautiful.'),
    'big': ('Nasz ogrod jest duzy i pelen kwiatow.', 'Our garden is big and full of flowers.'),
    'small': ('Moj pokoj jest maly ale przytulny.', 'My room is small but cosy.'),
    'easy': ('To zadanie jest latwe i szybko je rozwiaze.', 'This task is easy and I will solve it quickly.'),
    'difficult': ('Matematyka jest trudna ale lubie ja.', 'Maths is difficult but I like it.'),
    'fast': ('Ten pociag jest bardzo szybki.', 'This train is very fast.'),
    'slow': ('Zolw porusza sie bardzo wolno po trawie.', 'The tortoise moves very slowly on the grass.'),
    'beautiful': ('Zachod slonca byl piekny nad morzem.', 'The sunset was beautiful over the sea.'),
    'safe': ('Ta okolica jest bezpieczna dla dzieci.', 'This area is safe for children.'),
    'great': ('To byl swietny mecz pilki noznej.', 'It was a great football match.'),
}

def gen_sentence(pl, en, book_id):
    en_clean = en.strip()
    en_lower = en_clean.lower()

    # Check specific dictionary
    for key in [en_clean, en_lower, en_lower.split('/')[0].strip(), en_lower.split(' / ')[0].strip()]:
        if key in S:
            return S[key]

    pl_lower = pl.lower().strip()

    # Verb phrases
    verb_starts = ['go ', 'do ', 'get ', 'have ', 'make ', 'take ', 'play ', 'be ', 'buy ', 'check ', 'save ', 'turn ', 'put ', 'set ', 'look ', 'keep ', 'pay ', 'spend ', 'break ', 'fall ', 'feel ', 'call ', 'stay ', 'join ', 'sign ', 'hand ', 'leave ', 'ride ', 'sleep ', 'swim ', 'climb ', 'explore ', 'watch ', 'listen ', 'brush ', 'meet ', 'help ', 'tidy ', 'use ', 'load ', 'unload ', 'close ', 'open ', 'wash ', 'water ', 'feed ', 'clear ', 'cook ', 'boil ', 'chop ', 'fry ', 'mix ', 'slice ', 'add ', 'steam ', 'serve ', 'limit ', 'manage ', 'study ', 'recycle ', 'download ', 'upload ', 'install ', 'forward ', 'log ', 'delete ', 'send ', 'click ', 'press ', 'swipe ', 'tap ', 'type ', 'search ', 'share ', 'post ', 'enter ', 'connect ', 'print ', 'read ', 'write ', 'run ', 'draw ', 'paint ', 'dance ', 'sing ', 'wear ', 'bring ', 'clean ', 'vacuum ', 'iron ', 'sweep ', 'dust ', 'try ', 'order ', 'invite ', 'win ', 'lose ', 'train ', 'record ', 'shoot ', 'sort ', 'throw ', 'start ', 'stop ']
    if any(en_lower.startswith(v) for v in verb_starts):
        tpls = [
            (f'Lubie {pl_lower} w wolnym czasie.', f'I like to {en_lower} in my free time.'),
            (f'Musisz {pl_lower} przed wyjsciem.', f'You need to {en_lower} before leaving.'),
            (f'Codziennie staram sie {pl_lower}.', f'I try to {en_lower} every day.'),
            (f'Warto {pl_lower} regularnie.', f'It is good to {en_lower} regularly.'),
            (f'Nauczyciel poprosil nas zeby {pl_lower}.', f'The teacher asked us to {en_lower}.'),
        ]
        return tpls[hash(en) % len(tpls)]

    # Adjective-like
    adj_ends = ['ful', 'ous', 'ive', 'ant', 'ent', 'ble', 'ary', 'ory', 'ish', 'ical', 'tic', 'nal', 'lar', 'ern', 'less', 'able', 'ible', 'al']
    short_adj = ['shy', 'kind', 'nice', 'rude', 'mean', 'lazy', 'slim', 'tall', 'warm', 'cool', 'dark', 'long', 'new', 'old', 'big', 'bad', 'sad', 'hot', 'cold', 'deep', 'high', 'flat', 'safe', 'rich', 'poor', 'free', 'cute', 'ugly', 'bold', 'calm', 'soft', 'loud', 'wild', 'weak', 'thin', 'wet', 'dry', 'raw', 'fit', 'ill', 'dull']
    if (any(en_lower.endswith(e) for e in adj_ends) or en_lower in short_adj) and ' ' not in en_lower:
        tpls = [
            (f'Moj przyjaciel jest bardzo {pl_lower}.', f'My friend is very {en_lower}.'),
            (f'Ten film byl naprawde {pl_lower}.', f'This film was really {en_lower}.'),
            (f'Nowa uczennica jest bardzo {pl_lower}.', f'The new student is very {en_lower}.'),
            (f'Pogoda dzisiaj jest dosc {pl_lower}.', f'The weather today is quite {en_lower}.'),
        ]
        return tpls[hash(en) % len(tpls)]

    # -ing gerunds
    if en_lower.endswith('ing') and ' ' not in en_lower:
        tpls = [
            (f'Lubie {pl_lower} w wolnym czasie.', f'I enjoy {en_lower} in my free time.'),
            (f'{pl.capitalize()} to moje ulubione hobby.', f'{en.capitalize()} is my favourite hobby.'),
            (f'{pl.capitalize()} relaksuje mnie po ciezkim dniu.', f'{en.capitalize()} relaxes me after a hard day.'),
        ]
        return tpls[hash(en) % len(tpls)]

    # Abstract nouns
    if any(en_lower.endswith(e) for e in ['tion', 'ment', 'ness', 'ence', 'ance', 'ity', 'ure', 'ism']):
        tpls = [
            (f'{pl.capitalize()} jest wazna w codziennym zyciu.', f'{en.capitalize()} is important in everyday life.'),
            (f'{pl.capitalize()} wymaga duzo pracy i wysilku.', f'{en.capitalize()} requires a lot of work and effort.'),
        ]
        return tpls[hash(en) % len(tpls)]

    # Adverbs
    if en_lower.endswith('ly') and ' ' not in en_lower:
        return (f'Pracowalem {pl_lower} nad projektem szkolnym.', f'I worked {en_lower} on the school project.')

    # Single-word nouns
    if ' ' not in en:
        tpls = [
            (f'{pl.capitalize()} jest potrzebna w szkole.', f'A {en_lower} is needed at school.'),
            (f'Widzialem {pl_lower} w sklepie obok szkoly.', f'I saw a {en_lower} in the shop near school.'),
            (f'Potrzebuje {pl_lower} do mojego projektu.', f'I need a {en_lower} for my project.'),
            (f'{pl.capitalize()} lezy na biurku w moim pokoju.', f'The {en_lower} is on the desk in my room.'),
        ]
        return tpls[hash(en) % len(tpls)]

    # Multi-word phrases
    tpls = [
        (f'{pl.capitalize()} jest popularna w naszej szkole.', f'{en.capitalize()} is popular at our school.'),
        (f'Duzo ludzi interesuje sie {pl_lower}.', f'Many people are interested in {en_lower}.'),
        (f'Chcialbym sie dowiedziec wiecej o {pl_lower}.', f'I would like to learn more about {en_lower}.'),
    ]
    return tpls[hash(en) % len(tpls)]


def main():
    all_words = load_words_from_json()
    out_path = os.path.join(BASE, 'sentences-advanced.sql')
    total = 0

    with open(out_path, 'w', encoding='utf-8') as out:
        out.write("-- Generated example sentences for vocabulary words\n")
        out.write("-- Books: brainy6, brainy7, together4, together5, together6, newpassword, czasowniki, englishA1\n\n")

        for book_id in ['brainy6', 'brainy7', 'together4', 'together5', 'together6', 'newpassword', 'czasowniki', 'englishA1']:
            words = all_words.get(book_id, [])
            out.write(f"\n-- === {book_id} ({len(words)} words) ===\n\n")

            for pl, en in words:
                if book_id == 'together6' and any(en.startswith(p) for p in ['la ', 'le ', 'les ', 'un ', 'une ']):
                    continue

                word_pl = esc(pl)

                if is_sentence(pl, en) or is_long_phrase(pl, en):
                    s_pl = esc(pl)
                    s_en = esc(en)
                elif is_number(pl):
                    s_pl = esc(f'W mojej klasie jest {pl} uczniow.')
                    s_en = esc(f'There are {en} students in my class.')
                elif book_id == 'czasowniki' and ', ' in en:
                    base = en.split(', ')[0].strip()
                    if base in VERB_SENTENCES:
                        s_pl, s_en = VERB_SENTENCES[base]
                        s_pl = esc(s_pl)
                        s_en = esc(s_en)
                    else:
                        sp, se = gen_sentence(pl, en, book_id)
                        s_pl = esc(sp)
                        s_en = esc(se)
                else:
                    sp, se = gen_sentence(pl, en, book_id)
                    s_pl = esc(sp)
                    s_en = esc(se)

                out.write(f"INSERT INTO word_sentences (book_id, word_pl, sentence_pl, sentence_target)\n")
                out.write(f"VALUES ('{book_id}', '{word_pl}', '{s_pl}', '{s_en}')\n")
                out.write(f"ON CONFLICT (book_id, word_pl) DO NOTHING;\n\n")
                total += 1

    print(f"Generated {total} SQL INSERT statements to: {out_path}")

if __name__ == '__main__':
    main()
