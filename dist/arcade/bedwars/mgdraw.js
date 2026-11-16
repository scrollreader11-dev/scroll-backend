/* ============================================================
   ScrollHub Games — art for Capture the Flag, TNT Spleef and Prop Hunt:
   props, spleef floors, carried flags, pickups and the new item icons.
   Extends window.BWD (draw.js).
   ============================================================ */
(function () {
  var B = window.BW, M = window.MG, D = window.BWD, A = window.SC.art;
  var T = B.T, W = B.W, H = B.H, TAU = Math.PI * 2, OL = '#1b1636';
  var rr = A.rr, ell = A.ell, circ = A.circ, shade = A.shade, hash = B.hash;
  function fs(c, f, st, lw) { if (f) { c.fillStyle = f; c.fill(); } if (st) { c.strokeStyle = st; c.lineWidth = lw || 3; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); } }
  function mk(w, h) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
  function teamCol(t) { return (B.TEAMS[t] || B.TEAMS[0]).color; }
  function hexA(h, a) { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); var n = parseInt(h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  D.hexA = hexA;
  function shadow(c, x, y, rx, ry) { c.fillStyle = 'rgba(10,6,30,.3)'; ell(c, x, y, rx, ry); c.fill(); }

  // ------------------------------------------------------------------ props (Prop Hunt)
  // Drawn with the base at (x, y) = the bottom middle of where it stands.
  D.prop = function (c, kind, x, y, t, o) {
    o = o || {};
    c.save(); c.translate(x, y);
    if (o.sc) c.scale(o.sc, o.sc);
    if (o.wob) c.rotate(Math.sin(t * 30) * 0.06 * o.wob);
    if (kind === 'barrel') {
      shadow(c, 0, 0, 16, 6);
      rr(c, -14, -36, 28, 36, 9); fs(c, '#b5753e', OL, 3);
      c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(4, -34, 8, 32);
      ['#6b7280', '#6b7280'].forEach(function (col, k) { c.fillStyle = col; c.fillRect(-14, -30 + k * 20, 28, 5); c.strokeStyle = OL; c.lineWidth = 1.5; c.strokeRect(-14, -30 + k * 20, 28, 5); });
      ell(c, 0, -36, 13, 5); fs(c, '#c98d55', OL, 2.5); ell(c, 0, -36, 8, 2.5); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
    } else if (kind === 'crate') {
      shadow(c, 0, 0, 18, 6);
      rr(c, -17, -34, 34, 34, 4); fs(c, '#c99a5b', OL, 3);
      c.strokeStyle = '#8a5a34'; c.lineWidth = 3; c.beginPath(); c.moveTo(-14, -31); c.lineTo(14, -3); c.moveTo(14, -31); c.lineTo(-14, -3); c.stroke();
      c.strokeStyle = OL; c.lineWidth = 2; c.strokeRect(-13, -30, 26, 26);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-15, -32, 30, 3);
    } else if (kind === 'bush') {
      shadow(c, 0, 0, 19, 7);
      [[-9, -14, 12], [9, -14, 12], [0, -22, 13], [0, -10, 13]].forEach(function (b, k) { circ(c, b[0], b[1], b[2]); fs(c, k === 2 ? '#5fc24a' : '#4fae3e', OL, 2.5); });
      [[-6, -22], [7, -18], [-2, -10]].forEach(function (b) { circ(c, b[0], b[1], 2.4); c.fillStyle = '#ff7eb6'; c.fill(); });
    } else if (kind === 'pot') {
      shadow(c, 0, 0, 12, 5);
      c.beginPath(); c.moveTo(-11, -18); c.lineTo(11, -18); c.lineTo(8, 0); c.lineTo(-8, 0); c.closePath(); fs(c, '#d9663b', OL, 2.5);
      rr(c, -12, -21, 24, 6, 2); fs(c, '#e57a4f', OL, 2);
      [[-6, -30, '#ff7eb6'], [5, -33, '#fff27a'], [0, -38, '#9ad7ff']].forEach(function (f) { c.strokeStyle = '#3f9a31'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(f[0] * 0.4, -20); c.lineTo(f[0], f[1]); c.stroke(); circ(c, f[0], f[1], 4.5); fs(c, f[2], OL, 1.8); circ(c, f[0], f[1], 1.6); c.fillStyle = '#ffb703'; c.fill(); });
    } else if (kind === 'hay') {
      shadow(c, 0, 0, 20, 6);
      rr(c, -19, -26, 38, 26, 6); fs(c, '#f2c94c', OL, 3);
      c.strokeStyle = '#c99a2e'; c.lineWidth = 1.6; for (var k = -14; k <= 14; k += 5) { c.beginPath(); c.moveTo(k, -24); c.lineTo(k + 2, -2); c.stroke(); }
      c.fillStyle = '#a0703f'; c.fillRect(-19, -18, 38, 3); c.fillRect(-19, -9, 38, 3);
    } else if (kind === 'pumpkin') {
      shadow(c, 0, 0, 16, 6);
      [-8, 8, 0].forEach(function (dx) { ell(c, dx, -13, dx ? 9 : 10, 13); fs(c, dx ? '#f08a24' : '#ff9f3a', OL, 2.5); });
      rr(c, -2.5, -30, 5, 7, 2); fs(c, '#6b8e23', OL, 2);
      if (o.face) { c.fillStyle = '#ffd166'; c.beginPath(); c.moveTo(-6, -17); c.lineTo(-2, -13); c.lineTo(-8, -13); c.fill(); c.beginPath(); c.moveTo(6, -17); c.lineTo(8, -13); c.lineTo(2, -13); c.fill(); }
    } else if (kind === 'trash') {
      shadow(c, 0, 0, 13, 5);
      c.beginPath(); c.moveTo(-11, -30); c.lineTo(11, -30); c.lineTo(9, 0); c.lineTo(-9, 0); c.closePath(); fs(c, '#8d98ad', OL, 2.5);
      c.strokeStyle = 'rgba(27,22,54,.4)'; c.lineWidth = 2; for (var j = -5; j <= 5; j += 5) { c.beginPath(); c.moveTo(j, -26); c.lineTo(j * 0.85, -4); c.stroke(); }
      rr(c, -13, -35, 26, 6, 3); fs(c, '#a7b0c3', OL, 2); rr(c, -4, -39, 8, 4, 2); fs(c, '#a7b0c3', OL, 1.8);
    } else if (kind === 'mailbox') {
      shadow(c, 0, 0, 10, 4);
      rr(c, -2.5, -22, 5, 22, 2); fs(c, '#8a5a34', OL, 2);
      rr(c, -11, -38, 22, 17, 8); fs(c, '#3a86ff', OL, 2.5);
      c.fillStyle = '#ff4b5c'; c.fillRect(9, -40, 3, 10); c.fillRect(9, -40, 7, 4);
    } else if (kind === 'stool') {
      shadow(c, 0, 0, 12, 4);
      c.strokeStyle = OL; c.lineWidth = 5; c.beginPath(); c.moveTo(-8, -16); c.lineTo(-10, 0); c.moveTo(8, -16); c.lineTo(10, 0); c.stroke();
      c.strokeStyle = '#a0703f'; c.lineWidth = 3; c.stroke();
      ell(c, 0, -18, 13, 5); fs(c, '#c08a52', OL, 2.5);
    } else if (kind === 'lamp') {
      shadow(c, 0, 0, 9, 4);
      rr(c, -2.5, -52, 5, 52, 2); fs(c, '#4a4f6a', OL, 2);
      rr(c, -8, -62, 16, 13, 4); fs(c, '#2c2f44', OL, 2);
      var gl = (Math.sin(t * 2 + x) + 1) / 2; rr(c, -5, -59, 10, 8, 2); c.fillStyle = 'rgba(255,220,130,' + (0.7 + gl * 0.3) + ')'; c.fill();
    } else if (kind === 'snowman') {
      shadow(c, 0, 0, 15, 5);
      circ(c, 0, -12, 13); fs(c, '#ffffff', OL, 2.5); circ(c, 0, -32, 10); fs(c, '#ffffff', OL, 2.5);
      c.fillStyle = OL; circ(c, -3.5, -34, 1.6); c.fill(); circ(c, 3.5, -34, 1.6); c.fill();
      c.beginPath(); c.moveTo(0, -31); c.lineTo(8, -30); c.lineTo(0, -29); c.closePath(); c.fillStyle = '#ff922b'; c.fill();
      rr(c, -9, -46, 18, 4, 2); fs(c, '#1b1636', null); rr(c, -6, -56, 12, 11, 2); fs(c, '#1b1636', null);
      c.fillStyle = '#ff4b5c'; c.fillRect(-10, -24, 20, 4);
    } else if (kind === 'xtree') { // decorated Christmas tree with twinkling lights + star
      shadow(c, 0, 0, 22, 7);
      rr(c, -5, -12, 10, 12, 2); fs(c, '#7a4a26', OL, 2.5);
      [[-24, -10, 24, -34], [-20, -28, 20, -52], [-15, -46, 15, -68]].forEach(function (q) { c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(0, q[3] - 4); c.lineTo(q[2], q[1]); c.closePath(); fs(c, '#2e9e4f', OL, 3); c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.moveTo(4, q[3]); c.lineTo(q[2], q[1]); c.lineTo(4, q[1]); c.fill(); });
      var bc = ['#ff4b5c', '#ffd166', '#3fa9ff', '#ff6ec7', '#7cfc6a'];
      for (var bi = 0; bi < 11; bi++) { var by2 = -16 - bi * 5, bx2 = Math.sin(bi * 2.4) * (20 - bi * 1.5); var on = (Math.floor(t * 3) + bi) % 3 !== 0; c.fillStyle = bc[bi % 5]; c.shadowColor = bc[bi % 5]; c.shadowBlur = on ? 8 : 0; circ(c, bx2, by2, on ? 2.6 : 2); c.fill(); }
      c.shadowBlur = 0;
      c.save(); c.translate(0, -74); c.rotate(Math.sin(t * 2) * 0.08); c.beginPath(); for (var si = 0; si < 10; si++) { var sr = si % 2 ? 3.5 : 8, sa = -Math.PI / 2 + si * Math.PI / 5; c.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr); } c.closePath(); c.shadowColor = '#ffd166'; c.shadowBlur = 12; fs(c, '#ffd166', OL, 2); c.restore();
    } else if (kind === 'present' || kind === 'presents') {
      var gifts = kind === 'present' ? [[0, 0, 22, 18, '#ff4b5c', '#ffd166']] : [[-12, 0, 20, 16, '#3fa9ff', '#ffffff'], [11, 0, 18, 22, '#2bd576', '#ff4b5c'], [-1, -16, 16, 13, '#b185ff', '#ffd166']];
      shadow(c, 0, 0, kind === 'present' ? 15 : 24, 6);
      gifts.forEach(function (g2) { var gx = g2[0], gy = g2[1], gw = g2[2], gh = g2[3]; rr(c, gx - gw / 2, gy - gh, gw, gh, 3); fs(c, g2[4], OL, 2.5); c.fillStyle = g2[5]; c.fillRect(gx - 2.5, gy - gh, 5, gh); c.fillRect(gx - gw / 2, gy - gh / 2 - 2, gw, 4); c.strokeStyle = g2[5]; c.lineWidth = 3; c.beginPath(); c.ellipse(gx - 5, gy - gh - 3, 5, 3, -0.4, 0, TAU); c.ellipse(gx + 5, gy - gh - 3, 5, 3, 0.4, 0, TAU); c.stroke(); });
    } else if (kind === 'candycane') {
      shadow(c, 0, 0, 8, 3);
      c.lineCap = 'round'; c.lineWidth = 9; c.strokeStyle = OL; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -40); c.arc(-8, -40, 8, 0, Math.PI, true); c.stroke();
      c.lineWidth = 5.5; c.strokeStyle = '#ffffff'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -40); c.arc(-8, -40, 8, 0, Math.PI, true); c.stroke();
      c.strokeStyle = '#ff3b4f'; c.setLineDash([5, 5]); c.lineDashOffset = 0; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -40); c.arc(-8, -40, 8, 0, Math.PI, true); c.stroke(); c.setLineDash([]);
    } else if (kind === 'gingerbread') {
      shadow(c, 0, 0, 13, 4); var gb = '#c4773b';
      rr(c, -11, -30, 22, 28, 9); fs(c, gb, OL, 2.5); circ(c, 0, -38, 10); fs(c, gb, OL, 2.5);
      [[-13, -24, -19, -14], [13, -24, 19, -14], [-6, -4, -9, 2], [6, -4, 9, 2]].forEach(function (l) { c.lineWidth = 7; c.strokeStyle = OL; c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke(); c.lineWidth = 4; c.strokeStyle = gb; c.stroke(); });
      c.fillStyle = OL; circ(c, -3.5, -40, 1.6); c.fill(); circ(c, 3.5, -40, 1.6); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, -37, 4, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
      ['#ff4b5c', '#2bd576', '#3fa9ff'].forEach(function (bcol, k) { c.fillStyle = bcol; circ(c, 0, -24 + k * 7, 2.2); c.fill(); });
    } else if (kind === 'reindeer') {
      shadow(c, 0, 0, 20, 5); var rd = '#a0683a';
      [[-12, 0], [-6, 0], [8, 0], [14, 0]].forEach(function (lg) { rr(c, lg[0] - 2.5, -14, 5, 14, 2); fs(c, '#6b4424', OL, 2); });
      ell(c, 1, -18, 18, 9); fs(c, rd, OL, 2.5); ell(c, 4, -14, 9, 4); c.fillStyle = '#e8c9a0'; c.fill();
      rr(c, 12, -36, 9, 18, 4); fs(c, rd, OL, 2.5); ell(c, 19, -38, 8, 7); fs(c, rd, OL, 2.5);
      c.strokeStyle = '#6b4424'; c.lineWidth = 3; c.beginPath(); c.moveTo(16, -44); c.lineTo(12, -54); c.lineTo(8, -56); c.moveTo(13, -50); c.lineTo(17, -56); c.moveTo(22, -44); c.lineTo(26, -54); c.lineTo(30, -55); c.stroke();
      var nb = 0.6 + Math.sin(t * 4) * 0.4; c.fillStyle = '#ff3b4f'; c.shadowColor = '#ff3b4f'; c.shadowBlur = 10 * nb; circ(c, 26, -37, 3.6); c.fill(); c.shadowBlur = 0;
      c.fillStyle = OL; circ(c, 19, -40, 1.5); c.fill();
    } else if (kind === 'sleigh') {
      shadow(c, 0, 0, 30, 7);
      c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.beginPath(); c.moveTo(-28, -2); c.lineTo(22, -2); c.quadraticCurveTo(32, -2, 30, -10); c.stroke();
      c.beginPath(); c.moveTo(-26, -24); c.quadraticCurveTo(-30, -6, -18, -6); c.lineTo(18, -6); c.quadraticCurveTo(26, -8, 24, -20); c.lineTo(10, -20); c.lineTo(4, -12); c.lineTo(-14, -12); c.lineTo(-18, -26); c.closePath(); fs(c, '#d62839', OL, 3);
      c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.beginPath(); c.moveTo(-22, -10); c.lineTo(20, -10); c.stroke();
      rr(c, -16, -30, 16, 14, 3); fs(c, '#2bd576', OL, 2); c.fillStyle = '#ffd166'; c.fillRect(-9.5, -30, 3, 14);
    } else if (kind === 'ornament') {
      shadow(c, 0, 0, 13, 4);
      var oc = ['#ff4b5c', '#3fa9ff', '#ffd166', '#b185ff'][Math.abs(Math.round(x + y)) % 4];
      circ(c, 0, -15, 15); fs(c, oc, OL, 3); c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, -5, -21, 4.5, 3); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-14, -12); c.quadraticCurveTo(0, -6, 14, -12); c.stroke();
      rr(c, -5, -33, 10, 5, 1.5); fs(c, '#c9d1e3', OL, 2);
    } else if (kind === 'toysoldier') {
      shadow(c, 0, 0, 10, 4);
      rr(c, -6, -14, 5, 14, 1); fs(c, '#1b1636', null); rr(c, 1, -14, 5, 14, 1); fs(c, '#1b1636', null);
      rr(c, -8, -32, 16, 19, 3); fs(c, '#d62839', OL, 2.5); c.fillStyle = '#ffd166'; c.fillRect(-1, -32, 2, 19); c.fillRect(-8, -16, 16, 3);
      circ(c, 0, -38, 6.5); fs(c, '#ffd9b3', OL, 2); c.fillStyle = '#ff9ec7'; circ(c, -3.5, -36, 1.5); c.fill(); circ(c, 3.5, -36, 1.5); c.fill();
      rr(c, -6.5, -54, 13, 13, 4); fs(c, '#1b1636', OL, 2); c.fillStyle = '#ffd166'; c.fillRect(-6.5, -43, 13, 2);
    } else if (kind === 'wreath') {
      shadow(c, 0, 0, 10, 4);
      rr(c, -2, -34, 4, 34, 1.5); fs(c, '#7a4a26', OL, 2);
      c.lineWidth = 9; c.strokeStyle = OL; c.beginPath(); c.arc(0, -40, 13, 0, TAU); c.stroke(); c.lineWidth = 6; c.strokeStyle = '#2e9e4f'; c.stroke();
      for (var wi = 0; wi < 8; wi++) { var wa = wi * TAU / 8; c.fillStyle = wi % 2 ? '#ff4b5c' : '#ffd166'; circ(c, Math.cos(wa) * 13, -40 + Math.sin(wa) * 13, 2); c.fill(); }
      c.fillStyle = '#ff3b4f'; c.beginPath(); c.moveTo(0, -27); c.lineTo(-7, -21); c.lineTo(-5, -29); c.closePath(); c.moveTo(0, -27); c.lineTo(7, -21); c.lineTo(5, -29); c.closePath(); c.fill();
    } else if (kind === 'snowpile') {
      shadow(c, 0, 0, 20, 5);
      [[-9, -6, 11], [8, -5, 10], [0, -12, 12]].forEach(function (s2) { circ(c, s2[0], s2[1], s2[2]); fs(c, '#ffffff', OL, 2.5); });
      [[-9, -6, 11], [8, -5, 10], [0, -12, 12]].forEach(function (s2) { circ(c, s2[0], s2[1], s2[2] - 2); c.fillStyle = '#ffffff'; c.fill(); });
      c.fillStyle = 'rgba(160,200,255,.5)'; ell(c, 4, -4, 10, 3); c.fill();
    } else if (kind === 'bannerred' || kind === 'bannerblue' || kind === 'bannergold' || kind === 'bannerorange' || kind === 'bannerpurple' || kind === 'bannergreen' || kind === 'bannerpink') {
      var bcol = { bannerred: '#d62839', bannerblue: '#3a6dff', bannergold: '#e0a400', bannerorange: '#ff7a1a', bannerpurple: '#8a3ffc', bannergreen: '#1fa64a', bannerpink: '#ff5fa8' }[kind];
      shadow(c, 0, 0, 9, 3);
      rr(c, -2, -62, 4, 62, 1.5); fs(c, '#4a4f6a', OL, 2); circ(c, 0, -64, 3.5); fs(c, '#ffd166', OL, 1.5);
      var wv2 = Math.sin(t * 3 + x * 0.1) * 2;
      c.beginPath(); c.moveTo(2, -58); c.lineTo(24 + wv2, -56); c.lineTo(24 - wv2, -26); c.lineTo(13, -31); c.lineTo(2, -26); c.closePath(); fs(c, bcol, OL, 2.5);
      c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); for (var bs = 0; bs < 10; bs++) { var ba2 = -Math.PI / 2 + bs * Math.PI / 5, brr = bs % 2 ? 2.5 : 5.5; c.lineTo(13 + Math.cos(ba2) * brr, -44 + Math.sin(ba2) * brr); } c.closePath(); c.fill();
    } else if (kind === 'lanternpost') { // pole with a hanging string of holiday lights
      shadow(c, 0, 0, 9, 3);
      rr(c, -2.5, -58, 5, 58, 2); fs(c, '#2c2f44', OL, 2);
      c.strokeStyle = '#1b1636'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -54); c.quadraticCurveTo(14, -40, 28, -50); c.moveTo(0, -54); c.quadraticCurveTo(-14, -40, -28, -50); c.stroke();
      var lc = ['#ff4b5c', '#ffd166', '#3fa9ff', '#2bd576'];
      for (var li2 = 0; li2 < 8; li2++) { var side3 = li2 < 4 ? 1 : -1, u3 = ((li2 % 4) + 0.6) / 4.2, lx3 = side3 * 28 * u3, ly3 = -54 + (1 - Math.pow(2 * u3 - 1, 2)) * 9 + u3 * 3; var on2 = (Math.floor(t * 4) + li2) % 2; c.fillStyle = lc[li2 % 4]; c.shadowColor = lc[li2 % 4]; c.shadowBlur = on2 ? 9 : 0; circ(c, lx3, ly3 + 3, on2 ? 2.8 : 2.2); c.fill(); }
      c.shadowBlur = 0;
    } else if (kind === 'icecrystal') {
      shadow(c, 0, 0, 12, 4);
      [[0, -40, 7], [-9, -22, 5], [10, -24, 5]].forEach(function (q) { c.beginPath(); c.moveTo(q[0], q[1] - q[2] * 2.2); c.lineTo(q[0] + q[2], q[1]); c.lineTo(q[0], q[1] + q[2] * 3.2); c.lineTo(q[0] - q[2], q[1]); c.closePath(); fs(c, 'rgba(170,225,255,.9)', OL, 2.5); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(q[0], q[1] - q[2] * 2); c.lineTo(q[0] - q[2] * 0.6, q[1]); c.lineTo(q[0], q[1] + q[2]); c.closePath(); c.fill(); });
      var sp3 = (Math.sin(t * 3 + x) + 1) / 2; c.fillStyle = 'rgba(255,255,255,' + sp3 + ')'; c.font = '700 10px sans-serif'; c.textAlign = 'center'; c.fillText('✦', 8, -48);
    } else if (kind === 'deadtree') {
      shadow(c, 0, 0, 16, 5);
      c.strokeStyle = OL; c.lineCap = 'round'; c.lineWidth = 9; c.beginPath(); c.moveTo(0, 0); c.lineTo(-2, -40); c.moveTo(-1, -26); c.lineTo(-16, -44); c.moveTo(-2, -38); c.lineTo(12, -58); c.moveTo(4, -50); c.lineTo(20, -52); c.moveTo(-10, -36); c.lineTo(-22, -34); c.stroke();
      c.strokeStyle = '#4b3a52'; c.lineWidth = 5; c.stroke();
      c.fillStyle = '#ffd166'; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3); circ(c, -3, -30, 1.8); c.fill(); circ(c, 2, -30, 1.8); c.fill(); c.globalAlpha = 1;
    } else if (kind === 'gravestone') {
      shadow(c, 0, 0, 12, 4); c.beginPath(); c.moveTo(-11, 0); c.lineTo(-11, -22); c.arc(0, -22, 11, Math.PI, 0); c.lineTo(11, 0); c.closePath(); fs(c, '#9aa3b5', OL, 2.5);
      c.fillStyle = '#6b7389'; rr(c, -6, -24, 12, 3, 1); c.fill(); rr(c, -2, -30, 4, 14, 1); c.fill(); c.fillStyle = '#4a7a3a'; ell(c, -7, -1, 6, 2.5); c.fill(); ell(c, 6, -1, 5, 2); c.fill();
    } else if (kind === 'cauldron') {
      shadow(c, 0, 0, 15, 5); ell(c, 0, -10, 15, 11); fs(c, '#2a2a3a', OL, 2.5); ell(c, 0, -18, 13, 4); fs(c, '#3cff7a', OL, 2);
      for (var cb = 0; cb < 3; cb++) { var cp = (t * 0.8 + cb / 3) % 1; c.globalAlpha = 1 - cp; circ(c, -6 + cb * 6, -20 - cp * 22, 2.5 + cp * 2); c.fillStyle = '#7dff9e'; c.fill(); } c.globalAlpha = 1;
      c.fillStyle = '#ff7a1a'; c.globalAlpha = 0.7 + 0.3 * Math.sin(t * 12); ell(c, 0, 1, 10, 3); c.fill(); c.globalAlpha = 1;
    } else if (kind === 'ghostprop') {
      var gy = -14 + Math.sin(t * 2.4 + x) * 4; shadow(c, 0, 0, 9, 3); c.globalAlpha = 0.92;
      c.beginPath(); c.arc(0, gy - 8, 11, Math.PI, 0); c.lineTo(11, gy + 8); for (var gw = 0; gw < 4; gw++) c.quadraticCurveTo(8 - gw * 5.5 - 1, gy + (gw % 2 ? 3 : 12), 5.5 - gw * 5.5, gy + 8); c.closePath(); fs(c, '#f4f2ff', OL, 2.5);
      c.fillStyle = OL; ell(c, -4, gy - 9, 2, 3); c.fill(); ell(c, 4, gy - 9, 2, 3); c.fill(); ell(c, 0, gy - 2, 2.5, 3 + Math.sin(t * 4)); c.fill(); c.globalAlpha = 1;
    } else if (kind === 'jacklantern') {
      shadow(c, 0, 0, 13, 4); [-7, 0, 7].forEach(function (d) { ell(c, d, -11, 8, 11); fs(c, '#ff8a1f', OL, 2.5); }); rr(c, -2, -25, 4, 6, 1); fs(c, '#3e7a2e', OL, 2);
      c.fillStyle = 'rgba(255,230,90,' + (0.75 + 0.25 * Math.sin(t * 9 + x)) + ')'; c.shadowColor = '#ffd166'; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(-7, -15); c.lineTo(-3, -15); c.lineTo(-5, -19); c.fill(); c.beginPath(); c.moveTo(3, -15); c.lineTo(7, -15); c.lineTo(5, -19); c.fill();
      c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, -8); c.lineTo(6, -4); c.lineTo(3, -6); c.lineTo(0, -3); c.lineTo(-3, -6); c.lineTo(-6, -4); c.closePath(); c.fill(); c.shadowBlur = 0;
    } else if (kind === 'spiderweb') {
      rr(c, -1.5, -40, 3, 40, 1); fs(c, '#5a4632', OL, 1.5); c.strokeStyle = 'rgba(240,240,255,.85)'; c.lineWidth = 1.2;
      for (var sw = 0; sw < 8; sw++) { var sa = sw * Math.PI / 4; c.beginPath(); c.moveTo(0, -40); c.lineTo(Math.cos(sa) * 16, -40 + Math.sin(sa) * 16); c.stroke(); }
      for (var sr = 5; sr <= 15; sr += 5) { c.beginPath(); for (var sw2 = 0; sw2 <= 8; sw2++) { var sb = sw2 * Math.PI / 4; c.lineTo(Math.cos(sb) * sr, -40 + Math.sin(sb) * sr); } c.stroke(); }
      var spy = -40 + 14 + Math.sin(t * 1.5) * 6; c.beginPath(); c.moveTo(0, -40); c.lineTo(0, spy); c.stroke(); circ(c, 0, spy, 3.5); c.fillStyle = '#1b1636'; c.fill();
    } else if (kind === 'scarecrow') {
      shadow(c, 0, 0, 10, 3); rr(c, -2, -44, 4, 44, 1); fs(c, '#7a5a35', OL, 2); rr(c, -18, -34, 36, 4, 1); fs(c, '#7a5a35', OL, 2);
      rr(c, -10, -36, 20, 22, 4); fs(c, '#4a7fd4', OL, 2.5); c.fillStyle = '#e8c35a'; [-15, 15].forEach(function (d) { c.beginPath(); c.moveTo(d, -34); c.lineTo(d + (d > 0 ? 6 : -6), -30); c.lineTo(d, -30); c.fill(); });
      circ(c, 0, -44, 8); fs(c, '#f1d48b', OL, 2.5); c.fillStyle = OL; circ(c, -3, -45, 1.3); c.fill(); circ(c, 3, -45, 1.3); c.fill();
      c.beginPath(); c.moveTo(-13, -49); c.lineTo(13, -49); c.lineTo(5, -52); c.lineTo(4, -60); c.lineTo(-4, -60); c.lineTo(-5, -52); c.closePath(); fs(c, '#8b5a2b', OL, 2);
    } else if (kind === 'leafpile') {
      shadow(c, 0, 0, 16, 4); var lcs = ['#ff7a1a', '#e0a400', '#d62839', '#b5651d'];
      for (var lf = 0; lf < 14; lf++) { var lx = Math.sin(lf * 2.3) * 12, ly = -4 - (lf % 4) * 3 - Math.abs(Math.cos(lf * 1.7)) * 4; ell(c, lx, ly, 5, 3); fs(c, lcs[lf % 4], OL, 1.5); }
    } else if (kind === 'heartballoon') {
      var hb = Math.sin(t * 2 + x) * 3; c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(4, -14, 0, -26 + hb); c.stroke();
      c.beginPath(); var hy = -36 + hb; c.moveTo(0, hy + 10); c.bezierCurveTo(-16, hy - 2, -8, hy - 14, 0, hy - 5); c.bezierCurveTo(8, hy - 14, 16, hy - 2, 0, hy + 10); fs(c, '#ff3d6e', OL, 2.5);
      c.fillStyle = 'rgba(255,255,255,.6)'; ell(c, -5, hy - 5, 2.5, 1.5); c.fill();
    } else if (kind === 'rosebush') {
      shadow(c, 0, 0, 15, 5); [[-8, -10, 10], [7, -9, 10], [0, -17, 11]].forEach(function (b) { circ(c, b[0], b[1], b[2]); fs(c, '#2e8b3a', OL, 2.5); });
      [[-9, -13], [6, -11], [0, -21], [-2, -8], [10, -17]].forEach(function (r) { circ(c, r[0], r[1], 3.5); fs(c, '#e8174a', OL, 1.5); c.fillStyle = '#ff6b8a'; circ(c, r[0] - 1, r[1] - 1, 1.2); c.fill(); });
    } else if (kind === 'loveletter') {
      shadow(c, 0, 0, 10, 3); rr(c, -1.5, -22, 3, 22, 1); fs(c, '#8b5a2b', OL, 1.5); rr(c, -12, -36, 24, 16, 2); fs(c, '#fff4f7', OL, 2.5);
      c.strokeStyle = OL; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-12, -36); c.lineTo(0, -27); c.lineTo(12, -36); c.stroke();
      c.beginPath(); c.moveTo(0, -24); c.bezierCurveTo(-6, -28, -3, -33, 0, -30); c.bezierCurveTo(3, -33, 6, -28, 0, -24); c.fillStyle = '#ff3d6e'; c.fill();
    } else if (kind === 'egg') {
      shadow(c, 0, 0, 10, 3); var ec = ['#ffb7d5', '#b5f5cf', '#c8b6ff', '#fff27a'][Math.abs(Math.round(x / 40)) % 4];
      ell(c, 0, -13, 10, 13); fs(c, ec, OL, 2.5); c.save(); ell(c, 0, -13, 9, 12); c.clip();
      c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(-10, -16, 20, 3); c.fillStyle = '#ff6ec7'; for (var ed = -8; ed <= 8; ed += 4) { circ(c, ed, -9, 1.5); c.fill(); } c.restore();
    } else if (kind === 'flowerbed') {
      shadow(c, 0, 0, 15, 4); rr(c, -15, -6, 30, 7, 3); fs(c, '#7a4a28', OL, 2);
      var tc = ['#ff4b5c', '#ffd166', '#ff6ec7', '#9b6bff', '#ff8a3d'];
      for (var tl = 0; tl < 5; tl++) { var tx2 = -12 + tl * 6, th = 14 + (tl % 2) * 4 + Math.sin(t * 2 + tl) * 1; c.strokeStyle = '#2e8b3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(tx2, -6); c.lineTo(tx2, -6 - th); c.stroke();
        c.beginPath(); c.moveTo(tx2 - 3, -6 - th); c.lineTo(tx2 - 3, -11 - th); c.lineTo(tx2 - 1, -9 - th); c.lineTo(tx2, -12 - th); c.lineTo(tx2 + 1, -9 - th); c.lineTo(tx2 + 3, -11 - th); c.lineTo(tx2 + 3, -6 - th); c.closePath(); fs(c, tc[tl], OL, 1.5); }
    } else if (kind === 'bunnyprop') {
      shadow(c, 0, 0, 11, 4); ell(c, 0, -10, 11, 10); fs(c, '#f4f2ff', OL, 2.5); circ(c, 0, -24, 8); fs(c, '#f4f2ff', OL, 2.5);
      [-4, 4].forEach(function (d) { ell(c, d, -38, 3, 9); fs(c, '#f4f2ff', OL, 2); ell(c, d, -38, 1.5, 6); c.fillStyle = '#ffb7d5'; c.fill(); });
      c.fillStyle = OL; circ(c, -3, -25, 1.3); c.fill(); circ(c, 3, -25, 1.3); c.fill(); c.fillStyle = '#ff8fbd'; circ(c, 0, -22, 1.4); c.fill();
    } else if (kind === 'firework') {
      shadow(c, 0, 0, 8, 3); rr(c, -1, -10, 2, 10, 1); fs(c, '#8b5a2b', OL, 1); rr(c, -5, -30, 10, 20, 2); fs(c, '#d62839', OL, 2); c.fillStyle = '#fff'; c.fillRect(-5, -23, 10, 3);
      c.beginPath(); c.moveTo(-6, -30); c.lineTo(0, -40); c.lineTo(6, -30); c.closePath(); fs(c, '#3a6dff', OL, 2);
      var fp = (t * 0.7 + x * 0.01) % 1; if (fp < 0.45) { var fr = fp * 70, fcs = ['#ff4b5c', '#fff', '#3fa9ff', '#ffd166']; for (var fk = 0; fk < 10; fk++) { var fa = fk * Math.PI / 5; c.globalAlpha = 1 - fp / 0.45; circ(c, Math.cos(fa) * fr, -78 + Math.sin(fa) * fr, 2.5); c.fillStyle = fcs[fk % 4]; c.fill(); } c.globalAlpha = 1; }
    } else if (kind === 'balloons') {
      [['#ff4b5c', -8, -40], ['#ffd166', 6, -44], ['#3fa9ff', 0, -52], ['#2bd576', 10, -34]].forEach(function (b, i) { var bb = Math.sin(t * 2 + i) * 2; c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(b[1], b[2] + 9 + bb); c.stroke(); ell(c, b[1], b[2] + bb, 7, 9); fs(c, b[0], OL, 2); c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, b[1] - 2.5, b[2] - 3 + bb, 2, 1.3); c.fill(); });
      shadow(c, 0, 0, 5, 2);
    } else if (kind === 'potofgold') {
      shadow(c, 0, 0, 14, 4); for (var pg = 0; pg < 9; pg++) { circ(c, -9 + (pg % 5) * 4.5, -17 - Math.floor(pg / 5) * 3, 3.5); fs(c, '#ffd166', '#b8860b', 1.5); }
      ell(c, 0, -9, 13, 10); fs(c, '#2a2a3a', OL, 2.5); ell(c, 0, -16, 13, 3.5); fs(c, '#3a3a4a', OL, 2);
      if ((t * 2 + x) % 3 < 0.4) { c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('✦', 6, -24); }
    } else if (kind === 'clover') {
      shadow(c, 0, 0, 10, 3); c.strokeStyle = '#1f7a35'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(3, -10, 0, -18); c.stroke();
      [0, 1, 2, 3].forEach(function (i) { var ca = i * Math.PI / 2 + Math.sin(t * 1.5) * 0.1; c.save(); c.translate(0, -22); c.rotate(ca); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-9, -4, -7, -13, 0, -8); c.bezierCurveTo(7, -13, 9, -4, 0, 0); fs(c, '#2bd576', OL, 2); c.restore(); });
    } else if (kind === 'beachball') {
      var bbz = Math.abs(Math.sin(t * 3 + x)) * 4; shadow(c, 0, 0, 9 - bbz * 0.5, 3); c.save(); c.translate(0, -10 - bbz); c.rotate(t);
      ['#ff4b5c', '#fff', '#3fa9ff', '#fff', '#ffd166', '#fff'].forEach(function (col, i) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 10, i * Math.PI / 3, (i + 1) * Math.PI / 3); c.closePath(); c.fillStyle = col; c.fill(); });
      circ(c, 0, 0, 10); c.strokeStyle = OL; c.lineWidth = 2.5; c.stroke(); c.restore();
    } else if (kind === 'umbrella') {
      shadow(c, 0, 0, 20, 6); rr(c, -1.5, -50, 3, 50, 1); fs(c, '#ddd', OL, 1.5);
      for (var ui = 0; ui < 6; ui++) { c.beginPath(); c.moveTo(0, -56); c.lineTo(-24 + ui * 8, -40); c.lineTo(-16 + ui * 8, -40); c.closePath(); c.fillStyle = ui % 2 ? '#fff' : '#ff4b5c'; c.fill(); }
      c.beginPath(); c.moveTo(0, -56); c.lineTo(-24, -40); c.lineTo(24, -40); c.closePath(); c.strokeStyle = OL; c.lineWidth = 2.5; c.stroke();
    } else if (kind === 'sandcastle') {
      shadow(c, 0, 0, 17, 5); var sc2 = '#f2cf86';
      rr(c, -15, -16, 30, 16, 2); fs(c, sc2, OL, 2.5); [-15, 7].forEach(function (d) { rr(c, d, -26, 8, 12, 1); fs(c, sc2, OL, 2.5); }); rr(c, -5, -32, 10, 16, 1); fs(c, sc2, OL, 2.5);
      c.fillStyle = '#a07a3a'; rr(c, -3, -8, 6, 8, 2); c.fill(); c.strokeStyle = OL; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -32); c.lineTo(0, -42); c.stroke(); c.beginPath(); c.moveTo(0, -42); c.lineTo(8, -39); c.lineTo(0, -36); c.fillStyle = '#ff4b5c'; c.fill();
    } else if (kind === 'turkey') {
      shadow(c, 0, 0, 13, 4); var fcs2 = ['#d62839', '#ff8a3d', '#e0a400', '#8b5a2b'];
      for (var tf = 0; tf < 7; tf++) { var ta = Math.PI + 0.25 + tf * 0.45 + Math.sin(t * 2) * 0.03; ell(c, Math.cos(ta) * 13, -16 + Math.sin(ta) * 13, 5, 8); fs(c, fcs2[tf % 4], OL, 1.5); }
      ell(c, 0, -10, 9, 10); fs(c, '#8b5a2b', OL, 2.5); circ(c, 0, -22, 6); fs(c, '#a0703a', OL, 2); c.fillStyle = '#ffb000'; c.beginPath(); c.moveTo(-2, -21); c.lineTo(2, -21); c.lineTo(0, -18); c.fill();
      c.fillStyle = '#d62839'; ell(c, 2, -17, 1.5, 3); c.fill(); c.fillStyle = OL; circ(c, -2, -24, 1.1); c.fill(); circ(c, 2, -24, 1.1); c.fill();
    } else if (kind === 'cornstalk') {
      shadow(c, 0, 0, 12, 3); c.lineCap = 'round';
      [-6, 0, 6].forEach(function (d, i) { c.strokeStyle = OL; c.lineWidth = 6; c.beginPath(); c.moveTo(d, 0); c.lineTo(d * 1.6, -46 - i * 3); c.stroke(); c.strokeStyle = '#d9b860'; c.lineWidth = 3.5; c.stroke(); });
      [[-10, -26], [9, -30]].forEach(function (k2) { ell(c, k2[0], k2[1], 3.5, 7); fs(c, '#ffd166', OL, 1.5); });
    } else if (kind === 'tnt') {
      shadow(c, 0, 0, 18, 6);
      rr(c, -17, -34, 34, 34, 4); fs(c, '#e63946', OL, 3);
      c.fillStyle = '#f8f9fa'; c.fillRect(-16, -21, 32, 10);
      c.fillStyle = OL; c.font = '700 10px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TNT', 0, -15.5);
    }
    c.restore();
  };

  // ------------------------------------------------------------------ TNT Spleef floors
  var SPC = {
    snow: { top: '#f4f9ff', alt: '#e8f2ff', side: '#9fb8d8', dark: '#6f89b0', speck: 'rgba(150,190,240,.45)' },
    sand: { top: '#f7dc8a', alt: '#f0d27a', side: '#c9a24b', dark: '#9a7a32', speck: 'rgba(170,130,50,.4)' },
    clay: { top: '#e9a07a', alt: '#e2956d', side: '#b86b48', dark: '#8a4c31', speck: 'rgba(120,60,40,.35)' },
    tnt: { top: '#ef4b55', alt: '#e63946', side: '#a8192b', dark: '#6e0f1b', speck: 'rgba(255,255,255,.45)' },
  };
  D.SPC = SPC;
  // Paint one floor tile into a layer canvas (ox/oy = canvas origin in world px).
  D.spTile = function (c, kind, x, y, i, southOpen) {
    var P = SPC[kind] || SPC.snow, tx = (x / T) | 0, ty = (y / T) | 0;
    if (southOpen) {
      var g = c.createLinearGradient(0, y + T, 0, y + T + 16); g.addColorStop(0, P.side); g.addColorStop(1, P.dark);
      c.fillStyle = g; c.fillRect(x, y + T, T, 16);
      c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x, y + T + 12, T, 4);
    }
    c.fillStyle = ((tx + ty) & 1) ? P.alt : P.top; c.fillRect(x, y, T, T);
    if (kind === 'tnt') {
      c.fillStyle = '#f8f9fa'; c.fillRect(x, y + 14, T, 12);
      c.fillStyle = OL; c.font = '700 9px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('TNT', x + T / 2, y + 20.5);
    } else {
      c.fillStyle = P.speck; for (var k = 0; k < 4; k++) { c.fillRect(x + 4 + hash(i * 7 + k) * 30, y + 4 + hash(i * 13 + k) * 30, 3, 3); }
    }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 2, y + 2, T - 4, 3);
    c.strokeStyle = 'rgba(27,22,54,.5)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, T - 2, T - 2 + (southOpen ? 16 : 0));
  };

  // ------------------------------------------------------------------ CTF: flag on a player's back, flag stands, pickups
  D.flagBack = function (c, team, t, moving) {
    var tc = teamCol(team);
    c.save(); c.translate(-12, -30);
    rr(c, -1.5, -40, 3, 44, 1.5); fs(c, '#d9dce6', OL, 2);
    c.beginPath(); c.moveTo(1, -38);
    var wave = moving ? 9 : 4;
    for (var k = 0; k <= 8; k++) { var u = k / 8; c.lineTo(1 + u * 24, -38 + Math.sin(t * wave - u * 4) * 2.5 * u); }
    for (k = 8; k >= 0; k--) { u = k / 8; c.lineTo(1 + u * 24, -22 + Math.sin(t * wave - u * 4) * 2.5 * u); }
    c.closePath(); fs(c, tc, OL, 2);
    c.restore();
  };
  D.flagStand = function (c, x, y, team, t, home) {
    var tc = teamCol(team);
    c.save();
    c.globalCompositeOperation = 'lighter';
    var p = (Math.sin(t * 3) + 1) / 2, g = c.createRadialGradient(x, y, 4, x, y, 52);
    g.addColorStop(0, hexA(tc, 0.35)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; circ(c, x, y, 52); c.fill();
    c.restore();
    ell(c, x, y + 2, 26, 10); fs(c, '#58617a', OL, 3);
    ell(c, x, y, 20, 7); fs(c, tc, null);
    c.strokeStyle = 'rgba(255,255,255,' + (0.3 + p * 0.4) + ')'; c.lineWidth = 2; c.setLineDash([6, 6]); c.lineDashOffset = -t * 20; ell(c, x, y, 30, 12); c.stroke(); c.setLineDash([]);
    if (!home) { c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', x, y); }
  };
  D.pickup = function (c, item, x, y, t) {
    var b = Math.sin(t * 3 + x) * 4;
    c.save(); c.globalCompositeOperation = 'lighter';
    var g = c.createRadialGradient(x, y - 20, 2, x, y - 20, 34); g.addColorStop(0, 'rgba(255,240,180,.45)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = g; circ(c, x, y - 20, 34); c.fill(); c.restore();
    shadow(c, x, y + 2, 14 - b * 0.5, 5);
    c.strokeStyle = 'rgba(255,209,102,.7)'; c.lineWidth = 2; ell(c, x, y, 18, 7); c.stroke();
    c.save(); c.translate(x, y - 24 + b); c.rotate(Math.sin(t * 2) * 0.2); D.drawItem(c, item === 'arrows' ? 'arrows' : item, 0.9, { team: 0, tier: 1 }); c.restore();
  };
  D.pad = function (c, x, y, t, col) { // pickup pad under the item
    ell(c, x, y + 2, 22, 9); fs(c, '#4a5266', OL, 2.5); ell(c, x, y, 16, 6); c.fillStyle = col || 'rgba(255,209,102,.4)'; c.fill();
  };

  // ------------------------------------------------------------------ new item icons
  var oldItem = D.drawItem;
  D.drawItem = function (c, id, s, o) {
    s = s || 1; o = o || {};
    if (id === 'shovel') {
      c.save(); c.rotate(0.6); c.scale(s, s);
      rr(c, -1.8, -6, 3.6, 22, 1.5); fs(c, '#8a5a34', OL, 2);
      c.beginPath(); c.moveTo(-7, -6); c.lineTo(7, -6); c.lineTo(6, -18); c.quadraticCurveTo(0, -26, -6, -18); c.closePath(); fs(c, '#cfd6e4', OL, 2.2);
      c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-3, -18, 2, 9);
      c.restore(); return;
    }
    if (id === 'snow') { c.save(); c.scale(s, s); circ(c, 0, 0, 10); fs(c, '#f4f9ff', OL, 2.2); c.fillStyle = 'rgba(150,190,240,.6)'; circ(c, 3, 3, 4); c.fill(); c.fillStyle = '#fff'; circ(c, -3, -3, 2.5); c.fill(); c.restore(); return; }
    if (id === 'mask') {
      c.save(); c.scale(s, s);
      c.beginPath(); c.moveTo(-13, -6); c.quadraticCurveTo(0, -12, 13, -6); c.quadraticCurveTo(14, 8, 0, 11); c.quadraticCurveTo(-14, 8, -13, -6); c.closePath(); fs(c, '#9b6bff', OL, 2.2);
      c.fillStyle = OL; ell(c, -5.5, -1, 3.6, 2.6); c.fill(); ell(c, 5.5, -1, 3.6, 2.6); c.fill();
      c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.beginPath(); c.arc(0, 3, 4, 0.3, Math.PI - 0.3); c.stroke();
      c.restore(); return;
    }
    if (id === 'taunt') {
      c.save(); c.scale(s, s);
      c.strokeStyle = OL; c.lineWidth = 5; c.beginPath(); c.moveTo(-4, 6); c.lineTo(-4, -12); c.lineTo(8, -15); c.lineTo(8, 3); c.stroke();
      c.strokeStyle = '#ffd166'; c.lineWidth = 2.6; c.stroke();
      ell(c, -7, 7, 5, 4); fs(c, '#ffd166', OL, 2); ell(c, 5, 4, 5, 4); fs(c, '#ffd166', OL, 2);
      c.restore(); return;
    }
    if (id === 'radar') {
      c.save(); c.scale(s, s);
      circ(c, 0, 0, 12); fs(c, '#0f3d2e', OL, 2.2);
      c.strokeStyle = 'rgba(43,213,118,.6)'; c.lineWidth = 1.4; circ(c, 0, 0, 7); c.stroke(); circ(c, 0, 0, 3); c.stroke();
      c.strokeStyle = '#2bd576'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(9, -6); c.stroke();
      circ(c, -4, 5, 2); c.fillStyle = '#ff5c6c'; c.fill();
      c.restore(); return;
    }
    if (id === 'fists') return;
    if (id === 'knife') {
      c.save(); c.rotate(0.5); c.scale(s, s);
      rr(c, -2.2, 2, 4.4, 9, 2); fs(c, '#3a2a18', OL, 2);
      c.beginPath(); c.moveTo(-3, 2); c.lineTo(3, 2); c.lineTo(2, -14); c.quadraticCurveTo(0, -19, -1.5, -14); c.closePath(); fs(c, '#e8edf5', OL, 2);
      c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(-0.5, -13, 1.4, 12);
      rr(c, -4.5, 0.4, 9, 2.6, 1.3); fs(c, '#8a93a6', OL, 1.6);
      c.restore(); return;
    }
    if (id === 'goldI') {
      c.save(); c.scale(s, s);
      c.beginPath(); c.moveTo(-11, 6); c.lineTo(-7, -4); c.lineTo(7, -4); c.lineTo(11, 6); c.closePath(); fs(c, '#ffd23f', OL, 2.2);
      c.fillStyle = '#fff3b0'; c.beginPath(); c.moveTo(-7, -4); c.lineTo(7, -4); c.lineTo(5, -1); c.lineTo(-5, -1); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,.8)'; circ(c, -4, 0, 1.6); c.fill();
      c.restore(); return;
    }
    if (id === 'flag') { c.save(); c.scale(s, s); rr(c, -9, -14, 3, 28, 1.5); fs(c, '#d9dce6', OL, 1.8); c.beginPath(); c.moveTo(-6, -13); c.lineTo(12, -8); c.lineTo(-6, -2); c.closePath(); fs(c, teamCol(o.team || 0), OL, 2); c.restore(); return; }
    return oldItem(c, id, s, o);
  };
  D.snowball = function (c, x, y, t) { c.save(); c.translate(x, y); c.fillStyle = 'rgba(10,6,30,.22)'; ell(c, 0, 18, 7, 3); c.fill(); c.rotate(t * 8); D.drawItem(c, 'snow', 0.55); c.restore(); };
})();
