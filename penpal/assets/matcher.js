/*
 * PenPal – algorytm dopasowywania korespondentów.
 *
 * Każda osoba ma "poziom" (level) = numer klasy przeliczony na wspólną skalę wieku:
 *   SP 1–8  -> 1–8,   LO/Technikum/Branżowa 1–5 -> 9–13.
 * Dzięki temu uczeń 8 klasy SP (poziom 8) i 1 klasy LO (poziom 9) są "sąsiadami".
 *
 * Kolejność preferencji (od najlepszej):
 *   1. ten sam poziom, inna szkoła
 *   2. poziom ±1, inna szkoła  … (koszt = różnica poziomów)
 *   3. pary z tej samej szkoły – z karą `sameSchoolPenalty` (w "poziomach")
 *   4. osoba nieparzysta dołącza do najlepiej pasującej pary (trójka)
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PenpalMatcher = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SCHOOL_TYPES = {
    sp:   { label: 'Szkoła podstawowa',        short: 'SP',  offset: 0, grades: 8 },
    lo:   { label: 'Liceum ogólnokształcące',  short: 'LO',  offset: 8, grades: 4 },
    tech: { label: 'Technikum',                short: 'Tech', offset: 8, grades: 5 },
    bs:   { label: 'Szkoła branżowa',          short: 'BS',  offset: 8, grades: 3 },
  };

  const ROMAN = [['VIII', 8], ['VII', 7], ['VI', 6], ['IV', 4], ['V', 5], ['III', 3], ['II', 2], ['I', 1]];
  const SECTION_RE = /^[a-ząćęłńóśźż]{0,3}$/i;

  /** "5a", "5 b", "kl. 7c", "IIIa", "VI" -> { grade, section } lub null */
  function parseClass(raw) {
    const s = String(raw == null ? '' : raw).trim().replace(/^kl(asa)?\.?\s*/i, '');
    const m = s.match(/^(\d{1,2})\s*([^\s\d]*)$/);
    if (m && SECTION_RE.test(m[2])) return { grade: +m[1], section: m[2].toLowerCase() };
    // Rzymskie tylko wielkimi literami i z max. 1-literowym oddziałem – żeby imię "Iza" nie stało się klasą I.
    for (const [r, n] of ROMAN) {
      if (s.startsWith(r)) {
        const rest = s.slice(r.length).trim();
        if (/^[a-ząćęłńóśźż]?$/i.test(rest) && !/^[IVX]$/.test(rest)) return { grade: n, section: rest.toLowerCase() };
      }
    }
    return null;
  }

  function levelOf(schoolType, grade) {
    const t = SCHOOL_TYPES[schoolType] || SCHOOL_TYPES.sp;
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 1 || g > t.grades) return null;
    return t.offset + g;
  }

  function classLabel(grade, section) {
    return `${grade}${section || ''}`;
  }

  /** Przybliżony wiek ucznia na danym poziomie (1 klasa SP ≈ 7 lat). */
  function approxAge(level) {
    return level + 6;
  }

  function levelLabel(level) {
    if (level <= 8) return `${level} kl. SP`;
    return `${level - 8} kl. szk. ponadpodst.`;
  }

  // Deterministyczny generator losowy – to samo ziarno = to samo dopasowanie.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function bySchool(list) {
    const map = new Map();
    for (const p of list) {
      if (!map.has(p.school)) map.set(p.school, []);
      map.get(p.school).push(p);
    }
    return [...map.values()];
  }

  const desc = (a, b) => b.length - a.length;

  /**
   * @param {Array<{id:string, level:number, school:string}>} people
   * @param {object} opts
   *   sameSchoolPenalty – ile "poziomów różnicy" jest warta para z tej samej szkoły
   *                       (0 = bez znaczenia, Infinity = tylko w ostateczności)
   *   seed              – ziarno losowania
   *   existingGroups    – istniejące grupy (tablice id) – nieparzyste osoby mogą do nich
   *                       dołączyć jako trzecie (tablice są modyfikowane w miejscu!)
   *   lookup            – Map id -> osoba, potrzebne dla existingGroups
   * @returns {{groups:string[][], unmatched:string[], invalid:string[]}}
   */
  function match(people, opts) {
    const o = Object.assign({ sameSchoolPenalty: 2, seed: Date.now(), existingGroups: [], lookup: null }, opts);
    const rand = mulberry32(o.seed);
    const valid = shuffle(people.filter(p => Number.isFinite(p.level)), rand);
    const invalid = people.filter(p => !Number.isFinite(p.level)).map(p => p.id);
    const lookup = new Map(o.lookup || []);
    for (const p of people) lookup.set(p.id, p);

    const free = new Set(valid.map(p => p.id));
    const groups = [];
    const pair = (a, b) => {
      free.delete(a.id);
      free.delete(b.id);
      groups.push([a.id, b.id]);
    };
    const at = L => valid.filter(p => p.level === L && free.has(p.id));

    const levels = [...new Set(valid.map(p => p.level))].sort((a, b) => a - b);
    const span = levels.length ? levels[levels.length - 1] - levels[0] : 0;
    const penalty = Number.isFinite(o.sameSchoolPenalty) ? Math.max(0, o.sameSchoolPenalty) : Infinity;

    // Poziomy kosztu: {d – różnica poziomów, any – czy wolno łączyć w obrębie szkoły}
    const tiers = [];
    for (let d = 0; d <= span; d++) {
      tiers.push({ d, any: false, cost: d });
      if (Number.isFinite(penalty)) tiers.push({ d, any: true, cost: d + penalty + 0.01 });
    }
    tiers.sort((a, b) => a.cost - b.cost || a.d - b.d);

    // Ten sam poziom: zawsze łączymy dwie najliczniejsze szkoły – maksymalizuje liczbę par międzyszkolnych.
    function pairWithin(list, any) {
      if (list.length < 2) return;
      if (any) {
        for (let i = 0; i + 1 < list.length; i += 2) pair(list[i], list[i + 1]);
        return;
      }
      const buckets = bySchool(list);
      for (;;) {
        buckets.sort(desc);
        if (buckets.length < 2 || !buckets[1].length) break;
        pair(buckets[0].pop(), buckets[1].pop());
      }
    }

    function pairBetween(A, B, any) {
      if (!A.length || !B.length) return;
      if (any) {
        const n = Math.min(A.length, B.length);
        for (let i = 0; i < n; i++) pair(A[i], B[i]);
        return;
      }
      const ga = bySchool(A), gb = bySchool(B);
      for (;;) {
        ga.sort(desc);
        gb.sort(desc);
        let paired = false;
        outer: for (const a of ga) {
          if (!a.length) break;
          for (const b of gb) {
            if (!b.length) break;
            if (a[0].school !== b[0].school) {
              pair(a.pop(), b.pop());
              paired = true;
              break outer;
            }
          }
        }
        if (!paired) break;
      }
    }

    for (const t of tiers) {
      if (t.d === 0) {
        for (const L of levels) pairWithin(at(L), t.any);
      } else {
        for (const L of levels) {
          const B = at(L + t.d);
          if (B.length) pairBetween(at(L), B, t.any);
        }
      }
    }

    // Nieparzyści – dołączają do najlepiej pasującej pary jako trzecia osoba.
    const trioPenalty = Number.isFinite(penalty) ? penalty + 0.01 : 1000;
    const unmatched = [];
    for (const p of valid.filter(v => free.has(v.id))) {
      let best = null, bestCost = Infinity;
      for (const g of groups.concat(o.existingGroups)) {
        if (g.length !== 2) continue;
        const ms = g.map(id => lookup.get(id)).filter(m => m && Number.isFinite(m.level));
        if (!ms.length) continue;
        const d = Math.max(...ms.map(m => Math.abs(m.level - p.level)));
        const cost = d + (ms.some(m => m.school === p.school) ? trioPenalty : 0);
        if (cost < bestCost) { bestCost = cost; best = g; }
      }
      if (best) best.push(p.id);
      else unmatched.push(p.id);
      free.delete(p.id);
    }

    return { groups, unmatched, invalid };
  }

  /** Jak dana osoba pasuje do reszty swojej grupy. */
  function describe(member, others) {
    const older = others.filter(o => o.level > member.level);
    const younger = others.filter(o => o.level < member.level);
    return {
      ageOk: !older.length && !younger.length,
      withOlder: older.length > 0,
      withYounger: younger.length > 0,
      maxDiff: others.reduce((m, o) => Math.max(m, Math.abs(o.level - member.level)), 0),
      sameSchool: others.some(o => o.school === member.school),
    };
  }

  return { SCHOOL_TYPES, parseClass, levelOf, classLabel, approxAge, levelLabel, match, describe, mulberry32 };
});
