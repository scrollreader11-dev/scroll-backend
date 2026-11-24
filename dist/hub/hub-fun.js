/* ScrollHub Hub: the fun layer. One canvas draws cursor trails, click bursts, seasonal decorations and party confetti. It never draws over a game. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var cv = null, cx = null, W = 0, H = 0, dpr = 1, parts = [], running = false, last = 0, ambientAcc = 0;
  var reduce = function () { return document.documentElement.classList.contains('rm') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.id = 'fxc'; cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9990';
    document.body.appendChild(cv); cx = cv.getContext('2d'); size();
    window.addEventListener('resize', size);
  }
  function size() { if (!cv) return; dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }

  // ---------- particle drawing ----------
  var DRAW = {
    dot: function (p) { cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.2832); cx.fill(); },
    bubble: function (p) { cx.lineWidth = 1.2; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.2832); cx.stroke(); },
    sq: function (p) { cx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); },
    rect: function (p) { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.scale(1, Math.cos(p.r * 1.7) * .8 + .2); cx.fillRect(-p.s, -p.s * .5, p.s * 2, p.s); cx.restore(); },
    leaf: function (p) { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.beginPath(); cx.ellipse(0, 0, p.s * 1.7, p.s * .8, 0, 0, 6.2832); cx.fill(); cx.strokeStyle = 'rgba(60,25,5,.45)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(-p.s * 1.7, 0); cx.lineTo(p.s * 1.7, 0); cx.stroke(); cx.restore(); },
    heart: function (p) { var s = p.s; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r * .25); cx.beginPath(); cx.moveTo(0, s * .55); cx.bezierCurveTo(-s * 1.35, -s * .2, -s * .6, -s * 1.15, 0, -s * .4); cx.bezierCurveTo(s * .6, -s * 1.15, s * 1.35, -s * .2, 0, s * .55); cx.fill(); cx.restore(); },
    spark: function (p) { var s = p.s * (.6 + .4 * Math.sin(p.age * 18)); cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.beginPath(); cx.moveTo(0, -s); cx.quadraticCurveTo(0, 0, s, 0); cx.quadraticCurveTo(0, 0, 0, s); cx.quadraticCurveTo(0, 0, -s, 0); cx.quadraticCurveTo(0, 0, 0, -s); cx.fill(); cx.restore(); }
  };
  function add(p) { p.age = 0; p.r = p.r || 0; p.vr = p.vr || 0; p.g = p.g || 0; p.a = p.a == null ? 1 : p.a; p.fade = p.fade || 0; if (parts.length < 900) parts.push(p); kick(); }

  // ---------- seasons ----------
  var SEASON = {
    xmas: { n: 70, make: function () { var s = rnd(1.4, 3.6); return { t: 'dot', x: rnd(0, W), y: -8, vx: rnd(-8, 8), vy: rnd(28, 60) * (s / 3 + .55), s: s, c: 'rgba(255,255,255,.88)', sway: rnd(0, 6), life: 40 }; } },
    thanksgiving: { n: 26, make: function () { return { t: 'leaf', x: rnd(0, W), y: -14, vx: rnd(-14, 14), vy: rnd(26, 52), s: rnd(3, 5.5), r: rnd(0, 6), vr: rnd(-2, 2), c: pick(['#c8641e', '#e0902c', '#9a3b1a', '#b8892a']), sway: rnd(0, 20), life: 40 }; } },
    halloween: { n: 38, make: function () { return { t: 'dot', x: rnd(0, W), y: H + 8, vx: rnd(-10, 10), vy: -rnd(22, 52), s: rnd(1.2, 3), c: pick(['rgba(255,140,40,.85)', 'rgba(255,190,70,.8)', 'rgba(170,100,255,.7)']), sway: rnd(0, 10), life: 40 }; } },
    newyear: { n: 40, make: function () { return { t: 'rect', x: rnd(0, W), y: -10, vx: rnd(-14, 14), vy: rnd(40, 80), s: rnd(2.5, 4), r: rnd(0, 6), vr: rnd(-4, 4), c: pick(['#ffd36b', '#f4f4f8', '#c9ced9', '#ffe9a8']), sway: rnd(0, 10), life: 40 }; } },
    valentines: { n: 20, make: function () { return { t: 'heart', x: rnd(0, W), y: H + 12, vx: rnd(-12, 12), vy: -rnd(26, 56), s: rnd(5, 9), r: rnd(-1, 1), vr: rnd(-1, 1), c: pick(['rgba(255,110,150,.8)', 'rgba(255,160,190,.8)', 'rgba(230,60,110,.75)']), sway: rnd(0, 12), life: 40 }; } },
    stpatricks: { n: 30, make: function () { return { t: 'rect', x: rnd(0, W), y: -10, vx: rnd(-12, 12), vy: rnd(34, 70), s: rnd(2.5, 4), r: rnd(0, 6), vr: rnd(-4, 4), c: pick(['#3fbf6b', '#7be08f', '#e9c95a', '#2a9a52']), sway: rnd(0, 10), life: 40 }; } },
    easter: { n: 30, make: function () { return { t: 'dot', x: rnd(0, W), y: -8, vx: rnd(-10, 10), vy: rnd(30, 62), s: rnd(2, 4), c: pick(['#ffc6dd', '#c9e7ff', '#fff3a8', '#cfe9c8', '#e3cfff']), sway: rnd(0, 8), life: 40 }; } },
    july4: { n: 36, make: function () { return { t: 'rect', x: rnd(0, W), y: -10, vx: rnd(-16, 16), vy: rnd(40, 84), s: rnd(2.5, 4), r: rnd(0, 6), vr: rnd(-4, 4), c: pick(['#ff4b5c', '#f4f6fb', '#4b86ff']), sway: rnd(0, 10), life: 40 }; } },
    summer: { n: 22, make: function () { return { t: 'bubble', x: rnd(0, W), y: H + 8, vx: rnd(-8, 8), vy: -rnd(20, 44), s: rnd(3, 8), c: 'rgba(190,230,255,.55)', sway: rnd(0, 10), life: 40 }; } }
  };
  function season() { return Hub.prefs.seasonFx !== false && SEASON[(Hub.school && Hub.school.season) || ''] ? SEASON[Hub.school.season] : null; }

  // ---------- trail and click ----------
  var TRAIL = {
    stars: function (x, y) { add({ t: 'spark', x: x + rnd(-4, 4), y: y + rnd(-4, 4), vx: rnd(-14, 14), vy: rnd(-6, 22), s: rnd(4, 8), r: rnd(0, 1.5), vr: rnd(-2, 2), c: pick(['#fff3c4', '#ffd36b', '#ffffff']), life: .65, fade: 1 }); },
    pixels: function (x, y) { var q = 4; add({ t: 'sq', x: Math.round(x / q) * q, y: Math.round(y / q) * q, vx: 0, vy: 0, s: q + 1, c: 'hsl(' + ((Date.now() / 6) % 360 | 0) + ',85%,65%)', life: .5, fade: 1 }); },
    ink: function (x, y) { add({ t: 'dot', x: x, y: y, vx: rnd(-3, 3), vy: rnd(-3, 3), s: rnd(5, 8), c: 'rgba(120,150,255,.7)', life: .8, fade: 1, shrink: 1 }); },
    embers: function (x, y) { add({ t: 'dot', x: x + rnd(-3, 3), y: y, vx: rnd(-12, 12), vy: -rnd(16, 46), s: rnd(1.3, 2.8), c: pick(['rgba(255,150,50,.95)', 'rgba(255,200,90,.9)', 'rgba(255,100,40,.9)']), life: .9, fade: 1 }); }
  };
  var lx = -99, ly = -99;
  document.addEventListener('pointermove', function (e) {
    var k = Hub.prefs.trail; if (!k || k === 'off' || e.pointerType === 'touch' || Hub.playing || reduce()) return;
    var dx = e.clientX - lx, dy = e.clientY - ly; if (dx * dx + dy * dy < 150) return; lx = e.clientX; ly = e.clientY; ensure(); (TRAIL[k] || TRAIL.stars)(e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener('pointerdown', function (e) {
    var k = Hub.prefs.trail; if (!k || k === 'off' || Hub.playing || reduce()) return; ensure();
    for (var i = 0; i < 9; i++) { var a = i / 9 * 6.2832 + rnd(-.3, .3), v = rnd(60, 150); (TRAIL[k] || TRAIL.stars)(e.clientX, e.clientY); var p = parts[parts.length - 1]; if (p) { p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.life *= 1.2; } }
  }, { passive: true });

  // ---------- party ----------
  var partyUntil = 0;
  Hub.party = function (ms) {
    if (Hub.playing || reduce()) { Hub.toast('Party time.'); return; } ensure(); partyUntil = Date.now() + (ms || 10000);
    function cannon(x, dir, n) { for (var i = 0; i < n; i++) { var a = -Math.PI / 2 + dir * rnd(.15, .75), v = rnd(380, 820); add({ t: 'rect', x: x, y: H + 6, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520, s: rnd(3, 5.5), r: rnd(0, 6), vr: rnd(-9, 9), c: pick(['#ff5d73', '#ffd36b', '#58d68d', '#5ca8ff', '#b585ff', '#ffffff']), life: rnd(2.6, 4.2), fade: .3, drag: 1.1 }); } }
    cannon(0, 1, 70); cannon(W, -1, 70);
    var t = setInterval(function () { if (Date.now() > partyUntil || Hub.playing) { clearInterval(t); return; } cannon(pick([0, W]), 0, 0); cannon(Math.random() < .5 ? 0 : W, Math.random() < .5 ? 1 : -1, 22); for (var i = 0; i < 14; i++) add({ t: 'rect', x: rnd(0, W), y: -8, vx: rnd(-30, 30), vy: rnd(90, 190), s: rnd(3, 5), r: rnd(0, 6), vr: rnd(-7, 7), c: pick(['#ff5d73', '#ffd36b', '#58d68d', '#5ca8ff', '#b585ff']), life: rnd(3, 5), fade: .25 }); }, 650);
  };
  Hub.on('party', function (p) { if (p && p.until > Date.now()) Hub.party(Math.min(12000, p.until - Date.now())); });
  // The secret code: up up down down left right left right B A.
  var KON = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'], ki = 0;
  document.addEventListener('keydown', function (e) {
    var t = e.target, tag = t && t.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) { ki = 0; return; }
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k === KON[ki]) { ki++; if (ki === KON.length) { ki = 0; Hub.toast('Code accepted. Party time.'); Hub.party(9000); } } else ki = k === KON[0] ? 1 : 0;
  });

  // ---------- loop ----------
  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(now) {
    var dt = Math.min(.05, (now - last) / 1000); last = now;
    var sea = season(), hide = Hub.playing || document.hidden || reduce();
    if (cv) cv.style.display = Hub.playing ? 'none' : '';
    if (sea && !hide) { ensure(); ambientAcc += dt; var gap = 1 / Math.max(2, sea.n / 9); while (ambientAcc > gap) { ambientAcc -= gap; var np = 0; for (var q = 0; q < parts.length; q++) if (parts[q].amb) np++; if (np < sea.n) { var pp = sea.make(); pp.amb = true; add(pp); } } }
    if (cx) {
      cx.clearRect(0, 0, W, H);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i]; p.age += dt;
        if (p.sway) p.vx += Math.sin(p.age * 1.6 + p.sway) * 14 * dt;
        if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * .4 * dt; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        var gone = p.amb ? (p.y > H + 24 || p.y < -30 || p.x < -30 || p.x > W + 30 || hide && p.age > .2) : p.age > p.life;
        if (gone) { parts.splice(i, 1); continue; }
        var al = p.amb ? Math.min(1, p.age * 1.5) : (p.fade ? Math.max(0, 1 - Math.pow(p.age / p.life, 1.4) * p.fade) : 1);
        cx.globalAlpha = al * p.a; cx.fillStyle = p.c; cx.strokeStyle = p.c;
        if (p.shrink) { var o = p.s; p.s = o * Math.max(.05, 1 - p.age / p.life); DRAW[p.t](p); p.s = o; } else DRAW[p.t](p);
      }
      cx.globalAlpha = 1;
    }
    if (parts.length || (sea && !hide) || Date.now() < partyUntil) requestAnimationFrame(frame); else { running = false; if (cx) cx.clearRect(0, 0, W, H); }
  }
  function wake() { if (season()) { ensure(); kick(); } }
  Hub.on('season', wake); Hub.on('prefs', function (k) { if (k === 'seasonFx') { if (!season()) parts = parts.filter(function (p) { return !p.amb; }); wake(); } });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
  setInterval(function () { if (!running) wake(); }, 4000);
  wake();
})();
