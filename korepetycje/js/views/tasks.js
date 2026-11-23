/* ============================================================
   TutorFlow — views/tasks.js
   Osobista lista zadań + prace domowe uczniów.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const icon = window.TF.icon;

  const state = { filter: 'open' };

  function apply(f) {
    const t = U.today();
    const all = S().repo('tasks').all();
    switch (f) {
      case 'open': return all.filter((x) => !x.done);
      case 'today': return all.filter((x) => !x.done && x.due && x.due <= t);
      case 'overdue': return all.filter((x) => !x.done && x.due && x.due < t);
      case 'high': return all.filter((x) => !x.done && x.priority === 'high');
      case 'done': return all.filter((x) => x.done);
      default: return all;
    }
  }

  function sortTasks(arr) {
    const order = { high: 0, med: 1, low: 2 };
    return arr.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ad = a.due || '9999', bd = b.due || '9999';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return (order[a.priority] || 1) - (order[b.priority] || 1);
    });
  }

  function quickAddBar() {
    return '<div class="card card--pad mb-4">' +
      '<form id="quickTask" class="row gap-2 wrap">' +
        '<input class="input grow" name="title" placeholder="Szybkie zadanie… np. sprawdzić pracę Anny" style="min-width:200px">' +
        '<select class="select select--sm" name="priority" style="width:auto">' +
          '<option value="high">Wysoki</option><option value="med" selected>Średni</option><option value="low">Niski</option></select>' +
        '<input class="input input--sm" type="date" name="due" style="width:auto" value="' + U.today() + '">' +
        '<button class="btn btn--brand btn--sm" type="submit"><span class="plus">+</span> Dodaj</button>' +
      '</form></div>';
  }

  function homeworkCard() {
    const hw = U.sortBy(S().repo('homework').where((h) => h.status === 'assigned'), (h) => h.due || '9999');
    return UI.card('Prace domowe do sprawdzenia',
      hw.length
        ? hw.map(function (h) {
            const late = h.due && h.due < U.today();
            return '<div class="task-item">' +
              '<span class="prio ' + (late ? 'prio-high' : 'prio-low') + '"></span>' +
              '<div class="grow" style="min-width:0"><div class="task-item__title">' + U.esc(h.title) + '</div>' +
              '<div class="lesson-row__meta"><span>' + U.esc(S().studentName(h.studentId)) + '</span>' +
              (h.due ? '<span>·</span><span class="' + (late ? 'pos-down bold' : '') + '">' + U.dayLabel(h.due, 'medium') + '</span>' : '') + '</div></div>' +
              '<div class="row gap-1">' +
                '<button class="btn btn--xs btn--soft" data-action="hwDone" data-id="' + h.id + '">Wykonane</button>' +
                '<button class="btn btn--xs" data-action="hwNotDone" data-id="' + h.id + '">Nie</button>' +
              '</div></div>';
          }).join('')
        : '<p class="dim small">Brak zadań domowych oczekujących na sprawdzenie.</p>',
      { noPad: hw.length > 0, action: '<button class="btn btn--sm" data-action="addHomework"><span class="plus">+</span> Zadaj</button>' });
  }

  function statsCard() {
    const all = S().repo('tasks').all();
    const open = all.filter((t) => !t.done);
    const overdue = open.filter((t) => t.due && t.due < U.today());
    return UI.card('Podsumowanie',
      '<div class="dl">' +
        '<dt>Otwarte zadania</dt><dd>' + open.length + '</dd>' +
        '<dt>Po terminie</dt><dd class="' + (overdue.length ? 'pos-down' : '') + '">' + overdue.length + '</dd>' +
        '<dt>Wysoki priorytet</dt><dd>' + open.filter((t) => t.priority === 'high').length + '</dd>' +
        '<dt>Ukończone</dt><dd class="pos-up">' + all.filter((t) => t.done).length + '</dd>' +
      '</div>');
  }

  window.TF.Views.tasks = {
    title: 'Zadania',
    subtitle: function () {
      const n = S().repo('tasks').where((t) => !t.done).length;
      return n ? n + ' ' + U.plural(n, 'otwarte zadanie', 'otwarte zadania', 'otwartych zadań') : 'Wszystko zrobione';
    },
    render: function () {
      const filters = [
        { id: 'open', label: 'Otwarte' }, { id: 'today', label: 'Na dziś' },
        { id: 'overdue', label: 'Po terminie' }, { id: 'high', label: 'Wysoki priorytet' },
        { id: 'done', label: 'Ukończone' }, { id: 'all', label: 'Wszystkie' }
      ];
      const arr = sortTasks(apply(state.filter));
      const body = arr.length
        ? arr.map((t) => L().taskItem(t)).join('')
        : UI.empty({
            icon: 'checkSquare',
            title: state.filter === 'open' ? 'Brak otwartych zadań' : 'Brak zadań w tym widoku',
            text: 'Dodaj zadanie, żeby nie zapomnieć o pracy poza lekcjami.',
            ctaLabel: 'Dodaj zadanie', ctaAction: 'addTask'
          });

      return quickAddBar() +
        '<div class="chips mb-4">' + filters.map((f) =>
          '<button class="chip ' + (state.filter === f.id ? 'is-active' : '') + '" data-action="tasksFilter" data-filter="' + f.id + '">' +
          U.esc(f.label) + '<span class="chip__count">' + apply(f.id).length + '</span></button>').join('') + '</div>' +
        '<div class="grid grid-2-1">' +
          '<div>' + UI.card('Zadania', body, { noPad: true,
            action: '<button class="btn btn--sm" data-action="addTask"><span class="plus">+</span> Nowe</button>' }) + '</div>' +
          '<div class="col gap-4">' + homeworkCard() + statsCard() + '</div>' +
        '</div>';
    },
    mount: function (host) {
      const form = host.querySelector('#quickTask');
      if (!form) return;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const v = window.TF.Forms.read(form);
        if (!v.title || !v.title.trim()) return;
        S().repo('tasks').add(M.Task({ title: v.title.trim(), priority: v.priority, due: v.due || null }));
        UI.toast('Zadanie dodane', { type: 'ok' });
        window.TF.Router.refresh();
      });
    },
    setFilter: function (f) { state.filter = f; },
    state: state
  };
})();
