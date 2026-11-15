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
  r.teams = []; for (let t = 0; t < Math.max(8, r.members.length + 8); t++) r.teams.push({ bed: false, elim: false, up: { sharp: 0, prot: 0, forge: 0, haste: 0, heal: 0, trap: 0 } });
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
    for (let t = 0; t < 2; t++) while (count(t) < (r.noBots ? 1 : GM.per)) addBot(t);
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
    for (let t = 0; t < GM.max && !(r.noBots && r.ents.size >= 2); t++) if (!taken.has(t)) addBot(t);
    const m = r.map;
    for (const e of r.ents.values()) {
      const s = m.spawns[e.team % m.spawns.length];
      e.x = s.x; e.y = s.y; e.z = 0; e.fallUntil = 0; e.ang = Math.atan2(36 * T - s.y, 36 * T - s.x);
      e.inv = A.emptyInv(); e.inv.snow = 0; e.held = 'shovel'; e.sword = 1; e.armor = 1;
      e.stats = freshStats({ digs: 0, knocks: 0, place: 0 });
      e.ai.dir = e.ang;
    }
    r.crum = new Map(); r.decay = 1000; r.sdAt = r.goAt + GM.mins * 60000; r.sdAnn = false; r.centerAt = 0; r.center = [];
  } else if (r.game === 'duel') {
    for (let t = 0; t < 2; t++) while (count(t) < 1) addBot(t);
    r.score = [0, 0]; r.endAt = r.goAt + GM.mins * 60000;
    for (const e of r.ents.values()) {
      const b = r.map.bases[e.team % r.map.bases.length];
      e.x = b.spawn.x; e.y = b.spawn.y; e.ang = Math.atan2(0, b.inward[0]);
      e.sword = 3; e.armor = 2; e.inv = A.emptyInv(); e.held = 'sword';
      e.stats = freshStats({ streak: 0, best: 0 });
    }
  } else if (r.game === 'murder') {
    while (r.ents.size < (r.noBots ? 3 : GM.max)) addBot(r.ents.size);
    const all = shuffle([...r.ents.values()]);
    const m2 = r.map, spots2 = shuffle(m2.hideSpawns.concat([m2.seekSpawn]));
    all.forEach((e, k) => {
      e.mrole = k === 0 ? 'm' : k === 1 ? 'd' : 'i';
      const s = spots2[k % spots2.length];
      e.x = s.x + (rnd() - 0.5) * 40; e.y = s.y + (rnd() - 0.5) * 30;
      e.sword = 4; e.armor = 1; e.inv = A.emptyInv(); e.held = 'fists'; e.gold = 0;
      if (e.mrole === 'd') { e.inv.bow = 1; e.inv.arrows = 1; }
      e.stats = freshStats({ gold: 0, shots: 0, role: e.mrole });
      e.ai.wanderAt = 0; e.ai.knows = false;
      if (e.mrole === 'm' && e.bot) e.ai.coolAt = r.goAt + 15000 + rnd() * 15000;   // let everyone spread out first
    });
    r.endAt = r.goAt + GM.mins * 60000; r.golds = new Map(); r.goldSeq = 0; r.goldAt = r.goAt + 3000; r.detId = all[1].id;
  } else if (r.game === 'build') {
    while (r.ents.size < (r.noBots ? 2 : GM.max)) addBot(r.ents.size);
    r.phase = 'build'; r.theme = pick(MG.BB_THEMES); r.buildEnd = r.goAt + GM.buildSec * 1000;
    r.votes = r.map.plots.map(() => ({ sum: 0, n: 0, who: new Set() }));
    r.voteOrder = null; r.voteIdx = -1; r.voteNext = 0; r.results = null;
    for (const e of r.ents.values()) {
      const b = r.map.bases[e.team % r.map.bases.length];
      e.x = b.spawn.x; e.y = b.spawn.y; e.held = 'fists'; e.god = true;
      e.stats = freshStats({ placed: 0, score: 0, place: 0 });
      if (e.bot) bbPlanBot(r, e);
    }
  } else if (r.game === 'hide') {
    while (r.ents.size < (r.noBots ? 2 : GM.max)) addBot(0);
    const all = shuffle([...r.ents.values()]);
    const nSeek = all.length <= 5 ? 1 : Math.max(2, Math.round(all.length / 6));
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
  if (r.game === 'build') { buildTick(r, now); checkEnd(r, now); return; }
  for (const e of r.ents.values()) {
    if (e.dead) { if (!e.elim && e.respawnAt && now >= e.respawnAt) respawn(r, e); continue; }
    if (e.elim) continue;
    if (e.ctl === 'ai') {
      if (r.game !== 'spleef' || !e.fallUntil) A.physics(r, e, DT, r.game === 'spleef');
      if (r.game === 'ctf') ctfBot(r, e, now); else if (r.game === 'spleef') spleefBot(r, e, now);
      else if (r.game === 'duel') duelBot(r, e, now); else if (r.game === 'murder') murderBot(r, e, now); else hideBot(r, e, now);
    } else {
      e.kbBudget *= 0.86;
      if (r.game === 'ctf') { if (e.mineReq && now < e.mineReq.until) A.mineStep(r, e, e.mineReq.i, DT); else if (e.mine) A.stopMine(r, e); }
    }
    if (r.game === 'spleef') { spleefEnt(r, e, now); continue; }
    if (!BW.groundUnder(m, e.x, e.y) && !e.god) { e.fall += DT; if (e.fall > (e.ctl === 'human' ? 0.3 : 0.08)) A.die(r, e, 'void', null); continue; }
    e.fall = 0;
    // healing
    let heal = 0;
    if (now - e.lastDmgAt > 5000) heal += r.game === 'hide' ? (e.team === 1 ? 0.8 : 0.3) : r.game === 'duel' ? 1.1 : 0.5;
    if (now < e.regenUntil) heal += 2.2;
    if (heal && e.hp < BW.MAX_HP) e.hp = Math.min(BW.MAX_HP, e.hp + heal * DT);
    if (Math.ceil(e.hp) !== e.lastHp) { e.lastHp = Math.ceil(e.hp); e.dirty = true; }
    if (r.game === 'ctf') ctfTouch(r, e, now);
    if (r.game === 'murder') murderEnt(r, e, now);
  }
  if (r.game === 'ctf') ctfTick(r, now);
  else if (r.game === 'spleef') spleefTick(r, now);
  else if (r.game === 'murder') murderTick(r, now);
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
    const mine = r.flags[e.team], base = r.map.bases[e.team % r.map.bases.length];
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
  } else if (r.game === 'duel') {
    if (att) { att.stats.streak++; att.stats.best = Math.max(att.stats.best, att.stats.streak); r.score[att.team]++; r.ev(['dscore', r.score[0], r.score[1], att.id]); }
    v.stats.streak = 0;
    v.respawnAt = now + MG.GAMES.duel.respawn * 1000;
  } else if (r.game === 'murder') {
    final = 1; v.elim = true;
    if (v.mrole === 'm') r.ev(['mdead', v.id, att ? att.id : 0]);
    else {
      if (v.inv.bow || v.mrole === 'd') { const g = goldDrop(r, v.x, v.y, true); void g; }
      // an innocent / detective shot the wrong person: justice is swift
      if (kind === 'arrow' && att && att.mrole !== 'm' && !att.dead) {
        r.ev(['justice', att.id, v.id]);
        setTimeout(() => { try { if (r.state === 'play' && !att.dead) { att.lastHitBy = 0; A.die(r, att, 'justice', null); } } catch (err) {} }, 600);
      }
      if (att && att.mrole === 'm') att.stats.kills = (att.stats.kills | 0);
    }
    // nearby players witness the kill
    if (att && att.mrole === 'm') for (const o of r.ents.values()) { if (o !== v && o !== att && !o.dead && o.ai && dist(o, att) < 9 * T) { o.ai.knows = true; o.ai.fleeFrom = att.id; } }
  } else if (r.game === 'hide') {
    if (v.team === 0) {
      if (att) { att.stats.finds++; }
      v.respawnAt = now + 3500; v.wasHider = true;
      r.ev(['found', v.id, att ? att.id : 0, Math.round(v.x), Math.round(v.y), v.prop || '']);
      setSeekerLater(r, v);
    } else v.respawnAt = now + 5000;
  }
  // Murder Mystery: never say who did it — the kill feed would give the murderer away
  r.ev(['die', v.id, r.game === 'murder' ? 'murder' : kind, att && r.game !== 'murder' ? att.id : 0, final, Math.round(v.x), Math.round(v.y)]);
  if (r.game === 'murder' && att && att.conn && att.mrole === 'm') A.send(att.conn, { t: 'toast', msg: '🔪 You eliminated ' + v.nick + ' — nobody saw who did it…' });
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
    const b = m.bases[e.team % m.bases.length]; e.x = b.spawn.x + (rnd() - 0.5) * 30; e.y = b.spawn.y + (rnd() - 0.5) * 60; kitCTF(r, e);
    if (e.ai) { e.ai.viaDone = false; e.ai.lane = rnd() < 0.5 ? -1 : 1; e.ai.tp = null; }
  } else if (r.game === 'duel') {
    const b = m.bases[e.team % m.bases.length]; e.x = b.spawn.x; e.y = b.spawn.y; e.vx = e.vy = 0; e.held = 'sword';
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
  } else if (r.game === 'duel') {
    const need = MG.GAMES.duel.wins;
    if (r.score[0] >= need) winner = 0; else if (r.score[1] >= need) winner = 1;
    else if (now >= r.endAt) winner = r.score[0] > r.score[1] ? 0 : r.score[1] > r.score[0] ? 1 : -1;
  } else if (r.game === 'murder') {
    if (now < r.goAt) return;
    const mur = [...r.ents.values()].find((e) => e.mrole === 'm');
    const inno = [...r.ents.values()].filter((e) => e.mrole !== 'm' && !e.dead);
    if (!mur || mur.dead) winner = 0;                                   // innocents
    else if (!inno.length) winner = 1;                                  // the murderer
    else if (now >= r.endAt) { winner = 0; inno.forEach((e) => { e.stats.survived = 1; }); }
  } else if (r.game === 'build') {
    if (r.results && now >= r.podiumAt) winner = r.results[0].team;
  }
  if (winner === null) return;
  ending = true; try { A.endMatch(r, winner); } finally { ending = false; }
}
function isWinner(r, e, winner) {
  if (r.game === 'murder') return winner === 1 ? e.mrole === 'm' : e.mrole !== 'm' && (!e.dead || e.justiced);
  return e.team === winner;
}
function reward(r, e, win) {
  const s = e.stats;
  if (r.game === 'ctf') return 15 + (win ? 100 : 0) + s.kills * 3 + s.caps * 25 + s.rets * 6;
  if (r.game === 'spleef') return 15 + ([0, 110, 65, 40, 25][s.place] || 0) + Math.min(30, s.digs) + s.knocks * 6;
  if (r.game === 'duel') return 20 + (win ? 90 : 0) + s.kills * 8;
  if (r.game === 'murder') return 15 + (win ? 90 : 0) + s.kills * 6 + Math.min(20, s.gold) + (s.role === 'm' ? 15 : 0);
  if (r.game === 'build') return 20 + ([0, 110, 60, 35, 20][s.place] || 0) + Math.min(40, (s.placed / 4) | 0);
  return 15 + (win ? 100 : 0) + s.finds * 12 + s.taunts * 3 + (s.survived ? 20 : 0);
}
function endInfo(r) {
  if (r.game === 'ctf' || r.game === 'duel') return { score: r.score };
  if (r.game === 'murder') { const mur = [...r.ents.values()].find((e) => e.mrole === 'm'); return { murderer: mur ? mur.id : 0 }; }
  if (r.game === 'build') return { theme: r.theme, results: r.results };
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
  if (r.game === 'duel') { o.score = r.score; o.endAt = r.endAt; }
  if (r.game === 'murder') {
    o.endAt = r.endAt; o.det = r.detId; o.mrole = e ? e.mrole : '';
    o.golds = [...r.golds.entries()].map(([id, g]) => [id, g.i]);
  }
  if (r.game === 'build') {
    o.phase = r.phase; o.theme = r.theme; o.buildEnd = r.buildEnd; o.voteIdx = r.voteIdx; o.votePlot = r.voteOrder ? r.voteOrder[r.voteIdx] : -1;
    const m2 = r.map, bb = [];
    for (let i = 0; i < N; i++) { if (m2.f[i]) bb.push([i, 1, m2.f[i], m2.fc[i]]); if (m2.w[i]) bb.push([i, 2, m2.w[i], m2.wc[i]]); }
    const base = MG.genBuild();
    for (let i = 0; i < N; i++) if (m2.g[i] !== base.g[i]) bb.push([i, 0, m2.g[i], 0]);
    (m2.props || []).forEach((p2) => bb.push([p2.tile, 3, MG.PROP_KINDS.indexOf(p2.kind) + 1, 0]));
    o.bb = bb; o.plotOwners = plotOwners(r);
  }
  return o;
}
function extra(r, e) {
  if (r.game === 'murder') return e.gold | 0;
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
  if (r.game === 'murder') return !(e.mrole === 'm' && (e.held === 'knife' || e.held === 'sword'));
  if (r.game === 'build') return true;
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
  if (r.game === 'duel') { if (t === 'mine' || t === 'pl' || t === 'use') return true; }
  if (r.game === 'murder') {
    if (t === 'mine' || t === 'pl' || t === 'use') return true;
    if (t === 'bow' && !(e.inv.bow > 0)) return true;
  }
  if (r.game === 'build') {
    if (t === 'bb') { bbMsg(r, e, m, now); return true; }
    if (t === 'mine' || t === 'pl' || t === 'use' || t === 'bow' || t === 'sw') return true;
  }
  return false;
}
function adminInfo(r) {
  if (r.game === 'ctf' || r.game === 'duel') return 'Score ' + r.score[0] + ' – ' + r.score[1];
  if (r.game === 'murder') return [...r.ents.values()].filter((e) => e.mrole !== 'm' && !e.dead).length + ' innocents left';
  if (r.game === 'build') return r.phase === 'build' ? 'Building: ' + r.theme : r.phase === 'vote' ? 'Voting' : 'Results';
  if (r.game === 'spleef') return alive(r).length + ' still standing';
  if (r.game === 'hide') return (r.phase === 'hide' ? 'Hiding' : 'Seeking') + ' · ' + [...r.ents.values()].filter((e) => e.team === 0 && !e.dead).length + ' hiders left';
  return '';
}
function kit(r, e) {
  if (r.game === 'duel') { e.sword = 4; e.armor = 4; e.dirty = true; r.ev(['gear', e.id, 4, 4, 0]); }
  if (r.game === 'murder') { e.inv.bow = 1; e.inv.arrows = 3; e.dirty = true; }
  if (r.game === 'ctf') { kitCTF(r, e); e.sword = 4; e.armor = 4; e.inv.fireball += 3; e.inv.pearl += 2; e.inv.gapple += 3; e.inv.arrows += 32; e.dirty = true; r.ev(['gear', e.id, 4, 4, 0]); }
  if (r.game === 'spleef') { e.inv.snow = 16; e.dirty = true; }
}
function skip(r, ms) {
  if (r.game === 'ctf' || r.game === 'duel' || r.game === 'murder') r.endAt -= ms;
  if (r.game === 'build') { if (r.phase === 'build') r.buildEnd -= ms; }
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
  const ai = e.ai, my = r.flags[e.team], en = r.flags[1 - e.team], base = r.map.bases[e.team % r.map.bases.length];
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


// ============================================================ DUELS
function duelBot(r, e, now) {
  if (!botCommon(r, e, now)) return;
  const ai = e.ai;
  let foe = null; for (const o of r.ents.values()) if (o !== e && !o.dead && !o.elim && !o.vanish) foe = o;
  if (!foe) { ai.enemy = null; return; }
  ai.enemy = foe;
  A.fight(r, e, now);
  // don't get kited along the edge forever: sidestep toward the middle sometimes
  if (now >= (ai.sideAt || 0)) { ai.sideAt = now + 900 + rnd() * 900; ai.side = rnd() < 0.5 ? -1 : 1; }
}
// ============================================================ MURDER MYSTERY
function goldDrop(r, x, y, fromDeath) {
  const i = tileOf(x, y);
  if (!(i >= 0 && i < N) || !r.map.g[i] || BW.solidAt(r.map, i % W, (i / W) | 0)) return false;
  const id = ++r.goldSeq;
  r.golds.set(id, { i, at: Date.now() });
  r.ev(['gold', id, i, 1]);
  return true; void fromDeath;
}
function murderTick(r, now) {
  if (now >= r.goldAt && r.golds.size < 14) {
    r.goldAt = now + 3500 + rnd() * 2500;
    for (let tries = 0; tries < 40; tries++) {
      const i = (rnd() * N) | 0;
      if (r.map.g[i] && !BW.solidAt(r.map, i % W, (i / W) | 0)) { goldDrop(r, (i % W) * T + T / 2, ((i / W) | 0) * T + T / 2); break; }
    }
  }
  // arrows slowly come back to whoever owns a bow
  for (const e of r.ents.values()) {
    if (e.dead || !(e.inv.bow > 0)) continue;
    if (!e.inv.arrows && now >= (e.arrowAt || 0)) {
      if (!e.arrowAt) { e.arrowAt = now + 9000; continue; }
      e.inv.arrows = 1; e.arrowAt = 0; e.dirty = true;
      if (e.conn) A.send(e.conn, { t: 'ann2', text: '🏹 Arrow ready' });
    }
  }
}
function murderEnt(r, e, now) {
  // pick up gold
  for (const [id, g] of r.golds) {
    const c = tcen(g.i);
    if (Math.hypot(c.x - e.x, c.y - e.y) > 26) continue;
    r.golds.delete(id);
    e.gold = (e.gold | 0) + 1; e.stats.gold++; e.dirty = true;
    r.ev(['gold', id, g.i, 0, e.id]);
    if (e.mrole !== 'm' && e.gold >= 10) {
      e.gold -= 10; e.inv.bow = 1; e.inv.arrows = Math.max(1, e.inv.arrows | 0); e.dirty = true;
      r.ev(['mbow', e.id]);
    }
  }
  // holding the knife makes every hit lethal
  if (e.mrole === 'm') e.onehit = e.held === 'knife' || e.held === 'sword';
}
function murderBot(r, e, now) {
  if (!botCommon(r, e, now)) return;
  const ai = e.ai, m = r.map;
  if (e.mrole === 'm') {
    if (now >= ai.thinkAt) {
      ai.thinkAt = now + 260 + rnd() * 200;
      let best = null, bd = 1e9, witnesses = 0;
      for (const o of r.ents.values()) { if (o === e || o.dead || o.vanish) continue; const d = dist(o, e); if (d < bd) { bd = d; best = o; } if (d < 7 * T) witnesses++; }
      const rampage = now >= r.endAt - 90000;
      const hunting = now >= (ai.coolAt || 0) && best && (witnesses <= 2 || bd < 2.2 * T || rampage);
      if (hunting) { e.held = 'knife'; ai.enemy = best; e.sprint = bd > 2 * T; }
      else { if (e.held === 'knife') e.held = 'fists'; ai.enemy = null; e.sprint = false; }
      if (ai.lastKillAt && now - ai.lastKillAt < 500) { ai.coolAt = now + (rampage ? 800 : 2500 + rnd() * 4000); e.held = 'fists'; e.sprint = false; ai.enemy = null; }
    }
    if (ai.enemy) { if (ai.enemy.dead) { ai.lastKillAt = now; ai.enemy = null; } else { A.fight(r, e, now); return; } }
    wanderBot(r, e, now); return;
  }
  // innocents & the detective
  if (now >= ai.thinkAt) {
    ai.thinkAt = now + 300 + rnd() * 240;
    const mur = [...r.ents.values()].find((o) => o.mrole === 'm');
    const seesKnife = mur && !mur.dead && (mur.held === 'knife' || mur.held === 'sword') && dist(mur, e) < 8.5 * T && A.clearLine(r, e, mur);
    if (seesKnife) { ai.knows = true; ai.fleeFrom = mur.id; }
    if (ai.knows && mur && !mur.dead && e.inv.bow > 0 && e.inv.arrows > 0) {
      const d = dist(mur, e);
      if (d < 9.5 * T && d > 1.2 * T && A.clearLine(r, e, mur) && now >= (ai.bowAt || 0)) {
        ai.bowAt = now + 2400;
        e.held = 'bow'; e.stats.shots++;
        A.shootBow(r, e, Math.atan2(mur.y - e.y, mur.x - e.x) + (rnd() - 0.5) * 0.17, 1, now);
        e.held = 'fists';
      }
    }
    if (ai.fleeFrom) {
      const f = r.ents.get(ai.fleeFrom);
      if (f && !f.dead && dist(f, e) < 7 * T) { ai.fleeing = { x: e.x + (e.x - f.x) * 3, y: e.y + (e.y - f.y) * 3 }; e.sprint = true; }
      else { ai.fleeing = null; e.sprint = false; }
    }
    if (!ai.fleeing && !ai.goldTgt) {
      let bg = null, bd = 8 * T; for (const [, g] of r.golds) { const c = tcen(g.i); const d = Math.hypot(c.x - e.x, c.y - e.y); if (d < bd) { bd = d; bg = c; } }
      if (bg && rnd() < 0.8) ai.goldTgt = bg;
    }
  }
  if (ai.fleeing) { A.moveToward(r, e, ai.fleeing.x, ai.fleeing.y, A.DT); e.mv = true; return; }
  if (ai.goldTgt) { const d = Math.hypot(ai.goldTgt.x - e.x, ai.goldTgt.y - e.y); if (d < 20) ai.goldTgt = null; else { A.moveToward(r, e, ai.goldTgt.x, ai.goldTgt.y, A.DT, 0.8); e.mv = true; return; } }
  wanderBot(r, e, now);
}
function wanderBot(r, e, now) {
  const ai = e.ai;
  if (ai.path) { const st = A.stepPath(r, e, now); if (st !== 'go') ai.path = null; return; }
  if (now >= (ai.wanderAt || 0)) {
    ai.wanderAt = now + 2500 + rnd() * 3500;
    const m = r.map, props = m.props && m.props.length ? m.props : null;
    let tgt = -1;
    if (props) tgt = freeTileNear(r, pick(props));
    else { const i = (rnd() * N) | 0; if (m.g[i] && !BW.solidAt(m, i % W, (i / W) | 0)) tgt = i; }
    if (tgt >= 0) { ai.path = A.pathTo(r, e, tgt, { bridge: false, mine: false }); ai.pi = 0; }
  }
}
// ============================================================ BUILD BATTLE
const BB_PREFABS = {
  house: { g: [['rect', 2, 4, 10, 11, 8]], w: [['ring', 2, 4, 10, 11, 2], ['gap', 6, 11], ['gap', 5, 11]], p: [[3, 6, 'pot'], [9, 6, 'lamp'], [4, 10, 'stool'], [8, 10, 'crate']] },
  garden: { g: [['rect', 1, 1, 11, 11, 1], ['rect', 5, 1, 7, 11, 4]], w: [], p: [[2, 3, 'bush'], [10, 3, 'bush'], [2, 9, 'pot'], [10, 9, 'pot'], [3, 6, 'lamp'], [9, 6, 'bush'], [6, 2, 'pot']] },
  snow: { g: [['rect', 1, 1, 11, 11, 9]], w: [], p: [[6, 6, 'snowman'], [3, 4, 'bush'], [9, 8, 'bush'], [9, 3, 'lamp'], [3, 9, 'crate']] },
  farm: { g: [['rect', 1, 2, 11, 10, 1], ['rect', 2, 3, 5, 9, 4], ['rect', 7, 3, 10, 9, 4]], w: [['ring', 1, 1, 11, 11, 2], ['gap', 6, 11], ['gap', 6, 1]], p: [[3, 5, 'hay'], [8, 5, 'pumpkin'], [3, 8, 'pumpkin'], [8, 8, 'hay'], [6, 6, 'barrel']] },
  spooky: { g: [['rect', 1, 1, 11, 11, 7]], w: [['ring', 4, 4, 8, 8, 3], ['gap', 6, 8]], p: [[6, 6, 'pumpkin'], [2, 2, 'pumpkin'], [10, 2, 'lamp'], [2, 10, 'trash'], [10, 10, 'pumpkin']] },
};
function bbPlanBot(r, e) {
  const pf = BB_PREFABS[{ Garden: 'garden', Farm: 'farm', 'Snowy Day': 'snow', 'Spooky Night': 'spooky' }[r.theme] || pick(Object.keys(BB_PREFABS))];
  const plot = r.map.plots[e.team]; if (!plot) return;
  const steps = [];
  const at = (dx, dy) => (plot.y0 + dy) * W + plot.x0 + dx;
  pf.g.forEach((q) => { if (q[0] === 'rect') for (let y = q[2]; y <= q[4]; y++) for (let x = q[1]; x <= q[3]; x++) steps.push(['g', at(x, y), q[5]]); });
  pf.w.forEach((q) => {
    if (q[0] === 'ring') { for (let x = q[1]; x <= q[3]; x++) { steps.push(['w', at(x, q[2]), q[5]]); steps.push(['w', at(x, q[4]), q[5]]); } for (let y = q[2] + 1; y < q[4]; y++) { steps.push(['w', at(q[1], y), q[5]]); steps.push(['w', at(q[3], y), q[5]]); } }
    if (q[0] === 'gap') steps.push(['w', at(q[1], q[2]), 0]);
  });
  pf.p.forEach((q) => steps.push(['p', at(q[0], q[1]), MG.PROP_KINDS.indexOf(q[2]) + 1]));
  e.ai.bbSteps = steps; e.ai.bbI = 0;
  e.ai.bbEvery = Math.max(120, (MG.GAMES.build.buildSec * 1000 * 0.75) / Math.max(1, steps.length));
  e.ai.bbAt = 0;
}
function bbApply(r, e, lay, i, v) {
  const m = r.map;
  if (!MG.inPlot(m, e.team, i)) return false;
  if (lay === 'g') { if (MG.BB_GROUNDS.indexOf(v) < 0) return false; m.g[i] = v; if (!v) { m.w[i] = 0; bbProp(m, i, 0); } }
  else if (lay === 'w') { if (v && (MG.BB_WALLS.indexOf(v) < 0 || !m.g[i])) return false; m.w[i] = v; m.wc[i] = e.team & 7; if (v) bbProp(m, i, 0); }
  else if (lay === 'p') { if (v && (!m.g[i] || m.w[i] || v < 1 || v > MG.PROP_KINDS.length)) return false; bbProp(m, i, v); }
  else return false;
  e.stats.placed++;
  r.ev(['bb', i, lay === 'g' ? 0 : lay === 'w' ? 2 : 3, v, e.team & 7]);
  return true;
}
function bbProp(m, i, v) {
  m.props = m.props || [];
  const k = m.props.findIndex((p) => p.tile === i);
  if (k >= 0) m.props.splice(k, 1);
  m.obj[i] = 0;
  if (v) { const c = tcen(i); m.props.push({ id: i, kind: MG.PROP_KINDS[v - 1], tile: i, x: c.x, y: c.y }); m.obj[i] = 3; }
}
function plotOwners(r) {
  const o = [];
  for (const e of r.ents.values()) if (e.team < r.map.plots.length) { const p = o[e.team]; if (!p) o[e.team] = { id: e.id, nick: e.nick, bot: !!e.bot, ids: [e.id] }; else { p.ids.push(e.id); p.nick = p.ids.length > 2 ? p.nick.split(' + ')[0] + ' + ' + (p.ids.length - 1) + ' more' : p.nick + ' + ' + e.nick; } }
  return o;
}
function buildTick(r, now) {
  const m = r.map;
  if (r.phase === 'build') {
    for (const e of r.ents.values()) {
      if (e.ctl === 'ai') {
        const ai = e.ai;
        if (ai.bbSteps && ai.bbI < ai.bbSteps.length && now >= ai.bbAt && now >= r.goAt) {
          ai.bbAt = now + ai.bbEvery * (0.6 + rnd() * 0.8);
          const st = ai.bbSteps[ai.bbI++];
          bbApply(r, e, st[0], st[1], st[2]);
          const c = tcen(st[1]); A.moveToward(r, e, c.x, c.y + T, A.DT * 6); e.ang = Math.atan2(c.y - e.y, c.x - e.x); e.mv = true;
        }
      } else {
        // keep humans on their own plot while building
        const p = m.plots[e.team];
        if (p) { e.x = clamp(e.x, (p.x0 - 1) * T + 14, (p.x1 + 2) * T - 14); e.y = clamp(e.y, (p.y0 - 1) * T + 14, (p.y1 + 2) * T - 14); }
      }
    }
    if (now >= r.buildEnd) {
      r.phase = 'vote';
      r.voteOrder = shuffle(r.map.plots.map((_, k) => k));
      r.voteIdx = -1; r.voteNext = now + 1200;
      r.ev(['bbphase', 'vote']);
    }
    return;
  }
  if (r.phase === 'vote') {
    if (now >= r.voteNext) {
      // tally votes bots cast for the plot that's ending
      if (r.voteIdx >= 0) finishPlotVote(r);
      r.voteIdx++;
      if (r.voteIdx >= r.voteOrder.length) { bbResults(r, now); return; }
      const plot = r.voteOrder[r.voteIdx], p = r.map.plots[plot];
      r.voteNext = now + MG.GAMES.build.voteSec * 1000;
      const owner = plotOwners(r)[plot];
      A.roomSend(r, { t: 'bbv', plot, idx: r.voteIdx, of: r.voteOrder.length, owner: owner ? owner.nick : '?', until: r.voteNext });
      // walk everyone to the plot being judged
      for (const e of r.ents.values()) { const tx = ((p.x0 + p.x1) / 2 + (rnd() - 0.5) * 6) * T, ty = (p.y1 + 2.2) * T + (rnd() - 0.5) * 40; e.x = tx; e.y = ty; e.vx = e.vy = 0; if (e.conn) A.send(e.conn, { t: 'pos', x: Math.round(tx), y: Math.round(ty) }); }
      // bots vote partway through
      for (const e of r.ents.values()) if (e.ctl === 'ai' && e.team !== plot) { e.ai.voteAt = now + 2000 + rnd() * 4000; e.ai.voted = false; }
    }
    const plot = r.voteOrder[r.voteIdx];
    for (const e of r.ents.values()) if (e.ctl === 'ai' && !e.ai.voted && e.ai.voteAt && now >= e.ai.voteAt && e.team !== plot) { e.ai.voted = true; bbVote(r, e, 2 + ((rnd() * 4) | 0)); }
  }
}
function finishPlotVote(r) {}
function bbVote(r, e, v) {
  if (r.phase !== 'vote' || r.voteIdx < 0) return;
  const plot = r.voteOrder[r.voteIdx];
  if (e.team === plot) return;
  const bucket = r.votes[plot];
  if (bucket.who.has(e.id)) return;
  bucket.who.add(e.id); bucket.sum += clamp(v | 0, 1, 5); bucket.n++;
  r.ev(['bbvote', e.id, plot]);
}
function bbResults(r, now) {
  r.phase = 'podium';
  const owners = plotOwners(r);
  r.results = r.map.plots.map((_, k) => {
    const b = r.votes[k], avg = b.n ? b.sum / b.n : 3;
    const o = owners[k] || {};
    return { plot: k, team: k, id: o.id || 0, nick: o.nick || '?', avg: Math.round(avg * 10) / 10 };
  }).sort((a, b) => b.avg - a.avg);
  r.results.forEach((q, k) => { for (const e of r.ents.values()) if (e.team === q.team) { e.stats.place = k + 1; e.stats.score = q.avg; } });
  r.podiumAt = now + 7000;
  A.roomSend(r, { t: 'bbr', results: r.results, theme: r.theme });
}
function bbMsg(r, e, m, now) {
  if (m.op === 'vote') { bbVote(r, e, m.v | 0); return; }
  if (r.phase !== 'build' || now < r.goAt) return;
  if (m.op === 'set') {
    const i = m.i | 0; if (!(i >= 0 && i < N)) return;
    const lay = m.lay === 'g' ? 'g' : m.lay === 'w' ? 'w' : m.lay === 'p' ? 'p' : '';
    if (!lay) return;
    bbApply(r, e, lay, i, m.v | 0);
  }
}

function lateJoin(r, e) {
  if (r.game === 'ctf') { e.stats = freshStats({ caps: 0, rets: 0 }); e.carry = -1; kitCTF(r, e); }
  else if (r.game === 'hide') { e.stats = freshStats({ finds: 0, taunts: 0, survived: 0 }); e.start = 1; setSeeker(r, e, false); }
  else if (r.game === 'murder') { e.mrole = 'i'; e.gold = 0; e.held = 'fists'; e.stats = freshStats({ gold: 0, shots: 0, role: 'i' }); }
  else return false;
  r.teamsDirty = true; return true;
}
export const MINI = { lateJoin, start, tick, die, respawn, checkEnd, isWinner, reward, endInfo, state, extra, snapExtra, swingBlocked, missProp, onMsg, snowHit, snowLand, adminInfo, kit, skip };
