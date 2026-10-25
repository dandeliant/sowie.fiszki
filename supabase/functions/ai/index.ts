// ═══════════════════════════════════════════════════════════════
//  Sowie Fiszki — Supabase Edge Function „ai” (OpenAI)
//
//  Klucz OpenAI jest TYLKO tutaj (sekret OPENAI_API_KEY) — nigdy w przeglądarce.
//  Każde wywołanie: zalogowany użytkownik (JWT) → rola z profiles → dzienny
//  limit (ai_usage_bump, migracja #73) → OpenAI → walidacja odpowiedzi.
//  Do AI nie wysyłamy loginów ani imion — tylko słówka, temat i zdanie ucznia.
//
//  Akcje (body: { action, ... }):
//    sentences       (admin/nauczyciel) — zdania przykładowe PL + obce dla listy słówek
//    wordlist        (admin/nauczyciel) — nowa lista słówek na temat (z tłumaczeniem, emoji, zdaniami)
//    grammar         (admin/nauczyciel) — zadania gramatyczne A/B/C i luki ze słownictwem rozdziałów
//    check_sentence  (każdy zalogowany)  — sprawdzenie zdania ucznia ze słówkiem (z moderacją)
//    story           (admin/nauczyciel) — czytanka: opowiadanie ze słówkami rozdziału + pytania A/B/C (bez tłumaczenia)
//    chat            (każdy zalogowany)  — rozmowa po angielsku z pupilem / Sową / postacią z Grammar City,
//                                          tylko o słówkach i gramatyce rozdziału (z moderacją wypowiedzi ucznia)
//
//  Sekrety (Supabase → Edge Functions → Secrets):
//    OPENAI_API_KEY  — wymagany
//    OPENAI_MODEL    — opcjonalny (domyślnie gpt-4o-mini)
//  SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY Supabase podaje sam.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
// Dzienne limity wywołań na konto: [staff, uczeń/opiekun]. 0 = brak dostępu.
const LIMITS: Record<string, [number, number]> = {
  sentences: [150, 0],
  wordlist: [40, 0],
  grammar: [40, 0],
  check_sentence: [200, 40],
  story: [40, 0],
  chat: [200, 50],
};
const LANGS: Record<string, string> = { en: 'British English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', ru: 'Russian' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ error: code, message }, status);
const str = (v: unknown, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Zużycie tokenów jednego wywołania (zapisywane w ai_usage — migracja #79, panel kosztów AI).
type Usage = { in: number; out: number };
const addUsage = (acc: Usage | undefined, j: any) => { if (acc && j?.usage) { acc.in += Number(j.usage.prompt_tokens) || 0; acc.out += Number(j.usage.completion_tokens) || 0; } };
async function chatJSON(acc: Usage, system: string, user: string, maxTokens = 4000): Promise<any> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  addUsage(acc, j);
  return JSON.parse(j?.choices?.[0]?.message?.content || '{}');
}
// Moderacja OpenAI: flagged = treść niebezpieczna (wulgaryzmy, przemoc, treści dla dorosłych…),
// cats = kategorie (zapisywane w ai_chat_logs — migracja #80).
type Mod = { flagged: boolean; cats: string[] };
async function moderate(text: string): Promise<Mod> {
  try {
    const r = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!r.ok) return { flagged: false, cats: [] };
    const res = (await r.json())?.results?.[0] || {};
    const cats = Object.entries(res.categories || {}).filter(([, v]) => v).map(([k]) => k);
    return { flagged: !!res.flagged, cats };
  } catch { return { flagged: false, cats: [] }; }
}

const RULES = 'You write learning materials for Polish school children learning a foreign language. ' +
  'Content must be child-friendly, positive and neutral (no violence, alcohol, romance, politics, religion, brands or real people). ' +
  'Polish text must be correct and use Polish diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż). Answer ONLY with valid JSON.';

