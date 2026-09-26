/* The World of Bugs — otwarty świat 3D (Three.js r128).
   Biedronka Betty · biomy · zwierzęta z dialogami · misje = Unity (quizy) · Dzikie Komary.
   Słownictwo z ../data.js (window.BOOKS): joinbugsteam1 / bugsteam2 / bugsteam3. */
(function () {
'use strict';
const T = window.THREE;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// ---- świat / biomy ----
const MAPX = 160, MAPZ = 72;           // połowa szerokości/głębokości
const BIOMES = [
  { key:'jungle',  name:'Dżungla',  x0:-160, x1:-96, groundHex:0x2f7d3a, water:false },
  { key:'river',   name:'Rzeka',    x0:-96,  x1:-32, groundHex:0x3f8f4f, water:true, waterHex:0x2f8fc9 },
  { key:'savanna', name:'Sawanna',  x0:-32,  x1:32,  groundHex:0xcaa64e, water:false },
  { key:'desert',  name:'Pustynia', x0:32,   x1:96,  groundHex:0xe4c483, water:false },
  { key:'sea',     name:'Morze',    x0:96,   x1:160, groundHex:0x2a6f8f, water:true, waterHex:0x2f9fd9 },
];
function biomeAt(x){ for (const b of BIOMES) if (x >= b.x0 && x < b.x1) return b; return BIOMES[x<0?0:BIOMES.length-1]; }

// ---- zwierzęta + dialogi ----
const ANIMALS = [
  { key:'gorilla', em:'🦍', name:'Gorilla', biome:'jungle', color:0x3a3a3a, kind:'ape',
    lines:[['I am a gorilla. I live in the jungle.','Jestem gorylem. Mieszkam w dżungli.'],['I am very strong and I eat fruit and leaves.','Jestem bardzo silny i jem owoce oraz liście.']] },
  { key:'monkey', em:'🐒', name:'Monkey', biome:'jungle', color:0x8a5a2b, kind:'ape',
    lines:[['I am a monkey. I can climb trees.','Jestem małpą. Umiem wspinać się po drzewach.'],['I love bananas!','Uwielbiam banany!']] },
  { key:'tiger', em:'🐅', name:'Tiger', biome:'jungle', color:0xe08a2b, kind:'cat',
    lines:[['I am a tiger. I have orange fur with black stripes.','Jestem tygrysem. Mam pomarańczowe futro w czarne paski.'],['I am a big cat and a great swimmer.','Jestem wielkim kotem i świetnie pływam.']] },
  { key:'lizard', em:'🦎', name:'Lizard', biome:'desert', color:0x6fae4a, kind:'small',
    lines:[['I am a lizard. I like warm rocks in the sun.','Jestem jaszczurką. Lubię ciepłe kamienie w słońcu.'],['I can run very fast!','Umiem bardzo szybko biegać!']] },
  { key:'crocodile', em:'🐊', name:'Crocodile', biome:'river', color:0x3f6f3a, kind:'croc',
    lines:[['I am a crocodile. I live in the river.','Jestem krokodylem. Mieszkam w rzece.'],['I have very sharp teeth!','Mam bardzo ostre zęby!']] },
  { key:'lion', em:'🦁', name:'Lion', biome:'savanna', color:0xd9a441, kind:'cat',
    lines:[['I am a lion, the king of the savanna.','Jestem lwem, królem sawanny.'],['I live in a group called a pride.','Żyję w grupie zwanej stadem.']] },
  { key:'giraffe', em:'🦒', name:'Giraffe', biome:'savanna', color:0xe0b24a, kind:'tall',
    lines:[['I am a giraffe. I have a very long neck.','Jestem żyrafą. Mam bardzo długą szyję.'],['I eat leaves from tall trees.','Jem liście z wysokich drzew.']] },
  { key:'zebra', em:'🦓', name:'Zebra', biome:'savanna', color:0xeeeeee, kind:'horse',
    lines:[['I am a zebra. I have black and white stripes.','Jestem zebrą. Mam czarno-białe paski.'],['Every zebra has different stripes.','Każda zebra ma inne paski.']] },
  { key:'cheetah', em:'🐆', name:'Cheetah', biome:'savanna', color:0xe4c25a, kind:'cat',
    lines:[['I am a cheetah. I am the fastest animal on land.','Jestem gepardem. Jestem najszybszym zwierzęciem na lądzie.'],['I can run 100 km/h!','Umiem biec 100 km/h!']] },
  { key:'elephant', em:'🐘', name:'Elephant', biome:'savanna', color:0x9aa0a6, kind:'big',
    lines:[['I am an elephant. I am very big.','Jestem słoniem. Jestem bardzo duży.'],['I use my long trunk to drink water.','Używam długiej trąby, żeby pić wodę.']] },
  { key:'rhino', em:'🦏', name:'Rhino', biome:'savanna', color:0x9098a0, kind:'big',
    lines:[['I am a rhino. I have a big horn.','Jestem nosorożcem. Mam wielki róg.'],['I eat grass and I love mud.','Jem trawę i uwielbiam błoto.']] },
  { key:'whale', em:'🐋', name:'Whale', biome:'sea', color:0x3a6fae, kind:'fish',
    lines:[['I am a whale. I am the biggest animal in the sea.','Jestem wielorybem. Jestem największym zwierzęciem w morzu.'],['I breathe air, so I come up to the surface.','Oddycham powietrzem, więc wypływam na powierzchnię.']] },
  { key:'shark', em:'🦈', name:'Shark', biome:'sea', color:0x6f8fa6, kind:'fish',
    lines:[['I am a shark. I have many sharp teeth.','Jestem rekinem. Mam wiele ostrych zębów.'],['I am a very good hunter.','Jestem bardzo dobrym myśliwym.']] },
  { key:'fish', em:'🐟', name:'Fish', biome:'sea', color:0x4fb3d9, kind:'fish',
    lines:[['I am a fish. I swim in big groups.','Jestem rybą. Pływam w wielkich ławicach.'],['I breathe under water with my gills.','Oddycham pod wodą skrzelami.']] },
];

// ---- Three.js podstawy ----
let renderer, scene, camera;
const clock = new T.Clock();
let running = false, book = null, missions = [], animals = [], mosquitoes = [], markers = [];
let doneCount = 0;
const key = {};
let camYaw = 0, camPitch = 0.5, camDist = 10;
let flyHeld = false;
const betty = { g:null, pos:new T.Vector3(-120, 0.7, 0), vel:new T.Vector3(), yaw:0, flying:false, wingPhase:0, cooldown:0, walkPhase:0 };
let interactTarget = null;   // {type:'animal'|'mission', ref}
let paused = false;          // gdy modal otwarty

function initThree(){
  renderer = new T.WebGLRenderer({ canvas:$('game'), antialias:true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  scene = new T.Scene();
  scene.background = new T.Color(0x9fd8ff);
  scene.fog = new T.Fog(0xbfe6ff, 120, 300);
  camera = new T.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 800);
  const hemi = new T.HemisphereLight(0xffffff, 0x557045, 0.95); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff3d0, 0.9);
  sun.position.set(60, 120, 40); sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  const sc = sun.shadow.camera; sc.left=-60; sc.right=60; sc.top=60; sc.bottom=-60; sc.near=10; sc.far=320;
  scene.add(sun); scene.add(sun.target);
  window.__sun = sun;
  addEventListener('resize', onResize);
}
function onResize(){ camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }

// ---- pomoc: emoji/label sprite ----
function makeLabel(text, sub){
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = '84px system-ui'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(text, 128, sub?52:64);
  if (sub){ g.font='700 30px Nunito, system-ui'; g.fillStyle='#ffffff';
    g.strokeStyle='#0009'; g.lineWidth=6; g.strokeText(sub,128,104); g.fillText(sub,128,104); }
  const tex = new T.CanvasTexture(c); tex.anisotropy = 4;
  const sp = new T.Sprite(new T.SpriteMaterial({ map:tex, transparent:true, depthWrite:false }));
  sp.scale.set(3.2, 1.6, 1);
  return sp;
}

// ---- świat ----
function buildWorld(){
  // podłoże per biom
  for (const b of BIOMES){
    const w = b.x1 - b.x0;
    const geo = new T.PlaneGeometry(w, MAPZ*2, 1, 1);
    const m = new T.Mesh(geo, new T.MeshLambertMaterial({ color:b.groundHex }));
    m.rotation.x = -Math.PI/2; m.position.set((b.x0+b.x1)/2, 0, 0); m.receiveShadow = true;
    scene.add(m);
    if (b.water){
      const wm = new T.Mesh(new T.PlaneGeometry(w-4, MAPZ*2-6),
        new T.MeshLambertMaterial({ color:b.waterHex, transparent:true, opacity:0.72 }));
      wm.rotation.x = -Math.PI/2; wm.position.set((b.x0+b.x1)/2, 0.12, 0); scene.add(wm);
      b.waterMesh = wm;
    }
    decorateBiome(b);
  }
  // ogrodzenie świata (żywopłot) — miękka granica wizualna
  const edgeMat = new T.MeshLambertMaterial({ color:0x24502f });
  const eh = 2.2;
  const strip = (w,d,x,z)=>{ const e=new T.Mesh(new T.BoxGeometry(w,eh,d), edgeMat); e.position.set(x,eh/2,z); scene.add(e); };
  strip(MAPX*2, 1.2, 0, -MAPZ); strip(MAPX*2, 1.2, 0, MAPZ);
  strip(1.2, MAPZ*2, -MAPX, 0); strip(1.2, MAPZ*2, MAPX, 0);
}
function tree(x,z, trunkH, canopyR, canopyColor, trunkColor){
  const gr = new T.Group();
  const tr = new T.Mesh(new T.CylinderGeometry(trunkH*0.09, trunkH*0.13, trunkH, 7),
    new T.MeshLambertMaterial({ color:trunkColor||0x6b4a2b })); tr.position.y = trunkH/2; tr.castShadow=true; gr.add(tr);
  const can = new T.Mesh(new T.SphereGeometry(canopyR, 10, 8), new T.MeshLambertMaterial({ color:canopyColor }));
  can.position.y = trunkH + canopyR*0.6; can.castShadow=true; can.scale.y=0.9; gr.add(can);
  gr.position.set(x, 0, z); scene.add(gr); return gr;
}
function decorateBiome(b){
  const cx=(b.x0+b.x1)/2, hw=(b.x1-b.x0)/2 - 4;
  const spot = ()=>[cx + rand(-hw,hw), rand(-MAPZ+6, MAPZ-6)];
  if (b.key==='jungle'){
    for (let i=0;i<26;i++){ const [x,z]=spot(); tree(x,z, rand(6,11), rand(2.6,4), pick([0x1f7a34,0x2e8b3f,0x176b2c])); }
    for (let i=0;i<14;i++){ const [x,z]=spot(); const bush=new T.Mesh(new T.SphereGeometry(rand(0.8,1.5),8,6), new T.MeshLambertMaterial({color:0x2f9b45})); bush.position.set(x,0.6,z); bush.castShadow=true; scene.add(bush);}
  } else if (b.key==='savanna'){
    for (let i=0;i<10;i++){ const [x,z]=spot(); // akacja: pień + płaska korona
      const gr=new T.Group(); const tr=new T.Mesh(new T.CylinderGeometry(0.25,0.4,5,7),new T.MeshLambertMaterial({color:0x7a5a34})); tr.position.y=2.5; tr.castShadow=true; gr.add(tr);
      const can=new T.Mesh(new T.CylinderGeometry(3.4,3.4,0.7,12),new T.MeshLambertMaterial({color:0x5f7d3a})); can.position.y=5.2; can.castShadow=true; gr.add(can); gr.position.set(x,0,z); scene.add(gr);}
    for (let i=0;i<44;i++){ const [x,z]=spot(); const g=new T.Mesh(new T.ConeGeometry(0.28,1.0,5),new T.MeshLambertMaterial({color:0xb8a24e})); g.position.set(x,0.5,z); scene.add(g);}
  } else if (b.key==='desert'){
    for (let i=0;i<10;i++){ const [x,z]=spot(); const d=new T.Mesh(new T.SphereGeometry(rand(4,8),12,6,0,Math.PI*2,0,Math.PI/2),new T.MeshLambertMaterial({color:0xdcb877})); d.position.set(x,0,z); d.scale.y=0.28; scene.add(d);}
    for (let i=0;i<10;i++){ const [x,z]=spot(); // kaktus
      const gr=new T.Group(); const b1=new T.Mesh(new T.CylinderGeometry(0.35,0.4,2.6,8),new T.MeshLambertMaterial({color:0x3f8b4a})); b1.position.y=1.3; b1.castShadow=true; gr.add(b1);
      const arm=new T.Mesh(new T.CylinderGeometry(0.2,0.22,1.1,7),new T.MeshLambertMaterial({color:0x3f8b4a})); arm.position.set(0.5,1.6,0); arm.rotation.z=-0.5; gr.add(arm); gr.position.set(x,0,z); scene.add(gr);}
  } else if (b.key==='river'){
    for (let i=0;i<30;i++){ const [x,z]=spot(); const r=new T.Mesh(new T.CylinderGeometry(0.05,0.08,rand(1,2),5),new T.MeshLambertMaterial({color:0x3f9b5a})); r.position.set(x,0.8,z); scene.add(r);}
    for (let i=0;i<8;i++){ const [x,z]=spot(); const rock=new T.Mesh(new T.DodecahedronGeometry(rand(0.6,1.3)),new T.MeshLambertMaterial({color:0x808890})); rock.position.set(x,0.4,z); rock.castShadow=true; scene.add(rock);}
  } else if (b.key==='sea'){
    for (let i=0;i<7;i++){ const [x,z]=spot(); const isle=new T.Mesh(new T.SphereGeometry(rand(2,4),10,6,0,Math.PI*2,0,Math.PI/2),new T.MeshLambertMaterial({color:0xe4c483})); isle.position.set(x,0.1,z); isle.scale.y=0.3; scene.add(isle);}
  }
  // tabliczka z nazwą biomu
  const lab = makeLabel(biomeEmoji(b.key), b.name); lab.position.set(cx, 7, -MAPZ+8); lab.scale.set(9,4.5,1); scene.add(lab);
}
function biomeEmoji(k){ return {jungle:'🌴',river:'🏞️',savanna:'🦁',desert:'🌵',sea:'🌊'}[k]||'🐞'; }

// ---- Betty (biedronka) ----
function buildBetty(){
  const g = new T.Group();
  const red = new T.MeshLambertMaterial({ color:0xe8382f });
  const black = new T.MeshLambertMaterial({ color:0x161616 });
  // ciało — kopuła
  const body = new T.Mesh(new T.SphereGeometry(0.9, 20, 16, 0, Math.PI*2, 0, Math.PI*0.62), red);
  body.scale.set(1, 0.8, 1.15); body.position.y = 0.55; body.castShadow = true; g.add(body);
  // spód
  const belly = new T.Mesh(new T.SphereGeometry(0.9,16,8,0,Math.PI*2,Math.PI*0.55,Math.PI*0.5), black);
  belly.scale.set(1,0.8,1.15); belly.position.y=0.55; g.add(belly);
  // linia środkowa
  const line = new T.Mesh(new T.BoxGeometry(0.06,0.5,1.9), black); line.position.set(0,0.9,0.05); g.add(line);
  // kropki
  const spots=[[0.4,0.5],[-0.4,0.5],[0.55,-0.1],[-0.55,-0.1],[0.35,-0.6],[-0.35,-0.6]];
  spots.forEach(([sx,sz])=>{ const d=new T.Mesh(new T.SphereGeometry(0.17,10,8),black); d.position.set(sx,1.02,sz); d.scale.y=0.5; g.add(d); });
  // głowa
  const head=new T.Mesh(new T.SphereGeometry(0.42,16,12),black); head.position.set(0,0.72,1.02); head.castShadow=true; g.add(head);
  // oczy
  for (const s of [-1,1]){ const e=new T.Mesh(new T.SphereGeometry(0.11,10,8),new T.MeshLambertMaterial({color:0xffffff})); e.position.set(s*0.17,0.85,1.34); g.add(e);
    const p=new T.Mesh(new T.SphereGeometry(0.05,8,6),black); p.position.set(s*0.17,0.85,1.42); g.add(p);}
  // czułki
  for (const s of [-1,1]){ const a=new T.Mesh(new T.CylinderGeometry(0.03,0.03,0.5,6),black); a.position.set(s*0.15,1.05,1.18); a.rotation.set(-0.5,0,s*0.25); g.add(a);
    const tip=new T.Mesh(new T.SphereGeometry(0.09,8,6),black); tip.position.set(s*0.24,1.28,1.32); g.add(tip);}
  // skrzydła (do machania przy locie)
  const wingMat=new T.MeshLambertMaterial({ color:0xffffff, transparent:true, opacity:0.55 });
  const mkWing=(s)=>{ const w=new T.Mesh(new T.SphereGeometry(0.8,12,8,0,Math.PI,0,Math.PI),wingMat); w.scale.set(0.6,0.15,1); const pv=new T.Group(); pv.position.set(s*0.15,1.0,0.1); pv.add(w); w.position.set(s*0.5,0,-0.2); g.add(pv); return pv; };
  betty.wL=mkWing(-1); betty.wR=mkWing(1);
  // nogi (do animacji chodu)
  betty.legs=[]; const legMat=black;
  const legPos=[[-0.55,1.0],[-0.6,0],[-0.55,-1.0],[0.55,1.0],[0.6,0],[0.55,-1.0]];
  legPos.forEach(([lx,lz])=>{ const pv=new T.Group(); pv.position.set(lx*0.55,0.35,lz*0.5);
    const l=new T.Mesh(new T.CylinderGeometry(0.05,0.04,0.6,6),legMat); l.position.y=-0.3; pv.add(l); g.add(pv); betty.legs.push(pv); });
  // etykieta
  const lab=makeLabel('🐞','Betty'); lab.position.set(0,2.4,0); lab.scale.set(2.4,1.2,1); g.add(lab); betty.label=lab;
  scene.add(g); betty.g=g;
}

// ---- zwierzęta ----
function beast(a){
  const g=new T.Group();
  const mat=new T.MeshLambertMaterial({ color:a.color });
  if (a.kind==='fish'){
    const body=new T.Mesh(new T.SphereGeometry(1,14,10),mat); body.scale.set(1.7,1,0.8); body.castShadow=true; g.add(body);
    const tail=new T.Mesh(new T.ConeGeometry(0.7,1.1,4),mat); tail.rotation.z=Math.PI/2; tail.position.x=-2; g.add(tail);
    g.userData.size = a.key==='whale'?2.2 : a.key==='shark'?1.4 : 0.8;
    g.scale.setScalar(g.userData.size);
    g.position.y = 1.4;
  } else {
    const sz = a.kind==='big'?1.7 : a.kind==='tall'?1.2 : a.kind==='small'?0.5 : 1;
    const body=new T.Mesh(new T.SphereGeometry(1,14,10),mat); body.scale.set(1.5,1,0.95); body.position.y=1.1*sz; body.castShadow=true; g.add(body);
    const head=new T.Mesh(new T.SphereGeometry(0.6,12,10),mat); head.position.set(1.3, (a.kind==='tall'?2.4:1.4)*sz, 0); head.castShadow=true; g.add(head);
    if (a.kind==='tall'){ const neck=new T.Mesh(new T.CylinderGeometry(0.28,0.34,2*sz,8),mat); neck.position.set(0.9,1.9*sz,0); neck.rotation.z=-0.5; g.add(neck);}
    // nogi
    for (const sx of [-1,1]) for (const sz2 of [-1,1]){ const l=new T.Mesh(new T.CylinderGeometry(0.16,0.13,1.1*sz,6),mat); l.position.set(0.7*sx, 0.55*sz, 0.5*sz2); l.castShadow=true; g.add(l);}
    g.scale.setScalar(sz);
  }
  return g;
}
function spawnAnimals(){
  animals = [];
  for (const a of ANIMALS){
    const b = BIOMES.find(x=>x.key===a.biome) || BIOMES[0];
    const cx=(b.x0+b.x1)/2, hw=(b.x1-b.x0)/2-6;
    const g = beast(a);
    const x = cx + rand(-hw,hw), z = rand(-MAPZ+8, MAPZ-8);
    g.position.x = x; g.position.z = z; if (a.kind!=='fish') g.position.y=0;
    g.rotation.y = rand(0,6.28);
    const lab = makeLabel(a.em, a.name); lab.position.set(0, a.kind==='fish'?2.6:(a.kind==='big'||a.kind==='tall'?4.4:3), 0);
    lab.scale.set(3.2,1.6,1); g.add(lab);
    scene.add(g);
    animals.push({ def:a, g, base:new T.Vector3(x, g.position.y, z), t:rand(0,6), label:lab });
  }
}

// ---- komary ----
function buildMosquito(){
  const g=new T.Group();
  const dark=new T.MeshLambertMaterial({ color:0x1c1c22 });
  const body=new T.Mesh(new T.SphereGeometry(0.5,12,10),dark); body.scale.set(1,0.8,1.7); g.add(body);
  const head=new T.Mesh(new T.SphereGeometry(0.3,10,8),dark); head.position.z=0.9; g.add(head);
  const nose=new T.Mesh(new T.CylinderGeometry(0.03,0.01,1,5),dark); nose.rotation.x=Math.PI/2; nose.position.z=1.5; g.add(nose);
  const wm=new T.MeshLambertMaterial({color:0xbfe0ff,transparent:true,opacity:0.5});
  for (const s of [-1,1]){ const w=new T.Mesh(new T.SphereGeometry(0.6,8,6,0,Math.PI),wm); w.scale.set(0.5,0.1,1); w.position.set(s*0.5,0.3,0); w.rotation.z=s*0.3; g.add(w);}
  for (const s of [-1,1]) for (let i=0;i<3;i++){ const l=new T.Mesh(new T.CylinderGeometry(0.02,0.02,0.9,4),dark); l.position.set(s*0.3,-0.3,-0.3+i*0.4); l.rotation.z=s*0.6; g.add(l);}
  const lab=makeLabel('🦟',''); lab.position.set(0,1.4,0); lab.scale.set(1.8,1.8,1); g.add(lab);
  g.scale.setScalar(1.3);
  scene.add(g); return g;
}
function spawnMosquitoes(n){
  mosquitoes=[];
  for (let i=0;i<n;i++){
    const g=buildMosquito();
    const pos=randMapPos();
    g.position.set(pos.x, 3, pos.z);
    mosquitoes.push({ g, target:randMapPos(), reTarget:0, teleport:60 });
  }
}
function randMapPos(){ return { x:rand(-MAPX+10,MAPX-10), z:rand(-MAPZ+10,MAPZ-10) }; }

// ---- misje / znaczniki ----
function unitKeysOf(b){ return Object.keys(b.units||{}).filter(k=>/^unit\d+$/.test(k)).sort((a,c)=>(+a.replace('unit',''))-(+c.replace('unit',''))); }
function cleanEN(en){ return String(en||'').split('/')[0].split(',')[0].trim(); }
function bookWords(b){ const out=[]; unitKeysOf(b).forEach(k=>(b.units[k].words||[]).forEach(w=>{ if(w[0]&&w[1]) out.push({pl:w[0],en:w[1]}); })); return out; }

function buildMissions(){
  markers.forEach(m=>scene.remove(m.g)); markers=[]; missions=[]; doneCount=0;
  const uks = unitKeysOf(book.data);
  // rozmieść znaczniki po całej mapie (po biomach)
  uks.forEach((uk, i)=>{
    const b = BIOMES[i % BIOMES.length];
    const cx=(b.x0+b.x1)/2 + rand(-14,14);
    const z = (i%2? 1:-1) * rand(14, MAPZ-14);
    const words=(book.data.units[uk].words||[]).filter(w=>w[0]&&w[1]).map(w=>({pl:w[0],en:w[1]}));
    const m={ uk, name:book.data.units[uk].name||('Unit '+(i+1)), num:i+1, words, x:cx, z, done:false };
    m.g = buildMarker(m); scene.add(m.g);
    missions.push(m); markers.push(m);
  });
  updateObjective();
}
function buildMarker(m){
  const g=new T.Group();
  const beam=new T.Mesh(new T.CylinderGeometry(1.6,1.6,20,20,1,true),
    new T.MeshBasicMaterial({ color:0xffc53a, transparent:true, opacity:0.28, side:T.DoubleSide }));
  beam.position.y=10; g.add(beam);
  const ring=new T.Mesh(new T.TorusGeometry(1.7,0.18,10,26), new T.MeshLambertMaterial({color:0xffc53a}));
  ring.rotation.x=Math.PI/2; ring.position.y=0.3; g.add(ring); m.ring=ring;
  const lab=makeLabel('📚','Unit '+m.num); lab.position.set(0,3.2,0); lab.scale.set(3.4,1.7,1); g.add(lab); m.label=lab;
  g.position.set(m.x,0,m.z);
  return g;
}
function markMissionDone(m){
  if (m.done) return; m.done=true; doneCount++;
  m.ring.material.color.set(0x57d977);
  m.g.children[0].material.color.set(0x57d977);
  m.label.material.map.dispose();
  const nl=makeLabel('✅','Unit '+m.num); m.g.remove(m.label); m.label=nl; nl.position.set(0,3.2,0); nl.scale.set(3.4,1.7,1); m.g.add(nl);
  updateObjective();
  if (doneCount>=missions.length) setTimeout(()=>bigToast('🎉 Ukończyłeś wszystkie misje '+book.name+'!'), 400);
}
function updateObjective(){
  $('objT').textContent = book.name;
  const next = missions.find(x=>!x.done);
  $('objP').textContent = `Misje: ${doneCount}/${missions.length}` + (next?` · Najbliższa: ${next.name}`:' · ukończone! 🎉');
}

// ---- input ----
addEventListener('keydown', e=>{ const k=e.key.toLowerCase();
  if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  key[k]=true;
  if (k==='shift'||k===' ') flyHeld=true;
  if (k==='e') tryInteract();
});
addEventListener('keyup', e=>{ const k=e.key.toLowerCase(); key[k]=false; if (k==='shift'||k===' ') flyHeld=false; });

let dragging=false, lastX=0, lastY=0;
const canvas=$('game');
canvas.addEventListener('pointerdown', e=>{ if (e.target.closest && e.target.closest('#touch')) return; dragging=true; lastX=e.clientX; lastY=e.clientY; });
addEventListener('pointerup', ()=>dragging=false);
addEventListener('pointermove', e=>{ if(!dragging) return; camYaw -= (e.clientX-lastX)*0.005; camPitch = clamp(camPitch+(e.clientY-lastY)*0.004, 0.12, 1.25); lastX=e.clientX; lastY=e.clientY; });

// mobile stick
const stick=$('stick'), nub=$('nub'); let stickId=null, mv={x:0,y:0};
function stickStart(e){ const t=e.changedTouches?e.changedTouches[0]:e; stickId=t.identifier??'m'; stickMove(e); }
function stickMove(e){ const t=[...(e.changedTouches||[e])].find(x=>(x.identifier??'m')===stickId); if(!t)return;
  const r=stick.getBoundingClientRect(); let dx=t.clientX-(r.left+r.width/2), dy=t.clientY-(r.top+r.height/2);
  const mag=Math.hypot(dx,dy), max=r.width/2; if(mag>max){dx*=max/mag;dy*=max/mag;}
  nub.style.left=(40+dx)+'px'; nub.style.top=(40+dy)+'px'; mv.x=dx/max; mv.y=dy/max; }
function stickEnd(){ stickId=null; mv.x=0; mv.y=0; nub.style.left='40px'; nub.style.top='40px'; }
stick.addEventListener('touchstart',e=>{e.preventDefault();stickStart(e);},{passive:false});
stick.addEventListener('touchmove',e=>{e.preventDefault();stickMove(e);},{passive:false});
stick.addEventListener('touchend',stickEnd); stick.addEventListener('touchcancel',stickEnd);
// camera drag on right side (touch handled by pointermove already for non-#touch targets)
$('btnFly').addEventListener('touchstart',e=>{e.preventDefault();flyHeld=true;},{passive:false});
$('btnFly').addEventListener('touchend',e=>{e.preventDefault();flyHeld=false;});
$('btnAct').addEventListener('touchstart',e=>{e.preventDefault();tryInteract();},{passive:false});
$('btnAct').addEventListener('click',()=>tryInteract());
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');

// ---- interakcja ----
function tryInteract(){
  if (paused || !running) return;
  if (!interactTarget) return;
  if (interactTarget.type==='animal') openDialogue(interactTarget.ref);
  else if (interactTarget.type==='mission') openQuiz(interactTarget.ref);
}

// ---- pętla ----
function loop(){
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (running && !paused) update(dt);
  updateCamera();
  renderer.render(scene, camera);
  drawMini();
}
function update(dt){
  betty.cooldown = Math.max(0, betty.cooldown - dt);
  // ruch
  let mx=0, mz=0;
  if (key['w']||key['arrowup']) mz-=1;
  if (key['s']||key['arrowdown']) mz+=1;
  if (key['a']||key['arrowleft']) mx-=1;
  if (key['d']||key['arrowright']) mx+=1;
  mx += mv.x; mz += mv.y;
  const mag=Math.hypot(mx,mz);
  const flying = flyHeld;
  betty.flying = flying;
  const speed = flying?24:11;
  if (mag>0.05){
    mx/=Math.max(1,mag); mz/=Math.max(1,mag);
    // kierunek względem kamery
    const s=Math.sin(camYaw), c=Math.cos(camYaw);
    const dx = mx*c - mz*s, dz = mx*s + mz*c;
    betty.pos.x = clamp(betty.pos.x + dx*speed*dt, -MAPX+3, MAPX-3);
    betty.pos.z = clamp(betty.pos.z + dz*speed*dt, -MAPZ+3, MAPZ-3);
    betty.yaw = Math.atan2(dx, dz);
    betty.walkPhase += dt*(flying?0:12);
  }
  // wysokość: lot vs chód
  const targetY = flying ? 5.5 : 0.7;
  betty.pos.y += (targetY - betty.pos.y) * Math.min(1, dt*6);
  betty.g.position.copy(betty.pos);
  betty.g.rotation.y = betty.yaw;
  // skrzydła / nogi
  betty.wingPhase += dt*(flying?40:0);
  const wf = flying ? Math.sin(betty.wingPhase)*0.6+0.4 : 0.05;
  if (betty.wL){ betty.wL.rotation.z = wf; betty.wR.rotation.z = -wf;
    betty.wL.visible = betty.wR.visible = flying; }
  betty.legs.forEach((lg,i)=>{ lg.rotation.x = flying?0.4: Math.sin(betty.walkPhase + i)*0.5*Math.min(1,mag); });
  // słońce podąża
  if (window.__sun){ window.__sun.position.set(betty.pos.x+60, 120, betty.pos.z+40); window.__sun.target.position.copy(betty.pos); }

  // zwierzęta — delikatny ruch + bujanie
  for (const an of animals){ an.t+=dt;
    if (an.def.kind==='fish'){ an.g.position.y = an.base.y + Math.sin(an.t*1.5)*0.4; an.g.position.x = an.base.x + Math.sin(an.t*0.4)*4; an.g.rotation.y = Math.sin(an.t*0.4)*0.6 + Math.PI/2*0; }
    else { an.g.position.y = an.base.y + Math.abs(Math.sin(an.t*2))*0.08; }
    faceLabel(an.label);
  }
  faceLabel(betty.label);
  markers.forEach(m=>{ m.ring.rotation.z += dt*1.5; faceLabel(m.label); });

  // komary
  for (const mo of mosquitoes){
    mo.reTarget-=dt; mo.teleport-=dt;
    if (mo.teleport<=0){ const p=randMapPos(); mo.g.position.set(p.x,3,p.z); mo.target=randMapPos(); mo.teleport=60; puff(mo.g.position); }
    if (mo.reTarget<=0){ mo.target=randMapPos(); mo.reTarget=rand(3,6); }
    const dx=mo.target.x-mo.g.position.x, dz=mo.target.z-mo.g.position.z; const d=Math.hypot(dx,dz);
    if (d>0.5){ mo.g.position.x += dx/d*3.0*dt; mo.g.position.z += dz/d*3.0*dt; mo.g.rotation.y=Math.atan2(dx,dz); }
    mo.g.position.y = 3 + Math.sin(performance.now()*0.004 + mo.g.id)*0.4;
    // złapanie
    if (betty.cooldown<=0 && !paused){
      const bd=Math.hypot(mo.g.position.x-betty.pos.x, mo.g.position.z-betty.pos.z);
      if (bd < 2.2){ startMosquito(mo); }
    }
  }

  // najbliższy cel interakcji
  findInteract();
}
function faceLabel(l){ if(l) l.quaternion.copy(camera.quaternion); }
let puffs=[];
function puff(pos){ const p=new T.Mesh(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial({color:0x333340,transparent:true,opacity:0.6})); p.position.copy(pos); scene.add(p); puffs.push({m:p,t:0}); }

function findInteract(){
  let best=null, bestD=4.6;
  for (const an of animals){ const d=Math.hypot(an.g.position.x-betty.pos.x, an.g.position.z-betty.pos.z); if(d<bestD){bestD=d; best={type:'animal',ref:an,d};} }
  for (const m of missions){ if(m.done) continue; const d=Math.hypot(m.x-betty.pos.x, m.z-betty.pos.z); if(d<bestD){bestD=d; best={type:'mission',ref:m,d};} }
  interactTarget=best;
  const pr=$('prompt'), ab=$('btnAct');
  if (best){ pr.style.display='flex'; ab.style.display='grid';
    if (best.type==='animal') $('promptTxt').innerHTML=`Porozmawiaj z ${best.ref.def.em} <b>${best.ref.def.name}</b>`;
    else $('promptTxt').innerHTML=`Rozpocznij misję 📚 <b>${best.ref.name}</b>`;
  } else { pr.style.display='none'; ab.style.display='none'; }
}
function updateCamera(){
  const tx=betty.pos.x, ty=betty.pos.y+1.4, tz=betty.pos.z;
  const cx=tx - Math.sin(camYaw)*Math.cos(camPitch)*camDist;
  const cz=tz - Math.cos(camYaw)*Math.cos(camPitch)*camDist;
  const cy=ty + Math.sin(camPitch)*camDist;
  camera.position.set(cx,cy,cz); camera.lookAt(tx,ty,tz);
  // puffs
  for (const p of puffs){ p.t+=0.03; p.m.scale.setScalar(1+p.t*4); p.m.material.opacity=0.6*(1-p.t); }
  puffs=puffs.filter(p=>{ if(p.t>=1){ scene.remove(p.m); return false;} return true; });
}

// ---- minimapa ----
const mini=$('mini'), mg=mini.getContext('2d');
function drawMini(){
  if (mini.hidden) return;
  const W=150,H=150; mg.clearRect(0,0,W,H);
  const sx=W/(MAPX*2), sz=H/(MAPZ*2);
  const toX=x=>(x+MAPX)*sx, toZ=z=>(z+MAPZ)*sz;
  const cols={jungle:'#2f7d3a',river:'#2f8fc9',savanna:'#caa64e',desert:'#e4c483',sea:'#2f9fd9'};
  for (const b of BIOMES){ mg.fillStyle=cols[b.key]||'#333'; mg.fillRect(toX(b.x0),0,(b.x1-b.x0)*sx,H); }
  // markery
  for (const m of missions){ mg.fillStyle=m.done?'#57d977':'#ffc53a'; mg.beginPath(); mg.arc(toX(m.x),toZ(m.z),3.4,0,7); mg.fill(); }
  // komary
  for (const mo of mosquitoes){ mg.fillStyle='#111'; mg.beginPath(); mg.arc(toX(mo.g.position.x),toZ(mo.g.position.z),2.6,0,7); mg.fill(); }
  // Betty
  mg.fillStyle='#e8382f'; mg.beginPath(); mg.arc(toX(betty.pos.x),toZ(betty.pos.z),3.6,0,7); mg.fill();
  mg.strokeStyle='#fff'; mg.lineWidth=1.4; mg.beginPath(); mg.moveTo(toX(betty.pos.x),toZ(betty.pos.z));
  mg.lineTo(toX(betty.pos.x)+Math.sin(betty.yaw)*8, toZ(betty.pos.z)+Math.cos(betty.yaw)*8); mg.stroke();
}

// ---- TTS ----
let voiceUK=null;
function pv(){ try{ const vs=speechSynthesis.getVoices(); voiceUK=vs.find(v=>/en[-_]?GB/i.test(v.lang)&&/google/i.test(v.name))||vs.find(v=>/en[-_]?GB/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;}catch(e){} }
if ('speechSynthesis' in window){ pv(); speechSynthesis.onvoiceschanged=pv; }
function say(t){ try{ if(!('speechSynthesis'in window))return; speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(t); u.lang='en-GB'; if(voiceUK)u.voice=voiceUK; u.rate=.92; speechSynthesis.speak(u);}catch(e){} }

// ---- DIALOG zwierzęcia ----
function openDialogue(an){
  paused=true;
  $('dlgName').textContent = `${an.def.em} ${an.def.name}`;
  const wrap=$('dlgLines'); wrap.innerHTML='';
  an.def.lines.forEach(([en,pl])=>{
    const d=document.createElement('div'); d.className='dlg-line';
    d.innerHTML=`<div style="display:flex;gap:10px;align-items:flex-start"><div style="flex:1"><div class="en">${en}</div><div class="pl">${pl}</div></div><button class="spk">🔊</button></div>`;
    d.querySelector('.spk').onclick=()=>say(en);
    wrap.appendChild(d);
  });
  $('dlgModal').classList.add('on');
  say(an.def.lines[0][0]);
}
$('dlgClose').onclick=()=>{ $('dlgModal').classList.remove('on'); paused=false; };

// ---- QUIZ misji ----
let quiz=null;
function openQuiz(m){
  paused=true;
  const words=m.words.slice(); if (words.length<1){ paused=false; return; }
  const n=Math.min(6, words.length);
  const shuffled=words.sort(()=>Math.random()-0.5).slice(0,n);
  quiz={ m, list:shuffled, i:0, correct:0, results:[] };
  $('quizTitle').textContent = `Misja: ${m.name}`;
  $('quizResult').hidden=true; $('quizFooter').hidden=true; $('quizAgain').hidden=true;
  renderQuizQ();
  $('quizModal').classList.add('on');
}
function renderQuizQ(){
  const q=quiz.list[quiz.i], pool=book.words;
  $('quizWord').textContent = q.pl;
  $('quizHint').textContent = 'Po angielsku to…';
  // opcje: 1 poprawna + 3 dystraktory
  const correct=cleanEN(q.en);
  const opts=new Set([correct]);
  let guard=0;
  while (opts.size<4 && guard++<80){ const w=cleanEN(pick(pool).en); if(w && w.toLowerCase()!==correct.toLowerCase()) opts.add(w); }
  const arr=[...opts].sort(()=>Math.random()-0.5);
  const box=$('quizOpts'); box.innerHTML='';
  arr.forEach(o=>{ const b=document.createElement('button'); b.className='opt'; b.textContent=o;
    b.onclick=()=>answerQuiz(b,o,correct); box.appendChild(b); });
  renderQProg('quizProg', quiz.results, quiz.list.length);
}
function answerQuiz(btn,chosen,correct){
  [...$('quizOpts').children].forEach(b=>b.style.pointerEvents='none');
  const ok = chosen.toLowerCase()===correct.toLowerCase();
  btn.classList.add(ok?'good':'wrong');
  if (ok) quiz.correct++;
  else { [...$('quizOpts').children].forEach(b=>{ if(b.textContent.toLowerCase()===correct.toLowerCase()) b.classList.add('good'); }); }
  quiz.results.push(ok);
  renderQProg('quizProg', quiz.results, quiz.list.length);
  say(correct);
  setTimeout(()=>{ quiz.i++; if (quiz.i<quiz.list.length) renderQuizQ(); else finishQuiz(); }, ok?650:1100);
}
function finishQuiz(){
  const pct=Math.round(quiz.correct/quiz.list.length*100);
  const passed = pct>=60;
  $('quizWord').textContent=''; $('quizHint').textContent=''; $('quizOpts').innerHTML='';
  const r=$('quizResult'); r.hidden=false;
  r.innerHTML = passed ? `✅ ${quiz.correct}/${quiz.list.length} (${pct}%) — misja zaliczona!` : `💪 ${quiz.correct}/${quiz.list.length} (${pct}%) — spróbuj jeszcze raz (min. 60%).`;
  r.style.color = passed?'#8affc0':'#ffd27a';
  $('quizFooter').hidden=false; $('quizAgain').hidden=passed;
  if (passed) markMissionDone(quiz.m);
}
$('quizExit').onclick=()=>{ $('quizModal').classList.remove('on'); paused=false; };
$('quizAgain').onclick=()=>openQuiz(quiz.m);

function renderQProg(id, results, total){
  const box=$(id); box.innerHTML='';
  for (let i=0;i<total;i++){ const s=document.createElement('i'); if(results[i]===true)s.className='ok'; else if(results[i]===false)s.className='no'; box.appendChild(s); }
}

// ---- KOMAR: wyzwanie ----
let moz=null;
function normEN(s){ return String(s||'').toLowerCase().trim().replace(/[’']/g,"'").replace(/\s+/g,' ').replace(/^(a|an|the|to)\s+/,''); }
function startMosquito(mo){
  paused=true; betty.cooldown=6;
  const pool=book.words.slice().sort(()=>Math.random()-0.5).slice(0,12);
  moz={ mo, list:pool, need:3, ok:0, results:[], idx:0 };
  $('mozNeed').textContent='3';
  $('mozFeed').hidden=true; $('mozInput').value='';
  renderMozQ();
  $('mozModal').classList.add('on');
  setTimeout(()=>$('mozInput').focus(),50);
}
function renderMozQ(){
  const q=moz.list[moz.idx % moz.list.length];
  moz.cur=q;
  $('mozWord').textContent=q.pl;
  $('mozInput').value=''; $('mozFeed').hidden=true;
  renderQProg('mozProg', moz.results, moz.need);
}
function submitMoz(){
  if (!moz) return;
  const u=normEN($('mozInput').value); if(!u){ return; }
  const answers=String(moz.cur.en).split(/[\/,]/).map(x=>normEN(x));
  const ok = answers.includes(u);
  const fb=$('mozFeed'); fb.hidden=false;
  if (ok){ moz.ok++; moz.results.push(true); say(cleanEN(moz.cur.en));
    fb.textContent='✅ Dobrze!'; fb.style.color='#8affc0';
    if (moz.ok>=moz.need){ setTimeout(endMoz,600); return; }
  } else { moz.results.push(false); fb.textContent=`❌ Poprawnie: ${cleanEN(moz.cur.en)}`; fb.style.color='#ffb3ae'; }
  renderQProg('mozProg', moz.results, moz.need);
  moz.idx++;
  setTimeout(renderMozQ, ok?600:1200);
}
function endMoz(){
  $('mozModal').classList.remove('on'); paused=false;
  // komar ucieka daleko
  const p=randMapPos(); moz.mo.g.position.set(p.x,3,p.z); moz.mo.teleport=60; puff(moz.mo.g.position);
  betty.cooldown=6; bigToast('🐞 Betty uciekła Komarowi!');
  moz=null;
}
$('mozSubmit').onclick=submitMoz;
$('mozInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); submitMoz(); } });

// ---- toast ----
let toastEl;
function bigToast(msg){
  if (!toastEl){ toastEl=document.createElement('div'); toastEl.style.cssText='position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:75;background:rgba(10,26,20,.92);border:2px solid #ffc53a;color:#fff;font-weight:900;padding:14px 22px;border-radius:16px;font-family:Fredoka,sans-serif;font-size:20px;box-shadow:0 12px 40px #000a;transition:opacity .3s'; document.body.appendChild(toastEl); }
  toastEl.textContent=msg; toastEl.style.opacity='1'; clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>toastEl.style.opacity='0',2600);
}

// ---- start ----
function renderLevels(){
  const defs=[
    { id:'joinbugsteam1', lv:'Bugs 1', em:'🐛', cls:'b1', desc:'Join Bugs Team 1 — pierwsze słówka: szkoła, zabawki, jedzenie…' },
    { id:'bugsteam2', lv:'Bugs 2', em:'🐝', cls:'b2', desc:'Bugs Team 2 — ubrania, dom, czynności, więcej słownictwa.' },
    { id:'bugsteam3', lv:'Bugs 3', em:'🦋', cls:'b3', desc:'Bugs Team 3 — zwierzęta, przyroda i trudniejsze słowa.' },
  ];
  const box=$('levels'); box.innerHTML='';
  defs.forEach(d=>{
    const data = (typeof BOOKS!=='undefined') && BOOKS[d.id];
    const el=document.createElement('div'); el.className='level '+d.cls;
    const n = data ? unitKeysOf(data).length : 0;
    el.innerHTML=`<div class="em">${d.em}</div><span class="lv">${d.lv}</span><h2>${data?data.name:d.lv}</h2><div class="desc">${d.desc}<br><b>${n} misji</b></div>`;
    el.onclick=()=>{ if(!data){ alert('Brak danych podręcznika.'); return; } startGame(d, data); };
    box.appendChild(el);
  });
}
function startGame(def, data){
  book = { id:def.id, name:data.name, data, words: bookWords(data) };
  $('start').hidden=true;
  document.body.classList.add('playing');
  $('objective').hidden=false; $('mini').hidden=false; $('hint').hidden=false;
  $('hint').innerHTML = document.body.classList.contains('touch')
    ? 'Lewy pad — ruch · <b>LATAJ</b> szybciej · podejdź do 📚 lub zwierzaka i naciśnij <b>AKCJA</b>'
    : '<b>WASD</b> ruch · mysz kamera · <b>Shift/Spacja</b> lataj · <b>E</b> rozmowa/misja';
  betty.pos.set((BIOMES[0].x0+BIOMES[0].x1)/2, 0.7, 0);
  buildMissions(); spawnAnimals(); spawnMosquitoes(3);
  running=true;
}

// ---- init ----
function main(){
  if (!T){ $('loading').textContent='Błąd: brak Three.js'; return; }
  if (typeof BOOKS === 'undefined'){ $('loading').textContent='Błąd: brak data.js'; return; }
  initThree(); buildWorld(); buildBetty();
  renderLevels();
  $('loading').hidden=true; $('start').hidden=false;
  loop();
}
main();
})();
