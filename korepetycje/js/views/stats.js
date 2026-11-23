/* ============================================================
   TutorFlow — views/stats.js
   Analityka: obłożenie, heatmapa, retencja, rotacja uczniów,
   najbardziej dochodowe godziny i wolne okna.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const Ch = () => window.TF.Charts;
  const icon = window.TF.icon;

  function metrics() {
    const c = C();
    const all = S().repo('lessons').all();
    const students = S().repo('students').all();
    const ret = c.retention();
    const t = U.today();
    const weekFrom = U.startOfWeek(t);
    return '<div class="kpi-grid">' +
      UI.kpi({ label: 'Uczniowie', icon: 'users', tone: 'info', value: students.length,
        foot: '<span>' + ret.active + ' aktywnych · ' + ret.paused + ' na przerwie</span>' }) +
      UI.kpi({ label: 'Odbyte lekcje', icon: 'checkCircle', tone: 'ok', value: all.filter(c.isHeld).length,
        foot: '<span>' + U.num(c.hoursHeld(all), 1) + ' godzin łącznie</span>' }) +
      UI.kpi({ label: 'Frekwencja', icon: 'target', tone: c.attendance() >= 90 ? 'ok' : 'warn', value: U.pctLabel(c.attendance(), 1),
        foot: UI.progress(c.attendance(), 'ok') }) +
      UI.kpi({ label: 'Odwołania', icon: 'ban', tone: c.cancellationRate() < 10 ? 'ok' : 'warn', value: U.pctLabel(c.cancellationRate(), 1),
        foot: '<span>' + all.filter((l) => c.isCancelled(l)).length + ' odwołanych zajęć</span>' }) +
      UI.kpi({ label: 'Wykorzystanie grafiku', icon: 'clock', tone: '', value: U.pctLabel(c.utilization(weekFrom, U.addDays(weekFrom, 6)), 0),
        foot: '<span>w bieżącym tygodniu</span>' }) +
      UI.kpi({ label: 'Średnia współpraca', icon: 'flame', tone: '', value: U.num(ret.avgMonths, 1), unit: 'mies.',
        foot: '<span>' + (ret.longest ? 'Rekord: ' + ret.longest.name : '—') + '</span>' }) +
      UI.kpi({ label: 'Średnia stawka', icon: 'wallet', tone: '', value: U.money(c.avgHourlyRate()),
        foot: '<span>Efektywna: ' + U.money(c.effectiveHourlyRate()) + '</span>' }) +
      UI.kpi({ label: 'Średni przychód / mies.', icon: 'chart', tone: '', value: U.money(c.baselineMonthly(4)),
        foot: '<span>Z ostatnich pełnych miesięcy</span>' }) +
      '</div>';
  }

  /* ---------------- heatmapa ---------------- */
  function heatCard() {
    const h = C().heatmap(8);
    const cols = h.hours.length;
    const color = (p) => {
      if (p <= 0) return 'var(--surface-3)';
      const a = 0.12 + (p / 100) * 0.78;
      return 'rgba(99,102,241,' + a.toFixed(2) + ')';
    };
    const head = '<div class="heat__head" style="--hcols:' + cols + '"><span></span>' +
      h.hours.map((x) => '<span>' + x + '</span>').join('') + '</div>';
    const rows = h.rows.map((r) =>
      '<div class="heat__row" style="--hcols:' + cols + '">' +
        '<span class="heat__lab ' + (r.isWork ? '' : 'dim') + '">' + r.label + '</span>' +
        r.cells.map((c) => '<span class="heat__cell" style="background:' + color(c.pct) + '" ' +
          'data-tip="' + U.DOW_LONG[r.dow] + ' ' + c.hour + ':00 — ' + U.pctLabel(c.pct, 0) + ' obłożenia (' + c.count + ' zajęć)"></span>').join('') +
      '</div>').join('');

    return UI.card('Heatmapa obłożenia',
      '<div style="overflow-x:auto"><div style="min-width:' + Math.max(360, cols * 34 + 50) + 'px">' +
      head + '<div class="heat mt-2">' + rows + '</div></div></div>' +
      '<div class="row-between mt-4 wrap gap-3">' +
        '<div class="heat-legend"><span>mniej</span>' +
          [0, 25, 50, 75, 100].map((p) => '<i style="background:' + color(p) + '"></i>').join('') + '<span>więcej</span></div>' +
        '<span class="tiny dim">Na podstawie ostatnich ' + h.weeks + ' tygodni</span>' +
      '</div>',
      { subtitle: 'Które godziny są najbardziej obłożone' });
  }

  /* ---------------- dochodowe godziny ---------------- */
  function bestHoursCard() {
    const rows = C().bestHours().slice(0, 8);
    if (!rows.length) return UI.card('Najbardziej dochodowe godziny', '<p class="dim small">Za mało danych.</p>');
    return UI.card('Najbardziej dochodowe godziny',
      Ch().hbars(rows.map((r) => ({
        label: U.pad(r.hour) + ':00 – ' + U.pad(r.hour + 1) + ':00',
        value: r.value
      })), { rank: false }),
      { subtitle: 'Suma przychodu wg godziny rozpoczęcia' });
  }

  /* ---------------- obłożenie dni ---------------- */
  function dayLoadCard() {
    const h = C().heatmap(8);
    const data = h.rows.map((r) => ({
      label: r.label, fullLabel: U.cap(U.DOW_LONG[r.dow]),
      value: U.avg(r.cells, (c) => c.pct),
      color: r.isWork ? 'var(--c1)' : 'var(--c8)'
    }));
    return UI.card('Wykorzystanie dni tygodnia',
      Ch().bars(data.map((d) => ({ label: d.label, fullLabel: d.fullLabel, value: Math.round(d.value), color: d.color })),
        { height: 190, money: false }),
      { subtitle: 'Średni procent obłożenia (ostatnie 8 tygodni)' });
  }

  /* ---------------- wolne godziny ---------------- */
  function freeCard() {
    const st = S().settings();
    const slots = C().freeSlots(U.today(), U.addDays(U.today(), 6), st.defaultDuration || 60);
    const byDow = U.groupBy(slots, (s) => s.dow);
    const suggestions = Object.keys(byDow).map((d) => ({
      dow: Number(d), first: byDow[d][0], count: byDow[d].length
    })).sort((a, b) => b.count - a.count);

    return UI.card('Najłatwiejsze godziny dla nowych uczniów',
      suggestions.length
        ? suggestions.slice(0, 6).map((x) =>
            '<div class="stat-row"><span class="stat-row__label">' + icon('clock', 15) +
            U.cap(U.DOW_LONG[x.dow]) + ' ' + U.fmtTime(x.first.start) + '</span>' +
            '<span class="stat-row__value small dim">' + x.count + ' ' + U.plural(x.count, 'wolne okno', 'wolne okna', 'wolnych okien') + '</span></div>').join('') +
          '<button class="btn btn--soft btn--block mt-4" data-action="copyFreeSlots">' + icon('copy', 15) + ' Kopiuj listę terminów</button>'
        : '<p class="dim small">Grafik jest pełny — brak wolnych okien w tym tygodniu.</p>',
      { subtitle: slots.length + ' wolnych okien w najbliższych 7 dniach' });
  }

  /* ---------------- rotacja uczniów ---------------- */
  function flowCard() {
    const flow = C().studentFlow(8);
    return UI.card('Nowi i utraceni uczniowie',
      Ch().groupedBars(flow.map((f) => f.label), [
        { name: 'Nowi', color: 'var(--c4)', values: flow.map((f) => f.joined) },
        { name: 'Zakończyli', color: 'var(--c6)', values: flow.map((f) => f.left) }
      ], { height: 200 }) +
      '<div class="table-wrap mt-3"><table class="table table--compact"><thead><tr><th>Miesiąc</th>' +
      '<th class="num">Nowi</th><th class="num">Zakończyli</th><th class="num">Bilans</th></tr></thead><tbody>' +
      flow.slice(-6).reverse().map((f) => '<tr><td>' + U.monthLabel(f.key) + '</td>' +
        '<td class="num pos-up">' + (f.joined ? '+' + f.joined : '0') + '</td>' +
        '<td class="num pos-down">' + (f.left ? '−' + f.left : '0') + '</td>' +
        '<td class="num bold ' + (f.net > 0 ? 'pos-up' : f.net < 0 ? 'pos-down' : '') + '">' +
        (f.net > 0 ? '+' : '') + f.net + '</td></tr>').join('') +
      '</tbody></table></div>',
      { subtitle: 'Rotacja w ostatnich miesiącach' });
  }

  /* ---------------- retencja ---------------- */
  function retentionCard() {
    const ret = C().retention();
    const all = S().repo('students').all();
    const buckets = [
      { label: '< 3 mies.', min: 0, max: 3 },
      { label: '3–6 mies.', min: 3, max: 6 },
      { label: '6–12 mies.', min: 6, max: 12 },
      { label: '> 12 mies.', min: 12, max: 999 }
    ].map((b, i) => ({
      label: b.label,
      value: all.filter((s) => { const m = C().cooperationMonths(s.id); return m >= b.min && m < b.max; }).length,
      color: Ch().PALETTE[i]
    })).filter((b) => b.value > 0);

    return UI.card('Analiza retencji',
      '<div class="dl">' +
        '<dt>Średni czas współpracy</dt><dd>' + U.num(ret.avgMonths, 1) + ' mies.</dd>' +
        '<dt>Średnia (aktywni)</dt><dd>' + U.num(ret.avgActiveMonths, 1) + ' mies.</dd>' +
        '<dt>Zakończone współprace</dt><dd>' + ret.ended + '</dd>' +
        '<dt>Na przerwie</dt><dd>' + ret.paused + '</dd>' +
      '</div>' +
      (buckets.length ? '<div class="mt-4">' + Ch().hbars(buckets.map((b) => ({ label: b.label, value: b.value, color: b.color })),
        { rank: false, money: false, unit: ' os.' }) + '</div>' : ''));
  }

  /* ---------------- odwołania wg dnia ---------------- */
  function cancelCard() {
    const rows = C().cancellationsByDow().filter((r) => r.total > 0);
    if (!rows.length) return '';
    return UI.card('Odwołania wg dnia tygodnia',
      Ch().bars(rows.map((r) => ({
        label: r.label, fullLabel: U.cap(U.DOW_LONG[r.dow]),
        value: Math.round(r.pct), color: r.pct > 20 ? 'var(--c6)' : 'var(--c5)',
        sub: r.cancelled + ' z ' + r.total
      })), { height: 180, money: false }),
      { subtitle: 'Procent zajęć, które nie doszły do skutku' });
  }

  /* ---------------- lekcje w czasie ---------------- */
  function lessonsChart() {
    const series = C().monthlySeries(12);
    return UI.card('Liczba lekcji i godzin',
      Ch().groupedBars(series.map((m) => m.label), [
        { name: 'Lekcje', color: 'var(--c1)', values: series.map((m) => m.lessons) },
        { name: 'Godziny', color: 'var(--c3)', values: series.map((m) => Math.round(m.hours)) }
      ], { height: 210 }),
      { subtitle: 'Ostatnie 12 miesięcy' });
  }

  window.TF.Views.stats = {
    title: 'Statystyki',
    subtitle: 'Jak rozwija się Twój biznes',
    render: function () {
      return '<div class="section" style="margin-top:0">' + metrics() + '</div>' +
        '<div class="section grid grid-2-1">' +
          '<div class="col gap-4">' + heatCard() + lessonsChart() + flowCard() + '</div>' +
          '<div class="col gap-4">' + freeCard() + bestHoursCard() + retentionCard() + '</div>' +
        '</div>' +
        '<div class="section grid grid-2">' + dayLoadCard() + cancelCard() + '</div>' +
        '<div class="section"><div class="section__head"><h2>' + icon('sparkles', 17) + ' Wnioski</h2></div>' +
        '<div class="grid grid-auto-lg">' + window.TF.Insights.insights().map((x) => L().insight(x)).join('') + '</div></div>';
    }
  };
})();
