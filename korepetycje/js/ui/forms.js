/* ============================================================
   TutorFlow — forms.js
   Wszystkie formularze aplikacji. Każdy zwraca działający modal,
   waliduje dane, zapisuje przez Store.ops i odświeża widok.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = () => window.TF.UI;
  const icon = window.TF.icon;

  const F = {};

  /* ============================================================
     POMOCNIKI
     ============================================================ */
  function read(form) {
    const out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
      else out[el.name] = el.value;
    });
    return out;
  }

  function studentOptions(selected, opts) {
    opts = opts || {};
    const list = U.sortBy(S().repo('students').all().filter((s) => opts.all ? true : s.status !== 'ended'),
      (s) => s.lastName + s.firstName);
    return (opts.emptyLabel ? '<option value="">' + U.esc(opts.emptyLabel) + '</option>' : '') +
      list.map((s) => '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' +
        U.esc(s.firstName + ' ' + s.lastName) + (s.level ? ' · ' + U.esc(s.level) : '') + '</option>').join('');
  }

  function selectFrom(dict, name, selected, cls) {
    return '<select class="select ' + (cls || '') + '" name="' + name + '">' +
      Object.keys(dict).map((k) => '<option value="' + k + '"' + (k === selected ? ' selected' : '') + '>' +
        U.esc(dict[k].label) + '</option>').join('') + '</select>';
  }

  function field(label, inner, hint) {
    return '<div class="field"><label>' + U.esc(label) + '</label>' + inner +
      (hint ? '<span class="hint">' + U.esc(hint) + '</span>' : '') + '</div>';
  }

  function afterSave(modal, msg, desc) {
    if (modal) modal.close();
    UI().toast(msg, { type: 'ok', desc: desc });
    window.TF.Router.refresh();
  }

  /* ============================================================
     LEKCJA — 🔁 POWTARZAJ (blok formularza)
     ============================================================ */
  const DOW_ACC = ['w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę', 'w niedzielę'];
  const REPEAT_PRESETS = [
    ['none', 'Nie powtarzaj'], ['weekly', 'Co tydzień'], ['biweekly', 'Co 2 tygodnie'],
    ['monthly', 'Co miesiąc'], ['yearly', 'Co rok'], ['custom', 'Niestandardowo…']
  ];
  const REPEAT_ENDS = [['count', 'Po liczbie lekcji'], ['until', 'Do daty'], ['never', 'Bez końca']];

  function unitWord(unit, n) {
    const f = M.RECUR_FREQ[unit].forms;
    return U.plural(Number(n) || 1, f[0], f[1], f[2]);
  }

  /** Reguła → stan kontrolek formularza */
  function ruleToUi(rule, anchor) {
    const ui = { preset: 'none', interval: 1, unit: 'week', days: [], end: 'count', count: 10, until: '' };
    if (!rule) return ui;
    const r = S().ops.normRule(rule, anchor);
    ui.interval = r.interval; ui.unit = r.freq; ui.days = r.days ? r.days.slice() : [];
    ui.end = r.end; ui.count = r.count || 10; ui.until = r.until || '';
    ui.preset = 'custom';
    if (!r.days) {
      Object.keys(M.RECUR_PRESETS).forEach(function (k) {
        const p = M.RECUR_PRESETS[k];
        if (p.freq === r.freq && p.interval === r.interval) ui.preset = k;
      });
    }
    return ui;
  }

  /** Podpowiedź końca serii: koniec roku szkolnego (30 czerwca) albo +3 miesiące */
  function suggestUntil(date) {
    const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
    const june = (m >= 7 ? y + 1 : y) + '-06-30';
    return june > U.addDays(date, 14) ? june : U.addMonths(date, 3);
  }

  function repeatBlock(ui) {
    return '<div class="field span2 repeat-box" id="repeatBox">' +
      '<label for="repSel">🔁 Powtarzaj</label>' +
      '<div class="repeat-row">' +
        '<select class="select" name="repPreset" id="repSel">' + REPEAT_PRESETS.map(function (p) {
          return '<option value="' + p[0] + '"' + (ui.preset === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
        }).join('') + '</select>' +
        '<span class="repeat-row" id="repCustom"' + (ui.preset === 'custom' ? '' : ' hidden') + '>' +
          '<span class="small">co</span>' +
          '<input class="input input--sm repeat-num" type="number" name="repInterval" min="1" max="99" step="1" value="' +
            ui.interval + '" aria-label="Co ile">' +
          '<select class="select select--sm repeat-unit" name="repUnit" aria-label="Jednostka">' +
            ['day', 'week', 'month', 'year'].map(function (u) {
              return '<option value="' + u + '"' + (ui.unit === u ? ' selected' : '') + '>' + unitWord(u, ui.interval) + '</option>';
            }).join('') + '</select>' +
        '</span>' +
      '</div>' +
      '<div id="repDays" class="mt-3"' + (ui.preset === 'custom' && ui.unit === 'week' ? '' : ' hidden') + '>' +
        '<span class="label">Dni tygodnia</span>' +
        '<div class="day-toggles">' + U.DOW_SHORT.map(function (n, i) {
          const on = ui.days.indexOf(i) !== -1;
          return '<button type="button" class="day-toggle' + (on ? ' is-on' : '') + '" data-rday="' + i + '" aria-pressed="' + on + '">' + n + '</button>';
        }).join('') + '</div>' +
      '</div>' +
      '<div id="repEndWrap" class="mt-3"' + (ui.preset === 'none' ? ' hidden' : '') + '>' +
        '<span class="label">Koniec</span>' +
        '<div class="repeat-row wrap">' +
          '<div class="segmented" id="repEndSeg">' + REPEAT_ENDS.map(function (e) {
            return '<button type="button" data-end="' + e[0] + '"' + (ui.end === e[0] ? ' class="is-active"' : '') + '>' + e[1] + '</button>';
          }).join('') + '</div>' +
          '<span class="repeat-row" id="repCountWrap"' + (ui.end === 'count' ? '' : ' hidden') + '>' +
            '<input class="input input--sm repeat-num" type="number" name="repCount" min="1" max="500" step="1" value="' + ui.count + '" aria-label="Liczba lekcji">' +
            '<span class="small dim" id="repCountWord">' + U.plural(ui.count, 'lekcja', 'lekcje', 'lekcji') + '</span></span>' +
          '<span id="repUntilWrap"' + (ui.end === 'until' ? '' : ' hidden') + '>' +
            '<input class="input input--sm" type="date" name="repUntil" value="' + U.esc(ui.until) + '" aria-label="Ostatni dzień serii"></span>' +
        '</div>' +
        '<input type="hidden" name="repEnd" value="' + ui.end + '">' +
      '</div>' +
      '<span class="hint" id="repHint"></span>' +
    '</div>';
  }

  /** Stan kontrolek → reguła (null = „Nie powtarzaj”) */
  function readRule(form, days) {
    const p = form.elements.repPreset.value;
    if (p === 'none') return null;
    let rule;
    if (p === 'custom') {
      rule = { freq: form.elements.repUnit.value, interval: Number(form.elements.repInterval.value) || 1 };
      if (rule.freq === 'week' && days.length) rule.days = days.slice();
    } else {
      rule = { freq: M.RECUR_PRESETS[p].freq, interval: M.RECUR_PRESETS[p].interval };
    }
    rule.end = form.elements.repEnd.value;
    if (rule.end === 'count') rule.count = Number(form.elements.repCount.value) || 0;
    if (rule.end === 'until') rule.until = form.elements.repUntil.value || '';
    return rule;
  }

  /** „Co tydzień we wtorek”, „Co miesiąc, 31. dnia”, „Co rok, 3 grudnia” */
  function ruleSentence(rule, date) {
    const ops = S().ops;
    const r = ops.normRule(rule, date);
    const label = U.cap(ops.ruleLabel(r, date));
    if (r.freq === 'week' && !r.days) return label + ' ' + DOW_ACC[U.dow(date)];
    if (r.freq === 'month') return label + ', ' + U.parse(date).getDate() + '. dnia' +
      (U.parse(date).getDate() > 28 ? ' (w krótszych miesiącach — ostatniego dnia)' : '');
    if (r.freq === 'year') return label + ', ' + U.fmtDate(date, 'day');
    return label;
  }

  /** Polskie „zmieni się 1 lekcja / zmienią się 2 lekcje / zmieni się 5 lekcji” */
  function willChange(n) {
    return U.plural(n, 'zmieni się', 'zmienią się', 'zmieni się') + ' ' + U.lessonsLabel(n);
  }

  /* ============================================================
     LEKCJA — dodawanie, edycja, kopiowanie
     draft: { id } edycja | { studentId, date, start, … } nowa |
            { copyFrom: lekcja, … } kopia (formularz nowej lekcji z danymi oryginału)
     ============================================================ */
  F.lesson = function (draft) {
    draft = draft || {};
    const editing = !!draft.id;
    const lesson = editing ? S().repo('lessons').byId(draft.id) : null;
    if (editing && !lesson) {
      UI().toast('Tych zajęć już nie ma', { type: 'warn', desc: 'Mogły zostać usunięte na innym urządzeniu.' });
      return null;
    }
    const st = S().settings();
    const students = S().repo('students').all();

    if (!students.length) {
      UI().toast('Najpierw dodaj ucznia', { type: 'warn', desc: 'Lekcję można przypisać tylko do istniejącego ucznia.' });
      return F.student();
    }

    const copy = !editing && draft.copyFrom ? draft.copyFrom : null;
    const d = editing ? lesson : Object.assign({
      studentId: draft.studentId || '',
      date: draft.date || U.today(),
      start: draft.start || (st.workHours && st.workHours.start) || '16:00',
      duration: draft.duration || st.defaultDuration || 60,
      mode: draft.mode || st.defaultMode,
      subject: draft.subject || '',
      topic: draft.topic || '',
      price: draft.price !== undefined ? draft.price : null,
      paymentStatus: draft.paymentStatus === 'free' ? 'free' : 'unpaid',
      note: draft.note || ''
    }, {});

    const durButtons = M.DURATIONS.map((v) =>
      '<button type="button" class="' + (v === d.duration ? 'is-active' : '') + '" data-dur="' + v + '">' + v + '</button>').join('') +
      '<button type="button" class="' + (M.DURATIONS.indexOf(d.duration) === -1 ? 'is-active' : '') + '" data-dur="custom">Własny</button>';

    /* Lekcja z serii — informacja; o zakresie zmian pytamy przy zapisie (jak Kalendarz Google) */
    const series = editing ? S().ops.seriesInfo(d.id) : null;
    const initialRule = series ? series.rule : null;
    const ruleAnchor = series ? series.anchor : d.date;
    const ui = ruleToUi(initialRule, ruleAnchor);
    const seriesBox = series
      ? '<div class="field span2 scope-box">' +
          '<label>🔁 Lekcja cykliczna: ' + U.esc(series.rhythmLabel) + (series.endLabel ? ' · ' + U.esc(series.endLabel) : '') + '</label>' +
          '<span class="hint">W serii ' + U.lessonsLabel(series.total) + ' (' +
            U.fmtDate(series.first.date, 'medium') + ' – ' + U.fmtDate(series.last.date, 'medium') + '). ' +
            'Przy zapisie i usuwaniu zapytamy, czy zmiana dotyczy tylko tej lekcji, tej i następnych, czy wszystkich w serii. ' +
            'Odbyte, opłacone i odwołane lekcje zostają bez zmian.</span>' +
        '</div>'
      : '';

    const body =
      '<form id="lessonForm" class="form-grid">' +
        seriesBox +
        '<div class="field span2"><label>Uczeń</label>' +
          '<select class="select" name="studentId" required>' + studentOptions(d.studentId, { emptyLabel: '— wybierz ucznia —' }) + '</select></div>' +

        field('Data', '<input class="input" type="date" name="date" value="' + d.date + '" required' + (copy ? ' autofocus' : '') + '>') +
        field('Godzina rozpoczęcia', '<input class="input" type="time" name="start" value="' + d.start + '" step="300" required>') +

        '<div class="field span2"><label>Czas trwania</label>' +
          '<div class="segmented" id="durSeg">' + durButtons + '</div>' +
          '<div id="durCustomWrap" ' + (M.DURATIONS.indexOf(d.duration) === -1 ? '' : 'hidden') + ' style="margin-top:8px">' +
            '<div class="input-suffix"><input class="input" type="number" name="duration" min="15" max="300" step="5" value="' + d.duration + '"><span>min</span></div>' +
          '</div>' +
          '<input type="hidden" name="durationPreset" value="' + (M.DURATIONS.indexOf(d.duration) === -1 ? 'custom' : d.duration) + '">' +
        '</div>' +

        field('Typ zajęć',
          '<select class="select" name="mode">' +
            '<option value="onsite"' + (d.mode === 'onsite' ? ' selected' : '') + '>Stacjonarne</option>' +
            '<option value="online"' + (d.mode === 'online' ? ' selected' : '') + '>Online</option></select>') +
        field('Przedmiot', '<input class="input" name="subject" value="' + U.esc(d.subject || '') + '" placeholder="np. Angielski">') +

        field('Cena', '<div class="input-suffix"><input class="input" type="number" name="price" min="0" step="any" value="' +
          (d.price === null ? '' : d.price) + '" required><span>' + U.curSymbol() + '</span></div>', 'Podstawia się automatycznie ze stawki ucznia') +
        field('Status płatności', selectFrom(
          { unpaid: M.PAYMENT_STATUS.unpaid, paid: M.PAYMENT_STATUS.paid, package: M.PAYMENT_STATUS.package, free: M.PAYMENT_STATUS.free },
          'paymentStatus', d.paymentStatus)) +

        (editing
          ? field('Temat zajęć', '<input class="input" name="topic" value="' + U.esc(d.topic || '') + '" placeholder="np. Present Perfect">') +
            field('Status zajęć', selectFrom(M.LESSON_STATUS, 'status', lesson.status))
          : '<div class="field span2"><label>Temat zajęć</label><input class="input" name="topic" value="' + U.esc(d.topic || '') +
            '" placeholder="np. Present Perfect"></div>') +

        repeatBlock(ui) +

        '<div class="field span2"><label>Notatka</label>' +
          '<textarea class="textarea" name="note" placeholder="Np. przynieść arkusz, sprawdzić pracę domową…">' + U.esc(d.note || '') + '</textarea></div>' +

        '<div class="span2" id="conflictBox"></div>' +
      '</form>';

    const modal = UI().modal({
      key: 'lesson-form',
      title: editing ? 'Edytuj zajęcia' : (copy ? 'Kopiuj zajęcia' : 'Dodaj zajęcia'),
      subtitle: editing
        ? U.fmtDate(d.date, 'dow') + (series ? ' · lekcja cykliczna, ' + series.rhythmLabel : '')
        : copy
          ? 'Kopia: ' + S().studentName(copy.studentId) + ', ' + U.fmtDate(copy.date, 'dow') + ', ' + U.fmtTime(copy.start) + ' — zmień datę lub godzinę'
          : 'Kliknij wolne okno w kalendarzu, aby dodać jeszcze szybciej',
      size: 'wide',
      body: body,
      footer:
        (editing ? '<button class="btn btn--danger-soft" data-del-lesson>' + icon('trash', 15) + ' Usuń</button>' +
          '<button class="btn" data-copy-lesson title="Nowe zajęcia z tymi samymi danymi">📄 Kopiuj</button>' : '') +
        '<div class="grow"></div>' +
        '<button class="btn" data-modal-close>Anuluj</button>' +
        '<button class="btn btn--brand" data-save-lesson>' + (editing ? 'Zapisz zmiany' : 'Dodaj zajęcia') + '</button>',
      footerSplit: editing
    });

    const form = modal.el.querySelector('#lessonForm');
    const durSeg = modal.el.querySelector('#durSeg');
    const durCustom = modal.el.querySelector('#durCustomWrap');
    const conflictBox = modal.el.querySelector('#conflictBox');
    const repSel = form.elements.repPreset;
    const repCustom = modal.el.querySelector('#repCustom');
    const repDays = modal.el.querySelector('#repDays');
    const repEndWrap = modal.el.querySelector('#repEndWrap');
    const repEndSeg = modal.el.querySelector('#repEndSeg');
    const repHint = modal.el.querySelector('#repHint');
    let priceTouched = editing || (copy && d.price !== null);
    const chosenDays = ui.days.slice();

    function currentDuration() {
      const preset = form.elements.durationPreset.value;
      if (preset === 'custom') return Number(form.elements.duration.value) || 60;
      return Number(preset);
    }
    function syncPrice() {
      if (priceTouched) return;
      const sid = form.elements.studentId.value;
      if (!sid) return;
      form.elements.price.value = S().ops.priceFor(sid, currentDuration());
    }
    function syncSubject() {
      const s = S().student(form.elements.studentId.value);
      if (s && !form.elements.subject.value) form.elements.subject.value = s.subject || '';
      if (s && !editing) {
        const modeSel = form.elements.mode;
        if (!draft.mode) modeSel.value = s.mode;
      }
    }

    function currentRule() { return readRule(form, chosenDays); }
    function ruleChanged() {
      const r = currentRule();
      if (!series) return !!r;
      return !S().ops.sameRule(r, initialRule, ruleAnchor);
    }

    /** Podgląd serii: ile terminów, do kiedy, ile kolizji */
    function seriesPreview(drafted) {
      const rule = currentRule();
      if (!rule) return '';
      if (series) {
        if (!ruleChanged()) return '';
        return '<div class="insight insight--info mt-2"><span class="insight__ico">🔁</span><div class="insight__body">' +
          '<strong>Zmieniasz powtarzanie serii</strong><p>Przy zapisie wybierzesz: ta i następne lekcje albo wszystkie w serii. ' +
          'Odbyte, opłacone i odwołane lekcje zostaną bez zmian.</p></div></div>';
      }
      const dates = S().ops.ruleProjection(drafted.date, rule);
      if (!dates.length) {
        return '<div class="insight insight--warn mt-2"><span class="insight__ico">!</span><div class="insight__body">' +
          '<strong>Brak terminów w tej serii</strong><p>Sprawdź datę końca i dni tygodnia.</p></div></div>';
      }
      const ignore = editing ? d.id : null;
      const rows = dates.map(function (dt) {
        const busy = !(editing && dt === drafted.date) &&
          S().ops.findConflicts({ date: dt, start: drafted.start, duration: drafted.duration }, ignore).length > 0;
        return { date: dt, blocked: busy };
      });
      const blocked = rows.filter((r) => r.blocked);
      const okRows = rows.filter((r) => !r.blocked);
      const last = rows[rows.length - 1];
      const r = S().ops.normRule(rule, drafted.date);

      let html = '<div class="insight insight--' + (blocked.length ? 'warn' : 'info') + ' mt-2">' +
        '<span class="insight__ico">' + icon('calendar', 15) + '</span><div class="insight__body">' +
        '<strong>Seria: ' + U.lessonsLabel(rows.length) + ' do ' + U.fmtDate(last.date, 'medium') + '</strong>' +
        '<p>' + rows.slice(0, 4).map(function (x) {
          return (x.blocked ? '<s>' : '') + U.fmtDate(x.date, 'short') + (x.blocked ? '</s>' : '');
        }).join(', ') + (rows.length > 4 ? ', …' : '') + '</p>';
      if (r.end === 'never' || (r.end === 'until' && r.until > last.date)) {
        html += '<p class="small dim">Kolejne terminy dołożymy automatycznie — zawsze na ' + S().ops.RECUR_HORIZON_MONTHS + ' miesięcy do przodu.</p>';
      }
      if (blocked.length) {
        const ile = okRows.length + ' ' + U.plural(okRows.length, 'lekcję', 'lekcje', 'lekcji');
        html += '<p style="color:var(--warn-500)"><b>' + blocked.length + ' ' +
          U.plural(blocked.length, 'termin koliduje', 'terminy kolidują', 'terminów koliduje') +
          '</b> z istniejącymi zajęciami — ' +
          U.plural(blocked.length, 'pominiemy go', 'pominiemy je', 'pominiemy je') +
          (okRows.length ? ' i dodamy ' + ile + '.' : '. Nie zostanie dodana żadna lekcja.') + '</p>';
      }
      return html + '</div></div>';
    }

    function checkConflicts() {
      const sid = form.elements.studentId.value;
      const dur = currentDuration();
      const drafted = { date: form.elements.date.value, start: form.elements.start.value, duration: dur };
      if (!drafted.date || !drafted.start) { conflictBox.innerHTML = ''; return; }
      const clash = S().ops.findConflicts(drafted, editing ? d.id : null);
      if (clash.length) {
        conflictBox.innerHTML = '<div class="insight insight--bad"><span class="insight__ico">!</span><div class="insight__body">' +
          '<strong>Ta godzina jest już zajęta</strong><p>' +
          clash.map((l) => U.fmtTime(l.start) + '–' + U.fmtTime(C().lessonEndTime(l)) + ' · ' + U.esc(S().studentName(l.studentId))).join('<br>') +
          '</p></div></div>';
      } else {
        const inWork = C().isWorkDay(drafted.date);
        conflictBox.innerHTML = inWork ? '' :
          '<div class="insight insight--warn"><span class="insight__ico">!</span><div class="insight__body">' +
          '<strong>To poza Twoimi godzinami pracy</strong><p>Możesz dodać zajęcia, ale nie wliczą się do wykorzystania grafiku.</p></div></div>';
      }
      conflictBox.innerHTML += seriesPreview(drafted);
      if (sid) {
        const s = S().student(sid);
        const due = C().unpaidTotal(sid);
        if (due > 0 && s) {
          conflictBox.innerHTML += '<div class="insight insight--warn mt-2"><span class="insight__ico">💰</span><div class="insight__body">' +
            '<strong>' + U.esc(s.firstName) + ' ma zaległość ' + U.money(due) + '</strong><p>Warto przypomnieć o płatności przed kolejnymi zajęciami.</p></div></div>';
        }
      }
    }

    /** Pokazuje/ukrywa części bloku „🔁 Powtarzaj” i podpisuje wybraną regułę */
    function syncRepeat() {
      const p = repSel.value;
      const unit = form.elements.repUnit.value;
      const n = Number(form.elements.repInterval.value) || 1;
      repCustom.hidden = p !== 'custom';
      repDays.hidden = !(p === 'custom' && unit === 'week');
      repEndWrap.hidden = p === 'none';
      Array.prototype.forEach.call(form.elements.repUnit.options, function (o) { o.textContent = unitWord(o.value, n); });
      const end = form.elements.repEnd.value;
      modal.el.querySelector('#repCountWrap').hidden = end !== 'count';
      modal.el.querySelector('#repUntilWrap').hidden = end !== 'until';
      modal.el.querySelector('#repCountWord').textContent = U.plural(Number(form.elements.repCount.value) || 0, 'lekcja', 'lekcje', 'lekcji');
      Array.prototype.forEach.call(repEndSeg.children, function (b) { b.classList.toggle('is-active', b.getAttribute('data-end') === end); });

      const rule = currentRule();
      const date = form.elements.date.value;
      if (!rule || !date) { repHint.textContent = editing ? '' : 'Lekcja jednorazowa.'; return; }
      let txt = ruleSentence(rule, date);
      if (rule.end === 'count') txt += ' · razem ' + U.lessonsLabel(Number(rule.count) || 0);
      else if (rule.end === 'until') txt += rule.until ? ' · do ' + U.fmtDate(rule.until, 'long') : ' · wybierz ostatni dzień';
      else txt += ' · bez końca (lekcje planujemy ' + S().ops.RECUR_HORIZON_MONTHS + ' miesięcy do przodu)';
      repHint.textContent = txt + '.';
    }

    durSeg.addEventListener('click', function (e) {
      const b = e.target.closest('[data-dur]');
      if (!b) return;
      Array.prototype.forEach.call(durSeg.children, (x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      const val = b.getAttribute('data-dur');
      form.elements.durationPreset.value = val;
      if (val === 'custom') { durCustom.hidden = false; form.elements.duration.focus(); }
      else { durCustom.hidden = true; form.elements.duration.value = val; }
      syncPrice(); checkConflicts();
    });

    form.addEventListener('change', function (e) {
      if (e.target.name === 'price') priceTouched = true;
      if (e.target.name === 'studentId') { syncSubject(); syncPrice(); }
      if (e.target.name === 'duration') { syncPrice(); }
      if (e.target.name === 'repPreset' && e.target.value === 'custom' && !chosenDays.length) {
        // niestandardowo: domyślnie dzień tygodnia tej lekcji
        const dw = U.dow(form.elements.date.value || U.today());
        chosenDays.push(dw);
        const b = repDays.querySelector('[data-rday="' + dw + '"]');
        if (b) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
      }
      syncRepeat();
      checkConflicts();
    });
    form.addEventListener('input', function (e) {
      if (/^rep(Count|Interval|Until)$/.test(e.target.name)) { syncRepeat(); checkConflicts(); }
    });
    repDays.addEventListener('click', function (e) {
      const b = e.target.closest('[data-rday]');
      if (!b) return;
      const v = Number(b.getAttribute('data-rday'));
      const i = chosenDays.indexOf(v);
      if (i === -1) chosenDays.push(v); else chosenDays.splice(i, 1);
      b.classList.toggle('is-on', i === -1);
      b.setAttribute('aria-pressed', String(i === -1));
      syncRepeat();
      checkConflicts();
    });
    repEndSeg.addEventListener('click', function (e) {
      const b = e.target.closest('[data-end]');
      if (!b) return;
      form.elements.repEnd.value = b.getAttribute('data-end');
      if (form.elements.repEnd.value === 'until' && !form.elements.repUntil.value) {
        form.elements.repUntil.value = suggestUntil(form.elements.date.value || U.today());
      }
      syncRepeat();
      checkConflicts();
    });

    /** Tylko te pola, które użytkownik faktycznie zmienił */
    function collectChanges(v) {
      const cand = {
        studentId: v.studentId,
        date: v.date,
        start: v.start,
        duration: v.duration,
        mode: v.mode,
        subject: v.subject || '',
        topic: v.topic || '',
        price: Number(v.price) || 0,
        paymentStatus: v.paymentStatus,
        note: v.note || ''
      };
      if (v.status) cand.status = v.status;
      const out = {};
      Object.keys(cand).forEach(function (k) {
        const was = lesson[k] === undefined || lesson[k] === null ? '' : lesson[k];
        if (String(cand[k]) !== String(was)) out[k] = cand[k];
      });
      return out;
    }

    /** Pełne dane lekcji z formularza (szablon nowych terminów serii) */
    function formData(v) {
      return {
        studentId: v.studentId, date: v.date, start: v.start, duration: v.duration,
        mode: v.mode, subject: v.subject || '', topic: v.topic || '', price: Number(v.price) || 0,
        paymentStatus: v.paymentStatus, note: v.note || ''
      };
    }

    /** Reguła z formularza musi mieć sens, zanim cokolwiek zapiszemy */
    function validRule(rule, date) {
      if (!rule) return true;
      if (rule.end === 'count' && !(Number(rule.count) >= 1)) {
        UI().toast('Podaj liczbę lekcji w serii', { type: 'warn' });
        form.elements.repCount.focus();
        return false;
      }
      if (rule.end === 'until' && (!rule.until || rule.until < date)) {
        UI().toast('Ostatni dzień serii musi być po dacie pierwszej lekcji', { type: 'warn' });
        form.elements.repUntil.focus();
        return false;
      }
      if (!S().ops.ruleProjection(date, rule).length) {
        UI().toast('Ta reguła nie daje żadnego terminu', { type: 'warn', desc: 'Sprawdź dni tygodnia i datę końca.' });
        return false;
      }
      return true;
    }

    function seriesDoneDesc(res, rule, from) {
      const r = S().ops.normRule(rule, from);
      const last = res.created.length ? res.created[res.created.length - 1].date : from;
      return U.cap(S().ops.ruleLabel(r, from)) + ' · od ' + U.fmtDate(from, 'medium') + ' do ' + U.fmtDate(last, 'medium') +
        (res.skipped.length ? ' · pominięto ' + res.skipped.length + ' ' +
          U.plural(res.skipped.length, 'kolidujący termin', 'kolidujące terminy', 'kolidujących terminów') : '') +
        (r.end === 'never' ? ' · kolejne dołożymy automatycznie' : '');
    }

    /* ---------- zapis lekcji z serii: pytamy o zakres ---------- */
    function saveSeriesLesson(v, changes, rule, changedRule) {
      const ops = S().ops;
      const data = formData(v);
      const when = U.fmtDate(d.date, 'dow') + ', ' + U.fmtTime(d.start);
      const options = [];
      const preview = {};

      if (changedRule) {
        options.push({ value: 'one', label: 'Tylko ta lekcja', disabled: true, desc: 'Zmiana powtarzania dotyczy całej serii.' });
        ['future', 'all'].forEach(function (scope) {
          const plan = ops.planReschedule(d.id, data, changes, rule, scope);
          preview[scope] = plan;
          const from = scope === 'all' ? (plan.anchor || series.first.date) : v.date;
          let desc;
          if (!rule) {
            desc = plan.remove.length
              ? 'Ta lekcja zostanie pojedyncza, usuniemy ' + U.lessonsAcc(plan.remove.length, 'zaplanowaną', 'zaplanowane', 'zaplanowanych') +
                (scope === 'future' ? ' po niej.' : ' z serii.')
              : 'Ta lekcja zostanie pojedyncza.';
          } else {
            const parts = [];
            if (plan.create.length) parts.push('nowe: ' + plan.create.length);
            if (plan.remove.length) parts.push('usunięte: ' + plan.remove.length);
            if (plan.update.length) parts.push('zachowane: ' + plan.update.length);
            if (plan.skipped.length + plan.blocked.length) parts.push('pominięte (kolizje): ' + (plan.skipped.length + plan.blocked.length));
            desc = (scope === 'all' ? 'Cała seria od ' : 'Od ') + U.fmtDate(from, 'medium') + ': ' +
              ops.ruleLabel(plan.rule, plan.anchor) + ', ' +
              (plan.rule.end === 'never' ? 'bez końca' : 'ostatnia ' + U.fmtDate(plan.tail, 'medium')) +
              (parts.length ? ' · lekcje ' + parts.join(', ') : '') + '.';
          }
          options.push({ value: scope, label: scope === 'future' ? 'Ta i następne' : 'Wszystkie w serii', desc: desc });
        });
      } else {
        options.push({ value: 'one', label: 'Tylko ta lekcja', desc: when + ' — pozostałe lekcje serii bez zmian.' });
        ['future', 'all'].forEach(function (scope) {
          const pre = ops.previewSeriesChanges(d.id, changes, scope);
          preview[scope] = pre;
          const n = pre.ok.length;
          let desc = n ? U.cap(willChange(n)) : 'Żadna lekcja się nie zmieni';
          if (scope === 'future') desc += ' (od ' + U.fmtDate(d.date, 'medium') + ')';
          if (pre.blocked.length) desc += ' · pominiemy ' + pre.blocked.length + ' (kolizje)';
          if (changes.date !== undefined && scope !== 'one') desc += ' · zmiana daty przesunie je o tyle samo dni';
          options.push({ value: scope, label: scope === 'future' ? 'Ta i następne' : 'Wszystkie w serii', desc: desc + '.', disabled: !n });
        });
      }

      UI().choice({
        title: changedRule ? 'Zmienić powtarzanie serii?' : 'Zapisać zmiany w lekcji cyklicznej?',
        subtitle: S().studentName(d.studentId) + ' · ' + series.rhythmLabel,
        options: options,
        value: draft.scope || (changedRule ? 'future' : 'one'),
        note: series.lockedCount ? 'Odbyte, opłacone, odwołane i przeszłe lekcje tej serii (' + series.lockedCount + ') zostają bez zmian.' : '',
        confirmLabel: 'Zapisz'
      }).then(function (scope) {
        if (!scope || !modal.isOpen()) return;
        if (scope === 'one') {
          S().ops.updateLesson(d.id, changes);
          afterSave(modal, 'Zajęcia zaktualizowane', 'Zmiana dotyczy tylko tego terminu');
          return;
        }
        if (changedRule) {
          const plan = ops.planReschedule(d.id, data, changes, rule, scope);   // świeży plan
          const res = ops.applyReschedule(plan);
          if (!res) { UI().toast('Nie udało się zapisać zmian', { type: 'bad' }); return; }
          afterSave(modal, rule ? 'Seria zmieniona' : 'Lekcja nie jest już cykliczna',
            (rule ? ops.ruleLabel(plan.rule, plan.anchor) + ' · ' : '') +
            [res.created ? 'dodano ' + res.created : '', res.removed ? 'usunięto ' + res.removed : '',
              res.skipped ? 'pominięto ' + res.skipped + ' (kolizje)' : ''].filter(Boolean).join(', '));
          return;
        }
        const res = ops.applySeriesChanges(d.id, changes, scope);
        if (!res.updated) {
          UI().toast('Nie zapisano żadnej zmiany', { type: 'bad', desc: 'Wszystkie terminy kolidowałyby z innymi zajęciami.' });
          return;
        }
        afterSave(modal, 'Zaktualizowano ' + U.lessonsLabel(res.updated) + ' z serii',
          res.skipped.length ? 'Pominięto ' + res.skipped.length + ' z powodu kolizji' : '');
      });
    }

    modal.el.querySelector('[data-save-lesson]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      v.duration = currentDuration();
      if (!v.studentId) { UI().toast('Wybierz ucznia', { type: 'warn' }); return; }
      const rule = currentRule();
      if (!validRule(rule, v.date)) return;

      if (editing) {
        const changes = collectChanges(v);
        const changedRule = ruleChanged();
        if (!Object.keys(changes).length && !changedRule) {
          modal.close();
          UI().toast('Nic się nie zmieniło', { type: 'info', duration: 2200 });
          return;
        }
        if (series) { saveSeriesLesson(v, changes, rule, changedRule); return; }
        if (!rule) {
          S().ops.updateLesson(d.id, changes);
          afterSave(modal, 'Zajęcia zaktualizowane', '');
          return;
        }
        // pojedyncza lekcja → cykliczna (ta lekcja jest pierwszą w serii)
        const res = S().ops.createSeries(formData(v), rule, { baseLessonId: d.id, basePatch: changes });
        afterSave(modal, 'Lekcja jest teraz cykliczna', U.lessonsLabel(res.created.length + 1) + ' · ' + seriesDoneDesc(res, rule, v.date));
        return;
      }

      const data = formData(v);
      if (!rule) {
        S().ops.addLesson(data);
        afterSave(modal, copy ? 'Kopia zajęć dodana' : 'Zajęcia dodane', U.fmtDate(v.date, 'dow') + ', ' + U.fmtTime(v.start));
        return;
      }
      const res = S().ops.createSeries(data, rule);
      if (!res.created.length) {
        UI().toast('Nie dodano żadnych zajęć', {
          type: 'bad',
          desc: 'Wszystkie terminy tej serii kolidują z istniejącymi zajęciami. Zmień godzinę lub dzień.'
        });
        return;   // okno zostaje otwarte, żeby dało się poprawić
      }
      afterSave(modal, U.lessonsLabel(res.created.length) + ' ' + U.plural(res.created.length, 'dodana', 'dodane', 'dodanych'),
        seriesDoneDesc(res, rule, v.date));
    });

    const delBtn = modal.el.querySelector('[data-del-lesson]');
    if (delBtn) delBtn.addEventListener('click', function () { F.deleteLesson(d.id, function () { modal.close(); }); });

    const copyBtn = modal.el.querySelector('[data-copy-lesson]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        // kopia z tym, co jest teraz w formularzu (oryginał zostaje bez zmian)
        const v = read(form);
        v.duration = currentDuration();
        modal.close(true);
        F.copyLesson(Object.assign({}, lesson, formData(v), { id: lesson.id }));
      });
    }

    if (d.price === null || d.price === undefined || (!editing && !copy)) syncPrice();
    syncRepeat();
    checkConflicts();
    return modal;
  };

  /** „📄 Kopiuj” — formularz NOWEJ lekcji z danymi oryginału (bez płatności, status: zaplanowana) */
  F.copyLesson = function (src) {
    const l = typeof src === 'string' ? S().repo('lessons').byId(src) : src;
    if (!l) return null;
    return F.lesson({
      copyFrom: l,
      studentId: l.studentId, date: l.date, start: l.start, duration: l.duration,
      mode: l.mode, subject: l.subject, topic: l.topic, price: l.price, note: l.note,
      paymentStatus: l.paymentStatus === 'free' ? 'free' : 'unpaid'
    });
  };

  /**
   * Usuwanie zajęć — z formularza i z menu lekcji. Lekcja z serii pyta o zakres
   * jak Kalendarz Google; zamknięte lekcje (odbyte, opłacone, odwołane, przeszłe)
   * znikają tylko przy „Tylko ta lekcja”.
   */
  F.deleteLesson = function (id, done) {
    const l = S().repo('lessons').byId(id);
    if (!l) return;
    const who = S().studentName(l.studentId);
    const when = U.fmtDate(l.date, 'dow') + ', ' + U.fmtTime(l.start);
    function finish(title, desc) {
      if (done) done();
      UI().toast(title, { type: 'ok', desc: desc });
      window.TF.Router.refresh();
    }
    const series = S().ops.seriesInfo(id);
    if (!series) {
      UI().confirm({ title: 'Usunąć te zajęcia?', text: when + ' — ' + who, confirmLabel: 'Usuń zajęcia' }).then(function (ok) {
        if (!ok) return;
        S().ops.deleteSeries(id, 'one');
        finish('Zajęcia usunięte', when);
      });
      return;
    }
    function desc(scope) {
      const p = S().ops.previewDelete(id, scope);
      if (!p.remove.length) return { text: 'Nic do usunięcia — wszystkie lekcje w tym zakresie są już odbyte, opłacone lub odwołane.', n: 0 };
      const value = U.sum(p.remove.filter((x) => x.status === 'planned'), (x) => Number(x.price) || 0);
      return {
        n: p.remove.length,
        text: 'Usuniemy ' + U.lessonsAcc(p.remove.length, 'zaplanowaną', 'zaplanowane', 'zaplanowanych') +
          (p.remove.length > 1 ? ' (' + U.fmtDate(p.remove[0].date, 'medium') + ' – ' + U.fmtDate(p.remove[p.remove.length - 1].date, 'medium') + ')' : '') +
          (value ? ' · −' + U.money(value) + ' w prognozie' : '') +
          (p.keep.length ? ' · ' + p.keep.length + ' zostanie w historii' : '') + '.'
      };
    }
    const fut = desc('future'), all = desc('all');
    UI().choice({
      title: 'Usunąć lekcję cykliczną?',
      subtitle: who + ' · ' + series.rhythmLabel,
      options: [
        { value: 'one', label: 'Tylko ta lekcja', desc: when + '.' },
        { value: 'future', label: 'Ta i następne', desc: fut.text, disabled: !fut.n },
        { value: 'all', label: 'Wszystkie w serii', desc: all.text, disabled: !all.n }
      ],
      value: 'one',
      note: series.lockedCount ? 'Odbyte, opłacone, odwołane i przeszłe lekcje zostają w historii — taką lekcję usuniesz pojedynczo („Tylko ta lekcja”).' : '',
      confirmLabel: 'Usuń',
      danger: true
    }).then(function (scope) {
      if (!scope) return;
      const res = S().ops.deleteSeries(id, scope);
      finish(scope === 'one' ? 'Zajęcia usunięte' : U.lessonsLabel(res.removed) + ' ' + U.plural(res.removed, 'usunięta', 'usunięte', 'usuniętych'),
        scope === 'one' ? when : (res.kept ? res.kept + ' ' + U.plural(res.kept, 'zamknięta została', 'zamknięte zostały', 'zamkniętych zostało') + ' w historii' : 'Seria zakończona'));
    });
  };

  /* ============================================================
     UCZEŃ
     opts.copyOf — id ucznia, z którego zrobiono tę kopię (rodzeństwo)
     ============================================================ */
  F.student = function (id, opts) {
    opts = opts || {};
    const editing = !!id;
    const st = S().settings();
    const s = editing ? S().student(id) : M.Student({});
    if (editing && !s) { UI().toast('Tego ucznia już nie ma', { type: 'warn' }); return null; }
    const orig = opts.copyOf ? S().student(opts.copyOf) : null;
    const suffix = S().ops.COPY_SUFFIX || ' (kopia)';

    /* ---- Cennik: stawki 30/45/90/120 min wyliczają się ze stawki za 60 min
       i są zaokrąglane w górę do pełnych 5 zł (M.autoRate → U.roundPrice).
       Kwoty wpisane ręcznie zostają — nie nadpisujemy ich. ---- */
    const OTHER = M.DURATIONS.filter((d) => d !== 60);
    const base0 = Number(s.rates && s.rates[60]) || st.defaultPrice || 80;
    const rateVal = {}, isAuto = {}, rounded = [];
    rateVal[60] = base0;
    OTHER.forEach(function (d) {
      const stored = Number(s.rates && s.rates[d]) || 0;
      const auto = M.autoRate(base0, d);
      if (!stored) { rateVal[d] = auto; isAuto[d] = true; }
      else if (stored === auto) { rateVal[d] = stored; isAuto[d] = true; }
      else if (M.isLegacyAutoRate(stored, base0, d) && stored % U.PRICE_STEP !== 0) {
        // kwota wyliczona kiedyś bez zaokrąglania (np. 48 zł) → od razu pełne 5 zł
        rateVal[d] = U.roundPrice(stored); isAuto[d] = true;
        rounded.push(d + ' min: ' + stored + ' → ' + rateVal[d] + ' ' + U.curSymbol());
      } else { rateVal[d] = stored; isAuto[d] = false; }
    });

    const rateFields = M.DURATIONS.map((d) =>
      '<div class="field"><label>' + d + ' min' + (d !== 60 ? ' <span class="rate-auto" data-auto-tag="' + d + '"' +
        (isAuto[d] ? '' : ' hidden') + '>auto</span>' : '') + '</label><div class="input-suffix">' +
      '<input class="input input--sm" type="number" name="rate' + d + '" min="0" step="any" inputmode="decimal" value="' + (rateVal[d] || '') + '"' +
        (d !== 60 ? ' placeholder="' + M.autoRate(base0, d) + '"' : '') + '>' +
      '<span>' + U.curSymbol() + '</span></div></div>').join('');

    const body =
      '<form id="studentForm">' +
        (orig ? '<div class="insight insight--brand mb-4"><span class="insight__ico">📄</span><div class="insight__body">' +
          '<strong>Kopia ucznia: ' + U.esc(S().studentName(orig.id)) + '</strong>' +
          '<p>Skopiowaliśmy kontakt, cennik i ustawienia — bez lekcji i płatności. Wpisz imię (np. rodzeństwa) i popraw szczegóły; ' +
          'po zmianie imienia dopisek „(kopia)” zniknie z nazwiska.</p></div></div>' : '') +
        '<div class="form-grid">' +
          field('Imię', '<input class="input" name="firstName" value="' + U.esc(s.firstName) + '" required autofocus>') +
          field('Nazwisko', '<input class="input" name="lastName" value="' + U.esc(s.lastName) + '">') +
          field('Telefon', '<input class="input" name="phone" value="' + U.esc(s.phone) + '" placeholder="+48 …">') +
          field('E-mail', '<input class="input" type="email" name="email" value="' + U.esc(s.email) + '">') +
          field('Kontakt do rodzica', '<input class="input" name="parentContact" value="' + U.esc(s.parentContact) + '">') +
          field('Klasa', '<input class="input" name="grade" value="' + U.esc(s.grade) + '" placeholder="np. 8 SP">') +
          field('Szkoła', '<input class="input" name="school" value="' + U.esc(s.school) + '">') +
          field('Poziom', '<input class="input" name="level" value="' + U.esc(s.level) + '" placeholder="np. B1, matura">') +
          field('Przedmiot', '<input class="input" name="subject" value="' + U.esc(s.subject || st.subject) + '">') +
          field('Data rozpoczęcia', '<input class="input" type="date" name="startDate" value="' + s.startDate + '">') +
          field('Tryb',
            '<select class="select" name="mode">' +
              '<option value="onsite"' + (s.mode === 'onsite' ? ' selected' : '') + '>Stacjonarnie</option>' +
              '<option value="online"' + (s.mode === 'online' ? ' selected' : '') + '>Online</option></select>') +
          field('Status', selectFrom(M.STUDENT_STATUS, 'status', s.status)) +
          field('Preferowany dzień',
            '<select class="select" name="preferredDay"><option value="">—</option>' +
              U.DOW_LONG.map((n, i) => '<option value="' + i + '"' + (s.preferredDay === i ? ' selected' : '') + '>' + U.cap(n) + '</option>').join('') +
            '</select>') +
          field('Preferowana godzina', '<input class="input" type="time" name="preferredTime" value="' + U.esc(s.preferredTime) + '" step="300">') +
          '<div class="field span2"><label>Adres lub platforma online</label>' +
            '<input class="input" name="location" value="' + U.esc(s.location) + '" placeholder="np. ul. Kwiatowa 5 / Google Meet"></div>' +
          '<div class="field span2"><label class="switch"><input type="checkbox" name="group"' + (s.group ? ' checked' : '') + '>' +
            '<span class="switch__track"></span><span>Zajęcia grupowe</span></label></div>' +
        '</div>' +

        '<div class="section"><div class="section__head"><h2>Cennik ucznia</h2>' +
          '<button type="button" class="btn btn--xs" id="autoRates">Przelicz ze stawki 60 min</button></div>' +
          (rounded.length ? '<div class="insight insight--info mb-3" id="ratesRounded"><span class="insight__ico">💰</span><div class="insight__body">' +
            '<strong>Zaokrągliliśmy wyliczone stawki do pełnych 5 zł</strong><p>' + U.esc(rounded.join(' · ')) +
            '. Zapisz zmiany, żeby je zachować.</p></div></div>' : '') +
          '<div class="form-grid rate-grid">' + rateFields + '</div>' +
          '<p class="tiny dim mt-2">Stawki za 30, 45, 90 i 120 min (oznaczone „auto”) liczą się same ze stawki za 60 min ' +
            'i są zaokrąglane w górę do pełnych ' + U.PRICE_STEP + ' ' + U.curSymbol() + '. Kwota wpisana ręcznie zostaje bez zmian.</p>' +
        '</div>' +
      '</form>';

    const modal = UI().modal({
      key: 'student-form',
      title: editing ? (orig ? 'Edytuj kopię ucznia' : 'Edytuj ucznia') : 'Nowy uczeń',
      subtitle: editing ? S().studentName(id) : 'Podstawowe dane wystarczą — resztę uzupełnisz później',
      size: 'wide',
      body: body,
      footer: (editing && !orig ? '<button class="btn" data-copy-student title="Nowy uczeń z tymi samymi danymi (np. rodzeństwo)">📄 Kopiuj ucznia</button>' : '') +
        '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button>' +
        '<button class="btn btn--brand" data-save>' + (editing ? 'Zapisz zmiany' : 'Dodaj ucznia') + '</button>',
      footerSplit: editing && !orig
    });

    const form = modal.el.querySelector('#studentForm');
    function setAuto(d, on) {
      isAuto[d] = on;
      const tag = modal.el.querySelector('[data-auto-tag="' + d + '"]');
      if (tag) tag.hidden = !on;
    }
    function recalc(all) {
      const base = Number(form.elements.rate60.value) || st.defaultPrice || 80;
      OTHER.forEach(function (d) {
        const el = form.elements['rate' + d];
        el.placeholder = M.autoRate(base, d);
        if (all || isAuto[d]) { el.value = M.autoRate(base, d); setAuto(d, true); }
      });
    }
    form.addEventListener('input', function (e) {
      const m = /^rate(\d+)$/.exec(e.target.name || '');
      if (!m) return;
      const d = Number(m[1]);
      if (d === 60) recalc(false);                      // nowa stawka bazowa → przelicz tylko „auto”
      else setAuto(d, e.target.value === '');           // wpisana ręcznie — nie nadpisujemy
    });
    modal.el.querySelector('#autoRates').addEventListener('click', function () {
      recalc(true);
      const box = modal.el.querySelector('#ratesRounded');
      if (box) box.remove();
      UI().toast('Cennik przeliczony', { type: 'ok', desc: 'Kwoty zaokrąglone w górę do pełnych ' + U.PRICE_STEP + ' ' + U.curSymbol() + '. Możesz je dowolnie skorygować.' });
    });

    const copyBtn = modal.el.querySelector('[data-copy-student]');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      modal.close(true);
      F.copyStudent(id);
    });

    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      const base = Number(v.rate60) || st.defaultPrice || 80;
      const rates = {};
      M.DURATIONS.forEach((d) => {
        const val = Number(v['rate' + d]);
        rates[d] = val > 0 ? val : M.autoRate(base, d);   // puste pole = stawka wyliczona
      });
      let lastName = v.lastName;
      if (orig && v.firstName.trim() !== orig.firstName.trim() && lastName.slice(-suffix.length) === suffix) {
        lastName = lastName.slice(0, -suffix.length);
      } else if (orig && v.firstName.trim() !== orig.firstName.trim() && lastName === suffix.trim()) {
        lastName = '';
      }
      const payload = {
        firstName: v.firstName, lastName: lastName, phone: v.phone, email: v.email,
        parentContact: v.parentContact, grade: v.grade, school: v.school, level: v.level,
        subject: v.subject, startDate: v.startDate, mode: v.mode, status: v.status,
        preferredDay: v.preferredDay === '' ? null : Number(v.preferredDay),
        preferredTime: v.preferredTime, location: v.location, group: !!v.group, rates: rates
      };
      if (payload.status === 'ended' && !s.endDate) payload.endDate = U.today();
      if (payload.status !== 'ended') payload.endDate = null;

      if (editing) {
        S().repo('students').update(id, payload);
        afterSave(modal, 'Dane ucznia zapisane', orig ? S().studentName(id) : '');
      } else {
        const created = S().ops.addStudent(payload);
        modal.close();
        UI().toast('Uczeń dodany', {
          type: 'ok', desc: S().studentName(created.id),
          actionLabel: 'Dodaj lekcję',
          onAction: function () { F.lesson({ studentId: created.id }); }
        });
        window.TF.Router.go('#/students/' + created.id);
      }
    });
    return modal;
  };

  /** „📄 Kopiuj ucznia” — kopia danych (bez lekcji i płatności) i od razu jej edycja */
  F.copyStudent = function (id) {
    const orig = S().student(id);
    if (!orig) return null;
    const c = S().ops.copyStudent(id);
    if (!c) return null;
    window.TF.Router.go('#/students/' + c.id);
    const m = F.student(c.id, { copyOf: id });
    UI().toast('Utworzono kopię ucznia', {
      type: 'ok', desc: S().studentName(c.id) + ' — bez lekcji i płatności',
      actionLabel: 'Cofnij',
      onAction: function () {
        if (m && m.isOpen()) m.close();
        S().ops.deleteStudent(c.id);
        window.TF.Router.go('#/students/' + id);
        UI().toast('Kopia usunięta', { type: 'info', duration: 2200 });
      }
    });
    return m;
  };

  /* ============================================================
     PŁATNOŚĆ
     ============================================================ */
  F.payment = function (prefill) {
    prefill = prefill || {};
    const sid = prefill.studentId || '';
    const suggested = sid ? C().unpaidTotal(sid) : 0;

    const body =
      '<form id="payForm" class="form-grid">' +
        '<div class="field span2"><label>Uczeń</label>' +
          '<select class="select" name="studentId" required>' + studentOptions(sid, { emptyLabel: '— wybierz —', all: true }) + '</select>' +
          '<span class="hint" id="dueHint"></span></div>' +
        field('Kwota', '<div class="input-suffix"><input class="input" type="number" name="amount" min="0" step="any" value="' +
          (prefill.amount || suggested || '') + '" required autofocus><span>' + U.curSymbol() + '</span></div>') +
        field('Data', '<input class="input" type="date" name="date" value="' + (prefill.date || U.today()) + '">') +
        field('Metoda', selectFrom(M.PAYMENT_METHOD, 'method', prefill.method || 'transfer')) +
        field('Rozliczenie',
          '<label class="check" style="height:40px"><input type="checkbox" name="allocate" checked>' +
          '<span class="check__box">' + icon('check', 12) + '</span><span class="small">Rozlicz nieopłacone lekcje</span></label>') +
        '<div class="field span2"><label>Notatka</label><input class="input" name="note" value="' + U.esc(prefill.note || '') + '"></div>' +
        '<div class="span2" id="payPreview"></div>' +
      '</form>';

    const modal = UI().modal({
      title: 'Zarejestruj płatność',
      subtitle: 'Wpłata automatycznie pokryje najstarsze nieopłacone zajęcia',
      body: body,
      footer: '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button>' +
        '<button class="btn btn--brand" data-save>Zapisz płatność</button>'
    });

    const form = modal.el.querySelector('#payForm');
    const hint = modal.el.querySelector('#dueHint');
    const preview = modal.el.querySelector('#payPreview');

    function refresh() {
      const id = form.elements.studentId.value;
      if (!id) { hint.textContent = ''; preview.innerHTML = ''; return; }
      const due = C().unpaidTotal(id);
      const unpaid = U.sortBy(C().unpaidLessons(id), (l) => l.date);
      hint.textContent = due > 0
        ? 'Do zapłaty: ' + U.money(due) + ' (' + U.lessonsLabel(unpaid.length) + ')'
        : 'Brak zaległości — wpłata zostanie zapisana jako nadpłata.';
      if (unpaid.length) {
        preview.innerHTML = '<div class="card card--flat" style="background:var(--surface-2)"><div class="card__body--tight">' +
          '<div class="small dim mb-2">Nieopłacone zajęcia</div>' +
          unpaid.slice(0, 6).map((l) => '<div class="row-between small" style="padding:3px 0">' +
            '<span>' + U.fmtDate(l.date) + ' · ' + U.fmtTime(l.start) + '</span>' +
            '<strong class="mono">' + U.money(C().lessonValue(l)) + '</strong></div>').join('') +
          (unpaid.length > 6 ? '<div class="tiny dim mt-2">…i ' + (unpaid.length - 6) + ' więcej</div>' : '') +
          '</div></div>';
      } else preview.innerHTML = '';
    }
    form.addEventListener('change', function (e) {
      if (e.target.name === 'studentId') {
        refresh();
        const due = C().unpaidTotal(e.target.value);
        if (due > 0) form.elements.amount.value = due;
      }
    });
    refresh();

    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      if (!v.studentId) { UI().toast('Wybierz ucznia', { type: 'warn' }); return; }
      const p = S().ops.addPayment({
        studentId: v.studentId, amount: Number(v.amount) || 0, date: v.date,
        method: v.method, note: v.note
      }, v.allocate);
      afterSave(modal, 'Płatność zapisana',
        U.money(p.amount) + ' · ' + S().studentName(v.studentId) +
        (p.lessonIds.length ? ' · rozliczono ' + U.lessonsLabel(p.lessonIds.length) : ''));
    });
    return modal;
  };

  /* ============================================================
     PAKIET LEKCJI
     ============================================================ */
  F.package = function (prefill) {
    prefill = prefill || {};
    const body =
      '<form id="pkgForm" class="form-grid">' +
        '<div class="field span2"><label>Uczeń</label><select class="select" name="studentId" required>' +
          studentOptions(prefill.studentId, { emptyLabel: '— wybierz —' }) + '</select></div>' +
        field('Liczba lekcji', '<input class="input" type="number" name="lessonsCount" min="2" max="60" value="10" required autofocus>') +
        field('Cena za lekcję', '<div class="input-suffix"><input class="input" type="number" name="pricePerLesson" min="0" step="any" value="' +
          (S().settings().defaultPrice || 80) + '" required><span>' + U.curSymbol() + '</span></div>') +
        field('Data zakupu', '<input class="input" type="date" name="purchasedDate" value="' + U.today() + '">') +
        field('Opłacony', '<label class="check" style="height:40px"><input type="checkbox" name="paid" checked>' +
          '<span class="check__box">' + icon('check', 12) + '</span><span class="small">Zapisz od razu jako wpłatę</span></label>') +
        '<div class="span2"><div class="calc-result"><div class="calc-result__big" id="pkgTotal">—</div>' +
          '<div class="calc-result__sub">wartość pakietu</div></div></div>' +
      '</form>';

    const modal = UI().modal({
      title: 'Sprzedaj pakiet lekcji', size: 'narrow', body: body,
      footer: '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button><button class="btn btn--brand" data-save>Zapisz pakiet</button>'
    });
    const form = modal.el.querySelector('#pkgForm');
    const total = modal.el.querySelector('#pkgTotal');
    function calc() {
      const n = Number(form.elements.lessonsCount.value) || 0;
      const p = Number(form.elements.pricePerLesson.value) || 0;
      total.textContent = U.money(n * p);
    }
    form.addEventListener('input', calc);
    calc();

    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      if (!v.studentId) { UI().toast('Wybierz ucznia', { type: 'warn' }); return; }
      S().ops.addPackage({
        studentId: v.studentId, lessonsCount: Number(v.lessonsCount),
        pricePerLesson: Number(v.pricePerLesson), purchasedDate: v.purchasedDate, paid: !!v.paid
      });
      afterSave(modal, 'Pakiet zapisany', v.lessonsCount + ' lekcji dla ' + S().studentName(v.studentId));
    });
    return modal;
  };

  /* ============================================================
     WYDATEK
     ============================================================ */
  F.expense = function (id) {
    const editing = !!id;
    const e = editing ? S().repo('expenses').byId(id) : M.Expense({});
    const body =
      '<form id="expForm" class="form-grid">' +
        field('Kwota', '<div class="input-suffix"><input class="input" type="number" name="amount" min="0" step="1" value="' +
          (e.amount || '') + '" required autofocus><span>' + U.curSymbol() + '</span></div>') +
        field('Data', '<input class="input" type="date" name="date" value="' + e.date + '">') +
        '<div class="field span2"><label>Kategoria</label>' +
          '<select class="select" name="category">' + Object.keys(M.EXPENSE_CATEGORY).map((k) =>
            '<option value="' + k + '"' + (k === e.category ? ' selected' : '') + '>' +
            M.EXPENSE_CATEGORY[k].icon + '  ' + U.esc(M.EXPENSE_CATEGORY[k].label) + '</option>').join('') + '</select></div>' +
        '<div class="field span2"><label>Opis</label><input class="input" name="description" value="' + U.esc(e.description) + '" placeholder="np. Podręcznik B2"></div>' +
      '</form>';

    const modal = UI().modal({
      title: editing ? 'Edytuj wydatek' : 'Dodaj wydatek', size: 'narrow', body: body,
      footer: (editing ? '<button class="btn btn--danger-soft" data-del>' + icon('trash', 15) + '</button>' : '') +
        '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button><button class="btn btn--brand" data-save>Zapisz</button>'
    });
    const form = modal.el.querySelector('#expForm');
    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      if (editing) S().repo('expenses').update(id, { amount: Number(v.amount), date: v.date, category: v.category, description: v.description });
      else S().repo('expenses').add(M.Expense(v));
      afterSave(modal, 'Wydatek zapisany');
    });
    const del = modal.el.querySelector('[data-del]');
    if (del) del.addEventListener('click', function () {
      UI().confirm({ title: 'Usunąć wydatek?', text: e.description || U.money(e.amount) }).then((ok) => {
        if (!ok) return;
        S().repo('expenses').remove(id);
        afterSave(modal, 'Wydatek usunięty');
      });
    });
    return modal;
  };

  /* ============================================================
     ZADANIE
     ============================================================ */
  F.task = function (id, prefill) {
    const editing = !!id;
    const t = editing ? S().repo('tasks').byId(id) : M.Task(prefill || {});
    const body =
      '<form id="taskForm" class="form-grid">' +
        '<div class="field span2"><label>Zadanie</label><input class="input" name="title" value="' + U.esc(t.title) +
          '" placeholder="np. Sprawdzić pracę Anny" required autofocus></div>' +
        field('Priorytet', selectFrom(M.PRIORITY, 'priority', t.priority)) +
        field('Termin', '<input class="input" type="date" name="due" value="' + (t.due || '') + '">') +
        '<div class="field span2"><label>Powiązany uczeń</label><select class="select" name="studentId">' +
          studentOptions(t.studentId, { emptyLabel: '— brak —' }) + '</select></div>' +
      '</form>';
    const modal = UI().modal({
      title: editing ? 'Edytuj zadanie' : 'Nowe zadanie', size: 'narrow', body: body,
      footer: (editing ? '<button class="btn btn--danger-soft" data-del>' + icon('trash', 15) + '</button>' : '') +
        '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button><button class="btn btn--brand" data-save>Zapisz</button>'
    });
    const form = modal.el.querySelector('#taskForm');
    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      const payload = { title: v.title, priority: v.priority, due: v.due || null, studentId: v.studentId || null };
      if (editing) S().repo('tasks').update(id, payload);
      else S().repo('tasks').add(M.Task(payload));
      afterSave(modal, 'Zadanie zapisane');
    });
    const del = modal.el.querySelector('[data-del]');
    if (del) del.addEventListener('click', function () {
      UI().confirm({ title: 'Usunąć zadanie?', text: t.title }).then((ok) => {
        if (!ok) return;
        S().repo('tasks').remove(id);
        afterSave(modal, 'Zadanie usunięte');
      });
    });
    return modal;
  };

  /* ============================================================
     NOTATKA
     ============================================================ */
  F.note = function (prefill, id) {
    const editing = !!id;
    const n = editing ? S().repo('notes').byId(id) : M.Note(prefill || {});
    const body =
      '<form id="noteForm">' +
        '<div class="form-grid">' +
          '<div class="field span2"><label>Uczeń</label><select class="select" name="studentId">' +
            studentOptions(n.studentId, { emptyLabel: '— notatka ogólna —', all: true }) + '</select></div>' +
          field('Data', '<input class="input" type="date" name="date" value="' + n.date + '">') +
          field('Typ',
            '<select class="select" name="kind">' +
              '<option value="private"' + (n.kind === 'private' ? ' selected' : '') + '>Prywatna</option>' +
              '<option value="progress"' + (n.kind === 'progress' ? ' selected' : '') + '>Postęp</option>' +
              '<option value="lesson"' + (n.kind === 'lesson' ? ' selected' : '') + '>Z lekcji</option></select>') +
        '</div>' +
        '<div class="field mt-4"><label>Treść</label><textarea class="textarea" name="text" style="min-height:130px" required autofocus placeholder="Np. Uczeń dobrze radzi sobie z czytaniem, ale nadal ma problem z Present Perfect.">' + U.esc(n.text) + '</textarea></div>' +
      '</form>';
    const modal = UI().modal({
      title: editing ? 'Edytuj notatkę' : 'Nowa notatka', body: body,
      footer: (editing ? '<button class="btn btn--danger-soft" data-del>' + icon('trash', 15) + '</button>' : '') +
        '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button><button class="btn btn--brand" data-save>Zapisz</button>'
    });
    const form = modal.el.querySelector('#noteForm');
    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      const payload = { studentId: v.studentId || null, date: v.date, kind: v.kind, text: v.text };
      if (editing) S().repo('notes').update(id, payload);
      else S().repo('notes').add(M.Note(payload));
      afterSave(modal, 'Notatka zapisana');
    });
    const del = modal.el.querySelector('[data-del]');
    if (del) del.addEventListener('click', function () {
      UI().confirm({ title: 'Usunąć notatkę?', text: (n.text || '').slice(0, 90) }).then((ok) => {
        if (!ok) return;
        S().repo('notes').remove(id);
        afterSave(modal, 'Notatka usunięta');
      });
    });
    return modal;
  };

  /* ============================================================
     MATERIAŁ
     ============================================================ */
  F.material = function (prefill, id) {
    const editing = !!id;
    const m = editing ? S().repo('materials').byId(id) : M.Material(prefill || {});
    const body =
      '<form id="matForm" class="form-grid">' +
        '<div class="field span2"><label>Tytuł</label><input class="input" name="title" value="' + U.esc(m.title) +
          '" placeholder="np. Present Perfect — karta ćwiczeń" required autofocus></div>' +
        field('Typ', selectFrom(M.MATERIAL_TYPE, 'type', m.type)) +
        field('Data', '<input class="input" type="date" name="date" value="' + m.date + '">') +
        '<div class="field span2"><label>Uczeń</label><select class="select" name="studentId">' +
          studentOptions(m.studentId, { emptyLabel: '— materiał wspólny —' }) + '</select></div>' +
        '<div class="field span2"><label>Link (opcjonalnie)</label><input class="input" name="url" value="' + U.esc(m.url) + '" placeholder="https://…"></div>' +
        '<div class="field span2"><label>Notatka</label><textarea class="textarea" name="note">' + U.esc(m.note) + '</textarea></div>' +
      '</form>';
    const modal = UI().modal({
      title: editing ? 'Edytuj materiał' : 'Dodaj materiał', body: body,
      footer: (editing ? '<button class="btn btn--danger-soft" data-del>' + icon('trash', 15) + '</button>' : '') +
        '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button><button class="btn btn--brand" data-save>Zapisz</button>'
    });
    const form = modal.el.querySelector('#matForm');
    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      const payload = { title: v.title, type: v.type, date: v.date, studentId: v.studentId || null, url: v.url, note: v.note };
      if (editing) S().repo('materials').update(id, payload);
      else S().repo('materials').add(M.Material(payload));
      afterSave(modal, 'Materiał zapisany');
    });
    const del = modal.el.querySelector('[data-del]');
    if (del) del.addEventListener('click', function () {
      UI().confirm({ title: 'Usunąć materiał?', text: m.title }).then((ok) => {
        if (!ok) return;
        S().repo('materials').remove(id);
        afterSave(modal, 'Materiał usunięty');
      });
    });
    return modal;
  };

  /* ============================================================
     CEL UCZNIA
     ============================================================ */
  F.goal = function (studentId, id) {
    const editing = !!id;
    const g = editing ? S().repo('goals').byId(id) : M.Goal({ studentId: studentId });
    const body =
      '<form id="goalForm" class="form-grid">' +
        '<div class="field span2"><label>Cel</label><input class="input" name="title" value="' + U.esc(g.title) +
          '" placeholder="np. Egzamin ósmoklasisty — 80%" required autofocus></div>' +
        '<div class="field span2"><label>Postęp: <b id="gpv">' + g.progress + '%</b></label>' +
          '<input type="range" name="progress" min="0" max="100" step="5" value="' + g.progress + '" style="width:100%"></div>' +
        field('Termin', '<input class="input" type="date" name="deadline" value="' + (g.deadline || '') + '">') +
        field('Ukończony', '<label class="check" style="height:40px"><input type="checkbox" name="done"' + (g.done ? ' checked' : '') + '>' +
          '<span class="check__box">' + icon('check', 12) + '</span><span class="small">Cel osiągnięty</span></label>') +
      '</form>';
    const modal = UI().modal({
      title: editing ? 'Edytuj cel' : 'Nowy cel', size: 'narrow', body: body,
      footer: (editing ? '<button class="btn btn--danger-soft" data-del>' + icon('trash', 15) + '</button>' : '') +
        '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button><button class="btn btn--brand" data-save>Zapisz</button>'
    });
    const form = modal.el.querySelector('#goalForm');
    form.addEventListener('input', function (e) {
      if (e.target.name === 'progress') modal.el.querySelector('#gpv').textContent = e.target.value + '%';
    });
    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      const payload = { title: v.title, progress: Number(v.progress), deadline: v.deadline || null, done: !!v.done, studentId: g.studentId };
      if (editing) S().repo('goals').update(id, payload);
      else S().repo('goals').add(M.Goal(payload));
      afterSave(modal, 'Cel zapisany');
    });
    const del = modal.el.querySelector('[data-del]');
    if (del) del.addEventListener('click', function () {
      UI().confirm({ title: 'Usunąć cel?', text: g.title }).then((ok) => {
        if (!ok) return;
        S().repo('goals').remove(id);
        afterSave(modal, 'Cel usunięty');
      });
    });
    return modal;
  };

  /* ============================================================
     PRACA DOMOWA
     ============================================================ */
  F.homework = function (studentId, id) {
    const editing = !!id;
    const h = editing ? S().repo('homework').byId(id) : M.Homework({ studentId: studentId, due: U.addDays(U.today(), 7) });
    const body =
      '<form id="hwForm" class="form-grid">' +
        '<div class="field span2"><label>Zadanie domowe</label><input class="input" name="title" value="' + U.esc(h.title) +
          '" placeholder="np. ćw. 3–5 s. 41" required autofocus></div>' +
        field('Termin', '<input class="input" type="date" name="due" value="' + (h.due || '') + '">') +
        field('Status', selectFrom(M.HOMEWORK_STATUS, 'status', h.status)) +
        '<div class="field span2"><label>Uczeń</label><select class="select" name="studentId" required>' +
          studentOptions(h.studentId, { emptyLabel: '— wybierz —' }) + '</select></div>' +
      '</form>';
    const modal = UI().modal({
      title: editing ? 'Edytuj pracę domową' : 'Zadaj pracę domową', size: 'narrow', body: body,
      footer: (editing ? '<button class="btn btn--danger-soft" data-del>' + icon('trash', 15) + '</button>' : '') +
        '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button><button class="btn btn--brand" data-save>Zapisz</button>'
    });
    const form = modal.el.querySelector('#hwForm');
    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      const payload = { title: v.title, due: v.due || null, status: v.status, studentId: v.studentId };
      if (editing) S().repo('homework').update(id, payload);
      else S().repo('homework').add(M.Homework(payload));
      afterSave(modal, 'Praca domowa zapisana');
    });
    const del = modal.el.querySelector('[data-del]');
    if (del) del.addEventListener('click', function () {
      UI().confirm({ title: 'Usunąć pracę domową?', text: h.title }).then((ok) => {
        if (!ok) return;
        S().repo('homework').remove(id);
        afterSave(modal, 'Usunięto');
      });
    });
    return modal;
  };

  /* ============================================================
     PODSUMOWANIE PO LEKCJI
     ============================================================ */
  F.lessonSummary = function (lessonId) {
    const l = S().repo('lessons').byId(lessonId);
    if (!l) return;
    const s = S().student(l.studentId);
    const sum = l.summary || {};
    const body =
      '<form id="sumForm">' +
        '<div class="field"><label>Temat lekcji</label><input class="input" name="topic" value="' + U.esc(sum.topic || l.topic || '') +
          '" placeholder="np. Present Perfect vs Past Simple" autofocus></div>' +
        '<div class="field mt-4"><label>Co zrobiliście?</label><textarea class="textarea" name="done" placeholder="Przerobiony materiał, ćwiczenia…">' + U.esc(sum.done || '') + '</textarea></div>' +
        '<div class="form-grid mt-4">' +
          '<div class="field"><label>Jak uczeń sobie radził?</label><input class="input" name="performance" value="' + U.esc(sum.performance || '') + '"></div>' +
          '<div class="field"><label>Co poprawić?</label><input class="input" name="improve" value="' + U.esc(sum.improve || '') + '"></div>' +
          '<div class="field"><label>Praca domowa</label><input class="input" name="homework" value="' + U.esc(sum.homework || '') + '"></div>' +
          '<div class="field"><label>Co następnym razem?</label><input class="input" name="next" value="' + U.esc(sum.next || '') + '"></div>' +
        '</div>' +
        '<div class="mt-4"><label class="check"><input type="checkbox" name="markPaid"' + (l.paymentStatus === 'paid' ? ' checked disabled' : '') + '>' +
          '<span class="check__box">' + icon('check', 12) + '</span>' +
          '<span class="small">Oznacz jako opłacone (' + U.money(l.price) + ')</span></label></div>' +
      '</form>';

    const modal = UI().modal({
      title: 'Zakończ lekcję',
      subtitle: (s ? S().studentName(s.id) + ' · ' : '') + U.fmtDate(l.date, 'dow') + ', ' + U.fmtTime(l.start),
      body: body,
      footer: '<button class="btn" data-modal-close>Pomiń</button><div class="grow"></div>' +
        '<button class="btn btn--ok" data-save>' + icon('check', 15) + ' Zapisz i zakończ</button>'
    });
    const form = modal.el.querySelector('#sumForm');
    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      const v = read(form);
      S().ops.setStatus(l.id, 'done');
      S().ops.saveLessonSummary(l.id, {
        topic: v.topic, done: v.done, performance: v.performance,
        improve: v.improve, homework: v.homework, next: v.next
      });
      if (v.markPaid && l.paymentStatus !== 'paid') S().ops.payLesson(l.id, 'cash');
      afterSave(modal, 'Lekcja zakończona', v.topic || 'Zapisano notatkę i postęp');
    });
    return modal;
  };

  /* ============================================================
     ODWOŁANIE LEKCJI (z regułą płatności)
     ============================================================ */
  F.cancelLesson = function (lessonId) {
    const l = S().repo('lessons').byId(lessonId);
    if (!l) return;
    const pol = S().settings().cancellationPolicy || {};
    const suggested = S().ops.cancellationChargeable(l);
    const mins = C().minutesUntil(l);

    const body =
      '<form id="cancForm">' +
        '<div class="field"><label>Kto odwołuje?</label>' +
          '<div class="segmented" id="whoSeg" style="width:100%">' +
            '<button type="button" class="is-active" data-who="cancelled_student" style="flex:1">Uczeń</button>' +
            '<button type="button" data-who="cancelled_tutor" style="flex:1">Ja</button>' +
            '<button type="button" data-who="rescheduled" style="flex:1">Przekładam</button>' +
          '</div><input type="hidden" name="who" value="cancelled_student"></div>' +

        '<div id="policyBox" class="mt-4"></div>' +

        '<div class="mt-4" id="chargeWrap"><label class="check"><input type="checkbox" name="chargeable"' + (suggested ? ' checked' : '') + '>' +
          '<span class="check__box">' + icon('check', 12) + '</span>' +
          '<span class="small">Naliczyć opłatę ' + U.money(l.price) + '</span></label></div>' +

        '<div class="field mt-4" id="newDateWrap" hidden><label>Nowy termin</label>' +
          '<div class="row gap-2"><input class="input" type="date" name="newDate" value="' + U.addDays(l.date, 7) + '">' +
          '<input class="input" type="time" name="newStart" value="' + l.start + '" step="300"></div></div>' +

        '<div class="field mt-4"><label>Powód (opcjonalnie)</label><input class="input" name="reason" placeholder="np. choroba"></div>' +
      '</form>';

    const modal = UI().modal({
      title: 'Odwołaj zajęcia', size: 'narrow',
      subtitle: S().studentName(l.studentId) + ' · ' + U.fmtDate(l.date, 'dow') + ', ' + U.fmtTime(l.start),
      body: body,
      footer: '<div class="grow"></div><button class="btn" data-modal-close>Wróć</button>' +
        '<button class="btn btn--danger" data-save>Potwierdź</button>'
    });

    const form = modal.el.querySelector('#cancForm');
    const seg = modal.el.querySelector('#whoSeg');
    const policyBox = modal.el.querySelector('#policyBox');
    const chargeWrap = modal.el.querySelector('#chargeWrap');
    const newDateWrap = modal.el.querySelector('#newDateWrap');

    function renderPolicy() {
      const who = form.elements.who.value;
      if (who === 'rescheduled') {
        policyBox.innerHTML = '<div class="insight insight--info"><span class="insight__ico">🔄</span><div class="insight__body">' +
          '<strong>Przełożenie</strong><p>Lekcja nie zostanie naliczona — utworzymy nowy termin.</p></div></div>';
        chargeWrap.hidden = true; newDateWrap.hidden = false;
        return;
      }
      newDateWrap.hidden = true; chargeWrap.hidden = false;
      if (who === 'cancelled_tutor') {
        policyBox.innerHTML = '<div class="insight insight--info"><span class="insight__ico">i</span><div class="insight__body">' +
          '<strong>Odwołanie z Twojej strony</strong><p>Domyślnie bez opłaty.</p></div></div>';
        form.elements.chargeable.checked = false;
        return;
      }
      const hrs = pol.hours || 24;
      if (suggested) {
        policyBox.innerHTML = '<div class="insight insight--warn"><span class="insight__ico">!</span><div class="insight__body">' +
          '<strong>Zajęcia odwołane z wyprzedzeniem krótszym niż ' + hrs + ' h</strong>' +
          '<p>Zgodnie z Twoją zasadą lekcja jest płatna' + (mins > 0 ? ' (zostało ' + U.relTime(mins) + ')' : '') + '.</p></div></div>';
      } else {
        policyBox.innerHTML = '<div class="insight insight--ok"><span class="insight__ico">✓</span><div class="insight__body">' +
          '<strong>Odwołanie w terminie</strong><p>Powyżej ' + hrs + ' h przed zajęciami — bez opłaty.</p></div></div>';
      }
      form.elements.chargeable.checked = suggested;
    }
    seg.addEventListener('click', function (e) {
      const b = e.target.closest('[data-who]');
      if (!b) return;
      Array.prototype.forEach.call(seg.children, (x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      form.elements.who.value = b.getAttribute('data-who');
      renderPolicy();
    });
    renderPolicy();

    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      const v = read(form);
      if (v.who === 'rescheduled') {
        S().ops.setStatus(l.id, 'rescheduled', { note: v.reason ? 'Przełożona: ' + v.reason : l.note });
        S().ops.addLesson({
          studentId: l.studentId, date: v.newDate, start: v.newStart, duration: l.duration,
          subject: l.subject, topic: l.topic, price: l.price, mode: l.mode, note: 'Przełożone z ' + U.fmtDate(l.date)
        });
        afterSave(modal, 'Lekcja przełożona', 'Nowy termin: ' + U.fmtDate(v.newDate, 'dow') + ', ' + U.fmtTime(v.newStart));
      } else {
        S().ops.setStatus(l.id, v.who, {
          chargeable: !!v.chargeable,
          note: v.reason ? 'Odwołane: ' + v.reason : l.note
        });
        afterSave(modal, 'Zajęcia odwołane', v.chargeable ? 'Naliczono opłatę ' + U.money(l.price) : 'Bez opłaty');
      }
    });
    return modal;
  };

  /* ============================================================
     PRZEŁOŻENIE (szybkie)
     ============================================================ */
  F.reschedule = function (lessonId) {
    const l = S().repo('lessons').byId(lessonId);
    if (!l) return;
    const body =
      '<form id="rsForm" class="form-grid">' +
        field('Nowa data', '<input class="input" type="date" name="date" value="' + U.addDays(l.date, 7) + '" required autofocus>') +
        field('Nowa godzina', '<input class="input" type="time" name="start" value="' + l.start + '" step="300" required>') +
        '<div class="span2" id="rsConflict"></div>' +
      '</form>';
    const modal = UI().modal({
      title: 'Przełóż zajęcia', size: 'narrow',
      subtitle: S().studentName(l.studentId) + ' · obecnie ' + U.fmtDate(l.date, 'dow') + ', ' + U.fmtTime(l.start),
      body: body,
      footer: '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button><button class="btn btn--brand" data-save>Przenieś</button>'
    });
    const form = modal.el.querySelector('#rsForm');
    const box = modal.el.querySelector('#rsConflict');
    function check() {
      const clash = S().ops.findConflicts({ date: form.elements.date.value, start: form.elements.start.value, duration: l.duration }, l.id);
      box.innerHTML = clash.length
        ? '<div class="insight insight--bad"><span class="insight__ico">!</span><div class="insight__body"><strong>Ta godzina jest już zajęta</strong><p>' +
          clash.map((x) => U.fmtTime(x.start) + ' · ' + U.esc(S().studentName(x.studentId))).join('<br>') + '</p></div></div>'
        : '';
    }
    form.addEventListener('change', check);
    check();
    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      S().ops.moveLesson(l.id, v.date, v.start);
      afterSave(modal, 'Zajęcia przeniesione', U.fmtDate(v.date, 'dow') + ', ' + U.fmtTime(v.start));
    });
    return modal;
  };

  /* ============================================================
     SZYBKIE DODAWANIE
     ============================================================ */
  F.quickAdd = function (anchorEl) {
    const items = [
      { label: 'Dodaj lekcję', icon: 'calendar', onClick: function () { F.lesson({}); } },
      { label: 'Dodaj ucznia', icon: 'users', onClick: function () { F.student(); } },
      { label: 'Dodaj płatność', icon: 'wallet', onClick: function () { F.payment(); } },
      { sep: true },
      { label: 'Dodaj zadanie', icon: 'check', onClick: function () { F.task(); } },
      { label: 'Dodaj notatkę', icon: 'note', onClick: function () { F.note(); } },
      { label: 'Dodaj materiał', icon: 'book', onClick: function () { F.material(); } },
      { sep: true },
      { label: 'Dodaj wydatek', icon: 'receipt', onClick: function () { F.expense(); } },
      { label: 'Sprzedaj pakiet', icon: 'card', onClick: function () { F.package(); } }
    ];
    if (anchorEl) return UI().menu(anchorEl, items);

    const body = '<div class="grid grid-2 gap-3">' + items.filter((i) => !i.sep).map((it, i) =>
      '<button class="btn btn--block" data-qa="' + i + '" style="height:64px;justify-content:flex-start;gap:12px">' +
      '<span class="kpi__icon">' + icon(it.icon, 16) + '</span>' + U.esc(it.label) + '</button>').join('') + '</div>';
    const modal = UI().modal({ title: 'Co chcesz dodać?', size: 'narrow', body: body, noAutofocus: true });
    const real = items.filter((i) => !i.sep);
    modal.el.addEventListener('click', function (e) {
      const b = e.target.closest('[data-qa]');
      if (!b) return;
      modal.close();
      real[+b.getAttribute('data-qa')].onClick();
    });
    return modal;
  };

  F.read = read;
  F.studentOptions = studentOptions;
  window.TF.Forms = F;
})();
