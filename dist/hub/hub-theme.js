/* ScrollHub Hub: appearance. Backgrounds, accent color, dimming. Every player can pick their own;
   the owner can set a site-wide default (and optionally force it) from Admin tools > Site controls. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var h = Hub.h;
  // Animated backgrounds streamed from Mixkit's free video library (Mixkit Free License). They load from Mixkit's own
  // servers, so they cost this site no bandwidth. id: [title, mixkit clip number, hue for the picker swatch]
  var WEB = {
    stars: ['Stars', 1610, 225], aurora: ['Northern lights', 4038, 150], nebula: ['Nebula flight', 30889, 280], milkyway: ['Milky Way', 46101, 235], galaxy: ['Galaxy', 10417, 300],
    wormhole: ['Wormhole', 18791, 260], colorflow: ['Color flow', 48838, 320], lightshapes: ['Light shapes', 3987, 200], silk: ['Blue silk', 40211, 215],
    heavyrain: ['Heavy rain', 28087, 215], rainytraffic: ['Rainy traffic', 4331, 25], rainywindow: ['Rainy window', 2846, 210], citynight: ['City at night', 49878, 40],
    waterfall: ['Waterfall', 2213, 140], waves: ['Beach waves', 5016, 190], snow: ['Snowfall', 8468, 215], fireworks: ['Fireworks', 4064, 330], smoke: ['Smoke', 8461, 0],
    bokeh: ['Bokeh lights', 38, 35], tunnel: ['Neon tunnel', 34317, 205], particles: ['Particles', 18140, 270], sunset: ['Beach sunset', 51445, 20]
  };
  var BGS = [['video', 'Original']];
  Object.keys(WEB).forEach(function (k) { BGS.push([k, WEB[k][0]]); });
  BGS.push(['custom', 'Your own']);
  function webSrc(id, q) { var w = WEB[id]; return 'https://assets.mixkit.co/videos/' + w[1] + '/' + w[1] + '-' + q + '.mp4'; }
  function isVideoUrl(u) { return /^https:\/\/[^?#]+\.(mp4|webm|m4v)(\?[^#]*)?$/i.test(u || ''); }
  var ACCENTS = [['blue', 'Blue', '#3b82f6'], ['#8b5cf6', 'Violet', '#8b5cf6'], ['#ec4899', 'Pink', '#ec4899'], ['#10b981', 'Emerald', '#10b981'], ['#f59e0b', 'Amber', '#f59e0b'], ['#ef4444', 'Red', '#ef4444'], ['#06b6d4', 'Cyan', '#06b6d4']];
  Hub.THEME_BGS = BGS; Hub.THEME_ACCENTS = ACCENTS;

  function mix(hex, to, amt) { var a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), r = [16, 8, 0].map(function (s) { var x = (a >> s) & 255, y = (b >> s) & 255; return Math.round(x + (y - x) * amt); }); return '#' + r.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
  function safeUrl(u) { return typeof u === 'string' && /^(https:\/\/[^\s"'()<>\\]{3,300}|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+)$/.test(u) ? u : ''; }

  // What actually shows: the player's choice, unless they follow the site default or the owner forced one.
  Hub.themeNow = function () {
    var p = Hub.prefs, t = (Hub.school && Hub.school.theme) || {}, forced = !!t.force, follow = forced || !p.bg || p.bg === 'auto';
    var bg = follow ? (t.bg || 'stars') : p.bg, ac = (forced || !p.accent || p.accent === 'auto') ? (t.accent || '') : (p.accent === 'blue' ? '' : p.accent);
    var url = bg === 'custom' ? (follow ? t.url : (Hub.ls.raw('sh_hub_bg') || p.bgUrl)) : '';
    if (BGS.every(function (x) { return x[0] !== bg; })) bg = 'video';
    if (bg === 'custom' && !safeUrl(url)) bg = 'video';
    return { bg: bg, accent: /^#[0-9a-f]{6}$/i.test(ac) ? ac : '', url: bg === 'custom' ? safeUrl(url) : '', dim: forced ? (+t.dim || 0) : Math.max(0, Math.min(60, +p.dim || 0)), forced: forced };
  };

  // ---------- streamed background video ----------
  var wv = null, wvKey = '';
  function webStop() { if (wv) { try { wv.pause(); wv.removeAttribute('src'); wv.load(); } catch (e) {} if (wv.parentNode) wv.parentNode.removeChild(wv); } wv = null; wvKey = ''; document.documentElement.removeAttribute('data-bgfail'); }
  function webWanted() { return Hub.prefs.video !== 'still' && !Hub.prefs.reduce && Hub.prefs.motion !== 'reduce' && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function webSync(T) {
    var clip = WEB[T.bg] ? T.bg : '', custom = T.bg === 'custom' && isVideoUrl(T.url) ? T.url : '';
    if (!(clip || custom) || !webWanted()) { webStop(); return; }
    var small = window.innerWidth < 900, key = clip || custom;
    if (wv && wvKey === key) { if (!document.hidden) { var pp = wv.play(); if (pp && pp.catch) pp.catch(function () {}); } return; }
    webStop(); wvKey = key;
    var tries = custom ? [custom] : (small ? ['360'] : ['720', '360']).map(function (q) { return webSrc(clip, q); }), n = 0;
    wv = document.createElement('video'); wv.id = 'bgweb'; wv.muted = true; wv.defaultMuted = true; wv.loop = true; wv.autoplay = true; wv.playsInline = true; wv.preload = 'auto'; wv.setAttribute('playsinline', ''); wv.setAttribute('webkit-playsinline', ''); wv.setAttribute('aria-hidden', 'true'); wv.tabIndex = -1; wv.disablePictureInPicture = true; wv.referrerPolicy = 'no-referrer';
    wv.addEventListener('error', function () { n++; if (n < tries.length) { wv.src = tries[n]; wv.load(); } else { document.documentElement.setAttribute('data-bgfail', '1'); Hub.syncVideo && Hub.syncVideo(); } });
    wv.addEventListener('loadeddata', function () { wv.classList.add('ready'); });
    wv.src = tries[0];
    var bgv = document.getElementById('bgv'); if (bgv && bgv.parentNode) bgv.parentNode.insertBefore(wv, bgv.nextSibling); else document.body.insertBefore(wv, document.body.firstChild);
    var p = wv.play(); if (p && p.catch) p.catch(function () { var once = function () { if (wv) wv.play().catch(function () {}); document.removeEventListener('pointerdown', once); }; document.addEventListener('pointerdown', once, { once: true }); });
  }
  document.addEventListener('visibilitychange', function () { if (!wv) return; if (document.hidden) { try { wv.pause(); } catch (e) {} } else { var p = wv.play(); if (p && p.catch) p.catch(function () {}); } });
  Hub.applyTheme = function () {
    var T = Hub.themeNow(), de = document.documentElement, st = de.style;
    de.setAttribute('data-bg', T.bg);
    if (T.url && !isVideoUrl(T.url)) st.setProperty('--bg-img', 'url("' + T.url + '")'); else st.removeProperty('--bg-img');
    st.setProperty('--dim', String((T.dim || 0) / 100));
    if (T.accent) { st.setProperty('--blue', T.accent); st.setProperty('--blue-hi', mix(T.accent, '#ffffff', .28)); st.setProperty('--blue-lo', mix(T.accent, '#000000', .32)); st.setProperty('--cyan', mix(T.accent, '#ffffff', .4)); }
    else ['--blue', '--blue-hi', '--blue-lo', '--cyan'].forEach(function (k) { st.removeProperty(k); });
    var tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.setAttribute('content', T.accent ? mix(T.accent, '#000000', .88) : '#04070e');
    webSync(T);
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
        var on = st.bg === b[0], pv = h('span', { class: 'tprev tbg-' + (b[0] === 'auto' ? 'video' : b[0]) + (b[0] === 'auto' ? ' tauto' : '') + (WEB[b[0]] ? ' tweb' : '') });
        if (WEB[b[0]]) { var hu = WEB[b[0]][2]; pv.style.background = 'radial-gradient(60px 40px at 70% 30%, hsla(' + (hu + 30) + ',80%,55%,.55), transparent), linear-gradient(135deg, hsl(' + hu + ',55%,14%), hsl(' + ((hu + 40) % 360) + ',60%,28%))'; }
        if (b[0] === 'custom' && st.url) pv.style.backgroundImage = 'url("' + safeUrl(st.url) + '")';
        grid.appendChild(h('button', { type: 'button', class: 'ttile' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { if (b[0] === 'custom' && !st.url && o.upload) { pick(); return; } emit({ bg: b[0] }); } }, [pv, h('span', { class: 'tn', text: b[1] })]));
      });
      wrap.appendChild(grid);
      if (st.bg === 'custom' || o.urlBox) {
        var row = h('div', { class: 'trow' }), url = h('input', { class: 'input', placeholder: 'https:// link to a picture, GIF or video (.mp4)', value: /^https:/.test(st.url) ? st.url : '', autocomplete: 'off', spellcheck: 'false' });
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
