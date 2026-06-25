// Service Worker for ABC Provisional Store PWA
const CACHE_NAME = 'abc-store-v13';

// Application assets to pre-cache during install
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/qrcode-lib.js',
  './js/qrcode.js',
  './js/jsbarcode.min.js',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/settings.js',
  './js/item-master.js',
  './js/billing.js',
  './js/voice-engine.js',
  './js/bill-history.js',
  './js/reports.js',
  './js/barcode.js',
  './js/import-export.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install event: pre-cache all application assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches that don't match current version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event: cache-first strategy
// Try cache first, fall back to network, cache the network response
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            // Only cache valid responses from our origin
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response since it can only be consumed once
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(() => {
            // Network failed and resource not in cache - return offline fallback
            // For navigation requests, return the cached index.html (SPA shell)
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            // For other requests, return a basic offline response
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
      })
  );
});
