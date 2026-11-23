/* ============================================================
   TutorFlow — router.js
   Routing po hashu (#/…), renderowanie nawigacji i montowanie
   widoków. Widoki rejestrują się w TF.Views[nazwa].
   ============================================================ */
window.TF = window.TF || {};
window.TF.Views = window.TF.Views || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const icon = window.TF.icon;

  const NAV = [
    {
      title: 'Codziennie', items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '#/dashboard' },
        { id: 'today', label: 'Dzisiaj', icon: 'today', route: '#/today' },
        { id: 'calendar', label: 'Kalendarz', icon: 'calendar', route: '#/calendar' }
      ]
    },
    {
      title: 'Praca', items: [
        { id: 'students', label: 'Uczniowie', icon: 'users', route: '#/students', badge: 'students' },
        { id: 'lessons', label: 'Zajęcia', icon: 'clock', route: '#/lessons' },
        { id: 'print', label: 'Wydruki', icon: 'printer', route: '#/print' },
        { id: 'materials', label: 'Materiały', icon: 'book', route: '#/materials' },
        { id: 'tasks', label: 'Zadania', icon: 'checkSquare', route: '#/tasks', badge: 'tasks' },
        { id: 'notes', label: 'Notatki', icon: 'note', route: '#/notes' }
      ]
    },
    {
      title: 'Finanse', items: [
        { id: 'finance', label: 'Finanse', icon: 'wallet', route: '#/finance' },
        { id: 'payments', label: 'Płatności', icon: 'card', route: '#/payments', badge: 'unpaid' },
        { id: 'expenses', label: 'Wydatki', icon: 'receipt', route: '#/expenses' },
        { id: 'forecast', label: 'Prognozy', icon: 'trending', route: '#/forecast' }
      ]
    },
    {
      title: 'Analiza', items: [
        { id: 'stats', label: 'Statystyki', icon: 'chart', route: '#/stats' },
        { id: 'reports', label: 'Raporty', icon: 'file', route: '#/reports' },
        { id: 'reminders', label: 'Przypomnienia', icon: 'bell', route: '#/reminders', badge: 'reminders' }
      ]
    },
    {
      title: '', items: [
        { id: 'settings', label: 'Ustawienia', icon: 'settings', route: '#/settings' }
      ]
    }
  ];

  const MOBILE = [
    { id: 'today', label: 'Dzisiaj', icon: 'today', route: '#/today' },
    { id: 'calendar', label: 'Kalendarz', icon: 'calendar', route: '#/calendar' },
    { id: 'dashboard', label: 'Pulpit', icon: 'dashboard', route: '#/dashboard' },
    { id: 'students', label: 'Uczniowie', icon: 'users', route: '#/students' },
    { id: 'finance', label: 'Finanse', icon: 'wallet', route: '#/finance' }
  ];

  const R = { current: null, params: {}, query: {} };

  function parse(hash) {
    const h = (hash || location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [pathPart, queryPart] = h.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    const query = {};
    if (queryPart) {
      queryPart.split('&').forEach((kv) => {
        const [k, v] = kv.split('=');
        query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { view: parts[0] || 'dashboard', id: parts[1] || null, query: query };
  }

  function badgeValue(kind) {
    const C = window.TF.Compute, S = window.TF.Store;
    try {
      if (kind === 'students') return { text: S.activeStudents().length, cls: '' };
      if (kind === 'unpaid') {
        const n = C.unpaidLessons().length;
        return n ? { text: n, cls: 'nav__pill--bad' } : null;
      }
      if (kind === 'tasks') {
        const n = S.repo('tasks').where((t) => !t.done).length;
        return n ? { text: n, cls: 'nav__pill--brand' } : null;
      }
      if (kind === 'reminders') {
        const n = window.TF.Insights.reminders().length;
        return n ? { text: n, cls: 'nav__pill--warn' } : null;
      }
    } catch (e) { return null; }
    return null;
  }

  R.renderNav = function () {
    const active = R.current;
    document.getElementById('nav').innerHTML = NAV.map((g) =>
      '<div class="nav__group">' +
        (g.title ? '<div class="nav__title">' + U.esc(g.title) + '</div>' : '') +
        g.items.map((it) => {
          const b = it.badge ? badgeValue(it.badge) : null;
          return '<a class="nav__link ' + (it.id === active ? 'is-active' : '') + '" href="' + it.route + '">' +
            icon(it.icon, 17) + '<span>' + U.esc(it.label) + '</span>' +
            (b ? '<span class="nav__pill ' + b.cls + '">' + b.text + '</span>' : '') + '</a>';
        }).join('') +
      '</div>').join('');

    document.getElementById('mobilebar').innerHTML = MOBILE.map((it) =>
      '<a class="' + (it.id === active ? 'is-active' : '') + '" href="' + it.route + '">' +
      icon(it.icon, 19) + '<span>' + U.esc(it.label) + '</span></a>').join('');

    const rem = window.TF.Insights.reminders().length;
    const badge = document.getElementById('remindersBadge');
    if (badge) badge.hidden = rem === 0;
  };

  R.go = function (hash) {
    if (location.hash === hash) { R.render(); return; }
    location.hash = hash;
  };

  R.refresh = U.debounce(function () { R.render(); }, 60);

  R.render = function () {
    const p = parse();
    const view = window.TF.Views[p.view] || window.TF.Views.dashboard;
    R.current = window.TF.Views[p.view] ? p.view : 'dashboard';
    R.params = { id: p.id };
    R.query = p.query;

    if (window.TF.App && window.TF.App.clearTimers) window.TF.App.clearTimers();

    const host = document.getElementById('view');
    const title = typeof view.title === 'function' ? view.title(R.params) : view.title;
    const sub = typeof view.subtitle === 'function' ? view.subtitle(R.params) : (view.subtitle || '');
    document.body.setAttribute('data-view', R.current);
    document.getElementById('viewTitle').textContent = title || '';
    document.getElementById('viewSub').textContent = sub || '';
    document.title = (title ? title + ' · ' : '') + (window.TF.Store.settings().appName || 'TutorFlow');

    try {
      host.innerHTML = view.render(R.params, R.query) || '';
      if (view.mount) view.mount(host, R.params, R.query);
    } catch (e) {
      console.error('[TutorFlow] Błąd widoku „' + p.view + '”:', e);
      host.innerHTML = '<div class="empty"><div class="empty__art">' + icon('alert', 30) + '</div>' +
        '<h3>Coś poszło nie tak przy renderowaniu tego widoku</h3>' +
        '<p class="small dim">' + U.esc(e.message) + '</p>' +
        '<button class="btn mt-2" data-action="reload">Odśwież</button></div>';
    }

    R.renderNav();
    document.getElementById('app').classList.remove('is-sidebar-open');
    if (!p.id) host.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  };

  R.start = function () {
    window.addEventListener('hashchange', R.render);
    if (!location.hash) location.hash = '#/dashboard';
    R.render();
  };

  R.NAV = NAV;
  window.TF.Router = R;
})();
