/* Grammar City — a small open-world 3D game for learning English grammar.
   Three.js r128 (global THREE). Data: questions.js (window.MISSIONS, window.TIERS). */
(() => {
'use strict';
const THREE = window.THREE;
const MISSIONS = window.MISSIONS;
const TIERS = window.TIERS;
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- utils
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry(20260924);
const rr = (a, b) => a + rand() * (b - a);
const pick = a => a[Math.floor(rand() * a.length)];
function shuffle(a, r = Math.random) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtMoney = n => '$' + Math.round(n).toLocaleString('en-US');
const norm = s => String(s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- city layout
const N = 8;                  // blocks per side
const B = 64;                 // block size
const R = 16;                 // road width
const CELL = B + R;
const SW = 5;                 // sidewalk width
const GAP = 4;                // gap between lots
const L = (B - 2 * SW - GAP) / 2; // lot size (25)
const HALF = (N * CELL + R) / 2;  // 328
const LANE = 4;
const SIDE_H = 0.3;
const BOUND = HALF + 70;
const rc = i => -HALF + R / 2 + i * CELL;          // road centre line i (0..N)
const bx0 = i => -HALF + R + i * CELL;             // block start
const bc = i => bx0(i) + B / 2;                     // block centre
const lot0 = (bi, li) => bx0(bi) + SW + li * (L + GAP);

function onBlock(x, z) {
  const u = x + HALF - R, v = z + HALF - R;
  if (u < 0 || v < 0) return false;
  const iu = Math.floor(u / CELL), iv = Math.floor(v / CELL);
  if (iu >= N || iv >= N) return false;
  return (u - iu * CELL) < B && (v - iv * CELL) < B;
}
const groundAt = (x, z) => (onBlock(x, z) ? SIDE_H : 0);

// ---------------------------------------------------------------- save
// Tryb słówek (vocab-missions.js) podaje własny klucz — osobny postęp per rozdział.
const SAVE_KEY = window.GC_SAVE_KEY || 'grammarCity.v1';
const freshSave = () => ({ done: {}, best: {}, money: 0, xp: 0 });
let save = freshSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.done) save = Object.assign(freshSave(), s); } catch (e) { /* storage unavailable */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }
// Garderoba i garaż są wspólne dla wszystkich trybów (gramatyka i słówka z każdego rozdziału);
// pieniądze zostają w zapisie danego trybu.
const WARDROBE_KEY = 'grammarCity.wardrobe.v1';
const freshWardrobe = () => ({ owned: { outfit_classic: 1, hat_cap: 1, hat_none: 1, glasses_none: 1, hair_blond: 1 },
  equip: { outfit: 'classic', hat: 'cap', glasses: 'none', hair: 'blond', vehicle: null }, talked: {} });
let wardrobe = freshWardrobe();
try {
  const w = JSON.parse(localStorage.getItem(WARDROBE_KEY));
  if (w && w.owned) { const f = freshWardrobe(); wardrobe = { owned: Object.assign(f.owned, w.owned), equip: Object.assign(f.equip, w.equip || {}), talked: w.talked || {} }; }
} catch (e) { /* storage unavailable */ }
function persistWardrobe() { try { localStorage.setItem(WARDROBE_KEY, JSON.stringify(wardrobe)); } catch (e) { /* ignore */ } }
const doneCount = () => Object.keys(save.done).length;
const isUnlocked = m => doneCount() >= TIERS[m.tier].need;
const RANKS = [[0, 'Tourist'], [3, 'Newcomer'], [7, 'Local'], [10, 'Street Smart'], [15, 'City Boss'], [19, 'Grammar Legend']];

// ---------------------------------------------------------------- renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const MAX_PR = Math.min(window.devicePixelRatio || 1, 1.5);
let pixelRatio = Math.min(MAX_PR, 1);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc3e8);
scene.fog = new THREE.Fog(0x8fc3e8, 170, 560);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
const hemi = new THREE.HemisphereLight(0xdbeeff, 0x4d5a3c, 0.62);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.95);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 420 });
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);
const MAXANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

// ---------------------------------------------------------------- caches
const GEO = {};
const geo = (k, fn) => GEO[k] || (GEO[k] = fn());
const MATS = {};
const mat = c => MATS[c] || (MATS[c] = new THREE.MeshLambertMaterial({ color: c }));

// Static geometry merging: many small coloured parts -> one draw call.
const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
function mergeColored(parts) {
  let count = 0;
  const gs = parts.map(p => { const g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); g.applyMatrix4(p.m); count += g.attributes.position.count; return [g, p.c]; });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  let o = 0;
  for (const [g, c] of gs) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < n; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
    o += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function partMatrix(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(sx, sy, sz));
}
const staticParts = [];
function addStatic(g, color, x, y, z, ry, sx, sy, sz) { staticParts.push({ g, m: partMatrix(x, y, z, ry, sx, sy, sz), c: new THREE.Color(color) }); }

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = MAXANISO;
  return t;
}
function noiseCanvas(w, base, spread, seedR) {
  const c = makeCanvas(w, w), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, w);
  const img = g.getImageData(0, 0, w, w), d = img.data, r = mulberry(seedR);
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * spread; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------- textures
function windowTextures(style) {
  const S = 256, day = makeCanvas(S, S), g = day.getContext('2d');
  g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, S, S);
  const ems = [makeCanvas(S, S), makeCanvas(S, S)];
  const eg = ems.map(c => { const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, S, S); return x; });
  const r = mulberry(style * 97 + 5);
  if (style === 0) {
    for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
      const x = cx * 64 + 12, y = cy * 64 + 12;
      g.fillStyle = '#cfcac0'; g.fillRect(x - 3, y - 3, 46, 46);
      const gr = g.createLinearGradient(x, y, x + 40, y + 40); gr.addColorStop(0, '#2c3d52'); gr.addColorStop(1, '#6d88a6');
      g.fillStyle = gr; g.fillRect(x, y, 40, 40);
      g.fillStyle = '#cfcac0'; g.fillRect(x + 19, y, 2, 40);
      eg.forEach((e, k) => { if (r() < 0.38) { e.fillStyle = r() < 0.8 ? '#ffd48a' : '#bfe3ff'; e.fillRect(x, y, 40, 40); } });
    }
  } else {
    for (let cy = 0; cy < 4; cy++) {
      const y = cy * 64 + 14;
      const gr = g.createLinearGradient(0, y, 0, y + 38); gr.addColorStop(0, '#3a5570'); gr.addColorStop(1, '#8fb0cc');
      g.fillStyle = gr; g.fillRect(0, y, S, 38);
      g.fillStyle = '#d8d4cb';
      for (let x = 0; x < S; x += 32) g.fillRect(x, y, 3, 38);
      eg.forEach(e => { for (let x = 0; x < S; x += 32) if (r() < 0.33) { e.fillStyle = r() < 0.7 ? '#ffe2a6' : '#d6ecff'; e.fillRect(x + 3, y, 29, 38); } });
    }
  }
  return { map: canvasTex(day, true), em: ems.map(c => canvasTex(c, true)) };
}
const WIN = [windowTextures(0), windowTextures(1)];
const WALL_TINTS = [0xece4d4, 0xc9d6e3, 0xdcc6a7, 0xbccab3, 0xe6cccc, 0xb4bcc8, 0xf2e7c9, 0xd6d0e6, 0xa9b8b0];
const winMats = [];
function wallMaterial(style, tint, emi) {
  const m = new THREE.MeshLambertMaterial({ color: tint, map: WIN[style].map, emissive: 0xffe2a8, emissiveMap: WIN[style].em[emi], emissiveIntensity: 0 });
  winMats.push(m);
  return m;
}
const wallPool = [];
for (let s = 0; s < 2; s++) for (const t of WALL_TINTS) wallPool.push(wallMaterial(s, t, wallPool.length % 2));
const roofMat = mat(0x5a5e66);

const asphaltTex = canvasTex(noiseCanvas(256, '#3d4148', 18, 3), true); asphaltTex.repeat.set(80, 80);
const grassTex = canvasTex(noiseCanvas(256, '#5f8d47', 30, 7), true); grassTex.repeat.set(400, 400);
const parkGrassTex = canvasTex(noiseCanvas(256, '#6a9a4e', 28, 9), true); parkGrassTex.repeat.set(10, 10);
const sidewalkTex = (() => {
  const c = noiseCanvas(128, '#bdb8ae', 14, 11), g = c.getContext('2d');
  g.strokeStyle = 'rgba(80,76,70,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  const t = canvasTex(c, true); t.repeat.set(20, 20); return t;
})();
const dashTex = (() => { const c = makeCanvas(8, 64), g = c.getContext('2d'); g.fillStyle = '#e9c64a'; g.fillRect(0, 0, 8, 32); const t = canvasTex(c, true); return t; })();
const zebraTex = (() => { const c = makeCanvas(128, 16), g = c.getContext('2d'); g.fillStyle = '#eeeeea'; for (let x = 4; x < 128; x += 16) g.fillRect(x, 0, 8, 16); return canvasTex(c, false); })();
const fadeTex = (() => { const c = makeCanvas(4, 128), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128); return canvasTex(c, false); })();

function buildingGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
  const uv = g.attributes.uv, TW = 16, TH = 14;
  for (let f = 0; f < 6; f++) {
    let su, sv;
    if (f < 2) { su = d / TW; sv = h / TH; } else if (f < 4) { su = w / TW; sv = d / TW; } else { su = w / TW; sv = h / TH; }
    for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); }
  }
  return g;
}

// ---------------------------------------------------------------- world state
const colliders = [];         // {x0,x1,z0,z1,h}
const addCol = (x0, x1, z0, z1, h) => colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h });
const mapRects = [];          // for the 2D map
const treeSpots = [];
const lampSpots = [];
const benches = [];
const markers = [];

