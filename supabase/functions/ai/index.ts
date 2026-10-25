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
//    story           (admin/nauczyciel) — czytanka: opowiadanie ze słówkami rozdziału + tłumaczenie + pytania A/B/C
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
};
const LANGS: Record<string, string> = { en: 'British English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', ru: 'Russian' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ error: code, message }, status);
const str = (v: unknown, max = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function chatJSON(system: string, user: string, maxTokens = 4000): Promise<any> {
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
  return JSON.parse(j?.choices?.[0]?.message?.content || '{}');
}
// true = treść niebezpieczna (wulgaryzmy, przemoc, treści dla dorosłych…)
async function flagged(text: string): Promise<boolean> {
  try {
    const r = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!r.ok) return false;
    const j = await r.json();
    return !!j?.results?.[0]?.flagged;
  } catch { return false; }
}

const RULES = 'You write learning materials for Polish school children learning a foreign language. ' +
  'Content must be child-friendly, positive and neutral (no violence, alcohol, romance, politics, religion, brands or real people). ' +
  'Polish text must be correct and use Polish diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż). Answer ONLY with valid JSON.';

// ── sentences ──
async function doSentences(b: any) {
  const lang = LANGS[b.lang] || LANGS.en;
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 40)
    .map((w: any) => ({ pl: str(w.pl, 80), t: str(w.t, 80) })).filter((w: any) => w.pl && w.t);
  if (!words.length) throw new Error('Brak słówek.');
  const level = str(b.level, 40) || 'A1–A2';
  const out = await chatJSON(RULES,
    `For each word write ONE short, natural example sentence in ${lang} (level ${level}, 4–10 words) that uses the word exactly as given, ` +
    `and its Polish translation that uses the Polish word. Return {"items":[{"pl":"<polish word as given>","sentPl":"…","sentT":"…"}]} in the same order.\n` +
    `Words (Polish → ${lang}):\n` + words.map((w: any) => `${w.pl} → ${w.t}`).join('\n'));
  const items = (Array.isArray(out.items) ? out.items : []).map((x: any) => ({ pl: str(x.pl, 80), sentPl: str(x.sentPl, 200), sentT: str(x.sentT, 200) }))
    .filter((x: any) => x.pl && x.sentPl && x.sentT);
  return { items };
}

// ── wordlist ──
async function doWordlist(b: any) {
  const lang = LANGS[b.lang] || LANGS.en;
  const topic = str(b.topic, 120); if (!topic) throw new Error('Podaj temat.');
  const count = Math.max(5, Math.min(40, Number(b.count) || 20));
  const level = str(b.level, 20) || 'A1';
  const grade = str(b.grade, 40);
  const notes = str(b.notes, 300);
  const out = await chatJSON(RULES,
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
async function doGrammar(b: any) {
  const lang = LANGS[b.lang] || LANGS.en;
  const topic = str(b.topic, 120); if (!topic) throw new Error('Podaj temat gramatyczny.');
  const count = Math.max(5, Math.min(30, Number(b.count) || 15));
  const types: string[] = (Array.isArray(b.types) ? b.types : ['abc', 'gap']).filter((t: string) => t === 'abc' || t === 'gap');
  if (!types.length) types.push('abc');
  const level = str(b.level, 40) || 'A1–A2';
  const notes = str(b.notes, 300);
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 90)
    .map((w: any) => `${str(w.t, 60)} (${str(w.pl, 60)})`).filter((s: string) => s.length > 3);
  const out = await chatJSON(RULES,
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
async function doStory(b: any) {
  const lang = LANGS[b.lang] || LANGS.en;
  const len = STORY_LEN[str(b.length, 10)] || STORY_LEN.short;
  const level = str(b.level, 40) || 'A1–A2';
  const n = Math.max(3, Math.min(5, Number(b.questions) || 4));
  const topic = str(b.topic, 120), grammar = str(b.grammar, 80);
  const words = (Array.isArray(b.words) ? b.words : []).slice(0, 30)
    .map((w: any) => `${str(w.t, 60)} (${str(w.pl, 60)})`).filter((s: string) => s.length > 3);
  if (words.length < 3) throw new Error('Za mało słówek w rozdziale.');
  const out = await chatJSON(RULES,
    `Write a short, engaging story in ${lang} for Polish children, CEFR level ${level}, length ${len} words.` +
    (topic ? ` Topic: ${topic}.` : ' Choose a fun everyday topic that fits the words.') +
    (grammar ? ` Use mainly this grammar: ${grammar}.` : '') +
    ` Use as many of these words as naturally possible (at least 8 of them, in the given form or a correct grammatical form): ${words.join(', ')}.` +
    ` Use short, clear sentences and only simple vocabulary besides the given words. Give it a short title in ${lang}.` +
    ` Then write a faithful Polish translation of the whole story.` +
    ` Then write exactly ${n} reading comprehension questions in ${lang} about the story, each with exactly 3 options and exactly one correct answer that can be found in the text.` +
    ` Return {"title":"…","text":"…","textPl":"…","questions":[{"q":"…","o":["…","…","…"],"a":0}]}`, 4000);
  const questions = (Array.isArray(out.questions) ? out.questions : []).map((x: any) => {
    const q = str(x.q, 240), o = (Array.isArray(x.o) ? x.o : []).map((s: unknown) => str(s, 120)).filter(Boolean).slice(0, 3), a = Number(x.a);
    if (!q || o.length !== 3 || !(a >= 0 && a <= 2) || new Set(o.map((s: string) => s.toLowerCase())).size !== 3) return null;
    return { q, o, a };
  }).filter(Boolean).slice(0, 5);
  const clean = (v: unknown, max: number) => String(v ?? '').split(String.fromCharCode(13)).join('').trim().slice(0, max);
  const text = clean(out.text, 4000);
  return { title: str(out.title, 120), text, textPl: clean(out.textPl, 5000), questions };
}

// ── check_sentence ──
async function doCheck(b: any) {
  const lang = LANGS[b.lang] || LANGS.en;
  const word = str(b.word, 80), wordPl = str(b.wordPl, 80), sentence = str(b.sentence, 240);
  if (!word || !sentence) throw new Error('Brak słówka albo zdania.');
  if (await flagged(sentence)) return { blocked: true };
  const out = await chatJSON(RULES + ' You are a kind, encouraging teacher of a child.',
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
    const max = staff ? lim[0] : lim[1];
    if (!max) return fail('FORBIDDEN', 'Ta funkcja jest dostępna dla nauczyciela i administratora.', 403);
    const { data: used, error: limErr } = await svc.rpc('ai_usage_bump', { p_user: user.id, p_action: action, p_max: max });
    if (limErr) return fail('NO_MIGRATION', 'Uruchom migrację #73 (ai-features.sql) w Supabase.', 500);
    if (used === -1) return fail('LIMIT', `Dzienny limit AI dla tej funkcji (${max}) został wykorzystany — spróbuj jutro.`, 429);

    const result = action === 'sentences' ? await doSentences(body)
      : action === 'wordlist' ? await doWordlist(body)
      : action === 'grammar' ? await doGrammar(body)
      : action === 'story' ? await doStory(body)
      : await doCheck(body);
    return json({ ...result, used, max });
  } catch (e) {
    console.error('[ai]', e);
    return fail('AI_ERROR', 'Błąd AI: ' + String((e as Error)?.message || e).slice(0, 300), 500);
  }
});
