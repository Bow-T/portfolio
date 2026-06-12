// Bow portfolio — offline cache + "no internet" game fallback
const CACHE = 'bow-portfolio-v5';
const PRECACHE = ['./', './game', './resume', './secret'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Only handle http(s); ignore chrome-extension:, data:, etc. (Cache.put rejects them).
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  // Page navigations: network-first, fall back to cache, then to the game when truly offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('./')).then(m => m || caches.match('./game')))
    );
    return;
  }
  // Other assets: cache-first, update in background.
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      if (r.ok && r.type === 'basic' && url.origin === location.origin) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => m))
  );
});