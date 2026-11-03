// ═══════════════════════════════════════════════════════════════
//  Sowie Fiszki — Supabase Edge Function „push-reminders” (Web Push, migracja #91)
//
//  Codzienne przypomnienia o nauce i pupilu — także gdy aplikacja jest zamknięta
//  (iPhone: aplikacja dodana do ekranu początkowego, iOS 16.4+; Android; komputer).
//
//  Tryby (POST):
//    cron  — nagłówek x-cron-secret = sekret CRON_SECRET; uruchamiane CO GODZINĘ
//            (push-cron-setup.sql). push_due_now → szyfrowanie + wysyłka (równolegle,
//            z limitem czasu) → push_mark_sent / push_mark_failed. Wynik: liczby.
//    test  — body {"action":"test"} + JWT zalogowanego użytkownika (Authorization:
//            Bearer …, jak supabase.functions.invoke): próbne powiadomienie na WŁASNE
//            urządzenia (max 1 na 30 s na urządzenie — push_test_targets).
//  Wdrożenie z wyłączonym „Verify JWT” (cron nie ma JWT użytkownika) — funkcja
//  sprawdza sama: sekret crona albo JWT użytkownika.
//
//  Sekrety (Supabase → Edge Functions → Secrets):
//    VAPID_PUBLIC_KEY   — klucz publiczny (base64url, 65 bajtów) — ten sam co w app.html
//    VAPID_PRIVATE_KEY  — klucz prywatny „d” (base64url, 32 bajty)
//    VAPID_SUBJECT      — mailto:sowie.fiszki@gmail.com
//    CRON_SECRET        — losowy sekret wysyłany przez cron w nagłówku x-cron-secret
//  SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY Supabase podaje sam.
//  W logach tylko liczby — bez loginów, endpointów i treści.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { importVapid, sendWebPush, type Vapid, type PushResult } from './webpush.ts';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC = (Deno.env.get('VAPID_PUBLIC_KEY') ?? '').trim();
const VAPID_PRIVATE = (Deno.env.get('VAPID_PRIVATE_KEY') ?? '').trim();
const VAPID_SUBJECT = (Deno.env.get('VAPID_SUBJECT') ?? '').trim() || 'mailto:sowie.fiszki@gmail.com';
const CRON_SECRET = (Deno.env.get('CRON_SECRET') ?? '').trim();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ error: code, message }, status);

const TTL = 6 * 3600;          // po 6 h nieodebrane przypomnienie traci sens
const BATCH = 25;              // tyle wysyłek naraz
const TIMEOUT_MS = 10000;      // limit na jedną wysyłkę
const TIME_BUDGET_MS = 110000; // cały przebieg (limit funkcji to 150 s)

type Row = { id: string; endpoint: string; p256dh: string; auth: string; tz: string; remind_hour: number; due_count: number; pet: any; streak: number };
type Msg = { title: string; body: string; url: string; tag: string; action: string };

