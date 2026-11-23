/* ScrollHub: panic key and about:blank cloak. Shared by the hub, Bedwars/Racing and the casino.
   Settings live in the hub's preferences (localStorage sh_hub_prefs), so one choice covers every page. */
(function () {
  'use strict';
  if (window.ShStealth) return;
  var DEF_URL = 'https://www.google.com/';
  function prefs() { try { return JSON.parse(localStorage.getItem('sh_hub_prefs') || '{}') || {}; } catch (e) { return {}; } }
  function safeUrl(u) { u = String(u || '').trim(); if (!u) return DEF_URL; if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u; return /^https?:\/\/[^\s"'<>]{3,300}$/i.test(u) ? u : DEF_URL; }
  function keyOf(p) { var k = p.panicKey; return k && typeof k.k === 'string' && k.k ? k : { k: '`', c: 0, a: 0, s: 0, m: 0 }; }
  function label(k) { var n = k.k === ' ' ? 'Space' : k.k.length === 1 ? k.k.toUpperCase() : k.k; return (k.c ? 'Ctrl + ' : '') + (k.a ? 'Alt + ' : '') + (k.s ? 'Shift + ' : '') + (k.m ? 'Cmd + ' : '') + n; }

  // Leave right now: replaces this tab's page so Back does not return to the game.
  function panic() {
    var url = safeUrl(prefs().panicUrl);
    try { window.top.location.replace(url); } catch (e) { try { location.replace(url); } catch (e2) { location.href = url; } }
  }

  function typing(t) { return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)); }
  function onKey(e) {
    var p = prefs(); if (p.panicOn === false || e.repeat) return;
    var k = keyOf(p), key = String(e.key || '');
    if (key.toLowerCase() !== k.k.toLowerCase()) return;
    if (!!e.ctrlKey !== !!k.c || !!e.altKey !== !!k.a || !!e.shiftKey !== !!k.s || !!e.metaKey !== !!k.m) return;
    if (!k.c && !k.a && !k.m && typing(e.target)) return;   // a plain key must not fire while typing in a box
    e.preventDefault(); e.stopPropagation(); panic();
  }
  var hooked = [];
  function hook(w) {
    try { if (!w || hooked.indexOf(w) >= 0) return; w.addEventListener('keydown', onKey, true); hooked.push(w); } catch (e) {}
  }
  function scan(win, depth) {
    hook(win); if (depth > 3) return;
    var fr; try { fr = win.document.querySelectorAll('iframe'); } catch (e) { return; }
    for (var i = 0; i < fr.length; i++) { var cw = null; try { cw = fr[i].contentWindow; cw.document; } catch (e) { cw = null; } if (cw) scan(cw, depth + 1); }
  }
  scan(window, 0);
  setInterval(function () { scan(window, 0); }, 1500);   // games open and close their frames; keep hooking new ones

  function note(text) {
    try {
      var d = document.createElement('div'); d.textContent = text;
      d.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:2147483000;background:#111a2e;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:12px 18px;font:600 14px system-ui,sans-serif;max-width:86vw;text-align:center';
      document.body.appendChild(d); setTimeout(function () { d.remove(); }, 5000);
    } catch (e) {}
  }

  // about:blank cloak: opens a blank tab that holds the site in a full-page frame, then sends this tab to the safe page.
  function inFrame() { try { return window.top !== window; } catch (e) { return true; } }
  function cloak(opts) {
    opts = opts || {}; var p = prefs();
    if (inFrame()) { note('You are already in the hidden view.'); return false; }
    var w = null; try { w = window.open('about:blank', '_blank'); } catch (e) {}
    if (!w) { if (!opts.quiet) note('Pop-ups are blocked. Allow pop-ups for this site, then try again.'); return false; }
    var title = String(p.cloakTitle || '').replace(/[<>&"]/g, '').slice(0, 60) || 'Untitled';
    var src = location.href.replace(/"/g, '%22');
    try {
      w.document.open();
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>html,body{margin:0;height:100%;background:#04070e;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style></head><body><iframe src="' + src + '" allow="autoplay; fullscreen; gamepad; clipboard-write; microphone; accelerometer; gyroscope" allowfullscreen></iframe></body></html>');
      w.document.close();
    } catch (e) { try { w.close(); } catch (e2) {} if (!opts.quiet) note('Could not open the hidden view in this browser.'); return false; }
    try { location.replace(safeUrl(p.panicUrl)); } catch (e) { location.href = safeUrl(p.panicUrl); }
    return true;
  }

  // Optional: cloak on the first click of every visit to the hub (browsers only allow a pop-up from a click).
  function auto() {
    var p = prefs(); if (!p.cloakAuto || inFrame() || !/^\/hub(\/|$)/.test(location.pathname)) return;
    try { if (sessionStorage.getItem('sh_nocloak')) return; } catch (e) {}
    var once = function () { document.removeEventListener('pointerdown', once, true); document.removeEventListener('keydown', once, true); if (!cloak({ quiet: true })) { try { sessionStorage.setItem('sh_nocloak', '1'); } catch (e) {} note('Auto-hide needs pop-ups allowed for this site.'); } };
    document.addEventListener('pointerdown', once, true); document.addEventListener('keydown', once, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();

  window.ShStealth = { panic: panic, cloak: cloak, label: label, keyOf: keyOf, safeUrl: safeUrl, inFrame: inFrame, defaultUrl: DEF_URL, prefs: prefs };
})();
