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
     LEKCJA — dodawanie i edycja
     ============================================================ */
  F.lesson = function (draft) {
    draft = draft || {};
    const editing = !!draft.id;
    const lesson = editing ? S().repo('lessons').byId(draft.id) : null;
    const st = S().settings();
    const students = S().repo('students').all();

    if (!students.length) {
      UI().toast('Najpierw dodaj ucznia', { type: 'warn', desc: 'Lekcję można przypisać tylko do istniejącego ucznia.' });
      return F.student();
    }

    const d = editing ? lesson : Object.assign({
      studentId: draft.studentId || '',
      date: draft.date || U.today(),
      start: draft.start || (st.workHours && st.workHours.start) || '16:00',
      duration: draft.duration || st.defaultDuration || 60,
      mode: draft.mode || st.defaultMode,
      subject: draft.subject || '',
      topic: '',
      price: draft.price !== undefined ? draft.price : null,
      paymentStatus: 'unpaid',
      note: ''
    }, {});

    const durButtons = M.DURATIONS.map((v) =>
      '<button type="button" class="' + (v === d.duration ? 'is-active' : '') + '" data-dur="' + v + '">' + v + '</button>').join('') +
      '<button type="button" class="' + (M.DURATIONS.indexOf(d.duration) === -1 ? 'is-active' : '') + '" data-dur="custom">Własny</button>';

    /* Lekcja z serii — pozwól zdecydować, czego dotyczy zmiana */
    const series = editing ? S().ops.seriesInfo(d.id) : null;
    const scopeBlock = series
      ? '<div class="field span2 scope-box">' +
          '<label>' + icon('refresh', 15) + ' Te zajęcia należą do serii ' + U.esc(series.rhythm) +
            ' (' + U.lessonsLabel(series.total) + ', ' +
            U.fmtDate(series.first.date, 'medium') + ' – ' + U.fmtDate(series.last.date, 'medium') + ')</label>' +
          '<div class="segmented scope-seg" style="width:100%">' +
            '<button type="button" class="is-active" data-scope="one" style="flex:1">Tylko te zajęcia</button>' +
            '<button type="button" data-scope="future" style="flex:1">Te i następne (' + series.futureCount + ')</button>' +
            '<button type="button" data-scope="all" style="flex:1">Całą serię (' + series.total + ')</button>' +
          '</div>' +
          '<input type="hidden" name="scope" value="one">' +
          '<span class="hint" id="scopeHint">Zmiany zapiszą się tylko dla tego jednego terminu.</span>' +
        '</div>'
      : '';

    const body =
      '<form id="lessonForm" class="form-grid">' +
        scopeBlock +
        '<div class="field span2"><label>Uczeń</label>' +
          '<select class="select" name="studentId" required>' + studentOptions(d.studentId, { emptyLabel: '— wybierz ucznia —' }) + '</select></div>' +

        field('Data', '<input class="input" type="date" name="date" value="' + d.date + '" required>') +
        field('Godzina rozpoczęcia', '<input class="input" type="time" name="start" value="' + d.start + '" step="300" required>') +

        '<div class="field span2"><label>Czas trwania</label>' +
          '<div class="segmented" id="durSeg">' + durButtons + '</div>' +
          '<div id="durCustomWrap" ' + (M.DURATIONS.indexOf(d.duration) === -1 ? '' : 'hidden') + ' style="margin-top:8px">' +
            '<div class="input-suffix"><input class="input" type="number" name="duration" min="15" max="300" step="5" value="' + d.duration + '"><span>min</span></div>' +
          '</div>' +
          '<input type="hidden" name="durationPreset" value="' + d.duration + '">' +
        '</div>' +

        field('Typ zajęć',
          '<select class="select" name="mode">' +
            '<option value="onsite"' + (d.mode === 'onsite' ? ' selected' : '') + '>Stacjonarne</option>' +
            '<option value="online"' + (d.mode === 'online' ? ' selected' : '') + '>Online</option></select>') +
        field('Przedmiot', '<input class="input" name="subject" value="' + U.esc(d.subject || '') + '" placeholder="np. Angielski">') +

        field('Cena', '<div class="input-suffix"><input class="input" type="number" name="price" min="0" step="5" value="' +
          (d.price === null ? '' : d.price) + '" required><span>' + U.curSymbol() + '</span></div>', 'Podstawia się automatycznie ze stawki ucznia') +
        field('Status płatności', selectFrom(
          { unpaid: M.PAYMENT_STATUS.unpaid, paid: M.PAYMENT_STATUS.paid, package: M.PAYMENT_STATUS.package, free: M.PAYMENT_STATUS.free },
          'paymentStatus', d.paymentStatus)) +

        field('Temat zajęć', '<input class="input" name="topic" value="' + U.esc(d.topic || '') + '" placeholder="np. Present Perfect">') +
        (editing ? field('Status zajęć', selectFrom(M.LESSON_STATUS, 'status', lesson.status)) : field('Powtarzalność',
          '<select class="select" name="recurrence">' +
            '<option value="once">Jednorazowo</option>' +
            '<option value="weekly">Co tydzień</option>' +
            '<option value="biweekly">Co 2 tygodnie</option>' +
            '<option value="custom">Własny harmonogram</option></select>')) +

        (editing ? '' :
          '<div class="field span2" id="recurWrap" hidden>' +
            '<label>Liczba powtórzeń</label>' +
            '<div class="row gap-3"><input class="input" type="number" name="recurCount" min="2" max="52" value="8" style="max-width:120px">' +
            '<span class="small dim" id="recurHint"></span></div>' +
            '<div id="recurDays" class="mt-3" hidden><label class="label">Dni tygodnia</label>' +
              '<div class="day-toggles">' + U.DOW_SHORT.map((n, i) =>
                '<button type="button" class="day-toggle" data-rday="' + i + '">' + n + '</button>').join('') + '</div></div>' +
          '</div>') +

        '<div class="field span2"><label>Notatka</label>' +
          '<textarea class="textarea" name="note" placeholder="Np. przynieść arkusz, sprawdzić pracę domową…">' + U.esc(d.note || '') + '</textarea></div>' +

        '<div class="span2" id="conflictBox"></div>' +
      '</form>';

    const modal = UI().modal({
      title: editing ? 'Edytuj zajęcia' : 'Dodaj zajęcia',
      subtitle: editing
        ? U.fmtDate(d.date, 'dow') + (series ? ' · część serii ' + series.rhythm : '')
        : 'Kliknij wolne okno w kalendarzu, aby dodać jeszcze szybciej',
      size: 'wide',
      body: body,
      footer:
        (editing ? '<button class="btn btn--danger-soft" data-del-lesson>' + icon('trash', 15) + ' Usuń</button>' : '') +
        '<div class="grow"></div>' +
        '<button class="btn" data-modal-close>Anuluj</button>' +
        '<button class="btn btn--brand" data-save-lesson>' + (editing ? 'Zapisz zmiany' : 'Dodaj zajęcia') + '</button>',
      footerSplit: editing
    });

    const form = modal.el.querySelector('#lessonForm');
    const durSeg = modal.el.querySelector('#durSeg');
    const durCustom = modal.el.querySelector('#durCustomWrap');
    const conflictBox = modal.el.querySelector('#conflictBox');
    const recurSel = form.elements.recurrence;
    const recurWrap = modal.el.querySelector('#recurWrap');
    const recurDays = modal.el.querySelector('#recurDays');
    let priceTouched = editing;
    const chosenDays = [];

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
    /** Podgląd całej serii: ile terminów, do kiedy, ile kolizji */
    function seriesPreview(drafted) {
      if (editing || !recurSel || recurSel.value === 'once') return '';
      const rule = {
        type: recurSel.value,
        count: Number(form.elements.recurCount && form.elements.recurCount.value) || 0,
        days: chosenDays.length ? chosenDays : [U.dow(drafted.date)]
      };
      if (rule.count < 1) return '';
      const rows = S().ops.recurringConflicts(drafted, rule);
      const blocked = rows.filter((r) => r.blocked);
      const okRows = rows.filter((r) => !r.blocked);
      const last = rows[rows.length - 1];

      let html = '<div class="insight insight--' + (blocked.length ? 'warn' : 'info') + ' mt-2">' +
        '<span class="insight__ico">' + icon('calendar', 15) + '</span><div class="insight__body">' +
        '<strong>Seria: ' + U.lessonsLabel(rows.length) + ' do ' + U.fmtDate(last.date, 'medium') + '</strong>' +
        '<p>' + rows.slice(0, 4).map(function (r) {
          return (r.blocked ? '<s>' : '') + U.fmtDate(r.date, 'short') + (r.blocked ? '</s>' : '');
        }).join(', ') + (rows.length > 4 ? ', …' : '') + '</p>';
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
    function updateRecurHint() {
      const hint = modal.el.querySelector('#recurHint');
      if (!hint) return;
      const type = recurSel ? recurSel.value : 'once';
      const n = Number(form.elements.recurCount && form.elements.recurCount.value) || 0;
      if (type === 'weekly') hint.textContent = 'co tydzień, ' + U.lessonsLabel(n);
      else if (type === 'biweekly') hint.textContent = 'co 2 tygodnie, ' + U.lessonsLabel(n);
      else hint.textContent = U.lessonsLabel(n) + ' w wybranych dniach';
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
      if (e.target.name === 'recurrence' && recurWrap) {
        recurWrap.hidden = e.target.value === 'once';
        if (recurDays) recurDays.hidden = e.target.value !== 'custom';
        updateRecurHint();
      }
      checkConflicts();
    });
    form.addEventListener('input', function (e) {
      if (e.target.name === 'recurCount') { updateRecurHint(); checkConflicts(); }
    });
    if (recurDays) {
      recurDays.addEventListener('click', function (e) {
        const b = e.target.closest('[data-rday]');
        if (!b) return;
        const v = Number(b.getAttribute('data-rday'));
        const i = chosenDays.indexOf(v);
        if (i === -1) chosenDays.push(v); else chosenDays.splice(i, 1);
        b.classList.toggle('is-on');
        updateRecurHint();
        checkConflicts();
      });
    }

    /* --- przełącznik zakresu edycji serii --- */
    const scopeSeg = modal.el.querySelector('.scope-seg');
    if (scopeSeg && series) {
      const hint = modal.el.querySelector('#scopeHint');
      scopeSeg.addEventListener('click', function (e) {
        const b = e.target.closest('[data-scope]');
        if (!b) return;
        Array.prototype.forEach.call(scopeSeg.children, function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        const val = b.getAttribute('data-scope');
        form.elements.scope.value = val;
        hint.innerHTML = val === 'one'
          ? 'Zmiany zapiszą się tylko dla tego jednego terminu.'
          : val === 'future'
            ? 'Obejmie ' + U.lessonsLabel(series.futureCount) + ' — od tego terminu do ' + U.fmtDate(series.last.date, 'medium') +
              '. Zmiana daty przesunie całą resztę serii o tyle samo dni.'
            : 'Obejmie wszystkie ' + U.lessonsLabel(series.total) +
              (series.pastCount ? ', w tym ' + series.pastCount + ' z przeszłości' : '') +
              '. Zmiana daty przesunie je wszystkie o tyle samo dni.';
        if (val !== 'one') {
          hint.innerHTML += '<br>Status zajęć i płatności zmienią się tylko dla tego terminu.';
        }
      });
      // wejście z menu „Edytuj serię…” — od razu właściwy zakres
      if (draft.scope && draft.scope !== 'one') {
        const preset = scopeSeg.querySelector('[data-scope="' + draft.scope + '"]');
        if (preset) preset.click();
      }
    }

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

    const FIELD_LABELS = {
      studentId: 'Uczeń', date: 'Data', start: 'Godzina', duration: 'Czas trwania',
      mode: 'Typ zajęć', subject: 'Przedmiot', topic: 'Temat', price: 'Cena',
      paymentStatus: 'Status płatności', status: 'Status zajęć', note: 'Notatka'
    };
    function describeChange(k, val) {
      if (k === 'studentId') return 'Uczeń → ' + S().studentName(val);
      if (k === 'date') return 'Data → ' + U.fmtDate(val, 'medium');
      if (k === 'start') return 'Godzina → ' + U.fmtTime(val);
      if (k === 'duration') return 'Czas trwania → ' + U.durLabel(val);
      if (k === 'price') return 'Cena → ' + U.money(val);
      if (k === 'mode') return 'Typ → ' + (val === 'online' ? 'online' : 'stacjonarne');
      return (FIELD_LABELS[k] || k) + ' → ' + (val === '' ? '(puste)' : val);
    }

    modal.el.querySelector('[data-save-lesson]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      v.duration = currentDuration();
      if (!v.studentId) { UI().toast('Wybierz ucznia', { type: 'warn' }); return; }

      if (editing) {
        const changes = collectChanges(v);
        if (!Object.keys(changes).length) {
          modal.close();
          UI().toast('Nic się nie zmieniło', { type: 'info', duration: 2200 });
          return;
        }
        const scope = series && form.elements.scope ? form.elements.scope.value : 'one';

        if (scope === 'one') {
          S().ops.updateLesson(d.id, changes);
          afterSave(modal, 'Zajęcia zaktualizowane',
            series ? 'Zmiana dotyczy tylko tego terminu' : '');
          return;
        }

        const pre = S().ops.previewSeriesChanges(d.id, changes, scope);
        const lista = Object.keys(changes).map(function (k) { return describeChange(k, changes[k]); });

        UI().confirm({
          title: scope === 'future'
            ? 'Zapisać zmiany w tym i następnych terminach?'
            : 'Zapisać zmiany w całej serii?',
          text: lista.join(' · ') + '\n\nZmiana obejmie ' + U.lessonsLabel(pre.ok.length) + '.',
          warning: pre.blocked.length
            ? pre.blocked.length + ' ' + U.plural(pre.blocked.length, 'termin zostanie pominięty', 'terminy zostaną pominięte', 'terminów zostanie pominiętych') +
              ', bo po zmianie kolidowałyby z innymi zajęciami: ' +
              pre.blocked.slice(0, 3).map(function (p) { return U.fmtDate(p.next.date, 'short'); }).join(', ') +
              (pre.blocked.length > 3 ? '…' : '')
            : '',
          confirmLabel: 'Zapisz w serii',
          danger: false
        }).then(function (ok) {
          if (!ok) return;
          const res = S().ops.applySeriesChanges(d.id, changes, scope);
          if (!res.updated) {
            UI().toast('Nie zapisano żadnej zmiany', {
              type: 'bad', desc: 'Wszystkie terminy kolidowałyby z innymi zajęciami.'
            });
            return;
          }
          afterSave(modal, 'Zaktualizowano ' + U.lessonsLabel(res.updated) + ' z serii',
            res.skipped.length ? 'Pominięto ' + res.skipped.length + ' z powodu kolizji' : lista[0]);
        });
      } else {
        const data = {
          studentId: v.studentId, date: v.date, start: v.start, duration: v.duration,
          mode: v.mode, subject: v.subject, topic: v.topic, price: Number(v.price) || 0,
          paymentStatus: v.paymentStatus, note: v.note
        };
        const type = v.recurrence || 'once';
        if (type === 'once') {
          S().ops.addLesson(data);
          afterSave(modal, 'Zajęcia dodane', U.fmtDate(v.date, 'dow') + ', ' + U.fmtTime(v.start));
        } else {
          const res = S().ops.addRecurring(data, {
            type: type, count: Number(v.recurCount) || 8, days: chosenDays.length ? chosenDays : [U.dow(v.date)]
          });
          if (!res.created.length) {
            UI().toast('Nie dodano żadnych zajęć', {
              type: 'bad',
              desc: 'Wszystkie terminy tej serii kolidują z istniejącymi zajęciami. Zmień godzinę lub dzień.'
            });
            return;   // modal zostaje otwarty, żeby dało się poprawić
          }
          const last = res.created[res.created.length - 1];
          afterSave(modal, U.lessonsLabel(res.created.length) + ' dodane',
            'Od ' + U.fmtDate(v.date, 'medium') + ' do ' + U.fmtDate(last.date, 'medium') +
            (res.skipped.length ? ' · pominięto ' + res.skipped.length + ' ' +
              U.plural(res.skipped.length, 'kolidujący termin', 'kolidujące terminy', 'kolidujących terminów') : ''));
        }
      }
    });

    const delBtn = modal.el.querySelector('[data-del-lesson]');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        const scope = series && form.elements.scope ? form.elements.scope.value : 'one';
        const targets = S().ops.seriesScope(d.id, scope);
        const wiele = targets.length > 1;
        const wartosc = U.sum(targets.filter(function (l) { return l.status === 'planned'; }), function (l) { return l.price; });

        UI().confirm({
          title: wiele ? 'Usunąć ' + U.lessonsLabel(targets.length) + ' z serii?' : 'Usunąć te zajęcia?',
          text: wiele
            ? U.fmtDate(targets[0].date, 'medium') + ' – ' + U.fmtDate(targets[targets.length - 1].date, 'medium') +
              ' · ' + S().studentName(d.studentId)
            : U.fmtDate(d.date, 'dow') + ', ' + U.fmtTime(d.start) + ' — ' + S().studentName(d.studentId),
          warning: wiele
            ? 'Z prognozy zniknie ' + U.money(wartosc) + ' zaplanowanego przychodu. Tej operacji nie można cofnąć.'
            : '',
          confirmLabel: wiele ? 'Usuń ' + targets.length + ' zajęć' : 'Usuń zajęcia'
        }).then(function (ok) {
          if (!ok) return;
          if (wiele) {
            const n = S().ops.deleteSeries(d.id, scope);
            afterSave(modal, U.lessonsLabel(n) + ' usunięte', 'Seria skrócona');
          } else {
            S().repo('lessons').remove(d.id);
            afterSave(modal, 'Zajęcia usunięte');
          }
        });
      });
    }

    if (!editing && !d.studentId) { /* czekamy na wybór ucznia */ }
    else { syncPrice(); }
    if (d.price === null || d.price === undefined) syncPrice();
    checkConflicts();
    updateRecurHint();
    return modal;
  };

  /* ============================================================
     UCZEŃ
     ============================================================ */
  F.student = function (id) {
    const editing = !!id;
    const st = S().settings();
    const s = editing ? S().student(id) : M.Student({});

    const rateFields = M.DURATIONS.map((d) =>
      '<div class="field"><label>' + d + ' min</label><div class="input-suffix">' +
      '<input class="input input--sm" type="number" name="rate' + d + '" min="0" step="5" value="' + (s.rates[d] || '') + '">' +
      '<span>' + U.curSymbol() + '</span></div></div>').join('');

    const body =
      '<form id="studentForm">' +
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
          '<div class="form-grid" style="grid-template-columns:repeat(5,1fr)">' + rateFields + '</div></div>' +
      '</form>';

    const modal = UI().modal({
      title: editing ? 'Edytuj ucznia' : 'Nowy uczeń',
      subtitle: editing ? S().studentName(id) : 'Podstawowe dane wystarczą — resztę uzupełnisz później',
      size: 'wide',
      body: body,
      footer: '<div class="grow"></div><button class="btn" data-modal-close>Anuluj</button>' +
        '<button class="btn btn--brand" data-save>' + (editing ? 'Zapisz zmiany' : 'Dodaj ucznia') + '</button>'
    });

    const form = modal.el.querySelector('#studentForm');
    modal.el.querySelector('#autoRates').addEventListener('click', function () {
      const base = Number(form.elements.rate60.value) || st.defaultPrice || 80;
      form.elements.rate30.value = Math.round(base * 0.6);
      form.elements.rate45.value = Math.round(base * 0.8);
      form.elements.rate90.value = Math.round(base * 1.45);
      form.elements.rate120.value = Math.round(base * 1.85);
      UI().toast('Cennik przeliczony', { type: 'ok', desc: 'Możesz go dowolnie skorygować.' });
    });

    modal.el.querySelector('[data-save]').addEventListener('click', function () {
      if (!form.reportValidity()) return;
      const v = read(form);
      const rates = {};
      M.DURATIONS.forEach((d) => { rates[d] = Number(v['rate' + d]) || 0; });
      const payload = {
        firstName: v.firstName, lastName: v.lastName, phone: v.phone, email: v.email,
        parentContact: v.parentContact, grade: v.grade, school: v.school, level: v.level,
        subject: v.subject, startDate: v.startDate, mode: v.mode, status: v.status,
        preferredDay: v.preferredDay === '' ? null : Number(v.preferredDay),
        preferredTime: v.preferredTime, location: v.location, group: !!v.group, rates: rates
      };
      if (payload.status === 'ended' && !s.endDate) payload.endDate = U.today();
      if (payload.status !== 'ended') payload.endDate = null;

      if (editing) {
        S().repo('students').update(id, payload);
        afterSave(modal, 'Dane ucznia zapisane');
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
        field('Kwota', '<div class="input-suffix"><input class="input" type="number" name="amount" min="0" step="5" value="' +
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
        field('Cena za lekcję', '<div class="input-suffix"><input class="input" type="number" name="pricePerLesson" min="0" step="5" value="' +
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