function addBox(w, h, d, material, x, y, z) {
  addStatic(geo(`box${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d)), material.color, x, y, z);
  return { position: { x, y, z } };
}

// ---------------------------------------------------------------- mission placement
function layoutMissions() {
  for (const m of MISSIONS) {
    if (m.block) {
      const [bx, bz] = m.block, [lx, lz] = m.lot;
      const X0 = lot0(bx, lx), Z0 = lot0(bz, lz);
      m.side = lx === 0 ? -1 : 1;
      m.lotX0 = X0; m.lotZ0 = Z0;
      m.mx = lx === 0 ? X0 + 3 : X0 + L - 3;
      m.mz = Z0 + L / 2;
    } else if (m.park) {
      m.mx = bc(m.park[0]); m.mz = bc(m.park[1]) + 10;
    } else if (m.cityHall) {
      m.mx = bc(m.cityHall[0]); m.mz = bx0(m.cityHall[1]) + 52;
    }
  }
}
const nearMarker = (x, z, r) => MISSIONS.some(m => Math.hypot(m.mx - x, m.mz - z) < r);

// ---------------------------------------------------------------- signs & sprites
function signTexture(text, color) {
  const c = makeCanvas(1024, 240), g = c.getContext('2d');
  g.fillStyle = '#15171c'; g.fillRect(0, 0, 1024, 240);
  g.strokeStyle = color; g.lineWidth = 14; g.strokeRect(7, 7, 1010, 226);
  let fs = 132; g.font = `${fs}px Anton, Impact, sans-serif`;
  const t = text.toUpperCase();
  while (g.measureText(t).width > 930 && fs > 40) { fs -= 4; g.font = `${fs}px Anton, Impact, sans-serif`; }
  g.fillStyle = '#fff6e0'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(t, 512, 126);
  return canvasTex(c, false);
}
function addSign(text, color, x, y, z, angle, w = 13, h = 3.05) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, color) }));
  m.position.set(x, y, z); m.rotation.y = angle;
  scene.add(m);
  return m;
}

// ---------------------------------------------------------------- city construction
function buildGround() {
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ map: grassTex }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.03; grass.receiveShadow = true; scene.add(grass);
  const size = N * CELL + R;
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: asphaltTex }));
  asphalt.rotation.x = -Math.PI / 2; asphalt.receiveShadow = true; scene.add(asphalt);

  // centre-line dashes (instanced)
  const segLen = CELL - R - 10;
  const dashGeo = new THREE.PlaneGeometry(0.32, segLen); dashGeo.rotateX(-Math.PI / 2);
  const dashT = dashTex.clone(); dashT.needsUpdate = true; dashT.repeat.set(1, segLen / 6);
  const dashMat = new THREE.MeshBasicMaterial({ map: dashT, transparent: true, alphaTest: 0.5 });
  const count = (N + 1) * N * 2;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, count);
  const d = new THREE.Object3D(); let k = 0;
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    const mid = (rc(j) + rc(j + 1)) / 2;
    d.position.set(rc(i), 0.02, mid); d.rotation.set(0, 0, 0); d.updateMatrix(); dashes.setMatrixAt(k++, d.matrix);
    d.position.set(mid, 0.02, rc(i)); d.rotation.set(0, Math.PI / 2, 0); d.updateMatrix(); dashes.setMatrixAt(k++, d.matrix);
  }
  dashes.frustumCulled = false; scene.add(dashes);

  // zebra crossings (instanced)
  const zGeo = new THREE.PlaneGeometry(R - 2, 3.6); zGeo.rotateX(-Math.PI / 2);
  const zMat = new THREE.MeshBasicMaterial({ map: zebraTex, transparent: true, alphaTest: 0.5 });
  const spots = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = rc(i), z = rc(j), o = R / 2 + 2.2;
    if (j < N) spots.push([x, z + o, 0]); if (j > 0) spots.push([x, z - o, 0]);
    if (i < N) spots.push([x + o, z, Math.PI / 2]); if (i > 0) spots.push([x - o, z, Math.PI / 2]);
  }
  const zebras = new THREE.InstancedMesh(zGeo, zMat, spots.length);
  spots.forEach((s, n) => { d.position.set(s[0], 0.025, s[1]); d.rotation.set(0, s[2], 0); d.updateMatrix(); zebras.setMatrixAt(n, d.matrix); });
  zebras.frustumCulled = false; scene.add(zebras);
}

const PARKS = { '2,2': true, '5,3': true, '1,6': true, '6,1': true };
const slabMat = new THREE.MeshLambertMaterial({ map: sidewalkTex });

function buildCity() {
  layoutMissions();
  buildGround();
  const lotOwner = {};
  for (const m of MISSIONS) if (m.block) lotOwner[`${m.block[0]},${m.block[1]},${m.lot[0]},${m.lot[1]}`] = m;
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(B, SIDE_H, B), slabMat, N * N);
  slabs.receiveShadow = true; slabs.frustumCulled = false; scene.add(slabs);
  const sd = new THREE.Object3D();
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    const X = bx0(bx), Z = bx0(bz);
    sd.position.set(X + B / 2, SIDE_H / 2, Z + B / 2); sd.updateMatrix(); slabs.setMatrixAt(bx * N + bz, sd.matrix);
    mapRects.push({ x0: X, z0: Z, x1: X + B, z1: Z + B, c: '#2b3340' });
    const key = `${bx},${bz}`;
    const hallM = MISSIONS.find(m => m.cityHall && `${m.cityHall[0]},${m.cityHall[1]}` === key);
    if (hallM) { buildCityHall(X, Z, hallM); }
    else if (PARKS[key]) { buildPark(X, Z, MISSIONS.find(m => m.park && `${m.park[0]},${m.park[1]}` === key)); }
    else {
      for (let lx = 0; lx < 2; lx++) for (let lz = 0; lz < 2; lz++) {
        const m = lotOwner[`${bx},${bz},${lx},${lz}`];
        if (m) buildMissionBuilding(m); else buildNormalBuilding(lot0(bx, lx), lot0(bz, lz));
      }
    }
    // sidewalk furniture along the four edges
    for (let s = 0; s < 4; s++) for (let k = 0; k < 4; k++) {
      const t = 8 + k * 16, ins = 1.4;
      let x, z;
      if (s === 0) { x = X + t; z = Z + ins; } else if (s === 1) { x = X + t; z = Z + B - ins; }
      else if (s === 2) { x = X + ins; z = Z + t; } else { x = X + B - ins; z = Z + t; }
      if (nearMarker(x, z, 6)) continue;
      if (hallM && s === 1 && Math.abs(x - (X + B / 2)) < 20) continue;
      if (k % 2 === 0) treeSpots.push([x, z, rr(0.85, 1.2)]); else lampSpots.push([x, z]);
    }
  }
  // countryside around the city
  for (let i = 0; i < 360; i++) {
    const a = rand() * Math.PI * 2, r = HALF + rr(14, 230);
    let x = Math.cos(a) * r, z = Math.sin(a) * r;
    x = clamp(x, -HALF - 240, HALF + 240); z = clamp(z, -HALF - 240, HALF + 240);
    if (Math.abs(x) < HALF + 8 && Math.abs(z) < HALF + 8) continue;
    treeSpots.push([x, z, rr(1, 1.8)]);
  }
  buildTrees();
  buildLamps();
  // merged meshes
  wallPool.forEach((wm, i) => {
    if (!bldParts[i]) return;
    const mesh = new THREE.Mesh(mergeBuildings(bldParts[i]), [wm, roofMat]);
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
  });
  const st = new THREE.Mesh(mergeColored(staticParts), vcMat);
  st.castShadow = st.receiveShadow = true; st.frustumCulled = false; scene.add(st);
  staticParts.length = 0;
}

const bldParts = {};
function mergeBuildings(parts) {
  const W = { p: [], n: [], u: [] }, Rf = { p: [], n: [], u: [] };
  for (const { g, x, z } of parts) {
    const ng = g.toNonIndexed(), P = ng.attributes.position.array, Nn = ng.attributes.normal.array, U = ng.attributes.uv.array;
    for (let f = 0; f < 6; f++) {
      const dst = f === 2 || f === 3 ? Rf : W;
      for (let v = f * 6; v < f * 6 + 6; v++) {
        dst.p.push(P[v * 3] + x, P[v * 3 + 1], P[v * 3 + 2] + z);
        dst.n.push(Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2]);
        dst.u.push(U[v * 2], U[v * 2 + 1]);
      }
    }
    ng.dispose(); g.dispose();
  }
  const out = new THREE.BufferGeometry(), wc = W.p.length / 3, rcn = Rf.p.length / 3;
  out.setAttribute('position', new THREE.Float32BufferAttribute(W.p.concat(Rf.p), 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(W.n.concat(Rf.n), 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(W.u.concat(Rf.u), 2));
  out.addGroup(0, wc, 0); out.addGroup(wc, rcn, 1);
  out.computeBoundingSphere();
  return out;
}

function buildNormalBuilding(X0, Z0) {
  const w = L - rr(1, 6), d = L - rr(1, 6);
  const cx = X0 + L / 2 + rr(-1, 1) * (L - w) / 2, cz = Z0 + L / 2 + rr(-1, 1) * (L - d) / 2;
  const dc = Math.hypot(cx, cz) / HALF;
  const shop = rand() < 0.14;
  const h = shop ? rr(6, 9) : rr(8, 17) + Math.max(0, 1 - dc) * rr(8, 58);
  const wi = Math.floor(rand() * wallPool.length);
  (bldParts[wi] || (bldParts[wi] = [])).push({ g: buildingGeo(w, h, d), x: cx, z: cz });
  addCol(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h);
  mapRects.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, c: h > 40 ? '#4a5568' : '#3c4656' });
  if (!shop && rand() < 0.45) addBox(w * 0.3, 2, d * 0.3, mat(0x8a8d93), cx + rr(-w, w) * 0.2, h + 1, cz + rr(-d, d) * 0.2);
  if (!shop && h > 45 && rand() < 0.6) addBox(0.3, 9, 0.3, mat(0x9aa0a8), cx, h + 4.5, cz);
  if (shop) addBox(w + 1, 0.35, d + 1, mat(pick([0xb23a48, 0x2f7d6d, 0x3565a8, 0xd18a1f])), cx, 3.6, cz);
}

const MISSION_TINTS = [0xf0d7a8, 0xd2e4f2, 0xe8c9b8, 0xcfe0c4, 0xe4d2ec, 0xf5e2b8];
function buildMissionBuilding(m) {
  const X0 = m.lotX0, Z0 = m.lotZ0, sx = m.side;
  const x0 = sx < 0 ? X0 + 7 : X0 + 1, x1 = sx < 0 ? X0 + L - 1 : X0 + L - 7;
  const z0 = Z0 + 1, z1 = Z0 + L - 1;
  const w = x1 - x0, d = z1 - z0, h = 13 + m.tier * 3;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const color = TIERS[m.tier].color;
  const wall = wallMaterial(MISSIONS.indexOf(m) % 2, MISSION_TINTS[MISSIONS.indexOf(m) % MISSION_TINTS.length], 0);
  const mesh = new THREE.Mesh(buildingGeo(w, h, d), [wall, wall, roofMat, roofMat, wall, wall]);
  mesh.position.set(cx, 0, cz); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  addCol(x0, x1, z0, z1, h);
  mapRects.push({ x0, z0, x1, z1, c: '#5a4b2c' });
  const faceX = sx < 0 ? x0 : x1, ang = sx < 0 ? -Math.PI / 2 : Math.PI / 2;
  addBox(0.3, 3.4, 3.2, mat(0x2a2320), faceX + sx * 0.12, SIDE_H + 1.7, cz);
  addBox(2.2, 0.35, 9, new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }), faceX + sx * 1.1, 4.4, cz);
  addSign(m.place, color, faceX + sx * 0.1, 7.4, cz, ang, Math.min(14, d - 2), 3.2);
}

function buildCityHall(X, Z, m) {
  const cx = X + B / 2;
  const stone = mat(0xe8e1d0), stone2 = mat(0xd4ccb8);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(B - 2 * SW, B - 2 * SW), mat(0xcfc6b2));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(cx, SIDE_H + 0.01, Z + B / 2); plaza.receiveShadow = true; scene.add(plaza);
  const body = new THREE.Mesh(buildingGeo(40, 18, 26), [stone, stone, stone2, stone2, stone, stone]);
  body.position.set(cx, 0, Z + 8 + 13); body.castShadow = body.receiveShadow = true; scene.add(body);
  addCol(cx - 20, cx + 20, Z + 8, Z + 34, 18);
  // portico
  const colGeo = geo('column', () => new THREE.CylinderGeometry(0.75, 0.85, 14, 12));
  for (let i = 0; i < 8; i++) {
    const x = cx - 15.75 + i * 4.5;
    addStatic(colGeo, stone.color, x, SIDE_H + 7, Z + 38);
    addCol(x - 0.8, x + 0.8, Z + 37.2, Z + 38.8, 14);
  }
  addBox(38, 1.6, 7, stone2, cx, SIDE_H + 14.8, Z + 37);
  const pedGeo = geo('pediment', () => { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); return g; });
  addStatic(pedGeo, stone.color, cx, SIDE_H + 15.6 + 1.2, Z + 37, 0, 38, 2.4, 4);
  for (let s = 0; s < 3; s++) addBox(34 - s * 2, 0.35, 3, stone2, cx, SIDE_H + 0.17 + s * 0.35, Z + 41.5 - s * 1.2);
  addStatic(new THREE.SphereGeometry(8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0x5f9e8f, cx, 18, Z + 21);
  addBox(9, 3, 9, stone, cx, 17.5, Z + 21);
  addBox(0.25, 12, 0.25, mat(0xbbbbbb), cx, 32, Z + 21);
  addBox(3.2, 1.8, 0.08, mat(0xc0392b), cx + 1.7, 37, Z + 21);
  addSign('CITY HALL', TIERS[4].color, cx, SIDE_H + 12.4, Z + 40.6, 0, 16, 3.4);
  mapRects.push({ x0: cx - 20, z0: Z + 8, x1: cx + 20, z1: Z + 40, c: '#4b3d63' });
}

function buildPark(X, Z, m) {
  const inner = B - 2 * SW, cx = X + B / 2, cz = Z + B / 2;
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(inner, inner), new THREE.MeshLambertMaterial({ map: parkGrassTex }));
  grass.rotation.x = -Math.PI / 2; grass.position.set(cx, SIDE_H + 0.012, cz); grass.receiveShadow = true; scene.add(grass);
  const pathMat = mat(0xcdb48a);
  for (const rot of [0, Math.PI / 2]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4, inner), pathMat);
    p.rotation.set(-Math.PI / 2, 0, rot); p.position.set(cx, SIDE_H + 0.02, cz); p.receiveShadow = true; scene.add(p);
  }
  mapRects.push({ x0: X + SW, z0: Z + SW, x1: X + B - SW, z1: Z + B - SW, c: '#2d5237' });
  const clear = m ? 13 : 5;
  for (let i = 0; i < 26; i++) {
    const x = cx + rr(-inner / 2 + 2, inner / 2 - 2), z = cz + rr(-inner / 2 + 2, inner / 2 - 2);
    if (Math.abs(x - cx) < 3.5 || Math.abs(z - cz) < 3.5 || Math.hypot(x - cx, z - cz) < clear) continue;
    treeSpots.push([x, z, rr(0.9, 1.5)]);
  }
  for (const [dx, dz, rot] of [[5, 12, 0], [-5, -12, 0], [12, -5, 1], [-12, 5, 1]]) {
    const b = addBox(rot ? 0.7 : 2.4, 0.55, rot ? 2.4 : 0.7, mat(0x7a5230), cx + dx, SIDE_H + 0.28, cz + dz);
    addCol(b.position.x - (rot ? 0.35 : 1.2), b.position.x + (rot ? 0.35 : 1.2), b.position.z - (rot ? 1.2 : 0.35), b.position.z + (rot ? 1.2 : 0.35), 0.85);
  }
  if (m) {
    const stone = mat(0xbfb7a6);
    addStatic(new THREE.CylinderGeometry(4.6, 4.8, 0.9, 32), stone.color, cx, SIDE_H + 0.45, cz);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.1, 32), new THREE.MeshLambertMaterial({ color: 0x3f8fc9, transparent: true, opacity: 0.85 }));
    water.position.set(cx, SIDE_H + 0.86, cz); scene.add(water);
    addStatic(new THREE.CylinderGeometry(0.45, 0.6, 2.6, 12), stone.color, cx, SIDE_H + 2, cz);
    addStatic(new THREE.CylinderGeometry(1.6, 0.9, 0.45, 20), stone.color, cx, SIDE_H + 3.3, cz);
    const spray = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.35, depthWrite: false }));
    spray.position.set(cx, SIDE_H + 4.3, cz); spray.rotation.x = Math.PI; scene.add(spray);
    spray.userData.spray = true;
    addCol(cx - 4.6, cx + 4.6, cz - 4.6, cz + 4.6, 1.2);
    fountainSpray = spray;
  }
}
let fountainSpray = null;

function buildTrees() {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.6, 6); trunkGeo.translate(0, 1.3, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.9, 0); crownGeo.translate(0, 3.9, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x6b4a2f), treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), treeSpots.length);
  const d = new THREE.Object3D(), col = new THREE.Color();
  const greens = [0x4f8a3a, 0x3f7a32, 0x5d9a40, 0x6b8f2f, 0x2f6b3a];
  treeSpots.forEach(([x, z, s], i) => {
    d.position.set(x, groundAt(x, z), z); d.scale.set(s, s, s); d.rotation.set(0, rand() * 6, 0); d.updateMatrix();
    trunks.setMatrixAt(i, d.matrix); crowns.setMatrixAt(i, d.matrix);
    crowns.setColorAt(i, col.setHex(pick(greens)));
    if (Math.abs(x) < BOUND + 5 && Math.abs(z) < BOUND + 5) addCol(x - 0.35 * s, x + 0.35 * s, z - 0.35 * s, z + 0.35 * s, 6);
  });
  crowns.instanceColor.needsUpdate = true;
  trunks.castShadow = crowns.castShadow = true; crowns.receiveShadow = true;
  trunks.frustumCulled = crowns.frustumCulled = false;
  scene.add(trunks, crowns);
}
const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
function buildLamps() {
  const postGeo = new THREE.CylinderGeometry(0.09, 0.14, 6.4, 6); postGeo.translate(0, 3.2, 0);
  const headGeo = new THREE.BoxGeometry(0.55, 0.22, 0.55); headGeo.translate(0, 6.5, 0);
  const posts = new THREE.InstancedMesh(postGeo, mat(0x2b2f36), lampSpots.length);
  const heads = new THREE.InstancedMesh(headGeo, lampHeadMat, lampSpots.length);
  const d = new THREE.Object3D();
  lampSpots.forEach(([x, z], i) => {
    d.position.set(x, SIDE_H, z); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); heads.setMatrixAt(i, d.matrix);
    addCol(x - 0.18, x + 0.18, z - 0.18, z + 0.18, 7);
  });
  posts.castShadow = true; posts.frustumCulled = heads.frustumCulled = false;
  scene.add(posts, heads);
}

// ---------------------------------------------------------------- people
const SKINS = [0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xd9a47a];
const HAIRS = [0x2b1d14, 0x5a3a1e, 0x111111, 0xc9a25a, 0x8a4b24, 0x9a9a9a];
const SHIRTS = [0xd64545, 0x3b7dd8, 0x2fa36b, 0xf2b632, 0xeeeeee, 0x7a4fc9, 0x222831, 0xe07a3f, 0x3fb5b0, 0xc94f8a];
const PANTS = [0x2d3a5a, 0x222222, 0x5a4a3a, 0x3b5a8a, 0x6b6b6b, 0x2f4a3a];

// Zaokrąglone, bardziej „ludzkie" części ciała (cylindry + sfery zamiast boxów).
// r128 nie ma CapsuleGeometry, więc kończyny = zwężane cylindry, dłonie/stopy = sfery.
const PG = {
  // Tors: cylinder szerszy w barkach (góra), węższy w pasie, spłaszczony przód-tył.
  torso: () => geo('torso', () => new THREE.CylinderGeometry(0.30, 0.245, 0.74, 16).scale(1.18, 1, 0.62).translate(0, 0.37, 0)),
  neck: () => geo('neck', () => new THREE.CylinderGeometry(0.085, 0.1, 0.2, 12).translate(0, 0.1, 0)),
  head: () => geo('head', () => new THREE.SphereGeometry(0.2, 18, 14).scale(0.95, 1.06, 0.96)),
  hair: () => geo('hair', () => new THREE.SphereGeometry(0.215, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56).scale(0.99, 1.05, 1.02)),
  brim: () => geo('brim', () => new THREE.CylinderGeometry(0.17, 0.17, 0.035, 16).scale(1, 1, 1.35)),
  // Ramię: zwężany cylinder (bark → nadgarstek).
  arm: () => geo('arm', () => new THREE.CylinderGeometry(0.078, 0.055, 0.66, 12).translate(0, -0.33, 0)),
  hand: () => geo('hand', () => new THREE.SphereGeometry(0.082, 10, 8).scale(1, 1.05, 0.85)),
  // Noga: zwężany cylinder (udo → kostka).
  leg: () => geo('leg', () => new THREE.CylinderGeometry(0.115, 0.075, 0.98, 12).translate(0, -0.49, 0)),
  // But: zaokrąglony, wydłużony do przodu.
  shoe: () => geo('shoe', () => new THREE.SphereGeometry(0.16, 12, 8).scale(0.6, 0.5, 1.2)),
};
// Dodatkowe części: twarz, fryzury, ubrania, nakrycia głowy, okulary.
Object.assign(PG, {
  upperArm: () => geo('upperArm', () => new THREE.CylinderGeometry(0.08, 0.068, 0.34, 12).translate(0, -0.17, 0)),
  foreArm: () => geo('foreArm', () => new THREE.CylinderGeometry(0.066, 0.052, 0.34, 12).translate(0, -0.17, 0)),
  thigh: () => geo('thigh', () => new THREE.CylinderGeometry(0.118, 0.092, 0.5, 12).translate(0, -0.25, 0)),
  shin: () => geo('shin', () => new THREE.CylinderGeometry(0.09, 0.072, 0.5, 12).translate(0, -0.25, 0)),
  sole: () => geo('sole', () => new THREE.BoxGeometry(0.17, 0.04, 0.34)),
  eye: () => geo('eye', () => new THREE.SphereGeometry(0.034, 10, 8).scale(1.15, 1, 0.6)),
  pupil: () => geo('pupil', () => new THREE.SphereGeometry(0.019, 8, 6).scale(1, 1, 0.5)),
  brow: () => geo('brow', () => new THREE.BoxGeometry(0.07, 0.014, 0.02)),
  ear: () => geo('ear', () => new THREE.SphereGeometry(0.045, 8, 6).scale(0.5, 1, 0.8)),
  nose: () => geo('nose', () => new THREE.SphereGeometry(0.03, 8, 6).scale(0.9, 1.1, 1.3)),
  mouth: () => geo('mouth', () => new THREE.BoxGeometry(0.07, 0.014, 0.02)),
  belt: () => geo('belt', () => new THREE.CylinderGeometry(0.262, 0.262, 0.06, 16).scale(1.18, 1, 0.62)),
  jacket: () => geo('jacket', () => new THREE.CylinderGeometry(0.325, 0.27, 0.72, 16).scale(1.18, 1, 0.66).translate(0, 0.36, 0)),
  shirtFront: () => geo('shirtFront', () => new THREE.BoxGeometry(0.12, 0.6, 0.02)),
  hairLong: () => geo('hairLong', () => new THREE.CylinderGeometry(0.2, 0.17, 0.5, 14, 1, false, Math.PI * 0.2, Math.PI * 1.6).scale(1, 1, 0.9)),
  bun: () => geo('bun', () => new THREE.SphereGeometry(0.1, 10, 8)),
  skirt: () => geo('skirt', () => new THREE.CylinderGeometry(0.27, 0.42, 0.5, 16).scale(1.12, 1, 0.8)),
  beanie: () => geo('beanie', () => new THREE.SphereGeometry(0.225, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.15, 1.05)),
  hatCrown: () => geo('hatCrown', () => new THREE.CylinderGeometry(0.17, 0.2, 0.2, 16)),
  hatBrim: () => geo('hatBrim', () => new THREE.CylinderGeometry(0.34, 0.34, 0.025, 20)),
  hatBand: () => geo('hatBand', () => new THREE.CylinderGeometry(0.202, 0.205, 0.05, 16)),
  crownBase: () => geo('crownBase', () => new THREE.CylinderGeometry(0.2, 0.19, 0.12, 16, 1, true)),
  crownSpike: () => geo('crownSpike', () => new THREE.ConeGeometry(0.035, 0.11, 6)),
  lens: () => geo('lens', () => new THREE.BoxGeometry(0.13, 0.08, 0.02)),
  bridge: () => geo('bridge', () => new THREE.BoxGeometry(0.06, 0.018, 0.02)),
  pix: () => geo('pix', () => new THREE.BoxGeometry(0.024, 0.024, 0.03)),
});
// Pikselowe okulary „thug life" (Cash Glasses): X = czarny piksel, W = biały odblask.
const CASH_GLASSES = [
  'XXXXXXXXXXXXXXXXXXX',
  'XWWXXXXX.XWWXXXXX..',
  '.XXXXXX...XXXXXX...',
  '..XXXX.....XXXX....',
];
function coloredGeo(key, parts) {
  return geo(key, () => mergeColored(parts.map(([g, x, y, z, c, ry = 0, sx = 1, sy = 1, sz = 1]) => ({ g: g(), m: partMatrix(x, y, z, ry, sx, sy, sz), c: new THREE.Color(c) }))));
}
// o: { skin, hair, shirt, pants, shoes, hairStyle:'short'|'long'|'bun'|'bald', hat:'none'|'cap'|'beanie'|'fedora'|'crown',
//      hatColor, glasses:'none'|'sun'|'cash', sleeves:'short'|'long', jacket:color|null, skirt:bool, shadow }
function makePerson(o) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const hs = o.hairStyle || 'short', hat = o.hat || (o.cap ? 'cap' : 'none'), hatC = o.hatColor != null ? o.hatColor : o.hair;
  const shoes = o.shoes != null ? o.shoes : 0x1c1c1c;
  const body = [[PG.torso, 0, 0.98, 0, o.shirt], [PG.neck, 0, 1.7, 0, o.skin], [PG.head, 0, 1.98, 0, o.skin], [PG.belt, 0, 0.99, 0, 0x2a2420]];
  if (o.jacket != null) body.push([PG.jacket, 0, 0.98, 0, o.jacket], [PG.shirtFront, 0, 1.36, 0.205, o.shirt]);
  if (o.skirt) body.push([PG.skirt, 0, 0.78, 0, o.pants]);
  // twarz
  for (const s of [-1, 1]) {
    body.push([PG.eye, s * 0.072, 2.0, 0.165, 0xffffff], [PG.pupil, s * 0.072, 2.0, 0.186, 0x2b1d14],
      [PG.brow, s * 0.075, 2.06, 0.18, o.hair], [PG.ear, s * 0.19, 1.98, 0, o.skin]);
  }
  body.push([PG.nose, 0, 1.955, 0.195, o.skin], [PG.mouth, 0, 1.895, 0.18, 0x8a3b3b]);
  // włosy
  if (hs !== 'bald' && hat !== 'beanie') body.push([PG.hair, 0, 2.0, 0, o.hair]);
  if (hs === 'long') body.push([PG.hairLong, 0, 1.8, -0.02, o.hair]);
  if (hs === 'bun') body.push([PG.bun, 0, 2.17, -0.14, o.hair]);
  // nakrycie głowy
  if (hat === 'cap') body.push([PG.hair, 0, 2.02, 0, hatC], [PG.brim, 0, 2.05, 0.26, hatC]);
  else if (hat === 'beanie') body.push([PG.beanie, 0, 1.98, 0, hatC]);
  else if (hat === 'fedora') body.push([PG.hatBrim, 0, 2.14, 0, hatC], [PG.hatCrown, 0, 2.25, 0, hatC], [PG.hatBand, 0, 2.18, 0, 0x1b1b1b]);
  else if (hat === 'crown') {
    body.push([PG.crownBase, 0, 2.2, 0, 0xf5c518]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; body.push([PG.crownSpike, Math.sin(a) * 0.19, 2.31, Math.cos(a) * 0.19, i % 2 ? 0xf5c518 : 0xe11d48]); }
  }
  // okulary
  if (o.glasses === 'sun') body.push([PG.lens, -0.075, 2.0, 0.2, 0x111111], [PG.lens, 0.075, 2.0, 0.2, 0x111111], [PG.bridge, 0, 2.02, 0.205, 0x111111]);
  else if (o.glasses === 'cash') {
    const px = 0.024, w = CASH_GLASSES[0].length;
    CASH_GLASSES.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      body.push([PG.pix, (c - (w - 1) / 2) * px, 2.025 - r * px, 0.215, ch === 'W' ? 0xffffff : 0x050505]);
    }));
  }
  const add = (geom, parent) => { const m = new THREE.Mesh(geom, vcMat); m.castShadow = !!o.shadow; parent.add(m); return m; };
  const key = [o.shirt, o.skin, o.hair, o.pants, hs, hat, hatC, o.glasses || 'none', o.jacket, !!o.skirt].join('_');
  add(coloredGeo('pb' + key, body), g);
  const limb = (geom, px, py) => { const pivot = new THREE.Group(); pivot.position.set(px, py, 0); add(geom, pivot); g.add(pivot); return pivot; };
  const sleeve = o.jacket != null ? o.jacket : o.shirt;
  const longSleeve = o.sleeves === 'long' || o.jacket != null;
  const armG = coloredGeo(`pa${sleeve}_${o.skin}_${longSleeve}`, [[PG.upperArm, 0, 0, 0, sleeve], [PG.foreArm, 0, -0.33, 0, longSleeve ? sleeve : o.skin], [PG.hand, 0, -0.72, 0, o.skin]]);
  const legTop = o.skirt ? o.skin : o.pants;
  const legG = coloredGeo(`pl${legTop}_${o.skirt ? o.skin : o.pants}_${shoes}`, [[PG.thigh, 0, 0, 0, legTop], [PG.shin, 0, -0.48, 0, o.skirt ? o.skin : o.pants],
    [PG.shoe, 0, -0.93, 0.05, shoes], [PG.sole, 0, -1.0, 0.05, 0xeeeeee]]);
  const la = limb(armG, -0.4, 1.68), ra = limb(armG, 0.4, 1.68);
  const ll = limb(legG, -0.16, 1.0), rl = limb(legG, 0.16, 1.0);
  return { g, la, ra, ll, rl, phase: Math.random() * 6 };
}
// Losowy wygląd przechodnia / NPC.
function randomLook(r = Math.random) {
  const pk = a => a[Math.floor(r() * a.length)];
  const fem = r() < 0.5;
  return { skin: pk(SKINS), hair: pk(HAIRS), shirt: pk(SHIRTS), pants: pk(PANTS),
    hairStyle: fem ? pk(['long', 'long', 'bun', 'short']) : pk(['short', 'short', 'short', 'bald']),
    skirt: fem && r() < 0.35, sleeves: r() < 0.5 ? 'short' : 'long', jacket: r() < 0.25 ? pk([0x2b2f3a, 0x5a3a1e, 0x1e3a5f, 0x3b3b3b, 0x7a1f2b]) : null,
    hat: r() < 0.15 ? pk(['cap', 'beanie', 'fedora']) : 'none', hatColor: pk([0x1e3a5f, 0xb23a48, 0x2f2f2f, 0xd8c39a]),
    glasses: r() < 0.12 ? 'sun' : 'none', shoes: pk([0x1c1c1c, 0x5a3a1e, 0xf2f2f2]) };
}
function animPerson(p, speed, dt, air) {
  if (speed > 0.1) p.phase += dt * (2.4 + speed * 1.2);
  const amp = air ? 0.5 : Math.min(1, speed / 4) * 0.8;
  const s = air ? 0.6 : Math.sin(p.phase) * amp;
  p.ll.rotation.x = s; p.rl.rotation.x = air ? -0.3 : -s;
  p.la.rotation.x = -s * 0.9; p.ra.rotation.x = air ? -1.2 : s * 0.9;
}

// ---------------------------------------------------------------- vehicles
const CAR_COLORS = [0xc0392b, 0x2e86de, 0xf1f2f6, 0x222f3e, 0x10ac84, 0xe67e22, 0x8e44ad, 0x7f8c8d, 0x1e3799, 0xb33939, 0x218c74];

// Parametry jazdy per typ: przyspieszenie, prędkość maks., wsteczny, hamulec, skręt,
// kolizja (2 okręgi: przesunięcie off, promień rad), ride = kierowca widoczny (motor/hulajnoga).
const VSPEC = {
  car:      { acc: 15, max: 36, rev: 10, brake: 32, steer: 0.62, off: 1.3, rad: 1.12, exit: 2.4 },
  hatch:    { acc: 14, max: 33, rev: 10, brake: 32, steer: 0.7, off: 1.1, rad: 1.05, exit: 2.3 },
  suv:      { acc: 13, max: 34, rev: 9, brake: 30, steer: 0.58, off: 1.4, rad: 1.2, exit: 2.6 },
  van:      { acc: 11, max: 30, rev: 8, brake: 28, steer: 0.55, off: 1.45, rad: 1.2, exit: 2.6 },
  sport:    { acc: 20, max: 44, rev: 10, brake: 36, steer: 0.66, off: 1.3, rad: 1.12, exit: 2.4 },
  supercar: { acc: 25, max: 52, rev: 10, brake: 40, steer: 0.7, off: 1.35, rad: 1.15, exit: 2.4 },
  moto:     { acc: 24, max: 48, rev: 3, brake: 38, steer: 1.0, off: 0.55, rad: 0.55, exit: 1.4, ride: 'moto', seatY: 0.92, seatZ: -0.2 },
  scooter:  { acc: 8, max: 12.5, rev: 2, brake: 22, steer: 1.25, off: 0.35, rad: 0.45, exit: 1.2, ride: 'scooter', seatY: 0.2, seatZ: -0.1 },
};
const specOf = type => VSPEC[type] || VSPEC.car;
const VNAME = { moto: 'motor', scooter: 'hulajnogę' };

// Bryła z profilu bocznego (punkty [wzdłuż, wysokość]) wyciągnięta na szerokość auta.
function profileGeo(pts, width, bevel = 0.05) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.closePath();
  const depth = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);        // oś „wzdłuż" kształtu → oś Z świata (przód auta = +Z)
  return g;
}
// Profile aut: lower = karoseria do linii okien, glass = szklana kabina (węższa), roof = dach.
const CAR_SHAPES = {
  sedan: { len: 4.5, w: 2.0,
    lower: [[-2.25, 0.32], [2.25, 0.32], [2.32, 0.58], [2.18, 0.9], [0.95, 1.0], [-1.55, 1.02], [-2.2, 0.93], [-2.32, 0.6]],
    glass: [[0.95, 0.98], [0.2, 1.5], [-1.0, 1.52], [-1.68, 1.0]], roof: [0.15, -0.95, 1.5] },
  hatch: { len: 3.9, w: 1.9,
    lower: [[-1.95, 0.32], [1.95, 0.32], [2.0, 0.58], [1.85, 0.88], [0.85, 0.98], [-1.85, 1.0], [-2.0, 0.6]],
    glass: [[0.85, 0.96], [0.15, 1.5], [-1.6, 1.52], [-1.88, 1.0]], roof: [0.1, -1.55, 1.5] },
  suv: { len: 4.7, w: 2.1,
    lower: [[-2.35, 0.45], [2.35, 0.45], [2.42, 0.75], [2.3, 1.15], [1.1, 1.25], [-2.25, 1.27], [-2.42, 0.78]],
    glass: [[1.1, 1.22], [0.45, 1.85], [-2.05, 1.87], [-2.25, 1.25]], roof: [0.4, -2.0, 1.85] },
  van: { len: 5.0, w: 2.1,
    lower: [[-2.5, 0.4], [2.5, 0.4], [2.55, 0.75], [2.4, 1.15], [1.75, 1.3], [-2.5, 1.32], [-2.55, 0.75]],
    glass: [[1.75, 1.28], [1.15, 2.15], [-2.45, 2.17], [-2.5, 1.3]], roof: [1.1, -2.4, 2.15] },
  sport: { len: 4.4, w: 2.0,
    lower: [[-2.2, 0.3], [2.2, 0.3], [2.3, 0.5], [2.15, 0.72], [0.7, 0.86], [-1.7, 0.9], [-2.2, 0.82], [-2.3, 0.55]],
    glass: [[0.7, 0.84], [-0.05, 1.3], [-0.85, 1.32], [-1.75, 0.88]], roof: [-0.1, -0.8, 1.3] },
  supercar: { len: 4.6, w: 2.1,
    lower: [[-2.3, 0.26], [2.3, 0.26], [2.38, 0.42], [2.2, 0.6], [0.6, 0.78], [-1.9, 0.86], [-2.3, 0.82], [-2.38, 0.5]],
    glass: [[0.6, 0.76], [-0.25, 1.18], [-1.0, 1.2], [-1.95, 0.84]], roof: [-0.3, -0.95, 1.18] },
};
const TYPE_SHAPE = { sedan: 'sedan', taxi: 'sedan', police: 'sedan', hatch: 'hatch', suv: 'suv', van: 'van', sport: 'sport', supercar: 'supercar' };
const BOX = (w, h, d) => geo(`bx${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
const CYLX = (r, w, seg = 16) => geo(`cx${r}_${w}_${seg}`, () => new THREE.CylinderGeometry(r, r, w, seg).rotateZ(Math.PI / 2));
function carGeometry(type, color) {
  const S = CAR_SHAPES[TYPE_SHAPE[type] || 'sedan'], L2 = S.len / 2, W = S.w;
  const parts = [];
  const push = (g, x, y, z, c, ry, sx, sy, sz) => parts.push({ g, m: partMatrix(x, y, z, ry || 0, sx || 1, sy || 1, sz || 1), c: new THREE.Color(c) });
  push(geo(`pl_${type}`, () => profileGeo(S.lower, W, 0.08)), 0, 0, 0, color);
  push(geo(`pg_${type}`, () => profileGeo(S.glass, W * 0.86, 0.04)), 0, 0, 0, 0x16202b);
  const [rf, rb, ry] = S.roof;
  push(BOX(W * 0.84, 0.07, rf - rb), 0, ry + 0.02, (rf + rb) / 2, color);                  // dach
  push(BOX(W * 0.87, 0.5, 0.12), 0, (S.glass[0][1] + ry) / 2, (rf + rb) / 2 + 0.25, color); // słupek B
  const groundY = S.lower[0][1];
  // zderzaki, grill, tablice
  push(BOX(W * 0.98, 0.2, 0.22), 0, groundY + 0.12, L2 + 0.04, 0x2a2d33);
  push(BOX(W * 0.98, 0.2, 0.22), 0, groundY + 0.12, -L2 - 0.04, 0x2a2d33);
  push(BOX(W * 0.42, 0.16, 0.06), 0, groundY + 0.34, L2 + 0.08, 0x111418);
  push(BOX(0.52, 0.13, 0.03), 0, groundY + 0.13, L2 + 0.17, 0xf2f2f2);
  push(BOX(0.52, 0.13, 0.03), 0, groundY + 0.3, -L2 - 0.1, 0xf5d000);
  // światła
  const ly = groundY + 0.36;
  for (const s of [-1, 1]) {
    push(BOX(0.42, 0.13, 0.06), s * W * 0.33, ly, L2 + 0.04, 0xfdf6d8);
    push(BOX(0.4, 0.04, 0.06), s * W * 0.33, ly + 0.1, L2 + 0.03, 0xbfe6ff);
    push(BOX(0.38, 0.13, 0.06), s * W * 0.34, ly + 0.08, -L2 - 0.03, 0xe0161b);
    // lusterka
    push(BOX(0.22, 0.12, 0.1), s * (W / 2 + 0.08), S.glass[0][1] + 0.05, S.glass[0][0] - 0.15, color);
    push(BOX(0.04, 0.1, 0.09), s * (W / 2 + 0.19), S.glass[0][1] + 0.05, S.glass[0][0] - 0.15, 0x9fb3c8);
    // klamki i linia drzwi
    push(BOX(0.03, 0.04, 0.16), s * (W / 2 + 0.01), S.glass[0][1] - 0.18, 0.15, 0x9aa0a8);
    push(BOX(0.02, 0.5, 0.02), s * (W / 2 + 0.005), (groundY + S.glass[0][1]) / 2 + 0.1, (rf + rb) / 2 + 0.25, 0x1b1e23);
  }
  // koła: opona + felga + piasta
  const wr = type === 'suv' || type === 'van' ? 0.42 : 0.37, wz = L2 - (type === 'supercar' ? 0.75 : 0.85);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    push(CYLX(wr, 0.28, 18), sx * (W / 2 - 0.12), wr, sz * wz, 0x141414);
    push(CYLX(wr * 0.62, 0.3, 12), sx * (W / 2 - 0.12), wr, sz * wz, type === 'supercar' || type === 'sport' ? 0x2b2b2b : 0xc9ced6);
    push(CYLX(wr * 0.2, 0.32, 8), sx * (W / 2 - 0.12), wr, sz * wz, 0x6b7280);
  }
  // dodatki wg typu
  const top = ry + 0.06;
  if (type === 'taxi') { push(BOX(0.8, 0.24, 0.3), 0, top + 0.14, (rf + rb) / 2, 0x222222); push(BOX(0.7, 0.16, 0.32), 0, top + 0.14, (rf + rb) / 2, 0xffe36b); }
  if (type === 'police') {
    push(BOX(0.5, 0.16, 0.28), -0.3, top + 0.1, (rf + rb) / 2, 0xff2030); push(BOX(0.5, 0.16, 0.28), 0.3, top + 0.1, (rf + rb) / 2, 0x2060ff);
    for (const s of [-1, 1]) push(BOX(0.02, 0.18, S.len * 0.7), s * (W / 2 + 0.01), groundY + 0.48, 0, 0x1e3a8a);
  }
  if (type === 'suv') for (const s of [-1, 1]) push(BOX(0.06, 0.06, (rf - rb) * 0.9), s * W * 0.36, top + 0.05, (rf + rb) / 2, 0x2a2d33);
  if (type === 'supercar' || type === 'sport') {
    push(BOX(W * 0.9, 0.05, 0.32), 0, S.lower[6][1] + 0.22, -L2 + 0.25, 0x111111);           // spojler
    for (const s of [-1, 1]) push(BOX(0.06, 0.2, 0.06), s * W * 0.32, S.lower[6][1] + 0.1, -L2 + 0.25, 0x111111);
  }
  return mergeColored(parts);
}
// Motor sportowy w stylu „ninja": owiewka, zbiornik, siedzenie, widelec, wydech.
function motoGeometry(color) {
  const parts = [];
  const push = (g, x, y, z, c, rx = 0) => {
    const m = new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, 0, 0)), _s.set(1, 1, 1));
    parts.push({ g, m, c: new THREE.Color(c) });
  };
  for (const z of [0.78, -0.72]) {
    push(CYLX(0.33, 0.17, 20), 0, 0.33, z, 0x121212);
    push(CYLX(0.22, 0.19, 10), 0, 0.33, z, 0x2a2a2a);
    push(CYLX(0.07, 0.21, 8), 0, 0.33, z, 0xb8bec7);
  }
  push(geo('moto_fair', () => profileGeo([[0.95, 0.55], [1.05, 0.85], [0.75, 1.2], [0.25, 1.05], [0.05, 0.6], [0.45, 0.45]], 0.46, 0.06)), 0, 0, 0, color);
  push(geo('moto_tail', () => profileGeo([[-0.25, 0.8], [-1.05, 1.02], [-1.0, 0.92], [-0.3, 0.68]], 0.3, 0.05)), 0, 0, 0, color);
  push(geo('moto_tank', () => new THREE.SphereGeometry(0.26, 14, 10).scale(0.75, 0.62, 1.25)), 0, 0.98, 0.15, color);
  push(geo('moto_seat', () => new THREE.BoxGeometry(0.3, 0.09, 0.62)), 0, 0.93, -0.33, 0x151515);
  push(geo('moto_frame', () => new THREE.BoxGeometry(0.16, 0.22, 1.1)), 0, 0.6, 0.0, 0x2b2b2b);
  push(geo('moto_engine', () => new THREE.BoxGeometry(0.34, 0.32, 0.45)), 0, 0.52, 0.05, 0x3a3d42);
  push(geo('moto_screen', () => new THREE.BoxGeometry(0.3, 0.2, 0.03)), 0, 1.22, 0.78, 0x8fb7d6, -0.55);
  push(geo('moto_light', () => new THREE.BoxGeometry(0.26, 0.08, 0.05)), 0, 0.96, 1.05, 0xfdf6d8, -0.3);
  push(geo('moto_fork', () => new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8)), -0.1, 0.72, 0.68, 0xb8bec7, 0.38);
  push(geo('moto_fork', () => new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8)), 0.1, 0.72, 0.68, 0xb8bec7, 0.38);
  push(geo('moto_bar', () => new THREE.CylinderGeometry(0.025, 0.025, 0.62, 8).rotateZ(Math.PI / 2)), 0, 1.08, 0.5, 0x1b1b1b);
  push(geo('moto_exh', () => new THREE.CylinderGeometry(0.06, 0.07, 0.6, 10).rotateX(Math.PI / 2)), 0.2, 0.55, -0.55, 0xc0c4ca, -0.2);
  push(geo('moto_tl', () => new THREE.BoxGeometry(0.16, 0.05, 0.04)), 0, 0.98, -1.05, 0xe0161b);
  push(geo('moto_mirror', () => new THREE.BoxGeometry(0.12, 0.06, 0.03)), -0.3, 1.14, 0.55, 0x1b1b1b);
  push(geo('moto_mirror', () => new THREE.BoxGeometry(0.12, 0.06, 0.03)), 0.3, 1.14, 0.55, 0x1b1b1b);
  push(geo('moto_stripe', () => new THREE.BoxGeometry(0.47, 0.05, 0.4)), 0, 0.8, 0.62, 0x111111, -0.6);
  return mergeColored(parts);
}
// Hulajnoga elektryczna: deska, kierownica, wyświetlacz, małe koła, pomarańczowe akcenty.
function scooterGeometry(color) {
  const parts = [];
  const push = (g, x, y, z, c, rx = 0) => {
    const m = new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, 0, 0)), _s.set(1, 1, 1));
    parts.push({ g, m, c: new THREE.Color(c) });
  };
  for (const z of [0.55, -0.55]) { push(CYLX(0.2, 0.11, 18), 0, 0.2, z, 0x121212); push(CYLX(0.12, 0.12, 10), 0, 0.2, z, 0xff7a1a); }
  push(geo('sc_deck', () => new THREE.BoxGeometry(0.24, 0.07, 1.0)), 0, 0.22, -0.02, color);
  push(geo('sc_grip', () => new THREE.BoxGeometry(0.2, 0.01, 0.82)), 0, 0.26, -0.04, 0x0b0b0b);
  push(geo('sc_stem', () => new THREE.CylinderGeometry(0.035, 0.04, 1.0, 10)), 0, 0.72, 0.6, 0x2b2b2b, 0.12);
  push(geo('sc_bar', () => new THREE.CylinderGeometry(0.022, 0.022, 0.56, 8).rotateZ(Math.PI / 2)), 0, 1.2, 0.66, 0x1b1b1b);
  push(geo('sc_hand', () => new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8).rotateZ(Math.PI / 2)), -0.25, 1.2, 0.66, 0xff7a1a);
  push(geo('sc_hand', () => new THREE.CylinderGeometry(0.03, 0.03, 0.1, 8).rotateZ(Math.PI / 2)), 0.25, 1.2, 0.66, 0xff7a1a);
  push(geo('sc_disp', () => new THREE.BoxGeometry(0.1, 0.03, 0.08)), 0, 1.23, 0.66, 0x6ee7ff);
  push(geo('sc_fend', () => new THREE.BoxGeometry(0.14, 0.03, 0.34)), 0, 0.42, -0.55, 0xff7a1a);
  push(geo('sc_light', () => new THREE.BoxGeometry(0.08, 0.06, 0.04)), 0, 1.05, 0.66, 0xfdf6d8);
  return mergeColored(parts);
}
function makeCarMesh(type, color) {
  const g = type === 'moto' ? geo(`moto_${color}`, () => motoGeometry(color))
    : type === 'scooter' ? geo(`scooter_${color}`, () => scooterGeometry(color))
    : geo(`car2_${type}_${color}`, () => carGeometry(type, color));
  const mesh = new THREE.Mesh(g, vcMat);
  mesh.castShadow = true;
  mesh.rotation.order = 'YXZ';
  return { g: mesh, wheels: [], len: (CAR_SHAPES[TYPE_SHAPE[type]] || { len: 2 }).len };
}

