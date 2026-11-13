/* ============================================================
   Bedwars 2D — client. Loading screen, menus, lobby, networking with
   interpolation + local prediction, input (mouse/keys/touch), rendering,
   HUD, shop, end screen.
   ============================================================ */
(function () {
  'use strict';
  var B = window.BW, D = window.BWD, SC = window.SC, A = SC.art;
  var T = B.T, W = B.W, H = B.H, TAU = Math.PI * 2;
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), c = cv.getContext('2d');
  var touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  if (touch) document.body.classList.add('touch');
  function now() { return performance.now(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function teamCol(t) { return (B.TEAMS[t] || B.TEAMS[0]).color; }
  function tname(t) { return (B.TEAMS[t] || B.TEAMS[0]).name; }

  // ------------------------------------------------------------------ sounds
  var tone = SC.sfxTone, noise = SC.sfxNoise, sweep = SC.sfxSweep;
  SC.sfxAdd('swing', function () { sweep(0.16, 0.5, 2600, 500, 0, 1.2); });
  SC.sfxAdd('hit', function () { noise(0.07, 0.35, 0, 200); tone(170, 0.1, 'triangle', 0.3, 0, 70); });
  SC.sfxAdd('crit', function () { noise(0.08, 0.35, 0, 300); tone(1400, 0.12, 'triangle', 0.15); tone(1900, 0.14, 'triangle', 0.12, 0.04); });
  SC.sfxAdd('hurt', function () { tone(260, 0.12, 'sawtooth', 0.14, 0, 120); noise(0.08, 0.3, 0, 150); });
  SC.sfxAdd('place', function () { tone(330, 0.05, 'square', 0.1); noise(0.05, 0.15, 0, 1200); });
  SC.sfxAdd('break', function () { noise(0.13, 0.35, 0, 500); tone(120, 0.08, 'square', 0.08); });
  SC.sfxAdd('mine', function () { noise(0.04, 0.12, 0, 900); });
  SC.sfxAdd('bed', function () { tone(110, 0.9, 'sawtooth', 0.18, 0, 45); noise(0.6, 0.35, 0, 90); tone(660, 0.5, 'triangle', 0.12, 0.05, 330); tone(990, 0.6, 'sine', 0.1, 0.12, 495); });
  SC.sfxAdd('pick_iron', function () { tone(1600, 0.05, 'triangle', 0.1); });
  SC.sfxAdd('pick_gold', function () { tone(1900, 0.06, 'triangle', 0.12); tone(2500, 0.08, 'triangle', 0.1, 0.04); });
  SC.sfxAdd('pick_gem', function () { [0, 4, 7, 12].forEach(function (n, i) { tone(SC.sfxNotes[n % 15] * 2, 0.12, 'triangle', 0.14, i * 0.05); }); });
  SC.sfxAdd('buy', function () { tone(988, 0.07, 'square', 0.1); tone(1319, 0.14, 'square', 0.1, 0.06); });
  SC.sfxAdd('no', function () { tone(180, 0.12, 'square', 0.12); tone(150, 0.16, 'square', 0.12, 0.1); });
  SC.sfxAdd('fall', function () { tone(900, 0.8, 'sine', 0.16, 0, 90); sweep(0.8, 0.25, 900, 100, 0, 0.8); });
  SC.sfxAdd('die', function () { tone(400, 0.25, 'sawtooth', 0.12, 0, 120); noise(0.2, 0.2, 0, 300); });
  SC.sfxAdd('respawn', function () { [0, 4, 7, 11, 14].forEach(function (n, i) { tone(SC.sfxNotes[n], 0.18, 'sine', 0.12, i * 0.06); }); });
  SC.sfxAdd('kill', function () { tone(1047, 0.1, 'square', 0.1); tone(1568, 0.18, 'square', 0.1, 0.08); });
  SC.sfxAdd('final', function () { [0, 4, 7, 12].forEach(function (n, i) { tone(SC.sfxNotes[n + 2], 0.16, 'square', 0.11, i * 0.07); }); noise(0.3, 0.2, 0.25, 200); });
  SC.sfxAdd('bow', function () { tone(420, 0.09, 'triangle', 0.14, 0, 900); noise(0.05, 0.12, 0, 2000); });
  SC.sfxAdd('throw', function () { sweep(0.25, 0.3, 1200, 300, 0, 1); });
  SC.sfxAdd('fuse', function () { noise(0.9, 0.08, 0, 3000); });
  SC.sfxAdd('warp', function () { tone(300, 0.35, 'sine', 0.15, 0, 1400); tone(1400, 0.3, 'sine', 0.1, 0.2, 400); });
  SC.sfxAdd('alarm', function () { for (var i = 0; i < 4; i++) { tone(880, 0.12, 'square', 0.12, i * 0.25); tone(660, 0.12, 'square', 0.12, i * 0.25 + 0.12); } });
  SC.sfxAdd('eat', function () { for (var i = 0; i < 3; i++) noise(0.05, 0.2, i * 0.12, 1500); tone(700, 0.25, 'sine', 0.1, 0.35, 1200); });
  SC.sfxAdd('level', function () { [0, 2, 4, 7, 9, 12].forEach(function (n, i) { tone(SC.sfxNotes[n], 0.14, 'triangle', 0.13, i * 0.05); }); });
  SC.sfxAdd('count', function () { tone(660, 0.12, 'square', 0.1); });
  SC.sfxAdd('go', function () { tone(988, 0.1, 'square', 0.12); tone(1319, 0.35, 'square', 0.12, 0.08); });
  SC.sfxAdd('boomS', function () { noise(0.9, 0.5, 0, 50); tone(70, 0.6, 'sine', 0.35, 0, 30); noise(0.3, 0.3, 0, 600); });
  SC.sfxAdd('pop2', function () { tone(600, 0.06, 'sine', 0.1, 0, 1100); });
  var listener = { x: 0, y: 0 };
  function sfxAt(name, x, y, arg) { var d = Math.hypot(x - listener.x, y - listener.y); if (d > 900) return; if (d > 450 && Math.random() < (d - 450) / 450) return; SC.sfx(name, arg); }

  // ------------------------------------------------------------------ state
  var S = {
    screen: 'loading', net: null, hello: null, room: null,
    map: null, ents: new Map(), myId: 0, team: 0, mode: 'solo', kind: 'public', goAt: 0,
    inv: {}, res: { iron: 0, gold: 0, dia: 0, em: 0 }, sword: 1, armor: 1, pick: 0, held: 'sword', hp: 20, absorb: 0,
    dead: false, elim: false, respawnAt: 0, speedUntil: 0, slowUntil: 0, stats: {},
    teams: [], gens: [], tier: { dia: 0, em: 0 }, tl: 0, projs: new Map(), tnts: new Map(), cracks: {}, placeAnim: {}, slashes: [],
    shake: 0, hurtT: 0, ended: null, qc: [], lastSnap: 0, specId: 0,
  };
  var P = null; // my locally-simulated body
  var cam = { x: 36 * T, y: 36 * T, z: 1 };
  var offset = 0, bestRtt = 1e9, rtt = 0;
  function snow() { return Date.now() + offset; }

  // ------------------------------------------------------------------ net
  var ws = null, wsOpen = false, reconnectT = 0, backoff = 800, pingT = 0, lastRecv = 0;
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function connect() {
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/bw-ws'); } catch (e) { scheduleReconnect(); return; }
    ws.onopen = function () { wsOpen = true; backoff = 800; lastRecv = Date.now(); send({ t: 'ping', c: Date.now() }); };
    ws.onmessage = function (ev) { lastRecv = Date.now(); var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onclose = function () { wsOpen = false; if (!S.fatal) scheduleReconnect(); };
    ws.onerror = function () {};
  }
  function scheduleReconnect() { clearTimeout(reconnectT); reconnectT = setTimeout(connect, backoff); backoff = Math.min(6000, backoff * 1.6); if (S.screen === 'game') toast('Reconnecting…', 2000); }
  setInterval(function () {
    if (wsOpen) { send({ t: 'ping', c: Date.now() }); if (Date.now() - lastRecv > 9000) { try { ws.close(); } catch (e) {} } }
  }, 3000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && (!ws || ws.readyState > 1)) connect(); });

  function onMsg(m) {
    var t = m.t;
    if (t === 's') return onSnap(m);
    if (t === 'pong') { var r = Date.now() - m.c; rtt = r; if (r <= bestRtt * 1.3 || !offset) { bestRtt = Math.min(bestRtt, r); offset = m.n + r / 2 - Date.now(); } return; }
    if (t === 'me') return onMe(m);
    if (t === 'kb') { if (P && !P.dead) { P.vx += m.vx; P.vy += m.vy; } return; }
    if (t === 'pos') { if (P) { P.x = m.x; P.y = m.y; if (m.spawn) { P.dead = false; P.falling = 0; P.vx = P.vy = 0; } } return; }
    if (t === 'slow') { S.slowUntil = now() + m.ms; toast('🪤 You triggered a trap!', 2200); return; }
    if (t === 'fix') { setTileLocal(m.i, m.f, m.fc, m.w, m.wc, true); return; }
    if (t === 'buy') return onBuy(m);
    if (t === 'hello') { S.hello = m; S.qc = m.qc || []; helloArrived(); return; }
    if (t === 'room') { S.room = m; if (S.screen !== 'lobby') show('lobby'); renderLobby(); return; }
    if (t === 'lqc') { lobbyChat(m.nick, S.qc[m.i]); return; }
    if (t === 'game') return startGame(m);
    if (t === 'end') return onEnd(m);
    if (t === 'menu') { if (S.screen !== 'menu') show('menu'); return; }
    if (t === 'err') {
      if (m.code === 'login' || m.code === 'replaced') { S.fatal = true; fatal(m.msg, m.code); return; }
      toast(m.msg || 'Something went wrong', 2500); SC.sfx('no'); return;
    }
  }
  function fatal(msg, code) {
    var d = document.createElement('div'); d.className = 'modal'; d.style.zIndex = 90;
    d.innerHTML = '<div class="mwrap" style="width:min(460px,100%);padding:22px;text-align:center;gap:12px"><div style="font-size:46px">' + (code === 'login' ? '🔐' : '🪟') + '</div><h2 style="margin:0">' + esc(msg) + '</h2>' +
      (code === 'login' ? '<a class="btn green" href="/">Go to ScrollHub</a>' : '<button class="btn green" onclick="location.reload()">Play here instead</button>') + '</div>';
    document.body.appendChild(d);
    var ld = $('loading'); ld.classList.add('out');
  }

  // ------------------------------------------------------------------ screens
  function show(name) {
    S.screen = name;
    ['loading', 'menu', 'lobby', 'end'].forEach(function (k) { if (k !== 'loading') $(k).classList.toggle('hidden', k !== name); });
    var g = name === 'game' || name === 'end';
    $('hud').classList.toggle('hidden', !g);
    $('hudBtns').classList.toggle('hidden', name !== 'game');
    document.body.classList.toggle('ingame', name === 'game');
    $('crosshair').classList.toggle('hidden', name !== 'game' || touch);
    $('touch').classList.toggle('hidden', !(touch && name === 'game'));
    if (name === 'menu') { S.demo = true; S.map = S.demoMap; S.ended = null; D.resetChunks(); renderMenu(); closeShop(); }
    if (name === 'lobby') { S.demo = true; S.map = S.demoMap; D.resetChunks(); }
  }

  // ------------------------------------------------------------------ loading screen
  var TIPS = [
    'Hold <b>right click</b> and walk to speed-bridge across the void.',
    'Cover your bed in blocks early. <b>End stone</b> laughs at fireballs.',
    'You can’t walk off edges — but <b>knockback</b> can throw you off!',
    'Kill someone and you <b>steal all their resources</b>.',
    'Diamonds buy <b>team upgrades</b>: sharper swords, tougher armor, faster gens.',
    'A <b>Knockback Stick</b> barely hurts… but sends people flying.',
    'Break the block someone is standing on and watch them fall. 😈',
    'Throw a <b>Bridge Egg</b> to instantly build a wool bridge.',
    'Fireballs blow up wool and wood bridges — great for stopping rushers.',
    'Once your bed is gone, your next death is <b>final</b>. Play safe!',
    'Win matches to earn <b>Scrolls</b> for the casino.',
    'Your <b>casino outfit</b> is your fighter — hats, skins and all.',
  ];
  var tipI = Math.floor(Math.random() * TIPS.length);
  function nextTip() { $('ldTip').innerHTML = '💡 ' + TIPS[tipI++ % TIPS.length]; }
  nextTip(); var tipTimer = setInterval(nextTip, 3200);
  function ldStep(p, text) { $('ldBar').style.width = Math.round(p * 100) + '%'; $('ldStep').textContent = text; }
  var helloWaiters = [];
  function helloArrived() { var w = helloWaiters; helloWaiters = []; w.forEach(function (f) { f(); }); if (S.screen === 'menu') renderMenu(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function boot() {
    $('loadCv').style.display = 'none';
    $('loading').style.background = 'radial-gradient(ellipse at center, rgba(18,12,51,.35), rgba(18,12,51,.92) 70%)';
    ldStep(0.08, 'Waking up the islands…');
    try { await Promise.race([document.fonts.load('700 20px Fredoka'), wait(1500)]); } catch (e) {}
    S.demoMap = B.genMap(); S.map = S.demoMap; setupDemo();
    ldStep(0.3, 'Painting blocks & beds…'); await wait(250);
    var ids = ['sword1', 'sword2', 'sword3', 'sword4', 'kbstick', 'wool', 'wood', 'end', 'obby', 'pick1', 'pick2', 'pick3', 'pick4', 'bow', 'arrows', 'fireball', 'tnt', 'gapple', 'pearl', 'egg', 'speed', 'armor1', 'armor2', 'armor3', 'armor4', 'iron', 'gold', 'dia', 'em', 'forge', 'heal', 'trap', 'star'];
    ids.forEach(function (id) { D.iconURL(id, 0, 0, 64); });
    makeHearts(); makeCrosshair();
    ldStep(0.55, 'Sharpening swords…'); await wait(300);
    for (var cy = 0; cy < 6; cy++) for (var cx = 0; cx < 6; cx++) D.chunk(S.map, cx, cy);
    ldStep(0.75, 'Connecting to the server…');
    connect();
    await Promise.race([new Promise(function (r) { if (S.hello) r(); else helloWaiters.push(r); }), wait(8000)]);
    ldStep(1, S.hello ? 'Ready!' : 'Still connecting…');
    await wait(420);
    clearInterval(tipTimer);
    $('loading').classList.add('out');
    setTimeout(function () { $('loading').classList.add('hidden'); }, 700);
    if (S.screen === 'loading') show('menu');
  }

  // ------------------------------------------------------------------ demo world (menu background)
  var demo = [];
  function setupDemo() {
    demo = [];
    var looks = [{ skin: 'gim', body: '#3fa9ff', hat: 'crown' }, { skin: 'fox', body: '#ff922b', hat: '' }, { skin: 'panda', body: '#eef2ff', hat: 'cap' }, { skin: 'robot', body: 'm:chrome', hat: '' }, { skin: 'dino', body: '#3fd27a', hat: 'viking' }, { skin: 'ninja', body: '#4a4f6a', hat: '' }, { skin: 'astro', body: '#eef2ff', hat: '' }, { skin: 'duck', body: '#ffcc33', hat: 'party' }];
    S.demoMap.bases.forEach(function (b, t) {
      demo.push({ id: -1 - t * 2, team: t, look: looks[t * 2], x: b.gen.x + 30, y: b.gen.y + 26, ang: 0, held: 'sword', sword: 1 + t % 4, armor: 1 + (t % 3), wander: 0 });
      demo.push({ id: -2 - t * 2, team: t, look: looks[t * 2 + 1], x: b.spawn.x - 40, y: b.spawn.y + 30, ang: 0, held: 'pick', pick: 2, armor: 1, sword: 1, wander: 1 });
    });
    // a duel at mid
    demo.push({ id: -20, team: 0, look: { skin: 'knight', body: '#ff6b6b', hat: '' }, x: 36 * T - 30, y: 36 * T + 60, ang: 0, held: 'sword', sword: 4, armor: 4, duel: 1 });
    demo.push({ id: -21, team: 1, look: { skin: 'shark', body: '#3fa9ff', hat: 'pirate' }, x: 36 * T + 30, y: 36 * T + 60, ang: Math.PI, held: 'sword', sword: 3, armor: 3, duel: -1 });
    demo.forEach(function (e) { e.swingDir = 1; e.flashT = -9; e.walk = Math.random() * 6; e.nextSw = Math.random() * 2; });
  }
  function demoTick(dt, t) {
    demo.forEach(function (e) {
      if (e.duel) {
        e.x += Math.sin(t * 1.3 + e.duel) * 14 * dt * e.duel; e.moving = true; e.walk += dt * 8;
        e.ang = e.duel > 0 ? 0 : Math.PI;
        e.nextSw -= dt; if (e.nextSw <= 0) { e.nextSw = 0.7 + Math.random() * 0.6; e.swingT = 0; e.swingDir = -e.swingDir; S.slashes.push({ x: e.x, y: e.y - 18, ang: e.ang, dir: e.swingDir, t0: now(), reach: 60 }); var o = demo.find(function (q) { return q.duel === -e.duel; }); if (o && Math.random() < 0.6) { o.flashT = now(); D.burst('spark', o.x, o.y - 20, 6, '#fff'); D.text(o.x, o.y - 50, '-' + (4 + (Math.random() * 3 | 0)), '#ff5c6c', 15, { pop: true }); } }
      } else if (e.wander) { e.walk += dt * 6; e.moving = Math.sin(t * 0.7 + e.id) > 0; if (e.moving) { e.x += Math.cos(t * 0.5 + e.id) * 40 * dt; e.y += Math.sin(t * 0.37 + e.id) * 26 * dt; e.ang = Math.atan2(Math.sin(t * 0.37 + e.id), Math.cos(t * 0.5 + e.id)); } }
      if (e.swingT != null) { e.swingT += dt; if (e.swingT > 0.5) e.swingT = null; }
    });
  }

  // ------------------------------------------------------------------ menu
  var pMode = 'solo', pDiff = 'normal';
  function seg(id, cb) { var el = $(id); el.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; [].forEach.call(el.children, function (x) { x.classList.toggle('on', x === b); }); SC.sfx('click'); cb(b.dataset.v); }); }
  seg('pMode', function (v) { pMode = v; }); seg('pDiff', function (v) { pDiff = v; });
  seg('hMode', function (v) { send({ t: 'cfg', mode: v }); }); seg('hDiff', function (v) { send({ t: 'cfg', diff: v }); });
  function renderMenu() {
    var h = S.hello || {}, st = h.stats || {};
    $('mNick').textContent = h.nick || 'Player';
    $('mCoins').textContent = (st.coins || 0).toLocaleString();
    $('sWins').textContent = st.wins || 0; $('sFinals').textContent = st.finals || 0; $('sBeds').textContent = st.beds || 0; $('sKills').textContent = st.kills || 0; $('sGames').textContent = st.games || 0;
    $('sToday').textContent = (st.earnedToday || 0) + '/' + (st.cap || 1500);
    var on = h.online || {};
    $('modes').innerHTML = ['solo', 'duos', 'squads'].map(function (k) {
      var md = B.MODES[k], dots = '';
      for (var t = 0; t < 4; t++) for (var p = 0; p < md.per; p++) dots += '<i style="background:' + teamCol(t) + '"></i>';
      return '<button class="mode" data-m="' + k + '"><div class="online">' + (on[k] ? '🟢 ' + on[k] + ' waiting' : 'Quick play') + '</div><h3>' + md.name + '</h3><p>' + md.desc + ' · bots fill empty slots</p><div class="dots">' + dots + '</div><span class="play">▶ PLAY</span><div class="art">' + (k === 'solo' ? '⚔️' : k === 'duos' ? '🛏️' : '🏰') + '</div></button>';
    }).join('');
  }
  $('modes').addEventListener('click', function (e) { var b = e.target.closest('.mode'); if (!b) return; SC.sfx('open'); S.lastQueue = { t: 'quick', mode: b.dataset.m }; send(S.lastQueue); });
  $('pGo').onclick = function () { SC.sfx('open'); S.lastQueue = { t: 'practice', mode: pMode, diff: pDiff }; send(S.lastQueue); };
  $('cGo').onclick = function () { SC.sfx('open'); send({ t: 'create', mode: pMode, diff: pDiff }); };
  $('jGo').onclick = function () { var code = $('jCode').value.trim(); if (code.length < 4) { toast('Enter a 4-letter room code', 1800); return; } SC.sfx('open'); send({ t: 'join', code: code }); };
  $('jCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('jGo').click(); e.stopPropagation(); });
  $('howBtn').onclick = function () { $('how').classList.remove('hidden'); };
  $('howX').onclick = function () { $('how').classList.add('hidden'); };
  function muteSync() { var m = SC.sfxMuted(); $('mMute').textContent = $('gMute').textContent = m ? '🔇' : '🔊'; }
  $('mMute').onclick = $('gMute').onclick = function () { SC.sfxToggle(); muteSync(); };
  muteSync();
  // ?room=CODE links
  var qs = new URLSearchParams(location.search); if (qs.get('room')) $('jCode').value = qs.get('room').toUpperCase().slice(0, 4);
  helloWaiters.push(function () { if (qs.get('room') && S.screen !== 'game') send({ t: 'join', code: qs.get('room') }); });

  // menu character preview
  function drawMePreview(t) {
    var mc = $('meCv'); if (!mc || S.screen !== 'menu') return;
    var x = mc.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, mc.width, mc.height);
    var look = (S.hello && S.hello.look) || { skin: 'gim', body: '#3fa9ff' };
    x.save(); x.translate(200, 300); x.scale(3, 3);
    x.fillStyle = 'rgba(0,0,0,.25)'; A.ell(x, 0, 0, 26, 8); x.fill();
    var e = { team: 0, ang: -0.5 + Math.sin(t) * 0.4, held: 'sword', sword: 4, armor: 1, swingT: (t % 2.4) < 0.4 ? (t % 2.4) : null, swingDir: 1 };
    A.drawGim(x, 0, 0, look, { t: t, dir: 0, lookAt: { x: Math.cos(e.ang), y: 0.4 }, scale: 1, shadow: false });
    D.armor(x, e, 0, 0, t, 0);
    D.held(x, e, 0, 0, t);
    x.restore();
  }

  // ------------------------------------------------------------------ lobby
  var lobbyAvatar = {};
  function renderLobby() {
    var r = S.room; if (!r) return;
    var md = B.MODES[r.mode];
    $('lTitle').textContent = (r.kind === 'private' ? 'Private Room' : r.kind === 'practice' ? 'Practice' : 'Quick Play') + ' · ' + md.name;
    $('lCodeWrap').classList.toggle('hidden', !r.code); $('lCode').textContent = r.code || '';
    var host = r.kind === 'private' && r.host === r.you;
    $('lHost').classList.toggle('hidden', !host);
    if (host) { [].forEach.call($('hMode').children, function (b) { b.classList.toggle('on', b.dataset.v === r.mode); }); [].forEach.call($('hDiff').children, function (b) { b.classList.toggle('on', b.dataset.v === r.diff); }); }
    var html = '';
    for (var t = 0; t < 4; t++) {
      var tm = B.TEAMS[t], mem = r.members.filter(function (m) { return m.team === t; });
      html += '<div class="tcol"><div class="th" style="background:' + tm.color + '">' + tm.name + (r.kind === 'private' && mem.length < r.per && !mem.some(function (m) { return m.cid === r.you; }) ? '<button class="btn sm ghost" data-team="' + t + '">Join</button>' : '') + '</div>';
      for (var s = 0; s < r.per; s++) {
        var m = mem[s];
        if (m) html += '<div class="slot' + (m.cid === r.you ? ' you' : '') + '"><canvas width="96" height="96" data-av="' + esc(m.cid) + '"></canvas><div style="min-width:0"><div class="nm">' + esc(m.nick) + '</div><div class="tg">' + (m.cid === r.host && r.kind === 'private' ? '👑 Host' : m.cid === r.you ? 'You' : 'Player') + '</div></div></div>';
        else html += '<div class="slot empty">🤖 Bot will join</div>';
      }
      html += '</div>';
    }
    $('lTeams').innerHTML = html;
    [].forEach.call(document.querySelectorAll('[data-av]'), function (el) { var m = r.members.find(function (x) { return x.cid === el.dataset.av; }); if (m) lobbyAvatar[m.cid] = { el: el, look: m.look, team: m.team }; });
    if (!$('lTip').innerHTML || now() - (S.lTipAt || 0) > 6000) { S.lTipAt = now(); $('lTip').innerHTML = TIPS[tipI++ % TIPS.length]; }
    $('lQc').innerHTML = S.qc.slice(0, 6).map(function (q, i) { return '<button class="btn sm ghost" data-qc="' + i + '">' + esc(q) + '</button>'; }).join('');
    updateCount();
  }
  function updateCount() {
    var r = S.room; if (!r) return;
    var left = r.startIn ? Math.max(0, Math.ceil((r.startIn - (Date.now() - (r._at || (r._at = Date.now())))) / 1000)) : 0;
    $('lCount').innerHTML = r.startIn ? 'Starting in <b>' + left + '</b>' : r.kind === 'private' ? (r.host === r.you ? 'Start when ready' : 'Waiting for the host…') : 'Waiting for players…';
  }
  $('lTeams').addEventListener('click', function (e) { var b = e.target.closest('[data-team]'); if (b) { send({ t: 'team', team: +b.dataset.team }); SC.sfx('click'); } });
  $('lQc').addEventListener('click', function (e) { var b = e.target.closest('[data-qc]'); if (b) send({ t: 'qc', i: +b.dataset.qc }); });
  $('lLeave').onclick = function () { send({ t: 'leave' }); show('menu'); };
  $('hStart').onclick = function () { send({ t: 'start' }); SC.sfx('go'); };
  $('lCopy').onclick = function () { var u = location.origin + '/arcade/bedwars?room=' + (S.room && S.room.code); try { navigator.clipboard.writeText(u); toast('Invite link copied!', 1600); } catch (e) { toast(u, 4000); } };
  function lobbyChat(nick, text) { var d = document.createElement('div'); d.className = 'lmsg'; d.innerHTML = '<b>' + esc(nick) + ':</b> ' + esc(text); $('lchat').appendChild(d); setTimeout(function () { d.remove(); }, 4000); }
  function drawLobbyAvatars(t) {
    for (var k in lobbyAvatar) {
      var a = lobbyAvatar[k]; if (!a.el.isConnected) { delete lobbyAvatar[k]; continue; }
      var x = a.el.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 96, 96);
      x.save(); x.translate(48, 84); x.scale(1.5, 1.5); A.drawGim(x, 0, 0, a.look, { t: t, dir: 0, shadow: false }); D.armor(x, { team: a.team, armor: 1 }, 0, 0, t, 0); x.restore();
    }
  }

  // ------------------------------------------------------------------ game start
  function startGame(m) {
    S.demo = false; S.ended = null; closeShop();
    var map = B.genMap();
    m.blocks.forEach(function (b) { map.f[b[0]] = b[1]; map.fc[b[0]] = b[2]; map.w[b[0]] = b[3]; map.wc[b[0]] = b[4]; });
    m.beds.forEach(function (a, t) { if (!a) { map.beds[t].alive = false; map.obj[map.beds[t].foot] = 0; map.obj[map.beds[t].head] = 0; } });
    S.map = map; D.resetChunks();
    S.myId = m.you; S.team = m.team; S.mode = m.mode; S.kind = m.kind; S.code = m.code;
    offset = m.now - Date.now(); bestRtt = 1e9;
    S.goAt = m.goAt; S.teams = m.teams; S.tier = m.tier; S.tl = m.tl; S.qc = m.qc || S.qc;
    S.gens = map.gens.map(function (g, i) { return { g: g, n: (m.gens[i] || [0])[0], last: (m.gens[i] || [0, 0])[1] || snow(), every: 0 }; });
    S.ents = new Map(); S.projs = new Map(); S.tnts = new Map(); S.cracks = {}; S.placeAnim = {}; S.slashes = []; D.parts.length = 0; trails.length = 0;
    (m.tnts || []).forEach(function (x) { S.tnts.set(x[0], { x: x[1], y: x[2], at: x[3] }); });
    m.ents.forEach(function (o) {
      S.ents.set(o.id, { id: o.id, nick: o.nick, team: o.team, look: o.look, bot: o.bot, sword: o.sword, armor: o.armor, pick: o.pick, x: o.x, y: o.y, ang: 0, flags: o.dead ? 1 : 0, held: 'sword', hp: 20, buf: [], dead: o.dead, elim: o.elim, walk: 0, swingT: null, swingDir: 1, flashT: -9, fallT: 0, stats: o.stats || {}, dc: o.dc, bubble: null, lastStep: 0 });
    });
    var me = S.ents.get(S.myId);
    P = { x: me.x, y: me.y, vx: 0, vy: 0, dead: me.dead, falling: 0, mv: false, ang: 0, lastSend: 0 };
    S.dead = me.dead; S.elim = me.elim;
    cam.x = 36 * T; cam.y = 36 * T; cam.introFrom = { x: 36 * T, y: 36 * T };
    show('game');
    buildHud(); renderTeams(); updateHearts(); renderHotbar(); renderRes(true);
    $('death').classList.add('hidden');
    if (snow() < S.goAt) intro(); else { cam.x = P.x; cam.y = P.y; }
    miniBase = null;
    if (me.elim) showDeath(null, true);
  }
  function intro() {
    var el = $('intro'), tm = B.TEAMS[S.team];
    el.classList.remove('hidden');
    el.innerHTML = '<div class="who">You are on the</div><div class="team" style="color:' + tm.color + '">' + tm.name.toUpperCase() + ' TEAM</div><div class="goal">🛏 Protect your bed · ⚔️ Destroy the others</div><div class="num" id="introNum"></div>';
    SC.sfx('open');
    var last = -1;
    var iv = setInterval(function () {
      var left = Math.ceil((S.goAt - snow()) / 1000);
      if (left !== last && left <= 3 && left >= 1) { last = left; var n = $('introNum'); if (n) { n.textContent = left; n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); } SC.sfx('count'); }
      if (snow() >= S.goAt) {
        clearInterval(iv); var n2 = $('introNum'); if (n2) { n2.textContent = 'GO!'; n2.style.color = '#2bd576'; n2.classList.remove('pop'); void n2.offsetWidth; n2.classList.add('pop'); }
        SC.sfx('go'); setTimeout(function () { el.classList.add('hidden'); }, 800);
      }
      if (S.screen !== 'game') { clearInterval(iv); el.classList.add('hidden'); }
    }, 100);
  }

  // ------------------------------------------------------------------ snapshots & events
  var HELD = B.HOTBAR_ORDER;
  function onSnap(m) {
    if (S.screen !== 'game' && S.screen !== 'end') return;
    var ts = m.n;
    for (var k = 0; k < m.p.length; k++) {
      var a = m.p[k], e = S.ents.get(a[0]); if (!e) continue;
      var f = a[4];
      e.flags = f; e.hp = a[6];
      if (e.id !== S.myId) {
        e.held = HELD[a[5]] || 'sword';
        e.buf.push([ts, a[1], a[2], a[3] / 100]); if (e.buf.length > 30) e.buf.shift();
        e.mining = !!(f & 4); e.bowing = !!(f & 8);
        e.dead = !!(f & 1); e.elim = !!(f & 128); e.dc = !!(f & 256);
      } else { e.mining = !!(f & 4); }
    }
    // projectiles
    var seen = {};
    (m.pr || []).forEach(function (q) {
      seen[q[0]] = 1; var p = S.projs.get(q[0]);
      if (!p) { p = { id: q[0], kind: q[1], x: q[2], y: q[3], tx: q[2], ty: q[3], vx: 0, vy: 0, born: now() }; S.projs.set(q[0], p); }
      else { p.vx = (q[2] - p.tx) * 20; p.vy = (q[3] - p.ty) * 20; p.tx = q[2]; p.ty = q[3]; }
    });
    S.projs.forEach(function (p, id) { if (!seen[id]) S.projs.delete(id); });
    if (m.teams) { S.teams = m.teams; renderTeams(); }
    if (m.e) m.e.forEach(onEvent);
  }
  function entPos(e) { return e.id === S.myId && P ? { x: P.x, y: P.y } : { x: e.x, y: e.y }; }
  function nameHtml(e) { return e ? '<b style="color:' + teamCol(e.team) + '">' + esc(e.nick) + '</b>' : '?'; }
  function onEvent(ev) {
    var k = ev[0], e, p, i;
    if (k === 'sw') { e = S.ents.get(ev[1]); if (!e || e.id === S.myId) return; e.swingT = 0; e.swingDir = -(e.swingDir || 1); e.ang = ev[2] / 100; S.slashes.push({ x: e.x, y: e.y - 18, ang: e.ang, dir: e.swingDir, t0: now(), reach: e.held === 'kbstick' ? 66 : 58, owner: e.id }); sfxAt('swing', e.x, e.y); return; }
    if (k === 'hit') {
      e = S.ents.get(ev[1]); if (!e) return; p = entPos(e);
      var dmg = ev[2] / 10, crit = ev[3], att = ev[4], kind = ev[5];
      e.flashT = now();
      D.burst('spark', p.x, p.y - 20, crit ? 12 : 7, crit ? '#ffd166' : '#ffffff', { speed: 160 });
      D.text(p.x + (Math.random() - 0.5) * 16, p.y - 52, (crit ? '✦' : '') + (Math.round(dmg * 10) / 10), crit ? '#ffd166' : '#ff6b7a', crit ? 22 : 17, { pop: true });
      if (crit) { D.burst('star', p.x, p.y - 26, 6, '#ffd166'); D.text(p.x, p.y - 74, 'CRIT!', '#ffd166', 14, { vy: -50 }); }
      D.burst('dust', p.x, p.y, 4);
      if (e.id === S.myId) { S.shake = Math.max(S.shake, crit ? 9 : 6); S.hurtT = now(); SC.sfx('hurt'); }
      else if (att === S.myId) { S.shake = Math.max(S.shake, 3); SC.sfx(crit ? 'crit' : 'hit'); }
      else sfxAt(crit ? 'crit' : 'hit', p.x, p.y);
      return;
    }
    if (k === 'blk') { setTileLocal(ev[1], ev[2], ev[3], ev[4], ev[5]); return; }
    if (k === 'crk') { if (ev[2] < 0) delete S.cracks[ev[1]]; else { S.cracks[ev[1]] = ev[2]; var cp = tcen(ev[1]); if (Math.random() < 0.5) D.burst('cube', cp.x, cp.y - 8, 1, crackColor(ev[1]), { speed: 50 }); sfxAt('mine', cp.x, cp.y); } return; }
    if (k === 'bed') return bedBroken(ev[1], ev[2]);
    if (k === 'die') return died(ev);
    if (k === 'spawn') {
      e = S.ents.get(ev[1]); if (!e) return;
      e.dead = false; e.fallT = 0; e.x = ev[2]; e.y = ev[3]; e.buf = [];
      D.spawn({ k: 'beam', x: ev[2], y: ev[3], col: teamCol(e.team), life: 0.9 });
      D.burst('magic', ev[2], ev[3] - 20, 14, B.TEAMS[e.team].light);
      D.ring(ev[2], ev[3], teamCol(e.team), 50, 0.6, 5);
      if (e.id === S.myId) { SC.sfx('respawn'); $('death').classList.add('hidden'); S.dead = false; } else sfxAt('respawn', ev[2], ev[3]);
      return;
    }
    if (k === 'gen') { var g = S.gens[ev[1]]; if (!g) return; var up = ev[2] > g.n; g.n = ev[2]; g.last = snow(); g.every = ev[3] / 10; if (up && (g.g.kind === 'dia' || g.g.kind === 'em') && !g.g.base) { D.burst('magic', g.g.x, g.g.y - 20, 8, g.g.kind === 'dia' ? '#5ff0e6' : '#2bd576'); sfxAt('pop2', g.g.x, g.g.y); } return; }
    if (k === 'pick') {
      e = S.ents.get(ev[1]); g = S.gens[ev[2]]; if (!e || !g) return;
      var n = ev[3]; g.n = 0;
      for (var q = 0; q < Math.min(n, 8); q++) D.spawn({ k: 'fly', x: g.g.x + (Math.random() - 0.5) * 12, y: g.g.y - 4, res: g.g.kind, to: e.id, life: 0.35 + q * 0.04, sx: g.g.x, sy: g.g.y });
      if (e.id === S.myId) { SC.sfx(g.g.kind === 'iron' ? 'pick_iron' : g.g.kind === 'gold' ? 'pick_gold' : 'pick_gem'); D.text(P.x, P.y - 60, '+' + n + ' ' + B.RES_NAMES[g.g.kind], B.RES_COLORS[g.g.kind], 14, { vy: -60 }); }
      return;
    }
    if (k === 'loot') { if (ev[1] === S.myId) { var parts = []; B.RES.forEach(function (r, j) { if (ev[2 + j]) parts.push('+' + ev[2 + j] + ' ' + B.RES_NAMES[r]); }); if (parts.length) { D.text(P.x, P.y - 80, parts.join('  '), '#ffd166', 15, { vy: -40, life: 1.6 }); SC.sfx('coins'); } } return; }
    if (k === 'gear') { e = S.ents.get(ev[1]); if (e) { e.sword = ev[2]; e.armor = ev[3]; e.pick = ev[4]; } return; }
    if (k === 'ex') return boom(ev[1], ev[2], ev[3], ev[4]);
    if (k === 'tnt') { S.tnts.set(ev[1], { x: ev[2], y: ev[3], at: snow() + ev[4] }); sfxAt('fuse', ev[2], ev[3]); return; }
    if (k === 'shoot') { e = S.ents.get(ev[1]); if (!e) return; p = entPos(e); sfxAt(ev[2] === 'arrow' ? 'bow' : 'throw', p.x, p.y); return; }
    if (k === 'arrow') { D.burst('dust', ev[1], ev[2] + 16, 3); return; }
    if (k === 'tp') { D.burst('magic', ev[2], ev[3] - 20, 16, '#2ec4b6'); D.burst('magic', ev[4], ev[5] - 20, 16, '#2ec4b6'); D.ring(ev[4], ev[5], '#2ec4b6', 40, 0.5, 4); sfxAt('warp', ev[4], ev[5]); e = S.ents.get(ev[1]); if (e) { e.x = ev[4]; e.y = ev[5]; e.buf = []; } return; }
    if (k === 'eat') { e = S.ents.get(ev[1]); if (!e) return; p = entPos(e); D.burst('heart', p.x, p.y - 40, 5); sfxAt('eat', p.x, p.y); return; }
    if (k === 'drink') { e = S.ents.get(ev[1]); if (!e) return; p = entPos(e); D.burst('magic', p.x, p.y - 20, 14, '#7dd3fc'); sfxAt('level', p.x, p.y); return; }
    if (k === 'up') { if (ev[1] === S.team) { e = S.ents.get(ev[4]); var u = B.UP_BY_ID[ev[2]]; toast('⬆️ ' + (e ? esc(e.nick) : 'Teammate') + ' bought ' + u.name + (u.costs.length > 1 ? ' ' + ['I', 'II', 'III', 'IV'][ev[3] - 1] : ''), 2600, true); SC.sfx('level'); } return; }
    if (k === 'trap') { if (ev[1] === S.team) { e = S.ents.get(ev[2]); banner('TRAP TRIGGERED!', (e ? esc(e.nick) : 'Someone') + ' is in your base!', '#ffd166'); SC.sfx('alarm'); } return; }
    if (k === 'tl') { var tl = B.TIMELINE[ev[1]]; S.tl = ev[1] + 1; if (tl.ev === 'dia2') S.tier.dia = 1; if (tl.ev === 'em2') S.tier.em = 1; if (tl.ev === 'dia3') S.tier.dia = 2; if (tl.ev === 'em3') S.tier.em = 2; if (tl.ev !== 'beds' && tl.ev !== 'end') { banner(tl.ev.indexOf('dia') === 0 ? '💎 DIAMOND ' + (tl.ev === 'dia2' ? 'II' : 'III') : '💚 EMERALD ' + (tl.ev === 'em2' ? 'II' : 'III'), tl.text, tl.ev.indexOf('dia') === 0 ? '#5ff0e6' : '#2bd576'); SC.sfx('level'); } return; }
    if (k === 'elim') { feed('<b style="color:' + teamCol(ev[1]) + '">' + tname(ev[1]) + ' team</b> has been <b style="color:#ff5c6c">ELIMINATED</b>', true); if (ev[1] !== S.team) toastBig(tname(ev[1]).toUpperCase() + ' TEAM ELIMINATED', teamCol(ev[1])); return; }
    if (k === 'qc') { e = S.ents.get(ev[1]); if (e) { e.bubble = { text: S.qc[ev[2]] || '', t: now() }; if (e.team === S.team || e.id === S.myId) SC.sfx('pop'); } return; }
    if (k === 'dc') { e = S.ents.get(ev[1]); if (e) { e.dc = !!ev[2]; if (ev[2] && e.id !== S.myId) feed(nameHtml(e) + ' disconnected — a bot took over'); } return; }
  }
  function tcen(i) { return { x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2 }; }
  function crackColor(i) { var m = S.map; if (m.w[i]) return D.blockColor(m.w[i], m.wc[i]); if (m.obj[i] === 1) { var b = B.bedAt(m, i); return b ? teamCol(b.team) : '#fff'; } if (m.f[i]) return D.blockColor(m.f[i], m.fc[i]); return '#fff'; }
  function setTileLocal(i, f, fc, w, wc, fix) {
    var m = S.map; if (!m) return;
    var of = m.f[i], ow = m.w[i], ofc = m.fc[i], owc = m.wc[i];
    m.f[i] = f; m.fc[i] = fc; m.w[i] = w; m.wc[i] = wc;
    var p = tcen(i);
    if (S.pending && S.pending[i]) { delete S.pending[i]; if (!fix) return; }
    if ((w && !ow) || (f && !of)) { S.placeAnim[i] = now(); D.burst('dust', p.x, p.y + 10, 3); if (!fix) sfxAt('place', p.x, p.y); }
    if ((!w && ow) || (!f && of)) {
      var bid = ow && !w ? ow : of, bt = ow && !w ? owc : ofc;
      D.burst('cube', p.x, p.y - (ow && !w ? 10 : 0), 9, D.blockColor(bid, bt), { speed: 110 });
      D.burst('smoke', p.x, p.y, 3);
      if (!fix) sfxAt('break', p.x, p.y);
    }
  }
  function bedBroken(team, by) {
    var m = S.map, bed = m.beds[team]; if (!bed) return;
    bed.alive = false; m.obj[bed.foot] = 0; m.obj[bed.head] = 0;
    if (S.teams[team]) S.teams[team].bed = false;
    D.burst('feather', bed.x, bed.y, 26, '#ffffff', { speed: 160 });
    D.burst('cube', bed.x, bed.y, 18, teamCol(team), { speed: 170 });
    D.burst('cube', bed.x, bed.y, 8, '#7a4a28', { speed: 140 });
    D.ring(bed.x, bed.y, teamCol(team), 140, 0.7, 10); D.ring(bed.x, bed.y, '#ffffff', 90, 0.5, 6); D.flash(bed.x, bed.y, 160, '255,255,255', 0.35);
    var e = S.ents.get(by);
    var d = Math.hypot(bed.x - listener.x, bed.y - listener.y);
    S.shake = Math.max(S.shake, team === S.team ? 16 : d < 700 ? 8 : 3);
    SC.sfx('bed');
    if (team === S.team) banner('YOUR BED WAS DESTROYED!', 'You will no longer respawn' + (e ? ' · ' + esc(e.nick) + ' did it' : ''), '#ff5c6c');
    else banner(tname(team).toUpperCase() + ' BED DESTROYED', e ? 'by ' + esc(e.nick) + (by === S.myId ? ' (you!)' : '') : 'All beds are gone!', teamCol(team));
    feed('🛏️ <b style="color:' + teamCol(team) + '">' + tname(team) + ' bed</b> was destroyed' + (e ? ' by ' + nameHtml(e) : ''), true);
    renderTeams();
  }
  function died(ev) {
    var e = S.ents.get(ev[1]); if (!e) return;
    var kind = ev[2], killer = S.ents.get(ev[3]), final = ev[4], x = ev[5], y = ev[6];
    e.dead = true; if (final) e.elim = true;
    if (e.id === S.myId && P) { x = P.x; y = P.y; }
    if (kind === 'void') { e.fallT = now(); e.fallX = x; e.fallY = y; sfxAt('fall', x, y); }
    else { D.burst('smoke', x, y - 16, 10); D.burst('cube', x, y - 16, 6, teamCol(e.team), { speed: 120 }); D.spawn({ k: 'soul', x: x, y: y - 20, life: 1.4 }); sfxAt('die', x, y); }
    var how = kind === 'void' ? (killer ? 'knocked ' + nameHtml(e) + ' into the void' : '') : kind === 'arrow' ? '🏹' : kind === 'fireball' ? '🔥' : kind === 'tnt' ? '💥' : '⚔️';
    var line = killer ? (kind === 'void' ? nameHtml(killer) + ' ' + how : nameHtml(killer) + ' ' + how + ' ' + nameHtml(e)) : nameHtml(e) + (kind === 'void' ? ' fell into the void' : ' died');
    feed(line + (final ? ' <span class="fk">FINAL KILL</span>' : ''), final);
    if (killer && killer.id === S.myId) { SC.sfx(final ? 'final' : 'kill'); toastBig(final ? 'FINAL KILL!' : '+1 KILL', final ? '#ff5c6c' : '#ffd166'); }
    if (e.id === S.myId) { S.dead = true; if (P) P.dead = true; showDeath(killer, final, kind); }
  }
  function boom(x, y, rad, kind) {
    D.flash(x, y, rad * T * 1.6, '255,200,120', 0.35);
    D.ring(x, y, '#ffd166', rad * T * 1.2, 0.45, 12); D.ring(x, y, '#ffffff', rad * T * 0.8, 0.3, 6);
    D.burst('fire', x, y, 18, null, { speed: 180 }); D.burst('smoke', x, y, 16, 'rgba(90,80,100,', { speed: 120 }); D.burst('cube', x, y, 10, '#4a4f6a', { speed: 200 });
    var d = Math.hypot(x - listener.x, y - listener.y);
    S.shake = Math.max(S.shake, Math.max(2, 18 - d / 40));
    sfxAt('boomS', x, y);
  }

  // ------------------------------------------------------------------ me
  function onMe(m) {
    var oldRes = S.res, oldInv = S.inv;
    S.hp = m.hp; S.absorb = m.absorb; S.inv = m.inv; S.res = m.res; S.sword = m.sword; S.armor = m.armor; S.pick = m.pick; S.stats = m.stats;
    S.dead = m.dead; S.elim = m.elim; if (m.dead && !m.elim) S.respawnAt = now() + m.respawn; S.speedUntil = now() + m.speed;
    var me = S.ents.get(S.myId); if (me) { me.sword = m.sword; me.armor = m.armor; me.pick = m.pick; }
    var hb = B.hotbar(Object.assign({}, S.inv, { pick: S.pick }));
    if (hb.indexOf(S.held) < 0) { S.held = hb.indexOf(m.held) >= 0 ? m.held : 'sword'; }
    updateHearts(); renderHotbar(); renderRes(false, oldRes);
    if (!$('shop').classList.contains('hidden')) renderShop();
    void oldInv;
  }

  // ------------------------------------------------------------------ input
  var keys = {}, mouse = { x: innerWidth / 2, y: innerHeight / 2, wx: 0, wy: 0, l: false, r: false, lAt: 0 }, joy = { x: 0, y: 0, id: null };
  addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    var k = e.key.toLowerCase();
    if (k === 'escape') { closeShop(); $('how').classList.add('hidden'); $('qcMenu').classList.add('hidden'); return; }
    if (S.screen !== 'game') return;
    if (k === 'tab') { e.preventDefault(); showScore(true); return; }
    keys[k] = true;
    if (/^[1-9]$/.test(k)) { selectSlot(+k - 1); }
    if (k === 'e') { var n = nearNpc(); if (n) openShop(n.kind); else closeShop(); }
    if (k === 'q') toggleQc();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
  });
  addEventListener('keyup', function (e) { var k = e.key.toLowerCase(); keys[k] = false; if (k === 'tab') showScore(false); });
  addEventListener('blur', function () { keys = {}; mouse.l = mouse.r = false; });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; var ch = $('crosshair'); ch.style.left = e.clientX + 'px'; ch.style.top = e.clientY + 'px'; });
  cv.addEventListener('mousedown', function (e) {
    if (S.screen !== 'game') return;
    cv.focus();
    if (e.button === 0) {
      mouse.l = true; mouse.lAt = now();
      var n = npcUnderCursor(); if (n && Math.hypot(n.x - P.x, n.y - P.y) < 3.2 * T) { mouse.l = false; openShop(n.kind); return; }
      primaryDown();
    }
    if (e.button === 2) { mouse.r = true; tryPlace(true); }
  });
  addEventListener('mouseup', function (e) { if (e.button === 0) { if (mouse.l) primaryUp(); mouse.l = false; } if (e.button === 2) mouse.r = false; });
  cv.addEventListener('wheel', function (e) { if (S.screen !== 'game') return; var hb = hotbarItems(); var i = hb.indexOf(S.held); selectSlot((i + (e.deltaY > 0 ? 1 : -1) + hb.length) % hb.length); e.preventDefault(); }, { passive: false });

  // touch: joystick + buttons + tap the world
  if (touch) {
    var jEl = $('joy'), jK = $('joyK');
    function jMove(t) { var r = jEl.getBoundingClientRect(), dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy), mx = 45; if (d > mx) { dx = dx / d * mx; dy = dy / d * mx; } joy.x = dx / mx; joy.y = dy / mx; jK.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    jEl.addEventListener('touchstart', function (e) { e.preventDefault(); var t = e.changedTouches[0]; joy.id = t.identifier; jMove(t); }, { passive: false });
    jEl.addEventListener('touchmove', function (e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === joy.id) jMove(e.changedTouches[i]); }, { passive: false });
    var jEnd = function (e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; jK.style.transform = ''; } };
    jEl.addEventListener('touchend', jEnd); jEl.addEventListener('touchcancel', jEnd);
    var hold = function (id, down, up) { var b = $(id); b.addEventListener('touchstart', function (e) { e.preventDefault(); down(); }, { passive: false }); b.addEventListener('touchend', function (e) { e.preventDefault(); if (up) up(); }, { passive: false }); };
    hold('tAtk', function () { S.touchAtk = true; touchAim(); if (S.held === 'bow') primaryDown(); else { var h = S.held; if (h !== 'sword' && h !== 'kbstick' && h !== 'pick') S.held = 'sword', renderHotbar(), send({ t: 'sel', it: 'sword' }); primaryDown(); } mouse.l = true; }, function () { S.touchAtk = false; if (mouse.l) primaryUp(); mouse.l = false; });
    hold('tPlace', function () { S.touchPlace = true; }, function () { S.touchPlace = false; });
    hold('tUse', function () { var it = S.held; if (['fireball', 'tnt', 'gapple', 'pearl', 'egg', 'speed'].indexOf(it) < 0) { var hb = hotbarItems().filter(function (x) { return ['fireball', 'tnt', 'gapple', 'pearl', 'egg', 'speed'].indexOf(x) >= 0; }); if (!hb.length) { toast('No usable item — buy some at the shop!', 1600); return; } it = hb[0]; S.held = it; renderHotbar(); send({ t: 'sel', it: it }); } touchAim(); useHeld(); });
    cv.addEventListener('touchstart', function (e) {
      if (S.screen !== 'game') return;
      var t = e.changedTouches[0]; mouse.x = t.clientX; mouse.y = t.clientY; screenToWorld();
      var n = npcUnderCursor(); if (n && Math.hypot(n.x - P.x, n.y - P.y) < 3.4 * T) { openShop(n.kind); return; }
      S.touchTarget = { x: mouse.wx, y: mouse.wy, until: now() + 2500 };
      var ti = cursorTile(), mt = ti >= 0 && B.mineTarget(S.map, ti);
      if (mt && mt.kind !== 'floor') { S.touchMine = ti; mouse.l = true; } else if (B.canPlace(S.map, ti, [])) tryPlace(true);
    }, { passive: true });
    cv.addEventListener('touchend', function () { if (S.touchMine != null) { S.touchMine = null; mouse.l = false; } }, { passive: true });
  }
  function touchAim() {
    if (!P) return;
    var best = null, bd = 150;
    S.ents.forEach(function (e) { if (e.team === S.team || e.dead || e.elim) return; var d = Math.hypot(e.x - P.x, e.y - P.y); if (d < bd) { bd = d; best = e; } });
    if (best) P.ang = Math.atan2(best.y - P.y, best.x - P.x);
    else if (S.touchTarget && now() < S.touchTarget.until) P.ang = Math.atan2(S.touchTarget.y - (P.y - 16), S.touchTarget.x - P.x);
  }

  function hotbarItems() { return B.hotbar(Object.assign({}, S.inv, { pick: S.pick })); }
  function selectSlot(i) { var hb = hotbarItems(); if (i < 0 || i >= hb.length) return; if (S.held !== hb[i]) { S.held = hb[i]; send({ t: 'sel', it: S.held }); SC.sfx('click'); renderHotbar(); flashHeldName(); } }
  var heldNameT = 0;
  function flashHeldName() { var it = S.held, nm = it === 'sword' ? B.SWORDS[S.sword].name : it === 'pick' ? B.PICKS[S.pick].name : B.ITEM_NAMES[it]; var n = S.inv[it]; $('heldName').textContent = nm + (n > 1 && it !== 'bow' ? ' ×' + n : it === 'bow' ? ' · ' + (S.inv.arrows || 0) + ' arrows' : ''); $('heldName').style.opacity = 1; clearTimeout(heldNameT); heldNameT = setTimeout(function () { $('heldName').style.opacity = 0; }, 1600); }

  var swingCd = 0, mineSendT = 0, placeT = 0, lastPlaceTile = -1, bowStart = 0;
  function primaryDown() {
    if (!canAct()) return;
    var it = S.held;
    if (it === 'bow') { if (!(S.inv.arrows > 0)) { toast('No arrows!', 1200); SC.sfx('no'); return; } bowStart = now(); return; }
    if (B.BLOCK_OF[it]) { tryPlace(true); return; }
    if (['fireball', 'tnt', 'gapple', 'pearl', 'egg', 'speed'].indexOf(it) >= 0) { useHeld(); return; }
    doSwing(true);
  }
  function primaryUp() {
    if (S.held === 'bow' && bowStart && canAct()) {
      var pow = clamp((now() - bowStart) / 900, 0.15, 1); bowStart = 0;
      send({ t: 'bow', a: Math.round(P.ang * 100), p: Math.round(pow * 100) / 100 });
    }
    bowStart = 0;
  }
  function canAct() { return P && !P.dead && !P.falling && !S.dead && snow() >= S.goAt && S.screen === 'game' && $('shop').classList.contains('hidden'); }
  function doSwing(force) {
    var t = now(); if (t < swingCd) return;
    swingCd = t + (S.held === 'kbstick' ? 520 : 340);
    var me = S.ents.get(S.myId); if (!me) return;
    me.swingT = 0; me.swingDir = -(me.swingDir || 1);
    S.slashes.push({ x: P.x, y: P.y - 18, ang: P.ang, dir: me.swingDir, t0: t, reach: S.held === 'kbstick' ? 66 : 58, owner: S.myId, mine: true });
    SC.sfx('swing');
    send({ t: 'sw', a: Math.round(P.ang * 100) });
    void force;
  }
  function useHeld() {
    if (!canAct()) return;
    var it = S.held; if (!(S.inv[it] > 0)) return;
    var tx = mouse.wx, ty = mouse.wy;
    if (touch) { if (S.touchTarget && now() < S.touchTarget.until) { tx = S.touchTarget.x; ty = S.touchTarget.y; } else { tx = P.x + Math.cos(P.ang) * 220; ty = P.y + Math.sin(P.ang) * 220; } if (it === 'tnt') { tx = P.x + Math.cos(P.ang) * T; ty = P.y + Math.sin(P.ang) * T; } }
    send({ t: 'use', it: it, x: Math.round(tx), y: Math.round(ty) });
    if (it === 'fireball' || it === 'pearl' || it === 'egg') { var me = S.ents.get(S.myId); if (me) { me.swingT = 0; me.swingDir = 1; } }
  }
  function blockToPlace() { if (B.BLOCK_OF[S.held] && S.inv[S.held] > 0) return S.held; var o = ['wool', 'wood', 'end', 'obby']; for (var k = 0; k < o.length; k++) if (S.inv[o[k]] > 0) return o[k]; return null; }
  function aliveBodies() { var a = []; S.ents.forEach(function (e) { if (!e.dead && !e.elim) a.push(e.id === S.myId ? P : e); }); return a; }
  function tryPlace(click, onlyFloor, tile) {
    if (!canAct()) return false;
    var key = blockToPlace(); if (!key) { if (click && now() - (S.noBlkT || 0) > 1500) { S.noBlkT = now(); toast('No blocks! Buy wool at the Item Shop.', 1600); SC.sfx('no'); } return false; }
    var i = tile != null ? tile : touch && S.touchPlace ? frontTile() : cursorTile(); if (i < 0) return false;
    var cp = tcen(i); if (Math.hypot(cp.x - P.x, cp.y - P.y) > B.REACH) return false;
    var kind = B.canPlace(S.map, i, aliveBodies()); if (!kind || (onlyFloor && kind !== 'floor')) return false;
    var m = S.map, id = B.BLOCK_OF[key];
    if (kind === 'floor') { m.f[i] = id; m.fc[i] = S.team; } else { m.w[i] = id; m.wc[i] = S.team; }
    S.pending = S.pending || {}; S.pending[i] = now();
    S.placeAnim[i] = now(); S.inv[key]--; renderHotbar();
    D.burst('dust', cp.x, cp.y + 10, 3); SC.sfx('place');
    send({ t: 'pl', i: i, b: key });
    lastPlaceTile = i; placeT = now();
    var me = S.ents.get(S.myId); if (me) { me.swingT = 0.12; }
    return true;
  }
  function frontTile() { // tile in front of you (touch bridging): cardinal step in the aim/move direction
    var a = P.ang, dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a));
    if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) dy = 0; else dx = 0;
    var tx = Math.floor(P.x / T) + dx, ty = Math.floor(P.y / T) + dy;
    return B.inb(tx, ty) ? ty * W + tx : -1;
  }
  function walkFrontTile(ix, iy) { // the void tile you're walking into
    var dx = 0, dy = 0; if (Math.abs(ix) >= Math.abs(iy)) dx = ix > 0 ? 1 : -1; else dy = iy > 0 ? 1 : -1;
    var tx = Math.floor((P.x + dx * 22) / T), ty = Math.floor((P.y + dy * 22) / T);
    if (tx === Math.floor(P.x / T) && ty === Math.floor(P.y / T)) return -1;
    return B.inb(tx, ty) ? ty * W + tx : -1;
  }
  function screenToWorld() { mouse.wx = cam.x + (mouse.x - innerWidth / 2) / cam.z; mouse.wy = cam.y + (mouse.y - innerHeight / 2) / cam.z; }
  function cursorTile() {
    var m = S.map, x = mouse.wx, y = mouse.wy;
    var tx = Math.floor(x / T), ty2 = Math.floor((y + D.WALLH) / T);
    if (B.inb(tx, ty2) && m.w[ty2 * W + tx]) return ty2 * W + tx;
    var ty = Math.floor(y / T); if (!B.inb(tx, ty)) return -1;
    return ty * W + tx;
  }
  function nearNpc() { if (!P || P.dead) return null; var best = null; S.map.npcs.forEach(function (n) { if (Math.hypot(n.x - P.x, n.y - P.y) < 3 * T) best = n; }); return best; }
  function npcUnderCursor() { var hit = null; if (!S.map) return null; S.map.npcs.forEach(function (n) { if (Math.abs(mouse.wx - n.x) < 24 && mouse.wy < n.y + 8 && mouse.wy > n.y - 60) hit = n; }); return hit; }

  // ------------------------------------------------------------------ local update
  var trails = [];
  function update(dt, t) {
    if (S.screen === 'game' || S.screen === 'end') screenToWorld();
    if (S.demo) { demoTick(dt, t); return; }
    if (!P) return;
    var me = S.ents.get(S.myId);
    var locked = snow() < S.goAt || S.screen !== 'game';
    if (!P.dead && !S.dead && !P.falling && !locked) {
      var ix = 0, iy = 0;
      if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1; if (keys.w || keys.arrowup) iy -= 1; if (keys.s || keys.arrowdown) iy += 1;
      if (touch && (joy.x || joy.y)) { ix = joy.x; iy = joy.y; }
      var il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
      if (!$('shop').classList.contains('hidden')) { ix = iy = 0; }
      var sp = B.SPEED * (now() < S.speedUntil ? 1.35 : 1) * (now() < S.slowUntil ? 0.55 : 1) * (bowStart ? 0.6 : 1);
      var kbOn = Math.hypot(P.vx, P.vy) > 60;
      B.move(S.map, P, ix * sp * dt + P.vx * dt, iy * sp * dt + P.vy * dt, !kbOn);
      var kd = Math.exp(-6.5 * dt); P.vx *= kd; P.vy *= kd; if (Math.hypot(P.vx, P.vy) < 4) P.vx = P.vy = 0;
      P.mv = il > 0.1;
      // aim
      if (touch) { if (il > 0.2 && !S.touchAtk) P.ang = Math.atan2(iy, ix); if (S.touchAtk) touchAim(); }
      else P.ang = Math.atan2(mouse.wy - (P.y - 16), mouse.wx - P.x);
      // fell?
      if (!B.groundUnder(S.map, P.x, P.y)) { P.falling = now(); P.fallX = P.x; P.fallY = P.y; SC.sfx('fall'); }
      // held actions
      if (mouse.l && canAct()) {
        var it = S.held;
        if (it === 'sword' || it === 'kbstick' || it === 'pick') {
          var ti = S.touchMine != null ? S.touchMine : cursorTile(), mt = ti >= 0 ? B.mineTarget(S.map, ti) : null;
          if (mt && mt.kind === 'floor' && it !== 'pick') mt = null;
          if (mt && mt.kind === 'bed') { var bd = B.bedAt(S.map, ti); if (bd && bd.team === S.team) mt = null; }
          var cp = ti >= 0 ? tcen(ti) : null;
          if (mt && cp && Math.hypot(cp.x - P.x, cp.y - P.y) <= B.REACH) {
            if (now() > mineSendT) { mineSendT = now() + 100; send({ t: 'mine', i: ti }); }
            S.mining = ti; if (touch) P.ang = Math.atan2(cp.y - P.y, cp.x - P.x);
            if (it !== 'pick') doSwing();
          } else { S.mining = -1; if (it !== 'pick' || !mt) doSwing(); }
        }
      } else S.mining = -1;
      // Placing: hold right click (or left with a block, or the touch button) and walk to bridge.
      var placing = mouse.r || (mouse.l && B.BLOCK_OF[S.held]) || (touch && S.touchPlace);
      if (placing && now() - placeT > 95) {
        var placed = false;
        if (il > 0.2) { var ft = walkFrontTile(ix, iy); if (ft >= 0 && B.canPlace(S.map, ft, []) === 'floor') placed = tryPlace(false, true, ft); }
        if (!placed && !touch) { var ct = cursorTile(); if (ct !== lastPlaceTile) tryPlace(false, il > 0.2, ct); }
        if (!placed && touch && S.touchPlace && now() - placeT > 220) tryPlace(false, false, frontTile());
      }
      // footsteps
      if (P.mv && t - (P.stepT || 0) > 0.24) { P.stepT = t; D.burst('dust', P.x, P.y, 1); if (me && me.look && me.look.trail) A.spawnTrail(trails, me.look.trail, P.x, P.y, t); }
    }
    if (P.falling && now() - P.falling > 1200 && !S.dead) { /* waiting for the server's death */ }
    // send state 20 Hz
    if (wsOpen && !locked && now() - P.lastSend > 50 && !P.dead) {
      P.lastSend = now();
      send({ t: 'mv', x: Math.round(P.x * 10) / 10, y: Math.round(P.y * 10) / 10, a: Math.round(P.ang * 100), m: P.mv ? 1 : 0, b: bowStart ? 1 : 0 });
    }
    if (me) { me.x = P.x; me.y = P.y; me.ang = P.ang; me.held = S.held; me.bowing = !!bowStart; me.bowT = bowStart ? (now() - bowStart) / 900 : 0; me.mining = S.mining >= 0 && S.held === 'pick'; me.moving = P.mv; if (P.mv) me.walk += dt * 10; }
    // remote interpolation
    var rt = snow() - 110;
    S.ents.forEach(function (e) {
      if (e.id === S.myId) return;
      var b = e.buf; if (!b.length) return;
      var a = b[0], z = b[b.length - 1];
      if (rt >= z[0]) { a = z; }
      else for (var k = b.length - 2; k >= 0; k--) if (b[k][0] <= rt) { a = b[k]; z = b[k + 1]; break; }
      var u = a === z ? 0 : clamp((rt - a[0]) / (z[0] - a[0]), 0, 1);
      var nx = a[1] + (z[1] - a[1]) * u, ny = a[2] + (z[2] - a[2]) * u;
      var moved = Math.hypot(nx - e.x, ny - e.y);
      e.moving = moved > 0.4; if (e.moving) e.walk += dt * 10;
      if (moved > 160) { e.x = nx; e.y = ny; } else { e.x = nx; e.y = ny; }
      var da = z[3] - e.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; e.ang += da * Math.min(1, dt * 18);
      if (e.moving && !e.dead && t - (e.lastStep || 0) > 0.26) { e.lastStep = t; D.burst('dust', e.x, e.y, 1); if (e.look && e.look.trail) A.spawnTrail(trails, e.look.trail, e.x, e.y, t); }
    });
    S.ents.forEach(function (e) { if (e.swingT != null) { e.swingT += dt; if (e.swingT > 0.45) e.swingT = null; } });
    // projectile smoothing + trails
    S.projs.forEach(function (p) {
      p.x += (p.tx - p.x) * Math.min(1, dt * 20); p.y += (p.ty - p.y) * Math.min(1, dt * 20);
      if (p.kind === 'fb' && Math.random() < 0.8) D.burst('fire', p.x, p.y, 1, null, { speed: 20 });
      if (p.kind === 'pearl' && Math.random() < 0.5) D.burst('magic', p.x, p.y, 1, '#2ec4b6');
    });
    // listener / camera
    var target = P;
    if (S.dead || S.elim) {
      if (S.elim) { var sp2 = S.ents.get(S.specId); if (!sp2 || sp2.dead || sp2.elim) { sp2 = null; S.ents.forEach(function (e) { if (!sp2 && !e.dead && !e.elim && e.team === S.team) sp2 = e; }); S.ents.forEach(function (e) { if (!sp2 && !e.dead && !e.elim) sp2 = e; }); S.specId = sp2 ? sp2.id : 0; } if (sp2) target = sp2; }
    }
    listener.x = target.x; listener.y = target.y;
    var lead = { x: 0, y: 0 };
    if (!touch && target === P && S.screen === 'game') { lead.x = clamp((mouse.wx - P.x) * 0.14, -120, 120); lead.y = clamp((mouse.wy - P.y) * 0.14, -90, 90); }
    var k2 = 1 - Math.exp(-(snow() < S.goAt ? 1.6 : 7) * dt);
    if (snow() < S.goAt && snow() < S.goAt - 2600) k2 = 0.004;
    cam.x += (target.x + lead.x - cam.x) * k2; cam.y += (target.y - 20 + lead.y - cam.y) * k2;
    // HUD timers
    hudTick();
  }

  // ------------------------------------------------------------------ render
  var dpr = 1;
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); }
  addEventListener('resize', resize); resize();
  function zoomFor() {
    var z = Math.min(innerWidth / 1060, innerHeight / 700);
    if (S.demo) z = Math.min(innerWidth / 1300, innerHeight / 860);
    if (!S.demo && snow() < S.goAt - 2600) z *= 0.55;
    else if (!S.demo && snow() < S.goAt) z *= 0.55 + 0.45 * D.ease.out(1 - (S.goAt - snow()) / 2600);
    return clamp(z, touch ? 0.58 : 0.62, 1.3);
  }
  var lastT = now(), T0 = now();
  function frame() {
    var tn = now(), dt = Math.min(0.05, (tn - lastT) / 1000); lastT = tn;
    var t = (tn - T0) / 1000;
    try { update(dt, t); render(dt, t); } catch (err) { console.error(err); }
    if (S.screen === 'menu') drawMePreview(t);
    if (S.screen === 'lobby') { drawLobbyAvatars(t); updateCount(); }
    if (S.screen === 'end') drawPodium(t, dt);
    requestAnimationFrame(frame);
  }
  function render(dt, t) {
    var map = S.map; if (!map) { c.fillStyle = '#120c33'; c.fillRect(0, 0, cv.width, cv.height); return; }
    if (S.demo) { cam.x = 36 * T + Math.cos(t * 0.045) * 760; cam.y = 36 * T + Math.sin(t * 0.045) * 560; }
    cam.z += (zoomFor() - cam.z) * Math.min(1, dt * 4);
    var z = cam.z, vw = innerWidth / z, vh = innerHeight / z;
    var sh = S.shake; S.shake *= Math.exp(-9 * dt); if (S.shake < 0.2) S.shake = 0;
    var sx = (Math.random() - 0.5) * sh * 2, sy = (Math.random() - 0.5) * sh * 2;
    var L = cam.x - vw / 2 + sx, Tp = cam.y - vh / 2 + sy;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    D.sky(c, innerWidth, innerHeight, cam.x, cam.y, t, z);
    D.clouds(c, innerWidth, innerHeight, cam.x, cam.y, t, z);
    c.setTransform(dpr * z, 0, 0, dpr * z, -L * dpr * z, -Tp * dpr * z);
    // ground chunks
    var CS = D.CH * T;
    for (var cy = Math.floor((Tp - 140) / CS); cy <= Math.floor((Tp + vh) / CS); cy++) for (var cx = Math.floor(L / CS); cx <= Math.floor((L + vw) / CS); cx++) {
      if (cx < 0 || cy < 0 || cx * D.CH >= W || cy * D.CH >= H) continue;
      var ch = D.chunk(map, cx, cy); if (ch) c.drawImage(ch, cx * CS, cy * CS);
    }
    var tx0 = Math.max(0, Math.floor(L / T) - 1), tx1 = Math.min(W - 1, Math.ceil((L + vw) / T) + 1), ty0 = Math.max(0, Math.floor(Tp / T) - 1), ty1 = Math.min(H - 1, Math.ceil((Tp + vh) / T) + 2);
    var tnow = now(), x, y, i;
    // spawn-pad / bed glow for my team
    // floor blocks (bridges)
    for (y = ty0; y <= ty1; y++) for (x = tx0; x <= tx1; x++) {
      i = y * W + x; if (!map.f[i]) continue;
      var below = y + 1 < H ? (y + 1) * W + x : -1;
      var southVoid = below >= 0 && !map.g[below] && !map.f[below];
      var pa = S.placeAnim[i], sc = pa ? D.ease.back(Math.min(1, (tnow - pa) / 180)) : 1; if (pa && tnow - pa > 200) delete S.placeAnim[i];
      D.floorBlock(c, map.f[i], map.fc[i], x * T, y * T, southVoid, map.w[i] ? 1 : sc);
    }
    // under-layer particles (debris on the floor)
    D.drawParts(c, dt, 0); D.drawParts(c, dt, 1);
    A.drawParticles(c, trails, dt);
    // sorted drawables
    var list = [];
    for (y = ty0; y <= ty1; y++) for (x = tx0; x <= tx1; x++) { i = y * W + x; if (map.w[i]) list.push({ k: 'w', y: (y + 1) * T, i: i, x: x, ty: y }); else if (map.g[i] === B.G.ROCK) list.push({ k: 'rock', y: (y + 1) * T - 1, x: x * T + T / 2, by: (y + 1) * T - 4 }); }
    map.beds.forEach(function (b) { if (b.alive && b.x > L - 80 && b.x < L + vw + 80 && b.y > Tp - 80 && b.y < Tp + vh + 80) list.push({ k: 'bed', y: b.y + (b.dir[1] ? T * 0.5 : T * 0.2), b: b }); });
    S.gens.forEach(function (g, gi) { var gg = g.g; if (gg.x > L - 120 && gg.x < L + vw + 120 && gg.y > Tp - 140 && gg.y < Tp + vh + 80) list.push({ k: 'gen', y: gg.y + (gg.kind === 'iron' || gg.kind === 'gold' ? 12 : 10), g: g, gi: gi }); });
    map.npcs.forEach(function (n) { if (n.x > L - 80 && n.x < L + vw + 80 && n.y > Tp - 120 && n.y < Tp + vh + 80) list.push({ k: 'npc', y: n.y + 2, n: n }); });
    map.bases.forEach(function (b) { [b.flag, b.flag2].forEach(function (f) { var fx = f[0] * T + T / 2, fy = f[1] * T + T / 2; if (fx > L - 80 && fx < L + vw + 80 && fy > Tp - 120 && fy < Tp + vh + 60) list.push({ k: 'flag', y: fy, x: fx, team: b.team }); }); });
    S.tnts.forEach(function (tn) { list.push({ k: 'tnt', y: tn.y + 14, tn: tn }); });
    var ents = S.demo ? demo : Array.from(S.ents.values());
    ents.forEach(function (e) { if (e.x > L - 80 && e.x < L + vw + 80 && e.y > Tp - 120 && e.y < Tp + vh + 120) list.push({ k: 'ent', y: e.y, e: e }); });
    list.sort(function (a, b) { return a.y - b.y; });
    var near = !S.demo && nearNpc();
    for (var q = 0; q < list.length; q++) {
      var d = list[q];
      if (d.k === 'w') { var pa2 = S.placeAnim[d.i], sc2 = pa2 ? D.ease.back(Math.min(1, (tnow - pa2) / 180)) : 1; D.wallBlock(c, map.w[d.i], map.wc[d.i], d.x * T, d.ty * T, sc2); if (S.cracks[d.i] != null) D.cracks(c, d.x * T, d.ty * T, S.cracks[d.i], D.WALLH); }
      else if (d.k === 'rock') D.rock(c, d.x, d.by, t);
      else if (d.k === 'bed') { D.bed(c, d.b, t, !S.demo && d.b.team === S.team); [d.b.foot, d.b.head].forEach(function (bi) { if (S.cracks[bi] != null) D.cracks(c, (bi % W) * T, ((bi / W) | 0) * T, S.cracks[bi], 0); }); }
      else if (d.k === 'gen') { D.gen(c, d.g.g, d.g.n, t, genInfo(d.g)); }
      else if (d.k === 'npc') D.npc(c, d.n, t, near === d.n);
      else if (d.k === 'flag') D.flag(c, d.x, d.y, d.team, t);
      else if (d.k === 'tnt') D.tnt(c, d.tn.x, d.tn.y, (d.tn.at - snow()) / 1000, t);
      else if (d.k === 'ent') drawEnt(d.e, t);
    }
    // floor cracks (bridge blocks)
    for (var ck in S.cracks) { ck = +ck; if (!map.w[ck] && map.f[ck] && map.obj[ck] !== 1) D.cracks(c, (ck % W) * T, ((ck / W) | 0) * T, S.cracks[ck], 0); }
    // target highlight
    if (!S.demo && S.screen === 'game' && P && !P.dead && !touch) drawTarget(t);
    // projectiles, slashes, top particles
    S.projs.forEach(function (p) { D.projectile(c, { kind: p.kind, x: p.x, y: p.y, vx: p.vx || 1, vy: p.vy }, t); });
    for (var s2 = S.slashes.length - 1; s2 >= 0; s2--) { var fx = S.slashes[s2]; if (fx.owner === S.myId && P) { fx.x = P.x; fx.y = P.y - 18; } else if (fx.owner) { var oe = S.ents.get(fx.owner); if (oe) { fx.x = oe.x; fx.y = oe.y - 18; } } if (!D.slash(c, fx, tnow)) S.slashes.splice(s2, 1); }
    drawFly(dt);
    D.drawParts(c, dt, 2);
    drawSpecial(dt);
    // name tags
    ents.forEach(function (e) { if (e.x > L - 80 && e.x < L + vw + 80 && e.y > Tp - 120 && e.y < Tp + vh + 120) drawTag(e, t); });
    // screen fx
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!S.demo && S.screen === 'game') {
      var hurt = Math.max(0, 1 - (tnow - S.hurtT) / 450), low = S.hp <= 6 && !S.dead ? (0.35 + Math.sin(t * 6) * 0.15) : 0;
      $('vign').style.opacity = Math.max(hurt, low);
    } else $('vign').style.opacity = 0;
    drawCrosshairState();
  }
  function genInfo(g) {
    var gg = g.g; if (gg.team != null) return null;
    var every = g.every || B.GEN[gg.kind].every[S.tier[gg.kind]];
    var left = Math.max(0, every - (snow() - g.last) / 1000);
    if (snow() < S.goAt) left = every;
    var tier = ['I', 'II', 'III'][S.tier[gg.kind]];
    return { title: (gg.kind === 'dia' ? 'Diamond ' : 'Emerald ') + tier, sub: g.n >= B.GEN[gg.kind].cap ? 'FULL' : 'Next in ' + Math.ceil(left) + 's' };
  }
  function drawEnt(e, t) {
    var tn = now(), x = e.x, y = e.y, sc = 1, rot = 0, alpha = 1;
    if (e.id === S.myId && P) { x = P.x; y = P.y; }
    var dead = e.dead || e.elim || (e.id === S.myId && (P.dead || S.dead));
    var falling = e.fallT && tn - e.fallT < 1100 ? (tn - e.fallT) / 1100 : (e.id === S.myId && P && P.falling && !S.dead ? Math.min(1, (tn - P.falling) / 1100) : -1);
    if (falling >= 0) { if (e.fallX != null && e.id !== S.myId) { x = e.fallX; y = e.fallY; } else if (e.id === S.myId && P.fallX != null) { x = P.fallX; y = P.fallY; } sc = Math.max(0.05, 1 - falling * 0.95); rot = falling * 5; alpha = 1 - falling * 0.6; y += falling * 40; if (Math.random() < 0.4) D.burst('magic', x, y - 10, 1, '#3b2a8a'); }
    else if (dead) return;
    var ang = e.ang || 0, ca = Math.cos(ang), sa = Math.sin(ang);
    var dir = Math.abs(ca) > Math.abs(sa) * 0.9 ? (ca > 0 ? 2 : 1) : (sa > 0 ? 0 : 3);
    var team = e.team, f = e.flags || 0;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(sc, sc); c.globalAlpha = alpha;
    // team ring under feet
    c.strokeStyle = teamCol(team); c.globalAlpha = alpha * 0.85; c.lineWidth = 3; A.ell(c, 0, 0, 19, 7); c.stroke(); c.globalAlpha = alpha;
    if (f & 32) { c.strokeStyle = 'rgba(125,211,252,.6)'; c.lineWidth = 2; for (var k = 0; k < 3; k++) { c.beginPath(); var ly = -10 - k * 9; c.moveTo(-ca * 26 - 6, ly); c.lineTo(-ca * 40 - 6, ly); c.stroke(); } }
    var behind = sa < -0.35;
    var ee = { team: team, ang: ang, held: e.held, sword: e.sword, pick: e.pick, armor: e.armor, swingT: e.swingT, swingDir: e.swingDir, mining: e.mining, bowing: e.bowing, bowT: e.bowT, dead: false };
    if (behind) D.held(c, ee, 0, 0, t);
    var o = { t: t + e.id, dir: dir, moving: e.moving, walk: e.walk, lookAt: { x: ca, y: sa }, scale: 1 };
    var fl = Math.max(0, 1 - (tn - (e.flashT || -1e9)) / 160);
    if (fl > 0) D.gimFlash(c, 0, 0, e.look, o, 0.85 * fl); else A.drawGim(c, 0, 0, e.look, o);
    var bob = e.moving ? -Math.abs(Math.sin(e.walk || 0)) * 3.5 : Math.sin((t + e.id) * 2.2) * 0.8;
    if (dir !== 3) D.armor(c, ee, 0, 0, t, bob); else D.armor(c, ee, 0, 0, t, bob);
    if (!behind) D.held(c, ee, 0, 0, t);
    if (f & 64) { var pu = (Math.sin(t * 8) + 1) / 2; c.strokeStyle = 'rgba(180,230,255,' + (0.4 + pu * 0.4) + ')'; c.lineWidth = 3; A.circ(c, 0, -22, 30); c.stroke(); c.fillStyle = 'rgba(180,230,255,.12)'; c.fill(); }
    if ((f & 16) && Math.random() < 0.08) D.burst('heart', x, y - 40, 1);
    c.restore();
  }
  function drawTag(e, t) {
    if (S.demo) return;
    var dead = e.dead || e.elim; if (dead) return;
    var x = e.x, y = e.y; if (e.id === S.myId && P) { if (P.falling) return; x = P.x; y = P.y; }
    var mine = e.id === S.myId;
    if (!mine) {
      var tag = (e.bot ? '🤖 ' : '') + e.nick + (e.dc ? ' (AFK)' : '');
      D.tag(c, tag, x, y - 72, { size: 12, color: teamCol(e.team) });
      var hp = clamp(e.hp / 20, 0, 1);
      A.rr(c, x - 18, y - 62, 36, 6, 3); c.fillStyle = 'rgba(15,10,40,.85)'; c.fill();
      A.rr(c, x - 17, y - 61, 34 * hp, 4, 2); c.fillStyle = hp > 0.5 ? '#2bd576' : hp > 0.25 ? '#ffd166' : '#ff5c6c'; c.fill();
    }
    if (e.bubble && now() - e.bubble.t < 3000) {
      var a = Math.min(1, (3000 - (now() - e.bubble.t)) / 300);
      c.save(); c.globalAlpha = a; c.font = '700 13px Fredoka, sans-serif';
      var w = c.measureText(e.bubble.text).width + 18, by = y - (mine ? 76 : 96);
      A.rr(c, x - w / 2, by - 13, w, 24, 10); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#1b1636'; c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.moveTo(x - 5, by + 11); c.lineTo(x, by + 17); c.lineTo(x + 5, by + 11); c.fillStyle = '#fff'; c.fill();
      c.fillStyle = '#1b1636'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e.bubble.text, x, by);
      c.restore();
    }
  }
  function drawTarget(t) {
    var it = S.held, ti = cursorTile(); if (ti < 0) return;
    var cp = tcen(ti), inR = Math.hypot(cp.x - P.x, cp.y - P.y) <= B.REACH;
    var m = S.map, x = (ti % W) * T, y = ((ti / W) | 0) * T;
    if (B.BLOCK_OF[it] || mouse.r) {
      var k = B.canPlace(m, ti, aliveBodies());
      if (k) D.tileCursor(c, x, y, k === 'wall' ? 'wall' : 'floor', inR, t);
    } else if (it === 'sword' || it === 'kbstick' || it === 'pick') {
      var mt = B.mineTarget(m, ti);
      if (mt && (mt.kind !== 'floor' || it === 'pick')) {
        if (mt.kind === 'bed') { var bd = B.bedAt(m, ti); if (bd && bd.team === S.team) return; }
        D.tileCursor(c, x, y, mt.kind === 'wall' ? 'wall' : 'floor', inR, t);
      }
    } else if (it === 'tnt') D.tileCursor(c, x, y, 'floor', inR && B.floorAt(m, ti % W, (ti / W) | 0), t);
    else if (it === 'fireball' || it === 'pearl' || it === 'egg' || it === 'bow') {
      c.save(); c.setLineDash([6, 8]); c.lineDashOffset = -t * 30; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(P.x, P.y - 16); var dd = Math.min(it === 'pearl' ? 12 * T : 9 * T, Math.hypot(mouse.wx - P.x, mouse.wy - P.y + 16)); c.lineTo(P.x + Math.cos(P.ang) * dd, P.y - 16 + Math.sin(P.ang) * dd); c.stroke(); c.restore();
    }
  }
  // resource items flying into a player's hands
  function drawFly(dt) {
    var Pt = D.parts;
    for (var i = 0; i < Pt.length; i++) {
      var p = Pt[i]; if (p.k !== 'fly') continue;
      var e = S.ents.get(p.to); var tx = e ? (e.id === S.myId && P ? P.x : e.x) : p.sx, ty = e ? (e.id === S.myId && P ? P.y : e.y) - 20 : p.sy;
      var u = clamp(p.age / p.life, 0, 1), ue = D.ease.inq(u);
      var x = p.x + (tx - p.x) * ue, y = p.y + (ty - p.y) * ue - Math.sin(u * Math.PI) * 30;
      D.res(c, p.res, x, y, 0.8 * (1 - u * 0.4));
    }
  }
  function drawSpecial(dt) {
    var Pt = D.parts;
    for (var i = 0; i < Pt.length; i++) {
      var p = Pt[i], u = p.age / p.life;
      if (p.k === 'beam') {
        c.save(); c.globalCompositeOperation = 'lighter';
        var a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, w = 26 * (1 - u * 0.5);
        var g = c.createLinearGradient(p.x, p.y - 260, p.x, p.y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,' + 0.55 * a + ')');
        c.fillStyle = g; c.fillRect(p.x - w / 2, p.y - 260, w, 262); c.restore();
      } else if (p.k === 'soul') {
        c.save(); c.globalAlpha = 1 - u; c.translate(p.x + Math.sin(u * 9) * 6, p.y - u * 70);
        c.fillStyle = 'rgba(230,240,255,.9)'; A.circ(c, 0, 0, 9); c.fill(); c.fillRect(-9, 0, 18, 10);
        c.fillStyle = '#1b1636'; A.circ(c, -3.5, -1, 1.8); c.fill(); A.circ(c, 3.5, -1, 1.8); c.fill();
        c.restore();
      }
    }
  }

  // ------------------------------------------------------------------ HUD
  var heartImgs = {};
  function makeHearts() {
    function heart(fill, half) {
      var cv2 = document.createElement('canvas'); cv2.width = cv2.height = 42; var x = cv2.getContext('2d');
      x.translate(21, 22); x.scale(1.6, 1.6);
      function path() { x.beginPath(); x.moveTo(0, 9); x.bezierCurveTo(-13, 0, -9, -11, 0, -4.5); x.bezierCurveTo(9, -11, 13, 0, 0, 9); x.closePath(); }
      path(); x.fillStyle = '#3a2e66'; x.fill();
      if (fill) { x.save(); path(); x.clip(); x.fillStyle = fill; x.fillRect(-14, -14, half ? 14 : 28, 28); x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(-7, -6, 4, 4); x.restore(); }
      path(); x.strokeStyle = '#1b1636'; x.lineWidth = 2.2; x.stroke();
      return cv2.toDataURL();
    }
    heartImgs = { full: heart('#ff4b5c'), half: heart('#ff4b5c', true), empty: heart(null), gold: heart('#ffcf3f'), goldh: heart('#ffcf3f', true) };
  }
  function makeCrosshair() {
    var ch = $('crosshair'), x = ch.getContext('2d'); x.clearRect(0, 0, 60, 60); x.translate(30, 30);
    x.strokeStyle = '#1b1636'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.stroke();
    x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, 2.2, 0, TAU); x.fill();
    [[0, -16, 0, -21], [0, 16, 0, 21], [-16, 0, -21, 0], [16, 0, 21, 0]].forEach(function (l) { x.strokeStyle = '#1b1636'; x.lineWidth = 5; x.beginPath(); x.moveTo(l[0], l[1]); x.lineTo(l[2], l[3]); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.stroke(); });
    ch.style.width = '30px'; ch.style.height = '30px';
  }
  var chState = '';
  function drawCrosshairState() {
    if (S.screen !== 'game' || touch || !P) return;
    var st = '';
    S.ents.forEach(function (e) { if (!st && e.team !== S.team && !e.dead && Math.hypot(e.x - mouse.wx, e.y - 20 - mouse.wy) < 26 && Math.hypot(e.x - P.x, e.y - P.y) < B.MELEE + 10) st = 'enemy'; });
    if (st !== chState) { chState = st; $('crosshair').style.filter = st === 'enemy' ? 'drop-shadow(0 0 0 #ff5c6c) sepia(1) saturate(8) hue-rotate(-30deg)' : ''; $('crosshair').style.transform = st === 'enemy' ? 'scale(1.2)' : ''; }
  }
  function buildHud() { $('topBtns').innerHTML = ''; $('feed').innerHTML = ''; $('banner').innerHTML = ''; }
  function renderTeams() {
    var html = '';
    for (var t = 0; t < 4; t++) {
      var tm = S.teams[t] || { bed: true, alive: 0, total: 0 }, me = t === S.team;
      html += '<div class="trow' + (me ? ' me' : '') + (tm.elim ? ' dead' : '') + '"><div class="sq" style="background:' + teamCol(t) + '">' + tname(t)[0] + '</div><span class="tn">' + tname(t) + (me ? ' <span style="color:var(--gold);font-size:11px">YOU</span>' : '') + '</span><span class="bed">' + (tm.elim ? '💀' : tm.bed ? '🛏️' : '❌') + '</span><span class="al">' + (tm.alive != null ? tm.alive : '') + '</span></div>';
    }
    $('teamsP').innerHTML = html;
  }
  function updateHearts() {
    var hp = Math.max(0, S.hp), ab = Math.max(0, S.absorb || 0), h = '';
    for (var k = 0; k < 10; k++) { var v = hp - k * 2; h += '<img src="' + (v >= 2 ? heartImgs.full : v >= 1 ? heartImgs.half : heartImgs.empty) + '">'; }
    for (k = 0; k < Math.ceil(ab / 2); k++) h += '<img src="' + (ab - k * 2 >= 2 ? heartImgs.gold : heartImgs.goldh) + '">';
    $('hearts').innerHTML = h; $('hearts').classList.toggle('low', hp <= 6 && hp > 0);
    var ar = B.ARMORS[S.armor] || B.ARMORS[1];
    $('armorChip').innerHTML = '<img src="' + D.iconURL('armor' + S.armor, S.team, S.armor, 48) + '">' + ar.name.replace(' Armor', '');
  }
  function renderHotbar() {
    var hb = hotbarItems();
    if (hb.indexOf(S.held) < 0) S.held = 'sword';
    $('hotbar').innerHTML = hb.map(function (it, i) {
      var icon = it === 'sword' ? 'sword' + S.sword : it === 'pick' ? 'pick' + Math.max(1, S.pick) : it;
      var n = it === 'bow' ? (S.inv.arrows || 0) : (it === 'sword' || it === 'pick' || it === 'kbstick') ? '' : (S.inv[it] || 0);
      return '<div class="hs' + (it === S.held ? ' on' : '') + '" data-i="' + i + '"><span class="k">' + (i + 1) + '</span><img src="' + D.iconURL(icon, S.team, it === 'sword' ? S.sword : it === 'pick' ? S.pick : 1, 64) + '"><span class="n">' + (n === '' ? '' : n) + '</span></div>';
    }).join('');
  }
  $('hotbar').addEventListener('click', function (e) { var s = e.target.closest('.hs'); if (s) selectSlot(+s.dataset.i); });
  $('hotbar').addEventListener('touchstart', function (e) { var s = e.target.closest('.hs'); if (s) { e.preventDefault(); selectSlot(+s.dataset.i); } }, { passive: false });
  function renderRes(force, old) {
    var html = '';
    B.RES.forEach(function (r) { html += '<div class="res' + ((S.res[r] || 0) ? '' : ' zero') + '" data-r="' + r + '"><img src="' + D.iconURL(r, 0, 0, 52) + '"><span>' + (S.res[r] || 0) + '</span></div>'; });
    $('resP').innerHTML = html;
    if (old) B.RES.forEach(function (r) { if ((S.res[r] || 0) > (old[r] || 0)) { var el = document.querySelector('.res[data-r="' + r + '"]'); if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } } });
  }
  var lastTimerS = -1;
  function hudTick() {
    if (S.screen !== 'game' && S.screen !== 'end') return;
    var el = Math.max(0, (snow() - S.goAt) / 1000), s = Math.floor(el);
    if (s !== lastTimerS) {
      lastTimerS = s;
      $('tmT').textContent = B.fmtTime(el);
      var nx = B.TIMELINE[S.tl]; $('tmN').textContent = nx ? (nx.ev === 'end' ? 'Game ends' : nx.ev === 'beds' ? 'Beds break' : nx.ev.indexOf('dia') === 0 ? 'Diamond ' + (nx.ev === 'dia2' ? 'II' : 'III') : 'Emerald ' + (nx.ev === 'em2' ? 'II' : 'III')) + ' in ' + B.fmtTime(nx.t - el) : '';
      if (S.dead && !S.elim) { var left = Math.max(0, Math.ceil((S.respawnAt - now()) / 1000)); var cd = $('deathCd'); if (cd && cd.textContent !== String(left)) { cd.textContent = left || '…'; if (left > 0) SC.sfx('tick'); } }
    }
    var n = nearNpc(); var pr = $('prompt');
    if (n && $('shop').classList.contains('hidden') && !S.dead) { pr.classList.remove('hidden'); pr.textContent = (touch ? 'Tap the ' : 'Press E · ') + (n.kind === 'shop' ? 'Item Shop' : 'Team Upgrades'); } else pr.classList.add('hidden');
    if (S.screen === 'game' && now() - (S.miniAt || 0) > 200) { S.miniAt = now(); drawMini(); }
  }
  function feed(html, final) {
    var d = document.createElement('div'); d.className = 'kf' + (final ? ' final' : ''); d.innerHTML = html;
    var f = $('feed'); f.appendChild(d); while (f.children.length > 6) f.firstChild.remove();
    setTimeout(function () { d.classList.add('out'); setTimeout(function () { d.remove(); }, 450); }, 6500);
  }
  var bannerT = 0;
  function banner(big, small, col) {
    var b = $('banner'); b.innerHTML = '<div class="big" style="color:' + (col || '#fff') + '">' + big + '</div>' + (small ? '<div class="small">' + small + '</div>' : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); b.style.opacity = 1;
    clearTimeout(bannerT); bannerT = setTimeout(function () { b.style.transition = 'opacity .5s'; b.style.opacity = 0; setTimeout(function () { b.style.transition = ''; }, 600); }, 3200);
  }
  function toastBig(text, col) {
    var d = document.createElement('div'); d.style.cssText = 'position:fixed;left:50%;top:36%;transform:translateX(-50%);z-index:15;font-size:30px;font-weight:700;-webkit-text-stroke:6px #120e2e;paint-order:stroke fill;color:' + col + ';pointer-events:none;animation:bannerIn .4s cubic-bezier(.2,1.5,.4,1);transition:opacity .4s,transform .4s';
    d.textContent = text; document.body.appendChild(d);
    setTimeout(function () { d.style.opacity = 0; d.style.transform = 'translateX(-50%) translateY(-30px)'; setTimeout(function () { d.remove(); }, 450); }, 1100);
  }
  var toastT = 0;
  function toast(text, ms, html) { var el = $('toast'); if (html) el.innerHTML = text; else el.textContent = text; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, ms || 1800); }
  function showDeath(killer, final, kind) {
    var d = $('death'); d.classList.remove('hidden');
    if (final) {
      d.innerHTML = '<div class="big">ELIMINATED</div><div class="sub">' + (killer ? 'Final kill by <span style="color:' + teamCol(killer.team) + '">' + esc(killer.nick) + '</span>' : 'Your bed was gone — no more respawns') + '</div><div class="sub" style="font-size:15px;color:#cfc8ff">You’re spectating. Stick around or jump into a new game.</div><div class="flex"><button class="btn green" id="dAgain">▶ New game</button><button class="btn" id="dSpec">👀 Keep watching</button></div>';
      $('dAgain').onclick = playAgain; $('dSpec').onclick = function () { d.classList.add('hidden'); };
    } else {
      d.innerHTML = '<div class="big">YOU DIED!</div><div class="sub">' + (killer ? (kind === 'void' ? 'Knocked into the void by ' : 'Killed by ') + '<span style="color:' + teamCol(killer.team) + '">' + esc(killer.nick) + '</span>' : kind === 'void' ? 'You fell into the void' : '') + '</div><div class="sub" style="margin:0">Respawning in</div><div class="cd" id="deathCd">5</div>';
      d.style.pointerEvents = 'none';
    }
    d.style.pointerEvents = final ? 'auto' : 'none';
  }
  function showScore(on) {
    var el = $('score'); if (!on) { el.classList.add('hidden'); return; }
    var rows = '<table><tr><th></th><th>Player</th><th>Kills</th><th>Finals</th><th>Beds</th><th>Deaths</th></tr>';
    for (var t = 0; t < 4; t++) {
      var tm = S.teams[t] || {};
      rows += '<tr class="tm"><td colspan="6" style="color:' + teamCol(t) + '">' + tname(t) + ' ' + (tm.elim ? '💀' : tm.bed ? '🛏️' : '❌') + '</td></tr>';
      S.ents.forEach(function (e) { if (e.team !== t) return; var st = e.id === S.myId ? S.stats : (e.stats || {}); rows += '<tr' + (e.id === S.myId ? ' style="color:var(--gold)"' : '') + '><td>' + (e.elim ? '💀' : e.dead ? '⏳' : '') + '</td><td>' + (e.bot ? '🤖 ' : '') + esc(e.nick) + '</td><td>' + (e.id === S.myId ? st.kills || 0 : '–') + '</td><td>' + (e.id === S.myId ? st.finals || 0 : '–') + '</td><td>' + (e.id === S.myId ? st.beds || 0 : '–') + '</td><td>' + (e.id === S.myId ? st.deaths || 0 : '–') + '</td></tr>'; });
    }
    el.innerHTML = rows + '</table><div style="text-align:center;color:var(--mut);font-size:12px;margin-top:6px">Everyone’s full stats appear at the end of the match</div>';
    el.classList.remove('hidden');
  }
  $('gScore').onclick = function () { var el = $('score'); showScore(el.classList.contains('hidden')); };
  function toggleQc() {
    var q = $('qcMenu'); if (!q.classList.contains('hidden')) { q.classList.add('hidden'); return; }
    q.innerHTML = S.qc.map(function (x, i) { return '<button class="btn sm" data-q="' + i + '">' + (i + 1 <= 8 ? '' : '') + esc(x) + '</button>'; }).join(''); q.classList.remove('hidden');
  }
  $('gQc').onclick = toggleQc;
  $('qcMenu').addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (b) { send({ t: 'qc', i: +b.dataset.q }); $('qcMenu').classList.add('hidden'); } });
  var leaveArm = 0;
  $('gLeave').onclick = function () { if (now() - leaveArm < 2500) { send({ t: 'leave' }); P = null; show('menu'); return; } leaveArm = now(); toast('Click 🚪 again to leave (a bot will take your place)', 2500); };

  // minimap
  var miniBase = null;
  function drawMini() {
    var mc = $('miniCv'), x = mc.getContext('2d'), m = S.map, s = mc.width / W;
    if (!miniBase) {
      miniBase = document.createElement('canvas'); miniBase.width = mc.width; miniBase.height = mc.height; var b = miniBase.getContext('2d');
      b.fillStyle = '#1a1446'; b.fillRect(0, 0, mc.width, mc.height);
      for (var i = 0; i < W * H; i++) { var g = m.g[i]; if (!g) continue; b.fillStyle = g === 1 ? '#5fbf4b' : g === 2 ? '#8d98ad' : g === 4 ? '#c9925a' : g === 6 ? '#b6bdcc' : '#cfc6f0'; b.fillRect((i % W) * s, ((i / W) | 0) * s, s + 0.5, s + 0.5); }
    }
    x.drawImage(miniBase, 0, 0);
    for (var j = 0; j < W * H; j++) { if (m.w[j] || m.f[j]) { x.fillStyle = m.w[j] ? D.blockColor(m.w[j], m.wc[j]) : D.blockColor(m.f[j], m.fc[j]); x.fillRect((j % W) * s, ((j / W) | 0) * s, s + 0.5, s + 0.5); } }
    m.beds.forEach(function (bd) { if (!bd.alive) return; x.fillStyle = '#fff'; x.fillRect(bd.x / T * s - 4, bd.y / T * s - 4, 8, 8); x.fillStyle = teamCol(bd.team); x.fillRect(bd.x / T * s - 3, bd.y / T * s - 3, 6, 6); });
    S.gens.forEach(function (g) { if (g.g.team != null) return; x.fillStyle = g.g.kind === 'dia' ? '#5ff0e6' : '#2bd576'; x.beginPath(); x.arc(g.g.x / T * s, g.g.y / T * s, 3, 0, TAU); x.fill(); });
    S.ents.forEach(function (e) { if (e.dead || e.elim || e.id === S.myId) return; x.fillStyle = teamCol(e.team); x.strokeStyle = '#120e2e'; x.lineWidth = 2; x.beginPath(); x.arc(e.x / T * s, e.y / T * s, 4, 0, TAU); x.fill(); x.stroke(); });
    if (P && !P.dead) { x.save(); x.translate(P.x / T * s, P.y / T * s); x.rotate(P.ang); x.fillStyle = '#fff'; x.strokeStyle = '#120e2e'; x.lineWidth = 2; x.beginPath(); x.moveTo(7, 0); x.lineTo(-5, -5); x.lineTo(-2, 0); x.lineTo(-5, 5); x.closePath(); x.fill(); x.stroke(); x.restore(); }
    var vw = innerWidth / cam.z / T * s, vh = innerHeight / cam.z / T * s;
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.5; x.strokeRect(cam.x / T * s - vw / 2, cam.y / T * s - vh / 2, vw, vh);
  }

  // ------------------------------------------------------------------ shop
  var shopKind = 'shop', shopCat = 'quick';
  function openShop(kind) {
    if (S.dead) return;
    shopKind = kind; $('shop').classList.remove('hidden'); mouse.l = mouse.r = false; SC.sfx('open');
    $('shTitle').textContent = kind === 'shop' ? 'Item Shop' : 'Team Upgrades'; $('shIco').textContent = kind === 'shop' ? '🛒' : '⬆️';
    $('shCats').style.display = kind === 'shop' ? '' : 'none';
    renderShop();
  }
  function closeShop() { if (!$('shop').classList.contains('hidden')) { $('shop').classList.add('hidden'); SC.sfx('close'); } }
  $('shX').onclick = closeShop;
  $('shop').addEventListener('mousedown', function (e) { if (e.target === $('shop')) closeShop(); });
  function priceHtml(cost) { var out = ''; for (var k in cost) out += '<span class="pr"><img src="' + D.iconURL(k, 0, 0, 40) + '">' + cost[k] + '</span>'; return out; }
  function renderShop() {
    $('shRes').innerHTML = B.RES.map(function (r) { return '<span><img src="' + D.iconURL(r, 0, 0, 40) + '">' + (S.res[r] || 0) + '</span>'; }).join('');
    if (shopKind === 'shop') {
      $('shCats').innerHTML = B.SHOP_CATS.map(function (ct) { return '<button class="cat' + (ct.key === shopCat ? ' on' : '') + '" data-c="' + ct.key + '"><img src="' + D.iconURL(ct.icon === 'armor' ? 'armor2' : ct.icon === 'sword' ? 'sword3' : ct.icon === 'pick' ? 'pick2' : ct.icon, S.team, 1, 48) + '"><span>' + ct.name + '</span></button>'; }).join('');
      var items = B.SHOP.filter(function (s) { return shopCat === 'quick' ? s.quick : s.cat === shopCat; });
      $('shItems').innerHTML = items.map(function (s, idx) {
        var cost = s.cost, owned = false, lv = '', name = s.name, icon = s.icon;
        if (s.pickTiers) { cost = B.pickCost(S.pick); if (!cost) owned = true; name = (B.PICKS[Math.min(4, S.pick + 1)] || B.PICKS[4]).name; icon = 'pick' + Math.min(4, S.pick + 1); lv = 'Tier ' + Math.min(4, S.pick + 1); }
        if (s.sword && S.sword >= s.sword) owned = true;
        if (s.armor && S.armor >= s.armor) owned = true;
        if (s.max && s.give && Object.keys(s.give).some(function (k) { return k !== 'arrows' && (S.inv[k] || 0) >= s.max; })) owned = true;
        var poor = !owned && cost && !B.canAfford(S.res, cost);
        return '<button class="item' + (owned ? ' owned' : poor ? ' poor' : '') + '" data-id="' + s.id + '">' + (lv ? '<span class="lv">' + lv + '</span>' : '') + '<img src="' + D.iconURL(icon, S.team, s.sword || s.armor || 1, 80) + '"><div class="nm">' + esc(name) + '</div><div class="ds">' + esc(s.desc) + '</div>' + (owned ? '<span class="pr">✓ Owned</span>' : priceHtml(cost)) + '</button>';
      }).join('');
    } else {
      var tm = (S.teams[S.team] || {}).up || {};
      $('shItems').innerHTML = B.UPGRADES.map(function (u) {
        var lvl = tm[u.id] || 0, max = u.id === 'trap' ? lvl >= 1 : lvl >= u.costs.length, cost = max ? null : u.costs[u.id === 'trap' ? 0 : lvl];
        var poor = !max && (S.res.dia || 0) < cost;
        return '<button class="item' + (max ? ' owned' : poor ? ' poor' : '') + '" data-up="' + u.id + '">' + (u.costs.length > 1 ? '<span class="lv">' + lvl + '/' + u.costs.length + '</span>' : '') + '<img src="' + D.iconURL(u.icon, S.team, 3, 80) + '"><div class="nm">' + esc(u.name) + '</div><div class="ds">' + esc(u.desc) + '</div>' + (max ? '<span class="pr">' + (u.id === 'trap' ? '✓ Armed' : '✓ Maxed') + '</span>' : priceHtml({ dia: cost })) + '</button>';
      }).join('');
    }
  }
  $('shCats').addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (b) { shopCat = b.dataset.c; SC.sfx('click'); renderShop(); } });
  $('shItems').addEventListener('click', function (e) {
    var b = e.target.closest('.item'); if (!b || b.classList.contains('owned')) return;
    if (b.classList.contains('poor')) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); SC.sfx('no'); return; }
    if (b.dataset.id) send({ t: 'buy', id: b.dataset.id }); else send({ t: 'up', id: b.dataset.up });
    S.lastBuyEl = b.dataset.id || b.dataset.up;
  });
  var BUY_ERR = { poor: 'Not enough resources!', far: 'Walk closer to the NPC', owned: 'You already have that', max: 'Already maxed', dead: 'You’re dead!' };
  function onBuy(m) {
    if (m.res === 'ok') { SC.sfx(m.up ? 'level' : 'buy'); var el = document.querySelector('.item[data-' + (m.up ? 'up' : 'id') + '="' + m.id + '"]'); if (el) { el.classList.remove('bought'); void el.offsetWidth; el.classList.add('bought'); } D.burst('star', P.x, P.y - 30, 5, '#ffd166'); }
    else { SC.sfx('no'); toast(BUY_ERR[m.res] || 'Can’t buy that', 1500); }
  }

  // ------------------------------------------------------------------ end
  var podium = null;
  function onEnd(m) {
    S.ended = m; mouse.l = mouse.r = false; closeShop();
    var win = m.winner === m.team;
    $('eTitle').textContent = win ? 'VICTORY!' : m.winner < 0 ? 'DRAW' : 'GAME OVER';
    $('eTitle').style.color = win ? '#ffd166' : '#ff5c6c';
    $('eSub').innerHTML = m.winner >= 0 ? '<span style="color:' + teamCol(m.winner) + '">' + tname(m.winner) + ' team</span> wins!' : 'Nobody wins this time';
    var rw = m.reward;
    $('eReward').innerHTML = rw ? '+' + rw.give + ' 📜 Scrolls' + (rw.capped ? '<small>Daily Bedwars reward limit reached</small>' : '<small>' + ('Match length ' + B.fmtTime((m.mins || 0) * 60)) + '</small>') : '';
    $('eReward').classList.toggle('hidden', !rw);
    var st = m.stats.slice().sort(function (a, b) { return (b.finals * 3 + b.kills + b.beds * 4) - (a.finals * 3 + a.kills + a.beds * 4); });
    $('eTable').innerHTML = '<tr><th>#</th><th>Player</th><th>Kills</th><th>Finals</th><th>Beds</th><th>Deaths</th></tr>' + st.map(function (s, i) { return '<tr' + (s.id === m.you ? ' class="you"' : '') + '><td>' + (i + 1) + '</td><td><b style="color:' + teamCol(s.team) + '">' + (s.bot ? '🤖 ' : '') + esc(s.nick) + '</b></td><td>' + s.kills + '</td><td>' + s.finals + '</td><td>' + s.beds + '</td><td>' + s.deaths + '</td></tr>'; }).join('');
    podium = { team: m.winner, players: m.stats.filter(function (s) { return s.team === m.winner; }), conf: [], t0: now() };
    if (S.hello && rw) { S.hello.stats = Object.assign(S.hello.stats || {}, rw.stats, { coins: rw.coins, earnedToday: rw.stats.earned, cap: (S.hello.stats && S.hello.stats.cap) || 1500 }); }
    setTimeout(function () { show('end'); SC.sfx(win ? 'bigwin' : 'lose'); }, 1600);
  }
  function drawPodium(t, dt) {
    var pc = $('podium'), x = pc.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, pc.width, pc.height);
    if (!podium) return;
    var n = Math.max(1, podium.players.length), w = pc.width, col = podium.team >= 0 ? teamCol(podium.team) : '#6b7280';
    var pw = Math.min(w - 80, 260 + n * 170), px0 = w / 2 - pw / 2, top = 262;
    // spotlights
    x.save(); x.globalCompositeOperation = 'lighter';
    [-1, 1].forEach(function (sd) { var g = x.createLinearGradient(w / 2 + sd * 380, 0, w / 2, top); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(1, 'rgba(255,240,200,.16)'); x.fillStyle = g; x.beginPath(); x.moveTo(w / 2 + sd * 420, -10); x.lineTo(w / 2 + sd * 340, -10); x.lineTo(w / 2 - sd * (pw / 2 - 20), top + 10); x.lineTo(w / 2 + sd * (pw / 2 - 20), top + 10); x.closePath(); x.fill(); });
    x.restore();
    // stage
    x.fillStyle = 'rgba(0,0,0,.35)'; A.ell(x, w / 2, top + 92, pw / 2 + 30, 26); x.fill();
    A.rr(x, px0, top + 18, pw, 64, 18); x.fillStyle = A.shade(col, -0.35); x.fill(); x.strokeStyle = '#1b1636'; x.lineWidth = 6; x.stroke();
    A.ell(x, w / 2, top + 20, pw / 2, 26); x.fillStyle = col; x.fill(); x.stroke();
    A.ell(x, w / 2, top + 16, pw / 2 - 26, 16); x.fillStyle = 'rgba(255,255,255,.18)'; x.fill();
    x.font = '700 28px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillText('🏆 ' + (podium.team >= 0 ? tname(podium.team).toUpperCase() + ' TEAM' : 'DRAW'), w / 2, top + 58);
    podium.players.forEach(function (p, i) {
      var ppx = w / 2 + (i - (n - 1) / 2) * Math.min(200, (pw - 120) / Math.max(1, n - 1 || 1));
      if (n === 1) ppx = w / 2;
      x.save(); x.translate(ppx, top + 14); x.scale(2.6, 2.6);
      A.drawGim(x, 0, 0, p.look, { t: t + i, dir: 0, dance: true, shadow: true });
      D.armor(x, { team: p.team, armor: 1 }, 0, 0, t, -Math.abs(Math.sin((t + i) * 7)) * 7);
      x.restore();
      D.tag(x, (p.bot ? '🤖 ' : '') + p.nick, ppx, top - 150, { size: 22, color: '#fff', bg: 'rgba(20,16,50,.85)' });
    });
    var winMe = S.ended && S.ended.winner === S.ended.team;
    if (winMe && Math.random() < 0.6) podium.conf.push({ x: Math.random() * w, y: -10, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 130, r: Math.random() * 6, col: ['#ffd166', '#ff6ec7', '#5cf2ff', '#b8ff5c', '#ff5c6c', '#9b6bff'][Math.random() * 6 | 0] });
    for (var k = podium.conf.length - 1; k >= 0; k--) { var q = podium.conf[k]; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 5; if (q.y > pc.height + 10) { podium.conf.splice(k, 1); continue; } x.save(); x.translate(q.x, q.y); x.rotate(q.r); x.fillStyle = q.col; x.fillRect(-7, -3.5, 14, 7); x.restore(); }
  }
  function playAgain() { $('death').classList.add('hidden'); send({ t: 'leave' }); P = null; var q = S.lastQueue || { t: 'quick', mode: S.mode }; setTimeout(function () { send(q); }, 150); show('menu'); }
  $('eAgain').onclick = playAgain;
  $('eMenu').onclick = function () { send({ t: 'leave' }); P = null; show('menu'); };

  // debug hook for automated tests
  window.BWG = { dbg: function () { return { ct: cursorTile(), act: canAct(), r: mouse.r, wx: mouse.wx, wy: mouse.wy }; }, S: S, get P() { return P; }, send: send, cam: cam, mouse: mouse, keys: keys, openShop: openShop, selectSlot: selectSlot };

  requestAnimationFrame(frame);
  boot();
})();