// ── sentences ──
async function doSentences(b: any, acc: Usage) {
  const lang = LANGS[b.lang] || LANGS.en;
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 40)
    .map((w: any) => ({ pl: str(w.pl, 80), t: str(w.t, 80) })).filter((w: any) => w.pl && w.t);
  if (!words.length) throw new Error('Brak słówek.');
  const level = str(b.level, 40) || 'A1–A2';
  const out = await chatJSON(acc, RULES,
    `For each word write ONE short, natural example sentence in ${lang} (level ${level}, 4–10 words) that uses the word exactly as given, ` +
    `and its Polish translation that uses the Polish word. Return {"items":[{"pl":"<polish word as given>","sentPl":"…","sentT":"…"}]} in the same order.\n` +
    `Words (Polish → ${lang}):\n` + words.map((w: any) => `${w.pl} → ${w.t}`).join('\n'));
  const items = (Array.isArray(out.items) ? out.items : []).map((x: any) => ({ pl: str(x.pl, 80), sentPl: str(x.sentPl, 200), sentT: str(x.sentT, 200) }))
    .filter((x: any) => x.pl && x.sentPl && x.sentT);
  return { items };
}

// ── wordlist ──
async function doWordlist(b: any, acc: Usage) {
  const lang = LANGS[b.lang] || LANGS.en;
  const topic = str(b.topic, 120); if (!topic) throw new Error('Podaj temat.');
  const count = Math.max(5, Math.min(40, Number(b.count) || 20));
  const level = str(b.level, 20) || 'A1';
  const grade = str(b.grade, 40);
  const notes = str(b.notes, 300);
  const out = await chatJSON(acc, RULES,
    `Create a vocabulary list of exactly ${count} useful words/phrases on the topic "${topic}" for Polish students` +
    (grade ? ` (${grade})` : '') + `, CEFR level ${level}, target language ${lang}.` + (notes ? ` Teacher's notes: ${notes}.` : '') +
    ` Use the base/dictionary form, nouns without articles unless natural. Avoid duplicates. For each: Polish meaning, ${lang} word, ` +
    `one fitting emoji (or empty string), a short example sentence in ${lang} (4–10 words) and its Polish translation. ` +
    `Return {"words":[{"pl":"…","t":"…","emoji":"…","sentT":"…","sentPl":"…"}]}`);
  const seen = new Set<string>();
  const words = (Array.isArray(out.words) ? out.words : []).map((x: any) => ({
    pl: str(x.pl, 80), t: str(x.t, 80), emoji: str(x.emoji, 8), sentT: str(x.sentT, 200), sentPl: str(x.sentPl, 200),
  })).filter((x: any) => { const k = x.pl.toLowerCase() + '|' + x.t.toLowerCase(); if (!x.pl || !x.t || seen.has(k)) return false; seen.add(k); return true; });
  return { words };
}

// ── grammar ──
async function doGrammar(b: any, acc: Usage) {
  const lang = LANGS[b.lang] || LANGS.en;
  const topic = str(b.topic, 120); if (!topic) throw new Error('Podaj temat gramatyczny.');
  const count = Math.max(5, Math.min(30, Number(b.count) || 15));
  const types: string[] = (Array.isArray(b.types) ? b.types : ['abc', 'gap']).filter((t: string) => t === 'abc' || t === 'gap');
  if (!types.length) types.push('abc');
  const level = str(b.level, 40) || 'A1–A2';
  const notes = str(b.notes, 300);
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 90)
    .map((w: any) => `${str(w.t, 60)} (${str(w.pl, 60)})`).filter((s: string) => s.length > 3);
  const out = await chatJSON(acc, RULES,
    `Create exactly ${count} grammar exercises on "${topic}" in ${lang} for Polish students, level ${level}.` +
    (notes ? ` Teacher's notes: ${notes}.` : '') +
    ` Use mainly this vocabulary from the textbook units (target word (Polish)): ${words.join(', ') || '(any simple everyday words)'}.` +
    ` Exercise types to use: ${types.map(t => t === 'abc' ? '"abc" = multiple choice with exactly 3 options A/B/C, one correct' : '"gap" = gap fill: sentence with ___ and the base form of the verb (or a hint) in brackets, e.g. "She ___ (play) tennis."').join('; ')}.` +
    ` Mix the types evenly. Every sentence must contain exactly one ___ gap. Exactly one answer must be correct; for "gap" list all acceptable answers (e.g. contracted and full forms).` +
    ` For each exercise add a short explanation in Polish (1 sentence) why the answer is correct.` +
    ` Return {"items":[{"type":"abc","q":"…___…","o":["…","…","…"],"a":0,"e":"…"},{"type":"gap","q":"…___… (verb)","a":["…"],"e":"…"}]}`, 6000);
  const items = (Array.isArray(out.items) ? out.items : []).map((x: any) => {
    const q = str(x.q, 240), e = str(x.e, 300);
    if (!q.includes('___')) return null;
    if (x.type === 'abc') {
      const o = (Array.isArray(x.o) ? x.o : []).map((s: unknown) => str(s, 80)).filter(Boolean).slice(0, 3);
      const a = Number(x.a);
      if (o.length !== 3 || !(a >= 0 && a <= 2) || new Set(o.map((s: string) => s.toLowerCase())).size !== 3) return null;
      return { type: 'abc', q, o, a, e };
    }
    if (x.type === 'gap') {
      const a = (Array.isArray(x.a) ? x.a : [x.a]).map((s: unknown) => str(s, 80)).filter(Boolean).slice(0, 5);
      return a.length ? { type: 'gap', q, a, e } : null;
    }
    return null;
  }).filter(Boolean);
  return { items };
}

