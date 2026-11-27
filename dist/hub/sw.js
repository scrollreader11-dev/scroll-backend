/* ScrollHub hub service worker. Scope: /hub/ only.
   - Pages: network first, so you always get the newest version; if the network is gone, the last page you opened, or a friendly offline page.
   - Hub files (scripts, styles, pictures): shown instantly from the saved copy and refreshed in the background.
   - Never touches /api/, games, chat or voice. Those always go straight to the network. */
var V = 'sh-hub-v1', OFFLINE = '/hub/offline.html', MAX = 160;
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll([OFFLINE, '/hub/logo.png?v=3', '/hub/icon-192.png?v=3']).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('sh-hub-') === 0 && k !== V; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
function trim(c) { c.keys().then(function (ks) { if (ks.length > MAX) ks.slice(0, ks.length - MAX).forEach(function (k) { c.delete(k); }); }); }
function ours(u) { return u.origin === self.location.origin && (u.pathname.indexOf('/hub/') === 0 || u.pathname === '/stealth.js' || u.pathname === '/site-health.js') && u.pathname.indexOf('/hub/sw.js') !== 0 && !/\.(mp4|webm|mp3)$/i.test(u.pathname); }
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET' || r.headers.has('range')) return;
  var u = new URL(r.url); if (!ours(u)) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(function (res) {
      if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put('/hub/', cp); }); }
      return res;
    }).catch(function () { return caches.match('/hub/').then(function (m) { return m || caches.match(OFFLINE); }); }));
    return;
  }
  e.respondWith(caches.open(V).then(function (c) {
    return c.match(r).then(function (hit) {
      var net = fetch(r).then(function (res) { if (res && res.ok && res.type === 'basic') { c.put(r, res.clone()); trim(c); } return res; }).catch(function () { return hit || Response.error(); });
      return hit || net;
    });
  }));
});