// ── treść powiadomienia ──
const str = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const int = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? few : many;
}
const hourFmt = new Map<string, Intl.DateTimeFormat>();
function hourIn(ms: number, tz: string): number {
  let f = hourFmt.get(tz);
  if (!f) {
    try { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }); }
    catch { f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', hourCycle: 'h23' }); }
    hourFmt.set(tz, f);
  }
  return Number(f.format(new Date(ms))) % 24;
}
// Pupil (stan z aplikacji z chwili t): potrzeby spadają co pełną godzinę w dzień (7:00–22:00),
// jak petTick() w app.html; tekst jak sfPetReminderText(). null = pupil niczego nie potrzebuje.
export function petLine(pet: any, tz: string, nowMs: number): string | null {
  if (!pet || typeof pet !== 'object') return null;
  const em = str(pet.e, 16) || '🐾', nm = str(pet.n, 30) || 'Pupil';
  if (pet.egg) return `${em} ${nm} czeka, aż się wykluje — 5 minut nauki?`;
  const lim = (v: unknown) => Math.max(5, Math.min(100, Number.isFinite(Number(v)) ? Number(v) : 70));
  let h = lim(pet.h), m = lim(pet.m), e = lim(pet.en);
  let t = Number(pet.t) || nowMs, i = 0;
  if (t < nowMs - 30 * 864e5) t = nowMs - 30 * 864e5;
  while (nowMs - t >= 3600e3 && i < 168) {
    const hr = hourIn(t, tz);
    if (!(hr >= 22 || hr < 7)) { h = Math.max(5, h - 4); m = Math.max(5, m - 3); e = Math.max(5, e - 3); }
    t += 3600e3; i++;
  }
  const lo = Math.min(h, m, e);
  if (lo >= 60) return null;
  if (lo === h) return `${em} ${nm} prosi o jedzenie – 5 minut nauki?`;
  if (lo === m) return `${em} ${nm} chce się pobawić – zagrasz w grę?`;
  return `${em} ${nm} potrzebuje energii – szybka powtórka?`;
}
const GENERIC = [
  '🦉 5 minut angielskiego? Sowa już na Ciebie czeka!',
  '🎯 Szybka runda fiszek? To zajmie tylko 5 minut!',
  '⭐ Dzisiejsza porcja angielskiego czeka — wpadniesz na chwilę?',
  '📚 Kilka słówek dziennie i angielski rośnie jak na drożdżach!',
];
export function buildMessage(row: Row, nowMs: number): Msg {
  const due = Math.max(0, int(row.due_count));
  const pl = petLine(row.pet, row.tz || 'Europe/Warsaw', nowMs);
  const dueTxt = due ? `📚 ${due} ${plural(due, 'słówko czeka', 'słówka czekają', 'słówek czeka')} na powtórkę!` : '';
  const base = { tag: 'sowie-daily', url: due ? '/app.html?push=review' : '/app.html', action: due ? 'review' : 'open' };
  if (pl) return { ...base, title: '🐾 Sowie Fiszki — Twój pupil czeka', body: pl + (dueTxt ? '\n' + dueTxt : '') };
  if (due) return { ...base, title: '🦉 Sowie Fiszki — czas na powtórkę', body: dueTxt };
  const streak = int(row.streak);
  if (streak >= 2) return { ...base, title: '🦉 Sowie Fiszki', body: `🔥 Masz już ${streak} dni nauki z rzędu! 5 minut angielskiego i seria rośnie dalej.` };
  return { ...base, title: '🦉 Sowie Fiszki', body: GENERIC[Math.floor(nowMs / 864e5) % GENERIC.length] };
}

// ── wysyłka partiami ──
async function sendAll(rows: Row[], vapid: Vapid, make: (r: Row) => Msg, started: number) {
  const out: { row: Row; res: PushResult }[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    if (Date.now() - started > TIME_BUDGET_MS) break;          // limit czasu funkcji — reszta pominięta (skipped)
    const part = rows.slice(i, i + BATCH);
    const res = await Promise.all(part.map(r =>
      sendWebPush(r, JSON.stringify(make(r)), vapid, { ttl: TTL, urgency: 'normal', topic: 'sowie-daily', timeoutMs: TIMEOUT_MS })
        .catch(() => ({ ok: false, status: 0, gone: false, error: 'EXCEPTION' } as PushResult))));
    part.forEach((row, k) => out.push({ row, res: res[k] }));
  }
  return out;
}

// Zapis wyników: wysłane → last_sent_on; 404/410 → usuń; inne trwałe błędy (4xx) → fail_count + 1.
// 401/403 (zła konfiguracja VAPID) liczymy tylko, gdy coś w tym przebiegu przeszło — inaczej
// błąd konfiguracji nie skasuje wszystkich subskrypcji. 429 / 5xx / sieć — bez kary.
async function record(svc: any, results: { row: Row; res: PushResult }[], markSent: boolean) {
  const sent = results.filter(x => x.res.ok);
  const anyOk = sent.length > 0;
  let gone = 0, failed = 0, transient = 0;
  if (markSent && sent.length) {
    const { error } = await svc.rpc('push_mark_sent', { p_ids: sent.map(x => x.row.id) });
    if (error) console.error('[push] mark_sent', error.message);
  }
  for (const x of results) {
    if (x.res.ok) continue;
    const s = x.res.status;
    const auth = s === 401 || s === 403;
    const permanent = x.res.gone || (s >= 400 && s < 500 && s !== 429 && (!auth || anyOk));
    if (!permanent) { transient++; continue; }
    if (x.res.gone) gone++; else failed++;
    const { error } = await svc.rpc('push_mark_failed', { p_endpoint: x.row.endpoint, p_gone: !!x.res.gone });
    if (error) console.error('[push] mark_failed', error.message);
  }
  return { sent: sent.length, gone, failed, transient };
}

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

