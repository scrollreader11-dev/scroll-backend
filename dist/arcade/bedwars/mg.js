/* ============================================================
   ScrollHub Games — shared rules for the minigames that run on the Bedwars
   engine: Capture the Flag, TNT Spleef and Prop Hunt. Loaded after shared.js
   by the browser (window.MG) and by the server (globalThis.MG).
   ============================================================ */
(function (root) {
  var B = root.BW, T = B.T, W = B.W, H = B.H, N = W * H, G = B.G;
  B.onDims(function (w, h) { W = w; H = h; N = w * h; });
  var M = {};

  // Extra colors for free-for-all games (Bedwars only ever uses the first 4).
  if (B.TEAMS.length < 8) B.TEAMS.push(
    { key: 'orange', name: 'Orange', color: '#ff922b', dark: '#b4580a', light: '#ffd3a8' },
    { key: 'purple', name: 'Purple', color: '#9b6bff', dark: '#5b34b8', light: '#d9c9ff' },
    { key: 'pink', name: 'Pink', color: '#ff6ec7', dark: '#b42d82', light: '#ffc9ea' },
    { key: 'cyan', name: 'Cyan', color: '#2ee6d6', dark: '#11968b', light: '#b5fff8' });
  // new ground types
  G.COBBLE = 7; G.FLOOR = 8; G.SNOW = 9; G.ICE = 10; G.CANDY = 11; G.SAND = 12; G.BRICK = 13;
  // new hand items (appended so Bedwars' held-item indexes don't change)
  ['shovel', 'snow', 'mask', 'taunt', 'radar', 'fists', 'knife'].forEach(function (k) { if (B.HOTBAR_ORDER.indexOf(k) < 0) B.HOTBAR_ORDER.push(k); });
  B.ITEM_NAMES.shovel = 'Spleef Shovel'; B.ITEM_NAMES.snow = 'Snowball'; B.ITEM_NAMES.mask = 'Disguise'; B.ITEM_NAMES.taunt = 'Taunt'; B.ITEM_NAMES.radar = 'Hider Radar';
  B.ITEM_NAMES.fists = 'Fists'; B.ITEM_NAMES.knife = 'Knife';

  M.GAMES = {
    bw: { key: 'bw', name: 'Bedwars', icon: '🛏️' },
    ctf: { key: 'ctf', name: 'Capture the Flag', short: 'CTF', icon: '🚩', teams: 2, per: 4, max: 8, caps: 3, mins: 8, respawn: 4,
      desc: 'Grab the enemy flag and bring it home', tag: 'Team 4v4' },
    spleef: { key: 'spleef', name: 'TNT Spleef', short: 'SPLEEF', icon: '❄️', teams: 8, per: 1, max: 8, mins: 4,
      desc: 'The floor falls away — be the last one standing', tag: 'Free for all' },
    hide: { key: 'hide', name: 'Prop Hunt', short: 'PROP HUNT', icon: '🎃', teams: 2, per: 8, max: 8, hideSec: 30, seekSec: 180,
      desc: 'Hide as a prop — or hunt the ones who did', tag: 'Hide & seek' },
    duel: { key: 'duel', name: 'Duels', short: 'DUELS', icon: '⚔️', teams: 2, per: 1, max: 2, wins: 5, mins: 5, respawn: 3,
      desc: '1v1 sword fight — first to 5 kills', tag: '1v1 ranked' },
    murder: { key: 'murder', name: 'Murder Mystery', short: 'MYSTERY', icon: '🔪', teams: 8, per: 1, max: 8, mins: 5,
      desc: 'Someone here is the murderer…', tag: '8-player mystery' },
    build: { key: 'build', name: 'Build Battle', short: 'BUILD', icon: '🏗️', teams: 8, per: 1, max: 4, buildSec: 150, voteSec: 9,
      desc: 'Build the theme, then everyone votes', tag: 'Creative' },
    royale: { key: 'royale', name: 'Scroll Royale', short: 'ROYALE', icon: '🪂', teams: 100, per: 1, max: 24, mins: 15,
      desc: 'Drop from the bus, loot, outlast the storm', tag: 'Battle royale' },
  };
  // ================================================================ SCROLL ROYALE data (shared by server + client)
  // Health and shield are 0–100. dmg = per bullet, rate = ms between shots, mag = clip, rl = reload ms, sp = spread (rad),
  // rg = range px, am = ammo type, pel = pellets, auto = hold to fire, proj = projectile speed (rockets), blast = splash radius px.
  M.RRAR = [
    { n: 'Common', c: '#b6bcc4', dm: 1, rl: 1 }, { n: 'Uncommon', c: '#52d273', dm: 1.07, rl: 0.95 }, { n: 'Rare', c: '#3fa9ff', dm: 1.14, rl: 0.9 },
    { n: 'Epic', c: '#b06bff', dm: 1.22, rl: 0.85 }, { n: 'Legendary', c: '#ffb02e', dm: 1.32, rl: 0.8 }];
  M.RW = {
    pistol: { n: 'Pistol', cls: 'gun', dmg: 23, rate: 230, mag: 12, rl: 1100, sp: 0.035, rg: 680, am: 'L', icon: '🔫' },
    smg: { n: 'SMG', cls: 'gun', dmg: 13, rate: 80, mag: 30, rl: 1500, sp: 0.095, rg: 540, am: 'L', auto: 1, icon: '🔫' },
    ar: { n: 'Assault Rifle', cls: 'gun', dmg: 22, rate: 135, mag: 30, rl: 1900, sp: 0.045, rg: 920, am: 'M', auto: 1, icon: '🔫' },
    burst: { n: 'Burst Rifle', cls: 'gun', dmg: 25, rate: 380, mag: 24, rl: 2000, sp: 0.03, rg: 950, am: 'M', burst: 3, icon: '🔫' },
    shotgun: { n: 'Pump Shotgun', cls: 'gun', dmg: 11, pel: 9, rate: 850, mag: 5, rl: 2400, sp: 0.22, rg: 400, am: 'S', icon: '🔫' },
    tac: { n: 'Tactical Shotgun', cls: 'gun', dmg: 8, pel: 8, rate: 420, mag: 8, rl: 2600, sp: 0.25, rg: 360, am: 'S', icon: '🔫' },
    sniper: { n: 'Sniper Rifle', cls: 'gun', dmg: 92, rate: 1400, mag: 5, rl: 2600, sp: 0.004, rg: 1700, am: 'H', scope: 1, icon: '🎯' },
    minigun: { n: 'Minigun', cls: 'gun', dmg: 9, rate: 55, mag: 120, rl: 4000, sp: 0.13, rg: 640, am: 'M', auto: 1, minR: 3, icon: '🔫' },
    rocket: { n: 'Rocket Launcher', cls: 'gun', dmg: 90, rate: 1300, mag: 1, rl: 2400, sp: 0.01, rg: 1100, am: 'R', proj: 640, blast: 115, minR: 3, icon: '🚀' },
    grenade: { n: 'Grenade', cls: 'throw', dmg: 85, blast: 120, fuse: 2000, max: 6, icon: '💣' },
    bandage: { n: 'Bandages', cls: 'heal', hp: 15, cap: 75, use: 2400, max: 15, icon: '🩹' },
    medkit: { n: 'Med Kit', cls: 'heal', hp: 100, cap: 100, use: 5000, max: 3, icon: '🧰' },
    minishield: { n: 'Small Shield', cls: 'heal', sh: 25, cap: 50, use: 1400, max: 6, icon: '🧪' },
    shieldpot: { n: 'Shield Potion', cls: 'heal', sh: 50, cap: 100, use: 3200, max: 3, icon: '🛡️' },
  };
  M.RW_KEYS = Object.keys(M.RW);
  M.RAMMO = { L: { n: 'Light ammo', c: '#ffd36b', max: 360, box: 36 }, M: { n: 'Medium ammo', c: '#7ee081', max: 360, box: 30 }, S: { n: 'Shells', c: '#ff7a5c', max: 60, box: 10 }, H: { n: 'Heavy ammo', c: '#7fc8ff', max: 40, box: 6 }, R: { n: 'Rockets', c: '#c78bff', max: 12, box: 3 } };
  M.RSLOTS = 5;
  M.R_STORM = [ // wait s, shrink s, radius (tiles) after shrinking, damage per second outside
    { w: 70, s: 45, r: 46, d: 1 }, { w: 50, s: 35, r: 30, d: 2 }, { w: 40, s: 30, r: 18, d: 4 }, { w: 30, s: 25, r: 9, d: 7 }, { w: 25, s: 20, r: 3, d: 10 }, { w: 15, s: 15, r: 0, d: 14 }];
  M.R_BUS_MS = 26000;
  // vehicles: hp, speed multiplier, ram damage, hit radius; tanks have a cannon the driver fires by clicking
  M.RVEH = {
    jeep: { n: 'Jeep', hp: 380, sp: 2.3, ram: 35, r: 48, icon: '🚙' },
    car: { n: 'Sports Car', hp: 240, sp: 2.9, ram: 28, r: 44, icon: '🏎️' },
    tank: { n: 'Tank', hp: 1100, sp: 1.3, ram: 60, r: 66, icon: '🛡️', gun: { dmg: 75, blast: 115, cd: 1400, sp: 900 } },
  };
  M.RVEH_KEYS = ['jeep', 'car', 'tank'];
  // older code paths still look these up
  M.RARITY = M.RRAR.map(function (r) { return { n: r.n, c: r.c, m: r.dm }; });
  M.GUNS = {}; M.GUN_ORDER = [];
  M.RW_KEYS.forEach(function (k) { var w = M.RW[k]; M.GUNS[k] = { n: w.n, a: w.am, r: w.rate || 500, d: w.dmg || 0, p: w.pel || 1 }; M.GUN_ORDER.push(k); if (B.HOTBAR_ORDER.indexOf(k) < 0) B.HOTBAR_ORDER.push(k); B.ITEM_NAMES[k] = w.n; });
  if (B.HOTBAR_ORDER.indexOf('pickaxe') < 0) B.HOTBAR_ORDER.push('pickaxe'); B.ITEM_NAMES.pickaxe = 'Pickaxe';
  M.isMini = function (g) { return g === 'ctf' || g === 'spleef' || g === 'hide' || g === 'duel' || g === 'murder' || g === 'build' || g === 'royale'; };
  M.RANKS = [
    { key: 'bronze', name: 'Bronze', at: 0, color: '#c67b4e' },
    { key: 'silver', name: 'Silver', at: 1100, color: '#c5cfe2' },
    { key: 'gold', name: 'Gold', at: 1250, color: '#ffd166' },
    { key: 'diamond', name: 'Diamond', at: 1400, color: '#5ff0e6' },
  ];
  M.rankOf = function (elo) { var r = M.RANKS[0]; M.RANKS.forEach(function (q) { if (elo >= q.at) r = q; }); return r; };

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
    xtree: { name: 'Christmas Tree', r: 18 }, present: { name: 'Present', r: 12 }, presents: { name: 'Gift Pile', r: 17 }, snowman: { name: 'Snowman', r: 13 },
    candycane: { name: 'Candy Cane', r: 8 }, gingerbread: { name: 'Gingerbread Man', r: 11 }, reindeer: { name: 'Reindeer', r: 17 }, sleigh: { name: 'Sleigh', r: 22 },
    ornament: { name: 'Giant Ornament', r: 13 }, toysoldier: { name: 'Toy Soldier', r: 9 }, wreath: { name: 'Wreath Post', r: 10 }, snowpile: { name: 'Snow Pile', r: 16 },
    bannerred: { name: 'Red Banner', r: 9 }, bannerblue: { name: 'Blue Banner', r: 9 }, bannergold: { name: 'Gold Banner', r: 9 }, lanternpost: { name: 'Light String Post', r: 9 },
    icecrystal: { name: 'Ice Crystal', r: 11 },
    // other holidays
    deadtree: { name: 'Spooky Tree', r: 16 }, gravestone: { name: 'Gravestone', r: 11 }, cauldron: { name: 'Cauldron', r: 13 }, ghostprop: { name: 'Ghost', r: 11 },
    jacklantern: { name: "Jack-o'-Lantern", r: 12 }, spiderweb: { name: 'Spider Web', r: 12 }, scarecrow: { name: 'Scarecrow', r: 12 }, leafpile: { name: 'Leaf Pile', r: 14 },
    heartballoon: { name: 'Heart Balloon', r: 10 }, rosebush: { name: 'Rose Bush', r: 14 }, loveletter: { name: 'Love Letter', r: 11 }, egg: { name: 'Easter Egg', r: 11 },
    flowerbed: { name: 'Tulips', r: 14 }, bunnyprop: { name: 'Bunny Statue', r: 12 }, firework: { name: 'Firework', r: 10 }, balloons: { name: 'Balloons', r: 11 },
    potofgold: { name: 'Pot of Gold', r: 13 }, clover: { name: 'Clover', r: 12 }, beachball: { name: 'Beach Ball', r: 10 }, umbrella: { name: 'Beach Umbrella', r: 14 },
    sandcastle: { name: 'Sandcastle', r: 15 }, turkey: { name: 'Turkey', r: 13 }, cornstalk: { name: 'Corn Stalks', r: 12 },
    bannerorange: { name: 'Orange Banner', r: 10 }, bannerpurple: { name: 'Purple Banner', r: 10 }, bannergreen: { name: 'Green Banner', r: 10 }, bannerpink: { name: 'Pink Banner', r: 10 },
  };
  M.CLASSIC_PROPS = ['barrel', 'crate', 'bush', 'pot', 'hay', 'pumpkin', 'trash', 'mailbox', 'stool', 'lamp'];
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
  M.buildCustom = function (cm) { B.setDims(72, 72);
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
  M.toCustom = function (game, seed) { // the Studio edits 72x72 maps, so copies of the big maps are made at that size
    var keepR = M.R_SIZE; M.R_SIZE = 72;
    var m; try { m = game === 'bw' ? B.genMap(72) : M.genMap(game, seed || 7); } finally { M.R_SIZE = keepR; }
    B.setDims(72, 72);
    var mk = {}, i, cm = { v: 1, game: game, name: '', g: M.rle(m.g), w: [], props: [], mk: mk };
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

  // ================================================================ DUELS
  // A tight arena over the void: knockback matters.
  M.genDuel = function (seed) {
    var m = blank(); m.game = 'duel';
    var r = rng(seed || 3);
    fill(m, 27, 30, 45, 42, G.COBBLE, true);
    fill(m, 28, 29, 44, 43, G.COBBLE, true);
    disc(m, 36, 36, 3, G.MID);
    [[31, 33], [41, 33], [31, 39], [41, 39]].forEach(function (p) { m.g[p[1] * W + p[0]] = G.ROCK; });
    // a couple of random bite marks so arenas differ a little
    for (var k = 0; k < 3; k++) { var ex = 28 + Math.floor(r() * 17), ey = r() < 0.5 ? 29 : 43; if (Math.abs(ex - 36) > 3) m.g[ey * W + ex] = 0; }
    fill(m, 28, 35, 29, 37, G.PAD); fill(m, 43, 35, 44, 37, G.PAD);
    m.bases = [
      { team: 0, cx: 28, cy: 36, inward: [1, 0], right: [0, 1], spawn: { x: tcx(28) + 10, y: tcx(36) }, rect: [27, 29, 30, 43] },
      { team: 1, cx: 44, cy: 36, inward: [-1, 0], right: [0, 1], spawn: { x: tcx(44) - 10, y: tcx(36) }, rect: [42, 29, 45, 43] },
    ];
    for (var i = 0; i < N; i++) m.noBuild[i] = 1;
    return m;
  };
  // ================================================================ MURDER MYSTERY
  // The Prop Hunt village, but the props are just furniture: everyone looks innocent.
  M.genMurder = function (seed) {
    var m = M.genHide(seed); m.game = 'murder'; m.cage = null;
    var spots = m.hideSpawns.concat([m.seekSpawn]);
    m.bases = [];
    for (var t = 0; t < 8; t++) { var s = spots[t % spots.length]; m.bases.push({ team: t, cx: Math.floor(s.x / T), cy: Math.floor(s.y / T), spawn: s, inward: [0, 1], right: [1, 0], rect: [0, 0, 0, 0] }); }
    return m;
  };
  // ================================================================ SCROLL ROYALE MAP
  // An island with towns (houses with roofs), a farm, a quarry, a park, roads, forests and destructible stuff.
  // Destructibles: m.rgObjs [{id, i, kind}] (tile is solid via m.obj = 9). Houses: m.houses [{x0,y0,x1,y1}] (roofs drawn by the client).
  M.R_OBJ = { tree: { hp: 170, r: 17 }, pine: { hp: 170, r: 15 }, bush: { hp: 40, r: 14, soft: 1 }, crate: { hp: 70, r: 15, loot: 1 }, barrel: { hp: 45, r: 13, boom: 1 }, rock: { hp: 320, r: 17 }, hay: { hp: 60, r: 16 } };
  M.R_WALL_HP = 220;
  M.R_SIZE = 144;
  M.genRoyale = function (seed) {
    var S2 = M.R_SIZE; B.setDims(S2, S2);
    var m = blank(); m.game = 'royale'; m.props = []; m.rgObjs = []; m.houses = []; m.chestSpots = []; m.lootSpots = []; m.vehSpots = []; m.pois = [];
    var r = rng(seed || 7), C = (S2 - 1) / 2, RAD = C - 3;
    function ri(a, b) { return a + ((r() * (b - a + 1)) | 0); }
    function inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
    function setG(x, y, v) { if (inb(x, y) && m.g[y * W + x] && m.g[y * W + x] !== G.ROCK) m.g[y * W + x] = v; }
    function okG(x, y) { var i = y * W + x; return inb(x, y) && m.g[i] && m.g[i] !== G.ROCK; }
    function rect(x0, y0, x1, y1, v) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) setG(x, y, v); }
    function blob(cx, cy, rr, v, rough) { for (var y = -rr - 2; y <= rr + 2; y++) for (var x = -rr - 2; x <= rr + 2; x++) { var a = Math.atan2(y, x), d = Math.hypot(x, y), lim = rr * (1 + (rough || 0.18) * Math.sin(a * 3 + cx) * Math.cos(a * 2 + cy)); if (d <= lim) setG(cx + x, cy + y, v); } }
    // ---- island: big wobbly coast with a couple of bays
    var ph = [r() * 6, r() * 6, r() * 6];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var dx = (x - C) / RAD, dy = (y - C) / RAD, a = Math.atan2(dy, dx);
      var wob = 0.05 * Math.sin(a * 3 + ph[0]) + 0.035 * Math.sin(a * 7 + ph[1]) + 0.02 * Math.sin(a * 13 + ph[2]);
      var d = Math.pow(Math.pow(Math.abs(dx), 2.6) + Math.pow(Math.abs(dy), 2.6), 1 / 2.6);
      if (d < 0.97 - wob) m.g[y * W + x] = d > 0.9 - wob ? G.SAND : G.GRASS;
    }
    for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) { var i = y * W + x; if (!m.g[i]) continue; if (!m.g[i - 1] || !m.g[i + 1] || !m.g[i - W] || !m.g[i + W]) m.g[i] = G.ROCK; }
    // ---- towns on a ring + the middle
    var NAMES = ['Scroll City', 'Gim Farms', 'Bedrock Quarry', 'Pixel Park', 'Lazy Lagoon', 'Dusty Diner', 'Pleasant Pines', 'Snack Shack', 'Crater Camp', 'Frosty Peaks', 'Sunny Shores', 'Neon Market'];
    var KIND = { 'Gim Farms': 'farm', 'Bedrock Quarry': 'quarry', 'Pixel Park': 'park', 'Lazy Lagoon': 'beach', 'Sunny Shores': 'beach', 'Pleasant Pines': 'forest', 'Frosty Peaks': 'snow', 'Crater Camp': 'quarry', 'Dusty Diner': 'desert' };
    var towns = [{ name: 'Storm Tower', x: Math.round(C), y: Math.round(C), big: 1, kind: 'city' }];
    var ring = NAMES.length, a0 = r() * 6.28;
    for (var k = 0; k < ring; k++) { var aa = a0 + k / ring * 6.283 + (r() - 0.5) * 0.25, rr2 = RAD * (k % 2 ? 0.7 : 0.4) * (0.95 + r() * 0.08); towns.push({ name: NAMES[k], x: Math.round(C + Math.cos(aa) * rr2), y: Math.round(C + Math.sin(aa) * rr2), big: k === 0 ? 1 : 0, kind: KIND[NAMES[k]] || 'town' }); }
    // ---- biomes under the towns
    towns.forEach(function (t) {
      if (t.kind === 'beach') blob(t.x, t.y, 11, G.SAND, 0.3);
      else if (t.kind === 'desert') blob(t.x, t.y, 12, G.SAND, 0.35);
      else if (t.kind === 'snow') { blob(t.x, t.y, 13, G.SNOW, 0.3); blob(t.x + 3, t.y - 2, 3, G.ICE, 0.2); }
      else if (t.kind === 'quarry') { for (var q = 0; q < 70; q++) { var qa = r() * 6.28, qd = r() * 11; setG(Math.round(t.x + Math.cos(qa) * qd), Math.round(t.y + Math.sin(qa) * qd), G.STONE); } }
      else if (t.kind === 'park') { blob(t.x - 5, t.y - 4, 4, G.ICE, 0.15); }
    });
    // ---- roads: ring road + spokes + neighbours
    function road(x0, y0, x1, y1) { var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), lx = -1, ly = -1; for (var s2 = 0; s2 <= steps; s2++) { var t2 = steps ? s2 / steps : 0, xx = Math.round(x0 + (x1 - x0) * t2), yy = Math.round(y0 + (y1 - y0) * t2); if (xx === lx && yy === ly) continue; lx = xx; ly = yy; for (var oy = 0; oy <= 1; oy++) for (var ox = 0; ox <= 1; ox++) setG(xx + ox, yy + oy, G.PATH); } }
    function lroad(x0, y0, x1, y1) { if (r() < 0.5) { road(x0, y0, x1, y0); road(x1, y0, x1, y1); } else { road(x0, y0, x0, y1); road(x0, y1, x1, y1); } }
    var ringT = towns.slice(1).sort(function (p, q) { return Math.atan2(p.y - C, p.x - C) - Math.atan2(q.y - C, q.x - C); });
    for (k = 0; k < ringT.length; k++) { var A1 = ringT[k], B1 = ringT[(k + 1) % ringT.length]; lroad(A1.x, A1.y, B1.x, B1.y); if (k % 3 === 0) lroad(towns[0].x, towns[0].y, A1.x, A1.y); }
    // ---- buildings
    var occ = new Uint8Array(N);
    function free(x0, y0, x1, y1) { for (var yy = y0 - 3; yy <= y1 + 3; yy++) for (var xx = x0 - 3; xx <= x1 + 3; xx++) { if (!okG(xx, yy) || occ[yy * W + xx]) return false; } for (yy = y0; yy <= y1; yy++) for (xx = x0; xx <= x1; xx++) if (m.g[yy * W + xx] === G.PATH) return false; return true; }
    function house(x0, y0, w, h, name) {
      var x1 = x0 + w - 1, y1 = y0 + h - 1; if (!free(x0, y0, x1, y1)) return false;
      for (var yy = y0 - 1; yy <= y1 + 1; yy++) for (var xx = x0 - 1; xx <= x1 + 1; xx++) occ[yy * W + xx] = 1;
      for (yy = y0; yy <= y1; yy++) for (xx = x0; xx <= x1; xx++) m.g[yy * W + xx] = G.FLOOR;
      for (xx = x0; xx <= x1; xx++) { wall(m, xx, y0, 2, 0); wall(m, xx, y1, 2, 0); }
      for (yy = y0; yy <= y1; yy++) { wall(m, x0, yy, 2, 0); wall(m, x1, yy, 2, 0); }
      // doors (2 tiles wide on the long sides, 1 on the short), at least two of them
      var sides = [0, 1, 2, 3], nd = 2 + (w * h > 70 ? 1 : 0); for (var q4 = 3; q4 > 0; q4--) { var j4 = (r() * (q4 + 1)) | 0, t4 = sides[q4]; sides[q4] = sides[j4]; sides[j4] = t4; }
      for (var s3 = 0; s3 < nd; s3++) { var sd = sides[s3];
        if (sd < 2) { var dx2 = ri(x0 + 1, x1 - 2), yy2 = sd ? y1 : y0; m.w[yy2 * W + dx2] = 0; m.w[yy2 * W + dx2 + 1] = 0; }
        else { var dy2 = ri(y0 + 1, y1 - 1), xx2 = sd === 2 ? x0 : x1; m.w[dy2 * W + xx2] = 0; } }
      // big buildings get an inner wall with a doorway (rooms!)
      if (w >= 9 && h >= 6) { var mx = ri(x0 + 3, x1 - 3), gap = ri(y0 + 1, y1 - 2); for (yy = y0 + 1; yy < y1; yy++) if (yy !== gap && yy !== gap + 1) wall(m, mx, yy, 2, 0); }
      else if (h >= 8 && w >= 6) { var my = ri(y0 + 3, y1 - 3), gx = ri(x0 + 1, x1 - 2); for (xx = x0 + 1; xx < x1; xx++) if (xx !== gx && xx !== gx + 1) wall(m, xx, my, 2, 0); }
      m.houses.push({ x0: x0, y0: y0, x1: x1, y1: y1, name: name || '' });
      var cx2 = (x0 + x1) >> 1, cy2 = (y0 + y1) >> 1;
      var spot = function () { for (var t3 = 0; t3 < 20; t3++) { var sx = ri(x0 + 1, x1 - 1), sy = ri(y0 + 1, y1 - 1), si = sy * W + sx; if (!m.w[si]) return si; } return cy2 * W + cx2; };
      m.chestSpots.push(spot()); if (w * h > 48 || r() < 0.4) m.chestSpots.push(spot());
      m.lootSpots.push(spot(), spot()); if (w * h > 60) m.lootSpots.push(spot(), spot());
      return true;
    }
    towns.forEach(function (t) {
      m.pois.push({ name: t.name, x: t.x, y: t.y });
      var n = t.big ? 7 : t.kind === 'farm' || t.kind === 'quarry' ? 2 : t.kind === 'forest' ? 2 : 4 + ri(0, 1), placed = 0;
      if (t.kind === 'city' || t.big) rect(t.x - 4, t.y - 4, t.x + 4, t.y + 4, G.COBBLE);
      if (t.kind === 'farm') { for (var fy = -9; fy <= 9; fy++) for (var fx = -12; fx <= 12; fx++) if ((fx + 40) % 3 === 0 && Math.abs(fy) > 3) setG(t.x + fx, t.y + fy, G.PATH); }
      for (var tries = 0; placed < n && tries < 200; tries++) {
        var big = (t.big && placed < 3) || (t.kind === 'farm' && placed === 0) || (t.kind === 'quarry' && placed === 0);
        var w = big ? ri(10, 13) : ri(7, 9), h = big ? ri(7, 10) : ri(6, 8), sp2 = t.big ? 22 : 16;
        var hx = t.x + ri(-sp2, sp2) - (w >> 1), hy = t.y + ri(-sp2, sp2) - (h >> 1);
        if (Math.abs(hx + w / 2 - t.x) < 5 && Math.abs(hy + h / 2 - t.y) < 5) continue;
        if (house(hx, hy, w, h, placed === 0 ? t.name : '')) placed++;
      }
    });
    // a few lonely cabins in the wild
    for (k = 0; k < 8; k++) { var cxp = ri(12, W - 13), cyp = ri(12, H - 13); house(cxp, cyp, ri(6, 7), ri(5, 6), ''); }
    // ---- destructibles
    var used = {};
    function obj(kind, x2, y2) {
      var i2 = y2 * W + x2; if (!okG(x2, y2) || used[i2] || occ[i2] || m.w[i2] || m.g[i2] === G.PATH || m.g[i2] === G.FLOOR || m.obj[i2]) return false;
      if (used[i2 - 1] || used[i2 + 1] || used[i2 - W] || used[i2 + W]) return false;
      used[i2] = 1; m.obj[i2] = 9; m.rgObjs.push({ id: m.rgObjs.length + 1, i: i2, kind: kind }); return true;
    }
    function cluster(kinds, cx, cy, rad, n) { for (var k2 = 0, tr = 0; k2 < n && tr < n * 30; tr++) { var ca = r() * 6.28, cd = Math.sqrt(r()) * rad; if (obj(kinds[(r() * kinds.length) | 0], Math.round(cx + Math.cos(ca) * cd), Math.round(cy + Math.sin(ca) * cd))) k2++; } }
    towns.forEach(function (t) {
      if (t.kind === 'farm') cluster(['hay', 'hay', 'crate', 'barrel'], t.x, t.y, 15, 16);
      else if (t.kind === 'quarry') cluster(['rock', 'rock', 'rock', 'crate', 'barrel'], t.x, t.y, 15, 20);
      else if (t.kind === 'forest') cluster(['pine', 'pine', 'tree', 'bush'], t.x, t.y, 17, 36);
      else if (t.kind === 'snow') cluster(['pine', 'pine', 'rock'], t.x, t.y, 16, 20);
      else if (t.kind === 'beach') cluster(['bush', 'barrel', 'crate', 'rock'], t.x, t.y, 14, 9);
      else if (t.kind === 'desert') cluster(['rock', 'barrel', 'bush'], t.x, t.y, 14, 10);
      else if (t.kind === 'park') cluster(['tree', 'tree', 'bush', 'bush'], t.x, t.y, 15, 18);
      else cluster(['crate', 'barrel', 'crate', 'bush', 'tree'], t.x, t.y, 20, 12);
    });
    // big forests between towns
    for (k = 0; k < 7; k++) { var fa = r() * 6.28, fd = RAD * (0.25 + r() * 0.6); cluster(['tree', 'pine', 'tree', 'bush', 'rock'], C + Math.cos(fa) * fd, C + Math.sin(fa) * fd, 10 + ri(0, 5), 26); }
    // everywhere else
    for (var e2 = 0, tr2 = 0; e2 < 200 && tr2 < 9000; tr2++) { var ex = ri(4, W - 5), ey = ri(4, H - 5), gk = m.g[ey * W + ex]; var kinds = gk === G.SAND ? ['bush', 'rock', 'barrel'] : gk === G.SNOW ? ['pine', 'rock'] : ['tree', 'pine', 'bush', 'rock', 'bush']; if (obj(kinds[(r() * kinds.length) | 0], ex, ey)) e2++; }
    // loot in the open
    for (var lk = 0; lk < 140; lk++) { var lx = ri(6, W - 7), ly = ri(6, H - 7), li = ly * W + lx; if (okG(lx, ly) && !m.obj[li] && !m.w[li]) m.lootSpots.push(li); }
    // vehicles parked on roads
    function roomy(i3) { var x3 = i3 % W, y3 = (i3 / W) | 0; for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) { var j3 = (y3 + oy) * W + x3 + ox; if (!inb(x3 + ox, y3 + oy) || !m.g[j3] || m.g[j3] === G.ROCK || m.w[j3] || m.obj[j3] || occ[j3]) return false; } return true; }
    var roadT = []; for (i = 0; i < N; i++) if (m.g[i] === G.PATH && roomy(i)) roadT.push(i);
    for (k = 0; k < 60 && roadT.length && m.vehSpots.length < 14; k++) { var vi = roadT[(r() * roadT.length) | 0]; if (m.vehSpots.every(function (o) { return Math.abs(o % W - vi % W) + Math.abs(((o / W) | 0) - ((vi / W) | 0)) > 9; })) m.vehSpots.push(vi); }
    for (i = 0; i < N; i++) { m.noBuild[i] = 1; m.noMine[i] = 1; }
    var c0 = { x: tcx(C), y: tcx(C) };
    m.bases = []; for (var t2 = 0; t2 < 8; t2++) m.bases.push({ team: t2, cx: Math.round(C), cy: Math.round(C), spawn: c0, inward: [0, 1], right: [1, 0], rect: [0, 0, 0, 0] });
    return m;
  };
  M.rObjAt = function (m, i) { if (!m.rgIdx) { m.rgIdx = {}; (m.rgObjs || []).forEach(function (o) { m.rgIdx[o.i] = o; }); } return m.rgIdx[i] || null; };
  // ================================================================ BUILD BATTLE
  M.BB_THEMES = ['Castle', 'Garden', 'Farm', 'Snowy Day', 'Spooky Night', 'Cozy House', 'Market Stall', 'Campsite', 'Pirate Island', 'Birthday Party', 'Zoo', 'Robot'];
  M.BB_GROUNDS = [G.GRASS, G.STONE, G.PATH, G.COBBLE, G.FLOOR, G.SNOW, G.MID, G.ICE, G.CANDY, G.SAND, G.BRICK, 0];
  M.BB_WALLS = [1, 2, 3, 4];
  M.PLOT = 13;
  M.genBuild = function () {
    var m = blank(); m.game = 'build'; m.plots = []; m.props = [];
    fill(m, 12, 13, 60, 55, G.GRASS, true);
    fill(m, 13, 12, 59, 56, G.GRASS, true);
    disc(m, 36, 34, 4, G.MID);
    var P = M.PLOT;
    [[16, 16], [43, 16], [16, 39], [43, 39]].forEach(function (q, k) {
      var x0 = q[0], y0 = q[1], x1 = x0 + P - 1, y1 = y0 + P - 1;
      fill(m, x0 - 1, y0 - 1, x1 + 1, y1 + 1, G.COBBLE);
      fill(m, x0, y0, x1, y1, G.FLOOR);
      m.plots.push({ x0: x0, y0: y0, x1: x1, y1: y1 });
      m.bases.push({ team: k, cx: (x0 + x1) >> 1, cy: y1 + 2, inward: [0, -1], right: [1, 0], spawn: { x: tcx((x0 + x1) >> 1), y: tcx(y1 + 2) }, rect: [x0, y0, x1, y1] });
    });
    for (var t = 4; t < 8; t++) m.bases.push(m.bases[t - 4]);
    for (var i = 0; i < N; i++) { m.noBuild[i] = 1; m.noMine[i] = 1; }
    return m;
  };
  M.inPlot = function (m, plot, i) { var p = m.plots[plot]; if (!p) return false; var x = i % W, y = (i / W) | 0; return x >= p.x0 && x <= p.x1 && y >= p.y0 && y <= p.y1; };

  M.genMap = function (game, seed, custom) { if (game !== 'royale' && game !== 'bw') B.setDims(72, 72); if (custom) return M.buildCustom(custom); return game === 'ctf' ? M.genCTF(seed) : game === 'spleef' ? M.genSpleef(seed) : game === 'hide' ? M.genHide(seed) : game === 'duel' ? M.genDuel(seed) : game === 'murder' ? M.genMurder(seed) : game === 'build' ? M.genBuild(seed) : game === 'royale' ? M.genRoyale(seed) : B.genMap(); };

  // Hotbar per game.
  M.hotbar = function (game, inv, role) {
    if (game === 'spleef') { var o = ['shovel']; if (inv.snow > 0) o.push('snow'); return o; }
    if (game === 'hide') return role === 1 ? ['sword', 'radar'] : ['mask', 'taunt'];
    if (game === 'duel') return ['sword'];
    if (game === 'murder') { var o2 = ['fists']; if (role === 'm') o2.push('knife'); if (inv.bow > 0) o2.push('bow'); return o2; }
    if (game === 'build') return ['fists'];
    if (game === 'royale') return ['pickaxe'];
    return B.hotbar(inv);
  };
  root.MG = M;
})(typeof window !== 'undefined' ? window : globalThis);
