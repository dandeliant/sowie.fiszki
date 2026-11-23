/* ============================================================
   TutorFlow — compute.js
   Warstwa wyliczeń. Nic tu nie modyfikuje stanu — same funkcje
   czytające ze Store i zwracające liczby/struktury dla widoków.
   Dzięki temu statystyki, prognozy i wykresy zawsze wynikają
   z rzeczywistych danych, a nie z zapisanych „wyników”.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const S = () => window.TF.Store;
  const C = {};

  /* Sezonowość korepetycji (1.0 = miesiąc typowy) */
  const SEASONALITY = [1.05, 1.05, 1.08, 1.02, 1.10, 0.55, 0.30, 0.45, 0.95, 1.08, 1.05, 0.85];

  /* ============================================================
     LEKCJA — podstawowe predykaty
     ============================================================ */

  /** Lekcja generuje przychód: odbyta albo płatna nieobecność/odwołanie. */
  C.isBillable = function (l) {
    if (!l) return false;
    if (l.paymentStatus === 'free') return false;
    if (l.status === 'done') return true;
    if (l.status === 'no_show' || l.status === 'cancelled_student' || l.status === 'cancelled_tutor') return !!l.chargeable;
    return false;
  };
  /** Lekcja zaplanowana (jeszcze nie rozliczona). */
  C.isPlanned = function (l) { return l && l.status === 'planned'; };
  /** Lekcja faktycznie się odbyła — liczy się do godzin i frekwencji. */
  C.isHeld = function (l) { return l && l.status === 'done'; };
  C.isCancelled = function (l) { return l && (l.status === 'cancelled_student' || l.status === 'cancelled_tutor'); };

  C.lessonValue = function (l) { return C.isBillable(l) ? (Number(l.price) || 0) : 0; };
  C.lessonEnd = function (l) { return U.toMin(l.start) + (l.duration || 60); };
  C.lessonEndTime = function (l) { return U.toTime(C.lessonEnd(l)); };
  /** Ile minut do rozpoczęcia lekcji (ujemne = już trwa/minęła) */
  C.minutesUntil = function (l) {
    return (U.diffDays(U.today(), l.date) * 1440) + (U.toMin(l.start) - U.nowMin());
  };
  C.isNow = function (l) {
    if (l.date !== U.today()) return false;
    const n = U.nowMin();
    return n >= U.toMin(l.start) && n < C.lessonEnd(l);
  };
  C.isPast = function (l) {
    if (l.date < U.today()) return true;
    if (l.date > U.today()) return false;
    return U.nowMin() >= C.lessonEnd(l);
  };
  /** Nieopłacona i wymagalna */
  C.isDue = function (l) { return C.isBillable(l) && l.paymentStatus === 'unpaid'; };
  /** Zaległość: nieopłacona lekcja sprzed ponad 7 dni */
  C.isOverdue = function (l) { return C.isDue(l) && U.diffDays(l.date, U.today()) > 7; };

  /* ============================================================
     FILTRY ZAKRESÓW
     ============================================================ */
  C.lessonsIn = function (from, to) { return S().lessonsBetween(from, to); };
  C.lessonsInMonth = function (mk) { return S().repo('lessons').where((l) => U.monthKey(l.date) === mk); };
  C.lessonsInYear = function (y) { return S().repo('lessons').where((l) => l.date.slice(0, 4) === String(y)); };

  /* ============================================================
     PRZYCHODY
     ============================================================ */
  C.revenue = function (lessons) { return U.sum(lessons, C.lessonValue); };
  C.revenueBetween = function (from, to) { return C.revenue(C.lessonsIn(from, to)); };
  C.revenueMonth = function (mk) { return C.revenue(C.lessonsInMonth(mk)); };
  C.revenueYear = function (y) { return C.revenue(C.lessonsInYear(y)); };
  C.revenueAllTime = function () { return C.revenue(S().repo('lessons').all()); };

  C.plannedValue = function (lessons) {
    return U.sum(lessons.filter(C.isPlanned), (l) => Number(l.price) || 0);
  };

  /** Wpływy gotówkowe (rzeczywiste wpłaty) w okresie */
  C.cashIn = function (from, to) {
    return U.sum(S().repo('payments').where((p) => p.date >= from && p.date <= to && p.status === 'paid'), (p) => p.amount);
  };

  C.expensesBetween = function (from, to) {
    return U.sum(S().repo('expenses').where((e) => e.date >= from && e.date <= to), (e) => e.amount);
  };
  C.expensesMonth = function (mk) {
    return U.sum(S().repo('expenses').where((e) => U.monthKey(e.date) === mk), (e) => e.amount);
  };

  C.profitMonth = function (mk) { return C.revenueMonth(mk) - C.expensesMonth(mk); };

  /* ============================================================
     NALEŻNOŚCI
     ============================================================ */
  C.unpaidLessons = function (studentId) {
    return S().repo('lessons').where((l) => C.isDue(l) && (!studentId || l.studentId === studentId));
  };
  C.unpaidTotal = function (studentId) { return U.sum(C.unpaidLessons(studentId), C.lessonValue); };
  C.overdueLessons = function () { return S().repo('lessons').where(C.isOverdue); };

  /** Pełne rozliczenie ucznia */
  C.studentFinance = function (studentId) {
    const lessons = S().lessonsOf(studentId);
    const billable = lessons.filter(C.isBillable);
    const held = lessons.filter(C.isHeld);
    const billed = U.sum(billable, C.lessonValue);
    const due = U.sum(billable.filter((l) => l.paymentStatus === 'unpaid'), C.lessonValue);
    const payments = S().repo('payments').where((p) => p.studentId === studentId);
    const paidCash = U.sum(payments, (p) => p.amount);
    const minutes = U.sum(held, (l) => l.duration);
    const months = Math.max(1, C.cooperationMonths(studentId));
    return {
      lessonsTotal: lessons.length,
      lessonsHeld: held.length,
      lessonsBilled: billable.length,
      minutes: minutes,
      hours: minutes / 60,
      billed: billed,
      paid: billed - due,
      paidCash: paidCash,
      due: due,
      avgMonthly: billed / months,
      avgRate: held.length ? U.avg(held, (l) => (l.price / (l.duration || 60)) * 60) : 0,
      firstLesson: lessons.length ? lessons[0].date : null,
      lastHeld: held.length ? held[held.length - 1] : null,
      nextLesson: C.nextLessonOf(studentId)
    };
  };

  C.studentBalance = function (studentId) { return C.unpaidTotal(studentId); };

  C.cooperationMonths = function (studentId) {
    const s = S().student(studentId);
    if (!s) return 0;
    const end = s.status === 'ended' && s.endDate ? s.endDate : U.today();
    return Math.max(0, U.diffDays(s.startDate, end) / 30.44);
  };

  C.nextLessonOf = function (studentId) {
    const t = U.today();
    return U.sortBy(
      S().repo('lessons').where((l) => l.studentId === studentId && C.isPlanned(l) && (l.date > t || (l.date === t && C.lessonEnd(l) > U.nowMin()))),
      (l) => l.date + l.start
    )[0] || null;
  };
  C.lastHeldOf = function (studentId) {
    const arr = U.sortBy(S().repo('lessons').where((l) => l.studentId === studentId && C.isHeld(l)), (l) => l.date + l.start);
    return arr[arr.length - 1] || null;
  };
  /** Dni od ostatniej odbytej lekcji */
  C.daysSinceLast = function (studentId) {
    const l = C.lastHeldOf(studentId);
    return l ? U.diffDays(l.date, U.today()) : null;
  };

  /* ============================================================
     DZIŚ / NAJBLIŻSZE
     ============================================================ */
  C.todayLessons = function () { return S().lessonsOn(U.today()); };
  C.todayRevenuePotential = function () {
    return U.sum(C.todayLessons().filter((l) => l.status !== 'cancelled_student' && l.status !== 'cancelled_tutor' && l.status !== 'rescheduled'),
      (l) => Number(l.price) || 0);
  };
  C.todayEarned = function () { return C.revenue(C.todayLessons()); };

  C.nextLesson = function () {
    const t = U.today();
    const cand = S().repo('lessons').where((l) => C.isPlanned(l) && (l.date > t || (l.date === t && C.lessonEnd(l) > U.nowMin())));
    return U.sortBy(cand, (l) => l.date + l.start)[0] || null;
  };

  C.upcoming = function (days) {
    const t = U.today();
    const to = U.addDays(t, days || 7);
    return U.sortBy(S().repo('lessons').where((l) => C.isPlanned(l) && l.date >= t && l.date <= to), (l) => l.date + l.start);
  };

  /* ============================================================
     GODZINY, STAWKI, FREKWENCJA
     ============================================================ */
  C.minutesHeld = function (lessons) { return U.sum(lessons.filter(C.isHeld), (l) => l.duration); };
  C.hoursHeld = function (lessons) { return C.minutesHeld(lessons) / 60; };

  /** Średnia stawka za 60 minut (z odbytych lekcji) */
  C.avgHourlyRate = function (lessons) {
    const held = (lessons || S().repo('lessons').all()).filter(C.isHeld);
    if (!held.length) return 0;
    return U.avg(held, (l) => (Number(l.price) || 0) / (l.duration || 60) * 60);
  };

  /** Efektywna stawka godzinowa = cały przychód / rzeczywiste godziny zajęć */
  C.effectiveHourlyRate = function (lessons) {
    const arr = lessons || S().repo('lessons').all();
    const h = C.hoursHeld(arr);
    if (!h) return 0;
    return C.revenue(arr) / h;
  };

  C.attendance = function (lessons) {
    const arr = (lessons || S().repo('lessons').all()).filter((l) =>
      l.status === 'done' || l.status === 'no_show' || l.status === 'cancelled_student');
    if (!arr.length) return 100;
    return U.pct(arr.filter(C.isHeld).length, arr.length);
  };

  C.cancellationRate = function (lessons) {
    const arr = (lessons || S().repo('lessons').all()).filter((l) => l.status !== 'planned');
    if (!arr.length) return 0;
    return U.pct(arr.filter((l) => C.isCancelled(l) || l.status === 'no_show').length, arr.length);
  };

  /* ============================================================
     GRAFIK — dostępność i wykorzystanie
     ============================================================ */
  C.workHoursFor = function (dowIdx) {
    const st = S().settings();
    if ((st.workDays || []).indexOf(dowIdx) === -1) return null;
    const byDay = (st.workHoursByDay || {})[dowIdx];
    return byDay || st.workHours || { start: '14:00', end: '20:00' };
  };
  C.isWorkDay = function (dateIso) { return !!C.workHoursFor(U.dow(dateIso)); };

  /** Dostępne minuty pracy w dniu */
  C.capacityMinutes = function (dateIso) {
    const wh = C.workHoursFor(U.dow(dateIso));
    if (!wh) return 0;
    return Math.max(0, U.toMin(wh.end) - U.toMin(wh.start));
  };
  C.capacityBetween = function (from, to) {
    return U.sum(U.rangeDays(from, to), (d) => C.capacityMinutes(d));
  };
  /** Zajęte minuty (bez odwołanych) */
  C.bookedMinutes = function (from, to) {
    return U.sum(S().lessonsBetween(from, to).filter((l) => !C.isCancelled(l) && l.status !== 'rescheduled'), (l) => l.duration);
  };
  C.utilization = function (from, to) {
    const cap = C.capacityBetween(from, to);
    if (!cap) return 0;
    return U.clamp(U.pct(C.bookedMinutes(from, to), cap), 0, 100);
  };

  /** Wolne okna w zadanym zakresie dat */
  C.freeSlots = function (from, to, slotMin) {
    const step = slotMin || S().settings().defaultDuration || 60;
    const out = [];
    const nowD = U.today(), nowM = U.nowMin();
    U.rangeDays(from, to).forEach((d) => {
      const wh = C.workHoursFor(U.dow(d));
      if (!wh) return;
      const busy = S().lessonsOn(d).filter((l) => !C.isCancelled(l) && l.status !== 'rescheduled')
        .map((l) => [U.toMin(l.start), C.lessonEnd(l)]);
      let t = U.toMin(wh.start);
      const end = U.toMin(wh.end);
      while (t + step <= end) {
        const s = t, e = t + step;
        const clash = busy.some((b) => s < b[1] && b[0] < e);
        const inPast = d < nowD || (d === nowD && e <= nowM);
        if (!clash && !inPast) out.push({ date: d, start: U.toTime(s), duration: step, dow: U.dow(d) });
        t += step;
      }
    });
    return out;
  };

  /** Ile wolnych godzin tygodniowo (średnio, w typowym tygodniu pracy) */
  C.weeklyFreeHours = function () {
    const from = U.startOfWeek(U.today());
    const to = U.addDays(from, 6);
    const cap = C.capacityBetween(from, to);
    const booked = C.bookedMinutes(from, to);
    return Math.max(0, (cap - booked) / 60);
  };

  /** Niewykorzystany potencjał finansowy */
  C.unusedPotential = function () {
    const freeH = C.weeklyFreeHours();
    const rate = C.avgHourlyRate() || S().settings().defaultPrice || 80;
    return {
      freeHours: freeH,
      rate: rate,
      weekly: freeH * rate,
      monthly: freeH * rate * 4.33,
      yearly: freeH * rate * 4.33 * 12 * 0.8   // korekta na wakacje
    };
  };

  /* ============================================================
     SERIE CZASOWE
     ============================================================ */
  C.monthlySeries = function (months, endIso) {
    const keys = U.lastMonths(endIso || U.today(), months || 12);
    return keys.map((mk) => {
      const ls = C.lessonsInMonth(mk);
      return {
        key: mk,
        label: U.monthNameShort(mk),
        fullLabel: U.monthLabel(mk),
        revenue: C.revenue(ls),
        expenses: C.expensesMonth(mk),
        profit: C.revenue(ls) - C.expensesMonth(mk),
        lessons: ls.filter(C.isHeld).length,
        hours: C.hoursHeld(ls),
        cancelled: ls.filter((l) => C.isCancelled(l)).length,
        planned: C.plannedValue(ls)
      };
    });
  };

  C.dailySeries = function (from, to) {
    return U.rangeDays(from, to).map((d) => {
      const ls = S().lessonsOn(d);
      return { key: d, label: U.fmtDate(d, 'short'), revenue: C.revenue(ls), lessons: ls.filter(C.isHeld).length };
    });
  };

  /** Porównanie bieżącego miesiąca z poprzednim */
  C.monthComparison = function (mk) {
    const cur = mk || U.monthKey(U.today());
    const prev = U.monthKey(U.addMonths(cur + '-01', -1));
    const a = C.revenueMonth(cur), b = C.revenueMonth(prev);
    return { current: a, previous: b, change: U.change(a, b), prevKey: prev, curKey: cur };
  };

  /* ============================================================
     PROGNOZY
     ============================================================ */
  C.monthForecast = function (mk) {
    const key = mk || U.monthKey(U.today());
    const ls = C.lessonsInMonth(key);
    const t = U.today();
    const earned = C.revenue(ls);
    const plannedFuture = U.sum(ls.filter((l) => C.isPlanned(l) && l.date >= t), (l) => Number(l.price) || 0);
    const plannedPast = U.sum(ls.filter((l) => C.isPlanned(l) && l.date < t), (l) => Number(l.price) || 0);
    const cr = C.cancellationRate() / 100;
    const expected = earned + plannedPast + plannedFuture * (1 - cr);
    const low = earned + plannedPast * 0.9 + plannedFuture * Math.max(0, 1 - cr - 0.10);
    const high = earned + plannedPast + plannedFuture * Math.min(1, 1 - cr + 0.06);
    return {
      key: key,
      earned: earned,
      planned: plannedFuture + plannedPast,
      plannedFuture: plannedFuture,
      plannedPast: plannedPast,
      forecast: expected,
      low: low, high: high,
      cancelRate: cr * 100,
      lessonsDone: ls.filter(C.isHeld).length,
      lessonsPlanned: ls.filter(C.isPlanned).length
    };
  };

  /** Średnia bazowa z ostatnich pełnych miesięcy (odporna na skrajności) */
  C.baselineMonthly = function (n) {
    const cur = U.monthKey(U.today());
    const keys = U.lastMonths(U.today(), (n || 4) + 1).filter((k) => k !== cur);
    const vals = keys.map(C.revenueMonth).filter((v) => v > 0);
    if (!vals.length) return C.monthForecast().forecast;
    return U.avg(vals);
  };

  C.yearForecast = function (year) {
    const y = year || Number(U.today().slice(0, 4));
    const curMk = U.monthKey(U.today());
    const curIdx = Number(curMk.slice(5, 7)) - 1;
    const isCurrentYear = y === Number(U.today().slice(0, 4));
    const baseline = C.baselineMonthly(4);

    // Normalizacja bazy o sezonowość miesięcy, z których pochodzi
    const refKeys = U.lastMonths(U.today(), 5).filter((k) => k !== curMk);
    const refSeason = refKeys.length ? U.avg(refKeys.map((k) => SEASONALITY[Number(k.slice(5, 7)) - 1])) : 1;
    const normalized = refSeason ? baseline / refSeason : baseline;

    const months = [];
    let total = 0;
    for (let m = 0; m < 12; m++) {
      const mk = y + '-' + U.pad(m + 1);
      let value, kind;
      if (!isCurrentYear || m < curIdx) {
        value = C.revenueMonth(mk); kind = 'actual';
        if (!value && isCurrentYear === false) { value = normalized * SEASONALITY[m]; kind = 'estimate'; }
      } else if (m === curIdx) {
        value = C.monthForecast(mk).forecast; kind = 'forecast';
      } else {
        const scheduled = U.sum(C.lessonsInMonth(mk), (l) => (C.isPlanned(l) ? (Number(l.price) || 0) : C.lessonValue(l)));
        value = Math.max(scheduled, normalized * SEASONALITY[m]); kind = 'estimate';
      }
      months.push({ key: mk, label: U.MONTHS_SHORT[m], value: value, kind: kind });
      total += value;
    }
    return {
      year: y, total: total, months: months,
      low: total * 0.88, high: total * 1.12,
      baseline: normalized
    };
  };

  /** Symulacja: co da podwyżka stawki o `delta` zł/60 min */
  C.priceIncreaseImpact = function (delta) {
    const f = C.monthForecast();
    const ls = C.lessonsInMonth(f.key).filter((l) => C.isBillable(l) || C.isPlanned(l));
    const extraPerMonth = U.sum(ls, (l) => delta * ((l.duration || 60) / 60));
    return {
      delta: delta,
      current: f.forecast,
      after: f.forecast + extraPerMonth,
      diffMonth: extraPerMonth,
      diffYear: extraPerMonth * 11   // ~11 miesięcy pracy w roku
    };
  };

  /** Symulacja: nowy uczeń — x lekcji tygodniowo po y zł */
  C.newStudentImpact = function (perWeek, price) {
    const monthly = perWeek * price * 4.33;
    return { monthly: monthly, yearly: monthly * 11, weekly: perWeek * price };
  };

  /** Ile godzin potrzeba, by osiągnąć docelowy przychód miesięczny */
  C.hoursNeededFor = function (target, rate) {
    const r = rate || C.avgHourlyRate() || S().settings().defaultPrice || 80;
    const monthly = target / r;
    return { rate: r, monthlyHours: monthly, weeklyHours: monthly / 4.33 };
  };

  /** Postęp realizacji celu miesięcznego */
  C.goalProgress = function () {
    const st = S().settings();
    const goal = Number(st.monthlyGoal) || 0;
    const f = C.monthForecast();
    const missing = Math.max(0, goal - f.forecast);
    const rate = C.avgHourlyRate() || st.defaultPrice || 80;
    return {
      goal: goal,
      current: f.earned,
      forecast: f.forecast,
      missing: missing,
      pct: goal ? U.clamp(U.pct(f.earned, goal), 0, 999) : 0,
      forecastPct: goal ? U.clamp(U.pct(f.forecast, goal), 0, 999) : 0,
      lessonsNeeded: rate ? Math.ceil(missing / rate) : 0,
      rate: rate
    };
  };

  /* ============================================================
     RANKINGI I STRUKTURY
     ============================================================ */
  C.topStudents = function (limit, from, to) {
    const ls = (from && to) ? C.lessonsIn(from, to) : S().repo('lessons').all();
    const map = {};
    ls.forEach((l) => {
      const v = C.lessonValue(l);
      if (!v) return;
      map[l.studentId] = (map[l.studentId] || 0) + v;
    });
    return U.sortBy(Object.keys(map).map((id) => ({
      studentId: id, name: S().studentName(id), value: map[id], student: S().student(id)
    })), (x) => x.value, 'desc').slice(0, limit || 5);
  };

  C.revenueStructure = function (from, to) {
    const ls = (from && to) ? C.lessonsIn(from, to) : S().repo('lessons').all();
    const out = { online: 0, onsite: 0, individual: 0, group: 0 };
    ls.forEach((l) => {
      const v = C.lessonValue(l);
      if (!v) return;
      if (l.mode === 'online') out.online += v; else out.onsite += v;
      const s = S().student(l.studentId);
      if (s && s.group) out.group += v; else out.individual += v;
    });
    return out;
  };

  C.revenueBySubject = function (from, to) {
    const ls = (from && to) ? C.lessonsIn(from, to) : S().repo('lessons').all();
    const map = {};
    ls.forEach((l) => {
      const v = C.lessonValue(l); if (!v) return;
      const s = S().student(l.studentId);
      const key = l.subject || (s && s.subject) || 'Inne';
      map[key] = (map[key] || 0) + v;
    });
    return U.sortBy(Object.keys(map).map((k) => ({ label: k, value: map[k] })), (x) => x.value, 'desc');
  };

  /** Heatmapa obłożenia: dzień tygodnia × godzina, za ostatnie `weeks` tygodni */
  C.heatmap = function (weeks) {
    const w = weeks || 8;
    const to = U.today();
    const from = U.addDays(U.startOfWeek(to), -(w - 1) * 7);
    const st = S().settings();
    let minH = 24, maxH = 0;
    (st.workDays || []).forEach((d) => {
      const wh = C.workHoursFor(d);
      if (!wh) return;
      minH = Math.min(minH, Math.floor(U.toMin(wh.start) / 60));
      maxH = Math.max(maxH, Math.ceil(U.toMin(wh.end) / 60));
    });
    if (minH > maxH) { minH = 14; maxH = 21; }
    const hours = [];
    for (let h = minH; h < maxH; h++) hours.push(h);

    const counts = {};   // 'dow-hour' -> liczba wystąpień
    const weeksSeen = {};
    S().lessonsBetween(from, to).forEach((l) => {
      if (C.isCancelled(l) || l.status === 'rescheduled') return;
      const d = U.dow(l.date);
      const s = Math.floor(U.toMin(l.start) / 60);
      const e = Math.ceil(C.lessonEnd(l) / 60);
      for (let h = s; h < e; h++) {
        const k = d + '-' + h;
        counts[k] = (counts[k] || 0) + 1;
        weeksSeen[k] = true;
      }
    });
    const rows = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dow: d,
      label: U.DOW_SHORT[d],
      isWork: !!C.workHoursFor(d),
      cells: hours.map((h) => {
        const n = counts[d + '-' + h] || 0;
        return { hour: h, count: n, pct: U.clamp(U.pct(n, w), 0, 100) };
      })
    }));
    return { hours: hours, rows: rows, weeks: w };
  };

  /** Najbardziej dochodowe pory dnia */
  C.bestHours = function () {
    const ls = S().repo('lessons').all().filter(C.isBillable);
    const buckets = {};
    ls.forEach((l) => {
      const h = Math.floor(U.toMin(l.start) / 60);
      buckets[h] = buckets[h] || { hour: h, value: 0, count: 0 };
      buckets[h].value += C.lessonValue(l);
      buckets[h].count++;
    });
    return U.sortBy(Object.keys(buckets).map((k) => buckets[k]), (x) => x.value, 'desc');
  };

  /** Najczęściej odwoływane dni tygodnia */
  C.cancellationsByDow = function () {
    const out = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dow: d, label: U.DOW_SHORT[d], cancelled: 0, total: 0 }));
    S().repo('lessons').all().forEach((l) => {
      if (l.status === 'planned') return;
      const d = U.dow(l.date);
      out[d].total++;
      if (C.isCancelled(l) || l.status === 'no_show') out[d].cancelled++;
    });
    out.forEach((r) => { r.pct = U.pct(r.cancelled, r.total); });
    return out;
  };

  /* ============================================================
     UCZNIOWIE — retencja i rotacja
     ============================================================ */
  C.retention = function () {
    const all = S().repo('students').all();
    if (!all.length) return { avgMonths: 0, avgActiveMonths: 0, ended: 0, active: 0, paused: 0, longest: null };
    const durations = all.map((s) => C.cooperationMonths(s.id));
    const ended = all.filter((s) => s.status === 'ended');
    const longest = U.sortBy(all.map((s) => ({ s: s, m: C.cooperationMonths(s.id) })), (x) => x.m, 'desc')[0];
    return {
      avgMonths: U.avg(durations),
      avgActiveMonths: U.avg(all.filter((s) => s.status === 'active').map((s) => C.cooperationMonths(s.id))),
      ended: ended.length,
      active: all.filter((s) => s.status === 'active').length,
      paused: all.filter((s) => s.status === 'paused').length,
      longest: longest ? { name: S().studentName(longest.s.id), months: longest.m } : null
    };
  };

  C.studentFlow = function (months) {
    const keys = U.lastMonths(U.today(), months || 6);
    return keys.map((mk) => {
      const joined = S().repo('students').where((s) => U.monthKey(s.startDate) === mk).length;
      const left = S().repo('students').where((s) => s.status === 'ended' && s.endDate && U.monthKey(s.endDate) === mk).length;
      return { key: mk, label: U.monthNameShort(mk), joined: joined, left: left, net: joined - left };
    });
  };

  /** Uczniowie ze stawką znacząco poniżej średniej */
  C.lowRateStudents = function (thresholdPct) {
    const th = thresholdPct === undefined ? 15 : thresholdPct;
    const avg = C.avgHourlyRate();
    if (!avg) return [];
    return S().activeStudents().map((s) => {
      const rate = (s.rates && s.rates[60]) || 0;
      const diff = U.pct(avg - rate, avg);
      return { student: s, rate: rate, avg: avg, diffPct: diff };
    }).filter((x) => x.rate > 0 && x.diffPct >= th)
      .sort((a, b) => b.diffPct - a.diffPct);
  };

  /** Uczniowie bez zajęć od dłuższego czasu */
  C.dormantStudents = function (days) {
    const d = days || 21;
    return S().activeStudents().map((s) => ({ student: s, days: C.daysSinceLast(s.id), next: C.nextLessonOf(s.id) }))
      .filter((x) => x.days !== null && x.days >= d && !x.next)
      .sort((a, b) => b.days - a.days);
  };

  /* ============================================================
     PODSUMOWANIA
     ============================================================ */
  C.monthSummary = function (mk) {
    const key = mk || U.monthKey(U.today());
    const ls = C.lessonsInMonth(key);
    const held = ls.filter(C.isHeld);
    const rev = C.revenue(ls);
    const exp = C.expensesMonth(key);
    const from = key + '-01', to = U.endOfMonth(from);
    return {
      key: key, label: U.monthLabel(key),
      lessons: held.length,
      lessonsAll: ls.length,
      hours: C.hoursHeld(ls),
      revenue: rev,
      expenses: exp,
      profit: rev - exp,
      cancelled: ls.filter((l) => C.isCancelled(l)).length,
      noShow: ls.filter((l) => l.status === 'no_show').length,
      newStudents: S().repo('students').where((s) => U.monthKey(s.startDate) === key).length,
      lostStudents: S().repo('students').where((s) => s.status === 'ended' && s.endDate && U.monthKey(s.endDate) === key).length,
      avgRate: C.avgHourlyRate(ls),
      effectiveRate: C.effectiveHourlyRate(ls),
      attendance: C.attendance(ls),
      utilization: C.utilization(from, to),
      unpaid: U.sum(ls.filter(C.isDue), C.lessonValue),
      students: U.uniq(held.map((l) => l.studentId)).length,
      comparison: C.monthComparison(key)
    };
  };

  /** Zbiorczy pulpit — wszystko czego potrzebuje Dashboard */
  C.dashboard = function () {
    const t = U.today();
    const mk = U.monthKey(t);
    const weekFrom = U.startOfWeek(t), weekTo = U.addDays(weekFrom, 6);
    const f = C.monthForecast(mk);
    const todays = C.todayLessons();
    return {
      today: t,
      todayLessons: todays,
      todayCount: todays.filter((l) => !C.isCancelled(l)).length,
      todayPotential: C.todayRevenuePotential(),
      todayEarned: C.todayEarned(),
      monthRevenue: f.earned,
      monthForecast: f,
      activeStudents: S().activeStudents().length,
      unpaid: { count: C.unpaidLessons().length, total: C.unpaidTotal() },
      cancelledThisMonth: C.lessonsInMonth(mk).filter((l) => C.isCancelled(l)).length,
      utilization: C.utilization(weekFrom, weekTo),
      comparison: C.monthComparison(mk),
      next: C.nextLesson(),
      goal: C.goalProgress(),
      potential: C.unusedPotential(),
      weekHours: C.hoursHeld(C.lessonsIn(weekFrom, weekTo)),
      monthHours: C.hoursHeld(C.lessonsInMonth(mk)),
      monthLessons: C.lessonsInMonth(mk).filter(C.isHeld).length,
      newStudents: S().repo('students').where((s) => U.monthKey(s.startDate) === mk).length
    };
  };

  C.SEASONALITY = SEASONALITY;
  window.TF.Compute = C;
})();
