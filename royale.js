// ============================================================
// ScrollHub Games — SCROLL ROYALE (server).
// A top-down battle royale: ride the battle bus, drop, loot chests and the floor, fight with
// rarity guns, heal/shield up, drive jeeps, smash everything, and outlast the storm.
// Runs on the Bedwars engine (rooms, bots, snapshots); minigames.js hands every 'royale' hook here.
// Health/shield are 0..100 (e.rhp / e.rsh); the engine's e.hp mirrors health on its 0..20 scale.
// ============================================================
const BW = globalThis.BW, MG = globalThis.MG;
const { T, W, H } = BW;
const N = W * H;
let A = null;
export function initRoyale(api) { A = api; }

const rnd = Math.random;
const pick = (a) => a[(rnd() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tileOf = (x, y) => Math.floor(y / T) * W + Math.floor(x / T);
const tcen = (i) => ({ x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2 });
const RW = () => MG.RW;
const PR = 17;            // player hit radius
const VR = 30;            // vehicle hit radius
const PICK_R = 58;        // pickup reach
const MELEE = { dmg: 20, rate: 420, reach: 58, obj: 34 };

function alive(r) { const a = []; for (const e of r.ents.values()) if (!e.dead && !e.elim) a.push(e); return a; }
function walkable(m, i) { return i >= 0 && i < N && !!m.g[i] && m.g[i] !== BW.G.ROCK && !m.w[i] && !m.obj[i]; }
function nearestWalkable(m, x, y) {
  const i0 = tileOf(x, y); if (walkable(m, i0)) return { x, y };
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  for (let rad = 1; rad < 20; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
    const i = (ty + dy) * W + tx + dx; if (BW.inb(tx + dx, ty + dy) && walkable(m, i)) return tcen(i);
  }
  return { x: 35.5 * T, y: 35.5 * T };
}

// ============================================================ start
export function start(r, addBot) {
  const now = Date.now(), m = r.map, GM = MG.GAMES.royale;
  const target = r.noBots ? Math.max(2, r.ents.size) : Math.max(GM.max, Math.min(24, r.ents.size + 6));
  while (r.ents.size < target) addBot(r.ents.size);
  let ti = 0; for (const e of r.ents.values()) e.team = ti++;
  r.teams = []; for (let t = 0; t < ti + 4; t++) r.teams.push({ bed: false, elim: false, up: { sharp: 0, prot: 0, forge: 0, haste: 0, heal: 0, trap: 0 } });
  // battle bus: a straight line across the island
  const a = rnd() * Math.PI * 2, c = 35.5 * T, R = 27 * T, off = (rnd() - 0.5) * 10 * T;
  const nx = -Math.sin(a), ny = Math.cos(a);
  const bus = { x0: c - Math.cos(a) * R + nx * off, y0: c - Math.sin(a) * R + ny * off, x1: c + Math.cos(a) * R + nx * off, y1: c + Math.sin(a) * R + ny * off, t0: r.goAt + 600, dur: MG.R_BUS_MS };
  const rg = r.rg = {
    bus, loot: new Map(), seq: 0, chests: [], objHp: new Map(), dead: new Set(), whp: new Map(), veh: [], pj: [], pjSeq: 0,
    z: { x: c, y: c, r: 52 * T, i: 0, mode: 'wait', t0: r.goAt, from: null, to: null }, znDirty: true, quiet: true,
  };
  // chests in buildings + a few in the wild
  const spots = m.chestSpots.slice();
  for (let k = 0; k < 8; k++) { const i = pick(m.lootSpots); if (walkable(m, i)) spots.push(i); }
  spots.forEach((i, k) => { if (!walkable(m, i) && !(m.g[i] === BW.G.FLOOR && !m.w[i] && !m.obj[i])) return; const p = tcen(i); rg.chests.push({ id: k + 1, x: p.x, y: p.y, open: false }); });
  // floor loot
  for (const i of m.lootSpots) { if (rnd() < 0.82) { const p = tcen(i); floorLoot(r, p.x + (rnd() - 0.5) * 14, p.y + (rnd() - 0.5) * 14); } }
  // jeeps
  const VK = ['tank', 'jeep', 'car', 'jeep', 'car', 'tank', 'car', 'jeep'];
  m.vehSpots.slice(0, 8).forEach((i, k) => { const p = tcen(i), kind = VK[k % VK.length]; rg.veh.push({ id: k + 1, kind, x: p.x, y: p.y, ang: rnd() * 6.28, tur: 0, hp: MG.RVEH[kind].hp, driver: 0, vx: 0, vy: 0, cd: 0 }); });
  rg.quiet = false;
  planZone(r);
  for (const e of r.ents.values()) {
    e.rhp = 100; e.rsh = 0; e.hp = BW.MAX_HP; e.absorb = 0; e.inv = A.emptyInv(); e.held = 'pickaxe'; e.sword = 1; e.armor = 1;
    e.rs = { slots: [null, null, null, null, null], sel: -1, am: { L: 0, M: 0, S: 0, H: 0, R: 0 }, st: 'bus', glideEnd: 0, rlEnd: 0, rlSlot: -1, use: null, cd: 0, burst: 0, veh: 0, lastHit: {}, kills: 0, dmg: 0 };
    e.stats = { kills: 0, finals: 0, beds: 0, deaths: 0, place: 0, dmg: 0, shots: 0 };
    e.god = true; // on the bus
    const bp = busPos(r, now); e.x = bp.x; e.y = bp.y;
    if (e.ai) { e.ai.jumpAt = bus.t0 + bus.dur * (0.12 + rnd() * 0.7); e.ai.thinkAt = 0; e.ai.path = null; }
    e.rgDirty = true;
  }
}
export function busPos(r, now) {
  const b = r.rg.bus, k = clamp((now - b.t0) / b.dur, 0, 1);
  return { x: b.x0 + (b.x1 - b.x0) * k, y: b.y0 + (b.y1 - b.y0) * k, k };
}

// ============================================================ loot
function rollRar(w) { const x = rnd(); let a = 0; for (let i = 0; i < w.length; i++) { a += w[i]; if (x < a) return i; } return 0; }
const FLOOR_W = [0.48, 0.3, 0.16, 0.05, 0.01], CHEST_W = [0.12, 0.33, 0.33, 0.16, 0.06], CRATE_W = [0.3, 0.38, 0.22, 0.08, 0.02];
const GUN_POOL = ['pistol', 'pistol', 'smg', 'smg', 'ar', 'ar', 'ar', 'burst', 'shotgun', 'shotgun', 'tac', 'sniper', 'minigun', 'rocket'];
function rollGun(w) {
  for (let tries = 0; tries < 10; tries++) {
    const k = pick(GUN_POOL), w0 = RW()[k]; let rar = rollRar(w);
    if (w0.minR) { if (rar < w0.minR) { if (rnd() < 0.85) continue; rar = w0.minR; } }
    return { k, r: rar, a: w0.mag };
  }
  return { k: 'pistol', r: 0, a: RW().pistol.mag };
}
function spawnItem(r, x, y, it, scatter) {
  const m = r.map; let px = x, py = y;
  for (let q = 0; q < 10; q++) {
    const ang = rnd() * 6.283, rad = scatter ? 14 + rnd() * 30 : (q ? 10 + q * 6 : 0);
    const tx = x + Math.cos(ang) * rad, ty = y + Math.sin(ang) * rad;
    if (walkable(r.map, tileOf(tx, ty)) || (m.g[tileOf(tx, ty)] === BW.G.FLOOR && !m.w[tileOf(tx, ty)] && !m.obj[tileOf(tx, ty)])) { px = tx; py = ty; break; }
  }
  const o = { id: ++r.rg.seq, x: Math.round(px), y: Math.round(py), k: it.k, r: it.r | 0, n: it.n | 0, a: it.a == null ? -1 : it.a };
  r.rg.loot.set(o.id, o);
  if (!r.rg.quiet) r.ev(['rl', o.id, o.x, o.y, o.k, o.r, o.n, o.a]);
  return o;
}
function ammoFor(k) { const w = RW()[k]; return w && w.am; }
function floorLoot(r, x, y) {
  const q = rnd();
  if (q < 0.42) { const g = rollGun(FLOOR_W); spawnItem(r, x, y, g); if (rnd() < 0.7) spawnItem(r, x, y, { k: 'am_' + ammoFor(g.k), n: MG.RAMMO[ammoFor(g.k)].box }, true); }
  else if (q < 0.7) { const a = pick(['L', 'L', 'M', 'M', 'S', 'H']); spawnItem(r, x, y, { k: 'am_' + a, n: MG.RAMMO[a].box }); }
  else if (q < 0.82) spawnItem(r, x, y, { k: pick(['bandage', 'bandage', 'minishield', 'minishield', 'shieldpot', 'medkit']), n: 0 });
  else if (q < 0.9) spawnItem(r, x, y, { k: 'grenade', n: 2 });
  else spawnItem(r, x, y, { k: pick(['bandage', 'minishield']), n: 0 });
}
function chestLoot(r, x, y, w) {
  const g = rollGun(w || CHEST_W); spawnItem(r, x, y, g, true);
  spawnItem(r, x, y, { k: 'am_' + ammoFor(g.k), n: MG.RAMMO[ammoFor(g.k)].box * 2 }, true);
  spawnItem(r, x, y, { k: 'am_' + pick(['L', 'M', 'S']), n: 0 }, true);
  spawnItem(r, x, y, { k: pick(['minishield', 'shieldpot', 'bandage', 'medkit', 'shieldpot']), n: 0 }, true);
  if (rnd() < 0.35) spawnItem(r, x, y, { k: 'grenade', n: 2 }, true);
}
function healCount(k) { const w = RW()[k]; return w.cls === 'heal' ? ({ bandage: 5, medkit: 1, minishield: 3, shieldpot: 1 })[k] : w.cls === 'throw' ? 2 : 1; }
function itemFromLoot(o) {
  const w = RW()[o.k];
  if (w.cls === 'gun') return { k: o.k, r: o.r, a: o.a >= 0 ? o.a : w.mag };
  return { k: o.k, r: 0, n: o.n || healCount(o.k) };
}
function lootFromItem(it) { const w = RW()[it.k]; return w.cls === 'gun' ? { k: it.k, r: it.r, a: it.a } : { k: it.k, n: it.n }; }
function freeSlot(rs) { for (let i = 0; i < MG.RSLOTS; i++) if (!rs.slots[i]) return i; return -1; }
// pick something up; returns true if the floor item was taken (fully)
function grab(r, e, o, force) {
  const rs = e.rs;
  if (o.k.startsWith('am_')) {
    const a = o.k.slice(3), cap = MG.RAMMO[a].max, n = o.n || MG.RAMMO[a].box, take = Math.min(n, cap - rs.am[a]);
    if (take <= 0) return false;
    rs.am[a] += take; e.rgDirty = true;
    if (take < n) { o.n = n - take; r.ev(['rln', o.id, o.n]); return false; }
    r.rg.loot.delete(o.id); r.ev(['rx', o.id, e.id]); return true;
  }
  const w = RW()[o.k]; if (!w) return false;
  const it = itemFromLoot(o);
  if (w.cls !== 'gun') { // stack onto an existing stack first
    for (let i = 0; i < MG.RSLOTS; i++) { const s = rs.slots[i]; if (s && s.k === it.k && s.n < w.max) { const add = Math.min(it.n, w.max - s.n); s.n += add; it.n -= add; e.rgDirty = true; } }
    if (it.n <= 0) { r.rg.loot.delete(o.id); r.ev(['rx', o.id, e.id]); return true; }
  }
  let slot = freeSlot(rs);
  if (slot < 0) {
    if (!force) { if (it.n !== (o.n || healCount(o.k))) { o.n = it.n; r.ev(['rln', o.id, o.n]); } return false; }
    slot = rs.sel >= 0 ? rs.sel : 0;
    const old = rs.slots[slot]; if (old) { const dr = spawnItem(r, e.x, e.y, lootFromItem(old), true); dr.dropBy = e.id; dr.at = Date.now(); }
  }
  rs.slots[slot] = it; r.rg.loot.delete(o.id); r.ev(['rx', o.id, e.id]);
  if (rs.sel < 0 || !rs.slots[rs.sel] || force) select(r, e, slot);
  e.rgDirty = true; return true;
}
function select(r, e, s) {
  const rs = e.rs; if (s < -1 || s >= MG.RSLOTS) return;
  rs.sel = s; rs.use = null; if (rs.rlSlot >= 0 && rs.rlSlot !== s) { rs.rlEnd = 0; rs.rlSlot = -1; }
  const it = s >= 0 ? rs.slots[s] : null;
  e.held = it ? it.k : 'pickaxe'; rs.burst = 0; e.rgDirty = true;
}
function dropAll(r, e) {
  const rs = e.rs; if (!rs) return;
  rs.slots.forEach((it) => { if (it) spawnItem(r, e.x, e.y, lootFromItem(it), true); });
  for (const a in rs.am) if (rs.am[a] > 0) spawnItem(r, e.x, e.y, { k: 'am_' + a, n: rs.am[a] }, true);
  rs.slots = [null, null, null, null, null]; rs.am = { L: 0, M: 0, S: 0, H: 0, R: 0 };
}

// ============================================================ damage
function hurt(r, v, dmg, att, kind) {
  if (v.dead || v.elim || v.god || dmg <= 0) return 0;
  const rs = v.rs; let sh = 0;
  if (rs.st !== 'ground') return 0;
  if (v.rsh > 0) { sh = Math.min(v.rsh, dmg); v.rsh -= sh; dmg -= sh; }
  v.rhp -= dmg; v.hp = Math.max(0, v.rhp / 5); v.lastDmgAt = Date.now(); v.dirty = true; v.rgDirty = true;
  if (rs.use) { rs.use = null; } // getting hit cancels healing
  if (att && att !== v) { v.lastHitBy = att.id; v.lastHitAt = Date.now(); att.stats.dmg = (att.stats.dmg | 0) + Math.round(sh + dmg); }
  r.ev(['rd', v.id, Math.round(dmg), Math.round(sh), att ? att.id : 0, v.rsh <= 0 && sh > 0 ? 1 : 0]);
  if (v.ai && att && att !== v) { v.ai.foe = att.id; v.ai.foeAt = Date.now(); }
  if (v.rhp <= 0) { v.rhp = 0; A.die(r, v, kind || 'gun', att || null); }
  return sh + dmg;
}
function hurtObj(r, o, dmg, by) {
  const rg = r.rg; if (rg.dead.has(o.id)) return;
  const def = MG.R_OBJ[o.kind], hp = (rg.objHp.has(o.id) ? rg.objHp.get(o.id) : def.hp) - dmg;
  if (hp > 0) { rg.objHp.set(o.id, hp); r.ev(['ro', o.id, Math.round(hp)]); return; }
  rg.dead.add(o.id); rg.objHp.delete(o.id); r.map.obj[o.i] = 0; r.ev(['ro', o.id, 0]);
  const p = tcen(o.i);
  if (def.loot) { if (rnd() < 0.75) chestLoot(r, p.x, p.y, CRATE_W); }
  if (def.boom) setTimeout(() => { if (r.state === 'play') explode(r, p.x, p.y, 105, 55, by, 'barrel'); }, 120);
}
function hurtWall(r, i, dmg) {
  const m = r.map; if (!m.w[i]) return;
  if (m.w[i] !== 2) return; // only wood breaks
  const hp = (r.rg.whp.has(i) ? r.rg.whp.get(i) : MG.R_WALL_HP) - dmg;
  if (hp > 0) { r.rg.whp.set(i, hp); r.ev(['rw', i, Math.round(hp)]); return; }
  r.rg.whp.delete(i); A.setTile(r, i, 0, 0, 0, 0);
}
const VD = (v) => MG.RVEH[v.kind] || MG.RVEH.jeep;
function hurtVeh(r, v, dmg, by) {
  if (v.hp <= 0) return; v.hp -= dmg; r.ev(['rvh', v.id, Math.max(0, Math.round(v.hp))]);
  if (v.hp <= 0) {
    const d = v.driver && r.ents.get(v.driver); if (d) exitVeh(r, d, true);
    setTimeout(() => { if (r.state === 'play') explode(r, v.x, v.y, v.kind === 'tank' ? 150 : 120, v.kind === 'tank' ? 90 : 70, by, 'jeep'); }, 60);
    r.rg.veh = r.rg.veh.filter((q) => q !== v); r.ev(['rvx', v.id]);
  }
}
function explode(r, x, y, rad, dmg, owner, kind) {
  const att = owner ? r.ents.get(owner) : null;
  r.ev(['rboom', Math.round(x), Math.round(y), rad, kind === 'rocket' ? 1 : kind === 'grenade' ? 2 : 0]);
  for (const v of r.ents.values()) {
    if (v.dead || v.elim || !v.rs || v.rs.st !== 'ground') continue;
    const d = Math.hypot(v.x - x, v.y - 16 - y); if (d > rad) continue;
    if (!losClear(r.map, x, y, v.x, v.y - 16)) continue;
    hurt(r, v, dmg * (1 - 0.6 * d / rad), att, kind);
  }
  const tx0 = Math.floor((x - rad) / T), tx1 = Math.floor((x + rad) / T), ty0 = Math.floor((y - rad) / T), ty1 = Math.floor((y + rad) / T);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!BW.inb(tx, ty)) continue; const i = ty * W + tx, c = tcen(i), d = Math.hypot(c.x - x, c.y - y); if (d > rad) continue;
    const f = 1 - 0.5 * d / rad;
    if (r.map.obj[i] === 9) { const o = MG.rObjAt(r.map, i); if (o) hurtObj(r, o, dmg * 2.2 * f, owner); }
    else if (r.map.w[i]) hurtWall(r, i, dmg * 2.4 * f);
  }
  for (const v of r.rg.veh.slice()) { const d = Math.hypot(v.x - x, v.y - y); if (d < rad + VD(v).r) hurtVeh(r, v, dmg * 1.5 * (1 - 0.5 * Math.min(1, d / rad)), owner); }
}
function losClear(m, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 14);
  for (let k = 1; k < n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n, tx = Math.floor(x / T), ty = Math.floor((y + 16) / T); if (BW.inb(tx, ty) && (m.w[ty * W + tx] || m.obj[ty * W + tx] === 9)) return false; }
  return true;
}

