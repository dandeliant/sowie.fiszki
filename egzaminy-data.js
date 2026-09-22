/* ============================================================
   SOWIE FISZKI — Egzaminy: dane (zagadnienia + teoria + ćwiczenia)
   Teoria współdzielona przez klucz (TH[key]) — E8 i Matura mogą
   wskazywać na to samo hasło. Kolejne zagadnienia dopisujemy tutaj.
   ============================================================ */
(function () {
  'use strict';

  // Skróty pomocnicze do pisania teorii w spójnym „notatkowym" stylu.
  const lead = t => `<p class="th-lead">▶️ ${t}</p>`;
  const h = t => `<h4 class="th-h">${t}</h4>`;
  const ul = arr => `<ul class="th-ul">${arr.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const ex = (en, pl) => `<div class="th-ex"><span class="th-en">⏺️ ${en}</span><span class="th-pl">📌 ${pl}</span></div>`;
  const tip = t => `<div class="th-tip">🧠 ${t}</div>`;
  const form = (rows) => `<div class="th-form">${rows.map(r => `<div class="th-form-row">${r}</div>`).join('')}</div>`;

  // ── TEORIA (klucze) ──────────────────────────────────────
  const TH = {};

  TH['have-got'] = {
    t: 'Czasownik „have got / have"',
    sub: 'posiadanie — „mieć"',
    html:
      lead('„have got" i „have" znaczą <b>mieć</b> (posiadać). „have got" jest częstsze w mowie i w brytyjskim angielskim.') +
      h('Forma — have got') +
      form([
        '✅ 👤 + <b>have/has got</b> + …',
        '❌ 👤 + <b>haven\'t/hasn\'t got</b> + …',
        '❓ <b>Have/Has</b> + 👤 + <b>got</b> + …?'
      ]) +
      ul([
        '<b>I / you / we / they</b> → <b>have got</b> (\'ve got)',
        '<b>he / she / it</b> → <b>has got</b> (\'s got)'
      ]) +
      h('Przykłady') +
      ex('I have got a dog. / I\'ve got a dog.', 'Mam psa.') +
      ex('She has got two brothers.', 'Ona ma dwóch braci.') +
      ex('They haven\'t got a car.', 'Oni nie mają samochodu.') +
      ex('Have you got a pencil?', 'Czy masz ołówek?') +
      h('„have" (bez „got")') +
      lead('Można też powiedzieć zwykłym „have" — wtedy pytania i przeczenia tworzymy z <b>do/does</b>.') +
      ex('I have a dog.  Do you have a dog?  She doesn\'t have a car.', 'Mam psa. Czy masz psa? Ona nie ma samochodu.') +
      tip('W krótkich odpowiedziach: <i>Yes, I have. / No, I haven\'t.</i> (dla „have got").'),
    ex: [
      { type: 'gap', q: 'She ____ got a new phone. (✓)', a: 'has', hint: 'he/she/it → has got' },
      { type: 'gap', q: 'They ____ got any money. (✗)', a: "haven't", hint: 'przeczenie: haven\'t got' },
      { type: 'mc', q: '____ you got a bike?', opts: ['Have', 'Has', 'Do'], a: 'Have' },
      { type: 'gap', q: 'I ____ got two sisters. (✓)', a: 'have' }
    ]
  };

  TH['infinitive'] = {
    t: 'Bezokolicznik i formy osobowe',
    sub: 'to work · works · worked',
    html:
      h('🔹 Bezokolicznik (infinitive)') +
      lead('Podstawowa forma czasownika: <b>to + czasownik</b>. Nie pokazuje, kto ani kiedy.') +
      ul([
        '<b>to</b> + czasownik → <i>to go, to eat, to learn</i>',
        'Bez „to" po czasownikach modalnych → <i>can go, must study</i>'
      ]) +
      ex('I want to work in a big company.', 'Chcę pracować w dużej firmie.') +
      ex('He can swim very well.', 'On potrafi bardzo dobrze pływać. (bez „to" po can)') +
      lead('Częste czasowniki, po których jest „to": <i>want, decide, hope, plan, promise, learn, need, agree, would like</i>.') +
      h('🔹 Forma osobowa (finite)') +
      lead('Forma, która zmienia się zależnie od <b>osoby</b> i <b>czasu</b> — mówi kto i kiedy.') +
      ul([
        'W 3. os. l.poj. (he/she/it) w Present Simple dodajemy <b>-s / -es</b>'
      ]) +
      ex('She works in a bank.', 'Ona pracuje w banku.') +
      ex('They worked yesterday.', 'Oni pracowali wczoraj.') +
      tip('Modalne (can, must, should, will, may) → zawsze <b>bez „to"</b>: <i>You must do your homework.</i>'),
    ex: [
      { type: 'mc', q: 'I want ____ English.', opts: ['learn', 'to learn', 'learning'], a: 'to learn' },
      { type: 'mc', q: 'You must ____ your homework.', opts: ['to do', 'do', 'doing'], a: 'do' },
      { type: 'gap', q: 'She ____ (work) in a shop. (Present Simple)', a: 'works' }
    ]
  };

  const modal = (name, uses, forms, kw, exs) => ({
    t: 'Czasownik modalny: ' + name.toUpperCase(),
    sub: 'modal verb',
    html:
      h('Użycie') + ul(uses) +
      h('Forma') + form(forms) +
      '<p class="th-star">⭐ Jedna forma dla wszystkich osób (I/he/she/it/we/you/they ' + name + ').</p>' +
      h('Przykłady') + exs.map(e => ex(e[0], e[1])).join('') +
      (kw ? tip(kw) : ''),
  });

  TH['can'] = Object.assign(modal('can',
    ['Umiejętności — co ktoś potrafi', 'Pozwolenie — prośba/udzielanie', 'Możliwość — coś jest realne'],
    ['✅ 👤 + <b>CAN</b> + czasownik (I forma)', '❌ 👤 + <b>CAN\'T / CANNOT</b> + czasownik', '❓ <b>CAN</b> + 👤 + czasownik …?'],
    'Krótkie odpowiedzi: <i>Yes, I can. / No, I can\'t.</i>',
    [['I can swim.', 'Umiem pływać.'], ['Can you help me?', 'Czy możesz mi pomóc?'], ['They can\'t come to the party.', 'Oni nie mogą przyjść na imprezę.']]
  ), {
    ex: [
      { type: 'mc', q: '____ you help me, please?', opts: ['Can', 'Cans', 'Do can'], a: 'Can' },
      { type: 'gap', q: 'I ____ swim, but I ____ ski. (potrafię / nie potrafię)', a: 'can / can\'t', hint: 'can … can\'t' },
      { type: 'mc', q: 'She ____ speak three languages.', opts: ['can', 'cans', 'can to'], a: 'can' }
    ]
  });

  TH['could'] = Object.assign(modal('could',
    ['Umiejętność w przeszłości', 'Uprzejma prośba', 'Możliwość / przypuszczenie'],
    ['✅ 👤 + <b>COULD</b> + czasownik', '❌ 👤 + <b>COULDN\'T</b> + czasownik', '❓ <b>COULD</b> + 👤 + czasownik …?'],
    '„Could you…?" jest grzeczniejsze niż „Can you…?".',
    [['I could read when I was six.', 'Umiałem czytać, gdy miałem sześć lat.'], ['Could you speak more slowly?', 'Czy mógłbyś mówić wolniej?'], ['I couldn\'t help you yesterday.', 'Nie mogłem ci wczoraj pomóc.']]
  ), {
    ex: [
      { type: 'mc', q: '____ you pass me the salt, please?', opts: ['Could', 'Couldn\'t', 'Do could'], a: 'Could' },
      { type: 'gap', q: 'When I was young, I ____ run very fast.', a: 'could' }
    ]
  });

  TH['may'] = Object.assign(modal('may',
    ['Prośba o pozwolenie (formalnie)', 'Możliwość / przypuszczenie (może)'],
    ['✅ 👤 + <b>MAY</b> + czasownik', '❌ 👤 + <b>MAY NOT</b> + czasownik', '❓ <b>MAY</b> + 👤 + czasownik …?'],
    '„May I…?" to bardzo grzeczna prośba o pozwolenie.',
    [['May I speak to Sam?', 'Czy mogę rozmawiać z Samem?'], ['My mother may still be at work.', 'Moja mama może wciąż być w pracy.'], ['You may stay longer if you want.', 'Możesz zostać dłużej, jeśli chcesz.']]
  ), {
    ex: [
      { type: 'mc', q: '____ I open the window?', opts: ['May', 'May to', 'Do may'], a: 'May' },
      { type: 'gap', q: 'It ____ rain later — take an umbrella. (może)', a: 'may' }
    ]
  });

  TH['must'] = Object.assign(modal('must',
    ['Obowiązek / konieczność (muszę)', 'Zakaz — mustn\'t (nie wolno)', 'Pewność / wniosek (na pewno)'],
    ['✅ 👤 + <b>MUST</b> + czasownik', '❌ 👤 + <b>MUSTN\'T</b> + czasownik', '❓ <b>MUST</b> + 👤 + czasownik …?'],
    '<b>mustn\'t</b> = zakaz (nie wolno). To nie to samo co <b>don\'t have to</b> (nie musisz).',
    [['I must finish it today.', 'Muszę to dzisiaj skończyć.'], ['You mustn\'t smoke here.', 'Nie wolno tu palić.'], ['It must be cold outside.', 'Na pewno jest zimno na dworze.']]
  ), {
    ex: [
      { type: 'mc', q: 'You ____ touch it — it\'s dangerous! (zakaz)', opts: ['mustn\'t', 'don\'t have to', 'may not'], a: 'mustn\'t' },
      { type: 'gap', q: 'I ____ finish my homework before dinner. (obowiązek)', a: 'must' }
    ]
  });

  TH['should'] = {
    t: 'Czasownik modalny: SHOULD',
    sub: 'rady i sugestie',
    html:
      h('Użycie') + ul(['Rady i sugestie — co warto/należy zrobić', 'Opinie — co jest słuszne/oczekiwane', 'Pytania o zalecenia', 'Oczekiwania — coś powinno się wydarzyć']) +
      h('Forma') + form(['✅ 👤 + <b>SHOULD</b> + czasownik (I forma)', '❌ 👤 + <b>SHOULDN\'T</b> + czasownik', '❓ <b>SHOULD</b> + 👤 + czasownik …?']) +
      '<p class="th-star">⭐ Jedna forma dla wszystkich osób.</p>' +
      h('Zwroty') + ul(['💬 You should… — Powinieneś…', '🙅 You shouldn\'t… — Nie powinieneś…', '❓ Should I…? — Czy powinienem…?', '📌 You should have… — Powinieneś był… (przeszłość)']) +
      h('Przykłady') +
      ex('You should study more before the test.', 'Powinieneś się więcej uczyć przed testem.') +
      ex('You shouldn\'t do it.', 'Nie powinieneś tego robić.') +
      ex('Where should I get off the bus?', 'Gdzie powinienem wysiąść z autobusu?'),
    ex: [
      { type: 'mc', q: 'You look tired. You ____ go to bed.', opts: ['should', 'shouldn\'t', 'must not'], a: 'should' },
      { type: 'gap', q: 'It\'s a museum — you ____ take photos here. (nie powinieneś)', a: 'shouldn\'t' }
    ]
  };

  // Czasy gramatyczne
  const tense = (name, use, forms, signals, exs, tipTxt) => ({
    t: name, sub: 'czas gramatyczny',
    html:
      h('Kiedy używamy?') + ul(use) +
      h('Budowa') + form(forms) +
      (signals ? h('Słowa-sygnały') + `<p class="th-signal">${signals}</p>` : '') +
      h('Przykłady') + exs.map(e => ex(e[0], e[1])).join('') +
      (tipTxt ? tip(tipTxt) : ''),
  });

  TH['present-simple'] = Object.assign(tense('Present Simple',
    ['Rutyna, nawyki, powtarzalne czynności', 'Fakty i prawdy ogólne', 'Plany według rozkładu (pociągi, lekcje)'],
    ['✅ 👤 + czasownik (+<b>s/es</b> dla he/she/it)', '❌ 👤 + <b>don\'t/doesn\'t</b> + czasownik', '❓ <b>Do/Does</b> + 👤 + czasownik …?'],
    'always, usually, often, sometimes, never, every day, on Mondays',
    [['She often visits her grandparents.', 'Ona często odwiedza dziadków.'], ['Water boils at 100°C.', 'Woda wrze w 100°C.'], ['I don\'t like coffee.', 'Nie lubię kawy.'], ['Does he play tennis?', 'Czy on gra w tenisa?']],
    'Pamiętaj o <b>-s/-es</b> w 3. os. l.poj.: <i>he plays, she watches, it goes</i>.'
  ), {
    ex: [
      { type: 'gap', q: 'He ____ (go) to school by bus.', a: 'goes' },
      { type: 'mc', q: '____ she like pizza?', opts: ['Do', 'Does', 'Is'], a: 'Does' },
      { type: 'gap', q: 'They ____ (not/watch) TV in the morning.', a: "don't watch" }
    ]
  });

  TH['present-continuous'] = Object.assign(tense('Present Continuous',
    ['Czynność dzieje się TERAZ, w tej chwili', 'Czynność tymczasowa (w tym okresie)', 'Ustalone plany na przyszłość'],
    ['✅ 👤 + <b>am/is/are</b> + czasownik-<b>ing</b>', '❌ 👤 + <b>am/is/are + not</b> + czasownik-ing', '❓ <b>Am/Is/Are</b> + 👤 + czasownik-ing …?'],
    'now, at the moment, right now, today, Look!, Listen!',
    [['She is working in the garden at the moment.', 'Ona teraz pracuje w ogrodzie.'], ['Look! It\'s raining.', 'Patrz! Pada deszcz.'], ['We\'re meeting Tom tomorrow.', 'Spotykamy się jutro z Tomem.']],
    'Pisownia -ing: <i>run → running, make → making, sit → sitting</i>.'
  ), {
    ex: [
      { type: 'gap', q: 'Listen! The baby ____ (cry).', a: 'is crying' },
      { type: 'mc', q: 'What ____ you doing now?', opts: ['are', 'is', 'do'], a: 'are' }
    ]
  });

  TH['present-perfect'] = Object.assign(tense('Present Perfect',
    ['Czynność z przeszłości z wynikiem/skutkiem TERAZ', 'Doświadczenia życiowe (kiedykolwiek)', 'Czynność, która trwa od jakiegoś czasu (for/since)'],
    ['✅ 👤 + <b>have/has</b> + III forma (past participle)', '❌ 👤 + <b>haven\'t/hasn\'t</b> + III forma', '❓ <b>Have/Has</b> + 👤 + III forma …?'],
    'just, already, yet, ever, never, since, for',
    [['I\'ve just seen my teacher.', 'Właśnie widziałem nauczyciela.'], ['She has lived here since 2019.', 'Ona mieszka tu od 2019.'], ['Have you ever been to London?', 'Czy byłeś kiedyś w Londynie?']],
    '<b>for</b> + okres (for two years), <b>since</b> + punkt w czasie (since Monday).'
  ), {
    ex: [
      { type: 'gap', q: 'I ____ (finish) my homework. (już skończone)', a: 'have finished' },
      { type: 'mc', q: 'She has lived here ____ 2020.', opts: ['for', 'since', 'from'], a: 'since' },
      { type: 'mc', q: 'Have you ____ eaten sushi?', opts: ['ever', 'yet', 'since'], a: 'ever' }
    ]
  });

  TH['past-simple'] = Object.assign(tense('Past Simple',
    ['Zakończona czynność w przeszłości (kiedy?)', 'Ciąg wydarzeń w przeszłości', 'Fakty i zwyczaje z przeszłości'],
    ['✅ 👤 + czasownik-<b>ed</b> / II forma (nieregularne)', '❌ 👤 + <b>didn\'t</b> + czasownik (I forma)', '❓ <b>Did</b> + 👤 + czasownik (I forma) …?'],
    'yesterday, last week, in 1492, two days ago, when',
    [['Columbus discovered America in 1492.', 'Kolumb odkrył Amerykę w 1492.'], ['We didn\'t go out last night.', 'Nie wyszliśmy wczoraj wieczorem.'], ['Did you see the film?', 'Czy widziałeś ten film?']],
    'Nieregularne trzeba znać na pamięć: <i>go → went, see → saw, buy → bought</i>.'
  ), {
    ex: [
      { type: 'gap', q: 'They ____ (buy) a new house last year.', a: 'bought' },
      { type: 'mc', q: '____ you visit your grandma yesterday?', opts: ['Did', 'Do', 'Were'], a: 'Did' },
      { type: 'gap', q: 'She ____ (not/like) the food.', a: "didn't like" }
    ]
  });

  TH['past-continuous'] = Object.assign(tense('Past Continuous',
    ['Czynność trwająca w konkretnym momencie w przeszłości', 'Tło dla innej, krótszej czynności (when/while)', 'Dwie równoległe czynności'],
    ['✅ 👤 + <b>was/were</b> + czasownik-<b>ing</b>', '❌ 👤 + <b>wasn\'t/weren\'t</b> + czasownik-ing', '❓ <b>Was/Were</b> + 👤 + czasownik-ing …?'],
    'at 8 o\'clock, while, when, as, all day',
    [['We were watching TV at ten o\'clock last night.', 'Wczoraj o 22:00 oglądaliśmy telewizję.'], ['While I was cooking, the phone rang.', 'Kiedy gotowałem, zadzwonił telefon.']],
    '<b>while</b> + Past Continuous, <b>when</b> + Past Simple (krótka czynność).'
  ), {
    ex: [
      { type: 'gap', q: 'At 7 p.m. yesterday I ____ (have) dinner.', a: 'was having' },
      { type: 'mc', q: 'While she ____ reading, I was cooking.', opts: ['was', 'were', 'did'], a: 'was' }
    ]
  });

  TH['future-simple'] = Object.assign(tense('Future Simple (will)',
    ['Decyzje podjęte w chwili mówienia', 'Przewidywania, przypuszczenia', 'Obietnice, propozycje, prośby'],
    ['✅ 👤 + <b>will</b> + czasownik (I forma)', '❌ 👤 + <b>won\'t</b> + czasownik', '❓ <b>Will</b> + 👤 + czasownik …?'],
    'tomorrow, next week, I think, probably, maybe',
    [['I will call you tomorrow.', 'Zadzwonię do ciebie jutro.'], ['It won\'t rain today.', 'Dziś nie będzie padać.'], ['Will you help me?', 'Czy mi pomożesz?']],
    'Jedna forma dla wszystkich osób. Skrót: <i>I\'ll, he\'ll, won\'t</i>.'
  ), {
    ex: [
      { type: 'gap', q: 'I think it ____ (be) sunny tomorrow.', a: 'will be' },
      { type: 'mc', q: '____ you open the door, please?', opts: ['Will', 'Do', 'Are'], a: 'Will' }
    ]
  });

  TH['be-going-to'] = {
    t: 'Konstrukcja „be going to"', sub: 'plany i przewidywania',
    html:
      h('Kiedy używamy?') + ul(['Plany i zamiary (zaplanowane wcześniej)', 'Przewidywania oparte na tym, co widać teraz']) +
      h('Budowa') + form(['✅ 👤 + <b>am/is/are going to</b> + czasownik', '❌ 👤 + <b>am/is/are not going to</b> + czasownik', '❓ <b>Am/Is/Are</b> + 👤 + <b>going to</b> + czasownik …?']) +
      h('Przykłady') +
      ex('I\'m going to give a party on Saturday.', 'Zamierzam wydać przyjęcie w sobotę.') +
      ex('Look at those clouds! It\'s going to rain.', 'Popatrz na te chmury! Będzie padać.'),
    ex: [
      { type: 'gap', q: 'She ____ going to visit her aunt. (is/are)', a: 'is' },
      { type: 'mc', q: 'Look! He ____ going to fall!', opts: ['is', 'are', 'will'], a: 'is' }
    ]
  };

  TH['have-to'] = {
    t: 'Konstrukcja „have to"', sub: 'przymus zewnętrzny',
    html:
      h('Znaczenie') + ul(['<b>have to</b> = musieć (obowiązek, często narzucony z zewnątrz — reguły, przepisy)', '<b>don\'t have to</b> = nie musieć (brak konieczności) — UWAGA: to nie zakaz!']) +
      h('Budowa') + form(['✅ 👤 + <b>have/has to</b> + czasownik', '❌ 👤 + <b>don\'t/doesn\'t have to</b> + czasownik', '❓ <b>Do/Does</b> + 👤 + <b>have to</b> + czasownik …?']) +
      h('Przykłady') +
      ex('He has to go there.', 'On musi tam pójść.') +
      ex('I don\'t have to do it.', 'Nie muszę tego robić.') +
      ex('Do you have to wear a uniform?', 'Czy musisz nosić mundurek?') +
      tip('W przeszłości: <b>had to</b> (musiałem), <b>didn\'t have to</b> (nie musiałem).'),
    ex: [
      { type: 'gap', q: 'She ____ to get up early. (he/she/it)', a: 'has' },
      { type: 'mc', q: 'It\'s Sunday — we ____ go to school.', opts: ['don\'t have to', 'mustn\'t', 'haven\'t'], a: 'don\'t have to' }
    ]
  };

  TH['would-like-to'] = {
    t: 'Konstrukcja „would like to"', sub: 'grzeczne „chciałbym"',
    html:
      h('Znaczenie') + ul(['<b>would like (to)</b> = chciałbym — grzeczniejsze niż „want"', 'Do propozycji i próśb']) +
      h('Budowa') + form(['✅ 👤 + <b>would like to</b> + czasownik / + rzeczownik', '❓ <b>Would</b> + 👤 + <b>like to</b> …? / <b>Would you like</b> …?']) +
      h('Przykłady') +
      ex('I would like to meet him.', 'Chciałbym go poznać.') +
      ex('Would you like some tea?', 'Czy chciałbyś herbaty?') +
      ex('She\'d like to travel to Japan.', 'Ona chciałaby pojechać do Japonii.') +
      tip('Skrót: <b>\'d like</b> (I\'d like, he\'d like).'),
    ex: [
      { type: 'mc', q: '____ you like a cup of coffee?', opts: ['Would', 'Do', 'Are'], a: 'Would' },
      { type: 'gap', q: 'I ____ like to go home now. (skrót \'d rozwiń: would)', a: 'would' }
    ]
  };

  TH['compound-nouns'] = {
    t: 'Rzeczowniki złożone', sub: 'Compound Nouns',
    html:
      lead('Rzeczowniki złożone to wyrazy z <b>dwóch lub więcej słów</b>, które razem tworzą jedno znaczenie.') +
      h('Rodzaje zapisu') +
      ul(['jedno słowo (closed): <i>toothpaste</i> — pasta do zębów', 'z łącznikiem (hyphenated): <i>sister-in-law</i> — szwagierka', 'dwa słowa (open): <i>washing machine</i> — pralka']) +
      h('Najczęstsze struktury') +
      ul(['rzeczownik + rzeczownik → <i>bus stop, toothbrush</i>', 'czasownik + rzeczownik → <i>washing machine, swimming pool</i>', 'przymiotnik + rzeczownik → <i>blackboard, full moon</i>']) +
      h('Liczba mnoga') +
      lead('Zwykle odmienia się <b>główny</b> rzeczownik:') +
      ul(['toothbrush → toothbrush<b>es</b>', 'sister-in-law → sister<b>s</b>-in-law', '❗ NIE: sister-in-laws']) +
      tip('Akcent zwykle na pierwszym członie: \'TOOTHpaste, \'BLACKboard.'),
    ex: [
      { type: 'mc', q: 'Liczba mnoga „sister-in-law" to:', opts: ['sister-in-laws', 'sisters-in-law', 'sisters-in-laws'], a: 'sisters-in-law' },
      { type: 'gap', q: 'We wash clothes in a washing ____.', a: 'machine' }
    ]
  };

  // ── STRUKTURA ZAGADNIEŃ ──────────────────────────────────
  // topic: { id, t (tytuł), k (klucz teorii, opcjonalnie) }
  const T = (id, t, k) => ({ id, t, k: k || null });

  const E8 = {
    id: 'e8', title: 'Egzamin Ósmoklasisty', short: 'E8', subject: 'Język angielski',
    color: '#3b82f6', emoji: '📘',
    intro: 'Zagadnienia gramatyczne i typy zadań na egzaminie ósmoklasisty z języka angielskiego. Klikaj w temat, aby poznać teorię i poćwiczyć.',
    cats: [
      { name: 'Czasownik', emoji: '🏃', topics: [
        T('e8-have-got', 'Have got / have — „mieć"', 'have-got'),
        T('e8-infinitive', 'Bezokolicznik i formy osobowe', 'infinitive'),
        T('e8-aux', 'Czasowniki posiłkowe (be, do)'),
        T('e8-can', 'Modalny: can', 'can'),
        T('e8-could', 'Modalny: could', 'could'),
        T('e8-may', 'Modalny: may', 'may'),
        T('e8-must', 'Modalny: must', 'must'),
        T('e8-should', 'Modalny: should', 'should'),
        T('e8-imperative', 'Tryb rozkazujący'),
        T('e8-reg-irreg', 'Czasowniki regularne i nieregularne'),
        T('e8-participles', 'Imiesłów czynny i bierny'),
        T('e8-state', 'Czasowniki wyrażające stany'),
        T('e8-phrasal', 'Czasowniki złożone (phrasal verbs)'),
        T('e8-present-simple', 'Present Simple', 'present-simple'),
        T('e8-present-continuous', 'Present Continuous', 'present-continuous'),
        T('e8-present-perfect', 'Present Perfect', 'present-perfect'),
        T('e8-past-simple', 'Past Simple', 'past-simple'),
        T('e8-past-continuous', 'Past Continuous', 'past-continuous'),
        T('e8-future-simple', 'Future Simple', 'future-simple'),
        T('e8-going-to', 'be going to', 'be-going-to'),
        T('e8-have-to', 'have to', 'have-to'),
        T('e8-would-like', 'would like to', 'would-like-to'),
      ]},
      { name: 'Rzeczownik', emoji: '📦', topics: [
        T('e8-count', 'Policzalne i niepoliczalne'),
        T('e8-plural', 'Liczba mnoga (reg. i niereg.)'),
        T('e8-possessive', 'Forma dzierżawcza (\'s)'),
        T('e8-compound', 'Rzeczowniki złożone', 'compound-nouns'),
      ]},
      { name: 'Przedimek', emoji: '🔤', topics: [
        T('e8-art-a', 'Przedimek nieokreślony (a/an)'),
        T('e8-art-the', 'Przedimek określony (the)'),
        T('e8-art-zero', 'Przedimek zerowy'),
      ]},
      { name: 'Przymiotnik', emoji: '🎨', topics: [
        T('e8-adj-comp', 'Stopniowanie przymiotników'),
        T('e8-so-such', 'so, such, how, what'),
        T('e8-adj-poss', 'Przymiotniki dzierżawcze (my, his)'),
      ]},
      { name: 'Przysłówek', emoji: '⚡', topics: [
        T('e8-adv-comp', 'Stopniowanie przysłówków'),
        T('e8-too-enough', 'too i enough'),
        T('e8-adv-place', 'Miejsce przysłówka w zdaniu'),
      ]},
      { name: 'Zaimek', emoji: '👉', topics: [
        T('e8-pron-subj', 'Osobowe (podmiot): I, we'),
        T('e8-pron-poss', 'Dzierżawcze: mine, yours'),
        T('e8-pron-refl', 'Zwrotne/emfatyczne: myself'),
        T('e8-pron-dem', 'Wskazujące: this, those'),
        T('e8-pron-int', 'Pytające: who, what, which'),
        T('e8-pron-rel', 'Względne: who, which, that'),
        T('e8-pron-indef', 'Nieokreślone: some, any, much, many'),
        T('e8-pron-you', 'Bezosobowe you'),
        T('e8-pron-one', 'one / ones'),
      ]},
      { name: 'Liczebnik', emoji: '🔢', topics: [
        T('e8-num-card', 'Główne (one, a thousand)'),
        T('e8-num-ord', 'Porządkowe (the first)'),
      ]},
      { name: 'Przyimek', emoji: '🧭', topics: [
        T('e8-prep-place', 'Miejsce, kierunek, odległość'),
        T('e8-prep-time', 'Czas (on, in, at)'),
        T('e8-prep-manner', 'Sposób (by bus, with)'),
        T('e8-prep-verbs', 'Po czasownikach i przymiotnikach'),
      ]},
      { name: 'Spójnik', emoji: '🔗', topics: [
        T('e8-conj', 'Spójniki (and, or, because, if…)'),
      ]},
      { name: 'Składnia', emoji: '🧱', topics: [
        T('e8-sentences', 'Zdania twierdzące/przeczące/pytające'),
        T('e8-it', 'Zdania z podmiotem it'),
        T('e8-there', 'Zdania z podmiotem there'),
        T('e8-two-obj', 'Zdania z dwoma dopełnieniami'),
        T('e8-passive', 'Strona bierna'),
        T('e8-coord', 'Zdania współrzędnie złożone'),
        T('e8-rel', 'Podrzędne: przydawkowe'),
        T('e8-purpose', 'Podrzędne: okolicznikowe celu'),
        T('e8-time', 'Podrzędne: okolicznikowe czasu'),
        T('e8-place', 'Podrzędne: okolicznikowe miejsca'),
        T('e8-cause', 'Podrzędne: okolicznikowe przyczyny'),
        T('e8-result', 'Podrzędne: okolicznikowe skutku'),
        T('e8-cond', 'Okolicznikowe warunku (0, I)'),
        T('e8-ger-inf', 'Bezokolicznik i gerund'),
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
        T('mp-aux', 'Czasowniki posiłkowe (be, do, have)'),
        T('mp-can', 'Modalny: can', 'can'),
        T('mp-could', 'Modalny: could', 'could'),
        T('mp-may', 'Modalny: may', 'may'),
        T('mp-might', 'Modalny: might'),
        T('mp-must', 'Modalny: must; have to', 'must'),
        T('mp-will', 'Modalny: will'),
        T('mp-shall', 'Modalny: shall'),
        T('mp-would', 'Modalny: would'),
        T('mp-should', 'Modalny: should; ought to', 'should'),
        T('mp-need', 'Modalny: need; need to'),
        T('mp-used-to', 'used to'),
        T('mp-going-to', 'be going to', 'be-going-to'),
        T('mp-able', 'be able to'),
        T('mp-would-like', 'would like to', 'would-like-to'),
        T('mp-reg', 'Regularne i nieregularne'),
        T('mp-part', 'Imiesłów czynny i bierny'),
        T('mp-phrasal', 'Phrasal verbs'),
        T('mp-present-simple', 'Present Simple', 'present-simple'),
        T('mp-present-continuous', 'Present Continuous', 'present-continuous'),
        T('mp-present-perfect', 'Present Perfect', 'present-perfect'),
        T('mp-ppc', 'Present Perfect Continuous'),
        T('mp-past-simple', 'Past Simple', 'past-simple'),
        T('mp-past-continuous', 'Past Continuous', 'past-continuous'),
        T('mp-past-perfect', 'Past Perfect'),
        T('mp-future-simple', 'Future Simple', 'future-simple'),
        T('mp-future-continuous', 'Future Continuous'),
      ]},
      { name: 'Rzeczownik', emoji: '📦', topics: [
        T('mp-count', 'Policzalne i niepoliczalne'),
        T('mp-plural', 'Liczba mnoga (reg. i niereg.)'),
        T('mp-sing-plur', 'Tylko l.poj. / tylko l.mn.'),
        T('mp-poss', 'Forma dzierżawcza'),
        T('mp-gender', 'Rodzaj (actor – actress)'),
        T('mp-compound', 'Rzeczowniki złożone', 'compound-nouns'),
      ]},
      { name: 'Przedimek', emoji: '🔤', topics: [
        T('mp-art-a', 'Nieokreślony (a/an)'),
        T('mp-art-the', 'Określony (the)'),
        T('mp-art-zero', 'Zerowy'),
      ]},
      { name: 'Przymiotnik', emoji: '🎨', topics: [
        T('mp-adj-comp', 'Stopniowanie'),
        T('mp-so-such', 'so, such'),
        T('mp-adj-poss', 'Dzierżawcze'),
      ]},
      { name: 'Przysłówek', emoji: '⚡', topics: [
        T('mp-adv-comp', 'Stopniowanie'),
        T('mp-adv-forms', 'Formy o dwóch znaczeniach (hard/hardly)'),
        T('mp-too-enough', 'too i enough'),
        T('mp-adv-place', 'Miejsce w zdaniu'),
      ]},
      { name: 'Zaimek', emoji: '👉', topics: [
        T('mp-pron-subj', 'Osobowe'), T('mp-pron-poss', 'Dzierżawcze'), T('mp-pron-refl', 'Zwrotne/emfatyczne'),
        T('mp-pron-dem', 'Wskazujące'), T('mp-pron-int', 'Pytające'), T('mp-pron-rel', 'Względne'),
        T('mp-pron-recip', 'Wzajemne (each other)'), T('mp-pron-indef', 'Nieokreślone'), T('mp-pron-imp', 'Bezosobowe (you, one)'), T('mp-pron-one', 'one / ones'),
      ]},
      { name: 'Liczebnik', emoji: '🔢', topics: [ T('mp-num-card', 'Główne'), T('mp-num-ord', 'Porządkowe') ]},
      { name: 'Przyimek', emoji: '🧭', topics: [
        T('mp-prep-place', 'Miejsce, kierunek'), T('mp-prep-time', 'Czas'), T('mp-prep-manner', 'Sposób'), T('mp-prep-verbs', 'Po czasownikach/przymiotnikach'),
      ]},
      { name: 'Spójnik', emoji: '🔗', topics: [ T('mp-conj', 'Spójniki') ]},
      { name: 'Składnia', emoji: '🧱', topics: [
        T('mp-sentences', 'Twierdzące/przeczące/pytające'), T('mp-imperative', 'Tryb rozkazujący'), T('mp-excl', 'Wykrzyknikowe (how, what)'),
        T('mp-it', 'Podmiot it'), T('mp-there', 'Podmiot there'), T('mp-two-obj', 'Dwa dopełnienia'),
        T('mp-passive', 'Strona bierna'), T('mp-tags', 'Question tags'), T('mp-indirect-q', 'Pytania pośrednie'), T('mp-reported', 'Mowa zależna'),
        T('mp-coord', 'Współrzędnie złożone'), T('mp-subj-cl', 'Podmiotowe'), T('mp-pred-cl', 'Orzecznikowe'), T('mp-obj-cl', 'Dopełnieniowe'),
        T('mp-rel', 'Przydawkowe'), T('mp-purpose', 'Celu'), T('mp-time', 'Czasu'), T('mp-place', 'Miejsca'), T('mp-cause2', 'Przyczyny'),
        T('mp-compare', 'Porównawcze'), T('mp-concession', 'Przyzwolenia'), T('mp-result', 'Skutku'), T('mp-manner', 'Sposobu'), T('mp-degree', 'Stopnia'),
        T('mp-cond', 'Warunkowe (0, I, II, III)'), T('mp-wish', 'wish, it\'s time, had better, would rather'),
        T('mp-inf-constr', 'Konstrukcje bezokolicznikowe'), T('mp-ger', 'Konstrukcje gerundialne'), T('mp-causative', 'have/get something done'),
      ]},
    ]
  };

  const MATURA_R = {
    id: 'rozszerzenie', title: 'Poziom rozszerzony', level: 'B2+', color: '#7c3aed', emoji: '🟣',
    intro: 'Zakres na poziomie B2+ (C1 w rozumieniu). Obejmuje cały poziom podstawowy oraz konstrukcje zaawansowane. Wypowiedź pisemna: 200–250 wyrazów (tekst argumentacyjny).',
    cats: [
      { name: 'Czasownik (rozszerzenia)', emoji: '🏃', topics: [
        T('mr-perfect-modal', 'Perfect modals (must have done…)'),
        T('mr-future-perfect', 'Future Perfect'),
        T('mr-fpc', 'Future Perfect Continuous'),
        T('mr-ppc2', 'Past Perfect Continuous'),
      ]},
      { name: 'Rzeczownik / Przymiotnik', emoji: '📦', topics: [
        T('mr-plural-adv', 'Liczba mnoga (passer-by → passers-by)'),
        T('mr-adj-noun', 'Przymiotnik w funkcji rzeczownika (the rich)'),
        T('mr-adj-percep', 'Przymiotniki po czasownikach postrzegania'),
      ]},
      { name: 'Liczebnik', emoji: '🔢', topics: [
        T('mr-frac', 'Liczebniki ułamkowe'),
        T('mr-dec', 'Liczebniki dziesiętne'),
      ]},
      { name: 'Składnia (zaawansowana)', emoji: '🧱', topics: [
        T('mr-inversion', 'Inwersja stylistyczna (Rarely, Little…)'),
        T('mr-cleft', 'Zdania rozszczepione (It was… who…)'),
        T('mr-inv-cond', 'Odwrócone zdania warunkowe (Had I known…)'),
        T('mr-mixed-cond', 'Okresy warunkowe mieszane'),
        T('mr-emphatic', 'Formy emfatyczne (do/did)'),
        T('mr-passive-adv', 'Strona bierna — konstrukcje zaawansowane'),
        T('mr-causative2', 'have sb do / get sb to do'),
        T('mr-comp-correl', 'Konstrukcja korelacyjna (The more…, the…)'),
      ]},
    ]
  };

  window.EGZ_DATA = { th: TH, e8: E8, matura: { podstawa: MATURA_P, rozszerzenie: MATURA_R } };
})();
