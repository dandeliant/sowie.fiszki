// ═══════════════════════════════════════════════════════════════
//  Sowie Fiszki — Supabase Edge Function „account” (🔑 odzyskiwanie hasła e-mailem, migracja #98)
//
//  Dorosłe konta (nauczyciel, opiekun, admin) mogą dobrowolnie podać e-mail.
//  Po potwierdzeniu linkiem „Nie pamiętam hasła” wysyła jednorazowy link
//  do ustawienia nowego hasła. Uczniowie — bez e-maila (hasło resetuje nauczyciel).
//
//  Akcje (POST, body {"action": …}):
//    get     (zalogowany)  → { email, verified, can }
//    set     (zalogowany, dorosły) { email } → zapis + link potwierdzający (48 h)
//    resend  (zalogowany, dorosły) → ponowny link potwierdzający
//    remove  (zalogowany)  → usuwa e-mail
//    verify  { token }     → potwierdza adres (link z e-maila: /index.html#verify-email=…)
//    forgot  { login } albo { email } → link do zmiany hasła (/index.html#reset=…, 60 min)
//            — odpowiedź zawsze ta sama (nie zdradza, czy konto / adres istnieje)
//    reset   { token, password } → nowe hasło (6–72 znaki) → { ok, login }
//  Limity: forgot — 10 / h z jednego IP, 3 / h na adres; set / resend — 5 / h na konto.
//
//  Sekrety (Supabase → Edge Functions → Secrets):
//    BREVO_API_KEY  — klucz API Brevo (wysyłka e-maili, serwery w UE)   ← zalecane
//      albo RESEND_API_KEY — klucz API Resend
//    MAIL_FROM      — adres nadawcy zweryfikowany u dostawcy, np. noreply@sowiefiszki.com
//    SITE_URL       — https://sowiefiszki.com (bez ukośnika na końcu)
//  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY Supabase podaje sam.
//  Wdrożenie: Verify JWT WYŁĄCZONE (akcje forgot / verify / reset są dla niezalogowanych;
//  zalogowanie funkcja sprawdza sama). W logach tylko statusy — bez adresów i loginów.
// ═══════════════════════════════════════════════════════════════
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BREVO_KEY = (Deno.env.get('BREVO_API_KEY') ?? '').trim();
const RESEND_KEY = (Deno.env.get('RESEND_API_KEY') ?? '').trim();
const MAIL_FROM = (Deno.env.get('MAIL_FROM') ?? '').trim();
const SITE_URL = ((Deno.env.get('SITE_URL') ?? '').trim() || 'https://sowiefiszki.com').replace(/\/+$/, '');

const VERIFY_H = 48;        // ważność linku potwierdzającego (godziny)
const RESET_MIN = 60;       // ważność linku do zmiany hasła (minuty)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fail = (code: string, message: string, status = 400) => json({ error: code, message }, status);

const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

