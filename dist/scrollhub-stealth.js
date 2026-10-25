/* ScrollHub stealth tools — tab cloak, panic key/button, about:blank launcher.
   100% original code. Runs on every visitor's page (except /admin). */
(function () {
  if (location.pathname.indexOf('/admin') === 0) return;

  var LS = {
    cloak: 'sh_stealth_cloak',
    panicUrl: 'sh_stealth_panic_url',
    panicKey: 'sh_stealth_panic_key',
    panicBtn: 'sh_stealth_panic_btn',
  };
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Disguises: tab title + favicon. Google/Wikipedia icons load on most school
  // networks (those domains are usually allowed). Title change always works.
  var CLOAKS = {
    none:      { label: 'None (ScrollHub)', title: null, icon: null },
    classroom: { label: 'Google Classroom', title: 'Classes', icon: 'https://ssl.gstatic.com/classroom/favicon.png' },
    docs:      { label: 'Google Docs', title: 'Untitled document - Google Docs', icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico' },
    slides:    { label: 'Google Slides', title: 'Untitled presentation - Google Slides', icon: 'https://ssl.gstatic.com/docs/presentations/images/favicon5.ico' },
    drive:     { label: 'Google Drive', title: 'My Drive - Google Drive', icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png' },
    gmail:     { label: 'Gmail', title: 'Inbox - Gmail', icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico' },
    clever:    { label: 'Clever Portal', title: 'Clever | Portal', icon: 'https://clever.com/favicon.ico' },
    wikipedia: { label: 'Wikipedia', title: 'Wikipedia, the free encyclopedia', icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico' },
  };

  function setFavicon(href) {
    try {
      var links = document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]');
      for (var i = 0; i < links.length; i++) links[i].parentNode.removeChild(links[i]);
      if (!href) return;
      var l = document.createElement('link'); l.rel = 'icon'; l.href = href;
      (document.head || document.documentElement).appendChild(l);
    } catch (e) {}
  }
  function applyCloak() {
    var c = CLOAKS[get(LS.cloak, 'none')] || CLOAKS.none;
    if (c.title) { if (document.title !== c.title) document.title = c.title; setFavicon(c.icon); }
  }
  // The app changes document.title on navigation, so keep re-applying the cloak.
  applyCloak();
  if (document.addEventListener) document.addEventListener('DOMContentLoaded', applyCloak);
  setInterval(function () { if (get(LS.cloak, 'none') !== 'none') applyCloak(); }, 1200);

  // --- Panic: jump to a safe site instantly ---
  function panic() {
    var url = get(LS.panicUrl, 'https://classroom.google.com');
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { window.location.replace(url); } catch (e) { window.location.href = url; }
  }
  document.addEventListener('keydown', function (e) {
    var key = get(LS.panicKey, '`');
    if (e.key === key && !e.metaKey && !e.ctrlKey && !e.altKey) {
      var t = e.target || {};
      var tag = (t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t.isContentEditable) return; // don't hijack typing
      panic();
    }
  });

  // --- Floating panic button (optional, for touch devices with no keyboard) ---
  var panicBtnEl = null;
  function renderPanicBtn() {
    var on = get(LS.panicBtn, '0') === '1';
    if (on && !panicBtnEl) {
      panicBtnEl = document.createElement('button');
      panicBtnEl.textContent = 'Exit';
      panicBtnEl.setAttribute('aria-label', 'Panic exit');
      panicBtnEl.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483646;' +
        'background:rgba(220,60,60,.92);color:#fff;border:0;border-radius:8px;padding:7px 12px;' +
        'font:600 13px system-ui,sans-serif;cursor:pointer;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.3)';
      panicBtnEl.onclick = panic;
      document.body.appendChild(panicBtnEl);
    } else if (!on && panicBtnEl) {
      panicBtnEl.parentNode.removeChild(panicBtnEl); panicBtnEl = null;
    }
  }

  // --- Settings panel + discreet launcher ---
  var GEAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  var panel = null;

  function buildPanel() {
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;bottom:56px;left:12px;z-index:2147483646;width:272px;max-width:88vw;' +
      'background:#111627;color:#eef2ff;border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:14px;' +
      'font:14px system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.5);display:none';
    var cloakOpts = '';
    for (var k in CLOAKS) cloakOpts += '<option value="' + k + '">' + CLOAKS[k].label + '</option>';
    panel.innerHTML =
      '<div style="font-weight:700;font-size:15px;margin-bottom:10px">Stealth</div>' +
      '<label style="display:block;font-size:12px;color:#9fb0d8;margin:0 0 4px">Disguise tab as</label>' +
      '<select id="sh-cloak" style="width:100%;margin-bottom:12px;padding:8px;border-radius:8px;background:#0b1020;color:#eef2ff;border:1px solid rgba(255,255,255,.18)">' + cloakOpts + '</select>' +
      '<label style="display:block;font-size:12px;color:#9fb0d8;margin:0 0 4px">Panic goes to</label>' +
      '<input id="sh-purl" style="width:100%;box-sizing:border-box;margin-bottom:12px;padding:8px;border-radius:8px;background:#0b1020;color:#eef2ff;border:1px solid rgba(255,255,255,.18)" />' +
      '<label style="display:block;font-size:12px;color:#9fb0d8;margin:0 0 4px">Panic key (press, or type one)</label>' +
      '<input id="sh-pkey" maxlength="12" style="width:100%;box-sizing:border-box;margin-bottom:12px;padding:8px;border-radius:8px;background:#0b1020;color:#eef2ff;border:1px solid rgba(255,255,255,.18)" />' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:12px;cursor:pointer"><input type="checkbox" id="sh-pbtn" /> Show Exit button (for touch)</label>' +
      '<button id="sh-close" style="width:100%;padding:9px;border:0;border-radius:8px;background:transparent;color:#9fb0d8;cursor:pointer">Close</button>';
    document.body.appendChild(panel);

    var cloak = panel.querySelector('#sh-cloak'), purl = panel.querySelector('#sh-purl'),
        pkey = panel.querySelector('#sh-pkey'), pbtn = panel.querySelector('#sh-pbtn');
    cloak.value = get(LS.cloak, 'none');
    purl.value = get(LS.panicUrl, 'https://classroom.google.com');
    pkey.value = get(LS.panicKey, '`');
    pbtn.checked = get(LS.panicBtn, '0') === '1';
    cloak.onchange = function () { set(LS.cloak, cloak.value); if (cloak.value === 'none') { location.reload(); } else applyCloak(); };
    purl.onchange = function () { set(LS.panicUrl, purl.value.trim()); };
    pkey.onkeydown = function (e) { e.preventDefault(); if (e.key.length === 1 || e.key === 'Escape') { pkey.value = e.key; set(LS.panicKey, e.key); } };
    pbtn.onchange = function () { set(LS.panicBtn, pbtn.checked ? '1' : '0'); renderPanicBtn(); };
    panel.querySelector('#sh-close').onclick = function () { panel.style.display = 'none'; };
  }

  function launcher() {
    var b = document.createElement('button');
    b.innerHTML = GEAR;
    b.setAttribute('aria-label', 'Stealth settings');
    b.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483645;width:38px;height:38px;' +
      'display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;cursor:pointer;' +
      'background:rgba(20,26,44,.6);color:#9fb0d8;opacity:.5;transition:opacity .15s';
    b.onmouseenter = function () { b.style.opacity = '1'; };
    b.onmouseleave = function () { b.style.opacity = '.5'; };
    b.onclick = function () { if (!panel) buildPanel(); panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; };
    document.body.appendChild(b);
  }

  function init() { launcher(); renderPanicBtn(); }
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
