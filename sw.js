'use strict';
// ═══════════════════════════════════════════════════════
//  SOWIE FISZKI — Service Worker (PWA, offline support)
// ═══════════════════════════════════════════════════════
const CACHE_NAME = 'sowie-fiszki-v2';
const ASSETS = [
  './',
  './index.html',
  './app.html',
  './data.js',
  './db.js',
  './supabase-config.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalacja — cache wszystkich plików
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('[SW] Nie można zakeszować wszystkich zasobów:', err);
      });
    })
  );
  self.skipWaiting();
});

// Aktywacja — usuń stare cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Cache-first, fallback sieć
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Ignoruj żądania spoza http/https (np. chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
