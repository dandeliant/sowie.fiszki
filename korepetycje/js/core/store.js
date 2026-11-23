/* ============================================================
   TutorFlow — store.js
   Jedyne źródło prawdy o danych + operacje biznesowe.

   • state          — kolekcje encji (płaskie tablice, relacje po id)
   • repo(name)     — generyczne CRUD na kolekcji
   • ops            — operacje domenowe (odwołaj lekcję, zapłać, …)
   • on/emit        — prosty pub/sub; widoki nasłuchują 'change'
   • adapter        — wymienna warstwa zapisu (localStorage → backend)
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';
  const U = window.TF.U;
  const M = window.TF.Models;

  const COLLECTIONS = [
    'students', 'lessons', 'payments', 'packages',
    'expenses', 'tasks', 'notes', 'materials', 'goals', 'homework'
  ];

  const Store = {
    state: null,
    adapter: null,
    _subs: {},
    _saveTimer: null,
    _ready: false
  };

  /* ---------------- Pub / sub ---------------- */
  Store.on = function (evt, cb) {
    (this._subs[evt] = this._subs[evt] || []).push(cb);
    return () => this.off(evt, cb);
  };
  Store.off = function (evt, cb) {
    if (!this._subs[evt]) return;
    this._subs[evt] = this._subs[evt].filter((f) => f !== cb);
  };
  Store.emit = function (evt, data) {
    (this._subs[evt] || []).forEach((cb) => {
      try { cb(data); } catch (e) { console.error('[TutorFlow] handler', evt, e); }
    });
    if (evt !== '*') this.emit('*', { event: evt, data: data });
  };

  /* ---------------- Stan początkowy ---------------- */
  function emptyState() {
    const s = { settings: M.defaultSettings() };
    COLLECTIONS.forEach((c) => { s[c] = []; });
    return s;
  }

  function migrate(data) {
    const base = emptyState();
    if (!data || typeof data !== 'object') return base;
    base.settings = Object.assign({}, base.settings, data.settings || {});
    // scal zagnieżdżone obiekty ustawień
    base.settings.cancellationPolicy = Object.assign(
      {}, M.defaultSettings().cancellationPolicy, (data.settings && data.settings.cancellationPolicy) || {}
    );
    base.settings.workHours = Object.assign(
      {}, M.defaultSettings().workHours, (data.settings && data.settings.workHours) || {}
    );
    COLLECTIONS.forEach((c) => { base[c] = Array.isArray(data[c]) ? data[c] : []; });
    return base;
  }

  /* ---------------- Cykl życia ---------------- */
  Store.useAdapter = function (adapter) { this.adapter = adapter; return this; };

  Store.init = function () {
    if (!this.adapter) this.adapter = window.TF.Adapters.createDefaultAdapter();
    const raw = this.adapter.read();
    this.state = migrate(raw);
    this._ready = true;
    this.emit('ready', this.state);
    return this.state;
  };

  Store.isFresh = function () {
    return !this.state.settings.onboarded && this.state.students.length === 0;
  };

  Store.save = function (immediate) {
    if (!this._ready) return;
    clearTimeout(this._saveTimer);
    const doWrite = () => { this.adapter.write(this.state); this.emit('saved'); };
    if (immediate) doWrite();
    else this._saveTimer = setTimeout(doWrite, 220);
  };

  /** Wywoływane po każdej mutacji: zapis + powiadomienie widoków */
  Store.commit = function (collection, type, payload) {
    this.save();
    this.emit('change', { collection: collection, type: type, payload: payload });
  };

  Store.replaceAll = function (data) {
    this.state = migrate(data);
    this.save(true);
    this.emit('change', { collection: '*', type: 'replace' });
  };

  Store.reset = function () {
    this.state = emptyState();
    this.save(true);
    this.emit('change', { collection: '*', type: 'reset' });
  };

  /* ---------------- Ustawienia ---------------- */
  Store.settings = function () { return this.state.settings; };
  Store.setSetting = function (patch) {
    Object.assign(this.state.settings, patch);
    this.commit('settings', 'update', patch);
  };

  /* ---------------- Generyczne repozytorium ---------------- */
  function Repo(name) { this.name = name; }
  Repo.prototype.all = function () { return Store.state[this.name]; };
  Repo.prototype.byId = function (id) { return Store.state[this.name].find((x) => x.id === id) || null; };
  Repo.prototype.where = function (fn) { return Store.state[this.name].filter(fn); };
  Repo.prototype.count = function (fn) { return fn ? this.where(fn).length : this.all().length; };
  Repo.prototype.add = function (obj, silent) {
    Store.state[this.name].push(obj);
    if (!silent) Store.commit(this.name, 'add', obj);
    return obj;
  };
  Repo.prototype.addMany = function (arr) {
    arr.forEach((o) => Store.state[this.name].push(o));
    Store.commit(this.name, 'add-many', arr);
    return arr;
  };
  Repo.prototype.update = function (id, patch, silent) {
    const item = this.byId(id);
    if (!item) return null;
    Object.assign(item, patch);
    if (!silent) Store.commit(this.name, 'update', item);
    return item;
  };
  Repo.prototype.remove = function (id, silent) {
    const i = Store.state[this.name].findIndex((x) => x.id === id);
    if (i === -1) return false;
    const [gone] = Store.state[this.name].splice(i, 1);
    if (!silent) Store.commit(this.name, 'remove', gone);
    return gone;
  };
  Repo.prototype.removeWhere = function (fn) {
    const keep = [], gone = [];
    Store.state[this.name].forEach((x) => (fn(x) ? gone : keep).push(x));
    Store.state[this.name] = keep;
    if (gone.length) Store.commit(this.name, 'remove-many', gone);
    return gone;
  };

  const _repos = {};
  Store.repo = function (name) {
    if (!_repos[name]) _repos[name] = new Repo(name);
    return _repos[name];
  };
  COLLECTIONS.forEach((c) => {
    Object.defineProperty(Store, c, { get: function () { return Store.repo(c); } });
  });

  /* ---------------- Skróty odczytu ---------------- */
  Store.student = function (id) { return Store.repo('students').byId(id); };
  Store.studentName = function (id) {
    const s = Store.student(id);
    return s ? (s.firstName + ' ' + s.lastName).trim() : 'Nieznany uczeń';
  };
  Store.activeStudents = function () { return Store.repo('students').where((s) => s.status === 'active'); };
  Store.lessonsOf = function (studentId) {
    return U.sortBy(Store.repo('lessons').where((l) => l.studentId === studentId), (l) => l.date + l.start);
  };
  Store.lessonsOn = function (dateIso) {
    return U.sortBy(Store.repo('lessons').where((l) => l.date === dateIso), (l) => l.start);
  };
  Store.lessonsBetween = function (from, to) {
    return U.sortBy(Store.repo('lessons').where((l) => l.date >= from && l.date <= to), (l) => l.date + l.start);
  };

  /* ============================================================
     OPERACJE DOMENOWE
     ============================================================ */
  const ops = {};

  /** Czy dwie lekcje nachodzą na siebie w czasie */
  function overlap(a, b) {
    if (a.date !== b.date) return false;
    const a1 = U.toMin(a.start), a2 = a1 + a.duration;
    const b1 = U.toMin(b.start), b2 = b1 + b.duration;
    return a1 < b2 && b1 < a2;
  }

  /** Zwraca kolidujące lekcje (pomijając odwołane i wskazane id) */
  ops.findConflicts = function (draft, ignoreId) {
    return Store.repo('lessons').where((l) => {
      if (l.id === ignoreId) return false;
      if (l.status === 'cancelled_student' || l.status === 'cancelled_tutor' || l.status === 'rescheduled') return false;
      return overlap(draft, l);
    });
  };

  /** Cena wynikająca ze stawek ucznia dla danego czasu trwania */
  ops.priceFor = function (studentId, duration) {
    const s = Store.student(studentId);
    const st = Store.settings();
    if (!s) return Math.round((st.defaultPrice || 80) * (duration / 60));
    if (s.rates && s.rates[duration] !== undefined) return Number(s.rates[duration]);
    const base = (s.rates && s.rates[60]) || st.defaultPrice || 80;
    return Math.round(base * (duration / 60));
  };

  ops.addLesson = function (data) {
    const lesson = M.Lesson(data);
    const s = Store.student(lesson.studentId);
    if (s) {
      if (!lesson.subject) lesson.subject = s.subject;
      if (!data.mode) lesson.mode = s.mode;
    }
    Store.repo('lessons').add(lesson);
    ops.autoConsumePackage(lesson);
    return lesson;
  };

  /**
   * Wylicza daty serii BEZ tworzenia czegokolwiek — pozwala pokazać
   * podgląd terminów i kolizji, zanim użytkownik zatwierdzi.
   * rule: { type:'weekly'|'biweekly'|'custom', count, days:[0..6] }
   */
  ops.projectRecurring = function (data, rule) {
    const out = [];
    const count = U.clamp(Number(rule.count) || 1, 1, 200);
    if (rule.type === 'custom' && rule.days && rule.days.length) {
      let cursor = data.date, made = 0, guard = 0;
      while (made < count && guard++ < 1000) {
        if (rule.days.indexOf(U.dow(cursor)) !== -1) { out.push(cursor); made++; }
        cursor = U.addDays(cursor, 1);
      }
    } else {
      const step = rule.type === 'biweekly' ? 14 : 7;
      for (let i = 0; i < count; i++) out.push(U.addDays(data.date, i * step));
    }
    return out;
  };

  /** Które terminy serii kolidują z już istniejącymi zajęciami */
  ops.recurringConflicts = function (data, rule) {
    const taken = [];
    return ops.projectRecurring(data, rule).map(function (d) {
      const draft = { date: d, start: data.start, duration: data.duration };
      // uwzględnij także wcześniejsze terminy tej samej serii
      const selfClash = taken.some(function (t) {
        return t.date === d && U.toMin(t.start) < U.toMin(data.start) + data.duration &&
          U.toMin(data.start) < U.toMin(t.start) + t.duration;
      });
      taken.push(draft);
      const clash = ops.findConflicts(draft);
      return { date: d, conflicts: clash, blocked: clash.length > 0 || selfClash };
    });
  };

  /**
   * Tworzy serię lekcji. Terminy kolidujące z istniejącymi zajęciami są
   * pomijane (rule.skipConflicts === false wymusza utworzenie mimo kolizji).
   * @returns {{created: Array, skipped: Array, recurrenceId: string}}
   */
  ops.addRecurring = function (data, rule) {
    const rid = U.uid('rec');
    const created = [], skipped = [];
    ops.projectRecurring(data, rule).forEach(function (d) {
      if (rule.skipConflicts !== false) {
        const clash = ops.findConflicts({ date: d, start: data.start, duration: data.duration });
        if (clash.length) { skipped.push({ date: d, conflictWith: clash[0] }); return; }
      }
      created.push(ops.addLesson(Object.assign({}, data, { date: d, recurrenceId: rid })));
    });
    return { created: created, skipped: skipped, recurrenceId: rid };
  };

  /** Wszystkie lekcje należące do jednej serii */
  ops.seriesOf = function (recurrenceId) {
    if (!recurrenceId) return [];
    return U.sortBy(Store.repo('lessons').where(function (l) { return l.recurrenceId === recurrenceId; }),
      function (l) { return l.date + l.start; });
  };

  /* ============================================================
     EDYCJA SERII

     Pola opisujące przebieg konkretnych zajęć (czy się odbyły,
     czy zostały opłacone) nigdy nie rozlewają się na całą serię —
     to fakty o pojedynczej lekcji, nie właściwości cyklu.
     ============================================================ */
  const PER_LESSON_FIELDS = ['status', 'paymentStatus'];
  ops.PER_LESSON_FIELDS = PER_LESSON_FIELDS;

  /** Informacje o serii, do której należy lekcja (null, gdy to pojedyncze zajęcia) */
  ops.seriesInfo = function (lessonId) {
    const l = Store.repo('lessons').byId(lessonId);
    if (!l || !l.recurrenceId) return null;
    const all = ops.seriesOf(l.recurrenceId);
    if (all.length < 2) return null;
    const key = l.date + l.start;
    const future = all.filter(function (x) { return (x.date + x.start) >= key; });

    const gaps = [];
    for (let i = 1; i < all.length; i++) gaps.push(U.diffDays(all[i - 1].date, all[i].date));
    gaps.sort(function (a, b) { return a - b; });
    const gap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;

    return {
      recurrenceId: l.recurrenceId,
      all: all, future: future,
      total: all.length,
      futureCount: future.length,
      pastCount: all.length - future.length,
      gap: gap,
      // forma dopełniacza — do zdań typu „część serii …”
      rhythm: gap === 7 ? 'cotygodniowej' : gap === 14 ? 'co dwa tygodnie' : 'powtarzalnej',
      // forma samodzielna — do nagłówków i etykiet
      rhythmLabel: gap === 7 ? 'co tydzień' : gap === 14 ? 'co 2 tygodnie' : 'powtarzalna',
      first: all[0],
      last: all[all.length - 1]
    };
  };

  /** Lekcje objęte danym zakresem. scope: 'one' | 'future' | 'all' */
  ops.seriesScope = function (lessonId, scope) {
    const l = Store.repo('lessons').byId(lessonId);
    if (!l) return [];
    if (!l.recurrenceId || scope === 'one' || !scope) return [l];
    const all = ops.seriesOf(l.recurrenceId);
    if (scope === 'all') return all;
    const key = l.date + l.start;
    return all.filter(function (x) { return (x.date + x.start) >= key; });
  };

  /**
   * Wylicza skutki zmian dla całego zakresu — bez zapisywania.
   * Zmiana daty jest przenoszona jako PRZESUNIĘCIE o tyle samo dni,
   * dzięki czemu rytm serii zostaje zachowany.
   */
  ops.previewSeriesChanges = function (lessonId, changes, scope) {
    const base = Store.repo('lessons').byId(lessonId);
    if (!base) return { proposals: [], ok: [], blocked: [] };

    const targets = ops.seriesScope(lessonId, scope);
    const shift = changes.date !== undefined ? U.diffDays(base.date, changes.date) : 0;
    const inScope = {};
    targets.forEach(function (t) { inScope[t.id] = true; });

    const proposals = targets.map(function (t) {
      const patch = {};
      Object.keys(changes).forEach(function (k) {
        if (k === 'date') {
          if (t.id === lessonId) patch.date = changes.date;
          else if (shift !== 0) patch.date = U.addDays(t.date, shift);
          return;
        }
        if (t.id !== lessonId && PER_LESSON_FIELDS.indexOf(k) !== -1) return;
        patch[k] = changes[k];
      });
      return {
        lesson: t,
        patch: patch,
        next: {
          date: patch.date !== undefined ? patch.date : t.date,
          start: patch.start !== undefined ? patch.start : t.start,
          duration: patch.duration !== undefined ? patch.duration : t.duration
        },
        conflicts: []
      };
    });

    // kolizje z zajęciami spoza zakresu
    proposals.forEach(function (p) {
      p.conflicts = ops.findConflicts(p.next, p.lesson.id).filter(function (c) { return !inScope[c.id]; });
    });
    // kolizje wewnątrz przesuwanego zbioru
    for (let i = 0; i < proposals.length; i++) {
      for (let j = i + 1; j < proposals.length; j++) {
        const a = proposals[i].next, b = proposals[j].next;
        if (a.date !== b.date) continue;
        const a1 = U.toMin(a.start), a2 = a1 + a.duration;
        const b1 = U.toMin(b.start), b2 = b1 + b.duration;
        if (a1 < b2 && b1 < a2) proposals[j].conflicts = proposals[j].conflicts.concat([proposals[i].lesson]);
      }
    }

    return {
      proposals: proposals,
      ok: proposals.filter(function (p) { return !p.conflicts.length && Object.keys(p.patch).length; }),
      blocked: proposals.filter(function (p) { return p.conflicts.length; })
    };
  };

  /** Zapisuje zmiany w zakresie; kolidujące terminy zostają nietknięte */
  ops.applySeriesChanges = function (lessonId, changes, scope) {
    const pre = ops.previewSeriesChanges(lessonId, changes, scope);
    pre.ok.forEach(function (p) { Store.repo('lessons').update(p.lesson.id, p.patch, true); });
    Store.commit('lessons', 'update-series', { count: pre.ok.length });
    return { updated: pre.ok.length, skipped: pre.blocked, preview: pre };
  };

  /** Usuwa lekcje objęte zakresem */
  ops.deleteSeries = function (lessonId, scope) {
    const targets = ops.seriesScope(lessonId, scope);
    targets.forEach(function (t) { Store.repo('lessons').remove(t.id, true); });
    Store.commit('lessons', 'remove-series', targets);
    return targets.length;
  };

  ops.updateLesson = function (id, patch) {
    return Store.repo('lessons').update(id, patch);
  };

  ops.moveLesson = function (id, date, start) {
    const l = Store.repo('lessons').byId(id);
    if (!l) return null;
    return Store.repo('lessons').update(id, { date: date, start: start });
  };

  /** Czy odwołanie jest płatne wg reguły z ustawień */
  ops.cancellationChargeable = function (lesson, whenIso, whenMin) {
    const pol = Store.settings().cancellationPolicy || {};
    if (!pol.chargeable) return false;
    const nowD = whenIso || U.today();
    const nowM = whenMin === undefined ? U.nowMin() : whenMin;
    const minutesUntil = (U.diffDays(nowD, lesson.date) * 1440) + (U.toMin(lesson.start) - nowM);
    return minutesUntil < (pol.hours || 24) * 60;
  };

  ops.setStatus = function (id, status, extra) {
    const l = Store.repo('lessons').byId(id);
    if (!l) return null;
    const patch = Object.assign({ status: status }, extra || {});

    if (status === 'done') {
      if (l.paymentStatus === 'free') patch.paymentStatus = 'free';
      patch.chargeable = true;
    }
    if (status === 'cancelled_student' || status === 'cancelled_tutor') {
      if (extra && extra.chargeable !== undefined) patch.chargeable = !!extra.chargeable;
      else patch.chargeable = status === 'cancelled_student' ? ops.cancellationChargeable(l) : false;
      if (!patch.chargeable) patch.paymentStatus = 'free';
      else if (l.paymentStatus === 'free') patch.paymentStatus = 'unpaid';
    }
    if (status === 'no_show') {
      const pol = Store.settings().cancellationPolicy || {};
      patch.chargeable = extra && extra.chargeable !== undefined ? !!extra.chargeable : pol.noShowChargeable !== false;
      if (!patch.chargeable) patch.paymentStatus = 'free';
    }
    if (status === 'rescheduled') { patch.chargeable = false; }
    if (status === 'planned') { patch.chargeable = true; }

    const updated = Store.repo('lessons').update(id, patch);
    if (status === 'done') ops.autoConsumePackage(updated);
    return updated;
  };

  ops.setPaymentStatus = function (id, paymentStatus) {
    return Store.repo('lessons').update(id, { paymentStatus: paymentStatus });
  };

  /** Oznacza lekcję jako opłaconą i tworzy wpis płatności */
  ops.payLesson = function (id, method) {
    const l = Store.repo('lessons').byId(id);
    if (!l || l.paymentStatus === 'paid') return null;
    const amount = window.TF.Compute.lessonValue(l);
    const p = M.Payment({
      studentId: l.studentId, amount: amount, method: method || 'transfer',
      lessonIds: [l.id], note: 'Lekcja ' + U.fmtDate(l.date)
    });
    Store.repo('payments').add(p, true);
    Store.repo('lessons').update(id, { paymentStatus: 'paid', paymentId: p.id }, true);
    Store.commit('payments', 'add', p);
    return p;
  };

  /**
   * Rejestruje wpłatę i rozlicza ją z nieopłaconymi lekcjami
   * (od najstarszej). Nadwyżka zostaje jako nadpłata (saldo ujemne).
   */
  ops.addPayment = function (data, allocate) {
    const p = M.Payment(data);
    let left = p.amount;
    if (allocate !== false && p.studentId) {
      const C = window.TF.Compute;
      const unpaid = U.sortBy(
        Store.repo('lessons').where((l) => l.studentId === p.studentId && C.isBillable(l) && l.paymentStatus === 'unpaid'),
        (l) => l.date + l.start
      );
      unpaid.forEach((l) => {
        const val = C.lessonValue(l);
        if (left + 0.001 >= val && val > 0) {
          left -= val;
          Store.repo('lessons').update(l.id, { paymentStatus: 'paid', paymentId: p.id }, true);
          p.lessonIds.push(l.id);
        }
      });
    }
    Store.repo('payments').add(p);
    return p;
  };

  ops.deletePayment = function (id) {
    const p = Store.repo('payments').byId(id);
    if (!p) return false;
    (p.lessonIds || []).forEach((lid) => {
      const l = Store.repo('lessons').byId(lid);
      if (l && l.paymentId === p.id) Store.repo('lessons').update(lid, { paymentStatus: 'unpaid', paymentId: null }, true);
    });
    return Store.repo('payments').remove(id);
  };

  /* ---------------- Pakiety ---------------- */
  ops.addPackage = function (data) {
    const pkg = M.Package(data);
    Store.repo('packages').add(pkg, true);
    if (pkg.paid) {
      const pay = M.Payment({
        studentId: pkg.studentId, amount: pkg.total, method: 'package',
        packageId: pkg.id, note: 'Pakiet ' + pkg.lessonsCount + ' lekcji'
      });
      Store.repo('payments').add(pay, true);
    }
    Store.commit('packages', 'add', pkg);
    return pkg;
  };

  ops.activePackage = function (studentId) {
    return Store.repo('packages').where((p) => p.studentId === studentId && p.usedCount < p.lessonsCount)
      .sort((a, b) => (a.purchasedDate < b.purchasedDate ? -1 : 1))[0] || null;
  };

  /** Jeśli uczeń ma aktywny pakiet — odbyta lekcja zjada jedno wejście */
  ops.autoConsumePackage = function (lesson) {
    if (!lesson || lesson.status !== 'done') return;
    if (lesson.packageId || lesson.paymentStatus === 'paid' || lesson.paymentStatus === 'free') return;
    const pkg = ops.activePackage(lesson.studentId);
    if (!pkg) return;
    Store.repo('packages').update(pkg.id, { usedCount: pkg.usedCount + 1 }, true);
    Store.repo('lessons').update(lesson.id, { packageId: pkg.id, paymentStatus: 'package' }, true);
    Store.save();
  };

  /* ---------------- Uczniowie ---------------- */
  ops.addStudent = function (data) {
    const s = M.Student(data);
    Store.repo('students').add(s);
    return s;
  };

  /** Usuwa ucznia wraz z powiązanymi encjami */
  ops.deleteStudent = function (id) {
    const s = Store.student(id);
    if (!s) return false;
    ['lessons', 'payments', 'packages', 'notes', 'materials', 'goals', 'homework']
      .forEach((c) => Store.repo(c).removeWhere((x) => x.studentId === id));
    Store.repo('tasks').where((t) => t.studentId === id).forEach((t) => Store.repo('tasks').update(t.id, { studentId: null }, true));
    Store.repo('students').remove(id);
    return true;
  };

  /* ---------------- Notatki po lekcji ---------------- */
  ops.saveLessonSummary = function (lessonId, summary) {
    const l = Store.repo('lessons').byId(lessonId);
    if (!l) return null;
    Store.repo('lessons').update(lessonId, {
      summary: summary,
      topic: summary.topic || l.topic,
      status: l.status === 'planned' ? 'done' : l.status
    }, true);

    const parts = [];
    if (summary.done) parts.push('Zrobione: ' + summary.done);
    if (summary.performance) parts.push('Uczeń: ' + summary.performance);
    if (summary.improve) parts.push('Do poprawy: ' + summary.improve);
    if (summary.next) parts.push('Następnym razem: ' + summary.next);
    if (parts.length || summary.topic) {
      Store.repo('notes').add(M.Note({
        studentId: l.studentId, lessonId: l.id, date: l.date, kind: 'lesson',
        text: (summary.topic ? summary.topic + '\n' : '') + parts.join('\n')
      }), true);
    }
    if (summary.homework) {
      Store.repo('homework').add(M.Homework({
        studentId: l.studentId, lessonId: l.id, title: summary.homework,
        due: U.addDays(l.date, 7), status: 'assigned'
      }), true);
    }
    ops.autoConsumePackage(Store.repo('lessons').byId(lessonId));
    Store.commit('lessons', 'summary', l);
    return l;
  };

  /* ============================================================
     KOPIA ZAPASOWA I PRZENIESIENIE NA INNE URZĄDZENIE

     Plik eksportu zawiera KOMPLET danych: ustawienia korepetytora
     oraz wszystkie kolekcje. Wystarczy przenieść go na drugie
     urządzenie i wczytać — nic nie zostaje w tyle.
     ============================================================ */

  /** Liczebność każdej kolekcji w podanym zbiorze danych */
  ops.countCollections = function (data) {
    const counts = {};
    COLLECTIONS.forEach(function (c) { counts[c] = Array.isArray(data[c]) ? data[c].length : 0; });
    counts._total = COLLECTIONS.reduce(function (a, c) { return a + counts[c]; }, 0);
    return counts;
  };

  ops.exportJSON = function () {
    const payload = {
      _app: 'TutorFlow',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      settings: Store.state.settings
    };
    COLLECTIONS.forEach(function (c) { payload[c] = Store.state[c]; });
    payload._counts = ops.countCollections(payload);
    return JSON.stringify(payload, null, 2);
  };

  /**
   * Sprawdza plik BEZ wprowadzania zmian — pozwala pokazać
   * użytkownikowi, co dokładnie zawiera, zanim cokolwiek nadpiszemy.
   */
  ops.inspectJSON = function (text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('To nie jest poprawny plik JSON.'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Nieprawidłowa struktura pliku.');
    }
    const hasCollections = COLLECTIONS.some(function (c) { return Array.isArray(data[c]); });
    if (!hasCollections && !data.settings) {
      throw new Error('Plik nie zawiera danych TutorFlow.');
    }
    return {
      data: data,
      app: data._app || null,
      version: data._version || null,
      exportedAt: data._exportedAt || null,
      counts: ops.countCollections(data),
      hasSettings: !!data.settings,
      tutorName: (data.settings && data.settings.tutorName) || ''
    };
  };

  /**
   * Scala dane z pliku z obecnymi. Rekordy o tym samym `id`
   * zostają zaktualizowane, nowe — dopisane. Nic nie znika.
   */
  ops.mergeData = function (data, opts) {
    opts = opts || {};
    const added = {}, updated = {};
    let addedTotal = 0, updatedTotal = 0;

    COLLECTIONS.forEach(function (c) {
      const incoming = Array.isArray(data[c]) ? data[c] : [];
      const index = {};
      Store.state[c].forEach(function (x, i) { index[x.id] = i; });
      added[c] = 0; updated[c] = 0;
      incoming.forEach(function (rec) {
        if (!rec || !rec.id) return;
        if (index[rec.id] !== undefined) { Store.state[c][index[rec.id]] = rec; updated[c]++; }
        else { Store.state[c].push(rec); index[rec.id] = Store.state[c].length - 1; added[c]++; }
      });
      addedTotal += added[c]; updatedTotal += updated[c];
    });

    if (opts.withSettings && data.settings) {
      const theme = Store.state.settings.theme;
      Object.assign(Store.state.settings, data.settings);
      if (!opts.withTheme) Store.state.settings.theme = theme;
    }

    Store.save(true);
    Store.emit('change', { collection: '*', type: 'merge' });
    return { added: added, updated: updated, addedTotal: addedTotal, updatedTotal: updatedTotal };
  };

  /**
   * @param {string} text  zawartość pliku
   * @param {object} opts  { mode: 'replace' | 'merge', withSettings, withTheme }
   */
  ops.importJSON = function (text, opts) {
    opts = opts || {};
    const info = ops.inspectJSON(text);
    if (opts.mode === 'merge') {
      return Object.assign({ mode: 'merge' }, info, ops.mergeData(info.data, opts));
    }
    const data = info.data;
    if (opts.withSettings === false) {
      // użytkownik chce przenieść tylko wpisy — konfiguracja tego urządzenia zostaje
      data.settings = U.clone(Store.state.settings);
    } else if (data.settings && !opts.withTheme) {
      // motyw jest ustawieniem urządzenia, nie danych — domyślnie zostaje lokalny
      data.settings = Object.assign({}, data.settings, { theme: Store.state.settings.theme });
    }
    Store.replaceAll(data);
    return Object.assign({ mode: 'replace' }, info);
  };

  Store.ops = ops;
  Store.COLLECTIONS = COLLECTIONS;
  window.TF.Store = Store;
})();
