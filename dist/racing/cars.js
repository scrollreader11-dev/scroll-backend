/* Scroll Racing car models. Original vector art, drawn top-down facing right (+x).
   SRCars.sprite(model, color) returns a cached canvas; SRCars.MODELS lists the models. */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  // Shop paint can be a special finish ('m:gold'); map those to a plain colour so gradients never get an invalid stop.
  var FINISH = { 'm:gold': '#f5c542', 'm:chrome': '#c9d3e6', 'm:lava': '#ff5a1f', 'm:galaxy': '#6d3bd6', 'm:rainbow': '#ff4fa3' };
  function safe(c) { c = String(c == null ? '' : c); if (FINISH[c]) return FINISH[c]; return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : '#3fa9ff'; }
  function hex(c) { c = String(c || '#3fa9ff').replace('#', ''); if (c.length === 3) c = c.replace(/(.)/g, '$1$1'); var n = parseInt(c, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(c, t, a) { var h = hex(c), r = t < 0 ? 0 : 255, k = Math.abs(t); return 'rgb(' + Math.round(h[0] + (r - h[0]) * k) + ',' + Math.round(h[1] + (r - h[1]) * k) + ',' + Math.round(h[2] + (r - h[2]) * k) + ')'; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
  function wheel(g, cx, cy, w, h, knob) {
    g.fillStyle = '#0d0f15'; rr(g, cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * 0.32); g.fill();
    g.fillStyle = '#2a2f3d'; rr(g, cx - w / 2 + 1.5, cy - h / 2 + 1, w - 3, 2.2, 1); g.fill();
    g.fillStyle = '#b8c0d4'; rr(g, cx - w * 0.2, cy - h * 0.27, w * 0.4, h * 0.54, 2); g.fill();
    if (knob) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; for (var i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + i * w * 0.28, cy - h / 2 + 1); g.lineTo(cx + i * w * 0.28, cy + h / 2 - 1); g.stroke(); } }
  }
  function lights(g, front, rear, w) { g.save(); g.shadowColor = '#fff6c4'; g.shadowBlur = 6; g.fillStyle = '#fff6c4'; [-1, 1].forEach(function (s) { rr(g, front - 4, s * w * 0.3 - 2.5, 4.5, 5, 2); g.fill(); }); g.shadowColor = '#ff2d2d'; g.shadowBlur = 6; g.fillStyle = '#ff3b3b'; [-1, 1].forEach(function (s) { rr(g, rear - 0.5, s * w * 0.32 - 2.2, 3.4, 4.4, 1.5); g.fill(); }); g.restore(); }
  function bodyFill(g, color, x, y, w, h, r) {
    var gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, mix(color, 0.35)); gr.addColorStop(0.45, color); gr.addColorStop(1, mix(color, -0.38));
    g.fillStyle = gr; rr(g, x, y, w, h, r); g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.6; g.stroke();
  }
  function seat(g, x, w, h) { g.fillStyle = '#10131c'; rr(g, x - w / 2, -h / 2, w, h, 4); g.fill(); g.fillStyle = '#242a3a'; rr(g, x - w / 2 - 3, -h / 2 + 1, 5, h - 2, 2); g.fill(); }
  function wheelWheel(g, x) { g.strokeStyle = '#111'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, 0, 3.6, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x, -3.6); g.lineTo(x, 3.6); g.stroke(); }

  var M = {
    kart: { name: 'Kart', L: 58, W: 40, seatX: -4, draw: function (g, c, a) {
      wheel(g, -17, -17, 15, 9, true); wheel(g, -17, 17, 15, 9, true); wheel(g, 15, -15.5, 11, 7); wheel(g, 15, 15.5, 11, 7);
      g.fillStyle = '#2b3042'; g.fillRect(-22, -2, 40, 4);
      bodyFill(g, c, -24, -11.5, 30, 23, 8); bodyFill(g, c, 2, -8, 26, 16, 7);
      g.fillStyle = mix(c, -0.55); rr(g, -26, -13, 7, 26, 3); g.fill(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.3; g.stroke();
      g.fillStyle = a; rr(g, 8, -2, 14, 4, 1.5); g.fill();
      bodyFill(g, '#d7ddee', 27, -12, 7, 24, 3);
      seat(g, -9, 11, 15); wheelWheel(g, 7); lights(g, 27, -24, 24);
    } },
    roadster: { name: 'Roadster', L: 76, W: 38, seatX: -6, draw: function (g, c, a) {
      wheel(g, -23, -16.5, 15, 8); wheel(g, -23, 16.5, 15, 8); wheel(g, 22, -16.5, 15, 8); wheel(g, 22, 16.5, 15, 8);
      bodyFill(g, c, -36, -15, 72, 30, 12);
      g.fillStyle = 'rgba(255,255,255,.2)'; rr(g, -28, -12.5, 52, 5, 2.5); g.fill();
      g.fillStyle = '#0c0f18'; rr(g, -22, -9, 22, 18, 6); g.fill(); seat(g, -9, 10, 13);
      g.fillStyle = 'rgba(160,215,255,.75)'; g.beginPath(); g.moveTo(0, -11); g.lineTo(5, -9); g.lineTo(5, 9); g.lineTo(0, 11); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = a; g.fillRect(8, -1.6, 26, 3.2); g.fillStyle = mix(c, -0.3); rr(g, 12, -6, 12, 12, 4); g.fill();
      g.fillStyle = '#10131c'; [-1, 1].forEach(function (s) { rr(g, -1, s * 16.5 - 2, 6, 4, 2); g.fill(); });
      wheelWheel(g, -1); lights(g, 35, -36, 30);
    } },
    buggy: { name: 'Buggy', L: 66, W: 46, seatX: -4, draw: function (g, c, a) {
      wheel(g, -19, -19.5, 17, 11, true); wheel(g, -19, 19.5, 17, 11, true); wheel(g, 20, -19, 15, 10, true); wheel(g, 20, 19, 15, 10, true);
      g.strokeStyle = '#cfd6e6'; g.lineWidth = 2.6; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-26, -14); g.lineTo(-8, -13); g.lineTo(6, -9); g.lineTo(26, -9); g.moveTo(-26, 14); g.lineTo(-8, 13); g.lineTo(6, 9); g.lineTo(26, 9); g.moveTo(-8, -13); g.lineTo(-8, 13); g.stroke();
      bodyFill(g, c, -27, -12, 40, 24, 8); bodyFill(g, c, 12, -9, 20, 18, 7);
      g.fillStyle = '#10131c'; rr(g, -20, -8, 15, 16, 5); g.fill(); seat(g, -12, 9, 12);
      g.fillStyle = a; g.fillRect(14, -1.5, 16, 3); g.fillStyle = '#2b3042'; rr(g, -31, -10, 5, 20, 2); g.fill();
      g.strokeStyle = '#e8ecf8'; g.lineWidth = 3; g.beginPath(); g.moveTo(33, -13); g.lineTo(36, -13); g.lineTo(36, 13); g.lineTo(33, 13); g.stroke();
      wheelWheel(g, 2); lights(g, 31, -27, 26);
    } },
    muscle: { name: 'Muscle', L: 80, W: 40, seatX: -2, draw: function (g, c, a) {
      wheel(g, -25, -18, 16, 8.5); wheel(g, -25, 18, 16, 8.5); wheel(g, 24, -18, 16, 8.5); wheel(g, 24, 18, 16, 8.5);
      bodyFill(g, c, -39, -16.5, 78, 33, 11);
      g.fillStyle = a; g.fillRect(-38, -5, 76, 3.2); g.fillRect(-38, 1.8, 76, 3.2);
      g.fillStyle = '#10131c'; rr(g, 10, -7, 15, 14, 4); g.fill(); g.fillStyle = 'rgba(255,255,255,.14)'; rr(g, 12, -5.5, 10, 3, 1.5); g.fill();
      g.fillStyle = '#0c0f18'; rr(g, -21, -10.5, 24, 21, 6); g.fill(); seat(g, -9, 10, 14);
      g.fillStyle = 'rgba(160,215,255,.75)'; g.beginPath(); g.moveTo(3, -12); g.lineTo(9, -10); g.lineTo(9, 10); g.lineTo(3, 12); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#0d0f15'; rr(g, -42, -13, 5, 26, 2); g.fill();
      g.fillStyle = '#8b93a8'; [-1, 1].forEach(function (s) { rr(g, -41, s * 8 - 1.6, 4, 3.2, 1.4); g.fill(); });
      wheelWheel(g, 1); lights(g, 38, -39, 32);
    } },
    formula: { name: 'Formula', L: 84, W: 44, seatX: -6, draw: function (g, c, a) {
      wheel(g, -27, -18, 17, 11); wheel(g, -27, 18, 17, 11); wheel(g, 25, -17, 14, 9); wheel(g, 25, 17, 14, 9);
      g.fillStyle = '#2b3042'; g.fillRect(-27, -2, 52, 4);
      bodyFill(g, '#e8ecf8', 34, -20, 8, 40, 3); g.fillStyle = a; g.fillRect(36, -20, 3, 40);
      bodyFill(g, c, -30, -9, 44, 18, 8); bodyFill(g, c, 12, -5.5, 26, 11, 5);
      g.fillStyle = a; g.fillRect(-22, -1.6, 34, 3.2);
      bodyFill(g, '#e8ecf8', -42, -18, 9, 36, 3); g.fillStyle = a; g.fillRect(-40, -18, 3, 36);
      g.fillStyle = '#10131c'; rr(g, -18, -6, 14, 12, 5); g.fill(); seat(g, -12, 9, 11);
      g.fillStyle = mix(c, -0.3); rr(g, -8, -4, 12, 8, 4); g.fill();
      wheelWheel(g, 2); lights(g, 40, -33, 26);
    } },
    jeep: { name: 'Jeep', L: 70, W: 42, seatX: -2, draw: function (g, c, a) {
      wheel(g, -20, -19, 16, 10, true); wheel(g, -20, 19, 16, 10, true); wheel(g, 21, -19, 16, 10, true); wheel(g, 21, 19, 16, 10, true);
      bodyFill(g, c, -32, -16, 64, 32, 7);
      g.fillStyle = '#10131c'; rr(g, -26, -11, 32, 22, 5); g.fill(); seat(g, -12, 9, 13); seat(g, -1, 9, 13);
      g.fillStyle = mix(c, -0.25); rr(g, 8, -12, 20, 24, 5); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#10131c'; g.beginPath(); g.arc(-35, 0, 8, 0, TAU); g.fill(); g.fillStyle = '#2a2f3d'; g.beginPath(); g.arc(-35, 0, 4, 0, TAU); g.fill();
      g.strokeStyle = '#e8ecf8'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-6, -15); g.lineTo(-6, 15); g.moveTo(-28, -15); g.lineTo(-28, 15); g.stroke();
      g.fillStyle = a; g.fillRect(10, -2, 16, 4); g.fillStyle = '#9aa3ba'; rr(g, 30, -14, 5, 28, 2); g.fill();
      wheelWheel(g, 4); lights(g, 30, -32, 31);
    } }
  };
  var ORDER = ['kart', 'roadster', 'buggy', 'muscle', 'formula', 'jeep'], cache = {};
  function sprite(model, color, accent) {
    color = safe(color); accent = safe(accent || '#ffffff'); var m = M[model] || M.kart, key = model + color + accent; if (cache[key]) return cache[key];
    var c = document.createElement('canvas'); c.width = 224; c.height = 144; var g = c.getContext('2d'); g.scale(2, 2); g.translate(56, 36); g.lineJoin = 'round'; g.lineCap = 'round';
    m.draw(g, color, accent || '#ffffff'); return cache[key] = c;
  }
  window.SRCars = { MODELS: ORDER.map(function (k) { return { id: k, name: M[k].name, seatX: M[k].seatX, L: M[k].L, W: M[k].W }; }), sprite: sprite, dims: { w: 112, h: 72 } };
})();