// ============================================================ shooting (hitscan with tracers)
function castRay(r, e, x0, y0, ang, range) {
  const m = r.map, dx = Math.cos(ang), dy = Math.sin(ang);
  // walls / objects: march along the ray
  let wallD = range, hitTile = -1;
  for (let d = 8; d < range; d += 6) {
    const x = x0 + dx * d, y = y0 + dy * d + 16, tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (!BW.inb(tx, ty)) { wallD = d; break; }
    const i = ty * W + tx;
    if (m.w[i] || m.obj[i] === 9 || m.g[i] === BW.G.ROCK) {
      const o = m.obj[i] === 9 ? MG.rObjAt(m, i) : null;
      if (o && MG.R_OBJ[o.kind].soft) { continue; } // bushes don't stop bullets
      wallD = d; hitTile = i; break;
    }
  }
  // players and vehicles: closest along the ray before the wall
  let best = null, bestD = wallD, bestVeh = null;
  for (const v of r.ents.values()) {
    if (v === e || v.dead || v.elim || !v.rs || v.rs.st !== 'ground' || v.rs.veh) continue;
    const px = v.x - x0, py = v.y - 16 - y0, t = px * dx + py * dy; if (t < 0 || t > bestD) continue;
    const off = Math.abs(px * dy - py * dx); if (off < PR) { best = v; bestD = t; bestVeh = null; }
  }
  for (const v of r.rg.veh) {
    if (e.rs.veh === v.id) continue;
    const px = v.x - x0, py = v.y - 10 - y0, t = px * dx + py * dy; if (t < 0 || t > bestD) continue;
    if (Math.abs(px * dy - py * dx) < VD(v).r) { bestVeh = v; best = null; bestD = t; }
  }
  return { d: bestD, ent: best, veh: bestVeh, tile: best || bestVeh ? -1 : hitTile };
}
function fire(r, e, ang, now) {
  const rs = e.rs; if (rs.st !== 'ground' || now < r.goAt) return false;
  if (rs.veh) return tankFire(r, e, ang, now);
  const it = rs.sel >= 0 ? rs.slots[rs.sel] : null;
  if (!it) return melee(r, e, ang, now);
  const w = RW()[it.k];
  if (w.cls === 'heal') return startUse(r, e, now);
  if (w.cls === 'throw') return throwNade(r, e, ang, now);
  if (now < rs.cd || rs.rlEnd) return false;
  if (it.a <= 0) { startReload(r, e, now); return false; }
  rs.use = null;
  const rar = MG.RRAR[it.r] || MG.RRAR[0];
  it.a--; rs.cd = now + w.rate - (e.ctl === 'human' ? 12 : 0); e.rgDirty = true; e.stats.shots = (e.stats.shots | 0) + 1; e.ang = ang;
  if (w.burst) { rs.burst = (rs.burst || 0) + 1; if (rs.burst < w.burst && it.a > 0) rs.cd = now + 85; else rs.burst = 0; }
  const x0 = e.x + Math.cos(ang) * 22, y0 = e.y - 16 + Math.sin(ang) * 22;
  if (w.proj) { // rocket
    r.rg.pj.push({ id: ++r.rg.pjSeq, k: 'rocket', x: x0, y: y0, vx: Math.cos(ang) * w.proj, vy: Math.sin(ang) * w.proj, owner: e.id, life: w.rg / w.proj, dmg: w.dmg * rar.dm, blast: w.blast });
    r.ev(['rsh', e.id, it.k]);
  } else {
    const pel = w.pel || 1, spread = w.sp * (e.mv ? 1.25 : 1) * (e.ctl === 'ai' ? 1.25 : 1), shots = [];
    for (let p = 0; p < pel; p++) {
      const a = ang + (pel > 1 ? (p / (pel - 1) - 0.5) * spread * 2 + (rnd() - 0.5) * spread * 0.5 : (rnd() - 0.5) * 2 * spread);
      const hit = castRay(r, e, x0, y0, a, w.rg);
      const fall = hit.d > w.rg * 0.6 ? 1 - 0.35 * (hit.d - w.rg * 0.6) / (w.rg * 0.4) : 1;
      const dmg = w.dmg * rar.dm * fall;
      if (hit.ent) hurt(r, hit.ent, dmg, e, 'gun');
      else if (hit.veh) hurtVeh(r, hit.veh, dmg, e.id);
      else if (hit.tile >= 0) { if (r.map.obj[hit.tile] === 9) { const o = MG.rObjAt(r.map, hit.tile); if (o) hurtObj(r, o, dmg, e.id); } else if (r.map.w[hit.tile]) hurtWall(r, hit.tile, dmg * 0.6); }
      shots.push(Math.round(x0 + Math.cos(a) * hit.d), Math.round(y0 + Math.sin(a) * hit.d), hit.ent || hit.veh ? 1 : 0);
    }
    r.ev(['rs', e.id, it.k, Math.round(x0), Math.round(y0), shots]);
  }
  if (it.a <= 0 && rs.am[w.am] > 0) startReload(r, e, now + 250);
  return true;
}
function melee(r, e, ang, now) {
  const rs = e.rs; if (now < rs.cd) return false;
  rs.cd = now + MELEE.rate; e.ang = ang; r.ev(['rm', e.id]);
  let best = null, bd = MELEE.reach;
  for (const v of r.ents.values()) {
    if (v === e || v.dead || v.elim || !v.rs || v.rs.st !== 'ground' || v.rs.veh) continue;
    const d = dist(v, e); if (d > bd) continue;
    let da = Math.atan2(v.y - e.y, v.x - e.x) - ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
    if (Math.abs(da) < 1) { best = v; bd = d; }
  }
  if (best) { hurt(r, best, MELEE.dmg, e, 'melee'); return true; }
  // harvest: hit the object / wall in front
  const fx = e.x + Math.cos(ang) * 40, fy = e.y + Math.sin(ang) * 40 - 6, i = tileOf(fx, fy);
  if (r.map.obj[i] === 9) { const o = MG.rObjAt(r.map, i); if (o) hurtObj(r, o, MELEE.obj, e.id); }
  else if (r.map.w[i]) hurtWall(r, i, MELEE.obj);
  return true;
}
function startReload(r, e, now) {
  const rs = e.rs, it = rs.sel >= 0 ? rs.slots[rs.sel] : null; if (!it) return;
  const w = RW()[it.k]; if (w.cls !== 'gun' || it.a >= w.mag || rs.am[w.am] <= 0 || rs.rlEnd) return;
  const rar = MG.RRAR[it.r] || MG.RRAR[0];
  rs.rlEnd = now + w.rl * rar.rl; rs.rlSlot = rs.sel; rs.use = null; e.rgDirty = true; r.ev(['rr', e.id]);
}
function finishReload(r, e) {
  const rs = e.rs, it = rs.slots[rs.rlSlot]; rs.rlEnd = 0;
  if (it && rs.rlSlot === rs.sel) { const w = RW()[it.k], need = w.mag - it.a, take = Math.min(need, rs.am[w.am]); it.a += take; rs.am[w.am] -= take; }
  rs.rlSlot = -1; e.rgDirty = true;
}
function startUse(r, e, now) {
  const rs = e.rs, it = rs.slots[rs.sel]; if (!it || rs.use) return false;
  const w = RW()[it.k];
  if (w.hp && e.rhp >= w.cap) { if (e.conn) A.send(e.conn, { t: 'rgmsg', text: w.cap < 100 ? 'Bandages only heal up to ' + w.cap : 'Health is full' }); return false; }
  if (w.sh && e.rsh >= w.cap) { if (e.conn) A.send(e.conn, { t: 'rgmsg', text: w.cap < 100 ? 'Small shields only go up to ' + w.cap : 'Shield is full' }); return false; }
  rs.use = { slot: rs.sel, end: now + w.use, k: it.k }; rs.rlEnd = 0; e.rgDirty = true; r.ev(['ru', e.id, it.k, w.use]);
  return true;
}
function finishUse(r, e) {
  const rs = e.rs, u = rs.use; rs.use = null;
  const it = rs.slots[u.slot]; if (!it || it.k !== u.k) return;
  const w = RW()[it.k];
  if (w.hp) e.rhp = Math.min(w.cap, e.rhp + w.hp), e.hp = e.rhp / 5;
  if (w.sh) e.rsh = Math.min(w.cap, e.rsh + w.sh);
  it.n--; if (it.n <= 0) { rs.slots[u.slot] = null; select(r, e, rs.sel); }
  e.rgDirty = true; e.dirty = true; r.ev(['rh', e.id, w.hp ? 1 : 2]);
}
function throwNade(r, e, ang, now) {
  const rs = e.rs, it = rs.slots[rs.sel]; if (!it || now < rs.cd) return false;
  const w = RW()[it.k]; rs.cd = now + 700;
  const sp = 520;
  r.rg.pj.push({ id: ++r.rg.pjSeq, k: 'grenade', x: e.x + Math.cos(ang) * 18, y: e.y - 16 + Math.sin(ang) * 18, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: e.id, life: w.fuse / 1000, dmg: w.dmg, blast: w.blast, bounce: true });
  it.n--; if (it.n <= 0) { rs.slots[rs.sel] = null; select(r, e, rs.sel); }
  e.rgDirty = true; r.ev(['rt', e.id]); return true;
}
function tickProj(r, now, DT) {
  const m = r.map, pj = r.rg.pj;
  for (let k = pj.length - 1; k >= 0; k--) {
    const p = pj[k]; let boom = false;
    p.life -= DT;
    const steps = 3;
    for (let s = 0; s < steps && !boom; s++) {
      const nx = p.x + p.vx * DT / steps, ny = p.y + p.vy * DT / steps, tx = Math.floor(nx / T), ty = Math.floor((ny + 16) / T), i = ty * W + tx;
      const solid = !BW.inb(tx, ty) || m.w[i] || (m.obj[i] === 9 && !(MG.rObjAt(m, i) && MG.R_OBJ[MG.rObjAt(m, i).kind].soft)) || m.g[i] === BW.G.ROCK;
      if (solid) {
        if (p.bounce) { const sx = Math.floor((nx) / T) !== Math.floor(p.x / T), sy = Math.floor((ny + 16) / T) !== Math.floor((p.y + 16) / T); if (sx) p.vx *= -0.5; if (sy || !sx) p.vy *= -0.5; continue; }
        boom = true; break;
      }
      p.x = nx; p.y = ny;
      if (p.k === 'rocket' || p.k === 'shell') {
        for (const v of r.ents.values()) { if (v.id === p.owner || v.dead || v.elim || !v.rs || v.rs.st !== 'ground') continue; if (Math.hypot(v.x - p.x, v.y - 16 - p.y) < PR + 4) { boom = true; break; } }
        for (const v of r.rg.veh) if (v.id !== p.veh && Math.hypot(v.x - p.x, v.y - 10 - p.y) < VD(v).r) boom = true;
      }
    }
    if (p.bounce) { const f = Math.exp(-2.2 * DT); p.vx *= f; p.vy *= f; }
    if (p.life <= 0) boom = true;
    if (boom) { pj.splice(k, 1); explode(r, p.x, p.y + 4, p.blast, p.dmg, p.owner, p.k); }
  }
}

