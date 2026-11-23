/* ============================================================
   TutorFlow — utils.js
   Czyste funkcje pomocnicze: daty, liczby, formatowanie, DOM.
   Brak zależności od reszty aplikacji.
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';

  /* ---------------- Identyfikatory ---------------- */
  let _seq = 0;
  function uid(prefix) {
    _seq += 1;
    const rnd = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '_' + Date.now().toString(36) + rnd + _seq.toString(36);
  }

  /* ---------------- Liczby ---------------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round = (v, d) => { const m = Math.pow(10, d || 0); return Math.round((v + Number.EPSILON) * m) / m; };
  const sum = (arr, fn) => arr.reduce((a, x) => a + (fn ? (fn(x) || 0) : (x || 0)), 0);
  const avg = (arr, fn) => (arr.length ? sum(arr, fn) / arr.length : 0);
  const pct = (a, b) => (b ? (a / b) * 100 : 0);
  function change(cur, prev) {
    if (!prev) return cur > 0 ? 100 : 0;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }

  /* ---------------- Kolekcje ---------------- */
  function groupBy(arr, keyFn) {
    const out = {};
    arr.forEach((x) => { const k = keyFn(x); (out[k] = out[k] || []).push(x); });
    return out;
  }
  function sortBy(arr, fn, dir) {
    const d = dir === 'desc' ? -1 : 1;
    return arr.slice().sort((a, b) => {
      const va = fn(a), vb = fn(b);
      if (va === vb) return 0;
      return (va > vb ? 1 : -1) * d;
    });
  }
  const uniq = (arr) => Array.from(new Set(arr));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------- Daty ----------------
     Format kanoniczny w całej aplikacji: 'YYYY-MM-DD' (data lokalna).
     Godziny: 'HH:MM' (24h).                                        */

  const DOW_SHORT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
  const DOW_LONG = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
  const MONTHS = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

  const pad = (n) => String(n).padStart(2, '0');

  function iso(d) {
    if (typeof d === 'string') return d.slice(0, 10);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parse(s) {
    if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const p = String(s).slice(0, 10).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function today() { return iso(new Date()); }
  function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  function addDays(s, n) { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function addMonths(s, n) {
    const d = parse(s);
    const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, daysInMonth(iso(d))));
    return iso(d);
  }
  function diffDays(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }

  /** 0 = poniedziałek … 6 = niedziela */
  function dow(s) { return (parse(s).getDay() + 6) % 7; }
  function startOfWeek(s) { return addDays(s, -dow(s)); }
  function endOfWeek(s) { return addDays(startOfWeek(s), 6); }
  function startOfMonth(s) { return s.slice(0, 8) + '01'; }
  function endOfMonth(s) { const d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  function daysInMonth(s) { const d = parse(s); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
  function monthKey(s) { return String(s).slice(0, 7); }
  function yearKey(s) { return String(s).slice(0, 4); }
  function monthName(mk) { return MONTHS[+mk.slice(5, 7) - 1]; }
  function monthNameShort(mk) { return MONTHS_SHORT[+mk.slice(5, 7) - 1]; }
  function monthLabel(mk) { return cap(MONTHS[+mk.slice(5, 7) - 1]) + ' ' + mk.slice(0, 4); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /** Lista kluczy miesięcy od -n do 0 względem podanej daty */
  function lastMonths(fromIso, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(monthKey(addMonths(startOfMonth(fromIso), -i)));
    return out;
  }
  function rangeDays(a, b) {
    const out = []; let c = a;
    let guard = 0;
    while (c <= b && guard++ < 4000) { out.push(c); c = addDays(c, 1); }
    return out;
  }
  function isSameMonth(a, b) { return monthKey(a) === monthKey(b); }

  /* ---------------- Godziny ---------------- */
  function toMin(t) { const p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function toTime(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function addMin(t, n) { return toTime(toMin(t) + n); }
  function durLabel(min) {
    const h = Math.floor(min / 60), m = min % 60;
    if (h && m) return h + ' h ' + m + ' min';
    if (h) return h + ' h';
    return m + ' min';
  }
  function hoursLabel(min) {
    const h = min / 60;
    return (Math.round(h * 10) / 10).toLocaleString('pl-PL') + ' h';
  }

  /* ---------------- Formatowanie ---------------- */
  function settings() {
    return (window.TF.Store && window.TF.Store.state && window.TF.Store.state.settings) || {};
  }
  const CUR_SYMBOL = { PLN: 'zł', EUR: '€', USD: '$', GBP: '£' };

  function money(v, opts) {
    const st = settings();
    const cur = (st.currency || 'PLN');
    const loc = st.locale || 'pl-PL';
    const o = opts || {};
    const dec = o.decimals === undefined ? (Math.abs(v % 1) > 0.001 ? 2 : 0) : o.decimals;
    try {
      return new Intl.NumberFormat(loc, {
        style: 'currency', currency: cur,
        minimumFractionDigits: dec, maximumFractionDigits: dec
      }).format(v || 0);
    } catch (e) {
      return num(v, dec) + ' ' + (CUR_SYMBOL[cur] || cur);
    }
  }
  function moneyShort(v) {
    const st = settings();
    const symbol = CUR_SYMBOL[st.currency || 'PLN'] || '';
    const a = Math.abs(v || 0);
    if (a >= 1000000) return num(v / 1000000, 1) + ' mln ' + symbol;
    if (a >= 10000) return num(Math.round(v / 1000), 0) + ' tys. ' + symbol;
    return num(Math.round(v || 0), 0) + ' ' + symbol;
  }
  function curSymbol() { return CUR_SYMBOL[settings().currency || 'PLN'] || ''; }

  function num(v, d) {
    const loc = settings().locale || 'pl-PL';
    return new Intl.NumberFormat(loc, {
      minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 0 : d
    }).format(v || 0);
  }
  function pctLabel(v, d) { return num(v, d === undefined ? 1 : d) + '%'; }

  function fmtDate(s, style) {
    if (!s) return '—';
    const d = parse(s);
    const st = settings();
    const f = st.dateFormat || 'dd.mm.yyyy';
    switch (style) {
      case 'long':  return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()] + ' ' + d.getFullYear();
      case 'medium': return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear();
      case 'day':   return d.getDate() + ' ' + MONTHS_GEN[d.getMonth()];
      case 'dow':   return cap(DOW_LONG[dow(s)]) + ', ' + d.getDate() + ' ' + MONTHS_GEN[d.getMonth()];
      case 'short': return pad(d.getDate()) + '.' + pad(d.getMonth() + 1);
      default:
        if (f === 'yyyy-mm-dd') return iso(d);
        if (f === 'dd/mm/yyyy') return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
        return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
    }
  }
  function fmtTime(t) {
    if (!t) return '';
    if ((settings().timeFormat || '24') === '12') {
      const m = toMin(t), h = Math.floor(m / 60), mm = m % 60;
      const ap = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return h12 + ':' + pad(mm) + ' ' + ap;
    }
    return t;
  }
  /** „Dzisiaj”, „Jutro”, „Wczoraj” albo data */
  function dayLabel(s, style) {
    const d = diffDays(today(), s);
    if (d === 0) return 'Dzisiaj';
    if (d === 1) return 'Jutro';
    if (d === -1) return 'Wczoraj';
    if (d === 2) return 'Pojutrze';
    return fmtDate(s, style || 'dow');
  }
  function relTime(minutes) {
    const a = Math.abs(minutes);
    if (a < 60) return a + ' min';
    const h = Math.floor(a / 60), m = a % 60;
    if (h < 24) return m ? h + ' h ' + m + ' min' : h + ' h';
    return Math.round(h / 24) + ' dni';
  }
  function ago(dateIso) {
    const d = diffDays(dateIso, today());
    if (d === 0) return 'dzisiaj';
    if (d === 1) return 'wczoraj';
    if (d < 7) return d + ' dni temu';
    if (d < 31) return Math.floor(d / 7) + ' tyg. temu';
    if (d < 365) return Math.floor(d / 30) + ' mies. temu';
    return Math.floor(d / 365) + ' lat temu';
  }
  function plural(n, one, few, many) {
    const a = Math.abs(n);
    if (a === 1) return one;
    const l2 = a % 100;
    const l1 = a % 10;
    if (l1 >= 2 && l1 <= 4 && (l2 < 10 || l2 >= 20)) return few;
    return many;
  }
  function lessonsLabel(n) { return n + ' ' + plural(n, 'lekcja', 'lekcje', 'lekcji'); }
  /** Biernik: „ma 1 nieopłaconą lekcję” / „3 nieopłacone lekcje” / „5 nieopłaconych lekcji” */
  function lessonsAcc(n, adjOne, adjFew, adjMany) {
    const noun = plural(n, 'lekcję', 'lekcje', 'lekcji');
    const adj = plural(n, adjOne, adjFew, adjMany);
    return n + ' ' + adj + ' ' + noun;
  }
  function studentsLabel(n) { return n + ' ' + plural(n, 'uczeń', 'uczniów', 'uczniów'); }

  /* ---------------- Tekst ---------------- */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initials(first, last) {
    return ((first || '?').charAt(0) + (last || '').charAt(0)).toUpperCase();
  }
  function slug(s) {
    return String(s).toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l')
      .replace(/ń/g, 'n').replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ż|ź/g, 'z')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  /** Dopasowanie odporne na polskie znaki i wielkość liter */
  function norm(s) { return slug(s).replace(/-/g, ' ').trim(); }
  function matches(haystack, needle) {
    if (!needle) return true;
    return norm(haystack).indexOf(norm(needle)) !== -1;
  }

  /* ---------------- Kolory ---------------- */
  const AVATAR_GRADIENTS = [
    'linear-gradient(135deg,#6366f1,#8b5cf6)',
    'linear-gradient(135deg,#06b6d4,#3b82f6)',
    'linear-gradient(135deg,#10b981,#06b6d4)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#ec4899,#8b5cf6)',
    'linear-gradient(135deg,#14b8a6,#22c55e)',
    'linear-gradient(135deg,#f43f5e,#f59e0b)',
    'linear-gradient(135deg,#3b82f6,#6366f1)',
    'linear-gradient(135deg,#a855f7,#ec4899)',
    'linear-gradient(135deg,#0ea5e9,#14b8a6)'
  ];
  function gradientFor(seed) {
    let h = 0;
    const s = String(seed || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
  }

  /* ---------------- Różne ---------------- */
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms || 200);
    };
  }
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((res) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); res();
    });
  }
  /** Generator pseudolosowy z ziarnem — powtarzalne dane demo */
  function rng(seed) {
    let s = seed >>> 0 || 42;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  function pick(rand, arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }

  window.TF.U = {
    uid, clamp, round, sum, avg, pct, change,
    groupBy, sortBy, uniq, clone,
    iso, parse, today, nowMin, addDays, addMonths, diffDays, dow,
    startOfWeek, endOfWeek, startOfMonth, endOfMonth, daysInMonth,
    monthKey, yearKey, monthName, monthNameShort, monthLabel, lastMonths, rangeDays, isSameMonth,
    toMin, toTime, addMin, durLabel, hoursLabel,
    money, moneyShort, curSymbol, num, pctLabel, fmtDate, fmtTime, dayLabel, relTime, ago,
    plural, lessonsLabel, lessonsAcc, studentsLabel,
    esc, initials, slug, norm, matches, cap, pad,
    gradientFor, debounce, download, copy, rng, pick,
    DOW_SHORT, DOW_LONG, MONTHS, MONTHS_SHORT, MONTHS_GEN
  };
})();
