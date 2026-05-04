'use strict';
// ═══════════════════════════════════════════════════════
//  SOWIE FISZKI — Service Worker (PWA, offline support)
//  Strategia: network-first dla kodu aplikacji (HTML/JS/JSON),
//  cache-first dla fontow i CDN. Nowy SW czeka na zgode klienta
//  (postMessage SKIP_WAITING) — pokaz banera "Nowa wersja dostepna".
// ═══════════════════════════════════════════════════════
const CACHE_NAME = 'sowie-fiszki-v185';

const PRECACHE_ASSETS = [
  './',
  './home.html',
  './index.html',
  './faq.html',
  './aktualnosci.html',
  './regulamin.html',
  './polityka.html',
  './app.html',
  './teacher.html',
  './words.html',
  './data.js',
  './db.js',
  './distractors.js',
  './supabase-config.js',
  './consent.js',
  './manifest.json',
  './MyTracingFont.ttf',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Playfair+Display:wght@700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Instalacja — pre-cache zasobow. NIE robimy skipWaiting:
// chcemy, zeby klient zobaczyl banner i kliknal OK.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(PRECACHE_ASSETS).catch(err =>
        console.warn('[SW] Nie mozna zakeszowac wszystkich zasobow:', err)
      )
    )
  );
});

// Aktywacja — usun stare cache, przejmij kontrole nad otwartymi kartami.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Wiadomosc od klienta: "kliknalem OK w banerze, aktywuj sie natychmiast"
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Czy to zasob kodu aplikacji (musi byc zawsze swiezy gdy online)?
function isAppResource(url) {
  try {
    const u = new URL(url);
    if (u.pathname.endsWith('/')) return true;
    return /\.(html|js|json)$/i.test(u.pathname);
  } catch { return false; }
}

// Czy to zewnetrzny statyczny zasob (fonty, CDN — rzadko sie zmienia)?
function isStaticExternal(url) {
  return url.startsWith('https://fonts.googleapis.com/') ||
         url.startsWith('https://fonts.gstatic.com/') ||
         url.startsWith('https://cdn.jsdelivr.net/');
}

// Czy to zapytanie do API Supabase? (REST, Auth, Realtime, Storage)
// Te zapytania MUSZA isc zawsze bezposrednio przez siec — inaczej stare
// dane (np. user_books po zatwierdzeniu prosby przez admina) zostana
// zaserwowane z cache i uzytkownik nie zobaczy aktualizacji.
function isSupabaseApi(url) {
  return url.includes('.supabase.co/') || url.includes('.supabase.in/');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  // BYPASS: zapytania do Supabase — zawsze bezposrednio przez siec, bez cache.
  // SW nie wtraca sie w te zapytania (return pozwala przegladarce obsluzyc je normalnie).
  if (isSupabaseApi(req.url)) return;

  // Cache-first dla fontow i CDN
  if (isStaticExternal(req.url)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }))
    );
    return;
  }

  // Network-first dla kodu aplikacji i nawigacji
  if (isAppResource(req.url) || req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then(cached => {
        if (cached) return cached;
        if (req.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      }))
    );
    return;
  }

  // Reszta: cache-first, fallback network
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
      }
      return res;
    }))
  );
});
