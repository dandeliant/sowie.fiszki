// ═══════════════════════════════════════════════════════════════
//  SOWIE FISZKI — „🟢 Teraz na Sowich Fiszkach" dla samodzielnych stron
//  (gry, ćwiczenia z INNE, narzędzia nauczyciela). Migracja #83.
//
//  app.html zgłasza się sam przez db.js (DB.presencePing). Tu: strony bez
//  db.js. Gry z game-stats.js ładują ten plik same i podają nazwę gry
//  (SF_PRESENCE.set); inne strony dołączają <script src="presence.js" defer>
//  i zgłaszają się automatycznie tytułem strony.
//
//  Sygnał: od razu po wejściu (z małym opóźnieniem), potem co 30 s — tylko
//  gdy karta jest widoczna; karta w tle → 'hidden', brak ruchu > 2 min →
//  'idle', zamknięcie strony → presence_leave (fetch keepalive).
//  Połączenie: klient Supabase strony (window.supabase.rpc), a gdy go nie ma —
//  zwykły fetch do RPC z tokenem sesji zapisanym przez supabase-js
//  (localStorage 'sb-<projekt>-auth-token'). Gdy token wygasł, a strona nie ma
//  klienta — dociągamy supabase-js + supabase-config.js (klient odświeży
//  sesję bezpiecznie, z blokadą między kartami).
//  Gość (tryb gościa / brak logowania) — nic nie jest wysyłane.
//  Bez migracji #83 — pierwszy błąd „brak funkcji" wyłącza moduł.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.SF_PRESENCE) return;   // app.html tego pliku nie ładuje — ma własny moduł w db.js

  const BEAT_MS = 30000, IDLE_MS = 120000, FIRST_MS = 1500;
  const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const me = document.currentScript;
  const BASE = (me && me.src) ? me.src.replace(/presence\.js(\?.*)?$/, '') : '';

  // Nazwy narzędzi i stron bez gry (plik albo katalog → opis)
  const PAGE_LABELS = {
    'teacher.html':            '👩‍🏫 Panel nauczyciela (kafelki)',
    'words.html':              '🔤 Słówka — podgląd wszystkich podręczników',
    'kreator-kart-pracy.html': '🧩 Kreator kart pracy',
    'slownik-obrazkowy.html':  '📖 Słowniczek obrazkowy',
    'egzaminy.html':           '📘 Egzaminy (E8 / matura)',
    'notesownik':              '📓 NoteSownik',
    'sowiemysli':              '🦉 Sowie Myśli',
    'world-of-bugs':           '🎮 Gra: The World of Bugs'
  };

  const st = {
    info: null, key: '', sent: false, explicit: false,
    timer: null, beat: null, off: false, busy: false, again: false,
    lastInput: Date.now(), loading: null
  };

  function login() {
    try { return sessionStorage.getItem('fiszki_user') || localStorage.getItem('fiszki_user_persist') || ''; }
    catch (e) { return ''; }
  }
  function loggedIn() { const u = login(); return !!u && u !== '__guest__'; }

  function pageId() {
    const parts = location.pathname.split('/').filter(Boolean);
    let last = parts.length ? parts[parts.length - 1] : '';
    if (location.pathname.endsWith('/') || last === 'index.html') {
      last = parts.length ? (last === 'index.html' ? (parts[parts.length - 2] || '') : last) : '';
      return last || 'index';
    }
    if (last && last.indexOf('.') < 0) last += '.html';          // Vercel: /car-racer → car-racer.html
    return last || 'index';
  }

  function cleanTitle() {
    let t = (document.title || '').replace(/\s+/g, ' ').trim();
    t = t.replace(/\s*[·—–|-]\s*Sowie Fiszki.*$/i, '').trim();
    try { t = t.replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim(); } catch (e) {}   // bez emoji na początku
    return t || pageId();
  }

  // „Brainy 6 · Unit 3" — gdy strona ma ?book=&unit= i dane podręczników (data.js)
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

  function autoInfo() {
    const id = pageId();
    const first = location.pathname.split('/').filter(Boolean)[0] || '';   // np. /egzaminy/matura
    const p = new URLSearchParams(location.search);
    const book = p.get('book') || null, unit = p.get('unit') || null;
    const where = whereLabel(book, unit);
    const label = (PAGE_LABELS[id] || PAGE_LABELS[first + '.html'] || PAGE_LABELS[first] || ('🧩 INNE: ' + cleanTitle()))
      + (where ? ' — ' + where : '');
    return { page: id, activity: 'page:' + id.replace(/\.html$/, ''), label, book, unit };
  }

  function str(v, max) {
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    return s ? s.slice(0, max) : null;
  }
  function norm(info) {
    info = info || {};
    return {
      page: str(info.page, 60), activity: str(info.activity, 60), label: str(info.label, 200),
      book: str(info.book, 80), unit: str(info.unit, 80)
    };
  }
  function visState() {
    if (document.visibilityState === 'hidden') return 'hidden';
    return (Date.now() - st.lastInput > IDLE_MS) ? 'idle' : 'active';
  }

  // ── połączenie ──
  function cfg() {
    try {
      if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') return { u: SUPABASE_URL, k: SUPABASE_ANON_KEY };
    } catch (e) {}
    try {
      const c = JSON.parse(localStorage.getItem('fiszki_sb_cfg') || 'null');
      if (c && c.u && c.k) return c;
    } catch (e) {}
    return null;
  }
  function client() {
    const s = window.supabase;
    return (s && typeof s.rpc === 'function') ? s : null;
  }
  // Token sesji supabase-js v2 (null = brak / wygasł)
  function token(c) {
    try {
      const ref = new URL(c.u).hostname.split('.')[0];
      const raw = localStorage.getItem('sb-' + ref + '-auth-token');
      if (!raw) return null;
      let s = JSON.parse(raw);
      if (s && s.currentSession) s = s.currentSession;
      if (!s || !s.access_token) return null;
      if (s.expires_at && s.expires_at * 1000 < Date.now() + 20000) return null;
      return s.access_token;
    } catch (e) { return null; }
  }
  function loadScript(src) {
    return new Promise((ok, bad) => {
      const el = document.createElement('script');
      el.src = src; el.async = false; el.onload = ok; el.onerror = bad;
      document.head.appendChild(el);
    });
  }
  // Strona bez klienta Supabase i z wygasłym tokenem — dociągnij klienta.
  function ensureClient() {
    if (client()) return Promise.resolve(client());
    if (st.loading) return st.loading;
    st.loading = (async () => {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') await loadScript(SB_LIB);
      if (!client()) await loadScript(BASE + 'supabase-config.js');
      return client();
    })().catch(() => null);
    return st.loading;
  }
  // Brak migracji albo brak uprawnień (sesja nieważna) — przestajemy próbować.
  function fatalErr(code, msg) {
    return /PGRST202|42883|42501|Could not find the function|function .*presence_.* does not exist|permission denied/i.test((code || '') + ' ' + (msg || ''));
  }

  async function rpc(fn, args) {
    const cl = client();
    if (cl) {
      const { error } = await cl.rpc(fn, args || {});
      if (error) { if (fatalErr(error.code, error.message)) stop(); return false; }
      return true;
    }
    const c = cfg();
    const tok = c && token(c);
    if (!c || !tok) {
      const cl2 = await ensureClient();
      if (!cl2) return false;
      return rpc(fn, args);
    }
    const r = await fetch(c.u + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: c.k, Authorization: 'Bearer ' + tok, Prefer: 'return=minimal' },
      body: JSON.stringify(args || {})
    });
    if (!r.ok) {
      let j = null; try { j = await r.json(); } catch (e) {}
      if (r.status === 404 || (j && fatalErr(j.code, j.message))) stop();
      return false;
    }
    return true;
  }

  async function send() {
    if (st.off || !st.info || !loggedIn()) return;
    if (st.busy) { st.again = true; return; }
    st.busy = true;
    try {
      const i = st.info;
      const ok = await rpc('presence_ping', {
        p_page: i.page, p_activity: i.activity, p_label: i.label, p_book: i.book, p_unit: i.unit, p_state: visState()
      });
      if (ok) st.sent = true;
    } catch (e) { /* sieć — następna próba za 30 s */ }
    finally {
      st.busy = false;
      if (st.again && !st.off) { st.again = false; setTimeout(send, 250); }
    }
  }

  function stop() {
    st.off = true;
    clearTimeout(st.timer);
    if (st.beat) { clearInterval(st.beat); st.beat = null; }
  }

  function startBeat() {
    if (st.beat || st.off) return;
    st.beat = setInterval(() => { if (document.visibilityState !== 'hidden') send(); }, BEAT_MS);
  }

  function setInfo(info, explicit) {
    if (st.off) return;
    if (explicit) st.explicit = true;
    const n = norm(info);
    const key = JSON.stringify(n);
    const changed = key !== st.key;
    st.info = n; st.key = key;
    if (changed || !st.sent) {
      clearTimeout(st.timer);
      st.timer = setTimeout(send, st.sent ? 600 : FIRST_MS);
    }
    startBeat();
  }

  function leave() {
    if (st.off || !st.sent || !loggedIn()) return;
    st.sent = false;
    try {
      const c = cfg();
      const tok = c && token(c);
      if (!c || !tok) return;
      fetch(c.u + '/rest/v1/rpc/presence_leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c.k, Authorization: 'Bearer ' + tok, Prefer: 'return=minimal' },
        body: '{}', keepalive: true
      }).catch(() => {});
    } catch (e) {}
  }

  // ── zdarzenia strony ──
  const bump = () => {
    const wasIdle = Date.now() - st.lastInput > IDLE_MS;
    st.lastInput = Date.now();
    if (wasIdle && st.sent) send();
  };
  ['pointerdown', 'mousemove', 'keydown', 'touchstart', 'wheel'].forEach(ev =>
    window.addEventListener(ev, bump, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => {
    if (!st.info || st.off) return;
    if (document.visibilityState === 'visible') st.lastInput = Date.now();
    send();
  });
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', (e) => { if (e && e.persisted && st.info) send(); });

  window.SF_PRESENCE = {
    // { page, activity, label, book, unit } — strona/gra mówi, co się dzieje
    set: (info) => { if (info && loggedIn()) setInfo(info, true); },
    leave,
    pageId
  };

  // Gra z game-stats.js mogła podać stan, zanim ten plik się wczytał.
  if (window.__sfPresence) { const q = window.__sfPresence; window.__sfPresence = null; window.SF_PRESENCE.set(q); }

  // Strona sama nic nie zgłosiła — zgłoś ją tytułem.
  const auto = () => { if (!st.explicit && loggedIn()) setInfo(autoInfo(), false); };
  if (document.readyState === 'complete') setTimeout(auto, 300);
  else window.addEventListener('load', () => setTimeout(auto, 300));
})();
