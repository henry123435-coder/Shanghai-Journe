const CACHE_NAME = 'shanghai-trip-v9';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const reqUrl = new URL(e.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 2000);
      try {
        const res = await fetch(e.request, { signal: ctl.signal });
        clearTimeout(timer);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', res.clone());
        }
        return res;
      } catch (err) {
        clearTimeout(timer);
        return (await caches.match(e.request, { ignoreSearch: true }))
          || (await caches.match('./index.html'))
          || Response.error();
      }
    })());
    return;
  }

  const networkFetch = fetch(e.request)
    .then(res => {
      if (res && res.ok) {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
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
