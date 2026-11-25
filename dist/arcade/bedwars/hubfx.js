/* ScrollHub Games hub: the builds, floating holograms and ambient life that make the hub feel like a real server lobby.
   Everything here is drawing only. game.js decides what to show (counts, leaderboard, stars) and calls in. -> BWD.hub */
(function () {
  var B = window.BW, D = window.BWD, A = window.SC.art, T = B.T, OL = '#1b1636', TAU = Math.PI * 2;
  var rr = A.rr, ell = A.ell, circ = A.circ, hash = B.hash;
  var K = D.hub = {};
  function fs(c, f, st, lw) { if (f) { c.fillStyle = f; c.fill(); } if (st) { c.strokeStyle = st; c.lineWidth = lw || 3; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); } }
  function shadow(c, x, y, w, h) { c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, x, y, w, h); c.fill(); }
  function poly(c, pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); }
  function glow(c, x, y, r, col, a) { c.save(); c.globalCompositeOperation = 'lighter'; var g = c.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
  function smoke(c, x, y, t, seed) {
    for (var k = 0; k < 4; k++) { var u = (t * 0.28 + k / 4 + seed) % 1; circ(c, x + Math.sin(u * 5 + seed * 9) * 6 + u * 10, y - u * 46, 4 + u * 9); c.fillStyle = 'rgba(235,235,250,' + (0.5 * (1 - u)) + ')'; c.fill(); }
  }

  // ---------------------------------------------------------------- trees
  K.pine = function (c, o, t) {
    var x = o.x, y = o.y, sc = 0.9 + (o.v || 0) * 0.14, sw = Math.sin(t * 1.1 + x * 0.01) * 1.6;
    shadow(c, x, y + 12, 24 * sc, 8);
    rr(c, x - 5, y - 14, 10, 28, 3); fs(c, '#7a4e2d', OL, 3);
    var cols = ['#2f8f4e', '#35a35a', '#3fb868'];
    for (var i = 0; i < 3; i++) { var by = y - 10 - i * 24 * sc, w = (36 - i * 8) * sc; poly(c, [x + sw * (i * 0.4), by - 34 * sc, x - w, by, x + w, by]); fs(c, cols[i], OL, 3); }
    circ(c, x + sw * 1.2, y - 78 * sc, 3.4); c.fillStyle = '#ffe9a0'; c.fill();
  };
  K.palm = function (c, o, t) {
    var x = o.x, y = o.y, sw = Math.sin(t * 1.4 + x) * 3;
    shadow(c, x, y + 12, 22, 7);
    c.strokeStyle = OL; c.lineWidth = 11; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + 8); c.quadraticCurveTo(x + 12, y - 30, x + 6 + sw * 0.4, y - 62); c.stroke();
    c.strokeStyle = '#c9965e'; c.lineWidth = 6; c.beginPath(); c.moveTo(x, y + 8); c.quadraticCurveTo(x + 12, y - 30, x + 6 + sw * 0.4, y - 62); c.stroke();
    var tx = x + 6 + sw * 0.4, ty = y - 62;
    for (var k = 0; k < 6; k++) { var a = -Math.PI + k * (Math.PI / 5) + sw * 0.02; c.strokeStyle = OL; c.lineWidth = 8; c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * 18, ty + Math.sin(a) * 18 - 14, tx + Math.cos(a) * 36, ty + Math.sin(a) * 30 + 8); c.stroke(); c.strokeStyle = '#3fb868'; c.lineWidth = 4.5; c.stroke(); }
    circ(c, tx - 3, ty + 4, 4); fs(c, '#8a5a34', OL, 2); circ(c, tx + 4, ty + 5, 4); fs(c, '#8a5a34', OL, 2);
  };

  // ---------------------------------------------------------------- buildings
  var ROOFS = ['#d6453d', '#3a86ff', '#7b2cbf', '#2f9e6a', '#e08a1e', '#d6479a', '#14a3a3'];
  K.house = function (c, o, t) {
    var x = o.x, y = o.y, rc = ROOFS[(o.roof || 0) % ROOFS.length], w = 98;
    shadow(c, x, y + 4, 62, 12);
    rr(c, x - w / 2, y - 46, w, 50, 4); fs(c, '#efe3cf', OL, 3);
    c.fillStyle = 'rgba(120,90,60,.35)'; for (var k = 0; k < 5; k++) c.fillRect(x - w / 2 + 3, y - 40 + k * 10, w - 6, 2);
    rr(c, x - 12, y - 28, 24, 32, 5); fs(c, '#7a4e2d', OL, 3); circ(c, x + 6, y - 12, 2); c.fillStyle = '#ffd166'; c.fill();
    [-34, 34].forEach(function (dx, i) { rr(c, x + dx - 10, y - 36, 20, 20, 3); fs(c, 'rgba(255,214,120,' + (0.8 + Math.sin(t * 2 + i + x) * 0.1) + ')', OL, 2.5); c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(x + dx, y - 36); c.lineTo(x + dx, y - 16); c.moveTo(x + dx - 10, y - 26); c.lineTo(x + dx + 10, y - 26); c.stroke(); });
    rr(c, x - 44, y - 14, 20, 8, 2); fs(c, '#7a4e2d', OL, 2); [0, 1, 2].forEach(function (i) { circ(c, x - 40 + i * 7, y - 16, 3); c.fillStyle = ['#ff7eb6', '#fff27a', '#ff5c6c'][i]; c.fill(); });
    rr(c, x + w / 2 - 28, y - 90, 14, 28, 3); fs(c, '#9a6a52', OL, 2.5); smoke(c, x + w / 2 - 21, y - 92, t, (o.tx * 3 + o.ty) % 7 / 7);
    poly(c, [x - w / 2 - 8, y - 44, x, y - 92, x + w / 2 + 8, y - 44]); fs(c, rc, OL, 3.5);
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 2; for (var r = 1; r < 4; r++) { c.beginPath(); c.moveTo(x - w / 2 - 8 + r * 12, y - 44 - r * 12); c.lineTo(x + w / 2 + 8 - r * 12, y - 44 - r * 12); c.stroke(); }
    circ(c, x, y - 62, 6); fs(c, '#ffe9a0', OL, 2.5);
  };
  K.castle = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 4, 230, 22);
    function tower(tx, h, rc) {
      rr(c, tx - 26, y - h, 52, h + 4, 3); fs(c, '#b9b3d6', OL, 3.5);
      c.fillStyle = 'rgba(40,36,80,.18)'; for (var r = 0; r < h / 14; r++) c.fillRect(tx - 26 + (r % 2 ? 8 : 0), y - h + 6 + r * 14, 36, 2);
      rr(c, tx - 5, y - h + 28, 10, 22, 5); fs(c, 'rgba(255,214,120,.9)', OL, 2.5);
      poly(c, [tx - 34, y - h, tx, y - h - 52, tx + 34, y - h]); fs(c, rc, OL, 3.5);
      c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(tx, y - h - 52); c.lineTo(tx, y - h - 76); c.stroke();
      var wv = Math.sin(t * 3 + tx) * 4; poly(c, [tx, y - h - 76, tx + 26 + wv, y - h - 69, tx, y - h - 62]); fs(c, '#ffd166', OL, 2.5);
    }
    // side walls with battlements
    rr(c, x - 200, y - 86, 400, 90, 3); fs(c, '#cfc9e6', OL, 3.5);
    for (var b = 0; b < 17; b++) { rr(c, x - 196 + b * 24, y - 100, 14, 16, 2); fs(c, '#cfc9e6', OL, 2.5); }
    c.fillStyle = 'rgba(40,36,80,.16)'; for (var r2 = 0; r2 < 6; r2++) c.fillRect(x - 196, y - 78 + r2 * 14, 392, 2);
    tower(x - 200, 150, '#7b2cbf'); tower(x + 200, 150, '#7b2cbf');
    // the central keep
    rr(c, x - 78, y - 150, 156, 154, 3); fs(c, '#dcd7f0', OL, 4);
    c.fillStyle = 'rgba(40,36,80,.16)'; for (var r3 = 0; r3 < 10; r3++) c.fillRect(x - 74 + (r3 % 2 ? 10 : 0), y - 144 + r3 * 14, 130, 2);
    for (var b2 = 0; b2 < 7; b2++) { rr(c, x - 74 + b2 * 23, y - 164, 15, 18, 2); fs(c, '#dcd7f0', OL, 2.5); }
    tower(x - 78, 190, '#d6453d'); tower(x + 78, 190, '#d6453d');
    // gate and portcullis glow
    c.beginPath(); c.moveTo(x - 30, y + 4); c.lineTo(x - 30, y - 44); c.quadraticCurveTo(x, y - 82, x + 30, y - 44); c.lineTo(x + 30, y + 4); c.closePath(); fs(c, '#2a1b52', OL, 4);
    c.strokeStyle = 'rgba(255,209,102,.55)'; c.lineWidth = 2.5; for (var g = -20; g <= 20; g += 10) { c.beginPath(); c.moveTo(x + g, y - 52); c.lineTo(x + g, y + 2); c.stroke(); }
    [-46, 46].forEach(function (dx) { rr(c, x + dx - 8, y - 112, 16, 28, 8); fs(c, 'rgba(255,214,120,' + (0.75 + Math.sin(t * 2.5 + dx) * 0.15) + ')', OL, 2.5); });
    [-38, 38].forEach(function (dx) { rr(c, x + dx - 6, y - 40, 12, 20, 3); fs(c, '#d6453d', OL, 2.5); });   // hanging banners by the gate
    // a big banner over the keep
    var wv2 = Math.sin(t * 2) * 3; c.beginPath(); c.moveTo(x - 36, y - 134); c.lineTo(x + 36, y - 134); c.lineTo(x + 36 + wv2 * 0.3, y - 108); c.lineTo(x, y - 98 + wv2); c.lineTo(x - 36 - wv2 * 0.3, y - 108); c.closePath(); fs(c, '#3a1b7a', OL, 3);
    c.font = '800 15px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffd166'; c.fillText('SH', x, y - 120);
    glow(c, x, y - 40, 120, '255,200,110', 0.12);
  };
  K.windmill = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 4, 44, 11);
    poly(c, [x - 34, y + 4, x - 22, y - 96, x + 22, y - 96, x + 34, y + 4]); fs(c, '#efe3cf', OL, 3.5);
    c.fillStyle = 'rgba(120,90,60,.3)'; for (var r = 0; r < 6; r++) c.fillRect(x - 30 + r * 2, y - 12 - r * 14, 60 - r * 4, 2);
    rr(c, x - 9, y - 30, 18, 34, 4); fs(c, '#7a4e2d', OL, 3);
    rr(c, x - 7, y - 70, 14, 16, 3); fs(c, 'rgba(255,214,120,.9)', OL, 2.5);
    poly(c, [x - 30, y - 94, x, y - 128, x + 30, y - 94]); fs(c, '#b8483f', OL, 3.5);
    var hx = x, hy = y - 100, a0 = t * 0.9;
    for (var k = 0; k < 4; k++) { var a = a0 + k * Math.PI / 2; c.save(); c.translate(hx, hy); c.rotate(a); c.strokeStyle = OL; c.lineWidth = 11; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -70); c.stroke(); c.strokeStyle = '#8a5a34'; c.lineWidth = 5; c.stroke(); rr(c, -5, -70, 24, 44, 2); fs(c, '#f3ecda', OL, 2.5); c.strokeStyle = 'rgba(140,110,80,.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-5, -56); c.lineTo(19, -56); c.moveTo(-5, -42); c.lineTo(19, -42); c.stroke(); c.restore(); }
    circ(c, hx, hy, 7); fs(c, '#5a331b', OL, 3);
  };
  K.lighthouse = function (c, o, t) {
    var x = o.x, y = o.y + 6;
    shadow(c, x, y + 4, 36, 10);
    poly(c, [x - 28, y, x - 17, y - 150, x + 17, y - 150, x + 28, y]); fs(c, '#f7f3f0', OL, 3.5);
    c.save(); poly(c, [x - 28, y, x - 17, y - 150, x + 17, y - 150, x + 28, y]); c.clip(); c.fillStyle = '#d6453d';
    c.fillRect(x - 40, y - 56, 80, 24); c.fillRect(x - 40, y - 112, 80, 24); c.restore();
    poly(c, [x - 28, y, x - 17, y - 150, x + 17, y - 150, x + 28, y]); c.strokeStyle = OL; c.lineWidth = 3.5; c.lineJoin = 'round'; c.stroke();
    rr(c, x - 7, y - 24, 14, 24, 4); fs(c, '#7a4e2d', OL, 2.5);
    rr(c, x - 24, y - 158, 48, 10, 3); fs(c, '#5a5f7a', OL, 3);
    rr(c, x - 15, y - 184, 30, 28, 4); fs(c, 'rgba(255,236,160,.95)', OL, 3);
    poly(c, [x - 20, y - 184, x, y - 208, x + 20, y - 184]); fs(c, '#d6453d', OL, 3);
    // a beam that sweeps round and round
    var ang = t * 0.9; c.save(); c.globalCompositeOperation = 'lighter';
    var dirx = Math.cos(ang), len = 210, gx = x + dirx * len, g = c.createLinearGradient(x, y - 170, gx, y - 170); g.addColorStop(0, 'rgba(255,240,170,.5)'); g.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = g;
    c.beginPath(); c.moveTo(x, y - 170); c.lineTo(gx, y - 170 - 22 * Math.abs(Math.sin(ang)) - 6); c.lineTo(gx, y - 170 + 22 * Math.abs(Math.sin(ang)) + 6); c.closePath(); c.fill(); c.restore();
    glow(c, x, y - 170, 70, '255,230,150', 0.4);
  };
  K.stall = function (c, o, t) {
    var x = o.x, y = o.y, cols = [['#e63946', '#fff'], ['#3a86ff', '#fff'], ['#2bd576', '#fff'], ['#ffb703', '#fff']][(o.col || 0) % 4];
    shadow(c, x, y + 4, 56, 10);
    [-46, 46].forEach(function (dx) { rr(c, x + dx - 3, y - 64, 6, 66, 2); fs(c, '#7a4e2d', OL, 2.5); });
    rr(c, x - 48, y - 24, 96, 28, 3); fs(c, '#c08a52', OL, 3);
    for (var i = 0; i < 6; i++) { circ(c, x - 38 + i * 15, y - 28 + (i % 2) * 2, 7); fs(c, ['#ff5c6c', '#ffd166', '#7bd34f', '#ff9f43', '#c77dff', '#5cf2a8'][(i + (o.col || 0)) % 6], OL, 2); }
    for (var k = 0; k < 6; k++) { var x0 = x - 54 + k * 18; poly(c, [x0, y - 64, x0 + 18, y - 64, x0 + 22, y - 44, x0 + 4, y - 44]); fs(c, k % 2 ? cols[1] : cols[0], OL, 2.5); }
    for (var s = 0; s < 6; s++) { circ(c, x - 45 + s * 18, y - 43, 5); fs(c, s % 2 ? cols[1] : cols[0], OL, 2); }
  };
  K.well = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 4, 28, 8);
    ell(c, x, y - 6, 26, 12); fs(c, '#a7a2b8', OL, 3); ell(c, x, y - 10, 19, 8); fs(c, '#244e8a', OL, 2.5);
    c.fillStyle = 'rgba(150,210,255,.5)'; ell(c, x + Math.sin(t * 2) * 3, y - 10, 8, 3); c.fill();
    rr(c, x - 22, y - 56, 6, 48, 2); fs(c, '#7a4e2d', OL, 2.5); rr(c, x + 16, y - 56, 6, 48, 2); fs(c, '#7a4e2d', OL, 2.5);
    poly(c, [x - 32, y - 54, x, y - 76, x + 32, y - 54]); fs(c, '#b8483f', OL, 3);
    c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 60); c.lineTo(x, y - 30); c.stroke(); rr(c, x - 5, y - 32, 10, 9, 2); fs(c, '#8a5a34', OL, 2);
  };
  K.bench = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 6, 22, 6);
    rr(c, x - 22, y - 12, 44, 9, 3); fs(c, '#c08a52', OL, 2.5); rr(c, x - 22, y - 26, 44, 9, 3); fs(c, '#b07b4f', OL, 2.5);
    [-18, 18].forEach(function (dx) { rr(c, x + dx - 2, y - 4, 4, 12, 1); fs(c, '#5a331b', OL, 2); });
  };
  K.campfire = function (c, o, t) {
    var x = o.x, y = o.y;
    glow(c, x, y - 10, 120, '255,150,60', 0.22 + Math.sin(t * 9) * 0.04);
    shadow(c, x, y + 8, 22, 7);
    c.strokeStyle = OL; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - 17, y + 4); c.lineTo(x + 15, y - 6); c.moveTo(x + 17, y + 4); c.lineTo(x - 15, y - 6); c.stroke();
    c.strokeStyle = '#8a5a34'; c.lineWidth = 5; c.stroke();
    ell(c, x, y + 4, 22, 8); c.strokeStyle = '#8f8aa8'; c.lineWidth = 3; c.stroke();
    var fl = 1 + Math.sin(t * 11) * 0.1 + Math.sin(t * 17) * 0.06;
    [['#ff6a1a', 15, 30], ['#ffb02e', 10, 22], ['#fff3b0', 5, 13]].forEach(function (f) { c.beginPath(); c.moveTo(x - f[1], y - 2); c.quadraticCurveTo(x - f[1] * 0.6, y - f[2] * fl, x + Math.sin(t * 8) * 2, y - f[2] * 1.5 * fl); c.quadraticCurveTo(x + f[1] * 0.6, y - f[2] * fl, x + f[1], y - 2); c.closePath(); fs(c, f[0], null); });
    for (var k = 0; k < 5; k++) { var u = (t * 0.9 + k * 0.2) % 1; c.fillStyle = 'rgba(255,200,90,' + (1 - u) + ')'; c.fillRect(x + Math.sin(k * 7 + t) * 12 * u - 1, y - 20 - u * 52, 2.4, 2.4); }
  };
  K.boat = function (c, o, t) {
    var x = o.x, y = o.y + Math.sin(t * 1.6) * 2.5, tilt = Math.sin(t * 1.3) * 0.05;
    c.save(); c.translate(x, y); c.rotate(tilt);
    shadow(c, 0, 8, 30, 6);
    c.beginPath(); c.moveTo(-34, -6); c.lineTo(34, -6); c.quadraticCurveTo(26, 12, 0, 14); c.quadraticCurveTo(-26, 12, -34, -6); c.closePath(); fs(c, '#b07b4f', OL, 3);
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-26, 2); c.lineTo(26, 2); c.stroke();
    c.strokeStyle = OL; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14, -6); c.lineTo(-26, 12); c.stroke(); c.strokeStyle = '#c9a36b'; c.lineWidth = 3.5; c.stroke();
    c.restore();
  };
  K.lily = function (c, o, t) {
    var x = o.x + Math.sin(t * 0.6 + o.tx) * 2, y = o.y;
    c.fillStyle = 'rgba(40,150,70,1)'; ell(c, x, y, 13, 6); c.fill(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke();
    if ((o.tx + o.ty) % 2) { circ(c, x + 1, y - 4, 4); fs(c, '#ff9ec7', OL, 1.8); }
  };
  K.fishspot = function (c, o, t, info) {
    var x = o.x, y = o.y;
    rr(c, x - 3, y - 36, 6, 40, 2); fs(c, '#5a331b', OL, 2.5); rr(c, x - 9, y - 50, 18, 16, 5); fs(c, '#3b3f5c', OL, 2.5);
    rr(c, x - 5, y - 46, 10, 8, 3); c.fillStyle = 'rgba(255,214,120,' + (0.7 + Math.sin(t * 7 + x) * 0.1) + ')'; c.fill(); glow(c, x, y - 42, 50, '255,200,110', 0.25);
    // rod + line + bobber
    var f = info && info.fish;
    c.strokeStyle = OL; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 10, y - 2); c.lineTo(x - 8, y - 46); c.stroke(); c.strokeStyle = '#c9a36b'; c.lineWidth = 2.5; c.stroke();
    if (f) {
      var bx = x - 52, by = y + 6 + (f.bite ? 5 + Math.sin(t * 30) * 2 : Math.sin(t * 2.5) * 2);
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 8, y - 46); c.quadraticCurveTo(x - 30, y - 20, bx, by - 6); c.stroke();
      circ(c, bx, by, 5); fs(c, '#ff5c6c', OL, 2); c.fillStyle = '#fff'; c.fillRect(bx - 4, by - 1, 8, 3);
      c.strokeStyle = 'rgba(255,255,255,' + (f.bite ? 0.9 : 0.4) + ')'; c.lineWidth = 2; ell(c, bx, by + 3, 10 + (t * 14 % 10), 4 + (t * 6 % 4)); c.stroke();
      if (f.bite) { D.tag(c, '!', bx, by - 26 + Math.sin(t * 20) * 2, { size: 26, color: '#ffd166' }); }
    }
  };
  K.star = function (c, o, t, info) {
    if (info && info.got) return;
    var x = o.x, y = o.y - 24 + Math.sin(t * 2 + o.id) * 4, a = t * 1.4 + o.id;
    glow(c, x, y, 44, '255,214,90', 0.35 + Math.sin(t * 3 + o.id) * 0.1);
    c.save(); c.translate(x, y); c.scale(Math.cos(a) * 0.5 + 0.7, 1);
    c.beginPath(); for (var i = 0; i < 10; i++) { var r = i % 2 ? 6 : 14, ang = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); } c.closePath(); fs(c, '#ffd166', OL, 2.5);
    c.restore();
    shadow(c, x, o.y + 8, 10, 3);
  };

  // ---------------------------------------------------------------- holograms: floating text with no board behind it
  // lines: [{ t: 'TEXT', c: '#fff', s: 14 }, ...]. The first line is the title.
  K.holo = function (c, o, t, lines) {
    if (!lines || !lines.length) return;
    var x = o.x, bob = Math.sin(t * 1.7 + o.tx * 0.7) * 3, y = o.y + bob, total = 0, i;
    for (i = 0; i < lines.length; i++) total += (lines[i].s || 13) + 5;
    var yy = y - total + (lines[0].s || 13) * 0.5;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (i = 0; i < lines.length; i++) {
      var L = lines[i], s = L.s || 13; c.font = '800 ' + s + 'px Fredoka, "Baloo 2", system-ui, sans-serif';
      c.globalAlpha = 1; c.strokeStyle = 'rgba(12,8,36,.92)'; c.lineWidth = Math.max(3, s * 0.3); c.strokeText(L.t, x, yy);
      if (i === 0) { c.shadowColor = L.c || '#ffd166'; c.shadowBlur = 10; }
      c.fillStyle = L.c || '#fff'; c.fillText(L.t, x, yy); c.shadowBlur = 0;
      yy += s + 5;
    }
    c.restore();
    // a few twinkles around the title so it reads as magic
    var w0 = 30 + (lines[0].t.length * (lines[0].s || 13)) * 0.34;
    for (i = 0; i < 3; i++) { var u = (t * 0.7 + i / 3 + o.tx * 0.13) % 1; c.fillStyle = 'rgba(255,240,170,' + Math.sin(u * Math.PI) * 0.9 + ')'; var sx = x + (hash(o.tx * 9 + i) - 0.5) * w0 * 2, sy = y - total + (lines[0].s || 13) * 0.5 + (hash(o.ty * 5 + i) - 0.5) * 14 - u * 8; c.fillRect(sx - 3, sy - 0.7, 6, 1.4); c.fillRect(sx - 0.7, sy - 3, 1.4, 6); }
  };

  K.has = function (kind) { return !!K[kind] && kind !== 'has'; };

  // ---------------------------------------------------------------- water, drawn each frame on top of the cached ground
  D.hubWater = function (c, map, L, Tp, vw, vh, t) {
    var W = B.W, x0 = Math.max(0, Math.floor(L / T) - 1), x1 = Math.min(W - 1, Math.ceil((L + vw) / T) + 1), y0 = Math.max(0, Math.floor(Tp / T) - 1), y1 = Math.min(B.H - 1, Math.ceil((Tp + vh) / T) + 1), any = false;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var i = y * W + x; if (map.g[i] !== B.G.WATER) continue; any = true;
      var px = x * T, py = y * T, h = hash(i);
      c.save(); c.beginPath(); c.rect(px, py, T, T); c.clip();
      for (var k = 0; k < 2; k++) { var ph = (t * 0.5 + h * 3 + k * 0.5) % 1; c.strokeStyle = 'rgba(255,255,255,' + (0.4 * Math.sin(ph * Math.PI)) + ')'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 4 + k * 14, py + 10 + k * 16 + Math.sin(t + h * 6) * 2); c.quadraticCurveTo(px + 14 + k * 14, py + 4 + k * 16, px + 24 + k * 14, py + 10 + k * 16 + Math.sin(t + h * 6) * 2); c.stroke(); }
      c.restore();
    }
    if (any) { // a fish leaps now and then
      var cyc = 6.5, u = ((t + 2) % cyc) / 0.9, fx = 22 * T + 8, fy = 57 * T;
      if (u < 1) { var jy = fy - Math.sin(u * Math.PI) * 40, jx = fx + u * 40 - 20; c.save(); c.translate(jx, jy); c.rotate((u - 0.5) * 2.2); ell(c, 0, 0, 10, 4.5); fs(c, '#ffb347', OL, 2); poly(c, [-9, 0, -16, -5, -16, 5]); fs(c, '#ff8c42', OL, 1.5); c.restore(); }
      else if (u < 1.5) { c.strokeStyle = 'rgba(255,255,255,' + (1.5 - u) + ')'; c.lineWidth = 2; ell(c, fx + 20, fy, (u - 1) * 40, (u - 1) * 14); c.stroke(); }
    }
  };

  // ---------------------------------------------------------------- life: butterflies, fireflies, birds, a hot-air balloon, a crystal over the fountain
  var BUT = [], FIRE = [], i0;
  for (i0 = 0; i0 < 16; i0++) BUT.push({ hx: (8 + hash(i0 * 3) * 56) * T, hy: (14 + hash(i0 * 7) * 46) * T, ph: hash(i0 * 11) * 6.3, col: ['#ff7eb6', '#ffd166', '#9ad7ff', '#c7ffa0', '#ffffff'][i0 % 5] });
  for (i0 = 0; i0 < 36; i0++) FIRE.push({ x: (6 + hash(i0 * 5 + 1) * 60) * T, y: (10 + hash(i0 * 13 + 2) * 52) * T, ph: hash(i0 * 17) * 6.3 });
  D.hubSky = function (c, t, L, Tp, vw, vh, info) {
    var i, b;
    for (i = 0; i < BUT.length; i++) {
      b = BUT[i]; var x = b.hx + Math.sin(t * 0.5 + b.ph) * 120 + Math.sin(t * 1.3 + b.ph * 2) * 24, y = b.hy + Math.cos(t * 0.4 + b.ph) * 90 + Math.sin(t * 2.1 + b.ph) * 10 - 28;
      if (x < L - 40 || x > L + vw + 40 || y < Tp - 40 || y > Tp + vh + 40) continue;
      var fl = Math.abs(Math.sin(t * 11 + b.ph)); c.fillStyle = b.col; c.strokeStyle = 'rgba(20,12,50,.8)'; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(x - 3, y, 4 * (0.4 + fl * 0.6), 5, -0.4, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.ellipse(x + 3, y, 4 * (0.4 + fl * 0.6), 5, 0.4, 0, TAU); c.fill(); c.stroke();
    }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (i = 0; i < FIRE.length; i++) {
      b = FIRE[i]; var fx = b.x + Math.sin(t * 0.35 + b.ph) * 50, fy = b.y + Math.cos(t * 0.3 + b.ph * 1.3) * 36, a = 0.5 + Math.sin(t * 2.4 + b.ph * 3) * 0.5;
      if (fx < L - 20 || fx > L + vw + 20 || fy < Tp - 20 || fy > Tp + vh + 20) continue;
      var g = c.createRadialGradient(fx, fy, 0, fx, fy, 11); g.addColorStop(0, 'rgba(255,248,170,' + (0.95 * a) + ')'); g.addColorStop(1, 'rgba(255,248,170,0)'); c.fillStyle = g; c.fillRect(fx - 11, fy - 11, 22, 22);
    }
    c.restore();
    // the balloon drifts a lazy loop over the whole island
    var bt = t * 0.045, bx = 36 * T + Math.cos(bt) * 22 * T, by = 30 * T + Math.sin(bt * 1.3) * 14 * T - 40;
    if (bx > L - 120 && bx < L + vw + 120 && by > Tp - 200 && by < Tp + vh + 200) {
      c.fillStyle = 'rgba(10,6,30,.2)'; ell(c, bx, by + 190, 30, 9); c.fill();
      var sw2 = Math.sin(t * 1.1) * 3;
      c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 20, by + 30); c.lineTo(bx - 9 + sw2, by + 62); c.moveTo(bx + 20, by + 30); c.lineTo(bx + 9 + sw2, by + 62); c.stroke();
      rr(c, bx - 12 + sw2, by + 60, 24, 17, 3); fs(c, '#b07b4f', OL, 2.5);
      c.beginPath(); c.ellipse(bx, by, 34, 40, 0, 0, TAU); fs(c, '#ff5c6c', OL, 3.5);
      ['#ffd166', '#3a86ff'].forEach(function (col, k) { c.save(); c.beginPath(); c.ellipse(bx, by, 34, 40, 0, 0, TAU); c.clip(); c.fillStyle = col; c.fillRect(bx - 12 + k * 14 - 7, by - 44, 11, 88); c.restore(); });
      c.beginPath(); c.ellipse(bx, by, 34, 40, 0, 0, TAU); c.strokeStyle = OL; c.lineWidth = 3.5; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(bx - 12, by - 12, 8, 14, -0.5, 0, TAU); c.fill();
    }
    // a little flock crossing every so often
    var cyc = 48, u = ((t + 10) % cyc) / 14;
    if (u < 1) {
      for (i = 0; i < 5; i++) {
        var bx2 = L - 100 + u * (vw + 300) + i * 26, by2 = Tp + vh * 0.25 + Math.sin(u * 6 + i) * 18 + i * 12, w = Math.sin(t * 12 + i) * 6;
        c.strokeStyle = 'rgba(30,20,70,.75)'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx2 - 9, by2 - w); c.quadraticCurveTo(bx2 - 4, by2 - w - 4, bx2, by2); c.quadraticCurveTo(bx2 + 4, by2 - w - 4, bx2 + 9, by2 - w); c.stroke();
      }
    }
  };
})();
