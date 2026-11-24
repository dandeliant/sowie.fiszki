/* ============================================================
   TutorFlow — onboarding.js
   Pierwsze uruchomienie: 5 kroków albo skok do wersji demo.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const icon = window.TF.icon;

  const O = {};
  const data = { name: '', subject: 'Angielski', price: 80, days: [0, 1, 2, 3, 4], start: '14:00', end: '20:00', student: null };
  let step = 0;

  const STEPS = [
    {
      title: 'Witaj w TutorFlow',
      text: 'Twoje korepetycje. Twój czas. Twoje finanse. Skonfigurujmy aplikację w 5 krokach — zajmie to minutę.',
      body: function () {
        return '<div class="field"><label>Jak masz na imię?</label>' +
          '<input class="input" id="onbName" value="' + U.esc(data.name) + '" placeholder="np. Marta" autofocus></div>';
      },
      read: function (root) { data.name = root.querySelector('#onbName').value.trim(); return true; }
    },
    {
      title: 'Czego uczysz?',
      text: 'Ten przedmiot podstawi się domyślnie przy dodawaniu uczniów i zajęć.',
      body: function () {
        const popular = ['Angielski', 'Matematyka', 'Niemiecki', 'Polski', 'Fizyka', 'Chemia', 'Hiszpański', 'Informatyka'];
        return '<div class="field"><label>Główny przedmiot</label>' +
          '<input class="input" id="onbSubject" value="' + U.esc(data.subject) + '" autofocus></div>' +
          '<div class="chips mt-3">' + popular.map((p) =>
            '<button type="button" class="chip" data-pick-subject="' + U.esc(p) + '">' + p + '</button>').join('') + '</div>';
      },
      read: function (root) {
        data.subject = root.querySelector('#onbSubject').value.trim() || 'Korepetycje';
        return true;
      },
      mount: function (root) {
        root.addEventListener('click', function (e) {
          const b = e.target.closest('[data-pick-subject]');
          if (!b) return;
          root.querySelector('#onbSubject').value = b.getAttribute('data-pick-subject');
        });
      }
    },
    {
      title: 'Jaka jest Twoja stawka?',
      text: 'Cena za 60 minut. Zawsze możesz ustawić inne stawki dla poszczególnych uczniów.',
      body: function () {
        return '<div class="field"><label>Standardowa stawka za 60 minut</label>' +
          '<div class="input-suffix"><input class="input" type="number" id="onbPrice" min="0" step="5" value="' + data.price + '" autofocus>' +
          '<span>' + U.curSymbol() + '</span></div></div>' +
          '<div class="chips mt-3">' + [60, 70, 80, 90, 100, 120].map((p) =>
            '<button type="button" class="chip" data-pick-price="' + p + '">' + p + ' ' + U.curSymbol() + '</button>').join('') + '</div>';
      },
      read: function (root) { data.price = Number(root.querySelector('#onbPrice').value) || 80; return true; },
      mount: function (root) {
        root.addEventListener('click', function (e) {
          const b = e.target.closest('[data-pick-price]');
          if (!b) return;
          root.querySelector('#onbPrice').value = b.getAttribute('data-pick-price');
        });
      }
    },
    {
      title: 'W jakie dni pracujesz?',
      text: 'Dzięki temu kalendarz pokaże wolne okna, a statystyki policzą wykorzystanie grafiku.',
      body: function () {
        return '<div class="field"><label>Dni pracy</label>' +
          '<div class="day-toggles" id="onbDays">' + U.DOW_SHORT.map((n, i) =>
            '<button type="button" class="day-toggle ' + (data.days.indexOf(i) !== -1 ? 'is-on' : '') + '" data-day="' + i + '">' + n + '</button>').join('') +
          '</div></div>' +
          '<div class="form-grid mt-4">' +
            '<div class="field"><label>Od godziny</label><input class="input" type="time" id="onbStart" step="900" value="' + data.start + '"></div>' +
            '<div class="field"><label>Do godziny</label><input class="input" type="time" id="onbEnd" step="900" value="' + data.end + '"></div>' +
          '</div>';
      },
      read: function (root) {
        data.start = root.querySelector('#onbStart').value || '14:00';
        data.end = root.querySelector('#onbEnd').value || '20:00';
        if (!data.days.length) { window.TF.UI.toast('Wybierz przynajmniej jeden dzień', { type: 'warn' }); return false; }
        return true;
      },
      mount: function (root) {
        root.addEventListener('click', function (e) {
          const b = e.target.closest('[data-day]');
          if (!b) return;
          const v = Number(b.getAttribute('data-day'));
          const i = data.days.indexOf(v);
          if (i === -1) data.days.push(v); else data.days.splice(i, 1);
          b.classList.toggle('is-on');
        });
      }
    },
    {
      title: 'Dodaj pierwszego ucznia',
      text: 'Możesz też pominąć ten krok i dodać uczniów później.',
      body: function () {
        return '<div class="form-grid">' +
          '<div class="field"><label>Imię</label><input class="input" id="onbSFirst" placeholder="np. Anna" autofocus></div>' +
          '<div class="field"><label>Nazwisko</label><input class="input" id="onbSLast" placeholder="np. Kowalska"></div>' +
          '<div class="field"><label>Poziom / klasa</label><input class="input" id="onbSLevel" placeholder="np. B1, 8 SP"></div>' +
          '<div class="field"><label>Stawka za 60 min</label><div class="input-suffix">' +
            '<input class="input" type="number" id="onbSPrice" min="0" step="5" value="' + data.price + '"><span>' + U.curSymbol() + '</span></div></div>' +
        '</div>';
      },
      read: function (root) {
        const f = root.querySelector('#onbSFirst').value.trim();
        if (f) {
          data.student = {
            firstName: f,
            lastName: root.querySelector('#onbSLast').value.trim(),
            level: root.querySelector('#onbSLevel').value.trim(),
            price: Number(root.querySelector('#onbSPrice').value) || data.price
          };
        } else data.student = null;
        return true;
      }
    }
  ];

  function render() {
    const root = document.getElementById('onboarding');
    const s = STEPS[step];
    const pct = ((step) / STEPS.length) * 100;
    root.innerHTML =
      '<div class="onb">' +
        '<div class="onb__bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="onb__body">' +
          '<div class="onb__logo"><svg viewBox="0 0 100 100" width="48" height="48"><rect width="100" height="100" rx="26" fill="url(#ob)"/>' +
          '<path d="M28 64 L46 38 L58 54 L72 32" stroke="white" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<defs><linearGradient id="ob" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs></svg></div>' +
          '<div class="onb__step">Krok ' + (step + 1) + ' z ' + STEPS.length + '</div>' +
          '<h2>' + U.esc(s.title) + '</h2>' +
          '<p>' + U.esc(s.text) + '</p>' +
          '<div class="onb__form" id="onbForm">' + s.body() + '</div>' +
        '</div>' +
        '<div class="onb__foot">' +
          (step === 0
            ? '<button class="btn btn--ghost btn--sm" data-onb="demo">Pomiń i zobacz wersję demonstracyjną</button>'
            : '<button class="btn btn--sm" data-onb="back">' + icon('chevronLeft', 15) + ' Wstecz</button>') +
          '<button class="btn btn--brand" data-onb="next">' +
            (step === STEPS.length - 1 ? 'Zaczynamy' : 'Dalej') + ' ' + icon('chevronRight', 15) + '</button>' +
        '</div>' +
      '</div>';

    const form = root.querySelector('#onbForm');
    if (s.mount) s.mount(form);
    const first = form.querySelector('input');
    if (first) setTimeout(() => first.focus(), 60);

    root.querySelectorAll('[data-onb]').forEach(function (b) {
      b.addEventListener('click', function () {
        const a = b.getAttribute('data-onb');
        if (a === 'demo') { finishDemo(); return; }
        if (a === 'back') { step = Math.max(0, step - 1); render(); return; }
        if (!s.read(form)) return;
        if (step === STEPS.length - 1) finish();
        else { step++; render(); }
      });
    });

    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); root.querySelector('[data-onb="next"]').click(); }
    });
  }

  function applySettings() {
    const byDay = {};
    data.days.forEach((d) => { byDay[d] = { start: data.start, end: data.end }; });
    S().setSetting({
      tutorName: data.name,
      subject: data.subject,
      defaultPrice: data.price,
      workDays: data.days.slice().sort(),
      workHours: { start: data.start, end: data.end },
      workHoursByDay: byDay,
      monthlyGoal: Math.round(data.price * 90 / 500) * 500 || 5000,
      onboarded: true
    });
  }

  function finish() {
    applySettings();
    if (data.student) {
      const base = data.student.price;
      S().ops.addStudent({
        firstName: data.student.firstName, lastName: data.student.lastName,
        level: data.student.level, subject: data.subject,
        rates: window.TF.Models.autoRates(base)   // wyliczone stawki zaokrąglone w górę do pełnych 5 zł
      });
    }
    close();
    window.TF.UI.toast('Wszystko gotowe!', {
      type: 'ok',
      desc: data.student ? 'Dodaj pierwsze zajęcia dla ' + data.student.firstName + '.' : 'Zacznij od dodania ucznia.',
      actionLabel: data.student ? 'Dodaj zajęcia' : 'Dodaj ucznia',
      onAction: function () { data.student ? window.TF.Forms.lesson({}) : window.TF.Forms.student(); }
    });
  }

  function finishDemo() {
    applySettings();
    window.TF.Seed.load(true);
    close();
    window.TF.UI.toast('Wczytano dane demonstracyjne', {
      type: 'ok', desc: 'Możesz je usunąć w Ustawieniach jednym kliknięciem.', duration: 6000
    });
  }

  function close() {
    document.getElementById('onboarding').hidden = true;
    document.getElementById('app').hidden = false;
    window.TF.App.afterBoot();
  }

  O.start = function () {
    step = 0;
    document.getElementById('onboarding').hidden = false;
    document.getElementById('app').hidden = true;
    render();
  };

  window.TF.Onboarding = O;
})();
