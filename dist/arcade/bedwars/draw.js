/* ============================================================
   Bedwars 2D — art. Floating islands, blocks, beds, generators, item
   icons and every effect (sword wind-slash, hits, explosions, the void).
   Characters come from the casino's art (SC.art.drawGim).  -> window.BWD
   ============================================================ */
(function () {
  var B = window.BW, A = window.SC.art, D = window.BWD = {};
  var T = B.T, W = B.W, H = B.H, TAU = Math.PI * 2, OL = '#1b1636';
  var WALLH = D.WALLH = 20, CLIFF = 46;
  var rr = A.rr, ell = A.ell, circ = A.circ, shade = A.shade;
  function fs(c, f, st, lw) { if (f) { c.fillStyle = f; c.fill(); } if (st) { c.strokeStyle = st; c.lineWidth = lw || 3; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); } }
  function mk(w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  var hash = B.hash;
  // Pill label with a background (name tags, holograms, NPC signs).
  D.tag = function (c, text, x, y, o) {
    o = o || {}; var size = o.size || 12;
    c.save(); c.font = '700 ' + size + 'px Fredoka, "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    var w = c.measureText(text).width + size * 1.1, h = size + 8;
    if (o.bg) { rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fillStyle = o.bg; c.fill(); c.strokeStyle = OL; c.lineWidth = 2.5; c.stroke(); }
    else { c.strokeStyle = 'rgba(15,10,40,.9)'; c.lineWidth = 4; c.lineJoin = 'round'; c.strokeText(text, x, y + 0.5); }
    c.fillStyle = o.color || '#fff'; c.fillText(text, x, y + 0.5);
    c.restore();
  };
  D.ease = { out: function (t) { return 1 - Math.pow(1 - t, 3); }, back: function (t) { var s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; }, inq: function (t) { return t * t; } };

  // ------------------------------------------------------------------ block textures
  var texCache = {};
  function teamCol(t) { return (B.TEAMS[t] || B.TEAMS[0]).color; }
  D.blockTex = function (id, team, face) {
    var key = id + ':' + team + ':' + face; if (texCache[key]) return texCache[key];
    var hgt = face === 'front' ? WALLH : T, cv = mk(T, hgt), c = cv.getContext('2d');
    var base;
    if (id === 1) base = teamCol(team);
    else if (id === 2) base = '#c08a52';
    else if (id === 3) base = '#efe6a6';
    else base = '#2a1c48';
    if (face === 'front') base = shade(base, -0.28);
    c.fillStyle = base; c.fillRect(0, 0, T, hgt);
    var k, x, y;
    if (id === 1) { // knitted wool
      c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 2;
      for (y = 3; y < hgt; y += 7) for (x = 2; x < T; x += 8) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3, y + 3); c.lineTo(x + 6, y); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.08)'; for (k = 0; k < 10; k++) c.fillRect(hash(k * 7 + id) * T, hash(k * 13 + 1) * hgt, 3, 2);
    } else if (id === 2) { // planks
      c.fillStyle = 'rgba(0,0,0,.18)'; for (y = 0; y < hgt; y += 10) c.fillRect(0, y, T, 2);
      for (y = 0, k = 0; y < hgt; y += 10, k++) c.fillRect(((k % 2) * 20 + 9) % T, y, 2, 10);
      c.fillStyle = 'rgba(255,255,255,.1)'; for (y = 2; y < hgt; y += 10) c.fillRect(0, y, T, 1);
    } else if (id === 3) { // end stone
      c.fillStyle = 'rgba(160,140,70,.35)'; for (k = 0; k < 16; k++) { circ(c, hash(k * 3 + 5) * T, hash(k * 5 + 9) * hgt, 1.5 + hash(k) * 2.2); c.fill(); }
    } else { // obsidian
      c.fillStyle = 'rgba(160,110,255,.35)'; for (k = 0; k < 6; k++) { c.save(); c.translate(hash(k * 11) * T, hash(k * 17) * hgt); c.rotate(-0.6); c.fillRect(-6, -1, 12, 2.5); c.restore(); }
      c.fillStyle = 'rgba(0,0,0,.25)'; for (k = 0; k < 8; k++) c.fillRect(hash(k * 23) * T, hash(k * 29) * hgt, 4, 4);
    }
    if (face === 'top') { c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 0, T, 3); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, T - 3, T, 3); }
    else { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, hgt - 4, T, 4); }
    texCache[key] = cv; return cv;
  };
  D.blockColor = function (id, team) { return id === 1 ? teamCol(team) : id === 2 ? '#c08a52' : id === 3 ? '#efe6a6' : '#3a2766'; };

  // ------------------------------------------------------------------ ground chunks (static, cached)
  var CH = 12, chunks = {};
  D.resetChunks = function () { chunks = {}; };
  D.dropChunk = function (cx, cy) { delete chunks[cx + ',' + cy]; };
  var padTeam = null;
  function teamOfTile(m, tx, ty) {
    var best = 0, bd = 1e9; for (var t = 0; t < m.bases.length; t++) { var b = m.bases[t], d = Math.abs(b.cx - tx) + Math.abs(b.cy - ty); if (d < bd) { bd = d; best = t; } } return best;
  }
  var GC = {
    1: { top: '#6fd25a', alt: '#66c952', rim: '#a3ef7a', cliff: ['#9a6a42', '#6e4428', '#3b2414'], band: '#7d7f8f' },
    2: { top: '#9aa6bd', alt: '#8f9bb3', rim: '#c5cfe2', cliff: ['#7d879b', '#58617a', '#2e3346'], band: '#4a5266' },
    3: { top: '#ddd6f7', alt: '#cfc6f0', rim: '#f5f1ff', cliff: ['#8f80c9', '#5f519b', '#2c2457'], band: '#4b3f88' },
    4: { top: '#c9925a', alt: '#c08a52', rim: '#e2b27d', cliff: ['#9a6a42', '#6e4428', '#3b2414'], band: '#7d7f8f' },
    5: { top: '#ddd6f7', alt: '#cfc6f0', rim: '#f5f1ff', cliff: ['#8f80c9', '#5f519b', '#2c2457'], band: '#4b3f88' },
    6: { top: '#b6bdcc', alt: '#aab2c3', rim: '#e3e8f2', cliff: ['#9a6a42', '#6e4428', '#3b2414'], band: '#7d7f8f' },
    7: { top: '#a7a2b8', alt: '#9d98ae', rim: '#d0cce0', cliff: ['#7d879b', '#58617a', '#2e3346'], band: '#4a5266' },
    8: { top: '#b07b4f', alt: '#a87348', rim: '#d4a272', cliff: ['#9a6a42', '#6e4428', '#3b2414'], band: '#7d7f8f' },
    9: { top: '#eef6ff', alt: '#e2eefc', rim: '#ffffff', cliff: ['#9fb8d8', '#6f89b0', '#3a4d73'], band: '#5a6f98' },
  };
  function gAt(m, x, y) { return x < 0 || y < 0 || x >= W || y >= H ? 0 : m.g[y * W + x]; }
  function drawGroundTile(c, m, tx, ty, x, y) {
    var g = gAt(m, tx, ty), P = GC[g], i = ty * W + tx, h = hash(i);
    c.fillStyle = ((tx + ty) & 1) ? P.alt : P.top; c.fillRect(x, y, T, T);
    if (g === 1) {
      c.strokeStyle = 'rgba(40,120,40,.45)'; c.lineWidth = 2; c.lineCap = 'round';
      for (var k = 0; k < 3; k++) { var gx = x + 6 + hash(i * 3 + k) * (T - 12), gy = y + 8 + hash(i * 7 + k) * (T - 14); c.beginPath(); c.moveTo(gx - 3, gy - 4); c.lineTo(gx, gy); c.lineTo(gx + 3, gy - 5); c.stroke(); }
      if (h > 0.86) { var fc = ['#ff7eb6', '#fff27a', '#ffffff', '#9ad7ff'][(h * 97 | 0) % 4]; for (var f = 0; f < 4; f++) { circ(c, x + 12 + Math.cos(f * 1.57) * 3.2 + h * 10, y + 14 + Math.sin(f * 1.57) * 3.2 + h * 6, 2.6); c.fillStyle = fc; c.fill(); } circ(c, x + 12 + h * 10, y + 14 + h * 6, 2); c.fillStyle = '#ffb703'; c.fill(); }
    } else if (g === 4) {
      c.fillStyle = 'rgba(0,0,0,.18)'; for (var py = 0; py < T; py += 10) c.fillRect(x, y + py, T, 2);
      c.fillRect(x + ((ty & 1) ? 12 : 26), y, 2, T);
      c.fillStyle = 'rgba(255,255,255,.12)'; for (py = 2; py < T; py += 10) c.fillRect(x, y + py, T, 1);
    } else if (g === 2) {
      c.strokeStyle = 'rgba(40,46,66,.35)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y + 14 + h * 6); c.lineTo(x + 18, y + 12 + h * 8); c.lineTo(x + T, y + 18); c.moveTo(x + 18, y + 12 + h * 8); c.lineTo(x + 20, y); c.moveTo(x + 10, y + T); c.lineTo(x + 14, y + 26); c.lineTo(x + T, y + 30); c.stroke();
    } else if (g === 3 || g === 5) {
      c.strokeStyle = 'rgba(120,100,200,.35)'; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, T - 6, T - 6);
      if (((tx + ty) & 3) === 0) { c.fillStyle = 'rgba(255,209,102,.55)'; c.beginPath(); c.moveTo(x + T / 2, y + 12); c.lineTo(x + T - 12, y + T / 2); c.lineTo(x + T / 2, y + T - 12); c.lineTo(x + 12, y + T / 2); c.closePath(); c.fill(); }
    } else if (g === 7) {
      c.strokeStyle = 'rgba(60,55,80,.35)'; c.lineWidth = 2;
      for (var cy2 = 0; cy2 < 2; cy2++) for (var cx2 = 0; cx2 < 2; cx2++) { rr(c, x + 2 + cx2 * 19 + (cy2 ? 4 : 0) * 0, y + 2 + cy2 * 19, 17, 17, 5); c.stroke(); }
    } else if (g === 8) {
      c.fillStyle = 'rgba(0,0,0,.16)'; for (var py2 = 0; py2 < T; py2 += 8) c.fillRect(x, y + py2, T, 2);
      c.fillRect(x + ((ty & 1) ? 10 : 28), y, 2, 8); c.fillRect(x + ((ty & 1) ? 24 : 6), y + 16, 2, 8); c.fillRect(x + ((ty & 1) ? 16 : 32), y + 32, 2, 8);
    } else if (g === 9) {
      c.fillStyle = 'rgba(160,200,255,.35)'; for (var k2 = 0; k2 < 3; k2++) { circ(c, x + 6 + hash(i * 5 + k2) * 28, y + 6 + hash(i * 9 + k2) * 28, 2 + hash(i + k2) * 2); c.fill(); }
    } else if (g === 6) {
      var tc = teamCol(teamOfTile(m, tx, ty));
      c.strokeStyle = 'rgba(80,90,110,.45)'; c.lineWidth = 2; c.strokeRect(x + 2, y + 2, T - 4, T - 4);
      c.fillStyle = tc; c.globalAlpha = 0.28; c.fillRect(x + 6, y + 6, T - 12, T - 12); c.globalAlpha = 1;
    }
    // rims on void edges
    var n = !gAt(m, tx, ty - 1), s = !gAt(m, tx, ty + 1), wv = !gAt(m, tx - 1, ty), e = !gAt(m, tx + 1, ty);
    c.fillStyle = P.rim;
    if (n) c.fillRect(x, y, T, 4); if (wv) c.fillRect(x, y, 4, T); if (e) c.fillRect(x + T - 4, y, 4, T);
    if (s) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(x, y + T - 5, T, 5); }
    c.strokeStyle = OL; c.lineWidth = 3; c.lineCap = 'square'; c.beginPath();
    if (n) { c.moveTo(x, y + 1.5); c.lineTo(x + T, y + 1.5); }
    if (wv) { c.moveTo(x + 1.5, y); c.lineTo(x + 1.5, y + T); }
    if (e) { c.moveTo(x + T - 1.5, y); c.lineTo(x + T - 1.5, y + T); }
    c.stroke();
  }
  function drawCliff(c, m, tx, ty, x, y) {
    var g = gAt(m, tx, ty), P = GC[g], i = ty * W + tx;
    var wv = !gAt(m, tx - 1, ty) && !gAt(m, tx - 1, ty + 1), e = !gAt(m, tx + 1, ty) && !gAt(m, tx + 1, ty + 1);
    var d0 = CLIFF * (0.75 + hash(i * 5) * 0.5), d1 = CLIFF * (0.75 + hash(i * 5 + 5) * 0.5);
    var gr = c.createLinearGradient(0, y + T, 0, y + T + CLIFF * 1.3);
    gr.addColorStop(0, P.cliff[0]); gr.addColorStop(0.45, P.cliff[1]); gr.addColorStop(1, P.cliff[2]);
    c.beginPath(); c.moveTo(x, y + T);
    c.lineTo(x + T, y + T);
    c.lineTo(x + T - (e ? 4 : 0), y + T + d1 * 0.7);
    c.lineTo(x + T * 0.7, y + T + d1);
    c.lineTo(x + T * 0.45, y + T + (d0 + d1) * 0.36 + 8);
    c.lineTo(x + T * 0.25, y + T + d0);
    c.lineTo(x + (wv ? 4 : 0), y + T + d0 * 0.7);
    c.closePath(); c.fillStyle = gr; c.fill();
    c.fillStyle = P.band; c.globalAlpha = 0.5; c.fillRect(x, y + T + 10, T, 4); c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,.18)'; for (var k = 0; k < 3; k++) { circ(c, x + 6 + hash(i + k * 31) * (T - 12), y + T + 18 + hash(i * 3 + k) * 16, 2 + hash(i + k) * 2.5); c.fill(); }
    if (g === 1 && hash(i * 9) > 0.6) { c.strokeStyle = '#4fae3e'; c.lineWidth = 2.5; c.beginPath(); var vx = x + 8 + hash(i * 13) * 24; c.moveTo(vx, y + T); c.quadraticCurveTo(vx + 4, y + T + 12, vx - 1, y + T + 18 + hash(i) * 12); c.stroke(); }
    c.strokeStyle = OL; c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath();
    if (wv) { c.moveTo(x + 1.5, y + T - 2); c.lineTo(x + 4, y + T + d0 * 0.7); } else c.moveTo(x + 4, y + T + d0 * 0.7);
    c.lineTo(x + T * 0.25, y + T + d0); c.lineTo(x + T * 0.45, y + T + (d0 + d1) * 0.36 + 8); c.lineTo(x + T * 0.7, y + T + d1); c.lineTo(x + T - 4, y + T + d1 * 0.7);
    if (e) c.lineTo(x + T - 1.5, y + T - 2);
    c.stroke();
  }
  D.chunk = function (m, cx, cy) {
    var key = cx + ',' + cy; if (chunks[key] !== undefined) return chunks[key];
    var x0 = cx * CH, y0 = cy * CH, any = false, tx, ty;
    for (ty = y0; ty < y0 + CH && !any; ty++) for (tx = x0; tx < x0 + CH; tx++) if (gAt(m, tx, ty)) { any = true; break; }
    if (!any) { chunks[key] = null; return null; }
    var cv = mk(CH * T, CH * T + 130), c = cv.getContext('2d');
    // drop shadow far below (islands float)
    c.save(); c.filter = 'blur(14px)'; c.fillStyle = 'rgba(5,3,20,.42)';
    for (ty = y0; ty < y0 + CH; ty++) for (tx = x0; tx < x0 + CH; tx++) if (gAt(m, tx, ty)) c.fillRect((tx - x0) * T, (ty - y0) * T + 86, T, T);
    c.restore();
    for (ty = y0; ty < y0 + CH; ty++) for (tx = x0; tx < x0 + CH; tx++) if (gAt(m, tx, ty) && !gAt(m, tx, ty + 1)) drawCliff(c, m, tx, ty, (tx - x0) * T, (ty - y0) * T);
    for (ty = y0; ty < y0 + CH; ty++) for (tx = x0; tx < x0 + CH; tx++) if (gAt(m, tx, ty)) drawGroundTile(c, m, tx, ty, (tx - x0) * T, (ty - y0) * T);
    chunks[key] = cv; return cv;
  };
  D.CH = CH;

  // ------------------------------------------------------------------ sky / void
  var starTile = null;
  D.sky = function (c, w, h, camX, camY, t, z) {
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#120c33'); g.addColorStop(0.55, '#1d1450'); g.addColorStop(1, '#2a1a5e');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (!starTile) {
      starTile = mk(512, 512); var s = starTile.getContext('2d');
      for (var k = 0; k < 120; k++) { var r = hash(k * 7) * 1.6 + 0.4; s.fillStyle = 'rgba(255,255,255,' + (0.25 + hash(k * 3) * 0.6) + ')'; circ(s, hash(k) * 512, hash(k * 11) * 512, r); s.fill(); }
      for (k = 0; k < 5; k++) { var nx = hash(k * 41) * 512, ny = hash(k * 43) * 512, nr = 70 + hash(k) * 90, ng = s.createRadialGradient(nx, ny, 0, nx, ny, nr); ng.addColorStop(0, 'rgba(170,140,255,.10)'); ng.addColorStop(1, 'rgba(170,140,255,0)'); s.fillStyle = ng; s.fillRect(nx - nr, ny - nr, nr * 2, nr * 2); }
    }
    var ox = -((camX * 0.25) % 512) - 512, oy = -((camY * 0.25) % 512) - 512;
    for (var y = oy; y < h; y += 512) for (var x = ox; x < w; x += 512) c.drawImage(starTile, x, y);
    // twinkles
    for (k = 0; k < 18; k++) { var tw = (Math.sin(t * 2 + k * 1.7) + 1) / 2; if (tw < 0.75) continue; var sx = ((hash(k * 91) * w * 1.3 - camX * 0.15) % w + w) % w, sy = ((hash(k * 93) * h * 1.3 - camY * 0.15) % h + h) % h; c.fillStyle = 'rgba(255,255,255,' + (tw - 0.75) * 3 + ')'; c.fillRect(sx - 1, sy - 4, 2, 8); c.fillRect(sx - 4, sy - 1, 8, 2); }
  };
  // Clouds drift far below the islands (parallax 0.6).
  var cloudSpr = null;
  function cloudSprite() {
    if (cloudSpr) return cloudSpr;
    cloudSpr = mk(360, 160); var x = cloudSpr.getContext('2d');
    x.filter = 'blur(16px)'; x.fillStyle = 'rgba(190,175,255,1)';
    [[110, 95, 70, 34], [180, 80, 80, 42], [250, 98, 66, 30], [160, 110, 110, 26]].forEach(function (e) { ell(x, e[0], e[1], e[2], e[3]); x.fill(); });
    return cloudSpr;
  }
  D.clouds = function (c, w, h, camX, camY, t, z) {
    var spr = cloudSprite();
    for (var k = 0; k < 16; k++) {
      var wx = hash(k * 5) * 3600 - 300 + t * (5 + hash(k) * 7), wy = hash(k * 9) * 3300 - 200;
      wx = ((wx % 3800) + 3800) % 3800 - 400;
      var s = (0.9 + hash(k * 3) * 1.4) * z, sx = (wx - camX * 0.55) * z, sy = (wy - camY * 0.55) * z;
      if (sx < -400 * s || sx > w + 40 || sy < -200 * s || sy > h + 40) continue;
      c.globalAlpha = 0.05 + hash(k * 7) * 0.04; c.drawImage(spr, sx, sy, 360 * s, 160 * s);
    }
    c.globalAlpha = 1;
  };

  // ------------------------------------------------------------------ blocks (dynamic)
  // floor block (bridge) at tile px x,y
  D.floorBlock = function (c, id, team, x, y, southVoid, sc) {
    if (sc != null && sc < 1) { c.save(); c.translate(x + T / 2, y + T / 2); c.scale(sc, sc); c.translate(-x - T / 2, -y - T / 2); }
    if (southVoid) { c.drawImage(D.blockTex(id, team, 'front'), x, y + T, T, 14); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, y + T + 10, T, 4); }
    c.drawImage(D.blockTex(id, team, 'top'), x, y);
    c.strokeStyle = 'rgba(27,22,54,.55)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, T - 2, T - 2 + (southVoid ? 14 : 0));
    if (sc != null && sc < 1) c.restore();
  };
  D.wallBlock = function (c, id, team, x, y, sc) {
    if (sc != null && sc < 1) { c.save(); c.translate(x + T / 2, y + T); c.scale(sc, sc); c.translate(-x - T / 2, -y - T); }
    c.fillStyle = 'rgba(10,6,30,.3)'; c.fillRect(x + 4, y + T - 2, T, 7);
    c.drawImage(D.blockTex(id, team, 'front'), x, y + T - WALLH);
    c.drawImage(D.blockTex(id, team, 'top'), x, y - WALLH);
    c.strokeStyle = OL; c.lineWidth = 2.5; c.strokeRect(x + 1, y - WALLH + 1, T - 2, T + WALLH - 2);
    c.beginPath(); c.moveTo(x + 1, y + T - WALLH); c.lineTo(x + T - 1, y + T - WALLH); c.stroke();
    if (sc != null && sc < 1) c.restore();
  };
  D.cracks = function (c, x, y, st, h) { // st 0..5
    if (st < 0) return;
    c.save(); c.strokeStyle = 'rgba(15,10,30,.75)'; c.lineWidth = 2; c.lineCap = 'round';
    var cx = x + T / 2, cy = y + T / 2 - (h || 0);
    var n = 2 + st * 2;
    for (var k = 0; k < n; k++) { var a = hash(k * 7 + st) * TAU, l = 6 + st * 3 + hash(k * 3) * 6; c.beginPath(); c.moveTo(cx, cy); var mx = cx + Math.cos(a) * l * 0.5 + (hash(k) - 0.5) * 6, my = cy + Math.sin(a) * l * 0.5; c.lineTo(mx, my); c.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); c.stroke(); }
    c.fillStyle = 'rgba(0,0,0,' + st * 0.04 + ')'; c.fillRect(x, y - (h || 0), T, T);
    c.restore();
  };
  // Highlight for the tile your cursor targets.
  D.tileCursor = function (c, x, y, kind, ok, t, h) {
    c.save();
    var a = 0.55 + Math.sin(t * 6) * 0.2;
    c.strokeStyle = ok ? 'rgba(255,255,255,' + a + ')' : 'rgba(255,92,108,' + a + ')'; c.lineWidth = 3; c.setLineDash([7, 5]); c.lineDashOffset = -t * 20;
    if (kind === 'wall') { c.strokeRect(x + 2, y - WALLH + 2, T - 4, T + WALLH - 4); c.fillStyle = ok ? 'rgba(255,255,255,.12)' : 'rgba(255,92,108,.12)'; c.fillRect(x, y - WALLH, T, T); }
    else { c.strokeRect(x + 2, y + 2 - (h || 0), T - 4, T - 4); c.fillStyle = ok ? 'rgba(255,255,255,.14)' : 'rgba(255,92,108,.12)'; c.fillRect(x, y - (h || 0), T, T); }
    c.restore();
  };

  // ------------------------------------------------------------------ beds
  D.bed = function (c, bed, t, mine) {
    var tm = B.TEAMS[bed.team], d = bed.dir, ang = Math.atan2(d[1], d[0]);
    c.save(); c.translate(bed.x, bed.y);
    c.rotate(ang - Math.PI / 2);
    if (mine) { var p = (Math.sin(t * 3) + 1) / 2; c.strokeStyle = 'rgba(255,255,255,' + (0.25 + p * 0.35) + ')'; c.lineWidth = 3; c.setLineDash([8, 7]); c.lineDashOffset = -t * 14; rr(c, -T / 2 - 6, -T - 6, T + 12, 2 * T + 12, 12); c.stroke(); c.setLineDash([]); }
    c.fillStyle = 'rgba(10,6,30,.28)'; rr(c, -T / 2 + 2, -T + 8, T - 2, 2 * T - 4, 8); c.fill(); // local +y = toward the head (inward)
    var L = T * 2 - 6, Wd = T - 6, H2 = L / 2;
    // frame
    rr(c, -Wd / 2 - 2, -H2 - 2 + 6, Wd + 4, L + 4, 7); fs(c, '#7a4a28', OL, 3);
    // mattress
    rr(c, -Wd / 2 + 2, -H2 + 2, Wd - 4, L - 6, 6); fs(c, '#fbf7ef', null);
    // blanket (foot side)
    rr(c, -Wd / 2 + 1, -H2 + 1, Wd - 2, L * 0.62, 6); fs(c, tm.color, null);
    c.fillStyle = shade(tm.color, -0.2); c.fillRect(-Wd / 2 + 1, -H2 + L * 0.62 - 7, Wd - 2, 6);
    c.fillStyle = 'rgba(255,255,255,.25)'; for (var k = 0; k < 3; k++) c.fillRect(-Wd / 2 + 1, -H2 + 8 + k * 12, Wd - 2, 3);
    // pillow
    rr(c, -Wd / 2 + 5, H2 - 18, Wd - 10, 12, 5); fs(c, '#ffffff', OL, 2);
    // headboard
    rr(c, -Wd / 2 - 3, H2 - 4, Wd + 6, 9, 3); fs(c, '#5a331b', OL, 3);
    rr(c, -Wd / 2 - 2, -H2 - 2 + 6, Wd + 4, L + 4, 7); fs(c, null, OL, 3);
    c.restore();
  };

  // ------------------------------------------------------------------ resource sprites
  D.res = function (c, kind, x, y, s, t) {
    s = s || 1; c.save(); c.translate(x, y); c.scale(s, s);
    if (kind === 'iron' || kind === 'gold') {
      var col = kind === 'iron' ? '#e8edf5' : '#ffcf3f';
      c.beginPath(); c.moveTo(-9, 3); c.lineTo(-6, -4); c.lineTo(6, -4); c.lineTo(9, 3); c.closePath(); fs(c, col, OL, 2.2);
      c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-4, -2, 7, 1.6);
      c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(-8, 1, 16, 2);
    } else if (kind === 'dia') {
      c.beginPath(); c.moveTo(0, -9); c.lineTo(8, -2); c.lineTo(0, 9); c.lineTo(-8, -2); c.closePath(); fs(c, '#5ff0e6', OL, 2.2);
      c.beginPath(); c.moveTo(0, -9); c.lineTo(3, -2); c.lineTo(0, 9); c.lineTo(-3, -2); c.closePath(); c.fillStyle = 'rgba(255,255,255,.45)'; c.fill();
      c.fillStyle = '#c8fffb'; c.fillRect(-8, -3, 16, 1.6);
    } else if (kind === 'em') {
      c.beginPath(); c.moveTo(-5, -9); c.lineTo(5, -9); c.lineTo(8, 0); c.lineTo(5, 9); c.lineTo(-5, 9); c.lineTo(-8, 0); c.closePath(); fs(c, '#2bd576', OL, 2.2);
      rr(c, -3, -5, 6, 10, 2); c.fillStyle = 'rgba(255,255,255,.4)'; c.fill();
    }
    c.restore();
  };
  // Generators
  D.gen = function (c, g, n, t, info) {
    var x = g.x, y = g.y;
    if (g.kind === 'iron' || g.kind === 'gold') {
      if (g.kind === 'iron') { // shared platform drawn once per base (iron entry)
        var tc = teamCol(g.team), pulse = (Math.sin(t * 2.5) + 1) / 2;
        var cx = x + 9;
        c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, cx, y + 5, 26, 14); c.fill();
        ell(c, cx, y + 2, 24, 13); fs(c, '#4a5266', OL, 3);
        ell(c, cx, y, 19, 10); fs(c, '#2e3346', null);
        c.strokeStyle = tc; c.globalAlpha = 0.5 + pulse * 0.5; c.lineWidth = 3; ell(c, cx, y, 15, 7.5); c.stroke(); c.globalAlpha = 1;
        var rg = c.createRadialGradient(cx, y, 2, cx, y, 26); rg.addColorStop(0, 'rgba(255,255,255,' + (0.18 + pulse * 0.12) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; ell(c, cx, y, 26, 14); c.fill();
      }
      var k, show = Math.min(n, 6);
      for (k = 0; k < show; k++) D.res(c, g.kind, x + (k % 3 - 1) * 5, y - 3 - Math.floor(k / 3) * 5 - (k % 2) * 2, 0.8, t);
      if (n > 6) { D.tag(c, '×' + n, x, y - 22, { size: 11, bg: 'rgba(26,20,64,.85)', color: g.kind === 'gold' ? '#ffcf3f' : '#fff' }); }
      return;
    }
    if (g.base) { if (n) { for (k = 0; k < Math.min(n, 3); k++) D.res(c, 'em', x - 5 + k * 5, y - 18, 0.75, t); } return; }
    // diamond / emerald pedestal with a floating spinning gem
    var col = g.kind === 'dia' ? '#5ff0e6' : '#2bd576';
    c.fillStyle = 'rgba(10,6,30,.32)'; ell(c, x, y + 8, 22, 10); c.fill();
    rr(c, -16 + x, y - 6, 32, 16, 6); fs(c, '#58617a', OL, 3);
    rr(c, -12 + x, y - 10, 24, 8, 4); fs(c, '#8d98ad', OL, 2.5);
    var bob = Math.sin(t * 2.4 + x) * 3, spin = Math.cos(t * 2.2 + x);
    var lg = c.createLinearGradient(x, y - 80, x, y - 8); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, g.kind === 'dia' ? 'rgba(95,240,230,.32)' : 'rgba(43,213,118,.32)');
    c.fillStyle = lg; c.fillRect(x - 10, y - 80, 20, 72);
    c.save(); c.translate(x, y - 30 + bob); c.scale(Math.max(0.18, Math.abs(spin)) * 1.5, 1.5); D.res(c, g.kind, 0, 0, 1, t); c.restore();
    var rg2 = c.createRadialGradient(x, y - 30 + bob, 1, x, y - 30 + bob, 26); rg2.addColorStop(0, col + '66'); rg2.addColorStop(1, col + '00'); c.fillStyle = rg2; circ(c, x, y - 30 + bob, 26); c.fill();
    for (k = 0; k < Math.min(n, 4); k++) D.res(c, g.kind, x - 9 + k * 6, y - 8, 0.7, t);
    if (info) {
      D.tag(c, info.title, x, y - 66, { size: 12, color: col, bg: 'rgba(14,10,40,.8)' });
      D.tag(c, info.sub, x, y - 50, { size: 11, color: '#fff', bg: 'rgba(14,10,40,.8)' });
    }
  };

  // ------------------------------------------------------------------ props
  D.rock = function (c, x, y, t) { // mid pillar, base at y (tile bottom)
    c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, x, y - 4, 22, 9); c.fill();
    rr(c, x - 17, y - 66, 34, 62, 8); fs(c, '#9a8ad8', OL, 3);
    c.fillStyle = '#b7aaf0'; rr(c, x - 17, y - 66, 34, 14, 8); c.fill();
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x + 6, y - 52, 9, 46);
    c.strokeStyle = '#4fae3e'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 12, y - 58); c.quadraticCurveTo(x - 4, y - 40, x - 10, y - 20); c.stroke();
    circ(c, x - 10, y - 30, 3); c.fillStyle = '#6fd25a'; c.fill();
    rr(c, x - 17, y - 66, 34, 62, 8); fs(c, null, OL, 3);
    var g = (Math.sin(t * 2 + x) + 1) / 2; circ(c, x, y - 60, 5); c.fillStyle = 'rgba(255,209,102,' + (0.5 + g * 0.5) + ')'; c.fill();
  };
  D.flag = function (c, x, y, team, t) { // pole base at x,y
    var tc = teamCol(team);
    c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, x, y, 8, 4); c.fill();
    rr(c, x - 2.5, y - 74, 5, 74, 2); fs(c, '#d9dce6', OL, 2.5);
    circ(c, x, y - 76, 4.5); fs(c, '#ffd166', OL, 2);
    c.beginPath(); c.moveTo(x + 2, y - 70);
    for (var k = 0; k <= 10; k++) { var u = k / 10; c.lineTo(x + 2 + u * 34, y - 70 + Math.sin(t * 5 - u * 4) * 3 * u); }
    for (k = 10; k >= 0; k--) { u = k / 10; c.lineTo(x + 2 + u * 34, y - 48 + Math.sin(t * 5 - u * 4) * 3 * u); }
    c.closePath(); fs(c, tc, OL, 2.5);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(x + 18, y - 59 + Math.sin(t * 5 - 2) * 1.5, 4, 0, TAU); c.fill();
  };
  D.npc = function (c, n, t, near) {
    var look = n.kind === 'shop' ? { skin: 'bear', body: '#f4a261', hat: 'cap', acc: 'stache' } : { skin: 'robot', body: '#9b6bff', hat: 'wizard', acc: 'nerd' };
    var x = n.x, y = n.y;
    rr(c, x - 22, y - 6, 44, 14, 6); fs(c, n.kind === 'shop' ? '#c1121f' : '#3a86ff', OL, 2.5);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x - 18, y - 2, 36, 3);
    A.drawGim(c, x, y, look, { t: t + x, dir: 0, scale: 1 });
    var bob = Math.sin(t * 3 + x) * 3;
    D.tag(c, n.kind === 'shop' ? 'ITEM SHOP' : 'UPGRADES', x, y - 64 + bob * 0.3, { size: 12, bg: n.kind === 'shop' ? '#c1121f' : '#3a86ff', color: '#fff' });
    if (near) { var ab = y - 92 + Math.abs(Math.sin(t * 5)) * -8; c.beginPath(); c.moveTo(x - 9, ab); c.lineTo(x + 9, ab); c.lineTo(x, ab + 11); c.closePath(); fs(c, '#ffd166', OL, 2.5); }
  };
  D.tnt = function (c, x, y, left, t) {
    var blink = left < 1 ? (Math.sin(t * 40) > 0) : (Math.sin(t * 14) > 0.6);
    c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, x, y + 14, 18, 7); c.fill();
    rr(c, x - 16, y - 18, 32, 32, 4); fs(c, blink ? '#ffffff' : '#e63946', OL, 3);
    c.fillStyle = blink ? '#ffd6d6' : '#f8f9fa'; c.fillRect(x - 15, y - 6, 30, 9);
    c.fillStyle = OL; c.font = '700 9px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TNT', x, y - 1);
    c.strokeStyle = '#555'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 18); c.quadraticCurveTo(x + 4, y - 25, x + 2, y - 29); c.stroke();
    circ(c, x + 2, y - 30, 2.5 + Math.random() * 1.5); c.fillStyle = '#ffd166'; c.fill();
  };

  // ------------------------------------------------------------------ item icons (hand + UI)
  function sword(c, s, col) {
    c.save(); c.scale(s, s);
    c.beginPath(); c.moveTo(-2.6, -2); c.lineTo(-2.6, -22); c.lineTo(0, -27); c.lineTo(2.6, -22); c.lineTo(2.6, -2); c.closePath(); fs(c, col, OL, 2.2);
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-0.8, -22, 1.6, 18);
    rr(c, -8, -3, 16, 4, 2); fs(c, '#6b4a2b', OL, 2);
    rr(c, -2, 1, 4, 8, 1.5); fs(c, '#8a5a34', OL, 2);
    circ(c, 0, 10.5, 2.4); fs(c, '#ffd166', OL, 1.6);
    c.restore();
  }
  function pickaxe(c, s, col) {
    c.save(); c.scale(s, s);
    rr(c, -1.8, -18, 3.6, 28, 1.5); fs(c, '#8a5a34', OL, 2);
    c.beginPath(); c.moveTo(-13, -12); c.quadraticCurveTo(0, -24, 13, -12); c.lineTo(11, -10); c.quadraticCurveTo(0, -19, -11, -10); c.closePath(); fs(c, col, OL, 2.2);
    c.restore();
  }
  D.drawItem = function (c, id, s, o) { // centered at 0,0, ~32px at s=1
    o = o || {}; s = s || 1;
    var tm = o.team == null ? 0 : o.team;
    if (/^sword/.test(id)) { var tier = o.tier || +id.slice(5) || 1; c.save(); c.rotate(0.6); c.translate(0, 8 * s); sword(c, s, B.SWORDS[tier].color); c.restore(); return; }
    if (id === 'kbstick') { c.save(); c.rotate(0.6); c.scale(s, s); rr(c, -2.4, -18, 4.8, 30, 2); fs(c, '#a0703f', OL, 2.2); c.fillStyle = '#c084fc'; for (var k = 0; k < 3; k++) c.fillRect(-2.4, -14 + k * 8, 4.8, 2.5); c.restore(); return; }
    if (/^pick/.test(id)) { var pt = o.tier || +id.slice(4) || 1; c.save(); c.rotate(0.5); c.translate(0, 3 * s); pickaxe(c, s, (B.PICKS[pt] || B.PICKS[1]).color); c.restore(); return; }
    if (id === 'wool' || id === 'wood' || id === 'end' || id === 'obby') {
      var bid = B.BLOCK_OF[id], cs = 12 * s;
      c.save(); c.translate(0, 2 * s);
      var top = D.blockColor(bid, tm);
      c.beginPath(); c.moveTo(0, -cs); c.lineTo(cs, -cs * 0.5); c.lineTo(0, 0); c.lineTo(-cs, -cs * 0.5); c.closePath(); fs(c, shade(top, 0.15), OL, 2);
      c.beginPath(); c.moveTo(-cs, -cs * 0.5); c.lineTo(0, 0); c.lineTo(0, cs); c.lineTo(-cs, cs * 0.5); c.closePath(); fs(c, shade(top, -0.12), OL, 2);
      c.beginPath(); c.moveTo(cs, -cs * 0.5); c.lineTo(0, 0); c.lineTo(0, cs); c.lineTo(cs, cs * 0.5); c.closePath(); fs(c, shade(top, -0.3), OL, 2);
      c.restore(); return;
    }
    if (id === 'bow') { c.save(); c.scale(s, s); c.rotate(-0.7); c.beginPath(); c.arc(-4, 0, 15, -1.15, 1.15); c.strokeStyle = OL; c.lineWidth = 6; c.stroke(); c.strokeStyle = '#a0703f'; c.lineWidth = 3.4; c.stroke(); c.strokeStyle = '#eee'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-4 + Math.cos(-1.15) * 15, Math.sin(-1.15) * 15); c.lineTo(-4 + Math.cos(1.15) * 15, Math.sin(1.15) * 15); c.stroke(); c.restore(); return; }
    if (id === 'arrows') { c.save(); c.scale(s, s); c.rotate(-0.8); for (k = -1; k <= 1; k++) { c.save(); c.translate(k * 5, 0); c.strokeStyle = OL; c.lineWidth = 4; c.beginPath(); c.moveTo(0, -12); c.lineTo(0, 12); c.stroke(); c.strokeStyle = '#c99a5b'; c.lineWidth = 2; c.stroke(); c.beginPath(); c.moveTo(0, -15); c.lineTo(3, -10); c.lineTo(-3, -10); c.closePath(); fs(c, '#cfd6e4', OL, 1.4); c.fillStyle = '#fff'; c.fillRect(-2.5, 9, 5, 4); c.restore(); } c.restore(); return; }
    if (id === 'fireball') { c.save(); c.scale(s, s); var rg = c.createRadialGradient(-3, -3, 1, 0, 0, 12); rg.addColorStop(0, '#fff3b0'); rg.addColorStop(0.4, '#ffb703'); rg.addColorStop(1, '#e85d04'); circ(c, 0, 0, 11); fs(c, rg, OL, 2.2); c.fillStyle = 'rgba(120,30,0,.35)'; circ(c, 4, 3, 3); c.fill(); circ(c, -4, 4, 2); c.fill(); c.restore(); return; }
    if (id === 'tnt') { c.save(); c.scale(s, s); rr(c, -11, -11, 22, 22, 3); fs(c, '#e63946', OL, 2.2); c.fillStyle = '#f8f9fa'; c.fillRect(-10, -3, 20, 7); c.fillStyle = OL; c.font = '700 7px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TNT', 0, 0.6); c.restore(); return; }
    if (id === 'gapple') { c.save(); c.scale(s, s); circ(c, -4, 2, 9); fs(c, '#ffcf3f', null); circ(c, 4, 2, 9); fs(c, '#ffcf3f', null); c.beginPath(); c.arc(-4, 2, 9, 0.5, 4.2); c.arc(4, 2, 9, -1.0, 2.6); c.strokeStyle = OL; c.lineWidth = 2.2; c.stroke(); c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, -6, -1, 2.5, 4); c.fill(); c.strokeStyle = '#6b4a2b'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -6); c.lineTo(1, -11); c.stroke(); ell(c, 5, -10, 4, 2); fs(c, '#2bd576', OL, 1.5); c.restore(); return; }
    if (id === 'pearl') { c.save(); c.scale(s, s); var pg = c.createRadialGradient(-3, -3, 1, 0, 0, 10); pg.addColorStop(0, '#d8fff4'); pg.addColorStop(0.5, '#2ec4b6'); pg.addColorStop(1, '#0b6e6e'); circ(c, 0, 0, 9.5); fs(c, pg, OL, 2.2); circ(c, 0, 0, 3.4); c.fillStyle = '#063'; c.fill(); c.restore(); return; }
    if (id === 'egg') { c.save(); c.scale(s, s); ell(c, 0, 1, 8.5, 11); fs(c, '#fff8e8', OL, 2.2); c.fillStyle = teamCol(tm); circ(c, -3, -2, 2); c.fill(); circ(c, 3, 3, 1.8); c.fill(); circ(c, 1, -6, 1.4); c.fill(); c.restore(); return; }
    if (id === 'speed') { c.save(); c.scale(s, s); rr(c, -3, -13, 6, 6, 1.5); fs(c, '#cbd5e1', OL, 2); circ(c, 0, 3, 9.5); fs(c, '#7dd3fc', OL, 2.2); c.fillStyle = '#e0f2fe'; circ(c, -3, 0, 2.5); c.fill(); c.restore(); return; }
    if (/^armor/.test(id)) { var at = o.tier || +id.slice(5) || 1, ac = at === 1 ? teamCol(tm) : B.ARMORS[at].color; c.save(); c.scale(s, s); c.beginPath(); c.moveTo(-12, -9); c.lineTo(-5, -12); c.quadraticCurveTo(0, -7, 5, -12); c.lineTo(12, -9); c.lineTo(10, -2); c.lineTo(7, -3); c.lineTo(7, 12); c.lineTo(-7, 12); c.lineTo(-7, -3); c.lineTo(-10, -2); c.closePath(); fs(c, ac, OL, 2.2); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-5, -4, 3, 13); c.restore(); return; }
    if (id === 'iron' || id === 'gold' || id === 'dia' || id === 'em') { D.res(c, id, 0, 0, 1.3 * s); return; }
    if (id === 'forge') { c.save(); c.scale(s, s); rr(c, -12, -6, 24, 16, 4); fs(c, '#58617a', OL, 2.2); c.fillStyle = '#ff9f1c'; rr(c, -7, 0, 14, 7, 3); c.fill(); c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(-4, 0); c.quadraticCurveTo(0, -12, 4, 0); c.fill(); c.restore(); return; }
    if (id === 'heal') { c.save(); c.scale(s, s); c.beginPath(); c.moveTo(0, 10); c.bezierCurveTo(-14, 0, -10, -12, 0, -5); c.bezierCurveTo(10, -12, 14, 0, 0, 10); c.closePath(); fs(c, '#ff5c8a', OL, 2.2); c.fillStyle = '#fff'; c.fillRect(-1.5, -5, 3, 9); c.fillRect(-4.5, -2, 9, 3); c.restore(); return; }
    if (id === 'trap') { c.save(); c.scale(s, s); c.beginPath(); c.arc(0, 2, 11, Math.PI, 0); c.closePath(); fs(c, '#9aa3b5', OL, 2.2); for (k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k * 4 - 2, 2); c.lineTo(k * 4, -4); c.lineTo(k * 4 + 2, 2); c.fillStyle = '#fff'; c.fill(); } rr(c, -12, 2, 24, 5, 2); fs(c, '#6b7280', OL, 2); c.restore(); return; }
    if (id === 'star') { c.save(); c.scale(s, s); c.beginPath(); for (k = 0; k < 10; k++) { var rad = k % 2 ? 5 : 12, a2 = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(Math.cos(a2) * rad, Math.sin(a2) * rad); } c.closePath(); fs(c, '#ffd166', OL, 2.2); c.restore(); return; }
  };
  var iconCache = {};
  D.iconURL = function (id, team, tier, px) {
    px = px || 64; var key = id + ':' + team + ':' + tier + ':' + px; if (iconCache[key]) return iconCache[key];
    var cv = mk(px, px), c = cv.getContext('2d'); c.translate(px / 2, px / 2);
    D.drawItem(c, id, px / 34, { team: team, tier: tier });
    return (iconCache[key] = cv.toDataURL());
  };

  // ------------------------------------------------------------------ held items on characters
  D.held = function (c, e, x, y, t) {
    var it = e.held || 'sword'; if (e.dead) return;
    var a = e.ang || 0, fx = Math.cos(a), fy = Math.sin(a);
    var hx = x + fx * 15, hy = y - 20 + fy * 9;
    c.save(); c.translate(hx, hy);
    if (it === 'sword' || it === 'kbstick') {
      var sw = e.swingT != null ? D.ease.out(Math.min(1, e.swingT / 0.17)) : 1;
      var dir = e.swingDir || 1;
      var rot = e.swingT != null && e.swingT < 0.3 ? a - dir * 1.35 + dir * 2.7 * sw : a + 0.5;
      c.rotate(rot + Math.PI / 2);
      if (it === 'sword') { c.translate(0, -6); sword(c, 0.95, B.SWORDS[e.sword || 1].color); }
      else { rr(c, -2.4, -24, 4.8, 30, 2); fs(c, '#a0703f', OL, 2.2); }
    } else if (it === 'pick') {
      var mineA = e.mining ? Math.sin(t * 22) * 0.7 : 0.3;
      c.rotate(a + Math.PI / 2 + mineA); c.translate(0, -4); pickaxe(c, 0.9, (B.PICKS[e.pick || 1] || B.PICKS[1]).color);
    } else if (it === 'bow') {
      c.rotate(a); c.translate(4, 0);
      var draw = e.bowing ? Math.min(1, (e.bowT || 0)) : 0;
      c.beginPath(); c.arc(-2, 0, 15, -1.15, 1.15); c.strokeStyle = OL; c.lineWidth = 6; c.stroke(); c.strokeStyle = '#a0703f'; c.lineWidth = 3.4; c.stroke();
      var sx = -2 + Math.cos(1.15) * 15 - draw * 10;
      c.strokeStyle = '#eee'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-2 + Math.cos(-1.15) * 15, Math.sin(-1.15) * 15); c.lineTo(sx - 4, 0); c.lineTo(-2 + Math.cos(1.15) * 15, Math.sin(1.15) * 15); c.stroke();
      if (draw > 0) { c.strokeStyle = OL; c.lineWidth = 3.5; c.beginPath(); c.moveTo(sx - 4, 0); c.lineTo(sx + 20, 0); c.stroke(); c.strokeStyle = '#c99a5b'; c.lineWidth = 1.6; c.stroke(); c.beginPath(); c.moveTo(sx + 24, 0); c.lineTo(sx + 18, -3); c.lineTo(sx + 18, 3); c.closePath(); fs(c, '#cfd6e4', OL, 1.4); }
    } else {
      D.drawItem(c, it, 0.62, { team: e.team, tier: it === 'pick' ? e.pick : 1 });
    }
    c.restore();
  };
  // Team-coloured chest plate (leather) / chain / iron / diamond, over the body.
  D.armor = function (c, e, x, y, t, bob) {
    var tier = e.armor || 1, tc = teamCol(e.team), col = tier === 1 ? tc : B.ARMORS[tier].color;
    c.save(); c.translate(x, y + (bob || 0));
    rr(c, -16, -14, 32, 11, 5); fs(c, col, OL, 2.5);
    if (tier > 1) { c.fillStyle = tc; c.fillRect(-15, -8, 30, 3); }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-12, -12, 7, 2.5);
    if (tier === 4) { var sh = (Math.sin(t * 3 + x) + 1) / 2; c.fillStyle = 'rgba(255,255,255,' + sh * 0.6 + ')'; c.fillRect(3, -13, 3, 7); }
    rr(c, -16, -14, 32, 11, 5); fs(c, null, OL, 2.5);
    c.restore();
  };

  // ------------------------------------------------------------------ effects
  // The sword "wind": a white crescent that sweeps through the swing arc and fades.
  D.slash = function (c, fx, now) {
    var t = (now - fx.t0) / 1000; if (t > 0.3) return false;
    var sweep = 0.11, p = Math.min(1, t / sweep), fade = t > sweep ? 1 - (t - sweep) / 0.19 : 1;
    if (fade <= 0) return false;
    var a0 = fx.ang - fx.dir * 1.25, a1 = fx.ang + fx.dir * 1.25;
    var R = fx.reach || 58, n = 22;
    c.save(); c.translate(fx.x, fx.y);
    c.globalCompositeOperation = 'lighter';
    var col = fx.crit ? '255,214,102' : '235,245,255';
    for (var k = 0; k < n; k++) {
      var u = k / (n - 1); if (u > p) break;
      var lead = u / Math.max(0.01, p);                      // 0 = tail, 1 = blade edge
      var aa = a0 + (a1 - a0) * u, ab = a0 + (a1 - a0) * Math.min(1, u + 1 / (n - 1));
      var thick = Math.sin(Math.PI * u) * 15 * (0.5 + lead * 0.5) + 2;
      var al = fade * (0.12 + lead * 0.75);
      c.strokeStyle = 'rgba(' + col + ',' + al + ')'; c.lineWidth = thick; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 0, R - thick * 0.25, Math.min(aa, ab), Math.max(aa, ab)); c.stroke();
    }
    // inner soft wind + outer streaks
    c.strokeStyle = 'rgba(' + col + ',' + 0.18 * fade + ')'; c.lineWidth = 6;
    c.beginPath(); c.arc(0, 0, R * 0.62, Math.min(a0, a0 + (a1 - a0) * p), Math.max(a0, a0 + (a1 - a0) * p)); c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(' + col + ',' + 0.5 * fade + ')';
    for (k = 0; k < 3; k++) { var off = (k - 1) * 0.35, rr2 = R + 9 + k * 5; var s0 = a0 + (a1 - a0) * Math.max(0, p - 0.45) + off * 0.2, s1 = a0 + (a1 - a0) * p + off * 0.2; c.beginPath(); c.arc(0, 0, rr2, Math.min(s0, s1), Math.max(s0, s1)); c.stroke(); }
    c.restore();
    return true;
  };

  // Particles with fake height (z) so debris pops up and bounces on the floor.
  D.parts = [];
  D.spawn = function (o) { if (D.parts.length > 700) D.parts.shift(); o.life = o.life || 0.8; o.age = 0; o.z = o.z || 0; o.vz = o.vz || 0; o.vx = o.vx || 0; o.vy = o.vy || 0; o.rot = o.rot || 0; o.vr = o.vr || 0; D.parts.push(o); return o; };
  D.burst = function (kind, x, y, n, col, o) {
    o = o || {};
    for (var k = 0; k < n; k++) {
      var a = Math.random() * TAU, sp = (o.speed || 120) * (0.4 + Math.random() * 0.8);
      if (kind === 'cube') D.spawn({ k: 'cube', x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, z: 10, vz: 120 + Math.random() * 160, col: col, size: 4 + Math.random() * 4, life: 0.9 + Math.random() * 0.4, vr: (Math.random() - 0.5) * 12, g: 520, bounce: 0.4 });
      else if (kind === 'spark') D.spawn({ k: 'spark', x: x, y: y, vx: Math.cos(a) * sp * 1.6, vy: Math.sin(a) * sp * 1.6, col: col || '#fff', size: 2 + Math.random() * 2, life: 0.25 + Math.random() * 0.2, drag: 5 });
      else if (kind === 'star') D.spawn({ k: 'star', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, z: 0, col: col || '#ffd166', size: 4 + Math.random() * 3, life: 0.6, drag: 3, vr: 6 });
      else if (kind === 'smoke') D.spawn({ k: 'smoke', x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16, vx: Math.cos(a) * sp * 0.4, vy: Math.sin(a) * sp * 0.4 - 10, col: col || 'rgba(230,230,245,', size: 8 + Math.random() * 10, life: 0.7 + Math.random() * 0.6, drag: 2, grow: 18 });
      else if (kind === 'fire') D.spawn({ k: 'fire', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: 6 + Math.random() * 9, life: 0.35 + Math.random() * 0.35, drag: 4, grow: 10 });
      else if (kind === 'feather') D.spawn({ k: 'feather', x: x, y: y, vx: Math.cos(a) * sp * 0.6, vy: Math.sin(a) * sp * 0.6, z: 20, vz: 90 + Math.random() * 120, col: col || '#fff', size: 5, life: 1.6 + Math.random() * 0.8, g: 90, vr: (Math.random() - 0.5) * 6, drag: 1.2, sway: Math.random() * 6 });
      else if (kind === 'dust') D.spawn({ k: 'smoke', x: x + (Math.random() - 0.5) * 10, y: y, vx: Math.cos(a) * 18, vy: Math.sin(a) * 8, col: 'rgba(235,230,215,', size: 3 + Math.random() * 3, life: 0.45, drag: 3, grow: 9 });
      else if (kind === 'heart') D.spawn({ k: 'text', x: x + (Math.random() - 0.5) * 24, y: y, vx: 0, vy: -30, text: '❤', col: '#ff5c8a', size: 12, life: 0.9 });
      else if (kind === 'magic') D.spawn({ k: 'spark', x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: Math.cos(a) * sp * 0.4, vy: -40 - Math.random() * 60, col: col || '#c4b5fd', size: 2.5 + Math.random() * 2.5, life: 0.6 + Math.random() * 0.5, drag: 1.5 });
    }
  };
  D.text = function (x, y, text, col, size, o) { o = o || {}; return D.spawn({ k: 'text', x: x, y: y, vx: o.vx || (Math.random() - 0.5) * 30, vy: o.vy != null ? o.vy : -70, z: 0, vz: o.pop ? 140 : 0, g: o.pop ? 380 : 0, text: text, col: col, size: size || 16, life: o.life || 0.9, drag: 1.5, pop: 1, stroke: o.stroke !== false }); };
  D.ring = function (x, y, col, r, life, w) { return D.spawn({ k: 'ring', x: x, y: y, col: col, size: r, life: life || 0.45, w: w || 6 }); };
  D.flash = function (x, y, r, col, life) { return D.spawn({ k: 'flash', x: x, y: y, size: r, col: col || '255,220,150', life: life || 0.25 }); };
  D.drawParts = function (c, dt, layer) {
    var P = D.parts;
    for (var i = P.length - 1; i >= 0; i--) {
      var p = P[i];
      if (layer === 0) {
        p.age += dt; if (p.age >= p.life) { P.splice(i, 1); continue; }
        if (p.drag) { var dk = Math.exp(-p.drag * dt); p.vx *= dk; p.vy *= dk; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.g) { p.vz -= p.g * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; if (p.bounce) { p.vz = -p.vz * p.bounce; p.vx *= 0.6; p.vy *= 0.6; } else p.vz = 0; } }
        if (p.sway) p.x += Math.sin(p.age * p.sway) * 0.6;
        continue;
      }
      var u = p.age / p.life, al = 1 - u;
      var top = p.k === 'text' || p.k === 'ring' || p.k === 'flash' || p.k === 'spark' || p.k === 'fire' || p.k === 'star';
      if ((layer === 2) !== top) continue;
      c.save(); c.translate(p.x, p.y - p.z);
      if (p.k === 'cube') { c.globalAlpha = Math.min(1, al * 2); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); c.strokeStyle = 'rgba(27,22,54,.6)'; c.lineWidth = 1.2; c.strokeRect(-p.size / 2, -p.size / 2, p.size, p.size); }
      else if (p.k === 'smoke') { c.globalAlpha = al * 0.6; circ(c, 0, 0, p.size + (p.grow || 0) * u); c.fillStyle = p.col + '1)'; c.fill(); }
      else if (p.k === 'spark') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = al; c.strokeStyle = p.col; c.lineWidth = p.size; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-p.vx * 0.03, -p.vy * 0.03); c.stroke(); }
      else if (p.k === 'star') { c.globalAlpha = al; c.rotate(p.rot); c.beginPath(); for (var k = 0; k < 10; k++) { var rad = k % 2 ? p.size * 0.45 : p.size, a2 = k * Math.PI / 5; c.lineTo(Math.cos(a2) * rad, Math.sin(a2) * rad); } c.closePath(); c.fillStyle = p.col; c.fill(); }
      else if (p.k === 'fire') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = al; var rg = c.createRadialGradient(0, 0, 0, 0, 0, p.size + (p.grow || 0) * u); rg.addColorStop(0, 'rgba(255,240,180,1)'); rg.addColorStop(0.4, 'rgba(255,150,40,.8)'); rg.addColorStop(1, 'rgba(200,40,0,0)'); c.fillStyle = rg; circ(c, 0, 0, p.size + (p.grow || 0) * u); c.fill(); }
      else if (p.k === 'feather') { c.globalAlpha = Math.min(1, al * 2); c.rotate(p.rot); ell(c, 0, 0, p.size, p.size * 0.4); fs(c, p.col, 'rgba(27,22,54,.5)', 1); }
      else if (p.k === 'text') {
        var sc = p.pop ? (u < 0.15 ? D.ease.back(u / 0.15) : 1) : 1;
        c.globalAlpha = Math.min(1, al * 2.2); c.scale(sc, sc);
        c.font = '700 ' + p.size + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        if (p.stroke) { c.lineWidth = 4; c.strokeStyle = OL; c.lineJoin = 'round'; c.strokeText(p.text, 0, 0); }
        c.fillStyle = p.col; c.fillText(p.text, 0, 0);
      }
      else if (p.k === 'ring') { c.globalAlpha = al; c.strokeStyle = p.col; c.lineWidth = p.w * al + 1; circ(c, 0, 0, p.size * D.ease.out(u) + 4); c.stroke(); }
      else if (p.k === 'flash') { c.globalCompositeOperation = 'lighter'; var fg = c.createRadialGradient(0, 0, 0, 0, 0, p.size); fg.addColorStop(0, 'rgba(' + p.col + ',' + al + ')'); fg.addColorStop(1, 'rgba(' + p.col + ',0)'); c.fillStyle = fg; circ(c, 0, 0, p.size); c.fill(); }
      c.restore();
    }
  };

  // White hit-flash: draw the character into a scratch canvas and tint it.
  var scratch = null;
  D.gimFlash = function (c, x, y, look, o, amt, col) {
    if (!scratch) scratch = mk(140, 150);
    var s = scratch.getContext('2d'); s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, 140, 150);
    var oo = {}; for (var k in o) oo[k] = o[k]; oo.shadow = false;
    A.drawGim(s, 70, 120, look, oo);
    s.globalCompositeOperation = 'source-atop'; s.fillStyle = 'rgba(' + (col || '255,255,255') + ',' + amt + ')'; s.fillRect(0, 0, 140, 150); s.globalCompositeOperation = 'source-over';
    c.drawImage(scratch, x - 70, y - 120);
  };

  // ------------------------------------------------------------------ hub props
  D.tree = function (c, x, y, t) { // base at tile center
    var sw = Math.sin(t * 1.3 + x) * 2;
    c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, x, y + 14, 26, 9); c.fill();
    rr(c, x - 6, y - 16, 12, 30, 4); fs(c, '#8a5a34', OL, 3);
    var blobs = [[0, -50, 26], [-18, -36, 20], [18, -36, 20], [0, -30, 22]];
    blobs.forEach(function (b) { circ(c, x + b[0] + sw * (b[1] < -40 ? 1 : 0.5), y + b[1], b[2]); fs(c, '#4fae3e', OL, 3); });
    blobs.forEach(function (b) { circ(c, x + b[0] + sw * (b[1] < -40 ? 1 : 0.5), y + b[1], b[2] - 3); c.fillStyle = '#5fc44b'; c.fill(); });
    circ(c, x - 8 + sw, y - 58, 8); c.fillStyle = 'rgba(255,255,255,.22)'; c.fill();
    [[-10, -40], [12, -48], [4, -26]].forEach(function (a) { circ(c, x + a[0] + sw * 0.6, y + a[1], 3.2); fs(c, '#ff5c6c', OL, 1.5); });
  };
  D.lamp = function (c, x, y, t) {
    c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, x, y + 12, 10, 4); c.fill();
    rr(c, x - 3, y - 50, 6, 62, 2); fs(c, '#3b3f5c', OL, 2.5);
    rr(c, x - 10, y - 66, 20, 18, 5); fs(c, '#3b3f5c', OL, 2.5);
    var fl = 0.75 + Math.sin(t * 7 + x) * 0.08 + Math.sin(t * 13 + x) * 0.05;
    rr(c, x - 6, y - 62, 12, 10, 3); c.fillStyle = 'rgba(255,214,120,' + fl + ')'; c.fill();
    c.save(); c.globalCompositeOperation = 'lighter'; var g = c.createRadialGradient(x, y - 57, 2, x, y - 57, 46); g.addColorStop(0, 'rgba(255,200,110,' + 0.35 * fl + ')'); g.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = g; circ(c, x, y - 57, 46); c.fill(); c.restore();
  };
  D.fountain = function (c, x, y, t) { // centered on a 2x2 footprint, y = bottom edge
    var cx = x - T / 2, cy = y - T / 2 - 10;
    c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, cx, cy + 34, 56, 18); c.fill();
    ell(c, cx, cy + 22, 52, 22); fs(c, '#8f80c9', OL, 3);
    ell(c, cx, cy + 16, 46, 18); fs(c, '#5ec8ff', null);
    for (var k = 0; k < 3; k++) { var rp = ((t * 0.6 + k / 3) % 1); c.strokeStyle = 'rgba(255,255,255,' + (0.5 - rp * 0.5) + ')'; c.lineWidth = 2; ell(c, cx, cy + 16, 12 + rp * 32, 5 + rp * 12); c.stroke(); }
    rr(c, cx - 9, cy - 22, 18, 40, 5); fs(c, '#b7aaf0', OL, 3);
    ell(c, cx, cy - 22, 20, 8); fs(c, '#d9d2fb', OL, 3);
    for (k = 0; k < 10; k++) { var u = ((t * 1.4 + k / 10) % 1), a = k * 0.63; var px = cx + Math.cos(a) * u * 26, py = cy - 26 - Math.sin(u * Math.PI) * 26 + u * 20; circ(c, px, py, 2.4 * (1 - u * 0.4)); c.fillStyle = 'rgba(160,225,255,' + (1 - u * 0.5) + ')'; c.fill(); }
    circ(c, cx, cy - 30, 5); c.fillStyle = '#e0f4ff'; c.fill();
  };
  D.sign = function (c, o, t) {
    var x = o.x, y = o.y;
    rr(c, x - 3, y - 26, 6, 30, 2); fs(c, '#8a5a34', OL, 2.5);
    var n = (o.lines || []).length, bh = 42 + n * 13;
    rr(c, x - 74, y - 22 - bh, 148, bh, 10); fs(c, '#2c2468', OL, 3);
    rr(c, x - 68, y - 16 - bh, 136, bh - 12, 7); c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.stroke();
    D.tag(c, o.text, x, y - 6 - bh + 6, { size: 13, color: '#ffd166' });
    (o.lines || []).forEach(function (l, k) { c.font = '600 11px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e6e2ff'; c.fillText(l, x, y - bh + 14 + k * 13); });
  };
  D.banner = function (c, o, t) { // big game title arch over the island
    var x = o.x, y = o.y + 8;
    var txt = o.text || 'BEDWARS', sp = txt.indexOf(' ');
    var A1 = txt === 'BEDWARS' ? 'BED' : sp > 0 ? txt.slice(0, sp + 1) : txt, A2 = txt === 'BEDWARS' ? 'WARS' : sp > 0 ? txt.slice(sp + 1) : '';
    var col = { ctf: '#3fa9ff', spleef: '#7dd3fc', hide: '#ff922b' }[o.game] || '#ff4b5c';
    c.save(); c.font = '700 38px Fredoka, sans-serif';
    var fsz = Math.min(38, 38 * 260 / Math.max(1, c.measureText(txt).width)); c.restore();
    var half = Math.max(120, Math.min(170, (fsz * txt.length * 0.32) + 40));
    [-half + 16, half - 16].forEach(function (dx) { rr(c, x + dx - 6, y - 96, 12, 100, 3); fs(c, '#5a331b', OL, 3); });
    rr(c, x - half, y - 118, half * 2, 54, 14); fs(c, '#1a0f3d', OL, 4);
    c.save(); c.font = '700 ' + fsz + 'px Fredoka, sans-serif'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    var w1 = c.measureText(A1).width, w2 = c.measureText(A2).width, x0 = x - (w1 + w2) / 2;
    c.textAlign = 'left'; c.lineWidth = 7; c.strokeStyle = OL; c.strokeText(A1, x0, y - 90); if (A2) c.strokeText(A2, x0 + w1, y - 90);
    var gl = 0.7 + Math.sin(t * 3) * 0.3; c.shadowColor = col; c.shadowBlur = 14 * gl; c.fillStyle = col; c.fillText(A1, x0, y - 90); c.shadowColor = 'rgba(255,255,255,' + gl * 0.6 + ')'; c.fillStyle = '#fff'; if (A2) c.fillText(A2, x0 + w1, y - 90);
    c.restore();
    var n = Math.round(half * 2 / 26); for (var k = 0; k <= n; k++) { circ(c, x - half + 16 + k * ((half * 2 - 32) / n), y - 122, 3.5); c.fillStyle = (Math.floor(t * 4) + k) % 2 ? '#ffd166' : '#ff6ec7'; c.fill(); }
  };
  D.portal = function (c, o, t, label) {
    var px = o.x, py = o.y;
    c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, px, py + 2, 70, 16); c.fill();
    c.save(); c.beginPath(); c.moveTo(px - 46, py - 6); c.lineTo(px - 46, py - 104); c.arc(px, py - 104, 46, Math.PI, 0); c.lineTo(px + 46, py - 6); c.closePath(); c.clip();
    var vg = c.createRadialGradient(px, py - 90, 4, px, py - 80, 110); vg.addColorStop(0, '#fff3c4'); vg.addColorStop(0.3, '#ffb938'); vg.addColorStop(0.7, '#c1121f'); vg.addColorStop(1, '#3a0610');
    c.fillStyle = vg; c.fillRect(px - 50, py - 152, 100, 150);
    c.translate(px, py - 86);
    for (var k = 0; k < 5; k++) { c.rotate(t * 1.4 + k * 1.256); c.strokeStyle = 'rgba(255,255,255,' + (0.16 + k * 0.05) + ')'; c.lineWidth = 3; c.beginPath(); for (var a = 0; a < 6; a += 0.3) c.lineTo(Math.cos(a) * a * 7, Math.sin(a) * a * 7); c.stroke(); }
    c.restore();
    c.beginPath(); c.moveTo(px - 56, py - 2); c.lineTo(px - 56, py - 104); c.arc(px, py - 104, 56, Math.PI, 0); c.lineTo(px + 56, py - 2); c.lineTo(px + 46, py - 2); c.lineTo(px + 46, py - 104); c.arc(px, py - 104, 46, 0, Math.PI, true); c.lineTo(px - 46, py - 2); c.closePath();
    c.fillStyle = '#7a4a28'; c.fill(); c.strokeStyle = OL; c.lineWidth = 3; c.stroke();
    for (var b = 0; b < 9; b++) { var ang = Math.PI + b * Math.PI / 8; circ(c, px + Math.cos(ang) * 51, py - 104 + Math.sin(ang) * 51, 3.4); c.fillStyle = (Math.floor(t * 4) + b) % 2 ? '#ffd166' : '#fff'; c.fill(); }
    D.tag(c, label || o.label, px, py - 178, { size: 14, color: '#ffd166', bg: '#1a0f3d' });
    if (Math.random() < 0.3) D.spawn({ k: 'spark', x: px + (Math.random() - 0.5) * 80, y: py - 20 - Math.random() * 120, vx: 0, vy: -30, col: '#ffd166', size: 2, life: 0.7, drag: 1 });
  };
  D.board = function (c, o, t, rows, me) { // the hub leaderboard
    var x = o.x, y = o.y, w = 210, h = 184;
    [-90, 90].forEach(function (dx) { rr(c, x + dx - 5, y - 30, 10, 34, 3); fs(c, '#5a331b', OL, 3); });
    rr(c, x - w / 2, y - h - 20, w, h, 14); fs(c, '#1a1446', OL, 4);
    rr(c, x - w / 2 + 6, y - h - 14, w - 12, 30, 9); c.fillStyle = '#ffd166'; c.fill();
    c.font = '700 15px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#2a1300'; c.fillText('🏆 TOP BEDWARS PLAYERS', x, y - h + 1);
    rows = rows || [];
    if (!rows.length) { c.fillStyle = '#bdb6ee'; c.font = '600 12px Fredoka, sans-serif'; c.fillText('Win a game to get on the board!', x, y - h + 60); }
    rows.slice(0, 8).forEach(function (r, k) {
      var ry = y - h + 30 + k * 16;
      c.textAlign = 'left'; c.font = '700 12px Fredoka, sans-serif'; c.fillStyle = k === 0 ? '#ffd166' : k === 1 ? '#e6e8f2' : k === 2 ? '#e8a87c' : '#bdb6ee';
      c.fillText((k + 1) + '. ' + String(r.nick).slice(0, 14), x - w / 2 + 14, ry);
      c.textAlign = 'right'; c.fillStyle = '#fff'; c.fillText(r.wins + ' wins', x + w / 2 - 14, ry);
    });
    if (me) { c.textAlign = 'center'; c.font = '600 11px Fredoka, sans-serif'; c.fillStyle = '#2bd576'; c.fillText(me, x, y - 32); }
  };
  D.soon = function (c, o, t) {
    var x = o.x, y = o.y;
    for (var k = -2; k <= 2; k++) { rr(c, x + k * 22 - 3, y - 34, 6, 38, 2); fs(c, '#d9dce6', OL, 2); }
    rr(c, x - 52, y - 28, 104, 9, 3); fs(c, '#ffb703', OL, 2); rr(c, x - 52, y - 14, 104, 9, 3); fs(c, '#ffb703', OL, 2);
    c.save(); c.beginPath(); rr(c, x - 52, y - 28, 104, 9, 3); c.clip(); c.fillStyle = '#1b1636'; for (k = -6; k < 6; k++) { c.beginPath(); c.moveTo(x + k * 16, y - 28); c.lineTo(x + k * 16 + 8, y - 28); c.lineTo(x + k * 16, y - 19); c.lineTo(x + k * 16 - 8, y - 19); c.fill(); } c.restore();
    D.tag(c, '🚧 ' + o.label, x, y - 64, { size: 14, color: '#fff', bg: '#3b2f8f' });
    D.tag(c, o.sub, x, y - 44, { size: 11, color: '#ffd166' });
  };
  D.hubNpc = function (c, o, t, near, count) {
    var x = o.x, y = o.y + 10;
    var col = o.act === 'quick' ? '#ff4b5c' : o.act === 'practice' ? '#7b5cff' : o.act === 'private' ? '#3a86ff' : '#2bd576';
    c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, x, y + 6, 30, 10); c.fill();
    ell(c, x, y + 2, 28, 11); fs(c, col, OL, 3);
    ell(c, x, y, 20, 7); c.fillStyle = 'rgba(255,255,255,.25)'; c.fill();
    if (near) { c.save(); c.globalCompositeOperation = 'lighter'; var g = c.createRadialGradient(x, y - 20, 4, x, y - 20, 60); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; circ(c, x, y - 20, 60); c.fill(); c.restore(); }
    A.drawGim(c, x, y - 2, o.look, { t: t + x * 0.01, dir: 0, scale: 1.15, dance: near && o.act === 'quick' });
    var bob = Math.sin(t * 2.6 + x) * 2.5;
    D.tag(c, o.label, x, y - 82 + bob, { size: 14, color: '#fff', bg: col });
    var sub = o.sub + (count ? ' · ' + count + ' playing' : '');
    D.tag(c, sub, x, y - 64 + bob, { size: 11, color: count ? '#2bd576' : '#e6e2ff' });
    if (near) { var ab = y - 104 + Math.abs(Math.sin(t * 5)) * -8; c.beginPath(); c.moveTo(x - 9, ab); c.lineTo(x + 9, ab); c.lineTo(x, ab + 11); c.closePath(); fs(c, '#ffd166', OL, 2.5); }
  };

  D.projectile = function (c, p, t) {
    if (p.kind === 'arrow') {
      var a = Math.atan2(p.vy || 0, p.vx || 1);
      c.save(); c.translate(p.x, p.y); c.rotate(a);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-34, 0); c.lineTo(-12, 0); c.stroke();
      c.strokeStyle = OL; c.lineWidth = 4; c.beginPath(); c.moveTo(-12, 0); c.lineTo(10, 0); c.stroke();
      c.strokeStyle = '#c99a5b'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.moveTo(14, 0); c.lineTo(8, -4); c.lineTo(8, 4); c.closePath(); fs(c, '#cfd6e4', OL, 1.5);
      c.fillStyle = '#fff'; c.fillRect(-13, -3, 5, 6);
      c.restore();
    } else if (p.kind === 'fb') {
      c.save(); c.translate(p.x, p.y);
      c.fillStyle = 'rgba(10,6,30,.25)'; ell(c, 0, 18, 12, 5); c.fill();
      var g = c.createRadialGradient(0, 0, 2, 0, 0, 26); g.addColorStop(0, 'rgba(255,200,80,.6)'); g.addColorStop(1, 'rgba(255,90,0,0)'); c.fillStyle = g; circ(c, 0, 0, 26); c.fill();
      c.rotate(t * 8); D.drawItem(c, 'fireball', 1); c.restore();
    } else if (p.kind === 'pearl' || p.kind === 'egg') {
      c.save(); c.translate(p.x, p.y); c.fillStyle = 'rgba(10,6,30,.25)'; ell(c, 0, 18, 8, 3); c.fill(); c.rotate(t * 10); D.drawItem(c, p.kind, 0.6, { team: p.team }); c.restore();
    }
  };
})();
