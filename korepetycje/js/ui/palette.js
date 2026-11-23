/* ============================================================
   TutorFlow — palette.js
   Globalna wyszukiwarka w stylu Command Palette (Ctrl / ⌘ + K).
   Przeszukuje uczniów, lekcje, płatności, notatki, materiały,
   zadania oraz udostępnia szybkie komendy.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const icon = window.TF.icon;

  const P = { open: false, index: 0, results: [] };

  function commands() {
    const F = window.TF.Forms;
    return [
      { group: 'Akcje', label: 'Dodaj zajęcia', icon: 'calendar', run: () => F.lesson({}) },
      { group: 'Akcje', label: 'Dodaj ucznia', icon: 'users', run: () => F.student() },
      { group: 'Akcje', label: 'Dodaj płatność', icon: 'wallet', run: () => F.payment() },
      { group: 'Akcje', label: 'Dodaj zadanie', icon: 'checkSquare', run: () => F.task() },
      { group: 'Akcje', label: 'Dodaj notatkę', icon: 'note', run: () => F.note() },
      { group: 'Akcje', label: 'Dodaj wydatek', icon: 'receipt', run: () => F.expense() },
      { group: 'Akcje', label: 'Dodaj materiał', icon: 'book', run: () => F.material() },
      { group: 'Nawigacja', label: 'Dashboard', icon: 'dashboard', run: () => window.TF.Router.go('#/dashboard') },
      { group: 'Nawigacja', label: 'Dzisiaj', icon: 'today', run: () => window.TF.Router.go('#/today') },
      { group: 'Nawigacja', label: 'Kalendarz', icon: 'calendar', run: () => window.TF.Router.go('#/calendar') },
      { group: 'Nawigacja', label: 'Uczniowie', icon: 'users', run: () => window.TF.Router.go('#/students') },
      { group: 'Nawigacja', label: 'Zajęcia', icon: 'clock', run: () => window.TF.Router.go('#/lessons') },
      { group: 'Nawigacja', label: 'Finanse', icon: 'wallet', run: () => window.TF.Router.go('#/finance') },
      { group: 'Nawigacja', label: 'Płatności', icon: 'card', run: () => window.TF.Router.go('#/payments') },
      { group: 'Nawigacja', label: 'Wydatki', icon: 'receipt', run: () => window.TF.Router.go('#/expenses') },
      { group: 'Nawigacja', label: 'Prognozy', icon: 'trending', run: () => window.TF.Router.go('#/forecast') },
      { group: 'Nawigacja', label: 'Statystyki', icon: 'chart', run: () => window.TF.Router.go('#/stats') },
      { group: 'Nawigacja', label: 'Raporty', icon: 'file', run: () => window.TF.Router.go('#/reports') },
      { group: 'Nawigacja', label: 'Materiały', icon: 'book', run: () => window.TF.Router.go('#/materials') },
      { group: 'Nawigacja', label: 'Zadania', icon: 'checkSquare', run: () => window.TF.Router.go('#/tasks') },
      { group: 'Nawigacja', label: 'Notatki', icon: 'note', run: () => window.TF.Router.go('#/notes') },
      { group: 'Nawigacja', label: 'Przypomnienia', icon: 'bell', run: () => window.TF.Router.go('#/reminders') },
      { group: 'Nawigacja', label: 'Ustawienia', icon: 'settings', run: () => window.TF.Router.go('#/settings') },
      { group: 'Motyw', label: 'Motyw jasny', icon: 'sparkles', run: () => window.TF.App.setTheme('light') },
      { group: 'Motyw', label: 'Motyw ciemny', icon: 'sparkles', run: () => window.TF.App.setTheme('dark') },
      { group: 'Motyw', label: 'Motyw systemowy', icon: 'sparkles', run: () => window.TF.App.setTheme('system') },
      { group: 'Dane', label: 'Eksportuj kopię zapasową', icon: 'download', run: () => window.TF.App.exportData() },
      { group: 'Dane', label: 'Przenieś dane na inne urządzenie', icon: 'upload', run: () => window.TF.Router.go('#/settings') },
      { group: 'Dane', label: 'Importuj dane z pliku', icon: 'upload', run: () => window.TF.App.importData() },
      { group: 'Dane', label: 'Kopiuj kopię zapasową do schowka', icon: 'copy', run: () => window.TF.App.copyBackup() },
      { group: 'Dane', label: 'Eksportuj uczniów do CSV', icon: 'file', run: () => window.TF.App.exportCsv('students') },
      { group: 'Dane', label: 'Eksportuj zajęcia do CSV', icon: 'file', run: () => window.TF.App.exportCsv('lessons') },
      { group: 'Dane', label: 'Eksportuj płatności do CSV', icon: 'file', run: () => window.TF.App.exportCsv('payments') },
      { group: 'Dane', label: 'Kopiuj wolne terminy', icon: 'copy', run: () => window.TF.App.copyFreeSlots() }
    ];
  }

  function search(q) {
    const out = [];
    const st = S();
    const c = C();

    if (!q) {
      const next = c.nextLesson();
      if (next) {
        out.push({
          group: 'Najbliższe', icon: 'clock',
          label: st.studentName(next.studentId),
          meta: U.dayLabel(next.date, 'medium') + ', ' + U.fmtTime(next.start),
          sub: U.esc(next.topic || next.subject || ''),
          run: () => window.TF.Router.go('#/today')
        });
      }
      commands().filter((x) => x.group === 'Akcje').forEach((x) => out.push(Object.assign({ meta: '' }, x)));
      commands().filter((x) => x.group === 'Nawigacja').slice(0, 6).forEach((x) => out.push(Object.assign({ meta: '' }, x)));
      return out;
    }

    /* uczniowie */
    st.repo('students').all().forEach(function (s) {
      const name = st.studentName(s.id);
      if (!U.matches(name + ' ' + s.subject + ' ' + s.level + ' ' + s.school + ' ' + s.phone + ' ' + s.email, q)) return;
      const due = c.unpaidTotal(s.id);
      out.push({
        group: 'Uczniowie', label: name, icon: 'user',
        sub: [s.subject, s.level, s.mode === 'online' ? 'online' : 'stacjonarnie'].filter(Boolean).join(' · '),
        meta: due > 0 ? U.money(due) + ' zaległości' : U.money(s.rates[60] || 0),
        avatar: s,
        run: () => window.TF.Router.go('#/students/' + s.id)
      });
    });

    /* lekcje */
    U.sortBy(st.repo('lessons').all(), (l) => l.date, 'desc').forEach(function (l) {
      if (out.length > 60) return;
      const name = st.studentName(l.studentId);
      if (!U.matches(name + ' ' + (l.topic || '') + ' ' + (l.subject || '') + ' ' + l.date, q)) return;
      out.push({
        group: 'Zajęcia', label: name + ' — ' + U.fmtDate(l.date), icon: 'calendar',
        sub: U.fmtTime(l.start) + ' · ' + (l.topic || l.subject || 'Zajęcia'),
        meta: U.money(l.price),
        run: () => { window.TF.Router.go('#/calendar?date=' + l.date + '&mode=day'); }
      });
    });

    /* płatności */
    U.sortBy(st.repo('payments').all(), (p) => p.date, 'desc').forEach(function (p) {
      if (out.length > 80) return;
      if (!U.matches(st.studentName(p.studentId) + ' ' + (p.note || '') + ' ' + p.amount, q)) return;
      out.push({
        group: 'Płatności', label: st.studentName(p.studentId) + ' — ' + U.money(p.amount), icon: 'wallet',
        sub: U.fmtDate(p.date) + ' · ' + (p.note || ''),
        meta: '', run: () => window.TF.Router.go('#/students/' + p.studentId)
      });
    });

    /* notatki */
    st.repo('notes').all().forEach(function (n) {
      if (out.length > 100) return;
      if (!U.matches(n.text + ' ' + st.studentName(n.studentId), q)) return;
      out.push({
        group: 'Notatki', label: (n.text || '').slice(0, 60), icon: 'note',
        sub: (n.studentId ? st.studentName(n.studentId) + ' · ' : '') + U.fmtDate(n.date),
        meta: '', run: () => window.TF.Router.go(n.studentId ? '#/students/' + n.studentId : '#/notes')
      });
    });

    /* materiały i zadania */
    st.repo('materials').all().forEach(function (m) {
      if (out.length > 110) return;
      if (!U.matches(m.title, q)) return;
      out.push({ group: 'Materiały', label: m.title, icon: 'book', sub: st.studentName(m.studentId), meta: '', run: () => window.TF.Router.go('#/materials') });
    });
    st.repo('tasks').all().forEach(function (t) {
      if (out.length > 120) return;
      if (!U.matches(t.title, q)) return;
      out.push({ group: 'Zadania', label: t.title, icon: 'checkSquare', sub: t.done ? 'ukończone' : 'otwarte', meta: t.due ? U.fmtDate(t.due) : '', run: () => window.TF.Router.go('#/tasks') });
    });

    /* komendy */
    commands().forEach(function (cmd) {
      if (U.matches(cmd.label, q)) out.push(Object.assign({ meta: '' }, cmd));
    });

    return out.slice(0, 40);
  }

  function render() {
    const box = document.getElementById('paletteResults');
    if (!P.results.length) {
      box.innerHTML = '<div class="empty" style="padding:32px"><div class="empty__art">' + icon('search', 26) + '</div>' +
        '<h3>Brak wyników</h3><p class="small">Spróbuj innej frazy — szukamy w uczniach, lekcjach, płatnościach i notatkach.</p></div>';
      return;
    }
    let html = '', lastGroup = null;
    P.results.forEach(function (r, i) {
      if (r.group !== lastGroup) { html += '<div class="palette__group">' + U.esc(r.group) + '</div>'; lastGroup = r.group; }
      html += '<button class="palette__item ' + (i === P.index ? 'is-active' : '') + '" data-idx="' + i + '">' +
        (r.avatar ? window.TF.UI.avatar(r.avatar, 'sm') : '<span class="palette__ico">' + icon(r.icon || 'search', 15) + '</span>') +
        '<span style="min-width:0"><strong>' + U.esc(r.label) + '</strong>' +
        (r.sub ? '<small>' + U.esc(r.sub) + '</small>' : '') + '</span>' +
        (r.meta ? '<span class="palette__meta">' + U.esc(r.meta) + '</span>' : '') +
        '</button>';
    });
    box.innerHTML = html;
    const active = box.querySelector('.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  P.show = function () {
    const el = document.getElementById('palette');
    el.hidden = false;
    P.open = true;
    P.index = 0;
    const input = document.getElementById('paletteInput');
    input.value = '';
    P.results = search('');
    render();
    setTimeout(() => input.focus(), 30);
    document.body.style.overflow = 'hidden';
  };

  P.hide = function () {
    document.getElementById('palette').hidden = true;
    P.open = false;
    if (!window.TF.UI.hasModal() && !window.TF.UI.hasSheet()) document.body.style.overflow = '';
  };

  P.bind = function () {
    const input = document.getElementById('paletteInput');
    const box = document.getElementById('paletteResults');

    input.addEventListener('input', function () {
      P.results = search(input.value.trim());
      P.index = 0;
      render();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); P.index = Math.min(P.results.length - 1, P.index + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); P.index = Math.max(0, P.index - 1); render(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const r = P.results[P.index];
        if (r) { P.hide(); setTimeout(() => r.run(), 40); }
      } else if (e.key === 'Escape') { P.hide(); }
    });

    box.addEventListener('click', function (e) {
      const b = e.target.closest('[data-idx]');
      if (!b) return;
      const r = P.results[+b.getAttribute('data-idx')];
      P.hide();
      setTimeout(() => r.run(), 40);
    });
  };

  window.TF.Palette = P;
})();
