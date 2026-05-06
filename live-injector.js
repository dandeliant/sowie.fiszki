// ═══════════════════════════════════════════════════════════════
//  SOWIE FISZKI — Live Injector
//  Wspólny moduł dla mini-gier samodzielnych (fishing.html, word_rocket.html
//  itd.). Wykrywa URL params LIVE i dostarcza API do gry:
//    window.SF_LIVE = {gameId, playerId, token, bookId, unitKey, timeLimit, nick}
//      (lub null jeśli brak param 'live' w URL)
//    window.SF_LIVE.start(getScoreFn) — gdy gra startuje, podaje callback
//      zwracający aktualny score; uruchamia push co 3s, polling co 5s
//    window.SF_LIVE.end(finalScore) — gdy gra naturalnie się kończy;
//      finalny push + overlay "Czekamy na nauczyciela"; zwraca true
//
//  Dodatkowo:
//   • Banner z nickiem + countdown timera fixed na górze ekranu
//   • Global timer (LIVE.timeLimit s) wymusza koniec — wywołuje
//     window.endGame() jeśli istnieje, lub pokazuje overlay
//   • Polling statusu — gdy host kliknie Zakończ, redirect do app.html
//   • beforeunload sendBeacon — best-effort finalny push przy zamknięciu
// ═══════════════════════════════════════════════════════════════
(function() {
  'use strict';

  const params = new URLSearchParams(location.search);
  const live = params.get('live');
  if (!live) { window.SF_LIVE = null; return; }

  const SF_LIVE = window.SF_LIVE = {
    gameId: live,
    playerId: params.get('pid') || '',
    token: params.get('token') || '',
    bookId: params.get('book') || '',
    unitKey: params.get('unit') || '',
    timeLimit: parseInt(params.get('time') || '0', 10) || 0,
    nick: params.get('nick') || ''
  };

  const SUPABASE_URL = 'https://kofenaaeleyhwhbkytcz.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZmVuYWFlbGV5aHdoYmt5dGN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MzM0NzMsImV4cCI6MjA5MTUwOTQ3M30.z0pzToDoK8NAEiyuKxeXhXnMvzEr5pfJjU7n6ActTU0';

  let _scoreGetter = null;
  let _lastScore = -1;
  let _scoreTimer = null;
  let _statusTimer = null;
  let _globalTimer = null;
  let _bannerTimer = null;
  let _gameStartedAt = null;
  let _ended = false;

  async function pushScore(s) {
    if (s === _lastScore) return;
    try {
      await fetch(SUPABASE_URL + '/rest/v1/rpc/update_live_player_score', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_player_id: SF_LIVE.playerId, p_token: SF_LIVE.token, p_score: Math.max(0, s | 0) })
      });
      _lastScore = s;
    } catch(e) {}
  }
  async function checkStatus() {
    try {
      const r = await fetch(SUPABASE_URL + '/rest/v1/live_games?id=eq.' + encodeURIComponent(SF_LIVE.gameId) + '&select=status', {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
      });
      const d = await r.json();
      return d && d.length ? d[0].status : null;
    } catch(e) { return null; }
  }

  function showOverlay(score) {
    if (document.getElementById('sfLiveEndOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'sfLiveEndOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(12,30,53,.94);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;font-family:Nunito,system-ui,sans-serif';
    const safeNick = (SF_LIVE.nick || 'gracz').replace(/[<>&"]/g, '');
    ov.innerHTML =
      '<div style="background:rgba(12,30,53,.98);border:2px solid #fcd34d;border-radius:24px;padding:32px 28px;text-align:center;max-width:440px;width:100%;color:#fff;box-shadow:0 30px 60px rgba(0,0,0,.5)">' +
      '<div style="font-size:4rem;margin-bottom:8px">⏳</div>' +
      '<div style="font-family:Fredoka,sans-serif;font-size:1.5rem;color:#fcd34d;margin-bottom:6px">Koniec rundy!</div>' +
      '<div style="font-size:.96rem;color:rgba(255,255,255,.85);line-height:1.5">' + safeNick + ', Twój wynik: <b style="color:#fcd34d">' + (score | 0) + ' pkt</b><br>Czekamy aż nauczyciel zakończy grę i pokaże ranking klasy.</div>' +
      '</div>';
    document.body.appendChild(ov);
  }

  function ensureBanner() {
    if (document.getElementById('sfLiveBanner')) return;
    const b = document.createElement('div');
    b.id = 'sfLiveBanner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9000;background:linear-gradient(135deg,rgba(255,209,102,.96),rgba(124,58,237,.96));color:#fff;padding:8px 14px;font-family:Nunito,system-ui,sans-serif;font-weight:800;font-size:.85rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;box-shadow:0 4px 14px rgba(0,0,0,.18);pointer-events:none';
    const safeNick = (SF_LIVE.nick || 'gracz').replace(/[<>&"]/g, '');
    b.innerHTML = '<span>🎮 Live · ' + safeNick + '</span><span id="sfLiveBannerTime" style="font-family:\'Courier New\',monospace;background:rgba(0,0,0,.2);padding:3px 10px;border-radius:8px">∞</span>';
    document.body.appendChild(b);
    document.body.style.paddingTop = '40px';
    // Ukryj back-link jeśli istnieje
    document.querySelectorAll('.back-link').forEach(a => { a.style.display = 'none'; });
  }

  function startTimers() {
    if (_scoreTimer) clearInterval(_scoreTimer);
    _scoreTimer = setInterval(() => {
      if (_scoreGetter && !_ended) pushScore(_scoreGetter() || 0);
    }, 3000);
    if (_statusTimer) clearInterval(_statusTimer);
    _statusTimer = setInterval(async () => {
      const st = await checkStatus();
      if (st === 'finished') {
        if (_scoreGetter) await pushScore(_scoreGetter() || 0);
        stopTimers();
        location.href = 'app.html';
      }
    }, 5000);
    if (SF_LIVE.timeLimit > 0) {
      _gameStartedAt = Date.now();
      if (_globalTimer) clearInterval(_globalTimer);
      _globalTimer = setInterval(() => {
        const elapsed = (Date.now() - _gameStartedAt) / 1000;
        if (elapsed >= SF_LIVE.timeLimit) {
          clearInterval(_globalTimer); _globalTimer = null;
          if (_ended) return;
          // Spróbuj wywołać endGame() z gry — wtedy gra sama wywoła SF_LIVE.end()
          if (typeof window.endGame === 'function') {
            try { window.endGame(); }
            catch(e) { /* fallback */ if (!_ended) SF_LIVE.end(_scoreGetter ? _scoreGetter() : 0); }
            // Jeśli gra nie wywołała SF_LIVE.end, pokaż overlay sami
            setTimeout(() => { if (!_ended) SF_LIVE.end(_scoreGetter ? _scoreGetter() : 0); }, 300);
          } else {
            SF_LIVE.end(_scoreGetter ? _scoreGetter() : 0);
          }
        }
      }, 1000);
    }
    // Banner countdown
    if (_bannerTimer) clearInterval(_bannerTimer);
    if (SF_LIVE.timeLimit > 0) {
      _bannerTimer = setInterval(() => {
        if (!_gameStartedAt) return;
        const elapsed = (Date.now() - _gameStartedAt) / 1000;
        const left = Math.max(0, Math.ceil(SF_LIVE.timeLimit - elapsed));
        const m = Math.floor(left / 60);
        const s = left % 60;
        const tEl = document.getElementById('sfLiveBannerTime');
        if (tEl) tEl.textContent = '⏱️ ' + m + ':' + (s < 10 ? '0' : '') + s;
      }, 500);
    }
  }
  function stopTimers() {
    if (_scoreTimer) { clearInterval(_scoreTimer); _scoreTimer = null; }
    if (_statusTimer) { clearInterval(_statusTimer); _statusTimer = null; }
    if (_globalTimer) { clearInterval(_globalTimer); _globalTimer = null; }
    if (_bannerTimer) { clearInterval(_bannerTimer); _bannerTimer = null; }
  }

  // API publiczne
  SF_LIVE.start = function(scoreGetter) {
    if (typeof scoreGetter !== 'function') return;
    _scoreGetter = scoreGetter;
    _lastScore = -1;
    _ended = false;
    startTimers();
  };
  SF_LIVE.end = function(finalScore) {
    if (_ended) return true;
    _ended = true;
    pushScore(finalScore || 0);
    stopTimers();
    showOverlay(finalScore || 0);
    return true;
  };

  window.addEventListener('beforeunload', () => {
    if (!_scoreGetter || !navigator.sendBeacon) return;
    try {
      const s = _scoreGetter() || 0;
      const blob = new Blob([JSON.stringify({ p_player_id: SF_LIVE.playerId, p_token: SF_LIVE.token, p_score: Math.max(0, s | 0) })], { type: 'application/json' });
      navigator.sendBeacon(SUPABASE_URL + '/rest/v1/rpc/update_live_player_score?apikey=' + SUPABASE_KEY, blob);
    } catch(e) {}
  });

  // Auto-render banner po DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBanner);
  } else {
    ensureBanner();
  }
})();
