
const CACHE_VERSION = 'v14';
const CACHE_NAME = `ayto-solver-${CACHE_VERSION}`;
const APP_SHELL = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'ayto-logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const wantsHTML = req.headers.get('accept')?.includes('text/html');
  if (wantsHTML) {
    event.respondWith(
      fetch(req).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c=>c.put(req, copy));
        return resp;
      }).catch(()=> caches.match(req).then(r=> r || caches.match('index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(r => r || fetch(req).then(net=>{
      const copy = net.clone();
      caches.open(CACHE_NAME).then(c=>c.put(req, copy));
      return net;
    }))
  );
});