let vapidPromise: Promise<Vapid> | null = null;
const getVapid = () => (vapidPromise ??= importVapid(VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT).catch(e => { vapidPromise = null; throw e; }));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('METHOD', 'Tylko POST.', 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return fail('PUSH_NOT_CONFIGURED', 'Brak kluczy VAPID w sekretach funkcji (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).', 503);
  const started = Date.now();
  let vapid: Vapid;
  try { vapid = await getVapid(); }
  catch (e) { return fail('PUSH_BAD_KEYS', 'Niepoprawne klucze VAPID: ' + String((e as Error)?.message || e), 500); }
  const svc = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });

  // ── tryb cron ──
  const cronHeader = req.headers.get('x-cron-secret') || '';
  if (cronHeader) {
    if (!CRON_SECRET) return fail('CRON_NOT_CONFIGURED', 'Brak sekretu CRON_SECRET w funkcji.', 503);
    if (!safeEqual(cronHeader, CRON_SECRET)) return fail('FORBIDDEN', 'Zły sekret crona.', 403);
    const { data, error } = await svc.rpc('push_due_now', { p_now: new Date().toISOString() });
    if (error) {
      console.error('[push] push_due_now', error.message);
      return fail('NO_MIGRATION', 'Uruchom migrację #91 (push-reminders.sql) w Supabase.', 500);
    }
    const rows: Row[] = Array.isArray(data) ? data : [];
    const now = Date.now();
    const results = await sendAll(rows, vapid, r => buildMessage(r, now), started);
    const sum = await record(svc, results, true);
    const summary = { due: rows.length, ...sum, skipped: rows.length - results.length, ms: Date.now() - started };
    console.log('[push] cron', JSON.stringify(summary));
    return json(summary);
  }

  // ── tryb test (zalogowany użytkownik, własne urządzenia) ──
  const body = await req.json().catch(() => ({}));
  if (String(body?.action || '') !== 'test') return fail('BAD_ACTION', 'Nieznana akcja.');
  const authH = req.headers.get('Authorization') || '';
  if (!/^Bearer\s+\S+/.test(authH)) return fail('NOT_LOGGED_IN', 'Zaloguj się.', 401);
  const userClient = createClient(SB_URL, SB_ANON, { global: { headers: { Authorization: authH } }, auth: { persistSession: false } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return fail('NOT_LOGGED_IN', 'Zaloguj się.', 401);
  const { data, error } = await svc.rpc('push_test_targets', { p_user: user.id });
  if (error) return fail('NO_MIGRATION', 'Uruchom migrację #91 (push-reminders.sql) w Supabase.', 500);
  const rows: Row[] = Array.isArray(data) ? data : [];
  if (!rows.length) return fail('NO_DEVICE', 'Brak zapisanego urządzenia albo próbne powiadomienie było przed chwilą — spróbuj za 30 sekund.', 429);
  const now = Date.now();
  const results = await sendAll(rows, vapid, r => {
    const m = buildMessage(r, now);
    const hh = String(int(r.remind_hour)).padStart(2, '0') + ':00';
    return { ...m, title: '🔔 Przypomnienia działają!', body: `Codziennie o ${hh} dostaniesz takie powiadomienie:\n${m.body}`, tag: 'sowie-test' };
  }, started);
  const sum = await record(svc, results, false);
  console.log('[push] test', JSON.stringify({ devices: rows.length, ...sum }));
  return json({ devices: rows.length, ...sum });
});
