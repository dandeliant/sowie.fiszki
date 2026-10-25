#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   Sowie Fiszki — kopia zapasowa bazy Supabase na dysk (Node 18+, bez dodatkowych pakietów)

   Co zapisuje (folder <BACKUP_DIR>/RRRR-MM-DD_GGMM/):
     • każdą tabelę ze schematu public → <tabela>.json (wszystkie wiersze, stronami po 1000)
     • konta logowania (auth) → _auth_users.json (id, login-e-mail, daty; BEZ haseł — Supabase ich nie wydaje)
     • listę plików w Storage (nagrania, zdjęcia, obrazki) → _storage_files.json (same nazwy i rozmiary;
       z opcją --files pobiera też same pliki do podfolderu _storage/)
     • podsumowanie → _info.json
   Stare kopie: zostaje KEEP najnowszych folderów (domyślnie 8 = ok. 2 miesiące przy kopii co tydzień).

   Konfiguracja — plik .env.backup obok tego skryptu (NIE trafia do repozytorium, jest w .gitignore):
     SUPABASE_SERVICE_ROLE_KEY=eyJ...      ← Supabase → Project Settings → API → service_role (secret)
     BACKUP_DIR=C:\Users\Asus\Documents\SowieFiszki-kopie   (opcjonalnie; domyślnie Dokumenty\SowieFiszki-kopie)
     KEEP=8                                (opcjonalnie)
   Adres projektu jest czytany z supabase-config.js.

   Uruchomienie:  node backup-supabase.js            (tabele + konta + lista plików)
                  node backup-supabase.js --files    (dodatkowo pobiera pliki ze Storage)
   Co tydzień:    dwuklik zaplanuj-kopie.bat (Harmonogram zadań Windows, niedziela 20:00).
   ═══════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const DIR = __dirname;
const WITH_FILES = process.argv.includes('--files');

function readEnv() {
  const env = {};
  const f = path.join(DIR, '.env.backup');
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return Object.assign(env, Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(SUPABASE_|BACKUP_DIR|KEEP)/.test(k))));
}
function projectUrl() {
  const src = fs.readFileSync(path.join(DIR, 'supabase-config.js'), 'utf8');
  const m = src.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Nie znalazłem SUPABASE_URL w supabase-config.js');
  return m[1].replace(/\/$/, '');
}
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
const log = (...a) => console.log(new Date().toLocaleTimeString('pl-PL'), ...a);

