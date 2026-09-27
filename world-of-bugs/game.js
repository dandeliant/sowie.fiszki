/* The World of Bugs — gra 3D (Three.js r128).
   Sekwencyjne, tematyczne mapy: 1 Unit = 1 mapa = 1 misja (quiz PL→EN).
   Betty (biedronka) chodzi/lata · zwierzęta z dialogami · Dzikie Komary · punkty.
   Słownictwo z ../data.js (const BOOKS): joinbugsteam1 / bugsteam2 / bugsteam3. */
(function () {
'use strict';
const T = window.THREE;
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rand = (a,b)=>a+Math.random()*(b-a);
const pick = arr=>arr[Math.floor(Math.random()*arr.length)];

const MAPR = 58;               // połowa boku kwadratowej mapy

// ---------- zwierzęta + dialogi ----------
const ANIMALS = {
  lion:{em:'🦁',name:'Lion',color:0xd9a441,kind:'cat',lines:[['I am a lion, the king of the savanna.','Jestem lwem, królem sawanny.'],['I live in a group called a pride.','Żyję w grupie zwanej stadem.']]},
  giraffe:{em:'🦒',name:'Giraffe',color:0xe0b24a,kind:'tall',lines:[['I am a giraffe. I have a very long neck.','Jestem żyrafą. Mam bardzo długą szyję.'],['I eat leaves from tall trees.','Jem liście z wysokich drzew.']]},
  zebra:{em:'🦓',name:'Zebra',color:0xeeeeee,kind:'horse',lines:[['I am a zebra. I have black and white stripes.','Jestem zebrą. Mam czarno-białe paski.'],['Every zebra has different stripes.','Każda zebra ma inne paski.']]},
  elephant:{em:'🐘',name:'Elephant',color:0x9aa0a6,kind:'big',lines:[['I am an elephant. I am very big.','Jestem słoniem. Jestem bardzo duży.'],['I use my long trunk to drink water.','Używam długiej trąby, żeby pić wodę.']]},
  cheetah:{em:'🐆',name:'Cheetah',color:0xe4c25a,kind:'cat',lines:[['I am a cheetah, the fastest animal on land.','Jestem gepardem, najszybszym zwierzęciem na lądzie.'],['I can run 100 km/h!','Umiem biec 100 km/h!']]},
  rhino:{em:'🦏',name:'Rhino',color:0x9098a0,kind:'big',lines:[['I am a rhino. I have a big horn.','Jestem nosorożcem. Mam wielki róg.'],['I eat grass and I love mud.','Jem trawę i uwielbiam błoto.']]},
  gorilla:{em:'🦍',name:'Gorilla',color:0x3a3a3a,kind:'cat',lines:[['I am a gorilla. I live in the jungle.','Jestem gorylem. Mieszkam w dżungli.'],['I am very strong and I eat fruit.','Jestem bardzo silny i jem owoce.']]},
  monkey:{em:'🐒',name:'Monkey',color:0x8a5a2b,kind:'small',lines:[['I am a monkey. I can climb trees.','Jestem małpą. Umiem wspinać się po drzewach.'],['I love bananas!','Uwielbiam banany!']]},
  tiger:{em:'🐅',name:'Tiger',color:0xe08a2b,kind:'cat',lines:[['I am a tiger with orange fur and black stripes.','Jestem tygrysem o pomarańczowym futrze w czarne paski.'],['I am a big cat and a great swimmer.','Jestem wielkim kotem i świetnie pływam.']]},
  crocodile:{em:'🐊',name:'Crocodile',color:0x3f6f3a,kind:'croc',lines:[['I am a crocodile. I live in the water.','Jestem krokodylem. Mieszkam w wodzie.'],['I have very sharp teeth!','Mam bardzo ostre zęby!']]},
  whale:{em:'🐋',name:'Whale',color:0x3a6fae,kind:'fish',lines:[['I am a whale, the biggest animal in the sea.','Jestem wielorybem, największym zwierzęciem w morzu.'],['I breathe air at the surface.','Oddycham powietrzem na powierzchni.']]},
  shark:{em:'🦈',name:'Shark',color:0x6f8fa6,kind:'fish',lines:[['I am a shark. I have many sharp teeth.','Jestem rekinem. Mam wiele ostrych zębów.'],['I am a very good hunter.','Jestem bardzo dobrym myśliwym.']]},
  fish:{em:'🐟',name:'Fish',color:0x4fb3d9,kind:'fish',lines:[['I am a fish. I swim in big groups.','Jestem rybą. Pływam w ławicach.'],['I breathe with my gills.','Oddycham skrzelami.']]},
  lizard:{em:'🦎',name:'Lizard',color:0x6fae4a,kind:'small',lines:[['I am a lizard. I like warm rocks in the sun.','Jestem jaszczurką. Lubię ciepłe kamienie w słońcu.'],['I can run very fast!','Umiem bardzo szybko biegać!']]},
  snake:{em:'🐍',name:'Snake',color:0x6a9b3a,kind:'snake',lines:[['I am a snake. I have no legs.','Jestem wężem. Nie mam nóg.'],['I move by sliding on the ground.','Poruszam się, ślizgając po ziemi.']]},
  camel:{em:'🐫',name:'Camel',color:0xcaa066,kind:'big',lines:[['I am a camel. I live in the desert.','Jestem wielbłądem. Mieszkam na pustyni.'],['I can go a long time without water.','Mogę długo wytrzymać bez wody.']]},
  rabbit:{em:'🐰',name:'Rabbit',color:0xd8d2c8,kind:'small',lines:[['I am a rabbit. I have long ears.','Jestem królikiem. Mam długie uszy.'],['I love carrots and I can jump high.','Uwielbiam marchewki i wysoko skaczę.']]},
  frog:{em:'🐸',name:'Frog',color:0x4fae5a,kind:'small',lines:[['I am a frog. I live near the water.','Jestem żabą. Mieszkam przy wodzie.'],['I catch flies with my long tongue.','Łapię muchy długim językiem.']]},
  bird:{em:'🐦',name:'Bird',color:0x5aa0e0,kind:'small',lines:[['I am a bird. I can fly in the sky.','Jestem ptakiem. Umiem latać po niebie.'],['I build a nest and I sing.','Buduję gniazdo i śpiewam.']]},
  crab:{em:'🦀',name:'Crab',color:0xe0503a,kind:'small',lines:[['I am a crab. I live on the beach.','Jestem krabem. Mieszkam na plaży.'],['I walk sideways!','Chodzę bokiem!']]},
};
const WATER_KEYS = { whale:1, shark:1, fish:1 };

// ---------- tematy map (kolejno wg Unitów) ----------
const THEMES = [
  { name:'Sawanna',      decor:'savanna', sky:0xbfe6ff, ground:0xcaa64e,
    water:{x0:18,x1:50,z0:-18,z1:18,color:0x2f8fc9},
    animals:{ lion:2, zebra:3, giraffe:2, elephant:1, cheetah:2 } },
  { name:'Pustynia',     decor:'desert',  sky:0xffe6b0, ground:0xe4c483, water:null,
    animals:{ lizard:5, snake:3, camel:2 } },
  { name:'Łąka i rzeka', decor:'meadow',  sky:0xd0efff, ground:0x67bf46,
    water:{x0:-50,x1:-30,z0:-MAPR,z1:MAPR,color:0x3f9fd0},
    animals:{ rabbit:4, frog:3, bird:4, fish:3 } },
  { name:'Dżungla',      decor:'jungle',  sky:0x9fd8c0, ground:0x2f7d3a, water:null,
    animals:{ gorilla:1, monkey:3, tiger:2, snake:2, bird:3 } },
  { name:'Miasto',       decor:'city',    sky:0xbcd0e0, ground:0x8b9199, water:null,
    animals:{ bird:6, rabbit:2, monkey:1 } },
  { name:'Plaża i morze',decor:'beach',   sky:0x8fd3ff, ground:0xe8d59a,
    water:{x0:-6,x1:MAPR,z0:-MAPR,z1:MAPR,color:0x2f9fd9},
    animals:{ whale:1, shark:2, fish:5, crab:3 } },
];

// ---------- Three.js ----------
let renderer, scene, camera, sun;
const clock = new T.Clock();
let running=false, book=null;
let units=[], unitIdx=0, mission=null;   // aktualna misja
let animals=[], mosquitoes=[], worldGroup=null, marker=null;
const key = {};
let camYaw=0, camPitch=0.55, camDist=11, flyHeld=false;
let paused=false;
let score=0, combo=0;
const talked = new Set();
const betty = { g:null, pos:new T.Vector3(0,0.7,MAPR-12), vel:new T.Vector3(), yaw:0, flying:false, wingPhase:0, walkPhase:0, cooldown:0, wL:null, wR:null, legs:[], label:null };
let interactTarget=null;

function initThree(){
  renderer=new T.WebGLRenderer({canvas:$('game'),antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
  scene=new T.Scene(); scene.background=new T.Color(0x9fd8ff); scene.fog=new T.Fog(0xbfe6ff,90,240);
  camera=new T.PerspectiveCamera(60,innerWidth/innerHeight,0.1,600);
  scene.add(new T.HemisphereLight(0xffffff,0x557045,0.95));
  sun=new T.DirectionalLight(0xfff3d0,0.9); sun.position.set(40,90,30); sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024); const sc=sun.shadow.camera; sc.left=-70;sc.right=70;sc.top=70;sc.bottom=-70;sc.near=5;sc.far=260;
  scene.add(sun); scene.add(sun.target);
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
}

// ---------- label sprite (emoji + nazwa) ----------
function makeLabel(text, sub){
  const c=document.createElement('canvas'); c.width=256; c.height=128; const g=c.getContext('2d');
  g.font='84px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,128,sub?52:64);
  if(sub){ g.font='700 30px Nunito, system-ui'; g.fillStyle='#fff'; g.strokeStyle='#0009'; g.lineWidth=6; g.strokeText(sub,128,104); g.fillText(sub,128,104); }
  const tex=new T.CanvasTexture(c); tex.anisotropy=4;
  const sp=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false})); sp.scale.set(3.2,1.6,1); return sp;
}

