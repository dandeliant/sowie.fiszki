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

// ---------------------------------------------------------------- mapa
// Mapy z prawdziwych danych (eksport topoexport.com: Overture Maps ODbL, GUGiK NMT CC BY 4.0;
// konwersja grammar-city/warsaw/tools/convert-dxf.js): ?map=warsaw | ?map=jeleniec | ?map=london | ?map=lukow | ?map=wesolowka | ?map=kierzkow | ?map=sarnow | ?map=rzymy | ?map=paris.
// Bez parametru — klasyczne Grammar City (siatka kwartałów).
const MAP_DEFS = {
  warsaw: { file: 'warsaw/warsaw.json', ext: 515, label: 'Warszawa — Śródmieście', of: 'Warszawy',
    banner: ['WARSZAWA', 'Witaj w Śródmieściu!'], finalePL: 'Pałac Kultury', finaleIn: 'w Pałacu Kultury', finaleEN: 'Palace of Culture',
    tagline: 'Prawdziwe Śródmieście Warszawy w 3D', ground: 'pave', landmarkTint: 0xe8dcc0, landmarkR: 75, orbit: [280, 150, 70], fog: [200, 820] },
  jeleniec: { file: 'jeleniec/jeleniec.json', ext: 482, label: 'Jeleniec', of: 'Jeleńca',
    banner: ['JELENIEC', 'Witaj we wsi!'], finalePL: 'świetlica wiejska', finaleIn: 'w świetlicy wiejskiej', finaleEN: 'Village Hall',
    tagline: 'Prawdziwa wieś Jeleniec w 3D', enter: 'Wejdź do wsi', ground: 'grass', gable: true, orbit: [170, 75, 4], fog: [220, 900] },
  // Westminster: Big Ben (punkt orientacyjny), Pałac Westminsterski, Tamiza, most Westminsterski
  london: { file: 'london/london.json', ext: 507, label: 'Londyn — Westminster', of: 'Londynu',
    banner: ['LONDON', 'Welcome to Westminster!'], finalePL: 'Big Ben', finaleIn: 'pod Big Benem', finaleEN: 'Big Ben',
    tagline: 'Prawdziwy Londyn (Westminster) w 3D', ground: 'pave', landmarkTint: 0xd9c38f, landmarkR: 150, orbit: [260, 130, 60], fog: [200, 820] },
  // Łuków: osiedle domów jednorodzinnych (w danych 3–9 m) — trawa i dachy dwuspadowe jak w Jeleńcu
  lukow: { file: 'lukow/lukow.json', ext: 516, label: 'Łuków', of: 'Łukowa',
    banner: ['ŁUKÓW', 'Witaj w Łukowie!'], finalePL: 'dom kultury', finaleIn: 'w domu kultury', finaleEN: 'Community Centre',
    tagline: 'Prawdziwy Łuków w 3D', enter: 'Wejdź do miasta', ground: 'grass', gable: true, orbit: [170, 75, 4], fog: [220, 900] },
  // Wesołówka: wieś (w danych wszystkie budynki 6 m), stawy — jak Jeleniec
  wesolowka: { file: 'wesolowka/wesolowka.json', ext: 517, label: 'Wesołówka', of: 'Wesołówki',
    banner: ['WESOŁÓWKA', 'Witaj we wsi!'], finalePL: 'świetlica wiejska', finaleIn: 'w świetlicy wiejskiej', finaleEN: 'Village Hall',
    tagline: 'Prawdziwa wieś Wesołówka w 3D', enter: 'Wejdź do wsi', ground: 'grass', gable: true, orbit: [170, 75, 4], fog: [220, 900] },
  // Kierzków: wieś (w danych budynki 3–6 m), dużo lasu i stawy — jak Jeleniec
  kierzkow: { file: 'kierzkow/kierzkow.json', ext: 514, label: 'Kierzków', of: 'Kierzkowa',
    banner: ['KIERZKÓW', 'Witaj we wsi!'], finalePL: 'świetlica wiejska', finaleIn: 'w świetlicy wiejskiej', finaleEN: 'Village Hall',
    tagline: 'Prawdziwa wieś Kierzków w 3D', enter: 'Wejdź do wsi', ground: 'grass', gable: true, orbit: [170, 75, 4], fog: [220, 900] },
  // Sarnów: wieś (w danych budynki 3–9 m), stawy — jak Jeleniec
  sarnow: { file: 'sarnow/sarnow.json', ext: 515, label: 'Sarnów', of: 'Sarnowa',
    banner: ['SARNÓW', 'Witaj we wsi!'], finalePL: 'świetlica wiejska', finaleIn: 'w świetlicy wiejskiej', finaleEN: 'Village Hall',
    tagline: 'Prawdziwa wieś Sarnów w 3D', enter: 'Wejdź do wsi', ground: 'grass', gable: true, orbit: [170, 75, 4], fog: [220, 900] },
  // Rzymy-Rzymki: mała wieś (187 budynków, w danych 6 m) — jak Jeleniec
  rzymy: { file: 'rzymy/rzymy.json', ext: 519, label: 'Rzymy-Rzymki', of: 'Rzymów-Rzymek',
    banner: ['RZYMY-RZYMKI', 'Witaj we wsi!'], finalePL: 'świetlica wiejska', finaleIn: 'w świetlicy wiejskiej', finaleEN: 'Village Hall',
    tagline: 'Prawdziwa wieś Rzymy-Rzymki w 3D', enter: 'Wejdź do wsi', ground: 'grass', gable: true, orbit: [170, 75, 4], fog: [220, 900] },
  // Paryż: wieża Eiffla (kratownica zamiast brył z danych — eiffel: true), Pola Marsowe, Sekwana, Trocadéro
  paris: { file: 'paris/paris.json', ext: 493, label: 'Paryż — wieża Eiffla', of: 'Paryża',
    banner: ['PARIS', 'Welcome to Paris!'], finalePL: 'wieża Eiffla', finaleIn: 'pod wieżą Eiffla', finaleEN: 'Eiffel Tower',
    tagline: 'Prawdziwy Paryż (wieża Eiffla) w 3D', ground: 'pave', eiffel: true, orbit: [330, 120, 110], fog: [240, 950] },
};
const MAP_ID = (p => (MAP_DEFS[p] || p === 'metro' ? p : 'grid'))(new URLSearchParams(location.search).get('map'));
const MAPDEF = MAP_DEFS[MAP_ID] || null;
const REALMAP = !!MAPDEF;     // mapa z prawdziwych danych (Warszawa, Jeleniec)
const W_EXT = MAPDEF ? MAPDEF.ext : 515;   // mapa z danych: zakres ±W_EXT m (środek = środek eksportu)
let WD = null;                // dane mapy (ładowane w boot)
// Metropolia (?map=metro): Grammar City (te same misje i postęp) w środku dużej siatki 16 × 16 kwartałów,
// dookoła dwa pierścienie osiedli z blokami i dwa pierścienie przedmieść z domami — ok. 1,3 × 1,3 km, skala 1:1.
const METRO = MAP_ID === 'metro';

// ---------------------------------------------------------------- city layout
const N = METRO ? 16 : 8;     // blocks per side
const O = METRO ? 4 : 0;      // przesunięcie kwartałów Grammar City (misje, ratusz, parki) — centrum dużej siatki
const B = 64;                 // block size
const R = 16;                 // road width
const CELL = B + R;
const SW = 5;                 // sidewalk width
const GAP = 4;                // gap between lots
const L = (B - 2 * SW - GAP) / 2; // lot size (25)
const HALF = (N * CELL + R) / 2;  // 328 (Metropolia 648)
const HALF0 = (8 * CELL + R) / 2; // centrum (Grammar City) — wysokość budynków maleje od środka
const LANE = 4;
const SIDE_H = 0.3;
const BOUND = REALMAP ? W_EXT - 3 : HALF + 70;
const PAVE_Y = REALMAP ? 0 : SIDE_H;   // wysokość chodnika (Warszawa: teren spłaszczony do 0)
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
const groundAt = (x, z) => (REALMAP ? 0 : onBlock(x, z) ? SIDE_H : 0);

// ---------------------------------------------------------------- save
// Zalogowany uczeń: zapis per konto — klucze lokalne z loginem + kopia na serwerze
// (tabela grammar_city_saves, migracja #72; przy starcie wygrywa nowszy zapis).
//  • „shared” — wspólne dla wszystkich trybów i rozdziałów: pieniądze, XP, diamenty, odkrycia
//    (zwierzęta, urbex, ryby, grzyby), garderoba, pojazdy, paliwo, kolory, ustawienia;
//  • osobny postęp misji dla trybu: 'grammar' albo 'vocab.<podręcznik>.<rozdział>' (vocab-missions.js).
// Gość: jak dawniej — tylko ta przeglądarka (stare klucze).
const LEGACY_SAVE_KEY = window.GC_SAVE_KEY || 'grammarCity.v1';
const LEGACY_WARDROBE_KEY = 'grammarCity.wardrobe.v1';
const GC_LOGIN = (() => { try { return sessionStorage.getItem('fiszki_user') || localStorage.getItem('fiszki_user_persist') || ''; } catch (e) { return ''; } })();
const GC_GUEST = !GC_LOGIN || GC_LOGIN === '__guest__';
const MODE_SLOT = window.GC_SAVE_KEY ? window.GC_SAVE_KEY.replace(/^grammarCity\./, '') : 'grammar';
const SHARED_KEY = 'grammarCity.shared.' + GC_LOGIN;
const PROG_KEY = 'grammarCity.prog.' + GC_LOGIN + '.' + MODE_SLOT;
const SHARED_FIELDS = ['money', 'xp', 'gems', 'gemsFound', 'zoo', 'urbex', 'fish', 'mushrooms', 'wheelieBest', 'driftBest'];
const freshSave = () => ({ done: {}, best: {}, money: 0, xp: 0 });
const freshWardrobe = () => ({ owned: { outfit_classic: 1, hat_cap: 1, hat_none: 1, glasses_none: 1, hair_blond: 1, veh_kscooter: 1 },
  equip: { outfit: 'classic', hat: 'cap', glasses: 'none', hair: 'blond', vehicle: 'veh_kscooter' }, talked: {}, fuel: 1, vcolor: {}, smode: 'S' });
// Uzupełnia brakujące pola, zachowuje pozostałe (np. invisOff).
function normWardrobe(w) {
  const f = freshWardrobe();
  if (!w || !w.owned) return f;
  return Object.assign({}, w, { owned: Object.assign(f.owned, w.owned), equip: Object.assign(f.equip, w.equip || {}), talked: w.talked || {},
    fuel: typeof w.fuel === 'number' ? clamp(w.fuel, 0, 1) : 1, vcolor: w.vcolor && typeof w.vcolor === 'object' ? w.vcolor : {},
    smode: ['E', 'S', 'R'].includes(w.smode) ? w.smode : 'S' });
}
const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
let save = freshSave(), wardrobe = freshWardrobe(), sharedTs = 0, progTs = 0;
function applyShared(sh) {
  if (!sh) return;
  for (const f of SHARED_FIELDS) if (sh[f] !== undefined) save[f] = sh[f];
  wardrobe = normWardrobe(sh.wardrobe);
  sharedTs = +sh.ts || 0;
}
function applyProg(pr) { if (!pr) return; save.done = pr.done || {}; save.best = pr.best || {}; progTs = +pr.ts || 0; }
function sharedData() { const sh = { wardrobe, ts: sharedTs }; for (const f of SHARED_FIELDS) if (save[f] !== undefined) sh[f] = save[f]; return sh; }
function progData() { return { done: save.done, best: save.best, ts: progTs }; }
// Jednorazowo: postęp zapisany w tej przeglądarce przed kontami (stare klucze, także wszystkie rozdziały)
// trafia do PIERWSZEGO zalogowanego konta, które tu uruchomi grę. Pieniądze i znaleziska z wszystkich
// trybów się sumują. Stare klucze zostają dla trybu gościa.
function migrateLegacy() {
  if (localStorage.getItem('grammarCity.legacyOwner')) return null;
  const keys = Object.keys(localStorage).filter(k => k === 'grammarCity.v1' || k.startsWith('grammarCity.vocab.'));
  const w = readJSON(LEGACY_WARDROBE_KEY);
  if (!keys.length && !w) return null;
  const sh = { money: 0, xp: 0, gems: 0, mushrooms: 0, fish: 0, wheelieBest: 0, zoo: {}, urbex: {}, gemsFound: {}, wardrobe: normWardrobe(w), ts: Date.now(), mig: true };
  for (const k of keys) {
    const s = readJSON(k); if (!s || !s.done) continue;
    for (const f of ['money', 'xp', 'gems', 'mushrooms', 'fish']) sh[f] += +s[f] || 0;
    sh.wheelieBest = Math.max(sh.wheelieBest, +s.wheelieBest || 0);
    for (const f of ['zoo', 'urbex', 'gemsFound']) Object.assign(sh[f], s[f] || {});
    const slot = k === 'grammarCity.v1' ? 'grammar' : k.replace(/^grammarCity\./, '');
    writeJSON('grammarCity.prog.' + GC_LOGIN + '.' + slot, { done: s.done || {}, best: s.best || {}, ts: Date.now() });
  }
  writeJSON(SHARED_KEY, sh);
  try { localStorage.setItem('grammarCity.legacyOwner', GC_LOGIN); } catch (e) { /* ignore */ }
  return sh;
}
if (GC_GUEST) {
  const s = readJSON(LEGACY_SAVE_KEY); if (s && s.done) save = Object.assign(freshSave(), s);
  wardrobe = normWardrobe(readJSON(LEGACY_WARDROBE_KEY));
} else {
  applyShared(readJSON(SHARED_KEY) || migrateLegacy());
  applyProg(readJSON(PROG_KEY));
}

// Serwer (migracja #72): wysyłka zmian po 4 s ciszy oraz przy schowaniu karty / wyjściu.
const GCS = { ok: false, uid: null, timer: null, dirty: new Set(), extra: {}, changed: false };
const PROG_PREFIX = 'grammarCity.prog.' + GC_LOGIN + '.';
function gcsQueue(slot) {
  if (!GCS.ok) return;
  GCS.dirty.add(slot);
  clearTimeout(GCS.timer); GCS.timer = setTimeout(gcsFlush, 4000);
}
function gcsFlush() {
  clearTimeout(GCS.timer); GCS.timer = null;
  if (!GCS.ok || !GCS.dirty.size) return;
  const now = new Date().toISOString();
  const rows = [...GCS.dirty].map(slot => ({ user_id: GCS.uid, slot, data: slot === 'shared' ? sharedData() : (slot === MODE_SLOT ? progData() : GCS.extra[slot]), updated_at: now }))
    .filter(r => r.data);
  GCS.dirty.clear();
  window.supabase.from('grammar_city_saves').upsert(rows, { onConflict: 'user_id,slot' })
    .then(({ error }) => { if (error) console.warn('[Grammar City] zapis na serwerze:', error.message); });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') gcsFlush(); });
window.addEventListener('pagehide', gcsFlush);
function persist() {
  if (GC_GUEST) { writeJSON(LEGACY_SAVE_KEY, save); return; }
  sharedTs = progTs = Date.now();
  writeJSON(SHARED_KEY, sharedData()); writeJSON(PROG_KEY, progData());
  gcsQueue('shared'); gcsQueue(MODE_SLOT);
}
function persistWardrobe() {
  if (GC_GUEST) { writeJSON(LEGACY_WARDROBE_KEY, wardrobe); return; }
  sharedTs = Date.now();
  writeJSON(SHARED_KEY, sharedData());
  gcsQueue('shared');
}
// Stary zapis z tej przeglądarki + zapis z serwera z innego urządzenia: nic nie ginie (sumy, unie, więcej rzeczy).
function mergeShared(srv, loc) {
  const r = Object.assign({}, srv);
  for (const f of ['money', 'xp', 'gems', 'mushrooms', 'fish']) r[f] = (+srv[f] || 0) + (+loc[f] || 0);
  r.wheelieBest = Math.max(+srv.wheelieBest || 0, +loc.wheelieBest || 0);
  r.driftBest = Math.max(+srv.driftBest || 0, +loc.driftBest || 0);
  for (const f of ['zoo', 'urbex', 'gemsFound']) r[f] = Object.assign({}, loc[f] || {}, srv[f] || {});
  const ws = normWardrobe(srv.wardrobe), wl = normWardrobe(loc.wardrobe);
  r.wardrobe = Object.assign({}, ws, { owned: Object.assign({}, wl.owned, ws.owned), talked: Object.assign({}, wl.talked, ws.talked), vcolor: Object.assign({}, wl.vcolor, ws.vcolor) });
  r.ts = Date.now();
  return r;
}
// Postęp misji: zaliczone gdziekolwiek = zaliczone (unia), najlepszy wynik = maksimum.
function mergeProg(a, b) {
  const best = Object.assign({}, a.best || {});
  for (const [k, v] of Object.entries(b.best || {})) best[k] = Math.max(+best[k] || 0, +v || 0);
  return { done: Object.assign({}, a.done || {}, b.done || {}), best, ts: Math.max(+a.ts || 0, +b.ts || 0) };
}
async function syncSaves() {
  if (GC_GUEST) return;
  const sb = window.supabase;
  if (!sb || typeof sb.from !== 'function' || !sb.auth) return;
  let uid = null;
  try { const { data } = await sb.auth.getSession(); uid = data && data.session && data.session.user ? data.session.user.id : null; } catch (e) { return; }
  if (!uid) return;
  const { data, error } = await sb.from('grammar_city_saves').select('slot,data').eq('user_id', uid);
  if (error) {   // bez migracji #72 — zapis zostaje tylko w tej przeglądarce
    if (!/grammar_city_saves|PGRST205|42P01/i.test((error.code || '') + ' ' + (error.message || ''))) console.warn('[Grammar City] odczyt z serwera:', error.message);
    return;
  }
  GCS.ok = true; GCS.uid = uid;
  const srv = {}; (data || []).forEach(r => { srv[r.slot] = r.data; });
  const locSh = readJSON(SHARED_KEY);
  if (srv.shared) {
    if (locSh && locSh.mig) { applyShared(mergeShared(srv.shared, locSh)); writeJSON(SHARED_KEY, sharedData()); gcsQueue('shared'); GCS.changed = true; }
    else if (!locSh || (+srv.shared.ts || 0) > (+locSh.ts || 0)) { applyShared(srv.shared); writeJSON(SHARED_KEY, sharedData()); GCS.changed = true; }
    else if ((+locSh.ts || 0) > (+srv.shared.ts || 0)) gcsQueue('shared');
  } else if (locSh) {
    if (locSh.mig) writeJSON(SHARED_KEY, sharedData());
    gcsQueue('shared');
  }
  const locPr = readJSON(PROG_KEY), sp = srv[MODE_SLOT];
  if (sp && locPr) {
    const m = mergeProg(sp, locPr);
    const sameLoc = JSON.stringify([m.done, m.best]) === JSON.stringify([locPr.done || {}, locPr.best || {}]);
    const sameSrv = JSON.stringify([m.done, m.best]) === JSON.stringify([sp.done || {}, sp.best || {}]);
    if (!sameLoc) { applyProg(m); writeJSON(PROG_KEY, progData()); GCS.changed = true; }
    if (!sameSrv) gcsQueue(MODE_SLOT);
  } else if (sp) { applyProg(sp); writeJSON(PROG_KEY, progData()); GCS.changed = true; }
  else if (locPr) gcsQueue(MODE_SLOT);
  // Pozostałe tryby (inne rozdziały) z tego urządzenia: unia z serwerem w obie strony.
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(PROG_PREFIX)) continue;
    const slot = k.slice(PROG_PREFIX.length); if (slot === MODE_SLOT) continue;
    const loc = readJSON(k); if (!loc) continue;
    const sv = srv[slot], m = sv ? mergeProg(sv, loc) : loc;
    const key = x => JSON.stringify([x.done || {}, x.best || {}]);
    if (sv && key(m) !== key(loc)) writeJSON(k, m);
    if (!sv || key(m) !== key(sv)) { GCS.extra[slot] = m; GCS.dirty.add(slot); }
  }
  // …i tryby, które są tylko na serwerze — kopia lokalna na wypadek gry bez internetu.
  for (const slot of Object.keys(srv)) if (slot !== 'shared' && slot !== MODE_SLOT && !localStorage.getItem(PROG_PREFIX + slot)) writeJSON(PROG_PREFIX + slot, srv[slot]);
  gcsFlush();
}
// Statystyki gier Sowie Fiszki (../game-stats.js): XP z misji i rozmów jako punkty gry.
window.GC_STATS_XP = () => save.xp;
const doneCount = () => Object.keys(save.done).length;
const isUnlocked = m => doneCount() >= TIERS[m.tier].need;
const RANKS = [[0, 'Tourist'], [3, 'Newcomer'], [7, 'Local'], [10, 'Street Smart'], [15, 'City Boss'], [19, 'Grammar Legend']];

// ---------------------------------------------------------------- renderer
// Silnik obrazu jak w nowoczesnych grach: three.js r160, światło w jednostkach fizycznych, kolory sRGB,
// tonemapping filmowy ACES, materiały PBR oświetlane mapą otoczenia (niebo + sylwetki miasta),
// miękkie cienie podążające za graczem, post-processing: bloom (poświata świateł) i korekcja kolorów.
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
const COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);   // telefon / tablet
const MAX_PR = Math.min(window.devicePixelRatio || 1, 1.5);
let pixelRatio = Math.min(MAX_PR, COARSE ? 1 : 1.25);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc3d6ea, 170, 560);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 5200);
const hemi = new THREE.HemisphereLight(0xc4dcf5, 0x6b6a5c, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff6e8, 3.2);
sun.castShadow = true;
// ostrzejsze cienie na komputerze (myszka); na telefonie / tablecie mniejsza mapa cieni
const SHADOW_RES = COARSE ? 1024 : 2048, SHADOW_R = COARSE ? 60 : 85;
sun.shadow.mapSize.set(SHADOW_RES, SHADOW_RES);
Object.assign(sun.shadow.camera, { left: -SHADOW_R, right: SHADOW_R, top: SHADOW_R, bottom: -SHADOW_R, near: 1, far: 900 });
sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.45;
scene.add(sun, sun.target);
const MAXANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

// Niebo: kopuła z gradientem, słońcem / księżycem, chmurami i gwiazdami (shader), zależne od pory dnia.
const SKY_VS = 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }';
const SKY_FS = `
uniform vec3 uTop, uHor, uGnd, uSunDir, uSunCol, uCloudCol; uniform float uStars, uTime, uCloud, uMoon;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.48));
  col = mix(col, uGnd, smoothstep(0.0, -0.06, h));
  float sd = max(dot(d, uSunDir), 0.0), above = smoothstep(-0.04, 0.02, h);
  col += uSunCol * (pow(sd, 5.0) * 0.22 + pow(sd, 48.0) * 0.5) * above * (1.0 - uMoon * 0.85);
  float disk = smoothstep(uMoon > 0.5 ? 0.99955 : 0.99935, uMoon > 0.5 ? 0.99975 : 0.99965, sd);
  col += uSunCol * disk * (uMoon > 0.5 ? 2.2 : 14.0) * above;
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.6 + vec2(uTime * 0.004, uTime * 0.0015);
    float n = fbm(uv * 1.3) * 0.65 + fbm(uv * 4.1) * 0.35;
    float c = smoothstep(0.48, 0.82, n) * smoothstep(0.0, 0.22, h) * uCloud;
    vec3 cc = uCloudCol * (0.72 + 0.4 * pow(sd, 3.0)) * (0.85 + 0.25 * n);
    col = mix(col, cc, c * 0.85);
    if (uStars > 0.0) { vec3 q = d * 260.0; float r = hash(floor(q)); float st = smoothstep(0.9965, 1.0, r) * smoothstep(0.02, 0.25, h) * (1.0 - c);
      col += vec3(0.9, 0.95, 1.0) * st * uStars * (0.55 + 0.45 * sin(uTime * 2.0 + r * 80.0)); }
  }
  gl_FragColor = vec4(col, 1.0);
}`;
const makeSkyMat = () => new THREE.ShaderMaterial({
  uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGnd: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color() }, uCloudCol: { value: new THREE.Color() }, uStars: { value: 0 }, uTime: { value: 0 }, uCloud: { value: 0.45 }, uMoon: { value: 0 } },
  vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
});
const skyMat = makeSkyMat();
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(4800, 32, 16), skyMat); skyDome.frustumCulled = false; skyDome.renderOrder = -10;
scene.add(skyDome);
// Mapa otoczenia (PMREM): to samo niebo + sylwetki miasta z oknami + ziemia — odbicia w lakierze, szybach,
// metalu i światło rozproszone dla wszystkich materiałów PBR. Przeliczana, gdy zmienia się pora dnia.
const envScene = new THREE.Scene(), envSkyMat = makeSkyMat();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), envSkyMat));
const envGround = new THREE.Mesh(new THREE.CircleGeometry(90, 24), new THREE.MeshBasicMaterial({ color: 0x555555 }));
envGround.rotation.x = -Math.PI / 2; envGround.position.y = -2; envScene.add(envGround);
const envCityTex = [false, true].map(night => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), rnd = mulberry(night ? 5 : 6);
  g.fillStyle = night ? '#0b0d13' : '#9aa2ab'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const lit = rnd() < 0.45;
    g.fillStyle = night ? (lit ? `rgb(255,${190 + rnd() * 50 | 0},${120 + rnd() * 60 | 0})` : '#151820') : (rnd() < 0.5 ? '#5e6873' : '#6f7a86');
    g.fillRect(x * 32 + 6, y * 32 + 7, 20, 18);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
});
const envCityMat = new THREE.MeshBasicMaterial({ map: envCityTex[0], fog: false });
{
  const rnd = mulberry(4242);
  for (let k = 0; k < 44; k++) {
    const a = k / 44 * Math.PI * 2 + rnd() * 0.08, d = 34 + rnd() * 40, w = 8 + rnd() * 16, h = 4 + Math.pow(rnd(), 1.6) * 34, dd = 8 + rnd() * 10;
    const g = new THREE.BoxGeometry(w, h, dd), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 10, uv.getY(i) * h / 10);
    const m = new THREE.Mesh(g, envCityMat); m.position.set(Math.cos(a) * d, -2 + h / 2, Math.sin(a) * d); m.rotation.y = -a; envScene.add(m);
  }
}
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function rebuildEnvMap() {
  const rt = pmrem.fromScene(envScene, 0, 0.1, 400);
  if (envRT) envRT.dispose();
  envRT = rt; scene.environment = rt.texture;
}
// Post-processing: render z MSAA → bloom → tonemapping + sRGB → korekcja kolorów (winieta, kontrast, ciepło).
const GRADE_SHADER = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uSpeed: { value: 0 }, uVig: { value: 0.28 }, uSat: { value: 1.1 }, uCon: { value: 1.06 }, uGrain: { value: 0.012 }, uRes: { value: new THREE.Vector2(1, 1) }, uWarm: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uSpeed, uVig, uSat, uCon, uGrain, uWarm; uniform vec2 uRes; varying vec2 vUv;
    void main(){
      vec2 uv = vUv, d = uv - 0.5; float r = length(d);
      float bl = uSpeed * smoothstep(0.18, 0.75, r);
      vec3 col = vec3(0.0);
      for (int i = 0; i < 6; i++) { float t = float(i) / 5.0; col += texture2D(tDiffuse, uv - d * bl * 0.07 * t).rgb; }
      col /= 6.0;
      float ca = 0.0016 * r * r * 4.0 + uSpeed * 0.0018;
      col.r = mix(col.r, texture2D(tDiffuse, uv + d * ca).r, 0.55);
      col.b = mix(col.b, texture2D(tDiffuse, uv - d * ca).b, 0.55);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uCon + 0.5;
      col += uWarm * (vec3(0.022, 0.006, -0.02) * smoothstep(0.45, 1.0, l) + vec3(-0.012, 0.002, 0.024) * (1.0 - smoothstep(0.0, 0.35, l)));
      col *= 1.0 - uVig * smoothstep(0.38, 0.9, length(d * vec2(1.0, 0.82)));
      float n = fract(sin(dot(uv * uRes + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`,
};
const composer = new THREE.EffectComposer(renderer, new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: COARSE ? 0 : 4 }));
composer.addPass(new THREE.RenderPass(scene, camera));
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.55, 0.88);
composer.addPass(bloomPass);
composer.addPass(new THREE.OutputPass());
const gradePass = new THREE.ShaderPass(GRADE_SHADER);
composer.addPass(gradePass);
let postFx = !COARSE;          // telefon: bez bloomu (wydajność); komputer: pełny obraz
function sizeComposer() {
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight);
  gradePass.uniforms.uRes.value.set(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());
}
sizeComposer();
function renderScene(speedFx) {
  if (!postFx) { renderer.render(scene, camera); return; }
  gradePass.uniforms.uTime.value = performance.now() / 1000;
  gradePass.uniforms.uSpeed.value = speedFx || 0;
  composer.render();
}
// Dawne materiały Lambert → PBR (Standard): światło z mapy otoczenia, poprawne cienie i połysk.
class StdMat extends THREE.MeshStandardMaterial { constructor(p) { super(Object.assign({ roughness: 0.9, metalness: 0 }, p)); } }

// ---------------------------------------------------------------- caches
const GEO = {};
const geo = (k, fn) => GEO[k] || (GEO[k] = fn());
const MATS = {};
const mat = c => MATS[c] || (MATS[c] = new StdMat({ color: c }));

// Static geometry merging: many small coloured parts -> one draw call.
const vcMat = new StdMat({ vertexColors: true });
// postacie: PBR — twarz i ciało cieniowane miękko, lekki połysk skóry
const personMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
function mergeColored(parts) {
  let count = 0;
  const gs = parts.map(p => { const g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); g.applyMatrix4(p.m); count += g.attributes.position.count; return [g, p.c, p.gl]; });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  // połysk części (lakier, chrom, szyby) — atrybut „gloss” tylko gdy któraś część go ma (auta)
  const glossy = parts.some(p => p.gl != null || p.g.attributes.gloss), gls = glossy ? new Float32Array(count) : null;
  let o = 0;
  for (const [g, c, gl] of gs) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    const ca = g.attributes.color;   // własne kolory wierzchołków (np. twarz) = odcień mnożony przez kolor części
    for (let i = 0; i < n; i++) {
      const t = ca ? ca.array : null, k = i * 3;
      col[(o + i) * 3] = c.r * (t ? t[k] : 1); col[(o + i) * 3 + 1] = c.g * (t ? t[k + 1] : 1); col[(o + i) * 3 + 2] = c.b * (t ? t[k + 2] : 1);
    }
    if (gls) { const ga = g.attributes.gloss; for (let i = 0; i < n; i++) gls[o + i] = ga ? ga.array[i] : gl != null ? gl : 0.2; }
    o += n; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (gls) out.setAttribute('gloss', new THREE.BufferAttribute(gls, 1));
  out.computeBoundingSphere();
  return out;
}
// Lakier aut: PBR z odbiciem nieba i miasta (mapa otoczenia z prostej sceny). Połysk z atrybutu „gloss”:
// 0 = guma/plastik (matowe), ~0,6 = lakier, ~0,9 = szyby i lampy, 1 = chrom (metal).
// Lakier ma warstwę bezbarwną (clearcoat) — ostre odbicia nieba i budynków; guma i plastik bez niej.
const carPaintMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.07 });
carPaintMat.onBeforeCompile = sh => {
  sh.vertexShader = 'attribute float gloss;\nvarying float vGloss;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGloss = gloss;');
  sh.fragmentShader = 'varying float vGloss;\n' + sh.fragmentShader
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.92, 0.12, vGloss);')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = smoothstep(0.93, 1.0, vGloss) * 0.95 + vGloss * 0.06;')
    .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef CLEARCOAT\nmaterial.clearcoat *= smoothstep(0.5, 0.58, vGloss) * (1.0 - smoothstep(0.8, 0.88, vGloss));\n#endif');
};
carPaintMat.customProgramCacheKey = () => 'carPaint2';
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function partMatrix(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(sx, sy, sz));
}
const staticParts = [];
function addStatic(g, color, x, y, z, ry, sx, sy, sz) { staticParts.push({ g, m: partMatrix(x, y, z, ry, sx, sy, sz), c: new THREE.Color(color) }); }

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
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

// ---------------------------------------------------------------- tekstury proceduralne PBR
// Asfalt, kostka, beton, trawa, papa, dachówka i elewacje rysowane w przeglądarce (bez plików), z mapami
// nierówności (normal) i szorstkości — światło słońca i odbicia „łapią” fakturę jak w prawdziwych grach.
function makeNoise(seed) {
  const P = 256, rnd = mulberry(seed), tab = new Float32Array(P * P);
  for (let i = 0; i < tab.length; i++) tab[i] = rnd();
  return (x, y, period = P) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, p = Math.max(1, Math.round(period));
    const x0 = ((xi % p) + p) % p, x1 = (x0 + 1) % p, y0 = ((yi % p) + p) % p, y1 = (y0 + 1) % p;
    const a = tab[(y0 & 255) * P + (x0 & 255)], b = tab[(y0 & 255) * P + (x1 & 255)], c = tab[(y1 & 255) * P + (x0 & 255)], d = tab[(y1 & 255) * P + (x1 & 255)];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct, period) { let s = 0, amp = 0.5, f = 1, norm = 0; for (let i = 0; i < oct; i++) { s += amp * n(x * f, y * f, period * f); norm += amp; amp *= 0.5; f *= 2; } return s / norm; }
function dataTex(c, repeat) { const t = canvasTex(c, true); t.colorSpace = THREE.NoColorSpace; if (repeat) t.repeat.set(repeat, repeat); return t; }
function heightToNormal(H, w, h, strength) {
  const c = makeCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)], u = H[((y - 1 + h) % h) * w + x], dn = H[((y + 1) % h) * w + x];
    let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1; const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
    const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}
const shadeHex = (hex, f) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
const rgbS = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const TX = {};
(function genTextures() {
  const rnd = mulberry(99);
  { // asfalt: 512 px = 8 m — ziarno, kamyczki, pęknięcia, łaty; mapa nierówności i szorstkości (koleiny błyszczą)
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    const H = new Float32Array(S * S), n1 = makeNoise(11), n2 = makeNoise(12);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const big = fbm(n1, x / 64, y / 64, 4, 8), fine = n2(x / 3, y / 3, 512 / 3 | 0);
      let v = 46 + big * 30 + (fine - 0.5) * 16, h = big * 0.4 + fine * 0.6;
      const r = rnd();
      if (r < 0.035) { v += 22 + rnd() * 34; h += 0.9; } else if (r < 0.06) { v -= 14; h -= 0.5; }
      const i = y * S + x; H[i] = h; d[i * 4] = v; d[i * 4 + 1] = v + 1; d[i * 4 + 2] = v + 4; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(15,15,17,0.55)'; g.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) { let x = rnd() * S, y = rnd() * S; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    for (let k = 0; k < 5; k++) { g.fillStyle = `rgba(20,20,22,${0.12 + rnd() * 0.15})`; g.fillRect(rnd() * S, rnd() * S, 30 + rnd() * 90, 20 + rnd() * 60); }
    TX.asphalt = c; TX.asphaltN = heightToNormal(H, S, S, 2.2);
    const rc = makeCanvas(S, S), rg = rc.getContext('2d'), ri2 = rg.createImageData(S, S), rd = ri2.data, nr = makeNoise(13);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = 200 + (fbm(nr, x / 48, y / 48, 4, 512 / 48 | 0) - 0.5) * 120 + (H[y * S + x] - 0.5) * 40, i = (y * S + x) * 4;
      rd[i] = 0; rd[i + 1] = clamp(v, 120, 255); rd[i + 2] = 0; rd[i + 3] = 255;
    }
    rg.putImageData(ri2, 0, 0); TX.asphaltR = rc;
  }
  { // farba na jezdni (zużyta): 256 px = 4 m
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, n = makeNoise(31);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = 200 + fbm(n, x / 16, y / 16, 3, 16) * 55 - (rnd() < 0.08 ? 60 : 0), i = (y * S + x) * 4; d[i] = v; d[i + 1] = v; d[i + 2] = v - 4; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); TX.paint = c;
  }
  { // chodnik: kostka „cegiełka” 512 px = 2 m (25 × 12,5 cm), fugi w mapie nierówności
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), H = new Float32Array(S * S);
    g.fillStyle = '#4b4b48'; g.fillRect(0, 0, S, S);
    const bw = 64, bh = 32;
    for (let row = 0; row < S / bh; row++) {
      const off = (row % 2) * bw / 2;
      for (let col = -1; col < S / bw + 1; col++) {
        const x = col * bw + off, y = row * bh, base = 150 + (rnd() - 0.5) * 26 + (rnd() < 0.06 ? -30 : 0), warm = rnd() < 0.1 ? 10 : 0;
        g.fillStyle = rgbS(base + warm, base + warm * 0.4, base - 6); g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        for (let yy = y + 2; yy < y + bh - 2; yy++) for (let xx = x + 2; xx < x + bw - 2; xx++) {
          if (xx < 0 || xx >= S) continue;
          H[yy * S + xx] = Math.min(1, Math.min(xx - x - 2, x + bw - 3 - xx, yy - y - 2, y + bh - 3 - yy) / 4);
        }
      }
    }
    const img = g.getImageData(0, 0, S, S), d = img.data, n = makeNoise(41);
    for (let i = 0; i < S * S; i++) { const x = i % S, y = (i / S) | 0, v = (n(x / 2, y / 2, 256) - 0.5) * 22; d[i * 4] += v; d[i * 4 + 1] += v; d[i * 4 + 2] += v; }
    g.putImageData(img, 0, 0); TX.paving = c; TX.pavingN = heightToNormal(H, S, S, 1.6);
  }
  { // beton (krawężniki, place): 256 px = 2 m
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, n = makeNoise(51);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = 168 + (fbm(n, x / 32, y / 32, 4, 8) - 0.5) * 40 + (rnd() - 0.5) * 18, i = (y * S + x) * 4; d[i] = v; d[i + 1] = v - 1; d[i + 2] = v - 6; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); TX.concrete = c;
  }
  // trawa (zielona, z kępkami źdźbeł): 512 px = 4 m
  const grass = (seed, r0, g0, b0) => {
    const S = 512, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, n = makeNoise(seed);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = 0.82 + (fbm(n, x / 32, y / 32, 4, 16) - 0.5) * 0.5 + (rnd() - 0.5) * 0.22, i = (y * S + x) * 4; d[i] = r0 * v; d[i + 1] = g0 * v; d[i + 2] = b0 * v; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    for (let k = 0; k < 9000; k++) {
      const x = rnd() * S, y = rnd() * S, l = 3 + rnd() * 7, a = -Math.PI / 2 + (rnd() - 0.5) * 1.2, v = rnd() < 0.5 ? 1.25 + rnd() * 0.3 : 0.55 + rnd() * 0.3;
      g.strokeStyle = rgbS(r0 * v, g0 * v, b0 * v, 0.55); g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    return c;
  };
  TX.grass = grass(61, 92, 138, 66); TX.parkGrass = grass(62, 104, 150, 74);
  { // dach płaski (papa ze żwirkiem): 256 px = 6 m
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, n = makeNoise(71);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = 92 + (fbm(n, x / 32, y / 32, 4, 8) - 0.5) * 40 + (rnd() - 0.5) * 30, i = (y * S + x) * 4; d[i] = v; d[i + 1] = v; d[i + 2] = v + 2; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); TX.roofFlat = c;
  }
  { // dachówka: 256 px = 2 m
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    g.fillStyle = '#7a3a26'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < 8; r++) for (let q = 0; q < 9; q++) {
      const x = q * S / 8 + (r % 2) * S / 16, y = r * S / 8, v = 0.85 + rnd() * 0.3, gr = g.createLinearGradient(0, y, 0, y + S / 8);
      gr.addColorStop(0, shadeHex('#b4583a', v * 0.8)); gr.addColorStop(0.75, shadeHex('#c46a45', v)); gr.addColorStop(1, shadeHex('#5a2416', v));
      g.fillStyle = gr; g.fillRect(x - S / 16 + 1, y, S / 8 - 2, S / 8);
    }
    TX.roofTile = c;
  }
  { // poświata (plamy światła latarni na ziemi)
    const S = 128, c = makeCanvas(S, S), g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S); TX.glow = c;
  }
  // Elewacje: mapa koloru, emisja (okna nocą) i ORM (zielony = szorstkość, niebieski = metaliczność: szyby błyszczą)
  const mk = (w, h, draw) => {
    const col = makeCanvas(w, h), em = makeCanvas(w, h), orm = makeCanvas(w, h);
    const gc = col.getContext('2d'), ge = em.getContext('2d'), go = orm.getContext('2d');
    ge.fillStyle = '#000'; ge.fillRect(0, 0, w, h); go.fillStyle = 'rgb(0,235,0)'; go.fillRect(0, 0, w, h);
    draw(gc, ge, go, w, h);
    return { map: col, em, orm };
  };
  const litColor = () => { const r = rnd(); return r < 0.65 ? [255, 200 + rnd() * 40, 130 + rnd() * 60] : r < 0.85 ? [255, 240, 215] : [190, 215, 255]; };
  const glassGrad = (g, x, y, w, h, top, bot) => { const gr = g.createLinearGradient(x, y, x + w * 0.3, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(x, y, w, h); };
  const noiseOver = (g, w, h, amt) => {
    const img = g.getImageData(0, 0, w, h), d = img.data, n = makeNoise(5 + (rnd() * 100 | 0));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = (fbm(n, x / 24, y / 24, 3, Math.max(1, w / 24 | 0)) - 0.5) * amt + (rnd() - 0.5) * amt * 0.3, i = (y * w + x) * 4; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
    g.putImageData(img, 0, 0);
  };
  // biurowiec szklany: 4 moduły × 4 kondygnacje (12 m × 14 m)
  TX.office = mk(512, 512, (g, e, o, W, H) => {
    const cw = W / 4, rh = H / 4;
    g.fillStyle = '#5d6670'; g.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
      const x = q * cw, y = r * rh, gx = x + 5, gy = y + 4, gw = cw - 10, gh = rh - 30;
      g.fillStyle = '#2b333c'; g.fillRect(x, y + rh - 22, cw, 22);
      glassGrad(g, gx, gy, gw, gh, '#7d97b0', '#22344a');
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(gx + gw * 0.15, gy); g.lineTo(gx + gw * 0.45, gy); g.lineTo(gx + gw * 0.05, gy + gh); g.lineTo(gx, gy + gh); g.fill();
      g.fillStyle = '#7f8a94'; g.fillRect(x + cw / 2 - 2, gy, 4, gh);
      o.fillStyle = 'rgb(0,30,190)'; o.fillRect(gx, gy, gw, gh); o.fillStyle = 'rgb(0,120,170)'; o.fillRect(x + cw / 2 - 2, gy, 4, gh);
      if (rnd() < 0.42) {
        const [lr, lg, lb] = litColor(), a = 0.55 + rnd() * 0.45;
        e.fillStyle = rgbS(lr * a, lg * a, lb * a); e.fillRect(gx, gy, gw, gh);
        e.fillStyle = 'rgba(0,0,0,0.35)'; for (let k = 0; k < 6; k++) e.fillRect(gx, gy + k * gh / 6, gw, 2);
        e.fillStyle = '#000'; e.fillRect(x + cw / 2 - 2, gy, 4, gh);
      }
    }
  });
  // kamienica: 4 okna × 4 piętra (12,8 m × 14,4 m) — gzymsy, opaski, parapety, naczółki
  TX.tenement = mk(512, 512, (g, e, o, W, H) => {
    const cw = W / 4, rh = H / 4;
    g.fillStyle = '#e9e3d6'; g.fillRect(0, 0, W, H); noiseOver(g, W, H, 26);
    for (let r = 0; r < 4; r++) {
      const y = r * rh;
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y + rh - 10, W, 6); g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, y + rh - 4, W, 4);
      for (let q = 0; q < 4; q++) {
        const ww = cw * 0.42, wh = rh * 0.6, x = q * cw + (cw - ww) / 2, wy = y + rh * 0.17;
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x - 6, wy - 6, ww + 12, wh + 12);
        g.fillStyle = '#f6f4ee'; g.fillRect(x - 4, wy - 4, ww + 8, wh + 8);
        glassGrad(g, x, wy, ww, wh, '#7b8c9c', '#1d2630');
        g.fillStyle = '#f6f4ee'; g.fillRect(x + ww / 2 - 2, wy, 4, wh); g.fillRect(x, wy + wh * 0.32, ww, 4);
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x - 8, wy + wh + 4, ww + 16, 7); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x - 8, wy + wh + 11, ww + 16, 3);
        if (q % 2 === 0) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(x - 10, wy - 8); g.lineTo(x + ww / 2, wy - 24); g.lineTo(x + ww + 10, wy - 8); g.fill(); }
        else { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 10, wy - 16, ww + 20, 8); }
        o.fillStyle = 'rgb(0,35,60)'; o.fillRect(x, wy, ww, wh);
        if (rnd() < 0.4) {
          const [lr, lg, lb] = litColor(), a = 0.5 + rnd() * 0.5;
          e.fillStyle = rgbS(lr * a, lg * a, lb * a); e.fillRect(x, wy, ww, wh);
          e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(x + ww / 2 - 2, wy, 4, wh); e.fillRect(x, wy + wh * 0.32, ww, 4);
        }
      }
    }
  });
  // blok z wielkiej płyty: 4 moduły × 4 piętra (12 m × 11,2 m) — loggie z balustradami
  TX.panel = mk(512, 512, (g, e, o, W, H) => {
    const cw = W / 4, rh = H / 4;
    g.fillStyle = '#dcd8cf'; g.fillRect(0, 0, W, H); noiseOver(g, W, H, 22);
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
      const x = q * cw, y = r * rh;
      g.fillStyle = 'rgba(40,40,40,0.35)'; g.fillRect(x, y, cw, 2); g.fillRect(x, y, 2, rh);
      if (q === 1 || q === 2) {
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 8, y + 10, cw - 16, rh - 18);
        const ww = cw * 0.38, wh = rh * 0.52, wx = x + 16, wy = y + 18;
        g.fillStyle = '#f2f2ee'; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); glassGrad(g, wx, wy, ww, wh, '#8597a6', '#202a33');
        g.fillStyle = '#f2f2ee'; g.fillRect(x + cw - 16 - cw * 0.22, wy - 3, cw * 0.22, rh * 0.68); glassGrad(g, x + cw - 13 - cw * 0.22, wy, cw * 0.22 - 6, rh * 0.64, '#8597a6', '#202a33');
        g.fillStyle = 'rgba(255,255,255,0.65)'; g.fillRect(x + 6, y + rh * 0.62, cw - 12, rh * 0.3);
        g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 9; k++) g.fillRect(x + 10 + k * (cw - 20) / 8, y + rh * 0.62, 2, rh * 0.3);
        o.fillStyle = 'rgb(0,40,40)'; o.fillRect(wx, wy, ww, wh);
        if (rnd() < 0.45) { const [lr, lg, lb] = litColor(), a = 0.55 + rnd() * 0.45; e.fillStyle = rgbS(lr * a, lg * a, lb * a); e.fillRect(wx, wy, ww, wh); }
      } else {
        const ww = cw * 0.55, wh = rh * 0.46, wx = x + (cw - ww) / 2, wy = y + rh * 0.24;
        g.fillStyle = '#f2f2ee'; g.fillRect(wx - 4, wy - 4, ww + 8, wh + 8); glassGrad(g, wx, wy, ww, wh, '#8597a6', '#202a33');
        g.fillStyle = '#f2f2ee'; g.fillRect(wx + ww * 0.5 - 2, wy, 4, wh);
        o.fillStyle = 'rgb(0,40,40)'; o.fillRect(wx, wy, ww, wh);
        if (rnd() < 0.42) { const [lr, lg, lb] = litColor(), a = 0.55 + rnd() * 0.45; e.fillStyle = rgbS(lr * a, lg * a, lb * a); e.fillRect(wx, wy, ww, wh); e.fillStyle = '#000'; e.fillRect(wx + ww * 0.5 - 2, wy, 4, wh); }
      }
    }
  });
  // parter ze sklepami (12,8 m × 4,5 m): witryny, drzwi, nocą oświetlone wnętrza
  TX.shop = mk(512, 256, (g, e, o, W, H) => {
    g.fillStyle = '#d8d2c6'; g.fillRect(0, 0, W, H); noiseOver(g, W, H, 30);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, H - 14, W, 14);
    for (let q = 0; q < 2; q++) {
      const x = q * W / 2 + 16, w = W / 2 - 32;
      g.fillStyle = '#2d2a27'; g.fillRect(x - 5, 46, w + 10, H - 60);
      glassGrad(g, x, 52, w * 0.68, H - 72, '#6a7d8c', '#141a20');
      g.fillStyle = '#3b2c22'; g.fillRect(x + w * 0.72, 52, w * 0.28, H - 66);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x + w * 0.72 + 4, 60, w * 0.28 - 8, (H - 66) * 0.45);
      o.fillStyle = 'rgb(0,25,80)'; o.fillRect(x, 52, w * 0.68, H - 72);
      e.fillStyle = rnd() < 0.8 ? 'rgb(255,226,170)' : 'rgb(210,235,255)'; e.fillRect(x, 52, w * 0.68, H - 72);
      e.fillStyle = 'rgba(255,220,160,0.6)'; e.fillRect(x + w * 0.72 + 4, 60, w * 0.28 - 8, (H - 66) * 0.45);
    }
  });
  // lobby biurowca (12 m × 5 m)
  TX.lobby = mk(512, 256, (g, e, o, W, H) => {
    g.fillStyle = '#3c434b'; g.fillRect(0, 0, W, H);
    for (let q = 0; q < 4; q++) {
      const x = q * W / 4 + 6, w = W / 4 - 12;
      glassGrad(g, x, 20, w, H - 26, '#4c6176', '#141d26');
      o.fillStyle = 'rgb(0,25,200)'; o.fillRect(x, 20, w, H - 26);
      e.fillStyle = 'rgb(235,215,170)'; e.fillRect(x, 20, w, H - 26); e.fillStyle = 'rgba(0,0,0,0.5)'; e.fillRect(x, H * 0.55, w, 3);
    }
    g.fillStyle = '#9aa3ab'; g.fillRect(0, 0, W, 14);
  });
})();
// Materiał PBR z tekstury o rozmiarze kafla `m` metrów (UV w metrach): mapa koloru + opcjonalnie nierówności / szorstkość.
function pbrTex(canvas, data) { return data ? dataTex(canvas) : canvasTex(canvas, true); }
const TEXC = new Map();
function texOf(canvas, data) { if (!TEXC.has(canvas)) TEXC.set(canvas, pbrTex(canvas, data)); return TEXC.get(canvas); }
function repTex(canvas, rx, ry, data) { const t = texOf(canvas, data).clone(); t.repeat.set(rx, ry == null ? rx : ry); t.needsUpdate = true; t.__src = texOf(canvas, data); return t; }
// Elewacje (wallPool): biurowce szklane, kamienice z gzymsami i bloki z loggiami — kilka odcieni tynku.
// Szyby z mapy ORM są gładkie i metaliczne (odbijają niebo), okna świecą nocą (winMats → emissiveIntensity).
const FACADES = [
  { tex: TX.office, tw: 12, th: 14, env: 1.3, tints: [0xffffff, 0xd8e2ee, 0xe6e1d6] },
  { tex: TX.tenement, tw: 12.8, th: 14.4, tints: [0xffffff, 0xf2dcc0, 0xdfe6d6, 0xf0d4cf, 0xe8e0c8] },
  { tex: TX.panel, tw: 12, th: 11.2, tints: [0xffffff, 0xe7ecf2, 0xf2ead8] },
];
const winMats = [];
function facadeMaterial(f, tint) {
  const U = 16 / f.tw, V = 14 / f.th;   // buildingGeo: UV w kaflach 16 × 14 m
  const m = new THREE.MeshStandardMaterial({ color: tint, map: repTex(f.tex.map, U, V), emissiveMap: repTex(f.tex.em, U, V), emissive: 0xffffff, emissiveIntensity: 0,
    roughnessMap: repTex(f.tex.orm, U, V, true), metalnessMap: repTex(f.tex.orm, U, V, true), roughness: 1, metalness: 1, envMapIntensity: f.env || 1 });
  winMats.push(m);
  return m;
}
// budynki misji, punkt orientacyjny: 0 = biurowiec, 1 = kamienica, 2 = blok
function wallMaterial(style, tint) { return facadeMaterial(FACADES[style % FACADES.length], tint); }
const wallPool = [];
for (const f of FACADES) for (const t of f.tints) wallPool.push(facadeMaterial(f, t));
// parter: witryny sklepów (12,8 × 4,5 m) i przeszklone lobby biurowców (12 × 5 m); nocą świecą wnętrza
// Siatka miasta: jeden materiał na rodzaj elewacji, odcień tynku w kolorach wierzchołków (mniej wywołań rysowania).
// FAC_MATS: 0 biurowiec, 1 kamienica, 2 blok, 3 parter ze sklepami, 4 lobby; WALL_CHOICES = rodzaj + odcień.
const FAC_MATS = FACADES.map(f => facadeMaterial(f, 0xffffff)).concat([facadeMaterial({ tex: TX.shop, tw: 12.8, th: 4.5 }, 0xffffff), facadeMaterial({ tex: TX.lobby, tw: 12, th: 5 }, 0xffffff)]);
for (const m of FAC_MATS) m.vertexColors = true;
const SHOP_F = 3, LOBBY_F = 4;
FAC_MATS[SHOP_F].userData.emi = FAC_MATS[LOBBY_F].userData.emi = 0.5;   // witryny nocą słabiej niż okna mieszkań
const WALL_CHOICES = FACADES.flatMap((f, fi) => f.tints.map(tint => ({ f: fi, tint })));
const roofMat = new StdMat({ map: repTex(TX.roofFlat, 16 / 6) });      // papa ze żwirkiem (UV dachu: kafel 16 m)

// Nawierzchnie PBR (UV mapy w metrach / rozmiar kafla tekstury): asfalt 8 m, kostka 2 m, trawa 4 m.
const asphaltTex = texOf(TX.asphalt), grassTex = texOf(TX.grass), parkGrassTex = texOf(TX.parkGrass), sidewalkTex = texOf(TX.paving);
function asphaltMat(rep, extra) {
  return new StdMat(Object.assign({ map: repTex(TX.asphalt, rep), normalMap: repTex(TX.asphaltN, rep, rep, true), normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: repTex(TX.asphaltR, rep, rep, true), roughness: 1, envMapIntensity: 0.6 }, extra));
}
function pavingMat(rep, extra) {
  return new StdMat(Object.assign({ map: repTex(TX.paving, rep), normalMap: repTex(TX.pavingN, rep, rep, true), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.88 }, extra));
}
const grassMat = (rep, park) => new StdMat({ map: repTex(park ? TX.parkGrass : TX.grass, rep), roughness: 0.95 });
const concreteMat = new StdMat({ map: repTex(TX.concrete, 1 / 1.5), color: 0xd8d6d0, roughness: 0.85 });
const dashTex = (() => { const c = makeCanvas(8, 64), g = c.getContext('2d'); g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 8, 32); const t = canvasTex(c, true); return t; })();
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

// ---------------------------------------------------------------- kafle świata
// Statyczne siatki dzielone na kafle CHUNK × CHUNK m: kamera i mapa cieni rysują tylko kafle w swoim zasięgu
// (zamiast całego miasta w każdej klatce).
const CHUNK = 160;
function groupByChunk(items, xz) {
  const m = new Map();
  for (const it of items) { const [x, z] = xz(it), k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK); (m.get(k) || m.set(k, []).get(k)).push(it); }
  return [...m.values()];
}
// scalone części kolorowane (addStatic) → jedna siatka na kafel
function flushStaticChunks(material = vcMat, cast = true) {
  if (!staticParts.length) return;
  for (const grp of groupByChunk(staticParts, p => [p.m.elements[12], p.m.elements[14]])) {
    const st = new THREE.Mesh(mergeColored(grp), material);
    st.castShadow = cast; st.receiveShadow = true; scene.add(st);
  }
  staticParts.length = 0;
}

// ---------------------------------------------------------------- world state
const colliders = [];         // {x0,x1,z0,z1,h}
const addCol = (x0, x1, z0, z1, h) => colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), h });
const mapRects = [];          // for the 2D map
// Kolizja wielokątna (Warszawa): rings = [[x,z,x,z,…], …] (obrys + dziedzińce), bbox do szybkiego odrzutu.
function addPolyCol(rings, h) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < rings[0].length; i += 2) { const x = rings[0][i], z = rings[0][i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  colliders.push({ x0, x1, z0, z1, h, rings });
}
function polyInside(x, z, rings) {
  let c = false;
  for (const r of rings) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}
function polyNearest(x, z, rings) {
  let best = Infinity, bx = x, bz = z;
  for (const r of rings) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const ax = r[j], az = r[j + 1], ex = r[i] - ax, ez = r[i + 1] - az, L = ex * ex + ez * ez;
    let t = L > 0 ? ((x - ax) * ex + (z - az) * ez) / L : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + ex * t, pz = az + ez * t, d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return [bx, bz, Math.sqrt(best)];
}
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
      const X0 = lot0(bx + O, lx), Z0 = lot0(bz + O, lz);
      m.side = lx === 0 ? -1 : 1;
      m.lotX0 = X0; m.lotZ0 = Z0;
      m.mx = lx === 0 ? X0 + 3 : X0 + L - 3;
      m.mz = Z0 + L / 2;
    } else if (m.park) {
      m.mx = bc(m.park[0] + O); m.mz = bc(m.park[1] + O) + 10;
    } else if (m.cityHall) {
      m.mx = bc(m.cityHall[0] + O); m.mz = bx0(m.cityHall[1] + O) + 52;
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
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), grassMat(1000));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.03; grass.receiveShadow = true; scene.add(grass);
  const size = N * CELL + R;
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(size, size), asphaltMat(size / 8));
  asphalt.rotation.x = -Math.PI / 2; asphalt.receiveShadow = true; scene.add(asphalt);

  // Oznakowanie poziome jak na polskich ulicach (biała, lekko starta farba — oświetlana jak jezdnia, nocą nie świeci):
  // przerywana linia środkowa, ciągłe linie oddzielające pas postojowy, linie zatrzymania, przejścia dla pieszych.
  const paintMat = (map, extra) => new THREE.MeshStandardMaterial(Object.assign({ map, roughness: 0.72, transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -20 }, extra));
  const worn = repTex(TX.paint, 1);
  const segLen = CELL - R - 10;
  const dashGeo = new THREE.PlaneGeometry(0.15, segLen); dashGeo.rotateX(-Math.PI / 2);
  const dashT = dashTex.clone(); dashT.needsUpdate = true; dashT.repeat.set(1, segLen / 6);
  const dashes = new THREE.InstancedMesh(dashGeo, paintMat(dashT, { color: 0xe8e8e2 }), (N + 1) * N * 2);
  const lineGeo = new THREE.PlaneGeometry(0.13, B - 9); lineGeo.rotateX(-Math.PI / 2);
  const lines = new THREE.InstancedMesh(lineGeo, paintMat(worn, { transparent: false, alphaTest: 0 }), (N + 1) * N * 4);
  const d = new THREE.Object3D(); let k = 0, kl = 0;
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    const mid = (rc(j) + rc(j + 1)) / 2;
    d.position.set(rc(i), 0.02, mid); d.rotation.set(0, 0, 0); d.updateMatrix(); dashes.setMatrixAt(k++, d.matrix);
    d.position.set(mid, 0.02, rc(i)); d.rotation.set(0, Math.PI / 2, 0); d.updateMatrix(); dashes.setMatrixAt(k++, d.matrix);
    for (const o of [-5.1, 5.1]) {
      d.position.set(rc(i) + o, 0.02, mid); d.rotation.set(0, 0, 0); d.updateMatrix(); lines.setMatrixAt(kl++, d.matrix);
      d.position.set(mid, 0.02, rc(i) + o); d.rotation.set(0, Math.PI / 2, 0); d.updateMatrix(); lines.setMatrixAt(kl++, d.matrix);
    }
  }
  dashes.receiveShadow = lines.receiveShadow = true; dashes.frustumCulled = lines.frustumCulled = false; scene.add(dashes, lines);

  // przejścia dla pieszych + linie zatrzymania (na prawym pasie przed przejściem)
  const zGeo = new THREE.PlaneGeometry(R - 2, 3.6); zGeo.rotateX(-Math.PI / 2);
  const spots = [], stops = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = rc(i), z = rc(j), o = R / 2 + 2.2, so = o + 2.6;
    if (j < N) { spots.push([x, z + o, 0]); stops.push([x + 2.55, z + so, 0]); }
    if (j > 0) { spots.push([x, z - o, 0]); stops.push([x - 2.55, z - so, 0]); }
    if (i < N) { spots.push([x + o, z, Math.PI / 2]); stops.push([x + so, z - 2.55, Math.PI / 2]); }
    if (i > 0) { spots.push([x - o, z, Math.PI / 2]); stops.push([x - so, z + 2.55, Math.PI / 2]); }
  }
  const zebras = new THREE.InstancedMesh(zGeo, paintMat(zebraTex, { color: 0xe8e8e2 }), spots.length);
  spots.forEach((p, n) => { d.position.set(p[0], 0.025, p[1]); d.rotation.set(0, p[2], 0); d.updateMatrix(); zebras.setMatrixAt(n, d.matrix); });
  const stopGeo = new THREE.PlaneGeometry(5.1, 0.45); stopGeo.rotateX(-Math.PI / 2);
  const stopLines = new THREE.InstancedMesh(stopGeo, paintMat(worn, { transparent: false, alphaTest: 0 }), stops.length);
  stops.forEach((p, n) => { d.position.set(p[0], 0.025, p[1]); d.rotation.set(0, p[2], 0); d.updateMatrix(); stopLines.setMatrixAt(n, d.matrix); });
  zebras.receiveShadow = stopLines.receiveShadow = true; zebras.frustumCulled = stopLines.frustumCulled = false; scene.add(zebras, stopLines);

  // studzienki na jezdni i kratki ściekowe przy krawężnikach
  const mh = makeCanvas(128, 128), mg = mh.getContext('2d');
  mg.fillStyle = '#2c2d2f'; mg.fillRect(0, 0, 128, 128);
  mg.strokeStyle = '#4a4c50'; mg.lineWidth = 6; mg.beginPath(); mg.arc(64, 64, 58, 0, Math.PI * 2); mg.stroke();
  mg.lineWidth = 3; for (let r2 = 14; r2 < 52; r2 += 9) { mg.beginPath(); mg.arc(64, 64, r2, 0, Math.PI * 2); mg.stroke(); }
  for (let a2 = 0; a2 < 8; a2++) { mg.beginPath(); mg.moveTo(64, 64); mg.lineTo(64 + Math.cos(a2 * Math.PI / 4) * 52, 64 + Math.sin(a2 * Math.PI / 4) * 52); mg.stroke(); }
  const grate = makeCanvas(64, 128), gg = grate.getContext('2d');
  gg.fillStyle = '#3a3c40'; gg.fillRect(0, 0, 64, 128); gg.fillStyle = '#101112'; for (let y = 10; y < 120; y += 12) gg.fillRect(8, y, 48, 6);
  const metalMat = map => new THREE.MeshStandardMaterial({ map: canvasTex(map, false), roughness: 0.55, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 });
  const holes = [], drains = [], rh = mulberry(321);
  for (let i = 0; i <= N; i++) for (let j = 0; j < N; j++) {
    const mid = (rc(j) + rc(j + 1)) / 2, t = (rh() - 0.5) * 30, lane = rh() < 0.5 ? -2.6 : 2.6;
    holes.push(rh() < 0.5 ? [rc(i) + lane, mid + t] : [mid + t, rc(i) + lane]);
    for (const sd of [-1, 1]) { const tt = (rh() - 0.5) * 40; drains.push([rc(i) + sd * 7.55, mid + tt, 0], [mid + tt, rc(i) + sd * 7.55, Math.PI / 2]); }
  }
  const holeM = new THREE.InstancedMesh(new THREE.CircleGeometry(0.36, 20).rotateX(-Math.PI / 2), metalMat(mh), holes.length);
  holes.forEach(([x, z], n) => { d.position.set(x, 0.024, z); d.rotation.set(0, 0, 0); d.updateMatrix(); holeM.setMatrixAt(n, d.matrix); });
  const drainM = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.42, 0.8).rotateX(-Math.PI / 2), metalMat(grate), drains.length);
  drains.forEach(([x, z, r], n) => { d.position.set(x, 0.024, z); d.rotation.set(0, r, 0); d.updateMatrix(); drainM.setMatrixAt(n, d.matrix); });
  holeM.receiveShadow = drainM.receiveShadow = true; holeM.frustumCulled = drainM.frustumCulled = false; scene.add(holeM, drainM);
}
// Krawężniki z betonu dookoła każdego kwartału (zakrywają też boki płyty chodnika).
function buildCurbs() {
  const g = new THREE.BoxGeometry(B, SIDE_H + 0.03, 0.3).translate(0, (SIDE_H + 0.03) / 2, 0);
  const m = new StdMat({ map: repTex(TX.concrete, B / 1.5, 1), color: 0xd8d6d0, roughness: 0.85 });
  const curbs = new THREE.InstancedMesh(g, m, N * N * 4), d = new THREE.Object3D();
  let k = 0;
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    const X = bx0(bx), Z = bx0(bz);
    for (const [x, z, r] of [[X + B / 2, Z + 0.15, 0], [X + B / 2, Z + B - 0.15, 0], [X + 0.15, Z + B / 2, Math.PI / 2], [X + B - 0.15, Z + B / 2, Math.PI / 2]]) {
      d.position.set(x, 0, z); d.rotation.set(0, r, 0); d.updateMatrix(); curbs.setMatrixAt(k++, d.matrix);
    }
  }
  curbs.castShadow = false; curbs.receiveShadow = true; curbs.frustumCulled = false; scene.add(curbs);
}

const PARKS = { '2,2': true, '5,3': true, '1,6': true, '6,1': true };

// ---------------------------------------------------------------- Warszawa (mapa z danych)
const mapPolys = [];          // Warszawa: wielokąty do mapy 2D {tri:[x,z,…] | ring:[…], c}
function warsawFlat(L, y, material) {
  const n = L.f.length, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const k = L.f[i] * 2, x = L.v[k], z = L.v[k + 1];
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; nor[i * 3 + 1] = 1;
    uv[i * 2] = x / 6; uv[i * 2 + 1] = z / 6;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geom.computeBoundingSphere();
  const m = new THREE.Mesh(geom, material); m.receiveShadow = true; m.frustumCulled = false; scene.add(m);
}
const texClone = (t, r) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(r, r); c.__src = t; return c; };
function buildWarsaw() {
  const D = WD;
  scene.fog.near = MAPDEF.fog[0]; scene.fog.far = MAPDEF.fog[1];
  // ziemia: trawa dookoła; w mieście w obrębie mapy płyty chodnikowe, na wsi trawa
  const paved = MAPDEF.ground === 'pave';
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), grassMat(1000));
  grass.rotation.x = -Math.PI / 2; grass.position.y = paved ? -0.6 : -0.02; grass.receiveShadow = true; scene.add(grass);   // pod płytami nisko: bez migotania z daleka
  if (paved) {
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(2 * W_EXT, 2 * W_EXT), pavingMat(W_EXT));
    pave.rotation.x = -Math.PI / 2; pave.position.y = -0.02; pave.receiveShadow = true; scene.add(pave);
  }
  const off = (m, f) => Object.assign(m, { polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f, side: THREE.DoubleSide });
  warsawFlat(D.green, 0.01, off(new StdMat({ map: repTex(TX.parkGrass, 1.5), roughness: 0.95 }), -1));
  const waterMat = off(new StdMat({ color: 0x3f8fc9 }), -2); waterMat.userData.water = true;
  warsawFlat(D.water, 0.02, waterMat);
  warsawFlat(D.roads, 0.03, off(asphaltMat(0.75), -3));   // jezdnia nad wodą — mosty
  mapPolys.push({ tri: D.green, c: '#2d5237' }, { tri: D.water, c: '#2b5d8a' }, { tri: D.roads, c: '#5b6578' });
  // budynki: ściany z oknami (UV: 16 m × 14 m na kafel, jak w Grammar City), dachy szare
  const W = {}, Rf = { p: [], n: [], u: [] };
  const sand = wallMaterial(1, MAPDEF.landmarkTint || 0xe8dcc0);   // punkt orientacyjny (Pałac Kultury — piaskowiec)
  wallPool.push(sand); const sandIdx = wallPool.length - 1;
  const Tl = { p: [], n: [], u: [] };                  // dachówka (dachy dwuspadowe na wsi)
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nrm = new THREE.Vector3();
  // Paryż: wieża Eiffla w danych to 4 pełne bryły jedna w drugiej — zamiast nich kratownica (buildEiffel)
  const eiffel = MAPDEF.eiffel ? eiffelFrame(D) : null;
  if (eiffel) buildEiffel(eiffel);
  D.buildings.forEach((bd, bi) => {
    if (eiffel && eiffel.parts.has(bd)) return;
    const v = bd.v, f = bd.f;
    let cx = 0, cz = 0; const r0 = bd.r[0]; for (let i = 0; i < r0.length; i += 2) { cx += r0[i]; cz += r0[i + 1]; } cx /= r0.length / 2; cz /= r0.length / 2;
    const nearPkin = !!MAPDEF.landmarkTint && Math.hypot(cx - D.pkin[0], cz - D.pkin[1]) < MAPDEF.landmarkR;
    const wi = nearPkin ? sandIdx : (bi * 7 + Math.round(bd.h)) % (wallPool.length - 1);
    const dst = W[wi] || (W[wi] = { p: [], n: [], u: [] });
    for (let t = 0; t < f.length; t += 3) {
      // oś Z odbita względem danych → zamiana kolejności wierzchołków przywraca normalne na zewnątrz
      const i0 = f[t] * 3, i1 = f[t + 2] * 3, i2 = f[t + 1] * 3;
      a.set(v[i0], v[i0 + 1], v[i0 + 2]); b.set(v[i1], v[i1 + 1], v[i1 + 2]); c.set(v[i2], v[i2 + 1], v[i2 + 2]);
      nrm.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); const len = nrm.length(); if (len < 1e-6) continue; nrm.divideScalar(len);
      // ściana skierowana do środka obrysu → odwróć (dane mają mieszaną kolejność wierzchołków)
      if (Math.abs(nrm.y) <= 0.7 && polyInside((a.x + b.x + c.x) / 3 + nrm.x * 0.6, (a.z + b.z + c.z) / 3 + nrm.z * 0.6, bd.r)) { nrm.negate(); const tmp = b.clone(); b.copy(c); c.copy(tmp); }
      else if (nrm.y < -0.7) { nrm.negate(); const tmp = b.clone(); b.copy(c); c.copy(tmp); }   // dach: normalna w górę
      if (Math.abs(nrm.y) > 0.7) {
        for (const p of [a, b, c]) { Rf.p.push(p.x, p.y, p.z); Rf.n.push(nrm.x, nrm.y, nrm.z); Rf.u.push(p.x / 8, p.z / 8); }
      } else {
        const tl = Math.hypot(nrm.x, nrm.z) || 1, tx = -nrm.z / tl, tz = nrm.x / tl;
        for (const p of [a, b, c]) { dst.p.push(p.x, p.y, p.z); dst.n.push(nrm.x, nrm.y, nrm.z); dst.u.push((p.x * tx + p.z * tz) / 16, p.y / 14); }
      }
    }
    if (MAPDEF.gable && bd.g) gableRoof(bd, dst, Tl);
    if (bd.g) {
      addPolyCol(bd.r, bd.h);
      mapPolys.push({ rings: bd.r, c: bd.h > 40 ? '#4a5568' : '#3c4656' });
    }
  });
  const meshOf = (A, material) => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(A.u, 2));
    geom.computeBoundingSphere();
    const m = new THREE.Mesh(geom, material); m.castShadow = m.receiveShadow = true; scene.add(m);
  };
  // Siatki z danych mają różną kolejność wierzchołków (część ścian „patrzy” do środka) —
  // ściany i dachy rysujemy dwustronnie; Lambert oświetla tył odwróconą normalną, więc
  // fasada widziana z zewnątrz jest zawsze widoczna i poprawnie oświetlona.
  for (const wi in W) { wallPool[wi].side = THREE.DoubleSide; meshOf(W[wi], wallPool[wi]); }
  roofMat.side = THREE.DoubleSide;
  meshOf(Rf, roofMat);
  if (Tl.p.length) { const tm = new StdMat({ color: 0xa4452f, side: THREE.DoubleSide }); tm.userData.tile = true; meshOf(Tl, tm); }
  // drzewa z danych + latarnie wzdłuż chodników
  for (let i = 0; i < D.trees.length; i += 3) treeSpots.push([D.trees[i], D.trees[i + 1], D.trees[i + 2]]);
  for (const path of D.pedPaths) {
    let acc = 14;
    for (let i = 2; i < path.length; i += 2) {
      const x0 = path[i - 2], z0 = path[i - 1], x1 = path[i], z1 = path[i + 1], L = Math.hypot(x1 - x0, z1 - z0);
      for (let s = 0; s < L; s += 2) { acc += 2; if (acc >= 32) { acc = 0; lampSpots.push([x0 + (x1 - x0) * s / L, z0 + (z1 - z0) * s / L]); } }
    }
  }
  layoutMissionsWarsaw();
  buildWaterGrid();
  buildTrees();
  buildLamps();
  const st = staticParts.length ? new THREE.Mesh(mergeColored(staticParts), vcMat) : null;
  if (st) { st.castShadow = st.receiveShadow = true; st.frustumCulled = false; scene.add(st); staticParts.length = 0; }
}
// Położenie wieży Eiffla z danych: części w promieniu 20 m od punktu orientacyjnego, podstawa (z łukami) ma
// najwięcej punktów obrysu; kierunek boków = średnia kątów krawędzi modulo 90° (ważona długością).
function eiffelFrame(D) {
  const parts = new Set(); let base = null, top = 0;
  for (const bd of D.buildings) {
    const r = bd.r[0]; let cx = 0, cz = 0;
    for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; }
    if (Math.hypot(cx / (r.length / 2) - D.pkin[0], cz / (r.length / 2) - D.pkin[1]) > 20) continue;
    parts.add(bd); top = Math.max(top, bd.h);
    if (!base || r.length > base.r[0].length) base = bd;
  }
  if (!base) return null;
  const r = base.r[0]; let sc = 0, ss = 0;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const dx = r[i] - r[j], dz = r[i + 1] - r[j + 1], L = Math.hypot(dx, dz), t = Math.atan2(dz, dx) * 4;
    sc += Math.cos(t) * L; ss += Math.sin(t) * L;
  }
  const ang = Math.atan2(ss, sc) / 4, ca = Math.cos(ang), sa = Math.sin(ang);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let i = 0; i < r.length; i += 2) {
    const u = r[i] * ca + r[i + 1] * sa, v = -r[i] * sa + r[i + 1] * ca;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
  return { parts, ang, cx: uc * ca - vc * sa, cz: uc * sa + vc * ca, W0: (u1 - u0 + v1 - v0) / 4, H: Math.max(top, 200) };
}
// Kratownica wieży: 4 nogi (ażurowe ściany + belki w narożnikach) łączące się przy 2. piętrze, trzon do 3. piętra,
// łuki między nogami, platformy, antena. Profil w(y) — wykładniczy jak w prawdziwej wieży. Kolizje tylko na nogach,
// pod wieżą można przejść. Nocą wieża świeci na złoto (materiały w winMats).
function buildEiffel(F) {
  const S = F.H / 286, W0 = F.W0;
  const y1 = 57 * S, y2 = 116 * S, y3 = 276 * S, yTop = 300 * S, yAnt = 324 * S;
  const k = Math.log(W0 / 3.2) / yTop, w = y => W0 * Math.exp(-k * y);
  const t0 = W0 * 0.38, tt = y => t0 + (w(y2) - t0) * Math.min(1, y / y2);   // szerokość nogi — przy 2. piętrze nogi się stykają
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineCap = 'square';
  g.lineWidth = 9; g.strokeRect(0, 0, 64, 64);
  g.lineWidth = 6; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(0, 32); g.lineTo(64, 32); g.stroke();
  const latMat = new StdMat({ color: 0x7a5d44, map: canvasTex(c, true), alphaTest: 0.3, side: THREE.DoubleSide, emissive: 0x7a4a12, emissiveIntensity: 0 });
  const solMat = new StdMat({ color: 0x6b5140, side: THREE.DoubleSide, emissive: 0x7a4a12, emissiveIntensity: 0 });
  winMats.push(latMat, solMat);
  const Lat = { p: [], n: [], u: [] }, Sol = { p: [], n: [], u: [] };
  const tri = new THREE.Vector3(), q1 = new THREE.Vector3(), q2 = new THREE.Vector3();
  // ściana czworokątna p0-p1 (dół) / p3-p2 (góra); normalna z kolejności wierzchołków — DoubleSide oświetla obie strony
  const quad = (A, p0, p1, p2, p3, s) => {
    q1.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]); q2.set(p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]);
    tri.crossVectors(q1, q2); if (tri.lengthSq() < 1e-9) return; tri.normalize();
    const lb = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / 2 / s, lt = Math.hypot(p2[0] - p3[0], p2[2] - p3[2]) / 2 / s;
    const P = [p0, p1, p2, p3], U = [[-lb, p0[1] / s], [lb, p1[1] / s], [lt, p2[1] / s], [-lt, p3[1] / s]];
    for (const i of [0, 1, 2, 0, 2, 3]) { A.p.push(P[i][0], P[i][1], P[i][2]); A.n.push(tri.x, tri.y, tri.z); A.u.push(U[i][0], U[i][1]); }
  };
  // graniastosłup przez kolejne poziomy: corners(y) → 4 narożniki [u, v]
  const tube = (A, levels, corners, s, caps) => {
    for (let l = 1; l < levels.length; l++) {
      const ya = levels[l - 1], yb = levels[l], ca = corners(ya), cb = corners(yb);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        quad(A, [ca[i][0], ya, ca[i][1]], [ca[j][0], ya, ca[j][1]], [cb[j][0], yb, cb[j][1]], [cb[i][0], yb, cb[i][1]], s);
      }
    }
    if (caps) for (const y of [levels[0], levels[levels.length - 1]]) { const q = corners(y); quad(A, [q[0][0], y, q[0][1]], [q[1][0], y, q[1][1]], [q[2][0], y, q[2][1]], [q[3][0], y, q[3][1]], 8); }
  };
  const sq = (u, v, h) => [[u - h, v - h], [u + h, v - h], [u + h, v + h], [u - h, v + h]];
  const box = (A, ua, ub, va, vb, ya, yb) => tube(A, [ya, yb], () => [[ua, va], [ub, va], [ub, vb], [ua, vb]], 8, true);
  const range = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
  const legLv = [...range(0, y1, 6), ...range(y1, y2, 5).slice(1)], shaftLv = range(y2, y3, 10), topLv = range(y3 + 9 * S, yTop, 3);
  const SIGNS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  for (const [sx, sz] of SIGNS) {
    const corner = (y, ci) => { const o = w(y), i = w(y) - tt(y), cs = [[i, i], [o, i], [o, o], [i, o]][ci]; return [sx * cs[0], sz * cs[1]]; };
    tube(Lat, legLv, y => [0, 1, 2, 3].map(ci => corner(y, ci)), 4.5 * S);
    for (let ci = 0; ci < 4; ci++) tube(Sol, legLv, y => { const p = corner(y, ci); return sq(p[0], p[1], 0.9 * S); });
  }
  tube(Lat, shaftLv, y => sq(0, 0, w(y)), 4 * S);
  for (const [sx, sz] of SIGNS) tube(Sol, shaftLv, y => { const h = w(y); return sq(sx * h, sz * h, 0.7 * S); });
  tube(Lat, topLv, y => sq(0, 0, w(y)), 2.5 * S, false);
  tube(Sol, [y3 - S, y3 + 9 * S], () => sq(0, 0, w(y3) + 1.5 * S), 8, true);                  // 3. piętro (kabina)
  tube(Sol, [yTop - 2 * S, yTop + 4 * S], () => sq(0, 0, 3.4 * S), 8, true);
  tube(Sol, [yTop + 4 * S, yAnt], y => sq(0, 0, (0.7 - 0.5 * (y - yTop) / (yAnt - yTop)) * S), 8, true);   // antena
  // 1. piętro: rama wokół nóg (galeria) z otworem w środku; 2. piętro: pełna płyta
  const p1o = w(y1) + 3 * S, p1i = w(y1) * 0.5, p1a = y1 - 7 * S;
  box(Sol, -p1o, p1o, p1i, p1o, p1a, y1); box(Sol, -p1o, p1o, -p1o, -p1i, p1a, y1);
  box(Sol, p1i, p1o, -p1i, p1i, p1a, y1); box(Sol, -p1o, -p1i, -p1i, p1i, p1a, y1);
  box(Sol, -w(y1) - 3.6 * S, w(y1) + 3.6 * S, -w(y1) - 3.6 * S, -w(y1) - 3 * S, y1, y1 + 2.4 * S);   // barierki galerii
  box(Sol, -w(y1) - 3.6 * S, w(y1) + 3.6 * S, w(y1) + 3 * S, w(y1) + 3.6 * S, y1, y1 + 2.4 * S);
  box(Sol, -w(y1) - 3.6 * S, -w(y1) - 3 * S, -w(y1) - 3 * S, w(y1) + 3 * S, y1, y1 + 2.4 * S);
  box(Sol, w(y1) + 3 * S, w(y1) + 3.6 * S, -w(y1) - 3 * S, w(y1) + 3 * S, y1, y1 + 2.4 * S);
  box(Sol, -w(y2) - 2 * S, w(y2) + 2 * S, -w(y2) - 2 * S, w(y2) + 2 * S, y2 - 4 * S, y2);
  const grp = new THREE.Group();
  for (const [A, m] of [[Lat, latMat], [Sol, solMat]]) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(A.p, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(A.n, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(A.u, 2));
    geom.computeBoundingSphere();
    const mesh = new THREE.Mesh(geom, m); mesh.castShadow = mesh.receiveShadow = true; grp.add(mesh);
  }
  // łuki między nogami — na zewnętrznej ścianie, od ok. 12 m do spodu 1. piętra
  const ys = 12 * S, yc = p1a - 2 * S, span = w(ys) - tt(ys) + 1.5 * S;
  for (let f = 0; f < 4; f++) {
    const arc = new THREE.Curve();
    arc.getPoint = (t, out = new THREE.Vector3()) => {
      const th = Math.PI * t, x = span * Math.cos(th), y = ys + (yc - ys) * Math.sin(th), z = w(y) - 0.8 * S;
      return f === 0 ? out.set(x, y, z) : f === 1 ? out.set(z, y, -x) : f === 2 ? out.set(-x, y, -z) : out.set(-z, y, x);
    };
    const m = new THREE.Mesh(new THREE.TubeGeometry(arc, 36, 1.5 * S, 6, false), solMat); m.castShadow = true; grp.add(m);
  }
  grp.position.set(F.cx, 0, F.cz); grp.rotation.y = -F.ang; scene.add(grp);
  // kolizje i mapa 2D: tylko podstawy nóg
  const ca = Math.cos(F.ang), sa = Math.sin(F.ang), o = w(0), i = w(0) - tt(0);
  for (const [sx, sz] of SIGNS) {
    const ring = [];
    for (const [cu, cv] of [[i, i], [o, i], [o, o], [i, o]]) { const u = sx * cu, v = sz * cv; ring.push(F.cx + u * ca - v * sa, F.cz + u * sa + v * ca); }
    addPolyCol([ring], y1); colliders[colliders.length - 1].tower = true;
    mapPolys.push({ rings: [ring], c: '#8a6d4f' });
  }
}
// Woda blokuje ruch (pieszo, pojazdy na ziemi, zwierzęta) — raster 1 m z trójkątów WD.water; jezdnie (mosty)
// wycinają przejście. Grammar City ma staw z kolizją wielokątną, więc tam raster nie jest potrzebny.
let waterGrid = null;
function buildWaterGrid() {
  const E = W_EXT, G = Math.ceil(2 * E), grid = new Uint8Array(G * G);
  const fill = (L, val) => {
    if (!L || !L.f) return;
    for (let t = 0; t < L.f.length; t += 3) {
      const a = L.f[t] * 2, b = L.f[t + 1] * 2, c = L.f[t + 2] * 2;
      const ax = L.v[a], az = L.v[a + 1], bx = L.v[b], bz = L.v[b + 1], cx = L.v[c], cz = L.v[c + 1];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) + E)), x1 = Math.min(G - 1, Math.ceil(Math.max(ax, bx, cx) + E));
      const z0 = Math.max(0, Math.floor(Math.min(az, bz, cz) + E)), z1 = Math.min(G - 1, Math.ceil(Math.max(az, bz, cz) + E));
      for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
        const px = ix - E + 0.5, pz = iz - E + 0.5;
        const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d;
        if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) grid[iz * G + ix] = val;
      }
    }
  };
  fill(WD.water, 1); fill(WD.roads, 0);
  waterGrid = { grid, G, E };
}
function inWater(x, z) {
  if (!waterGrid) return false;
  const ix = Math.floor(x + waterGrid.E), iz = Math.floor(z + waterGrid.E);
  return ix >= 0 && iz >= 0 && ix < waterGrid.G && iz < waterGrid.G && waterGrid.grid[iz * waterGrid.G + ix] === 1;
}
const waterHit = (x, z, r = 0.4) => inWater(x, z) || inWater(x + r, z) || inWater(x - r, z) || inWater(x, z + r) || inWater(x, z - r);
// Przesunięcie (ox,oz) → p wchodzi do wody: ślizg wzdłuż brzegu albo powrót. Gdy już stoimy w wodzie — nie blokuje (wyjście).
function waterSlide(ox, oz, p, r) {
  if (!waterGrid || !waterHit(p.x, p.z, r) || waterHit(ox, oz, r)) return false;
  if (!waterHit(p.x, oz, r)) p.z = oz;
  else if (!waterHit(ox, p.z, r)) p.x = ox;
  else { p.x = ox; p.z = oz; }
  return true;
}
// Dach dwuspadowy na prostokątnym domu (obrys 4 narożniki, bez dziedzińca): kalenica wzdłuż
// dłuższego boku, połacie w kolorze dachówki, szczyty (trójkąty) w kolorze ścian.
function gableRoof(bd, wallDst, tileDst) {
  if (bd.r.length !== 1) return;
  let pts = [];
  for (let i = 0; i < bd.r[0].length; i += 2) pts.push([bd.r[0][i], bd.r[0][i + 1]]);
  if (pts.length > 1 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.05) pts.pop();
  // usuń punkty prawie współliniowe
  pts = pts.filter((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], c = pts[(i + 1) % pts.length];
    const cr = (p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0]);
    return Math.abs(cr) > 0.02 * Math.hypot(p[0] - a[0], p[1] - a[1]) * Math.hypot(c[0] - p[0], c[1] - p[1]);
  });
  if (pts.length !== 4) return;
  const L = (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
  let [A, B, C, Dd] = pts;
  if (L(0, 1) < L(1, 2)) [A, B, C, Dd] = [pts[1], pts[2], pts[3], pts[0]];   // AB = dłuższy bok
  const short = Math.min(L(0, 1), L(1, 2));
  if (short < 3 || short > 22) return;
  const h = bd.h, rh = Math.min(3.2, short * 0.42);
  const M1 = [(Dd[0] + A[0]) / 2, (Dd[1] + A[1]) / 2], M2 = [(B[0] + C[0]) / 2, (B[1] + C[1]) / 2];
  const V = (p, y) => new THREE.Vector3(p[0], y, p[1]);
  const tri = (dst, a, b, c, wall) => {
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a));
    const len = n.length(); if (len < 1e-6) return; n.divideScalar(len);
    if (wall) { if (polyInside((a.x + b.x + c.x) / 3 + n.x * 0.6, (a.z + b.z + c.z) / 3 + n.z * 0.6, bd.r)) n.negate(); }
    else if (n.y < 0) n.negate();
    const tl = Math.hypot(n.x, n.z) || 1, tx = -n.z / tl, tz = n.x / tl;
    for (const p of [a, b, c]) {
      dst.p.push(p.x, p.y, p.z); dst.n.push(n.x, n.y, n.z);
      if (wall) dst.u.push((p.x * tx + p.z * tz) / 16, p.y / 14); else dst.u.push(p.x / 4, p.z / 4);
    }
  };
  const a = V(A, h), b = V(B, h), c = V(C, h), d = V(Dd, h), m1 = V(M1, h + rh), m2 = V(M2, h + rh);
  tri(tileDst, a, b, m2); tri(tileDst, a, m2, m1);       // połać nad AB
  tri(tileDst, c, d, m1); tri(tileDst, c, m1, m2);       // połać nad CD
  tri(wallDst, b, c, m2, true); tri(wallDst, d, a, m1, true);   // szczyty
}
// Misje w Warszawie: miejsca na chodnikach (posortowane od startu) — wyższe etapy dalej;
// egzamin końcowy przed Pałacem Kultury.
function layoutMissionsWarsaw() {
  const spots = WD.missionSpots, order = MISSIONS.filter(m => !m.cityHall)
    .sort((a, b) => (a.tier - b.tier) || (MISSIONS.indexOf(a) - MISSIONS.indexOf(b)));
  const step = spots.length / Math.max(1, order.length);
  order.forEach((m, i) => { const s = spots[Math.min(spots.length - 1, Math.floor(i * step + step * 0.35))]; m.mx = s[0]; m.mz = s[1]; });
  for (const m of MISSIONS) if (m.cityHall) { m.mx = WD.finale[0]; m.mz = WD.finale[1]; if (m.place === 'City Hall') m.place = MAPDEF.finaleEN; }
}
const slabMat = pavingMat(32);

function buildCity() {
  if (REALMAP) { buildWarsaw(); return; }
  layoutMissions();
  buildGround();
  buildCurbs();
  if (METRO) { scene.fog.near = 200; scene.fog.far = 700; }
  const lotOwner = {};
  for (const m of MISSIONS) if (m.block) lotOwner[`${m.block[0] + O},${m.block[1] + O},${m.lot[0]},${m.lot[1]}`] = m;
  const slabs = new THREE.InstancedMesh(new THREE.BoxGeometry(B, SIDE_H, B), slabMat, N * N);
  slabs.receiveShadow = true; slabs.frustumCulled = false; scene.add(slabs);
  const sd = new THREE.Object3D(), lawns = [];
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    const X = bx0(bx), Z = bx0(bz);
    sd.position.set(X + B / 2, SIDE_H / 2, Z + B / 2); sd.updateMatrix(); slabs.setMatrixAt(bx * N + bz, sd.matrix);
    mapRects.push({ x0: X, z0: Z, x1: X + B, z1: Z + B, c: '#2b3340' });
    const key = `${bx - O},${bz - O}`, zone = blockZone(bx, bz);
    const hallM = MISSIONS.find(m => m.cityHall && `${m.cityHall[0]},${m.cityHall[1]}` === key);
    if (zone !== 'core') {
      // Metropolia poza centrum: trawnik w środku kwartału, na nim osiedle bloków albo domy z ogródkami
      const h = hash2(bx, bz);
      if (h >= 0.07) lawns.push([X + B / 2, Z + B / 2]);
      if (h < 0.07) buildPark(X, Z, null);
      else if (zone === 'mid') buildEstate(X, Z, h);
      else buildSuburb(X, Z, bx, bz);
    }
    else if (hallM) { buildCityHall(X, Z, hallM); }
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
  if (lawns.length) {
    const lawn = new THREE.InstancedMesh(geo('lawnPlane', () => new THREE.PlaneGeometry(B - 2 * SW, B - 2 * SW).rotateX(-Math.PI / 2)),
      grassMat((B - 2 * SW) / 4, true), lawns.length);
    lawns.forEach(([x, z], i) => { sd.position.set(x, SIDE_H + 0.011, z); sd.updateMatrix(); lawn.setMatrixAt(i, sd.matrix); });
    lawn.receiveShadow = true; lawn.frustumCulled = false; scene.add(lawn);
  }
  buildLake();
  // countryside around the city
  for (let i = 0; i < 360; i++) {
    const a = rand() * Math.PI * 2, r = HALF + rr(14, 230);
    let x = Math.cos(a) * r, z = Math.sin(a) * r;
    x = clamp(x, -HALF - 240, HALF + 240); z = clamp(z, -HALF - 240, HALF + 240);
    if (Math.abs(x) < HALF + 8 && Math.abs(z) < HALF + 8) continue;
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4.5) continue;
    treeSpots.push([x, z, rr(1, 1.8)]);
  }
  buildTrees();
  buildLamps();
  // merged meshes
  if (signQuads.length) buildShopSigns();
  // budynki: jedna siatka na kafel (grupy: 5 rodzajów elewacji + dachy)
  for (const grp of groupByChunk(bldParts, p => [p.x, p.z])) {
    const mesh = new THREE.Mesh(mergeBuildings(grp), FAC_MATS.concat([roofMat]));
    mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
  }
  bldParts.length = 0;
  flushStaticChunks();
}

// ---------------------------------------------------------------- Metropolia: osiedla i przedmieścia
// Strefa kwartału: 'core' = Grammar City w środku, 'mid' = osiedla bloków (2 pierścienie), 'sub' = domy z ogródkami.
function blockZone(bx, bz) {
  if (!METRO || (bx >= O && bx < O + 8 && bz >= O && bz < O + 8)) return 'core';
  const ring = Math.max(Math.abs(bx - (N - 1) / 2), Math.abs(bz - (N - 1) / 2));
  return ring < 6 ? 'mid' : 'sub';
}
const hash2 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const driveSpots = [];        // podjazdy przy domach — część aut parkuje tam (spawnParked)
const HOUSE_WALLS = [0xf2e6d0, 0xe9dcc5, 0xd9c7a8, 0xf5f1e8, 0xcfd8dc, 0xe8d5c4, 0xf0e2b6, 0xd7e3d0, 0xe6cfc0, 0xc9d6e0];
const HOUSE_ROOFS = [0xa4452f, 0x8b3a2b, 0x5a5f66, 0x3f4247, 0x7a4a33, 0x9c5b3a];
// trójkątny graniastosłup 1 × 1 × 1 (dach dwuspadowy — kalenica wzdłuż osi Z), skalowany w addStatic
const roofPrism = () => geo('roofPrism', () => {
  const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
});
// Osiedle: dwa długie bloki (5 pięter) z podwórkiem i placem zabaw albo wieżowiec-punktowiec (10–12 pięter).
function buildEstate(X, Z, h) {
  const rnd = mulberry(Math.floor(h * 1e6)), r2 = (a, b) => a + rnd() * (b - a);
  const cx = X + B / 2, cz = Z + B / 2, panels = WALL_CHOICES.filter(c => c.f === 2), wc = rnd() < 0.75 ? panels[Math.floor(rnd() * panels.length)] : WALL_CHOICES[Math.floor(rnd() * WALL_CHOICES.length)];
  const put = (w, hh, d, x, z) => {
    bldParts.push({ g: buildingGeo(w, hh, d), x, z, f: wc.f, tint: wc.tint });
    addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2, hh);
    mapRects.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, c: '#3c4656' });
  };
  if (h < 0.3) {                                          // punktowiec
    const hh = r2(30, 37); put(18, hh, 18, cx, cz);
    addBox(6, 2.4, 6, mat(0x8a8d93), cx, hh + 1.2, cz);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; treeSpots.push([cx + Math.cos(a) * 19, cz + Math.sin(a) * 19, r2(0.9, 1.3)]); }
    return;
  }
  const alongX = h < 0.65, hh = r2(14, 16.5);
  for (const s of [-1, 1]) {
    if (alongX) put(44, hh, 11, cx, cz + s * 15); else put(11, hh, 44, cx + s * 15, cz);
  }
  // podwórko: piaskownica, zjeżdżalnia, huśtawka, ławki, drzewa
  const sandC = 0xe3cf98, metal = 0xc0392b;
  addBox(5, 0.35, 5, mat(sandC), cx - 6, SIDE_H + 0.17, cz);
  addBox(5.4, 0.45, 0.25, mat(0x8a5a33), cx - 6, SIDE_H + 0.22, cz - 2.7); addBox(5.4, 0.45, 0.25, mat(0x8a5a33), cx - 6, SIDE_H + 0.22, cz + 2.7);
  addBox(0.25, 0.45, 5.4, mat(0x8a5a33), cx - 8.7, SIDE_H + 0.22, cz); addBox(0.25, 0.45, 5.4, mat(0x8a5a33), cx - 3.3, SIDE_H + 0.22, cz);
  addBox(1.2, 2.2, 1.2, mat(0x2e86de), cx + 4, SIDE_H + 1.1, cz - 2);
  addStatic(BOX(1, 0.12, 3.6), 0xf2b632, cx + 4, SIDE_H + 1.25, cz, 0, 1, 1, 1);
  for (const dx of [-1.3, 1.3]) addBox(0.12, 2.4, 0.12, mat(metal), cx + 8 + dx, SIDE_H + 1.2, cz + 3);
  addBox(2.8, 0.12, 0.12, mat(metal), cx + 8, SIDE_H + 2.4, cz + 3);
  addBox(0.8, 0.08, 0.4, mat(0x3a3e45), cx + 8, SIDE_H + 0.7, cz + 3);
  addCol(cx - 8.6, cx - 3.4, cz - 2.6, cz + 2.6, 0.5); addCol(cx + 3.4, cx + 4.6, cz - 2.6, cz - 1.4, 2.2);
  for (const [dx, dz] of [[-14, -6], [14, 6], [-14, 6], [14, -6]]) treeSpots.push([cx + (alongX ? dx : dz), cz + (alongX ? dz : dx), r2(0.9, 1.3)]);
}
// Przedmieście: 4 działki z domami (1–2 piętra, dach dwuspadowy, komin), żywopłot albo płotek, podjazd, drzewa w ogrodzie.
function buildSuburb(X, Z, bx, bz) {
  const rnd = mulberry(bx * 7919 + bz * 104729 + 17), r2 = (a, b) => a + rnd() * (b - a), pk = a => a[Math.floor(rnd() * a.length)];
  for (let lx = 0; lx < 2; lx++) for (let lz = 0; lz < 2; lz++) {
    const X0 = lot0(bx, lx), Z0 = lot0(bz, lz), sx = lx === 0 ? -1 : 1;        // sx: strona ulicy (−1 zachód, +1 wschód)
    const w = r2(8.5, 11), d = r2(9, 12), fl = rnd() < 0.55 ? 2 : 1, wallH = fl * 2.9 + 0.3, rh = r2(2.2, 3.2);
    const streetX = sx < 0 ? X0 : X0 + L, hx = streetX - sx * (6.5 + w / 2), hz = Z0 + L / 2 + r2(-2, 2);
    const wall = pk(HOUSE_WALLS), roof = pk(HOUSE_ROOFS);
    addStatic(BOX(w, wallH, d), wall, hx, SIDE_H + wallH / 2, hz);
    addStatic(BOX(w + 0.12, 0.35, d + 0.12), 0x9b9a96, hx, SIDE_H + 0.17, hz);                        // cokół
    addStatic(roofPrism(), roof, hx, SIDE_H + wallH, hz, 0, w + 0.9, rh, d + 0.9);                     // dach
    addStatic(BOX(0.7, 1.8, 0.7), 0x8d4a35, hx + w * 0.22, SIDE_H + wallH + rh * 0.7, hz - d * 0.2);  // komin
    addCol(hx - w / 2, hx + w / 2, hz - d / 2, hz + d / 2, wallH + rh);
    mapRects.push({ x0: hx - w / 2, z0: hz - d / 2, x1: hx + w / 2, z1: hz + d / 2, c: '#5a463a' });
    // okna i drzwi: od ulicy (ściana x = ±w/2) i z boków
    const fx = hx + sx * (w / 2 + 0.03);
    for (let f = 0; f < fl; f++) {
      const y = SIDE_H + 1.65 + f * 2.9;
      for (const oz of [-d / 4, d / 4]) {
        if (f === 0 && oz > 0) continue;                    // miejsce na drzwi
        addStatic(BOX(0.06, 1.45, 1.35), 0xf4f4f4, fx, y, hz + oz); addStatic(BOX(0.08, 1.25, 1.15), 0x2b3d52, fx + sx * 0.01, y, hz + oz);
      }
      for (const s2 of [-1, 1]) { addStatic(BOX(1.35, 1.45, 0.06), 0xf4f4f4, hx, y, hz + s2 * (d / 2 + 0.03)); addStatic(BOX(1.15, 1.25, 0.08), 0x2b3d52, hx, y, hz + s2 * (d / 2 + 0.04)); }
    }
    addStatic(BOX(0.08, 2.15, 1.05), pk([0x6b4226, 0x2b4a6b, 0x3a3e45, 0x7a1f2b]), fx, SIDE_H + 1.07, hz + d / 4);   // drzwi
    addStatic(BOX(1.6, 0.12, 1.6), 0x9b9a96, fx + sx * 0.75, SIDE_H + 0.06, hz + d / 4);                          // schodek
    // podjazd z kostki do ulicy + miejsce na auto
    const dz = hz - d / 4 - 1.2, dLen = Math.abs(streetX - (hx + sx * w / 2));
    addStatic(BOX(dLen, 0.05, 3.2), 0xa7a196, (streetX + hx + sx * w / 2) / 2, SIDE_H + 0.03, dz);
    driveSpots.push([streetX - sx * 3.2, dz, sx < 0 ? -Math.PI / 2 : Math.PI / 2]);
    // ogrodzenie od ulicy (z przerwą na podjazd i furtkę): żywopłot albo biały płotek
    const hedge = rnd() < 0.55, fc = hedge ? pk([0x3f6b35, 0x4a7a3c, 0x365f2e]) : 0xeeeeee;
    const fh = hedge ? 1.15 : 0.95, ft = hedge ? 0.7 : 0.1, ex = streetX - sx * 0.5;
    const segs = [[Z0 + 0.3, dz - 1.8], [dz + 1.8, hz + d / 4 - 0.8], [hz + d / 4 + 0.8, Z0 + L - 0.3]];
    for (const [a, b] of segs) {
      if (b - a < 0.4) continue;
      addStatic(BOX(ft, fh, b - a), fc, ex, SIDE_H + fh / 2, (a + b) / 2);
      addCol(ex - ft / 2 - 0.1, ex + ft / 2 + 0.1, a, b, fh);
    }
    // ogród: drzewa za domem, czasem drewniana szopa
    for (let t = 0; t < 2; t++) treeSpots.push([streetX - sx * r2(19.5, 23), Z0 + (t ? r2(21, 23.5) : r2(1.5, 5)), r2(0.75, 1.15)]);
    if (rnd() < 0.3) {
      const shx = X0 + L / 2 - sx * 9.5, shz = Z0 + r2(15, 20);
      addStatic(BOX(2.4, 2.1, 2.4), 0x8a5a33, shx, SIDE_H + 1.05, shz);
      addStatic(roofPrism(), 0x5a5f66, shx, SIDE_H + 2.1, shz, 0, 2.9, 0.8, 2.9);
      addCol(shx - 1.2, shx + 1.2, shz - 1.2, shz + 1.2, 2.9);
    }
  }
}

// Staw w lesie na wschód od miasta (tylko Grammar City — mapy z danych mają własne wody).
const LAKE = { x: HALF + 40, z: -70, r: 19 };
function buildLake() {
  const shore = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 2.6, 40), new StdMat({ color: 0xcdb48a }));
  shore.rotation.x = -Math.PI / 2; shore.position.set(LAKE.x, 0.012, LAKE.z); shore.receiveShadow = true; scene.add(shore);
  const wm = new StdMat({ color: 0x3f8fc9 }); wm.userData.water = true;
  const water = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 40), wm);
  water.rotation.x = -Math.PI / 2; water.position.set(LAKE.x, 0.03, LAKE.z); scene.add(water);
  const ring = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; ring.push(LAKE.x + Math.cos(a) * (LAKE.r - 0.8), LAKE.z + Math.sin(a) * (LAKE.r - 0.8)); }
  addPolyCol([ring], 0.4);
  // trzciny
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2, rr2 = LAKE.r - rr(0.2, 1.2);
    addStatic(new THREE.CylinderGeometry(0.03, 0.05, 1.4, 4), 0x6d7f3a, LAKE.x + Math.cos(a) * rr2, 0.7, LAKE.z + Math.sin(a) * rr2);
  }
  // las wokół stawu (grzyby jesienią)
  for (let i = 0; i < 140; i++) {
    const a = rand() * Math.PI * 2, d = LAKE.r + rr(5, 48), x = LAKE.x + Math.cos(a) * d, z = LAKE.z + Math.sin(a) * d;
    if ((Math.abs(x) < HALF + 8 && Math.abs(z) < HALF + 8) || x > BOUND - 2) continue;
    treeSpots.push([x, z, rr(1, 1.7)]);
  }
  for (const a of [0.4, 1.9, 3.5, 5.0]) fishSpots.push({ x: LAKE.x + Math.cos(a) * (LAKE.r + 1.3), z: LAKE.z + Math.sin(a) * (LAKE.r + 1.3), wx: LAKE.x, wz: LAKE.z });
}

const bldParts = [];   // {g, x, y, z, f: rodzaj elewacji (FAC_MATS), tint}
// Scala bryły budynków: ściany w grupach wg rodzaju elewacji (odcień w kolorze wierzchołków), dachy w ostatniej grupie.
function mergeBuildings(parts) {
  const NG = FAC_MATS.length, G = Array.from({ length: NG + 1 }, () => ({ p: [], n: [], u: [], c: [] })), col = new THREE.Color();
  for (const { g, x, y = 0, z, f: fi = 0, tint = 0xffffff } of parts) {
    const ng = g.toNonIndexed(), P = ng.attributes.position.array, Nn = ng.attributes.normal.array, U = ng.attributes.uv.array;
    col.set(tint);
    for (let f = 0; f < 6; f++) {
      const dst = f === 2 || f === 3 ? G[NG] : G[fi];
      for (let v = f * 6; v < f * 6 + 6; v++) {
        dst.p.push(P[v * 3] + x, P[v * 3 + 1] + y, P[v * 3 + 2] + z);
        dst.n.push(Nn[v * 3], Nn[v * 3 + 1], Nn[v * 3 + 2]);
        dst.u.push(U[v * 2], U[v * 2 + 1]);
        dst.c.push(col.r, col.g, col.b);
      }
    }
    ng.dispose(); g.dispose();
  }
  const out = new THREE.BufferGeometry(), all = { p: [], n: [], u: [], c: [] };
  let off = 0;
  G.forEach((gr, mi) => {
    const n = gr.p.length / 3; if (!n) return;
    for (const k of ['p', 'n', 'u', 'c']) for (const v of gr[k]) all[k].push(v);
    out.addGroup(off, n, mi); off += n;
  });
  out.setAttribute('position', new THREE.Float32BufferAttribute(all.p, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(all.n, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(all.u, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(all.c, 3));
  out.computeBoundingSphere();
  return out;
}

function buildNormalBuilding(X0, Z0) {
  const w = L - rr(1, 6), d = L - rr(1, 6);
  const cx = X0 + L / 2 + rr(-1, 1) * (L - w) / 2, cz = Z0 + L / 2 + rr(-1, 1) * (L - d) / 2;
  const dc = Math.hypot(cx, cz) / HALF0;
  const shop = rand() < 0.14;
  const h = shop ? rr(6, 9) : rr(8, 17) + Math.max(0, 1 - dc) * rr(8, 58);
  const wc = WALL_CHOICES[Math.floor(rand() * WALL_CHOICES.length)], GF = 4.5, office = wc.f === 0;
  bldParts.push({ g: buildingGeo(w + 0.12, GF, d + 0.12), x: cx, z: cz, f: office ? LOBBY_F : SHOP_F });
  bldParts.push({ g: buildingGeo(w, h - GF, d), x: cx, y: GF, z: cz, f: wc.f, tint: wc.tint });
  addCol(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h);
  if (!office) {        // szyldy sklepów po angielsku nad witrynami — od strony ulic (narożnik kwartału)
    const ib = clamp(Math.floor((cx + HALF - R) / CELL), 0, N - 1), jb = clamp(Math.floor((cz + HALF - R) / CELL), 0, N - 1);
    const sx = cx > bc(ib) ? 1 : -1, sz = cz > bc(jb) ? 1 : -1;
    signQuads.push({ x: cx + sx * (w / 2 + 0.08), z: cz, ry: sx > 0 ? Math.PI / 2 : -Math.PI / 2, k: Math.floor(rand() * SHOP_NAMES.length) });
    if (rand() < 0.6) signQuads.push({ x: cx, z: cz + sz * (d / 2 + 0.08), ry: sz > 0 ? 0 : Math.PI, k: Math.floor(rand() * SHOP_NAMES.length) });
  }
  mapRects.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, c: h > 40 ? '#4a5568' : '#3c4656' });
  if (!shop && rand() < 0.45) addBox(w * 0.3, 2, d * 0.3, mat(0x8a8d93), cx + rr(-w, w) * 0.2, h + 1, cz + rr(-d, d) * 0.2);
  if (!shop && h > 45 && rand() < 0.6) addBox(0.3, 9, 0.3, mat(0x9aa0a8), cx, h + 4.5, cz);
  if (shop) addBox(w + 1, 0.35, d + 1, mat(pick([0xb23a48, 0x2f7d6d, 0x3565a8, 0xd18a1f])), cx, 3.6, cz);
}

// Szyldy sklepów (angielskie nazwy — przy okazji słówka): atlas 2 × 8 pól, jedna scalona siatka; nocą lekko świecą.
const SHOP_NAMES = [['BAKERY', '#8a4b24'], ['PHARMACY', '#1f8a4c'], ['CAFÉ', '#5a3a2a'], ['FLOWERS', '#c2457a'], ['BOOKSHOP', '#2b4a7a'], ['SUPERMARKET', '#c0392b'],
  ['TOY SHOP', '#e67e22'], ['PET SHOP', '#16a085'], ["BUTCHER'S", '#7a1f2b'], ['SHOE SHOP', '#34495e'], ["GREENGROCER'S", '#3f7a32'], ["HAIRDRESSER'S", '#8e44ad'],
  ['POST OFFICE', '#d4a017'], ['BANK', '#1e3799'], ['PIZZERIA', '#b23a48'], ['ICE CREAM', '#e84393']];
const signQuads = [];
function buildShopSigns() {
  const c = makeCanvas(1024, 512), g = c.getContext('2d');
  SHOP_NAMES.forEach(([name, bg], i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 64;
    g.fillStyle = bg; g.fillRect(x + 2, y + 2, 508, 60);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.strokeRect(x + 7, y + 7, 498, 50);
    g.fillStyle = '#fffaf0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs2 = 40; g.font = `700 ${fs2}px "Barlow Condensed", Arial, sans-serif`;
    while (g.measureText(name).width > 470 && fs2 > 20) { fs2 -= 2; g.font = `700 ${fs2}px "Barlow Condensed", Arial, sans-serif`; }
    g.fillText(name, x + 256, y + 34);
  });
  const tex = canvasTex(c, false);
  const pos = [], nor = [], uv = [], q = new THREE.Vector3();
  for (const sg of signQuads) {
    const u0 = (sg.k % 2) * 0.5, v1 = 1 - Math.floor(sg.k / 2) / 8, v0 = v1 - 1 / 8;
    const cs = Math.cos(sg.ry), sn = Math.sin(sg.ry), W = 4.6, H = 0.58, y0 = 3.62, y1 = y0 + H;
    // płaszczyzna zwrócona w +Z obrócona o ry: oś „w prawo” = (cos, 0, −sin), normalna = (sin, 0, cos)
    const rx = cs, rz = -sn;
    const corners = [[-W / 2, y0, u0, v0], [W / 2, y0, u0 + 0.5, v0], [W / 2, y1, u0 + 0.5, v1], [-W / 2, y1, u0, v1]];
    for (const idx of [0, 1, 2, 0, 2, 3]) {
      const [o, y, u, v] = corners[idx];
      pos.push(sg.x + rx * o, y, sg.z + rz * o); nor.push(sn, 0, cs); uv.push(u, v);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geom.computeBoundingSphere();
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.5 });
  winMats.push(m);
  const mesh = new THREE.Mesh(geom, m); mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
}
const MISSION_TINTS = [0xf0d7a8, 0xd2e4f2, 0xe8c9b8, 0xcfe0c4, 0xe4d2ec, 0xf5e2b8];
function buildMissionBuilding(m) {
  const X0 = m.lotX0, Z0 = m.lotZ0, sx = m.side;
  const x0 = sx < 0 ? X0 + 7 : X0 + 1, x1 = sx < 0 ? X0 + L - 1 : X0 + L - 7;
  const z0 = Z0 + 1, z1 = Z0 + L - 1;
  const w = x1 - x0, d = z1 - z0, h = 13 + m.tier * 3;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const color = TIERS[m.tier].color;
  const wall = wallMaterial(MISSIONS.indexOf(m) % 3, MISSION_TINTS[MISSIONS.indexOf(m) % MISSION_TINTS.length]);
  const mesh = new THREE.Mesh(buildingGeo(w, h, d), [wall, wall, roofMat, roofMat, wall, wall]);
  mesh.position.set(cx, 0, cz); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  addCol(x0, x1, z0, z1, h);
  mapRects.push({ x0, z0, x1, z1, c: '#5a4b2c' });
  const faceX = sx < 0 ? x0 : x1, ang = sx < 0 ? -Math.PI / 2 : Math.PI / 2;
  addBox(0.3, 3.4, 3.2, mat(0x2a2320), faceX + sx * 0.12, SIDE_H + 1.7, cz);
  addBox(2.2, 0.35, 9, new StdMat({ color: new THREE.Color(color) }), faceX + sx * 1.1, 4.4, cz);
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
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(inner, inner), grassMat(inner / 4, true));
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
    const water = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.1, 32), new StdMat({ color: 0x3f8fc9, transparent: true, opacity: 0.85 }));
    water.material.userData.water = true;
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

let treeCrowns = null, treeRnd = null;
const blossomTex = (() => {
  const c = makeCanvas(128, 128), x = c.getContext('2d');
  const cols = ['#f8bbd0', '#f48fb1', '#fce4ec', '#ffffff', '#f06292'];
  for (let i = 0; i < 150; i++) {
    const px = Math.random() * 128, py = Math.random() * 128, r = 2.2 + Math.random() * 2.6;
    x.fillStyle = cols[i % cols.length];
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; x.beginPath(); x.arc(px + Math.cos(a) * r * 0.6, py + Math.sin(a) * r * 0.6, r * 0.55, 0, Math.PI * 2); x.fill(); }   // kwiatek z 5 płatków
    x.fillStyle = '#ffe082'; x.beginPath(); x.arc(px, py, r * 0.3, 0, Math.PI * 2); x.fill();
  }
  const t = canvasTex(c, true); t.repeat.set(2, 2); return t;
})();
// Drzewa: korona z kilku nieregularnych brył (cieniowanie jaśniejsze u góry, plamki), pień z gałęziami.
// Kolor korony per drzewo (pory roku) mnożony przez cieniowanie wierzchołków.
const NZT = makeNoise(7);
function jitterGeo(g, amt) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (NZT(p.getX(i) * 3 + 10, p.getY(i) * 3 + p.getZ(i) * 2) - 0.5) * amt; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
  g.computeVertexNormals(); return g;
}
function vcolorize(g, fn) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(p.getX(i), p.getY(i), p.getZ(i), col); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
const IDENT = new THREE.Matrix4();
const CROWN_BLOBS = [[0, 0, 0, 1.0], [0.62, -0.25, 0.25, 0.72], [-0.55, -0.18, -0.3, 0.74], [0.1, 0.52, -0.12, 0.66], [-0.2, -0.3, 0.6, 0.62]];
function crownGeometry(detail) {
  const g = mergeColored(CROWN_BLOBS.map(([x, y, z, sc]) => ({ g: jitterGeo(new THREE.IcosahedronGeometry(sc, detail), detail ? 0.18 : 0.12).translate(x, y, z), m: IDENT, c: new THREE.Color(0xffffff) })));
  g.scale(1.9, 1.75, 1.9); g.translate(0, 4.3, 0);
  return vcolorize(g, (x, y, z, c) => { const t = clamp((y - 2.8) / 3.2, 0, 1); c.setRGB(0.55 + t * 0.45, 0.6 + t * 0.4, 0.5 + t * 0.35); c.multiplyScalar(0.85 + NZT(x * 1.7 + 3, z * 1.7 + y) * 0.25); });
}
function trunkGeometry() {
  const tr = new THREE.CylinderGeometry(0.14, 0.24, 3.4, 7).translate(0, 1.7, 0);
  const br1 = new THREE.CylinderGeometry(0.05, 0.09, 1.6, 5).rotateZ(-0.8).translate(0.35, 3.0, 0);
  const br2 = new THREE.CylinderGeometry(0.05, 0.09, 1.4, 5).rotateZ(0.8).rotateY(0.4).translate(-0.3, 3.2, 0.1);
  return mergeColored([tr, br1, br2].map(g => ({ g, m: IDENT, c: new THREE.Color(0xffffff) })));
}
// Drzewa w kaflach: korona szczegółowa do TREE_LOD_M od kamery, dalej prosta (5× mniej trójkątów, bez cienia).
const TREE_LOD_M = 130;
const treeChunks = [];
function buildTrees() {
  const trunkGeo = trunkGeometry(), hiGeo = crownGeometry(1), loGeo = crownGeometry(0);
  const trunkMat = new StdMat({ color: 0x5b4330, roughness: 0.95 }), crownMat = new StdMat({ color: 0xffffff, vertexColors: true, roughness: 0.85 });
  const blossomGeo = new THREE.IcosahedronGeometry(1.15, 1).scale(1.9, 1.75, 1.9).translate(0, 4.3, 0);
  const blossomMat = new StdMat({ map: blossomTex, alphaTest: 0.5, emissive: 0x3a1a26 });
  const d = new THREE.Object3D(), col = new THREE.Color(), greens = [0x4f8a3a, 0x3f7a32, 0x5d9a40, 0x6b8f2f, 0x2f6b3a];
  treeRnd = new Float32Array(treeSpots.length);
  const items = treeSpots.map((t, i) => ({ t, i }));
  for (const grp of groupByChunk(items, it => [it.t[0], it.t[1]])) {
    const n = grp.length, ch = { idx: grp.map(it => it.i), x: 0, z: 0 };
    ch.trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n); ch.hi = new THREE.InstancedMesh(hiGeo, crownMat, n);
    ch.lo = new THREE.InstancedMesh(loGeo, crownMat, n); ch.blossom = new THREE.InstancedMesh(blossomGeo, blossomMat, n);
    grp.forEach(({ t: [x, z, s], i }, k) => {
      d.position.set(x, groundAt(x, z), z); d.scale.set(s, s * rr(0.9, 1.12), s); d.rotation.set(0, rand() * 6, 0); d.updateMatrix();
      for (const m of [ch.trunks, ch.hi, ch.lo, ch.blossom]) m.setMatrixAt(k, d.matrix);
      treeRnd[i] = Math.random();
      col.setHex(pick(greens)); ch.hi.setColorAt(k, col); ch.lo.setColorAt(k, col);
      ch.x += x / n; ch.z += z / n;
      if (Math.abs(x) < BOUND + 5 && Math.abs(z) < BOUND + 5) addCol(x - 0.35 * s, x + 0.35 * s, z - 0.35 * s, z + 0.35 * s, 6);
    });
    for (const m of [ch.trunks, ch.hi, ch.lo, ch.blossom]) { m.computeBoundingSphere(); scene.add(m); }
    ch.trunks.castShadow = ch.hi.castShadow = true; ch.hi.receiveShadow = true; ch.lo.castShadow = false;
    ch.lo.visible = false; ch.blossom.visible = false;
    treeChunks.push(ch);
  }
  treeCrowns = treeChunks.length ? treeChunks : null;
}
let treeLodT = 0;
function updateTreeLOD(dt) {
  if ((treeLodT -= dt) > 0) return;
  treeLodT = 0.4;
  const cx = camera.position.x, cz = camera.position.z, spring = season() === 'spring';
  for (const ch of treeChunks) {
    const dd = Math.hypot(ch.x - cx, ch.z - cz) - CHUNK * 0.6, near = dd < TREE_LOD_M;
    ch.hi.visible = near; ch.lo.visible = !near; ch.blossom.visible = spring && near;
  }
}
// Latarnie uliczne: słup z podstawą, wysięgnik nad jezdnię, oprawa z kloszem świecącym nocą (bloom)
// i plamą światła na ziemi (addytywna „poświata” — bez kosztownych świateł punktowych).
const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd28a, emissiveIntensity: 0, roughness: 0.4 });
const glowPoolMat = new THREE.MeshBasicMaterial({ map: canvasTex(TX.glow, false), color: 0xffc77a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12 });
// kierunek wysięgnika: w stronę najbliższej jezdni (siatka Grammar City), na mapach z danych — losowo
function lampDir(x, z) {
  if (REALMAP) return rand() * Math.PI * 2;
  const iu = clamp(Math.floor((x + HALF - R) / CELL), 0, N - 1), iv = clamp(Math.floor((z + HALF - R) / CELL), 0, N - 1);
  const u = x - bx0(iu), v = z - bx0(iv), m = Math.min(u, B - u, v, B - v);
  return m === u ? -Math.PI / 2 : m === B - u ? Math.PI / 2 : m === v ? Math.PI : 0;
}
function buildLamps() {
  const pole = new THREE.CylinderGeometry(0.075, 0.13, 8, 8).translate(0, 4, 0);
  const base = new THREE.CylinderGeometry(0.2, 0.24, 0.6, 8).translate(0, 0.3, 0);
  const arm = new THREE.CylinderGeometry(0.045, 0.06, 1.9, 6).rotateX(Math.PI / 2 - 0.14).translate(0, 8.05, 0.85);
  const housing = new THREE.BoxGeometry(0.34, 0.16, 0.72).translate(0, 8.12, 1.9);
  const lens = new THREE.BoxGeometry(0.28, 0.05, 0.6).translate(0, 8.02, 1.9);
  const metal = mergeColored([pole, base, arm, housing].map(g => ({ g, m: IDENT, c: new THREE.Color(0xffffff) })));
  const postMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 }), poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const d = new THREE.Object3D(), p = new THREE.Object3D();
  for (const grp of groupByChunk(lampSpots, l => l)) {
    const posts = new THREE.InstancedMesh(metal, postMat, grp.length), heads = new THREE.InstancedMesh(lens, lampHeadMat, grp.length), pools = new THREE.InstancedMesh(poolGeo, glowPoolMat, grp.length);
    grp.forEach(([x, z], i) => {
      const ry = lampDir(x, z);
      d.position.set(x, PAVE_Y, z); d.rotation.set(0, ry, 0); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); heads.setMatrixAt(i, d.matrix);
      const lx = x + Math.sin(ry) * 1.9, lz = z + Math.cos(ry) * 1.9;
      p.position.set(lx, groundAt(lx, lz) + 0.05, lz); p.scale.set(11, 1, 11); p.updateMatrix(); pools.setMatrixAt(i, p.matrix);
      addCol(x - 0.18, x + 0.18, z - 0.18, z + 0.18, 7);
    });
    for (const m of [posts, heads, pools]) { m.computeBoundingSphere(); scene.add(m); }
    posts.castShadow = true;
  }
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
  neck: () => geo('neck', () => new THREE.CylinderGeometry(0.072, 0.088, 0.24, 14).translate(0, 0.12, 0)),
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
  // stawy (kolano, łokieć) i bark — kule zakrywają szczeliny przy zginaniu kończyn
  knee: () => geo('knee', () => new THREE.SphereGeometry(0.094, 12, 8)),
  elbow: () => geo('elbow', () => new THREE.SphereGeometry(0.068, 10, 8)),
  shoulder: () => geo('shoulder', () => new THREE.SphereGeometry(0.092, 12, 8).scale(1, 0.85, 1)),
  // zaokrąglone barki i kark (góra tułowia)
  shoulders: () => geo('shoulders', () => new THREE.SphereGeometry(0.288, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1.18, 0.26, 0.62)),
  pelvis: () => geo('pelvis', () => new THREE.CylinderGeometry(0.262, 0.25, 0.2, 16).scale(1.18, 1, 0.66)),
});

// ---------------------------------------------------------------- twarz i włosy
// Głowa rzeźbiona z kuli (współrzędne głowy: środek = 0, +y w górę, +z = twarz, promień HEAD_R): pełniejsza
// potylica, węższa żuchwa i zaokrąglona broda, kości policzkowe, oczodoły, łuk brwiowy. Elementy twarzy (oczy
// z tęczówką i powieką, nos z grzbietem i skrzydełkami, wargi, uszy z małżowiną, piegi) stoją na tej powierzchni.
// Włosy: czapka na skórze głowy + rozwichrzone pasma (stożki) rosnące od czubka, z grzywką na czoło.
const HEAD_R = 0.2;
const gauss = (ax, ay, az, bx, by, bz, sg) => { const dx = ax - bx, dy = ay - by, dz = az - bz; return Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * sg * sg)); };
function headShape(x, y, z, out = new THREE.Vector3()) {
  const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
  let X = x * 0.9, Y = y * 1.08, Z = z;
  const low = smoothstep(0.05, -0.9, y);                       // 0 nad linią oczu → 1 przy brodzie
  X *= 1 - 0.15 * low * low - 0.05 * low;                                   // żuchwa zwęża się do brody
  if (Z < 0) Z *= 1 + 0.1 * smoothstep(-0.5, 0.4, y) - 0.6 * low;   // potylica pełniejsza, pod nią szyja
  else if (Z > 0.55) Z = 0.55 + (Z - 0.55) * 0.72;             // spłaszczona twarz
  let d = 0.035 * gauss(x, y, z, 0, -0.8, 0.58, 0.2)           // broda lekko do przodu
    + 0.06 * (gauss(x, y, z, 0.5, -0.35, 0.72, 0.25) + gauss(x, y, z, -0.5, -0.35, 0.72, 0.25))   // pełne policzki
    - 0.03 * (gauss(x, y, z, 0.36, 0.03, 0.93, 0.1) + gauss(x, y, z, -0.36, 0.03, 0.93, 0.1))      // oczodoły
    + 0.02 * (gauss(x, y, z, 0.3, 0.22, 0.93, 0.13) + gauss(x, y, z, -0.3, 0.22, 0.93, 0.13))        // łuk brwiowy
    + (z > 0 ? 0.095 * Math.exp(-x * x / 0.0045) * smoothstep(0.12, -0.05, y) * smoothstep(-0.42, -0.3, y) : 0)   // grzbiet nosa
    + 0.1 * gauss(x, y, z, 0, -0.34, 0.94, 0.075)                                                     // czubek nosa
    + 0.03 * (gauss(x, y, z, 0.1, -0.37, 0.93, 0.05) + gauss(x, y, z, -0.1, -0.37, 0.93, 0.05));     // skrzydełka nosa
  return out.set(X, Y, Z).multiplyScalar(HEAD_R * (1 + d));
}
const surf = (x, y, z) => headShape(x, y, z);
const M4 = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
const SPH = (r, w = 10, h = 8) => geo('sph' + r + '_' + w + '_' + h, () => new THREE.SphereGeometry(r, w, h));
// kolor oczu i piegi z karnacji i włosów (stałe dla danego wyglądu)
function faceTraits(skin, hair) {
  const hsl = {}; new THREE.Color(skin).getHSL(hsl);
  const light = hsl.l > 0.66, i = HAIRS.indexOf(hair);
  return { eye: light ? [0x5f7a92, 0x6d7d5c, 0x6a4a2c, 0x56708c][(i < 0 ? 0 : i) % 4] : 0x3a2414,
    freckles: light && (hair === 0x8a4b24 || hair === 0x5a3a1e || hair === 0xc9a25a) };
}
function headGeo(skin, hair, lo = false) {
  const tr = faceTraits(skin, hair);
  return geo('head2_' + skin + '_' + hair + (lo ? '_lo' : ''), () => {
    const parts = [];
    const P = (g, m, c) => parts.push({ g, m, c: new THREE.Color(c) });
    // czaszka z odcieniem skóry: rumieńce na policzkach, cień pod żuchwą i w oczodołach
    const sk = lo ? new THREE.SphereGeometry(1, 20, 14) : new THREE.SphereGeometry(1, 44, 34), pa = sk.attributes.position, tint = new Float32Array(pa.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
      headShape(x, y, z, v); pa.setXYZ(i, v.x, v.y, v.z);
      const blush = 0.6 * (gauss(x, y, z, 0.5, -0.3, 0.8, 0.18) + gauss(x, y, z, -0.5, -0.3, 0.8, 0.18));
      const shade = 0.16 * smoothstep(-0.55, -0.95, y) * smoothstep(0.6, 0.0, z) + 0.08 * gauss(x, y, z, 0, -0.44, 0.92, 0.05) + 0.07 * (gauss(x, y, z, 0.36, 0.03, 0.93, 0.1) + gauss(x, y, z, -0.36, 0.03, 0.93, 0.1));
      tint[i * 3] = (1 + 0.05 * blush) * (1 - shade); tint[i * 3 + 1] = (1 - 0.09 * blush) * (1 - shade); tint[i * 3 + 2] = (1 - 0.09 * blush) * (1 - shade);
    }
    sk.setAttribute('color', new THREE.BufferAttribute(tint, 3)); sk.computeVertexNormals();
    P(sk, new THREE.Matrix4(), skin);
    const skC = new THREE.Color(skin), lip = skC.clone().lerp(new THREE.Color(0xc0665e), 0.3), dark = skC.clone().multiplyScalar(0.72);
    const brow = new THREE.Color(hair).lerp(skC, 0.2);
    for (const sd of [-1, 1]) {
      // oko: białko, tęczówka, źrenica, odblask; powieka górna (spokojne, lekko przymknięte oczy)
      const e = surf(sd * 0.34, 0.02, 0.94), ex = e.x, ey = e.y, ez = e.z - 0.022;
      P(SPH(0.027, lo ? 8 : 14, lo ? 6 : 10), M4(ex, ey, ez, 0, 0, 0, 1.15, 0.8, 1), 0xeeeae4);
      P(SPH(0.0175, lo ? 8 : 14, lo ? 6 : 10), M4(ex, ey - 0.001, ez + 0.0215, 0, 0, 0, 1, 1, 0.45), lo ? new THREE.Color(tr.eye).multiplyScalar(0.6) : tr.eye);
      if (!lo) {
      P(SPH(0.0075, 10, 8), M4(ex, ey - 0.001, ez + 0.0285, 0, 0, 0, 1, 1, 0.35), 0x0b0b0b);
      P(SPH(0.0024, 6, 4), M4(ex + 0.005, ey + 0.005, ez + 0.03), 0xffffff);
      P(geo('lid4', () => new THREE.SphereGeometry(0.0293, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.46)), M4(ex, ey + 0.001, ez, 0.82, 0, 0, 1.15, 0.85, 1), skin);
      P(geo('lash', () => new THREE.TorusGeometry(0.0285, 0.0022, 4, 14, Math.PI)), M4(ex, ey - 0.001, ez + 0.016, -0.7, 0, 0, 1.12, 0.55, 1), new THREE.Color(hair).lerp(new THREE.Color(0x150d08), 0.6));
      P(geo('lidLow4', () => new THREE.SphereGeometry(0.0288, 14, 5, 0, Math.PI * 2, Math.PI * 0.7, Math.PI * 0.3)), M4(ex, ey, ez, -0.62, 0, 0, 1.15, 0.8, 1), skin);
      }
      // brew: lekko łukowata, z dwóch części
      const b = surf(sd * 0.36, 0.25, 0.92);
      P(SPH(1, 10, 6), M4(b.x - sd * 0.01, b.y + 0.001, b.z + 0.001, 0, sd * 0.25, sd * 0.05, 0.027, 0.0055, 0.006), brow);
      if (!lo) P(SPH(1, 10, 6), M4(b.x + sd * 0.02, b.y - 0.002, b.z - 0.006, 0, sd * 0.6, -sd * 0.18, 0.022, 0.0048, 0.005), brow);
      // ucho: małżowina (zewnętrzna obręcz + jaśniejsze wnętrze), płatek
      const u = surf(sd, -0.04, -0.08);
      P(SPH(1, lo ? 8 : 12, lo ? 6 : 10), M4(u.x + sd * 0.004, u.y + 0.006, u.z - 0.004, 0, sd * 0.25, sd * 0.12, 0.014, 0.056, 0.036), skin);
      if (!lo) P(SPH(1, 10, 8), M4(u.x + sd * 0.012, u.y + 0.008, u.z + 0.002, 0, sd * 0.25, 0, 0.007, 0.034, 0.021), skC.clone().multiplyScalar(0.84));
      if (!lo) P(SPH(1, 8, 6), M4(u.x + sd * 0.007, u.y - 0.04, u.z + 0.004, 0, 0, 0, 0.01, 0.014, 0.012), skin);
      // skrzydełko nosa
    }
    // nos: grzbiet od nasady do czubka + czubek + dziurki
    const nt = surf(0, -0.385, 0.93);
    if (!lo) for (const sd of [-1, 1]) P(SPH(1, 8, 6), M4(sd * 0.008, nt.y, nt.z - 0.004, 0, 0, 0, 0.0045, 0.0022, 0.004), dark.clone().multiplyScalar(0.7));
    // usta: warga górna i dolna, kącik ust
    const up = surf(0, -0.53, 1), dn = surf(0, -0.61, 1);
    P(SPH(1, lo ? 8 : 14, lo ? 5 : 8), M4(up.x, up.y, up.z - 0.003, 0, 0, 0, 0.03, 0.008, 0.011), lip);
    P(SPH(1, lo ? 8 : 14, lo ? 5 : 8), M4(dn.x, dn.y, dn.z - 0.003, 0, 0, 0, 0.026, 0.01, 0.012), lip.clone().multiplyScalar(1.04));
    if (!lo) P(BOX(0.046, 0.0025, 0.006), M4(0, (up.y + dn.y) / 2 + 0.002, (up.z + dn.z) / 2 + 0.004), lip.clone().multiplyScalar(0.6));
    // piegi na nosie i policzkach
    if (tr.freckles && !lo) {
      const rnd = mulberry(skin ^ hair);
      for (let i = 0; i < 26; i++) {
        const sd = i % 2 ? 1 : -1, p = surf(sd * (0.12 + rnd() * 0.42), -0.12 - rnd() * 0.3, 0.95);
        P(SPH(0.0024, 6, 4), M4(p.x, p.y, p.z - 0.0012, 0, 0, 0, 1, 1, 0.5), skC.clone().lerp(new THREE.Color(0x8a4a2a), 0.32));
      }
    }
    return mergeColored(parts);
  });
}
// Włosy: mode 'none' (pełna fryzura) | 'hat' (czapka/kapelusz/korona — tylko boki i tył) | 'beanie' (tylko kark)
function hairGeo(style, mode, lo = false) {
  return geo('hair2_' + style + '_' + mode + (lo ? '_lo' : ''), () => {
    const earZ = d => Math.exp(-((Math.abs(d.x) - 0.95) ** 2 + (d.y + 0.02) ** 2 + (d.z + 0.08) ** 2) / 0.09);
    const scalp = d => d.y > 0.38 * d.z - 0.02 + 0.3 * earZ(d);   // linia włosów: wysoko na czole, nisko na karku, nad uszami
    const pos = [], nor = [], col = [];
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const push = (g, m, t) => {
      const gg = (g.index ? g.toNonIndexed() : g.clone()); gg.applyMatrix4(m);
      const a = gg.attributes.position.array, b = gg.attributes.normal.array;
      for (let i = 0; i < a.length; i++) { pos.push(a[i]); nor.push(b[i]); }
      for (let i = 0; i < a.length / 3; i++) { const k = t.length === 3 ? t : t(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); col.push(k[0], k[1], k[2]); }
      gg.dispose();
    };
    // czapka włosów na skórze głowy (bez twarzy), lekko ponad skórą
    if (mode !== 'beanie') {
      const cap = new THREE.SphereGeometry(1, lo ? 14 : 24, lo ? 10 : 16).toNonIndexed(), a = cap.attributes.position;
      const keep = [];
      for (let t = 0; t < a.count; t += 3) {
        const cx = (a.getX(t) + a.getX(t + 1) + a.getX(t + 2)) / 3, cy = (a.getY(t) + a.getY(t + 1) + a.getY(t + 2)) / 3, cz = (a.getZ(t) + a.getZ(t + 1) + a.getZ(t + 2)) / 3;
        if (scalp({ x: cx, y: cy, z: cz })) for (let k = 0; k < 3; k++) { headShape(a.getX(t + k), a.getY(t + k), a.getZ(t + k), v); keep.push(v.x * 1.045, v.y * 1.045, v.z * 1.045); }
      }
      const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); cg.computeVertexNormals();
      push(cg, new THREE.Matrix4(), (x, y) => { const k = 0.88 + 0.12 * smoothstep(-0.15, 0.2, y / HEAD_R); return [k, k, k]; });
      cap.dispose();
    }
    // pasma: stożki rosnące od czubka (wir z tyłu u góry), opadające pod własnym ciężarem; grzywka na czoło
    const rnd = mulberry(4242 + style.length * 31 + mode.length * 7);
    const N = Math.round((style === 'bun' ? 40 : style === 'long' ? 110 : 100) * (lo ? 0.35 : 1)), crown = new THREE.Vector3(0, 0.82, -0.57).normalize();
    const tuft = (r, h) => geo('tuft' + r + '_' + h, () => new THREE.ConeGeometry(r, h, 5, 1, true).translate(0, h / 2, 0));
    let made = 0;
    for (let tries = 0; made < N && tries < 4000; tries++) {
      const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); if (d.lengthSq() > 1 || d.lengthSq() < 0.05) continue; d.normalize();
      if (!scalp(d)) continue;
      if (mode === 'hat' && (d.y > 0.12 || d.z > 0.45)) continue;
      if (mode === 'beanie' && (d.y > -0.22 || d.z > 0.3)) continue;
      made++;
      headShape(d.x, d.y, d.z, v); const root = v.clone().multiplyScalar(1.04);
      n.copy(d);
      const fringe = d.z > 0.35 && d.y > 0.2;
      // kierunek: od czubka po powierzchni + grawitacja; grzywka do przodu i w dół na czoło
      const flow = d.clone().sub(crown.clone().multiplyScalar(d.dot(crown))).normalize();
      if (!isFinite(flow.x)) flow.set(0, 0, 1);
      const grav = style === 'long' ? 0.9 : style === 'bun' ? 0.15 : 0.55;
      flow.add(new THREE.Vector3(0, -grav * (1 - Math.max(0, d.y) * 0.6), 0));
      if (fringe) flow.set(rnd() * 0.5 - 0.25, -0.9, 0.55);
      const nn = v.clone().normalize();                                   // przybliżona normalna skóry
      flow.normalize(); flow.sub(nn.clone().multiplyScalar(flow.dot(nn))).normalize();   // styczny do głowy
      const axis = flow.clone().add(nn.clone().multiplyScalar(style === 'bun' ? 0.02 : 0.1 + rnd() * 0.12)).normalize();
      let L = style === 'bun' ? 0.05 + rnd() * 0.03 : (0.075 + rnd() * 0.06) * (style === 'long' && d.y < 0.3 ? 2 : 1);
      if (fringe) L = Math.min(L, Math.max(0.04, (root.y - 0.06) / Math.max(0.3, -axis.y)));
      if (style !== 'long' && (earZ(d) > 0.25 || d.y < -0.1)) L *= 0.55;   // nad uszami i na karku krótko
      const r = style === 'bun' ? 0.04 : 0.036 + rnd() * 0.02;
      const zA = nn.clone().sub(axis.clone().multiplyScalar(nn.dot(axis))).normalize(), xA = new THREE.Vector3().crossVectors(axis, zA);
      const m = new THREE.Matrix4().makeBasis(xA, axis, zA).scale(new THREE.Vector3(1, L / 0.12, 0.32)).setPosition(root.clone().sub(axis.clone().multiplyScalar(0.012)));
      const k = 0.82 + rnd() * 0.3 + (d.y > 0.5 ? 0.08 : 0);
      push(tuft(Math.round(r * 1000) / 1000, 0.12), m, [k, k * 0.98, k * 0.95]);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  });
}
// czapki dopasowane do kształtu głowy: kopuła (górna połowa głowy, powiększona), przechylona tak, by z przodu
// kończyła się nad brwiami, a z tyłu niżej na potylicy; czapka zimowa — wyższa
const headDome = (key, sc, sy, tilt) => geo(key, () => {
  const g = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), a = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < a.count; i++) { headShape(a.getX(i), a.getY(i), a.getZ(i), v); a.setXYZ(i, v.x * sc, v.y * sc * sy, v.z * sc); }
  g.rotateX(tilt); g.computeVertexNormals(); return g;
});
PG.capDome = () => headDome('capDome2', 1.1, 1, -0.2);
PG.beanie2 = () => headDome('beanie2', 1.12, 1.12, -0.3);
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
const PERSON_LOD_M = 18;
function makePerson(o) {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const hs = o.hairStyle || 'short', hat = o.hat || (o.cap ? 'cap' : 'none'), hatC = o.hatColor != null ? o.hatColor : o.hair;
  const shoes = o.shoes != null ? o.shoes : 0x1c1c1c;
  const body = [[PG.torso, 0, 0.98, 0, o.shirt], [PG.shoulders, 0, 1.70, 0, o.jacket != null ? o.jacket : o.shirt], [PG.neck, 0, 1.68, 0, o.skin], Object.assign([() => headGeo(o.skin, o.hair), 0, 1.98, 0, 0xffffff], { lo: () => headGeo(o.skin, o.hair, true) }), [PG.belt, 0, 0.99, 0, 0x2a2420],
    [PG.pelvis, 0, 0.92, 0, o.skirt ? o.shirt : o.pants]];
  if (o.jacket != null) body.push([PG.jacket, 0, 0.98, 0, o.jacket], [PG.shirtFront, 0, 1.36, 0.205, o.shirt]);
  if (o.skirt) body.push([PG.skirt, 0, 0.78, 0, o.pants]);
  // włosy (twarz jest w headGeo)
  const hairMode = hat === 'beanie' ? 'beanie' : hat === 'none' ? 'none' : 'hat';
  if (hs !== 'bald') body.push(Object.assign([() => hairGeo(hs, hairMode), 0, 1.98, 0, o.hair], { lo: () => hairGeo(hs, hairMode, true) }));
  if (hs === 'long') body.push([PG.hairLong, 0, 1.8, -0.02, o.hair]);
  if (hs === 'bun') body.push([PG.bun, 0, 2.17, -0.14, o.hair]);
  // nakrycie głowy
  if (hat === 'cap') body.push([PG.capDome, 0, 2.0, 0, hatC], [PG.brim, 0, 2.075, 0.27, hatC]);
  else if (hat === 'beanie') body.push([PG.beanie2, 0, 2.01, 0, hatC]);
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
  const add = (geom, parent) => { const m = new THREE.Mesh(geom, personMat); m.castShadow = !!o.shadow; parent.add(m); return m; };
  const key = [o.shirt, o.skin, o.hair, o.pants, hs, hat, hatC, o.glasses || 'none', o.jacket, !!o.skirt].join('_');
  // rig: całe ciało (pozycję i obrót ustawia się na g) — kołysanie w pionie i pochylenie przy biegu
  const rig = new THREE.Group(); g.add(rig);
  // pełna twarz z bliska, uproszczona od PERSON_LOD_M metrów (THREE.LOD przełącza wg odległości od kamery)
  const lod = new THREE.LOD(); rig.add(lod);
  lod.addLevel(add(coloredGeo('pb' + key, body), lod), 0);
  lod.addLevel(add(coloredGeo('pbl' + key, body.map(e => (e.lo ? [e.lo, ...e.slice(1)] : e))), lod), PERSON_LOD_M);
  // kończyna z dwóch członów: staw górny (bark/biodro) → człon górny + staw środkowy (łokieć/kolano) → człon dolny
  const limb = (upG, lowG, px, py, jy) => {
    const top = new THREE.Group(); top.position.set(px, py, 0); add(upG, top); rig.add(top);
    const mid = new THREE.Group(); mid.position.set(0, jy, 0); add(lowG, mid); top.add(mid);
    return [top, mid];
  };
  const sleeve = o.jacket != null ? o.jacket : o.shirt;
  const longSleeve = o.sleeves === 'long' || o.jacket != null;
  const foreC = longSleeve ? sleeve : o.skin;
  const upArmG = coloredGeo(`pu${sleeve}`, [[PG.shoulder, 0, -0.06, 0, sleeve], [PG.upperArm, 0, 0, 0, sleeve]]);
  const loArmG = coloredGeo(`pf${foreC}_${o.skin}`, [[PG.elbow, 0, 0, 0, foreC], [PG.foreArm, 0, 0, 0, foreC], [PG.hand, 0, -0.39, 0, o.skin]]);
  const legTop = o.skirt ? o.skin : o.pants;
  const thighG = coloredGeo(`pt${legTop}`, [[PG.thigh, 0, 0, 0, legTop]]);
  const shinG = coloredGeo(`ps${legTop}_${shoes}`, [[PG.knee, 0, 0, 0, legTop], [PG.shin, 0, 0, 0, legTop],
    [PG.shoe, 0, -0.45, 0.05, shoes], [PG.sole, 0, -0.52, 0.05, 0xeeeeee]]);
  const [la, lf] = limb(upArmG, loArmG, -0.4, 1.68, -0.33), [ra, rf] = limb(upArmG, loArmG, 0.4, 1.68, -0.33);
  const [ll, lk] = limb(thighG, shinG, -0.16, 1.0, -0.48), [rl, rk] = limb(thighG, shinG, 0.16, 1.0, -0.48);
  return { g, rig, la, ra, ll, rl, lf, rf, lk, rk, phase: Math.random() * 6, idle: Math.random() * 6 };
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
// Chód i bieg. Wzorzec ruchu nóg (biodro wahadłowo, kolano zgina się przy przenoszeniu nogi — najmocniej tuż po
// oderwaniu stopy, prostuje się przed postawieniem pięty), a noga podporowa jest dociskana do ziemi odwrotną
// kinematyką (IK dwuczłonowe: udo + łydka) — stopa nie wchodzi pod ziemię i nie wisi w powietrzu, a ciało porusza
// się w pionie po łagodnej sinusoidzie (chód ~3 cm, bieg ~4 cm; w biegu najniżej w połowie podporu).
// Ręce w przeciwfazie do nóg z ugiętym łokciem (w biegu ~90°). Kąty: rotation.x > 0 = kończyna do tyłu,
// kolano > 0 = łydka do tyłu, łokieć < 0 = przedramię do przodu. Pozy wygładzane w czasie (bez szarpnięć).
const THIGH_L = 0.48, SHIN_L = 0.52;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function resetPose(p) {
  for (const j of [p.la, p.ra, p.ll, p.rl, p.lf, p.rf, p.lk, p.rk]) j.rotation.set(0, 0, 0);
  p.rig.position.set(0, 0, 0); p.rig.rotation.set(0, 0, 0);
  p.mvS = p.runS = p.airS = 0;
}
function animPerson(p, speed, dt, air) {
  p.idle += dt;
  // płynne przejścia: stanie ↔ chód ↔ bieg ↔ skok
  const kS = dt > 0 ? Math.min(1, dt * 8) : 1;
  p.mvS = lerp(p.mvS || 0, Math.min(1, speed / 3), kS);
  p.runS = lerp(p.runS || 0, clamp((speed - 5.8) / 3.5, 0, 1), kS);
  p.airS = lerp(p.airS || 0, air ? 1 : 0, dt > 0 ? Math.min(1, dt * 14) : 1);
  const mv = p.mvS, run = p.runS, ai = p.airS;
  if (speed > 0.1 && !air) p.phase += dt * (2.6 + speed * 1.0);
  const A = mv * (0.38 + 0.12 * run), K = mv * (0.8 + 0.8 * run), lag = 0.35 + 0.25 * run;
  const lean = run * mv * 0.16 + mv * 0.03, c2 = Math.cos(2 * p.phase);
  const y = mv * ((-0.035 + 0.015 * c2) * (1 - run) + (-0.05 - 0.022 * c2) * run);
  const H = y + Math.cos(lean), bias = 0.3 - 0.5 * run;
  const AIR = [[-0.75, 1.25], [0.25, 0.55]];
  [[p.ll, p.lk, p.phase], [p.rl, p.rk, p.phase + Math.PI]].forEach(([hip, knee, ph], i) => {
    const c = Math.cos(ph);
    let h = -A * Math.sin(ph) - 0.05 * run * mv;
    let k = K * Math.pow(Math.max(0, Math.cos(ph + lag)), 1.6) + 0.05 * mv;
    if (mv > 0.01) {
      const hw = h + lean, fz = -THIGH_L * Math.sin(hw) - SHIN_L * Math.sin(hw + k), fy = -THIGH_L * Math.cos(hw) - SHIN_L * Math.cos(hw + k);
      const w = smoothstep(-0.3, 0.3, bias - c) * mv, footH = H + fy;
      const ty = fy - (w * footH + (1 - w) * Math.min(0, footH));   // podpór: stopa na ziemi; przenoszenie: nie pod ziemią
      const d = Math.min(THIGH_L + SHIN_L - 1e-4, Math.hypot(fz, ty));
      k = Math.acos(clamp((d * d - THIGH_L * THIGH_L - SHIN_L * SHIN_L) / (2 * THIGH_L * SHIN_L), -1, 1));
      h = Math.atan2(-fz, -ty) - Math.atan2(SHIN_L * Math.sin(k), THIGH_L + SHIN_L * Math.cos(k)) - lean;
    }
    hip.rotation.set(lerp(h, AIR[i][0], ai), 0, 0); knee.rotation.x = lerp(k, AIR[i][1], ai);
  });
  const breath = Math.sin(p.idle * 1.7) * 0.025 * (1 - mv);
  const AIRA = [[0.45, -0.18, -0.5], [-1.2, 0.18, -0.4]];
  [[p.la, p.lf, p.phase, -1], [p.ra, p.rf, p.phase + Math.PI, 1]].forEach(([sh, el, ph, sd], i) => {
    const sw = Math.sin(ph);
    const sx = mv * (0.32 + 0.4 * run) * sw + 0.06 * run * mv + breath, sz = sd * (0.07 + 0.06 * run * mv);
    const ex = -(0.1 + mv * (0.18 + 0.25 * Math.max(0, -sw)) + run * mv * 1.05);
    sh.rotation.set(lerp(sx, AIRA[i][0], ai), 0, lerp(sz, AIRA[i][1], ai)); el.rotation.x = lerp(ex, AIRA[i][2], ai);
  });
  p.rig.position.y = y * (1 - ai);
  p.rig.rotation.x = lerp(lean, 0.05, ai);
  p.rig.rotation.y = Math.sin(p.phase) * 0.05 * mv * (1 - ai);                   // skręt bioder w rytm kroków
  p.rig.rotation.z = Math.cos(p.phase) * 0.02 * mv * (1 - run * 0.5) * (1 - ai);  // przenoszenie ciężaru z nogi na nogę
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
  lux:      { acc: 17, max: 42, rev: 10, brake: 34, steer: 0.6, off: 1.4, rad: 1.12, exit: 2.4 },
  // klasyki z polskich ulic (nazwy potoczne, bez znaków towarowych) — wymiary 1:1, grip = przyczepność opon (m/s²)
  maluch:    { acc: 7, max: 30, rev: 7, brake: 26, steer: 0.78, off: 0.75, rad: 0.8, exit: 1.9, grip: 22 },
  kredens:   { acc: 10, max: 39, rev: 8, brake: 28, steer: 0.64, off: 1.15, rad: 0.96, exit: 2.2, grip: 24 },
  poldek:    { acc: 11, max: 42, rev: 8, brake: 28, steer: 0.64, off: 1.2, rad: 0.97, exit: 2.2, grip: 24 },
  pasek:     { acc: 14, max: 55, rev: 9, brake: 32, steer: 0.6, off: 1.3, rad: 1.0, exit: 2.3, grip: 29 },
  szwed:     { acc: 12, max: 48, rev: 9, brake: 30, steer: 0.57, off: 1.35, rad: 1.0, exit: 2.3, grip: 25 },
  okularnik: { acc: 16, max: 62, rev: 10, brake: 34, steer: 0.6, off: 1.35, rad: 1.05, exit: 2.4, grip: 30 },
  majestat:  { acc: 18, max: 69, rev: 10, brake: 34, steer: 0.52, off: 1.6, rad: 1.1, exit: 2.5, grip: 30 },
  plane:    { acc: 9, max: 70, rev: 0, brake: 10, steer: 0.5, off: 2.2, rad: 1.5, exit: 5.6, fly: true },
  moto:     { acc: 24, max: 48, rev: 3, brake: 38, steer: 1.0, off: 0.55, rad: 0.55, exit: 1.4, ride: 'moto', seatY: 0.92, seatZ: -0.2 },
  scooter:  { acc: 8, max: 12.5, rev: 2, brake: 22, steer: 1.25, off: 0.35, rad: 0.45, exit: 1.2, ride: 'scooter', seatY: 0.2, seatZ: -0.1 },
  // Startowa hulajnoga z modelu 3D (models/e-scooter.glb)
  // seatY = wysokość deski, seatZ = miejsce stóp na desce (ręce sięgają kierownicy)
  kscooter: { acc: 9, max: 13.5, rev: 2, brake: 22, steer: 1.2, off: 0.5, rad: 0.48, exit: 1.3, ride: 'scooter', seatY: 0.33, seatZ: 0.06 },
};
const specOf = type => VSPEC[type] || VSPEC.car;
const VNAME = { moto: 'motor', scooter: 'hulajnogę', kscooter: 'hulajnogę' };
const isTwoWheel = type => !!specOf(type).ride;

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
  // luksusowy sedan: długa maska, niska linia dachu, opadający tył
  lux: { len: 4.95, w: 1.98,
    lower: [[-2.47, 0.3], [2.47, 0.3], [2.53, 0.55], [2.42, 0.8], [1.12, 0.94], [-1.5, 0.97], [-2.32, 0.92], [-2.53, 0.62]],
    glass: [[1.12, 0.92], [0.22, 1.43], [-0.92, 1.44], [-1.82, 0.96]], roof: [0.17, -0.87, 1.43] },
  // Klasyki z polskich ulic — wymiary 1:1 (długość, szerokość, wysokość jak w prawdziwych autach).
  // wr = promień koła, wz = odległość osi od środka, tw = szerokość opony.
  maluch: { len: 3.05, w: 1.38, wr: 0.27, wz: 0.92, tw: 0.15,          // mały miejski klasyk z silnikiem z tyłu
    lower: [[-1.52, 0.24], [1.52, 0.24], [1.56, 0.4], [1.5, 0.62], [1.25, 0.72], [0.7, 0.76], [-1.1, 0.78], [-1.45, 0.7], [-1.56, 0.42]],
    glass: [[0.72, 0.74], [0.32, 1.3], [-0.78, 1.32], [-1.22, 0.76]], roof: [0.3, -0.8, 1.32] },
  kredens: { len: 4.22, w: 1.63, wr: 0.3, wz: 1.25, tw: 0.18,         // kanciasty sedan z lat 70., cztery okrągłe lampy
    lower: [[-2.11, 0.3], [2.11, 0.3], [2.15, 0.5], [2.12, 0.76], [1.0, 0.82], [-1.25, 0.84], [-2.08, 0.82], [-2.15, 0.5]],
    glass: [[1.0, 0.8], [0.45, 1.42], [-0.72, 1.43], [-1.28, 0.84]], roof: [0.43, -0.72, 1.43] },
  poldek: { len: 4.32, w: 1.65, wr: 0.3, wz: 1.25, tw: 0.18,          // liftback z lat 80., klinowy przód, opadający tył
    lower: [[-2.16, 0.3], [2.16, 0.3], [2.2, 0.5], [2.12, 0.72], [1.02, 0.86], [-1.95, 0.9], [-2.16, 0.84], [-2.2, 0.5]],
    glass: [[1.02, 0.84], [0.38, 1.37], [-0.55, 1.38], [-1.98, 0.9]], roof: [0.36, -0.6, 1.38] },
  pasek: { len: 4.67, w: 1.74, wr: 0.32, wz: 1.35, tw: 0.2,           // rodzinne kombi z lat 90.
    lower: [[-2.33, 0.32], [2.33, 0.32], [2.39, 0.55], [2.27, 0.82], [1.1, 0.98], [-2.22, 1.01], [-2.36, 0.88], [-2.4, 0.55]],
    glass: [[1.1, 0.96], [0.3, 1.46], [-1.95, 1.45], [-2.24, 1.01]], roof: [0.28, -1.98, 1.46] },
  szwed: { len: 4.79, w: 1.71, wr: 0.32, wz: 1.32, tw: 0.19,          // kanciaste szwedzkie kombi — „czołg"
    lower: [[-2.39, 0.32], [2.39, 0.32], [2.43, 0.56], [2.4, 0.86], [1.2, 0.93], [-2.36, 0.96], [-2.42, 0.56]],
    glass: [[1.2, 0.91], [0.72, 1.44], [-2.3, 1.44], [-2.36, 0.96]], roof: [0.7, -2.3, 1.44] },
  okularnik: { len: 4.8, w: 1.8, wr: 0.33, wz: 1.42, tw: 0.21,        // niemiecki sedan z podwójnymi owalnymi lampami
    lower: [[-2.4, 0.3], [2.4, 0.3], [2.47, 0.52], [2.36, 0.78], [1.16, 0.92], [-1.6, 0.96], [-2.33, 0.9], [-2.46, 0.58]],
    glass: [[1.16, 0.9], [0.3, 1.42], [-0.92, 1.43], [-1.72, 0.96]], roof: [0.28, -0.92, 1.43] },
  majestat: { len: 5.46, w: 1.92, wr: 0.37, wz: 1.7, tw: 0.24,        // długa, dwukolorowa limuzyna prestiżowa
    lower: [[-2.73, 0.3], [2.73, 0.3], [2.79, 0.55], [2.68, 0.84], [1.3, 0.98], [-1.95, 1.02], [-2.62, 0.95], [-2.79, 0.62]],
    glass: [[1.3, 0.96], [0.38, 1.49], [-1.3, 1.5], [-2.08, 1.02]], roof: [0.36, -1.3, 1.5],
    lowerTwo: [[-2.73, 0.3], [2.73, 0.3], [2.79, 0.55], [2.75, 0.66], [-2.77, 0.66], [-2.79, 0.62]] },
};
const TYPE_SHAPE = { sedan: 'sedan', taxi: 'sedan', police: 'sedan', hatch: 'hatch', suv: 'suv', van: 'van', sport: 'sport', supercar: 'supercar', lux: 'lux',
  maluch: 'maluch', kredens: 'kredens', poldek: 'poldek', pasek: 'pasek', szwed: 'szwed', okularnik: 'okularnik', majestat: 'majestat' };
const CLASSICS = ['maluch', 'kredens', 'poldek', 'pasek', 'szwed', 'okularnik', 'majestat'];
// Nazwy pojazdów na liczniku (auta z ruchu ulicznego też — po przejęciu).
const VEH_NAMES = { sedan: 'Sedan Comfort', taxi: 'Taksówka', police: 'Radiowóz', hatch: 'Hatchback City', suv: 'SUV Explorer', van: 'Van Cargo',
  sport: 'Sport GT', supercar: 'Supercar Fulmine', lux: 'Limuzyna Executive E', moto: 'Raptor 600', scooter: 'Volt K-Pro', kscooter: 'Pixel Rider', plane: 'Sky Hopper',
  maluch: 'Maluch', kredens: 'Kredens', poldek: 'Poldek', pasek: 'Pasek Kombi', szwed: 'Szwedzki Czołg', okularnik: 'Okularnik', majestat: 'Majestat' };
// Wymiary kół auta (osobne koła — obracają się i skręcają).
function carDims(type) {
  const S = CAR_SHAPES[TYPE_SHAPE[type] || 'sedan'];
  const wr = S.wr || (type === 'suv' || type === 'van' ? 0.42 : 0.37), tw = S.tw || 0.28;
  return { wr, tw, wz: S.wz || S.len / 2 - (type === 'supercar' ? 0.75 : 0.85), wx: S.w / 2 - (S.tw ? Math.max(0.08, tw * 0.45) : 0.12), len: S.len, w: S.w };
}
const isCar4 = t => !['plane', 'moto', 'scooter', 'kscooter'].includes(t);
const BOX = (w, h, d) => geo(`bx${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
const CYLX = (r, w, seg = 16) => geo(`cx${r}_${w}_${seg}`, () => new THREE.CylinderGeometry(r, r, w, seg).rotateZ(Math.PI / 2));
const CYLZ = (r, d, seg = 16) => geo(`cz${r}_${d}_${seg}`, () => new THREE.CylinderGeometry(r, r, d, seg).rotateX(Math.PI / 2));
// Koło: opona, bok opony, felga (styl wg auta), szprychy po zewnętrznej stronie (+X), piasta.
const WHEEL_STYLE = { maluch: 'cap', kredens: 'steel', poldek: 'steel', pasek: 'alloy', szwed: 'steel', okularnik: 'alloy', majestat: 'chrome', sport: 'dark', supercar: 'dark', lux: 'chrome' };
function wheelGeometry(r, w, style) {
  const parts = [], C = c => new THREE.Color(c);
  const put = (g, x, y, z, c, rx = 0, gl = 0.05) => parts.push({ g, m: new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, 0, 0)), _s.set(1, 1, 1)), c: C(c), gl });
  const rim = style === 'chrome' ? 0xe4e7eb : style === 'alloy' ? 0xc4c9d0 : style === 'dark' ? 0x2b2d31 : style === 'cap' ? 0xd7dbe0 : 0x8d939c;
  const rgl = style === 'chrome' || style === 'cap' ? 1 : style === 'alloy' ? 0.96 : style === 'dark' ? 0.6 : 0.45;
  put(CYLX(r, w, 24), 0, 0, 0, 0x151515);                       // opona
  put(CYLX(r * 0.8, w + 0.006, 22), 0, 0, 0, 0x202022);         // bok opony (ciemniejszy pierścień)
  put(CYLX(r * 0.62, w + 0.014, 20), 0, 0, 0, rim, 0, rgl);     // felga
  if (style === 'cap') put(CYLX(r * 0.42, w + 0.05, 16), 0, 0, 0, 0xeef0f3, 0, 1);   // chromowany kołpak
  else {
    const n = style === 'alloy' || style === 'chrome' ? 8 : 5, len = r * 0.48, sx = w / 2 + 0.01;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2;
      put(BOX(0.02, len, r * (n > 5 ? 0.07 : 0.11)), sx, Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33, style === 'steel' ? 0x6d737c : rim, a, rgl);
    }
    put(CYLX(r * 0.6, 0.012, 20), sx - 0.004, 0, 0, style === 'steel' ? 0x5d636b : 0x30333a, 0, 0.3);   // tło między szprychami
  }
  put(CYLX(r * 0.15, w + 0.06, 10), 0, 0, 0, 0x9aa1aa, 0, 0.97);   // piasta
  return mergeColored(parts);
}
// Połysk części auta wg koloru: lakier, chrom, szyby, lampy, reszta (guma, plastik) matowa.
const CAR_CHROME = new Set([0xdadee3, 0xdfe3e8, 0xe4e7eb, 0xc9ced6, 0xeef0f3, 0xd7dbe0, 0x9aa0a8, 0xf5f6f8]);
const CAR_LAMPS = new Set([0xfdf6d8, 0xdcebf7, 0xe0161b, 0xc8141c, 0xf0951a, 0xbfe6ff, 0xe8f4ff, 0xeaf6ff, 0xffe36b, 0xff2030, 0x2060ff, 0x9fb3c8]);
const carGloss = (c, paint) => c === paint ? 0.62 : CAR_CHROME.has(c) ? 1 : c === 0x16202b ? 0.9 : CAR_LAMPS.has(c) ? 0.86 : 0.14;
// split = karoseria bez kół (auto gracza: koła osobno, obracają się i skręcają)
function carGeometry(type, color, split) {
  const S = CAR_SHAPES[TYPE_SHAPE[type] || 'sedan'], L2 = S.len / 2, W = S.w;
  const parts = [];
  // Majestat: dwa kolory — góra w kolorze auta, dół kontrastowy (srebrny albo grafitowy)
  const lowC = type === 'majestat' ? (new THREE.Color(color).getHSL({}).l < 0.4 ? 0xc6cad0 : 0x1d2027) : null;
  const push = (g, x, y, z, c, ry, sx, sy, sz) => parts.push({ g, m: partMatrix(x, y, z, ry || 0, sx || 1, sy || 1, sz || 1), c: new THREE.Color(c), gl: c === lowC ? 0.62 : carGloss(c, color) });
  const classic = CLASSICS.includes(type);
  push(geo(`pl_${type}`, () => profileGeo(S.lower, W, 0.08)), 0, 0, 0, color);
  if (S.lowerTwo) push(geo(`pl2_${type}`, () => profileGeo(S.lowerTwo, W + 0.02, 0.08)), 0, 0, 0, lowC);
  push(geo(`pg_${type}`, () => profileGeo(S.glass, W * 0.86, 0.04)), 0, 0, 0, 0x16202b);
  const [rf, rb, ry] = S.roof;
  push(BOX(W * 0.84, 0.07, rf - rb), 0, ry + 0.02, (rf + rb) / 2, color);                  // dach
  push(BOX(W * 0.87, (ry - S.glass[0][1]) * 0.92, 0.12), 0, (S.glass[0][1] + ry) / 2, (rf + rb) / 2 + (classic ? 0.1 : 0.25), color); // słupek B
  const groundY = S.lower[0][1];
  if (classic) classicDetails(type, S, push, color);
  else {
  // zderzaki, grill, tablice
  push(BOX(W * 0.98, 0.2, 0.22), 0, groundY + 0.12, L2 + 0.04, 0x2a2d33);
  push(BOX(W * 0.98, 0.2, 0.22), 0, groundY + 0.12, -L2 - 0.04, 0x2a2d33);
  push(BOX(W * 0.42, 0.16, 0.06), 0, groundY + 0.34, L2 + 0.08, 0x111418);
  push(BOX(0.52, 0.13, 0.03), 0, groundY + 0.13, L2 + 0.17, 0xf2f2f2);
  push(BOX(0.52, 0.13, 0.03), 0, groundY + 0.3, -L2 - 0.1, 0xf5d000);
  }
  // światła
  const ly = groundY + 0.36;
  for (const s of [-1, 1]) {
    if (!classic) {
    push(BOX(0.42, 0.13, 0.06), s * W * 0.33, ly, L2 + 0.04, 0xfdf6d8);
    push(BOX(0.4, 0.04, 0.06), s * W * 0.33, ly + 0.1, L2 + 0.03, 0xbfe6ff);
    push(BOX(0.38, 0.13, 0.06), s * W * 0.34, ly + 0.08, -L2 - 0.03, 0xe0161b);
    }
    // lusterka
    push(BOX(0.22, 0.12, 0.1), s * (W / 2 + 0.08), S.glass[0][1] + 0.05, S.glass[0][0] - 0.15, color);
    push(BOX(0.04, 0.1, 0.09), s * (W / 2 + 0.19), S.glass[0][1] + 0.05, S.glass[0][0] - 0.15, 0x9fb3c8);
    // klamki i linia drzwi
    push(BOX(0.03, 0.04, 0.16), s * (W / 2 + 0.01), S.glass[0][1] - 0.18, 0.15, 0x9aa0a8);
    push(BOX(0.02, (S.glass[0][1] - groundY) * 0.85, 0.02), s * (W / 2 + 0.005), (groundY + S.glass[0][1]) / 2 + 0.05, (rf + rb) / 2 + (classic ? 0.1 : 0.25), 0x1b1e23);
  }
  // koła (w aucie gracza osobno — patrz makeCarMesh0); zewnętrzna strona felgi na zewnątrz auta
  if (!split) {
    const d = carDims(type), wg = geo(`wheel_${type}`, () => wheelGeometry(d.wr, d.tw, WHEEL_STYLE[type] || 'steel'));
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) push(wg, sx * d.wx, d.wr, sz * d.wz, 0xffffff, sx < 0 ? Math.PI : 0);
  }
  // dodatki wg typu
  const top = ry + 0.06;
  if (type === 'taxi') { push(BOX(0.8, 0.24, 0.3), 0, top + 0.14, (rf + rb) / 2, 0x222222); push(BOX(0.7, 0.16, 0.32), 0, top + 0.14, (rf + rb) / 2, 0xffe36b); }
  if (type === 'police') {
    push(BOX(0.5, 0.16, 0.28), -0.3, top + 0.1, (rf + rb) / 2, 0xff2030); push(BOX(0.5, 0.16, 0.28), 0.3, top + 0.1, (rf + rb) / 2, 0x2060ff);
    for (const s of [-1, 1]) push(BOX(0.02, 0.18, S.len * 0.7), s * (W / 2 + 0.01), groundY + 0.48, 0, 0x1e3a8a);
  }
  if (type === 'suv') for (const s of [-1, 1]) push(BOX(0.06, 0.06, (rf - rb) * 0.9), s * W * 0.36, top + 0.05, (rf + rb) / 2, 0x2a2d33);
  if (type === 'lux') {
    const chrome = 0xdfe3e8;
    push(BOX(W * 0.4, 0.3, 0.07), 0, groundY + 0.42, L2 + 0.1, chrome);                       // duży chromowany grill
    for (let k = 0; k < 3; k++) push(BOX(W * 0.36, 0.035, 0.03), 0, groundY + 0.33 + k * 0.09, L2 + 0.15, 0x1a1d22);
    push(BOX(0.07, 0.07, 0.03), 0, groundY + 0.42, L2 + 0.16, 0xf5f6f8);                     // emblemat (okrągły znaczek bez marki)
    for (const s of [-1, 1]) {
      push(BOX(0.025, 0.03, 2.75), s * (W / 2 + 0.005), S.glass[0][1] - 0.02, -0.35, chrome);  // chromowana listwa okien
      push(BOX(0.025, 0.05, 3.6), s * (W / 2 + 0.01), groundY + 0.2, 0, 0x2a2d33);            // progi
      push(BOX(0.46, 0.05, 0.05), s * W * 0.32, ly + 0.07, L2 + 0.05, 0xe8f4ff);              // LED do jazdy dziennej
      push(CYLX(0.055, 0.12, 10), s * W * 0.3, groundY + 0.06, -L2 - 0.08, 0xc9ced6);         // podwójne końcówki wydechu
    }
    push(BOX(W * 0.7, 0.03, 0.04), 0, ly + 0.14, -L2 - 0.02, 0xe0161b);                      // listwa świateł tylnych
  }
  if (type === 'supercar' || type === 'sport') {
    push(BOX(W * 0.9, 0.05, 0.32), 0, S.lower[6][1] + 0.22, -L2 + 0.25, 0x111111);           // spojler
    for (const s of [-1, 1]) push(BOX(0.06, 0.2, 0.06), s * W * 0.32, S.lower[6][1] + 0.1, -L2 + 0.25, 0x111111);
  }
  return mergeColored(parts);
}
// Detale klasyków: lampy, grille, zderzaki, listwy, tablice (polskie — biała z niebieskim paskiem).
// Kształty i proporcje jak w prawdziwych autach, nazwy i znaczki ogólne (bez znaków towarowych).
function classicDetails(type, S, push, color) {
  const L2 = S.len / 2, W = S.w, gY = S.lower[0][1], belt = S.glass[0][1];
  const CHR = 0xdadee3, BLK = 0x17191d, RUB = 0x25282d, LAMP = 0xfdf6d8, CLEAR = 0xdcebf7, TAIL = 0xc8141c, AMB = 0xf0951a;
  // Karoseria z profilu jest wysunięta o fazę (EB) poza punkty profilu — detale przyklejamy do prawdziwej
  // powierzchni przodu / tyłu na danej wysokości (F / R = środek części o grubości d, wystającej o d − out).
  const EB = 0.08;
  const edge = (y, sg) => {
    let b = null; const pr = S.lower;
    for (let i = 0; i < pr.length; i++) {
      const [x1, y1] = pr[i], [x2, y2] = pr[(i + 1) % pr.length];
      if (y1 === y2 || (y1 - y) * (y2 - y) > 0) continue;
      const x = x1 + (x2 - x1) * (y - y1) / (y2 - y1);
      if (b === null || x * sg > b * sg) b = x;
    }
    return (b === null ? sg * L2 : b) + sg * EB;
  };
  const F = (y, d, out = 0.015) => edge(Math.max(y, gY + 0.01), 1) - out + d / 2;
  const R = (y, d, out = 0.015) => edge(Math.max(y, gY + 0.01), -1) + out - d / 2;
  // zderzak przód + tył; zwraca położenie przedniej i tylnej ściany (na tablice)
  const bumpers = (y, h, d, c, wk = 0.98, out = 0.05) => {
    const zf = F(y, d, out), zr = R(y, d, out);
    push(BOX(W * wk, h, d), 0, y, zf, c); push(BOX(W * wk, h, d), 0, y, zr, c);
    return [zf + d / 2, zr - d / 2];
  };
  const plate = (y, z, sg) => {
    push(BOX(0.52, 0.12, 0.02), 0, y, z + sg * 0.01, 0xf2f2f2);
    push(BOX(0.05, 0.12, 0.022), -0.235, y, z + sg * 0.012, 0x1f4fbf);     // niebieski pasek z „PL”
  };
  const roundLampF = (x, y, r) => { push(CYLZ(r + 0.02, 0.04, 20), x, y, F(y, 0.04, 0.02), CHR); push(CYLZ(r, 0.05, 20), x, y, F(y, 0.05, 0.015), LAMP); };
  const sideStrip = (y, len, c, z = 0) => { for (const s of [-1, 1]) push(BOX(0.02, 0.045, len), s * (W / 2 + 0.008), y, z, c); };
  const roofRails = () => { const [rf, rb, ry] = S.roof; for (const s of [-1, 1]) { push(BOX(0.05, 0.05, (rf - rb) * 0.94), s * W * 0.37, ry + 0.12, (rf + rb) / 2, BLK); for (const k of [0.1, 0.9]) push(BOX(0.05, 0.08, 0.1), s * W * 0.37, ry + 0.07, rb + (rf - rb) * k, BLK); } };
  if (type === 'maluch') {
    const [pf, pr] = bumpers(gY + 0.06, 0.06, 0.06, CHR, 0.94, 0.03);                // cienkie chromowane zderzaki
    for (const s of [-1, 1]) { push(BOX(0.05, 0.11, 0.08), s * 0.3, gY + 0.07, pf - 0.03, RUB); push(BOX(0.05, 0.11, 0.08), s * 0.3, gY + 0.07, pr + 0.03, RUB); }
    for (const s of [-1, 1]) {
      roundLampF(s * 0.45, gY + 0.36, 0.085);                                          // okrągłe reflektory
      push(BOX(0.1, 0.05, 0.04), s * 0.45, gY + 0.2, F(gY + 0.2, 0.04), AMB);
      push(BOX(0.16, 0.13, 0.04), s * 0.5, gY + 0.3, R(gY + 0.3, 0.04), TAIL);
      push(BOX(0.16, 0.045, 0.042), s * 0.5, gY + 0.41, R(gY + 0.41, 0.042), AMB);
    }
    push(BOX(0.5, 0.03, 0.03), 0, gY + 0.46, F(gY + 0.46, 0.03, 0.02), CHR);        // listwa na przodzie
    for (let k = 0; k < 5; k++) { const y = gY + 0.4 + k * 0.05; push(BOX(W * 0.4, 0.02, 0.04), 0, y, R(y, 0.04), BLK); }   // żaluzje silnika z tyłu
    sideStrip(belt - 0.05, S.len * 0.55, CHR, -0.1);
    plate(gY + 0.17, F(gY + 0.17, 0.02, 0.0), 1); plate(gY + 0.2, R(gY + 0.2, 0.02, 0.0), -1);
  } else if (type === 'kredens') {
    const [pf, pr] = bumpers(gY + 0.12, 0.08, 0.08, CHR, 0.99, 0.02);
    for (const s of [-1, 1]) { push(BOX(0.06, 0.18, 0.1), s * 0.36, gY + 0.15, pf - 0.03, RUB); push(BOX(0.06, 0.18, 0.1), s * 0.36, gY + 0.15, pr + 0.03, RUB); }
    const gy = gY + 0.38;
    push(BOX(W * 0.6, 0.2, 0.05), 0, gy, F(gy, 0.05), BLK);                          // szeroki grill
    for (const y of [-0.11, 0.11]) push(BOX(W * 0.62, 0.028, 0.06), 0, gy + y, F(gy + y, 0.06, 0.02), CHR);
    for (let k = -3; k <= 3; k++) push(BOX(0.022, 0.2, 0.055), k * 0.13, gy, F(gy, 0.055), 0x3a3e45);
    for (const s of [-1, 1]) {
      roundLampF(s * 0.52, gy, 0.075); roundLampF(s * 0.7, gy, 0.075);                 // cztery okrągłe lampy
      push(BOX(0.14, 0.05, 0.04), s * 0.62, gY + 0.25, F(gY + 0.25, 0.04), AMB);
      push(BOX(0.36, 0.14, 0.04), s * 0.52, gY + 0.42, R(gY + 0.42, 0.04), TAIL);
      push(BOX(0.11, 0.14, 0.042), s * 0.75, gY + 0.42, R(gY + 0.42, 0.042), AMB);
    }
    sideStrip(belt - 0.04, S.len * 0.8, CHR);
    sideStrip(gY + 0.2, S.len * 0.82, CHR);
    plate(gY + 0.12, pf, 1); plate(gY + 0.3, R(gY + 0.3, 0.02, 0.0), -1);
  } else if (type === 'poldek') {
    const [pf, pr] = bumpers(gY + 0.12, 0.2, 0.16, BLK, 1.0, 0.06);                   // czarne plastikowe zderzaki
    const gy = gY + 0.4;
    push(BOX(0.5, 0.14, 0.04), 0, gy, F(gy, 0.04), BLK);
    for (let k = 0; k < 4; k++) { const y = gy - 0.05 + k * 0.033; push(BOX(0.48, 0.012, 0.045), 0, y, F(y, 0.045, 0.01), 0x3a3e45); }
    for (const s of [-1, 1]) {
      push(BOX(0.36, 0.15, 0.05), s * 0.53, gy, F(gy, 0.05), LAMP);                   // prostokątne reflektory
      push(BOX(0.37, 0.025, 0.055), s * 0.53, gy + 0.085, F(gy + 0.085, 0.055, 0.02), CHR);
      push(BOX(0.08, 0.15, 0.05), s * 0.77, gy, F(gy, 0.05, 0.03), AMB);
      push(BOX(0.4, 0.17, 0.04), s * 0.55, gY + 0.46, R(gY + 0.46, 0.04), TAIL);
      push(BOX(0.4, 0.04, 0.045), s * 0.55, gY + 0.575, R(gY + 0.575, 0.045), AMB);
    }
    push(BOX(0.64, 0.17, 0.035), 0, gY + 0.46, R(gY + 0.46, 0.035), 0x2b2f36);        // czarny pas między lampami
    sideStrip(gY + 0.36, S.len * 0.72, BLK);
    plate(gY + 0.13, pf, 1); plate(gY + 0.13, pr, -1);
  } else if (type === 'pasek') {
    const [pf, pr] = bumpers(gY + 0.14, 0.22, 0.14, color, 0.99, 0.06);              // zderzaki w kolorze nadwozia
    bumpers(gY + 0.03, 0.07, 0.15, BLK, 0.9, 0.06);
    const gy = gY + 0.46;
    push(BOX(0.44, 0.15, 0.04), 0, gy, F(gy, 0.04), BLK);
    push(BOX(0.46, 0.025, 0.05), 0, gy + 0.085, F(gy + 0.085, 0.05, 0.02), CHR);
    push(CYLZ(0.06, 0.03, 18), 0, gy, F(gy, 0.03, 0.0), CHR);                          // znaczek (ogólny)
    for (const s of [-1, 1]) {
      push(BOX(0.42, 0.16, 0.06), s * 0.54, gy, F(gy, 0.06, 0.03), CLEAR);            // kloszowe reflektory
      push(CYLZ(0.05, 0.06, 14), s * 0.46, gy, F(gy, 0.06, 0.025), LAMP); push(CYLZ(0.04, 0.06, 14), s * 0.64, gy, F(gy, 0.06, 0.03), LAMP);
      push(BOX(0.34, 0.16, 0.05), s * 0.62, gY + 0.58, R(gY + 0.58, 0.05), TAIL);
      push(BOX(0.34, 0.04, 0.052), s * 0.62, gY + 0.5, R(gY + 0.5, 0.052), 0xf2f2f2);
    }
    push(BOX(0.4, 0.025, 0.04), 0, gY + 0.62, R(gY + 0.62, 0.04), CHR);
    roofRails();
    sideStrip(gY + 0.36, S.len * 0.66, BLK);
    plate(gY + 0.17, pf, 1); plate(gY + 0.42, R(gY + 0.42, 0.02, 0.0), -1);
  } else if (type === 'szwed') {
    const [pf, pr] = bumpers(gY + 0.12, 0.17, 0.2, 0x2a2d33, 1.0, 0.04);              // duże zderzaki z chromowanym paskiem
    bumpers(gY + 0.21, 0.025, 0.21, CHR, 1.0, 0.04);
    const gy = gY + 0.43;
    push(BOX(0.5, 0.21, 0.05), 0, gy, F(gy, 0.05), CHR);                              // grill w chromowanej ramie
    push(BOX(0.44, 0.17, 0.052), 0, gy, F(gy, 0.052, 0.01), BLK);
    for (let k = -3; k <= 3; k++) push(BOX(0.018, 0.17, 0.056), k * 0.06, gy, F(gy, 0.056, 0.01), 0x6b717a);
    for (const s of [-1, 1]) {
      push(BOX(0.4, 0.17, 0.045), s * 0.5, gy, F(gy, 0.045), LAMP);                   // duże prostokątne reflektory
      push(BOX(0.12, 0.17, 0.05), s * 0.77, gy, F(gy, 0.05, 0.02), AMB);
      push(BOX(0.04, 0.17, 0.3), s * (W / 2 + 0.005), gy, F(gy, 0.3, 0.1) - 0.2, AMB); // kierunkowskaz na boku
      push(BOX(0.13, 0.52, 0.05), s * (W / 2 - 0.09), gY + 0.58, R(gY + 0.58, 0.05), TAIL);   // wysokie pionowe lampy tylne
    }
    roofRails();
    sideStrip(gY + 0.3, S.len * 0.8, BLK);
    plate(gY + 0.12, pf, 1); plate(gY + 0.42, R(gY + 0.42, 0.02, 0.0), -1);
  } else if (type === 'okularnik') {
    const [pf, pr] = bumpers(gY + 0.13, 0.2, 0.16, color, 0.99, 0.06);
    bumpers(gY + 0.16, 0.05, 0.17, 0x5a5f66, 1.0, 0.06);                               // szara listwa na zderzakach
    const gy = gY + 0.46;
    push(BOX(0.42, 0.27, 0.05), 0, gy, F(gy, 0.05, 0.01), CHR);                        // chromowana rama grilla
    push(BOX(0.35, 0.21, 0.055), 0, gy, F(gy, 0.055, 0.005), BLK);
    for (let k = -1; k <= 1; k++) push(BOX(0.35, 0.02, 0.06), 0, gy + k * 0.07, F(gy + k * 0.07, 0.06, 0.0), CHR);
    push(CYLZ(0.065, 0.03, 20), 0, gy + 0.18, F(gy + 0.18, 0.03, 0.01), CHR);           // okrągły znaczek (ogólny)
    push(BOX(0.025, 0.1, 0.025), 0, S.lower[3][1] + EB + 0.04, S.lower[3][0] - 0.12, CHR);   // ozdoba na masce
    for (const s of [-1, 1]) for (const [x, sc] of [[0.39, 1.0], [0.64, 1.1]]) {        // podwójne owalne lampy
      push(CYLZ(0.1, 0.04, 22), s * x, gy, F(gy, 0.04, 0.02), CHR, 0, sc * 1.2, 1, 1);
      push(CYLZ(0.085, 0.05, 22), s * x, gy, F(gy, 0.05, 0.018), LAMP, 0, sc * 1.2, 1, 1);
    }
    for (const s of [-1, 1]) { push(BOX(0.42, 0.16, 0.05), s * 0.56, gY + 0.52, R(gY + 0.52, 0.05), TAIL); push(BOX(0.16, 0.16, 0.052), s * 0.8, gY + 0.52, R(gY + 0.52, 0.052), AMB); }
    sideStrip(belt - 0.03, S.len * 0.6, CHR, -0.2);
    sideStrip(gY + 0.32, S.len * 0.8, 0x5a5f66);
    plate(gY + 0.13, pf, 1); plate(gY + 0.42, R(gY + 0.42, 0.02, 0.0), -1);
  } else if (type === 'majestat') {
    const [pf, pr] = bumpers(gY + 0.13, 0.22, 0.16, 0xc6cad0, 0.99, 0.06);
    bumpers(gY + 0.21, 0.03, 0.17, CHR, 0.8, 0.06);
    const gy = gY + 0.5;
    push(BOX(0.56, 0.4, 0.06), 0, gy, F(gy, 0.06, 0.0), CHR);                          // wysoki chromowany grill
    push(BOX(0.48, 0.33, 0.065), 0, gy, F(gy, 0.065, 0.0), BLK);
    for (let k = -5; k <= 5; k++) push(BOX(0.016, 0.33, 0.07), k * 0.043, gy, F(gy, 0.07, 0.0), CHR);
    push(BOX(0.04, 0.12, 0.04), 0, S.lower[3][1] + EB + 0.05, S.lower[3][0] - 0.05, CHR);   // stojąca ozdoba (ogólna)
    for (const s of [-1, 1]) {
      push(BOX(0.42, 0.12, 0.05), s * 0.62, gy, F(gy, 0.05, 0.02), CLEAR);
      push(BOX(0.42, 0.028, 0.055), s * 0.62, gy + 0.075, F(gy + 0.075, 0.055, 0.02), 0xeaf6ff);   // LED
      push(BOX(0.46, 0.12, 0.05), s * 0.6, gY + 0.55, R(gY + 0.55, 0.05), TAIL);
      push(CYLZ(0.055, 0.1, 14), s * 0.42, gY + 0.04, pr - 0.02, CHR);                // końcówki wydechu
    }
    push(BOX(W * 0.66, 0.03, 0.04), 0, gY + 0.63, R(gY + 0.63, 0.04), CHR);
    sideStrip(0.665 + EB * 0.5, S.len * 0.92, CHR);                                    // chrom na granicy dwóch kolorów
    sideStrip(belt - 0.02, S.len * 0.62, CHR, -0.35);
    plate(gY + 0.13, pf, 1); plate(gY + 0.42, R(gY + 0.42, 0.02, 0.0), -1);
  }
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
// Hulajnoga startowa z pliku GLB (model Blockbench). Ładowana raz, klonowana dla
// każdego egzemplarza. Dopóki plik się nie wczyta (albo gdy się nie uda), jedzie
// zastępcza hulajnoga proceduralna — podmieniana automatycznie po załadowaniu.
// Długość dobrana do postaci gracza: kierownica ~1,65 m, deska ~0,33 m nad ziemią,
// więc ręce kierowcy (barki 1,68 m nad stopami, ramię 0,66 m) sięgają kierownicy.
const KSCOOTER_LEN = 2.0;
let kscooterSrc = null, kscooterLoading = false;
const kscooterWaiting = [];
function loadKScooter() {
  if (kscooterSrc || kscooterLoading || !THREE.GLTFLoader) return;
  kscooterLoading = true;
  new THREE.GLTFLoader().load('models/e-scooter.glb', gltf => {
    const root = gltf.scene;
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    root.scale.setScalar(KSCOOTER_LEN / Math.max(size.z, 0.001));
    root.rotation.y = Math.PI;            // model patrzy w −Z, pojazdy w grze jadą w +Z
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);   // koła na ziemi, środek w (0, 0)
    const wrap = new THREE.Group();
    wrap.add(root);
    kscooterSrc = wrap;
    kscooterWaiting.splice(0).forEach(fn => fn());
  }, undefined, err => { kscooterLoading = false; console.warn('[Grammar City] models/e-scooter.glb', err); });
}
// Hulajnoga z modelu GLB ma jedną teksturę — kolor nakładamy jako odcień materiału.
const KS_DEFAULT = 0x2b2b2b;
function tintObj(o, hex) {
  o.traverse(m => {
    if (!m.isMesh || !m.material || m.material === vcMat) return;
    if (!m.userData.ownMat) { m.material = m.material.clone(); m.userData.ownMat = true; }
    m.material.color.set(0xffffff);
    if (hex != null && hex !== KS_DEFAULT) m.material.color.lerp(new THREE.Color(hex), 0.7);
  });
}
function makeKScooterMesh(tint) {
  const holder = new THREE.Group();
  holder.rotation.order = 'YXZ';
  holder.userData.tint = tint;
  const attach = () => { const c = kscooterSrc.clone(true); if (holder.userData.tint != null) tintObj(c, holder.userData.tint); holder.add(c); };
  if (kscooterSrc) attach();
  else {
    const fb = new THREE.Mesh(geo('scooter_kfallback', () => scooterGeometry(0x2b2b2b)), vcMat);
    fb.castShadow = true;
    holder.add(fb);
    kscooterWaiting.push(() => { holder.remove(fb); attach(); });
    loadKScooter();
  }
  return { g: holder, wheels: [], len: KSCOOTER_LEN };
}
// Samolot sportowy (dolnopłat): kadłub, kabina, skrzydła, usterzenie, podwozie; śmigło osobno (obraca się).
function planeGeometry(color) {
  const parts = [], C = c => new THREE.Color(c);
  const P2 = (gm, x, y, z, c, sx = 1, sy = 1, sz = 1) => parts.push({ g: gm, m: partMatrix(x, y, z, 0, sx, sy, sz), c: C(c) });
  P2(new THREE.CylinderGeometry(0.75, 0.42, 6.6, 16).rotateX(Math.PI / 2), 0, 1.5, 0.2, color);          // kadłub
  P2(new THREE.SphereGeometry(0.75, 16, 10), 0, 1.5, 3.5, color, 1, 1, 0.9);                               // nos
  P2(new THREE.SphereGeometry(0.62, 14, 8), 0, 2.05, 1.0, 0x1b3550, 0.85, 0.7, 1.6);                      // kabina
  P2(new THREE.BoxGeometry(9.2, 0.14, 1.7), 0, 1.15, 0.8, color);                                         // skrzydła
  for (const s of [-1, 1]) P2(new THREE.BoxGeometry(0.9, 0.16, 1.7), s * 4.2, 1.15, 0.8, 0xe0161b);       // końcówki
  P2(new THREE.BoxGeometry(9.0, 0.02, 0.15), 0, 1.23, 1.55, 0x2a2d33);                                    // linia klap
  P2(new THREE.BoxGeometry(3.4, 0.1, 0.9), 0, 1.75, -3.0, color);                                         // statecznik poziomy
  P2(new THREE.BoxGeometry(0.12, 1.5, 1.1), 0, 2.45, -3.1, color);                                        // statecznik pionowy
  P2(new THREE.BoxGeometry(0.14, 0.5, 0.7), 0, 3.0, -3.2, 0xe0161b);
  P2(new THREE.BoxGeometry(1.52, 0.12, 4.5), 0, 1.5, 0.2, 0xe0161b, 1, 1, 1);                             // pas na kadłubie
  for (const s of [-1, 1]) {
    P2(new THREE.BoxGeometry(0.08, 0.7, 0.08), s * 1.2, 0.68, 1.0, 0x6b7280);                              // goleń
    P2(CYLX(0.33, 0.22, 14), s * 1.2, 0.33, 1.0, 0x141414);                                                 // koło
  }
  P2(new THREE.BoxGeometry(0.06, 0.5, 0.06), 0, 0.85, -2.9, 0x6b7280); P2(CYLX(0.17, 0.12, 10), 0, 0.17, -2.9, 0x141414);
  P2(new THREE.SphereGeometry(0.22, 10, 8), 0, 1.5, 4.25, 0xd9dde3, 1, 1, 1.3);                           // kołpak śmigła
  return mergeColored(parts);
}
function vehGeo(type, color, split) {
  if (type === 'plane') return geo(`plane_${color}`, () => planeGeometry(color));
  return type === 'moto' ? geo(`moto_${color}`, () => motoGeometry(color))
    : type === 'scooter' ? geo(`scooter_${color}`, () => scooterGeometry(color))
    : geo(`car3_${type}_${color}${split ? '_s' : ''}`, () => carGeometry(type, color, split));
}
function recolorVehicle(v, hex) {
  if (v.type === 'kscooter') { v.mesh.userData.tint = hex; tintObj(v.mesh, hex); return; }
  if (v.type === 'plane') { v.mesh.children[0].geometry = vehGeo('plane', hex); return; }
  if (v.mesh.userData.vis && window.GCCars) {
    GCCars.setPaint(v.mesh.userData.vis, v.type, hex); v.mesh.userData.color = hex;
    if (v.mesh.userData.far) v.mesh.userData.far.geometry = vehGeo(v.type, hex);
    return;
  }
  if (v.mesh.userData.body) { v.mesh.userData.body.geometry = vehGeo(v.type, hex, true); v.mesh.userData.color = hex; return; }
  v.mesh.geometry = vehGeo(v.type, hex);
}
function makeCarMesh(type, color, split) {
  const m = makeCarMesh0(type, color, split); m.g.userData.color = color; return m;
}
// Auto z osobnymi kołami (gracz): karoseria (kołysze się przy hamowaniu i w zakrętach) + 4 koła,
// które się obracają; przednie skręcają. Pivot = środek koła, flip = zewnętrzna strona felgi na zewnątrz.
function makeSplitCar(type, color) {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = new THREE.Mesh(vehGeo(type, color, true), carPaintMat); body.castShadow = true; body.rotation.order = 'YXZ'; root.add(body);
  const d = carDims(type), wg = geo(`wheel_${type}`, () => wheelGeometry(d.wr, d.tw, WHEEL_STYLE[type] || 'steel'));
  const wheels = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * d.wx, d.wr, sz * d.wz);
    const flip = new THREE.Group(); flip.rotation.y = sx < 0 ? Math.PI : 0; pivot.add(flip);
    const m = new THREE.Mesh(wg, carPaintMat); m.castShadow = true; flip.add(m);
    root.add(pivot); wheels.push({ pivot, mesh: m, sgn: sx < 0 ? -1 : 1, front: sz > 0, x: sx * d.wx, z: sz * d.wz });
  }
  root.userData.body = body;
  return { g: root, wheels, len: d.len };
}
// Wsiadając do auta z ruchu ulicznego zamieniamy jego bryłę na wersję z osobnymi kołami.
function upgradeCarMesh(v) {
  if (!isCar4(v.type) || v.mesh.userData.body) return;
  if (v.mesh.userData.vis && !v.mesh.isLOD) return;
  const color = v.mesh.userData.color != null ? v.mesh.userData.color : carColor(v.type);
  const gh = v.ghost; if (gh) ghostVehicle(v, false);
  const c = makeCarMesh(v.type, color, true), old = v.mesh;
  if (v.flames) { c.g.add(v.flames); }                     // płomienie nitro przechodzą do nowej bryły
  c.g.position.copy(old.position); c.g.rotation.copy(old.rotation);
  scene.remove(old); scene.add(c.g);
  v.mesh = c.g; v.wheels = c.wheels;
  if (gh) ghostVehicle(v, true);
}
// Modele aut z cars.js (window.GCCars): auto gracza — osobne koła, tarcze, światła stop i poświaty;
// auta z ruchu — model z wtopionymi kołami do CAR_LOD_M, dalej uproszczona bryła (jedno wywołanie rysowania).
const CAR_LOD_M = 45;
function makeCarMesh0(type, color, split) {
  if (window.GCCars && isCar4(type)) {
    if (split) {
      const vis = GCCars.makeCarVisual(type, color, { player: true });
      vis.root.userData.body = vis.body; vis.root.userData.vis = vis;
      return { g: vis.root, wheels: vis.wheels, len: vis.len };
    }
    const vis = GCCars.makeCarVisual(type, color), lod = new THREE.LOD();
    lod.rotation.order = 'YXZ';
    lod.addLevel(vis.root, 0);
    vis.mesh.castShadow = false;                 // auta z ruchu: miękki cień kontaktowy zamiast mapy cieni (wydajność)
    const far = new THREE.Mesh(vehGeo(type, color), carPaintMat);
    lod.addLevel(far, CAR_LOD_M);
    lod.userData.vis = vis; lod.userData.far = far;
    return { g: lod, wheels: [], len: vis.len };
  }
  if (split && isCar4(type)) return makeSplitCar(type, color);
  if (type === 'kscooter') return makeKScooterMesh(color);
  if (type === 'plane') {
    const grp = new THREE.Group(); grp.rotation.order = 'YXZ';
    const body = new THREE.Mesh(vehGeo('plane', color), vcMat); body.castShadow = true; grp.add(body);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 0.06), new StdMat({ color: 0x222222 }));
    prop.position.set(0, 1.5, 4.45); grp.add(prop);
    grp.userData.prop = prop;
    return { g: grp, wheels: [], len: 7.5 };
  }
  const g = vehGeo(type, color);
  const mesh = new THREE.Mesh(g, isCar4(type) ? carPaintMat : vcMat);
  mesh.castShadow = true;
  mesh.rotation.order = 'YXZ';
  return { g: mesh, wheels: [], len: (CAR_SHAPES[TYPE_SHAPE[type]] || { len: 2 }).len };
}

const vehicles = [];
function spawnVehicle(type, color, x, z, heading, kind, split) {
  const c = makeCarMesh(type, color, split);
  const v = { mesh: c.g, wheels: c.wheels, type, spec: specOf(type), pos: new THREE.Vector3(x, 0, z), heading, speed: 0, steer: 0, kind, ai: null, honk: 0, lean: 0, len: c.len || 4.5 };
  c.g.position.copy(v.pos); c.g.rotation.y = heading;
  scene.add(c.g);
  vehicles.push(v);
  return v;
}
// Ruch uliczny: współczesne auta + ok. 18% klasyków (najczęściej Maluch, Poldek i Pasek).
const TRAFFIC_CLASSICS = ['maluch', 'maluch', 'poldek', 'poldek', 'pasek', 'pasek', 'kredens', 'szwed', 'okularnik', 'okularnik', 'majestat'];
function randomCarType() {
  const r = rand();
  return r < 0.11 ? 'taxi' : r < 0.18 ? 'van' : r < 0.24 ? 'sport' : r < 0.29 ? 'police' : r < 0.42 ? 'suv' : r < 0.56 ? 'hatch' : r < 0.64 ? 'lux' : r < 0.82 ? 'sedan' : pick(TRAFFIC_CLASSICS);
}
const LUX_COLORS = [0x1d2027, 0xc9ccd1, 0x23324d, 0xf1f2f6, 0x5a5f66, 0x3b1f2b];
const RETRO_COLORS = [0xc0392b, 0xe8b923, 0x2e5e8c, 0xd8d2b8, 0x6b8e23, 0x7a1f2b, 0xf1f2f6, 0x3d6b8f, 0xe67e22, 0x234d3a];
function carColor(type) {
  return type === 'taxi' ? 0xf5c518 : type === 'police' ? 0xf1f2f6 : type === 'lux' || type === 'majestat' || type === 'okularnik' ? pick(LUX_COLORS)
    : type === 'maluch' || type === 'kredens' || type === 'poldek' || type === 'szwed' ? pick(RETRO_COLORS) : pick(CAR_COLORS);
}

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
  if (REALMAP) { spawnTrafficReal(count); return; }
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
// Nowe miejsce dla auta z ruchu (Metropolia): pas w promieniu ~3 kwartałów od gracza, 90–300 m od niego.
const gridIdx = x => clamp(Math.round((x + HALF - R / 2) / CELL), 0, N);
function recycleGridCar(v, a, fx, fz) {
  for (let t = 0; t < 14; t++) {
    const axis = rand() < 0.5 ? 'x' : 'z', dir = rand() < 0.5 ? 1 : -1;
    const line = clamp(gridIdx(axis === 'x' ? fz : fx) + Math.floor(rand() * 7) - 3, 0, N);
    const k = clamp(gridIdx(axis === 'x' ? fx : fz) + Math.floor(rand() * 7) - 3, dir > 0 ? 1 : 0, dir > 0 ? N : N - 1);
    const along = rc(k) - dir * rr(14, CELL - 14);
    const [x, z] = laneXZ({ axis, dir, line }, along), d = Math.hypot(x - fx, z - fz);
    if (d < 90 || d > 300) continue;
    if (vehicles.some(o => o !== v && Math.hypot(o.pos.x - x, o.pos.z - z) < 14)) continue;
    Object.assign(a, { axis, dir, line, k, along, stuck: 0, ghost: 0 }); choosePlan(a);
    v.pos.set(x, 0, z); v.heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    return true;
  }
  return false;
}
function spawnParked(count) {
  if (REALMAP) {
    const spots = WD.parkSpots; let tries = 0;
    while (count > 0 && tries++ < 600) {
      const [x, z, hd] = spots[Math.floor(rand() * spots.length)];
      if (Math.hypot(x - WD.spawn[0], z - WD.spawn[1]) < 12) continue;
      if (vehicles.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 9)) continue;
      const type = randomCarType();
      spawnVehicle(type, carColor(type), x, z, hd, 'parked');
      count--;
    }
    return;
  }
  // Metropolia: część aut stoi na podjazdach przy domach (często klasyki)
  if (METRO && driveSpots.length) {
    let n = 0, t = 0;
    while (n < 26 && t++ < 300) {
      const [x, z, hd] = driveSpots[Math.floor(rand() * driveSpots.length)];
      if (vehicles.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 6)) continue;
      const type = rand() < 0.55 ? pick(CLASSICS) : randomCarType();
      if (type === 'police' || type === 'taxi') continue;
      spawnVehicle(type, carColor(type), x, z, hd, 'parked'); n++;
    }
  }
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
  if (REALMAP) {
    const paths = WD.pedPaths.filter(p => p.length >= 6);
    for (let i = 0; i < count && paths.length; i++) {
      const path = paths[Math.floor(rand() * paths.length)], cum = [0];
      for (let k = 2; k < path.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(path[k] - path[k - 2], path[k + 1] - path[k - 1]));
      const p = makePerson(randomLook(rand));
      scene.add(p.g);
      peds.push({ p, path, cum, len: cum[cum.length - 1], s: rand() * cum[cum.length - 1], dir: rand() < 0.5 ? 1 : -1, speed: rr(1.2, 2.1),
        knock: 0, ox: 0, oz: 0, vx: 0, vz: 0, vy: 0, y: 0, pause: 0 });
    }
    return;
  }
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
  if (q.path) {
    // tam i z powrotem po linii łamanej
    const L = q.len, T = 2 * L; let s = ((q.s % T) + T) % T, back = false;
    if (s > L) { s = T - s; back = true; }
    let k = 1; while (k < q.cum.length - 1 && q.cum[k] < s) k++;
    const s0 = q.cum[k - 1], seg = (q.cum[k] - s0) || 1, t = (s - s0) / seg;
    const x0 = q.path[(k - 1) * 2], z0 = q.path[(k - 1) * 2 + 1], x1 = q.path[k * 2], z1 = q.path[k * 2 + 1];
    let dx = (x1 - x0) / seg, dz = (z1 - z0) / seg; if (back !== (q.dir < 0)) { dx = -dx; dz = -dz; }
    return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, dx, dz];
  }
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
  { id: 'nitro', cat: 'extra', name: 'Nitro', desc: 'W pojeździe przytrzymaj Shift (na telefonie NITRO) — przyspieszenie do 300 km/h i płomienie z wydechu. Ładunek ~6 s, sam się odnawia.', price: 3000, perk: true },
  { id: 'invis', cat: 'extra', name: 'Niewidzialność', desc: 'Policja Cię nie widzi — żadnych pościgów ani mandatów. Włączasz i wyłączasz klawiszem I (lub w Ustawieniach).', price: 3000, perk: true },
  { id: 'wheelie', cat: 'extra', name: 'Willibary (jazda na jednym kole)', desc: 'Na hulajnodze i motorze przytrzymaj Q (na telefonie WHEELIE) — przednie koło w górę! Co 3 s na jednym kole +$5.', price: 1200, perk: true },
  { id: 'gem_sell', cat: 'extra', name: 'Wymiana diamentów', desc: 'Diamenty znajdziesz w domach (🚪) i opuszczonych budynkach (🏚️). Każdy wymienisz tutaj na $500.', price: 0, gemSell: true },
  { id: 'fuel', cat: 'extra', name: 'Pełny bak', desc: 'Tankowanie do pełna. Paliwo ubywa podczas jazdy (z nitro 4× szybciej).', price: 500, consumable: true },
  { id: 'veh_kscooter', cat: 'vehicle', name: 'Hulajnoga Pixel Rider', desc: 'Startowa e-hulajnoga — dostępna od początku', price: 0, vtype: 'kscooter', color: 0x2b2b2b },
  { id: 'veh_scooter', cat: 'vehicle', name: 'Hulajnoga elektryczna Volt K-Pro', desc: 'Szybka e-hulajnoga, do ~45 km/h', price: 400, vtype: 'scooter', color: 0x2b2b2b },
  { id: 'veh_hatch', cat: 'vehicle', name: 'Hatchback City', desc: 'Małe miejskie auto', price: 800, vtype: 'hatch', color: 0x2e86de },
  { id: 'veh_suv', cat: 'vehicle', name: 'SUV Explorer', desc: 'Wysoki i stabilny', price: 1400, vtype: 'suv', color: 0x10ac84 },
  { id: 'veh_moto', cat: 'vehicle', name: 'Motor sportowy Raptor 600', desc: 'Zielona strzała, do ~170 km/h', price: 2200, vtype: 'moto', color: 0x63c132 },
  { id: 'veh_lux', cat: 'vehicle', name: 'Limuzyna Executive E', desc: 'Elegancki sedan klasy biznes — komfort, cisza i moc (do ~150 km/h)', price: 2800, vtype: 'lux', color: 0x1d2027 },
  { id: 'veh_plane', cat: 'vehicle', name: 'Samolot Sky Hopper', desc: 'Lataj nad miastem — bez korków i policji! W/S gaz, A/D skręt, Spacja w górę, Shift/X w dół. Wysiadasz po wylądowaniu.', price: 10000, vtype: 'plane', color: 0xf2f2f2 },
  { id: 'veh_super', cat: 'vehicle', name: 'Supercar Fulmine', desc: 'Najszybsze auto w mieście', price: 4000, vtype: 'supercar', color: 0xe8410b },
  // klasyki z polskich ulic — wymiary 1:1, każdy prowadzi się inaczej (Spacja / Shift = ręczny, drift)
  { id: 'veh_maluch', cat: 'vehicle', name: 'Maluch', desc: 'Mały klasyk z PRL: okrągłe lampy, silnik z tyłu, do ~110 km/h. Zwinny w ciasnych uliczkach', price: 600, vtype: 'maluch', color: 0xc0392b },
  { id: 'veh_kredens', cat: 'vehicle', name: 'Kredens', desc: 'Kanciasty sedan z lat 70.: cztery okrągłe lampy, dużo chromu, do ~140 km/h', price: 900, vtype: 'kredens', color: 0x3d6b8f },
  { id: 'veh_poldek', cat: 'vehicle', name: 'Poldek', desc: 'Polski liftback z lat 80.: klinowy przód, czarne zderzaki, do ~150 km/h', price: 1000, vtype: 'poldek', color: 0x7a1f2b },
  { id: 'veh_pasek', cat: 'vehicle', name: 'Pasek Kombi', desc: 'Rodzinne kombi z lat 90. z relingami — pewne w zakrętach, do ~195 km/h', price: 1600, vtype: 'pasek', color: 0x9aa0a8 },
  { id: 'veh_szwed', cat: 'vehicle', name: 'Szwedzki Czołg', desc: 'Kanciaste, niezniszczalne kombi z wysokimi lampami z tyłu, do ~170 km/h', price: 1800, vtype: 'szwed', color: 0x234d3a },
  { id: 'veh_okularnik', cat: 'vehicle', name: 'Okularnik', desc: 'Niemiecki sedan z podwójnymi owalnymi lampami — szybki i stabilny, do ~220 km/h', price: 2400, vtype: 'okularnik', color: 0xc9ccd1 },
  { id: 'veh_majestat', cat: 'vehicle', name: 'Majestat', desc: 'Długa, dwukolorowa limuzyna prestiżowa — chromowany grill, do ~245 km/h', price: 6000, vtype: 'majestat', color: 0x1d2027 },
];
const SHOP_CATS = [['outfit', '👕 Stroje'], ['hat', '🧢 Nakrycia głowy'], ['glasses', '🕶️ Okulary'], ['hair', '💇 Fryzury'], ['vehicle', '🏍️ Pojazdy'], ['extra', '🔥 Nitro, paliwo, 💎'], ['settings', '⚙️ Ustawienia']];
const shopItem = id => SHOP.find(i => i.id === id);
function playerLook() { return lookFrom(wardrobe.equip, true); }
function lookFrom(e, shadow) {
  const out = (shopItem('outfit_' + e.outfit) || SHOP[0]).look;
  const h = shopItem('hat_' + e.hat) || shopItem('hat_cap');
  const hair = shopItem('hair_' + e.hair) || shopItem('hair_blond');
  return Object.assign({ skin: 0xe8b98f, shadow: !!shadow, hair: hair.hair, hairStyle: hair.hairStyle, hat: h.hat, hatColor: h.hatColor,
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
  applyGhost();
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
  if (ui === 'fish') { if (['Space', 'Enter', 'KeyR'].includes(e.code) && !e.repeat) { e.preventDefault(); fishAction(); } return; }
  if (e.code === 'KeyM') { e.preventDefault(); ui === 'map' ? closeMap() : !ui && openMap(); return; }
  if (e.code === 'KeyH') { ui === 'help' ? closeHelp() : !ui && openHelp(); return; }
  if (e.code === 'KeyN') { Sound.toggle(); toast(Sound.muted ? 'Dźwięk wyłączony' : 'Dźwięk włączony'); return; }
  if (e.code === 'KeyB') { ui === 'shop' ? closeShop() : !ui && openShop(); return; }
  if (ui) return;
  if (e.code === 'KeyV' && !e.repeat) { if (indoor) toast('Najpierw wyjdź z domu.'); else summonVehicle(); return; }
  if (e.code === 'KeyU' && !e.repeat) { toggleUrbex(); return; }
  if (e.code === 'KeyI' && !e.repeat) { toggleInvis(); return; }
  if (e.code === 'KeyT' && !e.repeat) { if (nearPet && !P.car && !nearMission) petAnimal(nearPet); else if (nearNPC && !P.car) openTalk(nearNPC); return; }
  if (e.code === 'KeyR' && !e.repeat) { if (nearFish && !P.car) openFishing(nearFish); return; }
  if (e.code === 'KeyG' && !e.repeat) { if (P.car && isScooterType(P.car.type)) cycleScooterMode(); else toast('Tryby Eco / S / R działają na hulajnodze — wsiądź na nią (V, potem F).'); return; }
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
const TAPS = { car: () => toggleCar(), mission: () => tryStartMission(), map: () => openMap(), shop: () => openShop(), call: () => summonVehicle(), mode: () => cycleScooterMode() };
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
  const doorAvail = !nearMission && !!(nearDoor || nearPhoto) && !P.car;
  const petAvail = !nearMission && !doorAvail && !!nearPet && !P.car;
  const fishAvail = !nearMission && !petAvail && !doorAvail && !!nearFish && !P.car;
  const talkAvail = !nearMission && !fishAvail && !petAvail && !doorAvail && !!nearNPC && !P.car;
  const misAvail = (!!nearMission && !P.car && isUnlocked(nearMission)) || talkAvail || fishAvail || petAvail || doorAvail;
  const scoot = !!P.car && isScooterType(P.car.type), wh = !!P.car && isTwoWheel(P.car.type) && hasWheelie();
  const st = `${show}|${carAvail}|${misAvail}|${!!P.car}|${talkAvail}|${fishAvail}|${petAvail}|${doorAvail}|${!!indoor}|${hasNitro()}|${scoot}|${wh}|${!!(P.car && P.car.spec.fly)}`;
  if (st === touchState) return;
  touchState = st;
  touchUI.hidden = !show;
  if (!show) { keys.clear(); dpadRelease(); }
  $('t-car').classList.toggle('off', !carAvail);
  $('t-car').textContent = P.car ? 'WYSIĄDŹ' : 'AUTO';
  $('t-mission').classList.toggle('off', !misAvail);
  $('t-mission').textContent = doorAvail ? (nearPhoto ? 'ZDJĘCIE' : indoor ? 'WYJDŹ' : 'WEJDŹ') : petAvail ? 'GŁASKAJ' : fishAvail ? 'RYBY' : talkAvail ? 'ROZMOWA' : 'MISJA';
  $('t-mode').classList.toggle('off', !scoot);
  $('t-wheelie').classList.toggle('off', !wh);
  const fly = !!(P.car && P.car.spec.fly);
  $('t-jump').textContent = fly ? 'W GÓRĘ' : P.car ? (isCar4(P.car.type) ? 'RĘCZNY' : 'HAMULEC') : 'SKOK';
  $('t-sprint').classList.toggle('off', !!P.car && !fly && !hasNitro());
  $('t-sprint').textContent = fly ? 'W DÓŁ' : P.car ? (hasNitro() || !isCar4(P.car.type) ? 'NITRO' : 'SPRZĘGŁO') : 'BIEG';
}

function onEscape() {
  if (ui === 'map') closeMap();
  else if (ui === 'help') closeHelp();
  else if (ui === 'quiz') abortQuiz();
  else if (ui === 'talk') closeTalk();
  else if (ui === 'shop') closeShop();
  else if (ui === 'fish') closeFishing();
  else if (ui === 'travel') closeTravel();
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
  // Syrena radiowozu: ton piłokształtny 900 ± 320 Hz „falujący" (LFO 0,55 Hz); głośność wg odległości.
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sir) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 900;
      const lfo = this.ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = 0.55;
      const depth = this.ctx.createGain(); depth.gain.value = 320; lfo.connect(depth); depth.connect(o.frequency);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
      const gn = this.ctx.createGain(); gn.gain.value = 0;
      o.connect(f); f.connect(gn); gn.connect(this.master); o.start(); lfo.start();
      this.sir = { o, lfo, g: gn };
    } else if (!on && this.sir) {
      const s = this.sir; this.sir = null;
      try { s.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05); setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch (e) { /* ignore */ } }, 300); } catch (e) { /* ignore */ }
    }
  },
  sirenLevel(k) { if (this.sir) this.sir.g.gain.setTargetAtTime(0.012 + 0.07 * k, this.ctx.currentTime, 0.1); },
  crash(v) { this.noise(0.35, Math.min(0.6, v / 30), 500); },
  door() { this.noise(0.12, 0.25, 1500); },
  // Pisk opon w poślizgu: zapętlony szum przez wąski filtr pasmowy (wysokość tonu „pływa” z poślizgiem).
  skid(level) {
    if (!this.ctx) return;
    if (!this.sk) {
      if (level <= 0.02) return;
      const n = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1150; f.Q.value = 9;
      const g = this.ctx.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.master); s.start();
      this.sk = { s, f, g };
    }
    const t = this.ctx.currentTime, k = clamp(level, 0, 1);
    this.sk.g.gain.setTargetAtTime(k * 0.22, t, 0.06);
    this.sk.f.frequency.setTargetAtTime(950 + k * 500 + Math.random() * 120, t, 0.05);
  },
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
    if (b.rings) {
      if (p.x < b.x0 - r || p.x > b.x1 + r || p.z < b.z0 - r || p.z > b.z1 + r) continue;
      const inside = polyInside(p.x, p.z, b.rings), [nx, nz, d] = polyNearest(p.x, p.z, b.rings);
      if (!inside && d >= r) continue;
      if (d < 1e-6) { p.x += r; continue; }
      moved = true;
      const k = inside ? -1 : 1;                 // w środku: wypchnij za najbliższą ścianę
      p.x = nx + k * (p.x - nx) / d * r; p.z = nz + k * (p.z - nz) / d * r;
      continue;
    }
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
  const ox0 = P.pos.x, oz0 = P.pos.z;
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
  if (!indoor) waterSlide(ox0, oz0, p, 0.35);
  if (indoor) { P.pos.x = clamp(p.x, indoor.room.x - ROOM_W / 2 + 0.4, indoor.room.x + ROOM_W / 2 - 0.4); P.pos.z = clamp(p.z, indoor.room.z - ROOM_D / 2 + 0.4, indoor.room.z + ROOM_D / 2 - 0.4); }
  else { P.pos.x = clamp(p.x, -BOUND, BOUND); P.pos.z = clamp(p.z, -BOUND, BOUND); }
  player.g.position.copy(P.pos);
  // krawężnik (do 0,5 m w górę): postać wchodzi płynnie zamiast przeskakiwać o całą wysokość w jednej klatce
  P.visY = P.visY == null || P.pos.y < P.visY || P.pos.y - P.visY > 0.5 ? P.pos.y : lerp(P.visY, P.pos.y, Math.min(1, dt * 12));
  player.g.position.y = P.visY;
  player.g.rotation.y = P.facing;
  animPerson(player, P.speed, dt, !P.onGround);
}

const ACC = 15, MAXS = 36, MAXR = 10, BRAKE = 32;
let shake = 0, pedWarnT = 0;
function updateCar(v, dt) {
  const wantUp = !ui && key('KeyW', 'ArrowUp'), down = !ui && key('KeyS', 'ArrowDown');
  const left = !ui && key('KeyA', 'ArrowLeft'), right = !ui && key('KeyD', 'ArrowRight');
  const sp = v.spec || VSPEC.car, four = isCar4(v.type), phys = four && v.body;
  // ręczny: Spacja. Shift w aucie: nitro (gdy kupione), inaczej kopnięcie sprzęgła (fizyka) / ręczny (dawny model)
  const shift = !ui && key('ShiftLeft', 'ShiftRight');
  const hb = !ui && (key('Space') || (four && !phys && !hasNitro() && shift));
  const up = fuelAndNitro(v, dt, wantUp) && wantUp;      // bez paliwa — brak gazu
  const icy0 = season() === 'winter';
  if (phys) { driveBody(v, dt, up, down, left, right, hb, shift && !hasNitro(), icy0); return finishCar(v, dt, sp, four, hb, down, up, icy0, v.pos.x - v.vdx, v.pos.z - v.vdz); }
  const sm = isScooterType(v.type) ? SCOOTER_MODES[wardrobe.smode] || SCOOTER_MODES.S : null;
  const vmax = sm ? sm.kmh / 3.6 : sp.max, vacc = sm ? sm.acc : sp.acc;
  const icy = season() === 'winter', brk = sp.brake * (icy ? 0.42 : 1);
  const sp0 = v.speed;
  if (nitroActive) { v.speed += NITRO_ACC * (1 - v.speed / NITRO_MAX) * dt; }
  else if (up) { v.speed += (v.speed < -0.5 ? brk : vacc * (icy ? 0.75 : 1) * (1 - v.speed / vmax) * (four && hb ? 0.35 : 1)) * dt; }
  else if (down) { v.speed -= (v.speed > 0.5 ? brk : vacc * 0.7 * (1 + v.speed / sp.rev)) * dt; }
  else { v.speed *= 1 - Math.min(1, (icy ? 0.22 : 0.55) * dt); if (Math.abs(v.speed) < 0.15) v.speed = 0; }
  if (sm && !nitroActive && v.speed > vmax) v.speed = Math.max(vmax, v.speed - 8 * dt);   // niższy tryb — silnik zwalnia
  if (hb) {
    if (four) { const d = (icy ? 2.5 : 6.5) * dt; v.speed = Math.abs(v.speed) <= d ? 0 : v.speed - Math.sign(v.speed) * d; }   // zablokowane tylne koła
    else v.speed *= 1 - Math.min(1, (icy ? 0.8 : 2.2) * dt);
  }
  updateWheelie(v, dt);
  const steerIn = (left ? 1 : 0) - (right ? 1 : 0);
  v.steer = lerp(v.steer, steerIn, Math.min(1, dt * (four ? 4.5 : 6)));
  const maxSteer = sp.steer / (1 + Math.abs(v.speed) * 0.045);
  const vox = v.pos.x, voz = v.pos.z;
  if (four) driveFour(v, dt, sp, hb, icy, up, maxSteer, sp0, down);
  else {
    v.heading += v.steer * maxSteer * v.speed / 3.0 * dt * (hb ? 1.7 : 1);
    // zimą jednoślad „płynie": kierunek ruchu dogania kierunek z opóźnieniem (poślizg)
    if (v.mdir == null) v.mdir = v.heading;
    v.mdir += angDiff(v.mdir, v.heading) * Math.min(1, (icy ? (hb ? 0.9 : 2.1) : 40) * dt);
    v.pos.x += Math.sin(v.mdir) * v.speed * dt; v.pos.z += Math.cos(v.mdir) * v.speed * dt;
  }
  finishCar(v, dt, sp, four, hb, down, up, icy, vox, voz);
}
// Kolizje, woda, policja, piesi, poza, efekty i dźwięk — wspólne dla obu modeli jazdy.
function finishCar(v, dt, sp, four, hb, down, up, icy, vox, voz) {
  const f = carFwd(v);
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
      if (four && v.slip) {     // uderzenie bokiem w poślizgu
        const ds = (f.z * mx - f.x * mz) / l;
        if (ds * v.slip < 0) { impact = Math.max(impact, Math.abs(v.slip * ds)); v.slip *= 1 - 1.3 * ds * ds; }
      }
    }
  }
  if (vehicleWater(v, vox, voz, f)) { impact = Math.max(impact, Math.abs(v.speed) * 0.6); v.speed *= 0.25; }
  if (impact > 7) { Sound.crash(impact); shake = Math.min(0.6, impact / 40); }
  if (four && impact > 4) driftScore.fail();
  // pościg: jazda szybciej niż limit przez ponad 1,2 s
  if (Math.abs(v.speed) * 3.6 > SPEED_LIMIT_KMH) { overSpeedT += dt; if (overSpeedT > 1.2) triggerPolice('speed'); } else overSpeedT = 0;
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
        triggerPolice('ped');
        if (performance.now() - pedWarnT > 2500) { pedWarnT = performance.now(); const fine = Math.min(save.money, 25); save.money -= fine; persist(); toast(`Uważaj na pieszych! −$${fine}`, 'bad'); }
        break;
      }
    }
  }
  if (v.body) syncBody(v);
  poseCar(v, dt);
  if (sp.ride) posePlayerRider(v);
  if (four) carFx(v, dt, hb, down, icy);
  if (four && window.GCCars && v.mesh.userData.vis) GCCars.setPlayerLights(v.mesh.userData.vis, smooth(0.35, 0.85, nightK), (down && v.speed > 0.5) || hb);
  Sound.engine(true, v.body ? v.body.rpm / 140 : v.speed * (sp.ride === 'scooter' ? 0.4 : 1), up && sp.ride !== 'scooter');
}
// Nawierzchnia pod osią: jezdnia 1,0 · chodnik / trawnik w kwartale 0,9 · trawa za miastem 0,65 (+ opór) · zimą lód ×0,38.
const _surf = { mu: 1, drag: 0 };
function surfAt(x, z, icy) {
  let mu = 1, drag = 0;
  if (!REALMAP) {
    if (onBlock(x, z)) { mu = 0.9; drag = 0.01; }
    else if (Math.abs(x) > HALF || Math.abs(z) > HALF) { mu = 0.65; drag = 0.05; }
  }
  _surf.mu = icy ? mu * 0.38 : mu; _surf.drag = drag;
  return _surf;
}
// Jazda autem z fizyką z cars.js (VehicleBody): wynik → pozycja, kierunek, prędkość wzdłuż / w bok, przechyły.
function driveBody(v, dt, up, down, left, right, hb, kick, icy) {
  const b = v.body;
  b.x = v.pos.x; b.z = v.pos.z;
  b.extraF = nitroActive ? b.m * NITRO_ACC * Math.max(0, 1 - b.u / NITRO_MAX) : 0;
  b.step(dt, { thr: up ? 1 : 0, brk: down ? 1 : 0, steer: (left ? 1 : 0) - (right ? 1 : 0), hand: hb, kick }, (x, z) => surfAt(x, z, icy));
  v.vdx = b.x - v.pos.x; v.vdz = b.z - v.pos.z;
  v.pos.x = b.x; v.pos.z = b.z; v.heading = b.h; v.mdir = b.h;
  const fx = Math.sin(b.h), fz = Math.cos(b.h);
  v.speed = b.vx * fx + b.vz * fz; v.slip = b.vx * fz - b.vz * fx;
  v.steer = b.delta / Math.max(0.2, b.p.steer);
  v.yawV = b.w; v.hb = hb; v.braking = b.braking && v.speed > 6;
  v.drift = clamp((b.slipR - 2.0) / 4, 0, 1);
  // przechyły nadwozia z przeciążeń (sprężyny jak w zawieszeniu)
  const pT = clamp(-b.axS * 0.0065, -0.06, 0.06), rT = clamp(b.ayS * 0.0055, -0.07, 0.07);
  v.pv = (v.pv || 0) + ((pT - (v.pitch || 0)) * 140 - (v.pv || 0) * 13) * dt; v.pitch = (v.pitch || 0) + v.pv * dt;
  v.rv = (v.rv || 0) + ((rT - (v.roll || 0)) * 120 - (v.rv || 0) * 11) * dt; v.roll = (v.roll || 0) + v.rv * dt;
}
// Po kolizjach (budynki, auta, woda) — prędkość i pozycja wracają do ciała fizycznego.
function syncBody(v) {
  const b = v.body, fx = Math.sin(v.heading), fz = Math.cos(v.heading);
  b.x = v.pos.x; b.z = v.pos.z; b.h = v.heading;
  b.vx = fx * v.speed + fz * (v.slip || 0); b.vz = fz * v.speed - fx * (v.slip || 0);
}
// ---------------------------------------------------------------- ślady opon, dym, pisk
// Ślady: bufor pierścieniowy prostokątów na jezdni (najstarsze nadpisywane). Dym: pula sprite'ów.
const SKID_MAX = 1800;
const skidPos = new Float32Array(SKID_MAX * 18), skidGeo = new THREE.BufferGeometry();
skidGeo.setAttribute('position', new THREE.BufferAttribute(skidPos, 3));
skidGeo.setDrawRange(0, 0);
const skidMesh = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
skidMesh.frustumCulled = false; skidMesh.renderOrder = 1;
scene.add(skidMesh);
let skidN = 0, skidUsed = 0, skidDirty = false;
function addSkid(ax, az, bx, bz, w, y) {
  const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
  const o = skidN * 18, q = [ax + nx, y, az + nz, ax - nx, y, az - nz, bx - nx, y, bz - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz];
  skidPos.set(q, o);
  skidN = (skidN + 1) % SKID_MAX; skidUsed = Math.min(SKID_MAX, skidUsed + 1); skidDirty = true;
}
const smokeTex = (() => {
  const c = makeCanvas(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const smoke = [];
for (let i = 0; i < 44; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xdedede, transparent: true, opacity: 0, depthWrite: false }));
  s.visible = false; scene.add(s); smoke.push({ s, t: 0, life: 1, vx: 0, vy: 0, vz: 0 });
}
let smokeI = 0, smokeAcc = 0;
function puff(x, y, z, vx, vz, snow) {
  const p = smoke[smokeI = (smokeI + 1) % smoke.length];
  p.t = 0; p.life = 0.9 + Math.random() * 0.6; p.vx = vx * 0.25 + (Math.random() - 0.5); p.vz = vz * 0.25 + (Math.random() - 0.5); p.vy = 0.6 + Math.random() * 0.8;
  p.s.position.set(x, y + 0.3, z); p.s.visible = true; p.s.material.color.setHex(snow ? 0xffffff : 0xe6e6e6);
}
function updateSmoke(dt) {
  for (const p of smoke) {
    if (!p.s.visible) continue;
    p.t += dt;
    if (p.t >= p.life) { p.s.visible = false; continue; }
    const k = p.t / p.life;
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    p.s.scale.setScalar(0.7 + k * 2.6);
    p.s.material.opacity = 0.55 * (1 - k) * Math.min(1, p.t * 8);
  }
  if (skidDirty) { skidGeo.attributes.position.needsUpdate = true; skidGeo.setDrawRange(0, skidUsed * 6); skidDirty = false; }
}
// Ślady, dym i pisk dla auta gracza: tylne koła w poślizgu / na ręcznym, przednie przy ostrym hamowaniu.
function carFx(v, dt, hb, braking, icy) {
  if (!v.wheels.length) { Sound.skid(0); return; }
  driftScore.update(v, dt);
  const f = carFwd(v), sx = f.z, sz = -f.x, d = carDims(v.type), spd = Math.abs(v.speed) + Math.abs(v.slip || 0);
  const bb = v.body, intF = bb ? clamp((bb.slipF - 2.4) / 5, 0, 1) : 0;
  const rearOn = bb ? clamp((bb.slipR - 2.0) / 4, 0, 1) > 0.02 : spd > 3 && (v.drift > 0.12 || (hb && Math.abs(v.speed) > 2.5));
  const frontOn = bb ? intF > 0.02 : spd > 3 && (v.drift > 0.65 || (v.braking && v.aLong < -18));
  let level = 0;
  if (rearOn) level = Math.max(level, hb ? 0.55 + v.drift * 0.45 : v.drift);
  if (frontOn) level = Math.max(level, bb ? intF : 0.6);
  if (bb && rearOn) level = Math.max(level, clamp((bb.slipR - 2.0) / 4, 0, 1));
  Sound.skid(level * Math.min(1, spd / 8));
  const y = v.pos.y + 0.025;
  for (const w of v.wheels) {
    const on = w.front ? frontOn : rearOn;
    const wx = v.pos.x + f.x * w.z + sx * w.x, wz = v.pos.z + f.z * w.z + sz * w.x;
    if (!on) { w.mark = null; continue; }
    if (!icy) {
      if (!w.mark) w.mark = [wx, wz];
      else if (Math.hypot(wx - w.mark[0], wz - w.mark[1]) > 0.3) { addSkid(w.mark[0], w.mark[1], wx, wz, d.tw * 0.95, y); w.mark = [wx, wz]; }
    }
  }
  if (rearOn && (v.drift > 0.25 || hb) && spd > 5) {
    smokeAcc += dt * 26 * Math.max(v.drift, hb ? 0.6 : 0);
    while (smokeAcc > 1) {
      smokeAcc--;
      const w = v.wheels[2 + (Math.random() < 0.5 ? 0 : 1)];
      const vx = f.x * v.speed + sx * (v.slip || 0), vz = f.z * v.speed + sz * (v.slip || 0);
      puff(v.pos.x + f.x * w.z + sx * w.x, v.pos.y, v.pos.z + f.z * w.z + sz * w.x, vx, vz, icy);
    }
  }
}
// Punkty za drift (kąt × prędkość × czas) — sama zabawa i rekord, bez pieniędzy (gra jest o nauce).
// Uderzenie w coś w trakcie driftu kasuje punkty.
const driftScore = {
  pts: 0, idle: 0,
  update(v, dt) {
    const ang = Math.abs(Math.atan2(v.slip || 0, Math.max(1, Math.abs(v.speed)))) * 180 / Math.PI;
    if (v.drift > 0.2 && Math.abs(v.speed) > 7 && ang > 7) {
      this.pts += ang * Math.abs(v.speed) * dt * 0.6; this.idle = 0; clearTimeout(this.tm);
      const el = $('drift-hud'); el.hidden = false; el.classList.remove('fail');
      el.innerHTML = `DRIFT <b>${Math.round(ang)}°</b><span>${Math.round(this.pts)}</span>`;
    } else if (this.pts > 0 && (this.idle += dt) > 1.1) this.end(false);
  },
  fail() {
    if (this.pts < 30) return;
    this.pts = 0; this.idle = 0;
    const el = $('drift-hud'); el.innerHTML = 'DRIFT <b>✖</b><span>0</span>'; el.classList.add('fail');
    clearTimeout(this.tm); this.tm = setTimeout(() => { el.hidden = true; el.classList.remove('fail'); }, 1200);
  },
  end(quiet) {
    const p = Math.round(this.pts); this.pts = 0; this.idle = 0;
    const el = $('drift-hud');
    if (quiet || p < 120) { el.hidden = true; return; }
    const rec = p > (save.driftBest || 0);
    if (rec) { save.driftBest = p; persist(); }
    el.innerHTML = `DRIFT <b>+${p}</b><span>${rec ? 'NOWY REKORD!' : 'rekord ' + save.driftBest}</span>`;
    clearTimeout(this.tm); this.tm = setTimeout(() => { el.hidden = true; }, 1800);
  },
};
function stopCarFx(v) {
  v.slip = 0; v.drift = 0; v.yawV = 0; v.hb = false; v.pitch = v.roll = v.pv = v.rv = 0;
  for (const w of v.wheels || []) w.mark = null;
  const b = v.mesh.userData.body; if (b) b.rotation.set(0, 0, 0);
  Sound.skid(0); driftScore.end(true);
}
// Fizyka auta 4-kołowego z poślizgiem. Prędkość w układzie auta: wzdłuż (v.speed) i w bok (v.slip, + = w lewo).
// Obrót auta obraca wektor prędkości względem maski; przyczepność opon (spec.grip, m/s²) kasuje prędkość boczną.
// Gdy siła w zakręcie przekracza przyczepność — auto się ślizga (drift); ręczny (Spacja/Shift) blokuje tył:
// przyczepność spada, tył ucieka, auto obraca się mocniej. Kontra (skręt w przeciwną stronę) prostuje auto.
function driveFour(v, dt, sp, hb, icy, up, maxSteer, sp0, braking) {
  const L0 = v.speed, S0 = v.slip || 0, G0 = (sp.grip || 28) * (icy ? 0.38 : 1);
  const sliding = Math.abs(S0) > 1.6;
  // docelowa prędkość obrotu (jak dotąd) — z ręcznym i przy gazie w poślizgu auto skręca mocniej
  let yawT = v.steer * maxSteer * L0 / 3.0 * (hb ? 1.4 : sliding && up ? 1.15 : 1);
  if (hb) yawT = clamp(yawT, -2.4, 2.4);         // obrót na ręcznym: szybki, ale bez „bączka” w miejscu
  else {
    // przyczepność ogranicza obrót: a_boczne = v · ω ≤ G. Im większy kąt poślizgu, tym słabiej auto dokręca
    // (stabilny drift ok. 9–18° zamiast obrotu w miejscu); kontra działa zawsze mocno.
    const beta = Math.atan2(Math.abs(S0), Math.max(1, Math.abs(L0))), counter = L0 * yawT * S0 > 0;
    const k = counter ? 1.4 : Math.max(0.35, 1.06 - 1.2 * beta) * (sliding && up ? 1.1 : 1);
    const lim = k * G0 / Math.max(2, Math.abs(L0));
    yawT = clamp(yawT, -lim, lim);
  }
  v.yawV = lerp(v.yawV || 0, yawT, Math.min(1, dt * (hb ? 5 : 8)));
  const dh = v.yawV * dt;
  v.heading += dh;
  // prędkość zostaje w świecie — w układzie auta obraca się o −dh
  const c = Math.cos(dh), s = Math.sin(dh);
  let L = L0 * c + S0 * s, S = -L0 * s + S0 * c;
  // opony: z ręcznym tył traci przyczepność; w poślizgu z gazem — mniej przyczepności (tarcie ślizgowe)
  const G = G0 * (hb ? 0.26 : sliding && up ? 0.75 : sliding ? 0.88 : 1);
  const cut = Math.min(Math.abs(S), G * dt);
  S -= Math.sign(S) * cut;
  L -= Math.sign(L) * Math.min(Math.abs(L), Math.abs(S) * 0.35 * dt);   // tarcie boczne hamuje
  v.speed = L; v.slip = Math.abs(S) < 0.02 ? 0 : S;
  const f = carFwd(v);
  v.pos.x += (f.x * L + f.z * S) * dt; v.pos.z += (f.z * L - f.x * S) * dt;
  v.mdir = v.heading;
  v.hb = hb; v.braking = braking && L > 6;
  v.drift = clamp((Math.abs(S) - 1.6) / 5, 0, 1);
  // przechyły karoserii: hamowanie / przyspieszanie (nurkowanie / przysiad), zakręt (przechył na zewnątrz)
  v.aLong = lerp(v.aLong || 0, (L - sp0) / Math.max(dt, 1e-3), Math.min(1, dt * 10));
  const aLat = L * v.yawV;
  const pT = clamp(-v.aLong * 0.0036, -0.04, 0.055), rT = clamp(aLat * 0.0036, -0.065, 0.065);
  v.pv = (v.pv || 0) + ((pT - (v.pitch || 0)) * 70 - (v.pv || 0) * 10) * dt; v.pitch = (v.pitch || 0) + v.pv * dt;
  v.rv = (v.rv || 0) + ((rT - (v.roll || 0)) * 60 - (v.rv || 0) * 9) * dt; v.roll = (v.roll || 0) + v.rv * dt;
}
// Pojazd na ziemi nie wjedzie do wody: sprawdzamy przód i tył (okręgi kolizji); ślizg wzdłuż brzegu.
function vehicleWater(v, ox, oz, f) {
  if (!waterGrid) return false;
  const off = (v.spec || VSPEC.car).off, r = Math.max(0.4, (v.spec || VSPEC.car).rad * 0.8);
  const hit = (x, z) => waterHit(x + f.x * off, z + f.z * off, r) || waterHit(x - f.x * off, z - f.z * off, r);
  if (!hit(v.pos.x, v.pos.z) || hit(ox, oz)) return false;
  if (!hit(v.pos.x, oz)) v.pos.z = oz;
  else if (!hit(ox, v.pos.z)) v.pos.x = ox;
  else { v.pos.x = ox; v.pos.z = oz; }
  return true;
}
// Gracz na motorze (siedzi, pochylony) lub hulajnodze (stoi) — pozycja i poza kończyn.
function posePlayerRider(v) {
  const sp = v.spec, f = carFwd(v);
  const wa = wheelieAngle(v), wl = (sp.seatZ + (v.len || 2) * 0.4) * Math.sin(wa);
  const lift = (sp.ride === 'moto' ? sp.seatY - 1.0 : sp.seatY) + wl;
  player.g.position.set(v.pos.x + f.x * sp.seatZ, v.pos.y + lift, v.pos.z + f.z * sp.seatZ);
  player.g.rotation.set((sp.ride === 'moto' ? 0.32 : 0.06) - wa * 0.8, v.heading, v.lean || 0);
  player.rig.position.set(0, 0, 0); player.rig.rotation.set(0, 0, 0);
  if (sp.ride === 'moto') {
    player.ll.rotation.set(-1.15, 0, -0.18); player.rl.rotation.set(-1.15, 0, 0.18); player.lk.rotation.x = player.rk.rotation.x = 1.45;
    player.la.rotation.set(-1.0, 0, 0.15); player.ra.rotation.set(-1.0, 0, -0.15); player.lf.rotation.x = player.rf.rotation.x = -0.45;
  } else {
    player.ll.rotation.set(0.05, 0, 0); player.rl.rotation.set(-0.2, 0, 0); player.lk.rotation.x = 0.12; player.rk.rotation.x = 0.3;
    player.la.rotation.set(-0.85, 0, 0.12); player.ra.rotation.set(-0.85, 0, -0.12); player.lf.rotation.x = player.rf.rotation.x = -0.35;
  }
}
function poseCar(v, dt) {
  v.mesh.position.copy(v.pos);
  v.mesh.rotation.y = v.heading;
  if (v.spec && v.spec.ride) {
    const want = -(v.steer || 0) * Math.min(1, Math.abs(v.speed) / 14) * (v.spec.ride === 'moto' ? 0.42 : 0.22);
    v.lean = lerp(v.lean || 0, want, Math.min(1, dt * 6));
    v.mesh.rotation.z = v.lean;
    const wa = wheelieAngle(v);
    v.mesh.rotation.x = -wa;
    if (wa) v.mesh.position.y += (v.len || 2) * 0.4 * Math.sin(wa);
  }
  if (!v.wheels.length) return;
  // osobne koła: obrót wg prędkości (z ręcznym tylne stoją), skręt przednich, przechył karoserii
  const d = carDims(v.type), st = (v.steer || 0) * 0.55 / (1 + Math.abs(v.speed) * 0.03);
  const pb = v.kind === 'player' && v.body;
  for (const w of v.wheels) {
    if (pb) w.mesh.rotation.x += (w.front ? pb.wheelSpinF : pb.wheelSpinR) * dt * w.sgn;
    else if (!(v.hb && !w.front && v.kind === 'player')) w.mesh.rotation.x += v.speed * dt / (w.r || d.wr) * w.sgn;
    if (w.front) w.pivot.rotation.y = pb ? pb.delta : st;
  }
  const b = v.mesh.userData.body;
  if (b) { b.rotation.x = v.kind === 'player' ? v.pitch || 0 : 0; b.rotation.z = v.kind === 'player' ? v.roll || 0 : 0; }
}

function toggleCar() {
  if (P.car) {
    const v = P.car;
    if (v.spec.fly && v.pos.y - groundAt(v.pos.x, v.pos.z) > 0.3) { toast('✈️ Najpierw wyląduj (przytrzymaj Shift / X, żeby się zniżyć).'); return; }
    if (Math.abs(v.speed) > 6) { toast('Zwolnij, żeby wysiąść!'); return; }
    const f = carFwd(v);
    for (const s of [1, -1]) {
      const ex = (v.spec || VSPEC.car).exit, x = v.pos.x + f.z * ex * s, z = v.pos.z - f.x * ex * s;
      const p = { x, z };
      if ((!pushOut(p, 0.45, nearCols, 0.2) && !waterHit(p.x, p.z, 0.4)) || s === -1) { P.pos.set(p.x, groundAt(p.x, p.z), p.z); break; }
    }
    v.kind = 'parked'; v.speed = 0; v.steer = 0; v.lean = 0; v.wheelie = 0; v.mesh.rotation.z = 0; v.mesh.rotation.x = 0;
    stopCarFx(v);
    nitroActive = false; if (v.flames) v.flames.visible = false; persistWardrobe();
    if (v.ghost) ghostVehicle(v, false);
    P.car = null; player.g.visible = true; P.facing = v.heading; P.speed = 0;
    player.g.rotation.set(0, P.facing, 0);
    resetPose(player);
    Sound.door(); Sound.engine(false, 0, false);
    $('speedo').hidden = true; $('speed-unit').textContent = 'KM/H';
    return;
  }
  let best = null, bd = 4.5;
  for (const v of vehicles) { if (v.kind === 'police') continue; const d = Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z); if (d < bd) { bd = d; best = v; } }
  if (!best) return;
  if (best.ai) { best.ai = null; toast('Auto przejęte! Kierowca uciekł.', 'good'); }
  upgradeCarMesh(best);
  if (isCar4(best.type) && window.GCCars) { best.body = best.body || GCCars.makeBody(best.type); best.body.setPose(best.pos.x, best.pos.z, best.heading); best.body.gear = 0; best.body.thr = 0; }
  best.kind = 'player'; best.speed = 0; best.slip = 0; best.yawV = 0; best.mdir = best.heading; P.car = best; player.g.visible = !!(best.spec && best.spec.ride);
  if (invisibleOn()) ghostVehicle(best, true);
  Sound.door();
  $('speedo').hidden = false;
  $('speed-car').textContent = VEH_NAMES[best.type] || '';
  if (isCar4(best.type) && !carHintShown) { carHintShown = true; toast(`🚗 ${VEH_NAMES[best.type] || 'Auto'} — <kbd>Spacja</kbd> = ręczny (drift)${hasNitro() ? '' : ', <kbd>Shift</kbd> = kopnięcie sprzęgła'}, <kbd>S</kbd> = hamulec / wsteczny, <kbd>F</kbd> = wysiądź.`, 'good', 5000); }
}
let carHintShown = false;

// ---------------------------------------------------------------- samolot
// W / S — gaz / hamowanie, A / D — skręt, Spacja — w górę, Shift / X / C — w dół (na dotyku SKOK / BIEG).
// Start od PLANE_LIFT (~72 km/h), maks. 250 km/h, pułap 300 m. W powietrzu: bez ruchu ulicznego, pieszych i policji;
// kolizje tylko z budynkami wyższymi niż samolot. Wysiadka tylko na ziemi.
const PLANE_MAX = 70, PLANE_LIFT = 20, PLANE_CEIL = 300;
function updatePlane(v, dt) {
  const up = !ui && key('KeyW', 'ArrowUp'), down = !ui && key('KeyS', 'ArrowDown');
  const left = !ui && key('KeyA', 'ArrowLeft'), right = !ui && key('KeyD', 'ArrowRight');
  const climb = !ui && key('Space'), desc = !ui && key('ShiftLeft', 'ShiftRight', 'KeyX', 'KeyC');
  const gy = groundAt(v.pos.x, v.pos.z), alt = v.pos.y - gy, air = alt > 0.3, fuel = wardrobe.fuel > 0;
  if (up && fuel) v.speed = Math.min(PLANE_MAX, v.speed + 9 * (1 - v.speed / (PLANE_MAX * 1.15)) * dt);
  else if (down) v.speed = Math.max(0, v.speed - (air ? 6 : 14) * dt);
  else v.speed = Math.max(0, v.speed - (air ? 0.5 : 2.5) * dt);
  const lift = v.speed >= PLANE_LIFT;
  const tvy = climb && lift && fuel ? 10 : desc ? -10 : air && !lift ? -7 : 0;
  v.vy = lerp(v.vy || 0, tvy, Math.min(1, dt * 2.2));
  v.pos.y = Math.min(gy + PLANE_CEIL, v.pos.y + v.vy * dt);
  if (v.pos.y <= gy) {
    if ((v.vy || 0) < -8) { Sound.crash(12); shake = 0.4; v.speed *= 0.5; toast('Twarde lądowanie!', 'bad', 1800); }
    v.pos.y = gy; v.vy = 0;
  }
  const steerIn = (left ? 1 : 0) - (right ? 1 : 0);
  v.steer = lerp(v.steer || 0, steerIn, Math.min(1, dt * 3));
  v.heading += v.steer * (air ? 0.75 : 1.1 * Math.min(1, v.speed / 6)) * dt;
  const fx = Math.sin(v.heading), fz = Math.cos(v.heading), pox = v.pos.x, poz = v.pos.z;
  v.pos.x += fx * v.speed * dt; v.pos.z += fz * v.speed * dt;
  if (!air && vehicleWater(v, pox, poz, { x: fx, z: fz })) v.speed *= 0.25;
  // kolizje: tylko budynki wyższe niż samolot (na ziemi także drzewa, latarnie itd.)
  let hit = 0;
  for (const off of [2.2, -2.2]) {
    const p = { x: v.pos.x + fx * off, z: v.pos.z + fz * off }, ox = p.x, oz = p.z;
    if (pushOut(p, 1.5, nearCols, v.pos.y + 0.3)) { v.pos.x += p.x - ox; v.pos.z += p.z - oz; hit = Math.max(hit, Math.hypot(p.x - ox, p.z - oz)); }
  }
  if (hit > 0.05 && v.speed > 8) { Sound.crash(v.speed); shake = Math.min(0.6, v.speed / 60); v.speed *= 0.35; if (air) toast('Uwaga na budynki — wznieś się wyżej (Spacja)!', 'bad', 1800); }
  v.pos.x = clamp(v.pos.x, -BOUND, BOUND); v.pos.z = clamp(v.pos.z, -BOUND, BOUND);
  // paliwo (oszczędnie), bez nitro
  if (v.speed > 0.5 && wardrobe.fuel > 0) {
    wardrobe.fuel = Math.max(0, wardrobe.fuel - v.speed * dt / FUEL_RANGE_M * 0.5);
    fuelSaveT -= dt; if (fuelSaveT <= 0) { fuelSaveT = 3; persistWardrobe(); }
    if (wardrobe.fuel <= 0 && !fuelEmptyWarned) { fuelEmptyWarned = true; toast(`⛽ Skończyło się paliwo — samolot szybuje w dół. Zatankuj w sklepie (B) za ${fmtMoney(FUEL_PRICE)}.`, 'bad', 6000); }
  }
  nitroActive = false;
  // poza: przechył w zakręcie, nos w górę przy wznoszeniu, kręcące się śmigło
  v.mesh.position.copy(v.pos);
  v.mesh.rotation.y = v.heading;
  v.mesh.rotation.z = air ? -v.steer * 0.55 : 0;
  v.mesh.rotation.x = air ? clamp(-(v.vy || 0) * 0.035, -0.35, 0.35) : 0;
  const prop = v.mesh.userData.prop; if (prop) prop.rotation.z += (6 + v.speed * 0.9 + (up ? 25 : 0)) * dt;
  Sound.engine(true, v.speed * 0.45, up);
}

// ---------------------------------------------------------------- niewidzialność
// Kupowana raz w sklepie ($3000), włączana / wyłączana klawiszem I lub w Ustawieniach. Policja nie widzi gracza
// (brak pościgów, trwający pościg się kończy); postać gracza staje się półprzezroczysta.
const hasInvis = () => !!wardrobe.owned.invis;
const invisibleOn = () => hasInvis() && !wardrobe.invisOff;
const ghostMat = personMat.clone(); ghostMat.transparent = true; ghostMat.opacity = 0.38; ghostMat.depthWrite = false;
function applyGhost() {
  const on = invisibleOn();
  player.g.traverse(o => { if (o.isMesh && (o.material === personMat || o.material === ghostMat)) o.material = on ? ghostMat : personMat; });
  if (P.car) ghostVehicle(P.car, on);
}
// Pojazd, którym jedzie niewidzialny gracz, też jest półprzezroczysty (po wyjściu wraca do normy).
// Oryginalny materiał każdej części zapamiętany w userData; płomienie nitro (addytywne) bez zmian.
function ghostOf(base) {
  if (base === vcMat) return ghostMat;
  if (!base.userData.ghost) {
    const gm = base.clone(); gm.transparent = true; gm.opacity = Math.min(gm.opacity, 0.38); gm.depthWrite = false;
    if (base.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) { gm.onBeforeCompile = base.onBeforeCompile; gm.customProgramCacheKey = () => 'ghost_' + base.customProgramCacheKey(); }
    base.userData.ghost = gm;
  }
  return base.userData.ghost;
}
function ghostVehicle(v, on) {
  v.ghost = on;
  v.mesh.traverse(o => {
    if (!(o.isMesh || o.isSprite) || !o.material) return;
    const base = o.userData.origMat || o.material;
    if (!Array.isArray(base) && base.blending === THREE.AdditiveBlending) return;
    if (!on) { if (o.userData.origMat) { o.material = o.userData.origMat; delete o.userData.origMat; } return; }
    o.userData.origMat = base;
    o.material = Array.isArray(base) ? base.map(ghostOf) : ghostOf(base);
  });
}
function toggleInvis(force) {
  if (!hasInvis()) { toast('👻 Niewidzialność kupisz w sklepie (B) za $3000.'); return; }
  wardrobe.invisOff = force != null ? !force : !wardrobe.invisOff; persistWardrobe();
  applyGhost();
  toast(invisibleOn() ? '👻 Niewidzialność włączona — policja Cię nie widzi.' : '👻 Niewidzialność wyłączona.', invisibleOn() ? 'good' : '', 3000);
  if (ui === 'shop') renderShop();
}

// ---------------------------------------------------------------- nitro i paliwo
// Nitro (kupowane w sklepie): w pojeździe Shift + gaz → przyspieszenie do 300 km/h, płomienie
// z wydechu. Ładunek NITRO_SEC sekund, odnawia się w NITRO_RECHARGE s.
// Paliwo (wardrobe.fuel 0…1): ubywa z przejechanym dystansem — pełny bak = FUEL_RANGE_M metrów
// (hulajnoga i motor oszczędniej, nitro 4× szybciej). Pusty bak → brak gazu (auto tylko się toczy).
// Tankowanie do pełna w sklepie za FUEL_PRICE.
const NITRO_MAX = 300 / 3.6, NITRO_ACC = 55, NITRO_SEC = 6, NITRO_RECHARGE = 15;
const FUEL_RANGE_M = 6000, FUEL_PRICE = 500;
let nitroCharge = 1, nitroActive = false, fuelSaveT = 0, fuelWarned = false, fuelEmptyWarned = false;
const hasNitro = () => !!wardrobe.owned.nitro;
const fuelMult = v => (v.type === 'kscooter' || v.type === 'scooter' ? 0.35 : v.type === 'moto' ? 0.7 : 1);
function buyFuel() {
  if (wardrobe.fuel >= 0.995) return;
  if (save.money < FUEL_PRICE) { Sound.wrong(); toast(`Tankowanie kosztuje ${fmtMoney(FUEL_PRICE)} — zrób misję albo porozmawiaj z mieszkańcami.`, 'bad'); return; }
  save.money -= FUEL_PRICE; persist();
  wardrobe.fuel = 1; persistWardrobe();
  fuelWarned = fuelEmptyWarned = false;
  Sound.passed(); toast('⛽ Bak pełny! Szerokiej drogi.', 'good', 3200);
  renderShop();
}
// Wołane w updateCar przed fizyką: zwraca, czy gaz działa, i czy nitro jest aktywne.
function fuelAndNitro(v, dt, up) {
  const wantNitro = hasNitro() && !ui && up && key('ShiftLeft', 'ShiftRight') && wardrobe.fuel > 0;
  nitroActive = wantNitro && nitroCharge > 0;
  if (nitroActive) nitroCharge = Math.max(0, nitroCharge - dt / NITRO_SEC);
  else if (!wantNitro) nitroCharge = Math.min(1, nitroCharge + dt / NITRO_RECHARGE);
  const used = Math.abs(v.speed) * dt / FUEL_RANGE_M * fuelMult(v) * (nitroActive ? 4 : 1);
  if (used > 0 && wardrobe.fuel > 0) {
    wardrobe.fuel = Math.max(0, wardrobe.fuel - used);
    fuelSaveT -= dt; if (fuelSaveT <= 0) { fuelSaveT = 3; persistWardrobe(); }
    if (wardrobe.fuel < 0.15 && !fuelWarned) { fuelWarned = true; toast(`⛽ Mało paliwa (${Math.round(wardrobe.fuel * 100)}%) — zatankuj w sklepie (B) za ${fmtMoney(FUEL_PRICE)}.`, 'bad', 4500); }
    if (wardrobe.fuel <= 0) { persistWardrobe(); if (!fuelEmptyWarned) { fuelEmptyWarned = true; toast(`⛽ Skończyło się paliwo! Zatankuj w sklepie (B) — pełny bak ${fmtMoney(FUEL_PRICE)}.`, 'bad', 6000); } }
  }
  updateFlames(v, dt);
  return wardrobe.fuel > 0;
}
// Płomienie z wydechu: dwa stożki (pomarańczowy + niebiesko-biały rdzeń), migoczące.
const flameOuterGeo = new THREE.ConeGeometry(0.17, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(-Math.PI / 2);
const flameInnerGeo = new THREE.ConeGeometry(0.09, 1, 8, 1, true).translate(0, 0.5, 0).rotateX(-Math.PI / 2);
const flameOuterMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const flameInnerMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
function updateFlames(v, dt) {
  if (!v.flames) {
    if (!nitroActive) return;
    const two = !!(v.spec && v.spec.ride), grp = new THREE.Group();
    const back = -(v.len || 4.5) / 2 - 0.05, y = two ? 0.42 : 0.4;
    for (const x of two ? [0.12] : [-0.45, 0.45]) {
      const o = new THREE.Mesh(flameOuterGeo, flameOuterMat), i = new THREE.Mesh(flameInnerGeo, flameInnerMat);
      o.position.set(x, y, back); i.position.set(x, y, back);
      grp.add(o, i);
    }
    v.mesh.add(grp); v.flames = grp;
  }
  v.flames.visible = nitroActive;
  if (nitroActive) v.flames.children.forEach((m, k) => {
    const s = (k % 2 ? 0.8 : 1.3) * (0.75 + Math.random() * 0.5);
    m.scale.set(1 + Math.random() * 0.2, 1 + Math.random() * 0.2, s * (1 + Math.min(1, Math.abs(v.speed) / 40)));
  });
}
function updateFuelHud() {
  const el = $('fuelhud'); if (!el) return;
  const pct = Math.round(wardrobe.fuel * 100);
  $('fuel-fill').style.width = pct + '%';
  $('fuel-fill').style.background = pct < 15 ? '#ff4d4d' : pct < 35 ? '#f2b632' : '#45d483';
  $('fuel-pct').textContent = pct + '%';
  const nb = $('nitrohud');
  nb.hidden = !hasNitro();
  if (hasNitro()) { $('nitro-fill').style.width = Math.round(nitroCharge * 100) + '%'; nb.classList.toggle('on', nitroActive); }
}

// ---------------------------------------------------------------- pościg policji
// Wyzwalacz (w pojeździe): potrącenie pieszego albo jazda > 100 km/h przez ponad 1,2 s.
// Niewidzialność (sklep) i lot samolotem — policja nie widzi gracza.
// Radiowóz rusza ~70 m za graczem — syrena i migające światła. Dogonił → mandat −$500
// i kontrola: pytanie po polsku, odpowiedź wpisywana po angielsku (POLICE_STEPS w npc-talks.js).
// Ucieczka: ponad 170 m od radiowozu przez 6 s. Po pościgu 25 s spokoju.
const SPEED_LIMIT_KMH = 100, POLICE_FINE = 500, CHASE_ESCAPE_M = 170;
let chase = null, chaseCooldown = 0, overSpeedT = 0, police = null;
function chaseHud(html) {
  let el = $('chase-hud');
  if (!el) {
    el = document.createElement('div'); el.id = 'chase-hud';
    el.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;padding:8px 16px;border-radius:8px;font:700 18px "Barlow Condensed",sans-serif;letter-spacing:.04em;color:#fff;background:linear-gradient(90deg,rgba(200,20,30,.92),rgba(30,60,200,.92));box-shadow:0 4px 16px rgba(0,0,0,.4);pointer-events:none;text-align:center;max-width:92vw';
    document.body.appendChild(el);
  }
  el.hidden = !html; if (html) el.innerHTML = html;
}
function triggerPolice(why) {
  if (chase || police || chaseCooldown > 0 || ui) return;
  if (invisibleOn() || (P.car && P.car.spec && P.car.spec.fly)) return;   // policja nas nie widzi
  const from = P.car ? P.car.pos : P.pos, f = P.car ? carFwd(P.car) : { x: Math.sin(P.facing), z: Math.cos(P.facing) };
  const p = { x: clamp(from.x - f.x * 70, -BOUND + 5, BOUND - 5), z: clamp(from.z - f.z * 70, -BOUND + 5, BOUND - 5) };
  const near = colliders.filter(b => p.x > b.x0 - 8 && p.x < b.x1 + 8 && p.z > b.z0 - 8 && p.z < b.z1 + 8);
  for (let k = 0; k < 4; k++) pushOut(p, 1.6, near);
  const v = spawnVehicle('police', carColor('police'), p.x, p.z, Math.atan2(from.x - p.x, from.z - p.z), 'police');
  v.pos.y = groundAt(p.x, p.z); v.mesh.position.copy(v.pos);
  // migający „kogut" na dachu (nad stałym paskiem z geometrii radiowozu)
  const red = new THREE.Mesh(BOX(0.54, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2030 }));
  const blue = new THREE.Mesh(BOX(0.54, 0.2, 0.3), new THREE.MeshBasicMaterial({ color: 0x2060ff }));
  red.position.set(-0.3, 1.76, -0.4); blue.position.set(0.3, 1.76, -0.4);
  v.mesh.add(red, blue);
  chase = { v, why, red, blue, far: 0, stuckT: 0, ghost: 0, near: [], nearT: 0 };
  overSpeedT = 0;
  Sound.siren(true);
  toast(why === 'ped' ? '🚨 Potrąciłeś pieszego! Policja rusza w pościg!' : `🚨 Przekroczyłeś ${SPEED_LIMIT_KMH} km/h! Policja rusza w pościg!`, 'bad', 4000);
}
function endChase() {
  if (chase) {
    const v = chase.v;
    scene.remove(v.mesh);
    const k = vehicles.indexOf(v); if (k >= 0) vehicles.splice(k, 1);
  }
  chase = null; chaseCooldown = 25; overSpeedT = 0;
  Sound.siren(false); chaseHud('');
}
function updateChase(dt) {
  if (chaseCooldown > 0 && !chase && !police) chaseCooldown -= dt;
  if (!chase) return;
  if (invisibleOn() || (P.car && P.car.spec && P.car.spec.fly && P.car.pos.y - groundAt(P.car.pos.x, P.car.pos.z) > 6)) {
    endChase(); chaseCooldown = 10;
    toast(invisibleOn() ? '👻 Jesteś niewidzialny — policja straciła Cię z oczu.' : '✈️ Odleciałeś — policja straciła Cię z oczu.', 'good', 3500);
    return;
  }
  const c = chase, v = c.v, tgt = P.car ? P.car.pos : P.pos;
  const ph = Math.floor(elapsed * 6) % 2;
  c.red.material.color.setHex(ph ? 0xff2030 : 0x3a0608); c.blue.material.color.setHex(ph ? 0x0c1230 : 0x2060ff);
  let dx = tgt.x - v.pos.x, dz = tgt.z - v.pos.z, d = Math.hypot(dx, dz);
  Sound.sirenLevel(Math.max(0, 1 - d / 260));
  if (ui) { v.speed = 0; chaseHud(''); return; }        // misja / sklep / mapa — pościg wstrzymany
  // jazda: skręt w stronę gracza, zwalnia w zakrętach i blisko celu
  const want = Math.atan2(dx, dz);
  v.heading += clamp(angDiff(v.heading, want), -2.2 * dt, 2.2 * dt);
  const align = Math.cos(angDiff(v.heading, want));
  const target = (d > 40 ? 34 : d > 15 ? 22 : 12) * Math.max(0.35, align);
  v.speed += clamp(target - v.speed, -30 * dt, 16 * dt);
  const fw = carFwd(v), x0 = v.pos.x, z0 = v.pos.z;
  v.pos.x += fw.x * v.speed * dt; v.pos.z += fw.z * v.speed * dt;
  c.nearT -= dt;
  if (c.nearT <= 0) { c.nearT = 0.3; c.near = colliders.filter(b => v.pos.x > b.x0 - 30 && v.pos.x < b.x1 + 30 && v.pos.z > b.z0 - 30 && v.pos.z < b.z1 + 30); }
  if (c.ghost > 0) c.ghost -= dt;                       // po utknięciu chwilę „przenika" przeszkody
  else for (const off of [v.spec.off, -v.spec.off]) {
    const p = { x: v.pos.x + fw.x * off, z: v.pos.z + fw.z * off }, ox = p.x, oz = p.z;
    pushOut(p, v.spec.rad, c.near);
    v.pos.x += p.x - ox; v.pos.z += p.z - oz;
  }
  const moved = Math.hypot(v.pos.x - x0, v.pos.z - z0);
  if (d > 15 && moved < 2 * dt) { c.stuckT += dt; if (c.stuckT > 1.2) { c.ghost = 1.2; c.stuckT = 0; } } else c.stuckT = 0;
  v.pos.x = clamp(v.pos.x, -BOUND, BOUND); v.pos.z = clamp(v.pos.z, -BOUND, BOUND);
  v.pos.y = lerp(v.pos.y, groundAt(v.pos.x, v.pos.z), Math.min(1, dt * 12));
  v.mesh.visible = true;
  poseCar(v, dt);
  dx = tgt.x - v.pos.x; dz = tgt.z - v.pos.z; d = Math.hypot(dx, dz);
  chaseHud(`🚨 POŚCIG POLICJI · ${Math.round(d)} m <span style="font-weight:600;opacity:.85">— oddal się na ${CHASE_ESCAPE_M} m albo się zatrzymaj</span>`);
  if (d > CHASE_ESCAPE_M) {
    c.far += dt;
    if (c.far > 6) { endChase(); toast('😮‍💨 Zgubiłeś pościg! Następnym razem jedź wolniej.', 'good', 3800); return; }
  } else c.far = 0;
  const pSpeed = P.car ? Math.abs(P.car.speed) : P.speed;
  if (d < (P.car ? 5.5 : 3.2) && (pSpeed < 7 || d < 3.6)) arrestPlayer();
}
function arrestPlayer() {
  if (!chase) return;
  if (P.car) { P.car.speed = 0; P.car.steer = 0; }
  chase.v.speed = 0;
  const fine = Math.min(save.money, POLICE_FINE);
  save.money -= fine; persist();
  Sound.siren(false); Sound.wrong();
  chaseHud('');
  openPoliceTalk(chase.why, fine);
}
// Kontrola drogowa: policjant pyta po polsku, gracz wpisuje odpowiedź po angielsku.
function openPoliceTalk(why, fine) {
  ui = 'police'; keys.clear(); releaseLock(); setPrompt('');
  const pool = (window.POLICE_STEPS || []).filter(s => s.why === why || s.why === 'any');
  const step = pool[Math.floor(Math.random() * pool.length)];
  police = { step, wrong: 0, fine, done: !step };
  qCard.innerHTML = `
    <div class="card-head">
      <div class="eyebrow"><span class="chip" style="background:#d62839">POLICJA</span>Kontrola drogowa · ${why === 'ped' ? 'potrącenie pieszego' : 'przekroczenie prędkości'}</div>
      <h2 class="place">Officer Smith</h2>
      <div class="meta" style="color:#ff7b7b">Mandat: −${fmtMoney(fine)}${fine < POLICE_FINE ? ' (tyle było w portfelu)' : ''}</div>
    </div>
    <div class="card-body">
      <div class="npc">
        <div class="npc-avatar" style="background:#1e3a8a">🚓</div>
        <div>
          <div class="npc-name">Policjant mówi (po polsku):</div>
          <p class="story talk-q">„${esc(step ? step.pl : 'Proszę jechać ostrożnie.')}”</p>
          <div class="meta">Odpowiedz <b>po angielsku</b> — wpisz całe zdanie. Musisz odpowiedzieć poprawnie, żeby odjechać.</div>
        </div>
      </div>
      <form class="typebox" id="pol-form" autocomplete="off" style="margin-top:16px">
        <input id="pol-in" type="text" spellcheck="false" autocapitalize="off" placeholder="Napisz po angielsku…" aria-label="Twoja odpowiedź po angielsku">
        <button class="btn" type="submit" id="pol-send">Odpowiedz</button>
      </form>
      <div id="pol-fb"></div>
      <div class="actions"><button class="btn ghost" id="pol-hint" type="button">💡 Podpowiedź</button><span class="meta">Enter — odpowiedz</span></div>
    </div>`;
  $('quiz-ov').hidden = false;
  const inp = $('pol-in');
  $('pol-form').onsubmit = e => { e.preventDefault(); if (police.done) closePolice(); else if (inp.value.trim()) answerPolice(inp.value); };
  $('pol-hint').onclick = () => { const fb = $('pol-fb'); fb.className = 'feedback'; fb.innerHTML = `💡 Zacznij tak: <b>${esc(step.hint)}</b>`; inp.focus(); };
  setTimeout(() => inp.focus(), 30);
}
function answerPolice(val) {
  const s = police.step, fb = $('pol-fb'), inp = $('pol-in');
  if (window.NPC_CHECK(s, val)) {
    police.done = true; inp.readOnly = true; inp.classList.add('correct');
    fb.className = 'feedback ok';
    fb.innerHTML = '<b>Dobrze!</b> Policjant: „<i>OK. Drive carefully next time!</i>” <span class="meta">(Dobrze. Następnym razem jedź ostrożnie!)</span>';
    $('pol-send').textContent = 'Wróć do miasta';
    Sound.correct(); sayEN('OK. Drive carefully next time!');
    return;
  }
  police.wrong++;
  Sound.wrong(); inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 600);
  fb.className = 'feedback no';
  fb.innerHTML = police.wrong >= 2
    ? `Przykładowa odpowiedź: <b>${esc(s.ex)}</b><br>Przepisz ją lub napisz własną, podobną.`
    : `Spróbuj jeszcze raz — pełnym zdaniem po angielsku. Podpowiedź: <b>${esc(s.hint)}</b>`;
}
function closePolice() {
  police = null; ui = null; $('quiz-ov').hidden = true; canvas.focus();
  try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  endChase();
  toast(`Mandat zapłacony. Pamiętaj: w mieście limit to ${SPEED_LIMIT_KMH} km/h!`, '', 3800);
}

// ---------------------------------------------------------------- traffic update
function updateTraffic(dt) {
  const focus = P.car ? P.car.pos : P.pos;
  for (const v of vehicles) {
    const a = v.ai; if (!a) continue;
    const fx = a.real ? Math.sin(v.heading) : a.axis === 'x' ? a.dir : 0, fz = a.real ? Math.cos(v.heading) : a.axis === 'z' ? a.dir : 0;
    let ahead = Infinity, byPlayer = false;
    const look = (ox, oz, isP) => {
      const rx = ox - v.pos.x, rz = oz - v.pos.z, al = rx * fx + rz * fz;
      if (al <= 0 || al > 16) return;
      if (Math.abs(rx * fz - rz * fx) < 2.4 && al < ahead) { ahead = al; byPlayer = isP; }
    };
    if (a.ghost <= 0) for (const o of vehicles) if (o !== v && !(o.spec && o.spec.fly && o.pos.y > 2)) look(o.pos.x, o.pos.z, o === P.car);
    if (!P.car) look(P.pos.x, P.pos.z, true);
    else if (a.ghost > 0) look(P.car.pos.x, P.car.pos.z, true);
    let target = a.real ? a.vmax : 11.5;
    if (ahead < 16) target = ahead < 6.5 ? 0 : target * (ahead - 6.5) / 9.5;
    if (!a.real && a.plan.t === 'turn' && Math.abs(a.along - a.turnAt) < 12) target = Math.min(target, 6.5);
    if (season() === 'winter') target *= 0.8;
    v.speed = target < v.speed ? Math.max(target, v.speed - 20 * dt) : Math.min(target, v.speed + 5 * dt);
    if (v.speed < 0.3 && target === 0) {
      a.stuck += dt;
      if (byPlayer && a.stuck > 1.6 && v.honk <= 0 && Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z) < 45) { Sound.horn(); v.honk = 4; }
      if (!byPlayer && a.stuck > 2.5) { a.ghost = 2.5; a.stuck = 0; }
    } else a.stuck = 0;
    a.ghost -= dt; v.honk -= dt;
    if (a.real) {
      advanceRealCar(v, a, dt);
      // auta daleko od gracza wracają w jego okolicę (gęsty ruch tam, gdzie gracz jest)
      a.recycle -= dt;
      if (a.recycle <= 0) { a.recycle = 2; if (Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z) > 330 && placeRealCar(a, focus.x, focus.z)) { const [x, z, hd] = realCarPos(a); v.pos.set(x, 0, z); v.heading = hd; } }
      const farR = Math.abs(v.pos.x - focus.x) > 220 || Math.abs(v.pos.z - focus.z) > 220;
      v.mesh.visible = !farR;
      if (!farR) poseCar(v, dt);
      continue;
    }
    // Metropolia: auta daleko od gracza przenoszone w jego okolicę (poza zasięg wzroku) — gęsty ruch tam, gdzie gracz jest
    if (METRO) {
      a.recycle = (a.recycle == null ? 2 * rand() : a.recycle) - dt;
      if (a.recycle <= 0) { a.recycle = 2; if (Math.hypot(v.pos.x - focus.x, v.pos.z - focus.z) > 330) recycleGridCar(v, a, focus.x, focus.z); }
    }
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
    // Metropolia: piesi daleko od gracza przechodzą na chodnik kwartału w jego okolicy (poza zasięgiem wzroku)
    if (METRO && far && !q.path && q.knock <= 0 && (q.rec = (q.rec == null ? 3 * rand() : q.rec) - dt) <= 0) {
      q.rec = 3;
      const bx = clamp(gridIdx(fx) + Math.floor(rand() * 5) - 3, 0, N - 1), bz = clamp(gridIdx(fz) + Math.floor(rand() * 5) - 3, 0, N - 1);
      const nx = bx0(bx), nz = bx0(bz);
      if (Math.abs(nx + B / 2 - fx) > 110 || Math.abs(nz + B / 2 - fz) > 110) { q.x0 = nx + 2.6; q.z0 = nz + 2.6; }
      continue;
    }
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
    q.p.g.position.set(nx + q.ox, PAVE_Y + q.y, nz + q.oz);
  }
}

// ---------------------------------------------------------------- camera
function camBlocked(x, y, z) {
  for (const b of nearCols) if (y < b.h && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && (!b.rings || polyInside(x, z, b.rings))) return true;
  return false;
}
let attractT = 0;
function updateCamera(dt) {
  if (ui === 'start') {
    attractT += dt;
    if (REALMAP) {
      const [cx, cz] = WD.pkin, [R, H, LY] = MAPDEF.orbit;
      camera.position.set(cx + Math.sin(attractT * 0.05) * R, H + Math.sin(attractT * 0.1) * H * 0.1, cz + Math.cos(attractT * 0.05) * R);
      camera.lookAt(cx, LY, cz);
      return;
    }
    const cx = bc(3 + O), cz = bx0(3 + O) + 30;
    camera.position.set(cx + Math.sin(attractT * 0.06) * 95, 48 + Math.sin(attractT * 0.1) * 8, cz + Math.cos(attractT * 0.06) * 95);
    camera.lookAt(cx, 8, cz);
    return;
  }
  const v = P.car;
  const t = v ? tmpV.set(v.pos.x, v.pos.y + 1.6, v.pos.z) : tmpV.set(P.pos.x, P.pos.y + 1.7, P.pos.z);
  if (v && performance.now() - lastMouse > 1300 && Math.abs(v.speed) > 1.5) {
    // w drifcie kamera podąża za kierunkiem jazdy, nie za maską — widać auto bokiem, jak tył ucieka
    const slipA = v.slip ? Math.atan2(v.slip, Math.abs(v.speed)) * Math.sign(v.speed) : 0;
    camYaw += angDiff(camYaw, v.heading + slipA * 0.6 + Math.PI) * Math.min(1, dt * (v.drift ? 2.0 : 2.6));
    camPitch = lerp(camPitch, 0.22 - (v.drift || 0) * 0.05, Math.min(1, dt));
  }
  if (!v && touchMode && P.speed > 1 && performance.now() - lastMouse > 1200) {
    // follow unless the player runs back towards the camera
    const toward = -(Math.sin(P.facing) * -Math.sin(camYaw) + Math.cos(P.facing) * -Math.cos(camYaw));
    if (toward < 0.4) camYaw += angDiff(camYaw, P.facing + Math.PI) * Math.min(1, dt * 1.6);
  }
  const want = v ? (v.spec && v.spec.fly ? 17 + Math.abs(v.speed) * 0.08 : 10.5 + Math.abs(v.speed) * 0.06) : 6.5;
  camDist = lerp(camDist, want, Math.min(1, dt * 3));
  const cp = Math.cos(camPitch), dx = Math.sin(camYaw) * cp, dy = Math.sin(camPitch), dz = Math.cos(camYaw) * cp;
  let d = camDist;
  for (let s = 1; s <= camDist; s += 0.35) {
    if (camBlocked(t.x + dx * s, t.y + dy * s, t.z + dz * s)) { d = Math.max(1.2, s - 0.5); break; }
  }
  camera.position.set(t.x + dx * d, Math.max(t.y + dy * d, 0.6), t.z + dz * d);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.5); }
  if (indoor) camera.position.y = Math.min(camera.position.y, ROOM_H - 0.35);
  camera.lookAt(t);
  const fovT = v ? 62 + Math.min(14, Math.abs(v.speed) * 0.35) : 62;
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov = lerp(camera.fov, fovT, Math.min(1, dt * 3)); camera.updateProjectionMatrix(); }
}

// ---------------------------------------------------------------- day / night
const DAY_LEN = 720;
let tod = 0.36;
const lampOff = new THREE.Color(0xd0d0d0), lampOn = new THREE.Color(0xffd98a);
let nightK = 0;
// Pory dnia (jak w grach z otwartym światem): kolory nieba, słońca, światła z nieba i ziemi, mgły, ekspozycja, bloom.
// Między nimi płynne przejście wg wysokości słońca (cykl DAY_LEN).
const SKY_PRESETS = {
  noon:   { sun: '#fff6e8', sunI: 3.4, hemiS: '#c4dcf5', hemiG: '#6b6a5c', hemiI: 0.85, top: '#3474d0', hor: '#c9def2', gnd: '#6d6c63', fog: '#c3d6ea', exp: 0.9, stars: 0, cloud: 0.45, cloudCol: '#ffffff', bloom: 0.25 },
  golden: { sun: '#ffcf9a', sunI: 3.1, hemiS: '#b9cde6', hemiG: '#6a5844', hemiI: 0.75, top: '#4f7fc4', hor: '#f2c79b', gnd: '#6f6252', fog: '#d9bfa2', exp: 0.95, stars: 0, cloud: 0.55, cloudCol: '#fff1e2', bloom: 0.35 },
  dusk:   { sun: '#ff8a52', sunI: 1.5, hemiS: '#6a75a8', hemiG: '#3a3038', hemiI: 0.55, top: '#26345f', hor: '#ee8a5c', gnd: '#3b3436', fog: '#8a6b78', exp: 1.05, stars: 0.25, cloud: 0.6, cloudCol: '#ffb08a', bloom: 0.6 },
  night:  { sun: '#9fb6ff', sunI: 0.42, hemiS: '#33467a', hemiG: '#12121a', hemiI: 0.48, top: '#030714', hor: '#1d2440', gnd: '#0b0c10', fog: '#111729', exp: 1.35, stars: 1, cloud: 0.3, cloudCol: '#3a4260', bloom: 0.68 },
};
const _sc1 = new THREE.Color(), _sc2 = new THREE.Color(), _skyP = {};
function mixPreset(A, B, t) {
  for (const k in B) {
    const a = A[k], b = B[k];
    _skyP[k] = typeof b === 'number' ? lerp(a, b, t) : '#' + _sc1.set(a).lerp(_sc2.set(b), t).getHexString();
  }
  return _skyP;
}
function skyPreset(elev) {
  const S = SKY_PRESETS;
  if (elev >= 0.7) return mixPreset(S.noon, S.noon, 0);
  if (elev >= 0.22) return mixPreset(S.golden, S.noon, smooth(0.22, 0.7, elev));
  if (elev >= 0) return mixPreset(S.dusk, S.golden, smooth(0, 0.22, elev));
  return mixPreset(S.dusk, S.night, smooth(0, -0.16, elev));
}
const _sunDir = new THREE.Vector3(), _skyDir = new THREE.Vector3(), _shA = new THREE.Vector3(), _shB = new THREE.Vector3();
let envKey = null, fogBase = null;
function updateSky(dt, focus) {
  tod = (tod + dt / DAY_LEN) % 1;
  const ang = (tod - 0.25) * Math.PI * 2, elev = Math.sin(ang);
  const day = smooth(-0.14, 0.28, elev);
  const P = skyPreset(elev), moon = elev < -0.04;
  // kierunek ciała niebieskiego na niebie (nocą księżyc po przeciwnej stronie) i kierunek światła (min. wysokość — cienie)
  _skyDir.set(moon ? -Math.cos(ang) : Math.cos(ang), moon ? -elev : elev, 0.42).normalize();
  _sunDir.set(_skyDir.x, Math.max(0.28, Math.abs(_skyDir.y)), _skyDir.z).normalize();
  sun.color.set(P.sun); sun.intensity = P.sunI;
  hemi.color.set(P.hemiS); hemi.groundColor.set(P.hemiG); hemi.intensity = P.hemiI;
  renderer.toneMappingExposure = P.exp;
  bloomPass.strength = P.bloom;
  gradePass.uniforms.uWarm.value = 1 - (1 - day) * 0.6;
  scene.fog.color.set(P.fog);
  if (!fogBase) fogBase = [scene.fog.near, scene.fog.far];         // zasięg mgły ustawiony przez mapę (przy budowie świata)
  scene.fog.near = fogBase[0] * (0.75 + 0.25 * day); scene.fog.far = fogBase[1] * (0.75 + 0.25 * day);
  for (const m of [skyMat, envSkyMat]) {
    const u = m.uniforms;
    u.uTop.value.set(P.top); u.uHor.value.set(P.hor); u.uGnd.value.set(P.gnd); u.uSunDir.value.copy(_skyDir); u.uSunCol.value.set(P.sun);
    u.uCloudCol.value.set(P.cloudCol); u.uStars.value = P.stars; u.uCloud.value = P.cloud; u.uMoon.value = moon ? 1 : 0;
  }
  skyMat.uniforms.uTime.value += dt;
  skyDome.position.copy(camera.position);
  // mapa otoczenia: przeliczana co ~1/24 wysokości słońca (kilka razy na minutę gry)
  const key = Math.round(elev * 24);
  if (key !== envKey) {
    envKey = key;
    envGround.material.color.set(P.gnd).lerp(_sc1.set('#3a3c40'), 0.5);
    envCityMat.map = envCityTex[day < 0.5 ? 1 : 0];
    envCityMat.color.set(day < 0.5 ? '#ffffff' : P.hor).lerp(_sc2.set('#ffffff'), day < 0.5 ? 0 : 0.55);
    rebuildEnvMap();
  }
  // cień podąża za graczem, przyciągany do siatki tekseli mapy cieni (bez migotania krawędzi)
  const texel = 2 * SHADOW_R / SHADOW_RES;
  const ax = _shA.set(0, 1, 0).cross(_sunDir).normalize(), ay = _shB.crossVectors(_sunDir, ax).normalize();
  const px = ax.x * focus.x + ax.z * focus.z, py = ay.x * focus.x + ay.z * focus.z;
  const ox = Math.round(px / texel) * texel - px, oy = Math.round(py / texel) * texel - py;
  sun.target.position.set(focus.x, 0, focus.z).addScaledVector(ax, ox).addScaledVector(ay, oy);
  sun.position.copy(sun.target.position).addScaledVector(_sunDir, 400);
  sun.target.updateMatrixWorld();
  const night = 1 - day;
  for (const m of winMats) m.emissiveIntensity = night * (m.userData.emi || 0.95);
  lampHeadMat.emissiveIntensity = night * 4; glowPoolMat.opacity = night * 0.9;
  nightK = night;
  if (window.GCCars) GCCars.setNight(smooth(0.35, 0.85, night));
  const h = Math.floor(tod * 24), mnt = Math.floor((tod * 24 - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(mnt).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- tryby hulajnogi i wheelie
// Hulajnoga: Eco 20 km/h, S 45 km/h, R 100 km/h (klawisz G / przycisk TRYB, także w Ustawieniach sklepu).
const SCOOTER_MODES = { E: { label: 'Eco', kmh: 20, acc: 5 }, S: { label: 'Sport', kmh: 45, acc: 9 }, R: { label: 'Wyścig', kmh: 100, acc: 15 } };
const isScooterType = t => t === 'kscooter' || t === 'scooter';
function cycleScooterMode() { const k = ['E', 'S', 'R'], i = k.indexOf(wardrobe.smode); setScooterMode(k[(i + 1) % 3]); Sound.click(); }
// Willibary (kupowane w sklepie): Q na hulajnodze / motorze — przód w górę, co 3 s +$5 (max $50 za jedno wheelie).
const hasWheelie = () => !!wardrobe.owned.wheelie;
let wheelieT = 0, wheeliePaid = 0;
const wheelieAngle = v => (v.wheelie || 0) * (v.spec && v.spec.ride === 'moto' ? 0.5 : 0.42);
function updateWheelie(v, dt) {
  if (!isTwoWheel(v.type)) return;
  const want = hasWheelie() && !ui && key('KeyQ') && v.speed > 2.5;
  v.wheelie = lerp(v.wheelie || 0, want ? 1 : 0, Math.min(1, dt * (want ? 4 : 7)));
  if (want && v.wheelie > 0.8) {
    wheelieT += dt;
    if (wheelieT >= (wheeliePaid + 1) * 3 && wheeliePaid < 10) { wheeliePaid++; save.money += 5; persist(); toast(`🤸 Wheelie ${wheelieT.toFixed(1).replace('.', ',')} s · +$5`, 'good', 1400); }
  } else if (!want) {
    if (wheelieT > 2) { save.wheelieBest = Math.max(save.wheelieBest || 0, wheelieT); persist(); toast(`Wheelie: ${wheelieT.toFixed(1).replace('.', ',')} s (rekord ${save.wheelieBest.toFixed(1).replace('.', ',')} s)`, '', 2200); }
    wheelieT = 0; wheeliePaid = 0;
  }
}

// ---------------------------------------------------------------- pory roku
// Pora roku zmienia się co 3 dni gry (3 × DAY_LEN = 36 min); na starcie losowa (test: ?season=winter).
// Wiosna — kwitnące różowo drzewa · Lato — zielone · Jesień — pomarańczowe i żółte + grzyby w lesie ·
// Zima — białe drzewa i ziemia, śnieg, ślisko na jezdni, kolorowe lampki na domach i drzewach.
const SEASONS = [
  { id: 'spring', name: 'Wiosna', ico: '🌸', sub: 'Drzewa kwitną na różowo' },
  { id: 'summer', name: 'Lato', ico: '☀️', sub: 'Ciepło i zielono — idealnie na ryby 🎣' },
  { id: 'autumn', name: 'Jesień', ico: '🍂', sub: 'W lesie rosną grzyby — zbieraj je 🍄' },
  { id: 'winter', name: 'Zima', ico: '❄️', sub: 'Ślisko na jezdni — hamuj wcześniej! Na domach świąteczne lampki 🎄' },
];
const SEASON_DAYS = 3, SEASON_LEN = SEASON_DAYS * DAY_LEN;
let seasonIdx = (() => { const q = new URLSearchParams(location.search).get('season'), i = SEASONS.findIndex(s => s.id === q); return i >= 0 ? i : Math.floor(Math.random() * 4); })();
let seasonT = 0;
const season = () => SEASONS[seasonIdx].id;
const SEASON_TREE = {
  spring: [0x8cc56a, 0xf2a7c3, 0x9bd07a, 0xf7c4d8, 0xe991b5, 0xa6d47e],
  summer: [0x4f8a3a, 0x3f7a32, 0x5d9a40, 0x6b8f2f, 0x2f6b3a],
  autumn: [0xe8892b, 0xf2b632, 0xd9662a, 0xe0a422, 0xc4501f, 0xf0c419, 0xb5651d],
  winter: [0xf4f7fa, 0xe8eef3, 0xdde6ee, 0xffffff],
};
const snowTexBase = canvasTex(noiseCanvas(256, '#e9eff5', 12, 11), true);
let seasonMatList = null;
function collectSeasonMats() {
  const kind = m => {
    if (!m || !m.isMaterial) return null;
    const t = m.map, src = t && (t.__src || t);
    if (src === grassTex || src === parkGrassTex) return 'grass';
    if (src === asphaltTex) return 'road';
    if (src === sidewalkTex) return 'pave';
    if (m === roofMat || m.userData.tile) return 'roof';
    if (m.userData.water) return 'water';
    return null;
  };
  const seen = new Set(), out = [];
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (seen.has(m)) continue; seen.add(m);
      const k = kind(m); if (!k) continue;
      m.userData.c0 = m.color.getHex(); m.userData.e0 = m.emissive ? m.emissive.getHex() : 0; m.userData.map0 = m.map;
      out.push({ m, k });
    }
  });
  return out;
}
function applySeason(announce) {
  const s = season();
  if (treeCrowns) {
    const pal = SEASON_TREE[s], col = new THREE.Color();
    for (const ch of treeChunks) {
      ch.idx.forEach((i, k) => {
        const r = treeRnd[i];
        let hex = pal[Math.floor(r * 997) % pal.length];
        if (s === 'autumn' && r < 0.12) hex = SEASON_TREE.summer[Math.floor(r * 400) % 5];   // nieliczne zielone
        col.setHex(hex); ch.hi.setColorAt(k, col); ch.lo.setColorAt(k, col);
      });
      ch.hi.instanceColor.needsUpdate = ch.lo.instanceColor.needsUpdate = true;
    }
    treeLodT = 0;   // kwitnienie wiosną — przy najbliższej aktualizacji LOD
  }
  if (!seasonMatList) seasonMatList = collectSeasonMats();
  const W = s === 'winter';
  for (const { m, k } of seasonMatList) {
    m.color.setHex(m.userData.c0); if (m.emissive) m.emissive.setHex(m.userData.e0);
    if (k === 'grass') {
      if (W) { if (!m.userData.snow) { const t = snowTexBase.clone(); t.needsUpdate = true; t.repeat.copy(m.userData.map0.repeat); m.userData.snow = t; } m.map = m.userData.snow; }
      else { m.map = m.userData.map0; if (s === 'autumn') m.color.setHex(0xd0ae62); else if (s === 'spring') m.color.setHex(0xf2ffe6); }
    } else if (k === 'road' && W) m.emissive.setHex(0x161c24);
    else if (k === 'pave' && W) m.emissive.setHex(0x3c4146);
    else if (k === 'roof' && W) m.color.setHex(0xeef3f8);
    else if (k === 'water' && W) m.color.setHex(0xd2e8f5);
  }
  if (W) buildXmasLights();
  if (xmas) xmas.visible = W;
  if (snowPts) snowPts.visible = W && !indoor;
  for (const mu of mushrooms) mu.g.visible = s === 'autumn' && mu.alive;
  if (announce) { const se = SEASONS[seasonIdx]; showBanner(`${se.ico} ${se.name.toUpperCase()}`, se.sub, W ? '#bfe6ff' : s === 'autumn' ? '#f0a43a' : s === 'spring' ? '#f48fb1' : '#45d483', 4200); }
}
function updateSeason(dt) {
  seasonT += dt;
  if (seasonT >= SEASON_LEN) {
    seasonT -= SEASON_LEN; seasonIdx = (seasonIdx + 1) % 4; applySeason(true);
    respawnGems(); setTimeout(() => toast('💎 Nowe diamenty ukryły się w domach i opuszczonych budynkach!', 'good', 4500), 2500);
  }
}
const seasonDay = () => Math.min(SEASON_DAYS, Math.floor(seasonT / DAY_LEN) + 1);

// Zima: kolorowe lampki świąteczne na domach i drzewach (4 kolory, migotanie przez zmianę jasności materiału).
let xmas = null;
const XMAS_COLS = [0xff3b3b, 0x3bff6b, 0x4f8bff, 0xffd23b];
function buildXmasLights() {
  if (xmas) return;
  const pts = [[], [], [], []];
  let k = 0;
  const add = (x, y, z) => { pts[k++ % 4].push(x, y, z); };
  // drzewa: spirala żarówek wokół korony (co drugie drzewo, max ~14 tys.)
  const TMAX = 14000;
  treeSpots.forEach(([x, z, s], i) => {
    if (treeRnd[i] > 0.55 || k > TMAX) return;
    const cy = groundAt(x, z) + 3.9 * s, R = 1.95 * s;
    for (let j = 0; j < 7; j++) {
      const ph = -0.45 + j * 0.17, a = j * 2.3 + treeRnd[i] * 6;
      add(x + Math.cos(a) * Math.cos(ph) * R, cy + Math.sin(ph) * R, z + Math.sin(a) * Math.cos(ph) * R);
    }
  });
  // domy: girlanda wzdłuż ścian (mapa z danych — obrysy, Grammar City — prostokąty budynków)
  const edges = [];
  let per = 0;
  for (const c of colliders) {
    if (c.rings) {
      if (c.h < 3 || c.tower) continue;
      const r = c.rings[0], y = Math.min(c.h - 0.4, 6);
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) { const L = Math.hypot(r[i] - r[j], r[i + 1] - r[j + 1]); edges.push([r[j], r[j + 1], r[i], r[i + 1], y, c]); per += L; }
    } else if (c.x1 - c.x0 > 5 && c.z1 - c.z0 > 5 && c.h >= 3.5) {
      const y = Math.min(c.h - 0.3, 5.5), { x0, x1, z0, z1 } = c;
      for (const e of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) { edges.push([...e, y, null]); per += Math.hypot(e[2] - e[0], e[3] - e[1]); }
    }
  }
  const step = Math.max(1.3, per / 15000);
  for (const [ax, az, bx, bz, y, c] of edges) {
    const L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
    let nx = (bz - az) / L, nz = -(bx - ax) / L;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (c && polyInside(mx + nx * 0.5, mz + nz * 0.5, c.rings)) { nx = -nx; nz = -nz; }   // prostokąty: obrys zgodny z ruchem wskazówek — normalne już na zewnątrz
    for (let t = step / 2; t < L; t += step) {
      const sag = 0.22 * Math.abs(Math.sin(t / 2.6 * Math.PI));
      add(ax + (bx - ax) * t / L + nx * 0.15, y - sag + PAVE_Y, az + (bz - az) * t / L + nz * 0.15);
    }
  }
  xmas = new THREE.Group();
  const bulb = new THREE.OctahedronGeometry(0.15, 0), d = new THREE.Object3D();
  pts.forEach((P3, ci) => {
    const n = P3.length / 3; if (!n) return;
    const im = new THREE.InstancedMesh(bulb, new THREE.MeshBasicMaterial({ color: XMAS_COLS[ci] }), n);
    for (let i = 0; i < n; i++) { d.position.set(P3[i * 3], P3[i * 3 + 1], P3[i * 3 + 2]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
    im.frustumCulled = false; im.userData.base = new THREE.Color(XMAS_COLS[ci]);
    xmas.add(im);
  });
  scene.add(xmas);
}
function twinkleXmas() {
  if (!xmas || !xmas.visible) return;
  xmas.children.forEach((im, i) => { const k = 0.5 + 0.5 * Math.max(0, Math.sin(elapsed * 2.6 + i * 1.7)); im.material.color.copy(im.userData.base).multiplyScalar(0.35 + 0.75 * k); });
}
// Zima: padający śnieg wokół kamery.
const SNOW_N = 1500;
let snowPts = null;
const flakeTex = (() => { const c = makeCanvas(32, 32), x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return canvasTex(c, false); })();
function buildSnow() {
  const p = new Float32Array(SNOW_N * 3);
  for (let i = 0; i < SNOW_N; i++) { p[i * 3] = rr(-45, 45); p[i * 3 + 1] = Math.random() * 40; p[i * 3 + 2] = rr(-45, 45); }
  const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.BufferAttribute(p, 3));
  snowPts = new THREE.Points(geom, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, map: flakeTex, transparent: true, opacity: 0.95, depthWrite: false }));
  snowPts.frustumCulled = false; snowPts.visible = false; scene.add(snowPts);
}
function updateSnow(dt) {
  if (!snowPts || !snowPts.visible) return;
  const a = snowPts.geometry.attributes.position, p = a.array;
  for (let i = 0; i < SNOW_N; i++) {
    p[i * 3 + 1] -= (1.4 + (i % 7) * 0.15) * dt; p[i * 3] += Math.sin(elapsed * 0.8 + i) * 0.4 * dt;
    if (p[i * 3 + 1] < 0) p[i * 3 + 1] += 40;
  }
  a.needsUpdate = true;
  snowPts.position.set(camera.position.x, Math.max(0, camera.position.y - 22), camera.position.z);
}

// ---------------------------------------------------------------- grzyby (jesień)
// Rosną przy drzewach w zalesionych miejscach; zbiera się je, przechodząc obok (pieszo). +$20, po 90 s odrastają gdzie indziej.
const mushrooms = [], MUSH_N = 45, MUSH_REWARD = 20;
let mushCand = null;
function mushroomGeo(cap) {
  return geo('mush_' + cap, () => mergeColored([
    { g: new THREE.CylinderGeometry(0.08, 0.1, 0.24, 8), m: partMatrix(0, 0.12, 0), c: new THREE.Color(0xf3ead8) },
    { g: new THREE.SphereGeometry(0.22, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m: partMatrix(0, 0.22, 0, 0, 1, 0.8, 1), c: new THREE.Color(cap) },
    ...(cap === 0xd23a2a ? [[0.1, 0.05], [-0.08, 0.1], [0.02, -0.12], [-0.12, -0.04]].map(([x, z]) => ({ g: new THREE.SphereGeometry(0.035, 6, 4), m: partMatrix(x, 0.36 - Math.hypot(x, z) * 0.5, z), c: new THREE.Color(0xffffff) })) : []),
  ]));
}
function blockedAt(x, z, r = 0.6) {
  if (Math.abs(x) > BOUND - 3 || Math.abs(z) > BOUND - 3) return true;
  if (waterHit(x, z, r)) return true;
  for (const c of colliders) {
    if (x < c.x0 - r || x > c.x1 + r || z < c.z0 - r || z > c.z1 + r) continue;
    if (!c.rings || polyInside(x, z, c.rings)) return true;
  }
  return false;
}
function mushroomCandidates() {
  // drzewa, które mają w promieniu 14 m co najmniej 4 inne drzewa (las / park)
  const cell = 14, grid = new Map(), key2 = (i, j) => i * 100003 + j;
  treeSpots.forEach(([x, z], i) => { const k = key2(Math.floor(x / cell), Math.floor(z / cell)); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  const out = [];
  treeSpots.forEach(([x, z], i) => {
    if (Math.abs(x) > BOUND - 6 || Math.abs(z) > BOUND - 6) return;
    let n = 0; const ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const t of grid.get(key2(ci + a, cj + b)) || []) if (t !== i && Math.hypot(treeSpots[t][0] - x, treeSpots[t][1] - z) < 14) n++;
    if (n >= 4) out.push(i);
  });
  return out;
}
function placeMushroom(mu) {
  for (let tries = 0; tries < 30; tries++) {
    const [tx, tz] = treeSpots[mushCand[Math.floor(Math.random() * mushCand.length)]];
    const a = Math.random() * Math.PI * 2, d = 1.3 + Math.random() * 1.8, x = tx + Math.cos(a) * d, z = tz + Math.sin(a) * d;
    if (blockedAt(x, z) || mushrooms.some(o => o !== mu && o.alive && Math.hypot(o.x - x, o.z - z) < 6)) continue;
    mu.x = x; mu.z = z; mu.g.position.set(x, groundAt(x, z), z); mu.g.rotation.y = Math.random() * 6; mu.alive = true;
    mu.g.visible = season() === 'autumn';
    return true;
  }
  return false;
}
function buildMushrooms() {
  mushCand = mushroomCandidates();
  if (!mushCand.length) return;
  for (let i = 0; i < MUSH_N; i++) {
    const cap = i % 3 === 0 ? 0xd23a2a : i % 3 === 1 ? 0x8a5a2b : 0xb07a3c;
    const g2 = new THREE.Mesh(mushroomGeo(cap), vcMat); g2.scale.setScalar(1.5); g2.castShadow = true;
    scene.add(g2);
    const mu = { g: g2, x: 0, z: 0, alive: false, t: 0 };
    mushrooms.push(mu);
    if (!placeMushroom(mu)) g2.visible = false;
  }
}
function updateMushrooms(dt) {
  if (season() !== 'autumn') return;
  for (const mu of mushrooms) {
    if (!mu.alive) { mu.t -= dt; if (mu.t <= 0) placeMushroom(mu); continue; }
    if (P.car || ui) continue;
    if (Math.abs(mu.x - P.pos.x) < 1.6 && Math.abs(mu.z - P.pos.z) < 1.6 && Math.hypot(mu.x - P.pos.x, mu.z - P.pos.z) < 1.4) {
      mu.alive = false; mu.g.visible = false; mu.t = 90;
      save.money += MUSH_REWARD; save.mushrooms = (save.mushrooms || 0) + 1; persist();
      Sound.click();
      toast(`🍄 Grzyb — <b>a mushroom</b>! +${fmtMoney(MUSH_REWARD)} · zebrane: ${save.mushrooms}`, 'good', 2400);
    }
  }
}

// ---------------------------------------------------------------- łowienie ryb (każda pora roku)
// Pomosty nad wodą (Grammar City: staw w lesie na wschód od miasta; mapy z danych: brzegi wód).
// Zarzuć wędkę, poczekaj na branie i zatnij w porę — nazwa ryby po angielsku z lektorem.
const fishSpots = [];
const FISH = [
  { en: 'roach', pl: 'płoć', ico: '🐟', val: 15, w: 26, kg: [0.1, 0.5] },
  { en: 'perch', pl: 'okoń', ico: '🐟', val: 20, w: 22, kg: [0.1, 0.8] },
  { en: 'crucian carp', pl: 'karaś', ico: '🐟', val: 20, w: 14, kg: [0.2, 0.9], noWinter: true },
  { en: 'bream', pl: 'leszcz', ico: '🐟', val: 25, w: 14, kg: [0.5, 2.5] },
  { en: 'tench', pl: 'lin', ico: '🐟', val: 35, w: 9, kg: [0.4, 2], noWinter: true },
  { en: 'carp', pl: 'karp', ico: '🐠', val: 40, w: 10, kg: [1, 9], noWinter: true },
  { en: 'trout', pl: 'pstrąg', ico: '🐠', val: 50, w: 6, kg: [0.4, 3] },
  { en: 'zander', pl: 'sandacz', ico: '🐠', val: 55, w: 5, kg: [1, 6] },
  { en: 'pike', pl: 'szczupak', ico: '🐟', val: 60, w: 6, kg: [1, 10] },
  { en: 'burbot', pl: 'miętus', ico: '🐟', val: 45, w: 8, kg: [0.5, 3], winterOnly: true },
  { en: 'eel', pl: 'węgorz', ico: '🐍', val: 70, w: 3, kg: [0.5, 3], noWinter: true },
  { en: 'catfish', pl: 'sum', ico: '🐟', val: 90, w: 2, kg: [5, 40], noWinter: true },
  { en: 'an old boot', pl: 'stary but', ico: '🥾', val: 0, w: 5, junk: true },
  { en: 'a tin can', pl: 'puszka', ico: '🥫', val: 0, w: 4, junk: true },
];
let fishing = null, nearFish = null;
function buildFishSpotsReal() {
  // brzegi wód: krawędzie trójkątów wody występujące tylko raz; pomost 1,6 m od brzegu po stronie lądu
  const L = WD.water; if (!L || !L.f || !L.f.length) return;
  const cnt = new Map(), opp = new Map(), ek = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
  for (let t = 0; t < L.f.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = L.f[t + k], b = L.f[t + (k + 1) % 3], c = L.f[t + (k + 2) % 3], key3 = ek(a, b);
    cnt.set(key3, (cnt.get(key3) || 0) + 1); opp.set(key3, [a, b, c]);
  }
  const cands = [];
  for (const [key3, n] of cnt) {
    if (n !== 1) continue;
    const [a, b, c] = opp.get(key3), ax = L.v[a * 2], az = L.v[a * 2 + 1], bx = L.v[b * 2], bz = L.v[b * 2 + 1], cx = L.v[c * 2], cz = L.v[c * 2 + 1];
    const len = Math.hypot(bx - ax, bz - az); if (len < 2.5) continue;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let nx = (bz - az) / len, nz = -(bx - ax) / len;
    if (nx * (cx - mx) + nz * (cz - mz) > 0) { nx = -nx; nz = -nz; }        // na zewnątrz wody (od trzeciego wierzchołka)
    const x = mx + nx * 1.6, z = mz + nz * 1.6;
    if (blockedAt(x, z, 1)) continue;
    cands.push({ x, z, wx: mx - nx * 3, wz: mz - nz * 3, len });
  }
  cands.sort((p, q) => q.len - p.len);
  for (const c of cands) { if (fishSpots.length >= 10) break; if (fishSpots.every(s => Math.hypot(s.x - c.x, s.z - c.z) > 45)) fishSpots.push(c); }
}
function fishTexture() {
  const c = makeCanvas(128, 128), x = c.getContext('2d');
  x.fillStyle = 'rgba(10,12,18,.8)'; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill();
  x.lineWidth = 6; x.strokeStyle = '#4fb3ff'; x.stroke();
  x.font = '64px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🎣', 64, 68);
  return canvasTex(c, false);
}
function buildFishSpots() {
  if (REALMAP) buildFishSpotsReal();
  const tex = fishTexture(), sm = new THREE.SpriteMaterial({ map: tex, depthTest: true });
  for (const s of fishSpots) {
    const a = Math.atan2(s.wx - s.x, s.wz - s.z), y = groundAt(s.x, s.z);
    // pomost z desek w stronę wody
    const fx = Math.sin(a), fz = Math.cos(a);
    addStatic(new THREE.BoxGeometry(1.5, 0.12, 3.2), 0x8a5a33, s.x + fx * 1.2, y + 0.16, s.z + fz * 1.2, a);
    for (const [ox, oz] of [[-0.6, 2.6], [0.6, 2.6]]) addStatic(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), 0x5a3a1e, s.x + fx * oz + fz * ox, y - 0.2, s.z + fz * oz - fx * ox);
    const sp = new THREE.Sprite(sm); sp.scale.set(1.3, 1.3, 1); sp.position.set(s.x, y + 2.4, s.z); scene.add(sp);
    s.sprite = sp; s.a = a;
  }
  const st = staticParts.length ? new THREE.Mesh(mergeColored(staticParts), vcMat) : null;
  if (st) { st.castShadow = st.receiveShadow = true; st.frustumCulled = false; scene.add(st); staticParts.length = 0; }
}
function checkFishSpots() {
  nearFish = null;
  if (P.car) return;
  for (const s of fishSpots) if (Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < 3.2) { nearFish = s; break; }
}
function pickFish() {
  const W = season() === 'winter';
  const pool = FISH.filter(f => (W ? !f.noWinter : !f.winterOnly));
  let r = Math.random() * pool.reduce((a, f) => a + f.w, 0);
  for (const f of pool) { r -= f.w; if (r <= 0) return f; }
  return pool[0];
}
function openFishing(s) {
  ui = 'fish'; keys.clear(); releaseLock(); setPrompt('');
  P.facing = s.a; player.g.rotation.y = s.a;
  fishing = { s, stage: 'cast', t: 0, timer: 0 };
  $('quiz-ov').hidden = false; renderFishing();
}
function renderFishing(res) {
  const f = fishing, W = season() === 'winter';
  const head = `<div class="card-head"><div class="eyebrow"><span class="chip" style="background:#4fb3ff">🎣</span>${W ? 'Łowienie w przeręblu' : 'Łowienie ryb'} · złowione: ${save.fish || 0}</div>`;
  let body = '';
  if (f.stage === 'cast') body = `${head}<div class="result-title" style="color:#4fb3ff">GONE FISHING</div><div class="meta">Zarzuć wędkę i czekaj na branie. Gdy spławik zanurkuje — zatnij od razu!</div></div>
    <div class="card-body"><div class="fish-water">〰️ 〰️ 〰️</div><div class="actions"><button class="btn" id="f-act">🎣 Zarzuć wędkę</button><button class="btn ghost" id="f-close">Wróć</button></div><p class="meta"><kbd>Spacja</kbd> / <kbd>Enter</kbd> — akcja · Esc — wyjście</p></div>`;
  else if (f.stage === 'wait') body = `${head}<div class="result-title" style="color:#9fb3c8">CZEKAJ…</div><div class="meta">Spławik kołysze się na wodzie. Nie zacinaj za wcześnie!</div></div>
    <div class="card-body"><div class="fish-water bob">〰️ 🔴 〰️</div><div class="actions"><button class="btn ghost" id="f-act">Zatnij</button><button class="btn ghost" id="f-close">Wróć</button></div></div>`;
  else if (f.stage === 'bite') body = `${head}<div class="result-title" style="color:#f2b632">BIERZE! ZATNIJ!</div><div class="meta">Szybko — Spacja, Enter albo przycisk!</div></div>
    <div class="card-body"><div class="fish-water bite">💦 🔴 💦</div><div class="actions"><button class="btn" id="f-act">⚡ ZATNIJ!</button></div></div>`;
  else if (f.stage === 'result') {
    const r = res || f.res;
    f.res = r;
    body = r.fish ? `${head}<div class="result-title" style="color:${r.fish.junk ? '#9fb3c8' : 'var(--green)'}">${r.fish.junk ? 'OOPS!' : 'YOU CAUGHT IT!'}</div></div>
      <div class="card-body"><div class="fish-catch">${r.fish.ico}</div>
      <div class="fish-name">You caught ${r.fish.junk ? '' : 'a '}<b>${esc(r.fish.en)}</b>${r.kg ? ` · ${r.kg.toFixed(1).replace('.', ',')} kg` : ''}</div>
      <div class="meta" style="text-align:center">po polsku: ${esc(r.fish.pl)}${r.fish.junk ? ' — to nie ryba 😅' : ''}</div>
      <div class="stats"><div class="stat"><b style="color:var(--cash)">+${fmtMoney(r.money)}</b><span>Nagroda</span></div><div class="stat"><b>+${r.xp}</b><span>XP</span></div><div class="stat"><b>${save.fish || 0}</b><span>Złowione ryby</span></div></div>
      <div class="actions"><button class="btn" id="f-act">🎣 Łów dalej</button><button class="btn ghost" id="f-say">🔊 Posłuchaj</button><button class="btn ghost" id="f-close">Wróć</button></div></div>`
      : `${head}<div class="result-title" style="color:var(--red)">${r.early ? 'ZA WCZEŚNIE!' : 'UCIEKŁA!'}</div><div class="meta">${r.early ? 'Zaciąłeś, zanim ryba wzięła — spłoszyła się.' : 'Ryba zerwała się z haczyka. Zacinaj szybciej!'}</div></div>
      <div class="card-body"><div class="fish-water">〰️ 〰️ 〰️</div><div class="actions"><button class="btn" id="f-act">🎣 Spróbuj jeszcze raz</button><button class="btn ghost" id="f-close">Wróć</button></div></div>`;
  }
  qCard.innerHTML = body;
  $('f-act').onclick = fishAction;
  if ($('f-close')) $('f-close').onclick = closeFishing;
  if ($('f-say')) $('f-say').onclick = () => sayEN(f.res.fish.en);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // klawisze obsługuje keydown — bez podwójnego kliknięcia
}
function fishAction() {
  const f = fishing; if (!f) return;
  if (f.stage === 'cast' || f.stage === 'result') { f.stage = 'wait'; f.timer = 2 + Math.random() * 4.5; Sound.click(); renderFishing(); return; }
  if (f.stage === 'wait') { Sound.wrong(); f.stage = 'result'; renderFishing({ early: true }); return; }
  if (f.stage === 'bite') {
    const fish = pickFish(), kg = fish.kg ? rr(fish.kg[0], fish.kg[1]) : 0;
    const money = fish.junk ? 0 : Math.round(fish.val * (0.8 + kg / (fish.kg[1] || 1) * 0.6)), xp = fish.junk ? 1 : 5;
    save.money += money; save.xp += xp; if (!fish.junk) save.fish = (save.fish || 0) + 1; persist();
    fish.junk ? Sound.wrong() : Sound.passed();
    f.stage = 'result'; renderFishing({ fish, kg, money, xp });
    sayEN(fish.junk ? fish.en : 'a ' + fish.en);
  }
}
function updateFishing(dt) {
  const f = fishing; if (!f) return;
  if (f.stage === 'wait') { f.timer -= dt; if (f.timer <= 0) { f.stage = 'bite'; f.timer = 1.15; Sound.click(); renderFishing(); } }
  else if (f.stage === 'bite') { f.timer -= dt; if (f.timer <= 0) { Sound.wrong(); f.stage = 'result'; renderFishing({ early: false }); } }
}
function closeFishing() {
  fishing = null; ui = null; $('quiz-ov').hidden = true; canvas.focus();
}

// ---------------------------------------------------------------- siatka kolizji (zwierzęta)
let colGrid = null;
const COLG = 16;
function colsAt(x, z) {
  if (!colGrid) {
    colGrid = new Map();
    for (const c of colliders) {
      for (let i = Math.floor((c.x0 - 1) / COLG); i <= Math.floor((c.x1 + 1) / COLG); i++)
        for (let j = Math.floor((c.z0 - 1) / COLG); j <= Math.floor((c.z1 + 1) / COLG); j++) {
          const k = i * 4099 + j; (colGrid.get(k) || colGrid.set(k, []).get(k)).push(c);
        }
    }
  }
  return colGrid.get(Math.floor(x / COLG) * 4099 + Math.floor(z / COLG)) || [];
}

// ---------------------------------------------------------------- zwierzęta
// Dzikie (dziki, sarny, jelenie, łosie, lisy, wilki) w lasach i przy drzewach; oswojone (koty, psy) przy domach.
// Pierwsze spotkanie gatunku = odkrycie: nazwa po angielsku z lektorem, +$10 (save.zoo). Dzikie uciekają przed graczem
// i pojazdami; kota i psa można pogłaskać (T / E) — pies przez chwilę chodzi za graczem.
const ANIMALS = {
  boar:  { pl: 'dzik', en: 'a wild boar', ico: '🐗', L: 1.25, H: 0.55, W: 0.48, leg: 0.36, c: 0x4a3b30, c2: 0x2b221c, speed: 1.6, run: 6.5, shy: 8 },
  roe:   { pl: 'sarna', en: 'a roe deer', ico: '🦌', L: 1.0, H: 0.4, W: 0.3, leg: 0.6, c: 0xa0703c, c2: 0xf2e6d0, speed: 1.3, run: 8.5, shy: 15 },
  deer:  { pl: 'jeleń', en: 'a red deer', ico: '🦌', L: 1.55, H: 0.6, W: 0.44, leg: 0.85, c: 0x7b4a2a, c2: 0xe8d8c0, antler: 'deer', speed: 1.4, run: 8.5, shy: 15 },
  moose: { pl: 'łoś', en: 'a moose', ico: '🫎', L: 2.1, H: 0.9, W: 0.66, leg: 1.1, c: 0x3d2b1f, c2: 0x24180f, antler: 'moose', speed: 1.1, run: 6, shy: 10 },
  fox:   { pl: 'lis', en: 'a fox', ico: '🦊', L: 0.62, H: 0.27, W: 0.21, leg: 0.27, c: 0xd8642a, c2: 0xf5f0e8, tail: 'bushy', speed: 1.5, run: 7.5, shy: 11 },
  wolf:  { pl: 'wilk', en: 'a wolf', ico: '🐺', L: 1.1, H: 0.42, W: 0.3, leg: 0.52, c: 0x8a8d90, c2: 0xd8d8d8, tail: 'bushy', speed: 1.7, run: 8, shy: 13 },
  cat:   { pl: 'kot', en: 'a cat', ico: '🐱', L: 0.42, H: 0.2, W: 0.16, leg: 0.17, cs: [0xe08a3c, 0x222222, 0x9a9a9a, 0xf2f2f2, 0x6b4a2f], speed: 0.8, run: 5, pet: true, ears: 'cat' },
  dog:   { pl: 'pies', en: 'a dog', ico: '🐶', L: 0.72, H: 0.32, W: 0.25, leg: 0.34, cs: [0x8a5a2b, 0x1e1e1e, 0xd9b35b, 0xf2efe8, 0x6e6e6e], speed: 1.3, run: 5.5, pet: true, ears: 'dog' },
};
const ANIMAL_KEYS = Object.keys(ANIMALS);
const animals = [];
function animalGeo(kind, color) {
  const s = ANIMALS[kind], c = color, c2 = s.c2 != null ? s.c2 : 0xf2efe8;
  return geo(`an_${kind}_${color}`, () => {
    const P = [], B = (w, h, d, x, y, z, col, rx = 0) => P.push({ g: new THREE.BoxGeometry(w, h, d), m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1)), c: new THREE.Color(col) });
    const { L, H, W, leg } = s, by = leg + H / 2;
    B(W, H, L, 0, by, 0, c);                                                       // tułów
    const tall = kind === 'deer' || kind === 'roe' || kind === 'moose';
    const hx = 0, hy = tall ? by + H * 0.9 : by + H * 0.25, hz = L / 2 + (tall ? L * 0.1 : L * 0.12);
    if (tall) B(W * 0.45, H * 1.1, W * 0.5, 0, by + H * 0.5, L / 2 - W * 0.1, c, -0.5);   // szyja
    const hw = W * (kind === 'moose' ? 0.7 : 0.75), hh = H * (kind === 'cat' ? 0.85 : 0.7), hd = L * (kind === 'cat' ? 0.32 : 0.28);
    B(hw, hh, hd, hx, hy, hz, c);                                                   // głowa
    const snoutL = kind === 'cat' ? 0.04 : kind === 'moose' ? hd * 0.9 : hd * 0.6;
    B(hw * 0.6, hh * 0.55, snoutL, hx, hy - hh * 0.15, hz + hd / 2 + snoutL / 2, kind === 'boar' ? 0x5a463a : kind === 'fox' || kind === 'wolf' ? c2 : c);
    B(hw * 0.25, hh * 0.22, 0.03, hx, hy - hh * 0.05, hz + hd / 2 + snoutL + 0.01, 0x111111);   // nos
    for (const sx of [-1, 1]) B(0.035, 0.035, 0.02, sx * hw * 0.32, hy + hh * 0.15, hz + hd / 2 + 0.01, 0x111111);   // oczy
    // uszy
    const ew = kind === 'cat' ? 0.06 : hw * 0.28, eh = kind === 'dog' ? hh * 0.5 : kind === 'fox' || kind === 'wolf' || kind === 'cat' ? hh * 0.55 : hh * 0.45;
    for (const sx of [-1, 1]) {
      if (kind === 'dog') B(ew, eh, 0.04, sx * (hw / 2 + 0.01), hy + hh * 0.05, hz - hd * 0.1, c === 0xf2efe8 ? 0x8a5a2b : c);
      else B(ew, eh, 0.04, sx * hw * 0.32, hy + hh / 2 + eh / 2 - 0.02, hz - hd * 0.15, kind === 'fox' ? 0x2b1a12 : c);
    }
    // ogon
    if (s.tail === 'bushy') { B(W * 0.32, W * 0.32, L * 0.55, 0, by + H * 0.05, -L / 2 - L * 0.24, c, 0.5); B(W * 0.3, W * 0.3, L * 0.14, 0, by - H * 0.25, -L / 2 - L * 0.5, c2, 0.5); }
    else if (kind === 'cat') B(0.04, 0.04, L * 0.7, 0, by + H * 0.55, -L / 2 - L * 0.22, c, -0.9);
    else if (kind === 'dog') B(0.06, 0.06, L * 0.35, 0, by + H * 0.4, -L / 2 - L * 0.12, c, -0.7);
    else B(W * 0.25, W * 0.2, 0.12, 0, by + H * 0.3, -L / 2 - 0.05, kind === 'roe' || kind === 'deer' ? c2 : c);
    if (kind === 'roe' || kind === 'deer') B(W * 0.7, H * 0.6, 0.04, 0, by + H * 0.05, -L / 2 - 0.01, c2);   // białe lustro
    // poroże
    const ay = hy + hh / 2;
    if (s.antler === 'deer') for (const sx of [-1, 1]) {
      B(0.05, 0.55, 0.05, sx * 0.14, ay + 0.26, hz - 0.05, 0xd9c7a3, -0.2);
      B(0.04, 0.3, 0.04, sx * 0.22, ay + 0.42, hz + 0.05, 0xd9c7a3, 0.5);
      B(0.04, 0.28, 0.04, sx * 0.1, ay + 0.55, hz - 0.12, 0xd9c7a3, -0.5);
    }
    if (s.antler === 'moose') for (const sx of [-1, 1]) {
      B(0.06, 0.18, 0.06, sx * 0.2, ay + 0.08, hz - 0.05, 0xc9b48a);
      B(0.55, 0.06, 0.38, sx * 0.48, ay + 0.2, hz - 0.08, 0xc9b48a);
      for (let k = 0; k < 3; k++) B(0.05, 0.16, 0.05, sx * (0.32 + k * 0.17), ay + 0.3, hz - 0.2 + k * 0.08, 0xc9b48a);
    }
    if (kind === 'moose') B(W * 0.5, H * 0.35, L * 0.35, 0, by + H * 0.6, L * 0.2, c);   // garb
    if (kind === 'boar') { for (const sx of [-1, 1]) B(0.03, 0.08, 0.03, sx * hw * 0.3, hy - hh * 0.2, hz + hd / 2 + snoutL - 0.02, 0xf2efe0); B(W * 0.25, 0.08, L * 0.7, 0, by + H / 2 + 0.03, 0, s.c2); }
    return mergeColored(P);
  });
}
function legGeo(kind, color) {
  const s = ANIMALS[kind], w = Math.max(0.05, s.W * (kind === 'moose' || kind === 'deer' || kind === 'roe' ? 0.18 : 0.26));
  return geo(`al_${kind}_${color}`, () => mergeColored([{ g: new THREE.BoxGeometry(w, s.leg + 0.02, w).translate(0, -s.leg / 2, 0), m: new THREE.Matrix4(), c: new THREE.Color(kind === 'fox' ? 0x2b1a12 : color) }]));
}
function makeAnimal(kind, x, z, home) {
  const s = ANIMALS[kind], color = s.cs ? s.cs[Math.floor(Math.random() * s.cs.length)] : s.c;
  const grp = new THREE.Group();
  const body = new THREE.Mesh(animalGeo(kind, color), vcMat); body.castShadow = true; grp.add(body);
  const legs = [];
  const lx = s.W * 0.32, lz = s.L * 0.36;
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const l = new THREE.Mesh(legGeo(kind, color), vcMat); l.position.set(sx * lx, s.leg, sz * lz); grp.add(l); legs.push(l);
  }
  const k = kind === 'boar' && home && home.small ? 0.6 : 1;
  grp.scale.setScalar(k);
  grp.position.set(x, groundAt(x, z), z);
  scene.add(grp);
  const a = { kind, s, g: grp, legs, x, z, hx: home ? home.x : x, hz: home ? home.z : z, hr: s.pet ? 7 : 26, heading: Math.random() * 6, state: 'idle', t: Math.random() * 4, tx: x, tz: z, ph: 0, spd: 0, follow: 0, r: s.L * 0.4 * k };
  animals.push(a);
  return a;
}
function spawnAnimals() {
  // dzikie: stada przy drzewach w zalesionych miejscach (Grammar City: las przy stawie i okolice miasta)
  let spots = (mushCand || []).map(i => treeSpots[i]);
  if (!REALMAP) spots = spots.concat(treeSpots.filter(([x, z]) => Math.abs(x) > HALF + 20 || Math.abs(z) > HALF + 20)).filter(([x, z]) => Math.abs(x) > HALF + 8 || Math.abs(z) > HALF + 8);
  spots = spots.filter(([x, z]) => Math.abs(x) < BOUND - 10 && Math.abs(z) < BOUND - 10 && Math.hypot(x - SPAWN.x, z - SPAWN.z) > 40);
  const GROUPS = [['roe', 3], ['roe', 2], ['roe', 2], ['deer', 2], ['deer', 1], ['boar', 4], ['boar', 3], ['fox', 1], ['fox', 1], ['fox', 1], ['wolf', 3], ['moose', 1], ['moose', 1]];
  const homes = [];
  for (const [kind, n] of GROUPS) {
    if (!spots.length) break;
    let h = null;
    for (let t = 0; t < 30; t++) {
      const [x, z] = spots[Math.floor(Math.random() * spots.length)];
      const hx = x + rr(-4, 4), hz = z + rr(-4, 4);
      if (homes.some(o => Math.hypot(o.x - hx, o.z - hz) < 45) || blockedAt(hx, hz, 1.2)) continue;
      h = { x: hx, z: hz }; break;
    }
    if (!h) continue;
    homes.push(h);
    for (let i = 0; i < n; i++) {
      const x = h.x + rr(-3, 3), z = h.z + rr(-3, 3);
      makeAnimal(kind, x, z, { x: h.x, z: h.z, small: kind === 'boar' && i > 0 });
    }
  }
  // oswojone: koty i psy przy domach
  const houses = colliders.filter(c => (c.rings ? c.h >= 3 && c.h < 40 : c.x1 - c.x0 > 5 && c.z1 - c.z0 > 5 && c.h >= 3.5 && c.h < 40));
  for (let i = 0; i < 24 && houses.length; i++) {
    for (let t = 0; t < 20; t++) {
      const c = houses[Math.floor(Math.random() * houses.length)];
      let x, z;
      if (c.rings) { const r = c.rings[0], k = Math.floor(Math.random() * (r.length / 2)) * 2, k2 = (k + 2) % r.length, u = Math.random(); const ex = r[k] + (r[k2] - r[k]) * u, ez = r[k + 1] + (r[k2 + 1] - r[k + 1]) * u, L = Math.hypot(r[k2] - r[k], r[k2 + 1] - r[k + 1]) || 1; let nx = (r[k2 + 1] - r[k + 1]) / L, nz = -(r[k2] - r[k]) / L; if (polyInside(ex + nx * 0.5, ez + nz * 0.5, c.rings)) { nx = -nx; nz = -nz; } x = ex + nx * 2.2; z = ez + nz * 2.2; }
      else { const side = Math.floor(Math.random() * 4), u = Math.random(); x = side < 2 ? c.x0 + (c.x1 - c.x0) * u : side === 2 ? c.x0 - 1.8 : c.x1 + 1.8; z = side >= 2 ? c.z0 + (c.z1 - c.z0) * u : side === 0 ? c.z0 - 1.8 : c.z1 + 1.8; }
      if (blockedAt(x, z, 0.5) || Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8) continue;
      makeAnimal(i % 2 ? 'dog' : 'cat', x, z, { x, z });
      break;
    }
  }
}
function discoverAnimal(a) {
  save.zoo = save.zoo || {};
  if (save.zoo[a.kind]) return;
  save.zoo[a.kind] = 1; save.money += 10; save.xp += 5; persist();
  const n = Object.keys(save.zoo).length;
  toast(`${a.s.ico} Odkrycie: <b>${a.s.en}</b> — ${a.s.pl} · +$10 · zwierzęta ${n}/${ANIMAL_KEYS.length}`, 'good', 4200);
  sayEN(a.s.en);
}
let nearPet = null;
const heartTex = (() => { const c = makeCanvas(64, 64), x = c.getContext('2d'); x.font = '48px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('❤️', 32, 36); return canvasTex(c, false); })();
const hearts = [];
function petAnimal(a) {
  const dog = a.kind === 'dog';
  toast(dog ? '🐶 <b>Good dog!</b> Pies merda ogonem i idzie za Tobą.' : '🐱 <b>Nice kitty!</b> Kot mruczy z zadowolenia.', 'good', 2800);
  sayEN(dog ? 'Good dog!' : 'Nice kitty!');
  if (dog) { a.state = 'follow'; a.follow = 25; }
  else { a.state = 'idle'; a.t = 4; }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false }));
  sp.scale.set(0.6, 0.6, 1); sp.position.set(a.x, groundAt(a.x, a.z) + a.s.leg + a.s.H + 0.5, a.z); scene.add(sp);
  hearts.push({ sp, t: 1.4 });
  discoverAnimal(a);
}
function updateAnimals(dt) {
  nearPet = null;
  const cx = camera.position.x, cz = camera.position.z, focus = P.car ? P.car.pos : P.pos;
  const carFast = P.car && Math.abs(P.car.speed) > 3 && P.car.pos.y < 6;
  let bestPet = 2.4;
  for (const a of animals) {
    const dc = Math.abs(a.x - cx) + Math.abs(a.z - cz);
    a.g.visible = dc < 230;
    if (dc > 260) continue;
    const s = a.s, dp = Math.hypot(a.x - focus.x, a.z - focus.z);
    if (!P.car && !ui && dp < (s.pet ? 4 : 9)) discoverAnimal(a);
    if (s.pet && !P.car && dp < bestPet && a.state !== 'flee') { bestPet = dp; nearPet = a; }
    // ucieczka przed graczem (dzikie) i przed szybkim pojazdem (wszystkie)
    const threat = carFast ? dp < (s.pet ? 7 : s.shy * 1.3) : (!s.pet && !P.car && dp < s.shy * 0.6);
    if (threat && a.state !== 'flee') {
      a.state = 'flee'; a.t = 2.2 + Math.random() * 1.5;
      const ang = Math.atan2(a.x - focus.x, a.z - focus.z) + rr(-0.5, 0.5);
      a.tx = a.x + Math.sin(ang) * 40; a.tz = a.z + Math.cos(ang) * 40;
    }
    let want = 0, gx = a.tx, gz = a.tz;
    if (a.state === 'idle') {
      a.t -= dt;
      if (a.t <= 0) { const ang = Math.random() * Math.PI * 2, d = Math.random() * a.hr; a.tx = a.hx + Math.cos(ang) * d; a.tz = a.hz + Math.sin(ang) * d; a.state = 'walk'; a.t = 12; }
    } else if (a.state === 'walk') {
      want = s.speed; a.t -= dt;
      if (Math.hypot(gx - a.x, gz - a.z) < 0.6 || a.t <= 0) { a.state = 'idle'; a.t = 2 + Math.random() * (s.pet ? 8 : 5); }
    } else if (a.state === 'flee') {
      want = s.run; a.t -= dt;
      if (a.t <= 0) { a.state = 'walk'; a.tx = a.hx + rr(-5, 5); a.tz = a.hz + rr(-5, 5); a.t = 20; }
    } else if (a.state === 'follow') {
      a.follow -= dt; gx = P.pos.x - Math.sin(P.facing) * 1.6; gz = P.pos.z - Math.cos(P.facing) * 1.6;
      const d = Math.hypot(gx - a.x, gz - a.z);
      want = P.car ? 0 : d > 6 ? s.run : d > 1.2 ? s.speed * 2.2 : 0;
      if (a.follow <= 0 || P.car) { a.state = 'idle'; a.t = 3; a.hx = a.x; a.hz = a.z; }
    }
    a.spd = lerp(a.spd, want, Math.min(1, dt * 5));
    if (a.spd > 0.05) {
      const dx = gx - a.x, dz = gz - a.z, d = Math.hypot(dx, dz) || 1;
      a.heading += angDiff(a.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 6);
      const p = { x: a.x + Math.sin(a.heading) * a.spd * dt, z: a.z + Math.cos(a.heading) * a.spd * dt };
      if (d < 0.3) { p.x = a.x; p.z = a.z; }
      pushOut(p, a.r, colsAt(p.x, p.z), 0.05);
      if (waterSlide(a.x, a.z, p, a.r) && a.state === 'walk') a.t = 0;
      if (P.car) for (const [qx, qz] of carCircles(P.car)) { const ex = p.x - qx, ez = p.z - qz, e = Math.hypot(ex, ez), lim = (P.car.spec || VSPEC.car).rad + a.r; if (e < lim && e > 1e-4) { p.x = qx + ex / e * lim; p.z = qz + ez / e * lim; } }
      a.x = clamp(p.x, -BOUND, BOUND); a.z = clamp(p.z, -BOUND, BOUND);
      if (a.state === 'flee' && Math.hypot(a.x - a.hx, a.z - a.hz) > a.hr * 3) { a.tx = a.hx; a.tz = a.hz; }
    }
    if (a.g.visible && dc < 140) {
      a.ph += a.spd * dt * (7 / Math.max(0.4, s.leg * 2));
      const sw = Math.min(0.75, a.spd * 0.18);
      a.legs.forEach((l, i) => { l.rotation.x = Math.sin(a.ph + (i === 0 || i === 3 ? 0 : Math.PI)) * sw; });
    }
    a.g.position.set(a.x, groundAt(a.x, a.z), a.z);
    a.g.rotation.y = a.heading;
  }
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i]; h.t -= dt; h.sp.position.y += dt * 0.8; h.sp.material.opacity = Math.min(1, h.t);
    if (h.t <= 0) { scene.remove(h.sp); h.sp.material.dispose(); hearts.splice(i, 1); }
  }
}

// ---------------------------------------------------------------- graf dróg (mapy z danych): ruch uliczny i GPS po drogach
// Osie dróg z danych (WD.axes) → krawędzie grafu; tylko te leżące na jezdni (trójkąty WD.roads) — bez ścieżek w parkach.
let roadGraph = null;
function buildRoadGraph() {
  const R = WD.roads, tg = new Map(), TC = 10;
  for (let t = 0; t < R.f.length; t += 3) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let k = 0; k < 3; k++) { const j = R.f[t + k] * 2, x = R.v[j], z = R.v[j + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    for (let i = Math.floor(x0 / TC); i <= Math.floor(x1 / TC); i++) for (let j = Math.floor(z0 / TC); j <= Math.floor(z1 / TC); j++) { const k = i * 4099 + j; (tg.get(k) || tg.set(k, []).get(k)).push(t); }
  }
  const onRoad = (x, z) => {
    for (const t of tg.get(Math.floor(x / TC) * 4099 + Math.floor(z / TC)) || []) {
      const a = R.f[t] * 2, b = R.f[t + 1] * 2, c = R.f[t + 2] * 2;
      const ax = R.v[a], az = R.v[a + 1], bx = R.v[b], bz = R.v[b + 1], cx = R.v[c], cz = R.v[c + 1];
      const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz), d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz), d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
      if (!(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)))) return true;
    }
    return false;
  };
  const nodes = [], nodeMap = new Map(), SN = 3;
  const nodeAt = (x, z) => {
    const i = Math.round(x / SN), j = Math.round(z / SN);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const n = nodeMap.get((i + a) * 100003 + (j + b)); if (n !== undefined && Math.hypot(nodes[n].x - x, nodes[n].z - z) < SN) return n; }
    nodes.push({ x, z, e: [] }); nodeMap.set(i * 100003 + j, nodes.length - 1); return nodes.length - 1;
  };
  const edges = [];
  // skrzyżowania typu T: koniec jednej osi leży na wierzchołku wewnątrz innej → dzielimy tę oś w tym punkcie
  const ends = new Map(), ek = (x, z) => Math.round(x / SN) * 100003 + Math.round(z / SN);
  const isEnd = (x, z) => { const i = Math.round(x / SN), j = Math.round(z / SN); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const q = ends.get((i + a) * 100003 + (j + b)); if (q && q.some(([qx, qz]) => Math.hypot(qx - x, qz - z) < SN)) return true; } return false; };
  for (const p of WD.axes) if (p.length >= 4) for (const k of [0, p.length - 2]) { const key = ek(p[k], p[k + 1]); (ends.get(key) || ends.set(key, []).get(key)).push([p[k], p[k + 1]]); }
  // koniec osi w środku odcinka innej osi (bez wierzchołka) → wstaw tam wierzchołek
  const axes = WD.axes.map(p => p.slice()), SG = 12, sgrid = new Map();
  axes.forEach((p, pi) => { for (let k = 2; k < p.length; k += 2) for (let i = Math.floor(Math.min(p[k - 2], p[k]) / SG); i <= Math.floor(Math.max(p[k - 2], p[k]) / SG); i++) for (let j = Math.floor(Math.min(p[k - 1], p[k + 1]) / SG); j <= Math.floor(Math.max(p[k - 1], p[k + 1]) / SG); j++) { const key = i * 4099 + j; (sgrid.get(key) || sgrid.set(key, []).get(key)).push([pi, k]); } });
  const ins = new Map();
  axes.forEach((p, pi) => {
    if (p.length < 4) return;
    for (const k0 of [0, p.length - 2]) {
      const x = p[k0], z = p[k0 + 1];
      for (const [qi, k] of sgrid.get(Math.floor(x / SG) * 4099 + Math.floor(z / SG)) || []) {
        if (qi === pi) continue;
        const q = axes[qi], ax = q[k - 2], az = q[k - 1], ex = q[k] - ax, ez = q[k + 1] - az, L2 = ex * ex + ez * ez; if (L2 < 1) continue;
        const t = ((x - ax) * ex + (z - az) * ez) / L2; if (t <= 0.02 || t >= 0.98) continue;
        const px = ax + ex * t, pz = az + ez * t; if (Math.hypot(px - x, pz - z) >= SN) continue;
        (ins.get(qi) || ins.set(qi, []).get(qi)).push([k, t, x, z]);
      }
    }
  });
  for (const [qi, list] of ins) {
    const q = axes[qi]; list.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    for (const [k, , x, z] of list) q.splice(k, 0, x, z);   // wierzchołek dokładnie w punkcie końca drugiej osi
  }
  // skrzyżowania typu X: wspólny wierzchołek wewnątrz dwóch osi
  const vk = (x, z) => Math.round(x * 2) * 1000003 + Math.round(z * 2), vcount = new Map();
  axes.forEach((p, pi) => { for (let k = 2; k < p.length - 2; k += 2) { const key = vk(p[k], p[k + 1]), s = vcount.get(key); if (s === undefined) vcount.set(key, pi); else if (s !== pi) vcount.set(key, -1); } });
  const pieces = [];
  for (const p of axes) {
    if (p.length < 4) continue;
    let st = 0;
    for (let k = 2; k < p.length - 2; k += 2) if (vcount.get(vk(p[k], p[k + 1])) === -1 || isEnd(p[k], p[k + 1])) { pieces.push(p.slice(st, k + 2)); st = k; }
    pieces.push(p.slice(st));
  }
  for (const p of pieces) {
    if (p.length < 4) continue;
    const cum = [0]; for (let k = 2; k < p.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]));
    const len = cum[cum.length - 1]; if (len < 4) continue;
    let ok = 0;
    for (const f of [0.25, 0.5, 0.75]) { const q = polyAt(p, cum, len * f); if (onRoad(q[0], q[1])) ok++; }
    if (ok < 2) continue;
    const a = nodeAt(p[0], p[1]), b = nodeAt(p[p.length - 2], p[p.length - 1]);
    if (a === b) continue;
    const e = { p, cum, len, a, b }; edges.push(e);
    nodes[a].e.push(edges.length - 1); nodes[b].e.push(edges.length - 1);
  }
  // spójne składowe: ruch tylko na składowych dłuższych niż 300 m
  const comp = new Int32Array(nodes.length).fill(-1), compLen = [];
  for (let s = 0; s < nodes.length; s++) {
    if (comp[s] >= 0 || !nodes[s].e.length) continue;
    const id = compLen.length; let L = 0; const st = [s]; comp[s] = id;
    while (st.length) { const n = st.pop(); for (const ei of nodes[n].e) { const e = edges[ei]; L += e.len / 2; for (const m of [e.a, e.b]) if (comp[m] < 0) { comp[m] = id; st.push(m); } } }
    compLen.push(L);
  }
  const drive = edges.map((e, i) => i).filter(i => compLen[comp[edges[i].a]] > 300);
  const dcum = []; let total = 0; for (const i of drive) { total += edges[i].len; dcum.push(total); }
  roadGraph = { nodes, edges, drive, dcum, total, comp, compLen };
}
function polyAt(p, cum, s) {
  let k = 1; while (k < cum.length - 1 && cum[k] < s) k++;
  const s0 = cum[k - 1], seg = (cum[k] - s0) || 1, t = clamp((s - s0) / seg, 0, 1);
  const x0 = p[(k - 1) * 2], z0 = p[(k - 1) * 2 + 1], x1 = p[k * 2], z1 = p[k * 2 + 1];
  return [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, (x1 - x0) / seg, (z1 - z0) / seg];
}
const REAL_LANE = 1.7;
function realCarPos(a) {
  const e = roadGraph.edges[a.e], [x, z, dx, dz] = polyAt(e.p, e.cum, a.s), sx = dx * a.dir, sz = dz * a.dir;
  return [x - sz * REAL_LANE, z + sx * REAL_LANE, Math.atan2(sx, sz)];   // prawy pas: (−dz, dx)
}
function placeRealCar(a, nearX, nearZ) {
  const G = roadGraph;
  for (let t = 0; t < 40; t++) {
    const r = Math.random() * G.total; let lo = 0, hi = G.dcum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (G.dcum[m] < r) lo = m + 1; else hi = m; }
    const ei = G.drive[lo];
    a.e = ei; a.dir = Math.random() < 0.5 ? 1 : -1; a.s = Math.random() * G.edges[ei].len;
    const [x, z] = realCarPos(a);
    if (nearX != null) { const d = Math.hypot(x - nearX, z - nearZ); if (d < 120 || d > 300) continue; }
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 20 || vehicles.some(v => Math.hypot(v.pos.x - x, v.pos.z - z) < 14)) continue;
    return true;
  }
  return false;
}
function spawnTrafficReal(count) {
  if (!roadGraph) buildRoadGraph();
  if (!roadGraph.drive.length) return;
  for (let i = 0; i < count; i++) {
    const a = { real: true, e: 0, dir: 1, s: 0, stuck: 0, ghost: 0, vmax: MAP_ID === 'warsaw' ? 11.5 : 9.5, recycle: 0 };
    if (!placeRealCar(a)) continue;
    const [x, z, hd] = realCarPos(a), type = randomCarType();
    const v = spawnVehicle(type === 'police' ? 'sedan' : type, carColor(type), x, z, hd, 'traffic');
    v.ai = a; v.speed = 6;
  }
}
function advanceRealCar(v, a, dt) {
  const G = roadGraph;
  a.s += a.dir * v.speed * dt;
  let e = G.edges[a.e];
  for (let guard = 0; guard < 4 && (a.s > e.len || a.s < 0); guard++) {
    const over = a.s > e.len ? a.s - e.len : -a.s, node = a.s > e.len ? e.b : e.a;
    let opts = G.nodes[node].e.filter(i => i !== a.e && G.compLen[G.comp[G.edges[i].a]] > 300);
    if (!opts.length) opts = [a.e];                       // ślepa uliczka — zawracanie
    a.e = opts[Math.floor(Math.random() * opts.length)]; e = G.edges[a.e];
    a.dir = e.a === node ? 1 : -1; a.s = a.dir > 0 ? over : e.len - over;
  }
  const [x, z, hd] = realCarPos(a);
  const k = Math.min(1, dt * 9);
  v.pos.set(lerp(v.pos.x, x, k), 0, lerp(v.pos.z, z, k));
  v.heading += angDiff(v.heading, hd) * Math.min(1, dt * 6);
}
// GPS po drogach (Dijkstra po grafie, start i cel rzutowane na najbliższy punkt drogi);
// gdy gracz lub cel jest daleko od dróg — linia prosta.
function nearestOnRoad(x, z) {
  const G = roadGraph; let best = null, bd = Infinity;
  for (const ei of G.drive) {
    const e = G.edges[ei], p = e.p;
    for (let k = 2; k < p.length; k += 2) {
      const ax = p[k - 2], az = p[k - 1], ex = p[k] - ax, ez = p[k + 1] - az, L2 = ex * ex + ez * ez;
      let t = L2 > 0 ? ((x - ax) * ex + (z - az) * ez) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + ex * t, pz = az + ez * t, d = (px - x) * (px - x) + (pz - z) * (pz - z);
      if (d < bd) { bd = d; best = { ei, s: e.cum[k / 2 - 1] + Math.sqrt(L2) * t, x: px, z: pz, d: 0 }; }
    }
  }
  if (best) best.d = Math.sqrt(bd);
  return best;
}
// punkty osi krawędzi między odległościami s0 → s1 (w dowolnym kierunku)
function edgeSlice(e, s0, s1, out) {
  const n = e.p.length / 2;
  if (s1 >= s0) { for (let k = 0; k < n; k++) if (e.cum[k] > s0 && e.cum[k] < s1) out.push({ x: e.p[k * 2], z: e.p[k * 2 + 1] }); }
  else { for (let k = n - 1; k >= 0; k--) if (e.cum[k] < s0 && e.cum[k] > s1) out.push({ x: e.p[k * 2], z: e.p[k * 2 + 1] }); }
  const q = polyAt(e.p, e.cum, s1); out.push({ x: q[0], z: q[1] });
}
function graphRoute(from, t) {
  const G = roadGraph, straight = [{ x: from.x, z: from.z }, { x: t.x, z: t.z }];
  if (Math.hypot(t.x - from.x, t.z - from.z) < 40) return straight;
  const A = nearestOnRoad(from.x, from.z), Bp = nearestOnRoad(t.x, t.z);
  if (!A || !Bp || A.d > 90 || Bp.d > 150) return straight;
  const ea = G.edges[A.ei], eb = G.edges[Bp.ei];
  if (G.comp[ea.a] !== G.comp[eb.a]) return straight;
  const pts = [{ x: from.x, z: from.z }, { x: A.x, z: A.z }];
  if (A.ei === Bp.ei) { edgeSlice(ea, A.s, Bp.s, pts); pts.push({ x: t.x, z: t.z }); return pts; }
  const dist = new Float64Array(G.nodes.length).fill(Infinity), prev = new Int32Array(G.nodes.length).fill(-1), prevE = new Int32Array(G.nodes.length).fill(-1);
  const heap = [];
  const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  // start: oba końce krawędzi startowej
  dist[ea.a] = A.s; dist[ea.b] = Math.min(dist[ea.b], ea.len - A.s);
  push(dist[ea.a], ea.a); push(dist[ea.b], ea.b);
  while (heap.length) {
    const [d, n] = pop(); if (d > dist[n]) continue;
    for (const ei of G.nodes[n].e) { const e = G.edges[ei], m = e.a === n ? e.b : e.a, nd = d + e.len; if (nd < dist[m]) { dist[m] = nd; prev[m] = n; prevE[m] = ei; push(nd, m); } }
  }
  // cel: wejście na krawędź docelową od strony a lub b
  const viaA = dist[eb.a] + Bp.s, viaB = dist[eb.b] + (eb.len - Bp.s);
  if (!isFinite(viaA) && !isFinite(viaB)) return straight;
  const end = viaA <= viaB ? eb.a : eb.b;
  const chain = []; for (let n = end; prev[n] >= 0; n = prev[n]) chain.push(n);
  chain.reverse();
  const first = chain.length ? prev[chain[0]] : end;   // węzeł krawędzi startowej, od którego ruszamy
  edgeSlice(ea, A.s, first === ea.a ? 0 : ea.len, pts);
  let cur = first;
  for (const n of chain) { const e = G.edges[prevE[n]]; edgeSlice(e, e.a === cur ? 0 : e.len, e.a === cur ? e.len : 0, pts); cur = n; }
  edgeSlice(eb, end === eb.a ? 0 : eb.len, Bp.s, pts);
  pts.push({ x: t.x, z: t.z });
  return pts;
}

// ---------------------------------------------------------------- domy z wnętrzami, diamenty, urbex
// Domy: ~14 budynków z drzwiami 🚪 (E = wejdź). Wnętrze (salon / sypialnia / kuchnia) to osobny pokój poza mapą;
// meble podpisane po angielsku, w każdym domu ukryty diament 💎. Urbex: 3 opuszczone budynki (ruiny) z graffiti
// i gruzem — 2 diamenty w każdym, 📸 zdjęcie przy pierwszej wizycie; tryb urbex (U) = latarka + GPS do ruin.
// Diament = $500 w sklepie (wymiana). Diamenty pojawiają się na nowo przy każdej zmianie pory roku.
// Wybór domów i ruin z ziarna mapy — te same miejsca przy każdym uruchomieniu (zapis znalezionych w save).
const GEM_PRICE = 500, ROOM_W = 11, ROOM_D = 9, ROOM_H = 3.3, ROOM_BASE = 2400;
const homes = [], ruins = [], gems = [];
let indoor = null, nearDoor = null, nearPhoto = null, nearLabel = null, urbexMode = false;
const roomLight = new THREE.PointLight(0xfff1d6, 0, 18, 1.4); scene.add(roomLight);
const flashlight = new THREE.SpotLight(0xfff4d8, 0, 45, 0.45, 0.5, 1.2); scene.add(flashlight, flashlight.target);
const gemGeo = new THREE.OctahedronGeometry(0.17, 0).scale(1, 1.45, 1);
const gemMat = new StdMat({ color: 0x8ff0ff, emissive: 0x1d7a99 });
const glintMat = new THREE.SpriteMaterial({ map: flakeTex, color: 0x9ff4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
function addGem(id, x, y, z) {
  const m = new THREE.Mesh(gemGeo, gemMat); m.position.set(x, y, z);
  const s = new THREE.Sprite(glintMat); s.scale.set(0.8, 0.8, 1); m.add(s);
  scene.add(m);
  const gm = { id, x, y, z, m, found: !!(save.gemsFound && save.gemsFound[id]) };
  m.visible = !gm.found;
  gems.push(gm);
  return gm;
}
function iconSprite(emoji, size) {
  const c = makeCanvas(128, 128), x = c.getContext('2d');
  x.fillStyle = 'rgba(10,12,18,.78)'; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill();
  x.lineWidth = 6; x.strokeStyle = '#f2b632'; x.stroke();
  x.font = '64px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, 64, 68);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(c, false) })); sp.scale.set(size, size, 1);
  return sp;
}
// prostokąt wolny od budynków, drzew, wody i (na mapach z danych) dróg
function areaFree(x, z, r) {
  if (Math.abs(x) > BOUND - r - 5 || Math.abs(z) > BOUND - r - 5) return false;
  for (const c of colliders) if (c.x1 > x - r && c.x0 < x + r && c.z1 > z - r && c.z0 < z + r) return false;
  for (const [tx, tz] of treeSpots) if (Math.abs(tx - x) < r + 1 && Math.abs(tz - z) < r + 1) return false;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < r + 50) return false;
  if (MISSIONS.some(m => Math.hypot(m.mx - x, m.mz - z) < r + 25)) return false;
  if (fishSpots.some(s => Math.hypot(s.x - x, s.z - z) < r + 20)) return false;
  if (!REALMAP) return !onBlock(x, z) && !(Math.abs(x) < HALF + r && Math.abs(z) < HALF + r) && Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r + r + 8;
  if (roadGraph) { const q = nearestOnRoad(x, z); if (q && q.d < r + 3) return false; }
  for (const L of [WD.water, WD.roads]) {
    for (let t = 0; t < L.f.length; t += 3) {
      const a = L.f[t] * 2, b = L.f[t + 1] * 2, c = L.f[t + 2] * 2;
      const minx = Math.min(L.v[a], L.v[b], L.v[c]), maxx = Math.max(L.v[a], L.v[b], L.v[c]), minz = Math.min(L.v[a + 1], L.v[b + 1], L.v[c + 1]), maxz = Math.max(L.v[a + 1], L.v[b + 1], L.v[c + 1]);
      if (maxx > x - r && minx < x + r && maxz > z - r && minz < z + r) return false;
    }
  }
  return true;
}
const HOME_COLORS = [0xf2e3c6, 0xdfe9f2, 0xf4d9d0, 0xe2ecd8, 0xece2f2, 0xf6edd0];
const ROOM_KINDS = [
  { id: 'living', en: 'a living room', pl: 'salon' },
  { id: 'bed', en: 'a bedroom', pl: 'sypialnia' },
  { id: 'kitchen', en: 'a kitchen', pl: 'kuchnia' },
];
function buildRoom(h, i) {
  const rx = ROOM_BASE + (i % 5) * 40, rz = ROOM_BASE + Math.floor(i / 5) * 40, W2 = ROOM_W / 2, D2 = ROOM_D / 2;
  const parts = [], labels = [];
  const F = (w, hh, d, x, y, z, c, ry = 0) => parts.push({ g: BOX(w, hh, d), m: partMatrix(rx + x, y, rz + z, ry), c: new THREE.Color(c) });
  const C = (x0, x1, z0, z1, hh) => addCol(rx + x0, rx + x1, rz + z0, rz + z1, hh);
  const LB = (x, z, ico, en, pl) => labels.push({ x: rx + x, z: rz + z, ico, en, pl });
  const wall = HOME_COLORS[i % HOME_COLORS.length];
  // podłoga z desek, ściany, sufit, okna
  F(ROOM_W, 0.1, ROOM_D, 0, -0.05, 0, 0xa0754a);
  for (let k = -W2 + 0.5; k < W2; k += 1) F(0.02, 0.005, ROOM_D, k, 0.002, 0, 0x7a5636);
  F(ROOM_W + 0.4, ROOM_H, 0.2, 0, ROOM_H / 2, -D2 - 0.1, wall); F(ROOM_W + 0.4, ROOM_H, 0.2, 0, ROOM_H / 2, D2 + 0.1, wall);
  F(0.2, ROOM_H, ROOM_D, -W2 - 0.1, ROOM_H / 2, 0, wall); F(0.2, ROOM_H, ROOM_D, W2 + 0.1, ROOM_H / 2, 0, wall);
  F(ROOM_W, 0.1, ROOM_D, 0, ROOM_H + 0.05, 0, 0xf3efe6);
  F(ROOM_W, 0.12, 0.04, 0, 0.06, -D2 + 0.02, 0xffffff); F(ROOM_W, 0.12, 0.04, 0, 0.06, D2 - 0.02, 0xffffff);
  for (const sx of [-1, 1]) F(0.04, 1.2, 1.8, sx * (W2 - 0.01), 1.7, 1.2, 0xbfe6ff);
  F(1.8, 1.2, 0.04, 2.5, 1.7, -D2 + 0.01, 0xbfe6ff);
  // drzwi wyjściowe (ściana południowa)
  F(1.25, 2.25, 0.06, 0, 1.12, D2 - 0.03, 0x6b3f22); F(0.08, 0.08, 0.08, 0.45, 1.05, D2 - 0.08, 0xd4a017);
  for (const [x0, x1, z0, z1] of [[-W2 - 1, W2 + 1, -D2 - 1, -D2], [-W2 - 1, W2 + 1, D2, D2 + 1], [-W2 - 1, -W2, -D2 - 1, D2 + 1], [W2, W2 + 1, -D2 - 1, D2 + 1]]) C(x0, x1, z0, z1, 60);
  const spots = [];
  if (h.kind.id === 'living') {
    F(4, 0.02, 3, 0, 0.01, -0.8, 0xb0473a);
    F(3, 0.45, 0.95, 0, 0.22, -3.85, 0x3d5a80); F(3, 0.6, 0.25, 0, 0.75, -4.25, 0x34506f);
    for (const sx of [-1, 1]) F(0.25, 0.6, 0.95, sx * 1.5, 0.4, -3.85, 0x34506f);
    F(1.3, 0.12, 0.7, -0.68, 0.5, -3.75, 0x4a6b94); F(1.3, 0.12, 0.7, 0.68, 0.5, -3.75, 0x4a6b94);
    C(-1.65, 1.65, -4.4, -3.35, 0.9); LB(0, -3.3, '🛋️', 'a sofa', 'kanapa');
    F(1.4, 0.08, 0.7, 0, 0.42, -1.9, 0x8a5a33); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F(0.06, 0.4, 0.06, sx * 0.62, 0.2, -1.9 + sz * 0.28, 0x6b4a2f);
    C(-0.75, 0.75, -2.3, -1.5, 0.5); LB(0, -1.9, '☕', 'a coffee table', 'stolik kawowy');
    F(0.5, 0.5, 2, 5.15, 0.25, -0.5, 0x2b2b2b); F(0.08, 0.8, 1.5, 5.2, 1.0, -0.5, 0x111111); F(0.02, 0.68, 1.38, 5.15, 1.0, -0.5, 0x2a4a6a);
    C(4.9, 5.5, -1.5, 0.5, 1.4); LB(4.6, -0.5, '📺', 'a television', 'telewizor');
    F(0.4, 2.0, 1.8, -5.25, 1.0, 0.5, 0x6b4a2f);
    for (let s = 0; s < 4; s++) for (let b = 0; b < 6; b++) F(0.28, 0.32, 0.12, -5.2, 0.25 + s * 0.48, -0.2 + b * 0.27, [0xc0392b, 0x2e86de, 0xf2b632, 0x10ac84, 0x8e44ad][(s + b) % 5]);
    C(-5.5, -5.0, -0.45, 1.45, 2.0); LB(-4.7, 0.5, '📚', 'a bookcase', 'regał na książki');
    F(0.45, 0.5, 0.45, -4.8, 0.25, -3.9, 0xb5651d); F(0.85, 0.9, 0.85, -4.8, 0.95, -3.9, 0x3f7a32);
    C(-5.1, -4.5, -4.2, -3.6, 1.2); LB(-4.4, -3.5, '🪴', 'a plant', 'roślina');
    F(0.9, 0.45, 0.9, 3.4, 0.22, -3.3, 0x7a3b3b); F(0.9, 0.55, 0.2, 3.4, 0.72, -3.7, 0x6a2f2f);
    C(2.9, 3.9, -3.8, -2.8, 0.9); LB(3.4, -2.7, '🪑', 'an armchair', 'fotel');
    F(0.06, 1.6, 0.06, -3.2, 0.8, -4.1, 0x2b2b2b); F(0.5, 0.35, 0.5, -3.2, 1.65, -4.1, 0xf5e6c4); LB(-3.2, -3.8, '💡', 'a lamp', 'lampa');
    spots.push([-5.25, 2.15, 0.5], [0, 0.14, -1.9], [-4.8, 1.55, -3.9], [3.95, 0.14, -4.05]);
  } else if (h.kind.id === 'bed') {
    F(1.8, 0.4, 2.2, -3.8, 0.2, -3.2, 0x8a5a33); F(1.7, 0.2, 2.1, -3.8, 0.5, -3.2, 0xf2f2f2); F(1.72, 0.06, 1.4, -3.8, 0.62, -2.85, 0x3b7dd8);
    F(1.2, 0.15, 0.4, -3.8, 0.67, -4.0, 0xffffff); F(1.8, 1.0, 0.1, -3.8, 0.6, -4.35, 0x6b4a2f);
    C(-4.75, -2.85, -4.4, -2.05, 0.7); LB(-3.8, -1.9, '🛏️', 'a bed', 'łóżko');
    F(0.5, 0.5, 0.5, -2.45, 0.25, -4.1, 0x8a5a33); F(0.25, 0.3, 0.25, -2.45, 0.65, -4.1, 0xf5e6c4);
    C(-2.7, -2.2, -4.35, -3.85, 0.6); LB(-2.2, -3.6, '🌙', 'a bedside table', 'szafka nocna');
    F(0.6, 2.2, 1.8, 5.15, 1.1, -2.5, 0xc9a77a); F(0.02, 2.0, 0.02, 4.84, 1.1, -2.5, 0x6b4a2f);
    C(4.85, 5.5, -3.4, -1.6, 2.2); LB(4.5, -2.5, '👕', 'a wardrobe', 'szafa');
    F(1.4, 0.08, 0.7, 4.2, 0.75, 2.0, 0xa0754a); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F(0.06, 0.72, 0.06, 4.2 + sx * 0.62, 0.36, 2.0 + sz * 0.28, 0x6b4a2f);
    F(0.5, 0.03, 0.35, 4.2, 0.8, 2.0, 0x333333); F(0.5, 0.32, 0.03, 4.2, 0.96, 1.83, 0x222831);
    C(3.45, 4.95, 1.6, 2.4, 0.8); LB(4.2, 1.4, '🖥️', 'a desk', 'biurko');
    F(0.45, 0.45, 0.45, 4.2, 0.45, 1.2, 0x2e86de); F(0.45, 0.5, 0.06, 4.2, 0.9, 0.98, 0x2e86de);
    F(2.4, 0.02, 1.6, -0.5, 0.01, -1.0, 0x7a4fc9);
    F(0.6, 0.6, 0.6, 0.8, 0.3, -4.0, 0xe07a3f); LB(0.8, -3.5, '🧸', 'a toy box', 'skrzynia z zabawkami'); C(0.5, 1.1, -4.3, -3.7, 0.6);
    spots.push([-3.0, 0.12, -2.0], [5.15, 2.35, -2.5], [4.2, 0.12, 2.0], [0.8, 0.75, -4.0]);
  } else {
    F(6, 0.9, 0.65, -1.5, 0.45, -4.1, 0xeeeeee); F(6, 0.05, 0.7, -1.5, 0.92, -4.1, 0x6b6b6b);
    F(0.8, 0.05, 0.5, -2.5, 0.95, -4.1, 0x9aa0a8); F(0.8, 0.04, 0.6, 0.3, 0.96, -4.1, 0x222222);
    F(6, 0.7, 0.35, -1.5, 2.2, -4.3, 0xeeeeee);
    C(-4.5, 1.5, -4.5, -3.75, 1.0); LB(-2.5, -3.5, '🚰', 'a sink', 'zlewozmywak'); LB(0.3, -3.5, '🍳', 'a cooker', 'kuchenka');
    F(0.8, 1.9, 0.75, 4.9, 0.95, -4.0, 0xdfe6ec); F(0.03, 0.5, 0.03, 4.48, 1.3, -3.7, 0x9aa0a8);
    C(4.5, 5.5, -4.5, -3.6, 1.9); LB(4.4, -3.4, '🧊', 'a fridge', 'lodówka');
    F(1.6, 0.08, 1.0, 0, 0.75, 0.2, 0x8a5a33); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) F(0.07, 0.72, 0.07, sx * 0.7, 0.36, 0.2 + sz * 0.42, 0x6b4a2f);
    for (const [cx, cz] of [[-1.15, 0.2], [1.15, 0.2], [0, -0.65], [0, 1.05]]) { const dx = cx, dz = cz - 0.2, l = Math.hypot(dx, dz); F(0.45, 0.06, 0.45, cx, 0.45, cz, 0xa0754a); F(0.45, 0.5, 0.05, cx + dx / l * 0.2, 0.72, cz + dz / l * 0.2, 0xa0754a, Math.atan2(dx, dz)); }
    C(-0.85, 0.85, -0.35, 0.75, 0.8); LB(0, 0.2, '🍽️', 'a table', 'stół');
    F(0.5, 1.2, 1.4, -5.2, 0.6, 1.0, 0xc9a77a); C(-5.5, -4.95, 0.3, 1.7, 1.2); LB(-4.7, 1.0, '🗄️', 'a cupboard', 'kredens');
    F(0.3, 0.3, 0.3, -1.0, 1.1, -4.1, 0xc0392b); LB(-1.0, -3.5, '🫖', 'a kettle', 'czajnik');
    spots.push([4.9, 2.03, -4.0], [0, 0.12, 0.2], [-4.0, 2.68, -4.3], [-5.2, 0.12, 2.1]);
  }
  const mesh = new THREE.Mesh(mergeColored(parts), vcMat); mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
  h.room = { x: rx, z: rz, labels };
  const sp = spots[Math.floor(h.rng() * spots.length)];
  h.gem = addGem(h.id, rx + sp[0], sp[1], rz + sp[2]);
}
function buildHomes() {
  const rng = mulberry(9001 + MAP_ID.length * 131 + (MAP_ID.charCodeAt(0) || 0));
  const cands = [];
  for (const c of colliders) {
    if (c.rings) {
      if (c.h < 3 || c.h > 40) continue;
      const r = c.rings[0];
      let best = null;
      for (let k = 0; k < r.length; k += 2) {
        const k2 = (k + 2) % r.length, L = Math.hypot(r[k2] - r[k], r[k2 + 1] - r[k + 1]); if (L < 3.5 || (best && L < best.L)) continue;
        const mx = (r[k] + r[k2]) / 2, mz = (r[k + 1] + r[k2 + 1]) / 2;
        let nx = (r[k2 + 1] - r[k + 1]) / L, nz = -(r[k2] - r[k]) / L;
        if (polyInside(mx + nx * 0.5, mz + nz * 0.5, c.rings)) { nx = -nx; nz = -nz; }
        if (blockedAt(mx + nx * 1.8, mz + nz * 1.8, 0.6)) continue;
        best = { L, x: mx, z: mz, nx, nz };
      }
      if (best) cands.push(best);
    } else if (c.x1 - c.x0 > 5 && c.z1 - c.z0 > 5 && c.h >= 6 && c.h <= 70) {
      const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
      for (const [x, z, nx, nz] of [[cx, c.z1, 0, 1], [cx, c.z0, 0, -1], [c.x1, cz, 1, 0], [c.x0, cz, -1, 0]]) {
        if (blockedAt(x + nx * 1.8, z + nz * 1.8, 0.6)) continue;
        cands.push({ x, z, nx, nz }); break;
      }
    }
  }
  const pool = cands.filter(d => Math.hypot(d.x - SPAWN.x, d.z - SPAWN.z) > 20 && !MISSIONS.some(m => Math.hypot(m.mx - d.x, m.mz - d.z) < 16));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const tex = iconSprite('🚪', 1.1).material;
  for (const d of pool) {
    if (homes.length >= 14) break;
    if (homes.some(o => Math.hypot(o.door.x - d.x, o.door.z - d.z) < 45)) continue;
    const i = homes.length, a = Math.atan2(d.nx, d.nz), y = groundAt(d.x + d.nx * 1.5, d.z + d.nz * 1.5);
    const h = { id: `${MAP_ID}:home${i}`, door: { x: d.x + d.nx * 0.05, z: d.z + d.nz * 0.05, ax: d.x + d.nx * 1.6, az: d.z + d.nz * 1.6, a }, kind: ROOM_KINDS[i % 3], rng };
    addStatic(new THREE.BoxGeometry(1.5, 2.5, 0.12), 0xf2efe8, h.door.x, y + 1.25, h.door.z, a);
    addStatic(new THREE.BoxGeometry(1.25, 2.3, 0.16), 0x6b3f22, h.door.x, y + 1.15, h.door.z, a);
    addStatic(new THREE.BoxGeometry(0.08, 0.08, 0.2), 0xd4a017, h.door.x + Math.cos(a) * 0.42, y + 1.1, h.door.z - Math.sin(a) * 0.42, a);
    addStatic(new THREE.BoxGeometry(1.8, 0.12, 0.8), 0x9a9a9a, h.door.x + d.nx * 0.45, y + 0.06, h.door.z + d.nz * 0.45, a);
    const sp = new THREE.Sprite(tex); sp.scale.set(1.1, 1.1, 1); sp.position.set(h.door.x + d.nx * 0.6, y + 3.2, h.door.z + d.nz * 0.6); scene.add(sp);
    h.sprite = sp;
    buildRoom(h, i);
    homes.push(h);
  }
  const st = staticParts.length ? new THREE.Mesh(mergeColored(staticParts), vcMat) : null;
  if (st) { st.castShadow = st.receiveShadow = true; st.frustumCulled = false; scene.add(st); staticParts.length = 0; }
}
const URBEX_NAMES = [['🏭', 'Stara fabryka', 'an old factory'], ['🏥', 'Opuszczony szpital', 'an abandoned hospital'], ['🚉', 'Stary dworzec', 'an old railway station'], ['🏫', 'Zrujnowana szkoła', 'a ruined school']];
function graffitiTex(rng) {
  const c = makeCanvas(256, 128), x = c.getContext('2d');
  const words = ['URBEX', 'GRAMMAR!', 'HELLO', 'BE COOL', 'NO ENTRY', 'STAY SAFE', 'KEEP OUT', 'WOW'];
  const cols = ['#ff4fa3', '#45d483', '#4fb3ff', '#f2b632', '#c77dff', '#ff7a1a'];
  x.lineJoin = 'round'; x.font = 'bold 52px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const w = words[Math.floor(rng() * words.length)], col = cols[Math.floor(rng() * cols.length)];
  x.save(); x.translate(128, 64); x.rotate((rng() - 0.5) * 0.3);
  x.lineWidth = 10; x.strokeStyle = '#111'; x.strokeText(w, 0, 0); x.fillStyle = col; x.fillText(w, 0, 0); x.restore();
  for (let i = 0; i < 6; i++) { x.fillStyle = col; x.globalAlpha = 0.6; x.fillRect(30 + rng() * 200, 90 + rng() * 25, 3, 8 + rng() * 20); }
  return canvasTex(c, false);
}
function buildRuin(x, z, idx, rng) {
  const W = 18, D = 13, T = 0.5, parts = [];
  const F = (w, h, d, px, py, pz, c, ry = 0) => parts.push({ g: new THREE.BoxGeometry(w, h, d), m: partMatrix(x + px, py, z + pz, ry), c: new THREE.Color(c) });
  const shade = () => { const k = 0.8 + rng() * 0.3; return new THREE.Color(0x8a8a85).multiplyScalar(k).getHex(); };
  F(W, 0.08, D, 0, 0.04, 0, 0x6e6a62);
  // ściany z segmentów: brakujące kawałki, otwory okienne, poszarpana góra
  const side = (ax, az, bx, bz, nseg, door) => {
    const L = Math.hypot(bx - ax, bz - az), sl = L / nseg, horiz = Math.abs(bz - az) < 1e-6;
    for (let s = 0; s < nseg; s++) {
      if (door && (s === Math.floor(nseg / 2) || s === Math.floor(nseg / 2) - 1)) continue;
      if (rng() < 0.12) continue;
      const t = (s + 0.5) / nseg, cx = ax + (bx - ax) * t, cz = az + (bz - az) * t, h = 2.2 + rng() * 3.6;
      const w = horiz ? sl + 0.02 : T, d = horiz ? T : sl + 0.02;
      if (rng() < 0.3 && h > 2.8) { F(w, 1.0, d, cx, 0.5, cz, shade()); F(w, h - 2.2, d, cx, 2.2 + (h - 2.2) / 2, cz, shade()); }
      else F(w, h, d, cx, h / 2, cz, shade());
      if (rng() < 0.3) F(horiz ? sl * 0.6 : T + 0.04, 0.12, horiz ? T + 0.04 : sl * 0.6, cx, h + 0.06, cz, 0x5d7a3a);   // mech
      addCol(x + cx - w / 2, x + cx + w / 2, z + cz - d / 2, z + cz + d / 2, h);
    }
  };
  side(-W / 2, -D / 2, W / 2, -D / 2, 9, false); side(-W / 2, D / 2, W / 2, D / 2, 9, true);
  side(-W / 2, -D / 2, -W / 2, D / 2, 6, false); side(W / 2, -D / 2, W / 2, D / 2, 6, false);
  // filary i fragment stropu
  for (const px of [-4, 4]) { F(0.5, 4.6, 0.5, px, 2.3, 0, 0x7a7a74); addCol(x + px - 0.25, x + px + 0.25, z - 0.25, z + 0.25, 4.6); }
  F(8, 0.25, 7, -4.5, 4.6, -2.5, 0x6f6f69); F(5, 0.25, 4, 5, 4.6, 3.5, 0x6f6f69, 0.05);
  // gruz, belki, beczki, stary materac
  for (let k = 0; k < 7; k++) {
    const px = (rng() - 0.5) * (W - 4), pz = (rng() - 0.5) * (D - 4);
    for (let j = 0; j < 4; j++) F(0.4 + rng() * 0.9, 0.2 + rng() * 0.5, 0.4 + rng() * 0.9, px + (rng() - 0.5) * 1.2, 0.2, pz + (rng() - 0.5) * 1.2, rng() < 0.5 ? 0x7d776c : 0x5e4a3a, rng() * 3);
  }
  for (let k = 0; k < 3; k++) F(0.25, 0.25, 4 + rng() * 2, (rng() - 0.5) * 10, 0.6 + rng() * 0.6, (rng() - 0.5) * 6, 0x5a3a1e, rng() * 3);
  for (let k = 0; k < 3; k++) { const px = -W / 2 + 1.2 + k * 0.8, pz = D / 2 - 1.5; parts.push({ g: new THREE.CylinderGeometry(0.32, 0.32, 0.9, 10), m: partMatrix(x + px, 0.45, z + pz), c: new THREE.Color(k === 1 ? 0x2f5d8a : 0x8a4b24) }); addCol(x + px - 0.32, x + px + 0.32, z + pz - 0.32, z + pz + 0.32, 0.9); }
  F(1.9, 0.2, 0.9, 6, 0.1, -4.6, 0x9a8f6a, 0.2);
  const mesh = new THREE.Mesh(mergeColored(parts), vcMat); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
  // graffiti na wewnętrznych ścianach
  for (const [px, pz, ry] of [[-3, -D / 2 + T / 2 + 0.02, 0], [W / 2 - T / 2 - 0.02, 1.5, -Math.PI / 2], [-W / 2 + T / 2 + 0.02, -2, Math.PI / 2]]) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7), new StdMat({ map: graffitiTex(rng), transparent: true, alphaTest: 0.1, polygonOffset: true, polygonOffsetFactor: -2 }));
    gm.position.set(x + px, 1.35, z + pz); gm.rotation.y = ry; scene.add(gm);
  }
  const [ico, pl, en] = URBEX_NAMES[idx % URBEX_NAMES.length];
  const sp = iconSprite('🏚️', 2.2); sp.position.set(x, 8, z); scene.add(sp);
  const cam = iconSprite('📸', 0.9); cam.position.set(x, 1.6, z + 1.5); scene.add(cam);
  const id = `${MAP_ID}:urbex${idx}`;
  const r = { id, x, z, ico, pl, en, sprite: sp, cam, photo: { x, z: z + 1.5 } };
  r.gems = [[-W / 2 + 1.0, 0.15, -D / 2 + 1.0], [W / 2 - 1.0, 0.15, D / 2 - 1.2]].map((p, k) => addGem(`${id}:g${k}`, x + p[0], p[1], z + p[2]));
  ruins.push(r);
}
function buildRuins() {
  const rng = mulberry(4242 + MAP_ID.length * 97 + (MAP_ID.charCodeAt(0) || 0));
  if (REALMAP && !roadGraph) buildRoadGraph();
  const placed = [];
  for (let t = 0; t < 900 && placed.length < 3; t++) {
    let x, z;
    if (!REALMAP) { const a = rng() * Math.PI * 2, d = HALF + 25 + rng() * 40; x = Math.cos(a) * d; z = Math.sin(a) * d; }
    else { x = (rng() * 2 - 1) * (BOUND - 20); z = (rng() * 2 - 1) * (BOUND - 20); }
    if (placed.some(p => Math.hypot(p[0] - x, p[1] - z) < 160)) continue;
    if (!areaFree(x, z, 12)) continue;
    if (homes.some(h => Math.hypot(h.door.x - x, h.door.z - z) < 25)) continue;
    placed.push([x, z]);
  }
  placed.forEach(([x, z], i) => buildRuin(x, z, i, rng));
}
function checkHomes() {
  nearDoor = null; nearPhoto = null; nearLabel = null;
  if (P.car) return;
  if (indoor) {
    const h = indoor, ex = h.room.x, ez = h.room.z + ROOM_D / 2 - 0.5;
    if (Math.hypot(P.pos.x - ex, P.pos.z - ez) < 1.7) { nearDoor = h; return; }
    let bd = 1.7;
    for (const l of h.room.labels) { const d = Math.hypot(P.pos.x - l.x, P.pos.z - l.z); if (d < bd) { bd = d; nearLabel = l; } }
    return;
  }
  for (const h of homes) if (Math.abs(P.pos.x - h.door.ax) < 3 && Math.abs(P.pos.z - h.door.az) < 3 && Math.hypot(P.pos.x - h.door.ax, P.pos.z - h.door.az) < 2.2) { nearDoor = h; return; }
  for (const r of ruins) if (Math.hypot(P.pos.x - r.photo.x, P.pos.z - r.photo.z) < 2) { nearPhoto = r; return; }
}
function enterHome(h) {
  indoor = h;
  if (chase) { endChase(); toast('🚓 Ukryłeś się przed policją w domu!', 'good', 3000); }
  P.pos.set(h.room.x, 0, h.room.z + ROOM_D / 2 - 3.6); P.facing = Math.PI; P.speed = 0; P.vy = 0;
  player.g.position.copy(P.pos); player.g.rotation.set(0, P.facing, 0);
  camYaw = 0; camPitch = 0.55; camDist = 3;
  refreshNear(P.pos.x, P.pos.z);
  roomLight.position.set(h.room.x, ROOM_H - 0.5, h.room.z); roomLight.intensity = 7;
  if (snowPts) snowPts.visible = false;
  $('minimap-wrap').style.visibility = 'hidden';
  Sound.door();
  toast(`🏠 To jest <b>${h.kind.en}</b> — ${h.kind.pl}. ${h.gem.found ? 'Diament z tego domu już masz.' : 'Gdzieś tu jest ukryty diament 💎!'}`, '', 4500);
  sayEN(h.kind.en);
}
function exitHome() {
  const h = indoor; if (!h) return;
  indoor = null;
  P.pos.set(h.door.ax, groundAt(h.door.ax, h.door.az), h.door.az); P.facing = h.door.a; P.speed = 0;
  player.g.position.copy(P.pos); player.g.rotation.set(0, P.facing, 0);
  camYaw = P.facing + Math.PI; camDist = 6;
  refreshNear(P.pos.x, P.pos.z);
  roomLight.intensity = 0;
  if (snowPts) snowPts.visible = season() === 'winter';
  $('minimap-wrap').style.visibility = '';
  Sound.door();
}
function collectGems(dt) {
  for (const gm of gems) {
    if (gm.found) continue;
    const dx = gm.x - P.pos.x, dz = gm.z - P.pos.z;
    if (Math.abs(dx) > 60 || Math.abs(dz) > 60) continue;
    gm.m.rotation.y += dt * 2; gm.m.position.y = gm.y + Math.sin(elapsed * 3 + gm.x) * 0.04;
    gm.m.children[0].material.opacity = 0.55 + 0.45 * Math.sin(elapsed * 5 + gm.z);
    if (!P.car && Math.hypot(dx, dz) < 1.3) {
      gm.found = true; gm.m.visible = false;
      save.gemsFound = save.gemsFound || {}; save.gemsFound[gm.id] = 1; save.gems = (save.gems || 0) + 1; save.xp += 10; persist();
      Sound.passed();
      toast(`💎 Diament — <b>a diamond</b>! Masz: ${save.gems}. Wymienisz go w sklepie (B) na ${fmtMoney(GEM_PRICE)}.`, 'good', 4200);
      sayEN('a diamond');
    }
  }
}
function respawnGems() {
  save.gemsFound = {}; persist();
  for (const gm of gems) { gm.found = false; gm.m.visible = true; }
}
function sellGems(all) {
  const n = all ? (save.gems || 0) : Math.min(1, save.gems || 0);
  if (!n) { Sound.wrong(); toast('Nie masz diamentów — szukaj ich w domach (🚪) i opuszczonych budynkach (🏚️).', 'bad'); return; }
  save.gems -= n; save.money += n * GEM_PRICE; persist();
  Sound.passed(); toast(`💎 Wymieniono ${n} × diament → +${fmtMoney(n * GEM_PRICE)}`, 'good', 3200);
  renderShop();
}
let flashEl = null;
function takePhoto(r) {
  if (!flashEl) { flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:40;transition:opacity .6s'; document.body.appendChild(flashEl); }
  flashEl.style.transition = 'none'; flashEl.style.opacity = '0.9';
  requestAnimationFrame(() => { flashEl.style.transition = 'opacity .7s'; flashEl.style.opacity = '0'; });
  Sound.tone(1500, 0.06, 'square', 0.08); Sound.noise(0.12, 0.25, 2500);
  save.urbex = save.urbex || {};
  if (!save.urbex[r.id]) {
    save.urbex[r.id] = 1; save.money += 100; save.xp += 20; persist();
    toast(`📸 ${r.ico} <b>${r.en}</b> — ${r.pl}. Urbex zaliczony: +$100 · ${Object.keys(save.urbex).length}/${ruins.length}`, 'good', 4500);
    sayEN(r.en);
    if (urbexMode) { const nx = nextRuin(); if (nx) setGPS({ kind: 'point', x: nx.x, z: nx.z }, true); }
  } else toast(`📸 Ładne zdjęcie: ${r.en} (${r.pl}).`, '', 2500);
}
function nextRuin() {
  const from = P.car ? P.car.pos : P.pos, left = ruins.filter(r => !(save.urbex && save.urbex[r.id]));
  const list = left.length ? left : ruins;
  return list.slice().sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))[0] || null;
}
function toggleUrbex(force) {
  urbexMode = force != null ? force : !urbexMode;
  if (!ruins.length) { urbexMode = false; toast('Na tej mapie nie ma opuszczonych budynków.'); return; }
  if (urbexMode) {
    const r = nextRuin(); if (r) setGPS({ kind: 'point', x: r.x, z: r.z }, true);
    toast(`🔦 Tryb urbex: latarka włączona. GPS prowadzi do: ${r.pl}. Szukaj 📸 w środku i diamentów w gruzach! (U — wyłącz)`, 'good', 5000);
  } else { flashlight.intensity = 0; toast('🔦 Tryb urbex wyłączony.'); }
  if (ui === 'shop') renderShop();
}
function updateFlashlight() {
  if (!urbexMode || P.car) { flashlight.intensity = 0; return; }
  const night = 1 - smooth(-0.14, 0.28, Math.sin((tod - 0.25) * Math.PI * 2));
  flashlight.intensity = 3 + 9 * night;
  const fx = Math.sin(P.facing), fz = Math.cos(P.facing);
  flashlight.position.set(P.pos.x + fx * 0.3, P.pos.y + 1.6, P.pos.z + fz * 0.3);
  flashlight.target.position.set(P.pos.x + fx * 8, P.pos.y + 0.3, P.pos.z + fz * 8);
}

// ---------------------------------------------------------------- przejazd do innej miejscowości (skraj mapy)
// Dojście / dojazd do granicy mapy otwiera okno „Dokąd jedziesz?” z listą map (przyciski z #map-pick).
// Wybór przeładowuje grę z ?map=… (postęp, pieniądze i zakupy zostają — zapis jest wspólny dla map).
// Na mapach z danych przy drogach wyjazdowych (ślepe końce osi przy granicy) stoją drogowskazy 🧭.
let travelCd = 0;
function placeExitSigns() {
  if (!REALMAP || !roadGraph) return;
  const sp = [], mat0 = iconSprite('🧭', 1.6).material;
  for (const n of roadGraph.nodes) {
    if (n.e.length !== 1 || (Math.abs(n.x) < BOUND - 25 && Math.abs(n.z) < BOUND - 25)) continue;
    if (sp.some(([x, z]) => Math.hypot(x - n.x, z - n.z) < 40) || sp.length >= 12) continue;
    sp.push([n.x, n.z]);
    const s = new THREE.Sprite(mat0); s.scale.set(1.6, 1.6, 1); s.position.set(n.x, 3.4, n.z); scene.add(s);
  }
}
function checkMapEdge(dt) {
  travelCd -= dt;
  if (ui || indoor || travelCd > 0) return;
  const f = P.car ? P.car.pos : P.pos, m = BOUND - 1.5;
  if (Math.abs(f.x) > m || Math.abs(f.z) > m) openTravel();
}
function travelMaps() {
  return [...document.querySelectorAll('#map-pick [data-map]')].map(b => ({ id: b.dataset.map, label: b.textContent.trim() })).filter(m => m.id !== MAP_ID);
}
function openTravel() {
  ui = 'travel'; keys.clear(); releaseLock(); setPrompt('');
  if (P.car) { P.car.speed = 0; P.car.vy = 0; }
  const here = (document.querySelector(`#map-pick [data-map="${MAP_ID}"]`) || {}).textContent || 'Grammar City';
  qCard.innerHTML = `<div class="card-head"><div class="eyebrow"><span class="chip" style="background:#45d483">🧭</span>Koniec mapy · ${esc(here.trim())}</div>
    <div class="result-title" style="color:var(--gold)">DOKĄD JEDZIESZ?</div>
    <div class="meta">Wybierz miejscowość — zaczniesz w jej centrum. Postęp, pieniądze i zakupy zostają.</div></div>
    <div class="card-body"><div class="travel-grid">${travelMaps().map(m => `<button class="btn ghost" data-go="${m.id}">${esc(m.label)}</button>`).join('')}</div>
    <div class="actions"><button class="btn" id="tr-stay">↩ Zostań tutaj</button><span class="meta">Esc — zostań</span></div></div>`;
  qCard.querySelectorAll('[data-go]').forEach(b => b.onclick = () => travelTo(b.dataset.go, b.textContent));
  $('tr-stay').onclick = () => closeTravel();
  $('quiz-ov').hidden = false;
  Sound.click();
}
function closeTravel() {
  ui = null; $('quiz-ov').hidden = true; canvas.focus(); travelCd = 4;
  // cofnij gracza / pojazd ~8 m do środka mapy
  const f = P.car ? P.car.pos : P.pos, m = BOUND - 9;
  f.x = clamp(f.x, -m, m); f.z = clamp(f.z, -m, m);
  if (P.car) { P.car.heading += Math.PI; P.car.mdir = P.car.heading; P.car.mesh.position.copy(P.car.pos); }
  refreshNear(f.x, f.z);
}
function travelTo(id, label) {
  persist(); persistWardrobe(); netLeave();
  qCard.innerHTML = `<div class="card-head"><div class="result-title" style="color:var(--gold)">W DRODZE…</div><div class="meta">${esc(label || id)}</div></div>`;
  Sound.passed();
  setTimeout(() => setMap(id), 700);
}

// ---------------------------------------------------------------- gra online z klasą (Supabase Realtime)
// Tylko gracze z tej samej klasy (prywatny kanał „gc:<class_id>:<mapa>”, autoryzacja w migracji #68).
// Bez czatu i wiadomości — widać tylko postacie / pojazdy i ksywki. Oszczędnie: pozycja 2×/s w ruchu,
// na stojąco co 5 s; inni gracze wygładzani (interpolacja). Wymaga zalogowania w Sowie Fiszki.
const NET = { sb: null, me: null, classes: [], cls: null, ch: null, on: false, want: false, started: false, peers: new Map(), sendT: 0, last: null };
const NET_KEY = 'grammarCity.online.v1';
function netPrefs() { try { return JSON.parse(localStorage.getItem(NET_KEY)) || {}; } catch (e) { return {}; } }
function netSavePrefs() { try { localStorage.setItem(NET_KEY, JSON.stringify({ on: NET.want, cls: NET.cls && NET.cls.class_id })); } catch (e) { /* ignore */ } }
function netNote(t) { const el = $('online-note'); if (el) { el.textContent = t || ''; el.hidden = !t; } }
async function netInit() {
  const sb = window.supabase && typeof window.supabase.rpc === 'function' ? window.supabase : null;
  if (!sb) { netNote('🌐 Gra online z klasą działa po wejściu przez Sowie Fiszki (sowiefiszki.com).'); return; }
  NET.sb = sb;
  try {
    const { data: s } = await sb.auth.getSession();
    const user = s && s.session && s.session.user;
    if (!user) { netNote('🌐 Gra online z klasą: zaloguj się w Sowie Fiszki.'); return; }
    const { data, error } = await sb.rpc('gc_my_classes');
    if (error) { netNote(/gc_my_classes|PGRST202|function/i.test(error.message + error.code) ? '🌐 Gra online wymaga aktualizacji bazy (migracja #68).' : '🌐 Gra online chwilowo niedostępna.'); return; }
    NET.classes = data || [];
    if (!NET.classes.length) { netNote('🌐 Gra online z klasą: nie należysz jeszcze do żadnej klasy.'); return; }
    NET.me = { id: user.id, name: NET.classes[0].my_name || 'Gracz' };
    const pr = netPrefs();
    NET.cls = NET.classes.find(c => c.class_id === pr.cls) || NET.classes[0];
    NET.want = pr.on !== false;
    const sel = $('online-class'), chk = $('online-on'), box = $('online-pick');
    sel.innerHTML = NET.classes.map(c => `<option value="${c.class_id}">${esc(c.class_name)}${c.role === 'teacher' ? ' (nauczyciel)' : ''}</option>`).join('');
    sel.value = NET.cls.class_id; chk.checked = NET.want; box.hidden = false;
    netNote(`Widzisz tylko kolegów z wybranej klasy na tej samej mapie · Twoja nazwa: ${NET.me.name} · bez czatu.`);
    sel.onchange = () => { NET.cls = NET.classes.find(c => c.class_id === sel.value) || NET.cls; netSavePrefs(); if (NET.on || NET.ch) { netLeave(); netJoin(); } };
    chk.onchange = () => { NET.want = chk.checked; netSavePrefs(); if (NET.want) netJoin(); else netLeave(); };
    if (NET.started) netJoin();
  } catch (e) { netNote('🌐 Gra online chwilowo niedostępna.'); }
}
function netJoin() {
  if (!NET.sb || !NET.want || !NET.cls || !NET.started || NET.ch) return;
  const topic = `gc:${NET.cls.class_id}:${MAP_ID}`;
  const ch = NET.sb.channel(topic, { config: { private: true, broadcast: { self: false }, presence: { key: NET.me.id } } });
  NET.ch = ch;
  ch.on('broadcast', { event: 'p' }, msg => netOnPos(msg.payload));
  ch.on('presence', { event: 'leave' }, ({ key }) => netRemove(key));
  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      NET.on = true; NET.sendT = 0; NET.last = null;
      ch.track({ n: NET.me.name });
      toast(`🌐 Online z klasą ${esc(NET.cls.class_name)} — widzisz kolegów na tej mapie.`, 'good', 3500);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      if (NET.ch === ch) { NET.on = false; toast('🌐 Nie udało się połączyć z klasą (sprawdź migrację #68 i logowanie).', 'bad', 4500); netLeave(); }
    }
  });
}
function netLeave() {
  if (NET.ch) { try { NET.sb.removeChannel(NET.ch); } catch (e) { /* ignore */ } }
  NET.ch = null; NET.on = false;
  for (const id of [...NET.peers.keys()]) netRemove(id);
}
function nameTag(text) {
  const c = makeCanvas(256, 64), x = c.getContext('2d');
  x.font = 'bold 30px "Barlow Condensed", sans-serif';
  const w = Math.min(244, x.measureText(text).width + 28);
  x.fillStyle = 'rgba(10,12,18,.78)'; x.beginPath(); x.roundRect ? x.roundRect(128 - w / 2, 8, w, 48, 12) : x.rect(128 - w / 2, 8, w, 48); x.fill();
  x.fillStyle = '#7fd3ff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(c, false), depthTest: false, transparent: true }));
  s.scale.set(2.6, 0.65, 1); s.renderOrder = 10;
  return s;
}
function netOnPos(d) {
  if (!d || !d.i || (NET.me && d.i === NET.me.id)) return;
  let p = NET.peers.get(d.i);
  if (!p) {
    if (NET.peers.size >= 40) return;
    p = { id: d.i, name: d.n || 'Gracz', x: d.x, y: d.y || 0, z: d.z, h: d.h || 0, tx: d.x, ty: d.y || 0, tz: d.z, th: d.h || 0, s: 0, person: null, veh: null, vkey: '', lkey: '', tag: nameTag(d.n || 'Gracz') };
    scene.add(p.tag);
    NET.peers.set(d.i, p);
    toast(`🌐 ${esc(p.name)} dołącza do gry`, '', 2200);
  }
  p.tx = d.x; p.ty = d.y || 0; p.tz = d.z; p.th = d.h || 0; p.s = d.s || 0; p.inside = !!d.in; p.t = performance.now();
  const lk = (d.l || []).join('|');
  if (lk !== p.lkey) {
    p.lkey = lk;
    if (p.person) scene.remove(p.person.g);
    const l = d.l || [];
    p.person = makePerson(lookFrom({ outfit: l[0] || 'classic', hat: l[1] || 'cap', hair: l[2] || 'blond', glasses: l[3] || 'none' }, false));
    scene.add(p.person.g);
  }
  const vk = d.v ? d.v + ':' + (d.c || 0) : '';
  if (vk !== p.vkey) {
    p.vkey = vk;
    if (p.veh) { scene.remove(p.veh.g); p.veh = null; }
    if (d.v && VSPEC[d.v]) { p.veh = makeCarMesh(d.v, d.c || 0x888888); p.veh.type = d.v; scene.add(p.veh.g); }
  }
}
function netRemove(id) {
  const p = NET.peers.get(id); if (!p) return;
  if (p.person) scene.remove(p.person.g);
  if (p.veh) scene.remove(p.veh.g);
  scene.remove(p.tag);
  NET.peers.delete(id);
}
function netTick(dt) {
  if (!NET.on || !NET.ch) return;
  // wysyłanie: w ruchu 2×/s, na stojąco co 5 s
  NET.sendT -= dt;
  const v = P.car, f = v ? v.pos : P.pos, h = v ? v.heading : P.facing;
  const moved = !NET.last || Math.hypot(f.x - NET.last.x, f.z - NET.last.z) > 0.3 || Math.abs((f.y || 0) - NET.last.y) > 0.3 || Math.abs(angDiff(h, NET.last.h)) > 0.1;
  if ((moved && NET.sendT <= 0) || NET.sendT <= -4.5) {
    NET.sendT = 0.5;
    const e = wardrobe.equip, r1 = n => Math.round(n * 10) / 10;
    const msg = { i: NET.me.id, n: NET.me.name, x: r1(indoor ? indoor.door.ax : f.x), y: r1(f.y || 0), z: r1(indoor ? indoor.door.az : f.z), h: Math.round(h * 100) / 100,
      s: r1(v ? Math.abs(v.speed) : P.speed), in: indoor ? 1 : 0, l: [e.outfit, e.hat, e.hair, e.glasses || 'none'] };
    if (v) { msg.v = v.type; msg.c = v.itemId ? vehColor(v.itemId) : (v.mesh.userData.color || 0x888888); }
    NET.ch.send({ type: 'broadcast', event: 'p', payload: msg });
    NET.last = { x: f.x, y: f.y || 0, z: f.z, h };
  }
  // inni gracze: wygładzanie ruchu, znikają po 15 s ciszy
  const now = performance.now(), k = Math.min(1, dt * 5);
  for (const p of [...NET.peers.values()]) {
    if (now - p.t > 15000) { netRemove(p.id); continue; }
    p.x = lerp(p.x, p.tx, k); p.y = lerp(p.y, p.ty, k); p.z = lerp(p.z, p.tz, k); p.h += angDiff(p.h, p.th) * k;
    const far = Math.abs(p.x - camera.position.x) > 260 || Math.abs(p.z - camera.position.z) > 260;
    const vis = !p.inside && !far && !indoor;
    const ride = p.veh && VSPEC[p.veh.type] && VSPEC[p.veh.type].ride;
    if (p.veh) { p.veh.g.visible = vis; p.veh.g.position.set(p.x, p.y, p.z); p.veh.g.rotation.y = p.h; }
    if (p.person) {
      p.person.g.visible = vis && (!p.veh || !!ride);
      const sy = p.veh && ride ? (VSPEC[p.veh.type].seatY || 0.3) : 0;
      p.person.g.position.set(p.x, p.y + sy, p.z); p.person.g.rotation.y = p.h;
      if (p.person.g.visible) animPerson(p.person, p.veh ? 0 : p.s, dt, false);
    }
    p.tag.visible = vis;
    p.tag.position.set(p.x, p.y + (p.veh && !ride ? 3.0 : 2.75), p.z);
  }
}

// ---------------------------------------------------------------- limit czasu na dojazd do misji
// 4 minuty od ustawienia GPS na misję; nie zdążysz → wracasz na start (postęp, pieniądze i zakupy zostają).
const MISSION_TIME = 240;
let mTimer = null, SPAWN = { x: 0, z: 0, facing: Math.PI };
function updateMissionTimer(dt) {
  const el = $('mtimer');
  if (!gps || gps.kind !== 'mission' || doneCount() >= MISSIONS.length) { mTimer = null; if (el) el.hidden = true; return; }
  if (!mTimer || mTimer.m !== gps.m) mTimer = { m: gps.m, left: MISSION_TIME, arrived: false };
  const focus = P.car ? P.car.pos : P.pos;
  if (!mTimer.arrived && Math.hypot(gps.m.mx - focus.x, gps.m.mz - focus.z) < 12) {
    mTimer.arrived = true;
    toast(`⏱ Na miejscu! Zostało ${fmtTime(mTimer.left)}.`, 'good', 2600);
  }
  if (!mTimer.arrived && !ui) {
    mTimer.left -= dt;
    if (mTimer.left <= 0) timeUp();
  }
  if (el) {
    el.hidden = mTimer.arrived;
    const txt = `⏱ ${fmtTime(Math.max(0, mTimer.left))}`;
    if (el.textContent !== txt) el.textContent = txt;
    el.classList.toggle('low', mTimer.left < 30);
  }
}
const fmtTime = s => { s = Math.ceil(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function timeUp() {
  if (P.car) {
    const v = P.car;
    v.kind = 'parked'; v.speed = 0; v.steer = 0; v.lean = 0; v.wheelie = 0; v.mesh.rotation.z = 0; v.mesh.rotation.x = 0;
    stopCarFx(v);
    nitroActive = false; if (v.flames) v.flames.visible = false; persistWardrobe();
    if (v.ghost) ghostVehicle(v, false);
    P.car = null; player.g.visible = true; $('speedo').hidden = true; Sound.engine(false, 0, false);
    resetPose(player);
  }
  if (chase) endChase();
  P.pos.set(SPAWN.x, groundAt(SPAWN.x, SPAWN.z), SPAWN.z); P.facing = SPAWN.facing; P.speed = 0; P.vy = 0;
  player.g.position.copy(P.pos); player.g.rotation.set(0, P.facing, 0);
  refreshNear(P.pos.x, P.pos.z);
  summonVehicle(true);
  mTimer.left = MISSION_TIME;
  Sound.failed();
  showBanner('CZAS MINĄŁ', 'Wracasz na start — spróbuj jeszcze raz!', '#ef4b4b', 3200);
  setTimeout(() => toast(`Masz ${fmtTime(MISSION_TIME)} na dotarcie do: <b>${esc(gps && gps.kind === 'mission' ? gps.m.place : '')}</b>. Postęp, pieniądze i zakupy zostają.`, '', 5000), 1200);
  computeRoute();
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
  if (REALMAP) { route = roadGraph ? graphRoute(from, t) : [{ x: from.x, z: from.z }, { x: t.x, z: t.z }]; return; }
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
const MAP_EXT = REALMAP ? W_EXT + 15 : HALF + 70, MAPS = 1024, MSC = MAPS / (2 * MAP_EXT);
const w2m = v => (v + MAP_EXT) * MSC;
const mapCanvas = makeCanvas(MAPS, MAPS);
function buildMapCanvas() {
  const g = mapCanvas.getContext('2d');
  g.fillStyle = '#1e2a22'; g.fillRect(0, 0, MAPS, MAPS);
  if (REALMAP) {
    g.fillStyle = '#2b3340'; g.fillRect(w2m(-W_EXT), w2m(-W_EXT), 2 * W_EXT * MSC, 2 * W_EXT * MSC);
    for (const pl of mapPolys) {
      g.fillStyle = pl.c;
      if (pl.tri) {
        const L = pl.tri; g.beginPath();
        for (let i = 0; i < L.f.length; i += 3) for (let k = 0; k < 3; k++) { const j = L.f[i + k] * 2, x = w2m(L.v[j]), y = w2m(L.v[j + 1]); k ? g.lineTo(x, y) : (g.closePath(), g.moveTo(x, y)); }
        g.closePath(); g.fill();
      } else {
        g.beginPath();
        for (const r of pl.rings) { for (let i = 0; i < r.length; i += 2) { const x = w2m(r[i]), y = w2m(r[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); }
        g.fill('evenodd');
      }
    }
    return;
  }
  const s = N * CELL + R;
  g.fillStyle = '#5b6578'; g.fillRect(w2m(-HALF), w2m(-HALF), s * MSC, s * MSC);
  for (const r of mapRects) { g.fillStyle = r.c; g.fillRect(w2m(r.x0), w2m(r.z0), (r.x1 - r.x0) * MSC, (r.z1 - r.z0) * MSC); }
  g.fillStyle = '#2b5d8a'; g.beginPath(); g.arc(w2m(LAKE.x), w2m(LAKE.z), LAKE.r * MSC, 0, Math.PI * 2); g.fill();
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
  for (const s of fishSpots) blip(s.x, s.z, '#4fb3ff', '≈', false);
  for (const p of NET.peers.values()) if (!p.inside) blip(p.x, p.z, '#7fd3ff', (p.name || '?')[0].toUpperCase(), false);
  for (const r of ruins) blip(r.x, r.z, save.urbex && save.urbex[r.id] ? '#45d483' : '#c9a0ff', 'U', urbexMode);
  if (season() === 'autumn') for (const mu of mushrooms) if (mu.alive && Math.hypot(mu.x - focus.x, mu.z - focus.z) < 70) { const [sx, sy] = toScreen(mu.x, mu.z); g.beginPath(); g.arc(c + sx, c + sy, 3, 0, Math.PI * 2); g.fillStyle = '#f0a43a'; g.fill(); }
  if (chase) blip(chase.v.pos.x, chase.v.pos.z, Math.floor(elapsed * 6) % 2 ? '#ff3b3b' : '#4f7bff', 'P', true);
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
  const gn = save.gems || 0, ge = $('gems'); ge.hidden = !gn; if (gn) ge.textContent = `💎 ${gn}`;
  const ub = $('urbex-tag'); ub.hidden = !urbexMode;
  $('invis-tag').hidden = !invisibleOn();
  const ot = $('online-tag'); ot.hidden = !NET.on;
  if (NET.on) { const t = `🌐 ${NET.cls.class_name} · ${NET.peers.size + 1} w grze`; if (ot.textContent !== t) ot.textContent = t; }
  const dc = doneCount();
  let ri = 0; for (let i = 0; i < RANKS.length; i++) if (dc >= RANKS[i][0]) ri = i;
  $('rank').textContent = `${RANKS[ri][1]} · ${save.xp.toLocaleString('en-US')} XP`;
  const next = RANKS[ri + 1];
  $('xpfill').style.width = next ? `${((dc - RANKS[ri][0]) / (next[0] - RANKS[ri][0])) * 100}%` : '100%';
  $('clock').textContent = clock;
  $('done-count').textContent = `${dc}/${MISSIONS.length}`;
  if (P.car) {
    $('speed').textContent = Math.round(Math.abs(P.car.speed) * 3.6);
    const cb = P.car.body, mt = cb ? 'KM/H · ' + (cb.reverse ? 'R' : Math.abs(cb.u) < 0.5 && !cb.thr ? 'N' : String(cb.gear + 1)) : P.car.spec.fly ? `KM/H · ↑ ${Math.round(P.car.pos.y - groundAt(P.car.pos.x, P.car.pos.z))} m` : isScooterType(P.car.type) ? `KM/H · ${wardrobe.smode === 'E' ? 'ECO' : wardrobe.smode}` : 'KM/H';
    if ($('speed-unit').textContent !== mt) $('speed-unit').textContent = mt;
  }
  const se = SEASONS[seasonIdx], stx = `${se.ico} ${se.name} · dzień ${seasonDay()}/${SEASON_DAYS}`;
  if ($('season').textContent !== stx) $('season').textContent = stx;
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
  } else if (indoor) {
    promptText = nearDoor ? '<kbd>E</kbd> Wyjdź na zewnątrz 🚪' : nearLabel ? `${nearLabel.ico} <b>${nearLabel.en}</b> — ${nearLabel.pl}` : '';
  } else if (nearDoor) {
    promptText = `<kbd>E</kbd> Wejdź do domu 🚪${nearDoor.gem.found ? '' : ' · 💎?'}`;
  } else if (nearPhoto) {
    promptText = `<kbd>E</kbd> Zrób zdjęcie 📸 · ${nearPhoto.pl}${save.urbex && save.urbex[nearPhoto.id] ? ' ✓' : ' · <span style="color:var(--cash)">+$100</span>'}`;
  } else if (nearPet) {
    promptText = `<kbd>T</kbd> Pogłaszcz: ${nearPet.s.ico} ${nearPet.s.pl} (<i>${nearPet.s.en}</i>)`;
  } else if (nearFish) {
    promptText = `<kbd>R</kbd> Łów ryby 🎣${season() === 'winter' ? ' (przerębel)' : ''}`;
  } else if (nearNPC) {
    promptText = `<kbd>T</kbd> Porozmawiaj: <b>${esc(nearNPC.t.name)}</b> · ${esc(nearNPC.t.role)}${nearNPC.done ? ' ✓' : ` · <span style="color:var(--cash)">+${fmtMoney(TALK_REWARD)}</span>`}`;
  } else {
    const car = vehicles.find(v => Math.hypot(v.pos.x - P.pos.x, v.pos.z - P.pos.z) < 4.5);
    if (car) promptText = `<kbd>F</kbd> ${car.ai ? 'Przejmij auto' : VNAME[car.type] ? 'Wsiądź na ' + VNAME[car.type] : car.owned ? 'Wsiądź do swojego auta' : 'Wsiądź do auta'}`;
  }
  setPrompt(promptText);
}
function tryStartMission() {
  if (indoor) { if (nearDoor) exitHome(); return; }
  if (!nearMission && nearDoor && !P.car) { enterHome(nearDoor); return; }
  if (!nearMission && nearPhoto && !P.car) { takePhoto(nearPhoto); return; }
  if (!nearMission && nearPet && !P.car) { petAnimal(nearPet); return; }
  if (!nearMission && nearFish && !P.car) { openFishing(nearFish); return; }
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
      s.newlyUnlocked.forEach((t, i) => setTimeout(() => toast(t.name === 'FINAL' ? (REALMAP ? `Odblokowano egzamin końcowy ${MAPDEF.finaleIn}!` : 'Odblokowano egzamin końcowy w City Hall!') : `Odblokowano nowe misje: poziom ${t.name}!`, 'good', 5000), 1200 + i * 400));
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
  const wSpots = [];
  if (REALMAP) {
    const cands = [];
    WD.pedPaths.forEach(p => { for (let i = 0; i < p.length; i += 8) cands.push([p[i], p[i + 1]]); });
    shuffle(cands, rand);
    for (const c of cands) {
      if (wSpots.length >= TALKS.length) break;
      if (nearMarker(c[0], c[1], 14) || Math.hypot(c[0] - WD.spawn[0], c[1] - WD.spawn[1]) < 20) continue;
      if (wSpots.every(s => Math.hypot(s[0] - c[0], s[1] - c[1]) > 70)) wSpots.push(c);
    }
  }
  for (const t of TALKS) {
    let x, z, tries = 0;
    if (REALMAP) { [x, z] = wSpots[si++ % Math.max(1, wSpots.length)] || WD.spawn; tries = 99; }
    else do {
      const [bx, bz] = NPC_SPOTS[si++ % NPC_SPOTS.length];
      const side = (si + tries) % 4, X = bx0(bx), Z = bx0(bz), mid = B / 2 + ((si * 7) % 9 - 4);
      if (side === 0) { x = X + mid; z = Z + 1.3; } else if (side === 1) { x = X + mid; z = Z + B - 1.3; }
      else if (side === 2) { x = X + 1.3; z = Z + mid; } else { x = X + B - 1.3; z = Z + mid; }
      tries++;
    } while (nearMarker(x, z, 10) && tries < 8);
    const look = Object.assign(randomLook(rand), t.look || {});
    const p = makePerson(Object.assign(look, { shadow: false }));
    p.g.position.set(x, PAVE_Y, z);
    scene.add(p.g);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: npcLabelTexture(t.name, !!wardrobe.talked[t.id]), transparent: true, depthWrite: false, fog: false }));
    label.scale.set(4.6, 1.0, 1); label.position.set(x, PAVE_Y + 2.95, z);
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
    n.p.rf.rotation.x = talking ? -0.7 + Math.sin(elapsed * 6) * 0.2 : -0.08;
    n.p.lf.rotation.x = -0.08;
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
        ${window.SFChat ? '<button class="btn ghost" id="talk-ai" type="button" title="Swobodna rozmowa po angielsku z tą postacią (AI)">💬 Porozmawiaj swobodnie</button>' : ''}
        <button class="btn ghost" id="talk-close" type="button">Zakończ rozmowę</button>
        <span class="meta">Enter — odpowiedz · Esc — wyjdź</span>
      </div>
    </div>`;
  const inp = $('talk-in');
  $('talk-form').onsubmit = e => { e.preventDefault(); if (talk.answered) nextTalk(); else if (inp.value.trim()) answerTalk(inp.value); };
  $('talk-hint').onclick = () => { const fb = $('talk-fb'); fb.className = 'feedback'; fb.innerHTML = `💡 Zacznij tak: <b>${esc(s.hint)}</b>`; inp.focus(); };
  $('talk-close').onclick = closeTalk;
  const ai = $('talk-ai'); if (ai) ai.onclick = () => openAiTalk(talk.n);
  setTimeout(() => inp.focus(), 30);
}
// Swobodna rozmowa z mieszkańcem (AI, ../ai-chat.js + Edge Function „ai”, akcja chat): w trybie słówek
// tylko o słówkach i gramatyce rozdziału (window.GC_CHAT_CTX z vocab-missions.js), w grze gramatycznej
// o życiu w mieście. Gość — kłódka.
function npcEmoji(t) {
  const l = t.look || {};
  if (/police|policj/i.test(t.role)) return '👮';
  if (l.hair === 0xd8d8d8 || /starsz|babci|grandma|grandpa/i.test(t.role + ' ' + t.name)) return l.skirt ? '👵' : '👴';
  return l.skirt || l.hairStyle === 'long' || l.hairStyle === 'bun' ? '👩' : '🧑';
}
async function aiInvoke(body) {
  const sb = window.supabase;
  if (!sb || !sb.functions) throw new Error('Brak połączenia z Sowimi Fiszkami — zaloguj się na sowiefiszki.com.');
  const { data, error } = await sb.functions.invoke('ai', { body: Object.assign({ action: 'chat' }, body) });
  if (error) {
    let msg = error.message || 'Błąd AI.';
    try { const b = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; if (b && b.message) msg = b.message; } catch (e) { /* ogólny komunikat */ }
    if (/Failed to send|FunctionsFetchError|not found|404/i.test(msg)) msg = 'Funkcja AI nie jest jeszcze wdrożona w Supabase.';
    if (/Nieznana akcja/.test(msg)) msg = 'Zaktualizuj funkcję AI w Supabase (nowa wersja index.ts).';
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.message || data.error);
  return data || {};
}
function openAiTalk(n) {
  if (!window.SFChat || !n) return;
  const t = n.t;
  $('quiz-ov').hidden = true; ui = 'aichat'; keys.clear();
  const ctx = window.GC_CHAT_CTX || { lang: 'en', level: 'A1–A2', unitName: '', words: [], grammar: [] };
  window.SFChat.open({
    persona: 'npc', name: t.name, role: t.role, emoji: npcEmoji(t), ctx, guest: GC_GUEST,
    invoke: aiInvoke,
    onGood: () => { save.xp += 2; persist(); },
    onClose: () => { talk = null; ui = null; try { canvas.focus(); } catch (e) { /* ignore */ } },
  });
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
  if (shopCat === 'settings') { renderSettings(); return; }
  const items = SHOP.filter(i => i.cat === shopCat), eq = equippedId(shopCat);
  $('shop-grid').innerHTML = items.map(it => {
    const own = !!wardrobe.owned[it.id], on = eq === it.id;
    if (it.gemSell) {
      const n = save.gems || 0;
      return `<div class="shop-item perk">
      <div class="si-ico">💎</div>
      <div class="si-nm">${esc(it.name)} · masz ${n}</div>
      <div class="si-ds">${esc(it.desc)}</div>
      <div class="si-act"><button class="btn" data-gem="1" ${n ? '' : 'disabled'}>Wymień 1 · +${fmtMoney(GEM_PRICE)}</button>${n > 1 ? `<button class="btn ghost" data-gem="all">Wszystkie · +${fmtMoney(n * GEM_PRICE)}</button>` : ''}</div></div>`;
    }
    if (it.consumable) {
      const full = wardrobe.fuel >= 0.995, pct = Math.round(wardrobe.fuel * 100);
      return `<div class="shop-item">
      <div class="si-ico">⛽</div>
      <div class="si-nm">${esc(it.name)} · teraz ${pct}%</div>
      <div class="si-ds">${esc(it.desc)}</div>
      <div class="si-act">${full ? '<span class="owned-on">✓ Bak pełny</span>' : `<button class="btn" data-fuel="1" ${save.money < it.price ? 'disabled' : ''}>Zatankuj · ${fmtMoney(it.price)}</button>`}</div></div>`;
    }
    const btn = !own ? `<button class="btn" data-buy="${it.id}" ${save.money < it.price ? 'disabled' : ''}>Kup · ${fmtMoney(it.price)}</button>`
      : it.cat === 'vehicle' ? `<button class="btn" data-call="${it.id}">🚚 Przywołaj</button>`
      : it.cat === 'extra' ? '<span class="owned-on">✓ Kupione</span>'
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
  $('shop-grid').querySelectorAll('[data-fuel]').forEach(b => b.onclick = buyFuel);
  $('shop-grid').querySelectorAll('[data-gem]').forEach(b => b.onclick = () => sellGems(b.dataset.gem === 'all'));
  $('shop-perk').hidden = !hasCashGlasses();
}
function shopIcon(it) {
  if (it.cat === 'extra') return it.id === 'nitro' ? '🔥' : it.id === 'wheelie' ? '🤸' : it.id === 'gem_sell' ? '💎' : it.id === 'invis' ? '👻' : '⛽';
  if (it.cat === 'vehicle') return { scooter: '🛴', kscooter: '🛴', moto: '🏍️', hatch: '🚗', suv: '🚙', supercar: '🏎️', lux: '🚘', plane: '✈️', pasek: '🚙', szwed: '🚙', majestat: '🚘', okularnik: '🚘' }[it.vtype] || '🚗';
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
  if (id === 'invis') { wardrobe.invisOff = false; persistWardrobe(); applyGhost(); }
  Sound.passed();
  toast(`Kupiono: ${it.name}${it.id === 'nitro' ? ' — w pojeździe przytrzymaj Shift (NITRO)!' : it.id === 'wheelie' ? ' — na hulajnodze lub motorze przytrzymaj Q (WHEELIE)!' : it.id === 'invis' ? ' — policja Cię nie widzi (I = włącz / wyłącz).' : it.perk ? ' — od teraz misje dają podwójne pieniądze!' : ''}`, 'good', 4200);
  equipItem(id);
}
function equipItem(id) {
  const it = shopItem(id); if (!it || !wardrobe.owned[id]) return;
  if (it.cat === 'extra') { renderShop(); return; }
  if (it.cat === 'vehicle') wardrobe.equip.vehicle = id;
  else wardrobe.equip[it.cat] = id.slice(it.cat.length + 1);
  persistWardrobe();
  if (it.cat !== 'vehicle') rebuildPlayer();
  renderShop();
}
// Przywołanie własnego pojazdu obok gracza (V lub przycisk w sklepie).
let summoned = null;
function summonVehicle(quiet) {
  const id = (wardrobe.equip.vehicle && wardrobe.owned[wardrobe.equip.vehicle]) ? wardrobe.equip.vehicle : 'veh_kscooter';
  const it = shopItem(id);
  if (!it) { toast('Nie masz jeszcze pojazdu — kup go w sklepie (<kbd>B</kbd>).'); return; }
  if (P.car) { toast('Najpierw wysiądź z pojazdu.'); return; }
  if (summoned && summoned !== P.car) { scene.remove(summoned.mesh); const k = vehicles.indexOf(summoned); if (k >= 0) vehicles.splice(k, 1); }
  const fx = Math.sin(P.facing), fz = Math.cos(P.facing);
  let best = null;
  const dd = it.vtype === 'plane' ? 3.2 : 1;
  for (const [ox, oz] of [[fz * 2.6 * dd, -fx * 2.6 * dd], [-fz * 2.6 * dd, fx * 2.6 * dd], [fx * 3 * dd, fz * 3 * dd], [-fx * 3 * dd, -fz * 3 * dd]]) {
    const p = { x: P.pos.x + ox, z: P.pos.z + oz };
    const rr0 = it.vtype === 'plane' ? 4.5 : isTwoWheel(it.vtype) ? 0.6 : 1.3;
    if (!pushOut(p, rr0, nearCols) && !waterHit(p.x, p.z, rr0)) { best = p; break; }
  }
  if (!best) best = { x: P.pos.x + fz * 2.6, z: P.pos.z - fx * 2.6 };
  summoned = spawnVehicle(it.vtype, vehColor(id), best.x, best.z, P.facing, 'parked', true);
  summoned.owned = true; summoned.itemId = id; summoned.pos.y = groundAt(best.x, best.z); summoned.mesh.position.copy(summoned.pos);
  if (quiet) return;
  Sound.door();
  toast(`Twój pojazd czeka obok: ${it.name}. Naciśnij <kbd>F</kbd>, aby ${isTwoWheel(it.vtype) ? 'wskoczyć' : 'wsiąść'}.`, 'good', 4000);
}
$('shop-close').addEventListener('click', closeShop);

// Ustawienia: kolory własnych pojazdów i tryb hulajnogi.
const VEH_PALETTE = [[0x2b2b2b, 'czarny'], [0xf1f2f6, 'biały'], [0xc9ccd1, 'srebrny'], [0x7f8c8d, 'grafitowy'], [0xc0392b, 'czerwony'], [0xe8410b, 'pomarańczowy'],
  [0xf2b632, 'żółty'], [0x63c132, 'limonkowy'], [0x10ac84, 'zielony'], [0x2e86de, 'niebieski'], [0x1e3799, 'granatowy'], [0x8e44ad, 'fioletowy'], [0xe84393, 'różowy'], [0x6d4c2f, 'brązowy']];
const vehColor = id => { const c = wardrobe.vcolor && wardrobe.vcolor[id]; return typeof c === 'number' ? c : (shopItem(id) || {}).color; };
const hexCss = n => '#' + n.toString(16).padStart(6, '0');
function setVehColor(id, hex) {
  wardrobe.vcolor[id] = hex; persistWardrobe();
  for (const v of vehicles) if (v.itemId === id) {
    const gh = v.ghost; if (gh) ghostVehicle(v, false);   // odcień nakładamy na oryginalny materiał
    recolorVehicle(v, hex);
    if (gh) ghostVehicle(v, true);
  }
  Sound.click(); renderShop();
}
function setScooterMode(m, quiet) {
  if (!SCOOTER_MODES[m]) return;
  wardrobe.smode = m; persistWardrobe();
  if (!quiet) { const s = SCOOTER_MODES[m]; toast(`🛴 Tryb ${s.label} (${m}) — do ${s.kmh} km/h${s.kmh >= SPEED_LIMIT_KMH ? ` · uwaga: powyżej ${SPEED_LIMIT_KMH} km/h ściga policja!` : ''}`, 'good', 3600); }
  if (ui === 'shop') renderShop();
}
function renderSettings() {
  const own = SHOP.filter(i => i.cat === 'vehicle' && wardrobe.owned[i.id]);
  const rows = own.map(it => {
    const cur = vehColor(it.id);
    return `<div class="shop-item set-row"><div class="si-ico">${shopIcon(it)}</div><div class="si-nm">${esc(it.name)}</div>
      <div class="swatches">${VEH_PALETTE.map(([c, n]) => `<button class="sw ${c === cur ? 'on' : ''}" title="${n}" style="background:${hexCss(c)}" data-vc="${it.id}" data-c="${c}"></button>`).join('')}</div></div>`;
  }).join('');
  const modes = Object.entries(SCOOTER_MODES).map(([k, s]) => `<button class="xbtn ${wardrobe.smode === k ? 'on' : ''}" data-sm="${k}">${k} · ${s.label} · ${s.kmh} km/h</button>`).join('');
  const se = SEASONS[seasonIdx], left = Math.max(1, Math.ceil((SEASON_LEN - seasonT) / 60));
  $('shop-grid').innerHTML = `
    <div class="shop-item set-wide"><div class="si-nm">🎨 Kolor pojazdu</div><div class="si-ds">Wybierz kolor dla każdego swojego pojazdu. Zmiana działa od razu — także w trakcie jazdy.</div></div>
    ${rows}
    <div class="shop-item set-wide"><div class="si-nm">🛴 Tryb hulajnogi</div><div class="si-ds">Eco — spokojnie i oszczędnie, S — sport, R — wyścig. W grze zmienisz go klawiszem <kbd>G</kbd> (na telefonie TRYB).</div><div class="set-modes">${modes}</div></div>
    ${hasInvis() ? `<div class="shop-item set-wide"><div class="si-nm">👻 Niewidzialność</div><div class="si-ds">Gdy jest włączona, policja Cię nie widzi. Klawisz <kbd>I</kbd>.</div><div class="set-modes"><button class="xbtn ${invisibleOn() ? 'on' : ''}" data-invis="1">${invisibleOn() ? '✓ Włączona — wyłącz' : 'Włącz niewidzialność'}</button></div></div>` : ''}
    <div class="shop-item set-wide"><div class="si-nm">🔦 Tryb urbex</div><div class="si-ds">Zwiedzanie opuszczonych budynków: latarka i GPS do najbliższej ruiny. Zaliczone: ${Object.keys(save.urbex || {}).length}/${ruins.length}. Klawisz <kbd>U</kbd>.</div><div class="set-modes"><button class="xbtn ${urbexMode ? 'on' : ''}" data-urbex="1">${urbexMode ? '✓ Włączony — wyłącz' : 'Włącz tryb urbex'}</button></div></div>
    <div class="shop-item set-wide"><div class="si-nm">${se.ico} Pora roku: ${se.name}</div><div class="si-ds">Pory roku zmieniają się co 3 dni gry (36 minut). Następna za ok. ${left} min.</div></div>`;
  $('shop-grid').querySelectorAll('[data-vc]').forEach(b => b.onclick = () => setVehColor(b.dataset.vc, +b.dataset.c));
  $('shop-grid').querySelectorAll('[data-sm]').forEach(b => b.onclick = () => setScooterMode(b.dataset.sm));
  $('shop-grid').querySelectorAll('[data-urbex]').forEach(b => b.onclick = () => toggleUrbex());
  $('shop-grid').querySelectorAll('[data-invis]').forEach(b => b.onclick = () => toggleInvis());
  $('shop-perk').hidden = !hasCashGlasses();
}

// ---------------------------------------------------------------- start screen
function refreshStartInfo() {
  const dc = doneCount();
  $('save-info').textContent = dc || save.money ? `Zapisany postęp: ${dc}/${MISSIONS.length} misji · ${fmtMoney(save.money)}` : '';
  $('reset-wrap').hidden = !(dc || (GC_GUEST && save.money));
}
function showResetLink() {
  const w = $('reset-wrap');
  w.innerHTML = '<button class="linkbtn" id="btn-reset">' + (GC_GUEST ? 'Zacznij od nowa' : 'Zacznij misje od nowa') + '</button>';
  $('btn-reset').onclick = () => {
    w.innerHTML = '<span>' + (GC_GUEST ? 'Usunąć cały postęp?' : 'Usunąć zaliczone misje w tym trybie? Pieniądze, diamenty i zakupy zostają.') + '</span><button class="xbtn" id="reset-yes">Tak, usuń</button><button class="xbtn" id="reset-no">Anuluj</button>';
    $('reset-yes').onclick = () => {
      // Zalogowany: tylko misje tego trybu — pieniądze i zakupy są wspólne dla wszystkich rozdziałów.
      if (GC_GUEST) { save = freshSave(); shownMoney = 0; } else { save.done = {}; save.best = {}; }
      persist(); refreshMarkers(); refreshStartInfo();
      $('btn-start').textContent = (MAPDEF && MAPDEF.enter) || 'Wejdź do miasta';
    };
    $('reset-no').onclick = showResetLink;
  };
}
showResetLink();

// ---------------------------------------------------------------- wybór mapy (ekran startowy)
function setMap(id) {
  const u = new URL(location.href);
  if (MAP_DEFS[id] || id === 'metro') u.searchParams.set('map', id); else u.searchParams.delete('map');
  location.href = u.toString();
}
function initMapPicker() {
  const box = $('map-pick'); if (!box) return;
  box.querySelectorAll('[data-map]').forEach(b => {
    b.classList.toggle('on', b.dataset.map === MAP_ID);
    b.onclick = () => { if (b.dataset.map !== MAP_ID) { Sound.click && Sound.click(); setMap(b.dataset.map); } };
  });
  const at = $('map-attrib');
  if (at) { at.hidden = !REALMAP; if (REALMAP) at.textContent = WD.attribution; }
  if (REALMAP) {
    document.querySelectorAll('.chip').forEach(c => { if (/ratusz/i.test(c.textContent)) c.textContent = 'Egzamin ' + MAPDEF.finaleIn; });
    const tl = document.querySelector('.tagline');
    if (tl) tl.textContent = tl.textContent.replace(/na ulicach Grammar City|w Grammar City/, 'na ulicach ' + MAPDEF.of).replace(/Otwarte miasto 3D/, MAPDEF.tagline);
    document.querySelectorAll('.tagline, .story').forEach(el => { el.innerHTML = el.innerHTML.replace(/egzamin w ratuszu/g, 'egzamin ' + MAPDEF.finaleIn); });
    const story = document.querySelector('#help-ov .story');
    if (story) story.insertAdjacentHTML('afterend', '<p class="story" style="font-size:13px;opacity:.75">' + esc(WD.attribution) + '</p>');
  }
}

function startGame() {
  Sound.init();
  NET.started = true; netJoin();
  $('start-ov').hidden = true; $('hud').hidden = false;
  ui = null; camYaw = 0; camPitch = 0.3; camDist = 12;
  canvas.focus();
  requestLock();
  const first = recommendMission();
  if (doneCount() === 0) {
    if (REALMAP) {
      showBanner(MAPDEF.banner[0], MAPDEF.banner[1], '#f2b632', 2600);
      setTimeout(() => toast(`Za Tobą ${MAPDEF.finalePL} — tam czeka egzamin końcowy. Najpierw zdobądź doświadczenie w okolicy.`, '', 5500), 1500);
    } else {
    showBanner('GRAMMAR CITY', 'Witaj w mieście!', '#f2b632', 2600);
    setTimeout(() => toast('Za Tobą ratusz — egzamin końcowy. Najpierw zdobądź doświadczenie w mieście.', '', 5500), 1500);
    }
    setTimeout(() => toast('Obok czeka Twoja hulajnoga 🛴, a dalej sportowe auto — podejdź i naciśnij <kbd>F</kbd>. Hulajnogę przywołasz zawsze klawiszem <kbd>V</kbd>.', '', 6500), 4200);
    setTimeout(() => toast('Mieszkańcy z dymkiem 💬 chętnie porozmawiają (<kbd>T</kbd>). Za pieniądze kupisz stroje i pojazdy w sklepie (<kbd>B</kbd>).', '', 6500), 7400);
    if (touchMode) setTimeout(() => toast('Lewy pad — ruch · przeciągnij palcem po ekranie — kamera · dotknij minimapy — mapa', '', 6500), 300);
  }
  if (first) setTimeout(() => setGPS({ kind: 'mission', m: first }), 900);
  const se = SEASONS[seasonIdx];
  setTimeout(() => toast(`${se.ico} Pora roku: <b>${se.name}</b> — ${se.sub}. Zmienia się co 3 dni gry (36 min).`, '', 6000), doneCount() === 0 ? 10800 : 1200);
  setTimeout(() => toast(`⏱ Na dojazd do każdej misji masz ${fmtTime(MISSION_TIME)} — nie zdążysz, wracasz na start.`, '', 5500), doneCount() === 0 ? 14000 : 4000);
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
    if (P.car) (P.car.spec && P.car.spec.fly ? updatePlane : updateCar)(P.car, dt); else { updateOnFoot(dt); Sound.engine(false, 0, false); Sound.skid(0); }
  }
  for (const v of vehicles) if (v.kind === 'parked') {
    const far = Math.abs(v.pos.x - focus.x) > 300 || Math.abs(v.pos.z - focus.z) > 300;   // daleko (we mgle) — nie rysujemy
    v.mesh.visible = !far;
    if (!far) { v.pos.y = groundAt(v.pos.x, v.pos.z); v.mesh.position.copy(v.pos); }
  }
  updateTraffic(dt);
  updateSmoke(dt);
  updateChase(dt);
  if (ui !== 'start') { updateSeason(dt); updateMissionTimer(dt); updateMushrooms(dt); checkFishSpots(); updateFishing(dt); checkMapEdge(dt); }
  netTick(dt);
  updateSnow(dt);
  twinkleXmas();
  updateAnimals(dt);
  if (ui !== 'start') { checkHomes(); collectGems(dt); updateFlashlight(); }
  updatePeds(dt);
  updateNPCs(dt);
  updateCamera(dt);
  updateTreeLOD(dt);
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
      gpsArrow.visible = !indoor;
      gpsArrow.position.set(focus.x, focus.y + (P.car ? 3.9 : 2.9) + Math.sin(elapsed * 3) * 0.08, focus.z);
      gpsArrow.rotation.y = Math.atan2(nx - focus.x, nz - focus.z);
    } else gpsArrow.visible = false;
    if (!ui) checkMissionProximity();
    updateTouchUI();
    hudT -= dt;
    drawMinimap(dt);
    if (hudT <= 0) { updateHUD(0.1, clockStr); updateFuelHud(); hudT = 0.1; }
  }
  const pv = P.car ? Math.abs(P.car.speed) : 0;
  renderScene(P.car && !(P.car.spec && P.car.spec.fly) ? clamp((pv - 22) / 40, 0, 0.6) : 0);   // lekkie rozmycie krawędzi przy dużej prędkości
  adaptQuality(dt);
}
// Dynamiczna jakość (słabsze laptopy): najpierw bez bloomu, potem niższa rozdzielczość, na końcu bez cieni.
let qT = 0, qFrames = 0, shadowsOff = false, fxAutoOff = false;
function adaptQuality(dt) {
  qT += dt; qFrames++;
  if (qT < 2) return;
  const fps = qFrames / qT; qT = 0; qFrames = 0;
  if (fps < 34 && postFx) { postFx = false; fxAutoOff = true; return; }
  if (fps > 58 && fxAutoOff && !postFx && pixelRatio >= Math.min(MAX_PR, 1)) { postFx = true; fxAutoOff = false; return; }
  let pr = pixelRatio;
  if (fps < 32 && pr > 0.55) pr = Math.max(0.55, pr - 0.15);
  else if (fps > 55 && pr < MAX_PR) pr = Math.min(MAX_PR, pr + 0.1);
  else if (fps < 24 && pr <= 0.55 && !shadowsOff) { shadowsOff = true; sun.castShadow = false; }
  if (pr !== pixelRatio) { pixelRatio = pr; renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight); sizeComposer(); }
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight); sizeComposer();
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
  // Zapis z serwera (migracja #72) wczytujemy równolegle z czcionkami — przed zbudowaniem świata.
  const syncP = syncSaves().then(() => { if (GCS.changed) rebuildPlayer(); })   // strój / fryzura z zapisu na serwerze
    .catch(e => console.warn('[Grammar City] synchronizacja zapisu:', e));
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px Anton'), document.fonts.load('700 20px "Barlow Condensed"'), document.fonts.load('600 20px "Barlow Condensed"')]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fonts optional */ }
  await Promise.race([syncP, new Promise(r => setTimeout(r, 4000))]);
  // Tryb słówek: misje gramatyczne z bazy (vocab-missions.js) — przed rozstawieniem misji w mieście.
  if (window.GC_MISSIONS_READY) await Promise.race([window.GC_MISSIONS_READY, new Promise(r => setTimeout(r, 4000))]);
  if (REALMAP) {
    btn.textContent = `Ładowanie mapy: ${MAPDEF.label}…`;
    try { WD = await (await fetch(MAPDEF.file)).json(); }
    catch (e) { toast(`Nie udało się wczytać mapy ${MAPDEF.of} — wracam do Grammar City.`, 'bad', 5000); setTimeout(() => setMap('grid'), 1800); return; }
  }
  buildCity();
  createMarkers();
  if (REALMAP) {
    // start przy punkcie orientacyjnym (Warszawa: Plac Defilad), plecami do miejsca egzaminu końcowego
    const [sx, sz] = WD.spawn;
    P.pos.set(sx, 0, sz);
    P.facing = Math.atan2(sx - WD.finale[0], sz - WD.finale[1]);
    player.g.position.copy(P.pos); player.g.rotation.y = P.facing;
    let best = null, bd = Infinity;
    for (const s of WD.parkSpots) { const d = Math.hypot(s[0] - sx, s[1] - sz); if (d > 10 && d < bd) { bd = d; best = s; } }
    if (best) spawnVehicle('sport', 0xf2b632, best[0], best[1], best[2], 'parked');
  } else {
  // player spawn in front of City Hall
  const sx = bc(3 + O), sz = bx0(3 + O) + B - 2.5;
  P.pos.set(sx - 6, SIDE_H, sz);
  player.g.position.copy(P.pos); player.g.rotation.y = P.facing;
  spawnVehicle('sport', 0xf2b632, sx + 4, rc(4 + O) - 6.2, Math.PI / 2, 'parked');
  }
  SPAWN = { x: P.pos.x, z: P.pos.z, facing: P.facing };
  applyGhost();
  buildFishSpots();
  buildHomes();
  buildRuins();
  buildMushrooms();
  buildSnow();
  applySeason(false);
  loadKScooter();
  spawnParked(REALMAP ? 40 : METRO ? 44 : 18);
  spawnTraffic(REALMAP ? 34 : METRO ? 64 : 40);
  spawnPeds(REALMAP ? 64 : METRO ? 96 : 62);
  spawnAnimals();
  spawnNPCs();
  buildMapCanvas();
  refreshNear(P.pos.x, P.pos.z);
  summonVehicle(true);   // własny pojazd (na start: hulajnoga Pixel Rider) stoi obok gracza
  resizeMinimap();
  refreshStartInfo();
  initMapPicker();
  btn.disabled = false; btn.textContent = doneCount() ? 'Kontynuuj grę' : ((MAPDEF && MAPDEF.enter) || 'Wejdź do miasta');
  btn.addEventListener('click', startGame);
  placeExitSigns();
  netInit();
  frame();
}
boot();
})();
