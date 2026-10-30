// ═══════════════════════════════════════════════════════════════════
//  SOWIE FISZKI — Service Worker + okno „Nowa wersja” (app.html, index.html)
//  Gdy czeka nowa wersja, pokazujemy okno. Jeśli w whats-new.json są wpisy
//  z "show": true dla wersji nowszych niż ta, której używa uczeń, okno
//  pokazuje „Co nowego” (wpisy dodaje się tylko po akceptacji właściciela).
//  OK działa jak Ctrl+Shift+R: aktywuje nową wersję, pobiera główne pliki
//  z pominięciem pamięci przeglądarki i przeładowuje stronę.
// ═══════════════════════════════════════════════════════════════════
(function () {
  if (!('serviceWorker' in navigator)) return;

  const CORE = ['app.html', 'index.html', 'db.js', 'data.js', 'supabase-config.js', 'sw-update.js',
    'game-stats.js', 'presence.js', 'ai-chat.js', 'consent.js', 'distractors.js', 'manifest.json'];
  let refreshing = false, hard = false;

  // 'sowie-fiszki-v1.211' → 1211 (do porównywania wersji)
  function verNum(v) { const m = /v(\d+)\.(\d+)/.exec(v || ''); return m ? (+m[1]) * 1000 + (+m[2]) : 0; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  // Wersja danego Service Workera (stare wersje nie odpowiadają → null)
  function askVersion(sw) {
    return new Promise(res => {
      if (!sw) return res(null);
      try {
        const ch = new MessageChannel();
        const t = setTimeout(() => res(null), 1500);
        ch.port1.onmessage = e => { clearTimeout(t); res(e.data || null); };
        sw.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
      } catch (e) { res(null); }
    });
  }

  async function doReload() {
    if (refreshing) return;
    refreshing = true;
    if (hard) {
      // jak Ctrl+Shift+R: świeże pliki z serwera, z pominięciem pamięci przeglądarki
      const urls = CORE.concat([location.pathname]);
      try {
        await Promise.race([
          Promise.all(urls.map(u => fetch(u, { cache: 'reload', credentials: 'same-origin' }).catch(() => null))),
          new Promise(r => setTimeout(r, 4000))
        ]);
      } catch (e) {}
    }
    location.reload();
  }
  navigator.serviceWorker.addEventListener('controllerchange', doReload);

  function hardUpdate(waitingSW) {
    hard = true;
    try { if (waitingSW && waitingSW.state === 'installed') waitingSW.postMessage({ type: 'SKIP_WAITING' }); else doReload(); }
    catch (e) { doReload(); }
    setTimeout(doReload, 6000); // gdyby nowa wersja się nie przełączyła
  }

  function getLS(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setLS(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  async function loadNotes() {
    try {
      const r = await fetch('whats-new.json', { cache: 'no-store' });
      if (r.ok) return ((await r.json()) || {}).versions || [];
    } catch (e) {}
    return [];
  }
  // Wpisy do pokazania: zaakceptowane (show: true), nowsze niż „od”, nie nowsze niż „do”
  // i jeszcze niepokazane. Gdy nie wiadomo, od której wersji — tylko wpis wersji „do”.
  function pick(list, fromV, toV) {
    const hi = verNum(toV), lo = verNum(fromV), seen = verNum(getLS('fiszki_notes_seen'));
    if (!hi) return [];
    return list
      .filter(e => e && e.show === true && verNum(e.v) <= hi && verNum(e.v) > seen
        && (lo ? verNum(e.v) > lo : verNum(e.v) === hi))
      .sort((a, b) => verNum(b.v) - verNum(a.v));
  }
  function notesHtml(notes, title) {
    const items = notes.map(n =>
      '<div style="margin:10px 0 4px;font-weight:900;color:#ffd166;font-size:.95rem">' + esc(n.title || 'Nowości') + '</div>'
      + '<ul style="margin:0;padding-left:20px;line-height:1.55;font-size:.88rem;font-weight:600">'
      + (n.items || []).map(i => '<li style="margin:3px 0">' + esc(i) + '</li>').join('') + '</ul>').join('');
    return '<div role="dialog" aria-modal="true" aria-labelledby="swUpdTitle" style="background:#2a1d6e;color:#f8f4ff;border:2px solid rgba(162,155,254,.35);border-radius:18px;max-width:480px;width:100%;max-height:86vh;overflow-y:auto;padding:20px 20px 16px;box-shadow:0 24px 60px rgba(0,0,0,.5)">'
      + '<div id="swUpdTitle" style="font-family:\'Playfair Display\',serif;font-size:1.25rem;color:#ffd166;margin-bottom:2px">' + esc(title) + '</div>'
      + '<div style="font-size:.78rem;opacity:.8;font-weight:700">Co nowego:</div>' + items
      + '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button id="swUpdateOk" style="background:#2b7cff;color:#fff;border:none;padding:10px 26px;border-radius:10px;font-weight:900;cursor:pointer;font-family:inherit;font-size:1rem">OK</button></div></div>';
  }
  const OVERLAY = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:Nunito,system-ui,sans-serif';

  async function showUpdate(waitingSW) {
    if (document.getElementById('swUpdateBanner')) return;
    let notes = [], newV = null;
    try {
      const [nv, cv, list] = await Promise.all([askVersion(waitingSW), askVersion(navigator.serviceWorker.controller), loadNotes()]);
      newV = nv;
      notes = pick(list, cv || getLS('fiszki_app_ver'), nv);
    } catch (e) {}
    if (document.getElementById('swUpdateBanner')) return;
    const b = document.createElement('div');
    b.id = 'swUpdateBanner';
    if (notes.length) {
      b.style.cssText = OVERLAY;
      b.innerHTML = notesHtml(notes, '🦉 Nowa wersja Sowich Fiszek');
      setLS('fiszki_notes_seen', newV);   // po przeładowaniu nie pokazujemy drugi raz
    } else {
      b.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;background:#2b7cff;color:#fff;padding:14px 18px;border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:Nunito,system-ui,sans-serif;font-weight:700;font-size:.95rem;box-shadow:0 8px 32px rgba(0,0,0,.25);z-index:99999;max-width:520px;margin:0 auto';
      b.innerHTML = '<span>🔄 Nowa wersja dostępna. Kliknij OK, aby odświeżyć.</span><button id="swUpdateOk" style="background:#fff;color:#2b7cff;border:none;padding:9px 18px;border-radius:8px;font-weight:800;cursor:pointer;font-family:inherit;font-size:.95rem">OK</button>';
    }
    document.body.appendChild(b);
    const ok = document.getElementById('swUpdateOk');
    ok.addEventListener('click', () => { ok.disabled = true; ok.textContent = '⏳'; hardUpdate(waitingSW); });
    try { ok.focus(); } catch (e) {}
  }

  // Po wczytaniu nowej wersji: „Co nowego” raz, jeśli nie pokazało się przed przeładowaniem
  // (np. aktualizacja ze starszej wersji bez tego okna albo po zamknięciu wszystkich kart).
  // Nowy użytkownik (strona bez Service Workera przy wejściu) nie dostaje listy zmian.
  const hadController = !!navigator.serviceWorker.controller;
  if (!hadController && !getLS('fiszki_app_ver')) setLS('fiszki_app_ver', 'new');   // pierwsza wizyta
  let _reg = null;
  async function afterLoad() {
    const cur = await askVersion(navigator.serviceWorker.controller);
    if (!cur) return;
    const prev = getLS('fiszki_app_ver');
    setLS('fiszki_app_ver', cur);
    if (!hadController || prev === 'new') { setLS('fiszki_notes_seen', cur); return; }
    if (prev === cur) return;
    const notes = pick(await loadNotes(), prev, cur);
    setLS('fiszki_notes_seen', cur);
    if (!notes.length || document.getElementById('swUpdateBanner')) return;
    const b = document.createElement('div');
    b.id = 'swUpdateBanner';
    b.style.cssText = OVERLAY;
    b.innerHTML = notesHtml(notes, '🦉 Nowości w Sowich Fiszkach');
    document.body.appendChild(b);
    const ok = document.getElementById('swUpdateOk');
    ok.addEventListener('click', () => {
      b.remove();
      if (_reg && _reg.waiting && navigator.serviceWorker.controller) showUpdate(_reg.waiting);
    });
    try { ok.focus(); } catch (e) {}
  }

  navigator.serviceWorker.register('sw.js').then(reg => {
    _reg = reg;
    afterLoad().catch(() => {});
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(sw);
      });
    });
  }).catch(() => {});
})();
