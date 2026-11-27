/* ScrollHub: tells the server when a page breaks in someone's browser, so bugs get found before anyone has to report them.
   Sends only the error text, the file and line, and the page name. No account, no cookies, no typed text. Five reports per page load at most. */
(function () {
  if (window.__shHealth) return; window.__shHealth = 1;
  var sent = 0, seen = {};
  function page() { var r = (location.hash.split('/')[1] || '').split('?')[0].slice(0, 24); return location.pathname.slice(0, 60) + (r ? '#' + r : ''); }
  function send(o) {
    try {
      var msg = String(o.msg || '').slice(0, 240); if (!msg || sent >= 5) return;
      if (/^script error\.?$/i.test(msg) || /ResizeObserver loop|Non-Error promise rejection|Load failed$|Failed to fetch$|NetworkError|AbortError/i.test(msg)) return;
      if (/^(chrome|moz|safari|edge)(-web)?-extension:/.test(o.src || '') || /extension:\/\//.test(o.stack || '')) return;
      var key = msg + '|' + (o.src || '') + '|' + (o.line || 0); if (seen[key]) return; seen[key] = 1; sent++;
      var body = JSON.stringify({ msg: msg, src: String(o.src || '').slice(0, 160), line: o.line || 0, col: o.col || 0, stack: String(o.stack || '').slice(0, 900), page: page() });
      if (navigator.sendBeacon && navigator.sendBeacon('/api/client-error', new Blob([body], { type: 'application/json' }))) return;
      fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  window.addEventListener('error', function (e) { if (e.target && e.target !== window) return; send({ msg: e.message, src: e.filename, line: e.lineno, col: e.colno, stack: e.error && e.error.stack }); });
  window.addEventListener('unhandledrejection', function (e) { var r = e.reason; send({ msg: 'Unhandled promise: ' + ((r && r.message) || String(r)), stack: r && r.stack }); });
})();
