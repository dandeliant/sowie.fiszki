/* ============================================================
   TutorFlow — views/today.js
   Ekran „Dzisiaj” — maksymalnie prosty, do użycia w trakcie pracy.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const icon = window.TF.icon;

  window.TF.Views.today = {
    title: 'Dzisiaj',
    subtitle: function () {
      const d = new Date();
      return U.cap(U.DOW_LONG[U.dow(U.today())]) + ', ' + d.getDate() + ' ' + U.MONTHS_GEN[d.getMonth()];
    },
    render: function () {
      const c = C();
      const t = U.today();
      const lessons = c.todayLessons();
      const done = lessons.filter((l) => l.status === 'done');
      const planned = lessons.filter((l) => l.status === 'planned');
      const next = c.nextLesson();
      const tasks = S().repo('tasks').where((x) => !x.done && (!x.due || x.due <= t));
      const payments = S().repo('payments').where((p) => p.date === t);
      const notes = U.sortBy(S().repo('notes').where((n) => n.date === t), (n) => n.createdAt, 'desc');
      const potential = c.todayRevenuePotential();

      /* --- pasek podsumowania --- */
      const summary =
        '<div class="kpi-grid">' +
          UI.kpi({ label: 'Lekcje dzisiaj', icon: 'today', tone: 'info', value: lessons.filter((l) => !c.isCancelled(l)).length,
            foot: '<span>' + done.length + ' odbytych · ' + planned.length + ' przed nami</span>' }) +
          UI.kpi({ label: 'Dzisiejszy zarobek', icon: 'wallet', tone: 'ok', value: U.money(potential),
            foot: '<span>Rozliczone: ' + U.money(c.todayEarned()) + '</span>' }) +
          UI.kpi({ label: 'Godziny', icon: 'clock', tone: '', value: U.num(U.sum(lessons.filter((l) => !c.isCancelled(l)), (l) => l.duration) / 60, 1), unit: 'h',
            foot: '<span>Czas przy zajęciach</span>' }) +
          UI.kpi({ label: 'Zadania na dziś', icon: 'checkSquare', tone: tasks.length ? 'warn' : 'ok', value: tasks.length,
            foot: '<span>' + (tasks.length ? 'Do zrobienia' : 'Wszystko zrobione') + '</span>' }) +
        '</div>';

      /* --- następna lekcja --- */
      let nextCard = '';
      if (next && next.date === t) {
        const mins = c.minutesUntil(next);
        const s = S().student(next.studentId);
        nextCard = '<div class="hero" style="background:var(--grad-brand)">' +
          '<div class="hero__text">' +
            '<p style="opacity:.85;text-transform:uppercase;letter-spacing:.06em;font-size:var(--fs-xs);font-weight:700">' +
              (c.isNow(next) ? 'Trwa teraz' : 'Następna lekcja za ' + U.relTime(mins)) + '</p>' +
            '<h2 style="font-size:var(--fs-2xl)">' + U.esc(S().studentName(next.studentId)) + '</h2>' +
            '<p>' + U.fmtTime(next.start) + '–' + U.fmtTime(c.lessonEndTime(next)) + ' · ' +
              U.esc(next.topic || next.subject || (s && s.subject) || 'Zajęcia') + ' · ' + U.money(next.price) + '</p>' +
          '</div>' +
          '<div class="hero__stats">' +
            '<button class="btn btn--lg" style="background:#fff;color:var(--brand-600);border:none" data-action="lessonSummary" data-id="' + next.id + '">' +
              icon('play', 16) + ' Rozpocznij</button>' +
          '</div></div>';
      }

      /* --- lista lekcji --- */
      const lessonsCard = UI.card('Plan dnia',
        lessons.length ? lessons.map((l) => L().lessonRow(l, { dim: true })).join('')
          : UI.empty({ icon: 'today', title: 'Dziś nie masz zajęć', text: 'Wolny dzień — możesz zaplanować coś na przyszłość.', ctaLabel: 'Dodaj zajęcia', ctaAction: 'addLesson' }),
        { noPad: true, subtitle: lessons.length ? U.lessonsLabel(lessons.length) : 'Pusto',
          action: '<button class="btn btn--sm" data-action="addLesson" data-date="' + t + '"><span class="plus">+</span> Dodaj</button>' });

      /* --- zadania --- */
      const tasksCard = UI.card('Zadania',
        tasks.length ? tasks.map((x) => L().taskItem(x)).join('')
          : UI.empty({ icon: 'checkSquare', title: 'Brak zadań na dziś', text: 'Wszystko odhaczone.' }),
        { noPad: true, action: '<button class="btn btn--sm" data-action="addTask"><span class="plus">+</span> Zadanie</button>' });

      /* --- płatności --- */
      const payCard = UI.card('Dzisiejsze płatności',
        payments.length
          ? '<div class="col">' + payments.map((p) =>
              '<div class="stat-row"><span class="stat-row__label">' +
              UI.avatar(S().student(p.studentId), 'sm') + U.esc(S().studentName(p.studentId)) +
              ' <span class="badge">' + (window.TF.Models.PAYMENT_METHOD[p.method] || { label: p.method }).label + '</span></span>' +
              '<span class="stat-row__value">' + U.money(p.amount) + '</span></div>').join('') + '</div>'
          : '<p class="dim small">Brak wpłat zarejestrowanych dzisiaj.</p>',
        { action: '<button class="btn btn--sm" data-action="addPayment"><span class="plus">+</span> Wpłata</button>' });

      /* --- notatki --- */
      const notesCard = UI.card('Notatki z dzisiaj',
        notes.length ? '<div class="col gap-3">' + notes.map((n) => L().noteCard(n)).join('') + '</div>'
          : '<p class="dim small">Nic jeszcze nie zapisałeś dzisiaj.</p>',
        { action: '<button class="btn btn--sm" data-action="addNote"><span class="plus">+</span> Notatka</button>' });

      return (nextCard ? nextCard + '<div class="section">' + summary + '</div>' : '<div>' + summary + '</div>') +
        '<div class="section grid grid-2-1">' +
          '<div class="col gap-4">' + lessonsCard + '</div>' +
          '<div class="col gap-4">' + tasksCard + payCard + notesCard + '</div>' +
        '</div>';
    }
  };
})();
