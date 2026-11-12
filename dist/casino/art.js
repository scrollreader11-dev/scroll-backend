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
  // o = {dir 0↓ 1← 2→ 3↑, moving, walk (phase), t, scale, lookAt:{x,y}, blink, shadow, alpha}
  A.drawGim = function (c, x, y, look, o) {
    o = o || {}; look = look || {};
    var skin = look.skin || 'gim', body = look.body || '#3fa9ff', t = o.t || 0, dir = o.dir || 0;
    var s = o.scale || 1;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    var ghost = skin === 'ghost';
    var bob = o.moving ? -Math.abs(Math.sin(o.walk || 0)) * 3.5 : Math.sin(t * 2.2) * 0.8;
    if (ghost) bob = Math.sin(t * 3) * 2.5 - 5;
    if (o.shadow !== false) shadow(c, 0, 0, ghost ? 13 : 17, 5);
    var base = baseHex(body), dark = shade(base, -0.35);
    var W = 38, H = 40, bx = -W / 2, by = -H - 4 + bob;
    if (skin === 'frog') { bx = -22; W = 44; H = 36; by = -H - 4 + bob; }
    var side = dir === 1 ? -1 : dir === 2 ? 1 : 0;

    // --- behind body
    if (look.acc === 'cape' && dir !== 3) { c.fillStyle = '#c1121f'; c.beginPath(); c.moveTo(-15, by + 22); c.lineTo(15, by + 22); c.lineTo(21 - side * 4, -2 + bob * 0.3); c.lineTo(-21 - side * 4, -2 + bob * 0.3); c.closePath(); fs(c, '#c1121f', OL, 3); }
    if (skin === 'cat' || skin === 'dino' || skin === 'imp') { // tails
      var tw = Math.sin(t * 4) * 4; c.lineCap = 'round';
      var tx = dir === 1 ? 14 : dir === 2 ? -14 : 14;
      c.strokeStyle = OL; c.lineWidth = skin === 'dino' ? 13 : 8; c.beginPath(); c.moveTo(tx * 0.6, by + H - 8); c.quadraticCurveTo(tx * 1.6, by + H - 14 + tw, tx * 1.5, by + H - 26 + tw); c.stroke();
      c.strokeStyle = skin === 'dino' ? shade(base, -0.1) : base; c.lineWidth = skin === 'dino' ? 8 : 4.5; c.stroke();
      if (skin === 'imp') { c.fillStyle = '#c1121f'; c.beginPath(); c.moveTo(tx * 1.5 - 5, by + H - 26 + tw); c.lineTo(tx * 1.5 + 5, by + H - 26 + tw); c.lineTo(tx * 1.5, by + H - 36 + tw); c.closePath(); fs(c, '#e63946', OL, 2); }
    }
    if (skin === 'imp') { // little bat wings
      var fl = Math.sin(t * 8) * 0.25;
      [-1, 1].forEach(function (k) { c.save(); c.translate(k * 16, by + 18); c.rotate(k * (0.3 + fl)); c.beginPath(); c.moveTo(0, 0); c.lineTo(k * 18, -12); c.lineTo(k * 14, -2); c.lineTo(k * 20, 4); c.lineTo(k * 10, 6); c.closePath(); fs(c, '#5a1030', OL, 2.5); c.restore(); });
    }
    // --- feet
    if (!ghost) {
      var ph = o.moving ? Math.sin(o.walk || 0) : 0, fc = skin === 'penguin' ? '#ff9f1c' : shade(base, -0.45);
      ell(c, -8, -3 - Math.max(0, ph) * 3, 7, 4.5); fs(c, fc, OL, 2.5);
      ell(c, 8, -3 - Math.max(0, -ph) * 3, 7, 4.5); fs(c, fc, OL, 2.5);
    }
    // --- ears / top bits behind outline
    if (skin === 'cat') { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 6, by + 4); c.lineTo(k * 17, by - 10); c.lineTo(k * 18, by + 10); c.closePath(); fs(c, base, OL, 3); c.beginPath(); c.moveTo(k * 9, by + 4); c.lineTo(k * 15.5, by - 4); c.lineTo(k * 15.5, by + 6); c.closePath(); c.fillStyle = '#ff9ec7'; c.fill(); }); }
    if (skin === 'bear') { [-1, 1].forEach(function (k) { circ(c, k * 14, by + 3, 8); fs(c, base, OL, 3); circ(c, k * 14, by + 3, 4); c.fillStyle = shade(base, -0.25); c.fill(); }); }
    if (skin === 'bunny') { [-1, 1].forEach(function (k) { c.save(); c.translate(k * 8, by + 4); c.rotate(k * 0.18 + Math.sin(t * 2 + k) * 0.05); ell(c, 0, -14, 6.5, 16); fs(c, base, OL, 3); ell(c, 0, -13, 3, 11); c.fillStyle = '#ff9ec7'; c.fill(); c.restore(); }); }
    if (skin === 'alien') { [-1, 1].forEach(function (k) { c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(k * 6, by + 3); c.quadraticCurveTo(k * 12, by - 8, k * 10, by - 14); c.stroke(); circ(c, k * 10, by - 15, 4.5); fs(c, '#b8ff5c', OL, 2.5); }); }
    if (skin === 'robot') { c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(0, by); c.lineTo(0, by - 11); c.stroke(); circ(c, 0, by - 13, 4.5); fs(c, (Math.floor(t * 2) % 2) ? '#ff3b5c' : '#ffd166', OL, 2.5); }
    if (skin === 'dino') { for (var sp = 0; sp < 4; sp++) { var sx = -12 + sp * 8; c.beginPath(); c.moveTo(sx - 5, by + 4); c.lineTo(sx, by - 7); c.lineTo(sx + 5, by + 4); c.closePath(); fs(c, shade(base, -0.25), OL, 2.5); } }

    // --- body
    c.save();
    function bpath() {
      if (ghost) {
        c.beginPath(); c.moveTo(bx, by + 18); c.arc(0, by + 19, 19, Math.PI, 0); c.lineTo(bx + W, by + H - 2);
        for (var wv = 0; wv < 4; wv++) { var wx = bx + W - (wv + 0.5) * (W / 4); c.quadraticCurveTo(wx + 4, by + H + 6 + Math.sin(t * 5 + wv) * 2, wx - W / 8, by + H - 2); }
        c.closePath();
      } else if (skin === 'robot') rr(c, bx, by, W, H, 7);
      else if (skin === 'frog') rr(c, bx, by, W, H, 17);
      else rr(c, bx, by, W, H, 15);
    }
    if (ghost) c.globalAlpha *= 0.88;
    bpath();
    c.fillStyle = bodyPaint(c, body, bx, by, W, H, t); c.fill();
    c.save(); c.clip();
    bodyExtras(c, body, bx, by, W, H, t);
    c.fillStyle = 'rgba(20,10,60,.16)'; c.fillRect(bx, by + H * 0.68, W, H); // bottom shade
    c.fillStyle = 'rgba(255,255,255,.28)'; ell(c, bx + W * 0.3, by + H * 0.2, W * 0.22, H * 0.12); c.fill(); // gloss
    if (skin === 'penguin' && dir !== 3) { ell(c, side * 4, by + H * 0.62, 13, 15); c.fillStyle = '#f7f7fb'; c.fill(); }
    if (skin === 'frog' && dir !== 3) { ell(c, side * 4, by + H * 0.85, 15, 9); c.fillStyle = shade(base, 0.45); c.fill(); }
    if (skin === 'robot') { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(bx, by + H * 0.55, W, 3); }
    c.restore();
    bpath(); c.strokeStyle = OL; c.lineWidth = 3; c.lineJoin = 'round'; c.stroke();
    c.restore();

    // --- face
    var blink = o.blink;
    if (dir !== 3) {
      var ex = side * 5, eyeY = by + 15;
      var lx = 0, ly = 0;
      if (o.lookAt) { var d = Math.hypot(o.lookAt.x, o.lookAt.y) || 1; lx = o.lookAt.x / d * 2.4; ly = o.lookAt.y / d * 2; }
      else { lx = side * 2.2; ly = dir === 0 ? 1 : 0; }
      if (skin === 'robot') {
        rr(c, -14 + ex * 0.6, by + 7, 28, 17, 5); fs(c, '#0f1a2e', OL, 2.5);
        c.fillStyle = '#5cf2ff'; c.shadowColor = '#5cf2ff'; c.shadowBlur = 6;
        var eh = blink ? 1.5 : 7;
        rr(c, -9 + ex + lx, by + 15.5 - eh / 2 + ly, 6, eh, 2); c.fill(); rr(c, 3 + ex + lx, by + 15.5 - eh / 2 + ly, 6, eh, 2); c.fill();
        c.shadowBlur = 0;
      } else if (skin === 'alien') {
        [-1, 1].forEach(function (k) { c.save(); c.translate(k * 8 + ex, eyeY + 1); c.rotate(k * 0.35); ell(c, 0, 0, 5.5, blink ? 1 : 8); fs(c, '#0b0b16', null); if (!blink) { circ(c, -1.5 + lx * 0.6, -3 + ly, 1.8); c.fillStyle = '#fff'; c.fill(); } c.restore(); });
      } else if (skin === 'frog') {
        [-1, 1].forEach(function (k) { circ(c, k * 11 + ex, by + 1, 8.5); fs(c, base, OL, 3); circ(c, k * 11 + ex, by + 1, 6); c.fillStyle = '#fff'; c.fill(); if (!blink) { circ(c, k * 11 + ex + lx, by + 1.5 + ly, 3.2); c.fillStyle = '#111'; c.fill(); } else { c.fillStyle = base; ell(c, k * 11 + ex, by + 1, 6.5, 6.5); c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(k * 11 + ex - 5, by + 1); c.lineTo(k * 11 + ex + 5, by + 1); c.stroke(); } });
      } else {
        [-1, 1].forEach(function (k) {
          var cx = k * 8 + ex;
          if (blink) { c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.moveTo(cx - 4.5, eyeY + 1); c.lineTo(cx + 4.5, eyeY + 1); c.stroke(); return; }
          ell(c, cx, eyeY, 5.6, 6.8); fs(c, '#fff', OL, 2);
          circ(c, cx + lx, eyeY + ly + 0.5, 3.1); c.fillStyle = '#16122b'; c.fill();
          circ(c, cx + lx + 1, eyeY + ly - 0.8, 1.1); c.fillStyle = '#fff'; c.fill();
        });
      }
      // mouth & cheeks
      var my = by + 27;
      if (skin === 'penguin') { c.beginPath(); c.moveTo(ex - 4, my - 3); c.lineTo(ex + 4, my - 3); c.lineTo(ex, my + 2); c.closePath(); fs(c, '#ff9f1c', OL, 2); }
      else if (skin === 'bear') { ell(c, ex, my - 1, 7, 5); c.fillStyle = shade(base, 0.35); c.fill(); ell(c, ex, my - 3, 2.6, 1.8); c.fillStyle = OL; c.fill(); }
      else if (skin === 'frog') { c.strokeStyle = OL; c.lineWidth = 2.5; c.beginPath(); c.arc(ex, my - 8, 12, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
      else if (skin !== 'robot') {
        c.strokeStyle = OL; c.lineWidth = 2.4; c.lineCap = 'round';
        if (skin === 'cat') { c.beginPath(); c.moveTo(ex - 4, my - 1); c.quadraticCurveTo(ex - 2, my + 2, ex, my - 1); c.quadraticCurveTo(ex + 2, my + 2, ex + 4, my - 1); c.stroke(); c.beginPath(); c.moveTo(ex - 2, my - 4); c.lineTo(ex + 2, my - 4); c.lineTo(ex, my - 2); c.closePath(); c.fillStyle = '#ff7eb6'; c.fill(); c.lineWidth = 1.3; [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(ex + k * 8, my - 2); c.lineTo(ex + k * 18, my - 4); c.moveTo(ex + k * 8, my); c.lineTo(ex + k * 18, my + 1); c.stroke(); }); }
        else { c.beginPath(); c.arc(ex, my - 3, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
        if (skin === 'bunny') { c.fillStyle = '#fff'; c.fillRect(ex - 3, my + 1, 6, 4); c.strokeRect(ex - 3, my + 1, 6, 4); }
      }
      if (skin === 'gim' || skin === 'cat' || skin === 'bunny' || skin === 'imp') { c.fillStyle = 'rgba(255,90,140,.35)'; ell(c, -13 + ex, my - 3, 3.5, 2.2); c.fill(); ell(c, 13 + ex, my - 3, 3.5, 2.2); c.fill(); }
      if (skin === 'imp') { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 7, by + 3); c.quadraticCurveTo(k * 13, by - 6, k * 9, by - 12); c.lineTo(k * 4, by + 2); c.closePath(); fs(c, '#ffe1a8', OL, 2.5); }); }
      A.drawAcc(c, look.acc, by, ex, dir, t, base);
    } else {
      if (skin === 'imp') { [-1, 1].forEach(function (k) { c.beginPath(); c.moveTo(k * 7, by + 3); c.quadraticCurveTo(k * 13, by - 6, k * 9, by - 12); c.lineTo(k * 4, by + 2); c.closePath(); fs(c, '#ffe1a8', OL, 2.5); }); }
      if (look.acc === 'cape') { c.beginPath(); c.moveTo(-17, by + 12); c.lineTo(17, by + 12); c.lineTo(22, -3 + bob * 0.3); c.lineTo(-22, -3 + bob * 0.3); c.closePath(); fs(c, '#c1121f', OL, 3); c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-2, by + 14, 4, 20); }
      if (look.acc === 'scarf' || look.acc === 'chain') A.drawAcc(c, look.acc, by, 0, 3, t, base);
    }
    A.drawHat(c, look.hat, by, side, dir, t);
    c.restore();
    return by * s; // top of head (relative), for name tag placement
  };

  // ---------------------------------------------------------------- ACCESSORIES
  A.drawAcc = function (c, k, by, ex, dir, t, base) {
    if (!k) return;
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
    } else if (k === 'cape') {
      circ(c, ex * 0.5, by + 34, 4); fs(c, '#ffcf3f', OL, 2);
    }
    c.restore();
  };

  // ---------------------------------------------------------------- HATS
  A.drawHat = function (c, k, by, side, dir, t) {
    if (!k) return;
    var hx = side * 3, y = by;
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
        case 'money': c.font = '16px serif'; c.textAlign = 'center'; c.fillText('💸', p.x, p.y); break;
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
    c.font = (o.weight || 700) + ' ' + (o.size || 13) + 'px Fredoka, "Baloo 2", system-ui, sans-serif';
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
    A.label(c, hi ? 'HIGH ROLLER' : 'STARTER', x, y - H + 11, { size: 10, color: accent, lw: 3 });
    rr(c, x - W / 2 + 10, y - 28, W - 20, 16, 5); fs(c, '#140d29', OL, 2);
    A.label(c, hi ? '📜 5,000' : '📜 1,000', x, y - 20, { size: 10, color: '#fff', stroke: false });
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
    A.label(c, '📜 DAILY', x, y - H + 26, { size: 9, color: '#2bd576', stroke: false, glow: '#2bd576' });
    for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) { rr(c, x - 14 + k * 10, y - H + 48 + r * 8, 8, 6, 1.5); c.fillStyle = '#dbe4f3'; c.fill(); }
    rr(c, x - 16, y - 18, 32, 6, 3); fs(c, '#0b1d2e', OL, 1.5);
    if (Math.floor(t * 2) % 2) { circ(c, x + 20, y - H + 50, 2.5); c.fillStyle = '#2bd576'; c.fill(); }
  };
  O.board = function (c, o, t) {
    var x = o.x, y = o.y, W = o.w || 170, H = 108, top = y - H;
    rr(c, x - W / 2 - 5, top - 5, W + 10, H + 10, 10); fs(c, '#d4a63a', OL, 3);
    rr(c, x - W / 2, top, W, H, 7); fs(c, '#0d0b22', null);
    A.label(c, o.title || '', x, top + 13, { size: 12, color: '#ffd166', lw: 3 });
    var rows = o.rows || [];
    if (!rows.length) A.label(c, 'loading…', x, top + 55, { size: 10, color: '#93a0c4', stroke: false });
    rows.slice(0, 5).forEach(function (r, i) {
      var ry = top + 32 + i * 15;
      c.save(); c.font = '600 10px Fredoka, sans-serif'; c.textBaseline = 'middle';
      c.fillStyle = ['#ffd166', '#d9e2ff', '#e8a25b', '#aab4d4', '#aab4d4'][i]; c.textAlign = 'left';
      var nm = String(r.n || ''); if (nm.length > 13) nm = nm.slice(0, 12) + '…';
      c.fillText((i + 1) + '. ' + nm, x - W / 2 + 10, ry);
      c.textAlign = 'right'; c.fillStyle = '#b8ff5c'; c.fillText(r.v, x + W / 2 - 10, ry); c.restore();
    });
    if (o.footer) A.label(c, o.footer, x, top + H - 9, { size: 8.5, color: '#93a0c4', stroke: false, weight: 600 });
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
    if (o.text) A.label(c, o.text, x, y, { size: o.size || 20, color: '#ffcf3f', stroke: false, weight: 700 });
  };
})();
