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
    'skoczek.html':        ['jump',        () => jpScore,      () => Math.floor(jpScore / 10)],   // +10 pkt = 1 poprawna
    'most.html':           ['bridge',      () => brScore,      () => Math.floor(brScore / 10)],
    'motyle.html':         ['butterfly',   () => bfScore,      () => Math.floor(bfScore / 10)],
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
      else if (c > cur.lastCorrect) {
        const d = c - cur.lastCorrect;
        cur.correct += d; cur.lastCorrect = c;
        if (XP_GAMES[cur.game]) awardXp(d * XP_PER_CORRECT);
      }
    }
  }

  // ── XP na konto za poprawne odpowiedzi w grach (od SW v1.219): +5, w weekend ×2 ──
  // Skoczek, Most, Motyle, Słówkoło, Przejście, Inwazja obcych, Głodomorek. Zła odpowiedź — 0.
  // XP trafia do kolejki localStorage['fiszki_xp_pending_<uid>'] (tej samej co w db.js)
  // i jest wysyłane RPC add_my_xp (#85). Gdy się nie uda — wyśle je app.html przy starcie.
  const XP_GAMES = { jump: 1, bridge: 1, butterfly: 1, wheel: 1, crossing: 1, alien: 1, feed: 1 };
  const XP_PER_CORRECT = 5;
  function sbCfg() {
    try { if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') return { u: SUPABASE_URL, k: SUPABASE_ANON_KEY }; } catch (e) {}
    try { const c = JSON.parse(localStorage.getItem('fiszki_sb_cfg') || 'null'); if (c && c.u && c.k) return c; } catch (e) {}
    return null;
  }
  function sbSession(c) {
    try {
      const ref = new URL(c.u).hostname.split('.')[0];
      let s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
      if (s && s.currentSession) s = s.currentSession;
      return s || null;
    } catch (e) { return null; }
  }
  const isWeekend = () => { const d = new Date().getDay(); return d === 0 || d === 6; };
  const pendKey = (uid) => 'fiszki_xp_pending_' + uid;
  const pendGet = (k) => { try { return Math.max(0, parseInt(localStorage.getItem(k) || '0', 10) || 0); } catch (e) { return 0; } };
  const pendSet = (k, n) => { try { if (n > 0) localStorage.setItem(k, String(n)); else localStorage.removeItem(k); } catch (e) {} };
  let xpTimer = null, xpBusy = false;
  function awardXp(n) {
    const c = sbCfg(), s = c && sbSession(c), uid = s && s.user && s.user.id;
    if (!(n > 0) || !uid || !cur || !cur.user) return;
    const k = pendKey(uid);
    pendSet(k, pendGet(k) + n * (isWeekend() ? 2 : 1));
    clearTimeout(xpTimer);
    xpTimer = setTimeout(flushXp, 3000);
  }
  async function flushXp() {
    if (xpBusy) return;
    const c = sbCfg(), s = c && sbSession(c), uid = s && s.user && s.user.id;
    if (!uid || !s.access_token || (s.expires_at && s.expires_at * 1000 < Date.now() + 20000)) return;   // wyśle app.html
    const k = pendKey(uid), d = Math.min(2000, pendGet(k));
    if (d <= 0) return;
    xpBusy = true;
    pendSet(k, pendGet(k) - d);   // najpierw zdejmij z kolejki — bez ryzyka podwójnego naliczenia
    let ok = false;
    try {
      const r = await fetch(c.u + '/rest/v1/rpc/add_my_xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c.k, Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify({ p_delta: d })
      });
      ok = r.ok;
    } catch (e) {}
    if (!ok) pendSet(k, pendGet(k) + d);   // nie wyszło — zostaje dla app.html
    xpBusy = false;
  }

  // 🙈 Słówka „znam to doskonale” (lista z app.html: localStorage['fiszki_ignored_<login>'])
  // nie pojawiają się w grach. Gdy w rozdziale ukryte są wszystkie — zostają (gra by nie ruszyła).
  function dropIgnored() {
    try {
      /* global BOOKS */
      if (typeof BOOKS === 'undefined') return false;
      const user = currentUserLogin();
      if (!user || user === '__guest__') return true;
      const map = JSON.parse(localStorage.getItem('fiszki_ignored_' + user) || '{}') || {};
      Object.keys(map).forEach(bId => {
        const b = BOOKS[bId], set = new Set(Array.isArray(map[bId]) ? map[bId] : []);
        if (!b || !b.units || !set.size) return;
        Object.keys(b.units).forEach(k => {
          const u = b.units[k], words = u.words || [];
          const left = words.filter(w => !(w && set.has(w[0])));
          if (left.length && left.length !== words.length) u.words = left;
        });
      });
    } catch (e) {}
    return true;
  }

  // Wirtualny pupil (app.html): sekundy aktywnej gry poprawiają mu humor.
  // Licznik per login; app.html zamienia go na punkty humoru i zeruje.
  function petPlay() {
    if (!cur || !cur.petSec) return;
    try {
      const k = 'fiszki_pet_play_' + cur.user;
      localStorage.setItem(k, String((+localStorage.getItem(k) || 0) + cur.petSec));
    } catch (e) {}
    cur.petSec = 0;
  }

  function persist(final) {
    if (!cur) return;
    petPlay();
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
      if (document.visibilityState === 'visible' && Date.now() - lastAct <= IDLE_MS) { cur.sec++; cur.petSec = (cur.petSec || 0) + 1; }
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

  // „🟢 Teraz online" (#83): opis gry z podręcznikiem i rozdziałem (gdy znane).
  const GC_MAPS = {
    grid: 'Grammar City', metro: 'Metropolia', warsaw: 'Warszawa', jeleniec: 'Jeleniec',
    london: 'Londyn', lukow: 'Łuków', wesolowka: 'Wesołówka', kierzkow: 'Kierzków',
    sarnow: 'Sarnów', rzymy: 'Rzymy-Rzymki', paris: 'Paryż'
  };
  function whereLabel(book, unit) {
    try {
      /* global BOOKS */
      if (!book || typeof BOOKS === 'undefined' || !BOOKS[book]) return '';
      const b = BOOKS[book];
      const all = !unit || unit === 'all' || unit === '__all__';
      const u = all ? null : (b.units && b.units[unit]);
      return (b.shortName || b.name || book) + (u ? ' · ' + u.name : (all ? ' · cały podręcznik' : ''));
    } catch (e) { return ''; }
  }
  function presenceInfo(gameKey, pageFile, book, unit) {
    const g = GAMES[gameKey] || { n: gameKey, i: '🎮' };
    let name = g.n;
    if (gameKey === 'grammarcity') {
      const m = new URLSearchParams(location.search).get('map');
      if (m && GC_MAPS[m] && m !== 'grid') name += ' (' + GC_MAPS[m] + ')';
    }
    const where = whereLabel(book, unit);
    const tail = where ? ' — ' + where : (gameKey === 'grammarcity' && !book ? ' — gramatyka' : '');
    return { page: pageFile, activity: 'game:' + gameKey, label: g.i + ' Gra: ' + name + tail, book: book || null, unit: unit || null };
  }

  // Samodzielne pliki gier — start automatycznie po załadowaniu strony.
  const path = location.pathname;
  let file = path.includes('/grammar-city/') ? 'grammar-city' : (path.split('/').pop() || '');
  if (file && file !== 'grammar-city' && file.indexOf('.') < 0) file += '.html';   // Vercel: /car-racer
  const page = PAGES[file];
  if (page) {
    // Przed skryptem gry (game-stats.js jest zaraz po data.js) — usuń ignorowane słówka.
    if (!dropIgnored()) document.addEventListener('DOMContentLoaded', dropIgnored);
    // Moduł obecności (presence.js) leży obok tego pliku — app.html go nie potrzebuje (db.js).
    try {
      const me = document.currentScript;
      const base = (me && me.src) ? me.src.replace(/game-stats\.js(\?.*)?$/, '') : '';
      if (!window.SF_PRESENCE && base) {
        const s = document.createElement('script');
        s.src = base + 'presence.js';
        document.head.appendChild(s);
      }
    } catch (e) {}
    const run = () => {
      const p = new URLSearchParams(location.search);
      const book = p.get('book'), unit = p.get('unit');
      start(page[0], page[1], { book, unit, getCorrect: page[2] });
      const info = presenceInfo(page[0], file, book, unit);
      if (window.SF_PRESENCE) window.SF_PRESENCE.set(info); else window.__sfPresence = info;
    };
    if (document.readyState === 'complete') run();
    else window.addEventListener('load', run);
  }
})();
