/* ============================================================
   SOWIE FISZKI — Egzaminy: dane (zagadnienia + teoria + ćwiczenia)
   Teoria współdzielona przez klucz (TH[key]) — E8 i Matura wskazują
   na to samo hasło. Kolejne zagadnienia dopisujemy w obiekcie TH.
   ============================================================ */
(function () {
  'use strict';

  const lead = t => `<p class="th-lead">▶️ ${t}</p>`;
  const h = t => `<h4 class="th-h">${t}</h4>`;
  const ul = arr => `<ul class="th-ul">${arr.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const ex = (en, pl) => `<div class="th-ex"><span class="th-en">⏺️ ${en}</span><span class="th-pl">📌 ${pl}</span></div>`;
  const tip = t => `<div class="th-tip">🧠 ${t}</div>`;
  const form = rows => `<div class="th-form">${rows.map(r => `<div class="th-form-row">${r}</div>`).join('')}</div>`;

  const TH = {};
  const G = (t, sub, html, exs) => ({ t, sub, html, ex: exs || [] });

  // ═══ CZASOWNIK — podstawy ═══
  TH['have-got'] = G('Czasownik „have got / have"', 'posiadanie — „mieć"',
    lead('„have got" i „have" znaczą <b>mieć</b> (posiadać). „have got" jest częstsze w mowie i w brytyjskim angielskim.') +
    h('Forma — have got') + form(['✅ 👤 + <b>have/has got</b> + …', '❌ 👤 + <b>haven\'t/hasn\'t got</b> + …', '❓ <b>Have/Has</b> + 👤 + <b>got</b> + …?']) +
    ul(['<b>I / you / we / they</b> → have got (\'ve got)', '<b>he / she / it</b> → has got (\'s got)']) +
    h('Przykłady') + ex('I\'ve got a dog.', 'Mam psa.') + ex('She has got two brothers.', 'Ona ma dwóch braci.') + ex('They haven\'t got a car.', 'Oni nie mają samochodu.') +
    h('„have" (bez „got")') + lead('Zwykłe „have" — pytania i przeczenia z <b>do/does</b>.') + ex('Do you have a dog?  She doesn\'t have a car.', 'Czy masz psa? Ona nie ma samochodu.') +
    tip('Krótkie odpowiedzi: <i>Yes, I have. / No, I haven\'t.</i>'),
    [{ type: 'gap', q: 'She ____ got a new phone. (✓)', a: 'has' }, { type: 'gap', q: 'They ____ got any money. (✗)', a: "haven't" }, { type: 'mc', q: '____ you got a bike?', opts: ['Have', 'Has', 'Do'], a: 'Have' }]);

  TH['infinitive'] = G('Bezokolicznik i formy osobowe', 'to work · works · worked',
    h('🔹 Bezokolicznik (infinitive)') + lead('Podstawowa forma: <b>to + czasownik</b> — nie mówi kto ani kiedy.') +
    ul(['<b>to</b> + czasownik → <i>to go, to eat</i>', 'Bez „to" po modalnych → <i>can go, must study</i>']) +
    ex('I want to work in a big company.', 'Chcę pracować w dużej firmie.') +
    lead('Czasowniki z „to": <i>want, decide, hope, plan, promise, learn, need, agree, would like</i>.') +
    h('🔹 Forma osobowa (finite)') + lead('Zmienia się zależnie od <b>osoby</b> i <b>czasu</b>.') + ul(['3. os. l.poj. (he/she/it) w Present Simple → <b>-s/-es</b>']) +
    ex('She works in a bank.', 'Ona pracuje w banku.') + tip('Modalne (can, must, should, will) → zawsze bez „to".'),
    [{ type: 'mc', q: 'I want ____ English.', opts: ['learn', 'to learn', 'learning'], a: 'to learn' }, { type: 'mc', q: 'You must ____ your homework.', opts: ['to do', 'do', 'doing'], a: 'do' }]);

  TH['aux'] = G('Czasowniki posiłkowe', 'be, do, have',
    lead('Czasowniki posiłkowe pomagają tworzyć <b>pytania, przeczenia i czasy</b> — same często nic nie znaczą.') +
    h('be') + ul(['czasy continuous: <i>She <b>is</b> working.</i>', 'strona bierna: <i>It <b>was</b> made in China.</i>']) +
    h('do / does / did') + ul(['pytania i przeczenia w Present/Past Simple: <i><b>Do</b> you like it? I <b>don\'t</b> know. <b>Did</b> he go?</i>']) +
    h('have / has / had') + ul(['czasy perfect: <i>I <b>have</b> finished. She <b>had</b> left.</i>']) +
    tip('W krótkich odpowiedziach powtarzamy posiłkowy: <i>Yes, I do. / No, she isn\'t.</i>'),
    [{ type: 'mc', q: '____ you like pizza?', opts: ['Do', 'Are', 'Have'], a: 'Do' }, { type: 'gap', q: 'She ____ working now. (be)', a: 'is' }]);

  const modal = (name, uses, forms, kw, exs, exx) => G('Czasownik modalny: ' + name.toUpperCase(), 'modal verb',
    h('Użycie') + ul(uses) + h('Forma') + form(forms) +
    '<p class="th-star">⭐ Jedna forma dla wszystkich osób (I/he/she/it/we/you/they ' + name + ').</p>' +
    h('Przykłady') + exs.map(e => ex(e[0], e[1])).join('') + (kw ? tip(kw) : ''), exx);

  TH['can'] = modal('can', ['Umiejętności — co ktoś potrafi', 'Pozwolenie', 'Możliwość'],
    ['✅ 👤 + <b>CAN</b> + czasownik', '❌ 👤 + <b>CAN\'T</b> + czasownik', '❓ <b>CAN</b> + 👤 + czasownik …?'],
    'Krótko: <i>Yes, I can. / No, I can\'t.</i>',
    [['I can swim.', 'Umiem pływać.'], ['Can you help me?', 'Czy możesz mi pomóc?'], ['They can\'t come.', 'Oni nie mogą przyjść.']],
    [{ type: 'mc', q: '____ you help me?', opts: ['Can', 'Cans', 'Do can'], a: 'Can' }, { type: 'gap', q: 'She ____ speak French. (potrafi)', a: 'can' }]);

  TH['could'] = modal('could', ['Umiejętność w przeszłości', 'Uprzejma prośba', 'Możliwość'],
    ['✅ 👤 + <b>COULD</b> + czasownik', '❌ 👤 + <b>COULDN\'T</b> + czasownik', '❓ <b>COULD</b> + 👤 + czasownik …?'],
    '„Could you…?" jest grzeczniejsze niż „Can you…?".',
    [['I could read when I was six.', 'Umiałem czytać, gdy miałem sześć lat.'], ['Could you speak more slowly?', 'Czy mógłbyś mówić wolniej?']],
    [{ type: 'mc', q: '____ you pass the salt, please?', opts: ['Could', 'Do', 'May to'], a: 'Could' }, { type: 'gap', q: 'When I was young, I ____ run fast.', a: 'could' }]);

  TH['may'] = modal('may', ['Prośba o pozwolenie (formalnie)', 'Możliwość / przypuszczenie (może)'],
    ['✅ 👤 + <b>MAY</b> + czasownik', '❌ 👤 + <b>MAY NOT</b> + czasownik', '❓ <b>MAY</b> + 👤 + czasownik …?'],
    '„May I…?" to bardzo grzeczna prośba.',
    [['May I speak to Sam?', 'Czy mogę rozmawiać z Samem?'], ['It may rain later.', 'Może później padać.']],
    [{ type: 'mc', q: '____ I open the window?', opts: ['May', 'May to', 'Do may'], a: 'May' }, { type: 'gap', q: 'She ____ be at work. (może)', a: 'may' }]);

  TH['might'] = modal('might', ['Możliwość — coś jest mniej pewne niż przy „may"'],
    ['✅ 👤 + <b>MIGHT</b> + czasownik', '❌ 👤 + <b>MIGHT NOT</b> + czasownik'],
    '„might" = trochę mniejsze prawdopodobieństwo niż „may".',
    [['They might be a little late.', 'Mogą się trochę spóźnić.'], ['I might go to the party.', 'Może pójdę na imprezę.']],
    [{ type: 'gap', q: 'It\'s cloudy — it ____ rain. (może, mniej pewne)', a: 'might' }]);

  TH['must'] = modal('must', ['Obowiązek / konieczność (muszę)', 'Zakaz — mustn\'t (nie wolno)', 'Pewność / wniosek (na pewno)'],
    ['✅ 👤 + <b>MUST</b> + czasownik', '❌ 👤 + <b>MUSTN\'T</b> + czasownik', '❓ <b>MUST</b> + 👤 + czasownik …?'],
    '<b>mustn\'t</b> = zakaz (nie wolno) — to NIE to samo co <b>don\'t have to</b> (nie musisz).',
    [['I must finish it today.', 'Muszę to dzisiaj skończyć.'], ['You mustn\'t smoke here.', 'Nie wolno tu palić.'], ['It must be cold outside.', 'Na pewno jest zimno.']],
    [{ type: 'mc', q: 'You ____ touch it — danger! (zakaz)', opts: ['mustn\'t', 'don\'t have to', 'may not'], a: 'mustn\'t' }, { type: 'gap', q: 'I ____ finish this today. (obowiązek)', a: 'must' }]);

  TH['should'] = G('Czasownik modalny: SHOULD / ought to', 'rady i sugestie',
    h('Użycie') + ul(['Rady i sugestie — co warto zrobić', 'Opinie — co jest słuszne', 'Oczekiwania — coś powinno się wydarzyć']) +
    h('Forma') + form(['✅ 👤 + <b>SHOULD</b> + czasownik', '❌ 👤 + <b>SHOULDN\'T</b> + czasownik', '❓ <b>SHOULD</b> + 👤 + czasownik …?']) +
    '<p class="th-star">⭐ Jedna forma dla wszystkich osób.</p>' +
    h('ought to') + lead('<b>ought to</b> znaczy prawie to samo co „should" (ma „to"!).') + ex('You ought to be home by 10.', 'Powinieneś być w domu do 22.') +
    h('Przykłady') + ex('You should study more.', 'Powinieneś się więcej uczyć.') + ex('You shouldn\'t do it.', 'Nie powinieneś tego robić.') +
    tip('Forma przeszła: <i>You should have studied.</i> — Powinieneś był się uczyć.'),
    [{ type: 'mc', q: 'You look tired. You ____ rest.', opts: ['should', 'shouldn\'t', 'mustn\'t'], a: 'should' }, { type: 'gap', q: 'It\'s a museum — you ____ take photos. (nie powinieneś)', a: 'shouldn\'t' }]);

  TH['will-m'] = modal('will', ['Decyzje w chwili mówienia', 'Obietnice, propozycje, prośby', 'Przewidywania'],
    ['✅ 👤 + <b>WILL</b> + czasownik', '❌ 👤 + <b>WON\'T</b> + czasownik', '❓ <b>WILL</b> + 👤 + czasownik …?'],
    'Skróty: I\'ll, he\'ll, won\'t.',
    [['I will study harder this year.', 'W tym roku będę się bardziej uczyć.'], ['I promise I won\'t do that again.', 'Obiecuję, że już tego nie zrobię.']],
    [{ type: 'mc', q: '____ you help me, please?', opts: ['Will', 'Do', 'Are'], a: 'Will' }]);

  TH['shall'] = modal('shall', ['Propozycje i oferty (Shall I…? / Shall we…?)', 'Formalne — obietnice, przepisy'],
    ['❓ <b>SHALL</b> + I/we + czasownik …?'],
    '„shall" używamy głównie z I/we w pytaniach-propozycjach.',
    [['Shall we go to the seaside?', 'Może pojedziemy nad morze?'], ['Shall I help you?', 'Czy mam ci pomóc?']],
    [{ type: 'mc', q: '____ I open the window for you?', opts: ['Shall', 'Will to', 'Do'], a: 'Shall' }]);

  TH['would-m'] = modal('would', ['Grzeczne oferty i prośby (Would you…?)', 'Sytuacje hipotetyczne (2. okres warunkowy)', 'Dawne nawyki (jak used to)'],
    ['✅ 👤 + <b>WOULD</b> + czasownik', '❌ 👤 + <b>WOULDN\'T</b> + czasownik'],
    'Skrót: \'d (I\'d, he\'d).',
    [['Would you like some tea?', 'Czy chciałbyś herbaty?'], ['It would be a good idea.', 'To byłby dobry pomysł.'], ['I wouldn\'t like to be in his place.', 'Nie chciałbym być na jego miejscu.']],
    [{ type: 'mc', q: '____ you like some coffee?', opts: ['Would', 'Do', 'Are'], a: 'Would' }]);

  TH['need-m'] = G('need / need to', 'potrzeba / konieczność',
    lead('<b>need to</b> = musieć, potrzebować (zwykły czasownik). <b>needn\'t</b> = nie musieć.') +
    h('Forma') + form(['✅ 👤 + <b>need to</b> + czasownik', '❌ 👤 + <b>don\'t/doesn\'t need to</b> / <b>needn\'t</b> + czasownik']) +
    h('Przykłady') + ex('You needn\'t worry about it.', 'Nie musisz się tym martwić.') + ex('You don\'t need to go there.', 'Nie musisz tam iść.'),
    [{ type: 'mc', q: 'It\'s free — you ____ pay.', opts: ['needn\'t', 'must', 'need'], a: 'needn\'t' }]);

  TH['used-to'] = G('used to', 'dawne zwyczaje i stany',
    lead('<b>used to</b> = kiedyś (regularnie), ale już nie. Mówi o przeszłych nawykach i stanach.') +
    h('Forma') + form(['✅ 👤 + <b>used to</b> + czasownik', '❌ 👤 + <b>didn\'t use to</b> + czasownik', '❓ <b>Did</b> + 👤 + <b>use to</b> + czasownik …?']) +
    h('Przykłady') + ex('We used to go to the seaside every weekend.', 'Kiedyś jeździliśmy nad morze w każdy weekend.') + ex('I didn\'t use to like coffee.', 'Kiedyś nie lubiłem kawy.') +
    tip('W przeczeniu i pytaniu: <b>use to</b> (bez -d), bo jest „did".'),
    [{ type: 'gap', q: 'She ____ to have long hair. (kiedyś miała)', a: 'used' }]);

  TH['be-able-to'] = G('be able to', 'umieć / być w stanie',
    lead('<b>be able to</b> = umieć, być w stanie. Używamy tam, gdzie „can" nie ma formy (np. przyszłość, perfect).') +
    h('Formy') + ul(['teraz: <i>am/is/are able to</i>', 'przeszłość: <i>was/were able to</i>', 'przyszłość: <i>will be able to</i>']) +
    h('Przykłady') + ex('Will you be able to do it tomorrow?', 'Czy będziesz w stanie zrobić to jutro?') + ex('I wasn\'t able to help them.', 'Nie byłem w stanie im pomóc.'),
    [{ type: 'mc', q: 'Tomorrow I ____ able to come.', opts: ['will be', 'can', 'am can'], a: 'will be' }]);

  TH['be-going-to'] = G('Konstrukcja „be going to"', 'plany i przewidywania',
    h('Kiedy?') + ul(['Plany i zamiary (zaplanowane wcześniej)', 'Przewidywania na podstawie tego, co widać']) +
    h('Budowa') + form(['✅ 👤 + <b>am/is/are going to</b> + czasownik', '❌ … <b>not</b> going to …', '❓ <b>Am/Is/Are</b> + 👤 + going to …?']) +
    h('Przykłady') + ex('I\'m going to give a party on Saturday.', 'Zamierzam wydać przyjęcie w sobotę.') + ex('Look at those clouds! It\'s going to rain.', 'Popatrz na chmury! Będzie padać.'),
    [{ type: 'gap', q: 'She ____ going to visit her aunt.', a: 'is' }, { type: 'mc', q: 'Look! He ____ going to fall!', opts: ['is', 'are', 'will'], a: 'is' }]);

  TH['have-to'] = G('Konstrukcja „have to"', 'przymus (często z zewnątrz)',
    lead('<b>have to</b> = musieć (reguły, przepisy). <b>don\'t have to</b> = nie musieć (to NIE zakaz!).') +
    h('Budowa') + form(['✅ 👤 + <b>have/has to</b> + czasownik', '❌ 👤 + <b>don\'t/doesn\'t have to</b> + czasownik', '❓ <b>Do/Does</b> + 👤 + <b>have to</b> …?']) +
    h('Przykłady') + ex('He has to go there.', 'On musi tam pójść.') + ex('I don\'t have to do it.', 'Nie muszę tego robić.') + tip('Przeszłość: <b>had to</b> / <b>didn\'t have to</b>.'),
    [{ type: 'gap', q: 'She ____ to get up early. (he/she)', a: 'has' }, { type: 'mc', q: 'It\'s Sunday — we ____ go to school.', opts: ['don\'t have to', 'mustn\'t', 'haven\'t'], a: 'don\'t have to' }]);

  TH['would-like-to'] = G('Konstrukcja „would like to"', 'grzeczne „chciałbym"',
    lead('<b>would like (to)</b> = chciałbym — grzeczniej niż „want".') +
    h('Budowa') + form(['✅ 👤 + <b>would like to</b> + czasownik / + rzeczownik', '❓ <b>Would you like</b> …?']) +
    h('Przykłady') + ex('I would like to meet him.', 'Chciałbym go poznać.') + ex('Would you like some tea?', 'Czy chciałbyś herbaty?') + tip('Skrót: \'d like.'),
    [{ type: 'mc', q: '____ you like a coffee?', opts: ['Would', 'Do', 'Are'], a: 'Would' }]);

  TH['imperative'] = G('Tryb rozkazujący', 'polecenia i zakazy',
    lead('Tryb rozkazujący = polecenie, prośba, rada, zakaz. Używamy <b>samego bezokolicznika (bez „to")</b>, bez podmiotu.') +
    h('Forma') + form(['✅ czasownik + … → <i>Come here!</i>', '❌ <b>Don\'t</b> + czasownik → <i>Don\'t touch that!</i>', 'grzeczniej: <i>Please, sit down. / Sit down, please.</i>']) +
    h('Przykłady') + ex('Open your books.', 'Otwórzcie książki.') + ex('Don\'t be late!', 'Nie spóźnij się!') + ex('Let\'s go!', 'Chodźmy! (propozycja)'),
    [{ type: 'mc', q: '____ touch that — it\'s hot!', opts: ['Don\'t', 'No', 'Not'], a: 'Don\'t' }, { type: 'gap', q: '____ quiet, please! (Bądź cicho)', a: 'Be' }]);

  TH['reg-irreg'] = G('Czasowniki regularne i nieregularne', 'work–worked · go–went–gone',
    h('Regularne') + lead('Formę przeszłą i imiesłów bierny tworzymy przez <b>-ed</b>.') + ul(['work → work<b>ed</b> → work<b>ed</b>', 'play → play<b>ed</b>']) +
    h('Nieregularne') + lead('Trzeba znać <b>trzy formy</b> na pamięć.') + ul(['go → went → gone', 'see → saw → seen', 'buy → bought → bought', 'do → did → done']) +
    tip('II forma → Past Simple. III forma → Present Perfect i strona bierna.'),
    [{ type: 'gap', q: 'go → ____ → gone (Past Simple)', a: 'went' }, { type: 'gap', q: 'They ____ (buy) a car last week.', a: 'bought' }]);

  TH['participles'] = G('Imiesłów czynny i bierny', 'speaking · spoken',
    h('Imiesłów czynny (-ing)') + lead('Forma <b>-ing</b> — czasy continuous, przymiotniki, konstrukcje.') + ex('She is speaking.', 'Ona mówi.') + ex('a crying baby', 'płaczące dziecko') +
    h('Imiesłów bierny (III forma)') + lead('Forma <b>past participle</b> — perfect i strona bierna.') + ex('The letter was written by Tom.', 'List został napisany przez Toma.') + ex('a broken window', 'zbite okno'),
    [{ type: 'gap', q: 'Look at that ____ (cry) child.', a: 'crying' }, { type: 'gap', q: 'The window was ____ (break). (III forma)', a: 'broken' }]);

  TH['state'] = G('Czasowniki wyrażające stany', 'state verbs',
    lead('Czasowniki stanu opisują <b>stany, uczucia, myśli</b> — zwykle <b>NIE używamy ich w formie -ing</b>.') +
    h('Najczęstsze') + ul(['uczucia: <i>like, love, hate, want, prefer</i>', 'myśli: <i>know, understand, believe, think (=sądzić), remember</i>', 'zmysły: <i>see, hear, smell, taste</i>', 'inne: <i>have (=mieć), be, need, belong</i>']) +
    h('Przykłady') + ex('I want to be a singer.', 'Chcę być piosenkarzem.') + ex('I see what you mean.', 'Rozumiem, o co ci chodzi.') +
    tip('Nie: <i>I am wanting</i>. Poprawnie: <i>I want</i>.'),
    [{ type: 'mc', q: 'I ____ this song. (teraz, stan)', opts: ['like', 'am liking'], a: 'like' }]);

  TH['phrasal'] = G('Czasowniki złożone (phrasal verbs)', 'get up, look for, break down',
    lead('Phrasal verb = czasownik + partykuła (przyimek/przysłówek). Razem mają <b>nowe znaczenie</b>.') +
    h('Przykłady') + ul(['<b>get up</b> — wstawać', '<b>look for</b> — szukać', '<b>break down</b> — zepsuć się', '<b>turn down</b> — ściszyć', '<b>come up with</b> — wymyślić', '<b>look after</b> — opiekować się']) +
    ex('What are you looking for?', 'Czego szukasz?') + ex('Turn the radio down, please.', 'Ścisz radio, proszę.') +
    tip('Znaczenia trzeba zapamiętywać jako całość — nie tłumacz dosłownie.'),
    [{ type: 'mc', q: 'I ____ up at 7 every day.', opts: ['get', 'stand', 'wake up up'], a: 'get' }, { type: 'gap', q: 'She is ____ for her keys. (szuka)', a: 'looking' }]);

  // ═══ CZASY ═══
  const tense = (name, use, forms, signals, exs, tipTxt, exx) => G(name, 'czas gramatyczny',
    h('Kiedy używamy?') + ul(use) + h('Budowa') + form(forms) +
    (signals ? h('Słowa-sygnały') + `<p class="th-signal">${signals}</p>` : '') +
    h('Przykłady') + exs.map(e => ex(e[0], e[1])).join('') + (tipTxt ? tip(tipTxt) : ''), exx);

  TH['present-simple'] = tense('Present Simple', ['Rutyna, nawyki', 'Fakty i prawdy ogólne', 'Rozkłady jazdy / plany'],
    ['✅ 👤 + czasownik (+<b>s/es</b> dla he/she/it)', '❌ 👤 + <b>don\'t/doesn\'t</b> + czasownik', '❓ <b>Do/Does</b> + 👤 + czasownik …?'],
    'always, usually, often, sometimes, never, every day',
    [['She often visits her grandparents.', 'Ona często odwiedza dziadków.'], ['Water boils at 100°C.', 'Woda wrze w 100°C.'], ['Does he play tennis?', 'Czy on gra w tenisa?']],
    'Pamiętaj o <b>-s/-es</b> w 3. os. l.poj.: he play<b>s</b>, she watch<b>es</b>.',
    [{ type: 'gap', q: 'He ____ (go) to school by bus.', a: 'goes' }, { type: 'mc', q: '____ she like pizza?', opts: ['Do', 'Does', 'Is'], a: 'Does' }, { type: 'gap', q: 'They ____ (not/watch) TV.', a: "don't watch" }]);

  TH['present-continuous'] = tense('Present Continuous', ['Czynność TERAZ', 'Czynność tymczasowa', 'Ustalone plany na przyszłość'],
    ['✅ 👤 + <b>am/is/are</b> + czasownik-<b>ing</b>', '❌ … am/is/are <b>not</b> …', '❓ <b>Am/Is/Are</b> + 👤 + …ing …?'],
    'now, at the moment, right now, Look!, Listen!',
    [['She is working in the garden now.', 'Ona teraz pracuje w ogrodzie.'], ['Look! It\'s raining.', 'Patrz! Pada.'], ['We\'re meeting Tom tomorrow.', 'Spotykamy się jutro z Tomem.']],
    'Pisownia: run → run<b>ning</b>, make → mak<b>ing</b>.',
    [{ type: 'gap', q: 'Listen! The baby ____ (cry).', a: 'is crying' }, { type: 'mc', q: 'What ____ you doing now?', opts: ['are', 'is', 'do'], a: 'are' }]);

  TH['present-perfect'] = tense('Present Perfect', ['Przeszłość z wynikiem TERAZ', 'Doświadczenia (kiedykolwiek)', 'Czynność trwająca od jakiegoś czasu'],
    ['✅ 👤 + <b>have/has</b> + III forma', '❌ 👤 + <b>haven\'t/hasn\'t</b> + III forma', '❓ <b>Have/Has</b> + 👤 + III forma …?'],
    'just, already, yet, ever, never, since, for',
    [['I\'ve just seen my teacher.', 'Właśnie widziałem nauczyciela.'], ['She has lived here since 2019.', 'Ona mieszka tu od 2019.'], ['Have you ever been to London?', 'Czy byłeś kiedyś w Londynie?']],
    '<b>for</b> + okres (for two years), <b>since</b> + punkt (since Monday).',
    [{ type: 'gap', q: 'I ____ (finish) my homework. (już)', a: 'have finished' }, { type: 'mc', q: 'She has lived here ____ 2020.', opts: ['for', 'since', 'from'], a: 'since' }]);

  TH['present-perfect-continuous'] = tense('Present Perfect Continuous', ['Czynność zaczęta w przeszłości i trwająca do teraz', 'Podkreśla DŁUGOŚĆ trwania', 'Skutek widoczny teraz'],
    ['✅ 👤 + <b>have/has been</b> + czasownik-<b>ing</b>', '❓ <b>Have/Has</b> + 👤 + <b>been</b> + …ing …?'],
    'for, since, how long, all day, lately',
    [['We have been waiting here for ages!', 'Czekamy tu od wieków!'], ['How long have you been living here?', 'Jak długo tu mieszkasz?'], ['Have you been crying?', 'Czy płakałeś?']],
    'Podkreśla proces/czas trwania (nie wynik jak Present Perfect).',
    [{ type: 'gap', q: 'I ____ been ____ (wait) for an hour.', a: 'have waiting', hint: 'have been waiting' }]);

  TH['past-simple'] = tense('Past Simple', ['Zakończona czynność (kiedy?)', 'Ciąg wydarzeń', 'Zwyczaje z przeszłości'],
    ['✅ 👤 + czasownik-<b>ed</b> / II forma', '❌ 👤 + <b>didn\'t</b> + czasownik', '❓ <b>Did</b> + 👤 + czasownik …?'],
    'yesterday, last week, in 1492, two days ago',
    [['Columbus discovered America in 1492.', 'Kolumb odkrył Amerykę w 1492.'], ['We didn\'t go out last night.', 'Nie wyszliśmy wczoraj wieczorem.'], ['Did you see the film?', 'Czy widziałeś ten film?']],
    'Nieregularne na pamięć: go → went, see → saw, buy → bought.',
    [{ type: 'gap', q: 'They ____ (buy) a house last year.', a: 'bought' }, { type: 'mc', q: '____ you visit her yesterday?', opts: ['Did', 'Do', 'Were'], a: 'Did' }]);

  TH['past-continuous'] = tense('Past Continuous', ['Czynność trwająca w danym momencie w przeszłości', 'Tło dla krótszej czynności (when/while)', 'Dwie równoległe czynności'],
    ['✅ 👤 + <b>was/were</b> + czasownik-<b>ing</b>', '❌ … wasn\'t/weren\'t …', '❓ <b>Was/Were</b> + 👤 + …ing …?'],
    'at 8 o\'clock, while, when, as, all day',
    [['We were watching TV at ten last night.', 'Wczoraj o 22:00 oglądaliśmy TV.'], ['While I was cooking, the phone rang.', 'Gdy gotowałem, zadzwonił telefon.']],
    '<b>while</b> + Past Continuous, <b>when</b> + Past Simple.',
    [{ type: 'gap', q: 'At 7 p.m. I ____ (have) dinner.', a: 'was having' }, { type: 'mc', q: 'While she ____ reading, I was cooking.', opts: ['was', 'were', 'did'], a: 'was' }]);

  TH['past-perfect'] = tense('Past Perfect', ['Czynność, która zdarzyła się PRZED inną czynnością w przeszłości', 'Wcześniejsza z dwóch przeszłych czynności'],
    ['✅ 👤 + <b>had</b> + III forma', '❌ 👤 + <b>hadn\'t</b> + III forma', '❓ <b>Had</b> + 👤 + III forma …?'],
    'before, after, already, by the time, when',
    [['The train had left before we reached the station.', 'Pociąg odjechał, zanim dotarliśmy na stację.'], ['I felt I had been there before.', 'Czułem, że już tam byłem.']],
    'Past Perfect = „przeszłość w przeszłości".',
    [{ type: 'gap', q: 'When we arrived, the film ____ already ____ (start).', a: 'had started', hint: 'had already started' }]);

  TH['past-perfect-continuous'] = tense('Past Perfect Continuous', ['Czynność trwająca PRZEZ jakiś czas PRZED innym momentem w przeszłości'],
    ['✅ 👤 + <b>had been</b> + czasownik-<b>ing</b>'],
    'for, since, before, how long',
    [['I couldn\'t believe they had been living here for so many years.', 'Nie mogłem uwierzyć, że mieszkali tu tyle lat.']],
    'Podkreśla długość trwania przed punktem w przeszłości.',
    [{ type: 'gap', q: 'She was tired because she ____ been ____ (work).', a: 'had working', hint: 'had been working' }]);

  TH['future-simple'] = tense('Future Simple (will)', ['Decyzje w chwili mówienia', 'Przewidywania', 'Obietnice, propozycje, prośby'],
    ['✅ 👤 + <b>will</b> + czasownik', '❌ 👤 + <b>won\'t</b> + czasownik', '❓ <b>Will</b> + 👤 + czasownik …?'],
    'tomorrow, next week, I think, probably',
    [['I will call you tomorrow.', 'Zadzwonię jutro.'], ['It won\'t rain today.', 'Dziś nie będzie padać.']],
    'Jedna forma dla wszystkich osób. Skróty: I\'ll, won\'t.',
    [{ type: 'gap', q: 'I think it ____ (be) sunny tomorrow.', a: 'will be' }, { type: 'mc', q: '____ you open the door?', opts: ['Will', 'Do', 'Are'], a: 'Will' }]);

  TH['future-continuous'] = tense('Future Continuous', ['Czynność, która BĘDZIE TRWAĆ w danym momencie w przyszłości'],
    ['✅ 👤 + <b>will be</b> + czasownik-<b>ing</b>'],
    'at 5, this time tomorrow',
    [['I\'ll be working at five.', 'O piątej będę pracować.'], ['This time tomorrow we\'ll be flying to Spain.', 'Jutro o tej porze będziemy lecieć do Hiszpanii.']],
    null,
    [{ type: 'gap', q: 'At 8 p.m. I ____ be ____ (watch) a film.', a: 'will watching', hint: 'will be watching' }]);

  TH['future-perfect'] = tense('Future Perfect', ['Czynność, która ZAKOŃCZY SIĘ przed danym momentem w przyszłości'],
    ['✅ 👤 + <b>will have</b> + III forma'],
    'by, by the time, by then, before',
    [['I hope they will have arrived by the evening.', 'Mam nadzieję, że dotrą przed wieczorem.'], ['By 2030 I will have finished my studies.', 'Do 2030 skończę studia.']],
    null,
    [{ type: 'gap', q: 'By Friday I ____ have ____ (finish) the project.', a: 'will finished', hint: 'will have finished' }]);

  TH['future-perfect-continuous'] = tense('Future Perfect Continuous', ['Podkreśla, jak długo czynność będzie trwać do danego momentu w przyszłości'],
    ['✅ 👤 + <b>will have been</b> + czasownik-<b>ing</b>'],
    'for, by … for',
    [['In September I will have been working here for 20 years.', 'We wrześniu miną 20 lat, odkąd tu pracuję.']],
    null,
    [{ type: 'gap', q: 'Next year I ____ have been ____ (live) here for a decade.', a: 'will living', hint: 'will have been living' }]);

  // ═══ RZECZOWNIK ═══
  TH['countable'] = G('Rzeczowniki policzalne i niepoliczalne', 'a cat · rice · money',
    h('Policzalne') + lead('Można policzyć — mają l. pojedynczą i mnogą.') + ul(['a cat / two cats', 'z <b>a/an</b>, liczbą, <b>many, few, some, any</b>']) +
    h('Niepoliczalne') + lead('Nie liczymy — zawsze w l. pojedynczej, bez a/an.') + ul(['rice, water, money, information, advice', 'z <b>much, little, some, any</b>', 'porcje: <i>a glass of water, a piece of advice</i>']) +
    tip('some — w twierdzeniach; any — w pytaniach i przeczeniach.'),
    [{ type: 'mc', q: 'How ____ money have you got?', opts: ['much', 'many'], a: 'much' }, { type: 'mc', q: 'There aren\'t ____ apples.', opts: ['any', 'some', 'much'], a: 'any' }]);

  TH['plural-nouns'] = G('Liczba mnoga rzeczowników', 'a dog – dogs · a woman – women',
    h('Regularna') + ul(['zwykle <b>-s</b>: dog → dogs', '-s, -ss, -sh, -ch, -x → <b>-es</b>: box → boxes', 'spółgłoska + y → <b>-ies</b>: baby → babies', '-f/-fe → <b>-ves</b>: wife → wives']) +
    h('Nieregularna') + ul(['man → men, woman → women', 'child → children, foot → feet', 'tooth → teeth, mouse → mice', 'sheep → sheep, fish → fish (bez zmian)']) +
    tip('Uczy się na pamięć — nieregularnych jest sporo.'),
    [{ type: 'gap', q: 'one child, two ____', a: 'children' }, { type: 'gap', q: 'one box, three ____', a: 'boxes' }]);

  TH['sing-plural-only'] = G('Rzeczowniki tylko poj. lub tylko mn.', 'news · trousers',
    h('Tylko l. pojedyncza') + ul(['news, advice, information, furniture, money', '→ czasownik w l. poj.: <i>The news <b>is</b> good.</i>']) +
    h('Tylko l. mnoga') + ul(['trousers, jeans, glasses, scissors, clothes', '→ czasownik w l. mn.: <i>My jeans <b>are</b> new.</i>', 'liczymy: <i>a pair of trousers</i>']),
    [{ type: 'mc', q: 'The news ____ good today.', opts: ['is', 'are'], a: 'is' }, { type: 'mc', q: 'My glasses ____ broken.', opts: ['are', 'is'], a: 'are' }]);

  TH['possessive'] = G('Forma dzierżawcza', "the manager's office",
    h("Dopełniacz saksoński ('s)") + ul(['osoby/zwierzęta: <i>Tom<b>\'s</b> car, the dog<b>\'s</b> tail</i>', 'l. mnoga z -s → tylko apostrof: <i>the students<b>\'</b> books</i>', 'l. mnoga nieregularna: <i>the children<b>\'s</b> toys</i>']) +
    h('Konstrukcja z „of”') + lead('Dla rzeczy: <i>the colour <b>of</b> her eyes, the end of the film</i>.') +
    tip('Ludzie → zwykle forma z apostrofem (’s); rzeczy → konstrukcja z „of”.'),
    [{ type: 'gap', q: "This is ____ (Tom) bike.", a: "Tom's" }, { type: 'mc', q: 'the toys ____ the children', opts: ['of', "children's"], a: 'of', hint: "lepiej: the children's toys" }]);

  TH['gender'] = G('Rodzaj rzeczownika', 'actor – actress',
    lead('Niektóre rzeczowniki mają osobne formy dla mężczyzny i kobiety (lub samca i samicy).') +
    h('Przykłady') + ul(['actor – actress (aktor – aktorka)', 'nephew – niece (bratanek – bratanica)', 'waiter – waitress', 'prince – princess', 'cow – bull (krowa – byk)']) +
    tip('Coraz częściej używa się form neutralnych: <i>actor, server, police officer</i>.'),
    [{ type: 'gap', q: 'A male actor, a female ____', a: 'actress' }]);

  TH['compound-nouns'] = G('Rzeczowniki złożone', 'Compound Nouns',
    lead('Wyrazy z <b>dwóch lub więcej słów</b>, które razem tworzą jedno znaczenie.') +
    h('Rodzaje zapisu') + ul(['jedno słowo: <i>toothpaste</i> — pasta do zębów', 'z łącznikiem: <i>sister-in-law</i> — szwagierka', 'dwa słowa: <i>washing machine</i> — pralka']) +
    h('Struktury') + ul(['rzeczownik + rzeczownik → bus stop', 'czasownik + rzeczownik → swimming pool', 'przymiotnik + rzeczownik → blackboard']) +
    h('Liczba mnoga') + ul(['odmienia się główny człon: toothbrush → toothbrush<b>es</b>', 'sister-in-law → sister<b>s</b>-in-law', '❗ NIE: sister-in-laws']) +
    tip('Akcent zwykle na pierwszym członie: \'TOOTHpaste.'),
    [{ type: 'mc', q: 'L. mnoga „sister-in-law":', opts: ['sister-in-laws', 'sisters-in-law'], a: 'sisters-in-law' }, { type: 'gap', q: 'We wash clothes in a washing ____.', a: 'machine' }]);

  TH['plural-adv'] = G('Liczba mnoga — przypadki zaawansowane', 'passer-by → passers-by',
    lead('W złożeniach l. mnogą tworzymy na <b>głównym</b> rzeczowniku.') +
    ul(['passer-by → passer<b>s</b>-by', 'runner-up → runner<b>s</b>-up', 'add-on → add-on<b>s</b>', 'mother-in-law → mother<b>s</b>-in-law']) +
    tip('Główny człon to ten, który „coś jest": pass<b>er</b>, runn<b>er</b>, mother.'),
    [{ type: 'gap', q: 'one passer-by, two ____', a: 'passers-by' }]);

  // ═══ PRZEDIMEK ═══
  TH['article-a'] = G('Przedimek nieokreślony a / an', 'a cup · an animal',
    lead('<b>a/an</b> = jeden z wielu (nieokreślony), tylko przed rzeczownikami policzalnymi w l. pojedynczej.') +
    h('a czy an?') + ul(['<b>a</b> przed spółgłoską: a cat, a university (yu-)', '<b>an</b> przed samogłoską (dźwiękiem): an apple, an hour (h nieme)']) +
    h('Kiedy?') + ul(['gdy mówimy o czymś PIERWSZY raz', 'zawody: <i>She is a doctor.</i>']) +
    tip('Decyduje DŹWIĘK, nie litera: a university, an hour.'),
    [{ type: 'mc', q: 'I saw ____ elephant.', opts: ['a', 'an'], a: 'an' }, { type: 'mc', q: 'He is ____ teacher.', opts: ['a', 'an'], a: 'a' }]);

  TH['article-the'] = G('Przedimek określony the', 'the sun · the USA',
    lead('<b>the</b> = ten konkretny, znany obu stronom.') +
    h('Kiedy?') + ul(['coś jedynego: the sun, the moon', 'wspomniane wcześniej', 'stopień najwyższy: the best', 'rzeki, morza, łańcuchy gór, państwa mnogie: the Thames, the USA, the Himalayas', 'instrumenty: play <b>the</b> guitar']) +
    ex('I have a cat. The cat is black.', 'Mam kota. Ten kot jest czarny.'),
    [{ type: 'gap', q: '____ sun is a star.', a: 'The' }, { type: 'gap', q: 'She plays ____ piano.', a: 'the' }]);

  TH['article-zero'] = G('Przedimek zerowy (brak)', 'dinner · Mount Everest',
    lead('Czasem NIE stawiamy przedimka (przedimek zerowy).') +
    h('Kiedy?') + ul(['posiłki: have <b>—</b> breakfast, lunch, dinner', 'niepoliczalne/ogólne: <b>—</b> Water is important.', 'l. mnoga ogólna: <b>—</b> Dogs are friendly.', 'nazwy własne, góry: <b>—</b> Mount Everest, Poland']) +
    ex('Dogs and cats are our favourite pets.', 'Psy i koty to nasze ulubione zwierzęta.'),
    [{ type: 'mc', q: 'I have ____ lunch at 1 p.m.', opts: ['—', 'the', 'a'], a: '—' }, { type: 'mc', q: '____ children like sweets. (ogólnie)', opts: ['—', 'The'], a: '—' }]);

  // ═══ PRZYMIOTNIK ═══
  TH['adj-comp'] = G('Stopniowanie przymiotników', 'big – bigger – the biggest',
    h('Krótkie (1 sylaba)') + ul(['+<b>-er</b> / +<b>-est</b>: tall → taller → the tallest', 'podwojenie: big → bigger → the biggest', '-y → -ier: happy → happier → the happiest']) +
    h('Długie (2+ sylab)') + ul(['<b>more</b> / <b>the most</b>: modern → more modern → the most modern']) +
    h('Nieregularne') + ul(['good → better → the best', 'bad → worse → the worst', 'far → further → the furthest']) +
    tip('Porównanie: <i>bigger <b>than</b></i>; równość: <i><b>as</b> tall <b>as</b></i>.'),
    [{ type: 'gap', q: 'This box is ____ (big) than that one.', a: 'bigger' }, { type: 'gap', q: 'She is the ____ (good) student.', a: 'best' }]);

  TH['so-such'] = G('so, such, how, what', 'z przymiotnikami',
    h('so / such (tak/taki)') + ul(['<b>so</b> + przymiotnik: <i>She is <b>so</b> nice.</i>', '<b>such</b> + (a/an) + przymiotnik + rzeczownik: <i>She is <b>such a</b> nice girl.</i>']) +
    h('how / what (w okrzykach)') + ul(['<b>How</b> + przymiotnik: <i>How nice!</i>', '<b>What</b> + (a/an) + (przymiotnik) + rzeczownik: <i>What a nice day!</i>']),
    [{ type: 'mc', q: 'She is ____ a nice girl.', opts: ['so', 'such'], a: 'such' }, { type: 'mc', q: '____ beautiful weather!', opts: ['How', 'What'], a: 'What' }]);

  TH['adj-poss'] = G('Przymiotniki dzierżawcze', 'my, his, our',
    lead('Stoją PRZED rzeczownikiem i mówią, czyje coś jest.') +
    form(['I → <b>my</b>', 'you → <b>your</b>', 'he → <b>his</b>', 'she → <b>her</b>', 'it → <b>its</b>', 'we → <b>our</b>', 'they → <b>their</b>']) +
    ex('This is my book.', 'To jest moja książka.') +
    tip('Nie myl <b>its</b> (jego/jej) z <b>it\'s</b> (= it is).'),
    [{ type: 'gap', q: 'They love ____ dog. (ich)', a: 'their' }, { type: 'gap', q: 'She lost ____ keys. (jej)', a: 'her' }]);

  TH['adj-noun'] = G('Przymiotnik w funkcji rzeczownika', 'the rich',
    lead('<b>the</b> + przymiotnik = grupa ludzi (l. mnoga).') +
    ul(['the rich — bogaci', 'the poor — biedni', 'the young — młodzi', 'the unemployed — bezrobotni']) +
    ex('The rich should help the poor.', 'Bogaci powinni pomagać biednym.'),
    [{ type: 'gap', q: 'the ____ = young people', a: 'young' }]);

  TH['adj-percep'] = G('Przymiotniki po czasownikach postrzegania', 'It smells great',
    lead('Po <b>look, smell, taste, sound, feel</b> używamy <b>przymiotnika</b>, nie przysłówka.') +
    ex('It smells great.', 'Ładnie pachnie.') + ex('You look tired.', 'Wyglądasz na zmęczonego.') + ex('This sounds interesting.', 'To brzmi interesująco.'),
    [{ type: 'mc', q: 'This cake tastes ____.', opts: ['good', 'well'], a: 'good' }]);

  // ═══ PRZYSŁÓWEK ═══
  TH['adv-comp'] = G('Stopniowanie przysłówków', 'elegantly – more elegantly',
    h('Regularne') + ul(['-ly → <b>more</b> / <b>the most</b>: elegantly → more elegantly', 'krótkie: fast → faster, early → earlier']) +
    h('Nieregularne') + ul(['well → better → the best', 'badly → worse → the worst', 'much → more → the most']) +
    ex('She sings more beautifully than me.', 'Ona śpiewa piękniej niż ja.'),
    [{ type: 'gap', q: 'He runs ____ (fast) than me.', a: 'faster' }, { type: 'gap', q: 'She dances ____ (good) of all.', a: 'best', hint: 'the best' }]);

  TH['adv-forms'] = G('Przysłówki o dwóch znaczeniach', 'hard / hardly',
    lead('Niektóre przysłówki mają dwie formy o RÓŻNYM znaczeniu.') +
    ul(['<b>hard</b> — ciężko / <b>hardly</b> — ledwo, prawie nie', '<b>late</b> — późno / <b>lately</b> — ostatnio', '<b>near</b> — blisko / <b>nearly</b> — prawie']) +
    ex('He works hard. He hardly sleeps.', 'On ciężko pracuje. Ledwo śpi.'),
    [{ type: 'mc', q: 'I ____ ever eat meat. (prawie nie)', opts: ['hardly', 'hard'], a: 'hardly' }]);

  TH['too-enough'] = G('too i enough', 'za dużo / wystarczająco',
    h('too (za bardzo)') + lead('<b>too</b> + przymiotnik/przysłówek — negatywne „za".') + ex('This bag is too heavy.', 'Ta torba jest za ciężka.') +
    h('enough (wystarczająco)') + ul(['przymiotnik + <b>enough</b>: <i>old enough</i>', '<b>enough</b> + rzeczownik: <i>enough money</i>']) + ex('She isn\'t old enough to drive.', 'Nie jest wystarczająco dorosła, żeby prowadzić.'),
    [{ type: 'mc', q: 'The tea is ____ hot to drink. (za)', opts: ['too', 'enough'], a: 'too' }, { type: 'gap', q: 'He is tall ____ to reach it. (wystarczająco)', a: 'enough' }]);

  TH['adv-place'] = G('Miejsce przysłówka w zdaniu', 'often · quickly · always',
    h('Przysłówki częstotliwości') + ul(['(always, usually, often, sometimes, never) — PRZED zwykłym czasownikiem, PO „be":', '<i>She <b>often</b> goes out. She is <b>always</b> late.</i>']) +
    h('Przysłówki sposobu') + lead('(quickly, well, carefully) — zwykle na KOŃCU zdania.') + ex('Do it quickly!', 'Zrób to szybko!') +
    tip('never, hardly = już „negatywne" — nie łącz z „not".'),
    [{ type: 'mc', q: 'She ____ goes to the cinema.', opts: ['often goes', 'goes often'], a: 'often goes', hint: 'często: przed czasownikiem' }]);

  // ═══ ZAIMEK ═══
  TH['pron-subj'] = G('Zaimki osobowe (podmiot)', 'I, you, he…',
    lead('Zaimki w formie podmiotu zastępują osobę/rzecz wykonującą czynność.') +
    form(['<b>I</b> — ja', '<b>you</b> — ty/wy', '<b>he/she/it</b> — on/ona/ono', '<b>we</b> — my', '<b>they</b> — oni/one']) +
    ex('They are my friends.', 'Oni są moimi przyjaciółmi.'),
    [{ type: 'mc', q: '____ is my brother.', opts: ['He', 'Him'], a: 'He' }]);

  TH['pron-poss'] = G('Zaimki dzierżawcze', 'mine, yours, ours',
    lead('Zastępują „przymiotnik dzierżawczy + rzeczownik". Stoją SAMODZIELNIE (bez rzeczownika).') +
    form(['my → <b>mine</b>', 'your → <b>yours</b>', 'his → <b>his</b>', 'her → <b>hers</b>', 'our → <b>ours</b>', 'their → <b>theirs</b>']) +
    ex('This book is mine.', 'Ta książka jest moja.') + tip('Nie: <i>this is my</i>. Poprawnie: <i>this is mine</i>.'),
    [{ type: 'gap', q: 'That car is ____. (nasze)', a: 'ours' }, { type: 'mc', q: 'Is this pen ____?', opts: ['yours', 'your'], a: 'yours' }]);

  TH['pron-refl'] = G('Zaimki zwrotne i emfatyczne', 'myself, yourself',
    lead('Wskazują, że podmiot i dopełnienie to ta sama osoba, albo podkreślają („sam/sama").') +
    form(['myself, yourself, himself, herself, itself', 'ourselves, yourselves, themselves']) +
    ex('I hurt myself.', 'Zraniłem się.') + ex('She did it herself.', 'Zrobiła to sama.') + tip('by + zaimek zwrotny = samodzielnie: <i>by myself</i>.'),
    [{ type: 'gap', q: 'He cut ____ while cooking.', a: 'himself' }, { type: 'gap', q: 'We painted the house ____. (sami)', a: 'ourselves' }]);

  TH['pron-dem'] = G('Zaimki wskazujące', 'this, that, these, those',
    form(['<b>this</b> — ten/ta/to (blisko, l.poj.)', '<b>these</b> — ci/te (blisko, l.mn.)', '<b>that</b> — tamten (daleko, l.poj.)', '<b>those</b> — tamci/tamte (daleko, l.mn.)']) +
    ex('This is my seat. Those are your books.', 'To jest moje miejsce. Tamte to twoje książki.'),
    [{ type: 'mc', q: '____ shoes over there are nice. (tamte)', opts: ['Those', 'These'], a: 'Those' }]);

  TH['pron-int'] = G('Zaimki pytające', 'who, what, which',
    form(['<b>who</b> — kto', '<b>what</b> — co/jaki', '<b>which</b> — który (z ograniczonego wyboru)', '<b>whose</b> — czyj', '<b>where/when/why/how</b>']) +
    ex('Which do you prefer, tea or coffee?', 'Co wolisz, herbatę czy kawę?'),
    [{ type: 'mc', q: '____ is your name?', opts: ['What', 'Who'], a: 'What' }, { type: 'mc', q: '____ one do you want — red or blue?', opts: ['Which', 'What'], a: 'Which' }]);

  TH['pron-rel'] = G('Zaimki względne', 'who, which, that',
    lead('Łączą zdanie główne z podrzędnym (przydawkowym) i opisują rzeczownik.') +
    ul(['<b>who</b> — o ludziach', '<b>which</b> — o rzeczach/zwierzętach', '<b>that</b> — o ludziach i rzeczach', '<b>whose</b> — czyj', '<b>where</b> — miejsce']) +
    ex('The man who lives next door is an actor.', 'Mężczyzna, który mieszka obok, jest aktorem.'),
    [{ type: 'mc', q: 'The book ____ I read was great.', opts: ['which', 'who'], a: 'which' }, { type: 'mc', q: 'The girl ____ won is my friend.', opts: ['who', 'which'], a: 'who' }]);

  TH['pron-recip'] = G('Zaimki wzajemne', 'each other, one another',
    lead('Wyrażają wzajemność — „nawzajem, sobie".') +
    ul(['<b>each other</b> — nawzajem (dwie osoby)', '<b>one another</b> — nawzajem (więcej osób)']) +
    ex('They love each other.', 'Kochają się nawzajem.'),
    [{ type: 'gap', q: 'The two friends helped ____ other.', a: 'each' }]);

  TH['pron-indef'] = G('Zaimki nieokreślone', 'some, any, much, many',
    h('some / any') + ul(['<b>some</b> — twierdzenia', '<b>any</b> — pytania i przeczenia', 'złożenia: something, anybody, nowhere…']) +
    h('much / many / a lot of') + ul(['<b>many</b> + policzalne (many books)', '<b>much</b> + niepoliczalne (much water)', '<b>a lot of</b> — w twierdzeniach z obydwoma']) +
    h('few / little') + ul(['<b>(a) few</b> + policzalne', '<b>(a) little</b> + niepoliczalne']) +
    ex('There is some milk but there aren\'t any eggs.', 'Jest trochę mleka, ale nie ma jajek.'),
    [{ type: 'mc', q: 'Have you got ____ money?', opts: ['any', 'some'], a: 'any' }, { type: 'mc', q: 'There are ____ books on the shelf.', opts: ['many', 'much'], a: 'many' }]);

  TH['pron-imp'] = G('Zaimki bezosobowe', 'you, one',
    lead('Mówią o ludziach ogólnie („ktoś, człowiek, my wszyscy").') +
    ul(['<b>you</b> — potocznie: <i>You can\'t smoke here.</i> (nie wolno tu palić)', '<b>one</b> — formalnie: <i>One should be polite.</i> (należy być grzecznym)']),
    [{ type: 'mc', q: '____ never know what will happen. (ogólnie)', opts: ['You', 'He'], a: 'You' }]);

  TH['pron-one'] = G('Zaimki one / ones', 'the green one / ones',
    lead('Zastępują wcześniej wspomniany rzeczownik, by go nie powtarzać.') +
    ul(['<b>one</b> — l. pojedyncza', '<b>ones</b> — l. mnoga']) +
    ex('I\'ll take the green one.', 'Wezmę ten zielony.') + ex('These apples are nice — I\'ll buy the red ones.', 'Te jabłka są ładne — kupię te czerwone.'),
    [{ type: 'mc', q: 'I don\'t like these shoes. I prefer the black ____.', opts: ['ones', 'one'], a: 'ones' }]);

  // ═══ LICZEBNIK ═══
  TH['num-card'] = G('Liczebniki główne', 'one, two, a thousand',
    lead('Odpowiadają na pytanie „ile?".') +
    ul(['1 one, 2 two, 3 three … 12 twelve', '13 thirteen … 20 twenty, 30 thirty', '100 a/one hundred, 1000 a/one thousand, 1 000 000 a million']) +
    tip('Setki/tysiące w liczbie pojedynczej gdy jest liczba: <i>two hundred</i> (nie hundreds), ale <i>hundreds of people</i> (mnóstwo).'),
    [{ type: 'gap', q: '15 = ____', a: 'fifteen' }, { type: 'gap', q: '1000 = a ____', a: 'thousand' }]);

  TH['num-ord'] = G('Liczebniki porządkowe', 'the first, the twenty-fourth',
    lead('Odpowiadają na „który z kolei?". Zwykle z <b>the</b> i końcówką <b>-th</b>.') +
    ul(['1st first, 2nd second, 3rd third', '4th fourth, 5th fifth, 8th eighth, 9th ninth', '12th twelfth, 20th twentieth, 24th twenty-fourth']) +
    ex('It\'s her first day at school.', 'To jej pierwszy dzień w szkole.'),
    [{ type: 'gap', q: '3rd = ____', a: 'third' }, { type: 'gap', q: '5th = ____', a: 'fifth' }]);

  TH['num-frac'] = G('Liczebniki ułamkowe', '½ · ⅔ · ¾',
    lead('Licznik = liczebnik główny, mianownik = porządkowy (w l. mn. gdy licznik > 1).') +
    ul(['½ = a/one half', '⅓ = a third · ⅔ = two thirds', '¾ = three quarters', '⅞ = seven eighths', '3¼ = three and a quarter']),
    [{ type: 'gap', q: '¾ = three ____', a: 'quarters' }]);

  TH['num-dec'] = G('Liczebniki dziesiętne', '0.5 · 2.91',
    lead('Kropkę czytamy „point", cyfry po kropce — pojedynczo.') +
    ul(['0.5 = point five', '0.06 = point oh/nought six', '2.91 = two point nine one', '1.05 = one point oh five']),
    [{ type: 'gap', q: '2.5 = two point ____', a: 'five' }]);

  // ═══ PRZYIMEK ═══
  TH['prep-place'] = G('Przyimki miejsca, kierunku, odległości', 'in, on, at, to',
    h('Miejsce') + ul(['<b>in</b> — w (in London, in a box)', '<b>on</b> — na (on the table)', '<b>at</b> — przy/w punkcie (at the bus stop, at school)']) +
    h('Kierunek') + ul(['<b>to</b> — do (go to school)', '<b>into / out of / onto</b>']) +
    ex('She is at school. He is going to the shop.', 'Ona jest w szkole. On idzie do sklepu.'),
    [{ type: 'mc', q: 'The keys are ____ the table.', opts: ['on', 'in', 'at'], a: 'on' }, { type: 'mc', q: 'We go ____ school by bus.', opts: ['to', 'at', 'in'], a: 'to' }]);

  TH['prep-time'] = G('Przyimki czasu', 'in, on, at',
    form(['<b>at</b> — godziny, momenty: at 7, at night, at the weekend', '<b>on</b> — dni i daty: on Monday, on 1st May', '<b>in</b> — miesiące, pory roku, lata, części dnia: in July, in summer, in 2025, in the morning']) +
    tip('Wyjątek: <b>at</b> night, ale <b>in</b> the morning/afternoon/evening.'),
    [{ type: 'mc', q: 'I get up ____ 7 o\'clock.', opts: ['at', 'in', 'on'], a: 'at' }, { type: 'mc', q: 'My birthday is ____ July.', opts: ['in', 'on', 'at'], a: 'in' }]);

  TH['prep-manner'] = G('Przyimki sposobu', 'by bus, with a pen',
    ul(['<b>by</b> — środek transportu/sposób: by bus, by car, by email', '<b>with</b> — narzędzie: with a pen, with a knife', '<b>on</b> — on foot (pieszo)']) +
    ex('I wrote it with a pen. She came by train.', 'Napisałem to długopisem. Przyjechała pociągiem.'),
    [{ type: 'mc', q: 'We travelled ____ plane.', opts: ['by', 'with', 'on'], a: 'by' }, { type: 'mc', q: 'Cut it ____ a knife.', opts: ['with', 'by'], a: 'with' }]);

  TH['prep-verbs'] = G('Przyimki po czasownikach i przymiotnikach', 'think of, interested in',
    lead('Wiele czasowników i przymiotników łączy się ze STAŁYM przyimkiem — warto uczyć się razem.') +
    ul(['think <b>of/about</b>, listen <b>to</b>, wait <b>for</b>, look <b>for</b>, depend <b>on</b>', 'interested <b>in</b>, good <b>at</b>, afraid <b>of</b>, famous <b>for</b>, proud <b>of</b>']) +
    ex('She is interested in art.', 'Ona interesuje się sztuką.'),
    [{ type: 'mc', q: 'I\'m good ____ maths.', opts: ['at', 'in', 'of'], a: 'at' }, { type: 'mc', q: 'He is afraid ____ spiders.', opts: ['of', 'from', 'for'], a: 'of' }]);

  // ═══ SPÓJNIK ═══
  TH['conj'] = G('Spójniki', 'and, or, because, if…',
    h('Łączące / wybór') + ul(['<b>and</b> — i', '<b>or</b> — lub', '<b>but</b> — ale', '<b>so</b> — więc (skutek)']) +
    h('Przyczyna / warunek / czas') + ul(['<b>because</b> — ponieważ', '<b>if</b> — jeśli', '<b>when/while</b> — kiedy/podczas', '<b>before/after</b> — przed/po', '<b>although</b> — chociaż']) +
    ex('I stayed home because it was raining.', 'Zostałem w domu, bo padało.'),
    [{ type: 'mc', q: 'I was tired ____ I went to bed.', opts: ['so', 'because', 'but'], a: 'so' }, { type: 'mc', q: 'She\'s happy ____ she won.', opts: ['because', 'so', 'or'], a: 'because' }]);

  // ═══ SKŁADNIA ═══
  TH['sentences'] = G('Zdania: twierdzące, przeczące, pytające', 'w różnych czasach',
    lead('Schemat zależy od czasu, ale zasada jest wspólna: pytania i przeczenia tworzymy <b>operatorem</b> (do/does/did, be, have, will, modalny).') +
    form(['✅ Podmiot + orzeczenie: <i>She works.</i>', '❌ Podmiot + operator + not: <i>She doesn\'t work.</i>', '❓ Operator + podmiot: <i>Does she work?</i>']) +
    tip('Present/Past Simple → operator <b>do/does/did</b>. Inne czasy → be/have/will.'),
    [{ type: 'mc', q: 'Przeczenie: „He plays." →', opts: ["He doesn't play.", "He don't play."], a: "He doesn't play." }]);

  TH['excl'] = G('Zdania wykrzyknikowe', 'How…! What…!',
    ul(['<b>How</b> + przymiotnik/przysłówek: <i>How nice of you!</i>', '<b>What</b> + (a/an) + (przymiotnik) + rzeczownik: <i>What wonderful scenery! What a day!</i>']),
    [{ type: 'mc', q: '____ a beautiful garden!', opts: ['What', 'How'], a: 'What' }, { type: 'mc', q: '____ nice!', opts: ['How', 'What'], a: 'How' }]);

  TH['it-subj'] = G('Zdania z podmiotem „it"', 'It rained…',
    lead('„it" jako podmiot pozorny — pogoda, czas, odległość, temperatura, opinie.') +
    ul(['pogoda: <i>It rained heavily last night.</i>', 'czas: <i>It\'s half past two.</i>', 'ogólnie: <i>It\'s great here.</i>']),
    [{ type: 'gap', q: '____ is cold today. (pogoda)', a: 'It' }]);

  TH['there-subj'] = G('Zdania z „there is / there are"', 'There is…',
    lead('„there is/are" = „jest/są, znajduje się" — mówimy, że coś istnieje/gdzieś jest.') +
    form(['<b>There is</b> + l. pojedyncza / niepoliczalne', '<b>There are</b> + l. mnoga', 'przeczenie: There isn\'t / aren\'t', 'przeszłość: There was / were']) +
    ex('There is a new restaurant in King Street.', 'Na King Street jest nowa restauracja.'),
    [{ type: 'mc', q: '____ three books on the desk.', opts: ['There are', 'There is'], a: 'There are' }, { type: 'gap', q: '____ is a cat in the garden.', a: 'There' }]);

  TH['two-obj'] = G('Zdania z dwoma dopełnieniami', 'give somebody something',
    lead('Niektóre czasowniki (give, buy, send, tell, show) mają dwa dopełnienia: komu? + co?') +
    ul(['osoba + rzecz: <i>I bought <b>my grandma a present</b>.</i>', 'lub rzecz + to/for + osoba: <i>I bought <b>a present for my grandma</b>.</i>']),
    [{ type: 'mc', q: 'She gave ____.', opts: ['me a book', 'a book me'], a: 'me a book' }]);

  TH['passive'] = G('Strona bierna', 'It was made in China',
    lead('Używamy, gdy ważniejsze jest, CO się dzieje, niż KTO to robi. Budowa: <b>be</b> + III forma.') +
    form(['Present Simple: am/is/are + III → <i>English is spoken here.</i>', 'Past Simple: was/were + III → <i>My car was stolen.</i>', 'Future: will be + III → <i>It will be done.</i>']) +
    ex('The letter was written by Tom.', 'List został napisany przez Toma.') + tip('Wykonawca po <b>by</b> (jeśli w ogóle podany).'),
    [{ type: 'gap', q: 'This house ____ (build) in 1990. (Past Simple bierna)', a: 'was built' }, { type: 'mc', q: 'English ____ all over the world.', opts: ['is spoken', 'speaks'], a: 'is spoken' }]);

  TH['passive-adv'] = G('Strona bierna — konstrukcje zaawansowane', 'is believed to…',
    ul(['Present Continuous: <i>His every step is being watched.</i>', 'z bezokolicznikiem dokonanym: <i>He is believed to have robbed a bank.</i>', 'z czasownikiem modalnym: <i>It must be finished today.</i>', 'kauzatywna „make": <i>I was made to give a speech.</i>']),
    [{ type: 'mc', q: 'The work ____ done now. (właśnie trwa)', opts: ['is being', 'is'], a: 'is being' }]);

  TH['tags'] = G('Question tags i dopowiedzenia', "isn't it?",
    lead('Krótkie „prawda?" na końcu zdania. Twierdzenie → ogonek przeczący; przeczenie → ogonek twierdzący.') +
    ul(['He\'s English, <b>isn\'t he?</b>', 'You don\'t know, <b>do you?</b>', 'Give me the book, <b>will you?</b>']) +
    h('Dopowiedzenia') + ul(['<b>So do I.</b> — ja też (twierdząco)', '<b>Neither/Nor do I.</b> — ja też nie']),
    [{ type: 'mc', q: 'She is nice, ____?', opts: ["isn't she", "is she"], a: "isn't she" }]);

  TH['indirect-q'] = G('Pytania pośrednie', 'Can you tell me…?',
    lead('Grzeczne/osadzone pytania. Po zwrocie wstępnym szyk jest jak w zdaniu <b>twierdzącym</b> (bez inwersji, bez do/does).') +
    ex('Can you tell me what time it is?', 'Czy możesz mi powiedzieć, która godzina?') + ex('I don\'t know where she lives.', 'Nie wiem, gdzie ona mieszka.') +
    tip('NIE: <i>…what time is it</i>. Poprawnie: <i>…what time it is</i>.'),
    [{ type: 'mc', q: 'Do you know where ____?', opts: ['he is', 'is he'], a: 'he is' }]);

  TH['reported'] = G('Mowa zależna', 'She said (that)…',
    lead('Relacjonujemy cudze słowa. Czasy zwykle „cofamy" o jeden krok, zmieniamy zaimki i okoliczniki.') +
    form(['present → past: is → was, do → did', 'Past Simple → Past Perfect: did → had done', 'will → would, can → could']) +
    ex('„I am tired." → She said (that) she was tired.', 'Powiedziała, że jest zmęczona.') +
    ex('The teacher told me to sit down.', 'Nauczyciel kazał mi usiąść. (polecenie: tell sb to do)'),
    [{ type: 'mc', q: '„I am happy." → He said he ____ happy.', opts: ['was', 'is'], a: 'was' }]);

  TH['coord'] = G('Zdania współrzędnie złożone', 'and, but, or, so',
    lead('Dwa równorzędne zdania połączone spójnikiem (and, but, or, so).') +
    ex('My brother was playing football and I was watching cartoons.', 'Brat grał w piłkę, a ja oglądałem kreskówki.') + ex('He came but he refused to help.', 'Przyszedł, ale odmówił pomocy.'),
    [{ type: 'mc', q: 'I was hungry ____ I made a sandwich.', opts: ['so', 'because'], a: 'so' }]);

  TH['subj-cl'] = G('Zdania podrzędne podmiotowe', 'What I know…',
    lead('Zdanie podrzędne pełni funkcję <b>podmiotu</b> (odpowiada na „kto? co?").') +
    ex('What I know about it is confidential.', 'To, co o tym wiem, jest poufne.'),
    [{ type: 'mc', q: '„____ he said surprised me." — to zdanie podrzędne jest:', opts: ['podmiotowe', 'okolicznikowe'], a: 'podmiotowe' }]);

  TH['pred-cl'] = G('Zdania podrzędne orzecznikowe', 'The problem is that…',
    lead('Zdanie podrzędne jest <b>orzecznikiem</b> — po czasowniku „be" dopowiada, czym coś jest.') +
    ex('The problem is that we need help.', 'Problem polega na tym, że potrzebujemy pomocy.'),
    [{ type: 'gap', q: 'The truth is ____ he lied. (spójnik)', a: 'that' }]);

  TH['obj-cl'] = G('Zdania podrzędne dopełnieniowe', 'He promised that…',
    lead('Zdanie podrzędne jest <b>dopełnieniem</b> (odpowiada na „kogo? co?"). Często ze spójnikiem „that".') +
    ex('He promised that he would come.', 'Obiecał, że przyjdzie.') + ex('I think (that) you are right.', 'Myślę, że masz rację.'),
    [{ type: 'gap', q: 'She said ____ she was busy. (spójnik, można pominąć)', a: 'that' }]);

  TH['rel'] = G('Zdania podrzędne przydawkowe', 'The man who…',
    lead('Opisują rzeczownik — łączymy zaimkiem względnym (who, which, that, whose, where).') +
    ul(['definiujące (bez przecinków): <i>The man <b>who</b> lives next door…</i>', 'opisujące (w przecinkach): <i>My aunt, <b>who</b> is a doctor, …</i>']) +
    ex('The book which I read was great.', 'Książka, którą przeczytałem, była świetna.'),
    [{ type: 'mc', q: 'The house ____ we bought is old.', opts: ['which', 'who'], a: 'which' }]);

  TH['purpose'] = G('Okolicznikowe celu', 'to, in order to, so that',
    lead('Wyrażają CEL — po co? w jakim celu?') +
    ul(['<b>to / in order to / so as to</b> + bezokolicznik', '<b>so that</b> + zdanie (z can/would)']) +
    ex('I came here to give you this letter.', 'Przyszedłem, żeby dać ci ten list.') + ex('He whispered so that nobody could hear.', 'Szeptał, żeby nikt nie słyszał.'),
    [{ type: 'mc', q: 'I went out ____ buy milk.', opts: ['to', 'for', 'that'], a: 'to' }]);

  TH['time-cl'] = G('Okolicznikowe czasu', 'when, while, before, after',
    lead('Odpowiadają na „kiedy?". Spójniki: when, while, before, after, as soon as, until.') +
    ex('The phone rang when we were leaving.', 'Telefon zadzwonił, gdy wychodziliśmy.') +
    tip('Po „when/as soon as" o przyszłości → Present Simple: <i>I\'ll call you when I <b>arrive</b>.</i>'),
    [{ type: 'mc', q: 'I\'ll phone you when I ____ home.', opts: ['get', 'will get'], a: 'get' }]);

  TH['place-cl'] = G('Okolicznikowe miejsca', 'where…',
    lead('Odpowiadają na „gdzie?". Spójnik: where.') +
    ex('He was sitting where I had left him.', 'Siedział tam, gdzie go zostawiłem.'),
    [{ type: 'gap', q: 'Stay ____ you are. (gdzie)', a: 'where' }]);

  TH['cause-cl'] = G('Okolicznikowe przyczyny', 'because, as, since',
    lead('Wyrażają POWÓD — dlaczego? Spójniki: because, as, since.') +
    ex('She is happy because she won the lottery.', 'Jest szczęśliwa, bo wygrała na loterii.') + ex('As it was late, we went home.', 'Ponieważ było późno, poszliśmy do domu.'),
    [{ type: 'mc', q: 'I stayed in ____ it was raining.', opts: ['because', 'so'], a: 'because' }]);

  TH['compare-cl'] = G('Okolicznikowe porównawcze', 'as…as, than',
    ul(['równość: <b>as</b> + przymiotnik + <b>as</b>: <i>as big as</i>', 'nierówność: przymiotnik-er / more … + <b>than</b>', '<b>as much … as</b>: <i>as much courage as</i>']) +
    ex('Sylvia\'s garden is not as big as Margaret\'s.', 'Ogród Sylwii nie jest tak duży jak Margaret.'),
    [{ type: 'mc', q: 'He is as tall ____ his brother.', opts: ['as', 'than'], a: 'as' }]);

  TH['concession-cl'] = G('Okolicznikowe przyzwolenia', 'although, though, despite',
    lead('Wyrażają kontrast / „mimo że". Spójniki: although, (even) though, despite/in spite of + rzeczownik/-ing.') +
    ex('Although he was strong, he didn\'t want to fight.', 'Chociaż był silny, nie chciał się bić.') + ex('Despite the rain, we went out.', 'Mimo deszczu wyszliśmy.'),
    [{ type: 'mc', q: '____ it was cold, we swam.', opts: ['Although', 'Because'], a: 'Although' }]);

  TH['result-cl'] = G('Okolicznikowe skutku', 'so…',
    lead('Wyrażają SKUTEK — więc, dlatego. Spójnik: so.') +
    ex('I was tired so I went straight to bed.', 'Byłem zmęczony, więc od razu poszedłem spać.'),
    [{ type: 'gap', q: 'It was late ____ we left. (skutek)', a: 'so' }]);

  TH['manner-cl'] = G('Okolicznikowe sposobu', 'as, as if',
    lead('Odpowiadają na „jak? w jaki sposób?". Spójniki: as, (in) the way, as if / as though.') +
    ex('Do as I tell you.', 'Rób tak, jak ci mówię.') + ex('She acts as if she were the boss.', 'Zachowuje się, jakby była szefem.'),
    [{ type: 'gap', q: 'Do it ____ I showed you. (jak)', a: 'as' }]);

  TH['degree-cl'] = G('Okolicznikowe stopnia', 'so … that',
    lead('Wyrażają natężenie + skutek: „tak … że". Konstrukcja: <b>so</b> + przymiotnik + <b>that</b>.') +
    ex('He was so tired that he fell asleep.', 'Był tak zmęczony, że zasnął.') + ex('It was such a good film that I watched it twice.', 'To był tak dobry film, że obejrzałem go dwa razy.'),
    [{ type: 'gap', q: 'She was ____ happy that she cried. (tak)', a: 'so' }]);

  TH['cond'] = G('Okresy warunkowe (0, I, II, III)', 'If…',
    h('Typ 0 — prawdy ogólne') + ul(['If + Present, Present: <i>If you heat ice, it melts.</i>']) +
    h('Typ I — realny (przyszłość)') + ul(['If + Present, will: <i>If it rains, we will stay in.</i>']) +
    h('Typ II — nierealny teraz') + ul(['If + Past, would: <i>If I had money, I would travel.</i>']) +
    h('Typ III — nierealny w przeszłości') + ul(['If + Past Perfect, would have + III: <i>If I had known, I would have called.</i>']) +
    tip('Po „if" NIE dajemy „will" w typie 0 i I.'),
    [{ type: 'mc', q: 'If it ____ tomorrow, we\'ll stay home.', opts: ['rains', 'will rain'], a: 'rains' }, { type: 'mc', q: 'If I ____ rich, I would buy a house. (typ II)', opts: ['were', 'am'], a: 'were' }]);

  TH['wish'] = G('Życzenia i preferencje', 'wish, had better, would rather',
    ul(['<b>I wish</b> + Past (żałuję teraz): <i>I wish you were here.</i>', '<b>I wish</b> + Past Perfect (żałuję przeszłości): <i>I wish I had studied.</i>', '<b>It\'s (high) time</b> + Past: <i>It\'s time he found a job.</i>', '<b>had better</b> (+ bezokolicznik): <i>You\'d better go now.</i>', '<b>would rather</b>: <i>I\'d rather stay.</i>']),
    [{ type: 'mc', q: 'I wish I ____ taller. (teraz)', opts: ['were', 'am'], a: 'were' }]);

  TH['inf-constr'] = G('Konstrukcje bezokolicznikowe', 'to + bezokolicznik',
    lead('Po wielu czasownikach, przymiotnikach i w wyrażeniach celu używamy <b>to + bezokolicznik</b>; po niektórych — bezokolicznik bez „to".') +
    ul(['want/decide/hope/promise + <b>to</b> do', 'want <b>somebody</b> to do: <i>I want you to help.</i>', 'przymiotnik: <i>glad to see you, difficult to decide</i>', 'bez „to" po: make/let sb do: <i>Don\'t make me laugh. Let me go.</i>']),
    [{ type: 'mc', q: 'I want you ____ it.', opts: ['to do', 'do', 'doing'], a: 'to do' }, { type: 'mc', q: 'Let me ____.', opts: ['go', 'to go'], a: 'go' }]);

  TH['gerund'] = G('Konstrukcje gerundialne (-ing)', 'I enjoy swimming',
    lead('Rzeczownik odczasownikowy (-ing). Po niektórych czasownikach, przyimkach i wyrażeniach.') +
    ul(['enjoy, finish, avoid, mind, can\'t help + <b>-ing</b>', 'po przyimkach: <i>good at swimming, interested in learning</i>', 'jako podmiot: <i>Swimming is healthy.</i>']) +
    ex('I enjoy walking but my friends prefer cycling.', 'Lubię spacery, ale znajomi wolą jazdę na rowerze.') +
    tip('Uwaga: like/love/prefer + -ing lub + to (podobne znaczenie).'),
    [{ type: 'mc', q: 'I enjoy ____ books.', opts: ['reading', 'to read', 'read'], a: 'reading' }, { type: 'mc', q: 'She\'s good at ____.', opts: ['drawing', 'draw'], a: 'drawing' }]);

  TH['causative'] = G('Konstrukcja have/get something done', 'zlecanie czynności',
    lead('Gdy ktoś INNY robi coś dla nas (usługa). Budowa: <b>have/get + rzecz + III forma</b>.') +
    ex('He had his room painted yesterday.', 'Wczoraj (zlecił i) pomalowano mu pokój.') + ex('I must get my car repaired.', 'Muszę oddać samochód do naprawy.'),
    [{ type: 'mc', q: 'She had her hair ____.', opts: ['cut', 'cutting', 'to cut'], a: 'cut' }]);

  TH['causative2'] = G('have sb do / get sb to do', 'nakłanianie osób',
    ul(['<b>have somebody do something</b> — zlecić/dopilnować (bardziej bezpośrednio): <i>I\'ll have Mike cook dinner.</i>', '<b>get somebody to do something</b> — nakłonić, przekonać: <i>I got my brother to help me.</i>']),
    [{ type: 'mc', q: 'I ____ my sister to lend me money. (nakłoniłem)', opts: ['got', 'had'], a: 'got' }]);

  // ═══ SKŁADNIA — rozszerzenie ═══
  TH['perfect-modal'] = G('Perfect modals', 'must have done…',
    lead('Modalny + <b>have</b> + III forma — o przeszłości: wnioski, przypuszczenia, krytyka.') +
    ul(['<b>must have</b> + III — na pewno tak było: <i>He must have left.</i>', '<b>can\'t have</b> + III — na pewno NIE: <i>It can\'t have been John.</i>', '<b>could/may/might have</b> + III — może było', '<b>should have</b> + III — powinien był (a nie zrobił)']),
    [{ type: 'mc', q: 'The ground is wet. It ____ rained.', opts: ['must have', 'must'], a: 'must have' }]);

  TH['inversion'] = G('Inwersja stylistyczna', 'Rarely, Never, Little…',
    lead('Po wyrażeniach przeczących/ograniczających na początku zdania — <b>szyk pytający</b> (dla emfazy).') +
    ul(['Rarely, Never, Seldom, Hardly, No sooner, Not until, Little', '<i>Rarely <b>do I</b> see such enthusiasm.</i>', '<i>Never <b>have I</b> been so happy.</i>', '<i>Little <b>did he</b> know…</i>']),
    [{ type: 'mc', q: 'Never ____ such a mess.', opts: ['have I seen', 'I have seen'], a: 'have I seen' }]);

  TH['cleft'] = G('Zdania rozszczepione', 'It was… who…',
    lead('Podkreślają jeden element zdania. Konstrukcja: <b>It is/was + [element] + who/that + reszta</b>.') +
    ex('It was John who told me.', 'To John mi powiedział.') + ex('It was in 2020 that we met.', 'To w 2020 się poznaliśmy.'),
    [{ type: 'mc', q: '____ Anna who called. (to Anna)', opts: ['It was', 'She was'], a: 'It was' }]);

  TH['inv-cond'] = G('Odwrócone zdania warunkowe', 'Had I known…',
    lead('Bez „if" — z inwersją (formalnie).') +
    ul(['Typ III: <i><b>Had I known</b>, I wouldn\'t have come.</i> (= If I had known)', 'Typ I: <i><b>Should you</b> need help, call me.</i>', 'Typ II: <i><b>Were I</b> you, I\'d wait.</i>']),
    [{ type: 'mc', q: '„If I had known" bez „if" =', opts: ['Had I known', 'Did I know'], a: 'Had I known' }]);

  TH['mixed-cond'] = G('Okresy warunkowe mieszane', 'przeszłość ↔ teraźniejszość',
    lead('Łączą różne czasy warunku i skutku, gdy odnoszą się do różnych momentów.') +
    ul(['warunek w przeszłości → skutek teraz: <i>If I had slept, I wouldn\'t be tired now.</i>', 'warunek ogólny → skutek w przeszłości: <i>If he knew English, he would have got the job.</i>']),
    [{ type: 'mc', q: 'If I had studied medicine, I ____ a doctor now.', opts: ['would be', 'would have been'], a: 'would be' }]);

  TH['emphatic'] = G('Formy emfatyczne', 'do / did dla podkreślenia',
    lead('Operator <b>do/does/did</b> w zdaniu twierdzącym podkreśla („naprawdę, przecież").') +
    ex('You do look nice today.', 'Naprawdę ładnie dziś wyglądasz.') + ex('I did tell you!', 'Przecież ci mówiłem!'),
    [{ type: 'mc', q: 'I ____ like it, honestly! (podkreślenie)', opts: ['do', 'am'], a: 'do' }]);

  TH['comp-correl'] = G('Konstrukcja korelacyjna', 'The more…, the…',
    lead('„Im…, tym…" — <b>The + stopień wyższy…, the + stopień wyższy…</b>.') +
    ex('The older I get, the happier I am.', 'Im jestem starszy, tym szczęśliwszy.') + ex('The more you practise, the better you become.', 'Im więcej ćwiczysz, tym lepszy jesteś.'),
    [{ type: 'gap', q: 'The more, ____ merrier. (im więcej, tym weselej)', a: 'the' }]);

  // ── STRUKTURA ZAGADNIEŃ ──
  const T = (id, t, k) => ({ id, t, k: k || null });

  const E8 = {
    id: 'e8', title: 'Egzamin Ósmoklasisty', short: 'E8', subject: 'Język angielski',
    color: '#3b82f6', emoji: '📘',
    intro: 'Zagadnienia gramatyczne i typy zadań na egzaminie ósmoklasisty z języka angielskiego. Klikaj w temat, aby poznać teorię i poćwiczyć.',
    cats: [
      { name: 'Czasownik', emoji: '🏃', topics: [
        T('e8-have-got', 'Have got / have — „mieć"', 'have-got'),
        T('e8-infinitive', 'Bezokolicznik i formy osobowe', 'infinitive'),
        T('e8-aux', 'Czasowniki posiłkowe (be, do)', 'aux'),
        T('e8-can', 'Modalny: can', 'can'),
        T('e8-could', 'Modalny: could', 'could'),
        T('e8-may', 'Modalny: may', 'may'),
        T('e8-must', 'Modalny: must', 'must'),
        T('e8-should', 'Modalny: should', 'should'),
        T('e8-imperative', 'Tryb rozkazujący', 'imperative'),
        T('e8-reg-irreg', 'Czasowniki regularne i nieregularne', 'reg-irreg'),
        T('e8-participles', 'Imiesłów czynny i bierny', 'participles'),
        T('e8-state', 'Czasowniki wyrażające stany', 'state'),
        T('e8-phrasal', 'Czasowniki złożone (phrasal verbs)', 'phrasal'),
        T('e8-going-to', 'be going to', 'be-going-to'),
        T('e8-have-to', 'have to', 'have-to'),
        T('e8-would-like', 'would like to', 'would-like-to'),
      ]},
      { name: 'Czasy', emoji: '⏳', topics: [
        T('e8-present-simple', 'Present Simple', 'present-simple'),
        T('e8-present-continuous', 'Present Continuous', 'present-continuous'),
        T('e8-present-perfect', 'Present Perfect', 'present-perfect'),
        T('e8-past-simple', 'Past Simple', 'past-simple'),
        T('e8-past-continuous', 'Past Continuous', 'past-continuous'),
        T('e8-future-simple', 'Future Simple', 'future-simple'),
      ]},
      { name: 'Rzeczownik', emoji: '📦', topics: [
        T('e8-count', 'Policzalne i niepoliczalne', 'countable'),
        T('e8-plural', 'Liczba mnoga (reg. i niereg.)', 'plural-nouns'),
        T('e8-possessive', 'Forma dzierżawcza (\'s)', 'possessive'),
        T('e8-compound', 'Rzeczowniki złożone', 'compound-nouns'),
      ]},
      { name: 'Przedimek', emoji: '🔤', topics: [
        T('e8-art-a', 'Przedimek nieokreślony (a/an)', 'article-a'),
        T('e8-art-the', 'Przedimek określony (the)', 'article-the'),
        T('e8-art-zero', 'Przedimek zerowy', 'article-zero'),
      ]},
      { name: 'Przymiotnik', emoji: '🎨', topics: [
        T('e8-adj-comp', 'Stopniowanie przymiotników', 'adj-comp'),
        T('e8-so-such', 'so, such, how, what', 'so-such'),
        T('e8-adj-poss', 'Przymiotniki dzierżawcze (my, his)', 'adj-poss'),
      ]},
      { name: 'Przysłówek', emoji: '⚡', topics: [
        T('e8-adv-comp', 'Stopniowanie przysłówków', 'adv-comp'),
        T('e8-too-enough', 'too i enough', 'too-enough'),
        T('e8-adv-place', 'Miejsce przysłówka w zdaniu', 'adv-place'),
      ]},
      { name: 'Zaimek', emoji: '👉', topics: [
        T('e8-pron-subj', 'Osobowe (podmiot): I, we', 'pron-subj'),
        T('e8-pron-poss', 'Dzierżawcze: mine, yours', 'pron-poss'),
        T('e8-pron-refl', 'Zwrotne/emfatyczne: myself', 'pron-refl'),
        T('e8-pron-dem', 'Wskazujące: this, those', 'pron-dem'),
        T('e8-pron-int', 'Pytające: who, what, which', 'pron-int'),
        T('e8-pron-rel', 'Względne: who, which, that', 'pron-rel'),
        T('e8-pron-indef', 'Nieokreślone: some, any, much, many', 'pron-indef'),
        T('e8-pron-you', 'Bezosobowe you', 'pron-imp'),
        T('e8-pron-one', 'one / ones', 'pron-one'),
      ]},
      { name: 'Liczebnik', emoji: '🔢', topics: [
        T('e8-num-card', 'Główne (one, a thousand)', 'num-card'),
        T('e8-num-ord', 'Porządkowe (the first)', 'num-ord'),
      ]},
      { name: 'Przyimek', emoji: '🧭', topics: [
        T('e8-prep-place', 'Miejsce, kierunek, odległość', 'prep-place'),
        T('e8-prep-time', 'Czas (on, in, at)', 'prep-time'),
        T('e8-prep-manner', 'Sposób (by bus, with)', 'prep-manner'),
        T('e8-prep-verbs', 'Po czasownikach i przymiotnikach', 'prep-verbs'),
      ]},
      { name: 'Spójnik', emoji: '🔗', topics: [ T('e8-conj', 'Spójniki (and, or, because, if…)', 'conj') ]},
      { name: 'Składnia', emoji: '🧱', topics: [
        T('e8-sentences', 'Zdania twierdzące/przeczące/pytające', 'sentences'),
        T('e8-it', 'Zdania z podmiotem it', 'it-subj'),
        T('e8-there', 'Zdania z podmiotem there', 'there-subj'),
        T('e8-two-obj', 'Zdania z dwoma dopełnieniami', 'two-obj'),
        T('e8-passive', 'Strona bierna', 'passive'),
        T('e8-coord', 'Zdania współrzędnie złożone', 'coord'),
        T('e8-rel', 'Podrzędne: przydawkowe', 'rel'),
        T('e8-purpose', 'Podrzędne: okolicznikowe celu', 'purpose'),
        T('e8-time', 'Podrzędne: okolicznikowe czasu', 'time-cl'),
        T('e8-place', 'Podrzędne: okolicznikowe miejsca', 'place-cl'),
        T('e8-cause', 'Podrzędne: okolicznikowe przyczyny', 'cause-cl'),
        T('e8-result', 'Podrzędne: okolicznikowe skutku', 'result-cl'),
        T('e8-cond', 'Okolicznikowe warunku (0, I)', 'cond'),
        T('e8-ger-inf', 'Bezokolicznik i gerund', 'gerund'),
      ]},
    ],
    tasks: {
      name: 'Typy zadań na egzaminie',
      groups: [
        { name: 'Rozumienie ze słuchu', items: ['wybór wielokrotny', 'dobieranie', 'zadanie z luką/lukami', 'odpowiedzi na pytania'] },
        { name: 'Znajomość funkcji językowych', items: ['wybór wielokrotny', 'dobieranie', 'zadanie z luką/lukami'] },
        { name: 'Rozumienie tekstów pisanych', items: ['wybór wielokrotny', 'dobieranie', 'zadanie z luką/lukami', 'odpowiedzi na pytania'] },
        { name: 'Znajomość środków językowych', items: ['wybór wielokrotny', 'dobieranie', 'zadanie z luką/lukami', 'parafraza zdań', 'tłumaczenie fragmentów', 'układanie fragmentów zdań'] },
        { name: 'Wypowiedź pisemna', items: ['e-mail, wpis na blogu (50–120 wyrazów)'] },
      ]
    }
  };

  const MATURA_P = {
    id: 'podstawa', title: 'Poziom podstawowy', level: 'B1+', color: '#16a34a', emoji: '🟢',
    intro: 'Zakres środków językowych na poziomie B1+ (B2 w rozumieniu). Wypowiedź pisemna: 100–150 wyrazów (tekst użytkowy).',
    cats: [
      { name: 'Czasownik', emoji: '🏃', topics: [
        T('mp-inf', 'Bezokolicznik i formy osobowe', 'infinitive'),
        T('mp-aux', 'Czasowniki posiłkowe (be, do, have)', 'aux'),
        T('mp-can', 'Modalny: can', 'can'),
        T('mp-could', 'Modalny: could', 'could'),
        T('mp-may', 'Modalny: may', 'may'),
        T('mp-might', 'Modalny: might', 'might'),
        T('mp-must', 'Modalny: must; have to', 'must'),
        T('mp-will', 'Modalny: will', 'will-m'),
        T('mp-shall', 'Modalny: shall', 'shall'),
        T('mp-would', 'Modalny: would', 'would-m'),
        T('mp-should', 'Modalny: should; ought to', 'should'),
        T('mp-need', 'Modalny: need; need to', 'need-m'),
        T('mp-used-to', 'used to', 'used-to'),
        T('mp-going-to', 'be going to', 'be-going-to'),
        T('mp-able', 'be able to', 'be-able-to'),
        T('mp-would-like', 'would like to', 'would-like-to'),
        T('mp-reg', 'Regularne i nieregularne', 'reg-irreg'),
        T('mp-part', 'Imiesłów czynny i bierny', 'participles'),
        T('mp-phrasal', 'Phrasal verbs', 'phrasal'),
      ]},
      { name: 'Czasy', emoji: '⏳', topics: [
        T('mp-present-simple', 'Present Simple', 'present-simple'),
        T('mp-present-continuous', 'Present Continuous', 'present-continuous'),
        T('mp-present-perfect', 'Present Perfect', 'present-perfect'),
        T('mp-ppc', 'Present Perfect Continuous', 'present-perfect-continuous'),
        T('mp-past-simple', 'Past Simple', 'past-simple'),
        T('mp-past-continuous', 'Past Continuous', 'past-continuous'),
        T('mp-past-perfect', 'Past Perfect', 'past-perfect'),
        T('mp-future-simple', 'Future Simple', 'future-simple'),
        T('mp-future-continuous', 'Future Continuous', 'future-continuous'),
      ]},
      { name: 'Rzeczownik', emoji: '📦', topics: [
        T('mp-count', 'Policzalne i niepoliczalne', 'countable'),
        T('mp-plural', 'Liczba mnoga (reg. i niereg.)', 'plural-nouns'),
        T('mp-sing-plur', 'Tylko l.poj. / tylko l.mn.', 'sing-plural-only'),
        T('mp-poss', 'Forma dzierżawcza', 'possessive'),
        T('mp-gender', 'Rodzaj (actor – actress)', 'gender'),
        T('mp-compound', 'Rzeczowniki złożone', 'compound-nouns'),
      ]},
      { name: 'Przedimek', emoji: '🔤', topics: [
        T('mp-art-a', 'Nieokreślony (a/an)', 'article-a'),
        T('mp-art-the', 'Określony (the)', 'article-the'),
        T('mp-art-zero', 'Zerowy', 'article-zero'),
      ]},
      { name: 'Przymiotnik', emoji: '🎨', topics: [
        T('mp-adj-comp', 'Stopniowanie', 'adj-comp'),
        T('mp-so-such', 'so, such', 'so-such'),
        T('mp-adj-poss', 'Dzierżawcze', 'adj-poss'),
      ]},
      { name: 'Przysłówek', emoji: '⚡', topics: [
        T('mp-adv-comp', 'Stopniowanie', 'adv-comp'),
        T('mp-adv-forms', 'Formy o dwóch znaczeniach (hard/hardly)', 'adv-forms'),
        T('mp-too-enough', 'too i enough', 'too-enough'),
        T('mp-adv-place', 'Miejsce w zdaniu', 'adv-place'),
      ]},
      { name: 'Zaimek', emoji: '👉', topics: [
        T('mp-pron-subj', 'Osobowe', 'pron-subj'), T('mp-pron-poss', 'Dzierżawcze', 'pron-poss'), T('mp-pron-refl', 'Zwrotne/emfatyczne', 'pron-refl'),
        T('mp-pron-dem', 'Wskazujące', 'pron-dem'), T('mp-pron-int', 'Pytające', 'pron-int'), T('mp-pron-rel', 'Względne', 'pron-rel'),
        T('mp-pron-recip', 'Wzajemne (each other)', 'pron-recip'), T('mp-pron-indef', 'Nieokreślone', 'pron-indef'), T('mp-pron-imp', 'Bezosobowe (you, one)', 'pron-imp'), T('mp-pron-one', 'one / ones', 'pron-one'),
      ]},
      { name: 'Liczebnik', emoji: '🔢', topics: [ T('mp-num-card', 'Główne', 'num-card'), T('mp-num-ord', 'Porządkowe', 'num-ord') ]},
      { name: 'Przyimek', emoji: '🧭', topics: [
        T('mp-prep-place', 'Miejsce, kierunek', 'prep-place'), T('mp-prep-time', 'Czas', 'prep-time'), T('mp-prep-manner', 'Sposób', 'prep-manner'), T('mp-prep-verbs', 'Po czasownikach/przymiotnikach', 'prep-verbs'),
      ]},
      { name: 'Spójnik', emoji: '🔗', topics: [ T('mp-conj', 'Spójniki', 'conj') ]},
      { name: 'Składnia', emoji: '🧱', topics: [
        T('mp-sentences', 'Twierdzące/przeczące/pytające', 'sentences'), T('mp-imperative', 'Tryb rozkazujący', 'imperative'), T('mp-excl', 'Wykrzyknikowe (how, what)', 'excl'),
        T('mp-it', 'Podmiot it', 'it-subj'), T('mp-there', 'Podmiot there', 'there-subj'), T('mp-two-obj', 'Dwa dopełnienia', 'two-obj'),
        T('mp-passive', 'Strona bierna', 'passive'), T('mp-tags', 'Question tags', 'tags'), T('mp-indirect-q', 'Pytania pośrednie', 'indirect-q'), T('mp-reported', 'Mowa zależna', 'reported'),
        T('mp-coord', 'Współrzędnie złożone', 'coord'), T('mp-subj-cl', 'Podmiotowe', 'subj-cl'), T('mp-pred-cl', 'Orzecznikowe', 'pred-cl'), T('mp-obj-cl', 'Dopełnieniowe', 'obj-cl'),
        T('mp-rel', 'Przydawkowe', 'rel'), T('mp-purpose', 'Celu', 'purpose'), T('mp-time', 'Czasu', 'time-cl'), T('mp-place', 'Miejsca', 'place-cl'), T('mp-cause2', 'Przyczyny', 'cause-cl'),
        T('mp-compare', 'Porównawcze', 'compare-cl'), T('mp-concession', 'Przyzwolenia', 'concession-cl'), T('mp-result', 'Skutku', 'result-cl'), T('mp-manner', 'Sposobu', 'manner-cl'), T('mp-degree', 'Stopnia', 'degree-cl'),
        T('mp-cond', 'Warunkowe (0, I, II, III)', 'cond'), T('mp-wish', 'wish, it\'s time, had better, would rather', 'wish'),
        T('mp-inf-constr', 'Konstrukcje bezokolicznikowe', 'inf-constr'), T('mp-ger', 'Konstrukcje gerundialne', 'gerund'), T('mp-causative', 'have/get something done', 'causative'),
      ]},
    ]
  };

  const MATURA_R = {
    id: 'rozszerzenie', title: 'Poziom rozszerzony', level: 'B2+', color: '#7c3aed', emoji: '🟣',
    intro: 'Zakres na poziomie B2+ (C1 w rozumieniu). Obejmuje cały poziom podstawowy oraz konstrukcje zaawansowane. Wypowiedź pisemna: 200–250 wyrazów (tekst argumentacyjny).',
    cats: [
      { name: 'Czasownik (rozszerzenia)', emoji: '🏃', topics: [
        T('mr-perfect-modal', 'Perfect modals (must have done…)', 'perfect-modal'),
      ]},
      { name: 'Czasy (rozszerzenia)', emoji: '⏳', topics: [
        T('mr-future-perfect', 'Future Perfect', 'future-perfect'),
        T('mr-fpc', 'Future Perfect Continuous', 'future-perfect-continuous'),
        T('mr-ppc2', 'Past Perfect Continuous', 'past-perfect-continuous'),
      ]},
      { name: 'Rzeczownik / Przymiotnik', emoji: '📦', topics: [
        T('mr-plural-adv', 'Liczba mnoga (passer-by → passers-by)', 'plural-adv'),
        T('mr-adj-noun', 'Przymiotnik w funkcji rzeczownika (the rich)', 'adj-noun'),
        T('mr-adj-percep', 'Przymiotniki po czasownikach postrzegania', 'adj-percep'),
      ]},
      { name: 'Liczebnik', emoji: '🔢', topics: [
        T('mr-frac', 'Liczebniki ułamkowe', 'num-frac'),
        T('mr-dec', 'Liczebniki dziesiętne', 'num-dec'),
      ]},
      { name: 'Składnia (zaawansowana)', emoji: '🧱', topics: [
        T('mr-inversion', 'Inwersja stylistyczna (Rarely, Little…)', 'inversion'),
        T('mr-cleft', 'Zdania rozszczepione (It was… who…)', 'cleft'),
        T('mr-inv-cond', 'Odwrócone zdania warunkowe (Had I known…)', 'inv-cond'),
        T('mr-mixed-cond', 'Okresy warunkowe mieszane', 'mixed-cond'),
        T('mr-emphatic', 'Formy emfatyczne (do/did)', 'emphatic'),
        T('mr-passive-adv', 'Strona bierna — konstrukcje zaawansowane', 'passive-adv'),
        T('mr-causative2', 'have sb do / get sb to do', 'causative2'),
        T('mr-comp-correl', 'Konstrukcja korelacyjna (The more…, the…)', 'comp-correl'),
      ]},
    ]
  };

  window.EGZ_DATA = { th: TH, e8: E8, matura: { podstawa: MATURA_P, rozszerzenie: MATURA_R } };
})();
