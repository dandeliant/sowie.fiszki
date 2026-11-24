/* ============================================================
   TutorFlow — seed.js
   Generator realistycznych danych demonstracyjnych.
   Deterministyczny (RNG z ziarnem) — te same dane po każdym
   uruchomieniu, ale rozłożone względem DZISIEJSZEJ daty.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;

  /* ---------------- Tematy zajęć ---------------- */
  const TOPICS = {
    'Angielski': [
      'Present Perfect vs Past Simple', 'Czasowniki modalne', 'Mowa zależna', 'Phrasal verbs — ruch',
      'Speaking: opis obrazka', 'Listening — rozmowa w sklepie', 'Writing: e-mail formalny',
      'Conditionals 1 i 2', 'Strona bierna', 'Słownictwo: praca i kariera', 'Przedimki a/an/the',
      'Used to / would', 'Reading: artykuł prasowy', 'Czasy przyszłe', 'Idiomy codzienne'
    ],
    'Matematyka': [
      'Funkcja kwadratowa', 'Układy równań', 'Twierdzenie Pitagorasa', 'Procenty w zadaniach',
      'Ciągi arytmetyczne', 'Geometria analityczna', 'Wyrażenia algebraiczne', 'Stereometria — graniastosłupy',
      'Rachunek prawdopodobieństwa', 'Trygonometria', 'Nierówności', 'Pola figur płaskich', 'Logarytmy'
    ],
    'Niemiecki': [
      'Perfekt — czasowniki mocne', 'Deklinacja przymiotnika', 'Zdania poboczne z weil', 'Słownictwo: podróże',
      'Konjunktiv II', 'Przyimki z celownikiem', 'Rozmowa: u lekarza', 'Rodzajniki', 'Czas przeszły Präteritum'
    ],
    'Polski': [
      'Analiza wiersza — środki stylistyczne', 'Rozprawka maturalna', 'Lektura: „Dziady” cz. III',
      'Interpunkcja w zdaniu złożonym', 'Streszczenie logiczne', 'Motyw wędrówki w literaturze',
      'Charakterystyka bohatera', 'Epoki literackie — romantyzm'
    ]
  };

  const PROGRESS_NOTES = [
    'Świetnie radzi sobie z czytaniem ze zrozumieniem, ale nadal myli czasy przeszłe.',
    'Bardzo systematyczny — praca domowa zawsze na czas. Warto podnieść poziom trudności.',
    'Potrzebuje więcej ćwiczeń ustnych, pisze znacznie lepiej niż mówi.',
    'Duży postęp w słownictwie. Nadal blokuje się przy dłuższych wypowiedziach.',
    'Rodzic prosi o dodatkowe materiały przed sprawdzianem.',
    'Widać efekty regularności — ostatni test 82%.',
    'Ma tendencję do zgadywania zamiast analizy zadania. Pracujemy nad metodą.',
    'Bardzo szybko liczy w pamięci, gubi się przy zadaniach tekstowych.',
    'Zmotywowany przed egzaminem, prosi o dodatkowe zajęcia w kwietniu.',
    'Trzeba wrócić do podstaw gramatyki — luki z poprzedniej klasy.'
  ];

  /* ---------------- Uczniowie ---------------- */
  /* slots: [dzień 0=pon, godzina, długość] */
  const PEOPLE = [
    { fn: 'Anna',    ln: 'Kowalska',      subject: 'Angielski',   level: 'B1',            grade: '2 LO',  school: 'II LO im. Konopnickiej', mode: 'onsite', rate: 80,  monthsAgo: 11, slots: [[0, '15:00', 60], [3, '15:00', 60]], status: 'active' },
    { fn: 'Jakub',   ln: 'Nowak',         subject: 'Angielski',   level: 'Egzamin ósmoklasisty', grade: '8 SP', school: 'SP nr 14',        mode: 'onsite', rate: 90,  monthsAgo: 8,  slots: [[0, '16:15', 60], [2, '18:15', 60]], status: 'active' },
    { fn: 'Maja',    ln: 'Zielińska',     subject: 'Angielski',   level: 'A2',            grade: '6 SP',  school: 'SP nr 3',              mode: 'online', rate: 75,  monthsAgo: 6,  slots: [[0, '17:30', 60]], status: 'active' },
    { fn: 'Filip',   ln: 'Wójcik',        subject: 'Matematyka',  level: 'Rozszerzenie',  grade: '3 LO',  school: 'V LO',                 mode: 'onsite', rate: 100, monthsAgo: 9,  slots: [[1, '15:00', 60]], status: 'active' },
    { fn: 'Zofia',   ln: 'Lewandowska',   subject: 'Angielski',   level: 'B2 / Cambridge',grade: '3 LO',  school: 'I LO',                 mode: 'onsite', rate: 95,  monthsAgo: 12, slots: [[1, '16:15', 90]], status: 'active' },
    { fn: 'Antoni',  ln: 'Kamiński',      subject: 'Matematyka',  level: 'Podstawa',      grade: '1 LO',  school: 'Technikum nr 2',       mode: 'online', rate: 85,  monthsAgo: 4,  slots: [[1, '18:00', 60]], status: 'active' },
    { fn: 'Lena',    ln: 'Dąbrowska',     subject: 'Angielski',   level: 'A2+',           grade: '7 SP',  school: 'SP nr 21',             mode: 'onsite', rate: 60,  monthsAgo: 10, slots: [[2, '15:30', 60]], status: 'active' },
    { fn: 'Szymon',  ln: 'Piotrowski',    subject: 'Niemiecki',   level: 'A1',            grade: '2 LO',  school: 'IX LO',                mode: 'online', rate: 85,  monthsAgo: 5,  slots: [[2, '17:00', 60]], status: 'active' },
    { fn: 'Julia',   ln: 'Wiśniewska',    subject: 'Polski',      level: 'Matura',        grade: '4 LO',  school: 'III LO',               mode: 'onsite', rate: 110, monthsAgo: 7,  slots: [[3, '16:00', 90], [4, '18:00', 60]], status: 'active' },
    { fn: 'Kacper',  ln: 'Mazur',         subject: 'Matematyka',  level: 'Egzamin ósmoklasisty', grade: '8 SP', school: 'SP nr 7',        mode: 'onsite', rate: 90,  monthsAgo: 3,  slots: [[3, '18:00', 60]], status: 'active' },
    { fn: 'Alicja',  ln: 'Krawczyk',      subject: 'Angielski',   level: 'A1',            grade: '4 SP',  school: 'SP nr 3',              mode: 'onsite', rate: 65,  monthsAgo: 6,  slots: [[4, '15:00', 45]], status: 'active' },
    { fn: 'Nikodem', ln: 'Grabowski',     subject: 'Angielski',   level: 'B1',            grade: '1 LO',  school: 'Technikum nr 5',       mode: 'online', rate: 80,  monthsAgo: 5,  slots: [[4, '16:30', 60]], status: 'paused', pausedWeeksAgo: 3 },
    { fn: 'Hanna',   ln: 'Sikora',        subject: 'Angielski',   level: 'B1',            grade: '3 LO',  school: 'IV LO',                mode: 'onsite', rate: 80,  monthsAgo: 9,  slots: [[5, '10:00', 60]], status: 'ended', endedWeeksAgo: 6 }
  ];

  const MATERIALS = [
    { t: 'Present Perfect — karta ćwiczeń', ty: 'pdf' },
    { t: 'Egzamin ósmoklasisty 2024 — arkusz', ty: 'exam' },
    { t: 'Fiszki: phrasal verbs', ty: 'link', url: 'https://quizlet.com' },
    { t: 'Wymowa — końcówka -ed', ty: 'youtube', url: 'https://youtube.com' },
    { t: 'Zestaw zadań: funkcja kwadratowa', ty: 'exercise' },
    { t: 'Matura próbna — matematyka podstawowa', ty: 'exam' },
    { t: 'Słownictwo B2: praca i kariera', ty: 'pdf' },
    { t: 'Rozprawka — schemat i przykłady', ty: 'note' },
    { t: 'Listening practice A2', ty: 'youtube', url: 'https://youtube.com' },
    { t: 'Deklinacja przymiotnika — tabela', ty: 'pdf' },
    { t: 'Praca domowa: ćw. 4–7 s. 45', ty: 'homework' },
    { t: 'Trygonometria — wzory do wydruku', ty: 'pdf' }
  ];

  const GOALS = [
    { t: 'Egzamin ósmoklasisty — min. 80%', p: 62 },
    { t: 'Cambridge B2 First', p: 45 },
    { t: 'Poprawa speakingu', p: 70 },
    { t: 'Ocena 5 na koniec roku', p: 55 },
    { t: 'Matura rozszerzona — 70%', p: 38 },
    { t: 'Płynna rozmowa o codzienności', p: 80 },
    { t: 'Nadrobienie zaległości z klasy 7', p: 90 },
    { t: 'Matura z polskiego — 75%', p: 48 }
  ];

  const EXPENSES = [
    { c: 'software', a: 49, d: 'Subskrypcja platformy do fiszek' },
    { c: 'books', a: 129, d: 'Podręcznik B2 + ćwiczenia' },
    { c: 'printing', a: 38, d: 'Wydruk arkuszy egzaminacyjnych' },
    { c: 'internet', a: 79, d: 'Internet — abonament' },
    { c: 'ads', a: 150, d: 'Ogłoszenie na portalu z korepetycjami' },
    { c: 'equipment', a: 260, d: 'Słuchawki z mikrofonem' },
    { c: 'materials', a: 64, d: 'Zeszyty, długopisy, teczki' },
    { c: 'transport', a: 92, d: 'Dojazdy do uczniów' },
    { c: 'software', a: 49, d: 'Subskrypcja platformy do fiszek' },
    { c: 'books', a: 86, d: 'Zbiór zadań maturalnych' },
    { c: 'printing', a: 24, d: 'Ksero materiałów' },
    { c: 'internet', a: 79, d: 'Internet — abonament' },
    { c: 'transport', a: 78, d: 'Dojazdy do uczniów' },
    { c: 'software', a: 49, d: 'Subskrypcja platformy do fiszek' },
    { c: 'other', a: 45, d: 'Kawa i drobne podczas zajęć w kawiarni' }
  ];

  const TASKS = [
    { t: 'Sprawdzić pracę pisemną Anny', p: 'high', dueIn: 0 },
    { t: 'Przygotować test powtórkowy dla Jakuba', p: 'high', dueIn: 1 },
    { t: 'Wysłać materiały Mai', p: 'med', dueIn: 2 },
    { t: 'Przypomnieć o płatności — Lena', p: 'high', dueIn: -1 },
    { t: 'Zamówić nowy zbiór zadań', p: 'low', dueIn: 9 },
    { t: 'Zaplanować powtórki przed maturą', p: 'med', dueIn: 5 },
    { t: 'Zaktualizować cennik od nowego semestru', p: 'low', dueIn: 14 }
  ];

  /* ============================================================
     GENERATOR
     ============================================================ */
  function generate() {
    const rand = U.rng(20260827);
    const today = U.today();
    const horizonEnd = U.addDays(today, 24);

    const students = [], lessons = [], payments = [], packages = [],
      notes = [], materials = [], goals = [], homework = [], tasks = [], expenses = [];

    /* ---- uczniowie ---- */
    PEOPLE.forEach((p, idx) => {
      const start = U.addDays(U.addMonths(today, -p.monthsAgo), Math.floor(rand() * 6));
      const s = M.Student({
        firstName: p.fn, lastName: p.ln, subject: p.subject, level: p.level,
        grade: p.grade, school: p.school, mode: p.mode, status: p.status,
        startDate: start,
        phone: '+48 ' + (500 + Math.floor(rand() * 400)) + ' ' + (100 + Math.floor(rand() * 800)) + ' ' + (100 + Math.floor(rand() * 800)),
        email: U.slug(p.fn) + '.' + U.slug(p.ln) + '@example.com',
        parentContact: idx % 3 === 0 ? 'Mama: +48 ' + (600 + Math.floor(rand() * 300)) + ' ' + (100 + Math.floor(rand() * 800)) + ' ' + (100 + Math.floor(rand() * 800)) : '',
        preferredDay: p.slots[0][0],
        preferredTime: p.slots[0][1],
        location: p.mode === 'online' ? 'Google Meet' : 'ul. Kwiatowa ' + (2 + Math.floor(rand() * 40)) + ', u ucznia',
        defaultDuration: p.slots[0][2],
        rates: M.autoRates(p.rate)   // wyliczone stawki zaokrąglone w górę do pełnych 5 zł
      });
      if (p.status === 'ended') s.endDate = U.addDays(today, -(p.endedWeeksAgo * 7));
      students.push(s);

      /* ---- lekcje ---- */
      const topics = TOPICS[p.subject] || TOPICS['Angielski'];
      let topicIdx = Math.floor(rand() * topics.length);

      let stopDate = horizonEnd;
      if (p.status === 'ended') stopDate = s.endDate;
      if (p.status === 'paused') stopDate = U.addDays(today, -(p.pausedWeeksAgo * 7));

      p.slots.forEach((slot) => {
        // pierwsza data zgodna z dniem tygodnia slotu, nie wcześniej niż start
        let d = start;
        let guard = 0;
        while (U.dow(d) !== slot[0] && guard++ < 10) d = U.addDays(d, 1);

        while (d <= stopDate && guard++ < 600) {
          const isFuture = d > today || (d === today && U.toMin(slot[1]) > U.nowMin());
          const r = rand();
          let status = 'planned', chargeable = true, paymentStatus = 'unpaid';

          if (!isFuture) {
            if (r < 0.865) status = 'done';
            else if (r < 0.915) { status = 'cancelled_student'; chargeable = rand() < 0.35; }
            else if (r < 0.945) { status = 'cancelled_tutor'; chargeable = false; }
            else if (r < 0.965) { status = 'no_show'; chargeable = true; }
            else { status = 'rescheduled'; chargeable = false; }
            if (!chargeable) paymentStatus = 'free';
          }

          const dur = slot[2];
          const price = s.rates[dur] || p.rate;
          const topic = topics[topicIdx % topics.length];
          topicIdx++;

          const lesson = M.Lesson({
            studentId: s.id, date: d, start: slot[1], duration: dur,
            subject: p.subject, price: price, mode: p.mode,
            status: status, chargeable: chargeable, paymentStatus: paymentStatus,
            topic: status === 'done' ? topic : (isFuture ? '' : ''),
            createdAt: new Date(U.parse(d).getTime() - 86400000 * 14).toISOString()
          });

          if (status === 'done' && rand() < 0.35) {
            lesson.summary = {
              topic: topic,
              done: 'Przerobiliśmy teorię i zestaw ćwiczeń, powtórka słownictwa.',
              performance: U.pick(rand, ['bardzo dobrze', 'dobrze, z drobnymi potknięciami', 'ma jeszcze trudności', 'świetnie — szybko łapie']),
              improve: U.pick(rand, ['tempo wypowiedzi', 'dokładność w zapisie', 'systematyczność', 'analiza polecenia']),
              homework: U.pick(rand, ['ćw. 3–5 s. 41', 'napisać krótki tekst (120 słów)', 'zestaw 12 zadań', 'powtórzyć słownictwo z działu']),
              next: U.pick(rand, ['powtórka + krótki test', 'kolejny dział', 'ćwiczenia ustne', 'zadania z arkusza'])
            };
          }
          lessons.push(lesson);
          d = U.addDays(d, 7);
        }
      });
    });

    /* ---- pakiet dla dwóch uczniów ---- */
    [1, 4].forEach((i) => {
      const s = students[i];
      const pkg = M.Package({
        studentId: s.id, lessonsCount: 10, pricePerLesson: s.rates[60],
        purchasedDate: U.addDays(today, -(38 + i * 6)), paid: true
      });
      const mine = U.sortBy(lessons.filter((l) => l.studentId === s.id && l.status === 'done' && l.date >= pkg.purchasedDate), (l) => l.date);
      const used = Math.min(mine.length, i === 1 ? 7 : 9);
      for (let k = 0; k < used; k++) { mine[k].paymentStatus = 'package'; mine[k].packageId = pkg.id; }
      pkg.usedCount = used;
      packages.push(pkg);
      payments.push(M.Payment({
        studentId: s.id, amount: pkg.total, method: 'transfer',
        date: pkg.purchasedDate, packageId: pkg.id, note: 'Pakiet 10 lekcji'
      }));
    });

    /* ---- płatności za pozostałe lekcje + celowe zaległości ---- */
    const arrears = { 6: 3, 2: 2, 9: 1, 0: 1 };   // indeks ucznia -> ile lekcji zostaje nieopłaconych
    students.forEach((s, idx) => {
      const billable = U.sortBy(
        lessons.filter((l) => l.studentId === s.id && l.paymentStatus === 'unpaid' &&
          (l.status === 'done' || ((l.status === 'no_show' || l.status === 'cancelled_student') && l.chargeable))),
        (l) => l.date + l.start
      );
      const keepUnpaid = arrears[idx] || 0;
      const toPay = billable.slice(0, Math.max(0, billable.length - keepUnpaid));

      let batch = [], batchSum = 0;
      const flush = (lastDate) => {
        if (!batch.length) return;
        payments.push(M.Payment({
          studentId: s.id, amount: batchSum,
          date: U.addDays(lastDate, Math.floor(rand() * 3)),
          method: U.pick(rand, ['transfer', 'cash', 'transfer', 'blik', 'card']),
          lessonIds: batch.map((l) => l.id),
          note: batch.length > 1 ? batch.length + ' lekcji' : 'Lekcja ' + U.fmtDate(batch[0].date)
        }));
        batch = []; batchSum = 0;
      };
      toPay.forEach((l, i) => {
        l.paymentStatus = 'paid';
        batch.push(l); batchSum += l.price;
        const size = 3 + Math.floor(rand() * 2);
        if (batch.length >= size || i === toPay.length - 1) flush(l.date);
      });
    });

    /* ---- notatki, materiały, cele, prace domowe ---- */
    students.forEach((s, idx) => {
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        notes.push(M.Note({
          studentId: s.id, kind: 'private',
          date: U.addDays(today, -Math.floor(rand() * 90)),
          text: U.pick(rand, PROGRESS_NOTES)
        }));
      }
      if (idx < MATERIALS.length) {
        const m = MATERIALS[idx];
        materials.push(M.Material({ studentId: s.id, title: m.t, type: m.ty, url: m.url || '', date: U.addDays(today, -Math.floor(rand() * 60)) }));
      }
      if (idx + 1 < MATERIALS.length && rand() < 0.6) {
        const m = MATERIALS[(idx + 5) % MATERIALS.length];
        materials.push(M.Material({ studentId: s.id, title: m.t, type: m.ty, url: m.url || '', date: U.addDays(today, -Math.floor(rand() * 40)) }));
      }
      if (idx < GOALS.length && s.status !== 'ended') {
        goals.push(M.Goal({ studentId: s.id, title: GOALS[idx].t, progress: GOALS[idx].p, deadline: U.addDays(today, 60 + Math.floor(rand() * 120)) }));
      }
      if (rand() < 0.5 && s.status === 'active') {
        homework.push(M.Homework({
          studentId: s.id,
          title: U.pick(rand, ['ćw. 3–5 s. 41', 'napisać rozprawkę (250 słów)', 'zestaw 10 zadań', 'powtórzyć nieregularne czasowniki', 'przygotować prezentację 2 min']),
          due: U.addDays(today, -3 + Math.floor(rand() * 10)),
          status: rand() < 0.6 ? 'assigned' : (rand() < 0.7 ? 'done' : 'not_done')
        }));
      }
    });

    /* ---- notatki z lekcji (oś czasu postępów) ---- */
    lessons.filter((l) => l.summary).slice(0, 60).forEach((l) => {
      notes.push(M.Note({
        studentId: l.studentId, lessonId: l.id, date: l.date, kind: 'lesson',
        text: l.summary.topic + '\nZrobione: ' + l.summary.done + '\nUczeń: ' + l.summary.performance + '\nDo poprawy: ' + l.summary.improve
      }));
    });

    /* ---- wydatki ---- */
    EXPENSES.forEach((e, i) => {
      expenses.push(M.Expense({
        date: U.addDays(today, -(Math.floor(i * 12) + Math.floor(rand() * 8))),
        category: e.c, amount: e.a, description: e.d
      }));
    });

    /* ---- zadania ---- */
    TASKS.forEach((t, i) => {
      tasks.push(M.Task({
        title: t.t, priority: t.p, due: U.addDays(today, t.dueIn),
        studentId: i < 4 ? students[i].id : null,
        done: i === 4 ? true : false,
        doneAt: i === 4 ? U.addDays(today, -1) : null
      }));
    });

    return { students, lessons, payments, packages, notes, materials, goals, homework, tasks, expenses };
  }

  /* ============================================================
     API
     ============================================================ */
  const Seed = {};

  Seed.load = function (keepSettings) {
    const Store = window.TF.Store;
    const data = generate();
    const settings = keepSettings ? Store.state.settings : Object.assign(M.defaultSettings(), {
      tutorName: Store.state.settings.tutorName || 'Korepetytor',
      subject: 'Angielski',
      onboarded: true,
      theme: Store.state.settings.theme || 'system',
      workDays: [0, 1, 2, 3, 4, 5],
      workHours: { start: '14:00', end: '20:00' },
      workHoursByDay: { '5': { start: '09:00', end: '14:00' } },
      monthlyGoal: 8000
    });
    settings.demoData = true;
    settings.onboarded = true;
    if (!settings.workHoursByDay || !settings.workHoursByDay['5']) {
      settings.workHoursByDay = Object.assign({}, settings.workHoursByDay, { '5': { start: '09:00', end: '14:00' } });
      if (settings.workDays.indexOf(5) === -1) settings.workDays = settings.workDays.concat([5]);
    }

    Store.state.settings = settings;
    Store.COLLECTIONS.forEach((c) => { Store.state[c] = data[c] || []; });
    Store.save(true);
    Store.emit('change', { collection: '*', type: 'seed' });
    return data;
  };

  /** Usuwa dane demonstracyjne, zachowując ustawienia korepetytora */
  Seed.clear = function () {
    const Store = window.TF.Store;
    Store.COLLECTIONS.forEach((c) => { Store.state[c] = []; });
    Store.state.settings.demoData = false;
    Store.save(true);
    Store.emit('change', { collection: '*', type: 'clear-demo' });
  };

  Seed.generate = generate;
  window.TF.Seed = Seed;
})();