// ============================================================ vehicles
function tankFire(r, e, ang, now) {
  const v = r.rg.veh.find((q) => q.id === e.rs.veh); if (!v || v.kind !== 'tank' || now < v.cd) return false;
  const g = MG.RVEH.tank.gun; v.cd = now + g.cd; v.tur = ang;
  r.rg.pj.push({ id: ++r.rg.pjSeq, k: 'shell', x: v.x + Math.cos(ang) * 46, y: v.y - 14 + Math.sin(ang) * 46, vx: Math.cos(ang) * g.sp, vy: Math.sin(ang) * g.sp, owner: e.id, veh: v.id, life: 1.4, dmg: g.dmg, blast: g.blast });
  r.ev(['rtf', v.id, Math.round(ang * 100)]); return true;
}
function enterVeh(r, e, v) {
  if (v.driver || e.rs.veh) return false;
  v.driver = e.id; e.rs.veh = v.id; e.rs.use = null; e.rs.rlEnd = 0; e.x = v.x; e.y = v.y; e.rgMul = VD(v).sp; e.rgDirty = true;
  if (e.conn) A.send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) });
  r.ev(['rve', v.id, e.id]); return true;
}
function exitVeh(r, e, blown) {
  const v = r.rg.veh.find((q) => q.id === e.rs.veh); e.rs.veh = 0; e.rgMul = 1; e.rgDirty = true;
  if (v) { v.driver = 0; r.ev(['rve', v.id, 0]); }
  const p = nearestWalkable(r.map, e.x + Math.cos(e.ang + 1.57) * 44, e.y + Math.sin(e.ang + 1.57) * 44);
  e.x = p.x; e.y = p.y; if (e.conn) A.send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) });
  void blown;
}
function tickVeh(r, now, DT) {
  for (const v of r.rg.veh) {
    const d = v.driver && r.ents.get(v.driver);
    if (!d || d.dead || d.elim) { if (v.driver) { v.driver = 0; r.ev(['rve', v.id, 0]); } continue; }
    const dx = d.x - v.x, dy = d.y - v.y, sp = Math.hypot(dx, dy) / DT;
    if (Math.hypot(dx, dy) > 0.5) v.ang = Math.atan2(dy, dx);
    v.x = d.x; v.y = d.y; v.sp = sp; v.tur = d.ang || v.tur;
    if (v.kind === 'tank' && sp > 60) { const ti = tileOf(v.x + Math.cos(v.ang) * 40, v.y + Math.sin(v.ang) * 40); if (r.map.obj[ti] === 9) { const o = MG.rObjAt(r.map, ti); if (o) hurtObj(r, o, 400, d.id); } }
    if (sp > (v.kind === 'tank' ? 100 : 260)) for (const o of r.ents.values()) { // run people over
      if (o === d || o.dead || o.elim || !o.rs || o.rs.st !== 'ground' || o.rs.veh) continue;
      if (Math.hypot(o.x - v.x, o.y - v.y) < VD(v).r + PR - 4 && now - (v.hitAt && v.hitAt[o.id] || 0) > 700) {
        (v.hitAt || (v.hitAt = {}))[o.id] = now; hurt(r, o, VD(v).ram, d, 'jeep');
        o.vx += Math.cos(v.ang) * 420; o.vy += Math.sin(v.ang) * 420; o.kbBudget += 300;
        if (o.conn) A.send(o.conn, { t: 'kb', vx: Math.round(Math.cos(v.ang) * 420), vy: Math.round(Math.sin(v.ang) * 420) });
      }
    }
  }
}

