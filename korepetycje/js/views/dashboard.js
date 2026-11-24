/* ============================================================
   TutorFlow — views/dashboard.js
   Najważniejszy ekran: w kilka sekund odpowiada na pytania
   kogo uczę → kiedy → ile zarabiam → kto nie zapłacił → co zrobić.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const Ch = () => window.TF.Charts;
  const I = () => window.TF.Insights;
  const icon = window.TF.icon;

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Dobrej nocy';
    if (h < 12) return 'Dzień dobry';
    if (h < 18) return 'Dzień dobry';
    if (h < 22) return 'Dobry wieczór';
    return 'Dobrej nocy';
  }

  function heroSection(d, w) {
    const st = S().settings();
    const name = st.tutorName ? ', ' + st.tutorName.split(' ')[0] : '';
    const today = new Date();
    const dateStr = U.cap(U.DOW_LONG[U.dow(U.today())]) + ', ' + today.getDate() + ' ' + U.MONTHS_GEN[today.getMonth()] + ' ' + today.getFullYear();
    return '<div class="hero">' +
      '<div class="hero__text">' +
        '<h2>' + greeting() + name + '!</h2>' +
        '<p>' + dateStr + ' · ' + (d.todayCount ? U.lessonsLabel(d.todayCount) + ' w planie' : 'Dziś nie masz zaplanowanych zajęć') + '</p>' +
      '</div>' +
      '<div class="hero__stats">' +
        '<div class="hero__stat"><small>Dziś</small><strong>' + U.money(d.todayPotential) + '</strong></div>' +
        '<div class="hero__stat"><small>Ten tydzień</small><strong>' + U.money(w.value) + '</strong></div>' +
        '<div class="hero__stat"><small>Ten miesiąc</small><strong>' + U.money(d.monthRevenue) + '</strong></div>' +
        '<div class="hero__stat"><small>Prognoza</small><strong>' + U.money(d.monthForecast.forecast) + '</strong></div>' +
      '</div>' +
      '</div>';
  }

  function kpis(d) {
    const series = C().monthlySeries(8).map((m) => m.revenue);
    const cmp = d.comparison;
    const cards = [
      UI.kpi({
        label: 'Dzisiejsze lekcje', icon: 'today', tone: 'info', route: '#/today',
        value: d.todayCount, unit: U.plural(d.todayCount, 'lekcja', 'lekcje', 'lekcji'),
        foot: d.todayLessons.length
          ? '<span>' + (d.todayLessons.filter((l) => l.status === 'done').length) + ' odbytych · ' +
            (d.todayLessons.filter((l) => l.status === 'planned').length) + ' przed nami</span>'
          : '<span>Wolny dzień</span>'
      }),
      UI.kpi({
        label: 'Dzisiejszy zarobek', icon: 'wallet', tone: 'ok', route: '#/today',
        value: U.money(d.todayPotential),
        foot: '<span>Rozliczone: ' + U.money(d.todayEarned) + '</span>'
      }),
      UI.kpi({
        label: 'Zarobek w tym miesiącu', icon: 'chart', tone: '', route: '#/finance',
        value: U.money(d.monthRevenue),
        foot: cmp.previous ? UI.trend(cmp.change) + '<span>vs ' + U.monthName(cmp.prevKey) + '</span>' : '<span>Pierwszy miesiąc danych</span>'
      }),
      UI.kpi({
        label: 'Prognoza miesiąca', icon: 'trending', tone: 'info', route: '#/forecast',
        value: U.money(d.monthForecast.forecast),
        foot: '<span>Zakres ' + U.moneyShort(d.monthForecast.low) + '–' + U.moneyShort(d.monthForecast.high) + '</span>'
      }),
      UI.kpi({
        label: 'Aktywni uczniowie', icon: 'users', tone: 'info', route: '#/students',
        value: d.activeStudents,
        foot: d.newStudents ? '<span class="pos-up">+' + d.newStudents + ' w tym miesiącu</span>' : '<span>Bez zmian w tym miesiącu</span>'
      }),
      UI.kpi({
        label: 'Nieopłacone zajęcia', icon: 'card', tone: d.unpaid.count ? 'bad' : 'ok', route: '#/payments',
        value: d.unpaid.count ? U.money(d.unpaid.total) : '0',
        foot: '<span>' + (d.unpaid.count ? U.lessonsLabel(d.unpaid.count) + ' do rozliczenia' : 'Wszystko rozliczone') + '</span>'
      }),
      UI.kpi({
        label: 'Odwołane zajęcia', icon: 'ban', tone: d.cancelledThisMonth ? 'warn' : 'ok', route: '#/lessons?filter=cancelled',
        value: d.cancelledThisMonth,
        foot: '<span>w tym miesiącu · ' + U.pctLabel(C().cancellationRate(), 0) + ' ogółem</span>'
      }),
      UI.kpi({
        label: 'Wykorzystanie grafiku', icon: 'clock', tone: d.utilization > 70 ? 'ok' : 'warn', route: '#/stats',
        value: U.pctLabel(d.utilization, 0),
        foot: UI.progress(d.utilization, d.utilization > 70 ? 'ok' : 'warn')
      })
    ];
    return '<div class="kpi-grid">' + cards.map((c, i) =>
      c.replace('class="kpi"', 'class="kpi" style="animation-delay:' + (i * 35) + 'ms"')).join('') + '</div>';
  }

  function todaySection(d) {
    const list = d.todayLessons;
    let body;
    if (!list.length) {
      const slots = C().freeSlots(U.today(), U.today(), S().settings().defaultDuration || 60);
      body = UI.empty({
        icon: 'today', title: 'Dziś nie masz zajęć',
        text: slots.length ? 'Masz ' + slots.length + ' wolnych okien — idealny moment, żeby zaproponować termin nowemu uczniowi.' : 'Wolny dzień. Odpocznij albo zaplanuj coś na przyszłość.',
        ctaLabel: 'Dodaj zajęcia', ctaAction: 'addLesson'
      });
    } else {
      body = list.map((l) => L().lessonRow(l, { dim: true })).join('');
    }
    return UI.card('Dzisiejsze zajęcia', body, {
      subtitle: list.length ? U.lessonsLabel(list.length) + ' · ' + U.money(d.todayPotential) : 'Brak zaplanowanych zajęć',
      noPad: true,
      action: '<button class="btn btn--sm" data-action="addLesson" data-date="' + U.today() + '"><span class="plus">+</span> Dodaj</button>'
    });
  }

  function nextLessonSection(d) {
    const l = d.next;
    if (!l) {
      return UI.card('Następna lekcja', UI.empty({
        icon: 'calendar', title: 'Brak zaplanowanych zajęć',
        text: 'Zaplanuj kolejne lekcje, żeby prognoza przychodu była dokładna.',
        ctaLabel: 'Zaplanuj', ctaAction: 'addLesson'
      }), { noPad: true });
    }
    const c = C();
    const s = S().student(l.studentId);
    const mins = c.minutesUntil(l);
    const last = c.lastHeldOf(l.studentId);
    const due = c.unpaidTotal(l.studentId);
    const hw = S().repo('homework').where((h) => h.studentId === l.studentId && h.status === 'assigned');
    const tasks = S().repo('tasks').where((t) => t.studentId === l.studentId && !t.done);

    const body =
      '<div class="next-lesson">' +
        '<div class="next-lesson__ring">' + UI.avatar(s, 'lg') + '</div>' +
        '<div class="next-lesson__body">' +
          '<div class="countdown" data-countdown="' + l.id + '">' +
            (mins < 0 ? 'Trwa teraz' : (c.isNow(l) ? 'Trwa teraz' : U.relTime(mins))) +
            (mins >= 0 && !c.isNow(l) ? ' <small>do startu</small>' : '') + '</div>' +
          '<div class="bold mt-2" style="font-size:var(--fs-lg)">' + U.esc(S().studentName(l.studentId)) + '</div>' +
          '<div class="small dim">' + U.dayLabel(l.date) + ', ' + U.fmtTime(l.start) + '–' + U.fmtTime(c.lessonEndTime(l)) +
            ' · ' + U.esc(l.subject || (s && s.subject) || '') + ' · ' + U.money(l.price) + '</div>' +
          '<div class="row gap-2 mt-3 wrap">' +
            (due > 0 ? '<span class="badge badge--bad">Zaległość ' + U.money(due) + '</span>'
                     : '<span class="badge badge--ok">✅ rozliczony</span>') +
            '<span class="badge badge--outline">' + (l.mode === 'online' ? 'Online' : 'Stacjonarnie') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mt-4 col gap-2">' +
        (last && last.topic ? '<div class="stat-row"><span class="stat-row__label">' + icon('note', 15) + 'Ostatni temat</span>' +
          '<span class="stat-row__value small">' + U.esc(last.topic) + '</span></div>' : '') +
        (hw.length ? '<div class="stat-row"><span class="stat-row__label">' + icon('book', 15) + 'Praca domowa</span>' +
          '<span class="stat-row__value small">' + U.esc(hw[0].title) + '</span></div>' : '') +
        (tasks.length ? '<div class="stat-row"><span class="stat-row__label">' + icon('checkSquare', 15) + 'Do zrobienia</span>' +
          '<span class="stat-row__value small">' + U.esc(tasks[0].title) + '</span></div>' : '') +
      '</div>' +
      '<div class="row gap-2 mt-4">' +
        '<button class="btn btn--brand btn--sm grow" data-action="lessonSummary" data-id="' + l.id + '">' + icon('play', 14) + ' Rozpocznij</button>' +
        '<button class="btn btn--sm" data-action="go" data-route="#/students/' + l.studentId + '">Profil</button>' +
        '<button class="icon-btn" data-action="lessonMenu" data-id="' + l.id + '">' + icon('more', 16) + '</button>' +
      '</div>';

    return UI.card('Następna lekcja', body, { class: 'card--accent' });
  }

  function attentionSection() {
    const items = I().attention(5);
    const body = items.length
      ? '<div class="col gap-2">' + items.map((x, i) =>
          L().insight(x).replace('class="insight ', 'style="animation-delay:' + (i * 45) + 'ms" class="insight ')).join('') + '</div>'
      : '<div class="empty" style="padding:24px"><div class="empty__art">' + icon('checkCircle', 26) + '</div>' +
        '<h3>Wszystko pod kontrolą</h3><p class="small">Brak zaległości, wszystkie zajęcia rozliczone.</p></div>';
    return UI.card('Warto zwrócić uwagę', body, {
      subtitle: items.length ? items.length + ' ' + U.plural(items.length, 'sprawa', 'sprawy', 'spraw') : 'Czysto',
      action: '<button class="btn btn--xs" data-action="go" data-route="#/reminders">Wszystkie</button>'
    });
  }

  /* Ten tydzień (pon–nd): liczby jak w „Ten miesiąc” + pasek dni z liczbą lekcji */
  function weekSection(w) {
    const t = U.today();
    const cells = [
      { label: 'Lekcje', value: w.lessons, sub: w.held + ' odbytych · ' + w.planned + ' przed nami' },
      { label: 'Godziny', value: U.num(w.minutes / 60, 1) + ' h' },
      { label: 'Wartość tygodnia', value: U.money(w.value), sub: 'odbyte i zaplanowane' },
      { label: 'Zarobione', value: U.money(w.earned), tone: w.earned ? 'ok' : '', sub: 'odbyte i płatne odwołania' },
      { label: 'Opłacone', value: U.money(w.paid), tone: w.paid ? 'ok' : '' },
      { label: 'Do zapłaty', value: U.money(w.due), tone: w.due ? 'bad' : '' },
      { label: 'Odwołania', value: w.cancelled, tone: w.cancelled ? 'warn' : '' },
      { label: 'Wykorzystanie', value: U.pctLabel(w.utilization, 0) }
    ];
    const grid = '<div class="report-grid" style="margin-top:0">' + cells.map((c) =>
      '<div class="report-cell"><small>' + U.esc(c.label) + '</small><strong class="' +
      (c.tone === 'ok' ? 'pos-up' : c.tone === 'bad' ? 'pos-down' : '') + '">' + c.value + '</strong>' +
      (c.sub ? '<span class="tiny dim">' + U.esc(c.sub) + '</span>' : '') + '</div>').join('') + '</div>';
    const days = '<div class="week-strip mt-4" role="list">' + w.days.map((x) =>
      '<button type="button" role="listitem" class="week-strip__day' + (x.date === t ? ' is-today' : '') + (x.date < t ? ' is-past' : '') +
        (!x.work && !x.count ? ' is-off' : '') + '" data-action="calOpen" data-date="' + x.date + '" data-mode="day" ' +
        'title="' + U.esc(U.cap(U.DOW_LONG[U.dow(x.date)]) + ', ' + U.fmtDate(x.date, 'day') + ' — ' + U.lessonsLabel(x.count)) + '">' +
        '<small>' + U.DOW_SHORT[U.dow(x.date)] + '</small>' +
        '<b>' + U.parse(x.date).getDate() + '</b>' +
        '<span class="week-strip__n">' + (x.count ? x.count + '<span class="hide-sm"> ' + U.plural(x.count, 'lekcja', 'lekcje', 'lekcji') + '</span>' : '—') + '</span>' +
        '<span class="week-strip__v">' + (x.value ? U.moneyShort(x.value) : '') + '</span>' +
      '</button>').join('') + '</div>';
    return UI.card('Ten tydzień', grid + days, {
      subtitle: U.fmtDate(w.from, 'day') + ' – ' + U.fmtDate(w.to, 'day'),
      action: '<button class="btn btn--xs" data-action="calOpen" data-date="' + w.from + '" data-mode="week">Kalendarz</button>'
    });
  }

  function commandCenter(d) {
    const mk = U.monthKey(U.today());
    const sum = C().monthSummary(mk);
    const cells = [
      { label: 'Przychód', value: U.money(sum.revenue), tone: '' },
      { label: 'Prognoza', value: U.money(d.monthForecast.forecast), tone: '' },
      { label: 'Lekcje', value: sum.lessons, tone: '' },
      { label: 'Godziny', value: U.num(sum.hours, 1) + ' h', tone: '' },
      { label: 'Nowi uczniowie', value: (sum.newStudents ? '+' : '') + sum.newStudents, tone: sum.newStudents ? 'ok' : '' },
      { label: 'Odwołania', value: sum.cancelled, tone: sum.cancelled ? 'warn' : '' },
      { label: 'Zaległości', value: U.money(sum.unpaid), tone: sum.unpaid ? 'bad' : '' },
      { label: 'Wykorzystanie', value: U.pctLabel(sum.utilization, 0), tone: '' }
    ];
    const body = '<div class="report-grid" style="margin-top:0">' + cells.map((c) =>
      '<div class="report-cell"><small>' + U.esc(c.label) + '</small><strong class="' +
      (c.tone === 'ok' ? 'pos-up' : c.tone === 'bad' ? 'pos-down' : '') + '">' + c.value + '</strong></div>').join('') + '</div>';
    return UI.card('Ten miesiąc', body, {
      subtitle: U.monthLabel(mk),
      action: '<button class="btn btn--xs" data-action="go" data-route="#/reports">Pełny raport</button>'
    });
  }

  function revenueSection() {
    const series = C().monthlySeries(12);
    const cmp = C().monthComparison();
    const chart = Ch().area(series.map((m) => ({
      label: m.label, fullLabel: m.fullLabel, value: m.revenue,
      sub: U.lessonsLabel(m.lessons)
    })), { height: 220, showAvg: true });
    return UI.card('Przychody — ostatnie 12 miesięcy', chart, {
      subtitle: cmp.previous ? U.monthName(cmp.curKey) + ' vs ' + U.monthName(cmp.prevKey) : 'Trend miesięczny',
      action: '<div class="row gap-2">' + UI.trend(cmp.change) +
        '<button class="btn btn--xs" data-action="go" data-route="#/finance">Finanse</button></div>'
    });
  }

  function goalSection(d) {
    const g = d.goal;
    if (!g.goal) {
      return UI.card('Cel finansowy', UI.empty({
        icon: 'target', title: 'Nie masz ustawionego celu',
        text: 'Ustal miesięczny cel przychodu, a TutorFlow policzy ile lekcji brakuje.',
        ctaLabel: 'Ustaw cel', ctaAction: 'go', ctaData: 'data-route="#/settings"'
      }), { noPad: true });
    }
    const body =
      '<div class="goal-ring">' +
        UI.ring(g.pct, 96, U.pctLabel(g.pct, 0), 'celu') +
        '<div class="goal-ring__info">' +
          '<div class="dl">' +
            '<dt>Cel miesięczny</dt><dd>' + U.money(g.goal) + '</dd>' +
            '<dt>Aktualnie</dt><dd>' + U.money(g.current) + '</dd>' +
            '<dt>Prognoza</dt><dd class="' + (g.forecast >= g.goal ? 'pos-up' : '') + '">' + U.money(g.forecast) + '</dd>' +
            '<dt>Do celu</dt><dd class="' + (g.missing ? 'pos-down' : 'pos-up') + '">' + (g.missing ? U.money(g.missing) : 'osiągnięty 🎉') + '</dd>' +
          '</div>' +
        '</div>' +
      '</div>' +
      (g.missing ? '<div class="insight insight--brand mt-4"><span class="insight__ico">💡</span><div class="insight__body">' +
        'Potrzebujesz około <strong>' + U.lessonsLabel(g.lessonsNeeded) + '</strong> po średniej stawce ' + U.money(g.rate) + '.</div></div>' : '');
    return UI.card('Cel finansowy', body, {
      subtitle: U.monthLabel(U.monthKey(U.today())),
      action: '<button class="btn btn--xs" data-action="go" data-route="#/forecast">Prognozy</button>'
    });
  }

  function potentialSection(d) {
    const p = d.potential;
    const body =
      '<div class="calc-result">' +
        '<div class="calc-result__big">+' + U.money(p.monthly) + '</div>' +
        '<div class="calc-result__sub">miesięcznie, gdyby wypełnić wolne godziny</div>' +
      '</div>' +
      '<div class="dl mt-4">' +
        '<dt>Wolne godziny w tygodniu</dt><dd>' + U.num(p.freeHours, 1) + ' h</dd>' +
        '<dt>Średnia stawka</dt><dd>' + U.money(p.rate) + '</dd>' +
        '<dt>Potencjał roczny</dt><dd>' + U.money(p.yearly) + '</dd>' +
      '</div>' +
      '<button class="btn btn--soft btn--block mt-4" data-action="copyFreeSlots">' + icon('copy', 15) + ' Kopiuj wolne terminy</button>';
    return UI.card('Niewykorzystany potencjał', body, { subtitle: 'Na podstawie Twojego grafiku' });
  }

  function insightsSection() {
    const list = I().insights();
    if (!list.length) return '';
    return '<div class="section"><div class="section__head"><h2>' + icon('sparkles', 17) +
      ' Smart Insights</h2><p>Wnioski wyliczone z Twoich danych</p></div>' +
      '<div class="grid grid-auto-lg">' + list.map((x, i) =>
        L().insight(x).replace('class="insight ', 'style="animation-delay:' + (i * 40) + 'ms" class="insight ')).join('') +
      '</div></div>';
  }

  window.TF.Views.dashboard = {
    title: 'Dashboard',
    subtitle: function () {
      const st = S().settings();
      return st.appTagline || '';
    },
    render: function () {
      const d = C().dashboard();
      const w = C().weekSummary();
      return heroSection(d, w) +
        '<div class="section">' + kpis(d) + '</div>' +
        '<div class="section grid grid-2-1">' +
          '<div class="col gap-4">' + todaySection(d) + weekSection(w) + commandCenter(d) + revenueSection() + '</div>' +
          '<div class="col gap-4">' + nextLessonSection(d) + attentionSection() + goalSection(d) + potentialSection(d) + '</div>' +
        '</div>' +
        insightsSection();
    },
    mount: function (host) {
      // odliczanie do najbliższej lekcji
      const el = host.querySelector('[data-countdown]');
      if (!el) return;
      const id = el.getAttribute('data-countdown');
      window.TF.App.setTimer(function () {
        const l = S().repo('lessons').byId(id);
        if (!l || !el.isConnected) return;
        const c = C();
        const mins = c.minutesUntil(l);
        if (c.isNow(l)) el.innerHTML = 'Trwa teraz';
        else if (mins < 0) el.innerHTML = 'Po czasie';
        else el.innerHTML = U.relTime(mins) + ' <small>do startu</small>';
      }, 20000);
    }
  };
})();