const vehicles = [];
function spawnVehicle(type, color, x, z, heading, kind) {
  const c = makeCarMesh(type, color);
  const v = { mesh: c.g, wheels: c.wheels, type, spec: specOf(type), pos: new THREE.Vector3(x, 0, z), heading, speed: 0, steer: 0, kind, ai: null, honk: 0, lean: 0 };
  c.g.position.copy(v.pos); c.g.rotation.y = heading;
  scene.add(c.g);
  vehicles.push(v);
  return v;
}
function randomCarType() {
  const r = rand();
  return r < 0.12 ? 'taxi' : r < 0.2 ? 'van' : r < 0.27 ? 'sport' : r < 0.32 ? 'police' : r < 0.47 ? 'suv' : r < 0.64 ? 'hatch' : 'sedan';
}
function carColor(type) { return type === 'taxi' ? 0xf5c518 : type === 'police' ? 0xf1f2f6 : pick(CAR_COLORS); }

// traffic AI --------------------------------------------------------------
function laneXZ(a, along) {
  return a.axis === 'x' ? [along, rc(a.line) + LANE * a.dir] : [rc(a.line) - LANE * a.dir, along];
}
function choosePlan(a) {
  const opts = [];
  if (a.k + a.dir >= 0 && a.k + a.dir <= N) opts.push({ t: 's' }, { t: 's' });
  for (const d2 of [-1, 1]) if (a.line + d2 >= 0 && a.line + d2 <= N) opts.push({ t: 'turn', d2 });
  a.plan = opts[Math.floor(Math.random() * opts.length)];
  a.turnAt = a.plan.t === 'turn' ? (a.axis === 'x' ? rc(a.k) - LANE * a.plan.d2 : rc(a.k) + LANE * a.plan.d2) : rc(a.k);
}
function spawnTraffic(count) {
  let tries = 0;
  while (count > 0 && tries++ < 500) {
    const axis = rand() < 0.5 ? 'x' : 'z', dir = rand() < 0.5 ? 1 : -1, line = Math.floor(rand() * (N + 1));
    const k = dir > 0 ? 1 + Math.floor(rand() * N) : Math.floor(rand() * N);
    const along = rc(k) - dir * rr(14, CELL - 14);
    const a = { axis, dir, line, k, along, stuck: 0, ghost: 0 };
    const [x, z] = laneXZ(a, along);
    if (vehicles.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 14)) continue;
    const type = randomCarType();
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const v = spawnVehicle(type, carColor(type), x, z, heading, 'traffic');
    choosePlan(a);
    v.ai = a; v.speed = 8;
    count--;
  }
}
function spawnParked(count) {
  let tries = 0;
  while (count > 0 && tries++ < 400) {
    const axis = rand() < 0.5 ? 'x' : 'z', line = Math.floor(rand() * (N + 1)), seg = Math.floor(rand() * N);
    const along = (rc(seg) + rc(seg + 1)) / 2 + rr(-18, 18), side = rand() < 0.5 ? 1 : -1;
    const x = axis === 'x' ? along : rc(line) + side * 6.2, z = axis === 'x' ? rc(line) + side * 6.2 : along;
    if (vehicles.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 9)) continue;
    const type = randomCarType();
    spawnVehicle(type, carColor(type), x, z, axis === 'x' ? Math.PI / 2 : 0, 'parked');
    count--;
  }
}

