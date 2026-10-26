/* ============================================================
   Sowie Fiszki — rozmowa z AI po angielsku (wspólne okno dla app.html i Grammar City)
   Rozmówca: pupil ucznia, Sowa Fiszka albo mieszkaniec Grammar City. Rozmowa tylko
   o słówkach i gramatyce rozdziału (Edge Function „ai”, akcja chat — migracja #73 + wdrożona funkcja).
   - lektor (speechSynthesis) czyta odpowiedzi, 🇵🇱 pokazuje tłumaczenie
   - 🎤 mówienie (Web Speech API, Chrome / Edge / Android) — gdy rozmówca prosi
     „Can you say: …?”, wymowa jest sprawdzana słowo po słowie; przy błędach prosi
     o powtórzenie (max 3 próby), bez kosztów AI
   - poprawki błędów zbierane na dole okna („✏️ Poprawki”)
   - naturalny głos (akcje tts / stt Edge Function, gdy voice_status = true — na razie admin,
     opcjonalnie konta Premium): odpowiedzi czytane głosem OpenAI (inny głos dla gatunku pupila),
     🎤 nagrywa wypowiedź i zamienia ją na tekst (działa też na iPhonie i w Firefoksie);
     przy błędzie — lektor przeglądarki
   window.SFChat.open({
     persona: 'pet' | 'owl' | 'npc', name, emoji, species, role,
     ctx: { lang, level, unitName, words: [{t, pl}], grammar: [tematy] },
     invoke: async body => wynik Edge Function,   // body bez pola action (dodawane tutaj)
     onGood(): pochwała / poprawna wypowiedź (XP, humor pupila), onClose(), guest: bool
   })
============================================================ */
(function () {
  'use strict';
  if (window.SFChat) return;
  const TTS = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', it: 'it-IT', ru: 'ru-RU' };
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normW = s => String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const MR = !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  // Naturalny głos: stały głos OpenAI dla rozmówcy (gatunek pupila / imię postaci).
  const PET_VOICES = ['coral', 'nova', 'shimmer', 'ballad', 'sage', 'fable', 'verse', 'ash'];
  const NPC_VOICES = ['alloy', 'ash', 'coral', 'echo', 'sage', 'onyx', 'nova', 'verse'];
  const hash = s => [...String(s || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  function voiceFor(o) {
    if (o.persona === 'owl') return { voice: 'fable', style: 'You are a wise, kind and patient owl teacher.' };
    if (o.persona === 'npc') return { voice: NPC_VOICES[hash(o.name) % NPC_VOICES.length], style: 'You are a friendly person living in a city, chatting with a child.' };
    return { voice: PET_VOICES[hash(o.species || o.name) % PET_VOICES.length], style: 'You are a cute, cheerful pet (' + (o.species || 'animal') + ') talking to your young owner. Warm and playful.' };
  }
  // Cisza do „odblokowania” odtwarzania na iPhonie (pierwsze play() musi być w kliknięciu).
  function silentWav() {
    const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    w(36, 'data'); v.setUint32(40, n, true); for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }
  const blobToB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });

  const css = document.createElement('style');
  css.textContent = `
  .sfc-ov{position:fixed;inset:0;z-index:10040;background:rgba(10,8,25,.72);display:flex;align-items:center;justify-content:center;padding:12px;font-family:inherit}
  .sfc-box{width:100%;max-width:560px;height:min(720px,94vh);display:flex;flex-direction:column;background:#1c1840;color:#f2efff;border:2px solid rgba(124,77,255,.55);border-radius:20px;box-shadow:0 18px 60px rgba(0,0,0,.5);overflow:hidden}
  .sfc-head{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(135deg,rgba(124,77,255,.35),rgba(6,214,160,.18));border-bottom:1px solid rgba(255,255,255,.1)}
  .sfc-ava{font-size:2.1rem;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))}
  .sfc-who{flex:1;min-width:0}.sfc-who b{display:block;font-size:1rem}.sfc-who small{display:block;font-size:.7rem;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sfc-hb{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);color:inherit;border-radius:10px;padding:6px 9px;cursor:pointer;font-size:.85rem;font-family:inherit}
  .sfc-hb.off{opacity:.45}
  .sfc-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
  .sfc-m{max-width:86%;padding:8px 11px;border-radius:14px;font-size:.92rem;line-height:1.45;word-wrap:break-word}
  .sfc-bot{align-self:flex-start;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12);border-bottom-left-radius:4px}
  .sfc-me{align-self:flex-end;background:linear-gradient(135deg,#7c4dff,#5b35d6);border-bottom-right-radius:4px}
  .sfc-sys{align-self:center;font-size:.74rem;opacity:.75;text-align:center;max-width:94%}
  .sfc-pl{font-size:.78rem;opacity:.75;margin-top:4px;display:none}.sfc-m.showpl .sfc-pl{display:block}
  .sfc-tools{display:flex;gap:6px;margin-top:5px}.sfc-tools button{background:rgba(255,255,255,.1);border:none;color:inherit;border-radius:8px;padding:2px 7px;cursor:pointer;font-size:.75rem}
  .sfc-fix{font-size:.74rem;margin-top:4px;color:#ffd166}
  .sfc-say{margin:0 12px 6px;padding:9px 11px;border-radius:14px;background:rgba(6,214,160,.14);border:1.5px dashed rgba(6,214,160,.6);font-size:.86rem;display:none}
  .sfc-say b{font-size:1rem}.sfc-say .w-ok{color:#06d6a0;font-weight:800}.sfc-say .w-bad{color:#ff7675;font-weight:800;text-decoration:underline}
  .sfc-fixes{margin:0 12px 6px;font-size:.78rem;background:rgba(255,209,102,.1);border:1px solid rgba(255,209,102,.35);border-radius:12px;padding:6px 10px;display:none;max-height:120px;overflow-y:auto}
  .sfc-fixes summary{cursor:pointer;font-weight:800;color:#ffd166}.sfc-fixes li{margin:3px 0}
  .sfc-in{display:flex;gap:6px;padding:8px 10px 6px;border-top:1px solid rgba(255,255,255,.1)}
  .sfc-in textarea{flex:1;resize:none;height:44px;border-radius:12px;border:1.5px solid rgba(255,255,255,.2);background:rgba(0,0,0,.25);color:inherit;padding:9px 11px;font-family:inherit;font-size:.92rem;outline:none}
  .sfc-in textarea:focus{border-color:#7c4dff}
  .sfc-btn{border:none;border-radius:12px;padding:0 14px;font-size:1.15rem;cursor:pointer;background:#7c4dff;color:#fff;font-family:inherit}
  .sfc-btn.mic{background:#06d6a0;color:#111}.sfc-btn.mic.rec{background:#ff4d6d;color:#fff;animation:sfcPulse 1s infinite}
  .sfc-btn:disabled{opacity:.45;cursor:default}
  @keyframes sfcPulse{50%{transform:scale(1.08)}}
  .sfc-foot{font-size:.66rem;opacity:.65;text-align:center;padding:0 10px 8px}
  .sfc-typing{opacity:.7;font-style:italic}
  `;
  document.head.appendChild(css);

  let st = null;
  let voices = [];
  const loadVoices = () => { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } };
  if ('speechSynthesis' in window) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { /* stare przeglądarki */ } }
  function stopVoice() {
    try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    if (st && st.audio) { try { st.audio.pause(); } catch (e) { /* ignore */ } }
  }
  function speakNatural(text) {
    const my = ++st.sayId;
    stopVoice();
    const play = url => { if (!st || my !== st.sayId) return; st.audio.src = url; const p = st.audio.play(); if (p && p.catch) p.catch(() => { /* autoplay zablokowany — 🔊 przy dymku */ }); };
    if (st.cache[text]) { play(st.cache[text]); return; }
    st.o.invoke({ action: 'tts', text, voice: st.vo.voice, style: st.vo.style, lang: st.ctx.lang || 'en' }).then(r => {
      if (!st) return;
      if (!r || !r.audio) throw new Error('brak dźwięku');
      const bin = atob(r.audio), u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([u8], { type: r.mime || 'audio/mpeg' }));
      st.cache[text] = url; play(url);
    }).catch(e => {
      if (!st) return;
      st.voiceFails = (st.voiceFails || 0) + 1;
      if (st.voiceFails >= 2 && st.voice) { st.voice = false; setVoiceTag(); addSys('🔈 Naturalny głos chwilowo niedostępny (' + ((e && e.message) || e) + ') — czyta lektor przeglądarki.'); }
      if (my === st.sayId) speakBrowser(text, st.tts);
    });
  }
  function speak(text, lang) {
    if (!text || !st || !st.autoRead && !st.forceSay) return;
    if (st.voice) { speakNatural(text); return; }
    speakBrowser(text, lang);
  }
  function speakBrowser(text, lang) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = 0.92;
      const base = lang.slice(0, 2);
      const v = voices.find(x => x.lang === lang && /Google|Natural/i.test(x.name)) || voices.find(x => x.lang === lang) || voices.find(x => x.lang && x.lang.startsWith(base));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* brak lektora */ }
  }
  const say = text => { if (!st) return; st.forceSay = true; speak(text, st.tts); st.forceSay = false; };

  function el(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function scroll() { const m = st && st.root.querySelector('.sfc-msgs'); if (m) m.scrollTop = m.scrollHeight; }
  function addSys(text) { const m = el('<div class="sfc-m sfc-sys">' + E(text) + '</div>'); st.root.querySelector('.sfc-msgs').appendChild(m); scroll(); return m; }
  function addMe(text, spoken) {
    const m = el('<div class="sfc-m sfc-me">' + (spoken ? '🎤 ' : '') + E(text) + '</div>');
    st.root.querySelector('.sfc-msgs').appendChild(m); scroll(); return m;
  }
  function addBot(text, pl) {
    const m = el('<div class="sfc-m sfc-bot"><div>' + E(text) + '</div>' + (pl ? '<div class="sfc-pl">🇵🇱 ' + E(pl) + '</div>' : '') +
      '<div class="sfc-tools"><button data-a="say">🔊</button>' + (pl ? '<button data-a="pl">🇵🇱</button>' : '') + '</div></div>');
    m.querySelector('[data-a="say"]').onclick = () => say(text);
    const p = m.querySelector('[data-a="pl"]'); if (p) p.onclick = () => m.classList.toggle('showpl');
    st.root.querySelector('.sfc-msgs').appendChild(m); scroll();
    speak(text, st.tts);
    return m;
  }
  function setBusy(b) {
    st.busy = b;
    st.root.querySelectorAll('.sfc-in button, .sfc-in textarea').forEach(x => { x.disabled = b || st.locked; });
    if (!b && !st.locked) { const ta = st.root.querySelector('textarea'); if (ta && !('ontouchstart' in window)) ta.focus(); }
    if (b) { st.typing = el('<div class="sfc-m sfc-bot sfc-typing">' + E(st.o.name) + ' pisze…</div>'); st.root.querySelector('.sfc-msgs').appendChild(st.typing); scroll(); }
    else if (st.typing) { st.typing.remove(); st.typing = null; }
  }
  function renderFixes() {
    const box = st.root.querySelector('.sfc-fixes');
    if (!st.fixes.length) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = '<details' + (st.fixOpen ? ' open' : '') + '><summary>✏️ Poprawki (' + st.fixes.length + ')</summary><ul style="margin:4px 0 0;padding-left:18px">' +
      st.fixes.map(f => '<li>' + (f.wrong ? '<s>' + E(f.wrong) + '</s> → ' : '') + '<b>' + E(f.right) + '</b>' + (f.why ? ' — ' + E(f.why) : '') + '</li>').join('') + '</ul></details>';
    box.querySelector('details').ontoggle = e => { st.fixOpen = e.target.open; };
  }
  function renderSay(markup) {
    const box = st.root.querySelector('.sfc-say');
    if (!st.target) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = '🗣️ Powiedz na głos: <b>' + (markup || E(st.target)) + '</b> <button class="sfc-hb" data-a="ts" style="padding:2px 7px">🔊</button>' +
      (canMic() ? ' <button class="sfc-hb" data-a="tm" style="padding:2px 7px">🎤 Mówię</button>' : '<div style="font-size:.72rem;opacity:.8;margin-top:3px">Ta przeglądarka nie rozpoznaje mowy (działa w Chrome / Edge) — możesz wpisać to zdanie.</div>') +
      (st.tries ? '<div style="font-size:.72rem;opacity:.85;margin-top:3px">Próba ' + (st.tries + 1) + ' z 3</div>' : '');
    box.querySelector('[data-a="ts"]').onclick = () => say(st.target);
    const m = box.querySelector('[data-a="tm"]'); if (m) m.onclick = micClick;
  }

  // Porównanie wymowy (tekst z rozpoznawania mowy) z frazą — słowo po słowie.
  function compare(target, heard) {
    const t = normW(target).split(' ').filter(Boolean), h = new Set(normW(heard).split(' ').filter(Boolean));
    const marks = t.map(w => ({ w, ok: h.has(w) || h.has(w.replace(/'/g, '')) }));
    const score = marks.length ? marks.filter(x => x.ok).length / marks.length : 0;
    return { score, markup: String(target).split(/\s+/).map((orig, i) => '<span class="' + (marks[i] && marks[i].ok ? 'w-ok' : 'w-bad') + '">' + E(orig) + '</span>').join(' ') };
  }
  const PRAISE = ['Brilliant! 🌟', 'Perfect pronunciation! 🎉', 'Great job! 👏', 'Wow, well said! ⭐'];
  const RETRY = ['Almost! Listen and try again:', 'Nice try! Listen once more:', 'Good! One more time, listen:'];

  async function turn(message, flags) {
    if (!st || st.busy || st.locked) return;
    setBusy(true);
    try {
      const r = await st.o.invoke(Object.assign({
        persona: st.o.persona, name: st.o.name, species: st.o.species || '', role: st.o.role || '',
        lang: st.ctx.lang || 'en', level: st.ctx.level || '', unitName: st.ctx.unitName || '',
        words: (st.ctx.words || []).slice(0, 40), grammar: (st.ctx.grammar || []).slice(0, 6),
        history: st.history.slice(-12), message: message || '',
      }, flags || {}));
      setBusy(false);
      if (!st) return;
      if (r.blocked) { addBot("Let's talk about something nice from our lesson! 😊", 'Porozmawiajmy o czymś miłym z naszej lekcji!'); return; }
      if (message) st.history.push({ role: 'user', content: flags && flags.repeated ? '(repeated aloud: ' + message + ')' : message });
      st.history.push({ role: 'assistant', content: r.reply || '' });
      if (r.correction && r.correction.right) {
        st.fixes.unshift(r.correction); renderFixes();
        if (st.lastMe) st.lastMe.insertAdjacentHTML('beforeend', '<div class="sfc-fix">✏️ ' + E(r.correction.right) + '</div>');
      }
      addBot(r.reply || '…', r.replyPl || '');
      if (message && !(flags && flags.repeated) && (r.praise || !r.correction)) { try { st.o.onGood && st.o.onGood(!!r.praise); } catch (e) { /* ignore */ } }
      st.target = r.sayThis || ''; st.tries = 0; renderSay();
      if (r.max) st.root.querySelector('.sfc-foot').textContent = '🤖 Rozmówcą jest sztuczna inteligencja — może się czasem pomylić. Rozmowa jest zapisywana na 7 dni. Wiadomości dziś: ' + r.used + ' / ' + r.max + '.' +
        (st.voice ? ' 🎙️ Nagranie głosu jest zamieniane na tekst przez OpenAI i nie jest zapisywane.' : '');
    } catch (e) {
      setBusy(false);
      if (st) addSys('❌ ' + (e.message || e));
    }
  }

  function send(text, spoken) {
    text = String(text || '').trim();
    if (!text || !st || st.busy) return;
    st.root.querySelector('textarea').value = '';
    // Prośba o powiedzenie frazy: sprawdź wymowę lokalnie (bez AI), przy błędach poproś o powtórkę.
    if (st.target && spoken) {
      st.lastMe = addMe(text, true);
      const c = compare(st.target, text);
      if (c.score >= 0.8) {
        const p = PRAISE[Math.floor(Math.random() * PRAISE.length)];
        renderSay(c.markup);
        const target = st.target; st.target = '';
        setTimeout(() => { if (!st) return; renderSay(); addSys('✅ ' + p); try { st.o.onGood && st.o.onGood(true); } catch (e) { /* ignore */ } turn(text, { repeated: true, target }); }, 700);
        return;
      }
      st.tries++;
      if (st.tries >= 3) {
        addSys('👍 Good try! Ćwicz dalej — posłuchaj jeszcze raz i idziemy dalej.');
        const target = st.target; say(target); st.target = ''; renderSay();
        turn(text, { repeated: true, target });
        return;
      }
      renderSay(c.markup);
      addBot(RETRY[Math.floor(Math.random() * RETRY.length)] + ' "' + st.target + '"', 'Prawie! Posłuchaj i powtórz jeszcze raz (czerwone słowa były niewyraźne).');
      setTimeout(() => say(st && st.target), 1600);
      return;
    }
    st.lastMe = addMe(text, spoken);
    turn(text, spoken ? { spoken: true } : null);
  }

  const canMic = () => !!(SR || (st && st.voice && MR));
  function micClick() { if (st && st.voice && MR) recordMic(); else startMic(); }
  // Naturalny głos: nagranie → OpenAI (stt) → tekst. Klik = start, drugi klik = koniec (max 15 s).
  async function recordMic() {
    if (!st || st.busy || st.locked) return;
    if (st.mr) { try { st.mr.stop(); } catch (e) { /* ignore */ } return; }
    stopVoice();
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { if (st) addSys('🎤 Zezwól przeglądarce na użycie mikrofonu (ikona kłódki przy adresie strony).'); return; }
    if (!st) { stream.getTracks().forEach(t => t.stop()); return; }
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    const mime = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    const chunks = [], mics = () => st ? st.root.querySelectorAll('.sfc-btn.mic, [data-a="tm"]') : [];
    st.mr = mr; mics().forEach(b => b.classList.add('rec'));
    if (!st.recHint) { st.recHint = true; addSys('🔴 Nagrywam — mów po angielsku i kliknij 🎤 jeszcze raz, gdy skończysz (maks. 15 s).'); }
    mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      if (!st) return;
      clearTimeout(st.mrT); st.mr = null; mics().forEach(b => b.classList.remove('rec'));
      const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' });
      if (blob.size < 1500) { addSys('🎤 Nic nie usłyszałam — kliknij 🎤 i powiedz wyraźnie.'); return; }
      const note = addSys('🎤 Rozpoznaję…');
      try {
        const r = await st.o.invoke({ action: 'stt', audio: await blobToB64(blob), mime: blob.type });
        if (!st) return;
        note.remove();
        const t = String((r && r.text) || '').trim();
        if (!t) { addSys('🎤 Nic nie usłyszałam — kliknij 🎤 i powiedz wyraźnie.'); return; }
        send(t, true);
      } catch (e) { if (st) { note.remove(); addSys('🎤 ' + ((e && e.message) || e)); } }
    };
    mr.start();
    st.mrT = setTimeout(() => { try { if (mr.state !== 'inactive') mr.stop(); } catch (e) { /* ignore */ } }, 15000);
  }
  function setVoiceTag() {
    const t = st && st.root.querySelector('.sfc-vtag'); if (!t) return;
    t.textContent = st.voice ? ' · 🎙️ naturalny głos' : '';
  }
  function enableVoice() {
    st.voice = true; st.vo = voiceFor(st.o); setVoiceTag();
    if (MR && !st.root.querySelector('.sfc-btn.mic')) {
      const b = el('<button class="sfc-btn mic" title="Powiedz po angielsku">🎤</button>');
      b.onclick = micClick; st.root.querySelector('.sfc-btn.send').before(b);
    }
    st.root.querySelector('.sfc-foot').insertAdjacentText('beforeend', ' 🎙️ Nagranie głosu jest zamieniane na tekst przez OpenAI i nie jest zapisywane.');
    if (st.target) renderSay();
  }

  function startMic() {
    if (!SR || !st || st.busy || st.locked) return;
    if (st.rec) { try { st.rec.stop(); } catch (e) { /* ignore */ } return; }
    stopVoice();
    const r = new SR(); st.rec = r;
    r.lang = st.tts; r.interimResults = false; r.maxAlternatives = 1;
    const mic = st.root.querySelector('.sfc-btn.mic'); if (mic) mic.classList.add('rec');
    let got = false;
    r.onresult = ev => { got = true; const t = ev.results[0][0].transcript; send(t, true); };
    r.onerror = ev => { if (st) addSys(ev.error === 'not-allowed' ? '🎤 Zezwól przeglądarce na użycie mikrofonu (ikona kłódki przy adresie strony).' : ev.error === 'no-speech' ? '🎤 Nic nie usłyszałam — kliknij 🎤 i powiedz wyraźnie.' : '🎤 Błąd mikrofonu: ' + ev.error); };
    r.onend = () => { if (!st) return; st.rec = null; const m = st.root.querySelector('.sfc-btn.mic'); if (m) m.classList.remove('rec'); };
    try { r.start(); } catch (e) { st.rec = null; if (mic) mic.classList.remove('rec'); }
  }

  function close() {
    if (!st) return;
    stopVoice();
    try { st.rec && st.rec.abort(); } catch (e) { /* ignore */ }
    try { if (st.mr && st.mr.state !== 'inactive') st.mr.stop(); } catch (e) { /* ignore */ }
    clearTimeout(st.mrT);
    Object.values(st.cache).forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ } });
    const o = st.o; st.root.remove(); st = null;
    document.removeEventListener('keydown', onKey, true);
    try { o.onClose && o.onClose(); } catch (e) { /* ignore */ }
  }
  // Klawisze obsługujemy tu (faza przechwytywania) i nie przepuszczamy dalej — gra / skróty aplikacji
  // nie reagują, gdy okno rozmowy jest otwarte; zwykłe pisanie w polu działa (bez preventDefault).
  function onKey(e) {
    if (!st) return;
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    const ta = st.root.querySelector('textarea');
    if (e.key === 'Enter' && !e.shiftKey && e.target === ta) { e.preventDefault(); send(ta.value, false); }
  }

  function open(o) {
    if (st) close();
    const ctx = o.ctx || {};
    st = { o, ctx, tts: TTS[ctx.lang] || 'en-GB', history: [], fixes: [], fixOpen: false, target: '', tries: 0, busy: false,
      autoRead: localStorage.getItem('sfc_autoread') !== '0', locked: !!o.guest,
      voice: false, vo: null, cache: {}, sayId: 0, audio: new Audio() };
    try { st.audio.src = silentWav(); const p = st.audio.play(); if (p && p.catch) p.catch(() => { /* ignore */ }); } catch (e) { /* ignore */ }
    const root = el(`<div class="sfc-ov"><div class="sfc-box">
      <div class="sfc-head"><div class="sfc-ava">${E(o.emoji || '🦉')}</div>
        <div class="sfc-who"><b>${E(o.name)}</b><small>💬 Rozmowa po angielsku${ctx.unitName ? ' · ' + E(ctx.unitName) : ''}<span class="sfc-vtag"></span></small></div>
        <button class="sfc-hb${st.autoRead ? '' : ' off'}" data-a="read" title="Lektor czyta odpowiedzi">🔈</button>
        <button class="sfc-hb" data-a="x" title="Zamknij (Esc)">✕</button></div>
      <div class="sfc-msgs"></div>
      <div class="sfc-say"></div>
      <div class="sfc-fixes"></div>
      <div class="sfc-in"><textarea placeholder="Napisz po angielsku… (Enter — wyślij)" maxlength="300"></textarea>
        ${SR ? '<button class="sfc-btn mic" title="Powiedz po angielsku">🎤</button>' : ''}<button class="sfc-btn send" title="Wyślij">➤</button></div>
      <div class="sfc-foot">🤖 Rozmówcą jest sztuczna inteligencja — może się czasem pomylić. Rozmowa jest zapisywana na 7 dni (widzi ją tylko administrator). Nie podawaj nazwiska, adresu ani hasła.</div>
    </div></div>`);
    st.root = root; document.body.appendChild(root);
    root.addEventListener('click', e => { if (e.target === root) close(); });
    root.querySelector('[data-a="x"]').onclick = close;
    root.querySelector('[data-a="read"]').onclick = e => { st.autoRead = !st.autoRead; e.target.classList.toggle('off', !st.autoRead); try { localStorage.setItem('sfc_autoread', st.autoRead ? '1' : '0'); } catch (x) { /* ignore */ } if (!st.autoRead) stopVoice(); };
    const ta = root.querySelector('textarea');
    root.querySelector('.send').onclick = () => send(ta.value, false);
    const mic = root.querySelector('.mic'); if (mic) mic.onclick = micClick;
    document.addEventListener('keydown', onKey, true);
    if (o.guest) {
      st.locked = true; setBusy(false);
      addSys('🔒 Rozmowa z AI działa po zalogowaniu.');
      return;
    }
    setTimeout(() => ta.focus(), 60);
    // Naturalny głos (Edge Function voice_status) — sprawdzamy przed powitaniem, max 2,5 s.
    const me = st;
    const check = Promise.resolve().then(() => o.invoke({ action: 'voice_status' })).then(r => { if (st === me && r && r.voice === true) enableVoice(); }).catch(() => { /* stara funkcja AI / brak dostępu */ });
    Promise.race([check, new Promise(r => setTimeout(r, 2500))]).then(() => {
      if (st !== me) return;
      if (!SR && !st.voice) addSys('ℹ️ Mówienie (🎤) działa w Chrome i Edge. Tutaj możesz pisać.');
      turn('', null);
    });
  }

  // send(tekst, true) = wypowiedź z rozpoznawania mowy (używane też w testach)
  window.SFChat = { open, close, send, isOpen: () => !!st };
})();
