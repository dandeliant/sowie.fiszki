/* Grammar City — TRYB SŁÓWEK (Sowie Fiszki).
   Uruchamiany z rozdziału w app.html: grammar-city/?book=<id>&unit=<klucz|all>.
   Podmienia window.MISSIONS / window.TIERS (z questions.js) na misje-quizy
   ze słówek rozdziału: wybór 1 z 4, PL→obcy i obcy→PL, zbliżone dystraktory
   (distractors.js) — jak w Inwazji Obcych. Miasto, budynki i NPC zostają.
   Wymaga (ładowane tylko w tym trybie): ../data.js (BOOKS), ../distractors.js.
   Bez parametru ?book plik nic nie robi — gra gramatyczna działa jak dotąd. */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const bookId = params.get('book');
  if (!bookId) return;
  let unitKey = params.get('unit') || 'all';
  if (unitKey === '__all__') unitKey = 'all';

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.,!?;:]+$/g, '').replace(/\s+/g, ' ').trim();
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Odmiana polska: 1 słówko · 2–4, 22–24… słówka · 5–21, 25… słówek
  const plural = (k, one, few, many) => k === 1 ? one : (k % 10 >= 2 && k % 10 <= 4 && (k % 100 < 12 || k % 100 > 14)) ? few : many;
  const slowek = k => k + ' ' + plural(k, 'słówko', 'słówka', 'słówek');
  const misji = k => k + ' ' + plural(k, 'misja', 'misje', 'misji');
  const backUrl = '../app.html#/book/' + encodeURIComponent(bookId) + (unitKey !== 'all' ? '/' + encodeURIComponent(unitKey) : '');

  function showError(msg) {
    const tag = document.querySelector('#start-ov .tagline');
    if (tag) tag.innerHTML = '⚠️ ' + esc(msg) + ' Możesz zagrać w wersję gramatyczną albo wrócić do rozdziału.';
    addBackLink();
  }
  function addBackLink() {
    const acts = document.querySelector('#start-ov .start-actions');
    if (!acts || $('gc-back')) return;
    const a = document.createElement('a');
    a.id = 'gc-back'; a.className = 'btn ghost'; a.href = backUrl; a.textContent = '← Wróć do rozdziału';
    a.style.textDecoration = 'none';
    acts.insertBefore(a, acts.children[1] || null);
  }

  if (typeof BOOKS === 'undefined' || !BOOKS[bookId]) { showError('Nie znaleziono tego podręcznika w trybie offline.'); return; }
  const book = BOOKS[bookId];
  const lang = book.language || 'en';
  const LANG_PL = { en: 'angielsku', fr: 'francusku', de: 'niemiecku', es: 'hiszpańsku', it: 'włosku', ru: 'rosyjsku' }[lang] || 'angielsku';
  const LANG_TAG = { en: 'EN', fr: 'FR', de: 'DE', es: 'ES', it: 'IT', ru: 'RU' }[lang] || 'EN';
  const TTS_LANG = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', it: 'it-IT', ru: 'ru-RU' }[lang] || 'en-GB';

  // ── słówka: rozdział albo cały podręcznik (grupy = rozdziały) ──
  const unitEntries = unitKey === 'all'
    ? Object.entries(book.units || {})
    : (book.units && book.units[unitKey] ? [[unitKey, book.units[unitKey]]] : []);
  if (!unitEntries.length) { showError('Nie znaleziono tego rozdziału.'); return; }
  const seen = new Set();
  const cleanWords = list => (list || []).map(w => [String(w[0] || '').trim(), String(w[1] || '').trim()])
    .filter(([pl, en]) => pl && en && en.length <= 80)
    .filter(([pl, en]) => { const k = pl + '|' + en; if (seen.has(k)) return false; seen.add(k); return true; });
  const groups = unitEntries.map(([k, u]) => ({ key: k, name: u.name || k, words: cleanWords(u.words) })).filter(g => g.words.length);
  const pool = groups.flatMap(g => g.words);   // pula dystraktorów = całe słownictwo
  if (pool.length < 4) { showError('Ten rozdział ma za mało słówek (min. 4).'); return; }

  // ── podział na misje (max 18 = liczba miejsc misji w mieście) ──
  const GRAMMAR = (window.MISSIONS || []).filter(m => !m.final);
  const FINAL_SLOT = (window.MISSIONS || []).find(m => m.final) || {};
  const MAX = Math.min(18, GRAMMAR.length);
  let chunks = [];   // [{ label, words }]
  if (unitKey === 'all' && groups.length > 1) {
    // cały podręcznik: misja = rozdział (gdy rozdziałów > MAX — łączymy sąsiednie)
    const per = Math.ceil(groups.length / MAX);
    for (let i = 0; i < groups.length; i += per) {
      const part = groups.slice(i, i + per);
      chunks.push({ label: part.map(g => g.name).join(' + '), words: part.flatMap(g => g.words) });
    }
  } else {
    // jeden rozdział: ~8 słówek na misję, równe porcje
    const words = groups.flatMap(g => g.words);
    const k = Math.max(1, Math.min(MAX, Math.round(words.length / 8)));
    for (let i = 0; i < k; i++) {
      const a = Math.round(i * words.length / k), b = Math.round((i + 1) * words.length / k);
      chunks.push({ label: 'Słówka ' + (a + 1) + '–' + b, words: words.slice(a, b) });
    }
  }

  // ── etapy (odblokowywanie) — 4 etapy + finał (TIERS[4] = kolor ratusza) ──
  const n = chunks.length;
  const tierOf = i => Math.min(3, Math.floor(i * 4 / n));
  const countBelow = t => chunks.filter((_, i) => tierOf(i) < t).length;
  const COLORS = ['#45d483', '#4fb3ff', '#f2b632', '#ff7a4d', '#c77dff'];
  const TIERS = [0, 1, 2, 3].map(t => ({ name: 'Etap ' + (t + 1), need: Math.ceil(countBelow(t) * 0.6), color: COLORS[t] }));
  TIERS.push({ name: 'FINAŁ', need: n, color: COLORS[4] });

  // ── pytania (typ „c" silnika: { q, o, a, e }) ──
  function choice(w, dir) {
    const [pl, en] = w;
    const correct = dir === 'pl' ? en : pl;          // dir 'pl' = pytanie po polsku, odpowiedź obca
    const field = dir === 'pl' ? 1 : 0;
    let wrongs = typeof window.generateDistractors === 'function' ? window.generateDistractors(correct, pool, 3, field) : [];
    const used = new Set([norm(correct)]);
    wrongs = (wrongs || []).filter(x => { const k = norm(x); if (!k || used.has(k)) return false; used.add(k); return true; });
    for (let guard = 0; wrongs.length < 3 && guard < 200; guard++) {
      const v = pool[Math.floor(Math.random() * pool.length)][field], k = norm(v);
      if (v && !used.has(k)) { wrongs.push(v); used.add(k); }
    }
    while (wrongs.length < 3) wrongs.push('—');
    return {
      t: 'c',
      q: dir === 'pl' ? '„' + pl + '” — jak to jest po ' + LANG_PL + '?' : '„' + en + '” — co to znaczy po polsku?',
      o: [correct].concat(wrongs.slice(0, 3)), a: 0,
      e: pl + ' = ' + en,
      gcPrompt: dir === 'pl' ? { text: pl, lang: 'pl-PL' } : { text: en, lang: TTS_LANG },
      gcSay: { text: en, lang: TTS_LANG },
    };
  }
  const questionsFor = words => words.flatMap(w => [choice(w, 'pl'), choice(w, 'fx')]);

  const npcName = npc => String(npc || '').split(',')[0].trim() || 'Mieszkaniec';
  const tipHtml = words => '<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 14px;margin-top:4px">' +
    words.map(([pl, en]) => '<b>' + esc(en) + '</b><span>' + esc(pl) + '</span>').join('') + '</div>';

  const missions = chunks.map((c, i) => {
    const slot = GRAMMAR[i];
    const who = npcName(slot.npc);
    const m = {
      id: 'v_' + bookId + '_' + unitKey + '_' + i,
      place: slot.place, short: slot.short, npc: slot.npc,
      topic: c.label + ' · ' + slowek(c.words.length),
      level: TIERS[tierOf(i)].name, tier: tierOf(i),
      story: "Hi, I'm " + who + "! I've got a word problem. Show me you know these " + c.words.length + ' words and I will pay you.',
      storyPL: 'Cześć, tu ' + who + '! Mam kłopot ze słówkami. Pokaż, że znasz te ' + slowek(c.words.length) + ', a dostaniesz zapłatę.',
      tip: tipHtml(c.words),
      questions: [],
    };
    ['block', 'lot', 'park'].forEach(k => { if (slot[k]) m[k] = slot[k]; });
    m.questions = questionsFor(c.words).map(q => Object.assign(q, { src: m }));
    return m;
  });

  const finalM = {
    id: 'v_' + bookId + '_' + unitKey + '_final',
    place: FINAL_SLOT.place || 'City Hall', short: FINAL_SLOT.short || 'HALL', npc: FINAL_SLOT.npc || 'Mayor Johnson, burmistrz',
    cityHall: FINAL_SLOT.cityHall || [3, 3], final: true,
    topic: 'Egzamin końcowy — wszystkie słówka', level: 'FINAŁ', tier: 4,
    story: "So you're the word expert everybody talks about! One last test with words from every mission. Pass it and the city is yours.",
    storyPL: 'Burmistrz sprawdzi słówka ze wszystkich misji. Zdaj egzamin, a miasto należy do Ciebie.',
    tip: 'Egzamin losuje <b>15 pytań</b> ze słówek wszystkich misji (' + slowek(pool.length) + '). Przejrzyj ściągi w misjach, zanim zaczniesz.',
    questions: missions.flatMap(m => m.questions),
  };

  window.MISSIONS = missions.concat([finalM]);
  window.TIERS = TIERS;
  window.GC_SAVE_KEY = 'grammarCity.vocab.' + bookId + '.' + unitKey;
  window.GC_TIP_TITLE = 'Słówka do tej misji';
  window.GC_DONE_TITLE = 'Miasto słówek należy do Ciebie!';

  // ── lektor: pytanie (jak w Inwazji Obcych) + wymowa słowa po odpowiedzi ──
  let voices = [];
  const loadVoices = () => { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  function pickVoice(l) {
    const base = l.slice(0, 2);
    return voices.find(v => /Online.*Natural/i.test(v.name) && v.lang && v.lang.toLowerCase().startsWith(l.toLowerCase())) ||
      (l === 'en-GB' && voices.find(v => v.name === 'Google UK English Female')) ||
      (l === 'pl-PL' && voices.find(v => v.name === 'Google polski')) ||
      voices.find(v => v.lang === l) || voices.find(v => v.lang && v.lang.startsWith(base)) || null;
  }
  function speak(item) {
    if (!item || !item.text || window.GC_MUTED || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(item.text);
      u.lang = item.lang; u.rate = 0.95;
      const v = pickVoice(item.lang); if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  window.GC_onQuestion = q => speak(q.gcPrompt);
  window.GC_onAnswer = q => speak(q.gcSay);

  // ── ekran startowy i pomoc ──
  const unitLabel = unitKey === 'all' ? 'cały podręcznik' : (unitEntries[0][1].name || unitKey);
  document.title = 'Grammar City — słówka: ' + (book.name || bookId) + ' · ' + unitLabel;
  const tag = document.querySelector('#start-ov .tagline');
  if (tag) tag.innerHTML = 'Tryb słówek · <b>' + esc(book.name || bookId) + '</b> · ' + esc(unitLabel) + '. ' +
    misji(n) + ' ze słówek (' + pool.length + ') i egzamin w ratuszu. Każda misja to quiz: wybierz poprawne tłumaczenie PL ⇄ ' + LANG_TAG + '.';
  const strip = document.querySelector('#start-ov .levels-strip');
  if (strip) {
    strip.innerHTML = TIERS.slice(0, 4).map((t, ti) => {
      const c = chunks.filter((_, i) => tierOf(i) === ti).length;
      return c ? '<span class="chip" style="background:' + t.color + '">' + esc(t.name) + ' · ' + misji(c) + '</span>' : '';
    }).join('') + '<span class="chip" style="background:' + COLORS[4] + '">Egzamin w ratuszu</span>';
  }
  const help = document.querySelector('#help-ov .story');
  if (help) help.innerHTML = 'Chodź po mieście lub „pożycz” samochód i jedź do znaczników misji (świecące kolumny światła). Każda misja to quiz ze słówek z rozdziału: wybierz poprawne tłumaczenie z 4 odpowiedzi — po polsku albo po ' + esc(LANG_PL) + '. Lektor czyta pytanie i wymawia słowo po odpowiedzi (<kbd>N</kbd> wycisza). Zalicz przynajmniej <b>70%</b>, żeby dostać pieniądze. Kolejne etapy odblokowują się, gdy ukończysz wystarczająco dużo misji. Na koniec czeka egzamin w ratuszu.';
  addBackLink();
})();