// ---------------------------------------------------------------- pedestrians
const peds = [];
function spawnPeds(count) {
  const inset = 2.6, side = B - 2 * inset;
  for (let i = 0; i < count; i++) {
    const bx = Math.floor(rand() * N), bz = Math.floor(rand() * N);
    const p = makePerson(randomLook(rand));
    scene.add(p.g);
    peds.push({ p, x0: bx0(bx) + inset, z0: bx0(bz) + inset, side, s: rand() * side * 4, dir: rand() < 0.5 ? 1 : -1, speed: rr(1.2, 2.1),
      knock: 0, ox: 0, oz: 0, vx: 0, vz: 0, vy: 0, y: 0, pause: 0 });
  }
}
function pedPathPos(q) {
  const P = q.side * 4; let s = ((q.s % P) + P) % P;
  const sideIdx = Math.floor(s / q.side), t = s - sideIdx * q.side;
  let x, z, dx, dz;
  if (sideIdx === 0) { x = q.x0 + t; z = q.z0; dx = 1; dz = 0; }
  else if (sideIdx === 1) { x = q.x0 + q.side; z = q.z0 + t; dx = 0; dz = 1; }
  else if (sideIdx === 2) { x = q.x0 + q.side - t; z = q.z0 + q.side; dx = -1; dz = 0; }
  else { x = q.x0; z = q.z0 + q.side - t; dx = 0; dz = -1; }
  return [x, z, dx * q.dir, dz * q.dir];
}

// ---------------------------------------------------------------- mission markers
function badgeTexture(m, state) {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const col = state === 'locked' ? '#6b7280' : TIERS[m.tier].color;
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fillStyle = 'rgba(10,12,18,.88)'; g.fill();
  g.lineWidth = 9; g.strokeStyle = state === 'done' ? '#45d483' : col; g.stroke();
  g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (state === 'done') {
    g.strokeStyle = '#45d483'; g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.moveTo(38, 66); g.lineTo(56, 84); g.lineTo(90, 44); g.stroke();
  } else if (state === 'locked') {
    g.fillStyle = '#9aa1ad'; g.fillRect(44, 60, 40, 30);
    g.strokeStyle = '#9aa1ad'; g.lineWidth = 7; g.beginPath(); g.arc(64, 58, 13, Math.PI, 0); g.stroke();
  } else {
    g.font = `${m.short.length > 3 ? 30 : 36}px Anton, Impact, sans-serif`;
    g.fillText(m.short, 64, 58);
    g.font = '700 20px "Barlow Condensed", sans-serif'; g.fillStyle = '#f3eee4';
    g.fillText(m.level, 64, 88);
  }
  return canvasTex(c, false);
}
function labelTexture(m, state) {
  const c = makeCanvas(512, 128), g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '44px Anton, Impact, sans-serif';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(m.place.toUpperCase(), 256, 44);
  g.fillStyle = '#fff6e0'; g.fillText(m.place.toUpperCase(), 256, 44);
  g.font = '600 30px "Barlow Condensed", sans-serif';
  const sub = state === 'locked' ? `ZABLOKOWANE · poziom ${m.level}` : state === 'done' ? `UKOŃCZONO · ${save.best[m.id] || 0}%` : m.topic;
  g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 6; g.strokeText(sub, 256, 96);
  g.fillStyle = state === 'locked' ? '#b8bec8' : state === 'done' ? '#45d483' : TIERS[m.tier].color; g.fillText(sub, 256, 96);
  return canvasTex(c, false);
}
function missionState(m) { return save.done[m.id] ? 'done' : isUnlocked(m) ? 'open' : 'locked'; }

function createMarkers() {
  const ringGeo = new THREE.RingGeometry(1.9, 2.5, 40); ringGeo.rotateX(-Math.PI / 2);
  const cylGeo = new THREE.CylinderGeometry(2.3, 2.3, 2.4, 36, 1, true); cylGeo.translate(0, 1.2, 0);
  const beamGeo = new THREE.CylinderGeometry(0.9, 0.9, 140, 16, 1, true); beamGeo.translate(0, 70, 0);
  for (const m of MISSIONS) {
    const y = groundAt(m.mx, m.mz) + 0.03;
    const color = new THREE.Color(TIERS[m.tier].color);
    const mk = { m, y, state: null };
    mk.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    mk.cyl = new THREE.Mesh(cylGeo, new THREE.MeshBasicMaterial({ color, map: fadeTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    mk.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, map: fadeTex, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    mk.badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    mk.badge.scale.set(2.1, 2.1, 1);
    mk.label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, fog: false }));
    mk.label.scale.set(9, 2.25, 1);
    for (const o of [mk.ring, mk.cyl, mk.beam]) { o.position.set(m.mx, y, m.mz); scene.add(o); }
    mk.badge.position.set(m.mx, y + 3.6, m.mz); mk.label.position.set(m.mx, y + 5.6, m.mz);
    scene.add(mk.badge, mk.label);
    markers.push(mk);
  }
  refreshMarkers();
}
function refreshMarkers() {
  for (const mk of markers) {
    const st = missionState(mk.m);
    const best = save.best[mk.m.id] || 0;
    if (st === mk.state && mk.best === best) continue;
    mk.state = st; mk.best = best;
    mk.badge.material.map && mk.badge.material.map.dispose();
    mk.label.material.map && mk.label.material.map.dispose();
    mk.badge.material.map = badgeTexture(mk.m, st); mk.badge.material.needsUpdate = true;
    mk.label.material.map = labelTexture(mk.m, st); mk.label.material.needsUpdate = true;
    const col = new THREE.Color(st === 'locked' ? 0x6b7280 : st === 'done' ? 0x45d483 : TIERS[mk.m.tier].color);
    mk.ring.material.color.copy(col); mk.cyl.material.color.copy(col); mk.beam.material.color.copy(col);
    mk.beam.visible = st === 'open';
    mk.cyl.visible = st !== 'locked';
  }
}

// ---------------------------------------------------------------- player
// ---------------------------------------------------------------- sklep (katalog)
// cat: outfit | hat | glasses | hair | vehicle. price 0 = darmowe / startowe.
const SHOP = [
  { id: 'outfit_classic', cat: 'outfit', name: 'Klasyk', desc: 'Granatowa koszulka i dżinsy', price: 0, look: { shirt: 0x2b2f3a, pants: 0x3b5a8a, sleeves: 'short' } },
  { id: 'outfit_hoodie', cat: 'outfit', name: 'Bluza z kapturem', desc: 'Szara bluza, czarne spodnie', price: 250, look: { shirt: 0x8a8f99, pants: 0x222222, sleeves: 'long' } },
  { id: 'outfit_sport', cat: 'outfit', name: 'Dres sportowy', desc: 'Czerwony dres z długimi rękawami', price: 350, look: { shirt: 0xc0392b, pants: 0xc0392b, sleeves: 'long', shoes: 0xf2f2f2 } },
  { id: 'outfit_hawaii', cat: 'outfit', name: 'Hawajska koszula', desc: 'Na wakacje w mieście', price: 400, look: { shirt: 0x19b5a5, pants: 0xd8c39a, sleeves: 'short', shoes: 0x5a3a1e } },
  { id: 'outfit_leather', cat: 'outfit', name: 'Skórzana kurtka', desc: 'Styl rockowy', price: 700, look: { shirt: 0xeeeeee, pants: 0x222222, jacket: 0x1b1b1b } },
  { id: 'outfit_suit', cat: 'outfit', name: 'Garnitur', desc: 'Dla szefa miasta', price: 900, look: { shirt: 0xf5f5f5, pants: 0x1f2633, jacket: 0x1f2633, shoes: 0x111111 } },
  { id: 'outfit_gold', cat: 'outfit', name: 'Złoty strój', desc: 'Grammar Legend', price: 3000, look: { shirt: 0x111111, pants: 0x111111, jacket: 0xd4a017, shoes: 0xd4a017 } },
  { id: 'hat_none', cat: 'hat', name: 'Bez nakrycia', desc: 'Widać fryzurę', price: 0, hat: 'none' },
  { id: 'hat_cap', cat: 'hat', name: 'Czapka z daszkiem', desc: 'Klasyka', price: 0, hat: 'cap', hatColor: 0xf2b632 },
  { id: 'hat_beanie', cat: 'hat', name: 'Czapka zimowa', desc: 'Ciepła beanie', price: 150, hat: 'beanie', hatColor: 0x1e3a5f },
  { id: 'hat_fedora', cat: 'hat', name: 'Kapelusz', desc: 'Jak detektyw', price: 450, hat: 'fedora', hatColor: 0x3a2f28 },
  { id: 'hat_crown', cat: 'hat', name: 'Korona', desc: 'Król Grammar City', price: 5000, hat: 'crown' },
  { id: 'glasses_none', cat: 'glasses', name: 'Bez okularów', desc: '', price: 0, glasses: 'none' },
  { id: 'glasses_sun', cat: 'glasses', name: 'Okulary przeciwsłoneczne', desc: 'Tylko dla stylu', price: 200, glasses: 'sun' },
  { id: 'glasses_cash', cat: 'glasses', name: 'Cash Glasses', desc: 'Pikselowe okulary. Podwajają pieniądze za misje!', price: 1500, glasses: 'cash', perk: true },
  { id: 'hair_blond', cat: 'hair', name: 'Blond', desc: '', price: 0, hair: 0xf2b632, hairStyle: 'short' },
  { id: 'hair_dark', cat: 'hair', name: 'Ciemne krótkie', desc: '', price: 0, hair: 0x2b1d14, hairStyle: 'short' },
  { id: 'hair_long', cat: 'hair', name: 'Długie brązowe', desc: '', price: 100, hair: 0x5a3a1e, hairStyle: 'long' },
  { id: 'hair_bun', cat: 'hair', name: 'Kok', desc: '', price: 100, hair: 0x111111, hairStyle: 'bun' },
  { id: 'hair_red', cat: 'hair', name: 'Rude', desc: '', price: 150, hair: 0xb5501f, hairStyle: 'short' },
  { id: 'hair_bald', cat: 'hair', name: 'Łysy', desc: '', price: 0, hair: 0x2b1d14, hairStyle: 'bald' },
  { id: 'veh_scooter', cat: 'vehicle', name: 'Hulajnoga elektryczna Volt K-Pro', desc: 'Szybka e-hulajnoga, do ~45 km/h', price: 400, vtype: 'scooter', color: 0x2b2b2b },
  { id: 'veh_hatch', cat: 'vehicle', name: 'Hatchback City', desc: 'Małe miejskie auto', price: 800, vtype: 'hatch', color: 0x2e86de },
  { id: 'veh_suv', cat: 'vehicle', name: 'SUV Explorer', desc: 'Wysoki i stabilny', price: 1400, vtype: 'suv', color: 0x10ac84 },
  { id: 'veh_moto', cat: 'vehicle', name: 'Motor sportowy Raptor 600', desc: 'Zielona strzała, do ~170 km/h', price: 2200, vtype: 'moto', color: 0x63c132 },
  { id: 'veh_super', cat: 'vehicle', name: 'Supercar Fulmine', desc: 'Najszybsze auto w mieście', price: 4000, vtype: 'supercar', color: 0xe8410b },
];
const SHOP_CATS = [['outfit', '👕 Stroje'], ['hat', '🧢 Nakrycia głowy'], ['glasses', '🕶️ Okulary'], ['hair', '💇 Fryzury'], ['vehicle', '🏍️ Pojazdy']];
const shopItem = id => SHOP.find(i => i.id === id);
function playerLook() {
  const e = wardrobe.equip;
  const out = (shopItem('outfit_' + e.outfit) || SHOP[0]).look;
  const h = shopItem('hat_' + e.hat) || shopItem('hat_cap');
  const hair = shopItem('hair_' + e.hair) || shopItem('hair_blond');
  return Object.assign({ skin: 0xe8b98f, shadow: true, hair: hair.hair, hairStyle: hair.hairStyle, hat: h.hat, hatColor: h.hatColor,
    glasses: e.glasses || 'none', shoes: 0x1c1c1c }, out);
}
const hasCashGlasses = () => wardrobe.equip.glasses === 'cash';

let player = makePerson(playerLook());
scene.add(player.g);
// Przebudowa postaci gracza po zmianie stroju (pozycja i widoczność bez zmian).
function rebuildPlayer() {
  const old = player, np = makePerson(playerLook());
  np.g.position.copy(old.g.position); np.g.rotation.copy(old.g.rotation); np.g.visible = old.g.visible;
  scene.remove(old.g); scene.add(np.g);
  player = np;
}
const P = { pos: new THREE.Vector3(), vy: 0, facing: Math.PI, onGround: true, car: null, speed: 0 };

// GPS arrow
const gpsArrow = (() => {
  const g = new THREE.ConeGeometry(0.42, 1.1, 4); g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xc77dff, transparent: true, opacity: 0.92, depthTest: false }));
  m.renderOrder = 10; m.visible = false; scene.add(m); return m;
})();
const waypointBeam = (() => {
  const g = new THREE.CylinderGeometry(0.7, 0.7, 140, 12, 1, true); g.translate(0, 70, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xc77dff, map: fadeTex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  m.visible = false; scene.add(m); return m;
})();

// ---------------------------------------------------------------- input
const keys = new Set();
let ui = 'start';            // 'start' | null | 'quiz' | 'map' | 'help'
let camYaw = 0, camPitch = 0.3, camDist = 30, lastMouse = 0, dragging = false;
const pointerLocked = () => document.pointerLockElement === canvas;
function requestLock() { try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not allowed */ } }
function releaseLock() { if (pointerLocked()) { try { document.exitPointerLock(); } catch (e) { /* ignore */ } } }

canvas.addEventListener('click', () => { if (!ui) requestLock(); });
canvas.addEventListener('mousedown', e => { if (!ui && e.button === 0) dragging = true; });
window.addEventListener('mouseup', () => { dragging = false; });
document.addEventListener('pointerlockchange', () => { $('crosshint').hidden = pointerLocked() || hintDismissed; if (pointerLocked()) hintDismissed = true; });
let hintDismissed = false;
window.addEventListener('mousemove', e => {
  if (ui) return;
  if (pointerLocked() || dragging) {
    camYaw -= e.movementX * 0.0026;
    camPitch = clamp(camPitch + e.movementY * 0.0022, -0.15, 1.2);
    lastMouse = performance.now();
    if (dragging && !hintDismissed) { hintDismissed = true; $('crosshint').hidden = true; }
  }
});
window.addEventListener('blur', () => keys.clear());
window.addEventListener('keydown', e => {
  const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
  if (e.code === 'Escape') { onEscape(); return; }
  if (inInput) return;
  if (ui === 'quiz') { quizKey(e); return; }
  if (e.code === 'KeyM') { e.preventDefault(); ui === 'map' ? closeMap() : !ui && openMap(); return; }
  if (e.code === 'KeyH') { ui === 'help' ? closeHelp() : !ui && openHelp(); return; }
  if (e.code === 'KeyN') { Sound.toggle(); toast(Sound.muted ? 'Dźwięk wyłączony' : 'Dźwięk włączony'); return; }
  if (e.code === 'KeyB') { ui === 'shop' ? closeShop() : !ui && openShop(); return; }
  if (ui) return;
  if (e.code === 'KeyV' && !e.repeat) { summonVehicle(); return; }
  if (e.code === 'KeyT' && !e.repeat) { if (nearNPC && !P.car) openTalk(nearNPC); return; }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyF' && !e.repeat) toggleCar();
  if (e.code === 'KeyE' && !e.repeat) tryStartMission();
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
const key = (...c) => c.some(k => keys.has(k));

// ---------------------------------------------------------------- touch controls (phones & tablets)
let touchMode = false;
const touchUI = $('touch-ui');
const touchify = html => (touchMode ? html.replace(/<kbd>E<\/kbd>/g, '<kbd>MISJA</kbd>').replace(/<kbd>F<\/kbd>/g, '<kbd>AUTO</kbd>').replace('Naciśnij M', 'Dotknij MAPA') : html);
function enableTouch() {
  if (touchMode) return;
  touchMode = true;
  document.body.classList.add('touch');
  $('touch-note').hidden = false;
  setTimeout(resizeMinimap); // the minimap canvas is set up further down
}
if (matchMedia('(pointer: coarse)').matches) enableTouch();
window.addEventListener('touchstart', enableTouch, { passive: true, once: true });

// D-pad: the finger position relative to the centre picks W/A/S/D (diagonals included).
// Phones use native touch events (most reliable across mobile browsers); mouse/pen use pointer events.
const HAS_TOUCH = 'ontouchstart' in window;
const dpad = $('dpad'), knob = dpad.querySelector('.knob');
const DIRS = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
let dpadId = null, dpadRect = null;
function setDpad(dx, dy) {
  const want = { KeyW: dy < -0.3, KeyS: dy > 0.3, KeyA: dx < -0.3, KeyD: dx > 0.3 };
  for (const k in want) {
    if (want[k]) keys.add(k); else keys.delete(k);
    dpad.querySelector('.' + DIRS[k]).classList.toggle('on', want[k]);
  }
  const l = Math.min(1, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
  knob.style.transform = l ? `translate(${Math.cos(a) * l * 34}%, ${Math.sin(a) * l * 34}%)` : '';
}
// Some mobile browsers report clientX/Y as 0 for touches — fall back to page coordinates.
function touchXY(t) {
  let x = t.clientX, y = t.clientY;
  if (!x && !y) { x = (t.pageX || 0) - window.scrollX; y = (t.pageY || 0) - window.scrollY; }
  return [x, y];
}
function dpadAt(x, y) {
  const r = dpadRect && dpadRect.width > 0 ? dpadRect : (dpadRect = dpad.getBoundingClientRect());
  if (!(r.width > 0) || (!x && !y)) return; // ignore bogus samples instead of steering to the top-left
  setDpad((x - r.left - r.width / 2) / (r.width / 2), (y - r.top - r.height / 2) / (r.height / 2));
}
function dpadRelease() { dpadId = null; dpadRect = null; setDpad(0, 0); }
if (HAS_TOUCH) {
  dpad.addEventListener('touchstart', e => {
    e.preventDefault(); Sound.init();
    const t = e.changedTouches[0]; dpadId = 't' + t.identifier; dpadRect = dpad.getBoundingClientRect();
    dpadAt(...touchXY(t));
  }, { passive: false });
  dpad.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if ('t' + t.identifier === dpadId) dpadAt(...touchXY(t));
  }, { passive: false });
  const tEnd = e => { for (const t of e.changedTouches) if ('t' + t.identifier === dpadId) dpadRelease(); };
  dpad.addEventListener('touchend', tEnd); dpad.addEventListener('touchcancel', tEnd);
}
dpad.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return;
  e.preventDefault(); dpadId = 'p' + e.pointerId; dpadRect = dpad.getBoundingClientRect();
  try { dpad.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  dpadAt(e.clientX, e.clientY);
});
dpad.addEventListener('pointermove', e => { if (e.pointerType !== 'touch' && 'p' + e.pointerId === dpadId) dpadAt(e.clientX, e.clientY); });
const pEnd = e => { if (e.pointerType !== 'touch' && 'p' + e.pointerId === dpadId) dpadRelease(); };
dpad.addEventListener('pointerup', pEnd); dpad.addEventListener('pointercancel', pEnd);

// Hold buttons (jump / sprint) press a key while the finger is down.
touchUI.querySelectorAll('[data-hold]').forEach(b => {
  const code = b.dataset.hold;
  const down = e => { e.preventDefault(); Sound.init(); keys.add(code); b.classList.add('on'); };
  const up = () => { keys.delete(code); b.classList.remove('on'); };
  if (HAS_TOUCH) {
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
  }
  b.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') down(e); });
  b.addEventListener('pointerup', e => { if (e.pointerType !== 'touch') up(); });
  b.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') up(); });
});
// Tap buttons fire an action once.
const TAPS = { car: () => toggleCar(), mission: () => tryStartMission(), map: () => openMap(), shop: () => openShop(), call: () => summonVehicle() };
touchUI.querySelectorAll('[data-tap]').forEach(b => {
  const fire = e => { e.preventDefault(); Sound.init(); TAPS[b.dataset.tap](); };
  if (HAS_TOUCH) b.addEventListener('touchstart', fire, { passive: false });
  b.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') fire(e); });
});
// Tapping the minimap opens the full map.
$('minimap-wrap').addEventListener('click', () => { if (touchMode && !ui) openMap(); });
// The prompt is tappable too.
$('prompt').addEventListener('click', () => { if (!touchMode || ui) return; if (nearMission) tryStartMission(); else toggleCar(); });

