// ============================================================
// Scroll Racing on the Bedwars engine. Rooms, queue, voting, bots, rewards and the end screen come from
// bedwars.js / minigames.js. The race itself is client-driven for each human (their own kart runs in the racing
// game), and the server keeps the clock, validates every position, decides finish order, runs the bot karts and
// relays item events. Track geometry is shared with the client in dist/arcade/bedwars/racecore.js.
// ============================================================
const RC = globalThis.RaceCore;
const MG = globalThis.MG;
let A = null;
export function initRace(api) { A = api; }

const rnd = Math.random;
const pick = (a) => a[(rnd() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ITEMS = ['turbo', 'pulse', 'seeker', 'slick', 'shield', 'zap'];
const PAY = [140, 95, 65, 40, 25, 15, 10, 10];
const RACERS = 8, LAPS = 3, COUNT_MS = 6200, AFTER_MS = 25000, MAX_MS = 9 * 60000;
const DIFFTOP = { easy: 0.86, normal: 0.93, hard: 1.0 };

export function start(r, addBot) {
  const now = Date.now(), T = RC.build(r.trackId && RC.DEFS[r.trackId] ? r.trackId : pick(RC.IDS));
  const target = r.noBots ? Math.max(2, r.ents.size) : RACERS;
  while (r.ents.size < target) addBot(r.ents.size);
  let ti = 0; for (const e of r.ents.values()) e.team = ti++;
  r.teams = []; for (let t = 0; t < ti + 4; t++) r.teams.push({ bed: false, elim: false, up: { sharp: 0, prot: 0, forge: 0, haste: 0, heal: 0, trap: 0 } });
  r.goAt = now + COUNT_MS; r.endAt = r.goAt + MAX_MS;
  const rc = r.rc = { T, laps: LAPS, k: new Map(), finished: 0, firstAt: 0, ev: [], carsDirty: true, over: false };
  const slots = shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
  const top = DIFFTOP[r.diff] || DIFFTOP.normal;
  let i = 0;
  for (const e of r.ents.values()) {
    const g = RC.grid(T, slots[i++ % slots.length]);
    e.car = e.car || '';
    e.stats = { kills: 0, finals: 0, beds: 0, deaths: 0, place: 0, ft: 0, laps: 0 };
    rc.k.set(e.id, { id: e.id, slot: i - 1, x: g.x, y: g.y, a: g.a, vx: 0, vy: 0, idx: g.idx, u: g.idx - T.N, lat: g.lat, f: 0, st: 0, it: 0, lap: 1, ok: true, lastAt: 0, fin: false, ft: 0, place: 0, v: 0, top: top * (0.97 + rnd() * 0.06), lane: (rnd() - 0.5) * 120, rnd: rnd(), t: 0, was: false, fixAt: 0, evAt: 0 });
  }
}

function human(r, e) { return !!e.conn && !e.bot; }
function lap(k, T, laps) { return clamp(Math.floor(k.u / T.N) + 1, 1, laps); }

// bots (and a human who left) are driven along the centerline
function drive(r, k, e, now, dt, leaderU) {
  const rc = r.rc, T = rc.T, N = T.N;
  if (!k.was) { k.was = true; k.v = Math.hypot(k.vx, k.vy); if (!k.lap0) { k.lap0 = 1; } }
  const idx = ((Math.floor(k.u) % N) + N) % N, i1 = (idx + 1) % N, fr = k.u - Math.floor(k.u);
  const cv = Math.max(T.curv[(idx + 8) % N], T.curv[(idx + 16) % N]);
  let top = k.top; if (leaderU != null) { const d = k.u - leaderU; top *= d > 40 ? 0.95 : d < -40 ? 1.05 : 1; }
  const limit = RC.MAXSP * top * (1 - clamp(cv * 0.55, 0, 0.5)) * (k.boostT > 0 ? 1.25 : 1);
  if (k.v < limit) k.v = Math.min(limit, k.v + 420 * dt); else k.v = Math.max(limit, k.v - 900 * dt);
  if (k.boostT > 0) k.boostT -= dt;
  if (k.stunT > 0) { k.stunT -= dt; k.v *= 0.9; }
  k.u += k.v * dt / RC.STEP; k.t += dt;
  const lane = clamp(k.lane * (0.55 + 0.45 * Math.sin(k.t * 0.4 + k.rnd * 6)), -RC.HALF + 35, RC.HALF - 35);
  const x0 = T.x[idx] + T.nx[idx] * lane, y0 = T.y[idx] + T.ny[idx] * lane, x1 = T.x[i1] + T.nx[i1] * lane, y1 = T.y[i1] + T.ny[i1] * lane;
  const nx = x0 + (x1 - x0) * fr, ny = y0 + (y1 - y0) * fr, a = Math.atan2(ny - k.y, nx - k.x);
  if (Math.hypot(nx - k.x, ny - k.y) > 0.5) { let da = a - k.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; k.a += da * Math.min(1, dt * 9); }
  k.vx = Math.cos(k.a) * k.v; k.vy = Math.sin(k.a) * k.v; k.x = nx; k.y = ny; k.idx = idx; k.lat = lane;
  const drift = cv > 0.75 && k.v > 290;
  k.f = (drift ? 1 : 0) | (k.stunT > 0 ? 2 : 0) | (k.boostT > 0 ? 4 : 0); k.st = drift ? 70 : 0;
  if (rnd() < dt * 0.012 && !drift) { k.boostT = 1; }   // the odd boost pad
}

export function tick(r, now) {
  const rc = r.rc; if (!rc || rc.over) return;
  const T = rc.T, dt = A.DT;
  if (now < r.goAt) return;
  let leaderU = null; for (const e of r.ents.values()) { const k = rc.k.get(e.id); if (k && human(r, e) && (leaderU == null || k.u > leaderU)) leaderU = k.u; }
  for (const e of r.ents.values()) {
    const k = rc.k.get(e.id); if (!k) continue;
    if (k.fin) { k.v *= 0.97; continue; }
    if (!human(r, e)) { drive(r, k, e, now, dt, leaderU); }
    else k.was = false;
    e.stats.laps = lap(k, T, rc.laps);
    if (k.u >= rc.laps * T.N && !k.fin) finish(r, e, k, now);
  }
}
function finish(r, e, k, now) {
  const rc = r.rc;
  k.fin = true; k.ft = Math.max(1, now - r.goAt); k.place = ++rc.finished; e.stats.place = k.place; e.stats.ft = k.ft;
  if (human(r, e) && !rc.firstAt) rc.firstAt = now;
  if (human(r, e)) A.send(e.conn, { t: 'rcf', place: k.place, ft: k.ft });
}

export function checkEnd(r, now) {
  const rc = r.rc; if (!rc || rc.over) return null;
  if (now < r.goAt) return null;
  const hs = [...r.ents.values()].filter((e) => human(r, e)), hk = hs.map((e) => rc.k.get(e.id));
  const allDone = hk.length > 0 && hk.every((k) => k.fin);
  const timeUp = rc.firstAt && now - rc.firstAt > AFTER_MS;
  if (!(allDone || timeUp || now > r.endAt || !hs.length)) return null;
  rc.over = true;
  const rows = [...r.ents.values()].map((e) => ({ e, k: rc.k.get(e.id) }));
  rows.sort((a, b) => (a.k.fin && b.k.fin ? a.k.ft - b.k.ft : a.k.fin ? -1 : b.k.fin ? 1 : b.k.u - a.k.u));
  rows.forEach((x, i) => { x.k.place = i + 1; x.e.stats.place = i + 1; if (!x.k.fin) x.e.stats.ft = 0; });
  return rows[0].e.team;
}

export function reward(r, e, win) {
  const p = (e.stats && e.stats.place) || RACERS, base = PAY[p - 1] || 10;
  return base + (e.stats.ft ? 0 : -5);
}
export function endInfo(r) { const rc = r.rc; return { track: rc ? rc.T.id : '', laps: rc ? rc.laps : LAPS, trackName: rc ? RC.NAMES[rc.T.id] : '' }; }
export function adminInfo(r) { const rc = r.rc; return rc ? RC.NAMES[rc.T.id] + ' · ' + rc.finished + ' / ' + r.ents.size + ' finished' : ''; }
export function kit() {}
export function skip(r, ms) { r.goAt -= 0; }

export function state(r, e) {
  const rc = r.rc;
  return { track: rc.T.id, laps: rc.laps, goAt: r.goAt, endAt: r.endAt, racers: [...r.ents.values()].map((x) => ({ id: x.id, slot: rc.k.get(x.id).slot, bot: !!x.bot })) };
}
export function extra() { return 0; }

// one compact row per kart, every tick
export function snapExtra(r, msg, now) {
  const rc = r.rc; if (!rc) return;
  const rows = [];
  for (const e of r.ents.values()) {
    const k = rc.k.get(e.id); if (!k) continue;
    rows.push([e.id, Math.round(k.x * 10) / 10, Math.round(k.y * 10) / 10, Math.round(k.a * 100) / 100, Math.round(k.vx), Math.round(k.vy), k.f | (human(r, e) ? 0 : 64), k.st | 0, k.it | 0, Math.round(k.u * 10) / 10, k.place | 0]);
  }
  msg.rc = rows;
  if (rc.ev.length) { msg.rce = rc.ev; rc.ev = []; }
  if (rc.carsDirty) { rc.carsDirty = false; msg.rcc = [...r.ents.values()].map((e) => [e.id, e.car || '']); }
}

export function onMsg(r, e, m, now) {
  const rc = r.rc, t = m.t; if (!rc || rc.over) return true;
  const k = rc.k.get(e.id); if (!k) return true;
  if (t === 'rcc') { const car = String(m.car || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 16); if (car !== e.car) { e.car = car; rc.carsDirty = true; } return true; }
  if (t === 'rcr') { k.ok = true; k.stun = 0; return true; }                 // the player pressed R: allow the jump back onto the road
  if (t === 'rci') {                                                          // an item was used: tell everyone else
    if (now - k.evAt < 400 || now < r.goAt) return true; k.evAt = now;
    const kind = ITEMS.indexOf(String(m.k));
    if (kind < 0) return true;
    rc.ev.push([e.id, kind, +m.x || k.x, +m.y || k.y, +m.vx || 0, +m.vy || 0, +m.a || k.a]);
    return true;
  }
  if (t !== 'rc') return true;                                                // every walking message is ignored in a race
  if (now < r.goAt || k.fin) return true;
  const T = rc.T;
  let x = Number(m.x), y = Number(m.y); if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  const dt = clamp((now - (k.lastAt || now - 50)) / 1000, 0.01, 0.6); k.lastAt = now;
  const cap = RC.MAXSP * 1.6 * dt + 70, d = Math.hypot(x - k.x, y - k.y);
  if (d > cap && !k.ok) {                                                     // too far in one step: snap them back
    if (now - k.fixAt > 800) { k.fixAt = now; A.send(e.conn, { t: 'rcfix', x: Math.round(k.x), y: Math.round(k.y), a: k.a }); }
    return true;
  }
  const idx = RC.locate(T, x, y, k.idx), lat = (x - T.x[idx]) * T.nx[idx] + (y - T.y[idx]) * T.ny[idx];
  if (Math.abs(lat) > RC.WALL + 40) { if (now - k.fixAt > 800) { k.fixAt = now; A.send(e.conn, { t: 'rcfix', x: Math.round(T.x[k.idx]), y: Math.round(T.y[k.idx]), a: k.a }); } return true; }
  let di = idx - k.idx; if (di > T.N / 2) di -= T.N; if (di < -T.N / 2) di += T.N;
  if (di > (RC.MAXSP * 1.7 * dt) / RC.STEP + 4 && !k.ok) return true;       // nobody drives that fast
  k.ok = false; k.u += di; k.idx = idx; k.lat = lat;
  k.x = x; k.y = y; k.a = Number(m.a) || 0; k.vx = clamp(Number(m.vx) || 0, -900, 900); k.vy = clamp(Number(m.vy) || 0, -900, 900);
  k.f = (m.f | 0) & 63; k.st = clamp(m.st | 0, -100, 100); k.it = clamp(m.it | 0, 0, 6);
  return true;
}

export function die() {}
