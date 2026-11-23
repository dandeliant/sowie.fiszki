/* ============================================================
   TutorFlow — views/reports.js
   Automatyczne podsumowanie miesiąca + eksport.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const Ch = () => window.TF.Charts;
  const icon = window.TF.icon;

  const state = { month: null };

  function month() {
    if (!state.month) state.month = U.monthKey(U.today());
    return state.month;
  }

  function monthOptions() {
    const keys = U.lastMonths(U.today(), 18).reverse();
    return keys.map((k) => '<option value="' + k + '"' + (k === month() ? ' selected' : '') + '>' + U.monthLabel(k) + '</option>').join('');
  }

  function sheet() {
    const mk = month();
    const sum = C().monthSummary(mk);
    const from = mk + '-01', to = U.endOfMonth(from);
    const top = C().topStudents(5, from, to);
    const cmp = sum.comparison;
    const st = S().settings();

    return '<div class="report-sheet" id="reportSheet">' +
      '<div class="row-between wrap gap-3">' +
        '<div><h2>Raport miesięczny</h2>' +
          '<p class="muted">' + U.monthLabel(mk) + (st.tutorName ? ' · ' + U.esc(st.tutorName) : '') + '</p></div>' +
        '<div class="col right"><div class="tiny dim">Wygenerowano</div><div class="small bold">' + U.fmtDate(U.today(), 'long') + '</div></div>' +
      '</div>' +

      '<div class="report-grid">' +
        cell('Lekcje', sum.lessons) +
        cell('Godziny', U.num(sum.hours, 1) + ' h') +
        cell('Przychód', U.money(sum.revenue)) +
        cell('Koszty', U.money(sum.expenses)) +
        cell('Zysk', U.money(sum.profit), sum.profit >= 0 ? 'pos-up' : 'pos-down') +
        cell('Odwołane lekcje', sum.cancelled, sum.cancelled ? 'pos-down' : '') +
        cell('Nowi uczniowie', (sum.newStudents ? '+' : '') + sum.newStudents, sum.newStudents ? 'pos-up' : '') +
        cell('Średnia stawka', U.money(sum.avgRate)) +
      '</div>' +

      '<div class="grid grid-2 mt-6">' +
        '<div>' +
          '<h3 class="mb-3">Szczegóły</h3>' +
          '<div class="dl">' +
            '<dt>Uczniowie z zajęciami</dt><dd>' + sum.students + '</dd>' +
            '<dt>Wszystkie wpisy w kalendarzu</dt><dd>' + sum.lessonsAll + '</dd>' +
            '<dt>Nieobecności</dt><dd>' + sum.noShow + '</dd>' +
            '<dt>Frekwencja</dt><dd>' + U.pctLabel(sum.attendance, 1) + '</dd>' +
            '<dt>Wykorzystanie grafiku</dt><dd>' + U.pctLabel(sum.utilization, 1) + '</dd>' +
            '<dt>Efektywna stawka godzinowa</dt><dd>' + U.money(sum.effectiveRate) + '</dd>' +
            '<dt>Nieopłacone w miesiącu</dt><dd class="' + (sum.unpaid ? 'pos-down' : '') + '">' + U.money(sum.unpaid) + '</dd>' +
            '<dt>Zakończone współprace</dt><dd>' + sum.lostStudents + '</dd>' +
            '<dt>Zmiana vs poprzedni miesiąc</dt><dd>' + (cmp.previous ? UI.trend(cmp.change) : '—') + '</dd>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<h3 class="mb-3">Najbardziej dochodowi uczniowie</h3>' +
          (top.length ? Ch().hbars(top.map((x) => ({ label: x.name, value: x.value }))) : '<p class="dim small">Brak danych.</p>') +
        '</div>' +
      '</div>' +

      '<div class="mt-6"><h3 class="mb-3">Przychód dzień po dniu</h3>' +
        Ch().bars(C().dailySeries(from, to).map((d) => ({
          label: d.key.slice(8), fullLabel: U.fmtDate(d.key, 'long'), value: d.revenue, sub: U.lessonsLabel(d.lessons)
        })), { height: 200, barWidth: 14 }) + '</div>' +

      '<p class="tiny dim mt-6 center">Raport wygenerowany automatycznie przez ' + U.esc(st.appName || 'TutorFlow') + '.</p>' +
      '</div>';
  }

  function cell(label, value, cls) {
    return '<div class="report-cell"><small>' + U.esc(label) + '</small><strong class="' + (cls || '') + '">' + value + '</strong></div>';
  }

  function yearCard() {
    const y = U.today().slice(0, 4);
    const months = U.lastMonths(y + '-12-01', 12);
    const rows = months.map((mk) => C().monthSummary(mk));
    const totals = {
      lessons: U.sum(rows, (r) => r.lessons), hours: U.sum(rows, (r) => r.hours),
      revenue: U.sum(rows, (r) => r.revenue), expenses: U.sum(rows, (r) => r.expenses)
    };
    return UI.card('Podsumowanie roku ' + y,
      '<div class="table-wrap"><table class="table table--compact"><thead><tr>' +
      '<th>Miesiąc</th><th class="num">Lekcje</th><th class="num">Godziny</th><th class="num">Przychód</th>' +
      '<th class="num">Koszty</th><th class="num">Zysk</th></tr></thead><tbody>' +
      rows.map((r) => '<tr data-clickable data-action="reportMonth" data-month="' + r.key + '">' +
        '<td>' + U.cap(U.monthName(r.key)) + '</td>' +
        '<td class="num">' + r.lessons + '</td>' +
        '<td class="num">' + U.num(r.hours, 1) + '</td>' +
        '<td class="num">' + U.money(r.revenue) + '</td>' +
        '<td class="num">' + U.money(r.expenses) + '</td>' +
        '<td class="num bold ' + (r.profit >= 0 ? '' : 'pos-down') + '">' + U.money(r.profit) + '</td></tr>').join('') +
      '</tbody><tfoot><tr style="background:var(--surface-2)"><td class="bold">Razem</td>' +
      '<td class="num bold">' + totals.lessons + '</td>' +
      '<td class="num bold">' + U.num(totals.hours, 1) + '</td>' +
      '<td class="num bold">' + U.money(totals.revenue) + '</td>' +
      '<td class="num bold">' + U.money(totals.expenses) + '</td>' +
      '<td class="num bold">' + U.money(totals.revenue - totals.expenses) + '</td></tr></tfoot></table></div>',
      { noPad: true, subtitle: 'Kliknij miesiąc, aby zobaczyć raport' });
  }

  window.TF.Views.reports = {
    title: 'Raporty',
    subtitle: function () { return U.monthLabel(month()); },
    render: function () {
      return '<div class="row-between mb-4 wrap gap-3">' +
          '<select class="select" id="reportMonthSel" style="width:auto">' + monthOptions() + '</select>' +
          '<div class="row gap-2 wrap">' +
            '<button class="btn btn--sm" data-action="exportReportCsv">' + icon('download', 14) + ' CSV</button>' +
            '<button class="btn btn--sm" data-action="exportReportTxt">' + icon('copy', 14) + ' Tekst</button>' +
            '<button class="btn btn--brand btn--sm" data-action="printReport">' + icon('file', 14) + ' Eksportuj / drukuj</button>' +
          '</div>' +
        '</div>' +
        sheet() +
        '<div class="section">' + yearCard() + '</div>';
    },
    mount: function (host) {
      const sel = host.querySelector('#reportMonthSel');
      if (sel) sel.addEventListener('change', function () {
        state.month = sel.value;
        window.TF.Router.refresh();
      });
    },
    setMonth: function (m) { state.month = m; },
    currentMonth: month,
    state: state
  };
})();
