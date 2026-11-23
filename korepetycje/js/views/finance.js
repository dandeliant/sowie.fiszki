/* ============================================================
   TutorFlow — views/finance.js
   Pulpit finansowy: przychody, struktura, rentowność, rankingi.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const Ch = () => window.TF.Charts;
  const icon = window.TF.icon;

  const state = { range: 12 };

  function periods() {
    const c = C();
    const t = U.today();
    const weekFrom = U.startOfWeek(t);
    const mk = U.monthKey(t);
    const y = t.slice(0, 4);
    return {
      today: c.revenueBetween(t, t),
      week: c.revenueBetween(weekFrom, U.addDays(weekFrom, 6)),
      month: c.revenueMonth(mk),
      year: c.revenueYear(y),
      all: c.revenueAllTime()
    };
  }

  function kpiRow() {
    const p = periods();
    const cmp = C().monthComparison();
    const series = C().monthlySeries(8).map((m) => m.revenue);
    return '<div class="kpi-grid">' +
      UI.kpi({ label: 'Dzisiaj', icon: 'today', tone: 'info', value: U.money(p.today), foot: '<span>Rozliczone zajęcia</span>' }) +
      UI.kpi({ label: 'Ten tydzień', icon: 'calendar', tone: 'info', value: U.money(p.week), foot: '<span>' + U.fmtDate(U.startOfWeek(U.today()), 'short') + '–' + U.fmtDate(U.endOfWeek(U.today()), 'short') + '</span>' }) +
      UI.kpi({ label: 'Ten miesiąc', icon: 'wallet', tone: 'ok', value: U.money(p.month),
        foot: cmp.previous ? UI.trend(cmp.change) + '<span>vs ' + U.monthName(cmp.prevKey) + '</span>' : '<span>—</span>' }) +
      UI.kpi({ label: 'Ten rok', icon: 'chart', tone: '', value: U.money(p.year), foot: '<span>' + U.today().slice(0, 4) + '</span>' }) +
      UI.kpi({ label: 'Cały okres', icon: 'trending', tone: '', value: U.money(p.all),
        foot: '<span class="kpi__spark">' + Ch().sparkline(series, { width: 80, height: 26 }) + '</span>' }) +
      '</div>';
  }

  function revenueChart() {
    const series = C().monthlySeries(state.range);
    const cmp = C().monthComparison();
    const data = series.map((m) => ({
      label: m.label, fullLabel: m.fullLabel, value: m.revenue, sub: U.lessonsLabel(m.lessons)
    }));
    const goal = S().settings().monthlyGoal;
    return UI.card('Przychody miesięczne', Ch().bars(data, { height: 250, target: goal || 0 }), {
      subtitle: 'Najedź kursorem, aby zobaczyć dokładną wartość',
      action: '<div class="row gap-2">' +
        '<div class="segmented segmented--sm">' +
          [6, 12, 24].map((n) => '<button class="' + (state.range === n ? 'is-active' : '') + '" data-action="financeRange" data-range="' + n + '">' + n + ' mies.</button>').join('') +
        '</div>' + UI.trend(cmp.change) + '</div>'
    });
  }

  function profitChart() {
    const series = C().monthlySeries(Math.min(state.range, 12));
    const labels = series.map((m) => m.label);
    const chart = Ch().groupedBars(labels, [
      { name: 'Przychód', color: 'var(--c1)', values: series.map((m) => m.revenue) },
      { name: 'Koszty', color: 'var(--c5)', values: series.map((m) => m.expenses) },
      { name: 'Zysk', color: 'var(--c4)', values: series.map((m) => m.profit) }
    ], { height: 230 });
    const mk = U.monthKey(U.today());
    const rev = C().revenueMonth(mk), exp = C().expensesMonth(mk);
    return UI.card('Przychód, koszty, zysk', chart, {
      subtitle: U.monthLabel(mk) + ': ' + U.money(rev) + ' − ' + U.money(exp) + ' = ' + U.money(rev - exp),
      action: '<button class="btn btn--xs" data-action="go" data-route="#/expenses">Wydatki</button>'
    });
  }

  function structureCard() {
    const st = C().revenueStructure();
    const data = [
      { label: 'Stacjonarne', value: st.onsite, color: 'var(--c1)' },
      { label: 'Online', value: st.online, color: 'var(--c3)' }
    ].filter((d) => d.value > 0);
    const data2 = [
      { label: 'Indywidualne', value: st.individual, color: 'var(--c2)' },
      { label: 'Grupowe', value: st.group, color: 'var(--c4)' }
    ].filter((d) => d.value > 0);
    return UI.card('Struktura przychodów',
      '<div class="grid grid-2">' +
        '<div>' + Ch().donut(data, { size: 170, centerLabel: U.moneyShort(st.onsite + st.online), centerSub: 'łącznie' }) + '</div>' +
        '<div>' + Ch().donut(data2, { size: 170, centerLabel: U.moneyShort(st.individual + st.group), centerSub: 'wg formy' }) + '</div>' +
      '</div>', { subtitle: 'Cały okres' });
  }

  function subjectCard() {
    const data = C().revenueBySubject().slice(0, 6).map((x, i) => ({ label: x.label, value: x.value, color: Ch().PALETTE[i % 8] }));
    if (!data.length) return '';
    return UI.card('Przychód wg przedmiotu', Ch().donut(data, { size: 190 }));
  }

  function topStudentsCard() {
    const mk = U.monthKey(U.today());
    const top = C().topStudents(8, mk + '-01', U.endOfMonth(mk + '-01'));
    const allTime = C().topStudents(8);
    const source = top.length ? top : allTime;
    if (!source.length) return UI.card('Najbardziej dochodowi uczniowie', '<p class="dim small">Brak danych.</p>');
    return UI.card('Najbardziej dochodowi uczniowie',
      Ch().hbars(source.map((x) => ({
        label: x.name, value: x.value,
        html: '<span class="row gap-2">' + UI.avatar(x.student, 'sm') + U.esc(x.name) + '</span>'
      }))),
      { subtitle: top.length ? U.monthLabel(mk) : 'Cały okres' });
  }

  function ratesCard() {
    const c = C();
    const avg = c.avgHourlyRate();
    const eff = c.effectiveHourlyRate();
    const all = S().repo('lessons').all();
    const hours = c.hoursHeld(all);
    return UI.card('Stawki',
      '<div class="dl">' +
        '<dt>Średnia stawka godzinowa</dt><dd>' + U.money(avg) + '</dd>' +
        '<dt>Efektywna stawka godzinowa</dt><dd class="' + (eff > avg ? 'pos-up' : '') + '">' + U.money(eff) + '</dd>' +
        '<dt>Rzeczywisty czas zajęć</dt><dd>' + U.num(hours, 1) + ' h</dd>' +
        '<dt>Średnia długość lekcji</dt><dd>' + U.durLabel(Math.round(U.avg(all.filter(c.isHeld), (l) => l.duration) || 0)) + '</dd>' +
        '<dt>Średni przychód na ucznia</dt><dd>' + U.money(S().repo('students').all().length ? c.revenueAllTime() / S().repo('students').all().length : 0) + '</dd>' +
      '</div>' +
      '<div class="insight insight--info mt-4"><span class="insight__ico">' + icon('info', 15) + '</span>' +
        '<div class="insight__body small">Efektywna stawka to cały przychód podzielony przez faktycznie przepracowane godziny — uwzględnia płatne odwołania.</div></div>');
  }

  function cashflowCard() {
    const t = U.today();
    const mk = U.monthKey(t);
    const from = mk + '-01', to = U.endOfMonth(from);
    const cash = C().cashIn(from, to);
    const billed = C().revenueMonth(mk);
    const unpaid = C().unpaidTotal();
    return UI.card('Przepływ gotówki',
      '<div class="dl">' +
        '<dt>Zafakturowane w miesiącu</dt><dd>' + U.money(billed) + '</dd>' +
        '<dt>Wpłaty otrzymane</dt><dd class="pos-up">' + U.money(cash) + '</dd>' +
        '<dt>Zaległości ogółem</dt><dd class="' + (unpaid ? 'pos-down' : '') + '">' + U.money(unpaid) + '</dd>' +
      '</div>' +
      (unpaid ? '<button class="btn btn--block btn--soft mt-4" data-action="go" data-route="#/payments">' +
        icon('card', 15) + ' Zobacz zaległości</button>' : ''),
      { subtitle: U.monthLabel(mk) });
  }

  window.TF.Views.finance = {
    title: 'Finanse',
    subtitle: function () { return 'Przychód w tym miesiącu: ' + U.money(C().revenueMonth(U.monthKey(U.today()))); },
    render: function () {
      return '<div class="section" style="margin-top:0">' + kpiRow() + '</div>' +
        '<div class="section grid grid-2-1">' +
          '<div class="col gap-4">' + revenueChart() + profitChart() + structureCard() + '</div>' +
          '<div class="col gap-4">' + topStudentsCard() + ratesCard() + cashflowCard() + subjectCard() + '</div>' +
        '</div>';
    },
    setRange: function (n) { state.range = n; },
    state: state
  };
})();
