/* ============================================================
   Bedwars 2D — client. Loading screen, menus, lobby, networking with
   interpolation + local prediction, input (mouse/keys/touch), rendering,
   HUD, shop, end screen.
   ============================================================ */
(function () {
  'use strict';
  var B = window.BW, D = window.BWD, SC = window.SC, A = SC.art, MG = window.MG;
  var T = B.T, W = B.W, H = B.H, TAU = Math.PI * 2;
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), c = cv.getContext('2d');
  D.season = 'xmas'; A.season = 'xmas';
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
    season: 'xmas',
    screen: 'loading', net: null, hello: null, room: null,
    map: null, ents: new Map(), myId: 0, team: 0, mode: 'solo', kind: 'public', goAt: 0,
    inv: {}, res: { iron: 0, gold: 0, dia: 0, em: 0 }, sword: 1, armor: 1, pick: 0, held: 'sword', hp: 20, absorb: 0,
    dead: false, elim: false, respawnAt: 0, speedUntil: 0, slowUntil: 0, stats: {},
    teams: [], gens: [], tier: { dia: 0, em: 0 }, tl: 0, projs: new Map(), tnts: new Map(), cracks: {}, placeAnim: {}, slashes: [],
    shake: 0, hurtT: 0, ended: null, qc: [], lastSnap: 0, specId: 0,
    game: 'bw', flags: [], score: [0, 0], pickups: [], endAt: 0, seekAt: 0, sdAt: 0, phase: '', crk: {}, propWob: {}, did: {},
    mrole: '', det: 0, golds: null, gold: 0, theme: '', buildEnd: 0, votePlot: -1, voted: false, bbSel: { lay: 'g', v: 1 }, plotOwners: [], myElo: 1000,
  };
  var NN = W * H;
  function isMini() { return S.game !== 'bw'; }
  function gname(g) { return (MG.GAMES[g] || MG.GAMES.bw).name; }
  var P = null; // my locally-simulated body
  var cam = { x: 36 * T, y: 36 * T, z: 1 };
  var offset = 0, bestRtt = 1e9, rtt = 0;
  function snow() { return Date.now() + offset; }

  // ------------------------------------------------------------------ net
  var ws = null, wsOpen = false, reconnectT = 0, backoff = 800, pingT = 0, lastRecv = 0;
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function sendBin(buf) { if (ws && ws.readyState === 1 && ws.bufferedAmount < 64000) ws.send(buf); }
  function connect() {
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/bw-ws'); } catch (e) { scheduleReconnect(); return; }
    ws.binaryType = 'arraybuffer';
    ws.onopen = function () { wsOpen = true; backoff = 800; lastRecv = Date.now(); send({ t: 'ping', c: Date.now() }); if (window.BWV && BWV.hearing) send({ t: 'vc', on: true }); };
    ws.onmessage = function (ev) { lastRecv = Date.now(); if (typeof ev.data !== 'string') { if (window.BWV) BWV.onFrame(new Uint8Array(ev.data)); return; } var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
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
    if (t === 'soc') { S.soc = m; if (m.party !== undefined) S.party = m.party; renderSoc(); renderPartyBar(); return; }
    if (t === 'party') { S.party = m.id ? m : null; renderPartyBar(); if (!$('mSoc').classList.contains('hidden')) renderSoc(); return; }
    if (t === 'pinvite') { showInvite(m); return; }
    if (t === 'toast') { toast(m.msg, 3200); return; }
    if (t === 'fx') { screenFx(m); return; }
    if (t === 'qz') { S.qMode = 'q'; showQuestion(m); return; }
    if (t === 'qr') { quizResult(m); return; }
    if (t === 'cq') { openCq(m); return; }
    if (t === 'cqend') { if (S.qMode === 'cq') closeQuiz(true); return; }
    if (t === 'vote') { onVote(m); return; }
    if (t === 'season') { applySeason(m.v); if (S.screen === 'hub') toast(S.season ? '🎄 Happy holidays! The hub is decorated.' : 'Holiday decorations are off.', 2600); return; }
    if (t === 'school') { S.school = !!m.on; document.body.classList.toggle('school', S.school); quizHud(); if (S.screen === 'hub') toast(S.school ? '🏫 School Mode is ON — portals are locked, your teacher picks the games!' : '🏫 School Mode is off — portals are open!', 3000); return; }
    if (t === 'mylook') { if (S.hello) S.hello.look = m.look; var me0 = S.ents.get(S.myId); if (me0) me0.look = m.look; return; }
    if (t === 'cls') { S.cls = m.d; if (admTab === 'class') renderAdmin(); return; }
    if (t === 's') return onSnap(m);
    if (t === 'pong') { var r = Date.now() - m.c; rtt = r; if (r <= bestRtt * 1.3 || !offset) { bestRtt = Math.min(bestRtt, r); offset = m.n + r / 2 - Date.now(); } return; }
    if (t === 'me') return onMe(m);
    if (t === 'kb') { if (P && !P.dead) { P.vx += m.vx; P.vy += m.vy; } return; }
    if (t === 'pos') { if (P) { P.x = m.x; P.y = m.y; if (m.spawn) { P.dead = false; P.falling = 0; P.vx = P.vy = 0; } } return; }
    if (t === 'slow') { S.slowUntil = now() + m.ms; toast('🪤 You triggered a trap!', 2200); return; }
    if (t === 'fix') { setTileLocal(m.i, m.f, m.fc, m.w, m.wc, true); return; }
    if (t === 'buy') return onBuy(m);
    if (t === 'hello') { S.hello = m; S.myCid = m.cid || ''; if (m.season !== undefined && (m.season || '') !== S.season) applySeason(m.season); S.school = !!m.school; document.body.classList.toggle('school', S.school); $('schoolTag').classList.toggle('hidden', !S.school); S.qc = m.qc || []; if (m.elo != null) S.myElo = m.elo; if (m.stats) S.mystats = m.stats; S.owner = !!m.owner; S.teacher = !!m.teacher; if (S.teacher && !S.owner && /teacher=1/.test(location.search)) setTimeout(function () { toast('🏫 Welcome! Click 🏫 Teacher (top right) to start votes, ask the class questions and see scores.', 6000); }, 1500); S.mapper = !!m.mapper; S.motd = m.motd || ''; S.x2 = !!m.x2; ownerSync(); helloArrived(); testFromBuilder(); return; }
    if (t === 'adminfo') { S.adm = m; renderAdmin(); return; }
    if (t === 'admres') { toast((m.ok ? '✅ ' : '⚠️ ') + m.msg, 2200); SC.sfx(m.ok ? 'pop' : 'no'); if ($('mAdmin') && !$('mAdmin').classList.contains('hidden')) send({ t: 'adm', a: 'info' }); return; }
    if (t === 'ann') { banner('📢 ' + esc(m.from || 'Owner'), esc(m.text), '#ffd166'); SC.sfx('level'); return; }
    if (t === 'god') { S.god = !!m.on; return; }
    if (t === 'goat') { S.goAt = m.goAt; lastTimerS = -1; return; }
    if (t === 'join') { if (S.screen === 'game' && m.ent && !S.ents.has(m.ent.id)) { S.ents.set(m.ent.id, mkEnt(m.ent)); feed('👑 ' + nameHtml(S.ents.get(m.ent.id)) + ' joined the match'); } return; }
    if (t === 'frozen') { S.frozen = !!m.on; toast(m.on ? '❄️ An owner froze you' : '✅ You can move again', 2000); return; }
    if (t === 'motd') { S.motd = m.text; if (m.text) banner('📢 ' + esc(m.text), '', '#ffd166'); updateOnline(); return; }
    if (t === 'z') { if (P) { P.z = m.z; P.falling = 0; P.vx = P.vy = 0; if (m.x != null) { P.x = m.x; P.y = m.y; } } var mz = S.ents.get(S.myId); if (mz) mz.z = m.z; D.burst('dust', P.x, P.y, 10); S.shake = Math.max(S.shake, 6); SC.sfx('place'); toast('⬇️ Floor ' + (m.z + 1) + ' of ' + MG.SP_LAYERS + (m.z === MG.SP_LAYERS - 1 ? ' — the LAST one!' : ''), 1500); return; }
    if (t === 'role') { S.team = m.role; var mr = S.ents.get(S.myId); if (mr) { mr.team = m.role; mr.prop = ''; } S.held = 'sword'; renderHotbar(); mgHudInit(); banner('🔍 YOU’RE A SEEKER NOW', 'Find the hiders that are left!', '#ff5c6c'); tutStart(); return; }
    if (t === 'radar') { if (m.none) { toast('No hiders left to find', 1400); return; } S.radar = { x: m.x, y: m.y, d: m.d, t: now() }; SC.sfx('level'); toast('📡 ' + (m.d < 6 * T ? 'HOT! A hider is really close' : m.d < 14 * T ? 'Warm — a hider is nearby' : 'Cold — the nearest hider is far away'), 2200); return; }
    if (t === 'mgt') { if (m.endAt) S.endAt = m.endAt; if (m.seekAt) S.seekAt = m.seekAt; if (m.sdAt) S.sdAt = m.sdAt; return; }
    if (t === 'ann2') { toast(esc(m.text), 1600); return; }
    if (t === 'disco') {
      if (window.SHMusic) SHMusic.disco(m.ms || 30000);
      document.body.classList.add('disco');
      clearTimeout(S.discoT); S.discoT = setTimeout(function () { document.body.classList.remove('disco'); clearInterval(S.discoI); }, m.ms || 30000);
      clearInterval(S.discoI);
      S.discoI = setInterval(function () { if (S.screen !== 'game' || !P) return; var cols = ['#ff4b5c', '#ffd166', '#2bd576', '#3fa9ff', '#9b6bff', '#ff6ec7']; D.burst('star', P.x + (Math.random() - 0.5) * 500, P.y + (Math.random() - 0.5) * 320, 4, cols[(Math.random() * 6) | 0]); }, 450);
      banner('🪩 DISCO TIME!', '', '#9b6bff'); SC.sfx('level');
      return;
    }
    if (t === 'lb2') { S.lb2[m.game] = m.rows || []; if (m.myElo != null) S.myElo = m.myElo; renderLb(); return; }
    if (t === 'bbv') { S.phase = 'vote'; S.votePlot = m.plot; S.voteUntil = m.until; S.voted = false; banner('JUDGE THIS BUILD', (m.owner === S.nick ? 'This one is YOURS!' : 'Built by ' + esc(m.owner)) + ' · ' + (m.idx + 1) + ' of ' + m.of, '#ffd166'); SC.sfx('go'); bbUISync(); return; }
    if (t === 'bbr') { S.phase = 'podium'; S.votePlot = -1; var w = m.results && m.results[0]; if (w) banner('🏆 ' + esc(w.nick) + ' WINS!', 'Theme: ' + esc(m.theme) + ' · scored ' + w.avg + ' ⭐', '#ffd166'); SC.sfx('final'); bbUISync(); return; }
    if (t === 'vcstate') { if (window.BWV) BWV.range = m.range || BWV.range; if (m.off && BWV.on) toast('🔇 Voice chat is turned off right now', 2400); if (m.muted && BWV.on) toast('🔇 An owner muted your voice', 2400); S.vcOff = !!m.off; S.vcMuted = !!m.muted; voiceSync(); return; }
    if (t === 'space') { enterSpace(m); helloArrived(); return; }
    if (t === 'room') { S.room = m; m._at = Date.now(); if (S.screen === 'wait') renderWait(); return; }
    if (t === 'game') { helloArrived(); return startGame(m); }
    if (t === 'end') return onEnd(m);
    if (t === 'err') {
      if (m.code === 'login' || m.code === 'replaced' || m.code === 'kicked') { S.fatal = true; fatal(m.msg, m.code); return; }
      toast(m.msg || 'Something went wrong', 2500); SC.sfx('no'); return;
    }
  }
  function fatal(msg, code) {
    var d = document.createElement('div'); d.className = 'modal'; d.style.zIndex = 90;
    d.innerHTML = '<div class="mwrap" style="width:min(460px,100%);padding:22px;text-align:center;gap:12px"><div style="font-size:46px">' + (code === 'login' ? '🎮' : code === 'kicked' ? '🚫' : '🪟') + '</div><h2 style="margin:0">' + esc(msg) + '</h2>' +
      (code === 'login' ? '<div class="lgform" style="display:flex;flex-direction:column;gap:10px"><input id="lgU" class="admin-in" placeholder="Your nickname" maxlength="16" autocomplete="nickname" style="font-size:20px;padding:12px;text-align:center;font-weight:700"><button class="btn green" id="lgIn" style="font-size:19px;padding:12px">Play ▶</button><div id="lgMsg" style="color:#ff8a95;font-weight:700;min-height:20px;text-align:center"></div></div>' : code === 'kicked' ? '<a class="btn green" href="/casino">Go to the casino</a>' : '<button class="btn green" onclick="location.reload()">Play here instead</button>') + '</div>';
    document.body.appendChild(d);
    if (code === 'login') {
      var go = function () {
        var u = $('lgU').value.trim(); if (u.length < 2) { $('lgMsg').textContent = 'Type a nickname (at least 2 letters).'; return; }
        $('lgMsg').style.color = '#cfc8ff'; $('lgMsg').textContent = 'Joining…';
        fetch('/api/arcade/nick', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nick: u }) }).then(function (r) { return r.json(); }).then(function (r) {
          if (r && r.ok) location.reload(); else { $('lgMsg').style.color = '#ff8a95'; $('lgMsg').textContent = (r && r.error) || 'That didn’t work — try again.'; }
        }).catch(function () { $('lgMsg').textContent = 'Couldn’t reach the server.'; });
      };
      $('lgIn').onclick = go; $('lgU').onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') go(); };
      setTimeout(function () { try { $('lgU').focus(); } catch (e) {} }, 100);
    }
    var ld = $('loading'); ld.classList.add('out');
  }

  // ------------------------------------------------------------------ screens
  function show(name) {
    S.screen = name;
    $('end').classList.toggle('hidden', name !== 'end');
    ['hub', 'wait', 'game', 'end'].forEach(function (k) { document.body.classList.toggle('mode-' + k, k === name); });
    $('hud').classList.toggle('hidden', name === 'loading');
    $('hudBtns').classList.toggle('hidden', name !== 'game');
    $('hubHud').classList.toggle('hidden', name !== 'hub');
    $('waitHud').classList.toggle('hidden', name !== 'wait');
    document.body.classList.toggle('ingame', name === 'game');
    $('crosshair').classList.toggle('hidden', name !== 'game' || touch);
    $('touch').classList.toggle('hidden', !(touch && name !== 'end' && name !== 'loading'));
    $('qcMenu').classList.add('hidden');
    if (name !== 'game') { $('death').classList.add('hidden'); $('score').classList.add('hidden'); $('tutor').classList.add('hidden'); $('blind').classList.add('hidden'); $('bbPal').classList.add('hidden'); $('bbVote').classList.add('hidden'); }
    if (name === 'hub' || name === 'wait') { document.body.classList.remove('mg', 'g-ctf', 'g-spleef', 'g-hide'); S.game = 'bw'; ['tAtk', 'tPlace', 'tUse'].forEach(function (id, k) { $(id).textContent = ['⚔️', '🧱', '✨'][k]; $(id).style.visibility = ''; }); }
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
  function helloArrived() { var w = helloWaiters; helloWaiters = []; w.forEach(function (f) { f(); }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var booted = false;
  function finishLoading() {
    if (booted) return; booted = true;
    clearInterval(tipTimer);
    $('loading').classList.add('out');
    setTimeout(function () { $('loading').classList.add('hidden'); }, 700);
    if (S.screen === 'loading') { // still no word from the server: show the hub anyway
      S.map = S.hubMap || (S.hubMap = hubGen()); P = newBody(B.HUB_SPAWN.x, B.HUB_SPAWN.y); cam.x = P.x; cam.y = P.y; show('hub'); renderHubHud();
    }
  }
  setTimeout(finishLoading, 14000); // never get stuck on the loading screen
  async function boot() {
    try { await bootSteps(); } catch (e) { console.error('bedwars boot', e); }
    finishLoading();
  }
  async function bootSteps() {
    $('loadCv').style.display = 'none';
    $('loading').style.background = 'radial-gradient(ellipse at center, rgba(18,12,51,.35), rgba(18,12,51,.92) 70%)';
    ldStep(0.08, 'Waking up the islands…');
    try { await Promise.race([document.fonts.load('700 20px Fredoka'), wait(1500)]); } catch (e) {}
    S.hubMap = hubGen(); S.map = S.hubMap; cam.x = B.HUB_SPAWN.x; cam.y = B.HUB_SPAWN.y - 120;
    ldStep(0.3, 'Painting blocks & beds…'); await wait(250);
    var ids = ['sword1', 'sword2', 'sword3', 'sword4', 'kbstick', 'wool', 'wood', 'end', 'obby', 'pick1', 'pick2', 'pick3', 'pick4', 'bow', 'arrows', 'fireball', 'tnt', 'gapple', 'pearl', 'egg', 'speed', 'armor1', 'armor2', 'armor3', 'armor4', 'iron', 'gold', 'dia', 'em', 'forge', 'heal', 'trap', 'star'];
    ids.forEach(function (id) { D.iconURL(id, 0, 0, 64); });
    makeHearts(); makeCrosshair();
    ldStep(0.55, 'Sharpening swords…'); await wait(300);
    for (var cy = 0; cy < 6; cy++) for (var cx = 0; cx < 6; cx++) D.chunk(S.map, cx, cy);
    ldStep(0.75, 'Connecting to the hub…');
    connect();
    await Promise.race([new Promise(function (r) { if (S.screen !== 'loading') r(); else helloWaiters.push(r); }), wait(8000)]);
    ldStep(1, S.screen !== 'loading' ? 'Ready!' : 'Still connecting…');
    await wait(420);
  }

  // ------------------------------------------------------------------ hub & waiting island
  var pMode = 'solo', pDiff = 'normal', cMode = 'solo', cDiff = 'normal', pGame = 'bw', cGame = 'bw';
  function seg(id, cb) { var el = $(id); if (!el) return; el.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; [].forEach.call(el.children, function (x) { x.classList.toggle('on', x === b); }); SC.sfx('click'); cb(b.dataset.v); }); }
  seg('pMode', function (v) { pMode = v; }); seg('pDiff', function (v) { pDiff = v; });
  seg('cMode', function (v) { cMode = v; }); seg('cDiff', function (v) { cDiff = v; });
  seg('hMode', function (v) { send({ t: 'cfg', mode: v }); }); seg('hDiff', function (v) { send({ t: 'cfg', diff: v }); });
  var MODALS = ['mPractice', 'mPrivate', 'mLb', 'how', 'mAdmin', 'mHelp', 'mGame', 'mSoc', 'mShop2'];
  function anyModal() { return MODALS.some(function (k) { return !$(k).classList.contains('hidden'); }) || !$('shop').classList.contains('hidden'); }
  function openModal(id) { closeModals(); $(id).classList.remove('hidden'); SC.sfx('open'); mouse.l = mouse.r = false; keys = {}; }
  function closeModals() { MODALS.forEach(function (k) { $(k).classList.add('hidden'); }); }
  [].forEach.call(document.querySelectorAll('[data-close]'), function (b) { b.onclick = function () { closeModals(); SC.sfx('close'); }; });
  MODALS.forEach(function (k) { $(k).addEventListener('mousedown', function (e) { if (e.target === $(k)) closeModals(); }); });
  $('pGo').onclick = function () { S.lastQueue = { t: 'practice', game: pGame, mode: pGame === 'bw' ? pMode : pGame, diff: pDiff }; send(S.lastQueue); closeModals(); SC.sfx('go'); };
  $('cGo').onclick = function () { send({ t: 'create', game: cGame, mode: cGame === 'bw' ? cMode : cGame, diff: cDiff }); closeModals(); SC.sfx('go'); };
  function openPractice(g) { pGame = g || 'bw'; var G2 = MG.GAMES[pGame]; $('pTitle').textContent = 'Practice ' + G2.name; $('pIco').textContent = G2.icon || '🤖'; $('pModeRow').classList.toggle('hidden', pGame !== 'bw'); openModal('mPractice'); }
  function openPrivate(g) { cGame = g || 'bw'; var G2 = MG.GAMES[cGame]; $('cTitle').textContent = 'Private ' + G2.name; $('cIco').textContent = G2.icon || '👥'; $('cMode').classList.toggle('hidden', cGame !== 'bw'); $('cHint').textContent = cGame === 'bw' ? '' : G2.tag + ' · empty spots get bots'; openModal('mPrivate'); }
  $('jGo').onclick = function () { var code = $('jCode').value.trim(); if (code.length < 4) { toast('Enter a 4-letter room code', 1800); return; } send({ t: 'join', code: code }); closeModals(); };
  $('jCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('jGo').click(); e.stopPropagation(); });
  function muteSync() { var m = SC.sfxMuted(); [].forEach.call(document.querySelectorAll('.muteBtn'), function (b) { b.textContent = m ? '🔇' : '🔊'; }); }
  [].forEach.call(document.querySelectorAll('.muteBtn'), function (b) { b.onclick = function () { SC.sfxToggle(); muteSync(); }; });
  muteSync();
  function musicSync() { var o = window.SHMusic && SHMusic.isOff(); [].forEach.call(document.querySelectorAll('.musicBtn'), function (b) { b.style.opacity = o ? '.45' : '1'; b.title = o ? 'Music: off' : 'Music: on'; }); }
  [].forEach.call(document.querySelectorAll('.musicBtn'), function (b) { b.onclick = function () { if (!window.SHMusic) return; toast(SHMusic.toggle() ? '🎵 Music off' : '🎵 Music on', 1200); musicSync(); }; });
  musicSync();
  var qs = new URLSearchParams(location.search); if (qs.get('room')) $('jCode').value = qs.get('room').toUpperCase().slice(0, 4);
  var roomLinkUsed = false;
  helloWaiters.push(function () { if (qs.get('room') && !roomLinkUsed) { roomLinkUsed = true; setTimeout(function () { send({ t: 'join', code: qs.get('room') }); }, 300); } });

  function newBody(x, y) { return { x: x, y: y, vx: 0, vy: 0, cvx: 0, cvy: 0, dead: false, falling: 0, mv: false, sprint: false, ang: Math.PI / 2, lastSend: 0, hopT: -9e9, auto: null }; }
  function mkEnt(o) { return { z: o.z || 0, prop: o.prop || '', carry: o.carry != null ? o.carry : -1, id: o.id, nick: o.nick, team: o.team == null ? -1 : o.team, look: o.look, bot: !!o.bot, sword: o.sword || 1, armor: o.armor || 1, pick: o.pick || 0, x: o.x, y: o.y, ang: Math.PI / 2, flags: 0, held: 'sword', hp: 20, buf: [], dead: !!o.dead, elim: !!o.elim, walk: 0, swingT: null, swingDir: 1, flashT: -9e9, fallT: 0, stats: o.stats || {}, dc: o.dc, bubble: null, lastStep: 0, hopT: -9e9, bumpT: -9e9 }; }
  function addSpacePlayer(o) {
    var e = S.ents.get(o.id);
    if (!e) { e = mkEnt(o); S.ents.set(o.id, e); }
    e.nick = o.nick; e.look = o.look; e.team = o.team == null ? -1 : o.team;
    if (o.id === S.myId) S.team = e.team;
    return e;
  }
  function enterSpace(m) {
    closeShop(); closeModals();
    var hub = m.kind === 'hub';
    S.map = hub ? (S.hubMap || (S.hubMap = hubGen())) : (S.waitMap || (S.waitMap = B.genWait())); D.resetChunks();
    if (window.BWV) BWV.reset();
    S.watching = false; $('watchBar').classList.add('hidden'); document.body.classList.remove('watching');
    S.en = -1; closeQuiz(true); quizHud();
    S.spaceKind = m.kind; S.myId = m.you; S.team = -1; S.ended = null; S.dead = S.elim = false; S.held = 'sword'; S.sword = 1; S.armor = 1;
    S.ents = new Map(); S.projs = new Map(); S.tnts = new Map(); S.cracks = {}; S.placeAnim = {}; S.slashes = []; S.gens = []; S.teams = []; trails.length = 0; D.parts.length = 0;
    offset = m.now - Date.now(); bestRtt = 1e9;
    if (m.lb) S.lb = m.lb; if (m.stats) S.mystats = m.stats; if (m.online) S.online = m.online; if (m.qc) S.qc = m.qc; if (m.motd != null) S.motd = m.motd; if (m.x2 != null) S.x2 = m.x2;
    S.room = m.room; if (S.room) S.room._at = Date.now();
    m.players.forEach(addSpacePlayer);
    P = newBody(m.x, m.y);
    var fromGame = S.screen === 'end' || S.screen === 'game';
    if (fromGame || S.screen === 'loading') { cam.x = P.x; cam.y = P.y - 20; }
    show(hub ? 'hub' : 'wait');
    if (hub) renderHubHud(); else renderWait();
    D.spawn({ k: 'beam', x: P.x, y: P.y, col: '#fff', life: 0.8 }); D.burst('magic', P.x, P.y - 20, 14, '#c4b5fd');
    SC.sfx('join');
  }
  function renderHubHud() {
    var st = S.mystats || {}, h = S.hello || {};
    $('hubName').textContent = h.nick || 'Player';
    $('hubCoins').textContent = (st.coins || 0).toLocaleString();
    $('hubWins').textContent = st.wins || 0;
    $('hubCv') && drawHubAvatar();
    updateOnline();
  }

  // ------------------------------------------------------------------ friends, party & spectating
  S.socTab = 'party';
  function openSoc(tab) { if (tab) S.socTab = tab; openModal('mSoc'); renderSoc(); send({ t: 'soc' }); }
  [].forEach.call(document.querySelectorAll('.socBtn'), function (b) { b.onclick = function () { openSoc(); }; });
  [].forEach.call(document.querySelectorAll('.socTabs button'), function (b) { b.onclick = function () { S.socTab = b.dataset.st; renderSoc(); send({ t: 'soc' }); SC.sfx('click'); }; });
  setInterval(function () { if (!$('mSoc').classList.contains('hidden')) send({ t: 'soc' }); }, 3000);
  function avCv(look) { var c = document.createElement('canvas'); c.width = 84; c.height = 84; var x = c.getContext('2d'); x.save(); x.translate(42, 76); x.scale(1.35, 1.35); try { A.drawGim(x, 0, 0, look || { skin: 'gim', body: '#4a4f6a' }, { t: 0, dir: 0, shadow: false }); } catch (e) {} x.restore(); return c; }
  function sbtn(txt, cls, fn) { var b = document.createElement('button'); b.className = 'btn sm ' + (cls || ''); b.innerHTML = txt; b.onclick = function (ev) { ev.stopPropagation(); fn(); SC.sfx('click'); }; return b; }
  function srow(look, name, sub, dot, btns) {
    var r = document.createElement('div'); r.className = 'srow';
    r.appendChild(avCv(look));
    var g = document.createElement('div'); g.className = 'grow'; g.innerHTML = '<div class="sn">' + (dot ? '<span class="sdot ' + dot + '"></span>' : '') + esc(name) + '</div><div class="sw">' + sub + '</div>'; r.appendChild(g);
    (btns || []).forEach(function (b) { if (b) r.appendChild(b); });
    return r;
  }
  function sInput(ph, label, fn) {
    var w = document.createElement('div'); w.className = 'sinp';
    var i = document.createElement('input'); i.placeholder = ph; i.maxLength = 30;
    var b = sbtn(label, 'green', function () { var v = i.value.trim(); if (v) { fn(v); i.value = ''; } });
    i.onkeydown = function (e) { e.stopPropagation(); if (e.key === 'Enter') b.onclick(e); };
    w.appendChild(i); w.appendChild(b); return w;
  }
  function slab(t) { var d = document.createElement('div'); d.className = 'slab'; d.textContent = t; return d; }
  function renderSoc() {
    var body = $('socBody'); if (!body) return;
    [].forEach.call(document.querySelectorAll('.socTabs button'), function (b) { b.classList.toggle('on', b.dataset.st === S.socTab); });
    var so = S.soc || {}, p = S.party, me = S.hello && S.hello.you;
    body.innerHTML = '';
    var myCid = S.myCid;
    if (S.socTab === 'party') {
      (so.invites || []).forEach(function (iv) {
        body.appendChild(srow(null, '📨 ' + iv.from + ' invited you', 'Join their party to queue together', '', [sbtn('✓ Join', 'green', function () { send({ t: 'pacc', id: iv.id }); setTimeout(function () { send({ t: 'soc' }); }, 300); }), sbtn('✕', 'red', function () { send({ t: 'pdec', id: iv.id }); so.invites = so.invites.filter(function (x) { return x !== iv; }); renderSoc(); })]));
      });
      if (!p) {
        var e1 = document.createElement('div'); e1.className = 'sempty'; e1.innerHTML = '🎉 You’re not in a party.<br>Invite friends — you’ll queue together, <b>always land on the same team</b>, and hear each other on <b>party voice</b> anywhere on the map.'; body.appendChild(e1);
      } else {
        var lead = p.leader === myCid;
        body.appendChild(slab('Your party · ' + p.members.length + '/4' + (lead ? ' · you’re the leader' : '')));
        p.members.forEach(function (mb) {
          var w = mb.where || {}, isMe = mb.cid === myCid;
          var btns = [];
          if (!isMe && lead) { btns.push(sbtn('👑', '', function () { send({ t: 'plead', cid: mb.cid }); })); btns.push(sbtn('Kick', 'red', function () { send({ t: 'pkick', cid: mb.cid }); })); }
          if (!isMe && w.s === 'play') btns.push(sbtn('👀 Watch', '', function () { send({ t: 'fwatch', cid: mb.cid }); closeModals(); }));
          if (!isMe && w.s === 'lobby' && w.join) btns.push(sbtn('▶ Join', 'green', function () { send({ t: 'fjoin', cid: mb.cid }); closeModals(); }));
          body.appendChild(srow(mb.look, (p.leader === mb.cid ? '👑 ' : '') + mb.nick + (isMe ? ' (you)' : '') + (mb.talk ? ' 🎙️' : ''), mb.on ? esc(w.txt || '') : 'Offline', mb.on ? 'on' : '', btns));
        });
        var tip = document.createElement('div'); tip.className = 'sw'; tip.style.cssText = 'color:var(--mut);font-size:13px;font-weight:600;text-align:center';
        tip.innerHTML = lead ? 'Pick any game from a portal — your whole party comes with you, on your team. 🎙️ Turn on Talk to use party voice.' : 'The leader picks the games. 🎙️ Turn on Talk to hear your party anywhere on the map.';
        body.appendChild(tip);
        body.appendChild(sbtn('🚪 Leave party', 'red', function () { send({ t: 'pleave' }); }));
      }
      body.appendChild(slab('Invite a player by name'));
      body.appendChild(sInput('Username…', '📨 Invite', function (v) { send({ t: 'pinv', name: v }); setTimeout(function () { send({ t: 'soc' }); }, 400); }));
      var on = (so.friends || []).filter(function (f) { return f.arcade && !f.inParty; });
      if (on.length) { body.appendChild(slab('Friends in Games')); on.forEach(function (f) { body.appendChild(srow(f.look, f.nick, esc((f.where || {}).txt || ''), 'on', [sbtn('📨 Invite', 'green', function () { send({ t: 'pinv', cid: f.cid }); })])); }); }
    } else {
      (so.incoming || []).forEach(function (rq) {
        body.appendChild(srow(null, rq.nick + ' wants to be friends', 'Friend request', '', [sbtn('✓ Accept', 'green', function () { api('/api/friends/accept', { id: rq.id }); }), sbtn('✕', 'red', function () { api('/api/friends/decline', { id: rq.id }); })]));
      });
      var fr = so.friends || [];
      body.appendChild(slab('Friends · ' + fr.filter(function (f) { return f.arcade; }).length + ' in Games'));
      if (!fr.length) { var e2 = document.createElement('div'); e2.className = 'sempty'; e2.textContent = 'No friends yet — add someone by their ScrollHub username below!'; body.appendChild(e2); }
      fr.forEach(function (f) {
        var w = f.where || {}, btns = [];
        if (f.arcade) {
          if (w.s === 'lobby' && w.join) btns.push(sbtn('▶ Join', 'green', function () { send({ t: 'fjoin', cid: f.cid }); closeModals(); }));
          if (w.s === 'play') { btns.push(sbtn('👀 Spectate', '', function () { send({ t: 'fwatch', cid: f.cid }); closeModals(); })); }
          if (w.s === 'hub') btns.push(sbtn('📍 Go to', '', function () { send({ t: 'fjoin', cid: f.cid }); closeModals(); }));
          if (!f.inParty) btns.push(sbtn('📨', '', function () { send({ t: 'pinv', cid: f.cid }); }));
        }
        body.appendChild(srow(f.look, f.nick + (f.inParty ? ' 🎉' : ''), f.arcade ? esc(w.txt || '') : f.site ? 'On ScrollHub (not in Games)' : 'Offline', f.arcade ? 'on' : f.site ? 'site' : '', btns));
      });
      body.appendChild(slab('Add a friend'));
      body.appendChild(sInput('ScrollHub username…', '➕ Add', function (v) { api('/api/friends/add', { username: v }, function (r) { toast(r.accepted ? '🤝 You’re now friends with ' + v + '!' : r.sent ? '📨 Friend request sent to ' + v : (r.message || 'Couldn’t add them'), 2600); }); }));
    }
    var dots = (so.invites || []).length + (so.incoming || []).length;
    [].forEach.call(document.querySelectorAll('.socDot'), function (d) { d.classList.toggle('hidden', !dots); d.textContent = dots; });
  }
  function api(path, body, cb) {
    fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).then(function (r) { if (cb) cb(r); else if (r.error) toast(r.message || r.error, 2200); setTimeout(function () { send({ t: 'soc' }); }, 250); })
      .catch(function () { toast('Couldn’t reach ScrollHub', 2000); });
  }
  function renderPartyBar() {
    var bar = $('partyBar'), p = S.party;
    if (!p || !p.members || p.members.length < 2) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');
    var h = '<div class="ph">🎉 PARTY' + (window.BWV && BWV.on ? ' · 🎙️ voice on' : '') + '</div>';
    p.members.forEach(function (mb) { var w = mb.where || {}; h += '<div class="pb' + (mb.talk ? ' talk' : '') + '"><span class="sdot ' + (mb.on ? 'on' : '') + '"></span><div style="min-width:0"><div>' + (p.leader === mb.cid ? '👑 ' : '') + esc(mb.nick) + '</div><div class="pw">' + (mb.on ? esc(w.txt || '') : 'Offline') + '</div></div></div>'; });
    bar.innerHTML = h;
  }
  function showInvite(m) {
    var d = $('pInvite'); d.classList.remove('hidden'); SC.sfx('level');
    d.innerHTML = '<div>📨 <b>' + esc(m.from) + '</b> invited you to their party!</div><div style="display:flex;gap:8px"></div>';
    var row = d.lastChild;
    row.appendChild(sbtn('✓ Join party', 'green', function () { send({ t: 'pacc', id: m.id }); d.classList.add('hidden'); }));
    row.appendChild(sbtn('No thanks', 'red', function () { send({ t: 'pdec', id: m.id }); d.classList.add('hidden'); }));
    clearTimeout(S.invT); S.invT = setTimeout(function () { d.classList.add('hidden'); }, 30000);
  }
  function watchTxt() { var e = S.ents && S.ents.get(S.specId); $('watchTxt').textContent = '👀 Spectating ' + (MG.GAMES[S.game] ? MG.GAMES[S.game].name : 'Bedwars') + (e ? ' · ' + e.nick : ''); }
  $('watchLeave').onclick = function () { send({ t: 'leave' }); };
  $('watchNext').onclick = function () {
    var list = []; S.ents.forEach(function (e) { if (!e.dead && !e.elim) list.push(e.id); });
    if (!list.length) return; var i = list.indexOf(S.specId); S.specId = list[(i + 1) % list.length]; watchTxt(); SC.sfx('click');
  };
  function drawHubAvatar() {
    var x = $('hubCv').getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 96, 96);
    x.save(); x.translate(48, 86); x.scale(1.6, 1.6); A.drawGim(x, 0, 0, (S.hello && S.hello.look) || { skin: 'gim', body: '#3fa9ff' }, { t: 0, dir: 0, shadow: false }); x.restore();
  }
  function updateOnline() { if (S.screen !== 'hub') return; var o = S.online || {}; $('hubOnline').textContent = (S.x2 ? '✨ 2× SCROLLS · ' : '') + S.ents.size + ' in the hub' + (o.playing ? ' · ' + o.playing + ' in games' : '') + (S.motd ? ' · 📢 ' + S.motd : ''); }
  var testUsed = false;
  function testFromBuilder() {
    var id = qs.get('test'); if (!id || testUsed) return; testUsed = true;
    var g = qs.get('g') || 'bw';
    setTimeout(function () { S.lastQueue = { t: 'practice', game: g, mode: g === 'bw' ? 'solo' : g, diff: 'normal', map: id }; send(S.lastQueue); toast('🗺️ Test-playing your map…', 2000); }, 500);
  }
  function interactables() { return ((S.map && S.map.objs) || []).filter(function (o) { return o.act; }); }
  function objRange(o) { return (o.kind === 'portal' || o.kind === 'board' || o.kind === 'soon' ? 3.3 : 2.4) * T; }
  function nearObj() { if (!P || (S.screen !== 'hub' && S.screen !== 'wait')) return null; var best = null, bd = 1e9; interactables().forEach(function (o) { var d = Math.hypot(o.x - P.x, o.y - P.y); if (d < objRange(o) && d < bd) { bd = d; best = o; } }); return best; }
  function objUnderCursor() {
    var hit = null;
    interactables().forEach(function (o) {
      var w = o.kind === 'board' ? 110 : o.kind === 'portal' ? 58 : o.kind === 'soon' ? 60 : 28, top = o.kind === 'board' ? 214 : o.kind === 'portal' ? 170 : o.kind === 'soon' ? 76 : 96;
      if (Math.abs(mouse.wx - o.x) < w && mouse.wy < o.y + 18 && mouse.wy > o.y - top) hit = o;
    });
    return hit;
  }
  function objGame(o) { return o.game && o.game !== 'bedwars' ? o.game : 'bw'; }
  function openGameMenu(g) {
    var GM2 = MG.GAMES[g]; S.gmGame = g;
    $('gmIco').textContent = GM2.icon; $('gmTitle').textContent = GM2.name;
    $('gmDesc').innerHTML = esc(GM2.desc || 'The classic.') + ' <span class="tag2">' + esc(GM2.tag || (g === 'bw' ? '4 teams' : '')) + '</span>';
    var o = S.online || {}, inQ = g === 'bw' ? (o.solo || 0) + (o.duos || 0) + (o.squads || 0) : o[g] || 0, inG = o.inGame ? o.inGame[g] || 0 : 0;
    var extra2 = '';
    if (g === 'duel') { var rk4 = MG.rankOf(S.myElo); extra2 = ' · your rank: <b style="color:' + rk4.color + '">' + rk4.name + ' ' + S.myElo + '</b>'; }
    $('gmLive').innerHTML = (inQ ? '🟢 ' + inQ + ' waiting to play' : '') + (inQ && inG ? ' · ' : '') + (inG ? '🎮 ' + inG + ' in matches' : '') + ((inQ || inG) ? '' : '🤖 nobody waiting — bots fill in!') + extra2;
    $('gmPlay').innerHTML = g === 'bw'
      ? '<button class="btn green" data-gm="solo">▶ Solo</button><button class="btn green" data-gm="duos">▶ Duos</button><button class="btn green" data-gm="squads">▶ Squads</button>'
      : '<button class="btn green big" data-gm="' + esc(g) + '">▶ PLAY</button>';
    openModal('mGame');
  }
  $('gmPlay').addEventListener('click', function (e) {
    var b = e.target.closest('[data-gm]'); if (!b) return;
    var v = b.dataset.gm, g = S.gmGame;
    S.lastQueue = { t: 'quick', game: g, mode: g === 'bw' ? v : g }; send(S.lastQueue);
    closeModals(); SC.sfx('go'); toast('Joining ' + (g === 'bw' ? 'Bedwars ' + B.MODES[v].name : gname(g)) + '…', 1500);
  });
  $('gmPractice').onclick = function () { closeModals(); openPractice(S.gmGame); };
  $('gmPrivate').onclick = function () { closeModals(); openPrivate(S.gmGame); };
  $('gmHow').onclick = function () { closeModals(); openHelp(S.gmGame); };
  function objLabel(o) { var g = objGame(o), gn = g === 'bw' ? '' : ' · ' + gname(g); return o.act === 'skinshop' ? 'Skin Shop' : o.act === 'gmenu' ? 'Play ' + gname(g) + '!' : o.act === 'builder' ? 'Map Builder' : o.act === 'quick' ? (g === 'bw' ? 'Play ' + o.label.charAt(0) + o.label.slice(1).toLowerCase() : 'Play ' + gname(g)) : o.act === 'practice' ? 'Practice vs bots' + gn : o.act === 'private' ? 'Private room' + gn : o.act === 'how' ? 'How to play' + (g === 'bw' ? ' · Bedwars' : gn) : o.act === 'lb' ? 'Leaderboard' : o.act === 'casino' ? 'Go to the Casino' : 'Coming soon'; }
  function useObj(o) {
    SC.sfx('click');
    if (o.act === 'casino' && S.school) { toast('🏫 The casino is closed during School Mode — pick a game portal!', 2400); return; }
    var g = objGame(o);
    if (o.act === 'gmenu' && schoolLocked()) { toast('🔒 Portals are locked in School Mode — wait for your teacher’s vote!', 2400); return; }
    if (o.act === 'gmenu') { openGameMenu(g); }
    else if (o.act === 'builder') { if (S.mapper) location.href = '/arcade/builder'; else toast('🔒 Only Scrollreader11 can use the Map Builder — but his maps show up in every game!', 2600); }
    else if (o.act === 'quick') { S.lastQueue = { t: 'quick', game: g, mode: g === 'bw' ? o.mode : g }; send(S.lastQueue); toast('Joining ' + (g === 'bw' ? 'Bedwars ' + B.MODES[o.mode].name : gname(g)) + '…', 1500); }
    else if (o.act === 'practice') openPractice(g);
    else if (o.act === 'private') openPrivate(g);
    else if (o.act === 'skinshop') openSkinShop();
    else if (o.act === 'how') openHelp(g);
    else if (o.act === 'lb') { renderLb(); openModal('mLb'); }
    else if (o.act === 'casino') { toast('Heading to the casino…', 1500); D.burst('magic', P.x, P.y - 20, 20, '#ffd166'); setTimeout(function () { location.href = '/casino'; }, 350); }
    else if (o.act === 'soon') toast('🚧 A new game is coming to this island soon!', 2200);
  }
  // Click an NPC far away: walk there around obstacles (BFS over tiles).
  function findPathNear(o) {
    var m = S.map, start = Math.floor(P.y / T) * W + Math.floor(P.x / T), rng = objRange(o) * 0.75;
    var prev = new Int32Array(W * H).fill(-2), q = [start], qi = 0; prev[start] = -1;
    while (qi < q.length) {
      var i = q[qi++], x = i % W, y = (i / W) | 0;
      if (Math.hypot(x * T + T / 2 - o.x, y * T + T / 2 - o.y) < rng) { var path = []; while (i !== start && i >= 0) { path.push(i); i = prev[i]; } return path.reverse(); }
      for (var d = 0; d < 4; d++) {
        var nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (!B.inb(nx, ny)) continue; var j = ny * W + nx;
        if (prev[j] !== -2 || !B.floorAt(m, nx, ny) || B.solidAt(m, nx, ny)) continue;
        prev[j] = i; q.push(j);
      }
    }
    return null;
  }
  function walkToObj(o) { var path = findPathNear(o); if (!path) { toast('Can’t get there from here', 1200); return; } P.auto = { path: path, i: 0, o: o, t: now() }; }
  var lbTab = 'bw'; S.lb2 = {};
  function lbPick(g) {
    lbTab = g; if (g !== 'bw' && (!S.lb2[g] || g === 'quiz')) { send({ t: 'lb2', game: g }); }
    renderLb();
  }
  function renderLb() {
    var st = S.mystats || {};
    $('lbTabs').innerHTML = ['quiz', 'bw', 'ctf', 'spleef', 'hide', 'duel', 'murder', 'build'].map(function (g) { return '<button data-lbg="' + g + '"' + (g === lbTab ? ' class="on"' : '') + '>' + (g === 'quiz' ? '📝 QUIZ' : MG.GAMES[g].icon + ' ' + (MG.GAMES[g].short || 'BEDWARS')) + '</button>'; }).join('');
    var none = '<tr><td colspan="5" style="color:var(--mut)">No winners yet — be the first!</td></tr>';
    if (lbTab === 'bw') {
      var rows = S.lb || [];
      $('lbRows').innerHTML = '<tr><th>#</th><th>Player</th><th>Wins</th><th>Finals</th><th>Beds</th></tr>' + (rows.length ? rows.map(function (r, i) { return '<tr><td>' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</td><td>' + esc(r.nick) + '</td><td>' + r.wins + '</td><td>' + r.finals + '</td><td>' + r.beds + '</td></tr>'; }).join('') : none);
    } else if (lbTab === 'quiz') {
      var rq = S.lb2.quiz;
      $('lbRows').innerHTML = '<tr><th>#</th><th>Player</th><th>✅ Correct</th><th>Accuracy</th><th>🔥 Best streak</th></tr>' + (rq == null ? '<tr><td colspan="5" style="color:var(--mut)">Loading…</td></tr>' : rq.length ? rq.map(function (r, i) { return '<tr><td>' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</td><td>' + esc(r.nick) + '</td><td>' + r.w + '</td><td>' + (r.g ? Math.round(r.w / r.g * 100) : 0) + '%</td><td>' + r.x + '</td></tr>'; }).join('') : '<tr><td colspan="5" style="color:var(--mut)">No answers yet — play in School Mode!</td></tr>');
    } else if (lbTab === 'duel') {
      var rd = S.lb2.duel;
      $('lbRows').innerHTML = '<tr><th>#</th><th>Player</th><th>Rank</th><th>Rating</th><th>W – L</th></tr>' + (rd == null ? '<tr><td colspan="5" style="color:var(--mut)">Loading…</td></tr>' : rd.length ? rd.map(function (r, i) { var rk = MG.rankOf(r.r); return '<tr><td>' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</td><td>' + esc(r.nick) + '</td><td style="color:' + rk.color + ';font-weight:700">' + rk.name + '</td><td>' + r.r + '</td><td>' + r.w + ' – ' + r.l + '</td></tr>'; }).join('') : none);
    } else {
      var rg2 = S.lb2[lbTab], xl = { ctf: 'Captures', spleef: '🥇 Wins', hide: 'Finds', murder: 'Kills', build: '🥇 Wins' }[lbTab];
      $('lbRows').innerHTML = '<tr><th>#</th><th>Player</th><th>Wins</th><th>Games</th><th>' + xl + '</th></tr>' + (rg2 == null ? '<tr><td colspan="5" style="color:var(--mut)">Loading…</td></tr>' : rg2.length ? rg2.map(function (r, i) { return '<tr><td>' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</td><td>' + esc(r.nick) + '</td><td>' + r.w + '</td><td>' + r.g + '</td><td>' + r.x + '</td></tr>'; }).join('') : none);
    }
    $('lbMe').innerHTML = [['Wins', st.wins], ['Finals', st.finals], ['Beds', st.beds], ['Kills', st.kills], ['Games', st.games], ['📜 today', (st.earnedToday || 0) + '/' + (st.cap || 1500)]].map(function (x) { return '<div class="stat"><b>' + (x[1] || 0) + '</b><span>' + x[0] + '</span></div>'; }).join('');
  }
  function renderWait() {
    var r = S.room; if (!r || S.screen !== 'wait') return;
    var rg = r.game || 'bw', md = rg === 'bw' ? B.MODES[r.mode] : MG.GAMES[rg];
    $('wTitle').textContent = (r.kind === 'private' ? 'Private Room' : r.kind === 'practice' ? 'Practice' : 'Quick Play') + ' · ' + (rg === 'bw' ? 'Bedwars ' + (r.kind !== 'practice' && r.autoMode ? r.autoMode : md.name) : md.name);
    $('wCodeWrap').classList.toggle('hidden', !r.code); $('wCode').textContent = r.code || '';
    var host = r.kind === 'private' && r.host === r.you;
    $('wHost').classList.toggle('hidden', !host);
    if (host) { [].forEach.call($('hMode').children, function (b) { b.classList.toggle('on', b.dataset.v === r.mode); }); [].forEach.call($('hDiff').children, function (b) { b.classList.toggle('on', b.dataset.v === r.diff); }); }
    $('hMode').classList.add('hidden');
    if ($('hBots')) { $('hBots').textContent = r.bots === false ? '🤖 Bots: OFF' : '🤖 Bots: ON'; $('hBots').classList.toggle('green', r.bots !== false); $('hDiff').classList.toggle('hidden', r.bots === false); }
    var ms = $('hMap'), maps = r.maps || [];
    if (ms) { ms.classList.toggle('hidden', !host || !maps.length); if (host && maps.length) { var opts = '<option value="">🎲 Random map</option><option value="default">' + (rg === 'bw' ? 'Classic Bedwars map' : 'Classic ' + md.name + ' map') + '</option>' + maps.map(function (mp) { return '<option value="' + esc(mp.id) + '">🗺️ ' + esc(mp.name) + '</option>'; }).join(''); if (ms.dataset.k !== opts) { ms.innerHTML = opts; ms.dataset.k = opts; } ms.value = r.mapId || ''; } }
    if (!host && r.mapName) $('wHint').innerHTML += '<br>🗺️ Map: <b>' + esc(r.mapName) + '</b>';
    $('wHint').innerHTML = (rg !== 'bw' ? '<b>' + md.icon + ' ' + esc(md.desc) + '</b><br>' : '') + (r.kind === 'private' && (rg === 'bw' || rg === 'ctf') ? '🟥🟦 Stand on a colored pad to join that team' : r.kind === 'practice' ? '🤖 Bots are getting ready…' : '🤖 Empty slots get filled with bots');
    var html = '';
    if (rg === 'spleef' || rg === 'hide' || rg === 'duel' || rg === 'murder' || rg === 'build') {
      var row2 = ''; for (var k2 = 0; k2 < (r.slots || r.cap || 8); k2++) { var mm = r.members[k2]; row2 += mm ? '<span class="wp' + (mm.cid === r.you ? ' you' : '') + '">' + esc(mm.nick) + '</span>' : '<span class="wp bot">' + (r.bots === false ? '·' : '🤖') + '</span>'; }
      $('wRoster').innerHTML = '<div class="wt">' + row2 + '</div>' + (rg === 'hide' ? '<div class="whint">🎲 Seekers are picked at random when the round starts</div>' : rg === 'murder' ? '<div class="whint">🎲 The murderer and detective are secret!</div>' : '');
      r.members.forEach(function (m) { var e = S.ents.get(m.pid); if (e) e.team = rg === 'spleef' || rg === 'duel' ? m.team : -1; });
      updateWaitCount(); return;
    }
    for (var t = 0; t < (r.teams || 4); t++) {
      var mem = r.members.filter(function (m) { return m.team === t; }), row = '';
      for (var k = 0; k < Math.max(mem.length, r.slots || r.per); k++) row += mem[k] ? '<span class="wp' + (mem[k].cid === r.you ? ' you' : '') + '">' + esc(mem[k].nick) + '</span>' : '<span class="wp bot">' + (r.bots === false ? '·' : '🤖') + '</span>';
      html += '<div class="wt"><i style="background:' + teamCol(t) + '"></i>' + row + '</div>';
    }
    $('wRoster').innerHTML = html;
    r.members.forEach(function (m) { var e = S.ents.get(m.pid); if (e) e.team = m.team; if (m.pid === S.myId) S.team = m.team; });
    updateWaitCount();
  }
  function waitLeft() { var r = S.room; if (!r || !r.startIn) return -1; return Math.max(0, Math.ceil((r.startIn - (Date.now() - (r._at || Date.now()))) / 1000)); }
  function updateWaitCount() {
    var r = S.room; if (!r) return;
    var left = waitLeft();
    var n = r.members.length, cap = r.cap || r.per * 4;
    $('wCount').innerHTML = left >= 0 ? 'Starting in <b>' + left + '</b>' : r.kind === 'private' ? (r.host === r.you ? 'Start when you’re ready' : 'Waiting for the host…') : 'Waiting for players…';
    $('wPlayers').textContent = n + '/' + cap + ' players';
    if (left >= 0 && left <= 5 && left !== S.lastWaitBeep) { S.lastWaitBeep = left; if (left > 0) SC.sfx('count'); }
  }
  $('wLeave').onclick = function () { send({ t: 'leave' }); };
  if ($('hBots')) $('hBots').onclick = function () { var r = S.room; if (!r) return; send({ t: 'cfg', bots: r.bots === false }); SC.sfx('click'); };
  $('hStart').onclick = function () { send({ t: 'start' }); SC.sfx('go'); };
  $('wCopy').onclick = function () { var u = location.origin + '/arcade?room=' + (S.room && S.room.code); try { navigator.clipboard.writeText(u); toast('Invite link copied!', 1600); } catch (e) { toast(u, 4000); } };
  $('hubLb').onclick = function () { renderLb(); openModal('mLb'); };
  $('lbTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-lbg]'); if (b) { SC.sfx('click'); lbPick(b.dataset.lbg); } });
  $('hubHow').onclick = function () { openHelp(S.helpGame || 'bw'); };
  $('gHelp').onclick = function () { openHelp(S.game); };
  $('hubQc').onclick = $('wQc').onclick = function () { toggleQc(); };

  // ------------------------------------------------------------------ game start
  function startGame(m) {
    S.ended = null; closeShop(); closeModals(); if (window.BWV) BWV.reset();
    S.game = m.game || 'bw';
    ['bw', 'ctf', 'spleef', 'hide', 'duel', 'murder', 'build'].forEach(function (g) { document.body.classList.toggle('g-' + g, g === S.game); });
    document.body.classList.toggle('mg', isMini());
    if (m.cfg && MG.GAMES[S.game]) Object.assign(MG.GAMES[S.game], m.cfg);
    S.custom = m.custom || null;
    var map = m.custom ? MG.buildCustom(m.custom) : isMini() ? MG.genMap(S.game, m.seed) : B.genMap();
    m.blocks.forEach(function (b) { map.f[b[0]] = b[1]; map.fc[b[0]] = b[2]; map.w[b[0]] = b[3]; map.wc[b[0]] = b[4]; });
    m.beds.forEach(function (a, t) { if (!a && map.beds[t]) { map.beds[t].alive = false; map.obj[map.beds[t].foot] = 0; map.obj[map.beds[t].head] = 0; } });
    S.crk = {}; S.propWob = {}; S.radar = null; S.did = {};
    if (S.custom) setTimeout(function () { toast('🗺️ Map: <b>' + esc(S.custom.name) + '</b>' + (S.custom.author ? ' by ' + esc(S.custom.author) : ''), 2600, true); }, 600);
    if (S.game === 'spleef') { (m.sp || []).forEach(function (q) { map.L[q[0]][q[1]] = q[2]; if (q[2] === 2) S.crk[q[0] * NN + q[1]] = now(); }); S.sdAt = m.sdAt; S.spCv = null; }
    if (S.game === 'ctf') { S.flags = m.flags; S.score = m.score; S.endAt = m.endAt; S.pickups = m.pick || []; }
    if (S.game === 'hide') { S.seekAt = m.seekAt; S.endAt = m.endAt; S.phase = m.phase; }
    if (S.game === 'duel') { S.score = m.score || [0, 0]; S.endAt = m.endAt; }
    if (S.game === 'murder') { S.endAt = m.endAt; S.det = m.det || 0; S.mrole = m.mrole || ''; S.golds = new Map(); (m.golds || []).forEach(function (q) { S.golds.set(q[0], q[1]); }); }
    if (S.game === 'build') { S.phase = m.phase; S.theme = m.theme; S.buildEnd = m.buildEnd; S.plotOwners = m.plotOwners || []; S.votePlot = m.votePlot != null ? m.votePlot : -1; S.voted = false; S.bbSel = { lay: 'g', v: 1 }; (m.bb || []).forEach(function (q) { bbApplyLocal(q[0], q[1], q[2], q[3], map); }); }
    S.map = map; D.resetChunks();
    bbUISync();
    S.myId = m.you; S.team = m.team; S.mode = m.mode; S.kind = m.kind; S.code = m.code;
    offset = m.now - Date.now(); bestRtt = 1e9;
    S.goAt = m.goAt; S.teams = m.teams; S.tier = m.tier; S.tl = m.tl; S.qc = m.qc || S.qc;
    S.gens = map.gens.map(function (g, i) { return { g: g, n: (m.gens[i] || [0])[0], last: (m.gens[i] || [0, 0])[1] || snow(), every: 0 }; });
    S.ents = new Map(); S.projs = new Map(); S.tnts = new Map(); S.cracks = {}; S.placeAnim = {}; S.slashes = []; D.parts.length = 0; trails.length = 0;
    (m.tnts || []).forEach(function (x) { S.tnts.set(x[0], { x: x[1], y: x[2], at: x[3] }); });
    m.ents.forEach(function (o) { S.ents.set(o.id, mkEnt(o)); });
    S.en = -1; S.qz = null; closeQuiz(true);
    S.watching = !!m.watch;
    var me = S.ents.get(S.myId);
    if (S.watching) { var fst = null; S.ents.forEach(function (e) { if (!fst && !e.dead && !e.elim) fst = e; }); fst = fst || S.ents.values().next().value; S.specId = fst ? fst.id : 0; me = { x: fst ? fst.x : 36 * T, y: fst ? fst.y : 36 * T, dead: true, elim: true, z: 0 }; }
    $('watchBar').classList.toggle('hidden', !S.watching); watchTxt(); document.body.classList.toggle('watching', S.watching);
    P = newBody(me.x, me.y); P.dead = me.dead; P.z = me.z || 0;
    S.held = 'sword'; S.inv = {}; S.res = { iron: 0, gold: 0, dia: 0, em: 0 }; S.hp = 20; S.absorb = 0; S.god = false;
    S.dead = me.dead; S.elim = me.elim;
    cam.x = 36 * T; cam.y = 36 * T; cam.introFrom = { x: 36 * T, y: 36 * T };
    show('game');
    buildHud(); renderTeams(); updateHearts(); renderHotbar(); renderRes(true);
    $('death').classList.add('hidden');
    if (snow() < S.goAt) intro(); else { cam.x = P.x; cam.y = P.y; }
    miniBase = null;
    if (me.elim && !S.watching) showDeath(null, true);
    mgHudInit(); tutStart();
  }
  function intro() {
    var el = $('intro'), tm = B.TEAMS[S.team];
    el.classList.remove('hidden');
    var it = introText();
    el.innerHTML = '<div class="who">' + it[0] + '</div><div class="team" style="color:' + it[2] + '">' + it[1] + '</div><div class="goal">' + it[3] + '</div><div class="num" id="introNum"></div>';
    void tm;
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
    if (S.screen === 'loading') return;
    var ts = m.n;
    for (var k = 0; k < m.p.length; k++) {
      var a = m.p[k], e = S.ents.get(a[0]); if (!e) continue;
      var f = a[4];
      e.flags = f; e.hp = a[6];
      if (a.length > 7) { var x7 = a[7]; if (S.game === 'spleef') { if (e.id !== S.myId) e.z = x7 & 3; e.spFall = !!(x7 & 4); } else if (S.game === 'hide') e.prop = x7 ? MG.PROP_KINDS[x7 - 1] : ''; else if (S.game === 'ctf') e.carry = x7 ? x7 - 1 : -1; }
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
    if (m.fl) { S.flags = m.fl; S.score = m.sc || S.score; }
    if (m.e) m.e.forEach(onEvent);
  }
  function entPos(e) { return e.id === S.myId && P ? { x: P.x, y: P.y } : { x: e.x, y: e.y }; }
  function nameHtml(e) { return e ? '<b style="color:' + teamCol(e.team) + '">' + esc(e.nick) + '</b>' : '?'; }
  function onEvent(ev) {
    var k = ev[0], e, p, i;
    if (k === 'pj') { if (S.screen !== 'hub' && S.screen !== 'wait') return; var fresh = !S.ents.has(ev[1]); var ne = addSpacePlayer({ id: ev[1], nick: ev[2], look: ev[3], x: ev[4], y: ev[5], team: ev[6] }); if (fresh && ev[1] !== S.myId) { ne.x = ev[4]; ne.y = ev[5]; D.burst('magic', ev[4], ev[5] - 20, 10, '#c4b5fd'); } updateOnline(); return; }
    if (k === 'pl') { var le = S.ents.get(ev[1]); if (le && ev[1] !== S.myId && (S.screen === 'hub' || S.screen === 'wait')) { D.burst('smoke', le.x, le.y - 16, 6); S.ents.delete(ev[1]); updateOnline(); } return; }
    if (k === 'pt') { var te = S.ents.get(ev[1]); if (te) { te.team = ev[2]; D.ring(te.x, te.y, teamCol(ev[2]), 40, 0.5, 5); if (ev[1] === S.myId) { S.team = ev[2]; SC.sfx('pop'); toast('You joined the ' + tname(ev[2]) + ' team', 1400); } } return; }
    if (k === 'hop') { e = S.ents.get(ev[1]); if (e && e.id !== S.myId) e.hopT = now(); return; }
    if (k === 'sw') { e = S.ents.get(ev[1]); if (!e || e.id === S.myId) return; e.swingT = 0; e.swingDir = -(e.swingDir || 1); e.ang = ev[2] / 100; S.slashes.push({ x: e.x, y: e.y - 18, ang: e.ang, dir: e.swingDir, t0: now(), reach: e.held === 'kbstick' ? 66 : 58, owner: e.id }); sfxAt('swing', e.x, e.y); return; }
    if (k === 'hit') {
      e = S.ents.get(ev[1]); if (!e) return; p = entPos(e);
      var dmg = ev[2] / 10, crit = ev[3], att = ev[4], kind = ev[5];
      e.flashT = now(); e.bumpT = now();
      if (!dmg && (kind === 'punch' || kind === 'snow')) { D.burst(kind === 'snow' ? 'cube' : 'spark', p.x, p.y - 20, 8, kind === 'snow' ? '#f4f9ff' : '#ffffff', { speed: 140 }); if (e.id === S.myId) { S.shake = Math.max(S.shake, 5); SC.sfx('hurt'); } else sfxAt('hit', p.x, p.y); return; }
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
    if (k === 'ex') { S.tnts.forEach(function (tn, id) { if (Math.abs(tn.x - ev[1]) < 6 && Math.abs(tn.y - ev[2]) < 6) S.tnts.delete(id); }); return boom(ev[1], ev[2], ev[3], ev[4]); }
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
    if (mgEvent(k, ev)) return;
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
    if (kind === 'murder') { feed('💀 ' + nameHtml(e) + ' was found eliminated…', final); if (e.id === S.myId) { S.dead = true; if (P) P.dead = true; showDeath(null, final, kind); } return; }
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
    if (m.role != null && isMini()) { var mmr = S.ents.get(S.myId); S.team = m.role; if (mmr) { mmr.team = m.role; mmr.prop = m.prop; } }
    S.prop = m.prop; if (m.mr != null) S.mrole = m.mr; S.gold = m.gold | 0;
    if (m.en != null) { var wasEn = S.en; S.en = m.en; if (m.qz) S.qz = m.qz; quizHud(); if (wasEn === -1 && m.en >= 0) toast(S.game === 'bw' ? '🏫 School Mode: answer questions (G) to earn iron, gold, diamonds & energy — generators are off!' : '🏫 School Mode: walking uses ⚡ energy. Press G or tap Answer to earn more!', 4200); if (m.en === 0 && wasEn > 0 && !S.quizOpen && !S.ended) { toast('⚡ Out of energy! Answer questions to keep moving.', 2600); openQuiz(); } }
    S.hp = m.hp; S.absorb = m.absorb; S.inv = m.inv; S.res = m.res; S.sword = m.sword; S.armor = m.armor; S.pick = m.pick; S.stats = m.stats;
    S.dead = m.dead; S.elim = m.elim; if (m.dead && !m.elim) S.respawnAt = now() + m.respawn; S.speedUntil = now() + m.speed; S.slowUntil = now() + (m.slow || 0);
    var me = S.ents.get(S.myId); if (me) { me.sword = m.sword; me.armor = m.armor; me.pick = m.pick; }
    var hb = hotbarItems();
    if (hb.indexOf(S.held) < 0) { S.held = hb.indexOf(m.held) >= 0 ? m.held : hb[0]; }
    updateHearts(); renderHotbar(); renderRes(false, oldRes);
    if (!$('shop').classList.contains('hidden')) renderShop();
    void oldInv;
  }

  // ------------------------------------------------------------------ input
  var keys = {}, mouse = { x: innerWidth / 2, y: innerHeight / 2, wx: 0, wy: 0, l: false, r: false, lAt: 0 }, joy = { x: 0, y: 0, id: null };
  var MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'], lastTap = {};
  addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    var k = e.key.toLowerCase();
    if (S.quizOpen) { if (/^[1-4]$/.test(k)) quizPick(+k - 1); if (k === 'escape' || k === 'g') closeQuiz(); e.preventDefault(); return; }
    if (k === 'g' && S.screen === 'game' && S.en >= 0) { openQuiz(); return; }
    if (k === 'escape') { closeShop(); closeModals(); $('qcMenu').classList.add('hidden'); return; }
    if (S.screen !== 'game' && S.screen !== 'hub' && S.screen !== 'wait') return;
    if (anyModal()) return;
    if (k === 'tab') { e.preventDefault(); if (S.screen === 'game') showScore(true); return; }
    if (MOVE_KEYS.indexOf(k) >= 0 && !e.repeat) { if (now() - (lastTap[k] || 0) < 280) S.dblSprint = true; lastTap[k] = now(); }
    keys[k] = true;
    if (k === ' ') { e.preventDefault(); if (!e.repeat) doHop(); }
    if (S.screen === 'game') {
      if (/^[1-9]$/.test(k)) selectSlot(+k - 1);
      if (isMini() && mgKey(k)) return;
      if (k === 'e') { var n = nearNpc(); if (n) openShop(n.kind); else closeShop(); }
    } else if (k === 'e') { var o = nearObj(); if (o) useObj(o); }
    if (k === 'q') toggleQc();
    if (k === 'p') openSoc();
    if (k === 'v' && window.BWV && BWV.on) { BWV.setMuted(!BWV.muted); voiceSync(); toast(BWV.muted ? '🔇 Mic muted (press V to talk again)' : '🎙️ Mic on', 1300); }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k) >= 0) e.preventDefault();
  });
  addEventListener('keyup', function (e) { var k = e.key.toLowerCase(); keys[k] = false; if (k === 'tab') showScore(false); });
  addEventListener('blur', function () { keys = {}; mouse.l = mouse.r = false; });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; var ch = $('crosshair'); ch.style.left = e.clientX + 'px'; ch.style.top = e.clientY + 'px'; });
  cv.addEventListener('mousedown', function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY; screenToWorld();
    if (S.screen === 'hub' || S.screen === 'wait') {
      cv.focus(); if (e.button !== 0 || !P) return;
      var o = objUnderCursor();
      if (o) { if (Math.hypot(o.x - P.x, o.y - P.y) < objRange(o)) useObj(o); else walkToObj(o); return; }
      mouse.l = true; doSwing(); return;
    }
    if (S.screen !== 'game') return;
    cv.focus();
    if (e.button === 0) {
      mouse.l = true; mouse.lAt = now();
      var n = npcUnderCursor(); if (n && Math.hypot(n.x - P.x, n.y - P.y) < 3.2 * T) { mouse.l = false; openShop(n.kind); return; }
      primaryDown();
    }
    if (e.button === 2) { mouse.r = true; if (isMini() && mgSecondary()) { mouse.r = false; return; } tryPlace(true); }
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
    hold('tAtk', function () { if (S.screen !== 'game') { doSwing(); return; } if (isMini() && mgTouch('atk')) return; S.touchAtk = true; touchMineTick(); if (S.autoMine < 0) touchAim(); if (S.held === 'bow') primaryDown(); else { var h = S.held; if (h !== 'sword' && h !== 'kbstick' && h !== 'pick') S.held = 'sword', renderHotbar(), send({ t: 'sel', it: 'sword' }); primaryDown(); } mouse.l = true; }, function () { S.touchAtk = false; if (mouse.l) primaryUp(); mouse.l = false; });
    hold('tPlace', function () { if (S.screen === 'game' && isMini() && mgTouch('place')) return; S.touchPlace = true; }, function () { S.touchPlace = false; });
    hold('tUse', function () { if (S.screen === 'game' && isMini() && mgTouch('use')) return; var it = S.held; if (['fireball', 'tnt', 'gapple', 'pearl', 'egg', 'speed'].indexOf(it) < 0) { var hb = hotbarItems().filter(function (x) { return ['fireball', 'tnt', 'gapple', 'pearl', 'egg', 'speed'].indexOf(x) >= 0; }); if (!hb.length) { toast('No usable item — buy some at the shop!', 1600); return; } it = hb[0]; S.held = it; renderHotbar(); send({ t: 'sel', it: it }); } touchAim(); useHeld(); });
    cv.addEventListener('touchstart', function (e) {
      if ((S.screen === 'hub' || S.screen === 'wait') && P) {
        var t0 = e.changedTouches[0]; mouse.x = t0.clientX; mouse.y = t0.clientY; screenToWorld();
        var ho = objUnderCursor(); if (ho) { if (Math.hypot(ho.x - P.x, ho.y - P.y) < objRange(ho)) useObj(ho); else walkToObj(ho); }
        return;
      }
      if (S.screen !== 'game') return;
      var t = e.changedTouches[0]; mouse.x = t.clientX; mouse.y = t.clientY; screenToWorld();
      var n = npcUnderCursor(); if (n && Math.hypot(n.x - P.x, n.y - P.y) < 3.4 * T) { openShop(n.kind); return; }
      S.touchTarget = { x: mouse.wx, y: mouse.wy, until: now() + 2500 };
      var ti = cursorTile(), mt = ti >= 0 && B.mineTarget(S.map, ti);
      if (mt && mt.kind !== 'floor') { S.touchMine = ti; mouse.l = true; } else if (B.canPlace(S.map, ti, [])) tryPlace(true);
    }, { passive: true });
    cv.addEventListener('touchend', function () { if (S.touchMine != null) { S.touchMine = null; mouse.l = false; } }, { passive: true });
  }
  // Phones: the attack button mines whatever block/bed you're facing when nobody is in reach.
  function enemyInMelee() { var hit = false; S.ents.forEach(function (e) { if (!hit && e.team !== S.team && !e.dead && !e.elim && Math.hypot(e.x - P.x, e.y - P.y) < B.MELEE + 30) hit = true; }); return hit; }
  function autoMineTile() {
    if (!P || !S.map) return -1;
    var m = S.map, best = -1, bs = 1e9, px = Math.floor(P.x / T), py = Math.floor(P.y / T);
    for (var dy = -3; dy <= 3; dy++) for (var dx = -3; dx <= 3; dx++) {
      var tx = px + dx, ty = py + dy; if (!B.inb(tx, ty)) continue;
      var i = ty * W + tx;
      var blk = B.mineBlocker(m, P.x, P.y, i); if (blk >= 0) i = blk;
      var mt = B.mineTarget(m, i); if (!mt) continue;
      if (mt.kind === 'bed') { var bd = B.bedAt(m, i); if (!bd || bd.team === S.team) continue; }
      if (mt.kind === 'floor' && (m.fc[i] === S.team || (tx === px && ty === py))) continue; // never your own bridge
      tx = i % W; ty = (i / W) | 0;
      var cp = tcen(i), d = Math.hypot(cp.x - P.x, cp.y - P.y); if (d > B.REACH - 6) continue;
      var da = Math.abs(Math.atan2(cp.y - P.y, cp.x - P.x) - P.ang); if (da > Math.PI) da = TAU - da;
      if (da > 1.1 && d > 46) continue;
      var score = d + da * 70 + (mt.kind === 'bed' ? -40 : mt.kind === 'floor' ? 60 : 0);
      if (score < bs) { bs = score; best = i; }
    }
    return best;
  }
  var atkIcon = '';
  function touchMineTick() {
    if (!touch || S.screen !== 'game' || !P) return;
    if (S.game === 'spleef' || S.game === 'hide') { S.autoMine = -1; return; }
    S.autoMine = !P.dead && !S.dead && (S.held === 'sword' || S.held === 'kbstick' || S.held === 'pick') && !enemyInMelee() ? autoMineTile() : -1;
    var ic = S.autoMine >= 0 ? '⛏️' : '⚔️';
    if (ic !== atkIcon) { atkIcon = ic; $('tAtk').textContent = ic; }
  }
  function touchAim() {
    if (!P) return;
    var best = null, bd = 150;
    S.ents.forEach(function (e) { if (e.team === S.team || e.dead || e.elim) return; var d = Math.hypot(e.x - P.x, e.y - P.y); if (d < bd) { bd = d; best = e; } });
    if (best) P.ang = Math.atan2(best.y - P.y, best.x - P.x);
    else if (S.touchTarget && now() < S.touchTarget.until) P.ang = Math.atan2(S.touchTarget.y - (P.y - 16), S.touchTarget.x - P.x);
  }

  function hotbarItems() { return isMini() ? MG.hotbar(S.game, S.inv || {}, S.game === 'murder' ? S.mrole : S.team) : B.hotbar(Object.assign({}, S.inv, { pick: S.pick })); }
  function selectSlot(i) { var hb = hotbarItems(); if (i < 0 || i >= hb.length) return; if (S.held !== hb[i]) { S.held = hb[i]; send({ t: 'sel', it: S.held }); SC.sfx('click'); renderHotbar(); flashHeldName(); } }
  var heldNameT = 0;
  function flashHeldName() { var it = S.held, nm = it === 'sword' ? B.SWORDS[S.sword || 1].name : it === 'pick' ? B.PICKS[S.pick].name : B.ITEM_NAMES[it]; var n = S.inv[it]; $('heldName').textContent = nm + (n > 1 && it !== 'bow' ? ' ×' + n : it === 'bow' ? ' · ' + (S.inv.arrows || 0) + ' arrows' : ''); $('heldName').style.opacity = 1; clearTimeout(heldNameT); heldNameT = setTimeout(function () { $('heldName').style.opacity = 0; }, 1600); }

  var swingCd = 0, mineSendT = 0, placeT = 0, lastPlaceTile = -1, bowStart = 0;
  function primaryDown() {
    if (!canAct()) return;
    var it = S.held;
    if (isMini() && mgPrimary(it)) return;
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
  function hopFalling() { var u = (now() - P.hopT) / HOP_MS; return u > 0.3 && u < 1.35; }
  function doSwing(force) {
    var t = now(); if (t < swingCd || !P) return;
    swingCd = t + (S.held === 'kbstick' ? 300 : 110);
    S.lastHoldSwing = t;
    var me = S.ents.get(S.myId); if (!me) return;
    me.swingT = 0; me.swingDir = -(me.swingDir || 1);
    var crit = hopFalling();
    S.slashes.push({ x: P.x, y: P.y - 18, ang: P.ang, dir: me.swingDir, t0: t, reach: S.held === 'kbstick' ? 66 : 58, owner: S.myId, mine: true, crit: crit });
    SC.sfx('swing');
    send({ t: 'sw', a: Math.round(P.ang * 100), j: crit ? 1 : 0 });
    void force;
  }
  var HOP_MS = 460;
  function doHop() {
    if (!P || P.dead || P.falling || anyModal()) return;
    if (S.screen === 'game' && snow() < S.goAt) return;
    if (now() - P.hopT < (S.game === 'spleef' && S.screen === 'game' ? 960 : HOP_MS + 60)) return;
    P.hopT = now(); send({ t: 'hop' }); S.did.hop = true;
    SC.sfxTone(330, 0.09, 'sine', 0.08, 0, 520);
    D.burst('dust', P.x, P.y, 3);
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
    send({ t: 'pl', i: i, b: key }); S.did.place = true;
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
    if (window.SHMusic) SHMusic.want(S.screen === 'hub' || S.screen === 'wait' ? 'lobby' : null);
    screenToWorld();
    if (!P) return;
    var me = S.ents.get(S.myId);
    var inGame = S.screen === 'game';
    var locked = S.frozen || (inGame && snow() < S.goAt) || S.screen === 'end' || S.screen === 'loading' || anyModal() || (inGame && S.game === 'hide' && S.team === 1 && snow() < S.seekAt);
    if (me) me.hopT = P.hopT;
    if (!P.dead && !S.dead && !P.falling && !locked) {
      var ix = 0, iy = 0;
      if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1; if (keys.w || keys.arrowup) iy -= 1; if (keys.s || keys.arrowdown) iy += 1;
      if (touch && (joy.x || joy.y)) { ix = joy.x; iy = joy.y; }
      if (ix || iy) P.auto = null;
      if (P.auto) { // walking to an NPC you clicked
        var ao = P.auto.o;
        if (ao && Math.hypot(ao.x - P.x, ao.y - P.y) < objRange(ao) * 0.8) { P.auto = null; useObj(ao); }
        else if (now() - P.auto.t > 12000 || P.auto.i >= P.auto.path.length) { P.auto = null; if (ao && Math.hypot(ao.x - P.x, ao.y - P.y) < objRange(ao)) useObj(ao); }
        else {
          var wp = tcen(P.auto.path[P.auto.i]), adx = wp.x - P.x, ady = wp.y - P.y, ad = Math.hypot(adx, ady);
          if (ad < 10) P.auto.i++; else { ix = adx / ad; iy = ady / ad; }
        }
      }
      if (inGame && (S.quizOpen || S.en === 0)) { ix = 0; iy = 0; } // School mode: no energy (or answering) = no walking
      var il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
      if (il < 0.1) S.dblSprint = false;
      // Minecraft-style sprinting: hold Shift/Ctrl, double-tap a direction, or push the joystick all the way.
      P.sprint = il > 0.1 && !bowStart && (keys.shift || keys.control || S.dblSprint || (touch && il > 0.93)) && !(inGame && now() < S.slowUntil);
      var sp = B.SPEED * (P.sprint ? 1.3 : 1) * (now() < S.speedUntil ? 1.35 : 1) * (now() < S.slowUntil ? 0.55 : 1) * (bowStart ? 0.6 : 1);
      var acc = 1 - Math.exp(-(il > 0.1 ? 16 : 22) * dt);
      P.cvx += (ix * sp - P.cvx) * acc; P.cvy += (iy * sp - P.cvy) * acc;
      var kbOn = Math.hypot(P.vx, P.vy) > 60;
      var res = B.move(S.map, P, P.cvx * dt + P.vx * dt, P.cvy * dt + P.vy * dt, !kbOn && !(inGame && S.god) && !(inGame && S.game === 'spleef'));
      if (res.bx) P.cvx = 0; if (res.by) P.cvy = 0;
      var kd = Math.exp(-6.5 * dt); P.vx *= kd; P.vy *= kd; if (Math.hypot(P.vx, P.vy) < 4) P.vx = P.vy = 0;
      P.mv = Math.hypot(P.cvx, P.cvy) > 25;
      // aim
      if (touch) { if (il > 0.2 && (!S.touchAtk || S.autoMine >= 0)) P.ang = Math.atan2(iy, ix); if (S.touchAtk && S.autoMine < 0) touchAim(); }
      else P.ang = Math.atan2(mouse.wy - (P.y - 16), mouse.wx - P.x);
      // fell?
      if (inGame && S.game === 'build' && S.phase === 'build' && S.map.plots) {
        var pl2 = S.map.plots[S.team];
        if (pl2) { P.x = clamp(P.x, (pl2.x0 - 1) * T + 14, (pl2.x1 + 2) * T - 14); P.y = clamp(P.y, (pl2.y0 - 1) * T + 14, (pl2.y1 + 2) * T - 14); }
      }
      if (inGame && S.game === 'spleef') {
        var air = now() - P.hopT < HOP_MS;
        if (!air && !MG.spFloor(S.map, P.z || 0, P.x, P.y)) { P.noF = (P.noF || 0) + dt; if (P.noF > 0.1) { P.noF = 0; P.falling = now(); P.fallX = P.x; P.fallY = P.y; SC.sfx('fall'); } } else P.noF = 0;
      } else if (inGame && !S.god && !B.groundUnder(S.map, P.x, P.y)) { P.falling = now(); P.fallX = P.x; P.fallY = P.y; SC.sfx('fall'); }
      // Prop Hunt: standing still lines a hider up with the grid, just like a real prop
      if (inGame && S.game === 'hide' && S.team === 0 && il < 0.1 && Math.hypot(P.vx, P.vy) < 5) {
        P.idleT = (P.idleT || 0) + dt;
        if (P.idleT > 0.4) { var scx = Math.floor(P.x / T) * T + T / 2, scy = Math.floor(P.y / T) * T + T / 2; if (!B.hits(S.map, scx, scy, false)) { P.x += (scx - P.x) * Math.min(1, dt * 8); P.y += (scy - P.y) * Math.min(1, dt * 8); } }
      } else P.idleT = 0;
      // holding the mouse outside a match just keeps swinging (for fun)
      if (!inGame && mouse.l && now() - (S.lastHoldSwing || 0) > 260) doSwing();
      // held actions
      if (inGame && mouse.l && canAct() && isMini() && mgHold(S.held)) { /* handled */ }
      else if (inGame && mouse.l && canAct()) {
        var it = S.held;
        if (it === 'sword' || it === 'kbstick' || it === 'pick') {
          var ti = S.touchMine != null ? S.touchMine : touch ? (S.touchAtk ? S.autoMine : -1) : cursorTile();
          if (ti >= 0) { var blk = B.mineBlocker(S.map, P.x, P.y, ti); if (blk >= 0) ti = blk; }
          var mt = ti >= 0 ? B.mineTarget(S.map, ti) : null;
          if (mt && mt.kind === 'floor' && it !== 'pick' && !(touch && S.touchAtk)) mt = null;
          if (mt && mt.kind === 'bed') { var bd = B.bedAt(S.map, ti); if (bd && bd.team === S.team) mt = null; }
          var cp = ti >= 0 ? tcen(ti) : null;
          if (mt && cp && Math.hypot(cp.x - P.x, cp.y - P.y) <= B.REACH) {
            if (now() > mineSendT) { mineSendT = now() + 100; send({ t: 'mine', i: ti }); }
            S.mining = ti; if (touch) P.ang = Math.atan2(cp.y - P.y, cp.x - P.x);
            if (it !== 'pick' && now() - (S.lastHoldSwing || 0) > 260) doSwing();
          } else { S.mining = -1; if ((it !== 'pick' || !mt) && now() - (S.lastHoldSwing || 0) > 260) doSwing(); }
        }
      } else S.mining = -1;
      // Placing: hold right click (or left with a block, or the touch button) and walk to bridge.
      var placing = inGame && (mouse.r || (mouse.l && B.BLOCK_OF[S.held]) || (touch && S.touchPlace));
      if (placing && now() - placeT > 95) {
        var placed = false;
        if (il > 0.2) { var ft = walkFrontTile(ix, iy); if (ft >= 0 && B.canPlace(S.map, ft, []) === 'floor') placed = tryPlace(false, true, ft); }
        if (!placed && !touch) { var ct = cursorTile(); if (ct !== lastPlaceTile) tryPlace(false, il > 0.2, ct); }
        if (!placed && touch && S.touchPlace && now() - placeT > 220) tryPlace(false, false, frontTile());
      }
      // footsteps (sprinting kicks up more dust)
      if (P.mv && t - (P.stepT || 0) > (P.sprint ? 0.13 : 0.24)) { P.stepT = t; D.burst('dust', P.x, P.y, P.sprint ? 2 : 1); if (me && me.look && me.look.trail) A.spawnTrail(trails, me.look.trail, P.x, P.y, t); }
    } else if (P) { P.cvx = P.cvy = 0; P.mv = false; P.sprint = false; }
    if (P.falling && S.game === 'spleef' && S.screen === 'game' && now() - P.falling > 1700 && !S.dead) P.falling = 0; // the server said we didn't fall
    // send state 20 Hz
    if (wsOpen && !locked && now() - P.lastSend > (inGame ? 50 : 90) && !P.dead) {
      P.lastSend = now();
      send({ t: 'mv', x: Math.round(P.x * 10) / 10, y: Math.round(P.y * 10) / 10, a: Math.round(P.ang * 100), m: P.sprint && P.mv ? 2 : P.mv ? 1 : 0, b: bowStart ? 1 : 0 });
    }
    if (me) { me.x = P.x; me.y = P.y; me.ang = P.ang; me.held = S.held; me.bowing = !!bowStart; me.bowT = bowStart ? (now() - bowStart) / 900 : 0; me.mining = S.mining >= 0 && S.held === 'pick'; me.moving = P.mv; if (P.mv) me.walk += dt * 10; }
    // remote interpolation
    var rt = snow() - (inGame ? 110 : 170);
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
    if (!touch && target === P && (S.screen === 'game' || S.screen === 'hub' || S.screen === 'wait')) { lead.x = clamp((mouse.wx - P.x) * 0.14, -120, 120); lead.y = clamp((mouse.wy - P.y) * 0.14, -90, 90); }
    var k2 = 1 - Math.exp(-(snow() < S.goAt ? 1.6 : 7) * dt);
    if (snow() < S.goAt && snow() < S.goAt - 2600) k2 = 0.004;
    cam.x += (target.x + lead.x - cam.x) * k2; cam.y += (target.y - 20 + lead.y - cam.y) * k2;
    // proximity voice: volume/pan from where everyone stands
    if (window.BWV && BWV.hearing) BWV.tick(listener.x, listener.y, function (id) { if (id >= 2000000000) return { x: listener.x, y: listener.y }; var e = S.ents.get(id); if (!e || e.dead || e.id === S.myId) return null; return { x: e.x, y: e.y }; });
    if (window.BWV && BWV.on && BWV.talking !== S.wasTalking) { S.wasTalking = BWV.talking; voiceSync(); }
    // HUD timers
    hudTick(); spaceTick(); touchMineTick();
  }


  // School Mode: portals get chained shut with a padlock (the teacher starts games with a vote)
  function schoolLocked() { return !!S.school; }
  function drawLock(c, o, t) {
    var px = o.x, py = o.y + 14 - 62;
    c.save();
    c.fillStyle = 'rgba(12,8,30,.55)'; c.beginPath(); c.ellipse(px, py, 38, 56, 0, 0, Math.PI * 2); c.fill();
    // two crossed chains
    [[-1, 1], [1, 1]].forEach(function (d) {
      for (var k = -5; k <= 5; k++) {
        var cx = px + k * 7.5 * d[0], cy = py + k * 9.5;
        c.save(); c.translate(cx, cy); c.rotate(Math.atan2(9.5, 7.5 * d[0]) + (k % 2 ? Math.PI / 2 : 0));
        c.strokeStyle = '#2b2f3f'; c.lineWidth = 6; c.beginPath(); c.ellipse(0, 0, 6, 3.6, 0, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#c9d1e3'; c.lineWidth = 2.6; c.beginPath(); c.ellipse(0, 0, 6, 3.6, 0, 0, Math.PI * 2); c.stroke();
        c.restore();
      }
    });
    // padlock (swings a little)
    c.translate(px, py + 6); c.rotate(Math.sin(t * 2) * 0.08);
    c.strokeStyle = '#1b1636'; c.lineWidth = 9; c.beginPath(); c.arc(0, -8, 11, Math.PI, 0); c.stroke();
    c.strokeStyle = '#c9d1e3'; c.lineWidth = 5; c.beginPath(); c.arc(0, -8, 11, Math.PI, 0); c.stroke();
    c.fillStyle = '#ffc93c'; c.strokeStyle = '#1b1636'; c.lineWidth = 3.5; c.beginPath(); c.roundRect ? c.roundRect(-17, -9, 34, 28, 6) : c.rect(-17, -9, 34, 28); c.fill(); c.stroke();
    c.fillStyle = '#b07d00'; c.fillRect(-15, 12, 30, 4);
    c.fillStyle = '#1b1636'; c.beginPath(); c.arc(0, 2, 4, 0, Math.PI * 2); c.fill(); c.fillRect(-1.6, 3, 3.2, 8);
    c.restore();
    c.save(); c.font = '700 13px Fredoka, sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#1b1636'; c.fillStyle = '#ffd166';
    c.strokeText('LOCKED', px, o.y + 14 + 22); c.fillText('LOCKED', px, o.y + 14 + 22); c.restore();
  }
  // Walk straight into a hub portal to start that game.
  function portalWalk() {
    if (!P || !S.map || !S.map.objs || anyModal()) return;
    var hit = null;
    S.map.objs.forEach(function (o) { if (o.kind === 'gport' && o.walk && Math.abs(P.x - o.x) < T * 1.25 && P.y > o.y - T * 0.9 && P.y < o.y + T * 1.1) hit = o; });
    if (!hit) { S.portLock = null; S.portIn = 0; return; }
    if (S.portLock === hit) return;
    if (schoolLocked()) { S.portLock = hit; toast('🔒 Portals are locked in School Mode — your teacher starts the next game with a vote!', 2600); SC.sfx('no'); return; }
    if (!S.portIn) { S.portIn = now(); SC.sfx('open'); D.burst('magic', P.x, P.y - 20, 14, D.GCOL[hit.game] || '#9b6bff'); toast('🌀 Entering ' + gname(objGame(hit)) + '…', 1200); }
    if (now() - S.portIn < 650) return;
    S.portLock = hit; S.portIn = 0;
    var g = objGame(hit), mode = g;
    if (g === 'bw') { var n = S.party && S.party.members ? S.party.members.length : 1; mode = n >= 3 ? 'squads' : n === 2 ? 'duos' : 'solo'; }
    S.lastQueue = { t: 'quick', game: g, mode: mode }; send(S.lastQueue);
    D.burst('magic', P.x, P.y - 20, 30, D.GCOL[g] || '#9b6bff'); SC.sfx('go');
    toast('Joining ' + (g === 'bw' ? 'Bedwars ' + B.MODES[mode].name : gname(g)) + '…' + (g === 'bw' ? ' (press E at a portal for other modes)' : ''), 2200);
  }
  function spaceTick() {
    if (S.screen !== 'hub' && S.screen !== 'wait') return;
    if (S.screen === 'hub') portalWalk();
    var o = nearObj(), pr = $('prompt');
    if (o && !anyModal()) { pr.classList.remove('hidden'); pr.textContent = (touch ? 'Tap · ' : 'E · ') + objLabel(o); } else pr.classList.add('hidden');
    if (S.screen === 'wait' && now() - (S.wcAt || 0) > 250) { S.wcAt = now(); updateWaitCount(); }
  }

  // ------------------------------------------------------------------ render
  var dpr = 1;
  function resize() { dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); }
  addEventListener('resize', resize); resize();
  function zoomFor() {
    var z = Math.min(innerWidth / 1060, innerHeight / 700);
    var inGame = S.screen === 'game' || S.screen === 'end';
    if (!inGame) z *= 0.92;
    if (inGame && snow() < S.goAt - 2600) z *= 0.55;
    else if (inGame && snow() < S.goAt) z *= 0.55 + 0.45 * D.ease.out(1 - (S.goAt - snow()) / 2600);
    if (P && P.sprint && P.mv) z *= 0.95; // Minecraft-ish FOV kick when sprinting
    return clamp(z, touch ? 0.58 : 0.62, 1.3);
  }
  var lastT = now(), T0 = now();
  function frame() {
    var tn = now(), dt = Math.min(0.05, (tn - lastT) / 1000); lastT = tn;
    var t = (tn - T0) / 1000;
    try { update(dt, t); render(dt, t); } catch (err) { console.error(err); }
    if (S.screen === 'end') drawPodium(t, dt);
    requestAnimationFrame(frame);
  }
  function render(dt, t) {
    var map = S.map; if (!map) { c.fillStyle = '#120c33'; c.fillRect(0, 0, cv.width, cv.height); return; }
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
    var vz = 0, spDrawn = null;
    if (S.game === 'spleef' && (S.screen === 'game' || S.screen === 'end')) { vz = viewZ(); spDrawn = drawSpleef(L, Tp, vw, vh, t, vz); }
    // under-layer particles (debris on the floor)
    D.drawParts(c, dt, 0); D.drawParts(c, dt, 1);
    A.drawParticles(c, trails, dt);
    // sorted drawables
    var list = [];
    for (y = ty0; y <= ty1; y++) for (x = tx0; x <= tx1; x++) { i = y * W + x; if (map.w[i]) list.push({ k: 'w', y: (y + 1) * T, i: i, x: x, ty: y }); else if (map.g[i] === B.G.ROCK) list.push({ k: 'rock', y: (y + 1) * T - 1, x: x * T + T / 2, by: (y + 1) * T - 4 }); }
    map.beds.forEach(function (b) { if (b.alive && b.x > L - 80 && b.x < L + vw + 80 && b.y > Tp - 80 && b.y < Tp + vh + 80) list.push({ k: 'bed', y: b.y + (b.dir[1] ? T * 0.5 : T * 0.2), b: b }); });
    S.gens.forEach(function (g, gi) { var gg = g.g; if (gg.x > L - 120 && gg.x < L + vw + 120 && gg.y > Tp - 140 && gg.y < Tp + vh + 80) list.push({ k: 'gen', y: gg.y + (gg.kind === 'iron' || gg.kind === 'gold' ? 12 : 10), g: g, gi: gi }); });
    map.npcs.forEach(function (n) { if (n.x > L - 80 && n.x < L + vw + 80 && n.y > Tp - 120 && n.y < Tp + vh + 80) list.push({ k: 'npc', y: n.y + 2, n: n }); });
    map.bases.forEach(function (b) { if (!b.flag) return; [b.flag, b.flag2].forEach(function (f) { var fx = f[0] * T + T / 2, fy = f[1] * T + T / 2; if (fx > L - 80 && fx < L + vw + 80 && fy > Tp - 120 && fy < Tp + vh + 60) list.push({ k: 'flag', y: fy, x: fx, team: b.team }); }); });
    S.tnts.forEach(function (tn, id) { if (snow() > tn.at + 1500) { S.tnts.delete(id); return; } list.push({ k: 'tnt', y: tn.y + 14, tn: tn }); });
    (map.objs || []).forEach(function (o) { if (o.x > L - 260 && o.x < L + vw + 260 && o.y > Tp - 60 && o.y < Tp + vh + 260) list.push({ k: 'obj', y: o.y + (o.kind === 'fountain' ? -6 : 4), o: o }); });
    if (map.props) map.props.forEach(function (pp) { if (pp.x > L - 60 && pp.x < L + vw + 60 && pp.y > Tp - 60 && pp.y < Tp + vh + 80) list.push({ k: 'prop', y: pp.y + 12, p: pp }); });
    if (S.game === 'ctf' && map.game === 'ctf') mgCtfDrawables(list, t);
    else if (S.game === 'murder') murderDrawables(list, t);
    else if (S.game === 'build') buildDrawables(list, t);
    var ents = Array.from(S.ents.values());
    ents.forEach(function (e) { if (spDrawn && ((e.id === S.myId ? (P.z || 0) : e.z || 0) !== vz)) return; if (e.x > L - 80 && e.x < L + vw + 80 && e.y > Tp - 120 && e.y < Tp + vh + 120) list.push({ k: 'ent', y: e.y, e: e }); });
    list.sort(function (a, b) { return a.y - b.y; });
    var inGame = S.screen === 'game' || S.screen === 'end';
    var near = inGame ? nearNpc() : nearObj();
    for (var q = 0; q < list.length; q++) {
      var d = list[q];
      if (d.k === 'w') { var pa2 = S.placeAnim[d.i], sc2 = pa2 ? D.ease.back(Math.min(1, (tnow - pa2) / 180)) : 1; D.wallBlock(c, map.w[d.i], map.wc[d.i], d.x * T, d.ty * T, sc2); if (S.cracks[d.i] != null) D.cracks(c, d.x * T, d.ty * T, S.cracks[d.i], D.WALLH); }
      else if (d.k === 'rock') D.rock(c, d.x, d.by, t);
      else if (d.k === 'obj') drawObj(d.o, t, near === d.o);
      else if (d.k === 'bed') { D.bed(c, d.b, t, inGame && d.b.team === S.team); [d.b.foot, d.b.head].forEach(function (bi) { if (S.cracks[bi] != null) D.cracks(c, (bi % W) * T, ((bi / W) | 0) * T, S.cracks[bi], 0); }); }
      else if (d.k === 'gen') { D.gen(c, d.g.g, d.g.n, t, genInfo(d.g)); }
      else if (d.k === 'npc') D.npc(c, d.n, t, near === d.n);
      else if (d.k === 'flag') D.flag(c, d.x, d.y, d.team, t);
      else if (d.k === 'tnt') D.tnt(c, d.tn.x, d.tn.y, (d.tn.at - snow()) / 1000, t);
      else if (d.k === 'ent') drawEnt(d.e, t);
      else if (d.k === 'prop') { var wb = S.propWob[d.p.id]; D.prop(c, d.p.kind, d.p.x, d.p.y + 12, t, { wob: wb && tnow - wb < 350 ? 1 - (tnow - wb) / 350 : 0, face: true }); }
      else if (d.k === 'fn') d.fn();
    }
    // floor cracks (bridge blocks)
    for (var ck in S.cracks) { ck = +ck; if (!map.w[ck] && map.f[ck] && map.obj[ck] !== 1) D.cracks(c, (ck % W) * T, ((ck / W) | 0) * T, S.cracks[ck], 0); }
    // target highlight
    if (S.screen === 'game' && P && !P.dead && !touch) drawTarget(t);
    if (S.screen === 'game' && touch && P && !P.dead && S.autoMine >= 0) { var am = S.autoMine, amk = S.map.w[am] ? 'wall' : 'floor'; D.tileCursor(c, (am % W) * T, ((am / W) | 0) * T, amk, true, t); }
    if (S.screen === 'wait') drawWaitHolo(t);
    if (isMini() && S.screen === 'game') mgWorldTop(t);
    if (S.season === 'xmas' && S.screen === 'hub' && S.map === S.hubMap) drawGarlands(t);
    // projectiles, slashes, top particles
    S.projs.forEach(function (p) { D.projectile(c, { kind: p.kind, x: p.x, y: p.y, vx: p.vx || 1, vy: p.vy }, t); });
    for (var s2 = S.slashes.length - 1; s2 >= 0; s2--) { var fx = S.slashes[s2]; if (fx.owner === S.myId && P) { fx.x = P.x; fx.y = P.y - 18; } else if (fx.owner) { var oe = S.ents.get(fx.owner); if (oe) { fx.x = oe.x; fx.y = oe.y - 18; } } if (!D.slash(c, fx, tnow)) S.slashes.splice(s2, 1); }
    drawFly(dt);
    D.drawParts(c, dt, 2);
    drawSpecial(dt);
    // name tags
    ents.forEach(function (e) { if (spDrawn && ((e.id === S.myId ? (P.z || 0) : e.z || 0) !== vz)) return; if (e.x > L - 80 && e.x < L + vw + 80 && e.y > Tp - 120 && e.y < Tp + vh + 120) drawTag(e, t); });
    // screen fx
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (isMini() && S.screen === 'game') mgScreen(t, z);
    if (S.season === 'xmas' && (S.screen === 'hub' || S.screen === 'wait' || S.screen === 'game' || S.screen === 'end')) drawSnow(dt, t);
    if (S.screen === 'game') {
      var hurt = Math.max(0, 1 - (tnow - S.hurtT) / 450), low = S.hp <= 6 && !S.dead ? (0.35 + Math.sin(t * 6) * 0.15) : 0;
      $('vign').style.opacity = Math.max(hurt, low);
    } else $('vign').style.opacity = 0;
    drawCrosshairState();
  }
  // ---------------------------------------------------------------- HOLIDAY SEASON
  function hubGen() { var m = B.genHub(); if (S.season === 'xmas') B.addXmas(m); return m; }
  function applySeason(v) {
    S.season = v || ''; D.season = S.season; A.season = S.season; document.body.classList.toggle('xmas', S.season === 'xmas');
    var wasHub = S.hubMap && S.map === S.hubMap; S.hubMap = null; if (D.resetChunks) D.resetChunks();
    if (wasHub) { S.hubMap = hubGen(); S.map = S.hubMap; }
    if (window.SHMusic) SHMusic.season(S.season);
  }
  var SNOW = [];
  function drawSnow(dt, t) {
    var w = innerWidth, h = innerHeight, want = S.screen === 'game' ? 60 : 150;
    while (SNOW.length < want) SNOW.push({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.6, s: 25 + Math.random() * 45, ph: Math.random() * 6.28, ccx: cam.x, ccy: cam.y });
    if (SNOW.length > want) SNOW.length = want;
    var dcx = cam.x - (drawSnow.cx == null ? cam.x : drawSnow.cx), dcy = cam.y - (drawSnow.cy == null ? cam.y : drawSnow.cy); drawSnow.cx = cam.x; drawSnow.cy = cam.y;
    if (Math.abs(dcx) > 200 || Math.abs(dcy) > 200) dcx = dcy = 0;
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (var i = 0; i < SNOW.length; i++) {
      var f = SNOW[i], par = 0.25 + f.r * 0.18;
      f.y += f.s * dt * (0.6 + f.r * 0.25) - dcy * par; f.x += Math.sin(t * 1.3 + f.ph) * 12 * dt - dcx * par;
      if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; } if (f.y < -6) f.y = h + 4;
      if (f.x > w + 5) f.x = -5; if (f.x < -6) f.x = w + 4;
      c.globalAlpha = 0.45 + f.r * 0.18; c.beginPath(); c.arc(f.x, f.y, f.r, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }
  function drawGarlands(t) {
    var T2 = B.T, cols = ['#ff4b5c', '#2bd576', '#ffd166', '#3fa9ff', '#ff6ec7'];
    B.XMAS_LIGHTS.forEach(function (row) {
      for (var k = 0; k < row.length - 1; k++) {
        var x1 = row[k][0] * T2 + T2 / 2, y1 = row[k][1] * T2 + T2 / 2 - 48, x2 = row[k + 1][0] * T2 + T2 / 2, y2 = row[k + 1][1] * T2 + T2 / 2 - 48;
        var len = Math.hypot(x2 - x1, y2 - y1), sag = Math.min(40, len * 0.12), n = Math.max(4, Math.round(len / 22));
        c.strokeStyle = '#1d3b24'; c.lineWidth = 2; c.beginPath();
        for (var j = 0; j <= 16; j++) { var u = j / 16, px = x1 + (x2 - x1) * u, py = y1 + (y2 - y1) * u + Math.sin(u * Math.PI) * sag; if (j) c.lineTo(px, py); else c.moveTo(px, py); }
        c.stroke();
        for (var b = 1; b < n; b++) {
          var u2 = b / n, bx = x1 + (x2 - x1) * u2, by = y1 + (y2 - y1) * u2 + Math.sin(u2 * Math.PI) * sag + 4, ci = (b + k * 3) % cols.length;
          var on = ((Math.floor(t * 2.5) + b) % 3) !== 0;
          c.fillStyle = cols[ci]; c.globalAlpha = on ? 1 : 0.35;
          if (on) { c.shadowColor = cols[ci]; c.shadowBlur = 10; }
          c.beginPath(); c.ellipse(bx, by, 3.2, 4.4, 0, 0, 6.2832); c.fill(); c.shadowBlur = 0; c.globalAlpha = 1;
        }
      }
    });
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
    if (S.game === 'spleef' && !dead) { var fu = e.id === S.myId ? (P && P.falling ? Math.min(1, (tn - P.falling) / 420) : -1) : e.spFall ? Math.min(1, (tn - (e.spFallT || tn)) / 420) : -1; falling = -1; if (fu >= 0) { sc = 1 - fu * 0.4; alpha = 1 - fu * 0.55; y += fu * 18; } }
    if (S.game === 'hide' && e.prop && !dead) { drawDisguised(e, x, y, t); if (S.reveal && S.owner && e.id !== S.myId) D.tag(c, '👁️ ' + e.nick, x, y - 50, { size: 11, color: '#fff', bg: '#c1121f' }); return; }
    if ((e.flags || 0) & 1024 && e.id !== S.myId) { if (!S.owner) return; alpha *= 0.35; }
    if ((e.flags || 0) & 2048) sc *= 1.65; else if ((e.flags || 0) & 4096) sc *= 0.58;
    if (falling >= 0) { if (e.fallX != null && e.id !== S.myId) { x = e.fallX; y = e.fallY; } else if (e.id === S.myId && P.fallX != null) { x = P.fallX; y = P.fallY; } sc = Math.max(0.05, 1 - falling * 0.95); rot = falling * 5; alpha = 1 - falling * 0.6; y += falling * 40; if (Math.random() < 0.4) D.burst('magic', x, y - 10, 1, '#3b2a8a'); }
    else if (dead) return;
    var ang = e.ang || 0, ca = Math.cos(ang), sa = Math.sin(ang);
    // 8-way facing: side profile only when mostly sideways; diagonals show a 3/4 turn of the front or back
    var dir = sa < -0.5 ? 3 : Math.abs(ca) > 0.86 ? (ca > 0 ? 2 : 1) : 0;
    var team = e.team, f = e.flags || 0, inGame = S.screen === 'game' || S.screen === 'end';
    var hu = (tn - (e.hopT || -9e9)) / HOP_MS, hz = hu >= 0 && hu < 1 ? Math.sin(hu * Math.PI) * 17 : 0;
    var bu = (tn - (e.bumpT || -9e9)) / 230; if (bu >= 0 && bu < 1) hz += Math.sin(bu * Math.PI) * 7;
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); c.scale(sc, sc); c.globalAlpha = alpha;
    // team ring under feet (stays on the ground when you jump)
    c.strokeStyle = team >= 0 ? teamCol(team) : 'rgba(255,255,255,.55)'; c.globalAlpha = alpha * 0.85; c.lineWidth = 3; A.ell(c, 0, 0, 19 - hz * 0.25, 7 - hz * 0.1); c.stroke(); c.globalAlpha = alpha;
    if (hz > 1) { c.fillStyle = 'rgba(10,6,30,.25)'; A.ell(c, 0, 1, 14, 5); c.fill(); }
    if (e.id === S.myId && P && P.sprint && P.mv) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; for (var sk = 0; sk < 2; sk++) { var sa2 = P.ang + Math.PI + (sk - 0.5) * 0.5; c.beginPath(); c.moveTo(Math.cos(sa2) * 18, -14 + Math.sin(sa2) * 8); c.lineTo(Math.cos(sa2) * 34, -14 + Math.sin(sa2) * 14); c.stroke(); } }
    c.translate(0, -hz);
    if (f & 32) { c.strokeStyle = 'rgba(125,211,252,.6)'; c.lineWidth = 2; for (var k = 0; k < 3; k++) { c.beginPath(); var ly = -10 - k * 9; c.moveTo(-ca * 26 - 6, ly); c.lineTo(-ca * 40 - 6, ly); c.stroke(); } }
    if (S.game === 'ctf' && e.carry >= 0) { D.flagBack(c, e.carry, t, e.moving); if (Math.random() < 0.3) D.burst('magic', x, y - 50, 1, teamCol(e.carry)); }
    var behind = sa < -0.35;
    var ee = { team: team, ang: ang, held: e.held, sword: e.sword, pick: e.pick, armor: e.armor, swingT: e.swingT, swingDir: e.swingDir, mining: e.mining, bowing: e.bowing, bowT: e.bowT, dead: false };
    if (behind) D.held(c, ee, 0, 0, t);
    var o = { t: t + e.id, dir: dir, side: dir === 0 || dir === 3 ? ca : null, moving: e.moving, walk: e.walk, lookAt: { x: ca, y: sa }, scale: 1 };
    var fl = Math.max(0, 1 - (tn - (e.flashT || -1e9)) / 160);
    o.shadow = hz < 1;
    if (fl > 0) D.gimFlash(c, 0, 0, e.look, o, 0.7 * fl, '255,40,40'); else A.drawGim(c, 0, 0, e.look, o);
    var bob = e.moving ? -Math.abs(Math.sin(e.walk || 0)) * 3.5 : Math.sin((t + e.id) * 2.2) * 0.8;
    if (inGame || team >= 0) D.armor(c, ee, 0, 0, t, bob);
    if (!behind) D.held(c, ee, 0, 0, t);
    if (f & 512) { var gp = (Math.sin(t * 5) + 1) / 2; c.strokeStyle = 'rgba(255,209,102,' + (0.5 + gp * 0.4) + ')'; c.lineWidth = 3; A.ell(c, 0, 4, 24, 9); c.stroke(); if (Math.random() < 0.15) D.burst('magic', x, y - 30, 1, '#ffd166'); }
    if (f & 64) { var pu = (Math.sin(t * 8) + 1) / 2; c.strokeStyle = 'rgba(180,230,255,' + (0.4 + pu * 0.4) + ')'; c.lineWidth = 3; A.circ(c, 0, -22, 30); c.stroke(); c.fillStyle = 'rgba(180,230,255,.12)'; c.fill(); }
    if ((f & 16) && Math.random() < 0.08) D.burst('heart', x, y - 40, 1);
    c.restore();
  }
  function drawObj(o, t, near) {
    var k = o.kind;
    if (k === 'npc') { var cnt = o.act === 'quick' && S.online ? (S.online[o.mode] || 0) + (o.game && o.game !== 'bedwars' && S.online.inGame ? S.online.inGame[o.game] || 0 : 0) : 0; D.hubNpc(c, o, t, near, cnt); }
    else if (k === 'deco') D.prop(c, o.what, o.x, o.y + 14, t, { face: true });
    else if (k === 'tree') D.tree(c, o.x, o.y, t);
    else if (k === 'lamp') D.lamp(c, o.x, o.y, t);
    else if (k === 'fountain') D.fountain(c, o.x, o.y, t);
    else if (k === 'sign') D.sign(c, o, t);
    else if (k === 'banner') D.banner(c, o, t);
    else if (k === 'portal') D.portal(c, o, t);
    else if (k === 'board') { var st = S.mystats || {}; D.board(c, o, t, S.lb, 'You: ' + (st.wins || 0) + ' wins · ' + (st.finals || 0) + ' finals'); }
    else if (k === 'soon') D.soon(c, o, t);
    else if (k === 'gport') { var gc3 = S.online && S.online.inGame ? (S.online.inGame[o.game] || 0) + (S.online[o.game === 'bw' ? 'solo' : o.game] || 0) : 0; D.gport(c, o, t, gc3); if (S.school) drawLock(c, o, t); }
    else if (k === 'podium') D.podium(c, o, t);
    else if (k === 'flag') D.flag(c, o.x, o.y + 14, o.team, t);
    else if (k === 'bedDeco') D.bed(c, { team: 0, x: o.x, y: o.y - T / 2, dir: [0, 1] }, t, false);
    if (near && k !== 'npc') { var ab = o.y - (k === 'board' ? 236 : k === 'portal' ? 206 : k === 'gport' ? 150 : 96) + Math.abs(Math.sin(t * 5)) * -8; c.beginPath(); c.moveTo(o.x - 9, ab); c.lineTo(o.x + 9, ab); c.lineTo(o.x, ab + 11); c.closePath(); c.fillStyle = '#ffd166'; c.fill(); c.strokeStyle = '#1b1636'; c.lineWidth = 2.5; c.stroke(); }
  }
  function drawWaitHolo(t) {
    var r = S.room; if (!r) return;
    var left = waitLeft(), x = 36 * T + T / 2, y = 29 * T - 10 + Math.sin(t * 2) * 4;
    D.tag(c, left >= 0 ? (left > 0 ? 'STARTING IN ' + left : 'GO!') : 'WAITING FOR PLAYERS', x, y, { size: 22, color: left >= 0 && left <= 5 ? '#ffd166' : '#fff', bg: 'rgba(20,16,50,.88)' });
    D.tag(c, r.members.length + '/' + (r.cap || r.per * 4) + ' players · ' + (r.game && r.game !== 'bw' ? gname(r.game) : 'Bedwars ' + B.MODES[r.mode].name), x, y + 30, { size: 13, color: '#cfc8ff' });
  }
  function drawTag(e, t) {
    var dead = e.dead || e.elim; if (dead) return;
    if (S.game === 'murder' && e.id === S.det) D.tag(c, '🕵️ DETECTIVE', e.x, e.y - 74, { size: 10, color: '#fff', bg: '#1d5fa8' });
    if ((e.flags || 0) & 1024 && e.id !== S.myId && !S.owner) return;
    if (S.game === 'hide' && S.screen === 'game' && e.prop) { if (S.team === 0 && e.id !== S.myId) D.tag(c, e.nick, e.x, e.y - 50, { size: 11, color: 'rgba(181,245,207,.85)' }); if (!(window.BWV && BWV.hearing && BWV.isTalking(e.id))) return; }
    var x = e.x, y = e.y; if (e.id === S.myId && P) { if (P.falling) return; x = P.x; y = P.y; }
    var mine = e.id === S.myId;
    if (window.BWV && BWV.hearing && (mine ? BWV.on && BWV.talking : BWV.isTalking(e.id))) {
      var vy = y - (S.screen === 'hub' || S.screen === 'wait' ? 96 : mine ? 70 : 96), pulse = (Math.sin(t * 14) + 1) / 2;
      A.circ(c, x, vy, 11); c.fillStyle = '#2bd576'; c.fill(); c.strokeStyle = '#1b1636'; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = '#05240f'; c.fillRect(x - 5, vy - 3, 4, 6); c.beginPath(); c.moveTo(x - 1, vy - 3); c.lineTo(x + 3, vy - 6); c.lineTo(x + 3, vy + 6); c.lineTo(x - 1, vy + 3); c.fill();
      c.strokeStyle = 'rgba(43,213,118,' + (0.4 + pulse * 0.6) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(x + 4, vy, 15, -0.7, 0.7); c.stroke();
    }
    if (S.screen === 'hub' || S.screen === 'wait') {
      D.tag(c, e.nick, x, y - 66, { size: 12, color: e.team >= 0 ? teamCol(e.team) : mine ? '#ffd166' : '#fff' });
    } else if (!mine) {
      var tag = (e.bot ? '🤖 ' : '') + e.nick + (e.dc ? ' (AFK)' : '');
      D.tag(c, tag, x, y - 72, { size: 12, color: teamCol(e.team) });
      var hp = clamp(e.hp / 20, 0, 1);
      if (S.game === 'spleef') return;
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
    if ((S.game === 'spleef' || S.game === 'hide') && mgTarget(t)) return;
    var it = S.held, ti = cursorTile(); if (ti < 0) return;
    var cp = tcen(ti), inR = Math.hypot(cp.x - P.x, cp.y - P.y) <= B.REACH;
    var m = S.map, x = (ti % W) * T, y = ((ti / W) | 0) * T;
    if (B.BLOCK_OF[it] || mouse.r) {
      var k = B.canPlace(m, ti, aliveBodies());
      if (k) D.tileCursor(c, x, y, k === 'wall' ? 'wall' : 'floor', inR, t);
    } else if (it === 'sword' || it === 'kbstick' || it === 'pick') {
      var blk = B.mineBlocker(m, P.x, P.y, ti); if (blk >= 0) { ti = blk; cp = tcen(ti); inR = Math.hypot(cp.x - P.x, cp.y - P.y) <= B.REACH; x = (ti % W) * T; y = ((ti / W) | 0) * T; }
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
    if (hb.indexOf(S.held) < 0) S.held = hb[0];
    $('hotbar').innerHTML = hb.map(function (it, i) {
      var icon = it === 'sword' ? 'sword' + S.sword : it === 'pick' ? 'pick' + Math.max(1, S.pick) : it;
      var n = it === 'bow' ? (S.inv.arrows || 0) : (it === 'sword' || it === 'pick' || it === 'kbstick' || it === 'shovel' || it === 'mask' || it === 'taunt' || it === 'radar' || it === 'fists' || it === 'knife') ? '' : (S.inv[it] || 0);
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
      var nx = isMini() ? null : B.TIMELINE[S.tl]; if (!isMini()) $('tmN').textContent = nx ? (nx.ev === 'end' ? 'Game ends' : nx.ev === 'beds' ? 'Beds break' : nx.ev.indexOf('dia') === 0 ? 'Diamond ' + (nx.ev === 'dia2' ? 'II' : 'III') : 'Emerald ' + (nx.ev === 'em2' ? 'II' : 'III')) + ' in ' + B.fmtTime(nx.t - el) : '';
      if (S.dead && !S.elim) { var left = Math.max(0, Math.ceil((S.respawnAt - now()) / 1000)); var cd = $('deathCd'); if (cd && cd.textContent !== String(left)) { cd.textContent = left || '…'; if (left > 0) SC.sfx('tick'); } }
    }
    if (isMini() && S.screen === 'game') { mgTimer(el); mgHudTick(); } else if (S.screen === 'game') tutTick();
    var n = isMini() ? null : nearNpc(); var pr = $('prompt');
    if (isMini() && S.screen === 'game' && mgPrompt(pr)) { /* shown */ } else
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
    if (isMini() && mgDeath(d, killer, final, kind)) return;
    if (final) {
      d.innerHTML = '<div class="big">ELIMINATED</div><div class="sub">' + (killer ? 'Final kill by <span style="color:' + teamCol(killer.team) + '">' + esc(killer.nick) + '</span>' : 'Your bed was gone — no more respawns') + '</div><div class="sub" style="font-size:15px;color:#cfc8ff">You’re spectating. Stick around or jump into a new game.</div><div class="flex" style="flex-wrap:wrap;justify-content:center"><button class="btn green" id="dAgain">▶ New game</button><button class="btn" id="dSpec">👀 Keep watching</button><button class="btn" id="dHub">🏠 Hub</button></div>';
      $('dAgain').onclick = playAgain; $('dSpec').onclick = function () { d.classList.add('hidden'); }; $('dHub').onclick = function () { send({ t: 'hub' }); };
    } else {
      d.innerHTML = '<div class="big">YOU DIED!</div><div class="sub">' + (killer ? (kind === 'void' ? 'Knocked into the void by ' : 'Killed by ') + '<span style="color:' + teamCol(killer.team) + '">' + esc(killer.nick) + '</span>' : kind === 'void' ? 'You fell into the void' : '') + '</div><div class="sub" style="margin:0">Respawning in</div><div class="cd" id="deathCd">5</div>';
      d.style.pointerEvents = 'none';
    }
    d.style.pointerEvents = final ? 'auto' : 'none';
  }
  function showScore(on) {
    var el = $('score'); if (!on) { el.classList.add('hidden'); return; }
    if (isMini()) { el.innerHTML = mgScore(); el.classList.remove('hidden'); return; }
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
  $('gLeave').onclick = function () { if (now() - leaveArm < 2500) { send({ t: 'leave' }); return; } leaveArm = now(); toast('Click 🚪 again to leave (a bot will take your place)', 2500); };

  // minimap
  var miniBase = null;
  function drawMini() {
    var mc = $('miniCv'), x = mc.getContext('2d'), m = S.map, s = mc.width / W;
    if (!miniBase) {
      miniBase = document.createElement('canvas'); miniBase.width = mc.width; miniBase.height = mc.height; var b = miniBase.getContext('2d');
      b.fillStyle = '#1a1446'; b.fillRect(0, 0, mc.width, mc.height);
      for (var i = 0; i < W * H; i++) { var g = m.g[i]; if (!g) continue; b.fillStyle = g === 1 ? '#5fbf4b' : g === 2 ? '#8d98ad' : g === 4 ? '#c9925a' : g === 6 ? '#b6bdcc' : g === 7 ? '#a7a2b8' : g === 8 ? '#b07b4f' : g === 9 ? '#eef6ff' : '#cfc6f0'; b.fillRect((i % W) * s, ((i / W) | 0) * s, s + 0.5, s + 0.5); }
    }
    x.drawImage(miniBase, 0, 0);
    if (m.L) { var LZ = m.L[viewZ()]; for (var li = 0; li < W * H; li++) if (LZ[li]) { x.fillStyle = LZ[li] === 2 ? '#ff9f6b' : D.SPC[MG.SP.kinds[viewZ()]].top; x.fillRect((li % W) * s, ((li / W) | 0) * s, s + 0.5, s + 0.5); } }
    if (S.game === 'ctf' && S.flags) S.flags.forEach(function (f, ft) { x.fillStyle = '#fff'; x.fillRect(f[2] / T * s - 5, f[3] / T * s - 5, 10, 10); x.fillStyle = teamCol(ft); x.fillRect(f[2] / T * s - 4, f[3] / T * s - 4, 8, 8); });
    for (var j = 0; j < W * H; j++) { if (m.w[j] || m.f[j]) { x.fillStyle = m.w[j] ? D.blockColor(m.w[j], m.wc[j]) : D.blockColor(m.f[j], m.fc[j]); x.fillRect((j % W) * s, ((j / W) | 0) * s, s + 0.5, s + 0.5); } }
    m.beds.forEach(function (bd) { if (!bd.alive) return; x.fillStyle = '#fff'; x.fillRect(bd.x / T * s - 4, bd.y / T * s - 4, 8, 8); x.fillStyle = teamCol(bd.team); x.fillRect(bd.x / T * s - 3, bd.y / T * s - 3, 6, 6); });
    S.gens.forEach(function (g) { if (g.g.team != null) return; x.fillStyle = g.g.kind === 'dia' ? '#5ff0e6' : '#2bd576'; x.beginPath(); x.arc(g.g.x / T * s, g.g.y / T * s, 3, 0, TAU); x.fill(); });
    S.ents.forEach(function (e) { if (e.dead || e.elim || e.id === S.myId) return; if (S.game === 'hide' && e.team === 0 && S.team !== 0) return; if (S.game === 'spleef' && (e.z || 0) !== viewZ()) return; x.fillStyle = teamCol(e.team); x.strokeStyle = '#120e2e'; x.lineWidth = 2; x.beginPath(); x.arc(e.x / T * s, e.y / T * s, 4, 0, TAU); x.fill(); x.stroke(); });
    if (P && !P.dead) { x.save(); x.translate(P.x / T * s, P.y / T * s); x.rotate(P.ang); x.fillStyle = '#fff'; x.strokeStyle = '#120e2e'; x.lineWidth = 2; x.beginPath(); x.moveTo(7, 0); x.lineTo(-5, -5); x.lineTo(-2, 0); x.lineTo(-5, 5); x.closePath(); x.fill(); x.stroke(); x.restore(); }
    var vw = innerWidth / cam.z / T * s, vh = innerHeight / cam.z / T * s;
    x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 1.5; x.strokeRect(cam.x / T * s - vw / 2, cam.y / T * s - vh / 2, vw, vh);
  }

  // ------------------------------------------------------------------ shop
  var shopKind = 'shop', shopCat = 'quick';
  function openShop(kind) {
    if (S.dead) return;
    shopKind = kind; S.did.shop = true; $('shop').classList.remove('hidden'); mouse.l = mouse.r = false; SC.sfx('open');
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
    if (m.watch) { $('watchBar').classList.add('hidden'); var wn = m.winner >= 0 ? (S.game === 'murder' ? (m.winner ? 'The murderer' : 'The innocents') : S.game === 'hide' ? (m.winner ? 'Seekers' : 'Hiders') : tname(m.winner) + ' team') + ' won!' : 'It’s a draw!'; banner('🏁 MATCH OVER', wn + ' Heading back to the hub…', '#9b6bff'); return; }
    var win = m.win != null ? m.win : m.winner === m.team;
    $('eTitle').textContent = win ? 'VICTORY!' : m.winner < 0 ? 'DRAW' : 'GAME OVER';
    $('eTitle').style.color = win ? '#ffd166' : '#ff5c6c';
    $('eSub').innerHTML = m.winner >= 0 ? '<span style="color:' + teamCol(m.winner) + '">' + tname(m.winner) + ' team</span> wins!' : 'Nobody wins this time';
    if (m.game && m.game !== 'bw') mgEndSub(m, win);
    var rw = m.reward;
    $('eReward').innerHTML = rw ? '+' + rw.give + ' 📜 Scrolls' + (rw.capped ? '<small>Daily Bedwars reward limit reached</small>' : '<small>' + ('Match length ' + B.fmtTime((m.mins || 0) * 60)) + '</small>') : '';
    $('eReward').classList.toggle('hidden', !rw);
    var st = m.stats.slice().sort(function (a, b) { return (b.finals * 3 + b.kills + b.beds * 4) - (a.finals * 3 + a.kills + a.beds * 4); });
    if (m.game && m.game !== 'bw') $('eTable').innerHTML = mgEndTable(m); else $('eTable').innerHTML = '<tr><th>#</th><th>Player</th><th>Kills</th><th>Finals</th><th>Beds</th><th>Deaths</th></tr>' + st.map(function (s, i) { return '<tr' + (s.id === m.you ? ' class="you"' : '') + '><td>' + (i + 1) + '</td><td><b style="color:' + teamCol(s.team) + '">' + (s.bot ? '🤖 ' : '') + esc(s.nick) + '</b></td><td>' + s.kills + '</td><td>' + s.finals + '</td><td>' + s.beds + '</td><td>' + s.deaths + '</td></tr>'; }).join('');
    if (m.quiz && m.quiz.length) $('eTable').innerHTML += '<tr><th colspan="6" style="padding-top:14px;color:#ffd166">📝 Quiz standings</th></tr><tr><th>#</th><th>Player</th><th>✅ Right</th><th>❌ Wrong</th><th>🔥 Best</th><th></th></tr>' + m.quiz.map(function (q, i) { return '<tr><td>' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</td><td>' + esc(q.nick) + '</td><td>' + q.right + '</td><td>' + q.wrong + '</td><td>' + q.best + '</td><td></td></tr>'; }).join('');
    closeQuiz(true); $('qHud').classList.add('hidden');
    podium = { team: m.winner, players: m.stats.filter(function (s) { return s.team === m.winner; }), conf: [], t0: now(), label: m.game === 'hide' ? (m.winner === 0 ? 'HIDERS' : 'SEEKERS') : m.game === 'spleef' ? 'LAST ONE STANDING' : null };
    if (m.game === 'hide') podium.team = m.winner === 0 ? 2 : 0;
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
    x.font = '700 28px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillText('🏆 ' + (podium.label || (podium.team >= 0 ? tname(podium.team).toUpperCase() + ' TEAM' : 'DRAW')), w / 2, top + 58);
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
  function playAgain() { $('death').classList.add('hidden'); var q = S.lastQueue && (S.lastQueue.game || 'bw') === S.game ? S.lastQueue : { t: 'quick', game: S.game, mode: S.game === 'bw' ? S.mode : S.game }; send(q); }
  $('eAgain').onclick = playAgain;
  $('eMenu').onclick = function () { send({ t: 'hub' }); };

  // ------------------------------------------------------------------ proximity voice button
  function voiceSync() {
    var V = window.BWV, label = !V || !V.on ? '🎙️ Talk' : V.muted ? '🔇 Muted' : V.talking ? '🎙️ Talking' : '🎙️ On';
    [].forEach.call(document.querySelectorAll('.voiceBtn'), function (b) {
      b.textContent = label;
      b.classList.toggle('von', !!(V && V.on && !V.muted)); b.classList.toggle('vmute', !!(V && V.on && V.muted)); b.classList.toggle('vtalk', !!(V && V.on && V.talking));
    });
  }
  [].forEach.call(document.querySelectorAll('.voiceBtn'), function (b) {
    b.onclick = function () {
      var V = window.BWV; if (!V) return;
      if (!V.supported()) { toast('Voice chat isn’t supported in this browser', 2200); return; }
      if (!V.on) {
        b.textContent = '🎙️ …';
        V.start(sendBin).then(function () { send({ t: 'vc', on: true }); voiceSync(); toast('🎙️ Mic on — players near you can hear you. V = mute', 2600); })
          .catch(function () { voiceSync(); toast('🎙️ Allow microphone access to use voice chat', 2600); SC.sfx('no'); });
      } else { V.setMuted(!V.muted); voiceSync(); toast(V.muted ? '🔇 Mic muted — you still hear people nearby' : '🎙️ Mic on', 1600); }
    };
  });

  // ------------------------------------------------------------------ owner panel
  var admTab = 'matches', admPoll = 0, admArm = null;
  function ownerSync() { [].forEach.call(document.querySelectorAll('.ownerBtn'), function (b) { b.classList.toggle('hidden', !S.owner && !S.teacher); b.textContent = S.owner ? '👑 Owner' : '🏫 Teacher'; b.title = S.owner ? 'Owner panel' : 'Teacher tools'; }); $('hubBuild').classList.toggle('hidden', !S.mapper); }
  [].forEach.call(document.querySelectorAll('.menuBtn'), function (b) { b.onclick = function () { var box = b.parentElement; box.classList.toggle('open'); b.textContent = box.classList.contains('open') ? '✕' : '☰'; SC.sfx('click'); }; });
  document.addEventListener('click', function (e) { if (e.target.closest('.menuBtn')) return; [].forEach.call(document.querySelectorAll('.hbtns.open,#hudBtns.open'), function (box) { if (e.target.closest('.hbtn') && box.contains(e.target)) { box.classList.remove('open'); var mb = box.querySelector('.menuBtn'); if (mb) mb.textContent = '☰'; } }); });
  $('hMap').onchange = function () { send({ t: 'cfg', map: this.value }); SC.sfx('click'); };
  [].forEach.call(document.querySelectorAll('.ownerBtn'), function (b) { b.onclick = function () { openAdmin(); }; });


  // ------------------------------------------------------------------ School mode quiz (Gimkit / Blooket style)
  S.en = -1;
  var QCOLS = ['#f0a531', '#4d7cff', '#5dcc6b', '#e8473b'];
  function quizHud() {
    if ($('schoolTag')) $('schoolTag').classList.toggle('hidden', !S.school || S.screen === 'game');
    var on = S.screen === 'game' && S.en >= 0;
    $('qHud').classList.toggle('hidden', !on);
    if (!on) return;
    var pct = Math.max(0, Math.min(100, S.en));
    $('qBar').style.width = pct + '%';
    $('qBar').style.background = S.en <= 15 ? '#ff4b5c' : S.en <= 40 ? '#ffd166' : '#2bd576';
    $('qEn').textContent = '⚡ ' + S.en;
    $('qHud').classList.toggle('empty', S.en === 0);
    var z = S.qz || {}; $('qSt').textContent = '✅ ' + (z.right || 0) + (z.streak ? '  🔥 ' + z.streak : '');
  }
  function openQuiz() {
    if (S.en < 0 || S.quizOpen) return;
    S.quizOpen = true; keys = {}; mouse.l = mouse.r = false;
    $('quiz').classList.remove('hidden'); $('qFeed').textContent = ''; $('qQ').textContent = 'Loading question…'; $('qGrid').innerHTML = '';
    send({ t: 'qz' }); SC.sfx('open');
  }
  function closeQuiz(silent) {
    if (!S.quizOpen) { if ($('quiz')) $('quiz').classList.add('hidden'); return; }
    S.quizOpen = false; clearTimeout(S.qNextT); $('quiz').classList.add('hidden'); if (!silent) SC.sfx('click');
  }
  function fitQ(el, txt) { el.textContent = txt; var n = txt.length; el.style.fontSize = n > 170 ? 'clamp(17px,2.6vw,28px)' : n > 110 ? 'clamp(19px,3vw,34px)' : 'clamp(22px,3.6vw,42px)'; }
  function showQuestion(m) {
    if (!S.quizOpen) return;
    S.qCur = m; S.qBusy = false; S.qShownAt = now();
    fitQ($('qQ'), m.q); $('qFeed').textContent = ''; $('qFeed').className = '';
    $('qSet').textContent = m.set || '';
    var g = $('qGrid'); g.innerHTML = '';
    m.choices.forEach(function (ch, i) {
      var b = document.createElement('button'); b.className = 'qopt'; b.style.background = QCOLS[i]; b.dataset.i = i;
      b.innerHTML = '<span class="qk">' + (i + 1) + '</span><span class="qt"></span>'; b.lastChild.textContent = ch;
      b.onclick = function () { quizPick(i); };
      g.appendChild(b);
    });
    if (m.en != null) { S.en = m.en; S.qz = m.qz; quizHud(); }
  }
  function quizPick(i) {
    if (!S.qCur || S.qBusy || now() - (S.qShownAt || 0) < 300) return;
    S.qBusy = true; S.qPick = i;
    [].forEach.call($('qGrid').children, function (b) { b.classList.add('lock'); });
    if (S.qMode === 'cq') send({ t: 'cqa', id: S.qCur.id, i: i }); else send({ t: 'qa', i: i });
  }
  function quizResult(m) {
    if (m.retry) { S.qBusy = false; [].forEach.call($('qGrid').children, function (b) { b.classList.remove('lock'); }); return; }
    var bs = $('qGrid').children;
    [].forEach.call(bs, function (b, k) { if (k === m.ans) b.classList.add('right'); else if (k === S.qPick && !m.ok) b.classList.add('wrong'); else b.classList.add('dim'); });
    var f = $('qFeed');
    if (m.ok) {
      var g = m.gain || {}, parts = [g.en > 0 ? '+' + g.en + ' ⚡' : '⚡ full'];
      if (g.iron) parts.push('+' + g.iron + ' iron'); if (g.gold) parts.push('+' + g.gold + ' gold'); if (g.dia) parts.push('+1 diamond 💎'); if (g.em) parts.push('+1 emerald 🟩'); if (g.speed) parts.push('speed boost ⚡');
      f.textContent = '✅ Correct!  ' + parts.join('  ·  ') + (m.qz.streak >= 2 ? '   🔥 ' + m.qz.streak + ' in a row' : ''); f.className = 'ok'; SC.sfx('level');
    } else { f.textContent = '❌ Not quite — the answer is highlighted.'; f.className = 'bad'; SC.sfx('no'); }
    if (m.en != null && m.en >= 0) { S.en = m.en; S.qz = m.qz; } quizHud();
    if (m.cq) { clearTimeout(S.qNextT); S.qNextT = setTimeout(function () { if (S.qMode === 'cq') closeQuiz(true); }, 2600); return; }
    // random pause before the next question so nobody can memorize a rhythm
    var wait = (m.ok ? 700 : 1700) + Math.random() * 900;
    clearTimeout(S.qNextT); S.qNextT = setTimeout(function () { if (S.quizOpen) send({ t: 'qz' }); }, wait);
  }
  $('qClose').onclick = function () { closeQuiz(); };
  $('qOpen').onclick = function () { openQuiz(); };


  // ------------------------------------------------------------------ Skin shop (in the games hub)
  var SH = { tab: 'skin', data: null, busy: false };
  var SH_TABS = [['skin', '🐾 Skins'], ['body', '🎨 Colors'], ['hat', '🎩 Hats'], ['acc', '✨ Accessories'], ['trail', '🌈 Trails']];
  var RAR = { common: '#9aa3b5', rare: '#3fa9ff', epic: '#b185ff', legendary: '#ffc93c', mythic: '#ff6ec7' };
  function shopFetch(cb) { fetch('/api/casino/me', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.profile) { SH.data = d; if (cb) cb(); } else $('shGrid').innerHTML = '<div class="sempty">' + esc((d && d.message) || 'Couldn’t load the shop.') + '</div>'; }).catch(function () { $('shGrid').innerHTML = '<div class="sempty">Couldn’t load the shop.</div>'; }); }
  function openSkinShop() { openModal('mShop2'); $('shGrid').innerHTML = '<div class="sempty">Opening the shop…</div>'; shopFetch(renderShop); SH.on = true; requestAnimationFrame(shopDraw); }
  function shopPost(path, body, cb) { fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(cb).catch(function () { toast('Couldn’t reach the shop', 1800); SH.busy = false; }); }
  function renderShop() {
    var d = SH.data; if (!d) return;
    var pr = d.profile, inv = pr.inventory || [], look = pr.look || {};
    $('shCoins').textContent = '📜 ' + (pr.coins || 0).toLocaleString();
    $('shSchool').classList.toggle('hidden', !d.school);
    $('shTabs').innerHTML = SH_TABS.map(function (tb) { return '<button data-sht="' + tb[0] + '"' + (SH.tab === tb[0] ? ' class="on"' : '') + '>' + tb[1] + '</button>'; }).join('');
    var items = d.store.filter(function (it) { return it.type === SH.tab; });
    items.sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
    $('shGrid').innerHTML = items.map(function (it) {
      var owned = it.price === 0 || inv.indexOf(it.id) >= 0, on = look[it.type] === it.id || (!look[it.type] && it.price === 0 && /gim$|sky$/.test(it.id));
      var btn = on ? '<button class="shb on" disabled>✓ Wearing</button>' : owned ? '<button class="shb eq" data-eq="' + it.id + '">Wear</button>' : '<button class="shb buy" data-buy="' + it.id + '"' + (pr.coins < it.price ? ' disabled' : '') + '>' + (it.was ? '<s>' + it.was.toLocaleString() + '</s> ' : '') + '📜 ' + it.price.toLocaleString() + '</button>';
      return '<div class="shc' + (on ? ' wearing' : '') + '" style="--r:' + (RAR[it.rarity] || '#9aa3b5') + '"><canvas width="220" height="200" data-it="' + it.id + '"></canvas><div class="shn">' + esc(it.label.replace(' (animated)', '')) + (/animated/.test(it.label) ? ' <span class="sha">✨</span>' : '') + '</div><div class="shr">' + esc(it.rarity || 'common') + '</div>' + btn + '</div>';
    }).join('') || '<div class="sempty">Nothing here yet.</div>';
  }
  function shopLook(it) { var d = SH.data, lv = (d && d.profile.lookValues) || (S.hello && S.hello.look) || {}; var lk = { skin: lv.skin || 'gim', body: lv.body || '#3fa9ff', hat: lv.hat || '', acc: lv.acc || '', trail: '' }; if (it) lk[it.type] = it.value; if (it && it.type !== 'trail') lk.trail = ''; return lk; }
  function shopDraw(ts) {
    if (!SH.on || $('mShop2').classList.contains('hidden')) { SH.on = false; return; }
    var t = ts / 1000, d = SH.data;
    if (d) [].forEach.call(document.querySelectorAll('#shGrid canvas'), function (cv) {
      var it = d.store.find(function (x) { return x.id === cv.dataset.it; }); if (!it) return;
      var c2 = cv.getContext('2d'); c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, cv.width, cv.height);
      var gl = c2.createRadialGradient(110, 120, 10, 110, 120, 110); gl.addColorStop(0, 'rgba(255,255,255,.14)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c2.fillStyle = gl; c2.fillRect(0, 0, 220, 200);
      if (it.type === 'trail') { cv._p = cv._p || []; if (Math.random() < 0.55) A.spawnTrail(cv._p, it.value, 110 + Math.sin(t * 2) * 40, 172, t); A.drawParticles(c2, cv._p, 1 / 60); }
      c2.save(); c2.translate(110 + (it.type === 'trail' ? Math.sin(t * 2) * 40 : 0), 176); c2.scale(2.1, 2.1);
      try { A.drawGim(c2, 0, 0, shopLook(it), { t: t + it.id.length, dir: 0, moving: it.type === 'trail', walk: t * 9, noSeason: true }); } catch (e) {}
      c2.restore();
    });
    requestAnimationFrame(shopDraw);
  }
  $('shTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-sht]'); if (!b) return; SH.tab = b.dataset.sht; renderShop(); SC.sfx('click'); });
  $('shGrid').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || SH.busy) return;
    var id = b.dataset.buy || b.dataset.eq; if (!id) return;
    SH.busy = true;
    var wear = function () { shopPost('/api/casino/equip', { itemId: id }, function (r) { SH.busy = false; if (r && r.profile) { SH.data.profile = r.profile; renderShop(); send({ t: 'look' }); SC.sfx('pop'); } }); };
    if (b.dataset.buy) shopPost('/api/casino/buy', { itemId: id }, function (r) {
      if (r && r.ok) { SH.data.profile = r.profile; SC.sfx('bigwin'); toast('🛍️ Bought! Putting it on…', 1500); wear(); }
      else { SH.busy = false; toast(r && r.error === 'broke' ? '📜 Not enough Scrolls yet — win games to earn more!' : 'Couldn’t buy that.', 2200); if (r && r.profile) { SH.data.profile = r.profile; renderShop(); } }
    }); else wear();
  });
  // ---- class question from the teacher (pops up for everyone, any screen)
  function openCq(m) {
    S.qMode = 'cq'; S.quizOpen = true; keys = {}; mouse.l = mouse.r = false;
    $('quiz').classList.remove('hidden');
    showQuestion({ q: m.q, choices: m.choices, set: '📣 Class question from ' + m.from + ' — everyone answers!' });
    S.qCur.id = m.id; SC.sfx('level');
    clearTimeout(S.cqT); S.cqT = setTimeout(function () { if (S.qMode === 'cq') closeQuiz(true); }, (m.secs || 45) * 1000);
  }
  // ---- class game vote (cards are little live scenes: each game's portal, with everyone who voted for it lined up in front)
  var VNAME = { bw: ['BED', 'WARS'], ctf: ['CAPTURE', 'FLAG'], spleef: ['TNT', 'SPLEEF'], hide: ['PROP', 'HUNT'], murder: ['MURDER', 'MYSTERY'], build: ['BUILD', 'BATTLE'], duel: ['', 'DUELS'] };
  var VGROUND = { bw: ['#5ccf62', '#52c45a'], ctf: ['#5ccf62', '#52c45a'], spleef: ['#cfe9ff', '#bfe0fb'], hide: ['#8fd16a', '#84c661'], murder: ['#b48a5a', '#a87f50'], build: ['#c8a46a', '#bd9a61'], duel: ['#9aa3b5', '#8e97aa'] };
  function onVote(m) {
    var box = $('voteBox');
    if (m.done) {
      clearInterval(S.voteIv);
      if (m.cancel) { box.classList.add('hidden'); S.voteOn = false; toast('🗳️ The vote was cancelled', 1800); return; }
      box.classList.add('done');
      [].forEach.call($('voteGrid').children, function (x) { x.classList.toggle('win', x.dataset.vg === m.winner); });
      $('voteTitle').innerHTML = '<b>' + (m.winner === 'bw' ? 'BEDWARS' : MG.GAMES[m.winner].name.toUpperCase()) + '</b> WINS!';
      $('voteTime').textContent = 'Get ready — everyone’s heading in…'; S.myVote = null; SC.sfx('bigwin');
      try { screenFx({ kind: 'confetti' }); } catch (e) {}
      setTimeout(function () { box.classList.add('hidden'); box.classList.remove('done'); S.voteOn = false; }, 2600); return;
    }
    if (box.classList.contains('hidden')) {
      box.classList.remove('hidden'); box.classList.remove('done'); S.myVote = null; SC.sfx('open'); closeModals(); closeQuiz(true);
      S.voteDur = Math.max(1000, m.left || 20000); S.voteOn = true; S.voteCards = null;
      $('voteTitle').innerHTML = 'PICK THE <b>NEXT GAME</b>';
      requestAnimationFrame(voteDraw);
    }
    S.voteEnd = now() + (m.left || 0); S.vote = m;
    var games = m.games || ['bw', 'ctf', 'spleef', 'hide', 'murder', 'build', 'duel'], top = 0;
    games.forEach(function (g) { top = Math.max(top, m.counts[g] || 0); });
    if (!S.voteCards || S.voteCards.join() !== games.join()) {
      S.voteCards = games.slice();
      $('voteGrid').innerHTML = games.map(function (g) {
        var nm = VNAME[g] || ['', g];
        return '<button class="vopt" data-vg="' + g + '" style="--c:' + (D.GCOL[g] || '#6c4dff') + '"><span class="sticker">YOUR VOTE ✓</span><span class="crown">👑</span><canvas width="460" height="300"></canvas><div class="vn">' + (nm[0] ? '<em>' + nm[0] + '</em> ' : '') + nm[1] + '</div><div class="vrow"><div class="vbar"><i style="width:0%"></i></div><div class="vc">0</div></div></button>';
      }).join('');
    }
    var total = Math.max(1, m.total || 1);
    [].forEach.call($('voteGrid').children, function (el) {
      var g = el.dataset.vg, n = m.counts[g] || 0;
      el.querySelector('.vbar i').style.width = Math.min(100, Math.round(n / total * 100)) + '%';
      var vc = el.querySelector('.vc'); if (vc.textContent !== String(n)) { vc.textContent = n; if (n) { vc.animate([{ transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 300 }); } }
      el.classList.toggle('lead', top > 0 && n === top);
      el.classList.toggle('mine', S.myVote === g);
    });
    clearInterval(S.voteIv); S.voteIv = setInterval(voteClock, 200); voteClock();
  }
  function voteClock() {
    var ms = Math.max(0, S.voteEnd - now()), l = Math.ceil(ms / 1000);
    $('vNum').textContent = l; $('vRing').setAttribute('stroke-dashoffset', String(194.8 * (1 - ms / (S.voteDur || 20000))));
    $('vRing').setAttribute('stroke', l <= 5 ? '#ff5c6c' : '#ffd166'); $('vClock').classList.toggle('hurry', l <= 5);
    var mv = S.myVote; $('voteTime').textContent = mv ? 'You voted ' + (mv === 'bw' ? 'Bedwars' : MG.GAMES[mv].name) + ' — tap another to switch' : 'Tap a game to vote!';
    if (l <= 3 && l > 0 && l !== S.voteTick) { S.voteTick = l; SC.sfx('click'); }
  }
  function voteDraw(ts) {
    if (!S.voteOn) return;
    var t = ts / 1000, m = S.vote || { voters: {} }, spawn0 = D.spawn; D.spawn = function () {};
    [].forEach.call($('voteGrid').children, function (el) {
      var cv = el.querySelector('canvas'); if (!cv) return;
      var c = cv.getContext('2d'), g = el.dataset.vg, W2 = cv.width, H2 = cv.height, gr = VGROUND[g] || VGROUND.bw, col = D.GCOL[g] || '#6c4dff';
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W2, H2);
      // sky glow + floor tiles like the hub
      var sky = c.createLinearGradient(0, 0, 0, H2 * 0.55); sky.addColorStop(0, '#120c33'); sky.addColorStop(1, col); c.fillStyle = sky; c.fillRect(0, 0, W2, H2);
      var ts2 = 46, oy = H2 * 0.48;
      for (var y = oy; y < H2; y += ts2) for (var x = -((t * 6) % ts2) - ts2; x < W2 + ts2; x += ts2) { c.fillStyle = ((Math.round(x / ts2) + Math.round(y / ts2)) & 1) ? gr[0] : gr[1]; c.fillRect(x, y, ts2 + 1, ts2 + 1); }
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, oy, W2, 6);
      // the portal itself (same art as the hub)
      c.save(); c.translate(W2 / 2, 0); c.scale(1.55, 1.55); try { D.gport(c, { x: 0, y: 128, game: g }, t); } catch (e) {} c.restore();
      // everyone who voted for it, queueing in front of the portal
      var vs = (m.voters && m.voters[g]) || [];
      vs.forEach(function (v, k) {
        var row = k < 6 ? 0 : 1, col2 = row ? k - 6 : k, n = Math.min(6, row ? vs.length - 6 : vs.length);
        var px = W2 / 2 + (col2 - (n - 1) / 2) * 70 + (row ? 35 : 0), py = H2 - 10 - (1 - row) * 0 - row * 44 + Math.sin(t * 6 + k) * 3;
        if (row) py = H2 - 58 + Math.sin(t * 6 + k) * 3;
        c.save(); c.translate(px, py); c.scale(1.55, 1.55); try { A.drawGim(c, 0, 0, v.l || { skin: 'gim', body: '#3fa9ff' }, { t: t + k, dir: 0, walk: 0 }); } catch (e) {} c.restore();
      });
      var extra = (m.counts && m.counts[g] || 0) - vs.length; if (extra > 0) { c.font = '700 30px Fredoka, sans-serif'; c.lineWidth = 6; c.strokeStyle = '#0b0920'; c.fillStyle = '#fff'; c.textAlign = 'right'; c.strokeText('+' + extra, W2 - 14, H2 - 14); c.fillText('+' + extra, W2 - 14, H2 - 14); }
    });
    D.spawn = spawn0;
    requestAnimationFrame(voteDraw);
  }
  $('voteGrid').addEventListener('click', function (e) { var b = e.target.closest('[data-vg]'); if (!b) return; if ($('voteBox').classList.contains('done')) return; S.myVote = b.dataset.vg; send({ t: 'vote', g: S.myVote }); SC.sfx('pop'); [].forEach.call($('voteGrid').children, function (x) { x.classList.toggle('mine', x === b); }); voteClock(); });
  // owner "power" screen effects
  function screenFx(m) {
    var cv = $('cv'), k = m.kind, ms = m.ms || 10000;
    function css(prop, val) { cv.style[prop] = val; clearTimeout(S['fx' + prop]); S['fx' + prop] = setTimeout(function () { cv.style[prop] = ''; }, ms); }
    if (k === 'shake') { cam.shake = 30; S.shake = 1.2; try { navigator.vibrate && navigator.vibrate(300); } catch (e) {} var t0 = now(); var iv = setInterval(function () { var p = now() - t0; if (p > 1200) { clearInterval(iv); cv.style.translate = ''; return; } cv.style.translate = ((Math.random() - 0.5) * 24) + 'px ' + ((Math.random() - 0.5) * 24) + 'px'; }, 30); }
    else if (k === 'flip') css('transform', 'rotate(180deg)');
    else if (k === 'spin') { cv.style.transition = 'transform 2s'; cv.style.transform = 'rotate(360deg)'; setTimeout(function () { cv.style.transition = ''; cv.style.transform = ''; }, 2100); }
    else if (k === 'mirror') css('transform', 'scaleX(-1)');
    else if (k === 'invert') css('filter', 'invert(1)');
    else if (k === 'gray') css('filter', 'grayscale(1)');
    else if (k === 'blur') css('filter', 'blur(5px)');
    else if (k === 'zoom') css('transform', 'scale(1.6)');
    else if (k === 'dark') css('filter', 'brightness(0.25)');
    else if (k === 'flash') { var f = document.createElement('div'); f.style.cssText = 'position:fixed;inset:0;z-index:80;background:' + (m.col || '#fff') + ';opacity:1;transition:opacity 1.2s;pointer-events:none'; document.body.appendChild(f); requestAnimationFrame(function () { f.style.opacity = '0'; }); setTimeout(function () { f.remove(); }, 1300); }
    else if (k === 'rain' || k === 'confetti') { var em = m.em || '🎉'; for (var i = 0; i < 40; i++) (function (i) { var d = document.createElement('div'); d.textContent = k === 'confetti' ? ['🎉', '🎊', '✨', '⭐'][i % 4] : em; d.style.cssText = 'position:fixed;top:-40px;left:' + (Math.random() * 100) + 'vw;font-size:' + (20 + Math.random() * 18) + 'px;z-index:80;pointer-events:none;transition:transform ' + (2 + Math.random() * 2) + 's linear'; document.body.appendChild(d); setTimeout(function () { d.style.transform = 'translateY(' + (innerHeight + 80) + 'px) rotate(' + (Math.random() * 720 - 360) + 'deg)'; }, 30 + i * 40); setTimeout(function () { d.remove(); }, 5000); })(i); }
    else if (k === 'big') { banner(m.text || '👀', m.sub || '', m.col || '#ffd166'); }
    if (m.sfx) SC.sfx(m.sfx);
  }
  function openAdmin() {
    if (!S.owner && !S.teacher) return;
    var tOnly = S.teacher && !S.owner; [].forEach.call($('admTabs').children, function (x) { x.classList.toggle('hidden', tOnly && x.dataset.at !== 'class'); }); if (tOnly) { admTab = 'class'; [].forEach.call($('admTabs').children, function (x) { x.classList.toggle('on', x.dataset.at === 'class'); }); send({ t: 'adm', a: 'class' }); $('mAdmin').querySelector('h2') && ($('mAdmin').querySelector('h2').textContent = 'Teacher Tools'); }
    openModal('mAdmin'); send({ t: 'adm', a: 'info' });
    clearInterval(admPoll); admPoll = setInterval(function () { if ($('mAdmin').classList.contains('hidden')) { clearInterval(admPoll); return; } send({ t: 'adm', a: 'info' }); if (admTab === 'class') send({ t: 'adm', a: 'class' }); }, 1500);
  }
  $('admTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-at]'); if (!b) return; admTab = b.dataset.at; [].forEach.call($('admTabs').children, function (x) { x.classList.toggle('on', x === b); }); SC.sfx('click'); if (admTab === 'class') send({ t: 'adm', a: 'class' }); renderAdmin(); });
  function ab(label, data, cls, confirm) {
    var key = JSON.stringify(data), armed = admArm && admArm.key === key && now() < admArm.until;
    var attrs = Object.keys(data).map(function (k) { return 'data-' + k + '="' + esc(data[k]) + '"'; }).join(' ');
    return '<button class="ab ' + (cls || '') + (armed ? ' armed' : '') + '" ' + attrs + (confirm ? ' data-confirm="1"' : '') + ' data-key="' + esc(key) + '">' + (armed ? 'Sure?' : label) + '</button>';
  }
  function fmtT(sec) { return B.fmtTime(sec); }
  function renderAdmin() {
    var d = S.adm, body = $('admBody'); if (!d || !body || $('mAdmin').classList.contains('hidden')) return;
    // don't rebuild while a dropdown or text box is in use (that closed the player picker mid-click)
    var ae = document.activeElement;
    if (ae && body.contains(ae) && (ae.tagName === 'SELECT' || ae.tagName === 'INPUT') && !S.admForce) { S.admPending = true; return; }
    S.admForce = false; S.admPending = false;
    var top = body.scrollTop, html = '';
    if (admTab === 'matches') {
      if (!d.rooms.length) html = '<div class="admempty">No matches or waiting rooms right now.</div>';
      d.rooms.forEach(function (r) {
        var st = r.state === 'play' ? '<span class="st play">▶ Playing ' + fmtT(r.elapsed) + '</span>' : r.state === 'lobby' ? '<span class="st lobby">Waiting' + (r.startIn ? ' · starts in ' + Math.ceil(r.startIn / 1000) + 's' : '') + '</span>' : '<span class="st end">Finished</span>';
        var rmode = r.game && r.game !== 'bw' ? MG.GAMES[r.game].icon + ' ' + MG.GAMES[r.game].name : 'Bedwars ' + (B.MODES[r.mode] || B.MODES.solo).name;
        html += '<div class="admcard"><div class="admhead">#' + r.id + ' · ' + (r.kind === 'private' ? 'Private' : r.kind === 'practice' ? 'Practice' : 'Public') + ' ' + rmode + (r.info ? ' <span class="tag2">' + esc(r.info) + '</span>' : '') + (r.code ? ' <span class="tag2">' + esc(r.code) + '</span>' : '') + ' ' + st + (r.id === d.myRoom ? ' <span class="tag2" style="background:#ffd166;color:#2a1300">YOU</span>' : '') + '</div>';
        html += '<div class="admrow">';
        if (r.state === 'lobby') html += ab('▶ Start now', { act: 'start', room: r.id }, 'green');
        if (r.state === 'play') {
          html += ab('+1 min', { act: 'time', room: r.id, sec: 60 }) + ab('+5 min', { act: 'time', room: r.id, sec: 300 });
          html += '<span class="lbl" style="margin-left:6px">End:</span>' + ab('Draw', { act: 'end', room: r.id, winner: -1 }, '', true);
          if (r.game === 'ctf' || r.game === 'hide') [0, 1].forEach(function (t3) { html += ab('🏆 ' + (r.game === 'hide' ? (t3 ? 'Seekers' : 'Hiders') : B.TEAMS[t3].name), { act: 'end', room: r.id, winner: t3 }, '', true).replace('class="ab ', 'style="background:' + teamCol(t3) + '" class="ab '); });
          for (var t = 0; t < 4; t++) if (r.teams && !r.teams[t].elim) html += ab('🏆 ' + B.TEAMS[t].name, { act: 'end', room: r.id, winner: t }, '', true).replace('class="ab ', 'style="background:' + teamCol(t) + '" class="ab ');
        }
        if (r.state === 'play' && r.id !== d.myRoom) {
          if (r.game === 'bw') [0, 1, 2, 3].forEach(function (t4) { if (r.teams && r.teams[t4].bed) html += ab('Join ' + B.TEAMS[t4].name, { act: 'joinmatch', room: r.id, team: t4 }).replace('class="ab ', 'style="background:' + teamCol(t4) + '" class="ab '); });
          else if (r.game === 'ctf') [0, 1].forEach(function (t4) { html += ab('Join ' + B.TEAMS[t4].name, { act: 'joinmatch', room: r.id, team: t4 }).replace('class="ab ', 'style="background:' + teamCol(t4) + '" class="ab '); });
          else if (r.game === 'hide') html += ab('Join as seeker', { act: 'joinmatch', room: r.id, team: 1 }, 'blue');
        }
        if (r.state === 'play' || r.state === 'end') {
          html += '</div><div class="admhead" style="margin-top:8px">✨ Fun & chaos</div><div class="acts">' +
            ab('🧲 Bring all', { act: 'fun', room: r.id, op: 'bringall' }) + ab('🎲 Scatter', { act: 'fun', room: r.id, op: 'scatter' }) + ab('🚀 Launch', { act: 'fun', room: r.id, op: 'launchall' }) +
            ab('❤️ Heal all', { act: 'fun', room: r.id, op: 'healall' }, 'green') + ab('💔 1 HP all', { act: 'fun', room: r.id, op: 'hurtall' }, 'red', true) +
            ab('⚡ Speed all', { act: 'fun', room: r.id, op: 'speedall' }) + ab('🐌 Slow all', { act: 'fun', room: r.id, op: 'slowall' }) +
            ab('🐘 Giant', { act: 'fun', room: r.id, op: 'giant' }) + ab('🐜 Tiny', { act: 'fun', room: r.id, op: 'tiny' }) + ab('↩ Normal', { act: 'fun', room: r.id, op: 'normal' }) +
            ab('🪩 Disco', { act: 'fun', room: r.id, op: 'disco' }, 'gold') + ab('💣 Chaos', { act: 'fun', room: r.id, op: 'chaos' }, 'red', true) +
            ab('🤖 +Bot', { act: 'fun', room: r.id, op: 'addbot' }) + ab('🧹 Clear bots', { act: 'fun', room: r.id, op: 'clearbots' }, '', true) +
            ab(r.paused ? '▶️ Unpause' : '⏸️ Pause', { act: 'fun', room: r.id, op: 'pause' }, r.paused ? 'green' : 'blue') + ab('🔄 Restart', { act: 'fun', room: r.id, op: 'restart' }, '', true);
        }
        if (r.state === 'play' && r.game === 'ctf') html += ab('+1 Red', { act: 'mini', room: r.id, op: 'score', team: 0 }) + ab('+1 Blue', { act: 'mini', room: r.id, op: 'score', team: 1 }) + ab('🏠 Flags home', { act: 'mini', room: r.id, op: 'retflags' });
        if (r.state === 'play' && r.game === 'spleef') html += ab('💥 Sudden death', { act: 'mini', room: r.id, op: 'sd' }, 'red', true);
        if (r.state === 'play' && r.game === 'hide') html += ab('🔓 Release seekers', { act: 'mini', room: r.id, op: 'release' }, 'gold') + (r.id === d.myRoom ? '<button class="ab' + (S.reveal ? ' gold' : '') + '" data-local="reveal">' + (S.reveal ? '👁️ Hiders shown' : '👁️ Show hiders (only you)') + '</button>' : '');
        html += ab('✖ Close', { act: 'delete', room: r.id }, 'red', true) + '</div>';
        if (r.state === 'play' && r.teams) {
          html += '<div class="admrow"><span class="lbl">Beds:</span>';
          r.teams.forEach(function (tm, t) { html += tm.bed ? ab('🛏️ Break ' + B.TEAMS[t].name, { act: 'bed', room: r.id, team: t }, '', true).replace('class="ab ', 'style="background:' + teamCol(t) + '" class="ab ') : '<span class="tag2" style="opacity:.6">' + B.TEAMS[t].name + (tm.elim ? ' 💀' : ' ❌') + '</span>'; });
          html += '</div>';
        }
        if (r.players && r.players.length) {
          html += '<table class="admp">';
          r.players.forEach(function (p) {
            var status = r.state === 'lobby' ? '' : p.elim ? '💀 out' : p.dead ? '⏳ respawning' : '❤️ ' + p.hp + (p.god ? ' <span class="tag2" style="background:#ffd166;color:#2a1300">GOD</span>' : '');
            var acts = '';
            if (r.state === 'play') {
              acts += ab('Kill', { act: 'ent', room: r.id, id: p.id, op: 'kill' }, 'red') + ab('Heal', { act: 'ent', room: r.id, id: p.id, op: 'heal' }, 'green') + ab('+Res', { act: 'ent', room: r.id, id: p.id, op: 'res' }, 'gold');
              acts += p.elim || p.dead ? ab('Revive', { act: 'ent', room: r.id, id: p.id, op: 'revive' }, 'blue') : ab('Eliminate', { act: 'ent', room: r.id, id: p.id, op: 'elim' }, 'red', true);
              if (r.id === d.myRoom && p.id !== d.myEnt) acts += ab('TP to', { act: 'ent', room: r.id, id: p.id, op: 'tpme' }) + ab('Bring', { act: 'ent', room: r.id, id: p.id, op: 'bring' });
            }
            html += '<tr><td><b style="color:' + teamCol(p.team) + '">' + (p.bot ? '🤖 ' : '') + esc(p.nick) + '</b>' + (p.human && !p.online ? '<span class="tag2">AFK</span>' : '') + '</td><td>' + status + '</td><td style="color:var(--mut);font-size:12px">' + (p.res ? p.res.iron + '⚪ ' + p.res.gold + '🟡 ' + p.res.dia + '💎 ' + p.res.em + '💚' : '') + '</td><td><div class="acts">' + acts + '</div></td></tr>';
          });
          html += '</table>';
        }
        html += '</div>';
      });
    } else if (admTab === 'players') {
      var playing = d.rooms.filter(function (r) { return r.state === 'play'; }).length;
      html += '<div class="admcard"><div class="admhead">👥 ' + d.conns.length + ' connected · ' + playing + ' match(es) running · ' + d.rooms.filter(function (r) { return r.state === 'lobby'; }).length + ' waiting</div>';
      html += '<div class="admrow"><input class="admin-in" id="admFind" placeholder="🔎 Find a player…" value="' + esc(S.admFind || '') + '" style="min-width:140px"><span class="lbl">Scrolls amount</span><input class="admin-in" id="admAmt" type="number" value="' + esc(S.admAmt || 500) + '" style="max-width:110px;min-width:80px"></div><table class="admp">';
      d.conns.filter(function (x) { return !S.admFind || x.nick.toLowerCase().indexOf(S.admFind.toLowerCase()) >= 0; }).forEach(function (x) {
        var vc = x.voice ? (x.vmuted ? '<span class="tag2" style="background:#ff5c6c">🔇 muted</span>' : x.talking ? '<span class="tag2" style="background:#2bd576;color:#05240f">🎙️ talking</span>' : '<span class="tag2">🎙️ voice</span>') : '';
        var acts = ab('📜 Give', { act: 'coins', pid: x.pid, amount: 'amt' }, 'gold') + ab('Take', { act: 'coins', pid: x.pid, amount: '-amt' }, '', true) + ab('TP to', { act: 'tpto', pid: x.pid }) + ab('Bring', { act: 'bringp', pid: x.pid });
        if (!x.owner) acts += ab(x.frozen ? '🔥 Unfreeze' : '❄️ Freeze', { act: 'freeze', pid: x.pid }, x.frozen ? 'green' : 'blue') + ab('👋 Slap', { act: 'slap', pid: x.pid }) + ab(x.vmuted ? '🎙️ Unmute' : '🔇 Mute', { act: 'vmute', pid: x.pid }, x.vmuted ? 'green' : '') + ab('Kick', { act: 'kick', pid: x.pid }, 'red', true) + ab('Ban 1h', { act: 'ban', pid: x.pid, mins: 60 }, 'red', true) + ab('Ban 1d', { act: 'ban', pid: x.pid, mins: 1440 }, 'red', true) + ab('Ban ∞', { act: 'ban', pid: x.pid, mins: 0 }, 'red', true);
        html += '<tr><td><b>' + esc(x.nick) + '</b>' + (x.owner ? '<span class="tag2" style="background:#ffd166;color:#2a1300">OWNER</span>' : '') + vc + (x.frozen ? '<span class="tag2" style="background:#3a86ff">❄️ frozen</span>' : '') + '<br><span style="color:var(--mut);font-size:12px">' + esc(x.where) + ' · 📜 ' + (x.coins || 0).toLocaleString() + '</span></td><td><div class="acts">' + acts + '</div></td></tr>';
      });
      html += '</table></div>';
      if (d.bans && d.bans.length) { html += '<div class="admcard"><div class="admhead">⛔ Banned (' + d.bans.length + ')</div><table class="admp">'; d.bans.forEach(function (b) { html += '<tr><td><b>' + esc(b.nick || '?') + '</b><br><span style="color:var(--mut);font-size:12px">' + (b.until ? 'until ' + new Date(b.until).toLocaleString() : 'forever') + ' · by ' + esc(b.by || '?') + '</span></td><td><div class="acts">' + ab('Unban', { act: 'unban', cid: b.cid }, 'green') + '</div></td></tr>'; }); html += '</table></div>'; }
    } else if (admTab === 'server') {
      var st = d.settings || {};
      var num = function (k, label, unit) { return '<div class="admrow"><span class="lbl" style="min-width:150px">' + label + '</span><input class="admin-in" data-set="' + k + '" type="number" value="' + esc(st[k]) + '" style="max-width:90px;min-width:70px"><span style="color:var(--mut);font-size:12px">' + (unit || '') + '</span></div>'; };
      html += '<div class="admcard"><div class="admhead">✨ Double Scrolls event ' + (d.x2Left ? '<span class="tag2" style="background:#2bd576;color:#05240f">ON · ' + Math.ceil(d.x2Left / 60000) + ' min left</span>' : '') + '</div><div class="admrow">' + ab('30 min', { act: 'double', mins: 30 }, 'gold') + ab('1 hour', { act: 'double', mins: 60 }, 'gold') + ab('3 hours', { act: 'double', mins: 180 }, 'gold') + (d.x2Left ? ab('Stop', { act: 'double', mins: 0 }, 'red') : '') + '</div><div style="color:var(--mut);font-size:12px;margin-top:6px">Every game pays 2× Scrolls while it’s on. Everyone gets an announcement.</div></div>';
      html += '<div class="admcard"><div class="admhead">📢 Hub message (shows at the top of the hub)</div><div class="admrow"><input class="admin-in" id="admMotd" maxlength="120" placeholder="e.g. Tournament at 7pm!" value="' + esc(S.admMotdDraft != null ? S.admMotdDraft : st.motd || '') + '">' + ab('Set', { act: 'setting', k: 'motd' }, 'gold') + ab('Clear', { act: 'setting', k: 'motd', v: '' }) + '</div></div>';
      html += '<div class="admcard"><div class="admhead">🎮 Game settings <span class="tag2">new matches</span></div>' + num('ctfCaps', '🚩 CTF captures to win', 'captures') + num('ctfMins', '🚩 CTF time limit', 'minutes') + num('hideSec', '🎃 Prop Hunt hiding time', 'seconds') + num('seekSec', '🎃 Prop Hunt seeking time', 'seconds') + num('spleefMins', '❄️ Spleef sudden death after', 'minutes') +
        '<div class="admrow"><span class="lbl" style="min-width:150px">🤖 Quick-play bots</span>' + ['easy', 'normal', 'hard'].map(function (v) { return ab(v[0].toUpperCase() + v.slice(1), { act: 'setting', k: 'publicDiff', v: v }, st.publicDiff === v ? 'gold' : ''); }).join('') + '</div><div class="admrow">' + ab('💾 Save numbers', { act: 'saveset' }, 'green') + '</div></div>';
      var sc = d.school;
      html += '<div class="admcard"><div class="admhead">🏫 School mode ' + (sc ? '<span class="tag2" style="background:#2bd576;color:#05240f">ON</span>' : '<span class="tag2">Off</span>') + '</div><div class="admrow">' + (sc ? ab('Turn school mode off', { act: 'school', on: 0 }, 'red', true) : ab('🏫 Turn school mode on', { act: 'school', on: 1 }, 'green', true)) + '</div><div class="admrow"><span class="lbl">Questions:</span>' + [['blooket', 'Class Blooket'], ['u9', 'Unit 9'], ['u10', 'Unit 10'], ['both', 'Units 9+10']].map(function (q) { return ab(q[1], { act: 'school', v: q[0] }, sc && sc.set === q[0] ? 'gold' : ''); }).join('') + '</div><div style="color:var(--mut);font-size:12px;padding:2px 4px">Site goes to the games hub only · 30 players per game · walking uses ⚡ energy, answers refill it · Bedwars resources come from answers.</div></div>';
      html += '<div class="admcard"><div class="admhead">🎄 Holiday decorations ' + (S.season ? '<span class="tag2" style="background:#2bd576;color:#05240f">ON</span>' : '<span class="tag2">Off</span>') + '</div><div class="admrow">' + (S.season ? ab('Turn decorations off', { act: 'season', v: 0 }, 'red') : ab('🎄 Turn Christmas on', { act: 'season', v: 1 }, 'green')) + '</div><div style="color:var(--mut);font-size:12px;padding:2px 4px">Snow, string lights, trees, presents and snowmen in the hub · frosty ground · Santa hats · holiday music.</div></div>';
      html += '<div class="admcard"><div class="admhead">⏹️ Emergency</div><div class="admrow">' + ab('End every match now', { act: 'endall' }, 'red', true) + '</div></div>';
    } else if (admTab === 'maps') {
      var mp = d.maps || [], rot = d.rot || {};
      html += '<div class="admcard"><div class="admhead">🗺️ Custom maps ' + (d.mapper ? '<a class="ab gold" href="/arcade/builder" style="text-decoration:none">🛠️ Open map builder</a>' : '<span class="tag2">only Scrollreader11 can make or change maps</span>') + '</div>';
      if (d.mapper) html += '<div class="admrow"><span class="lbl">Built-in maps in rotation:</span>' + ['bw', 'ctf', 'spleef', 'hide'].map(function (g) { var on = rot[g] && rot[g].def; return ab((on ? '✅ ' : '⬜ ') + MG.GAMES[g].icon + ' ' + MG.GAMES[g].name, { act: 'maprot', game: g, id: 'default', on: on ? 0 : 1 }, on ? 'green' : ''); }).join('') + '</div>';
      html += '<table class="admp">' + (mp.length ? mp.map(function (m) { return '<tr><td>' + MG.GAMES[m.game].icon + ' <b>' + esc(m.name) + '</b><br><span style="color:var(--mut);font-size:12px">by ' + esc(m.author || '?') + ' · ' + new Date(m.at).toLocaleDateString() + (m.ok ? '' : ' · unfinished') + '</span></td><td><div class="acts">' + (m.ok ? ab('▶ Test', { act: 'testmap', id: m.id, game: m.game }, 'green') : '') + (d.mapper && m.ok ? ab(m.rot ? '✅ In rotation' : '⬜ Add to rotation', { act: 'maprot', game: m.game, id: m.id, on: m.rot ? 0 : 1 }, m.rot ? 'green' : '') : '') + (d.mapper ? ab('🗑️', { act: 'mapdel', id: m.id }, 'red', true) : '') + '</div></td></tr>'; }).join('') : '<tr><td style="color:var(--mut)">No custom maps yet.</td></tr>') + '</table></div>';
    } else if (admTab === 'class') {
      var cl = S.cls;
      if (!cl) html = '<div class="admempty">Loading class info…</div>';
      else {
        var sc2 = d.school, left = cl.until ? Math.max(0, Math.ceil((cl.until - Date.now()) / 60000)) : 0;
        html += '<div class="admcard"><div class="admhead">🏫 School Mode ' + (sc2 ? '<span class="tag2" style="background:#2bd576;color:#05240f">ON' + (left ? ' · ' + left + ' min left' : '') + '</span>' : '<span class="tag2">Off</span>') + '</div>' + (S.owner ? '<div class="admrow"><span class="lbl">Turn on for a class period:</span>' + [30, 45, 50, 60, 90].map(function (mn) { return ab(mn + ' min', { act: 'schooltimer', mins: mn }, 'green'); }).join('') + (sc2 ? ab('Turn off now', { act: 'school', on: 0 }, 'red', true) : '') + (cl.until ? ab('No timer', { act: 'schooltimer', mins: 0 }) : '') + '</div>' : '') + '</div>';
        var vt = cl.vote;
        if (S.owner && cl.tkey) html += '<div class="admcard" style="border-color:#ffd166"><div class="admhead">🔗 Teacher link <span style="color:var(--mut);font-weight:600;font-size:12px">only you can see this — send it to the teacher privately</span></div><div class="admrow"><input class="admin-in" id="tLink" readonly value="' + esc(location.origin + '/teacher/' + cl.tkey) + '" style="flex:1;min-width:0">' + ab('📋 Copy', { act: 'tcopy' }, 'gold') + ab('🔄 New link', { act: 'newteacher' }, 'red', true) + '</div></div>';
        if (S.teacher && !S.owner) html += '<div class="admrow" style="justify-content:flex-end"><a class="ab" href="/teacher/leave" style="text-decoration:none">🚪 Leave teacher mode on this computer</a></div>';
        html += '<div class="admcard"><div class="admhead">🗳️ Game vote</div><div class="admrow">' + (vt ? '<span class="tag2" style="background:#ffd166;color:#2a1300">' + vt.left + 's left · ' + vt.voters + ' voted</span>' + Object.keys(vt.counts).map(function (g) { return '<span class="tag2">' + (g === 'bw' ? '🛏️' : MG.GAMES[g].icon) + ' ' + vt.counts[g] + '</span>'; }).join('') + ab('End now & start', { act: 'vote', op: 'stop' }, 'green') + ab('Cancel', { act: 'vote', op: 'cancel' }, 'red') : ab('🗳️ Start a 20s vote', { act: 'vote', sec: 20 }, 'gold') + ab('30s vote', { act: 'vote', sec: 30 })) + '</div><div style="color:var(--mut);font-size:12px;padding:2px 4px">Everyone in the hub gets a big vote screen. When it ends, the winning game starts with everyone in it.</div></div>';
        var cq = cl.cq;
        html += '<div class="admcard"><div class="admhead">📣 Ask the whole class a question</div><div class="admrow"><select class="admin-in" id="cqPick" style="flex:1;min-width:0"><option value="">🎲 Random question from ' + esc(cl.setName) + '</option>' + cl.set.map(function (q) { return '<option value="' + q.i + '"' + (String(S.cqPick) === String(q.i) ? ' selected' : '') + '>' + esc(q.q) + '</option>'; }).join('') + '</select>' + ab('📣 Send to everyone', { act: 'cq', cqsend: 1 }, 'gold') + '</div>';
        if (cq) {
          var pct = cq.answered ? Math.round(cq.right / cq.answered * 100) : 0;
          html += '<div class="admrow" style="flex-direction:column;align-items:stretch;gap:4px"><div style="font-weight:700">' + esc(cq.q) + '</div><div>✅ Answer: <b>' + esc(cq.a) + '</b></div><div><span class="tag2" style="background:' + (cq.open ? '#2bd576;color:#05240f' : '#4a4f6a') + '">' + (cq.open ? 'Open · ' + cq.left + 's' : 'Closed') + '</span> <b>' + cq.answered + '</b> / ' + cq.sent + ' answered · <b>' + pct + '%</b> correct</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap">' + cq.choices.map(function (ch, k) { return '<span class="tag2" style="background:' + ['#f0a531', '#4d7cff', '#5dcc6b', '#e8473b'][k] + '">' + esc(ch) + ': ' + cq.counts[k] + '</span>'; }).join('') + '</div>' + (cq.wrongNames.length ? '<div style="color:var(--mut);font-size:12px">Missed it: ' + cq.wrongNames.map(esc).join(', ') + '</div>' : '') + (cq.open ? '<div>' + ab('Close question', { act: 'cqclose' }) + '</div>' : '') + '</div>';
        }
        html += '</div>';
        var gn = function (g) { return g === 'bw' ? '🛏️ Bedwars' : MG.GAMES[g].icon + ' ' + MG.GAMES[g].name; };
        html += '<div class="admcard"><div class="admhead">📺 Watch a match</div><div class="admrow">' + (cl.live.length ? cl.live.map(function (r) { return ab('👀 ' + gn(r.game) + ' · ' + r.n + (r.n === 1 ? ' player · ' : ' players · ') + r.mins + 'm', { act: 'swatch', room: r.id }, 'blue'); }).join('') : '<span style="color:var(--mut)">No matches running right now.</span>') + '</div></div>';
        html += '<div class="admcard"><div class="admhead">🧑‍🤝‍🧑 In the game now (' + cl.online.length + ')</div><table class="admp">' + (cl.online.length ? cl.online.map(function (o) { return '<tr><td><b>' + esc(o.nick) + '</b><br><span style="color:var(--mut);font-size:12px">' + o.where + '</span></td><td style="text-align:right;white-space:nowrap">' + ab('✏️ Rename', { act: 'srename', pid: o.pid, old: o.nick }) + ab('🚪 Kick', { act: 'skick', pid: o.pid }, '', true) + ab('⛔ Ban name', { act: 'sban', pid: o.pid }, 'red', true) + '</td></tr>'; }).join('') : '<tr><td style="color:var(--mut)">Nobody is in the game yet.</td></tr>') + '</table>' + (cl.bannedNames.length ? '<div class="admrow"><span class="lbl">Banned names:</span>' + cl.bannedNames.map(function (n) { return '<span class="tag2">' + esc(n) + '</span>' + ab('Unban', { act: 'sunban', name: n }); }).join(' ') + '</div>' : '') + '</div>';
        html += '<div class="admcard"><div class="admhead">❗ Most-missed questions</div><table class="admp">' + (cl.miss.length ? cl.miss.map(function (q) { return '<tr><td style="font-size:13px">' + esc(q.q) + '<br><span style="color:#2bd576;font-size:12px">✅ ' + esc(q.a) + '</span></td><td style="white-space:nowrap;color:#ff5c6c;font-weight:800">' + q.pct + '% missed</td><td style="color:var(--mut);font-size:12px;white-space:nowrap">' + q.miss + ' / ' + q.total + '</td></tr>'; }).join('') : '<tr><td style="color:var(--mut)">No misses yet.</td></tr>') + '</table></div>';
        html += '<div class="admcard"><div class="admhead">👩‍🎓 Students (' + cl.kids.length + ') <span style="color:var(--mut);font-weight:600;font-size:12px">since ' + new Date(cl.since).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</span> ' + ab('Reset stats', { act: 'classreset' }, '', true) + '</div><table class="admp"><tr><th style="text-align:left">Student</th><th>✅ Right</th><th>❌ Wrong</th><th>Accuracy</th><th>Last answer</th></tr>' + (cl.kids.length ? cl.kids.map(function (k) { return '<tr><td><b>' + esc(k.nick) + '</b></td><td>' + k.right + '</td><td>' + k.wrong + '</td><td style="font-weight:800;color:' + (k.acc >= 80 ? '#2bd576' : k.acc >= 60 ? '#ffd166' : '#ff5c6c') + '">' + k.acc + '%</td><td style="color:var(--mut);font-size:12px">' + (k.ago < 60 ? k.ago + 's ago' : Math.round(k.ago / 60) + 'm ago') + '</td></tr>'; }).join('') : '<tr><td colspan="5" style="color:var(--mut)">Nobody has answered yet.</td></tr>') + '</table></div>';
      }
    } else if (admTab === 'mega') {
      var mg = d.mega || [];
      var popts = '<option value="">— pick a player —</option>' + d.conns.map(function (x) { return '<option value="' + x.pid + '"' + (String(S.megaP) === String(x.pid) ? ' selected' : '') + '>' + esc(x.nick) + ' · ' + esc(x.where) + '</option>'; }).join('');
      var ropts = '<option value="">— pick a match —</option>' + d.rooms.filter(function (r) { return r.state === 'play'; }).map(function (r) { return '<option value="' + r.id + '"' + (String(S.megaR) === String(r.id) ? ' selected' : '') + '>#' + r.id + ' ' + (r.game && r.game !== 'bw' ? MG.GAMES[r.game].name : 'Bedwars') + '</option>'; }).join('');
      html += '<div class="admcard"><div class="admhead">⚡ ' + mg.length + ' owner powers</div><div class="admrow"><span class="lbl">Player</span><select class="admin-in" id="megaP">' + popts + '</select><span class="lbl">Match</span><select class="admin-in" id="megaR">' + ropts + '</select></div><div class="admrow"><input class="admin-in" id="megaTxt" placeholder="Text / number for powers that need it" value="' + esc(S.megaTxt || '') + '"></div></div>';
      var cats = []; mg.forEach(function (o) { if (cats.indexOf(o.cat) < 0) cats.push(o.cat); });
      cats.forEach(function (ct) {
        html += '<div class="admcard"><div class="admhead">' + esc(ct) + '</div><div class="acts">';
        mg.filter(function (o) { return o.cat === ct; }).forEach(function (o) { html += ab(o.icon + ' ' + o.label + (o.scope === 'p' ? ' 👤' : o.scope === 'r' ? ' 🎮' : ' 🌍'), { act: 'x', op: o.id, mega: 1 }, o.danger ? 'red' : '', o.danger); });
        html += '</div></div>';
      });
      html += '<div style="color:var(--mut);font-size:12px;padding:4px 8px">👤 = picked player · 🎮 = picked match · 🌍 = everyone</div>';
    } else if (admTab === 'log') {
      html += '<div class="admcard"><div class="admhead">📜 Recent activity</div><table class="admp">' + (d.logs || []).map(function (l) { return '<tr><td style="color:var(--mut);font-size:12px;white-space:nowrap">' + new Date(l.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '</td><td>' + esc(l.text) + '</td></tr>'; }).join('') + '</table></div>';
    } else {
      html += '<div class="admcard"><div class="admhead">📢 Announcement</div><div class="admrow"><input class="admin-in" id="admAnn" maxlength="140" placeholder="Message everyone in Bedwars…" value="' + esc(S.admDraft || '') + '">' + ab('Send', { act: 'announce' }, 'gold') + '</div></div>';
      html += '<div class="admcard"><div class="admhead">🔒 New matches</div><div class="admrow">' + (d.locked ? '<span class="tag2" style="background:#ff5c6c">Paused</span>' + ab('Open matches again', { act: 'lock', on: 0 }, 'green') : '<span class="tag2" style="background:#2bd576;color:#05240f">Open</span>' + ab('Pause new matches', { act: 'lock', on: 1 }, 'red', true)) + '</div><div style="color:var(--mut);font-size:12px;margin-top:6px">Pausing stops anyone except owners from starting or joining matches. Games already running keep going.</div></div>';
      html += '<div class="admcard"><div class="admhead">🎙️ Proximity voice chat</div><div class="admrow">' + (d.voiceOff ? '<span class="tag2" style="background:#ff5c6c">Off for everyone</span>' + ab('Turn voice on', { act: 'voiceoff', on: 0 }, 'green') : '<span class="tag2" style="background:#2bd576;color:#05240f">On</span>' + ab('Turn voice off for everyone', { act: 'voiceoff', on: 1 }, 'red', true)) + '</div><div style="color:var(--mut);font-size:12px;margin-top:6px">Mute one person from the Players tab.</div></div>';
      var inMatch = !!d.myEnt;
      html += '<div class="admcard"><div class="admhead">✨ Your powers ' + (inMatch ? '' : '<span class="tag2">join a match to use these</span>') + '</div><div class="admrow">' +
        ab(S.god ? '😇 God mode: ON' : '😇 God mode', { act: 'self', op: 'god' }, S.god ? 'gold' : '') + ab((d.my && d.my.vanish ? '✅ ' : '') + '👻 Vanish', { act: 'self', op: 'vanish' }, d.my && d.my.vanish ? 'gold' : '') + ab((d.my && d.my.speed ? '✅ ' : '') + '⚡ Speed', { act: 'self', op: 'speed' }, d.my && d.my.speed ? 'gold' : '') + ab((d.my && d.my.onehit ? '✅ ' : '') + '💥 One-hit kills', { act: 'self', op: 'onehit' }, d.my && d.my.onehit ? 'gold' : '') +
        ab('💰 +Resources', { act: 'self', op: 'res' }) + ab('⚔️ Max kit', { act: 'self', op: 'kit' }) + ab('🧱 Infinite blocks', { act: 'self', op: 'blocks' }) +
        '</div><div style="color:var(--mut);font-size:12px;margin-top:6px">God: no damage, no void. Vanish: players and bots can’t see you (owners see a ghost). Join any running match from the Matches tab.</div></div>';
    }
    var focused = document.activeElement && (document.activeElement.tagName === 'INPUT') && $('admBody').contains(document.activeElement);
    if (focused) return; // don't wipe what you're typing
    body.innerHTML = html; body.scrollTop = top;
    if (S.adm.myEnt) [].forEach.call(body.querySelectorAll('[data-op="tpme"],[data-op="bring"]'), function () {});
  }
  $('admBody').addEventListener('input', function (e) { if (e.target.id === 'admAnn') S.admDraft = e.target.value; if (e.target.id === 'admFind') { S.admFind = e.target.value; } if (e.target.id === 'admAmt') S.admAmt = e.target.value; if (e.target.id === 'admMotd') S.admMotdDraft = e.target.value; });
  $('admBody').addEventListener('change', function (e) { if (e.target.id === 'admFind') { S.admForce = true; renderAdmin(); } });
  $('admBody').addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter' && e.target.id === 'admAnn') { var b = $('admBody').querySelector('[data-act="announce"]'); if (b) b.click(); } });
  $('admBody').addEventListener('change', function (e) { if (e.target.id === 'cqPick') { S.cqPick = e.target.value; e.target.blur(); S.admForce = true; renderAdmin(); return; }
    if (e.target.id === 'megaP' || e.target.id === 'megaR') { if (e.target.id === 'megaP') S.megaP = e.target.value; else S.megaR = e.target.value; e.target.blur(); SC.sfx('click'); S.admForce = true; renderAdmin(); } });
  $('admBody').addEventListener('focusout', function (e) { if ((e.target.tagName === 'SELECT') && S.admPending) setTimeout(function () { var ae = document.activeElement; if (!ae || !$('admBody').contains(ae) || ae.tagName !== 'SELECT') { S.admForce = true; renderAdmin(); } }, 50); });
  $('admBody').addEventListener('input', function (e) { if (e.target.id === 'megaTxt') S.megaTxt = e.target.value; });
  $('admBody').addEventListener('click', function (e) {
    var b = e.target.closest('.ab'); if (!b || b.disabled) return;
    var key = b.dataset.key;
    if (b.dataset.confirm && !(admArm && admArm.key === key && now() < admArm.until)) { admArm = { key: key, until: now() + 2600 }; SC.sfx('click'); renderAdmin(); return; }
    admArm = null;
    if (b.dataset.local === 'reveal') { S.reveal = !S.reveal; renderAdmin(); return; }
    if (b.dataset.act === 'testmap') { closeModals(); S.lastQueue = { t: 'practice', game: b.dataset.game, mode: b.dataset.game === 'bw' ? 'solo' : b.dataset.game, diff: 'normal', map: b.dataset.id }; send(S.lastQueue); return; }
    if (b.dataset.act === 'saveset') { [].forEach.call($('admBody').querySelectorAll('[data-set]'), function (inp) { if (String(S.adm.settings[inp.dataset.set]) !== inp.value) send({ t: 'adm', a: 'setting', k: inp.dataset.set, v: inp.value }); }); SC.sfx('click'); return; }
    var m = { t: 'adm', a: b.dataset.act };
    if (b.dataset.act === 'tcopy') { var tl = $('tLink'); try { navigator.clipboard.writeText(tl.value); } catch (e) { tl.select(); document.execCommand('copy'); } toast('📋 Teacher link copied', 1500); return; }
    if (b.dataset.act === 'srename') { var nn = window.prompt('New name for ' + (b.dataset.old || 'this student') + ':', b.dataset.old || ''); if (nn && nn.trim()) { send({ t: 'adm', a: 'srename', pid: +b.dataset.pid, nick: nn.trim() }); setTimeout(function () { send({ t: 'adm', a: 'class' }); }, 400); } return; }
    if (b.dataset.act === 'sunban') { send({ t: 'adm', a: 'sunban', name: b.dataset.name }); setTimeout(function () { send({ t: 'adm', a: 'class' }); }, 400); return; }
    if (b.dataset.act === 'swatch') { send({ t: 'adm', a: 'swatch', room: +b.dataset.room }); closeModals(); return; }
    if (b.dataset.cqsend) { send({ t: 'adm', a: 'cq', i: S.cqPick === '' || S.cqPick == null ? '' : +S.cqPick }); SC.sfx('click'); setTimeout(function () { send({ t: 'adm', a: 'class' }); }, 300); return; }
    if (b.dataset.mega) { m.op = b.dataset.op; m.pid = +(S.megaP || 0); m.room = +(S.megaR || 0); m.text = S.megaTxt || ''; send(m); SC.sfx('click'); return; }
    ['room', 'id', 'op', 'team', 'winner', 'sec', 'pid', 'on', 'mins', 'k', 'v', 'cid', 'game'].forEach(function (k) { if (b.dataset[k] != null) m[k] = isNaN(+b.dataset[k]) || b.dataset[k] === '' ? b.dataset[k] : +b.dataset[k]; });
    if (b.dataset.amount) { var amt = Math.round(+($('admAmt') && $('admAmt').value) || 0); m.amount = b.dataset.amount === '-amt' ? -amt : amt; }
    if (m.a === 'setting' && m.k === 'motd' && b.dataset.v == null) { m.v = ($('admMotd') && $('admMotd').value) || ''; S.admMotdDraft = null; }
    if (m.a === 'cfgnum') return;
    if (m.a === 'announce') { m.text = ($('admAnn') && $('admAnn').value) || S.admDraft || ''; S.admDraft = ''; if ($('admAnn')) $('admAnn').value = ''; }
    if (m.a === 'lock' || m.a === 'voiceoff') m.on = !!m.on;
    SC.sfx('click'); send(m);
  });

  // ================================================================== MINIGAMES (CTF / TNT Spleef / Prop Hunt)
  SC.sfxAdd('crack', function () { noise(0.08, 0.16, 0, 1800); });
  SC.sfxAdd('flag', function () { [0, 4, 7, 12, 16].forEach(function (n, i) { tone(SC.sfxNotes[n % 15] * (n > 14 ? 2 : 1), 0.14, 'square', 0.1, i * 0.06); }); });
  SC.sfxAdd('score', function () { [0, 4, 7, 12, 7, 12].forEach(function (n, i) { tone(SC.sfxNotes[n % 15] * (n > 11 ? 2 : 1), 0.18, 'triangle', 0.14, i * 0.09); }); noise(0.4, 0.15, 0.4, 300); });
  var TAUNTS = [[0, 2, 4, 0], [7, 7, 9, 7], [4, 2, 0, 2], [0, 4, 7, 12], [12, 11, 9, 7]];
  TAUNTS.forEach(function (q, k) { SC.sfxAdd('taunt' + k, function () { q.forEach(function (n, i) { tone(SC.sfxNotes[n % 15] * (n > 11 ? 2 : 1), 0.16, k % 2 ? 'square' : 'triangle', 0.13, i * 0.13); }); }); });

  var SPX0 = 18, SPN = 37;
  function viewZ() { if ((S.dead || S.elim) && S.specId) { var sp = S.ents.get(S.specId); if (sp) return sp.z || 0; } return P ? (P.z || 0) : 0; }
  function spPaint(x, z, i) {
    var L = S.map.L[z], tx = i % W, ty = (i / W) | 0, lx = (tx - SPX0) * T, ly = (ty - SPX0) * T;
    if (tx < SPX0 || ty < SPX0 || tx >= SPX0 + SPN || ty >= SPX0 + SPN || !L[i]) return;
    D.spTile(x, MG.SP.kinds[z], lx, ly, i, !L[i + W]);
  }
  function spBuild() {
    S.spCv = [];
    for (var z = 0; z < MG.SP_LAYERS; z++) {
      var cv2 = document.createElement('canvas'); cv2.width = SPN * T; cv2.height = SPN * T + 16; var x = cv2.getContext('2d');
      for (var ty = SPX0; ty < SPX0 + SPN; ty++) for (var tx = SPX0; tx < SPX0 + SPN; tx++) spPaint(x, z, ty * W + tx);
      S.spCv.push(cv2);
    }
  }
  function spGone(z, i) {
    if (!S.spCv) return; var x = S.spCv[z].getContext('2d'), tx = i % W, ty = (i / W) | 0;
    x.clearRect((tx - SPX0) * T, (ty - SPX0) * T, T, T + 16);
    spPaint(x, z, i - W); spPaint(x, z, i + W);
  }
  function drawSpleef(Lx, Tp, vw, vh, t, vz) {
    var m = S.map; if (!m.L) return null;
    if (!S.spCv) spBuild();
    var tn = now();
    for (var z = MG.SP_LAYERS - 1; z >= vz; z--) {
      var d = z - vz, s = 1 - 0.075 * d;
      c.save();
      if (d) { c.translate(cam.x, cam.y); c.scale(s, s); c.translate(-cam.x, -cam.y); }
      c.save(); c.globalAlpha = 0.35; c.filter = 'blur(10px)'; c.drawImage(S.spCv[z], SPX0 * T + 10, SPX0 * T + 60); c.restore();
      c.drawImage(S.spCv[z], SPX0 * T, SPX0 * T);
      // crumbling tiles shake, glow and crack
      for (var k in S.crk) {
        k = +k; var kz = (k / NN) | 0; if (kz !== z) continue;
        var i = k % NN; if (m.L[z][i] !== 2) { delete S.crk[k]; continue; }
        var age = Math.min(1, (tn - S.crk[k]) / 800), px = (i % W) * T, py = ((i / W) | 0) * T, jx = (Math.random() - 0.5) * age * 4, jy = (Math.random() - 0.5) * age * 4;
        c.fillStyle = 'rgba(255,90,40,' + (0.12 + age * 0.38) + ')'; c.fillRect(px + jx, py + jy, T, T);
        D.cracks(c, px + jx, py + jy, Math.min(5, (age * 6) | 0), 0);
      }
      if (d) {
        var lst = []; S.ents.forEach(function (e) { if ((e.id === S.myId ? (P.z || 0) : e.z || 0) === z && !e.dead && !e.elim) lst.push(e); });
        lst.sort(function (a, b) { return a.y - b.y; }).forEach(function (e) { drawEnt(e, t); });
      }
      c.restore();
      if (d >= 0 && z > vz) { c.fillStyle = 'rgba(8,5,26,.34)'; c.fillRect(Lx - 400, Tp - 400, vw + 800, vh + 800); }
    }
    return true;
  }
  function mgCtfDrawables(list, t) {
    var m = S.map;
    m.bases.forEach(function (b, team) {
      var f = S.flags[team] || [0], home = f[0] === 0;
      list.push({ k: 'fn', y: b.fy - 6, fn: function () { D.flagStand(c, b.fx, b.fy, team, t, home); } });
      if (home) list.push({ k: 'fn', y: b.fy + 2, fn: function () { D.flag(c, b.fx, b.fy, team, t); } });
      else if (f[0] === 2) list.push({ k: 'fn', y: f[3] + 2, fn: function () {
        D.flag(c, f[2], f[3], team, t);
        var pu = (Math.sin(t * 6) + 1) / 2; c.strokeStyle = 'rgba(255,255,255,' + (0.3 + pu * 0.5) + ')'; c.lineWidth = 3; A.ell(c, f[2], f[3], 26, 10); c.stroke();
      } });
    });
    (m.pickSpots || []).forEach(function (sp, k) {
      list.push({ k: 'fn', y: sp.y - 2, fn: function () { D.pad(c, sp.x, sp.y, t); if (S.pickups[k]) D.pickup(c, S.pickups[k], sp.x, sp.y, t); } });
    });
  }
  function drawDisguised(e, x, y, t) {
    var fl = Math.max(0, 1 - (now() - (e.flashT || -1e9)) / 320);
    if (e.id === S.myId) { c.save(); c.strokeStyle = 'rgba(43,213,118,' + (0.5 + Math.sin(t * 4) * 0.3) + ')'; c.lineWidth = 2.5; c.setLineDash([5, 5]); c.lineDashOffset = -t * 18; A.ell(c, x, y + 10, 24, 9); c.stroke(); c.restore(); }
    else if (S.team === 0) { c.strokeStyle = 'rgba(43,213,118,.35)'; c.lineWidth = 2; A.ell(c, x, y + 10, 20, 7); c.stroke(); }
    D.prop(c, e.prop, x, y + 12, t, { wob: fl, face: true });
    if (e.moving && Math.random() < 0.2) D.burst('dust', x, y + 10, 1);
  }
  function mgWorldTop(t) {
    var tn = now();
    if (S.game === 'hide') {
      var m = S.map;
      if (snow() < S.seekAt && m.cage) { // the seekers' cage
        var x0 = m.cage[0] * T, y0 = m.cage[1] * T, x1 = (m.cage[2] + 1) * T, y1 = (m.cage[3] + 1) * T;
        c.strokeStyle = '#1b1636'; c.lineWidth = 7; c.strokeRect(x0, y0, x1 - x0, y1 - y0); c.strokeStyle = '#9aa3b5'; c.lineWidth = 4; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
        for (var bx = x0; bx <= x1; bx += 20) { c.fillStyle = '#1b1636'; c.fillRect(bx - 2.5, y0 - 30, 5, 34); c.fillRect(bx - 2.5, y1 - 30, 5, 34); c.fillStyle = '#c5cfe2'; c.fillRect(bx - 1, y0 - 29, 2, 32); c.fillRect(bx - 1, y1 - 29, 2, 32); }
        for (var by = y0; by <= y1; by += 20) { c.fillStyle = '#1b1636'; c.fillRect(x0 - 2.5, by - 30, 5, 34); c.fillRect(x1 - 2.5, by - 30, 5, 34); c.fillStyle = '#c5cfe2'; c.fillRect(x0 - 1, by - 29, 2, 32); c.fillRect(x1 - 1, by - 29, 2, 32); }
        D.tag(c, '🔒 SEEKERS RELEASED IN ' + Math.max(0, Math.ceil((S.seekAt - snow()) / 1000)), (x0 + x1) / 2, y0 - 50, { size: 16, color: '#fff', bg: '#c1121f' });
      }
      if (S.radar && tn - S.radar.t < 3000) { var u = (tn - S.radar.t) / 3000; for (var k = 0; k < 3; k++) { var uu = (u * 2 + k / 3) % 1; c.strokeStyle = 'rgba(43,213,118,' + (1 - uu) * (1 - u) + ')'; c.lineWidth = 4; A.circ(c, S.radar.x, S.radar.y, 30 + uu * 160); c.stroke(); } }
    }
    if (S.game === 'spleef') {
      var vz = viewZ();
      if (vz > 0 && S.spCv) { // floors above you, faint
        for (var z = vz - 1; z >= 0; z--) { var s = 1 + 0.06 * (vz - z); c.save(); c.globalAlpha = 0.09; c.translate(cam.x, cam.y); c.scale(s, s); c.translate(-cam.x, -cam.y); c.drawImage(S.spCv[z], SPX0 * T, SPX0 * T); c.restore(); }
      }
      if (touch && P && !P.dead) { var ft = frontDigTile(); if (ft >= 0 && S.map.L[P.z || 0][ft]) D.tileCursor(c, (ft % W) * T, ((ft / W) | 0) * T, 'floor', true, t); }
    }
    if (S.game === 'hide' && touch && P && S.team === 0 && S.held === 'mask') { var pr = MG.propAt(S.map, P.x, P.y, 2.6 * T); if (pr) { c.strokeStyle = 'rgba(255,209,102,' + (0.5 + Math.sin(t * 6) * 0.3) + ')'; c.lineWidth = 3; c.setLineDash([6, 6]); A.ell(c, pr.x, pr.y + 10, 28, 11); c.stroke(); c.setLineDash([]); } }
  }
  // arrows on the screen edge pointing at things that matter
  function edgeArrow(wx, wy, col, label, z) {
    var sx = (wx - cam.x) * z + innerWidth / 2, sy = (wy - 30 - cam.y) * z + innerHeight / 2, mg = 70;
    if (sx > mg && sx < innerWidth - mg && sy > mg && sy < innerHeight - mg) {
      var bo = Math.abs(Math.sin(now() / 200)) * 8; c.save(); c.translate(sx, sy - 56 * z - bo);
      c.beginPath(); c.moveTo(-10, -12); c.lineTo(10, -12); c.lineTo(0, 2); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = '#1b1636'; c.lineWidth = 3; c.stroke(); c.restore(); return;
    }
    var cx = innerWidth / 2, cy = innerHeight / 2, a = Math.atan2(sy - cy, sx - cx);
    var k = Math.min((innerWidth / 2 - mg) / Math.abs(Math.cos(a) || 1e-6), (innerHeight / 2 - mg) / Math.abs(Math.sin(a) || 1e-6));
    var ax = cx + Math.cos(a) * k, ay = cy + Math.sin(a) * k;
    c.save(); c.translate(ax, ay); c.rotate(a);
    c.beginPath(); c.moveTo(22, 0); c.lineTo(-10, -15); c.lineTo(-4, 0); c.lineTo(-10, 15); c.closePath(); c.fillStyle = col; c.fill(); c.strokeStyle = '#1b1636'; c.lineWidth = 3.5; c.stroke();
    c.restore();
    if (label) D.tag(c, label, ax - Math.cos(a) * 30, ay - Math.sin(a) * 30, { size: 12, color: '#fff', bg: col });
  }
  function mgScreen(t, z) {
    if (!P) return;
    var me = S.ents.get(S.myId);
    if (S.game === 'ctf' && S.flags.length) {
      var my = S.flags[S.team], en = S.flags[1 - S.team], b = S.map.bases[S.team];
      if (me && me.carry >= 0) edgeArrow(b.fx, b.fy, '#2bd576', 'BRING IT HOME', z);
      else if (en && en[0] !== 1) edgeArrow(en[2], en[3], teamCol(1 - S.team), en[0] === 2 ? 'ENEMY FLAG (dropped)' : 'ENEMY FLAG', z);
      if (my && my[0] === 1) { var th = S.ents.get(my[1]); if (th) edgeArrow(th.x, th.y, '#ff5c6c', 'FLAG THIEF!', z); }
      else if (my && my[0] === 2) edgeArrow(my[2], my[3], teamCol(S.team), 'RETURN YOUR FLAG', z);
    }
    if (S.game === 'hide' && S.radar && now() - S.radar.t < 3500) edgeArrow(S.radar.x, S.radar.y, '#2bd576', '📡 HIDER NEAR HERE', z);
  }
  function cursorTileFloor() { var tx = Math.floor(mouse.wx / T), ty = Math.floor(mouse.wy / T); return B.inb(tx, ty) ? ty * W + tx : -1; }
  function frontDigTile() { if (!P) return -1; var x = P.x + Math.cos(P.ang) * 58, y = P.y + Math.sin(P.ang) * 58, tx = Math.floor(x / T), ty = Math.floor(y / T); return B.inb(tx, ty) ? ty * W + tx : -1; }
  function mgTarget(t) {
    if (S.game === 'spleef') {
      if (S.held === 'snow') { c.save(); c.setLineDash([6, 8]); c.lineDashOffset = -t * 30; c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(P.x, P.y - 16); var dd = Math.min(9 * T, Math.hypot(mouse.wx - P.x, mouse.wy - P.y + 16)); c.lineTo(P.x + Math.cos(P.ang) * dd, P.y - 16 + Math.sin(P.ang) * dd); c.stroke(); c.restore(); return true; }
      var ti = cursorTileFloor(); if (ti < 0 || !S.map.L[P.z || 0][ti]) return true;
      var cp = tcen(ti), ok = Math.hypot(cp.x - P.x, cp.y - P.y) <= B.REACH + 20 && ti !== Math.floor(P.y / T) * W + Math.floor(P.x / T);
      D.tileCursor(c, (ti % W) * T, ((ti / W) | 0) * T, 'floor', ok, t); return true;
    }
    if (S.game === 'hide') {
      if (S.team === 0 && S.held === 'mask') { var pr = nearProp(mouse.wx, mouse.wy); if (pr) { c.strokeStyle = 'rgba(255,209,102,' + (0.5 + Math.sin(t * 6) * 0.3) + ')'; c.lineWidth = 3; c.setLineDash([6, 6]); A.ell(c, pr.x, pr.y + 10, 28, 11); c.stroke(); c.setLineDash([]); } }
      return true;
    }
    return false;
  }
  function nearProp(wx, wy) { var best = null, bd = 1e9; (S.map.props || []).forEach(function (p) { if (Math.hypot(p.x - P.x, p.y - P.y) > 2.6 * T) return; var d = Math.hypot(p.x - wx, p.y - wy); if (d < bd) { bd = d; best = p; } }); return best; }
  // ---- actions
  function enemyClose() { var best = null, bd = B.MELEE + 10; S.ents.forEach(function (e) { if (e.id === S.myId || e.dead || e.elim || (S.game !== 'spleef' && e.team === S.team)) return; if (S.game === 'spleef' && (e.z || 0) !== (P.z || 0)) return; var d = Math.hypot(e.x - P.x, e.y - P.y); if (d < bd) { bd = d; best = e; } }); return best; }
  function digTile(ti) {
    if (ti < 0 || now() - (S.digT || 0) < 270) return; var L = S.map.L[P.z || 0];
    if (!L[ti] || ti === Math.floor(P.y / T) * W + Math.floor(P.x / T)) return;
    var cp = tcen(ti); if (Math.hypot(cp.x - P.x, cp.y - P.y) > B.REACH + 20) return;
    S.digT = now(); send({ t: 'dig', i: ti }); S.did.dig = true;
    var me = S.ents.get(S.myId); if (me) { me.swingT = 0; me.swingDir = -(me.swingDir || 1); }
    P.ang = Math.atan2(cp.y - P.y, cp.x - P.x); SC.sfx('mine');
  }
  function throwSnow(tx, ty) {
    if (!(S.inv.snow > 0)) { toast('Dig blocks with your shovel to get snowballs ❄️', 1600); SC.sfx('no'); return; }
    send({ t: 'use', it: 'snow', x: Math.round(tx), y: Math.round(ty) }); S.did.snow = true; SC.sfx('throw');
    var me = S.ents.get(S.myId); if (me) { me.swingT = 0; me.swingDir = 1; }
  }
  function disguiseNear(wx, wy) {
    var pr = nearProp(wx, wy);
    if (!pr) { toast('🎭 Walk right up to a prop (barrel, crate, bush…) to copy it', 1800); SC.sfx('no'); return; }
    send({ t: 'dis', p: pr.id }); var me = S.ents.get(S.myId); if (me) me.prop = pr.kind;
    D.burst('smoke', P.x, P.y - 10, 10); D.burst('magic', P.x, P.y - 20, 10, '#ffd166'); SC.sfx('pop'); S.did.dis = true;
    toast('🎭 You’re a ' + MG.PROPS[pr.kind].name + '! Stand still to blend in', 1800);
  }
  function doTaunt() { if (now() - (S.tauntT || 0) < 5000) { toast('Taunt is recharging…', 1000); return; } S.tauntT = now(); send({ t: 'taunt' }); S.did.taunt = true; }
  function doRadar() {
    if (snow() < S.seekAt) { toast('You’re still blindfolded!', 1200); return; }
    var left = 20000 - (now() - (S.radarT || -1e9)); if (left > 0) { toast('📡 Radar ready in ' + Math.ceil(left / 1000) + 's', 1200); return; }
    S.radarT = now(); send({ t: 'radar' }); S.did.radar = true;
  }
  function mgPrimary(it) {
    if (S.game === 'duel') return false;
    if (S.game === 'murder') { if (it === 'bow') return false; doSwing(); return true; }
    if (S.game === 'build') { if (S.phase === 'build') bbPlaceAt(cursorTileFloor(), false); return true; }
    if (S.game === 'spleef') { if (it === 'snow') { throwSnow(mouse.wx, mouse.wy); return true; } var en = enemyClose(); if (en && !touch) { var da = Math.abs(Math.atan2(en.y - P.y, en.x - P.x) - P.ang); if (da > Math.PI) da = TAU - da; if (da < 1.3) { doSwing(); return true; } } digTile(cursorTileFloor()); return true; }
    if (S.game === 'hide') {
      if (S.team === 0) { if (it === 'taunt') doTaunt(); else disguiseNear(mouse.wx, mouse.wy); return true; }
      if (it === 'radar') { doRadar(); return true; }
      S.did.swingSeek = true; return false;
    }
    return false;
  }
  function mgHold(it) {
    if (S.game === 'spleef') { if (it === 'shovel' && !touch) digTile(cursorTileFloor()); return true; }
    if (S.game === 'hide') { if (S.team === 1 && it === 'sword' && now() - (S.lastHoldSwing || 0) > 300) { doSwing(); S.did.swingSeek = true; } return true; }
    return false;
  }
  function mgSecondary() {
    if (S.game === 'duel') return true;
    if (S.game === 'murder') { if (S.mrole === 'm') toggleKnife(); return true; }
    if (S.game === 'build') { if (S.phase === 'build') bbPlaceAt(cursorTileFloor(), true); return true; }
    if (S.game === 'spleef') { throwSnow(mouse.wx, mouse.wy); return true; }
    if (S.game === 'hide') { if (S.team === 0) doTaunt(); else doRadar(); return true; }
    return false;
  }
  function mgKey(k) {
    if (S.game === 'murder' && S.mrole === 'm' && (k === 'f' || k === 'q')) { toggleKnife(); return true; }
    if (S.game === 'build' && S.phase === 'build' && k === 'r') { bbCycle(); return true; }
    if (S.game === 'hide') {
      if (S.team === 0 && k === 'e') { disguiseNear(P.x, P.y); return true; }
      if (S.team === 0 && (k === 'f' || k === 't')) { doTaunt(); return true; }
      if (S.team === 1 && (k === 'f' || k === 'r' || k === 'e')) { doRadar(); return true; }
    }
    if (S.game === 'spleef' && (k === 'f' || k === 'e')) { throwSnow(P.x + Math.cos(P.ang) * 200, P.y + Math.sin(P.ang) * 200); return true; }
    return false;
  }
  function mgTouch(btn) {
    if (!P || P.dead) return true;
    if (S.game === 'duel') { if (btn === 'atk') { var en2 = enemyClose(); if (en2) P.ang = Math.atan2(en2.y - P.y, en2.x - P.x); doSwing(); } return true; }
    if (S.game === 'murder') {
      if (btn === 'atk') { if (S.mrole === 'm' && S.held !== 'knife') { toggleKnife(); return true; } var en3 = enemyClose(); if (en3) P.ang = Math.atan2(en3.y - P.y, en3.x - P.x); doSwing(); return true; }
      if (btn === 'place') { if (S.mrole === 'm') toggleKnife(); return true; }
      if (btn === 'use') { if (S.inv && S.inv.bow) { var tgt = null, bd2 = 9.5 * T; S.ents.forEach(function (o) { if (o.id === S.myId || o.dead || o.elim) return; var d2 = Math.hypot(o.x - P.x, o.y - P.y); if (d2 < bd2) { bd2 = d2; tgt = o; } }); if (tgt) { send({ t: 'bow', ang: Math.atan2(tgt.y - P.y, tgt.x - P.x), pow: 1 }); SC.sfx('bow'); } } return true; }
      return true;
    }
    if (S.game === 'build') { if (S.phase !== 'build') return true; if (btn === 'atk') bbPlaceAt(frontDigTile(), false); else if (btn === 'place') bbPlaceAt(frontDigTile(), true); return true; }
    if (S.game === 'spleef') {
      if (btn === 'atk') { var en = enemyClose(); if (en) { P.ang = Math.atan2(en.y - P.y, en.x - P.x); doSwing(); } else digTile(frontDigTile()); return true; }
      if (btn === 'place') { doHop(); return true; }
      if (btn === 'use') { var best = null, bd = 9 * T; S.ents.forEach(function (e) { if (e.id === S.myId || e.dead || e.elim || (e.z || 0) !== (P.z || 0)) return; var d = Math.hypot(e.x - P.x, e.y - P.y); if (d < bd) { bd = d; best = e; } }); if (best) throwSnow(best.x, best.y); else throwSnow(P.x + Math.cos(P.ang) * 220, P.y + Math.sin(P.ang) * 220); return true; }
    }
    if (S.game === 'hide') {
      if (S.team === 0) { if (btn === 'atk') disguiseNear(P.x, P.y); else if (btn === 'place') doTaunt(); return true; }
      if (btn === 'use') { doRadar(); return true; }
      if (btn === 'place') return true;
      S.did.swingSeek = true; return false;
    }
    return false;
  }
  // ---- HUD
  function mgHudInit() {
    $('mgTop').classList.toggle('hidden', !isMini());
    $('blind').classList.add('hidden');
    var ic = { bw: ['⚔️', '🧱', '✨'], ctf: ['⚔️', '🧱', '✨'], spleef: ['⛏️', '⤴️', '❄️'], hide: S.team === 0 ? ['🎭', '🎵', ''] : ['⚔️', '', '📡'],
      duel: ['⚔️', '', ''], murder: S.mrole === 'm' ? ['🔪', '✊', ''] : ['🤜', '', '🏹'], build: ['🧱', '🧽', ''] }[S.game];
    if (S.game === 'murder' && S.mrole === 'm') ic = ['🔪', '✊', ''];
    $('mgRole').classList.toggle('hidden', S.game !== 'hide' && S.game !== 'murder');
    if (S.game === 'murder') $('mgRole').innerHTML = S.mrole === 'm' ? '<span class="ic">🔪</span><div>MURDERER<small>Hold the knife to strike · don’t get seen</small></div>' : S.mrole === 'd' ? '<span class="ic">🕵️</span><div>DETECTIVE<small>Shoot the murderer · don’t miss</small></div>' : '<span class="ic">😇</span><div>INNOCENT<small>Collect 10 🪙 for a bow · survive</small></div>';
    $('tAtk').textContent = ic[0]; $('tPlace').textContent = ic[1]; $('tUse').textContent = ic[2];
    $('tPlace').style.visibility = ic[1] ? '' : 'hidden'; $('tUse').style.visibility = ic[2] ? '' : 'hidden';
    if (S.game === 'hide') $('mgRole').innerHTML = S.team === 0 ? '<span class="ic">🎭</span><div>HIDER<small>Copy a prop · stand still · survive</small></div>' : '<span class="ic">🔍</span><div>SEEKER<small>Hit the fake props · F = radar</small></div>';
    renderHotbar(); mgHudTick(true); bbUISync();
  }
  function mgTimer(el) {
    var sn = snow(), tm = $('tmT'), nx = $('tmN');
    if (S.game === 'ctf') { tm.textContent = B.fmtTime((S.endAt - sn) / 1000); nx.textContent = 'First to ' + MG.GAMES.ctf.caps + ' captures'; }
    else if (S.game === 'hide') { if (sn < S.seekAt) { tm.textContent = B.fmtTime((S.seekAt - sn) / 1000); nx.textContent = 'Hiding time'; } else { tm.textContent = B.fmtTime((S.endAt - sn) / 1000); nx.textContent = 'Hiders survive in'; } }
    else if (S.game === 'spleef') { tm.textContent = B.fmtTime(el); nx.textContent = sn < S.sdAt ? 'Sudden death in ' + B.fmtTime((S.sdAt - sn) / 1000) : '💥 SUDDEN DEATH'; }
    else if (S.game === 'duel') { tm.textContent = B.fmtTime((S.endAt - sn) / 1000); nx.textContent = 'First to ' + MG.GAMES.duel.wins + ' kills'; }
    else if (S.game === 'murder') { tm.textContent = B.fmtTime((S.endAt - sn) / 1000); nx.textContent = 'Innocents survive in'; }
    else if (S.game === 'build') { if (S.phase === 'build') { tm.textContent = B.fmtTime((S.buildEnd - sn) / 1000); nx.textContent = '🏗️ ' + S.theme; } else { tm.textContent = S.phase === 'vote' ? 'VOTE' : 'DONE'; nx.textContent = S.theme; } }
  }
  function mgHudTick(force) {
    if (!force && now() - (S.mgTopT || 0) < 200) { tutTick(); return; } S.mgTopT = now();
    var h = '';
    if (S.game === 'ctf') {
      var fl = S.flags || [];
      var fs2 = function (t2) { var f = fl[t2] || [0]; return f[0] === 0 ? '🏠 home' : f[0] === 1 ? '🏃 taken!' : '⚠️ dropped'; };
      h = '<div class="sc"><span class="sq" style="background:' + teamCol(0) + '">🚩</span>' + (S.score[0] || 0) + '</div><div class="fs"><b style="color:' + teamCol(0) + '">' + fs2(0) + '</b><b style="color:' + teamCol(1) + '">' + fs2(1) + '</b></div><div class="sc">' + (S.score[1] || 0) + '<span class="sq" style="background:' + teamCol(1) + '">🚩</span></div>';
    } else if (S.game === 'spleef') {
      var al = 0, tot = 0; S.ents.forEach(function (e) { tot++; if (!e.elim) al++; });
      h = '<span class="pill">👥 ' + al + '/' + tot + ' left</span><span class="pill">⬇️ Floor ' + ((P ? P.z || 0 : 0) + 1) + '/' + MG.SP_LAYERS + '</span>' + (snow() >= S.sdAt ? '<span class="pill hot">💥 SUDDEN DEATH</span>' : '') + '<span class="pill">❄️ ' + (S.inv.snow || 0) + '</span>';
    } else if (S.game === 'hide') {
      var hd = 0, sk = 0; S.ents.forEach(function (e) { if (e.dead && e.team === 0) return; if (e.team === 0) hd++; else sk++; });
      h = '<span class="pill" style="color:#2bd576">🎭 ' + hd + ' hiding</span><span class="pill" style="color:#ff8b98">🔍 ' + sk + ' seeking</span>' + (S.team === 1 ? '<span class="pill">📡 ' + (now() - (S.radarT || -1e9) >= 20000 ? 'ready (F)' : Math.ceil((20000 - (now() - S.radarT)) / 1000) + 's') + '</span>' : '<span class="pill">🎵 ' + (now() - (S.tauntT || -1e9) >= 5000 ? 'taunt (F)' : '…') + '</span>');
      var bl = $('blind'), blind = S.team === 1 && snow() < S.seekAt && S.screen === 'game';
      bl.classList.toggle('hidden', !blind);
      if (blind) bl.innerHTML = '<div class="big">🙈 YOU’RE BLINDFOLDED</div><div class="sub">The hiders are picking their disguises…</div><div class="cd">' + Math.max(0, Math.ceil((S.seekAt - snow()) / 1000)) + '</div><div class="sub">Tip: props that move, taunt or talk are hiders!</div>';
    } else if (S.game === 'duel') {
      var rk = MG.rankOf(S.myElo);
      h = '<div class="sc"><span class="sq" style="background:' + teamCol(0) + '">⚔️</span>' + (S.score[0] || 0) + '</div><div class="fs"><b style="color:' + rk.color + '">' + rk.name.toUpperCase() + '</b>' + S.myElo + '</div><div class="sc">' + (S.score[1] || 0) + '<span class="sq" style="background:' + teamCol(1) + '">⚔️</span></div>';
    } else if (S.game === 'murder') {
      var alive2 = 0; S.ents.forEach(function (e) { if (!e.dead && !e.elim) alive2++; });
      h = '<span class="pill">👥 ' + alive2 + ' alive</span>' + (S.mrole === 'm' ? '<span class="pill hot">🔪 you are the murderer</span>' : '<span class="pill" style="color:#ffd166">🪙 ' + (S.gold || 0) + (S.inv && S.inv.bow ? '</span><span class="pill">🏹 ' + (S.inv.arrows || 0) : '/10') + '</span>');
    } else if (S.game === 'build') {
      h = '<span class="pill" style="color:#ffd166">🏗️ ' + esc(S.theme) + '</span>' + (S.phase === 'build' ? '<span class="pill">build on YOUR plot</span>' : S.phase === 'vote' ? '<span class="pill hot">⭐ VOTING</span>' : '<span class="pill">🏆 results</span>');
    }
    if ($('mgTop').innerHTML !== h) $('mgTop').innerHTML = h;
    tutTick();
  }
  function mgPrompt(pr) {
    if (S.game === 'hide' && S.team === 0 && P && !P.dead) { var p = nearProp(P.x, P.y); if (p) { pr.classList.remove('hidden'); pr.textContent = (touch ? '🎭 Tap to become a ' : 'E · Become a ') + MG.PROPS[p.kind].name; return true; } }
    return false;
  }
  function mgDeath(d, killer, final, kind) {
    if (S.game === 'duel') {
      d.innerHTML = '<div class="big">SLAIN!</div><div class="sub">' + (killer ? '<span style="color:' + teamCol(killer.team) + '">' + esc(killer.nick) + '</span> got you · ' : '') + '<b>' + S.score[0] + ' – ' + S.score[1] + '</b></div><div class="sub" style="margin:0">Back in</div><div class="cd" id="deathCd">3</div>';
      d.style.pointerEvents = 'none'; return true;
    }
    if (S.game === 'murder') {
      var who = kind === 'justice' ? 'You shot an innocent! The town turned on you.' : killer ? (S.det && killer.id === S.det ? 'The detective got you' : esc(killer.nick) + ' got you') : 'You’re out';
      d.innerHTML = '<div class="big" style="color:#ff5c6c">' + (S.mrole === 'm' ? 'CAUGHT!' : kind === 'justice' ? 'JUSTICE!' : 'MURDERED!') + '</div><div class="sub">' + who + '</div><div class="sub" style="font-size:15px;color:#cfc8ff">👻 You can spectate until the round ends — don’t tell anyone who did it!</div><div class="flex" style="flex-wrap:wrap;justify-content:center"><button class="btn" id="dSpec">👀 Spectate</button><button class="btn green" id="dAgain">▶ New game</button><button class="btn" id="dHub">🏠 Hub</button></div>';
      $('dAgain').onclick = playAgain; $('dSpec').onclick = function () { d.classList.add('hidden'); }; $('dHub').onclick = function () { send({ t: 'hub' }); };
      d.style.pointerEvents = 'auto'; return true;
    }
    if (S.game === 'spleef') {
      var left = 0; S.ents.forEach(function (e) { if (!e.elim && e.id !== S.myId) left++; });
      d.innerHTML = '<div class="big">YOU FELL!</div><div class="sub">' + (killer ? 'Knocked off by <span style="color:' + teamCol(killer.team) + '">' + esc(killer.nick) + '</span> · ' : '') + 'You placed <b style="color:#ffd166">#' + (left + 1) + '</b></div><div class="sub" style="font-size:15px;color:#cfc8ff">Watch who wins, or jump into another round.</div><div class="flex" style="flex-wrap:wrap;justify-content:center"><button class="btn green" id="dAgain">▶ New game</button><button class="btn" id="dSpec">👀 Keep watching</button><button class="btn" id="dHub">🏠 Hub</button></div>';
      $('dAgain').onclick = playAgain; $('dSpec').onclick = function () { d.classList.add('hidden'); }; $('dHub').onclick = function () { send({ t: 'hub' }); };
      d.style.pointerEvents = 'auto'; return true;
    }
    if (S.game === 'hide' && S.team === 0) {
      d.innerHTML = '<div class="big" style="color:#ffd166">FOUND!</div><div class="sub">' + (killer ? '<span style="color:#ff8b98">' + esc(killer.nick) + '</span> found you' : 'You were found') + '</div><div class="sub" style="margin:0">You’ll come back as a 🔍 SEEKER in</div><div class="cd" id="deathCd">4</div>';
      d.style.pointerEvents = 'none'; return true;
    }
    if (S.game === 'hide') { d.innerHTML = '<div class="big">OUCH!</div><div class="sub">' + (kind === 'prop' ? 'Too many wrong props!' : 'You went down') + '</div><div class="sub" style="margin:0">Back in</div><div class="cd" id="deathCd">5</div>'; d.style.pointerEvents = 'none'; return true; }
    if (S.game === 'ctf') {
      var carried = ''; d.innerHTML = '<div class="big">YOU DIED!</div><div class="sub">' + (killer ? (kind === 'void' ? 'Knocked into the void by ' : 'Killed by ') + '<span style="color:' + teamCol(killer.team) + '">' + esc(killer.nick) + '</span>' : kind === 'void' ? 'You fell into the void' : '') + carried + '</div><div class="sub" style="margin:0">Respawning in</div><div class="cd" id="deathCd">4</div>';
      d.style.pointerEvents = 'none'; return true;
    }
    return false;
  }
  function mgScore() {
    var rows = '<table>';
    if (S.game === 'ctf') {
      rows += '<tr><th></th><th>Player</th><th>Status</th></tr>';
      for (var t2 = 0; t2 < 2; t2++) {
        rows += '<tr class="tm"><td colspan="3" style="color:' + teamCol(t2) + '">' + tname(t2) + ' · ' + (S.score[t2] || 0) + ' 🚩</td></tr>';
        S.ents.forEach(function (e) { if (e.team !== t2) return; rows += '<tr' + (e.id === S.myId ? ' style="color:var(--gold)"' : '') + '><td>' + (e.carry >= 0 ? '🚩' : e.dead ? '⏳' : '') + '</td><td>' + (e.bot ? '🤖 ' : '') + esc(e.nick) + '</td><td>' + (e.carry >= 0 ? 'has the flag!' : e.dead ? 'respawning' : 'alive') + '</td></tr>'; });
      }
    } else if (S.game === 'spleef') {
      rows += '<tr><th></th><th>Player</th><th>Floor</th></tr>';
      var arr = Array.from(S.ents.values()).sort(function (a, b) { return (a.elim - b.elim) || ((a.z || 0) - (b.z || 0)); });
      arr.forEach(function (e) { rows += '<tr' + (e.id === S.myId ? ' style="color:var(--gold)"' : '') + '><td>' + (e.elim ? '💀' : '❄️') + '</td><td style="color:' + teamCol(e.team) + '">' + (e.bot ? '🤖 ' : '') + esc(e.nick) + '</td><td>' + (e.elim ? 'out' : ((e.id === S.myId ? P.z : e.z) || 0) + 1) + '</td></tr>'; });
    } else if (S.game === 'duel') {
      rows += '<tr><th></th><th>Player</th><th>Kills</th></tr>';
      S.ents.forEach(function (e) { rows += '<tr' + (e.id === S.myId ? ' style="color:var(--gold)"' : '') + '><td>⚔️</td><td style="color:' + teamCol(e.team) + '">' + (e.bot ? '🤖 ' : '') + esc(e.nick) + '</td><td>' + (S.score[e.team] || 0) + '</td></tr>'; });
    } else if (S.game === 'murder') {
      rows += '<tr><th></th><th>Player</th><th></th></tr>';
      S.ents.forEach(function (e) { rows += '<tr' + (e.id === S.myId ? ' style="color:var(--gold)"' : '') + '><td>' + (e.dead || e.elim ? '💀' : e.id === S.det ? '🕵️' : '😶') + '</td><td>' + (e.bot ? '🤖 ' : '') + esc(e.nick) + '</td><td>' + (e.dead || e.elim ? 'dead' : 'alive') + '</td></tr>'; });
      rows += '<tr><td colspan="3" style="color:var(--mut)">Roles are secret until the end 🤫</td></tr>';
    } else if (S.game === 'build') {
      rows += '<tr><th></th><th>Builder</th><th>Plot</th></tr>';
      (S.plotOwners || []).forEach(function (o, k) { if (o) rows += '<tr' + (o.id === S.myId ? ' style="color:var(--gold)"' : '') + '><td>🏗️</td><td>' + (o.bot ? '🤖 ' : '') + esc(o.nick) + '</td><td>' + (k + 1) + '</td></tr>'; });
    } else {
      rows += '<tr><th></th><th>Player</th><th>Role</th></tr>';
      S.ents.forEach(function (e) { var hid = e.team === 0; if (hid && S.team !== 0 && e.id !== S.myId) return; rows += '<tr' + (e.id === S.myId ? ' style="color:var(--gold)"' : '') + '><td>' + (hid ? '🎭' : '🔍') + '</td><td>' + (e.bot ? '🤖 ' : '') + esc(e.nick) + '</td><td>' + (hid ? (e.prop ? MG.PROPS[e.prop].name : 'hider') : 'seeker') + '</td></tr>'; });
      if (S.team !== 0) rows += '<tr><td colspan="3" style="color:var(--mut)">Hiders are secret until the round ends 🤫</td></tr>';
    }
    return rows + '</table>';
  }
  function mgEndSub(m, win) {
    var me = (m.stats || []).find(function (x) { return x.id === m.you; }) || {};
    if (m.game === 'ctf') $('eSub').innerHTML = (m.winner >= 0 ? '<span style="color:' + teamCol(m.winner) + '">' + tname(m.winner) + ' team</span> captures the win! ' : 'It’s a tie! ') + '<b>' + (m.score ? m.score[0] + ' – ' + m.score[1] : '') + '</b>';
    if (m.game === 'spleef') { var w = (m.stats || []).find(function (x) { return x.team === m.winner; }); $('eSub').innerHTML = (w ? '<span style="color:' + teamCol(w.team) + '">' + esc(w.nick) + '</span> is the last one standing!' : 'Nobody survived!') + ' · You placed <b style="color:#ffd166">#' + (me.place || '?') + '</b>'; }
    if (m.game === 'hide') $('eSub').innerHTML = m.winner === 0 ? '🎭 The hiders survived!' : '🔍 The seekers found everyone!';
    if (m.game === 'duel') {
      var eloTxt = '';
      if (m.elo && m.elo[m.you]) { var q = m.elo[m.you]; var rk2 = MG.rankOf(q.r); S.myElo = q.r; eloTxt = ' · <b style="color:' + rk2.color + '">' + rk2.name + ' ' + q.r + '</b> (' + (q.d >= 0 ? '+' : '') + q.d + ')'; }
      $('eSub').innerHTML = (m.winner >= 0 ? '<span style="color:' + teamCol(m.winner) + '">' + tname(m.winner) + '</span> wins <b>' + (m.score ? m.score[0] + ' – ' + m.score[1] : '') + '</b>' : 'Draw!') + eloTxt;
    }
    if (m.game === 'murder') { var mm2 = (m.stats || []).find(function (x) { return x.id === m.murderer; }); $('eSub').innerHTML = (m.winner === 1 ? '🔪 The murderer wins!' : '😇 The innocents win!') + (mm2 ? ' The murderer was <b style="color:#ff5c6c">' + esc(mm2.nick) + '</b>' : ''); }
    if (m.game === 'build') { var r1 = m.results && m.results[0]; $('eSub').innerHTML = '🏗️ Theme: <b>' + esc(m.theme || '') + '</b>' + (r1 ? ' · <span style="color:#ffd166">' + esc(r1.nick) + '</span> won with ' + r1.avg + ' ⭐' : ''); }
    void win;
  }
  function mgEndTable(m) {
    var st = m.stats.slice(), head, row;
    if (m.game === 'ctf') { st.sort(function (a, b) { return (b.caps * 5 + b.kills + b.rets * 2) - (a.caps * 5 + a.kills + a.rets * 2); }); head = '<th>Caps</th><th>Kills</th><th>Returns</th><th>Deaths</th>'; row = function (s) { return '<td>' + (s.caps || 0) + '</td><td>' + s.kills + '</td><td>' + (s.rets || 0) + '</td><td>' + s.deaths + '</td>'; }; }
    else if (m.game === 'spleef') { st.sort(function (a, b) { return (a.place || 99) - (b.place || 99); }); head = '<th>Place</th><th>Knock-offs</th><th>Blocks dug</th>'; row = function (s) { return '<td>' + (['🥇', '🥈', '🥉'][s.place - 1] || '#' + (s.place || '?')) + '</td><td>' + (s.knocks || 0) + '</td><td>' + (s.digs || 0) + '</td>'; }; }
    else if (m.game === 'duel') { st.sort(function (a, b) { return b.kills - a.kills; }); head = '<th>Kills</th><th>Best streak</th>'; row = function (s) { return '<td>' + s.kills + '</td><td>' + (s.best || 0) + '</td>'; }; }
    else if (m.game === 'murder') { st.sort(function (a, b) { return (b.role === 'm' ? 5 : 0) + b.kills - ((a.role === 'm' ? 5 : 0) + a.kills); }); head = '<th>Role</th><th>Kills</th><th>Gold</th><th>Survived</th>'; row = function (s) { return '<td>' + (s.role === 'm' ? '🔪 Murderer' : s.role === 'd' ? '🕵️ Detective' : '😇 Innocent') + '</td><td>' + s.kills + '</td><td>' + (s.gold || 0) + '</td><td>' + (s.survived ? '✅' : '–') + '</td>'; }; }
    else if (m.game === 'build') { st.sort(function (a, b) { return (a.place || 9) - (b.place || 9); }); head = '<th>Place</th><th>Stars</th><th>Pieces</th>'; row = function (s) { return '<td>' + (['🥇', '🥈', '🥉'][s.place - 1] || '#' + (s.place || '?')) + '</td><td>' + (s.score || '–') + ' ⭐</td><td>' + (s.placed || 0) + '</td>'; }; }
    else { st.sort(function (a, b) { return (b.finds * 3 + b.taunts + (b.survived ? 5 : 0)) - (a.finds * 3 + a.taunts + (a.survived ? 5 : 0)); }); head = '<th>Started as</th><th>Found</th><th>Taunts</th><th>Survived</th>'; row = function (s) { return '<td>' + (s.team === 0 || s.survived ? '🎭' : '🔍') + '</td><td>' + (s.finds || 0) + '</td><td>' + (s.taunts || 0) + '</td><td>' + (s.survived ? '✅' : '–') + '</td>'; }; }
    return '<tr><th>#</th><th>Player</th>' + head + '</tr>' + st.map(function (s, i) { return '<tr' + (s.id === m.you ? ' class="you"' : '') + '><td>' + (i + 1) + '</td><td><b style="color:' + (m.game === 'hide' ? (s.team === 0 ? '#2bd576' : '#ff8b98') : teamCol(s.team)) + '">' + (s.bot ? '🤖 ' : '') + esc(s.nick) + '</b></td>' + row(s) + '</tr>'; }).join('');
  }
  function introText() {
    var tm = B.TEAMS[S.team] || B.TEAMS[0];
    if (S.game === 'ctf') return ['You are on the', tm.name.toUpperCase() + ' TEAM', tm.color, '🚩 Steal their flag · bring it home · first to ' + MG.GAMES.ctf.caps];
    if (S.game === 'spleef') return ['Welcome to', 'TNT SPLEEF', '#7dd3fc', '❄️ Keep moving — the floor crumbles behind you. Last one standing wins!'];
    if (S.game === 'hide') return S.team === 0 ? ['You are a', 'HIDER 🎭', '#2bd576', 'Copy a prop and hide! The seekers come out in ' + MG.GAMES.hide.hideSec + 's'] : ['You are a', 'SEEKER 🔍', '#ff5c6c', 'Hiders are disguised as props. Hit the fakes!'];
    if (S.game === 'duel') { var rk3 = MG.rankOf(S.myElo); return ['1v1 · first to ' + MG.GAMES.duel.wins, 'DUEL ⚔️', rk3.color, 'Sprint for knockback, jump for crits. Don’t fall off!']; }
    if (S.game === 'murder') return S.mrole === 'm' ? ['Shhh… you are the', 'MURDERER 🔪', '#ff5c6c', 'F draws your knife. One hit kills. Don’t get seen!'] : S.mrole === 'd' ? ['You are the', 'DETECTIVE 🕵️', '#3fa9ff', 'You have a bow. Find the murderer and don’t miss!'] : ['You are', 'INNOCENT 😇', '#2bd576', 'Collect 10 🪙 for a bow. Stay with people you trust…'];
    if (S.game === 'build') return ['Build this theme:', (S.theme || '???').toUpperCase() + ' 🏗️', '#ffd166', MG.GAMES.build.buildSec + ' seconds on your plot — then everyone votes!'];
    return ['You are on the', tm.name.toUpperCase() + ' TEAM', tm.color, '🛏 Protect your bed · ⚔️ Destroy the others'];
  }
  function mgEvent(k, ev) {
    var e, p;
    if (k === 'take') { e = S.ents.get(ev[1]); if (S.flags[ev[2]]) { S.flags[ev[2]][0] = 1; S.flags[ev[2]][1] = ev[1]; } if (e) e.carry = ev[2];
      feed(nameHtml(e) + ' grabbed the <b style="color:' + teamCol(ev[2]) + '">' + tname(ev[2]) + ' flag</b> 🚩');
      if (ev[1] === S.myId) { banner('YOU HAVE THE FLAG!', 'Run it back to your own flag!', '#ffd166'); SC.sfx('flag'); S.did.take = true; }
      else if (ev[2] === S.team) { banner('YOUR FLAG WAS TAKEN!', 'Stop ' + (e ? esc(e.nick) : 'them') + '!', '#ff5c6c'); SC.sfx('alarm'); }
      else SC.sfx('flag'); return true; }
    if (k === 'drop') { e = S.ents.get(ev[1]); if (e) e.carry = -1; if (S.flags[ev[2]]) S.flags[ev[2]] = [2, 0, ev[3], ev[4]]; feed(nameHtml(e) + ' dropped the <b style="color:' + teamCol(ev[2]) + '">' + tname(ev[2]) + ' flag</b>'); if (ev[2] === S.team) toast('⚠️ Your flag is on the ground — touch it to send it home!', 2400); return true; }
    if (k === 'ret') { e = S.ents.get(ev[1]); var b = S.map.bases[ev[2]]; if (S.flags[ev[2]] && b) S.flags[ev[2]] = [0, 0, b.fx, b.fy]; S.ents.forEach(function (x) { if (x.carry === ev[2]) x.carry = -1; }); feed('<b style="color:' + teamCol(ev[2]) + '">' + tname(ev[2]) + ' flag</b> went home' + (e ? ' — returned by ' + nameHtml(e) : '')); sfxAt('pop', b ? b.fx : 0, b ? b.fy : 0); return true; }
    if (k === 'cap') {
      e = S.ents.get(ev[1]); S.score = [ev[3], ev[4]]; if (e) e.carry = -1;
      var bb = S.map.bases[ev[2]]; if (S.flags[ev[2]] && bb) S.flags[ev[2]] = [0, 0, bb.fx, bb.fy];
      var ct = e ? e.team : 1 - ev[2], hb = S.map.bases[ct];
      banner(tname(ct).toUpperCase() + ' SCORES!', (e ? esc(e.nick) + ' captured the flag · ' : '') + ev[3] + ' – ' + ev[4], teamCol(ct));
      if (hb) { for (var q = 0; q < 4; q++) setTimeout(function () { D.burst('star', hb.fx + (Math.random() - 0.5) * 80, hb.fy - 40, 10, teamCol(ct)); D.ring(hb.fx, hb.fy, teamCol(ct), 120, 0.6, 8); }, q * 180); D.flash(hb.fx, hb.fy, 200, '255,255,255', 0.35); }
      SC.sfx('score'); S.shake = Math.max(S.shake, 6); feed('🚩 ' + nameHtml(e) + ' <b style="color:#ffd166">CAPTURED</b> the flag!', true);
      if (ev[1] === S.myId) { S.did.cap = true; toastBig('+1 CAPTURE!', '#ffd166'); }
      return true;
    }
    if (k === 'pu') { S.pickups[ev[1]] = ev[2]; var sp = (S.map.pickSpots || [])[ev[1]]; if (sp) { D.burst('magic', sp.x, sp.y - 20, 10, '#ffd166'); sfxAt('pop2', sp.x, sp.y); } return true; }
    if (k === 'put') { S.pickups[ev[1]] = ''; if (ev[2] === S.myId) { SC.sfx('buy'); toast('+ ' + (ev[3] === 'arrows' ? '8 Arrows' : ev[3] === 'wool' ? '16 Wool' : B.ITEM_NAMES[ev[3]] || ev[3]), 1400); } return true; }
    if (k === 'sp') {
      var z = ev[1], i = ev[2], st = ev[3]; if (!S.map.L) return true;
      var was = S.map.L[z][i]; S.map.L[z][i] = st;
      if (st === 2) { S.crk[z * NN + i] = now(); if (ev[4] && z === viewZ()) { var c1 = tcen(i); D.burst('cube', c1.x, c1.y, 3, D.SPC[MG.SP.kinds[z]].side, { speed: 60 }); sfxAt('crack', c1.x, c1.y); } }
      else if (st === 0 && was) { delete S.crk[z * NN + i]; spGone(z, i); if (z === viewZ()) { var c2 = tcen(i); D.burst('cube', c2.x, c2.y + 6, 5, D.SPC[MG.SP.kinds[z]].top, { speed: 90 }); if (Math.random() < 0.35) sfxAt('break', c2.x, c2.y); } }
      return true;
    }
    if (k === 'fall') { e = S.ents.get(ev[1]); if (e) { e.spFall = true; e.spFallT = now(); p = entPos(e); sfxAt('fall', p.x, p.y); } return true; }
    if (k === 'land') { e = S.ents.get(ev[1]); if (e) { e.spFall = false; if (e.id !== S.myId) e.z = ev[2]; e.buf = []; p = entPos(e); if (ev[2] === viewZ()) D.burst('dust', p.x, p.y, 8); } return true; }
    if (k === 'sd') { banner('💥 SUDDEN DEATH!', 'The floors are falling apart on their own!', '#ff5c6c'); SC.sfx('alarm'); return true; }
    if (k === 'phase') { S.phase = 'seek'; if (S.team === 1) banner('GO FIND THEM! 🔍', 'Hit props that look suspicious', '#ff5c6c'); else banner('THE SEEKERS ARE OUT!', 'Stay still… don’t make a sound 🤫', '#ffd166'); SC.sfx('go'); $('blind').classList.add('hidden'); return true; }
    if (k === 'taunt') {
      e = S.ents.get(ev[1]); var tx = ev[2], ty = ev[3];
      sfxAt('taunt' + (ev[5] % TAUNTS.length), tx, ty);
      for (var n2 = 0; n2 < 4; n2++) setTimeout(function () { D.text(tx + (Math.random() - 0.5) * 40, ty - 40, Math.random() < 0.5 ? '♪' : '♫', '#ffd166', 22, { vy: -60, life: 1.2 }); }, n2 * 120);
      if (ev[1] === S.myId) { S.did.taunt = true; if (!ev[4]) toast('🎵 Taunted! +3 Scrolls at the end', 1400); else toast('🎵 Auto-taunt! Hiders make a sound every 30 seconds', 1800); }
      return true;
    }
    if (k === 'dis') { e = S.ents.get(ev[1]); if (e) { e.prop = MG.PROP_KINDS[ev[2]]; p = entPos(e); D.burst('smoke', p.x, p.y - 10, 8); } return true; }
    if (k === 'found') {
      e = S.ents.get(ev[1]); var fa = S.ents.get(ev[2]);
      if (e) { e.team = 1; e.prop = ''; }
      D.burst('star', ev[3], ev[4] - 20, 14, '#ffd166'); D.ring(ev[3], ev[4], '#ffd166', 70, 0.5, 6);
      feed('🔍 ' + (fa ? nameHtml(fa) : 'Someone') + ' found ' + nameHtml(e) + (ev[5] ? ' (the ' + MG.PROPS[ev[5]].name + ')' : ''), true);
      if (ev[2] === S.myId) { toastBig('FOUND ONE! 🎉', '#ffd166'); SC.sfx('final'); S.did.find = true; }
      return true;
    }
    if (k === 'dscore') {
      S.score = [ev[1], ev[2]];
      var sc = S.ents.get(ev[3]);
      if (ev[3] === S.myId) { toastBig('+1 KILL!', '#ffd166'); SC.sfx('final'); }
      else if (sc) { banner(esc(sc.nick) + ' SCORES', S.score[0] + ' – ' + S.score[1], teamCol(sc.team)); SC.sfx('alarm'); }
      return true;
    }
    if (k === 'gold') {
      if (!S.golds) S.golds = new Map();
      if (ev[3]) { S.golds.set(ev[1], ev[2]); var gc = tcen(ev[2]); if (Math.random() < 0.6) D.burst('magic', gc.x, gc.y - 10, 4, '#ffd166'); }
      else { S.golds.delete(ev[1]); var gc2 = tcen(ev[2]); D.burst('star', gc2.x, gc2.y - 14, 6, '#ffd166'); if (ev[4] === S.myId) { SC.sfx('res'); } else sfxAt('pop2', gc2.x, gc2.y); }
      return true;
    }
    if (k === 'mbow') { e = S.ents.get(ev[1]); if (ev[1] === S.myId) { toastBig('🏹 BOW UNLOCKED!', '#ffd166'); SC.sfx('level'); } else if (e) feed(nameHtml(e) + ' collected 10 gold and got a 🏹 bow!'); return true; }
    if (k === 'mdead') { e = S.ents.get(ev[1]); banner('THE MURDERER IS DOWN!', (e ? esc(e.nick) + ' was the murderer. ' : '') + 'The town is safe 🎉', '#2bd576'); SC.sfx('final'); return true; }
    if (k === 'justice') { e = S.ents.get(ev[1]); var v2 = S.ents.get(ev[2]); banner('WRONG TARGET!', (e ? esc(e.nick) : 'Someone') + ' shot an innocent' + (v2 ? ' (' + esc(v2.nick) + ')' : '') + '…', '#ff5c6c'); SC.sfx('no'); return true; }
    if (k === 'bb') { bbApplyLocal(ev[1], ev[2], ev[3], ev[4], S.map); return true; }
    if (k === 'bbphase') { S.phase = 'vote'; banner('⏰ TIME’S UP!', 'Walk through the builds and vote ⭐', '#ffd166'); SC.sfx('alarm'); bbUISync(); return true; }
    if (k === 'bbvote') { if (ev[1] !== S.myId) { e = S.ents.get(ev[1]); if (e) { p = entPos(e); D.text(p.x, p.y - 56, '⭐', '#ffd166', 18, { vy: -40, life: 0.8 }); } } return true; }
    if (k === 'miss') { S.propWob[ev[2]] = now(); var pr = S.map.props && S.map.props[ev[2]]; if (pr) D.burst('dust', pr.x, pr.y, 5); if (ev[1] === S.myId) { toast('❌ Just a real prop! (−½ ❤)', 1100); SC.sfx('no'); } return true; }
    return false;
  }

  // ---- Duels / Murder / Build helpers
  function toggleKnife() {
    if (S.mrole !== 'm') return;
    var to = S.held === 'knife' ? 'fists' : 'knife';
    S.held = to; send({ t: 'sel', it: to }); renderHotbar(); SC.sfx(to === 'knife' ? 'draw' : 'click');
    toast(to === 'knife' ? '🔪 Knife out — one hit kills. Don’t get seen!' : '✊ Knife hidden', 1400);
  }
  function murderDrawables(list, t) {
    if (!S.golds) return;
    S.golds.forEach(function (tile, id) {
      var p2 = tcen(tile);
      list.push({ k: 'fn', y: p2.y + 2, fn: function () {
        var b = Math.sin(t * 3 + id) * 3;
        c.save(); c.globalCompositeOperation = 'lighter';
        var g = c.createRadialGradient(p2.x, p2.y - 10, 2, p2.x, p2.y - 10, 24); g.addColorStop(0, 'rgba(255,209,102,.4)'); g.addColorStop(1, 'rgba(255,209,102,0)');
        c.fillStyle = g; A.circ(c, p2.x, p2.y - 10, 24); c.fill(); c.restore();
        c.fillStyle = 'rgba(10,6,30,.25)'; A.ell(c, p2.x, p2.y + 4, 10, 4); c.fill();
        c.save(); c.translate(p2.x, p2.y - 10 + b); c.rotate(Math.sin(t * 2 + id) * 0.25); D.drawItem(c, 'goldI', 1); c.restore();
      } });
    });
  }
  function buildDrawables(list, t) {
    var m = S.map; if (!m.plots) return;
    m.plots.forEach(function (pl, k) {
      var o = (S.plotOwners || [])[k];
      var x0 = pl.x0 * T, y0 = pl.y0 * T, x1 = (pl.x1 + 1) * T, y1 = (pl.y1 + 1) * T;
      list.push({ k: 'fn', y: y0 - 60, fn: function () {
        var mine = S.phase === 'build' && k === S.team, judging = S.phase === 'vote' && k === S.votePlot;
        c.strokeStyle = judging ? '#ffd166' : mine ? '#2bd576' : 'rgba(255,255,255,.25)';
        c.lineWidth = judging || mine ? 5 : 3;
        if (judging) { c.setLineDash([14, 10]); c.lineDashOffset = -t * 40; }
        c.strokeRect(x0 - 3, y0 - 3, x1 - x0 + 6, y1 - y0 + 6); c.setLineDash([]);
        if (o) D.tag(c, (judging ? '⭐ ' : '') + (o.bot ? '🤖 ' : '') + o.nick + (mine ? ' (YOU)' : ''), (x0 + x1) / 2, y0 - 16, { size: 13, color: '#fff', bg: judging ? '#b07d00' : mine ? '#14874a' : 'rgba(20,16,50,.85)' });
      } });
    });
  }
  // what one click builds: the selected palette entry
  function bbPlaceAt(i, erase) {
    if (i < 0 || S.phase !== 'build' || !S.map.plots) return;
    if (!MG.inPlot(S.map, S.team, i)) { if (now() - (S.bbWarnT || 0) > 1500) { S.bbWarnT = now(); toast('🧱 Build on YOUR plot (the green outline)', 1500); SC.sfx('no'); } return; }
    if (now() - (S.bbT || 0) < 90) return; S.bbT = now();
    var m = S.map, sel = S.bbSel;
    if (erase || sel.lay === 'x') {
      var hasProp = (m.props || []).some(function (q) { return q.tile === i; });
      if (hasProp) send({ t: 'bb', op: 'set', i: i, lay: 'p', v: 0 });
      else if (m.w[i]) send({ t: 'bb', op: 'set', i: i, lay: 'w', v: 0 });
      else if (m.g[i]) send({ t: 'bb', op: 'set', i: i, lay: 'g', v: 0 });
      SC.sfx('mine'); return;
    }
    send({ t: 'bb', op: 'set', i: i, lay: sel.lay, v: sel.v });
    S.did.bb = true; SC.sfx('place');
  }
  function bbApplyLocal(i, lay, v, team, map) {
    var m = map || S.map; if (!m) return;
    if (lay === 0) { m.g[i] = v; if (!v) m.w[i] = 0; D.dropChunk(Math.floor((i % W) / D.CH), Math.floor(((i / W) | 0) / D.CH)); if (m === S.map) { var cc = tcen(i); D.burst('dust', cc.x, cc.y, 3); } }
    else if (lay === 2) { m.w[i] = v; m.wc[i] = team || 0; }
    else if (lay === 3) {
      m.props = m.props || [];
      var k = -1; m.props.forEach(function (q, j) { if (q.tile === i) k = j; });
      if (k >= 0) m.props.splice(k, 1);
      m.obj[i] = 0;
      if (v) { var c2 = tcen(i); m.props.push({ id: i, kind: MG.PROP_KINDS[v - 1], tile: i, x: c2.x, y: c2.y }); m.obj[i] = 3; }
    } else if (lay === 1) { m.f[i] = v; m.fc[i] = team || 0; }
  }
  var BB_ITEMS = [];
  (function () {
    [[B.G.GRASS, 'Grass'], [B.G.STONE, 'Stone'], [B.G.PATH, 'Planks'], [B.G.COBBLE, 'Cobble'], [B.G.FLOOR, 'Wood'], [B.G.SNOW, 'Snow'], [B.G.MID, 'Crystal'], [B.G.ICE, 'Ice'], [B.G.CANDY, 'Candy'], [B.G.SAND, 'Sand'], [B.G.BRICK, 'Brick'], [0, 'Pit']].forEach(function (q) { BB_ITEMS.push({ lay: 'g', v: q[0], name: q[1] }); });
    [[1, 'Wool'], [2, 'Plank wall'], [3, 'End stone'], [4, 'Obsidian']].forEach(function (q) { BB_ITEMS.push({ lay: 'w', v: q[0], name: q[1] }); });
    MG.PROP_KINDS.forEach(function (k, j) { BB_ITEMS.push({ lay: 'p', v: j + 1, name: MG.PROPS[k].name, prop: k }); });
    BB_ITEMS.push({ lay: 'x', v: 0, name: 'Eraser' });
  })();
  var BB_GCOL = { 0: '#17123a', 1: '#5fbf4b', 2: '#8d98ad', 3: '#cfc6f0', 4: '#c9925a', 7: '#a7a2b8', 8: '#b07b4f', 9: '#eef6ff' };
  function bbIcon(it) {
    var cv2 = document.createElement('canvas'); cv2.width = cv2.height = 72; var x = cv2.getContext('2d');
    try {
      if (it.lay === 'g') { x.fillStyle = BB_GCOL[it.v] || '#555'; x.beginPath(); x.roundRect(10, 10, 52, 52, 10); x.fill(); x.strokeStyle = '#1b1636'; x.lineWidth = 4; x.stroke(); if (!it.v) { x.strokeStyle = '#ff5c6c'; x.beginPath(); x.moveTo(18, 18); x.lineTo(54, 54); x.stroke(); } }
      else if (it.lay === 'w') { x.translate(36, 40); x.scale(1.4, 1.4); D.drawItem(x, ['', 'wool', 'wood', 'end', 'obby'][it.v], 1, { team: S.team & 7 }); }
      else if (it.lay === 'p') { x.translate(36, 58); D.prop(x, it.prop, 0, 0, 0, { face: true }); }
      else { x.font = '34px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🧽', 36, 38); }
    } catch (e) {}
    return cv2;
  }
  function renderBBPal() {
    var el = $('bbPal'); el.innerHTML = '';
    BB_ITEMS.forEach(function (it) {
      var b = document.createElement('button'); b.className = 'bbi' + (S.bbSel === it ? ' on' : ''); b.title = it.name;
      b.appendChild(bbIcon(it));
      b.onclick = function () { S.bbSel = it; SC.sfx('click'); renderBBPal(); toast(esc(it.name), 700); };
      el.appendChild(b);
    });
  }
  function bbCycle() { var i = BB_ITEMS.indexOf(S.bbSel); S.bbSel = BB_ITEMS[(i + 1) % BB_ITEMS.length]; renderBBPal(); toast(esc(S.bbSel.name), 700); }
  function bbUISync() {
    var build = S.game === 'build' && S.screen === 'game';
    var pal = $('bbPal'), vt = $('bbVote');
    pal.classList.toggle('hidden', !(build && S.phase === 'build'));
    if (build && S.phase === 'build' && !pal.childElementCount) renderBBPal();
    var canVote = build && S.phase === 'vote' && S.votePlot >= 0 && S.votePlot !== S.team && !S.voted;
    vt.classList.toggle('hidden', !(build && S.phase === 'vote' && S.votePlot >= 0));
    if (!vt.classList.contains('hidden')) {
      var own = S.votePlot === S.team;
      vt.innerHTML = own ? '<div class="bvt">🏗️ Everyone is judging <b>YOUR</b> build!</div>'
        : S.voted ? '<div class="bvt">✅ Voted! Waiting for the others…</div>'
        : '<div class="bvt">How good is it?</div><div class="bstars">' + [1, 2, 3, 4, 5].map(function (v) { return '<button data-bv="' + v + '">' + '⭐'.repeat(v) + '</button>'; }).join('') + '</div>';
      void canVote;
    }
  }
  $('bbVote').addEventListener('click', function (e) {
    var b = e.target.closest('[data-bv]'); if (!b || S.voted) return;
    S.voted = true; send({ t: 'bb', op: 'vote', v: +b.dataset.bv });
    SC.sfx('buy'); toast('⭐ Voted ' + b.dataset.bv + '/5', 1200); bbUISync();
  });

  // ================================================================== TUTORIALS
  // In-match: a little card walks you through the basics the first time you play each game.
  var TUT = {
    bw: [
      { d: 'Walk around with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', t: 'Move with the joystick', ok: function () { return S.did.move; } },
      { d: 'Stand on your generator to collect <b>iron</b> ⚪', ok: function () { return (S.res.iron || 0) > 0; } },
      { d: 'Walk to the <b>Item Shop</b> NPC and press <kbd>E</kbd>', t: 'Tap the <b>Item Shop</b> NPC', ok: function () { return S.did.shop; } },
      { d: 'Buy <b>Wool</b> — it costs 4 iron', ok: function () { return (S.inv.wool || 0) > 0 || S.did.place; } },
      { d: 'Hold <b>right click</b> and walk to bridge over the void', t: 'Hold 🧱 while walking to bridge', ok: function () { return S.did.place; } },
      { d: 'Sprint with <kbd>Shift</kbd> (or double-tap) and jump with <kbd>Space</kbd>', t: 'Push the joystick all the way to sprint', ok: function () { return S.did.sprint; } },
      { d: '🛏 Cover your bed in blocks, then go break everyone else’s!', wait: 7000 }],
    ctf: [
      { d: 'Walk around with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, sprint with <kbd>Shift</kbd>', t: 'Move with the joystick — push it all the way to sprint', ok: function () { return S.did.move; } },
      { d: 'Follow the arrow to the <b>enemy flag</b> and touch it 🚩', ok: function () { return S.did.take; } },
      { d: 'Carry it back to <b>your own flag</b> to score!', ok: function () { return S.did.cap || (S.score[S.team] || 0) > 0; } },
      { d: 'If your flag gets dropped, touch it to send it home', wait: 6000 },
      { d: 'Bridge with wool (<b>right click</b>), shoot with the bow. First to 3 wins! 🏆', t: '🧱 bridges, ✨ uses items. First to 3 wins! 🏆', wait: 7000 }],
    spleef: [
      { d: 'Keep moving! The floor crumbles right after you step on it', t: 'Keep moving! The floor crumbles behind you', ok: function () { return S.did.move; } },
      { d: 'Press <kbd>Space</kbd> to jump over a hole', t: 'Tap ⤴️ to jump over holes', ok: function () { return S.did.hop; } },
      { d: '<b>Left click</b> a block to dig it — dig under other players! 😈', t: 'Tap ⛏️ to dig the block in front of you 😈', ok: function () { return S.did.dig; } },
      { d: 'Digging gives snowballs ❄️ — <b>right click</b> to throw one', t: 'Tap ❄️ to throw a snowball', ok: function () { return S.did.snow; } },
      { d: 'There are ' + MG.SP_LAYERS + ' floors. Fall through all of them and you’re out. Last one standing wins!', wait: 7000 }],
    hide: [
      { d: 'Walk up to a prop and press <kbd>E</kbd> to become it', t: 'Stand next to a prop and tap 🎭 to become it', ok: function () { return S.did.dis; } },
      { d: 'Find a spot next to matching props and <b>stand still</b> — you snap into place', ok: function () { return P && P.idleT > 1.5 && S.did.dis; } },
      { d: 'Press <kbd>F</kbd> to taunt 🎵 for bonus Scrolls (seekers can hear it!)', t: 'Tap 🎵 to taunt for bonus Scrolls', ok: function () { return S.did.taunt; } },
      { d: 'Seekers can hear you talk too 🎙️ Survive until the timer runs out!', wait: 7000 }],
    seek: [
      { d: 'You’re blindfolded while the hiders pick their disguises…', ok: function () { return snow() >= S.seekAt; } },
      { d: '<b>Left click</b> to hit props that look out of place. Real props hurt you a bit!', t: 'Tap ⚔️ near suspicious props. Real ones hurt you a bit!', ok: function () { return S.did.swingSeek; } },
      { d: 'Press <kbd>F</kbd> for the 📡 radar — it shows roughly where a hider is', t: 'Tap 📡 for the radar', ok: function () { return S.did.radar; } },
      { d: 'Listen for taunts 🎵 and voices — and watch for props that move!', wait: 7000 }],
  };
  TUT.duel = [
    { d: 'Fight! <kbd>Shift</kbd> sprint = big knockback, <kbd>Space</kbd> + hit = critical', t: 'Full joystick = sprint knockback. ⤴️ + hit = crit', ok: function () { return S.did.move; } },
    { d: 'Knock them into the void or cut them down — first to ' + MG.GAMES.duel.wins + ' kills wins', wait: 6000 },
    { d: 'Win public duels to raise your rank: Bronze → Silver → Gold → Diamond 💎', wait: 6000 }];
  TUT.murder = [
    { d: 'Someone here is a murderer. Nobody knows who…', wait: 5000 },
    { d: 'Collect gold bars 🪙 — 10 gold earns you a bow', ok: function () { return (S.gold || 0) > 0; } },
    { d: 'If you have a bow, <b>hold left click</b> to shoot. Hit the murderer to win — shoot an innocent and YOU die!', t: 'Tap 🏹 to shoot the nearest player — only when you’re sure!', wait: 7000 },
    { d: 'Stay near others, listen for screams, and watch who’s holding a knife 🔪', wait: 7000 }];
  TUT.murd_m = [
    { d: 'YOU are the murderer 🔪 Press <kbd>F</kbd> to draw or hide your knife', t: 'Tap ✊ to draw or hide your knife', ok: function () { return S.held === 'knife'; } },
    { d: 'One stab kills. Catch people alone — witnesses will tell the detective!', wait: 6000 },
    { d: 'Hide the knife (<kbd>F</kbd>) when people are watching. Kill everyone before time runs out!', wait: 7000 }];
  TUT.build = [
    { d: 'Build the theme on YOUR plot! Pick blocks from the palette below', t: 'Pick a block below, then tap ahead of you to place it', ok: function () { return S.did.bb; } },
    { d: '<b>Right click</b> erases. <kbd>R</kbd> cycles the palette', t: 'Tap 🧽 to erase what’s in front of you', wait: 6000 },
    { d: 'When time runs out everyone tours the plots and votes ⭐ — best build wins!', wait: 7000 }];
  function tutDone(key) { try { return !!JSON.parse(localStorage.getItem('sh_tut') || '{}')[key]; } catch (e) { return false; } }
  function tutMark(key, v) { try { var o = JSON.parse(localStorage.getItem('sh_tut') || '{}'); if (v) o[key] = 1; else delete o[key]; localStorage.setItem('sh_tut', JSON.stringify(o)); } catch (e) {} }
  function tutStart() { if (S.watching) return;
    var key = S.game === 'hide' ? (S.team === 1 ? 'seek' : 'hide') : S.game === 'murder' ? (S.mrole === 'm' ? 'murd_m' : 'murder') : S.game;
    S.tut = null; $('tutor').classList.add('hidden');
    if (tutDone(key) || !TUT[key]) return;
    S.tut = { key: key, i: 0, st: now() }; tutRender();
  }
  function tutRender() {
    var tu = S.tut, el = $('tutor'); if (!tu) { el.classList.add('hidden'); return; }
    var L2 = TUT[tu.key], st = L2[tu.i];
    el.classList.remove('hidden');
    el.innerHTML = '<div class="th">📘 Tutorial · ' + (tu.i + 1) + '/' + L2.length + '<span class="grow"></span><button id="tutSkip">Skip</button></div><div class="tx">' + (touch && st.t ? st.t : st.d) + '</div><div class="bar"><i style="width:' + Math.round(tu.i / L2.length * 100) + '%"></i></div>';
    $('tutSkip').onclick = function () { tutMark(tu.key, 1); S.tut = null; el.classList.add('hidden'); toast('Tutorial skipped — open ❓ any time', 1600); };
  }
  function tutTick() {
    var tu = S.tut; if (!tu || S.screen !== 'game') return;
    if (snow() < S.goAt) { tu.st = now(); return; }
    if (P && P.mv) S.did.move = true; if (P && P.sprint && P.mv) S.did.sprint = true;
    var L2 = TUT[tu.key], st = L2[tu.i];
    if (st.wait ? now() - tu.st > st.wait : st.ok()) {
      tu.i++; tu.st = now(); SC.sfx('pop');
      var el = $('tutor'); el.classList.remove('done'); void el.offsetWidth; el.classList.add('done');
      if (tu.i >= L2.length) { tutMark(tu.key, 1); S.tut = null; el.innerHTML = '<div class="th">📘 Tutorial</div><div class="tx">🎉 You’ve got it! Have fun!</div><div class="bar"><i style="width:100%"></i></div>'; setTimeout(function () { if (!S.tut) el.classList.add('hidden'); }, 2600); return; }
      tutRender();
    }
  }

  // The "How to play" book: illustrated pages for every game.
  function hcv(fn) { return fn; }
  function artBg(x, col) { var g = x.createRadialGradient(150, 120, 10, 150, 150, 210); g.addColorStop(0, col || '#3b2f8f'); g.addColorStop(1, '#151040'); x.fillStyle = g; x.fillRect(0, 0, 300, 300); }
  function gimAt(x, cx, cy, look, t, o) { x.save(); x.translate(cx, cy); x.scale(1.7, 1.7); A.drawGim(x, 0, 0, look, Object.assign({ t: t, dir: 0, moving: false }, o || {})); x.restore(); }
  function itemAt(x, id, cx, cy, s, o) { x.save(); x.translate(cx, cy); D.drawItem(x, id, s, o || {}); x.restore(); }
  var MEL = { skin: 'gim', body: '#3fa9ff' }, YOU = function () { return (S.hello && S.hello.look) || MEL; };
  var HELP = {
    bw: { name: 'Bedwars', icon: '🛏️', pages: [
      { h: 'Protect your bed', p: 'Every team has a 🛏 bed. While it stands you respawn. Once it’s broken, your next death is <b style="color:#ff5c6c">final</b>. Last team standing wins.', art: function (x, t) { artBg(x, '#4a2a6a'); D.bed(x, { team: 0, x: 150, y: 170, dir: [0, 1] }, t, true); gimAt(x, 90, 230, YOU(), t); gimAt(x, 220, 230, { skin: 'fox', body: '#ff4b5c' }, t + 1); } },
      { h: 'Collect & shop', p: 'Stand on your generator for <b>iron</b> and <b>gold</b>. Diamonds and emeralds spawn on the islands. Spend them at the <b>Item Shop</b> (<kbd>E</kbd>).', keys: '<kbd>E</kbd> talk to shop', art: function (x, t) { artBg(x); ['iron', 'gold', 'dia', 'em'].forEach(function (r, k) { D.res(x, r, 60 + k * 60, 110 + Math.sin(t * 3 + k) * 6, 2); }); itemAt(x, 'wool', 100, 210, 2.2); itemAt(x, 'sword3', 200, 210, 2.2); } },
      { h: 'Bridge across the void', p: 'Hold <b>right click</b> and walk to lay blocks in front of you. You can’t walk off edges — but knockback can throw you off!', keys: '<kbd>Right click</kbd> place · <kbd>Left click</kbd> mine', tk: '🧱 places blocks · ⚔️ mines', art: function (x, t) { artBg(x, '#1d3a6a'); for (var k = 0; k < 5; k++) itemAt(x, 'wool', 50 + k * 50, 200, 1.5, { team: 1 }); gimAt(x, 50 + ((t * 40) % 200), 170, YOU(), t, { moving: true, walk: t * 10 }); } },
      { h: 'Fight like Minecraft', p: '<kbd>Shift</kbd> or double-tap to sprint (big knockback). Jump with <kbd>Space</kbd> and hit while falling for a <b style="color:#ffd166">critical hit</b>.', art: function (x, t) { artBg(x, '#5a1a3a'); gimAt(x, 110, 200, YOU(), t); gimAt(x, 200, 200 - Math.abs(Math.sin(t * 3)) * 30, { skin: 'bear', body: '#2bd576' }, t); itemAt(x, 'sword4', 150, 110, 2.4); } },
    ] },
    ctf: { name: 'Capture the Flag', icon: '🚩', pages: [
      { h: 'Steal their flag', p: 'Two teams, two flags. Run to the <b>enemy flag</b> and touch it to pick it up. Arrows on your screen point the way.', art: function (x, t) { artBg(x, '#1d3a6a'); D.flagStand(x, 80, 220, 0, t, true); D.flag(x, 80, 220, 0, t); D.flagStand(x, 220, 220, 1, t, true); D.flag(x, 220, 220, 1, t); gimAt(x, 150, 180, YOU(), t, { moving: true, walk: t * 10 }); } },
      { h: 'Bring it home', p: 'Carry it back to <b>your own flag</b> to score a capture. Your flag has to be home to score! First team to <b>3</b> wins.', art: function (x, t) { artBg(x, '#1d4a3a'); x.save(); x.translate(150, 200); x.scale(1.7, 1.7); D.flagBack(x, 1, t, true); A.drawGim(x, 0, 0, YOU(), { t: t, dir: 0, moving: true, walk: t * 10 }); x.restore(); x.fillStyle = '#2bd576'; x.font = '700 30px Fredoka, sans-serif'; x.textAlign = 'center'; x.fillText('🏠 +1', 150, 70); } },
      { h: 'Stop the thief', p: 'If they take <b>your</b> flag, hunt the carrier down. Kill them and the flag drops — touch it to send it home.', art: function (x, t) { artBg(x, '#5a1a3a'); x.save(); x.translate(200, 200); x.scale(1.7, 1.7); D.flagBack(x, 0, t, true); A.drawGim(x, 0, 0, { skin: 'fox', body: '#3fa9ff' }, { t: t, dir: 0 }); x.restore(); gimAt(x, 100, 200, YOU(), t); itemAt(x, 'sword2', 150, 100, 2.2); } },
      { h: 'Your kit', p: 'You spawn with a stone sword, chain armor, a bow and wool. Grab ✨ pickups in the middle: golden apples, speed, pearls and fireballs.', keys: '<kbd>Left</kbd> attack · <kbd>Right</kbd> bridge · hold <kbd>Left</kbd> with bow to shoot', tk: '⚔️ attack · 🧱 bridge · ✨ use item', art: function (x, t) { artBg(x); ['sword2', 'armor2', 'bow', 'wool', 'gapple', 'pearl'].forEach(function (id, k) { itemAt(x, id, 70 + (k % 3) * 80, 100 + ((k / 3) | 0) * 100 + Math.sin(t * 3 + k) * 5, 1.8, { team: 0 }); }); } },
    ] },
    spleef: { name: 'TNT Spleef', icon: '❄️', pages: [
      { h: 'The floor falls away', p: 'Every block you step on crumbles a moment later. <b>Keep moving</b> and don’t walk back over your own trail!', art: function (x, t) { artBg(x, '#1d3a6a'); for (var ty = 0; ty < 5; ty++) for (var tx = 0; tx < 5; tx++) { var gone = (tx + ty * 5) < ((t * 3) % 12) && ty === 2; if (!gone) D.spTile(x, 'snow', 50 + tx * 40, 60 + ty * 40, tx + ty * 7, false); } gimAt(x, 70 + ((t * 40) % 160), 165, YOU(), t, { moving: true, walk: t * 10 }); } },
      { h: 'Four floors deep', p: 'Fall through a hole and you land on the floor below. There are <b>' + MG.SP_LAYERS + '</b> floors: snow, sand, clay and TNT. Fall off the last one and you’re out.', art: function (x, t) { artBg(x, '#2a1a5e'); MG.SP.kinds.forEach(function (k2, z) { for (var tx = 0; tx < 4; tx++) D.spTile(x, k2, 70 + tx * 40 + z * 6, 50 + z * 55, tx + z, true); }); } },
      { h: 'Jump the gaps', p: 'Press <kbd>Space</kbd> to jump over a hole. While you’re in the air the floor can’t fall under you.', tk: 'Tap ⤴️ to jump', art: function (x, t) { artBg(x, '#1d3a6a'); D.spTile(x, 'snow', 60, 170, 1, true); D.spTile(x, 'snow', 200, 170, 2, true); var u = (t % 1.4) / 1.4; gimAt(x, 80 + u * 140, 190 - Math.sin(u * Math.PI) * 60, YOU(), t, { moving: true, walk: t * 10 }); } },
      { h: 'Dig & throw', p: '<b>Left click</b> a block to dig it out, ideally right under someone else 😈. Each dig gives a snowball ❄️; <b>right click</b> to throw it and knock people around.', keys: '<kbd>Left</kbd> dig · <kbd>Right</kbd> snowball · hit people to push them', tk: '⛏️ dig · ❄️ throw · ⤴️ jump', art: function (x, t) { artBg(x, '#3a2a6a'); itemAt(x, 'shovel', 110, 150, 3); itemAt(x, 'snow', 200, 150 + Math.sin(t * 4) * 10, 2.6); } },
    ] },
    hide: { name: 'Prop Hunt', icon: '🎃', pages: [
      { h: 'Hiders become props', p: 'Walk up to any prop and press <kbd>E</kbd> to turn into it. Then pick a sneaky spot near matching props and <b>stand still</b>.', tk: 'Stand by a prop and tap 🎭', art: function (x, t) { artBg(x, '#1d4a3a'); ['barrel', 'pumpkin', 'crate'].forEach(function (k2, i) { D.prop(x, k2, 70 + i * 80, 230, t, { sc: 2.3, wob: i === 1 ? (Math.sin(t * 2) > 0.8 ? 1 : 0) : 0, face: true }); }); x.fillStyle = '#ffd166'; x.font = '700 22px Fredoka, sans-serif'; x.textAlign = 'center'; x.fillText('Which one is a player? 🤔', 150, 60); } },
      { h: 'Seekers hunt', p: 'Seekers are blindfolded for 30 seconds, then go looking. They hit props that look out of place. Hitting a <b>real</b> prop hurts the seeker a little!', art: function (x, t) { artBg(x, '#5a1a3a'); gimAt(x, 110, 210, { skin: 'ninja', body: '#ff4b5c' }, t); itemAt(x, 'sword2', 150, 150, 1.8); D.prop(x, 'barrel', 215, 235, t, { sc: 2.3, wob: Math.sin(t * 6) > 0 ? 0.6 : 0 }); } },
      { h: 'Found? Join the hunt', p: 'When a hider is found they come back as a <b>seeker</b>. Hiders win if anyone is still hidden when time runs out.', art: function (x, t) { artBg(x, '#3a2a6a'); D.prop(x, 'crate', 85, 225, t, { sc: 2.2 }); x.fillStyle = '#fff'; x.font = '700 40px Fredoka, sans-serif'; x.textAlign = 'center'; x.fillText('➜', 155, 195); gimAt(x, 215, 215, { skin: 'cat', body: '#ff4b5c' }, t); } },
      { h: 'Taunts, radar & voice', p: 'Hiders: <kbd>F</kbd> taunts 🎵 for bonus Scrolls (and every 30s you taunt automatically). Seekers: <kbd>F</kbd> uses the 📡 radar. Proximity voice is on, so whispering hiders can be heard!', tk: 'Hiders: 🎵 taunt · Seekers: 📡 radar', art: function (x, t) { artBg(x, '#2a1a5e'); itemAt(x, 'taunt', 100, 150, 2.8); itemAt(x, 'radar', 200, 150, 2.8); for (var k = 0; k < 3; k++) { x.fillStyle = 'rgba(255,209,102,' + (1 - ((t + k / 3) % 1)) + ')'; x.font = '700 28px Fredoka, sans-serif'; x.fillText('♪', 80 + k * 20, 100 - ((t + k / 3) % 1) * 50); } } },
    ] },
  };
  HELP.duel = { name: 'Duels', icon: '⚔️', pages: [
    { h: '1v1. No excuses.', p: 'A tiny arena over the void. Sprint hits send people flying, jump hits are <b style="color:#ffd166">critical</b>. First to ' + MG.GAMES.duel.wins + ' kills takes it.', art: function (x, t) { artBg(x, '#5a1a3a'); gimAt(x, 90, 210, YOU(), t); gimAt(x, 210, 210 - Math.abs(Math.sin(t * 3)) * 30, { skin: 'ninja', body: '#ff4b5c' }, t); itemAt(x, 'sword3', 150, 100, 2.6); } },
    { h: 'Climb the ranks', p: 'Public duels are <b>ranked</b>: Bronze → Silver → Gold → Diamond. Winning against stronger players earns more points.', art: function (x, t) { artBg(x); MG.RANKS.forEach(function (r2, k) { x.fillStyle = r2.color; x.beginPath(); x.arc(60 + k * 60, 150 + Math.sin(t * 2 + k) * 8, 20, 0, 7); x.fill(); x.strokeStyle = '#1b1636'; x.lineWidth = 4; x.stroke(); }); } },
    { h: 'The void is a weapon', p: 'The edge has no rails. A well-timed knockback hit wins a round without doing a single heart of damage.', keys: '<kbd>Shift</kbd> sprint · <kbd>Space</kbd> jump · <kbd>Left click</kbd> swing', tk: 'Full joystick = sprint · ⤴️ jump · ⚔️ swing', art: function (x, t) { artBg(x, '#1d3a6a'); D.spTile(x, 'sand', 60, 170, 3, true); D.spTile(x, 'sand', 100, 170, 4, true); var u = (t % 1.3) / 1.3; gimAt(x, 160 + u * 90, 185 + u * u * 60, { skin: 'bear', body: '#2bd576' }, t); } },
  ] };
  HELP.murder = { name: 'Murder Mystery', icon: '🔪', pages: [
    { h: 'Trust no one', p: '8 players. One is the <b style="color:#ff5c6c">murderer</b>, one is the <b style="color:#3fa9ff">detective</b> with a bow. Everyone else is innocent.', art: function (x, t) { artBg(x, '#2a1a5e'); [['cat', '#ff922b'], ['ninja', '#4a4f6a'], ['duck', '#ffd166'], ['bear', '#2bd576']].forEach(function (q, k) { gimAt(x, 60 + k * 60, 215, { skin: q[0], body: q[1] }, t + k); }); x.font = '30px system-ui'; x.textAlign = 'center'; x.fillText('❓', 150, 70); } },
    { h: 'The knife', p: 'The murderer draws the knife with <kbd>F</kbd> — one stab kills. But anyone nearby <b>sees</b> the knife and will run, scream and shoot.', art: function (x, t) { artBg(x, '#5a1a3a'); gimAt(x, 150, 210, { skin: 'skeleton', body: '#eef2ff' }, t); itemAt(x, 'knife', 200, 140, 3); } },
    { h: 'Gold buys justice', p: 'Gold bars appear around the village. Collect <b>10</b> and you get a bow with one arrow. Shoot the murderer to end it — shoot an innocent and you die too.', art: function (x, t) { artBg(x, '#1d4a3a'); for (var k = 0; k < 5; k++) { x.save(); x.translate(60 + k * 45, 160 + Math.sin(t * 3 + k) * 8); D.drawItem(x, 'goldI', 1.4); x.restore(); } itemAt(x, 'bow', 150, 240, 2); } },
    { h: 'Use your ears', p: 'Proximity voice is on. Scream when you see the knife. And if someone goes quiet mid-sentence… you know why. 🎙️', art: function (x, t) { artBg(x); gimAt(x, 100, 210, YOU(), t); for (var k = 0; k < 3; k++) { x.fillStyle = 'rgba(255,209,102,' + (1 - ((t + k / 3) % 1)) + ')'; x.font = '700 26px Fredoka, sans-serif'; x.fillText('!', 150 + k * 18, 140 - ((t + k / 3) % 1) * 40); } } },
  ] };
  HELP.build = { name: 'Build Battle', icon: '🏗️', pages: [
    { h: 'One theme, one plot', p: 'Everyone gets the same theme and their own plot. You have ' + MG.GAMES.build.buildSec + ' seconds — make something amazing.', art: function (x, t) { artBg(x, '#1d4a3a'); x.strokeStyle = '#2bd576'; x.lineWidth = 5; x.strokeRect(40, 90, 100, 100); x.strokeStyle = 'rgba(255,255,255,.3)'; x.strokeRect(160, 90, 100, 100); D.prop(x, 'snowman', 90, 180, t, { sc: 1.4 }); D.tag && null; } },
    { h: 'The palette', p: 'Pick ground, walls and props from the palette. <b>Left click</b> places, <b>right click</b> erases, <kbd>R</kbd> cycles. Dig pits, build walls, place pumpkins!', tk: 'Tap a palette item, then tap your plot. 🧽 erases.', art: function (x, t) { artBg(x); ['wool', 'wood', 'end'].forEach(function (id, k) { itemAt(x, id, 70 + k * 80, 130 + Math.sin(t * 3 + k) * 6, 2, { team: 0 }); }); D.prop(x, 'pot', 110, 250, t, { sc: 1.3 }); D.prop(x, 'lamp', 190, 250, t, { sc: 1.2 }); } },
    { h: 'Vote time ⭐', p: 'When time is up, everyone tours each plot and votes 1–5 stars (you can’t vote for your own). Highest average wins the Scrolls!', art: function (x, t) { artBg(x, '#3a2a6a'); for (var k = 0; k < 5; k++) { x.font = '700 ' + (26 + Math.sin(t * 4 + k) * 4) + 'px system-ui'; x.textAlign = 'center'; x.fillText('⭐', 60 + k * 45, 160); } } },
  ] };
  var help = { g: 'bw', i: 0, raf: 0 };
  function openHelp(g) {
    help.g = HELP[g] ? g : 'bw'; help.i = 0; S.helpGame = help.g;
    $('hGames').innerHTML = ['bw', 'ctf', 'spleef', 'hide', 'duel', 'murder', 'build'].map(function (k) { return '<button data-hg="' + k + '"' + (k === help.g ? ' class="on"' : '') + '>' + HELP[k].icon + ' ' + HELP[k].name + '</button>'; }).join('');
    openModal('mHelp'); helpRender();
    cancelAnimationFrame(help.raf); (function loop() { if ($('mHelp').classList.contains('hidden')) return; var cvh = $('hArt'); if (cvh) { var x = cvh.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 300, 300); try { HELP[help.g].pages[help.i].art(x, now() / 1000); } catch (e) {} } help.raf = requestAnimationFrame(loop); })();
  }
  function helpRender() {
    var H2 = HELP[help.g], pg = H2.pages[help.i];
    $('hTitle').textContent = 'How to play · ' + H2.name; $('hIco').textContent = H2.icon;
    [].forEach.call($('hGames').children, function (b) { b.classList.toggle('on', b.dataset.hg === help.g); });
    $('hPage').innerHTML = '<canvas id="hArt" width="300" height="300"></canvas><div><h3>' + pg.h + '</h3><p>' + pg.p + '</p>' + ((touch ? pg.tk : pg.keys) ? '<div class="keys2">' + (touch ? pg.tk : pg.keys) + '</div>' : '') + '</div>';
    $('hDots').innerHTML = H2.pages.map(function (_, k) { return '<i' + (k === help.i ? ' class="on"' : '') + '></i>'; }).join('');
    $('hPrev').style.visibility = help.i ? '' : 'hidden';
    var last = help.i === H2.pages.length - 1, inMatch = S.screen === 'game';
    $('hNext').textContent = last ? (inMatch ? '✔ Got it' : '▶ Practice now') : 'Next ▶';
  }
  $('hGames').addEventListener('click', function (e) { var b = e.target.closest('[data-hg]'); if (!b) return; help.g = b.dataset.hg; help.i = 0; S.helpGame = help.g; SC.sfx('click'); helpRender(); });
  $('hPrev').onclick = function () { if (help.i > 0) { help.i--; SC.sfx('click'); helpRender(); } };
  $('hNext').onclick = function () {
    var H2 = HELP[help.g]; SC.sfx('click');
    if (help.i < H2.pages.length - 1) { help.i++; helpRender(); return; }
    closeModals();
    if (S.screen === 'hub') { tutMark(help.g === 'hide' ? 'hide' : help.g, 0); if (help.g === 'hide') tutMark('seek', 0); openPractice(help.g); }
  };
  void hcv;

  // debug hook for automated tests
  window.BWG = { openHelp: function (g) { openHelp(g); }, viewZ: function () { return viewZ(); }, dbg: function () { return { ct: cursorTile(), act: canAct(), r: mouse.r, wx: mouse.wx, wy: mouse.wy }; }, S: S, get P() { return P; }, send: send, cam: cam, mouse: mouse, keys: keys, openShop: openShop, selectSlot: selectSlot };

  if (window.BWV) BWV.listen(); // hear nearby players right away (no mic needed)
  requestAnimationFrame(frame);
  boot();
})();
