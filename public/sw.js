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

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'גן בטוח', body: event.data.text() };
  }
  const title = payload.title || 'גן בטוח';
  const options = {
    body: payload.body || '',
    icon: '/assets/company-symbol.png',
    badge: '/assets/company-symbol.png',
    dir: 'rtl',
    lang: 'he-IL',
    data: {
      url: payload.action_url || payload.url || '/dashboard',
      deep_link_type: payload.deep_link_type || 'system_notification'
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const absoluteUrl = new URL(targetUrl, self.location.origin).href;
    for (const client of clientsList) {
      if ('focus' in client && client.url === absoluteUrl) return client.focus();
    }
    return self.clients.openWindow(absoluteUrl);
  })());
});
