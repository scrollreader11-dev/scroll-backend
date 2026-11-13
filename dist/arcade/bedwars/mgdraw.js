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
    if (id === 'flag') { c.save(); c.scale(s, s); rr(c, -9, -14, 3, 28, 1.5); fs(c, '#d9dce6', OL, 1.8); c.beginPath(); c.moveTo(-6, -13); c.lineTo(12, -8); c.lineTo(-6, -2); c.closePath(); fs(c, teamCol(o.team || 0), OL, 2); c.restore(); return; }
    return oldItem(c, id, s, o);
  };
  D.snowball = function (c, x, y, t) { c.save(); c.translate(x, y); c.fillStyle = 'rgba(10,6,30,.22)'; ell(c, 0, 18, 7, 3); c.fill(); c.rotate(t * 8); D.drawItem(c, 'snow', 0.55); c.restore(); };
})();