// ============================================================ storm
function planZone(r) {
  const z = r.rg.z, s = MG.R_STORM[z.i];
  if (!s) { z.to = { x: z.x, y: z.y, r: 0 }; return; }
  const m = r.map; let tx = z.x, ty = z.y;
  for (let tries = 0; tries < 30; tries++) {
    const a = rnd() * 6.283, d = rnd() * Math.max(0, z.r - s.r * T) * 0.7;
    const x = clamp(z.x + Math.cos(a) * d, 10 * T, 62 * T), y = clamp(z.y + Math.sin(a) * d, 10 * T, 62 * T);
    if (m.g[tileOf(x, y)] && m.g[tileOf(x, y)] !== BW.G.ROCK) { tx = x; ty = y; break; }
  }
  z.to = { x: tx, y: ty, r: s.r * T }; r.rg.znDirty = true;
}
function zoneTick(r, now) {
  const z = r.rg.z, s = MG.R_STORM[z.i];
  if (!s) return;
  if (z.mode === 'wait') {
    if (now >= z.t0 + s.w * 1000) { z.mode = 'shrink'; z.t0 = now; z.from = { x: z.x, y: z.y, r: z.r }; A.roomSend(r, { t: 'ann2', text: '🌪️ The storm is closing in!' }); r.rg.znDirty = true; }
  } else {
    const k = Math.min(1, (now - z.t0) / (s.s * 1000));
    z.x = z.from.x + (z.to.x - z.from.x) * k; z.y = z.from.y + (z.to.y - z.from.y) * k; z.r = z.from.r + (z.to.r - z.from.r) * k;
    if (k >= 1) { z.i++; z.mode = 'wait'; z.t0 = now; planZone(r); r.rg.znDirty = true; }
  }
}
function zoneMsg(r) {
  const z = r.rg.z, s = MG.R_STORM[z.i], X = Math.round, dmg = (MG.R_STORM[Math.min(z.i, MG.R_STORM.length - 1)] || { d: 10 }).d;
  if (!s) return [0, z.t0, 0, X(z.x), X(z.y), X(z.r), X(z.x), X(z.y), X(z.r), z.i, dmg];
  if (z.mode === 'shrink') return [1, z.t0, s.s * 1000, X(z.from.x), X(z.from.y), X(z.from.r), X(z.to.x), X(z.to.y), X(z.to.r), z.i, dmg];
  return [0, z.t0, s.w * 1000, X(z.x), X(z.y), X(z.r), X(z.to.x), X(z.to.y), X(z.to.r), z.i, dmg];
}
function inStorm(r, e) { const z = r.rg.z; return Math.hypot(e.x - z.x, e.y - z.y) > z.r; }

