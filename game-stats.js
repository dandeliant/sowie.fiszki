// ═══════════════════════════════════════════════════════════════
//  SOWIE FISZKI — statystyki gier (wspólny moduł, migracja #66)
//
//  Liczy w każdej grze z rzędu „🎮 Gry":
//   • czas AKTYWNEJ gry — karta widoczna i ruch myszą/klawiaturą/dotyk
//     w ostatnich 60 s (jak DB.startActivity w app.html),
//   • punkty zdobyte w grze — suma przyrostów licznika punktów gry
//     (nowa runda zeruje licznik, ale zdobyte punkty zostają),
//   • poprawne odpowiedzi — gdy gra je liczy.
//  Sesja trafia do localStorage['fiszki_game_sessions'] (co 5 s i przy
//  wyjściu), a app.html wysyła ją do tabeli game_sessions
//  (DB.flushGameSessions) — gry nie muszą mieć własnego połączenia z bazą.
//
//  Samodzielne pliki gier: wystarczy <script src="game-stats.js"></script>
//  — moduł rozpoznaje stronę po nazwie pliku i sam czyta jej licznik
//  punktów (zmienne globalne gry, np. score / jpScore).
//  app.html (Memory, Wisielec, Rywalizacja): SF_STATS.start(...) / stop().
//  Gość (tryb gościa) — nic nie jest zapisywane.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const QKEY = 'fiszki_game_sessions';
  const MIN_SEC = 5;          // krótsze wejścia bez punktów pomijamy
  const IDLE_MS = 60000;      // bezczynność > 60 s nie liczy się do czasu gry

  const GAMES = {
    jump:        { n: 'Skoczek',            i: '🏝️' },
    bridge:      { n: 'Przejdź przez most', i: '🌉' },
    butterfly:   { n: 'Motyle',             i: '🦋' },
    carracer:    { n: 'Wyścig słówek',      i: '🏎️' },
    rocket:      { n: 'Rakieta',            i: '🚀' },
    wheel:       { n: 'Słówkoło',           i: '🎰' },
    duel:        { n: 'Rywalizacja',        i: '⚔️' },
    memory:      { n: 'Memory',             i: '🎴' },
    hangman:     { n: 'Wisielec',           i: '🔤' },
    balloons:    { n: 'Balony',             i: '🎈' },
    beehive:     { n: 'Miodzio',            i: '🐝' },
    dinodig:     { n: 'Wykopaliska',        i: '🦕' },
    crossing:    { n: 'Przejście',          i: '🚦' },
    alien:       { n: 'Inwazja obcych',     i: '🛸' },
    grammarcity: { n: 'Grammar City',       i: '🏙️' },
    pizza:       { n: 'Pizza Chef',         i: '🍕' },
    superguy:    { n: 'Labirynt',           i: '👾' },
    whackamole:  { n: 'Grzmotek',           i: '🔨' },
    feed:        { n: 'Głodomorek',         i: '🍽️' },
    fishing:     { n: 'Łowienie',           i: '🎣' }
  };

  // Strona → [klucz gry, licznik punktów, licznik poprawnych]. Gettery czytają
  // globalne zmienne gry w chwili wywołania (let/var z <script> strony).
  /* global jpScore, brScore, bfScore, score, correct, xp, correctCount, hits,
     helped, kills, tips, perfectCount, correctTotal */
  const PAGES = {
    'skoczek.html':        ['jump',        () => jpScore],
    'most.html':           ['bridge',      () => brScore],
    'motyle.html':         ['butterfly',   () => bfScore],
    'car-racer.html':      ['carracer',    () => score],
    'word_rocket.html':    ['rocket',      () => correct * 10, () => correct],
    'word_wheel.html':     ['wheel',       () => xp,           () => correctCount],
    'balony.html':         ['balloons',    () => score,        () => hits],
    'bee_hive.html':       ['beehive',     () => correct * 10, () => correct],
    'dino_dig.html':       ['dinodig',     () => score],
    'crossing.html':       ['crossing',    () => score,        () => helped],
    'alien_invasion.html': ['alien',       () => score,        () => kills],
    'pizza_chef.html':     ['pizza',       () => tips,         () => perfectCount],
    'super_guy.html':      ['superguy',    () => score,        () => correctCount],
    'whackamole.html':     ['whackamole',  () => score,        () => hits],
    'feed_monster.html':   ['feed',        () => score,        () => correctTotal],
    'fishing.html':        ['fishing',     () => score,        () => correct],
    'grammar-city':        ['grammarcity', () => window.GC_STATS_XP()]
  };

  const num = (fn) => {
    if (!fn) return null;
    try { const x = fn(); return (typeof x === 'number' && isFinite(x)) ? x : null; } catch (e) { return null; }
  };
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const localDay = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const uuid = () => {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  };
  function currentUserLogin() {
    try { return sessionStorage.getItem('fiszki_user') || localStorage.getItem('fiszki_user_persist') || ''; } catch (e) { return ''; }
  }
  function readQ() {
    try { const q = JSON.parse(localStorage.getItem(QKEY) || '[]'); return Array.isArray(q) ? q : []; } catch (e) { return []; }
  }
  function writeQ(q) {
    try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-300))); } catch (e) {}
  }

  let cur = null, timer = null, lastAct = Date.now();
  const bump = () => { lastAct = Date.now(); };
  ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach(ev =>
    window.addEventListener(ev, bump, { passive: true, capture: true }));

  function sample() {
    if (!cur) return;
    const s = num(cur.getScore);
    if (s !== null) {
      if (cur.lastScore === null || s < cur.lastScore) cur.lastScore = s;   // start / nowa runda
      else if (s > cur.lastScore) { cur.points += s - cur.lastScore; cur.lastScore = s; }
    }
    const c = num(cur.getCorrect);
    if (c !== null) {
      if (cur.lastCorrect === null || c < cur.lastCorrect) cur.lastCorrect = c;
      else if (c > cur.lastCorrect) { cur.correct += c - cur.lastCorrect; cur.lastCorrect = c; }
    }
  }

  function persist(final) {
    if (!cur) return;
    const q = readQ().filter(e => e.id !== cur.id);
    if (cur.sec >= MIN_SEC || cur.points > 0) {
      q.push({
        id: cur.id, user: cur.user, game: cur.game,
        book_id: cur.book || null, unit_key: cur.unit || null,
        score: Math.min(1000000, Math.round(cur.points)),
        correct: cur.getCorrect ? cur.correct : null,
        duration_sec: Math.min(43200, cur.sec),
        started_at: new Date(cur.startedAt).toISOString(),
        day: cur.day, done: !!final, ts: Date.now()
      });
    }
    writeQ(q);
  }

  function start(game, getScore, opts) {
    stop();
    const user = currentUserLogin();
    if (!game || !user || user === '__guest__') return false;
    opts = opts || {};
    cur = {
      id: uuid(), user, game,
      book: opts.book || null, unit: opts.unit || null,
      getScore: getScore || null, getCorrect: opts.getCorrect || null,
      lastScore: null, lastCorrect: null, points: 0, correct: 0,
      sec: 0, startedAt: Date.now(), day: localDay()
    };
    bump();
    sample();
    let n = 0;
    timer = setInterval(() => {
      if (!cur) return;
      if (document.visibilityState === 'visible' && Date.now() - lastAct <= IDLE_MS) cur.sec++;
      sample();
      if (++n % 5 === 0) persist(false);
    }, 1000);
    return true;
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (!cur) return null;
    sample();
    persist(true);
    const done = cur;
    cur = null;
    return done;
  }

  window.addEventListener('pagehide', () => { if (cur) { sample(); persist(false); } });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && cur) { sample(); persist(false); }
  });

  window.SF_STATS = {
    GAMES, QKEY, start, stop,
    current: () => (cur ? cur.game : null),
    readQueue: readQ, writeQueue: writeQ
  };

  // Samodzielne pliki gier — start automatycznie po załadowaniu strony.
  const path = location.pathname;
  const file = path.includes('/grammar-city/') ? 'grammar-city' : (path.split('/').pop() || '');
  const page = PAGES[file];
  if (page) {
    const run = () => {
      const p = new URLSearchParams(location.search);
      start(page[0], page[1], { book: p.get('book'), unit: p.get('unit'), getCorrect: page[2] });
    };
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run);
  }
})();