// ── story (czytanka) ──
const STORY_LEN: Record<string, string> = { short: '80–100', medium: '130–160', long: '220–260' };
async function doStory(b: any, acc: Usage) {
  const lang = LANGS[b.lang] || LANGS.en;
  const len = STORY_LEN[str(b.length, 10)] || STORY_LEN.short;
  const level = str(b.level, 40) || 'A1–A2';
  const n = Math.max(3, Math.min(5, Number(b.questions) || 4));
  const topic = str(b.topic, 120), grammar = str(b.grammar, 80);
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 30)
    .map((w: any) => `${str(w.t, 60)} (${str(w.pl, 60)})`).filter((s: string) => s.length > 3);
  if (words.length < 3) throw new Error('Za mało słówek w rozdziale.');
  const out = await chatJSON(acc, RULES,
    `Write a short, engaging story in ${lang} for Polish children, CEFR level ${level}, length ${len} words.` +
    (topic ? ` Topic: ${topic}.` : ' Choose a fun everyday topic that fits the words.') +
    (grammar ? ` Use mainly this grammar: ${grammar}.` : '') +
    ` Use as many of these words as naturally possible (at least 8 of them, in the given form or a correct grammatical form): ${words.join(', ')}.` +
    ` Use short, clear sentences and only simple vocabulary besides the given words. Give it a short title in ${lang}.` +
    ` Then write exactly ${n} reading comprehension questions in ${lang} about the story, each with exactly 3 options and exactly one correct answer that can be found in the text.` +
    ` Return {"title":"…","text":"…","questions":[{"q":"…","o":["…","…","…"],"a":0}]}`, 4000);
  const questions = (Array.isArray(out.questions) ? out.questions : []).map((x: any) => {
    const q = str(x.q, 240), o = (Array.isArray(x.o) ? x.o : []).map((s: unknown) => str(s, 120)).filter(Boolean).slice(0, 3), a = Number(x.a);
    if (!q || o.length !== 3 || !(a >= 0 && a <= 2) || new Set(o.map((s: string) => s.toLowerCase())).size !== 3) return null;
    return { q, o, a };
  }).filter(Boolean).slice(0, 5);
  const clean = (v: unknown, max: number) => String(v ?? '').split(String.fromCharCode(13)).join('').trim().slice(0, max);
  const text = clean(out.text, 4000);
  return { title: str(out.title, 120), text, questions };
}

