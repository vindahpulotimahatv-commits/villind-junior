// Offline sederhana: file tampilan disimpan; data skor selalu diambil dari internet.
var C = 'vjt-v4', FILES = ['./', 'index.html', 'offline.html', 'css/style.css', 'js/config.js', 'js/seed.js', 'js/core.js', 'js/app.js', 'manifest.json', 'icons/icon-192.png', 'icons/villind-shield.jpg', 'icons/villind-cup-banner.jpg', 'icons/villind-hero-art.jpg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(C).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== C; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); return r; })
    .catch(function () { return caches.match(e.request).then(function (r) { return r || caches.match(e.request.mode === 'navigate' ? 'offline.html' : 'index.html'); }); }));
});
