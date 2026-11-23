/* ============================================================
   TutorFlow — views/reminders.js
   Centrum przypomnień — wszystko, co wymaga reakcji.
   ============================================================ */
(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = () => window.TF.Compute;
  const UI = window.TF.UI;
  const L = () => window.TF.Lists;
  const I = () => window.TF.Insights;
  const icon = window.TF.icon;

  window.TF.Views.reminders = {
    title: 'Przypomnienia',
    subtitle: function () {
      const n = I().reminders().length;
      return n ? n + ' ' + U.plural(n, 'sprawa do ogarnięcia', 'sprawy do ogarnięcia', 'spraw do ogarnięcia') : 'Nic nie wymaga uwagi';
    },
    render: function () {
      const rem = I().reminders();
      const ins = I().insights();
      const c = C();

      const urgent = rem.filter((r) => r.tone === 'bad' || r.priority <= 2);
      const rest = rem.filter((r) => urgent.indexOf(r) === -1);

      const remBody = rem.length
        ? (urgent.length ? '<div class="col gap-2 mb-4">' + urgent.map((r) => L().reminder(r)).join('') + '</div>' : '') +
          (rest.length ? '<div class="col gap-2">' + rest.map((r) => L().reminder(r)).join('') + '</div>' : '')
        : UI.empty({
            icon: 'checkCircle', title: 'Wszystko pod kontrolą',
            text: 'Brak zaległości, wszystkie zajęcia oznaczone, żadne pakiety się nie kończą.'
          });

      const upcoming = c.upcoming(3);
      const upcomingCard = UI.card('Nadchodzące zajęcia (72 h)',
        upcoming.length
          ? upcoming.slice(0, 10).map((l) => L().lessonRow(l, { actions: false })).join('')
          : '<p class="dim small">Brak zaplanowanych zajęć w najbliższych trzech dniach.</p>',
        { noPad: upcoming.length > 0 });

      const settings = S().settings();
      const settingsCard = UI.card('Ustawienia przypomnień',
        '<div class="dl">' +
          '<dt>Przypomnienie przed lekcją</dt><dd>' + (settings.remindLessonMin || 30) + ' min</dd>' +
          '<dt>Zaległość po</dt><dd>7 dniach</dd>' +
          '<dt>Uczeń nieaktywny po</dt><dd>21 dniach</dd>' +
          '<dt>Alert pakietu przy</dt><dd>2 lekcjach</dd>' +
        '</div>' +
        '<p class="tiny dim mt-3">Przypomnienia generują się automatycznie z Twoich danych — nie musisz ich tworzyć ręcznie.</p>' +
        '<button class="btn btn--sm btn--block mt-3" data-action="go" data-route="#/settings">' + icon('settings', 14) + ' Ustawienia</button>');

      return '<div class="grid grid-2-1">' +
          '<div>' + UI.card('Do zrobienia teraz', remBody, {
            subtitle: rem.length ? rem.length + ' ' + U.plural(rem.length, 'przypomnienie', 'przypomnienia', 'przypomnień') : 'Czysto',
            action: '<button class="btn btn--xs" data-action="reload">' + icon('refresh', 13) + ' Odśwież</button>'
          }) + '</div>' +
          '<div class="col gap-4">' + upcomingCard + settingsCard + '</div>' +
        '</div>' +
        (ins.length ? '<div class="section"><div class="section__head"><h2>' + icon('sparkles', 17) +
          ' Wnioski o Twoim biznesie</h2></div><div class="grid grid-auto-lg">' +
          ins.map((x) => L().insight(x)).join('') + '</div></div>' : '');
    }
  };
})();