// ---------- Betty ----------
function buildBetty(){
  const g=new T.Group();
  const red=new T.MeshLambertMaterial({color:0xe8382f}), black=new T.MeshLambertMaterial({color:0x161616});
  const body=new T.Mesh(new T.SphereGeometry(0.9,20,16,0,Math.PI*2,0,Math.PI*0.62),red); body.scale.set(1,0.8,1.15); body.position.y=0.55; body.castShadow=true; g.add(body);
  const belly=new T.Mesh(new T.SphereGeometry(0.9,16,8,0,Math.PI*2,Math.PI*0.55,Math.PI*0.5),black); belly.scale.set(1,0.8,1.15); belly.position.y=0.55; g.add(belly);
  const line=new T.Mesh(new T.BoxGeometry(0.06,0.5,1.9),black); line.position.set(0,0.9,0.05); g.add(line);
  [[0.4,0.5],[-0.4,0.5],[0.55,-0.1],[-0.55,-0.1],[0.35,-0.6],[-0.35,-0.6]].forEach(([sx,sz])=>{const d=new T.Mesh(new T.SphereGeometry(0.17,10,8),black);d.position.set(sx,1.02,sz);d.scale.y=0.5;g.add(d);});
  const head=new T.Mesh(new T.SphereGeometry(0.42,16,12),black); head.position.set(0,0.72,1.02); head.castShadow=true; g.add(head);
  for(const s of[-1,1]){const e=new T.Mesh(new T.SphereGeometry(0.11,10,8),new T.MeshLambertMaterial({color:0xffffff}));e.position.set(s*0.17,0.85,1.34);g.add(e);const p=new T.Mesh(new T.SphereGeometry(0.05,8,6),black);p.position.set(s*0.17,0.85,1.42);g.add(p);}
  for(const s of[-1,1]){const a=new T.Mesh(new T.CylinderGeometry(0.03,0.03,0.5,6),black);a.position.set(s*0.15,1.05,1.18);a.rotation.set(-0.5,0,s*0.25);g.add(a);const tip=new T.Mesh(new T.SphereGeometry(0.09,8,6),black);tip.position.set(s*0.24,1.28,1.32);g.add(tip);}
  const wm=new T.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.55});
  const mkWing=(s)=>{const w=new T.Mesh(new T.SphereGeometry(0.8,12,8,0,Math.PI,0,Math.PI),wm);w.scale.set(0.6,0.15,1);const pv=new T.Group();pv.position.set(s*0.15,1.0,0.1);pv.add(w);w.position.set(s*0.5,0,-0.2);g.add(pv);return pv;};
  betty.wL=mkWing(-1); betty.wR=mkWing(1);
  betty.legs=[]; const legPos=[[-0.55,1.0],[-0.6,0],[-0.55,-1.0],[0.55,1.0],[0.6,0],[0.55,-1.0]];
  legPos.forEach(([lx,lz])=>{const pv=new T.Group();pv.position.set(lx*0.55,0.35,lz*0.5);const l=new T.Mesh(new T.CylinderGeometry(0.05,0.04,0.6,6),black);l.position.y=-0.3;pv.add(l);g.add(pv);betty.legs.push(pv);});
  const lab=makeLabel('🐞','Betty'); lab.position.set(0,2.4,0); lab.scale.set(2.4,1.2,1); g.add(lab); betty.label=lab;
  scene.add(g); betty.g=g;
}

// ---------- świat / dekoracje ----------
function tree(group,x,z,h,r,col,trunkCol){
  const gr=new T.Group();
  const tr=new T.Mesh(new T.CylinderGeometry(h*0.09,h*0.13,h,7),new T.MeshLambertMaterial({color:trunkCol||0x6b4a2b})); tr.position.y=h/2; tr.castShadow=true; gr.add(tr);
  const can=new T.Mesh(new T.SphereGeometry(r,10,8),new T.MeshLambertMaterial({color:col})); can.position.y=h+r*0.6; can.scale.y=0.9; can.castShadow=true; gr.add(can);
  gr.position.set(x,0,z); group.add(gr);
}
function inWater(theme,x,z){ const w=theme.water; return w && x>=w.x0 && x<=w.x1 && z>=w.z0 && z<=w.z1; }
function randLand(theme){ for(let i=0;i<40;i++){ const x=rand(-MAPR+6,MAPR-6),z=rand(-MAPR+6,MAPR-6); if(!inWater(theme,x,z)) return {x,z}; } return {x:0,z:0}; }
function randWater(theme){ const w=theme.water; return { x:rand(w.x0+2,w.x1-2), z:rand(Math.max(w.z0,-MAPR+4),Math.min(w.z1,MAPR-4)) }; }

