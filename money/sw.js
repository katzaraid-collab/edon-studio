// מאזן — service worker. Scope: /money/
//
// • Versioned cache; bump VERSION when the shell changes to force a refresh.
// • Navigations (index.html): network-first, falling back to the cached shell
//   so the app opens offline.
// • Everything else we own (app files, self-hosted fonts): cache-first, with a
//   quiet background refresh so the next visit picks up updates.
// • Install never fails because one precache file is missing: each file is
//   fetched and put individually, errors are swallowed.

const VERSION = 'maazan-v1';
const SCOPE = new URL('./', self.location).pathname; // "/money/"

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'css/app.css',
  'css/charts.css',
  'js/app.js',
  'js/store.js',
  'js/model.js',
  'js/format.js',
  'js/io.js',
  'js/ui.js',
  'js/charts.js',
  'js/views/dashboard.js',
  'js/views/insights.js',
  'js/views/transactions.js',
  'js/views/entry.js',
  'js/views/settings.js',
  '/x/fonts/heebo-hebrew.woff2',
  '/x/fonts/heebo-latin.woff2',
].map((p) => new URL(p, self.location).href);

const INDEX_URL = new URL('index.html', self.location).href;
const ROOT_URL = new URL('./', self.location).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
            if (res.ok) await cache.put(url, res);
          } catch {
            /* offline or 404 during install: skip this file */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('maazan-') && k !== VERSION).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          /* ignore */
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

function isOurs(url) {
  return url.origin === self.location.origin && (url.pathname.startsWith(SCOPE) || url.pathname.startsWith('/x/fonts/'));
}

async function networkFirstNavigation(event) {
  const cache = await caches.open(VERSION);
  try {
    const preload = await event.preloadResponse;
    const res = preload || (await fetch(event.request));
    if (res && res.ok && res.type === 'basic') cache.put(INDEX_URL, res.clone()).catch(() => {});
    return res;
  } catch {
    return (
      (await cache.match(INDEX_URL)) ||
      (await cache.match(ROOT_URL)) ||
      new Response('<!doctype html><meta charset="utf-8"><title>מאזן</title><p dir="rtl">אין חיבור לרשת.</p>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    );
  }
}

async function cacheFirst(event) {
  const req = event.request;
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req, { ignoreSearch: true });
  const refresh = fetch(req)
    .then((res) => {
      if (res && res.ok && (res.type === 'basic' || res.type === 'default')) cache.put(req, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const res = await refresh;
  return res || new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!isOurs(url)) return;
  if (req.mode === 'navigate') {
    if (url.pathname.startsWith(SCOPE)) event.respondWith(networkFirstNavigation(event));
    return;
  }
  event.respondWith(cacheFirst(event));
});
