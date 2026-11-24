/* ============================================================
   TutorFlow — views/calendar.js
   Kalendarz z widokami dzień / tydzień / miesiąc / agenda,
   przeciąganiem lekcji i wykrywaniem konfliktów.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const icon = window.TF.icon;

  const state = { mode: null, anchor: null };
  const SLOT_H = 58;          // wysokość jednej godziny w px
  let dragId = null;

  function mode() {
    if (!state.mode) state.mode = S().settings().calendarView || 'week';
    return state.mode;
  }
  function anchor() {
    if (!state.anchor) state.anchor = U.today();
    return state.anchor;
  }

  /* ---------------- zakres widoczny ---------------- */
  function visibleRange() {
    const a = anchor();
    if (mode() === 'day') return [a, a];
    if (mode() === 'month') {
      const first = U.startOfMonth(a);
      return [U.startOfWeek(first), U.addDays(U.startOfWeek(first), 41)];
    }
    if (mode() === 'agenda') return [U.today(), U.addDays(U.today(), 30)];
    const s = U.startOfWeek(a);
    return [s, U.addDays(s, 6)];
  }

  function periodLabel() {
    const [from, to] = visibleRange();
    if (mode() === 'day') return U.cap(U.DOW_LONG[U.dow(from)]) + ', ' + U.fmtDate(from, 'long');
    if (mode() === 'month') return U.monthLabel(U.monthKey(anchor()));
    if (mode() === 'agenda') return 'Najbliższe 30 dni';
    const sameMonth = U.monthKey(from) === U.monthKey(to);
    return U.fmtDate(from, 'day') + ' – ' + U.fmtDate(to, 'day') + (sameMonth ? '' : '');
  }

  /* ---------------- pasek narzędzi ---------------- */
  function toolbar() {
    const modes = [['day', 'Dzień'], ['week', 'Tydzień'], ['month', 'Miesiąc'], ['agenda', 'Agenda']];
    return '<div class="cal-toolbar">' +
      '<div class="cal-nav">' +
        '<button class="icon-btn" data-action="calPrev" data-tip="Poprzedni">' + icon('chevronLeft', 18) + '</button>' +
        '<button class="icon-btn" data-action="calNext" data-tip="Następny">' + icon('chevronRight', 18) + '</button>' +
        '<button class="btn btn--sm" data-action="calToday">Dziś</button>' +
      '</div>' +
      '<div class="cal-period">' + U.esc(periodLabel()) + '</div>' +
      '<div class="grow"></div>' +
      '<div class="segmented">' + modes.map((m) =>
        '<button class="' + (mode() === m[0] ? 'is-active' : '') + '" data-action="calMode" data-mode="' + m[0] + '">' + m[1] + '</button>').join('') + '</div>' +
      '<button class="btn btn--sm" data-action="go" data-route="#/print?week=' + U.startOfWeek(anchor()) + '" data-tip="Wydrukuj szablon tygodnia">' +
        icon('printer', 15) + '</button>' +
      '<button class="btn btn--brand btn--sm" data-action="addLesson"><span class="plus">+</span> Dodaj zajęcia</button>' +
      '</div>';
  }

  function legend() {
    return '<div class="cal-legend mt-3">' +
      '<span><i class="dot-status st-done"></i> odbyte</span>' +
      '<span><i class="dot-status st-planned"></i> zaplanowane</span>' +
      '<span><i class="dot-status st-moved"></i> przełożone</span>' +
      '<span><i class="dot-status st-cancelled"></i> odwołane</span>' +
      '<span><i class="dot-status st-noshow"></i> nieobecność</span>' +
      '<span><i class="dot-status st-free" style="opacity:.5"></i> wolne okno — kliknij, aby dodać</span>' +
      '<span>🔁 lekcja cykliczna</span>' +
      '</div>';
  }

  /* ---------------- godziny widoczne ---------------- */
  function hourRange(days) {
    let min = 24 * 60, max = 0;
    const st = S().settings();
    (st.workDays || []).forEach((d) => {
      const wh = C().workHoursFor(d);
      if (!wh) return;
      min = Math.min(min, U.toMin(wh.start));
      max = Math.max(max, U.toMin(wh.end));
    });
    days.forEach((d) => {
      S().lessonsOn(d).forEach((l) => {
        min = Math.min(min, U.toMin(l.start));
        max = Math.max(max, C().lessonEnd(l));
      });
    });
    if (min > max) { min = 14 * 60; max = 20 * 60; }
    min = Math.floor(min / 60) * 60;
    max = Math.ceil(max / 60) * 60;
    if (max - min < 6 * 60) max = min + 6 * 60;
    return [min, max];
  }

  /* ---------------- układ nakładających się lekcji ---------------- */
  function layout(lessons) {
    const sorted = U.sortBy(lessons, (l) => U.toMin(l.start));
    const out = [];
    let cluster = [], clusterEnd = -1;
    function flush() {
      if (!cluster.length) return;
      const lanes = [];
      cluster.forEach((l) => {
        let idx = lanes.findIndex((end) => end <= U.toMin(l.start));
        if (idx === -1) { lanes.push(C().lessonEnd(l)); idx = lanes.length - 1; }
        else lanes[idx] = C().lessonEnd(l);
        out.push({ lesson: l, lane: idx });
      });
      const total = lanes.length;
      out.slice(out.length - cluster.length).forEach((o) => { o.total = total; });
      cluster = []; clusterEnd = -1;
    }
    sorted.forEach((l) => {
      const s = U.toMin(l.start), e = C().lessonEnd(l);
      if (cluster.length && s >= clusterEnd) flush();
      cluster.push(l);
      clusterEnd = Math.max(clusterEnd, e);
    });
    flush();
    return out;
  }

  function eventClass(l) {
    return {
      done: 'cal-event--done', cancelled_student: 'cal-event--cancelled', cancelled_tutor: 'cal-event--cancelled',
      rescheduled: 'cal-event--moved', no_show: 'cal-event--noshow'
    }[l.status] || '';
  }

  /* ---------------- widok tydzień / dzień ---------------- */
  function gridView(days) {
    const [minM, maxM] = hourRange(days);
    const hours = (maxM - minM) / 60;
    const t = U.today();

    let head = '<div class="cal-head" style="--cols:' + days.length + '"><div class="cal-head__cell"></div>';
    days.forEach((d) => {
      const off = !C().isWorkDay(d);
      head += '<div class="cal-head__cell ' + (d === t ? 'is-today' : '') + ' ' + (off ? 'is-off' : '') + '">' +
        '<small>' + U.DOW_SHORT[U.dow(d)] + '</small><strong>' + U.parse(d).getDate() + '</strong></div>';
    });
    head += '</div>';

    let gutter = '<div class="cal-gutter">';
    for (let h = 0; h < hours; h++) {
      gutter += '<div class="cal-gutter__h"><span>' + U.toTime(minM + h * 60) + '</span></div>';
    }
    gutter += '</div>';

    let cols = '';
    days.forEach((d) => {
      const wh = C().workHoursFor(U.dow(d));
      const off = !wh;
      let slots = '';
      for (let i = 0; i < hours * 2; i++) {
        const m = minM + i * 30;
        const outside = wh ? (m < U.toMin(wh.start) || m >= U.toMin(wh.end)) : true;
        slots += '<div class="cal-slot ' + (outside ? 'is-outside' : '') + '" data-date="' + d + '" data-time="' + U.toTime(m) + '"></div>';
      }
      const laid = layout(S().lessonsOn(d));
      let evs = '';
      laid.forEach((o) => {
        const l = o.lesson;
        const top = ((U.toMin(l.start) - minM) / 60) * SLOT_H;
        const h = Math.max(20, (l.duration / 60) * SLOT_H - 3);
        const total = o.total || 1;
        const w = 100 / total;
        evs += '<div class="cal-event ' + eventClass(l) + (h < 34 ? ' cal-event--tiny' : '') + '" draggable="true" ' +
          'data-id="' + l.id + '" data-action="lessonMenu" ' +
          'style="top:' + top + 'px;height:' + h + 'px;left:calc(' + (o.lane * w) + '% + 3px);width:calc(' + w + '% - 6px)">' +
          '<strong>' + (S().ops.isRecurring(l) ? '<i class="rec-ico" title="Lekcja cykliczna">🔁</i>' : '') +
            U.fmtTime(l.start) + ' ' + U.esc(S().studentName(l.studentId).split(' ')[0]) + '</strong>' +
          '<span>' + U.esc(l.topic || l.subject || '') + ' · ' + U.money(l.price) + '</span>' +
          '</div>';
      });
      let nowLine = '';
      if (d === t) {
        const n = U.nowMin();
        if (n >= minM && n <= maxM) nowLine = '<div class="cal-now" style="top:' + (((n - minM) / 60) * SLOT_H) + 'px"></div>';
      }
      cols += '<div class="cal-col ' + (off ? 'is-off' : '') + ' ' + (d === t ? 'is-today' : '') + '">' + slots + evs + nowLine + '</div>';
    });

    return '<div class="cal" style="--slot-h:' + SLOT_H + 'px">' +
      '<div style="overflow-x:auto"><div style="min-width:' + (days.length > 3 ? 720 : 320) + 'px">' +
        head +
        '<div class="cal-body" style="--cols:' + days.length + '">' + gutter + cols + '</div>' +
      '</div></div></div>';
  }

  /* ---------------- widok miesiąca ---------------- */
  function monthView() {
    const first = U.startOfMonth(anchor());
    const start = U.startOfWeek(first);
    const mk = U.monthKey(anchor());
    const t = U.today();
    let html = '<div class="cal"><div class="cal-month">' +
      U.DOW_SHORT.map((d) => '<div class="cal-month__dow">' + d + '</div>').join('');

    for (let i = 0; i < 42; i++) {
      const d = U.addDays(start, i);
      const out = U.monthKey(d) !== mk;
      const ls = S().lessonsOn(d);
      const rev = C().revenue(ls);
      const shown = ls.slice(0, 3);
      html += '<div class="cal-month__day ' + (out ? 'is-out' : '') + ' ' + (d === t ? 'is-today' : '') + '" data-action="calDay" data-date="' + d + '">' +
        '<span class="cal-month__num">' + U.parse(d).getDate() + '</span>' +
        (rev ? '<span class="cal-month__sum">' + U.moneyShort(rev) + '</span>' : '') +
        '<div class="cal-month__list">' +
          shown.map((l) => '<div class="cal-month__ev" data-action="lessonMenu" data-id="' + l.id + '">' +
            '<i class="dot-status ' + (window.TF.Models.LESSON_STATUS[l.status] || {}).dot + '"></i>' +
            '<b>' + U.fmtTime(l.start) + '</b>' + (S().ops.isRecurring(l) ? '<i class="rec-ico" title="Lekcja cykliczna">🔁</i>' : '') +
            ' <span>' + U.esc(S().studentName(l.studentId).split(' ')[0]) + '</span></div>').join('') +
          (ls.length > 3 ? '<div class="cal-month__more">+' + (ls.length - 3) + ' więcej</div>' : '') +
        '</div></div>';
    }
    return html + '</div></div>';
  }

  /* ---------------- agenda ---------------- */
  function agendaView() {
    const [from, to] = visibleRange();
    const all = S().lessonsBetween(from, to);
    if (!all.length) {
      return '<div class="card">' + UI.empty({
        icon: 'calendar', title: 'Brak zajęć w najbliższych 30 dniach',
        text: 'Zaplanuj lekcje, żeby wypełnić grafik i prognozę.',
        ctaLabel: 'Dodaj zajęcia', ctaAction: 'addLesson'
      }) + '</div>';
    }
    const byDay = U.groupBy(all, (l) => l.date);
    return Object.keys(byDay).sort().map((d) => {
      const ls = byDay[d];
      return UI.card(U.dayLabel(d), ls.map((l) => L().lessonRow(l, { dim: true })).join(''), {
        noPad: true,
        subtitle: U.lessonsLabel(ls.length) + ' · ' + U.money(U.sum(ls.filter((l) => !C().isCancelled(l)), (l) => l.price)),
        class: 'mb-4'
      });
    }).join('');
  }

  /* ---------------- wolne terminy ---------------- */
  function freeSlotsCard() {
    const st = S().settings();
    const [from] = visibleRange();
    const start = mode() === 'month' ? U.today() : (from < U.today() ? U.today() : from);
    const slots = C().freeSlots(start, U.addDays(start, 6), st.defaultDuration || 60);
    if (!slots.length) {
      return UI.card('Wolne terminy', '<p class="dim small">Brak wolnych okien w tym tygodniu — grafik pełny. 🎉</p>');
    }
    const grouped = U.groupBy(slots.slice(0, 18), (s) => s.date);
    const body = Object.keys(grouped).sort().map((d) =>
      '<div class="mb-3"><div class="small dim mb-2">' + U.dayLabel(d, 'medium') + '</div><div class="chips">' +
      grouped[d].map((s) => '<button class="slot-pill" data-action="addLesson" data-date="' + s.date + '" data-start="' + s.start + '">' +
        icon('plus', 13) + '<b>' + U.fmtTime(s.start) + '</b></button>').join('') + '</div></div>').join('');
    return UI.card('Wolne terminy w tym tygodniu', body, {
      subtitle: slots.length + ' ' + U.plural(slots.length, 'okno', 'okna', 'okien') + ' po ' + (st.defaultDuration || 60) + ' min',
      action: '<button class="btn btn--xs" data-action="copyFreeSlots">' + icon('copy', 13) + ' Kopiuj</button>'
    });
  }

  /* ============================================================ */
  window.TF.Views.calendar = {
    title: 'Kalendarz',
    subtitle: function () { return periodLabel(); },
    render: function (params, query) {
      // #/calendar?date=…&mode=… stosujemy raz na przejście — inaczej „Poprzedni / Następny”
      // po każdym odświeżeniu wracałyby do daty z adresu
      const nav = window.TF.Router.navSeq;
      if (query && query.date && state.navSeq !== nav) { state.anchor = query.date; state.mode = query.mode || state.mode; }
      state.navSeq = nav;
      const [from, to] = visibleRange();
      let main;
      if (mode() === 'month') main = monthView();
      else if (mode() === 'agenda') main = agendaView();
      else if (mode() === 'day') main = gridView([anchor()]);
      else main = gridView(U.rangeDays(from, to));

      const stats = mode() === 'agenda' ? '' :
        '<div class="row gap-4 wrap mt-4 small dim">' +
          '<span>' + icon('clock', 14) + ' Wykorzystanie: <b>' + U.pctLabel(C().utilization(from, to), 0) + '</b></span>' +
          '<span>' + icon('wallet', 14) + ' Wartość okresu: <b>' + U.money(U.sum(S().lessonsBetween(from, to).filter((l) => !C().isCancelled(l)), (l) => l.price)) + '</b></span>' +
          '<span>' + icon('calendar', 14) + ' Zajęć: <b>' + S().lessonsBetween(from, to).length + '</b></span>' +
        '</div>';

      return toolbar() +
        '<div class="grid grid-2-1">' +
          '<div>' + main + legend() + stats + '</div>' +
          '<div class="col gap-4">' + freeSlotsCard() + upcomingCard() + '</div>' +
        '</div>';
    },
    mount: function (host) {
      /* klik w wolne okno → nowy termin */
      host.addEventListener('click', function (e) {
        const slot = e.target.closest('.cal-slot');
        if (!slot || slot.classList.contains('is-outside')) return;
        window.TF.Forms.lesson({ date: slot.getAttribute('data-date'), start: slot.getAttribute('data-time') });
      });

      /* przeciąganie lekcji */
      host.addEventListener('dragstart', function (e) {
        const ev = e.target.closest('.cal-event');
        if (!ev) return;
        dragId = ev.getAttribute('data-id');
        ev.classList.add('is-dragging');
        try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) {}
      });
      host.addEventListener('dragend', function (e) {
        const ev = e.target.closest('.cal-event');
        if (ev) ev.classList.remove('is-dragging');
        host.querySelectorAll('.is-droptarget').forEach((n) => n.classList.remove('is-droptarget'));
        dragId = null;
      });
      host.addEventListener('dragover', function (e) {
        const slot = e.target.closest('.cal-slot');
        if (!slot || !dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        host.querySelectorAll('.is-droptarget').forEach((n) => n.classList.remove('is-droptarget'));
        slot.classList.add('is-droptarget');
      });
      host.addEventListener('drop', function (e) {
        const slot = e.target.closest('.cal-slot');
        if (!slot || !dragId) return;
        e.preventDefault();
        const id = dragId;
        dragId = null;
        const l = S().repo('lessons').byId(id);
        if (!l) return;
        const date = slot.getAttribute('data-date'), start = slot.getAttribute('data-time');
        if (l.date === date && l.start === start) { window.TF.Router.refresh(); return; }
        const clash = S().ops.findConflicts({ date: date, start: start, duration: l.duration }, l.id);
        if (clash.length) {
          UI.toast('Ta godzina jest już zajęta', {
            type: 'bad',
            desc: 'Lekcja z ' + S().studentName(clash[0].studentId) + ' o ' + U.fmtTime(clash[0].start)
          });
          window.TF.Router.refresh();
          return;
        }
        const old = { date: l.date, start: l.start };
        S().ops.moveLesson(l.id, date, start);
        UI.toast('Lekcja przeniesiona', {
          type: 'ok',
          desc: S().studentName(l.studentId) + ' → ' + U.fmtDate(date, 'dow') + ', ' + U.fmtTime(start),
          actionLabel: 'Cofnij',
          onAction: function () { S().ops.moveLesson(l.id, old.date, old.start); window.TF.Router.refresh(); }
        });
        window.TF.Router.refresh();
      });

      /* przewiń do godzin pracy */
      const body = host.querySelector('.cal-body');
      if (body && mode() !== 'month' && mode() !== 'agenda') {
        const scroller = host.querySelector('.cal > div');
        if (scroller) scroller.scrollLeft = 0;
      }
    },
    setMode: function (m) { state.mode = m; S().setSetting({ calendarView: m }); },
    shift: function (dir) {
      const m = mode();
      if (m === 'day') state.anchor = U.addDays(anchor(), dir);
      else if (m === 'week') state.anchor = U.addDays(anchor(), dir * 7);
      else if (m === 'month') state.anchor = U.addMonths(anchor(), dir);
      else state.anchor = U.addDays(anchor(), dir * 30);
    },
    goToday: function () { state.anchor = U.today(); },
    setDate: function (d) { state.anchor = d; },
    state: state
  };

  function upcomingCard() {
    const up = C().upcoming(7).slice(0, 6);
    if (!up.length) return '';
    return UI.card('Najbliższe zajęcia',
      up.map((l) => '<div class="stat-row"><span class="stat-row__label">' +
        UI.avatar(S().student(l.studentId), 'sm') +
        '<span><b>' + U.esc(S().studentName(l.studentId)) + '</b><br><span class="tiny dim">' +
        U.dayLabel(l.date, 'medium') + ', ' + U.fmtTime(l.start) + '</span></span></span>' +
        '<span class="stat-row__value">' + U.money(l.price) + '</span></div>').join(''),
      { subtitle: 'Kolejne 7 dni' });
  }
})();
