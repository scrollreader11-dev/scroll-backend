/* ScrollHub DC notifications: in-app toasts + system notifications (works while
   ScrollHub is open in any tab, even in the background). */
(function () {
  if (window.__dcNotify) return; window.__dcNotify = 1;
  function api() { try { var e = localStorage.getItem('sh_api'); if (e) return e.replace(/\/+$/, ''); } catch (x) {} return location.origin; }
  function tok() { try { return localStorage.getItem('sh_token') || ''; } catch (x) { return ''; } }
  function enabled() { try { return localStorage.getItem('dc_notify_off') !== '1'; } catch (x) { return true; } }
  var box = null;
  function toast(title, body, onClick) {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column;gap:8px;max-width:340px;font-family:system-ui,sans-serif';
      document.body.appendChild(box);
    }
    var d = document.createElement('div');
    d.style.cssText = 'background:#1e1f3b;color:#fff;border:2px solid #5865f2;border-radius:14px;padding:10px 14px;box-shadow:0 8px 28px rgba(0,0,0,.45);cursor:pointer;transform:translateY(20px);opacity:0;transition:all .25s';
    d.innerHTML = '<div style="font-weight:800;font-size:14px;margin-bottom:2px"></div><div style="font-size:13px;opacity:.85;word-break:break-word"></div>';
    d.firstChild.textContent = title; d.lastChild.textContent = body;
    d.onclick = function () { d.remove(); if (onClick) onClick(); };
    box.appendChild(d);
    requestAnimationFrame(function () { d.style.transform = 'none'; d.style.opacity = '1'; });
    setTimeout(function () { d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 300); }, 6000);
  }
  function beep() {
    try { var A = window.AudioContext || window.webkitAudioContext; var a = window.__dcAc || (window.__dcAc = new A()); var o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.value = 0.06; o.connect(g); g.connect(a.destination); o.start(); o.frequency.setValueAtTime(660, a.currentTime + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.25); o.stop(a.currentTime + 0.26); } catch (e) {}
  }
  function system(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try { var n = new Notification(title, { body: body, tag: tag, icon: '/logo.png', badge: '/logo.png' }); n.onclick = function () { window.focus(); n.close(); }; return true; } catch (e) { return false; }
  }
  function show(title, body, tag) {
    if (!enabled()) return;
    beep();
    if (document.hidden || !document.hasFocus()) { if (system(title, body, tag)) return; }
    toast(title, body);
  }
  // Ask for permission once, on the first click anywhere (browsers need a user gesture).
  function askOnce() {
    document.removeEventListener('click', askOnce, true);
    try { if ('Notification' in window && Notification.permission === 'default' && localStorage.getItem('dc_notify_asked') !== '1') { localStorage.setItem('dc_notify_asked', '1'); Notification.requestPermission(); } } catch (e) {}
  }
  document.addEventListener('click', askOnce, true);
  window.dcNotifications = { on: function () { try { localStorage.removeItem('dc_notify_off'); } catch (e) {} if ('Notification' in window) Notification.requestPermission(); }, off: function () { try { localStorage.setItem('dc_notify_off', '1'); } catch (e) {} } };

  var ws = null, backoff = 2000, ping = null;
  function connect() {
    var t = tok();
    var base = api().replace(/^http/, 'ws');
    try { ws = new WebSocket(base + '/dc-ws' + (t ? '?t=' + encodeURIComponent(t) : '')); } catch (e) { return setTimeout(connect, backoff); }
    ws.onopen = function () { backoff = 2000; clearInterval(ping); ping = setInterval(function () { try { ws.send('{"t":"ping"}'); } catch (e) {} }, 25000); };
    ws.onmessage = function (ev) {
      var d; try { d = JSON.parse(ev.data); } catch (e) { return; }
      if (d.t === 'notify') show((d.dm ? '💬 ' + d.from : '💬 ' + d.from + ' · ' + d.where), d.text, 'dc-' + d.channel);
      else if (d.t === 'call-ring') show('📞 ' + d.fromName + ' is calling you' + (d.video ? ' (video)' : ''), 'Open ScrollHub DC to answer', 'dc-call');
    };
    ws.onclose = function () { clearInterval(ping); setTimeout(connect, backoff); backoff = Math.min(30000, backoff * 1.6); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', connect); else connect();
})();
