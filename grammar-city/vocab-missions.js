/* Grammar City — TRYB SŁÓWEK (Sowie Fiszki).
   Uruchamiany z rozdziału w app.html: grammar-city/?book=<id>&unit=<klucz|all>.
   Podmienia window.MISSIONS / window.TIERS (z questions.js) na misje-quizy
   ze słówek rozdziału: wybór 1 z 4, PL→obcy i obcy→PL, zbliżone dystraktory
   (distractors.js) — jak w Inwazji Obcych. Miasto, budynki i NPC zostają.
   Dodatkowo: zestawy zadań gramatycznych tego rozdziału z bazy (grammar_sets,
   migracja #73 — tworzone w aplikacji w „🧠 Utrwalaj gramatykę”) stają się
   misjami gramatycznymi (A/B/C → wybór, luki → wpisywanie). Pobierane
   asynchronicznie — game.js czeka na window.GC_MISSIONS_READY przed budową miasta.
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
  // Kontekst rozmów z mieszkańcami (AI, ai-chat.js): słówka i gramatyka tego rozdziału.
  const g = +(book.grade || 0);
  window.GC_CHAT_CTX = {
    lang, level: book.schoolType === 'secondary' ? 'B1–B2' : g && g <= 3 ? 'A1 (młodsze dzieci)' : g >= 7 ? 'A2–B1' : 'A1–A2',
    unitName: (unitKey === 'all' ? 'cały podręcznik' : (unitEntries[0][1].name || unitKey)) + ' (' + (book.name || bookId) + ')',
    words: shuffle(pool.slice()).slice(0, 40).map(([pl, t]) => ({ pl, t })), grammar: [],
  };

  const GRAMMAR = (window.MISSIONS || []).filter(m => !m.final);
  const FINAL_SLOT = (window.MISSIONS || []).find(m => m.final) || {};
  const MAX = Math.min(18, GRAMMAR.length);   // tyle miejsc misji jest w mieście
  const MAX_GRAMMAR = 6;                       // najwyżej tyle misji gramatycznych z zestawów
  const COLORS = ['#45d483', '#4fb3ff', '#f2b632', '#ff7a4d', '#c77dff'];

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
  // Zadania gramatyczne z bazy → pytania silnika (A/B/C = wybór, luka = wpisywanie).
  const fullSentence = (q, ans) => { const s = String(q); return /___\s*\([^)]*\)/.test(s) ? s.replace(/___\s*\([^)]*\)/, ans) : s.replace('___', ans).replace(/\s*\([^)]*\)\s*$/, ''); };
  function grammarQuestion(it) {
    if (it.type === 'abc' && Array.isArray(it.o) && it.o.length >= 2) {
      return { t: 'c', q: it.q, o: it.o.slice(), a: +it.a || 0, e: it.e || '', gcSay: { text: fullSentence(it.q, it.o[+it.a || 0]), lang: TTS_LANG } };
    }
    if (it.type === 'gap' && Array.isArray(it.a) && it.a.length) {
      return { t: 't', q: it.q, a: it.a.slice(), e: it.e || '', gcSay: { text: fullSentence(it.q, it.a[0]), lang: TTS_LANG } };
    }
    return null;
  }

  const npcName = npc => String(npc || '').split(',')[0].trim() || 'Mieszkaniec';
  const tipHtml = words => '<div style="display:grid;grid-template-columns:auto 1fr;gap:3px 14px;margin-top:4px">' +
    words.map(([pl, en]) => '<b>' + esc(en) + '</b><span>' + esc(pl) + '</span>').join('') + '</div>';
  const grammarTip = (set, qs) => 'Temat: <b>' + esc(set.topic) + '</b>. Zadania: wybór A/B/C i luki do uzupełnienia poprawną formą.' +
    (qs.length ? '<div style="margin-top:6px">Przykład: <i>' + esc(fullSentence(qs[0].q, qs[0].t === 'c' ? qs[0].o[qs[0].a] : qs[0].a[0])) + '</i></div>' : '');

  // Buduje misje (słówka + gramatyka) i podmienia zawartość window.MISSIONS / window.TIERS w miejscu —
  // game.js trzyma referencje do tych tablic.
  function build(gsets) {
    if (window.GC_CHAT_CTX) window.GC_CHAT_CTX.grammar = (gsets || []).map(s => s.topic).filter(Boolean).slice(0, 6);
    const gram = (gsets || []).map(s => ({ set: s, qs: (Array.isArray(s.items) ? s.items : []).map(grammarQuestion).filter(Boolean) }))
      .filter(g => g.qs.length >= 3).slice(0, MAX_GRAMMAR);
    const maxVocab = Math.max(1, MAX - gram.length);
    let chunks = [];   // [{ label, words }]
    if (unitKey === 'all' && groups.length > 1) {
      // cały podręcznik: misja = rozdział (gdy rozdziałów za dużo — łączymy sąsiednie)
      const per = Math.ceil(groups.length / maxVocab);
      for (let i = 0; i < groups.length; i += per) {
        const part = groups.slice(i, i + per);
        chunks.push({ label: part.map(g => g.name).join(' + '), words: part.flatMap(g => g.words) });
      }
    } else {
      // jeden rozdział: ~8 słówek na misję, równe porcje
      const words = groups.flatMap(g => g.words);
      const k = Math.max(1, Math.min(maxVocab, Math.round(words.length / 8)));
      for (let i = 0; i < k; i++) {
        const a = Math.round(i * words.length / k), b = Math.round((i + 1) * words.length / k);
        chunks.push({ label: 'Słówka ' + (a + 1) + '–' + b, words: words.slice(a, b) });
      }
    }
    // ── etapy (odblokowywanie) — 4 etapy + finał (TIERS[4] = kolor ratusza) ──
    const n = chunks.length + gram.length;
    const tierOf = i => Math.min(3, Math.floor(i * 4 / n));
    const countBelow = t => Array.from({ length: n }, (_, i) => i).filter(i => tierOf(i) < t).length;
    const TIERS = [0, 1, 2, 3].map(t => ({ name: 'Etap ' + (t + 1), need: Math.ceil(countBelow(t) * 0.6), color: COLORS[t] }));
    TIERS.push({ name: 'FINAŁ', need: n, color: COLORS[4] });

    const slotFields = (m, slot) => { ['block', 'lot', 'park'].forEach(k => { if (slot[k]) m[k] = slot[k]; }); return m; };
    const missions = chunks.map((c, i) => {
      const slot = GRAMMAR[i];
      const who = npcName(slot.npc);
      const m = slotFields({
        id: 'v_' + bookId + '_' + unitKey + '_' + i,
        place: slot.place, short: slot.short, npc: slot.npc,
        topic: c.label + ' · ' + slowek(c.words.length),
        level: TIERS[tierOf(i)].name, tier: tierOf(i),
        story: "Hi, I'm " + who + "! I've got a word problem. Show me you know these " + c.words.length + ' words and I will pay you.',
        storyPL: 'Cześć, tu ' + who + '! Mam kłopot ze słówkami. Pokaż, że znasz te ' + slowek(c.words.length) + ', a dostaniesz zapłatę.',
        tip: tipHtml(c.words),
        questions: [],
      }, slot);
      m.questions = questionsFor(c.words).map(q => Object.assign(q, { src: m }));
      return m;
    });
    gram.forEach((g, gi) => {
      const i = chunks.length + gi, slot = GRAMMAR[i];
      const who = npcName(slot.npc);
      const m = slotFields({
        id: 'g_' + g.set.id,
        place: slot.place, short: slot.short, npc: slot.npc,
        topic: '🧠 ' + g.set.topic + ' · ' + g.qs.length + ' ' + plural(g.qs.length, 'zadanie', 'zadania', 'zadań'),
        level: TIERS[tierOf(i)].name, tier: tierOf(i),
        story: "Hi, I'm " + who + "! Let's practise " + g.set.topic + ' together. Get the grammar right and I will pay you.',
        storyPL: 'Cześć, tu ' + who + '! Poćwiczmy razem: ' + g.set.topic + '. Wykaż się gramatyką, a dostaniesz zapłatę.',
        tip: grammarTip(g.set, g.qs),
        questions: [],
      }, slot);
      m.questions = g.qs.map(q => Object.assign(q, { src: m }));
      missions.push(m);
    });

    const finalM = {
      id: 'v_' + bookId + '_' + unitKey + '_final',
      place: FINAL_SLOT.place || 'City Hall', short: FINAL_SLOT.short || 'HALL', npc: FINAL_SLOT.npc || 'Mayor Johnson, burmistrz',
      cityHall: FINAL_SLOT.cityHall || [3, 3], final: true,
      topic: gram.length ? 'Egzamin końcowy — słówka i gramatyka' : 'Egzamin końcowy — wszystkie słówka', level: 'FINAŁ', tier: 4,
      story: "So you're the word expert everybody talks about! One last test with questions from every mission. Pass it and the city is yours.",
      storyPL: 'Burmistrz sprawdzi pytania ze wszystkich misji. Zdaj egzamin, a miasto należy do Ciebie.',
      tip: 'Egzamin losuje <b>15 pytań</b> ze wszystkich misji (' + slowek(pool.length) + (gram.length ? ' i zadania gramatyczne' : '') + '). Przejrzyj ściągi w misjach, zanim zaczniesz.',
      questions: missions.flatMap(m => m.questions),
    };

    // podmiana w miejscu (pierwsze wywołanie — nowe tablice przed załadowaniem game.js)
    const all = missions.concat([finalM]);
    if (Array.isArray(window.MISSIONS) && window.MISSIONS.__vocab) { window.MISSIONS.length = 0; all.forEach(m => window.MISSIONS.push(m)); }
    else { window.MISSIONS = all; window.MISSIONS.__vocab = true; }
    if (Array.isArray(window.TIERS) && window.TIERS.__vocab) { window.TIERS.length = 0; TIERS.forEach(t => window.TIERS.push(t)); }
    else { window.TIERS = TIERS; window.TIERS.__vocab = true; }

    // ── ekran startowy ──
    const unitLabel = unitKey === 'all' ? 'cały podręcznik' : (unitEntries[0][1].name || unitKey);
    document.title = 'Grammar City — słówka: ' + (book.name || bookId) + ' · ' + unitLabel;
    const tag = document.querySelector('#start-ov .tagline');
    if (tag) tag.innerHTML = 'Tryb słówek · <b>' + esc(book.name || bookId) + '</b> · ' + esc(unitLabel) + '. ' +
      misji(chunks.length) + ' ze słówek (' + pool.length + ')' + (gram.length ? ', ' + misji(gram.length) + ' z gramatyki 🧠' : '') +
      ' i egzamin w ratuszu. Misja słówek to quiz: wybierz poprawne tłumaczenie PL ⇄ ' + LANG_TAG + '.';
    const strip = document.querySelector('#start-ov .levels-strip');
    if (strip) {
      strip.innerHTML = TIERS.slice(0, 4).map((t, ti) => {
        const c = Array.from({ length: n }, (_, i) => i).filter(i => tierOf(i) === ti).length;
        return c ? '<span class="chip" style="background:' + t.color + '">' + esc(t.name) + ' · ' + misji(c) + '</span>' : '';
      }).join('') + '<span class="chip" style="background:' + COLORS[4] + '">Egzamin w ratuszu</span>';
    }
  }
  build([]);

  // Zestawy gramatyczne z bazy (publiczne — także dla gościa). Klient Supabase ładuje się po tym pliku.
  window.GC_MISSIONS_READY = (async () => {
    for (let i = 0; i < 60 && !(window.supabase && typeof window.supabase.from === 'function'); i++) await new Promise(r => setTimeout(r, 50));
    const sb = window.supabase;
    if (!sb || typeof sb.from !== 'function') return;
    try {
      let q = sb.from('grammar_sets').select('id, unit_key, topic, items, created_at').eq('book_id', bookId).order('created_at', { ascending: true });
      if (unitKey !== 'all') q = q.eq('unit_key', unitKey);
      const { data, error } = await q;
      if (!error && data && data.length) build(data);
    } catch (e) { /* bez migracji #73 / offline — same słówka */ }
  })();

  window.GC_SAVE_KEY = 'grammarCity.vocab.' + bookId + '.' + unitKey;
  window.GC_TIP_TITLE = 'Ściąga do tej misji';
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

  // ── pomoc ──
  const help = document.querySelector('#help-ov .story');
  if (help) help.innerHTML = 'Chodź po mieście lub „pożycz” samochód i jedź do znaczników misji (świecące kolumny światła). Misja słówek to quiz: wybierz poprawne tłumaczenie z 4 odpowiedzi — po polsku albo po ' + esc(LANG_PL) + '. Misje 🧠 to gramatyka z rozdziału: wybór A/B/C i luki do uzupełnienia. Lektor czyta pytanie i wymawia odpowiedź (<kbd>N</kbd> wycisza). Zalicz przynajmniej <b>70%</b>, żeby dostać pieniądze. Kolejne etapy odblokowują się, gdy ukończysz wystarczająco dużo misji. Na koniec czeka egzamin w ratuszu.';
  addBackLink();
})();