// Drag anywhere on the 3D view to turn the camera.
let camTouch = null;
function camDrag(x, y) {
  if (!camTouch || ui || (!x && !y)) return;
  camYaw -= (x - camTouch.x) * 0.006;
  camPitch = clamp(camPitch + (y - camTouch.y) * 0.004, -0.15, 1.2);
  camTouch.x = x; camTouch.y = y;
  lastMouse = performance.now();
}
if (HAS_TOUCH) {
  canvas.addEventListener('touchstart', e => {
    if (ui || camTouch) return;
    const t = e.changedTouches[0], [x, y] = touchXY(t);
    camTouch = { id: t.identifier, x, y };
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (camTouch && t.identifier === camTouch.id) camDrag(...touchXY(t));
  }, { passive: false });
  const cEnd = e => { for (const t of e.changedTouches) if (camTouch && t.identifier === camTouch.id) camTouch = null; };
  canvas.addEventListener('touchend', cEnd); canvas.addEventListener('touchcancel', cEnd);
}

// Keep the touch buttons in sync with the game state.
let touchState = '';
function updateTouchUI() {
  if (!touchMode) return;
  const show = !ui;
  const carAvail = !!P.car || vehicles.some(v => Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z) < 4.5);
  const talkAvail = !nearMission && !!nearNPC && !P.car;
  const misAvail = (!!nearMission && !P.car && isUnlocked(nearMission)) || talkAvail;
  const st = `${show}|${carAvail}|${misAvail}|${!!P.car}|${talkAvail}`;
  if (st === touchState) return;
  touchState = st;
  touchUI.hidden = !show;
  if (!show) { keys.clear(); dpadRelease(); }
  $('t-car').classList.toggle('off', !carAvail);
  $('t-car').textContent = P.car ? 'WYSIĄDŹ' : 'AUTO';
  $('t-mission').classList.toggle('off', !misAvail);
  $('t-mission').textContent = talkAvail ? 'ROZMOWA' : 'MISJA';
  $('t-jump').textContent = P.car ? 'HAMULEC' : 'SKOK';
  $('t-sprint').classList.toggle('off', !!P.car);
}

function onEscape() {
  if (ui === 'map') closeMap();
  else if (ui === 'help') closeHelp();
  else if (ui === 'quiz') abortQuiz();
  else if (ui === 'talk') closeTalk();
  else if (ui === 'shop') closeShop();
}

// ---------------------------------------------------------------- sound
const Sound = {
  ctx: null, master: null, eng: null, engGain: null, engFilter: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 45;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 360;
      const g = this.ctx.createGain(); g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master); o.start();
      this.eng = o; this.engGain = g; this.engFilter = f;
    } catch (e) { this.ctx = null; }
  },
  toggle() { this.muted = !this.muted; window.GC_MUTED = this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.55; },
  tone(freq, dur, type = 'sine', vol = 0.18, delay = 0, end) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (end) o.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.3, freq = 700) {
    if (!this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
  },
  correct() { this.tone(660, 0.12, 'triangle', 0.2); this.tone(990, 0.22, 'triangle', 0.2, 0.09); },
  wrong() { this.tone(200, 0.3, 'sawtooth', 0.12, 0, 120); },
  click() { this.tone(900, 0.05, 'square', 0.06); },
  passed() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.2, i * 0.12)); this.tone(1319, 0.6, 'sine', 0.12, 0.5); },
  failed() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.1, i * 0.18)); },
  horn() { this.tone(392, 0.28, 'square', 0.07); this.tone(466, 0.28, 'square', 0.07); },
  crash(v) { this.noise(0.35, Math.min(0.6, v / 30), 500); },
  door() { this.noise(0.12, 0.25, 1500); },
  engine(active, speed, throttle) {
    if (!this.engGain) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(active ? 0.05 : 0, t, 0.15);
    this.eng.frequency.setTargetAtTime(38 + Math.abs(speed) * 3.1 + (throttle ? 12 : 0), t, 0.1);
    this.engFilter.frequency.setTargetAtTime(300 + Math.abs(speed) * 22, t, 0.1);
  },
};

// ---------------------------------------------------------------- collisions
let nearCols = [];
let nearTimer = 0;
function refreshNear(x, z) {
  const r = 48;
  nearCols = colliders.filter(b => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
}
function pushOut(p, r, list, feetY) {
  let moved = false;
  for (const b of list) {
    if (feetY !== undefined && feetY >= b.h) continue;
    const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    moved = true;
    if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else {
      const l = p.x - b.x0, rt = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rt, t, bt);
      if (m === l) p.x = b.x0 - r; else if (m === rt) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r;
    }
  }
  return moved;
}
const carFwd = v => ({ x: Math.sin(v.heading), z: Math.cos(v.heading) });
function carCircles(v) { const f = carFwd(v), o = (v.spec || VSPEC.car).off; return [[v.pos.x + f.x * o, v.pos.z + f.z * o], [v.pos.x - f.x * o, v.pos.z - f.z * o]]; }

// ---------------------------------------------------------------- player update
const tmpV = new THREE.Vector3();
function updateOnFoot(dt) {
  let fwd = 0, side = 0;
  if (!ui) {
    if (key('KeyW', 'ArrowUp')) fwd += 1;
    if (key('KeyS', 'ArrowDown')) fwd -= 1;
    if (key('KeyA')) side -= 1;
    if (key('KeyD')) side += 1;
    if (key('ArrowLeft')) camYaw += dt * 2.2;
    if (key('ArrowRight')) camYaw -= dt * 2.2;
  }
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let mx = fx * fwd + rx * side, mz = fz * fwd + rz * side;
  const len = Math.hypot(mx, mz);
  const sprint = key('ShiftLeft', 'ShiftRight');
  const target = len > 0 ? (sprint ? 10.5 : 5.2) : 0;
  P.speed = lerp(P.speed, target, Math.min(1, dt * 10));
  if (len > 0) { mx /= len; mz /= len; P.facing += angDiff(P.facing, Math.atan2(mx, mz)) * Math.min(1, dt * 12); P.mx = mx; P.mz = mz; }
  const vx = (P.mx || 0) * P.speed, vz = (P.mz || 0) * P.speed;
  P.pos.x += vx * dt; P.pos.z += vz * dt;
  // vertical
  const g = groundAt(P.pos.x, P.pos.z);
  if (!ui && key('Space') && P.onGround) { P.vy = 7.2; P.onGround = false; }
  P.vy -= 22 * dt; P.pos.y += P.vy * dt;
  if (P.pos.y <= g) { P.pos.y = g; P.vy = 0; P.onGround = true; }
  // collisions
  const p = { x: P.pos.x, z: P.pos.z };
  pushOut(p, 0.45, nearCols, P.pos.y + 0.01);
  for (const v of vehicles) {
    if (Math.abs(v.pos.x - p.x) > 6 || Math.abs(v.pos.z - p.z) > 6) continue;
    const lim = (v.spec || VSPEC.car).rad + 0.43;
    for (const [cx, cz] of carCircles(v)) {
      const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
      if (d < lim && d > 1e-4) { p.x = cx + dx / d * lim; p.z = cz + dz / d * lim; }
    }
  }
  P.pos.x = clamp(p.x, -BOUND, BOUND); P.pos.z = clamp(p.z, -BOUND, BOUND);
  player.g.position.copy(P.pos);
  player.g.rotation.y = P.facing;
  animPerson(player, P.speed, dt, !P.onGround);
}

const ACC = 15, MAXS = 36, MAXR = 10, BRAKE = 32;
let shake = 0, pedWarnT = 0;
function updateCar(v, dt) {
  const up = !ui && key('KeyW', 'ArrowUp'), down = !ui && key('KeyS', 'ArrowDown');
  const left = !ui && key('KeyA', 'ArrowLeft'), right = !ui && key('KeyD', 'ArrowRight');
  const hb = !ui && key('Space');
  const sp = v.spec || VSPEC.car;
  if (up) { v.speed += (v.speed < -0.5 ? sp.brake : sp.acc * (1 - v.speed / sp.max)) * dt; }
  else if (down) { v.speed -= (v.speed > 0.5 ? sp.brake : sp.acc * 0.7 * (1 + v.speed / sp.rev)) * dt; }
  else { v.speed *= 1 - Math.min(1, 0.55 * dt); if (Math.abs(v.speed) < 0.15) v.speed = 0; }
  if (hb) { v.speed *= 1 - Math.min(1, 2.2 * dt); }
  const steerIn = (left ? 1 : 0) - (right ? 1 : 0);
  v.steer = lerp(v.steer, steerIn, Math.min(1, dt * 6));
  const maxSteer = sp.steer / (1 + Math.abs(v.speed) * 0.045);
  v.heading += v.steer * maxSteer * v.speed / 3.0 * dt * (hb ? 1.7 : 1);
  const f = carFwd(v);
  v.pos.x += f.x * v.speed * dt; v.pos.z += f.z * v.speed * dt;
  // collisions: buildings & other vehicles
  let impact = 0;
  for (const off of [sp.off, -sp.off]) {
    const p = { x: v.pos.x + f.x * off, z: v.pos.z + f.z * off }, ox = p.x, oz = p.z;
    pushOut(p, sp.rad, nearCols);
    for (const o of vehicles) {
      if (o === v || Math.abs(o.pos.x - v.pos.x) > 8 || Math.abs(o.pos.z - v.pos.z) > 8) continue;
      const hit = sp.rad + (o.spec || VSPEC.car).rad;
      for (const [qx, qz] of carCircles(o)) {
        const dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
        if (d < hit && d > 1e-4) {
          const k = (hit - d) / d;
          if (o.kind === 'parked') { p.x += dx * k * 0.5; p.z += dz * k * 0.5; o.pos.x -= dx * k * 0.5; o.pos.z -= dz * k * 0.5; o.mesh.position.copy(o.pos); }
          else { p.x += dx * k; p.z += dz * k; }
        }
      }
    }
    const mx = p.x - ox, mz = p.z - oz, l = Math.hypot(mx, mz);
    if (l > 1e-6) {
      v.pos.x += mx; v.pos.z += mz;
      const dot = (f.x * mx + f.z * mz) / l;
      if (dot * v.speed < 0) { impact = Math.max(impact, Math.abs(v.speed * dot)); v.speed *= 1 - 1.3 * dot * dot; }
    }
  }
  if (impact > 7) { Sound.crash(impact); shake = Math.min(0.6, impact / 40); }
  v.pos.x = clamp(v.pos.x, -BOUND, BOUND); v.pos.z = clamp(v.pos.z, -BOUND, BOUND);
  v.pos.y = lerp(v.pos.y, groundAt(v.pos.x, v.pos.z), Math.min(1, dt * 12));
  // pedestrians
  if (Math.abs(v.speed) > 4) for (const q of peds) {
    if (q.knock > 0) continue;
    const qx = q.p.g.position.x, qz = q.p.g.position.z;
    for (const [cx, cz] of carCircles(v)) {
      if (Math.hypot(qx - cx, qz - cz) < sp.rad + 0.5) {
        q.knock = 3.2; q.vx = f.x * v.speed * 0.55 + (qx - cx) * 2; q.vz = f.z * v.speed * 0.55 + (qz - cz) * 2; q.vy = 5 + Math.abs(v.speed) * 0.1;
        v.speed *= 0.85; Sound.noise(0.18, 0.4, 400);
        if (performance.now() - pedWarnT > 2500) { pedWarnT = performance.now(); const fine = Math.min(save.money, 25); save.money -= fine; persist(); toast(`Uważaj na pieszych! −$${fine}`, 'bad'); }
        break;
      }
    }
  }
  poseCar(v, dt);
  if (sp.ride) posePlayerRider(v);
  Sound.engine(true, v.speed * (sp.ride === 'scooter' ? 0.4 : 1), up && sp.ride !== 'scooter');
}
// Gracz na motorze (siedzi, pochylony) lub hulajnodze (stoi) — pozycja i poza kończyn.
function posePlayerRider(v) {
  const sp = v.spec, f = carFwd(v);
  const lift = sp.ride === 'moto' ? sp.seatY - 1.0 : sp.seatY;
  player.g.position.set(v.pos.x + f.x * sp.seatZ, v.pos.y + lift, v.pos.z + f.z * sp.seatZ);
  player.g.rotation.set(sp.ride === 'moto' ? 0.32 : 0.06, v.heading, v.lean || 0);
  if (sp.ride === 'moto') { player.ll.rotation.set(-1.15, 0, -0.18); player.rl.rotation.set(-1.15, 0, 0.18); player.la.rotation.set(-1.25, 0, 0.15); player.ra.rotation.set(-1.25, 0, -0.15); }
  else { player.ll.rotation.set(0.12, 0, 0); player.rl.rotation.set(-0.15, 0, 0); player.la.rotation.set(-1.05, 0, 0.12); player.ra.rotation.set(-1.05, 0, -0.12); }
}
function poseCar(v, dt) {
  v.mesh.position.copy(v.pos);
  v.mesh.rotation.y = v.heading;
  if (v.spec && v.spec.ride) {
    const want = -(v.steer || 0) * Math.min(1, Math.abs(v.speed) / 14) * (v.spec.ride === 'moto' ? 0.42 : 0.22);
    v.lean = lerp(v.lean || 0, want, Math.min(1, dt * 6));
    v.mesh.rotation.z = v.lean;
  }
  const spin = v.speed * dt / 0.38;
  v.wheels.forEach((w, i) => { w.rotation.x += spin; if (i < 2) w.rotation.y = (v.steer || 0) * 0.45; });
}

function toggleCar() {
  if (P.car) {
    const v = P.car;
    if (Math.abs(v.speed) > 6) { toast('Zwolnij, żeby wysiąść!'); return; }
    const f = carFwd(v);
    for (const s of [1, -1]) {
      const ex = (v.spec || VSPEC.car).exit, x = v.pos.x + f.z * ex * s, z = v.pos.z - f.x * ex * s;
      const p = { x, z };
      if (!pushOut(p, 0.45, nearCols, 0.2) || s === -1) { P.pos.set(p.x, groundAt(p.x, p.z), p.z); break; }
    }
    v.kind = 'parked'; v.speed = 0; v.steer = 0; v.lean = 0; v.mesh.rotation.z = 0;
    P.car = null; player.g.visible = true; P.facing = v.heading; P.speed = 0;
    player.g.rotation.set(0, P.facing, 0);
    for (const l of [player.ll, player.rl, player.la, player.ra]) l.rotation.set(0, 0, 0);
    Sound.door(); Sound.engine(false, 0, false);
    $('speedo').hidden = true;
    return;
  }
  let best = null, bd = 4.5;
  for (const v of vehicles) { const d = Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z); if (d < bd) { bd = d; best = v; } }
  if (!best) return;
  if (best.ai) { best.ai = null; toast('Auto przejęte! Kierowca uciekł.', 'good'); }
  best.kind = 'player'; best.speed = 0; P.car = best; player.g.visible = !!(best.spec && best.spec.ride);
  Sound.door();
  $('speedo').hidden = false;
}

// ---------------------------------------------------------------- traffic update
function updateTraffic(dt) {
  const focus = P.car ? P.car.pos : P.pos;
  for (const v of vehicles) {
    const a = v.ai; if (!a) continue;
    const fx = a.axis === 'x' ? a.dir : 0, fz = a.axis === 'z' ? a.dir : 0;
    let ahead = Infinity, byPlayer = false;
    const look = (ox, oz, isP) => {
      const rx = ox - v.pos.x, rz = oz - v.pos.z, al = rx * fx + rz * fz;
      if (al <= 0 || al > 16) return;
      if (Math.abs(rx * fz - rz * fx) < 2.4 && al < ahead) { ahead = al; byPlayer = isP; }
    };
    if (a.ghost <= 0) for (const o of vehicles) if (o !== v) look(o.pos.x, o.pos.z, o === P.car);
    if (!P.car) look(P.pos.x, P.pos.z, true);
    else if (a.ghost > 0) look(P.car.pos.x, P.car.pos.z, true);
    let target = 11.5;
    if (ahead < 16) target = ahead < 6.5 ? 0 : target * (ahead - 6.5) / 9.5;
    if (a.plan.t === 'turn' && Math.abs(a.along - a.turnAt) < 12) target = Math.min(target, 6.5);
    v.speed = target < v.speed ? Math.max(target, v.speed - 20 * dt) : Math.min(target, v.speed + 5 * dt);
    if (v.speed < 0.3 && target === 0) {
      a.stuck += dt;
      if (byPlayer && a.stuck > 1.6 && v.honk <= 0 && Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z) < 45) { Sound.horn(); v.honk = 4; }
      if (!byPlayer && a.stuck > 2.5) { a.ghost = 2.5; a.stuck = 0; }
    } else a.stuck = 0;
    a.ghost -= dt; v.honk -= dt;
    // advance along lane
    a.along += a.dir * v.speed * dt;
    if ((a.along - a.turnAt) * a.dir >= 0) {
      if (a.plan.t === 's') { a.k += a.dir; choosePlan(a); }
      else {
        const over = (a.along - a.turnAt) * a.dir, d2 = a.plan.d2;
        const cross = a.axis === 'x' ? rc(a.line) + LANE * a.dir : rc(a.line) - LANE * a.dir;
        const oldLine = a.line;
        a.axis = a.axis === 'x' ? 'z' : 'x'; a.line = a.k; a.dir = d2; a.k = oldLine + d2; a.along = cross + d2 * over;
        choosePlan(a);
      }
    }
    const [x, z] = laneXZ(a, a.along);
    v.pos.set(x, 0, z);
    const hd = a.axis === 'x' ? (a.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (a.dir > 0 ? 0 : Math.PI);
    v.heading += angDiff(v.heading, hd) * Math.min(1, dt * 7);
    const far = Math.abs(x - focus.x) > 220 || Math.abs(z - focus.z) > 220;
    v.mesh.visible = !far;
    if (!far) poseCar(v, dt);
  }
}

// ---------------------------------------------------------------- pedestrian update
function updatePeds(dt) {
  const fx = camera.position.x, fz = camera.position.z;
  for (const q of peds) {
    const [px, pz, dx, dz] = pedPathPos(q);
    const far = Math.abs(px - fx) > 120 || Math.abs(pz - fz) > 120;
    q.p.g.visible = !far;
    if (q.knock > 0) {
      q.knock -= dt;
      q.ox += q.vx * dt; q.oz += q.vz * dt; q.y += q.vy * dt; q.vy -= 20 * dt;
      if (q.y <= 0) { q.y = 0; q.vy = 0; q.vx *= 1 - Math.min(1, dt * 6); q.vz *= 1 - Math.min(1, dt * 6); }
      const down = q.knock > 0.9;
      q.p.g.rotation.x = lerp(q.p.g.rotation.x, down ? -Math.PI / 2 : 0, Math.min(1, dt * (down ? 10 : 5)));
      animPerson(q.p, 0, dt, false);
    } else {
      q.p.g.rotation.x = 0;
      const back = Math.hypot(q.ox, q.oz);
      if (back > 0.01) { const k = Math.max(0, back - 2 * dt) / back; q.ox *= k; q.oz *= k; }
      // pause if the player stands right in front
      const tx = px + q.ox, tz = pz + q.oz;
      const block = !P.car && Math.hypot(P.pos.x - (tx + dx * 0.9), P.pos.z - (tz + dz * 0.9)) < 0.9;
      const sp = block ? 0 : q.speed;
      q.s += sp * dt * q.dir;
      if (!far) animPerson(q.p, sp, dt, false);
      q.p.g.rotation.y = Math.atan2(dx, dz);
    }
    const [nx, nz] = pedPathPos(q);
    q.p.g.position.set(nx + q.ox, SIDE_H + q.y, nz + q.oz);
  }
}

