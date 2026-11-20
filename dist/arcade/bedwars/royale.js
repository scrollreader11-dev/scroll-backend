/* ============================================================
   ScrollHub Games — SCROLL ROYALE (client).
   Top-down battle royale: battle bus, gliding, rarity guns with tracers, chests & floor loot,
   heals/shields, jeeps, destructible everything, roofs that open when you walk in, a shrinking
   storm, minimap, damage numbers, kill feed and a Victory Royale.
   game.js calls RG.attach(api) once, then the RG.* hooks while S.game === 'royale'.
   ============================================================ */
(function () {
  var RG = window.RG = {};
  var X = null, c = null, S = null, B = window.BW, MG = window.MG, T = B.T, W = B.W, H = B.H;
  var TAU = Math.PI * 2;
  var st = null; // per-match state
  function P() { return X.getP(); }
  function now() { return X.now(); }
  function snow() { return X.snow(); }
  function RW(k) { return MG.RW[k]; }
  function rar(i) { return MG.RRAR[i | 0] || MG.RRAR[0]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (q) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[q]; }); }
  function $(id) { return document.getElementById(id); }

  // ------------------------------------------------------------ sound (tiny synth, follows the 🔊 mute)
  var ac = null, noiseBuf = null;
  function audio() {
    if (window.SC && SC.sfxMuted && SC.sfxMuted()) return null;
    try { if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); } if (ac.state === 'suspended') ac.resume(); } catch (e) { return null; }
    if (!noiseBuf) { var n = ac.sampleRate, b = ac.createBuffer(1, n, n), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b; }
    return ac;
  }
  function boom(vol, dur, freq, q, type, pitch) {
    var a = audio(); if (!a || vol < 0.01) return; var t0 = a.currentTime;
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(a.destination); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
    if (pitch) { var o = a.createOscillator(), og = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(pitch, t0); o.frequency.exponentialRampToValueAtTime(pitch * 0.35, t0 + dur * 0.6); og.gain.setValueAtTime(vol * 0.9, t0); og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.7); o.connect(og); og.connect(a.destination); o.start(t0); o.stop(t0 + dur); }
  }
  function tone(f0, f1, dur, vol, type) { var a = audio(); if (!a) return; var t0 = a.currentTime, o = a.createOscillator(), g = a.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02); }
  function volAt(x, y) { var p = P(); if (!p) return 0.5; var d = Math.hypot(x - p.x, y - p.y); return clamp(1 - d / 1400, 0, 1); }
  var SND = {
    pistol: function (v) { boom(0.32 * v, 0.14, 2600, 1.2, 'bandpass', 220); },
    smg: function (v) { boom(0.22 * v, 0.09, 3000, 1.4, 'bandpass', 260); },
    ar: function (v) { boom(0.3 * v, 0.13, 2000, 1, 'bandpass', 160); },
    burst: function (v) { boom(0.3 * v, 0.12, 2200, 1, 'bandpass', 170); },
    shotgun: function (v) { boom(0.5 * v, 0.32, 1200, 0.6, 'lowpass', 90); },
    tac: function (v) { boom(0.42 * v, 0.24, 1400, 0.7, 'lowpass', 100); },
    sniper: function (v) { boom(0.6 * v, 0.55, 900, 0.5, 'lowpass', 70); boom(0.2 * v, 0.9, 400, 0.4, 'lowpass'); },
    minigun: function (v) { boom(0.16 * v, 0.06, 3200, 1.6, 'bandpass', 300); },
    rocket: function (v) { boom(0.4 * v, 0.6, 700, 0.6, 'lowpass', 120); },
    explode: function (v) { boom(0.75 * v, 0.9, 500, 0.5, 'lowpass', 60); },
    hit: function () { tone(1400, 900, 0.05, 0.08, 'square'); },
    shieldHit: function () { tone(2200, 1600, 0.05, 0.06, 'triangle'); },
    shieldBreak: function () { boom(0.3, 0.35, 5000, 2, 'highpass'); tone(1800, 400, 0.3, 0.08, 'triangle'); },
    reload: function () { tone(900, 700, 0.05, 0.06, 'square'); setTimeout(function () { tone(600, 500, 0.06, 0.06, 'square'); }, 260); },
    pick: function () { tone(500, 900, 0.08, 0.07, 'triangle'); },
    chest: function () { tone(523, 784, 0.12, 0.08, 'triangle'); setTimeout(function () { tone(784, 1046, 0.18, 0.08, 'triangle'); }, 110); },
    melee: function (v) { boom(0.18 * v, 0.08, 900, 1, 'bandpass'); },
    heal: function () { tone(660, 990, 0.25, 0.06, 'sine'); },
    jump: function () { tone(300, 600, 0.3, 0.07, 'sine'); },
    empty: function () { tone(1200, 1100, 0.03, 0.05, 'square'); },
  };
  function snd(k, v) { try { if (SND[k]) SND[k](v == null ? 1 : v); } catch (e) {} }

  // ------------------------------------------------------------ attach / per-match init
  var rmb = false;
  RG.attach = function (api) { X = api; c = api.ctx; S = api.S; buildHud();
    addEventListener('mousedown', function (e) { if (e.button === 2) rmb = true; });
    addEventListener('mouseup', function (e) { if (e.button === 2) rmb = false; });
    addEventListener('blur', function () { rmb = false; });
  };
  RG.init = function (m, mp) {
    var g = m.rg || {};
    st = {
      bus: g.bus, zn: g.zn, chests: new Map(), loot: new Map(), dead: {}, ohp: {}, whp: {}, veh: new Map(), pj: new Map(),
      me: g.me || null, total: g.total || 0, tracers: [], booms: [], nums: [], hitT: 0, hurtT: 0, shT: 0, nextShot: 0, held: false, roof: {}, out: null, won: false,
      auto: {}, spec: 0, mapBig: false, lastPick: 0, alive: 0,
    };
    (g.chests || []).forEach(function (q) { st.chests.set(q[0], { id: q[0], x: q[1], y: q[2], open: !!q[3] }); });
    (g.loot || []).forEach(function (q) { addLoot(q[0], q[1], q[2], q[3], q[4], q[5], q[6]); });
    (g.veh || []).forEach(function (q) { st.veh.set(q[0], { id: q[0], x: q[1], y: q[2], ang: q[3] / 100, driver: q[4], hp: q[5], kind: q[6] || 'jeep', tur: (q[7] || 0) / 100, tx: q[1], ty: q[2] }); });
    var map = mp || S.map; (g.dead || []).forEach(function (id) { st.dead[id] = 1; var o = objById(id, map); if (o) map.obj[o.i] = 0; });
    (g.hp || []).forEach(function (q) { st.ohp[q[0]] = q[1]; });
    (g.whp || []).forEach(function (q) { st.whp[q[0]] = q[1]; });
    minimapBase = null;
    renderSlots(); renderBars();
  };
  RG.active = function () { return !!st && S.game === 'royale'; };
  function objById(id, mp) { var os = (mp || S.map).rgObjs || []; var o = os[id - 1]; return o && o.id === id ? o : os.find(function (q) { return q.id === id; }); }
  function addLoot(id, x, y, k, r, n, a) { st.loot.set(id, { id: id, x: x, y: y, k: k, r: r | 0, n: n | 0, a: a, born: now() }); }
  function myState() { return st && st.me ? st.me.st : 'ground'; }
  function heldItem() { var me = st && st.me; return me && me.sel >= 0 ? me.slots[me.sel] : null; }

  // ------------------------------------------------------------ network
  RG.snap = function (m) {
    if (!st) return;
    if (m.zn) st.zn = m.zn;
    var seen = {};
    (m.rpj || []).forEach(function (q) { var p = st.pj.get(q[0]); if (!p) { p = { id: q[0], k: q[1], x: q[2], y: q[3], tx: q[2], ty: q[3], born: now() }; st.pj.set(q[0], p); } p.tx = q[2]; p.ty = q[3]; seen[q[0]] = 1; });
    st.pj.forEach(function (p, id) { if (!seen[id]) st.pj.delete(id); });
    (m.rv || []).forEach(function (q) { var v = st.veh.get(q[0]); if (!v) { v = { id: q[0], x: q[1], y: q[2], kind: q[5] || 'jeep' }; v.hp = VDEF(v).hp; st.veh.set(q[0], v); } v.tx = q[1]; v.ty = q[2]; if (v.driver !== S.myId) v.ang = q[3] / 100; v.driver = q[4]; if (q[6] != null && v.driver !== S.myId) v.tur = q[6] / 100; });
  };
  RG.extra = function (e, x7) { e.rsh = x7 & 127; e.rst = (x7 >> 7) & 3; e.rrar = (x7 >> 9) & 7; e.ruse = (x7 >> 12) & 1; e.rrl = (x7 >> 13) & 1; e.rveh = (x7 >> 14) & 15; };
  RG.msg = function (m) {
    if (!st) return false;
    if (m.t === 'rgme') {
      var was = st.me; st.me = m;
      if (was && was.sh > 0 && m.sh <= 0 && m.hp < was.hp + 1) snd('shieldBreak');
      if (was && (m.hp < was.hp || m.sh < was.sh)) st.hurtT = now();
      if (was && was.st === 'bus' && m.st === 'glide') snd('jump');
      renderSlots(); renderBars(); return true;
    }
    if (m.t === 'rgmsg') { X.toast(m.text, 1400); return true; }
    if (m.t === 'rgout') { st.out = m; return true; }
    if (m.t === 'kb') { var p = P(); if (p) { p.vx += m.vx; p.vy += m.vy; } return true; }
    return false;
  };
  RG.event = function (k, ev) {
    if (!st) return false;
    var e, map = S.map, me = S.myId;
    switch (k) {
      case 'rl': addLoot(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6], ev[7]); return true;
      case 'rln': { var l = st.loot.get(ev[1]); if (l) l.n = ev[2]; return true; }
      case 'rx': { var li = st.loot.get(ev[1]); if (li) { if (ev[2] === me) snd('pick'); D().burst('star', li.x, li.y - 8, 4, li.k.indexOf('am_') === 0 ? MG.RAMMO[li.k.slice(3)].c : rar(li.r).c); st.loot.delete(ev[1]); } return true; }
      case 'rc': { var ch = st.chests.get(ev[1]); if (ch) { ch.open = true; ch.openT = now(); D().burst('magic', ch.x, ch.y - 14, 18, '#ffd166'); D().burst('star', ch.x, ch.y - 20, 10, '#fff3b0'); snd('chest', volAt(ch.x, ch.y)); } return true; }
      case 'ro': {
        var o = objById(ev[1]); if (!o) return true; var cp = tcen(o.i);
        o.hitT = now();
        if (ev[2] <= 0) { st.dead[o.id] = 1; map.obj[o.i] = 0; debris(o, cp); }
        else { st.ohp[o.id] = ev[2]; D().burst(o.kind === 'rock' ? 'dust' : 'cube', cp.x, cp.y - 10, 3, objCol(o.kind)); }
        return true;
      }
      case 'rw': { st.whp[ev[1]] = ev[2]; var wc = tcen(ev[1]); D().burst('cube', wc.x, wc.y - 10, 2, '#b07a46'); return true; }
      case 'rvh': { var v = st.veh.get(ev[1]); if (v) { v.hp = ev[2]; v.hitT = now(); } return true; }
      case 'rvx': { var vx = st.veh.get(ev[1]); if (vx) { st.veh.delete(ev[1]); } return true; }
      case 've': return true;
      case 'rve': { var vv = st.veh.get(ev[1]); if (vv) vv.driver = ev[2]; return true; }
      case 'rs': {
        e = S.ents.get(ev[1]); var wk = ev[2], x0 = ev[3], y0 = ev[4], sh = ev[5] || [];
        for (var i = 0; i < sh.length; i += 3) { st.tracers.push({ x0: x0, y0: y0, x1: sh[i], y1: sh[i + 1], t: now(), w: wk, hit: sh[i + 2], mine: ev[1] === me }); if (!sh[i + 2]) D().burst('dust', sh[i], sh[i + 1] + 14, 1); else D().burst('spark', sh[i], sh[i + 1], 4, '#ff4b5c'); }
        if (e) { e.flashT = now(); e.recoilT = now(); }
        if (ev[1] !== me) snd(wk, volAt(x0, y0));
        return true;
      }
      case 'rsh': { e = S.ents.get(ev[1]); if (e && ev[1] !== me) snd('rocket', volAt(e.x, e.y)); if (e) e.flashT = now(); return true; }
      case 'rd': {
        var vic = S.ents.get(ev[1]); if (!vic) return true;
        var vp = X.entPos(vic), mine = ev[4] === me, isMe = ev[1] === me;
        if (mine || isMe || ev[6]) {
          if (ev[3] > 0) st.nums.push({ x: vp.x + (Math.random() - 0.5) * 16, y: vp.y - 50, v: ev[3], col: '#5cc8ff', t: now(), big: ev[5] });
          if (ev[2] > 0) st.nums.push({ x: vp.x + (Math.random() - 0.5) * 16, y: vp.y - 44, v: ev[2], col: ev[6] ? '#c48bff' : isMe ? '#ff6b7a' : '#fff', t: now() });
        }
        if (mine) { st.hitT = now(); snd(ev[3] > 0 && !ev[2] ? 'shieldHit' : 'hit'); if (ev[5]) snd('shieldBreak'); }
        if (isMe && !ev[6]) X.shake(4);
        vic.flashT = now();
        return true;
      }
      case 'rboom': {
        st.booms.push({ x: ev[1], y: ev[2], r: ev[3], t: now(), k: ev[4] });
        D().burst('fire', ev[1], ev[2], 26, null, { speed: 220 }); D().burst('smoke', ev[1], ev[2], 18); D().ring(ev[1], ev[2], '#ffd166', ev[3], 0.5, 10);
        var vv2 = volAt(ev[1], ev[2]); snd('explode', vv2); X.shake(14 * vv2);
        return true;
      }
      case 'rm': { e = S.ents.get(ev[1]); if (e) { e.swingT = 0; if (ev[1] !== me) snd('melee', volAt(e.x, e.y) * 0.7); } return true; }
      case 'rr': { if (ev[1] === me) snd('reload'); return true; }
      case 'ru': return true;
      case 'rh': { e = S.ents.get(ev[1]); if (e) { var hp2 = X.entPos(e); D().burst('magic', hp2.x, hp2.y - 20, 12, ev[2] === 2 ? '#5cc8ff' : '#2bd576'); if (ev[1] === me) snd('heal'); } return true; }
      case 'rtf': { var tv = st.veh.get(ev[1]); if (tv) { tv.tur = ev[2] / 100; tv.recoilT = now(); var mx2 = tv.x + Math.cos(tv.tur) * 50, my2 = tv.y - 14 + Math.sin(tv.tur) * 50; D().burst('fire', mx2, my2, 10, null, { speed: 160 }); D().burst('smoke', mx2, my2, 8); var vv3 = volAt(tv.x, tv.y); snd('explode', vv3 * 0.6); X.shake(6 * vv3); } return true; }
      case 'rt': { e = S.ents.get(ev[1]); if (e) e.swingT = 0; return true; }
      case 'rj': { e = S.ents.get(ev[1]); if (e) { var jp = X.entPos(e); D().burst('dust', jp.x, jp.y, 6); } return true; }
      case 'rland': { D().burst('dust', ev[2], ev[3], 14); D().ring(ev[2], ev[3], '#ffffff', 40, 0.4, 3); return true; }
    }
    return false;
  };
  function D() { return window.BWD; }
  function VDEF(v) { return (MG.RVEH && MG.RVEH[v && v.kind]) || { n: 'Jeep', hp: 320, sp: 2.3, r: 30 }; }
  function myVeh() { return st && st.me && st.me.veh ? st.veh.get(st.me.veh) : null; }
  function tcen(i) { return { x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2 }; }
  function objCol(k) { return { tree: '#3f9b4a', pine: '#2f7d4a', bush: '#4fae43', crate: '#b07a46', barrel: '#d14b3c', rock: '#8e97aa', hay: '#e3c25a' }[k] || '#999'; }
  function debris(o, cp) {
    D().burst('cube', cp.x, cp.y - 12, o.kind === 'bush' ? 6 : 14, objCol(o.kind), { speed: 160 });
    D().burst('dust', cp.x, cp.y, 8);
    if (o.kind === 'tree' || o.kind === 'pine') D().burst('cube', cp.x, cp.y - 30, 12, '#4fae43');
    snd('melee', volAt(cp.x, cp.y));
  }

  // ------------------------------------------------------------ zone helpers
  function zone() {
    var z = st && st.zn; if (!z) return null; var sn = snow(), left = Math.max(0, z[2] - (sn - z[1]));
    if (z[0] === 1) { var k = clamp((sn - z[1]) / z[2], 0, 1); return { x: z[3] + (z[6] - z[3]) * k, y: z[4] + (z[7] - z[4]) * k, r: z[5] + (z[8] - z[5]) * k, shrink: 1, left: left, tx: z[6], ty: z[7], tr: z[8], i: z[9], d: z[10] }; }
    return { x: z[3], y: z[4], r: z[5], shrink: 0, left: left, tx: z[6], ty: z[7], tr: z[8], i: z[9], d: z[10] };
  }
  RG.zone = zone;
  function busPos() { var b = st.bus; if (!b) return null; var k = clamp((snow() - b.t0) / b.dur, 0, 1); return { x: b.x0 + (b.x1 - b.x0) * k, y: b.y0 + (b.y1 - b.y0) * k, k: k, ang: Math.atan2(b.y1 - b.y0, b.x1 - b.x0) }; }

  // ------------------------------------------------------------ movement hooks
  RG.customMove = function (p, ix, iy, dt) {
    if (!st) return false;
    var s = myState();
    if (s === 'bus') { var bp = busPos(); if (bp) { p.x = bp.x; p.y = bp.y; } p.cvx = p.cvy = 0; p.mv = false; return true; }
    if (s === 'glide') { var sp = B.SPEED * 1.75; p.cvx += (ix * sp - p.cvx) * Math.min(1, dt * 6); p.cvy += (iy * sp - p.cvy) * Math.min(1, dt * 6); p.x = clamp(p.x + p.cvx * dt, T * 2, (W - 2) * T); p.y = clamp(p.y + p.cvy * dt, T * 2, (H - 2) * T); p.mv = Math.hypot(p.cvx, p.cvy) > 25; return true; }
    return false;
  };
  RG.speedMul = function () {
    if (!st || !st.me) return 1;
    if (st.me.veh) return VDEF(myVeh()).sp;
    if (st.me.use) return 0.55;
    var it = heldItem(); if (it && RW(it.k).cls === 'gun' && (it.k === 'sniper' || it.k === 'minigun' || it.k === 'rocket')) return 0.88;
    return 1;
  };
  function myHouse() { var p = P(); if (!p) return null; var hs = S.map.houses || []; for (var i = 0; i < hs.length; i++) { var h = hs[i]; if (p.x > h.x0 * T && p.x < (h.x1 + 1) * T && p.y > h.y0 * T && p.y < (h.y1 + 1) * T + 8) return h; } return null; }
  RG.zoom = function () { // close-up camera like the real .io shooters: you only see what's around you
    if (!st) return 1; var s = myState();
    if (s === 'bus') return 0.55; if (s === 'glide') return 0.8;
    var it = heldItem(); if (it && it.k === 'sniper' && rmb) return 0.8;
    if (st.me && st.me.veh) return myVeh() && myVeh().kind === 'tank' ? 0.95 : 1.0;
    if (myHouse()) return 1.55;
    if (it && it.k === 'sniper') return 1.1;
    return 1.3;
  };
  RG.lockFire = function () { return !st || myState() !== 'ground'; };
  RG.skipEnt = function (e) { // riders on the bus are inside it; drivers are drawn by their jeep
    if (!st) return false;
    var s = e.id === S.myId ? myState() : (e.rst === 1 ? 'bus' : e.rst === 2 ? 'glide' : 'ground');
    if (s === 'bus') return true;
    if (e.id === S.myId ? (st.me && st.me.veh) : e.rveh) return true;
    return false;
  };
  RG.hideTag = function (e) { if (RG.skipEnt(e)) return true; if (e.id === S.myId) return false; return !!roofOver(e.x, e.y) && !roofOver(P().x, P().y, roofOver(e.x, e.y)); };
  RG.update = function (dt) {
    var on = !!st && S.game === 'royale' && S.screen === 'game';
    var hud = $('rgHud'); if (hud && hud.classList.contains('hidden') === on) hud.classList.toggle('hidden', !on);
    if (!on) return;
    st.pj.forEach(function (p) { p.x += (p.tx - p.x) * Math.min(1, dt * 18); p.y += (p.ty - p.y) * Math.min(1, dt * 18); if ((p.k === 'rocket' || p.k === 'shell') && Math.random() < 0.9) D().burst('smoke', p.x, p.y, 1); });
    st.veh.forEach(function (v) { if (v.tx == null) return; if (v.driver === S.myId && P()) { var pp = P(); var dx = pp.x - v.x, dy = pp.y - v.y; if (Math.hypot(dx, dy) > 1) v.ang = Math.atan2(dy, dx); v.x = pp.x; v.y = pp.y; v.tur = pp.ang; } else { v.x += (v.tx - v.x) * Math.min(1, dt * 12); v.y += (v.ty - v.y) * Math.min(1, dt * 12); } });
    // auto-pick weapons/items into free slots when walking over them (ammo is automatic on the server)
    var p = P(); if (p && myState() === 'ground' && st.me && !st.me.veh && now() - st.lastPick > 220) {
      var free = st.me.slots.indexOf(null) >= 0;
      st.loot.forEach(function (o) {
        if (o.k.indexOf('am_') === 0 || now() - st.lastPick < 220) return;
        if (Math.hypot(o.x - p.x, o.y - p.y) > 26 || st.auto[o.id]) return;
        var w = RW(o.k); if (!w) return;
        var stack = w.cls !== 'gun' && st.me.slots.some(function (s) { return s && s.k === o.k && s.n < w.max; });
        if (!free && !stack) return;
        st.auto[o.id] = 1; st.lastPick = now(); X.send({ t: 'ri', kind: 'loot', id: o.id });
      });
    }
    var zz = zone(); if (zz && p) st.inStorm = Math.hypot(p.x - zz.x, p.y - zz.y) > zz.r;
    var a = 0; S.ents.forEach(function (e) { if (!e.dead && !e.elim) a++; }); st.alive = a;
    renderInfo();
  };

  // ------------------------------------------------------------ input
  RG.hold = function () { // mouse held down: fire at the weapon's rate
    if (!st || myState() !== 'ground' || !st.me) return true;
    var t0 = now(), p = P(); if (!p) return true;
    if (st.me.veh) { var mv0 = myVeh(); if (mv0 && mv0.kind === 'tank' && t0 >= st.nextShot) { st.nextShot = t0 + MG.RVEH.tank.gun.cd; X.send({ t: 'rf', a: Math.round(p.ang * 100) }); } return true; }
    var it = heldItem();
    if (!it) { if (t0 >= st.nextShot) { st.nextShot = t0 + 430; X.send({ t: 'rf', a: Math.round(p.ang * 100) }); var me = S.ents.get(S.myId); if (me) me.swingT = 0; snd('melee', 0.6); } return true; }
    var w = RW(it.k);
    if (w.cls === 'heal') { if (!st.me.use && t0 >= st.nextShot) { st.nextShot = t0 + 500; X.send({ t: 'rf', a: 0 }); } return true; }
    if (w.cls === 'throw') { if (t0 >= st.nextShot) { st.nextShot = t0 + 750; X.send({ t: 'rf', a: Math.round(p.ang * 100) }); } return true; }
    if (st.me.rl) return true;
    if (t0 < st.nextShot) return true;
    if (it.a <= 0) { st.nextShot = t0 + 300; snd('empty'); if (st.me.am[w.am] > 0) X.send({ t: 'rr' }); else X.toast('Out of ' + MG.RAMMO[w.am].n.toLowerCase() + '!', 900); return true; }
    var rate = w.burst ? w.rate : w.rate;
    st.nextShot = t0 + rate;
    X.send({ t: 'rf', a: Math.round(p.ang * 100) });
    if (w.burst) { var n = Math.min(w.burst - 1, it.a - 1); for (var b = 1; b <= n; b++) setTimeout(function () { var pp = P(); if (pp && st) X.send({ t: 'rf', a: Math.round(pp.ang * 100) }); snd(it.k, 0.9); }, b * 90); }
    it.a--; renderSlots();
    var me2 = S.ents.get(S.myId); if (me2) { me2.flashT = t0; me2.recoilT = t0; }
    snd(it.k, 1); X.shake(w.pel ? 3 : w.k === 'sniper' ? 5 : 1.2);
    return true;
  };
  RG.click = function () { return RG.hold(); };
  RG.key = function (k, e) {
    if (!st || S.screen !== 'game') return false;
    if (k === ' ' && myState() === 'bus') { X.send({ t: 'rj' }); return true; }
    if (/^[1-5]$/.test(k)) { var s = +k - 1; X.send({ t: 'rsel', s: st.me && st.me.sel === s ? -1 : s }); return true; }
    if (k === '0' || k === '`') { X.send({ t: 'rsel', s: -1 }); return true; }
    if (k === 'r') { X.send({ t: 'rr' }); return true; }
    if (k === 'e' || k === 'f') { interact(); return true; }
    if (k === 'h') { quickHeal(); return true; }
    if (k === 'x') { if (st.me && st.me.sel >= 0) X.send({ t: 'rdrop', s: st.me.sel }); return true; }
    if (k === 'm') { st.mapBig = !st.mapBig; $('rgMap').classList.toggle('big', st.mapBig); return true; }
    if (k === 'escape' && st.mapBig) { st.mapBig = false; $('rgMap').classList.remove('big'); return true; }
    return false;
  };
  RG.wheel = function (dy) {
    if (!st || !st.me) return; var cur = st.me.sel, n = MG.RSLOTS, tries = 0;
    do { cur = cur + (dy > 0 ? 1 : -1); if (cur >= n) cur = -1; if (cur < -1) cur = n - 1; tries++; } while (cur >= 0 && !st.me.slots[cur] && tries < 8);
    X.send({ t: 'rsel', s: cur });
  };
  var tp = null;
  RG.tapDown = function (id, x, y) { if (!st) return; tp = { id: id, x: x, y: y }; if (myState() === 'bus') { X.send({ t: 'rj' }); tp = null; return; } aimAtTap(); RG.hold(); };
  RG.tapMove = function (id, x, y) { if (tp && tp.id === id) { tp.x = x; tp.y = y; } };
  RG.tapUp = function (id) { if (tp && (id == null || tp.id === id)) tp = null; };
  function aimAtTap() { var p = P(); if (!tp || !p) return false; var cm = X.cam, wx = cm.x + (tp.x - innerWidth / 2) / cm.z, wy = cm.y + (tp.y - innerHeight / 2) / cm.z; p.ang = Math.atan2(wy - (p.y - 16), wx - p.x); return true; }
  RG.touchAim = function () { if (!tp) return false; aimAtTap(); RG.hold(); return true; };
  RG.touch = function (btn) {
    if (!st) return true;
    if (myState() === 'bus') { X.send({ t: 'rj' }); return true; }
    if (btn === 'atk') { var p = P(), tg = null, bd = 12 * T; S.ents.forEach(function (o) { if (o.id === S.myId || o.dead || o.elim || RG.skipEnt(o)) return; var d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; tg = o; } }); if (tg) p.ang = Math.atan2(tg.y - 16 - (p.y - 16), tg.x - p.x); RG.hold(); }
    else if (btn === 'place') interact();
    else RG.wheel(1);
    return true;
  };
  function quickHeal() {
    if (!st.me) return; var best = -1, me = st.me;
    me.slots.forEach(function (it, i) { if (!it) return; var w = RW(it.k); if (w.cls !== 'heal') return; if (w.hp && me.hp < w.cap && (best < 0 || me.hp < 50)) best = i; if (w.sh && me.sh < w.cap && best < 0) best = i; });
    if (best < 0) { X.toast('No heals you can use right now', 1000); return; }
    X.send({ t: 'rsel', s: best }); setTimeout(function () { X.send({ t: 'rf', a: 0 }); }, 80);
  }
  function nearest() {
    var p = P(); if (!p || !st.me) return null; var best = null, bd = 1e9;
    function consider(kind, o, reach, score) { var d = Math.hypot(o.x - p.x, o.y - p.y); if (d > reach) return; var s = d * (score || 1); if (s < bd) { bd = s; best = { kind: kind, o: o }; } }
    st.veh.forEach(function (v) { if (!v.driver) consider('veh', v, VDEF(v).r + 44, 1.2); });
    st.chests.forEach(function (ch) { if (!ch.open) consider('chest', ch, 80, 0.8); });
    st.loot.forEach(function (o) { if (o.k.indexOf('am_') !== 0) consider('loot', o, 66, 1); });
    return best;
  }
  function interact() {
    if (!st.me) return;
    if (st.me.veh) { X.send({ t: 'ri' }); return; }
    var n = nearest(); if (!n) return;
    X.send({ t: 'ri', kind: n.kind, id: n.o.id });
  }
  RG.prompt = function (pr, touch) {
    if (!st || !st.me) return false;
    var s = myState();
    if (s === 'bus') { pr.classList.remove('hidden'); pr.innerHTML = touch ? '🪂 Tap to jump!' : '<b>SPACE</b> · Jump out of the bus 🪂'; return true; }
    if (s !== 'ground') { pr.classList.add('hidden'); return true; }
    if (st.me.veh) { var mv1 = myVeh(); pr.classList.remove('hidden'); pr.textContent = (touch ? 'Tap 📦' : 'E') + ' · Get out' + (mv1 && mv1.kind === 'tank' ? (touch ? ' · tap anywhere to fire the cannon 💥' : ' · Click to fire the cannon 💥') : ''); return true; }
    var n = nearest();
    if (!n) { pr.classList.add('hidden'); return true; }
    pr.classList.remove('hidden');
    var key = touch ? 'Tap 📦' : 'E';
    if (n.kind === 'veh') pr.textContent = key + ' · Drive the ' + VDEF(n.o).n + ' ' + (VDEF(n.o).icon || '🚙');
    else if (n.kind === 'chest') pr.textContent = key + ' · Open chest';
    else { var o = n.o, w = RW(o.k), full = st.me.slots.indexOf(null) < 0 && !(w.cls !== 'gun' && st.me.slots.some(function (q) { return q && q.k === o.k; })); pr.innerHTML = key + ' · ' + (full ? 'Swap for ' : 'Pick up ') + '<b style="color:' + (w.cls === 'gun' ? rar(o.r).c : '#fff') + '">' + (w.cls === 'gun' ? rar(o.r).n + ' ' : '') + w.n + '</b>' + (o.n > 1 ? ' ×' + o.n : ''); }
    return true;
  };


  // ------------------------------------------------------------ weapon art (side view, ~72 wide, centered on 0,0, rarity-coloured trim)
  function gunArt(x, k, col) {
    var OL = '#15112e', M = '#3b4150', M2 = '#5a6273', M3 = '#2a2e38', WOOD = '#8a5a34', WOOD2 = '#a8703f', HI = 'rgba(255,255,255,.28)';
    function R(a, b, w, h, f, r2) { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r2 || 2); else x.rect(a, b, w, h); x.fillStyle = f; x.fill(); x.lineWidth = 2.2; x.strokeStyle = OL; x.stroke(); }
    function P(pts, f) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); x.fillStyle = f; x.fill(); x.lineWidth = 2.2; x.strokeStyle = OL; x.lineJoin = 'round'; x.stroke(); }
    function hi(a, b, w) { x.fillStyle = HI; x.fillRect(a, b, w, 1.6); }
    x.save(); x.lineJoin = 'round';
    switch (k) {
      case 'pistol':
        R(-6, -9, 26, 8, M2, 2); hi(-4, -8, 22); R(16, -7, 6, 4, M3, 1);
        P([-6, -2, 6, -2, 4, 2, 2, 12, -6, 12, -4, 2], M3); R(-5, 3, 6, 7, col, 1.5);
        x.strokeStyle = OL; x.lineWidth = 2; x.beginPath(); x.arc(6, 2, 3.5, 0, Math.PI); x.stroke();
        break;
      case 'smg':
        R(-16, -8, 34, 10, M2, 2); hi(-14, -7, 30); R(18, -5, 10, 4, M3, 1);
        R(-2, 2, 6, 14, M3, 1.5); P([-16, 0, -10, 0, -12, 10, -18, 10], M3);
        R(-28, -6, 12, 4, M, 1); R(-30, -6, 3, 9, M, 1);
        R(4, -6, 10, 6, col, 1.5); x.fillStyle = OL; x.fillRect(-10, -11, 6, 3);
        break;
      case 'ar':
        R(-14, -9, 36, 11, M2, 2); hi(-12, -8, 32); R(22, -6, 14, 5, M3, 1); R(34, -7, 4, 7, M3, 1);
        P([-14, -8, -34, -6, -36, 6, -30, 6, -26, 1, -14, 1], WOOD); hi(-32, -5, 16);
        P([0, 2, 8, 2, 10, 16, 3, 17], M3); P([-10, 1, -4, 1, -6, 11, -12, 11], M3);
        R(10, -6, 12, 6, col, 1.5); R(-6, -14, 14, 5, M, 1.5);
        break;
      case 'burst':
        R(-12, -9, 36, 11, '#4a5468', 2); hi(-10, -8, 32); R(24, -6, 12, 5, M3, 1);
        P([-12, -8, -32, -8, -34, 5, -12, 2], M2); R(-28, -5, 10, 5, col, 1.5);
        P([2, 2, 9, 2, 9, 15, 3, 15], M3); P([-8, 1, -2, 1, -4, 11, -10, 11], M3);
        R(-4, -15, 18, 6, M3, 2); x.fillStyle = col; x.beginPath(); x.arc(-1, -12, 2, 0, TAU); x.fill();
        break;
      case 'shotgun':
        R(-10, -8, 44, 8, M2, 1.5); hi(-8, -7, 40); R(0, 0, 30, 6, WOOD2, 2);
        P([-10, -8, -32, -4, -34, 7, -28, 8, -22, 1, -10, 1], WOOD); hi(-30, -3, 14);
        P([-8, 1, -2, 1, -4, 11, -10, 11], M3); R(8, 1, 14, 4, col, 1);
        break;
      case 'tac':
        R(-8, -9, 40, 9, M3, 1.5); hi(-6, -8, 36); R(30, -10, 6, 11, M, 1);
        R(2, 0, 22, 7, M2, 2); P([-8, -8, -28, -7, -30, 4, -20, 4, -8, 1], M3);
        P([-6, 1, 0, 1, -2, 11, -8, 11], M3); R(6, 1, 12, 5, col, 1); R(-4, -14, 10, 5, M, 1.5);
        break;
      case 'sniper':
        R(-14, -6, 52, 7, M2, 1.5); hi(-12, -5, 48); R(36, -7, 6, 9, M3, 1);
        P([-14, -6, -36, -4, -38, 8, -30, 8, -26, 2, -14, 2], WOOD); hi(-34, -3, 14);
        P([-8, 1, -2, 1, -4, 11, -10, 11], M3); R(-2, 1, 6, 8, M3, 1);
        R(-10, -16, 26, 7, M3, 3); R(-14, -17, 6, 9, col, 2); R(14, -17, 6, 9, col, 2); x.fillStyle = '#7fd4ff'; x.fillRect(18, -15, 2, 5);
        x.strokeStyle = OL; x.lineWidth = 2; x.beginPath(); x.moveTo(24, 1); x.lineTo(20, 12); x.moveTo(24, 1); x.lineTo(28, 12); x.stroke();
        break;
      case 'minigun':
        for (var b = -1; b <= 1; b++) R(6, -5 + b * 4, 32, 4, M2, 1);
        R(32, -10, 6, 14, M3, 1); R(-22, -11, 30, 18, M3, 4); hi(-20, -10, 26);
        R(-16, -6, 18, 8, col, 2); R(-8, 7, 12, 8, M, 2); P([-22, -4, -32, -2, -32, 4, -22, 4], M);
        R(-14, -16, 16, 5, M, 2);
        break;
      case 'rocket':
        R(-34, -9, 66, 14, '#4f6b3a', 6); hi(-30, -8, 58); R(28, -11, 8, 18, '#2f3a26', 2); R(-38, -10, 6, 16, '#2f3a26', 2);
        R(-6, -9, 8, 14, col, 1.5); P([-4, 5, 4, 5, 2, 15, -4, 15], M3); P([10, 5, 16, 5, 14, 13, 8, 13], M3);
        R(-16, -16, 14, 7, M3, 2); x.fillStyle = '#ff5c6c'; x.beginPath(); x.moveTo(36, -6); x.lineTo(42, -2); x.lineTo(36, 2); x.fill();
        break;
      default: x.font = '24px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((RW(k) && RW(k).icon) || '?', 0, 0);
    }
    x.restore();
  }
  RG.gunArt = gunArt;

  // ------------------------------------------------------------ world drawing
  RG.ocean = function (cx, w, h, cam, t, z) {
    var g = cx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1f7fbf'); g.addColorStop(1, '#1667a8'); cx.fillStyle = g; cx.fillRect(0, 0, w, h);
    cx.save(); cx.strokeStyle = 'rgba(255,255,255,.12)'; cx.lineWidth = 2 * z;
    var step = 70 * z, ox = (-cam.x * z) % step, oy = (-cam.y * z) % step;
    for (var y = oy - step; y < h + step; y += step) for (var x = ox - step; x < w + step; x += step) { var ph = Math.sin(t * 1.4 + (x + y) * 0.01); cx.beginPath(); cx.moveTo(x, y + ph * 4 * z); cx.quadraticCurveTo(x + step * 0.25, y - 6 * z + ph * 4 * z, x + step * 0.5, y + ph * 4 * z); cx.stroke(); }
    cx.restore();
  };
  var ROOF_COLS = ['#c0504d', '#4f81bd', '#8064a2', '#9bbb59', '#f79646', '#4bacc6', '#d9534f', '#6f5b9e'];
  function roofOver(x, y, only) {
    var hs = S.map.houses || []; for (var i = 0; i < hs.length; i++) { var h = hs[i]; if (only && h !== only) continue; if (x > h.x0 * T + 4 && x < (h.x1 + 1) * T - 4 && y > h.y0 * T + 8 && y < (h.y1 + 1) * T + 4) return h; }
    return null;
  }
  RG.drawables = function (list, t) {
    if (!st) return;
    var map = S.map, cam = X.cam, vw = innerWidth / cam.z, vh = innerHeight / cam.z, L = cam.x - vw / 2 - 80, Tp = cam.y - vh / 2 - 120, R = L + vw + 160, Bt = Tp + vh + 240;
    function vis(x, y) { return x > L && x < R && y > Tp && y < Bt; }
    (map.rgObjs || []).forEach(function (o) {
      if (st.dead[o.id]) { var cp0 = tcen(o.i); if ((o.kind === 'tree' || o.kind === 'pine') && vis(cp0.x, cp0.y)) list.push({ k: 'fn', y: cp0.y - 10, fn: function () { stump(cp0.x, cp0.y); } }); return; }
      var cp = tcen(o.i); if (!vis(cp.x, cp.y)) return;
      list.push({ k: 'fn', y: cp.y + 8, fn: function () { drawObj(o, cp.x, cp.y, t); } });
    });
    st.chests.forEach(function (ch) { if (vis(ch.x, ch.y)) list.push({ k: 'fn', y: ch.y + 10, fn: function () { drawChest(ch, t); } }); });
    st.loot.forEach(function (o) { if (vis(o.x, o.y)) list.push({ k: 'fn', y: o.y - 2, fn: function () { drawLoot(o, t); } }); });
    st.veh.forEach(function (v) { if (vis(v.x, v.y)) list.push({ k: 'fn', y: v.y + 14, fn: function () { if (v.kind === 'tank') drawTank(v, t); else if (v.kind === 'car') drawCar(v, t); else drawJeep(v, t); } }); });
    st.pj.forEach(function (p) { list.push({ k: 'fn', y: p.y + 30, fn: function () { drawProj(p, t); } }); });
  };
  function stump(x, y) { c.fillStyle = 'rgba(0,0,0,.18)'; A().ell(c, x, y + 4, 12, 5); c.fill(); c.fillStyle = '#7a5130'; c.strokeStyle = '#1b1636'; c.lineWidth = 2.5; A().ell(c, x, y - 2, 9, 6); c.fill(); c.stroke(); c.fillStyle = '#b07a46'; A().ell(c, x, y - 3, 6, 3.5); c.fill(); }
  function A() { return window.SC.art; }
  function drawObj(o, x, y, t) {
    var def = MG.R_OBJ[o.kind], hp = st.ohp[o.id] != null ? st.ohp[o.id] : def.hp, dmg = 1 - hp / def.hp, sh = o.hitT && now() - o.hitT < 160 ? Math.sin((now() - o.hitT) * 0.12) * 3 : 0;
    var OL = '#1b1636';
    c.save(); c.translate(x + sh, y);
    var a = A();
    c.fillStyle = 'rgba(10,6,30,.22)'; a.ell(c, 0, 14, def.r + 4, 7); c.fill();
    if (o.kind === 'tree') {
      c.fillStyle = '#7a5130'; c.strokeStyle = OL; c.lineWidth = 2.5; c.fillRect(-5, -6, 10, 18); c.strokeRect(-5, -6, 10, 18);
      var sway = Math.sin(t * 1.3 + x * 0.01) * 2;
      [[0, -30, 22], [-13, -20, 15], [13, -20, 15], [0, -40, 15]].forEach(function (q) { c.beginPath(); c.arc(q[0] + sway, q[1], q[2], 0, TAU); c.fillStyle = dmg > 0.5 ? '#5aa04c' : '#3f9b4a'; c.fill(); c.lineWidth = 3; c.stroke(); });
      [[0, -30, 22], [-13, -20, 15], [13, -20, 15], [0, -40, 15]].forEach(function (q) { c.beginPath(); c.arc(q[0] + sway, q[1], q[2] - 2, 0, TAU); c.fillStyle = '#4fb85a'; c.fill(); });
      c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(-6 + sway, -38, 7, 0, TAU); c.fill();
    } else if (o.kind === 'pine') {
      c.fillStyle = '#6b4526'; c.strokeStyle = OL; c.lineWidth = 2.5; c.fillRect(-4, -4, 8, 16); c.strokeRect(-4, -4, 8, 16);
      [[-20, 0, 20], [-16, -16, 16], [-12, -30, 12]].forEach(function (q) { c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(0, q[1] - q[2] * 1.5); c.lineTo(-q[0], q[1]); c.closePath(); c.fillStyle = '#2f7d4a'; c.fill(); c.lineWidth = 2.5; c.stroke(); });
      if (S.season === 'xmas') { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-8, -44); c.lineTo(0, -54); c.lineTo(8, -44); c.closePath(); c.fill(); }
    } else if (o.kind === 'bush') {
      c.globalAlpha = 0.95; [[-9, -6, 11], [8, -6, 11], [0, -13, 12]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, TAU); c.fillStyle = '#4fae43'; c.fill(); c.strokeStyle = OL; c.lineWidth = 2.5; c.stroke(); });
      [[-9, -6, 9], [8, -6, 9], [0, -13, 10]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, TAU); c.fillStyle = '#5fc152'; c.fill(); });
      c.globalAlpha = 1;
    } else if (o.kind === 'crate') {
      c.fillStyle = '#b07a46'; c.strokeStyle = OL; c.lineWidth = 3; c.fillRect(-15, -24, 30, 30); c.strokeRect(-15, -24, 30, 30);
      c.strokeStyle = '#7a5130'; c.lineWidth = 3; c.beginPath(); c.moveTo(-13, -22); c.lineTo(13, 4); c.moveTo(13, -22); c.lineTo(-13, 4); c.stroke();
      c.strokeStyle = OL; c.lineWidth = 2; c.strokeRect(-10, -19, 20, 20);
    } else if (o.kind === 'barrel') {
      c.fillStyle = '#d14b3c'; c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.ellipse(0, -8, 13, 17, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#ffd166'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('⚠', 0, -8);
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-12, -16); c.lineTo(12, -16); c.moveTo(-12, 0); c.lineTo(12, 0); c.stroke();
    } else if (o.kind === 'rock') {
      c.fillStyle = '#8e97aa'; c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(-18, 6); c.lineTo(-14, -14); c.lineTo(0, -22); c.lineTo(15, -14); c.lineTo(18, 6); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#a9b2c4'; c.beginPath(); c.moveTo(-10, -12); c.lineTo(0, -19); c.lineTo(8, -12); c.lineTo(0, -6); c.closePath(); c.fill();
    } else if (o.kind === 'hay') {
      c.fillStyle = '#e3c25a'; c.strokeStyle = OL; c.lineWidth = 3; c.fillRect(-16, -18, 32, 22); c.strokeRect(-16, -18, 32, 22);
      c.strokeStyle = '#b89634'; c.lineWidth = 2; for (var hx = -12; hx < 16; hx += 6) { c.beginPath(); c.moveTo(hx, -16); c.lineTo(hx, 2); c.stroke(); }
    }
    if (dmg > 0.05 && o.kind !== 'bush') { c.strokeStyle = 'rgba(20,10,10,' + (0.25 + dmg * 0.5) + ')'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-6, -14); c.lineTo(0, -6); c.lineTo(-3, 2); if (dmg > 0.5) { c.moveTo(6, -18); c.lineTo(2, -10); c.lineTo(8, -4); } c.stroke(); }
    c.restore();
  }
  function drawChest(ch, t) {
    var a = A(), x = ch.x, y = ch.y, OL = '#1b1636';
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(10,6,30,.25)'; a.ell(c, 0, 12, 20, 6); c.fill();
    if (!ch.open) {
      var gg = c.createRadialGradient(0, -6, 2, 0, -6, 44); gg.addColorStop(0, 'rgba(255,210,74,.5)'); gg.addColorStop(1, 'rgba(255,210,74,0)'); c.fillStyle = gg; a.circ(c, 0, -6, 44 + Math.sin(t * 3) * 4); c.fill();
      for (var s = 0; s < 3; s++) { var ph = (t * 0.8 + s / 3) % 1; c.fillStyle = 'rgba(255,240,170,' + (1 - ph) + ')'; c.fillRect(Math.sin(s * 2.1 + t) * 14 - 1, -10 - ph * 30, 2.5, 2.5); }
    }
    var lidA = ch.open ? Math.min(1, (now() - (ch.openT || 0)) / 250) : 0;
    c.strokeStyle = OL; c.lineWidth = 3; c.fillStyle = ch.open ? '#8a6a2e' : '#e0a81c'; c.fillRect(-18, -12, 36, 22); c.strokeRect(-18, -12, 36, 22);
    c.fillStyle = '#7a5130'; c.fillRect(-18, -2, 36, 3);
    c.save(); c.translate(0, -12); c.scale(1, 1 - lidA * 1.6); c.fillStyle = ch.open ? '#6b5223' : '#f6c842'; c.fillRect(-18, -9, 36, 9); c.strokeRect(-18, -9, 36, 9); c.restore();
    c.fillStyle = '#4a3000'; c.fillRect(-3, -6, 6, 8); c.fillStyle = '#ffe9a6'; c.fillRect(-1, -4, 2, 3);
    c.restore();
  }
  function lootIcon(o) { if (o.k.indexOf('am_') === 0) return null; return RW(o.k); }
  function drawLoot(o, t) {
    var bob = Math.sin(t * 3 + o.id) * 2.5, x = o.x, y = o.y - 8 + bob, isAmmo = o.k.indexOf('am_') === 0, col = isAmmo ? MG.RAMMO[o.k.slice(3)].c : RW(o.k).cls === 'gun' ? rar(o.r).c : '#ffffff';
    c.save();
    c.fillStyle = 'rgba(10,6,30,.2)'; A().ell(c, x, o.y + 6, 12, 4); c.fill();
    if (!isAmmo && RW(o.k).cls === 'gun') { // rarity light beam
      var bg = c.createLinearGradient(x, y - 60, x, y); bg.addColorStop(0, col + '00'); bg.addColorStop(1, col + (o.r >= 3 ? '88' : '55')); c.fillStyle = bg; c.fillRect(x - 5, y - 60, 10, 60);
    }
    c.globalCompositeOperation = 'lighter'; var g2 = c.createRadialGradient(x, y, 2, x, y, 26); g2.addColorStop(0, col + '88'); g2.addColorStop(1, col + '00'); c.fillStyle = g2; A().circ(c, x, y, 26); c.fill(); c.globalCompositeOperation = 'source-over';
    if (isAmmo) {
      c.fillStyle = col; c.strokeStyle = '#1b1636'; c.lineWidth = 2.5; c.fillRect(x - 9, y - 7, 18, 14); c.strokeRect(x - 9, y - 7, 18, 14);
      c.fillStyle = '#1b1636'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.k.slice(3), x, y + 0.5);
    } else {
      var w = RW(o.k);
      if (w.cls === 'gun') { c.save(); c.translate(x, y); c.rotate(-0.18); c.scale(0.52, 0.52); gunArt(c, o.k, col); c.restore(); }
      else { c.font = '20px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(w.icon, x, y); if (o.n > 1) { c.font = 'bold 10px sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#1b1636'; c.lineWidth = 3; c.strokeText('×' + o.n, x + 12, y + 9); c.fillText('×' + o.n, x + 12, y + 9); } }
    }
    c.restore();
  }
  function drawJeep(v, t) {
    var OL = '#1b1636', hit = v.hitT && now() - v.hitT < 150;
    c.save(); c.translate(v.x, v.y);
    c.fillStyle = 'rgba(10,6,30,.28)'; A().ell(c, 0, 16, 34, 12); c.fill();
    c.rotate(v.ang || 0);
    c.fillStyle = '#2a2a33'; [[-18, -17], [10, -17], [-18, 13], [10, 13]].forEach(function (w) { c.fillRect(w[0], w[1], 12, 6); });
    c.fillStyle = hit ? '#fff' : '#5b8c3a'; c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.roundRect ? c.roundRect(-26, -14, 52, 28, 7) : c.rect(-26, -14, 52, 28); c.fill(); c.stroke();
    c.fillStyle = '#466e2c'; c.fillRect(6, -12, 14, 24);
    c.fillStyle = '#9fd4ff'; c.fillRect(2, -11, 5, 22); c.strokeRect(2, -11, 5, 22);
    c.fillStyle = '#ffe48a'; c.fillRect(23, -11, 3, 6); c.fillRect(23, 5, 3, 6);
    c.restore();
    var d = v.driver && S.ents.get(v.driver);
    if (d) { var p = d.id === S.myId ? P() : d; c.save(); try { c.translate(v.x - Math.cos(v.ang) * 4, v.y + 4); c.scale(0.8, 0.8); A().drawGim(c, 0, 0, d.look, { t: t, dir: 0, shadow: false }); } catch (e) {} c.restore(); void p; }
    vehBar(v);
  }
  function vehBar(v) {
    var mx = VDEF(v).hp; if (v.hp < mx) { var w2 = v.kind === 'tank' ? 64 : 46, yy = v.y - (v.kind === 'tank' ? 46 : 34); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(v.x - w2 / 2 - 1, yy - 1, w2 + 2, 7); c.fillStyle = v.hp > mx * 0.4 ? '#2bd576' : '#ff5c6c'; c.fillRect(v.x - w2 / 2, yy, w2 * v.hp / mx, 5); }
    if (v.hp < mx * 0.35 && Math.random() < 0.3) D().burst('smoke', v.x, v.y - 10, 1);
  }
  function driverGim(v, t, ox) { var d = v.driver && S.ents.get(v.driver); if (!d) return; c.save(); try { c.translate(v.x + (ox || 0), v.y + 4); c.scale(0.75, 0.75); A().drawGim(c, 0, 0, d.look, { t: t, dir: 0, shadow: false }); } catch (e) {} c.restore(); }
  function drawCar(v, t) {
    var OL = '#1b1636', hit = v.hitT && now() - v.hitT < 150, body = hit ? '#fff' : '#e8413c';
    c.save(); c.translate(v.x, v.y);
    c.fillStyle = 'rgba(10,6,30,.28)'; A().ell(c, 0, 16, 34, 11); c.fill();
    c.rotate(v.ang || 0);
    c.fillStyle = '#1e1e26'; [[-20, -16], [12, -16], [-20, 11], [12, 11]].forEach(function (w) { c.fillRect(w[0], w[1], 11, 5); });
    c.strokeStyle = OL; c.lineWidth = 3; c.fillStyle = body; c.beginPath(); c.moveTo(-28, -12); c.lineTo(18, -13); c.quadraticCurveTo(30, -10, 30, 0); c.quadraticCurveTo(30, 10, 18, 13); c.lineTo(-28, 12); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(-24, -3, 50, 6); // racing stripe
    c.fillStyle = '#9fd4ff'; c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, -10); c.lineTo(10, -9); c.lineTo(10, 9); c.lineTo(-2, 10); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2a2a33'; c.fillRect(-30, -11, 5, 22); // spoiler
    c.fillStyle = '#ffe48a'; c.fillRect(26, -9, 3, 5); c.fillRect(26, 4, 3, 5);
    c.fillStyle = '#ff5c6c'; c.fillRect(-29, -10, 2, 4); c.fillRect(-29, 6, 2, 4);
    c.restore();
    driverGim(v, t, -Math.cos(v.ang) * 6); vehBar(v);
    if (v.driver && Math.random() < 0.25) D().burst('dust', v.x - Math.cos(v.ang) * 28, v.y - Math.sin(v.ang) * 28 + 8, 1);
  }
  function drawTank(v, t) {
    var OL = '#1b1636', hit = v.hitT && now() - v.hitT < 150, body = hit ? '#fff' : '#6b7d3a', dark = '#4c5a28';
    c.save(); c.translate(v.x, v.y);
    c.fillStyle = 'rgba(10,6,30,.3)'; A().ell(c, 0, 20, 46, 15); c.fill();
    c.save(); c.rotate(v.ang || 0);
    // treads
    c.fillStyle = '#2a2a30'; c.strokeStyle = OL; c.lineWidth = 3; c.fillRect(-36, -28, 72, 13); c.strokeRect(-36, -28, 72, 13); c.fillRect(-36, 15, 72, 13); c.strokeRect(-36, 15, 72, 13);
    var tr = (v.driver ? (now() / 30) : 0) % 9; c.strokeStyle = '#55555f'; c.lineWidth = 2; for (var tx = -34 + tr; tx < 34; tx += 9) { c.beginPath(); c.moveTo(tx, -27); c.lineTo(tx, -16); c.moveTo(tx, 16); c.lineTo(tx, 27); c.stroke(); }
    // hull
    c.fillStyle = body; c.strokeStyle = OL; c.lineWidth = 3.5; c.beginPath(); c.moveTo(-32, -17); c.lineTo(30, -17); c.lineTo(36, -9); c.lineTo(36, 9); c.lineTo(30, 17); c.lineTo(-32, 17); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = dark; c.fillRect(-28, -13, 10, 26); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(-30, -15, 60, 4);
    c.restore();
    // turret (aims on its own)
    var ta = v.tur != null ? v.tur : v.ang, rec = v.recoilT ? Math.max(0, 1 - (now() - v.recoilT) / 220) * 8 : 0;
    c.translate(0, -12); c.rotate(ta);
    c.fillStyle = '#3d4a1e'; c.strokeStyle = OL; c.lineWidth = 3; c.fillRect(8 - rec, -5, 40, 10); c.strokeRect(8 - rec, -5, 40, 10); c.fillStyle = '#2b3414'; c.fillRect(44 - rec, -7, 8, 14); c.strokeRect(44 - rec, -7, 8, 14);
    c.fillStyle = body; c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = dark; c.beginPath(); c.arc(-4, 0, 9, 0, TAU); c.fill(); c.lineWidth = 2; c.stroke();
    c.fillStyle = '#ffd166'; c.beginPath(); c.arc(-4, 0, 3, 0, TAU); c.fill();
    c.restore();
    vehBar(v);
    if (v.driver && Math.random() < 0.35) D().burst('dust', v.x - Math.cos(v.ang) * 36, v.y - Math.sin(v.ang) * 36 + 10, 1);
  }
  function drawProj(p, t) {
    c.save(); c.translate(p.x, p.y);
    if (p.k === 'shell') { c.fillStyle = 'rgba(255,200,90,.5)'; c.beginPath(); c.arc(0, 0, 11, 0, TAU); c.fill(); c.fillStyle = '#2b2b33'; c.strokeStyle = '#1b1636'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.stroke(); }
    else if (p.k === 'rocket') { c.rotate(Math.atan2(p.ty - p.y, p.tx - p.x)); c.fillStyle = '#ffd166'; c.beginPath(); c.arc(-10, 0, 5 + Math.random() * 3, 0, TAU); c.fill(); c.fillStyle = '#ddd'; c.strokeStyle = '#1b1636'; c.lineWidth = 2; c.fillRect(-8, -4, 16, 8); c.strokeRect(-8, -4, 16, 8); c.fillStyle = '#ff4b5c'; c.beginPath(); c.moveTo(8, -4); c.lineTo(14, 0); c.lineTo(8, 4); c.fill(); }
    else { c.fillStyle = 'rgba(0,0,0,.25)'; A().ell(c, 0, 18, 6, 3); c.fill(); c.fillStyle = '#4e6b3a'; c.strokeStyle = '#1b1636'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill(); c.stroke(); if (Math.floor(t * 8) % 2) { c.fillStyle = '#ff4b5c'; c.beginPath(); c.arc(0, -6, 2, 0, TAU); c.fill(); } }
    c.restore();
  }
  RG.top = function (t) {
    if (!st) return;
    var map = S.map, p = P(), tn = now(), a = A();
    // roofs (fade away when you're inside)
    (map.houses || []).forEach(function (h, i) {
      var inside = p && p.x > h.x0 * T && p.x < (h.x1 + 1) * T && p.y > h.y0 * T && p.y < (h.y1 + 1) * T + 8;
      var k = 'r' + i; st.roof[k] = (st.roof[k] == null ? 1 : st.roof[k]) + ((inside ? 0.12 : 1) - (st.roof[k] == null ? 1 : st.roof[k])) * 0.18;
      var al = st.roof[k]; if (al < 0.03) return;
      var x0 = h.x0 * T - 4, y0 = h.y0 * T - 22, w = (h.x1 - h.x0 + 1) * T + 8, hh = (h.y1 - h.y0 + 1) * T + 18, col = ROOF_COLS[i % ROOF_COLS.length];
      c.save(); c.globalAlpha = al;
      c.fillStyle = 'rgba(10,6,30,.25)'; c.fillRect(x0 + 8, y0 + hh, w, 10);
      c.fillStyle = col; c.strokeStyle = '#1b1636'; c.lineWidth = 4; c.fillRect(x0, y0, w, hh); c.strokeRect(x0, y0, w, hh);
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; for (var yy = y0 + 14; yy < y0 + hh; yy += 14) { c.beginPath(); c.moveTo(x0 + 2, yy); c.lineTo(x0 + w - 2, yy); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x0 + 4, y0 + 4, w - 8, 6);
      c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x0, y0 + hh / 2 - 2, w, 4);
      c.fillStyle = '#7a5130'; c.strokeStyle = '#1b1636'; c.lineWidth = 3; c.fillRect(x0 + w - 34, y0 + 8, 16, 20); c.strokeRect(x0 + w - 34, y0 + 8, 16, 20);
      c.restore();
    });
    // inside a building: the outside goes dark so the room is all you see (and nobody outside can see in, the roof hides you)
    var ih = myState() === 'ground' && myHouse();
    st.inK = (st.inK || 0) + ((ih ? 1 : 0) - (st.inK || 0)) * 0.12;
    if (ih) st.lastHouse = ih;
    if (st.inK > 0.02 && st.lastHouse) {
      var hz = st.lastHouse, cm = X.cam, vw0 = innerWidth / cm.z, vh0 = innerHeight / cm.z, L0 = cm.x - vw0 / 2 - 200, T0 = cm.y - vh0 / 2 - 200;
      c.save(); c.fillStyle = 'rgba(8,6,24,' + (0.62 * st.inK) + ')'; c.beginPath(); c.rect(L0, T0, vw0 + 400, vh0 + 400);
      c.rect(hz.x0 * T, hz.y0 * T - 14, (hz.x1 - hz.x0 + 1) * T, (hz.y1 - hz.y0 + 1) * T + 22); c.fill('evenodd'); c.restore();
    }
    // gliders
    S.ents.forEach(function (e) {
      var s = e.id === S.myId ? myState() : (e.rst === 2 ? 'glide' : '');
      if (s !== 'glide') return; var ep = X.entPos(e), sway = Math.sin(tn / 300 + e.id) * 0.12;
      c.save(); c.translate(ep.x, ep.y - 50); c.rotate(sway);
      c.strokeStyle = '#1b1636'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-26, -6); c.lineTo(-6, 22); c.moveTo(26, -6); c.lineTo(6, 22); c.stroke();
      c.beginPath(); c.moveTo(-34, -4); c.quadraticCurveTo(0, -40, 34, -4); c.quadraticCurveTo(0, -16, -34, -4); var gc = c.createLinearGradient(-34, 0, 34, 0); gc.addColorStop(0, '#ff6ec7'); gc.addColorStop(0.5, '#ffd166'); gc.addColorStop(1, '#3fa9ff'); c.fillStyle = gc; c.fill(); c.lineWidth = 3; c.stroke();
      c.restore();
    });
    // battle bus
    var bp = st.bus && busPos();
    if (bp && snow() < st.bus.t0 + st.bus.dur + 2500) {
      var fade = clamp((st.bus.t0 + st.bus.dur + 2500 - snow()) / 2500, 0, 1);
      c.save(); c.globalAlpha = fade;
      c.fillStyle = 'rgba(10,6,30,.22)'; a.ell(c, bp.x + 40, bp.y + 70, 60, 20); c.fill();
      c.translate(bp.x, bp.y - 30); c.rotate(bp.ang);
      c.strokeStyle = '#1b1636'; c.lineWidth = 4; c.fillStyle = '#3a8dde'; c.fillRect(-60, -22, 120, 44); c.strokeRect(-60, -22, 120, 44);
      c.fillStyle = '#9fd4ff'; for (var wx = -48; wx < 48; wx += 22) { c.fillRect(wx, -16, 14, 10); c.fillRect(wx, 6, 14, 10); }
      c.fillStyle = '#ffd166'; c.fillRect(52, -18, 8, 36);
      c.rotate(-bp.ang);
      c.fillStyle = '#ff5c6c'; c.strokeStyle = '#1b1636'; c.lineWidth = 4; c.beginPath(); c.arc(0, -58, 34, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(-12, -70, 10, 0, TAU); c.fill();
      c.strokeStyle = '#1b1636'; c.lineWidth = 2; c.beginPath(); c.moveTo(-24, -34); c.lineTo(-20, -18); c.moveTo(24, -34); c.lineTo(20, -18); c.stroke();
      c.font = '800 12px Fredoka, sans-serif'; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('BATTLE BUS', 0, -56);
      c.restore();
    }
    // tracers
    for (var i = st.tracers.length - 1; i >= 0; i--) {
      var tr = st.tracers[i], age = tn - tr.t; if (age > 140) { st.tracers.splice(i, 1); continue; }
      var k = 1 - age / 140, fat = tr.w === 'sniper' ? 4 : tr.w === 'shotgun' || tr.w === 'tac' ? 1.6 : 2.4;
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,220,120,' + (0.35 * k) + ')'; c.lineWidth = fat * 3; c.beginPath(); c.moveTo(tr.x0, tr.y0); c.lineTo(tr.x1, tr.y1); c.stroke();
      c.strokeStyle = 'rgba(255,250,220,' + k + ')'; c.lineWidth = fat; c.beginPath(); var mx = tr.x0 + (tr.x1 - tr.x0) * Math.min(1, age / 50), my = tr.y0 + (tr.y1 - tr.y0) * Math.min(1, age / 50); c.moveTo(tr.x0 + (tr.x1 - tr.x0) * Math.max(0, age / 140 - 0.2), tr.y0 + (tr.y1 - tr.y0) * Math.max(0, age / 140 - 0.2)); c.lineTo(mx, my); c.stroke();
      if (age < 50) { c.fillStyle = 'rgba(255,220,120,' + k + ')'; c.beginPath(); c.arc(tr.x0, tr.y0, 7 + Math.random() * 4, 0, TAU); c.fill(); }
      c.restore();
    }
    // explosions
    for (var b = st.booms.length - 1; b >= 0; b--) { var bm = st.booms[b], ba = (tn - bm.t) / 500; if (ba > 1) { st.booms.splice(b, 1); continue; } c.save(); c.globalAlpha = 1 - ba; var bg2 = c.createRadialGradient(bm.x, bm.y, 0, bm.x, bm.y, bm.r * (0.5 + ba * 0.6)); bg2.addColorStop(0, 'rgba(255,240,180,.95)'); bg2.addColorStop(0.5, 'rgba(255,140,40,.7)'); bg2.addColorStop(1, 'rgba(120,40,20,0)'); c.fillStyle = bg2; c.beginPath(); c.arc(bm.x, bm.y, bm.r * (0.5 + ba * 0.6), 0, TAU); c.fill(); c.restore(); }
    // storm
    var z = zone();
    if (z) {
      var cam = X.cam, vw = innerWidth / cam.z, vh = innerHeight / cam.z, L = cam.x - vw / 2 - 200, Tp = cam.y - vh / 2 - 200;
      c.save();
      c.fillStyle = 'rgba(112,40,200,.36)'; c.beginPath(); c.rect(L, Tp, vw + 400, vh + 400); c.arc(z.x, z.y, Math.max(z.r, 1), 0, TAU); c.fill('evenodd');
      c.save(); c.beginPath(); c.rect(L, Tp, vw + 400, vh + 400); c.arc(z.x, z.y, Math.max(z.r, 1), 0, TAU); c.clip('evenodd');
      c.strokeStyle = 'rgba(200,160,255,.18)'; c.lineWidth = 6; for (var sw = 0; sw < 7; sw++) { var sr = z.r + 40 + sw * 70 + ((tn / 40) % 70); c.beginPath(); c.arc(z.x, z.y, sr, (tn / 2000 + sw) % TAU, (tn / 2000 + sw) % TAU + 1.6); c.stroke(); }
      c.restore();
      c.strokeStyle = 'rgba(210,170,255,.95)'; c.lineWidth = 6; c.shadowColor = '#b27cff'; c.shadowBlur = 18; c.beginPath(); c.arc(z.x, z.y, Math.max(z.r, 1), 0, TAU); c.stroke(); c.shadowBlur = 0;
      if (z.tr >= 0 && z.tr < z.r - 4) { c.setLineDash([18, 12]); c.lineDashOffset = -tn / 40; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.beginPath(); c.arc(z.tx, z.ty, Math.max(z.tr, 1), 0, TAU); c.stroke(); c.setLineDash([]); }
      c.restore();
    }
    // damage numbers
    for (var n = st.nums.length - 1; n >= 0; n--) {
      var dn = st.nums[n], na = (tn - dn.t) / 900; if (na > 1) { st.nums.splice(n, 1); continue; }
      c.save(); c.globalAlpha = 1 - na * na; c.font = '800 ' + (dn.big ? 22 : 17) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#1b1636';
      var ny = dn.y - na * 34, nx = dn.x + Math.sin(dn.t) * na * 10; c.strokeText(dn.v, nx, ny); c.fillStyle = dn.col; c.fillText(dn.v, nx, ny); c.restore();
    }
    // shield/health bars over other players
    S.ents.forEach(function (e) {
      if (e.id === S.myId || e.dead || e.elim || RG.skipEnt(e) || RG.hideTag(e)) return;
      var ep = X.entPos(e), w3 = 38, hp = Math.max(0, Math.min(100, (e.hp || 0) * 5));
      c.fillStyle = 'rgba(10,6,30,.55)'; c.fillRect(ep.x - w3 / 2 - 1, ep.y - 66, w3 + 2, 8);
      c.fillStyle = hp > 50 ? '#2bd576' : hp > 25 ? '#ffd166' : '#ff5c6c'; c.fillRect(ep.x - w3 / 2, ep.y - 63, w3 * hp / 100, 4);
      if (e.rsh) { c.fillStyle = '#3fb6ff'; c.fillRect(ep.x - w3 / 2, ep.y - 66, w3 * e.rsh / 100, 3); }
    });
  };

  // ------------------------------------------------------------ screen overlay (scope, storm vignette, hit marker, cursor)
  RG.screen = function (t) {
    if (!st) return;
    var w = innerWidth, h = innerHeight, tn = now();
    if (st.inStorm && myState() === 'ground') { var g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7); g.addColorStop(0, 'rgba(120,40,220,0)'); g.addColorStop(1, 'rgba(120,40,220,' + (0.45 + Math.sin(t * 5) * 0.1) + ')'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    var hurt = Math.max(0, 1 - (tn - st.hurtT) / 500); if (hurt > 0) { var g2 = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7); g2.addColorStop(0, 'rgba(255,40,60,0)'); g2.addColorStop(1, 'rgba(255,40,60,' + 0.4 * hurt + ')'); c.fillStyle = g2; c.fillRect(0, 0, w, h); }
    var it = heldItem(), mx = X.mouse.x, my = X.mouse.y;
    if (it && it.k === 'sniper' && rmb && myState() === 'ground') { c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.rect(0, 0, w, h); c.arc(mx, my, Math.min(w, h) * 0.32, 0, TAU); c.fill('evenodd'); c.strokeStyle = 'rgba(0,0,0,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(mx - 200, my); c.lineTo(mx + 200, my); c.moveTo(mx, my - 200); c.lineTo(mx, my + 200); c.stroke(); }
    if (!X.touch && S.screen === 'game' && myState() === 'ground') {
      var p = P(), spread = 0; if (it && RW(it.k).cls === 'gun') { var ww = RW(it.k); spread = ww.sp * (p && p.mv ? 1.25 : 1); }
      var gap = 6 + spread * 160, hitK = Math.max(0, 1 - (tn - st.hitT) / 220);
      c.save(); c.translate(mx, my); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.shadowColor = '#000'; c.shadowBlur = 3;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { c.beginPath(); c.moveTo(d[0] * gap, d[1] * gap); c.lineTo(d[0] * (gap + 8), d[1] * (gap + 8)); c.stroke(); });
      if (hitK > 0) { c.strokeStyle = 'rgba(255,80,80,' + hitK + ')'; c.lineWidth = 3; [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (d) { c.beginPath(); c.moveTo(d[0] * 6, d[1] * 6); c.lineTo(d[0] * 14, d[1] * 14); c.stroke(); }); }
      if (st.me && (st.me.rl || st.me.use)) { var end = st.me.rl || st.me.use.end, tot = st.me.rl ? (it ? RW(it.k).rl * rar(it.r).rl : 2000) : RW(st.me.use.k).use, k = clamp(1 - (end - snow()) / tot, 0, 1); c.shadowBlur = 0; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.stroke(); c.strokeStyle = st.me.use ? '#2bd576' : '#ffd166'; c.beginPath(); c.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke(); }
      c.restore();
    }
    drawMinimap(t);
  };

  // ------------------------------------------------------------ HUD (DOM)
  function buildHud() {
    if ($('rgHud')) return;
    var css = document.createElement('style');
    css.textContent = [
      'body.g-royale #hpRow, body.g-royale #hotbar, body.g-royale #heldName, body.g-royale #mini, body.g-royale #resP, body.g-royale #teamsP, body.g-royale #mgTop, body.g-royale #timerP { display:none !important; }',
      'body.g-royale #cv { cursor: none; }',
      '#rgHud{position:fixed;inset:0;pointer-events:none;z-index:6;font-family:Fredoka,system-ui,sans-serif;color:#fff}',
      '#rgHud.hidden{display:none}',
      '#rgBars{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:min(380px,60vw)}',
      '.rgBar{position:relative;height:16px;border-radius:8px;background:rgba(10,6,30,.65);border:3px solid #0d0a26;overflow:hidden;margin-top:5px}',
      '.rgBar i{position:absolute;left:0;top:0;bottom:0;transition:width .2s}',
      '.rgBar b{position:absolute;left:8px;top:-2px;font-size:13px;text-shadow:0 1px 0 #000}',
      '#rgSh i{background:linear-gradient(180deg,#7fd4ff,#2d8ff0)} #rgHp i{background:linear-gradient(180deg,#6cf09a,#1fb35a)}',
      '#rgSlots{position:absolute;right:16px;bottom:16px;display:flex;gap:6px;align-items:flex-end;pointer-events:auto}',
      '.rgS{width:62px;height:62px;border-radius:12px;background:rgba(10,6,30,.6);border:3px solid #0d0a26;position:relative;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;box-shadow:inset 0 -18px 0 rgba(0,0,0,.25)}',
      '.rgS.on{transform:translateY(-8px);border-color:#fff;box-shadow:0 0 0 2px #fff,inset 0 -18px 0 rgba(0,0,0,.25)}',
      '.rgS .k{position:absolute;left:4px;top:1px;font-size:11px;opacity:.8}',
      '.rgS .n{position:absolute;right:4px;bottom:2px;font-size:12px;font-weight:700;text-shadow:0 1px 0 #000}',
      '.rgS canvas{width:58px;height:31px;filter:drop-shadow(0 2px 0 rgba(0,0,0,.35))}',
      '.rgS.pk{width:46px;height:46px;font-size:20px}',
      '#rgAmmo{position:absolute;right:18px;bottom:96px;text-align:right;text-shadow:0 2px 0 #000;font-weight:800}',
      '#rgAmmo .mag{font-size:34px} #rgAmmo .res{font-size:16px;opacity:.85}',
      '#rgAmmoList{position:absolute;right:18px;bottom:150px;display:flex;flex-direction:column;gap:2px;align-items:flex-end;font-size:12px;font-weight:700;text-shadow:0 1px 0 #000}',
      '#rgMap{position:absolute;left:14px;top:14px;width:176px;height:176px;border-radius:14px;border:3px solid #0d0a26;background:#1667a8;box-shadow:0 4px 0 rgba(0,0,0,.35);overflow:hidden;pointer-events:auto;cursor:pointer}',
      '#rgMap.big{left:50%;top:50%;transform:translate(-50%,-50%);width:min(82vmin,640px);height:min(82vmin,640px);z-index:30}',
      '#rgMap canvas{width:100%;height:100%}',
      '#rgInfo{position:absolute;left:14px;top:198px;display:flex;flex-direction:column;gap:4px;font-weight:700;font-size:14px;text-shadow:0 1px 0 #000}',
      '#rgInfo .pill{background:rgba(10,6,30,.6);border:2px solid #0d0a26;border-radius:10px;padding:3px 9px;display:inline-block}',
      '#rgBus{position:absolute;left:50%;top:22%;transform:translateX(-50%);text-align:center;pointer-events:auto}',
      '#rgBus button{font:inherit;font-weight:800;font-size:22px;padding:12px 26px;border-radius:16px;border:4px solid #0d0a26;background:linear-gradient(180deg,#ffe08a,#ffb938);color:#2a1300;box-shadow:0 6px 0 #0d0a26;cursor:pointer}',
      '#rgBus .t{font-size:15px;margin-top:8px;text-shadow:0 2px 0 #000}',
      '#rgWin{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(circle,rgba(255,200,60,.25),rgba(0,0,0,0) 60%)}',
      '#rgWin .a{font-size:min(10vw,90px);font-weight:900;color:#ffd166;text-shadow:0 6px 0 #7a4a00,0 0 40px rgba(255,200,60,.8);letter-spacing:.02em;animation:rgPop .6s cubic-bezier(.2,1.6,.4,1)}',
      '#rgWin .b{font-size:min(5vw,34px);font-weight:800;text-shadow:0 3px 0 #000}',
      '@keyframes rgPop{from{transform:scale(.3);opacity:0}to{transform:none;opacity:1}}',
      '@media (pointer:coarse), (max-height:520px), (max-width:700px){',
      '  #rgMap{width:96px;height:96px;left:8px;top:8px;border-radius:10px}',
      '  #rgInfo{left:112px;top:8px;flex-direction:row;flex-wrap:wrap;gap:4px;font-size:11px;max-width:calc(100vw - 340px)}',
      '  #rgInfo .pill{padding:2px 7px}',
      '  #rgSlots{left:50%;right:auto;bottom:6px;transform:translateX(-50%);gap:4px}',
      '  .rgS{width:40px;height:40px;font-size:16px;border-width:2px;border-radius:9px}.rgS.pk{width:34px;height:34px;font-size:15px}.rgS canvas{width:34px;height:20px}.rgS.on{transform:translateY(-5px)}',
      '  .rgS .k{display:none}.rgS .n{font-size:10px}',
      '  #rgBars{bottom:54px;width:min(250px,40vw)}.rgBar{height:11px;border-width:2px;margin-top:3px}.rgBar b{font-size:10px;top:-2px}',
      '  #rgAmmo{left:50%;right:auto;transform:translateX(-50%);bottom:86px;text-align:center}#rgAmmo .mag{font-size:20px}#rgAmmo .res{display:none}',
      '  #rgAmmoList{display:none}',
      '  #rgBus{top:16%}#rgBus button{font-size:17px;padding:9px 18px}',
      '}',
    ].join('\n');
    document.head.appendChild(css);
    var d = document.createElement('div'); d.id = 'rgHud'; d.className = 'hidden';
    d.innerHTML = '<div id="rgMap"><canvas id="rgMapCv" width="352" height="352"></canvas></div><div id="rgInfo"></div>' +
      '<div id="rgBars"><div class="rgBar" id="rgSh"><i></i><b></b></div><div class="rgBar" id="rgHp"><i></i><b></b></div></div>' +
      '<div id="rgAmmoList"></div><div id="rgAmmo"></div><div id="rgSlots"></div>' +
      '<div id="rgBus" class="hidden"><button id="rgJump">🪂 JUMP</button><div class="t">Jump out over where you want to land!</div></div>' +
      '<div id="rgWin" class="hidden"><div class="a">#1 VICTORY ROYALE</div><div class="b" id="rgWinSub"></div></div>';
    document.body.appendChild(d);
    $('rgJump').onclick = function () { X.send({ t: 'rj' }); };
    $('rgMap').onclick = function () { if (!st) return; st.mapBig = !st.mapBig; $('rgMap').classList.toggle('big', st.mapBig); };
    $('rgSlots').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b || !st) return; X.send({ t: 'rsel', s: +b.dataset.s }); });
    $('rgSlots').addEventListener('contextmenu', function (e) { var b = e.target.closest('[data-s]'); e.preventDefault(); if (!b || !st || +b.dataset.s < 0) return; X.send({ t: 'rdrop', s: +b.dataset.s }); });
  }
  RG.show = function (on) { var h = $('rgHud'); if (h) h.classList.toggle('hidden', !on); if (!on && $('rgWin')) $('rgWin').classList.add('hidden'); };
  function slotIcon(it) {
    if (!it) return '';
    var w = RW(it.k);
    if (w.cls === 'gun') return '<canvas width="120" height="64" data-g="' + it.k + '" data-r="' + it.r + '"></canvas>';
    return '<span>' + w.icon + '</span>';
  }
  function renderSlots() {
    if (!st || !st.me) return;
    var me = st.me, h = '<div class="rgS pk' + (me.sel < 0 ? ' on' : '') + '" data-s="-1" title="Pickaxe (0)"><span class="k">0</span>⛏️</div>';
    for (var i = 0; i < MG.RSLOTS; i++) {
      var it = me.slots[i], w = it && RW(it.k), col = it ? (w.cls === 'gun' ? rar(it.r).c : '#8a8fb3') : '';
      h += '<div class="rgS' + (me.sel === i ? ' on' : '') + '" data-s="' + i + '" style="' + (it ? 'background:linear-gradient(180deg,' + col + 'cc,' + col + '55)' : '') + '" title="' + (it ? (w.cls === 'gun' ? rar(it.r).n + ' ' : '') + w.n : 'Empty') + ' — right-click to drop"><span class="k">' + (i + 1) + '</span>' + slotIcon(it) + (it ? '<span class="n">' + (w.cls === 'gun' ? it.a : it.n) + '</span>' : '') + '</div>';
    }
    $('rgSlots').innerHTML = h;
    [].forEach.call(document.querySelectorAll('#rgSlots canvas'), function (cv) { var cx = cv.getContext('2d'); cx.translate(60, 34); cx.rotate(-0.12); cx.scale(1.3, 1.3); gunArt(cx, cv.dataset.g, rar(cv.dataset.r).c); });
    var it2 = heldItem(), w2 = it2 && RW(it2.k);
    $('rgAmmo').innerHTML = it2 && w2.cls === 'gun' ? '<div class="mag" style="color:' + rar(it2.r).c + '">' + it2.a + ' <span style="font-size:18px;color:#fff;opacity:.8">/ ' + me.am[w2.am] + '</span></div><div class="res">' + rar(it2.r).n + ' ' + w2.n + (me.rl ? ' · reloading…' : '') + '</div>' : it2 ? '<div class="res">' + w2.n + ' ×' + it2.n + (w2.cls === 'heal' ? ' · click to use' : ' · click to throw') + '</div>' : '<div class="res">⛏️ Pickaxe · 1–5 for items</div>';
    $('rgAmmoList').innerHTML = Object.keys(MG.RAMMO).filter(function (a) { return me.am[a] > 0; }).map(function (a) { return '<span style="color:' + MG.RAMMO[a].c + '">' + MG.RAMMO[a].n + ' · ' + me.am[a] + '</span>'; }).join('');
  }
  function renderBars() {
    if (!st || !st.me) return; var me = st.me;
    $('rgSh').firstChild.style.width = me.sh + '%'; $('rgSh').lastChild.textContent = '🛡️ ' + me.sh;
    $('rgHp').firstChild.style.width = me.hp + '%'; $('rgHp').lastChild.textContent = '❤️ ' + me.hp;
  }
  var lastInfo = 0;
  function renderInfo() {
    if (now() - lastInfo < 250 || !st) return; lastInfo = now();
    var z = zone(), s = myState(), h = '';
    h += '<span class="pill">👥 ' + st.alive + ' left</span>';
    h += '<span class="pill">🎯 ' + ((st.me && st.me.kills) || 0) + ' eliminations</span>';
    if (z) { var mm = Math.floor(z.left / 60000), ss = Math.floor((z.left % 60000) / 1000); h += '<span class="pill" style="color:' + (z.shrink ? '#e0b3ff' : '#fff') + '">🌪️ ' + (z.shrink ? 'Storm closing ' : z.tr <= 0 && z.r <= 2 ? 'Final storm ' : 'Storm shrinks in ') + mm + ':' + (ss < 10 ? '0' : '') + ss + '</span>'; }
    var mvh = myVeh(); if (mvh) h += '<span class="pill">' + (VDEF(mvh).icon || '🚙') + ' ' + VDEF(mvh).n + ' ' + Math.max(0, Math.round(mvh.hp)) + '/' + VDEF(mvh).hp + '</span>';
    if (st.inStorm && s === 'ground') h += '<span class="pill" style="background:#7a2fd0">⚠️ In the storm! −' + ((z && z.d) || 1) + '/s</span>';
    $('rgInfo').innerHTML = h;
    $('rgBus').classList.toggle('hidden', s !== 'bus' || snow() < (st.bus ? st.bus.t0 : 0));
  }

  // ------------------------------------------------------------ minimap
  var minimapBase = null;
  function buildMinimap() {
    var map = S.map, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var cx = cv.getContext('2d'), img = cx.createImageData(W, H);
    var COL = {}; COL[B.G.GRASS] = [92, 191, 79]; COL[B.G.SAND] = [242, 207, 134]; COL[B.G.ROCK] = [120, 128, 145]; COL[B.G.PATH] = [196, 164, 112]; COL[B.G.FLOOR] = [170, 130, 90]; COL[B.G.COBBLE] = [160, 160, 170]; COL[B.G.STONE] = [150, 155, 165]; COL[B.G.ICE] = [170, 220, 255];
    for (var i = 0; i < W * H; i++) { var g = map.g[i], col = g ? (COL[g] || [92, 191, 79]) : [22, 103, 168]; if (map.w[i]) col = [122, 81, 48]; img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255; }
    cx.putImageData(img, 0, 0); minimapBase = cv;
  }
  function drawMinimap(t) {
    var cv = $('rgMapCv'); if (!cv || !st) return;
    if (!minimapBase) buildMinimap();
    var cx = cv.getContext('2d'), Wd = cv.width, s = Wd / (W * T), big = st.mapBig;
    cx.imageSmoothingEnabled = false; cx.clearRect(0, 0, Wd, Wd); cx.drawImage(minimapBase, 0, 0, Wd, Wd);
    var map = S.map;
    // roofs
    cx.fillStyle = 'rgba(160,70,60,.85)'; (map.houses || []).forEach(function (h) { cx.fillRect(h.x0 * T * s, h.y0 * T * s, (h.x1 - h.x0 + 1) * T * s, (h.y1 - h.y0 + 1) * T * s); });
    if (big) { cx.font = '800 ' + Math.round(Wd / 28) + 'px Fredoka, sans-serif'; cx.textAlign = 'center'; cx.lineWidth = 4; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.fillStyle = '#fff'; (map.pois || []).forEach(function (p) { cx.strokeText(p.name.toUpperCase(), p.x * T * s, p.y * T * s); cx.fillText(p.name.toUpperCase(), p.x * T * s, p.y * T * s); }); }
    // storm
    var z = zone();
    if (z) {
      cx.save(); cx.fillStyle = 'rgba(112,40,200,.45)'; cx.beginPath(); cx.rect(0, 0, Wd, Wd); cx.arc(z.x * s, z.y * s, Math.max(1, z.r * s), 0, TAU); cx.fill('evenodd');
      cx.strokeStyle = '#d6b3ff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(z.x * s, z.y * s, Math.max(1, z.r * s), 0, TAU); cx.stroke();
      if (z.tr < z.r) { cx.setLineDash([5, 4]); cx.strokeStyle = '#fff'; cx.beginPath(); cx.arc(z.tx * s, z.ty * s, Math.max(1, z.tr * s), 0, TAU); cx.stroke(); cx.setLineDash([]); }
      cx.restore();
    }
    // bus path
    if (st.bus && snow() < st.bus.t0 + st.bus.dur) { var b = st.bus; cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.setLineDash([4, 4]); cx.lineWidth = 2; cx.beginPath(); cx.moveTo(b.x0 * s, b.y0 * s); cx.lineTo(b.x1 * s, b.y1 * s); cx.stroke(); cx.setLineDash([]); var bp = busPos(); cx.fillStyle = '#3a8dde'; cx.strokeStyle = '#fff'; cx.beginPath(); cx.arc(bp.x * s, bp.y * s, 5, 0, TAU); cx.fill(); cx.stroke(); }
    // me (and my spectate target)
    var p = P(); if (p) { cx.save(); cx.translate(p.x * s, p.y * s); cx.rotate(p.ang); cx.fillStyle = '#ffd166'; cx.strokeStyle = '#1b1636'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(8, 0); cx.lineTo(-5, -5); cx.lineTo(-3, 0); cx.lineTo(-5, 5); cx.closePath(); cx.fill(); cx.stroke(); cx.restore(); }
    // gunshots nearby show as pings (like the real thing's sound indicators)
    st.tracers.forEach(function (tr) { if (tr.mine) return; cx.fillStyle = 'rgba(255,90,90,.9)'; cx.beginPath(); cx.arc(tr.x0 * s, tr.y0 * s, 3, 0, TAU); cx.fill(); });
  }

  // ------------------------------------------------------------ death / victory
  RG.death = function (d, killer, kind) {
    if (!st) return false;
    var o = st.out || {}, place = o.place || (st.alive + 1), total = o.total || st.total || S.ents.size;
    d.innerHTML = '<div class="big" style="color:#ff5c6c">#' + place + ' <span style="font-size:.55em;color:#fff">of ' + total + '</span></div><div class="sub">' + (kind === 'storm' ? '🌪️ The storm got you' : killer ? 'Eliminated by <span style="color:#ffd166">' + esc(killer.nick) + '</span>' : 'Eliminated') + ' · 🎯 ' + ((st.me && st.me.kills) || 0) + ' eliminations</div>' +
      '<div class="row" style="display:flex;gap:10px;justify-content:center;margin-top:12px;pointer-events:auto"><button class="btn" id="dSpec">👀 Spectate</button><button class="btn gold" id="dAgain">🔁 Play again</button><button class="btn" id="dHub">🏠 Hub</button></div>';
    $('dAgain').onclick = X.playAgain; $('dSpec').onclick = function () { d.classList.add('hidden'); if (killer) S.specId = killer.id; }; $('dHub').onclick = function () { X.send({ t: 'hub' }); };
    d.style.pointerEvents = 'auto';
    return true;
  };
  RG.end = function (m) {
    if (!st) return; var meWon = m && m.winner === S.team;
    if (meWon) { $('rgWin').classList.remove('hidden'); $('rgWinSub').textContent = '🎯 ' + ((st.me && st.me.kills) || 0) + ' eliminations'; snd('chest'); setTimeout(function () { snd('chest'); }, 350); }
    else { var w = (m.stats || []).find(function (s) { return s.team === m.winner; }); if (w) X.toastBig('👑 ' + w.nick + ' wins!', '#ffd166'); }
    setTimeout(function () { $('rgWin').classList.add('hidden'); }, 4200);
  };
  RG.reset = function () { st = null; RG.show(false); };
  RG._st = function () { return st; };
})();
