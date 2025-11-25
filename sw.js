const CACHE_NAME = 'agro-full-cache-v1';
const DATA_CACHE = 'agro-full-data-v1';
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/data/uprawy.json'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if(k !== CACHE_NAME && k !== DATA_CACHE) return caches.delete(k);
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  const { request } = evt;
  const url = new URL(request.url);

  if(url.pathname.startsWith('/data/') || request.url.includes('/data/')) {
    evt.respondWith(
      caches.open(DATA_CACHE).then(cache =>
        fetch(request)
          .then(resp => { cache.put(request, resp.clone()); return resp; })
          .catch(()=> cache.match(request))
      )
    );
    return;
  }

  evt.respondWith(
    caches.match(request).then(resp => resp || fetch(request).catch(()=> caches.match('/index.html')))
  );
});
