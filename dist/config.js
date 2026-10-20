// ============================================================
// SCROLL UNBLOCKER — proxy backend config
// Same-origin: the Wisp backend runs on this very server, so the
// stream URL is derived from wherever the site is served.
// MUST stay on window._CONFIG.
// ============================================================
(function () {
  var wsProto = location.protocol === 'https:' ? 'wss://' : 'ws://';
  var stream = wsProto + location.host + '/';

  // Allow override from the admin panel (localStorage key: proxServer)
  try {
    var custom = (localStorage.getItem('proxServer') || '').trim();
    if (custom && (custom.indexOf('wss://') === 0 || custom.indexOf('ws://') === 0) && custom.charAt(custom.length - 1) === '/') {
      stream = custom;
    }
  } catch (e) {}

  var host = location.protocol + '//' + location.host;

  window._CONFIG = {
    streamurl: stream,
    bareurl: host + '/api/edge/'
  };
})();
