// Grammar City service worker: offline play after the first visit.
const VERSION = 'grammar-city-v42';
const SHELL = [
  './',
  './index.html',
  './game.js',
  './cars.js',
  './questions.js',
  './vocab-missions.js',
  './npc-talks.js',
  './models/e-scooter.glb',
  '../game-stats.js',
  '../ai-chat.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // Cache API jest wspólne dla całej domeny — kasuj tylko stare cache Grammar City,
      // nie cache głównej aplikacji Sowie Fiszki (sowie-fiszki-*).
      .then(keys => Promise.all(keys.filter(k => k.startsWith('grammar-city-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Game files: network first (so updates arrive), cache as fallback.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Silnik 3D (three.js r160 i jego moduły z jsDelivr), CDN i Google Fonts: cache first.
  if (/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.host) || (url.host === 'cdn.jsdelivr.net' && url.pathname.startsWith('/npm/three@0.160.0/'))) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res;
      }))
    );
  }
});
