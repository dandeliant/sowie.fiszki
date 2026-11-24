/* ============================================================
   TutorFlow — insights.js
   Automatyczne wnioski i przypomnienia generowane z danych.
   Nic nie jest zaszyte na sztywno — każdy komunikat powstaje
   z aktualnego stanu Store poprzez Compute.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const C = () => window.TF.Compute;
  const S = () => window.TF.Store;

  const I = {};

  /* ============================================================
     PRZYPOMNIENIA — rzeczy do zrobienia teraz
     ============================================================ */
  I.reminders = function () {
    const out = [];
    const c = C(), s = S();
    const st = s.settings();
    const t = U.today();

    /* 1. Najbliższa lekcja */
    const next = c.nextLesson();
    if (next) {
      const mins = c.minutesUntil(next);
      if (mins >= 0 && mins <= (st.remindLessonMin || 30) * 4) {
        out.push({
          id: 'next-' + next.id, tone: mins <= (st.remindLessonMin || 30) ? 'warn' : 'info', icon: '⏰',
          title: mins < 1 ? 'Lekcja zaczyna się teraz' : 'Za ' + U.relTime(mins) + ' masz lekcję z ' + s.studentName(next.studentId),
          text: U.fmtTime(next.start) + '–' + U.fmtTime(c.lessonEndTime(next)) + ' · ' + (next.topic || next.subject || 'Zajęcia'),
          action: { label: 'Zobacz', route: '#/today' },
          priority: 1
        });
      }
    }

    /* 2. Lekcje z przeszłości bez statusu */
    const stale = s.repo('lessons').where((l) => l.status === 'planned' && c.isPast(l));
    if (stale.length) {
      out.push({
        id: 'stale', tone: 'warn', icon: '📌',
        title: U.lessonsLabel(stale.length) + ' czeka na oznaczenie',
        text: 'Zajęcia z przeszłości nadal mają status „zaplanowana”. Oznacz je, żeby statystyki były prawdziwe.',
        action: { label: 'Uzupełnij', route: '#/lessons?filter=stale' },
        priority: 2
      });
    }

    /* 3. Zaległości płatnicze */
    const byStudent = U.groupBy(c.unpaidLessons(), (l) => l.studentId);
    Object.keys(byStudent).forEach((sid) => {
      const arr = byStudent[sid];
      const total = U.sum(arr, c.lessonValue);
      const oldest = U.sortBy(arr, (l) => l.date)[0];
      const days = U.diffDays(oldest.date, t);
      out.push({
        id: 'unpaid-' + sid, tone: days > 14 ? 'bad' : 'warn', icon: '💰',
        title: s.studentName(sid) + ' ma ' + U.lessonsAcc(arr.length, 'nieopłaconą', 'nieopłacone', 'nieopłaconych'),
        text: U.money(total) + (days > 0 ? ' · najstarsza sprzed ' + days + ' ' + U.plural(days, 'dnia', 'dni', 'dni') : days === 0 ? ' · najstarsza z dzisiaj' : ''),
        action: { label: 'Rozlicz', route: '#/students/' + sid },
        priority: days > 14 ? 1 : 3
      });
    });

    /* 4. Kończące się pakiety */
    s.repo('packages').all().forEach((p) => {
      const left = p.lessonsCount - p.usedCount;
      if (left > 0 && left <= 2) {
        out.push({
          id: 'pkg-' + p.id, tone: 'info', icon: '🎟️',
          title: 'Pakiet ' + s.studentName(p.studentId) + ' kończy się za ' + U.lessonsLabel(left),
          text: 'Wykorzystano ' + p.usedCount + '/' + p.lessonsCount + '. Warto zaproponować przedłużenie.',
          action: { label: 'Profil', route: '#/students/' + p.studentId },
          priority: 3
        });
      }
    });

    /* 5. Uczniowie bez zajęć */
    c.dormantStudents(21).forEach((d) => {
      out.push({
        id: 'dormant-' + d.student.id, tone: 'warn', icon: '😴',
        title: s.studentName(d.student.id) + ' nie miał zajęć od ' + d.days + ' dni',
        text: 'Brak zaplanowanych lekcji. Może warto się odezwać?',
        action: { label: 'Profil', route: '#/students/' + d.student.id },
        priority: 4
      });
    });

    /* 6. Zadania po terminie */
    const overdueTasks = s.repo('tasks').where((x) => !x.done && x.due && x.due < t);
    if (overdueTasks.length) {
      out.push({
        id: 'tasks', tone: 'bad', icon: '✅',
        title: overdueTasks.length + ' ' + U.plural(overdueTasks.length, 'zadanie po terminie', 'zadania po terminie', 'zadań po terminie'),
        text: overdueTasks.slice(0, 3).map((x) => x.title).join(' · '),
        action: { label: 'Zadania', route: '#/tasks' },
        priority: 2
      });
    }

    /* 7. Zadania domowe do sprawdzenia */
    const hw = s.repo('homework').where((h) => h.status === 'assigned' && h.due && h.due <= t);
    if (hw.length) {
      out.push({
        id: 'hw', tone: 'info', icon: '🎒',
        title: hw.length + ' ' + U.plural(hw.length, 'praca domowa do sprawdzenia', 'prace domowe do sprawdzenia', 'prac domowych do sprawdzenia'),
        text: hw.slice(0, 3).map((h) => s.studentName(h.studentId) + ' — ' + h.title).join(' · '),
        action: { label: 'Zobacz', route: '#/tasks' },
        priority: 4
      });
    }

    /* 8. Cel miesięczny */
    const g = c.goalProgress();
    if (g.goal > 0) {
      const dayOfMonth = Number(t.slice(8, 10));
      const daysIn = U.daysInMonth(t);
      if (dayOfMonth >= daysIn - 10 && g.forecast < g.goal * 0.95) {
        out.push({
          id: 'goal', tone: 'warn', icon: '🎯',
          title: 'Do celu miesięcznego brakuje ' + U.money(g.missing),
          text: 'To około ' + U.lessonsLabel(g.lessonsNeeded) + ' przy stawce ' + U.money(g.rate) + '.',
          action: { label: 'Prognozy', route: '#/forecast' },
          priority: 3
        });
      } else if (g.forecast >= g.goal && g.earned < g.goal) {
        out.push({
          id: 'goal-ok', tone: 'ok', icon: '🎯',
          title: 'Cel miesięczny jest w zasięgu',
          text: 'Prognoza ' + U.money(g.forecast) + ' przy celu ' + U.money(g.goal) + '.',
          action: { label: 'Prognozy', route: '#/forecast' },
          priority: 6
        });
      }
    }

    return U.sortBy(out, (x) => x.priority);
  };

  /* ============================================================
     SMART INSIGHTS — obserwacje o biznesie
     ============================================================ */
  I.insights = function () {
    const out = [];
    const c = C(), s = S();
    const st = s.settings();

    /* Trend przychodów */
    const cmp = c.monthComparison();
    if (cmp.previous > 0) {
      const up = cmp.change >= 0;
      out.push({
        id: 'trend', tone: up ? 'ok' : 'warn', icon: up ? '📈' : '📉',
        title: 'Przychody ' + (up ? 'wzrosły' : 'spadły') + ' o ' + U.pctLabel(Math.abs(cmp.change)) + ' względem poprzedniego miesiąca',
        text: U.monthLabel(cmp.curKey) + ': ' + U.money(cmp.current) + ' · ' + U.monthLabel(cmp.prevKey) + ': ' + U.money(cmp.previous),
        route: '#/finance'
      });
    }

    /* Obłożenie dni tygodnia */
    const heat = c.heatmap(8);
    const dayUse = heat.rows.filter((r) => r.isWork).map((r) => ({
      label: U.DOW_LONG[r.dow],
      pct: U.avg(r.cells, (x) => x.pct)
    }));
    if (dayUse.length >= 2) {
      const best = U.sortBy(dayUse, (x) => x.pct, 'desc')[0];
      const worst = U.sortBy(dayUse, (x) => x.pct)[0];
      if (best.pct - worst.pct > 20) {
        out.push({
          id: 'dayuse', tone: 'info', icon: '📊',
          title: 'Nierówne obłożenie tygodnia: ' + best.label + ' ' + U.pctLabel(best.pct, 0) + ', ' + worst.label + ' ' + U.pctLabel(worst.pct, 0),
          text: 'Przesunięcie części zajęć na słabszy dzień wyrówna tydzień i zwolni miejsce w godzinach szczytu.',
          route: '#/stats'
        });
      }
    }

    /* Niewykorzystany potencjał */
    const pot = c.unusedPotential();
    if (pot.freeHours >= 2) {
      out.push({
        id: 'potential', tone: 'brand', icon: '💡',
        title: 'Masz ' + U.num(pot.freeHours, 1) + ' ' + U.plural(Math.round(pot.freeHours), 'wolną godzinę', 'wolne godziny', 'wolnych godzin') + ' tygodniowo',
        text: 'Przy stawce ' + U.money(pot.rate) + ' to potencjalnie ' + U.money(pot.monthly) + ' miesięcznie (' + U.money(pot.yearly) + ' rocznie).',
        route: '#/forecast'
      });
    }

    /* Uczniowie z niską stawką */
    const low = c.lowRateStudents(15);
    if (low.length) {
      out.push({
        id: 'lowrate', tone: 'warn', icon: '⚖️',
        title: low.length + ' ' + U.plural(low.length, 'uczeń płaci', 'uczniów płaci', 'uczniów płaci') + ' stawkę niższą od średniej o ponad 15%',
        text: low.slice(0, 3).map((x) => s.studentName(x.student.id) + ' (' + U.money(x.rate) + ', −' + U.pctLabel(x.diffPct, 0) + ')').join(' · '),
        route: '#/students?filter=lowrate'
      });
    }

    /* Odwołania wg dnia tygodnia */
    const canc = c.cancellationsByDow().filter((d) => d.total >= 4);
    if (canc.length) {
      const worst = U.sortBy(canc, (x) => x.pct, 'desc')[0];
      if (worst.pct >= 15) {
        out.push({
          id: 'cancel', tone: 'warn', icon: '🚫',
          title: 'Najczęściej odwoływane są zajęcia w ' + ({ 0: 'poniedziałki', 1: 'wtorki', 2: 'środy', 3: 'czwartki', 4: 'piątki', 5: 'soboty', 6: 'niedziele' })[worst.dow],
          text: U.pctLabel(worst.pct, 0) + ' zajęć z tego dnia nie doszło do skutku. Rozważ zaliczkę lub sztywniejszą zasadę odwołań.',
          route: '#/stats'
        });
      }
    }

    /* Koncentracja przychodu */
    const top = c.topStudents(3);
    const totalRev = c.revenueAllTime();
    if (top.length >= 3 && totalRev > 0) {
      const share = U.pct(U.sum(top, (x) => x.value), totalRev);
      if (share > 55) {
        out.push({
          id: 'concentration', tone: 'warn', icon: '🧩',
          title: 'Trzech uczniów odpowiada za ' + U.pctLabel(share, 0) + ' Twojego przychodu',
          text: 'Utrata jednego z nich mocno wpłynie na budżet. Warto zadbać o dywersyfikację.',
          route: '#/finance'
        });
      }
    }

    /* Efektywna stawka godzinowa */
    const eff = c.effectiveHourlyRate();
    const avg = c.avgHourlyRate();
    if (eff > 0 && avg > 0 && eff - avg > 3) {
      out.push({
        id: 'effective', tone: 'ok', icon: '⚡',
        title: 'Efektywna stawka godzinowa: ' + U.money(eff),
        text: 'To o ' + U.money(eff - avg) + ' więcej niż średnia cennikowa — zasady odwołań pracują na Twoją korzyść.',
        route: '#/finance'
      });
    }

    /* Frekwencja */
    const att = c.attendance();
    if (att < 88) {
      out.push({
        id: 'attendance', tone: 'warn', icon: '📋',
        title: 'Frekwencja wynosi ' + U.pctLabel(att, 0),
        text: 'Co dziesiąte zajęcia nie dochodzą do skutku. Sprawdź, którzy uczniowie odwołują najczęściej.',
        route: '#/stats'
      });
    } else if (att >= 96) {
      out.push({
        id: 'attendance-ok', tone: 'ok', icon: '🌟',
        title: 'Świetna frekwencja: ' + U.pctLabel(att, 0),
        text: 'Uczniowie są zaangażowani — to najlepsza podstawa do podniesienia stawek.',
        route: '#/stats'
      });
    }

    /* Retencja */
    const ret = c.retention();
    if (ret.avgMonths >= 1) {
      out.push({
        id: 'retention', tone: 'info', icon: '🤝',
        title: 'Średni czas współpracy: ' + U.num(ret.avgMonths, 1) + ' ' + U.plural(Math.round(ret.avgMonths), 'miesiąc', 'miesiące', 'miesięcy'),
        text: ret.longest ? 'Najdłużej uczysz: ' + ret.longest.name + ' (' + U.num(ret.longest.months, 1) + ' mies.).' : '',
        route: '#/stats'
      });
    }

    /* Wolne terminy do zaoferowania */
    const slots = c.freeSlots(U.today(), U.addDays(U.today(), 7), st.defaultDuration || 60);
    if (slots.length) {
      out.push({
        id: 'slots', tone: 'brand', icon: '🕒',
        title: 'Masz ' + slots.length + ' ' + U.plural(slots.length, 'wolny termin', 'wolne terminy', 'wolnych terminów') + ' w najbliższym tygodniu',
        text: slots.slice(0, 3).map((x) => U.DOW_LONG[x.dow] + ' ' + x.start).join(', ') + (slots.length > 3 ? '…' : ''),
        route: '#/calendar'
      });
    }

    return out;
  };

  /* ============================================================
     „WARTO ZWRÓCIĆ UWAGĘ” — skrót na Dashboard
     ============================================================ */
  I.attention = function (limit) {
    const rem = I.reminders().filter((r) => r.tone !== 'ok');
    const ins = I.insights().filter((x) => x.tone === 'warn' || x.tone === 'bad' || x.tone === 'brand');
    const merged = rem.map((r) => ({ tone: r.tone, icon: r.icon, title: r.title, text: r.text, route: r.action && r.action.route }))
      .concat(ins.map((x) => ({ tone: x.tone, icon: x.icon, title: x.title, text: x.text, route: x.route })));
    return merged.slice(0, limit || 5);
  };

  window.TF.Insights = I;
})();
