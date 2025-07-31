// sw.js: very basic, just keeps the app offline-capable
self.addEventListener('install', evt => {
  evt.waitUntil(caches.open('v1').then(cache =>
    cache.addAll([
      '/', '/index.html',
      '/css/auth.css',
      '/js/login.js',
      // …and any other core files
    ])
  ));
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(resp =>
      resp || fetch(evt.request)
    )
  );
});
