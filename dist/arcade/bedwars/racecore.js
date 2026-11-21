/* Scroll Racing track geometry shared by the Bedwars-engine race server (Node) and the racing client.
   Same centerlines as dist/racing/racing.js. No drawing code here. */
(function (root) {
  'use strict';
  var HALF = 105, STEP = 20, MAXSP = 470, WALL = 215;
  var DEFS = {
    meadow: [[0, 0], [900, -120], [1900, -80], [2600, 300], [2750, 950], [2300, 1450], [1500, 1550], [950, 1150], [350, 1300], [-350, 1050], [-650, 450], [-450, -250]],
    dune: [[0, 0], [800, -260], [1650, 0], [2300, -420], [3000, -200], [3200, 500], [2650, 950], [1950, 750], [1550, 1250], [1950, 1900], [1200, 2200], [350, 1900], [-150, 1200], [-550, 550]],
    frost: [[0, 0], [750, -350], [1500, -120], [1850, 550], [1400, 950], [1950, 1400], [2700, 1200], [3100, 1850], [2450, 2400], [1600, 2150], [850, 2500], [-150, 2150], [-400, 1400], [250, 950], [-400, 500]],
    neon: [[0, 0], [1000, 40], [2000, -220], [2900, 150], [3050, 900], [2500, 1250], [2950, 1800], [2250, 2350], [1400, 2100], [1000, 1550], [300, 1800], [-450, 1500], [-700, 750], [-350, 200]]
  };
  var NAMES = { meadow: 'Meadow Loop', dune: 'Dune Dash', frost: 'Frost Circuit', neon: 'Neon Night' };
  function catmull(P, t) {
    var n = P.length, i = Math.floor(t), f = t - i, p0 = P[(i - 1 + n) % n], p1 = P[i % n], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n], f2 = f * f, f3 = f2 * f;
    function c(a, b, cc, d) { return 0.5 * ((2 * b) + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f2 + (-a + 3 * b - 3 * cc + d) * f3); }
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
  }
  var cache = {};
  function build(id) {
    if (cache[id]) return cache[id];
    var P = DEFS[id], dense = [], i, s, j = 0;
    for (i = 0; i < P.length; i++) for (s = 0; s < 60; s++) dense.push(catmull(P, i + s / 60));
    var cum = [0]; for (i = 1; i <= dense.length; i++) { var a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    var L = cum[cum.length - 1], N = Math.round(L / STEP), T = { id: id, N: N, L: L, x: new Float32Array(N), y: new Float32Array(N), tx: new Float32Array(N), ty: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N), curv: new Float32Array(N) };
    for (i = 0; i < N; i++) { var d = i * L / N; while (cum[j + 1] < d) j++; var a2 = dense[j], b2 = dense[(j + 1) % dense.length], f = (d - cum[j]) / (cum[j + 1] - cum[j] || 1); T.x[i] = a2[0] + (b2[0] - a2[0]) * f; T.y[i] = a2[1] + (b2[1] - a2[1]) * f; }
    for (i = 0; i < N; i++) { var p = (i + 1) % N, q = (i - 1 + N) % N, dx = T.x[p] - T.x[q], dy = T.y[p] - T.y[q], l = Math.hypot(dx, dy) || 1; T.tx[i] = dx / l; T.ty[i] = dy / l; T.nx[i] = -T.ty[i]; T.ny[i] = T.tx[i]; }
    for (i = 0; i < N; i++) { var k = (i + 10) % N, cr = T.tx[i] * T.ty[k] - T.ty[i] * T.tx[k], dt = T.tx[i] * T.tx[k] + T.ty[i] * T.ty[k]; T.curv[i] = Math.abs(Math.atan2(cr, dt)); }
    return (cache[id] = T);
  }
  // Index of the centerline point nearest to (x, y), searching around a previous index first.
  function locate(T, x, y, near) {
    var N = T.N, best = 1e18, res = near | 0, k, i, dx, dy, d, base = res;
    for (k = -30; k <= 30; k++) { i = (base + k + N * 4) % N; dx = x - T.x[i]; dy = y - T.y[i]; d = dx * dx + dy * dy; if (d < best) { best = d; res = i; } }
    if (best > 360000) { best = 1e18; for (i = 0; i < N; i++) { dx = x - T.x[i]; dy = y - T.y[i]; d = dx * dx + dy * dy; if (d < best) { best = d; res = i; } } }
    return res;
  }
  // Grid slot (0..7) to a starting spot behind the line.
  function grid(T, slot) {
    var row = Math.floor(slot / 2), col = slot % 2, back = 70 + row * 78, idx0 = (T.N - Math.round(back / STEP) + T.N) % T.N, lat = (col ? 1 : -1) * 48;
    return { idx: idx0, lat: lat, x: T.x[idx0] + T.nx[idx0] * lat, y: T.y[idx0] + T.ny[idx0] * lat, a: Math.atan2(T.ty[idx0], T.tx[idx0]) };
  }
  root.RaceCore = { HALF: HALF, STEP: STEP, MAXSP: MAXSP, WALL: WALL, IDS: Object.keys(DEFS), NAMES: NAMES, DEFS: DEFS, build: build, locate: locate, grid: grid };
})(typeof window !== 'undefined' ? window : globalThis);