function buildWorld(theme){
  if(worldGroup){ scene.remove(worldGroup); disposeGroup(worldGroup); }
  worldGroup=new T.Group(); scene.add(worldGroup);
  scene.background.set(theme.sky); scene.fog.color.set(theme.sky);
  // podłoże
  const ground=new T.Mesh(new T.PlaneGeometry(MAPR*2,MAPR*2),new T.MeshLambertMaterial({color:theme.ground}));
  ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; worldGroup.add(ground);
  // woda
  if(theme.water){ const w=theme.water; const wm=new T.Mesh(new T.PlaneGeometry(w.x1-w.x0,w.z1-w.z0),new T.MeshLambertMaterial({color:theme.water.color,transparent:true,opacity:0.75}));
    wm.rotation.x=-Math.PI/2; wm.position.set((w.x0+w.x1)/2,0.12,(w.z0+w.z1)/2); worldGroup.add(wm); }
  // granica
  const edge=new T.MeshLambertMaterial({color:0x2b4a35}); const eh=2.4;
  const strip=(w,d,x,z)=>{const e=new T.Mesh(new T.BoxGeometry(w,eh,d),edge);e.position.set(x,eh/2,z);worldGroup.add(e);};
  strip(MAPR*2,1.2,0,-MAPR); strip(MAPR*2,1.2,0,MAPR); strip(1.2,MAPR*2,-MAPR,0); strip(1.2,MAPR*2,MAPR,0);
  decorTheme(theme);
}
function decorTheme(theme){
  const G=worldGroup, rl=()=>randLand(theme);
  const d=theme.decor;
  if(d==='savanna'){
    for(let i=0;i<12;i++){const p=rl();const gr=new T.Group();const tr=new T.Mesh(new T.CylinderGeometry(0.25,0.4,5,7),new T.MeshLambertMaterial({color:0x7a5a34}));tr.position.y=2.5;tr.castShadow=true;gr.add(tr);const can=new T.Mesh(new T.CylinderGeometry(3.4,3.4,0.7,12),new T.MeshLambertMaterial({color:0x5f7d3a}));can.position.y=5.2;can.castShadow=true;gr.add(can);gr.position.set(p.x,0,p.z);G.add(gr);}
    for(let i=0;i<50;i++){const p=rl();const g=new T.Mesh(new T.ConeGeometry(0.28,1,5),new T.MeshLambertMaterial({color:0xb8a24e}));g.position.set(p.x,0.5,p.z);G.add(g);}
  } else if(d==='desert'){
    for(let i=0;i<12;i++){const p=rl();const dn=new T.Mesh(new T.SphereGeometry(rand(4,8),12,6,0,Math.PI*2,0,Math.PI/2),new T.MeshLambertMaterial({color:0xdcb877}));dn.position.set(p.x,0,p.z);dn.scale.y=0.26;G.add(dn);}
    for(let i=0;i<12;i++){const p=rl();const gr=new T.Group();const b1=new T.Mesh(new T.CylinderGeometry(0.35,0.4,2.6,8),new T.MeshLambertMaterial({color:0x3f8b4a}));b1.position.y=1.3;b1.castShadow=true;gr.add(b1);const arm=new T.Mesh(new T.CylinderGeometry(0.2,0.22,1.1,7),new T.MeshLambertMaterial({color:0x3f8b4a}));arm.position.set(0.5,1.6,0);arm.rotation.z=-0.5;gr.add(arm);gr.position.set(p.x,0,p.z);G.add(gr);}
    for(let i=0;i<10;i++){const p=rl();const r=new T.Mesh(new T.DodecahedronGeometry(rand(0.6,1.4)),new T.MeshLambertMaterial({color:0xc9a06a}));r.position.set(p.x,0.4,p.z);G.add(r);}
  } else if(d==='meadow'){
    for(let i=0;i<14;i++){const p=rl();tree(G,p.x,p.z,rand(4,7),rand(1.8,3),pick([0x3fae4f,0x54c063,0x2f9b45]));}
    for(let i=0;i<70;i++){const p=rl();const c=new T.Mesh(new T.SphereGeometry(0.18,6,5),new T.MeshLambertMaterial({color:pick([0xff6b9d,0xffe14a,0xff9d3a,0xffffff,0xb07dff])}));c.position.set(p.x,0.5,p.z);G.add(c);const st=new T.Mesh(new T.CylinderGeometry(0.02,0.02,0.5,4),new T.MeshLambertMaterial({color:0x2f8b3a}));st.position.set(p.x,0.25,p.z);G.add(st);}
    for(let i=0;i<18;i++){const p=rl();const r=new T.Mesh(new T.DodecahedronGeometry(rand(0.4,0.9)),new T.MeshLambertMaterial({color:0x8a9090}));r.position.set(p.x,0.3,p.z);G.add(r);}
  } else if(d==='jungle'){
    for(let i=0;i<30;i++){const p=rl();tree(G,p.x,p.z,rand(6,11),rand(2.6,4),pick([0x1f7a34,0x2e8b3f,0x176b2c]));}
    for(let i=0;i<20;i++){const p=rl();const b=new T.Mesh(new T.SphereGeometry(rand(0.9,1.6),8,6),new T.MeshLambertMaterial({color:0x2f9b45}));b.position.set(p.x,0.6,p.z);b.castShadow=true;G.add(b);}
  } else if(d==='city'){
    // trawniki
    for(let i=0;i<8;i++){const p=rl();const gr=new T.Mesh(new T.PlaneGeometry(rand(6,12),rand(6,12)),new T.MeshLambertMaterial({color:0x4f8b45}));gr.rotation.x=-Math.PI/2;gr.position.set(p.x,0.02,p.z);G.add(gr);}
    for(let i=0;i<26;i++){const p=rl();const h=rand(6,26),w=rand(4,7);const col=pick([0xcdd6e0,0x9fb0c0,0xb9c2cc,0x8fa0b0,0xd8cbb0]);
      const b=new T.Mesh(new T.BoxGeometry(w,h,w),new T.MeshLambertMaterial({color:col}));b.position.set(p.x,h/2,p.z);b.castShadow=true;G.add(b);
      const roof=new T.Mesh(new T.BoxGeometry(w*0.5,0.6,w*0.5),new T.MeshLambertMaterial({color:0x556}));roof.position.set(p.x,h+0.3,p.z);G.add(roof);}
    for(let i=0;i<12;i++){const p=rl();const post=new T.Mesh(new T.CylinderGeometry(0.08,0.12,4,6),new T.MeshLambertMaterial({color:0x333}));post.position.set(p.x,2,p.z);G.add(post);const lamp=new T.Mesh(new T.SphereGeometry(0.25,8,6),new T.MeshLambertMaterial({color:0xffe9a0}));lamp.position.set(p.x,4,p.z);G.add(lamp);}
  } else if(d==='beach'){
    for(let i=0;i<10;i++){const p=randLand(theme);const gr=new T.Group();const tr=new T.Mesh(new T.CylinderGeometry(0.18,0.28,6,7),new T.MeshLambertMaterial({color:0x9a6b3a}));tr.position.y=3;tr.rotation.z=rand(-0.15,0.15);tr.castShadow=true;gr.add(tr);for(let k=0;k<5;k++){const lf=new T.Mesh(new T.ConeGeometry(0.4,2.4,4),new T.MeshLambertMaterial({color:0x3fae4f}));lf.position.set(0,6,0);lf.rotation.set(1.1,k*1.26,0);gr.add(lf);}gr.position.set(p.x,0,p.z);G.add(gr);}
    for(let i=0;i<16;i++){const p=randLand(theme);const s=new T.Mesh(new T.SphereGeometry(rand(0.2,0.5),6,5),new T.MeshLambertMaterial({color:0xf0e0b0}));s.position.set(p.x,0.2,p.z);G.add(s);}
    for(let i=0;i<8;i++){const w=theme.water;const st=new T.Mesh(new T.ConeGeometry(0.4,0.15,5),new T.MeshLambertMaterial({color:0xff8a4a}));st.rotation.x=-Math.PI/2;st.position.set(rand(w.x0,w.x1),0.14,rand(-MAPR+4,MAPR-4));G.add(st);}
  }
  // tabliczka tematu
  const lab=makeLabel(themeEmoji(theme.decor),theme.name); lab.position.set(0,9,-MAPR+8); lab.scale.set(11,5.5,1); worldGroup.add(lab);
}
function themeEmoji(d){ return {savanna:'🦁',desert:'🌵',meadow:'🌸',jungle:'🌴',city:'🏙️',beach:'🏖️'}[d]||'🐞'; }