async function main() {
  const env = readEnv();
  const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!KEY) {
    console.error('Brak klucza. Utwórz plik .env.backup obok skryptu z linią:\n  SUPABASE_SERVICE_ROLE_KEY=<klucz service_role z Supabase → Project Settings → API>');
    process.exit(2);
  }
  const URL_ = env.SUPABASE_URL || projectUrl();
  const BACKUP_DIR = env.BACKUP_DIR || path.join(os.homedir(), 'Documents', 'SowieFiszki-kopie');
  const KEEP = Math.max(1, parseInt(env.KEEP || '8', 10) || 8);
  const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  const out = path.join(BACKUP_DIR, stamp());
  fs.mkdirSync(out, { recursive: true });
  const info = { started: new Date().toISOString(), project: URL_, tables: {}, errors: [] };
  log('Kopia do:', out);

  // ── tabele (lista z opisu OpenAPI PostgREST) ──
  const spec = await fetch(URL_ + '/rest/v1/', { headers: Object.assign({ Accept: 'application/openapi+json' }, H) });
  if (!spec.ok) throw new Error('Nie mogę pobrać listy tabel (HTTP ' + spec.status + ') — sprawdź klucz service_role.');
  const tables = Object.keys((await spec.json()).definitions || {}).sort();
  for (const t of tables) {
    try {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const r = await fetch(`${URL_}/rest/v1/${encodeURIComponent(t)}?select=*`, { headers: Object.assign({ Range: `${from}-${from + 999}`, 'Range-Unit': 'items' }, H) });
        if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
        const page = await r.json();
        rows.push(...page);
        if (page.length < 1000) break;
      }
      fs.writeFileSync(path.join(out, t + '.json'), JSON.stringify(rows));
      info.tables[t] = rows.length;
      log(t.padEnd(32), rows.length);
    } catch (e) { info.errors.push(t + ': ' + e.message); log('⚠️', t, e.message); }
  }

  // ── konta logowania (bez haseł) ──
  try {
    const users = [];
    for (let page = 1; page < 1000; page++) {
      const r = await fetch(`${URL_}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: H });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); const list = j.users || [];
      users.push(...list.map(u => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, user_metadata: u.user_metadata })));
      if (list.length < 1000) break;
    }
    fs.writeFileSync(path.join(out, '_auth_users.json'), JSON.stringify(users));
    info.auth_users = users.length; log('konta (auth)'.padEnd(32), users.length);
  } catch (e) { info.errors.push('auth: ' + e.message); log('⚠️ auth', e.message); }

  // ── Storage: lista plików (+ opcjonalnie same pliki) ──
  try {
    const br = await fetch(URL_ + '/storage/v1/bucket', { headers: H });
    if (!br.ok) throw new Error('HTTP ' + br.status);
    const buckets = await br.json(), files = {};
    let bytes = 0, count = 0;
    for (const b of buckets) {
      const list = []; const queue = [''];
      while (queue.length) {
        const prefix = queue.shift();
        for (let offset = 0; ; offset += 1000) {
          const r = await fetch(`${URL_}/storage/v1/object/list/${encodeURIComponent(b.id)}`, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H),
            body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) });
          if (!r.ok) throw new Error(b.id + ' HTTP ' + r.status);
          const items = await r.json();
          for (const it of items) {
            const full = prefix ? prefix + '/' + it.name : it.name;
            if (!it.id) queue.push(full);                       // podfolder
            else { const size = (it.metadata && it.metadata.size) || 0; list.push({ name: full, size, updated_at: it.updated_at }); bytes += size; count++; }
          }
          if (items.length < 1000) break;
        }
      }
      files[b.id] = list;
      if (WITH_FILES) {
        for (const f of list) {
          const dest = path.join(out, '_storage', b.id, ...f.name.split('/'));
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          const r = await fetch(`${URL_}/storage/v1/object/${encodeURIComponent(b.id)}/${f.name.split('/').map(encodeURIComponent).join('/')}`, { headers: H });
          if (r.ok) fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); else info.errors.push('plik ' + b.id + '/' + f.name + ': HTTP ' + r.status);
        }
      }
    }
    fs.writeFileSync(path.join(out, '_storage_files.json'), JSON.stringify(files));
    info.storage = { files: count, mb: +(bytes / 1048576).toFixed(1), downloaded: WITH_FILES };
    log('pliki w Storage'.padEnd(32), count, '(' + info.storage.mb + ' MB' + (WITH_FILES ? ', pobrane' : ', tylko lista') + ')');
  } catch (e) { info.errors.push('storage: ' + e.message); log('⚠️ storage', e.message); }

  info.finished = new Date().toISOString();
  fs.writeFileSync(path.join(out, '_info.json'), JSON.stringify(info, null, 2));

  // ── usuń najstarsze kopie (tylko foldery w formacie RRRR-MM-DD_GGMM) ──
  const olds = fs.readdirSync(BACKUP_DIR).filter(n => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(n)).sort();
  for (const n of olds.slice(0, Math.max(0, olds.length - KEEP))) { fs.rmSync(path.join(BACKUP_DIR, n), { recursive: true, force: true }); log('usunięto starą kopię', n); }

  log(info.errors.length ? `Gotowe z ostrzeżeniami (${info.errors.length}).` : 'Gotowe ✔', Object.keys(info.tables).length, 'tabel.');
  process.exit(info.errors.length && !Object.keys(info.tables).length ? 1 : 0);
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
