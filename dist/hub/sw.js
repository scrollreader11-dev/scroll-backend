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

// ---- pop-ups (web push). If ScrollHub is already open and in front, the page shows its own toast, so stay quiet. ----
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'ScrollHub', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    var front = cs.some(function (c) { return c.visibilityState === 'visible' && c.focused; });
    if (front && d.kind !== 'test' && d.tag !== 'test') { cs.forEach(function (c) { try { c.postMessage({ t: 'push', d: d }); } catch (x) {} }); return; }
    return self.registration.showNotification(d.title || 'ScrollHub', { body: d.body || '', tag: d.tag || 'sh', renotify: true, icon: d.icon || '/hub/icon-192.png?v=3', badge: '/hub/icon-192.png?v=3', data: { url: d.url || '/hub/' } });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close(); var url = (e.notification.data && e.notification.data.url) || '/hub/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (c.url.indexOf('/hub/') >= 0 && 'focus' in c) { c.postMessage({ t: 'go', url: url }); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