// ── chat (rozmowa) ──
type Turn = { role: 'user' | 'assistant'; content: string };
async function doChat(b: any, acc: Usage) {
  const lang = LANGS[b.lang] || LANGS.en;
  const level = str(b.level, 40) || 'A1–A2';
  const name = str(b.name, 40) || 'Owl';
  const persona = b.persona === 'npc'
    ? `You are ${name}, a friendly resident of Grammar City, a city in an English-learning game for children (your role, in Polish: ${str(b.role, 60) || 'mieszkaniec'}).`
    : b.persona === 'pet'
      ? `You are ${name}, the student's cute, playful virtual pet (species, in Polish: ${str(b.species, 40) || 'zwierzątko'}) in the learning app "Sowie Fiszki".`
      : 'You are Fiszka, a wise, friendly owl who teaches in the learning app "Sowie Fiszki".';
  const unit = str(b.unitName, 120);
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 40)
    .map((w: any) => `${str(w.t, 60)} (${str(w.pl, 60)})`).filter((s: string) => s.length > 3);
  const grammar = (Array.isArray(b.grammar) ? b.grammar : []).slice(0, 6).map((g: unknown) => str(g, 80)).filter(Boolean);
  const msg = str(b.message, 300);
  if (msg) { const m = await moderate(msg); if (m.flagged) return { blocked: true, _cats: m.cats }; }
  const system = RULES.replace('Answer ONLY with valid JSON.', '') + ' ' + persona +
    ` You chat with a Polish child who is learning ${lang} at level ${level}.` +
    (unit ? ` Topic of the conversation: the textbook unit "${unit}".` : ' Topic: simple everyday life in the city (shops, food, directions, weather, hobbies).') +
    (words.length ? ` Unit vocabulary (target word (Polish)): ${words.join(', ')}.` : '') +
    (grammar.length ? ` Grammar of this unit: ${grammar.join('; ')}.` : '') +
    ` Rules: (1) "reply" ONLY in ${lang}, very simple for level ${level}: 1–3 short sentences, max 35 words.` +
    ` (2) Stay on the unit topic: use the unit vocabulary and grammar; if the student goes off topic, kindly bring the talk back.` +
    ` (3) Be warm, patient and encouraging, you love teaching; praise good answers specifically (e.g. "Great sentence!") and set "praise" true.` +
    ` (4) Usually end with ONE simple question about the topic that uses unit words.` +
    ` (5) If the student writes in Polish or mixes languages, do not answer in Polish: kindly ask them to try in ${lang} and give a short ${lang} sentence they can use.` +
    ` (6) If the student's ${lang} has a mistake, fill "correction" (wrong fragment, corrected fragment, 1 short friendly explanation in Polish). Ignore capital letters, punctuation and typos in names.` +
    ` (7) About every third turn ask the student to say a short useful phrase aloud (2–8 words, in ${lang}, with unit words): put it in "sayThis" and ask for it in "reply" (e.g. "Can you say: …?"). Otherwise "sayThis" is "".` +
    ` (8) If the message says the student repeated the phrase aloud, praise it and continue.` +
    ` (9) Never ask for personal data (surname, address, school name, phone, photos, passwords). No violence, romance, alcohol, brands or politics.` +
    ` Answer ONLY with JSON: {"reply":"…","replyPl":"Polish translation of reply","correction":null or {"wrong":"…","right":"…","why":"…"},"praise":true|false,"sayThis":""}`;
  const history: Turn[] = (Array.isArray(b.history) ? b.history : []).slice(-12)
    .map((t: any) => ({ role: (t.role === 'assistant' ? 'assistant' : 'user') as Turn['role'], content: str(t.content, 400) }))
    .filter((t: Turn) => t.content);
  let user = msg;
  if (!msg) user = '(The student has just opened the chat. Greet them by your name, say what we will talk about, and ask the first simple question.)';
  else if (b.repeated) user = `(The student repeated aloud the phrase "${str(b.target, 120)}" and the speech recognizer heard: "${msg}".)`;
  else if (b.spoken) user = msg + ' (said aloud — speech recognition text)';
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_completion_tokens: 600, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  addUsage(acc, j);
  const out = JSON.parse(j?.choices?.[0]?.message?.content || '{}');
  const c = out.correction && typeof out.correction === 'object' ? out.correction : null;
  return {
    reply: str(out.reply, 400), replyPl: str(out.replyPl, 500), praise: !!out.praise, sayThis: str(out.sayThis, 120),
    correction: c && str(c.right, 200) ? { wrong: str(c.wrong, 200), right: str(c.right, 200), why: str(c.why, 300) } : null,
  };
}