// ---------- zwierzęta ----------
function beast(def){
  const g=new T.Group(); const mat=new T.MeshLambertMaterial({color:def.color});
  if(def.kind==='fish'){
    const body=new T.Mesh(new T.SphereGeometry(1,14,10),mat);body.scale.set(1.7,1,0.8);body.castShadow=true;g.add(body);
    const tail=new T.Mesh(new T.ConeGeometry(0.7,1.1,4),mat);tail.rotation.z=Math.PI/2;tail.position.x=-2;g.add(tail);
    g.scale.setScalar(def.name==='Whale'?2.1:def.name==='Shark'?1.4:0.85);
  } else if(def.kind==='snake'){
    for(let i=0;i<6;i++){const s=new T.Mesh(new T.SphereGeometry(0.35-i*0.03,10,8),mat);s.position.set(0,0.35,i*0.5);g.add(s);}
    const h=new T.Mesh(new T.SphereGeometry(0.4,10,8),mat);h.position.set(0,0.4,-0.5);g.add(h);
  } else {
    const sz=def.kind==='big'?1.7:def.kind==='tall'?1.2:def.kind==='small'?0.55:1;
    const body=new T.Mesh(new T.SphereGeometry(1,14,10),mat);body.scale.set(1.5,1,0.95);body.position.y=1.1*sz;body.castShadow=true;g.add(body);
    const head=new T.Mesh(new T.SphereGeometry(0.6,12,10),mat);head.position.set(1.3,(def.kind==='tall'?2.4:1.4)*sz,0);head.castShadow=true;g.add(head);
    if(def.kind==='tall'){const neck=new T.Mesh(new T.CylinderGeometry(0.28,0.34,2*sz,8),mat);neck.position.set(0.9,1.9*sz,0);neck.rotation.z=-0.5;g.add(neck);}
    for(const sx of[-1,1])for(const sz2 of[-1,1]){const l=new T.Mesh(new T.CylinderGeometry(0.16,0.13,1.1*sz,6),mat);l.position.set(0.7*sx,0.55*sz,0.5*sz2);l.castShadow=true;g.add(l);}
    g.scale.setScalar(sz);
  }
  return g;
}
function spawnAnimals(theme){
  animals.forEach(a=>{ worldGroup.remove(a.g); disposeGroup(a.g); }); animals=[];
  for(const key in theme.animals){
    const def=ANIMALS[key]; if(!def) continue; const count=theme.animals[key];
    for(let i=0;i<count;i++){
      const g=beast(def);
      const water=WATER_KEYS[key] && theme.water;
      const p = water?randWater(theme):randLand(theme);
      const y = def.kind==='fish'?1.4:0;
      g.position.set(p.x,y,p.z); g.rotation.y=rand(0,6.28);
      const lab=makeLabel(def.em,def.name); lab.position.set(0,def.kind==='fish'?2.6:(def.kind==='big'||def.kind==='tall'?4.4:3),0); lab.scale.set(3,1.5,1); g.add(lab);
      worldGroup.add(g);
      animals.push({def,key,g,base:new T.Vector3(p.x,y,p.z),t:rand(0,6)});
    }
  }
}

// ---------- komary ----------
function buildMosquito(){
  const g=new T.Group(); const dark=new T.MeshLambertMaterial({color:0x1c1c22});
  const body=new T.Mesh(new T.SphereGeometry(0.5,12,10),dark);body.scale.set(1,0.8,1.7);g.add(body);
  const head=new T.Mesh(new T.SphereGeometry(0.3,10,8),dark);head.position.z=0.9;g.add(head);
  const nose=new T.Mesh(new T.CylinderGeometry(0.03,0.01,1,5),dark);nose.rotation.x=Math.PI/2;nose.position.z=1.5;g.add(nose);
  const wm=new T.MeshLambertMaterial({color:0xbfe0ff,transparent:true,opacity:0.5});
  for(const s of[-1,1]){const w=new T.Mesh(new T.SphereGeometry(0.6,8,6,0,Math.PI),wm);w.scale.set(0.5,0.1,1);w.position.set(s*0.5,0.3,0);w.rotation.z=s*0.3;g.add(w);}
  const lab=makeLabel('🦟',''); lab.position.set(0,1.4,0); lab.scale.set(1.8,1.8,1); g.add(lab);
  g.scale.setScalar(1.3); scene.add(g); return g;
}
function spawnMosquitoes(n){
  mosquitoes.forEach(m=>scene.remove(m.g)); mosquitoes=[];
  for(let i=0;i<n;i++){ const g=buildMosquito(); const p=randMapPos(); g.position.set(p.x,3,p.z);
    mosquitoes.push({g,target:randMapPos(),reTarget:0,teleport:60}); }
}
function randMapPos(){ return {x:rand(-MAPR+8,MAPR-8),z:rand(-MAPR+8,MAPR-8)}; }

// ---------- misja / znacznik ----------
function unitKeysOf(b){ return Object.keys(b.units||{}).filter(k=>/^unit\d+$/.test(k)).sort((a,c)=>(+a.replace('unit',''))-(+c.replace('unit',''))); }
function cleanEN(en){ return String(en||'').split('/')[0].split(',')[0].trim(); }

