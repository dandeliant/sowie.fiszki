/* ============================================================
   TutorFlow — views/settings.js
   Ustawienia korepetytora, grafiku, zasad i danych.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const icon = window.TF.icon;

  function field(label, inner, hint) {
    return '<div class="field"><label>' + U.esc(label) + '</label>' + inner +
      (hint ? '<span class="hint">' + U.esc(hint) + '</span>' : '') + '</div>';
  }

  function profileCard(st) {
    return UI.card('Dane korepetytora',
      '<form id="profileForm" class="form-grid">' +
        field('Imię i nazwisko', '<input class="input" name="tutorName" value="' + U.esc(st.tutorName) + '" placeholder="Jak Cię witać?">') +
        field('Główny przedmiot', '<input class="input" name="subject" value="' + U.esc(st.subject) + '">') +
        field('E-mail', '<input class="input" type="email" name="tutorEmail" value="' + U.esc(st.tutorEmail) + '">') +
        field('Telefon', '<input class="input" name="tutorPhone" value="' + U.esc(st.tutorPhone) + '">') +
        field('Nazwa aplikacji', '<input class="input" name="appName" value="' + U.esc(st.appName) + '">', 'Możesz zmienić na własną markę') +
        field('Podtytuł', '<input class="input" name="appTagline" value="' + U.esc(st.appTagline) + '">') +
      '</form>' +
      '<button class="btn btn--brand mt-4" data-action="saveProfile">Zapisz dane</button>');
  }

  function defaultsCard(st) {
    return UI.card('Domyślne wartości',
      '<form id="defaultsForm" class="form-grid">' +
        field('Waluta',
          '<select class="select" name="currency">' +
            ['PLN', 'EUR', 'USD', 'GBP'].map((c) => '<option value="' + c + '"' + (st.currency === c ? ' selected' : '') + '>' + c + '</option>').join('') +
          '</select>') +
        field('Domyślna cena lekcji', '<div class="input-suffix"><input class="input" type="number" name="defaultPrice" min="0" step="5" value="' +
          st.defaultPrice + '"><span>' + U.curSymbol() + '</span></div>') +
        field('Domyślny czas lekcji',
          '<select class="select" name="defaultDuration">' +
            M.DURATIONS.map((d) => '<option value="' + d + '"' + (st.defaultDuration === d ? ' selected' : '') + '>' + d + ' min</option>').join('') +
          '</select>') +
        field('Domyślny tryb',
          '<select class="select" name="defaultMode">' +
            '<option value="onsite"' + (st.defaultMode === 'onsite' ? ' selected' : '') + '>Stacjonarnie</option>' +
            '<option value="online"' + (st.defaultMode === 'online' ? ' selected' : '') + '>Online</option></select>') +
        field('Format daty',
          '<select class="select" name="dateFormat">' +
            '<option value="dd.mm.yyyy"' + (st.dateFormat === 'dd.mm.yyyy' ? ' selected' : '') + '>31.12.2026</option>' +
            '<option value="yyyy-mm-dd"' + (st.dateFormat === 'yyyy-mm-dd' ? ' selected' : '') + '>2026-12-31</option>' +
            '<option value="dd/mm/yyyy"' + (st.dateFormat === 'dd/mm/yyyy' ? ' selected' : '') + '>31/12/2026</option></select>') +
        field('Format godziny',
          '<select class="select" name="timeFormat">' +
            '<option value="24"' + (st.timeFormat === '24' ? ' selected' : '') + '>24-godzinny (17:00)</option>' +
            '<option value="12"' + (st.timeFormat === '12' ? ' selected' : '') + '>12-godzinny (5:00 PM)</option></select>') +
        field('Cel miesięczny', '<div class="input-suffix"><input class="input" type="number" name="monthlyGoal" min="0" step="500" value="' +
          st.monthlyGoal + '"><span>' + U.curSymbol() + '</span></div>', 'Używany na Dashboardzie i w prognozach') +
        field('Przypomnienie przed lekcją', '<div class="input-suffix"><input class="input" type="number" name="remindLessonMin" min="5" max="180" step="5" value="' +
          st.remindLessonMin + '"><span>min</span></div>') +
      '</form>' +
      '<button class="btn btn--brand mt-4" data-action="saveDefaults">Zapisz ustawienia</button>');
  }

  function workHoursCard(st) {
    const rows = U.DOW_LONG.map(function (name, i) {
      const on = (st.workDays || []).indexOf(i) !== -1;
      const wh = (st.workHoursByDay || {})[i] || st.workHours;
      return '<div class="row gap-3 mb-3 wrap" data-day-row="' + i + '">' +
        '<label class="switch" style="min-width:150px"><input type="checkbox" data-day-on="' + i + '"' + (on ? ' checked' : '') + '>' +
        '<span class="switch__track"></span><span>' + U.cap(name) + '</span></label>' +
        '<input class="input input--sm" type="time" step="900" data-day-start="' + i + '" value="' + wh.start + '" style="width:110px"' + (on ? '' : ' disabled') + '>' +
        '<span class="dim">–</span>' +
        '<input class="input input--sm" type="time" step="900" data-day-end="' + i + '" value="' + wh.end + '" style="width:110px"' + (on ? '' : ' disabled') + '>' +
        '<span class="tiny dim" data-day-sum="' + i + '">' + (on ? U.num((U.toMin(wh.end) - U.toMin(wh.start)) / 60, 1) + ' h' : 'wolne') + '</span>' +
        '</div>';
    }).join('');

    const cap = C().capacityBetween(U.startOfWeek(U.today()), U.endOfWeek(U.today())) / 60;
    return UI.card('Godziny pracy',
      '<div id="workHours">' + rows + '</div>' +
      '<div class="insight insight--info mt-4"><span class="insight__ico">' + icon('clock', 15) + '</span>' +
        '<div class="insight__body small">Tygodniowa dostępność: <b>' + U.num(cap, 1) + ' h</b>. ' +
        'Kalendarz zaznaczy godziny pracy, a statystyki policzą wykorzystanie grafiku.</div></div>' +
      '<button class="btn btn--brand mt-4" data-action="saveWorkHours">Zapisz grafik</button>',
      { subtitle: 'Wpływa na kalendarz, wolne terminy i wykorzystanie czasu' });
  }

  function policyCard(st) {
    const pol = st.cancellationPolicy || {};
    return UI.card('Zasady odwoływania zajęć',
      '<form id="policyForm">' +
        field('Płatne, jeśli odwołane później niż',
          '<div class="input-suffix"><input class="input" type="number" name="hours" min="0" max="168" step="1" value="' + (pol.hours || 24) + '"><span>godz. przed</span></div>') +
        '<div class="mt-4"><label class="switch"><input type="checkbox" name="chargeable"' + (pol.chargeable ? ' checked' : '') + '>' +
          '<span class="switch__track"></span><span>Naliczaj opłatę za późne odwołania</span></label></div>' +
        '<div class="mt-3"><label class="switch"><input type="checkbox" name="noShowChargeable"' + (pol.noShowChargeable !== false ? ' checked' : '') + '>' +
          '<span class="switch__track"></span><span>Nieobecność bez zgłoszenia jest płatna</span></label></div>' +
      '</form>' +
      '<p class="tiny dim mt-4">Przy odwoływaniu zajęć TutorFlow sam podpowie, czy naliczyć opłatę — decyzję zawsze możesz zmienić.</p>' +
      '<button class="btn btn--brand mt-4" data-action="savePolicy">Zapisz zasady</button>');
  }

  function appearanceCard(st) {
    const themes = [['light', 'Jasny', '☀'], ['system', 'Systemowy', '◐'], ['dark', 'Ciemny', '☾']];
    return UI.card('Wygląd',
      '<div class="label mb-2">Motyw</div>' +
      '<div class="segmented" style="width:100%">' + themes.map((t) =>
        '<button class="' + (st.theme === t[0] ? 'is-active' : '') + '" data-action="setTheme" data-theme-val="' + t[0] + '" style="flex:1">' +
        t[2] + ' ' + t[1] + '</button>').join('') + '</div>' +
      '<p class="tiny dim mt-3">Wybór zapisuje się automatycznie i zostaje po odświeżeniu strony.</p>');
  }

  const COLLECTION_LABELS = {
    students: 'Uczniowie', lessons: 'Zajęcia', payments: 'Płatności', packages: 'Pakiety',
    expenses: 'Wydatki', tasks: 'Zadania', notes: 'Notatki', materials: 'Materiały',
    goals: 'Cele', homework: 'Prace domowe'
  };

  /* formy odmiany: [1, 2–4, 5+] */
  const COLLECTION_PLURALS = {
    students: ['uczeń', 'uczniów', 'uczniów'],
    lessons: ['zajęcia', 'zajęć', 'zajęć'],
    payments: ['płatność', 'płatności', 'płatności'],
    packages: ['pakiet', 'pakiety', 'pakietów'],
    expenses: ['wydatek', 'wydatki', 'wydatków'],
    tasks: ['zadanie', 'zadania', 'zadań'],
    notes: ['notatka', 'notatki', 'notatek'],
    materials: ['materiał', 'materiały', 'materiałów'],
    goals: ['cel', 'cele', 'celów'],
    homework: ['praca domowa', 'prace domowe', 'prac domowych']
  };
  function countPhrase(key, n) {
    const f = COLLECTION_PLURALS[key];
    return n + ' ' + (f ? U.plural(n, f[0], f[1], f[2]) : key);
  }

  /* ---------- Przeniesienie danych na inne urządzenie ---------- */
  function transferCard() {
    const counts = S().ops.countCollections(S().state);
    const sizeKb = S().adapter.info ? S().adapter.info().sizeKb : 0;

    return UI.card('Kopia zapasowa i przeniesienie danych',
      '<p class="muted small">Dane zapisują się automatycznie na Twoim koncie Sowie Fiszki — po zalogowaniu na innym ' +
      'komputerze czy telefonie od razu je zobaczysz. Kopia zapasowa (jeden plik) przyda się do archiwum albo do przeniesienia ' +
      'danych z wcześniejszej wersji TutorFlow, która trzymała je tylko w przeglądarce.</p>' +

      '<ol class="steps mt-4">' +
        '<li><span>Na <b>tym</b> urządzeniu pobierz kopię zapasową — jeden plik <code>.json</code> ' +
          'z wszystkimi uczniami, zajęciami, płatnościami, notatkami i ustawieniami.</span></li>' +
        '<li><span>Przenieś plik na drugie urządzenie: e-mailem, przez chmurę, komunikator albo pendrive.</span></li>' +
        '<li><span>Tutaj, w <b>Ustawieniach</b>, wczytaj plik. Zobaczysz podgląd zawartości, zanim cokolwiek ' +
          'zostanie nadpisane — po wczytaniu dane trafią na Twoje konto.</span></li>' +
      '</ol>' +

      '<div class="transfer-box mt-5">' +
        '<div class="transfer-box__label">' + icon('download', 15) + ' Krok 1 — pobierz z tego urządzenia</div>' +
        '<button class="btn btn--brand btn--block" data-action="exportData"' + (counts._total ? '' : ' disabled') + '>' +
          icon('download', 16) + ' Pobierz kopię zapasową' + (counts._total ? ' (' + counts._total + ' rekordów)' : '') + '</button>' +
        '<button class="btn btn--sm btn--block mt-2" data-action="copyBackup"' + (counts._total ? '' : ' disabled') + '>' +
          icon('copy', 14) + ' Kopiuj do schowka zamiast pliku</button>' +
        '<p class="tiny dim mt-2">' +
          (counts._total
            ? 'Plik zawiera ' + Object.keys(COLLECTION_LABELS)
                .filter((k) => counts[k] > 0)
                .map((k) => countPhrase(k, counts[k])).join(', ') +
              ' oraz Twoje ustawienia. Rozmiar około ' + U.num(Math.max(1, Math.round(sizeKb)), 0) + ' kB.'
            : 'Nie masz jeszcze żadnych danych do przeniesienia. Dodaj ucznia albo wczytaj kopię z drugiego urządzenia poniżej.') +
        '</p>' +
      '</div>' +

      '<div class="transfer-box mt-4">' +
        '<div class="transfer-box__label">' + icon('upload', 15) + ' Krok 3 — wczytaj na drugim urządzeniu</div>' +
        '<div class="dropzone" id="importDrop" tabindex="0" role="button">' +
          icon('upload', 22) +
          '<div class="bold mt-2">Przeciągnij tu plik kopii zapasowej</div>' +
          '<div class="tiny">albo kliknij, żeby wybrać z dysku</div>' +
        '</div>' +
        '<button class="btn btn--sm btn--block mt-2" data-action="pasteBackup">' +
          icon('note', 14) + ' Wklej kopię jako tekst</button>' +
      '</div>' +

      '<div class="insight insight--info mt-4"><span class="insight__ico">' + icon('info', 15) + '</span>' +
        '<div class="insight__body small">Import pokaże najpierw, co jest w pliku, i pozwoli wybrać: ' +
        '<b>zastąpić</b> obecne dane albo <b>scalić</b> je z tym, co już masz.</div></div>',
      { subtitle: 'Komplet danych w jednym pliku' });
  }

  function dataCard(st) {
    const info = S().adapter.info ? S().adapter.info() : { name: '—', sizeKb: 0 };
    const counts = S().COLLECTIONS.map((c) => ({ c: c, n: S().state[c].length }));
    const labels = COLLECTION_LABELS;
    return UI.card('Twoje dane',
      '<div class="dl">' + counts.map((x) =>
        '<dt>' + (labels[x.c] || x.c) + '</dt><dd>' + x.n + '</dd>').join('') +
        '<dt>Miejsce zapisu</dt><dd>' + U.esc(info.name) + '</dd>' +
        '<dt>Rozmiar danych</dt><dd>' + info.sizeKb + ' kB</dd>' +
      '</div>' +
      '<div class="mt-5"><div class="label mb-2">Eksport do arkusza (CSV)</div>' +
        '<div class="row gap-2 wrap">' +
          '<button class="btn btn--sm" data-action="exportCsv" data-kind="lessons">' + icon('file', 14) + ' Zajęcia</button>' +
          '<button class="btn btn--sm" data-action="exportCsv" data-kind="students">' + icon('file', 14) + ' Uczniowie</button>' +
          '<button class="btn btn--sm" data-action="exportCsv" data-kind="payments">' + icon('file', 14) + ' Płatności</button>' +
          '<button class="btn btn--sm" data-action="exportCsv" data-kind="expenses">' + icon('file', 14) + ' Wydatki</button>' +
        '</div>' +
        '<p class="tiny dim mt-2">CSV otwiera się w Excelu i Arkuszach Google. Do przeniesienia aplikacji ' +
        'na inne urządzenie użyj kopii zapasowej JSON — CSV nie zawiera wszystkich powiązań.</p>' +
      '</div>' +
      '<div class="mt-5"><div class="label mb-2">Dane demonstracyjne</div>' +
        (st.demoData
          ? '<div class="insight insight--info mb-3"><span class="insight__ico">' + icon('info', 15) + '</span>' +
            '<div class="insight__body small">Pracujesz na danych demonstracyjnych. Usuń je, zanim zaczniesz wprowadzać prawdziwych uczniów.</div></div>' +
            '<button class="btn btn--sm btn--danger-soft" data-action="clearDemo">' + icon('trash', 15) + ' Usuń dane demonstracyjne</button>'
          : '<button class="btn btn--sm" data-action="loadDemo">' + icon('sparkles', 15) + ' Wczytaj dane demonstracyjne</button>') +
      '</div>' +
      '<div class="mt-5" style="border-top:1px solid var(--border);padding-top:20px">' +
        '<div class="label mb-2" style="color:var(--bad-500)">Strefa niebezpieczna</div>' +
        '<button class="btn btn--sm btn--danger-soft" data-action="resetAll">' + icon('trash', 15) + ' Usuń wszystkie dane</button>' +
      '</div>',
      { subtitle: 'Zapisywane na Twoim koncie Sowie Fiszki' });
  }

  /* ---------- Aplikacja / PWA ---------- */
  function appCard() {
    const P = window.TF.PWA;
    if (!P) return '';
    const s = P.status();
    const fromFile = location.protocol === 'file:';

    const rows =
      '<div class="dl">' +
        '<dt>Tryb</dt><dd>' + (s.installed ? 'zainstalowana aplikacja' : 'karta przeglądarki') + '</dd>' +
        '<dt>Połączenie</dt><dd class="' + (s.online ? 'pos-up' : 'pos-down') + '">' + (s.online ? 'online' : 'offline') + '</dd>' +
        '<dt>Praca offline</dt><dd>' + (s.offlineReady ? '<span class="pos-up">gotowa</span>' : fromFile ? 'nie dotyczy' : 'przygotowywana…') + '</dd>' +
        (s.version ? '<dt>Wersja</dt><dd class="small">' + U.esc(s.version) + '</dd>' : '') +
      '</div>';

    let action;
    if (fromFile) {
      action = '<div class="insight insight--info mt-4"><span class="insight__ico">' + icon('info', 15) + '</span>' +
        '<div class="insight__body small">Aplikacja jest otwarta bezpośrednio z pliku, więc instalacja i tryb offline są niedostępne. ' +
        'Otwórz ją przez adres <code>https://…</code> albo lokalny serwer, aby zainstalować ją jak zwykłą aplikację.</div></div>';
    } else if (s.installed) {
      action = '<div class="insight insight--ok mt-4"><span class="insight__ico">' + icon('checkCircle', 15) + '</span>' +
        '<div class="insight__body small">TutorFlow działa jako zainstalowana aplikacja — bez paska przeglądarki i bez internetu.</div></div>';
    } else if (s.installable) {
      action = '<button class="btn btn--brand btn--block mt-4" data-action="installApp">' +
        icon('download', 16) + ' Zainstaluj jako aplikację</button>' +
        '<p class="tiny dim mt-2">Doda ikonę na pulpicie lub ekranie startowym i uruchomi się w osobnym oknie.</p>';
    } else {
      action = '<div class="insight insight--info mt-4"><span class="insight__ico">' + icon('info', 15) + '</span>' +
        '<div class="insight__body small">Instalacja zależy od przeglądarki. W Chrome i Edge szukaj ikony instalacji ' +
        'w pasku adresu, w Safari na iOS: <b>Udostępnij → Dodaj do ekranu początkowego</b>.</div></div>';
    }

    const updateBtn = s.updateReady
      ? '<button class="btn btn--brand btn--block mt-3" data-action="applyUpdate">' + icon('refresh', 15) + ' Załaduj nową wersję</button>'
      : (!fromFile ? '<button class="btn btn--sm btn--block mt-3" data-action="checkUpdate">' + icon('refresh', 14) + ' Sprawdź aktualizacje</button>' : '');

    return UI.card('Aplikacja', rows + action + updateBtn, {
      subtitle: 'Instalacja, tryb offline i aktualizacje'
    });
  }

  function integrationsCard() {
    const planned = [
      ['Logowanie korepetytora', 'user'], ['Konto ucznia i rodzica', 'users'],
      ['Rezerwacja terminów online', 'calendar'], ['Synchronizacja z Google Calendar', 'refresh'],
      ['Automatyczne e-maile i SMS', 'mail'], ['Płatności online (Stripe, Przelewy24)', 'card'],
      ['Faktury', 'file'], ['AI: notatki i analiza postępów', 'sparkles']
    ];
    return UI.card('Gotowe na rozbudowę',
      '<p class="muted small mb-4">Architektura aplikacji (modele danych po identyfikatorach + wymienny adapter zapisu) ' +
      'pozwala podłączyć backend bez przepisywania logiki.</p>' +
      '<div class="col gap-2">' + planned.map((p) =>
        '<div class="row gap-2 small dim">' + icon(p[1], 15) + '<span>' + U.esc(p[0]) + '</span>' +
        '<span class="badge badge--outline" style="margin-left:auto">w planach</span></div>').join('') + '</div>');
  }

  window.TF.Views.settings = {
    title: 'Ustawienia',
    subtitle: 'Dopasuj TutorFlow do swojego sposobu pracy',
    render: function () {
      const st = S().settings();
      return '<div class="grid grid-2">' +
        '<div class="col gap-4">' + profileCard(st) + workHoursCard(st) + policyCard(st) + '</div>' +
        '<div class="col gap-4">' + defaultsCard(st) + appearanceCard(st) + appCard() + transferCard() + dataCard(st) + integrationsCard() + '</div>' +
        '</div>';
    },
    mount: function (host) {
      /* --- pole upuszczania kopii zapasowej --- */
      const drop = host.querySelector('#importDrop');
      if (drop) {
        drop.addEventListener('click', function () { window.TF.App.importData(); });
        drop.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.TF.App.importData(); }
        });
        ['dragenter', 'dragover'].forEach(function (ev) {
          drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('is-over'); });
        });
        ['dragleave', 'dragend'].forEach(function (ev) {
          drop.addEventListener(ev, function () { drop.classList.remove('is-over'); });
        });
        drop.addEventListener('drop', function (e) {
          e.preventDefault(); e.stopPropagation();
          drop.classList.remove('is-over');
          const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (!file) return;
          if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
            window.TF.UI.toast('To nie jest kopia zapasowa', { type: 'warn', desc: 'Oczekiwany plik .json' });
            return;
          }
          window.TF.App.readBackupFile(file);
        });
      }

      const wh = host.querySelector('#workHours');
      if (!wh) return;
      wh.addEventListener('change', function (e) {
        const on = e.target.getAttribute('data-day-on');
        if (on !== null) {
          const i = Number(on);
          wh.querySelector('[data-day-start="' + i + '"]').disabled = !e.target.checked;
          wh.querySelector('[data-day-end="' + i + '"]').disabled = !e.target.checked;
        }
        recalc();
      });
      wh.addEventListener('input', recalc);
      function recalc() {
        U.DOW_LONG.forEach(function (n, i) {
          const on = wh.querySelector('[data-day-on="' + i + '"]').checked;
          const s = wh.querySelector('[data-day-start="' + i + '"]').value;
          const e = wh.querySelector('[data-day-end="' + i + '"]').value;
          const out = wh.querySelector('[data-day-sum="' + i + '"]');
          out.textContent = on ? U.num(Math.max(0, (U.toMin(e) - U.toMin(s)) / 60), 1) + ' h' : 'wolne';
        });
      }
    }
  };
})();
