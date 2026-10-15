// Użycie: node convert-dxf.js <wyjście.json> <topoexport_3D_modeling.dxf> [--name "Nazwa"] [--landmark pkin|tallest|center]
//   Warszawa: node convert-dxf.js ../warsaw.json …/topoexport_3D_modeling.dxf --name "Warszawa — Śródmieście" --landmark pkin --center 512.5,512.5 --ext 515
//   Jeleniec: node convert-dxf.js ../../jeleniec/jeleniec.json …/topoexport_3D_modeling.dxf --name "Jeleniec" --landmark center
// topoexport 3D DXF → mapa Grammar City (budynki, drogi, zieleń, woda, drzewa, chodniki, misje).
// Układ gry: X = x − CX, Z = CZ − y (północ = −Z), wysokości spłaszczone (teren → 0).
// Środek i zasięg mapy liczone z siatki terenu; punkt orientacyjny (egzamin końcowy):
// 'pkin' — Pałac Kultury (iglica ~236 m z dala od Varso), 'tallest' — najwyższy budynek (np. kościół), 'center' — budynek w środku zabudowy (wieś bez wysokości w danych).
const parse = require('./bdxf.js');
const fs = require('fs');
const OUT = process.argv[2];
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NAME = arg('name', 'Warszawa — Śródmieście'), LANDMARK = arg('landmark', 'tallest');
const t = parse(process.argv[3] || 'topoexport_3D_modeling.dxf', 'i16');
let C = 512.5, CZ = 512.5, EXT = 515;       // środek i zasięg (±EXT) mapy — ustawiane z siatki terenu
const q1 = v => Math.round(v * 10) / 10;
const X = x => x - C, Z = y => CZ - y;
// wstępny przebieg: zasięg siatki terenu → środek i EXT
{ let sec0 = null, minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (let k = 0; k < t.length; k++) {
    const [c, v] = t[k];
    if (c === 0 && v === 'SECTION') { sec0 = t[k + 1][1]; continue; }
    if (sec0 !== 'ENTITIES' || c !== 0 || v !== 'MESH') continue;
    let j = k + 1; const tg = []; while (j < t.length && t[j][0] !== 0) tg.push(t[j++]);
    if ((tg.find(x => x[0] === 8) || [])[1] !== 'TPX_TERRAIN_TERRAIN_MESH') continue;
    for (const [cc, vv] of tg) { if (cc === 10) { minx = Math.min(minx, vv); maxx = Math.max(maxx, vv); } if (cc === 20) { miny = Math.min(miny, vv); maxy = Math.max(maxy, vv); } }
  }
  if (isFinite(minx)) { C = (minx + maxx) / 2; CZ = (miny + maxy) / 2; EXT = Math.floor(Math.min(maxx - minx, maxy - miny) / 2); }
  const ce = arg('center'), ee = arg('ext');                 // ręczne nadpisanie (Warszawa: --center 512.5,512.5 --ext 515)
  if (ce) [C, CZ] = ce.split(',').map(Number);
  if (ee) EXT = +ee;
  console.log('środek', C.toFixed(1), CZ.toFixed(1), 'EXT', EXT); }