// ── pomocnicze ──
const enc = new TextEncoder();
async function sha256(s: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return Array.from(h, b => b.toString(16).padStart(2, '0')).join('');
}
function newToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const normEmail = (v: unknown) => String(v ?? '').trim().toLowerCase();
const emailOk = (e: string) => e.length >= 6 && e.length <= 254 && /^[^\s@<>"']{1,64}@[^\s@<>"']{1,185}\.[a-z]{2,24}$/.test(e);
const normLogin = (v: unknown) => String(v ?? '').trim().toLowerCase();
function mask(e: string): string {
  const [u, d] = e.split('@');
  if (!d) return '***';
  const dot = d.lastIndexOf('.');
  const host = dot > 0 ? d.slice(0, dot) : d, tld = dot > 0 ? d.slice(dot) : '';
  return (u.slice(0, 1) || '*') + '***@' + (host.slice(0, 1) || '*') + '***' + tld;
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const sinceIso = (min: number) => new Date(Date.now() - min * 60000).toISOString();

async function clientIp(req: Request): Promise<string> {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown';
  return sha256('sf-ip|' + ip);
}
async function countLog(kind: string, col: 'ip_hash' | 'email_hash' | 'user_id', val: string, minutes: number): Promise<number> {
  const { count } = await db.from('recovery_log').select('id', { count: 'exact', head: true })
    .eq('kind', kind).eq(col, val).gte('at', sinceIso(minutes));
  return count ?? 0;
}
async function logEvent(kind: string, row: { ip_hash?: string; email_hash?: string; user_id?: string }) {
  await db.from('recovery_log').insert({ kind, ...row });
  // porządek: wpisy starsze niż 7 dni (rzadko — co ~20. wpis)
  if (Math.random() < 0.05) await db.from('recovery_log').delete().lt('at', sinceIso(7 * 24 * 60));
}

async function currentUser(req: Request): Promise<{ id: string } | null> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return null;
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return { id: data.user.id };
}
type Prof = { id: string; username: string; is_teacher: boolean; is_parent: boolean; is_admin: boolean };
async function profileOf(id: string): Promise<Prof | null> {
  const { data } = await db.from('profiles').select('id, username, is_teacher, is_parent, is_admin').eq('id', id).maybeSingle();
  return (data as Prof) ?? null;
}
const isAdult = (p: Prof | null) => !!p && (p.is_teacher || p.is_parent || p.is_admin);

// ── wysyłka e-maila (Brevo albo Resend) ──
async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!MAIL_FROM || (!BREVO_KEY && !RESEND_KEY)) { console.warn('[account] brak konfiguracji poczty'); return false; }
  try {
    let res: Response;
    if (BREVO_KEY) {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: 'Sowie Fiszki', email: MAIL_FROM }, to: [{ email: to }], subject, htmlContent: html, textContent: text }),
      });
    } else {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Sowie Fiszki <' + MAIL_FROM + '>', to: [to], subject, html, text }),
      });
    }
    if (!res.ok) console.warn('[account] wysyłka e-maila: HTTP', res.status);
    return res.ok;
  } catch (_e) {
    console.warn('[account] wysyłka e-maila: błąd sieci');
    return false;
  }
}
function mailHtml(title: string, lines: string[], button?: { href: string; label: string }, after: string[] = []): string {
  const p = (t: string) => '<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:#2d2350">' + t + '</p>';
  return '<!doctype html><html lang="pl"><body style="margin:0;background:#f4f1ff;font-family:Arial,Helvetica,sans-serif">'
    + '<div style="max-width:520px;margin:0 auto;padding:24px 16px"><div style="background:#fff;border-radius:16px;padding:24px 22px;border:1px solid #e3dcff">'
    + '<div style="font-size:30px">🦉</div><h1 style="font-size:20px;color:#3b2a87;margin:6px 0 14px">' + esc(title) + '</h1>'
    + lines.map(p).join('')
    + (button ? '<p style="margin:18px 0"><a href="' + esc(button.href) + '" style="display:inline-block;background:#7c4dff;color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">' + esc(button.label) + '</a></p>'
      + '<p style="margin:0 0 12px;font-size:12px;color:#6b6290;word-break:break-all">Jeśli przycisk nie działa, skopiuj link: ' + esc(button.href) + '</p>' : '')
    + after.map(p).join('')
    + '</div><p style="text-align:center;font-size:12px;color:#8a82ad;margin:14px 0 0">© 2026 Sowie Fiszki</p></div></body></html>';
}

