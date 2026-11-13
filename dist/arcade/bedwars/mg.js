/* ============================================================
   ScrollHub Games — shared rules for the minigames that run on the Bedwars
   engine: Capture the Flag, TNT Spleef and Prop Hunt. Loaded after shared.js
   by the browser (window.MG) and by the server (globalThis.MG).
   ============================================================ */
(function (root) {
  var B = root.BW, T = B.T, W = B.W, H = B.H, N = W * H, G = B.G;
  var M = {};

  // Extra colors for free-for-all games (Bedwars only ever uses the first 4).
  if (B.TEAMS.length < 8) B.TEAMS.push(
    { key: 'orange', name: 'Orange', color: '#ff922b', dark: '#b4580a', light: '#ffd3a8' },
    { key: 'purple', name: 'Purple', color: '#9b6bff', dark: '#5b34b8', light: '#d9c9ff' },
    { key: 'pink', name: 'Pink', color: '#ff6ec7', dark: '#b42d82', light: '#ffc9ea' },
    { key: 'cyan', name: 'Cyan', color: '#2ee6d6', dark: '#11968b', light: '#b5fff8' });
  // new ground types
  G.COBBLE = 7; G.FLOOR = 8; G.SNOW = 9;
  // new hand items (appended so Bedwars' held-item indexes don't change)
  ['shovel', 'snow', 'mask', 'taunt', 'radar'].forEach(function (k) { if (B.HOTBAR_ORDER.indexOf(k) < 0) B.HOTBAR_ORDER.push(k); });
  B.ITEM_NAMES.shovel = 'Spleef Shovel'; B.ITEM_NAMES.snow = 'Snowball'; B.ITEM_NAMES.mask = 'Disguise'; B.ITEM_NAMES.taunt = 'Taunt'; B.ITEM_NAMES.radar = 'Hider Radar';

  M.GAMES = {
    bw: { key: 'bw', name: 'Bedwars', icon: '🛏️' },
    ctf: { key: 'ctf', name: 'Capture the Flag', short: 'CTF', icon: '🚩', teams: 2, per: 4, max: 8, caps: 3, mins: 8, respawn: 4,
      desc: 'Grab the enemy flag and bring it home', tag: 'Team 4v4' },
    spleef: { key: 'spleef', name: 'TNT Spleef', short: 'SPLEEF', icon: '❄️', teams: 8, per: 1, max: 8, mins: 4,
      desc: 'The floor falls away — be the last one standing', tag: 'Free for all' },
    hide: { key: 'hide', name: 'Prop Hunt', short: 'PROP HUNT', icon: '🎃', teams: 2, per: 8, max: 8, hideSec: 30, seekSec: 180,
      desc: 'Hide as a prop — or hunt the ones who did', tag: 'Hide & seek' },
  };
  M.isMini = function (g) { return g === 'ctf' || g === 'spleef' || g === 'hide'; };

  // Seeded random (same map on every client).
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  M.rng = rng;
  function blank() { return { W: W, H: H, g: new Uint8Array(N), f: new Uint8Array(N), fc: new Uint8Array(N), w: new Uint8Array(N), wc: new Uint8Array(N), obj: new Uint8Array(N), noBuild: new Uint8Array(N), noMine: new Uint8Array(N), beds: [], gens: [], npcs: [], bases: [], objs: [] }; }
  function fill(m, x0, y0, x1, y1, v, round) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { if (round && (x === x0 || x === x1) && (y === y0 || y === y1)) continue; m.g[y * W + x] = v; } }
  function disc(m, cx, cy, r, v) { for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) m.g[(cy + y) * W + cx + x] = v; }
  function wall(m, x, y, id, team) { var i = y * W + x; m.w[i] = id; m.wc[i] = team || 0; }
  function tcx(x) { return x * T + T / 2; }

  // ================================================================ CAPTURE THE FLAG
  // Two bases (west/east), a big middle island with cover, a fast 1-wide bridge
  // through the middle and longer, safer lanes north and south.
  M.genCTF = function () {
    var m = blank(); m.game = 'ctf';
    var bases = [{ x0: 4, x1: 17, fx: 7, sx: 13, dir: 1 }, { x0: 54, x1: 67, fx: 64, sx: 58, dir: -1 }];
    bases.forEach(function (b, t) {
      fill(m, b.x0, 28, b.x1, 44, G.GRASS, true);
      fill(m, b.x0 + 1, 27, b.x1 - 1, 45, G.GRASS, true);
      // flag plaza
      fill(m, b.fx - 2, 34, b.fx + 2, 38, G.STONE);
      fill(m, b.sx - 1, 33, b.sx + 1, 39, G.PAD);
      var base = { team: t, cx: b.sx, cy: 36, inward: [b.dir, 0], right: [0, 1], spawn: { x: tcx(b.sx), y: tcx(36) }, flagTile: 36 * W + b.fx, fx: tcx(b.fx), fy: tcx(36),
        rect: [b.x0, 27, b.x1, 45] };
      m.bases.push(base);
      for (var y = 33; y <= 39; y++) for (var x = b.sx - 1; x <= b.sx + 1; x++) m.noBuild[y * W + x] = 1;
      for (y = 35; y <= 37; y++) for (x = b.fx - 1; x <= b.fx + 1; x++) m.noBuild[y * W + x] = 1;
      // little team wool walls in front of the flag (breakable)
      var wx = b.fx + 3 * b.dir;
      [32, 33, 39, 40].forEach(function (yy) { wall(m, wx, yy, 1, t); });
      // corner rocks
      [[b.x0 + 2, 30], [b.x0 + 2, 42], [b.x1 - 2, 30], [b.x1 - 2, 42]].forEach(function (p) { m.g[p[1] * W + p[0]] = G.ROCK; });
    });
    // middle island
    disc(m, 36, 36, 8, G.MID);
    [[33, 33], [39, 33], [33, 39], [39, 39]].forEach(function (p) { m.g[p[1] * W + p[0]] = G.ROCK; });
    // wooden cover walls in mid
    [[36, 31], [35, 31], [37, 31], [36, 41], [35, 41], [37, 41], [31, 36], [41, 36]].forEach(function (p) { wall(m, p[0], p[1], 2, 0); });
    // the fast lane: 1-wide bridges straight to mid
    fill(m, 18, 36, 28, 36, G.PATH); fill(m, 44, 36, 53, 36, G.PATH);
    // north + south lanes
    [[19, 46], [52, 46]].forEach(function () {});
    [-1, 1].forEach(function (sd) {
      var yy = 36 + sd * 15;
      fill(m, 10, sd < 0 ? yy : 46, 12, sd < 0 ? 26 : yy, G.PATH);      // up/down out of red base
      fill(m, 59, sd < 0 ? yy : 46, 61, sd < 0 ? 26 : yy, G.PATH);      // blue base
      fill(m, 8, yy - 3, 15, yy + 3, G.GRASS, true);                   // corner islands
      fill(m, 56, yy - 3, 63, yy + 3, G.GRASS, true);
      fill(m, 16, yy - 1, 55, yy + 1, G.PATH);                          // the long lane (3 wide)
      disc(m, 36, yy, 4, G.STONE);                                      // lane outpost
      m.g[yy * W + 36] = G.ROCK;
      fill(m, 36, sd < 0 ? yy + 4 : 45, 36, sd < 0 ? 27 : yy - 4, G.PATH); // outpost -> mid
      wall(m, 33, yy, 2, 0); wall(m, 39, yy, 2, 0);
      m.pickSpots = m.pickSpots || []; m.pickSpots.push({ x: tcx(36), y: tcx(yy - sd * 2) });
    });
    m.pickSpots.push({ x: tcx(36), y: tcx(36) });
    for (var i = 0; i < N; i++) { var tx = i % W, ty = (i / W) | 0; if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) m.noBuild[i] = 1; }
    return m;
  };
  M.CTF_KIT = { sword: 2, armor: 2, inv: { wool: 24, bow: 1, arrows: 12, gapple: 1 } };
  M.PICKUPS = ['gapple', 'speed', 'pearl', 'arrows', 'fireball', 'wool'];

  // ================================================================ TNT SPLEEF
  // Three stacked floors over the void. Floors crumble right after you step on
  // them. Fall through a hole and you land on the next floor down; fall off the
  // last one and you're out.
  M.SP_LAYERS = 4;
  M.SP = { C: 36, R: [17, 16, 15, 14], kinds: ['snow', 'sand', 'clay', 'tnt'] };
  M.genSpleef = function (seed) {
    var m = blank(); m.game = 'spleef'; m.L = [];
    var r = rng(seed || 7);
    for (var z = 0; z < M.SP_LAYERS; z++) {
      var L = new Uint8Array(N), R = M.SP.R[z];
      for (var y = -R; y <= R; y++) for (var x = -R; x <= R; x++) {
        var d = Math.sqrt(x * x + y * y);
        if (d > R + 0.4) continue;
        if (z === 1 && d < 2.5) continue;                       // a hole in the middle of floor 2
        if (z === 2 && ((x === 0 && Math.abs(y) > 3) || (y === 0 && Math.abs(x) > 3))) continue; // cross gaps on floor 3
        if (z === 3 && d > 5 && d < 6.2) continue;                // a moat ring on the last floor
        L[(M.SP.C + y) * W + M.SP.C + x] = 1;
      }
      // a few random holes so every round plays differently
      for (var k = 0; k < 6 + z * 3; k++) { var a = r() * Math.PI * 2, rr = 3 + r() * (R - 4); var hx = Math.round(M.SP.C + Math.cos(a) * rr), hy = Math.round(M.SP.C + Math.sin(a) * rr); if (z > 0) L[hy * W + hx] = 0; }
      m.L.push(L);
    }
    m.spawns = [];
    for (k = 0; k < 8; k++) { var aa = k / 8 * Math.PI * 2; m.spawns.push({ x: tcx(Math.round(M.SP.C + Math.cos(aa) * 11)), y: tcx(Math.round(M.SP.C + Math.sin(aa) * 11)) }); }
    m.spawns.forEach(function (s, k) { m.L[0][Math.floor(s.y / T) * W + Math.floor(s.x / T)] = 1; m.bases.push({ team: k, cx: Math.floor(s.x / T), cy: Math.floor(s.y / T), spawn: s, inward: [Math.sign(M.SP.C - s.x / T) || 0, Math.sign(M.SP.C - s.y / T) || 0], right: [0, 1], rect: [0, 0, 0, 0] }); });
    return m;
  };
  M.spFloor = function (m, z, x, y) { if (z < 0 || z >= M.SP_LAYERS) return false; var tx = Math.floor(x / T), ty = Math.floor(y / T); if (!B.inb(tx, ty)) return false; return m.L[z][ty * W + tx] > 0; };
  M.HOP_MS = 460;

  // ================================================================ PROP HUNT
  M.PROPS = {
    barrel: { name: 'Barrel', r: 14 }, crate: { name: 'Crate', r: 15 }, bush: { name: 'Bush', r: 15 }, pot: { name: 'Flower Pot', r: 11 },
    hay: { name: 'Hay Bale', r: 16 }, pumpkin: { name: 'Pumpkin', r: 13 }, trash: { name: 'Trash Can', r: 12 }, mailbox: { name: 'Mailbox', r: 10 },
    stool: { name: 'Stool', r: 11 }, lamp: { name: 'Street Lamp', r: 9 },
  };
  M.PROP_KINDS = Object.keys(M.PROPS);
  M.HIDE_HP = 20;
  // A little village: houses with doors, a market, a farm and a park.
  M.genHide = function (seed) {
    var m = blank(); m.game = 'hide'; m.props = [];
    var r = rng(seed || 11);
    fill(m, 8, 8, 63, 63, G.GRASS, true);
    fill(m, 9, 7, 62, 64, G.GRASS, true);
    fill(m, 7, 9, 64, 62, G.GRASS, true);
    // roads
    fill(m, 9, 34, 62, 37, G.PATH); fill(m, 34, 9, 37, 62, G.PATH);
    // town square
    fill(m, 29, 29, 42, 42, G.COBBLE);
    function house(x0, y0, x1, y1, doors) {
      fill(m, x0, y0, x1, y1, G.FLOOR);
      for (var x = x0; x <= x1; x++) { wall(m, x, y0, 2, 0); wall(m, x, y1, 2, 0); }
      for (var y = y0; y <= y1; y++) { wall(m, x0, y, 2, 0); wall(m, x1, y, 2, 0); }
      doors.forEach(function (d) { var i = d[1] * W + d[0]; m.w[i] = 0; i = (d[1] + (d[2] || 0)) * W + d[0] + (d[3] || 0); m.w[i] = 0; });
    }
    house(12, 12, 24, 22, [[18, 22], [19, 22], [24, 16], [24, 17]]);          // NW house
    for (var y = 13; y <= 21; y++) if (y !== 17 && y !== 18) wall(m, 18, y, 2, 0);   // inner wall with a gap
    house(46, 12, 59, 21, [[52, 21], [53, 21], [46, 16], [46, 17]]);          // NE house (barn)
    house(12, 47, 23, 59, [[17, 47], [18, 47], [23, 53], [23, 54]]);          // SW house
    for (var x = 13; x <= 22; x++) if (x !== 15 && x !== 16 && x !== 20) wall(m, x, 53, 2, 0);
    house(48, 48, 58, 58, [[48, 52], [48, 53], [53, 48], [54, 48]]);          // SE shop
    for (var i = 0; i < N; i++) { m.noBuild[i] = 1; m.noMine[i] = 1; }
    // fences around the farm (NE outside) and park (SW outside) using wood walls with gaps
    for (x = 40; x <= 60; x++) if (x % 5) wall(m, x, 27, 2, 0);
    for (x = 10; x <= 30; x++) if (x % 6) wall(m, x, 44, 2, 0);
    // spawns: seekers start in the town square cage, hiders spread out
    m.seekSpawn = { x: tcx(35.5), y: tcx(35.5) };
    m.hideSpawns = [[20, 30], [50, 30], [25, 42], [46, 42], [30, 25], [41, 47], [15, 36], [56, 36]].map(function (p) { return { x: tcx(p[0]), y: tcx(p[1]) }; });
    // props: themed clusters + random scatter
    var used = {};
    m.hideSpawns.forEach(function (s) { used[Math.floor(s.y / T) * W + Math.floor(s.x / T)] = 1; });
    m.bases = [{ team: 0, cx: 20, cy: 30, spawn: m.hideSpawns[0], inward: [0, 1], right: [1, 0], rect: [0, 0, 0, 0] }, { team: 1, cx: 35, cy: 35, spawn: m.seekSpawn, inward: [0, 1], right: [1, 0], rect: [32, 32, 39, 39] }];
    function prop(kind, tx, ty) {
      var i = ty * W + tx; if (used[i] || !m.g[i] || m.w[i] || m.g[i] === G.ROCK) return false;
      if (Math.abs(tx - 35.5) < 4 && Math.abs(ty - 35.5) < 4) return false; // keep the cage clear
      used[i] = 1; m.obj[i] = 3;
      m.props.push({ id: m.props.length, kind: kind, tile: i, x: tcx(tx), y: tcx(ty) }); return true;
    }
    function cluster(kinds, x0, y0, x1, y1, n) { for (var k = 0, tries = 0; k < n && tries < n * 30; tries++) { var tx = x0 + Math.floor(r() * (x1 - x0 + 1)), ty = y0 + Math.floor(r() * (y1 - y0 + 1)); if (prop(kinds[Math.floor(r() * kinds.length)], tx, ty)) k++; } }
    cluster(['barrel', 'crate', 'stool', 'pot'], 13, 13, 23, 21, 14);         // NW house
    cluster(['hay', 'hay', 'barrel', 'crate', 'pumpkin'], 47, 13, 58, 20, 16);  // barn
    cluster(['pumpkin', 'hay', 'pumpkin', 'bush'], 40, 9, 61, 26, 16);          // farm
    cluster(['stool', 'pot', 'crate', 'barrel'], 13, 48, 22, 58, 14);         // SW house
    cluster(['crate', 'barrel', 'trash', 'stool'], 49, 49, 57, 57, 12);       // shop
    cluster(['bush', 'pot', 'bush', 'lamp'], 10, 45, 30, 62, 14);             // park
    cluster(['trash', 'mailbox', 'lamp', 'pot', 'barrel'], 27, 27, 44, 44, 12); // square
    cluster(['bush', 'mailbox', 'trash', 'lamp', 'crate', 'pumpkin'], 9, 9, 62, 62, 34); // everywhere
    // the seeker cage
    m.cage = [32, 32, 39, 39];
    return m;
  };
  M.propAt = function (m, x, y, rad) { var best = null, bd = rad || 40; if (!m.props) return null; for (var k = 0; k < m.props.length; k++) { var p = m.props[k], d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } } return best; };

  // ================================================================ CUSTOM MAPS (map builder)
  // A custom map is plain JSON: ground (run-length), walls, props, spleef floors and
  // markers (tile indexes). buildCustom() turns it into the same shape the
  // generators above produce, so every game, bot and renderer just works.
  M.DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  M.rle = function (arr) { var out = [], v = arr[0], n = 0; for (var i = 0; i < arr.length; i++) { if (arr[i] === v) n++; else { out.push(v.toString(36) + '.' + n.toString(36)); v = arr[i]; n = 1; } } out.push(v.toString(36) + '.' + n.toString(36)); return out.join(','); };
  M.unrle = function (str) { var a = new Uint8Array(N); if (!str) return a; var k = 0; str.split(',').forEach(function (tok) { var p = tok.split('.'), v = parseInt(p[0], 36) || 0, n = parseInt(p[1], 36) || 0; for (var j = 0; j < n && k < N; j++) a[k++] = v; }); return a; };
  function ctr(i) { return { x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2 }; }
  function byTeam(list, t) { if (!list) return null; for (var k = 0; k < list.length; k++) if (list[k][0] === t) return list[k]; return null; }
  M.buildCustom = function (cm) {
    var m = blank(), mk = cm.mk || {}, game = cm.game;
    m.game = game; m.custom = true; m.name = cm.name;
    m.g = M.unrle(cm.g);
    (cm.w || []).forEach(function (q) { m.w[q[0]] = q[1]; m.wc[q[0]] = q[2] || 0; });
    (cm.f || []).forEach(function (q) { m.f[q[0]] = q[1]; m.fc[q[0]] = q[2] || 0; });
    m.props = [];
    (cm.props || []).forEach(function (q) { if (!M.PROPS[q[1]]) return; m.obj[q[0]] = 3; var c = ctr(q[0]); m.props.push({ id: m.props.length, kind: q[1], tile: q[0], x: c.x, y: c.y }); });
    for (var i = 0; i < N; i++) { var tx = i % W, ty = (i / W) | 0; if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) m.noBuild[i] = 1; }
    function noB(i, r) { var tx = i % W, ty = (i / W) | 0; for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) if (B.inb(tx + x, ty + y)) m.noBuild[(ty + y) * W + tx + x] = 1; }
    var mid = { x: W * T / 2, y: H * T / 2 };
    if (game === 'bw') {
      for (var t = 0; t < 4; t++) {
        var bed = byTeam(mk.bed, t), sp = byTeam(mk.sp, t), tg = byTeam(mk.tg, t), sh = byTeam(mk.shop, t), up = byTeam(mk.up, t);
        var d = M.DIRS[bed ? bed[2] & 3 : 0], foot = bed ? bed[1] : (sp ? sp[1] : 0), fx = foot % W, fy = (foot / W) | 0, hx = fx + d[0], hy = fy + d[1];
        var spc = sp ? ctr(sp[1]) : { x: (fx - d[0] * 3) * T + T / 2, y: (fy - d[1] * 3) * T + T / 2 };
        var gc = tg ? ctr(tg[1]) : spc, sx = Math.floor(spc.x / T), sy = Math.floor(spc.y / T);
        m.bases.push({ team: t, cx: fx - 2 * d[0], cy: fy - 2 * d[1], out: [-d[0], -d[1]], inward: d, right: [-d[1], d[0]], spawn: spc, gen: gc,
          rect: [Math.min(sx, fx) - 5, Math.min(sy, fy) - 5, Math.max(sx, fx) + 5, Math.max(sy, fy) + 5] });
        if (bed) { var head = hy * W + hx; m.beds.push({ team: t, foot: foot, head: head, x: (fx + hx + 1) * T / 2, y: (fy + hy + 1) * T / 2, dir: d, alive: true }); m.obj[foot] = 1; m.obj[head] = 1; }
        else m.beds.push({ team: t, foot: -1, head: -1, x: spc.x, y: spc.y, dir: d, alive: false });
        var gt = tg ? tg[1] : Math.floor(gc.y / T) * W + Math.floor(gc.x / T);
        m.gens.push({ kind: 'iron', team: t, x: gc.x - 9, y: gc.y, tile: gt }, { kind: 'gold', team: t, x: gc.x + 9, y: gc.y, tile: gt }, { kind: 'em', team: t, base: true, x: gc.x, y: gc.y - 2, tile: gt });
        [[sh, 'shop'], [up, 'up']].forEach(function (q) { if (!q[0]) return; var c = ctr(q[0][1]); m.obj[q[0][1]] = 2; m.npcs.push({ kind: q[1], team: t, tile: q[0][1], x: c.x, y: c.y + 10 }); });
        if (sp) noB(sp[1], 1); noB(gt, 0);
      }
      (mk.dia || []).forEach(function (i2) { var c = ctr(i2); m.gens.push({ kind: 'dia', x: c.x, y: c.y, tile: i2 }); m.noBuild[i2] = 1; });
      (mk.em || []).forEach(function (i2) { var c = ctr(i2); m.gens.push({ kind: 'em', x: c.x, y: c.y, tile: i2 }); m.noBuild[i2] = 1; });
    } else if (game === 'ctf') {
      for (t = 0; t < 2; t++) {
        var s2 = byTeam(mk.sp, t), fl = byTeam(mk.flag, t);
        var fc = fl ? ctr(fl[1]) : s2 ? ctr(s2[1]) : mid, sc2 = s2 ? ctr(s2[1]) : fc, dir = Math.sign(mid.x - fc.x) || (t ? -1 : 1);
        m.bases.push({ team: t, cx: Math.floor(sc2.x / T), cy: Math.floor(sc2.y / T), inward: [dir, 0], right: [0, 1], spawn: sc2, flagTile: fl ? fl[1] : -1, fx: fc.x, fy: fc.y,
          rect: [Math.floor(fc.x / T) - 6, Math.floor(fc.y / T) - 6, Math.floor(fc.x / T) + 6, Math.floor(fc.y / T) + 6] });
        if (s2) noB(s2[1], 1); if (fl) noB(fl[1], 1);
      }
      m.pickSpots = (mk.pick || []).map(ctr);
    } else if (game === 'spleef') {
      m.L = [];
      for (var z = 0; z < M.SP_LAYERS; z++) m.L.push(M.unrle((cm.L || [])[z]));
      var sps = (mk.sp || []).map(function (q) { return ctr(q[1]); });
      if (!sps.length) sps = [{ x: 36 * T, y: 36 * T }];
      m.spawns = []; for (var k2 = 0; k2 < 8; k2++) m.spawns.push(sps[k2 % sps.length]);
      m.spawns.forEach(function (s3, k) { m.bases.push({ team: k, cx: Math.floor(s3.x / T), cy: Math.floor(s3.y / T), spawn: s3, inward: [0, 0], right: [0, 1], rect: [0, 0, 0, 0] }); });
    } else if (game === 'hide') {
      var hs = (mk.hs || []).map(ctr), sk = mk.seek && mk.seek.length ? ctr(mk.seek[0]) : mid;
      m.hideSpawns = hs.length ? hs : [mid]; m.seekSpawn = sk;
      var cx2 = Math.floor(sk.x / T), cy2 = Math.floor(sk.y / T);
      m.cage = [cx2 - 3, cy2 - 3, cx2 + 3, cy2 + 3];
      m.bases = [{ team: 0, cx: 0, cy: 0, spawn: m.hideSpawns[0], inward: [0, 1], right: [1, 0], rect: [0, 0, 0, 0] }, { team: 1, cx: cx2, cy: cy2, spawn: sk, inward: [0, 1], right: [1, 0], rect: m.cage }];
      for (i = 0; i < N; i++) { m.noBuild[i] = 1; m.noMine[i] = 1; }
    }
    return m;
  };
  // What's missing before a map can be played? -> list of problems (empty = good to go)
  M.validateCustom = function (cm) {
    var p = [], mk = cm.mk || {}, g = M.unrle(cm.g), stand = function (i) { return i >= 0 && i < N && (g[i] > 0 && g[i] !== B.G.ROCK); };
    var tn = function (t) { return (B.TEAMS[t] || {}).name; };
    if (!cm.name || !String(cm.name).trim()) p.push('Give your map a name');
    if (cm.game === 'bw') {
      for (var t = 0; t < 4; t++) {
        var sp = byTeam(mk.sp, t), bed = byTeam(mk.bed, t);
        if (!sp) p.push(tn(t) + ' team needs a spawn point'); else if (!stand(sp[1])) p.push(tn(t) + ' spawn must be on solid ground');
        if (!bed) p.push(tn(t) + ' team needs a bed'); else { var d = M.DIRS[bed[2] & 3], hd = bed[1] + d[1] * W + d[0]; if (!stand(bed[1]) || !stand(hd)) p.push(tn(t) + ' bed must sit on ground (both halves)'); }
        if (!byTeam(mk.tg, t)) p.push(tn(t) + ' team needs a generator');
        if (!byTeam(mk.shop, t)) p.push(tn(t) + ' team needs an Item Shop NPC');
        if (!byTeam(mk.up, t)) p.push(tn(t) + ' team needs an Upgrades NPC');
      }
    } else if (cm.game === 'ctf') {
      for (t = 0; t < 2; t++) { var s2 = byTeam(mk.sp, t), f = byTeam(mk.flag, t); if (!s2) p.push(tn(t) + ' team needs a spawn point'); else if (!stand(s2[1])) p.push(tn(t) + ' spawn must be on solid ground'); if (!f) p.push(tn(t) + ' team needs a flag'); else if (!stand(f[1])) p.push(tn(t) + ' flag must be on solid ground'); }
    } else if (cm.game === 'spleef') {
      var L0 = M.unrle((cm.L || [])[0]), cnt = 0; for (var i = 0; i < N; i++) if (L0[i]) cnt++;
      if (cnt < 40) p.push('Paint at least 40 tiles on floor 1 (the top floor)');
      var sps = mk.sp || []; if (sps.length < 2) p.push('Place at least 2 spawn points');
      sps.forEach(function (q, k) { if (!L0[q[1]]) p.push('Spawn #' + (k + 1) + ' must be on a floor-1 tile'); });
    } else if (cm.game === 'hide') {
      if (!mk.seek || !mk.seek.length) p.push('Place the seeker spawn (their cage)'); else if (!stand(mk.seek[0])) p.push('Seeker spawn must be on ground');
      if (!mk.hs || !mk.hs.length) p.push('Place at least one hider spawn');
      if ((cm.props || []).length < 8) p.push('Place at least 8 props for hiders to copy');
    } else p.push('Pick a game');
    return p;
  };
  // Turn a built-in map into an editable custom map (builder templates).
  M.toCustom = function (game, seed) {
    var m = M.genMap(game, seed || 7), mk = {}, i, cm = { v: 1, game: game, name: '', g: M.rle(m.g), w: [], props: [], mk: mk };
    for (i = 0; i < N; i++) if (m.w[i]) cm.w.push([i, m.w[i], m.wc[i]]);
    var ti = function (x, y) { return Math.floor(y / T) * W + Math.floor(x / T); };
    if (game === 'bw') {
      mk.sp = []; mk.bed = []; mk.tg = []; mk.shop = []; mk.up = []; mk.dia = []; mk.em = [];
      m.bases.forEach(function (b, t) { mk.sp.push([t, ti(b.spawn.x, b.spawn.y)]); });
      m.beds.forEach(function (b) { var dir = 0; M.DIRS.forEach(function (d, k) { if (d[0] === b.dir[0] && d[1] === b.dir[1]) dir = k; }); mk.bed.push([b.team, b.foot, dir]); });
      m.gens.forEach(function (gn) { if (gn.team != null) { if (gn.kind === 'iron') mk.tg.push([gn.team, gn.tile]); } else mk[gn.kind].push(gn.tile); });
      m.npcs.forEach(function (n) { mk[n.kind].push([n.team, n.tile]); });
    } else if (game === 'ctf') {
      mk.sp = m.bases.map(function (b, t) { return [t, ti(b.spawn.x, b.spawn.y)]; });
      mk.flag = m.bases.map(function (b, t) { return [t, b.flagTile]; });
      mk.pick = (m.pickSpots || []).map(function (s) { return ti(s.x, s.y); });
    } else if (game === 'spleef') {
      cm.L = m.L.map(function (L) { var a = new Uint8Array(N); for (var k = 0; k < N; k++) a[k] = L[k] ? 1 : 0; return M.rle(a); });
      mk.sp = m.spawns.map(function (s, k) { return [k, ti(s.x, s.y)]; });
    } else if (game === 'hide') {
      cm.props = m.props.map(function (p) { return [p.tile, p.kind]; });
      mk.hs = m.hideSpawns.map(function (s) { return ti(s.x, s.y); });
      mk.seek = [ti(m.seekSpawn.x, m.seekSpawn.y)];
    }
    return cm;
  };
  M.blankCustom = function (game) {
    var g = new Uint8Array(N), cm = { v: 1, game: game, name: '', w: [], props: [], mk: {} };
    var r = game === 'spleef' ? 0 : 10;
    for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) g[(36 + y) * W + 36 + x] = B.G.GRASS;
    cm.g = M.rle(g);
    if (game === 'spleef') { cm.L = []; for (var z = 0; z < M.SP_LAYERS; z++) { var a = new Uint8Array(N); var R = 12 - z; for (y = -R; y <= R; y++) for (x = -R; x <= R; x++) if (x * x + y * y <= R * R) a[(36 + y) * W + 36 + x] = 1; cm.L.push(M.rle(a)); } }
    return cm;
  };

  M.genMap = function (game, seed, custom) { if (custom) return M.buildCustom(custom); return game === 'ctf' ? M.genCTF(seed) : game === 'spleef' ? M.genSpleef(seed) : game === 'hide' ? M.genHide(seed) : B.genMap(); };

  // Hotbar per game.
  M.hotbar = function (game, inv, role) {
    if (game === 'spleef') { var o = ['shovel']; if (inv.snow > 0) o.push('snow'); return o; }
    if (game === 'hide') return role === 1 ? ['sword', 'radar'] : ['mask', 'taunt'];
    return B.hotbar(inv);
  };
  root.MG = M;
})(typeof window !== 'undefined' ? window : globalThis);
