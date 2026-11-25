/* ============================================================
   Bedwars 2D — shared rules. Loaded by the browser (window.BW) and by the
   server (bedwars.js imports this file for its side effect: globalThis.BW).
   Map layout, blocks, items, shop catalog, team upgrades, collision.
   ============================================================ */
(function (root) {
  var B = {};
  var T = B.T = 40;           // tile size (px)
  var W = B.W = 72, H = B.H = 72;
  // Most maps are 72x72; Scroll Royale's island is much bigger. Every module re-reads the size through onDims.
  var dimL = [];
  B.onDims = function (f) { dimL.push(f); };
  B.setDims = function (w, h) { w = w || 72; h = h || w; if (w === W && h === H) return; W = B.W = w; H = B.H = h; for (var i = 0; i < dimL.length; i++) dimL[i](w, h); };
  B.useMap = function (m) { B.setDims(m && m.W || 72, m && m.H || 72); };
  B.R = 12;                    // player collision half-size vs solid things
  B.EDGE_R = 5;                // how close your center may get to the void when walking
  B.SPEED = 200;               // walk px/s
  B.REACH = 150;               // px from player to a tile center for placing / mining
  B.MELEE = 74;                // sword reach (px)
  B.ARC = 1.15;                // sword half-angle (rad)
  B.MAX_HP = 20;

  B.TEAMS = [
    { key: 'red', name: 'Red', color: '#ff4b5c', dark: '#a8192b', light: '#ffb3bb' },
    { key: 'blue', name: 'Blue', color: '#3fa9ff', dark: '#1d5fa8', light: '#b9e0ff' },
    { key: 'green', name: 'Green', color: '#2bd576', dark: '#14874a', light: '#b5f5cf' },
    { key: 'yellow', name: 'Yellow', color: '#ffc93c', dark: '#b07d00', light: '#fff0b8' },
  ];
  B.MODES = {
    solo: { key: 'solo', name: 'Solo', per: 1, desc: '4 teams of 1' },
    duos: { key: 'duos', name: 'Duos', per: 2, desc: '4 teams of 2' },
    squads: { key: 'squads', name: 'Squads', per: 4, desc: '4 teams of 4' },
  };
  B.DIFFS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

  // ground types (unbreakable map)
  var G = B.G = { VOID: 0, GRASS: 1, STONE: 2, MID: 3, PATH: 4, ROCK: 5, PAD: 6 };
  // placeable blocks
  B.BLOCKS = {
    1: { id: 'wool', name: 'Wool', hard: 0.55, blast: true },
    2: { id: 'wood', name: 'Oak Planks', hard: 1.7, blast: true },
    3: { id: 'end', name: 'End Stone', hard: 3.0, blast: false },
    4: { id: 'obby', name: 'Obsidian', hard: 12, blast: false },
  };
  B.BLOCK_OF = { wool: 1, wood: 2, end: 3, obby: 4 };
  B.BED_HARD = 1.6;

  // ---- items ---------------------------------------------------------------
  B.SWORDS = [null,
    { name: 'Wooden Sword', dmg: 4, color: '#b98a4e' },
    { name: 'Stone Sword', dmg: 5, color: '#9aa3b5' },
    { name: 'Iron Sword', dmg: 6, color: '#eef2fb' },
    { name: 'Diamond Sword', dmg: 7.5, color: '#5ff0e6' }];
  B.ARMORS = [null,
    { name: 'Leather Armor', red: 0.10 },
    { name: 'Chainmail Armor', red: 0.26, color: '#8a93a6' },
    { name: 'Iron Armor', red: 0.40, color: '#dfe5f1' },
    { name: 'Diamond Armor', red: 0.55, color: '#5ff0e6' }];
  B.PICKS = [
    { name: 'Hand', speed: 1 },
    { name: 'Wooden Pickaxe', speed: 1.8, color: '#b98a4e' },
    { name: 'Iron Pickaxe', speed: 2.6, color: '#eef2fb' },
    { name: 'Golden Pickaxe', speed: 3.3, color: '#ffd23f' },
    { name: 'Diamond Pickaxe', speed: 4.2, color: '#5ff0e6' }];
  B.ITEM_NAMES = {
    sword: 'Sword', kbstick: 'Knockback Stick', wool: 'Wool', wood: 'Oak Planks', end: 'End Stone', obby: 'Obsidian',
    pick: 'Pickaxe', bow: 'Bow', fireball: 'Fireball', tnt: 'TNT', gapple: 'Golden Apple', pearl: 'Ender Pearl',
    egg: 'Bridge Egg', speed: 'Speed Potion',
  };
  B.HOTBAR_ORDER = ['sword', 'kbstick', 'wool', 'wood', 'end', 'obby', 'pick', 'bow', 'fireball', 'tnt', 'gapple', 'pearl', 'egg', 'speed'];
  B.RES = ['iron', 'gold', 'dia', 'em'];
  B.RES_NAMES = { iron: 'Iron', gold: 'Gold', dia: 'Diamond', em: 'Emerald' };
  B.RES_COLORS = { iron: '#e8edf5', gold: '#ffcf3f', dia: '#5ff0e6', em: '#2bd576' };

  // ---- shop ----------------------------------------------------------------
  B.SHOP_CATS = [
    { key: 'quick', name: 'Quick Buy', icon: 'star' },
    { key: 'blocks', name: 'Blocks', icon: 'wool' },
    { key: 'melee', name: 'Melee', icon: 'sword' },
    { key: 'armor', name: 'Armor', icon: 'armor' },
    { key: 'tools', name: 'Tools', icon: 'pick' },
    { key: 'ranged', name: 'Ranged', icon: 'bow' },
    { key: 'util', name: 'Utility', icon: 'fireball' },
  ];
  B.SHOP = [
    { id: 'wool', cat: 'blocks', name: 'Wool ×16', desc: 'Cheap blocks for bridging and quick walls.', give: { wool: 16 }, cost: { iron: 4 }, icon: 'wool', quick: 1 },
    { id: 'wood', cat: 'blocks', name: 'Oak Planks ×16', desc: 'Three times tougher than wool.', give: { wood: 16 }, cost: { gold: 4 }, icon: 'wood', quick: 1 },
    { id: 'end', cat: 'blocks', name: 'End Stone ×12', desc: 'Blast-proof. Fireballs and TNT can’t break it.', give: { end: 12 }, cost: { iron: 24 }, icon: 'end', quick: 1 },
    { id: 'obby', cat: 'blocks', name: 'Obsidian ×4', desc: 'Takes forever to mine. The ultimate bed defense.', give: { obby: 4 }, cost: { em: 4 }, icon: 'obby' },
    { id: 'sword2', cat: 'melee', name: 'Stone Sword', desc: '5 damage. Replaces your wooden sword.', sword: 2, cost: { iron: 10 }, icon: 'sword2', quick: 1 },
    { id: 'sword3', cat: 'melee', name: 'Iron Sword', desc: '6 damage.', sword: 3, cost: { gold: 7 }, icon: 'sword3', quick: 1 },
    { id: 'sword4', cat: 'melee', name: 'Diamond Sword', desc: '7.5 damage. Shreds armor.', sword: 4, cost: { em: 4 }, icon: 'sword4' },
    { id: 'kbstick', cat: 'melee', name: 'Knockback Stick', desc: 'Barely hurts — sends people flying into the void.', give: { kbstick: 1 }, cost: { gold: 5 }, icon: 'kbstick', max: 1 },
    { id: 'armor2', cat: 'armor', name: 'Chainmail Armor', desc: 'Permanent. Blocks 26% of damage.', armor: 2, cost: { iron: 24 }, icon: 'armor2', quick: 1 },
    { id: 'armor3', cat: 'armor', name: 'Iron Armor', desc: 'Permanent. Blocks 40% of damage.', armor: 3, cost: { gold: 12 }, icon: 'armor3', quick: 1 },
    { id: 'armor4', cat: 'armor', name: 'Diamond Armor', desc: 'Permanent. Blocks 55% of damage.', armor: 4, cost: { em: 6 }, icon: 'armor4' },
    { id: 'pick', cat: 'tools', name: 'Pickaxe', desc: 'Mine blocks faster. Drops one tier when you die.', pickTiers: [{ iron: 10 }, { iron: 10 }, { gold: 3 }, { gold: 6 }], icon: 'pick', quick: 1 },
    { id: 'bow', cat: 'ranged', name: 'Bow', desc: 'Hold to charge, release to fire. Comes with 8 arrows.', give: { bow: 1, arrows: 8 }, cost: { gold: 12 }, icon: 'bow', max: 1 },
    { id: 'arrows', cat: 'ranged', name: 'Arrows ×8', desc: 'Ammo for your bow.', give: { arrows: 8 }, cost: { gold: 2 }, icon: 'arrows' },
    { id: 'gapple', cat: 'util', name: 'Golden Apple', desc: 'Heals 8 hearts over a few seconds + absorption.', give: { gapple: 1 }, cost: { gold: 3 }, icon: 'gapple', quick: 1 },
    { id: 'fireball', cat: 'util', name: 'Fireball', desc: 'Explodes on impact: big knockback, breaks wool & wood.', give: { fireball: 1 }, cost: { iron: 40 }, icon: 'fireball', quick: 1 },
    { id: 'tnt', cat: 'util', name: 'TNT', desc: 'Place it, run. Blows up wool and wood defenses.', give: { tnt: 1 }, cost: { gold: 4 }, icon: 'tnt', quick: 1 },
    { id: 'egg', cat: 'util', name: 'Bridge Egg', desc: 'Throw it — it leaves a wool bridge behind.', give: { egg: 1 }, cost: { em: 1 }, icon: 'egg' },
    { id: 'pearl', cat: 'util', name: 'Ender Pearl', desc: 'Throw and teleport where it lands. Don’t miss!', give: { pearl: 1 }, cost: { em: 4 }, icon: 'pearl' },
    { id: 'speed', cat: 'util', name: 'Speed Potion', desc: '+35% speed for 30 seconds.', give: { speed: 1 }, cost: { em: 1 }, icon: 'speed' },
  ];
  B.SHOP_BY_ID = {}; B.SHOP.forEach(function (s) { B.SHOP_BY_ID[s.id] = s; });

  B.UPGRADES = [
    { id: 'sharp', name: 'Sharpened Swords', desc: 'Your whole team deals +1.25 sword damage.', costs: [4], icon: 'sword4' },
    { id: 'prot', name: 'Reinforced Armor', desc: 'Team takes 6% less damage per level.', costs: [2, 4, 8, 16], icon: 'armor3' },
    { id: 'forge', name: 'Iron Forge', desc: '+50% / +100% resources. Level 3 adds emeralds. Level 4: +200%.', costs: [2, 4, 6, 8], icon: 'forge' },
    { id: 'haste', name: 'Maniac Miner', desc: 'Team mines 30% faster per level.', costs: [2, 4], icon: 'pick' },
    { id: 'heal', name: 'Heal Pool', desc: 'Your team regenerates health near your base.', costs: [1], icon: 'heal' },
    { id: 'trap', name: 'It’s a Trap!', desc: 'The next enemy to enter your base is slowed and revealed.', costs: [1], icon: 'trap', repeat: true },
  ];
  B.UP_BY_ID = {}; B.UPGRADES.forEach(function (u) { B.UP_BY_ID[u.id] = u; });

  // Generators: seconds per drop and pile caps.
  B.GEN = {
    iron: { every: 1.15, cap: 48 },
    gold: { every: 6.5, cap: 14 },
    dia: { every: [30, 22, 15], cap: 4 },
    em: { every: [50, 38, 26], cap: 3 },
    forgeMult: [1, 1.5, 2, 2, 3],
  };
  B.TIMELINE = [
    { t: 180, ev: 'dia2', text: 'Diamond generators upgraded to Tier II' },
    { t: 360, ev: 'em2', text: 'Emerald generators upgraded to Tier II' },
    { t: 540, ev: 'dia3', text: 'Diamond generators upgraded to Tier III' },
    { t: 720, ev: 'em3', text: 'Emerald generators upgraded to Tier III' },
    { t: 900, ev: 'beds', text: 'All beds have been destroyed!' },
    { t: 1200, ev: 'end', text: 'Game over' },
  ];
  B.RESPAWN = 5;

  // ---- map -----------------------------------------------------------------
  // Four team islands (N/E/S/W), four diamond islands on the diagonals, emerald mid.
  B.BW_SIZE = 110;
  B.genMap = function (size) {
    B.setDims(size || B.BW_SIZE, size || B.BW_SIZE);
    var N = W * H, C = (W / 2) | 0, D = W <= 72 ? 29 : C - 11; // island distance from the middle
    var m = { W: W, H: H, g: new Uint8Array(N), f: new Uint8Array(N), fc: new Uint8Array(N), w: new Uint8Array(N), wc: new Uint8Array(N), obj: new Uint8Array(N), noBuild: new Uint8Array(N), beds: [], gens: [], npcs: [], bases: [] };
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < W && y < H) m.g[y * W + x] = v; }
    var OUT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (var t = 0; t < 4; t++) {
      var o = OUT[t], dx = -o[0], dy = -o[1], rx = -dy, ry = dx;
      var cx = C + o[0] * D, cy = C + o[1] * D;
      var L = (function (cx, cy, dx, dy, rx, ry) { return function (a, b) { return [cx + a * rx + b * dx, cy + a * ry + b * dy]; }; })(cx, cy, dx, dy, rx, ry);
      var a, b, p;
      for (a = -7; a <= 7; a++) for (b = -5; b <= 6; b++) {
        var aa = Math.abs(a);
        if (aa === 7 && (b === -5 || b === 6)) continue;          // rounded corners
        if (aa >= 6 && b === 6) continue;
        if (aa === 7 && b === 5) continue;
        p = L(a, b); set(p[0], p[1], G.GRASS);
      }
      for (b = -2; b <= 6; b++) { p = L(0, b); set(p[0], p[1], G.PATH); }
      for (a = -6; a <= 6; a++) { if (Math.abs(a) > 1 && (a + 40) % 3 === 0) { p = L(a, 4); set(p[0], p[1], G.COBBLE); } }
      for (a = -1; a <= 1; a++) for (b = -4; b <= -2; b++) { p = L(a, b); set(p[0], p[1], G.PAD); }
      var gp = L(0, -3), sp = L(0, -1), bf = L(0, 2), bh = L(0, 3), sh = L(-5, -2), up = L(5, -2);
      var base = { team: t, cx: cx, cy: cy, out: o, inward: [dx, dy], right: [rx, ry],
        spawn: { x: sp[0] * T + T / 2, y: sp[1] * T + T / 2 },
        gen: { x: gp[0] * T + T / 2, y: gp[1] * T + T / 2 },
        // the area your trap / heal pool covers (tile rect)
        rect: [Math.min(L(-7, -5)[0], L(7, 6)[0]), Math.min(L(-7, -5)[1], L(7, 6)[1]), Math.max(L(-7, -5)[0], L(7, 6)[0]), Math.max(L(-7, -5)[1], L(7, 6)[1])],
        flag: L(-2, -4), flag2: L(2, -4) };
      m.bases.push(base);
      var fi = bf[1] * W + bf[0], hi = bh[1] * W + bh[0];
      m.beds.push({ team: t, foot: fi, head: hi, x: (bf[0] + bh[0] + 1) * T / 2, y: (bf[1] + bh[1] + 1) * T / 2, dir: [dx, dy], alive: true });
      m.obj[fi] = 1; m.obj[hi] = 1;
      m.gens.push({ kind: 'iron', team: t, x: base.gen.x - 9, y: base.gen.y, tile: gp[1] * W + gp[0] });
      m.gens.push({ kind: 'gold', team: t, x: base.gen.x + 9, y: base.gen.y, tile: gp[1] * W + gp[0] });
      m.gens.push({ kind: 'em', team: t, base: true, x: base.gen.x, y: base.gen.y - 2, tile: gp[1] * W + gp[0] });
      [[sh, 'shop'], [up, 'up']].forEach(function (q) { var i = q[0][1] * W + q[0][0]; m.obj[i] = 2; m.npcs.push({ kind: q[1], team: t, tile: i, x: q[0][0] * T + T / 2, y: q[0][1] * T + T / 2 + 10 }); });
      for (a = -1; a <= 1; a++) for (b = -4; b <= -2; b++) { p = L(a, b); m.noBuild[p[1] * W + p[0]] = 1; }
    }
    // diamond islands
    var dq = Math.round(D * 0.62);
    [[C - dq, C - dq], [C + dq, C - dq], [C - dq, C + dq], [C + dq, C + dq]].forEach(function (c) {
      for (var y = -3; y <= 3; y++) for (var x = -3; x <= 3; x++) { if (Math.abs(x) + Math.abs(y) > 4) continue; set(c[0] + x, c[1] + y, G.STONE); }
      m.gens.push({ kind: 'dia', x: c[0] * T + T / 2, y: c[1] * T + T / 2, tile: c[1] * W + c[0] });
      m.noBuild[c[1] * W + c[0]] = 1;
    });
    // mid
    for (var y = -9; y <= 9; y++) for (var x = -9; x <= 9; x++) {
      var ax = Math.abs(x), ay = Math.abs(y);
      if (ax + ay > 13) continue;
      set(C + x, C + y, G.MID);
    }
    [[-4, -4], [4, -4], [-4, 4], [4, 4], [-7, 0], [7, 0], [0, -7], [0, 7]].forEach(function (d) { set(C + d[0], C + d[1], G.ROCK); });
    [[0, -3], [0, 3]].forEach(function (d) {
      m.gens.push({ kind: 'em', x: (C + d[0]) * T + T / 2, y: (C + d[1]) * T + T / 2, tile: (C + d[1]) * W + C + d[0] });
      m.noBuild[(C + d[1]) * W + C + d[0]] = 1;
    });
    for (var i = 0; i < N; i++) { var tx = i % W, ty = (i / W) | 0; if (tx < 2 || ty < 2 || tx >= W - 2 || ty >= H - 2) m.noBuild[i] = 1; }
    return m;
  };

  // ---- the Games hub: a walkable lobby of floating islands -----------------
  function blankMap() { var N = W * H; return { W: W, H: H, g: new Uint8Array(N), f: new Uint8Array(N), fc: new Uint8Array(N), w: new Uint8Array(N), wc: new Uint8Array(N), obj: new Uint8Array(N), noBuild: new Uint8Array(N), beds: [], gens: [], npcs: [], bases: [], objs: [] }; }
  function fill(m, x0, y0, x1, y1, v, round) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      if (round && (x === x0 || x === x1) && (y === y0 || y === y1)) continue;
      m.g[y * W + x] = v;
    }
  }
  function disc(m, cx, cy, r, v) { for (var y = -r; y <= r; y++) for (var x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) m.g[(cy + y) * W + cx + x] = v; }
  function obj(m, o, solidTiles) {
    o.x = o.tx * T + T / 2; o.y = o.ty * T + T / 2 + (o.dy || 0);
    m.objs.push(o);
    (solidTiles || [[o.tx, o.ty]]).forEach(function (p) { m.obj[p[1] * W + p[0]] = 3; });
    return o;
  }
  B.HUB_W = 144; B.HUB_OFF = { x: 36, y: 36 };   // the old 72x72 town sits in the middle of the big world
  B.HUB_SPAWN = { x: (36 + 36) * T + T / 2, y: (43 + 36) * T + T / 2 };
  // One big Minecraft-style hub continent: every game portal in one plaza row
  // (signs BEHIND the portals), leaderboard corner, casino gate, park.
  function genCore(opts) {
    var LITE = !!(opts && opts.lite);
    var m = blankMap();
    var G2 = B.G;
    // elliptical continent
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var nx = (x - 36) / 32.5, ny = (y - 37) / 29.5;
      if (nx * nx + ny * ny <= 1) m.g[y * W + x] = G2.GRASS;
    }
    // roads
    fill(m, 35, 19, 37, 52, G2.PATH);
    fill(m, 8, 30, 64, 31, G2.PATH);
    fill(m, 13, 40, 59, 41, G2.PATH);
    // spawn plaza
    disc(m, 36, 40, 9, G2.COBBLE);
    disc(m, 36, 40, 7, G2.MID);
    obj(m, { kind: 'fountain', tx: 36, ty: 39, dy: 20 }, [[35, 38], [36, 38], [35, 39], [36, 39]]);
    [[30, 35], [42, 35], [30, 45], [42, 45]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    [[32, 34], [40, 34]].forEach(function (p, k) { obj(m, { kind: 'flag', tx: p[0], ty: p[1], team: k }); });
    [[32, 46], [40, 46]].forEach(function (p, k) { obj(m, { kind: 'flag', tx: p[0], ty: p[1], team: k + 2 }); });
    obj(m, { kind: 'sign', tx: 33, ty: 44, text: 'WELCOME!', lines: ['All games: north ⬆', 'Leaderboards: west', 'Casino: east'], dy: 10 }, [[33, 44]]);
    obj(m, { kind: 'npc', tx: 40, ty: 30, act: 'skinshop', game: 'bw', mode: 'bw', label: 'SKIN SHOP', sub: 'skins & more', look: { skin: 'fox', body: '#ff6ec7', hat: 'crown', acc: 'orbs' } });
    obj(m, { kind: 'npc', tx: 39, ty: 44, act: 'how', game: 'bw', mode: 'bw', label: 'GAME GUIDE', sub: 'how to play everything', look: { skin: 'penguin', body: '#4a4f6a', hat: 'wizard' } });
    // ---- the PORTAL HALL: all 7 game portals side by side in one plaza.
    // Walk straight into a portal to play; the name banner stands BEHIND each one.
    fill(m, 12, 15, 66, 26, G2.COBBLE);
    fill(m, 13, 16, 65, 25, G2.MID);
    fill(m, 35, 26, 37, 32, G2.PATH);
    var ports = [
      { g: 'spleef', tx: 16, ty: 21 }, { g: 'ctf', tx: 22, ty: 21 }, { g: 'hide', tx: 28, ty: 21 }, { g: 'bw', tx: 34, ty: 21 },
      { g: 'royale', tx: 40, ty: 21 }, { g: 'murder', tx: 46, ty: 21 }, { g: 'duel', tx: 52, ty: 21 }, { g: 'build', tx: 58, ty: 21 }, { g: 'race', tx: 64, ty: 21 },
    ];
    B.HUB_PORTS = ports;
    ports.forEach(function (q) {
      var names = { bw: 'BEDWARS', ctf: 'CAPTURE FLAG', spleef: 'TNT SPLEEF', hide: 'PROP HUNT', duel: 'DUELS', murder: 'MURDER', build: 'BUILD BATTLE', royale: 'SCROLL ROYAL', race: 'SCROLL RACING' };
      fill(m, q.tx - 1, q.ty, q.tx + 1, q.ty + 1, G2.PAD);
      // the name banner stands BEHIND (north of) the portal
      obj(m, { kind: 'banner', tx: q.tx, ty: q.ty - 2, text: names[q.g], game: q.g, small: true }, [[q.tx - 2, q.ty - 2], [q.tx + 2, q.ty - 2]]);
      // portals are NOT solid: you walk into them
      obj(m, { kind: 'gport', tx: q.tx, ty: q.ty, game: q.g, act: 'gmenu', walk: true }, []);
    });
    [[13, 16], [65, 16], [13, 25], [65, 25], [21, 25], [27, 25], [33, 25], [39, 25], [45, 25], [51, 25], [57, 25], [63, 25]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    obj(m, { kind: 'sign', tx: 33, ty: 28, text: 'PORTAL HALL', lines: ['Walk into a portal', 'to start playing!', 'E = more options'], dy: 10 }, [[33, 28]]);
    obj(m, { kind: 'bedDeco', tx: 40, ty: 28 }, [[40, 27], [40, 28]]);
    // ---- leaderboard plaza (west)
    disc(m, 13, 41, 6, G2.COBBLE);
    fill(m, 12, 43, 14, 43, G2.PAD);
    obj(m, { kind: 'board', tx: 13, ty: 38, act: 'lb', dy: 20 }, [[11, 38], [12, 38], [13, 38], [14, 38], [15, 38]]);
    obj(m, { kind: 'podium', tx: 13, ty: 44 }, [[12, 44], [13, 44], [14, 44]]);
    [[8, 38], [18, 38]].forEach(function (p, k) { obj(m, { kind: 'flag', tx: p[0], ty: p[1], team: k ? 1 : 3 }); });
    [[9, 45], [17, 45]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    // ---- casino gate (east)
    disc(m, 59, 41, 6, G2.STONE);
    obj(m, { kind: 'portal', tx: 59, ty: 40, act: 'casino', label: 'SCROLLS CASINO', dy: 18 }, [[58, 40], [59, 40], [60, 40]]);
    [[55, 45], [63, 45]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    // ---- map builder hut (south-east)
    fill(m, 52, 52, 58, 56, G2.FLOOR);
    obj(m, { kind: 'npc', tx: 55, ty: 56, act: 'sprites', game: 'bw', mode: 'bw', label: 'SPRITE STUDIO', sub: 'draw gims & hats', look: { skin: 'gim', body: '#ffd166', hat: 'wizard' } });
    obj(m, { kind: 'board', tx: 55, ty: 53, act: 'builder', title: 'MAP BUILDER', lines: ['Make your own maps!', 'Owner: Scrollreader11'], dy: 14 }, [[53, 53], [54, 53], [55, 53], [56, 53], [57, 53]]);
    // ---- park (south-west): crystal pond + goodies
    [[27, 52, 'bush'], [17, 52, 'pot'], [27, 58, 'stool'], [17, 58, 'barrel'], [30, 55, 'mailbox']].forEach(function (p) { obj(m, { kind: 'deco', tx: p[0], ty: p[1], what: p[2] }); });
    [[42, 52, 'pumpkin'], [45, 54, 'hay'], [42, 56, 'pumpkin'], [46, 51, 'crate'], [48, 56, 'snowman'], [36, 57, 'trash']].forEach(function (p) { obj(m, { kind: 'deco', tx: p[0], ty: p[1], what: p[2] }); });

    if (!LITE) {
    // ================= HUB REBUILD: castle, lake, villages, farm, market, camp, stars, holograms =================
    function water(cx, cy, r) { disc(m, cx, cy, r, G2.WATER); for (var yy = cy - r; yy <= cy + r; yy++) for (var xx = cx - r; xx <= cx + r; xx++) if (m.g[yy * W + xx] === G2.WATER) m.obj[yy * W + xx] = 3; }
    function solid(list, tx, ty, w, h) { for (var yy = ty; yy < ty + h; yy++) for (var xx = tx; xx < tx + w; xx++) list.push([xx, yy]); return list; }
    // the lake in the south-west with a sandy shore and a fishing dock
    disc(m, 22, 57, 6, G2.SAND); water(22, 57, 4);
    fill(m, 26, 56, 31, 57, G2.FLOOR);            // dock planks reach out over the water
    m.g[56 * W + 25] = G2.FLOOR; m.g[57 * W + 25] = G2.FLOOR; m.obj[56 * W + 25] = 0; m.obj[57 * W + 25] = 0; m.g[56 * W + 26] = G2.FLOOR; m.obj[56 * W + 26] = 0; m.obj[57 * W + 26] = 0;
    obj(m, { kind: 'fishspot', tx: 25, ty: 57, act: 'fish', label: 'FISHING DOCK', dy: 6 }, []);
    obj(m, { kind: 'boat', tx: 21, ty: 59, dy: 4 }, []);
    obj(m, { kind: 'lily', tx: 19, ty: 56 }, []); obj(m, { kind: 'lily', tx: 24, ty: 60 }, []); obj(m, { kind: 'lily', tx: 20, ty: 54 }, []);
    obj(m, { kind: 'holo', tx: 28, ty: 55, dy: -36, src: 'fish', lines: ['FISHING DOCK', 'Press E to cast a line'] }, []);
    // the castle behind the portal hall
    fill(m, 28, 12, 44, 14, G2.COBBLE); fill(m, 29, 11, 43, 11, G2.COBBLE); fill(m, 35, 13, 37, 19, G2.PATH);
    obj(m, { kind: 'castle', tx: 36, ty: 12, dy: 18 }, solid([], 31, 11, 11, 2));
    obj(m, { kind: 'holo', tx: 36, ty: 8, dy: -4, src: 'welcome', lines: [] }, []);
    // west: windmill farm
    fill(m, 5, 31, 11, 34, G2.FARM);
    obj(m, { kind: 'windmill', tx: 8, ty: 29, dy: 16 }, solid([], 7, 28, 2, 2));
    [[5, 29], [10, 28], [5, 35], [11, 35]].forEach(function (p) { obj(m, { kind: 'deco', tx: p[0], ty: p[1], what: ['hay', 'pumpkin', 'bush', 'crate'][(p[0] + p[1]) % 4] }); });
    obj(m, { kind: 'holo', tx: 8, ty: 27, dy: -150, src: 'static', lines: ['WINDMILL FARM', 'Fresh scrolls daily'] }, []);
    // villages: west cottages and the east neighbourhood
    [[6, 38, 0], [6, 44, 2], [20, 28, 4]].forEach(function (h) { obj(m, { kind: 'house', tx: h[0], ty: h[1], roof: h[2], dy: 14 }, solid([], h[0] - 1, h[1] - 1, 3, 2)); });
    [[61, 29, 1], [66, 30, 3], [66, 36, 5], [61, 50, 6], [66, 44, 0]].forEach(function (h) { obj(m, { kind: 'house', tx: h[0], ty: h[1], roof: h[2], dy: 14 }, solid([], h[0] - 1, h[1] - 1, 3, 2)); });
    obj(m, { kind: 'well', tx: 63, ty: 33, dy: 10 }, [[63, 33]]);
    obj(m, { kind: 'holo', tx: 64, ty: 28, dy: -10, src: 'static', lines: ['EAST VILLAGE', 'Casino gate is just south'] }, []);
    obj(m, { kind: 'holo', tx: 6, ty: 36, dy: -70, src: 'static', lines: ['WEST COTTAGES'] }, []);
    // market stalls along the main road
    [[22, 34, 0], [27, 34, 1], [45, 34, 2], [50, 34, 3]].forEach(function (p) { obj(m, { kind: 'stall', tx: p[0], ty: p[1], col: p[2], dy: 12 }, solid([], p[0] - 1, p[1], 2, 1)); });
    obj(m, { kind: 'holo', tx: 36, ty: 32, dy: -30, src: 'tips', lines: [] }, []);
    // the campfire camp in the south
    disc(m, 36, 55, 3, G2.SAND);
    obj(m, { kind: 'campfire', tx: 36, ty: 55, dy: 8 }, [[36, 55]]);
    obj(m, { kind: 'bench', tx: 33, ty: 55, dy: 8 }, [[33, 55]]); obj(m, { kind: 'bench', tx: 39, ty: 55, dy: 8, flip: 1 }, [[39, 55]]);
    obj(m, { kind: 'holo', tx: 36, ty: 52, dy: -10, src: 'static', lines: ['CAMPFIRE', 'Chill here with friends'] }, []);
    // the lighthouse on the east shore
    disc(m, 60, 54, 2, G2.SAND);
    obj(m, { kind: 'lighthouse', tx: 60, ty: 54, dy: 14 }, [[59, 54], [60, 54]]);
    // pines and palms on the rim
    [[10, 20], [12, 12], [52, 10], [58, 12], [26, 8], [46, 8], [4, 40], [7, 52], [12, 60], [40, 66], [48, 64], [58, 58], [66, 52], [67, 40], [69, 28], [9, 56], [33, 62], [56, 62]].forEach(function (p) {
      var t = m.g[p[1] * W + p[0]]; if (t === G2.GRASS || t === G2.SAND) obj(m, { kind: 'pine', tx: p[0], ty: p[1], v: (p[0] * 7 + p[1]) % 3 });
    });
    [[16, 62], [26, 61], [14, 58], [29, 60]].forEach(function (p) { var t = m.g[p[1] * W + p[0]]; if (t === G2.GRASS || t === G2.SAND) obj(m, { kind: 'palm', tx: p[0], ty: p[1] }); });
    // twelve hidden stars: walk over one to collect it
    B.STARS = [[13, 17], [62, 17], [8, 50], [30, 60], [41, 60], [66, 33], [23, 11], [49, 11], [15, 51], [57, 49], [37, 8], [33, 45]];
    B.STARS.forEach(function (p, i) { obj(m, { kind: 'star', tx: p[0], ty: p[1], id: i }, []); });
    obj(m, { kind: 'holo', tx: 29, ty: 40, dy: -30, src: 'stars', lines: [] }, []);
    // holograms over every portal and the casino/leaderboard
    ports.forEach(function (q) { obj(m, { kind: 'holo', tx: q.tx, ty: q.ty - 3, dy: -46, src: 'game', game: q.g, lines: [] }, []); });
    obj(m, { kind: 'holo', tx: 13, ty: 36, dy: -250, src: 'static', lines: ['LEADERBOARD PLAZA', 'Press E for every game'] }, []);
    obj(m, { kind: 'holo', tx: 59, ty: 37, dy: -80, src: 'casino', lines: [] }, []);
    }
    // trees around the edges
    [[8, 24], [5, 34], [7, 48], [14, 55], [20, 61], [30, 63], [44, 62], [53, 59], [62, 50], [66, 38], [64, 24], [54, 14], [44, 10], [28, 10], [18, 13], [24, 34], [48, 34], [29, 50], [47, 46]].forEach(function (p) { if (m.g[p[1] * W + p[0]] === G2.GRASS) obj(m, { kind: 'tree', tx: p[0], ty: p[1] }); });
    [[24, 44], [48, 37]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    return m;
  }
  // ---- the HUGE hub: the old town in the middle, eight regions to explore around it ----
  B.genHub = function (opts) {
    var LITE = !!(opts && opts.lite), G2 = B.G, HW = B.HUB_W, OX = B.HUB_OFF.x, OY = B.HUB_OFF.y;
    B.setDims(HW, HW);
    var swp = W, shp = H, core;
    W = 72; H = 72; try { core = genCore(opts); } finally { W = swp; H = shp; }
    var coreStars = (B.STARS || []).map(function (p) { return [p[0] + OX, p[1] + OY]; });
    var m = blankMap(); m.ox = OX; m.oy = OY;
    var CX = 72, CY = 72;
    // ---- terrain: one big wobbly continent split into eight regions
    function wob(x, y) { return Math.sin(x * 0.13) * 0.34 + Math.sin(y * 0.11 + 1.3) * 0.3 + Math.sin((x + y) * 0.07) * 0.2; }
    function region(x, y) { var th = Math.atan2(y - CY, x - CX) + wob(x, y) * 0.5; var k = Math.round(th / (Math.PI / 4)); return ((k % 8) + 8) % 8; }   // 0 E, 1 SE, 2 S, 3 SW, 4 W, 5 NW, 6 N, 7 NE
    for (var y = 3; y < HW - 3; y++) for (var x = 3; x < HW - 3; x++) {
      var dx = (x - CX) / 68, dy = (y - CY) / 68, r = Math.hypot(dx, dy), th0 = Math.atan2(dy, dx);
      var edge = 1 + 0.06 * Math.sin(3 * th0 + 0.5) + 0.05 * Math.sin(7 * th0 + 2) + 0.025 * Math.sin(13 * th0);
      if (r > edge * 0.97) continue;
      var rg = region(x, y), h = B.hash(y * HW + x), t = G2.GRASS;
      if (rg === 0) t = h < 0.1 ? G2.GRASS : G2.CHERRY;
      else if (rg === 1) t = h < 0.55 ? G2.MESA : (h < 0.8 ? G2.STONE : G2.MESA);
      else if (rg === 2) t = G2.SAND;
      else if (rg === 3) t = h < 0.12 ? G2.GRASS : G2.SWAMP;
      else if (rg === 4) t = G2.GRASS;
      else if (rg === 5) t = h < 0.45 ? G2.COBBLE : (h < 0.62 ? G2.GRASS : G2.STONE);
      else if (rg === 6) t = h < 0.07 ? G2.ICE : G2.SNOW;
      else t = G2.SAND;
      m.g[y * HW + x] = t;
      if (rg === 2 && r > edge * 0.80) { m.g[y * HW + x] = G2.WATER; m.obj[y * HW + x] = 3; }       // the south coast is a lagoon
    }
    // ---- the old town on top, blended into the surrounding land
    for (y = 0; y < 72; y++) for (x = 0; x < 72; x++) { var ci = y * 72 + x; if (core.g[ci]) { m.g[(y + OY) * HW + x + OX] = core.g[ci]; m.obj[(y + OY) * HW + x + OX] = core.obj[ci]; } }
    for (y = OY; y < OY + 72; y++) for (x = OX; x < OX + 72; x++) {
      var ci2 = (y - OY) * 72 + (x - OX); if (core.g[ci2] || !m.g[y * HW + x]) continue;
      var e = Math.hypot((x - 72) / 32.5, (y - 73) / 29.5); if (e < 1.14 && B.hash(y * HW + x) < (1.14 - e) / 0.14) { m.g[y * HW + x] = G2.GRASS; if (m.obj[y * HW + x] === 3 && m.g[y * HW + x] !== G2.WATER) m.obj[y * HW + x] = 0; }
    }
    core.objs.forEach(function (o) { o.tx += OX; o.ty += OY; o.x += OX * T; o.y += OY * T; m.objs.push(o); });
    B.HUB_PORTS = (B.HUB_PORTS || []).map(function (q) { return { g: q.g, tx: q.tx + OX, ty: q.ty + OY }; });
    function inb(x, y) { return x > 1 && y > 1 && x < HW - 1 && y < HW - 1; }
    function put(o, solidTiles) { if (LITE) return null; return obj(m, o, solidTiles); }
    function ok(x, y) { if (!inb(x, y)) return false; var i = y * HW + x, g = m.g[i]; return g && g !== G2.WATER && g !== G2.ROCK && !m.obj[i] && g !== G2.PATH; }
    function okAll(list) { for (var i = 0; i < list.length; i++) if (!ok(list[i][0], list[i][1])) return false; return true; }
    function rect(x, y, w, h) { var l = []; for (var yy = y; yy < y + h; yy++) for (var xx = x; xx < x + w; xx++) l.push([xx, yy]); return l; }
    function build(o, w, h) { var tiles = rect(o.tx - (w >> 1), o.ty - h + 1, w, h); if (!okAll(tiles)) { (B._hubFail = B._hubFail || []).push(o.kind + '@' + o.tx + ',' + o.ty); return null; } return put(o, tiles); }
    function buildNear(o, w, h) {
      var tx0 = o.tx, ty0 = o.ty;
      for (var rad = 0; rad <= 9; rad++) for (var dy2 = -rad; dy2 <= rad; dy2++) for (var dx2 = -rad; dx2 <= rad; dx2++) {
        if (Math.max(Math.abs(dx2), Math.abs(dy2)) !== rad) continue;
        var tiles = rect(tx0 + dx2 - (w >> 1), ty0 + dy2 - h + 1, w, h);
        if (okAll(tiles)) { o.tx = tx0 + dx2; o.ty = ty0 + dy2; return put(o, tiles); }
      }
      (B._hubFail = B._hubFail || []).push(o.kind + '@' + tx0 + ',' + ty0); return null;
    }
    function pool(cx, cy, r, tile) { for (var yy = -r; yy <= r; yy++) for (var xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r + r * 0.5) { var i = (cy + yy) * HW + cx + xx; if (!inb(cx + xx, cy + yy) || !m.g[i]) continue; m.g[i] = tile; m.obj[i] = tile === G2.WATER ? 3 : 0; } }
    function road(x0, y0, x1, y1, wd) { wd = wd || 2; var sx = x1 > x0 ? 1 : -1, sy = y1 > y0 ? 1 : -1, xx, yy, k; for (xx = x0; xx !== x1 + sx; xx += sx) for (k = 0; k < wd; k++) if (inb(xx, y0 + k) && m.g[(y0 + k) * HW + xx]) { m.g[(y0 + k) * HW + xx] = G2.PATH; m.obj[(y0 + k) * HW + xx] = 0; } for (yy = y0; yy !== y1 + sy; yy += sy) for (k = 0; k < wd; k++) if (inb(x1 + k, yy) && m.g[yy * HW + x1 + k]) { m.g[yy * HW + x1 + k] = G2.PATH; m.obj[yy * HW + x1 + k] = 0; } }
    function plaza(cx, cy, r, tile) { for (var yy = -r; yy <= r; yy++) for (var xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r + 1) { var i = (cy + yy) * HW + cx + xx; if (inb(cx + xx, cy + yy) && m.g[i]) { m.g[i] = tile; m.obj[i] = 0; } } }
    // ---- roads out of town to every region
    road(44, 66, 22, 66, 2); road(44, 70, 22, 70, 2);                       // west
    road(100, 66, 120, 66, 2); road(100, 70, 120, 70, 2);                   // east
    road(71, 88, 71, 124, 3);                                               // south
    road(56, 52, 56, 22, 2); road(56, 22, 88, 22, 2); road(88, 52, 88, 22, 2);   // north, round the castle
    road(88, 24, 116, 24, 2); road(116, 24, 116, 40, 2);                    // north-east desert
    road(56, 24, 32, 24, 2); road(32, 24, 32, 38, 2);                       // north-west ruins
    road(100, 74, 112, 74, 2); road(112, 74, 112, 104, 2);                  // south-east quarry
    road(44, 74, 32, 74, 2); road(32, 74, 32, 104, 2);                      // south-west swamp
    // region hubs: little plazas with a campfire / sign
    plaza(72, 17, 4, G2.COBBLE); plaza(116, 40, 4, G2.COBBLE); plaza(122, 68, 4, G2.COBBLE); plaza(112, 106, 4, G2.COBBLE); plaza(71, 124, 4, G2.PLANK || G2.FLOOR); plaza(32, 106, 4, G2.COBBLE); plaza(20, 68, 4, G2.COBBLE); plaza(32, 38, 4, G2.COBBLE);
    if (LITE) { B.STARS = []; return m; }
    function holo(tx, ty, dy, lines, src) { put({ kind: 'holo', tx: tx, ty: ty, dy: dy, src: src || 'static', lines: lines }, []); }
    function post(tx, ty, lines) { put({ kind: 'post', tx: tx, ty: ty, dy: 8 }, []); holo(tx, ty, -70, lines); }
    var oh = function (a, b) { return B.hash(a * 977 + b * 131); };
    // scatter: put an object on random matching tiles of a region
    function scatter(rgn, kind, n, tiles, extra, solid) {
      var tries = 0, put0 = 0;
      while (put0 < n && tries < n * 40) { tries++; var xx = 6 + ((oh(tries, kind.length + n * 3 + rgn) * (HW - 12)) | 0), yy = 6 + ((oh(tries * 7, rgn * 31 + n) * (HW - 12)) | 0), i = yy * HW + xx;
        if (region(xx, yy) !== rgn || tiles.indexOf(m.g[i]) < 0 || m.obj[i] || Math.hypot(xx - CX, yy - CY) < 40) continue;
        var o = { kind: kind, tx: xx, ty: yy, v: (xx * 7 + yy) % 3 }; if (extra) for (var k in extra) o[k] = extra[k];
        if (solid && !ok(xx, yy)) continue; put(o); put0++; }
    }
    var tr = []; // stars to add
    // signposts along the roads leaving town
    post(43, 64, ['WEST ROAD', 'Whispering Woods']); post(101, 64, ['EAST ROAD', 'Cherry Grove and Desert']); post(69, 90, ['SOUTH ROAD', 'Sunset Beach']); post(54, 49, ['NORTH ROAD', 'Frost Peaks and Ruins']);
    post(100, 76, ['ROCKY QUARRY', 'follow the road south-east']); post(43, 76, ['MISTY SWAMP', 'follow the road south-west']);

    // ===== N: FROST PEAKS =====
    pool(60, 12, 5, G2.ICE); pool(84, 14, 4, G2.ICE);
    [[50, 12], [94, 10], [72, 7], [40, 16], [104, 18]].forEach(function (p) { buildNear({ kind: 'peak', tx: p[0], ty: p[1], v: p[0] % 3 }, 5, 3); });
    buildNear({ kind: 'igloo', tx: 66, ty: 21 }, 3, 2); buildNear({ kind: 'igloo', tx: 80, ty: 20 }, 3, 2); buildNear({ kind: 'house', tx: 77, ty: 27, roof: 1, dy: 14 }, 3, 2);
    put({ kind: 'campfire', tx: 72, ty: 19 }); put({ kind: 'bench', tx: 69, ty: 19 }); put({ kind: 'bench', tx: 75, ty: 19, flip: true });
    [[68, 15], [76, 15], [62, 18], [83, 18], [56, 11]].forEach(function (p) { if (ok(p[0], p[1])) put({ kind: 'deco', tx: p[0], ty: p[1], what: 'snowman' }); });
    scatter(6, 'pine', 36, [G2.SNOW], null, true);
    holo(72, 14, -30, ['FROST PEAKS', 'Warm up by the fire']);
    tr.push([46, 22], [100, 12], [64, 6]);
    // ===== NE: SUNSCORCH DESERT =====
    buildNear({ kind: 'pyramid', tx: 118, ty: 30 }, 7, 4); pool(104, 36, 3, G2.WATER);
    [[102, 33], [107, 34], [105, 39]].forEach(function (p) { if (ok(p[0], p[1])) put({ kind: 'palm', tx: p[0], ty: p[1] }); });
    [[122, 38], [126, 34], [112, 44]].forEach(function (p, i) { buildNear({ kind: 'tent', tx: p[0], ty: p[1], col: i }, 3, 2); });
    put({ kind: 'campfire', tx: 116, ty: 40 });
    scatter(7, 'cactus', 34, [G2.SAND], null, true); scatter(7, 'palm', 6, [G2.SAND], null, true);
    holo(118, 24, -150, ['SUNSCORCH DESERT', 'A pyramid with a secret']);
    tr.push([128, 26], [108, 20], [126, 44]);
    // ===== E: CHERRY GROVE =====
    pool(114, 78, 3, G2.WATER); put({ kind: 'fishspot', tx: 118, ty: 78, act: 'fish', label: 'KOI POND', dy: 6 }); put({ kind: 'lily', tx: 113, ty: 77 }); put({ kind: 'lily', tx: 115, ty: 80 });
    buildNear({ kind: 'pagoda', tx: 124, ty: 66 }, 5, 3); put({ kind: 'bench', tx: 120, ty: 70 }); put({ kind: 'bench', tx: 127, ty: 70, flip: true });
    [[119, 64], [129, 64], [119, 72], [129, 72]].forEach(function (p) { put({ kind: 'lamp', tx: p[0], ty: p[1] }); });
    scatter(0, 'cherry', 50, [G2.CHERRY], null, true);
    holo(124, 60, -130, ['CHERRY GROVE', 'Koi pond and a quiet pagoda']);
    tr.push([130, 78], [112, 60], [126, 86]);
    // ===== SE: ROCKY QUARRY =====
    buildNear({ kind: 'mine', tx: 112, ty: 100 }, 4, 2); buildNear({ kind: 'stall', tx: 106, ty: 108, col: 3 }, 2, 1); buildNear({ kind: 'stall', tx: 118, ty: 108, col: 0 }, 2, 1);
    [[108, 112], [117, 113], [112, 114]].forEach(function (p, i) { if (ok(p[0], p[1])) put({ kind: 'deco', tx: p[0], ty: p[1], what: ['crate', 'barrel', 'hay'][i] }); });
    for (var q = 0; q < 26; q++) { var rx = 96 + ((oh(q, 5) * 34) | 0), ry = 96 + ((oh(q, 9) * 30) | 0), ri = ry * HW + rx; if (region(rx, ry) === 1 && (m.g[ri] === G2.STONE || m.g[ri] === G2.MESA) && !m.obj[ri] && Math.hypot(rx - 112, ry - 106) > 7 && Math.hypot(rx - 112, ry - 74) > 4) m.g[ri] = G2.ROCK; }
    scatter(1, 'pine', 6, [G2.MESA], null, true);
    holo(112, 94, -100, ['ROCKY QUARRY', 'Dig deep, shop later']);
    tr.push([98, 118], [124, 104], [104, 94]);
    // ===== S: SUNSET BEACH =====
    fill(m, 71, 120, 73, 134, G2.FLOOR); for (var py = 120; py <= 134; py++) for (var px = 71; px <= 73; px++) m.obj[py * HW + px] = 0;
    put({ kind: 'fishspot', tx: 71, ty: 131, act: 'fish', label: 'PIER', dy: 6 }); put({ kind: 'boat', tx: 66, ty: 133, dy: 4 }); put({ kind: 'boat', tx: 78, ty: 126, dy: 4 });
    [[62, 118], [82, 118], [58, 122], [86, 122]].forEach(function (p, i) { if (ok(p[0], p[1])) put({ kind: 'umbrella', tx: p[0], ty: p[1], col: i }); });
    scatter(2, 'palm', 22, [G2.SAND], null, true);
    holo(71, 116, -50, ['SUNSET BEACH', 'Cast a line off the pier']);
    tr.push([56, 112], [90, 114], [50, 104]);
    // ===== SW: MISTY SWAMP =====
    [[22, 112], [40, 116], [28, 120], [44, 106], [20, 98]].forEach(function (p) { pool(p[0], p[1], 3 + (p[0] % 2), G2.WATER); });
    buildNear({ kind: 'house', tx: 32, ty: 100, roof: 2, dy: 14, witch: true }, 3, 2); put({ kind: 'deco', tx: 36, ty: 100, what: 'cauldron' });
    scatter(3, 'mushroom', 30, [G2.SWAMP], null, true); scatter(3, 'tree', 12, [G2.SWAMP], null, true);
    for (q = 0; q < 14; q++) { var lx = 14 + ((oh(q, 3) * 36) | 0), ly = 96 + ((oh(q, 6) * 30) | 0); if (m.g[ly * HW + lx] === G2.WATER) put({ kind: 'lily', tx: lx, ty: ly }); }
    holo(32, 94, -110, ['MISTY SWAMP', 'Do not feed the witch']);
    tr.push([16, 108], [44, 120], [26, 92]);
    // ===== W: WHISPERING WOODS =====
    buildNear({ kind: 'house', tx: 24, ty: 62, roof: 5, dy: 14 }, 3, 2); buildNear({ kind: 'house', tx: 14, ty: 74, roof: 6, dy: 14 }, 3, 2);
    put({ kind: 'campfire', tx: 20, ty: 68 }); put({ kind: 'bench', tx: 17, ty: 68 }); put({ kind: 'bench', tx: 23, ty: 68, flip: true });
    scatter(4, 'pine', 40, [G2.GRASS], null, true); scatter(4, 'tree', 36, [G2.GRASS], null, true);
    holo(20, 64, -30, ['WHISPERING WOODS', 'Stay on the path']);
    tr.push([12, 56], [10, 84], [26, 50]);
    // ===== NW: ANCIENT RUINS =====
    plaza(32, 32, 7, G2.COBBLE);
    [[28, 28], [36, 28], [28, 36], [36, 36], [32, 26], [32, 38]].forEach(function (p, i) { put({ kind: 'pillar', tx: p[0], ty: p[1], broken: i % 2 === 1 }); });
    buildNear({ kind: 'ruingate', tx: 32, ty: 44 }, 5, 1); put({ kind: 'deco', tx: 32, ty: 32, what: 'crate' });
    scatter(5, 'pillar', 10, [G2.COBBLE, G2.STONE], { broken: true }, true); scatter(5, 'pine', 10, [G2.GRASS], null, true);
    holo(32, 24, -110, ['ANCIENT RUINS', 'Something sleeps below']);
    tr.push([16, 32], [44, 20], [20, 46]);
    // stars hide in every region
    var starBase = coreStars.length;
    var seen = new Uint8Array(HW * HW), stack = [Math.floor(B.HUB_SPAWN.y / T) * HW + Math.floor(B.HUB_SPAWN.x / T)];
    seen[stack[0]] = 1;
    while (stack.length) { var ci3 = stack.pop(), cx3 = ci3 % HW, cy3 = (ci3 / HW) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = cx3 + d[0], ny = cy3 + d[1]; if (!inb(nx, ny)) return; var ni = ny * HW + nx; if (seen[ni] || !m.g[ni] || m.g[ni] === G2.ROCK || m.obj[ni] > 0) return; seen[ni] = 1; stack.push(ni); }); }
    tr.forEach(function (p) {
      if (seen[p[1] * HW + p[0]]) return;
      for (var rad = 1; rad <= 12; rad++) for (var dy3 = -rad; dy3 <= rad; dy3++) for (var dx3 = -rad; dx3 <= rad; dx3++) { if (Math.max(Math.abs(dx3), Math.abs(dy3)) !== rad) continue; var qx = p[0] + dx3, qy = p[1] + dy3; if (inb(qx, qy) && seen[qy * HW + qx] && m.g[qy * HW + qx] !== G2.PATH) { p[0] = qx; p[1] = qy; return; } }
    });

    B.STARS = coreStars.concat(tr);
    tr.forEach(function (p, i) { put({ kind: 'star', tx: p[0], ty: p[1], id: starBase + i }, []); });
    // bigger welcome: the compass at the plaza, plus a map reminder
    put({ kind: 'holo', tx: 72, ty: 86, dy: -60, src: 'static', lines: ['EXPLORE!', 'Eight regions around town', 'Press M for the map'] }, []);
    return m;
  };

  // Holiday decorations for the hub (client-only; the hub's movement is client-side).
  B.XMAS_LIGHTS = [[[13, 25], [21, 25], [27, 25], [33, 25], [39, 25], [45, 25], [51, 25], [59, 25]], [[30, 35], [42, 35]], [[30, 45], [42, 45]], [[30, 35], [30, 45]], [[42, 35], [42, 45]]];
  // Each holiday fills the same spots in the hub ("roles") with its own decorations.
  var R = {
    tree: [[32, 37], [40, 37], [10, 22], [62, 22], [55, 50]], gift: [[31, 38], [41, 38], [43, 32], [29, 32], [52, 50]], gift2: [[33, 38], [39, 38]],
    cane: [[34, 27], [38, 27], [34, 29], [38, 29], [34, 33], [38, 33]], ginger: [[28, 43], [44, 43]],
    statue: [[26, 47], [46, 48], [20, 34], [52, 36], [10, 48], [61, 46]], pile: [[12, 33], [60, 34], [50, 44], [23, 38], [52, 48], [15, 50], [57, 28], [27, 30]],
    deer: [[21, 47], [19, 47]], sleigh: [[24, 47]], guard: [[56, 39], [62, 39], [10, 43], [16, 43]], crystal: [], orn: [[22, 50]],
    ban1: [[10, 20]], ban2: [[62, 20]], wreath: [[30, 29], [42, 29]], lantern: [[24, 43], [48, 42]],
  };
  B.SEASONS = {
    xmas: { name: 'Christmas', emoji: '', hat: 'santa', fall: 'snow', ground: 'frost', lights: ['#ff4b5c', '#2bd576', '#ffd166', '#3fa9ff', '#ff6ec7'],
      map: { tree: 'xtree', gift: 'presents', gift2: 'present', cane: 'candycane', ginger: 'gingerbread', statue: 'snowman', pile: 'snowpile', deer: 'reindeer', sleigh: 'sleigh', guard: 'toysoldier', crystal: 'icecrystal', orn: 'ornament', ban1: 'bannerred', ban2: 'bannergold', wreath: 'wreath', lantern: 'lanternpost' } },
    halloween: { name: 'Halloween', emoji: '', hat: 'wizard', fall: 'bats', ground: 'spooky', lights: ['#ff7a1a', '#8a3ffc', '#7dff9e'],
      map: { tree: 'deadtree', gift: 'jacklantern', gift2: 'cauldron', cane: 'gravestone', ginger: 'ghostprop', statue: 'scarecrow', pile: 'leafpile', deer: 'gravestone', sleigh: 'cauldron', guard: 'ghostprop', crystal: 'spiderweb', orn: 'jacklantern', ban1: 'bannerorange', ban2: 'bannerpurple', wreath: 'spiderweb', lantern: 'jacklantern' } },
    thanksgiving: { name: 'Fall / Thanksgiving', emoji: '', hat: 'cowboy', fall: 'leaves', ground: 'autumn', lights: ['#ff8a3d', '#e0a400', '#d62839'],
      map: { tree: 'cornstalk', gift: 'pumpkin', gift2: 'hay', cane: 'cornstalk', ginger: 'turkey', statue: 'scarecrow', pile: 'leafpile', deer: 'turkey', sleigh: 'hay', guard: 'scarecrow', crystal: 'pumpkin', orn: 'leafpile', ban1: 'bannerorange', ban2: 'bannergold', wreath: 'cornstalk', lantern: 'lanternpost' } },
    newyear: { name: 'New Year', emoji: '', hat: 'party', fall: 'confetti', fireworks: true, ground: '', lights: ['#ffd166', '#ffffff', '#c8b6ff', '#5cf2ff'],
      map: { tree: 'balloons', gift: 'presents', gift2: 'balloons', cane: 'firework', ginger: 'balloons', statue: 'firework', pile: 'present', deer: 'balloons', sleigh: 'presents', guard: 'firework', crystal: 'balloons', orn: 'firework', ban1: 'bannergold', ban2: 'bannerpurple', wreath: 'balloons', lantern: 'lanternpost' } },
    valentines: { name: "Valentine's Day", emoji: '', hat: '', fall: 'hearts', ground: 'pink', lights: ['#ff3d6e', '#ff9ec7', '#ffffff'],
      map: { tree: 'rosebush', gift: 'heartballoon', gift2: 'loveletter', cane: 'heartballoon', ginger: 'loveletter', statue: 'rosebush', pile: 'rosebush', deer: 'heartballoon', sleigh: 'presents', guard: 'heartballoon', crystal: 'loveletter', orn: 'heartballoon', ban1: 'bannerpink', ban2: 'bannerred', wreath: 'rosebush', lantern: 'lanternpost' } },
    stpatricks: { name: "St. Patrick's Day", emoji: '', hat: 'top', fall: 'clovers', ground: 'green', lights: ['#2bd576', '#ffd166', '#ffffff'],
      map: { tree: 'clover', gift: 'potofgold', gift2: 'clover', cane: 'clover', ginger: 'potofgold', statue: 'clover', pile: 'clover', deer: 'potofgold', sleigh: 'potofgold', guard: 'clover', crystal: 'potofgold', orn: 'clover', ban1: 'bannergreen', ban2: 'bannergold', wreath: 'clover', lantern: 'lanternpost' } },
    easter: { name: 'Easter / Spring', emoji: '', hat: 'flowers', fall: 'petals', ground: 'spring', lights: ['#ffb7d5', '#b5f5cf', '#c8b6ff', '#fff27a'],
      map: { tree: 'flowerbed', gift: 'egg', gift2: 'egg', cane: 'flowerbed', ginger: 'bunnyprop', statue: 'bunnyprop', pile: 'egg', deer: 'bunnyprop', sleigh: 'flowerbed', guard: 'bunnyprop', crystal: 'egg', orn: 'egg', ban1: 'bannerpink', ban2: 'bannergreen', wreath: 'flowerbed', lantern: 'lanternpost' } },
    july4: { name: '4th of July', emoji: '', hat: 'top', fall: 'confetti', fireworks: true, ground: '', lights: ['#ff4b5c', '#ffffff', '#3a6dff'],
      map: { tree: 'balloons', gift: 'firework', gift2: 'balloons', cane: 'firework', ginger: 'beachball', statue: 'firework', pile: 'balloons', deer: 'firework', sleigh: 'beachball', guard: 'firework', crystal: 'balloons', orn: 'firework', ban1: 'bannerred', ban2: 'bannerblue', wreath: 'balloons', lantern: 'lanternpost' } },
    summer: { name: 'Summer', emoji: '', hat: 'cap', fall: 'sun', ground: 'sunny', lights: [],
      map: { tree: 'umbrella', gift: 'beachball', gift2: 'sandcastle', cane: 'umbrella', ginger: 'sandcastle', statue: 'sandcastle', pile: 'beachball', deer: 'umbrella', sleigh: 'sandcastle', guard: 'beachball', crystal: 'beachball', orn: 'beachball', ban1: 'bannerblue', ban2: 'bannergold', wreath: 'umbrella', lantern: 'lanternpost' } },
  };
  B.SEASON_ORDER = ['xmas', 'newyear', 'valentines', 'stpatricks', 'easter', 'july4', 'summer', 'halloween', 'thanksgiving'];
  B.addSeason = function (m, id) {
    var se = B.SEASONS[id]; if (!se) return m;
    var G2 = B.G;
    for (var role in R) { var kind = se.map[role]; if (!kind) continue; R[role].forEach(function (p) {
      var tx = p[0] + (m.ox || 0), ty = p[1] + (m.oy || 0), i = ty * W + tx; if (!B.inb(tx, ty) || !m.g[i] || m.g[i] === G2.PATH || m.obj[i]) return;
      obj(m, { kind: 'deco', tx: tx, ty: ty, what: kind, xmas: true });
    }); }
    return m;
  };
  B.addXmas = function (m) { return B.addSeason(m, 'xmas'); };
  // The island you wait on before a match. Private rooms pick teams by standing on a pad.
  B.WAIT_SPAWN = { x: 36 * T + T / 2, y: 36 * T + T / 2 };
  B.genWait = function () {
    var m = blankMap();
    fill(m, 26, 30, 46, 42, G.GRASS, true);
    fill(m, 27, 31, 45, 41, G.GRASS);
    for (var x = 30; x <= 42; x++) { m.g[36 * W + x] = G.PATH; }
    for (var y = 32; y <= 40; y++) { m.g[y * W + 36] = G.PATH; }
    m.pads = [];
    [[28, 31], [42, 31], [42, 39], [28, 39]].forEach(function (p, t) {
      fill(m, p[0], p[1], p[0] + 2, p[1] + 1, G.PAD);
      m.pads.push({ team: t, x0: p[0], y0: p[1], x1: p[0] + 2, y1: p[1] + 1 });
      m.bases.push({ team: t, cx: p[0] + 1, cy: p[1] });
      obj(m, { kind: 'flag', tx: p[0] + 1, ty: p[1] + (t < 2 ? -1 : 2), team: t });
    });
    [[33, 34], [39, 34], [33, 38], [39, 38]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    return m;
  };
  B.padAt = function (m, x, y) { if (!m.pads) return -1; var tx = Math.floor(x / T), ty = Math.floor(y / T); for (var k = 0; k < m.pads.length; k++) { var p = m.pads[k]; if (tx >= p.x0 && tx <= p.x1 && ty >= p.y0 && ty <= p.y1) return p.team; } return -1; };

  B.idx = function (tx, ty) { return ty * W + tx; };
  B.inb = function (tx, ty) { return tx >= 0 && ty >= 0 && tx < W && ty < H; };
  B.floorAt = function (m, tx, ty) { if (!B.inb(tx, ty)) return false; var i = ty * W + tx; return m.g[i] > 0 || m.f[i] > 0; };
  B.solidAt = function (m, tx, ty) { if (!B.inb(tx, ty)) return true; var i = ty * W + tx; return m.w[i] > 0 || m.g[i] === G.ROCK || m.obj[i] > 0; };
  // Is the point (px) standing on something?
  B.groundUnder = function (m, x, y) { return B.floorAt(m, Math.floor(x / T), Math.floor(y / T)); };

  function hits(m, x, y, safe) {
    var R = B.R, tx, ty;
    var x0 = Math.floor((x - R) / T), x1 = Math.floor((x + R) / T), y0 = Math.floor((y - R) / T), y1 = Math.floor((y + R) / T);
    for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) if (B.solidAt(m, tx, ty)) return true;
    if (safe) {
      var r = B.EDGE_R;
      x0 = Math.floor((x - r) / T); x1 = Math.floor((x + r) / T); y0 = Math.floor((y - r) / T); y1 = Math.floor((y + r) / T);
      for (ty = y0; ty <= y1; ty++) for (tx = x0; tx <= x1; tx++) if (!B.floorAt(m, tx, ty)) return true;
    }
    return false;
  }
  B.hits = hits;
  // Move an entity with tile collision. `safe` = can't walk off edges (normal walking);
  // knockback turns it off, which is how people get knocked into the void.
  B.move = function (m, e, dx, dy, safe) {
    var stuck = hits(m, e.x, e.y, false);
    if (safe && !stuck && hits(m, e.x, e.y, true)) safe = false; // already hanging over an edge: don't trap them
    var steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
    var sx = dx / steps, sy = dy / steps, bx = false, by = false;
    for (var k = 0; k < steps; k++) {
      if (sx && !bx) { if (stuck || !hits(m, e.x + sx, e.y, safe)) e.x += sx; else bx = true; }
      if (sy && !by) { if (stuck || !hits(m, e.x, e.y + sy, safe)) e.y += sy; else by = true; }
    }
    e.x = Math.max(T, Math.min(W * T - T, e.x)); e.y = Math.max(T, Math.min(H * T - T, e.y));
    return { bx: bx, by: by };
  };

  // Can a block go on tile i? -> 'floor' (bridge over void) | 'wall' (raised block) | null
  B.canPlace = function (m, i, ents) {
    if (i < 0 || i >= W * H || m.noBuild[i] || m.obj[i] || m.w[i] || m.g[i] === G.ROCK) return null;
    var tx = i % W, ty = (i / W) | 0;
    if (!m.g[i] && !m.f[i]) {
      var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var k = 0; k < 4; k++) { var nx = tx + nb[k][0], ny = ty + nb[k][1]; if (B.floorAt(m, nx, ny) || B.solidAt(m, nx, ny) && B.inb(nx, ny)) return 'floor'; }
      return null;
    }
    if (ents) for (var j = 0; j < ents.length; j++) {
      var e = ents[j]; if (!e || e.dead) continue;
      if (Math.abs(e.x - (tx * T + T / 2)) < T / 2 + B.R - 1 && Math.abs(e.y - (ty * T + T / 2)) < T / 2 + B.R - 1) return null;
    }
    return 'wall';
  };
  // What would mining tile i break? -> {kind:'wall'|'floor'|'bed', block, hard}
  B.mineTarget = function (m, i) {
    if (i < 0 || i >= W * H) return null;
    if (m.w[i]) return { kind: 'wall', block: m.w[i], hard: B.BLOCKS[m.w[i]].hard };
    if (m.obj[i] === 1) return { kind: 'bed', hard: B.BED_HARD };
    if (m.f[i]) return { kind: 'floor', block: m.f[i], hard: B.BLOCKS[m.f[i]].hard };
    return null;
  };
  // Like Minecraft, you can't mine through blocks: trace a line from the player to the
  // tile and return the first wall/obstacle in the way (-1 if the tile is reachable).
  B.mineBlocker = function (m, x, y, i) {
    var tx = i % W, ty = (i / W) | 0, cx = tx * T + T / 2, cy = ty * T + T / 2;
    var bed = m.obj[i] === 1 ? B.bedAt(m, i) : null;
    var dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy), n = Math.ceil(d / 3);
    var self = Math.floor(y / T) * W + Math.floor(x / T);
    for (var k = 1; k < n; k++) {
      var px = x + dx * k / n, py = y + dy * k / n, j = Math.floor(py / T) * W + Math.floor(px / T);
      if (j === i || j === self) continue;
      if (bed && (j === bed.foot || j === bed.head)) continue;
      if (m.w[j] || m.g[j] === G.ROCK || m.obj[j]) return j;
    }
    return -1;
  };
  B.bedAt = function (m, i) { for (var k = 0; k < m.beds.length; k++) { var b = m.beds[k]; if (b.alive && (b.foot === i || b.head === i)) return b; } return null; };
  B.mineTime = function (hard, pick, haste) { return Math.max(0.12, hard / (B.PICKS[pick || 0].speed * (1 + 0.3 * (haste || 0)))); };

  // Hotbar contents for an inventory (sword first, then everything you hold).
  B.hotbar = function (inv) {
    var out = [];
    for (var k = 0; k < B.HOTBAR_ORDER.length && out.length < 9; k++) {
      var id = B.HOTBAR_ORDER[k];
      if (id === 'sword') { out.push('sword'); continue; }
      if (id === 'pick') { if (inv.pick > 0) out.push('pick'); continue; }
      if (inv[id] > 0) out.push(id);
    }
    return out;
  };
  B.canAfford = function (res, cost) { for (var k in cost) if ((res[k] || 0) < cost[k]) return false; return true; };
  B.costText = function (cost) { var s = []; for (var k in cost) s.push(cost[k] + ' ' + B.RES_NAMES[k]); return s.join(' + '); };
  B.pickCost = function (pickTier) { var s = B.SHOP_BY_ID.pick; return pickTier < s.pickTiers.length ? s.pickTiers[pickTier] : null; };

  // Seeded hash for decoration (same on every client).
  B.hash = function (i) { var x = (i + 1) * 374761393; x = (x ^ (x >>> 13)) * 1274126177; x = x ^ (x >>> 16); return (x >>> 0) / 4294967295; };
  B.fmtTime = function (s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); };

  root.BW = B;
})(typeof window !== 'undefined' ? window : globalThis);
