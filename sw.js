const CACHE_NAME = 'shanghai-trip-v18';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(ASSETS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  let reqUrl;
  try {
    reqUrl = new URL(e.request.url);
  } catch (err) {
    return;
  }
  if (reqUrl.origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4500);
      try {
        const res = await fetch(e.request, { signal: ctl.signal });
        clearTimeout(timer);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          const c1 = res.clone();
          const c2 = res.clone();
          await Promise.all([
            cache.put('./index.html', c1),
            cache.put('./', c2)
          ]);
        }
        return res;
      } catch (err) {
        clearTimeout(timer);
        return (await caches.match('./index.html'))
          || (await caches.match(e.request, { ignoreSearch: true }))
          || Response.error();
      }
    })());
    return;
  }

  const networkFetch = fetch(e.request)
    .then(async res => {
      if (res && res.ok) {
        const resClone = res.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(e.request, resClone);
      }
      return res;
    })
    .catch(() => null);

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(cachedRes => {
      if (cachedRes) {
        e.waitUntil(networkFetch);
        return cachedRes;
      }
      return networkFetch.then(res => res || Response.error());
    })
  );
});
