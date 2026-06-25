// Service Worker for Debt Collection PWA
const CACHE_NAME = 'debt-collection-v5';

// All app assets to pre-cache during install
const FILES_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/db.js',
  './js/clients.js',
  './js/collection.js',
  './js/history.js',
  './js/reports.js',
  './js/interest.js',
  './js/backup.js',
  './js/settings.js',
  './js/qrcode-lib.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json'
];

// Install event: pre-cache all application assets
// If caching fails, do not activate the incomplete cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate event: delete old caches and claim clients
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
// Try cache match first, fall back to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request);
      })
  );
});