const raw = { buildings: [], roads: [], green: [], water: [], trees: [], axes: [], rail: [], terrain: null };
let sec = null;
for (let k = 0; k < t.length; k++) {
  const [c, v] = t[k];
  if (c === 0 && v === 'SECTION') { sec = t[k + 1][1]; continue; }
  if (sec !== 'ENTITIES' || c !== 0) continue;
  let j = k + 1; const tags = [];
  while (j < t.length && t[j][0] !== 0) tags.push(t[j++]);
  const layer = (tags.find(x => x[0] === 8) || [])[1];
  if (v === 'MESH') {
    const kind = { TPX_BUILDINGS: 'buildings', TPX_ROADS_HATCH: 'roads', TPX_VEGETATION_GREEN_SPACES_HATCH: 'green', TPX_WATERWAYS_HATCH: 'water', TPX_TERRAIN_TERRAIN_MESH: 'terrain' }[layer];
    if (!kind) continue;
    let p = tags.findIndex(x => x[0] === 92); const nv = tags[p][1]; p++;
    const verts = [];
    for (let n = 0; n < nv; n++) { verts.push([X(tags[p][1]), tags[p + 2][1], Z(tags[p + 1][1])]); p += 3; }
    const qq = tags.findIndex((x, i) => i >= p && x[0] === 93); const fsz = tags[qq][1];
    const tris = []; let f = qq + 1; const end = qq + 1 + fsz;
    while (f < end) { const n = tags[f][1]; const idx = []; for (let m = 1; m <= n; m++) idx.push(tags[f + m][1]); f += n + 1;
      for (let m = 1; m + 1 < idx.length; m++) tris.push([idx[0], idx[m], idx[m + 1]]); }
    if (kind === 'terrain') raw.terrain = verts; else raw[kind].push({ verts, tris });
  } else if (v === 'INSERT' && layer === 'TPX_VEGETATION_TREES_INDIVIDUAL') {
    const g = cc => (tags.find(x => x[0] === cc) || [])[1];
    raw.trees.push([X(g(10)), Z(g(20)), g(41) || 1]);
  } else if (v === 'POLYLINE' && (layer === 'TPX_ROADS_AXES' || layer === 'TPX_RAILWAYS_AXES')) {
    const pts = []; let jj = j;
    while (t[jj] && !(t[jj][0] === 0 && t[jj][1] === 'SEQEND')) {
      if (t[jj][0] === 0 && t[jj][1] === 'VERTEX') { let a = jj + 1, x, y; while (t[a][0] !== 0) { if (t[a][0] === 10) x = t[a][1]; if (t[a][0] === 20) y = t[a][1]; a++; } pts.push([X(x), Z(y)]); }
      jj++;
    }
    (layer === 'TPX_ROADS_AXES' ? raw.axes : raw.rail).push(pts);
  }
}
const TX = [...new Set(raw.terrain.map(v => Math.round(v[0] * 100) / 100))].sort((a, b) => a - b);
const TZ = [...new Set(raw.terrain.map(v => Math.round(v[2] * 100) / 100))].sort((a, b) => a - b);
const TH = new Map(raw.terrain.map(v => [Math.round(v[0] * 100) / 100 + '|' + Math.round(v[2] * 100) / 100, v[1]]));
function terrainAt(x, z) {
  const fi = (arr, v) => { let i = 0; while (i < arr.length - 2 && arr[i + 1] < v) i++; return i; };
  const i = fi(TX, x), j = fi(TZ, z), x0 = TX[i], x1 = TX[i + 1], z0 = TZ[j], z1 = TZ[j + 1];
  const h = (a, b) => TH.get(a + '|' + b) || 0;
  const u = Math.max(0, Math.min(1, (x - x0) / (x1 - x0))), w = Math.max(0, Math.min(1, (z - z0) / (z1 - z0)));
  return (h(x0, z0) * (1 - u) + h(x1, z0) * u) * (1 - w) + (h(x0, z1) * (1 - u) + h(x1, z1) * u) * w;
}
const inExt = (x, z, m = 0) => Math.abs(x) <= EXT - m && Math.abs(z) <= EXT - m;

