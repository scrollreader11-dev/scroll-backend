// ============================================================
// ScrollHub Games — Capture the Flag, TNT Spleef and Prop Hunt.
// These run inside the Bedwars engine (bedwars.js): same rooms, waiting island,
// combat, projectiles, bots, rewards and proximity voice. bedwars.js hands us
// its helpers through initMini(api).
// ============================================================
const BW = globalThis.BW, MG = globalThis.MG;
const { T, W, H } = BW;
const N = W * H;
let A = null;
export function initMini(api) { A = api; }

const rnd = Math.random;
const pick = (a) => a[(rnd() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tileOf = (x, y) => Math.floor(y / T) * W + Math.floor(x / T);
const tcen = (i) => ({ x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2 });
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const BOT_SENSE = { easy: { sus: 0.04, dig: 0.05, snow: 0.3, steer: 0.6, see: 4.5 }, normal: { sus: 0.08, dig: 0.12, snow: 0.6, steer: 0.85, see: 5.5 }, hard: { sus: 0.15, dig: 0.25, snow: 0.85, steer: 1, see: 6.5 } };

function freshStats(extra) { return { kills: 0, finals: 0, beds: 0, deaths: 0, ...extra }; }
function alive(r) { const a = []; for (const e of r.ents.values()) if (!e.dead && !e.elim) a.push(e); return a; }

// ============================================================ start
function start(r) {
  const now = Date.now(), GM = MG.GAMES[r.game];
  r.state = 'play';
  r.seed = (rnd() * 1e9) | 0;
  r.map = MG.genMap(r.game, r.seed, r.custom);
  r.ents = new Map();
  r.teams = []; for (let t = 0; t < 8; t++) r.teams.push({ bed: false, elim: false, up: { sharp: 0, prot: 0, forge: 0, haste: 0, heal: 0, trap: 0 } });
  r.gens = []; r.projs = []; r.tnts = []; r.events = []; r.tl = 0; r.tier = { dia: 0, em: 0 };
  r.goAt = now + 4200; r.lastHuman = now;
  r.ev = (a) => r.events.push(a);
  const used = new Set();
  const addBot = (team) => {
    let name; do { name = pick(A.BOT_NAMES); } while (used.has(name) && used.size < A.BOT_NAMES.length); used.add(name);
    return A.makeEnt(r, { nick: name, look: A.botLook(), team, bot: true });
  };
  for (const m of r.members) {
    const e = A.makeEnt(r, { cid: m.cid, nick: m.nick, look: m.look, team: r.game === 'hide' ? 0 : m.team, conn: m.conn });
    if (m.conn) { A.leaveSpace(m.conn); m.conn.ent = e; m.conn.room = r; }
  }
  const count = (t) => [...r.ents.values()].filter((e) => e.team === t).length;

  if (r.game === 'ctf') {
    for (let t = 0; t < 2; t++) while (count(t) < GM.per) addBot(t);
    for (let t = 0; t < 2; t++) {
      const bots = [...r.ents.values()].filter((e) => e.team === t && e.bot);
      const roles = ['def', 'atk', 'mid', 'atk'];
      bots.forEach((e, k) => { e.ai.role = roles[k % roles.length]; });
    }
    const m = r.map;
    r.flags = [0, 1].map((t) => ({ team: t, state: 0, carrier: 0, x: m.bases[t].fx, y: m.bases[t].fy, dropAt: 0 }));
    r.score = [0, 0]; r.endAt = r.goAt + GM.mins * 60000; r.flagsDirty = true;
    r.pick = m.pickSpots.map((s) => ({ x: s.x, y: s.y, item: '', at: r.goAt + 15000 + rnd() * 6000 }));
    for (const e of r.ents.values()) { e.stats = freshStats({ caps: 0, rets: 0 }); e.carry = -1; kitCTF(r, e); }
  } else if (r.game === 'spleef') {
    const taken = new Set([...r.ents.values()].map((e) => e.team));
    for (let t = 0; t < GM.max; t++) if (!taken.has(t)) addBot(t);
    const m = r.map;
    for (const e of r.ents.values()) {
      const s = m.spawns[e.team % m.spawns.length];
      e.x = s.x; e.y = s.y; e.z = 0; e.fallUntil = 0; e.ang = Math.atan2(36 * T - s.y, 36 * T - s.x);
      e.inv = A.emptyInv(); e.inv.snow = 0; e.held = 'shovel'; e.sword = 1; e.armor = 1;
      e.stats = freshStats({ digs: 0, knocks: 0, place: 0 });
      e.ai.dir = e.ang;
    }
    r.crum = new Map(); r.decay = 1000; r.sdAt = r.goAt + GM.mins * 60000; r.sdAnn = false; r.centerAt = 0; r.center = [];
  } else if (r.game === 'hide') {
    while (r.ents.size < GM.max) addBot(0);
    const all = shuffle([...r.ents.values()]);
    const nSeek = all.length <= 5 ? 1 : 2;
    const m = r.map, spots = shuffle(m.hideSpawns.slice());
    all.forEach((e, k) => {
      e.stats = freshStats({ finds: 0, taunts: 0, survived: 0 });
      e.dig = 0; e.start = k < nSeek ? 1 : 0;
      if (k < nSeek) { e.team = 1; setSeeker(r, e, true); }
      else { e.team = 0; const s = spots[k % spots.length]; e.x = s.x + (rnd() - 0.5) * 30; e.y = s.y + (rnd() - 0.5) * 20; e.prop = pick(MG.PROP_KINDS); e.held = 'mask'; e.sword = 1; e.armor = 1; }
    });
    r.phase = 'hide'; r.seekAt = r.goAt + GM.hideSec * 1000; r.endAt = r.seekAt + GM.seekSec * 1000; r.nextTaunt = r.seekAt + 30000;
  }
  for (const e of r.ents.values()) if (e.conn) A.send(e.conn, A.fullState(r, e));
}
function kitCTF(r, e) {
  const K = MG.CTF_KIT;
  e.sword = K.sword; e.armor = K.armor; e.pick = 0;
  const inv = A.emptyInv(); for (const k in K.inv) inv[k] = K.inv[k];
  e.inv = inv; e.held = 'sword'; e.dirty = true;
  r.ev(['gear', e.id, e.sword, e.armor, e.pick]);
}
function setSeeker(r, e, first) {
  const m = r.map, s = m.seekSpawn;
  e.team = 1; e.prop = ''; e.held = 'sword'; e.sword = 2; e.armor = 2; e.inv = A.emptyInv();
  e.x = s.x + (rnd() - 0.5) * 80; e.y = s.y + (rnd() - 0.5) * 80;
  e.ai.goal = null; e.ai.path = null; e.ai.enemy = null; e.ai.hint = null;
  r.ev(['gear', e.id, e.sword, e.armor, 0]);
  if (!first) r.teamsDirty = true;
}

// ============================================================ per-tick
function tick(r, now) {
  const m = r.map, DT = A.DT;
  if (r.game === 'hide') hidePhase(r, now);
  for (const e of r.ents.values()) {
    if (e.dead) { if (!e.elim && e.respawnAt && now >= e.respawnAt) respawn(r, e); continue; }
    if (e.elim) continue;
    if (e.ctl === 'ai') {
      if (r.game !== 'spleef' || !e.fallUntil) A.physics(r, e, DT, r.game === 'spleef');
      if (r.game === 'ctf') ctfBot(r, e, now); else if (r.game === 'spleef') spleefBot(r, e, now); else hideBot(r, e, now);
    } else {
      e.kbBudget *= 0.86;
      if (r.game === 'ctf') { if (e.mineReq && now < e.mineReq.until) A.mineStep(r, e, e.mineReq.i, DT); else if (e.mine) A.stopMine(r, e); }
    }
    if (r.game === 'spleef') { spleefEnt(r, e, now); continue; }
    if (!BW.groundUnder(m, e.x, e.y) && !e.god) { e.fall += DT; if (e.fall > (e.ctl === 'human' ? 0.3 : 0.08)) A.die(r, e, 'void', null); continue; }
    e.fall = 0;
    // healing
    let heal = 0;
    if (now - e.lastDmgAt > 5000) heal += r.game === 'hide' ? (e.team === 1 ? 0.8 : 0.3) : 0.5;
    if (now < e.regenUntil) heal += 2.2;
    if (heal && e.hp < BW.MAX_HP) e.hp = Math.min(BW.MAX_HP, e.hp + heal * DT);
    if (Math.ceil(e.hp) !== e.lastHp) { e.lastHp = Math.ceil(e.hp); e.dirty = true; }
    if (r.game === 'ctf') ctfTouch(r, e, now);
  }
  if (r.game === 'ctf') ctfTick(r, now);
  else if (r.game === 'spleef') spleefTick(r, now);
  checkEnd(r, now);
}

// ============================================================ CAPTURE THE FLAG
function ctfTouch(r, e, now) {
  // flags
  for (const f of r.flags) {
    if (f.state === 1) continue;
    if (Math.hypot(f.x - e.x, f.y - e.y) > 34) continue;
    if (e.team !== f.team) {
      if (e.carry >= 0) continue;
      f.state = 1; f.carrier = e.id; e.carry = f.team; r.flagsDirty = true;
      r.ev(['take', e.id, f.team]);
      if (e.ai) e.ai.path = null;
    } else if (f.state === 2) {
      returnFlag(r, f, e);
    }
  }
  // capture: carry the enemy flag to your own flag while it's home
  if (e.carry >= 0) {
    const mine = r.flags[e.team], base = r.map.bases[e.team];
    if (mine.state === 0 && Math.hypot(base.fx - e.x, base.fy - e.y) < 46) {
      const f = r.flags[e.carry];
      f.state = 0; f.carrier = 0; f.x = r.map.bases[f.team].fx; f.y = r.map.bases[f.team].fy;
      e.carry = -1; e.stats.caps++; e.dirty = true;
      r.score[e.team]++; r.flagsDirty = true;
      r.ev(['cap', e.id, f.team, r.score[0], r.score[1]]);
      for (const o of r.ents.values()) if (o.ai) { o.ai.path = null; o.ai.enemy = null; }
    }
  }
  // pickups
  for (let k = 0; k < r.pick.length; k++) {
    const p = r.pick[k]; if (!p.item || Math.hypot(p.x - e.x, p.y - e.y) > 32) continue;
    const it = p.item; p.item = ''; p.at = now + 22000 + rnd() * 8000;
    if (it === 'arrows') { e.inv.arrows += 8; if (!e.inv.bow) e.inv.bow = 1; } else if (it === 'wool') e.inv.wool += 16; else e.inv[it] = (e.inv[it] || 0) + 1;
    e.dirty = true; r.ev(['put', k, e.id, it]);
  }
}
function returnFlag(r, f, by) {
  f.state = 0; f.carrier = 0; f.x = r.map.bases[f.team].fx; f.y = r.map.bases[f.team].fy; f.dropAt = 0; r.flagsDirty = true;
  if (by) { by.stats.rets++; by.dirty = true; }
  r.ev(['ret', by ? by.id : 0, f.team]);
}
function dropFlag(r, e, toVoid) {
  const f = r.flags[e.carry]; e.carry = -1; if (!f) return;
  if (toVoid || !BW.groundUnder(r.map, e.x, e.y)) { returnFlag(r, f, null); return; }
  f.state = 2; f.carrier = 0; f.x = e.x; f.y = e.y; f.dropAt = Date.now() + 18000; r.flagsDirty = true;
  r.ev(['drop', e.id, f.team, Math.round(f.x), Math.round(f.y)]);
}
function ctfTick(r, now) {
  for (const f of r.flags) {
    if (f.state === 1) { const c = r.ents.get(f.carrier); if (!c || c.dead || c.elim) { f.state = 0; returnFlag(r, f, null); continue; } f.x = c.x; f.y = c.y; }
    else if (f.state === 2 && now >= f.dropAt) returnFlag(r, f, null);
  }
  if (now >= r.goAt) for (let k = 0; k < r.pick.length; k++) { const p = r.pick[k]; if (!p.item && now >= p.at) { p.item = pick(MG.PICKUPS); r.ev(['pu', k, p.item]); } }
}

// ============================================================ TNT SPLEEF
function spleefEnt(r, e, now) {
  const m = r.map;
  if (e.fallUntil) {
    if (now < e.fallUntil) return;
    e.z++;
    if (e.z >= MG.SP_LAYERS) { e.fallUntil = 0; A.die(r, e, 'void', null); return; }
    if (MG.spFloor(m, e.z, e.x, e.y)) { e.fallUntil = 0; e.noFloor = 0; e.landAt = now; r.ev(['land', e.id, e.z]); if (e.conn) A.send(e.conn, { t: 'z', z: e.z, x: Math.round(e.x), y: Math.round(e.y) }); e.dirty = true; }
    else e.fallUntil = now + 340;
    return;
  }
  const hopping = now - (e.hopAt || 0) < MG.HOP_MS;
  if (hopping) { e.noFloor = 0; return; }
  const ti = tileOf(e.x, e.y), L = m.L[e.z];
  if (L[ti]) {
    e.noFloor = 0;
    if (L[ti] === 1 && now >= r.goAt + 2000) { L[ti] = 2; r.crum.set(e.z * N + ti, now + r.decay); r.ev(['sp', e.z, ti, 2]); }
    return;
  }
  e.noFloor = (e.noFloor || 0) + A.DT;
  if (e.noFloor > (e.ctl === 'human' ? 0.16 : 0)) { e.noFloor = 0; e.fallUntil = now + 420; e.vx *= 0.3; e.vy *= 0.3; r.ev(['fall', e.id, e.z]); }
}
function crumble(r, z, i, ms, by) {
  const L = r.map.L[z]; if (!L[i]) return false;
  const k = z * N + i, at = Date.now() + ms;
  if (L[i] === 2) { if (r.crum.get(k) > at) r.crum.set(k, at); return true; }
  L[i] = 2; r.crum.set(k, at); r.ev(by ? ['sp', z, i, 2, by] : ['sp', z, i, 2]); return true;
}
function spleefTick(r, now) {
  const el = (now - r.goAt) / 1000;
  r.decay = Math.max(480, 1000 - el * 2.4);
  for (const [k, at] of r.crum) if (now >= at) { const z = (k / N) | 0, i = k % N; r.map.L[z][i] = 0; r.crum.delete(k); r.ev(['sp', z, i, 0]); }
  if (now >= r.sdAt) {
    if (!r.sdAnn) { r.sdAnn = true; r.ev(['sd']); }
    for (let k = 0; k < 4; k++) { const z = (rnd() * MG.SP_LAYERS) | 0, L = r.map.L[z]; for (let tries = 0; tries < 30; tries++) { const i = (rnd() * N) | 0; if (L[i] === 1) { crumble(r, z, i, 900); break; } } }
  }
  if (now - r.centerAt > 900) { // where the floor is left, for bots
    r.centerAt = now; r.center = r.map.L.map((L) => { let sx = 0, sy = 0, n = 0; for (let i = 0; i < N; i++) if (L[i] === 1) { sx += i % W; sy += (i / W) | 0; n++; } return n ? { x: (sx / n) * T + T / 2, y: (sy / n) * T + T / 2, n } : null; });
  }
}
function dig(r, e, i, now) {
  if (e.fallUntil || now - (e.digAt || 0) < 260) return false;
  const L = r.map.L[e.z]; if (!(i >= 0 && i < N) || !L[i]) return false;
  const c = tcen(i); if (Math.hypot(c.x - e.x, c.y - e.y) > BW.REACH + 24) return false;
  if (tileOf(e.x, e.y) === i) return false; // don't dig your own floor
  e.digAt = now; crumble(r, e.z, i, 240, e.id);
  e.stats.digs++; if (e.inv.snow < 16) e.inv.snow++; e.dirty = true;
  return true;
}
function snowHit(r, v, p) {
  const att = r.ents.get(p.owner);
  A.knock(r, v, p.vx, p.vy, 400);
  v.lastHitBy = p.owner; v.lastHitAt = Date.now();
  r.ev(['hit', v.id, 0, 0, p.owner, 'snow']);
  void att;
}
function snowLand(r, p) {
  if (r.game !== 'spleef') return;
  const z = p.z || 0, i = tileOf(p.x, p.y + 16), L = r.map.L[z];
  if (i >= 0 && i < N && L[i]) crumble(r, z, i, 240, p.owner);
}

// ============================================================ PROP HUNT
function hidePhase(r, now) {
  if (r.phase === 'hide' && now >= r.seekAt) { r.phase = 'seek'; r.ev(['phase', 'seek']); }
  if (r.phase === 'seek' && now >= r.nextTaunt) {
    r.nextTaunt = now + 30000;
    for (const e of r.ents.values()) if (e.team === 0 && !e.dead && now - (e.tauntAt || 0) > 20000) taunt(r, e, now, true);
  }
}
function taunt(r, e, now, auto) {
  e.tauntAt = now; if (!auto) e.stats.taunts++;
  r.ev(['taunt', e.id, Math.round(e.x), Math.round(e.y), auto ? 1 : 0, (rnd() * 5) | 0]);
  for (const s of r.ents.values()) if (s.ai && s.team === 1 && dist(s, e) < 15 * T) s.ai.hint = { x: e.x + (rnd() - 0.5) * 60, y: e.y + (rnd() - 0.5) * 60, at: now };
}
function missProp(r, e, ang, now) {
  if (e.team !== 1 || now < r.seekAt) return;
  let best = null, bd = BW.MELEE + 14;
  for (const p of r.map.props) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy); if (d > bd) continue;
    let da = Math.atan2(dy, dx) - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    if (d > 26 && Math.abs(da) > BW.ARC + 0.3) continue;
    bd = d; best = p;
  }
  if (!best || now - (e.missAt || 0) < 420) return;
  e.missAt = now;
  r.ev(['miss', e.id, best.id]);
  e.invulnUntil = 0;
  A.hurt(r, e, 1.2, null, 'prop', 0, 0, 0, false);
}

