const CACHE_NAME = 'gan-batuach-v1';
const APP_SHELL = ['/', '/login', '/gardens', '/join-kindergarten', '/assets/company-symbol.png', '/assets/company-name.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(request).then((response) => {
    const copy = response.clone();
    if (response.ok && url.origin === self.location.origin) caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('/') || new Response('גן בטוח במצב לא מקוון', { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return new Response('', { status: 204 });
  }));
});