// ── budynki: siatka (spłaszczona do podstawy) + obrys do kolizji ──
const buildings = [];
for (const b of raw.buildings) {
  let zmin = Infinity, zmax = -Infinity;
  for (const v of b.verts) { zmin = Math.min(zmin, v[1]); zmax = Math.max(zmax, v[1]); }
  if (zmax - zmin < 1) continue;
  const bottom = b.tris.filter(tr => tr.every(i => b.verts[i][1] - zmin < 0.05));
  const ecount = new Map();
  for (const tr of bottom) for (let e = 0; e < 3; e++) {
    const a = tr[e], c2 = tr[(e + 1) % 3], key = a < c2 ? a + '_' + c2 : c2 + '_' + a;
    ecount.set(key, (ecount.get(key) || 0) + 1);
  }
  // krawędzie brzegowe → pętle (po współrzędnych, bo wierzchołki mogą się dublować)
  const kxz = i => q1(b.verts[i][0]) + ',' + q1(b.verts[i][2]);
  const adj = new Map();
  for (const [key, n] of ecount) if (n === 1) {
    const [a, c2] = key.split('_').map(Number), ka = kxz(a), kc = kxz(c2);
    if (ka === kc) continue;
    (adj.get(ka) || adj.set(ka, []).get(ka)).push(kc);
    (adj.get(kc) || adj.set(kc, []).get(kc)).push(ka);
  }
  const used = new Set(), rings = [];
  for (const start of adj.keys()) {
    if (used.has(start)) continue;
    const ring = [start]; used.add(start); let prev = null, cur = start;
    for (let guard = 0; guard < 5000; guard++) {
      const nx = (adj.get(cur) || []).find(n => n !== prev && (!used.has(n) || (n === start && ring.length > 2)));
      if (!nx || nx === start) break;
      ring.push(nx); used.add(nx); prev = cur; cur = nx;
    }
    if (ring.length >= 3) rings.push(ring.map(s => s.split(',').map(Number)));
  }
  if (!rings.length) continue;
  const area = r => { let s = 0; for (let i = 0; i < r.length; i++) { const [x1, z1] = r[i], [x2, z2] = r[(i + 1) % r.length]; s += x1 * z2 - x2 * z1; } return s / 2; };
  rings.sort((a, c2) => Math.abs(area(c2)) - Math.abs(area(a)));
  const outer = rings[0];
  let cx = 0, cz = 0; outer.forEach(([x, z]) => { cx += x; cz += z; }); cx /= outer.length; cz /= outer.length;
  if (!inExt(cx, cz)) continue;
  // teren pod obrysem (najniższy punkt) — część stoi na ziemi, jeśli jej dół jest przy terenie
  let T = Infinity; for (const [x, z] of outer) T = Math.min(T, terrainAt(x, z));
  const lift = zmin - T, ground = lift < 3;
  const base = ground ? zmin : T;          // część na ziemi: dół = 0; nadbudowa: zostaje na swojej wysokości
  const v = [], f = [];
  b.verts.forEach(p => v.push(q1(p[0]), q1(p[1] - base), q1(p[2])));
  b.tris.forEach(tr => { if (!ground || !tr.every(i => b.verts[i][1] - zmin < 0.05)) f.push(...tr); });
  buildings.push({ h: q1(zmax - base), ground, v, f, rings: rings.map(r => r.flat()), area: Math.abs(area(outer)), cx: q1(cx), cz: q1(cz) });
}

// ── powierzchnie płaskie: drogi / zieleń / woda (x,z + trójkąty) ──
function flatLayer(list) {
  const v = [], f = [];
  for (const m of list) {
    const base = v.length / 2;
    let any = false;
    m.verts.forEach(p => { v.push(q1(p[0]), q1(p[2])); if (inExt(p[0], p[2], -40)) any = true; });
    if (!any) { v.length = base * 2; continue; }
    m.tris.forEach(tr => f.push(tr[0] + base, tr[1] + base, tr[2] + base));
  }
  return { v, f };
}
const roads = flatLayer(raw.roads), green = flatLayer(raw.green), water = flatLayer(raw.water);

// ── raster 1 m: 1 = droga, 2 = budynek, 3 = woda (do wyboru miejsc) ──
const G = 2 * EXT, grid = new Uint8Array(G * G);
const gi = (x, z) => { const ix = Math.floor(x + EXT), iz = Math.floor(z + EXT); return ix < 0 || iz < 0 || ix >= G || iz >= G ? -1 : iz * G + ix; };
function rasterTri(ax, az, bx, bz, cx, cz, val) {
  const x0 = Math.max(-EXT, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(EXT - 1, Math.ceil(Math.max(ax, bx, cx)));
  const z0 = Math.max(-EXT, Math.floor(Math.min(az, bz, cz))), z1 = Math.min(EXT - 1, Math.ceil(Math.max(az, bz, cz)));
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) return;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, pz = z + 0.5;
    const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d, l3 = 1 - l1 - l2;
    if (l1 >= -0.02 && l2 >= -0.02 && l3 >= -0.02) { const k = gi(px, pz); if (k >= 0 && grid[k] < val) grid[k] = val; }
  }
}
const rasterFlat = (L, val) => { for (let i = 0; i < L.f.length; i += 3) { const a = L.f[i] * 2, b = L.f[i + 1] * 2, c = L.f[i + 2] * 2; rasterTri(L.v[a], L.v[a + 1], L.v[b], L.v[b + 1], L.v[c], L.v[c + 1], val); } };
rasterFlat(roads, 1); rasterFlat(water, 3);
for (const b of buildings) if (b.ground) for (let i = 0; i < b.f.length; i += 3) {
  const p = n => [b.v[n * 3], b.v[n * 3 + 2]];
  const [a, c2, d] = [p(b.f[i]), p(b.f[i + 1]), p(b.f[i + 2])];
  rasterTri(a[0], a[1], c2[0], c2[1], d[0], d[1], 2);
}
const cell = (x, z) => { const k = gi(x, z); return k < 0 ? 9 : grid[k]; };
// chodnik = nie droga/budynek/woda, z zapasem r od budynku/wody, droga w zasięgu near
function pavement(x, z, r = 2.5, near = 14) {
  if (!inExt(x, z, 8)) return false;
  for (let dz = -r; dz <= r; dz += 1) for (let dx = -r; dx <= r; dx += 1) { const c2 = cell(x + dx, z + dz); if (c2 >= 1) return false; }
  for (let a = 0; a < 8; a++) for (let s = 2; s <= near; s += 2) if (cell(x + Math.cos(a * Math.PI / 4) * s, z + Math.sin(a * Math.PI / 4) * s) === 1) return true;
  return false;
}

