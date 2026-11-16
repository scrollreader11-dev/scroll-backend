/* School Mode guard: when School Mode is on, any ScrollHub page sends you to the games hub right away. */
(function () {
  if (window.__schoolGuard) return; window.__schoolGuard = 1;
  var p = location.pathname;
  if (/^\/(arcade|admin|play|bedwars|calltest)/.test(p)) return;
  function api() { try { var e = localStorage.getItem('sh_api'); if (e) return e.replace(/\/+$/, ''); } catch (x) {} return location.origin; }
  function tok() { try { return localStorage.getItem('sh_token') || ''; } catch (x) { return ''; } }
  var base = api(), top = window.top === window;
  function go() {
    var dest = base + '/arcade';
    try { if (!top) { window.top.location.replace(dest); return; } } catch (e) {}
    location.replace(dest);
  }
  function check() {
    var h = {}; var t = tok(); if (t) h.Authorization = 'Bearer ' + t;
    fetch(base + '/api/school', { credentials: base === location.origin ? 'include' : 'omit', headers: h, cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (s) {
      if (s && s.on && !s.exempt && !(s.gamble && /^\/casino/.test(p))) { document.documentElement.style.visibility = 'hidden'; go(); }
    }).catch(function () {});
  }
  check(); setInterval(check, 3000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
})();
