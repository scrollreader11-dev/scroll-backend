/* ScrollHub presence + admin enforcement (runs on every visitor's page). */
(function () {
  if (location.pathname.indexOf('/admin') === 0) return; // admin page is exempt

  var CID_KEY = 'scrollhub_cid', NICK_KEY = 'scrollhub_nick', BC_KEY = 'scrollhub_bc_seen';
  var cid = '';
  try { cid = localStorage.getItem(CID_KEY) || ''; } catch (e) {}
  if (!cid) {
    cid = (self.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    try { localStorage.setItem(CID_KEY, cid); } catch (e) {}
  }
  var nickname = '';
  try { nickname = localStorage.getItem(NICK_KEY) || ''; } catch (e) {}

  function el(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }
  var OVERLAY = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
    'background:#020810;color:#fff;font-family:"Segoe UI",system-ui,sans-serif;text-align:center;padding:24px;';

  function fullOverlay(title, msg, accent) {
    var o = el('div', OVERLAY);
    o.innerHTML = '<div style="max-width:440px"><div style="font-size:2rem;font-weight:800;margin-bottom:12px;color:' +
      (accent || '#6ea8fe') + '">' + title + '</div><div style="font-size:1rem;line-height:1.5;color:#c3cad8">' +
      msg + '</div></div>';
    return o;
  }

  // ---- nickname gate ----
  function askNickname(done) {
    var o = el('div', OVERLAY);
    var box = el('div', 'max-width:380px;width:100%;background:#0b1626;border:1px solid #1f3454;border-radius:16px;padding:28px 24px;');
    box.innerHTML =
      '<div style="font-size:1.4rem;font-weight:800;margin-bottom:6px">Welcome to ScrollHub</div>' +
      '<div style="font-size:.9rem;color:#9fb0c8;margin-bottom:18px">Pick a nickname to continue.</div>';
    var input = el('input');
    input.type = 'text'; input.maxLength = 24; input.placeholder = 'Your nickname';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #27406a;background:#0a1322;color:#fff;font-size:1rem;outline:none;margin-bottom:14px';
    var btn = el('button', 'width:100%;padding:12px;border:none;border-radius:10px;background:#2f68d8;color:#fff;font-size:.95rem;font-weight:600;cursor:pointer', 'Continue');
    function submit() {
      var v = (input.value || '').trim().slice(0, 24);
      if (!v) { input.style.borderColor = '#e06a74'; input.focus(); return; }
      nickname = v;
      try { localStorage.setItem(NICK_KEY, v); } catch (e) {}
      document.body.removeChild(o);
      done();
    }
    btn.onclick = submit;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    box.appendChild(input); box.appendChild(btn); o.appendChild(box);
    document.body.appendChild(o); setTimeout(function () { input.focus(); }, 50);
  }

  // ---- banners / popups ----
  var annBanner = null;
  function showAnnouncement(text) {
    if (!text) { if (annBanner) { annBanner.remove(); annBanner = null; } return; }
    if (annBanner && annBanner.dataset.text === text) return;
    if (annBanner) annBanner.remove();
    annBanner = el('div', 'position:fixed;top:0;left:0;right:0;z-index:2147483000;background:#2f68d8;color:#fff;' +
      'font-family:system-ui,sans-serif;font-size:.9rem;padding:10px 40px 10px 16px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.3)');
    annBanner.dataset.text = text;
    annBanner.textContent = text;
    var x = el('span', 'position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;font-weight:700', '×');
    x.onclick = function () { if (annBanner) { annBanner.remove(); annBanner = null; } };
    annBanner.appendChild(x);
    document.body.appendChild(annBanner);
  }
  function showPopup(text) {
    var o = el('div', OVERLAY.replace('#020810', 'rgba(2,8,16,.78)'));
    var box = el('div', 'max-width:400px;background:#0b1626;border:1px solid #1f3454;border-radius:16px;padding:26px 24px');
    box.innerHTML = '<div style="font-size:1.1rem;font-weight:700;margin-bottom:14px">' + text + '</div>';
    var btn = el('button', 'padding:10px 22px;border:none;border-radius:10px;background:#2f68d8;color:#fff;font-weight:600;cursor:pointer', 'OK');
    btn.onclick = function () { document.body.removeChild(o); };
    box.appendChild(btn); o.appendChild(box); document.body.appendChild(o);
  }

  var stopped = false, maintOverlay = null;
  function apply(state) {
    if (stopped) return;
    if (state.banned) {
      stopped = true;
      document.body.appendChild(fullOverlay('Access blocked', 'You have been banned by an administrator.', '#e06a74'));
      return;
    }
    if (state.kick) {
      stopped = true;
      document.body.appendChild(fullOverlay('Kicked', state.kick.message || 'You have been removed.', '#e0a86a'));
      setTimeout(function () { try { location.href = 'about:blank'; } catch (e) {} }, 4000);
      return;
    }
    if (state.redirect) {
      try {
        var here = location.href;
        if (here.indexOf(state.redirect) !== 0) { location.href = state.redirect; return; }
      } catch (e) {}
    }
    if (state.maintenance) {
      if (!maintOverlay) {
        maintOverlay = fullOverlay('Under maintenance', 'ScrollHub is temporarily closed. Check back soon.', '#6ea8fe');
        document.body.appendChild(maintOverlay);
      }
    } else if (maintOverlay) { maintOverlay.remove(); maintOverlay = null; }
    showAnnouncement(state.announcement);
    if (state.broadcast && state.broadcast.ts) {
      var seen = '';
      try { seen = localStorage.getItem(BC_KEY) || ''; } catch (e) {}
      if (String(state.broadcast.ts) !== seen) {
        try { localStorage.setItem(BC_KEY, String(state.broadcast.ts)); } catch (e) {}
        showPopup(state.broadcast.text);
      }
    }
  }

  function beat() {
    if (stopped) return;
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cid, nickname: nickname || 'Guest' }),
      keepalive: true,
    }).then(function (r) { return r.json(); }).then(apply).catch(function () {});
  }

  function start() { beat(); setInterval(beat, 12000); }
  function boot() { if (nickname) start(); else askNickname(start); }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
