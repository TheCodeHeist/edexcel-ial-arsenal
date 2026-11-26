/* Service Worker for Edexcel IAL Arsenal: offline support with separate bounded static and runtime caches.
   - Hashed /_astro/* bundles & /brand/* icons: cache-first in STATIC_CACHE.
   - HTML navigations & JSON data: network-first in bounded RUNTIME_CACHE, falling back to /offline.html when offline. */

const STATIC_CACHE = 'ial-static-v2';
const RUNTIME_CACHE = 'ial-runtime-v2';
const MAX_RUNTIME_ITEMS = 120;
const PRECACHE = ['/', '/offline.html', '/chemistry/', '/physics/', '/maths/', '/papers/', '/favicon.svg', '/manifest.webmanifest'];

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maxItems;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Immutable Vite/Astro hashed assets & static brand artwork: cache-first in static cache
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/brand/') || url.pathname === '/favicon.svg') {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
      )
    );
    return;
  }

  // Pages & JSON data: network-first in bounded runtime cache, falling back to /offline.html
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then(async (c) => {
            await c.put(req, copy);
            await trimCache(RUNTIME_CACHE, MAX_RUNTIME_ITEMS);
          });
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') {
          return (await caches.match('/offline.html')) || caches.match('/');
        }
        return undefined;
      })
  );
});
