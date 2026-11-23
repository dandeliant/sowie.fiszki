/* ============================================================
   TutorFlow — models.js
   Definicje encji, słowniki statusów i fabryki obiektów.
   Każda encja ma własne `id`; relacje wyłącznie po identyfikatorach.
   Dzięki temu ten sam kształt danych zadziała później w Postgresie
   (tabela = kolekcja) albo w Supabase/Firebase bez migracji logiki.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;

  /* ---------------- Słowniki ---------------- */

  const LESSON_STATUS = {
    planned:            { label: 'Zaplanowana',            short: 'Zaplanowana', cls: 'info',  dot: 'st-planned',  icon: '📅' },
    done:               { label: 'Odbyła się',             short: 'Odbyta',      cls: 'ok',    dot: 'st-done',     icon: '✅' },
    no_show:            { label: 'Uczeń nie przyszedł',    short: 'Nieobecność', cls: 'bad',   dot: 'st-noshow',   icon: '❌' },
    cancelled_student:  { label: 'Odwołana przez ucznia',  short: 'Odwołana',    cls: 'bad',   dot: 'st-cancelled',icon: '🚫' },
    cancelled_tutor:    { label: 'Odwołana przeze mnie',   short: 'Odwołana',    cls: 'bad',   dot: 'st-cancelled',icon: '🚫' },
    rescheduled:        { label: 'Przełożona',             short: 'Przełożona',  cls: 'warn',  dot: 'st-moved',    icon: '🔄' }
  };

  const PAYMENT_STATUS = {
    paid:    { label: 'Opłacone',  cls: 'ok',   icon: '✅' },
    unpaid:  { label: 'Do zapłaty',cls: 'warn', icon: '🟡' },
    overdue: { label: 'Zaległe',   cls: 'bad',  icon: '🔴' },
    package: { label: 'Z pakietu', cls: 'brand',icon: '🎟️' },
    free:    { label: 'Bezpłatne', cls: '',     icon: '⚪' }
  };

  const PAYMENT_METHOD = {
    cash:     { label: 'Gotówka', icon: '💵' },
    transfer: { label: 'Przelew', icon: '🏦' },
    card:     { label: 'Karta',   icon: '💳' },
    blik:     { label: 'BLIK',    icon: '📱' },
    package:  { label: 'Pakiet',  icon: '🎟️' }
  };

  const STUDENT_STATUS = {
    active: { label: 'Aktywny',   cls: 'ok',   dot: '🟢' },
    paused: { label: 'Przerwa',   cls: 'warn', dot: '🟡' },
    ended:  { label: 'Zakończona',cls: '',     dot: '⚪' }
  };

  const MATERIAL_TYPE = {
    pdf:      { label: 'PDF',              icon: '📄', cls: 'mat-pdf' },
    link:     { label: 'Link',             icon: '🔗', cls: 'mat-link' },
    youtube:  { label: 'YouTube',          icon: '▶️', cls: 'mat-youtube' },
    exercise: { label: 'Ćwiczenia',        icon: '✏️', cls: 'mat-exercise' },
    exam:     { label: 'Arkusz egzaminacyjny', icon: '📋', cls: 'mat-exam' },
    note:     { label: 'Notatka',          icon: '🗒️', cls: 'mat-note' },
    homework: { label: 'Praca domowa',     icon: '🎒', cls: 'mat-homework' }
  };

  const EXPENSE_CATEGORY = {
    software:  { label: 'Oprogramowanie', icon: '💻' },
    materials: { label: 'Materiały',      icon: '📦' },
    books:     { label: 'Książki',        icon: '📚' },
    printing:  { label: 'Drukowanie',     icon: '🖨️' },
    equipment: { label: 'Sprzęt',         icon: '🖥️' },
    internet:  { label: 'Internet',       icon: '🌐' },
    ads:       { label: 'Reklama',        icon: '📣' },
    transport: { label: 'Transport',      icon: '🚗' },
    other:     { label: 'Inne',           icon: '•' }
  };

  const PRIORITY = {
    high: { label: 'Wysoki',  cls: 'prio-high', badge: 'bad' },
    med:  { label: 'Średni',  cls: 'prio-med',  badge: 'warn' },
    low:  { label: 'Niski',   cls: 'prio-low',  badge: '' }
  };

  const HOMEWORK_STATUS = {
    assigned: { label: 'Zadane',      cls: 'info' },
    done:     { label: 'Wykonane',    cls: 'ok' },
    not_done: { label: 'Niewykonane', cls: 'bad' }
  };

  const DURATIONS = [30, 45, 60, 90, 120];

  /* ---------------- Domyślne ustawienia ---------------- */
  function defaultSettings() {
    return {
      appName: 'TutorFlow',
      appTagline: 'Twoje korepetycje. Twój czas. Twoje finanse.',
      tutorName: '',
      tutorEmail: '',
      tutorPhone: '',
      subject: 'Angielski',
      currency: 'PLN',
      locale: 'pl-PL',
      dateFormat: 'dd.mm.yyyy',   // dd.mm.yyyy | yyyy-mm-dd | dd/mm/yyyy
      timeFormat: '24',           // 24 | 12
      theme: 'system',            // system | light | dark
      defaultPrice: 80,
      defaultDuration: 60,
      defaultMode: 'onsite',
      workDays: [0, 1, 2, 3, 4],  // 0 = poniedziałek
      workHours: { start: '14:00', end: '20:00' },
      workHoursByDay: {},         // { '0': {start,end}, … } — nadpisuje workHours
      slotStep: 30,
      cancellationPolicy: { hours: 24, chargeable: true, noShowChargeable: true },
      monthlyGoal: 8000,
      remindLessonMin: 30,
      onboarded: false,
      demoData: false,
      calendarView: 'week',
      version: 1
    };
  }

  /* ---------------- Fabryki ---------------- */

  function Student(p) {
    p = p || {};
    const st = (window.TF.Store && window.TF.Store.state.settings) || defaultSettings();
    const base = p.rate || st.defaultPrice || 80;
    return {
      id: p.id || U.uid('stu'),
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      phone: p.phone || '',
      email: p.email || '',
      parentContact: p.parentContact || '',
      grade: p.grade || '',
      school: p.school || '',
      level: p.level || '',
      subject: p.subject || st.subject || '',
      startDate: p.startDate || U.today(),
      endDate: p.endDate || null,
      preferredDay: p.preferredDay === undefined ? null : p.preferredDay,
      preferredTime: p.preferredTime || '',
      mode: p.mode || st.defaultMode || 'onsite',   // onsite | online
      location: p.location || '',
      group: !!p.group,
      status: p.status || 'active',                  // active | paused | ended
      defaultDuration: p.defaultDuration || st.defaultDuration || 60,
      rates: p.rates || {
        30: Math.round(base * 0.6),
        45: Math.round(base * 0.8),
        60: base,
        90: Math.round(base * 1.4),
        120: Math.round(base * 1.8)
      },
      color: p.color || null,
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Lesson(p) {
    p = p || {};
    const st = (window.TF.Store && window.TF.Store.state.settings) || defaultSettings();
    return {
      id: p.id || U.uid('les'),
      studentId: p.studentId || null,
      date: p.date || U.today(),
      start: p.start || '16:00',
      duration: p.duration || st.defaultDuration || 60,
      subject: p.subject || '',
      topic: p.topic || '',
      price: p.price === undefined || p.price === null ? (st.defaultPrice || 80) : Number(p.price),
      mode: p.mode || st.defaultMode || 'onsite',
      status: p.status || 'planned',
      paymentStatus: p.paymentStatus || 'unpaid',
      chargeable: p.chargeable === undefined ? true : !!p.chargeable,
      note: p.note || '',
      summary: p.summary || null,   // { topic, done, performance, improve, homework, next }
      recurrenceId: p.recurrenceId || null,
      packageId: p.packageId || null,
      paymentId: p.paymentId || null,
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Payment(p) {
    p = p || {};
    return {
      id: p.id || U.uid('pay'),
      studentId: p.studentId || null,
      amount: Number(p.amount) || 0,
      date: p.date || U.today(),
      method: p.method || 'transfer',
      status: p.status || 'paid',        // paid | pending
      lessonIds: p.lessonIds || [],
      packageId: p.packageId || null,
      note: p.note || '',
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Package(p) {
    p = p || {};
    const count = Number(p.lessonsCount) || 10;
    const price = Number(p.pricePerLesson) || 80;
    return {
      id: p.id || U.uid('pkg'),
      studentId: p.studentId || null,
      lessonsCount: count,
      pricePerLesson: price,
      total: p.total === undefined ? count * price : Number(p.total),
      usedCount: Number(p.usedCount) || 0,
      purchasedDate: p.purchasedDate || U.today(),
      paid: p.paid === undefined ? true : !!p.paid,
      note: p.note || '',
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Expense(p) {
    p = p || {};
    return {
      id: p.id || U.uid('exp'),
      date: p.date || U.today(),
      category: p.category || 'other',
      amount: Number(p.amount) || 0,
      description: p.description || '',
      recurring: !!p.recurring,
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Task(p) {
    p = p || {};
    return {
      id: p.id || U.uid('tsk'),
      title: p.title || '',
      studentId: p.studentId || null,
      due: p.due || null,
      priority: p.priority || 'med',
      done: !!p.done,
      doneAt: p.doneAt || null,
      note: p.note || '',
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Note(p) {
    p = p || {};
    return {
      id: p.id || U.uid('not'),
      studentId: p.studentId || null,
      lessonId: p.lessonId || null,
      date: p.date || U.today(),
      text: p.text || '',
      kind: p.kind || 'private',   // private | lesson | progress
      pinned: !!p.pinned,
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Material(p) {
    p = p || {};
    return {
      id: p.id || U.uid('mat'),
      studentId: p.studentId || null,
      title: p.title || '',
      type: p.type || 'link',
      url: p.url || '',
      note: p.note || '',
      date: p.date || U.today(),
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Goal(p) {
    p = p || {};
    return {
      id: p.id || U.uid('goa'),
      studentId: p.studentId || null,
      title: p.title || '',
      progress: Number(p.progress) || 0,   // 0–100
      deadline: p.deadline || null,
      done: !!p.done,
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  function Homework(p) {
    p = p || {};
    return {
      id: p.id || U.uid('hwk'),
      studentId: p.studentId || null,
      lessonId: p.lessonId || null,
      title: p.title || '',
      due: p.due || null,
      status: p.status || 'assigned',
      createdAt: p.createdAt || new Date().toISOString()
    };
  }

  window.TF.Models = {
    LESSON_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, STUDENT_STATUS,
    MATERIAL_TYPE, EXPENSE_CATEGORY, PRIORITY, HOMEWORK_STATUS, DURATIONS,
    defaultSettings,
    Student, Lesson, Payment, Package, Expense, Task, Note, Material, Goal, Homework
  };
})();
