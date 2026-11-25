/* ============================================================
   Scrolls Casino 2D — art. Everything is drawn in code (no sprites),
   chunky outlined cartoon style. Exposes window.SC.art.
   Coordinates: characters & objects are drawn from their base point
   (feet / floor footprint bottom-center).
   ============================================================ */
(function () {
  var SC = window.SC = window.SC || {};
  var A = SC.art = {};
  var OL = A.OL = '#1b1636';
  var TAU = Math.PI * 2;

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function ell(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
  function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); }
  function fs(c, f, st, lw) { if (f) { c.fillStyle = f; c.fill(); } if (st) { c.strokeStyle = st; c.lineWidth = lw || 3; c.lineJoin = 'round'; c.stroke(); } }
  function hex2rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(function (x) { return x + x; }).join(''); var n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function shade(h, a) { var r = hex2rgb(h); var f = function (v) { return Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a); }; return 'rgb(' + f(r[0]) + ',' + f(r[1]) + ',' + f(r[2]) + ')'; }
  function shadow(c, x, y, rx, ry) { c.fillStyle = 'rgba(10,6,30,.28)'; ell(c, x, y, rx, ry); c.fill(); }
  A.rr = rr; A.ell = ell; A.circ = circ; A.shade = shade; A.shadow = shadow;

  // Representative flat color for a body value (used for shading / ears / previews).
  var MAT_BASE = { 'm:gold': '#ffc93c', 'm:chrome': '#c9d3e6', 'm:lava': '#e8461e', 'm:galaxy': '#3b2a8a', 'm:rainbow': '#ff6ec7' };
  function baseHex(v) { return MAT_BASE[v] || (/^#/.test(v || '') ? v : '#3fa9ff'); }
  A.baseHex = baseHex;
  function bodyPaint(c, v, x, y, w, h, t) {
    if (v === 'm:gold') { var g = c.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.35, '#ffcf3f'); g.addColorStop(0.7, '#e09b12'); g.addColorStop(1, '#ffd966'); return g; }
    if (v === 'm:chrome') { var g2 = c.createLinearGradient(x, y, x, y + h); g2.addColorStop(0, '#ffffff'); g2.addColorStop(0.45, '#aeb8cc'); g2.addColorStop(0.55, '#6f7a92'); g2.addColorStop(1, '#dfe6f3'); return g2; }
    if (v === 'm:lava') { var p = (Math.sin(t * 2) + 1) / 2; var g3 = c.createLinearGradient(x, y + h, x + w * 0.3, y); g3.addColorStop(0, '#ffdd33'); g3.addColorStop(0.25 + p * 0.15, '#ff6a00'); g3.addColorStop(0.7, '#b3170c'); g3.addColorStop(1, '#5a0a08'); return g3; }
    if (v === 'm:galaxy') { var g4 = c.createRadialGradient(x + w * 0.3, y + h * 0.3, 2, x + w / 2, y + h / 2, w); g4.addColorStop(0, '#8a5cff'); g4.addColorStop(0.5, '#3b1f8a'); g4.addColorStop(1, '#0d0a2e'); return g4; }
    if (v === 'm:rainbow') { var hue = (t * 70) % 360; var g5 = c.createLinearGradient(x, y, x + w, y + h); for (var i = 0; i <= 4; i++) g5.addColorStop(i / 4, 'hsl(' + ((hue + i * 70) % 360) + ',90%,62%)'); return g5; }
    return baseHex(v);
  }
  function bodyExtras(c, v, x, y, w, h, t) { // drawn clipped inside the body
    if (v === 'm:galaxy') {
      for (var i = 0; i < 14; i++) { var sx = x + ((i * 37) % w), sy = y + ((i * 53) % h); var tw = (Math.sin(t * 3 + i) + 1) / 2; c.fillStyle = 'rgba(255,255,255,' + (0.3 + tw * 0.7) + ')'; circ(c, sx, sy, i % 4 === 0 ? 1.8 : 1); c.fill(); }
    } else if (v === 'm:lava') {
      c.strokeStyle = 'rgba(255,230,120,.7)'; c.lineWidth = 1.6;
      for (var j = 0; j < 4; j++) { var yy = y + h * (0.3 + j * 0.17) + Math.sin(t * 2 + j) * 2; c.beginPath(); c.moveTo(x, yy); c.quadraticCurveTo(x + w / 2, yy - 6 + j * 3, x + w, yy + 2); c.stroke(); }
    } else if (v === 'm:gold' || v === 'm:chrome') {
      var sh = ((t * 0.6) % 2) * (w + 40) - 20; c.fillStyle = 'rgba(255,255,255,.55)';
      c.beginPath(); c.moveTo(x + sh, y); c.lineTo(x + sh + 10, y); c.lineTo(x + sh - 6, y + h); c.lineTo(x + sh - 16, y + h); c.closePath(); c.fill();
    }
  }

  // ---------------------------------------------------------------- CHARACTER
  // look = {skin, body, hat, acc, trail} (draw keys, e.g. skin:'cat', body:'#3fa9ff')
  // o = {dir 0↓ 1← 2→ 3↑, moving, walk (phase), t, scale, lookAt:{x,y}, blink, shadow, alpha, dance}
  // Each skin is a small spec of optional hooks; anything a skin doesn't define uses the gim default.
  function tail(c, g, col, w, len, wag) {
    var tx = g.dir === 1 ? 14 : g.dir === 2 ? -14 : 14, tw = Math.sin(g.t * 4) * wag;
    c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = w + 5;
    c.beginPath(); c.moveTo(tx * 0.6, g.by + g.H - 8); c.quadraticCurveTo(tx * 1.6, g.by + g.H - 14 + tw, tx * 1.5, g.by + g.H - 8 - len + tw); c.stroke();
    c.strokeStyle = col; c.lineWidth = w; c.stroke();
    return { x: tx * 1.5, y: g.by + g.H - 8 - len + tw };
  }
  function wings(c, g, col, span, flap) {
    var fl = Math.sin(g.t * flap) * 0.22;
    [-1, 1].forEach(function (k) { c.save(); c.translate(k * 15, g.by + 18); c.rotate(k * (0.25 + fl)); c.beginPath(); c.moveTo(0, 0); c.lineTo(k * span, -span * 0.75); c.lineTo(k * span * 0.8, -span * 0.12); c.lineTo(k * span * 1.08, span * 0.2); c.lineTo(k * span * 0.55, span * 0.32); c.closePath(); fs(c, col, OL, 2.5); c.restore(); });
  }
  var SKIN = {
    gim: { cheeks: true },
    cat: {
      cheeks: true,
      back: function (c, g) { tail(c, g, g.base, 4.5, 18, 4); },
      top: function (c, g) { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 6, g.by + 4); c.lineTo(k * 17, g.by - 10); c.lineTo(k * 18, g.by + 10); c.closePath(); fs(c, g.base, OL, 3); c.beginPath(); c.moveTo(k * 9, g.by + 4); c.lineTo(k * 15.5, g.by - 4); c.lineTo(k * 15.5, g.by + 6); c.closePath(); c.fillStyle = '#ff9ec7'; c.fill(); }); },
      mouth: function (c, g, ex, my) { c.strokeStyle = OL; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex - 4, my - 1); c.quadraticCurveTo(ex - 2, my + 2, ex, my - 1); c.quadraticCurveTo(ex + 2, my + 2, ex + 4, my - 1); c.stroke(); c.beginPath(); c.moveTo(ex - 2, my - 4); c.lineTo(ex + 2, my - 4); c.lineTo(ex, my - 2); c.closePath(); c.fillStyle = '#ff7eb6'; c.fill(); c.lineWidth = 1.3; [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(ex + k * 8, my - 2); c.lineTo(ex + k * 18, my - 4); c.moveTo(ex + k * 8, my); c.lineTo(ex + k * 18, my + 1); c.stroke(); }); return true; },
    },
    fox: {
      back: function (c, g) { var e = tail(c, g, g.base, 10, 20, 5); circ(c, e.x, e.y, 5.5); fs(c, '#fff', OL, 2); },
      top: function (c, g) { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 4, g.by + 5); c.lineTo(k * 16, g.by - 14); c.lineTo(k * 19, g.by + 10); c.closePath(); fs(c, g.base, OL, 3); c.beginPath(); c.moveTo(k * 8, g.by + 4); c.lineTo(k * 15, g.by - 6); c.lineTo(k * 16, g.by + 6); c.closePath(); c.fillStyle = '#fff4e6'; c.fill(); }); },
      detail: function (c, g) { if (g.dir === 3) return; c.fillStyle = '#fff4e6'; c.beginPath(); c.moveTo(g.bx, g.by + g.H * 0.55); c.quadraticCurveTo(g.ex, g.by + g.H * 0.3, g.bx + g.W, g.by + g.H * 0.55); c.lineTo(g.bx + g.W, g.by + g.H); c.lineTo(g.bx, g.by + g.H); c.closePath(); c.fill(); },
      mouth: function (c, g, ex, my) { ell(c, ex, my - 4, 3, 2.2); c.fillStyle = OL; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(ex, my - 2); c.lineTo(ex, my); c.moveTo(ex - 3, my + 1); c.quadraticCurveTo(ex, my + 3, ex + 3, my + 1); c.stroke(); return true; },
    },
    bear: {
      top: function (c, g) { [-1, 1].forEach(function (k) { circ(c, k * 14, g.by + 3, 8); fs(c, g.base, OL, 3); circ(c, k * 14, g.by + 3, 4); c.fillStyle = shade(g.base, -0.25); c.fill(); }); },
      mouth: function (c, g, ex, my) { ell(c, ex, my - 1, 7, 5); c.fillStyle = shade(g.base, 0.35); c.fill(); ell(c, ex, my - 3, 2.6, 1.8); c.fillStyle = OL; c.fill(); return true; },
    },
    panda: {
      top: function (c, g) { [-1, 1].forEach(function (k) { circ(c, k * 14, g.by + 3, 8); fs(c, '#16161e', OL, 3); }); },
      eyesUnder: function (c, g, ex, ey) { [-1, 1].forEach(function (k) { c.save(); c.translate(k * 8 + ex, ey + 1); c.rotate(k * -0.5); ell(c, 0, 0, 7.5, 9); c.fillStyle = '#16161e'; c.fill(); c.restore(); }); },
      mouth: function (c, g, ex, my) { ell(c, ex, my - 3, 2.6, 1.8); c.fillStyle = OL; c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.arc(ex, my - 2, 3, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); return true; },
    },
    bunny: {
      cheeks: true,
      top: function (c, g) { [-1, 1].forEach(function (k) { c.save(); c.translate(k * 8, g.by + 4); c.rotate(k * 0.18 + Math.sin(g.t * 2 + k) * 0.05); ell(c, 0, -14, 6.5, 16); fs(c, g.base, OL, 3); ell(c, 0, -13, 3, 11); c.fillStyle = '#ff9ec7'; c.fill(); c.restore(); }); },
      mouth: function (c, g, ex, my) { c.strokeStyle = OL; c.lineWidth = 2.4; c.beginPath(); c.arc(ex, my - 3, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); c.fillStyle = '#fff'; c.fillRect(ex - 3, my + 1, 6, 4); c.lineWidth = 1.5; c.strokeRect(ex - 3, my + 1, 6, 4); return true; },
    },
    pig: {
      cheeks: true,
      back: function (c, g) { if (g.dir === 0) return; var tx = g.dir === 1 ? 17 : g.dir === 2 ? -17 : 0; c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.arc(tx, g.by + g.H - 12, 4, 0, Math.PI * 1.6); c.stroke(); },
      top: function (c, g) { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 7, g.by + 3); c.lineTo(k * 17, g.by - 4); c.lineTo(k * 16, g.by + 9); c.closePath(); fs(c, shade(g.base, -0.08), OL, 2.5); }); },
      mouth: function (c, g, ex, my) { ell(c, ex, my - 3, 8, 5.5); fs(c, shade(g.base, 0.3), OL, 2); c.fillStyle = shade(g.base, -0.45); ell(c, ex - 2.8, my - 3, 1.5, 2.2); c.fill(); ell(c, ex + 2.8, my - 3, 1.5, 2.2); c.fill(); return true; },
    },
    duck: {
      feet: '#ff9f1c',
      top: function (c, g) { c.strokeStyle = OL; c.lineWidth = 2.5; c.lineCap = 'round'; [-4, 0, 4].forEach(function (d, i) { c.beginPath(); c.moveTo(d, g.by + 1); c.quadraticCurveTo(d + 3, g.by - 6, d + 6 - i, g.by - 8); c.stroke(); }); },
      front: function (c, g) { if (g.dir === 3) return; [-1, 1].forEach(function (k) { if ((g.dir === 1 && k === 1) || (g.dir === 2 && k === -1)) return; c.save(); c.translate(k * 19, g.by + 26); c.rotate(k * (0.2 + Math.sin(g.t * 3) * 0.1)); ell(c, 0, 0, 5, 9); fs(c, shade(g.base, -0.12), OL, 2.5); c.restore(); }); },
      mouth: function (c, g, ex, my) { ell(c, ex, my - 2, 9, 4.5); fs(c, '#ff9f1c', OL, 2.2); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ex - 7, my - 1.5); c.lineTo(ex + 7, my - 1.5); c.stroke(); return true; },
    },
    frog: {
      dims: { W: 44, H: 36, r: 17 },
      detail: function (c, g) { if (g.dir !== 3) { ell(c, g.side * 4, g.by + g.H * 0.85, 15, 9); c.fillStyle = shade(g.base, 0.45); c.fill(); } },
      face: function (c, g, ex, lx, ly) { [-1, 1].forEach(function (k) { circ(c, k * 11 + ex, g.by + 1, 8.5); fs(c, g.base, OL, 3); circ(c, k * 11 + ex, g.by + 1, 6); c.fillStyle = '#fff'; c.fill(); if (!g.blink) { circ(c, k * 11 + ex + lx, g.by + 1.5 + ly, 3.2); c.fillStyle = '#111'; c.fill(); } else { c.fillStyle = g.base; ell(c, k * 11 + ex, g.by + 1, 6.5, 6.5); c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(k * 11 + ex - 5, g.by + 1); c.lineTo(k * 11 + ex + 5, g.by + 1); c.stroke(); } }); return true; },
      mouth: function (c, g, ex, my) { c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.arc(ex, my - 8, 12, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); return true; },
    },
    penguin: {
      feet: '#ff9f1c',
      detail: function (c, g) { if (g.dir !== 3) { ell(c, g.side * 4, g.by + g.H * 0.62, 13, 15); c.fillStyle = '#f7f7fb'; c.fill(); } },
      mouth: function (c, g, ex, my) { c.beginPath(); c.moveTo(ex - 4, my - 3); c.lineTo(ex + 4, my - 3); c.lineTo(ex, my + 2); c.closePath(); fs(c, '#ff9f1c', OL, 2); return true; },
    },
    robot: {
      dims: { r: 7 },
      top: function (c, g) { c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(0, g.by); c.lineTo(0, g.by - 11); c.stroke(); circ(c, 0, g.by - 13, 4.5); fs(c, (Math.floor(g.t * 2) % 2) ? '#ff3b5c' : '#ffd166', OL, 2.5); },
      detail: function (c, g) { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(g.bx, g.by + g.H * 0.55, g.W, 3); },
      face: function (c, g, ex, lx, ly) { rr(c, -14 + ex * 0.6, g.by + 7, 28, 17, 5); fs(c, '#0f1a2e', OL, 2.5); c.fillStyle = '#5cf2ff'; c.shadowColor = '#5cf2ff'; c.shadowBlur = 6; var eh = g.blink ? 1.5 : 7; rr(c, -9 + ex + lx, g.by + 15.5 - eh / 2 + ly, 6, eh, 2); c.fill(); rr(c, 3 + ex + lx, g.by + 15.5 - eh / 2 + ly, 6, eh, 2); c.fill(); c.shadowBlur = 0; return true; },
      mouth: function () { return true; },
    },
    ghost: {
      float: true, noFeet: true, alpha: 0.88,
      shape: function (c, g) { c.beginPath(); c.moveTo(g.bx, g.by + 18); c.arc(0, g.by + 19, 19, Math.PI, 0); c.lineTo(g.bx + g.W, g.by + g.H - 2); for (var wv = 0; wv < 4; wv++) { var wx = g.bx + g.W - (wv + 0.5) * (g.W / 4); c.quadraticCurveTo(wx + 4, g.by + g.H + 6 + Math.sin(g.t * 5 + wv) * 2, wx - g.W / 8, g.by + g.H - 2); } c.closePath(); },
    },
    alien: {
      top: function (c, g) { [-1, 1].forEach(function (k) { c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(k * 6, g.by + 3); c.quadraticCurveTo(k * 12, g.by - 8, k * 10, g.by - 14); c.stroke(); circ(c, k * 10, g.by - 15, 4.5); fs(c, '#b8ff5c', OL, 2.5); }); },
      face: function (c, g, ex, lx, ly) { [-1, 1].forEach(function (k) { c.save(); c.translate(k * 8 + ex, g.by + 16); c.rotate(k * 0.35); ell(c, 0, 0, 5.5, g.blink ? 1 : 8); c.fillStyle = '#0b0b16'; c.fill(); if (!g.blink) { circ(c, -1.5 + lx * 0.6, -3 + ly, 1.8); c.fillStyle = '#fff'; c.fill(); } c.restore(); }); return true; },
    },
    dino: {
      back: function (c, g) { tail(c, g, shade(g.base, -0.1), 8, 12, 4); },
      top: function (c, g) { for (var sp = 0; sp < 4; sp++) { var sx = -12 + sp * 8; c.beginPath(); c.moveTo(sx - 5, g.by + 4); c.lineTo(sx, g.by - 7); c.lineTo(sx + 5, g.by + 4); c.closePath(); fs(c, shade(g.base, -0.25), OL, 2.5); } },
    },
    imp: {
      cheeks: true,
      back: function (c, g) { var e = tail(c, g, g.base, 4.5, 18, 4); c.beginPath(); c.moveTo(e.x - 5, e.y); c.lineTo(e.x + 5, e.y); c.lineTo(e.x, e.y - 10); c.closePath(); fs(c, '#e63946', OL, 2); wings(c, g, '#5a1030', 18, 8); },
      front: function (c, g) { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 7, g.by + 3); c.quadraticCurveTo(k * 13, g.by - 6, k * 9, g.by - 12); c.lineTo(k * 4, g.by + 2); c.closePath(); fs(c, '#ffe1a8', OL, 2.5); }); },
    },
    mushroom: {
      dims: { W: 30, H: 28, r: 10, top: 16 }, faceY: 12,
      top: function (c, g) { /* cap drawn after body */ },
      after: function (c, g) {
        var cy = g.by + 2; c.beginPath(); c.moveTo(-25, cy + 12); c.quadraticCurveTo(-27, cy - 16, 0, cy - 18); c.quadraticCurveTo(27, cy - 16, 25, cy + 12); c.quadraticCurveTo(0, cy + 18, -25, cy + 12); c.closePath();
        c.fillStyle = bodyPaint(c, g.body, -25, cy - 18, 50, 30, g.t); c.fill(); c.strokeStyle = OL; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#fffbea'; [[-13, cy - 4, 4.5], [5, cy - 9, 5], [15, cy + 2, 3.5], [-3, cy + 4, 3]].forEach(function (p) { if (g.dir === 3 && p[1] > cy) return; circ(c, p[0] + g.side * 2, p[1], p[2]); c.fill(); });
      },
      bodyColor: '#f6ecd2', capTop: -18,
    },
    slime: {
      dims: { W: 44, H: 34, r: 16 }, noFeet: true, alpha: 0.9, cheeks: true,
      shape: function (c, g) { var sq = Math.sin(g.t * 4) * (g.moving ? 3 : 1.5); var w = g.W / 2 + sq, top = g.by + 4 - sq; c.beginPath(); c.moveTo(-w, g.by + g.H); c.quadraticCurveTo(-w - 2, top + 6, -w * 0.4, top); c.quadraticCurveTo(0, top - 6, w * 0.4, top); c.quadraticCurveTo(w + 2, top + 6, w, g.by + g.H); c.quadraticCurveTo(w * 0.5, g.by + g.H + 3, 0, g.by + g.H); c.quadraticCurveTo(-w * 0.5, g.by + g.H + 3, -w, g.by + g.H); c.closePath(); },
      detail: function (c, g) { c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, -10, g.by + 12, 4); c.fill(); circ(c, -4, g.by + 9, 2); c.fill(); var d = (g.t * 0.6) % 1; c.fillStyle = 'rgba(255,255,255,.2)'; circ(c, 12, g.by + g.H - 4 + d * 4, 2.5); c.fill(); },
      faceY: 4,
    },
    snowman: {
      noShape: true, faceY: -4, feet: '#3a2a1a',
      shape: function (c, g) { c.beginPath(); c.arc(0, g.by + 30, 17, 0, TAU); c.moveTo(13, g.by + 12); c.arc(0, g.by + 12, 13, 0, TAU); },
      front: function (c, g) { [-1, 1].forEach(function (k) { c.strokeStyle = '#6b4423'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(k * 15, g.by + 26); c.lineTo(k * 28, g.by + 16 + Math.sin(g.t * 3 + k) * 2); c.lineTo(k * 31, g.by + 12); c.stroke(); }); if (g.dir !== 3) { c.fillStyle = '#1b1636'; [26, 34, 42].forEach(function (yy) { circ(c, g.side * 3, g.by + yy - 4, 2.2); c.fill(); }); } },
      mouth: function (c, g, ex, my) { c.beginPath(); c.moveTo(ex, my - 9.5); c.lineTo(ex + (g.side || 0.35) * 14 + 3, my - 8); c.lineTo(ex, my - 6); c.closePath(); fs(c, '#ff8a2a', OL, 1.8); c.fillStyle = '#1b1636'; [-4, -1.5, 1.5, 4].forEach(function (d, i) { circ(c, ex + d, my - 2.5 + (i === 0 || i === 3 ? -1 : 0), 1.1); c.fill(); }); return true; },
      bodyColor: null,
    },
    pumpkin: {
      dims: { W: 46, H: 38, r: 18 },
      top: function (c, g) { rr(c, -3, g.by - 8, 6, 11, 2); fs(c, '#4f7a2a', OL, 2.5); c.strokeStyle = '#3b6b2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(2, g.by - 4); c.quadraticCurveTo(10, g.by - 10, 12, g.by - 3); c.stroke(); },
      detail: function (c, g) { c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; [-12, 0, 12].forEach(function (d) { c.beginPath(); c.moveTo(d, g.by + 2); c.quadraticCurveTo(d * 1.4, g.by + g.H / 2, d, g.by + g.H - 1); c.stroke(); }); },
      face: function (c, g, ex) { var gl = g.blink ? '#7a4a00' : '#ffd23f'; c.fillStyle = gl; c.shadowColor = '#ffb703'; c.shadowBlur = 8; [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 9 + ex - 5, g.by + 19); c.lineTo(k * 9 + ex + 5, g.by + 19); c.lineTo(k * 9 + ex, g.by + 11); c.closePath(); c.fill(); }); c.shadowBlur = 0; return true; },
      mouth: function (c, g, ex, my) { c.fillStyle = '#ffd23f'; c.shadowColor = '#ffb703'; c.shadowBlur = 8; c.beginPath(); c.moveTo(ex - 11, my - 3); for (var i = 0; i <= 6; i++) c.lineTo(ex - 11 + i * 3.7, my - 3 + (i % 2 ? 4 : 0)); c.lineTo(ex + 11, my - 3); c.quadraticCurveTo(ex, my + 9, ex - 11, my - 3); c.closePath(); c.fill(); c.shadowBlur = 0; return true; },
    },
    shark: {
      back: function (c, g) { if (g.dir === 0) return; var tx = g.dir === 1 ? 18 : g.dir === 2 ? -18 : 0, sw = Math.sin(g.t * 5) * 3; c.beginPath(); c.moveTo(tx * 0.7, g.by + g.H - 14); c.lineTo(tx * 1.5, g.by + g.H - 26 + sw); c.lineTo(tx * 1.25, g.by + g.H - 12); c.lineTo(tx * 1.5, g.by + g.H + sw * 0.5); c.closePath(); fs(c, shade(g.base, -0.1), OL, 2.5); },
      top: function (c, g) { c.beginPath(); c.moveTo(-6, g.by + 3); c.quadraticCurveTo(-1, g.by - 14, 7, g.by - 15); c.quadraticCurveTo(3, g.by - 5, 7, g.by + 3); c.closePath(); fs(c, shade(g.base, -0.12), OL, 2.5); },
      detail: function (c, g) { if (g.dir !== 3) { c.fillStyle = '#eef3fb'; c.beginPath(); c.moveTo(g.bx, g.by + g.H * 0.62); c.quadraticCurveTo(0, g.by + g.H * 0.42, g.bx + g.W, g.by + g.H * 0.62); c.lineTo(g.bx + g.W, g.by + g.H); c.lineTo(g.bx, g.by + g.H); c.closePath(); c.fill(); } c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5; [0, 4, 8].forEach(function (d) { c.beginPath(); c.moveTo(g.bx + 4 + d * 0.3, g.by + 18 + d); c.lineTo(g.bx + 8 + d * 0.3, g.by + 16 + d); c.stroke(); }); },
      mouth: function (c, g, ex, my) { c.beginPath(); c.moveTo(ex - 9, my - 3); c.quadraticCurveTo(ex, my + 7, ex + 9, my - 3); c.closePath(); fs(c, '#3a0d18', OL, 2); c.fillStyle = '#fff'; for (var i = 0; i < 5; i++) { c.beginPath(); c.moveTo(ex - 8 + i * 3.6, my - 2.5); c.lineTo(ex - 6.2 + i * 3.6, my + 0.8); c.lineTo(ex - 4.4 + i * 3.6, my - 2.5); c.closePath(); c.fill(); } return true; },
    },
    octopus: {
      noFeet: true, float: true,
      shape: function (c, g) { var b = g.by + g.H - 8; c.beginPath(); c.moveTo(g.bx, b); c.bezierCurveTo(g.bx - 2, g.by - 6, g.bx + g.W + 2, g.by - 6, g.bx + g.W, b); for (var i = 0; i < 4; i++) { var x0 = g.bx + g.W - i * (g.W / 4), x1 = x0 - g.W / 4, w = Math.sin(g.t * 5 + i) * 3; c.quadraticCurveTo(x0 - 2 + w, b + 14, x0 - g.W / 8 + w, b + 12); c.quadraticCurveTo(x1 + 3, b + 8, x1, b); } c.closePath(); },
      detail: function (c, g) { c.fillStyle = 'rgba(255,255,255,.25)'; [[-10, 6], [8, 3], [12, 12]].forEach(function (p) { circ(c, p[0], g.by + p[1], 2.5); c.fill(); }); },
    },
    skeleton: {
      face: function (c, g, ex, lx, ly) { [-1, 1].forEach(function (k) { ell(c, k * 8 + ex, g.by + 15, 6, g.blink ? 2 : 7); c.fillStyle = '#16122b'; c.fill(); if (!g.blink) { circ(c, k * 8 + ex + lx * 0.6, g.by + 15 + ly * 0.6, 1.8); c.fillStyle = '#ff5c6c'; c.fill(); } }); return true; },
      mouth: function (c, g, ex, my) { c.beginPath(); c.moveTo(ex - 2.5, my - 6); c.lineTo(ex + 2.5, my - 6); c.lineTo(ex, my - 9); c.closePath(); c.fillStyle = '#16122b'; c.fill(); rr(c, ex - 8, my - 3, 16, 6, 2); fs(c, '#f4f1e8', OL, 1.8); c.strokeStyle = OL; c.lineWidth = 1; for (var i = 1; i < 4; i++) { c.beginPath(); c.moveTo(ex - 8 + i * 4, my - 3); c.lineTo(ex - 8 + i * 4, my + 3); c.stroke(); } return true; },
      detail: function (c, g) { c.strokeStyle = 'rgba(20,10,40,.22)'; c.lineWidth = 2; for (var i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-11 + i, g.by + 32 + i * 2.5); c.quadraticCurveTo(0, g.by + 35 + i * 2.5, 11 - i, g.by + 32 + i * 2.5); c.stroke(); } },
    },
    ninja: {
      back: function (c, g) { var fl = Math.sin(g.t * 6) * 3, tx = g.dir === 1 ? 14 : g.dir === 2 ? -14 : 12; c.strokeStyle = '#d00000'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(tx * 0.8, g.by + 10); c.quadraticCurveTo(tx * 1.5, g.by + 6 + fl, tx * 2, g.by + 12 + fl); c.moveTo(tx * 0.8, g.by + 11); c.quadraticCurveTo(tx * 1.4, g.by + 14 - fl, tx * 1.8, g.by + 20 - fl); c.stroke(); },
      detail: function (c, g) { c.fillStyle = '#d00000'; c.fillRect(g.bx, g.by + 6, g.W, 5); if (g.dir !== 3) { c.fillStyle = '#1b1b2a'; c.fillRect(g.bx, g.by + 21, g.W, g.H); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(g.bx, g.by + 21, g.W, 2); } },
      face: function (c, g, ex, lx, ly) { rr(c, -14 + ex, g.by + 11, 28, 10, 5); c.fillStyle = '#f2d2b6'; c.fill(); [-1, 1].forEach(function (k) { if (g.blink) { c.fillStyle = OL; c.fillRect(k * 7 + ex - 3, g.by + 15.5, 6, 1.6); return; } c.save(); c.translate(k * 7 + ex, g.by + 16); c.rotate(k * -0.18); ell(c, 0, 0, 3.6, 3); c.fillStyle = '#fff'; c.fill(); circ(c, lx * 0.5, ly * 0.4, 1.8); c.fillStyle = '#111'; c.fill(); c.restore(); }); return true; },
      mouth: function () { return true; },
    },
    astro: {
      back: function (c, g) { if (g.dir === 0) return; rr(c, g.dir === 3 ? -14 : (g.dir === 1 ? 10 : -24), g.by + 14, g.dir === 3 ? 28 : 14, 24, 5); fs(c, '#c9d3e6', OL, 2.5); },
      top: function (c, g) { c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.moveTo(10, g.by + 4); c.lineTo(14, g.by - 8); c.stroke(); circ(c, 14, g.by - 9, 2.6); fs(c, '#ff3b5c', OL, 1.5); },
      detail: function (c, g) { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(g.bx, g.by + g.H * 0.66, g.W, 3); rr(c, -5 + g.side * 3, g.by + 30, 10, 6, 2); c.fillStyle = '#ff3b5c'; c.fill(); },
      face: function (c, g, ex, lx, ly) { rr(c, -15 + ex * 0.5, g.by + 5, 30, 21, 9); var gr = c.createLinearGradient(0, g.by + 5, 0, g.by + 26); gr.addColorStop(0, '#2b3f7a'); gr.addColorStop(1, '#0b1030'); fs(c, gr, OL, 2.5); c.fillStyle = 'rgba(255,255,255,.55)'; rr(c, -11 + ex * 0.5, g.by + 8, 8, 4, 2); c.fill(); if (!g.blink) { c.fillStyle = 'rgba(160,220,255,.9)'; circ(c, -5 + ex + lx * 0.5, g.by + 17, 2); c.fill(); circ(c, 5 + ex + lx * 0.5, g.by + 17, 2); c.fill(); } return true; },
      mouth: function () { return true; },
    },
    knight: {
      top: function (c, g) { var sw = Math.sin(g.t * 3) * 2; c.beginPath(); c.moveTo(-2, g.by + 2); c.quadraticCurveTo(-8 + sw, g.by - 14, 6 + sw, g.by - 18); c.quadraticCurveTo(4, g.by - 6, 4, g.by + 2); c.closePath(); fs(c, '#e63946', OL, 2.5); },
      detail: function (c, g) { c.fillStyle = '#9aa4b8'; c.fillRect(g.bx, g.by, g.W, 26); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(g.bx + 5, g.by + 2, 5, 22); c.fillStyle = '#7d8699'; c.fillRect(g.bx, g.by + 24, g.W, 3); },
      face: function (c, g, ex, lx) { rr(c, -13 + ex, g.by + 12, 26, 6, 3); c.fillStyle = '#10131f'; c.fill(); if (!g.blink) { c.fillStyle = '#5cf2ff'; c.shadowColor = '#5cf2ff'; c.shadowBlur = 5; c.fillRect(-8 + ex + lx * 0.5, g.by + 13.5, 4, 3); c.fillRect(4 + ex + lx * 0.5, g.by + 13.5, 4, 3); c.shadowBlur = 0; } c.fillStyle = 'rgba(0,0,0,.35)'; for (var i = 0; i < 4; i++) c.fillRect(-6 + ex + i * 4, g.by + 20, 2, 4); return true; },
      mouth: function () { return true; },
    },
    unicorn: {
      cheeks: true,
      back: function (c, g) { var cols = ['#ff6ec7', '#ffd166', '#5cf2ff', '#b185ff']; var sx = g.dir === 1 ? 10 : g.dir === 2 ? -10 : 12; cols.forEach(function (col, i) { c.strokeStyle = col; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx * 0.4, g.by + 2 + i * 4); c.quadraticCurveTo(sx * 1.6, g.by + 10 + i * 5 + Math.sin(g.t * 3 + i) * 2, sx * 1.3, g.by + 26 + i * 4); c.stroke(); }); },
      top: function (c, g) { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 8, g.by + 4); c.lineTo(k * 14, g.by - 6); c.lineTo(k * 16, g.by + 7); c.closePath(); fs(c, g.base, OL, 2.5); }); var hx = g.side * 3; c.beginPath(); c.moveTo(hx - 5, g.by + 3); c.lineTo(hx, g.by - 20); c.lineTo(hx + 5, g.by + 3); c.closePath(); var gr = c.createLinearGradient(0, g.by - 20, 0, g.by + 3); gr.addColorStop(0, '#fff6c9'); gr.addColorStop(1, '#ffc93c'); fs(c, gr, OL, 2.5); c.strokeStyle = 'rgba(150,90,0,.5)'; c.lineWidth = 1.2; [-14, -8, -2].forEach(function (yy) { c.beginPath(); c.moveTo(hx - 3, g.by + yy + 4); c.lineTo(hx + 3, g.by + yy); c.stroke(); }); var sp = (g.t * 2) % 3; if (sp < 0.6) A.label(c, '✦', hx + 8, g.by - 18, { size: 9, color: '#fff', stroke: false }); },
    },
    dragon: {
      back: function (c, g) { tail(c, g, shade(g.base, -0.1), 9, 14, 4); wings(c, g, shade(g.base, -0.3), 24, 5); },
      top: function (c, g) { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 6, g.by + 3); c.quadraticCurveTo(k * 11, g.by - 8, k * 8, g.by - 13); c.lineTo(k * 2, g.by + 2); c.closePath(); fs(c, '#f4ecd6', OL, 2.3); }); for (var sp = 0; sp < 3; sp++) { var sx = -7 + sp * 7; c.beginPath(); c.moveTo(sx - 4, g.by + 3); c.lineTo(sx, g.by - 4); c.lineTo(sx + 4, g.by + 3); c.closePath(); fs(c, '#ffb703', OL, 2); } },
      detail: function (c, g) { if (g.dir !== 3) { ell(c, g.side * 4, g.by + g.H * 0.75, 12, 12); c.fillStyle = shade(g.base, 0.4); c.fill(); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1.5; [0, 5, 10].forEach(function (d) { c.beginPath(); c.moveTo(g.side * 4 - 9, g.by + 26 + d); c.lineTo(g.side * 4 + 9, g.by + 26 + d); c.stroke(); }); } },
      mouth: function (c, g, ex, my) { c.fillStyle = OL; ell(c, ex - 3, my - 4, 1.4, 1); c.fill(); ell(c, ex + 3, my - 4, 1.4, 1); c.fill(); c.strokeStyle = OL; c.lineWidth = 2.2; c.beginPath(); c.arc(ex, my - 3, 5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); if ((g.t % 5) < 0.7) { var p = (g.t % 5) / 0.7; c.fillStyle = 'rgba(255,' + Math.round(140 + 80 * (1 - p)) + ',40,' + (1 - p) + ')'; circ(c, ex + (g.side || 0) * 12, my + 6 + p * 8, 3 + p * 6); c.fill(); } return true; },
    },
  };
  A.SKINS = Object.keys(SKIN);


  // ---------------------------------------------------------------- CUSTOM SPRITES (made in the Sprite Studio)
  // A.CUSTOM['c:<id>'] = { w, h, pal: ['#rrggbb', ...], px: 'string of palette chars (0 = empty)', back: '' | px, eyes: bool, feet: bool }
  var CUST_CH = '0123456789abcdefghijklmnopqrstuv';
  A.SEASON_HATS = { xmas: 'santa', halloween: 'wizard', thanksgiving: 'cowboy', newyear: 'party', stpatricks: 'top', easter: 'flowers', july4: 'top', summer: 'cap' };
  A.CUSTOM = A.CUSTOM || {};
  A.OVR = { skin: {}, hat: {}, acc: {} }; A.noOvr = false; // built-in items Scrollreader11 redrew in the Studio
  function ovr(type, k) { if (A.noOvr || !k) return null; var o = A.OVR[type] && A.OVR[type][k]; return o && A.CUSTOM[o] ? o : null; }
  A.ovr = ovr;
  var custCache = {}, custLast = 0, custBusy = false;
  A.loadCustom = function (force) {
    if (custBusy || (!force && Date.now() - custLast < 8000)) return; custBusy = true; custLast = Date.now();
    try {
      var base = ''; try { base = (localStorage.getItem('sh_api') || '').replace(/\/+$/, ''); } catch (e) {}
      fetch(base + '/api/casino/sprites', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (d) {
        custBusy = false; if (!d || !d.sprites) return;
        for (var k in d.sprites) { A.CUSTOM[k] = d.sprites[k]; A.custInvalidate(k); }
        if (d.overrides) A.OVR = { skin: d.overrides.skin || {}, hat: d.overrides.hat || {}, acc: d.overrides.acc || {} };
      }).catch(function () { custBusy = false; });
    } catch (e) { custBusy = false; }
  };
  A.custInvalidate = function (k) { for (var ck in custCache) if (ck.indexOf(k + '|') === 0) delete custCache[ck]; };
  function custSprite(k) { var s = A.CUSTOM[k]; if (!s) { if (k && k.charAt(1) === ':') A.loadCustom(); return null; } return s; }
  // Builds (and caches) a canvas for one frame, plus the first/last rows that have pixels.
  function custFi(s, t) { var n = 1 + (s.frames ? s.frames.length : 0); return n > 1 ? Math.floor((t || 0) * (s.fps || 6)) % n : 0; }
  A.custFi = custFi;
  function custFrame(k, back, fi) {
    fi = fi || 0; var key = k + (back ? '|b' : '|f' + fi); if (custCache[key]) return custCache[key];
    var s = A.CUSTOM[k]; if (!s) return null; var px = back && s.back ? s.back : fi > 0 && s.frames && s.frames[fi - 1] ? s.frames[fi - 1] : s.px; if (!px) return null;
    var w = s.w || 32, h = s.h || 32, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var cnt = {}, main = 1, mainN = 0;
    var x = cv.getContext('2d'), img = x.createImageData(w, h), top = h, bot = -1;
    for (var i = 0; i < w * h; i++) {
      var ci = CUST_CH.indexOf(px.charAt(i)); if (ci <= 0) continue; cnt[ci] = (cnt[ci] || 0) + 1; if (cnt[ci] > mainN && (s.pal[ci - 1] || '').toLowerCase() !== '#1b1636') { mainN = cnt[ci]; main = ci; }
      var col = s.pal[ci - 1] || '#ff00ff', n = parseInt(col.slice(1), 16), yy = (i / w) | 0;
      img.data[i * 4] = (n >> 16) & 255; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255;
      if (yy < top) top = yy; if (yy > bot) bot = yy;
    }
    x.putImageData(img, 0, 0);
    return (custCache[key] = { cv: cv, w: w, h: h, top: top, bot: bot, main: s.pal[main - 1] || '#3fa9ff' });
  }
  A.custFrame = custFrame;
  // Easy animation effects (no extra drawing needed): applied around the sprite's center.
  function custDraw(c, f, x, y, size, flip, s, t) {
    var fx = s && s.fx, h = size * f.h / f.w, cx = x + size / 2, cy = y + h / 2; t = t || 0;
    c.save(); c.imageSmoothingEnabled = false;
    if (fx && fx !== 'none') {
      if (fx === 'bounce') c.translate(0, -Math.abs(Math.sin(t * 6)) * 4);
      else if (fx === 'float') c.translate(0, Math.sin(t * 2.4) * 3.5);
      else if (fx === 'shake') c.translate(Math.sin(t * 40) * 1.2, Math.cos(t * 33) * 0.8);
      else if (fx === 'wiggle') { c.translate(cx, cy + h / 2); c.rotate(Math.sin(t * 7) * 0.13); c.translate(-cx, -cy - h / 2); }
      else if (fx === 'spin') { c.translate(cx, 0); c.scale(Math.cos(t * 3) || 0.01, 1); c.translate(-cx, 0); }
      else if (fx === 'pulse') { var ps = 1 + Math.sin(t * 5) * 0.07; c.translate(cx, cy); c.scale(ps, ps); c.translate(-cx, -cy); }
      else if (fx === 'rainbow') { try { c.filter = 'hue-rotate(' + Math.round((t * 120) % 360) + 'deg) saturate(1.3)'; } catch (e) {} }
      else if (fx === 'glow') { c.shadowColor = f.main || '#fff'; c.shadowBlur = 10 + Math.sin(t * 4) * 6; }
    }
    c.translate(x, y); if (flip) { c.translate(size, 0); c.scale(-1, 1); }
    c.drawImage(f.cv, 0, 0, size, h);
    if (fx === 'glow') c.drawImage(f.cv, 0, 0, size, h);
    c.restore();
    if (fx === 'sparkle') {
      c.save(); c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 6;
      for (var i = 0; i < 4; i++) { var ph = (t * 0.9 + i * 0.27) % 1, sa = Math.sin(ph * Math.PI); if (sa < 0.05) continue;
        var sx = x + ((Math.sin(i * 7.3 + Math.floor(t * 0.9 + i * 0.27) * 3.1) + 1) / 2) * size, sy = y + ((Math.cos(i * 4.1 + Math.floor(t * 0.9 + i * 0.27) * 2.3) + 1) / 2) * h, r = 3.5 * sa;
        c.beginPath(); c.moveTo(sx, sy - r); c.lineTo(sx + r / 3.5, sy - r / 3.5); c.lineTo(sx + r, sy); c.lineTo(sx + r / 3.5, sy + r / 3.5); c.lineTo(sx, sy + r); c.lineTo(sx - r / 3.5, sy + r / 3.5); c.lineTo(sx - r, sy); c.lineTo(sx - r / 3.5, sy - r / 3.5); c.closePath(); c.fill(); }
      c.restore();
    }
  }
  setTimeout(function () { A.loadCustom(true); }, 0);
  A.isCustom = function (k) { return typeof k === 'string' && k.charAt(0) === 'c' && k.charAt(1) === ':'; };
  function drawCustomGim(c, g, cs, k, look, o, dir, t, bob) {
    var back = dir === 3, fi0 = back ? 0 : custFi(cs, t), f = (back && cs.back ? custFrame(k, true) : custFrame(k, false, fi0)) || custFrame(k, false); if (!f) return;
    var size = 44, x0 = -size / 2, y0 = g.by + g.H - size + 2, cell = size / f.w, flip = !back && g.side < -0.3;
    if (look.acc === 'wings') wings(c, g, '#ffffff', 22, 3);
    if (look.acc === 'butterfly' || look.acc === 'firewings' || look.acc === 'aura' || look.acc === 'orbs') A.fxBack(c, g, look.acc, t);
    if (cs.feet !== false) {
      var ph = o.moving ? Math.sin(o.walk || 0) : o.dance ? Math.sin(t * 7) : 0, fc = shade(f.main || '#3fa9ff', -0.4);
      ell(c, -8, -3 - Math.max(0, ph) * 3, 7, 4.5); fs(c, fc, OL, 2.5); ell(c, 8, -3 - Math.max(0, -ph) * 3, 7, 4.5); fs(c, fc, OL, 2.5);
    }
    var mfx = cs.fx === 'bounce' || cs.fx === 'float' || cs.fx === 'shake', dsp = mfx ? { fx: 'none' } : cs;
    c.save(); if (cs.fx === 'bounce') c.translate(0, -Math.abs(Math.sin(t * 6)) * 4); else if (cs.fx === 'float') c.translate(0, Math.sin(t * 2.4) * 3.5); else if (cs.fx === 'shake') c.translate(Math.sin(t * 40) * 1.2, Math.cos(t * 33) * 0.8);
    if (back && !cs.back) { c.save(); try { c.filter = 'brightness(0.78)'; } catch (e) {} custDraw(c, f, x0, y0, size, true, dsp, t); c.restore(); }
    else custDraw(c, f, x0, y0, size, flip, dsp, t);
    var f0 = custFrame(k, false) || f, headY = y0 + f0.top * cell; // where the hat goes (from frame 1 so it doesn't jump)
    if (!back && cs.eyes) {
      var eyeY = headY + 13, ex = g.side * 4, lx = g.side * 2.2, ly = dir === 0 ? 1 : 0;
      [-1, 1].forEach(function (kk) {
        var cx = kk * 7 + ex;
        if (g.blink) { c.strokeStyle = OL; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 4, eyeY + 1); c.lineTo(cx + 4, eyeY + 1); c.stroke(); return; }
        ell(c, cx, eyeY, 5, 6); fs(c, '#fff', OL, 2); circ(c, cx + lx, eyeY + ly + 0.5, 2.8); c.fillStyle = '#16122b'; c.fill();
        circ(c, cx + lx + 1, eyeY + ly - 0.8, 1); c.fillStyle = '#fff'; c.fill();
      });
    }
    if (!back) A.drawAcc(c, look.acc, headY, g.side * 5, dir, t, '#3fa9ff');
    else if (look.acc === 'scarf' || look.acc === 'chain' || look.acc === 'medal') A.drawAcc(c, look.acc, headY, 0, 3, t, '#3fa9ff');
    if (look.acc === 'orbs' || look.acc === 'pet') A.fxFront(c, g, look.acc, t);
    var hat = (look.hat && look.hat !== 'none') ? look.hat : (!o.noSeason && A.SEASON_HATS[A.season]) || '';
    A.drawHat(c, hat, headY, g.side, dir, t);
    c.restore();
  }
  A.drawGim = function (c, x, y, look, o) {
    if (look && look.acc && !A.isCustom(look.acc) && ovr('acc', look.acc)) look = Object.assign({}, look, { acc: ovr('acc', look.acc) });
    o = o || {}; look = look || {};
    var custK = A.isCustom(look.skin) ? look.skin : ovr('skin', look.skin || 'gim'), custS = custK ? custSprite(custK) : null;
    var skin = SKIN[look.skin] ? look.skin : 'gim', S = SKIN[skin], body = look.body || '#3fa9ff', t = o.t || 0, dir = o.dir || 0;
    var s = o.scale || 1;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    var bob = o.moving ? -Math.abs(Math.sin(o.walk || 0)) * 3.5 : Math.sin(t * 2.2) * 1.1;
    if (S.float) bob = Math.sin(t * 3) * 2.5 - 5;
    var tilt = 0, sqx = 1, sqy = 1, idle = !o.moving && !o.dance && !o.still;
    var side0 = o.side != null ? Math.max(-1, Math.min(1, o.side)) : null; // smooth facing for diagonals
    if (o.moving && !o.dance) { // lean into the direction you walk + a little squash on each step
      var st0 = Math.abs(Math.sin(o.walk || 0)); sqx = 1 + st0 * 0.035; sqy = 1 - st0 * 0.035;
      tilt = (side0 != null ? side0 : dir === 1 ? -1 : dir === 2 ? 1 : 0) * 0.075;
    } else if (idle) { // standing still: breathe, sway, and every few seconds do a little hop or stretch
      tilt = Math.sin(t * 1.15) * 0.028;
      var ip = (t * 0.16) % 1;
      if (ip < 0.06) { var hp = ip / 0.06; bob -= Math.sin(hp * Math.PI) * 6; sqy = 1 + Math.sin(hp * Math.PI) * 0.06; sqx = 1 - Math.sin(hp * Math.PI) * 0.04; }
      else if (ip > 0.5 && ip < 0.56) { var sp2 = (ip - 0.5) / 0.06; sqy = 1 + Math.sin(sp2 * Math.PI) * 0.08; sqx = 1 - Math.sin(sp2 * Math.PI) * 0.05; }
      else { sqy = 1 + Math.sin(t * 2.2) * 0.012; sqx = 1 - Math.sin(t * 2.2) * 0.01; }
    }
    if (o.dance) { bob = -Math.abs(Math.sin(t * 7)) * 7; tilt = Math.sin(t * 3.5) * 0.18; }
    if (o.shadow !== false) shadow(c, 0, 0, S.float ? 13 : 17, 5);
    if (tilt) c.rotate(tilt);
    if (sqx !== 1 || sqy !== 1) c.scale(sqx, sqy);
    if (side0 != null && (dir === 0 || dir === 3)) c.scale(1 - Math.abs(side0) * 0.07, 1); // a 3/4 turn looks a bit narrower
    var base = baseHex(body);
    var D = S.dims || {};
    var W = D.W || 38, H = D.H || 40;
    var g = { skin: skin, body: body, base: base, t: t, dir: dir, side: dir === 1 ? -1 : dir === 2 ? 1 : 0, W: W, H: H, bx: -W / 2, by: -H - 4 + bob - (D.top || 0), blink: o.blink, moving: o.moving, walk: o.walk || 0 };
    if (skin === 'mushroom') g.by = -H - 4 + bob - 16;
    var bodyTop = skin === 'mushroom' ? g.by + 16 : g.by; // where the drawn body rect starts
    if (side0 != null && (dir === 0 || dir === 3)) g.side = side0 * 0.85;
    if (o.blink == null && idle !== null) { var bk = ((t * 0.29) + (t * 0.071 % 1) * 0.0) % 1; g.blink = bk < 0.03; }
    g.ex = g.side * 5;
    if (custS) { drawCustomGim(c, g, custS, custK, look, o, dir, t, bob); c.restore(); return; }

    // --- behind body
    if (look.acc === 'cape' && dir !== 3) { c.beginPath(); c.moveTo(-15, g.by + 22); c.lineTo(15, g.by + 22); c.lineTo(21 - g.side * 4, -2 + bob * 0.3); c.lineTo(-21 - g.side * 4, -2 + bob * 0.3); c.closePath(); fs(c, '#c1121f', OL, 3); }
    if (look.acc === 'wings') wings(c, g, '#ffffff', 22, 3);
    if (look.acc === 'butterfly' || look.acc === 'firewings' || look.acc === 'aura' || look.acc === 'orbs') A.fxBack(c, g, look.acc, t);
    if (S.back) S.back(c, g);
    // --- feet
    if (!S.noFeet) {
      var ph = o.moving ? Math.sin(o.walk || 0) : o.dance ? Math.sin(t * 7) : 0, fc = S.feet || shade(base, -0.45);
      if (skin === 'mushroom' || skin === 'snowman') fc = S.feet || '#a08a62';
      ell(c, -8, -3 - Math.max(0, ph) * 3, 7, 4.5); fs(c, fc, OL, 2.5);
      ell(c, 8, -3 - Math.max(0, -ph) * 3, 7, 4.5); fs(c, fc, OL, 2.5);
    }
    if (S.top) S.top(c, g);

    // --- body
    c.save();
    var bpath = function () {
      if (S.shape) return S.shape(c, g);
      if (skin === 'mushroom') return rr(c, -W / 2, bodyTop, W, H, D.r || 10);
      rr(c, g.bx, g.by, W, H, D.r != null ? D.r : 15);
    };
    if (S.alpha) c.globalAlpha *= S.alpha;
    bpath();
    var paint = skin === 'mushroom' ? S.bodyColor : bodyPaint(c, body, g.bx, g.by, W, H, t);
    c.fillStyle = paint; c.fill();
    c.save(); c.clip();
    if (skin !== 'mushroom') bodyExtras(c, body, g.bx, g.by, W, H, t);
    c.fillStyle = 'rgba(20,10,60,.16)'; c.fillRect(-40, g.by + H * 0.68 + (skin === 'snowman' ? 10 : 0), 80, H + 30); // bottom shade
    c.fillStyle = 'rgba(255,255,255,.28)'; ell(c, g.bx + W * 0.3, bodyTop + H * 0.2, W * 0.22, H * 0.12); c.fill(); // gloss
    if (S.detail) S.detail(c, g);
    c.restore();
    bpath(); c.strokeStyle = OL; c.lineWidth = 3; c.lineJoin = 'round'; c.stroke();
    c.restore();
    if (S.after) S.after(c, g);

    // --- face
    var fy = S.faceY || 0;
    c.save(); c.translate(0, fy);
    if (dir !== 3) {
      var ex = g.ex, eyeY = g.by + 15, lx, ly;
      if (o.lookAt) { var dd = Math.hypot(o.lookAt.x, o.lookAt.y) || 1; lx = o.lookAt.x / dd * 2.4; ly = o.lookAt.y / dd * 2; }
      else { lx = g.side * 2.2; ly = dir === 0 ? 1 : 0; }
      if (idle && !o.lookAt) { var lk = Math.sin(t * 0.45) + Math.sin(t * 0.23) * 0.6; lx += Math.max(-1.6, Math.min(1.6, lk * 1.2)); }
      else if (idle && o.lookAt) { var lk2 = Math.sin(t * 0.45) + Math.sin(t * 0.23) * 0.6; if (Math.abs(lk2) > 1.1) lx += (lk2 > 0 ? 1 : -1) * 1.4; }
      if (S.eyesUnder) S.eyesUnder(c, g, ex, eyeY);
      if (!(S.face && S.face(c, g, ex, lx, ly))) {
        [-1, 1].forEach(function (k) {
          var cx = k * 8 + ex;
          if (g.blink) { c.strokeStyle = OL; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 4.5, eyeY + 1); c.lineTo(cx + 4.5, eyeY + 1); c.stroke(); return; }
          ell(c, cx, eyeY, 5.6, 6.8); fs(c, '#fff', OL, 2);
          circ(c, cx + lx, eyeY + ly + 0.5, 3.1); c.fillStyle = '#16122b'; c.fill();
          circ(c, cx + lx + 1, eyeY + ly - 0.8, 1.1); c.fillStyle = '#fff'; c.fill();
        });
      }
      var my = g.by + 27;
      if (!(S.mouth && S.mouth(c, g, ex, my))) { c.strokeStyle = OL; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.arc(ex, my - 3, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
      if (S.cheeks) { c.fillStyle = 'rgba(255,90,140,.35)'; ell(c, -13 + ex, my - 3, 3.5, 2.2); c.fill(); ell(c, 13 + ex, my - 3, 3.5, 2.2); c.fill(); }
      A.drawAcc(c, look.acc, g.by, ex, dir, t, base);
    } else {
      if (Math.abs(g.side) > 0.25 && !S.noBackPeek && !S.shape && skin !== 'mushroom') { // 3/4 back view: the edge of the face peeks out on the side you're turning to
        var sg = g.side > 0 ? 1 : -1, pe = Math.min(1, (Math.abs(g.side) - 0.25) / 0.5);
        c.save(); rr(c, g.bx, g.by, W, H, D.r != null ? D.r : 15); c.clip();
        var pcx = sg * (W / 2 - 1 - pe * 3), pcy = g.by + 15;
        ell(c, pcx, pcy, 5.2, 6.4); fs(c, '#fff', OL, 2);
        circ(c, pcx + sg * 1.6, pcy + 0.5, 2.8); c.fillStyle = '#16122b'; c.fill();
        c.fillStyle = 'rgba(255,90,140,.3)'; ell(c, pcx - sg * 2, pcy + 10, 3, 1.8); c.fill();
        c.restore();
      }
      if (look.acc === 'cape') { c.beginPath(); c.moveTo(-17, g.by + 12); c.lineTo(17, g.by + 12); c.lineTo(22, -3 + bob * 0.3); c.lineTo(-22, -3 + bob * 0.3); c.closePath(); fs(c, '#c1121f', OL, 3); c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-2, g.by + 14, 4, 20); }
      if (look.acc === 'scarf' || look.acc === 'chain' || look.acc === 'medal') A.drawAcc(c, look.acc, g.by, 0, 3, t, base);
    }
    c.restore();
    if (S.front) S.front(c, g);
    var hatY = skin === 'mushroom' ? g.by - 16 : g.by;
    if (look.acc === 'orbs' || look.acc === 'pet') A.fxFront(c, g, look.acc, t);
    A.drawHat(c, (look.hat && look.hat !== 'none') ? look.hat : (A.SEASON_HATS[A.season] && !o.noSeason && skin !== 'mushroom' && !S.shape ? A.SEASON_HATS[A.season] : look.hat), hatY, g.side, dir, t);
    c.restore();
    return hatY * s;
  };

  // ---------------------------------------------------------------- ACCESSORIES
  A.drawAcc = function (c, k, by, ex, dir, t, base) {
    if (!k) return;
    var oa = ovr('acc', k); if (oa) k = oa;
    if (A.isCustom(k)) { if (dir === 3) return; var as = custSprite(k), af = as && custFrame(k, false, custFi(as, t)); if (!af) return; custDraw(c, af, ex * 0.5 - 22, by - 4, 44, false, as, t); return; }
    var eyeY = by + 15;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (k === 'shades') {
      [-1, 1].forEach(function (s) { rr(c, s * 8 + ex - 7, eyeY - 5, 14, 9, 4); fs(c, '#141428', OL, 2); });
      c.strokeStyle = '#141428'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(ex - 1, eyeY - 2); c.lineTo(ex + 1, eyeY - 2); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(ex - 13, eyeY - 3, 3, 2); c.fillRect(ex + 3, eyeY - 3, 3, 2);
    } else if (k === 'nerd') {
      [-1, 1].forEach(function (s) { circ(c, s * 8 + ex, eyeY, 7); c.fillStyle = 'rgba(200,230,255,.25)'; c.fill(); c.strokeStyle = '#111'; c.lineWidth = 3; c.stroke(); });
      c.strokeStyle = '#111'; c.beginPath(); c.moveTo(ex - 1, eyeY); c.lineTo(ex + 1, eyeY); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(ex - 2, eyeY - 2, 4, 4);
    } else if (k === 'stache') {
      c.fillStyle = '#4a2a12'; c.beginPath(); var y = by + 23;
      c.moveTo(ex, y); c.quadraticCurveTo(ex - 6, y - 4, ex - 12, y + 1); c.quadraticCurveTo(ex - 15, y + 4, ex - 17, y - 1);
      c.quadraticCurveTo(ex - 13, y + 7, ex - 6, y + 4); c.quadraticCurveTo(ex - 2, y + 3, ex, y + 3);
      c.quadraticCurveTo(ex + 2, y + 3, ex + 6, y + 4); c.quadraticCurveTo(ex + 13, y + 7, ex + 17, y - 1);
      c.quadraticCurveTo(ex + 15, y + 4, ex + 12, y + 1); c.quadraticCurveTo(ex + 6, y - 4, ex, y); c.closePath(); fs(c, '#4a2a12', OL, 1.5);
    } else if (k === 'bowtie') {
      var yb = by + 37; c.beginPath(); c.moveTo(ex, yb); c.lineTo(ex - 10, yb - 6); c.lineTo(ex - 10, yb + 6); c.closePath(); fs(c, '#e63946', OL, 2);
      c.beginPath(); c.moveTo(ex, yb); c.lineTo(ex + 10, yb - 6); c.lineTo(ex + 10, yb + 6); c.closePath(); fs(c, '#e63946', OL, 2); circ(c, ex, yb, 3); fs(c, '#a4161a', OL, 1.5);
    } else if (k === 'monocle') {
      circ(c, ex + 8, eyeY, 7.5); c.fillStyle = 'rgba(220,240,255,.25)'; c.fill(); c.strokeStyle = '#d4a017'; c.lineWidth = 2.5; c.stroke();
      c.strokeStyle = '#d4a017'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ex + 14, eyeY + 4); c.quadraticCurveTo(ex + 18, eyeY + 16, ex + 12, by + 34); c.stroke();
    } else if (k === 'patch') {
      c.strokeStyle = '#111'; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - 19, eyeY - 8); c.lineTo(ex + 19, eyeY - 2); c.stroke();
      ell(c, ex - 8, eyeY, 7, 7.5); fs(c, '#111', OL, 1.5);
    } else if (k === 'scarf') {
      var ys = by + 31; rr(c, -19, ys, 38, 8, 4); fs(c, '#e63946', OL, 2.5);
      c.fillStyle = '#fff'; for (var i = -14; i < 18; i += 8) c.fillRect(i, ys + 1, 3, 6);
      if (dir !== 3) { rr(c, 6 + ex * 0.5, ys + 4, 8, 14, 3); fs(c, '#e63946', OL, 2); }
    } else if (k === 'chain') {
      c.strokeStyle = '#ffcf3f'; c.lineWidth = 3; c.setLineDash([3, 2]); c.beginPath(); c.arc(ex * 0.5, by + 22, 14, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); c.setLineDash([]);
      if (dir !== 3) { circ(c, ex * 0.5, by + 37, 5); fs(c, '#ffcf3f', OL, 1.8); c.fillStyle = '#8a5a00'; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', ex * 0.5, by + 37.5); }
    } else if (k === 'pixel') {
      c.fillStyle = '#0a0a0a'; var px = 2.5, oy = eyeY - 4, ox = ex - 17;
      var rows = ['11111111111111', '01111100111110', '01001100100110', '00111000011100'];
      rows.forEach(function (r, ri) { for (var ci = 0; ci < r.length; ci++) if (r[ci] === '1') c.fillRect(ox + ci * px, oy + ri * px, px, px); });
      c.fillStyle = '#fff'; c.fillRect(ox + 2 * px, oy + px, px, px); c.fillRect(ox + 9 * px, oy + px, px, px);
    } else if (k === 'hearts') {
      [-1, 1].forEach(function (s2) { var hx2 = s2 * 8 + ex, hy = eyeY - 1; c.beginPath(); c.moveTo(hx2, hy + 6); c.bezierCurveTo(hx2 - 9, hy, hx2 - 6, hy - 7, hx2, hy - 3); c.bezierCurveTo(hx2 + 6, hy - 7, hx2 + 9, hy, hx2, hy + 6); c.closePath(); fs(c, '#ff3b7a', OL, 2); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(hx2 - 4, hy - 3, 2, 2); });
      c.strokeStyle = '#ff3b7a'; c.lineWidth = 2; c.beginPath(); c.moveTo(ex - 1, eyeY - 2); c.lineTo(ex + 1, eyeY - 2); c.stroke();
    } else if (k === 'medal') {
      c.strokeStyle = '#3a86ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(ex * 0.5 - 8, by + 24); c.lineTo(ex * 0.5, by + 33); c.lineTo(ex * 0.5 + 8, by + 24); c.stroke();
      if (dir !== 3) { circ(c, ex * 0.5, by + 37, 5.5); var gm = c.createRadialGradient(ex * 0.5 - 2, by + 35, 1, ex * 0.5, by + 37, 6); gm.addColorStop(0, '#fff3a3'); gm.addColorStop(1, '#e0a10e'); fs(c, gm, OL, 1.8); A.label(c, '1', ex * 0.5, by + 37.5, { size: 7, color: '#8a5a00', stroke: false }); }
    } else if (k === 'cape') {
      circ(c, ex * 0.5, by + 34, 4); fs(c, '#ffcf3f', OL, 2);
    }
    c.restore();
  };

  // ---------------------------------------------------------------- ANIMATED ACCESSORIES
  A.fxBack = function (c, g, k, t) {
    c.save(); c.lineJoin = 'round';
    if (k === 'butterfly') {
      var f = Math.abs(Math.sin(t * 6)); // flap
      [-1, 1].forEach(function (s) {
        c.save(); c.translate(s * 6, g.by + 20); c.scale(s * (0.35 + 0.65 * f), 1);
        var gr = c.createLinearGradient(0, -26, 30, 10); gr.addColorStop(0, '#ff6ec7'); gr.addColorStop(0.5, '#b185ff'); gr.addColorStop(1, '#5cf2ff');
        c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(10, -34, 38, -30, 30, -6); c.bezierCurveTo(28, 2, 12, 2, 0, 0); fs(c, gr, OL, 2.5);
        c.beginPath(); c.moveTo(0, 2); c.bezierCurveTo(8, 6, 26, 10, 20, 22); c.bezierCurveTo(14, 26, 4, 14, 0, 2); fs(c, gr, OL, 2.5);
        c.fillStyle = 'rgba(255,255,255,.8)'; circ(c, 20, -14, 3.2); c.fill(); circ(c, 13, 13, 2.2); c.fill();
        c.restore();
      });
    } else if (k === 'firewings') {
      var fl = Math.sin(t * 5) * 0.25;
      c.globalCompositeOperation = 'lighter';
      [-1, 1].forEach(function (s) {
        c.save(); c.translate(s * 12, g.by + 18); c.rotate(s * (0.2 + fl));
        for (var i = 0; i < 5; i++) {
          var a = -0.9 + i * 0.32, len = 30 + Math.sin(t * 9 + i * 1.7) * 5;
          var gx = Math.cos(a) * len * s, gy = Math.sin(a) * len;
          var gr = c.createRadialGradient(gx * 0.5, gy * 0.5, 1, gx * 0.5, gy * 0.5, 16);
          gr.addColorStop(0, 'rgba(255,240,150,.95)'); gr.addColorStop(0.5, 'rgba(255,120,20,.7)'); gr.addColorStop(1, 'rgba(200,20,0,0)');
          c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(gx * 0.5 - 6 * s, gy * 0.5 - 8, gx, gy); c.quadraticCurveTo(gx * 0.6 + 6 * s, gy * 0.6 + 8, 0, 4); c.fill();
        }
        c.restore();
      });
      c.globalCompositeOperation = 'source-over';
    } else if (k === 'aura') {
      var pulse = 0.6 + 0.4 * Math.sin(t * 4), cy = g.by + g.H * 0.55;
      var gr2 = c.createRadialGradient(0, cy, 6, 0, cy, 40 + pulse * 6);
      gr2.addColorStop(0, 'rgba(120,200,255,0)'); gr2.addColorStop(0.6, 'rgba(120,200,255,' + (0.25 * pulse) + ')'); gr2.addColorStop(1, 'rgba(120,200,255,0)');
      c.fillStyle = gr2; c.beginPath(); c.ellipse(0, cy, 46, 44, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(160,230,255,' + (0.55 + 0.35 * pulse) + ')'; c.lineWidth = 2.5; c.shadowColor = '#5cf2ff'; c.shadowBlur = 10;
      for (var j = 0; j < 3; j++) { var ph = (t * 1.4 + j / 3) % 1; c.globalAlpha = 1 - ph; c.beginPath(); c.ellipse(0, -2, 18 + ph * 22, 5 + ph * 7, 0, 0, TAU); c.stroke(); }
      c.globalAlpha = 1; c.shadowBlur = 0;
      for (var q = 0; q < 6; q++) { var pa = t * 2 + q, py = ((t * 40 + q * 17) % 50); c.fillStyle = 'rgba(200,245,255,' + (1 - py / 50) + ')'; circ(c, Math.sin(pa * 1.3) * 20, -py, 2); c.fill(); }
    } else if (k === 'orbs') {
      fxOrbs(c, g, t, false);
    }
    c.restore();
  };
  function fxOrbs(c, g, t, front) {
    var cols = ['#ff4b5c', '#ffd166', '#2bd576', '#3fa9ff'], cy = g.by + g.H * 0.5;
    for (var i = 0; i < 4; i++) {
      var a = t * 2.4 + i * TAU / 4, z = Math.sin(a);
      if ((z > 0) !== front) continue;
      var x = Math.cos(a) * 30, y = cy + z * 9;
      c.shadowColor = cols[i]; c.shadowBlur = 12; circ(c, x, y, 5 + z * 1.2); fs(c, cols[i], OL, 2); c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,.75)'; circ(c, x - 1.5, y - 1.5, 1.6); c.fill();
    }
  }
  A.fxFront = function (c, g, k, t) {
    c.save();
    if (k === 'orbs') fxOrbs(c, g, t, true);
    else if (k === 'pet') { // a little ghost buddy floating beside you
      var px = 30 + Math.sin(t * 1.3) * 4, py = g.by - 4 + Math.sin(t * 2.6) * 5;
      c.translate(px, py); c.globalAlpha = 0.93;
      c.beginPath(); c.arc(0, 0, 10, Math.PI, 0); c.lineTo(10, 12);
      for (var w = 0; w < 4; w++) { var wx = 10 - (w + 1) * 5; c.quadraticCurveTo(wx + 2.5, 12 + (w % 2 ? -4 : 4) * Math.cos(t * 8), wx, 12); }
      c.closePath(); fs(c, '#f4f2ff', OL, 2.5);
      c.fillStyle = OL; ell(c, -3.5, -1, 1.8, 2.6); c.fill(); ell(c, 3.5, -1, 1.8, 2.6); c.fill();
      c.fillStyle = '#ff9ec7'; ell(c, -6, 3, 2, 1.2); c.fill(); ell(c, 6, 3, 2, 1.2); c.fill();
    }
    c.restore();
  };
  // ---------------------------------------------------------------- HATS
  A.drawHat = function (c, k, by, side, dir, t) {
    if (!k) return;
    var oh = ovr('hat', k); if (oh) k = oh;
    var hx = side * 3, y = by;
    if (A.isCustom(k)) { var hs = custSprite(k), hf = hs && (dir === 3 && hs.back ? custFrame(k, true) : custFrame(k, false, custFi(hs, t))); if (!hf || hf.bot < 0) return; var hsz = 44, hc = hsz / hf.w; c.save(); if (dir === 3 && !hs.back) c.globalAlpha *= 0.95; var hf0 = custFrame(k, false) || hf; custDraw(c, hf, hx - hsz / 2, y + 7 - (hf0.bot + 1) * hc, hsz, side < -0.3 && dir !== 3, hs, t); c.restore(); return; }
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (k === 'cap') {
      c.beginPath(); c.ellipse(hx, y + 6, 17, 12, 0, Math.PI, 0); c.closePath(); fs(c, '#e63946', OL, 3);
      if (dir === 0) { ell(c, hx, y + 7, 15, 4); fs(c, '#b5172a', OL, 2.5); }
      else if (dir !== 3) { c.beginPath(); c.ellipse(hx + side * 16, y + 6, 11, 3.5, 0, 0, TAU); fs(c, '#b5172a', OL, 2.5); }
      circ(c, hx, y - 6, 2.5); fs(c, '#fff', OL, 1.5);
    } else if (k === 'beanie') {
      c.beginPath(); c.ellipse(hx, y + 7, 18, 15, 0, Math.PI, 0); c.closePath(); fs(c, '#2a9d8f', OL, 3);
      rr(c, hx - 18, y + 3, 36, 8, 4); fs(c, '#21867a', OL, 2.5);
      circ(c, hx, y - 9, 5); fs(c, '#f4f1de', OL, 2.5);
    } else if (k === 'party') {
      c.save(); c.translate(hx + 4, y + 4); c.rotate(0.18);
      c.beginPath(); c.moveTo(-11, 0); c.lineTo(0, -28); c.lineTo(11, 0); c.closePath(); fs(c, '#9b5de5', OL, 3);
      c.save(); c.clip(); c.fillStyle = '#ffd166'; for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-12, -i * 8); c.lineTo(12, -i * 8 - 6); c.lineTo(12, -i * 8 - 2); c.lineTo(-12, -i * 8 + 4); c.closePath(); c.fill(); } c.restore();
      c.beginPath(); c.moveTo(-11, 0); c.lineTo(0, -28); c.lineTo(11, 0); c.closePath(); c.strokeStyle = OL; c.lineWidth = 3; c.stroke();
      circ(c, 0, -29, 4); fs(c, '#f15bb5', OL, 2); c.restore();
    } else if (k === 'phones') {
      c.strokeStyle = OL; c.lineWidth = 7; c.beginPath(); c.arc(hx, y + 14, 19, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      c.strokeStyle = '#3a86ff'; c.lineWidth = 3.5; c.stroke();
      [-1, 1].forEach(function (s) { if ((dir === 1 && s === 1) || (dir === 2 && s === -1)) return; rr(c, hx + s * 19 - 5, y + 10, 10, 15, 4); fs(c, '#222', OL, 2.5); c.fillStyle = '#ff006e'; c.fillRect(hx + s * 19 - 2, y + 13, 4, 9); });
    } else if (k === 'chef') {
      rr(c, hx - 14, y - 2, 28, 10, 3); fs(c, '#fff', OL, 3);
      [[-9, -8, 9], [0, -13, 10], [9, -8, 9]].forEach(function (p) { circ(c, hx + p[0], y + p[1], p[2]); fs(c, '#fff', OL, 3); });
      c.fillStyle = '#fff'; c.fillRect(hx - 12, y - 8, 24, 12);
    } else if (k === 'cowboy') {
      ell(c, hx, y + 6, 27, 7); fs(c, '#8b5a2b', OL, 3);
      c.beginPath(); c.moveTo(hx - 13, y + 5); c.quadraticCurveTo(hx - 15, y - 14, hx - 6, y - 12); c.quadraticCurveTo(hx, y - 7, hx + 6, y - 12); c.quadraticCurveTo(hx + 15, y - 14, hx + 13, y + 5); c.closePath(); fs(c, '#a0662f', OL, 3);
      c.fillStyle = '#3d2410'; c.fillRect(hx - 13, y - 1, 26, 4);
    } else if (k === 'prop') {
      c.beginPath(); c.ellipse(hx, y + 6, 17, 12, 0, Math.PI, 0); c.closePath(); fs(c, '#ffbe0b', OL, 3);
      c.save(); c.beginPath(); c.ellipse(hx, y + 6, 17, 12, 0, Math.PI, 0); c.clip(); c.fillStyle = '#3a86ff'; c.fillRect(hx - 6, y - 8, 6, 16); c.fillStyle = '#e63946'; c.fillRect(hx + 4, y - 8, 6, 16); c.restore();
      c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.moveTo(hx, y - 6); c.lineTo(hx, y - 12); c.stroke();
      var sp = Math.cos(t * 18); ell(c, hx, y - 13, 16 * Math.abs(sp) + 2, 3); fs(c, '#e63946', OL, 2); circ(c, hx, y - 13, 2.5); fs(c, '#ffd166', OL, 1.5);
    } else if (k === 'top') {
      ell(c, hx, y + 5, 21, 5.5); fs(c, '#16161e', OL, 3);
      rr(c, hx - 13, y - 22, 26, 28, 3); fs(c, '#1d1d28', OL, 3);
      c.fillStyle = '#c1121f'; c.fillRect(hx - 12, y - 1, 24, 5);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(hx - 9, y - 19, 4, 16);
    } else if (k === 'viking') {
      [-1, 1].forEach(function (s) { c.beginPath(); c.moveTo(hx + s * 13, y + 2); c.quadraticCurveTo(hx + s * 28, y - 2, hx + s * 25, y - 20); c.quadraticCurveTo(hx + s * 22, y - 6, hx + s * 11, y - 4); c.closePath(); fs(c, '#f4ecd6', OL, 2.5); });
      c.beginPath(); c.ellipse(hx, y + 7, 18, 16, 0, Math.PI, 0); c.closePath(); fs(c, '#8d99ae', OL, 3);
      rr(c, hx - 18, y + 3, 36, 6, 3); fs(c, '#b08d57', OL, 2); c.fillStyle = OL; [-11, 0, 11].forEach(function (d) { circ(c, hx + d, y + 6, 1.4); c.fill(); });
    } else if (k === 'wizard') {
      ell(c, hx, y + 5, 24, 6); fs(c, '#5a189a', OL, 3);
      c.beginPath(); c.moveTo(hx - 14, y + 4); c.quadraticCurveTo(hx - 4, y - 16, hx + 8, y - 34 + Math.sin(t * 2) * 2); c.quadraticCurveTo(hx + 4, y - 14, hx + 14, y + 4); c.closePath(); fs(c, '#7b2cbf', OL, 3);
      c.fillStyle = '#ffd166'; c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText('★', hx - 3, y - 4); c.fillText('✦', hx + 4, y - 15);
    } else if (k === 'halo') {
      var hb = Math.sin(t * 3) * 2;
      c.shadowColor = '#ffe066'; c.shadowBlur = 12; c.strokeStyle = '#ffe066'; c.lineWidth = 4; ell(c, hx, y - 10 + hb, 15, 5); c.stroke();
      c.shadowBlur = 0; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2; c.stroke();
    } else if (k === 'horns') {
      [-1, 1].forEach(function (s) { c.beginPath(); c.moveTo(hx + s * 6, y + 4); c.quadraticCurveTo(hx + s * 16, y - 2, hx + s * 14, y - 14); c.quadraticCurveTo(hx + s * 10, y - 4, hx + s * 1, y + 4); c.closePath(); fs(c, '#d00000', OL, 2.5); });
    } else if (k === 'beret') {
      c.save(); c.translate(hx - 3, y + 2); c.rotate(-0.18); ell(c, 0, 0, 19, 8); fs(c, '#c1121f', OL, 3); ell(c, 2, -2, 14, 5); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill(); c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.moveTo(4, -7); c.lineTo(6, -11); c.stroke(); c.restore();
    } else if (k === 'flowers') {
      c.strokeStyle = '#3b8a3a'; c.lineWidth = 3; ell(c, hx, y + 5, 18, 5); c.stroke();
      ['#ff6ec7', '#ffd166', '#ffffff', '#b185ff', '#ff922b'].forEach(function (col, i) { var a = Math.PI + (i / 4) * Math.PI, fx = hx + Math.cos(a) * 17, fy = y + 5 + Math.sin(a) * 5; for (var pe = 0; pe < 5; pe++) { var pa = pe / 5 * TAU + t * 0.5; circ(c, fx + Math.cos(pa) * 3, fy + Math.sin(pa) * 3, 2.6); fs(c, col, OL, 1); } circ(c, fx, fy, 2); c.fillStyle = '#ffb703'; c.fill(); });
    } else if (k === 'santa') {
      c.beginPath(); c.moveTo(hx - 17, y + 6); c.quadraticCurveTo(hx - 6, y - 20, hx + 14 + Math.sin(t * 2) * 2, y - 12); c.quadraticCurveTo(hx + 8, y - 4, hx + 17, y + 6); c.closePath(); fs(c, '#d62828', OL, 3);
      rr(c, hx - 19, y + 1, 38, 9, 4.5); fs(c, '#fff', OL, 2.5); circ(c, hx + 15 + Math.sin(t * 2) * 2, y - 13, 5); fs(c, '#fff', OL, 2.5);
    } else if (k === 'grad') {
      c.beginPath(); c.ellipse(hx, y + 6, 15, 10, 0, Math.PI, 0); c.closePath(); fs(c, '#1b1b2a', OL, 3);
      c.beginPath(); c.moveTo(hx - 22, y - 4); c.lineTo(hx, y - 12); c.lineTo(hx + 22, y - 4); c.lineTo(hx, y + 4); c.closePath(); fs(c, '#23233a', OL, 3);
      var sw = Math.sin(t * 2.5) * 2; c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx, y - 4); c.lineTo(hx + 14, y - 2); c.lineTo(hx + 15 + sw, y + 10); c.stroke(); rr(c, hx + 13 + sw, y + 9, 4, 6, 1.5); c.fillStyle = '#ffd166'; c.fill();
    } else if (k === 'pirate') {
      c.beginPath(); c.moveTo(hx - 26, y + 6); c.quadraticCurveTo(hx - 20, y - 4, hx - 12, y - 2); c.quadraticCurveTo(hx - 6, y - 16, hx, y - 15); c.quadraticCurveTo(hx + 6, y - 16, hx + 12, y - 2); c.quadraticCurveTo(hx + 20, y - 4, hx + 26, y + 6); c.quadraticCurveTo(hx, y + 1, hx - 26, y + 6); c.closePath(); fs(c, '#1b1b26', OL, 3);
      c.strokeStyle = '#ffd166'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx - 24, y + 5); c.quadraticCurveTo(hx, y, hx + 24, y + 5); c.stroke();
      if (dir !== 3) { circ(c, hx, y - 6, 3.6); c.fillStyle = '#fff'; c.fill(); c.fillStyle = '#1b1b26'; c.fillRect(hx - 2, y - 7, 1.5, 1.5); c.fillRect(hx + 0.5, y - 7, 1.5, 1.5); c.strokeStyle = '#fff'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(hx - 5, y - 1); c.lineTo(hx + 5, y + 2); c.moveTo(hx + 5, y - 1); c.lineTo(hx - 5, y + 2); c.stroke(); }
    } else if (k === 'antlers') {
      [-1, 1].forEach(function (s2) { c.strokeStyle = OL; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx + s2 * 8, y + 4); c.quadraticCurveTo(hx + s2 * 12, y - 10, hx + s2 * 20, y - 18); c.moveTo(hx + s2 * 13, y - 9); c.lineTo(hx + s2 * 22, y - 6); c.moveTo(hx + s2 * 11, y - 3); c.lineTo(hx + s2 * 4, y - 12); c.stroke(); c.strokeStyle = '#a0662f'; c.lineWidth = 3.4; c.stroke(); });
      if (dir === 0) { circ(c, hx, y + 26, 3.6); c.fillStyle = '#ff3b5c'; c.shadowColor = '#ff3b5c'; c.shadowBlur = 6; c.fill(); c.shadowBlur = 0; }
    } else if (k === 'flame') {
      c.globalCompositeOperation = 'lighter';
      for (var fi = 0; fi < 7; fi++) {
        var fxp = hx - 15 + fi * 5, fh = 14 + Math.sin(t * 11 + fi * 2.1) * 5 + (fi === 3 ? 8 : 0);
        var fg = c.createLinearGradient(fxp, y + 6, fxp, y + 6 - fh); fg.addColorStop(0, 'rgba(255,90,0,.95)'); fg.addColorStop(0.6, 'rgba(255,190,40,.85)'); fg.addColorStop(1, 'rgba(255,255,200,0)');
        c.fillStyle = fg; c.beginPath(); c.moveTo(fxp - 5, y + 6); c.quadraticCurveTo(fxp - 3, y + 6 - fh * 0.6, fxp + Math.sin(t * 7 + fi) * 2, y + 6 - fh); c.quadraticCurveTo(fxp + 3, y + 6 - fh * 0.6, fxp + 5, y + 6); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      rr(c, hx - 17, y + 2, 34, 7, 3); fs(c, '#3a1d0e', OL, 2.5); c.fillStyle = '#ff7a1a'; [-10, 0, 10].forEach(function (d) { circ(c, hx + d, y + 5.5, 1.8); c.fill(); });
    } else if (k === 'storm') {
      var sb = Math.sin(t * 1.8) * 2, cy2 = y - 18 + sb, puffs = [[-11, 2, 9], [0, -3, 11], [11, 2, 9], [-5, 5, 8], [6, 5, 8]];
      puffs.forEach(function (q) { circ(c, hx + q[0], cy2 + q[1], q[2]); fs(c, '#5b6380', OL, 3); });
      puffs.forEach(function (q) { circ(c, hx + q[0], cy2 + q[1], q[2] - 1.5); c.fillStyle = '#6d7594'; c.fill(); });
      if ((t * 1.3) % 2 < 0.18) { c.strokeStyle = '#fff7ae'; c.shadowColor = '#ffe066'; c.shadowBlur = 12; c.lineWidth = 2.5; c.beginPath(); c.moveTo(hx + 2, cy2 + 10); c.lineTo(hx - 4, cy2 + 18); c.lineTo(hx + 2, cy2 + 18); c.lineTo(hx - 3, cy2 + 27); c.stroke(); c.shadowBlur = 0; }
      c.strokeStyle = 'rgba(140,200,255,.8)'; c.lineWidth = 1.5; for (var ri = 0; ri < 4; ri++) { var ry = (t * 60 + ri * 9) % 22; c.beginPath(); c.moveTo(hx - 12 + ri * 8, cy2 + 10 + ry); c.lineTo(hx - 13 + ri * 8, cy2 + 14 + ry); c.stroke(); }
    } else if (k === 'ufo') {
      var ua = t * 1.6, ux = hx + Math.cos(ua) * 14, uy = y - 20 + Math.sin(ua * 2) * 3;
      c.fillStyle = 'rgba(160,255,180,' + (0.18 + 0.1 * Math.sin(t * 8)) + ')'; c.beginPath(); c.moveTo(ux - 4, uy + 3); c.lineTo(ux + 4, uy + 3); c.lineTo(ux + 10, y + 6); c.lineTo(ux - 10, y + 6); c.closePath(); c.fill();
      ell(c, ux, uy - 2, 6, 5); fs(c, 'rgba(180,240,255,.85)', OL, 2);
      ell(c, ux, uy + 1, 13, 4.5); fs(c, '#a7b0c8', OL, 2.5);
      for (var li = 0; li < 4; li++) { c.fillStyle = (Math.floor(t * 6) + li) % 4 === 0 ? '#ffd166' : '#ff4b5c'; circ(c, ux - 8 + li * 5.3, uy + 1.5, 1.4); c.fill(); }
    } else if (k === 'orbit') {
      var oc = y - 6;
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; ell(c, hx, oc, 22, 7); c.stroke();
      [['#ffd166', 4.5, 0], ['#5cf2ff', 3.5, 2.1], ['#ff6ec7', 3, 4.2]].forEach(function (pl) {
        var a2 = t * 1.8 + pl[2]; var px2 = hx + Math.cos(a2) * 22, py2 = oc + Math.sin(a2) * 7;
        c.shadowColor = pl[0]; c.shadowBlur = 8; circ(c, px2, py2, pl[1]); fs(c, pl[0], OL, 1.5); c.shadowBlur = 0;
        if (pl[2] === 0) { c.strokeStyle = 'rgba(255,230,160,.8)'; c.lineWidth = 1.2; ell(c, px2, py2, 7, 2); c.stroke(); }
      });
      circ(c, hx, oc - 1, 2.2); c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 10; c.fill(); c.shadowBlur = 0;
    } else if (k === 'neon') {
      var nb = Math.sin(t * 3) * 2, hue = (t * 90) % 360;
      for (var ni = 0; ni < 3; ni++) { c.strokeStyle = 'hsla(' + ((hue + ni * 40) % 360) + ',100%,65%,' + (0.9 - ni * 0.25) + ')'; c.shadowColor = c.strokeStyle; c.shadowBlur = 14; c.lineWidth = 4 - ni; ell(c, hx, y - 10 + nb - ni * 3, 16 + ni * 3, 5 + ni); c.stroke(); }
      c.shadowBlur = 0;
      for (var si = 0; si < 3; si++) { var sa = t * 2 + si * 2.1; c.fillStyle = 'hsl(' + ((hue + si * 120) % 360) + ',100%,75%)'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('✦', hx + Math.cos(sa) * 20, y - 10 + nb + Math.sin(sa) * 6); }
    } else if (k === 'crown') {
      c.beginPath(); c.moveTo(hx - 16, y + 6); c.lineTo(hx - 17, y - 12); c.lineTo(hx - 8, y - 3); c.lineTo(hx, y - 17); c.lineTo(hx + 8, y - 3); c.lineTo(hx + 17, y - 12); c.lineTo(hx + 16, y + 6); c.closePath();
      var g = c.createLinearGradient(hx, y - 17, hx, y + 6); g.addColorStop(0, '#fff3a3'); g.addColorStop(1, '#e0a10e'); fs(c, g, OL, 3);
      circ(c, hx, y + 1, 3); fs(c, '#e63946', OL, 1.5); circ(c, hx - 9, y + 2, 2.2); fs(c, '#3a86ff', OL, 1.2); circ(c, hx + 9, y + 2, 2.2); fs(c, '#2bd576', OL, 1.2);
      var sp2 = (t * 1.5) % 3; if (sp2 < 0.5) { c.fillStyle = 'rgba(255,255,255,' + (1 - sp2 * 2) + ')'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('✦', hx + 12, y - 12); }
    }
    c.restore();
  };

  // ---------------------------------------------------------------- TRAILS
  var TRAIL_COLORS = { sparkle: ['#fff7ae', '#ffffff', '#ffd166'], stars: ['#ffd166', '#5cf2ff', '#ff6ec7', '#b8ff5c'], coins: ['#ffcf3f'] };
  A.spawnTrail = function (list, kind, x, y, t) {
    if (!kind) return;
    var r = Math.random;
    var p = { kind: kind, x: x + (r() - 0.5) * 16, y: y - 4 - r() * 6, vx: (r() - 0.5) * 20, vy: -10 - r() * 20, life: 0, max: 0.9 + r() * 0.5, rot: r() * 6, hue: (t * 120) % 360 };
    if (kind === 'fire') { p.vy = -40 - r() * 30; p.max = 0.5 + r() * 0.3; p.size = 6 + r() * 4; }
    if (kind === 'coins') { p.vy = -60 - r() * 20; p.vx = (r() - 0.5) * 50; p.g = 220; p.max = 0.8; }
    if (kind === 'snow') { p.y = y - 40 - r() * 10; p.vy = 18 + r() * 10; p.max = 1.3; }
    if (kind === 'rainbow') { p.vx = 0; p.vy = 0; p.x = x; p.y = y - 6; p.max = 0.9; }
    if (kind === 'petals') { p.y = y - 30 - r() * 10; p.vy = 14 + r() * 10; p.vx = 10 + r() * 14; p.max = 1.4; }
    if (kind === 'ghosts') { p.vy = -24 - r() * 10; p.vx = (r() - 0.5) * 10; p.max = 1.3; }
    if (kind === 'pixels') { p.vy = -30 - r() * 30; p.vx = (r() - 0.5) * 60; p.g = 90; p.max = 0.8; }
    if (kind === 'lightning') { p.x = x; p.y = y - 4; p.vx = 0; p.vy = 0; p.max = 0.35; p.seed = r() * 1000; }
    if (kind === 'galaxy') { p.vy = -6 - r() * 8; p.max = 1.5 + r() * 0.6; p.size = 2 + r() * 3; }
    var cols = TRAIL_COLORS[kind]; if (cols) p.col = cols[(r() * cols.length) | 0];
    list.push(p);
  };
  A.drawParticles = function (c, list, dt) {
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i]; p.life += dt; if (p.life >= p.max) { list.splice(i, 1); continue; }
      if (p.g) p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 3;
      var k = 1 - p.life / p.max; c.save(); c.globalAlpha = Math.min(1, k * 1.4);
      switch (p.kind) {
        case 'sparkle': c.fillStyle = p.col; c.translate(p.x, p.y); c.rotate(p.rot); var s = 4 * k + 1; c.beginPath(); c.moveTo(0, -s * 1.6); c.lineTo(s * 0.4, -s * 0.4); c.lineTo(s * 1.6, 0); c.lineTo(s * 0.4, s * 0.4); c.lineTo(0, s * 1.6); c.lineTo(-s * 0.4, s * 0.4); c.lineTo(-s * 1.6, 0); c.lineTo(-s * 0.4, -s * 0.4); c.closePath(); c.fill(); break;
        case 'hearts': c.fillStyle = '#ff4d8d'; c.font = 'bold ' + Math.round(10 + 4 * (1 - k)) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('♥', p.x, p.y); break;
        case 'bubbles': c.strokeStyle = 'rgba(140,230,255,.9)'; c.lineWidth = 1.5; circ(c, p.x, p.y, 3 + (1 - k) * 4); c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; circ(c, p.x - 1.5, p.y - 1.5, 1); c.fill(); break;
        case 'music': c.fillStyle = 'hsl(' + p.hue + ',85%,70%)'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText(p.rot % 2 > 1 ? '♪' : '♫', p.x, p.y); break;
        case 'snow': c.fillStyle = '#fff'; circ(c, p.x + Math.sin(p.life * 6) * 3, p.y, 2.2); c.fill(); break;
        case 'coins': c.translate(p.x, p.y); c.scale(Math.abs(Math.cos(p.rot * 2)) + 0.2, 1); circ(c, 0, 0, 4); fs(c, '#ffcf3f', '#b07b00', 1.5); break;
        case 'stars': c.fillStyle = p.col; c.font = 'bold ' + Math.round(8 + 6 * k) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('★', p.x, p.y); break;
        case 'fire': c.globalCompositeOperation = 'lighter'; var fr = p.size * k; var g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, fr); g.addColorStop(0, 'rgba(255,240,150,1)'); g.addColorStop(0.5, 'rgba(255,120,20,.8)'); g.addColorStop(1, 'rgba(200,30,0,0)'); c.fillStyle = g; circ(c, p.x, p.y, fr); c.fill(); break;
        case 'rainbow': c.fillStyle = 'hsla(' + p.hue + ',95%,62%,' + (0.85 * k) + ')'; ell(c, p.x, p.y, 9, 4); c.fill(); break;
        case 'petals': c.translate(p.x + Math.sin(p.life * 4) * 6, p.y); c.rotate(p.rot); c.fillStyle = '#ffb7d5'; ell(c, 0, 0, 4.5, 2.6); c.fill(); c.fillStyle = '#ff8fbd'; ell(c, 1, 0, 2, 1.2); c.fill(); break;
        case 'ghosts': c.globalAlpha = 0.75 * k; c.translate(p.x + Math.sin(p.life * 5) * 4, p.y); c.fillStyle = '#f4f2ff'; c.beginPath(); c.arc(0, 0, 5, Math.PI, 0); c.lineTo(5, 6); c.lineTo(2.5, 4); c.lineTo(0, 6); c.lineTo(-2.5, 4); c.lineTo(-5, 6); c.closePath(); c.fill(); c.fillStyle = '#1b1b2a'; c.fillRect(-2.5, -1.5, 1.5, 2); c.fillRect(1, -1.5, 1.5, 2); break;
        case 'pixels': c.fillStyle = 'hsl(' + ((p.hue + p.rot * 40) % 360) + ',95%,60%)'; var ps = Math.max(1, 5 * k); c.fillRect(Math.round(p.x), Math.round(p.y), ps, ps); break;
        case 'lightning': c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(190,230,255,' + k + ')'; c.shadowColor = '#7fd3ff'; c.shadowBlur = 10; c.lineWidth = 2; for (var bl = 0; bl < 2; bl++) { c.beginPath(); var lx = p.x, ly = p.y; c.moveTo(lx, ly); for (var sgi = 0; sgi < 4; sgi++) { var sr = Math.sin(p.seed + sgi * 12.9898 + bl * 78.2) * 43758.5; sr -= Math.floor(sr); lx += (sr - 0.5) * 16; ly -= 6 + sr * 4; c.lineTo(lx, ly); } c.stroke(); } c.shadowBlur = 0; break;
        case 'galaxy': c.globalCompositeOperation = 'lighter'; var gh = (p.hue + 200) % 360; var gg = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3); gg.addColorStop(0, 'hsla(' + gh + ',90%,75%,' + k + ')'); gg.addColorStop(1, 'hsla(' + gh + ',90%,50%,0)'); c.fillStyle = gg; circ(c, p.x, p.y, p.size * 3); c.fill(); if (p.rot % 3 < 1) { c.fillStyle = 'rgba(255,255,255,' + k + ')'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.fillText('✦', p.x, p.y + 3); } break;
        case 'money': c.font = '16px serif'; c.textAlign = 'center'; c.fillText('💸', p.x, p.y); break;
        case 'dust': c.fillStyle = 'rgba(220,215,240,' + (0.35 * k) + ')'; circ(c, p.x, p.y, 3 + (1 - k) * 5); c.fill(); break;
        case 'confetti': c.fillStyle = p.col; c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-3, -1.5, 6, 3); break;
      }
      c.restore();
    }
  };
  // Burst effects (make-it-rain emote, big wins)
  A.burst = function (list, kind, x, y, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, sp = 80 + Math.random() * 160;
      if (kind === 'money') list.push({ kind: 'money', x: x + (Math.random() - 0.5) * 60, y: y - 90 - Math.random() * 30, vx: (Math.random() - 0.5) * 30, vy: 30 + Math.random() * 40, life: 0, max: 1.6, rot: 0 });
      else list.push({ kind: 'confetti', x: x, y: y - 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 380, life: 0, max: 1.4 + Math.random() * 0.6, rot: a, col: ['#ffd166', '#ff6ec7', '#5cf2ff', '#b8ff5c', '#ff5c6c', '#9b6bff'][i % 6] });
    }
  };

  // ---------------------------------------------------------------- TILES
  // Draw one floor tile of `type` into c at (x,y) size S. v = variant (checker parity / seed).
  A.floorTile = function (c, type, x, y, S, v) {
    var u = S / 48;
    c.save(); c.translate(x, y); c.scale(u, u);
    if (type === 'c') { // classic red casino carpet with gold diamonds
      c.fillStyle = '#7d1d36'; c.fillRect(0, 0, 48, 48);
      c.fillStyle = '#6a1530'; c.fillRect(0, 0, 48, 2); c.fillRect(0, 0, 2, 48);
      c.fillStyle = '#c99a2e'; c.beginPath(); c.moveTo(24, 12); c.lineTo(36, 24); c.lineTo(24, 36); c.lineTo(12, 24); c.closePath(); c.fill();
      c.fillStyle = '#7d1d36'; c.beginPath(); c.moveTo(24, 17); c.lineTo(31, 24); c.lineTo(24, 31); c.lineTo(17, 24); c.closePath(); c.fill();
      c.fillStyle = '#e8b84a'; circ(c, 24, 24, 2.5); c.fill();
      c.fillStyle = 'rgba(232,184,74,.5)'; [[0, 0], [48, 0], [0, 48], [48, 48]].forEach(function (p) { circ(c, p[0], p[1], 3); c.fill(); });
    } else if (type === 'r') { // slots alley: purple with rings
      c.fillStyle = '#3e1f6e'; c.fillRect(0, 0, 48, 48);
      c.strokeStyle = 'rgba(255,110,199,.35)'; c.lineWidth = 2; circ(c, 24, 24, 13); c.stroke();
      c.strokeStyle = 'rgba(92,242,255,.25)'; circ(c, 24, 24, 6); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, 46, 48, 2); c.fillRect(46, 0, 2, 48);
    } else if (type === 'b') { // high stakes: navy + neon grid
      c.fillStyle = '#121a3f'; c.fillRect(0, 0, 48, 48);
      c.fillStyle = 'rgba(92,242,255,.18)'; c.fillRect(0, 0, 48, 1.5); c.fillRect(0, 0, 1.5, 48);
      c.fillStyle = 'rgba(92,242,255,.35)'; c.fillRect(22, 22, 4, 4);
    } else if (type === 'g') { // lobby marble checker
      c.fillStyle = v ? '#efe6d2' : '#d9c9a6'; c.fillRect(0, 0, 48, 48);
      c.strokeStyle = 'rgba(150,120,70,.18)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(4 + (v * 9) % 20, 0); c.quadraticCurveTo(30, 18, 20 + (v * 13) % 20, 48); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, 0, 48, 2);
    } else if (type === 'p') { // vault: metal plates
      c.fillStyle = '#2a2147'; c.fillRect(0, 0, 48, 48);
      c.fillStyle = '#342a58'; c.fillRect(2, 2, 44, 44);
      c.fillStyle = 'rgba(177,133,255,.5)'; [[7, 7], [41, 7], [7, 41], [41, 41]].forEach(function (p) { circ(c, p[0], p[1], 2); c.fill(); });
      c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(2, 2, 44, 10);
    } else if (type === 'w') { // shop: wood planks
      c.fillStyle = '#a86b3c'; c.fillRect(0, 0, 48, 48);
      for (var i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#9c6034' : '#b47645'; c.fillRect(0, i * 12, 48, 12); c.fillStyle = 'rgba(60,30,10,.35)'; c.fillRect(0, i * 12 + 11, 48, 1.5); c.fillRect(((i * 17 + v * 11) % 40) + 4, i * 12, 1.5, 12); }
    }
    c.restore();
  };
  // Wall tile. face=true when floor is directly below (vertical surface we can see).
  A.wallTile = function (c, x, y, S, face, zone, edges) {
    var u = S / 48;
    c.save(); c.translate(x, y); c.scale(u, u);
    if (face) {
      var top = { r: '#4b2a86', c: '#5a1f35', b: '#1d2a66', g: '#6b4a2a', p: '#2f2460', w: '#5c3a1e' }[zone] || '#3d2f7a';
      var g = c.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, shade(top, 0.15)); g.addColorStop(1, shade(top, -0.2));
      c.fillStyle = g; c.fillRect(0, 0, 48, 48);
      c.fillStyle = 'rgba(255,255,255,.06)'; for (var i = 6; i < 48; i += 12) c.fillRect(i, 8, 2, 28);
      c.fillStyle = shade(top, -0.4); c.fillRect(0, 36, 48, 12);
      c.fillStyle = '#d4a63a'; c.fillRect(0, 35, 48, 2.5);
      c.fillStyle = '#2a2252'; c.fillRect(0, 0, 48, 7);
      c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 0, 48, 2);
    } else {
      c.fillStyle = '#2a2252'; c.fillRect(0, 0, 48, 48);
      c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(4, 4, 40, 40);
    }
    c.fillStyle = OL;
    if (edges) { if (edges.w) c.fillRect(0, 0, 3, 48); if (edges.e) c.fillRect(45, 0, 3, 48); if (edges.n) c.fillRect(0, 0, 48, 3); if (edges.s) c.fillRect(0, 45, 48, 3); }
    c.restore();
  };

  // ---------------------------------------------------------------- TEXT HELPERS
  A.label = function (c, text, x, y, o) {
    o = o || {}; c.save();
    var size = o.size || 13;
    c.font = (o.weight || 700) + ' ' + size + 'px Fredoka, "Baloo 2", system-ui, sans-serif';
    if (o.maxW) { var tw = c.measureText(text).width; if (tw > o.maxW) { size = Math.max(5, size * o.maxW / tw); c.font = (o.weight || 700) + ' ' + size + 'px Fredoka, "Baloo 2", system-ui, sans-serif'; } }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    if (o.stroke !== false) { c.strokeStyle = o.strokeColor || 'rgba(15,10,40,.9)'; c.lineWidth = o.lw || 4; c.strokeText(text, x, y); }
    if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.blur || 10; }
    c.fillStyle = o.color || '#fff'; c.fillText(text, x, y);
    c.restore();
  };
  A.neon = function (c, text, x, y, color, size, t, seed) {
    var fl = Math.sin(t * 13 + (seed || 0)) > 0.97 ? 0.4 : 1;
    c.save(); c.globalAlpha = fl;
    c.font = '700 ' + size + 'px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = color; c.shadowBlur = size * 0.8; c.fillStyle = color; c.fillText(text, x, y);
    c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '700 ' + size + 'px Fredoka, system-ui, sans-serif'; c.globalAlpha = fl * 0.6; c.fillText(text, x, y);
    c.restore();
  };

  // ---------------------------------------------------------------- OBJECTS
  var O = A.obj = {};
  var SLOT_SYMS = ['🍒', '🍋', '🔔', '⭐', '💎', '7', '🎰'];
  var CAB = [['#e63946', '#9d0208'], ['#7b2cbf', '#3c096c'], ['#3a86ff', '#023e8a'], ['#ff8500', '#b34700'], ['#2bd576', '#0b7a4b'], ['#ff4d8d', '#a1134d']];
  O.slot = function (c, o, t) {
    var x = o.x, y = o.y, big = o.big, W = big ? 84 : 56, H = big ? 128 : 94;
    var col = CAB[(o.v || 0) % CAB.length], active = o.flash && t - o.flash < 1.6;
    shadow(c, x, y - 2, W * 0.6, 8);
    // light bar
    rr(c, x - W / 2 + 4, y - H - 12, W - 8, 18, 9); fs(c, '#2a1f4d', OL, 3);
    var nb = big ? 7 : 5; for (var i = 0; i < nb; i++) { var on = (i + Math.floor(t * (active ? 14 : 4))) % 2; circ(c, x - W / 2 + 10 + i * ((W - 20) / (nb - 1)), y - H - 3, 3.2); c.fillStyle = on ? (active ? '#fff3a3' : '#ffd166') : '#7a5a20'; if (on) { c.shadowColor = '#ffd166'; c.shadowBlur = 8; } c.fill(); c.shadowBlur = 0; }
    // cabinet
    var g = c.createLinearGradient(x - W / 2, 0, x + W / 2, 0); g.addColorStop(0, col[1]); g.addColorStop(0.35, col[0]); g.addColorStop(1, col[1]);
    rr(c, x - W / 2, y - H, W, H, 10); fs(c, g, OL, 3);
    c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - W / 2 + 6, y - H + 4, 5, H - 20);
    // header
    rr(c, x - W / 2 + 6, y - H + 6, W - 12, big ? 22 : 16, 5); fs(c, '#170f30', OL, 2);
    A.neon(c, big ? 'MEGA 777' : '777', x, y - H + (big ? 17 : 14), '#ffd166', big ? 13 : 10, t, o.v);
    // screen
    var sy = y - H + (big ? 34 : 27), sh = big ? 42 : 30, sw = W - 14;
    rr(c, x - sw / 2, sy, sw, sh, 5); fs(c, '#0b0820', OL, 2.5);
    var rw = (sw - 10) / 3;
    for (var r = 0; r < 3; r++) {
      var rx = x - sw / 2 + 4 + r * (rw + 1);
      rr(c, rx, sy + 3, rw, sh - 6, 3); c.fillStyle = '#fffaf0'; c.fill();
      var seed = active ? Math.floor(t * 20 + r * 3) : Math.floor(t / 5 + (o.v || 0) * 7 + r * 13);
      var sym = SLOT_SYMS[((seed * 2654435761) >>> 0) % SLOT_SYMS.length];
      c.font = (big ? 20 : 14) + 'px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (sym === '7') { c.fillStyle = '#e63946'; c.font = '900 ' + (big ? 22 : 16) + 'px Fredoka, sans-serif'; }
      else c.fillStyle = '#000';
      c.fillText(sym, rx + rw / 2, sy + sh / 2 + 1);
    }
    c.fillStyle = 'rgba(230,57,70,.7)'; c.fillRect(x - sw / 2 + 2, sy + sh / 2, sw - 4, 1.5);
    // buttons
    var by2 = sy + sh + 8;
    rr(c, x - W / 2 + 6, by2, W - 12, 12, 4); fs(c, shade(col[1], -0.3), OL, 2);
    ['#ff3b5c', '#2bd576', '#ffd166'].forEach(function (bc, i2) { circ(c, x - 12 + i2 * 12, by2 + 6, 3.5); fs(c, bc, OL, 1.5); });
    // tray
    rr(c, x - W / 2 + 10, y - 22, W - 20, 12, 4); fs(c, '#140d29', OL, 2);
    c.fillStyle = '#ffcf3f'; if (active) for (var k = 0; k < 4; k++) { circ(c, x - 12 + k * 8, y - 15, 3); c.fill(); }
    // lever
    var pull = active ? Math.max(0, 1 - (t - o.flash) * 3) : 0;
    c.strokeStyle = OL; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + W / 2, y - H * 0.55); c.lineTo(x + W / 2 + 9, y - H * 0.55 - 26 + pull * 30); c.stroke();
    c.strokeStyle = '#c0c6d6'; c.lineWidth = 3; c.stroke();
    circ(c, x + W / 2 + 9, y - H * 0.55 - 28 + pull * 30, 6); fs(c, '#e63946', OL, 2.5);
    rr(c, x + W / 2 - 2, y - H * 0.55 - 4, 7, 10, 2); fs(c, '#8d99ae', OL, 2);
  };

  function table(c, x, y, w, h, felt, rim) { // rounded table top + front face
    rr(c, x - w / 2, y - h + 12, w, h, 22); fs(c, shade(rim, -0.35), OL, 3);
    rr(c, x - w / 2, y - h, w, h, 22); fs(c, rim, OL, 3);
    var g = c.createRadialGradient(x, y - h * 0.7, 10, x, y - h / 2, w * 0.7); g.addColorStop(0, shade(felt, 0.15)); g.addColorStop(1, shade(felt, -0.2));
    rr(c, x - w / 2 + 9, y - h + 9, w - 18, h - 18, 16); fs(c, g, 'rgba(0,0,0,.35)', 2);
  }
  function card(c, x, y, rot, face) {
    c.save(); c.translate(x, y); c.rotate(rot); rr(c, -6, -8.5, 12, 17, 2.5); fs(c, '#fff', OL, 1.6);
    if (face) { c.fillStyle = face.red ? '#d00' : '#111'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(face.s, 0, 0); }
    else { c.fillStyle = '#2b3bb0'; c.fillRect(-4, -6.5, 8, 13); }
    c.restore();
  }
  function chips(c, x, y, col, n) { for (var i = 0; i < n; i++) { ell(c, x, y - i * 2.6, 6, 3); fs(c, col, OL, 1.4); } c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - 1, y - (n - 1) * 2.6 - 1, 2, 1.5); }
  A.NPC = {
    dealer: { skin: 'gim', body: '#2b2d42', hat: '', acc: 'bowtie' },
    croupier: { skin: 'gim', body: '#d62828', hat: 'top', acc: 'bowtie' },
    shop: { skin: 'bear', body: '#f4a261', hat: 'cap', acc: 'stache' },
    guard: { skin: 'robot', body: 'm:chrome', hat: '', acc: 'shades' },
  };
  O.blackjack = function (c, o, t, ctx) {
    var x = o.x, y = o.y;
    A.drawGim(c, x, y - 70, A.NPC.dealer, { t: t, lookAt: ctx.lookAt(x, y - 90), blink: ctx.blink(o.v || 1) });
    shadow(c, x, y + 4, 86, 12);
    table(c, x, y, 168, 70, '#16794a', '#6b3a1e');
    c.strokeStyle = 'rgba(255,215,120,.55)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y - 52, 62, 22, 0, 0.1, Math.PI - 0.1); c.stroke();
    A.label(c, 'BLACKJACK PAYS 3:2', x, y - 39, { size: 8, color: '#ffe8a3', stroke: false, weight: 600 });
    card(c, x - 8, y - 54, -0.1, { s: 'A♠' }); card(c, x + 6, y - 54, 0.12, null);
    [-52, -18, 18, 52].forEach(function (dx, i) { card(c, x + dx - 4, y - 24 + Math.abs(dx) * 0.1, -0.2, { s: ['K♥', '9♣', 'Q♦', '7♠'][i], red: i % 2 === 0 }); card(c, x + dx + 5, y - 23 + Math.abs(dx) * 0.1, 0.15, { s: ['5♦', 'J♠', '3♥', 'A♣'][i], red: i % 2 === 1 }); });
    chips(c, x + 58, y - 52, '#e63946', 4); chips(c, x + 46, y - 50, '#3a86ff', 3); chips(c, x - 56, y - 52, '#2bd576', 5);
  };
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var WHEELN = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  O.roulette = function (c, o, t, ctx) {
    var x = o.x, y = o.y, active = o.flash && t - o.flash < 2.5;
    A.drawGim(c, x + 40, y - 72, A.NPC.croupier, { t: t, lookAt: ctx.lookAt(x + 40, y - 92), blink: ctx.blink(2) });
    shadow(c, x, y + 4, 96, 12);
    table(c, x, y, 190, 76, '#13804e', '#5a2d14');
    // wheel
    var wx = x - 52, wy = y - 40, R = 30;
    circ(c, wx, wy, R + 6); fs(c, '#6b3a1e', OL, 3);
    var rot = t * (active ? 6 : 0.5);
    for (var i = 0; i < 37; i++) { var a0 = rot + i / 37 * TAU, a1 = rot + (i + 1) / 37 * TAU; c.beginPath(); c.moveTo(wx, wy); c.arc(wx, wy, R, a0, a1); c.closePath(); var n = WHEELN[i]; c.fillStyle = n === 0 ? '#1f9d55' : REDS.indexOf(n) >= 0 ? '#c1121f' : '#16161e'; c.fill(); }
    c.strokeStyle = OL; c.lineWidth = 2; circ(c, wx, wy, R); c.stroke();
    circ(c, wx, wy, 13); fs(c, '#8a5a2b', OL, 2); circ(c, wx, wy, 5); fs(c, '#ffcf3f', OL, 1.5);
    c.strokeStyle = '#ffcf3f'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(wx - 10, wy); c.lineTo(wx + 10, wy); c.moveTo(wx, wy - 10); c.lineTo(wx, wy + 10); c.stroke();
    var ba = -t * (active ? 9 : 1.2); circ(c, wx + Math.cos(ba) * (R - 4), wy + Math.sin(ba) * (R - 4), 2.8); fs(c, '#fff', OL, 1);
    // betting grid
    var gx = x - 12, gy = y - 62, cw = 9.5, ch = 13;
    rr(c, gx - 10, gy, 9, ch * 3, 2); fs(c, '#1f9d55', 'rgba(255,255,255,.6)', 1);
    for (var col = 0; col < 10; col++) for (var row = 0; row < 3; row++) { var num = col * 3 + (3 - row); c.fillStyle = REDS.indexOf(num) >= 0 ? '#c1121f' : '#16161e'; c.fillRect(gx + col * cw, gy + row * ch, cw - 1, ch - 1); }
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.strokeRect(gx - 0.5, gy - 0.5, cw * 10, ch * 3);
    chips(c, gx + 20, gy + 18, '#ffd166', 3); chips(c, gx + 60, gy + 30, '#3a86ff', 2);
  };
  function die(c, x, y, s, n, rot) {
    c.save(); c.translate(x, y); c.rotate(rot); rr(c, -s / 2, -s / 2, s, s, s * 0.22); fs(c, '#fff', OL, 2);
    var P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
    c.fillStyle = n === 1 ? '#e63946' : '#111'; P.forEach(function (p) { circ(c, p[0] * s * 0.26, p[1] * s * 0.26, s * 0.09); c.fill(); }); c.restore();
  }
  O.dice = function (c, o, t, ctx) {
    var x = o.x, y = o.y, active = o.flash && t - o.flash < 1.2;
    A.drawGim(c, x, y - 72, A.NPC.croupier, { t: t, lookAt: ctx.lookAt(x, y - 92), blink: ctx.blink(3) });
    shadow(c, x, y + 4, 92, 12);
    table(c, x, y, 180, 74, '#1b6fae', '#3d2a6e');
    A.label(c, 'DICE', x, y - 40, { size: 20, color: 'rgba(255,255,255,.25)', stroke: false });
    c.strokeStyle = 'rgba(255,255,255,.4)'; c.setLineDash([4, 4]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 70, y - 40); c.lineTo(x + 70, y - 40); c.stroke(); c.setLineDash([]);
    var ph = active ? t * 12 : Math.floor(t / 3) * 3;
    var n1 = 1 + (Math.floor(ph * 1.7) % 6), n2 = 1 + (Math.floor(ph * 2.3 + 2) % 6);
    var j = active ? Math.sin(t * 30) * 3 : 0;
    die(c, x - 14 + j, y - 46, 16, n1, active ? t * 9 : 0.2); die(c, x + 14 - j, y - 42, 16, n2, active ? -t * 8 : -0.25);
    chips(c, x - 62, y - 32, '#ffd166', 4); chips(c, x + 64, y - 34, '#e63946', 3);
  };
  O.coinflip = function (c, o, t) {
    var x = o.x, y = o.y, active = o.flash && t - o.flash < 1.2;
    shadow(c, x, y, 32, 9);
    rr(c, x - 28, y - 18, 56, 18, 6); fs(c, '#8d99ae', OL, 3);
    rr(c, x - 18, y - 52, 36, 36, 4); fs(c, '#b8c1d4', OL, 3);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x - 13, y - 50, 5, 32);
    ell(c, x, y - 54, 26, 8); fs(c, '#6c7a96', OL, 3);
    var cy = y - 100 + Math.sin(t * 2) * 5, sx = Math.abs(Math.cos(t * (active ? 14 : 2.2)));
    var gl = c.createRadialGradient(x, cy, 4, x, cy, 46); gl.addColorStop(0, 'rgba(255,209,102,.45)'); gl.addColorStop(1, 'rgba(255,209,102,0)'); c.fillStyle = gl; circ(c, x, cy, 46); c.fill();
    c.save(); c.translate(x, cy); c.scale(Math.max(0.08, sx), 1);
    circ(c, 0, 0, 24); var g = c.createLinearGradient(-24, -24, 24, 24); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#d48a00'); fs(c, g, OL, 3);
    circ(c, 0, 0, 17); c.strokeStyle = 'rgba(140,80,0,.6)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#9a5b00'; c.font = '800 22px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Math.cos(t * (active ? 14 : 2.2)) > 0 ? 'S' : '★', 0, 1);
    c.restore();
  };
  O.mines = function (c, o, t) {
    var x = o.x, y = o.y, active = o.flash && t - o.flash < 1.5;
    shadow(c, x, y + 4, 70, 10);
    rr(c, x - 64, y - 76, 128, 82, 12); fs(c, '#141a33', OL, 3);
    rr(c, x - 64, y - 88, 128, 82, 12); fs(c, '#232c55', OL, 3);
    var glow = active ? '#ff3b5c' : '#5cf2ff';
    c.shadowColor = glow; c.shadowBlur = 10; c.strokeStyle = glow; c.lineWidth = 2; rr(c, x - 56, y - 80, 112, 66, 8); c.stroke(); c.shadowBlur = 0;
    var gw = 19, gh = 11.5;
    for (var r = 0; r < 5; r++) for (var k = 0; k < 5; k++) {
      var tx = x - 49 + k * gw, ty = y - 76 + r * gh; var id = r * 5 + k;
      var rev = ((id * 7 + Math.floor(t / 2)) % 9) === 0, bomb = active && id === 12;
      rr(c, tx, ty, gw - 3, gh - 3, 3); c.fillStyle = bomb ? '#ff3b5c' : rev ? '#14532d' : '#3b4a8a'; c.fill();
      if (rev && !bomb) { c.font = '8px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('💎', tx + (gw - 3) / 2, ty + (gh - 3) / 2 + 0.5); }
      if (bomb) { c.font = '8px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('💣', tx + (gw - 3) / 2, ty + (gh - 3) / 2 + 0.5); }
    }
    A.neon(c, 'MINES', x, y - 100, '#ff3b5c', 14, t, 4);
  };
  O.plinko = function (c, o, t) {
    var x = o.x, y = o.y, W = 108, H = 160, active = o.flash && t - o.flash < 2;
    shadow(c, x, y, W * 0.55, 9);
    rr(c, x - W / 2, y - H, W, H, 12); fs(c, '#1a1440', OL, 3);
    rr(c, x - W / 2 + 7, y - H + 26, W - 14, H - 54, 8); fs(c, '#0c0a24', 'rgba(255,110,199,.6)', 2);
    A.neon(c, 'PLINKO', x, y - H + 13, '#ff6ec7', 14, t, 2);
    var rows = 8, top = y - H + 36, rh = 11, pw = 10.5;
    c.fillStyle = 'rgba(255,255,255,.75)';
    for (var r = 0; r < rows; r++) for (var k = 0; k <= r + 2; k++) { circ(c, x + (k - (r + 2) / 2) * pw, top + r * rh, 1.6); c.fill(); }
    var nb = active ? 6 : 3;
    for (var b = 0; b < nb; b++) {
      var ph = ((t * 0.55 + b / nb) % 1), fr = ph * rows, ri = Math.floor(fr), xs = 0;
      for (var q = 0; q < ri; q++) xs += (((q * 31 + b * 17 + Math.floor(t * 0.55 + b / nb) * 7) % 2) ? 0.5 : -0.5);
      var nxt = xs + ((((ri) * 31 + b * 17 + Math.floor(t * 0.55 + b / nb) * 7) % 2) ? 0.5 : -0.5);
      var fx = xs + (nxt - xs) * (fr - ri);
      circ(c, x + fx * pw, top + fr * rh - 4, 3.4); fs(c, ['#ffd166', '#5cf2ff', '#b8ff5c', '#ff6ec7', '#fff', '#ff922b'][b], OL, 1.2);
    }
    var cols = ['#ff3b5c', '#ff922b', '#ffd166', '#2bd576', '#5cf2ff', '#2bd576', '#ffd166', '#ff922b', '#ff3b5c'];
    for (var s = 0; s < 9; s++) { rr(c, x - 45 + s * 10, y - 26, 9, 9, 2); c.fillStyle = cols[s]; c.fill(); }
    rr(c, x - W / 2 + 10, y - 14, W - 20, 8, 3); fs(c, '#2a1f4d', OL, 1.5);
  };
  var WSEG = [0, 1.5, 0, 2, 0, 1.2, 0, 1.5, 0, 3, 0, 1.2, 0, 1.5, 0, 2, 0, 1.2, 0, 4];
  O.wheel = function (c, o, t) {
    var x = o.x, y = o.y, R = 74, cy = y - 108, active = o.flash && t - o.flash < 4;
    shadow(c, x, y, 60, 10);
    c.strokeStyle = OL; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 40, y - 4); c.lineTo(x, cy); c.lineTo(x + 40, y - 4); c.stroke();
    c.strokeStyle = '#8a5a2b'; c.lineWidth = 7; c.stroke();
    rr(c, x - 50, y - 12, 100, 14, 6); fs(c, '#5a3a1c', OL, 3);
    circ(c, x, cy, R + 10); fs(c, '#ffcf3f', OL, 3);
    var rot = active ? t * 5 : t * 0.35;
    for (var i = 0; i < WSEG.length; i++) {
      var a0 = rot + i / WSEG.length * TAU, a1 = rot + (i + 1) / WSEG.length * TAU, m = WSEG[i];
      c.beginPath(); c.moveTo(x, cy); c.arc(x, cy, R, a0, a1); c.closePath();
      c.fillStyle = m === 0 ? '#3a1020' : m >= 3 ? '#2bd576' : m >= 2 ? '#3a86ff' : m >= 1.5 ? '#9b5de5' : '#ff922b'; c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.stroke();
      var am = (a0 + a1) / 2; c.save(); c.translate(x + Math.cos(am) * R * 0.72, cy + Math.sin(am) * R * 0.72); c.rotate(am + Math.PI / 2);
      c.fillStyle = m === 0 ? '#ff6b6b' : '#fff'; c.font = '700 10px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m === 0 ? '✖' : m + 'x', 0, 0); c.restore();
    }
    for (var b = 0; b < 20; b++) { var ab = b / 20 * TAU; circ(c, x + Math.cos(ab) * (R + 5), cy + Math.sin(ab) * (R + 5), 2.6); var on = (b + Math.floor(t * (active ? 16 : 3))) % 3 === 0; c.fillStyle = on ? '#fff' : '#b07b00'; c.fill(); }
    circ(c, x, cy, R); c.strokeStyle = OL; c.lineWidth = 3; c.stroke();
    circ(c, x, cy, 14); fs(c, '#ffcf3f', OL, 3); circ(c, x, cy, 5); fs(c, '#e63946', OL, 2);
    c.beginPath(); c.moveTo(x - 11, cy - R - 16); c.lineTo(x + 11, cy - R - 16); c.lineTo(x, cy - R + 4); c.closePath(); fs(c, '#e63946', OL, 3);
  };
  O.crash = function (c, o, t) {
    var x = o.x, y = o.y, active = o.flash && t - o.flash < 2;
    shadow(c, x, y, 70, 11);
    ell(c, x - 18, y - 10, 52, 18); fs(c, '#3d4663', OL, 3);
    ell(c, x - 18, y - 14, 46, 15); fs(c, '#5b6687', null);
    c.save(); ell(c, x - 18, y - 14, 46, 15); c.clip(); c.fillStyle = '#ffd166'; for (var s = -60; s < 60; s += 14) { c.beginPath(); c.moveTo(x - 18 + s, y - 30); c.lineTo(x - 18 + s + 7, y - 30); c.lineTo(x - 18 + s - 3, y); c.lineTo(x - 18 + s - 10, y); c.closePath(); c.fill(); } c.restore();
    ell(c, x - 18, y - 14, 30, 9); fs(c, '#2a3150', OL, 2);
    var lift = active ? Math.min(60, (t - o.flash) * 70) : Math.sin(t * 2) * 2;
    var rx = x - 18, ry = y - 22 - lift;
    // flame
    var fl = 10 + Math.random() * 8 + (active ? 14 : 0);
    c.beginPath(); c.moveTo(rx - 9, ry); c.quadraticCurveTo(rx, ry + fl * 1.8, rx + 9, ry); c.closePath(); c.fillStyle = '#ff922b'; c.fill();
    c.beginPath(); c.moveTo(rx - 5, ry); c.quadraticCurveTo(rx, ry + fl, rx + 5, ry); c.closePath(); c.fillStyle = '#fff3a3'; c.fill();
    [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(rx + k * 10, ry - 22); c.lineTo(rx + k * 22, ry + 2); c.lineTo(rx + k * 9, ry - 4); c.closePath(); fs(c, '#e63946', OL, 2.5); });
    rr(c, rx - 13, ry - 58, 26, 58, 12); fs(c, '#f1f3f9', OL, 3);
    c.beginPath(); c.moveTo(rx - 12, ry - 46); c.quadraticCurveTo(rx, ry - 82, rx + 12, ry - 46); c.closePath(); fs(c, '#e63946', OL, 3);
    circ(c, rx, ry - 34, 7); fs(c, '#5cf2ff', OL, 2.5); circ(c, rx - 2, ry - 36, 2); c.fillStyle = '#fff'; c.fill();
    // screen
    var sx = x + 52, sy = y - 98;
    c.strokeStyle = OL; c.lineWidth = 6; c.beginPath(); c.moveTo(sx, sy + 50); c.lineTo(sx, y - 4); c.stroke(); c.strokeStyle = '#8d99ae'; c.lineWidth = 3; c.stroke();
    rr(c, sx - 34, sy, 68, 52, 7); fs(c, '#0b0f24', OL, 3);
    var cyc = (t % 6) / 6, m = Math.exp(cyc * 2.2);
    c.strokeStyle = cyc > 0.92 ? '#ff3b5c' : '#5cf2ff'; c.lineWidth = 2; c.beginPath();
    for (var i = 0; i <= 20; i++) { var p = i / 20 * cyc; c.lineTo(sx - 28 + p * 56, sy + 46 - (Math.exp(p * 2.2) - 1) / 8 * 34); } c.stroke();
    A.label(c, (cyc > 0.92 ? '💥 ' : '') + m.toFixed(2) + 'x', sx, sy + 15, { size: 12, color: cyc > 0.92 ? '#ff3b5c' : '#b8ff5c', lw: 3 });
    A.neon(c, 'CRASH', x - 18, y - 140, '#5cf2ff', 15, t, 3);
  };
  function crate(c, x, y, w, h, col, glow) {
    rr(c, x - w / 2, y - h, w, h, 4); fs(c, col, OL, 2.5);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x - w / 2 + 3, y - h * 0.55, w - 6, 3);
    rr(c, x - 5, y - h * 0.62, 10, 8, 2); fs(c, glow || '#ffd166', OL, 1.5);
  }
  O.casebox = function (c, o, t) {
    var x = o.x, y = o.y, W = 86, H = 112, hi = o.v === 1, active = o.flash && t - o.flash < 4;
    var accent = hi ? '#ffd166' : '#b185ff';
    shadow(c, x, y, W * 0.6, 9);
    rr(c, x - W / 2, y - H, W, H, 10); fs(c, '#2b2150', OL, 3);
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x - W / 2 + 5, y - H + 5, 5, H - 10);
    rr(c, x - W / 2 + 8, y - H + 22, W - 16, 56, 8); fs(c, '#0e0a24', accent, 2.5);
    c.save(); c.translate(x, y - H + 56 + Math.sin(t * 2) * 3); c.rotate(active ? Math.sin(t * 20) * 0.15 : Math.sin(t) * 0.05);
    crate(c, 0, 12, 34, 26, hi ? '#c99a2e' : '#7b4fd6', accent); c.restore();
    var gl = c.createRadialGradient(x, y - H + 50, 2, x, y - H + 50, 40); gl.addColorStop(0, hi ? 'rgba(255,209,102,.35)' : 'rgba(177,133,255,.35)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gl; c.fillRect(x - 40, y - H + 20, 80, 60);
    A.label(c, hi ? 'HIGH ROLLER' : 'STARTER', x, y - H + 11, { size: 10, color: accent, lw: 3, maxW: W - 10 });
    rr(c, x - W / 2 + 10, y - 28, W - 20, 16, 5); fs(c, '#140d29', OL, 2);
    A.label(c, hi ? '📜 5,000' : '📜 1,000', x, y - 20, { size: 10, color: '#fff', stroke: false, maxW: W - 26 });
  };
  O.arena = function (c, o, t) {
    var x = o.x, y = o.y, pulse = (Math.sin(t * 3) + 1) / 2;
    shadow(c, x, y, 92, 16);
    ell(c, x, y - 12, 90, 34); fs(c, '#3d3566', OL, 3);
    ell(c, x, y - 18, 86, 31); fs(c, '#4e4580', null);
    c.shadowColor = '#ff3b5c'; c.shadowBlur = 14; c.strokeStyle = 'rgba(255,59,92,' + (0.5 + pulse * 0.5) + ')'; c.lineWidth = 3; ell(c, x, y - 18, 66, 22); c.stroke(); c.shadowBlur = 0;
    [[-62, 0], [62, 0], [0, -24], [0, 22]].forEach(function (p) { circ(c, x + p[0], y - 18 + p[1] * 0.9, 7); fs(c, '#ffd166', OL, 2); });
    var hy = y - 74 + Math.sin(t * 2) * 4;
    c.globalAlpha = 0.85;
    [-1, 1].forEach(function (k) {
      c.save(); c.translate(x, hy); c.rotate(k * 0.75);
      rr(c, -3.5, -34, 7, 44, 3); fs(c, '#dfe7ff', OL, 2.5); c.beginPath(); c.moveTo(-3.5, -34); c.lineTo(0, -42); c.lineTo(3.5, -34); c.closePath(); fs(c, '#dfe7ff', OL, 2);
      rr(c, -11, 8, 22, 5, 2); fs(c, '#ffd166', OL, 2); rr(c, -2.5, 13, 5, 12, 2); fs(c, '#7b2cbf', OL, 2);
      c.restore();
    });
    c.globalAlpha = 1;
    A.neon(c, 'CASE BATTLES', x, y - 124, '#ff3b5c', 14, t, 5);
  };
  O.shop = function (c, o, t, ctx) {
    var x = o.x, y = o.y, W = 260;
    A.drawGim(c, x - 20, y - 64, A.NPC.shop, { t: t, lookAt: ctx.lookAt(x - 20, y - 84), blink: ctx.blink(4) });
    shadow(c, x, y + 2, W * 0.52, 10);
    rr(c, x - W / 2, y - 46, W, 46, 6); fs(c, '#7a4a22', OL, 3);
    for (var i = 0; i < 5; i++) { rr(c, x - W / 2 + 10 + i * (W - 20) / 5, y - 38, (W - 20) / 5 - 8, 30, 4); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.stroke(); }
    rr(c, x - W / 2 - 6, y - 60, W + 12, 18, 6); fs(c, '#c08552', OL, 3);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x - W / 2, y - 57, W, 3);
    // register
    rr(c, x + 58, y - 82, 40, 26, 5); fs(c, '#3d405b', OL, 2.5); rr(c, x + 63, y - 92, 30, 13, 3); fs(c, '#2bd576', OL, 2);
    A.label(c, '$$$', x + 78, y - 85, { size: 8, color: '#04210f', stroke: false });
    // items on counter: a hat on a stand + gift box
    c.save(); c.translate(x + 26, 0); A.drawHat(c, 'top', y - 66, 0, 0, t); c.restore();
    c.save(); c.translate(x - 90, 0); A.drawHat(c, 'crown', y - 66, 0, 0, t); c.restore();
    c.save(); c.translate(x - 40, 0); rr(c, -9, y - 76, 18, 16, 3); fs(c, '#ff6ec7', OL, 2); c.fillStyle = '#ffd166'; c.fillRect(-2, y - 76, 4, 16); c.restore();
  };
  O.shelf = function (c, o, t) {
    var x = o.x, y = o.y, W = o.w || 140;
    rr(c, x - W / 2, y - 64, W, 10, 3); fs(c, '#8b5a2b', OL, 3);
    rr(c, x - W / 2, y - 26, W, 10, 3); fs(c, '#8b5a2b', OL, 3);
    var items = o.items || [];
    items.forEach(function (it, i) {
      var ix = x - W / 2 + (i % Math.ceil(items.length / 2) + 0.5) * (W / Math.ceil(items.length / 2));
      var iy = i < Math.ceil(items.length / 2) ? y - 64 : y - 26;
      c.save(); c.translate(ix, 0);
      if (it.k === 'hat') A.drawHat(c, it.v, iy - 6, 0, 0, t);
      else if (it.k === 'acc') { c.save(); c.translate(0, iy - 26); A.drawAcc(c, it.v, 0, 0, 0, t, '#fff'); c.restore(); }
      c.restore();
    });
  };
  O.wardrobe = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y, 70, 10);
    // rack
    var rx = x + 34;
    c.strokeStyle = OL; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(rx - 30, y - 4); c.lineTo(rx - 30, y - 92); c.lineTo(rx + 30, y - 92); c.lineTo(rx + 30, y - 4); c.stroke();
    c.strokeStyle = '#c0c6d6'; c.lineWidth = 3; c.stroke();
    ['#e63946', '#3a86ff', '#ffd166', '#2bd576'].forEach(function (col, i) { var hx = rx - 20 + i * 13 + Math.sin(t * 1.5 + i) * 1.2; c.strokeStyle = OL; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx, y - 92); c.lineTo(hx, y - 86); c.stroke(); rr(c, hx - 7, y - 86, 14, 34, 5); fs(c, col, OL, 2); });
    // mirror
    var mx = x - 26, my = y - 58;
    rr(c, mx - 6, y - 10, 12, 10, 2); fs(c, '#8b5a2b', OL, 2);
    ell(c, mx, my, 30, 50); fs(c, '#d4a63a', OL, 3);
    var g = c.createLinearGradient(mx - 24, my - 44, mx + 24, my + 44); g.addColorStop(0, '#cfe8ff'); g.addColorStop(0.5, '#8fb7e8'); g.addColorStop(1, '#4b6fa8');
    ell(c, mx, my, 23, 43); fs(c, g, 'rgba(0,0,0,.3)', 2);
    c.save(); ell(c, mx, my, 23, 43); c.clip(); var sh = ((t * 0.5) % 2) * 100 - 50; c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.moveTo(mx + sh - 10, my - 50); c.lineTo(mx + sh, my - 50); c.lineTo(mx + sh - 30, my + 50); c.lineTo(mx + sh - 40, my + 50); c.closePath(); c.fill(); c.restore();
    A.label(c, '✨', mx + 16, my - 36 + Math.sin(t * 3) * 3, { size: 12, stroke: false });
  };
  O.atm = function (c, o, t) {
    var x = o.x, y = o.y, W = 60, H = 96;
    shadow(c, x, y, 38, 8);
    rr(c, x - W / 2, y - H, W, H, 9); fs(c, '#1d6fa5', OL, 3);
    c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x - W / 2 + 5, y - H + 5, 5, H - 10);
    rr(c, x - W / 2 + 6, y - H - 14, W - 12, 18, 6); fs(c, '#0b3a5c', OL, 2.5);
    A.neon(c, 'ATM', x, y - H - 5, '#5cf2ff', 12, t, 6);
    rr(c, x - W / 2 + 8, y - H + 10, W - 16, 32, 5); fs(c, '#062a1a', OL, 2.5);
    A.label(c, '📜 DAILY', x, y - H + 26, { size: 9, color: '#2bd576', stroke: false, glow: '#2bd576', maxW: W - 20 });
    for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) { rr(c, x - 14 + k * 10, y - H + 48 + r * 8, 8, 6, 1.5); c.fillStyle = '#dbe4f3'; c.fill(); }
    rr(c, x - 16, y - 18, 32, 6, 3); fs(c, '#0b1d2e', OL, 1.5);
    if (Math.floor(t * 2) % 2) { circ(c, x + 20, y - H + 50, 2.5); c.fillStyle = '#2bd576'; c.fill(); }
  };
  // Game cabinet used by the newer games: colour and label come from the object.
  O.cabinet = function (c, o, t) {
    var x = o.x, y = o.y, W = 58, H = 104, col = o.col || '#5a189a', ph = (o.v || 0) * 1.7;
    shadow(c, x, y, 38, 8);
    rr(c, x - W / 2, y - H, W, H, 10); fs(c, col, OL, 3);
    c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(x - W / 2 + 5, y - H + 6, 5, H - 12);
    rr(c, x - W / 2 + 4, y - H - 12, W - 8, 20, 7); fs(c, '#140d33', OL, 2.5);
    A.label(c, o.name || 'GAME', x, y - H - 2, { size: 10, color: '#fff', stroke: false, glow: o.glow || '#5cf2ff', maxW: W - 16 });
    rr(c, x - 21, y - H + 14, 42, 40, 6); fs(c, '#071126', OL, 2.5);
    var g = c.createLinearGradient(0, y - H + 16, 0, y - H + 52); g.addColorStop(0, 'rgba(92,242,255,.35)'); g.addColorStop(1, 'rgba(92,242,255,.05)'); c.fillStyle = g; c.fillRect(x - 19, y - H + 16, 38, 36);
    A.label(c, o.icon || '?', x, y - H + 35 + Math.sin(t * 2 + ph) * 1.5, { size: 22, stroke: false });
    rr(c, x - 17, y - 40, 34, 11, 5); fs(c, '#0b0a1f', OL, 2);
    [[-9, '#ff5c6c'], [0, '#ffd23f'], [9, '#37e2a1']].forEach(function (b, i) { circ(c, x + b[0], y - 34.5, 3.2); c.fillStyle = Math.floor(t * 2 + i + ph) % 3 === i ? b[1] : 'rgba(255,255,255,.28)'; c.fill(); });
    rr(c, x - 20, y - 20, 40, 8, 4); fs(c, '#0b0a1f', OL, 1.5);
    if (Math.floor(t * 3 + ph) % 2) { circ(c, x + 24, y - H + 18, 2.4); c.fillStyle = o.glow || '#5cf2ff'; c.fill(); }
  };

  // ---- Stations for the newer games: each looks like what it is (tables and stands) ----
  function gcard(c, x, y, w, h, face, txt, col) {
    rr(c, x - w / 2, y - h / 2, w, h, 3); fs(c, face ? '#fffdf2' : '#7c1d3a', OL, 1.6);
    if (face && txt) A.label(c, txt, x, y, { size: Math.max(8, w * 0.55), color: col || '#b91c1c', stroke: false });
    else if (!face) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.strokeRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6); }
  }
  function gtop(c, x, y, W, felt, name, glow) {
    shadow(c, x, y + 4, W / 2 + 6, 10);
    rr(c, x - W / 2 + 6, y - 30, 12, 30, 3); fs(c, '#3b2a1a', OL, 2.5); rr(c, x + W / 2 - 18, y - 30, 12, 30, 3); fs(c, '#3b2a1a', OL, 2.5);
    rr(c, x - W / 2, y - 62, W, 38, 14); fs(c, '#5b3a1e', OL, 3);
    rr(c, x - W / 2 + 6, y - 58, W - 12, 28, 10); fs(c, felt, 'rgba(0,0,0,.35)', 2);
    rr(c, x - 48, y - 108, 96, 20, 8); fs(c, '#140d33', OL, 2.5);
    A.label(c, name, x, y - 98, { size: 11, color: '#fff', stroke: false, glow: glow || '#5cf2ff', maxW: 86 });
  }
  function gbody(c, x, y, W, H, col, name, glow) {
    shadow(c, x, y, W / 2 + 8, 8);
    rr(c, x - W / 2, y - H, W, H, 10); fs(c, col, OL, 3);
    c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(x - W / 2 + 5, y - H + 6, 5, H - 12);
    rr(c, x - W / 2 + 4, y - H - 14, W - 8, 22, 7); fs(c, '#140d33', OL, 2.5);
    A.label(c, name, x, y - H - 3, { size: 11, color: '#fff', stroke: false, glow: glow || '#5cf2ff', maxW: W - 14 });
  }
  var GS = {
    baccarat: function (c, o, t) { var x = o.x, y = o.y; gtop(c, x, y, 150, '#0f6b45', 'BACCARAT', '#ffd166'); gcard(c, x - 24, y - 44, 18, 25, true, 'K', '#111'); gcard(c, x - 4, y - 44, 18, 25, true, '7'); gcard(c, x + 26, y - 44, 18, 25, false); gcard(c, x + 46, y - 44, 18, 25, true, 'A', '#111'); circ(c, x, y - 36 + Math.sin(t * 2) * 0, 0); },
    war: function (c, o, t) { var x = o.x, y = o.y, fl = Math.abs(Math.cos(t * 1.4)); gtop(c, x, y, 140, '#7f1d1d', 'WAR', '#ff7b7b'); gcard(c, x - 24, y - 44, 22, 30, false); c.save(); c.translate(x + 24, y - 44); c.scale(Math.max(0.12, fl), 1); gcard(c, 0, 0, 22, 30, Math.cos(t * 1.4) > 0, 'Q', '#b91c1c'); c.restore(); },
    shell: function (c, o, t) { var x = o.x, y = o.y; gtop(c, x, y, 150, '#7a4e1a', 'SHELLS', '#ffd166'); [-30, 0, 30].forEach(function (d, i) { var lift = Math.max(0, Math.sin(t * 2 + i * 2.1)) * 5, cx = x + d, cy = y - 38 - lift; c.beginPath(); c.moveTo(cx - 12, cy + 8); c.quadraticCurveTo(cx - 12, cy - 14, cx, cy - 14); c.quadraticCurveTo(cx + 12, cy - 14, cx + 12, cy + 8); c.closePath(); fs(c, ['#e63946', '#2a9d8f', '#e9c46a'][i], OL, 2.5); }); },
    keno: function (c, o, t) { var x = o.x, y = o.y; gbody(c, x, y, 92, 104, '#1f6fd1', 'KENO', '#5cf2ff'); rr(c, x - 38, y - 96, 76, 62, 5); fs(c, '#071126', OL, 2.5); for (var r = 0; r < 5; r++) for (var q = 0; q < 8; q++) { var on = ((q * 7 + r * 13 + Math.floor(t * 2.2)) % 9) === 0; c.fillStyle = on ? '#ffd23f' : 'rgba(150,190,255,.35)'; c.fillRect(x - 34 + q * 9, y - 92 + r * 11, 7, 8); } rr(c, x - 22, y - 26, 44, 12, 5); fs(c, '#0b0a1f', OL, 2); },
    scratch: function (c, o, t) { var x = o.x, y = o.y; gbody(c, x, y, 78, 100, '#c2410c', 'SCRATCH', '#ffd166'); for (var i = 0; i < 3; i++) { rr(c, x - 28 + i * 20, y - 82 + (i % 2) * 3, 17, 26, 3); fs(c, ['#ffd23f', '#37e2a1', '#ff7ab6'][i], OL, 2); A.label(c, '?', x - 19.5 + i * 20, y - 69 + (i % 2) * 3, { size: 13, color: '#1b1636', stroke: false }); } rr(c, x - 30, y - 44, 60, 26, 5); fs(c, '#071126', OL, 2.5); A.label(c, 'WIN ' + (Math.floor(t) % 2 ? '1000' : '5000'), x, y - 31, { size: 10, color: '#b8ff5c', stroke: false }); },
    penalty: function (c, o, t) { var x = o.x, y = o.y, k = Math.sin(t * 2.2) * 24, by = y - 18 - Math.abs(Math.sin(t * 2.2)) * 22; shadow(c, x, y, 62, 8); c.strokeStyle = '#fff'; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x - 54, y); c.lineTo(x - 54, y - 80); c.lineTo(x + 54, y - 80); c.lineTo(x + 54, y); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; for (var i = -48; i <= 48; i += 12) { c.beginPath(); c.moveTo(x + i, y - 78); c.lineTo(x + i, y - 2); c.stroke(); } for (var j = -70; j < 0; j += 12) { c.beginPath(); c.moveTo(x - 52, y + j); c.lineTo(x + 52, y + j); c.stroke(); } rr(c, x - 10 + k, y - 56, 20, 34, 6); fs(c, '#facc15', OL, 2.5); circ(c, x + k * -0.6, by, 8); fs(c, '#fff', OL, 2); rr(c, x - 36, y - 104, 72, 18, 7); fs(c, '#140d33', OL, 2.5); A.label(c, 'PENALTY', x, y - 95, { size: 10, color: '#fff', stroke: false, glow: '#b8ff5c', maxW: 64 }); },
    hilo: function (c, o, t) { var x = o.x, y = o.y; gbody(c, x, y, 84, 96, '#be185d', 'HI-LO', '#ff9ad0'); var up = Math.floor(t * 1.2) % 2; gcard(c, x, y - 64, 40, 54, true, ['9', 'K', '3', 'A'][Math.floor(t * 1.2) % 4], '#b91c1c'); c.fillStyle = up ? '#b8ff5c' : 'rgba(255,255,255,.3)'; c.beginPath(); c.moveTo(x - 30, y - 56); c.lineTo(x - 22, y - 74); c.lineTo(x - 14, y - 56); c.closePath(); c.fill(); c.fillStyle = up ? 'rgba(255,255,255,.3)' : '#ff7b7b'; c.beginPath(); c.moveTo(x + 14, y - 72); c.lineTo(x + 22, y - 54); c.lineTo(x + 30, y - 72); c.closePath(); c.fill(); },
    poker: function (c, o, t) { var x = o.x, y = o.y; gbody(c, x, y, 96, 100, '#1d4ed8', 'POKER', '#93c5fd'); rr(c, x - 40, y - 92, 80, 46, 5); fs(c, '#061436', OL, 2.5); ['A', 'K', 'Q', 'J', '10'].forEach(function (cd, i) { gcard(c, x - 32 + i * 16, y - 70, 13, 22, true, cd, i % 2 ? '#111' : '#b91c1c'); }); rr(c, x - 24, y - 36, 48, 12, 5); fs(c, '#0b0a1f', OL, 2); if (Math.floor(t * 2) % 2) { circ(c, x + 34, y - 36, 3); c.fillStyle = '#ffd23f'; c.fill(); } },
    echo: function (c, o, t) { var x = o.x, y = o.y, lit = Math.floor(t * 1.6) % 4; gbody(c, x, y, 88, 100, '#4c1d95', 'ECHO', '#c4b5fd'); ['#ff5c6c', '#3a86ff', '#2bd576', '#ffd166'].forEach(function (col, i) { var px = x - 20 + (i % 2) * 40, py = y - 78 + Math.floor(i / 2) * 34; rr(c, px - 17, py - 14, 34, 28, 7); fs(c, col, OL, 2.5); if (i !== lit) { c.fillStyle = 'rgba(10,6,30,.5)'; c.fill(); } }); },
    aim: function (c, o, t) { var x = o.x, y = o.y; gbody(c, x, y, 88, 100, '#9f1239', 'AIM', '#fda4af'); rr(c, x - 36, y - 90, 72, 52, 5); fs(c, '#071126', OL, 2.5); var tx = x + Math.sin(t * 1.3) * 22, ty = y - 64 + Math.cos(t * 1.9) * 12; [14, 9, 4].forEach(function (r, i) { circ(c, tx, ty, r); fs(c, i % 2 ? '#fff' : '#ff5c6c', OL, 1.5); }); },
    mathrush: function (c, o, t) { var x = o.x, y = o.y; gbody(c, x, y, 88, 100, '#0f766e', 'MATH', '#99f6e4'); rr(c, x - 36, y - 90, 72, 52, 5); fs(c, '#071126', OL, 2.5); A.label(c, ['7 × 8', '12 + 9', '6 × 4', '31 − 8'][Math.floor(t * 0.8) % 4], x, y - 64, { size: 15, color: '#99f6e4', stroke: false }); },
    trivia: function (c, o, t) { var x = o.x, y = o.y; gbody(c, x, y, 88, 100, '#1d4ed8', 'TRIVIA', '#93c5fd'); rr(c, x - 36, y - 90, 72, 52, 5); fs(c, '#071126', OL, 2.5); var on = Math.floor(t * 1.4) % 4; A.label(c, '?', x, y - 74, { size: 20, color: '#93c5fd', stroke: false }); for (var i = 0; i < 4; i++) { c.fillStyle = i === on ? '#b8ff5c' : 'rgba(150,190,255,.4)'; c.fillRect(x - 30 + (i % 2) * 31, y - 58 + Math.floor(i / 2) * 9, 28, 6); } },
    colorclash: function (c, o, t) { var x = o.x, y = o.y, k = Math.floor(t * 1.6) % 4; gbody(c, x, y, 88, 100, '#7e22ce', 'COLOR', '#e9d5ff'); rr(c, x - 36, y - 90, 72, 52, 5); fs(c, '#071126', OL, 2.5); A.label(c, ['RED', 'BLUE', 'GREEN', 'GOLD'][k], x, y - 64, { size: 16, color: ['#3a86ff', '#2bd576', '#ffd166', '#ff5c6c'][k], stroke: false }); },
    pattern: function (c, o, t) { var x = o.x, y = o.y; gbody(c, x, y, 88, 100, '#b45309', 'PATTERN', '#fde68a'); rr(c, x - 36, y - 90, 72, 52, 5); fs(c, '#071126', OL, 2.5); A.label(c, '2 4 8 ' + (Math.floor(t * 1.2) % 2 ? '16' : '?'), x, y - 64, { size: 14, color: '#fde68a', stroke: false }); },
    scramble: function (c, o, t) { var x = o.x, y = o.y, w = ['TNAEPL', 'PLANET'][Math.floor(t * 0.9) % 2]; gbody(c, x, y, 88, 100, '#047857', 'WORDS', '#a7f3d0'); rr(c, x - 36, y - 90, 72, 52, 5); fs(c, '#071126', OL, 2.5); A.label(c, w, x, y - 64, { size: 14, color: '#a7f3d0', stroke: false }); },
  };
  O.gstation = function (c, o, t) { var f = GS[o.kind]; if (f) f(c, o, t); else O.cabinet(c, o, t); };
  O.gtable = O.gstand = O.gstation;
  O.board = function (c, o, t) {
    var x = o.x, y = o.y, W = o.w || 170, H = 108, top = y - H;
    rr(c, x - W / 2 - 5, top - 5, W + 10, H + 10, 10); fs(c, '#d4a63a', OL, 3);
    rr(c, x - W / 2, top, W, H, 7); fs(c, '#0d0b22', null);
    A.label(c, o.title || '', x, top + 13, { size: 12, color: '#ffd166', lw: 3, maxW: W - 16 });
    var rows = o.rows || [];
    if (!rows.length) A.label(c, 'loading…', x, top + 55, { size: 10, color: '#93a0c4', stroke: false });
    rows.slice(0, 5).forEach(function (r, i) {
      var ry = top + 32 + i * 15;
      c.save(); c.font = '600 10px Fredoka, sans-serif'; c.textBaseline = 'middle';
      c.fillStyle = ['#ffd166', '#d9e2ff', '#e8a25b', '#aab4d4', '#aab4d4'][i]; c.textAlign = 'left';
      var nm = String(r.n || ''); if (nm.length > 13) nm = nm.slice(0, 12) + '…';
      var vw = c.measureText(r.v).width, room = W - 28 - vw, label = (i + 1) + '. ' + nm, lw = c.measureText(label).width;
      if (lw > room) { c.font = '600 ' + Math.max(6, 10 * room / lw) + 'px Fredoka, sans-serif'; }
      c.fillText(label, x - W / 2 + 10, ry);
      c.font = '600 10px Fredoka, sans-serif'; c.textAlign = 'right'; c.fillStyle = '#b8ff5c'; c.fillText(r.v, x + W / 2 - 10, ry); c.restore();
    });
    if (o.footer) A.label(c, o.footer, x, top + H - 9, { size: 8.5, color: '#93a0c4', stroke: false, weight: 600, maxW: W - 16 });
  };
  O.fountain = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 92, 16);
    ell(c, x, y - 18, 90, 40); fs(c, '#b8c1d4', OL, 3);
    ell(c, x, y - 22, 78, 32); var g = c.createRadialGradient(x, y - 22, 6, x, y - 22, 80); g.addColorStop(0, '#5cc8ff'); g.addColorStop(1, '#1d6fa5'); fs(c, g, 'rgba(0,0,0,.3)', 2);
    c.save(); ell(c, x, y - 22, 78, 32); c.clip();
    for (var i = 0; i < 3; i++) { var ph = ((t * 0.5 + i / 3) % 1); c.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - ph)) + ')'; c.lineWidth = 2; ell(c, x, y - 22, 16 + ph * 70, 6 + ph * 28); c.stroke(); }
    c.fillStyle = '#ffcf3f'; [[-40, -14], [30, -10], [-10, -4], [52, -24], [-55, -28], [12, -34]].forEach(function (p, k) { var s = (Math.sin(t * 2 + k) + 1) / 2; c.globalAlpha = 0.6 + s * 0.4; ell(c, x + p[0], y + p[1] - 6, 4, 2.2); c.fill(); });
    c.restore(); c.globalAlpha = 1;
    rr(c, x - 9, y - 70, 18, 50, 4); fs(c, '#c9d1e0', OL, 3);
    ell(c, x, y - 72, 28, 10); fs(c, '#b8c1d4', OL, 3);
    ell(c, x, y - 74, 22, 7); fs(c, '#5cc8ff', null);
    for (var j = 0; j < 8; j++) { var a = j / 8 * TAU + t * 0.3, dx = Math.cos(a), ph2 = (t * 1.3 + j * 0.37) % 1; var px = x + dx * (6 + ph2 * 40), py = y - 82 - Math.sin(ph2 * Math.PI) * 26 + ph2 * 30 + Math.sin(a) * 4; c.fillStyle = 'rgba(200,240,255,' + (1 - ph2) + ')'; circ(c, px, py, 2.4); c.fill(); }
    var gp = (t * 1.2) % 1; c.fillStyle = 'rgba(220,245,255,.8)'; circ(c, x, y - 84 - gp * 12, 3); c.fill();
  };
  O.plant = function (c, o, t) {
    var x = o.x, y = o.y; shadow(c, x, y, 18, 5);
    var sw = Math.sin(t * 1.3 + x) * 0.05;
    for (var i = 0; i < 7; i++) { var a = -Math.PI / 2 + (i - 3) * 0.42 + sw; c.save(); c.translate(x, y - 26); c.rotate(a + Math.PI / 2); ell(c, 0, -18, 7, 20); fs(c, i % 2 ? '#2bb673' : '#1f9d55', OL, 2.5); c.restore(); }
    c.beginPath(); c.moveTo(x - 16, y - 30); c.lineTo(x + 16, y - 30); c.lineTo(x + 12, y); c.lineTo(x - 12, y); c.closePath(); fs(c, '#c06a3d', OL, 3);
    rr(c, x - 18, y - 34, 36, 8, 3); fs(c, '#d97b48', OL, 2.5);
  };
  O.pillar = function (c, o, t) {
    var x = o.x, y = o.y; shadow(c, x, y, 22, 6);
    rr(c, x - 20, y - 14, 40, 14, 3); fs(c, '#d4a63a', OL, 3);
    var g = c.createLinearGradient(x - 15, 0, x + 15, 0); g.addColorStop(0, '#9a8fb8'); g.addColorStop(0.4, '#efeaff'); g.addColorStop(1, '#8a7fa8');
    rr(c, x - 15, y - 112, 30, 100, 2); fs(c, g, OL, 3);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; [-7, 0, 7].forEach(function (d) { c.beginPath(); c.moveTo(x + d, y - 108); c.lineTo(x + d, y - 16); c.stroke(); });
    rr(c, x - 21, y - 122, 42, 14, 3); fs(c, '#d4a63a', OL, 3);
  };
  O.couch = function (c, o, t) {
    var x = o.x, y = o.y, W = o.w || 100, col = o.col || '#9d0208';
    shadow(c, x, y, W * 0.55, 8);
    rr(c, x - W / 2, y - 50, W, 30, 10); fs(c, shade(col, -0.2), OL, 3);
    rr(c, x - W / 2 + 4, y - 30, W - 8, 26, 8); fs(c, col, OL, 3);
    rr(c, x - W / 2 - 6, y - 40, 16, 38, 7); fs(c, shade(col, -0.1), OL, 3);
    rr(c, x + W / 2 - 10, y - 40, 16, 38, 7); fs(c, shade(col, -0.1), OL, 3);
    c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(x - W / 2 + 12, y - 28, W - 24, 3);
  };
  O.rope = function (c, o, t) {
    var x = o.x, y = o.y, L = o.w || 96;
    c.strokeStyle = OL; c.lineWidth = 6; c.beginPath(); c.moveTo(x - L / 2, y - 30); c.quadraticCurveTo(x, y - 14, x + L / 2, y - 30); c.stroke();
    c.strokeStyle = '#c1121f'; c.lineWidth = 3.5; c.stroke();
    [-1, 1].forEach(function (k) { var px = x + k * L / 2; shadow(c, px, y, 9, 3); rr(c, px - 3, y - 34, 6, 32, 2); fs(c, '#d4a63a', OL, 2.5); circ(c, px, y - 36, 5); fs(c, '#ffcf3f', OL, 2.5); ell(c, px, y - 2, 9, 3.5); fs(c, '#d4a63a', OL, 2); });
  };
  O.door = function (c, o, t) {
    var x = o.x, y = o.y;
    rr(c, x - 52, y - 82, 104, 84, 6); fs(c, '#140d29', OL, 3);
    [-1, 1].forEach(function (k) { rr(c, x + (k < 0 ? -48 : 2), y - 78, 46, 80, 4); fs(c, '#6b3a1e', OL, 3); circ(c, x + k * 8, y - 36, 3.5); fs(c, '#ffcf3f', OL, 1.5); rr(c, x + (k < 0 ? -42 : 8), y - 70, 34, 26, 3); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2; c.stroke(); });
    rr(c, x - 26, y - 104, 52, 18, 4); fs(c, '#0b2a14', OL, 2.5);
    A.neon(c, 'EXIT', x, y - 95, '#2bd576', 12, t, 9);
  };
  O.sign = function (c, o, t) { A.neon(c, o.text, o.x, o.y, o.color || '#ff6ec7', o.size || 24, t, o.v || 0); };
  O.rug = function (c, o, t) {
    var x = o.x, y = o.y, w = o.w, h = o.h;
    rr(c, x - w / 2, y - h / 2, w, h, 14); fs(c, o.col || '#9d0208', null);
    c.strokeStyle = '#ffcf3f'; c.lineWidth = 3; rr(c, x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16, 10); c.stroke();
    if (o.text) A.label(c, o.text, x, y, { size: o.size || 20, color: '#ffcf3f', stroke: false, weight: 700, maxW: w - 30 });
  };

  // ================================================================ v2: bigger casino + multiplayer-synced models
  A.NPC.bartender = { skin: 'cat', body: '#2b2d42', hat: '', acc: 'bowtie' };
  A.NPC.dj = { skin: 'robot', body: 'm:galaxy', hat: 'phones', acc: 'pixel' };
  A.NPC.duel = { skin: 'knight', body: '#c1121f', hat: '', acc: '' };
  var CARDN = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  function cardFace(cd) { return cd && !cd.hidden ? { s: (CARDN[cd.n] || cd.n) + cd.s, red: cd.s === '♥' || cd.s === '♦' } : null; }
  A.BJ_SEAT_DX = [-64, -32, 0, 32, 64];
  var SEAT_DY = [-24, -19, -17, -19, -24];

  // Floor tiles for the new zones (lounge, duel arena); the dance floor is animated (drawn live).
  var _floor = A.floorTile;
  A.floorTile = function (c, type, x, y, S, v) {
    if (type !== 'l' && type !== 'a' && type !== 'k') return _floor(c, type, x, y, S, v);
    var u = S / 48; c.save(); c.translate(x, y); c.scale(u, u);
    if (type === 'l') {
      c.fillStyle = '#123a44'; c.fillRect(0, 0, 48, 48);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 46, 48, 2); c.fillRect(46, 0, 2, 48);
      c.fillStyle = 'rgba(255,209,102,.45)'; [[12, 12], [36, 36]].forEach(function (p) { circ(c, p[0], p[1], 1.6); c.fill(); });
      c.strokeStyle = 'rgba(94,234,212,.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 24); c.lineTo(24, 0); c.moveTo(24, 48); c.lineTo(48, 24); c.stroke();
    } else if (type === 'k') {   // the Arcade: dark carpet with neon grid and scattered pixels
      c.fillStyle = '#140f33'; c.fillRect(0, 0, 48, 48);
      c.strokeStyle = 'rgba(184,255,92,.16)'; c.lineWidth = 2; c.strokeRect(1, 1, 46, 46);
      c.fillStyle = 'rgba(92,242,255,.10)'; c.fillRect(0, 23, 48, 2); c.fillRect(23, 0, 2, 48);
      var cs = ['#ff5c6c', '#3a86ff', '#2bd576', '#ffd166']; c.fillStyle = cs[(v ? 1 : 0) + 2 * (v ? 1 : 0)]; c.globalAlpha = .55; c.fillRect(10, 10, 5, 5); c.fillStyle = cs[(v ? 3 : 0)]; c.fillRect(32, 32, 5, 5); c.globalAlpha = 1;
    } else {
      c.fillStyle = v ? '#5b5f73' : '#555a6d'; c.fillRect(0, 0, 48, 48);
      c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(2, 2, 21, 21); c.fillRect(25, 25, 21, 21);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 23, 48, 2); c.fillRect(23, 0, 2, 48);
    }
    c.restore();
  };
  var DANCE = ['#ff3b7a', '#3a86ff', '#ffd166', '#2bd576', '#b185ff', '#5cf2ff'];
  A.danceTile = function (c, x, y, tx, ty, t) {
    var beat = Math.floor(t * 2.2), k = (tx * 7 + ty * 13 + beat * 5) % DANCE.length, on = ((tx + ty + beat) % 3) !== 0;
    c.fillStyle = '#16122e'; c.fillRect(x, y, 48.5, 48.5);
    rr(c, x + 3, y + 3, 42, 42, 6); c.fillStyle = DANCE[k]; c.globalAlpha = on ? 0.85 : 0.25; c.fill(); c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 6, y + 6, 18, 4);
  };
  var _wall = A.wallTile;
  A.wallTile = function (c, x, y, S, face, zone, edges) {
    if (!face || (zone !== 'l' && zone !== 'a' && zone !== 'd' && zone !== 'k')) return _wall(c, x, y, S, face, zone, edges);
    var u = S / 48; c.save(); c.translate(x, y); c.scale(u, u);
    var top = zone === 'a' ? '#4a2626' : zone === 'k' ? '#2c1b66' : '#1b4a52';
    var g = c.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, shade(top, 0.15)); g.addColorStop(1, shade(top, -0.2)); c.fillStyle = g; c.fillRect(0, 0, 48, 48);
    c.fillStyle = 'rgba(255,255,255,.06)'; for (var i = 6; i < 48; i += 12) c.fillRect(i, 8, 2, 28);
    c.fillStyle = shade(top, -0.4); c.fillRect(0, 36, 48, 12); c.fillStyle = '#d4a63a'; c.fillRect(0, 35, 48, 2.5);
    c.fillStyle = '#2a2252'; c.fillRect(0, 0, 48, 7); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 0, 48, 2);
    c.restore();
  };

  // ---- Slots: MEGA machine gets a live progressive-jackpot marquee
  var _slot = O.slot;
  O.slot = function (c, o, t, ctx) {
    _slot(c, o, t, ctx);
    if (!o.big) return;
    var x = o.x, y = o.y - 128 - 54;
    rr(c, x - 78, y - 18, 156, 40, 12); fs(c, '#170f30', OL, 3);
    c.strokeStyle = (Math.floor(t * 3) % 2) ? '#ffd166' : '#ff6ec7'; c.lineWidth = 2; rr(c, x - 72, y - 13, 144, 30, 9); c.stroke();
    A.label(c, 'PROGRESSIVE JACKPOT', x, y - 4, { size: 8.5, color: '#ff9bd6', stroke: false, weight: 600, maxW: 136 });
    A.label(c, '📜 ' + Number(o.jp || 0).toLocaleString(), x, y + 9, { size: 15, color: '#ffd166', glow: '#ffb703', blur: 10, maxW: 136 });
    c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 50, y + 22); c.lineTo(x - 40, y + 46); c.moveTo(x + 50, y + 22); c.lineTo(x + 40, y + 46); c.stroke();
  };

  // ---- Blackjack: shows the live table (dealer cards, every seat's bet and hand)
  O.blackjack = function (c, o, t, ctx) {
    var x = o.x, y = o.y, T = o.T;
    A.drawGim(c, x, y - 70, A.NPC.dealer, { t: t, lookAt: ctx.lookAt(x, y - 90), blink: ctx.blink(o.v || 1) });
    shadow(c, x, y + 4, 86, 12);
    table(c, x, y, 168, 70, '#16794a', '#6b3a1e');
    c.strokeStyle = 'rgba(255,215,120,.55)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y - 52, 62, 22, 0, 0.1, Math.PI - 0.1); c.stroke();
    var dealer = T && T.dealer && T.dealer.length ? T.dealer : null;
    if (dealer) dealer.forEach(function (cd, i) { card(c, x - (dealer.length - 1) * 6 + i * 12, y - 55, (i - 0.5) * 0.08, cardFace(cd)); });
    else { chips(c, x + 46, y - 54, '#3a86ff', 3); A.label(c, 'BLACKJACK PAYS 3:2', x, y - 52, { size: 7.5, color: '#ffe8a3', stroke: false, weight: 600, maxW: 110 }); }
    for (var i = 0; i < 5; i++) {
      var sx = x + A.BJ_SEAT_DX[i], sy = y + SEAT_DY[i], s = T && T.seats && T.seats[i];
      c.strokeStyle = s ? (T.turn === i ? '#ffd166' : 'rgba(255,255,255,.75)') : 'rgba(255,255,255,.3)'; c.lineWidth = T && T.turn === i ? 2.5 : 1.5;
      ell(c, sx, sy, 11, 6); c.stroke();
      if (s && s.bet) chips(c, sx, sy + 1, ['#e63946', '#3a86ff', '#2bd576', '#ffd166', '#b185ff'][i], Math.min(5, 1 + Math.floor(Math.log10(s.bet + 1))));
      if (s && s.hand && s.hand.length) s.hand.forEach(function (cd, k) { card(c, sx - 4 + k * 5, sy - 13 - k * 1.5, -0.15 + k * 0.1, cardFace(cd)); });
      if (s && s.result && T.phase === 'done') A.label(c, { win: 'WIN', bj: 'BJ!', push: 'PUSH', lose: 'LOSE', bust: 'BUST' }[s.result] || '', sx, sy - 30, { size: 9, color: s.result === 'win' || s.result === 'bj' ? '#2bd576' : s.result === 'push' ? '#ffd166' : '#ff5c6c', lw: 3 });
    }
  };
  // ---- Roulette: wheel/ball positions come from the shared round (o.rot, o.ball)
  O.roulette = function (c, o, t, ctx) {
    var x = o.x, y = o.y;
    A.drawGim(c, x + 40, y - 72, A.NPC.croupier, { t: t, lookAt: ctx.lookAt(x + 40, y - 92), blink: ctx.blink(2 + (o.v || 0)) });
    shadow(c, x, y + 4, 96, 12);
    table(c, x, y, 190, 76, '#13804e', '#5a2d14');
    var wx = x - 52, wy = y - 40, R = 30, rot = o.rot != null ? o.rot : t * 0.5;
    circ(c, wx, wy, R + 6); fs(c, '#6b3a1e', OL, 3);
    for (var i = 0; i < 37; i++) { var a0 = rot + i / 37 * TAU, a1 = rot + (i + 1) / 37 * TAU; c.beginPath(); c.moveTo(wx, wy); c.arc(wx, wy, R, a0, a1); c.closePath(); var n = WHEELN[i]; c.fillStyle = n === 0 ? '#1f9d55' : REDS.indexOf(n) >= 0 ? '#c1121f' : '#16161e'; c.fill(); }
    c.strokeStyle = OL; c.lineWidth = 2; circ(c, wx, wy, R); c.stroke();
    circ(c, wx, wy, 13); fs(c, '#8a5a2b', OL, 2); circ(c, wx, wy, 5); fs(c, '#ffcf3f', OL, 1.5);
    c.strokeStyle = '#ffcf3f'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(wx + Math.cos(rot) * 10, wy + Math.sin(rot) * 10); c.lineTo(wx - Math.cos(rot) * 10, wy - Math.sin(rot) * 10); c.moveTo(wx + Math.cos(rot + 1.57) * 10, wy + Math.sin(rot + 1.57) * 10); c.lineTo(wx - Math.cos(rot + 1.57) * 10, wy - Math.sin(rot + 1.57) * 10); c.stroke();
    var ba = o.ball != null ? o.ball : -t * 1.2, br = o.ballR || R - 4; circ(c, wx + Math.cos(ba) * br, wy + Math.sin(ba) * br, 2.8); fs(c, '#fff', OL, 1);
    var gx = x - 12, gy = y - 62, cw = 9.5, ch = 13;
    rr(c, gx - 10, gy, 9, ch * 3, 2); fs(c, '#1f9d55', 'rgba(255,255,255,.6)', 1);
    for (var col = 0; col < 12; col++) for (var row = 0; row < 3; row++) { var num = col * 3 + (3 - row); if (col * 3 + 1 > 36) continue; c.fillStyle = REDS.indexOf(num) >= 0 ? '#c1121f' : '#16161e'; if (o.hl === num) c.fillStyle = '#ffd166'; c.fillRect(gx + col * cw * 0.84, gy + row * ch, cw * 0.84 - 1, ch - 1); }
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.strokeRect(gx - 0.5, gy - 0.5, cw * 0.84 * 12, ch * 3);
    var nb = Math.min(8, o.nb || 0); for (var k = 0; k < nb; k++) chips(c, gx + 8 + (k * 23) % 90, gy + 12 + (k % 3) * 11, ['#ffd166', '#3a86ff', '#e63946', '#2bd576'][k % 4], 2 + (k % 2));
    if (o.status) { rr(c, x - 50, y - 102, 100, 18, 8); fs(c, 'rgba(15,10,40,.85)', OL, 2); A.label(c, o.status, x, y - 93, { size: 10, color: o.statusColor || '#fff', stroke: false, maxW: 92 }); }
  };
  // ---- Big Wheel (31 segments: grey 2x, blue 3x, green 6x, gold 30x), angle from the shared spin
  A.WHEEL_COL = { grey: '#5b6687', blue: '#3a86ff', green: '#2bd576', gold: '#ffc93c' };
  A.WHEEL_LAB = { grey: '2x', blue: '3x', green: '6x', gold: '30x' };
  A.drawBigWheel = function (c, x, cy, R, segs, rot, t, spinning) {
    circ(c, x, cy, R + 10); fs(c, '#ffcf3f', OL, 3);
    var n = segs.length;
    for (var i = 0; i < n; i++) {
      var a0 = rot + i / n * TAU, a1 = rot + (i + 1) / n * TAU, col = segs[i];
      c.beginPath(); c.moveTo(x, cy); c.arc(x, cy, R, a0, a1); c.closePath(); c.fillStyle = A.WHEEL_COL[col]; c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.2; c.stroke();
      if (R > 50) { var am = (a0 + a1) / 2; c.save(); c.translate(x + Math.cos(am) * R * 0.74, cy + Math.sin(am) * R * 0.74); c.rotate(am + Math.PI / 2); c.fillStyle = col === 'gold' ? '#5a3a00' : '#fff'; c.font = '700 ' + Math.round(R / 8) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(A.WHEEL_LAB[col], 0, 0); c.restore(); }
    }
    for (var b = 0; b < 24; b++) { var ab = b / 24 * TAU; circ(c, x + Math.cos(ab) * (R + 5), cy + Math.sin(ab) * (R + 5), Math.max(1.6, R / 28)); var on = (b + Math.floor(t * (spinning ? 16 : 3))) % 3 === 0; c.fillStyle = on ? '#fff' : '#b07b00'; c.fill(); }
    circ(c, x, cy, R); c.strokeStyle = OL; c.lineWidth = 3; c.stroke();
    circ(c, x, cy, R * 0.19); fs(c, '#ffcf3f', OL, 3); circ(c, x, cy, R * 0.07); fs(c, '#e63946', OL, 2);
    c.beginPath(); c.moveTo(x - R * 0.15, cy - R - R * 0.22); c.lineTo(x + R * 0.15, cy - R - R * 0.22); c.lineTo(x, cy - R + R * 0.06); c.closePath(); fs(c, '#e63946', OL, 3);
  };
  O.wheel = function (c, o, t) {
    var x = o.x, y = o.y, R = 78, cy = y - 112;
    shadow(c, x, y, 64, 10);
    c.strokeStyle = OL; c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 42, y - 4); c.lineTo(x, cy); c.lineTo(x + 42, y - 4); c.stroke();
    c.strokeStyle = '#8a5a2b'; c.lineWidth = 7; c.stroke();
    rr(c, x - 56, y - 14, 112, 16, 6); fs(c, '#5a3a1c', OL, 3);
    A.drawBigWheel(c, x, cy, R, o.segs || A.DEFAULT_WHEEL, o.angle != null ? o.angle : t * 0.3, t, o.spinning);
    if (o.status) { rr(c, x - 52, y - 12, 104, 16, 6); c.fillStyle = '#170f30'; c.fill(); A.label(c, o.status, x, y - 4, { size: 9.5, color: o.statusColor || '#ffd166', stroke: false, maxW: 96 }); }
  };
  A.DEFAULT_WHEEL = (function () { var a = []; for (var i = 0; i < 31; i++) a.push('grey'); a[0] = 'gold'; [3, 9, 15, 21, 27].forEach(function (i) { a[i] = 'green'; }); [1, 5, 7, 11, 13, 17, 19, 23, 25, 29].forEach(function (i) { a[i] = 'blue'; }); return a; })();
  // ---- Crash: one shared rocket. o.cs = {phase, mult, lift 0..1, boomAge, label}
  O.crash = function (c, o, t) {
    var x = o.x, y = o.y, cs = o.cs || { phase: 'bet', mult: 1, lift: 0 };
    shadow(c, x - 18, y - 4, 60, 11);
    ell(c, x - 18, y - 10, 52, 18); fs(c, '#3d4663', OL, 3);
    ell(c, x - 18, y - 14, 46, 15); fs(c, '#5b6687', null);
    c.save(); ell(c, x - 18, y - 14, 46, 15); c.clip(); c.fillStyle = '#ffd166'; for (var s = -60; s < 60; s += 14) { c.beginPath(); c.moveTo(x - 18 + s, y - 30); c.lineTo(x - 18 + s + 7, y - 30); c.lineTo(x - 18 + s - 3, y); c.lineTo(x - 18 + s - 10, y); c.closePath(); c.fill(); } c.restore();
    ell(c, x - 18, y - 14, 30, 9); fs(c, '#2a3150', OL, 2);
    var rx = x - 18, flying = cs.phase === 'run', boom = cs.phase === 'end';
    if (!boom || cs.boomAge > 2.2) {
      var lift = flying ? cs.lift * 150 : (boom ? 0 : Math.sin(t * 2) * 2), wob = flying ? Math.sin(t * 20) * 1.5 : 0;
      var ry = y - 22 - lift;
      var fl = (flying ? 22 : 8) + Math.random() * 8;
      c.beginPath(); c.moveTo(rx - 9 + wob, ry); c.quadraticCurveTo(rx + wob, ry + fl * 1.8, rx + 9 + wob, ry); c.closePath(); c.fillStyle = '#ff922b'; c.fill();
      c.beginPath(); c.moveTo(rx - 5 + wob, ry); c.quadraticCurveTo(rx + wob, ry + fl, rx + 5 + wob, ry); c.closePath(); c.fillStyle = '#fff3a3'; c.fill();
      [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(rx + wob + k * 10, ry - 22); c.lineTo(rx + wob + k * 22, ry + 2); c.lineTo(rx + wob + k * 9, ry - 4); c.closePath(); fs(c, '#e63946', OL, 2.5); });
      rr(c, rx + wob - 13, ry - 58, 26, 58, 12); fs(c, '#f1f3f9', OL, 3);
      c.beginPath(); c.moveTo(rx + wob - 12, ry - 46); c.quadraticCurveTo(rx + wob, ry - 82, rx + wob + 12, ry - 46); c.closePath(); fs(c, '#e63946', OL, 3);
      circ(c, rx + wob, ry - 34, 7); fs(c, '#5cf2ff', OL, 2.5);
    }
    if (boom && cs.boomAge < 1.4) {
      var bp = cs.boomAge / 1.4, by2 = y - 22 - 150 * (cs.liftEnd || 0) - 30;
      for (var k = 0; k < 10; k++) { var a = k / 10 * TAU; circ(c, rx + Math.cos(a) * bp * 60, by2 + Math.sin(a) * bp * 50, (1 - bp) * 16 + 4); c.fillStyle = ['#ff922b', '#ffd166', '#ff3b5c'][k % 3]; c.globalAlpha = 1 - bp; c.fill(); }
      c.globalAlpha = 1; A.label(c, '💥', rx, by2, { size: 34 * (0.6 + bp), stroke: false });
    }
    var sx = x + 60, sy = y - 104;
    c.strokeStyle = OL; c.lineWidth = 6; c.beginPath(); c.moveTo(sx, sy + 54); c.lineTo(sx, y - 4); c.stroke(); c.strokeStyle = '#8d99ae'; c.lineWidth = 3; c.stroke();
    rr(c, sx - 40, sy, 80, 56, 8); fs(c, '#0b0f24', OL, 3);
    var col = boom ? '#ff3b5c' : flying ? '#b8ff5c' : '#5cf2ff';
    if (flying || boom) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); var lm = Math.log(Math.max(1.01, cs.mult)); for (var i2 = 0; i2 <= 20; i2++) { var p = i2 / 20; c.lineTo(sx - 34 + p * 68, sy + 50 - (Math.exp(lm * p) - 1) / Math.max(0.5, cs.mult - 1) * 30); } c.stroke(); }
    A.label(c, cs.label || (cs.mult || 1).toFixed(2) + 'x', sx, sy + 17, { size: flying || boom ? 15 : 10.5, color: col, lw: 3, maxW: 72 });
    A.neon(c, 'CRASH', x - 18, y - 160, '#5cf2ff', 16, t, 3);
  };
  // ---- Coinflip pedestal: plays duel results (o.anim = {age, landed, a, b})
  var _coin = O.coinflip;
  O.coinflip = function (c, o, t) {
    var an = o.anim;
    if (!an || an.age > 6) { _coin(c, o, t); A.neon(c, o.duel ? 'COIN DUEL' : 'COINFLIP', o.x, o.y - 150, '#ffd166', 12, t, 7); return; }
    var x = o.x, y = o.y; shadow(c, x, y, 32, 9);
    rr(c, x - 28, y - 18, 56, 18, 6); fs(c, '#8d99ae', OL, 3); rr(c, x - 18, y - 52, 36, 36, 4); fs(c, '#b8c1d4', OL, 3); ell(c, x, y - 54, 26, 8); fs(c, '#6c7a96', OL, 3);
    var flip = an.age < 1.6, cy = y - 110 - (flip ? Math.sin(an.age / 1.6 * Math.PI) * 40 : 0);
    var sx = flip ? Math.abs(Math.cos(an.age * 18)) : 1, face = flip ? (Math.cos(an.age * 18) > 0 ? 'S' : '★') : (an.landed === 'heads' ? 'S' : '★');
    c.save(); c.translate(x, cy); c.scale(Math.max(0.08, sx), 1); circ(c, 0, 0, 24); var g = c.createLinearGradient(-24, -24, 24, 24); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#d48a00'); fs(c, g, OL, 3);
    c.fillStyle = '#9a5b00'; c.font = '800 22px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(face, 0, 1); c.restore();
    A.label(c, an.a + '  vs  ' + an.b, x, y - 160, { size: 11, color: '#fff' });
    if (!flip) A.label(c, '🏆 ' + an.w, x, y - 145, { size: 12, color: '#2bd576' });
  };
  // ---- Dice duel table
  var _dice = O.dice;
  O.dice = function (c, o, t, ctx) {
    var an = o.anim;
    if (!an || an.age > 6) { _dice(c, o, t, ctx); if (o.duel) A.neon(c, 'DICE DUEL', o.x, o.y - 112, '#5cf2ff', 13, t, 8); return; }
    var x = o.x, y = o.y;
    A.drawGim(c, x, y - 72, A.NPC.croupier, { t: t, lookAt: ctx.lookAt(x, y - 92), blink: ctx.blink(3) });
    shadow(c, x, y + 4, 92, 12); table(c, x, y, 180, 74, '#1b6fae', '#3d2a6e');
    var roll = an.age < 1.4;
    [[an.ra, an.a, -40], [an.rb, an.b, 40]].forEach(function (d) {
      var v = roll ? 1 + Math.floor(Math.random() * 100) : d[0];
      rr(c, x + d[2] - 26, y - 56, 52, 30, 8); fs(c, '#0e1430', OL, 2.5);
      A.label(c, String(v), x + d[2], y - 41, { size: 17, color: !roll && an.wn === d[1] ? '#2bd576' : '#fff', lw: 3 });
      A.label(c, d[1], x + d[2], y - 18, { size: 9, color: '#dce3ff', lw: 3 });
    });
    A.label(c, 'VS', x, y - 41, { size: 11, color: '#ffd166', lw: 3 });
    if (!roll) A.label(c, '🏆 ' + an.w, x, y - 110, { size: 12, color: '#2bd576' });
  };

  // ---- Bar & Lounge
  O.bar = function (c, o, t, ctx) {
    var x = o.x, y = o.y, W = o.w || 340;
    A.drawGim(c, x - 40 + Math.sin(t * 0.4) * 60, y - 62, A.NPC.bartender, { t: t, lookAt: ctx.lookAt(x, y - 80), blink: ctx.blink(5) });
    shadow(c, x, y + 2, W * 0.52, 10);
    rr(c, x - W / 2, y - 46, W, 46, 8); fs(c, '#3d2416', OL, 3);
    for (var i = 0; i < 6; i++) { rr(c, x - W / 2 + 12 + i * (W - 24) / 6, y - 38, (W - 24) / 6 - 8, 30, 5); c.strokeStyle = 'rgba(255,209,102,.25)'; c.lineWidth = 2; c.stroke(); }
    rr(c, x - W / 2 - 6, y - 60, W + 12, 18, 7); fs(c, '#6b3a1e', OL, 3); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - W / 2, y - 57, W, 3);
    [-120, -60, 20, 90, 140].forEach(function (dx, i) { if (dx > W / 2 - 10) return; var gx = x + dx; rr(c, gx - 5, y - 74, 10, 14, 3); c.fillStyle = 'rgba(200,240,255,.35)'; c.fill(); c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke(); c.fillStyle = ['#ff6ec7', '#ffd166', '#5cf2ff', '#b8ff5c', '#ff922b'][i]; c.fillRect(gx - 4, y - 68, 8, 7); });
    // stools
    [-130, -70, -10, 50, 110].forEach(function (dx) { if (dx > W / 2 - 20) return; var sx2 = x + dx; c.strokeStyle = OL; c.lineWidth = 4; c.beginPath(); c.moveTo(sx2, y + 26); c.lineTo(sx2, y + 10); c.stroke(); ell(c, sx2, y + 8, 12, 5); fs(c, '#c1121f', OL, 2.5); });
  };
  O.bottles = function (c, o, t) {
    var x = o.x, y = o.y, W = o.w || 300;
    rr(c, x - W / 2, y - 30, W, 8, 3); fs(c, '#6b3a1e', OL, 2.5); rr(c, x - W / 2, y - 2, W, 8, 3); fs(c, '#6b3a1e', OL, 2.5);
    for (var row = 0; row < 2; row++) for (var i = 0; i < Math.floor(W / 22); i++) {
      var bx = x - W / 2 + 12 + i * 22, by = row ? y - 2 : y - 30, col = ['#2bd576', '#ff6ec7', '#ffd166', '#5cf2ff', '#ff922b', '#b185ff'][(i + row * 3) % 6], h = 18 + ((i * 7) % 5);
      rr(c, bx - 5, by - h, 10, h, 3); c.fillStyle = col; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; c.strokeStyle = OL; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = OL; c.fillRect(bx - 2, by - h - 5, 4, 6); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(bx - 3, by - h + 3, 2, h - 6);
    }
    if (o.text) A.neon(c, o.text, x, y - 64, '#5eead4', 20, t, 12);
  };
  O.stage = function (c, o, t) {
    var x = o.x, y = o.y, w = o.w || 300, h = o.h || 120;
    rr(c, x - w / 2, y - h / 2 + 12, w, h, 14); fs(c, '#2a1810', OL, 3);
    rr(c, x - w / 2, y - h / 2, w, h, 14); fs(c, '#7a4a22', OL, 3);
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 2; for (var i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x - w / 2 + 6, y - h / 2 + i * h / 6); c.lineTo(x + w / 2 - 6, y - h / 2 + i * h / 6); c.stroke(); }
    for (var k = 0; k < 9; k++) { var lx = x - w / 2 + 16 + k * (w - 32) / 8; circ(c, lx, y + h / 2 + 4, 4); c.fillStyle = DANCE[(k + Math.floor(t * 3)) % DANCE.length]; c.shadowColor = c.fillStyle; c.shadowBlur = 10; c.fill(); c.shadowBlur = 0; }
  };
  O.dj = function (c, o, t, ctx) {
    var x = o.x, y = o.y;
    A.drawGim(c, x, y - 58, A.NPC.dj, { t: t, dance: true, blink: ctx.blink(6) });
    shadow(c, x, y + 2, 76, 10);
    rr(c, x - 72, y - 44, 144, 46, 8); fs(c, '#1b1636', OL, 3);
    c.fillStyle = '#ff6ec7'; c.shadowColor = '#ff6ec7'; c.shadowBlur = 10; c.fillRect(x - 64, y - 12, 128, 3); c.shadowBlur = 0;
    rr(c, x - 78, y - 56, 156, 16, 6); fs(c, '#2c2468', OL, 3);
    [-1, 1].forEach(function (k) { var dx = x + k * 42; ell(c, dx, y - 50, 18, 6); fs(c, '#0b0b16', OL, 2); c.save(); c.translate(dx, y - 50); c.scale(1, 0.33); c.rotate(t * 4 * k); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 10, 0, 1.5); c.stroke(); c.restore(); });
    for (var b = 0; b < 8; b++) { var hgt = 4 + Math.abs(Math.sin(t * 6 + b)) * 14; c.fillStyle = DANCE[b % DANCE.length]; c.fillRect(x - 30 + b * 8, y - 18 - hgt, 5, hgt); }
    A.neon(c, '♫ DJ SCROLLS ♫', x, y - 130, '#ff6ec7', 14, t, 11);
  };
  O.speaker = function (c, o, t) {
    var x = o.x, y = o.y, pulse = 1 + Math.max(0, Math.sin(t * 13.8)) * 0.12;
    shadow(c, x, y, 26, 7); rr(c, x - 24, y - 92, 48, 92, 8); fs(c, '#1b1b26', OL, 3);
    circ(c, x, y - 64, 13 * pulse); fs(c, '#2c2c3a', OL, 2.5); circ(c, x, y - 64, 5); c.fillStyle = '#4a4a5c'; c.fill();
    circ(c, x, y - 28, 17 * pulse); fs(c, '#2c2c3a', OL, 2.5); circ(c, x, y - 28, 7); c.fillStyle = '#4a4a5c'; c.fill();
  };
  O.lounge = function (c, o, t) {
    var x = o.x, y = o.y;
    [-1, 1].forEach(function (k) { shadow(c, x + k * 32, y + 2, 14, 5); rr(c, x + k * 32 - 13, y - 24, 26, 24, 9); fs(c, o.col || '#5a189a', OL, 2.5); });
    shadow(c, x, y - 4, 22, 7); c.strokeStyle = OL; c.lineWidth = 5; c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x, y - 26); c.stroke();
    ell(c, x, y - 30, 22, 9); fs(c, '#d4a63a', OL, 3);
    rr(c, x - 3, y - 44, 6, 12, 2); c.fillStyle = '#fff4d6'; c.fill(); var fl = 1 + Math.sin(t * 12) * 0.15; ell(c, x, y - 48, 2.5 * fl, 4.5 * fl); c.fillStyle = '#ffb703'; c.shadowColor = '#ffb703'; c.shadowBlur = 10; c.fill(); c.shadowBlur = 0;
  };
  O.piano = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 64, 10);
    c.beginPath(); c.moveTo(x - 60, y - 40); c.lineTo(x - 60, y - 88); c.quadraticCurveTo(x - 60, y - 108, x - 30, y - 104); c.quadraticCurveTo(x + 20, y - 98, x + 50, y - 70); c.quadraticCurveTo(x + 66, y - 52, x + 60, y - 40); c.closePath(); fs(c, '#141420', OL, 3);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(x - 50, y - 92); c.quadraticCurveTo(x - 20, y - 100, x + 20, y - 88); c.lineTo(x + 18, y - 84); c.quadraticCurveTo(x - 20, y - 94, x - 50, y - 86); c.closePath(); c.fill();
    rr(c, x - 62, y - 42, 124, 22, 4); fs(c, '#141420', OL, 3);
    rr(c, x - 56, y - 38, 112, 12, 2); c.fillStyle = '#fff'; c.fill();
    c.fillStyle = OL; for (var i = 0; i < 16; i++) { c.fillRect(x - 56 + i * 7, y - 38, 0.8, 12); if (i % 7 !== 2 && i % 7 !== 6) c.fillRect(x - 52 + i * 7, y - 38, 3.5, 7); }
    [-50, 50].forEach(function (dx) { c.fillStyle = OL; c.fillRect(x + dx - 3, y - 22, 6, 22); });
    if (o.flash && t - o.flash < 1.2) A.label(c, '♪', x + 30 + (t - o.flash) * 20, y - 110 - (t - o.flash) * 40, { size: 20, color: '#ffd166' });
  };
  O.statue = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y, 44, 10);
    rr(c, x - 40, y - 30, 80, 30, 6); fs(c, '#e8e2d0', OL, 3); rr(c, x - 32, y - 40, 64, 12, 4); fs(c, '#d8d0b8', OL, 3);
    var g = c.createLinearGradient(x - 30, y - 140, x + 30, y - 40); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#c47f00');
    c.save(); c.translate(x, y - 92 + Math.sin(t * 1.5) * 2); c.rotate(-0.15);
    rr(c, -24, -40, 48, 80, 6); fs(c, g, OL, 3); [-40, 40].forEach(function (yy) { ell(c, 0, yy, 28, 9); fs(c, g, OL, 3); });
    c.fillStyle = 'rgba(120,70,0,.4)'; for (var i = 0; i < 5; i++) c.fillRect(-14, -24 + i * 11, 28, 3);
    c.restore();
    var sp = (t * 0.8) % 2; if (sp < 0.4) A.label(c, '✦', x + 22, y - 130, { size: 14, color: '#fff', stroke: false });
  };
  O.ring = function (c, o, t) {
    var x = o.x, y = o.y, w = o.w || 300, h = o.h || 170;
    rr(c, x - w / 2, y - h / 2, w, h, 18); fs(c, '#2e2a48', OL, 3);
    rr(c, x - w / 2 + 12, y - h / 2 + 12, w - 24, h - 24, 12); c.fillStyle = '#3d3866'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 3; ell(c, x, y, w * 0.28, h * 0.28); c.stroke();
    A.label(c, 'DUEL ARENA', x, y, { size: 22, color: 'rgba(255,209,102,.35)', stroke: false });
    [[-1, -1, '#e63946'], [1, -1, '#3a86ff'], [-1, 1, '#3a86ff'], [1, 1, '#e63946']].forEach(function (p) { circ(c, x + p[0] * (w / 2 - 12), y + p[1] * (h / 2 - 12), 8); fs(c, p[2], OL, 2.5); });
  };
  O.easel = function (c, o, t) {
    var x = o.x, y = o.y, lines = o.lines || [];
    c.strokeStyle = OL; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 30, y); c.lineTo(x - 18, y - 70); c.moveTo(x + 30, y); c.lineTo(x + 18, y - 70); c.stroke(); c.strokeStyle = '#8b5a2b'; c.lineWidth = 3; c.stroke();
    rr(c, x - 90, y - 128, 180, 80, 8); fs(c, '#1b1636', OL, 3); c.strokeStyle = '#d4a63a'; c.lineWidth = 2; rr(c, x - 85, y - 123, 170, 70, 5); c.stroke();
    A.label(c, o.title || 'WELCOME!', x, y - 111, { size: 12, color: '#ffd166', stroke: false, maxW: 156 });
    lines.forEach(function (l, i) { A.label(c, l, x, y - 94 + i * 13, { size: 10, color: '#dce3ff', stroke: false, weight: 600, maxW: 156 }); });
  };
  O.arcboard = function (c, o, t) { o.title = '🏆 ARCADE TOP'; O.board(c, o, t); };
  O.duelboard = function (c, o, t) {
    o.title = '⚔️ OPEN DUELS'; O.board(c, o, t);
  };
})();
