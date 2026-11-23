/* ============================================================
   TutorFlow — views/print.js
   Wydruki: pusty szablon tygodnia w kratkę + karteczki z uczniami
   do wycięcia i przykładania na wydrukowany grafik.

   Wszystko liczone w milimetrach, więc karteczka o czasie 60 min
   ma dokładnie wysokość jednego wiersza siatki — pasuje 1:1.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const icon = window.TF.icon;

  const A4 = { w: 297, h: 210 };          // poziomo; pionowo zamieniamy
  const MARGIN = 8;

  const state = {
    /* siatka tygodnia */
    days: 'work',                          // work | 5 | 6 | 7
    from: null, to: null,                  // 'HH:MM'
    subdiv: 2,                             // 1 | 2 | 4
    orientation: 'landscape',
    dated: false,
    weekStart: null,
    fillPlanned: false,
    /* karteczki */
    cardsOrientation: 'portrait',
    cardWho: 'active',                     // active | all
    cardCount: 'weekly',                   // weekly | 1 | 2 | 3
    cardMeta: true,
    cardColor: true,
    blankCards: 8
  };

  /* ============================================================
     PARAMETRY
     ============================================================ */
  function defaults() {
    const st = S().settings();
    if (!state.from || !state.to) {
      let min = 24 * 60, max = 0;
      (st.workDays || []).forEach(function (d) {
        const wh = C().workHoursFor(d);
        if (!wh) return;
        min = Math.min(min, U.toMin(wh.start));
        max = Math.max(max, U.toMin(wh.end));
      });
      if (min > max) { min = 8 * 60; max = 20 * 60; }
      state.from = U.toTime(Math.floor(min / 60) * 60);
      state.to = U.toTime(Math.ceil(max / 60) * 60);
    }
    if (!state.weekStart) state.weekStart = U.startOfWeek(U.today());
  }

  function dayList() {
    const st = S().settings();
    if (state.days === 'work') {
      const d = (st.workDays || []).slice().sort(function (a, b) { return a - b; });
      return d.length ? d : [0, 1, 2, 3, 4];
    }
    const n = Number(state.days) || 7;
    return [0, 1, 2, 3, 4, 5, 6].slice(0, n);
  }

  function hourList() {
    const a = U.toMin(state.from), b = U.toMin(state.to);
    const out = [];
    for (let m = a; m < b; m += 60) out.push(m);
    return out.length ? out : [8 * 60];
  }

  function geometry() {
    const land = state.orientation === 'landscape';
    const pageW = land ? A4.w : A4.h;
    const pageH = land ? A4.h : A4.w;
    /* 1 mm zapasu na obramowania siatki i zaokrąglenia sterownika drukarki —
       bez tego arkusz wystawał o ułamek milimetra i wychodziła pusta strona. */
    const usableW = pageW - MARGIN * 2 - 1;
    const usableH = pageH - MARGIN * 2;
    const days = dayList();
    const hours = hourList();
    const gutter = 14;
    const colW = (usableW - gutter) / days.length;
    /* Wstępny szacunek wysokości nagłówka, tytułu i stopki. Po wyrenderowaniu
       fitSheets() mierzy je naprawdę i koryguje wiersze, żeby arkusz na pewno
       zmieścił się na jednej stronie. */
    const titleH = 15;
    const headH = state.dated ? 11 : 9;
    const footH = 8;
    const rowH = Math.max(4.5, (usableH - titleH - headH - footH) / hours.length);
    return { pageW, pageH, usableW, usableH, days, hours, gutter, colW, rowH, headH };
  }

  const mm = (v) => (Math.round(v * 100) / 100) + 'mm';

  /* ============================================================
     ARKUSZ: TYDZIEŃ
     ============================================================ */
  function weekSheet() {
    const g = geometry();
    const st = S().settings();
    const dated = state.dated;

    let head = '<div class="wgrid__corner"></div>';
    g.days.forEach(function (d) {
      const off = !C().workHoursFor(d);
      const date = dated ? U.addDays(state.weekStart, d) : null;
      head += '<div class="wgrid__day ' + (off ? 'wgrid__day--off' : '') + '">' +
        '<strong>' + U.cap(U.DOW_LONG[d]) + '</strong>' +
        (dated ? '<small>' + U.parse(date).getDate() + ' ' + U.MONTHS_SHORT[U.parse(date).getMonth()] + '</small>' : '') +
        '</div>';
    });

    let body = '';
    g.hours.forEach(function (m) {
      body += '<div class="wgrid__time" style="height:' + mm(g.rowH) + '">' + U.toTime(m) + '</div>';
      g.days.forEach(function (d) {
        const wh = C().workHoursFor(d);
        const outside = !wh || m < U.toMin(wh.start) || m >= U.toMin(wh.end);

        let lines = '';
        for (let k = 1; k < state.subdiv; k++) {
          const pct = (k / state.subdiv) * 100;
          const half = state.subdiv === 4 && k === 2;
          lines += '<i class="' + (half ? 'is-half' : '') + '" style="top:' + pct + '%"></i>';
        }

        let content = '';
        if (state.fillPlanned && dated) {
          const date = U.addDays(state.weekStart, d);
          const here = S().lessonsOn(date).filter(function (l) {
            const s = U.toMin(l.start);
            return s >= m && s < m + 60 && !C().isCancelled(l) && l.status !== 'rescheduled';
          });
          if (here.length) {
            content = '<div class="wcell__lesson">' + here.map(function (l) {
              return '<b>' + U.fmtTime(l.start) + '</b> ' + U.esc(shortName(S().student(l.studentId)));
            }).join('<br>') + '</div>';
          }
        }

        body += '<div class="wcell ' + (outside ? 'wcell--off' : '') + '" style="height:' + mm(g.rowH) + '">' +
          lines + content + '</div>';
      });
    });

    const title = dated
      ? 'Tydzień ' + U.fmtDate(state.weekStart, 'day') + ' – ' + U.fmtDate(U.addDays(state.weekStart, g.days[g.days.length - 1]), 'day')
      : 'Plan tygodnia';
    const sub = dated
      ? U.cap(U.DOW_LONG[g.days[0]]) + '–' + U.DOW_LONG[g.days[g.days.length - 1]] + ' · ' + state.from + '–' + state.to
      : 'Szablon do ręcznego układania · ' + state.from + '–' + state.to;

    return '<section class="psheet psheet--week" style="width:' + mm(g.usableW) + '">' +
      '<header class="psheet__head"><div><h1>' + U.esc(title) + '</h1><p>' + U.esc(sub) + '</p></div>' +
      '<div class="psheet__brand"><span></span>' + U.esc(st.appName || 'TutorFlow') + '</div></header>' +
      '<div class="wgrid" style="grid-template-columns:' + mm(g.gutter) + ' repeat(' + g.days.length + ',' + mm(g.colW) + ')">' +
      head + body + '</div>' +
      '<div class="psheet__foot"><span>Kratka: ' + (60 / state.subdiv) + ' min · szerokość kolumny ' + mm(g.colW) + '</span>' +
      '<span>' + (st.tutorName ? U.esc(st.tutorName) : '') + '</span></div>' +
      '</section>';
  }

  function shortName(s) {
    if (!s) return '—';
    const last = (s.lastName || '').trim();
    return s.firstName + (last ? ' ' + last.charAt(0) + '.' : '');
  }

  /* ============================================================
     ARKUSZ: KARTECZKI
     ============================================================ */
  /** Ile zajęć w typowym tygodniu ma dany uczeń */
  function weeklyCount(studentId) {
    const from = U.today(), to = U.addDays(from, 6);
    const n = S().repo('lessons').where(function (l) {
      return l.studentId === studentId && l.date >= from && l.date <= to &&
        !C().isCancelled(l) && l.status !== 'rescheduled';
    }).length;
    return n || 1;
  }

  /** Typowy czas trwania zajęć ucznia */
  function typicalDuration(s) {
    const ls = S().lessonsOf(s.id).filter(function (l) { return !C().isCancelled(l); });
    if (!ls.length) return s.defaultDuration || S().settings().defaultDuration || 60;
    const tally = {};
    ls.forEach(function (l) { tally[l.duration] = (tally[l.duration] || 0) + 1; });
    return Number(U.sortBy(Object.keys(tally), function (k) { return tally[k]; }, 'desc')[0]) || 60;
  }

  function cardList() {
    const all = S().repo('students').all();
    const pool = state.cardWho === 'all' ? all : all.filter(function (s) { return s.status === 'active'; });
    const sorted = U.sortBy(pool, function (s) { return U.norm(s.lastName + s.firstName); });
    const out = [];
    sorted.forEach(function (s) {
      const n = state.cardCount === 'weekly' ? weeklyCount(s.id) : Number(state.cardCount) || 1;
      const dur = typicalDuration(s);
      for (let i = 0; i < n; i++) out.push({ student: s, duration: dur });
    });
    return out;
  }

  function cardsSheet() {
    const g = geometry();                 // rozmiar karteczek zależy od siatki, nie od strony z karteczkami
    const cards = cardList();
    const st = S().settings();
    const cardW = g.colW - 1;

    if (!cards.length && !state.blankCards) {
      return '<section class="psheet psheet--cards" style="width:' + mm((state.cardsOrientation === 'portrait' ? A4.h : A4.w) - MARGIN * 2 - 1) + '">' +
        '<header class="psheet__head"><div><h1>Karteczki z uczniami</h1>' +
        '<p>Brak uczniów do wydrukowania</p></div></header></section>';
    }

    const body = cards.map(function (c) {
      const s = c.student;
      const h = Math.max(7, (g.rowH * c.duration) / 60 - 1);
      const meta = [s.subject, s.level].filter(Boolean).join(' ');
      return '<div class="card-cut ' + (state.cardColor ? '' : 'card-cut--mono') + '" data-dur="' + c.duration + '" ' +
        'style="width:' + mm(cardW) + ';height:' + mm(h) + '">' +
        '<span class="card-cut__bar" style="background:' + (state.cardColor ? U.gradientFor(s.id + s.firstName) : '#101828') + '"></span>' +
        '<div class="card-cut__body">' +
          '<div class="card-cut__name">' + U.esc(S().studentName(s.id)) + '</div>' +
          (state.cardMeta
            ? '<div class="card-cut__meta">' + U.esc(meta || '—') + (s.mode === 'online' ? ' · online' : '') + '</div>' +
              '<div class="card-cut__time">' + U.durLabel(c.duration) + ' · ' + U.money(S().ops.priceFor(s.id, c.duration)) + '</div>'
            : '') +
        '</div></div>';
    }).join('');

    let blanks = '';
    for (let i = 0; i < (Number(state.blankCards) || 0); i++) {
      const h = Math.max(7, g.rowH - 1);
      blanks += '<div class="card-cut card-cut--blank card-cut--mono" data-dur="60" style="width:' + mm(cardW) + ';height:' + mm(h) + '">' +
        '<span class="card-cut__bar"></span>' +
        '<div class="card-cut__body"><div class="card-cut__line"></div></div></div>';
    }

    const sheetW = (state.cardsOrientation === 'portrait' ? A4.h : A4.w) - MARGIN * 2 - 1;
    return '<section class="psheet psheet--cards" style="width:' + mm(sheetW) + '">' +
      '<header class="psheet__head"><div><h1>Karteczki z uczniami</h1>' +
      '<p>Wytnij wzdłuż przerywanej linii i przykładaj do siatki tygodnia</p></div>' +
      '<div class="psheet__brand"><span></span>' + U.esc(st.appName || 'TutorFlow') + '</div></header>' +
      '<div class="cards-legend">' + cards.length + ' ' +
      U.plural(cards.length, 'karteczka', 'karteczki', 'karteczek') +
      (blanks ? ' + ' + state.blankCards + ' pustych' : '') +
      ' · szerokość ' + mm(cardW) + ' dopasowana do kolumny dnia</div>' +
      '<div class="cards">' + body + blanks + '</div>' +
      '</section>';
  }

  /* ============================================================
     PANEL KONFIGURACJI
     ============================================================ */
  function seg(name, value, options) {
    return '<div class="segmented" data-seg="' + name + '" style="width:100%">' +
      options.map(function (o) {
        return '<button type="button" class="' + (String(value) === String(o[0]) ? 'is-active' : '') +
          '" data-val="' + o[0] + '" style="flex:1">' + o[1] + '</button>';
      }).join('') + '</div>';
  }

  function configCard() {
    const g = geometry();
    return UI.card('Szablon tygodnia',
      '<div class="form-grid">' +
        '<div class="field span2"><label>Dni w tygodniu</label>' +
          seg('days', state.days, [['work', 'Robocze'], ['5', 'Pon–Pt'], ['6', 'Pon–Sob'], ['7', '7 dni']]) + '</div>' +
        '<div class="field"><label>Od godziny</label>' +
          '<input class="input" type="time" step="3600" data-cfg="from" value="' + state.from + '"></div>' +
        '<div class="field"><label>Do godziny</label>' +
          '<input class="input" type="time" step="3600" data-cfg="to" value="' + state.to + '"></div>' +
        '<div class="field span2"><label>Podział godziny</label>' +
          seg('subdiv', state.subdiv, [['1', 'Pełne godziny'], ['2', 'Co 30 min'], ['4', 'Co 15 min']]) + '</div>' +
        '<div class="field span2"><label>Orientacja kartki</label>' +
          seg('orientation', state.orientation, [['landscape', 'Pozioma'], ['portrait', 'Pionowa']]) + '</div>' +
        '<div class="field span2"><label class="switch"><input type="checkbox" data-cfg="dated"' + (state.dated ? ' checked' : '') + '>' +
          '<span class="switch__track"></span><span>Wpisz daty konkretnego tygodnia</span></label></div>' +
        (state.dated
          ? '<div class="field span2"><label>Tydzień zaczynający się</label>' +
            '<div class="row gap-2"><input class="input" type="date" data-cfg="weekStart" value="' + state.weekStart + '" style="max-width:180px">' +
            '<button class="btn btn--sm" data-action="printThisWeek">Bieżący</button>' +
            '<button class="btn btn--sm" data-action="printNextWeek">Następny</button></div></div>' +
            '<div class="field span2"><label class="switch"><input type="checkbox" data-cfg="fillPlanned"' + (state.fillPlanned ? ' checked' : '') + '>' +
            '<span class="switch__track"></span><span>Wpisz już zaplanowane zajęcia</span></label>' +
            '<span class="hint">Przydatne, gdy chcesz dopasować tylko brakujące godziny.</span></div>'
          : '') +
      '</div>' +
      '<div class="insight insight--info mt-4"><span class="insight__ico">' + icon('info', 15) + '</span>' +
        '<div class="insight__body small">Kolumna dnia ma <b>' + mm(g.colW) + '</b>, a jedna godzina <b>' + mm(g.rowH) + '</b> wysokości. ' +
        'Karteczki są cięte dokładnie w tej skali, więc pasują do kratek.</div></div>' +
      '<button class="btn btn--brand btn--block mt-4" data-action="printWeek">' +
        icon('printer', 16) + ' Drukuj szablon tygodnia</button>',
      { class: 'print-config', subtitle: 'Pusta siatka do ręcznego układania' });
  }

  function cardsConfigCard() {
    const cards = cardList();
    return UI.card('Karteczki z uczniami',
      '<div class="form-grid">' +
        '<div class="field span2"><label>Kogo drukować</label>' +
          seg('cardWho', state.cardWho, [['active', 'Aktywnych'], ['all', 'Wszystkich']]) + '</div>' +
        '<div class="field span2"><label>Ile karteczek na ucznia</label>' +
          seg('cardCount', state.cardCount, [['weekly', 'Tyle, ile zajęć'], ['1', '1'], ['2', '2'], ['3', '3']]) +
          '<span class="hint">„Tyle, ile zajęć” liczy zajęcia z najbliższych 7 dni.</span></div>' +
        '<div class="field"><label>Puste karteczki</label>' +
          '<input class="input" type="number" min="0" max="60" step="2" data-cfg="blankCards" value="' + state.blankCards + '"></div>' +
        '<div class="field"><label>Orientacja kartki</label>' +
          seg('cardsOrientation', state.cardsOrientation, [['portrait', 'Pionowa'], ['landscape', 'Pozioma']]) + '</div>' +
        '<div class="field span2"><label class="switch"><input type="checkbox" data-cfg="cardMeta"' + (state.cardMeta ? ' checked' : '') + '>' +
          '<span class="switch__track"></span><span>Przedmiot, czas trwania i cena na karteczce</span></label></div>' +
        '<div class="field span2"><label class="switch"><input type="checkbox" data-cfg="cardColor"' + (state.cardColor ? ' checked' : '') + '>' +
          '<span class="switch__track"></span><span>Kolorowy pasek ucznia</span></label>' +
          '<span class="hint">Wyłącz, żeby oszczędzić tusz — karteczki wyjdą czarno-białe.</span></div>' +
      '</div>' +
      '<div class="insight insight--brand mt-4"><span class="insight__ico">' + icon('scissors', 15) + '</span>' +
        '<div class="insight__body small">Do wydruku: <b>' + cards.length + ' ' +
        U.plural(cards.length, 'karteczka', 'karteczki', 'karteczek') + '</b>' +
        (state.blankCards ? ' i ' + state.blankCards + ' pustych' : '') +
        '. Wysokość każdej odpowiada czasowi trwania zajęć.</div></div>' +
      '<button class="btn btn--brand btn--block mt-4" data-action="printCards">' +
        icon('printer', 16) + ' Drukuj karteczki</button>',
      { class: 'print-config', subtitle: 'Do wycięcia i układania na siatce' });
  }

  function howToCard() {
    return UI.card('Jak tego używać',
      '<ol class="steps">' +
        '<li><span>Wydrukuj <b>szablon tygodnia</b> — pustą siatkę z godzinami.</span></li>' +
        '<li><span>Wydrukuj <b>karteczki</b> i wytnij je wzdłuż przerywanych linii.</span></li>' +
        '<li><span>Układaj karteczki na siatce. Wysokość karteczki odpowiada długości zajęć, ' +
          'więc od razu widać, ile miejsca zajmie lekcja.</span></li>' +
        '<li><span>Gdy plan Ci pasuje — przepisz go do kalendarza w aplikacji.</span></li>' +
      '</ol>' +
      '<div class="insight insight--warn mt-4"><span class="insight__ico">' + icon('printer', 15) + '</span>' +
        '<div class="insight__body small">W oknie drukowania ustaw skalę na <b>100%</b> (nie „dopasuj do strony”) ' +
        'i włącz <b>grafikę tła</b>, inaczej karteczki nie będą pasować do kratek.</div></div>',
      { class: 'print-config' });
  }

  /* ============================================================
     DRUKOWANIE
     ============================================================ */
  function pageRule(orientation) {
    let el = document.getElementById('tfPageRule');
    if (!el) {
      el = document.createElement('style');
      el.id = 'tfPageRule';
      document.head.appendChild(el);
    }
    el.textContent = '@page { size: A4 ' + orientation + '; margin: ' + MARGIN + 'mm; }';
  }

  /* Na czas druku przenosimy arkusz do #printRoot (bezpośrednie dziecko
     <body>), a po wszystkim wstawiamy go z powrotem w to samo miejsce.
     Wcześniejsze podejście — ukrywanie rodzeństwa w drzewie widoku —
     usuwało też kontener arkusza i z drukarki wychodziła pusta kartka. */
  let restorePrint = null;

  function restore() {
    if (!restorePrint) return;
    const r = restorePrint;
    restorePrint = null;
    if (r.next && r.parent.contains(r.next)) r.parent.insertBefore(r.sheet, r.next);
    else r.parent.appendChild(r.sheet);
    document.body.classList.remove('printing');
    const root = document.getElementById('printRoot');
    if (root) root.innerHTML = '';
  }

  function doPrint(which) {
    const host = document.getElementById('view');
    const sheet = host && host.querySelector(which === 'cards' ? '.psheet--cards' : '.psheet--week');
    const root = document.getElementById('printRoot');
    if (!sheet || !root) return;

    restore();                                   // gdyby coś zostało z poprzedniego razu
    restorePrint = { sheet: sheet, parent: sheet.parentNode, next: sheet.nextSibling };
    root.appendChild(sheet);
    document.body.classList.add('printing');
    pageRule(which === 'cards' ? state.cardsOrientation : state.orientation);

    setTimeout(function () {
      window.print();
      setTimeout(restore, 1500);                 // zabezpieczenie, gdyby afterprint nie przyszedł
    }, 60);
  }

  window.addEventListener('afterprint', restore);

  /* ============================================================
     WIDOK
     ============================================================ */
  const PX_PER_MM = 96 / 25.4;

  /**
   * Wysokość nagłówka, tytułu i stopki zależy od fontu i treści, więc
   * zamiast jej zgadywać — mierzymy gotowy arkusz i skracamy wiersze tak,
   * żeby na pewno zmieścił się na jednej stronie A4. Karteczki dostają
   * dokładnie tę samą, skorygowaną skalę, więc dalej pasują do kratek.
   */
  function fitSheets(host) {
    const week = host.querySelector('.psheet--week');
    if (!week) return;
    const g = geometry();
    const rows = host.querySelectorAll('.wcell, .wgrid__time');
    if (!rows.length) return;

    const availablePx = g.usableH * PX_PER_MM;
    const actualPx = week.getBoundingClientRect().height;
    if (!actualPx) return;

    const overflowPx = actualPx - availablePx;
    if (overflowPx <= 0.5) return;                       // mieści się — nic nie robimy

    const overflowMm = overflowPx / PX_PER_MM;
    const newRowH = Math.max(4, g.rowH - (overflowMm / g.hours.length) - 0.15);

    rows.forEach(function (el) { el.style.height = mm(newRowH); });
    host.querySelectorAll('.card-cut[data-dur]').forEach(function (el) {
      const dur = Number(el.getAttribute('data-dur')) || 60;
      el.style.height = mm(Math.max(7, (newRowH * dur) / 60 - 1));
    });
  }

  /**
   * Dopasowuje wielkość liter na karteczkach do ich szerokości — pełne
   * imię i nazwisko ma się zmieścić, a nie urywać wielokropkiem.
   * Zmniejszamy stopniowo, a gdy to nie wystarczy, pozwalamy złamać
   * nazwisko do drugiej linii.
   */
  function fitCardText(host) {
    const MAX = 3.2, MIN = 2.0, STEP = 0.1;

    host.querySelectorAll('.card-cut__name').forEach(function (el) {
      el.style.whiteSpace = 'nowrap';
      el.style.fontSize = MAX + 'mm';
      let size = MAX, guard = 0;
      while (el.scrollWidth > el.clientWidth + 0.5 && size > MIN && guard++ < 30) {
        size = Math.round((size - STEP) * 100) / 100;
        el.style.fontSize = size + 'mm';
      }
      if (el.scrollWidth > el.clientWidth + 0.5) {
        // wyjątkowo długie nazwisko — dwie linie zamiast wielokropka
        el.style.whiteSpace = 'normal';
        el.style.lineHeight = '1.05';
        el.style.wordBreak = 'break-word';
      }
    });

    /* wiersze opisowe skracamy tą samą metodą, tylko z mniejszego pułapu */
    host.querySelectorAll('.card-cut__meta, .card-cut__time').forEach(function (el) {
      const start = el.classList.contains('card-cut__time') ? 2.4 : 2.4;
      el.style.fontSize = start + 'mm';
      let size = start, guard = 0;
      while (el.scrollWidth > el.clientWidth + 0.5 && size > 1.7 && guard++ < 20) {
        size = Math.round((size - 0.1) * 100) / 100;
        el.style.fontSize = size + 'mm';
      }
    });
  }

  /**
   * Podgląd skalujemy tak, by szeroki arkusz A4 zmieścił się w kolumnie.
   * Pomiar musi trafić w moment, gdy układ jest już policzony — stąd
   * zabezpieczenie i ponowna próba w kolejnej klatce.
   */
  function scalePreview(host, attempt) {
    host.querySelectorAll('.print-preview').forEach(function (wrap) {
      const stage = wrap.querySelector('.print-preview__stage');
      if (!stage) return;

      stage.style.transform = 'none';
      stage.style.width = 'auto';
      wrap.style.height = 'auto';

      const available = wrap.clientWidth;
      const natural = Math.max(stage.scrollWidth, stage.getBoundingClientRect().width);

      if (!available || !natural) {
        // układ jeszcze nie gotowy — spróbuj ponownie, ale nie w nieskończoność
        if ((attempt || 0) < 5) requestAnimationFrame(function () { scalePreview(host, (attempt || 0) + 1); });
        return;
      }

      const scale = Math.min(1, available / natural);
      stage.style.width = natural + 'px';
      stage.style.transform = 'scale(' + scale + ')';
      wrap.style.height = (stage.scrollHeight * scale) + 'px';

      const badge = wrap.closest('.section') && wrap.closest('.section').querySelector('.print-scale');
      if (badge) badge.textContent = 'podgląd ' + Math.round(scale * 100) + '%';
    });
  }

  window.TF.Views.print = {
    title: 'Wydruki',
    subtitle: 'Szablon tygodnia i karteczki do ręcznego układania',
    render: function (params, query) {
      defaults();
      if (query && query.week) { state.weekStart = U.startOfWeek(query.week); state.dated = true; }

      if (!S().repo('students').all().length) {
        return '<div class="card">' + UI.empty({
          icon: 'printer', title: 'Najpierw dodaj uczniów',
          text: 'Szablon tygodnia wydrukujesz od razu, ale karteczki powstają z Twojej bazy uczniów.',
          ctaLabel: 'Dodaj ucznia', ctaAction: 'addStudent'
        }) + '</div>' +
        '<div class="section">' + configCard() + '</div>' +
        '<div class="section"><div class="section__head"><h2>Podgląd</h2>' +
        '<span class="print-scale"></span></div>' +
        '<div class="print-preview"><div class="print-preview__stage">' + weekSheet() + '</div></div></div>';
      }

      return '<div class="grid grid-1-2">' +
          '<div class="col gap-4">' + configCard() + cardsConfigCard() + howToCard() + '</div>' +
          '<div>' +
            '<div class="section" style="margin-top:0">' +
              '<div class="section__head"><h2>Podgląd</h2>' +
              '<div class="row gap-3"><span class="print-scale"></span>' +
              '<button class="btn btn--sm" data-action="printWeek">' + icon('printer', 14) + ' Tydzień</button>' +
              '<button class="btn btn--sm" data-action="printCards">' + icon('scissors', 14) + ' Karteczki</button></div></div>' +
              '<div class="print-preview"><div class="print-preview__stage">' +
                weekSheet() + cardsSheet() +
              '</div></div>' +
            '</div>' +
          '</div>' +
        '</div>';
    },

    mount: function (host) {
      fitSheets(host);
      fitCardText(host);
      scalePreview(host);
      const onResize = U.debounce(function () { scalePreview(host); }, 150);
      window.addEventListener('resize', onResize);
      window.TF.App.setTimer(function () { if (!host.isConnected) window.removeEventListener('resize', onResize); }, 30000);

      /* przełączniki segmentowe */
      host.addEventListener('click', function (e) {
        const b = e.target.closest('[data-seg] [data-val]');
        if (!b) return;
        const name = b.closest('[data-seg]').getAttribute('data-seg');
        state[name] = b.getAttribute('data-val');
        if (name === 'subdiv') state.subdiv = Number(state.subdiv);
        window.TF.Router.refresh();
      });

      /* pola tekstowe i przełączniki */
      host.addEventListener('change', function (e) {
        const el = e.target.closest('[data-cfg]');
        if (!el) return;
        const key = el.getAttribute('data-cfg');
        state[key] = el.type === 'checkbox' ? el.checked : el.value;
        if (key === 'from' && U.toMin(state.from) >= U.toMin(state.to)) state.to = U.toTime(U.toMin(state.from) + 60);
        if (key === 'to' && U.toMin(state.to) <= U.toMin(state.from)) state.from = U.toTime(Math.max(0, U.toMin(state.to) - 60));
        if (key === 'weekStart') state.weekStart = U.startOfWeek(state.weekStart);
        window.TF.Router.refresh();
      });
    },

    print: doPrint,
    state: state
  };
})();
