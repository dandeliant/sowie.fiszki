#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════
//  🛟 STRAŻNIK KOLEJNOŚCI SŁÓWEK (SW v1.262)
//  Postęp ucznia jest zapisany pod NUMEREM słówka w rozdziale (unit_progress.word_states[i]).
//  Słówko wstawione w środek rozdziału, usunięte albo przestawione przesuwa numery — postęp
//  „trafia” do innego słowa (tak było 29.10 w Stay Brainy 4 i 8.11 w Destination C1&C2).
//
//  Uruchom PRZED commitem zmian w data.js:
//      node sprawdz-kolejnosc-slowek.js            — porównanie z ostatnim commitem (HEAD)
//      node sprawdz-kolejnosc-slowek.js --od <rev>  — z dowolną wersją (np. origin/main)
//      node sprawdz-kolejnosc-slowek.js --dopisz    — dopisz wykryte przesunięcia do SF_SHIFTS w app.html
//
//  Wynik 0 = słówka tylko dopisane na końcu / poprawione w miejscu (bezpiecznie).
//  Wynik 1 = przesunięcia: najlepiej przenieś nowe słówka NA KONIEC rozdziału; jeśli kolejność
//  ma zostać — uruchom z --dopisz (aplikacja przeniesie stary postęp uczniów na właściwe słówka)
//  i podbij wersję w sw.js.
// ══════════════════════════════════════════════════════════════════════
const { execSync } = require('child_process');
const vm = require('vm'), fs = require('fs'), path = require('path');
const DIR = __dirname;
const args = process.argv.slice(2);
const FROM = args.includes('--od') ? args[args.indexOf('--od') + 1] : 'HEAD';
const WRITE = args.includes('--dopisz');

const run = src => { const c = {}; vm.createContext(c); vm.runInContext(src + ';this.B=BOOKS;', c); return c.B; };
const OLD = run(execSync('git show ' + FROM + ':data.js', { cwd: DIR, encoding: 'utf8', maxBuffer: 1 << 28 }));
const NEW = run(fs.readFileSync(path.join(DIR, 'data.js'), 'utf8'));
const norm = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Dopasowanie stary → nowy numer: LCS na parach [PL, EN], potem po EN + zdaniu, EN + PL, PL, EN
// (tylko jednoznaczne), na końcu luki tej samej długości (tekst poprawiony w miejscu).
function match(O, N) {
  const n = O.length, m = N.length, map = new Array(n).fill(-1), used = new Array(m).fill(false);
  const k = w => w[0] + '\u0001' + w[1];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = k(O[i]) === k(N[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (k(O[i]) === k(N[j])) { map[i] = j; used[j] = true; i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  const passes = [w => w[1] + '\u0001' + (w[3] || ''), w => norm(w[1]) + '\u0001' + norm(w[0]), w => w[1] + '\u0001' + (w[2] || ''),
    w => w[0], w => norm(w[0]), w => norm(w[1])];
  for (const f of passes) {
    const cnt = (arr, sel) => { const c = new Map(); arr.forEach((w, i) => { if (sel(i)) { const v = f(w); if (v.replace(/\u0001/g, '')) c.set(v, (c.get(v) || 0) + 1); } }); return c; };
    const co = cnt(O, i => map[i] < 0), cn = cnt(N, j => !used[j]);
    const where = new Map(); N.forEach((w, j) => { if (!used[j]) where.set(f(w), j); });
    O.forEach((w, i) => { if (map[i] >= 0) return; const v = f(w); if (co.get(v) === 1 && cn.get(v) === 1) { const j = where.get(v); map[i] = j; used[j] = true; } });
  }
  for (let i = 0; i < n;) {
    if (map[i] >= 0) { i++; continue; }
    let e = i; while (e + 1 < n && map[e + 1] < 0) e++;
    const j0 = i > 0 ? map[i - 1] + 1 : 0, j1 = e + 1 < n ? map[e + 1] - 1 : m - 1;
    if (j1 - j0 === e - i) {
      let free = true; for (let j = j0; j <= j1; j++) if (j < 0 || j >= m || used[j]) free = false;
      if (free) for (let d = 0; d <= e - i; d++) { map[i + d] = j0 + d; used[j0 + d] = true; }
    }
    i = e + 1;
  }
  return map;
}
function runs(map) {
  const out = [];
  map.forEach((j, i) => {
    if (j < 0) return;
    const last = out[out.length - 1];
    if (last && last[0] + last[2] === i && last[1] + last[2] === j) last[2]++; else out.push([i, j, 1]);
  });
  return out;
}
const lists = B => {
  const out = {};
  for (const bk of Object.keys(B)) {
    const b = B[bk]; if (!b || !b.units) continue;
    const all = [];
    for (const uk of Object.keys(b.units)) { const w = (b.units[uk] && b.units[uk].words) || []; out[bk + '/' + uk] = w; all.push(...w); }
    out[bk + '/all'] = all;
  }
  return out;
};
const A = lists(OLD), B = lists(NEW), t = Date.now(), events = [];
for (const key of Object.keys(B)) {
  const O = A[key], N = B[key];
  if (!O || !O.length) continue;
  const map = match(O, N);
  if (map.every((j, i) => j === i)) continue;
  const [b, u] = key.split('/');
  const lost = map.filter(j => j < 0).length, firstMoved = map.findIndex((j, i) => j !== i);
  console.log(`⚠️  ${key}: ${O.length} → ${N.length} słówek, przesunięcie od #${firstMoved}${lost ? ', usunięte: ' + lost : ''}`);
  events.push({ t, b, u, r: runs(map) });
}
for (const key of Object.keys(A)) if (!B[key] && A[key].length) console.log(`⚠️  ${key}: rozdział usunięty (${A[key].length} słówek)`);
if (!events.length) { console.log('✅ Kolejność słówek bez zmian (nowe tylko na końcu albo poprawki w miejscu) — postęp uczniów bezpieczny.'); process.exit(0); }
if (WRITE) {
  const file = path.join(DIR, 'app.html');
  let s = fs.readFileSync(file, 'utf8');
  const m = s.match(/const SF_SHIFTS = (\[[^\n]*\]);/);
  if (!m) { console.error('❌ Nie znalazłem „const SF_SHIFTS = [...]” w app.html.'); process.exit(2); }
  const cur = JSON.parse(m[1]).concat(events);
  s = s.replace(m[0], () => 'const SF_SHIFTS = ' + JSON.stringify(cur) + ';');
  fs.writeFileSync(file, s);
  console.log(`📝 Dopisano ${events.length} przesunięć do SF_SHIFTS w app.html — podbij CACHE_NAME w sw.js.`);
  process.exit(0);
}
console.log('\n❗ Najlepiej przenieś nowe słówka na KONIEC rozdziału. Jeśli kolejność ma zostać:');
console.log('   node sprawdz-kolejnosc-slowek.js' + (FROM !== 'HEAD' ? ' --od ' + FROM : '') + ' --dopisz');
process.exit(1);
