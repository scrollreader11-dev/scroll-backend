/* Scrolls Casino: the furniture of the Owner Vault tower.
   Zones (top to bottom): Entrance + services, Command Center, Warp Hub, Armory, Party Room, Lounge.
   Nothing here is networked; world.js places the objects and handles E. This file only draws them. */
(function () {
  var SC = window.SC = window.SC || {}, A = SC.art; if (!A || !A.obj || !A.neon) return;
  var O = A.obj, OL = A.OL || '#120e2e', rr = A.rr, ell = A.ell, circ = A.circ, shadow = A.shadow, TAU = Math.PI * 2;
  function fs(c, fill, stroke, lw) { c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 3; c.stroke(); } }
  function glow(c, x, y, r, col, a) { c.save(); c.globalCompositeOperation = 'lighter'; var g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
  function rnd(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function hit(o) { return o.hit ? Math.max(0, 1 - (performance.now() - o.hit) / 900) : 0; }   // 1 -> 0 after a button press

  // ---------------------------------------------------------------- floor dressing (decals)
  O.vzone = function (c, o, t) {   // a quiet rug that marks one zone
    var x = o.x, y = o.y, w = o.w, h = o.h;
    rr(c, x - w / 2, y - h / 2, w, h, 18); c.fillStyle = 'rgba(' + (o.col || '34,16,48') + ',.62)'; c.fill();
    c.strokeStyle = 'rgba(212,166,58,.5)'; c.lineWidth = 2.5; rr(c, x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 13); c.stroke();
    c.strokeStyle = 'rgba(212,166,58,.2)'; c.lineWidth = 1.5; rr(c, x - w / 2 + 15, y - h / 2 + 15, w - 30, h - 30, 8); c.stroke();
    c.fillStyle = 'rgba(212,166,58,.7)'; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (k) { circ(c, x + k[0] * (w / 2 - 11), y + k[1] * (h / 2 - 11), 3); c.fill(); });
    if (o.title) { c.save(); c.font = '700 16px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,209,102,.8)'; c.shadowColor = 'rgba(255,170,60,.6)'; c.shadowBlur = 8; c.fillText(o.title, x, y - h / 2 + 32); c.restore(); }
  };
  O.vcarpet = function (c, o, t) {   // the long red runner down the middle of the tower
    var x = o.x, y = o.y, len = o.len;
    rr(c, x - 28, y - len, 56, len, 4); c.fillStyle = 'rgba(122,20,36,.92)'; c.fill(); c.strokeStyle = 'rgba(255,209,102,.7)'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(255,209,102,.22)'; c.lineWidth = 1.5; c.strokeRect(x - 21, y - len + 7, 42, len - 14);
    c.fillStyle = 'rgba(255,209,102,.42)'; for (var yy = y - len + 34; yy < y - 20; yy += 64) { c.beginPath(); c.moveTo(x, yy - 7); c.lineTo(x + 7, yy); c.lineTo(x, yy + 7); c.lineTo(x - 7, yy); c.closePath(); c.fill(); }
  };
  O.vpool = function (c, o, t) { glow(c, o.x, o.y, o.r || 260, o.col || '255,59,92', (o.a || 0.08) + Math.sin(t * 1.4 + o.x * 0.01 + o.y * 0.003) * 0.012); };
  O.vpad = function (c, o, t) {   // a warp pad: step on it, press E
    var x = o.x, y = o.y, col = o.col || '180,120,255', p = 0.5 + 0.5 * Math.sin(t * 2.4 + y * 0.02);
    ell(c, x, y + 2, 42, 17); c.fillStyle = 'rgba(8,4,16,.75)'; c.fill();
    ell(c, x, y, 38, 15); c.fillStyle = 'rgba(' + col + ',' + (0.14 + 0.08 * p) + ')'; c.fill(); c.strokeStyle = 'rgba(' + col + ',.95)'; c.lineWidth = 3; c.stroke();
    c.save(); ell(c, x, y, 27, 10.5); c.strokeStyle = 'rgba(' + col + ',.6)'; c.lineWidth = 2; c.setLineDash([7, 6]); c.lineDashOffset = -t * 24; c.stroke(); c.restore();
    var g = c.createLinearGradient(0, y, 0, y - 78); g.addColorStop(0, 'rgba(' + col + ',' + (0.34 + 0.12 * p) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 32, y); c.lineTo(x - 22, y - 78); c.lineTo(x + 22, y - 78); c.lineTo(x + 32, y); c.closePath(); c.fill();
    glow(c, x, y - 10, 64, col, 0.2 + 0.1 * p);
    A.label(c, o.icon || '✨', x, y - 38 + Math.sin(t * 2 + x) * 3, { size: 20, stroke: false });
    A.label(c, o.name || '', x, y + 27, { size: 12, color: '#fff', lw: 4 });
  };

  // ---------------------------------------------------------------- command center
  var RCOL = { r: '#6b3fb0', b: '#2f4fa8', c: '#b0305a', g: '#bfa970', p: '#5a44a0', w: '#b87840', l: '#1f8a96', d: '#c850a0', a: '#7d83a0', k: '#5a44c8', o: '#7a1630' };
  O.radar = function (c, o, t) {   // holo table with the live casino floor and everyone on it
    var x = o.x, y = o.y, W = 136, H = 78;
    if (!o._b && SC.dbg && SC.dbg.G) {
      var G = SC.dbg.G, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var b = cv.getContext('2d'), COLS = G[0].length, sx = W / COLS, sy = H / 44;
      for (var ty = 0; ty < 44; ty++) for (var tx = 0; tx < COLS; tx++) { var ch = G[ty][tx]; b.fillStyle = ch === '#' ? '#0a1424' : (RCOL[ch] || '#445'); b.fillRect(tx * sx, ty * sy, sx + 0.5, sy + 0.5); }
      o._b = cv;
    }
    shadow(c, x, y + 2, 78, 12);
    ell(c, x, y - 4, 74, 22); fs(c, '#241a3a', OL, 3); rr(c, x - 12, y - 34, 24, 30, 4); fs(c, '#1b1430', OL, 2.5);
    ell(c, x, y - 34, 70, 20); fs(c, '#2f2350', OL, 3); ell(c, x, y - 34, 58, 15); c.fillStyle = 'rgba(92,242,255,.18)'; c.fill();
    var hy = y - 58 + Math.sin(t * 1.6) * 2, g = c.createLinearGradient(0, y - 34, 0, hy - H / 2); g.addColorStop(0, 'rgba(92,242,255,.32)'); g.addColorStop(1, 'rgba(92,242,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - 40, y - 34); c.lineTo(x - W / 2, hy); c.lineTo(x + W / 2, hy); c.lineTo(x + 40, y - 34); c.closePath(); c.fill();
    c.save(); c.translate(x, hy - H / 2 - 6); c.globalAlpha = 0.9;
    rr(c, -W / 2 - 3, -3, W + 6, H + 6, 5); c.fillStyle = 'rgba(4,18,30,.85)'; c.fill();
    if (o._b) { c.globalAlpha = 0.78; c.drawImage(o._b, -W / 2, 0); c.globalAlpha = 0.9; }
    var P = SC.dbg && SC.dbg.players ? SC.dbg.players() : {}, n = 0, id, p;
    for (id in P) { p = P[id]; if (p.y > 44 * 48 || p.leaving) continue; n++; var px = (p.x / 3648 - 0.5) * W, py = p.y / (44 * 48) * H; c.fillStyle = '#ffd166'; circ(c, px, py, 2.6); c.fill(); c.strokeStyle = 'rgba(255,209,102,' + (0.7 - ((t * 0.9 + id * 0.17) % 1) * 0.7) + ')'; c.lineWidth = 1.5; circ(c, px, py, 3 + ((t * 0.9 + id * 0.17) % 1) * 9); c.stroke(); }
    c.fillStyle = 'rgba(160,255,255,.5)'; c.fillRect(-W / 2, ((t * 26) % H), W, 2);
    c.strokeStyle = 'rgba(92,242,255,.9)'; c.lineWidth = 2; rr(c, -W / 2 - 3, -3, W + 6, H + 6, 5); c.stroke();
    c.restore();
    glow(c, x, hy, 100, '92,242,255', 0.16);
    A.neon(c, 'LIVE CASINO', x, y - 140, '#5cf2ff', 13, t, 2);
  };
  O.shame = function (c, o, t) {   // wanted posters; opens the ban list
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 56, 9);
    rr(c, x - 50, y - 12, 100, 12, 4); fs(c, '#2a1a2a', OL, 3);
    rr(c, x - 6, y - 38, 12, 28, 2); fs(c, '#3b2339', OL, 2.5);
    rr(c, x - 54, y - 150, 108, 112, 8); fs(c, '#2a0f1a', OL, 3.5); rr(c, x - 48, y - 144, 96, 100, 5); fs(c, '#150810', 'rgba(212,166,58,.8)', 2);
    c.fillStyle = '#ff3b5c'; c.font = '700 11px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('WALL OF SHAME', x, y - 133);
    for (var i = 0; i < 4; i++) {
      var px = x - 38 + (i % 2) * 40, py = y - 120 + Math.floor(i / 2) * 36;
      rr(c, px, py, 34, 30, 3); fs(c, '#d8c9a0', OL, 2); c.fillStyle = '#4a3b2a'; circ(c, px + 17, py + 11, 6); c.fill(); c.beginPath(); c.arc(px + 17, py + 30, 11, Math.PI, 0); c.fill();
      c.save(); c.translate(px + 17, py + 15); c.rotate(-0.4); c.fillStyle = 'rgba(255,59,92,.92)'; c.fillRect(-16, -5, 32, 10); c.fillStyle = '#fff'; c.font = '700 8px Fredoka, system-ui, sans-serif'; c.fillText('BANNED', 0, 0.5); c.restore();
    }
    glow(c, x, y - 90, 90, '255,59,92', 0.16 + 0.05 * Math.sin(t * 2));
    A.label(c, '🔨', x, y - 160, { size: 18, stroke: false });
  };
  O.cctv = function (c, o, t) {   // six security feeds
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 70, 9); rr(c, x - 64, y - 14, 128, 14, 4); fs(c, '#241a3a', OL, 3); rr(c, x - 8, y - 34, 16, 22, 2); fs(c, '#1b1430', OL, 2);
    rr(c, x - 64, y - 126, 128, 94, 7); fs(c, '#14102a', OL, 3.5);
    for (var i = 0; i < 6; i++) {
      var sx = x - 59 + (i % 3) * 40, sy = y - 121 + Math.floor(i / 3) * 44;
      rr(c, sx, sy, 37, 40, 3); fs(c, '#03120b', OL, 1.5);
      c.save(); c.beginPath(); c.rect(sx, sy, 37, 40); c.clip();
      var feed = SC.cams && SC.cams.feeds[i];
      if (feed && feed.at && performance.now() - feed.at < 4000) {   // a real, live picture from the casino floor
        c.drawImage(feed.cv, 67, 0, 185, 200, sx, sy, 37, 40);
        c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(sx, sy + ((t * 22 + i * 9) % 40), 37, 3);
        c.fillStyle = '#9dffbf'; c.font = '700 6px Fredoka, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('CAM ' + (i + 1), sx + 3, sy + 6);
        if (Math.sin(t * 4 + i) > 0) { c.fillStyle = '#ff5c6c'; circ(c, sx + 32, sy + 5, 1.8); c.fill(); }
        c.restore(); continue;
      }
      for (var k = 0; k < 3; k++) { var bx = sx + 6 + ((rnd(i * 7 + k) * 30 + t * (6 + k * 3) * (k % 2 ? -1 : 1) + 60) % 30); c.fillStyle = 'rgba(80,255,150,' + (0.35 + 0.2 * k / 3) + ')'; circ(c, bx, sy + 26 - k * 5, 3.2); c.fill(); c.fillRect(bx - 2.4, sy + 28 - k * 5, 4.8, 8); }
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(sx, sy + ((t * 22 + i * 9) % 40), 37, 4); c.restore();
      c.fillStyle = '#ff5c6c'; c.font = '700 6px Fredoka, system-ui, sans-serif'; c.textAlign = 'left'; c.fillText('CAM ' + (i + 1), sx + 3, sy + 6); if (Math.sin(t * 4 + i) > 0) { circ(c, sx + 32, sy + 5, 1.8); c.fill(); }
    }
    glow(c, x, y - 80, 84, '60,255,160', 0.1);
  };
  O.serverrack = function (c, o, t) {
    var x = o.x, y = o.y; shadow(c, x, y + 2, 34, 7);
    rr(c, x - 27, y - 112, 54, 112, 5); fs(c, '#1b1430', OL, 3.5);
    for (var i = 0; i < 7; i++) {
      var yy = y - 104 + i * 15; rr(c, x - 22, yy, 44, 12, 2); fs(c, '#2c2250', OL, 1.5);
      for (var l = 0; l < 4; l++) { var on = Math.sin(t * (3 + i) + l * 2.1 + o.x) > -0.2; c.fillStyle = on ? (l === 3 ? '#ffb703' : '#2bd576') : '#16301f'; c.fillRect(x - 17 + l * 7, yy + 4, 4, 4); }
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(x + 4, yy + 4, 14, 1.5); c.fillRect(x + 4, yy + 7, 14, 1.5);
    }
    glow(c, x, y - 60, 52, '43,213,118', 0.08);
  };

  // ---------------------------------------------------------------- fun machines (press E)
  var FX = { fireworks: ['#ff5c8a', '255,92,138', 'FIREWORKS'], party: ['#ffd166', '255,209,102', 'PARTY'], disco: ['#b185ff', '177,133,255', 'DISCO'], storm: ['#7fb2ff', '127,178,255', 'STORM'], snow: ['#bfeaff', '191,234,255', 'SNOW'], rain: ['#ffcf3f', '255,207,63', 'COIN RAIN'], raffle: ['#2bd576', '43,213,118', 'RAFFLE'] };
  O.fxm = function (c, o, t) {
    var x = o.x, y = o.y, f = FX[o.k] || FX.party, col = f[0], rgb = f[1], h = hit(o);
    shadow(c, x, y + 2, 38, 8);
    rr(c, x - 30, y - 24, 60, 24, 6); fs(c, '#241a3a', OL, 3); c.fillStyle = col; c.globalAlpha = 0.9; c.fillRect(x - 26, y - 8, 52, 3); c.globalAlpha = 1;
    rr(c, x - 6, y - 19, 12, 7, 2); fs(c, col, OL, 2);   // the button
    var top = y - 26;
    if (o.k === 'fireworks') {
      [-1, 0, 1].forEach(function (k, i) { c.save(); c.translate(x + k * 14, top); c.rotate(k * 0.22); rr(c, -6, -34, 12, 34, 3); fs(c, '#d9486a', OL, 2.5); c.fillStyle = '#ffd166'; c.fillRect(-6, -22, 12, 3); circ(c, 0, -36 - h * 8, 4); c.fillStyle = '#ffb703'; c.fill(); c.restore(); });
      var sp = Math.sin(t * 14) > 0.4 ? 1 : 0.4; glow(c, x, top - 40, 26, '255,200,80', 0.3 * sp + h * 0.5);
    } else if (o.k === 'party') {
      c.save(); c.translate(x - 4, top - 4); c.rotate(-0.7 - h * 0.12); rr(c, -9, -40, 18, 40, 4); fs(c, '#ffc93c', OL, 2.5); ell(c, 0, -41, 12, 4); fs(c, '#7a4a00', OL, 2); c.restore();
      var cols = ['#ff5c8a', '#ffd166', '#5cf2ff', '#7dff9a', '#b185ff'];
      for (var i = 0; i < 12; i++) { var a = (t * 0.7 + i * 0.083 + rnd(i) * 0.3) % 1; c.save(); c.translate(x + 14 + (rnd(i + 3) - 0.3) * 40 * (0.4 + a), top - 40 - a * 34 + a * a * 40); c.rotate(t * 3 + i); c.fillStyle = cols[i % 5]; c.globalAlpha = 1 - a * 0.7; c.fillRect(-2, -3, 4, 6); c.restore(); }
    } else if (o.k === 'disco') {
      c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(x, top); c.lineTo(x, top - 24); c.stroke();
      circ(c, x, top - 44, 21); var g = c.createRadialGradient(x - 7, top - 52, 2, x, top - 44, 22); g.addColorStop(0, '#fff'); g.addColorStop(1, '#8e8ab0'); fs(c, g, OL, 3);
      c.save(); circ(c, x, top - 44, 20); c.clip(); for (var r = 0; r < 6; r++) for (var q = 0; q < 6; q++) { var ph = Math.sin(t * 3 + r * 1.3 + q * 2.1); if (ph > 0.55) { c.fillStyle = ['#ff6ec7', '#5cf2ff', '#ffd166'][(r + q) % 3]; c.globalAlpha = 0.85; c.fillRect(x - 20 + q * 7, top - 64 + r * 7, 6, 6); } } c.globalAlpha = 1; c.restore();
      glow(c, x, top - 44, 50, '177,133,255', 0.2 + h * 0.4);
    } else if (o.k === 'storm') {
      var cy = top - 44 + Math.sin(t * 1.5) * 3; c.fillStyle = '#3d4566'; [[-14, 0, 13], [0, -7, 16], [15, 0, 13], [3, 5, 14]].forEach(function (q) { circ(c, x + q[0], cy + q[1], q[2]); c.fill(); }); c.strokeStyle = OL; c.lineWidth = 2.5; c.stroke();
      for (var d = 0; d < 6; d++) { var a2 = (t * 1.6 + d * 0.17) % 1; c.fillStyle = 'rgba(160,200,255,' + (1 - a2) + ')'; c.fillRect(x - 18 + d * 7, cy + 14 + a2 * 22, 2, 6); }
      if (Math.sin(t * 2.3) > 0.92 || h > 0.3) { c.strokeStyle = '#fff6a8'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 2, cy + 8); c.lineTo(x - 5, cy + 22); c.lineTo(x + 3, cy + 22); c.lineTo(x - 4, cy + 38); c.stroke(); glow(c, x, cy, 60, '255,246,168', 0.35); }
    } else if (o.k === 'snow') {
      circ(c, x, top - 30, 25); c.fillStyle = 'rgba(190,230,255,.22)'; c.fill(); c.strokeStyle = 'rgba(235,250,255,.9)'; c.lineWidth = 3; c.stroke();
      c.save(); circ(c, x, top - 30, 24); c.clip(); for (var s = 0; s < 14; s++) { var a3 = (t * 0.35 + rnd(s) ) % 1; c.fillStyle = 'rgba(255,255,255,.95)'; circ(c, x - 18 + rnd(s + 9) * 36 + Math.sin(t * 2 + s) * 3, top - 56 + a3 * 52, 1.8); c.fill(); }
      c.fillStyle = '#f4fbff'; c.beginPath(); c.arc(x, top - 6, 22, Math.PI, 0); c.fill(); c.restore();
    } else if (o.k === 'rain') {
      rr(c, x - 22, top - 42, 44, 16, 4); fs(c, '#7a5a1a', OL, 2.5); ell(c, x, top - 42, 22, 6); fs(c, '#ffcf3f', OL, 2);
      for (var k2 = 0; k2 < 8; k2++) { var a4 = (t * 0.9 + k2 * 0.125) % 1; c.fillStyle = '#ffcf3f'; c.strokeStyle = OL; c.lineWidth = 1.5; circ(c, x - 16 + (k2 % 4) * 11 + Math.sin(k2) * 3, top - 36 + a4 * 40, 4.5); c.fill(); c.stroke(); }
    } else if (o.k === 'raffle') {
      c.save(); c.translate(x, top - 32); c.rotate(t * 0.9); rr(c, -20, -20, 40, 40, 20); c.fillStyle = 'rgba(190,255,220,.25)'; c.fill(); c.strokeStyle = 'rgba(220,255,235,.95)'; c.lineWidth = 3; c.stroke();
      for (var tk = 0; tk < 6; tk++) { c.save(); c.rotate(tk * 1.1 + 0.4); c.fillStyle = ['#ff5c8a', '#ffd166', '#5cf2ff'][tk % 3]; c.fillRect(-4 + (tk % 3) * 3, -12 + (tk % 2) * 8, 9, 5); c.restore(); } c.restore();
    }
    glow(c, x, top - 30, 56, rgb, 0.1 + h * 0.5);
    A.neon(c, f[2], x, y - 100, col, 11, t, x * 0.3);
  };

  // ---------------------------------------------------------------- armory
  O.rack = function (c, o, t) {   // hammers on the wall rack
    var x = o.x, y = o.y; shadow(c, x, y + 2, 56, 8);
    rr(c, x - 50, y - 12, 100, 12, 4); fs(c, '#2a1a2a', OL, 3);
    rr(c, x - 46, y - 118, 92, 108, 6); fs(c, '#4a2a1a', OL, 3.5); c.fillStyle = 'rgba(0,0,0,.18)'; for (var i = 0; i < 4; i++) c.fillRect(x - 44, y - 104 + i * 26, 88, 2);
    rr(c, x - 46, y - 96, 92, 7, 2); fs(c, '#d4a63a', OL, 2);
    [-27, 0, 27].forEach(function (dx, i) { c.save(); c.translate(x + dx, y - 92 + (i === 1 ? 4 : 0)); c.scale(0.46, 0.46); c.rotate(i === 1 ? 0.0 : (i - 1) * 0.08); A.hammerShape(c, false); c.restore(); });
    glow(c, x, y - 70, 70, '255,170,60', 0.1);
  };
  O.tcase = function (c, o, t) {   // glass trophy cabinet
    var x = o.x, y = o.y; shadow(c, x, y + 2, 44, 8);
    rr(c, x - 38, y - 124, 76, 124, 6); fs(c, '#2a1a2a', OL, 3.5); rr(c, x - 33, y - 119, 66, 108, 3); fs(c, '#120a18', null);
    var g = c.createLinearGradient(x - 30, y - 118, x + 30, y - 12); g.addColorStop(0, 'rgba(255,230,160,.18)'); g.addColorStop(1, 'rgba(255,230,160,.03)'); c.fillStyle = g; c.fillRect(x - 33, y - 119, 66, 108);
    c.fillStyle = '#d4a63a'; c.fillRect(x - 33, y - 64, 66, 3); c.fillRect(x - 33, y - 92, 66, 3);
    c.fillStyle = '#ffc93c'; c.beginPath(); c.moveTo(x - 12, y - 104); c.lineTo(x + 12, y - 104); c.lineTo(x + 8, y - 88); c.lineTo(x - 8, y - 88); c.closePath(); fs(c, '#ffc93c', OL, 2); c.fillRect(x - 2, y - 88, 4, 8); c.fillRect(x - 8, y - 80, 16, 4);
    [-18, 0, 18].forEach(function (dx, i) { circ(c, x + dx, y - 74, 6); fs(c, ['#ff5c8a', '#5cf2ff', '#7dff9a'][i], OL, 2); });
    A.label(c, '🏆', x, y - 40, { size: 18, stroke: false }); A.label(c, '🔨', x - 16, y - 28, { size: 11, stroke: false }); A.label(c, '⭐', x + 16, y - 28, { size: 11, stroke: false });
    if (Math.sin(t * 1.3 + x) > 0.9) A.label(c, '✦', x - 14, y - 100, { size: 12, color: '#fff', stroke: false });
    glow(c, x, y - 70, 54, '255,220,120', 0.12);
  };
  O.obelisk = function (c, o, t) {
    var x = o.x, y = o.y, p = 0.55 + 0.45 * Math.sin(t * 1.8 + x); shadow(c, x, y + 2, 28, 7);
    rr(c, x - 20, y - 14, 40, 14, 3); fs(c, '#2a1a2a', OL, 3);
    c.beginPath(); c.moveTo(x - 13, y - 14); c.lineTo(x - 8, y - 124); c.lineTo(x, y - 140); c.lineTo(x + 8, y - 124); c.lineTo(x + 13, y - 14); c.closePath(); fs(c, '#1d1626', OL, 3);
    c.fillStyle = 'rgba(255,59,92,' + (0.35 + 0.4 * p) + ')'; for (var i = 0; i < 5; i++) { c.fillRect(x - 3, y - 34 - i * 18, 6, 2.5); c.fillRect(x - 6 + (i % 2) * 6, y - 40 - i * 18, 3, 8); }
    glow(c, x, y - 80, 70, '255,59,92', 0.1 * p + 0.05);
  };

  // ---------------------------------------------------------------- lounge
  O.aquarium = function (c, o, t) {
    var x = o.x, y = o.y, W = 176;
    shadow(c, x, y + 2, 96, 10);
    rr(c, x - W / 2, y - 26, W, 26, 5); fs(c, '#2a1a2a', OL, 3.5); c.fillStyle = '#d4a63a'; c.fillRect(x - W / 2 + 4, y - 24, W - 8, 2.5);
    rr(c, x - W / 2 + 4, y - 108, W - 8, 82, 6); var g = c.createLinearGradient(0, y - 108, 0, y - 26); g.addColorStop(0, '#2fe0e8'); g.addColorStop(1, '#0a4f7a'); fs(c, g, OL, 3.5);
    c.save(); rr(c, x - W / 2 + 6, y - 106, W - 12, 78, 5); c.clip();
    c.fillStyle = '#e8d49a'; c.fillRect(x - W / 2, y - 40, W, 14);
    for (var p = 0; p < 6; p++) { var px = x - W / 2 + 18 + p * 28; c.strokeStyle = ['#1fa04a', '#2bd576', '#0f7a3a'][p % 3]; c.lineWidth = 3; c.beginPath(); c.moveTo(px, y - 36); c.quadraticCurveTo(px + Math.sin(t * 1.4 + p) * 7, y - 54, px + Math.sin(t * 1.4 + p + 1) * 5, y - 66 - (p % 3) * 8); c.stroke(); }
    for (var f = 0; f < 4; f++) {
      var sp = 14 + f * 7, dir = f % 2 ? -1 : 1, fx = ((t * sp + f * 60) % (W + 40)) - 20, fyy = y - 62 - f * 11 + Math.sin(t * 2 + f) * 5, px2 = dir > 0 ? x - W / 2 + fx : x + W / 2 - fx;
      c.save(); c.translate(px2, fyy); c.scale(dir, 1); ell(c, 0, 0, 9, 5); c.fillStyle = ['#ff8a4c', '#ffd166', '#ff5c8a', '#b185ff'][f]; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke();
      c.beginPath(); c.moveTo(-8, 0); c.lineTo(-15, -5); c.lineTo(-15, 5); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; circ(c, 4, -1, 1.4); c.fill(); c.restore();
    }
    for (var b = 0; b < 7; b++) { var ba = (t * 0.4 + b * 0.14) % 1; c.fillStyle = 'rgba(255,255,255,' + (0.7 - ba * 0.6) + ')'; circ(c, x - 50 + (b * 29) % 100 + Math.sin(t * 3 + b) * 3, y - 34 - ba * 66, 1.8); c.fill(); }
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - W / 2 + 12, y - 102, 4, 62);
    glow(c, x, y - 66, 120, '47,224,232', 0.16);
  };
  O.fire = function (c, o, t) {
    var x = o.x, y = o.y; shadow(c, x, y + 2, 66, 9);
    rr(c, x - 60, y - 96, 120, 96, 6); fs(c, '#4b4258', OL, 3.5); c.fillStyle = 'rgba(0,0,0,.2)'; for (var r = 0; r < 4; r++) for (var q = 0; q < 6; q++) c.fillRect(x - 56 + q * 19 + (r % 2) * 8, y - 90 + r * 20, 16, 2);
    rr(c, x - 66, y - 104, 132, 12, 4); fs(c, '#7a5a3a', OL, 3);
    c.beginPath(); c.moveTo(x - 38, y); c.lineTo(x - 38, y - 44); c.quadraticCurveTo(x, y - 72, x + 38, y - 44); c.lineTo(x + 38, y); c.closePath(); fs(c, '#0e0710', OL, 3);
    rr(c, x - 26, y - 12, 52, 9, 4); fs(c, '#6b3a1e', OL, 2);
    for (var i = 0; i < 5; i++) { var fx = x - 20 + i * 10, hh = 26 + Math.sin(t * 7 + i * 1.7) * 7 + (i === 2 ? 10 : 0), sw = Math.sin(t * 5 + i) * 3; c.beginPath(); c.moveTo(fx - 6, y - 10); c.quadraticCurveTo(fx - 7 + sw, y - 10 - hh * 0.6, fx + sw, y - 12 - hh); c.quadraticCurveTo(fx + 7 + sw, y - 10 - hh * 0.6, fx + 6, y - 10); c.closePath(); c.fillStyle = i % 2 ? '#ff8a1c' : '#ff4d2a'; c.fill(); }
    glow(c, x, y - 30, 120, '255,120,40', 0.24 + Math.sin(t * 9) * 0.03);
  };
  O.bookcase = function (c, o, t) {
    var x = o.x, y = o.y; shadow(c, x, y + 2, 56, 8);
    rr(c, x - 50, y - 124, 100, 124, 4); fs(c, '#5a3418', OL, 3.5);
    var cols = ['#a3132a', '#1d5fa8', '#2a8a4a', '#d4a63a', '#6a2a9a', '#c85a1a', '#2a7a8a'];
    for (var s = 0; s < 4; s++) {
      var sy = y - 118 + s * 28; c.fillStyle = '#2a1608'; c.fillRect(x - 46, sy, 92, 25); var bx = x - 44;
      for (var k = 0; bx < x + 42; k++) { var bw = 5 + Math.floor(rnd(o.x + s * 31 + k) * 6), bh = 16 + Math.floor(rnd(s * 9 + k + o.x) * 8); c.fillStyle = cols[Math.floor(rnd(k * 3 + s + o.x) * 7)]; c.fillRect(bx, sy + 25 - bh, bw, bh); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(bx + 1, sy + 25 - bh + 2, 1.5, bh - 4); bx += bw + 1; }
      c.fillStyle = '#7a4a22'; c.fillRect(x - 46, sy + 25, 92, 3);
    }
    glow(c, x, y - 64, 64, '255,170,90', 0.06);
  };
  O.goldpile = function (c, o, t) {
    var x = o.x, y = o.y; shadow(c, x, y + 2, 54, 9);
    var g = c.createLinearGradient(0, y - 52, 0, y); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#b87400');
    c.beginPath(); c.moveTo(x - 50, y); c.quadraticCurveTo(x - 38, y - 40, x - 8, y - 48); c.quadraticCurveTo(x + 30, y - 52, x + 50, y); c.closePath(); fs(c, g, OL, 3);
    for (var i = 0; i < 12; i++) { var cx = x - 36 + rnd(i + o.x) * 72, cy = y - 8 - rnd(i * 3 + o.x) * 32 * (1 - Math.abs(cx - x) / 56); ell(c, cx, cy, 7, 3.2); fs(c, '#ffd84a', '#8a5a00', 1.5); }
    [[-26, -2], [-8, -2], [-17, -12]].forEach(function (b) { rr(c, x + b[0] - 10, y + b[1] - 9, 20, 9, 2); fs(c, '#ffc93c', OL, 2); });
    if (Math.sin(t * 2.2 + x) > 0.8) A.label(c, '✦', x - 12 + Math.sin(t) * 20, y - 40, { size: 14, color: '#fff', stroke: false });
    glow(c, x, y - 24, 70, '255,200,60', 0.16);
  };
  O.lamp = function (c, o, t) {
    var x = o.x, y = o.y; shadow(c, x, y + 1, 14, 4); c.strokeStyle = OL; c.lineWidth = 5; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 86); c.stroke(); c.strokeStyle = '#d4a63a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 86); c.stroke();
    c.beginPath(); c.moveTo(x - 16, y - 68); c.lineTo(x + 16, y - 68); c.lineTo(x + 10, y - 96); c.lineTo(x - 10, y - 96); c.closePath(); fs(c, '#fff0c0', OL, 2.5);
    glow(c, x, y - 80, 110, '255,214,140', 0.2);
  };
})();
