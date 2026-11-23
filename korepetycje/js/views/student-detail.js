/* ============================================================
   TutorFlow — views/student-detail.js
   Profil ucznia: dane, finanse, historia, notatki, cele,
   materiały i prace domowe. Podpina się pod trasę #/students/:id
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const Ch = () => window.TF.Charts;
  const icon = window.TF.icon;

  const TABS = [
    { id: 'overview', label: 'Przegląd' },
    { id: 'lessons', label: 'Historia zajęć' },
    { id: 'payments', label: 'Płatności' },
    { id: 'notes', label: 'Notatki i postępy' },
    { id: 'goals', label: 'Cele' },
    { id: 'materials', label: 'Materiały' },
    { id: 'homework', label: 'Praca domowa' }
  ];
  const state = { tab: 'overview' };

  /* ---------------- nagłówek ---------------- */
  function hero(s, f) {
    const pkg = S().ops.activePackage(s.id);
    return '<div class="profile-hero">' +
      UI.avatar(s, 'xl') +
      '<div class="profile-hero__info grow" style="min-width:200px">' +
        '<h2>' + U.esc(S().studentName(s.id)) + '</h2>' +
        '<div class="profile-hero__meta">' +
          UI.studentStatusBadge(s) +
          (s.level ? '<span class="badge badge--outline">' + U.esc(s.level) + '</span>' : '') +
          (s.subject ? '<span class="badge badge--outline">' + U.esc(s.subject) + '</span>' : '') +
          '<span class="badge badge--outline">' + (s.mode === 'online' ? 'Online' : 'Stacjonarnie') + '</span>' +
          (s.grade ? '<span class="badge badge--outline">' + U.esc(s.grade) + '</span>' : '') +
          (pkg ? '<span class="badge badge--brand">Pakiet ' + pkg.usedCount + '/' + pkg.lessonsCount + '</span>' : '') +
        '</div>' +
        '<div class="row gap-3 mt-3 wrap small dim">' +
          (s.phone ? '<a class="row gap-1" href="tel:' + U.esc(s.phone) + '">' + icon('phone', 14) + U.esc(s.phone) + '</a>' : '') +
          (s.email ? '<a class="row gap-1" href="mailto:' + U.esc(s.email) + '">' + icon('mail', 14) + U.esc(s.email) + '</a>' : '') +
          (s.location ? '<span class="row gap-1">' + icon(s.mode === 'online' ? 'video' : 'mapPin', 14) + U.esc(s.location) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="profile-hero__stats">' +
        '<div class="profile-hero__stat"><small>Lekcje</small><strong>' + f.lessonsHeld + '</strong></div>' +
        '<div class="profile-hero__stat"><small>Godziny</small><strong>' + U.num(f.hours, 1) + '</strong></div>' +
        '<div class="profile-hero__stat"><small>Wartość</small><strong>' + U.moneyShort(f.billed) + '</strong></div>' +
        '<div class="profile-hero__stat"><small>Saldo</small><strong class="' + (f.due > 0 ? 'pos-down' : 'pos-up') + '">' +
          (f.due > 0 ? U.moneyShort(f.due) : '0') + '</strong></div>' +
      '</div>' +
      '<div class="row gap-2 wrap" style="width:100%">' +
        '<button class="btn btn--brand btn--sm" data-action="addLesson" data-student="' + s.id + '"><span class="plus">+</span> Zaplanuj lekcję</button>' +
        '<button class="btn btn--sm" data-action="addPayment" data-student="' + s.id + '">' + icon('wallet', 14) + ' Płatność</button>' +
        '<button class="btn btn--sm" data-action="addNote" data-student="' + s.id + '">' + icon('note', 14) + ' Notatka</button>' +
        '<button class="btn btn--sm" data-action="addPackage" data-student="' + s.id + '">' + icon('card', 14) + ' Pakiet</button>' +
        '<div class="grow"></div>' +
        '<button class="btn btn--sm" data-action="editStudent" data-id="' + s.id + '">' + icon('edit', 14) + ' Edytuj</button>' +
        '<button class="btn btn--sm btn--danger-soft" data-action="deleteStudent" data-id="' + s.id + '">' + icon('trash', 14) + '</button>' +
      '</div>' +
      '</div>';
  }

  /* ---------------- przegląd ---------------- */
  function overview(s, f) {
    const c = C();
    const last = f.lastHeld;
    const next = f.nextLesson;
    const months = c.cooperationMonths(s.id);

    const timeline = UI.card('Ostatnia i następna lekcja',
      '<div class="grid grid-2">' +
        '<div><div class="small dim mb-2">Ostatnia lekcja</div>' +
          (last ? '<div class="bold">' + U.fmtDate(last.date, 'long') + '</div>' +
            '<div class="small muted mt-1">' + U.esc(last.topic || last.subject || 'Bez tematu') + '</div>' +
            '<div class="tiny dim mt-1">' + U.ago(last.date) + ' · ' + U.durLabel(last.duration) + ' · ' + U.money(last.price) + '</div>'
            : '<div class="dim small">Jeszcze się nie odbyła</div>') + '</div>' +
        '<div><div class="small dim mb-2">Następna lekcja</div>' +
          (next ? '<div class="bold">' + U.fmtDate(next.date, 'long') + ', ' + U.fmtTime(next.start) + '</div>' +
            '<div class="small muted mt-1">' + U.esc(next.topic || next.subject || 'Temat do ustalenia') + '</div>' +
            '<div class="tiny dim mt-1">za ' + U.relTime(Math.max(0, c.minutesUntil(next))) + ' · ' + U.money(next.price) + '</div>'
            : '<div class="dim small">Brak zaplanowanych zajęć</div>' +
              '<button class="btn btn--xs btn--soft mt-2" data-action="addLesson" data-student="' + s.id + '">Zaplanuj</button>') + '</div>' +
      '</div>');

    const rates = M.DURATIONS.map((d) =>
      '<div class="stat-row"><span class="stat-row__label">' + d + ' min</span>' +
      '<span class="stat-row__value">' + U.money(s.rates[d] || 0) + '</span></div>').join('');

    const finance = UI.card('Finanse ucznia',
      '<div class="dl">' +
        '<dt>Łączna liczba lekcji</dt><dd>' + f.lessonsHeld + '</dd>' +
        '<dt>Liczba godzin</dt><dd>' + U.num(f.hours, 1) + ' h</dd>' +
        '<dt>Łączna wartość zajęć</dt><dd>' + U.money(f.billed) + '</dd>' +
        '<dt>Zapłacono</dt><dd class="pos-up">' + U.money(f.paid) + '</dd>' +
        '<dt>Pozostało do zapłaty</dt><dd class="' + (f.due > 0 ? 'pos-down' : '') + '">' + U.money(f.due) + '</dd>' +
        '<dt>Średni miesięczny przychód</dt><dd>' + U.money(f.avgMonthly) + '</dd>' +
        '<dt>Średnia stawka godzinowa</dt><dd>' + U.money(f.avgRate) + '</dd>' +
      '</div>' +
      (f.due > 0 ? '<button class="btn btn--brand btn--block mt-4" data-action="addPayment" data-student="' + s.id + '">' +
        icon('wallet', 15) + ' Rozlicz ' + U.money(f.due) + '</button>' : ''),
      { subtitle: 'Współpraca od ' + U.fmtDate(s.startDate, 'medium') + ' (' + U.num(months, 1) + ' mies.)' });

    const priceCard = UI.card('Cennik', rates, {
      action: '<button class="btn btn--xs" data-action="editStudent" data-id="' + s.id + '">Zmień</button>'
    });

    /* wykres miesięczny ucznia */
    const keys = U.lastMonths(U.today(), 8);
    const series = keys.map((mk) => {
      const ls = S().lessonsOf(s.id).filter((l) => U.monthKey(l.date) === mk);
      return { label: U.monthNameShort(mk), fullLabel: U.monthLabel(mk), value: C().revenue(ls), sub: U.lessonsLabel(ls.filter(C().isHeld).length) };
    });
    const chart = UI.card('Przychód od ucznia', Ch().bars(series, { height: 190 }), { subtitle: 'Ostatnie 8 miesięcy' });

    const details = UI.card('Dane szczegółowe',
      '<div class="dl">' +
        '<dt>Telefon</dt><dd>' + U.esc(s.phone || '—') + '</dd>' +
        '<dt>E-mail</dt><dd class="truncate">' + U.esc(s.email || '—') + '</dd>' +
        '<dt>Kontakt rodzica</dt><dd>' + U.esc(s.parentContact || '—') + '</dd>' +
        '<dt>Klasa</dt><dd>' + U.esc(s.grade || '—') + '</dd>' +
        '<dt>Szkoła</dt><dd>' + U.esc(s.school || '—') + '</dd>' +
        '<dt>Poziom</dt><dd>' + U.esc(s.level || '—') + '</dd>' +
        '<dt>Przedmiot</dt><dd>' + U.esc(s.subject || '—') + '</dd>' +
        '<dt>Początek współpracy</dt><dd>' + U.fmtDate(s.startDate) + '</dd>' +
        '<dt>Preferowany termin</dt><dd>' + (s.preferredDay !== null && s.preferredDay !== undefined ?
          U.cap(U.DOW_LONG[s.preferredDay]) + ' ' + (s.preferredTime || '') : '—') + '</dd>' +
        '<dt>Tryb</dt><dd>' + (s.mode === 'online' ? 'Online' : 'Stacjonarnie') + '</dd>' +
        '<dt>Miejsce / platforma</dt><dd class="truncate">' + U.esc(s.location || '—') + '</dd>' +
      '</div>');

    return '<div class="grid grid-2-1">' +
      '<div class="col gap-4">' + timeline + chart + goalsBlock(s, true) + '</div>' +
      '<div class="col gap-4">' + finance + priceCard + details + '</div>' +
      '</div>';
  }

  /* ---------------- historia zajęć ---------------- */
  function lessonsTab(s) {
    const list = U.sortBy(S().lessonsOf(s.id), (l) => l.date + l.start, 'desc');
    if (!list.length) {
      return '<div class="card">' + UI.empty({
        icon: 'calendar', title: 'Brak zajęć', text: 'Zaplanuj pierwszą lekcję z tym uczniem.',
        ctaLabel: 'Dodaj zajęcia', ctaAction: 'addLesson', ctaData: 'data-student="' + s.id + '"'
      }) + '</div>';
    }
    return '<div class="card"><div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Data</th><th>Temat</th><th class="num">Czas</th><th class="num">Cena</th>' +
      '<th>Obecność</th><th>Płatność</th><th>Notatka</th><th></th></tr></thead><tbody>' +
      list.map(function (l) {
        return '<tr>' +
          '<td class="nowrap"><strong>' + U.fmtDate(l.date) + '</strong><div class="tiny dim">' + U.fmtTime(l.start) + '</div></td>' +
          '<td class="small">' + U.esc(l.topic || l.subject || '—') + '</td>' +
          '<td class="num small">' + U.durLabel(l.duration) + '</td>' +
          '<td class="num">' + U.money(l.price) + '</td>' +
          '<td>' + UI.lessonStatusBadge(l) + '</td>' +
          '<td>' + UI.paymentBadge(l) + '</td>' +
          '<td class="small dim truncate" style="max-width:200px">' + U.esc((l.summary && l.summary.done) || l.note || '—') + '</td>' +
          '<td class="actions-cell"><button class="icon-btn icon-btn--sm" data-action="lessonMenu" data-id="' + l.id + '">' + icon('more', 15) + '</button></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  /* ---------------- płatności ---------------- */
  function paymentsTab(s) {
    const f = C().studentFinance(s.id);
    const pays = U.sortBy(S().repo('payments').where((p) => p.studentId === s.id), (p) => p.date, 'desc');
    const unpaid = U.sortBy(C().unpaidLessons(s.id), (l) => l.date);
    const pkgs = S().repo('packages').where((p) => p.studentId === s.id);

    const balance = UI.card('Saldo',
      '<div class="dl">' +
        '<dt>Rozliczonych lekcji</dt><dd>' + f.lessonsBilled + '</dd>' +
        '<dt>Wartość</dt><dd>' + U.money(f.billed) + '</dd>' +
        '<dt>Zapłacono</dt><dd class="pos-up">' + U.money(f.paid) + '</dd>' +
        '<dt>Do zapłaty</dt><dd class="' + (f.due > 0 ? 'pos-down' : 'pos-up') + '">' + U.money(f.due) + '</dd>' +
      '</div>' +
      (unpaid.length ? '<div class="mt-4"><div class="small dim mb-2">Nieopłacone zajęcia</div>' +
        unpaid.map((l) => '<div class="stat-row"><span class="stat-row__label">' + U.fmtDate(l.date) + ' · ' + U.fmtTime(l.start) + '</span>' +
          '<span class="stat-row__value">' + U.money(C().lessonValue(l)) +
          ' <button class="btn btn--xs btn--soft" data-action="lessonPay" data-id="' + l.id + '">Opłacone</button></span></div>').join('') + '</div>' : ''),
      { action: '<button class="btn btn--sm btn--brand" data-action="addPayment" data-student="' + s.id + '"><span class="plus">+</span> Wpłata</button>' });

    const pkgCard = pkgs.length ? UI.card('Pakiety',
      pkgs.map(function (p) {
        const left = p.lessonsCount - p.usedCount;
        return '<div class="mb-4"><div class="row-between mb-2"><strong>' + p.lessonsCount + ' × ' + U.money(p.pricePerLesson) +
          ' = ' + U.money(p.total) + '</strong><span class="badge ' + (left > 0 ? 'badge--brand' : '') + '">' +
          (left > 0 ? 'pozostało ' + left : 'wykorzystany') + '</span></div>' +
          UI.progress(U.pct(p.usedCount, p.lessonsCount), left <= 2 && left > 0 ? 'warn' : '') +
          '<div class="tiny dim mt-1">Wykorzystano ' + p.usedCount + '/' + p.lessonsCount + ' · zakup ' + U.fmtDate(p.purchasedDate) + '</div></div>';
      }).join(''),
      { action: '<button class="btn btn--xs" data-action="addPackage" data-student="' + s.id + '">Nowy pakiet</button>' })
      : UI.card('Pakiety', '<p class="dim small">Ten uczeń nie ma wykupionego pakietu.</p>',
        { action: '<button class="btn btn--xs" data-action="addPackage" data-student="' + s.id + '">Sprzedaj pakiet</button>' });

    const history = UI.card('Historia wpłat',
      pays.length ? '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Data</th><th>Metoda</th><th>Opis</th><th class="num">Kwota</th><th></th></tr></thead><tbody>' +
        pays.map((p) => '<tr><td class="nowrap">' + U.fmtDate(p.date) + '</td>' +
          '<td class="small">' + (M.PAYMENT_METHOD[p.method] || { icon: '', label: p.method }).icon + ' ' + U.esc((M.PAYMENT_METHOD[p.method] || { label: p.method }).label) + '</td>' +
          '<td class="small dim">' + U.esc(p.note || (p.lessonIds.length ? U.lessonsLabel(p.lessonIds.length) : '—')) + '</td>' +
          '<td class="num bold">' + U.money(p.amount) + '</td>' +
          '<td class="actions-cell"><button class="icon-btn icon-btn--sm" data-action="deletePayment" data-id="' + p.id + '">' + icon('trash', 14) + '</button></td></tr>').join('') +
        '</tbody></table></div>' : '<p class="dim small">Brak zarejestrowanych wpłat.</p>',
      { noPad: pays.length > 0 });

    return '<div class="grid grid-2-1"><div class="col gap-4">' + history + '</div>' +
      '<div class="col gap-4">' + balance + pkgCard + '</div></div>';
  }

  /* ---------------- notatki / oś czasu ---------------- */
  function notesTab(s) {
    const notes = U.sortBy(S().repo('notes').where((n) => n.studentId === s.id), (n) => n.date, 'desc');
    const lessonsWithSummary = U.sortBy(
      S().lessonsOf(s.id).filter((l) => l.summary), (l) => l.date, 'desc');

    const timeline = lessonsWithSummary.length
      ? '<div class="timeline">' + lessonsWithSummary.map((l) =>
          '<div class="timeline__item"><div class="timeline__date">' + U.fmtDate(l.date, 'long') + '</div>' +
          '<div class="timeline__body"><span class="timeline__title">' + U.esc(l.summary.topic || l.topic || 'Zajęcia') + '</span>' +
          (l.summary.done ? '<br>' + U.esc(l.summary.done) : '') +
          (l.summary.performance ? '<br><span class="dim">Uczeń: ' + U.esc(l.summary.performance) + '</span>' : '') +
          (l.summary.improve ? '<br><span class="dim">Do poprawy: ' + U.esc(l.summary.improve) + '</span>' : '') +
          '</div></div>').join('') + '</div>'
      : '<p class="dim small">Brak notatek z lekcji. Użyj przycisku „Zakończ lekcję”, aby zapisywać przebieg zajęć.</p>';

    return '<div class="grid grid-2">' +
      '<div>' + UI.card('Oś czasu postępów', timeline, { subtitle: lessonsWithSummary.length + ' zapisanych lekcji' }) + '</div>' +
      '<div>' + UI.card('Notatki prywatne',
        notes.length ? '<div class="col gap-3">' + notes.map((n) => L().noteCard(n)).join('') + '</div>'
          : UI.empty({ icon: 'note', title: 'Brak notatek', text: 'Zapisz obserwacje o uczniu — przydadzą się przy planowaniu zajęć.' }),
        { action: '<button class="btn btn--sm" data-action="addNote" data-student="' + s.id + '"><span class="plus">+</span> Notatka</button>' }) + '</div>' +
      '</div>';
  }

  /* ---------------- cele ---------------- */
  function goalsBlock(s, compact) {
    const goals = S().repo('goals').where((g) => g.studentId === s.id);
    const body = goals.length
      ? goals.map((g) => '<div class="mb-4">' +
          '<div class="row-between mb-2"><strong>' + U.esc(g.title) + (g.done ? ' ✅' : '') + '</strong>' +
          '<span class="row gap-2"><span class="mono small">' + g.progress + '%</span>' +
          '<button class="icon-btn icon-btn--sm" data-action="editGoal" data-id="' + g.id + '">' + icon('edit', 13) + '</button></span></div>' +
          UI.progress(g.progress, g.progress >= 80 ? 'ok' : g.progress >= 40 ? '' : 'warn') +
          (g.deadline ? '<div class="tiny dim mt-1">Termin: ' + U.fmtDate(g.deadline, 'medium') + '</div>' : '') +
          '</div>').join('')
      : UI.empty({ icon: 'target', title: 'Brak celów', text: 'Dodaj cel, np. „Egzamin ósmoklasisty — 80%”.', ctaLabel: 'Dodaj cel', ctaAction: 'addGoal', ctaData: 'data-student="' + s.id + '"' });
    return UI.card('Cele ucznia', body, {
      action: '<button class="btn btn--sm" data-action="addGoal" data-student="' + s.id + '"><span class="plus">+</span> Cel</button>'
    });
  }

  function goalsTab(s) { return '<div class="grid grid-2">' + goalsBlock(s) + homeworkBlock(s) + '</div>'; }

  /* ---------------- materiały ---------------- */
  function materialsTab(s) {
    const mats = U.sortBy(S().repo('materials').where((m) => m.studentId === s.id), (m) => m.date, 'desc');
    return UI.card('Materiały ucznia',
      mats.length ? mats.map((m) => L().materialItem(m)).join('')
        : UI.empty({ icon: 'book', title: 'Brak materiałów', text: 'Przypisz uczniowi PDF-y, linki, arkusze i prace domowe.', ctaLabel: 'Dodaj materiał', ctaAction: 'addMaterial', ctaData: 'data-student="' + s.id + '"' }),
      { noPad: mats.length > 0, action: '<button class="btn btn--sm" data-action="addMaterial" data-student="' + s.id + '"><span class="plus">+</span> Materiał</button>' });
  }

  /* ---------------- praca domowa ---------------- */
  function homeworkBlock(s) {
    const hw = U.sortBy(S().repo('homework').where((h) => h.studentId === s.id), (h) => h.due || '', 'desc');
    const body = hw.length
      ? '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Zadanie</th><th>Termin</th><th>Status</th><th></th></tr></thead><tbody>' +
        hw.map((h) => '<tr><td>' + U.esc(h.title) + '</td><td class="nowrap small">' + (h.due ? U.fmtDate(h.due) : '—') + '</td>' +
          '<td><span class="badge badge--' + (M.HOMEWORK_STATUS[h.status] || {}).cls + '">' + U.esc((M.HOMEWORK_STATUS[h.status] || {}).label) + '</span></td>' +
          '<td class="actions-cell"><button class="icon-btn icon-btn--sm" data-action="editHomework" data-id="' + h.id + '">' + icon('edit', 14) + '</button></td></tr>').join('') +
        '</tbody></table></div>'
      : UI.empty({ icon: 'book', title: 'Brak zadań domowych', text: 'Zadaj pracę domową i śledź, czy została wykonana.', ctaLabel: 'Zadaj pracę', ctaAction: 'addHomework', ctaData: 'data-student="' + s.id + '"' });
    return UI.card('Praca domowa', body, {
      noPad: hw.length > 0,
      action: '<button class="btn btn--sm" data-action="addHomework" data-student="' + s.id + '"><span class="plus">+</span> Zadaj</button>'
    });
  }

  function homeworkTab(s) { return homeworkBlock(s); }

  /* ---------------- widok ---------------- */
  const detail = {
    render: function (params) {
      const s = S().student(params.id);
      if (!s) {
        return UI.empty({ icon: 'users', title: 'Nie znaleziono ucznia', text: 'Ten profil mógł zostać usunięty.', ctaLabel: 'Wróć do listy', ctaAction: 'go', ctaData: 'data-route="#/students"' });
      }
      const f = C().studentFinance(s.id);
      return '<button class="btn btn--sm mb-4" data-action="go" data-route="#/students">' + icon('chevronLeft', 15) + ' Wszyscy uczniowie</button>' +
        hero(s, f) +
        '<div class="tabs mt-5" id="studentTabs">' + TABS.map((t) =>
          '<button class="' + (state.tab === t.id ? 'is-active' : '') + '" data-tab="' + t.id + '">' + U.esc(t.label) + '</button>').join('') + '</div>' +
        '<div class="mt-4" id="tabBody">' + tabBody(s, f) + '</div>';
    },
    mount: function (host, params) {
      const s = S().student(params.id);
      if (!s) return;
      const tabs = host.querySelector('#studentTabs');
      const body = host.querySelector('#tabBody');
      if (!tabs) return;
      tabs.addEventListener('click', function (e) {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        state.tab = b.getAttribute('data-tab');
        Array.prototype.forEach.call(tabs.children, (x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        body.innerHTML = tabBody(s, C().studentFinance(s.id));
        body.style.animation = 'none';
        void body.offsetWidth;
        body.style.animation = 'fadeUp 260ms both';
      });
    }
  };

  function tabBody(s, f) {
    switch (state.tab) {
      case 'lessons': return lessonsTab(s);
      case 'payments': return paymentsTab(s);
      case 'notes': return notesTab(s);
      case 'goals': return goalsTab(s);
      case 'materials': return materialsTab(s);
      case 'homework': return homeworkTab(s);
      default: return overview(s, f);
    }
  }

  /* ---- podpięcie pod trasę #/students/:id ---- */
  const base = window.TF.Views.students;
  window.TF.Views.students = {
    title: function (p) { return p && p.id ? (S().student(p.id) ? S().studentName(p.id) : 'Uczeń') : 'Uczniowie'; },
    subtitle: function (p) {
      if (p && p.id) {
        const s = S().student(p.id);
        return s ? [s.subject, s.level, s.grade].filter(Boolean).join(' · ') : '';
      }
      return typeof base.subtitle === 'function' ? base.subtitle() : base.subtitle;
    },
    render: function (p, q) { return p && p.id ? detail.render(p) : base.render(p, q); },
    mount: function (h, p, q) { return p && p.id ? detail.mount(h, p) : base.mount(h, p, q); },
    setFilter: base.setFilter, setView: base.setView, state: base.state,
    detailState: state
  };
})();
