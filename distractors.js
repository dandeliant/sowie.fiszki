// ═══════════════════════════════════════════════════════════════
//  SOWIE FISZKI — DISTRACTORS (system zblizonych zlych odpowiedzi)
// ═══════════════════════════════════════════════════════════════
// Dziala dla wszystkich gier z wyborem 1 z N (Word Rocket, Bee Hive,
// Balloon Pop, Fishing, Dino Dig, Skoczek, Most, Quiz w app.html).
//
// Strategia: zamiast losowych slow z pula, generujemy 3 zlych odpowiedzi
// ktore sa MAKSYMALNIE PODOBNE do prawidlowej:
//   1. Najpierw szukamy w pula slow z najmniejszym dystansem Levenshtein
//      (odlegloscia edycyjna) - rzeczywiste slowa, podobne pisownia.
//   2. Jesli pula nie ma dosc podobnych — generujemy "literowki":
//      - zamiana sasiednich liter ("apple" -> "appel")
//      - usuniecie litery ("apple" -> "aple")
//      - zamiana litery na sasiada na klawiaturze QWERTY ("cat" -> "vat")
//   3. Jesli nadal brakuje — uzupelniamy losowymi z pula.
//
// Dla wyrazen wieloczlonowych (>14 znakow lub ze spacjami) generowanie
// literowek jest pomijane — bralibyśmy ryzyko bezsensownych zniekształcen.
//
// API:
//   generateDistractors(correctAnswer, pool, count = 3, field = 1)
//     - correctAnswer: string — prawidlowa odpowiedz
//     - pool: tablica [pl, en] LUB tablica stringow
//     - count: ile dystraktorow zwrocic (domyslnie 3)
//     - field: 0 dla pl, 1 dla en (gdy pool to tablica [pl,en])
//   Zwraca tablice stringow (zawsze count elementow lub mniej, jesli
//   pula i typo generation nie wystarcza).