// ============================================================ death / respawn / end
function die(r, v, kind, att) {
  if (v.dead) return;
  const now = Date.now();
  if (!att && v.lastHitBy && now - v.lastHitAt < (r.game === 'spleef' ? 7000 : 10000)) att = r.ents.get(v.lastHitBy);
  if (att === v || (att && att.team === v.team && r.game !== 'spleef')) att = null;
  v.dead = true; v.hp = 0; v.stats.deaths++; A.stopMine(r, v); v.fall = 0; v.vx = v.vy = 0; v.bow = false;
  if (att) { att.stats.kills++; att.dirty = true; }
  let final = 0;
  if (r.game === 'ctf') {
    if (v.carry >= 0) dropFlag(r, v, kind === 'void');
    v.respawnAt = now + MG.GAMES.ctf.respawn * 1000;
  } else if (r.game === 'spleef') {
    final = 1; v.elim = true; v.fallUntil = 0;
    v.stats.place = alive(r).length + 1;
    if (att) att.stats.knocks++;
    r.teamsDirty = true;
  } else if (r.game === 'hide') {
    if (v.team === 0) {
      if (att) { att.stats.finds++; }
      v.respawnAt = now + 3500; v.wasHider = true;
      r.ev(['found', v.id, att ? att.id : 0, Math.round(v.x), Math.round(v.y), v.prop || '']);
      setSeekerLater(r, v);
    } else v.respawnAt = now + 5000;
  }
  r.ev(['die', v.id, kind, att ? att.id : 0, final, Math.round(v.x), Math.round(v.y)]);
  v.dirty = true; r.teamsDirty = true;
  if (v.ai) { v.ai.goal = null; v.ai.path = null; v.ai.enemy = null; }
  checkEnd(r, now);
}
function setSeekerLater(r, v) { v.team = 1; v.prop = ''; v.turned = true; }
function respawn(r, e) {
  const m = r.map, now = Date.now();
  e.dead = false; e.hp = BW.MAX_HP; e.absorb = 0; e.vx = e.vy = 0; e.fall = 0; e.lastHitBy = 0; e.dirty = true;
  e.invulnUntil = now + 1800;
  if (r.game === 'ctf') {
    const b = m.bases[e.team]; e.x = b.spawn.x + (rnd() - 0.5) * 30; e.y = b.spawn.y + (rnd() - 0.5) * 60; kitCTF(r, e);
    if (e.ai) { e.ai.viaDone = false; e.ai.lane = rnd() < 0.5 ? -1 : 1; e.ai.tp = null; }
  } else if (r.game === 'hide') {
    setSeeker(r, e, false);
    if (e.turned && e.conn) A.send(e.conn, { t: 'role', role: 1 });
    e.turned = false;
  }
  r.ev(['spawn', e.id, Math.round(e.x), Math.round(e.y)]);
  if (e.conn) A.send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y), spawn: 1 });
}
let ending = false;
function checkEnd(r, now) {
  if (r.state !== 'play' || ending) return;
  let winner = null;
  if (r.game === 'ctf') {
    const need = MG.GAMES.ctf.caps;
    if (r.score[0] >= need) winner = 0; else if (r.score[1] >= need) winner = 1;
    else if (now >= r.endAt) winner = r.score[0] > r.score[1] ? 0 : r.score[1] > r.score[0] ? 1 : -1;
  } else if (r.game === 'spleef') {
    if (now < r.goAt) return;
    const a = alive(r);
    if (a.length <= 1) { winner = a.length ? a[0].team : -1; if (a[0]) a[0].stats.place = 1; }
    else if (now >= r.sdAt + 120000) { winner = a[0].team; a.forEach((e, k) => { e.stats.place = k + 1; }); }
  } else if (r.game === 'hide') {
    if (now < r.goAt) return;
    const hiders = [...r.ents.values()].filter((e) => e.team === 0 && !e.dead);
    if (!hiders.length) winner = 1;
    else if (now >= r.endAt) { winner = 0; hiders.forEach((e) => { e.stats.survived = 1; }); }
  }
  if (winner === null) return;
  ending = true; try { A.endMatch(r, winner); } finally { ending = false; }
}
function isWinner(r, e, winner) { return e.team === winner; }
function reward(r, e, win) {
  const s = e.stats;
  if (r.game === 'ctf') return 15 + (win ? 100 : 0) + s.kills * 3 + s.caps * 25 + s.rets * 6;
  if (r.game === 'spleef') return 15 + ([0, 110, 65, 40, 25][s.place] || 0) + Math.min(30, s.digs) + s.knocks * 6;
  return 15 + (win ? 100 : 0) + s.finds * 12 + s.taunts * 3 + (s.survived ? 20 : 0);
}
function endInfo(r) {
  if (r.game === 'ctf') return { score: r.score };
  return {};
}