function loadUnit(idx){
  unitIdx=idx;
  if(idx>=units.length){ levelComplete(); return; }
  const uk=units[idx];
  const theme=THEMES[idx % THEMES.length];
  const words=(book.data.units[uk].words||[]).filter(w=>w[0]&&w[1]).map(w=>({pl:w[0],en:w[1]}));
  mission={ uk, idx, theme, words, done:false };
  buildWorld(theme);
  spawnAnimals(theme);
  spawnMosquitoes(3);
  // znacznik misji — z dala od startu Betty
  if(marker){ /* w worldGroup, już usunięty */ }
  marker=buildMarker(idx+1);
  worldGroup.add(marker.g);
  betty.pos.set(0,0.7,MAPR-12); betty.g.position.copy(betty.pos); betty.yaw=0;
  camYaw=0;
  updateHUD();
  bigToast(`Unit ${idx+1}: ${theme.name}`);
}
function buildMarker(num){
  const g=new T.Group();
  const beam=new T.Mesh(new T.CylinderGeometry(1.7,1.7,22,20,1,true),new T.MeshBasicMaterial({color:0xffc53a,transparent:true,opacity:0.3,side:T.DoubleSide})); beam.position.y=11; g.add(beam);
  const ring=new T.Mesh(new T.TorusGeometry(1.8,0.2,10,26),new T.MeshLambertMaterial({color:0xffc53a})); ring.rotation.x=Math.PI/2; ring.position.y=0.35; g.add(ring);
  const lab=makeLabel('📚','Quiz'); lab.position.set(0,3.4,0); lab.scale.set(3.4,1.7,1); g.add(lab);
  // pozycja: losowa, z dala od Betty startu (0, MAPR-12)
  let x,z; for(let i=0;i<40;i++){ x=rand(-MAPR+12,MAPR-12); z=rand(-MAPR+12,MAPR-22); if(Math.hypot(x-0,z-(MAPR-12))>28) break; }
  g.position.set(x,0,z);
  return {g,ring,x,z};
}
function updateHUD(){
  $('objT').textContent=`${book.label} · ⭐ ${score}`;
  const t = mission?mission.theme.name:'';
  $('objP').textContent=`Unit ${unitIdx+1}/${units.length} · ${t}` + (mission&&mission.done?' ✅':'');
}
function levelComplete(){
  running=false;
  $('quizTitle').textContent='🏆 Ukończono poziom!';
  $('quizSub').textContent=`${book.label} — wszystkie misje zaliczone!`;
  $('quizWord').textContent=`⭐ ${score} pkt`; $('quizHint').textContent='Świetna robota, Betty!';
  $('quizOpts').innerHTML=''; $('quizProg').innerHTML=''; $('quizResult').hidden=true;
  $('quizFooter').hidden=false; $('quizAgain').hidden=true; $('quizExit').textContent='← Menu';
  $('quizExit').onclick=()=>location.reload();
  paused=true; $('quizModal').classList.add('on');
}

// ---------- punktacja ----------
function addScore(n, label){
  score=Math.max(0,score+n); updateHUD();
  scorePop((n>=0?'+':'')+n+(label?' '+label:''));
}
let popEl;
function scorePop(txt){
  if(!popEl){ popEl=document.createElement('div'); popEl.style.cssText='position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:74;font-family:Fredoka,sans-serif;font-weight:700;color:#ffe14a;font-size:24px;text-shadow:0 2px 8px #000a;transition:opacity .5s,top .5s;pointer-events:none'; document.body.appendChild(popEl); }
  popEl.textContent=txt; popEl.style.opacity='1'; popEl.style.top='14%';
  clearTimeout(popEl._t); popEl._t=setTimeout(()=>{popEl.style.opacity='0';popEl.style.top='10%';},900);
}

// ---------- input ----------
function typing(){ const a=document.activeElement; return a && (a.tagName==='INPUT'||a.tagName==='TEXTAREA'); }
addEventListener('keydown',e=>{
  if(typing()) return;                 // nie przechwytuj klawiszy podczas pisania (m.in. spacja w komarze!)
  const k=e.key.toLowerCase();
  if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();
  key[k]=true; if(k==='shift'||k===' ')flyHeld=true;
  if(k==='e') tryInteract();
});
addEventListener('keyup',e=>{ if(typing())return; const k=e.key.toLowerCase(); key[k]=false; if(k==='shift'||k===' ')flyHeld=false; });

// --- KAMERA: mysz/rysik (pointer events, TYLKO nie-dotyk) ---
let dragging=false,lastX=0,lastY=0;
$('game').addEventListener('pointerdown',e=>{ if(e.pointerType==='touch')return; if(e.target.closest&&e.target.closest('#touch'))return; dragging=true;lastX=e.clientX;lastY=e.clientY; });
addEventListener('pointerup',e=>{ if(e.pointerType==='touch')return; dragging=false; });
addEventListener('pointermove',e=>{ if(e.pointerType==='touch'||!dragging)return; camYaw-=(e.clientX-lastX)*0.005; camPitch=clamp(camPitch+(e.clientY-lastY)*0.004,0.12,1.25); lastX=e.clientX;lastY=e.clientY; });
// --- KAMERA: dotyk (natywny, sledzony po identifier — jak w Grammar City) ---
// Gałka (#stick) jest osobnym elementem z pointer-events:auto, wiec jej dotyk
// NIE dociera do canvasu. Palec na pustym obszarze przechodzi przez #touch
// (pointer-events:none) do canvasu i obraca kamere — niezaleznie od gałki.
let camTouch=null;
const _cvs=$('game');
_cvs.addEventListener('touchstart',e=>{ if(camTouch)return; const t=e.changedTouches[0]; if(!t)return; camTouch={id:t.identifier,x:t.clientX,y:t.clientY}; },{passive:true});
_cvs.addEventListener('touchmove',e=>{ if(!camTouch)return; for(const t of e.changedTouches){ if(t.identifier===camTouch.id){ camYaw-=(t.clientX-camTouch.x)*0.006; camPitch=clamp(camPitch+(t.clientY-camTouch.y)*0.004,0.12,1.25); camTouch.x=t.clientX; camTouch.y=t.clientY; } } },{passive:true});
const _camEnd=e=>{ if(!camTouch)return; for(const t of e.changedTouches) if(t.identifier===camTouch.id){ camTouch=null; break; } };
_cvs.addEventListener('touchend',_camEnd); _cvs.addEventListener('touchcancel',_camEnd);