// ============================================================ per tick
export function tick(r, now) {
  const DT = A.DT, rg = r.rg;
  if (now >= r.goAt) zoneTick(r, now);
  const bp = busPos(r, now);
  for (const e of r.ents.values()) {
    if (e.dead || e.elim) continue;
    const rs = e.rs;
    if (rs.st === 'bus') {
      e.x = bp.x; e.y = bp.y; e.mv = false;
      if (bp.k >= 0.97 && now >= rg.bus.t0) jump(r, e, now);
      else if (e.ai && now >= e.ai.jumpAt) jump(r, e, now);
      continue;
    }
    if (rs.st === 'glide') {
      if (e.ai) { const g = e.ai.landAt || (e.ai.landAt = nearestWalkable(r.map, e.x + (rnd() - 0.5) * 300, e.y + (rnd() - 0.5) * 300)); A.moveToward(r, e, g.x, g.y, DT, 1.6); }
      if (now >= rs.glideEnd) land(r, e);
      continue;
    }
    if (e.ctl === 'ai') { A.physics(r, e, DT); bot(r, e, now); }
    else e.kbBudget *= 0.86;
    if (rs.rlEnd && now >= rs.rlEnd) finishReload(r, e);
    if (rs.use) { if (now >= rs.use.end) finishUse(r, e); else if (e.mv && e.sprint) { rs.use = null; e.rgDirty = true; } }
    // storm damage
    if (inStorm(r, e) && now >= r.goAt) {
      e.stormAcc = (e.stormAcc || 0) + DT;
      if (e.stormAcc >= 1) { e.stormAcc -= 1; const d = (MG.R_STORM[Math.min(rg.z.i, MG.R_STORM.length - 1)] || { d: 10 }).d; e.lastHitBy = 0; hurtStorm(r, e, d); }
    } else e.stormAcc = 0;
    // auto-pickup ammo you walk over
    if (now - (e.apAt || 0) > 150) {
      e.apAt = now;
      for (const o of rg.loot.values()) if (o.k.startsWith('am_') && Math.hypot(o.x - e.x, o.y - e.y) < 30) grab(r, e, o, false);
    }
    if (e.rgDirty && e.conn) { e.rgDirty = false; A.send(e.conn, meMsg(r, e)); }
    if (e.dirty && e.conn && Math.ceil(e.hp) !== e.lastHp) { e.lastHp = Math.ceil(e.hp); }
  }
  tickProj(r, now, DT);
  tickVeh(r, now, DT);
}
function hurtStorm(r, e, d) {
  if (e.rsh > 0) { const s = Math.min(e.rsh, d); e.rsh -= s; d -= s; } // the storm eats shields first, like the real thing
  e.rhp -= d; e.hp = Math.max(0, e.rhp / 5); e.rgDirty = true; e.dirty = true;
  r.ev(['rd', e.id, Math.round(d), 0, 0, 0, 1]);
  if (e.rhp <= 0) { e.rhp = 0; A.die(r, e, 'storm', null); }
}
function jump(r, e, now) {
  const rs = e.rs; if (rs.st !== 'bus') return;
  rs.st = 'glide'; rs.glideEnd = now + 2600; e.rgDirty = true;
  if (e.conn) A.send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) });
  r.ev(['rj', e.id]);
}
function land(r, e) {
  const rs = e.rs; rs.st = 'ground'; e.god = false; e.rgDirty = true;
  const p = nearestWalkable(r.map, e.x, e.y); e.x = p.x; e.y = p.y;
  if (e.conn) A.send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) });
  r.ev(['rland', e.id, Math.round(e.x), Math.round(e.y)]);
  if (e.ai) { e.ai.landAt = null; e.ai.thinkAt = 0; }
}
export function meMsg(r, e) {
  const rs = e.rs;
  return { t: 'rgme', st: rs.st, ge: rs.glideEnd, hp: Math.ceil(e.rhp), sh: Math.ceil(e.rsh), sel: rs.sel, slots: rs.slots, am: rs.am, rl: rs.rlEnd, rls: rs.rlSlot, use: rs.use, veh: rs.veh, kills: e.stats.kills };
}

