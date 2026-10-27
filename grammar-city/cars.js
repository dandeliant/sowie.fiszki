// Grammar City — realistyczne modele aut 3D.
// Port systemu z gry „Ulice Stalowic” (od właściciela Sowich Fiszek): nadwozie „loftowane” z przekrojów
// poprzecznych (linia ramion, podcięty próg, nadkola, tumblehome), szyby z uszczelkami, reflektory, lampy
// segmentowe, lusterka, wycieraczki, klamki, wnętrze z fotelami i kierownicą, koła z oponą z bieżnikiem,
// felgą z głębokim rantem i tarczą hamulcową. Wymiary aut 1:1. Nazwy ogólne / potoczne (bez znaków towarowych).
// Wymaga globalnego THREE (r160). API: window.GCCars.
(function () {
  'use strict';
  const THREE = window.THREE;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function texFrom(canvas, { srgb = true, aniso = 8, wrap = true } = {}) {
    const t = new THREE.CanvasTexture(canvas);
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
  }
  function heightToNormalCanvas(H, w, h, strength) {
    const c = mkCanvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = H[y * w + ((x - 1 + w) % w)], r = H[y * w + ((x + 1) % w)], u = H[((y - 1 + h) % h) * w + x], dn = H[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1; const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
      const i = (y * w + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0); return c;
  }
  // łączy geometrie bez indeksów, z grupami materiałów: list = [[geo, matIndex, color?], …]
  function mergeGeos(list, withColor = true) {
    const byMat = new Map();
    for (const [g0, mi, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0; if (!byMat.has(mi)) byMat.set(mi, []); byMat.get(mi).push([g, col]); }
    const P = [], N = [], U = [], C = [], groups = []; let off = 0;
    const c = new THREE.Color();
    for (const mi of [...byMat.keys()].sort((a, b) => a - b)) {
      const start = off;
      for (const [g, col] of byMat.get(mi)) {
        const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, vc = g.attributes.color;
        c.set(col ?? 0xffffff);
        for (let i = 0; i < p.count; i++) {
          P.push(p.getX(i), p.getY(i), p.getZ(i));
          if (n) N.push(n.getX(i), n.getY(i), n.getZ(i)); else N.push(0, 1, 0);
          if (u) U.push(u.getX(i), u.getY(i)); else U.push(0, 0);
          if (vc) C.push(vc.getX(i) * c.r, vc.getY(i) * c.g, vc.getZ(i) * c.b); else C.push(c.r, c.g, c.b);
        }
        off += p.count;
      }
      groups.push({ start, count: off - start, materialIndex: mi });
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    if (withColor) out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    if (groups.length > 1) for (const g of groups) out.addGroup(g.start, g.count, g.materialIndex);
    out.computeBoundingSphere();
    return out;
  }
  // rozbija geometrię z grupami na części [geo, materialIndex]
  function splitGroups(geo) {
    if (!geo.groups.length) return [[geo, 0]];
    return geo.groups.map(gr => {
      const g = new THREE.BufferGeometry();
      for (const k of Object.keys(geo.attributes)) {
        const a = geo.attributes[k], s = a.itemSize;
        g.setAttribute(k, new THREE.Float32BufferAttribute(a.array.slice(gr.start * s, (gr.start + gr.count) * s), s));
      }
      return [g, gr.materialIndex];
    });
  }

  /* ===================================================== FLOTA (wymiary 1:1)
     u = oś wzdłużna od tyłu (0) do przodu (L) [m], v = wysokość [m], x = pół-szerokość [m].
     top / bottom / belt (linia okien) / width (ramiona) / topW (dach i pokrywy): punkty kontrolne krzywych.
     cabin: rg0–rg1 tylna szyba, ws1–ws0 przednia szyba; win: boczne szyby u0–u1, słupki.
     road: zwykłe auto (bez klatki, haków holowniczych i „driftowych” dodatków). */
  const CARS = [], BY_ID = {};
  const defCar = s => { s.index = CARS.length; CARS.push(s); BY_ID[s.id] = s; return s; };

  defCar({ // mały klasyk z PRL, silnik z tyłu (port z „Ulic Stalowic”)
    id: 'maluch', rim: 'steel', rimCol: '#c9ccd0', caliper: '#3a3a3a', plate: 'prl', road: true,
    dims: { L: 3.05, W: 1.38, H: 1.33, wb: 1.84, rOver: 0.66, R: 0.27, twF: 0.155, twR: 0.165, trackF: 1.17, trackR: 1.17, camber: 0.0 },
    shape: {
      top: [[0, 0.62], [0.05, 0.72], [0.12, 0.77], [0.40, 0.85], [0.92, 1.30], [1.50, 1.335], [2.02, 1.31], [2.47, 0.87], [2.75, 0.82], [2.97, 0.71], [3.05, 0.645]],
      bottom: [[0, 0.32], [0.25, 0.22], [2.85, 0.22], [3.05, 0.32]],
      belt: [[0, 0.60], [0.40, 0.83], [2.45, 0.855], [2.9, 0.71], [3.05, 0.48]],
      width: [[0, 0.60], [0.15, 0.67], [0.5, 0.69], [2.6, 0.69], [2.9, 0.66], [3.05, 0.58]],
      topW: [[0, 0.45], [0.40, 0.60], [0.92, 0.55], [2.02, 0.56], [2.47, 0.64], [2.9, 0.60], [3.05, 0.50]],
      cabin: { rg0: 0.42, rg1: 0.92, ws1: 2.02, ws0: 2.47 }, win: { u0: 0.55, u1: 2.43, pillars: [1.12] },
      flare: { f: 0, r: 0 }, crown: 0.04, sh: 0.5, tuck: 0.02,
    },
    exhaust: [[0.35, 0.22, 0.025]], plateF: { v: 0.40 }, plateR: { v: 0.44 },
    parts: P => [
      ...P.lamp('head', 'F', 0.56, 0.48, 0.085, 1, 1, true),
      P.box('amber', P.faceF(0.03), [0.40, 0.45], [0.40, 0.54], true),
      P.box('chrome', P.faceF(0.02), [0.565, 0.58], [-0.33, 0.33]),
      P.box('chrome', [P.L - 0.04, P.L + 0.06], [0.30, 0.37], [-0.66, 0.66]),
      P.box('chrome', [-0.06, 0.04], [0.30, 0.37], [-0.66, 0.66]),
      P.box('tail', P.faceR(0.03), [0.50, 0.60], [0.44, 0.58], true),
      P.slab('grille', 0.16, 0.36, [-0.32, 0.32], 0.014),
    ],
    phys: { mass: 620, kW: 22, vmax: 33, gears: 4, first: 0.30, front: 0.40, drive: 'RWD', red: 5400, idle: 850, cyl: 2, steer: 0.62, cgH: 0.52, gripF: 1.0, gripR: 0.95, brakeG: 0.85 },
  });

  defCar({ // kanciasty sedan z lat 70.: cztery okrągłe lampy, szeroki chromowany grill, chromowane zderzaki z kłami
    id: 'kredens', rim: 'steel', rimCol: '#d7dade', caliper: '#3a3a3a', plate: 'prl', road: true,
    dims: { L: 4.22, W: 1.63, H: 1.44, wb: 2.51, rOver: 0.86, R: 0.295, twF: 0.175, twR: 0.175, trackF: 1.32, trackR: 1.29, camber: 0.0 },
    shape: {
      top: [[0, 0.80], [0.05, 0.89], [0.15, 0.925], [0.85, 0.95], [0.95, 0.96], [1.45, 1.40], [2.65, 1.44], [3.00, 1.40], [3.32, 0.965], [4.12, 0.92], [4.20, 0.87], [4.22, 0.80]],
      bottom: [[0, 0.36], [0.30, 0.21], [3.90, 0.20], [4.22, 0.33]],
      belt: [[0, 0.84], [0.95, 0.925], [3.32, 0.915], [4.12, 0.875], [4.22, 0.70]],
      width: [[0, 0.76], [0.10, 0.80], [0.50, 0.815], [3.70, 0.815], [4.10, 0.80], [4.22, 0.76]],
      topW: [[0, 0.62], [0.85, 0.72], [0.95, 0.64], [1.45, 0.60], [3.00, 0.62], [3.32, 0.74], [4.15, 0.74], [4.22, 0.66]],
      cabin: { rg0: 0.95, rg1: 1.45, ws1: 3.00, ws0: 3.32 }, win: { u0: 1.10, u1: 3.27, pillars: [2.12] },
      flare: { f: 0, r: 0 }, crown: 0.02, boxy: true, sh: 0.55, tuck: 0.02,
    },
    exhaust: [[0.45, 0.24, 0.026]], plateF: { v: 0.40 }, plateR: { v: 0.64 },
    parts: P => [
      ...P.faceUnit(0.56, 0.70, 0.44, 0.78, [{ x: 0.52, r: 0.066 }, { x: 0.70, r: 0.066 }]),
      P.box('chrome', P.faceF(0.024), [0.55, 0.71], [-0.42, 0.42]),
      P.box('grille', P.faceF(0.03), [0.565, 0.695], [-0.40, 0.40]),
      ...[-0.30, -0.15, 0, 0.15, 0.30].map(x => P.box('chrome', P.faceF(0.034), [0.565, 0.695], [x - 0.008, x + 0.008])),
      P.box('chrome', [P.L - 0.03, P.L + 0.07], [0.36, 0.43], [-0.80, 0.80]),
      P.box('trim', [P.L, P.L + 0.10], [0.33, 0.48], [0.30, 0.36], true),
      P.box('chrome', [-0.07, 0.03], [0.40, 0.47], [-0.80, 0.80]),
      P.box('trim', [-0.10, 0.0], [0.37, 0.52], [0.30, 0.36], true),
      P.box('amber', P.faceF(0.03), [0.46, 0.51], [0.58, 0.74], true),
      ...P.tailUnit(0.58, 0.74, 0.40, 0.78, 3, true),
    ],
    phys: { mass: 1010, kW: 55, vmax: 39, gears: 4, first: 0.28, front: 0.53, drive: 'RWD', red: 5600, idle: 850, cyl: 4, steer: 0.64, cgH: 0.55, gripF: 0.98, gripR: 0.93, brakeG: 0.88 },
  });

  defCar({ // polski liftback z lat 80.: klinowy przód, prostokątne reflektory, czarne zderzaki, długa skośna klapa
    id: 'poldek', rim: 'steel', rimCol: '#c9ccd0', caliper: '#3a3a3a', plate: 'eu', road: true,
    dims: { L: 4.32, W: 1.65, H: 1.38, wb: 2.51, rOver: 0.86, R: 0.295, twF: 0.175, twR: 0.175, trackF: 1.32, trackR: 1.29, camber: 0.0 },
    shape: {
      top: [[0, 0.86], [0.05, 0.94], [0.18, 0.975], [0.40, 1.0], [1.55, 1.355], [2.60, 1.38], [2.95, 1.35], [3.32, 0.955], [4.10, 0.855], [4.25, 0.80], [4.32, 0.70]],
      bottom: [[0, 0.38], [0.30, 0.21], [3.95, 0.20], [4.32, 0.31]],
      belt: [[0, 0.88], [0.40, 0.955], [3.32, 0.915], [4.10, 0.835], [4.32, 0.66]],
      width: [[0, 0.77], [0.10, 0.81], [0.50, 0.825], [3.70, 0.825], [4.15, 0.80], [4.32, 0.74]],
      topW: [[0, 0.64], [0.30, 0.72], [0.40, 0.66], [1.55, 0.60], [2.95, 0.62], [3.32, 0.76], [4.20, 0.74], [4.32, 0.64]],
      cabin: { rg0: 0.40, rg1: 1.55, ws1: 2.95, ws0: 3.32 }, win: { u0: 1.32, u1: 3.27, pillars: [2.22] },
      flare: { f: 0, r: 0 }, crown: 0.02, boxy: true, sh: 0.55, tuck: 0.025,
    },
    exhaust: [[0.50, 0.24, 0.028]], plateF: { v: 0.40 }, plateR: { v: 0.40 },
    parts: P => [
      P.box('housing', P.faceF(0.03), [0.58, 0.72], [0.36, 0.79], true),
      P.box('head', P.faceF(0.038), [0.595, 0.705], [0.40, 0.66], true),
      P.box('amber', P.faceF(0.038), [0.595, 0.705], [0.68, 0.77], true),
      P.box('glass', [P.L + 0.01, P.L + 0.03], [0.58, 0.72], [0.37, 0.78], true),
      ...P.intake(0.58, 0.72, -0.33, 0.33, { slats: 3 }),
      P.box('trim', [P.L - 0.05, P.L + 0.10], [0.30, 0.51], [-0.83, 0.83]),
      P.box('trim', [-0.10, 0.05], [0.30, 0.51], [-0.83, 0.83]),
      ...P.tailUnit(0.62, 0.80, 0.36, 0.80, 2, true),
      P.box('trim', P.faceR(0.025), [0.62, 0.80], [-0.36, 0.36]),
    ],
    phys: { mass: 1100, kW: 60, vmax: 42, gears: 5, first: 0.27, front: 0.55, drive: 'RWD', red: 5800, idle: 850, cyl: 4, steer: 0.64, cgH: 0.55, gripF: 0.99, gripR: 0.94, brakeG: 0.9 },
  });

  defCar({ // rodzinne kombi z lat 90.: zderzaki w kolorze nadwozia, relingi, kloszowe reflektory
    id: 'pasek', rim: 'five', rimCol: '#c4c9d0', caliper: '#4a4d52', plate: 'eu', road: true,
    dims: { L: 4.68, W: 1.74, H: 1.50, wb: 2.70, rOver: 1.0, R: 0.32, twF: 0.205, twR: 0.205, trackF: 1.50, trackR: 1.50, camber: 0.0 },
    shape: {
      top: [[0, 0.98], [0.04, 1.12], [0.10, 1.30], [0.22, 1.42], [0.45, 1.455], [2.75, 1.46], [3.10, 1.41], [3.56, 0.985], [4.40, 0.865], [4.60, 0.78], [4.68, 0.66]],
      bottom: [[0, 0.40], [0.30, 0.20], [4.30, 0.18], [4.68, 0.30]],
      belt: [[0, 0.95], [0.30, 1.0], [3.56, 0.935], [4.40, 0.845], [4.68, 0.66]],
      width: [[0, 0.80], [0.12, 0.85], [0.60, 0.87], [3.90, 0.87], [4.40, 0.85], [4.68, 0.76]],
      topW: [[0, 0.66], [0.22, 0.70], [0.45, 0.66], [2.75, 0.66], [3.10, 0.68], [3.56, 0.82], [4.50, 0.78], [4.68, 0.66]],
      cabin: { rg0: 0.06, rg1: 0.42, ws1: 3.10, ws0: 3.56 }, win: { u0: 0.55, u1: 3.51, pillars: [1.38, 2.38] },
      flare: { f: 0.006, r: 0.006 }, crown: 0.04, sh: 0.6, tuck: 0.035,
    },
    exhaust: [[0.50, 0.24, 0.032]], plateF: { v: 0.40 }, plateR: { v: 0.66 },
    parts: P => [
      ...P.faceUnit(0.62, 0.74, 0.40, 0.84, [{ x: 0.50, r: 0.055 }, { x: 0.70, r: 0.048 }]),
      P.box('chrome', P.faceF(0.02), [0.60, 0.75], [-0.36, 0.36]),
      P.box('grille', P.faceF(0.026), [0.615, 0.735], [-0.34, 0.34]),
      ...P.lamp('chrome', 'F', 0.675, 0, 0.045, 1, 1, false, 0.012),
      P.box('paint', [P.L - 0.05, P.L + 0.06], [0.28, 0.52], [-0.85, 0.85]),
      P.box('trim', [P.L - 0.04, P.L + 0.07], [0.29, 0.35], [-0.80, 0.80]),
      ...P.intake(0.36, 0.46, -0.50, 0.50, { slats: 1 }),
      P.box('paint', [-0.06, 0.05], [0.30, 0.55], [-0.85, 0.85]),
      ...P.tailUnit(0.80, 0.98, 0.50, 0.84, 2, true),
      P.box('trim', [0.25, 2.70], [1.46, 1.51], [0.56, 0.60], true),
      P.box('trim', [0.20, 0.30], [1.44, 1.49], [0.555, 0.605], true),
      P.box('trim', [2.62, 2.72], [1.44, 1.49], [0.555, 0.605], true),
    ],
    phys: { mass: 1450, kW: 110, vmax: 55, gears: 5, first: 0.25, front: 0.60, drive: 'FWD', red: 6200, idle: 800, cyl: 4, steer: 0.62, cgH: 0.56, gripF: 1.02, gripR: 1.0, brakeG: 1.0 },
  });

  defCar({ // kanciaste szwedzkie kombi („czołg”): duże zderzaki z chromem, wysokie pionowe lampy tylne
    id: 'szwed', rim: 'dish', rimCol: '#c9ccd0', caliper: '#4a4d52', plate: 'eu', road: true,
    dims: { L: 4.79, W: 1.71, H: 1.46, wb: 2.64, rOver: 1.15, R: 0.31, twF: 0.185, twR: 0.185, trackF: 1.42, trackR: 1.36, camber: 0.0 },
    shape: {
      top: [[0, 1.0], [0.03, 1.34], [0.10, 1.42], [2.75, 1.44], [3.05, 1.40], [3.46, 0.97], [4.70, 0.915], [4.79, 0.80]],
      bottom: [[0, 0.40], [0.30, 0.22], [4.40, 0.21], [4.79, 0.34]],
      belt: [[0, 0.98], [0.20, 1.0], [3.46, 0.94], [4.70, 0.895], [4.79, 0.76]],
      width: [[0, 0.82], [0.06, 0.85], [0.50, 0.855], [4.40, 0.855], [4.70, 0.84], [4.79, 0.80]],
      topW: [[0, 0.70], [0.10, 0.72], [2.75, 0.72], [3.05, 0.72], [3.46, 0.80], [4.60, 0.80], [4.79, 0.72]],
      cabin: { rg0: 0.02, rg1: 0.12, ws1: 3.05, ws0: 3.46 }, win: { u0: 0.30, u1: 3.41, pillars: [1.32, 2.32] },
      flare: { f: 0, r: 0 }, crown: 0.015, boxy: true, sh: 0.5, tuck: 0.02,
    },
    exhaust: [[0.55, 0.25, 0.03]], plateF: { v: 0.42 }, plateR: { v: 0.70 },
    parts: P => [
      P.box('housing', P.faceF(0.03), [0.64, 0.82], [0.36, 0.84], true),
      P.box('head', P.faceF(0.038), [0.655, 0.805], [0.40, 0.76], true),
      P.box('amber', P.faceF(0.038), [0.655, 0.805], [0.77, 0.83], true),
      P.box('glass', [P.L + 0.01, P.L + 0.03], [0.64, 0.82], [0.37, 0.84], true),
      P.box('chrome', P.faceF(0.024), [0.60, 0.85], [-0.34, 0.34]),
      P.box('grille', P.faceF(0.03), [0.615, 0.835], [-0.32, 0.32]),
      ...[-0.24, -0.12, 0, 0.12, 0.24].map(x => P.box('chrome', P.faceF(0.034), [0.615, 0.835], [x - 0.008, x + 0.008])),
      P.box('trim', [P.L - 0.06, P.L + 0.14], [0.32, 0.53], [-0.86, 0.86]),
      P.box('chrome', [P.L + 0.13, P.L + 0.145], [0.47, 0.49], [-0.84, 0.84]),
      P.box('trim', [-0.14, 0.06], [0.32, 0.53], [-0.86, 0.86]),
      P.box('chrome', [-0.145, -0.13], [0.47, 0.49], [-0.84, 0.84]),
      P.box('tail', P.faceR(0.036), [0.64, 1.24], [0.68, 0.84], true),
      P.box('trim', [0.20, 2.80], [1.44, 1.49], [0.60, 0.64], true),
      P.box('trim', [0.15, 0.25], [1.42, 1.47], [0.595, 0.645], true),
      P.box('trim', [2.75, 2.85], [1.42, 1.47], [0.595, 0.645], true),
    ],
    phys: { mass: 1400, kW: 85, vmax: 48, gears: 5, first: 0.26, front: 0.54, drive: 'RWD', red: 5800, idle: 800, cyl: 4, steer: 0.60, cgH: 0.56, gripF: 1.0, gripR: 0.95, brakeG: 0.95 },
  });

  defCar({ // niemiecki sedan z lat 90.: podwójne owalne reflektory, chromowany grill z okrągłym znaczkiem
    id: 'okularnik', rim: 'five', rimCol: '#d0d4da', caliper: '#4a4d52', plate: 'eu', road: true,
    dims: { L: 4.80, W: 1.80, H: 1.44, wb: 2.83, rOver: 1.07, R: 0.325, twF: 0.215, twR: 0.215, trackF: 1.52, trackR: 1.51, camber: 0.0 },
    shape: {
      top: [[0, 0.90], [0.06, 0.98], [0.20, 1.01], [0.85, 1.04], [0.95, 1.05], [1.60, 1.41], [2.70, 1.44], [3.10, 1.40], [3.66, 0.975], [4.55, 0.86], [4.74, 0.78], [4.80, 0.70]],
      bottom: [[0, 0.38], [0.30, 0.18], [4.40, 0.17], [4.80, 0.28]],
      belt: [[0, 0.92], [0.95, 1.0], [3.66, 0.95], [4.55, 0.84], [4.80, 0.66]],
      width: [[0, 0.80], [0.15, 0.88], [0.60, 0.90], [4.00, 0.90], [4.55, 0.87], [4.80, 0.76]],
      topW: [[0, 0.64], [0.85, 0.76], [0.95, 0.66], [1.60, 0.63], [3.10, 0.65], [3.66, 0.82], [4.60, 0.80], [4.80, 0.66]],
      cabin: { rg0: 0.95, rg1: 1.60, ws1: 3.10, ws0: 3.66 }, win: { u0: 1.30, u1: 3.61, pillars: [2.42] },
      flare: { f: 0.006, r: 0.006 }, crown: 0.035, sh: 0.6, tuck: 0.035,
    },
    exhaust: [[0.50, 0.24, 0.035]], plateF: { v: 0.40 }, plateR: { v: 0.62 },
    parts: P => [
      P.box('housing', P.faceF(0.03), [0.55, 0.73], [0.26, 0.86], true),
      ...P.lamp('head', 'F', 0.64, 0.42, 0.068, 1.35, 1, true, 0.004),
      ...P.lamp('head', 'F', 0.64, 0.68, 0.072, 1.35, 1, true, 0.004),
      P.box('glass', [P.L + 0.012, P.L + 0.034], [0.55, 0.73], [0.27, 0.85], true),
      P.box('chrome', P.faceF(0.034), [0.50, 0.75], [-0.22, 0.22]),
      P.box('grille', P.faceF(0.04), [0.52, 0.73], [-0.19, 0.19]),
      ...[0.56, 0.60, 0.64, 0.68].map(v => P.box('chrome', P.faceF(0.044), [v - 0.006, v + 0.006], [-0.19, 0.19])),
      ...P.lamp('chrome', 'F', 0.80, 0, 0.042, 1, 1, false, 0.0),
      P.box('paint', [P.L - 0.05, P.L + 0.06], [0.26, 0.50], [-0.88, 0.88]),
      P.box('clad', [P.L + 0.035, P.L + 0.07], [0.36, 0.42], [-0.86, 0.86]),
      ...P.intake(0.27, 0.35, -0.46, 0.46, { slats: 1 }),
      P.box('paint', [-0.06, 0.05], [0.28, 0.52], [-0.88, 0.88]),
      P.box('clad', [-0.07, -0.035], [0.38, 0.44], [-0.86, 0.86]),
      ...P.tailUnit(0.72, 0.88, 0.42, 0.86, 3, true),
    ],
    phys: { mass: 1500, kW: 140, vmax: 62, gears: 5, first: 0.25, front: 0.53, drive: 'RWD', red: 6200, idle: 750, cyl: 6, steer: 0.62, cgH: 0.54, gripF: 1.03, gripR: 0.97, brakeG: 1.0 },
  });

  defCar({ // długa, dwukolorowa limuzyna prestiżowa: wysoki chromowany grill, stojąca ozdoba, wąskie lampy LED
    id: 'majestat', rim: 'turbine', rimCol: '#dfe3e8', caliper: '#3a3a3a', plate: 'eu', road: true, twoTone: '#c4c8ce',
    dims: { L: 5.46, W: 1.92, H: 1.57, wb: 3.39, rOver: 1.15, R: 0.37, twF: 0.255, twR: 0.255, trackF: 1.62, trackR: 1.62, camber: 0.0 },
    shape: {
      top: [[0, 0.98], [0.06, 1.06], [0.22, 1.09], [0.95, 1.12], [1.05, 1.13], [1.85, 1.53], [3.30, 1.57], [3.75, 1.52], [4.30, 1.06], [5.20, 0.98], [5.40, 0.90], [5.46, 0.82]],
      bottom: [[0, 0.40], [0.35, 0.20], [5.00, 0.19], [5.46, 0.30]],
      belt: [[0, 1.0], [1.05, 1.08], [4.30, 1.03], [5.20, 0.96], [5.46, 0.78]],
      width: [[0, 0.86], [0.15, 0.93], [0.60, 0.96], [4.60, 0.96], [5.20, 0.93], [5.46, 0.82]],
      topW: [[0, 0.70], [0.95, 0.82], [1.05, 0.72], [1.85, 0.68], [3.75, 0.70], [4.30, 0.88], [5.30, 0.86], [5.46, 0.72]],
      cabin: { rg0: 1.05, rg1: 1.85, ws1: 3.75, ws0: 4.30 }, win: { u0: 1.45, u1: 4.25, pillars: [2.85] },
      flare: { f: 0.006, r: 0.006 }, crown: 0.03, sh: 0.62, tuck: 0.035,
    },
    exhaust: [[0.55, 0.26, 0.04], [-0.55, 0.26, 0.04]], plateF: { v: 0.42 }, plateR: { v: 0.66 },
    parts: P => [
      P.box('chrome', P.faceF(0.05), [0.48, 0.94], [-0.31, 0.31]),
      P.box('grille', P.faceF(0.055), [0.51, 0.91], [-0.27, 0.27]),
      ...[-0.22, -0.165, -0.11, -0.055, 0, 0.055, 0.11, 0.165, 0.22].map(x => P.box('chrome', P.faceF(0.06), [0.51, 0.91], [x - 0.007, x + 0.007])),
      P.box('chrome', [P.L - 0.13, P.L - 0.09], [0.98, 1.10], [-0.018, 0.018]),
      P.box('housing', P.faceF(0.03), [0.72, 0.86], [0.38, 0.90], true),
      P.box('head', P.faceF(0.038), [0.735, 0.80], [0.40, 0.88], true),
      P.box('head', P.faceF(0.04), [0.81, 0.845], [0.40, 0.88], true),
      P.box('glass', [P.L + 0.01, P.L + 0.03], [0.72, 0.86], [0.39, 0.89], true),
      P.box('silver', [P.L - 0.05, P.L + 0.07], [0.26, 0.52], [-0.94, 0.94]),
      P.box('chrome', [P.L + 0.06, P.L + 0.075], [0.40, 0.42], [-0.90, 0.90]),
      P.box('silver', [-0.07, 0.05], [0.28, 0.54], [-0.94, 0.94]),
      ...P.tailUnit(0.80, 0.94, 0.45, 0.92, 2, true),
      P.box('chrome', P.faceR(0.03), [0.83, 0.86], [-0.45, 0.45]),
    ],
    phys: { mass: 2700, kW: 450, vmax: 69, gears: 7, first: 0.20, front: 0.52, drive: 'RWD', red: 6000, idle: 650, cyl: 12, turbo: true, steer: 0.55, cgH: 0.6, gripF: 1.04, gripR: 1.0, brakeG: 1.05 },
  });

  defCar({ // współczesny sedan miejski
    id: 'sedan', rim: 'five', rimCol: '#c4c9d0', caliper: '#4a4d52', plate: 'eu', road: true,
    dims: { L: 4.60, W: 1.80, H: 1.46, wb: 2.69, rOver: 0.95, R: 0.32, twF: 0.215, twR: 0.215, trackF: 1.54, trackR: 1.52, camber: 0.0 },
    shape: {
      top: [[0, 0.92], [0.06, 0.99], [0.20, 1.03], [0.80, 1.06], [0.92, 1.07], [1.65, 1.43], [2.55, 1.46], [2.95, 1.42], [3.55, 0.99], [4.40, 0.88], [4.55, 0.78], [4.60, 0.68]],
      bottom: [[0, 0.36], [0.30, 0.18], [4.20, 0.17], [4.60, 0.28]],
      belt: [[0, 0.92], [0.92, 1.01], [3.55, 0.95], [4.40, 0.86], [4.60, 0.64]],
      width: [[0, 0.80], [0.15, 0.88], [0.60, 0.90], [3.90, 0.90], [4.40, 0.87], [4.60, 0.76]],
      topW: [[0, 0.64], [0.80, 0.76], [0.92, 0.66], [1.65, 0.62], [2.95, 0.64], [3.55, 0.82], [4.45, 0.80], [4.60, 0.64]],
      cabin: { rg0: 0.92, rg1: 1.65, ws1: 2.95, ws0: 3.55 }, win: { u0: 1.25, u1: 3.50, pillars: [2.35] },
      flare: { f: 0.008, r: 0.01 }, crown: 0.04, sh: 0.62, tuck: 0.04,
    },
    exhaust: [[0.50, 0.23, 0.035]], plateF: { v: 0.38 }, plateR: { v: 0.62 },
    parts: P => [
      ...P.headUnit(4.22, 4.50, 0.48, 0.84, 2),
      P.box('grille', P.faceF(0.03), [0.50, 0.62], [-0.36, 0.36]),
      P.box('chrome', P.faceF(0.034), [0.615, 0.628], [-0.36, 0.36]),
      ...P.intake(0.24, 0.42, -0.56, 0.56, { split: [-0.3, 0.3], fog: 0.46, fogR: 0.034 }),
      ...P.tailUnit(0.78, 0.90, 0.45, 0.86, 2, true),
      P.box('chrome', P.faceR(0.03), [0.80, 0.815], [-0.45, 0.45]),
    ],
    phys: { mass: 1350, kW: 110, vmax: 58, gears: 6, first: 0.24, front: 0.6, drive: 'FWD', red: 6300, idle: 800, cyl: 4, steer: 0.64, cgH: 0.54, gripF: 1.03, gripR: 1.0, brakeG: 1.0 },
  });

  defCar({ // hatchback miejski
    id: 'hatch', rim: 'five', rimCol: '#c4c9d0', caliper: '#4a4d52', plate: 'eu', road: true,
    dims: { L: 4.10, W: 1.78, H: 1.48, wb: 2.60, rOver: 0.70, R: 0.31, twF: 0.205, twR: 0.205, trackF: 1.53, trackR: 1.51, camber: 0.0 },
    shape: {
      top: [[0, 0.98], [0.04, 1.15], [0.12, 1.36], [0.30, 1.46], [2.15, 1.48], [2.50, 1.43], [3.05, 0.99], [3.90, 0.88], [4.05, 0.80], [4.10, 0.70]],
      bottom: [[0, 0.38], [0.25, 0.18], [3.80, 0.17], [4.10, 0.28]],
      belt: [[0, 0.98], [0.30, 1.02], [3.05, 0.95], [3.90, 0.86], [4.10, 0.66]],
      width: [[0, 0.80], [0.12, 0.87], [0.50, 0.89], [3.50, 0.89], [3.90, 0.86], [4.10, 0.76]],
      topW: [[0, 0.66], [0.12, 0.70], [0.30, 0.66], [2.50, 0.64], [3.05, 0.82], [3.95, 0.80], [4.10, 0.66]],
      cabin: { rg0: 0.05, rg1: 0.30, ws1: 2.50, ws0: 3.05 }, win: { u0: 0.62, u1: 3.0, pillars: [1.88] },
      flare: { f: 0.008, r: 0.01 }, crown: 0.04, sh: 0.62, tuck: 0.04,
    },
    exhaust: [[0.45, 0.24, 0.032]], plateF: { v: 0.38 }, plateR: { v: 0.62 },
    parts: P => [
      ...P.headUnit(3.72, 3.98, 0.46, 0.84, 2),
      P.box('grille', P.faceF(0.03), [0.50, 0.62], [-0.34, 0.34]),
      ...P.intake(0.24, 0.42, -0.56, 0.56, { split: [-0.3, 0.3] }),
      ...P.tailUnit(0.84, 1.00, 0.52, 0.86, 2, true),
    ],
    phys: { mass: 1200, kW: 90, vmax: 53, gears: 5, first: 0.25, front: 0.61, drive: 'FWD', red: 6300, idle: 800, cyl: 4, steer: 0.68, cgH: 0.54, gripF: 1.02, gripR: 1.0, brakeG: 1.0 },
  });

  defCar({ // SUV
    id: 'suv', rim: 'five', rimCol: '#c4c9d0', caliper: '#4a4d52', plate: 'eu', road: true,
    dims: { L: 4.70, W: 1.90, H: 1.72, wb: 2.75, rOver: 0.95, R: 0.37, twF: 0.235, twR: 0.235, trackF: 1.62, trackR: 1.62, camber: 0.0 },
    shape: {
      top: [[0, 1.10], [0.04, 1.30], [0.12, 1.58], [0.35, 1.70], [2.70, 1.72], [3.05, 1.66], [3.56, 1.18], [4.45, 1.06], [4.65, 0.96], [4.70, 0.82]],
      bottom: [[0, 0.48], [0.30, 0.28], [4.30, 0.27], [4.70, 0.40]],
      belt: [[0, 1.12], [0.40, 1.16], [3.56, 1.10], [4.45, 1.04], [4.70, 0.82]],
      width: [[0, 0.86], [0.12, 0.93], [0.50, 0.95], [4.10, 0.95], [4.50, 0.92], [4.70, 0.82]],
      topW: [[0, 0.72], [0.35, 0.74], [2.70, 0.72], [3.05, 0.74], [3.56, 0.88], [4.50, 0.86], [4.70, 0.72]],
      cabin: { rg0: 0.05, rg1: 0.35, ws1: 3.05, ws0: 3.56 }, win: { u0: 0.50, u1: 3.51, pillars: [1.45, 2.45] },
      flare: { f: 0.03, r: 0.03 }, crown: 0.03, sh: 0.6, tuck: 0.04,
    },
    exhaust: [[0.50, 0.32, 0.04]], plateF: { v: 0.46 }, plateR: { v: 0.74 },
    parts: P => [
      ...P.headUnit(4.30, 4.58, 0.50, 0.90, 2),
      P.box('grille', P.faceF(0.03), [0.56, 0.78], [-0.40, 0.40]),
      P.box('chrome', P.faceF(0.034), [0.66, 0.675], [-0.40, 0.40]),
      ...P.intake(0.30, 0.48, -0.60, 0.60, { split: [-0.3, 0.3], fog: 0.52, fogR: 0.036 }),
      P.box('clad', [P.L - 0.05, P.L + 0.08], [0.30, 0.40], [-0.92, 0.92]),
      ...P.tailUnit(0.95, 1.10, 0.55, 0.92, 2, true),
      P.box('clad', [-0.08, 0.05], [0.32, 0.46], [-0.92, 0.92]),
      P.box('trim', [0.30, 2.75], [1.72, 1.77], [0.60, 0.64], true),
    ],
    phys: { mass: 1700, kW: 140, vmax: 55, gears: 6, first: 0.24, front: 0.56, drive: 'AWD', red: 6000, idle: 750, cyl: 4, turbo: true, steer: 0.6, cgH: 0.68, gripF: 1.0, gripR: 0.98, brakeG: 0.98 },
  });

  defCar({ // dostawczy van
    id: 'van', rim: 'steel', rimCol: '#b9bdc2', caliper: '#3a3a3a', plate: 'eu', road: true, boxyVan: true,
    dims: { L: 5.20, W: 2.0, H: 2.20, wb: 3.30, rOver: 1.0, R: 0.36, twF: 0.215, twR: 0.215, trackF: 1.72, trackR: 1.70, camber: 0.0 },
    shape: {
      top: [[0, 2.10], [0.05, 2.20], [4.05, 2.20], [4.25, 2.12], [4.62, 1.36], [5.05, 1.15], [5.18, 1.02], [5.20, 0.90]],
      bottom: [[0, 0.50], [0.30, 0.30], [4.90, 0.28], [5.20, 0.40]],
      belt: [[0, 1.20], [3.70, 1.20], [4.62, 1.18], [5.05, 1.10], [5.20, 0.90]],
      width: [[0, 0.96], [0.10, 1.0], [4.90, 1.0], [5.20, 0.92]],
      topW: [[0, 0.92], [4.05, 0.92], [4.25, 0.92], [4.62, 0.94], [5.10, 0.94], [5.20, 0.88]],
      cabin: { rg0: 0.02, rg1: 0.04, ws1: 4.25, ws0: 4.62 }, win: { u0: 3.72, u1: 4.57, pillars: [] },
      flare: { f: 0, r: 0 }, crown: 0.02, boxy: true, sh: 0.5, tuck: 0.03,
    },
    exhaust: [[0.55, 0.32, 0.035]], plateF: { v: 0.48 }, plateR: { v: 0.62 },
    parts: P => [
      ...P.headUnit(4.86, 5.10, 0.52, 0.94, 2),
      P.box('grille', P.faceF(0.03), [0.58, 0.82], [-0.46, 0.46]),
      ...P.intake(0.32, 0.50, -0.66, 0.66, { split: [-0.33, 0.33] }),
      P.box('trim', [P.L - 0.05, P.L + 0.08], [0.32, 0.52], [-0.98, 0.98]),
      P.box('trim', [-0.08, 0.05], [0.34, 0.56], [-0.98, 0.98]),
      P.box('tail', P.faceR(0.035), [0.70, 1.30], [0.82, 0.96], true),
      P.box('trim', P.faceR(0.02), [0.70, 2.0], [-0.012, 0.012]),
    ],
    phys: { mass: 2100, kW: 100, vmax: 45, gears: 6, first: 0.22, front: 0.58, drive: 'FWD', red: 4800, idle: 750, cyl: 4, turbo: true, steer: 0.55, cgH: 0.8, gripF: 0.98, gripR: 0.96, brakeG: 0.92 },
  });

  defCar({ // sportowe coupé z tylnym napędem (port z „Ulic Stalowic”)
    id: 'kometa', rim: 'five', rimCol: '#2a2c30', caliper: '#1f5fd0', plate: 'eu',
    dims: { L: 4.43, W: 1.75, H: 1.34, wb: 2.70, rOver: 0.83, R: 0.32, twF: 0.225, twR: 0.255, trackF: 1.47, trackR: 1.49, camber: 0.04 },
    shape: {
      top: [[0, 0.84], [0.06, 0.93], [0.18, 0.97], [0.85, 1.01], [1.0, 1.02], [1.70, 1.315], [2.40, 1.34], [2.85, 1.31], [3.40, 0.925], [4.10, 0.835], [4.36, 0.765], [4.43, 0.73]],
      bottom: [[0, 0.36], [0.30, 0.16], [4.0, 0.15], [4.43, 0.26]],
      belt: [[0, 0.84], [1.0, 0.965], [2.2, 0.955], [3.40, 0.89], [4.10, 0.80], [4.43, 0.64]],
      width: [[0, 0.76], [0.15, 0.845], [0.6, 0.86], [3.7, 0.86], [4.2, 0.835], [4.43, 0.74]],
      topW: [[0, 0.60], [0.85, 0.72], [1.0, 0.64], [1.70, 0.60], [2.85, 0.62], [3.40, 0.78], [4.25, 0.76], [4.43, 0.62]],
      cabin: { rg0: 1.0, rg1: 1.70, ws1: 2.85, ws0: 3.40 }, win: { u0: 1.28, u1: 3.35, pillars: [1.78] },
      flare: { f: 0.015, r: 0.03 }, crown: 0.03, sh: 0.62, fender: { f: 0.01, r: 0.015 },
    },
    seat: '#262a33', exhaust: [[0.55, 0.24, 0.045], [0.45, 0.24, 0.045]], plateF: { v: 0.40 }, plateR: { v: 0.60 },
    parts: P => [
      ...P.faceUnit(0.59, 0.70, 0.36, 0.80, [{ x: 0.47, r: 0.048 }, { x: 0.66, r: 0.052 }]),
      P.box('chrome', P.faceF(0.02), [0.565, 0.70], [0.03, 0.20], true),
      P.box('grille', P.faceF(0.026), [0.575, 0.69], [0.045, 0.185], true),
      ...P.intake(0.25, 0.42, -0.58, 0.58, { split: [-0.25, 0.25] }),
      ...P.lamp('head', 'F', 0.35, 0.68, 0.045, 1, 1, true),
      ...P.tailUnit(0.70, 0.82, 0.40, 0.82, 2, true),
      P.box('trim', [0.08, 0.22], [0.975, 1.0], [-0.66, 0.66]),
    ],
    phys: { mass: 1360, kW: 215, vmax: 70, gears: 5, first: 0.25, front: 0.51, drive: 'RWD', red: 7400, idle: 850, cyl: 6, steer: 0.70, cgH: 0.50, gripF: 1.06, gripR: 0.97, brakeG: 1.05 },
  });

  defCar({ // niskie, szybkie coupé z podnoszonymi lampami (port z „Ulic Stalowic”)
    id: 'raiden', rim: 'six', rimCol: '#e6e7ea', caliper: '#d4161c', plate: 'eu',
    dims: { L: 4.295, W: 1.78, H: 1.23, wb: 2.425, rOver: 0.85, R: 0.32, twF: 0.235, twR: 0.255, trackF: 1.48, trackR: 1.48, camber: 0.04 },
    shape: {
      top: [[0, 0.86], [0.07, 0.92], [0.20, 0.945], [0.45, 0.975], [0.55, 0.99], [1.45, 1.20], [2.05, 1.23], [2.55, 1.18], [3.05, 0.86], [3.70, 0.73], [4.15, 0.62], [4.295, 0.48]],
      bottom: [[0, 0.36], [0.35, 0.14], [3.95, 0.13], [4.295, 0.22]],
      belt: [[0, 0.84], [0.5, 0.935], [1.6, 0.90], [3.05, 0.815], [3.70, 0.71], [4.295, 0.52]],
      width: [[0, 0.76], [0.2, 0.865], [0.65, 0.885], [1.3, 0.865], [2.6, 0.835], [3.4, 0.875], [3.95, 0.845], [4.295, 0.66]],
      topW: [[0, 0.60], [0.45, 0.74], [0.55, 0.60], [1.45, 0.56], [2.05, 0.57], [2.55, 0.60], [3.05, 0.80], [3.90, 0.76], [4.295, 0.55]],
      cabin: { rg0: 0.55, rg1: 1.45, ws1: 2.55, ws0: 3.05 }, win: { u0: 1.18, u1: 3.0, pillars: [] },
      flare: { f: 0.012, r: 0.02 }, crown: 0.04, sh: 0.68, tuck: 0.045, fender: { f: 0.045, r: 0.04 },
    },
    popups: { u0: 3.72, u1: 3.95, x0: 0.40, x1: 0.68 }, seat: '#141518',
    exhaust: [[0.56, 0.24, 0.045], [-0.56, 0.24, 0.045]], plateF: { v: 0.36 }, plateR: { v: 0.62 },
    parts: P => [
      ...P.intake(0.23, 0.42, -0.50, 0.50),
      P.box('amber', P.faceF(0.03), [0.40, 0.45], [0.53, 0.66], true),
      ...P.lamp('head', 'F', 0.30, 0.62, 0.036, 1.5, 0.75, true),
      ...P.tailUnit(0.76, 0.86, 0.25, 0.80, 2, false),
      P.box('trim', P.faceR(0.025), [0.76, 0.84], [-0.25, 0.25]),
      ...P.wing(0.22, 1.03, 0.74, 0.22, 'paint'),
    ],
    phys: { mass: 1290, kW: 206, vmax: 70, gears: 5, first: 0.24, front: 0.50, drive: 'RWD', red: 8500, idle: 1000, cyl: 4, turbo: true, steer: 0.70, cgH: 0.46, gripF: 1.06, gripR: 0.97, brakeG: 1.05 },
  });

  // typy pojazdów Grammar City → modele (taksówka i radiowóz to sedan z dodatkami)
  const TYPE_MODEL = { sedan: 'sedan', taxi: 'sedan', police: 'sedan', hatch: 'hatch', suv: 'suv', van: 'van', sport: 'kometa', supercar: 'raiden', lux: 'okularnik',
    maluch: 'maluch', kredens: 'kredens', poldek: 'poldek', pasek: 'pasek', szwed: 'szwed', okularnik: 'okularnik', majestat: 'majestat' };

  /* ===================================================== MATERIAŁY */
  const MI = { paint: 0, glass: 1, chrome: 2, trim: 3, head: 4, tail: 5 };
  const TRIMCOL = { trim: 0x121315, black: 0x121315, seal: 0x0b0b0c, grille: 0x07080a, clad: 0x5f6265, silver: 0xb9bdc3, amber: 0xe08a12, well: 0x070707, interior: 0x1a1b1e, seat: 0x26272b, cage: 0x2a2c30, carbon: 0x17181b, dash: 0x141518, housing: 0x0d0e10, towR: 0xd61f26, towY: 0xf0c014, wiper: 0x0e0e0f };
  const glowCanvas = (() => { const S = 128, c = mkCanvas(S, S), g = c.getContext('2d'), gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); return c; })();
  const CARMAT = {};
  function makeFlakeNormal() {
    const S = 256, c = mkCanvas(S, S), g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data, rnd = mulberry32(31337);
    for (let i = 0; i < S * S; i++) { const a = rnd() * TAU, r = Math.pow(rnd(), 2) * 0.6; d[i * 4] = 128 + Math.cos(a) * r * 127; d[i * 4 + 1] = 128 + Math.sin(a) * r * 127; d[i * 4 + 2] = 255; d[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0);
    const t = texFrom(c, { srgb: false }); t.repeat.set(36, 14); return t;
  }
  function makeTireMap() {   // napisy na bokach opon (oba boki)
    const Wd = 2048, Hh = 288, c = mkCanvas(Wd, Hh), g = c.getContext('2d'), band = Hh / 9;
    g.fillStyle = '#19191b'; g.fillRect(0, 0, Wd, Hh);
    const txt = (y0, flip) => {
      g.save(); g.translate(Wd / 2, y0 + band / 2); if (flip) g.rotate(Math.PI);
      g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#cfd0d2';
      for (const [t, x] of [['GRAMMAR TYRES', -760], ['ALL SEASON', -400], ['205/55 R16', -60], ['GRAMMAR TYRES', 260], ['M+S', 600], ['◆', 880]]) {
        g.font = (t === 'GRAMMAR TYRES' ? 'italic 900 28px' : '700 19px') + ' "Barlow Condensed","Arial Narrow",sans-serif'; g.fillText(t, x, 1);
      }
      g.restore();
    };
    txt(Hh - band, false); txt(0, true);
    const t = texFrom(c, { wrap: false, aniso: 8 }); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; return t;
  }
  function makeTreadNormal() {
    const Wd = 256, Hh = 64, H = new Float32Array(Wd * Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < Wd; x++) {
      const yy = y / Hh; let h = 1;
      if (Math.abs(yy - 0.32) < 0.035 || Math.abs(yy - 0.68) < 0.035) h = 0;
      if (yy > 0.06 && yy < 0.27 && ((x + (yy * 40 | 0)) % 24) < 3) h = 0.25;
      if (yy > 0.73 && yy < 0.94 && ((x + 12 - (yy * 40 | 0)) % 24) < 3) h = 0.25;
      if (yy > 0.38 && yy < 0.62 && (x % 48) < 2) h = 0.4;
      if (yy < 0.05 || yy > 0.95) h = 0.7;
      H[y * Wd + x] = h;
    }
    const t = texFrom(heightToNormalCanvas(H, Wd, Hh, 3.0), { srgb: false }); t.repeat.set(5, 1); return t;
  }
  function initCarMaterials() {
    if (CARMAT.glass) return;
    CARMAT.glass = new THREE.MeshPhysicalMaterial({ color: 0x0c141c, metalness: 0.0, roughness: 0.02, transparent: true, opacity: 0.6, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8, specularIntensity: 1, depthWrite: false });
    CARMAT.chrome = new THREE.MeshStandardMaterial({ color: 0xeef1f4, metalness: 1, roughness: 0.07, envMapIntensity: 1.5 });
    CARMAT.trim = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide });
    CARMAT.tire = new THREE.MeshStandardMaterial({ color: 0xffffff, map: makeTireMap(), roughness: 0.88, metalness: 0, normalMap: makeTreadNormal(), normalScale: new THREE.Vector2(1.2, 1.2) });
    CARMAT.brake = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.65, roughness: 0.35 });
    CARMAT.flakes = makeFlakeNormal();
    CARMAT.head = new THREE.MeshStandardMaterial({ color: 0x8e98a2, emissive: 0xfff0d2, emissiveIntensity: 0, metalness: 0.95, roughness: 0.12, envMapIntensity: 1.5 });
    CARMAT.tail = new THREE.MeshStandardMaterial({ color: 0x8a0c0c, emissive: 0xff1a12, emissiveIntensity: 0.15, metalness: 0.3, roughness: 0.12 });
    const glowTex = texFrom(glowCanvas, { wrap: false });
    CARMAT.shadow = new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 });
    CARMAT.glowHead = new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    CARMAT.glowTail = new THREE.SpriteMaterial({ map: glowTex, color: 0xff1c10, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    CARMAT.plates = plateAtlas();
  }

  /* ===================================================== KRZYWE I PRZEKROJE */
  function monoCurve(pts) {
    const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = new Array(n).fill(0);
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return x => {
      if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] > x) hi = mid; else lo = mid; }
      const h = xs[hi] - xs[lo], t = (x - xs[lo]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[lo] + (t3 - 2 * t2 + t) * h * m[lo] + (-2 * t3 + 3 * t2) * ys[hi] + (t3 - t2) * h * m[hi];
    };
  }
  const SEGS = [[0, 1, 1, 0], [1, 2, 1, 0], [2, 3, 2, 0], [3, 4, 2, 1], [4, 5, 3, 1], [5, 6, 3, 1], [6, 7, 2, 1], [7, 8, 3, 1], [8, 9, 6, 1], [9, 10, 5, 1], [10, 11, 3, 1]];
  const JP = [0]; for (const [a, b, n] of SEGS) JP[b] = JP[a] + n;
  const NPT = JP[11] + 1;
  function crPt(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
  }
  function makeShape(spec) {
    const D = spec.dims, s = spec.shape;
    const S = { L: D.L, top: monoCurve(s.top), bottom: monoCurve(s.bottom), belt: monoCurve(s.belt), width: monoCurve(s.width), topW: monoCurve(s.topW), cabin: s.cabin, win: s.win,
      flare: s.flare || { f: 0, r: 0 }, crown: s.crown || 0.03, boxy: !!s.boxy, sh: s.sh ?? 0.6, tuck: s.tuck ?? 0.035, bulge: s.bulge ?? 0.01, fender: s.fender || { f: 0, r: 0 } };
    S.uR = D.rOver; S.uF = D.rOver + D.wb; S.R = D.R; S.rA = D.R + 0.035;
    S.xwF = D.trackF / 2 - D.twF / 2 - 0.045; S.xwR = D.trackR / 2 - D.twR / 2 - 0.045;
    return S;
  }
  function ctrlAt(S, u) {
    const vB = S.bottom(u), vT0 = S.top(u), vBe = Math.min(S.belt(u), vT0 - 0.025), W0 = S.width(u), Wt = Math.min(S.topW(u), W0 - 0.06);
    let fl = 0;
    for (const [uA, f] of [[S.uF, S.flare.f], [S.uR, S.flare.r]]) { const t = Math.abs(u - uA) / (S.rA + 0.34); if (t < 1) fl = Math.max(fl, f * (0.5 + 0.5 * Math.cos(t * Math.PI))); }
    let pk = 0; const pkMax = Math.max(S.fender.f, S.fender.r, 1e-6);
    { const t = Math.abs(u - S.uF) / (S.rA + 0.5); if (t < 1) pk = Math.max(pk, S.fender.f * (0.5 + 0.5 * Math.cos(t * Math.PI)) * smoothstep(S.cabin.ws0 - 0.05, S.cabin.ws0 + 0.3, u)); }
    { const t = Math.abs(u - S.uR) / (S.rA + 0.5); if (t < 1) pk = Math.max(pk, S.fender.r * (0.5 + 0.5 * Math.cos(t * Math.PI)) * (1 - smoothstep(S.cabin.rg0 - 0.3, S.cabin.rg0 + 0.05, u))); }
    const pkN = pk / pkMax;
    let arch = false, vWs = vB, xw = Math.min(S.xwF, S.xwR);
    for (const [uA, xwA] of [[S.uF, S.xwF], [S.uR, S.xwR]]) { const du = u - uA; if (Math.abs(du) < S.rA) { arch = true; vWs = S.R + Math.sqrt(S.rA * S.rA - du * du); xw = xwA; } }
    const shd = S.boxy ? 0.022 : 0.045, P = new Array(12);
    P[0] = [0, vB];
    P[1] = [xw, vB];
    P[2] = [xw, arch ? vWs : vB];
    P[3] = [W0 - 0.15 + fl * 0.5, arch ? vWs : vB];
    P[4] = [W0 - S.tuck + fl * 0.85, arch ? vWs + 0.022 : vB + 0.06];
    P[5] = [W0 + fl + S.bulge, Math.max(vB + S.sh * (vBe - vB), arch ? vWs + 0.05 : 0)];
    P[6] = [W0 + fl * 0.45 - (S.boxy ? 0 : 0.006), Math.max(vBe - (S.boxy ? 0.022 : 0.04), P[5][1] + 0.02)];
    P[7] = [W0 - shd, Math.max(vBe + pk * 0.45, P[6][1] + 0.01)];
    const vT = Math.max(vT0, P[7][1] + 0.02 - pk * 0.6);
    P[8] = [lerp(P[7][0], Wt, 0.12 + 0.28 * pkN), lerp(P[7][1], vT, 0.10) + pk];
    P[9] = [Wt - 0.04 * pkN, lerp(P[7][1], vT, 0.90) + pk * 0.35];
    P[10] = [Wt * 0.55, vT - S.crown * 0.3 + pk * 0.04];
    P[11] = [0, vT];
    return { P, arch };
  }
  function sampleSection(P) {
    const out = [P[0]];
    for (const [a, b, n, sm] of SEGS) for (let k = 1; k <= n; k++) {
      const t = k / n;
      if (!sm) out.push([lerp(P[a][0], P[b][0], t), lerp(P[a][1], P[b][1], t)]);
      else out.push(crPt(P[Math.max(3, a - 1)], P[a], P[b], P[Math.min(11, b + 1)], t));
    }
    return out;
  }
  function sectionAt(S, u, shrink = 1) {
    const c = ctrlAt(S, u), pts = sampleSection(c.P);
    if (shrink !== 1) { let vc = 0; for (const p of pts) vc += p[1]; vc /= pts.length; for (const p of pts) { p[0] *= shrink; p[1] = vc + (p[1] - vc) * (1 - (1 - shrink) * 0.8); } }
    return { pts, arch: c.arch };
  }
  function surfAt(S, u, x) {
    const pts = sectionAt(S, u).pts; let best = -1;
    for (let j = JP[6]; j < NPT - 1; j++) { const a = pts[j], b = pts[j + 1]; if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) { const t = (x - a[0]) / (b[0] - a[0]); best = Math.max(best, lerp(a[1], b[1], t)); } }
    if (best > 0) return best;
    return x >= pts[JP[6]][0] ? pts[JP[6]][1] : pts[NPT - 1][1];
  }
  function halfWidthAt(S, u, v, shrink = 1) {
    const pts = sectionAt(S, clamp(u, 0, S.L), shrink).pts; let best = 0;
    for (let j = JP[3]; j < NPT - 1; j++) { const a = pts[j], b = pts[j + 1]; if ((a[1] - v) * (b[1] - v) <= 0 && a[1] !== b[1]) { const t = (v - a[1]) / (b[1] - a[1]); best = Math.max(best, lerp(a[0], b[0], t)); } }
    return best;
  }
  function surfFrame(S, u, x) {
    const e = 0.012, ax = Math.abs(x), v = surfAt(S, u, ax);
    const vu = surfAt(S, u + e, ax) - surfAt(S, u - e, ax), vx = surfAt(S, u, ax + e) - surfAt(S, u, Math.max(0, ax - e));
    return { v, n: new THREE.Vector3(-vx * Math.sign(x || 1), 2 * e, -vu).normalize() };
  }

  /* ===================================================== GEOMETRIA AUTA */
  const CARGEO = new Map(), END_SHRINK = 0.93;
  function getCarGeo(spec) {
    if (CARGEO.has(spec.id)) return CARGEO.get(spec.id);
    const D = spec.dims, ph = spec.phys, S = makeShape(spec), L = D.L;
    const b = ph.front * D.wb, a = D.wb - b, uCG = D.rOver + b;
    const cab = S.cabin, win = S.win, classic = spec.plate === 'prl' || spec.road;
    let us = [];
    for (let u = 0; u <= L + 1e-6; u += 0.05) us.push(u);
    const key = [0.012, 0.03, 0.055, L - 0.055, L - 0.03, L - 0.012, cab.rg0, cab.rg1, cab.ws1, cab.ws0, cab.rg0 + 0.03, cab.rg1 - 0.03, cab.ws1 + 0.03, cab.ws0 - 0.03, win.u0, win.u1, win.u0 - 0.03, win.u1 + 0.03];
    for (const p of win.pillars) key.push(p - 0.045, p + 0.045);
    for (const uA of [S.uF, S.uR]) key.push(uA - S.rA - 0.003, uA - S.rA + 0.003, uA + S.rA - 0.003, uA + S.rA + 0.003, uA);
    us = us.concat(key.filter(u => u > 0 && u < L)).sort((x, y) => x - y);
    const U = []; for (const u of us) if (!U.length || u - U[U.length - 1] > 0.004) U.push(u);
    if (U[U.length - 1] < L) U.push(L); else U[U.length - 1] = L;
    U[0] = 0;
    const nS = U.length;
    const inCab = u => u > cab.rg0 + 0.01 && u < cab.ws0 - 0.01;
    const inPillar = u => win.pillars.some(p => Math.abs(u - p) < 0.045);
    const inSide = u => u > win.u0 && u < win.u1 && inCab(u) && !inPillar(u);
    const inSideExt = u => u > win.u0 - 0.03 && u < win.u1 + 0.03 && inCab(u);
    const inWS = u => u > cab.ws1 + 0.03 && u < cab.ws0 - 0.03, inRG = u => u > cab.rg0 + 0.03 && u < cab.rg1 - 0.03;
    const inTopExt = u => (u > cab.ws1 && u < cab.ws0) || (u > cab.rg0 && u < cab.rg1);
    const pos = [], uv = [], col = [], secs = [];
    for (let i = 0; i < nS; i++) {
      const u = U[i], de = Math.min(u, L - u), shr = de < 0.0005 ? END_SHRINK : de < 0.06 ? 1 - (1 - END_SHRINK) * Math.pow(1 - de / 0.06, 2.2) * 0.75 : 1;
      const sc = sectionAt(S, u, shr); secs.push(sc);
      for (let h = 0; h < 2; h++) {
        const sx = h === 0 ? 1 : -1;
        for (let j = 0; j < NPT; j++) {
          const [x, v] = sc.pts[j];
          pos.push(sx * x, v, u - uCG);
          uv.push(u / L, h === 0 ? 1 - 0.5 * j / (NPT - 1) : 0.5 * j / (NPT - 1));
          col.push(0.035, 0.035, 0.037);
        }
      }
    }
    const vid = (i, h, j) => (i * 2 + h) * NPT + j;
    const idx = { paint: [], glass: [], trim: [], chrome: [] };
    const pillarMat = classic ? 'paint' : 'trim', sealMat = spec.plate === 'prl' ? 'chrome' : 'trim';
    for (let i = 0; i < nS - 1; i++) {
      const um = (U[i] + U[i + 1]) / 2;
      for (let j = 0; j < NPT - 1; j++) {
        let m = 'paint';
        if (j < JP[3]) m = 'trim';
        else if (j >= JP[8] && j < JP[9] - 1) { if (inSide(um)) m = 'glass'; else if (inPillar(um) && inCab(um)) m = pillarMat; else if (inSideExt(um)) m = sealMat; }
        else if ((j === JP[8] - 1 || j === JP[9] - 1) && inSideExt(um)) m = sealMat;
        else if (j >= JP[9] + 2 && (inWS(um) || inRG(um))) m = 'glass';
        else if (j >= JP[9] + 1 && inTopExt(um)) m = sealMat;
        for (let h = 0; h < 2; h++) {
          const A = vid(i, h, j), B = vid(i + 1, h, j), C = vid(i + 1, h, j + 1), Dd = vid(i, h, j + 1);
          if (h === 0) idx[m].push(A, Dd, B, Dd, C, B); else idx[m].push(A, B, Dd, Dd, B, C);
        }
      }
    }
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    shell.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    shell.setIndex(idx.paint.concat(idx.glass, idx.trim, idx.chrome));
    shell.computeVertexNormals();
    { const n = shell.attributes.normal;
      for (let i = 0; i < nS; i++) for (let h = 0; h < 2; h++) for (const j of [0, NPT - 1]) { const k = vid(i, h, j); const y = n.getY(k), z = n.getZ(k), l = Math.hypot(y, z) || 1; n.setXYZ(k, 0, y / l, z / l); } }
    const sub = list => { const g = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'uv', 'color']) g.setAttribute(k, shell.attributes[k]); g.setIndex(list); return g.toNonIndexed(); };
    const parts = [];
    const add = (geo, m, colOverride) => {
      if (TRIMCOL[m] !== undefined) { parts.push([geo, MI.trim, colOverride ?? TRIMCOL[m]]); return; }
      if (m === 'paint' && geo.attributes.uv) { const t = geo.attributes.uv; for (let i = 0; i < t.count; i++) t.setXY(i, 0.002, 0.25); }
      parts.push([geo, MI[m], 0xffffff]);
    };
    parts.push([sub(idx.paint), MI.paint, 0xffffff], [sub(idx.glass), MI.glass, 0xffffff], [sub(idx.trim), MI.trim, 0xffffff]);
    if (idx.chrome.length) parts.push([sub(idx.chrome), MI.chrome, 0xffffff]);
    // zaślepki przód / tył (lico zderzaka)
    for (const end of [0, nS - 1]) {
      const loop = [];
      for (let j = 0; j < NPT; j++) loop.push(secs[end].pts[j]);
      for (let j = NPT - 1; j >= 0; j--) loop.push([-secs[end].pts[j][0], secs[end].pts[j][1]]);
      let cx = 0, cy = 0; for (const p of loop) { cx += p[0]; cy += p[1]; } cx /= loop.length; cy /= loop.length;
      const z = U[end] - uCG, P2 = [], N2 = [], UV2 = [], front = end !== 0, nz = front ? 1 : -1;
      for (let k = 0; k < loop.length - 1; k++) { const p = loop[k], q = loop[k + 1], tri = front ? [[cx, cy], q, p] : [[cx, cy], p, q]; for (const t of tri) { P2.push(t[0], t[1], z); N2.push(0, 0, nz); UV2.push(0.002, 0.25); } }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N2, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV2, 2));
      const v0 = new THREE.Vector3(P2[0], P2[1], P2[2]), v1 = new THREE.Vector3(P2[3], P2[4], P2[5]), v2 = new THREE.Vector3(P2[6], P2[7], P2[8]);
      if (v1.sub(v0).cross(v2.sub(v0)).z * nz < 0) { const p = g.attributes.position; for (let k = 0; k < p.count; k += 3) { const x = p.getX(k + 1), y = p.getY(k + 1), zz = p.getZ(k + 1); p.setXYZ(k + 1, p.getX(k + 2), p.getY(k + 2), p.getZ(k + 2)); p.setXYZ(k + 2, x, y, zz); } }
      parts.push([g, MI.paint, 0xffffff]);
    }
    // API detali (części definiowane w spec.parts)
    const headPts = [], tailPts = [], exhaustPts = [];
    const boxG = (m, u0, u1, v0, v1, x0, x1, c) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(v1 - v0), Math.abs(u1 - u0)); g.translate((x0 + x1) / 2, (v0 + v1) / 2, (u0 + u1) / 2 - uCG); add(g, m, c); return g; };
    const faceHW = (front, v) => halfWidthAt(S, front ? L : 0, v, END_SHRINK) - 0.015;
    const P = {
      L, top: S.top, bottom: S.bottom, belt: S.belt, width: S.width,
      faceF: d => ({ face: 'F', d }), faceR: d => ({ face: 'R', d }),
      box: (m, uS, v, x, sym = false) => ({ t: 'box', m, uS, v, x, sym }),
      lamp: (m, face, v, x, r, sx = 1, sy = 1, sym = true, du = 0) => [{ t: 'disc', m: 'chrome', face, v, x, r: r + 0.013, sx, sy, d: 0.022, du: du - 0.003, sym }, { t: 'disc', m, face, v, x, r, sx, sy, d: 0.03, du, sym }],
      slab: (m, uA, uB, x, th) => ({ t: 'patch', m, uA, uB, x, off: th }),
      vent: (uA, uB, xh) => [{ t: 'patch', m: 'trim', uA, uB, x: [-xh, xh], off: 0.006 }, ...[0.2, 0.4, 0.6, 0.8].map(k => ({ t: 'patch', m: 'grille', uA: lerp(uA, uB, k) - 0.012, uB: lerp(uA, uB, k) + 0.012, x: [-xh + 0.02, xh - 0.02], off: 0.012 }))],
      wing: (u, v, span, chord, m) => [{ t: 'wing', u, v, span, chord, m }],
      intake: (v0, v1, x0, x1, o = {}) => {
        const out = [{ t: 'box', m: 'trim', uS: { face: 'F', d: 0.03 }, v: [v0, v1], x: [x0, x1] }];
        out.push({ t: 'box', m: 'grille', uS: [L - 0.03, L + 0.016], v: [v0 + 0.016, v1 - 0.016], x: [x0 + 0.02, x1 - 0.02], clampFace: 'F' });
        const ns = o.slats ?? Math.max(1, Math.round((v1 - v0) / 0.045) - 1);
        for (let k = 1; k <= ns; k++) { const v = lerp(v0, v1, k / (ns + 1)); out.push({ t: 'box', m: 'trim', uS: [L - 0.03, L + 0.021], v: [v - 0.0045, v + 0.0045], x: [x0 + 0.02, x1 - 0.02], clampFace: 'F' }); }
        if (o.split) for (const xs of o.split) out.push({ t: 'box', m: o.splitM || 'trim', uS: [L - 0.03, L + 0.022], v: [v0 + 0.01, v1 - 0.01], x: [xs - 0.012, xs + 0.012], clampFace: 'F' });
        if (o.fog) out.push(...P.lamp('head', 'F', o.fogV ?? (v0 + v1) / 2, o.fog, o.fogR ?? Math.min(0.042, (v1 - v0) * 0.32), 1, 1, true, 0.004));
        return out;
      },
      headUnit: (uA, uB, x0, x1, proj = 2, drl = true) => {
        const out = [{ t: 'patch', m: 'housing', uA, uB, x: [x0, x1], off: 0.006 }];
        for (let k = 0; k < proj; k++) out.push({ t: 'proj', u: lerp(uA, uB, 0.55), x: lerp(x0 + 0.05, x1 - 0.05, proj > 1 ? k / (proj - 1) : 0.5), r: Math.min(0.042, (x1 - x0) / proj * 0.3) });
        if (drl) out.push({ t: 'patch', m: 'head', uA: uB - 0.035, uB: uB - 0.016, x: [x0 + 0.03, x1 - 0.02], off: 0.011, noGlow: true });
        out.push({ t: 'patch', m: 'glass', uA: uA - 0.006, uB: uB + 0.006, x: [x0 - 0.006, x1 + 0.006], off: 0.03 });
        return out;
      },
      faceUnit: (v0, v1, x0, x1, lamps) => [
        { t: 'box', m: 'housing', uS: { face: 'F', d: 0.03 }, v: [v0, v1], x: [x0, x1], sym: true },
        ...lamps.flatMap(l => [{ t: 'disc', m: 'chrome', face: 'F', v: l.v ?? (v0 + v1) / 2, x: l.x, r: l.r * 1.22, sx: 1, sy: 1, d: 0.02, du: 0.0, sym: true }, { t: 'disc', m: 'head', face: 'F', v: l.v ?? (v0 + v1) / 2, x: l.x, r: l.r, sx: 1, sy: 1, d: 0.028, du: 0.006, sym: true }]),
        { t: 'box', m: 'glass', uS: [L + 0.012, L + 0.034], v: [v0, v1], x: [x0, x1], sym: true, clampFace: 'F' },
      ],
      tailUnit: (v0, v1, x0, x1, segs = 3, rev = true) => {
        const out = [{ t: 'box', m: 'housing', uS: { face: 'R', d: 0.03 }, v: [v0, v1], x: [x0, x1], sym: true }];
        const gap = 0.006, hh = (v1 - v0 - gap * (segs + 1)) / segs;
        for (let k = 0; k < segs; k++) {
          const a0 = v0 + gap + k * (hh + gap), xa = rev && k === 1 ? x0 + 0.1 : x0 + 0.012;
          out.push({ t: 'box', m: 'tail', uS: { face: 'R', d: 0.036 }, v: [a0, a0 + hh], x: [xa, x1 - 0.012], sym: true });
          if (rev && k === 1) out.push({ t: 'box', m: 'chrome', uS: { face: 'R', d: 0.035 }, v: [a0, a0 + hh], x: [x0 + 0.012, x0 + 0.09], sym: true });
        }
        return out;
      },
    };
    const resolveU = uS => Array.isArray(uS) ? uS : uS.face === 'F' ? [L - uS.d, L + 0.012] : [-0.012 - (uS.d > 0.033 ? 0.006 : 0), uS.d];
    const placeDisc = (m, cx, cy, cz, r, d, axis) => { const g = new THREE.CylinderGeometry(r, r, d, 22); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)); g.translate(cx, cy, cz); add(g, m); };
    const emit = p => {
      if (p.t === 'box') {
        const [u0, u1] = resolveU(p.uS);
        let [x0, x1] = p.x;
        const cf = !Array.isArray(p.uS) ? p.uS.face : p.clampFace;
        if (cf) { const hw = faceHW(cf === 'F', (p.v[0] + p.v[1]) / 2); x1 = Math.min(x1, hw); x0 = Math.max(x0, -hw); if (x1 <= x0) return; }
        for (const [a0, a1] of (p.sym ? [[x0, x1], [-x1, -x0]] : [[x0, x1]])) {
          boxG(p.m, u0, u1, p.v[0], p.v[1], a0, a1);
          if (p.m === 'tail') tailPts.push([(a0 + a1) / 2, (p.v[0] + p.v[1]) / 2, (u0 + u1) / 2 - uCG, Math.abs(a1 - a0), Math.abs(p.v[1] - p.v[0])]);
          if (p.m === 'head' && cf === 'F') headPts.push([(a0 + a1) / 2, (p.v[0] + p.v[1]) / 2, u1 - uCG, Math.abs(a1 - a0), Math.abs(p.v[1] - p.v[0])]);
        }
      } else if (p.t === 'disc') {
        const front = p.face === 'F', hw = faceHW(front, p.v), x = Math.min(p.x, hw - p.r * p.sx);
        const uf = front ? L + 0.004 + p.du : -0.004 - p.du, zc = front ? uf - p.d / 2 + 0.012 : uf + p.d / 2 - 0.012;
        for (const xx of (p.sym ? [x, -x] : [x])) {
          const g = new THREE.CylinderGeometry(p.r, p.r, p.d, 24); g.rotateX(Math.PI / 2); g.scale(p.sx, p.sy, 1); g.translate(xx, p.v, zc - uCG); add(g, p.m);
          if (p.m === 'head' && front && p.v > 0.45) headPts.push([xx, p.v, zc - uCG, p.r * 2 * p.sx, p.r * 2 * p.sy]);
          if (p.m === 'tail') tailPts.push([xx, p.v, zc - uCG, p.r * 2, p.r * 2]);
        }
      } else if (p.t === 'proj') {
        for (const s of [1, -1]) {
          const x = s * p.x, fr = surfFrame(S, p.u, x), axis = new THREE.Vector3(fr.n.x * 0.35, fr.n.y * 0.55, 0.75).normalize();
          const base = new THREE.Vector3(x, fr.v, p.u - uCG).addScaledVector(fr.n, 0.012);
          placeDisc('chrome', base.x, base.y, base.z, p.r * 1.3, 0.016, axis);
          const lens = new THREE.SphereGeometry(p.r, 16, 10, 0, TAU, 0, Math.PI / 2); lens.scale(1, 0.55, 1);
          lens.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis)); lens.translate(base.x + axis.x * 0.006, base.y + axis.y * 0.006, base.z + axis.z * 0.006); add(lens, 'head');
          headPts.push([base.x, base.y, base.z + 0.02, p.r * 2.4, p.r * 2.4]);
        }
      } else if (p.t === 'patch') {
        const nu = 6, nx = 6, Pp = [], NN = [], [xa, xb] = p.x;
        for (const sgn of (xa >= 0 ? [1, -1] : [1])) {
          const grid = [];
          for (let iu = 0; iu <= nu; iu++) { const u = lerp(p.uA, p.uB, iu / nu), row = []; for (let ix = 0; ix <= nx; ix++) { const x = lerp(xa, xb, ix / nx); row.push([x, surfAt(S, u, Math.abs(x)), u]); } grid.push(row); }
          const vtx = (iu, ix) => {
            const q = grid[iu][ix], qu = grid[Math.min(nu, iu + 1)][ix], qd = grid[Math.max(0, iu - 1)][ix], qr = grid[iu][Math.min(nx, ix + 1)], ql = grid[iu][Math.max(0, ix - 1)];
            const tu = [qu[0] - qd[0], qu[1] - qd[1], qu[2] - qd[2]], tx = [qr[0] - ql[0], qr[1] - ql[1], qr[2] - ql[2]];
            let n = [tx[1] * tu[2] - tx[2] * tu[1], tx[2] * tu[0] - tx[0] * tu[2], tx[0] * tu[1] - tx[1] * tu[0]];
            if (n[1] < 0) n = n.map(c => -c);
            const l = Math.hypot(...n) || 1; n = n.map(c => c / l);
            return [sgn * (q[0] + n[0] * p.off), q[1] + n[1] * p.off, q[2] + n[2] * p.off - uCG, sgn * n[0], n[1], n[2]];
          };
          for (let iu = 0; iu < nu; iu++) for (let ix = 0; ix < nx; ix++) {
            const A = vtx(iu, ix), B = vtx(iu + 1, ix), C = vtx(iu + 1, ix + 1), E = vtx(iu, ix + 1);
            for (const t of (sgn > 0 ? [A, B, E, E, B, C] : [A, E, B, E, C, B])) { Pp.push(t[0], t[1], t[2]); NN.push(t[3], t[4], t[5]); }
          }
          if (p.m === 'head' && !p.noGlow) { const mu = (p.uA + p.uB) / 2, mx = (xa + xb) / 2; headPts.push([sgn * mx, surfAt(S, mu, Math.abs(mx)) + 0.02, mu - uCG, Math.abs(xb - xa) * 0.6, 0.06]); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(NN, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(Pp.length / 3 * 2).fill(0.1), 2));
        add(g, p.m);
      } else if (p.t === 'wing') {
        const aoa = -0.07, z = p.u - uCG, c = p.chord, sh = new THREE.Shape();
        sh.moveTo(-c / 2, 0); sh.quadraticCurveTo(-c * 0.3, 0.03, c * 0.1, 0.022); sh.quadraticCurveTo(c * 0.4, 0.012, c / 2, -0.008); sh.quadraticCurveTo(0, 0.002, -c / 2, 0);
        const wg = new THREE.ExtrudeGeometry(sh, { depth: p.span * 2, bevelEnabled: false, curveSegments: 6 });
        wg.translate(0, 0, -p.span); wg.rotateY(Math.PI / 2); wg.rotateX(aoa); wg.translate(0, p.v, z); add(wg, p.m);
        const gf = new THREE.BoxGeometry(p.span * 2 - 0.02, 0.012, 0.03); gf.translate(0, p.v + 0.022, z - c / 2 + 0.02); add(gf, 'carbon');
        for (const s of [1, -1]) {
          const ep = new THREE.BoxGeometry(0.012, 0.15, c + 0.07); ep.translate(s * (p.span + 0.006), p.v + 0.02, z); add(ep, p.m === 'paint' ? 'carbon' : p.m);
          const xu = s * p.span * 0.62, vs = surfAt(S, p.u, Math.abs(xu)) - 0.01, hh = p.v - vs;
          const up = new THREE.BoxGeometry(0.02, hh, 0.12); up.translate(xu, vs + hh / 2, z - 0.02); add(up, 'carbon');
        }
      }
    };
    for (const p of spec.parts(P).flat()) emit(p);
    // detale wspólne
    const midU = (S.uR + S.uF) / 2, wMid = S.width(midU);
    for (const s of [1, -1]) boxG('trim', S.uR + S.rA + 0.04, S.uF - S.rA - 0.04, S.bottom(midU) - 0.005, S.bottom(midU) + 0.07, s > 0 ? wMid - S.tuck - 0.02 : -wMid + S.tuck - 0.012, s > 0 ? wMid - S.tuck + 0.012 : -wMid + S.tuck + 0.02);
    if (!spec.road) {   // auta sportowe: splitter i dyfuzor
      { const vb = S.bottom(L - 0.1), hw = Math.min(S.width(L - 0.15) - 0.1, halfWidthAt(S, L - 0.04, vb + 0.03, END_SHRINK) + 0.02); boxG('carbon', L - 0.26, L - 0.005, vb - 0.022, vb + 0.004, -hw, hw); }
      { const vb = S.bottom(0.15), hw = S.width(0.2) - 0.14; boxG('carbon', -0.03, 0.3, vb - 0.02, vb + 0.05, -hw, hw); for (const x of [-0.3, -0.1, 0.1, 0.3]) boxG('carbon', -0.03, 0.25, vb - 0.02, vb + 0.11, x * hw / 0.45 - 0.006, x * hw / 0.45 + 0.006); }
    }
    { const u = cab.ws0 - 0.2, v = S.belt(u) + 0.07, w = halfWidthAt(S, u, v) - 0.01;   // lusterka
      for (const s of [1, -1]) {
        boxG('trim', u - 0.02, u + 0.04, v - 0.025, v + 0.01, s > 0 ? w - 0.02 : -w - 0.09, s > 0 ? w + 0.09 : -w + 0.02);
        const g = new THREE.SphereGeometry(0.075, 14, 10); g.scale(0.72, 0.6, 0.95); g.translate(s * (w + 0.14), v + 0.025, u - uCG); add(g, 'paint');
        const mg = new THREE.CircleGeometry(0.052, 14); mg.scale(1.05, 0.72, 1); mg.rotateY(Math.PI); mg.translate(s * (w + 0.14), v + 0.025, u - uCG - 0.066); add(mg, 'chrome');
      } }
    { const u = cab.ws0 - 0.085;   // wycieraczki
      for (const [xa, xb] of [[0.04, 0.56], [-0.5, 0.02]]) {
        const xc = (xa + xb) / 2, fr = surfFrame(S, u, xc), len = xb - xa;
        const g = new THREE.BoxGeometry(len, 0.012, 0.018); g.rotateY(0.06); g.translate(xc, fr.v + 0.012, u - uCG); add(g, 'wiper');
        const arm = new THREE.BoxGeometry(len * 0.7, 0.01, 0.01); arm.rotateY(0.1); arm.translate(xc + 0.05, fr.v + 0.024, u - uCG + 0.004); add(arm, 'wiper');
      } }
    { const doorR = win.pillars.length ? win.pillars[win.pillars.length - 1] + 0.04 : win.u0 - 0.02, u = doorR + 0.2, v = S.belt(u) - 0.075, w = halfWidthAt(S, u, v);   // klamki, kierunkowskazy
      for (const s of [1, -1]) boxG(spec.plate === 'prl' ? 'chrome' : 'trim', u - 0.07, u + 0.07, v - 0.013, v + 0.013, s > 0 ? w - 0.004 : -w - 0.012, s > 0 ? w + 0.012 : -w + 0.004);
      const um = L - 0.42, vm = S.belt(um) - 0.16, wm = halfWidthAt(S, um, vm);
      for (const s of [1, -1]) boxG('amber', um - 0.035, um + 0.035, vm - 0.012, vm + 0.012, s > 0 ? wm - 0.004 : -wm - 0.008, s > 0 ? wm + 0.008 : -wm + 0.004); }
    if (cab.rg1 - cab.rg0 > 0.2) { const u = Math.min(cab.rg1 - 0.06, cab.rg0 + 0.6), v = S.top(u) - 0.05; boxG('tail', u - 0.02, u + 0.02, v - 0.014, v + 0.014, -0.16, 0.16); tailPts.push([0, v, u - uCG, 0.3, 0.03]); }   // trzecie światło stopu
    if (!spec.road) {   // haki holownicze
      const vb = S.bottom(L - 0.05); boxG(spec.index % 2 ? 'towY' : 'towR', L - 0.02, L + 0.045, vb + 0.01, vb + 0.13, 0.30, 0.345);
      const vr = S.bottom(0.05); boxG(spec.index % 2 ? 'towR' : 'towY', -0.045, 0.02, vr + 0.02, vr + 0.14, -0.40, -0.355);
    }
    for (const [x, v, r] of spec.exhaust || []) {   // wydech
      const ru = -0.06, g = new THREE.CylinderGeometry(r, r * 0.92, 0.26, 16, 1, true); g.rotateX(Math.PI / 2); g.translate(x, v, ru + 0.13 - uCG); add(g, 'chrome');
      const lip = new THREE.TorusGeometry(r, 0.006, 6, 16); lip.translate(x, v, ru - uCG); add(lip, 'chrome');
      const inn = new THREE.CircleGeometry(r * 0.85, 14); inn.rotateY(Math.PI); inn.translate(x, v, ru + 0.03 - uCG); add(inn, 'well');
      exhaustPts.push([x, v, ru - uCG]);
    }
    // wnętrze: wanna, deska, fotele, kierownica, podsufitka (auta sportowe: klatka)
    const seatU = cab.ws0 - 0.98, drvX = Math.min(0.37, S.width(seatU) * 0.43);
    const tubU0 = Math.max(cab.rg0 + 0.05, seatU - 0.75), tubU1 = cab.ws0 - 0.05, tubW = S.width(seatU) - 0.11;
    const floorV = S.bottom(seatU) + 0.09, beltV = S.belt(seatU);
    const seatCol = spec.seat ? new THREE.Color(spec.seat).getHex() : TRIMCOL.seat;
    boxG('interior', tubU0, tubU1, floorV, beltV - 0.07, -tubW, tubW);
    { const dTop = Math.min(beltV + 0.1, S.top(cab.ws0 - 0.2) - 0.05), dw = Math.min(tubW - 0.02, halfWidthAt(S, cab.ws0 - 0.35, dTop) - 0.04);
      boxG('dash', cab.ws0 - 0.55, cab.ws0 - 0.2, beltV - 0.14, dTop, -dw, dw); }
    for (const s of [1, -1]) {
      const sx = s * drvX;
      boxG('seat', seatU - 0.05, seatU + 0.4, floorV + 0.12, floorV + 0.24, sx - 0.24, sx + 0.24, seatCol);
      const bk = new THREE.BoxGeometry(0.46, 0.68, 0.1); bk.rotateX(-0.22); bk.translate(sx, floorV + 0.53, seatU - 0.08 - uCG); add(bk, 'seat', seatCol);
      const hr = new THREE.BoxGeometry(0.26, 0.16, 0.08); hr.rotateX(-0.22); hr.translate(sx, floorV + 0.95, seatU - 0.16 - uCG); add(hr, 'seat', seatCol);
    }
    { const sw = new THREE.TorusGeometry(0.175, 0.022, 8, 22); sw.rotateX(-0.4); sw.translate(drvX, beltV + 0.08, cab.ws0 - 0.62 - uCG); add(sw, 'interior');
      const col0 = new THREE.CylinderGeometry(0.03, 0.035, 0.38, 8); col0.rotateX(Math.PI / 2 - 0.4); col0.translate(drvX, beltV + 0.0, cab.ws0 - 0.45 - uCG); add(col0, 'interior'); }
    { const vr = S.top((cab.rg1 + cab.ws1) / 2), wt = S.topW((cab.rg1 + cab.ws1) / 2) - 0.07; boxG('interior', cab.rg1 - 0.05, cab.ws1 + 0.05, vr - 0.065, vr - 0.04, -wt, wt); }
    if (!spec.road) {
      const cu = seatU - 0.3, v0 = beltV - 0.1, v1 = S.top(cu) - 0.08, cw = Math.min(S.topW(cu), S.width(cu) - 0.12) - 0.08;
      for (const s of [1, -1]) { const t = new THREE.CylinderGeometry(0.022, 0.022, v1 - v0, 8); t.translate(s * cw, (v0 + v1) / 2, cu - uCG); add(t, 'cage'); }
      const tb = new THREE.CylinderGeometry(0.022, 0.022, cw * 2, 8); tb.rotateZ(Math.PI / 2); tb.translate(0, v1, cu - uCG); add(tb, 'cage');
    }
    const body = mergeGeos(parts, true);
    body.computeBoundingBox(); body.computeBoundingSphere();
    const maxW = Math.max(...secs.map(s => Math.max(...s.pts.map(p => p[0]))));
    const res = { body, a, b, uCG, headPts, tailPts, exhaustPts, len: L, wid: maxW * 2, cOff: L / 2 - uCG, height: D.H, S, seat: { u: seatU - uCG, x: drvX, floor: floorV },
      plateF: { v: spec.plateF.v, z: L + 0.027 - uCG }, plateR: { v: spec.plateR.v, z: -0.016 - uCG }, wheels: makeWheelGeos(spec) };
    if (spec.popups) res.popup = makePopupGeo(spec, S, uCG, add);
    CARGEO.set(spec.id, res);
    return res;
  }

  /* ===================================================== KOŁA */
  function buildRim(style, rimR, tw, dish) {
    const parts = [], C = (g, col) => parts.push([g, 0, col]);
    const faceX = tw * 0.5 - 0.014 - dish * tw * 0.5, LIP = 0xffffff, SPK = 0xf2f2f2, DARK = 0x3a3c40, NUT = 0xd9dce0;
    { const g = new THREE.CylinderGeometry(rimR * 0.95, rimR * 0.95, tw * 0.9, 30, 1, true); g.rotateZ(-Math.PI / 2); C(g, DARK); }
    { const prof = [[rimR * 0.9, faceX - 0.004], [rimR * 0.97, faceX + 0.004], [rimR * 1.02, tw * 0.5 - 0.006], [rimR * 1.035, tw * 0.5 + 0.004], [rimR * 0.985, tw * 0.5 + 0.012]];
      const g = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 34); g.rotateZ(-Math.PI / 2); C(g, LIP); }
    const spoke = (len, w, dep, rm, th, lean = 0, col = SPK) => { const g = new THREE.BoxGeometry(dep, w, len); g.rotateX(lean); g.translate(0, 0, rm); g.rotateX(th); g.translate(faceX - dep / 2, 0, 0); C(g, col); };
    const r0 = rimR * 0.22, r1 = rimR * 0.94, len = r1 - r0, rm = (r0 + r1) / 2;
    if (style === 'six') for (let k = 0; k < 6; k++) { spoke(len, 0.055, 0.03, rm, k / 6 * TAU); spoke(len * 0.35, 0.075, 0.034, r0 + len * 0.15, k / 6 * TAU); }
    else if (style === 'mesh') { for (let k = 0; k < 10; k++) for (const ln of [0.2, -0.2]) spoke(len * 1.02, 0.016, 0.022, rm, k / 10 * TAU + ln * 0.5, ln); }
    else if (style === 'five') for (let k = 0; k < 5; k++) for (const o of [0.075, -0.075]) spoke(len, 0.03, 0.03, rm, k / 5 * TAU + o, -o * 1.2);
    else if (style === 'dish') for (let k = 0; k < 4; k++) spoke(len, 0.085, 0.03, rm, k / 4 * TAU + 0.4);
    else if (style === 'turbine') for (let k = 0; k < 14; k++) spoke(len, 0.022, 0.026, rm, k / 14 * TAU, 0.45);
    else if (style === 'steel') {
      const g = new THREE.CylinderGeometry(rimR * 0.93, rimR * 0.93, 0.02, 30); g.rotateZ(-Math.PI / 2); g.translate(faceX - 0.01, 0, 0); C(g, 0xcfd2d5);
      for (let k = 0; k < 8; k++) { const h = new THREE.CircleGeometry(rimR * 0.075, 10); h.rotateY(Math.PI / 2); const a = k / 8 * TAU; h.translate(faceX + 0.001, Math.sin(a) * rimR * 0.66, Math.cos(a) * rimR * 0.66); C(h, 0x101010); }
      const cap = new THREE.SphereGeometry(rimR * 0.42, 18, 8, 0, TAU, 0, Math.PI / 2); cap.scale(1, 1, 0.35); cap.rotateZ(-Math.PI / 2); cap.translate(faceX, 0, 0); C(cap, 0xffffff);
    }
    if (style !== 'steel') {
      const hub = new THREE.CylinderGeometry(rimR * 0.25, rimR * 0.28, 0.05, 22); hub.rotateZ(-Math.PI / 2); hub.translate(faceX - 0.02, 0, 0); C(hub, SPK);
      const cap = new THREE.CylinderGeometry(rimR * 0.1, rimR * 0.1, 0.02, 16); cap.rotateZ(-Math.PI / 2); cap.translate(faceX + 0.008, 0, 0); C(cap, 0x202224);
      for (let k = 0; k < 5; k++) { const a = k / 5 * TAU, n = new THREE.CylinderGeometry(0.011, 0.011, 0.03, 6); n.rotateZ(-Math.PI / 2); n.translate(faceX + 0.006, Math.sin(a) * rimR * 0.17, Math.cos(a) * rimR * 0.17); C(n, NUT); }
    }
    return { parts, faceX };
  }
  function makeWheelGeos(spec) {
    const D = spec.dims, out = {};
    for (const [key, tw] of [['F', D.twF], ['R', D.twR]]) {
      const R = D.R, rimR = R * (spec.rim === 'steel' ? 0.56 : 0.67);
      const dish = spec.rim === 'dish' ? 0.42 : spec.rim === 'six' ? 0.2 : spec.rim === 'mesh' ? 0.16 : 0.1;
      const prof = [[rimR * 1.01, -tw * 0.44], [R * 0.84, -tw * 0.5], [R * 0.955, -tw * 0.475], [R * 0.995, -tw * 0.38], [R, -tw * 0.18], [R, tw * 0.18], [R * 0.995, tw * 0.38], [R * 0.955, tw * 0.475], [R * 0.84, tw * 0.5], [rimR * 1.01, tw * 0.44]];
      const tire = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 40); tire.rotateZ(-Math.PI / 2);
      const rim = buildRim(spec.rim, rimR, tw, dish);
      out[key] = { spin: mergeGeos([[tire, 0, 0xffffff], ...rim.parts.map(([g, , c]) => [g, 1, c])], true), faceX: rim.faceX, rimR, tw };
      const bp = [];
      const disc = new THREE.CylinderGeometry(rimR * 0.8, rimR * 0.8, 0.026, 30); disc.rotateZ(-Math.PI / 2); disc.translate(rim.faceX - 0.055, 0, 0); bp.push([disc, 0, 0x6a6d72]);
      const hat = new THREE.CylinderGeometry(rimR * 0.36, rimR * 0.36, 0.04, 18); hat.rotateZ(-Math.PI / 2); hat.translate(rim.faceX - 0.045, 0, 0); bp.push([hat, 0, 0x2a2c30]);
      const cal = new THREE.BoxGeometry(0.06, 0.1, 0.17); cal.translate(rim.faceX - 0.05, 0, rimR * 0.66); cal.rotateX(-0.75); bp.push([cal, 0, new THREE.Color(spec.caliper || '#c8202a').getHex()]);
      out[key].brake = mergeGeos(bp, true);
    }
    return out;
  }
  function makePopupGeo(spec, S, uCG) {
    const p = spec.popups, w = p.x1 - p.x0, d = p.u1 - p.u0, h = 0.12, box = new THREE.BoxGeometry(w, h, d);
    const t = box.attributes.uv; for (let i = 0; i < t.count; i++) t.setXY(i, 0.002, 0.25);
    const grp = k => { const g = new THREE.BufferGeometry(); for (const a of ['position', 'normal', 'uv']) g.setAttribute(a, box.attributes[a]); const gr = box.groups[k]; g.setIndex(Array.from(box.index.array.slice(gr.start, gr.start + gr.count))); return g.toNonIndexed(); };
    const parts = [[grp(0), MI.paint, 0xffffff], [grp(1), MI.paint, 0xffffff], [grp(2), MI.paint, 0xffffff], [grp(3), MI.trim, TRIMCOL.housing], [grp(4), MI.trim, TRIMCOL.housing], [grp(5), MI.trim, TRIMCOL.housing]];
    for (const lx of [-w * 0.24, w * 0.24]) {
      const r = Math.min(0.045, w * 0.2);
      const bz = new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.012, 20); bz.rotateX(Math.PI / 2); bz.translate(lx, 0, d / 2 + 0.004); parts.push([bz, MI.chrome, 0xffffff]);
      const ln = new THREE.SphereGeometry(r, 16, 10, 0, TAU, 0, Math.PI / 2); ln.scale(1, 0.5, 1); ln.rotateX(Math.PI / 2); ln.translate(lx, 0, d / 2 + 0.008); parts.push([ln, MI.head, 0xffffff]);
    }
    const geo = mergeGeos(parts, true);
    const uc = (p.u0 + p.u1) / 2, xc = (p.x0 + p.x1) / 2;
    const vTop = Math.min(surfAt(S, uc, p.x0), surfAt(S, uc, p.x1), surfAt(S, p.u0, p.x1), surfAt(S, p.u1, p.x1)) - 0.014, slope = Math.atan2(S.top(p.u1) - S.top(p.u0), d);
    return { geo, w, d, h, z: uc - uCG, xc, vTop, slope };
  }

  /* ===================================================== LAKIER (linie paneli), TABLICE */
  // Tekstura lakieru: biała baza (kolor auta = kolor materiału) z liniami drzwi, przetłoczeniem,
  // wlewem paliwa i przyciemnieniem dołu. Dwukolorowe (Majestat) i radiowóz — z kolorami w teksturze.
  const LIVCACHE = new Map();
  function liveryTexture(spec, kind, base) {
    const key = spec.id + '|' + kind + '|' + (kind === 'plain' ? '' : base);
    if (LIVCACHE.has(key)) return LIVCACHE.get(key);
    const G = getCarGeo(spec), S = G.S, L = S.L, cab = S.cabin, win = S.win;
    const Wc = 1024, Hc = 256, c = mkCanvas(Wc, Hc), g = c.getContext('2d');
    const OJ = [0, 1, 2, 4, 6, 9, 12, 14, 16, 21, 24, 27];
    const jm = j => { for (let k = 0; k < OJ.length - 1; k++) if (j <= OJ[k + 1]) return lerp(JP[k], JP[k + 1], (j - OJ[k]) / (OJ[k + 1] - OJ[k])); return JP[11]; };
    const X = u => u / L * Wc, yR = j => Hc * (1 - 0.5 * jm(j) / (NPT - 1)), yL = j => Hc * 0.5 * jm(j) / (NPT - 1);
    const fill0 = kind === 'plain' ? '#ffffff' : base;
    g.fillStyle = fill0; g.fillRect(0, 0, Wc, Hc);
    const band = (j0, j1, u0, u1, fill) => { g.fillStyle = fill; g.fillRect(X(u0), yR(j1), X(u1) - X(u0), yR(j0) - yR(j1)); g.fillRect(X(u0), yL(j0), X(u1) - X(u0), yL(j1) - yL(j0)); };
    if (kind === 'twoTone') { band(0, 9.6, 0, L, spec.twoTone); band(9.6, 10.0, 0, L, '#e8ebee'); }
    if (kind === 'police') {
      band(7.5, 11.2, 0, L, '#1d3f8f'); band(11.2, 11.7, 0, L, '#f2f2f2'); band(7.0, 7.5, 0, L, '#f2f2f2');
      const midU = (S.uR + S.uF) / 2, aspect = (L / Wc) / ((S.belt(midU) - S.bottom(midU)) / (JP[7] * Hc * 0.5 / (NPT - 1)));
      for (const [yF, s] of [[yR, 1], [yL, -1]]) {
        g.save(); g.translate(X((cab.ws0 + win.u0) / 2), yF(9.35)); if (s < 0) g.rotate(Math.PI); g.scale(1, aspect);
        g.font = '900 40px "Barlow Condensed","Arial Narrow",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff'; g.fillText('POLICE', 0, 0); g.restore();
      }
    }
    const dark = 'rgba(0,0,0,0.55)';
    const vline = (u, j0, j1) => { g.fillStyle = dark; g.fillRect(X(u) - 1, yR(j1), 2, yR(j0) - yR(j1)); g.fillRect(X(u) - 1, yL(j0), 2, yL(j1) - yL(j0)); };
    const doorF = cab.ws0 - 0.06, doorR = win.pillars.length ? win.pillars[win.pillars.length - 1] + 0.04 : win.u0 - 0.02;
    vline(doorF, 4.6, 14); vline(doorR, 4.6, 14);
    if (win.pillars.length > 1) vline(win.pillars[0] + 0.04, 4.6, 14);
    vline(L - 0.30, 3.6, 10.5); vline(0.28, 3.6, 10.5);
    vline(cab.ws0 + 0.14, 14.5, 27);
    if (cab.rg0 < 0.7) vline(cab.rg1 + 0.03, 15, 27); else vline(cab.rg0 - 0.05, 14.5, 27);
    g.fillStyle = dark; g.fillRect(X(doorR + 0.12), yR(13.3), X(0.13), 3); g.fillRect(X(doorR + 0.12), yL(13.3) - 3, X(0.13), 3);
    band(10.75, 11.15, 0.32, L - 0.34, 'rgba(255,255,255,0.13)'); band(10.3, 10.75, 0.32, L - 0.34, 'rgba(0,0,0,0.14)');
    { const u = Math.max(0.45, (cab.rg0 + 0.2) * 0.6), y = yR(11.8); g.save(); g.translate(X(u), y); g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.stroke(); g.restore(); }
    const grR = g.createLinearGradient(0, yR(3), 0, yR(7)); grR.addColorStop(0, 'rgba(0,0,0,0.45)'); grR.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grR; g.fillRect(0, yR(7), Wc, yR(3) - yR(7));
    const grL = g.createLinearGradient(0, yL(3), 0, yL(7)); grL.addColorStop(0, 'rgba(0,0,0,0.45)'); grL.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grL; g.fillRect(0, yL(3), Wc, yL(7) - yL(3));
    g.fillStyle = fill0; g.fillRect(0, 0, 6, Hc);   // piksel bazowy dla detali w kolorze nadwozia
    const t = texFrom(c, { wrap: false, aniso: 8 });
    LIVCACHE.set(key, t);
    return t;
  }
  // Atlas tablic: 4 kolumny × 18 rzędów (256 × 56 px); rzędy 0–13 — tablice UE z „PL”, 14–17 — czarne (PRL).
  const PLATE_CODES = ['WA', 'WE', 'KR', 'PO', 'GD', 'WR', 'SK', 'LU', 'EL', 'DW', 'ST', 'SY', 'KT', 'WB', 'ZS', 'BI', 'OP', 'CB'];
  const PRL_CODES = ['KTA', 'KRE', 'WAB', 'WZM', 'POF', 'GDA', 'KTW', 'SKA', 'LUB', 'ELA', 'WRA', 'KAT', 'STA'];
  function plateAtlas() {
    const c = mkCanvas(1024, 1024), g = c.getContext('2d'), rnd = mulberry32(777);
    const Lt = 'ACEFGHJKLMNPRSTUVWXY', Dg = '0123456789', p = a => a[Math.floor(rnd() * a.length)];
    for (let row = 0; row < 18; row++) for (let col = 0; col < 4; col++) {
      const x = col * 256, y = row * 56;
      g.save(); g.translate(x, y);
      if (row >= 14) {
        const text = p(PRL_CODES) + ' ' + p(Dg) + p(Dg) + p(Dg) + p(Dg);
        g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, 256, 56); g.strokeStyle = '#e8e8e8'; g.lineWidth = 3; g.strokeRect(4, 4, 248, 48);
        g.fillStyle = '#f0f0f0'; g.font = '700 40px "Barlow Condensed","Arial Narrow",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 30, 236);
      } else {
        const text = p(PLATE_CODES) + ' ' + (rnd() < 0.5 ? [Dg, Dg, Dg, Dg, Lt] : [Dg, Dg, Dg, Lt, Lt]).map(p).join('');
        g.fillStyle = '#f7f7f4'; g.fillRect(0, 0, 256, 56); g.fillStyle = '#1446a0'; g.fillRect(0, 0, 30, 56);
        g.fillStyle = '#ffcc00'; for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.beginPath(); g.arc(15 + Math.cos(a) * 9, 18 + Math.sin(a) * 9, 1.6, 0, TAU); g.fill(); }
        g.fillStyle = '#fff'; g.font = '700 15px "Barlow Condensed","Arial Narrow",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('PL', 15, 46);
        g.strokeStyle = '#111'; g.lineWidth = 2; g.strokeRect(1, 1, 254, 54);
        g.fillStyle = '#111'; g.font = '700 40px "Barlow Condensed","Arial Narrow",sans-serif'; g.textBaseline = 'middle'; g.fillText(text, 143, 30, 214);
      }
      g.restore();
    }
    return new THREE.MeshStandardMaterial({ map: texFrom(c, { wrap: false, aniso: 4 }), roughness: 0.4, metalness: 0.1 });
  }
  function plateGeo(G, spec, cell) {
    const col = cell % 4, row = Math.floor(cell / 4), u0 = col / 4, u1 = u0 + 0.25, v1 = 1 - row * 56 / 1024, v0 = v1 - 56 / 1024;
    const one = (z, v, back) => {
      const g = new THREE.PlaneGeometry(0.52, 0.115), t = g.attributes.uv;
      for (let i = 0; i < t.count; i++) t.setXY(i, t.getX(i) ? u1 : u0, t.getY(i) ? v1 : v0);
      if (back) g.rotateY(Math.PI); g.translate(0, v, z); return g;
    };
    return mergeGeos([[one(G.plateF.z, G.plateF.v, false), 0], [one(G.plateR.z, G.plateR.v, true), 0]], false);
  }

  /* ===================================================== INSTANCJE */
  const PAINTS = new Map();
  function paintMaterial(spec, hex, kind) {
    const k = spec.id + '|' + kind + '|' + hex;
    if (PAINTS.has(k)) return PAINTS.get(k);
    const classic = spec.plate === 'prl', css = '#' + new THREE.Color(hex).getHexString();
    const m = new THREE.MeshPhysicalMaterial({
      map: liveryTexture(spec, kind, css), color: kind === 'plain' ? hex : 0xffffff,
      metalness: classic ? 0.05 : 0.38, roughness: classic ? 0.42 : 0.3, clearcoat: classic ? 0.6 : 1.0, clearcoatRoughness: classic ? 0.1 : 0.03,
      normalMap: CARMAT.flakes, normalScale: new THREE.Vector2(0.06, 0.06), envMapIntensity: 1.1,
    });
    PAINTS.set(k, m);
    return m;
  }
  const RIMMATS = new Map();
  const rimMat = spec => { if (!RIMMATS.has(spec.id)) RIMMATS.set(spec.id, new THREE.MeshStandardMaterial({ color: spec.rimCol || '#cccccc', vertexColors: true, metalness: 0.88, roughness: 0.22, envMapIntensity: 1.3 })); return RIMMATS.get(spec.id); };
  // Auta z ruchu ulicznego: nadwozie i koła w jednej siatce (8 materiałów, koła się nie obracają) — mniej wywołań rysowania.
  const BAKED = new Map();
  function bakedGeo(spec, cell) {
    const k = spec.id + '|' + cell;
    if (BAKED.has(k)) return BAKED.get(k);
    const G = getCarGeo(spec), D = spec.dims, list = splitGroups(G.body).map(([g, mi]) => [g, mi, 0xffffff]);
    for (const [z, front] of [[G.a, true], [-G.b, false]]) for (const s of [1, -1]) {
      const WG = G.wheels[front ? 'F' : 'R'], track = front ? D.trackF : D.trackR;
      for (const [g, mi] of splitGroups(WG.spin)) {
        const gg = g.clone(); if (s < 0) gg.rotateY(Math.PI); gg.rotateZ(s * (D.camber || 0)); gg.translate(s * track / 2, D.R, z);
        list.push([gg, mi === 0 ? 6 : 7, 0xffffff]);
      }
    }
    list.push([plateGeo(G, spec, cell), 8]);
    const geo = mergeGeos(list, true);
    BAKED.set(k, geo);
    return geo;
  }
  let UID = 0;
  // opts.player: osobne koła (obrót, skręt), tarcze hamulcowe, własne światła tylne (stop) i poświaty.
  function makeCarVisual(type, hex, opts = {}) {
    initCarMaterials();
    const spec = BY_ID[TYPE_MODEL[type] || 'sedan'], G = getCarGeo(spec), D = spec.dims;
    const kind = type === 'police' ? 'police' : spec.twoTone ? 'twoTone' : 'plain';
    const paint = paintMaterial(spec, kind === 'police' ? 0xf1f2f6 : hex, kind);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.rotation.order = 'YXZ'; body.rotation.order = 'YXZ';
    const cell = spec.plate === 'prl' ? 56 + (UID % 16) : (UID * 7) % 56; UID++;
    const vis = { root, body, spec, G, paint, wheels: [], len: G.len, wid: G.wid };
    if (opts.player) {
      vis.tail = CARMAT.tail.clone(); vis.head = CARMAT.head.clone();
      const mats = [paint, CARMAT.glass, CARMAT.chrome, CARMAT.trim, vis.head, vis.tail];
      const mesh = new THREE.Mesh(G.body, mats); mesh.castShadow = true; mesh.receiveShadow = true; body.add(mesh); vis.mesh = mesh;
      body.add(new THREE.Mesh(plateGeo(G, spec, cell), CARMAT.plates));
      if (G.popup) { vis.pods = []; for (const s of [1, -1]) { const m = new THREE.Mesh(G.popup.geo, mats); m.castShadow = true; body.add(m); vis.pods.push({ m, s }); } updatePods(vis, 0); }
      const rm = rimMat(spec);
      for (const [z, front] of [[G.a, true], [-G.b, false]]) for (const s of [1, -1]) {
        const WG = G.wheels[front ? 'F' : 'R'], track = front ? D.trackF : D.trackR;
        const pivot = new THREE.Group(); pivot.position.set(s * track / 2, D.R, z);
        const cam = new THREE.Group(); cam.rotation.z = s * (D.camber || 0); pivot.add(cam);
        const flip = new THREE.Group(); flip.rotation.y = s > 0 ? 0 : Math.PI; cam.add(flip);
        const wm = new THREE.Mesh(WG.spin, [CARMAT.tire, rm]); wm.castShadow = true; flip.add(wm);
        flip.add(new THREE.Mesh(WG.brake, CARMAT.brake));
        root.add(pivot);
        vis.wheels.push({ pivot, mesh: wm, front, sgn: s > 0 ? 1 : -1, x: s * track / 2, z, r: D.R });
      }
      // poświaty świateł (nocą / hamowanie)
      vis.glows = { heads: [], tails: [] };
      for (const [x, y, z, w, h] of G.headPts) { const s = new THREE.Sprite(CARMAT.glowHead); s.position.set(x, y, z + 0.06); s.scale.setScalar(Math.min(0.75, Math.max(w, h) * 2.6)); body.add(s); vis.glows.heads.push(s); }
      vis.glowTail = CARMAT.glowTail.clone();
      for (const [x, y, z, w, h] of G.tailPts) { const s = new THREE.Sprite(vis.glowTail); s.position.set(x, y, z - 0.05); s.scale.setScalar(Math.min(0.8, Math.max(w, h) * 2.4)); body.add(s); vis.glows.tails.push(s); }
    } else {
      const mats = [paint, CARMAT.glass, CARMAT.chrome, CARMAT.trim, CARMAT.head, CARMAT.tail, CARMAT.tire, rimMat(spec), CARMAT.plates];
      const mesh = new THREE.Mesh(bakedGeo(spec, cell), mats); mesh.castShadow = true; mesh.receiveShadow = true; body.add(mesh); vis.mesh = mesh;
    }
    // cień kontaktowy pod autem
    const shG = new THREE.PlaneGeometry(G.len * 1.12, G.wid * 1.42); shG.rotateX(-Math.PI / 2);
    const shadow = new THREE.Mesh(shG, CARMAT.shadow); shadow.position.set(0, 0.03, G.cOff); shadow.renderOrder = 1; root.add(shadow);
    // taksówka: podświetlany kogut na dachu; radiowóz: belka świetlna
    if (type === 'taxi' || type === 'police') {
      const roofU = (spec.shape.cabin.rg1 + spec.shape.cabin.ws1) / 2, roofV = G.S.top(roofU);
      const extra = type === 'taxi'
        ? [[new THREE.BoxGeometry(0.62, 0.18, 0.26), 0xf5c518], [new THREE.BoxGeometry(0.66, 0.05, 0.3), 0x15171a]]
        : [[new THREE.BoxGeometry(1.1, 0.12, 0.28), 0x15171a], [new THREE.BoxGeometry(0.42, 0.1, 0.24).translate(-0.3, 0.09, 0), 0xff2030], [new THREE.BoxGeometry(0.42, 0.1, 0.24).translate(0.3, 0.09, 0), 0x2060ff]];
      for (const [g, c] of extra) {
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, emissive: type === 'police' && c !== 0x15171a ? c : type === 'taxi' && c === 0xf5c518 ? 0x806010 : 0x000000, emissiveIntensity: 0.6, roughness: 0.4 }));
        m.position.set(0, roofV + 0.1, roofU - G.uCG); body.add(m);
      }
    }
    vis.uid = ++UID;
    return vis;
  }
  function updatePods(vis, t) {
    if (!vis.pods) return;
    const P = vis.G.popup, e = t * t * (3 - 2 * t);
    for (const { m, s } of vis.pods) { m.position.set(s * P.xc, P.vTop - P.h / 2 + e * 0.13, P.z - e * 0.02); m.rotation.set(-P.slope * (1 - e) - e * 0.06, 0, 0); }
  }
  function setPaint(vis, type, hex) {
    const spec = vis.spec, kind = type === 'police' ? 'police' : spec.twoTone ? 'twoTone' : 'plain';
    vis.paint = paintMaterial(spec, kind === 'police' ? 0xf1f2f6 : hex, kind);
    const mats = vis.mesh.material.slice(); mats[0] = vis.paint; vis.mesh.material = mats;
    if (vis.pods) for (const { m } of vis.pods) m.material = mats;
  }
  // Noc: reflektory i lampy tylne wszystkich aut (wspólne materiały); auto gracza — własne + poświaty i stop.
  function setNight(k) {
    if (!CARMAT.head) return;
    CARMAT.head.emissiveIntensity = k * 2.2; CARMAT.tail.emissiveIntensity = 0.15 + k * 1.4;
  }
  function setPlayerLights(vis, night, braking, reversing) {
    if (!vis || !vis.tail) return;
    vis.head.emissiveIntensity = night * 3.2;
    vis.tail.emissiveIntensity = braking ? 3.2 : 0.15 + night * 1.6;
    vis.updatePodsT = night > 0.3 ? 1 : 0;
    for (const s of vis.glows.heads) s.material.opacity = night * 0.55;
    vis.glowTail.opacity = braking ? 0.55 : night * 0.3;
  }
  /* ===================================================== FIZYKA POJAZDU
     Model rowerowy z obciążeniem osi (przenoszenie masy przy hamowaniu / przyspieszaniu), opona Pacejki,
     elipsa przyczepności, ręczny (blokuje tył), automatyczna skrzynia biegów, kopnięcie sprzęgła,
     opór toczenia i powietrza, moment bezwładności, asystent kontry w poślizgu. (port z „Ulic Stalowic”) */
  const GRAV = 9.81, DEG = Math.PI / 180;
  const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const tqCurve = x => x > 1.03 ? 0 : clamp(0.55 + 1.2 * x - 0.95 * x * x, 0.25, 1);
  const pac = (a, B, C) => Math.sin(C * Math.atan(B * a));
  class VehicleBody {
    constructor(p) {
      Object.assign(this, { x: 0, z: 0, h: 0, vx: 0, vz: 0, w: 0 });
      this.p = p; this.m = p.mass;
      this.L = p.wb; this.b = p.front * p.wb; this.a = p.wb - this.b;
      this.I = p.mass * (p.len * p.len + p.wid * p.wid) / 12 * 1.1;
      this.R = p.R;
      const wRed = p.red * TAU / 60, n = p.gears, Gtop = wRed * p.R / (1.04 * p.vmax), G1 = wRed * p.R / (p.vmax * p.first), q = Math.pow(G1 / Gtop, 1 / (n - 1));
      this.ratios = []; for (let i = 0; i < n; i++) this.ratios.push(G1 / Math.pow(q, i));
      this.eff = 0.88;
      this.Tpeak = p.kW * 1000 / (tqCurve(0.9) * 0.9 * wRed * this.eff);
      this.Crr = 0.013;
      const Ftop = this.Tpeak * tqCurve(1 / 1.04) * Gtop * this.eff / p.R;
      this.Cd = Math.max(0.05, (Ftop - this.Crr * this.m * GRAV) / (p.vmax * p.vmax));
      this.gear = 0; this.shiftT = 0; this.rpm = p.idle; this.reverse = false;
      this.steerIn = 0; this.delta = 0; this.thr = 0; this.brk = 0; this.hand = 0; this.kick = 0; this.kickCD = 0;
      this.axS = 0; this.ayS = 0; this.u = 0; this.vy = 0; this.beta = 0; this.speed = 0;
      this.slipF = 0; this.slipR = 0; this.spinning = false; this.locked = false; this.braking = false;
      this.assist = true; this.wheelSpinF = 0; this.wheelSpinR = 0; this.extraF = 0;
    }
    setPose(x, z, h, u = 0, vy = 0) {
      this.x = x; this.z = z; this.h = h;
      const sh = Math.sin(h), ch = Math.cos(h);
      this.vx = sh * u + ch * vy; this.vz = ch * u - sh * vy; this.w = 0;
    }
    rpmAt(u, g) { return Math.abs(u) / this.R * this.ratios[g] * 60 / TAU; }
    // inp: {thr, brk, steer (+ w lewo), hand, kick}; surf(x, z) → {mu, drag}
    step(dt, inp, surf) {
      const p = this.p, m = this.m, a = this.a, b = this.b, L = this.L;
      const sh = Math.sin(this.h), ch = Math.cos(this.h), fx = sh, fz = ch, lx = ch, lz = -sh;
      const u = this.vx * fx + this.vz * fz, vy = this.vx * lx + this.vz * lz, w = this.w, speed = Math.hypot(this.vx, this.vz);
      const tT = inp.thr, bT = inp.brk;
      this.steerIn = approach(this.steerIn, inp.steer, (Math.abs(inp.steer) > Math.abs(this.steerIn) && Math.sign(inp.steer) === Math.sign(this.steerIn || inp.steer) ? 4.2 : 7.5) * dt);
      let drive = 0, brake = 0, rev = false;
      if (u > 0.6) { drive = tT; brake = bT; }
      else if (u < -0.6) { if (bT > 0) { rev = true; drive = bT; } brake = tT; }
      else { if (tT > 0) drive = tT; else if (bT > 0) { rev = true; drive = bT; } }
      this.reverse = rev;
      this.thr = approach(this.thr, drive, (drive > this.thr ? 6 : 10) * dt);
      this.brk = brake; this.hand = inp.hand ? 1 : 0; this.braking = brake > 0.05;
      if (inp.kick && this.kickCD <= 0 && !rev) { this.kick = 0.32; this.kickCD = 0.45; }
      this.kick = Math.max(0, this.kick - dt); this.kickCD = Math.max(0, this.kickCD - dt);
      // kąt znoszenia i skręt kół (przy dużej prędkości mniejszy, w poślizgu pełna kontra)
      const beta = u > 0.5 ? Math.atan2(vy, u) : 0, absB = Math.abs(beta);
      const slide = smoothstep(5 * DEG, 18 * DEG, absB) * (speed > 4 ? 1 : 0), dMax = p.steer;
      let dLim = dMax * (0.14 + 0.86 / (1 + (speed / 15.5) * (speed / 15.5)));
      const counter = this.steerIn !== 0 && Math.sign(this.steerIn) === Math.sign(beta);
      dLim = counter ? lerp(dLim, dMax, slide) : Math.min(dMax, dLim * (1 + 0.5 * slide));
      let dT = this.steerIn * dLim;
      if (this.assist && u > 2) dT += clamp(Math.atan2(vy + a * w, Math.max(Math.abs(u), 3)), -dMax, dMax) * 0.9 * slide;
      dT = clamp(dT, -dMax, dMax);
      this.delta = approach(this.delta, dT, 6.5 * dt);
      const dl = this.delta, cd = Math.cos(dl), sd = Math.sin(dl);
      // nawierzchnia pod osiami
      const sF = surf(this.x + fx * a, this.z + fz * a), sR = surf(this.x - fx * b, this.z - fz * b);
      const muSF = sF.mu, dragF = sF.drag, muSR = sR.mu, dragR = sR.drag;
      let muF = muSF * p.gripF, muR = muSR * p.gripR;
      const hiS = smoothstep(18, 48, speed);
      muR *= 1 + 0.24 * hiS * (1 - slide * 0.7); muF *= 1 - 0.07 * hiS;
      if (this.kick > 0) muR *= 0.72;
      if (slide > 0 && this.thr > 0.5) muR *= 1 - 0.07 * slide;
      // obciążenia osi (przenoszenie masy)
      const Wt = m * GRAV, Wf = clamp(m * (GRAV * b - this.axS * p.cgH) / L, 0.18 * Wt, 0.82 * Wt), Wr = Wt - Wf;
      const DF = muF * Wf, DR = muR * Wr;
      // silnik i skrzynia
      const driveFront = p.drive === 'FWD', awd = p.drive === 'AWD';
      let Fdrive = 0;
      if (this.shiftT > 0) this.shiftT -= dt;
      if (rev) { const Fr = this.Tpeak * 0.9 * this.ratios[0] * this.eff / p.R * 0.55; Fdrive = u > -8 ? -this.thr * Fr : 0; }
      else if (this.thr > 0 || this.gear > 0) {
        const g = this.gear, rpmW = this.rpmAt(u, g);
        if (this.shiftT <= 0) {
          if (g < p.gears - 1 && rpmW > 0.93 * p.red && this.thr > 0.05 && !this.hand) { this.gear++; this.shiftT = 0.2; }
          else if (g > 0 && rpmW < 0.47 * p.red && this.rpmAt(u, g - 1) < 0.78 * p.red) { this.gear--; this.shiftT = 0.12; }
        }
        const x = Math.max(rpmW, p.idle * 1.5) / p.red;
        Fdrive = this.thr * this.Tpeak * tqCurve(x) * this.ratios[this.gear] * this.eff / p.R;
        if (this.shiftT > 0) Fdrive *= 0.2;
        if (this.kick > 0) Fdrive *= 1.65;
      }
      if (u < 2 && !rev && this.thr === 0) this.gear = 0;
      const engBrake = (!rev && this.thr < 0.05 && u > 1) ? -0.055 * Wt * clamp(this.rpmAt(u, this.gear) / p.red, 0.2, 1) : 0;
      const Fb = this.brk * p.brakeG * Wt, sgnU = clamp(u / 0.4, -1, 1);
      let FxF_d = -sgnU * Fb * 0.64, FxR_d = -sgnU * Fb * 0.36;
      if (awd) { FxF_d += (Fdrive + engBrake) * 0.4; if (!this.hand) FxR_d += (Fdrive + engBrake) * 0.6; }
      else if (driveFront) FxF_d += Fdrive + engBrake; else if (!this.hand) FxR_d += Fdrive + engBrake;
      // kontrola trakcji (auta drogowe): bez buksowania przy ruszaniu — poślizg tylko z ręcznym / sprzęgłem
      if (p.tc && !this.kick && !this.hand) { FxF_d = Math.min(FxF_d, DF * 0.98); FxR_d = Math.min(FxR_d, DR * 0.98); }
      // kąty znoszenia osi
      const den = Math.max(Math.abs(u), 2.5), vyF = vy + a * w, vyR = vy - b * w, sg = u >= 0 ? 1 : -1;
      const aF = Math.atan2(vyF, den) - dl * sg, aR = Math.atan2(vyR, den), vlatF = -u * sd + vyF * cd;
      // przód
      let FxF = clamp(FxF_d, -DF, DF);
      const capF = DF * Math.sqrt(Math.max(0.05, 1 - (FxF / DF) * (FxF / DF)));
      let FyF = clamp(-DF * pac(aF, 8.0, 1.5), -capF, capF);
      const limF = (Wf / GRAV) * Math.abs(vlatF) / dt; FyF = clamp(FyF, -limF, limF);
      let spinF = 0;
      if ((driveFront || awd) && FxF_d > DF * 1.02) { FxF = DF * 0.9; spinF = (FxF_d / DF - 1); }
      // tył
      let FxR, FyR, spinR = 0; this.locked = false; this.spinning = false;
      if (this.hand) {
        const mk = 0.8 * muR * Wr, vR = Math.hypot(u, vyR), sc = vR > 0.6 ? 1 : vR / 0.6;
        FxR = vR > 1e-4 ? -mk * u / vR * sc : 0; FyR = vR > 1e-4 ? -mk * vyR / vR * sc : 0;
        this.locked = Math.abs(u) > 1.5;
        const limR = (Wr / GRAV) * vR / dt, fm = Math.hypot(FxR, FyR); if (fm > limR && fm > 0) { FxR *= limR / fm; FyR *= limR / fm; }
      } else {
        FxR = clamp(FxR_d, -DR, DR);
        if (!driveFront && FxR_d > DR) { FxR = DR * 0.88; spinR = FxR_d / DR - 1; this.spinning = true; }
        const capR = DR * Math.sqrt(Math.max(0.05, 1 - (FxR / DR) * (FxR / DR)));
        FyR = clamp(-DR * pac(aR, 8.0, 1.55), -capR, capR);
        const limR = (Wr / GRAV) * Math.abs(vyR) / dt; FyR = clamp(FyR, -limR, limR);
      }
      if (spinF > 0) this.spinning = true;
      // opory i suma sił
      const Froll = -(this.Crr + (dragF + dragR) * 0.5) * Wt * clamp(u / 0.8, -1, 1);
      const Fx = FxR + FxF * cd - FyF * sd + Froll + this.extraF, Fy = FyR + FyF * cd + FxF * sd, Mz = a * (FyF * cd + FxF * sd) - b * FyR;
      const Fwx = Fx * fx + Fy * lx - this.Cd * speed * this.vx, Fwz = Fx * fz + Fy * lz - this.Cd * speed * this.vz;
      this.vx += Fwx / m * dt; this.vz += Fwz / m * dt;
      this.w += Mz / this.I * dt;
      this.w *= 1 - (speed < 6 ? 1.5 : 0.25) * dt;
      if (speed > 3 && u > 0.3) {   // przy dużym kącie obrót dąży do obrotu toru jazdy (bez „bączków”)
        const sp2 = this.vx * this.vx + this.vz * this.vz, pathRate = (this.vz * (Fwx / m) - this.vx * (Fwz / m)) / sp2;
        const k = smoothstep(26 * DEG, 70 * DEG, absB) * (this.assist ? 5.0 : 1.6) * (this.hand ? 0.35 : 1);
        this.w += (pathRate - this.w) * Math.min(1, k * dt);
      }
      if (speed < 0.3 && this.thr < 0.02 && !rev) { this.vx *= 0.8; this.vz *= 0.8; this.w *= 0.8; }
      if (this.hand && speed < 1.2 && Fdrive === 0) { this.vx *= 0.9; this.vz *= 0.9; this.w *= 0.9; }
      this.h += this.w * dt;
      this.x += this.vx * dt; this.z += this.vz * dt;
      // wyjścia: przeciążenia (przechyły nadwozia), poślizg kół (ślady, pisk), obroty, obrót kół
      this.axS = damp(this.axS, Fx / m, 10, dt); this.ayS = damp(this.ayS, Fy / m, 8, dt);
      this.u = u; this.vy = vy; this.beta = beta; this.speed = speed;
      const lockSlip = this.locked ? Math.hypot(u, vyR) : 0;
      this.slipR = Math.max(Math.abs(vyR) > 1.2 ? Math.abs(vyR) : 0, spinR > 0 ? 3 + spinR * 10 : 0, lockSlip);
      this.slipF = Math.max(Math.abs(vlatF) > 1.5 ? Math.abs(vlatF) * 0.85 : 0, spinF > 0 ? 3 + spinF * 10 : 0, this.brk > 0.9 && FxF <= -DF * 0.99 && u > 6 ? 3 : 0);
      let rpmT;
      if (rev) rpmT = p.idle + this.thr * 0.45 * p.red;
      else if (this.spinning || this.kick > 0 || (this.hand && !driveFront && this.thr > 0.1)) rpmT = Math.max(this.rpmAt(u, this.gear), lerp(p.idle, p.red * 0.97, this.thr));
      else if (u < 2 && this.thr > 0) rpmT = lerp(p.idle * 1.2, p.red * 0.55, this.thr);
      else rpmT = Math.max(p.idle, this.rpmAt(u, this.gear));
      if (this.shiftT > 0) rpmT *= 0.82;
      this.rpm = damp(this.rpm, Math.min(rpmT, p.red * 1.02), this.spinning ? 9 : 14, dt);
      const wFree = u / p.R, wDrvSpin = this.spinning ? Math.max(wFree, this.rpm * TAU / 60 / this.ratios[this.gear]) : wFree;
      this.wheelSpinF = driveFront || awd ? wDrvSpin : wFree;
      this.wheelSpinR = this.locked ? 0 : (driveFront ? wFree : wDrvSpin);
    }
  }
  function makeBody(type) {
    const spec = BY_ID[TYPE_MODEL[type] || 'sedan'], G = getCarGeo(spec), D = spec.dims;
    return new VehicleBody(Object.assign({ tc: !!spec.road }, spec.phys, { R: D.R, wb: D.wb, len: G.len, wid: G.wid }));
  }
  window.GCCars = { CARS, BY_ID, TYPE_MODEL, specFor: type => BY_ID[TYPE_MODEL[type] || 'sedan'], getCarGeo, makeCarVisual, setPaint, setNight, setPlayerLights, updatePods, VehicleBody, makeBody };
})();
