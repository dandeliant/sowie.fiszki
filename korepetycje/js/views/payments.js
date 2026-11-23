/* ============================================================
   TutorFlow — views/payments.js
   Płatności, salda uczniów i pakiety lekcji.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const icon = window.TF.icon;

  const state = { tab: 'due' };

  function kpiRow() {
    const c = C();
    const t = U.today();
    const mk = U.monthKey(t);
    const from = mk + '-01', to = U.endOfMonth(from);
    const cash = c.cashIn(from, to);
    const unpaid = c.unpaidLessons();
    const overdue = c.overdueLessons();
    const pkgs = S().repo('packages').where((p) => p.usedCount < p.lessonsCount);
    return '<div class="kpi-grid">' +
      UI.kpi({ label: 'Wpłaty w tym miesiącu', icon: 'wallet', tone: 'ok', value: U.money(cash),
        foot: '<span>' + S().repo('payments').where((p) => p.date >= from && p.date <= to).length + ' wpłat</span>' }) +
      UI.kpi({ label: 'Do zapłaty', icon: 'card', tone: unpaid.length ? 'warn' : 'ok', value: U.money(c.unpaidTotal()),
        foot: '<span>' + U.lessonsLabel(unpaid.length) + '</span>' }) +
      UI.kpi({ label: 'Zaległe (>7 dni)', icon: 'alert', tone: overdue.length ? 'bad' : 'ok', value: U.money(U.sum(overdue, c.lessonValue)),
        foot: '<span>' + U.lessonsLabel(overdue.length) + '</span>' }) +
      UI.kpi({ label: 'Aktywne pakiety', icon: 'receipt', tone: 'info', value: pkgs.length,
        foot: '<span>' + U.sum(pkgs, (p) => p.lessonsCount - p.usedCount) + ' lekcji pozostało</span>' }) +
      '</div>';
  }

  function balances() {
    const c = C();
    const rows = S().repo('students').all().map(function (s) {
      const f = c.studentFinance(s.id);
      return { s: s, f: f };
    }).filter((x) => x.f.due > 0);
    const sorted = U.sortBy(rows, (x) => x.f.due, 'desc');

    if (!sorted.length) {
      return UI.card('Salda uczniów', UI.empty({
        icon: 'checkCircle', title: 'Brak zaległości',
        text: 'Wszyscy uczniowie mają rozliczone zajęcia. Świetna robota!'
      }), { noPad: true });
    }
    return UI.card('Salda uczniów — do rozliczenia',
      sorted.map(function (x) {
        const unpaid = c.unpaidLessons(x.s.id);
        const oldest = U.sortBy(unpaid, (l) => l.date)[0];
        const days = oldest ? U.diffDays(oldest.date, U.today()) : 0;
        return '<div class="lesson-row">' +
          UI.avatar(x.s) +
          '<div class="lesson-row__main">' +
            '<strong>' + U.esc(S().studentName(x.s.id)) + '</strong>' +
            '<div class="lesson-row__meta">' +
              '<span>' + U.lessonsLabel(unpaid.length) + '</span><span>·</span>' +
              '<span>wartość ' + U.money(x.f.billed) + '</span><span>·</span>' +
              '<span>zapłacono ' + U.money(x.f.paid) + '</span>' +
              (days > 14 ? '<span class="badge badge--bad">' + days + ' dni</span>' : days > 7 ? '<span class="badge badge--warn">' + days + ' dni</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="col right gap-1"><span class="lesson-row__price pos-down">' + U.money(x.f.due) + '</span>' +
            '<span class="tiny dim">do zapłaty</span></div>' +
          '<div class="lesson-row__actions">' +
            '<button class="btn btn--xs btn--brand" data-action="addPayment" data-student="' + x.s.id + '">Rozlicz</button>' +
            '<button class="icon-btn icon-btn--sm" data-action="go" data-route="#/students/' + x.s.id + '">' + icon('arrowRight', 15) + '</button>' +
          '</div>' +
          '</div>';
      }).join(''),
      { noPad: true, subtitle: U.money(c.unpaidTotal()) + ' od ' + U.studentsLabel(sorted.length) });
  }

  function paymentsTable() {
    const pays = U.sortBy(S().repo('payments').all(), (p) => p.date, 'desc');
    if (!pays.length) {
      return UI.card('Historia płatności', UI.empty({
        icon: 'wallet', title: 'Brak zarejestrowanych płatności',
        text: 'Zapisz pierwszą wpłatę — saldo ucznia zaktualizuje się automatycznie.',
        ctaLabel: 'Dodaj płatność', ctaAction: 'addPayment'
      }), { noPad: true });
    }
    return UI.card('Historia płatności',
      '<div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Data</th><th>Uczeń</th><th>Metoda</th><th>Opis</th><th class="num">Kwota</th><th></th></tr></thead><tbody>' +
      pays.slice(0, 120).map(function (p) {
        const m = M.PAYMENT_METHOD[p.method] || { icon: '', label: p.method };
        return '<tr>' +
          '<td class="nowrap">' + U.fmtDate(p.date) + '<div class="tiny dim">' + U.ago(p.date) + '</div></td>' +
          '<td><div class="row gap-2">' + UI.avatar(S().student(p.studentId), 'sm') +
            '<span class="truncate">' + U.esc(S().studentName(p.studentId)) + '</span></div></td>' +
          '<td class="small nowrap">' + m.icon + ' ' + U.esc(m.label) + '</td>' +
          '<td class="small dim truncate" style="max-width:220px">' + U.esc(p.note || (p.lessonIds.length ? U.lessonsLabel(p.lessonIds.length) : '—')) + '</td>' +
          '<td class="num bold">' + U.money(p.amount) + '</td>' +
          '<td class="actions-cell"><button class="icon-btn icon-btn--sm" data-action="deletePayment" data-id="' + p.id + '" data-tip-left data-tip="Usuń">' + icon('trash', 14) + '</button></td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>',
      { noPad: true, subtitle: pays.length + ' wpłat · ' + U.money(U.sum(pays, (p) => p.amount)) + ' łącznie' });
  }

  function packagesCard() {
    const pkgs = U.sortBy(S().repo('packages').all(), (p) => p.purchasedDate, 'desc');
    if (!pkgs.length) {
      return UI.card('Pakiety lekcji', UI.empty({
        icon: 'receipt', title: 'Brak pakietów',
        text: 'Sprzedaj pakiet, np. 10 lekcji × 80 zł. TutorFlow policzy wykorzystanie.',
        ctaLabel: 'Sprzedaj pakiet', ctaAction: 'addPackage'
      }), { noPad: true });
    }
    return UI.card('Pakiety lekcji',
      pkgs.map(function (p) {
        const left = p.lessonsCount - p.usedCount;
        return '<div class="mat-item" style="align-items:flex-start">' +
          '<span class="mat-item__ico mat-exercise">🎟️</span>' +
          '<div class="grow" style="min-width:0">' +
            '<div class="row-between"><strong>' + U.esc(S().studentName(p.studentId)) + '</strong>' +
              '<span class="badge ' + (left === 0 ? '' : left <= 2 ? 'badge--warn' : 'badge--brand') + '">' +
              (left === 0 ? 'wykorzystany' : 'pozostało ' + left) + '</span></div>' +
            '<div class="lesson-row__meta mb-2">' + p.lessonsCount + ' × ' + U.money(p.pricePerLesson) +
              ' = ' + U.money(p.total) + ' · ' + U.fmtDate(p.purchasedDate) + '</div>' +
            UI.progress(U.pct(p.usedCount, p.lessonsCount), left <= 2 && left > 0 ? 'warn' : left === 0 ? 'ok' : '') +
            '<div class="tiny dim mt-1">Wykorzystano ' + p.usedCount + '/' + p.lessonsCount + '</div>' +
          '</div></div>';
      }).join(''),
      { noPad: true, action: '<button class="btn btn--sm" data-action="addPackage"><span class="plus">+</span> Pakiet</button>' });
  }

  function methodsCard() {
    const pays = S().repo('payments').all();
    if (!pays.length) return '';
    const map = {};
    pays.forEach((p) => { map[p.method] = (map[p.method] || 0) + p.amount; });
    const data = Object.keys(map).map((k, i) => ({
      label: (M.PAYMENT_METHOD[k] || { label: k }).label, value: map[k], color: window.TF.Charts.PALETTE[i % 8]
    }));
    return UI.card('Metody płatności', window.TF.Charts.donut(data, { size: 170 }));
  }

  window.TF.Views.payments = {
    title: 'Płatności',
    subtitle: function () {
      const t = C().unpaidTotal();
      return t > 0 ? 'Do rozliczenia: ' + U.money(t) : 'Wszystko rozliczone';
    },
    render: function () {
      return '<div class="row-between mb-4 wrap gap-3">' +
          '<div class="chips">' +
            '<button class="chip ' + (state.tab === 'due' ? 'is-active' : '') + '" data-action="paymentsTab" data-tab="due">Salda i zaległości</button>' +
            '<button class="chip ' + (state.tab === 'history' ? 'is-active' : '') + '" data-action="paymentsTab" data-tab="history">Historia wpłat</button>' +
            '<button class="chip ' + (state.tab === 'packages' ? 'is-active' : '') + '" data-action="paymentsTab" data-tab="packages">Pakiety</button>' +
          '</div>' +
          '<div class="row gap-2">' +
            '<button class="btn btn--sm" data-action="addPackage">' + icon('receipt', 14) + ' Pakiet</button>' +
            '<button class="btn btn--brand btn--sm" data-action="addPayment"><span class="plus">+</span> Płatność</button>' +
          '</div>' +
        '</div>' +
        '<div class="section" style="margin-top:0">' + kpiRow() + '</div>' +
        '<div class="section grid grid-2-1">' +
          '<div class="col gap-4">' +
            (state.tab === 'history' ? paymentsTable() : state.tab === 'packages' ? packagesCard() : balances()) +
          '</div>' +
          '<div class="col gap-4">' + methodsCard() + packagesSummary() + '</div>' +
        '</div>';
    },
    setTab: function (t) { state.tab = t; },
    state: state
  };

  function packagesSummary() {
    const c = C();
    const rows = S().repo('students').all()
      .map((s) => ({ s: s, due: c.unpaidTotal(s.id) }))
      .filter((x) => x.due > 0);
    const total = U.sum(rows, (x) => x.due);
    return UI.card('Podsumowanie należności',
      '<div class="dl">' +
        '<dt>Uczniowie z zaległością</dt><dd>' + rows.length + '</dd>' +
        '<dt>Łączna kwota</dt><dd class="' + (total ? 'pos-down' : '') + '">' + U.money(total) + '</dd>' +
        '<dt>Średnia zaległość</dt><dd>' + U.money(rows.length ? total / rows.length : 0) + '</dd>' +
        '<dt>Najstarsza zaległość</dt><dd>' + (function () {
          const all = U.sortBy(c.unpaidLessons(), (l) => l.date);
          return all.length ? U.diffDays(all[0].date, U.today()) + ' dni' : '—';
        })() + '</dd>' +
      '</div>');
  }
})();
