/* ============================================================
   TutorFlow — views/expenses.js
   Koszty prowadzenia korepetycji i rentowność.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const Ch = () => window.TF.Charts;
  const icon = window.TF.icon;

  const state = { category: 'all' };

  function kpiRow() {
    const c = C();
    const mk = U.monthKey(U.today());
    const y = U.today().slice(0, 4);
    const monthExp = c.expensesMonth(mk);
    const yearExp = U.sum(S().repo('expenses').where((e) => e.date.slice(0, 4) === y), (e) => e.amount);
    const rev = c.revenueMonth(mk);
    const profit = rev - monthExp;
    const margin = rev ? U.pct(profit, rev) : 0;
    return '<div class="kpi-grid">' +
      UI.kpi({ label: 'Przychód (miesiąc)', icon: 'wallet', tone: 'ok', value: U.money(rev), foot: '<span>' + U.monthLabel(mk) + '</span>' }) +
      UI.kpi({ label: 'Koszty (miesiąc)', icon: 'receipt', tone: 'warn', value: U.money(monthExp),
        foot: '<span>' + S().repo('expenses').where((e) => U.monthKey(e.date) === mk).length + ' pozycji</span>' }) +
      UI.kpi({ label: 'Zysk (miesiąc)', icon: 'trending', tone: profit >= 0 ? 'ok' : 'bad', value: U.money(profit),
        foot: '<span>Marża ' + U.pctLabel(margin, 0) + '</span>' }) +
      UI.kpi({ label: 'Koszty w roku', icon: 'chart', tone: '', value: U.money(yearExp),
        foot: '<span>Średnio ' + U.money(yearExp / Math.max(1, Number(U.today().slice(5, 7)))) + '/mies.</span>' }) +
      '</div>';
  }

  function table() {
    let list = U.sortBy(S().repo('expenses').all(), (e) => e.date, 'desc');
    if (state.category !== 'all') list = list.filter((e) => e.category === state.category);
    if (!list.length) {
      return UI.card('Wydatki', UI.empty({
        icon: 'receipt', title: 'Brak wydatków',
        text: 'Dodaj koszty — książki, druk, oprogramowanie, dojazdy — a TutorFlow policzy realny zysk.',
        ctaLabel: 'Dodaj wydatek', ctaAction: 'addExpense'
      }), { noPad: true });
    }
    return UI.card('Wydatki',
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Data</th><th>Kategoria</th><th>Opis</th><th class="num">Kwota</th><th></th></tr></thead><tbody>' +
      list.map(function (e) {
        const cat = M.EXPENSE_CATEGORY[e.category] || M.EXPENSE_CATEGORY.other;
        return '<tr data-clickable data-action="editExpense" data-id="' + e.id + '">' +
          '<td class="nowrap">' + U.fmtDate(e.date) + '</td>' +
          '<td class="nowrap"><span class="badge">' + cat.icon + ' ' + U.esc(cat.label) + '</span></td>' +
          '<td class="small">' + U.esc(e.description || '—') + '</td>' +
          '<td class="num bold">' + U.money(e.amount) + '</td>' +
          '<td class="actions-cell"><button class="icon-btn icon-btn--sm" data-action="editExpense" data-id="' + e.id + '">' + icon('edit', 14) + '</button></td>' +
          '</tr>';
      }).join('') +
      '</tbody><tfoot><tr style="background:var(--surface-2)"><td colspan="3" class="bold">Razem</td>' +
      '<td class="num bold">' + U.money(U.sum(list, (e) => e.amount)) + '</td><td></td></tr></tfoot></table></div>',
      { noPad: true, subtitle: list.length + ' pozycji' });
  }

  function categoryChart() {
    const map = {};
    S().repo('expenses').all().forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    const data = U.sortBy(Object.keys(map).map((k, i) => ({
      label: (M.EXPENSE_CATEGORY[k] || { label: k }).label, value: map[k], color: Ch().PALETTE[i % 8]
    })), (x) => x.value, 'desc');
    if (!data.length) return '';
    return UI.card('Struktura kosztów', Ch().donut(data, { size: 180 }));
  }

  function trendChart() {
    const series = C().monthlySeries(12);
    return UI.card('Koszty w czasie',
      Ch().bars(series.map((m) => ({ label: m.label, fullLabel: m.fullLabel, value: m.expenses })), { height: 200, color: 'var(--c5)' }),
      { subtitle: 'Ostatnie 12 miesięcy' });
  }

  function profitCard() {
    const series = C().monthlySeries(12);
    const totalRev = U.sum(series, (m) => m.revenue);
    const totalExp = U.sum(series, (m) => m.expenses);
    return UI.card('Rentowność (12 miesięcy)',
      '<div class="calc-result"><div class="calc-result__big">' + U.money(totalRev - totalExp) + '</div>' +
      '<div class="calc-result__sub">zysk netto</div></div>' +
      '<div class="dl mt-4">' +
        '<dt>Przychód</dt><dd>' + U.money(totalRev) + '</dd>' +
        '<dt>Koszty</dt><dd class="pos-down">−' + U.money(totalExp) + '</dd>' +
        '<dt>Marża</dt><dd>' + U.pctLabel(totalRev ? U.pct(totalRev - totalExp, totalRev) : 0, 1) + '</dd>' +
        '<dt>Koszt na godzinę zajęć</dt><dd>' + U.money(function () {
          const h = C().hoursHeld(S().repo('lessons').all());
          return h ? totalExp / h : 0;
        }()) + '</dd>' +
      '</div>');
  }

  window.TF.Views.expenses = {
    title: 'Wydatki',
    subtitle: function () { return 'Koszty w tym miesiącu: ' + U.money(C().expensesMonth(U.monthKey(U.today()))); },
    render: function () {
      const cats = ['all'].concat(Object.keys(M.EXPENSE_CATEGORY));
      return '<div class="row-between mb-4 wrap gap-3">' +
          '<div class="chips">' + cats.map((k) => {
            const label = k === 'all' ? 'Wszystkie' : M.EXPENSE_CATEGORY[k].icon + ' ' + M.EXPENSE_CATEGORY[k].label;
            const n = k === 'all' ? S().repo('expenses').all().length : S().repo('expenses').where((e) => e.category === k).length;
            if (k !== 'all' && !n) return '';
            return '<button class="chip ' + (state.category === k ? 'is-active' : '') + '" data-action="expenseCat" data-cat="' + k + '">' +
              label + '<span class="chip__count">' + n + '</span></button>';
          }).join('') + '</div>' +
          '<button class="btn btn--brand btn--sm" data-action="addExpense"><span class="plus">+</span> Dodaj wydatek</button>' +
        '</div>' +
        '<div class="section" style="margin-top:0">' + kpiRow() + '</div>' +
        '<div class="section grid grid-2-1">' +
          '<div class="col gap-4">' + table() + trendChart() + '</div>' +
          '<div class="col gap-4">' + profitCard() + categoryChart() + '</div>' +
        '</div>';
    },
    setCategory: function (c) { state.category = c; },
    state: state
  };
})();
