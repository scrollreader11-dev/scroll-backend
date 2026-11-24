/* ScrollHub Hub: ambient mood tint and sound packs. Both are per-player settings and both start switched off. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;

  // ---------- ambient mood ----------
  var MOODS = [['off', 'Off'], ['auto', 'Follow the clock'], ['dawn', 'Dawn'], ['day', 'Day'], ['sunset', 'Sunset'], ['night', 'Night']];
  var LAYER = {
    dawn: 'linear-gradient(180deg, rgba(255,160,120,.34), rgba(255,205,150,.18) 55%, rgba(120,90,170,.22))',
    day: 'linear-gradient(180deg, rgba(255,244,205,.20), rgba(255,236,190,.08) 60%, rgba(120,190,255,.10))',
    sunset: 'linear-gradient(180deg, rgba(255,120,60,.36), rgba(220,70,110,.28) 55%, rgba(110,40,140,.30))',
    night: 'linear-gradient(180deg, rgba(10,18,70,.46), rgba(20,16,80,.40) 60%, rgba(6,10,40,.46))'
  };
  var host = null, layers = {};
  function moodHost() {
    if (host) return host;
    host = document.createElement('div'); host.id = 'mood'; host.setAttribute('aria-hidden', 'true');
    Object.keys(LAYER).forEach(function (k) { var d = document.createElement('div'); d.className = 'mood-l'; d.style.background = LAYER[k]; layers[k] = d; host.appendChild(d); });
    var bgfx = document.getElementById('bgfx'); if (bgfx && bgfx.parentNode) bgfx.parentNode.insertBefore(host, bgfx.nextSibling); else document.body.appendChild(host);
    return host;
  }
  function clockMood(d) { var hr = (d || new Date()).getHours(); return hr >= 5 && hr < 8 ? 'dawn' : hr < 17 && hr >= 8 ? 'day' : hr >= 17 && hr < 20 ? 'sunset' : 'night'; }
  Hub.mood = function () { var m = Hub.prefs.mood || 'off'; return m === 'auto' ? clockMood() : m; };
  Hub.applyMood = function () {
    var m = Hub.mood(), amt = { low: .45, mid: .75, high: 1 }[Hub.prefs.moodAmt] || .75;
    if (m === 'off' && !host) return; moodHost();
    Object.keys(layers).forEach(function (k) { layers[k].style.opacity = k === m ? String(amt) : '0'; });
  };
  setInterval(function () { if ((Hub.prefs.mood || 'off') === 'auto') Hub.applyMood(); }, 120000);

  // ---------- sounds ----------
  var ctx = null, last = 0, lastName = '', LEGACY = { low: 35, mid: 65, high: 100 };
  function vol() { var v = Hub.prefs.soundVol; if (typeof v === 'string') v = LEGACY[v]; v = +v; if (!(v >= 0)) v = 65; return Math.min(1, v / 100) * Math.min(1, v / 100) * 1.1; }   // squared so the low end is properly quiet
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (ctx.state === 'suspended') ctx.resume().catch(function () {}); return ctx; }
  function tone(c, t0, f0, f1, dur, type, vol) {
    var o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  var noiseBuf = null;
  function whoosh(c, t0, f0, f1, dur, vol) {
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.Q.value = 1.1;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0); s.stop(t0 + dur + 0.02);
  }
  var PACKS = {
    soft: { click: function (c, t, v) { tone(c, t, 540, 400, 0.07, 'sine', 0.22 * v); }, open: function (c, t, v) { whoosh(c, t, 380, 1700, 0.24, 0.26 * v); }, close: function (c, t, v) { whoosh(c, t, 1500, 360, 0.2, 0.22 * v); }, on: function (c, t, v) { tone(c, t, 520, 520, 0.09, 'sine', 0.2 * v); tone(c, t + 0.07, 780, 780, 0.12, 'sine', 0.2 * v); }, off: function (c, t, v) { tone(c, t, 700, 700, 0.09, 'sine', 0.2 * v); tone(c, t + 0.07, 470, 470, 0.12, 'sine', 0.2 * v); }, ping: function (c, t, v) { tone(c, t, 880, 880, 0.22, 'sine', 0.2 * v); tone(c, t + 0.09, 1320, 1320, 0.26, 'sine', 0.16 * v); } },
    arcade: { click: function (c, t, v) { tone(c, t, 660, 900, 0.05, 'square', 0.07 * v); }, open: function (c, t, v) { [440, 660, 880].forEach(function (f, i) { tone(c, t + i * 0.05, f, f, 0.07, 'square', 0.07 * v); }); }, close: function (c, t, v) { [880, 660, 440].forEach(function (f, i) { tone(c, t + i * 0.05, f, f, 0.07, 'square', 0.07 * v); }); }, on: function (c, t, v) { tone(c, t, 523, 523, 0.07, 'square', 0.07 * v); tone(c, t + 0.07, 784, 784, 0.1, 'square', 0.07 * v); }, off: function (c, t, v) { tone(c, t, 784, 784, 0.07, 'square', 0.07 * v); tone(c, t + 0.07, 523, 523, 0.1, 'square', 0.07 * v); }, ping: function (c, t, v) { tone(c, t, 988, 988, 0.08, 'square', 0.07 * v); tone(c, t + 0.09, 1319, 1319, 0.14, 'square', 0.07 * v); } },
    wood: { click: function (c, t, v) { tone(c, t, 240, 110, 0.05, 'triangle', 0.5 * v); }, open: function (c, t, v) { tone(c, t, 170, 300, 0.12, 'triangle', 0.4 * v); whoosh(c, t, 300, 900, 0.14, 0.1 * v); }, close: function (c, t, v) { tone(c, t, 300, 150, 0.12, 'triangle', 0.4 * v); }, on: function (c, t, v) { tone(c, t, 200, 120, 0.05, 'triangle', 0.45 * v); tone(c, t + 0.06, 300, 180, 0.06, 'triangle', 0.45 * v); }, off: function (c, t, v) { tone(c, t, 300, 180, 0.05, 'triangle', 0.45 * v); tone(c, t + 0.06, 200, 120, 0.06, 'triangle', 0.45 * v); }, ping: function (c, t, v) { tone(c, t, 420, 400, 0.16, 'triangle', 0.4 * v); tone(c, t + 0.1, 630, 600, 0.2, 'triangle', 0.35 * v); } },
    glass: { click: function (c, t, v) { tone(c, t, 1500, 1450, 0.07, 'sine', 0.14 * v); }, open: function (c, t, v) { tone(c, t, 1200, 1800, 0.2, 'sine', 0.14 * v); whoosh(c, t, 2000, 5000, 0.2, 0.05 * v); }, close: function (c, t, v) { tone(c, t, 1800, 1200, 0.2, 'sine', 0.14 * v); }, on: function (c, t, v) { tone(c, t, 1318, 1318, 0.18, 'sine', 0.14 * v); tone(c, t + 0.08, 1760, 1760, 0.28, 'sine', 0.14 * v); }, off: function (c, t, v) { tone(c, t, 1760, 1760, 0.18, 'sine', 0.14 * v); tone(c, t + 0.08, 1318, 1318, 0.28, 'sine', 0.14 * v); }, ping: function (c, t, v) { tone(c, t, 1568, 1568, 0.3, 'sine', 0.14 * v); tone(c, t + 0.1, 2093, 2093, 0.4, 'sine', 0.12 * v); } }
  };
  Hub.sounds = [['off', 'Off'], ['soft', 'Soft'], ['arcade', 'Arcade'], ['wood', 'Wood'], ['glass', 'Glass']];
  Hub.sfx = function (name, force) {
    var pack = force || Hub.prefs.sound; if (!pack || pack === 'off' || !PACKS[pack] || !PACKS[pack][name]) return;
    if (!force && Hub.prefs.soundMute !== false && Hub.playing) return;   // a game is open: stay quiet
    var now = Date.now(); if (!force && name === lastName && now - last < 60) return; last = now; lastName = name;
    var c = ac(); if (!c) return; try { PACKS[pack][name](c, c.currentTime + 0.01, vol()); } catch (e) {}
  };
  Hub.sfxPreview = function (pack) { Hub.sfx('click', pack); setTimeout(function () { Hub.sfx('open', pack); }, 220); };

  // Clicks on anything pressable; switches get their own on/off sound.
  document.addEventListener('click', function (e) {
    if (!Hub.prefs.sound || Hub.prefs.sound === 'off') return;
    var t = e.target && e.target.closest ? e.target.closest('button, a, [role="button"], [role="switch"], .chip, .tile-lg, .card, .row-btn, summary') : null; if (!t || t.disabled) return;
    if (t.getAttribute('role') === 'switch') { setTimeout(function () { Hub.sfx(t.getAttribute('aria-checked') === 'true' ? 'on' : 'off'); }, 0); return; }
    Hub.sfx('click');
  }, true);

  // Menus, dialogs and panels opening and closing, and toasts arriving.
  var OPEN = /\b(modal|menu|fly|fr-panel|suggest)\b/;
  function seen(n) { return n.nodeType === 1 && n.className && typeof n.className === 'string' && OPEN.test(n.className); }
  new MutationObserver(function (list) {
    if (!Hub.prefs.sound || Hub.prefs.sound === 'off') return;
    for (var i = 0; i < list.length; i++) {
      var m = list[i], a, r;
      for (a = 0; a < m.addedNodes.length; a++) { var n = m.addedNodes[a]; if (seen(n)) { Hub.sfx('open'); return; } if (m.target.id === 'toasts') { Hub.sfx('ping'); return; } }
      for (r = 0; r < m.removedNodes.length; r++) if (seen(m.removedNodes[r])) { Hub.sfx('close'); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });

  Hub.on('prefs', function (k) { if (k === 'mood' || k === 'moodAmt') Hub.applyMood(); });
  Hub.applyMood();
})();