// ── check_sentence ──
async function doCheck(b: any, acc: Usage) {
  const lang = LANGS[b.lang] || LANGS.en;
  const word = str(b.word, 80), wordPl = str(b.wordPl, 80), sentence = str(b.sentence, 240);
  if (!word || !sentence) throw new Error('Brak słówka albo zdania.');
  { const m = await moderate(sentence); if (m.flagged) return { blocked: true, _cats: m.cats }; }
  const out = await chatJSON(acc, RULES + ' You are a kind, encouraging teacher of a child.',
    `The student had to write their own sentence in ${lang} using the word "${word}" (Polish: "${wordPl}").\n` +
    `Student's sentence: """${sentence}"""\n` +
    `Check it. Ignore missing final punctuation and capital letters. Return {"ok":true|false (grammatically correct and natural),` +
    ` "usesWord":true|false (uses the word or its correct form), "corrected":"corrected sentence (same as student's if ok)",` +
    ` "explanation":"short, friendly explanation in Polish of the mistakes (max 2 sentences) or praise if ok",` +
    ` "translation":"Polish translation of the corrected sentence"}`, 800);
  return {
    ok: !!out.ok, usesWord: !!out.usesWord,
    corrected: str(out.corrected, 260), explanation: str(out.explanation, 400), translation: str(out.translation, 260),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('METHOD', 'Tylko POST.', 405);
  if (!OPENAI_KEY) return fail('AI_NOT_CONFIGURED', 'AI nie jest jeszcze skonfigurowane (brak klucza OpenAI w Supabase).', 503);
  try {
    const auth = req.headers.get('Authorization') || '';
    const userClient = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return fail('NOT_LOGGED_IN', 'Zaloguj się, żeby korzystać z AI.', 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const lim = LIMITS[action];
    if (!lim) return fail('BAD_ACTION', 'Nieznana akcja.');

    const svc = createClient(SB_URL, SB_SERVICE);
    const { data: prof } = await svc.from('profiles').select('is_admin, is_teacher').eq('id', user.id).maybeSingle();
    const staff = !!(prof && (prof.is_admin || prof.is_teacher));
    // Ustawienia admina (migracja #79): wyłącznik AI i limity z bazy; bez migracji — wartości domyślne z kodu.
    const roleKey = staff ? 'staff' : 'student';
    let max = staff ? lim[0] : lim[1];
    try {
      const [{ data: sets }, { data: lims }] = await Promise.all([
        svc.from('ai_settings').select('key, value').eq('key', 'enabled'),
        svc.from('ai_limits').select('role, max').eq('action', action),
      ]);
      const en = sets && sets[0] && sets[0].value;
      if (en && en[roleKey] === false) return fail('AI_OFF', 'Funkcje AI są chwilowo wyłączone przez administratora.', 403);
      const row = (lims || []).find((x: any) => x.role === roleKey);
      if (row && Number.isFinite(Number(row.max))) max = Number(row.max);
    } catch { /* bez migracji #79 */ }
    if (!max) return fail('FORBIDDEN', (staff || lim[1]) ? 'Ta funkcja AI jest chwilowo wyłączona przez administratora.' : 'Ta funkcja jest dostępna dla nauczyciela i administratora.', 403);
    const { data: used, error: limErr } = await svc.rpc('ai_usage_bump', { p_user: user.id, p_action: action, p_max: max });
    if (limErr) return fail('NO_MIGRATION', 'Uruchom migrację #73 (ai-features.sql) w Supabase.', 500);
    if (used === -1) return fail('LIMIT', `Dzienny limit AI dla tej funkcji (${max}) został wykorzystany — spróbuj jutro.`, 429);

    const acc: Usage = { in: 0, out: 0 };
    const result = action === 'sentences' ? await doSentences(body, acc)
      : action === 'wordlist' ? await doWordlist(body, acc)
      : action === 'grammar' ? await doGrammar(body, acc)
      : action === 'story' ? await doStory(body, acc)
      : action === 'chat' ? await doChat(body, acc)
      : await doCheck(body, acc);
    if (acc.in || acc.out) {
      try { await svc.rpc('ai_usage_tokens', { p_user: user.id, p_action: action, p_in: acc.in, p_out: acc.out }); } catch { /* bez migracji #79 */ }
    }
    // Zapis rozmowy / zdania ucznia na 7 dni — tylko do wglądu admina (bezpieczeństwo, migracja #80).
    const r: any = result;
    const said = action === 'chat' ? str(body.message, 1000) : action === 'check_sentence' ? str(body.sentence, 1000) : '';
    if (said) {
      try {
        await svc.rpc('ai_chat_log_add', {
          p_user: user.id, p_kind: action === 'chat' ? 'chat' : 'sentence',
          p_partner: action === 'chat' ? str(body.name, 80) : null,
          p_topic: action === 'chat' ? str(body.unitName, 160) : str(body.word, 160),
          p_message: said, p_reply: r.blocked ? null : (r.reply || r.corrected || null),
          p_flagged: !!r.blocked, p_categories: r._cats && r._cats.length ? r._cats : null,
        });
      } catch { /* bez migracji #80 */ }
    }
    delete r._cats;
    return json({ ...r, used, max });
  } catch (e) {
    console.error('[ai]', e);
    return fail('AI_ERROR', 'Błąd AI: ' + String((e as Error)?.message || e).slice(0, 300), 500);
  }
});
