const CACHE_NAME = 'pay-up-partners-v2';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/qrcode-lib.js',
  './js/db.js',
  './js/settings.js',
  './js/license.js',
  './js/loans.js',
  './js/clients.js',
  './js/collection.js',
  './js/interest.js',
  './js/whatsapp.js',
  './js/history.js',
  './js/reports.js',
  './js/backup.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
