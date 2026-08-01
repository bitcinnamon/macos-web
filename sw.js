// Zero-build cache coordinator. The version is supplied by main.js when the
// worker is registered, so index.html, config.js, and this file cannot drift.
const url = new URL(self.location.href);
const VERSION = url.searchParams.get('v') || 'dev';
const CACHE = `leopard-web-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  `./css/aqua.css?v=${VERSION}`,
  `./css/apps.css?v=${VERSION}`,
  `./css/leopard.css?v=${VERSION}`,
  `./js/main.js?v=${VERSION}`,
  './assets/aurora.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith('leopard-web-') && key !== CACHE)
      .map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch:false });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('./index.html');
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const target = new URL(request.url);
  if (target.origin !== self.location.origin) return;
  // Network-first avoids a newly deployed HTML document being paired with an
  // old ES-module graph controlled by the previous worker.
  event.respondWith(networkFirst(request));
});
