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
  // One big Minecraft-style hub continent: every game portal in one plaza row
  // (signs BEHIND the portals), leaderboard corner, casino gate, park.
  B.genHub = function () {
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
    fill(m, 12, 15, 60, 26, G2.COBBLE);
    fill(m, 13, 16, 59, 25, G2.MID);
    fill(m, 35, 26, 37, 32, G2.PATH);
    var ports = [
      { g: 'spleef', tx: 16, ty: 21 }, { g: 'ctf', tx: 22, ty: 21 }, { g: 'hide', tx: 28, ty: 21 }, { g: 'bw', tx: 34, ty: 21 },
      { g: 'royale', tx: 40, ty: 21 }, { g: 'murder', tx: 46, ty: 21 }, { g: 'duel', tx: 52, ty: 21 }, { g: 'build', tx: 58, ty: 21 },
    ];
    B.HUB_PORTS = ports;
    ports.forEach(function (q) {
      var names = { bw: 'BEDWARS', ctf: 'CAPTURE FLAG', spleef: 'TNT SPLEEF', hide: 'PROP HUNT', duel: 'DUELS', murder: 'MURDER', build: 'BUILD BATTLE', royale: 'SCROLL ROYAL' };
      fill(m, q.tx - 1, q.ty, q.tx + 1, q.ty + 1, G2.PAD);
      // the name banner stands BEHIND (north of) the portal
      obj(m, { kind: 'banner', tx: q.tx, ty: q.ty - 2, text: names[q.g], game: q.g, small: true }, [[q.tx - 2, q.ty - 2], [q.tx + 2, q.ty - 2]]);
      // portals are NOT solid: you walk into them
      obj(m, { kind: 'gport', tx: q.tx, ty: q.ty, game: q.g, act: 'gmenu', walk: true }, []);
    });
    [[13, 16], [59, 16], [13, 25], [59, 25], [21, 25], [27, 25], [33, 25], [39, 25], [45, 25], [51, 25]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
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
    obj(m, { kind: 'board', tx: 55, ty: 53, act: 'builder', title: '🛠️ MAP BUILDER', lines: ['Make your own maps!', 'Owner: Scrollreader11'], dy: 14 }, [[53, 53], [54, 53], [55, 53], [56, 53], [57, 53]]);
    // ---- park (south-west): crystal pond + goodies
    disc(m, 22, 55, 4, G2.MID);
    disc(m, 22, 55, 2, G2.SNOW);
    [[27, 52, 'bush'], [17, 52, 'pot'], [27, 58, 'stool'], [17, 58, 'barrel'], [30, 55, 'mailbox']].forEach(function (p) { obj(m, { kind: 'deco', tx: p[0], ty: p[1], what: p[2] }); });
    [[42, 52, 'pumpkin'], [45, 54, 'hay'], [42, 56, 'pumpkin'], [46, 51, 'crate'], [48, 56, 'snowman'], [36, 57, 'trash']].forEach(function (p) { obj(m, { kind: 'deco', tx: p[0], ty: p[1], what: p[2] }); });
    // trees around the edges
    [[8, 24], [5, 34], [7, 48], [14, 55], [20, 61], [30, 63], [44, 62], [53, 59], [62, 50], [66, 38], [64, 24], [54, 14], [44, 10], [28, 10], [18, 13], [24, 34], [48, 34], [29, 50], [47, 46]].forEach(function (p) { if (m.g[p[1] * W + p[0]] === G2.GRASS) obj(m, { kind: 'tree', tx: p[0], ty: p[1] }); });
    [[24, 44], [48, 37]].forEach(function (p) { obj(m, { kind: 'lamp', tx: p[0], ty: p[1] }); });
    return m;
  };
  // Holiday decorations for the hub (client-only; the hub's movement is client-side).
  B.XMAS_LIGHTS = [[[13, 25], [21, 25], [27, 25], [33, 25], [39, 25], [45, 25], [51, 25], [59, 25]], [[30, 35], [42, 35]], [[30, 45], [42, 45]], [[30, 35], [30, 45]], [[42, 35], [42, 45]]];
  // Each holiday fills the same spots in the hub ("roles") with its own decorations.
  var R = {
    tree: [[32, 37], [40, 37], [10, 22], [62, 22], [55, 50]], gift: [[31, 38], [41, 38], [43, 32], [29, 32], [52, 50]], gift2: [[33, 38], [39, 38]],
    cane: [[34, 27], [38, 27], [34, 29], [38, 29], [34, 33], [38, 33]], ginger: [[28, 43], [44, 43]],
    statue: [[26, 47], [46, 48], [20, 34], [52, 36], [10, 48], [61, 46]], pile: [[12, 33], [60, 34], [50, 44], [23, 38], [52, 48], [15, 50], [57, 28], [27, 30]],
    deer: [[21, 47], [19, 47]], sleigh: [[24, 47]], guard: [[56, 39], [62, 39], [10, 43], [16, 43]], crystal: [[17, 55], [26, 55]], orn: [[22, 50]],
    ban1: [[10, 20]], ban2: [[62, 20]], wreath: [[30, 29], [42, 29]], lantern: [[24, 43], [48, 42]],
  };
  B.SEASONS = {
    xmas: { name: 'Christmas', emoji: '🎄', hat: 'santa', fall: 'snow', ground: 'frost', lights: ['#ff4b5c', '#2bd576', '#ffd166', '#3fa9ff', '#ff6ec7'],
      map: { tree: 'xtree', gift: 'presents', gift2: 'present', cane: 'candycane', ginger: 'gingerbread', statue: 'snowman', pile: 'snowpile', deer: 'reindeer', sleigh: 'sleigh', guard: 'toysoldier', crystal: 'icecrystal', orn: 'ornament', ban1: 'bannerred', ban2: 'bannergold', wreath: 'wreath', lantern: 'lanternpost' } },
    halloween: { name: 'Halloween', emoji: '🎃', hat: 'wizard', fall: 'bats', ground: 'spooky', lights: ['#ff7a1a', '#8a3ffc', '#7dff9e'],
      map: { tree: 'deadtree', gift: 'jacklantern', gift2: 'cauldron', cane: 'gravestone', ginger: 'ghostprop', statue: 'scarecrow', pile: 'leafpile', deer: 'gravestone', sleigh: 'cauldron', guard: 'ghostprop', crystal: 'spiderweb', orn: 'jacklantern', ban1: 'bannerorange', ban2: 'bannerpurple', wreath: 'spiderweb', lantern: 'jacklantern' } },
    thanksgiving: { name: 'Fall / Thanksgiving', emoji: '🦃', hat: 'cowboy', fall: 'leaves', ground: 'autumn', lights: ['#ff8a3d', '#e0a400', '#d62839'],
      map: { tree: 'cornstalk', gift: 'pumpkin', gift2: 'hay', cane: 'cornstalk', ginger: 'turkey', statue: 'scarecrow', pile: 'leafpile', deer: 'turkey', sleigh: 'hay', guard: 'scarecrow', crystal: 'pumpkin', orn: 'leafpile', ban1: 'bannerorange', ban2: 'bannergold', wreath: 'cornstalk', lantern: 'lanternpost' } },
    newyear: { name: 'New Year', emoji: '🎉', hat: 'party', fall: 'confetti', fireworks: true, ground: '', lights: ['#ffd166', '#ffffff', '#c8b6ff', '#5cf2ff'],
      map: { tree: 'balloons', gift: 'presents', gift2: 'balloons', cane: 'firework', ginger: 'balloons', statue: 'firework', pile: 'present', deer: 'balloons', sleigh: 'presents', guard: 'firework', crystal: 'balloons', orn: 'firework', ban1: 'bannergold', ban2: 'bannerpurple', wreath: 'balloons', lantern: 'lanternpost' } },
    valentines: { name: "Valentine's Day", emoji: '💘', hat: '', fall: 'hearts', ground: 'pink', lights: ['#ff3d6e', '#ff9ec7', '#ffffff'],
      map: { tree: 'rosebush', gift: 'heartballoon', gift2: 'loveletter', cane: 'heartballoon', ginger: 'loveletter', statue: 'rosebush', pile: 'rosebush', deer: 'heartballoon', sleigh: 'presents', guard: 'heartballoon', crystal: 'loveletter', orn: 'heartballoon', ban1: 'bannerpink', ban2: 'bannerred', wreath: 'rosebush', lantern: 'lanternpost' } },
    stpatricks: { name: "St. Patrick's Day", emoji: '☘️', hat: 'top', fall: 'clovers', ground: 'green', lights: ['#2bd576', '#ffd166', '#ffffff'],
      map: { tree: 'clover', gift: 'potofgold', gift2: 'clover', cane: 'clover', ginger: 'potofgold', statue: 'clover', pile: 'clover', deer: 'potofgold', sleigh: 'potofgold', guard: 'clover', crystal: 'potofgold', orn: 'clover', ban1: 'bannergreen', ban2: 'bannergold', wreath: 'clover', lantern: 'lanternpost' } },
    easter: { name: 'Easter / Spring', emoji: '🐣', hat: 'flowers', fall: 'petals', ground: 'spring', lights: ['#ffb7d5', '#b5f5cf', '#c8b6ff', '#fff27a'],
      map: { tree: 'flowerbed', gift: 'egg', gift2: 'egg', cane: 'flowerbed', ginger: 'bunnyprop', statue: 'bunnyprop', pile: 'egg', deer: 'bunnyprop', sleigh: 'flowerbed', guard: 'bunnyprop', crystal: 'egg', orn: 'egg', ban1: 'bannerpink', ban2: 'bannergreen', wreath: 'flowerbed', lantern: 'lanternpost' } },
    july4: { name: '4th of July', emoji: '🎆', hat: 'top', fall: 'confetti', fireworks: true, ground: '', lights: ['#ff4b5c', '#ffffff', '#3a6dff'],
      map: { tree: 'balloons', gift: 'firework', gift2: 'balloons', cane: 'firework', ginger: 'beachball', statue: 'firework', pile: 'balloons', deer: 'firework', sleigh: 'beachball', guard: 'firework', crystal: 'balloons', orn: 'firework', ban1: 'bannerred', ban2: 'bannerblue', wreath: 'balloons', lantern: 'lanternpost' } },
    summer: { name: 'Summer', emoji: '☀️', hat: 'cap', fall: 'sun', ground: 'sunny', lights: [],
      map: { tree: 'umbrella', gift: 'beachball', gift2: 'sandcastle', cane: 'umbrella', ginger: 'sandcastle', statue: 'sandcastle', pile: 'beachball', deer: 'umbrella', sleigh: 'sandcastle', guard: 'beachball', crystal: 'beachball', orn: 'beachball', ban1: 'bannerblue', ban2: 'bannergold', wreath: 'umbrella', lantern: 'lanternpost' } },
  };
  B.SEASON_ORDER = ['xmas', 'newyear', 'valentines', 'stpatricks', 'easter', 'july4', 'summer', 'halloween', 'thanksgiving'];
  B.addSeason = function (m, id) {
    var se = B.SEASONS[id]; if (!se) return m;
    var G2 = B.G;
    for (var role in R) { var kind = se.map[role]; if (!kind) continue; R[role].forEach(function (p) {
      var tx = p[0], ty = p[1], i = ty * W + tx; if (!B.inb(tx, ty) || !m.g[i] || m.g[i] === G2.PATH || m.obj[i]) return;
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
