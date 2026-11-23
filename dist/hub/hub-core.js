/* ScrollHub Hub: core helpers (DOM, storage, API, toasts, menus, modals, events). */
(function () {
  'use strict';
  var Hub = window.Hub = { version: '1.0.0', ev: {}, S: {} };

  // ---------- tiny DOM helper ----------
  var SVGNS = 'http://www.w3.org/2000/svg', XLINK = 'http://www.w3.org/1999/xlink';
  function h(tag, a, kids) {
    var el = document.createElement(tag), k;
    if (a) for (k in a) {
      var v = a[k]; if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    if (kids == null || kids === false) return;
    if (Array.isArray(kids)) { for (var i = 0; i < kids.length; i++) add(el, kids[i]); return; }
    el.appendChild(kids.nodeType ? kids : document.createTextNode(String(kids)));
  }
  function icon(name, cls) {
    var s = document.createElementNS(SVGNS, 'svg'); s.setAttribute('class', 'ic' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var u = document.createElementNS(SVGNS, 'use'); u.setAttribute('href', '#i-' + name); u.setAttributeNS(XLINK, 'xlink:href', '#i-' + name); s.appendChild(u); return s;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  Hub.h = h; Hub.icon = icon; Hub.$ = $; Hub.$$ = $$; Hub.clear = clear;

  // ---------- text + number helpers ----------
  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;
  Hub.clean = function (s) { return String(s == null ? '' : s).replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim(); };
  Hub.slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80); };
  Hub.hash = function (s) { var x = 5381; s = String(s); for (var i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return Math.abs(x); };
  Hub.bytes = function (n) { n = +n || 0; if (n < 1024) return n + ' B'; if (n < 1048576) return Math.round(n / 1024) + ' KB'; if (n < 1073741824) return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB'; return (n / 1073741824).toFixed(1) + ' GB'; };
  Hub.ago = function (ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h';
    if (s < 86400 * 30) return Math.floor(s / 86400) + 'd'; if (s < 86400 * 365) return Math.floor(s / (86400 * 30)) + 'mo'; return Math.floor(s / (86400 * 365)) + 'y';
  };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  Hub.dateLong = function (ts) { var d = new Date(ts); return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  Hub.dateShort = function (ts) { var d = new Date(ts); return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + ', ' + d.getFullYear(); };
  Hub.num = function (n) { return (+n || 0).toLocaleString('en-US'); };
  Hub.debounce = function (fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };
  Hub.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  Hub.pickDevice = function () { var ua = navigator.userAgent || ''; return /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/i.test(ua)) ? 'smartphone' : 'monitor'; };
  Hub.deviceName = function () { var ua = navigator.userAgent || ''; if (/iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/i.test(ua))) return 'iPad'; if (/iPhone|iPod/i.test(ua)) return 'iPhone'; if (/Android/i.test(ua)) return 'Android'; return 'Web'; };

  // ---------- events ----------
  Hub.on = function (n, f) { (Hub.ev[n] = Hub.ev[n] || []).push(f); };
  Hub.emit = function (n, d) { var l = Hub.ev[n]; if (l) l.slice().forEach(function (f) { try { f(d); } catch (e) { if (window.console) console.error(e); } }); };

  // ---------- storage (never throws) ----------
  var mem = {};
  Hub.ls = {
    get: function (k, d) { try { var v = localStorage.getItem(k); if (v == null) return k in mem ? mem[k] : d; return JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set: function (k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    raw: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setRaw: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { delete mem[k]; try { localStorage.removeItem(k); } catch (e) {} },
  };

  // ---------- preferences ----------
  var PREF_DEFAULT = { bg: 'auto', accent: 'auto', dim: 0, bgUrl: '', video: 'on', size: 'md', motion: 'auto', contrast: false, auto: true, nUpd: true, nDaily: true, nFriends: true, nDiscord: true, nNews: true, recents: true, panicOn: true, panicKey: null, panicUrl: 'https://www.google.com/', cloakTitle: '', cloakAuto: false, mood: 'off', moodAmt: 'mid', sound: 'off', soundVol: 'mid', homeOrder: [], homeHide: [] };
  Hub.prefs = (function () { var p = Hub.ls.get('sh_hub_prefs', {}) || {}, o = {}, k; for (k in PREF_DEFAULT) o[k] = k in p ? p[k] : PREF_DEFAULT[k]; return o; })();
  Hub.setPref = function (k, v) { Hub.prefs[k] = v; Hub.ls.set('sh_hub_prefs', Hub.prefs); Hub.applyPrefs(); Hub.emit('prefs', k); };
  Hub.applyPrefs = function () {
    var c = document.documentElement.classList, p = Hub.prefs;
    c.toggle('still', p.video !== 'on'); c.toggle('rm', p.motion === 'reduce'); c.toggle('hc', !!p.contrast);
    c.remove('size-lg', 'size-sm'); if (p.size === 'lg') c.add('size-lg'); if (p.size === 'sm') c.add('size-sm');
    Hub.syncVideo && Hub.syncVideo();
  };

  // ---------- API ----------
  Hub.token = function () { return Hub.ls.raw('sh_token') || ''; };
  Hub.api = function (path, o) {
    o = o || {}; var init = { method: o.method || 'GET', credentials: 'same-origin', cache: 'no-store', headers: {} }, t = Hub.token();
    if (t) init.headers.Authorization = 'Bearer ' + t;
    if (o.body !== undefined) { init.method = o.method || 'POST'; init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(o.body); }
    if (o.raw) { init.method = o.method || 'POST'; init.headers['Content-Type'] = o.raw.type || 'application/octet-stream'; init.body = o.raw; }
    return fetch(path, init).then(function (r) { return r.json().then(function (j) { j = j || {}; if (!r.ok && !j.error) j.error = 'http-' + r.status; j._status = r.status; return j; }, function () { return r.ok ? {} : { error: 'http-' + r.status, _status: r.status }; }); }, function () { return { error: 'network' }; });
  };
  Hub.cookie = function (n) { var m = ('; ' + document.cookie).split('; ' + n + '='); return m.length === 2 ? decodeURIComponent(m.pop().split(';').shift()) : ''; };

  // ---------- toasts ----------
  Hub.toast = function (msg, o) {
    o = o || {}; var box = $('#toasts'); if (!box) return;
    while (box.children.length > 2) box.removeChild(box.firstChild);
    var t = h('div', { class: 'toast' + (o.bad ? ' bad' : ''), role: 'status' }, [icon(o.icon || (o.bad ? 'circle-alert' : 'circle-check')), h('span', { text: msg })]);
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260); }, o.ms || 2800);
  };

  // ---------- menus (popovers) ----------
  var openMenu = null;
  Hub.closeMenu = function () { if (openMenu) { openMenu.close(); } };
  Hub.menu = function (anchor, items, o) {
    Hub.closeMenu(); o = o || {};
    var el = h('div', { class: 'menu', role: 'menu' });
    items.forEach(function (it) {
      if (it.sep) { el.appendChild(h('div', { class: 'msep' })); return; }
      if (it.head) { el.appendChild(h('div', { class: 'mhead', text: it.head })); return; }
      var b = h('button', { class: 'mi' + (it.on ? ' on' : '') + (it.danger ? ' dng' : ''), role: 'menuitem', type: 'button' }, [it.icon ? icon(it.icon) : null, h('span', { text: it.label }), it.right ? h('span', { class: 'r', text: it.right }) : (it.on ? h('span', { class: 'r' }, icon('check')) : null)]);
      b.addEventListener('click', function () { close(); if (it.fn) it.fn(); });
      el.appendChild(b);
    });
    $('#layer').appendChild(el);
    var r = anchor.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var left = o.align === 'right' ? r.right - w : r.left; left = Math.max(10, Math.min(left, vw - w - 10));
    var top = r.bottom + 8; if (top + hh > vh - 10) top = Math.max(10, r.top - hh - 8);
    if (o.above) top = Math.max(10, r.top - hh - 8);
    el.style.left = left + 'px'; el.style.top = top + 'px';
    function onDoc(e) { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); }
    function onKey(e) {
      if (e.key === 'Escape') { close(); try { anchor.focus(); } catch (x) {} return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { var bs = $$('.mi', el), i = bs.indexOf(document.activeElement); i = e.key === 'ArrowDown' ? (i + 1) % bs.length : (i - 1 + bs.length) % bs.length; bs[i].focus(); e.preventDefault(); }
    }
    function close() { document.removeEventListener('pointerdown', onDoc, true); document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', close); if (el.parentNode) el.parentNode.removeChild(el); if (openMenu && openMenu.el === el) openMenu = null; }
    setTimeout(function () { document.addEventListener('pointerdown', onDoc, true); }, 0);
    document.addEventListener('keydown', onKey, true); window.addEventListener('resize', close);
    var first = $('.mi', el); if (first && o.focus !== false) first.focus({ preventScroll: true });
    openMenu = { el: el, close: close }; return close;
  };

  // ---------- modals + flyouts ----------
  var modals = [];
  Hub.modal = function (content, o) {
    o = o || {}; var prev = document.activeElement;
    var scrim = h('div', { class: 'scrim' }), box = h('div', { class: 'modal' + (o.small ? ' sm' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.label || 'Dialog' });
    var closeBtn = h('button', { class: 'iconbtn mclose', type: 'button', 'aria-label': 'Close' }, icon('x'));
    box.appendChild(closeBtn); box.appendChild(content);
    var layer = $('#layer'); layer.appendChild(scrim); layer.appendChild(box);
    function close() { document.removeEventListener('keydown', onKey, true); if (scrim.parentNode) scrim.parentNode.removeChild(scrim); if (box.parentNode) box.parentNode.removeChild(box); modals = modals.filter(function (m) { return m !== api; }); if (o.onClose) o.onClose(); try { prev && prev.focus && prev.focus(); } catch (e) {} }
    function onKey(e) {
      if (e.key === 'Escape' && modals[modals.length - 1] === api) { e.stopPropagation(); close(); return; }
      if (e.key === 'Tab' && modals[modals.length - 1] === api) { var f = $$('button,a[href],input,textarea,select,[tabindex]:not([tabindex="-1"])', box).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return; var i = f.indexOf(document.activeElement); if (e.shiftKey && (i <= 0)) { f[f.length - 1].focus(); e.preventDefault(); } else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); } }
    }
    scrim.addEventListener('click', close); closeBtn.addEventListener('click', close); document.addEventListener('keydown', onKey, true);
    var api = { close: close, el: box }; modals.push(api);
    setTimeout(function () { var f = $('input,textarea,.mnav button.on', box); (f || closeBtn).focus({ preventScroll: true }); }, 60);
    return api;
  };
  var fly = null;
  Hub.closeFly = function () { if (fly) fly.close(); };
  Hub.flyout = function (anchor, content, o) {
    Hub.closeFly(); Hub.closeMenu(); o = o || {};
    var el = h('div', { class: 'fly' + (o.cls ? ' ' + o.cls : ''), role: 'dialog', 'aria-label': o.label || 'Panel' }, content);
    $('#layer').appendChild(el);
    var r = anchor.getBoundingClientRect(), w = el.offsetWidth, vw = window.innerWidth;
    if (o.place === 'above') { el.style.bottom = (window.innerHeight - r.top + 10) + 'px'; el.style.right = Math.max(10, vw - r.right) + 'px'; }
    else { el.style.top = (r.bottom + 10) + 'px'; el.style.left = Math.max(10, Math.min(r.left, vw - w - 10)) + 'px'; }
    function onDoc(e) { if (!el.contains(e.target) && !anchor.contains(e.target) && !(e.target.closest && e.target.closest('.menu'))) close(); }
    function onKey(e) { if (e.key === 'Escape') { close(); try { anchor.focus(); } catch (x) {} } }
    function close() { document.removeEventListener('pointerdown', onDoc, true); document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', close); if (el.parentNode) el.parentNode.removeChild(el); if (fly && fly.el === el) fly = null; if (o.onClose) o.onClose(); }
    setTimeout(function () { document.addEventListener('pointerdown', onDoc, true); }, 0); document.addEventListener('keydown', onKey, true); window.addEventListener('resize', close);
    fly = { el: el, close: close }; return fly;
  };

  // ---------- switch + segmented controls ----------
  Hub.toggle = function (label, desc, val, fn) {
    var b = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': val ? 'true' : 'false' }, [h('span', { style: 'min-width:0' }, [h('b', { style: 'display:block;font-weight:600', text: label }), desc ? h('span', { style: 'color:var(--text3);font-size:13px', text: desc }) : null]), h('i', { class: 'tog' })]);
    b.addEventListener('click', function () { val = !val; b.setAttribute('aria-checked', val ? 'true' : 'false'); fn(val); }); return b;
  };
  Hub.seg = function (opts, cur, fn) {
    var wrap = h('div', { class: 'seg', role: 'group' });
    opts.forEach(function (o) { var b = h('button', { type: 'button', class: o[0] === cur ? 'on' : '', text: o[1], 'aria-pressed': o[0] === cur ? 'true' : 'false' }); b.addEventListener('click', function () { $$('button', wrap).forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); fn(o[0]); }); wrap.appendChild(b); });
    return wrap;
  };

  // ---------- viewport height (iOS Safari toolbar safe) ----------
  function setVh() { document.documentElement.style.setProperty('--app-h', window.innerHeight + 'px'); }
  setVh(); window.addEventListener('resize', setVh); window.addEventListener('orientationchange', function () { setTimeout(setVh, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', setVh);
})();