// ── punkty orientacyjne ──
const byH = [...buildings].sort((a, c2) => c2.h - a.h);
console.log('najwyższe:', byH.slice(0, 8).map(b => `${b.h}m area${Math.round(b.area)} @${b.cx},${b.cz}`).join(' | '));
// Punkt orientacyjny: Pałac Kultury (iglica 225–245 m daleko od Varso) albo najwyższy budynek
const varso = byH[0];
const pkin = LANDMARK === 'pkin'
  ? byH.filter(b => b.h > 225 && b.h < 245 && Math.hypot(b.cx - varso.cx, b.cz - varso.cz) > 150)[0]
  : LANDMARK === 'center'
    ? (() => { const gb = buildings.filter(b => b.ground && inExt(b.cx, b.cz, 60)); const mx = gb.reduce((s2, b) => s2 + b.cx, 0) / gb.length, mz = gb.reduce((s2, b) => s2 + b.cz, 0) / gb.length;
        return gb.filter(b => b.area > 60).sort((p, q) => Math.hypot(p.cx - mx, p.cz - mz) - Math.hypot(q.cx - mx, q.cz - mz))[0]; })()
    : byH.filter(b => b.ground && b.area > 40 && inExt(b.cx, b.cz, 60))[0] || byH[0];
console.log('punkt orientacyjny:', pkin.h, Math.round(pkin.area), pkin.cx, pkin.cz);
function nearestPavement(x, z, maxR = 120) {
  for (let r = 0; r <= maxR; r += 2) for (let a = 0; a < 32; a++) {
    const px = x + Math.cos(a / 32 * Math.PI * 2) * r, pz = z + Math.sin(a / 32 * Math.PI * 2) * r;
    if (pavement(px, pz, 2.5, 60)) return [q1(px), q1(pz)];
  }
  return null;
}
let finale, spawn;
if (LANDMARK === 'pkin') {
  // Finał przed wschodnią fasadą (Plac Defilad): idziemy na wschód od iglicy do końca budynku
  let ex = pkin.cx; while (ex < pkin.cx + 300 && cell(ex, pkin.cz) === 2) ex += 1;
  finale = nearestPavement(ex + 8, pkin.cz, 60) || [q1(ex + 8), q1(pkin.cz)];
  spawn = nearestPavement(finale[0] + 34, finale[1] + 4, 80);
} else {
  // Finał: najbliższy chodnik przy budynku; start ~30 m dalej w tym samym kierunku
  finale = nearestPavement(pkin.cx, pkin.cz, 150) || [q1(pkin.cx + 15), q1(pkin.cz)];
  const dx = finale[0] - pkin.cx, dz = finale[1] - pkin.cz, l = Math.hypot(dx, dz) || 1;
  spawn = nearestPavement(finale[0] + dx / l * 30, finale[1] + dz / l * 30, 80) || finale;
}
// ── miejsca na misje: chodniki, odstęp ≥ 110 m, sortowane po odległości od startu ──
const cands = [];
for (let z = -EXT + 20; z < EXT - 20; z += 6) for (let x = -EXT + 20; x < EXT - 20; x += 6) if (pavement(x, z)) cands.push([x, z]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const missionSpots = [];
const sorted = cands.map(p => [p, dist(p, spawn)]).sort((a, b) => a[1] - b[1]);
for (const gap of [110, 90, 70, 55]) {
  missionSpots.length = 0;
  for (const [p, d] of sorted) {
    if (d < Math.min(70, gap * 0.7)) continue;
    if (dist(p, finale) < Math.min(90, gap)) continue;
    if (missionSpots.every(s => dist(s, p) >= gap)) missionSpots.push(p.map(q1));
  }
  if (missionSpots.length >= 22) { console.log('odstęp misji', gap, 'm'); break; }
}
console.log('miejsca misji:', missionSpots.length, 'kandydatów chodnika:', cands.length);
// ── trasy pieszych i miejsca NPC: osie dróg przesunięte na chodnik ──
const pedPaths = [], parkSpots = [];
for (const ax of raw.axes) {
  for (const side of [1, -1]) for (const off of [7, 9, 11, 13]) {
    const pts = [];
    for (let i = 0; i < ax.length; i++) {
      const a = ax[Math.max(0, i - 1)], b = ax[Math.min(ax.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      pts.push([ax[i][0] - tz * off * side, ax[i][1] + tx * off * side]);
    }
    // podziel na odcinki, sprawdzając co ~2 m, czy chodnik
    let seg = [], len = 0; const segs = [];
    const flush = () => { if (len >= 30 && seg.length >= 2) segs.push(seg); seg = []; len = 0; };
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 2));
      let ok = true; for (let s = 0; s <= n; s++) { const x = x1 + (x2 - x1) * s / n, z = z1 + (z2 - z1) * s / n; if (!pavement(x, z, 1, 30)) { ok = false; break; } }
      if (ok) { if (!seg.length) seg.push([q1(x1), q1(z1)]); seg.push([q1(x2), q1(z2)]); len += L; } else flush();
    }
    flush();
    if (segs.length) { pedPaths.push(...segs.map(s => s.flat())); break; }
  }
  // zaparkowane auta: 3,2 m od osi (krawędź jezdni), co ~25 m
  let acc = 0;
  for (let i = 0; i + 1 < ax.length; i++) {
    const [x1, z1] = ax[i], [x2, z2] = ax[i + 1], L = Math.hypot(x2 - x1, z2 - z1); if (L < 1) continue;
    const tx = (x2 - x1) / L, tz = (z2 - z1) / L;
    for (let s = 0; s < L; s += 4) {
      acc += 4; if (acc < 25) continue;
      const x = x1 + tx * s - tz * 3.2, z = z1 + tz * s + tx * 3.2;
      if (cell(x, z) === 1 && cell(x - tz * 2.5, z + tx * 2.5) <= 1 && inExt(x, z, 20)) { parkSpots.push([q1(x), q1(z), q1(Math.atan2(tx, tz))]); acc = 0; }
    }
  }
}
console.log('trasy pieszych:', pedPaths.length, 'miejsca parkingowe:', parkSpots.length);
// drzewa (bez tych w budynkach / na jezdni)
const trees = [];
for (const [x, z, s] of raw.trees) if (inExt(x, z, 4) && cell(x, z) === 0) trees.push(q1(x), q1(z), q1(Math.max(0.7, Math.min(1.8, s))));
const axes = raw.axes.map(p => p.map(([x, z]) => [q1(x), q1(z)]).flat());
const rail = raw.rail.map(p => p.map(([x, z]) => [q1(x), q1(z)]).flat());

const out = {
  name: NAME, ext: EXT,
  attribution: 'Dane mapy: © Overture Maps Foundation (ODbL) · GUGiK NMT (CC BY 4.0) · Meta & WRI Global Canopy Height (CC BY 4.0) · eksport topoexport.com',
  spawn, finale, pkin: [pkin.cx, pkin.cz], landmark: [pkin.cx, pkin.cz, pkin.h],
  buildings: buildings.map(b => ({ h: b.h, g: b.ground ? 1 : 0, v: b.v, f: b.f, r: b.rings })),
  roads, green, water, trees, axes, rail, missionSpots, pedPaths, parkSpots
};
const s = JSON.stringify(out);
fs.writeFileSync(OUT, s);
console.log('budynki', buildings.length, 'drzewa', trees.length / 3, 'KB', Math.round(s.length / 1024), 'gzip KB', Math.round(require('zlib').gzipSync(s).length / 1024));
console.log('spawn', spawn, 'finale', finale);
