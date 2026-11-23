/* ============================================================
   TutorFlow — views/students.js
   Lista uczniów: natychmiastowe wyszukiwanie, filtry, sortowanie,
   widok kart lub tabeli.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const icon = window.TF.icon;

  const state = { q: '', filter: 'active', sort: 'name', view: 'grid' };

  const FILTERS = [
    { id: 'all', label: 'Wszyscy' },
    { id: 'active', label: 'Aktywni' },
    { id: 'debt', label: 'Zaległości' },
    { id: 'online', label: 'Online' },
    { id: 'onsite', label: 'Stacjonarni' },
    { id: 'paused', label: 'Przerwa' },
    { id: 'ended', label: 'Zakończeni' },
    { id: 'lowrate', label: 'Niska stawka' }
  ];

  const SORTS = [
    { id: 'name', label: 'Nazwisko' },
    { id: 'revenue', label: 'Przychód' },
    { id: 'debt', label: 'Zaległość' },
    { id: 'next', label: 'Najbliższe zajęcia' },
    { id: 'rate', label: 'Stawka' },
    { id: 'recent', label: 'Ostatnie zajęcia' }
  ];

  function filterCount(id) {
    return apply(S().repo('students').all(), id, '').length;
  }

  function apply(list, filter, q) {
    const c = C();
    let out = list.filter(function (s) {
      if (q && !U.matches(s.firstName + ' ' + s.lastName + ' ' + s.subject + ' ' + s.level + ' ' + s.school + ' ' + s.grade + ' ' + s.email + ' ' + s.phone, q)) return false;
      switch (filter) {
        case 'active': return s.status === 'active';
        case 'paused': return s.status === 'paused';
        case 'ended': return s.status === 'ended';
        case 'online': return s.mode === 'online' && s.status !== 'ended';
        case 'onsite': return s.mode === 'onsite' && s.status !== 'ended';
        case 'debt': return c.unpaidTotal(s.id) > 0;
        case 'lowrate': return c.lowRateStudents(15).some((x) => x.student.id === s.id);
        default: return true;
      }
    });
    return out;
  }

  function sortList(list, sort) {
    const c = C();
    switch (sort) {
      case 'revenue': return U.sortBy(list, (s) => c.studentFinance(s.id).billed, 'desc');
      case 'debt': return U.sortBy(list, (s) => c.unpaidTotal(s.id), 'desc');
      case 'rate': return U.sortBy(list, (s) => s.rates[60] || 0, 'desc');
      case 'next': return U.sortBy(list, (s) => {
        const n = c.nextLessonOf(s.id);
        return n ? n.date + n.start : '9999';
      });
      case 'recent': return U.sortBy(list, (s) => {
        const l = c.lastHeldOf(s.id);
        return l ? l.date : '0000';
      }, 'desc');
      default: return U.sortBy(list, (s) => U.norm(s.lastName + s.firstName));
    }
  }

  function renderList() {
    const all = S().repo('students').all();
    const list = sortList(apply(all, state.filter, state.q), state.sort);

    if (!all.length) {
      return UI.empty({
        icon: 'users', title: 'Nie masz jeszcze żadnych uczniów',
        text: 'Dodaj pierwszego ucznia — cennik, kontakt i grafik znajdą się w jednym miejscu.',
        ctaLabel: 'Dodaj pierwszego ucznia', ctaAction: 'addStudent'
      });
    }
    if (!list.length) {
      return UI.empty({
        icon: 'search', title: 'Brak wyników',
        text: state.q ? 'Nic nie pasuje do „' + state.q + '”. Spróbuj innej frazy albo zmień filtr.' : 'Żaden uczeń nie spełnia tego filtra.'
      });
    }

    if (state.view === 'table') {
      return '<div class="card"><div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Uczeń</th><th>Przedmiot</th><th>Poziom</th><th>Tryb</th>' +
        '<th class="num">Stawka</th><th class="num">Lekcje</th><th>Najbliższe</th>' +
        '<th class="num">Saldo</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (s) {
          const f = C().studentFinance(s.id);
          return '<tr data-clickable data-action="go" data-route="#/students/' + s.id + '">' +
            '<td><div class="row gap-2">' + UI.avatar(s, 'sm') + '<span class="truncate bold">' + U.esc(S().studentName(s.id)) + '</span></div></td>' +
            '<td class="small">' + U.esc(s.subject || '—') + '</td>' +
            '<td class="small">' + U.esc(s.level || '—') + '</td>' +
            '<td class="small">' + (s.mode === 'online' ? 'Online' : 'Stacjonarnie') + '</td>' +
            '<td class="num">' + U.money(s.rates[60] || 0) + '</td>' +
            '<td class="num">' + f.lessonsHeld + '</td>' +
            '<td class="small nowrap">' + (f.nextLesson ? U.fmtDate(f.nextLesson.date, 'short') + ' ' + U.fmtTime(f.nextLesson.start) : '—') + '</td>' +
            '<td class="num ' + (f.due > 0 ? 'pos-down bold' : '') + '">' + (f.due > 0 ? U.money(f.due) : '—') + '</td>' +
            '<td>' + UI.studentStatusBadge(s) + '</td>' +
            '<td class="actions-cell"><button class="icon-btn icon-btn--sm" data-action="studentMenu" data-id="' + s.id + '">' + icon('more', 15) + '</button></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    return '<div class="grid grid-auto">' + list.map((s, i) => L().studentCard(s, i)).join('') + '</div>';
  }

  function summary() {
    const c = C();
    const all = S().repo('students').all();
    const active = all.filter((s) => s.status === 'active');
    const debtors = all.filter((s) => c.unpaidTotal(s.id) > 0);
    const ret = c.retention();
    return '<div class="kpi-grid">' +
      UI.kpi({ label: 'Aktywni uczniowie', icon: 'users', tone: 'info', value: active.length,
        foot: '<span>' + all.length + ' w bazie łącznie</span>' }) +
      UI.kpi({ label: 'Średnia stawka', icon: 'wallet', tone: 'ok', value: U.money(c.avgHourlyRate()),
        foot: '<span>za 60 minut</span>' }) +
      UI.kpi({ label: 'Z zaległością', icon: 'card', tone: debtors.length ? 'bad' : 'ok', value: debtors.length,
        foot: '<span>' + U.money(c.unpaidTotal()) + ' do odzyskania</span>' }) +
      UI.kpi({ label: 'Średnia współpraca', icon: 'clock', tone: '', value: U.num(ret.avgMonths, 1), unit: 'mies.',
        foot: '<span>' + ret.ended + ' zakończonych współprac</span>' }) +
      '</div>';
  }

  window.TF.Views.students = {
    title: 'Uczniowie',
    subtitle: function () { return U.studentsLabel(S().activeStudents().length) + ' aktywnych'; },
    render: function (params, query) {
      if (query && query.filter && FILTERS.some((f) => f.id === query.filter)) state.filter = query.filter;
      return '<div class="section" style="margin-top:0">' + summary() + '</div>' +
        '<div class="section">' +
          '<div class="row-between gap-3 wrap mb-4">' +
            '<div class="input-group" style="max-width:320px;flex:1">' + icon('search', 16) +
              '<input class="input" id="studentSearch" placeholder="Szukaj ucznia…" value="' + U.esc(state.q) + '" autocomplete="off"></div>' +
            '<div class="row gap-2 wrap">' +
              '<select class="select select--sm" id="studentSort" style="width:auto">' +
                SORTS.map((s) => '<option value="' + s.id + '"' + (state.sort === s.id ? ' selected' : '') + '>Sortuj: ' + s.label + '</option>').join('') +
              '</select>' +
              '<div class="segmented segmented--sm">' +
                '<button class="' + (state.view === 'grid' ? 'is-active' : '') + '" data-action="studentsView" data-view="grid">' + icon('grid', 14) + '</button>' +
                '<button class="' + (state.view === 'table' ? 'is-active' : '') + '" data-action="studentsView" data-view="table">' + icon('list', 14) + '</button>' +
              '</div>' +
              '<button class="btn btn--brand btn--sm" data-action="addStudent"><span class="plus">+</span> Nowy uczeń</button>' +
            '</div>' +
          '</div>' +
          '<div class="chips mb-4">' + FILTERS.map((f) =>
            '<button class="chip ' + (state.filter === f.id ? 'is-active' : '') + '" data-action="studentsFilter" data-filter="' + f.id + '">' +
            U.esc(f.label) + '<span class="chip__count">' + filterCount(f.id) + '</span></button>').join('') + '</div>' +
          '<div id="studentList">' + renderList() + '</div>' +
        '</div>';
    },
    mount: function (host) {
      const input = host.querySelector('#studentSearch');
      const listEl = host.querySelector('#studentList');
      if (input) {
        input.addEventListener('input', function () {
          state.q = input.value;
          listEl.innerHTML = renderList();
        });
      }
      const sortSel = host.querySelector('#studentSort');
      if (sortSel) {
        sortSel.addEventListener('change', function () {
          state.sort = sortSel.value;
          listEl.innerHTML = renderList();
        });
      }
    },
    setFilter: function (f) { state.filter = f; },
    setView: function (v) { state.view = v; },
    state: state
  };
})();