// ---------------------------------------------------------------- camera
function camBlocked(x, y, z) {
  for (const b of nearCols) if (y < b.h && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
  return false;
}
let attractT = 0;
function updateCamera(dt) {
  if (ui === 'start') {
    attractT += dt;
    const cx = bc(3), cz = bx0(3) + 30;
    camera.position.set(cx + Math.sin(attractT * 0.06) * 95, 48 + Math.sin(attractT * 0.1) * 8, cz + Math.cos(attractT * 0.06) * 95);
    camera.lookAt(cx, 8, cz);
    return;
  }
  const v = P.car;
  const t = v ? tmpV.set(v.pos.x, v.pos.y + 1.6, v.pos.z) : tmpV.set(P.pos.x, P.pos.y + 1.7, P.pos.z);
  if (v && performance.now() - lastMouse > 1300 && Math.abs(v.speed) > 1.5) {
    camYaw += angDiff(camYaw, v.heading + Math.PI) * Math.min(1, dt * 2.6);
    camPitch = lerp(camPitch, 0.22, Math.min(1, dt));
  }
  if (!v && touchMode && P.speed > 1 && performance.now() - lastMouse > 1200) {
    // follow unless the player runs back towards the camera
    const toward = -(Math.sin(P.facing) * -Math.sin(camYaw) + Math.cos(P.facing) * -Math.cos(camYaw));
    if (toward < 0.4) camYaw += angDiff(camYaw, P.facing + Math.PI) * Math.min(1, dt * 1.6);
  }
  const want = v ? 10.5 + Math.abs(v.speed) * 0.06 : 6.5;
  camDist = lerp(camDist, want, Math.min(1, dt * 3));
  const cp = Math.cos(camPitch), dx = Math.sin(camYaw) * cp, dy = Math.sin(camPitch), dz = Math.cos(camYaw) * cp;
  let d = camDist;
  for (let s = 1; s <= camDist; s += 0.35) {
    if (camBlocked(t.x + dx * s, t.y + dy * s, t.z + dz * s)) { d = Math.max(1.2, s - 0.5); break; }
  }
  camera.position.set(t.x + dx * d, Math.max(t.y + dy * d, 0.6), t.z + dz * d);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.5); }
  camera.lookAt(t);
  const fovT = v ? 62 + Math.min(14, Math.abs(v.speed) * 0.35) : 62;
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov = lerp(camera.fov, fovT, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------- day / night
const DAY_LEN = 720;
let tod = 0.36;
const cNight = new THREE.Color(0x0a1026), cDay = new THREE.Color(0x8fc3e8), cDusk = new THREE.Color(0xf0935a), skyC = new THREE.Color();
const lampOff = new THREE.Color(0xd0d0d0), lampOn = new THREE.Color(0xffd98a);
function updateSky(dt, focus) {
  tod = (tod + dt / DAY_LEN) % 1;
  const ang = (tod - 0.25) * Math.PI * 2, elev = Math.sin(ang);
  const day = smooth(-0.14, 0.28, elev);
  const dusk = Math.max(0, 1 - Math.abs(elev) / 0.3) * 0.6;
  skyC.copy(cNight).lerp(cDay, day).lerp(cDusk, dusk);
  scene.background.copy(skyC); scene.fog.color.copy(skyC);
  hemi.intensity = 0.28 + 0.42 * day;
  sun.intensity = 0.18 + 0.8 * day;
  sun.color.setRGB(1, lerp(0.8, 1, day), lerp(0.75, 0.97, day));
  if (elev < 0) sun.color.setRGB(0.6, 0.7, 1.0);
  const sx = Math.cos(ang), sy = Math.max(0.28, Math.abs(elev)), sz = 0.42;
  sun.position.set(focus.x + sx * 150, sy * 180, focus.z + sz * 150);
  sun.target.position.set(focus.x, 0, focus.z);
  const night = 1 - day;
  for (const m of winMats) m.emissiveIntensity = night * 0.95;
  lampHeadMat.color.copy(lampOff).lerp(lampOn, night);
  const h = Math.floor(tod * 24), mnt = Math.floor((tod * 24 - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(mnt).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- GPS
let gps = null; // {kind:'mission', m} | {kind:'point', x, z}
let route = null, routeT = 0;
function gpsTarget() { return !gps ? null : gps.kind === 'mission' ? { x: gps.m.mx, z: gps.m.mz } : { x: gps.x, z: gps.z }; }
function setGPS(g, silent) {
  gps = g; routeT = 0;
  if (g && !silent) toast(g.kind === 'mission' ? `GPS: ${g.m.place}` : 'GPS: punkt na mapie', 'route');
  waypointBeam.visible = !!(g && g.kind === 'point');
  if (g && g.kind === 'point') waypointBeam.position.set(g.x, 0, g.z);
  computeRoute();
}
function computeRoute() {
  const t = gpsTarget(); if (!t) { route = null; return; }
  const from = P.car ? P.car.pos : P.pos;
  const ni = x => clamp(Math.round((x + HALF - R / 2) / CELL), 0, N);
  const si = ni(from.x), sj = ni(from.z), ei = ni(t.x), ej = ni(t.z);
  const face = P.car ? carFwd(P.car) : { x: Math.sin(P.facing), z: Math.cos(P.facing) };
  const scoreA = Math.sign(ei - si) * face.x, scoreB = Math.sign(ej - sj) * face.z;
  const nodes = scoreA >= scoreB ? [[si, sj], [ei, sj], [ei, ej]] : [[si, sj], [si, ej], [ei, ej]];
  const pts = [{ x: from.x, z: from.z }];
  for (const [i, j] of nodes) { const p = { x: rc(i), z: rc(j) }; const l = pts[pts.length - 1]; if (Math.abs(l.x - p.x) > 0.1 || Math.abs(l.z - p.z) > 0.1) pts.push(p); }
  pts.push({ x: t.x, z: t.z });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  if (pts.length >= 3 && dist(pts[0], pts[2]) < dist(pts[1], pts[2])) pts.splice(1, 1);
  const n = pts.length;
  if (n >= 3 && dist(pts[n - 1], pts[n - 3]) < dist(pts[n - 2], pts[n - 3])) pts.splice(n - 2, 1);
  route = pts;
}
function routeLength() { if (!route) return 0; let s = 0; for (let i = 1; i < route.length; i++) s += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z); return s; }
function recommendMission() {
  const from = P.car ? P.car.pos : P.pos;
  const open = MISSIONS.filter(m => !save.done[m.id] && isUnlocked(m));
  if (!open.length) return null;
  open.sort((a, b) => (a.tier - b.tier) || (Math.hypot(a.mx - from.x, a.mz - from.z) - Math.hypot(b.mx - from.x, b.mz - from.z)));
  return open[0];
}

// ---------------------------------------------------------------- map rendering
const MAP_EXT = HALF + 70, MAPS = 1024, MSC = MAPS / (2 * MAP_EXT);
const w2m = v => (v + MAP_EXT) * MSC;
const mapCanvas = makeCanvas(MAPS, MAPS);
function buildMapCanvas() {
  const g = mapCanvas.getContext('2d');
  g.fillStyle = '#1e2a22'; g.fillRect(0, 0, MAPS, MAPS);
  const s = N * CELL + R;
  g.fillStyle = '#5b6578'; g.fillRect(w2m(-HALF), w2m(-HALF), s * MSC, s * MSC);
  for (const r of mapRects) { g.fillStyle = r.c; g.fillRect(w2m(r.x0), w2m(r.z0), (r.x1 - r.x0) * MSC, (r.z1 - r.z0) * MSC); }
  g.fillStyle = '#2f4a32';
  for (const [x, z] of treeSpots) if (!onBlock(x, z)) { g.beginPath(); g.arc(w2m(x), w2m(z), 2.2, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = 'rgba(233,198,74,.35)'; g.lineWidth = 1; g.setLineDash([4, 5]);
  for (let i = 0; i <= N; i++) {
    g.beginPath(); g.moveTo(w2m(rc(i)), w2m(-HALF)); g.lineTo(w2m(rc(i)), w2m(HALF)); g.stroke();
    g.beginPath(); g.moveTo(w2m(-HALF), w2m(rc(i))); g.lineTo(w2m(HALF), w2m(rc(i))); g.stroke();
  }
  g.setLineDash([]);
}
const mm = $('minimap'), mmCtx = mm.getContext('2d');
let mmZoom = 0.7;
function drawMinimap(dt) {
  const W = mm.width, c = W / 2, g = mmCtx;
  const focus = P.car ? P.car.pos : P.pos;
  mmZoom = lerp(mmZoom, P.car ? 0.42 + 0.3 / (1 + Math.abs(P.car.speed) * 0.08) : 0.72, Math.min(1, dt * 2));
  const zoom = mmZoom * (W / 230);
  g.save();
  g.clearRect(0, 0, W, W);
  g.beginPath(); g.arc(c, c, c - 1, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#18221b'; g.fillRect(0, 0, W, W);
  g.translate(c, c); g.rotate(camYaw); g.scale(zoom, zoom); g.translate(-w2m(focus.x), -w2m(focus.z));
  g.drawImage(mapCanvas, 0, 0);
  if (route) {
    g.strokeStyle = '#c77dff'; g.lineWidth = 7 / zoom; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); route.forEach((p, i) => (i ? g.lineTo(w2m(p.x), w2m(p.z)) : g.moveTo(w2m(p.x), w2m(p.z)))); g.stroke();
  }
  g.restore();
  // blips
  const cos = Math.cos(camYaw), sin = Math.sin(camYaw), rad = c - 12;
  const toScreen = (x, z) => { const dx = (x - focus.x) * MSC * zoom, dz = (z - focus.z) * MSC * zoom; return [dx * cos - dz * sin, dx * sin + dz * cos]; };
  const blip = (x, z, fill, text, clampEdge, ring) => {
    let [sx, sy] = toScreen(x, z); const d = Math.hypot(sx, sy);
    if (d > rad) { if (!clampEdge) return; sx *= rad / d; sy *= rad / d; }
    g.beginPath(); g.arc(c + sx, c + sy, 8, 0, Math.PI * 2); g.fillStyle = 'rgba(10,12,18,.9)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = fill; g.stroke();
    if (ring) { g.beginPath(); g.arc(c + sx, c + sy, 12, 0, Math.PI * 2); g.strokeStyle = '#c77dff'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = fill; g.font = '700 10px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c + sx, c + sy + 0.5);
  };
  for (const mk of markers) {
    const m = mk.m, st = mk.state, active = gps && gps.kind === 'mission' && gps.m === m;
    const col = st === 'locked' ? '#6b7280' : st === 'done' ? '#45d483' : TIERS[m.tier].color;
    blip(m.mx, m.mz, col, st === 'done' ? '✓' : m.short[0], active, active);
  }
  if (gps && gps.kind === 'point') blip(gps.x, gps.z, '#c77dff', '•', true, true);
  // north
  const [nx, ny] = (() => { const v = [0, -1]; return [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos]; })();
  g.fillStyle = '#f3eee4'; g.font = '700 13px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.beginPath(); g.arc(c + nx * (c - 12), c + ny * (c - 12), 9, 0, Math.PI * 2); g.fillStyle = 'rgba(10,12,18,.85)'; g.fill();
  g.fillStyle = '#f3eee4'; g.fillText('N', c + nx * (c - 12), c + ny * (c - 12) + 0.5);
  // player arrow
  const face = P.car ? P.car.heading : P.facing;
  const vx = Math.sin(face), vz = Math.cos(face);
  const a = Math.atan2(vx * sin + vz * cos, vx * cos - vz * sin);
  g.save(); g.translate(c, c); g.rotate(a);
  g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, -7); g.lineTo(-3, 0); g.lineTo(-7, 7); g.closePath();
  g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#111'; g.stroke();
  g.restore();
  g.beginPath(); g.arc(c, c, c - 1.5, 0, Math.PI * 2); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.8)'; g.stroke();
}

// big map
const bigmap = $('bigmap'), bmCtx = bigmap.getContext('2d');
let bm = { ox: 0, oy: 0, s: 1 };
function drawBigMap() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = bigmap.clientWidth, h = bigmap.clientHeight;
  if (bigmap.width !== Math.round(w * dpr) || bigmap.height !== Math.round(h * dpr)) { bigmap.width = Math.round(w * dpr); bigmap.height = Math.round(h * dpr); }
  const g = bmCtx; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0f1512'; g.fillRect(0, 0, w, h);
  const size = Math.min(w, h - 20) * 0.96;
  bm = { ox: (w - size) / 2, oy: (h - size) / 2 + 10, s: size / MAPS };
  g.drawImage(mapCanvas, bm.ox, bm.oy, size, size);
  const S = (x, z) => [bm.ox + w2m(x) * bm.s, bm.oy + w2m(z) * bm.s];
  if (route) {
    g.strokeStyle = '#c77dff'; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); route.forEach((p, i) => { const [x, y] = S(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  }
  const r = Math.max(9, Math.min(14, size / 60));
  for (const mk of markers) {
    const m = mk.m, [x, y] = S(m.mx, m.mz), st = mk.state;
    const col = st === 'locked' ? '#6b7280' : st === 'done' ? '#45d483' : TIERS[m.tier].color;
    const active = gps && gps.kind === 'mission' && gps.m === m;
    if (active) { g.beginPath(); g.arc(x, y, r + 6, 0, Math.PI * 2); g.strokeStyle = '#c77dff'; g.lineWidth = 3; g.stroke(); }
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = 'rgba(10,12,18,.92)'; g.fill(); g.lineWidth = 3; g.strokeStyle = col; g.stroke();
    g.fillStyle = col; g.font = `700 ${Math.round(r * 0.95)}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(st === 'done' ? '✓' : m.short, x, y + 1);
    if (size > 420) {
      g.font = `600 ${Math.round(r * 1.05)}px "Barlow Condensed", sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(m.place, x, y + r + 11);
      g.fillStyle = st === 'locked' ? '#9aa1ad' : '#f3eee4'; g.fillText(m.place, x, y + r + 11);
    }
  }
  if (gps && gps.kind === 'point') { const [x, y] = S(gps.x, gps.z); g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fillStyle = '#c77dff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); }
  const focus = P.car ? P.car.pos : P.pos, face = P.car ? P.car.heading : P.facing, [px, py] = S(focus.x, focus.z);
  g.save(); g.translate(px, py); g.rotate(Math.atan2(Math.cos(face), Math.sin(face)));
  g.beginPath(); g.moveTo(13, 0); g.lineTo(-8, -8); g.lineTo(-3, 0); g.lineTo(-8, 8); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#000'; g.stroke();
  g.restore();
}
bigmap.addEventListener('click', e => {
  const rect = bigmap.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  for (const mk of markers) {
    const x = bm.ox + w2m(mk.m.mx) * bm.s, y = bm.oy + w2m(mk.m.mz) * bm.s;
    if (Math.hypot(sx - x, sy - y) < 16) { setGPS({ kind: 'mission', m: mk.m }); drawBigMap(); renderMissionList(); return; }
  }
  const wx = (sx - bm.ox) / bm.s / MSC - MAP_EXT, wz = (sy - bm.oy) / bm.s / MSC - MAP_EXT;
  if (Math.abs(wx) > BOUND || Math.abs(wz) > BOUND) return;
  setGPS({ kind: 'point', x: wx, z: wz }); drawBigMap(); renderMissionList();
});
bigmap.addEventListener('contextmenu', e => { e.preventDefault(); setGPS(null); toast('GPS wyłączony'); drawBigMap(); renderMissionList(); });

function renderMissionList() {
  const list = $('mission-list');
  let html = '';
  TIERS.forEach((t, ti) => {
    const ms = MISSIONS.filter(m => m.tier === ti);
    const doneN = ms.filter(m => save.done[m.id]).length;
    const lockedTxt = doneCount() < t.need ? ` · odblokuj: ${t.need} misji` : '';
    html += `<div class="tier-label"><span style="color:${t.color}">${t.name}</span><span>${doneN}/${ms.length}${lockedTxt}</span></div>`;
    for (const m of ms) {
      const st = missionState(m), active = gps && gps.kind === 'mission' && gps.m === m;
      const status = st === 'done' ? `<span style="color:var(--green)">✓ ${save.best[m.id]}%</span>` : st === 'locked' ? '<span class="meta">Zablokowana</span>' : save.best[m.id] ? `<span style="color:var(--gold)">${save.best[m.id]}%</span>` : '<span style="color:var(--gold)">Nowa</span>';
      html += `<button class="mrow ${st === 'locked' ? 'locked' : ''} ${active ? 'active' : ''}" data-id="${m.id}">
        <span class="code" style="background:${st === 'locked' ? '#6b7280' : t.color}">${esc(m.short)}</span>
        <span><span class="nm">${esc(m.place)}</span><br><span class="tp">${esc(m.topic)}</span></span>
        <span class="st">${status}</span></button>`;
    }
  });
  list.innerHTML = html;
  list.querySelectorAll('.mrow').forEach(b => b.addEventListener('click', () => {
    const m = MISSIONS.find(x => x.id === b.dataset.id);
    setGPS({ kind: 'mission', m }); Sound.click(); drawBigMap(); renderMissionList();
  }));
}
function openMap() { ui = 'map'; keys.clear(); releaseLock(); computeRoute(); $('map-ov').hidden = false; renderMissionList(); requestAnimationFrame(drawBigMap); }
function closeMap() { ui = null; $('map-ov').hidden = true; canvas.focus(); }
$('map-close').addEventListener('click', closeMap);
function openHelp() { ui = 'help'; keys.clear(); releaseLock(); $('help-ov').hidden = false; }
function closeHelp() { ui = null; $('help-ov').hidden = true; canvas.focus(); }
$('help-close').addEventListener('click', closeHelp);

// ---------------------------------------------------------------- HUD
let shownMoney = save.money;
function toast(msg, cls = '', ms = 3200) {
  const box = $('toasts');
  const el = document.createElement('div'); el.className = `toast ${cls}`; el.innerHTML = touchify(msg);
  box.appendChild(el);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => el.remove(), ms);
}
let bannerTimer = 0;
function showBanner(title, sub, color, ms = 3200) {
  const b = $('banner');
  b.innerHTML = `<div class="b-inner"><h1 style="color:${color}">${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;
  b.hidden = false;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { b.hidden = true; }, ms);
}
let promptHTML = '';
function setPrompt(html) {
  if (html === promptHTML) return;
  promptHTML = html; const p = $('prompt');
  p.hidden = !html; p.innerHTML = touchify(html);
}
function updateHUD(dt, clock) {
  shownMoney = lerp(shownMoney, save.money, Math.min(1, dt * 4));
  if (Math.abs(shownMoney - save.money) < 1) shownMoney = save.money;
  $('money').textContent = fmtMoney(shownMoney);
  const dc = doneCount();
  let ri = 0; for (let i = 0; i < RANKS.length; i++) if (dc >= RANKS[i][0]) ri = i;
  $('rank').textContent = `${RANKS[ri][1]} · ${save.xp.toLocaleString('en-US')} XP`;
  const next = RANKS[ri + 1];
  $('xpfill').style.width = next ? `${((dc - RANKS[ri][0]) / (next[0] - RANKS[ri][0])) * 100}%` : '100%';
  $('clock').textContent = clock;
  $('done-count').textContent = `${dc}/${MISSIONS.length}`;
  if (P.car) $('speed').textContent = Math.round(Math.abs(P.car.speed) * 3.6);
  const obj = $('objective');
  const dist = route ? Math.round(routeLength()) : 0;
  let html;
  if (dc >= MISSIONS.length) html = (window.GC_DONE_TITLE || 'Grammar City należy do Ciebie!') + '<small>Wszystkie misje ukończone. Możesz je powtarzać, aby poprawić wynik.</small>';
  else if (gps && gps.kind === 'mission') html = `${P.car ? 'Jedź' : 'Idź'} do: ${esc(gps.m.place)}<small>${esc(gps.m.topic)} · ${gps.m.level} · ${dist} m</small>`;
  else if (gps) html = `Cel na mapie<small>${dist} m</small>`;
  else html = 'Wybierz misję na mapie<small>Naciśnij M, aby otworzyć mapę i ustawić GPS.</small>';
  html = touchify(html);
  if (obj.innerHTML !== html) obj.innerHTML = html;
  const gd = $('gpsdist');
  gd.hidden = !gps; if (gps) gd.textContent = `${dist} m`;
}

// ---------------------------------------------------------------- mission triggering
let nearMission = null;
function checkMissionProximity() {
  nearMission = null;
  let promptText = '';
  if (!P.car) {
    for (const mk of markers) {
      if (Math.hypot(mk.m.mx - P.pos.x, mk.m.mz - P.pos.z) < 2.7) { nearMission = mk.m; break; }
    }
  }
  if (nearMission) {
    const m = nearMission;
    if (!isUnlocked(m)) promptText = `<b>${esc(m.place)}</b> — zablokowane. Ukończ ${TIERS[m.tier].need} misji (masz ${doneCount()}).`;
    else promptText = `<kbd>E</kbd> ${save.done[m.id] ? 'Powtórz' : 'Rozpocznij'} misję: <b>${esc(m.place)}</b> · ${esc(m.topic)}`;
  } else if (P.car) {
    const close = markers.find(mk => Math.hypot(mk.m.mx - P.car.pos.x, mk.m.mz - P.car.pos.z) < 7 && mk.state !== 'locked');
    if (close) promptText = `<kbd>F</kbd> Wysiądź z auta i wejdź w znacznik: <b>${esc(close.m.place)}</b>`;
  } else if (nearNPC) {
    promptText = `<kbd>T</kbd> Porozmawiaj: <b>${esc(nearNPC.t.name)}</b> · ${esc(nearNPC.t.role)}${nearNPC.done ? ' ✓' : ` · <span style="color:var(--cash)">+${fmtMoney(TALK_REWARD)}</span>`}`;
  } else {
    const car = vehicles.find(v => Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z) < 4.5);
    if (car) promptText = `<kbd>F</kbd> ${car.ai ? 'Przejmij auto' : VNAME[car.type] ? 'Wsiądź na ' + VNAME[car.type] : car.owned ? 'Wsiądź do swojego auta' : 'Wsiądź do auta'}`;
  }
  setPrompt(promptText);
}
function tryStartMission() {
  if (!nearMission && nearNPC && !P.car) { openTalk(nearNPC); return; }
  if (!nearMission || P.car) return;
  if (!isUnlocked(nearMission)) { Sound.wrong(); return; }
  openBriefing(nearMission);
}

// ---------------------------------------------------------------- quiz
const qCard = $('quiz-card');
let quiz = null;
const TYPE_LABEL = { c: 'Wybierz poprawną odpowiedź', t: 'Wpisz brakujące słowo', o: 'Ułóż zdanie z rozsypanki' };

function openBriefing(m) {
  ui = 'quiz'; keys.clear(); releaseLock(); setPrompt('');
  quiz = { m, stage: 'brief' };
  const color = TIERS[m.tier].color;
  const nQ = m.final ? 15 : 7;
  const best = save.best[m.id];
  qCard.innerHTML = `
    <div class="card-head">
      <div class="eyebrow"><span class="chip" style="background:${color}">${m.level}</span>Misja ${MISSIONS.indexOf(m) + 1} z ${MISSIONS.length}</div>
      <h2 class="place">${esc(m.place)}</h2>
      <div class="topic">${esc(m.topic)}</div>
    </div>
    <div class="card-body">
      <div class="npc">
        <div class="npc-avatar" style="background:${color}">${esc(m.npc[0])}</div>
        <div>
          <div class="npc-name">${esc(m.npc)}</div>
          <p class="story">“${esc(m.story)}”</p>
          <button class="linkbtn" id="tr-btn">Pokaż tłumaczenie</button>
          <p class="story-pl" id="story-pl" hidden>${esc(m.storyPL)}</p>
        </div>
      </div>
      <div class="tip"><div class="tip-title">${window.GC_TIP_TITLE || 'Ściąga gramatyczna'}</div>${m.tip}</div>
      <div class="actions">
        <button class="btn" id="q-start">Rozpocznij misję</button>
        <button class="btn ghost" id="q-cancel">Wróć</button>
        <span class="meta">${nQ} pytań · zaliczenie od 70%${best ? ` · najlepszy wynik: ${best}%` : ''}</span>
      </div>
    </div>`;
  $('quiz-ov').hidden = false;
  qCard.scrollTop = 0;
  $('tr-btn').onclick = () => { const p = $('story-pl'); p.hidden = !p.hidden; $('tr-btn').textContent = p.hidden ? 'Pokaż tłumaczenie' : 'Ukryj tłumaczenie'; };
  $('q-start').onclick = () => startQuiz(m);
  $('q-cancel').onclick = closeQuiz;
  $('q-start').focus();
  Sound.click();
}
function buildQuestions(m) {
  let pool;
  if (m.final && m.questions && m.questions.length) {
    // Tryb słówek: finał ma własną pulę pytań (src = misja, z której pochodzi słowo).
    pool = shuffle(m.questions.slice()).slice(0, 15).map(q => Object.assign({ src: m }, q));
  } else if (m.final) {
    const topics = shuffle(MISSIONS.filter(x => !x.final));
    pool = topics.slice(0, 15).map(x => Object.assign({}, x.questions[Math.floor(Math.random() * x.questions.length)], { src: x }));
  } else {
    pool = shuffle(m.questions.slice()).slice(0, 7).map(q => Object.assign({}, q, { src: m }));
  }
  return pool.map(q => {
    if (q.t !== 'c') return q;
    const idx = shuffle(q.o.map((_, i) => i));
    return Object.assign({}, q, { o: idx.map(i => q.o[i]), a: idx.indexOf(q.a) });
  });
}
function startQuiz(m) {
  quiz = { m, stage: 'q', qs: buildQuestions(m), i: 0, correct: 0, combo: 0, maxCombo: 0, results: [], answered: false };
  renderQuestion();
}
function correctText(q) {
  if (q.t === 'c') return q.o[q.a].replace(' (nic)', '');
  if (q.t === 't') return q.a[0];
  return q.w;
}
function renderQuestion() {
  const q = quiz.qs[quiz.i], m = quiz.m, color = TIERS[m.tier].color;
  quiz.answered = false; quiz.order = []; quiz.selected = null;
  const segs = quiz.qs.map((_, i) => `<div class="seg ${quiz.results[i] === true ? 'ok' : quiz.results[i] === false ? 'no' : i === quiz.i ? 'cur' : ''}"></div>`).join('');
  const qtext = esc(q.q).replace(/___/g, '<span class="gap">&nbsp;</span>');
  let body = '';
  if (q.t === 'c') {
    body = `<div class="opts">${q.o.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(o)}</span></button>`).join('')}</div>`;
  } else if (q.t === 't') {
    body = `<form class="typebox" id="type-form" autocomplete="off"><input id="type-in" type="text" spellcheck="false" autocapitalize="off" placeholder="Wpisz odpowiedź…" aria-label="Twoja odpowiedź"><button class="btn" type="submit">Sprawdź</button></form>`;
  } else {
    const words = q.w.split(' ');
    let order = shuffle(words.map((_, i) => i));
    if (order.every((v, i) => v === i) && words.length > 1) order = order.reverse();
    quiz.pool = order.map(i => words[i]);
    body = `<div class="tiles-answer" id="tiles-ans"><span class="meta">Klikaj słowa w odpowiedniej kolejności…</span></div>
      <div class="tiles-pool" id="tiles-pool">${quiz.pool.map((w, i) => `<button class="tile" data-i="${i}">${esc(w)}</button>`).join('')}</div>
      <div class="actions" style="margin-top:14px"><button class="btn" id="order-check">Sprawdź</button><button class="btn ghost" id="order-clear">Wyczyść</button></div>`;
  }
  qCard.innerHTML = `
    <div class="card-head">
      <div class="qtop">
        <div class="eyebrow"><span class="chip" style="background:${color}">${m.level}</span>${esc(m.place)} · Pytanie ${quiz.i + 1}/${quiz.qs.length}</div>
        <div class="combo" id="combo">${quiz.combo >= 2 ? `COMBO x${quiz.combo}` : ''}</div>
      </div>
      <div class="segs">${segs}</div>
    </div>
    <div class="card-body">
      <div class="qkind">${TYPE_LABEL[q.t]}${m.final ? ` · ${esc(q.src.topic)}` : ''}</div>
      <div class="qtext" id="qtext">${qtext}</div>
      ${body}
      <div id="fb"></div>
      <div class="actions" id="next-row" hidden><button class="btn" id="q-next">${quiz.i + 1 < quiz.qs.length ? 'Dalej' : 'Zobacz wynik'}</button><span class="meta">lub naciśnij Enter</span></div>
      <div class="hint-keys">${q.t === 'c' ? 'Klawisze 1–4 wybierają odpowiedź.' : q.t === 't' ? 'Enter zatwierdza odpowiedź.' : 'Backspace cofa ostatnie słowo, Enter sprawdza.'} Esc przerywa misję.</div>
    </div>`;
  qCard.scrollTop = 0;
  $('q-next').onclick = nextQuestion;
  if (q.t === 'c') qCard.querySelectorAll('.opt').forEach(b => b.onclick = () => answerChoice(+b.dataset.i));
  else if (q.t === 't') {
    const inp = $('type-in');
    $('type-form').onsubmit = e => { e.preventDefault(); if (quiz.answered) nextQuestion(); else if (inp.value.trim()) answerType(inp.value); };
    setTimeout(() => inp.focus(), 30);
  } else {
    qCard.querySelectorAll('.tile').forEach(b => b.onclick = () => pickTile(+b.dataset.i));
    $('order-check').onclick = answerOrder;
    $('order-clear').onclick = () => { if (quiz.answered) return; quiz.order = []; renderTiles(); };
  }
  if (window.GC_onQuestion) { try { window.GC_onQuestion(q); } catch (e) { /* ignore */ } }
}
function renderTiles() {
  const ans = $('tiles-ans');
  ans.innerHTML = quiz.order.length ? quiz.order.map((pi, k) => `<button class="tile" data-k="${k}">${esc(quiz.pool[pi])}</button>`).join('') : '<span class="meta">Klikaj słowa w odpowiedniej kolejności…</span>';
  ans.querySelectorAll('.tile').forEach(b => b.onclick = () => { if (quiz.answered) return; quiz.order.splice(+b.dataset.k, 1); renderTiles(); });
  qCard.querySelectorAll('#tiles-pool .tile').forEach(b => b.classList.toggle('used', quiz.order.includes(+b.dataset.i)));
}
function pickTile(i) { if (quiz.answered || quiz.order.includes(i)) return; quiz.order.push(i); Sound.click(); renderTiles(); }
function fillGaps(q) {
  const gaps = qCard.querySelectorAll('#qtext .gap');
  if (!gaps.length) return;
  const txt = correctText(q), parts = txt.split(' / ');
  gaps.forEach((g, i) => { g.textContent = parts.length === gaps.length ? parts[i] : txt; });
}
function registerAnswer(ok, given) {
  const q = quiz.qs[quiz.i];
  quiz.answered = true;
  quiz.results[quiz.i] = ok;
  if (ok) { quiz.correct++; quiz.combo++; quiz.maxCombo = Math.max(quiz.maxCombo, quiz.combo); Sound.correct(); }
  else { quiz.combo = 0; Sound.wrong(); quiz.mistakes = quiz.mistakes || []; quiz.mistakes.push({ q, given }); }
  fillGaps(q);
  const fb = $('fb');
  fb.className = `feedback ${ok ? 'ok' : 'no'}`;
  fb.innerHTML = ok ? `<b>Dobrze!</b> ${esc(q.e)}` : `<b>Niestety.</b> Poprawna odpowiedź: <b>${esc(correctText(q))}</b><br>${esc(q.e)}`;
  $('combo').textContent = quiz.combo >= 2 ? `COMBO x${quiz.combo}` : '';
  const segs = qCard.querySelectorAll('.seg'); segs[quiz.i].className = `seg ${ok ? 'ok' : 'no'}`;
  $('next-row').hidden = false;
  setTimeout(() => { const b = $('q-next'); if (b && q.t !== 't') b.focus(); }, 20);
  if (window.GC_onAnswer) { try { window.GC_onAnswer(q, ok); } catch (e) { /* ignore */ } }
}
function answerChoice(i) {
  if (quiz.answered) return;
  const q = quiz.qs[quiz.i];
  const btns = qCard.querySelectorAll('.opt');
  btns.forEach((b, k) => { b.disabled = true; if (k === q.a) b.classList.add('correct'); else if (k === i) b.classList.add('wrong'); });
  registerAnswer(i === q.a, q.o[i]);
}
function answerType(val) {
  const q = quiz.qs[quiz.i];
  const ok = q.a.some(a => norm(a) === norm(val));
  const inp = $('type-in'); inp.readOnly = true; inp.classList.add(ok ? 'correct' : 'wrong');
  registerAnswer(ok, val);
}
function answerOrder() {
  if (quiz.answered) return;
  const q = quiz.qs[quiz.i];
  if (quiz.order.length < quiz.pool.length) { toast('Użyj wszystkich słów.'); return; }
  const given = quiz.order.map(i => quiz.pool[i]).join(' ');
  const ok = norm(given) === norm(q.w);
  $('tiles-ans').classList.add(ok ? 'correct' : 'wrong');
  qCard.querySelectorAll('.tile').forEach(b => { b.disabled = true; });
  registerAnswer(ok, given);
}
function nextQuestion() {
  if (!quiz || !quiz.answered) return;
  quiz.i++;
  if (quiz.i >= quiz.qs.length) finishQuiz(); else renderQuestion();
}
function quizKey(e) {
  if (!quiz) return;
  if (e.code === 'Enter' && e.target && e.target.tagName === 'BUTTON') return; // the focused button handles it
  if (quiz.stage === 'brief') { if (e.code === 'Enter') startQuiz(quiz.m); return; }
  if (quiz.stage === 'result') { if (e.code === 'Enter') closeQuiz(); return; }
  const q = quiz.qs[quiz.i];
  if (e.code === 'Enter') {
    e.preventDefault();
    if (quiz.answered) nextQuestion();
    else if (q.t === 'o') answerOrder();
    return;
  }
  if (quiz.answered) return;
  if (q.t === 'c' && /^Digit[1-4]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (i < q.o.length) answerChoice(i); }
  if (q.t === 'o' && e.code === 'Backspace') { e.preventDefault(); quiz.order.pop(); renderTiles(); }
}
const REWARD = [150, 300, 500, 800, 2500];
function finishQuiz() {
  const m = quiz.m, total = quiz.qs.length, pct = Math.round(quiz.correct / total * 100), pass = pct >= 70;
  const wasDone = !!save.done[m.id], prevCount = doneCount();
  let money = 0;
  const xp = quiz.correct * 10 * (m.tier + 1);
  if (pass) {
    money = wasDone ? Math.round(REWARD[m.tier] * 0.25) : REWARD[m.tier] + (pct === 100 ? Math.round(REWARD[m.tier] * 0.5) : 0);
    if (hasCashGlasses()) money *= 2;
    save.done[m.id] = true;
  }
  save.best[m.id] = Math.max(save.best[m.id] || 0, pct);
  save.money += money; save.xp += xp;
  persist();
  refreshMarkers();
  quiz.stage = 'result';
  quiz.summary = { pass, pct, money, xp, newlyUnlocked: TIERS.filter(t => prevCount < t.need && doneCount() >= t.need) };
  pass ? Sound.passed() : Sound.failed();
  const color = TIERS[m.tier].color;
  const mistakes = (quiz.mistakes || []).map(x => `<div class="review-item">${esc(x.q.q).replace(/___/g, '<b>___</b>')}<br>Twoja odpowiedź: <s>${esc(x.given)}</s> · Poprawnie: <span class="ans">${esc(correctText(x.q))}</span></div>`).join('');
  qCard.innerHTML = `
    <div class="card-head">
      <div class="eyebrow"><span class="chip" style="background:${color}">${m.level}</span>${esc(m.place)} · ${esc(m.topic)}</div>
      <div class="result-title" style="color:${pass ? 'var(--green)' : 'var(--red)'}">${pass ? 'MISSION PASSED' : 'MISSION FAILED'}</div>
      <div class="meta">${pass ? (m.final ? 'Burmistrz wręcza Ci klucz do Grammar City!' : wasDone ? 'Powtórka zaliczona — mały bonus za trening.' : 'Świetna robota! Miasto zapamięta Twoje imię.') : 'Potrzebujesz co najmniej 70%. Przejrzyj błędy i spróbuj jeszcze raz.'}</div>
    </div>
    <div class="card-body">
      <div class="stats">
        <div class="stat"><b>${quiz.correct}/${total}</b><span>Poprawne</span></div>
        <div class="stat"><b>${pct}%</b><span>Wynik</span></div>
        <div class="stat"><b style="color:var(--cash)">+${fmtMoney(money)}</b><span>Nagroda${hasCashGlasses() && money ? ' · Cash Glasses ×2' : ''}</span></div>
        <div class="stat"><b>+${xp}</b><span>XP</span></div>
        <div class="stat"><b>x${quiz.maxCombo}</b><span>Najlepsze combo</span></div>
      </div>
      ${mistakes ? `<div class="tip-title" style="margin-top:14px">Do powtórki</div><div class="review">${mistakes}</div>` : '<p class="story-pl">Bez ani jednego błędu. Perfekcyjnie!</p>'}
      <div class="actions">
        ${pass ? '<button class="btn" id="r-back">Wróć do miasta</button><button class="btn ghost" id="r-retry">Zagraj ponownie</button>' : '<button class="btn" id="r-retry">Spróbuj ponownie</button><button class="btn ghost" id="r-back">Wróć do miasta</button>'}
      </div>
    </div>`;
  qCard.scrollTop = 0;
  $('r-back').onclick = closeQuiz;
  $('r-retry').onclick = () => startQuiz(m);
  setTimeout(() => { const b = $(pass ? 'r-back' : 'r-retry'); b && b.focus(); }, 30);
}
function closeQuiz() {
  const s = quiz && quiz.stage === 'result' ? quiz.summary : null;
  const m = quiz && quiz.m;
  quiz = null; ui = null;
  $('quiz-ov').hidden = true;
  canvas.focus();
  if (s) {
    if (s.pass) {
      showBanner(m.final ? 'GRAMMAR LEGEND' : 'MISSION PASSED', `${s.money ? `+${fmtMoney(s.money)} · ` : ''}+${s.xp} XP`, m.final ? '#c77dff' : '#f2b632');
      s.newlyUnlocked.forEach((t, i) => setTimeout(() => toast(t.name === 'FINAL' ? 'Odblokowano egzamin końcowy w City Hall!' : `Odblokowano nowe misje: poziom ${t.name}!`, 'good', 5000), 1200 + i * 400));
      const next = recommendMission();
      if (next) setTimeout(() => setGPS({ kind: 'mission', m: next }), 1800);
      else setGPS(null, true);
    } else showBanner('MISSION FAILED', 'Wróć, gdy będziesz gotów', '#ef4b4b', 2400);
  }
}
function abortQuiz() {
  if (!quiz) return;
  if (quiz.stage === 'q') toast('Misja przerwana');
  if (quiz.stage === 'result') { closeQuiz(); return; }
  quiz = null; ui = null; $('quiz-ov').hidden = true; canvas.focus();
}

// ---------------------------------------------------------------- NPC: mieszkańcy do rozmowy
const TALKS = window.NPC_TALKS || [];
const npcs = [];
// Miejsca: chodniki w różnych kwartałach (z dala od znaczników misji).
const NPC_SPOTS = [[1, 1], [4, 1], [6, 3], [2, 4], [5, 6], [0, 5], [7, 6], [3, 6], [4, 4], [1, 3], [6, 5], [2, 0], [5, 0], [7, 2], [3, 2], [0, 1]];
function npcLabelTexture(name, done) {
  const c = makeCanvas(512, 112), g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(10,12,18,.78)'; g.beginPath();
  if (g.roundRect) g.roundRect(56, 10, 400, 92, 46); else g.rect(56, 10, 400, 92);
  g.fill();
  g.lineWidth = 6; g.strokeStyle = done ? '#45d483' : '#4fb3ff'; g.stroke();
  g.font = '700 46px "Barlow Condensed", sans-serif'; g.fillStyle = '#f3eee4';
  g.fillText((done ? '✓ ' : '💬 ') + name, 256, 58);
  return canvasTex(c, false);
}
function spawnNPCs() {
  let si = 0;
  for (const t of TALKS) {
    let x, z, tries = 0;
    do {
      const [bx, bz] = NPC_SPOTS[si++ % NPC_SPOTS.length];
      const side = (si + tries) % 4, X = bx0(bx), Z = bx0(bz), mid = B / 2 + ((si * 7) % 9 - 4);
      if (side === 0) { x = X + mid; z = Z + 1.3; } else if (side === 1) { x = X + mid; z = Z + B - 1.3; }
      else if (side === 2) { x = X + 1.3; z = Z + mid; } else { x = X + B - 1.3; z = Z + mid; }
      tries++;
    } while (nearMarker(x, z, 10) && tries < 8);
    const look = Object.assign(randomLook(rand), t.look || {});
    const p = makePerson(Object.assign(look, { shadow: false }));
    p.g.position.set(x, SIDE_H, z);
    scene.add(p.g);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: npcLabelTexture(t.name, !!wardrobe.talked[t.id]), transparent: true, depthWrite: false, fog: false }));
    label.scale.set(4.6, 1.0, 1); label.position.set(x, SIDE_H + 2.95, z);
    scene.add(label);
    npcs.push({ t, p, x, z, label, face: Math.random() * 6, done: !!wardrobe.talked[t.id] });
  }
}
function refreshNpcLabel(n) {
  n.done = !!wardrobe.talked[n.t.id];
  n.label.material.map && n.label.material.map.dispose();
  n.label.material.map = npcLabelTexture(n.t.name, n.done); n.label.material.needsUpdate = true;
}
let nearNPC = null;
function updateNPCs(dt) {
  const cx = camera.position.x, cz = camera.position.z;
  nearNPC = null;
  for (const n of npcs) {
    const far = Math.abs(n.x - cx) > 130 || Math.abs(n.z - cz) > 130;
    n.p.g.visible = !far; n.label.visible = !far && Math.hypot(n.x - cx, n.z - cz) < 60;
    if (far) continue;
    const dP = Math.hypot(P.pos.x - n.x, P.pos.z - n.z);
    if (!P.car && dP < 2.8 && !nearNPC) nearNPC = n;
    // patrzy na gracza, gdy ten jest blisko; inaczej lekko się rozgląda
    const want = dP < 9 && !P.car ? Math.atan2(P.pos.x - n.x, P.pos.z - n.z) : n.face + Math.sin(elapsed * 0.3 + n.x) * 0.6;
    n.p.g.rotation.y += angDiff(n.p.g.rotation.y, want) * Math.min(1, dt * 4);
    // oddech + gest dłonią przy rozmowie
    const talking = ui === 'talk' && talk && talk.n === n;
    n.p.ra.rotation.x = talking ? -0.9 + Math.sin(elapsed * 6) * 0.25 : Math.sin(elapsed * 1.6 + n.x) * 0.05;
    n.p.la.rotation.x = -Math.sin(elapsed * 1.6 + n.x) * 0.05;
    n.p.g.position.y = SIDE_H + Math.sin(elapsed * 2 + n.z) * 0.01;
  }
  // kolizja: gracz nie przenika przez rozmówcę
  if (!P.car) for (const n of npcs) {
    const dx = P.pos.x - n.x, dz = P.pos.z - n.z, d = Math.hypot(dx, dz);
    if (d < 0.75 && d > 1e-4) { P.pos.x = n.x + dx / d * 0.75; P.pos.z = n.z + dz / d * 0.75; player.g.position.copy(P.pos); }
  }
}
// Lektor (angielskie odpowiedzi NPC).
function sayEN(text) {
  if (Sound.muted || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = 0.95;
    const vs = speechSynthesis.getVoices();
    const v = vs.find(x => /en-GB/i.test(x.lang) && /Google/i.test(x.name)) || vs.find(x => /en-GB/i.test(x.lang)) || vs.find(x => /^en/i.test(x.lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* brak TTS */ }
}

// ---------------------------------------------------------------- rozmowa
let talk = null;
const TALK_REWARD = 60, TALK_REPEAT = 10;
function openTalk(n) {
  ui = 'talk'; keys.clear(); releaseLock(); setPrompt('');
  talk = { n, i: 0, wrong: 0, perfect: 0 };
  renderTalk();
  $('quiz-ov').hidden = false;
  Sound.click();
}
function renderTalk(state) {
  const t = talk.n.t, s = t.steps[talk.i];
  const segs = t.steps.map((_, k) => `<div class="seg ${k < talk.i ? 'ok' : k === talk.i ? 'cur' : ''}"></div>`).join('');
  qCard.innerHTML = `
    <div class="card-head">
      <div class="eyebrow"><span class="chip" style="background:#4fb3ff">ROZMOWA</span>${esc(t.role)} · krok ${talk.i + 1}/${t.steps.length}</div>
      <h2 class="place">${esc(t.name)}</h2>
      <div class="segs">${segs}</div>
    </div>
    <div class="card-body">
      <div class="npc">
        <div class="npc-avatar" style="background:#4fb3ff">${esc(t.name[0])}</div>
        <div>
          <div class="npc-name">${esc(t.name)} pyta (po polsku):</div>
          <p class="story talk-q">„${esc(s.pl)}”</p>
          <div class="meta">Odpowiedz <b>po angielsku</b> — pełnym zdaniem.</div>
        </div>
      </div>
      <form class="typebox" id="talk-form" autocomplete="off" style="margin-top:16px">
        <input id="talk-in" type="text" spellcheck="false" autocapitalize="off" placeholder="Napisz po angielsku…" aria-label="Twoja odpowiedź po angielsku">
        <button class="btn" type="submit" id="talk-send">Odpowiedz</button>
      </form>
      <div id="talk-fb"></div>
      <div class="actions">
        <button class="btn ghost" id="talk-hint" type="button">💡 Podpowiedź</button>
        <button class="btn ghost" id="talk-close" type="button">Zakończ rozmowę</button>
        <span class="meta">Enter — odpowiedz · Esc — wyjdź</span>
      </div>
    </div>`;
  const inp = $('talk-in');
  $('talk-form').onsubmit = e => { e.preventDefault(); if (talk.answered) nextTalk(); else if (inp.value.trim()) answerTalk(inp.value); };
  $('talk-hint').onclick = () => { const fb = $('talk-fb'); fb.className = 'feedback'; fb.innerHTML = `💡 Zacznij tak: <b>${esc(s.hint)}</b>`; inp.focus(); };
  $('talk-close').onclick = closeTalk;
  setTimeout(() => inp.focus(), 30);
}
function answerTalk(val) {
  const s = talk.n.t.steps[talk.i], fb = $('talk-fb'), inp = $('talk-in');
  if (window.NPC_CHECK(s, val)) {
    if (!talk.wrong) talk.perfect++;
    talk.answered = true; inp.readOnly = true; inp.classList.add('correct');
    fb.className = 'feedback ok';
    fb.innerHTML = `<b>Świetnie!</b> ${esc(talk.n.t.name)}: „<i>${esc(s.en)}</i>” <span class="meta">(${esc(s.enPl)})</span>`;
    $('talk-send').textContent = talk.i + 1 < talk.n.t.steps.length ? 'Dalej' : 'Zakończ';
    Sound.correct(); sayEN(s.en);
    return;
  }
  talk.wrong++;
  Sound.wrong(); inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 600);
  fb.className = 'feedback no';
  if (talk.wrong >= 2) {
    fb.innerHTML = `Przykładowa odpowiedź: <b>${esc(s.ex)}</b><br>Przepisz ją lub napisz własną, podobną.`;
  } else fb.innerHTML = `Spróbuj jeszcze raz — pełnym zdaniem po angielsku. Podpowiedź: <b>${esc(s.hint)}</b>`;
}
function nextTalk() {
  talk.i++; talk.wrong = 0; talk.answered = false;
  if (talk.i < talk.n.t.steps.length) { renderTalk(); return; }
  // koniec rozmowy — nagroda
  const n = talk.n, first = !wardrobe.talked[n.t.id];
  const all = talk.perfect === n.t.steps.length;
  const money = first ? TALK_REWARD : (all ? TALK_REPEAT : 0), xp = first ? 30 : 10;
  wardrobe.talked[n.t.id] = (wardrobe.talked[n.t.id] || 0) + 1; persistWardrobe();
  save.money += money; save.xp += xp; persist();
  refreshNpcLabel(n);
  Sound.passed();
  qCard.innerHTML = `
    <div class="card-head"><div class="eyebrow"><span class="chip" style="background:#4fb3ff">ROZMOWA</span>${esc(n.t.role)}</div>
      <div class="result-title" style="color:var(--green)">GREAT TALK!</div>
      <div class="meta">${esc(n.t.name)}: „See you around!” · Rozmowy ukończone: ${Object.keys(wardrobe.talked).length}/${TALKS.length}</div></div>
    <div class="card-body">
      <div class="stats">
        <div class="stat"><b>${talk.perfect}/${n.t.steps.length}</b><span>Za pierwszym razem</span></div>
        <div class="stat"><b style="color:var(--cash)">+${fmtMoney(money)}</b><span>Nagroda</span></div>
        <div class="stat"><b>+${xp}</b><span>XP</span></div>
      </div>
      <p class="story-pl">${first ? 'Pierwsza rozmowa z tą osobą — pełna nagroda!' : all ? 'Powtórka bez błędów — mały bonus.' : 'Powtórka — nagroda tylko za rozmowę bez błędów.'}</p>
      <div class="actions"><button class="btn" id="talk-end">Wróć do miasta</button></div>
    </div>`;
  $('talk-end').onclick = closeTalk;
  setTimeout(() => $('talk-end') && $('talk-end').focus(), 30);
}
function closeTalk() {
  talk = null; ui = null; $('quiz-ov').hidden = true; canvas.focus();
  try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- sklep
let shopCat = 'outfit';
function openShop() {
  ui = 'shop'; keys.clear(); releaseLock(); setPrompt('');
  $('shop-ov').hidden = false; renderShop(); Sound.click();
}
function closeShop() { ui = null; $('shop-ov').hidden = true; canvas.focus(); }
function equipKey(it) { return it.cat === 'vehicle' ? 'vehicle' : it.cat; }
function equippedId(cat) { const e = wardrobe.equip; return cat === 'vehicle' ? e.vehicle : cat + '_' + e[cat]; }
function renderShop() {
  $('shop-money').textContent = fmtMoney(save.money);
  $('shop-tabs').innerHTML = SHOP_CATS.map(([c, l]) => `<button class="xbtn ${c === shopCat ? 'on' : ''}" data-c="${c}">${l}</button>`).join('');
  $('shop-tabs').querySelectorAll('button').forEach(b => b.onclick = () => { shopCat = b.dataset.c; renderShop(); Sound.click(); });
  const items = SHOP.filter(i => i.cat === shopCat), eq = equippedId(shopCat);
  $('shop-grid').innerHTML = items.map(it => {
    const own = !!wardrobe.owned[it.id], on = eq === it.id;
    const btn = !own ? `<button class="btn" data-buy="${it.id}" ${save.money < it.price ? 'disabled' : ''}>Kup · ${fmtMoney(it.price)}</button>`
      : it.cat === 'vehicle' ? `<button class="btn" data-call="${it.id}">🚚 Przywołaj</button>`
      : on ? '<span class="owned-on">✓ Założone</span>' : `<button class="btn ghost" data-eq="${it.id}">Załóż</button>`;
    return `<div class="shop-item ${on ? 'on' : ''} ${it.perk ? 'perk' : ''}">
      <div class="si-ico">${shopIcon(it)}</div>
      <div class="si-nm">${esc(it.name)}</div>
      <div class="si-ds">${esc(it.desc || '')}</div>
      <div class="si-act">${btn}</div></div>`;
  }).join('');
  $('shop-grid').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyItem(b.dataset.buy));
  $('shop-grid').querySelectorAll('[data-eq]').forEach(b => b.onclick = () => equipItem(b.dataset.eq));
  $('shop-grid').querySelectorAll('[data-call]').forEach(b => b.onclick = () => { equipItem(b.dataset.call); closeShop(); summonVehicle(); });
  $('shop-perk').hidden = !hasCashGlasses();
}
function shopIcon(it) {
  if (it.cat === 'vehicle') return { scooter: '🛴', moto: '🏍️', hatch: '🚗', suv: '🚙', supercar: '🏎️' }[it.vtype] || '🚗';
  if (it.cat === 'glasses') return it.glasses === 'cash' ? '<span class="pixglass">▀█▀▀ ▀█▀▀</span>' : it.glasses === 'sun' ? '🕶️' : '🙂';
  if (it.cat === 'hat') return { none: '💇', cap: '🧢', beanie: '🧶', fedora: '🎩', crown: '👑' }[it.hat];
  if (it.cat === 'hair') return `<span class="swatch" style="background:#${it.hair.toString(16).padStart(6, '0')}"></span>`;
  const l = it.look; return `<span class="swatch" style="background:#${(l.jacket != null ? l.jacket : l.shirt).toString(16).padStart(6, '0')}"></span><span class="swatch" style="background:#${l.pants.toString(16).padStart(6, '0')}"></span>`;
}
function buyItem(id) {
  const it = shopItem(id); if (!it || wardrobe.owned[id]) return;
  if (save.money < it.price) { Sound.wrong(); toast('Za mało pieniędzy — zrób misję albo porozmawiaj z mieszkańcami.', 'bad'); return; }
  save.money -= it.price; persist();
  wardrobe.owned[id] = 1; persistWardrobe();
  Sound.passed();
  toast(`Kupiono: ${it.name}${it.perk ? ' — od teraz misje dają podwójne pieniądze!' : ''}`, 'good', 4200);
  equipItem(id);
}
function equipItem(id) {
  const it = shopItem(id); if (!it || !wardrobe.owned[id]) return;
  if (it.cat === 'vehicle') wardrobe.equip.vehicle = id;
  else wardrobe.equip[it.cat] = id.slice(it.cat.length + 1);
  persistWardrobe();
  if (it.cat !== 'vehicle') rebuildPlayer();
  renderShop();
}
// Przywołanie własnego pojazdu obok gracza (V lub przycisk w sklepie).
let summoned = null;
function summonVehicle() {
  const id = wardrobe.equip.vehicle, it = id && shopItem(id);
  if (!it) { toast('Nie masz jeszcze pojazdu — kup go w sklepie (<kbd>B</kbd>).'); return; }
  if (P.car) { toast('Najpierw wysiądź z pojazdu.'); return; }
  if (summoned && summoned !== P.car) { scene.remove(summoned.mesh); const k = vehicles.indexOf(summoned); if (k >= 0) vehicles.splice(k, 1); }
  const fx = Math.sin(P.facing), fz = Math.cos(P.facing);
  let best = null;
  for (const [ox, oz] of [[fz * 2.6, -fx * 2.6], [-fz * 2.6, fx * 2.6], [fx * 3, fz * 3], [-fx * 3, -fz * 3]]) {
    const p = { x: P.pos.x + ox, z: P.pos.z + oz };
    if (!pushOut(p, it.vtype === 'scooter' || it.vtype === 'moto' ? 0.6 : 1.3, nearCols)) { best = p; break; }
  }
  if (!best) best = { x: P.pos.x + fz * 2.6, z: P.pos.z - fx * 2.6 };
  summoned = spawnVehicle(it.vtype, it.color, best.x, best.z, P.facing, 'parked');
  summoned.owned = true; summoned.pos.y = groundAt(best.x, best.z); summoned.mesh.position.copy(summoned.pos);
  Sound.door();
  toast(`Twój pojazd czeka obok: ${it.name}. Naciśnij <kbd>F</kbd>, aby ${it.vtype === 'scooter' || it.vtype === 'moto' ? 'wsiąść' : 'wsiąść'}.`, 'good', 4000);
}
$('shop-close').addEventListener('click', closeShop);

// ---------------------------------------------------------------- start screen
function refreshStartInfo() {
  const dc = doneCount();
  $('save-info').textContent = dc || save.money ? `Zapisany postęp: ${dc}/${MISSIONS.length} misji · ${fmtMoney(save.money)}` : '';
  $('reset-wrap').hidden = !(dc || save.money);
}
function showResetLink() {
  const w = $('reset-wrap');
  w.innerHTML = '<button class="linkbtn" id="btn-reset">Zacznij od nowa</button>';
  $('btn-reset').onclick = () => {
    w.innerHTML = '<span>Usunąć cały postęp?</span><button class="xbtn" id="reset-yes">Tak, usuń</button><button class="xbtn" id="reset-no">Anuluj</button>';
    $('reset-yes').onclick = () => {
      save = freshSave(); shownMoney = 0; persist(); refreshMarkers(); refreshStartInfo();
      $('btn-start').textContent = 'Wejdź do miasta';
    };
    $('reset-no').onclick = showResetLink;
  };
}
showResetLink();

function startGame() {
  Sound.init();
  $('start-ov').hidden = true; $('hud').hidden = false;
  ui = null; camYaw = 0; camPitch = 0.3; camDist = 12;
  canvas.focus();
  requestLock();
  const first = recommendMission();
  if (doneCount() === 0) {
    showBanner('GRAMMAR CITY', 'Witaj w mieście!', '#f2b632', 2600);
    setTimeout(() => toast('Za Tobą ratusz — egzamin końcowy. Najpierw zdobądź doświadczenie w mieście.', '', 5500), 1500);
    setTimeout(() => toast('Obok stoi sportowe auto — podejdź i naciśnij <kbd>F</kbd>.', '', 5500), 4200);
    setTimeout(() => toast('Mieszkańcy z dymkiem 💬 chętnie porozmawiają (<kbd>T</kbd>). Za pieniądze kupisz stroje i pojazdy w sklepie (<kbd>B</kbd>).', '', 6500), 7400);
    if (touchMode) setTimeout(() => toast('Lewy pad — ruch · przeciągnij palcem po ekranie — kamera · dotknij minimapy — mapa', '', 6500), 300);
  }
  if (first) setTimeout(() => setGPS({ kind: 'mission', m: first }), 900);
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let hudT = 0, clockStr = '08:00', elapsed = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  const focus = P.car ? P.car.pos : P.pos;
  nearTimer -= dt;
  if (nearTimer <= 0) { refreshNear(focus.x, focus.z); nearTimer = 0.2; }
  if (ui !== 'start') {
    if (P.car) updateCar(P.car, dt); else { updateOnFoot(dt); Sound.engine(false, 0, false); }
  }
  for (const v of vehicles) if (v.kind === 'parked' && v.mesh.visible) v.pos.y = groundAt(v.pos.x, v.pos.z), v.mesh.position.copy(v.pos);
  updateTraffic(dt);
  updatePeds(dt);
  updateNPCs(dt);
  updateCamera(dt);
  clockStr = updateSky(dt, ui === 'start' ? camera.position : focus);
  // markers
  for (const mk of markers) {
    mk.badge.position.y = mk.y + 3.5 + Math.sin(elapsed * 2 + mk.m.mx) * 0.22;
    mk.ring.rotation.y += dt * 0.6;
    const d = Math.hypot(mk.m.mx - camera.position.x, mk.m.mz - camera.position.z);
    mk.label.visible = d < 75;
    mk.ring.visible = mk.badge.visible = d < 160;
    if (mk.state !== 'locked') mk.cyl.visible = d < 160;
    mk.cyl.material.opacity = 0.42 + Math.sin(elapsed * 3) * 0.12;
  }
  if (fountainSpray) fountainSpray.scale.y = 1 + Math.sin(elapsed * 6) * 0.08;
  // GPS
  if (ui !== 'start') {
    routeT -= dt;
    if (routeT <= 0 && gps) { computeRoute(); routeT = 0.35; }
    const t = gpsTarget();
    if (gps && gps.kind === 'point' && t && Math.hypot(t.x - focus.x, t.z - focus.z) < 9) { setGPS(null, true); toast('Dotarłeś do celu', 'route'); }
    if (route && route.length > 1) {
      let nx = route[route.length - 1].x, nz = route[route.length - 1].z;
      for (let i = 1; i < route.length; i++) if (Math.hypot(route[i].x - focus.x, route[i].z - focus.z) > 12) { nx = route[i].x; nz = route[i].z; break; }
      gpsArrow.visible = true;
      gpsArrow.position.set(focus.x, focus.y + (P.car ? 3.9 : 2.9) + Math.sin(elapsed * 3) * 0.08, focus.z);
      gpsArrow.rotation.y = Math.atan2(nx - focus.x, nz - focus.z);
    } else gpsArrow.visible = false;
    if (!ui) checkMissionProximity();
    updateTouchUI();
    hudT -= dt;
    drawMinimap(dt);
    if (hudT <= 0) { updateHUD(0.1, clockStr); hudT = 0.1; }
  }
  renderer.render(scene, camera);
  adaptQuality(dt);
}
// dynamic resolution: keeps weaker laptops (integrated GPUs) playable
let qT = 0, qFrames = 0, shadowsOff = false;
function adaptQuality(dt) {
  qT += dt; qFrames++;
  if (qT < 2) return;
  const fps = qFrames / qT; qT = 0; qFrames = 0;
  let pr = pixelRatio;
  if (fps < 32 && pr > 0.55) pr = Math.max(0.55, pr - 0.15);
  else if (fps > 55 && pr < MAX_PR) pr = Math.min(MAX_PR, pr + 0.1);
  else if (fps < 24 && pr <= 0.55 && !shadowsOff) { shadowsOff = true; sun.castShadow = false; }
  if (pr !== pixelRatio) { pixelRatio = pr; renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight); }
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  resizeMinimap();
  if (ui === 'map') drawBigMap();
});

