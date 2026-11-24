/* ============================================================
   TutorFlow — app.js
   Start aplikacji, motyw, rejestr akcji i skróty klawiszowe.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = () => window.TF.UI;
  const F = () => window.TF.Forms;
  const R = () => window.TF.Router;
  const icon = window.TF.icon;

  const App = { _timers: [] };

  /* ============================================================
     MOTYW
     ============================================================ */
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  App.applyTheme = function () {
    const pref = S().settings().theme || 'system';
    const resolved = pref === 'system' ? (mq && mq.matches ? 'dark' : 'light') : pref;
    document.documentElement.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0d1017' : '#6366f1');
    document.querySelectorAll('.theme-switch button, [data-action="setTheme"]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-theme-val') === pref);
    });
  };

  App.setTheme = function (t) {
    S().setSetting({ theme: t });
    App.applyTheme();
    UI().toast('Motyw: ' + ({ light: 'jasny', dark: 'ciemny', system: 'systemowy' })[t], { type: 'ok', duration: 1800 });
  };

  /* ============================================================
     TIMERY WIDOKÓW
     ============================================================ */
  App.setTimer = function (fn, ms) {
    const id = setInterval(fn, ms);
    App._timers.push(id);
    return id;
  };
  App.clearTimers = function () {
    App._timers.forEach(clearInterval);
    App._timers = [];
  };

  /* ============================================================
     EKSPORT / IMPORT
     ============================================================ */
  const COLLECTION_LABELS = {
    students: 'Uczniowie', lessons: 'Zajęcia', payments: 'Płatności', packages: 'Pakiety',
    expenses: 'Wydatki', tasks: 'Zadania', notes: 'Notatki', materials: 'Materiały',
    goals: 'Cele', homework: 'Prace domowe', series: 'Serie lekcji cyklicznych'
  };

  App.backupFileName = function () {
    const d = new Date();
    const stamp = U.today() + '-' + U.pad(d.getHours()) + U.pad(d.getMinutes());
    const who = S().settings().tutorName ? '-' + U.slug(S().settings().tutorName) : '';
    return 'tutorflow-backup' + who + '-' + stamp + '.json';
  };

  App.exportData = function () {
    const json = S().ops.exportJSON();
    const name = App.backupFileName();
    U.download(name, json);
    const c = S().ops.countCollections(S().state);
    UI().toast('Kopia zapasowa pobrana', {
      type: 'ok',
      desc: name + ' · ' + c._total + ' rekordów · ' + Math.max(1, Math.round(json.length / 1024)) + ' kB',
      duration: 6000
    });
  };

  /** Kopiuje całą kopię zapasową do schowka (transfer bez pliku) */
  App.copyBackup = function () {
    const json = S().ops.exportJSON();
    const kb = Math.round(json.length / 1024);
    U.copy(json).then(function () {
      UI().toast('Kopia zapasowa w schowku', {
        type: 'ok', desc: kb + ' kB — wklej ją na drugim urządzeniu w polu „Wklej kopię zapasową”.', duration: 7000
      });
    }, function () {
      UI().toast('Nie udało się skopiować', { type: 'bad', desc: 'Użyj eksportu do pliku.' });
    });
  };

  /* ---------- Import: najpierw podgląd, dopiero potem zapis ---------- */

  function countsTable(incoming, current) {
    const keys = Object.keys(COLLECTION_LABELS).filter(function (k) {
      return incoming[k] > 0 || current[k] > 0;
    });
    if (!keys.length) return '<p class="dim small">Plik nie zawiera żadnych rekordów.</p>';
    return '<div class="table-wrap"><table class="table table--compact">' +
      '<thead><tr><th>Dane</th><th class="num">W pliku</th><th class="num">Masz teraz</th></tr></thead><tbody>' +
      keys.map(function (k) {
        return '<tr><td>' + U.esc(COLLECTION_LABELS[k]) + '</td>' +
          '<td class="num bold">' + incoming[k] + '</td>' +
          '<td class="num dim">' + current[k] + '</td></tr>';
      }).join('') +
      '<tr style="background:var(--surface-2)"><td class="bold">Razem</td>' +
      '<td class="num bold">' + incoming._total + '</td>' +
      '<td class="num dim">' + current._total + '</td></tr>' +
      '</tbody></table></div>';
  }

  App.showImportDialog = function (text, sourceLabel) {
    let info;
    try { info = S().ops.inspectJSON(text); }
    catch (e) {
      UI().toast('Nie udało się odczytać pliku', { type: 'bad', desc: e.message });
      return;
    }

    const current = S().ops.countCollections(S().state);
    const hasData = current._total > 0;
    const when = info.exportedAt ? new Date(info.exportedAt) : null;

    const body =
      '<div class="insight insight--info mb-4"><span class="insight__ico">' + icon('file', 15) + '</span>' +
        '<div class="insight__body"><strong>' + U.esc(sourceLabel || 'Kopia zapasowa') + '</strong>' +
        '<p>' + (info.app ? U.esc(info.app) : 'Nieznane źródło') +
        (when ? ' · wyeksportowano ' + U.fmtDate(U.iso(when), 'long') + ', ' + U.pad(when.getHours()) + ':' + U.pad(when.getMinutes()) : '') +
        (info.tutorName ? ' · ' + U.esc(info.tutorName) : '') + '</p></div></div>' +

      countsTable(info.counts, current) +

      '<form id="importForm" class="mt-5">' +
        '<div class="label mb-2">Co zrobić z obecnymi danymi?</div>' +
        '<label class="check mb-3" style="align-items:flex-start">' +
          '<input type="radio" name="mode" value="replace" checked>' +
          '<span class="check__box">' + icon('check', 12) + '</span>' +
          '<span><b>Zastąp wszystko danymi z pliku</b><br>' +
          '<span class="small dim">Typowy wybór przy przenoszeniu na nowe urządzenie.' +
          (hasData ? ' Obecne ' + current._total + ' rekordów zostanie usuniętych.' : '') + '</span></span>' +
        '</label>' +
        '<label class="check" style="align-items:flex-start">' +
          '<input type="radio" name="mode" value="merge">' +
          '<span class="check__box">' + icon('check', 12) + '</span>' +
          '<span><b>Scal z obecnymi danymi</b><br>' +
          '<span class="small dim">Nic nie znika — rekordy o tym samym identyfikatorze zostaną zaktualizowane, reszta dopisana.</span></span>' +
        '</label>' +

        (info.hasSettings ?
          '<div class="mt-4" style="border-top:1px solid var(--border);padding-top:16px">' +
            '<label class="check"><input type="checkbox" name="withSettings" checked>' +
            '<span class="check__box">' + icon('check', 12) + '</span>' +
            '<span class="small">Przenieś też ustawienia (stawki, godziny pracy, cel, zasady odwołań)</span></label>' +
            '<label class="check mt-3"><input type="checkbox" name="withTheme">' +
            '<span class="check__box">' + icon('check', 12) + '</span>' +
            '<span class="small">Przenieś też motyw jasny/ciemny z drugiego urządzenia</span></label>' +
          '</div>' : '') +
      '</form>' +

      (hasData ? '<div class="insight insight--warn mt-4"><span class="insight__ico">!</span>' +
        '<div class="insight__body small">Zanim potwierdzisz, warto pobrać kopię obecnych danych — importu nie da się cofnąć.</div>' +
        '<button class="btn btn--xs insight__cta" data-action="exportData">Pobierz kopię</button></div>' : '');

    const modal = UI().modal({
      title: 'Import danych',
      subtitle: 'Sprawdź zawartość, zanim cokolwiek zostanie nadpisane',
      size: 'wide',
      body: body,
      noAutofocus: true,
      footer: '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button>' +
        '<button class="btn btn--brand" data-do-import>' + icon('upload', 15) + ' Importuj dane</button>'
    });

    modal.el.querySelector('[data-do-import]').addEventListener('click', function () {
      const v = window.TF.Forms.read(modal.el.querySelector('#importForm'));
      const opts = {
        mode: v.mode || 'replace',
        withSettings: info.hasSettings ? !!v.withSettings : false,
        withTheme: !!v.withTheme
      };
      try {
        const res = S().ops.importJSON(text, opts);
        modal.close();
        App.applyTheme();
        App.refreshChrome();
        R().refresh();
        if (res.mode === 'merge') {
          UI().toast('Dane scalone', {
            type: 'ok', duration: 7000,
            desc: 'Dopisano ' + res.addedTotal + ', zaktualizowano ' + res.updatedTotal + ' rekordów.'
          });
        } else {
          UI().toast('Dane przeniesione', {
            type: 'ok', duration: 7000,
            desc: S().repo('students').all().length + ' uczniów, ' + S().repo('lessons').all().length + ' zajęć, ' +
              S().repo('payments').all().length + ' płatności.'
          });
        }
      } catch (e) {
        UI().toast('Import nie powiódł się', { type: 'bad', desc: e.message });
      }
    });
    return modal;
  };

  App.importData = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', function () {
      const file = input.files[0];
      if (!file) return;
      App.readBackupFile(file);
    });
    input.click();
  };

  App.readBackupFile = function (file) {
    if (file.size > 25 * 1024 * 1024) {
      UI().toast('Plik jest zbyt duży', { type: 'bad', desc: 'Kopia TutorFlow nie powinna przekraczać kilku MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      App.showImportDialog(String(reader.result), file.name);
    };
    reader.onerror = function () {
      UI().toast('Nie udało się odczytać pliku', { type: 'bad' });
    };
    reader.readAsText(file, 'utf-8');
  };

  /** Wklejenie kopii zapasowej jako tekstu — gdy przenoszenie pliku jest niewygodne */
  App.pasteBackup = function () {
    const modal = UI().modal({
      title: 'Wklej kopię zapasową',
      subtitle: 'Przydaje się, gdy przesyłasz dane komunikatorem zamiast plikiem',
      body: '<div class="field"><label>Zawartość pliku JSON</label>' +
        '<textarea class="textarea" id="pasteArea" style="min-height:180px;font-family:monospace;font-size:12px" ' +
        'placeholder=\'{ "_app": "TutorFlow", ... }\' autofocus></textarea>' +
        '<span class="hint">Skopiuj ją na pierwszym urządzeniu przyciskiem „Kopiuj do schowka”.</span></div>',
      footer: '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button>' +
        '<button class="btn btn--brand" data-check>Sprawdź zawartość</button>'
    });
    modal.el.querySelector('[data-check]').addEventListener('click', function () {
      const text = modal.el.querySelector('#pasteArea').value.trim();
      if (!text) { UI().toast('Wklej najpierw zawartość kopii', { type: 'warn' }); return; }
      modal.close();
      setTimeout(function () { App.showImportDialog(text, 'Wklejona kopia zapasowa'); }, 160);
    });
    return modal;
  };

  function toCsv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c === null || c === undefined ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\r\n');
  }
  const dec = function (v) { return String(v === null || v === undefined ? '' : v).replace('.', ','); };

  /** Eksport do arkusza kalkulacyjnego. kind: lessons | students | payments | expenses */
  App.exportCsv = function (kind) {
    const s = S();
    let rows, name;

    if (kind === 'students') {
      rows = [['Imię', 'Nazwisko', 'Przedmiot', 'Poziom', 'Klasa', 'Szkoła', 'Telefon', 'E-mail',
        'Kontakt rodzica', 'Tryb', 'Miejsce', 'Status', 'Od', 'Stawka 60 min',
        'Odbyte lekcje', 'Godziny', 'Wartość', 'Zapłacono', 'Do zapłaty']];
      U.sortBy(s.repo('students').all(), (x) => U.norm(x.lastName + x.firstName)).forEach(function (x) {
        const f = C().studentFinance(x.id);
        rows.push([x.firstName, x.lastName, x.subject, x.level, x.grade, x.school, x.phone, x.email,
          x.parentContact, x.mode === 'online' ? 'online' : 'stacjonarnie', x.location,
          (M.STUDENT_STATUS[x.status] || {}).label, x.startDate, dec(x.rates[60]),
          f.lessonsHeld, dec(U.round(f.hours, 1)), dec(f.billed), dec(f.paid), dec(f.due)]);
      });
      name = 'tutorflow-uczniowie-';
    } else if (kind === 'payments') {
      rows = [['Data', 'Uczeń', 'Kwota', 'Metoda', 'Rozliczone lekcje', 'Opis']];
      U.sortBy(s.repo('payments').all(), (p) => p.date).forEach(function (p) {
        rows.push([p.date, s.studentName(p.studentId), dec(p.amount),
          (M.PAYMENT_METHOD[p.method] || {}).label || p.method,
          (p.lessonIds || []).length, p.note]);
      });
      name = 'tutorflow-platnosci-';
    } else if (kind === 'expenses') {
      rows = [['Data', 'Kategoria', 'Kwota', 'Opis']];
      U.sortBy(s.repo('expenses').all(), (e) => e.date).forEach(function (e) {
        rows.push([e.date, (M.EXPENSE_CATEGORY[e.category] || {}).label || e.category, dec(e.amount), e.description]);
      });
      name = 'tutorflow-wydatki-';
    } else {
      rows = [['Data', 'Godzina', 'Uczeń', 'Przedmiot', 'Temat', 'Czas (min)', 'Cena', 'Tryb', 'Status', 'Płatność', 'Notatka']];
      U.sortBy(s.repo('lessons').all(), (l) => l.date + l.start).forEach(function (l) {
        rows.push([l.date, l.start, s.studentName(l.studentId), l.subject, l.topic,
          l.duration, dec(l.price), l.mode === 'online' ? 'online' : 'stacjonarne',
          (M.LESSON_STATUS[l.status] || {}).label || l.status,
          (M.PAYMENT_STATUS[l.paymentStatus] || {}).label || l.paymentStatus,
          (l.summary && l.summary.done) || l.note || '']);
      });
      name = 'tutorflow-zajecia-';
    }

    U.download(name + U.today() + '.csv', toCsv(rows), 'text/csv;charset=utf-8');
    UI().toast('Eksport CSV gotowy', { type: 'ok', desc: (rows.length - 1) + ' wierszy' });
  };

  App.copyFreeSlots = function () {
    const st = S().settings();
    const slots = C().freeSlots(U.today(), U.addDays(U.today(), 6), st.defaultDuration || 60);
    if (!slots.length) { UI().toast('Brak wolnych terminów w tym tygodniu', { type: 'warn' }); return; }
    const byDay = U.groupBy(slots, (s) => s.date);
    const parts = Object.keys(byDay).sort().map(function (d) {
      return U.DOW_LONG[U.dow(d)] + ' (' + U.fmtDate(d, 'short') + ') ' + byDay[d].map((s) => s.start).join(', ');
    });
    const text = 'W tym tygodniu mam dostępne następujące terminy:\n' + parts.map((p) => '• ' + p).join('\n');
    U.copy(text).then(function () {
      UI().toast('Skopiowano wolne terminy', { type: 'ok', desc: slots.length + ' okien — wklej w wiadomości do ucznia.' });
    });
  };

  /* ============================================================
     MENU KONTEKSTOWE LEKCJI
     ============================================================ */
  function lessonMenu(el, id) {
    const l = S().repo('lessons').byId(id);
    if (!l) return;
    const c = C();
    const items = [];
    items.push({ label: S().studentName(l.studentId) + ' · ' + U.fmtDate(l.date), header: true });
    const series = S().ops.seriesInfo(l.id);
    if (series) items.push({ label: '🔁 ' + series.rhythmLabel + (series.endLabel ? ' · ' + series.endLabel : ''), header: true });

    if (l.status === 'planned') {
      items.push({ label: 'Zakończ lekcję (z notatką)', icon: 'play', onClick: () => F().lessonSummary(l.id) });
      items.push({ label: 'Oznacz jako odbytą', icon: 'check', onClick: () => { S().ops.setStatus(l.id, 'done'); UI().toast('Lekcja oznaczona jako odbyta', { type: 'ok' }); R().refresh(); } });
      items.push({ label: 'Uczeń nie przyszedł', icon: 'ban', onClick: () => { S().ops.setStatus(l.id, 'no_show'); UI().toast('Zapisano nieobecność', { type: 'warn' }); R().refresh(); } });
      items.push({ label: 'Odwołaj / przełóż', icon: 'refresh', onClick: () => F().cancelLesson(l.id) });
      items.push({ label: 'Przenieś na inny termin', icon: 'calendar', onClick: () => F().reschedule(l.id) });
    } else {
      items.push({ label: 'Cofnij do zaplanowanej', icon: 'refresh', onClick: () => { S().ops.setStatus(l.id, 'planned'); R().refresh(); } });
      items.push({ label: l.summary ? 'Edytuj notatkę z lekcji' : 'Dodaj notatkę z lekcji', icon: 'note', onClick: () => F().lessonSummary(l.id) });
    }

    if (c.isBillable(l) && l.paymentStatus === 'unpaid') {
      items.push({ sep: true });
      items.push({ label: 'Oznacz jako opłaconą', icon: 'wallet', onClick: () => { S().ops.payLesson(l.id, 'cash'); UI().toast('Zapisano płatność', { type: 'ok', desc: U.money(l.price) }); R().refresh(); } });
    } else if (l.paymentStatus === 'paid') {
      items.push({ sep: true });
      items.push({ label: 'Cofnij oznaczenie płatności', icon: 'refresh', onClick: () => { S().ops.setPaymentStatus(l.id, 'unpaid'); R().refresh(); } });
    }

    items.push({ sep: true });
    items.push({ label: 'Profil ucznia', icon: 'user', onClick: () => R().go('#/students/' + l.studentId) });
    items.push({ label: series ? 'Edytuj zajęcia / serię' : 'Edytuj zajęcia', icon: 'edit', onClick: () => F().lesson({ id: l.id }) });
    items.push({ label: '📄 Kopiuj zajęcia', onClick: () => F().copyLesson(l.id) });
    // lekcja z serii: okno zapyta „Tylko ta lekcja / Ta i następne / Wszystkie w serii”
    items.push({ label: series ? 'Usuń zajęcia / serię…' : 'Usuń zajęcia', icon: 'trash', danger: true, onClick: () => F().deleteLesson(l.id) });

    UI().menu(el, items);
  }

  function studentMenu(el, id) {
    const s = S().student(id);
    if (!s) return;
    UI().menu(el, [
      { label: S().studentName(id), header: true },
      { label: 'Otwórz profil', icon: 'user', onClick: () => R().go('#/students/' + id) },
      { label: 'Zaplanuj lekcję', icon: 'calendar', onClick: () => F().lesson({ studentId: id }) },
      { label: 'Dodaj płatność', icon: 'wallet', onClick: () => F().payment({ studentId: id }) },
      { label: 'Dodaj notatkę', icon: 'note', onClick: () => F().note({ studentId: id }) },
      { sep: true },
      { label: 'Edytuj dane', icon: 'edit', onClick: () => F().student(id) },
      { label: '📄 Kopiuj ucznia (np. rodzeństwo)', onClick: () => F().copyStudent(id) },
      { label: 'Usuń ucznia', icon: 'trash', danger: true, onClick: () => deleteStudent(id) }
    ]);
  }

  function deleteStudent(id) {
    const s = S().student(id);
    if (!s) return;
    const lessons = S().lessonsOf(id).length;
    UI().confirm({
      title: 'Czy na pewno chcesz usunąć tego ucznia?',
      text: S().studentName(id) + ' zostanie usunięty wraz z całą historią.',
      warning: 'Usuniemy również ' + U.lessonsLabel(lessons) + ', płatności, notatki, cele i materiały tego ucznia. Tej operacji nie można cofnąć.',
      confirmLabel: 'Usuń ucznia'
    }).then(function (ok) {
      if (!ok) return;
      S().ops.deleteStudent(id);
      UI().toast('Uczeń usunięty', { type: 'ok', desc: S().studentName(id) });
      R().go('#/students');
    });
  }

  /* ============================================================
     REJESTR AKCJI
     ============================================================ */
  function registerActions() {
    const ui = UI();

    ui.action('go', (el) => R().go(el.getAttribute('data-route')));
    ui.action('reload', () => R().refresh());
    ui.action('openSidebar', () => document.getElementById('app').classList.add('is-sidebar-open'));
    ui.action('closeSidebar', () => document.getElementById('app').classList.remove('is-sidebar-open'));
    ui.action('setTheme', (el) => App.setTheme(el.getAttribute('data-theme-val')));
    ui.action('openPalette', () => window.TF.Palette.show());
    ui.action('closePalette', () => window.TF.Palette.hide());
    ui.action('openQuickAdd', (el) => F().quickAdd(window.innerWidth > 760 ? el : null));

    /* --- formularze --- */
    ui.action('addLesson', (el) => F().lesson({
      date: el.getAttribute('data-date') || undefined,
      start: el.getAttribute('data-start') || undefined,
      studentId: el.getAttribute('data-student') || undefined
    }));
    ui.action('addStudent', () => F().student());
    ui.action('editStudent', (el) => F().student(el.getAttribute('data-id')));
    ui.action('copyStudent', (el) => F().copyStudent(el.getAttribute('data-id')));
    ui.action('copyLesson', (el) => F().copyLesson(el.getAttribute('data-id')));
    ui.action('deleteStudent', (el) => deleteStudent(el.getAttribute('data-id')));
    ui.action('studentMenu', (el) => studentMenu(el, el.getAttribute('data-id')));
    ui.action('addPayment', (el) => F().payment({ studentId: el.getAttribute('data-student') || undefined }));
    ui.action('addPackage', (el) => F().package({ studentId: el.getAttribute('data-student') || undefined }));
    ui.action('addExpense', () => F().expense());
    ui.action('editExpense', (el) => F().expense(el.getAttribute('data-id')));
    ui.action('addTask', () => F().task());
    ui.action('editTask', (el) => F().task(el.getAttribute('data-id')));
    ui.action('addNote', (el) => F().note({ studentId: el.getAttribute('data-student') || null }));
    ui.action('editNote', (el) => F().note(null, el.getAttribute('data-id')));
    ui.action('addMaterial', (el) => F().material({ studentId: el.getAttribute('data-student') || null }));
    ui.action('editMaterial', (el) => F().material(null, el.getAttribute('data-id')));
    ui.action('addGoal', (el) => F().goal(el.getAttribute('data-student')));
    ui.action('editGoal', (el) => {
      const g = S().repo('goals').byId(el.getAttribute('data-id'));
      F().goal(g && g.studentId, el.getAttribute('data-id'));
    });
    ui.action('addHomework', (el) => F().homework(el.getAttribute('data-student') || null));
    ui.action('editHomework', (el) => {
      const h = S().repo('homework').byId(el.getAttribute('data-id'));
      F().homework(h && h.studentId, el.getAttribute('data-id'));
    });

    /* --- lekcje --- */
    ui.action('lessonMenu', (el) => lessonMenu(el, el.getAttribute('data-id')));
    ui.action('lessonMenuRow', (el) => lessonMenu(el, el.getAttribute('data-id')));
    ui.action('lessonDone', (el) => {
      const id = el.getAttribute('data-id');
      S().ops.setStatus(id, 'done');
      const l = S().repo('lessons').byId(id);
      ui.toast('Lekcja odbyta', {
        type: 'ok', desc: S().studentName(l.studentId) + ' · ' + U.money(l.price),
        actionLabel: 'Dodaj notatkę', onAction: () => F().lessonSummary(id)
      });
      R().refresh();
    });
    ui.action('lessonCancel', (el) => F().cancelLesson(el.getAttribute('data-id')));
    ui.action('lessonSummary', (el) => F().lessonSummary(el.getAttribute('data-id')));
    ui.action('lessonPay', (el) => {
      const id = el.getAttribute('data-id');
      const l = S().repo('lessons').byId(id);
      S().ops.payLesson(id, 'cash');
      ui.toast('Zapisano płatność', { type: 'ok', desc: U.money(l.price) + ' · ' + S().studentName(l.studentId) });
      R().refresh();
    });
    ui.action('deletePayment', (el) => {
      const id = el.getAttribute('data-id');
      const p = S().repo('payments').byId(id);
      if (!p) return;
      ui.confirm({
        title: 'Usunąć tę płatność?',
        text: U.money(p.amount) + ' · ' + S().studentName(p.studentId) + ' · ' + U.fmtDate(p.date),
        warning: p.lessonIds.length ? 'Powiązane zajęcia (' + p.lessonIds.length + ') wrócą do statusu „do zapłaty”.' : '',
        confirmLabel: 'Usuń płatność'
      }).then(function (ok) {
        if (!ok) return;
        S().ops.deletePayment(id);
        ui.toast('Płatność usunięta', { type: 'ok' });
        R().refresh();
      });
    });

    /* --- zadania i prace domowe --- */
    ui.change('toggleTask', (el) => {
      const id = el.getAttribute('data-id');
      const t = S().repo('tasks').byId(id);
      S().repo('tasks').update(id, { done: el.checked, doneAt: el.checked ? U.today() : null });
      if (el.checked) ui.toast('Zrobione: ' + t.title, { type: 'ok', duration: 2200 });
      R().refresh();
    });
    ui.action('hwDone', (el) => { S().repo('homework').update(el.getAttribute('data-id'), { status: 'done' }); ui.toast('Praca domowa: wykonana', { type: 'ok' }); R().refresh(); });
    ui.action('hwNotDone', (el) => { S().repo('homework').update(el.getAttribute('data-id'), { status: 'not_done' }); ui.toast('Praca domowa: niewykonana', { type: 'warn' }); R().refresh(); });

    /* --- filtry widoków --- */
    ui.action('studentsFilter', (el) => { window.TF.Views.students.setFilter(el.getAttribute('data-filter')); R().refresh(); });
    ui.action('studentsView', (el) => { window.TF.Views.students.setView(el.getAttribute('data-view')); R().refresh(); });
    ui.action('lessonsFilter', (el) => { window.TF.Views.lessons.setFilter(el.getAttribute('data-filter')); R().refresh(); });
    ui.action('expenseCat', (el) => { window.TF.Views.expenses.setCategory(el.getAttribute('data-cat')); R().refresh(); });
    ui.action('materialType', (el) => { window.TF.Views.materials.setType(el.getAttribute('data-type')); R().refresh(); });
    ui.action('noteKind', (el) => { window.TF.Views.notes.setKind(el.getAttribute('data-kind')); R().refresh(); });
    ui.action('tasksFilter', (el) => { window.TF.Views.tasks.setFilter(el.getAttribute('data-filter')); R().refresh(); });
    ui.action('paymentsTab', (el) => { window.TF.Views.payments.setTab(el.getAttribute('data-tab')); R().refresh(); });
    ui.action('financeRange', (el) => { window.TF.Views.finance.setRange(Number(el.getAttribute('data-range'))); R().refresh(); });
    ui.action('setPriceDelta', (el) => { window.TF.Views.forecast.setPriceDelta(Number(el.getAttribute('data-delta'))); R().refresh(); });

    /* --- kalendarz --- */
    ui.action('calPrev', () => { window.TF.Views.calendar.shift(-1); R().refresh(); });
    ui.action('calNext', () => { window.TF.Views.calendar.shift(1); R().refresh(); });
    ui.action('calToday', () => { window.TF.Views.calendar.goToday(); R().refresh(); });
    ui.action('calMode', (el) => { window.TF.Views.calendar.setMode(el.getAttribute('data-mode')); R().refresh(); });
    ui.action('calOpen', (el) => {
      const cal = window.TF.Views.calendar;
      cal.setDate(el.getAttribute('data-date') || U.today());
      if (el.getAttribute('data-mode')) cal.state.mode = el.getAttribute('data-mode');   // bez zmiany domyślnego widoku
      R().go('#/calendar');
    });
    ui.action('calDay', (el) => {
      window.TF.Views.calendar.setDate(el.getAttribute('data-date'));
      window.TF.Views.calendar.setMode('day');
      R().refresh();
    });

    /* --- wydruki --- */
    ui.action('printWeek', () => window.TF.Views.print.print('week'));
    ui.action('printCards', () => window.TF.Views.print.print('cards'));
    ui.action('printThisWeek', function () {
      window.TF.Views.print.state.weekStart = U.startOfWeek(U.today());
      R().refresh();
    });
    ui.action('printNextWeek', function () {
      window.TF.Views.print.state.weekStart = U.addDays(U.startOfWeek(U.today()), 7);
      R().refresh();
    });

    /* --- raporty --- */
    ui.action('reportMonth', (el) => { window.TF.Views.reports.setMonth(el.getAttribute('data-month')); R().refresh(); });
    ui.action('printReport', () => window.print());
    ui.action('exportReportCsv', () => {
      const mk = window.TF.Views.reports.currentMonth();
      const rows = [['Data', 'Uczeń', 'Temat', 'Czas', 'Cena', 'Status', 'Płatność']];
      U.sortBy(C().lessonsInMonth(mk), (l) => l.date + l.start).forEach((l) => rows.push([
        l.date + ' ' + l.start, S().studentName(l.studentId), l.topic || l.subject || '',
        l.duration, String(l.price).replace('.', ','),
        (M.LESSON_STATUS[l.status] || {}).label, (M.PAYMENT_STATUS[l.paymentStatus] || {}).label
      ]));
      const csv = '﻿' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\n');
      U.download('tutorflow-raport-' + mk + '.csv', csv, 'text/csv;charset=utf-8');
      ui.toast('Raport CSV pobrany', { type: 'ok' });
    });
    ui.action('exportReportTxt', () => {
      const mk = window.TF.Views.reports.currentMonth();
      const s = C().monthSummary(mk);
      const txt = [
        'RAPORT — ' + U.monthLabel(mk),
        '',
        'Lekcje: ' + s.lessons,
        'Godziny: ' + U.num(s.hours, 1) + ' h',
        'Przychód: ' + U.money(s.revenue),
        'Koszty: ' + U.money(s.expenses),
        'Zysk: ' + U.money(s.profit),
        'Odwołane lekcje: ' + s.cancelled,
        'Nowi uczniowie: ' + s.newStudents,
        'Średnia stawka: ' + U.money(s.avgRate),
        'Frekwencja: ' + U.pctLabel(s.attendance, 1),
        'Wykorzystanie grafiku: ' + U.pctLabel(s.utilization, 1)
      ].join('\n');
      U.copy(txt).then(() => ui.toast('Raport skopiowany do schowka', { type: 'ok' }));
    });

    /* --- ustawienia --- */
    ui.action('saveProfile', () => {
      const f = document.getElementById('profileForm');
      const v = F().read(f);
      S().setSetting({
        tutorName: v.tutorName, subject: v.subject, tutorEmail: v.tutorEmail,
        tutorPhone: v.tutorPhone, appName: v.appName || 'TutorFlow', appTagline: v.appTagline
      });
      App.refreshChrome();
      ui.toast('Dane zapisane', { type: 'ok' });
      R().refresh();
    });
    ui.action('saveDefaults', () => {
      const v = F().read(document.getElementById('defaultsForm'));
      S().setSetting({
        currency: v.currency, defaultPrice: Number(v.defaultPrice) || 80,
        defaultDuration: Number(v.defaultDuration) || 60, defaultMode: v.defaultMode,
        dateFormat: v.dateFormat, timeFormat: v.timeFormat,
        monthlyGoal: Number(v.monthlyGoal) || 0, remindLessonMin: Number(v.remindLessonMin) || 30
      });
      ui.toast('Ustawienia zapisane', { type: 'ok' });
      R().refresh();
    });
    ui.action('saveWorkHours', () => {
      const wh = document.getElementById('workHours');
      const days = [], byDay = {};
      U.DOW_LONG.forEach(function (n, i) {
        if (!wh.querySelector('[data-day-on="' + i + '"]').checked) return;
        days.push(i);
        byDay[i] = {
          start: wh.querySelector('[data-day-start="' + i + '"]').value || '14:00',
          end: wh.querySelector('[data-day-end="' + i + '"]').value || '20:00'
        };
      });
      const first = days.length ? byDay[days[0]] : { start: '14:00', end: '20:00' };
      S().setSetting({ workDays: days, workHoursByDay: byDay, workHours: first });
      ui.toast('Grafik zapisany', { type: 'ok', desc: days.length + ' ' + U.plural(days.length, 'dzień pracy', 'dni pracy', 'dni pracy') });
      R().refresh();
    });
    ui.action('savePolicy', () => {
      const v = F().read(document.getElementById('policyForm'));
      S().setSetting({
        cancellationPolicy: {
          hours: Number(v.hours) || 24, chargeable: !!v.chargeable, noShowChargeable: !!v.noShowChargeable
        }
      });
      ui.toast('Zasady zapisane', { type: 'ok' });
      R().refresh();
    });
    /* --- aplikacja / PWA --- */
    ui.action('installApp', function () {
      window.TF.PWA.install().then(function (outcome) {
        if (outcome === 'unavailable') {
          ui.toast('Instalacja niedostępna', {
            type: 'warn',
            desc: 'Ta przeglądarka nie zgłosiła możliwości instalacji. Spróbuj z paska adresu.'
          });
        } else if (outcome === 'dismissed') {
          ui.toast('Instalacja anulowana', { type: 'info', duration: 2400 });
        }
        R().refresh();
      });
    });
    ui.action('applyUpdate', () => window.TF.PWA.applyUpdate());
    ui.action('checkUpdate', function () {
      ui.toast('Sprawdzam aktualizacje…', { type: 'info', duration: 2000 });
      window.TF.PWA.checkForUpdate().then(function (has) {
        if (!has) ui.toast('Masz najnowszą wersję', { type: 'ok', duration: 2600 });
        R().refresh();
      });
    });

    ui.action('exportData', () => App.exportData());
    ui.action('importData', () => App.importData());
    ui.action('copyBackup', () => App.copyBackup());
    ui.action('pasteBackup', () => App.pasteBackup());
    ui.action('exportCsv', (el) => App.exportCsv(el.getAttribute('data-kind')));
    ui.action('copyFreeSlots', () => App.copyFreeSlots());
    ui.action('loadDemo', () => {
      ui.confirm({
        title: 'Wczytać dane demonstracyjne?',
        text: 'Zastąpią obecne dane przykładowymi uczniami, zajęciami i płatnościami.',
        warning: S().repo('students').all().length ? 'Twoje obecne dane zostaną nadpisane.' : '',
        confirmLabel: 'Wczytaj', danger: S().repo('students').all().length > 0
      }).then(function (ok) {
        if (!ok) return;
        window.TF.Seed.load(true);
        ui.toast('Dane demonstracyjne wczytane', { type: 'ok' });
        R().refresh();
      });
    });
    ui.action('clearDemo', () => {
      ui.confirm({
        title: 'Usunąć dane demonstracyjne?',
        text: 'Wyczyścimy wszystkich uczniów, zajęcia i płatności. Twoje ustawienia zostaną zachowane.',
        confirmLabel: 'Usuń dane demo'
      }).then(function (ok) {
        if (!ok) return;
        window.TF.Seed.clear();
        ui.toast('Dane demonstracyjne usunięte', { type: 'ok', desc: 'Możesz zacząć od zera.' });
        R().refresh();
      });
    });
    ui.action('resetAll', () => {
      ui.confirm({
        title: 'Usunąć wszystkie dane?',
        text: 'Aplikacja wróci do stanu początkowego — łącznie z ustawieniami.',
        warning: 'Tej operacji nie można cofnąć. Wykonaj najpierw eksport kopii zapasowej.',
        confirmLabel: 'Usuń wszystko'
      }).then(function (ok) {
        if (!ok) return;
        S().reset();
        location.hash = '#/dashboard';
        location.reload();
      });
    });
  }

  /* ============================================================
     UPUSZCZENIE KOPII W DOWOLNYM MIEJSCU APLIKACJI
     (przeciąganie lekcji w kalendarzu nie niesie plików,
      więc nie kolidują ze sobą)
     ============================================================ */
  function bindGlobalDrop() {
    function hasFiles(e) {
      const dt = e.dataTransfer;
      if (!dt) return false;
      if (dt.files && dt.files.length) return true;
      return dt.types && Array.prototype.indexOf.call(dt.types, 'Files') !== -1;
    }
    window.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.target.closest && e.target.closest('#importDrop')) return; // obsłużone lokalnie
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
        UI().toast('Nieobsługiwany plik', { type: 'warn', desc: 'Upuść kopię zapasową TutorFlow w formacie .json' });
        return;
      }
      App.readBackupFile(file);
    });
  }

  /* ============================================================
     SKRÓTY KLAWISZOWE
     ============================================================ */
  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      const inField = !!(e.target && e.target.matches && e.target.matches('input, textarea, select, [contenteditable]'));

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.TF.Palette.open ? window.TF.Palette.hide() : window.TF.Palette.show();
        return;
      }
      if (e.key === 'Escape') {
        if (window.TF.Palette.open) { window.TF.Palette.hide(); return; }
        if (UI().hasModal()) { UI().closeTopModal(); return; }
        if (UI().hasSheet()) { UI().closeSheet(); return; }
        UI().closeMenu();
        document.getElementById('app').classList.remove('is-sidebar-open');
        return;
      }
      if (inField || UI().hasModal() || window.TF.Palette.open) return;

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); F().lesson({}); }
      else if (e.key === 'u' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); F().student(); }
      else if (e.key === 'p' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); F().payment(); }
      else if (e.key === 't' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); R().go('#/today'); }
      else if (e.key === '/' ) { e.preventDefault(); window.TF.Palette.show(); }
    });
  }

  /* ============================================================
     CHROME (marka, użytkownik, odznaki)
     ============================================================ */
  App.refreshChrome = function () {
    const st = S().settings();
    const name = st.tutorName || 'Korepetytor';
    document.getElementById('brandName').textContent = st.appName || 'TutorFlow';
    document.getElementById('brandTagline').textContent = (st.appTagline || '').split('.')[0] || 'Twoje korepetycje';
    document.getElementById('userName').textContent = name;
    document.getElementById('userSub').textContent = st.subject ? st.subject + ' · Ustawienia' : 'Ustawienia';
    const av = document.getElementById('userAvatar');
    av.textContent = (name.charAt(0) || '?').toUpperCase();
    av.style.background = U.gradientFor(name);
  };

  /* ============================================================
     START
     ============================================================ */
  App.afterBoot = function () {
    App.refreshChrome();
    App.applyTheme();
    R().start();

    S().on('change', function () {
      try { R().renderNav(); } catch (e) {}
    });

    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function () {
        if ((S().settings().theme || 'system') === 'system') App.applyTheme();
      });
    }

    // odświeżenie statusów co minutę (odliczanie, „trwa teraz”)
    setInterval(function () {
      const v = R().current;
      if (v === 'today' || v === 'dashboard') R().refresh();
      else { try { R().renderNav(); } catch (e) {} }
    }, 60000);

    setTimeout(function () {
      const boot = document.getElementById('boot');
      if (!boot) return;
      boot.classList.add('is-gone');
      setTimeout(function () { if (boot.parentNode) boot.remove(); }, 400);
    }, 260);
  };

  App.start = function () {
    // Sowie Fiszki: dane na koncie (korepetycje-cloud.js); bez niego — jak dawniej, w przeglądarce
    S().useAdapter((window.TF.Cloud && window.TF.Cloud.adapter) || window.TF.Adapters.createDefaultAdapter());
    S().init();
    // lekcje cykliczne „bez końca”: zawsze zaplanowane ~12 miesięcy do przodu
    try { S().ops.extendSeries(); } catch (e) { console.error('[TutorFlow] extendSeries', e); }

    UI().bind();
    window.TF.Charts.bind();
    window.TF.Palette.bind();
    registerActions();
    bindKeys();
    bindGlobalDrop();
    App.applyTheme();
    if (window.TF.PWA) window.TF.PWA.init();

    if (!S().settings().onboarded) {
      document.getElementById('boot').classList.add('is-gone');
      setTimeout(function () {
        const b = document.getElementById('boot');
        if (b) b.remove();
        window.TF.Onboarding.start();
      }, 320);
      return;
    }

    document.getElementById('app').hidden = false;
    App.afterBoot();
  };

  window.TF.App = App;

  // Sowie Fiszki: najpierw logowanie, uprawnienia i dane z konta (TF.Cloud.boot), potem start
  const startNow = function () { if (window.TF.Cloud) window.TF.Cloud.boot(App.start); else App.start(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startNow);
  else startNow();
})();
