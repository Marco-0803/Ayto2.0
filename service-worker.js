/* AYTO Solver Service Worker
   Neue Basis. Nicht mit dem alten v14-Worker vermischen. */

const CACHE_NAME = 'ayto-solver-runtime-v1';

const CORE_ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'HeaderIcon.png',
  'icon-192.png',
  'icon-512.png'
];

function absoluteUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

function canonicalKey(input) {
  const url = typeof input === 'string'
    ? new URL(input, self.registration.scope)
    : new URL(input.url);

  url.search = '';
  url.hash = '';

  return new Request(
    url.toString(),
    { method: 'GET' }
  );
}

async function cacheFreshResponse(cache, request, response) {
  if (!response || !response.ok) return;

  await cache.put(
    canonicalKey(request),
    response.clone()
  );
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const asset of CORE_ASSETS) {
      try {
        const request = new Request(
          absoluteUrl(asset),
          { cache: 'reload' }
        );

        const response = await fetch(request);

        if (response.ok) {
          await cache.put(
            canonicalKey(request),
            response.clone()
          );
        }
      } catch (err) {
        console.warn(
          '[SW] Konnte nicht vorladen:',
          asset,
          err
        );
      }
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(
          key =>
            key.startsWith('ayto-solver-') &&
            key !== CACHE_NAME
        )
        .map(key => caches.delete(key))
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const response = await fetch(
          request,
          { cache: 'no-store' }
        );

        await cacheFreshResponse(
          cache,
          'index.html',
          response
        );

        return response;

      } catch (err) {
        return (
          await cache.match(canonicalKey(request)) ||
          await cache.match(canonicalKey('index.html')) ||
          await cache.match(canonicalKey('./'))
        );
      }
    })());

    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const response = await fetch(
        request,
        { cache: 'no-store' }
      );

      await cacheFreshResponse(
        cache,
        request,
        response
      );

      return response;

    } catch (err) {
      const cached =
        await cache.match(
          canonicalKey(request)
        );

      if (cached) {
        return cached;
      }

      throw err;
    }
  })());
});
