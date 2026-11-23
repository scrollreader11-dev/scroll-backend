/* ScrollHub Hub: appearance. Backgrounds, accent color, dimming. Every player can pick their own;
   the owner can set a site-wide default (and optionally force it) from Admin tools > Site controls. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var h = Hub.h;
  var BGS = [['video', 'Animated'], ['aurora', 'Aurora'], ['midnight', 'Midnight'], ['sunset', 'Sunset'], ['forest', 'Forest'], ['crimson', 'Crimson'], ['grid', 'Neon grid'], ['slate', 'Slate'], ['mono', 'Black'],
    ['matrix', 'Code rain'], ['stars', 'Starfield'], ['snow', 'Snowfall'], ['fireflies', 'Fireflies'], ['rain', 'Rainy night'], ['synthwave', 'Synthwave'], ['bubbles', 'Bubbles'], ['lava', 'Lava lamp'], ['confetti', 'Confetti'], ['custom', 'Your picture']];
  var FX = { matrix: 1, stars: 1, snow: 1, fireflies: 1, rain: 1, synthwave: 1, bubbles: 1, lava: 1, confetti: 1 };
  var ACCENTS = [['blue', 'Blue', '#3b82f6'], ['#8b5cf6', 'Violet', '#8b5cf6'], ['#ec4899', 'Pink', '#ec4899'], ['#10b981', 'Emerald', '#10b981'], ['#f59e0b', 'Amber', '#f59e0b'], ['#ef4444', 'Red', '#ef4444'], ['#06b6d4', 'Cyan', '#06b6d4']];
  Hub.THEME_BGS = BGS; Hub.THEME_ACCENTS = ACCENTS;

  function mix(hex, to, amt) { var a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), r = [16, 8, 0].map(function (s) { var x = (a >> s) & 255, y = (b >> s) & 255; return Math.round(x + (y - x) * amt); }); return '#' + r.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function safeUrl(u) { return typeof u === 'string' && /^(https:\/\/[^\s"'()<>\\]{3,300}|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+)$/.test(u) ? u : ''; }

  // What actually shows: the player's choice, unless they follow the site default or the owner forced one.
  Hub.themeNow = function () {
    var p = Hub.prefs, t = (Hub.school && Hub.school.theme) || {}, forced = !!t.force, follow = forced || !p.bg || p.bg === 'auto';
    var bg = follow ? (t.bg || 'video') : p.bg, ac = (forced || !p.accent || p.accent === 'auto') ? (t.accent || '') : (p.accent === 'blue' ? '' : p.accent);
    var url = bg === 'custom' ? (follow ? t.url : (Hub.ls.raw('sh_hub_bg') || p.bgUrl)) : '';
    if (BGS.every(function (x) { return x[0] !== bg; })) bg = 'video';
    if (bg === 'custom' && !safeUrl(url)) bg = 'video';
    return { bg: bg, accent: /^#[0-9a-f]{6}$/i.test(ac) ? ac : '', url: bg === 'custom' ? safeUrl(url) : '', dim: forced ? (+t.dim || 0) : Math.max(0, Math.min(60, +p.dim || 0)), forced: forced };
  };

  // ---------- animated backgrounds (one fixed canvas, ~30 fps, pauses when hidden / reduced motion) ----------
  var cv = null, cx = null, raf = 0, fxId = '', W = 0, H = 0, S = {}, last = 0, DPR = 1;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pal() { return getComputedStyle(document.documentElement).getPropertyValue('--blue-hi').trim() || '#60a5fa'; }
  var FXS = {
    matrix: { init: function () { var cols = Math.ceil(W / 18); S.d = []; for (var i = 0; i < cols; i++) S.d.push(rnd(-H, 0)); S.chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789ABCDEF'; },
      draw: function (c, t, dt) { c.fillStyle = 'rgba(2,8,6,.16)'; c.fillRect(0, 0, W, H); c.font = '16px monospace'; for (var i = 0; i < S.d.length; i++) { var ch = S.chars.charAt((Math.random() * S.chars.length) | 0); c.fillStyle = Math.random() < .03 ? '#d8ffe6' : 'rgba(40,220,120,.85)'; c.fillText(ch, i * 18, S.d[i]); S.d[i] += 120 * dt * (.6 + (i % 5) * .15); if (S.d[i] > H + 20 && Math.random() > .975) S.d[i] = rnd(-200, 0); } } },
    stars: { init: function () { S.s = []; for (var i = 0; i < 220; i++) S.s.push({ x: rnd(-1, 1), y: rnd(-1, 1), z: Math.random() }); },
      draw: function (c, t, dt) { c.fillStyle = '#03050f'; c.fillRect(0, 0, W, H); var cxx = W / 2, cyy = H / 2, ac = pal(); S.s.forEach(function (p) { p.z -= dt * .18; if (p.z <= .02) { p.x = rnd(-1, 1); p.y = rnd(-1, 1); p.z = 1; } var k = 1 / p.z, x = cxx + p.x * k * W * .12, y = cyy + p.y * k * W * .12, r = Math.min(2.4, .4 + (1 - p.z) * 2.2); c.fillStyle = p.z < .35 ? '#fff' : ac; c.globalAlpha = Math.min(1, (1 - p.z) * 1.4); c.beginPath(); c.arc(x, y, r, 0, 6.3); c.fill(); }); c.globalAlpha = 1; } },
    snow: { init: function () { S.f = []; for (var i = 0; i < 140; i++) S.f.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(1, 3.4), v: rnd(20, 70), w: rnd(0, 6.3) }); },
      draw: function (c, t, dt) { var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a1330'); g.addColorStop(1, '#1b2a55'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; S.f.forEach(function (p) { p.y += p.v * dt; p.w += dt; p.x += Math.sin(p.w) * 18 * dt; if (p.y > H + 5) { p.y = -5; p.x = rnd(0, W); } c.globalAlpha = .45 + p.r / 7; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.3); c.fill(); }); c.globalAlpha = 1; } },
    fireflies: { init: function () { S.f = []; for (var i = 0; i < 60; i++) S.f.push({ x: rnd(0, W), y: rnd(0, H), a: rnd(0, 6.3), s: rnd(8, 26), p: rnd(0, 6.3) }); },
      draw: function (c, t, dt) { var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#050d0a'); g.addColorStop(1, '#0a2218'); c.fillStyle = g; c.fillRect(0, 0, W, H); S.f.forEach(function (p) { p.a += rnd(-1, 1) * dt * 2; p.x += Math.cos(p.a) * p.s * dt; p.y += Math.sin(p.a) * p.s * dt; if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10; var l = .35 + .65 * Math.abs(Math.sin(t * .0012 + p.p)); var r = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16); r.addColorStop(0, 'rgba(220,255,140,' + l + ')'); r.addColorStop(1, 'rgba(220,255,140,0)'); c.fillStyle = r; c.beginPath(); c.arc(p.x, p.y, 16, 0, 6.3); c.fill(); }); } },
    rain: { init: function () { S.r = []; for (var i = 0; i < 170; i++) S.r.push({ x: rnd(0, W), y: rnd(0, H), l: rnd(10, 26), v: rnd(520, 900) }); },
      draw: function (c, t, dt) { var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#070b16'); g.addColorStop(1, '#101c33'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(160,190,255,.35)'; c.lineWidth = 1; c.beginPath(); S.r.forEach(function (p) { p.y += p.v * dt; p.x -= p.v * dt * .12; if (p.y > H) { p.y = -p.l; p.x = rnd(0, W + 100); } c.moveTo(p.x, p.y); c.lineTo(p.x - p.l * .12, p.y + p.l); }); c.stroke(); } },
    synthwave: { init: function () {}, draw: function (c, t) { var hz = H * .56, g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#12002e'); g.addColorStop(1, '#6b1b78'); c.fillStyle = g; c.fillRect(0, 0, W, hz); var sg = c.createLinearGradient(0, hz - H * .3, 0, hz); sg.addColorStop(0, '#ffd23f'); sg.addColorStop(1, '#ff2e88'); c.fillStyle = sg; c.beginPath(); c.arc(W / 2, hz, Math.min(W, H) * .24, Math.PI, 0); c.fill(); c.fillStyle = '#0a0020'; c.fillRect(0, hz, W, H - hz); c.strokeStyle = 'rgba(255,60,200,.65)'; c.lineWidth = 1.2; c.beginPath(); for (var i = -12; i <= 12; i++) { c.moveTo(W / 2 + i * 12, hz); c.lineTo(W / 2 + i * W * .12, H); } var off = (t * .00035) % 1; for (var j = 0; j < 14; j++) { var f = (j + off) / 14, y = hz + (H - hz) * f * f; c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); } },
    bubbles: { init: function () { S.b = []; for (var i = 0; i < 38; i++) S.b.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(6, 38), v: rnd(10, 40), w: rnd(0, 6.3) }); },
      draw: function (c, t, dt) { var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04304a'); g.addColorStop(1, '#021622'); c.fillStyle = g; c.fillRect(0, 0, W, H); S.b.forEach(function (p) { p.y -= p.v * dt; p.w += dt; p.x += Math.sin(p.w) * 10 * dt; if (p.y < -p.r) { p.y = H + p.r; p.x = rnd(0, W); } c.strokeStyle = 'rgba(180,235,255,.45)'; c.fillStyle = 'rgba(120,210,255,.08)'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.3); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(p.x - p.r * .35, p.y - p.r * .35, p.r * .16, 0, 6.3); c.fill(); }); } },
    lava: { init: function () { S.m = []; for (var i = 0; i < 7; i++) S.m.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(90, 190), vx: rnd(-22, 22), vy: rnd(-30, 30), h: rnd(300, 360) }); },
      draw: function (c, t, dt) { c.fillStyle = '#12041f'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'lighter'; S.m.forEach(function (p) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; var g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, 'hsla(' + p.h + ',90%,55%,.55)'); g.addColorStop(1, 'hsla(' + p.h + ',90%,55%,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.3); c.fill(); }); c.globalCompositeOperation = 'source-over'; } },
    confetti: { init: function () { S.c = []; for (var i = 0; i < 90; i++) S.c.push({ x: rnd(0, W), y: rnd(-H, H), w: rnd(5, 11), h: rnd(8, 16), v: rnd(40, 110), r: rnd(0, 6.3), vr: rnd(-3, 3), c: ['#ff5c8a', '#ffd166', '#5cf2ff', '#b8ff5c', '#9b6bff'][(Math.random() * 5) | 0] }); },
      draw: function (c, t, dt) { c.fillStyle = '#0b0a1e'; c.fillRect(0, 0, W, H); S.c.forEach(function (p) { p.y += p.v * dt; p.r += p.vr * dt; if (p.y > H + 20) { p.y = -20; p.x = rnd(0, W); } c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = .8; c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); }); } }
  };
  function fxStop() { if (raf) cancelAnimationFrame(raf); raf = 0; if (cv && cv.parentNode) cv.parentNode.removeChild(cv); cv = cx = null; fxId = ''; }
  function fxSize() { if (!cv) return; DPR = Math.min(window.devicePixelRatio || 1, 1.5); W = window.innerWidth; H = window.innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cx.setTransform(DPR, 0, 0, DPR, 0, 0); S = {}; var f = FXS[fxId]; if (f) f.init(); }
  function fxLoop(now) {
    raf = requestAnimationFrame(fxLoop); if (document.hidden) { last = 0; return; }
    if (now - last < 33) return; var dt = last ? Math.min(.1, (now - last) / 1000) : .033; last = now;
    try { FXS[fxId].draw(cx, now, dt); } catch (e) { fxStop(); }
  }
  function fxSync(id) {
    var rm = document.documentElement.classList.contains('rm') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!FXS[id] || rm) { fxStop(); return; }
    if (fxId === id && cv) return;
    fxStop(); fxId = id; cv = document.createElement('canvas'); cv.id = 'bgcanvas'; cv.setAttribute('aria-hidden', 'true'); document.body.insertBefore(cv, document.body.firstChild); cx = cv.getContext('2d'); fxSize(); last = 0; raf = requestAnimationFrame(fxLoop);
  }
  window.addEventListener('resize', function () { if (cv) fxSize(); });

  Hub.applyTheme = function () {
    var T = Hub.themeNow(), de = document.documentElement, st = de.style;
    de.setAttribute('data-bg', T.bg);
    if (T.url) st.setProperty('--bg-img', 'url("' + T.url + '")'); else st.removeProperty('--bg-img');
    st.setProperty('--dim', String((T.dim || 0) / 100));
    if (T.accent) { st.setProperty('--blue', T.accent); st.setProperty('--blue-hi', mix(T.accent, '#ffffff', .28)); st.setProperty('--blue-lo', mix(T.accent, '#000000', .32)); st.setProperty('--cyan', mix(T.accent, '#ffffff', .4)); }
    else ['--blue', '--blue-hi', '--blue-lo', '--cyan'].forEach(function (k) { st.removeProperty(k); });
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', T.accent ? mix(T.accent, '#000000', .88) : '#04070e');
    fxSync(FX[T.bg] ? T.bg : '');
    Hub.syncVideo && Hub.syncVideo();
  };
  var baseApply = Hub.applyPrefs; Hub.applyPrefs = function () { baseApply(); Hub.applyTheme(); };

  // Downscale a picked image so it fits comfortably in localStorage.
  function fileToData(file, done) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var k = Math.min(1, 1920 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      var q = .82, out = c.toDataURL('image/jpeg', q); while (out.length > 1.4e6 && q > .4) { q -= .1; out = c.toDataURL('image/jpeg', q); }
      done(out);
    };
    img.onerror = function () { URL.revokeObjectURL(url); done(''); }; img.src = url;
  }

  // Shared picker. o: { bg, accent, dim, url, auto: 'label' (adds a "follow" tile), upload: bool, onChange(partial) }
  Hub.themePicker = function (o) {
    var wrap = h('div', { class: 'tpick' }), st = { bg: o.bg, accent: o.accent, dim: o.dim || 0, url: o.url || '' };
    function emit(part) { for (var k in part) st[k] = part[k]; o.onChange && o.onChange(part, st); paint(); }
    function paint() {
      Hub.clear(wrap);
      var grid = h('div', { class: 'tgrid' });
      var tiles = (o.auto ? [['auto', o.auto]] : []).concat(BGS.filter(function (b) { return b[0] !== 'custom' || o.upload || o.urlBox; }));
      tiles.forEach(function (b) {
        var on = st.bg === b[0], pv = h('span', { class: 'tprev tbg-' + (b[0] === 'auto' ? 'video' : b[0]) + (b[0] === 'auto' ? ' tauto' : '') });
        if (b[0] === 'custom' && st.url) pv.style.backgroundImage = 'url("' + safeUrl(st.url) + '")';
        grid.appendChild(h('button', { type: 'button', class: 'ttile' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { if (b[0] === 'custom' && !st.url && o.upload) { pick(); return; } emit({ bg: b[0] }); } }, [pv, h('span', { class: 'tn', text: b[1] })]));
      });
      wrap.appendChild(grid);
      if (st.bg === 'custom' || o.urlBox) {
        var row = h('div', { class: 'trow' }), url = h('input', { class: 'input', placeholder: 'https:// link to a picture', value: /^https:/.test(st.url) ? st.url : '', autocomplete: 'off', spellcheck: 'false' });
        row.appendChild(url); row.appendChild(h('button', { class: 'btn sm', type: 'button', text: 'Use link', onclick: function () { var u = url.value.trim(); if (safeUrl(u)) { if (o.upload) { Hub.ls.del && Hub.ls.del('sh_hub_bg'); } emit({ url: u, bg: 'custom' }); } else Hub.toast('Use a link that starts with https://', { bad: true }); } }));
        if (o.upload) row.appendChild(h('button', { class: 'btn sm', type: 'button', text: 'Upload picture', onclick: pick }));
        wrap.appendChild(row);
      }
      wrap.appendChild(h('div', { class: 'tlabel', text: 'Accent color' }));
      var sw = h('div', { class: 'tsw' });
      (o.auto ? [['auto', 'Follow site', '']] : []).concat(ACCENTS).forEach(function (a) {
        var on = (st.accent || (o.auto ? 'auto' : 'blue')) === a[0];
        sw.appendChild(h('button', { type: 'button', class: 'tdot' + (on ? ' on' : ''), title: a[1], 'aria-label': a[1], 'aria-pressed': on ? 'true' : 'false', style: a[2] ? 'background:' + a[2] : '', onclick: function () { emit({ accent: a[0] }); } }, a[0] === 'auto' ? h('span', { text: 'Auto' }) : null));
      });
      wrap.appendChild(sw);
      if (o.dim !== undefined) {
        wrap.appendChild(h('div', { class: 'tlabel', text: 'Darken background' }));
        var r = h('input', { type: 'range', min: '0', max: '60', value: String(st.dim || 0), 'aria-label': 'Darken background', class: 'trange' });
        r.addEventListener('input', function () { st.dim = +r.value; o.onChange && o.onChange({ dim: +r.value }, st); });
        wrap.appendChild(r);
      }
    }
    function pick() {
      var f = h('input', { type: 'file', accept: 'image/*' });
      f.addEventListener('change', function () { var file = f.files && f.files[0]; if (!file) return; fileToData(file, function (d) { if (!d) { Hub.toast('That picture could not be read', { bad: true }); return; } try { localStorage.setItem('sh_hub_bg', d); } catch (e) { Hub.toast('That picture is too large to save', { bad: true }); return; } emit({ url: d, bg: 'custom' }); Hub.toast('Background saved'); }); });
      f.click();
    }
    paint(); return wrap;
  };

  Hub.on('school', function () { Hub.applyTheme(); });
  Hub.applyTheme();
})();