function resizeMinimap() {
  const s = touchMode ? 120 : window.innerWidth <= 640 ? 150 : 230;
  if (mm.width !== s) { mm.width = s; mm.height = s; }
}

// ---------------------------------------------------------------- boot
async function boot() {
  const btn = $('btn-start');
  btn.disabled = true; btn.textContent = 'Ładowanie miasta…';
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px Anton'), document.fonts.load('700 20px "Barlow Condensed"'), document.fonts.load('600 20px "Barlow Condensed"')]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fonts optional */ }
  buildCity();
  createMarkers();
  // player spawn in front of City Hall
  const sx = bc(3), sz = bx0(3) + B - 2.5;
  P.pos.set(sx - 6, SIDE_H, sz);
  player.g.position.copy(P.pos); player.g.rotation.y = P.facing;
  spawnVehicle('sport', 0xf2b632, sx + 4, rc(4) - 6.2, Math.PI / 2, 'parked');
  spawnParked(18);
  spawnTraffic(26);
  spawnPeds(40);
  spawnNPCs();
  buildMapCanvas();
  refreshNear(P.pos.x, P.pos.z);
  resizeMinimap();
  refreshStartInfo();
  btn.disabled = false; btn.textContent = doneCount() ? 'Kontynuuj grę' : 'Wejdź do miasta';
  btn.addEventListener('click', startGame);
  frame();
}
boot();
})();