// ── link potwierdzający adres ──
async function sendVerify(userId: string, login: string, email: string): Promise<boolean> {
  const token = newToken();
  const { error } = await db.from('account_emails').update({ verify_hash: await sha256(token), verify_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId);
  if (error) return false;
  const href = SITE_URL + '/index.html#verify-email=' + token;
  return sendMail(email, 'Potwierdź e-mail w Sowich Fiszkach',
    mailHtml('Potwierdź swój e-mail', [
      'Cześć! Ten adres został podany do odzyskiwania hasła do konta <b>' + esc(login) + '</b> w Sowich Fiszkach.',
      'Kliknij przycisk, żeby go potwierdzić. Link jest ważny ' + VERIFY_H + ' godziny.',
    ], { href, label: 'Potwierdź adres e-mail' }, ['Jeśli to nie Ty — po prostu zignoruj tę wiadomość.']),
    'Cześć! Ten adres został podany do odzyskiwania hasła do konta „' + login + '” w Sowich Fiszkach.\nPotwierdź go (link ważny ' + VERIFY_H + ' h):\n' + href + '\n\nJeśli to nie Ty — zignoruj tę wiadomość.\n\n© 2026 Sowie Fiszki');
}

// ── obsługa ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail('method', 'Tylko POST.', 405);
  if (!SB_URL || !SB_SERVICE) return fail('config', 'Brak konfiguracji serwera.', 500);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_e) { return fail('bad_json', 'Zły format zapytania.'); }
  const action = String(body.action ?? '');

  try {
    // ── zalogowany ──
    if (['get', 'set', 'resend', 'remove'].includes(action)) {
      const me = await currentUser(req);
      if (!me) return fail('auth', 'Zaloguj się ponownie.', 401);
      const prof = await profileOf(me.id);
      if (!prof) return fail('auth', 'Nie ma takiego konta.', 401);
      const { data: row } = await db.from('account_emails').select('email, verified_at').eq('user_id', me.id).maybeSingle();

      if (action === 'get') return json({ email: row?.email ?? null, verified: !!row?.verified_at, can: isAdult(prof) });
      if (action === 'remove') { await db.from('account_emails').delete().eq('user_id', me.id); return json({ ok: true }); }

      if (!isAdult(prof)) return fail('role', 'E-mail do odzyskiwania hasła mogą dodać konta nauczyciela i opiekuna. Uczniowi hasło zmienia nauczyciel.', 403);
      if (await countLog('verify', 'user_id', me.id, 60) >= 5) return fail('rate', 'Za dużo prób — spróbuj za godzinę.', 429);

      if (action === 'resend') {
        if (!row) return fail('no_email', 'Najpierw podaj adres e-mail.');
        if (row.verified_at) return json({ ok: true, verified: true });
        await logEvent('verify', { user_id: me.id });
        return json({ ok: true, sent: await sendVerify(me.id, prof.username, row.email) });
      }
      // set
      const email = normEmail(body.email);
      if (!emailOk(email)) return fail('email', 'To nie wygląda na poprawny adres e-mail.');
      if (row && row.email === email && row.verified_at) return json({ ok: true, verified: true });
      const { error } = await db.from('account_emails').upsert({ user_id: me.id, email, verified_at: null, verify_hash: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      if (error) return fail('db', 'Nie udało się zapisać adresu.', 500);
      await logEvent('verify', { user_id: me.id });
      return json({ ok: true, sent: await sendVerify(me.id, prof.username, email) });
    }

    // ── potwierdzenie adresu ──
    if (action === 'verify') {
      const token = String(body.token ?? '');
      if (token.length < 20 || token.length > 100) return fail('token', 'Link jest nieprawidłowy.');
      const { data: row } = await db.from('account_emails').select('user_id, email, verify_sent_at').eq('verify_hash', await sha256(token)).maybeSingle();
      if (!row || !row.verify_sent_at || Date.parse(row.verify_sent_at) < Date.now() - VERIFY_H * 3600000) return fail('token', 'Link wygasł albo został już użyty. Wyślij nowy w „👤 Moje konto”.');
      await db.from('account_emails').update({ verified_at: new Date().toISOString(), verify_hash: null, updated_at: new Date().toISOString() }).eq('user_id', row.user_id);
      return json({ ok: true, email: mask(row.email) });
    }

    // ── nie pamiętam hasła ──
    if (action === 'forgot') {
      const ipHash = await clientIp(req);
      if (await countLog('forgot', 'ip_hash', ipHash, 60) >= 10) return fail('rate', 'Za dużo prób — spróbuj za godzinę.', 429);
      const login = normLogin(body.login), email = normEmail(body.email);
      let targets: { id: string; username: string; email: string }[] = [];
      if (login) {
        if (!/^[a-z0-9_]{3,40}$/.test(login)) return json({ ok: true });
        const { data: p } = await db.from('profiles').select('id, username, is_teacher, is_parent, is_admin').eq('username', login).maybeSingle();
        if (p && isAdult(p as Prof)) {
          const { data: r } = await db.from('account_emails').select('email, verified_at').eq('user_id', p.id).maybeSingle();
          if (r?.verified_at) targets = [{ id: p.id, username: p.username, email: r.email }];
        }
      } else if (emailOk(email)) {
        const { data: rows } = await db.from('account_emails').select('user_id, email').eq('email', email).not('verified_at', 'is', null).limit(3);
        for (const r of rows ?? []) {
          const p = await profileOf(r.user_id);
          if (isAdult(p)) targets.push({ id: p!.id, username: p!.username, email: r.email });
        }
      } else {
        return fail('input', 'Wpisz login albo adres e-mail.');
      }
      const emailHash = await sha256('sf-mail|' + (targets[0]?.email || email || login));
      await logEvent('forgot', { ip_hash: ipHash, email_hash: emailHash });
      if (targets.length && await countLog('forgot', 'email_hash', emailHash, 60) <= 3) {
        const links: { login: string; href: string }[] = [];
        for (const t of targets) {
          const token = newToken();
          await db.from('password_resets').insert({ user_id: t.id, token_hash: await sha256(token), expires_at: new Date(Date.now() + RESET_MIN * 60000).toISOString() });
          links.push({ login: t.username, href: SITE_URL + '/index.html#reset=' + token });
        }
        const one = links.length === 1;
        await sendMail(targets[0].email, 'Zmiana hasła — Sowie Fiszki',
          mailHtml('Ustaw nowe hasło', [
            'Ktoś (pewnie Ty) poprosił o zmianę hasła w Sowich Fiszkach.',
            one ? 'Twój login: <b>' + esc(links[0].login) + '</b>' : 'Ten adres jest przypisany do kont: ' + links.map(l => '<b>' + esc(l.login) + '</b>').join(', ') + '. Każde ma osobny link poniżej.',
            'Link jest jednorazowy i ważny ' + RESET_MIN + ' minut.',
          ], one ? { href: links[0].href, label: 'Ustaw nowe hasło' } : undefined,
          (one ? [] : links.map(l => '🔑 <b>' + esc(l.login) + '</b>: <a href="' + esc(l.href) + '" style="color:#7c4dff">ustaw nowe hasło</a>'))
            .concat(['Jeśli to nie Ty — zignoruj tę wiadomość. Hasło się nie zmieni.'])),
          'Ktoś (pewnie Ty) poprosił o zmianę hasła w Sowich Fiszkach.\n'
            + links.map(l => 'Login: ' + l.login + '\nNowe hasło (link ważny ' + RESET_MIN + ' min, jednorazowy):\n' + l.href).join('\n\n')
            + '\n\nJeśli to nie Ty — zignoruj tę wiadomość. Hasło się nie zmieni.\n\n© 2026 Sowie Fiszki');
      }
      return json({ ok: true });   // zawsze ta sama odpowiedź
    }

    // ── nowe hasło z linku ──
    if (action === 'reset') {
      const token = String(body.token ?? ''), password = String(body.password ?? '');
      if (token.length < 20 || token.length > 100) return fail('token', 'Link jest nieprawidłowy.');
      if (password.length < 6 || password.length > 72) return fail('password', 'Hasło musi mieć od 6 do 72 znaków.');
      const ipHash = await clientIp(req);
      if (await countLog('reset', 'ip_hash', ipHash, 60) >= 20) return fail('rate', 'Za dużo prób — spróbuj za godzinę.', 429);
      await logEvent('reset', { ip_hash: ipHash });
      const { data: r } = await db.from('password_resets').select('id, user_id, expires_at, used_at').eq('token_hash', await sha256(token)).maybeSingle();
      if (!r || r.used_at || Date.parse(r.expires_at) < Date.now()) return fail('token', 'Link wygasł albo został już użyty. Poproś o nowy („Nie pamiętam hasła”).');
      const { error } = await db.auth.admin.updateUserById(r.user_id, { password });
      if (error) return fail('auth', 'Nie udało się zmienić hasła. Spróbuj jeszcze raz.', 500);
      await db.from('password_resets').update({ used_at: new Date().toISOString() }).eq('id', r.id);
      await db.from('password_resets').delete().eq('user_id', r.user_id).is('used_at', null);
      const p = await profileOf(r.user_id);
      return json({ ok: true, login: p?.username ?? '' });
    }

    return fail('action', 'Nieznana akcja.');
  } catch (_e) {
    console.warn('[account] błąd:', action);
    return fail('server', 'Błąd serwera — spróbuj za chwilę.', 500);
  }
});
