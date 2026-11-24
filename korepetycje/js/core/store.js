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
    'expenses', 'tasks', 'notes', 'materials', 'goals', 'homework',
    'series'   // reguły lekcji cyklicznych (starsze zapisy jej nie mają — migrate() da pustą listę)
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

  /** Cena wynikająca ze stawek ucznia dla danego czasu trwania.
   *  Stawka zapisana w cenniku ucznia — bez zmian; cena wyliczana (nietypowa
   *  długość, brak stawki) — zaokrąglona w górę do pełnych 5 zł (U.roundPrice). */
  ops.priceFor = function (studentId, duration) {
    const s = Store.student(studentId);
    const st = Store.settings();
    if (!s) return U.roundPrice((st.defaultPrice || 80) * (duration / 60));
    const own = s.rates ? Number(s.rates[duration]) : 0;
    if (own > 0) return own;
    const base = (s.rates && Number(s.rates[60])) || st.defaultPrice || 80;
    return U.roundPrice(base * (duration / 60));
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

  /* ============================================================
     LEKCJE CYKLICZNE (SERIE)

     Reguła powtarzania jest zapisana w kolekcji `series`
     (id = recurrenceId lekcji), a same lekcje serii to zwykłe
     wpisy w `lessons` — status, płatności, finanse, prognozy
     i przypomnienia działają na nich bez zmian.
     • „po N lekcjach” / „do daty” — lekcje tworzone od razu
       (odległa data końca: najwyżej 12 miesięcy do przodu),
     • „bez końca” — lekcje na 12 miesięcy do przodu, dokładane
       automatycznie przy starcie aplikacji (extendSeries).
     Lekcje odbyte, opłacone, odwołane i przeszłe są „zamknięte”
     (isLocked) — edycja i usuwanie serii ich nie zmieniają.
     Starsze serie (sam recurrenceId, bez zapisanej reguły) działają
     dalej — regułę odtwarzamy z odstępów między lekcjami (ruleOf).
     ============================================================ */
  const HORIZON_MONTHS = 12;   // „bez końca” — lekcje na tyle miesięcy do przodu
  const REFILL_MONTHS = 11;    // dokładamy, gdy zostało mniej niż tyle
  const MAX_OCC = 500;         // bezpiecznik liczby lekcji tworzonych naraz
  const FREQS = ['day', 'week', 'month', 'year'];
  const ENDS = ['count', 'until', 'never'];
  const TEMPLATE_FIELDS = ['studentId', 'start', 'duration', 'mode', 'subject', 'topic', 'price', 'note'];
  ops.RECUR_HORIZON_MONTHS = HORIZON_MONTHS;

  /** Ujednolica regułę: { freq, interval, days, end, until, count } */
  function normRule(r, anchor) {
    r = r || {};
    const freq = FREQS.indexOf(r.freq) !== -1 ? r.freq : 'week';
    const out = {
      freq: freq,
      interval: U.clamp(Math.round(Number(r.interval) || 1), 1, 99),
      days: null,
      end: ENDS.indexOf(r.end) !== -1 ? r.end : 'count',
      until: null,
      count: null
    };
    if (freq === 'week' && Array.isArray(r.days) && r.days.length) {
      const days = U.uniq(r.days.map(Number).filter(function (d) { return d >= 0 && d <= 6; }))
        .sort(function (a, b) { return a - b; });
      // jeden dzień = dzień pierwszej lekcji → zwykłe „co tydzień”
      if (days.length > 1 || (days.length === 1 && (!anchor || days[0] !== U.dow(anchor)))) out.days = days;
    }
    if (out.end === 'until') {
      if (r.until) out.until = String(r.until).slice(0, 10);
      else out.end = 'count';
    }
    if (out.end === 'count') out.count = U.clamp(Math.round(Number(r.count) || 10), 1, MAX_OCC);
    return out;
  }

  function nthDate(anchor, freq, interval, i) {
    if (freq === 'day') return U.addDays(anchor, i * interval);
    if (freq === 'week') return U.addDays(anchor, i * interval * 7);
    // liczone zawsze od pierwszego terminu: 31 sty → 28 lut → 31 mar (nie „dryfuje”)
    if (freq === 'month') return U.addMonths(anchor, i * interval);
    return U.addMonths(anchor, i * interval * 12);          // 29 lut → 28 lut w latach zwykłych
  }

  /** Daty wystąpień reguły od anchor (włącznie) do limit (włącznie; null tylko przy „po N lekcjach”) */
  function ruleDates(anchor, rule, limit) {
    const r = normRule(rule, anchor);
    const out = [];
    let stop = limit || null;
    if (r.end === 'until' && (!stop || r.until < stop)) stop = r.until;
    const max = r.end === 'count' ? r.count : MAX_OCC;
    if (!stop && r.end !== 'count') return out;
    if (r.days) {
      const w0 = U.startOfWeek(anchor);
      for (let k = 0; out.length < max && k < 5200; k += r.interval) {
        const ws = U.addDays(w0, k * 7);
        if (stop && ws > stop) break;
        for (let j = 0; j < r.days.length && out.length < max; j++) {
          const d = U.addDays(ws, r.days[j]);
          if (d < anchor) continue;
          if (stop && d > stop) break;
          out.push(d);
        }
      }
      return out;
    }
    for (let i = 0; out.length < max && i < 20000; i++) {
      const d = nthDate(anchor, r.freq, r.interval, i);
      if (stop && d > stop) break;
      out.push(d);
    }
    return out;
  }

  /** Do kiedy tworzymy lekcje od razu: „bez końca” i odległa data → 12 mies. do przodu */
  function horizonFor(anchor, r) {
    const from = anchor > U.today() ? anchor : U.today();
    let lim = U.addMonths(from, HORIZON_MONTHS);
    if (r.end === 'until' && r.until && r.until < lim) lim = r.until;
    return lim;
  }
  function limitFor(anchor, r) { return r.end === 'count' ? null : horizonFor(anchor, r); }

  ops.normRule = normRule;
  ops.ruleDates = ruleDates;
  /** Daty, które reguła utworzy teraz (podgląd w formularzu) */
  ops.ruleProjection = function (anchor, rule) {
    const r = normRule(rule, anchor);
    return ruleDates(anchor, r, limitFor(anchor, r));
  };
  ops.sameRule = function (a, b, anchor) {
    if (!a || !b) return !a && !b;
    return JSON.stringify(normRule(a, anchor)) === JSON.stringify(normRule(b, anchor));
  };

  /** „co tydzień”, „co 2 tygodnie”, „co 3 dni”, „co tydzień (pon, śr)” … */
  ops.ruleLabel = function (rule, anchor) {
    const r = normRule(rule, anchor);
    let s;
    if (r.interval === 1) s = { day: 'codziennie', week: 'co tydzień', month: 'co miesiąc', year: 'co rok' }[r.freq];
    else {
      const f = M.RECUR_FREQ[r.freq].forms;
      s = 'co ' + r.interval + ' ' + U.plural(r.interval, f[0], f[1], f[2]);
    }
    if (r.days) s += ' (' + r.days.map(function (d) { return U.DOW_SHORT[d].toLowerCase(); }).join(', ') + ')';
    return s;
  };
  /** „10 lekcji”, „do 30 cze 2027”, „bez końca” */
  ops.ruleEndLabel = function (rule, anchor) {
    const r = normRule(rule, anchor);
    if (r.end === 'count') return U.lessonsLabel(r.count);
    if (r.end === 'until') return 'do ' + U.fmtDate(r.until, 'medium');
    return 'bez końca';
  };

  function nowIso() { return new Date().toISOString(); }

  function templateFrom(data) {
    const t = {};
    TEMPLATE_FIELDS.forEach(function (k) { if (data[k] !== undefined) t[k] = data[k]; });
    // „opłacone” dotyczy jednej konkretnej lekcji — nowe terminy są do zapłaty
    t.paymentStatus = data.paymentStatus === 'free' || data.paymentStatus === 'package' ? data.paymentStatus : 'unpaid';
    return t;
  }
  function lessonFromTemplate(tpl, date, rid) {
    const l = M.Lesson(Object.assign({}, tpl, {
      date: date, recurrenceId: rid, status: 'planned',
      summary: null, paymentId: null, packageId: null, id: undefined, createdAt: undefined
    }));
    const s = Store.student(l.studentId);
    if (s) {
      if (!l.subject) l.subject = s.subject;
      if (!tpl.mode) l.mode = s.mode;
    }
    return l;
  }

  /** Lekcja „zamknięta”: odbyta, odwołana, nieobecna, przełożona, opłacona albo już w przeszłości.
   *  Zmiany i usuwanie całej serii jej nie dotykają (pojedynczo można ją edytować jak dawniej). */
  ops.isLocked = function (l) {
    if (!l) return true;
    if (l.status !== 'planned') return true;
    if (l.paymentStatus === 'paid' || l.paymentStatus === 'package' || l.paymentId || l.packageId) return true;
    return window.TF.Compute.isPast(l);
  };

  ops.seriesRecord = function (rid) { return rid ? Store.repo('series').byId(rid) : null; };

  /* liczba lekcji w każdej serii — do znaczka 🔁 (liczone raz na zmianę danych) */
  let _recCounts = null;
  Store.on('change', function () { _recCounts = null; });
  ops.isRecurring = function (l) {
    if (!l || !l.recurrenceId) return false;
    if (!_recCounts) {
      _recCounts = {};
      Store.state.lessons.forEach(function (x) {
        if (x.recurrenceId) _recCounts[x.recurrenceId] = (_recCounts[x.recurrenceId] || 0) + 1;
      });
    }
    return _recCounts[l.recurrenceId] > 1 || !!ops.seriesRecord(l.recurrenceId);
  };

  /** Wszystkie lekcje należące do jednej serii */
  ops.seriesOf = function (recurrenceId) {
    if (!recurrenceId) return [];
    return U.sortBy(Store.repo('lessons').where(function (l) { return l.recurrenceId === recurrenceId; }),
      function (l) { return l.date + l.start; });
  };

  /** Reguła serii, do której należy lekcja: zapisana albo odtworzona (starsze serie) */
  ops.ruleOf = function (lessonId) {
    const l = Store.repo('lessons').byId(lessonId);
    if (!l || !l.recurrenceId) return null;
    const rec = ops.seriesRecord(l.recurrenceId);
    if (rec) return { anchor: rec.anchor, rule: normRule(rec, rec.anchor), record: rec, inferred: false };
    const all = ops.seriesOf(l.recurrenceId);
    if (all.length < 2) return null;
    const gaps = [];
    for (let i = 1; i < all.length; i++) gaps.push(U.diffDays(all[i - 1].date, all[i].date));
    const dows = U.uniq(all.map(function (x) { return U.dow(x.date); }));
    let rule;
    if (gaps.every(function (g) { return g > 0 && g % 7 === 0; })) {
      rule = { freq: 'week', interval: Math.min.apply(null, gaps) / 7 };
    } else if (dows.length > 1 && gaps.every(function (g) { return g > 0 && g < 7; })) {
      rule = { freq: 'week', interval: 1, days: dows };
    } else {
      const sorted = gaps.slice().sort(function (a, b) { return a - b; });
      rule = { freq: 'day', interval: Math.max(1, sorted[Math.floor(sorted.length / 2)]) };
    }
    rule.end = 'count';
    rule.count = all.length;
    return { anchor: all[0].date, rule: normRule(rule, all[0].date), record: null, inferred: true };
  };

  /**
   * Nowa seria. data = dane lekcji z formularza (date = pierwszy termin).
   * Terminy kolidujące z istniejącymi zajęciami są pomijane (opts.skipConflicts === false wymusza).
   * opts.baseLessonId — istniejąca lekcja staje się pierwszą lekcją serii
   * (edycja pojedynczych zajęć → „🔁 Powtarzaj”); opts.basePatch — jej zmiany z formularza.
   * @returns {{created: Array, skipped: Array, recurrenceId: string|null, series: object|null}}
   */
  ops.createSeries = function (data, rule, opts) {
    opts = opts || {};
    const L = Store.repo('lessons');
    const r = normRule(rule, data.date);
    const rid = U.uid('rec');
    const tpl = templateFrom(data);
    const limit = limitFor(data.date, r);
    const dates = ruleDates(data.date, r, limit);
    const base = opts.baseLessonId ? L.byId(opts.baseLessonId) : null;
    const created = [], skipped = [];

    dates.forEach(function (d) {
      if (base && d === data.date) return;            // pierwszy termin = edytowana lekcja
      if (opts.skipConflicts !== false) {
        const clash = ops.findConflicts({ date: d, start: tpl.start, duration: tpl.duration }, base ? base.id : null);
        if (clash.length) { skipped.push({ date: d, conflictWith: clash[0] }); return; }
      }
      const l = lessonFromTemplate(tpl, d, rid);
      if (!base && d === data.date && data.paymentStatus) l.paymentStatus = data.paymentStatus;
      created.push(l);
    });
    if (!base && !created.length) return { created: [], skipped: skipped, recurrenceId: null, series: null };

    if (base) L.update(base.id, Object.assign({}, opts.basePatch || {}, { recurrenceId: rid }), true);
    created.forEach(function (l) { L.add(l, true); });
    const rec = M.Series(Object.assign({
      id: rid, studentId: data.studentId, anchor: data.date, template: tpl,
      generatedUntil: limit || (dates.length ? dates[dates.length - 1] : data.date)
    }, r));
    Store.repo('series').add(rec, true);
    Store.commit('lessons', 'add-series', { recurrenceId: rid, count: created.length });
    return { created: created, skipped: skipped, recurrenceId: rid, series: rec };
  };

  /* ---- zgodność ze starszym API: rule { type:'weekly'|'biweekly'|'custom', count, days } ---- */
  function legacyRule(rule) {
    if (!rule || rule.freq) return rule;
    if (rule.type === 'custom') return { freq: 'week', interval: 1, days: rule.days, end: 'count', count: rule.count };
    return { freq: 'week', interval: rule.type === 'biweekly' ? 2 : 1, end: 'count', count: rule.count };
  }
  /** Daty serii BEZ tworzenia czegokolwiek (podgląd terminów i kolizji) */
  ops.projectRecurring = function (data, rule) { return ops.ruleProjection(data.date, legacyRule(rule)); };
  /** Które terminy serii kolidują z już istniejącymi zajęciami */
  ops.recurringConflicts = function (data, rule) {
    return ops.projectRecurring(data, rule).map(function (d) {
      const clash = ops.findConflicts({ date: d, start: data.start, duration: data.duration });
      return { date: d, conflicts: clash, blocked: clash.length > 0 };
    });
  };
  ops.addRecurring = function (data, rule) { return ops.createSeries(data, legacyRule(rule)); };

  /**
   * „Bez końca” i odległa data końca: dokłada lekcje tak, by zawsze były
   * zaplanowane na ~12 miesięcy do przodu. Wołane przy starcie aplikacji;
   * zapisuje tylko wtedy, gdy coś się zmieniło (zwykle raz w miesiącu).
   * Usunięte pojedyncze terminy nie wracają (dokładamy tylko po generatedUntil).
   */
  ops.extendSeries = function () {
    const t = U.today();
    const target = U.addMonths(t, HORIZON_MONTHS);
    const refill = U.addMonths(t, REFILL_MONTHS);
    let added = 0, touched = 0;
    Store.repo('series').all().forEach(function (rec) {
      if (rec.end === 'count') return;
      const stu = Store.student(rec.studentId);
      if (!stu || stu.status === 'ended') return;
      const gu = rec.generatedUntil || rec.anchor;
      if (gu >= refill) return;
      let lim = target;
      if (rec.end === 'until' && rec.until && rec.until < lim) lim = rec.until;
      if (lim <= gu) return;
      const tpl = Object.assign({ studentId: rec.studentId }, rec.template || {});
      if (!tpl.start) return;
      const have = {};
      ops.seriesOf(rec.id).forEach(function (l) { have[l.date] = true; });
      ruleDates(rec.anchor, normRule(rec, rec.anchor), lim).forEach(function (d) {
        if (d <= gu || have[d]) return;
        if (ops.findConflicts({ date: d, start: tpl.start, duration: tpl.duration || 60 }).length) return;
        Store.repo('lessons').add(lessonFromTemplate(tpl, d, rec.id), true);
        added++;
      });
      Store.repo('series').update(rec.id, { generatedUntil: lim }, true);
      touched++;
    });
    if (touched) Store.commit('lessons', 'extend-series', { added: added });
    return added;
  };

  /** Kończy regułę serii na ostatniej pozostałej lekcji (nic już nie zostanie dołożone) */
  function closeSeries(rid) {
    const rec = ops.seriesRecord(rid);
    if (!rec) return;
    const left = ops.seriesOf(rid);
    if (left.length < 2) { Store.repo('series').remove(rid, true); return; }
    const last = left[left.length - 1].date;
    Store.repo('series').update(rid, {
      end: 'until', until: last, count: null, generatedUntil: last, updatedAt: nowIso()
    }, true);
  }

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
    const ro = ops.ruleOf(lessonId);
    if (all.length < 2 && !(ro && ro.record)) return null;
    const key = l.date + l.start;
    const future = all.filter(function (x) { return (x.date + x.start) >= key; });
    const label = ro ? ops.ruleLabel(ro.rule, ro.anchor) : 'powtarzalna';
    return {
      recurrenceId: l.recurrenceId,
      all: all, future: future,
      total: all.length,
      futureCount: future.length,
      pastCount: all.length - future.length,
      lockedCount: all.filter(ops.isLocked).length,
      rule: ro ? ro.rule : null,
      anchor: ro ? ro.anchor : (all[0] ? all[0].date : l.date),
      record: ro ? ro.record : null,
      inferred: ro ? ro.inferred : true,
      rhythm: label,
      rhythmLabel: label,
      endLabel: ro ? ops.ruleEndLabel(ro.rule, ro.anchor) : '',
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
   * dzięki czemu rytm serii zostaje zachowany. Lekcje zamknięte
   * (odbyte, opłacone, odwołane, przeszłe) zostają bez zmian — poza
   * samą edytowaną lekcją.
   */
  ops.previewSeriesChanges = function (lessonId, changes, scope) {
    const base = Store.repo('lessons').byId(lessonId);
    if (!base) return { proposals: [], ok: [], blocked: [], locked: [] };

    const inRange = ops.seriesScope(lessonId, scope);
    const locked = inRange.filter(function (t) { return t.id !== lessonId && ops.isLocked(t); });
    const targets = inRange.filter(function (t) { return t.id === lessonId || !ops.isLocked(t); });
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
      blocked: proposals.filter(function (p) { return p.conflicts.length; }),
      locked: locked
    };
  };

  /** Po zmianach „ta i następne” / „wszystkie” — nowe terminy (dokładane później) też je dostaną */
  function syncRecordAfterEdit(rid, changes, shift) {
    const rec = ops.seriesRecord(rid);
    if (!rec) return;
    const tpl = Object.assign({}, rec.template || {});
    TEMPLATE_FIELDS.forEach(function (k) { if (changes[k] !== undefined) tpl[k] = changes[k]; });
    const patch = { template: tpl, updatedAt: nowIso() };
    if (changes.studentId) patch.studentId = changes.studentId;
    if (shift) {
      patch.anchor = U.addDays(rec.anchor, shift);
      if (rec.generatedUntil) patch.generatedUntil = U.addDays(rec.generatedUntil, shift);
      if (rec.end === 'until' && rec.until) patch.until = U.addDays(rec.until, shift);
      if (rec.days && shift % 7) {
        patch.days = rec.days.map(function (d) { return ((d + shift) % 7 + 7) % 7; }).sort(function (a, b) { return a - b; });
      }
    }
    Store.repo('series').update(rid, patch, true);
  }

  /** Zapisuje zmiany w zakresie; kolidujące i zamknięte terminy zostają nietknięte */
  ops.applySeriesChanges = function (lessonId, changes, scope) {
    const base = Store.repo('lessons').byId(lessonId);
    const rid = base && base.recurrenceId;
    const shift = base && changes.date !== undefined ? U.diffDays(base.date, changes.date) : 0;
    const pre = ops.previewSeriesChanges(lessonId, changes, scope);
    pre.ok.forEach(function (p) { Store.repo('lessons').update(p.lesson.id, p.patch, true); });
    if (rid && scope && scope !== 'one' && pre.ok.length) syncRecordAfterEdit(rid, changes, shift);
    Store.commit('lessons', 'update-series', { count: pre.ok.length });
    return { updated: pre.ok.length, skipped: pre.blocked, locked: pre.locked, preview: pre };
  };

  /**
   * Zmiana REGUŁY powtarzania (częstotliwość, dni, koniec) albo „Nie powtarzaj”
   * dla zakresu 'future' (ta i następne) lub 'all' (wszystkie w serii).
   *  • lekcje zamknięte (odbyte, opłacone, odwołane, przeszłe) zostają bez zmian,
   *  • wolne lekcje serii w dniach zgodnych z nową regułą — zachowane i zaktualizowane,
   *  • pozostałe wolne lekcje — usunięte; brakujące terminy — utworzone (bez kolizji),
   *  • przy „ta i następne” wcześniejsza część serii kończy się przed tą lekcją.
   * Nic nie zapisuje — zwraca plan (podgląd w oknie wyboru zakresu) dla applyReschedule.
   * data = wszystkie pola z formularza, changes = tylko zmienione pola, rule = nowa reguła | null.
   */
  ops.planReschedule = function (lessonId, data, changes, rule, scope) {
    const base = Store.repo('lessons').byId(lessonId);
    if (!base) return null;
    const rid = base.recurrenceId;
    const all = rid ? ops.seriesOf(rid) : [base];
    const key = base.date + base.start;
    const inRange = scope === 'all' ? all : all.filter(function (x) { return (x.date + x.start) >= key; });
    const rangeIds = {};
    inRange.forEach(function (x) { rangeIds[x.id] = true; });
    const before = all.filter(function (x) { return !rangeIds[x.id]; });
    const others = inRange.filter(function (x) { return x.id !== base.id; });
    const open = others.filter(function (x) { return !ops.isLocked(x); });
    const locked = others.filter(function (x) { return ops.isLocked(x); });
    const rec = ops.seriesRecord(rid);
    const plan = {
      lessonId: lessonId, rid: rid, scope: scope, data: data, changes: changes || {},
      rule: null, anchor: null, limit: null, tail: null,
      before: before, locked: locked, open: open,
      update: [], create: [], remove: [], skipped: [], blocked: [],
      reuseRid: scope === 'all' || !before.length
    };
    if (!rule) { plan.remove = open.slice(); return plan; }

    const shift = U.diffDays(base.date, data.date);
    const anchor = scope === 'all'
      ? U.addDays((rec && rec.anchor) || (all[0] ? all[0].date : base.date), shift)
      : data.date;
    const r = normRule(rule, anchor);
    // „po N lekcjach” w formularzu oznacza całą serię — przy „ta i następne”
    // odejmujemy lekcje sprzed tej lekcji, które zostają w dotychczasowej serii
    if (scope !== 'all' && r.end === 'count' && before.length) r.count = Math.max(1, r.count - before.length);
    const limit = limitFor(anchor, r);
    const dates = ruleDates(anchor, r, limit);
    plan.rule = r; plan.anchor = anchor; plan.limit = limit;
    plan.tail = dates.length ? dates[dates.length - 1] : anchor;

    const minDate = scope === 'all' ? U.today() : anchor;   // nie tworzymy lekcji wstecz
    const openIds = {};
    open.forEach(function (o) { openIds[o.id] = true; });
    const byDate = {};
    open.forEach(function (o) { (byDate[o.date] = byDate[o.date] || []).push(o); });
    const lockedDates = {};
    locked.forEach(function (o) { lockedDates[o.date] = true; });
    const fieldPatch = {};
    Object.keys(plan.changes).forEach(function (k) {
      if (k !== 'date' && PER_LESSON_FIELDS.indexOf(k) === -1) fieldPatch[k] = plan.changes[k];
    });
    const timeChanges = fieldPatch.start !== undefined || fieldPatch.duration !== undefined;
    const used = {};

    dates.forEach(function (d) {
      if (d === data.date || d < minDate || lockedDates[d]) return;
      const clash = ops.findConflicts({ date: d, start: data.start, duration: data.duration })
        .filter(function (c) { return !openIds[c.id] && c.id !== base.id; });
      const cand = (byDate[d] || []).filter(function (o) { return !used[o.id]; })[0];
      if (cand) {
        used[cand.id] = true;
        if (clash.length && timeChanges) { plan.blocked.push({ lesson: cand, date: d, conflictWith: clash[0] }); return; }
        plan.update.push({ id: cand.id, date: d, patch: fieldPatch });
        return;
      }
      if (clash.length) { plan.skipped.push({ date: d, conflictWith: clash[0] }); return; }
      plan.create.push(d);
    });
    plan.remove = open.filter(function (o) { return !used[o.id]; });
    return plan;
  };

  ops.applyReschedule = function (plan) {
    const L = Store.repo('lessons');
    const base = plan && L.byId(plan.lessonId);
    if (!base) return null;
    const rid = plan.rid;
    plan.remove.forEach(function (o) { L.remove(o.id, true); });

    if (!plan.rule) {
      // „Nie powtarzaj” — ta lekcja staje się pojedyncza, reszta serii kończy się na zamkniętych lekcjach
      L.update(base.id, Object.assign({}, plan.changes, { recurrenceId: null }), true);
      if (rid) closeSeries(rid);
      Store.commit('lessons', 'stop-series', { removed: plan.remove.length });
      return { created: 0, updated: 1, removed: plan.remove.length, kept: plan.locked.length, skipped: 0, recurrenceId: null };
    }

    const newRid = plan.reuseRid && rid ? rid : U.uid('rec');
    const tpl = templateFrom(plan.data);
    L.update(base.id, Object.assign({}, plan.changes, { recurrenceId: newRid }), true);
    plan.update.forEach(function (u) { L.update(u.id, Object.assign({}, u.patch, { recurrenceId: newRid }), true); });
    plan.blocked.concat(plan.locked).forEach(function (x) {
      const l = L.byId(x.lesson ? x.lesson.id : x.id);
      if (l && l.recurrenceId !== newRid) L.update(l.id, { recurrenceId: newRid }, true);
    });
    plan.create.forEach(function (d) { L.add(lessonFromTemplate(tpl, d, newRid), true); });
    if (rid && newRid !== rid) closeSeries(rid);    // wcześniejsza część serii kończy się przed tą lekcją

    const fields = Object.assign({
      studentId: plan.data.studentId, anchor: plan.anchor, template: tpl,
      generatedUntil: plan.limit || plan.tail, updatedAt: nowIso()
    }, plan.rule);
    if (Store.repo('series').byId(newRid)) Store.repo('series').update(newRid, fields, true);
    else Store.repo('series').add(M.Series(Object.assign({ id: newRid }, fields)), true);
    Store.commit('lessons', 'reschedule-series', { recurrenceId: newRid });
    return {
      created: plan.create.length, updated: plan.update.length + 1, removed: plan.remove.length,
      kept: plan.locked.length, skipped: plan.skipped.length + plan.blocked.length, recurrenceId: newRid
    };
  };

  /** Co usunie dany zakres: zamknięte lekcje (odbyte, opłacone, odwołane, przeszłe) zostają */
  ops.previewDelete = function (lessonId, scope) {
    const base = Store.repo('lessons').byId(lessonId);
    if (!base) return { remove: [], keep: [] };
    if (!base.recurrenceId || !scope || scope === 'one') return { remove: [base], keep: [] };
    const targets = ops.seriesScope(lessonId, scope);
    return {
      remove: targets.filter(function (t) { return !ops.isLocked(t); }),
      keep: targets.filter(function (t) { return ops.isLocked(t); })
    };
  };

  /** Usuwa lekcje objęte zakresem (patrz previewDelete) i kończy regułę serii */
  ops.deleteSeries = function (lessonId, scope) {
    const base = Store.repo('lessons').byId(lessonId);
    if (!base) return { removed: 0, kept: 0 };
    const rid = base.recurrenceId;
    const pre = ops.previewDelete(lessonId, scope);
    pre.remove.forEach(function (t) { Store.repo('lessons').remove(t.id, true); });
    // „ta i następne” / „wszystkie” — reguła nie dołoży już nowych terminów
    if (rid && scope && scope !== 'one') closeSeries(rid);
    else if (rid && ops.seriesRecord(rid) && !ops.seriesOf(rid).length) Store.repo('series').remove(rid, true);
    Store.commit('lessons', 'remove-series', pre.remove);
    return { removed: pre.remove.length, kept: pre.keep.length };
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

  /** Kopia ucznia (np. rodzeństwo): dane kontaktowe, cennik i ustawienia —
   *  bez historii lekcji, płatności, notatek i pakietów. Nazwisko z dopiskiem „(kopia)”. */
  ops.COPY_SUFFIX = ' (kopia)';
  ops.copyStudent = function (id) {
    const s = Store.student(id);
    if (!s) return null;
    const c = U.clone(s);
    delete c.id; delete c.createdAt;
    if (c.lastName) c.lastName = c.lastName + ops.COPY_SUFFIX;
    else c.lastName = ops.COPY_SUFFIX.trim();
    c.startDate = U.today();
    c.endDate = null;
    if (c.status === 'ended') c.status = 'active';
    c.color = null;
    return ops.addStudent(c);
  };

  /** Usuwa ucznia wraz z powiązanymi encjami */
  ops.deleteStudent = function (id) {
    const s = Store.student(id);
    if (!s) return false;
    ['lessons', 'payments', 'packages', 'notes', 'materials', 'goals', 'homework', 'series']
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
