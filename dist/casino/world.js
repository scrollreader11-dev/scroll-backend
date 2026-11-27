/* ============================================================
   Scrolls Casino 2D — the shared world (v2).
   One big casino floor with everyone online. Every game, the shop,
   the wardrobe, the ATM, the bar and the piano are objects you walk
   up to; Crash, Roulette, the Big Wheel, Blackjack and duels are
   shared with everyone else on the floor.
   ============================================================ */
(function () {
  var SC = window.SC, A = SC.art, state = SC.state, fmt = SC.fmt, esc = SC.esc, api = SC.api, toast = SC.toast;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var sfx = function (n, a) { SC.sfx && SC.sfx(n, a); };
  var T = 48, COLS = 76, ROWS = 124, PUBH = 44 * T, WW = COLS * T, WH = ROWS * T, SPEED = 230, TAU = Math.PI * 2;

  // ================================================================ CLOCK (server time for shared rounds)
  var clockOff = 0, clockSet = false;
  function syncClock(serverNow) { if (!serverNow) return; var o = serverNow - Date.now(); if (!clockSet) { clockOff = o; clockSet = true; } else clockOff = clockOff * 0.85 + o * 0.15; }
  SC.now = function () { return Date.now() + clockOff; };

  // ================================================================ MAP (60 x 44 tiles)
  var G = [];
  for (var yy = 0; yy < ROWS; yy++) { var row = []; for (var xx = 0; xx < COLS; xx++) row.push('#'); G.push(row); }
  function fill(x0, y0, x1, y1, ch) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) G[y][x] = ch; }
  fill(1, 2, 13, 21, 'r');    // Slot Alley
  fill(1, 23, 13, 42, 'l');   // The Lounge
  fill(4, 30, 10, 36, 'd');   //   dance floor
  fill(15, 2, 44, 10, 'b');   // High Stakes
  fill(15, 11, 44, 29, 'c');  // Main floor
  fill(15, 31, 44, 42, 'g');  // Lobby
  fill(23, 30, 36, 30, 'g');  //   main floor <-> lobby opening
  fill(46, 2, 58, 14, 'p');   // The Vault
  fill(46, 16, 58, 28, 'a');  // Duel Arena
  fill(46, 30, 58, 42, 'w');  // Shop
  fill(60, 14, 74, 30, 'k');  // The Arcade (skill games)
  fill(27, 47, 40, 122, 'o');  // The Owner Vault: a tall hidden tower below the casino (14 tiles wide, 76 tall). Only a small hatch in The Vault leads down.
  fill(14, 5, 14, 7, 'r'); fill(14, 15, 14, 18, 'c'); fill(14, 34, 14, 37, 'g'); // west doors
  fill(10, 22, 12, 22, 'l');                                                     // slots <-> lounge
  fill(45, 6, 45, 8, 'p'); fill(45, 20, 45, 23, 'a'); fill(45, 35, 45, 38, 'w'); // east doors
  fill(59, 20, 59, 23, 'k');                                                     // duel arena <-> arcade
  fill(51, 15, 53, 15, 'a'); fill(51, 29, 53, 29, 'w');                          // vault <-> arena <-> shop
  fill(29, 43, 30, 43, 'g');                                                     // exit
  function tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#'; return G[ty][tx]; }

  // ================================================================ OBJECTS
  var DEF = {
    slot: { box: [-28, -36, 28, 0], act: 'slots', label: 'Play Slots', ia: [0, 24], pr: -118 },
    blackjack: { box: [-86, -76, 86, 10], act: 'blackjack', label: 'Join Blackjack', ia: [0, 38], pr: -150, ar: 92 },
    roulette: { box: [-96, -80, 96, 10], act: 'roulette', label: 'Play Roulette', ia: [0, 36], pr: -152, ar: 96 },
    dice: { box: [-91, -78, 91, 10], act: 'dice', label: 'Dice Duels', ia: [0, 36], pr: -152, ar: 90 },
    coinflip: { box: [-27, -22, 27, 0], act: 'coinflip', label: 'Coinflip Duels', ia: [0, 26], pr: -170, ar: 64 },
    mines: { box: [-64, -86, 64, 4], act: 'mines', label: 'Play Mines', ia: [0, 30], pr: -122, ar: 72 },
    plinko: { box: [-54, -30, 54, 0], act: 'plinko', label: 'Play Plinko', ia: [0, 26], pr: -176, ar: 64 },
    wheel: { box: [-56, -26, 56, 0], act: 'wheel', label: 'Bet on the Big Wheel', ia: [0, 30], pr: -214, ar: 80 },
    crash: { box: [-70, -28, 100, 0], act: 'crash', label: 'Ride the Rocket', ia: [0, 28], pr: -186, ar: 90 },
    cabinet: { box: [-30, -30, 30, 0], ia: [0, 26], pr: -128, ar: 62 },
    gtable: { box: [-78, -50, 78, 4], ia: [0, 34], pr: -124, ar: 92 },
    gstand: { box: [-44, -30, 44, 0], ia: [0, 28], pr: -132, ar: 66 },
    casebox: { box: [-43, -30, 43, 0], act: 'cases', label: 'Open Cases', ia: [0, 26], pr: -130 },
    arena: { layer: 'decal', act: 'battles', label: 'Join Case Battles', ia: [0, 14], pr: -142, ar: 104 },
    shop: { box: [-136, -62, 136, 0], act: 'shop', label: 'Browse the Shop', ia: [0, 30], pr: -132, ar: 120 },
    wardrobe: { box: [-58, -26, 66, 0], act: 'wardrobe', label: 'Change Outfit', ia: [-6, 28], pr: -128, ar: 72 },
    atm: { box: [-30, -28, 30, 0], act: 'atm', label: 'Use ATM', ia: [0, 26], pr: -132 },
    board: { layer: 'wall', ia: [0, 42], pr: 6, ar: 84 },
    arcboard: { layer: 'wall', act: 'hiscores', label: 'See Arcade high scores', ia: [0, 42], pr: 6, ar: 84 },
    duelboard: { layer: 'wall', act: 'duels', label: 'See open duels', ia: [0, 42], pr: 6, ar: 84 },
    fountain: { box: [-88, -58, 88, 4] },
    plant: { box: [-16, -14, 16, 0] },
    pillar: { box: [-20, -14, 20, 0] },
    couch: { box: [-56, -46, 56, 0] },
    rope: { box: [-50, -6, 50, 0] },
    shelf: { layer: 'wall' }, bottles: { layer: 'wall' }, sign: { layer: 'wall' },
    rug: { layer: 'decal' }, stage: { layer: 'decal' }, ring: { layer: 'decal' },
    npc: { box: [-16, -10, 16, 0] },
    exit: { layer: 'decal', act: 'exit', label: 'Leave Casino', ia: [0, -14], pr: -40, ar: 60 },
    bar: { box: [-176, -62, 176, 0], act: 'bar', label: 'Order a drink', ia: [0, 44], pr: -132, ar: 150 },
    dj: { box: [-76, -46, 76, 0] },
    speaker: { box: [-24, -18, 24, 0] },
    lounge: { box: [-46, -22, 46, 0] },
    piano: { box: [-62, -48, 62, 0], act: 'piano', label: 'Play the piano', ia: [0, 26], pr: -128, ar: 70 },
    statue: { box: [-40, -30, 40, 0] },
    easel: { box: [-32, -8, 32, 0] },
    vhatch: { layer: 'decal', act: 'descend', label: 'Open the hatch', ia: [0, 0], pr: -44, ar: 62, ownerOnly: 1 },
    vladder: { layer: 'decal', act: 'ascend', label: 'Climb out', ia: [0, 0], pr: -70, ar: 66, ownerOnly: 1 },
    chest: { box: [-54, -36, 54, 0] },
    hammer: { box: [-32, -30, 32, 0], act: 'hammer', label: 'Grab the Ban Hammer', ia: [0, 34], pr: -176, ar: 76, ownerOnly: 1 },
    modterm: { box: [-52, -26, 52, 0], act: 'modmenu', label: 'Open the Mod Menu', ia: [0, 34], pr: -136, ar: 84, ownerOnly: 1 },
    rigcon: { box: [-54, -36, 54, 0], act: 'owner', label: 'Open the Rig Console', ia: [0, 34], pr: -126, ar: 84, ownerOnly: 1 },
    podium: { box: [-22, -22, 22, 0], act: 'modmenu', label: 'Make an announcement', ia: [0, 30], pr: -146, ar: 66, ownerOnly: 1 },
    fxm: { box: [-30, -24, 30, 0], act: 'fx', label: 'Use it', ia: [0, 30], pr: -112, ar: 62, ownerOnly: 1 },
    vpad: { layer: 'decal', act: 'warp', label: 'Warp', ia: [0, 4], pr: -78, ar: 46, ownerOnly: 1 },
    radar: { box: [-70, -26, 70, 0], act: 'modmenu', label: 'Watch the casino live', ia: [0, 38], pr: -150, ar: 96, ownerOnly: 1 },
    shame: { box: [-52, -14, 52, 0], act: 'hammer', label: 'Open the ban list', ia: [0, 34], pr: -172, ar: 80, ownerOnly: 1 },
    cctv: { box: [-64, -14, 64, 0] }, serverrack: { box: [-27, -14, 27, 0] }, rack: { box: [-50, -14, 50, 0] }, tcase: { box: [-38, -14, 38, 0] },
    obelisk: { box: [-18, -12, 18, 0] }, aquarium: { box: [-88, -20, 88, 0] }, fire: { box: [-60, -14, 60, 0] }, bookcase: { box: [-50, -14, 50, 0] },
    goldpile: { box: [-48, -18, 48, 0] }, lamp: { box: [-8, -6, 8, 0] }, vzone: { layer: 'decal' }, vcarpet: { layer: 'decal' }, vpool: { layer: 'decal' },
    throne: { box: [-46, -30, 46, 0] }, brazier: { box: [-14, -10, 14, 0] }, vrune: { layer: 'decal' }, vbanner: { layer: 'wall' },
    portal: { box: [-50, -22, 50, 0], act: 'arcade', label: 'Enter ScrollHub Games', ia: [0, 26], pr: -150, ar: 74 },
  };
  var OBJ = [];
  function add(type, x, y, o) {
    var d = DEF[type] || {}, ob = o || {};
    ob.type = type; ob.x = x; ob.y = y; ob.layer = ob.layer || d.layer || 'ent';
    if (d.box && !ob.nobox) ob.box = [x + d.box[0], y + d.box[1], x + d.box[2], y + d.box[3]];
    ob.act = ob.act || d.act || null; ob.label = ob.label || d.label || ''; if (d.ownerOnly) ob.ownerOnly = true;
    if (ob.act) { var ia = ob.ia || d.ia || [0, 24]; ob.ax = x + ia[0]; ob.ay = y + ia[1]; ob.ar = ob.ar || d.ar || 58; ob.py = y + (ob.pr != null ? ob.pr : (d.pr != null ? d.pr : -110)); }
    ob.ext = ob.len || (ob.h ? ob.h / 2 : 0) || ob.r || 0;   // big decals are drawn while any part of them is on screen
    OBJ.push(ob); return ob;
  }
  var MORE_META = {
    keno: ['🔢', 'Keno', 'Pick up to 10 numbers. Ten get drawn.'], scratch: ['🎟️', 'Scratch Cards', 'Match three symbols to win'],
    baccarat: ['🂡', 'Baccarat', 'Player, Banker or Tie'], shell: ['🥥', 'Shell Game', 'Find the ball under the cup'], penalty: ['⚽', 'Penalty Shootout', 'Pick a corner and beat the keeper'],
    echo: ['🎵', 'Echo', 'Repeat the pattern. Skill pays, a little.'], aim: ['🎯', 'Aim', 'Hit 20 targets before they fade'], mathrush: ['🧮', 'Math Rush', '45 seconds of quick sums'],
    trivia: ['❓', 'Trivia Run', '10 questions, 15 seconds each'], colorclash: ['🎨', 'Color Clash', 'Name the ink, not the word'], pattern: ['🔢', 'Pattern Pro', 'What number comes next?'], scramble: ['🔤', 'Word Scramble', 'Unjumble as many words as you can'],
    war: ['⚔️', 'Casino War', 'High card wins. Ties go to war.'], hilo: ['🃏', 'Hi-Lo', 'Higher or lower. Cash out any time.'], poker: ['♠️', 'Video Poker', 'Jacks or Better, 8/5 pay table'],
  };
  // --- Slot Alley
  [110, 206, 302, 398, 494, 590].forEach(function (x, i) { add('slot', x, 190, { v: i }); add('slot', x, 920, { v: i + 3 }); });
  [110, 206, 448, 544, 630].forEach(function (x, i) { add('slot', x, 600, { v: i + 1 }); });
  var megaSlot = add('slot', 330, 620, { big: true, v: 3, label: 'Play MEGA Jackpot Slots', pr: -238 });
  add('sign', 350, 26, { text: 'SLOT ALLEY', color: '#ff6ec7', size: 26, v: 1 });
  add('plant', 70, 1012); add('plant', 676, 470);
  station('poker', 170, 385, true); station('keno', 310, 385, true); station('scratch', 450, 385, true); station('hilo', 590, 385, true);
  // --- The Lounge
  add('bottles', 240, 1094, { w: 290, text: '' });
  add('bar', 240, 1250, { w: 300 });
  add('sign', 560, 1150, { text: 'THE LOUNGE', color: '#5eead4', size: 22, v: 12 });
  add('stage', 360, 1878, { w: 340, h: 104 });
  add('dj', 360, 1904);
  add('speaker', 210, 1900); add('speaker', 510, 1900);
  add('lounge', 110, 1380, { col: '#5a189a' }); add('lounge', 595, 1340, { col: '#1d6fa5' }); add('lounge', 595, 1530, { col: '#c1121f' });
  add('piano', 112, 1700);
  add('couch', 120, 2010, { col: '#0f5b63' }); add('couch', 600, 2010, { col: '#0f5b63' });
  // --- High Stakes
  var lbBoard = add('board', 900, 118, { title: '🏆 RICHEST PLAYERS', act: 'leaderboard', label: 'View Leaderboard', footer: 'walk up & press E for the full board', rows: [] });
  var tourBoard = add('board', 1980, 118, { title: '🥇 WEEKLY TOURNAMENT', act: 'tournament', label: 'View Tournament', rows: [] });
  var wheelObj = add('wheel', 1440, 330);
  var crashObj = add('crash', 1100, 470);
  add('plinko', 1760, 460); add('plinko', 1890, 460);
  add('sign', 1440, 26, { text: 'HIGH STAKES', color: '#5cf2ff', size: 26, v: 2 });
  add('rope', 820, 540); add('rope', 2060, 540);
  // --- Main floor
  var bjTables = [add('blackjack', 980, 720, { v: 1, table: 'bj1' }), add('blackjack', 1440, 720, { v: 2, table: 'bj2' }), add('blackjack', 1900, 720, { v: 3, table: 'bj3' })];
  add('fountain', 1440, 1060);
  var roulObjs = [add('roulette', 980, 1250, { v: 0 }), add('roulette', 1900, 1250, { v: 1 })];
  // --- The ten newer games, placed through the casino like the originals
  function station(kind, x, y, stand) { var m = MORE_META[kind]; return add(stand ? 'gstand' : 'gtable', x, y, { kind: kind, act: kind, label: 'Play ' + m[1], v: x }); }
  station('baccarat', 1230, 1290); station('shell', 1440, 1290); station('war', 1650, 1290);
  add('pillar', 770, 580); add('pillar', 2110, 580); add('pillar', 770, 1400); add('pillar', 2110, 1400);
  // --- Lobby
  add('rug', 1440, 1800, { w: 320, h: 110, text: 'SCROLLS CASINO', col: '#7d1d36', size: 22 });
  add('atm', 790, 1640); add('atm', 872, 1640);
  // --- The Arcade: its own room east of the Duel Arena. Skill games that pay a little; nothing is wagered here.
  add('rug', 3264, 1100, { w: 520, h: 330, col: '#1b1250' });
  add('sign', 3100, 722, { text: 'THE ARCADE', color: '#b8ff5c', size: 26, v: 7 });
  var arcBoard = add('arcboard', 3480, 716, { rows: [{ n: 'Loading scores', v: '' }], footer: 'press E for every top ten' });
  station('echo', 3030, 960, true); station('aim', 3180, 960, true); station('mathrush', 3330, 960, true); station('trivia', 3480, 960, true);
  station('colorclash', 3105, 1250, true); station('pattern', 3255, 1250, true); station('scramble', 3405, 1250, true);
  add('easel', 3264, 1425, { title: 'ARCADE', lines: ['Skill games pay a little', 'Up to 5,000 a day', 'Nothing is wagered'] });
  add('plant', 2950, 1420); add('plant', 3570, 1420);
  station('penalty', 1860, 1650, true);
  add('wardrobe', 2060, 1640);
  add('easel', 1660, 1640, { title: 'WELCOME!', lines: ['Walk: WASD or click', 'E use · Q chat · T emote', 'Dance floor: the Lounge'] });
  add('couch', 1150, 2010, { col: '#5a189a' }); add('couch', 1730, 2010, { col: '#5a189a' });
  add('plant', 760, 2010); add('plant', 2120, 2010);
  add('exit', 1440, 2100);
  add('portal', 1200, 1650);
  // --- The Vault
  add('casebox', 2330, 192, { v: 0, label: 'Open Starter Case' }); add('casebox', 2700, 192, { v: 1, label: 'Open High Roller Case' });
  add('sign', 2515, 26, { text: 'THE VAULT', color: '#b185ff', size: 26, v: 3 });
  add('arena', 2515, 450);
  add('npc', 2262, 520, { look: A.NPC.guard, name: 'Vault Guard' });
  add('mines', 2330, 650); add('mines', 2700, 650);
  // --- Duel Arena
  add('ring', 2515, 1090, { w: 340, h: 200 });
  var flipObjs = [add('coinflip', 2330, 950, { duel: true }), add('coinflip', 2700, 950, { duel: true })];
  var diceObjs = [add('dice', 2330, 1320, { duel: true }), add('dice', 2700, 1320, { duel: true })];
  var duelBoard = add('duelboard', 2700, 812, { rows: [], footer: 'press E to see every open duel' });
  add('sign', 2515, 800, { text: 'DUEL ARENA', color: '#ff3b5c', size: 22, v: 5 });
  add('npc', 2515, 930, { look: A.NPC.duel, name: 'Duel Master' });
  // --- Shop
  add('shelf', 2300, 1452, { w: 120, items: [{ k: 'hat', v: 'cowboy' }, { k: 'hat', v: 'wizard' }, { k: 'hat', v: 'pirate' }, { k: 'hat', v: 'santa' }] });
  add('shelf', 2740, 1452, { w: 120, items: [{ k: 'hat', v: 'top' }, { k: 'hat', v: 'flowers' }, { k: 'hat', v: 'grad' }, { k: 'hat', v: 'antlers' }] });
  add('sign', 2520, 1412, { text: 'SHOP', color: '#ffd166', size: 24, v: 4 });
  add('shop', 2620, 1640);
  add('rug', 2470, 1900, { w: 230, h: 300, col: '#1d4f7a' });
  [[2420, 1780, { skin: 'dragon', body: 'm:galaxy', hat: 'crown', acc: 'wings' }], [2530, 1780, { skin: 'unicorn', body: '#ffffff', hat: 'flowers', acc: 'hearts' }],
   [2420, 1920, { skin: 'knight', body: '#c1121f', hat: '', acc: 'cape' }], [2530, 1920, { skin: 'astro', body: '#ff922b', hat: '', acc: 'medal' }],
   [2420, 2050, { skin: 'ninja', body: '#1b1b2a', hat: '', acc: '' }], [2530, 2050, { skin: 'shark', body: '#3a86ff', hat: 'pirate', acc: 'chain' }]].forEach(function (m) { add('npc', m[0], m[1], { look: m[2], stand: true }); });
  add('wardrobe', 2716, 1900);
  add('plant', 2790, 2030);

  // --- The Owner Vault. Everyone can see the small hatch in The Vault; the big hall below it (rows 44+) is never drawn for
  // anyone who is not standing in it, and the server never sends them a word about who is down there.
  var hatchObj = add('vhatch', 2515, 128);
  // --- floor dressing first, so the rugs sit under the carpet and the carpet under everything else
  [[1632, 2470, 340, '255,59,92', 0.09], [1632, 3190, 400, '92,242,255', 0.06], [1632, 3900, 340, '180,120,255', 0.08], [1632, 4590, 360, '255,59,92', 0.11], [1632, 5180, 340, '255,110,199', 0.07], [1632, 5700, 320, '255,170,90', 0.08]].forEach(function (q) { add('vpool', q[0], q[1], { r: q[2], col: q[3], a: q[4] }); });
  add('vzone', 1632, 2650, { w: 620, h: 190, title: 'SERVICES', col: '30,16,44' });
  add('vzone', 1632, 3190, { w: 620, h: 700, title: 'COMMAND CENTER', col: '14,22,44' });
  add('vzone', 1632, 3900, { w: 620, h: 560, title: 'WARP HUB', col: '34,16,60' });
  add('vzone', 1632, 4560, { w: 620, h: 620, title: 'ARMORY', col: '48,12,24' });
  add('vzone', 1632, 5180, { w: 620, h: 500, title: 'PARTY ROOM', col: '50,16,50' });
  add('vzone', 1632, 5690, { w: 620, h: 380, title: 'LOUNGE', col: '44,26,16' });
  add('vcarpet', 1632, 5430, { len: 3000 });
  add('vrune', 1632, 4590, { len: 8, r: 150 });
  // --- entrance
  add('vladder', 1632, 2330);
  add('sign', 1632, 2186, { text: 'OWNER VAULT', color: '#ff3b5c', size: 30, v: 14 });
  [1380, 1884].forEach(function (bx) { add('vbanner', bx, 2264); });
  add('brazier', 1350, 2350); add('brazier', 1914, 2350); add('plant', 1340, 2480); add('plant', 1924, 2480);
  add('wardrobe', 1400, 2715); add('atm', 1864, 2705);
  // --- command center
  add('cctv', 1632, 2985); add('modterm', 1400, 3020, { title: 'MOD MENU' }); add('rigcon', 1864, 3020);
  add('radar', 1632, 3230); add('serverrack', 1334, 3190); add('serverrack', 1930, 3190);
  add('modterm', 1400, 3360, { title: 'POWERS & WARPS', tab: 'me', label: 'Powers and warp pads' }); add('shame', 1864, 3380);
  add('podium', 1632, 3480, { tab: 'cast' });
  // --- warp hub: eight pads, one for every spot in the casino
  [['lobby', 'Lobby', '🏠', '120,200,255'], ['slots', 'Slot Alley', '🎰', '255,110,199'], ['stakes', 'High Stakes', '💎', '92,242,255'], ['lounge', 'Lounge', '🛋️', '255,170,90'],
   ['vault', 'The Vault', '🗝️', '255,209,102'], ['arena', 'Duel Arena', '⚔️', '255,92,108'], ['shop', 'Shop', '🛍️', '125,255,154'], ['arcade', 'Arcade', '🕹️', '177,133,255']].forEach(function (q, i) {
    add('vpad', i < 4 ? 1480 : 1784, 3770 + (i % 4) * 110, { spot: q[0], name: q[1], icon: q[2], col: q[3], label: 'Warp to ' + q[1] });
  });
  // --- armory
  add('hammer', 1632, 4590);
  add('rack', 1380, 4350); add('rack', 1884, 4350); add('tcase', 1362, 4590); add('tcase', 1902, 4590);
  add('obelisk', 1400, 4780); add('obelisk', 1864, 4780); add('brazier', 1540, 4800); add('brazier', 1724, 4800);
  // --- party room
  [['fireworks', 1390, 'Launch fireworks'], ['party', 1510, 'Confetti party'], ['disco', 1632, 'Disco lights'], ['storm', 1754, 'Summon a storm'], ['snow', 1874, 'Make it snow']].forEach(function (q) { add('fxm', q[1], 5090, { k: q[0], label: q[2] }); });
  add('fxm', 1480, 5290, { k: 'rain', act: 'modmenu', tab: 'casino', label: 'Coin rain' }); add('fxm', 1784, 5290, { k: 'raffle', act: 'modmenu', tab: 'casino', label: 'Run a raffle' });
  add('speaker', 1350, 5390); add('speaker', 1914, 5390);
  // --- lounge
  add('plant', 1330, 5510); add('plant', 1934, 5510); add('bookcase', 1350, 5640); add('piano', 1850, 5600);
  add('aquarium', 1632, 5620); add('lounge', 1440, 5760, { col: '#7d1424' }); add('lounge', 1824, 5760, { col: '#7d1424' });
  add('fire', 1400, 5885); add('goldpile', 1864, 5885); add('throne', 1632, 5885); add('brazier', 1520, 5890); add('brazier', 1744, 5890);
  [[1340, 3640], [1924, 3640], [1340, 4200], [1924, 4200], [1340, 4900], [1924, 4900]].forEach(function (b) { add('lamp', b[0], b[1]); });
  [2560, 4960].forEach(function (py) { add('pillar', 1380, py); add('pillar', 1884, py); });

  // The Arcade board on the wall shows each game's champion; it refreshes every minute and flips pages every few seconds.
  var ARC_NAMES = [['echo', '🎵 Echo'], ['aim', '🎯 Aim'], ['mathrush', '🧮 Math'], ['trivia', '❓ Trivia'], ['colorclash', '🎨 Color'], ['pattern', '🔢 Pattern'], ['scramble', '🔤 Words']], ARC_KEY = { mathrush: 'math', colorclash: 'color' }, arcData = null, arcPage = 0;
  function arcRows() {
    if (!arcData) return; var rows = ARC_NAMES.map(function (g) { var l = arcData[ARC_KEY[g[0]] || g[0]] || arcData[g[0]] || []; return l[0] ? { n: g[1].split(' ')[0] + ' ' + l[0].nick, v: String(l[0].score) } : { n: g[1].split(' ')[0] + ' open', v: '-' }; });
    arcBoard.rows = rows.slice(arcPage * 4, arcPage * 4 + 4);
  }
  function arcPoll() { if (!SC.api) return; SC.api('g/arcade/board', {}).then(function (d) { if (d && d.ok) { arcData = d.boards; SC.arcBoards = d.boards; arcRows(); } }).catch(function () {}); }
  setTimeout(arcPoll, 3500); setInterval(arcPoll, 60000); setInterval(function () { arcPage = (arcPage + 1) % 2; arcRows(); }, 5000);

  var BOXES = OBJ.filter(function (o) { return o.box; }).map(function (o) { return o.box; });
  var ACTS = OBJ.filter(function (o) { return o.act; });

  // Tile grid for click-to-walk pathfinding (walls + furniture are blocked).
  var BLOCK = [];
  (function () {
    for (var ty = 0; ty < ROWS; ty++) { BLOCK.push([]); for (var tx = 0; tx < COLS; tx++) {
      var b = G[ty][tx] === '#';
      if (!b) { var x0 = tx * T + 8, x1 = tx * T + T - 8, y0 = ty * T + 8, y1 = ty * T + T - 8; for (var i = 0; i < BOXES.length; i++) { var q = BOXES[i]; if (x1 > q[0] && x0 < q[2] && y1 > q[1] && y0 < q[3]) { b = true; break; } } }
      BLOCK[ty].push(b);
    } }
  })();

  // ---- The hatch in The Vault slides open when an owner stands near it (everyone watching sees that, nothing more).
  var GATE = SC.vault.gate, gateNear = false;
  function gateTick(dt) {
    var gx = hatchObj.x, gy = hatchObj.y, near = false, id, q;
    if (me.y < PUBH) {
      if (me.own && Math.hypot(me.x - gx, me.y - gy) < 150) near = true;
      if (!near) for (id in players) { q = players[id]; if (q.own && !q.leaving && Math.hypot(q.x - gx, q.y - gy) < 150) { near = true; break; } }
    }
    if (!near && me.y < PUBH && ventBusy()) near = true;
    if (near !== gateNear) { gateNear = near; if (me.y < PUBH && Math.hypot(me.x - gx, me.y - gy) < 700) sfx(near ? 'gate' : 'gateclose'); }
    GATE.open = clamp(GATE.open + (near ? dt / 0.7 : -dt / 0.9), 0, 1);
  }
  function fade() {
    var f = $('vfade'); if (!f) { f = document.createElement('div'); f.id = 'vfade'; f.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:70;transition:opacity .22s'; document.body.appendChild(f); }
    f.style.opacity = '1'; clearTimeout(f._t); f._t = setTimeout(function () { f.style.opacity = '0'; }, 420);
  }

  // ================================================================ STATE
  var me = { id: 0, x: 1440, y: 1824, dir: 0, mv: false, walk: 0, look: { skin: 'gim', body: '#3fa9ff' }, cos: {}, nick: '', cid: '', emote: null, busy: '', idle: 0, own: false, fast: false, scale: 1, frozen: false, hammer: false, drink: null };
  var players = {}, parts = [], pops = [], tnow = 0, storeById = {}, QC = [];
  SC.myId = function () { return me.id; };
  var GAME_NAME = { slots: 'Slots', blackjack: 'Blackjack', roulette: 'Roulette', dice: 'Dice', coinflip: 'Coinflip', duels: 'Duels', mines: 'Mines', plinko: 'Plinko', wheel: 'the Big Wheel', crash: 'Crash', cases: 'Cases', battles: 'Case Battles', jackpot: 'the PROGRESSIVE JACKPOT', echo: 'Echo', aim: 'Aim', mathrush: 'Math Rush', trivia: 'Trivia Run', colorclash: 'Color Clash', pattern: 'Pattern Pro', scramble: 'Word Scramble' };
  var BUSY_ICON = { slots: '🎰', blackjack: '🃏', roulette: '🔴', dice: '🎲', coinflip: '🪙', duels: '⚔️', mines: '💣', plinko: '🔵', wheel: '🎡', crash: '🚀', cases: '📦', battles: '⚔️', shop: '🛍️', wardrobe: '👕', atm: '🏧', leaderboard: '🏆', tournament: '🥇', player: '💬', bar: '🍹', piano: '🎹', echo: '🎵', aim: '🎯', mathrush: '🧮', trivia: '❓', colorclash: '🎨', pattern: '🔢', scramble: '🔤', hiscores: '🏆' };

  function lookFromProfile(p) {
    var L = p.look || {}, out = {};
    ['skin', 'body', 'hat', 'acc', 'trail'].forEach(function (k) { var it = L[k] && storeById[L[k]]; out[k] = it ? it.value : (k === 'skin' ? 'gim' : k === 'body' ? '#3fa9ff' : ''); });
    return out;
  }
  function onDance(x, y) { return tileAt(Math.floor(x / T), Math.floor((y - 4) / T)) === 'd'; }

  // ================================================================ CANVAS
  var cv = $('world'), ctx = cv.getContext('2d');
  var DPR = 1, Z = 1, VW = 0, VH = 0, cam = { x: 0, y: 0 }, tileCache = {}, vign = null, glowImg = null;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); VW = innerWidth; VH = innerHeight;
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    Z = clamp(Math.min(VW / 1100, VH / 700), 0.52, 1.3);
    var zq = /[?&]zoom=([\d.]+)/.exec(location.search); if (zq) Z = clamp(+zq[1], 0.2, 2); // overview / screenshots
    tileCache = {};
    vign = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    vign.addColorStop(0, 'rgba(8,5,25,0)'); vign.addColorStop(1, 'rgba(8,5,25,.45)');
  }
  window.addEventListener('resize', resize); resize();
  (function () { var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'); var gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glowImg = c; })();
  function tileImg(key, draw) {
    var c = tileCache[key]; if (c) return c;
    var S = Math.ceil(T * Z * DPR) + 1; c = document.createElement('canvas'); c.width = S; c.height = S;
    draw(c.getContext('2d'), S); tileCache[key] = c; return c;
  }
  var shadowStrip = (function () { var c = document.createElement('canvas'); c.width = 4; c.height = 32; var g = c.getContext('2d'); var gr = g.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(8,5,25,.45)'); gr.addColorStop(1, 'rgba(8,5,25,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 32); return c; })();

  function drawTiles() {
    var tx0 = Math.max(0, Math.floor(cam.x / T) - 1), ty0 = Math.max(0, Math.floor(cam.y / T) - 1);
    var tx1 = Math.min(COLS - 1, Math.ceil((cam.x + VW / Z) / T) + 1), ty1 = Math.min(ROWS - 1, Math.ceil((cam.y + VH / Z) / T) + 1);
    var ty, tx, ch, vm = me.y > PUBH; ty0 = Math.max(ty0, vm ? 44 : 0); ty1 = Math.min(ty1, vm ? ROWS - 1 : 43);   // nobody sees the hidden hall unless they are standing in it
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
      ch = G[ty][tx]; if (ch === '#') continue;
      if (ch === 'd') { A.danceTile(ctx, tx * T, ty * T, tx, ty, tnow); continue; }
      var v = ch === 'g' || ch === 'a' ? (tx + ty) % 2 : ch === 'w' ? tx % 3 : 0;
      var img = tileImg(ch + v, function (g, S) { A.floorTile(g, ch, 0, 0, S, v); });
      ctx.drawImage(img, tx * T, ty * T, T + 0.5, T + 0.5);
    }
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
      if (G[ty][tx] !== '#') continue;
      var below = tileAt(tx, ty + 1), face = ty + 1 < ROWS && below !== '#';
      var key = face ? 'F' + below : 'W';
      var img2 = tileImg(key, function (g, S) { A.wallTile(g, 0, 0, S, face, below, null); });
      ctx.drawImage(img2, tx * T, ty * T, T + 0.5, T + 0.5);
      ctx.fillStyle = A.OL;
      if (tileAt(tx - 1, ty) !== '#' && tx > 0) ctx.fillRect(tx * T - 1.5, ty * T, 3, T);
      if (tileAt(tx + 1, ty) !== '#' && tx < COLS - 1) ctx.fillRect(tx * T + T - 1.5, ty * T, 3, T);
      if (ty > 0 && tileAt(tx, ty - 1) !== '#') ctx.fillRect(tx * T, ty * T - 1.5, T, 3);
      if (face) { ctx.fillRect(tx * T, ty * T + T - 1.5, T, 3); ctx.drawImage(shadowStrip, tx * T, (ty + 1) * T, T, 14); }
    }
  }

  // ================================================================ INPUT
  var keys = {}, joy = { x: 0, y: 0, on: false }, path = null, pathAct = null;
  var panelOpen = function () { return $('panel').classList.contains('open') || $('imodal').style.display === 'flex'; };
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (e.key === 'Escape') { if ($('emotes').classList.contains('open')) { toggleEmotes(false); return; } if ($('qchat').classList.contains('open')) { toggleQuick(false); return; } if (panelOpen()) { closePanel(); return; } }
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (panelOpen()) return;
    var k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    keys[k] = true;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) { path = null; pathAct = null; }
    if (k === 'e' || k === 'enter' || k === ' ') { if (!e.repeat) interact(); }
    else if (k === 't') { if (!e.repeat) toggleEmotes(); }
    else if (k === 'q') { if (!e.repeat) toggleQuick(); }
    else if (/^[1-9]$/.test(k)) { var em = ownedEmotes()[+k - 1]; if (em) sendEmote(em.id); }
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', function () { keys = {}; });
  cv.addEventListener('mousedown', function (e) {
    cv.focus(); toggleEmotes(false); toggleQuick(false);
    if (promptRect && e.clientX >= promptRect[0] && e.clientX <= promptRect[2] && e.clientY >= promptRect[1] && e.clientY <= promptRect[3]) { interact(); return; }
    var wx = cam.x + e.clientX / Z, wy = cam.y + e.clientY / Z;
    // Clicked on something you can use? Walk to it and use it on arrival.
    var hit = null, hd = 1e9;
    ACTS.forEach(function (o) { if (o.ownerOnly && !me.own) return; var top = o.layer === 'wall' ? o.y - 110 : o.y - 140, x0 = o.x - (o.box ? (o.box[2] - o.box[0]) / 2 + 10 : 70); if (wx > x0 && wx < 2 * o.x - x0 && wy > top && wy < o.y + 34) { var d = Math.hypot(wx - o.x, wy - (o.y - 40)); if (d < hd) { hd = d; hit = o; } } });
    for (var id in players) { var p = players[id]; if (Math.abs(wx - p.x) < 22 && wy > p.y - 56 && wy < p.y + 4) { hit = { act: 'player', p: p, ax: p.x, ay: p.y + 20, x: p.x }; break; } }
    if (hit) {
      if (Math.hypot(me.x - hit.ax, me.y - hit.ay) < (hit.ar || 56)) { target = hit.act === 'player' ? { act: 'player', p: hit.p } : hit; interact(); return; }
      walkTo(hit.ax, hit.ay, hit); return;
    }
    walkTo(wx, wy, null);
  });
  // touch
  var isTouch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  if (isTouch) document.body.classList.add('touch');
  (function () {
    var zone = $('joy'), base = $('joyBase'), knob = $('joyKnob'), tid = null, ox = 0, oy = 0;
    zone.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; tid = t.identifier; ox = t.clientX; oy = t.clientY; base.style.display = 'block'; base.style.left = (ox - 60) + 'px'; base.style.top = (oy - 60) + 'px'; joy.on = true; path = null; e.preventDefault(); }, { passive: false });
    zone.addEventListener('touchmove', function (e) { for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (t.identifier !== tid) continue; var dx = t.clientX - ox, dy = t.clientY - oy, d = Math.hypot(dx, dy), m = Math.min(d, 50); if (d > 0) { dx = dx / d * m; dy = dy / d * m; } knob.style.left = (35 + dx) + 'px'; knob.style.top = (35 + dy) + 'px'; joy.x = dx / 50; joy.y = dy / 50; } e.preventDefault(); }, { passive: false });
    var end = function (e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === tid) { joy.on = false; joy.x = joy.y = 0; base.style.display = 'none'; knob.style.left = knob.style.top = '35px'; tid = null; } };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    $('actBtn').addEventListener('click', function () { interact(); });
    $('emoBtnM').addEventListener('click', function () { toggleEmotes(); });
    $('qcBtnM').addEventListener('click', function () { toggleQuick(); });
  })();
  $('emoBtn').onclick = function () { toggleEmotes(); };
  $('qcBtn').onclick = function () { toggleQuick(); };
  $('fsBtn').onclick = function () { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} };
  $('onlineBtn').onclick = function () { var l = $('onlineList'); l.style.display = l.style.display === 'block' ? 'none' : 'block'; renderOnline(); };
  // ---- proximity voice button (Off -> On -> Muted -> Off)
  var voiceWas = false;
  function voiceSync() {
    var V = window.BWV, b = $('vcBtn'); if (!b) return;
    b.textContent = !V || !V.on ? '🎙️ Talk' : V.muted ? '🔇 Muted' : V.talking ? '🎙️ Talking' : '🎙️ On';
    b.classList.toggle('von', !!(V && V.on && !V.muted)); b.classList.toggle('vmute', !!(V && V.on && V.muted)); b.classList.toggle('vtalk', !!(V && V.on && V.talking));
  }
  function sendBin(buf) { try { if (ws && ws.readyState === 1 && ws.bufferedAmount < 64000) ws.send(buf); } catch (e) {} }
  $('vcBtn').onclick = function () {
    var V = window.BWV; if (!V) return;
    if (!V.supported()) { toast('Voice chat isn’t supported in this browser'); return; }
    if (!V.on) { $('vcBtn').textContent = '🎙️ …'; V.start(sendBin).then(function () { netSend({ t: 'vc', on: true }); voiceSync(); toast('🎙️ Mic on — people near you can hear you. V = mute'); }).catch(function () { voiceSync(); toast('🎙️ Allow microphone access to use voice chat'); }); }
    else { V.setMuted(!V.muted); voiceSync(); toast(V.muted ? '🔇 Mic muted — you still hear people nearby' : '🎙️ Mic on'); }
  };
  if (window.BWV) BWV.listen(); // hear nearby players right away (no mic needed)
  window.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key.toLowerCase() === 'v' && window.BWV && BWV.on) { BWV.setMuted(!BWV.muted); voiceSync(); toast(BWV.muted ? '🔇 Mic muted (V to talk)' : '🎙️ Mic on'); }
  });
  function muteIcon() { $('muteBtn').textContent = SC.sfxMuted && SC.sfxMuted() ? '🔇' : '🔊'; if ($('musicBtn')) $('musicBtn').style.opacity = window.SHMusic && SHMusic.isOff() ? '.45' : '1'; }
  if ($('musicBtn')) $('musicBtn').onclick = function () { if (window.SHMusic) { toast(SHMusic.toggle() ? '🎵 Music off' : '🎵 Music on'); muteIcon(); } };
  $('muteBtn').onclick = function () { SC.sfxToggle && SC.sfxToggle(); muteIcon(); sfx('click'); }; muteIcon();
  setTimeout(function () { $('hint').style.opacity = '0'; }, 14000);

  // ================================================================ PATHFINDING (click to walk)
  function walkTo(wx, wy, obj) {
    var sx = Math.floor(me.x / T), sy = Math.floor((me.y - 5) / T), gx = clamp(Math.floor(wx / T), 0, COLS - 1), gy = clamp(Math.floor((wy - 5) / T), 0, ROWS - 1);
    if (BLOCK[gy][gx]) { // nearest open tile to the click
      var best = null, bd = 1e9; for (var r = 1; r < 5 && !best; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) { var nx = gx + dx, ny = gy + dy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || BLOCK[ny][nx]) continue; var d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [nx, ny]; } }
      if (!best) return; gx = best[0]; gy = best[1]; wx = gx * T + T / 2; wy = gy * T + T / 2 + 10;
    }
    var key = function (x, y) { return y * COLS + x; }, open = [[sx, sy]], came = {}, gsc = {}; gsc[key(sx, sy)] = 0;
    var h = function (x, y) { return Math.hypot(x - gx, y - gy); }, fsc = {}; fsc[key(sx, sy)] = h(sx, sy);
    var found = false, it = 0;
    while (open.length && it++ < 4000) {
      var bi = 0; for (var i = 1; i < open.length; i++) if (fsc[key(open[i][0], open[i][1])] < fsc[key(open[bi][0], open[bi][1])]) bi = i;
      var c = open.splice(bi, 1)[0]; if (c[0] === gx && c[1] === gy) { found = true; break; }
      for (var ddy = -1; ddy <= 1; ddy++) for (var ddx = -1; ddx <= 1; ddx++) {
        if (!ddx && !ddy) continue; var nx2 = c[0] + ddx, ny2 = c[1] + ddy;
        if (nx2 < 0 || ny2 < 0 || nx2 >= COLS || ny2 >= ROWS || BLOCK[ny2][nx2]) continue;
        if (ddx && ddy && (BLOCK[c[1]][nx2] || BLOCK[ny2][c[0]])) continue; // no corner cutting
        var g2 = gsc[key(c[0], c[1])] + (ddx && ddy ? 1.414 : 1), k2 = key(nx2, ny2);
        if (gsc[k2] == null || g2 < gsc[k2]) { gsc[k2] = g2; fsc[k2] = g2 + h(nx2, ny2); came[k2] = c; if (!open.some(function (o) { return o[0] === nx2 && o[1] === ny2; })) open.push([nx2, ny2]); }
      }
    }
    if (!found && !(sx === gx && sy === gy)) { toast("Can't walk there"); return; }
    var pts = [[wx, wy]], cur = [gx, gy];
    while (came[key(cur[0], cur[1])]) { cur = came[key(cur[0], cur[1])]; if (cur[0] === sx && cur[1] === sy) break; pts.unshift([cur[0] * T + T / 2, cur[1] * T + T / 2 + 10]); }
    path = pts; pathAct = obj; marker = { x: wx, y: wy, at: tnow };
  }
  var marker = null;
  SC.walkToSeat = function (table, i) {
    var o = bjTables.filter(function (b) { return b.table === table; })[0]; if (!o) return;
    var sx = o.x + A.BJ_SEAT_DX[i], sy = o.y + 40;
    path = [[sx, sy]]; pathAct = null; seatFace = { x: sx, y: sy };
  };
  var seatFace = null;
  // Tutorial hook: screen rectangle (CSS px) of the nearest object of a type, so the hub can spotlight it.
  SC.tourRect = function (type) {
    var best = null, bd = 1e9;
    OBJ.forEach(function (o) { if (o.type !== type) return; var d = Math.hypot(me.x - o.x, me.y - o.y); if (d < bd) { bd = d; best = o; } });
    if (!best) return null;
    var x0 = (best.x - 40 - cam.x) * Z, y0 = (best.y - 92 - cam.y) * Z, w = 80 * Z, hh = 100 * Z;
    return { x: x0, y: y0, w: w, h: hh, on: x0 > 0 && y0 > 0 && x0 + w < VW && y0 + hh < VH, dx: best.x - me.x, dy: best.y - me.y };
  };
  // Tutorial hook: auto-walk (same pathfinding as click-to-walk) to the nearest machine of a type and use it on arrival.
  SC.tourWalk = function (type) {
    var best = null, bd = 1e9;
    OBJ.forEach(function (o) { if (o.type !== type || !o.act) return; var d = Math.hypot(me.x - o.x, me.y - o.y); if (d < bd) { bd = d; best = o; } });
    if (best) walkTo(best.ax, best.ay, best);
  };
  SC.nearType = function (type) { var b = 1e9; OBJ.forEach(function (o) { if (o.type === type) b = Math.min(b, Math.hypot(me.x - o.x, me.y - o.y)); }); return b; };

  // ================================================================ MOVEMENT
  function hits(x, y) {
    var x0 = x - 12, x1 = x + 12, y0 = y - 10, y1 = y;
    if (x0 < 0 || x1 > WW || y0 < 0 || y1 > WH - 2) return true;
    var tx0 = Math.floor(x0 / T), tx1 = Math.floor(x1 / T), ty0 = Math.floor(y0 / T), ty1 = Math.floor(y1 / T);
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) if (tileAt(tx, ty) === '#') return true;
    for (var i = 0; i < BOXES.length; i++) { var b = BOXES[i]; if (x1 > b[0] && x0 < b[2] && y1 > b[1] && y0 < b[3]) return true; }
    return false;
  }
  var dustT = 0;
  function update(dt) {
    if (window.BWV && BWV.hearing) BWV.tick(me.x, me.y, function (id) { var q = players[id]; return q && !q.leaving ? { x: q.x, y: q.y } : null; });
    if (window.BWV && BWV.on && BWV.talking !== voiceWas) { voiceWas = BWV.talking; voiceSync(); }
    var ix = 0, iy = 0;
    if (!panelOpen()) {
      if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
      if (keys.w || keys.arrowup) iy -= 1; if (keys.s || keys.arrowdown) iy += 1;
      if (joy.on && Math.hypot(joy.x, joy.y) > 0.18) { ix = joy.x; iy = joy.y; }
      if (!ix && !iy && path && path.length) {
        var wp = path[0], dx = wp[0] - me.x, dy = wp[1] - me.y, dd = Math.hypot(dx, dy);
        if (dd < (path.length > 1 ? 14 : 4)) { path.shift(); if (!path.length) { path = null; if (pathAct) { target = pathAct; var pa = pathAct; pathAct = null; setTimeout(function () { target = pa.act === 'player' ? { act: 'player', p: pa.p } : pa; interact(); }, 60); } if (seatFace) { me.dir = 3; seatFace = null; } } }
        else { ix = dx / dd; iy = dy / dd; if (dd < 20) { ix *= dd / 20; iy *= dd / 20; } }
      }
    }
    if (me.frozen || (me.ventUntil && performance.now() < me.ventUntil)) { ix = iy = 0; path = null; }
    var len = Math.hypot(ix, iy);
    me.mv = len > 0.01;
    if (me.mv) {
      if (len > 1) { ix /= len; iy /= len; }
      var sp = SPEED * (me.fast ? 2 : 1) * Math.min(1, joy.on ? Math.max(0.45, len) : Math.max(0.3, len));
      var nx = me.x + ix * sp * dt, ny = me.y + iy * sp * dt, moved = false;
      if (!hits(nx, me.y)) { me.x = nx; moved = true; } else {
        if (!hits(nx, me.y - 6) && iy <= 0) { me.x = nx; me.y -= 6 * dt * 10; moved = true; } else if (!hits(nx, me.y + 6) && iy >= 0) { me.x = nx; me.y += 6 * dt * 10; moved = true; }
      }
      if (!hits(me.x, ny)) { me.y = ny; moved = true; }
      if (!moved && path) { path = null; pathAct = null; }
      me.dir = Math.abs(ix) > Math.abs(iy) ? (ix < 0 ? 1 : 2) : (iy < 0 ? 3 : 0);
      me.walk += dt * 13; me.idle = 0; footstep(dt);
      if ((dustT += dt) > 0.22) { dustT = 0; parts.push({ kind: 'dust', x: me.x + (Math.random() - 0.5) * 10, y: me.y - 2, vx: -ix * 20, vy: -8, life: 0, max: 0.45, rot: 0 }); }
    } else me.idle += dt;
    me.dance = !me.mv && me.idle > 0.4 && onDance(me.x, me.y);
    if (window.SHMusic) SHMusic.want(onDance(me.x, me.y) ? 'disco' : 'casino');
    // remote interpolation
    for (var id in players) {
      var p = players[id], f = Math.min(1, dt * 12);
      if (p.leaving && performance.now() - p.leaving > 2500) { delete players[id]; updateOnlineCount(); continue; }
      p.x += (p.tx - p.x) * f; p.y += (p.ty - p.y) * f;
      var moving = p.mv || Math.hypot(p.tx - p.x, p.ty - p.y) > 2;
      if (moving) { p.walk += dt * 13; p.idle = 0; } else p.idle = (p.idle || 0) + dt;
      p.moving = moving; p.dance = !moving && p.idle > 0.4 && onDance(p.x, p.y);
      if (moving && p.look.trail && (p._tr = (p._tr || 0) + dt) > 0.045) { p._tr = 0; A.spawnTrail(parts, p.look.trail, p.x, p.y, tnow); }
    }
    if (me.mv && me.look.trail && (me._tr = (me._tr || 0) + dt) > 0.045) { me._tr = 0; A.spawnTrail(parts, me.look.trail, me.x, me.y, tnow); }
    // camera
    var vw = VW / Z, vh = VH / Z;
    var tx = me.x - vw / 2, ty = me.y - 30 - vh / 2;
    var ctop = me.y > PUBH ? PUBH : 0, cbot = me.y > PUBH ? WH : PUBH, cah = cbot - ctop;
    if (me.y > PUBH) { var hx0 = 27 * T - 64, hx1 = 41 * T + 64; tx = vw >= hx1 - hx0 ? (hx0 + hx1 - vw) / 2 : clamp(tx, hx0, hx1 - vw); } else
    tx = vw >= WW ? (WW - vw) / 2 : clamp(tx, 0, WW - vw); ty = vh >= cah ? ctop + (cah - vh) / 2 : clamp(ty, ctop, cbot - vh);
    var cf = cam._init ? Math.min(1, dt * 8) : 1; cam._init = true;
    cam.x += (tx - cam.x) * cf; cam.y += (ty - cam.y) * cf;
    gateTick(dt);
    netTick();
    findTarget();
  }

  // ================================================================ INTERACTION
  var target = null, promptRect = null;
  function findTarget() {
    target = null; if (panelOpen()) return;
    var best = 1e9;
    for (var i = 0; i < ACTS.length; i++) { var o = ACTS[i]; if (o.ownerOnly && !me.own) continue; var d = Math.hypot(me.x - o.ax, me.y - o.ay); if (d < o.ar && d < best) { best = d; target = o; } }
    var swing = me.own && me.hammer, pbest = 1e9;
    for (var id in players) { var p = players[id], d2 = Math.hypot(me.x - p.x, me.y - p.y); if (swing && !p.own) { if (d2 < 96 && d2 < pbest) { pbest = d2; best = -1; target = { act: 'player', p: p, label: 'Talk to ' + p.nick, ax: p.x, ay: p.y, x: p.x, py: p.y - (p.look.hat ? 100 : 86) }; } continue; } if (best >= 0 && d2 < 54 && d2 < best - 10) { best = d2; target = { act: 'player', p: p, label: 'Talk to ' + p.nick, ax: p.x, ay: p.y, x: p.x, py: p.y - (p.look.hat ? 100 : 86) }; } }
    var ab = $('actBtn');
    if (target && target.act === 'player' && me.own && me.hammer && !target.p.own) target.label = 'Swing the hammer at ' + target.p.nick;
    if (target) { ab.classList.add('show'); ab.textContent = target.act === 'player' ? (me.own && me.hammer && !target.p.own ? 'SWING' : 'HI') : target.act === 'exit' ? 'EXIT' : 'USE'; } else ab.classList.remove('show');
  }
  function interact() {
    if (!target || panelOpen()) return;
    if (target.act === 'descend') { if (me.own && !(me.ventUntil && performance.now() < me.ventUntil)) { startVent(me, 'in'); setTimeout(fade, 860); netSend({ t: 'v', op: 'enter' }); } return; }
    if (target.act === 'ascend') { if (me.own) { fade(); netSend({ t: 'v', op: 'leave' }); } return; }
    if (target.act === 'warp') { if (me.own) { fade(); netSend({ t: 'v', op: 'warp', spot: target.spot }); } return; }
    if (target.act === 'fx') { if (me.own) { target.hit = performance.now(); netSend({ t: 'v', op: 'fx', k: target.k }); sfx('click'); } return; }
    if (target.act === 'player' && me.own && me.hammer && !target.p.own && SC.hammerPick) return SC.hammerPick(target.p);
    if (target.act === 'player') return openPanel('player', target.p);
    if (target.act === 'arcade') { sfx('open'); setTimeout(function () { location.href = '/arcade'; }, 180); return; }
    if (target.act === 'bar') {
      var pend = SC.bar.jobs.some(function (j) { return j.id === me.id && performance.now() - j.t0 < j.ms + 500; });
      if (pend) { toast('Your drink is on its way'); return; }
      netSend({ t: 'drink' }); sfx('click'); return;
    }
    SC.vault.tab = target.tab || '';
    if (target.act === 'piano') { var n = Math.floor(Math.random() * 15); netSend({ t: 'piano', n: n }); return; }
    openPanel(target.act, target);
  }

  // ================================================================ PANELS
  var META = {
    slots: ['🎰', 'Slots', 'Every spin feeds the progressive jackpot'], blackjack: ['🃏', 'Blackjack', 'Up to 5 players · beat the dealer'], roulette: ['🔴', 'Roulette', 'One wheel, everyone bets on the same spin'],
    dice: ['🎲', 'Dice', 'Duel other players or play the house'], coinflip: ['🪙', 'Coinflip', 'Duel other players or play the house'], hiscores: ['🏆', 'Arcade High Scores', 'The best round on the floor, per game'], duels: ['⚔️', 'Duel Board', 'Every open duel on the floor'], mines: ['💣', 'Mines', 'Find the gems, dodge the bombs'],
    plinko: ['🔵', 'Plinko', 'Drop it and pray'], wheel: ['🎡', 'The Big Wheel', 'Pick a color — everyone spins together'], crash: ['🚀', 'Crash', 'One rocket for everyone — cash out in time'],
    cases: ['📦', 'Case Vault', 'Open a case'],
    keno: MORE_META.keno, scratch: MORE_META.scratch, baccarat: MORE_META.baccarat, shell: MORE_META.shell, penalty: MORE_META.penalty, echo: MORE_META.echo, aim: MORE_META.aim, mathrush: MORE_META.mathrush, trivia: MORE_META.trivia, colorclash: MORE_META.colorclash, pattern: MORE_META.pattern, scramble: MORE_META.scramble, war: MORE_META.war, hilo: MORE_META.hilo, poker: MORE_META.poker, battles: ['⚔️', 'Case Battles', 'Open cases against other players'],
    leaderboard: ['🏆', 'Richest Players', 'Top balances on ScrollHub'], tournament: ['🥇', 'Weekly Tournament', 'Most Scrolls won this week'],
    atm: ['🏧', 'ATM', 'Daily Scrolls & event codes'], shop: ['🛍️', 'The Shop', 'Characters, colors, hats, trails & more'],
    owner: ['★', 'Owner Panel', 'Rig games for a player or for everyone'], hammer: ['🔨', 'The Ban Hammer', 'Remove a player. Every ban is logged.'], modmenu: ['🛡️', 'Mod Menu', 'Players, the whole casino, and you'], wardrobe: ['👕', 'Wardrobe', 'Dress up your character'], player: ['💬', 'Player', ''], exit: ['🚪', 'Exit', ''],
  };
  SC.panelKind = '';
  setTimeout(function () { SC.openPanel = openPanel; SC.dbg = { OBJ: OBJ, BLOCK: BLOCK, T: T, me: me, G: G, gate: hatchObj, bar: SC.bar, players: function () { return players; } }; }, 0);
  function openPanel(kind, data) {
    if (!META[kind]) return;
    toggleEmotes(false); toggleQuick(false); path = null;
    SC.panelKind = kind;
    var m = META[kind];
    $('pIco').textContent = m[0]; $('pTitle').textContent = m[1]; $('pSub').textContent = m[2];
    document.querySelectorAll('#panel .view').forEach(function (s) { s.classList.toggle('on', s.dataset.panel === kind); });
    $('duTabs').style.display = 'none';
    $('panel').classList.add('open');
    keys = {};
    if (data && data.ax != null && kind !== 'player') me.dir = data.ay > data.y ? 3 : 0;
    SC.games.open(kind);
    if (SC.mp) SC.mp.open(kind, data);
    if (kind === 'shop') renderShop();
    if (kind === 'wardrobe') renderWardrobe();
    if (kind === 'player') renderPlayer(data);
    if (kind === 'slots') renderJackpot();
    netSend({ t: 'busy', g: kind === 'exit' ? '' : kind });
    me.busy = kind; sfx('open');
  }
  function closePanel() {
    if (!panelOpen()) return;
    if ($('imodal').style.display === 'flex') { $('imodal').style.display = 'none'; return; }
    $('panel').classList.remove('open');
    SC.panelKind = ''; me.busy = '';
    if (SC.mp) SC.mp.close();
    previews = [];
    netSend({ t: 'busy', g: '' }); sfx('close');
    cv.focus();
  }
  $('pClose').onclick = closePanel;
  $('panel').addEventListener('mousedown', function (e) { if (e.target === $('panel')) closePanel(); });
  $('exStay').onclick = closePanel;
  $('exGo').onclick = function () { location.href = '/'; };
  function renderJackpot() { var j = (SC.gs && SC.gs.jp) || {}; $('slJp').textContent = '📜 ' + fmt(j.pool || 0); $('slJpLast').textContent = j.last ? 'last won by ' + j.last.nick + ' (' + fmt(j.last.amount) + ')' : ''; }

  // ================================================================ PREVIEWS (shop / wardrobe cards)
  var previews = [];
  function lookWith(it) { var L = Object.assign({}, me.look); if (it && ['skin', 'body', 'hat', 'acc', 'trail'].indexOf(it.type) >= 0) L[it.type] = it.value; return L; }
  function drawItemPreview(c, it, W, H, t, pp) {
    c.clearRect(0, 0, W, H);
    var k = W / 96; c.save(); c.scale(k, k);
    if (!it) { A.label(c, '∅', 48, 48, { size: 30, color: '#a9a3d6', stroke: false }); A.label(c, 'None', 48, 76, { size: 12, color: '#a9a3d6', stroke: false }); }
    else if (['skin', 'body', 'hat', 'acc', 'trail'].indexOf(it.type) >= 0) {
      var L = lookWith(it);
      if (it.type === 'trail') { if (Math.random() < 0.5) A.spawnTrail(pp, it.value, 30 + Math.random() * 12, 86, t); A.drawParticles(c, pp, 1 / 30); }
      var sc = it.type === 'hat' ? 1.2 : 1.3;
      A.drawGim(c, it.type === 'trail' ? 58 : 48, it.type === 'hat' ? 94 : 86, L, { t: t, scale: sc, dir: it.type === 'trail' ? 2 : 0, moving: it.type === 'trail', walk: t * 12, shadow: true, noSeason: true });
    } else if (it.type === 'emote') {
      if (it.value === 'GG') A.label(c, 'GG', 48, 50, { size: 34, color: '#ffd166' });
      else { c.font = '46px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(it.value, 48, 52 + Math.sin(t * 3) * 3); }
    } else if (it.type === 'tag') {
      c.font = '600 13px Fredoka, sans-serif'; var w = Math.min(88, c.measureText(it.label).width + 16);
      A.rr(c, 48 - w / 2, 36, w, 24, 10); c.fillStyle = '#120e2e'; c.fill(); c.strokeStyle = '#ffd166'; c.lineWidth = 2; c.stroke();
      A.label(c, it.label, 48, 48.5, { size: 12, color: '#fff', stroke: false });
    } else if (it.type === 'color') {
      A.label(c, 'Name', 48, 50, { size: 24, color: nameColor(it.value, t), glow: it.value.indexOf('fx:') === 0 ? nameColor(it.value, t) : null });
    } else if (it.type === 'banner') {
      var bg = it.value.indexOf('anim:') === 0 ? null : it.value;
      A.rr(c, 10, 26, 76, 44, 10);
      if (bg) { var m = bg.match(/#[0-9a-f]{6}/gi) || ['#555', '#999']; var g = c.createLinearGradient(10, 26, 86, 70); g.addColorStop(0, m[0]); g.addColorStop(1, m[1] || m[0]); c.fillStyle = g; }
      else { var g2 = c.createLinearGradient(10, 26, 86, 70); for (var i = 0; i < 4; i++) g2.addColorStop(i / 3, 'hsl(' + ((t * 60 + i * 80) % 360) + ',80%,55%)'); c.fillStyle = g2; }
      c.fill(); c.strokeStyle = '#120e2e'; c.lineWidth = 3; c.stroke();
    } else if (it.type === 'avatar' || it.type === 'titlefx') {
      var col = /rainbow/.test(it.value) ? 'hsl(' + ((t * 90) % 360) + ',90%,60%)' : /gold|shimmer/.test(it.value) ? '#ffd166' : /fire/.test(it.value) ? '#ff7a1a' : '#5cf2ff';
      if (it.type === 'avatar') { c.shadowColor = col; c.shadowBlur = 10 + Math.sin(t * 4) * 5; A.circ(c, 48, 48, 26); c.strokeStyle = col; c.lineWidth = 5; c.stroke(); c.shadowBlur = 0; A.circ(c, 48, 48, 21); c.fillStyle = '#3b2f8f'; c.fill(); A.label(c, '🙂', 48, 49, { size: 22, stroke: false }); }
      else A.label(c, 'TITLE', 48, 50, { size: 20, color: col, glow: col, blur: 8 + Math.sin(t * 4) * 4 });
    }
    c.restore();
  }
  var pvLast = 0;
  function animPreviews(t) { if (!previews.length || t - pvLast < 1 / 30) return; pvLast = t; for (var i = 0; i < previews.length; i++) { var p = previews[i]; if (p.cv.isConnected) p.draw(t); } }
  function addPreview(cv2, it) { var pp = [], c = cv2.getContext('2d'); var o = { cv: cv2, draw: function (t) { drawItemPreview(c, it, cv2.width, cv2.height, t, pp); } }; previews.push(o); o.draw(tnow); }

  // ================================================================ SHOP
  var SHOP_TABS = [['skin', 'Characters'], ['body', 'Colors'], ['hat', 'Hats'], ['acc', 'Accessories'], ['trail', 'Trails'], ['emote', 'Emotes'], ['tag', 'Name Tags'], ['color', 'Name Colors'], ['profile', 'Profile FX']];
  var SHOP_HINT = { skin: 'Your character. Free ones are ready to wear — rarer ones are fancier.', body: 'Paint your character. Gold, Chrome, Lava, Galaxy and Rainbow are animated.', hat: 'Hats show up on your character for everyone to see.', acc: 'Glasses, chains, capes, wings and more.', trail: 'Leave something behind wherever you walk.', emote: 'Pop an emote over your head with T or the number keys.', tag: 'A title shown above your name — in the casino and in chat.', color: 'Color your name — in the casino and in chat.', profile: 'Profile banners, avatar rings and title effects for your ScrollHub profile.' };
  var shopTab = 'skin';
  function owns(it) { var p = state.profile; return !!p && ((it.price === 0 && !it.staff) || p.inventory.indexOf(it.id) >= 0); }
  function isEquipped(it) {
    var p = state.profile; if (!p) return false; var L = p.look || {};
    if (['skin', 'body', 'hat', 'acc', 'trail'].indexOf(it.type) >= 0) return L[it.type] === it.id;
    if (it.type === 'tag') return p.tag === it.label; if (it.type === 'color') return p.color === it.value;
    if (it.type === 'banner') return p.banner === it.value; if (it.type === 'avatar') return p.avatarFx === it.value; if (it.type === 'titlefx') return p.titleFx === it.value;
    return false;
  }
  function tabItems(tab) { return state.store.filter(function (it) { return tab === 'profile' ? (it.type === 'banner' || it.type === 'avatar' || it.type === 'titlefx') : it.type === tab; }).slice().sort(function (a, b) { return a.price - b.price; }); }
  function renderShop() {
    $('shopTabs').innerHTML = SHOP_TABS.map(function (t) { return '<button class="tab' + (t[0] === shopTab ? ' on' : '') + '" data-st="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    $('shopTabs').querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { shopTab = b.dataset.st; renderShop(); sfx('click'); }; });
    $('shopHint').textContent = SHOP_HINT[shopTab] || '';
    previews = previews.filter(function (p) { return p.cv.isConnected && !p.cv.closest('#shopGrid'); });
    var g = $('shopGrid'); g.innerHTML = '';
    tabItems(shopTab).filter(function (it) { return !it.staff; }).forEach(function (it) {
      var d = document.createElement('div'); d.className = 'icard';
      var own = owns(it), eq = isEquipped(it), coins = state.profile ? state.profile.coins : 0, btn;
      if (it.type === 'emote') btn = own ? '<button class="own" disabled>✓ Owned</button>' : '<button data-buy="' + it.id + '"' + (coins < it.price ? ' disabled' : '') + '>Buy</button>';
      else if (eq) btn = '<button class="eq" data-eq="' + it.id + '">✓ Wearing</button>';
      else if (own) btn = '<button class="own" data-eq="' + it.id + '">Equip</button>';
      else btn = '<button data-buy="' + it.id + '"' + (coins < it.price ? ' disabled' : '') + '>Buy</button>';
      d.innerHTML = '<canvas width="' + Math.round(96 * DPR) + '" height="' + Math.round(96 * DPR) + '"></canvas>' +
        '<div class="nm">' + esc(it.label) + '</div><div class="rar" style="color:' + (SC.RAR[it.rarity] || '#fff') + '">' + it.rarity + '</div>' +
        '<div class="price">' + (it.price === 0 ? 'FREE' : '📜 ' + fmt(it.price)) + '</div>' + btn;
      g.appendChild(d); addPreview(d.querySelector('canvas'), it);
    });
    g.querySelectorAll('[data-buy]').forEach(function (b) { b.onclick = function () { buy(b.dataset.buy); }; });
    g.querySelectorAll('[data-eq]').forEach(function (b) { b.onclick = function () { var it = storeById[b.dataset.eq]; if (isEquipped(it)) unequip(it); else equip(it.id); }; });
  }
  function buy(id) {
    var it = storeById[id]; if (!it) return;
    api('buy', { itemId: id }).then(function (d) {
      if (d.error) { toast(SC.errMsg(d.error)); return; }
      SC.setProfile(d.profile); fxBurst('confetti'); sfx('coins');
      if (it.type === 'emote') { toast('New emote: ' + it.value + ' — press T to use it'); return; }
      toast('Purchased ' + it.label + '!'); equip(id);
    });
  }
  function equip(id) { api('equip', { itemId: id }).then(function (d) { if (d.error) { toast(SC.errMsg(d.error)); return; } SC.setProfile(d.profile); netSend({ t: 'look' }); sfx('pop'); }); }
  var UNEQ = { hat: 'none-hat', acc: 'none-acc', trail: 'none-trail', tag: 'none-tag', color: 'none-color', banner: 'none-banner', avatar: 'none-avatarFx', titlefx: 'none-titlefx' };
  function unequip(it) { var k = UNEQ[it.type]; if (k) equip(k); }

  // ================================================================ WARDROBE
  var WD_TABS = [['skin', 'Character'], ['body', 'Color'], ['hat', 'Hat'], ['acc', 'Accessory'], ['trail', 'Trail'], ['tag', 'Name Tag'], ['color', 'Name Color']];
  var wdTab = 'skin', wdDir = 0, wdWalk = false, wdParts = [];
  $('wdRotL').onclick = function () { wdDir = [1, 3, 2, 0][wdDir]; };
  $('wdRotR').onclick = function () { wdDir = [2, 0, 3, 1][wdDir]; };
  $('wdWalk').onclick = function () { wdWalk = !wdWalk; };
  function renderWardrobe() {
    $('wdTabs').innerHTML = WD_TABS.map(function (t) { return '<button class="tab' + (t[0] === wdTab ? ' on' : '') + '" data-wt="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    $('wdTabs').querySelectorAll('[data-wt]').forEach(function (b) { b.onclick = function () { wdTab = b.dataset.wt; renderWardrobe(); sfx('click'); }; });
    previews = previews.filter(function (p) { return p.cv.isConnected && !p.cv.closest('#wdGrid'); });
    if (!previews.some(function (p) { return p.cv === $('wdPrev'); })) {
      var pc = $('wdPrev'), c = pc.getContext('2d');
      previews.push({ cv: pc, draw: function (t) {
        c.clearRect(0, 0, pc.width, pc.height); c.save(); c.scale(pc.width / 220, pc.height / 250);
        if (wdWalk && me.look.trail && Math.random() < 0.6) A.spawnTrail(wdParts, me.look.trail, 110 - (wdDir === 2 ? 24 : wdDir === 1 ? -24 : 0), 200, t);
        if (wdWalk) wdParts.forEach(function (p) { p.x += (wdDir === 2 ? -1 : wdDir === 1 ? 1 : 0) * 2; p.y += (wdDir === 0 ? -1 : wdDir === 3 ? 1 : 0) * 2; });
        A.drawParticles(c, wdParts, 1 / 30);
        A.drawGim(c, 110, 205, me.look, { t: t, scale: 2.6, dir: wdDir, moving: wdWalk, walk: t * 12, blink: ((t % 4) < 0.12), noSeason: true });
        drawNameTag(c, 110, 205 - 2.6 * (me.look.hat ? 70 : 58), me.nick || 'You', me.cos, t, 1.1);
        c.restore();
      } });
    }
    var g = $('wdGrid'); g.innerHTML = '';
    var items = tabItems(wdTab), canNone = ['hat', 'acc', 'trail', 'tag', 'color'].indexOf(wdTab) >= 0;
    var list = (canNone ? [null] : []).concat(items.filter(owns), items.filter(function (it) { return !owns(it); }));
    list.forEach(function (it) {
      var d = document.createElement('div'), own = !it || owns(it), eq = it ? isEquipped(it) : !anyEquipped(wdTab);
      d.className = 'icard' + (own ? '' : ' locked') + (eq ? ' sel' : '');
      d.innerHTML = '<canvas width="' + Math.round(76 * DPR) + '" height="' + Math.round(76 * DPR) + '"></canvas><div class="nm" style="font-size:13px;min-height:28px">' + (it ? esc(it.label) : 'None') + '</div>' + (own ? '' : '<span class="lock">🔒</span><div class="price" style="font-size:12px">📜 ' + fmt(it.price) + '</div>');
      d.onclick = function () { if (!it) { equip(UNEQ[wdTab]); return; } if (!own) { toast('Buy it at the Shop counter 🛍️'); return; } if (!isEquipped(it)) equip(it.id); };
      g.appendChild(d); addPreview(d.querySelector('canvas'), it);
    });
  }
  function anyEquipped(tab) { var p = state.profile; if (!p) return false; if (tab === 'tag') return !!p.tag; if (tab === 'color') return !!p.color; return !!(p.look && p.look[tab]); }

  // ================================================================ PLAYER CARD
  function renderPlayer(p) {
    $('pTitle').textContent = p.nick; $('pSub').textContent = p.busy && GAME_NAME[p.busy] ? 'Playing ' + GAME_NAME[p.busy] : (p.busy && BUSY_ICON[p.busy] ? 'Busy ' + BUSY_ICON[p.busy] : 'Hanging out');
    $('plInfo').innerHTML = p.cos && p.cos.tag ? '<span class="pill" style="display:inline-flex">' + esc(p.cos.tag) + '</span>' : '';
    var pc = $('plPrev'), c = pc.getContext('2d');
    previews = previews.filter(function (x) { return x.cv !== pc; });
    previews.push({ cv: pc, draw: function (t) { c.clearRect(0, 0, pc.width, pc.height); c.save(); c.scale(pc.width / 180, pc.height / 200); A.drawGim(c, 90, 170, p.look, { t: t, scale: 2.1, dir: 0, blink: ((t % 4) < 0.12) }); c.restore(); } });
    $('plTip').onclick = function () { SC.tipPlayer(p.cid, p.nick); };
    $('plWave').onclick = function () { sendEmote('emo_wave'); closePanel(); };
    $('plFlip').onclick = function () { SC.challenge(p.id, p.nick, 'flip'); };
    $('plDice').onclick = function () { SC.challenge(p.id, p.nick, 'dice'); };
  }

  // ================================================================ EMOTES & QUICK CHAT
  function ownedEmotes() { return state.store.filter(function (it) { return it.type === 'emote' && owns(it); }); }
  function toggleEmotes(force) {
    var el = $('emotes'), open = force != null ? force : !el.classList.contains('open');
    if (open && panelOpen()) return;
    if (open) toggleQuick(false);
    el.classList.toggle('open', open);
    if (open) {
      $('emoGrid').innerHTML = ownedEmotes().map(function (it, i) { return '<button data-em="' + it.id + '" title="' + esc(it.label) + '">' + (i < 9 ? '<i>' + (i + 1) + '</i>' : '') + (it.value === 'GG' ? '<span style="font-size:20px">GG</span>' : it.value) + '</button>'; }).join('');
      $('emoGrid').querySelectorAll('[data-em]').forEach(function (b) { b.onclick = function () { sendEmote(b.dataset.em); toggleEmotes(false); }; });
    }
  }
  function toggleQuick(force) {
    var el = $('qchat'), open = force != null ? force : !el.classList.contains('open');
    if (open && panelOpen()) return;
    if (open) toggleEmotes(false);
    el.classList.toggle('open', open);
    if (open) {
      $('qcGrid').innerHTML = QC.map(function (q, i) { return '<button data-qc="' + i + '">' + esc(q) + '</button>'; }).join('');
      $('qcGrid').querySelectorAll('[data-qc]').forEach(function (b) { b.onclick = function () { sendQuick(+b.dataset.qc); toggleQuick(false); }; });
    }
  }
  var lastEmote = 0;
  function sendEmote(id) { if (Date.now() - lastEmote < 1100) return; lastEmote = Date.now(); netSend({ t: 'emote', id: id }); }
  function sendQuick(i) { if (Date.now() - lastEmote < 1100) return; lastEmote = Date.now(); netSend({ t: 'qc', i: i }); }

  // ================================================================ TYPED CHAT
  var chatEl = $('chatdock'), chatLog = $('chatlog'), chatIn = $('chatin'), chatLines = [], chatHidden = false;
  if (isTouch) chatIn.placeholder = 'Say something...';
  try { chatHidden = localStorage.getItem('sc_chat_hidden') === '1'; } catch (e) {}
  function chatAdd(nick, text, kind) {
    var row = document.createElement('div'); row.className = 'cl' + (kind ? ' ' + kind : ''); row.dataset.at = Date.now();
    if (nick) { var b = document.createElement('b'); b.textContent = nick + ' '; row.appendChild(b); }
    row.appendChild(document.createTextNode(text)); chatLog.appendChild(row); chatLines.push(row);
    while (chatLines.length > 60) { var o = chatLines.shift(); if (o.parentNode) o.parentNode.removeChild(o); }
    chatLog.scrollTop = chatLog.scrollHeight; chatFade();
  }
  function chatFade() { var now = Date.now(), foc = chatEl.classList.contains('focus'); chatLines.forEach(function (r, i) { var old = now - r.dataset.at > 14000, far = chatLines.length - i > 5; r.classList.toggle('old', !foc && (old || far)); }); }
  setInterval(chatFade, 2000);
  function chatFocus() { if (panelOpen()) return; toggleEmotes(false); toggleQuick(false); keys = {}; chatEl.classList.remove('hide'); chatIn.focus(); }
  function chatSendNow() { var t = chatIn.value.replace(/\s+/g, ' ').trim(); if (!t) { chatIn.blur(); return; } netSend({ t: 'say', text: t }); chatIn.value = ''; }
  chatIn.addEventListener('focus', function () { chatEl.classList.add('focus'); chatFade(); });
  chatIn.addEventListener('blur', function () { chatEl.classList.remove('focus'); chatFade(); });
  chatIn.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); chatSendNow(); } else if (e.key === 'Escape') { chatIn.blur(); } });
  $('chatform').addEventListener('submit', function (e) { e.preventDefault(); chatSendNow(); });
  $('chatsend').onclick = function (e) { e.preventDefault(); chatSendNow(); chatIn.focus(); };
  function chatHide(v) { chatHidden = v; chatEl.classList.toggle('muted', v); $('chathide').textContent = v ? 'Show chat' : 'Hide chat'; try { localStorage.setItem('sc_chat_hidden', v ? '1' : '0'); } catch (e) {} }
  $('chathide').onclick = function (e) { e.preventDefault(); chatHide(!chatHidden); };
  chatHide(chatHidden);
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || ''; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'c' || e.key === 'C' || e.key === '/') { if (panelOpen()) return; e.preventDefault(); chatFocus(); }
  });
  function onSay(m) {
    var who = m.id === me.id ? me : players[m.id];
    if (!chatHidden) chatAdd(m.nick || (who && who.nick) || 'Player', m.text);
    if (who) { who.emote = { text: m.text, at: performance.now(), life: Math.min(10, 4 + m.text.length * 0.07) }; if (Math.hypot(who.x - me.x, who.y - me.y) < 500) sfx('pop'); }
  }

  // ================================================================ NAME TAGS / BUBBLES
  function nameColor(v, t) {
    if (!v) return '#ffffff';
    if (v === 'fx:rainbow') return 'hsl(' + ((t * 120) % 360) + ',95%,65%)';
    if (v === 'fx:shimmer') return 'hsl(45,100%,' + (60 + Math.sin(t * 5) * 12) + '%)';
    if (v === 'fx:pulse') return 'hsl(190,100%,' + (62 + Math.sin(t * 4) * 12) + '%)';
    if (v === '#0b0b12') return '#2a2a3a';
    return v;
  }
  function drawNameTag(c, x, y, nick, cos, t, s) {
    s = s || 1; cos = cos || {};
    var col = nameColor(cos.color, t), glow = (cos.color || '').indexOf('fx:') === 0 ? col : null;
    A.label(c, nick, x, y, { size: 13 * s, color: col, lw: 4 * s, glow: glow, blur: 8 });
    if (cos.tag) {
      c.save(); c.font = '600 ' + (10.5 * s) + 'px Fredoka, sans-serif';
      var w = c.measureText(cos.tag).width + 12 * s, h = 16 * s, ty = y - 17 * s;
      var tc = cos.titleFx === 'rainbow' ? 'hsl(' + ((t * 120) % 360) + ',90%,62%)' : cos.titleFx === 'gold' || cos.titleFx === 'shimmer' ? '#ffd166' : cos.titleFx === 'pulse' ? '#5cf2ff' : 'rgba(255,255,255,.35)';
      A.rr(c, x - w / 2, ty - h / 2, w, h, h / 2); c.fillStyle = 'rgba(18,14,46,.85)'; c.fill();
      if (cos.titleFx) { c.shadowColor = tc; c.shadowBlur = 6 + Math.sin(t * 4) * 3; }
      c.strokeStyle = tc; c.lineWidth = 1.5 * s; c.stroke(); c.shadowBlur = 0;
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(cos.tag, x, ty + 0.5); c.restore();
    }
  }
  function wrapText(c, text, maxW, maxLines) {
    var words = String(text).split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = t;
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '') + '\u2026'; }
    return lines;
  }
  function drawBubble(c, x, y, e, age, text, life) {
    var sc = age < 0.15 ? age / 0.15 * 1.15 : age < 0.25 ? 1.15 - (age - 0.15) * 1.5 : 1;
    life = life || (text ? 4 : 3);
    if (age > life - 0.3) sc *= Math.max(0, 1 - (age - (life - 0.3)) / 0.3);
    c.save(); c.translate(x, y); c.scale(sc, sc);
    var w = 44, h = 38, lines = null;
    if (text) {
      c.font = '600 13px Fredoka, sans-serif'; lines = wrapText(c, text, 190, 4);
      var mw = 0; for (var li = 0; li < lines.length; li++) mw = Math.max(mw, c.measureText(lines[li]).width);
      w = Math.max(44, mw + 24); h = Math.max(38, 16 + lines.length * 16);
    }
    A.rr(c, -w / 2, -6 - h, w, h, 14); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = A.OL; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(-6, -7); c.lineTo(0, 2); c.lineTo(6, -7); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(-7, -9, 14, 4);
    if (text) { for (var l2 = 0; l2 < lines.length; l2++) A.label(c, lines[l2], 0, -6 - h + 16 + l2 * 16, { size: 13, color: '#1b1636', stroke: false, weight: 600 }); }
    else if (e === 'GG') A.label(c, 'GG', 0, -25, { size: 20, color: '#7b5cff', stroke: false });
    else { c.font = '26px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 0, -24); }
    c.restore();
  }

  // ================================================================ SYNCED WORLD OBJECTS (shared rounds)
  var WSEG_N = 31, wv = { cur: 0, spinId: -1, a0: 0, a1: 0, st: 0, en: 0 };
  function wheelAngle(dt) {
    var w = SC.gs && SC.gs.wheel; var n = (w && w.segs && w.segs.length) || WSEG_N, s = TAU / n;
    if (w && w.phase === 'spin' && w.idx >= 0) {
      if (wv.spinId !== w.id) { wv.spinId = w.id; wv.a0 = wv.cur; var target = -Math.PI / 2 - (w.idx + 0.5) * s; var k = Math.ceil((wv.a0 + 4 * TAU - target) / TAU); wv.a1 = target + k * TAU; wv.en = w.until - 700; wv.st = w.until - 6500; }
      var p = clamp((SC.now() - wv.st) / (wv.en - wv.st), 0, 1), e = 1 - Math.pow(1 - p, 3);
      wv.cur = wv.a0 + (wv.a1 - wv.a0) * e;
      if (p < 1 && Math.floor(wv.cur / s) !== wv.lastSeg) { wv.lastSeg = Math.floor(wv.cur / s); if (SC.panelKind === 'wheel' || SC.nearType('wheel') < 500) sfx('tick'); }
    } else if (!(w && w.phase === 'bet' && SC.now() - (w.until - 15000) < 2500)) wv.cur += dt * 0.25; // brief hold on the result
    return wv.cur;
  }
  SC.wheelAngle = function () { return wv.cur; };
  SC.lookOfPid = function (pid) { if (pid === me.id) return me.look; var p = players[pid]; return p ? p.look : null; };
  SC.roulView = function () { var r = SC.gs && SC.gs.roulette; var p = r && r.phase === 'spin' ? clamp((SC.now() - rv.st) / (rv.en - rv.st), 0, 1) : 1; return { rot: rv.rot, ball: rv.ball, ballR: rv.ballR, rel: rv.rel, res: rv.res, p: p, spinning: !!(r && r.phase === 'spin') }; };
  var WHEELN = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var rv = { rot: 0, ball: 0, spinId: -1, r0: 0, r1: 0, b0: 0, b1: 0, st: 0, en: 0, rel: null, res: null };
  function roulState(dt) {
    var r = SC.gs && SC.gs.roulette, s37 = TAU / 37;
    if (r && r.phase === 'spin' && r.result != null) {
      if (rv.spinId !== r.id) { rv.spinId = r.id; rv.r0 = rv.rot; rv.r1 = rv.rot + TAU * 2.5; rv.b0 = rv.ball; rv.st = r.until - 6500; rv.en = r.until - 400; var pocket = rv.r1 + (WHEELN.indexOf(r.result) + 0.5) * s37; var k = Math.ceil((pocket - (rv.b0 - 5 * TAU)) / TAU); rv.b1 = pocket - k * TAU; if (rv.b1 > rv.b0 - 4 * TAU) rv.b1 -= TAU; rv.res = r.result; }
      var p = clamp((SC.now() - rv.st) / (rv.en - rv.st), 0, 1), e = 1 - Math.pow(1 - p, 3);
      rv.rot = rv.r0 + (rv.r1 - rv.r0) * e; rv.ball = rv.b0 + (rv.b1 - rv.b0) * e; rv.ballR = 26 - 6 * Math.max(0, (p - 0.6) / 0.4); rv.rel = p >= 1 ? rv.ball - rv.rot : null;
    } else {
      rv.rot += dt * 0.5;
      if (rv.rel != null) { rv.ball = rv.rot + rv.rel; rv.ballR = 20; } else { rv.ball -= dt * 1.2; rv.ballR = 26; }
    }
  }
  var duelAnim = {};
  SC.onDuelResult = function (d) { var list = d.game === 'flip' ? flipObjs : diceObjs, o = list[d.id % list.length]; o.anim = { t0: tnow, landed: d.res.landed, ra: d.res.ra, rb: d.res.rb, a: d.a.nick, b: d.b ? d.b.nick : '', w: d.res.winnerNick, wn: d.res.winnerNick }; };
  function syncObjects(dt) {
    var g = SC.gs || {};
    megaSlot.jp = g.jp ? g.jp.pool : 0;
    // Crash rocket
    var c = g.crash;
    if (c) {
      var m = SC.crashMult ? SC.crashMult() : 1, cs = { phase: c.phase, mult: m };
      if (c.phase === 'run') { cs.lift = clamp(Math.log(m) / Math.log(12), 0, 1); crashObj._liftEnd = cs.lift; cs.label = m.toFixed(2) + 'x'; }
      else if (c.phase === 'end') { cs.boomAge = (Date.now() - (c.seenAt || Date.now())) / 1000; cs.liftEnd = crashObj._liftEnd || 0; cs.label = '💥 ' + (c.point || 1).toFixed(2) + 'x'; }
      else { cs.label = 'Launch in ' + Math.max(0, Math.ceil((c.until - SC.now()) / 1000)) + 's'; }
      crashObj.cs = cs;
    }
    // Big wheel
    var w = g.wheel; wheelObj.angle = wheelAngle(dt); wheelObj.segs = w && w.segs; wheelObj.spinning = w && w.phase === 'spin';
    if (w) wheelObj.status = w.phase === 'bet' ? 'Next spin ' + Math.max(0, Math.ceil((w.until - SC.now()) / 1000)) + 's · ' + ((w.bets || []).length) + ' bets' : 'Spinning…';
    // Roulette tables (both show the same spin)
    roulState(dt);
    var r = g.roulette;
    roulObjs.forEach(function (o) {
      o.rot = rv.rot; o.ball = rv.ball; o.ballR = rv.ballR; o.nb = r ? (r.bets || []).length : 0;
      if (r && r.phase === 'bet') { var left = Math.max(0, Math.ceil((r.until - SC.now()) / 1000)); var showRes = rv.rel != null && left > 12; o.status = showRes ? rv.res + ' ' + (rv.res === 0 ? 'GREEN' : ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].indexOf(rv.res) >= 0 ? 'RED' : 'BLACK')) : 'Bets close ' + left + 's'; o.statusColor = showRes ? '#ffd166' : '#fff'; o.hl = showRes ? rv.res : -1; }
      else { o.status = 'No more bets'; o.statusColor = '#ff9bd6'; o.hl = -1; }
    });
    // Blackjack tables
    bjTables.forEach(function (o) { o.T = g.bj && g.bj[o.table]; });
    // Duel pedestals
    flipObjs.concat(diceObjs).forEach(function (o) { if (o.anim) o.anim.age = tnow - o.anim.t0; });
    var open = (g.duels || []).filter(function (d) { return d.state === 'open'; });
    duelBoard.rows = open.slice(0, 5).map(function (d) { return { n: (d.game === 'flip' ? '🪙 ' : '🎲 ') + d.a.nick, v: fmt(d.amt) }; });
    if (!duelBoard.rows.length) duelBoard.rows = [{ n: 'No open duels', v: '' }];
  }

  // ================================================================ RENDER
  var lastFrame = performance.now(), mmLast = 0;
  var npcCtx = { lookAt: function (x, y) { return { x: me.x - x, y: me.y - y }; }, blink: function (s) { return ((tnow + s * 1.7) % 4) < 0.12; } };
  var GLOWS = OBJ.filter(function (o) { return o.type === 'sign' || o.type === 'slot' || o.type === 'atm' || o.type === 'casebox' || o.type === 'dj' || o.type === 'plinko'; });

  // ================================================================ ATMOSPHERE (lights, glints, chatter, ambient sound, big-win show)
  var LIGHT_COL = { c: '255,196,92', b: '110,150,255', g: '255,214,140', p: '176,130',  w: '255,170,90', a: '255,110,110', k: '120,255,230', o: '255,59,92', l: '90,230,220', r: '255,120,200', d: '255,120,230' };
  LIGHT_COL.p = '176,130,255';
  var lightImgs = {}, POOLS = [], BULBS = [];
  function lightImg(col) {
    if (lightImgs[col]) return lightImgs[col];
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + col + ',.9)'); gr.addColorStop(0.45, 'rgba(' + col + ',.28)'); gr.addColorStop(1, 'rgba(' + col + ',0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return (lightImgs[col] = c);
  }
  (function () {   // a soft pool of coloured light every few tiles, tinted by the room it hangs in
    for (var ty = 3; ty < ROWS - 1; ty += 6) for (var tx = 3; tx < COLS - 1; tx += 6) { var ch = G[ty][tx]; if (LIGHT_COL[ch]) POOLS.push({ x: tx * T + T / 2, y: ty * T + T / 2, col: LIGHT_COL[ch], ph: (tx * 7 + ty * 3) % 10 }); }
    // chase-light strips along the top wall of each room: [x0, x1, y]
    [[15, 44, 2], [1, 13, 2], [46, 58, 2], [46, 58, 16], [46, 58, 30], [60, 74, 14], [1, 13, 23], [15, 44, 31], [10, 65, 47]].forEach(function (r) {
      var y = r[2] * T - 15, n = Math.floor(((r[1] + 1 - r[0]) * T - 20) / 30);
      for (var i = 0; i <= n; i++) BULBS.push({ x: r[0] * T + 10 + i * 30, y: y, i: i });
    });
  })();
  var glints = [], glintT = 0;
  function drawAtmos(vx0, vx1, vy0, vy1, dt) {
    var i, o;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < POOLS.length; i++) {
      o = POOLS[i]; if (o.x < vx0 - 220 || o.x > vx1 + 220 || o.y < vy0 - 220 || o.y > vy1 + 220) continue;
      var r = 190 + Math.sin(tnow * 0.7 + o.ph) * 14; ctx.globalAlpha = 0.11 + Math.sin(tnow * 1.1 + o.ph * 2) * 0.025;
      ctx.drawImage(lightImg(o.col), o.x - r, o.y - r * 0.8, r * 2, r * 1.6);
    }
    ctx.globalAlpha = 1;
    var step = Math.floor(tnow * 7);
    for (i = 0; i < BULBS.length; i++) {
      o = BULBS[i]; if (o.x < vx0 || o.x > vx1 || o.y < vy0 - 20 || o.y > vy1) continue;
      var on = ((o.i - step) % 3 + 3) % 3 === 0;
      ctx.beginPath(); ctx.arc(o.x, o.y, on ? 4 : 3, 0, 6.3); ctx.fillStyle = on ? '#fff1b0' : 'rgba(255,190,80,.35)'; ctx.fill();
      if (on) { ctx.globalAlpha = 0.5; ctx.drawImage(lightImg('255,214,120'), o.x - 14, o.y - 14, 28, 28); ctx.globalAlpha = 1; }
    }
    // twinkles that drift up from the carpet
    if ((glintT += dt) > 0.12 && glints.length < 26) {
      glintT = 0; var gx = vx0 + 240 + Math.random() * (vx1 - vx0 - 480), gy = vy0 + 60 + Math.random() * (vy1 - vy0 - 360);
      if (tileAt(Math.floor(gx / T), Math.floor(gy / T)) !== '#') glints.push({ x: gx, y: gy, age: 0, max: 0.8 + Math.random() * 0.7, s: 3 + Math.random() * 4 });
    }
    for (i = glints.length - 1; i >= 0; i--) {
      o = glints[i]; o.age += dt; if (o.age > o.max) { glints.splice(i, 1); continue; }
      var k2 = Math.sin(o.age / o.max * Math.PI), sz = o.s * k2; o.y -= dt * 8;
      ctx.globalAlpha = 0.85 * k2; ctx.fillStyle = '#fff3c4';
      ctx.fillRect(o.x - sz, o.y - 0.7, sz * 2, 1.4); ctx.fillRect(o.x - 0.7, o.y - sz, 1.4, sz * 2);
    }
    ctx.restore();
  }

  // People who work here say something now and then when you walk past.
  var TALK = {
    blackjack: ['Place your bets!', 'Hit or stand?', 'Cards are hot tonight.', 'Good luck at the table!'], roulette: ['No more bets!', 'Round and round she goes…', 'Red or black?', 'Place your chips!'],
    dice: ['Roll the bones!', 'Shake and throw!', 'Feeling lucky?'], bar: ['What can I get you?', 'Cheers!', 'First drink is always good.'], shop: ['Fresh drip just in!', 'Looking sharp!', 'Try something new.'],
    wheel: ['Spin it, spin it!', 'Big wheel, big wins!'], 'Vault Guard': ['Keep it moving.', 'Big money in there.', 'Nothing to see here.'], 'Duel Master': ['Step up, challenger!', 'Who is next?', 'Pick your game.'],
  };
  var TALK_DY = { blackjack: -178, roulette: -176, dice: -174, bar: -140, shop: -138, wheel: -242, npc: -64 }, TALKERS = [];
  OBJ.forEach(function (o) { var k = o.name && TALK[o.name] ? o.name : TALK[o.type] ? o.type : ''; if (k) { TALKERS.push({ o: o, k: k, dy: TALK_DY[o.type] != null ? TALK_DY[o.type] : -100, next: Math.random() * 6, tk: null }); } });
  SC.bar.say = function (text, bx) { for (var i = 0; i < TALKERS.length; i++) if (TALKERS[i].o.type === 'bar') { TALKERS[i].tk = { text: text, at: tnow }; TALKERS[i].next = tnow + 20; } };
  var talkT = 0;
  function runTalkers(dt) {
    talkT += dt; if (talkT < 0.5) return; talkT = 0;
    for (var i = 0; i < TALKERS.length; i++) {
      var t = TALKERS[i]; if (tnow < t.next || (t.tk && tnow - t.tk.at < 4.5)) continue;
      if (Math.hypot(t.o.x - me.x, t.o.y - me.y) > 330) continue;
      var lines = TALK[t.k]; t.tk = { text: lines[Math.floor(Math.random() * lines.length)], at: tnow }; t.next = tnow + 14 + Math.random() * 16;
    }
  }
  function drawTalkers(vx0, vx1, vy0, vy1) {
    for (var i = 0; i < TALKERS.length; i++) { var t = TALKERS[i]; if (!t.tk) continue; var age = tnow - t.tk.at; if (age > 4) { t.tk = null; continue; } if (t.o.x < vx0 || t.o.x > vx1 || t.o.y < vy0 || t.o.y > vy1 + 200) continue; drawBubble(ctx, t.o.bx != null && t.o.type === 'bar' ? t.o.bx : t.o.x, t.o.y + t.dy, null, age, t.tk.text, 4); }
  }

  // Quiet sound of the floor: distant reels, the ball on the wheel, dice, arcade blips. Louder the closer you are, and it follows the mute button.
  function nearest(type, from) { var bd = 1e9; for (var i = 0; i < OBJ.length; i++) { var o = OBJ[i]; if (o.type === type || (type === 'arcade' && o.kind && o.x > 2880 && o.type === 'gstand')) { var d = Math.hypot(o.x - me.x, o.y - me.y); if (d < bd) bd = d; } } return bd; }
  function ambient() {
    if (document.hidden || !SC.sfxTone || (SC.sfxMuted && SC.sfxMuted()) || SC.panelKind) return;
    var R = 520, d, v, n;
    d = nearest('slot'); if (d < R && Math.random() < 0.55) { v = 0.07 * (1 - d / R); n = [0, 4, 7, 12][Math.floor(Math.random() * 4)]; for (var i = 0; i < 3; i++) SC.sfxTone(520 * Math.pow(2, (n + i * 4) / 12), 0.11, 'square', v, i * 0.09); }
    d = nearest('roulette'); if (d < R && Math.random() < 0.5) { v = 0.12 * (1 - d / R); for (var j = 0; j < 7; j++) SC.sfxTone(1900 + Math.random() * 400, 0.02, 'square', v * 0.5, j * (0.07 + j * 0.018)); }
    d = nearest('dice'); if (d < R && Math.random() < 0.35 && SC.sfxNoise) { v = 0.2 * (1 - d / R); for (var q = 0; q < 4; q++) SC.sfxNoise(0.04, v, q * 0.06, 2200); }
    d = nearest('arcade'); if (d < R && Math.random() < 0.6) { v = 0.06 * (1 - d / R); for (var z = 0; z < 3; z++) SC.sfxTone(330 + Math.floor(Math.random() * 6) * 110, 0.07, 'square', v, z * 0.08); }
    if (nearest('blackjack') < R * 0.8 && Math.random() < 0.3 && SC.sfxNoise) SC.sfxNoise(0.07, 0.07, 0, 2600);
    if (Math.random() < 0.12) SC.sfxTone(2400 + Math.random() * 600, 0.05, 'square', 0.03);   // a chip clink somewhere
  }
  setInterval(ambient, 1600);
  var stepT = 0;
  function footstep(dt) {   // soft tick underfoot; wood and tile ring a little more than carpet
    if (!SC.sfxNoise || (SC.sfxMuted && SC.sfxMuted()) || SC.panelKind) return;
    if ((stepT += dt) < 0.3) return; stepT = 0;
    var ch = tileAt(Math.floor(me.x / T), Math.floor((me.y - 5) / T)), hard = ch === 'w' || ch === 'a' || ch === 'g' || ch === 'k' || ch === 'o';
    SC.sfxNoise(0.035, hard ? 0.05 : 0.025, 0, hard ? 1500 : 500);
  }

  // Your own big wins get a show: a banner that counts up, coins raining down, a flash, and a shake for the biggest.
  var shakeEnd = 0, shakeAmt = 0;
  (function () {
    var st = document.createElement('style');
    st.textContent = '#winfx{position:fixed;inset:0;z-index:75;pointer-events:none;overflow:hidden}' +
      '.wf-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 45%,rgba(255,215,100,.55),rgba(255,215,100,0) 65%);animation:wfflash .9s ease-out forwards}@keyframes wfflash{from{opacity:1}to{opacity:0}}' +
      '.wf-ban{position:absolute;left:50%;top:22%;transform:translate(-50%,-50%) scale(.3);text-align:center;font-weight:900;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.45),0 0 28px var(--wfc,#ffd166);animation:wfban 3.2s cubic-bezier(.2,1.4,.4,1) forwards;white-space:nowrap}' +
      '.wf-ban .t{font-size:clamp(30px,7vw,64px);letter-spacing:.04em;color:var(--wfc,#ffd166)}.wf-ban .n{font-size:clamp(26px,5.5vw,48px);margin-top:2px;font-variant-numeric:tabular-nums}.wf-ban .m{font-size:clamp(14px,2.4vw,20px);opacity:.9;margin-top:2px}' +
      '@keyframes wfban{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}10%{transform:translate(-50%,-50%) scale(1.15);opacity:1}16%{transform:translate(-50%,-50%) scale(1)}84%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-70%) scale(.9);opacity:0}}' +
      '.wf-coin{position:absolute;top:-8vh;font-size:26px;animation:wfcoin linear forwards;filter:drop-shadow(0 3px 2px rgba(0,0,0,.4))}@keyframes wfcoin{to{transform:translateY(115vh) rotate(var(--r,360deg))}}';
    document.head.appendChild(st);
  })();
  var WIN_TIERS = [[500000, 'JACKPOT WIN', '#ff6ec7', 110, 'jackpot'], [100000, 'MEGA WIN', '#ff9f43', 70, 'bigwin'], [25000, 'BIG WIN', '#ffd166', 38, 'bigwin'], [5000, 'NICE WIN', '#5cf2a8', 14, 'win']];
  function celebrate(amount, mult, force) {
    var tier = null; for (var i = 0; i < WIN_TIERS.length; i++) if (amount >= WIN_TIERS[i][0]) { tier = WIN_TIERS[i]; break; }
    if (force) tier = WIN_TIERS.filter(function (x) { return x[1] === force; })[0] || tier;
    if (!tier) return;
    var host = document.getElementById('winfx'); if (!host) { host = document.createElement('div'); host.id = 'winfx'; document.body.appendChild(host); }
    host.innerHTML = '';
    var big = tier[3] >= 38;
    if (big) { var f = document.createElement('div'); f.className = 'wf-flash'; host.appendChild(f); }
    var b = document.createElement('div'); b.className = 'wf-ban'; b.style.setProperty('--wfc', tier[2]);
    b.innerHTML = '<div class="t">' + tier[1] + '</div><div class="n">📜 0</div>' + (mult >= 3 ? '<div class="m">' + mult + '× your bet</div>' : ''); host.appendChild(b);
    var nEl = b.querySelector('.n'), t0 = performance.now(), dur = 1300;
    (function tick() { var k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3); nEl.textContent = '📜 ' + fmt(Math.round(amount * e)); if (k < 1 && b.parentNode) requestAnimationFrame(tick); })();
    for (var c = 0; c < tier[3]; c++) { var d = document.createElement('div'); d.className = 'wf-coin'; d.textContent = Math.random() < 0.8 ? '🪙' : '💰'; d.style.left = Math.random() * 100 + 'vw'; d.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; d.style.animationDelay = (Math.random() * (big ? 1.6 : 0.8)) + 's'; d.style.setProperty('--r', (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360) + 'deg'); d.style.fontSize = (20 + Math.random() * 14) + 'px'; host.appendChild(d); }
    sfx(tier[4]); if (big) setTimeout(function () { sfx('coins'); }, 350);
    if (tier[3] >= 70) { shakeEnd = tnow + 0.7; shakeAmt = 7; fxBurst('money'); } else if (big) { shakeEnd = tnow + 0.35; shakeAmt = 3; }
    clearTimeout(host._t); host._t = setTimeout(function () { host.innerHTML = ''; }, 4600);
  }
  SC.celebrate = celebrate;
  // The balance counts up and down instead of jumping.
  var coinTween = 0, coinShown = null;
  function animCoins(to) {
    var el = $('coins'); if (coinShown == null || Math.abs(to - coinShown) < 2) { coinShown = to; el.textContent = fmt(to); return; }
    cancelAnimationFrame(coinTween); var from = coinShown, t0 = performance.now(), dur = Math.min(900, 250 + Math.abs(to - from) / 40);
    (function tk() { var k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3); coinShown = Math.round(from + (to - from) * e); el.textContent = fmt(coinShown); if (k < 1) coinTween = requestAnimationFrame(tk); })();
  }

  function frame(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now; tnow += dt;
    update(dt); syncObjects(dt);
    var k = Z * DPR;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0c0a22'; ctx.fillRect(0, 0, cv.width, cv.height);
    var shx = 0, shy = 0; if (tnow < shakeEnd) { var sa = shakeAmt * (shakeEnd - tnow) / 0.7; shx = (Math.random() - 0.5) * sa * 2; shy = (Math.random() - 0.5) * sa * 2; }
    ctx.setTransform(k, 0, 0, k, (-cam.x + shx) * k, (-cam.y + shy) * k);
    drawTiles();
    var vx0 = cam.x - 240, vx1 = cam.x + VW / Z + 240, vy0 = cam.y - 60, vy1 = cam.y + VH / Z + 300;
    var i, o, vm = me.y > PUBH;
    for (i = 0; i < OBJ.length; i++) { o = OBJ[i]; if ((vm ? o.y >= PUBH : o.y < PUBH) && o.layer === 'decal' && o.x > vx0 && o.x < vx1 && o.y > vy0 - o.ext && o.y < vy1 + o.ext) drawObj(o); }
    for (i = 0; i < OBJ.length; i++) { o = OBJ[i]; if ((vm ? o.y >= PUBH : o.y < PUBH) && o.layer === 'wall' && o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1) drawObj(o); }
    if (marker && tnow - marker.at < 0.8) { var mp = (tnow - marker.at) / 0.8; ctx.strokeStyle = 'rgba(255,255,255,' + (1 - mp) + ')'; ctx.lineWidth = 3; A.ell(ctx, marker.x, marker.y, 10 + mp * 14, 5 + mp * 6); ctx.stroke(); }
    A.drawParticles(ctx, parts, dt);
    var ents = [];
    for (i = 0; i < OBJ.length; i++) { o = OBJ[i]; if ((vm ? o.y >= PUBH : o.y < PUBH) && o.layer === 'ent' && o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1) ents.push(o); }
    for (var id in players) ents.push(players[id]);
    ents.push(me);
    ents.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < ents.length; i++) { var e = ents[i]; if (e.type) drawObj(e); else drawPlayer(e); }
    if (SC.vfx) SC.vfx.draw(ctx, function (id) { return id === me.id ? me : players[id]; }, dt);
    // soft additive glow on neon / machines
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16;
    for (i = 0; i < GLOWS.length; i++) { o = GLOWS[i]; if (o.x < vx0 || o.x > vx1 || o.y < vy0 || o.y > vy1) continue; var gy = o.type === 'sign' ? o.y : o.y - 70, gr = o.type === 'sign' ? 120 : 80; ctx.drawImage(glowImg, o.x - gr, gy - gr * 0.7, gr * 2, gr * 1.4); }
    ctx.restore();
    drawAtmos(vx0, vx1, vy0, vy1, dt); runTalkers(dt);
    for (i = 0; i < ents.length; i++) { var p = ents[i]; if (!p.type) drawOverlay(p); }
    drawTalkers(vx0, vx1, vy0, vy1);
    drawPops(dt);
    drawPrompt();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = vign; ctx.fillRect(0, 0, VW, VH);
    if (SC.gfx) SC.gfx.draw(ctx, VW, VH, dt);
    drawFinder();
    animPreviews(tnow);
    if (now - mmLast > 250) { mmLast = now; drawMinimap(); }
    requestAnimationFrame(frame);
  }
  function drawObj(o) {
    var f = A.obj[o.type];
    if (o.type === 'npc') {
      if (o.stand) { A.ell(ctx, o.x, o.y - 2, 26, 9); ctx.fillStyle = '#d4a63a'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 3; ctx.stroke(); }
      A.drawGim(ctx, o.x, o.y - (o.stand ? 4 : 0), o.look, { t: tnow + o.x, lookAt: o.stand ? null : npcCtx.lookAt(o.x, o.y - 20), blink: npcCtx.blink(o.x % 7), shadow: !o.stand, dir: o.stand ? 0 : 0 });
      return;
    }
    if (o.type === 'portal') { // doorway to the Games section (Bedwars)
      var px = o.x, py = o.y, t = tnow;
      ctx.fillStyle = 'rgba(10,6,30,.3)'; A.ell(ctx, px, py, 62, 14); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(px - 38, py - 8); ctx.lineTo(px - 38, py - 92); ctx.arc(px, py - 92, 38, Math.PI, 0); ctx.lineTo(px + 38, py - 8); ctx.closePath(); ctx.clip();
      var vg = ctx.createRadialGradient(px, py - 80, 4, px, py - 70, 90); vg.addColorStop(0, '#ffe6ff'); vg.addColorStop(0.3, '#c77dff'); vg.addColorStop(0.7, '#5a189a'); vg.addColorStop(1, '#240046');
      ctx.fillStyle = vg; ctx.fillRect(px - 40, py - 132, 80, 126);
      ctx.translate(px, py - 76);
      for (var k = 0; k < 5; k++) { ctx.rotate(t * 1.6 + k * 1.256); ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + k * 0.05) + ')'; ctx.lineWidth = 3; ctx.beginPath(); for (var a = 0; a < 6; a += 0.3) ctx.lineTo(Math.cos(a) * a * 6, Math.sin(a) * a * 6); ctx.stroke(); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(px - 46, py - 4); ctx.lineTo(px - 46, py - 92); ctx.arc(px, py - 92, 46, Math.PI, 0); ctx.lineTo(px + 46, py - 4); ctx.lineTo(px + 38, py - 4); ctx.lineTo(px + 38, py - 92); ctx.arc(px, py - 92, 38, 0, Math.PI, true); ctx.lineTo(px - 38, py - 4); ctx.closePath();
      ctx.fillStyle = '#4a3f88'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 3; ctx.stroke();
      for (var b = 0; b < 7; b++) { var ang = Math.PI + b * Math.PI / 6; A.circ(ctx, px + Math.cos(ang) * 42, py - 92 + Math.sin(ang) * 42, 3.2); ctx.fillStyle = (Math.floor(t * 4) + b) % 2 ? '#ffd166' : '#ff6ec7'; ctx.fill(); }
      A.rr(ctx, px - 58, py - 162, 116, 30, 10); ctx.fillStyle = '#1a0f3d'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 3; ctx.stroke();
      A.neon(ctx, '🎮 GAMES', px, py - 147, '#c77dff', 17, tnow, 4);
      A.rr(ctx, px + 26, py - 178, 70, 20, 8); ctx.fillStyle = '#ff4b5c'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = '700 11px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('BEDWARS!', px + 61, py - 167.5);
      return;
    }
    if (o.type === 'exit') {
      var g = ctx.createLinearGradient(0, o.y - 30, 0, o.y + 30); g.addColorStop(0, 'rgba(43,213,118,0)'); g.addColorStop(1, 'rgba(43,213,118,.55)');
      ctx.fillStyle = g; ctx.fillRect(o.x - 48, o.y - 30, 96, 54);
      A.rr(ctx, o.x - 40, o.y - 54, 80, 28, 9); ctx.fillStyle = '#0b2a14'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 3; ctx.stroke();
      A.neon(ctx, 'EXIT ▼', o.x, o.y - 40, '#2bd576', 15, tnow, 9);
      return;
    }
    if (f) f(ctx, o, tnow, npcCtx);
  }
  // ---- Among Us style vent hop: hop onto the hatch, squash, get sucked in; coming back you pop out and land with a squish.
  var VENT_IN = 1.05, VENT_OUT = 1.0;
  function startVent(p, dir) {
    var now = performance.now();
    if (p.vent && p.vent.dir === dir && now - p.vent.t0 < 600) return;   // the local start and the server's broadcast are the same event
    p.vent = { dir: dir, t0: now, x0: p.x, y0: p.y, puffed: 0 };
    if (p === me) me.ventUntil = now + (dir === 'in' ? 1300 : VENT_OUT * 1000 + 100);
    if (me.y < PUBH && Math.hypot(me.x - hatchObj.x, me.y - hatchObj.y) < 900) sfx(dir === 'in' ? 'ventin' : 'ventout');
    if (dir === 'in') SC.vfx.puff(hatchObj.x, hatchObj.y + 8, 0.45, 0.5);
  }
  function ventPose(p) {
    var v = p.vent; if (!v) return null;
    var u = (performance.now() - v.t0) / 1000, hx = hatchObj.x, hy = hatchObj.y + 4, x, y, sx = 1, sy = 1, clip = null, hide = false, k, lerp = function (a, b, t) { return a + (b - a) * t; };
    if (v.dir === 'in') {
      if (u >= VENT_IN + 0.6) { p.vent = null; return null; }   // long gone (or the server said no): back to normal, never stay hidden
      if (u >= VENT_IN) { return { hide: true, x: hx, y: hy, sx: 1, sy: 1 }; }
      if (u < 0.32) { k = u / 0.32; k = k * k * (3 - 2 * k); x = lerp(v.x0, hx, k); y = lerp(v.y0, hy, k); sy = 1 - 0.07 * Math.sin(k * Math.PI); }
      else if (u < 0.5) { k = (u - 0.32) / 0.18; x = hx; y = hy; sy = 1 - 0.24 * k; sx = 1 + 0.16 * k; }
      else if (u < 0.7) { k = (u - 0.5) / 0.2; x = hx; y = hy - 46 * Math.sin(k * Math.PI); sy = 1.22 - 0.1 * k; sx = 0.88 + 0.06 * k; }
      else { k = (u - 0.7) / 0.35; x = hx; y = hy + 8 + 74 * k * k; sx = 1 - 0.35 * k; sy = 1 - 0.2 * k; clip = hy + 10; hide = k > 0.85; if (!v.puffed) { v.puffed = 1; SC.vfx.puff(hx, hy + 6, 0.5, 0.6); } }
    } else {
      if (u >= VENT_OUT) { p.vent = null; return null; }
      if (u < 0.3) { k = u / 0.3; x = hx; y = hy + 70 - 64 * k; sx = 0.7 + 0.3 * k; sy = 0.75 + 0.3 * k; clip = hy + 10; hide = k < 0.2; }
      else if (u < 0.85) { k = (u - 0.3) / 0.55; var ek = 1 - (1 - k) * (1 - k); x = lerp(hx, p.x, ek); y = lerp(hy + 6, p.y, ek) - 60 * Math.sin(k * Math.PI); sy = 1 + 0.22 * Math.sin(k * Math.PI); sx = 1 - 0.1 * Math.sin(k * Math.PI); if (!v.puffed) { v.puffed = 1; SC.vfx.puff(hx, hy + 4, 0.5, 0.6); } }
      else { k = (u - 0.85) / 0.15; x = p.x; y = p.y; sy = 0.8 + 0.2 * k; sx = 1.18 - 0.18 * k; if (v.puffed < 2) { v.puffed = 2; SC.vfx.puff(p.x, p.y, 0.35, 0.4); } }
    }
    return { x: x, y: y, sx: sx, sy: sy, clip: clip, hide: hide };
  }
  function ventBusy() { var id; if (me.vent && performance.now() - me.vent.t0 < 1400) return true; for (id in players) if (players[id].vent && performance.now() - players[id].vent.t0 < 1400) return true; return false; }
  function drawPlayer(p) {
    var pose = p.vent ? ventPose(p) : null;
    if (pose) {
      if (pose.hide) return;
      var isMe0 = p === me;
      ctx.save();
      if (pose.clip != null) { ctx.beginPath(); ctx.rect(pose.x - 220, pose.y - 520, 440, pose.clip - (pose.y - 520)); ctx.clip(); }
      ctx.translate(pose.x, pose.y); ctx.scale(pose.sx, pose.sy); ctx.translate(-pose.x, -pose.y);
      A.drawGim(ctx, pose.x, pose.y, p.look, { t: tnow + (p.blinkSeed || 0), dir: p.vent.dir === 'in' && performance.now() - p.vent.t0 > 320 ? 0 : p.dir, moving: (performance.now() - p.vent.t0) / 1000 < 0.32 && p.vent.dir === 'in', walk: p.walk, blink: false, scale: p.scale > 1.01 || p.scale < 0.99 ? p.scale : null });
      ctx.restore();
      return;
    }
    var isMe = p === me, blink = ((tnow + (p.blinkSeed || 0)) % 4.2) < 0.12;
    A.drawGim(ctx, p.x, p.y, p.look, { t: tnow + (p.blinkSeed || 0), dir: p.dir, moving: isMe ? p.mv : p.moving, walk: p.walk, blink: blink, dance: p.dance && !p.frozen, scale: p.scale > 1.01 || p.scale < 0.99 ? p.scale : null, alpha: p.leaving ? Math.max(0.15, 1 - (performance.now() - p.leaving) / 2500) : null });
    if (p.hammer || p.drink || p.frozen) A.playerProps(ctx, p, tnow, p.scale);
  }
  function drawOverlay(p) {
    if (p.vent) { var vp = ventPose(p); if (!vp || vp.hide || vp.clip != null) return; p = Object.assign({}, p, { x: vp.x, y: vp.y }); }
    var L = p.look || {}, tall = { bunny: 10, alien: 6, robot: 6, unicorn: 10, mushroom: 14, knight: 8 }[L.skin] || 0;
    var top = p.y - ((L.hat ? 80 : 66) + tall) * (p.scale || 1);
    drawNameTag(ctx, p.x, top, p.nick || '…', p.cos, tnow, 1);
    if (window.BWV && BWV.hearing && (p === me ? BWV.on && BWV.talking : BWV.isTalking(p.id))) {
      var vy = top - (p.cos && p.cos.tag ? 40 : 24), pulse = (Math.sin(tnow * 14) + 1) / 2;
      A.circ(ctx, p.x, vy, 11); ctx.fillStyle = '#2bd576'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#05240f'; ctx.fillRect(p.x - 5, vy - 3, 4, 6); ctx.beginPath(); ctx.moveTo(p.x - 1, vy - 3); ctx.lineTo(p.x + 3, vy - 6); ctx.lineTo(p.x + 3, vy + 6); ctx.lineTo(p.x - 1, vy + 3); ctx.fill();
      ctx.strokeStyle = 'rgba(43,213,118,' + (0.4 + pulse * 0.6) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x + 4, vy, 15, -0.7, 0.7); ctx.stroke();
    }
    var tagUp = p.cos && p.cos.tag ? 18 : 0;
    if (p.busy && BUSY_ICON[p.busy] && p !== me) {
      A.circ(ctx, p.x + 22, p.y - 44, 11); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(BUSY_ICON[p.busy], p.x + 22, p.y - 43);
    }
    if (p.emote) { var age = (performance.now() - p.emote.at) / 1000, life = p.emote.life || (p.emote.text ? 4 : 3); if (age < life) drawBubble(ctx, p.x, top - 10 - tagUp, p.emote.e, age, p.emote.text, life); else p.emote = null; }
  }
  function drawPops(dt) {
    for (var i = pops.length - 1; i >= 0; i--) {
      var q = pops[i]; q.age += dt; if (q.age > 1.8) { pops.splice(i, 1); continue; }
      var who = q.id === me.id ? me : players[q.id]; if (who) { q.x = who.x; q.y = who.y; }
      var sc = q.age < 0.12 ? 0.6 + q.age / 0.12 * 0.6 : 1.2 - Math.min(0.2, (q.age - 0.12));
      ctx.save(); ctx.globalAlpha = q.age > 1.3 ? Math.max(0, 1 - (q.age - 1.3) / 0.5) : 1;
      A.label(ctx, q.text, q.x, q.y - 92 - q.age * 34, { size: 17 * sc, color: q.col, lw: 5 });
      ctx.restore();
    }
  }
  function drawPrompt() {
    promptRect = null; if (!target) return;
    var label = target.label || '', key = isTouch ? 'TAP' : 'E';
    var x = target.x, y = target.py + Math.sin(tnow * 4) * 2;
    ctx.save(); ctx.font = '600 14px Fredoka, sans-serif';
    var tw = ctx.measureText(label).width, kw = key.length > 1 ? 34 : 22, w = tw + kw + 24, h = 32;
    A.rr(ctx, x - w / 2, y - h / 2 + 4, w, h, 12); ctx.fillStyle = 'rgba(10,8,30,.4)'; ctx.fill();
    A.rr(ctx, x - w / 2, y - h / 2, w, h, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 3; ctx.stroke();
    A.rr(ctx, x - w / 2 + 6, y - 11, kw, 22, 7); ctx.fillStyle = '#7b5cff'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 ' + (key.length > 1 ? 11 : 14) + 'px Fredoka, sans-serif'; ctx.fillText(key, x - w / 2 + 6 + kw / 2, y + 0.5);
    ctx.fillStyle = '#1b1636'; ctx.font = '600 14px Fredoka, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, x - w / 2 + kw + 14, y + 0.5);
    ctx.restore();
    promptRect = [(x - w / 2 - cam.x) * Z, (y - h / 2 - cam.y) * Z, (x + w / 2 - cam.x) * Z, (y + h / 2 - cam.y) * Z];
  }
  // Friend finder: arrow at the screen edge pointing at the player you picked in the online list.
  var findId = 0, findUntil = 0;
  function drawFinder() {
    var el = $('arrowTo'), p = players[findId];
    if (!p || tnow > findUntil) { el.style.display = 'none'; return; }
    var sx = (p.x - cam.x) * Z, sy = (p.y - 30 - cam.y) * Z;
    if (sx > 40 && sx < VW - 40 && sy > 60 && sy < VH - 40) { ctx.save(); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); A.circ(ctx, sx, sy, 34 + Math.sin(tnow * 6) * 4); ctx.stroke(); ctx.restore(); el.style.display = 'none'; return; }
    var cx = VW / 2, cy = VH / 2, a = Math.atan2(sy - cy, sx - cx), r = Math.min(VW, VH) / 2 - 40;
    el.style.display = 'block'; el.style.left = (cx + Math.cos(a) * r - 14) + 'px'; el.style.top = (cy + Math.sin(a) * r - 18) + 'px'; el.style.transform = 'rotate(' + a + 'rad)'; el.title = p.nick;
  }
  // minimap
  var mm = $('minimap'), mmc = mm.getContext('2d'), mmBase = null;
  mm.width = 200; mm.height = 147;
  var mmMode = 0;
  var MMW0 = mm.width;
  function mmGeom(mode) { return mode ? { x0: 26 * T, w: 16 * T, y0: PUBH, h: WH - PUBH } : { x0: 0, w: WW, y0: 0, h: PUBH }; }
  function drawMinimap() {
    if (isTouch) return;
    var mode = me.y > PUBH ? 1 : 0, g = mmGeom(mode), y0 = g.y0, x0 = g.x0;
    if (mode !== mmMode || !mmBase) { mmMode = mode; mmBase = null; mm.width = mode ? 52 : MMW0; mm.height = Math.round(mm.width * g.h / g.w); }
    var sx = mm.width / g.w, sy = mm.height / g.h;
    if (!mmBase) {
      mmBase = document.createElement('canvas'); mmBase.width = mm.width; mmBase.height = mm.height; var b = mmBase.getContext('2d');
      var COL = { r: '#4b2a86', b: '#1d2a66', c: '#7d1d36', g: '#9c8a64', p: '#3a2d6e', w: '#8a5a32', l: '#145a63', d: '#b03a8a', a: '#5b5f73', k: '#3b2a8f', o: '#7a1630' };
      for (var ty = mode ? 44 : 0; ty < (mode ? ROWS : 44); ty++) for (var tx = 0; tx < COLS; tx++) { var ch = G[ty][tx]; b.fillStyle = ch === '#' ? '#120e2e' : COL[ch]; b.fillRect((tx * T - x0) * sx, (ty * T - y0) * sy, T * sx + 0.6, T * sy + 0.6); }
      b.fillStyle = 'rgba(255,255,255,.55)'; ACTS.forEach(function (o) { if ((mode ? o.y < PUBH : o.y >= PUBH) || (o.ownerOnly && !me.own)) return; b.fillRect((o.x - x0) * sx - 1, (o.y - y0) * sy - 1, 2, 2); });
    }
    mmc.clearRect(0, 0, mm.width, mm.height); mmc.drawImage(mmBase, 0, 0);
    for (var id in players) { var p = players[id]; if (mode ? p.y < PUBH : p.y >= PUBH) continue; mmc.fillStyle = +id === findId ? '#ff3b7a' : '#ffd166'; mmc.beginPath(); mmc.arc((p.x - x0) * sx, (p.y - y0) * sy, +id === findId ? 3.6 : 2.6, 0, 7); mmc.fill(); }
    mmc.fillStyle = '#fff'; mmc.strokeStyle = '#120e2e'; mmc.lineWidth = 1.5; mmc.beginPath(); mmc.arc((me.x - x0) * sx, (me.y - y0) * sy, 3.6, 0, 7); mmc.fill(); mmc.stroke();
    mmc.strokeStyle = 'rgba(255,255,255,.5)'; mmc.lineWidth = 1; mmc.strokeRect((cam.x - x0) * sx, (cam.y - y0) * sy, VW / Z * sx, VH / Z * sy);
  }
  mm.addEventListener('click', function (e) { var r = mm.getBoundingClientRect(), g = mmGeom(me.y > PUBH ? 1 : 0); walkTo((e.clientX - r.left) / r.width * g.w + g.x0, (e.clientY - r.top) / r.height * g.h + g.y0, null); });

  // ================================================================ EFFECTS / FEED
  function announce(text, by) {
    var d = document.createElement('div'); d.className = 'vann';
    d.innerHTML = '<div class="vk">📢 ' + esc(by || 'The owner') + ' announces</div><div class="vt">' + esc(text) + '</div>';
    document.body.appendChild(d); sfx('announce');
    setTimeout(function () { d.classList.add('out'); }, 6500); setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 7300);
  }
  function fxBurst(kind) { A.burst(parts, kind === 'money' ? 'money' : 'confetti', me.x, me.y, kind === 'money' ? 18 : 40); }
  SC.fx = fxBurst;
  function addPop(id, v) { pops.push({ id: id, text: (v >= 0 ? '+' : '−') + fmt(Math.abs(v)), col: v >= 0 ? '#2bd576' : '#ff5c6c', age: 0, x: 0, y: 0 }); }
  function feed(html, cls, ms) {
    var d = document.createElement('div'); d.className = 'feeditem' + (cls ? ' ' + cls : ''); d.innerHTML = html;
    var f = $('feed'); f.appendChild(d); while (f.children.length > 4) f.removeChild(f.firstChild);
    setTimeout(function () { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 450); }, ms || 5000);
  }
  function flashNear(p) { var best = null, bd = 150; ACTS.forEach(function (o) { var d = Math.hypot(o.ax - p.x, o.ay - p.y); if (d < bd) { bd = d; best = o; } }); if (best) best.flash = tnow; }
  function renderOnline() {
    var l = $('onlineList'); if (l.style.display !== 'block') return;
    var all = [me].concat(Object.keys(players).map(function (k) { return players[k]; }));
    l.innerHTML = '<div style="font-weight:700;margin-bottom:4px">In the casino (' + all.length + ')</div><div class="hint" style="margin:0 0 6px;font-size:12px">Click someone to find them</div>' + all.map(function (p) {
      return '<div class="row" data-find="' + (p === me ? 0 : p.id) + '" style="cursor:pointer"><span class="dot" style="background:' + A.baseHex(p.look && p.look.body) + '"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (p.cos && p.cos.color && p.cos.color[0] === '#' ? p.cos.color : '#fff') + '">' + esc(p.nick) + (p === me ? ' (you)' : '') + '</span>' + (p.busy && BUSY_ICON[p.busy] ? '<span>' + BUSY_ICON[p.busy] + '</span>' : '') + '</div>';
    }).join('');
    l.querySelectorAll('[data-find]').forEach(function (r) { r.onclick = function () { var id = +r.dataset.find; if (!id) return; findId = id; findUntil = tnow + 12; l.style.display = 'none'; var p = players[id]; if (p) toast('📍 Showing where ' + p.nick + ' is — click the minimap to walk there'); }; });
  }
  function updateOnlineCount() { $('onlineN').textContent = 1 + Object.keys(players).length; renderOnline(); }

  // ================================================================ NETWORK
  var ws = null, wsOk = false, fatal = false, retry = 800, lastSent = { x: 0, y: 0, d: -1, m: false, at: 0 }, lastRecv = 0, lastPing = 0;
  function netSend(o) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} }
  SC.netSend = netSend;
  function netTick() {
    if (!wsOk) return;
    var now = performance.now();
    // Keep the connection alive while standing still (proxies drop idle sockets),
    // and if nothing has come back for a while, the socket is dead — reconnect.
    if (now - lastPing > 12000) { lastPing = now; netSend({ t: 'ping' }); }
    if (now - lastRecv > 35000) { lastRecv = now; try { ws.close(); } catch (e) {} return; }
    if (now - lastSent.at < 66) return;
    var changed = Math.abs(me.x - lastSent.x) > 0.5 || Math.abs(me.y - lastSent.y) > 0.5 || me.dir !== lastSent.d || me.mv !== lastSent.m;
    if (!changed) return;
    lastSent = { x: me.x, y: me.y, d: me.dir, m: me.mv, at: now };
    netSend({ t: 'mv', x: Math.round(me.x), y: Math.round(me.y), d: me.dir, m: me.mv ? 1 : 0 });
  }
  function mkPlayer(p) { return { id: p.id, cid: p.cid, nick: p.nick, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: p.dir || 0, mv: !!p.mv, walk: 0, look: p.look || {}, cos: p.cos || {}, busy: p.busy || '', blinkSeed: Math.random() * 4, emote: null, idle: 0, own: !!p.own, hammer: !!p.hm, scale: p.sc || 1, frozen: !!p.fz }; }
  function connect() {
    var proto = location.protocol === 'https:' ? 'wss' : 'ws';
    try { if (ws) { ws.onclose = null; ws.onmessage = null; ws.close(); } } catch (e) {}
    var sock = ws = new WebSocket(proto + '://' + location.host + '/world-ws');
    sock.binaryType = 'arraybuffer';
    sock.onopen = function () { retry = 800; lastRecv = performance.now(); if (window.BWV && BWV.hearing) netSend({ t: 'vc', on: true }); };
    sock.onmessage = function (ev) { if (sock !== ws) return; lastRecv = performance.now(); if (typeof ev.data !== 'string') { if (window.BWV) BWV.onFrame(new Uint8Array(ev.data)); return; } var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onNet(m); };
    sock.onclose = function () {
      if (sock !== ws) return;
      wsOk = false; if (fatal) return;
      $('netState').style.display = 'flex';
      setTimeout(connect, retry); retry = Math.min(6000, retry * 1.6);
    };
  }
  function onNet(m) {
    switch (m.t) {
      case 'vcstate': if (window.BWV && m.range) BWV.range = m.range; return;
      case 'welcome':
        wsOk = true; fatal = false; $('netState').style.display = 'none'; syncClock(m.now);
        me.id = m.you.id; me.cid = m.you.cid; me.nick = m.you.nick;
        if (!me._placed) { me.x = m.you.x; me.y = m.you.y; me._placed = true; }
        me.look = m.you.look || me.look; me.cos = m.you.cos || me.cos;
        me.own = !!m.you.own; me.role = m.you.role || null; SC.vault.own = me.own; SC.role = me.role; me.scale = m.you.sc || 1; me.hammer = !!m.you.hm; me.frozen = !!m.you.fz; me.fast = false;
        players = {}; (m.players || []).forEach(function (p) { if (p.cid !== me.cid && p.id !== me.id) players[p.id] = mkPlayer(p); });
        if (m.qc) QC = m.qc;
        if (m.games && SC.mp) SC.mp.snapshot(m.games);
        updateOnlineCount(); hideLoading();
        lastSent.at = 0; lastSent.d = -1; lastPing = performance.now();
        if (me.busy) netSend({ t: 'busy', g: me.busy });
        break;
      case 'pong': syncClock(m.now); break;
      case 'join': {
        if (m.p.cid === me.cid) break;
        var back = null; for (var oid in players) if (players[oid].cid === m.p.cid) { back = players[oid]; delete players[oid]; }
        var np = mkPlayer(m.p); players[m.p.id] = np;
        if (back) { np.x = back.x; np.y = back.y; np.blinkSeed = back.blinkSeed; } // quick reconnect: no flicker, no welcome spam
        else { feed('👋 <b>' + esc(m.p.nick) + '</b> walked in', 'join', 3500); sfx('join'); }
        updateOnlineCount(); break;
      }
      case 'leave': if (players[m.id]) { players[m.id].leaving = performance.now(); } break;
      case 'snap': m.ps.forEach(function (a) { var p = players[a[0]]; if (!p) return; p.tx = a[1]; p.ty = a[2]; p.dir = a[3]; p.mv = !!a[4]; }); break;
      case 'pos': if (Math.hypot(m.x - me.x, m.y - me.y) > 500) { cam._init = false; fade(); } me.x = m.x; me.y = m.y; path = null; break;
      case 'coins': if (state.profile) { state.profile.coins = m.c; SC.setProfile(state.profile); } break;
      case 'jp': if (SC.gs) SC.gs.jp = { pool: m.pool, last: m.last }; if (SC.panelKind === 'slots') renderJackpot(); break;
      case 'g': syncClock(m.now); if (SC.mp) SC.mp.onGame(m); break;
      case 'say': onSay(m); break;
      case 'sayerr': chatAdd('', m.msg, 'err'); toast(m.msg); break;
      case 'emote': case 'qc': {
        var who = m.id === me.id ? me : players[m.id]; if (!who) break;
        if (m.t === 'qc') who.emote = { text: QC[m.i] || '…', at: performance.now() };
        else who.emote = { e: m.e, at: performance.now() };
        if (m.k === 'drink') who.drink = { e: m.e, from: tnow, until: tnow + 45 };
        if (m.e === '💸') A.burst(parts, 'money', who.x, who.y, 16);
        if (m.e === '🎉' || m.e === '🥳') A.burst(parts, 'confetti', who.x, who.y, 24);
        if (Math.hypot(who.x - me.x, who.y - me.y) < 500) sfx(m.k === 'drink' ? 'drink' : 'pop');
        break;
      }
      case 'serve': {   // the bartender makes a drink for someone: the animation starts after any queue ahead of it
        SC.bar.jobs.push({ id: m.id, nick: m.nick, d: m.d, x: m.x, t0: performance.now() + (m.in || 0), ms: m.ms || 3600 });
        if (SC.bar.jobs.length > 8) SC.bar.jobs.shift();
        break;
      }
      case 'barbusy': toast('The bartender is swamped. Try again in a few seconds.'); break;
      case 'vstate': me.fast = !!m.fast; me.scale = m.scale || 1; if (m.frozen != null) me.frozen = !!m.frozen; break;
      case 'vsize': { var vz = m.id === me.id ? me : players[m.id]; if (vz) { vz.scale = m.s || 1; SC.vfx.add('warp', vz.id, vz.x, vz.y); } break; }
      case 'vhammer': { var vh = m.id === me.id ? me : players[m.id]; if (vh) vh.hammer = !!m.on; if (vh && m.on && Math.hypot(vh.x - me.x, vh.y - me.y) < 700) sfx('chip'); break; }
      case 'vdeny': toast('Only owners can use that.'); break;
      case 'vannounce': announce(m.text, m.by); break;
      case 'vfx': {
        if (m.k === 'vent') { var vw0 = m.id === me.id ? me : players[m.id]; if (vw0) startVent(vw0, m.d === 'out' ? 'out' : 'in'); break; }
        if (m.k === 'hatch') { if (me.y < PUBH) { SC.vfx.add('warp', 0, hatchObj.x, hatchObj.y + 10); if (Math.hypot(me.x - hatchObj.x, me.y - hatchObj.y) < 900) sfx('warp'); } break; }
        if (m.k === 'smite' && m.by != null) { var atk = m.by === me.id ? me : players[m.by]; if (atk) atk.slamAt = tnow; }
        var vt = m.id === me.id ? me : players[m.id], near = !vt || Math.hypot(vt.x - me.x, vt.y - me.y) < 900;
        if (m.k === 'party' || m.k === 'fireworks' || m.k === 'storm' || m.k === 'disco' || m.k === 'snow') {
          SC.gfx.start(m.k, m.k === 'snow' ? 25 : m.k === 'storm' ? 12 : 10);
          if (m.k === 'party') { sfx('bigwin'); fxBurst('confetti'); }
          feed('✨ <b>' + esc(m.by || 'The owner') + '</b> started ' + ({ party: 'a party', fireworks: 'fireworks', storm: 'a thunderstorm', disco: 'a disco', snow: 'snow' })[m.k], '', 4500);
          break;
        }
        if (vt) SC.vfx.add(m.k, vt.id, vt.x, vt.y, { ban: !!m.b });
        if (m.k === 'freeze' || m.k === 'thaw') { if (vt) vt.frozen = m.k === 'freeze'; if (near) sfx('ice'); }
        else if (near) {
          sfx(m.k === 'smite' ? 'smite' : m.k === 'slam' ? 'slam' : 'warp');
          if (m.k === 'slam' && vt) vt.slamAt = tnow;
          if (m.k === 'smite') { shakeEnd = tnow + 0.8; shakeAmt = 7; }
          if (m.k === 'slam') { shakeEnd = tnow + 0.5; shakeAmt = 4; }
        }
        break;
      }
      case 'piano': { var pw = m.id === me.id ? me : players[m.id]; var po = OBJ.filter(function (o) { return o.type === 'piano'; })[0]; if (po) po.flash = tnow; if (pw && Math.hypot(pw.x - me.x, pw.y - me.y) < 700) { sfx('note', m.n); setTimeout(function () { sfx('note', (m.n + 4) % 15); }, 180); setTimeout(function () { sfx('note', (m.n + 7) % 15); }, 360); } break; }
      case 'busy': if (players[m.id]) { players[m.id].busy = m.g; renderOnline(); } break;
      case 'look': if (players[m.id]) { players[m.id].look = m.look; players[m.id].cos = m.cos; } break;
      case 'pop': {
        if (!m.v) break; addPop(m.id, m.v); if (m.id === me.id && m.v > 0) celebrate(m.v, m.m || 0);
        var w2 = m.id === me.id ? me : players[m.id]; if (w2) flashNear(w2);
        break;
      }
      case 'feed': {
        var mine = m.nick === me.nick, jp = m.game === 'jackpot';
        feed((jp ? '💰💰 ' : '🎉 ') + '<b>' + esc(m.nick) + '</b> won 📜 ' + fmt(m.amount) + (GAME_NAME[m.game] ? ' on ' + GAME_NAME[m.game] : '') + (m.mult >= 5 ? ' (' + m.mult + '×)' : '') + '!', '', jp ? 9000 : 6000);
        if (mine) { fxBurst('confetti'); if (jp) { fxBurst('money'); celebrate(m.amount, 0, 'JACKPOT WIN'); } }
        else { var wp = null; for (var k in players) if (players[k].nick === m.nick) wp = players[k]; if (wp) A.burst(parts, jp ? 'money' : 'confetti', wp.x, wp.y, 30); }
        if (jp) sfx('jackpot');
        break;
      }
      case 'error':
        if (m.code === 'login' || m.code === 'replaced' || m.code === 'full' || m.code === 'kicked') {
          fatal = true; hideLoading();
          $('gateTitle').textContent = m.code === 'login' ? 'Log in to play' : m.code === 'replaced' ? 'Opened somewhere else' : m.code === 'kicked' ? 'Removed from the casino' : 'Casino is packed';
          $('gateMsg').textContent = m.msg || ''; $('gate').style.display = 'flex';
        }
        break;
    }
  }
  function hideLoading() { var l = $('loading'); if (l.style.display === 'none') return; l.style.opacity = '0'; setTimeout(function () { l.style.display = 'none'; }, 400); }
  // Coming back to the tab after a long time away: make sure the socket is fresh.
  document.addEventListener('visibilitychange', function () { if (!document.hidden && wsOk && performance.now() - lastRecv > 20000) { try { ws.close(); } catch (e) {} } });

  // ================================================================ PROFILE / BOARDS
  var lastCoins = null;
  SC.profileListeners.push(function (p) {
    animCoins(p.coins); $('pBal').textContent = fmt(p.coins);
    if (lastCoins != null && p.coins !== lastCoins) {
      var d = p.coins - lastCoins, el = $('coinDelta');
      el.textContent = (d > 0 ? '+' : '−') + fmt(Math.abs(d)); el.style.color = d > 0 ? '#2bd576' : '#ff5c6c';
      el.style.transition = 'none'; el.style.opacity = '1'; el.style.transform = 'translateY(0)';
      clearTimeout(el._t); el._t = setTimeout(function () { el.style.transition = 'opacity .6s, transform .9s'; el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; }, 1300);
    }
    lastCoins = p.coins;
    me.look = lookFromProfile(p);
    me.cos = { tag: p.tag || '', color: p.color || '', titleFx: p.titleFx || '' };
    if (SC.panelKind === 'shop') renderShop();
    if (SC.panelKind === 'wardrobe') renderWardrobe();
  });
  function refreshBoards() {
    api('leaderboard').then(function (d) { lbBoard.rows = (d.top || []).slice(0, 5).map(function (u) { return { n: u.nick || 'player', v: fmt(u.coins) }; }); if (!lbBoard.rows.length) lbBoard.rows = [{ n: 'Nobody yet', v: '' }]; });
    api('tournament').then(function (d) {
      tourBoard.rows = (d.top || []).slice(0, 5).map(function (u) { return { n: u.nick || 'player', v: '+' + fmt(u.net) }; });
      if (!tourBoard.rows.length) tourBoard.rows = [{ n: 'Be the first winner!', v: '' }];
      tourBoard.footer = '🥇 ' + fmt((d.prizes || [0])[0]) + ' · ends in ' + SC.fmtLeft(d.endsAt - Date.now());
    });
  }

  // ================================================================ BOOT
  // School Mode: a nickname is enough to walk in (same nickname as the games hub)
  function nickGate() {
    fetch('/api/school', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (s) {
      if (!s || !s.on) return;
      $('gateTitle').textContent = 'Pick a nickname'; $('gateMsg').textContent = 'Type a nickname to walk into the casino.'; $('gateNick').style.display = 'block'; $('gateBack').href = '/arcade'; $('gateBack').textContent = '🎮 Games hub';
      var go = function () { var n = $('gnInput').value.trim(); $('gnErr').textContent = '';
        fetch('/api/arcade/nick', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nick: n }) }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) location.reload(); else $('gnErr').textContent = (d && d.error) || 'Try another nickname.'; }).catch(function () { $('gnErr').textContent = 'Couldn’t connect — try again.'; }); };
      $('gnGo').onclick = go; $('gnInput').onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') go(); }; setTimeout(function () { $('gnInput').focus(); }, 50);
    }).catch(function () {});
  }
  function boot() {
    api('me').then(function (d) {
      if (d.error === 'no-id' || d.error === 'network') {
        hideLoading(); $('gateTitle').textContent = d.error === 'network' ? "Can't reach the casino" : 'Log in to play';
        $('gateMsg').textContent = d.error === 'network' ? 'Check your connection and reload.' : 'Log in to ScrollHub to walk into the casino with your friends.'; $('gate').style.display = 'flex';
        if (d.error === 'no-id') nickGate();
        return;
      }
      state.store = d.store || []; A.season = d.season == null ? 'xmas' : d.season; if (window.SHMusic) SHMusic.season(A.season); state.season = A.season; state.cases = d.cases || {}; state.dailyMs = d.dailyMs; state.nick = d.nick;
      state.store.forEach(function (it) { storeById[it.id] = it; });
      me.nick = d.nick || 'You';
      SC.setProfile(d.profile);
      connect();
      refreshBoards(); setInterval(refreshBoards, 60000);
      setTimeout(hideLoading, 5000);
    });
    cv.focus();
    requestAnimationFrame(function (t) { lastFrame = t; requestAnimationFrame(frame); });
  }
  var fontsReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('600 14px Fredoka'), new Promise(function (r) { setTimeout(r, 1500); })]) : Promise.resolve();
  fontsReady.then(boot, boot);

  // debug hook for testing
  SC._world = { me: me, players: function () { return players; }, openPanel: openPanel, closePanel: closePanel, OBJ: OBJ, hits: hits, walkTo: walkTo, dropWs: function () { try { ws.close(); } catch (e) {} }, wsState: function () { return { ok: wsOk, lastRecv: performance.now() - lastRecv }; } };
})();
