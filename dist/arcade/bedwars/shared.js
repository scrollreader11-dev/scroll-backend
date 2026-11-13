/* ============================================================
   Bedwars 2D — shared rules. Loaded by the browser (window.BW) and by the
   server (bedwars.js imports this file for its side effect: globalThis.BW).
   Map layout, blocks, items, shop catalog, team upgrades, collision.
   ============================================================ */
(function (root) {
  var B = {};
  var T = B.T = 40;           // tile size (px)
  var W = B.W = 72, H = B.H = 72;
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
  B.genMap = function () {
    var N = W * H, C = 36;
    var m = { W: W, H: H, g: new Uint8Array(N), f: new Uint8Array(N), fc: new Uint8Array(N), w: new Uint8Array(N), wc: new Uint8Array(N), obj: new Uint8Array(N), noBuild: new Uint8Array(N), beds: [], gens: [], npcs: [], bases: [] };
    function set(x, y, v) { if (x >= 0 && y >= 0 && x < W && y < H) m.g[y * W + x] = v; }
    var OUT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (var t = 0; t < 4; t++) {
      var o = OUT[t], dx = -o[0], dy = -o[1], rx = -dy, ry = dx;
      var cx = C + o[0] * 29, cy = C + o[1] * 29;
      var L = (function (cx, cy, dx, dy, rx, ry) { return function (a, b) { return [cx + a * rx + b * dx, cy + a * ry + b * dy]; }; })(cx, cy, dx, dy, rx, ry);
      var a, b, p;
      for (a = -5; a <= 5; a++) for (b = -4; b <= 5; b++) {
        var aa = Math.abs(a);
        if (aa === 5 && (b === -4 || b === 5)) continue;          // rounded corners
        if (aa >= 4 && b === 5) continue;
        p = L(a, b); set(p[0], p[1], G.GRASS);
      }
      for (b = -2; b <= 5; b++) { p = L(0, b); set(p[0], p[1], G.PATH); }
      for (a = -1; a <= 1; a++) for (b = -4; b <= -2; b++) { p = L(a, b); set(p[0], p[1], G.PAD); }
      var gp = L(0, -3), sp = L(0, -1), bf = L(0, 2), bh = L(0, 3), sh = L(-4, -2), up = L(4, -2);
      var base = { team: t, cx: cx, cy: cy, out: o, inward: [dx, dy], right: [rx, ry],
        spawn: { x: sp[0] * T + T / 2, y: sp[1] * T + T / 2 },
        gen: { x: gp[0] * T + T / 2, y: gp[1] * T + T / 2 },
        // the area your trap / heal pool covers (tile rect)
        rect: [Math.min(L(-5, -4)[0], L(5, 5)[0]), Math.min(L(-5, -4)[1], L(5, 5)[1]), Math.max(L(-5, -4)[0], L(5, 5)[0]), Math.max(L(-5, -4)[1], L(5, 5)[1])],
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
    [[17, 17], [55, 17], [17, 55], [55, 55]].forEach(function (c) {
      for (var y = -2; y <= 2; y++) for (var x = -2; x <= 2; x++) { if (Math.abs(x) === 2 && Math.abs(y) === 2) continue; set(c[0] + x, c[1] + y, G.STONE); }
      m.gens.push({ kind: 'dia', x: c[0] * T + T / 2, y: c[1] * T + T / 2, tile: c[1] * W + c[0] });
      m.noBuild[c[1] * W + c[0]] = 1;
    });
    // mid
    for (var y = -6; y <= 6; y++) for (var x = -6; x <= 6; x++) {
      var ax = Math.abs(x), ay = Math.abs(y);
      if (ax + ay > 9) continue;
      set(C + x, C + y, G.MID);
    }
    [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(function (d) { set(C + d[0], C + d[1], G.ROCK); });
    [[0, -2], [0, 2]].forEach(function (d) {
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
  B.HUB_SPAWN = { x: 36 * T + T / 2, y: 43 * T + T / 2 };
  B.genHub = function () {
    var m = blankMap();
    // spawn plaza + fountain
    disc(m, 36, 40, 7, G.MID);
    obj(m, { kind: 'fountain', tx: 36, ty: 40, dy: 20 }, [[35, 39], [36, 39], [35, 40], [36, 40]]);
    [[31, 36], [41, 36], [31, 44], [41, 44]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    obj(m, { kind: 'sign', tx: 33, ty: 45, text: 'WELCOME!', lines: ['Walk with WASD', 'Click NPCs to play', 'E = interact'] , dy: 10 }, [[33, 45]]);
    // Bedwars island (north)
    fill(m, 27, 18, 45, 29, G.GRASS, true);
    fill(m, 35, 30, 37, 33, G.PATH);
    var modes = [['solo', 'SOLO', '4 teams of 1', { skin: 'knight', body: '#ff6b6b' }], ['duos', 'DUOS', '4 teams of 2', { skin: 'fox', body: '#ff922b', hat: 'viking' }], ['squads', 'SQUADS', '4 teams of 4', { skin: 'dino', body: '#3fd27a', hat: 'crown' }], ['practice', 'PRACTICE', 'vs bots', { skin: 'robot', body: 'm:chrome', hat: 'phones' }]];
    modes.forEach(function (q, k) { obj(m, { kind: 'npc', tx: 30 + k * 4, ty: 22, act: q[0] === 'practice' ? 'practice' : 'quick', mode: q[0], label: q[1], sub: q[2], look: q[3], game: 'bedwars' }); });
    obj(m, { kind: 'npc', tx: 31, ty: 26, act: 'private', label: 'PRIVATE ROOM', sub: 'play with friends', look: { skin: 'panda', body: '#eef2ff', hat: 'top' }, game: 'bedwars' });
    obj(m, { kind: 'bedDeco', tx: 36, ty: 26 }, [[36, 25], [36, 26]]);
    obj(m, { kind: 'npc', tx: 41, ty: 26, act: 'how', label: 'HOW TO PLAY', sub: 'controls & tips', look: { skin: 'penguin', body: '#4a4f6a', hat: 'wizard' } });
    obj(m, { kind: 'banner', tx: 36, ty: 19, text: 'BEDWARS', dy: 0 }, [[34, 19], [35, 19], [36, 19], [37, 19], [38, 19]]);
    [[28, 19], [44, 19]].forEach(function (p, k) { obj(m, { kind: 'flag', tx: p[0], ty: p[1], team: k }); });
    [[28, 28], [44, 28]].forEach(function (p, k) { obj(m, { kind: 'flag', tx: p[0], ty: p[1], team: k + 2 }); });
    // Casino island (east)
    fill(m, 51, 35, 59, 45, G.STONE, true);
    fill(m, 44, 39, 50, 41, G.PATH);
    obj(m, { kind: 'portal', tx: 55, ty: 39, act: 'casino', label: 'SCROLLS CASINO', dy: 18 }, [[54, 39], [55, 39], [56, 39]]);
    [[52, 43], [58, 43]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    // Leaderboard island (west)
    fill(m, 12, 35, 22, 45, G.STONE, true);
    fill(m, 23, 39, 28, 41, G.PATH);
    obj(m, { kind: 'board', tx: 17, ty: 37, act: 'lb', dy: 20 }, [[15, 37], [16, 37], [17, 37], [18, 37], [19, 37]]);
    [[13, 43], [21, 43]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    // Coming-soon islands (south)
    fill(m, 35, 47, 37, 51, G.PATH);
    fill(m, 26, 52, 46, 53, G.PATH);
    [[24, 54, 32, 61], [40, 54, 48, 61]].forEach(function (r, k) {
      fill(m, r[0], r[1], r[2], r[3], G.GRASS, true);
      obj(m, { kind: 'soon', tx: (r[0] + r[2]) >> 1, ty: r[1] + 3, act: 'soon', label: 'NEW GAME', sub: 'coming soon', dy: 16 }, [[((r[0] + r[2]) >> 1) - 1, r[1] + 3], [(r[0] + r[2]) >> 1, r[1] + 3], [((r[0] + r[2]) >> 1) + 1, r[1] + 3]]);
    });
    // trees around the grass islands
    [[28, 20], [44, 20], [28, 27], [44, 27], [25, 55], [31, 60], [41, 55], [47, 60], [25, 60], [47, 55]].forEach(function (p) { if (m.g[p[1] * W + p[0]]) obj(m, { kind: 'tree', tx: p[0], ty: p[1] }); });
    return m;
  };
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
