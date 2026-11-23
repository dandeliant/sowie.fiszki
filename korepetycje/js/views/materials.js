/* ============================================================
   TutorFlow — views/materials.js
   Biblioteka materiałów przypisanych do uczniów.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const icon = window.TF.icon;

  const state = { type: 'all', q: '', student: '' };

  function list() {
    let arr = U.sortBy(S().repo('materials').all(), (m) => m.date, 'desc');
    if (state.type !== 'all') arr = arr.filter((m) => m.type === state.type);
    if (state.student) arr = arr.filter((m) => m.studentId === state.student);
    if (state.q) arr = arr.filter((m) => U.matches(m.title + ' ' + (m.note || '') + ' ' + S().studentName(m.studentId), state.q));
    return arr;
  }

  function renderList() {
    const arr = list();
    if (!S().repo('materials').all().length) {
      return UI.empty({
        icon: 'book', title: 'Nie masz jeszcze materiałów',
        text: 'Zbieraj PDF-y, linki, arkusze i ćwiczenia w jednym miejscu — przypisane do konkretnych uczniów.',
        ctaLabel: 'Dodaj pierwszy materiał', ctaAction: 'addMaterial'
      });
    }
    if (!arr.length) return UI.empty({ icon: 'search', title: 'Brak wyników', text: 'Zmień filtr lub frazę wyszukiwania.' });
    return '<div class="card">' + arr.map((m) => L().materialItem(m)).join('') + '</div>';
  }

  window.TF.Views.materials = {
    title: 'Materiały',
    subtitle: function () { return S().repo('materials').all().length + ' pozycji w bibliotece'; },
    render: function () {
      const types = ['all'].concat(Object.keys(M.MATERIAL_TYPE));
      return '<div class="row-between mb-4 wrap gap-3">' +
          '<div class="input-group" style="max-width:300px;flex:1">' + icon('search', 16) +
            '<input class="input" id="matSearch" placeholder="Szukaj materiału…" value="' + U.esc(state.q) + '"></div>' +
          '<div class="row gap-2 wrap">' +
            '<select class="select select--sm" id="matStudent" style="width:auto">' +
              '<option value="">Wszyscy uczniowie</option>' + window.TF.Forms.studentOptions(state.student, { all: true }) + '</select>' +
            '<button class="btn btn--brand btn--sm" data-action="addMaterial"><span class="plus">+</span> Dodaj materiał</button>' +
          '</div></div>' +
        '<div class="chips mb-4">' + types.map((k) => {
          const label = k === 'all' ? 'Wszystkie' : M.MATERIAL_TYPE[k].icon + ' ' + M.MATERIAL_TYPE[k].label;
          const n = k === 'all' ? S().repo('materials').all().length : S().repo('materials').where((m) => m.type === k).length;
          if (k !== 'all' && !n) return '';
          return '<button class="chip ' + (state.type === k ? 'is-active' : '') + '" data-action="materialType" data-type="' + k + '">' +
            label + '<span class="chip__count">' + n + '</span></button>';
        }).join('') + '</div>' +
        '<div id="matList">' + renderList() + '</div>';
    },
    mount: function (host) {
      const input = host.querySelector('#matSearch');
      const listEl = host.querySelector('#matList');
      if (input) input.addEventListener('input', function () { state.q = input.value; listEl.innerHTML = renderList(); });
      const sel = host.querySelector('#matStudent');
      if (sel) sel.addEventListener('change', function () { state.student = sel.value; listEl.innerHTML = renderList(); });
    },
    setType: function (t) { state.type = t; },
    state: state
  };
})();