(function(global){
  'use strict';

  // Levenshtein edit distance — ile pojedynczych edycji potrzeba zeby
  // zamienic a w b (insert/delete/substitute).
  function editDistance(a, b){
    a = String(a || '').toLowerCase();
    b = String(b || '').toLowerCase();
    if (!a) return b.length;
    if (!b) return a.length;
    const m = a.length, n = b.length;
    // Pojedynczy wiersz tabeli DP — oszczedza pamiec
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const curr = new Array(n + 1);
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1,        // insert
          prev[j] + 1,            // delete
          prev[j - 1] + cost      // substitute
        );
      }
      prev = curr;
    }
    return prev[n];
  }

  // Sasiedzi na klawiaturze QWERTY (do generowania literowek)
  const KEYBOARD_NEIGHBORS = {
    'a':'sqzw','b':'vghn','c':'xdfv','d':'serfcx','e':'wrsdf','f':'drtgvcb',
    'g':'ftyhbvn','h':'gyujnbm','i':'ujkol','j':'huikmn','k':'jiolm','l':'kop',
    'm':'njk','n':'bhjm','o':'iklp','p':'ol','q':'asw','r':'edftg','s':'awedxzc',
    't':'rfgyh','u':'yhjik','v':'cfgb','w':'qaes','x':'zsdc','y':'tghu','z':'asx'
  };

  // Wygeneruj liste prawdopodobnych literowek dla danego slowa
  function generateTypos(word, maxCount, exclude){
    if (!word) return [];
    if (maxCount <= 0) return [];
    const exc = exclude || new Set();
    exc.add(word.toLowerCase());
    const result = [];
    const seen = new Set([word.toLowerCase()]);

    function add(t){
      if (!t || t === word) return;
      const lower = t.toLowerCase();
      if (seen.has(lower) || exc.has(lower)) return;
      seen.add(lower);
      result.push(t);
    }

    const w = word;

    // 1) Zamiana sasiednich liter
    for (let i = 0; i < w.length - 1 && result.length < maxCount * 2; i++) {
      // Pomin spacje przy zamianie
      if (w[i] === ' ' || w[i+1] === ' ') continue;
      add(w.slice(0, i) + w[i+1] + w[i] + w.slice(i+2));
    }

    // 2) Usuniecie litery (tylko dla dluzszych slow)
    if (w.length >= 5) {
      for (let i = 0; i < w.length && result.length < maxCount * 2; i++) {
        if (w[i] === ' ') continue;
        add(w.slice(0, i) + w.slice(i + 1));
      }
    }

    // 3) Zamiana litery na sasiada QWERTY
    for (let i = 0; i < w.length && result.length < maxCount * 3; i++) {
      const ch = w[i];
      const lower = ch.toLowerCase();
      const ngh = KEYBOARD_NEIGHBORS[lower];
      if (!ngh) continue;
      const isUpper = ch !== lower;
      for (let k = 0; k < ngh.length; k++) {
        const repl = isUpper ? ngh[k].toUpperCase() : ngh[k];
        add(w.slice(0, i) + repl + w.slice(i + 1));
        if (result.length >= maxCount * 3) break;
      }
    }

    // 4) Dodanie podwojnej litery (trochę miekkie literowki)
    for (let i = 0; i < w.length && result.length < maxCount * 4; i++) {
      const ch = w[i];
      if (ch === ' ') continue;
      add(w.slice(0, i + 1) + ch + w.slice(i + 1));
    }

    // Wymieszaj i zwroc maxCount
    shuffleInPlace(result);
    return result.slice(0, maxCount);
  }

  function shuffleInPlace(arr){
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /**
   * Glowna funkcja — zwraca count dystraktorow zblizonych do correctAnswer.
   *
   * @param {string} correctAnswer  Prawidlowa odpowiedz
   * @param {Array}  pool           Tablica par [pl, en] lub stringow
   * @param {number} count          Ile dystraktorow zwrocic (domyslnie 3)
   * @param {number} field          0 = pl, 1 = en (gdy pool to pary)
   * @returns {Array<string>}
   */
  function generateDistractors(correctAnswer, pool, count, field){
    if (count == null) count = 3;
    if (field == null) field = 1;
    if (!correctAnswer || count <= 0) return [];

    const correctLower = String(correctAnswer).toLowerCase();
    const isPhrase = correctAnswer.length > 14 || /\s/.test(correctAnswer);

    // Step 1: wyciagnij wszystkie kandydatow z poola
    const candidates = [];
    const seenLower = new Set([correctLower]);
    for (const item of (pool || [])) {
      let w;
      if (Array.isArray(item)) w = item[field];
      else w = item;
      if (!w) continue;
      const lw = w.toLowerCase();
      if (seenLower.has(lw)) continue;
      seenLower.add(lw);
      candidates.push(w);
    }

    if (candidates.length === 0) {
      // Brak puli — generuj sama literowki
      if (isPhrase) return [];
      return generateTypos(correctAnswer, count, new Set([correctLower]));
    }

    // Step 2: oblicz dystans Levenshteina dla wszystkich kandydatow
    const scored = candidates.map(c => {
      const d = editDistance(correctAnswer, c);
      const lenDiff = Math.abs(correctAnswer.length - c.length);
      // Score: nizszy = bardziej podobny
      // Nieco kara za duzy lenDiff (zeby nie wybrac calkiem innej dlugosci)
      return { word: c, score: d + lenDiff * 0.5 };
    });

    // Step 3: posortuj rosnaco wedlug score
    scored.sort((a, b) => a.score - b.score);

    // Step 4: wybierz najpodobniejsze, ale unikaj zbyt podobnych do siebie
    const usedLower = new Set([correctLower]);
    const similar = [];
    // Dla phrase'ow bierzemy 100% z poola (typo by byly dziwne)
    // Dla pojedynczych slow — 60-70% z poola, reszte z literowek
    const targetPoolCount = isPhrase ? count : Math.ceil(count * 0.65);

    for (const s of scored) {
      if (similar.length >= targetPoolCount) break;
      const lw = s.word.toLowerCase();
      if (usedLower.has(lw)) continue;
      // Nie wybieraj jesli IDENTYCZNE (po lowercase) — to ta sama odpowiedz
      if (lw === correctLower) continue;
      similar.push(s.word);
      usedLower.add(lw);
    }

    const result = similar.slice();

    // Step 5: dla pojedynczych slow — uzupelnij wygenerowanymi literowkami
    if (!isPhrase && result.length < count) {
      const need = count - result.length;
      const typos = generateTypos(correctAnswer, need, usedLower);
      for (const t of typos) {
        if (result.length >= count) break;
        result.push(t);
        usedLower.add(t.toLowerCase());
      }
    }

    // Step 6: jesli nadal brakuje (np. mala pula) — losowe z pula
    if (result.length < count) {
      const remaining = candidates.filter(c => !usedLower.has(c.toLowerCase()));
      shuffleInPlace(remaining);
      for (const r of remaining) {
        if (result.length >= count) break;
        result.push(r);
        usedLower.add(r.toLowerCase());
      }
    }

    // Wymieszaj rezultat (zeby najpodobniejsze nie byly zawsze pierwsze)
    shuffleInPlace(result);
    return result.slice(0, count);
  }

  // Eksportuj jako globalne i ewentualnie ES module
  global.generateDistractors = generateDistractors;
  global.editDistance = editDistance;
  global.generateTypos = generateTypos;
})(typeof window !== 'undefined' ? window : this);
