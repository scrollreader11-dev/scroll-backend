/* ============================================================
   Scrolls Casino 2D — the shared world.
   Walk around one casino floor with everyone online; every game,
   the shop, the wardrobe and the ATM are objects you walk up to.
   ============================================================ */
(function () {
  var SC = window.SC, A = SC.art, state = SC.state, fmt = SC.fmt, esc = SC.esc, api = SC.api, toast = SC.toast;
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var T = 48, COLS = 44, ROWS = 32, WW = COLS * T, WH = ROWS * T, SPEED = 230;

  // ================================================================ MAP
  var G = [];
  for (var yy = 0; yy < ROWS; yy++) { var row = []; for (var xx = 0; xx < COLS; xx++) row.push('#'); G.push(row); }
  function fill(x0, y0, x1, y1, ch) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) G[y][x] = ch; }
  fill(1, 2, 11, 30, 'r');   // Slot Alley
  fill(13, 2, 31, 8, 'b');   // High Stakes
  fill(13, 9, 31, 23, 'c');  // Main floor
  fill(13, 24, 31, 30, 'g'); // Lobby
  fill(33, 2, 42, 15, 'p');  // Vault
  fill(33, 17, 42, 30, 'w'); // Shop
  fill(12, 5, 12, 7, 'r'); fill(12, 14, 12, 17, 'c'); fill(12, 25, 12, 27, 'g'); // doorways west
  fill(32, 5, 32, 7, 'p'); fill(32, 20, 32, 22, 'w');                           // doorways east
  fill(41, 16, 42, 16, 'p');                                                    // vault <-> shop
  fill(21, 31, 22, 31, 'g');                                                    // exit
  function tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#'; return G[ty][tx]; }

  // ================================================================ OBJECTS
  var DEF = {
    slot: { box: [-28, -36, 28, 0], act: 'slots', label: 'Play Slots', ia: [0, 24], pr: -118 },
    blackjack: { box: [-84, -76, 84, 10], act: 'blackjack', label: 'Play Blackjack', ia: [0, 36], pr: -150, ar: 80 },
    roulette: { box: [-96, -80, 96, 10], act: 'roulette', label: 'Play Roulette', ia: [0, 36], pr: -152, ar: 92 },
    dice: { box: [-91, -78, 91, 10], act: 'dice', label: 'Roll Dice', ia: [0, 36], pr: -152, ar: 88 },
    coinflip: { box: [-27, -22, 27, 0], act: 'coinflip', label: 'Flip a Coin', ia: [0, 26], pr: -138 },
    mines: { box: [-64, -86, 64, 4], act: 'mines', label: 'Play Mines', ia: [0, 30], pr: -122, ar: 72 },
    plinko: { box: [-54, -30, 54, 0], act: 'plinko', label: 'Play Plinko', ia: [0, 26], pr: -176, ar: 64 },
    wheel: { box: [-52, -24, 52, 0], act: 'wheel', label: 'Spin the Wheel', ia: [0, 28], pr: -206, ar: 72 },
    crash: { box: [-70, -28, 60, 0], act: 'crash', label: 'Launch Crash', ia: [-10, 26], pr: -170, ar: 76 },
    casebox: { box: [-43, -30, 43, 0], act: 'cases', label: 'Open Cases', ia: [0, 26], pr: -130 },
    arena: { layer: 'decal', act: 'battles', label: 'Join Case Battles', ia: [0, 14], pr: -142, ar: 104 },
    shop: { box: [-136, -62, 136, 0], act: 'shop', label: 'Browse the Shop', ia: [0, 30], pr: -132, ar: 120 },
    wardrobe: { box: [-58, -26, 66, 0], act: 'wardrobe', label: 'Change Outfit', ia: [-6, 28], pr: -128, ar: 72 },
    atm: { box: [-30, -28, 30, 0], act: 'atm', label: 'Use ATM', ia: [0, 26], pr: -132 },
    board: { layer: 'wall', ia: [0, 42], pr: 6, ar: 84 },
    fountain: { box: [-88, -58, 88, 4] },
    plant: { box: [-16, -14, 16, 0] },
    pillar: { box: [-20, -14, 20, 0] },
    couch: { box: [-56, -46, 56, 0] },
    rope: { box: [-50, -6, 50, 0] },
    shelf: { layer: 'wall' },
    sign: { layer: 'wall' },
    rug: { layer: 'decal' },
    npc: { box: [-16, -10, 16, 0] },
    exit: { layer: 'decal', act: 'exit', label: 'Leave Casino', ia: [0, -14], pr: -40, ar: 60 },
  };
  var OBJ = [];
  function add(type, x, y, o) {
    var d = DEF[type] || {}, ob = o || {};
    ob.type = type; ob.x = x; ob.y = y; ob.layer = ob.layer || d.layer || 'ent';
    if (d.box && !ob.nobox) ob.box = [x + d.box[0], y + d.box[1], x + d.box[2], y + d.box[3]];
    ob.act = ob.act || d.act || null; ob.label = ob.label || d.label || '';
    if (ob.act) { ob.ax = x + (d.ia || [0, 24])[0]; ob.ay = y + (d.ia || [0, 24])[1]; ob.ar = ob.ar || d.ar || 58; ob.py = y + (ob.pr != null ? ob.pr : (d.pr != null ? d.pr : -110)); }
    OBJ.push(ob); return ob;
  }
  // Slot Alley
  [120, 216, 312, 408, 504].forEach(function (x, i) { add('slot', x, 190, { v: i }); add('slot', x, 600, { v: i + 2 }); add('slot', x, 1004, { v: i + 4 }); });
  add('slot', 312, 1384, { big: true, v: 3, label: 'Play MEGA Slots', pr: -150 });
  add('sign', 312, 26, { text: 'SLOT ALLEY', color: '#ff6ec7', size: 26, v: 1 });
  add('plant', 84, 1452); add('couch', 470, 1448, { col: '#7b2cbf', w: 90 }); add('plant', 548, 1176);
  add('plant', 84, 760); add('plant', 548, 760);
  // High Stakes
  var lbBoard = add('board', 768, 118, { title: '🏆 RICHEST PLAYERS', act: 'leaderboard', label: 'View Leaderboard', footer: 'walk up & press E for the full board', rows: [] });
  var tourBoard = add('board', 1344, 118, { title: '🥇 WEEKLY TOURNAMENT', act: 'tournament', label: 'View Tournament', rows: [] });
  add('wheel', 1056, 300);
  add('crash', 870, 384);
  add('plinko', 1288, 392);
  add('sign', 1056, 26, { text: 'HIGH STAKES', color: '#5cf2ff', size: 26, v: 2 });
  add('rope', 700, 446); add('rope', 1412, 446);
  // Main floor
  add('blackjack', 792, 600, { v: 1 }); add('blackjack', 1320, 600, { v: 2 });
  add('coinflip', 952, 556); add('coinflip', 1160, 556);
  add('fountain', 1056, 830);
  add('roulette', 792, 990); add('dice', 1320, 990);
  add('pillar', 664, 476); add('pillar', 1448, 476); add('pillar', 664, 1140); add('pillar', 1448, 1140);
  // Lobby
  add('rug', 1056, 1330, { w: 300, h: 104, text: 'SCROLLS CASINO', col: '#7d1d36', size: 22 });
  add('atm', 732, 1292);
  add('wardrobe', 1376, 1292);
  add('couch', 862, 1462, { col: '#5a189a' }); add('couch', 1250, 1462, { col: '#5a189a' });
  add('plant', 652, 1462); add('plant', 1460, 1462);
  add('exit', 1056, 1512);
  // Vault
  add('casebox', 1680, 192, { v: 0, label: 'Open Starter Case' }); add('casebox', 1920, 192, { v: 1, label: 'Open High Roller Case' });
  add('sign', 1800, 26, { text: 'THE VAULT', color: '#b185ff', size: 26, v: 3 });
  add('arena', 1824, 472);
  add('npc', 1636, 420, { look: A.NPC.guard, name: 'Vault Guard' });
  add('mines', 1824, 724);
  add('plant', 1612, 742); add('plant', 2036, 742);
  // Shop
  add('shelf', 1670, 832, { w: 120, items: [{ k: 'hat', v: 'cowboy' }, { k: 'hat', v: 'wizard' }, { k: 'hat', v: 'viking' }, { k: 'hat', v: 'party' }] });
  add('shelf', 1880, 832, { w: 110, items: [{ k: 'hat', v: 'top' }, { k: 'hat', v: 'chef' }, { k: 'hat', v: 'beanie' }, { k: 'hat', v: 'prop' }] });
  add('sign', 1777, 800, { text: 'SHOP', color: '#ffd166', size: 24, v: 4 });
  add('shop', 1760, 972);
  add('rug', 1846, 1262, { w: 210, h: 130, col: '#1d4f7a' });
  add('npc', 1640, 1130, { look: { skin: 'dino', body: 'm:gold', hat: 'crown', acc: 'cape' }, stand: true, name: 'Royal Dino' });
  add('npc', 1640, 1270, { look: { skin: 'robot', body: 'm:chrome', hat: 'wizard', acc: 'pixel' }, stand: true, name: 'Wizard Bot' });
  add('npc', 1640, 1410, { look: { skin: 'cat', body: 'm:galaxy', hat: 'halo', acc: 'chain' }, stand: true, name: 'Cosmic Cat' });
  add('wardrobe', 1962, 1244);
  add('plant', 2036, 1460);

  var BOXES = OBJ.filter(function (o) { return o.box; }).map(function (o) { return o.box; });
  var ACTS = OBJ.filter(function (o) { return o.act; });

  // ================================================================ STATE
  var me = { id: 0, x: 1056, y: 1344, dir: 0, mv: false, walk: 0, look: { skin: 'gim', body: '#3fa9ff' }, cos: {}, nick: '', cid: '', emote: null, busy: '' };
  var players = {};   // id -> remote player
  var parts = [];     // world particles
  var pops = [];      // floating numbers
  var tnow = 0;
  var storeById = {};
  var GAME_NAME = { slots: 'Slots', blackjack: 'Blackjack', roulette: 'Roulette', dice: 'Dice', coinflip: 'Coinflip', mines: 'Mines', plinko: 'Plinko', wheel: 'the Wheel', crash: 'Crash', cases: 'Cases', battles: 'Case Battles' };
  var BUSY_ICON = { slots: '🎰', blackjack: '🃏', roulette: '🔴', dice: '🎲', coinflip: '🪙', mines: '💣', plinko: '🔵', wheel: '🎡', crash: '🚀', cases: '📦', battles: '⚔️', shop: '🛍️', wardrobe: '👕', atm: '🏧', leaderboard: '🏆', tournament: '🥇', player: '💬' };

  function lookFromProfile(p) {
    var L = p.look || {}, out = {};
    ['skin', 'body', 'hat', 'acc', 'trail'].forEach(function (k) { var it = L[k] && storeById[L[k]]; out[k] = it ? it.value : (k === 'skin' ? 'gim' : k === 'body' ? '#3fa9ff' : ''); });
    return out;
  }

  // ================================================================ CANVAS
  var cv = $('world'), ctx = cv.getContext('2d');
  var DPR = 1, Z = 1, VW = 0, VH = 0, cam = { x: 0, y: 0 }, tileCache = {}, vign = null;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); VW = innerWidth; VH = innerHeight;
    cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
    Z = clamp(Math.min(VW / 1100, VH / 700), 0.52, 1.3);
    tileCache = {};
    vign = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    vign.addColorStop(0, 'rgba(8,5,25,0)'); vign.addColorStop(1, 'rgba(8,5,25,.45)');
  }
  window.addEventListener('resize', resize); resize();
  function tileImg(key, draw) {
    var c = tileCache[key]; if (c) return c;
    var S = Math.ceil(T * Z * DPR) + 1; c = document.createElement('canvas'); c.width = S; c.height = S;
    draw(c.getContext('2d'), S); tileCache[key] = c; return c;
  }
  var shadowStrip = (function () { var c = document.createElement('canvas'); c.width = 4; c.height = 32; var g = c.getContext('2d'); var gr = g.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(8,5,25,.45)'); gr.addColorStop(1, 'rgba(8,5,25,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 32); return c; })();

  function drawTiles() {
    var tx0 = Math.max(0, Math.floor(cam.x / T) - 1), ty0 = Math.max(0, Math.floor(cam.y / T) - 1);
    var tx1 = Math.min(COLS - 1, Math.ceil((cam.x + VW / Z) / T) + 1), ty1 = Math.min(ROWS - 1, Math.ceil((cam.y + VH / Z) / T) + 1);
    var ty, tx, ch;
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
      ch = G[ty][tx]; if (ch === '#') continue;
      var v = ch === 'g' ? (tx + ty) % 2 : ch === 'w' ? tx % 3 : 0;
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
  var keys = {}, joy = { x: 0, y: 0, on: false };
  var panelOpen = function () { return $('panel').classList.contains('open') || $('imodal').style.display === 'flex'; };
  window.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (e.key === 'Escape') { if ($('emotes').classList.contains('open')) { toggleEmotes(false); return; } if (panelOpen()) { closePanel(); return; } }
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (panelOpen()) return;
    var k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    keys[k] = true;
    if (k === 'e' || k === 'enter' || k === ' ') { if (!e.repeat) interact(); }
    else if (k === 't') { if (!e.repeat) toggleEmotes(); }
    else if (/^[1-9]$/.test(k)) { var em = ownedEmotes()[+k - 1]; if (em) sendEmote(em.id); }
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', function () { keys = {}; });
  cv.addEventListener('mousedown', function (e) {
    cv.focus();
    if (promptRect && e.clientX >= promptRect[0] && e.clientX <= promptRect[2] && e.clientY >= promptRect[1] && e.clientY <= promptRect[3]) { interact(); return; }
    // click on a nearby object/player you're standing at
    var wx = cam.x + e.clientX / Z, wy = cam.y + e.clientY / Z;
    if (target && Math.hypot(wx - (target.ax || target.x), wy - (target.ay || target.y)) < 160) interact();
  });
  // touch
  var isTouch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  if (isTouch) document.body.classList.add('touch');
  (function () {
    var zone = $('joy'), base = $('joyBase'), knob = $('joyKnob'), tid = null, ox = 0, oy = 0;
    zone.addEventListener('touchstart', function (e) { var t = e.changedTouches[0]; tid = t.identifier; ox = t.clientX; oy = t.clientY; base.style.display = 'block'; base.style.left = (ox - 60) + 'px'; base.style.top = (oy - 60) + 'px'; joy.on = true; e.preventDefault(); }, { passive: false });
    zone.addEventListener('touchmove', function (e) { for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (t.identifier !== tid) continue; var dx = t.clientX - ox, dy = t.clientY - oy, d = Math.hypot(dx, dy), m = Math.min(d, 50); if (d > 0) { dx = dx / d * m; dy = dy / d * m; } knob.style.left = (35 + dx) + 'px'; knob.style.top = (35 + dy) + 'px'; joy.x = dx / 50; joy.y = dy / 50; } e.preventDefault(); }, { passive: false });
    var end = function (e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === tid) { joy.on = false; joy.x = joy.y = 0; base.style.display = 'none'; knob.style.left = knob.style.top = '35px'; tid = null; } };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    $('actBtn').addEventListener('click', function () { interact(); });
    $('emoBtnM').addEventListener('click', function () { toggleEmotes(); });
  })();
  $('emoBtn').onclick = function () { toggleEmotes(); };
  $('fsBtn').onclick = function () { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} };
  $('onlineBtn').onclick = function () { var l = $('onlineList'); l.style.display = l.style.display === 'block' ? 'none' : 'block'; renderOnline(); };
  setTimeout(function () { $('hint').style.opacity = '0'; }, 12000);

  // ================================================================ MOVEMENT
  function hits(x, y) {
    var x0 = x - 12, x1 = x + 12, y0 = y - 10, y1 = y;
    if (x0 < 0 || x1 > WW || y0 < 0 || y1 > WH - 2) return true;
    var tx0 = Math.floor(x0 / T), tx1 = Math.floor(x1 / T), ty0 = Math.floor(y0 / T), ty1 = Math.floor(y1 / T);
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) if (tileAt(tx, ty) === '#') return true;
    for (var i = 0; i < BOXES.length; i++) { var b = BOXES[i]; if (x1 > b[0] && x0 < b[2] && y1 > b[1] && y0 < b[3]) return true; }
    return false;
  }
  function update(dt) {
    var ix = 0, iy = 0;
    if (!panelOpen()) {
      if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
      if (keys.w || keys.arrowup) iy -= 1; if (keys.s || keys.arrowdown) iy += 1;
      if (joy.on && Math.hypot(joy.x, joy.y) > 0.18) { ix = joy.x; iy = joy.y; }
    }
    var len = Math.hypot(ix, iy);
    me.mv = len > 0.01;
    if (me.mv) {
      if (len > 1) { ix /= len; iy /= len; }
      var sp = SPEED * Math.min(1, joy.on ? Math.max(0.45, len) : 1);
      var nx = me.x + ix * sp * dt, ny = me.y + iy * sp * dt;
      if (!hits(nx, me.y)) me.x = nx; else { // slide around corners
        if (!hits(nx, me.y - 6) && iy <= 0) { me.x = nx; me.y -= 6 * dt * 10; } else if (!hits(nx, me.y + 6) && iy >= 0) { me.x = nx; me.y += 6 * dt * 10; }
      }
      if (!hits(me.x, ny)) me.y = ny;
      me.dir = Math.abs(ix) > Math.abs(iy) ? (ix < 0 ? 1 : 2) : (iy < 0 ? 3 : 0);
      me.walk += dt * 13;
    }
    // remote interpolation
    for (var id in players) {
      var p = players[id], f = Math.min(1, dt * 12);
      p.x += (p.tx - p.x) * f; p.y += (p.ty - p.y) * f;
      var moving = p.mv || Math.hypot(p.tx - p.x, p.ty - p.y) > 2;
      if (moving) p.walk += dt * 13;
      p.moving = moving;
      if (moving && p.look.trail && (p._tr = (p._tr || 0) + dt) > 0.045) { p._tr = 0; A.spawnTrail(parts, p.look.trail, p.x, p.y, tnow); }
    }
    if (me.mv && me.look.trail && (me._tr = (me._tr || 0) + dt) > 0.045) { me._tr = 0; A.spawnTrail(parts, me.look.trail, me.x, me.y, tnow); }
    // camera
    var vw = VW / Z, vh = VH / Z;
    var tx = me.x - vw / 2, ty = me.y - 30 - vh / 2;
    tx = vw >= WW ? (WW - vw) / 2 : clamp(tx, 0, WW - vw); ty = vh >= WH ? (WH - vh) / 2 : clamp(ty, 0, WH - vh);
    var cf = cam._init ? Math.min(1, dt * 8) : 1; cam._init = true;
    cam.x += (tx - cam.x) * cf; cam.y += (ty - cam.y) * cf;
    netTick();
    findTarget();
  }

  // ================================================================ INTERACTION
  var target = null, promptRect = null;
  function findTarget() {
    target = null; if (panelOpen()) return;
    var best = 1e9;
    for (var i = 0; i < ACTS.length; i++) { var o = ACTS[i], d = Math.hypot(me.x - o.ax, me.y - o.ay); if (d < o.ar && d < best) { best = d; target = o; } }
    for (var id in players) { var p = players[id], d2 = Math.hypot(me.x - p.x, me.y - p.y); if (d2 < 54 && d2 < best - 10) { best = d2; target = { act: 'player', p: p, label: 'Say hi to ' + p.nick, ax: p.x, ay: p.y, x: p.x, py: p.y - (p.look.hat ? 100 : 86) }; } }
    var ab = $('actBtn');
    if (target) { ab.classList.add('show'); ab.textContent = target.act === 'player' ? 'HI' : target.act === 'exit' ? 'EXIT' : 'USE'; } else ab.classList.remove('show');
  }
  function interact() {
    if (!target || panelOpen()) return;
    if (target.act === 'player') openPanel('player', target.p);
    else openPanel(target.act, target);
  }

  // ================================================================ PANELS
  var META = {
    slots: ['🎰', 'Slots', 'Three reels, one lever'], blackjack: ['🃏', 'Blackjack', 'Beat the dealer to 21'], roulette: ['🔴', 'Roulette', 'Place your bet on the wheel'],
    dice: ['🎲', 'Dice', 'Over or under?'], coinflip: ['🪙', 'Coinflip', 'Heads or tails'], mines: ['💣', 'Mines', 'Find the gems, dodge the bombs'],
    plinko: ['🔵', 'Plinko', 'Drop it and pray'], wheel: ['🎡', 'The Big Wheel', 'Spin for a multiplier'], crash: ['🚀', 'Crash', 'Cash out before it blows'],
    cases: ['📦', 'Case Vault', 'Open a case'], battles: ['⚔️', 'Case Battles', 'Open cases against other players'],
    leaderboard: ['🏆', 'Richest Players', 'Top balances on ScrollHub'], tournament: ['🥇', 'Weekly Tournament', 'Most Scrolls won this week'],
    atm: ['🏧', 'ATM', 'Daily Scrolls & event codes'], shop: ['🛍️', 'The Shop', 'Characters, colors, hats, trails & more'],
    wardrobe: ['👕', 'Wardrobe', 'Dress up your character'], player: ['💬', 'Player', ''], exit: ['🚪', 'Exit', ''],
  };
  SC.panelKind = '';
  var panelData = null;
  function openPanel(kind, data) {
    if (!META[kind]) return;
    toggleEmotes(false);
    SC.panelKind = kind; panelData = data;
    var m = META[kind];
    $('pIco').textContent = m[0]; $('pTitle').textContent = m[1]; $('pSub').textContent = m[2];
    if (kind === 'cases' && data && data.v === 1) $('pSub').textContent = 'Starter or High Roller — your call';
    document.querySelectorAll('#panel .view').forEach(function (s) { s.classList.toggle('on', s.dataset.panel === kind); });
    $('panel').classList.add('open');
    keys = {};
    if (data && data.ax != null && kind !== 'player') me.dir = data.ay > data.y ? 3 : 0;
    SC.games.open(kind);
    if (kind === 'shop') renderShop();
    if (kind === 'wardrobe') renderWardrobe();
    if (kind === 'player') renderPlayer(data);
    startPreviews();
    netSend({ t: 'busy', g: kind === 'exit' ? '' : kind });
    me.busy = kind;
  }
  function closePanel() {
    if (!panelOpen()) return;
    if ($('imodal').style.display === 'flex') { $('imodal').style.display = 'none'; return; }
    $('panel').classList.remove('open');
    SC.panelKind = ''; panelData = null; me.busy = '';
    previews = [];
    netSend({ t: 'busy', g: '' });
    cv.focus();
  }
  $('pClose').onclick = closePanel;
  $('panel').addEventListener('mousedown', function (e) { if (e.target === $('panel')) closePanel(); });
  $('exStay').onclick = closePanel;
  $('exGo').onclick = function () { location.href = '/'; };

  // ================================================================ PREVIEWS (shop / wardrobe cards)
  var previews = [];
  function lookWith(it) {
    var L = Object.assign({}, me.look);
    if (it && ['skin', 'body', 'hat', 'acc', 'trail'].indexOf(it.type) >= 0) L[it.type] = it.value;
    return L;
  }
  function drawItemPreview(c, it, W, H, t, pp) {
    c.clearRect(0, 0, W, H);
    var k = W / 96;
    c.save(); c.scale(k, k);
    if (!it) { A.label(c, '∅', 48, 48, { size: 30, color: '#a9a3d6', stroke: false }); A.label(c, 'None', 48, 76, { size: 12, color: '#a9a3d6', stroke: false }); }
    else if (['skin', 'body', 'hat', 'acc', 'trail'].indexOf(it.type) >= 0) {
      var L = lookWith(it);
      if (it.type === 'trail') { if (Math.random() < 0.5) A.spawnTrail(pp, it.value, 30 + Math.random() * 12, 86, t); A.drawParticles(c, pp, 1 / 30); }
      var sc = it.type === 'hat' ? 1.25 : 1.35;
      A.drawGim(c, it.type === 'trail' ? 58 : 48, it.type === 'hat' ? 92 : 86, L, { t: t, scale: sc, dir: it.type === 'trail' ? 2 : 0, moving: it.type === 'trail', walk: t * 12, shadow: true });
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
  function startPreviews() { /* registry is filled by renders; the main loop animates it */ }
  function animPreviews(t) {
    if (!previews.length || t - pvLast < 1 / 30) return; pvLast = t;
    for (var i = 0; i < previews.length; i++) { var p = previews[i]; if (!p.cv.isConnected) continue; p.draw(t); }
  }
  function addPreview(cv2, it) {
    var pp = [], c = cv2.getContext('2d');
    var o = { cv: cv2, draw: function (t) { drawItemPreview(c, it, cv2.width, cv2.height, t, pp); } };
    previews.push(o); o.draw(tnow);
  }

  // ================================================================ SHOP
  var SHOP_TABS = [['skin', 'Characters'], ['body', 'Colors'], ['hat', 'Hats'], ['acc', 'Accessories'], ['trail', 'Trails'], ['emote', 'Emotes'], ['tag', 'Name Tags'], ['color', 'Name Colors'], ['profile', 'Profile FX']];
  var SHOP_HINT = { skin: 'Your character shape. Free ones are ready to wear.', body: 'Paint your character. Gold, Chrome, Lava, Galaxy and Rainbow are animated.', hat: 'Hats show up on your character for everyone to see.', acc: 'Glasses, chains, capes and more.', trail: 'Leave something behind wherever you walk.', emote: 'Pop an emote over your head with T or the number keys.', tag: 'A title shown above your name — in the casino and in chat.', color: 'Color your name — in the casino and in chat.', profile: 'Profile banners, avatar rings and title effects for your ScrollHub profile.' };
  var shopTab = 'skin';
  function owns(it) { var p = state.profile; return !!p && (it.price === 0 || p.inventory.indexOf(it.id) >= 0); }
  function isEquipped(it) {
    var p = state.profile; if (!p) return false; var L = p.look || {};
    if (['skin', 'body', 'hat', 'acc', 'trail'].indexOf(it.type) >= 0) return L[it.type] === it.id;
    if (it.type === 'tag') return p.tag === it.label; if (it.type === 'color') return p.color === it.value;
    if (it.type === 'banner') return p.banner === it.value; if (it.type === 'avatar') return p.avatarFx === it.value; if (it.type === 'titlefx') return p.titleFx === it.value;
    return false;
  }
  function tabItems(tab) {
    return state.store.filter(function (it) { return tab === 'profile' ? (it.type === 'banner' || it.type === 'avatar' || it.type === 'titlefx') : it.type === tab; })
      .slice().sort(function (a, b) { return a.price - b.price; });
  }
  function renderShop() {
    $('shopTabs').innerHTML = SHOP_TABS.map(function (t) { return '<button class="tab' + (t[0] === shopTab ? ' on' : '') + '" data-st="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    $('shopTabs').querySelectorAll('[data-st]').forEach(function (b) { b.onclick = function () { shopTab = b.dataset.st; renderShop(); }; });
    $('shopHint').textContent = SHOP_HINT[shopTab] || '';
    previews = previews.filter(function (p) { return p.cv.isConnected && !p.cv.closest('#shopGrid'); });
    var g = $('shopGrid'); g.innerHTML = '';
    tabItems(shopTab).forEach(function (it) {
      var d = document.createElement('div'); d.className = 'icard';
      var own = owns(it), eq = isEquipped(it), coins = state.profile ? state.profile.coins : 0;
      var btn;
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
      SC.setProfile(d.profile); fxBurst('confetti');
      if (it.type === 'emote') { toast('New emote: ' + it.value + ' — press T to use it'); return; }
      toast('Purchased ' + it.label + '!');
      equip(id);
    });
  }
  function equip(id) {
    api('equip', { itemId: id }).then(function (d) { if (d.error) { toast(SC.errMsg(d.error)); return; } SC.setProfile(d.profile); netSend({ t: 'look' }); });
  }
  var UNEQ = { hat: 'none-hat', acc: 'none-acc', trail: 'none-trail', tag: 'none-tag', color: 'none-color', banner: 'none-banner', avatar: 'none-avatarFx', titlefx: 'none-titlefx' };
  function unequip(it) { var k = UNEQ[it.type]; if (!k) return; equip(k); }

  // ================================================================ WARDROBE
  var WD_TABS = [['skin', 'Character'], ['body', 'Color'], ['hat', 'Hat'], ['acc', 'Accessory'], ['trail', 'Trail'], ['tag', 'Name Tag'], ['color', 'Name Color']];
  var wdTab = 'skin', wdDir = 0, wdWalk = false, wdParts = [];
  $('wdRotL').onclick = function () { wdDir = [1, 3, 2, 0][wdDir]; };
  $('wdRotR').onclick = function () { wdDir = [2, 0, 3, 1][wdDir]; };
  $('wdWalk').onclick = function () { wdWalk = !wdWalk; };
  function renderWardrobe() {
    $('wdTabs').innerHTML = WD_TABS.map(function (t) { return '<button class="tab' + (t[0] === wdTab ? ' on' : '') + '" data-wt="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    $('wdTabs').querySelectorAll('[data-wt]').forEach(function (b) { b.onclick = function () { wdTab = b.dataset.wt; renderWardrobe(); }; });
    previews = previews.filter(function (p) { return p.cv.isConnected && !p.cv.closest('#wdGrid'); });
    if (!previews.some(function (p) { return p.cv === $('wdPrev'); })) {
      var pc = $('wdPrev'), c = pc.getContext('2d');
      previews.push({ cv: pc, draw: function (t) {
        c.clearRect(0, 0, pc.width, pc.height); c.save(); c.scale(pc.width / 220, pc.height / 250);
        if (wdWalk && me.look.trail && Math.random() < 0.6) A.spawnTrail(wdParts, me.look.trail, 110 - (wdDir === 2 ? 24 : wdDir === 1 ? -24 : 0), 200, t);
        if (wdWalk) wdParts.forEach(function (p) { p.x += (wdDir === 2 ? -1 : wdDir === 1 ? 1 : 0) * 60 / 30; p.y += (wdDir === 0 ? -1 : wdDir === 3 ? 1 : 0) * 60 / 30; });
        A.drawParticles(c, wdParts, 1 / 30);
        A.drawGim(c, 110, 205, me.look, { t: t, scale: 2.6, dir: wdDir, moving: wdWalk, walk: t * 12, blink: ((t % 4) < 0.12) });
        drawNameTag(c, 110, 205 - 2.6 * (me.look.hat ? 66 : 54), me.nick || 'You', me.cos, t, 1.1);
        c.restore();
      } });
    }
    var g = $('wdGrid'); g.innerHTML = '';
    var items = tabItems(wdTab);
    var canNone = ['hat', 'acc', 'trail', 'tag', 'color'].indexOf(wdTab) >= 0;
    var list = (canNone ? [null] : []).concat(items.filter(owns), items.filter(function (it) { return !owns(it); }));
    list.forEach(function (it) {
      var d = document.createElement('div'); var own = !it || owns(it);
      var eq = it ? isEquipped(it) : !anyEquipped(wdTab);
      d.className = 'icard' + (own ? '' : ' locked') + (eq ? ' sel' : '');
      d.innerHTML = '<canvas width="' + Math.round(76 * DPR) + '" height="' + Math.round(76 * DPR) + '"></canvas><div class="nm" style="font-size:13px;min-height:28px">' + (it ? esc(it.label) : 'None') + '</div>' + (own ? '' : '<span class="lock">🔒</span><div class="price" style="font-size:12px">📜 ' + fmt(it.price) + '</div>');
      d.onclick = function () {
        if (!it) { equip(UNEQ[wdTab]); return; }
        if (!own) { toast('Buy it at the Shop counter 🛍️'); return; }
        if (!isEquipped(it)) equip(it.id);
      };
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
  }

  // ================================================================ EMOTES
  function ownedEmotes() { return state.store.filter(function (it) { return it.type === 'emote' && owns(it); }); }
  function toggleEmotes(force) {
    var el = $('emotes'), open = force != null ? force : !el.classList.contains('open');
    if (open && panelOpen()) return;
    el.classList.toggle('open', open);
    if (open) {
      $('emoGrid').innerHTML = ownedEmotes().map(function (it, i) { return '<button data-em="' + it.id + '" title="' + esc(it.label) + '">' + (i < 9 ? '<i>' + (i + 1) + '</i>' : '') + (it.value === 'GG' ? '<span style="font-size:20px">GG</span>' : it.value) + '</button>'; }).join('');
      $('emoGrid').querySelectorAll('[data-em]').forEach(function (b) { b.onclick = function () { sendEmote(b.dataset.em); toggleEmotes(false); }; });
    }
  }
  var lastEmote = 0;
  function sendEmote(id) { if (Date.now() - lastEmote < 1200) return; lastEmote = Date.now(); netSend({ t: 'emote', id: id }); }

  // ================================================================ NAME TAGS
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
  function drawBubble(c, x, y, e, age) {
    var sc = age < 0.15 ? age / 0.15 * 1.15 : age < 0.25 ? 1.15 - (age - 0.15) * 1.5 : 1;
    if (age > 2.7) sc *= Math.max(0, 1 - (age - 2.7) / 0.3);
    c.save(); c.translate(x, y); c.scale(sc, sc);
    A.rr(c, -22, -44, 44, 38, 14); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = A.OL; c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(-6, -7); c.lineTo(0, 2); c.lineTo(6, -7); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(-7, -9, 14, 4);
    if (e === 'GG') A.label(c, 'GG', 0, -25, { size: 20, color: '#7b5cff', stroke: false });
    else { c.font = '26px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 0, -24); }
    c.restore();
  }

  // ================================================================ RENDER
  var lastFrame = performance.now(), mmLast = 0;
  var npcCtx = { lookAt: function (x, y) { return { x: me.x - x, y: me.y - y }; }, blink: function (s) { return ((tnow + s * 1.7) % 4) < 0.12; } };
  function frame(now) {
    var dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now; tnow += dt;
    update(dt);
    var k = Z * DPR;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0c0a22'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
    drawTiles();
    var vx0 = cam.x - 220, vx1 = cam.x + VW / Z + 220, vy0 = cam.y - 60, vy1 = cam.y + VH / Z + 280;
    var i, o;
    for (i = 0; i < OBJ.length; i++) { o = OBJ[i]; if (o.layer === 'decal' && o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1) drawObj(o); }
    for (i = 0; i < OBJ.length; i++) { o = OBJ[i]; if (o.layer === 'wall' && o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1) drawObj(o); }
    A.drawParticles(ctx, parts, dt);
    var ents = [];
    for (i = 0; i < OBJ.length; i++) { o = OBJ[i]; if (o.layer === 'ent' && o.x > vx0 && o.x < vx1 && o.y > vy0 && o.y < vy1) ents.push(o); }
    for (var id in players) ents.push(players[id]);
    ents.push(me);
    ents.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < ents.length; i++) { var e = ents[i]; if (e.type) drawObj(e); else drawPlayer(e); }
    // overlays: tags, bubbles, pops
    for (i = 0; i < ents.length; i++) { var p = ents[i]; if (!p.type) drawOverlay(p); }
    drawPops(dt);
    drawPrompt();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = vign; ctx.fillRect(0, 0, VW, VH);
    animPreviews(tnow);
    if (now - mmLast > 250) { mmLast = now; drawMinimap(); }
    requestAnimationFrame(frame);
  }
  function drawObj(o) {
    var f = A.obj[o.type];
    if (o.type === 'npc') {
      if (o.stand) { A.ell(ctx, o.x, o.y - 2, 26, 9); ctx.fillStyle = '#d4a63a'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 3; ctx.stroke(); }
      A.drawGim(ctx, o.x, o.y - (o.stand ? 4 : 0), o.look, { t: tnow + o.x, lookAt: npcCtx.lookAt(o.x, o.y - 20), blink: npcCtx.blink(o.x % 7), shadow: !o.stand });
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
  function drawPlayer(p) {
    var isMe = p === me;
    var blink = ((tnow + (p.blinkSeed || 0)) % 4.2) < 0.12;
    A.drawGim(ctx, p.x, p.y, p.look, { t: tnow + (p.blinkSeed || 0), dir: p.dir, moving: isMe ? p.mv : p.moving, walk: p.walk, blink: blink });
  }
  function drawOverlay(p) {
    var top = p.y - (p.look && p.look.hat ? 80 : 66) - (p.look && p.look.skin === 'bunny' ? 10 : 0) - (p.look && (p.look.skin === 'alien' || p.look.skin === 'robot') ? 6 : 0);
    drawNameTag(ctx, p.x, top, p.nick || '…', p.cos, tnow, 1);
    var tagUp = p.cos && p.cos.tag ? 18 : 0;
    if (p.busy && BUSY_ICON[p.busy] && p !== me) {
      A.circ(ctx, p.x + 22, p.y - 44, 11); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = A.OL; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.font = '12px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(BUSY_ICON[p.busy], p.x + 22, p.y - 43);
    }
    if (p.emote) { var age = (performance.now() - p.emote.at) / 1000; if (age < 3) drawBubble(ctx, p.x, top - 10 - tagUp, p.emote.e, age); else p.emote = null; }
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
  // minimap
  var mm = $('minimap'), mmc = mm.getContext('2d'), mmBase = null;
  function drawMinimap() {
    if (isTouch) return;
    var sx = mm.width / WW, sy = mm.height / WH;
    if (!mmBase) {
      mmBase = document.createElement('canvas'); mmBase.width = mm.width; mmBase.height = mm.height; var b = mmBase.getContext('2d');
      var COL = { r: '#4b2a86', b: '#1d2a66', c: '#7d1d36', g: '#9c8a64', p: '#3a2d6e', w: '#8a5a32' };
      for (var ty = 0; ty < ROWS; ty++) for (var tx = 0; tx < COLS; tx++) { var ch = G[ty][tx]; b.fillStyle = ch === '#' ? '#120e2e' : COL[ch]; b.fillRect(tx * T * sx, ty * T * sy, T * sx + 0.6, T * sy + 0.6); }
      b.fillStyle = 'rgba(255,255,255,.55)'; ACTS.forEach(function (o) { b.fillRect(o.x * sx - 1, o.y * sy - 1, 2, 2); });
    }
    mmc.clearRect(0, 0, mm.width, mm.height); mmc.drawImage(mmBase, 0, 0);
    for (var id in players) { var p = players[id]; mmc.fillStyle = '#ffd166'; mmc.beginPath(); mmc.arc(p.x * sx, p.y * sy, 2.6, 0, 7); mmc.fill(); }
    mmc.fillStyle = '#fff'; mmc.strokeStyle = '#120e2e'; mmc.lineWidth = 1.5; mmc.beginPath(); mmc.arc(me.x * sx, me.y * sy, 3.6, 0, 7); mmc.fill(); mmc.stroke();
    mmc.strokeStyle = 'rgba(255,255,255,.5)'; mmc.lineWidth = 1; mmc.strokeRect(cam.x * sx, cam.y * sy, VW / Z * sx, VH / Z * sy);
  }

  // ================================================================ EFFECTS / FEED
  function fxBurst(kind) { A.burst(parts, kind === 'money' ? 'money' : 'confetti', me.x, me.y, kind === 'money' ? 18 : 40); }
  SC.fx = fxBurst;
  function addPop(id, v) { pops.push({ id: id, text: (v >= 0 ? '+' : '−') + fmt(Math.abs(v)), col: v >= 0 ? '#2bd576' : '#ff5c6c', age: 0, x: 0, y: 0 }); }
  function feed(html, cls, ms) {
    var d = document.createElement('div'); d.className = 'feeditem' + (cls ? ' ' + cls : ''); d.innerHTML = html;
    var f = $('feed'); f.appendChild(d); while (f.children.length > 4) f.removeChild(f.firstChild);
    setTimeout(function () { d.style.transition = 'opacity .4s'; d.style.opacity = '0'; setTimeout(function () { d.remove(); }, 450); }, ms || 5000);
  }
  function flashNear(p) {
    var best = null, bd = 150;
    ACTS.forEach(function (o) { var d = Math.hypot(o.ax - p.x, o.ay - p.y); if (d < bd) { bd = d; best = o; } });
    if (best) best.flash = tnow;
  }
  function renderOnline() {
    var l = $('onlineList'); if (l.style.display !== 'block') return;
    var all = [me].concat(Object.keys(players).map(function (k) { return players[k]; }));
    l.innerHTML = '<div style="font-weight:700;margin-bottom:4px">In the casino (' + all.length + ')</div>' + all.map(function (p) {
      return '<div class="row"><span class="dot" style="background:' + A.baseHex(p.look && p.look.body) + '"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (p.cos && p.cos.color && p.cos.color[0] === '#' ? p.cos.color : '#fff') + '">' + esc(p.nick) + (p === me ? ' (you)' : '') + '</span>' + (p.busy && BUSY_ICON[p.busy] ? '<span>' + BUSY_ICON[p.busy] + '</span>' : '') + '</div>';
    }).join('');
  }
  function updateOnlineCount() { $('onlineN').textContent = 1 + Object.keys(players).length; renderOnline(); }

  // ================================================================ NETWORK
  var ws = null, wsOk = false, fatal = false, retry = 800, lastSent = { x: 0, y: 0, d: -1, m: false, at: 0 };
  function netSend(o) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} }
  function netTick() {
    if (!wsOk) return;
    var now = performance.now();
    if (now - lastSent.at < 66) return;
    var changed = Math.abs(me.x - lastSent.x) > 0.5 || Math.abs(me.y - lastSent.y) > 0.5 || me.dir !== lastSent.d || me.mv !== lastSent.m;
    if (!changed) return;
    lastSent = { x: me.x, y: me.y, d: me.dir, m: me.mv, at: now };
    netSend({ t: 'mv', x: Math.round(me.x), y: Math.round(me.y), d: me.dir, m: me.mv ? 1 : 0 });
  }
  function mkPlayer(p) { return { id: p.id, cid: p.cid, nick: p.nick, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: p.dir || 0, mv: !!p.mv, walk: 0, look: p.look || {}, cos: p.cos || {}, busy: p.busy || '', blinkSeed: Math.random() * 4, emote: null }; }
  function connect() {
    var proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(proto + '://' + location.host + '/world-ws');
    ws.onopen = function () { retry = 800; };
    ws.onmessage = function (ev) { var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onNet(m); };
    ws.onclose = function () {
      wsOk = false; if (fatal) return;
      $('netState').style.display = 'flex';
      setTimeout(connect, retry); retry = Math.min(6000, retry * 1.6);
    };
  }
  function onNet(m) {
    switch (m.t) {
      case 'welcome':
        wsOk = true; fatal = false; $('netState').style.display = 'none';
        me.id = m.you.id; me.cid = m.you.cid; me.nick = m.you.nick;
        if (!me._placed) { me.x = m.you.x; me.y = m.you.y; me._placed = true; }
        me.look = m.you.look || me.look; me.cos = m.you.cos || me.cos;
        players = {}; (m.players || []).forEach(function (p) { players[p.id] = mkPlayer(p); });
        updateOnlineCount(); hideLoading();
        lastSent.at = 0; lastSent.d = -1; // push our position right away (keeps place across reconnects)
        if (me.busy) netSend({ t: 'busy', g: me.busy });
        break;
      case 'join': players[m.p.id] = mkPlayer(m.p); updateOnlineCount(); feed('👋 <b>' + esc(m.p.nick) + '</b> walked in', 'join', 3500); break;
      case 'leave': delete players[m.id]; updateOnlineCount(); break;
      case 'snap': m.ps.forEach(function (a) { var p = players[a[0]]; if (!p) return; p.tx = a[1]; p.ty = a[2]; p.dir = a[3]; p.mv = !!a[4]; }); break;
      case 'pos': me.x = m.x; me.y = m.y; break;
      case 'emote': {
        var who = m.id === me.id ? me : players[m.id]; if (!who) break;
        who.emote = { e: m.e, at: performance.now() };
        if (m.e === '💸') A.burst(parts, 'money', who.x, who.y, 16);
        if (m.e === '🎉') A.burst(parts, 'confetti', who.x, who.y, 24);
        break;
      }
      case 'busy': if (players[m.id]) { players[m.id].busy = m.g; renderOnline(); } break;
      case 'look': if (players[m.id]) { players[m.id].look = m.look; players[m.id].cos = m.cos; } break;
      case 'pop': {
        if (!m.v) break; addPop(m.id, m.v);
        var w2 = m.id === me.id ? me : players[m.id]; if (w2) flashNear(w2);
        break;
      }
      case 'feed': {
        var mine = m.nick === me.nick;
        feed('🎉 <b>' + esc(m.nick) + '</b> won 📜 ' + fmt(m.amount) + (GAME_NAME[m.game] ? ' on ' + GAME_NAME[m.game] : '') + (m.mult >= 5 ? ' (' + m.mult + '×)' : '') + '!', '', 6000);
        if (mine) fxBurst('confetti');
        else { var wp = null; for (var k in players) if (players[k].nick === m.nick) wp = players[k]; if (wp) A.burst(parts, 'confetti', wp.x, wp.y, 30); }
        break;
      }
      case 'error':
        if (m.code === 'login' || m.code === 'replaced' || m.code === 'full') {
          fatal = true; hideLoading();
          $('gateTitle').textContent = m.code === 'login' ? 'Log in to play' : m.code === 'replaced' ? 'Opened somewhere else' : 'Casino is packed';
          $('gateMsg').textContent = m.msg || ''; $('gate').style.display = 'flex';
        }
        break;
    }
  }
  function hideLoading() { var l = $('loading'); if (l.style.display === 'none') return; l.style.opacity = '0'; setTimeout(function () { l.style.display = 'none'; }, 400); }

  // ================================================================ PROFILE / BOARDS
  var lastCoins = null;
  SC.profileListeners.push(function (p) {
    $('coins').textContent = fmt(p.coins); $('pBal').textContent = fmt(p.coins);
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
  function boot() {
    api('me').then(function (d) {
      if (d.error === 'no-id' || d.error === 'network') {
        hideLoading(); $('gateTitle').textContent = d.error === 'network' ? "Can't reach the casino" : 'Log in to play';
        $('gateMsg').textContent = d.error === 'network' ? 'Check your connection and reload.' : 'Log in to ScrollHub to walk into the casino with your friends.'; $('gate').style.display = 'flex'; return;
      }
      state.store = d.store || []; state.cases = d.cases || {}; state.dailyMs = d.dailyMs; state.nick = d.nick;
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
  SC._world = { me: me, players: function () { return players; }, openPanel: openPanel, closePanel: closePanel, OBJ: OBJ, hits: hits };
})();