// ============================================================ messages
export function onMsg(r, e, m, now) {
  const t = m.t, rs = e.rs; if (!rs) return false;
  if (t === 'mv' && (rs.st === 'bus')) return true;
  if (t === 'mv' && rs.st === 'glide') { // gliding: allow fast steering, nothing else
    const x = Number(m.x), y = Number(m.y); if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
    const dt = Math.min(1, (now - (e.lastMv || now - 50)) / 1000); e.lastMv = now;
    const allow = BW.SPEED * 1.8 * dt * 1.6 + 30, d = Math.hypot(x - e.x, y - e.y);
    if (d <= allow) { e.x = clamp(x, T, (W - 1) * T); e.y = clamp(y, T, (H - 1) * T); } else if (e.conn) A.send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) });
    if (Number.isFinite(m.a)) e.ang = m.a / 100;
    return true;
  }
  if (t === 'rj') { if (rs.st === 'bus' && now >= r.rg.bus.t0) jump(r, e, now); return true; }
  if (rs.st !== 'ground') return t !== 'mv' && t !== 'qz' && t !== 'qa';
  if (t === 'rf') { fire(r, e, (Number(m.a) || 0) / 100, now); return true; }
  if (t === 'rr') { startReload(r, e, now); return true; }
  if (t === 'rsel') { const s = m.s | 0; if (s >= -1 && s < MG.RSLOTS) select(r, e, s); return true; }
  if (t === 'rsw') { const a = m.a | 0, b = m.b | 0; if (a >= 0 && b >= 0 && a < MG.RSLOTS && b < MG.RSLOTS) { const tmp = rs.slots[a]; rs.slots[a] = rs.slots[b]; rs.slots[b] = tmp; if (rs.sel === a) select(r, e, b); else if (rs.sel === b) select(r, e, a); e.rgDirty = true; } return true; }
  if (t === 'rdrop') { const s = m.s | 0, it = rs.slots[s]; if (it) { rs.slots[s] = null; spawnItem(r, e.x, e.y, lootFromItem(it), true); if (rs.sel === s) select(r, e, s); e.rgDirty = true; } return true; }
  if (t === 'rcancel') { if (rs.use) { rs.use = null; e.rgDirty = true; } return true; }
  if (t === 'ri') { interact(r, e, m.id | 0, String(m.kind || '')); return true; }
  if (t === 'mine' || t === 'pl' || t === 'use' || t === 'bow' || t === 'sw' || t === 'sel') return true;
  return false;
}
function interact(r, e, id, kind) {
  const rs = e.rs, rg = r.rg;
  if (rs.veh) { exitVeh(r, e); return; }
  if (kind === 'veh') { const v = rg.veh.find((q) => q.id === id); if (v && Math.hypot(v.x - e.x, v.y - e.y) < 70) enterVeh(r, e, v); return; }
  if (kind === 'chest') { const c = rg.chests.find((q) => q.id === id); if (c && !c.open && Math.hypot(c.x - e.x, c.y - e.y) < 80) { c.open = true; r.ev(['rc', c.id, e.id]); chestLoot(r, c.x, c.y); } return; }
  if (kind === 'loot') { const o = rg.loot.get(id); if (o && Math.hypot(o.x - e.x, o.y - e.y) < PICK_R + 10) grab(r, e, o, true); return; }
}