// ============================================================ network glue
function state(r, e) {
  const o = { game: r.game, seed: r.seed };
  if (r.game === 'ctf') { o.flags = r.flags.map((f) => [f.state, f.carrier, Math.round(f.x), Math.round(f.y)]); o.score = r.score; o.endAt = r.endAt; o.pick = r.pick.map((p) => p.item); }
  if (r.game === 'spleef') {
    const fresh = (r.custom ? MG.buildCustom(r.custom) : MG.genSpleef(r.seed)).L, diff = [];
    for (let z = 0; z < MG.SP_LAYERS; z++) for (let i = 0; i < N; i++) if (fresh[z][i] !== r.map.L[z][i]) diff.push([z, i, r.map.L[z][i]]);
    o.sp = diff; o.sdAt = r.sdAt; o.decay = r.decay;
  }
  if (r.game === 'hide') { o.seekAt = r.seekAt; o.endAt = r.endAt; o.phase = r.phase; }
  return o;
}
function extra(r, e) {
  if (r.game === 'spleef') return (e.z | 0) | (e.fallUntil ? 4 : 0);
  if (r.game === 'hide') return e.prop ? MG.PROP_KINDS.indexOf(e.prop) + 1 : 0;
  if (r.game === 'ctf') return e.carry >= 0 ? e.carry + 1 : 0;
  return 0;
}
function snapExtra(r, msg, now) {
  if (r.game === 'ctf' && (r.flagsDirty || now - (r.flAt || 0) > 500)) {
    r.flagsDirty = false; r.flAt = now;
    msg.fl = r.flags.map((f) => [f.state, f.carrier, Math.round(f.x), Math.round(f.y)]); msg.sc = r.score;
  }
}
function swingBlocked(r, e, now) {
  if (r.game === 'hide') return e.team === 0 || now < r.seekAt;
  if (r.game === 'spleef') return !!e.fallUntil;
  return false;
}
function onMsg(r, e, m, now) {
  const t = m.t;
  if (r.game === 'spleef') {
    if (t === 'mv' && e.fallUntil) return true;
    if (t === 'dig') { dig(r, e, m.i | 0, now); return true; }
    if (t === 'mine' || t === 'pl') return true;
  }
  if (r.game === 'hide') {
    if (t === 'mv' && e.team === 1 && now < r.seekAt) { if (now - (e.posAt || 0) > 1000) { e.posAt = now; A.send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) }); } return true; }
    if (t === 'dis') {
      if (e.team !== 0) return true;
      const p = r.map.props[m.p | 0]; if (!p || dist(p, e) > 2.6 * T) return true;
      e.prop = p.kind; r.ev(['dis', e.id, MG.PROP_KINDS.indexOf(p.kind)]); return true;
    }
    if (t === 'taunt') { if (e.team === 0 && now - (e.tauntAt || 0) > 5000) taunt(r, e, now, false); return true; }
    if (t === 'radar') {
      if (e.team !== 1 || now < r.seekAt || now - (e.radarAt || 0) < 20000) return true;
      e.radarAt = now;
      let best = null, bd = 1e9; for (const o of r.ents.values()) if (o.team === 0 && !o.dead) { const d = dist(o, e); if (d < bd) { bd = d; best = o; } }
      A.send(e.conn, best ? { t: 'radar', x: Math.round(best.x + (rnd() - 0.5) * 80), y: Math.round(best.y + (rnd() - 0.5) * 80), d: Math.round(bd) } : { t: 'radar', none: 1 });
      return true;
    }
    if (t === 'mine' || t === 'pl' || t === 'use' || t === 'bow') return true;
  }
  return false;
}
function adminInfo(r) {
  if (r.game === 'ctf') return 'Score ' + r.score[0] + ' – ' + r.score[1];
  if (r.game === 'spleef') return alive(r).length + ' still standing';
  if (r.game === 'hide') return (r.phase === 'hide' ? 'Hiding' : 'Seeking') + ' · ' + [...r.ents.values()].filter((e) => e.team === 0 && !e.dead).length + ' hiders left';
  return '';
}
function kit(r, e) {
  if (r.game === 'ctf') { kitCTF(r, e); e.sword = 4; e.armor = 4; e.inv.fireball += 3; e.inv.pearl += 2; e.inv.gapple += 3; e.inv.arrows += 32; e.dirty = true; r.ev(['gear', e.id, 4, 4, 0]); }
  if (r.game === 'spleef') { e.inv.snow = 16; e.dirty = true; }
}
function skip(r, ms) {
  if (r.game === 'ctf') r.endAt -= ms;
  if (r.game === 'spleef') r.sdAt -= ms;
  if (r.game === 'hide') { if (r.phase === 'hide') r.seekAt -= ms; r.endAt -= ms; }
  A.roomSend(r, { t: 'mgt', endAt: r.endAt, seekAt: r.seekAt, sdAt: r.sdAt });
}

