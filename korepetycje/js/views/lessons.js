/* ============================================================
   TutorFlow — views/lessons.js
   Wszystkie zajęcia w jednej tabeli: filtry, obecności, płatności.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const icon = window.TF.icon;

  const state = { filter: 'month', q: '', sort: 'date-desc', student: '' };

  const FILTERS = [
    { id: 'today', label: 'Dzisiaj' },
    { id: 'week', label: 'Ten tydzień' },
    { id: 'month', label: 'Ten miesiąc' },
    { id: 'upcoming', label: 'Nadchodzące' },
    { id: 'done', label: 'Odbyte' },
    { id: 'planned', label: 'Zaplanowane' },
    { id: 'cancelled', label: 'Odwołane' },
    { id: 'unpaid', label: 'Nieopłacone' },
    { id: 'stale', label: 'Do oznaczenia' },
    { id: 'all', label: 'Wszystkie' }
  ];

  function apply(filter) {
    const c = C();
    const t = U.today();
    const all = S().repo('lessons').all();
    switch (filter) {
      case 'today': return all.filter((l) => l.date === t);
      case 'week': { const a = U.startOfWeek(t), b = U.addDays(a, 6); return all.filter((l) => l.date >= a && l.date <= b); }
      case 'month': return all.filter((l) => U.monthKey(l.date) === U.monthKey(t));
      case 'upcoming': return all.filter((l) => l.date >= t && c.isPlanned(l));
      case 'done': return all.filter(c.isHeld);
      case 'planned': return all.filter(c.isPlanned);
      case 'cancelled': return all.filter((l) => c.isCancelled(l) || l.status === 'no_show' || l.status === 'rescheduled');
      case 'unpaid': return all.filter(c.isDue);
      case 'stale': return all.filter((l) => l.status === 'planned' && c.isPast(l));
      default: return all;
    }
  }

  function list() {
    let arr = apply(state.filter);
    if (state.student) arr = arr.filter((l) => l.studentId === state.student);
    if (state.q) arr = arr.filter((l) => U.matches(S().studentName(l.studentId) + ' ' + (l.topic || '') + ' ' + (l.subject || ''), state.q));
    const [key, dir] = state.sort.split('-');
    if (key === 'price') return U.sortBy(arr, (l) => l.price, dir);
    if (key === 'student') return U.sortBy(arr, (l) => U.norm(S().studentName(l.studentId)), dir);
    return U.sortBy(arr, (l) => l.date + l.start, dir);
  }

  function renderTable() {
    const arr = list();
    if (!arr.length) {
      return UI.empty({
        icon: 'clock', title: 'Brak zajęć w tym widoku',
        text: state.q ? 'Zmień frazę wyszukiwania lub filtr.' : 'Zmień filtr albo dodaj nowe zajęcia.',
        ctaLabel: 'Dodaj zajęcia', ctaAction: 'addLesson'
      });
    }
    const revenue = C().revenue(arr);
    const planned = C().plannedValue(arr);
    const minutes = U.sum(arr.filter(C().isHeld), (l) => l.duration);

    return '<div class="card"><div class="table-wrap"><table class="table">' +
      '<thead><tr>' +
        '<th class="sortable" data-sort="date">Data</th><th>Godzina</th>' +
        '<th class="sortable" data-sort="student">Uczeń</th><th>Temat</th><th>Typ</th>' +
        '<th class="num">Czas</th><th class="num sortable" data-sort="price">Cena</th>' +
        '<th>Status zajęć</th><th>Płatność</th><th></th>' +
      '</tr></thead><tbody>' +
      arr.map((l) => L().lessonTableRow(l)).join('') +
      '</tbody>' +
      '<tfoot><tr style="background:var(--surface-2)">' +
        '<td colspan="5" class="bold">' + U.lessonsLabel(arr.length) + ' · ' + U.num(minutes / 60, 1) + ' h odbytych</td>' +
        '<td class="num"></td>' +
        '<td class="num bold">' + U.money(revenue + planned) + '</td>' +
        '<td colspan="3" class="small dim">rozliczone ' + U.money(revenue) + (planned ? ' + plan ' + U.money(planned) : '') + '</td>' +
      '</tr></tfoot>' +
      '</table></div></div>';
  }

  function attendanceCard() {
    const c = C();
    const arr = apply(state.filter);
    const counts = {};
    Object.keys(M.LESSON_STATUS).forEach((k) => { counts[k] = arr.filter((l) => l.status === k).length; });
    return UI.card('Obecności w tym widoku',
      Object.keys(M.LESSON_STATUS).map((k) => {
        const s = M.LESSON_STATUS[k];
        return '<div class="stat-row"><span class="stat-row__label">' + s.icon + ' ' + U.esc(s.label) + '</span>' +
          '<span class="stat-row__value">' + counts[k] + '</span></div>';
      }).join('') +
      '<div class="mt-4"><div class="row-between small mb-2"><span class="dim">Frekwencja</span><b>' + U.pctLabel(c.attendance(arr), 0) + '</b></div>' +
      UI.progress(c.attendance(arr), 'ok') + '</div>' +
      '<div class="mt-3"><div class="row-between small mb-2"><span class="dim">Odwołania</span><b>' + U.pctLabel(c.cancellationRate(arr), 0) + '</b></div>' +
      UI.progress(c.cancellationRate(arr), 'bad') + '</div>');
  }

  function policyCard() {
    const pol = S().settings().cancellationPolicy || {};
    return UI.card('Zasada odwołań',
      '<p class="muted small">Lekcja odwołana mniej niż <b>' + (pol.hours || 24) + ' h</b> przed terminem jest ' +
      (pol.chargeable ? '<b>płatna</b>' : '<b>bezpłatna</b>') + '. Nieobecność bez zgłoszenia jest ' +
      (pol.noShowChargeable !== false ? '<b>płatna</b>' : '<b>bezpłatna</b>') + '.</p>' +
      '<p class="tiny dim mt-3">Przy odwoływaniu zajęć TutorFlow automatycznie podpowie, czy naliczyć opłatę.</p>' +
      '<button class="btn btn--sm btn--block mt-4" data-action="go" data-route="#/settings">' + icon('settings', 14) + ' Zmień zasadę</button>');
  }

  window.TF.Views.lessons = {
    title: 'Zajęcia',
    subtitle: function () { return S().repo('lessons').all().length + ' zajęć w bazie'; },
    render: function (params, query) {
      if (query && query.filter && FILTERS.some((f) => f.id === query.filter)) state.filter = query.filter;
      if (query && query.student) state.student = query.student;

      return '<div class="row-between gap-3 wrap mb-4">' +
          '<div class="input-group" style="max-width:300px;flex:1">' + icon('search', 16) +
            '<input class="input" id="lessonSearch" placeholder="Szukaj po uczniu lub temacie…" value="' + U.esc(state.q) + '"></div>' +
          '<div class="row gap-2 wrap">' +
            '<select class="select select--sm" id="lessonStudent" style="width:auto">' +
              '<option value="">Wszyscy uczniowie</option>' + window.TF.Forms.studentOptions(state.student, { all: true }) + '</select>' +
            '<select class="select select--sm" id="lessonSort" style="width:auto">' +
              '<option value="date-desc"' + (state.sort === 'date-desc' ? ' selected' : '') + '>Najnowsze</option>' +
              '<option value="date-asc"' + (state.sort === 'date-asc' ? ' selected' : '') + '>Najstarsze</option>' +
              '<option value="price-desc"' + (state.sort === 'price-desc' ? ' selected' : '') + '>Najdroższe</option>' +
              '<option value="student-asc"' + (state.sort === 'student-asc' ? ' selected' : '') + '>Wg ucznia</option>' +
            '</select>' +
            '<button class="btn btn--brand btn--sm" data-action="addLesson"><span class="plus">+</span> Dodaj zajęcia</button>' +
          '</div>' +
        '</div>' +
        '<div class="chips mb-4">' + FILTERS.map((f) =>
          '<button class="chip ' + (state.filter === f.id ? 'is-active' : '') + '" data-action="lessonsFilter" data-filter="' + f.id + '">' +
          U.esc(f.label) + '<span class="chip__count">' + apply(f.id).length + '</span></button>').join('') + '</div>' +
        '<div class="grid grid-2-1">' +
          '<div id="lessonTable">' + renderTable() + '</div>' +
          '<div class="col gap-4">' + attendanceCard() + policyCard() + '</div>' +
        '</div>';
    },
    mount: function (host) {
      const input = host.querySelector('#lessonSearch');
      const table = host.querySelector('#lessonTable');
      if (input) input.addEventListener('input', function () { state.q = input.value; table.innerHTML = renderTable(); });
      const sel = host.querySelector('#lessonStudent');
      if (sel) sel.addEventListener('change', function () { state.student = sel.value; table.innerHTML = renderTable(); });
      const sort = host.querySelector('#lessonSort');
      if (sort) sort.addEventListener('change', function () { state.sort = sort.value; table.innerHTML = renderTable(); });
      if (table) {
        table.addEventListener('click', function (e) {
          const th = e.target.closest('[data-sort]');
          if (!th) return;
          const key = th.getAttribute('data-sort');
          const [k, d] = state.sort.split('-');
          state.sort = key + '-' + (k === key && d === 'desc' ? 'asc' : 'desc');
          table.innerHTML = renderTable();
        });
      }
    },
    setFilter: function (f) { state.filter = f; },
    state: state
  };
})();
