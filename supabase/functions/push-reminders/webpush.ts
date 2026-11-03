// ═══════════════════════════════════════════════════════════════
//  Sowie Fiszki — Web Push bez bibliotek (tylko Web Crypto)
//
//  RFC 8291 — szyfrowanie wiadomości (Content-Encoding: aes128gcm):
//    ECDH P-256 (klucz przeglądarki p256dh) + sekret auth → HKDF → AES-128-GCM,
//    jeden rekord, ogranicznik 0x02.
//  RFC 8292 — VAPID: JWT ES256 (aud = adres usługi push, exp ≤ 24 h, sub = mailto:)
//    w nagłówku „Authorization: vapid t=<jwt>, k=<klucz publiczny>”.
//
//  Działa w Deno (Edge Function) i w Node 20 (testy): tylko globalThis.crypto,
//  TextEncoder, btoa/atob i fetch — bez API Deno i bez npm web-push.
//
//  Klucze VAPID (sekrety funkcji):
//    VAPID_PUBLIC_KEY  — klucz publiczny P-256, nieskompresowany (65 bajtów), base64url
//    VAPID_PRIVATE_KEY — klucz prywatny: składnik „d” (32 bajty), base64url
//                        (ten sam format co `web-push generate-vapid-keys`)
// ═══════════════════════════════════════════════════════════════

const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export function b64uEncode(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str: string): Uint8Array {
  const s = String(str || '').trim().replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

export type EncryptOptions = {
  salt?: Uint8Array;                                       // tylko testy (wektor z RFC 8291)
  senderKeys?: { privateKey: CryptoKey; publicKey: CryptoKey };   // tylko testy
  padding?: number;                                        // dodatkowe zera po ograniczniku
  rs?: number;                                             // rozmiar rekordu (domyślnie 4096)
};

// RFC 8291: zaszyfrowana treść wiadomości (nagłówek aes128gcm + jeden rekord).
export async function encryptPayload(payload: Uint8Array | string, p256dh: string, authSecretB64: string, opts: EncryptOptions = {}): Promise<Uint8Array> {
  const uaPublic = b64uDecode(p256dh);
  const authSecret = b64uDecode(authSecretB64);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('BAD_P256DH');
  if (authSecret.length < 16) throw new Error('BAD_AUTH');
  const salt = opts.salt || globalThis.crypto.getRandomValues(new Uint8Array(16));
  const as = opts.senderKeys || await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await subtle.exportKey('raw', as.publicKey));
  const uaKey = await subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\u0000'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\u0000'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\u0000'), 12);
  const data = typeof payload === 'string' ? enc.encode(payload) : payload;
  const rs = opts.rs || 4096;
  const plain = new Uint8Array(data.length + 1 + Math.max(0, opts.padding || 0));
  plain.set(data);
  plain[data.length] = 2;                                  // ogranicznik ostatniego (jedynego) rekordu
  if (plain.length + 16 > rs) throw new Error('PAYLOAD_TOO_LARGE');
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, plain));
  // nagłówek: salt (16) || rs (uint32) || idlen (1) || keyid = as_public (65)
  const header = new Uint8Array(21 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, ct);
}

// ── VAPID (RFC 8292) ──
export type Vapid = { publicKey: string; privateKey: CryptoKey; subject: string; cache: Map<string, { jwt: string; exp: number }> };

export async function importVapid(publicKeyB64: string, privateKeyB64: string, subject: string): Promise<Vapid> {
  const pub = b64uDecode(publicKeyB64);
  const d = b64uDecode(privateKeyB64);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('BAD_VAPID_PUBLIC_KEY');
  if (d.length !== 32) throw new Error('BAD_VAPID_PRIVATE_KEY');
  const jwk = { kty: 'EC', crv: 'P-256', x: b64uEncode(pub.subarray(1, 33)), y: b64uEncode(pub.subarray(33, 65)), d: b64uEncode(d), ext: true };
  const privateKey = await subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  if (!/^(mailto:|https:\/\/)/.test(subject)) throw new Error('BAD_VAPID_SUBJECT');
  return { publicKey: b64uEncode(pub), privateKey, subject, cache: new Map() };
}

// JWT ES256 dla danej usługi push (aud = origin adresu subskrypcji), ważny 12 h; podpis r||s (64 bajty).
export async function vapidJwt(v: Vapid, aud: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const c = v.cache.get(aud);
  if (c && c.exp - nowSec > 3600) return c.jwt;
  const exp = nowSec + 12 * 3600;
  const head = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64uEncode(enc.encode(JSON.stringify({ aud, exp, sub: v.subject })));
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.privateKey, enc.encode(head + '.' + body));
  const jwt = head + '.' + body + '.' + b64uEncode(sig);
  v.cache.set(aud, { jwt, exp });
  return jwt;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult = { ok: boolean; status: number; gone: boolean; error?: string };
export type SendOptions = { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string; timeoutMs?: number };

// Wysyła jedno powiadomienie. Nie rzuca wyjątków — wynik w { ok, status, gone }.
// gone = 404/410: subskrypcja wygasła albo użytkownik ją cofnął (do usunięcia).
export async function sendWebPush(target: PushTarget, payload: string, v: Vapid, opts: SendOptions = {}): Promise<PushResult> {
  let url: URL;
  try { url = new URL(target.endpoint); } catch { return { ok: false, status: 0, gone: true, error: 'BAD_ENDPOINT' }; }
  if (url.protocol !== 'https:') return { ok: false, status: 0, gone: true, error: 'BAD_ENDPOINT' };
  let body: Uint8Array;
  try { body = await encryptPayload(payload, target.p256dh, target.auth); }
  catch (e) { return { ok: false, status: 0, gone: true, error: String((e as Error)?.message || e) }; }
  const jwt = await vapidJwt(v, url.origin);
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'Content-Encoding': 'aes128gcm',
    TTL: String(Math.max(0, Math.round(opts.ttl ?? 6 * 3600))),
    Urgency: opts.urgency || 'normal',
    Authorization: `vapid t=${jwt}, k=${v.publicKey}`,
  };
  if (opts.topic && /^[A-Za-z0-9_-]{1,32}$/.test(opts.topic)) headers.Topic = opts.topic;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 10000);
  try {
    const r = await fetch(target.endpoint, { method: 'POST', headers, body, signal: ctrl.signal });
    try { await r.arrayBuffer(); } catch { /* odpowiedź nieistotna */ }
    return { ok: r.status >= 200 && r.status < 300, status: r.status, gone: r.status === 404 || r.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, gone: false, error: (e as Error)?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  } finally {
    clearTimeout(timer);
  }
}