const stick=$('stick'),nub=$('nub'); let stickId=null,mv={x:0,y:0};
function sStart(e){const t=e.changedTouches?e.changedTouches[0]:e;stickId=t.identifier??'m';sMove(e);}
function sMove(e){const t=[...(e.changedTouches||[e])].find(x=>(x.identifier??'m')===stickId);if(!t)return;const r=stick.getBoundingClientRect();let dx=t.clientX-(r.left+r.width/2),dy=t.clientY-(r.top+r.height/2);const mag=Math.hypot(dx,dy),max=r.width/2;if(mag>max){dx*=max/mag;dy*=max/mag;}nub.style.left=(40+dx)+'px';nub.style.top=(40+dy)+'px';mv.x=dx/max;mv.y=dy/max;}
function sEnd(){stickId=null;mv.x=0;mv.y=0;nub.style.left='40px';nub.style.top='40px';}
stick.addEventListener('touchstart',e=>{e.preventDefault();sStart(e);},{passive:false});
stick.addEventListener('touchmove',e=>{e.preventDefault();sMove(e);},{passive:false});
stick.addEventListener('touchend',sEnd); stick.addEventListener('touchcancel',sEnd);
$('btnFly').addEventListener('touchstart',e=>{e.preventDefault();flyHeld=true;},{passive:false});
$('btnFly').addEventListener('touchend',e=>{e.preventDefault();flyHeld=false;});
$('btnAct').addEventListener('touchstart',e=>{e.preventDefault();tryInteract();},{passive:false});
$('btnAct').addEventListener('click',()=>tryInteract());
if(matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');

function tryInteract(){
  if(paused||!running||!interactTarget) return;
  if(interactTarget.type==='animal') openDialogue(interactTarget.ref);
  else if(interactTarget.type==='mission') openQuiz();
}

// ---------- pętla ----------
function loop(){ requestAnimationFrame(loop); const dt=Math.min(clock.getDelta(),0.05); if(running&&!paused)update(dt); updateCamera(); renderer.render(scene,camera); drawMini(); }
function update(dt){
  betty.cooldown=Math.max(0,betty.cooldown-dt);
  // wektor ruchu: f=przód(+W), r=prawo(+D)
  let f=0,r=0;
  if(key['w']||key['arrowup'])f+=1; if(key['s']||key['arrowdown'])f-=1;
  if(key['d']||key['arrowright'])r+=1; if(key['a']||key['arrowleft'])r-=1;
  f+=-mv.y; r+=mv.x;
  const flying=flyHeld; betty.flying=flying; const speed=flying?24:11;
  const mag=Math.hypot(f,r);
  if(mag>0.05){
    f/=Math.max(1,mag); r/=Math.max(1,mag);
    const s=Math.sin(camYaw),c=Math.cos(camYaw);
    // przód F=(sin,cos) (w głąb ekranu), prawo R=F obrócone o +90° = (-cos,sin)
    const dx=s*f - c*r, dz=c*f + s*r;
    betty.pos.x=clamp(betty.pos.x+dx*speed*dt,-MAPR+3,MAPR-3);
    betty.pos.z=clamp(betty.pos.z+dz*speed*dt,-MAPR+3,MAPR-3);
    betty.yaw=Math.atan2(dx,dz);
    betty.walkPhase+=dt*(flying?0:12);
  }
  const ty=flying?5.5:0.7; betty.pos.y+=(ty-betty.pos.y)*Math.min(1,dt*6);
  betty.g.position.copy(betty.pos); betty.g.rotation.y=betty.yaw;
  betty.wingPhase+=dt*(flying?40:0);
  const wf=flying?Math.sin(betty.wingPhase)*0.6+0.4:0.05;
  if(betty.wL){betty.wL.rotation.z=wf;betty.wR.rotation.z=-wf;betty.wL.visible=betty.wR.visible=flying;}
  betty.legs.forEach((lg,i)=>{lg.rotation.x=flying?0.4:Math.sin(betty.walkPhase+i)*0.5*Math.min(1,mag);});
  if(sun){sun.position.set(betty.pos.x+40,90,betty.pos.z+30);sun.target.position.copy(betty.pos);}

  for(const an of animals){ an.t+=dt;
    if(an.def.kind==='fish'){an.g.position.y=an.base.y+Math.sin(an.t*1.5)*0.35;an.g.position.x=an.base.x+Math.sin(an.t*0.4)*3;}
    else {an.g.position.y=an.base.y+Math.abs(Math.sin(an.t*2))*0.08;}
  }
  if(marker) marker.ring.rotation.z+=dt*1.6;

  for(const mo of mosquitoes){
    mo.reTarget-=dt; mo.teleport-=dt;
    if(mo.teleport<=0){const p=randMapPos();mo.g.position.set(p.x,3,p.z);mo.target=randMapPos();mo.teleport=60;puff(mo.g.position);}
    if(mo.reTarget<=0){mo.target=randMapPos();mo.reTarget=rand(3,6);}
    const dx=mo.target.x-mo.g.position.x,dz=mo.target.z-mo.g.position.z,d=Math.hypot(dx,dz);
    if(d>0.5){mo.g.position.x+=dx/d*3*dt;mo.g.position.z+=dz/d*3*dt;mo.g.rotation.y=Math.atan2(dx,dz);}
    mo.g.position.y=3+Math.sin(performance.now()*0.004+mo.g.id)*0.4;
    if(betty.cooldown<=0 && Math.hypot(mo.g.position.x-betty.pos.x,mo.g.position.z-betty.pos.z)<2.2) startMosquito(mo);
  }
  findInteract();
}
function updateCamera(){
  const tx=betty.pos.x,ty=betty.pos.y+1.4,tz=betty.pos.z;
  const cx=tx-Math.sin(camYaw)*Math.cos(camPitch)*camDist;
  const cz=tz-Math.cos(camYaw)*Math.cos(camPitch)*camDist;
  const cy=ty+Math.sin(camPitch)*camDist;
  camera.position.set(cx,cy,cz); camera.lookAt(tx,ty,tz);
  for(const p of puffs){p.t+=0.03;p.m.scale.setScalar(1+p.t*4);p.m.material.opacity=0.6*(1-p.t);}
  puffs=puffs.filter(p=>{if(p.t>=1){scene.remove(p.m);return false;}return true;});
}
let puffs=[];
function puff(pos){const p=new T.Mesh(new T.SphereGeometry(1,8,6),new T.MeshBasicMaterial({color:0x333340,transparent:true,opacity:0.6}));p.position.copy(pos);scene.add(p);puffs.push({m:p,t:0});}

function findInteract(){
  let best=null,bd=4.8;
  for(const an of animals){const d=Math.hypot(an.g.position.x-betty.pos.x,an.g.position.z-betty.pos.z);if(d<bd){bd=d;best={type:'animal',ref:an};}}
  if(marker && !mission.done){const d=Math.hypot(marker.x-betty.pos.x,marker.z-betty.pos.z);if(d<bd){bd=d;best={type:'mission'};}}
  interactTarget=best;
  const pr=$('prompt'),ab=$('btnAct');
  if(best){pr.style.display='flex';ab.style.display='grid';
    if(best.type==='animal') $('promptTxt').innerHTML=`Porozmawiaj z ${best.ref.def.em} <b>${best.ref.def.name}</b>`;
    else $('promptTxt').innerHTML=`Rozpocznij misję 📚 <b>Unit ${unitIdx+1}</b>`;
  } else {pr.style.display='none';ab.style.display='none';}
}

// ---------- minimapa ----------
const mini=$('mini'),mg=mini.getContext('2d');
function drawMini(){
  if(mini.hidden||!mission) return; const W=150,H=150; mg.clearRect(0,0,W,H);
  const s=W/(MAPR*2); const toX=x=>(x+MAPR)*s,toZ=z=>(z+MAPR)*s;
  mg.fillStyle='#'+mission.theme.ground.toString(16).padStart(6,'0'); mg.fillRect(0,0,W,H);
  if(mission.theme.water){const w=mission.theme.water;mg.fillStyle='#'+mission.theme.water.color.toString(16).padStart(6,'0');mg.fillRect(toX(w.x0),toZ(w.z0),(w.x1-w.x0)*s,(w.z1-w.z0)*s);}
  for(const an of animals){mg.fillStyle='#5a3a1a';mg.beginPath();mg.arc(toX(an.g.position.x),toZ(an.g.position.z),2,0,7);mg.fill();}
  if(marker&&!mission.done){mg.fillStyle='#ffc53a';mg.beginPath();mg.arc(toX(marker.x),toZ(marker.z),4,0,7);mg.fill();}
  for(const mo of mosquitoes){mg.fillStyle='#111';mg.beginPath();mg.arc(toX(mo.g.position.x),toZ(mo.g.position.z),2.6,0,7);mg.fill();}
  mg.fillStyle='#e8382f';mg.beginPath();mg.arc(toX(betty.pos.x),toZ(betty.pos.z),3.6,0,7);mg.fill();
  mg.strokeStyle='#fff';mg.lineWidth=1.4;mg.beginPath();mg.moveTo(toX(betty.pos.x),toZ(betty.pos.z));mg.lineTo(toX(betty.pos.x)+Math.sin(betty.yaw)*8,toZ(betty.pos.z)+Math.cos(betty.yaw)*8);mg.stroke();
}

// ---------- TTS (EN-GB + PL) ----------
let voiceUK=null,voicePL=null;
function pv(){ try{const vs=speechSynthesis.getVoices();
  voiceUK=vs.find(v=>/en[-_]?GB/i.test(v.lang)&&/google/i.test(v.name))||vs.find(v=>/en[-_]?GB/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;
  voicePL=vs.find(v=>/pl/i.test(v.lang)&&/google/i.test(v.name))||vs.find(v=>/pl/i.test(v.lang))||null;
}catch(e){} }
if('speechSynthesis'in window){pv();speechSynthesis.onvoiceschanged=pv;}
function say(t){try{if(!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='en-GB';if(voiceUK)u.voice=voiceUK;u.rate=.92;speechSynthesis.speak(u);}catch(e){}}
function sayPL(t){try{if(!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='pl-PL';if(voicePL)u.voice=voicePL;u.rate=.98;speechSynthesis.speak(u);}catch(e){}}

// ---------- dialog zwierzęcia ----------
function openDialogue(an){
  paused=true;
  if(!talked.has(an.def.name)){ talked.add(an.def.name); addScore(5,'nowy przyjaciel 🐾'); }
  $('dlgName').textContent=`${an.def.em} ${an.def.name}`;
  const wrap=$('dlgLines'); wrap.innerHTML='';
  an.def.lines.forEach(([en,pl])=>{const d=document.createElement('div');d.className='dlg-line';
    d.innerHTML=`<div style="display:flex;gap:10px;align-items:flex-start"><div style="flex:1"><div class="en">${en}</div><div class="pl">${pl}</div></div><button class="spk">🔊</button></div>`;
    d.querySelector('.spk').onclick=()=>say(en); wrap.appendChild(d);});
  $('dlgModal').classList.add('on'); say(an.def.lines[0][0]);
}
$('dlgClose').onclick=()=>{$('dlgModal').classList.remove('on');paused=false;};

// ---------- quiz misji ----------
let quiz=null;
function openQuiz(){
  paused=true;
  const words=mission.words.slice(); if(!words.length){paused=false;return;}
  const n=Math.min(6,words.length);
  quiz={list:words.sort(()=>Math.random()-0.5).slice(0,n),i:0,correct:0,results:[]};
  $('quizTitle').textContent=`Misja: Unit ${unitIdx+1}`; $('quizSub').textContent='Wybierz poprawne tłumaczenie';
  $('quizResult').hidden=true; $('quizFooter').hidden=true; $('quizAgain').hidden=true; $('quizExit').textContent='Wyjdź';
  $('quizExit').onclick=()=>{$('quizModal').classList.remove('on');paused=false;};
  renderQuizQ(); $('quizModal').classList.add('on');
}
function renderQuizQ(){
  const q=quiz.list[quiz.i], pool=book.words, correct=cleanEN(q.en);
  $('quizWord').textContent=q.pl; $('quizHint').textContent='Po angielsku to…';
  const opts=new Set([correct]); let guard=0;
  while(opts.size<4&&guard++<80){const w=cleanEN(pick(pool).en);if(w&&w.toLowerCase()!==correct.toLowerCase())opts.add(w);}
  const arr=[...opts].sort(()=>Math.random()-0.5); const box=$('quizOpts'); box.innerHTML='';
  arr.forEach(o=>{const b=document.createElement('button');b.className='opt';b.textContent=o;b.onclick=()=>answerQuiz(b,o,correct);box.appendChild(b);});
  renderProg('quizProg',quiz.results,quiz.list.length);
  sayPL(q.pl);          // odczyt pytania glosem PL — samo slowo po polsku
}
function answerQuiz(btn,chosen,correct){
  [...$('quizOpts').children].forEach(b=>b.style.pointerEvents='none');
  const ok=chosen.toLowerCase()===correct.toLowerCase(); btn.classList.add(ok?'good':'wrong');
  if(ok){ quiz.correct++; combo++; addScore(10+(combo>=3?5:0)); }
  else{ combo=0; [...$('quizOpts').children].forEach(b=>{if(b.textContent.toLowerCase()===correct.toLowerCase())b.classList.add('good');}); }
  quiz.results.push(ok); renderProg('quizProg',quiz.results,quiz.list.length); say(correct);
  setTimeout(()=>{quiz.i++; if(quiz.i<quiz.list.length)renderQuizQ(); else finishQuiz();}, ok?650:1100);
}
function finishQuiz(){
  const pct=Math.round(quiz.correct/quiz.list.length*100), passed=pct>=60;
  $('quizWord').textContent=''; $('quizHint').textContent=''; $('quizOpts').innerHTML='';
  const r=$('quizResult'); r.hidden=false;
  r.innerHTML=passed?`✅ ${quiz.correct}/${quiz.list.length} (${pct}%) — misja zaliczona!`:`💪 ${quiz.correct}/${quiz.list.length} (${pct}%) — spróbuj jeszcze raz (min. 60%).`;
  r.style.color=passed?'#8affc0':'#ffd27a';
  $('quizFooter').hidden=false; $('quizAgain').hidden=passed;
  if(passed){
    if(!mission.done){ mission.done=true; addScore(50,'misja!'); if(marker){marker.ring.material.color.set(0x57d977);} }
    const nextLast = unitIdx+1>=units.length;
    $('quizAgain').hidden=true;
    $('quizExit').textContent = nextLast?'🏆 Zakończ':'Następny Unit ▶';
    $('quizExit').onclick=()=>{ $('quizModal').classList.remove('on'); paused=false; loadUnit(unitIdx+1); };
    updateHUD();
  } else {
    $('quizExit').textContent='Wyjdź'; $('quizExit').onclick=()=>{$('quizModal').classList.remove('on');paused=false;};
  }
}
$('quizAgain').onclick=()=>openQuiz();
function renderProg(id,results,total){const box=$(id);box.innerHTML='';for(let i=0;i<total;i++){const s=document.createElement('i');if(results[i]===true)s.className='ok';else if(results[i]===false)s.className='no';box.appendChild(s);}}

// ---------- komar: wpisywanie ----------
let moz=null;
function normEN(s){return String(s||'').toLowerCase().trim().replace(/[’']/g,"'").replace(/\s+/g,' ').replace(/^(a|an|the|to)\s+/,'');}
const MOZ_GIVEUP_PENALTY=15;   // ile punktow traci gracz, gdy sie podda
function startMosquito(mo){
  paused=true; betty.cooldown=6;
  moz={mo,list:book.words.slice().sort(()=>Math.random()-0.5).slice(0,12),need:3,ok:0,fails:0,idx:0};
  $('mozNeed').textContent='3'; $('mozFeed').hidden=true; $('mozInput').value='';
  const gu=$('mozGiveUp'); if(gu){ gu.hidden=true; gu.textContent=`😞 Poddaje sie (-${MOZ_GIVEUP_PENALTY} pkt)`; }
  renderMozQ(); $('mozModal').classList.add('on'); setTimeout(()=>$('mozInput').focus(),60);
}
function mozProgArr(){const a=[];for(let i=0;i<moz.ok;i++)a.push(true);return a;}
function renderMozQ(){
  moz.cur=moz.list[moz.idx%moz.list.length]; moz.fails=0;
  $('mozWord').textContent=moz.cur.pl; $('mozInput').value=''; $('mozFeed').hidden=true;
  const gu=$('mozGiveUp'); if(gu) gu.hidden=true;
  renderProg('mozProg',mozProgArr(),moz.need); setTimeout(()=>$('mozInput').focus(),20);
}
function submitMoz(){
  if(!moz) return; const u=normEN($('mozInput').value); if(!u)return;
  const ans=String(moz.cur.en).split(/[\/,]/).map(x=>normEN(x)); const ok=ans.includes(u);
  const fb=$('mozFeed'); fb.hidden=false;
  if(ok){
    moz.ok++; say(cleanEN(moz.cur.en)); addScore(5);
    fb.textContent='✅ Dobrze!'; fb.style.color='#8affc0';
    renderProg('mozProg',mozProgArr(),moz.need);
    if(moz.ok>=moz.need){ setTimeout(endMoz,600); return; }
    moz.idx++; setTimeout(renderMozQ,600);       // dopiero po dobrej odpowiedzi nastepne slowo
  } else {
    moz.fails++; combo=0; $('mozInput').value='';
    if(moz.fails>=5){
      fb.textContent='❌ Nie udalo sie 5 razy. Sprobuj dalej lub sie poddaj.'; fb.style.color='#ffb3ae';
      const gu=$('mozGiveUp'); if(gu) gu.hidden=false;
    } else {
      fb.textContent=`❌ Sprobuj jeszcze raz (${moz.fails}/5)`; fb.style.color='#ffb3ae';
      setTimeout(()=>$('mozInput').focus(),20);
    }
  }
}
function endMoz(){$('mozModal').classList.remove('on');paused=false;const p=randMapPos();moz.mo.g.position.set(p.x,3,p.z);moz.mo.teleport=60;puff(moz.mo.g.position);betty.cooldown=6;addScore(20,'ucieczka! 🐞');moz=null;}
function endMozGiveUp(){
  if(!moz) return;
  addScore(-MOZ_GIVEUP_PENALTY,'poddanie 😞');
  $('mozModal').classList.remove('on'); paused=false;
  const p=randMapPos(); moz.mo.g.position.set(p.x,3,p.z); moz.mo.teleport=60; puff(moz.mo.g.position); betty.cooldown=6; moz=null;
}
$('mozSubmit').onclick=submitMoz;
{ const gu=$('mozGiveUp'); if(gu) gu.onclick=endMozGiveUp; }
$('mozInput').addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();submitMoz();} });

// ---------- toast ----------
let toastEl;
function bigToast(msg){ if(!toastEl){toastEl=document.createElement('div');toastEl.style.cssText='position:fixed;left:50%;top:24%;transform:translateX(-50%);z-index:75;background:rgba(10,26,20,.92);border:2px solid #ffc53a;color:#fff;font-weight:900;padding:13px 22px;border-radius:16px;font-family:Fredoka,sans-serif;font-size:20px;box-shadow:0 12px 40px #000a;transition:opacity .3s';document.body.appendChild(toastEl);} toastEl.textContent=msg;toastEl.style.opacity='1';clearTimeout(toastEl._t);toastEl._t=setTimeout(()=>toastEl.style.opacity='0',2400); }

// ---------- start / poziomy ----------
function bookWords(b){const out=[];unitKeysOf(b).forEach(k=>(b.units[k].words||[]).forEach(w=>{if(w[0]&&w[1])out.push({pl:w[0],en:w[1]});}));return out;}
function renderLevels(){
  const defs=[
    {id:'joinbugsteam1',lv:'Bugs 1',em:'🐛',cls:'b1',desc:'Szkoła, zabawki, jedzenie, rodzina, zwierzęta…'},
    {id:'bugsteam2',lv:'Bugs 2',em:'🐝',cls:'b2',desc:'Ubrania, dom, czynności, miasto…'},
    {id:'bugsteam3',lv:'Bugs 3',em:'🦋',cls:'b3',desc:'Zwierzęta, przyroda, przymiotniki…'},
  ];
  const box=$('levels'); box.innerHTML='';
  defs.forEach(d=>{
    const data=(typeof BOOKS!=='undefined')&&BOOKS[d.id];
    const el=document.createElement('div'); el.className='level '+d.cls;
    const n=data?unitKeysOf(data).length:0;
    el.innerHTML=`<div class="em">${d.em}</div><span class="lv">${d.lv}</span><h2>${d.lv}</h2><div class="desc">${d.desc}<br><b>${n} misji</b></div>`;
    el.onclick=()=>{ if(!data){alert('Brak danych podręcznika.');return;} startGame(d,data); };
    box.appendChild(el);
  });
}
function startGame(def,data){
  book={ id:def.id, label:def.lv, name:data.name, data, words:bookWords(data) };
  units=unitKeysOf(data);
  score=0; combo=0; talked.clear();
  $('start').hidden=true; document.body.classList.add('playing');
  $('objective').hidden=false; $('mini').hidden=false; $('hint').hidden=false;
  $('hint').innerHTML=document.body.classList.contains('touch')
    ? 'Lewy pad — ruch · <b>LATAJ</b> szybciej · podejdź do 📚 lub zwierzaka i naciśnij <b>AKCJA</b>'
    : '<b>WASD</b> ruch · mysz kamera · <b>Shift/Spacja</b> lataj · <b>E</b> rozmowa/misja';
  running=true; loadUnit(0);
}

// ---------- util ----------
function disposeGroup(g){ g.traverse(o=>{ if(o.geometry)o.geometry.dispose(); if(o.material){ if(o.material.map)o.material.map.dispose(); o.material.dispose&&o.material.dispose(); } }); }

// ---------- init ----------
function main(){
  if(!T){$('loading').textContent='Błąd: brak Three.js';return;}
  if(typeof BOOKS==='undefined'){$('loading').textContent='Błąd: brak data.js';return;}
  initThree(); buildBetty(); renderLevels();
  $('loading').hidden=true; $('start').hidden=false; loop();
}
main();
})();