// ============================================================ network state
export function state(r, e) {
  const rg = r.rg;
  return {
    rg: {
      bus: rg.bus, zn: zoneMsg(r), chests: rg.chests.map((c) => [c.id, Math.round(c.x), Math.round(c.y), c.open ? 1 : 0]),
      loot: [...rg.loot.values()].map((o) => [o.id, o.x, o.y, o.k, o.r, o.n, o.a]),
      dead: [...rg.dead], hp: [...rg.objHp.entries()].map(([id, hp]) => [id, Math.round(hp)]), whp: [...rg.whp.entries()],
      veh: rg.veh.map((v) => [v.id, Math.round(v.x), Math.round(v.y), Math.round(v.ang * 100), v.driver, Math.round(v.hp), v.kind, Math.round((v.tur || 0) * 100)]),
      me: e && e.rs ? meMsg(r, e) : null, total: r.ents.size,
    },
  };
}
export function extra(r, e) {
  const rs = e.rs; if (!rs) return 0;
  const it = rs.sel >= 0 ? rs.slots[rs.sel] : null;
  return (Math.min(100, Math.ceil(e.rsh)) & 127) | ((rs.st === 'bus' ? 1 : rs.st === 'glide' ? 2 : 0) << 7) | ((it && it.r ? it.r : 0) << 9) | ((rs.use ? 1 : 0) << 12) | ((rs.rlEnd ? 1 : 0) << 13) | ((rs.veh & 15) << 14);
}
export function snapExtra(r, msg, now) {
  const rg = r.rg;
  if (rg.znDirty || now - (rg.znAt || 0) > 1000) { rg.znDirty = false; rg.znAt = now; msg.zn = zoneMsg(r); }
  if (rg.pj.length) msg.rpj = rg.pj.map((p) => [p.id, p.k, Math.round(p.x), Math.round(p.y)]);
  if (rg.veh.length && (now - (rg.vAt || 0) > 250 || rg.veh.some((v) => v.driver))) { rg.vAt = now; msg.rv = rg.veh.map((v) => [v.id, Math.round(v.x), Math.round(v.y), Math.round(v.ang * 100), v.driver, v.kind, Math.round((v.tur || 0) * 100)]); }
}

// ============================================================ death / end
export function die(r, v, kind, att) {
  const now = Date.now();
  if (!att && v.lastHitBy && now - v.lastHitAt < 10000) att = r.ents.get(v.lastHitBy) || null;
  if (att === v) att = null;
  if (v.rs && v.rs.veh) exitVeh(r, v, true);
  v.dead = true; v.elim = true; v.hp = 0; v.stats.deaths++; v.vx = v.vy = 0; v.god = false;
  v.stats.place = alive(r).length + 1;
  if (att) { att.stats.kills++; att.stats.finals++; att.dirty = true; att.rgDirty = true; }
  dropAll(r, v);
  r.ev(['die', v.id, kind === 'storm' ? 'storm' : kind === 'melee' ? 'melee' : 'gun', att ? att.id : 0, 1, Math.round(v.x), Math.round(v.y), v.stats.place]);
  v.dirty = true; r.teamsDirty = true;
  if (v.conn) A.send(v.conn, { t: 'rgout', place: v.stats.place, by: att ? att.id : 0, total: r.ents.size, kills: v.stats.kills });
}
export function checkEnd(r, now) {
  if (now < r.goAt + 3000) return null;
  const al = alive(r);
  if (al.length <= 1) { if (al[0]) al[0].stats.place = 1; return al.length ? al[0].team : -1; }
  // nobody human left alive and no one watching? wrap it up
  if (now > r.goAt + 20 * 60000) { al.sort((x, y) => (y.rhp + y.rsh) - (x.rhp + x.rsh)); al[0].stats.place = 1; return al[0].team; }
  return null;
}
export function reward(r, e, win) {
  const s = e.stats, n = r.ents.size, pl = s.place || n;
  return 20 + (win ? 140 : 0) + Math.max(0, Math.round((1 - (pl - 1) / Math.max(1, n - 1)) * 60)) + s.kills * 20 + Math.min(40, Math.round((s.dmg | 0) / 50));
}
export function endInfo(r) { return { total: r.ents.size }; }
export function adminInfo(r) { return alive(r).length + ' / ' + r.ents.size + ' still alive · storm ' + (r.rg.z.i + 1); }
export function kit(r, e) {
  const rs = e.rs; if (!rs) return;
  rs.slots = [{ k: 'ar', r: 4, a: 30 }, { k: 'shotgun', r: 4, a: 5 }, { k: 'sniper', r: 4, a: 5 }, { k: 'shieldpot', r: 0, n: 3 }, { k: 'medkit', r: 0, n: 3 }];
  rs.am = { L: 300, M: 300, S: 60, H: 40, R: 12 }; e.rsh = 100; e.rhp = 100; e.hp = BW.MAX_HP; select(r, e, 0);
}
export function skip(r, ms) { r.rg.z.t0 -= ms; r.rg.znDirty = true; }
export function quizReward(r, e, out) {
  if (!e.rs || e.dead) return;
  e.rsh = Math.min(100, e.rsh + 25); out.shield = 25;
  const it = e.rs.sel >= 0 ? e.rs.slots[e.rs.sel] : null, w = it && RW()[it.k];
  if (w && w.am) { const a = w.am, add = Math.min(MG.RAMMO[a].box, MG.RAMMO[a].max - e.rs.am[a]); e.rs.am[a] += add; out.ammo = add; }
  e.rgDirty = true;
}

