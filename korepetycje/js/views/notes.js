/* ============================================================
   TutorFlow — views/notes.js
   Wszystkie notatki: prywatne, z lekcji i o postępach.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const icon = window.TF.icon;

  const state = { kind: 'all', q: '', student: '' };

  function list() {
    let arr = U.sortBy(S().repo('notes').all(), (n) => n.date, 'desc');
    if (state.kind !== 'all') arr = arr.filter((n) => n.kind === state.kind);
    if (state.student) arr = arr.filter((n) => n.studentId === state.student);
    if (state.q) arr = arr.filter((n) => U.matches(n.text + ' ' + S().studentName(n.studentId), state.q));
    return arr;
  }

  function renderList() {
    const arr = list();
    if (!S().repo('notes').all().length) {
      return UI.empty({
        icon: 'note', title: 'Nie masz jeszcze notatek',
        text: 'Zapisuj obserwacje o uczniach — po kilku miesiącach powstanie z nich historia postępów.',
        ctaLabel: 'Dodaj pierwszą notatkę', ctaAction: 'addNote'
      });
    }
    if (!arr.length) return UI.empty({ icon: 'search', title: 'Brak wyników', text: 'Zmień filtr lub frazę wyszukiwania.' });
    const byMonth = U.groupBy(arr, (n) => U.monthKey(n.date));
    return Object.keys(byMonth).sort().reverse().map((mk) =>
      '<div class="section" style="margin-top:0;margin-bottom:24px">' +
        '<div class="section__head"><h2>' + U.monthLabel(mk) + '</h2><p>' + byMonth[mk].length + ' notatek</p></div>' +
        '<div class="grid grid-auto">' + byMonth[mk].map((n) => L().noteCard(n)).join('') + '</div>' +
      '</div>').join('');
  }

  window.TF.Views.notes = {
    title: 'Notatki',
    subtitle: function () { return S().repo('notes').all().length + ' zapisanych notatek'; },
    render: function () {
      const kinds = [
        { id: 'all', label: 'Wszystkie' }, { id: 'private', label: 'Prywatne' },
        { id: 'lesson', label: 'Z lekcji' }, { id: 'progress', label: 'Postępy' }
      ];
      return '<div class="row-between mb-4 wrap gap-3">' +
          '<div class="input-group" style="max-width:320px;flex:1">' + icon('search', 16) +
            '<input class="input" id="noteSearch" placeholder="Szukaj w notatkach…" value="' + U.esc(state.q) + '"></div>' +
          '<div class="row gap-2 wrap">' +
            '<select class="select select--sm" id="noteStudent" style="width:auto">' +
              '<option value="">Wszyscy uczniowie</option>' + window.TF.Forms.studentOptions(state.student, { all: true }) + '</select>' +
            '<button class="btn btn--brand btn--sm" data-action="addNote"><span class="plus">+</span> Nowa notatka</button>' +
          '</div></div>' +
        '<div class="chips mb-4">' + kinds.map((k) =>
          '<button class="chip ' + (state.kind === k.id ? 'is-active' : '') + '" data-action="noteKind" data-kind="' + k.id + '">' +
          U.esc(k.label) + '<span class="chip__count">' +
          (k.id === 'all' ? S().repo('notes').all().length : S().repo('notes').where((n) => n.kind === k.id).length) +
          '</span></button>').join('') + '</div>' +
        '<div id="noteList">' + renderList() + '</div>';
    },
    mount: function (host) {
      const input = host.querySelector('#noteSearch');
      const listEl = host.querySelector('#noteList');
      if (input) input.addEventListener('input', function () { state.q = input.value; listEl.innerHTML = renderList(); });
      const sel = host.querySelector('#noteStudent');
      if (sel) sel.addEventListener('change', function () { state.student = sel.value; listEl.innerHTML = renderList(); });
    },
    setKind: function (k) { state.kind = k; },
    state: state
  };
})();
