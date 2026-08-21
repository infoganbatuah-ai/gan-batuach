const CACHE_NAME = 'gan-batuach-static-v2';
const STATIC_ASSETS = ['/assets/company-symbol.png', '/assets/company-name.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => {
      const observer = url.pathname.startsWith('/digital-observer');
      const product = observer ? 'תצפיתן דיגיטלי' : 'גן בטוח';
      return new Response(`<!doctype html><html lang="he" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${product}</title><body style="font-family:system-ui;padding:32px;text-align:center"><h1>${product}</h1><p>אין כרגע חיבור לרשת. התחברו מחדש ונסו שוב.</p></body></html>`, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }));
    return;
  }

  const cacheable =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/assets/') ||
    ['style', 'script', 'image', 'font'].includes(request.destination);
  if (!cacheable || url.pathname === '/sw.js') return;

  event.respondWith(fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 504 });
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