// ============================================================ bots
function bot(r, e, now) {
  const ai = e.ai, rs = e.rs, m = r.map, rg = r.rg;
  e.mv = false;
  if (now < r.goAt) return;
  if (Math.hypot(e.vx, e.vy) > 70) return;
  const diff = r.diff || 'normal', aimErr = diff === 'easy' ? 0.2 : diff === 'hard' ? 0.06 : 0.12, react = diff === 'easy' ? 650 : diff === 'hard' ? 220 : 400;
  if (now >= (ai.thinkAt || 0)) {
    ai.thinkAt = now + 280 + rnd() * 200;
    // best weapon in hand
    let bestS = -1, bestScore = -1;
    rs.slots.forEach((it, i) => { if (!it) return; const w = RW()[it.k]; if (w.cls !== 'gun') return; const ammo = it.a + rs.am[w.am]; if (ammo <= 0) return; const sc = w.dmg * (w.pel || 1) * (1000 / w.rate) * MG.RRAR[it.r].dm * (w.rg / 600); if (sc > bestScore) { bestScore = sc; bestS = i; } });
    // enemy
    let foe = null, fd = 1e9;
    const see = (bestS >= 0 && rs.slots[bestS].k === 'sniper') ? 16 * T : 10 * T;
    for (const o of r.ents.values()) {
      if (o === e || o.dead || o.elim || !o.rs || o.rs.st !== 'ground' || o.vanish) continue;
      const d = dist(o, e); if (d > see || d > fd) continue;
      if (!losClear(m, e.x, e.y - 16, o.x, o.y - 16)) continue;
      foe = o; fd = d;
    }
    if (!foe && ai.foe && now - (ai.foeAt || 0) < 4000) { const o = r.ents.get(ai.foe); if (o && !o.dead && dist(o, e) < 12 * T) { foe = o; fd = dist(o, e); } }
    if (foe && bestS < 0 && fd > 2.2 * T) foe = null; // no gun yet: go find one instead of brawling
    ai.enemy = foe; if (foe && !ai.seenAt) ai.seenAt = now; if (!foe) ai.seenAt = 0;
    // heal when safe
    const hurtBad = e.rhp < 60 || e.rsh < 40;
    if (!foe && hurtBad && !rs.use) {
      const hs = rs.slots.findIndex((it) => it && RW()[it.k].cls === 'heal' && ((RW()[it.k].hp && e.rhp < RW()[it.k].cap) || (RW()[it.k].sh && e.rsh < RW()[it.k].cap)));
      if (hs >= 0) { if (rs.sel !== hs) select(r, e, hs); startUse(r, e, now); return; }
    }
    if (rs.use) return; // keep healing
    if (foe) { if (bestS >= 0 && rs.sel !== bestS) select(r, e, bestS); }
    // reload when it's quiet
    const cur = rs.sel >= 0 ? rs.slots[rs.sel] : null;
    if (cur && RW()[cur.k].cls === 'gun' && cur.a < RW()[cur.k].mag && (!foe || cur.a === 0)) startReload(r, e, now);
    // goals: storm > enemy > loot > roam
    const z = rg.z, zNext = z.to || z, outside = Math.hypot(e.x - z.x, e.y - z.y) > z.r - 2 * T, nextOut = Math.hypot(e.x - zNext.x, e.y - zNext.y) > zNext.r * 0.9;
    ai.goal = null;
    if (outside || (nextOut && z.mode === 'shrink')) ai.goal = { x: zNext.x + (rnd() - 0.5) * zNext.r * 0.6, y: zNext.y + (rnd() - 0.5) * zNext.r * 0.6, why: 'storm' };
    else if (!foe) {
      const full = rs.slots.every((s) => s), gunCount = rs.slots.filter((s) => s && RW()[s.k].cls === 'gun').length;
      let best = null, bd = 14 * T;
      for (const c of rg.chests) { if (c.open) continue; const d = dist(c, e); if (d < bd) { bd = d; best = { x: c.x, y: c.y, chest: c }; } }
      for (const o of rg.loot.values()) {
        if (o.dropBy === e.id && now - o.at < 20000) continue;
        if (o.k.startsWith('am_') && rs.am[o.k.slice(3)] >= MG.RAMMO[o.k.slice(3)].max) continue;
        const d = dist(o, e) * (o.k.startsWith('am_') ? 1.4 : 1); if (d > bd) continue;
        const w = RW()[o.k];
        if (w && w.cls === 'gun' && (full || gunCount >= 3) && !(rs.slots.some((s) => s && RW()[s.k].cls === 'gun' && MG.RRAR[s.r].dm * RW()[s.k].dmg < MG.RRAR[o.r].dm * w.dmg * 0.9))) continue;
        if (w && w.cls !== 'gun' && full && !rs.slots.some((s) => s && s.k === o.k)) continue;
        bd = d; best = { x: o.x, y: o.y, loot: o };
      }
      if (best) ai.goal = best;
    }
    if (ai.goal && (!ai.path || ai.goalKey !== Math.round(ai.goal.x / T) + ',' + Math.round(ai.goal.y / T))) {
      ai.goalKey = Math.round(ai.goal.x / T) + ',' + Math.round(ai.goal.y / T);
      const gi = tileOf(ai.goal.x, ai.goal.y);
      ai.path = A.pathTo(r, e, walkable(m, gi) || m.g[gi] === BW.G.FLOOR ? gi : tileOf(nearestWalkable(m, ai.goal.x, ai.goal.y).x, nearestWalkable(m, ai.goal.x, ai.goal.y).y), { bridge: false, mine: false }); ai.pi = 0;
    }
    if (!ai.goal && !foe && (!ai.path || now > (ai.roamAt || 0))) {
      ai.roamAt = now + 6000;
      const zz = rg.z.to || rg.z, a = rnd() * 6.283, d = rnd() * zz.r * 0.6, p = nearestWalkable(m, zz.x + Math.cos(a) * d, zz.y + Math.sin(a) * d);
      ai.path = A.pathTo(r, e, tileOf(p.x, p.y), { bridge: false, mine: false }); ai.pi = 0;
    }
  }
  if (rs.use) return;
  const foe = ai.enemy;
  // interact with what we reached
  if (ai.goal && dist(ai.goal, e) < 46) {
    if (ai.goal.chest && !ai.goal.chest.open) interact(r, e, ai.goal.chest.id, 'chest');
    else if (ai.goal.loot && rg.loot.has(ai.goal.loot.id)) grab(r, e, ai.goal.loot, rs.slots.every((s) => s));
    ai.goal = null; ai.path = null; ai.thinkAt = 0;
  }
  if (foe && !foe.dead && foe.rs && foe.rs.st === 'ground') {
    const d = dist(foe, e), ang = Math.atan2(foe.y - e.y, foe.x - e.x);
    e.ang = ang;
    const it = rs.sel >= 0 ? rs.slots[rs.sel] : null, w = it ? RW()[it.k] : null;
    const want = !w || w.cls !== 'gun' ? 0 : w.pel ? 2.2 * T : w.scope ? 9 * T : w.rg > 800 ? 5.5 * T : 3.8 * T;
    // strafe & keep distance
    if (now >= (ai.sideAt || 0)) { ai.sideAt = now + 700 + rnd() * 900; ai.side = rnd() < 0.5 ? -1 : 1; }
    const away = d < want * 0.7 ? -1 : d > want * 1.3 ? 1 : 0;
    const mx = Math.cos(ang) * away + Math.cos(ang + Math.PI / 2) * ai.side * 0.8, my = Math.sin(ang) * away + Math.sin(ang + Math.PI / 2) * ai.side * 0.8;
    A.moveToward(r, e, e.x + mx * 40, e.y + my * 40, A.DT, 0.85); e.ang = ang;
    if (now - (ai.seenAt || now) >= react) {
      if (!w || w.cls === 'gun' && it.a > 0 && d < w.rg) fire(r, e, ang + (rnd() - 0.5) * 2 * aimErr * (1 + d / (12 * T)), now);
      else if (!w && d < 60) melee(r, e, ang, now);
      else if (w && w.cls === 'throw' && d < 7 * T) throwNade(r, e, ang, now);
    }
    return;
  }
  if (ai.path) {
    if (ai.pi >= ai.path.length) { ai.path = null; return; }
    const c = tcen(ai.path[ai.pi]);
    if (Math.hypot(c.x - e.x, c.y - e.y) < 12) ai.pi++;
    else { A.moveToward(r, e, c.x, c.y, A.DT); e.sprint = true; }
    // stuck? smash what's in the way
    if (now - (ai.stuckAt || 0) > 900) { ai.stuckAt = now; if (ai.lastX != null && Math.hypot(e.x - ai.lastX, e.y - ai.lastY) < 6) { melee(r, e, e.ang, now); if (rnd() < 0.3) ai.path = null; } ai.lastX = e.x; ai.lastY = e.y; }
  }
}
