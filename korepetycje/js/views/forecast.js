/* ============================================================
   TutorFlow — views/forecast.js
   Prognoza miesiąca i roku, scenariusze „co jeśli”, tryb
   planowania i analiza niewykorzystanego potencjału.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const Ch = () => window.TF.Charts;
  const icon = window.TF.icon;

  const state = { priceDelta: 10, newPerWeek: 2, newPrice: null, targetIncome: null };

  /* ---------------- prognoza miesiąca ---------------- */
  function monthCard() {
    const f = C().monthForecast();
    const pctDone = f.forecast ? U.pct(f.earned, f.forecast) : 0;
    return UI.card('Prognoza miesiąca',
      '<div class="goal-ring">' +
        UI.ring(pctDone, 110, U.pctLabel(pctDone, 0), 'zrealizowane') +
        '<div class="goal-ring__info">' +
          '<div class="dl">' +
            '<dt>Zarobiono</dt><dd>' + U.money(f.earned) + '</dd>' +
            '<dt>Zaplanowane</dt><dd>' + U.money(f.planned) + '</dd>' +
            '<dt>Prognoza</dt><dd style="font-size:var(--fs-lg)">' + U.money(f.forecast) + '</dd>' +
            '<dt>Możliwy wynik</dt><dd class="dim">' + U.moneyShort(f.low) + ' – ' + U.moneyShort(f.high) + '</dd>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mt-4">' + UI.progress(pctDone) + '</div>' +
      '<div class="row-between tiny dim mt-2"><span>' + f.lessonsDone + ' odbytych</span>' +
      '<span>' + f.lessonsPlanned + ' zaplanowanych</span></div>' +
      '<div class="insight insight--info mt-4"><span class="insight__ico">' + icon('info', 15) + '</span>' +
        '<div class="insight__body small">Prognoza uwzględnia Twój historyczny wskaźnik odwołań (' +
        U.pctLabel(f.cancelRate, 1) + ').</div></div>',
      { subtitle: U.monthLabel(f.key) });
  }

  /* ---------------- prognoza roczna ---------------- */
  function yearCard() {
    const y = C().yearForecast();
    const data = y.months.map((m) => ({
      label: m.label, fullLabel: U.monthLabel(m.key), value: m.value, kind: m.kind,
      sub: m.kind === 'actual' ? 'wykonanie' : m.kind === 'forecast' ? 'prognoza bieżącego miesiąca' : 'szacunek'
    }));
    return UI.card('Prognoza roczna ' + y.year, Ch().bars(data, { height: 240 }), {
      subtitle: 'Szacunek: ' + U.money(y.total) + ' (zakres ' + U.moneyShort(y.low) + '–' + U.moneyShort(y.high) + ')',
      action: '<span class="badge badge--brand">' + U.money(y.total) + '</span>',
      foot: '<div class="row gap-4 wrap tiny dim">' +
        '<span>Pełne słupki = dane rzeczywiste</span>' +
        '<span>Przerywane = szacunek na podstawie średniej i sezonowości</span>' +
        '<span>Baza: ' + U.money(y.baseline) + '/mies.</span></div>'
    });
  }

  /* ---------------- scenariusze cenowe ---------------- */
  function priceCard() {
    const deltas = [5, 10, 15, 20];
    const cur = C().monthForecast().forecast;
    return UI.card('Co jeśli podniosę ceny?',
      '<div class="scenario-grid" id="priceScenarios">' +
        deltas.map(function (d) {
          const r = C().priceIncreaseImpact(d);
          return '<div class="scenario ' + (state.priceDelta === d ? 'is-active' : '') + '" data-action="setPriceDelta" data-delta="' + d + '">' +
            '<small>+' + d + ' ' + U.curSymbol() + ' / 60 min</small>' +
            '<strong>' + U.moneyShort(r.after) + '</strong>' +
            '<div class="delta pos-up">+' + U.money(r.diffMonth) + '</div></div>';
        }).join('') +
      '</div>' +
      (function () {
        const r = C().priceIncreaseImpact(state.priceDelta);
        return '<div class="calc-result mt-4">' +
          '<div class="calc-result__sub">Obecna prognoza miesięczna</div>' +
          '<div style="font-size:var(--fs-xl);font-weight:650">' + U.money(cur) + '</div>' +
          '<div class="calc-result__sub mt-3">Po podwyżce +' + state.priceDelta + ' ' + U.curSymbol() + '</div>' +
          '<div class="calc-result__big">' + U.money(r.after) + '</div>' +
          '<div class="row center gap-4 mt-3" style="justify-content:center">' +
            '<div><div class="tiny dim">Miesięcznie</div><b class="pos-up">+' + U.money(r.diffMonth) + '</b></div>' +
            '<div><div class="tiny dim">Rocznie</div><b class="pos-up">+' + U.money(r.diffYear) + '</b></div>' +
          '</div></div>';
      })(),
      { subtitle: 'Symulacja na bazie zajęć z tego miesiąca' });
  }

  /* ---------------- nowy uczeń ---------------- */
  function newStudentCard() {
    const price = state.newPrice === null ? Math.round(C().avgHourlyRate() || S().settings().defaultPrice || 80) : state.newPrice;
    const r = C().newStudentImpact(state.newPerWeek, price);
    return UI.card('Co się stanie, jeśli przyjmę nowego ucznia?',
      '<div class="form-grid">' +
        '<div class="field"><label>Lekcji tygodniowo</label>' +
          '<input class="input" type="number" id="nsWeek" min="1" max="7" value="' + state.newPerWeek + '"></div>' +
        '<div class="field"><label>Stawka za lekcję</label>' +
          '<div class="input-suffix"><input class="input" type="number" id="nsPrice" min="0" step="5" value="' + price + '">' +
          '<span>' + U.curSymbol() + '</span></div></div>' +
      '</div>' +
      '<div class="calc-result mt-4" id="nsResult">' +
        '<div class="calc-result__big">+' + U.money(r.monthly) + '</div>' +
        '<div class="calc-result__sub">miesięcznie · +' + U.money(r.yearly) + ' rocznie</div>' +
      '</div>' +
      '<div class="tiny dim mt-3 center">Przy założeniu 4,33 tygodnia w miesiącu i 11 miesięcy pracy w roku.</div>',
      { subtitle: 'Szybka symulacja przyjęcia ucznia' });
  }

  /* ---------------- tryb planowania ---------------- */
  function planningCard() {
    const rate = C().avgHourlyRate() || S().settings().defaultPrice || 80;
    const target = state.targetIncome === null ? (S().settings().monthlyGoal || 8000) : state.targetIncome;
    const a = C().hoursNeededFor(target, rate);
    const b = C().hoursNeededFor(target, rate + 15);
    return UI.card('Tryb planowania',
      '<div class="field"><label>Chcę zarabiać miesięcznie</label>' +
        '<div class="input-suffix"><input class="input" type="number" id="planTarget" min="0" step="500" value="' + target + '">' +
        '<span>' + U.curSymbol() + '</span></div></div>' +
      '<div id="planResult" class="mt-4">' + planResult(a, b, rate) + '</div>',
      { subtitle: 'Ile godzin potrzeba przy danej stawce' });
  }

  function planResult(a, b, rate) {
    return '<div class="grid grid-2 gap-3">' +
      '<div class="report-cell"><small>Przy stawce ' + U.money(rate) + '</small>' +
        '<strong>' + U.num(a.monthlyHours, 0) + ' h / mies.</strong>' +
        '<div class="tiny dim mt-1">' + U.num(a.weeklyHours, 1) + ' h tygodniowo</div></div>' +
      '<div class="report-cell"><small>Przy stawce ' + U.money(rate + 15) + '</small>' +
        '<strong>' + U.num(b.monthlyHours, 0) + ' h / mies.</strong>' +
        '<div class="tiny dim mt-1">' + U.num(b.weeklyHours, 1) + ' h tygodniowo</div></div>' +
      '</div>' +
      '<div class="insight insight--brand mt-3"><span class="insight__ico">💡</span><div class="insight__body small">' +
      'Podniesienie średniej stawki o 15 ' + U.curSymbol() + ' oszczędza <b>' +
      U.num(a.weeklyHours - b.weeklyHours, 1) + ' h tygodniowo</b> przy tym samym przychodzie.</div></div>';
  }

  /* ---------------- potencjał + cel ---------------- */
  function potentialCard() {
    const p = C().unusedPotential();
    const slots = C().freeSlots(U.today(), U.addDays(U.today(), 6), S().settings().defaultDuration || 60);
    return UI.card('Niewykorzystany potencjał',
      '<div class="calc-result"><div class="calc-result__big">+' + U.money(p.monthly) + '</div>' +
      '<div class="calc-result__sub">miesięcznie przy wypełnieniu wolnych godzin</div></div>' +
      '<div class="dl mt-4">' +
        '<dt>Wolne godziny tygodniowo</dt><dd>' + U.num(p.freeHours, 1) + ' h</dd>' +
        '<dt>Wolnych okien (7 dni)</dt><dd>' + slots.length + '</dd>' +
        '<dt>Średnia stawka</dt><dd>' + U.money(p.rate) + '</dd>' +
        '<dt>Potencjał tygodniowy</dt><dd>' + U.money(p.weekly) + '</dd>' +
        '<dt>Potencjał roczny</dt><dd>' + U.money(p.yearly) + '</dd>' +
      '</div>' +
      '<button class="btn btn--soft btn--block mt-4" data-action="copyFreeSlots">' + icon('copy', 15) + ' Kopiuj wolne terminy</button>');
  }

  function goalCard() {
    const g = C().goalProgress();
    if (!g.goal) {
      return UI.card('Cel finansowy', UI.empty({
        icon: 'target', title: 'Ustaw cel miesięczny',
        text: 'TutorFlow policzy, ile lekcji brakuje do jego osiągnięcia.',
        ctaLabel: 'Przejdź do ustawień', ctaAction: 'go', ctaData: 'data-route="#/settings"'
      }), { noPad: true });
    }
    return UI.card('Cel finansowy',
      '<div class="goal-ring">' + UI.ring(g.forecastPct, 100, U.pctLabel(g.forecastPct, 0), 'prognozy') +
      '<div class="goal-ring__info"><div class="dl">' +
        '<dt>Cel</dt><dd>' + U.money(g.goal) + '</dd>' +
        '<dt>Aktualnie</dt><dd>' + U.money(g.current) + '</dd>' +
        '<dt>Prognoza</dt><dd class="' + (g.forecast >= g.goal ? 'pos-up' : '') + '">' + U.money(g.forecast) + '</dd>' +
        '<dt>Do celu</dt><dd class="' + (g.missing ? 'pos-down' : 'pos-up') + '">' + (g.missing ? U.money(g.missing) : '✔') + '</dd>' +
      '</div></div></div>' +
      (g.missing ? '<div class="insight insight--brand mt-4"><span class="insight__ico">💡</span><div class="insight__body">' +
        'Potrzebujesz około <b>' + U.lessonsLabel(g.lessonsNeeded) + '</b> po średniej stawce ' + U.money(g.rate) + '.</div></div>'
        : '<div class="insight insight--ok mt-4"><span class="insight__ico">🎉</span><div class="insight__body">Prognoza przekracza cel miesięczny.</div></div>'));
  }

  window.TF.Views.forecast = {
    title: 'Prognozy',
    subtitle: function () { return 'Prognoza miesiąca: ' + U.money(C().monthForecast().forecast); },
    render: function () {
      return '<div class="grid grid-2">' + monthCard() + goalCard() + '</div>' +
        '<div class="section">' + yearCard() + '</div>' +
        '<div class="section grid grid-2">' + priceCard() + newStudentCard() + '</div>' +
        '<div class="section grid grid-2">' + planningCard() + potentialCard() + '</div>';
    },
    mount: function (host) {
      const week = host.querySelector('#nsWeek');
      const price = host.querySelector('#nsPrice');
      const res = host.querySelector('#nsResult');
      function upd() {
        state.newPerWeek = Math.max(1, Number(week.value) || 1);
        state.newPrice = Math.max(0, Number(price.value) || 0);
        const r = C().newStudentImpact(state.newPerWeek, state.newPrice);
        res.innerHTML = '<div class="calc-result__big">+' + U.money(r.monthly) + '</div>' +
          '<div class="calc-result__sub">miesięcznie · +' + U.money(r.yearly) + ' rocznie</div>';
      }
      if (week && price) { week.addEventListener('input', upd); price.addEventListener('input', upd); }

      const target = host.querySelector('#planTarget');
      const planRes = host.querySelector('#planResult');
      if (target && planRes) {
        target.addEventListener('input', function () {
          state.targetIncome = Math.max(0, Number(target.value) || 0);
          const rate = C().avgHourlyRate() || S().settings().defaultPrice || 80;
          planRes.innerHTML = planResult(
            C().hoursNeededFor(state.targetIncome, rate),
            C().hoursNeededFor(state.targetIncome, rate + 15), rate);
        });
      }
    },
    setPriceDelta: function (d) { state.priceDelta = d; },
    state: state
  };
})();
