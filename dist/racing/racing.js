/* Scroll Racing - a 2D kart racer starring your gim. ScrollHub Original.
   Original code and art. Top-down canvas, rotating follow camera, drift mini-turbos, items, 8 racers, 4 tracks. */
(function () {
  'use strict';
  var SC = window.SC = window.SC || {}, A = SC.art;
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), g = cv.getContext('2d');
  var W = 0, H = 0, DPR = 1, TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function angd(a, b) { var d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
  function rng(seed) { var s = seed >>> 0; return function () { s += 0x6D2B79F5; var t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function fmt(ms) { if (ms == null || !isFinite(ms)) return '--:--.---'; var m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, t = Math.floor(ms) % 1000; return m + ':' + (s < 10 ? '0' : '') + s + '.' + (t < 10 ? '00' : t < 100 ? '0' : '') + t; }
  function ord(n) { return n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---------------------------------------------------------------- tracks
  var HALF = 105, STEP = 20, MAXSP = 470, WALL = 215;
  var TRACKS = [
    { id: 'meadow', name: 'Meadow Loop', sub: 'Rolling hills. A good first race.', grass: '#3f9d4c', grass2: '#388a44', road: '#4b505d', kerbA: '#ffffff', kerbB: '#e0443e', line: 'rgba(255,255,255,.7)', deco: ['tree', 'tree', 'tree', 'bush', 'flower', 'rock'], thumb: ['#5fbf6a', '#2e7a3a'],
      pts: [[0, 0], [900, -120], [1900, -80], [2600, 300], [2750, 950], [2300, 1450], [1500, 1550], [950, 1150], [350, 1300], [-350, 1050], [-650, 450], [-450, -250]] },
    { id: 'dune', name: 'Dune Dash', sub: 'Long sweepers across the desert.', grass: '#e0b565', grass2: '#d4a557', road: '#6b5c55', kerbA: '#fff7e6', kerbB: '#d97706', line: 'rgba(255,240,200,.75)', deco: ['cactus', 'cactus', 'rock', 'bush', 'rock'], thumb: ['#f1c97a', '#b9822f'],
      pts: [[0, 0], [800, -260], [1650, 0], [2300, -420], [3000, -200], [3200, 500], [2650, 950], [1950, 750], [1550, 1250], [1950, 1900], [1200, 2200], [350, 1900], [-150, 1200], [-550, 550]] },
    { id: 'frost', name: 'Frost Circuit', sub: 'Tight corners. Watch the snow.', grass: '#e3eefb', grass2: '#cfe0f4', road: '#566179', kerbA: '#ffffff', kerbB: '#38bdf8', line: 'rgba(220,240,255,.8)', deco: ['snowtree', 'snowtree', 'snowtree', 'rock', 'snowman'], thumb: ['#cfe4ff', '#6aa6e0'],
      pts: [[0, 0], [750, -350], [1500, -120], [1850, 550], [1400, 950], [1950, 1400], [2700, 1200], [3100, 1850], [2450, 2400], [1600, 2150], [850, 2500], [-150, 2150], [-400, 1400], [250, 950], [-400, 500]] },
    { id: 'neon', name: 'Neon Night', sub: 'After dark. Fast and glowing.', grass: '#150b30', grass2: '#10082a', road: '#1d1938', kerbA: '#22d3ee', kerbB: '#e879f9', line: 'rgba(34,211,238,.85)', deco: ['pylon', 'pylon', 'crystal', 'pylon'], thumb: ['#3b1d7a', '#0b0720'],
      pts: [[0, 0], [1000, 40], [2000, -220], [2900, 150], [3050, 900], [2500, 1250], [2950, 1800], [2250, 2350], [1400, 2100], [1000, 1550], [300, 1800], [-450, 1500], [-700, 750], [-350, 200]] }
  ];
  function catmull(P, t) {
    var n = P.length, i = Math.floor(t), f = t - i, p0 = P[(i - 1 + n) % n], p1 = P[i % n], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n], f2 = f * f, f3 = f2 * f;
    function c(a, b, cc, d) { return 0.5 * ((2 * b) + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f2 + (-a + 3 * b - 3 * cc + d) * f3); }
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
  }
  function buildTrack(def) {
    var P = def.pts, dense = [], i, s;
    for (i = 0; i < P.length; i++) for (s = 0; s < 60; s++) dense.push(catmull(P, i + s / 60));
    var cum = [0]; for (i = 1; i <= dense.length; i++) { var a = dense[i - 1], b = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    var L = cum[cum.length - 1], N = Math.round(L / STEP), T = { def: def, N: N, L: L, x: new Float32Array(N), y: new Float32Array(N), tx: new Float32Array(N), ty: new Float32Array(N), nx: new Float32Array(N), ny: new Float32Array(N), curv: new Float32Array(N), sg: new Float32Array(N) }, j = 0;
    for (i = 0; i < N; i++) { var d = i * L / N; while (cum[j + 1] < d) j++; var a2 = dense[j], b2 = dense[(j + 1) % dense.length], f = (d - cum[j]) / (cum[j + 1] - cum[j] || 1); T.x[i] = a2[0] + (b2[0] - a2[0]) * f; T.y[i] = a2[1] + (b2[1] - a2[1]) * f; }
    for (i = 0; i < N; i++) { var p = (i + 1) % N, q = (i - 1 + N) % N, dx = T.x[p] - T.x[q], dy = T.y[p] - T.y[q], l = Math.hypot(dx, dy) || 1; T.tx[i] = dx / l; T.ty[i] = dy / l; T.nx[i] = -T.ty[i]; T.ny[i] = T.tx[i]; }
    for (i = 0; i < N; i++) { var k = (i + 10) % N, cr = T.tx[i] * T.ty[k] - T.ty[i] * T.tx[k], dt = T.tx[i] * T.tx[k] + T.ty[i] * T.ty[k]; T.curv[i] = Math.abs(Math.atan2(cr, dt)); T.sg[i] = cr >= 0 ? 1 : -1; }
    var path = new Path2D(); path.moveTo(T.x[0], T.y[0]); for (i = 1; i < N; i++) path.lineTo(T.x[i], T.y[i]); path.closePath(); T.path = path;
    var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9; for (i = 0; i < N; i++) { minx = Math.min(minx, T.x[i]); maxx = Math.max(maxx, T.x[i]); miny = Math.min(miny, T.y[i]); maxy = Math.max(maxy, T.y[i]); } T.bb = [minx, miny, maxx, maxy];
    // item boxes (clusters of 3) and boost pads
    T.boxes = []; [0.1, 0.3, 0.52, 0.75].forEach(function (fr) { var ix = Math.floor(N * fr); for (var o = -1; o <= 1; o++) T.boxes.push({ x: T.x[ix] + T.nx[ix] * o * 55, y: T.y[ix] + T.ny[ix] * o * 55, t: 0 }); });
    T.pads = []; [0.2, 0.43, 0.64, 0.88].forEach(function (fr, k) { var ix = Math.floor(N * fr), o = [-48, 48, 0, -48][k]; T.pads.push({ x: T.x[ix] + T.nx[ix] * o, y: T.y[ix] + T.ny[ix] * o, a: Math.atan2(T.ty[ix], T.tx[ix]) }); });
    // scenery, kept clear of the road
    var R = rng(def.id.length * 977 + def.pts.length * 31), n = 0, tries = 0; T.deco = [];
    while (n < 420 && tries++ < 4000) {
      var bi = Math.floor(R() * N), side = R() < 0.5 ? -1 : 1, off = HALF + 90 + Math.pow(R(), 1.6) * 520, px = T.x[bi] + T.nx[bi] * side * off, py = T.y[bi] + T.ny[bi] * side * off, ok = true;
      for (var z = 0; z < N; z += 3) { var ddx = px - T.x[z], ddy = py - T.y[z]; if (ddx * ddx + ddy * ddy < (HALF + 70) * (HALF + 70)) { ok = false; break; } }
      if (ok) { T.deco.push({ x: px, y: py, t: def.deco[Math.floor(R() * def.deco.length)], s: 0.8 + R() * 0.7, v: R() }); n++; }
    }
    return T;
  }
  var trackCache = {}; function getTrack(id) { return trackCache[id] || (trackCache[id] = buildTrack(TRACKS.filter(function (t) { return t.id === id; })[0])); }

  // ---------------------------------------------------------------- state
  var opts = lsGet('sr_opts', { diff: 'normal', laps: 3, auto: true, track: 'meadow', car: 'kart' }), best = lsGet('sr_best', {});
  var DIFF = { easy: { top: 0.86, mult: 0.6, slot: 3 }, normal: { top: 0.93, mult: 1, slot: 5 }, hard: { top: 1.0, mult: 1.4, slot: 6 } };
  var S = { mode: 'boot', track: null, racers: [], me: null, proj: [], slicks: [], parts: [], pops: [], laps: 3, t: 0, count: 0, raceT: 0, finishedN: 0, afterT: 0, results: null, flash: 0, shake: 0, token: '', run: null, wrong: 0, hintT: 0, gasAt: -1, early: false, focus: null, zapT: 0 };
  var cam = { x: 0, y: 0, a: 0, z: 1 };
  var MPS = /[?&]mp=1/.test(location.search) && window.parent !== window; // running inside the Bedwars-engine lobby (online race)
  var keys = {}, touch = { steer: 0, drift: false, item: false, brake: false, gas: false };
  var player = { look: { skin: 'gim', body: '#3fa9ff', hat: '', acc: '', trail: '' }, name: 'Racer', signed: false };
  var NAMES = ['Pip', 'Mochi', 'Zed', 'Nova', 'Biscuit', 'Turbo', 'Echo', 'Jinx', 'Kiwi', 'Bolt', 'Sprout', 'Tango', 'Pebble', 'Waffle', 'Comet'];
  var BODIES = ['#3fa9ff', '#3fd27a', '#ffcc33', '#ff6b6b', '#9b6bff', '#ff8ad8', '#eef2ff', '#5eead4', '#ff922b', '#c4b5fd', '#dc143c', '#2a3a9a'];
  var HATS = ['', 'cap', 'beanie', 'party', 'phones', 'chef', 'cowboy', 'top', 'viking', 'wizard', 'halo', 'crown', 'beret', 'pirate', 'antlers'];
  var ITEMS = { turbo: { n: 'Turbo' }, pulse: { n: 'Pulse' }, seeker: { n: 'Seeker' }, slick: { n: 'Slick' }, shield: { n: 'Shield' }, zap: { n: 'Zap' } };

  function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
  window.addEventListener('resize', resize); resize();

  // ---------------------------------------------------------------- racers
  function spriteFor(look) {
    var c = document.createElement('canvas'); c.width = 400; c.height = 440; var x = c.getContext('2d'); x.scale(2, 2);
    try { A.drawGim(x, 100, 170, look, { still: true, dir: 3, shadow: false, scale: 1, noSeason: true, t: 0 }); } catch (e) { x.fillStyle = look.body || '#3fa9ff'; x.beginPath(); x.arc(100, 130, 32, 0, TAU); x.fill(); }
    return c;
  }
  function randomLook(R) { return { skin: A && A.SKINS ? A.SKINS[Math.floor(R() * A.SKINS.length)] : 'gim', body: BODIES[Math.floor(R() * BODIES.length)], hat: HATS[Math.floor(R() * HATS.length)], acc: '', trail: '' }; }
  var ACCENTS = ['#ffffff', '#fde047', '#0f172a', '#f8fafc', '#fb7185', '#22d3ee'];
  function mkRacer(i, T, slot, look, name, isMe, top, R) {
    var row = Math.floor(slot / 2), col = slot % 2, back = 70 + row * 78, idx0 = (T.N - Math.round(back / STEP) + T.N) % T.N, lat = (col ? 1 : -1) * 48;
    var r = { i: i, me: isMe, name: name, look: look, x: T.x[idx0] + T.nx[idx0] * lat, y: T.y[idx0] + T.ny[idx0] * lat, a: Math.atan2(T.ty[idx0], T.tx[idx0]), vx: 0, vy: 0, idx: idx0, u: idx0 - T.N, lat: lat, drift: false, driftDir: 0, driftT: 0, boost: 0, boostTier: 0, spin: 0, spinA: 0, shield: 0, item: null, roll: 0, inv: 0, slow: 0, finished: false, ft: 0, lapT: [], lap: 1, place: i + 1, top: top, lane: (R() - 0.5) * 90, rnd: R(), stuck: 0, off: false, hop: 0, steerV: 0, aiT: R() * 5, slotU: 0, wantDrift: false, itemT: 0, bump: 0, lapStart: 0, sprite: spriteFor(look), sparks: 0 };
    r.bodyCol = look.body || '#3fa9ff'; var M = window.SRCars ? SRCars.MODELS : [{ id: 'kart', seatX: -4 }];
    var mid = isMe ? (opts.car || 'kart') : M[Math.floor(R() * M.length)].id, mm = M.filter(function (m) { return m.id === mid; })[0] || M[0];
    r.car = mm.id; r.seatX = mm.seatX; r.accent = ACCENTS[Math.floor(R() * ACCENTS.length)];
    return r;
  }
  function startRace(demo) {
    var T = getTrack(demo ? 'meadow' : opts.track), D = DIFF[opts.diff] || DIFF.normal, R = rng((Date.now() & 0xffffff) + 7);
    S.track = T; S.racers = []; S.proj = []; S.slicks = []; S.parts = []; S.pops = []; S.laps = demo ? 99 : opts.laps; S.finishedN = 0; S.results = null; S.afterT = 0; S.raceT = 0; S.wrong = 0; S.gasAt = -1; S.early = false; S.demo = !!demo; S.flash = 0; S.zapT = 0;
    T.boxes.forEach(function (b) { b.t = 0; });
    var pool = NAMES.slice().sort(function () { return R() - 0.5; }), slots = [0, 1, 2, 3, 4, 5, 6, 7], mySlot = demo ? -1 : D.slot, k = 0, i;
    for (i = 0; i < 8; i++) {
      var slot = slots[i]; if (!demo && i === 0) slot = mySlot; else if (!demo) { slot = slots.filter(function (s) { return s !== mySlot; })[i - 1]; }
      var isMe = !demo && i === 0, look = isMe ? player.look : randomLook(R), name = isMe ? player.name : pool[k++];
      var top = isMe ? 1 : D.top * (0.97 + R() * 0.06);
      S.racers.push(mkRacer(i, T, slot, look, name, isMe, top, R));
    }
    S.me = demo ? null : S.racers[0]; S.focus = demo ? S.racers[3] : S.me;
    S.count = demo ? 0 : 3.6; S.mode = demo ? 'demo' : 'count';
    snapCam(); S.hintT = 6;
    if (!demo) startRun();
  }
  function snapCam() { var f = S.focus; if (!f) return; cam.x = f.x; cam.y = f.y; cam.a = f.a; cam.z = 1; }

  // ---------------------------------------------------------------- server (rewards)
  function authHeaders() { var h = { 'Content-Type': 'application/json' }, t = ''; try { t = localStorage.getItem('sh_token') || ''; } catch (e) {} if (t) h.Authorization = 'Bearer ' + t; return h; }
  function startRun() { S.token = ''; if (!player.signed) return; fetch('/api/racing/start', { method: 'POST', headers: authHeaders(), credentials: 'include', body: JSON.stringify({ track: opts.track, diff: opts.diff, laps: opts.laps }) }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.token) S.token = j.token; }).catch(function () {}); }
  function claim(place, ms) {
    var box = $('resReward');
    if (!player.signed) { box.className = 'reward none'; box.textContent = 'Sign in to ScrollHub to earn Scrolls for your finishing place.'; return; }
    if (!S.token) { box.className = 'reward none'; box.textContent = 'No reward for this race.'; return; }
    box.className = 'reward none'; box.textContent = 'Counting your Scrolls...';
    fetch('/api/racing/finish', { method: 'POST', headers: authHeaders(), credentials: 'include', body: JSON.stringify({ token: S.token, place: place, ms: Math.round(ms) }) }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) { box.className = 'reward'; box.textContent = j.coins > 0 ? '+' + j.coins + ' Scrolls' + (j.capped ? ' (daily limit reached)' : '') : 'Daily Scroll limit reached. No Scrolls this time.'; try { SC.sfx && SC.sfx('coins'); } catch (e) {} }
      else { box.className = 'reward none'; box.textContent = (j && j.message) || 'No reward for this race.'; }
    }).catch(function () { box.className = 'reward none'; box.textContent = 'Could not reach the server for your reward.'; });
    S.token = '';
  }

  // ---------------------------------------------------------------- audio
  var eng = null;
  function muted() { return SC.sfxMuted && SC.sfxMuted(); }
  function engineOn() {
    if (eng) return; var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { var ctx = new AC(), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), gn = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 60; o2.frequency.value = 30; lp.type = 'lowpass'; lp.frequency.value = 520; gn.gain.value = 0; o.connect(lp); o2.connect(lp); lp.connect(gn); gn.connect(ctx.destination); o.start(); o2.start(); eng = { ctx: ctx, o: o, o2: o2, gn: gn, lp: lp }; } catch (e) { eng = null; }
  }
  function engineSet(sp, on) { if (!eng) return; var t = eng.ctx.currentTime, f = 55 + sp * 150; eng.o.frequency.setTargetAtTime(f, t, 0.06); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06); eng.lp.frequency.setTargetAtTime(380 + sp * 900, t, 0.08); eng.gn.gain.setTargetAtTime(on && !muted() ? 0.028 + sp * 0.02 : 0, t, 0.08); if (eng.ctx.state === 'suspended' && on) eng.ctx.resume(); }
  function sfx(n, a) { try { if (SC.sfx) SC.sfx(n, a); } catch (e) {} }
  function tone(f, d, ty, v, w, s) { try { if (SC.sfxTone && !muted()) SC.sfxTone(f, d, ty, v, w, s); } catch (e) {} }
  function noise(d, v, w, hp) { try { if (SC.sfxNoise && !muted()) SC.sfxNoise(d, v, w, hp); } catch (e) {} }

  // ---------------------------------------------------------------- physics
  function locate(r) {
    var T = S.track, N = T.N, best = 1e18, bi = r.idx, k, i, dx, dy, d;
    for (k = -24; k <= 24; k++) { i = (r.idx + k + N) % N; dx = r.x - T.x[i]; dy = r.y - T.y[i]; d = dx * dx + dy * dy; if (d < best) { best = d; bi = i; } }
    if (best > 360000) { best = 1e18; for (i = 0; i < N; i++) { dx = r.x - T.x[i]; dy = r.y - T.y[i]; d = dx * dx + dy * dy; if (d < best) { best = d; bi = i; } } }
    var di = bi - r.idx; if (di > N / 2) di -= N; if (di < -N / 2) di += N; r.u += di; r.idx = bi;
    r.lat = (r.x - T.x[bi]) * T.nx[bi] + (r.y - T.y[bi]) * T.ny[bi];
  }
  function puff(x, y, vx, vy, life, size, col) { if (S.parts.length > 320) S.parts.shift(); S.parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, size: size, col: col }); }
  function endDrift(r, bonus) {
    if (!r.drift) return; r.drift = false;
    if (bonus !== false) { var tier = r.driftT > 2.4 ? 3 : r.driftT > 1.5 ? 2 : r.driftT > 0.8 ? 1 : 0; if (tier) { r.boost = Math.max(r.boost, [0, 0.55, 0.9, 1.3][tier]); r.boostTier = tier; if (r.me) { tone(700 + tier * 160, 0.18, 'square', 0.12, 0, 1400); } } }
    r.driftT = 0;
  }
  function hit(r, kind, by) {
    if (r.inv > 0 || r.finished && false) return;
    if (r.shield > 0) { r.shield = 0; r.inv = 0.6; for (var i = 0; i < 14; i++) puff(r.x, r.y, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, 0.5, 5, '#7dd3fc'); if (r.me) { tone(900, 0.2, 'triangle', 0.15, 0, 400); popText('Shield blocked it', '#7dd3fc'); } return; }
    r.spin = kind === 'zap' ? 1.35 : 1.05; r.spinA = 0; r.vx *= 0.3; r.vy *= 0.3; r.inv = 2.3; endDrift(r, false); r.boost = 0;
    if (r.me) { S.shake = 0.45; noise(0.4, 0.3, 0, 120); tone(180, 0.35, 'sawtooth', 0.14, 0, 70); }
    for (var k = 0; k < 10; k++) puff(r.x, r.y, (Math.random() - 0.5) * 360, (Math.random() - 0.5) * 360, 0.55, 6, kind === 'slick' ? '#222' : '#ffd34d');
  }
  function stepKart(r, inp, dt) {
    var T = S.track;
    locate(r);
    if (r.spin > 0) { r.spin -= dt; r.spinA += dt * 11; inp = { steer: 0, thr: 0, brake: 0, drift: false, item: false }; if (r.spin <= 0) r.spinA = 0; }
    if (r.inv > 0) r.inv -= dt; if (r.boost > 0) r.boost -= dt; if (r.shield > 0) { r.shield -= dt; if (r.shield < 0) r.shield = 0; } if (r.slow > 0) r.slow -= dt; if (r.hop > 0) r.hop -= dt; if (r.bump > 0) r.bump -= dt;
    var off = Math.abs(r.lat) > HALF + 16; r.off = off;
    var cap = MAXSP * r.top * (off ? 0.5 : 1); if (r.boost > 0) cap = MAXSP * 1.3 * (off ? 0.85 : 1) * Math.max(r.top, 0.95); if (r.slow > 0) cap *= 0.6;
    var fx = Math.cos(r.a), fy = Math.sin(r.a), vf0 = r.vx * fx + r.vy * fy;
    // drift start
    if (inp.drift && !r.drift && Math.abs(inp.steer) > 0.25 && vf0 > 190 && !off && r.spin <= 0) { r.drift = true; r.driftDir = inp.steer > 0 ? 1 : -1; r.driftT = 0; r.hop = 0.2; if (r.me) tone(300, 0.08, 'triangle', 0.1, 0, 520); }
    if (r.drift) { r.driftT += dt; if (!inp.drift || vf0 < 110) endDrift(r); }
    // steering
    var sp = Math.min(1, Math.abs(vf0) / 130), turn = 2.3 * (1 - 0.36 * Math.min(1, Math.abs(vf0) / MAXSP)) * sp * (vf0 < 0 ? -1 : 1), st = inp.steer;
    if (r.drift) { st = r.driftDir * (0.5 + 0.5 * clamp(inp.steer * r.driftDir, -1, 1)); turn *= 1.3; }
    r.steerV = lerp(r.steerV, st, 1 - Math.exp(-14 * dt));
    r.a += r.steerV * turn * dt;
    fx = Math.cos(r.a); fy = Math.sin(r.a);
    var vf = r.vx * fx + r.vy * fy, vl = -r.vx * fy + r.vy * fx;
    var acc = 0; if (inp.thr > 0) acc += inp.thr * (r.boost > 0 ? 1150 : 560) * Math.max(0, 1 - Math.max(0, vf) / cap);
    if (inp.brake > 0) acc -= vf > 20 ? 1050 : (vf > -140 ? 420 : 0);
    vf += acc * dt; vf *= Math.exp(-(inp.thr > 0 ? 0.03 : 0.5) * dt);
    if (vf > cap) vf += (cap - vf) * (1 - Math.exp(-(off ? 3.2 : 1.4) * dt));
    vl *= Math.exp(-(r.drift ? 1.9 : r.spin > 0 ? 3 : 9) * dt);
    r.vx = fx * vf - fy * vl; r.vy = fy * vf + fx * vl;
    r.x += r.vx * dt; r.y += r.vy * dt;
    // walls (soft outer fence)
    locate(r);
    if (Math.abs(r.lat) > WALL) { var sgn = r.lat > 0 ? 1 : -1, i = r.idx; r.x = T.x[i] + T.nx[i] * sgn * WALL; r.y = T.y[i] + T.ny[i] * sgn * WALL; var vn = r.vx * T.nx[i] + r.vy * T.ny[i]; if (vn * sgn > 0) { r.vx -= T.nx[i] * vn * 1.2; r.vy -= T.ny[i] * vn * 1.2; } r.vx *= 0.93; r.vy *= 0.93; if (r.me && r.bump <= 0) { r.bump = 0.3; noise(0.12, 0.2, 0, 300); S.shake = Math.max(S.shake, 0.15); } if (r.drift) endDrift(r, false); }
    // boost pads
    for (var p = 0; p < T.pads.length; p++) { var pd = T.pads[p], dx = r.x - pd.x, dy = r.y - pd.y; if (dx * dx + dy * dy < 52 * 52) { if (r.boost < 0.9) { r.boost = 1.0; r.boostTier = 2; if (r.me) { sfx('pop'); tone(520, 0.2, 'square', 0.1, 0, 1200); } } } }
    // item boxes
    if (!r.item && r.roll <= 0 && !r.finished) for (var b = 0; b < T.boxes.length; b++) { var bx = T.boxes[b]; if (bx.t > 0) continue; var ddx = r.x - bx.x, ddy = r.y - bx.y; if (ddx * ddx + ddy * ddy < 38 * 38) { bx.t = 4; r.roll = 0.9; if (r.me) sfx('chip'); } }
    if (r.roll > 0) { r.roll -= dt; if (r.roll <= 0) { r.item = pickItem(r); if (r.me) { sfx('open'); } } }
    // slicks
    for (var s = 0; s < S.slicks.length; s++) { var sl = S.slicks[s], sx = r.x - sl.x, sy = r.y - sl.y; if (sx * sx + sy * sy < 30 * 30 && (sl.owner !== r || sl.age > 1.2)) { hit(r, 'slick'); sl.life = Math.min(sl.life, 0.2); } }
    // item use
    if (inp.item && r.item && r.roll <= 0 && r.spin <= 0) useItem(r);
    // laps and finish
    var lap = Math.floor(r.u / T.N) + 1; if (lap > r.lap && !r.finished) { if (lap <= S.laps) { r.lapT.push(S.raceT * 1000); r.lap = lap; if (r.me) { popText(lap === S.laps ? 'Final lap' : 'Lap ' + lap, '#ffffff'); sfx('open'); } } }
    if (!r.finished && r.u >= S.laps * T.N && !S.demo) { r.finished = true; r.ft = S.raceT * 1000; r.place = ++S.finishedN; r.lapT.push(r.ft); }
    // particles
    var spd = Math.hypot(r.vx, r.vy);
    if (off && spd > 120 && Math.random() < 0.7) puff(r.x - fx * 18, r.y - fy * 18, -fx * 40 + (Math.random() - 0.5) * 60, -fy * 40 + (Math.random() - 0.5) * 60, 0.5, 5 + Math.random() * 4, S.track.def.id === 'frost' ? '#ffffff' : S.track.def.id === 'dune' ? '#e9c98a' : 'rgba(120,90,50,.8)');
    if (r.drift) { var col = r.driftT > 2.4 ? '#c084fc' : r.driftT > 1.5 ? '#fb923c' : r.driftT > 0.8 ? '#60a5fa' : '#e5e7eb'; for (var q = 0; q < 2; q++) puff(r.x - fx * 16 + (-fy) * (Math.random() - 0.5) * 24, r.y - fy * 16 + fx * (Math.random() - 0.5) * 24, -fx * 80 + (Math.random() - 0.5) * 160, -fy * 80 + (Math.random() - 0.5) * 160, 0.35, 3 + Math.random() * 2, col); }
    if (r.boost > 0) puff(r.x - fx * 24, r.y - fy * 24, -fx * 160 + (Math.random() - 0.5) * 50, -fy * 160 + (Math.random() - 0.5) * 50, 0.3, 6 + Math.random() * 4, Math.random() < 0.5 ? '#ffb347' : '#ff6b3d');
    return spd;
  }
  function placeOf(r) { var p = 1; for (var i = 0; i < S.racers.length; i++) { var o = S.racers[i]; if (o !== r && ((o.finished && !r.finished) || (o.finished && r.finished && o.place < r.place) || (!o.finished && !r.finished && o.u > r.u))) p++; } return p; }
  function pickItem(r) {
    var p = r.finished ? 4 : placeOf(r), t = (p - 1) / 7, w = { turbo: lerp(2, 4, t), shield: lerp(3, 1, t), pulse: lerp(4, 1.2, t), slick: lerp(3, 1, t), seeker: lerp(0, 4, t), zap: lerp(0, 3.5, t) }, sum = 0, k;
    for (k in w) sum += w[k]; var x = Math.random() * sum; for (k in w) { x -= w[k]; if (x <= 0) return k; } return 'turbo';
  }
  function useItem(r) {
    var it = r.item; r.item = null; var fx = Math.cos(r.a), fy = Math.sin(r.a), i;
    if (it === 'turbo') { r.boost = Math.max(r.boost, 1.7); r.boostTier = 3; if (r.me) { noise(0.5, 0.18, 0, 400); tone(300, 0.5, 'sawtooth', 0.1, 0, 900); } }
    else if (it === 'shield') { r.shield = 6; if (r.me) tone(660, 0.25, 'triangle', 0.15, 0, 990); }
    else if (it === 'pulse') { S.proj.push({ t: 'pulse', x: r.x + fx * 30, y: r.y + fy * 30, vx: fx * 820 + r.vx * 0.3, vy: fy * 820 + r.vy * 0.3, life: 1.7, owner: r, age: 0 }); if (r.me) tone(520, 0.15, 'square', 0.12, 0, 220); }
    else if (it === 'seeker') { S.proj.push({ t: 'seeker', x: r.x + fx * 30, y: r.y + fy * 30, vx: fx * 600, vy: fy * 600, life: 4.5, owner: r, age: 0, a: r.a }); if (r.me) tone(380, 0.25, 'sawtooth', 0.1, 0, 700); }
    else if (it === 'slick') { S.slicks.push({ x: r.x - fx * 38, y: r.y - fy * 38, life: 14, owner: r, age: 0 }); if (r.me) tone(240, 0.12, 'triangle', 0.14, 0, 120); }
    else if (it === 'zap') { var me = placeOf(r); S.racers.forEach(function (o) { if (o !== r && ((o.finished && !r.finished) || (!o.finished && !r.finished && o.u > r.u)) && !o.remote) hit(o, 'zap'); }); S.flash = 0.35; if (r.me || (S.me && placeOf(S.me) > me)) { noise(0.5, 0.3, 0, 200); tone(120, 0.5, 'sawtooth', 0.14, 0, 900); } }
    if (r.me) popText(ITEMS[it].n, '#93c5fd');
    if (MPS && r.me) mpSend({ t: 'rci', k: it, x: Math.round(r.x), y: Math.round(r.y), vx: Math.round(r.vx), vy: Math.round(r.vy), a: r.a });
  }
  function popText(t, col) { S.pops.push({ t: t, col: col || '#fff', life: 1.6, max: 1.6 }); if (S.pops.length > 3) S.pops.shift(); }

  // ---------------------------------------------------------------- bots
  function botInput(r, dt) {
    var T = S.track, N = T.N, spd = Math.hypot(r.vx, r.vy), look = 6 + Math.floor(spd / 52), ti = (r.idx + look) % N;
    r.aiT += dt;
    var lane = r.lane * (0.55 + 0.45 * Math.sin(r.aiT * 0.4 + r.rnd * 6));
    for (var s = 0; s < S.slicks.length; s++) { var sl = S.slicks[s], dx = sl.x - r.x, dy = sl.y - r.y, fwd = dx * Math.cos(r.a) + dy * Math.sin(r.a); if (fwd > 0 && fwd < 260 && Math.abs(-dx * Math.sin(r.a) + dy * Math.cos(r.a)) < 70) lane += (-dx * Math.sin(r.a) + dy * Math.cos(r.a) > 0 ? -1 : 1) * 70; }
    lane = clamp(lane, -HALF + 35, HALF - 35);
    var tx = T.x[ti] + T.nx[ti] * lane, ty = T.y[ti] + T.ny[ti] * lane, want = Math.atan2(ty - r.y, tx - r.x), da = angd(want, r.a);
    var cvv = Math.max(T.curv[(r.idx + 8) % N], T.curv[(r.idx + 16) % N]), limit = MAXSP * r.top * (1 - clamp(cvv * 0.55, 0, 0.5));
    var inp = { steer: clamp(da * 2.6, -1, 1), thr: spd > limit * 1.03 ? 0.15 : 1, brake: spd > limit * 1.12 ? 1 : 0, drift: false, item: false };
    var sgn = T.sg[(r.idx + 6) % N];
    if (r.drift) { inp.drift = cvv > 0.3 || r.driftT < 0.9; inp.steer = clamp(r.driftDir * (0.6 + da * r.driftDir * 1.3), -1, 1); }
    else if (cvv > 0.75 && spd > 290 && r.skillDrift !== false && Math.abs(da) > 0.05) { inp.drift = true; inp.steer = sgn * 0.8; }
    // items
    r.itemT += dt;
    if (r.item && r.roll <= 0 && r.itemT > 1.2 + r.rnd * 2) {
      var use = false, it = r.item, ahead = null, behind = null, k;
      for (k = 0; k < S.racers.length; k++) { var o = S.racers[k]; if (o === r) continue; var ox = o.x - r.x, oy = o.y - r.y, f = ox * Math.cos(r.a) + oy * Math.sin(r.a), l = -ox * Math.sin(r.a) + oy * Math.cos(r.a); if (f > 40 && f < 520 && Math.abs(l) < 90) ahead = o; if (f < -40 && f > -380 && Math.abs(l) < 90) behind = o; }
      if (it === 'turbo') use = cvv < 0.25; else if (it === 'shield') use = r.itemT > 3.5 || !!behind; else if (it === 'pulse') use = !!ahead; else if (it === 'seeker') use = r.itemT > 2.2 && placeOf(r) > 1; else if (it === 'slick') use = !!behind; else if (it === 'zap') use = placeOf(r) > 2;
      if (use) { inp.item = true; r.itemT = 0; }
    }
    // stuck recovery
    if (spd < 35 && S.mode === 'race' && r.spin <= 0) { r.stuck += dt; if (r.stuck > 1.6) { respawn(r); r.stuck = 0; } } else r.stuck = 0;
    return inp;
  }
  function respawn(r) {
    var T = S.track, i = r.idx; r.x = T.x[i]; r.y = T.y[i]; r.a = Math.atan2(T.ty[i], T.tx[i]); r.vx = r.vy = 0; r.spin = 0; r.inv = 1.6; r.drift = false; r.boost = 0; r.steerV = 0;
  }

  // ---------------------------------------------------------------- input
  function playerInput() {
    var k = keys, steer = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0), thr = k.ArrowUp || k.KeyW ? 1 : 0, brake = k.ArrowDown || k.KeyS ? 1 : 0;
    if (touch.steer) steer = touch.steer;
    if (TOUCH && opts.auto) thr = 1; if (touch.gas) thr = 1; if (touch.brake) { brake = 1; thr = 0; }
    var item = keys.__item || touch.item; keys.__item = false; touch.item = false;
    return { steer: clamp(steer, -1, 1), thr: thr, brake: brake, drift: !!(k.Space || k.ShiftLeft || k.ShiftRight || touch.drift), item: !!item };
  }
  window.addEventListener('keydown', function (e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.repeat) return; keys[e.code] = true;
    if (e.code === 'KeyE' || e.code === 'KeyX' || e.code === 'Enter' || e.code === 'KeyF') keys.__item = true;
    if (e.code === 'KeyR' && (S.mode === 'race' || S.mode === 'count') && S.me) { if (MPS) mpSend({ t: 'rcr' }); respawn(S.me); S.me.spin = 0.6; S.me.inv = 1.6; }
    if ((e.code === 'KeyP' || e.code === 'Escape') && (S.mode === 'race' || S.mode === 'count' || S.mode === 'paused')) togglePause();
    if (S.mode === 'count' && (e.code === 'ArrowUp' || e.code === 'KeyW') && S.gasAt < 0) S.gasAt = S.count;
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { keys = {}; if (S.mode === 'race') togglePause(true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && S.mode === 'race') togglePause(true); });
  (function touchSetup() {
    var pad = $('tPad'), stick = $('tStick'), ox = 0, oy = 0, pid = null;
    function sv(e) { var dx = e.clientX - ox; touch.steer = clamp(dx / 55, -1, 1); stick.firstChild.style.transform = 'translate(' + clamp(dx, -55, 55) + 'px,' + clamp(e.clientY - oy, -40, 40) + 'px)'; }
    pad.addEventListener('pointerdown', function (e) { if (pid !== null) return; pid = e.pointerId; try { pad.setPointerCapture(pid); } catch (x) {} ox = e.clientX; oy = e.clientY; stick.style.display = 'block'; stick.style.left = ox + 'px'; stick.style.top = oy + 'px'; sv(e); if (S.mode === 'count' && S.gasAt < 0) S.gasAt = S.count; e.preventDefault(); });
    pad.addEventListener('pointermove', function (e) { if (e.pointerId === pid) sv(e); });
    function up(e) { if (e.pointerId !== pid) return; pid = null; touch.steer = 0; stick.style.display = 'none'; stick.firstChild.style.transform = ''; }
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    function hold(id, key, tap) {
      var b = $(id), pid2 = null;
      b.addEventListener('pointerdown', function (e) { pid2 = e.pointerId; try { b.setPointerCapture(pid2); } catch (x) {} touch[key] = true; b.classList.add('on'); e.preventDefault(); });
      function end(e) { if (e.pointerId !== pid2) return; pid2 = null; if (!tap) touch[key] = false; b.classList.remove('on'); }
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
    }
    hold('tItem', 'item', true); hold('tDrift', 'drift', false); hold('tBrake', 'brake', false); hold('tGas', 'gas', false);
  })();

  // ---------------------------------------------------------------- simulation
  function collide() {
    var R = S.racers, n = R.length, i, j;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var a = R[i], b = R[j], dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy; if (d2 > 44 * 44 || d2 < 0.01) continue;
      var wa = a.remote ? 0 : 1, wb = b.remote ? 0 : 1, sh = wa + wb; if (!sh) continue; wa /= sh; wb /= sh; // online karts are driven by their own player, only ours gets pushed
      var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = 44 - d;
      a.x -= nx * ov * wa; a.y -= ny * ov * wa; b.x += nx * ov * wb; b.y += ny * ov * wb;
      var rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { var imp = -rv * 0.6; a.vx -= nx * imp * wa * 2; a.vy -= ny * imp * wa * 2; b.vx += nx * imp * wb * 2; b.vy += ny * imp * wb * 2; if ((a.me || b.me) && -rv > 60) { noise(0.1, 0.2, 0, 400); S.shake = Math.max(S.shake, 0.12); } }
    }
  }
  function updateProj(dt) {
    var R = S.racers;
    for (var i = S.proj.length - 1; i >= 0; i--) {
      var p = S.proj[i]; p.life -= dt; p.age += dt;
      if (p.t === 'seeker') {
        var tgt = null, bd = 1e9; R.forEach(function (o) { if (o === p.owner || o.finished) return; if (o.u <= p.owner.u - 4 && p.age < 0.5) return; var dx = o.x - p.x, dy = o.y - p.y, d = dx * dx + dy * dy, ahead = (dx * Math.cos(p.a) + dy * Math.sin(p.a)) > -200; if (ahead && d < bd && d < 1500 * 1500) { bd = d; tgt = o; } });
        if (tgt) { var want = Math.atan2(tgt.y - p.y, tgt.x - p.x); p.a += clamp(angd(want, p.a), -3.4 * dt, 3.4 * dt); } else { var T = S.track, ix = 0; }
        var sp = 640; p.vx = Math.cos(p.a) * sp; p.vy = Math.sin(p.a) * sp;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (Math.random() < 0.6) puff(p.x, p.y, 0, 0, 0.3, 4, p.t === 'seeker' ? '#fca5a5' : '#93c5fd');
      for (var k = 0; k < R.length; k++) { var o = R[k]; if (o === p.owner && p.age < 0.3) continue; var dx2 = o.x - p.x, dy2 = o.y - p.y; if (dx2 * dx2 + dy2 * dy2 < 30 * 30) { if (!o.remote) hit(o, p.t); p.life = 0; for (var q = 0; q < 12; q++) puff(p.x, p.y, (Math.random() - 0.5) * 420, (Math.random() - 0.5) * 420, 0.5, 5, '#fde68a'); if (o.me) popText('Hit by ' + p.owner.name, '#fca5a5'); break; } }
      if (p.life <= 0) S.proj.splice(i, 1);
    }
    for (var s = S.slicks.length - 1; s >= 0; s--) { S.slicks[s].life -= dt; S.slicks[s].age += dt; if (S.slicks[s].life <= 0) S.slicks.splice(s, 1); }
    S.track.boxes.forEach(function (b) { if (b.t > 0) b.t -= dt; });
  }
  function update(dt) {
    S.t += dt;
    if (S.shake > 0) S.shake -= dt; if (S.flash > 0) S.flash -= dt; if (S.hintT > 0) S.hintT -= dt;
    for (var i = S.pops.length - 1; i >= 0; i--) { S.pops[i].life -= dt; if (S.pops[i].life <= 0) S.pops.splice(i, 1); }
    for (i = S.parts.length - 1; i >= 0; i--) { var q = S.parts[i]; q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96; if (q.life <= 0) S.parts.splice(i, 1); }
    var racing = S.mode === 'race' || S.mode === 'demo' || S.mode === 'after';
    if (S.mode === 'count') {
      var prev = S.count; S.count = MPS ? Math.max(-0.05, (S.goLocal - Date.now()) / 1000) : S.count - dt; var a = Math.ceil(prev), b = Math.ceil(S.count);
      if (a !== b && b > 0 && b <= 3) tone(440, 0.16, 'square', 0.16);
      S.racers.forEach(function (r) { if (r.remote) return; stepKart(r, { steer: 0, thr: 0, brake: 0, drift: false, item: false }, dt); r.vx = r.vy = 0; });
      if (S.count <= 0) {
        S.mode = 'race'; S.raceT = 0; tone(880, 0.4, 'square', 0.2); sfx('launch');
        var me = S.me, early = S.gasAt >= 0 && S.gasAt > 1.0, good = (S.gasAt >= 0 && S.gasAt <= 1.0 && S.gasAt > 0.0) || (TOUCH && opts.auto);
        if (me) { if (early) { me.slow = 0.9; popText('Too early', '#fca5a5'); } else if (good) { me.boost = 1.3; me.boostTier = 3; popText('Rocket start', '#fde68a'); } }
        S.racers.forEach(function (r) { if (!MPS && !r.me && Math.random() < 0.55) { r.boost = 1.0 + Math.random() * 0.5; } });
      }
      return;
    }
    if (racing) { if (S.mode !== 'demo') S.raceT += dt; }
    var R = S.racers;
    if (S.me && S.me.finished && S.mode === 'race') { S.mode = 'after'; S.afterT = 0; popText('Finished ' + ord(S.me.place), '#fde68a'); sfx('win'); }
    if (S.mode === 'after') { S.afterT += dt; var allDone = R.every(function (r) { return r.finished; }); if (!MPS && (allDone || S.afterT > 7)) finishRace(); }
    R.forEach(function (r) {
      if (r.remote) { remoteStep(r, dt); return; } var inp, bot = !r.me || S.mode === 'after' || r.finished || (S.auto && r.me);
      if (r.finished && S.mode !== 'after' && !S.demo) { inp = botInput(r, dt); inp.item = false; } else inp = bot ? botInput(r, dt) : playerInput();
      if (!r.me && !S.demo) { var d = S.me ? (r.u - S.me.u) : 0; var rb = d > 40 ? 0.95 : d < -40 ? 1.05 : 1; r.top = r.top * 0.98 + (DIFF[opts.diff] || DIFF.normal).top * rb * (0.97 + r.rnd * 0.06) * 0.02; }
      stepKart(r, inp, dt);
    });
    collide(); updateProj(dt);
    if (S.me && S.mode === 'race') {
      var m = S.me, fwd = Math.cos(m.a) * S.track.tx[m.idx] + Math.sin(m.a) * S.track.ty[m.idx];
      if (fwd < -0.25 && Math.hypot(m.vx, m.vy) > 70) S.wrong += dt; else S.wrong = Math.max(0, S.wrong - dt * 2);
      m.place = m.finished ? m.place : placeOf(m);
    }
    R.forEach(function (r) { if (!r.finished) r.place = placeOf(r); });
    if (MPS) mpTick();
  }
  function finishRace() {
    var T = S.track, rows = S.racers.map(function (r) {
      var t = r.finished ? r.ft : null, est = null;
      if (!t) { var rem = S.laps * T.N - r.u, avg = Math.max(60, r.u > 0 ? (r.u * STEP) / Math.max(1, S.raceT) : 200); est = S.raceT * 1000 + rem * STEP / avg * 1000; }
      return { r: r, t: t, est: est, place: r.finished ? r.place : 99 };
    });
    rows.sort(function (a, b) { return a.t != null && b.t != null ? a.t - b.t : a.t != null ? -1 : b.t != null ? 1 : a.est - b.est; });
    rows.forEach(function (x, i) { x.place = i + 1; });
    var me = rows.filter(function (x) { return x.r.me; })[0]; S.results = rows; S.mode = 'results';
    var key = opts.track + '|' + opts.laps, mt = me.t, isBest = false;
    if (mt != null && (!best[key] || mt < best[key])) { best[key] = mt; lsSet('sr_best', best); isBest = true; }
    $('resPlace').textContent = ord(me.place); $('resSub').textContent = (me.place === 1 ? 'You won the race' : me.place <= 3 ? 'On the podium' : 'Race complete') + ' on ' + T.def.name + (isBest ? '. New best time.' : '');
    var box = $('resBoard'); box.textContent = '';
    rows.forEach(function (x) { var d = document.createElement('div'); d.className = 'r' + (x.r.me ? ' me' : ''); d.innerHTML = '<span class="n"></span><span class="nm"></span><span class="t"></span>'; d.children[0].textContent = x.place; d.children[1].textContent = x.r.name + (x.r.me ? ' (you)' : ''); d.children[2].textContent = x.t != null ? fmt(x.t) : 'Did not finish'; box.appendChild(d); });
    claim(me.place, me.t || S.raceT * 1000); show('results'); engineSet(0, false);
  }

  // ---------------------------------------------------------------- drawing
  var pats = {};
  function pattern(T) {
    var id = T.def.id; if (pats[id]) return pats[id];
    var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d'), R = rng(id.length * 131);
    x.fillStyle = T.def.grass; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 260; i++) { x.fillStyle = R() < 0.5 ? T.def.grass2 : 'rgba(255,255,255,.05)'; var s = 3 + R() * 9; x.beginPath(); x.ellipse(R() * 256, R() * 256, s, s * 0.6, R() * 3, 0, TAU); x.fill(); }
    if (id === 'neon') { x.strokeStyle = 'rgba(120,80,255,.10)'; x.lineWidth = 1; for (i = 0; i <= 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); } }
    return pats[id] = g.createPattern(c, 'repeat');
  }
  var rot = 0, cs = 1, sn = 0, ZOOM = 1, OY = 0;
  function camSetup() { rot = -Math.PI / 2 - cam.a; cs = Math.cos(rot); sn = Math.sin(rot); OY = H * 0.68; }
  function toScr(x, y) { var dx = x - cam.x, dy = y - cam.y; return [W / 2 + ZOOM * (dx * cs - dy * sn), OY + ZOMZ(dx * sn + dy * cs)]; }
  function ZOMZ(v) { return ZOOM * v; }
  function applyCam() { g.setTransform(DPR, 0, 0, DPR, 0, 0); g.translate(W / 2, OY); g.rotate(rot); g.scale(ZOOM, ZOOM); g.translate(-cam.x, -cam.y); }
  function drawKartBody(r) {
    g.save(); g.translate(r.x, r.y); g.rotate(r.a + r.spinA + (r.drift ? r.driftDir * 0.28 : 0));
    g.fillStyle = 'rgba(0,0,0,.30)'; g.beginPath(); g.ellipse(2, 5, 46, 28, 0, 0, TAU); g.fill();
    if (window.SRCars) { try { g.drawImage(SRCars.sprite(r.car, r.bodyCol, r.me ? '#ffffff' : r.accent), -56, -36, 112, 72); } catch (e) {} }
    g.restore();
  }
  function drawSprite(r, sx, sy, z) {
    var s = z * 0.82, bob = r.hop > 0 ? Math.sin((r.hop / 0.2) * Math.PI) * 10 * z : 0, lift = 6 * z + bob, ang = r.spinA ? r.spinA : angd(r.a, cam.a) * 0.0, lean = clamp(r.steerV, -1, 1) * 0.12 + (r.drift ? r.driftDir * 0.12 : 0);
    g.save(); g.translate(sx, sy - lift); g.rotate(lean + (r.spin > 0 ? 0 : 0));
    if (r.spin > 0) { g.translate(0, -26 * s); g.rotate(r.spinA); g.translate(0, 26 * s); }
    if (r.inv > 0 && r.spin <= 0 && Math.floor(S.t * 18) % 2 === 0) g.globalAlpha = 0.55;
    g.drawImage(r.sprite, -100 * s, -170 * s, 200 * s, 220 * s);
    g.restore();
    if (r.me && S.mode !== 'results') { g.save(); g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; var ty = sy - 150 * s - 8 * z; g.beginPath(); g.moveTo(sx - 9 * z, ty - 10 * z); g.lineTo(sx + 9 * z, ty - 10 * z); g.lineTo(sx, ty + 2 * z); g.closePath(); g.stroke(); g.fill(); g.restore(); }
    if (MPS && !r.me && r.name) { g.save(); g.font = '800 ' + Math.round(13 * z) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.6)'; g.fillStyle = r.bot ? '#cbd5e1' : '#fff'; g.strokeText(r.name, sx, sy - 158 * s); g.fillText(r.name, sx, sy - 158 * s); g.restore(); }
    if (r.shield > 0) { g.save(); g.strokeStyle = 'rgba(125,211,252,' + (0.5 + 0.3 * Math.sin(S.t * 8)) + ')'; g.lineWidth = 3 * z; g.fillStyle = 'rgba(125,211,252,.12)'; g.beginPath(); g.ellipse(sx, sy - 24 * z, 40 * z, 46 * z, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
  }
  function drawDeco(d, sx, sy, z) {
    var s = d.s * z, t = d.t; g.save(); g.translate(sx, sy);
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 0, 26 * s, 11 * s, 0, 0, TAU); g.fill();
    if (t === 'tree') { g.fillStyle = '#6b4423'; g.fillRect(-4 * s, -26 * s, 8 * s, 28 * s); g.fillStyle = d.v < 0.5 ? '#2f8f43' : '#3aa655'; [[0, -62, 30], [-14, -44, 22], [15, -45, 23]].forEach(function (c) { g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); }); g.fillStyle = 'rgba(255,255,255,.13)'; g.beginPath(); g.arc(-8 * s, -70 * s, 13 * s, 0, TAU); g.fill(); }
    else if (t === 'snowtree') { g.fillStyle = '#5a4030'; g.fillRect(-3 * s, -14 * s, 6 * s, 16 * s); [[-8, 30, 30], [-28, 26, 22], [-46, 20, 15]].forEach(function (c, i) { g.fillStyle = i % 2 ? '#2f6f56' : '#3a8566'; g.beginPath(); g.moveTo(-c[1] * s, c[0] * s + 14 * s); g.lineTo(0, (c[0] - c[2] - 8) * s + 8 * s); g.lineTo(c[1] * s, c[0] * s + 14 * s); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-c[1] * 0.55 * s, (c[0] - 6) * s); g.lineTo(0, (c[0] - c[2] - 8) * s + 8 * s); g.lineTo(c[1] * 0.55 * s, (c[0] - 6) * s); g.closePath(); g.fill(); }); }
    else if (t === 'bush') { g.fillStyle = '#2b8a3e'; [[-12, -10, 14], [6, -13, 16], [18, -7, 11]].forEach(function (c) { g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); }); }
    else if (t === 'flower') { for (var i = 0; i < 5; i++) { g.fillStyle = ['#ff8ad8', '#fde047', '#fff', '#93c5fd', '#fb7185'][i]; g.beginPath(); g.arc((i * 9 - 18) * s, (-4 - (i % 2) * 5) * s, 4 * s, 0, TAU); g.fill(); } }
    else if (t === 'rock') { g.fillStyle = S.track.def.id === 'frost' ? '#9fb3c8' : S.track.def.id === 'dune' ? '#a07c52' : '#7d8794'; g.beginPath(); g.moveTo(-22 * s, 0); g.lineTo(-14 * s, -20 * s); g.lineTo(6 * s, -26 * s); g.lineTo(22 * s, -10 * s); g.lineTo(24 * s, 0); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(-14 * s, -20 * s); g.lineTo(6 * s, -26 * s); g.lineTo(2 * s, -12 * s); g.closePath(); g.fill(); }
    else if (t === 'cactus') { g.fillStyle = '#3f8f4a'; g.strokeStyle = '#2d6b36'; g.lineWidth = 2 * s; [[0, 0, 0, -56, 8], [0, -26, -18, -26, 6], [-18, -26, -18, -42, 6], [0, -18, 17, -18, 6], [17, -18, 17, -34, 6]].forEach(function (c) { g.lineCap = 'round'; g.lineWidth = c[4] * 2 * s; g.strokeStyle = '#3f8f4a'; g.beginPath(); g.moveTo(c[0] * s, c[1] * s); g.lineTo(c[2] * s, c[3] * s); g.stroke(); }); }
    else if (t === 'snowman') { g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; [[0, -14, 16], [0, -38, 12], [0, -56, 9]].forEach(function (c) { g.beginPath(); g.arc(c[0] * s, c[1] * s, c[2] * s, 0, TAU); g.fill(); g.stroke(); }); g.fillStyle = '#f97316'; g.beginPath(); g.moveTo(0, -56 * s); g.lineTo(11 * s, -53 * s); g.lineTo(0, -51 * s); g.fill(); g.fillStyle = '#111'; g.fillRect(-4 * s, -59 * s, 2 * s, 2 * s); g.fillRect(3 * s, -59 * s, 2 * s, 2 * s); }
    else if (t === 'pylon') { var gl = 0.6 + 0.4 * Math.sin(S.t * 3 + d.v * 9), col = d.v < 0.5 ? '34,211,238' : '232,121,249'; g.fillStyle = '#1b1636'; g.fillRect(-5 * s, -70 * s, 10 * s, 72 * s); g.fillStyle = 'rgba(' + col + ',' + gl + ')'; g.shadowColor = 'rgba(' + col + ',1)'; g.shadowBlur = 20 * s; g.fillRect(-3 * s, -92 * s, 6 * s, 24 * s); g.beginPath(); g.arc(0, -96 * s, 8 * s, 0, TAU); g.fill(); g.shadowBlur = 0; }
    else if (t === 'crystal') { var c2 = d.v < 0.5 ? '#22d3ee' : '#e879f9'; g.shadowColor = c2; g.shadowBlur = 18 * s; g.fillStyle = c2; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(-14 * s, 0); g.lineTo(-6 * s, -40 * s); g.lineTo(0, -62 * s); g.lineTo(8 * s, -34 * s); g.lineTo(16 * s, 0); g.closePath(); g.fill(); g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(-6 * s, -40 * s); g.lineTo(0, -62 * s); g.lineTo(-2 * s, -20 * s); g.closePath(); g.fill(); }
    g.restore();
  }
  function drawBox(b, sx, sy, z) {
    if (b.t > 0) return; var bob = Math.sin(S.t * 3 + b.x) * 4 * z, s = z; g.save(); g.translate(sx, sy - 26 * s - bob);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 26 * s + bob, 15 * s, 6 * s, 0, 0, TAU); g.fill();
    g.rotate(Math.sin(S.t * 2 + b.y) * 0.12); var gr = g.createLinearGradient(-16 * s, -16 * s, 16 * s, 16 * s); gr.addColorStop(0, '#93c5fd'); gr.addColorStop(1, '#3b82f6'); g.fillStyle = gr; g.strokeStyle = '#e0f2fe'; g.lineWidth = 2.5 * s; g.shadowColor = 'rgba(96,165,250,.9)'; g.shadowBlur = 14 * s;
    if (g.roundRect) { g.beginPath(); g.roundRect(-15 * s, -15 * s, 30 * s, 30 * s, 7 * s); g.fill(); g.stroke(); } else { g.fillRect(-15 * s, -15 * s, 30 * s, 30 * s); }
    g.shadowBlur = 0; g.fillStyle = '#fff'; g.font = '800 ' + Math.round(20 * s) + 'px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 1 * s); g.restore();
  }
  function drawProj(p, sx, sy, z) { g.save(); g.translate(sx, sy - 16 * z); var c = p.t === 'seeker' ? '#ef4444' : '#60a5fa'; g.shadowColor = c; g.shadowBlur = 16 * z; g.fillStyle = c; g.beginPath(); g.arc(0, 0, (p.t === 'seeker' ? 9 : 8) * z, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-2 * z, -2 * z, 3.5 * z, 0, TAU); g.fill(); g.restore(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(sx, sy, 8 * z, 3.5 * z, 0, 0, TAU); g.fill(); }
  function drawWorld() {
    var T = S.track, d = T.def, R = Math.hypot(W / 2, OY, H) / ZOOM + 140;
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = d.grass; g.fillRect(0, 0, W, H);
    applyCam(); g.fillStyle = pattern(T); g.fillRect(cam.x - R, cam.y - R, R * 2, R * 2);
    g.lineJoin = 'round'; g.lineCap = 'butt';
    g.setLineDash([]); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = HALF * 2 + 56; g.stroke(T.path);
    g.strokeStyle = d.kerbA; g.lineWidth = HALF * 2 + 34; g.stroke(T.path);
    g.setLineDash([30, 30]); g.strokeStyle = d.kerbB; g.stroke(T.path); g.setLineDash([]);
    g.strokeStyle = d.road; g.lineWidth = HALF * 2; g.stroke(T.path);
    g.strokeStyle = d.line; g.lineWidth = HALF * 2 - 8; g.stroke(T.path); g.strokeStyle = d.road; g.lineWidth = HALF * 2 - 18; g.stroke(T.path);
    g.setLineDash([34, 48]); g.strokeStyle = d.line; g.lineWidth = 5; g.stroke(T.path); g.setLineDash([]);
    if (d.id === 'neon') { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(34,211,238,.10)'; g.lineWidth = HALF * 2 + 40; g.stroke(T.path); g.restore(); }
    // start line
    g.save(); g.translate(T.x[0], T.y[0]); g.rotate(Math.atan2(T.ty[0], T.tx[0])); for (var r = 0; r < 4; r++) for (var c = 0; c < 14; c++) { g.fillStyle = (r + c) % 2 ? '#fff' : '#111'; g.fillRect(-20 + r * 10, -HALF + 8 + c * ((HALF * 2 - 16) / 14), 10, (HALF * 2 - 16) / 14 + 0.5); } g.restore();
    // boost pads
    T.pads.forEach(function (p) { g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = 'rgba(20,30,60,.85)'; g.fillRect(-34, -38, 68, 76); g.strokeStyle = '#60a5fa'; g.lineWidth = 3; g.strokeRect(-34, -38, 68, 76); for (var k = 0; k < 3; k++) { var ph = (S.t * 3 + k * 0.33) % 1; g.strokeStyle = 'rgba(147,197,253,' + (1 - ph) + ')'; g.lineWidth = 6; g.beginPath(); g.moveTo(-18 + ph * 40 - 14, -22); g.lineTo(-18 + ph * 40 + 4, 0); g.lineTo(-18 + ph * 40 - 14, 22); g.stroke(); } g.restore(); });
    S.slicks.forEach(function (s) { g.save(); g.globalAlpha = Math.min(1, s.life / 2); g.fillStyle = '#0b0b10'; g.beginPath(); g.ellipse(s.x, s.y, 34, 26, s.x, 0, TAU); g.fill(); g.fillStyle = 'rgba(140,120,255,.4)'; g.beginPath(); g.ellipse(s.x - 7, s.y - 6, 12, 6, 0.6, 0, TAU); g.fill(); g.restore(); });
    // karts' bodies on the ground
    S.racers.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (r) { drawKartBody(r); });
    // sprites (upright), sorted by screen y
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var list = [], z = ZOOM, rr2 = R * R, i;
    for (i = 0; i < T.deco.length; i++) { var dc = T.deco[i], dx = dc.x - cam.x, dy = dc.y - cam.y; if (dx * dx + dy * dy > rr2) continue; var p = toScr(dc.x, dc.y); if (p[0] < -120 || p[0] > W + 120 || p[1] < -160 || p[1] > H + 120) continue; list.push({ y: p[1], f: drawDeco, a: dc, sx: p[0], sy: p[1] }); }
    T.boxes.forEach(function (b) { var p = toScr(b.x, b.y); if (p[0] < -60 || p[0] > W + 60 || p[1] < -80 || p[1] > H + 60) return; list.push({ y: p[1], f: drawBox, a: b, sx: p[0], sy: p[1] }); });
    S.racers.forEach(function (rc) { var so = rc.seatX || 0, p = toScr(rc.x + Math.cos(rc.a) * so, rc.y + Math.sin(rc.a) * so); if (p[0] < -120 || p[0] > W + 120 || p[1] < -160 || p[1] > H + 140) return; list.push({ y: p[1] + 0.5, f: drawSprite, a: rc, sx: p[0], sy: p[1] }); });
    S.proj.forEach(function (pj) { var p = toScr(pj.x, pj.y); list.push({ y: p[1], f: drawProj, a: pj, sx: p[0], sy: p[1] }); });
    list.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < list.length; i++) list[i].f(list[i].a, list[i].sx, list[i].sy, z);
    // particles
    applyCam(); S.parts.forEach(function (q) { var t = q.life / q.max; g.globalAlpha = Math.max(0, t); g.fillStyle = q.col; g.beginPath(); g.arc(q.x, q.y, q.size * (0.5 + t * 0.7), 0, TAU); g.fill(); }); g.globalAlpha = 1;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function itemIcon(c, it, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
    if (it === 'turbo') { c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(0, -14); c.lineTo(11, 2); c.lineTo(3, 2); c.lineTo(3, 14); c.lineTo(-3, 14); c.lineTo(-3, 2); c.lineTo(-11, 2); c.closePath(); c.fill(); c.strokeStyle = '#b45309'; c.lineWidth = 2; c.stroke(); }
    else if (it === 'pulse') { c.fillStyle = '#60a5fa'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.strokeStyle = '#bfdbfe'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.stroke(); }
    else if (it === 'seeker') { c.fillStyle = '#ef4444'; c.beginPath(); c.moveTo(0, -14); c.lineTo(7, 4); c.lineTo(0, 9); c.lineTo(-7, 4); c.closePath(); c.fill(); c.strokeStyle = '#fecaca'; c.lineWidth = 2; c.beginPath(); c.arc(0, 2, 13, 0, TAU); c.stroke(); }
    else if (it === 'slick') { c.fillStyle = '#1f1b3a'; c.strokeStyle = '#a78bfa'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 14, 10, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = 'rgba(167,139,250,.6)'; c.beginPath(); c.ellipse(-4, -3, 5, 2.5, 0.5, 0, TAU); c.fill(); }
    else if (it === 'shield') { c.fillStyle = '#38bdf8'; c.strokeStyle = '#e0f2fe'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -14); c.lineTo(12, -9); c.lineTo(11, 3); c.quadraticCurveTo(8, 11, 0, 15); c.quadraticCurveTo(-8, 11, -11, 3); c.lineTo(-12, -9); c.closePath(); c.fill(); c.stroke(); }
    else if (it === 'zap') { c.fillStyle = '#fde047'; c.strokeStyle = '#a16207'; c.lineWidth = 2; c.beginPath(); c.moveTo(4, -15); c.lineTo(-9, 3); c.lineTo(-1, 3); c.lineTo(-4, 15); c.lineTo(10, -4); c.lineTo(2, -4); c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  }
  var mini = null;
  function drawMini(T, x0, y0, sz) {
    if (!mini || mini.id !== T.def.id) { var c = document.createElement('canvas'); c.width = c.height = 220; var x = c.getContext('2d'), bb = T.bb, w = bb[2] - bb[0], h = bb[3] - bb[1], sc = 190 / Math.max(w, h), ox = (220 - w * sc) / 2, oy = (220 - h * sc) / 2; x.lineJoin = 'round'; x.lineCap = 'round'; x.beginPath(); for (var i = 0; i < T.N; i++) { var px = ox + (T.x[i] - bb[0]) * sc, py = oy + (T.y[i] - bb[1]) * sc; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 11; x.stroke(); x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 6; x.stroke(); mini = { id: T.def.id, c: c, sc: sc, ox: ox, oy: oy, bb: bb }; }
    g.save(); g.globalAlpha = 0.95; g.fillStyle = 'rgba(6,10,24,.55)'; g.beginPath(); if (g.roundRect) g.roundRect(x0 - 6, y0 - 6, sz + 12, sz + 12, 16); else g.rect(x0 - 6, y0 - 6, sz + 12, sz + 12); g.fill(); g.drawImage(mini.c, x0, y0, sz, sz); var k = sz / 220;
    S.racers.slice().sort(function (a, b) { return (a.me ? 1 : 0) - (b.me ? 1 : 0); }).forEach(function (r) { var px = x0 + (mini.ox + (r.x - mini.bb[0]) * mini.sc) * k, py = y0 + (mini.oy + (r.y - mini.bb[1]) * mini.sc) * k; g.fillStyle = r.me ? '#fff' : r.bodyCol; g.strokeStyle = r.me ? '#3b82f6' : 'rgba(0,0,0,.6)'; g.lineWidth = r.me ? 3 : 1.5; g.beginPath(); g.arc(px, py, r.me ? 6 : 4, 0, TAU); g.fill(); g.stroke(); });
    g.restore();
  }
  function drawHud() {
    var me = S.me; if (!me) return; var u = clamp(Math.min(W, H) / 640, 0.72, 1.25), safeT = 10;
    g.save(); g.textBaseline = 'alphabetic';
    function txt(t, x, y, size, col, align, weight, italic) { g.font = (italic ? 'italic ' : '') + (weight || 800) + ' ' + Math.round(size * u) + 'px system-ui,"Segoe UI",sans-serif'; g.textAlign = align || 'left'; g.lineWidth = 5 * u; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineJoin = 'round'; g.strokeText(t, x, y); g.fillStyle = col || '#fff'; g.fillText(t, x, y); }
    var pl = me.finished ? me.place : placeOf(me), lx = 18 * u + 8, ty = 54 * u + safeT;
    txt(String(pl), lx, ty + 14 * u, 66, '#fff', 'left', 900, true); txt(ord(pl).slice(String(pl).length), lx + g.measureText(String(pl)).width + 2, ty - 18 * u + 14 * u, 22, '#bcd9ff', 'left', 800, true);
    txt('/ ' + S.racers.length, lx + 64 * u, ty + 14 * u, 22, '#9fb4d6', 'left', 700, true);
    txt('Lap ' + Math.min(S.laps, me.lap) + '/' + S.laps, lx, ty + 44 * u, 22, '#fff', 'left', 800);
    txt(fmt(me.finished ? me.ft : S.raceT * 1000), W / 2, 34 * u + safeT, 24, '#fff', 'center', 800);
    // item slot
    var ix = lx + 26 * u, iy = ty + 98 * u, sz = 64 * u; g.fillStyle = 'rgba(8,14,32,.62)'; g.strokeStyle = 'rgba(147,197,253,.5)'; g.lineWidth = 2.5; g.beginPath(); if (g.roundRect) g.roundRect(ix - sz / 2, iy - sz / 2, sz, sz, 16 * u); else g.rect(ix - sz / 2, iy - sz / 2, sz, sz); g.fill(); g.stroke();
    if (me.roll > 0) { var keysI = Object.keys(ITEMS); itemIcon(g, keysI[Math.floor(S.t * 14) % keysI.length], ix, iy, 1.25 * u); } else if (me.item) { var pu = 1 + Math.sin(S.t * 6) * 0.06; itemIcon(g, me.item, ix, iy, 1.5 * u * pu); }
    // speed + drift bars
    var spd = Math.hypot(me.vx, me.vy), bw = 190 * u, bx = W / 2 - bw / 2, by = H - 30 * u - (TOUCH ? 0 : 0) - 8;
    if (!TOUCH) { g.fillStyle = 'rgba(8,14,32,.6)'; g.fillRect(bx, by, bw, 9 * u); var f = clamp(spd / (MAXSP * 1.2), 0, 1); var gr = g.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#3b82f6'); gr.addColorStop(1, me.boost > 0 ? '#fbbf24' : '#93c5fd'); g.fillStyle = gr; g.fillRect(bx, by, bw * f, 9 * u); txt(Math.round(spd / 4) + ' km/h', W / 2, by - 7 * u, 14, '#bcd9ff', 'center', 700); }
    if (me.drift) { var dw = 120 * u, dxx = W / 2 - dw / 2, dyy = OY + 70 * u, tier = me.driftT > 2.4 ? 3 : me.driftT > 1.5 ? 2 : me.driftT > 0.8 ? 1 : 0, cols = ['#e5e7eb', '#60a5fa', '#fb923c', '#c084fc']; g.fillStyle = 'rgba(8,14,32,.6)'; g.fillRect(dxx, dyy, dw, 8 * u); g.fillStyle = cols[tier]; g.fillRect(dxx, dyy, dw * clamp(me.driftT / 2.6, 0, 1), 8 * u); }
    // minimap
    var ms = clamp(H * 0.22, 110, 170), mx = W - ms - 18 - (TOUCH ? 0 : 0), my = 72 * u + 4; drawMini(S.track, mx, my, ms);
    // pop text
    S.pops.forEach(function (p, i) { var a = Math.min(1, p.life / 0.4) * Math.min(1, (p.max - p.life) / 0.12 + 0.2), yy = H * 0.3 + i * 36 * u - (p.max - p.life) * 14; g.globalAlpha = a; txt(p.t, W / 2, yy, 32, p.col, 'center', 900, true); g.globalAlpha = 1; });
    if (S.wrong > 1.1 && S.mode === 'race') { g.globalAlpha = 0.6 + 0.4 * Math.sin(S.t * 10); txt('WRONG WAY', W / 2, H * 0.42, 46, '#fca5a5', 'center', 900, true); g.globalAlpha = 1; }
    if (S.mode === 'count') { var n = Math.ceil(S.count), frac = S.count - Math.floor(S.count), label = n > 3 ? '' : String(n); if (label) { g.globalAlpha = Math.min(1, frac * 2 + 0.3); txt(label, W / 2, H * 0.4, 130 * (0.9 + frac * 0.35), '#fff', 'center', 900, true); g.globalAlpha = 1; } }
    else if (S.mode === 'race' && S.raceT < 1.1) { g.globalAlpha = clamp(1.1 - S.raceT, 0, 1); txt('GO', W / 2, H * 0.4, 150 * (1 + S.raceT * 0.3), '#8dffc3', 'center', 900, true); g.globalAlpha = 1; }
    if (S.mode === 'after') { txt('Finished ' + ord(me.place), W / 2, H * 0.28, 44, '#fde68a', 'center', 900, true); if (MPS) txt('Waiting for the other racers', W / 2, H * 0.28 + 34 * u, 20, '#bcd9ff', 'center', 700, false); }
    g.restore();
    if (S.flash > 0) { g.fillStyle = 'rgba(255,255,255,' + clamp(S.flash * 1.6, 0, 0.6) + ')'; g.fillRect(0, 0, W, H); }
  }

  // ---------------------------------------------------------------- online race (Bedwars engine lobby)
  // The parent page (arcade/bedwars) owns the connection. It posts us the race setup and one snapshot per server tick,
  // and forwards whatever we post back. Our own kart is driven locally, everyone else is shown from the server.
  var ITEM_KEYS = ['turbo', 'pulse', 'seeker', 'slick', 'shield', 'zap'], mpLastSend = 0, mpLeaveAt = 0, mpById = {};
  function mpSend(msg) { try { window.parent.postMessage({ sr: 'send', msg: msg }, location.origin); } catch (e) {} }
  function mpLeave() {
    var now = Date.now(); if (now - mpLeaveAt < 3000) { try { window.parent.postMessage({ sr: 'leave' }, location.origin); } catch (e) {} return; }
    mpLeaveAt = now; popText('Press again to leave the race', '#fca5a5');
  }
  function mpBoot() {
    var pb = $('pauseBtn'); if (pb) { pb.setAttribute('aria-label', 'Leave race'); pb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4"/><path d="M4 12h10"/><path d="m8 8-4 4 4 4"/></svg>'; }
    window.addEventListener('message', function (e) {
      if (e.source !== window.parent || e.origin !== location.origin) return;
      var d = e.data || {}; if (d.sr === 'init') startMP(d.init); else if (d.sr === 'snap') mpSnap(d); else if (d.sr === 'msg') mpMsg(d.m);
    });
    window.addEventListener('keydown', function () { try { engineOn(); } catch (e) {} }, { once: true });
    window.addEventListener('pointerdown', function () { try { engineOn(); } catch (e) {} }, { once: true });
    window.parent.postMessage({ sr: 'ready' }, location.origin);
  }
  function startMP(init) {
    var T = getTrack(init.track), R = rng(init.track.length * 31 + 5), M = window.SRCars ? SRCars.MODELS : [{ id: 'kart', seatX: -4 }];
    S.track = T; S.racers = []; S.proj = []; S.slicks = []; S.parts = []; S.pops = []; S.laps = init.laps; S.finishedN = 0; S.results = null; S.afterT = 0; S.raceT = 0; S.wrong = 0; S.gasAt = -1; S.early = false; S.demo = false; S.mp = true; S.flash = 0; S.auto = false;
    T.boxes.forEach(function (b) { b.t = 0; }); mpById = {};
    init.racers.forEach(function (x, i) {
      var isMe = x.id === init.you, look = x.look && x.look.body ? x.look : randomLook(R), r = mkRacer(i, T, x.slot, look, x.nick || 'Racer', isMe, isMe ? 1 : 0.95, R);
      r.id = x.id; r.remote = !isMe; r.bot = !!x.bot; r.srv = null; r.rnd = R();
      if (!isMe) { var mm = M[(x.id * 7 + 3) % M.length]; r.car = mm.id; r.seatX = mm.seatX; }
      S.racers.push(r); mpById[x.id] = r; if (isMe) S.me = r;
    });
    S.focus = S.me; S.goLocal = init.goAt - (init.serverNow - init.localNow); S.count = Math.max(0, (S.goLocal - Date.now()) / 1000); S.mode = 'count'; S.hintT = 6;
    snapCam(); try { engineOn(); } catch (e) {} show(null);
    var hint = $('hint'); hint.textContent = TOUCH ? 'Drag on the left to steer. Hold DRIFT through turns. Tap ITEM to use it.' : 'Arrow keys or WASD to steer. Hold Space in a turn to drift. E uses your item.'; hint.classList.add('on'); showHint = hint;
    $('tGas').style.display = 'none'; opts.auto = TOUCH; S.auto = false;
    mpSend({ t: 'rcc', car: opts.car || 'kart' }); try { window.focus(); } catch (e) {}
  }
  function mpSnap(d) {
    var now = performance.now();
    (d.rc || []).forEach(function (q) {
      var r = mpById[q[0]]; if (!r || r === S.me) { if (r === S.me && q[10]) { r.place = q[10]; } return; }
      var first = !r.srv; r.srv = { x: q[1], y: q[2], a: q[3], vx: q[4], vy: q[5], f: q[6], st: q[7], u: q[9], place: q[10], at: now };
      r.bot = !!(q[6] & 64);
      if (first) { r.x = q[1]; r.y = q[2]; r.a = q[3]; }
    });
    (d.rcc || []).forEach(function (q) { var r = mpById[q[0]]; if (r && r !== S.me && q[1] && window.SRCars) { var mm = SRCars.MODELS.filter(function (m) { return m.id === q[1]; })[0]; if (mm) { r.car = mm.id; r.seatX = mm.seatX; } } });
    (d.rce || []).forEach(function (ev) { if (mpById[ev[0]] && mpById[ev[0]] !== S.me) mpEvent(mpById[ev[0]], ev); });
  }
  function mpMsg(m) {
    if (m.t === 'rcfix' && S.me) { S.me.x = m.x; S.me.y = m.y; S.me.vx = S.me.vy = 0; if (m.a != null) S.me.a = m.a; }
    else if (m.t === 'rcf' && S.me) { S.me.place = m.place; S.me.ft = m.ft; S.me.finished = true; }
  }
  function mpEvent(o, ev) {   // someone else used an item: run it here too, it only ever hurts our own kart
    var k = ITEM_KEYS[ev[1]], x = ev[2], y = ev[3], a = ev[6], fx = Math.cos(a), fy = Math.sin(a);
    if (k === 'pulse') S.proj.push({ t: 'pulse', x: x + fx * 30, y: y + fy * 30, vx: fx * 820 + ev[4] * 0.3, vy: fy * 820 + ev[5] * 0.3, life: 1.7, owner: o, age: 0 });
    else if (k === 'seeker') S.proj.push({ t: 'seeker', x: x + fx * 30, y: y + fy * 30, vx: fx * 600, vy: fy * 600, life: 4.5, owner: o, age: 0, a: a });
    else if (k === 'slick') S.slicks.push({ x: x - fx * 38, y: y - fy * 38, life: 14, owner: o, age: 0 });
    else if (k === 'zap' && S.me && !S.me.finished && S.me.u > o.u) { hit(S.me, 'zap'); S.flash = 0.35; }
  }
  function remoteStep(r, dt) {
    var s = r.srv; if (!s) return;
    var age = Math.min(0.25, (performance.now() - s.at) / 1000), tx = s.x + s.vx * age, ty = s.y + s.vy * age, k = 1 - Math.exp(-14 * dt);
    r.x += (tx - r.x) * k; r.y += (ty - r.y) * k; r.a += angd(s.a, r.a) * k; r.vx = s.vx; r.vy = s.vy;
    var f = s.f, wasSpin = r.spin > 0;
    r.drift = !!(f & 1); r.driftDir = s.st >= 0 ? 1 : -1; r.driftT = r.drift ? r.driftT + dt : 0;
    r.spin = f & 2 ? 0.1 : 0; r.spinA = r.spin ? r.spinA + dt * 11 : 0; r.boost = f & 4 ? 0.1 : 0; r.shield = f & 8 ? 1 : 0; r.off = !!(f & 16); r.inv = f & 32 ? 0.1 : 0; r.steerV = s.st / 100;
    r.u = s.u; r.finished = s.place > 0; if (s.place) r.place = s.place;
    if (r.hop > 0) r.hop -= dt;
    var fx = Math.cos(r.a), fy = Math.sin(r.a);
    if (r.boost > 0) puff(r.x - fx * 24, r.y - fy * 24, -fx * 160 + (Math.random() - 0.5) * 50, -fy * 160 + (Math.random() - 0.5) * 50, 0.3, 6 + Math.random() * 4, Math.random() < 0.5 ? '#ffb347' : '#ff6b3d');
    if (r.drift) { var col = r.driftT > 2.4 ? '#c084fc' : r.driftT > 1.5 ? '#fb923c' : r.driftT > 0.8 ? '#60a5fa' : '#e5e7eb'; puff(r.x - fx * 16, r.y - fy * 16, -fx * 80 + (Math.random() - 0.5) * 160, -fy * 80 + (Math.random() - 0.5) * 160, 0.35, 4, col); }
    if (!wasSpin && r.spin > 0) { for (var q = 0; q < 8; q++) puff(r.x, r.y, (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, 0.5, 5, '#ffd34d'); }
  }
  function mpTick() {
    var now = performance.now(), me = S.me; if (!me || now - mpLastSend < 50 || S.mode === 'boot') return; mpLastSend = now;
    var f = (me.drift ? 1 : 0) | (me.spin > 0 ? 2 : 0) | (me.boost > 0 ? 4 : 0) | (me.shield > 0 ? 8 : 0) | (me.off ? 16 : 0) | (me.inv > 0 ? 32 : 0);
    mpSend({ t: 'rc', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, a: Math.round(me.a * 100) / 100, vx: Math.round(me.vx), vy: Math.round(me.vy), f: f, st: Math.round(clamp(me.steerV, -1, 1) * 100), it: me.item ? ITEM_KEYS.indexOf(me.item) + 1 : 0 });
  }

  // ---------------------------------------------------------------- frame loop
  var last = 0, showHint = null;
  function frame(ts) {
    requestAnimationFrame(frame);
    // Cap the draw rate to ~60fps regardless of the screen's real refresh rate (120Hz/ProMotion
    // screens otherwise render this twice as often for an identical picture, which is most of
    // what makes a game like this feel laggy and burn through battery on those devices).
    if (ts - last < 15.5) return;
    var dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    if (S.mode === 'boot' || !S.track) return;
    if (S.mode === 'paused' || S.mode === 'results' && false) { drawWorld(); drawHud(); return; }
    var steps = dt > 0.026 ? 2 : 1; for (var i = 0; i < steps; i++) update(dt / steps);
    // camera
    var f = S.focus || S.me; if (f) {
      var spd = Math.hypot(f.vx, f.vy), k = 1 - Math.exp(-6 * dt), kz = 1 - Math.exp(-3 * dt), fx = Math.cos(f.a), fy = Math.sin(f.a);
      var tz = clamp(H / 760, 0.52, 1.12) * (1 - clamp(spd / MAXSP, 0, 1.3) * 0.13) * (S.mode === 'demo' ? 0.9 : 1);
      cam.x = lerp(cam.x, f.x + fx * 90 + f.vx * 0.08, k); cam.y = lerp(cam.y, f.y + fy * 90 + f.vy * 0.08, k); cam.a += angd(f.a + (f.drift ? -f.driftDir * 0.12 : 0), cam.a) * (1 - Math.exp(-4.5 * dt)); cam.z = lerp(cam.z, tz, kz);
      ZOOM = cam.z; if (S.shake > 0) { ZOOM *= 1 + Math.sin(S.t * 60) * 0.006; }
    }
    camSetup(); drawWorld();
    if (S.mode === 'race' || S.mode === 'count' || S.mode === 'after') drawHud();
    if (S.me && eng) { var sp = clamp(Math.hypot(S.me.vx, S.me.vy) / MAXSP, 0, 1.3); engineSet(sp, S.mode === 'race' || S.mode === 'after'); }
    if (showHint && S.hintT <= 0) { showHint.classList.remove('on'); showHint = null; }
  }

  // ---------------------------------------------------------------- UI
  var LAYERS = ['title', 'how', 'pick', 'pause', 'results'];
  function show(id) { LAYERS.forEach(function (l) { $(l).classList.toggle('on', l === id); }); var inRace = !id || id === 'pause'; $('pauseBtn').classList.toggle('on', S.mode === 'race' || S.mode === 'count' || S.mode === 'after'); $('touch').classList.toggle('on', TOUCH && (S.mode === 'race' || S.mode === 'count' || S.mode === 'after') && !id); }
  function togglePause(force) {
    if (MPS) return;
    if (S.mode === 'paused') { S.mode = S.prevMode || 'race'; show(null); return; }
    if (S.mode !== 'race' && S.mode !== 'count') return; S.prevMode = S.mode; S.mode = 'paused'; $('bMute').textContent = 'Sound: ' + (muted() ? 'off' : 'on'); show('pause'); engineSet(0, false);
  }
  function seg(el, list, val, cb) { el.textContent = ''; list.forEach(function (x) { var b = document.createElement('button'); b.type = 'button'; b.textContent = x[1]; b.className = String(x[0]) === String(val) ? 'on' : ''; b.addEventListener('click', function () { Array.prototype.forEach.call(el.children, function (c) { c.classList.remove('on'); }); b.classList.add('on'); cb(x[0]); }); el.appendChild(b); }); }
  function buildPick() {
    var box = $('trackList'); box.textContent = '';
    TRACKS.forEach(function (d) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tk' + (opts.track === d.id ? ' on' : ''); b.dataset.id = d.id;
      var c = document.createElement('canvas'); c.width = 320; c.height = 240; var T = getTrack(d.id), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 240); gr.addColorStop(0, d.thumb[0]); gr.addColorStop(1, d.thumb[1]); x.fillStyle = gr; x.fillRect(0, 0, 320, 240);
      var bb = T.bb, w = bb[2] - bb[0], h = bb[3] - bb[1], sc = 190 / Math.max(w * 0.75, h), ox = (320 - w * sc) / 2, oy = (240 - h * sc) / 2; x.lineJoin = 'round'; x.lineCap = 'round';
      function trace() { x.beginPath(); for (var i = 0; i < T.N; i++) { var px = ox + (T.x[i] - bb[0]) * sc, py = oy + (T.y[i] - bb[1]) * sc; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); }
      trace(); x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 17; x.stroke(); trace(); x.strokeStyle = d.kerbB; x.lineWidth = 14; x.stroke(); trace(); x.strokeStyle = d.road; x.lineWidth = 10; x.stroke();
      x.fillStyle = '#fff'; var sx = ox + (T.x[0] - bb[0]) * sc, sy = oy + (T.y[0] - bb[1]) * sc; x.beginPath(); x.arc(sx, sy, 5, 0, TAU); x.fill();
      var info = document.createElement('div'); info.className = 'ti'; var bt = best[d.id + '|' + opts.laps];
      info.innerHTML = '<b></b><span></span><span class="best"></span>'; info.children[0].textContent = d.name; info.children[1].textContent = d.sub; info.children[2].textContent = bt ? 'Best ' + fmt(bt) : 'No time yet';
      b.appendChild(c); b.appendChild(info); b.addEventListener('click', function () { opts.track = d.id; lsSet('sr_opts', opts); Array.prototype.forEach.call(box.children, function (n) { n.classList.toggle('on', n.dataset.id === d.id); }); sfx('click'); }); box.appendChild(b);
    });
    buildCars();
    seg($('segDiff'), [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], opts.diff, function (v) { opts.diff = v; lsSet('sr_opts', opts); });
    seg($('segLaps'), [[1, '1'], [3, '3'], [5, '5']], opts.laps, function (v) { opts.laps = +v; lsSet('sr_opts', opts); buildPickBest(); });
    seg($('segAuto'), [['1', 'Automatic'], ['0', 'Manual']], opts.auto ? '1' : '0', function (v) { opts.auto = v === '1'; lsSet('sr_opts', opts); });
    $('optAuto').style.display = TOUCH ? '' : 'none';
  }
  function buildCars() {
    var box = $('carList'); if (!box || !window.SRCars) return; box.textContent = '';
    var body = (player.look && player.look.body) || '#3fa9ff';
    SRCars.MODELS.forEach(function (m) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'car' + (opts.car === m.id ? ' on' : ''); b.dataset.id = m.id; b.setAttribute('aria-label', m.name);
      var c = document.createElement('canvas'); c.width = 224; c.height = 144; c.getContext('2d').drawImage(SRCars.sprite(m.id, body, '#ffffff'), 0, 0);
      var n = document.createElement('span'); n.textContent = m.name; b.appendChild(c); b.appendChild(n);
      b.addEventListener('click', function () { opts.car = m.id; lsSet('sr_opts', opts); Array.prototype.forEach.call(box.children, function (x) { x.classList.toggle('on', x === b); }); if (S.me) S.me.car = m.id; });
      box.appendChild(b);
    });
  }
  function buildPickBest() { Array.prototype.forEach.call($('trackList').children, function (n) { var bt = best[n.dataset.id + '|' + opts.laps]; n.querySelector('.best').textContent = bt ? 'Best ' + fmt(bt) : 'No time yet'; }); }
  function beginRace() {
    engineOn(); sfx('click'); startRace(false); show(null); S.hintT = 7;
    var hint = $('hint'); hint.textContent = TOUCH ? (opts.auto ? 'Drag on the left to steer. Hold DRIFT through turns. Tap ITEM to use it.' : 'Drag left to steer. GAS to go. Hold DRIFT through turns.') : 'Arrow keys or WASD to steer. Hold Space in a turn to drift. E uses your item. P pauses.'; hint.classList.add('on'); showHint = hint;
    $('tGas').style.display = TOUCH && !opts.auto ? '' : 'none';
  }
  function toDemo() { S.mode = 'demo'; startRace(true); show('title'); $('pauseBtn').classList.remove('on'); $('hint').classList.remove('on'); engineSet(0, false); }
  function drawMe() {
    var c = $('meCv'), x = c.getContext('2d'); x.clearRect(0, 0, 128, 128); try { x.save(); x.scale(1, 1); A.drawGim(x, 64, 104, player.look, { still: true, dir: 0, shadow: true, scale: 1.05, t: 0 }); x.restore(); } catch (e) {}
    $('meName').textContent = player.name; $('meSub').textContent = player.signed ? 'Your equipped gim races for you. Finish high to earn Scrolls.' : 'Playing as a guest. Sign in to ScrollHub to earn Scrolls.';
  }
  function loadPlayer() {
    var hd = authHeaders();
    fetch('/api/auth/me', { headers: hd, credentials: 'include' }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.loggedIn) { player.signed = true; player.name = j.username; } }).catch(function () {}).then(function () {
      return fetch('/api/casino/me', { headers: hd, credentials: 'include' }).then(function (r) { return r.json(); }).then(function (j) { var p = j && j.profile; if (p && p.lookValues) { var lv = p.lookValues; player.look = { skin: lv.skin || 'gim', body: lv.body || '#3fa9ff', hat: lv.hat || '', acc: lv.acc || '', trail: lv.trail || '' }; if (!player.signed && p.nick) player.name = p.nick; } }).catch(function () {});
    }).then(function () { drawMe(); });
  }
  function wire() {
    $('bPlay').addEventListener('click', function () { try { engineOn(); } catch (e) {} sfx('click'); try { buildPick(); } catch (e) { if (window.console) console.error(e); } show('pick'); });
    $('bOnline').addEventListener('click', function () { sfx('click'); location.href = '/arcade?play=race'; });
    $('bHow').addEventListener('click', function () { sfx('click'); show('how'); }); $('bHowBack').addEventListener('click', function () { show('title'); });
    $('bPickBack').addEventListener('click', function () { show('title'); }); $('bStart').addEventListener('click', beginRace);
    $('pauseBtn').addEventListener('click', function () { if (MPS) { mpLeave(); return; } togglePause(); }); $('bResume').addEventListener('click', function () { togglePause(); });
    $('bRestart').addEventListener('click', function () { S.mode = 'race'; beginRace(); });
    $('bMute').addEventListener('click', function () { var m = SC.sfxToggle ? SC.sfxToggle() : false; $('bMute').textContent = 'Sound: ' + (m ? 'off' : 'on'); });
    $('bQuit').addEventListener('click', function () { toDemo(); });
    $('bResMenu').addEventListener('click', function () { toDemo(); }); $('bResAgain').addEventListener('click', beginRace);
    $('howBody').innerHTML = '<p><b>Steer</b> with the arrow keys or WASD. On a touch screen, drag on the left side.</p><p><b>Drift</b> by holding Space (or DRIFT) while turning. Hold it longer for a blue, orange then purple spark, and let go for a mini turbo.</p><p><b>Items</b>: drive through a glowing box. Use your item with E (or the ITEM button). Turbo speeds you up, Pulse and Seeker hit racers ahead, Slick makes a puddle behind you, Shield blocks one hit, and Zap spins everyone in front of you.</p><p><b>Boost pads</b> on the road give a quick burst. Time your gas at the start lights for a rocket start. Press R if you get stuck.</p>';
  }
  // title screen hides its own decorative canvas; the live demo race runs behind the menu
  var tr = document.querySelector('#title .road'); if (tr) tr.style.display = 'none';
  wire(); loadPlayer(); drawMe();
  if (MPS) { S.mode = 'boot'; show(null); requestAnimationFrame(frame); mpBoot(); } else { S.mode = 'demo'; startRace(true); show('title'); requestAnimationFrame(frame); }
  setTimeout(function () { $('loading').classList.add('done'); }, 500);
  // handy for testing
  window.__sr = { sim: function (sec) { var n = Math.round(sec * 60); for (var i = 0; i < n; i++) { if (S.mode === 'results') break; update(1 / 60); } }, S: S, opts: opts, player: player, TRACKS: TRACKS, cam: cam, startRace: startRace, beginRace: beginRace };
})();