// ============================================================ bots
function botCommon(r, e, now) {
  e.mv = false;
  if (now < r.goAt) return false;
  if (Math.hypot(e.vx, e.vy) > 70) return false;
  return true;
}
// --- CTF
function ctfBot(r, e, now) {
  if (!botCommon(r, e, now)) return;
  const ai = e.ai;
  if (now >= ai.thinkAt) { ai.thinkAt = now + 280 + rnd() * 240; ctfThink(r, e, now); }
  if (ai.enemy) { A.fight(r, e, now); return; }
  if (ai.path) { const s = A.stepPath(r, e, now); if (s !== 'go') ai.path = null; return; }
  if (ai.tp) { const d = Math.hypot(ai.tp.x - e.x, ai.tp.y - e.y); if (d > 10) A.moveToward(r, e, ai.tp.x, ai.tp.y, A.DT, ai.role === 'def' ? 0.6 : 1); }
}
function ctfThink(r, e, now) {
  const ai = e.ai, my = r.flags[e.team], en = r.flags[1 - e.team], base = r.map.bases[e.team];
  if (e.hp < 9 && e.inv.gapple) A.useItem(r, e, 'gapple', e.x, e.y, now);
  if (e.inv.speed && (e.carry >= 0 || ai.role === 'atk')) A.useItem(r, e, 'speed', e.x, e.y, now);
  const carrying = e.carry >= 0;
  const foe = A.foeNear(r, e, 6.5 * T);
  const nearMyFlag = (o) => Math.hypot(o.x - base.fx, o.y - base.fy) < 10 * T;
  if (foe) {
    const d = dist(foe, e), hitMe = e.lastHitBy === foe.id && now - e.lastHitAt < 3000;
    const want = carrying ? d < 80 : ai.role === 'atk' ? (d < 110 || hitMe || foe.carry >= 0) : ai.role === 'def' ? (nearMyFlag(foe) || d < 120 || foe.carry >= 0) : true;
    if (want && (A.clearLine(r, e, foe) || d < 70)) { ai.enemy = foe; return; }
    if (e.inv.bow && e.inv.arrows > 0 && now > (ai.bowAt || 0) && A.clearLine(r, e, foe) && rnd() < 0.5) { ai.bowAt = now + 1600 + rnd() * 1200; e.held = 'bow'; A.shootBow(r, e, Math.atan2(foe.y - 16 - (e.y - 16), foe.x - e.x) + (rnd() - 0.5) * 0.2, 0.75 + rnd() * 0.25, now); }
  }
  if (ai.enemy && (ai.enemy.dead || dist(ai.enemy, e) > (ai.role === 'atk' && !carrying ? 4 : 9) * T || !A.clearLine(r, e, ai.enemy))) ai.enemy = null;
  if (ai.enemy) return;
  let tp = null;
  if (carrying) tp = { x: base.fx, y: base.fy };
  else if (my.state === 1) { const c = r.ents.get(my.carrier); if (c && (ai.role !== 'atk' || dist(c, e) < 14 * T)) tp = { x: c.x, y: c.y }; }
  else if (my.state === 2 && (ai.role !== 'atk' || Math.hypot(my.x - e.x, my.y - e.y) < 16 * T)) tp = { x: my.x, y: my.y };
  if (!tp) {
    if (ai.role === 'def') { if (!ai.tp || now > (ai.patrolAt || 0)) { ai.patrolAt = now + 2500 + rnd() * 2500; tp = { x: base.fx + base.inward[0] * (1 + rnd() * 3) * T, y: base.fy + (rnd() - 0.5) * 5 * T }; } else tp = ai.tp; }
    else if (ai.role === 'mid') { const p = r.pick.find((q) => q.item); const mb = r.map.bases; tp = p ? { x: p.x, y: p.y } : { x: (mb[0].fx + mb[1].fx) / 2 + (rnd() - 0.5) * 120, y: (mb[0].fy + mb[1].fy) / 2 + (rnd() - 0.5) * 120 }; if (rnd() < 0.015) ai.role = 'atk'; }
    else if (en.state === 1) { const c = r.ents.get(en.carrier); tp = c ? { x: c.x + (rnd() - 0.5) * 60, y: c.y + (rnd() - 0.5) * 60 } : null; } // escort
    else {
      // sneak through a side lane first, then go for the flag
      if (!ai.lane) ai.lane = rnd() < 0.5 ? -1 : 1;
      const wp = { x: 36 * T + T / 2, y: (36 + ai.lane * 15) * T + T / 2 };
      if (!ai.viaDone && Math.hypot(wp.x - e.x, wp.y - e.y) < 2.5 * T) ai.viaDone = true;
      tp = ai.viaDone || r.custom ? { x: en.x, y: en.y } : wp;
    }
  }
  if (!tp) return;
  ai.tp = tp;
  const ti = tileOf(tp.x, tp.y);
  if (Math.hypot(tp.x - e.x, tp.y - e.y) < 1.5 * T) { ai.path = null; return; }
  if (!ai.path || ai.tgt !== ti || now - ai.planAt > 3000) {
    ai.tgt = ti; const opt = { bridge: e.inv.wool > 0, mine: true };
    let path = BW.floorAt(r.map, ti % W, (ti / W) | 0) && !BW.solidAt(r.map, ti % W, (ti / W) | 0) ? A.pathTo(r, e, ti, opt) : null;
    if (!path) path = A.pathNear(r, e, ti, opt);
    ai.path = path; ai.pi = 0; ai.planAt = now;
  }
}
// --- Spleef
function spleefBot(r, e, now) {
  if (!botCommon(r, e, now) || e.fallUntil) return;
  const ai = e.ai, m = r.map, L = m.L[e.z], S = BOT_SENSE[r.diff] || BOT_SENSE.normal;
  const solid = (x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); if (!BW.inb(tx, ty)) return 0; return L[ty * W + tx]; };
  if (now >= ai.thinkAt) {
    ai.thinkAt = now + 90 + rnd() * 70;
    const c = r.center[e.z];
    let best = ai.dir || 0, bs = -1e9;
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2 + (rnd() - 0.5) * 0.2, ca = Math.cos(a), sa = Math.sin(a);
      let sc = 0, hopNeeded = false;
      for (let s = 1; s <= 5; s++) {
        const v = solid(e.x + ca * s * 22, e.y + sa * s * 22), wgt = 1.4 - s * 0.2;
        if (v === 1) sc += 1 * wgt; else if (v === 2) sc -= (s <= 2 ? 1.2 : 0.5) * wgt;
        else { if (s <= 2 && solid(e.x + ca * (s + 1.5) * 22, e.y + sa * (s + 1.5) * 22) === 1 && now - (e.hopAt || 0) > 950) { hopNeeded = true; sc -= 0.4; } else { sc -= (s === 1 ? 8 : 3) * wgt; break; } }
      }
      if (c) { const ac = Math.atan2(c.y - e.y, c.x - e.x); sc += Math.cos(a - ac) * 0.45 * Math.min(1, Math.hypot(c.x - e.x, c.y - e.y) / 300); }
      for (const o of r.ents.values()) { if (o === e || o.dead || o.elim || o.z !== e.z) continue; const od = dist(o, e); if (od < 170) sc -= Math.cos(a - Math.atan2(o.y - e.y, o.x - e.x)) * 0.7 * (1 - od / 170); }
      sc += Math.cos(a - (ai.dir || 0)) * (solid(e.x, e.y) === 2 ? 0.1 : 0.5);
      sc += (rnd() - 0.5) * (1.4 - S.steer);
      if (sc > bs) { bs = sc; best = a; ai.hopNeed = hopNeeded; }
    }
    ai.dir = best;
    // attacks: dig the floor out from under someone, throw snowballs, punch
    let foe = null, fd = 1e9; for (const o of r.ents.values()) { if (o === e || o.dead || o.elim || o.z !== e.z || o.fallUntil) continue; const d = dist(o, e); if (d < fd) { fd = d; foe = o; } }
    if (foe) {
      if (fd < BW.REACH && now > (ai.digAt || 0) && rnd() < S.dig) { ai.digAt = now + 1300 + rnd() * 1300; const lead = { x: foe.x + (foe.vx || 0) * 0.1, y: foe.y }; dig(r, e, tileOf(lead.x, lead.y), now); }
      else if (e.inv.snow > 0 && fd < 7 * T && fd > 90 && now > (ai.snowAt || 0) && rnd() < S.snow) { ai.snowAt = now + 1600 + rnd() * 1600; e.held = 'snow'; A.useItem(r, e, 'snow', foe.x, foe.y, now); e.held = 'shovel'; }
      else if (fd < BW.MELEE - 8 && now > (ai.punchAt || 0)) { ai.punchAt = now + 500 + rnd() * 500; A.swing(r, e, Math.atan2(foe.y - e.y, foe.x - e.x), now); }
    }
    // dig random tiles around to earn snowballs
    if (!foe || fd > BW.REACH) if (rnd() < 0.2 && now > (ai.digAt || 0)) { ai.digAt = now + 900; const a2 = ai.dir + Math.PI + (rnd() - 0.5); dig(r, e, tileOf(e.x + Math.cos(a2) * 70, e.y + Math.sin(a2) * 70), now); }
  }
  const ca = Math.cos(ai.dir), sa = Math.sin(ai.dir);
  if (ai.hopNeed && now - (e.hopAt || 0) > 950) { const ahead = solid(e.x + ca * 26, e.y + sa * 26); if (!ahead) { e.hopAt = now; r.ev(['hop', e.id]); ai.hopNeed = false; } }
  const sp = BW.SPEED * (e.ai.hopNeed ? 1.15 : 1) * A.DT;
  BW.move(m, e, ca * sp, sa * sp, false);
  e.mv = true; e.ang = ai.dir;
}
// --- Prop Hunt
function hideBot(r, e, now) {
  if (!botCommon(r, e, now)) return;
  const ai = e.ai;
  if (e.team === 0) return hiderBot(r, e, now);
  if (now < r.seekAt) return;
  if (now >= ai.thinkAt) { ai.thinkAt = now + 300 + rnd() * 260; seekerThink(r, e, now); }
  if (ai.enemy) { if (ai.enemy.dead || ai.enemy.team !== 0) { ai.enemy = null; } else { A.fight(r, e, now); return; } }
  if (ai.whack) { const p = ai.whack; e.ang = Math.atan2(p.y - e.y, p.x - e.x); if (dist(p, e) < BW.MELEE - 10) { A.swing(r, e, e.ang, now); ai.whack = null; } else A.moveToward(r, e, p.x, p.y, A.DT); return; }
  if (ai.path) { const s = A.stepPath(r, e, now); if (s !== 'go') ai.path = null; }
}
function freeTileNear(r, p) {
  const tx = p.tile % W, ty = (p.tile / W) | 0, opts = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const x = tx + dx, y = ty + dy; if (BW.floorAt(r.map, x, y) && !BW.solidAt(r.map, x, y)) opts.push(y * W + x); }
  return opts.length ? pick(opts) : -1;
}
function hiderBot(r, e, now) {
  const ai = e.ai, m = r.map;
  if (now >= ai.thinkAt) {
    ai.thinkAt = now + 350 + rnd() * 300;
    // hurt or a seeker swinging right next to us: run!
    let near = null, nd = 1e9; for (const s of r.ents.values()) if (s.team === 1 && !s.dead) { const d = dist(s, e); if (d < nd) { nd = d; near = s; } }
    const hurtNow = e.hp < (ai.lastHp || BW.MAX_HP) - 0.5; ai.lastHp = e.hp;
    if ((hurtNow && nd < 4 * T) || (ai.frozen && nd < 1.4 * T && rnd() < 0.25)) {
      ai.flee = true; ai.frozen = false; ai.spot = -1; e.sprint = true;
      let best = null, bs = -1; for (let k = 0; k < 8; k++) { const p = pick(m.props); const d = near ? dist(p, near) : 0; if (d > bs) { bs = d; best = p; } }
      if (best) { ai.spot = freeTileNear(r, best); ai.copy = best; }
      if (ai.spot >= 0) { ai.path = A.pathTo(r, e, ai.spot, { bridge: false, mine: false }); ai.pi = 0; }
    }
    if (!ai.frozen && !ai.path && (ai.spot == null || ai.spot < 0)) {
      const p = pick(m.props); ai.copy = p; ai.spot = freeTileNear(r, p);
      if (ai.spot >= 0) { ai.path = A.pathTo(r, e, ai.spot, { bridge: false, mine: false }); ai.pi = 0; }
    }
    if (ai.frozen && (!near || nd > 8 * T) && r.phase === 'seek' && now - (e.tauntAt || 0) > 15000 && rnd() < 0.05) taunt(r, e, now, false);
  }
  if (ai.path) { const s = A.stepPath(r, e, now); if (s === 'done' || s === 'fail') { ai.path = null; if (s === 'fail') ai.spot = -1; } return; }
  if (ai.spot >= 0 && !ai.frozen) {
    const c = tcen(ai.spot);
    if (Math.hypot(c.x - e.x, c.y - e.y) > 3) { A.moveToward(r, e, c.x, c.y, A.DT, 0.6); return; }
    ai.frozen = true; ai.flee = false; e.sprint = false;
    if (ai.copy && ai.copy.kind !== e.prop) { e.prop = ai.copy.kind; r.ev(['dis', e.id, MG.PROP_KINDS.indexOf(e.prop)]); }
    e.ang = Math.PI / 2;
  }
}
function seekerThink(r, e, now) {
  const ai = e.ai, m = r.map, S = BOT_SENSE[r.diff] || BOT_SENSE.normal;
  // anyone moving in plain sight, or a prop that looks suspicious up close
  for (const h of r.ents.values()) {
    if (h.team !== 0 || h.dead) continue;
    const d = dist(h, e);
    if ((h.mv && d < S.see * T && A.clearLine(r, e, h)) || (d < 1.5 * T && rnd() < S.sus) || (h.hp < BW.MAX_HP - 2 && now - h.lastDmgAt < 4000 && d < 3 * T && rnd() < 0.5)) { ai.enemy = h; ai.path = null; return; }
  }
  if (now - (e.radarAt || 0) > 20000 && rnd() < 0.3) {
    e.radarAt = now; let best = null, bd = 1e9; for (const h of r.ents.values()) if (h.team === 0 && !h.dead) { const d = dist(h, e); if (d < bd) { bd = d; best = h; } }
    if (best) ai.hint = { x: best.x + (rnd() - 0.5) * 140, y: best.y + (rnd() - 0.5) * 140, at: now };
  }
  if (ai.path) return;
  let tgt = null;
  if (ai.hint && now - ai.hint.at < 15000 && Math.hypot(ai.hint.x - e.x, ai.hint.y - e.y) > 2 * T) { tgt = tileOf(ai.hint.x, ai.hint.y); if (!BW.floorAt(m, tgt % W, (tgt / W) | 0) || BW.solidAt(m, tgt % W, (tgt / W) | 0)) tgt = null; }
  else ai.hint = null;
  if (tgt == null) {
    // wander toward a random prop; sometimes whack a real one to check it
    const p = pick(m.props);
    if (dist(p, e) < 2.2 * T && rnd() < 0.15) { ai.whack = p; return; }
    tgt = freeTileNear(r, p);
  }
  if (tgt >= 0) { ai.path = A.pathTo(r, e, tgt, { bridge: false, mine: false }); ai.pi = 0; ai.planAt = now; }
}

function lateJoin(r, e) {
  if (r.game === 'ctf') { e.stats = freshStats({ caps: 0, rets: 0 }); e.carry = -1; kitCTF(r, e); }
  else if (r.game === 'hide') { e.stats = freshStats({ finds: 0, taunts: 0, survived: 0 }); e.start = 1; setSeeker(r, e, false); }
  else return false;
  r.teamsDirty = true; return true;
}
export const MINI = { lateJoin, start, tick, die, respawn, checkEnd, isWinner, reward, endInfo, state, extra, snapExtra, swingBlocked, missProp, onMsg, snowHit, snowLand, adminInfo, kit, skip };
