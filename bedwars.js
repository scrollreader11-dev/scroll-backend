// ============================================================
// Bedwars 2D — server. Matchmaking (quick play / private rooms / practice),
// the authoritative game sim (combat, blocks, beds, generators, projectiles,
// explosions, team upgrades), AI bots, and Scroll rewards.
// server.js routes /bw-ws here. Rules shared with the client: dist/arcade/bedwars/shared.js
// ============================================================
import { WebSocketServer } from 'ws';
import './dist/arcade/bedwars/shared.js';
import './dist/arcade/bedwars/mg.js';
import { MINI, initMini } from './minigames.js';
import { worldIdentity, worldLook, bwReward, bwStats, bwLeaderboard } from './casino.js';

const BW = globalThis.BW;
const MG = globalThis.MG;
const { T, W, H, G } = BW;
const N = W * H;
const TICK = 50, DT = TICK / 1000;
const DEBUG = process.env.BW_DEBUG === '1';
const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
const HELD = BW.HOTBAR_ORDER;
const RES = BW.RES;

const conns = new Set();
// Bedwars owners (checked against the logged-in ScrollHub account, never the guest nickname).
const OWNERS = new Set(['pufferfishrcool', 'scrollreader11', 'mai_mei67']);
let LOCKED = false; // owners can pause new matches
// ---- proximity voice: mic audio (12 kHz mu-law frames) goes through the server, which only
// forwards it to players standing near the speaker. Works on any network (no peer-to-peer).
const VOICE_R = 9.5 * 40;  // hearing range in px (~9 blocks)
let VOICE_OFF = false;     // owners can switch voice off for everyone
function voicePos(x) {
  if (x.room && x.room.state === 'play' && x.ent) return { id: x.ent.id, x: x.ent.x, y: x.ent.y, group: humans(x.room), elim: x.ent.elim };
  if (x.space) return { id: x.pid, x: x.sx, y: x.sy, group: x.space.conns };
  return null;
}
function voiceFrame(c, buf) {
  if (VOICE_OFF || !c.voice || c.vmuted || buf.length < 2 || buf.length > 1200 || buf[0] !== 1) return;
  const now = Date.now();
  c.vtok = Math.min(40, (c.vtok == null ? 40 : c.vtok) + (now - (c.vAt || now)) / 1000 * 32); c.vAt = now;
  if (c.vtok < 1) return; c.vtok--;
  const me = voicePos(c); if (!me || me.elim) return;
  c.vTalkAt = now;
  let out = null;
  for (const r of me.group) {
    if (r === c || !r.voice) continue;
    const them = voicePos(r); if (!them) continue;
    if (Math.hypot(them.x - me.x, them.y - me.y) > VOICE_R) continue;
    if (!out) { out = Buffer.allocUnsafe(buf.length + 4); out[0] = 1; out.writeUInt32BE(me.id >>> 0, 1); buf.copy(out, 5, 1); }
    try { if (r.ws.readyState === 1 && r.ws.bufferedAmount < 256 * 1024) r.ws.send(out, { binary: true }); } catch (e) {}
  }
}
const rooms = new Map();
const codes = new Map();
let nextRoom = 1, nextEnt = 1, nextProj = 1;

const BOT_NAMES = ['Pickles', 'Bedbug', 'Sir Wooly', 'Captain Pog', 'Noodle', 'Sprout', 'Bonk', 'Biscuit', 'Waffles', 'Turbo', 'Zippy', 'Moss', 'Pebble', 'Clank', 'Fizz', 'Gizmo', 'Mango', 'Taco', 'Sushi', 'Nugget', 'Rusty', 'Blip', 'Dusty', 'Socks', 'Muffin', 'Tank', 'Echo', 'Jelly', 'Bolt', 'Pudding'];
const BOT_SKINS = ['gim', 'gim', 'cat', 'fox', 'bear', 'panda', 'bunny', 'pig', 'duck', 'frog', 'penguin', 'robot', 'alien', 'dino', 'slime', 'shark', 'ninja', 'knight', 'astro', 'skeleton'];
const BOT_BODIES = ['#3fa9ff', '#3fd27a', '#ff6b6b', '#ffcc33', '#9b6bff', '#ff922b', '#5eead4', '#ff8ad8', '#eef2ff', '#4a4f6a'];
const BOT_HATS = ['', '', '', 'cap', 'beanie', 'party', 'cowboy', 'viking', 'wizard', 'phones', 'pirate', 'top', 'crown'];
const BOT_ACCS = ['', '', '', '', 'shades', 'scarf', 'bowtie', 'nerd', 'stache'];
export const BW_QC = ['GG!', 'Help!', 'Rushing!', 'Defend the bed!', 'Nice!', 'On my way!', 'Getting diamonds', 'Watch out!'];
const SK = {
  easy: { aim: 0.55, react: 560, swing: 780, rushAt: 160, place: 340, mine: 0.75, fireball: false },
  normal: { aim: 0.28, react: 320, swing: 500, rushAt: 90, place: 230, mine: 1, fireball: true },
  hard: { aim: 0.12, react: 180, swing: 390, rushAt: 50, place: 160, mine: 1.15, fireball: true },
};

const rnd = Math.random;
const pick = (a) => a[(rnd() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const tc = (i) => ({ x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2 });
const tileOf = (x, y) => Math.floor(y / T) * W + Math.floor(x / T);
const q2 = (a) => Math.round(a * 100);

function send(c, o) { try { if (c && c.ws && c.ws.readyState === 1) c.ws.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch (e) {} }
function humans(r) { const out = []; if (r.ents) { for (const e of r.ents.values()) if (e.conn) out.push(e.conn); } else for (const m of r.members) if (m.conn) out.push(m.conn); return out; }
function roomSend(r, o) { const s = JSON.stringify(o); for (const c of humans(r)) send(c, s); }

// ============================================================ spaces: the hub + waiting islands
// Outside a match every connection stands in a walkable "space": the Games hub, or
// the waiting island of the room it queued for. Positions are relayed at 10 Hz.
const WAIT_MAP = BW.genWait();
let nextPid = 1;
function makeSpace(kind, room) { return { kind, room: room || null, conns: new Set(), events: [] }; }
const HUB = makeSpace('hub');
function spaceTeam(c) { const r = c.space && c.space.room; if (!r) return -1; const mb = r.members.find((m) => m.conn === c); return mb ? mb.team : -1; }
function enterSpace(c, sp, x, y) {
  leaveSpace(c);
  const sp0 = sp.kind === 'hub' ? BW.HUB_SPAWN : BW.WAIT_SPAWN;
  c.space = sp; c.sx = x != null ? x : sp0.x + (rnd() - 0.5) * 120; c.sy = y != null ? y : sp0.y + (rnd() - 0.5) * 60; c.sang = Math.PI / 2; c.smv = 0; c.sheld = 0; c.lastSMv = Date.now();
  sp.conns.add(c);
  send(c, {
    t: 'space', kind: sp.kind, you: c.pid, x: Math.round(c.sx), y: Math.round(c.sy), now: Date.now(),
    players: [...sp.conns].map((o) => ({ id: o.pid, nick: o.nick, look: o.look, x: Math.round(o.sx), y: Math.round(o.sy), team: spaceTeam(o) })),
    room: sp.room ? roomInfo(sp.room, c) : null, lb: sp.kind === 'hub' ? bwLeaderboard() : null, online: lobbyList(), stats: bwStats(c.cid), qc: BW_QC,
  });
  sp.events.push(['pj', c.pid, c.nick, c.look, Math.round(c.sx), Math.round(c.sy), spaceTeam(c)]);
}
function leaveSpace(c) { const sp = c.space; if (!sp) return; sp.conns.delete(c); c.space = null; sp.events.push(['pl', c.pid]); }
function goHub(c) { enterSpace(c, HUB); }
function tickSpace(sp, now) {
  if (!sp.conns.size) { sp.events = []; return; }
  const r = sp.room;
  if (r && r.kind === 'private' && r.state === 'lobby' && (r.game === 'bw' || r.game === 'ctf')) for (const c of sp.conns) { // team pads
    const t = BW.padAt(WAIT_MAP, c.sx, c.sy), mb = r.members.find((m) => m.conn === c);
    if (t >= nTeams(r)) continue;
    if (t >= 0 && mb && mb.team !== t && r.members.filter((m) => m.team === t).length < per(r)) { mb.team = t; sp.events.push(['pt', c.pid, t]); pushRoom(r); }
  }
  const p = [];
  for (const c of sp.conns) p.push([c.pid, Math.round(c.sx), Math.round(c.sy), q2(c.sang), (c.smv ? 2 : 0) | (c.smv === 2 ? 1024 : 0), c.sheld | 0, 20]);
  const msg = { t: 's', n: now, p };
  if (sp.events.length) { msg.e = sp.events; sp.events = []; }
  const str = JSON.stringify(msg);
  for (const c of sp.conns) send(c, str);
}
function spaceMsg(c, m, now) {
  const sp = c.space, t = m.t;
  if (t === 'mv') {
    let x = Number(m.x), y = Number(m.y); if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dt = Math.min(1, (now - (c.lastSMv || now - 100)) / 1000); c.lastSMv = now;
    const allow = BW.SPEED * 1.4 * 1.6 * dt + 30, dx = x - c.sx, dy = y - c.sy, d = Math.hypot(dx, dy);
    if (d > allow) { x = c.sx + dx / d * allow; y = c.sy + dy / d * allow; send(c, { t: 'pos', x: Math.round(x), y: Math.round(y) }); }
    c.sx = clamp(x, T, (W - 1) * T); c.sy = clamp(y, T, (H - 1) * T);
    if (Number.isFinite(m.a)) c.sang = m.a / 100;
    c.smv = m.m | 0; c.sheld = m.h | 0;
    return;
  }
  if (t === 'sw') { if (now - (c.swAt || 0) < 110) return; c.swAt = now; sp.events.push(['sw', c.pid, m.a | 0]); return; }
  if (t === 'hop') { if (now - (c.hopAt || 0) < 450) return; c.hopAt = now; sp.events.push(['hop', c.pid]); return; }
  if (t === 'qc') { if (now - (c.qcAt || 0) < 1200) return; c.qcAt = now; const i = m.i | 0; if (i >= 0 && i < BW_QC.length) sp.events.push(['qc', c.pid, i]); return; }
}

// ============================================================ rooms / lobby
function newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = ''; for (let i = 0; i < 4; i++) c += A[(rnd() * A.length) | 0]; } while (codes.has(c)); return c; }
function makeRoom(kind, mode, diff, host, game) {
  game = MG.isMini(game) ? game : 'bw';
  const r = { id: nextRoom++, game, kind, mode: game !== 'bw' ? game : BW.MODES[mode] ? mode : 'solo', diff: SK[diff] ? diff : 'normal', code: kind === 'private' ? newCode() : '', host: host || '', state: 'lobby', members: [], startAt: 0, created: Date.now() };
  r.space = makeSpace('wait', r);
  rooms.set(r.id, r); if (r.code) codes.set(r.code, r);
  return r;
}
function per(r) { return r.game !== 'bw' ? MG.GAMES[r.game].per : BW.MODES[r.mode].per; }
function nTeams(r) { return r.game !== 'bw' ? MG.GAMES[r.game].teams : 4; }
function capOf(r) { return r.game !== 'bw' ? MG.GAMES[r.game].max : 4 * per(r); }
function bestTeam(r) {
  if (r.game === 'hide') return r.members.length < capOf(r) ? 0 : -1;
  const cnt = [0, 0, 0, 0, 0, 0, 0, 0]; for (const m of r.members) cnt[m.team]++;
  let best = -1; for (let t = 0; t < nTeams(r); t++) if (cnt[t] < per(r) && (best < 0 || cnt[t] < cnt[best])) best = t;
  return best;
}
function roomInfo(r, c) {
  return {
    t: 'room', id: r.id, game: r.game, kind: r.kind, code: r.code, mode: r.mode, diff: r.diff, state: r.state, host: r.host,
    startIn: r.startAt ? Math.max(0, r.startAt - Date.now()) : 0, per: per(r), teams: nTeams(r), cap: capOf(r), you: c ? c.cid : '',
    members: r.members.map((m) => ({ cid: m.cid, pid: m.conn ? m.conn.pid : 0, nick: m.nick, team: m.team, look: m.look })),
  };
}
function pushRoom(r) { for (const m of r.members) if (m.conn) send(m.conn, roomInfo(r, m.conn)); }
function joinLobby(c, r, team) {
  leaveRoom(c, true);
  const t = r.game !== 'hide' && team != null && team >= 0 && team < nTeams(r) && r.members.filter((m) => m.team === team).length < per(r) ? team : bestTeam(r);
  if (t < 0) return send(c, { t: 'err', msg: 'That room is full.' });
  r.members.push({ cid: c.cid, nick: c.nick, look: c.look, team: t, conn: c });
  c.room = r; c.ent = null;
  if (r.kind === 'public') {
    const now = Date.now();
    if (!r.startAt) r.startAt = now + 25000;
    if (r.members.length >= capOf(r)) r.startAt = Math.min(r.startAt, now + 5000);
  }
  if (r.kind === 'practice') r.startAt = Date.now() + 2500;
  enterSpace(c, r.space);
  if (r.state === 'lobby') r.space.events.push(['pt', c.pid, t]);
  pushRoom(r);
}
function leaveRoom(c, quiet) {
  const r = c.room;
  if (!r) { if (!quiet && !c.space) goHub(c); return; }
  c.room = null;
  if (r.state === 'lobby') {
    r.members = r.members.filter((m) => m.conn !== c && m.cid !== c.cid);
    if (!r.members.length) return killRoom(r);
    if (r.host === c.cid) r.host = r.members[0].cid;
    pushRoom(r);
  } else if (r.state === 'play') {
    const e = c.ent; c.ent = null;
    if (e && e.conn === c) { e.conn = null; e.ctl = 'ai'; e.ai = e.ai || newAI(r, e); e.ai.goal = null; e.ai.path = null; r.ev(['dc', e.id, 1]); }
  }
  if (!quiet) goHub(c); else leaveSpace(c);
}
function killRoom(r) { rooms.delete(r.id); if (r.code) codes.delete(r.code); }

// ============================================================ match setup
function emptyInv() { return { kbstick: 0, wool: 0, wood: 0, end: 0, obby: 0, bow: 0, arrows: 0, fireball: 0, tnt: 0, gapple: 0, pearl: 0, egg: 0, speed: 0 }; }
function makeEnt(r, o) {
  const b = r.map.bases[o.team];
  const e = {
    id: nextEnt++, cid: o.cid || '', nick: o.nick, look: o.look, team: o.team, bot: !!o.bot, conn: o.conn || null, ctl: o.bot ? 'ai' : 'human',
    x: b.spawn.x + (rnd() - 0.5) * 30, y: b.spawn.y + (rnd() - 0.5) * 20, vx: 0, vy: 0, ang: Math.atan2(b.inward[1], b.inward[0]), mv: false,
    hp: BW.MAX_HP, absorb: 0, dead: false, elim: false, respawnAt: 0, fall: 0,
    inv: emptyInv(), res: { iron: 0, gold: 0, dia: 0, em: 0 }, sword: 1, armor: 1, pick: 0, held: 'sword',
    lastSwing: 0, invulnUntil: 0, lastHitBy: 0, lastHitAt: 0, lastDmgAt: 0, mine: null, mineReq: null,
    speedUntil: 0, regenUntil: 0, slowUntil: 0, bow: false, eatAt: 0, useAt: 0, kbBudget: 0, lastMv: 0,
    stats: { kills: 0, finals: 0, beds: 0, deaths: 0 }, dirty: true, lastHp: BW.MAX_HP,
  };
  e.ai = newAI(r, e);
  r.ents.set(e.id, e);
  return e;
}
function botLook() { return { skin: pick(BOT_SKINS), body: pick(BOT_BODIES), hat: pick(BOT_HATS), acc: pick(BOT_ACCS), trail: '' }; }
function startMatch(r) {
  if (r.game !== 'bw') return MINI.start(r);
  r.state = 'play';
  r.map = BW.genMap();
  r.ents = new Map();
  r.teams = [0, 1, 2, 3].map(() => ({ bed: true, elim: false, up: { sharp: 0, prot: 0, forge: 0, haste: 0, heal: 0, trap: 0 } }));
  r.gens = r.map.gens.map((g) => ({ ...g, n: 0, acc: 0, last: 0 }));
  r.projs = []; r.tnts = []; r.events = []; r.tl = 0; r.tier = { dia: 0, em: 0 };
  r.goAt = Date.now() + 4200; r.lastHuman = Date.now();
  r.ev = (a) => r.events.push(a);
  const used = new Set();
  for (const m of r.members) { const e = makeEnt(r, { cid: m.cid, nick: m.nick, look: m.look, team: m.team, conn: m.conn }); if (m.conn) { leaveSpace(m.conn); m.conn.ent = e; m.conn.room = r; } }
  let roleIdx = [0, 0, 0, 0];
  for (const e of r.ents.values()) roleIdx[e.team]++;
  for (let t = 0; t < 4; t++) {
    while ([...r.ents.values()].filter((e) => e.team === t).length < per(r)) {
      let name; do { name = pick(BOT_NAMES); } while (used.has(name) && used.size < BOT_NAMES.length); used.add(name);
      const e = makeEnt(r, { nick: name, look: botLook(), team: t, bot: true });
      e.ai.role = roleIdx[t]++ === 0 ? 'def' : 'atk';
    }
  }
  for (const e of r.ents.values()) if (e.conn) send(e.conn, fullState(r, e));
}
function teamsInfo(r) {
  return r.teams.map((tm, t) => {
    let alive = 0, total = 0; for (const e of r.ents.values()) if (e.team === t) { total++; if (!e.elim) alive++; }
    return { bed: tm.bed, elim: tm.elim, up: tm.up, alive, total };
  });
}
function entPub(e) { return { z: e.z || 0, prop: e.prop || '', carry: e.carry != null ? e.carry : -1, id: e.id, nick: e.nick, team: e.team, look: e.look, bot: e.bot, sword: e.sword, armor: e.armor, pick: e.pick, dead: e.dead, elim: e.elim, x: Math.round(e.x), y: Math.round(e.y), stats: e.stats, dc: e.ctl === 'ai' && !e.bot }; }
function fullState(r, e) {
  const m = r.map, blocks = [];
  for (let i = 0; i < N; i++) if (m.f[i] || m.w[i]) blocks.push([i, m.f[i], m.fc[i], m.w[i], m.wc[i]]);
  return {
    ...(r.game !== 'bw' ? MINI.state(r, e) : { game: 'bw' }),
    t: 'game', you: e.id, team: e.team, mode: r.mode, kind: r.kind, code: r.code, diff: r.diff, goAt: r.goAt, now: Date.now(),
    ents: [...r.ents.values()].map(entPub), beds: m.beds.map((b) => (b.alive ? 1 : 0)), gens: r.gens.map((g) => [g.n, g.last]),
    teams: teamsInfo(r), tier: r.tier, tl: r.tl, blocks, tnts: r.tnts.map((x) => [x.id, x.x, x.y, x.at]), qc: BW_QC,
  };
}
function meMsg(e) {
  const now = Date.now();
  return { t: 'me', role: e.team, z: e.z || 0, prop: e.prop || '', hp: Math.ceil(e.hp), absorb: Math.ceil(e.absorb), inv: e.inv, res: e.res, sword: e.sword, armor: e.armor, pick: e.pick, held: e.held, dead: e.dead, elim: e.elim, respawn: e.dead && !e.elim ? Math.max(0, e.respawnAt - now) : 0, speed: Math.max(0, e.speedUntil - now), stats: e.stats };
}

// ============================================================ actions (shared by players & bots)
function aliveEnts(r) { const a = []; for (const e of r.ents.values()) if (!e.dead && !e.elim) a.push(e); return a; }
function setTile(r, i, f, fc, w, wc) { const m = r.map; m.f[i] = f; m.fc[i] = fc; m.w[i] = w; m.wc[i] = wc; r.ev(['blk', i, f, fc, w, wc]); }
function place(r, e, i, key) {
  const id = BW.BLOCK_OF[key]; if (!id || !(e.inv[key] > 0)) return false;
  const c = tc(i); if (Math.hypot(c.x - e.x, c.y - e.y) > BW.REACH + 30) return false;
  const kind = BW.canPlace(r.map, i, aliveEnts(r)); if (!kind) return false;
  const m = r.map;
  if (kind === 'floor') setTile(r, i, id, e.team, m.w[i], m.wc[i]); else setTile(r, i, m.f[i], m.fc[i], id, e.team);
  e.inv[key]--; e.dirty = true;
  if (e.held === key && !e.inv[key]) e.held = 'sword';
  return true;
}
function breakTile(r, i, by) {
  const m = r.map, tg = BW.mineTarget(m, i); if (!tg) return;
  if (tg.kind === 'wall') setTile(r, i, m.f[i], m.fc[i], 0, 0);
  else if (tg.kind === 'floor') setTile(r, i, 0, 0, 0, 0);
  else if (tg.kind === 'bed') { const bed = BW.bedAt(m, i); if (bed) destroyBed(r, bed, by); }
}
function destroyBed(r, bed, by) {
  if (!bed.alive) return;
  bed.alive = false; r.map.obj[bed.foot] = 0; r.map.obj[bed.head] = 0;
  r.teams[bed.team].bed = false;
  if (by) { by.stats.beds++; by.dirty = true; }
  r.ev(['bed', bed.team, by ? by.id : 0]);
  r.teamsDirty = true;
  for (const e of r.ents.values()) if (e.team === bed.team && e.ai) e.ai.goal = null; // bots: go avenge
  checkWin(r);
}
function mineStep(r, e, i, dt) {
  // No mining through walls: whatever is in the way gets mined first.
  const blk = BW.mineBlocker(r.map, e.x, e.y, i);
  if (blk >= 0) i = blk;
  if (r.map.noMine && r.map.noMine[i]) { e.mine = null; return 'none'; }
  const tg = BW.mineTarget(r.map, i); if (!tg) { e.mine = null; return 'none'; }
  if (tg.kind === 'bed') { const bed = BW.bedAt(r.map, i); if (!bed || bed.team === e.team) return 'none'; }
  const c = tc(i); if (Math.hypot(c.x - e.x, c.y - e.y) > BW.REACH + 30) return 'far';
  if (!e.mine || e.mine.i !== i) { if (e.mine) r.ev(['crk', e.mine.i, -1]); e.mine = { i, p: 0, st: -1 }; }
  const mult = e.ctl === 'ai' && e.bot ? SK[r.diff].mine : 1;
  e.mine.p += dt * mult / BW.mineTime(tg.hard, e.pick, r.teams[e.team].up.haste);
  if (e.mine.p >= 1) { r.ev(['crk', i, -1]); breakTile(r, i, e); e.mine = null; return 'done'; }
  const st = Math.floor(e.mine.p * 6); if (st !== e.mine.st) { e.mine.st = st; r.ev(['crk', i, st]); }
  return 'ok';
}
function stopMine(r, e) { if (e.mine) { r.ev(['crk', e.mine.i, -1]); e.mine = null; } }

function knock(r, v, kx, ky, pow) {
  if (!pow) return;
  const d = Math.hypot(kx, ky) || 1, vx = kx / d * pow, vy = ky / d * pow;
  if (v.ctl === 'human' && v.conn) { send(v.conn, { t: 'kb', vx: Math.round(vx), vy: Math.round(vy) }); v.kbBudget += pow * 0.6; }
  else { v.vx = v.vx * 0.3 + vx; v.vy = v.vy * 0.3 + vy; }
}
function hurt(r, v, amount, att, kind, kx, ky, kbPow, crit) {
  if (v.dead || v.elim || v.god) return false;
  const now = Date.now();
  if (now < v.invulnUntil) return false;
  const red = Math.min(0.8, BW.ARMORS[v.armor].red + 0.06 * r.teams[v.team].up.prot);
  let dmg = amount * (1 - red);
  if (v.absorb > 0) { const a = Math.min(v.absorb, dmg); v.absorb -= a; dmg -= a; }
  v.hp -= dmg; v.lastDmgAt = now; v.invulnUntil = now + (kind === 'melee' ? 300 : 120);
  if (att && att !== v) { v.lastHitBy = att.id; v.lastHitAt = now; }
  knock(r, v, kx, ky, kbPow);
  r.ev(['hit', v.id, Math.round(amount * 10), crit ? 1 : 0, att ? att.id : 0, kind]);
  v.dirty = true;
  if (v.ai && att && att.team !== v.team && !v.ai.enemy && kind === 'melee') v.ai.enemy = att;
  if (v.hp <= 0) die(r, v, kind, att);
  return true;
}
function swing(r, e, ang, now, jump) {
  if (r.game !== 'bw' && MINI.swingBlocked(r, e, now)) return false;
  const kbs = e.held === 'kbstick';
  if (now - e.lastSwing < (e.ctl === 'human' ? (kbs ? 300 : 110) : (kbs ? 520 : 330))) return false;
  e.lastSwing = now; e.ang = ang;
  r.ev(['sw', e.id, q2(ang)]);
  let best = null, bd = 1e9;
  const slack = e.ctl === 'human' ? 18 : 0;
  for (const o of r.ents.values()) {
    if (o === e || o.dead || o.elim || o.team === e.team) continue;
    if (r.game === 'spleef' && ((o.z || 0) !== (e.z || 0) || o.fallUntil)) continue;
    const dx = o.x - e.x, dy = (o.y - 14) - (e.y - 14), d = Math.hypot(dx, dy);
    if (d > BW.MELEE + slack) continue;
    if (d > 24 && Math.abs(angDiff(Math.atan2(dy, dx), ang)) > BW.ARC + 0.25) continue;
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) { if (r.game === 'hide') MINI.missProp(r, e, ang, now); return true; }
  if (r.game === 'spleef') { knock(r, best, best.x - e.x, best.y - e.y, e.sprint ? 500 : 370); r.ev(['hit', best.id, 0, 0, e.id, 'punch']); best.lastHitBy = e.id; best.lastHitAt = now; return true; }
  // Minecraft-style: crits come from hitting while falling out of a jump.
  const sinceHop = now - (e.hopAt || 0);
  const crit = (jump || e.ctl !== 'human') && sinceHop > 120 && sinceHop < 700;
  let dmg = kbs ? 1 : BW.SWORDS[e.sword].dmg + 1.25 * r.teams[e.team].up.sharp;
  if (crit) dmg *= 1.5;
  const kbPow = kbs ? 820 : 300 + (e.sprint ? 230 : e.mv ? 60 : 0);
  if (hurt(r, best, dmg, e, 'melee', best.x - e.x, best.y - e.y, kbPow, crit) && e.sprint && e.ctl === 'human') e.sprint = false;
  return true;
}
function die(r, v, kind, att) {
  if (v.dead) return;
  if (r.game !== 'bw') return MINI.die(r, v, kind, att);
  const now = Date.now();
  if (!att && v.lastHitBy && now - v.lastHitAt < 10000) att = r.ents.get(v.lastHitBy);
  if (att === v || (att && att.team === v.team)) att = null;
  const final = !r.teams[v.team].bed;
  v.dead = true; v.hp = 0; v.stats.deaths++; stopMine(r, v); v.fall = 0; v.vx = v.vy = 0; v.bow = false;
  if (att) {
    att.stats[final ? 'finals' : 'kills']++;
    const loot = RES.map((k) => v.res[k]);
    if (loot.some((n) => n > 0)) { RES.forEach((k, j) => { att.res[k] += loot[j]; }); r.ev(['loot', att.id, ...loot]); }
    att.dirty = true;
  }
  v.res = { iron: 0, gold: 0, dia: 0, em: 0 };
  const kb = v.inv.kbstick; v.inv = emptyInv(); v.inv.kbstick = 0; void kb;
  v.sword = 1; if (v.pick > 1) v.pick--; v.held = 'sword';
  if (final) v.elim = true; else v.respawnAt = now + BW.RESPAWN * 1000;
  r.ev(['die', v.id, kind, att ? att.id : 0, final ? 1 : 0, Math.round(v.x), Math.round(v.y)]);
  r.ev(['gear', v.id, v.sword, v.armor, v.pick]);
  v.dirty = true; r.teamsDirty = true;
  if (v.ai) { v.ai.goal = null; v.ai.path = null; v.ai.enemy = null; }
  checkWin(r);
}
function respawn(r, e) {
  if (r.game !== 'bw') return MINI.respawn(r, e);
  const b = r.map.bases[e.team];
  e.dead = false; e.hp = BW.MAX_HP; e.absorb = 0; e.x = b.spawn.x + (rnd() - 0.5) * 30; e.y = b.spawn.y + (rnd() - 0.5) * 16; e.vx = e.vy = 0;
  e.invulnUntil = Date.now() + 1800; e.fall = 0; e.lastHitBy = 0; e.dirty = true;
  r.ev(['spawn', e.id, Math.round(e.x), Math.round(e.y)]);
  if (e.conn) send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y), spawn: 1 });
}
function nearNpc(r, e, kind) { for (const n of r.map.npcs) if (n.kind === kind && Math.hypot(n.x - e.x, n.y - e.y) < 3.2 * T) return n; return null; }
function buy(r, e, id) {
  if (e.dead || e.elim) return 'dead';
  const s = BW.SHOP_BY_ID[id]; if (!s) return 'bad';
  if (!nearNpc(r, e, 'shop')) return 'far';
  let cost = s.cost;
  if (s.pickTiers) { cost = BW.pickCost(e.pick); if (!cost) return 'max'; }
  if (s.sword && e.sword >= s.sword) return 'owned';
  if (s.armor && e.armor >= s.armor) return 'owned';
  if (s.max && s.give && Object.keys(s.give).some((k) => k !== 'arrows' && e.inv[k] >= s.max)) return 'owned';
  if (!BW.canAfford(e.res, cost)) return 'poor';
  for (const k in cost) e.res[k] -= cost[k];
  if (s.pickTiers) e.pick++;
  if (s.sword) e.sword = s.sword;
  if (s.armor) e.armor = s.armor;
  if (s.give) for (const k in s.give) e.inv[k] = (e.inv[k] || 0) + s.give[k];
  if (s.sword || s.armor || s.pickTiers) r.ev(['gear', e.id, e.sword, e.armor, e.pick]);
  e.dirty = true;
  return 'ok';
}
function upgrade(r, e, id) {
  if (e.dead || e.elim) return 'dead';
  const u = BW.UP_BY_ID[id]; if (!u) return 'bad';
  if (!nearNpc(r, e, 'up')) return 'far';
  const tm = r.teams[e.team], lvl = tm.up[id];
  if (id === 'trap' ? lvl >= 1 : lvl >= u.costs.length) return 'max';
  const cost = u.costs[id === 'trap' ? 0 : lvl];
  if (e.res.dia < cost) return 'poor';
  e.res.dia -= cost; tm.up[id]++; e.dirty = true; r.teamsDirty = true;
  r.ev(['up', e.team, id, tm.up[id], e.id]);
  return 'ok';
}
function useItem(r, e, it, tx, ty, now) {
  if (e.dead || e.elim || !(e.inv[it] > 0)) return false;
  if (now - e.useAt < 250) return false;
  const ang = Math.atan2(ty - e.y, tx - e.x);
  if (it === 'gapple') { if (now - e.eatAt < 1500) return false; e.eatAt = now; e.regenUntil = now + 4000; e.absorb = 4; r.ev(['eat', e.id]); }
  else if (it === 'speed') { e.speedUntil = now + 30000; r.ev(['drink', e.id]); }
  else if (it === 'tnt') {
    const i = tileOf(tx, ty), c = tc(i);
    if (Math.hypot(c.x - e.x, c.y - e.y) > BW.REACH + 30 || !BW.floorAt(r.map, i % W, (i / W) | 0) || BW.solidAt(r.map, i % W, (i / W) | 0)) return false;
    if (r.tnts.some((x) => x.i === i)) return false;
    const tn = { id: nextProj++, i, x: c.x, y: c.y, at: now + 2800, owner: e.id, team: e.team }; r.tnts.push(tn);
    r.ev(['tnt', tn.id, c.x, c.y, 2800]);
  } else if (it === 'fireball' || it === 'pearl' || it === 'egg' || it === 'snow') {
    if (it === 'pearl' && e.carry != null && e.carry >= 0) return false; // no teleporting with the flag
    const sp = it === 'fireball' ? 430 : it === 'pearl' ? 560 : it === 'snow' ? 620 : 400;
    const dist = Math.min(Math.hypot(tx - e.x, ty - e.y), it === 'pearl' ? 12 * T : it === 'snow' ? 9 * T : 14 * T);
    const pj = { id: nextProj++, kind: it === 'fireball' ? 'fb' : it, z: e.z || 0, x: e.x + Math.cos(ang) * 18, y: e.y - 16 + Math.sin(ang) * 18, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: e.id, team: e.team, life: it === 'pearl' || it === 'snow' ? Math.max(0.12, dist / sp) : it === 'egg' ? Math.max(0.3, dist / sp) : 3, placed: 0 };
    r.projs.push(pj); r.ev(['shoot', e.id, pj.kind]);
  } else return false;
  e.useAt = now; e.inv[it]--; if (!e.inv[it] && e.held === it) e.held = r.game === 'spleef' ? 'shovel' : 'sword'; e.dirty = true;
  return true;
}
function shootBow(r, e, ang, pow, now) {
  if (e.dead || e.elim || !e.inv.bow || !(e.inv.arrows > 0) || now - e.useAt < 300) return false;
  pow = clamp(Number(pow) || 0, 0.15, 1);
  e.useAt = now; e.inv.arrows--; e.dirty = true;
  const sp = 520 + 760 * pow;
  r.projs.push({ id: nextProj++, kind: 'arrow', x: e.x + Math.cos(ang) * 18, y: e.y - 16 + Math.sin(ang) * 18, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: e.id, team: e.team, life: 1.3, dmg: 1.5 + 5 * pow });
  r.ev(['shoot', e.id, 'arrow']);
  return true;
}
function explode(r, x, y, rad, maxDmg, owner, kind) {
  const m = r.map, R = rad * T;
  const tx0 = Math.floor((x - R) / T), tx1 = Math.floor((x + R) / T), ty0 = Math.floor((y - R) / T), ty1 = Math.floor((y + R) / T);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!BW.inb(tx, ty)) continue;
    const i = ty * W + tx, cx = tx * T + T / 2, cy = ty * T + T / 2; if (Math.hypot(cx - x, cy - y) > R) continue;
    let f = m.f[i], fc = m.fc[i], w = m.w[i], wc = m.wc[i], ch = false;
    if (w && BW.BLOCKS[w].blast) { w = 0; wc = 0; ch = true; }
    if (f && BW.BLOCKS[f].blast && !m.w[i]) { f = 0; fc = 0; ch = true; }
    if (ch) setTile(r, i, f, fc, w, wc);
  }
  const att = r.ents.get(owner) || null;
  for (const v of r.ents.values()) {
    if (v.dead || v.elim) continue;
    const dx = v.x - x, dy = v.y - y, d = Math.hypot(dx, dy); if (d > R * 1.35) continue;
    const k = 1 - d / (R * 1.35), self = v === att;
    if (att && v.team === att.team && !self) { knock(r, v, dx || 1, dy, 300 * k); continue; }
    v.invulnUntil = 0;
    hurt(r, v, maxDmg * k * (self ? 0.35 : 1), self ? null : att, kind, dx || 0.01, dy, (kind === 'tnt' ? 760 : 640) * (0.45 + k * 0.7), false);
  }
  r.ev(['ex', Math.round(x), Math.round(y), rad, kind]);
}

function checkWin(r) {
  if (r.state !== 'play') return;
  if (r.game !== 'bw') return MINI.checkEnd(r, Date.now());
  const alive = [];
  for (let t = 0; t < 4; t++) {
    const tm = r.teams[t];
    const any = [...r.ents.values()].some((e) => e.team === t && !e.elim);
    if (!tm.elim && !tm.bed && !any) { tm.elim = true; r.ev(['elim', t]); r.teamsDirty = true; }
    if (!tm.elim) alive.push(t);
  }
  if (alive.length <= 1) endMatch(r, alive.length ? alive[0] : -1);
}
function endMatch(r, winner) {
  if (r.state !== 'play') return;
  r.state = 'end'; r.winner = winner; flush(r);
  const stats = [...r.ents.values()].map((e) => ({ id: e.id, nick: e.nick, team: e.team, bot: e.bot, look: e.look, ...e.stats }));
  const mult = r.kind === 'public' ? 1 : 0.5;
  const extra = r.game !== 'bw' ? MINI.endInfo(r) : {};
  for (const e of r.ents.values()) {
    if (e.bot || !e.cid) continue;
    const win = r.game !== 'bw' ? MINI.isWinner(r, e, winner) : e.team === winner;
    const amount = (r.game !== 'bw' ? MINI.reward(r, e, win) : 15 + (win ? 100 : 0) + e.stats.kills * 3 + e.stats.finals * 8 + e.stats.beds * 25) * mult;
    let rew = null; try { rew = bwReward(e.cid, amount, { win, nick: e.nick, kills: e.stats.kills | 0, finals: e.stats.finals | 0, beds: e.stats.beds | 0, deaths: e.stats.deaths | 0 }); } catch (err) {}
    if (e.conn) send(e.conn, { t: 'end', game: r.game, winner, win, you: e.id, team: e.team, stats, reward: rew, mins: Math.max(0, (Date.now() - r.goAt) / 60000), ...extra });
  }
  setTimeout(() => killRoom(r), 60000);
}

// ============================================================ bots
function newAI(r, e) { return { role: 'atk', goal: null, path: null, pi: 0, thinkAt: 0, enemy: null, swingAt: 0, reactAt: 0, placeAt: 0, stuckT: 0, lx: 0, ly: 0, built: false, rushAt: 0, fbAt: 0, strafe: rnd() < 0.5 ? 1 : -1, strafeAt: 0 }; }
function blocksOf(e) { return e.inv.wool + e.inv.wood + e.inv.end; }
function blockKey(e) { return e.inv.wool ? 'wool' : e.inv.wood ? 'wood' : e.inv.end ? 'end' : e.inv.obby ? 'obby' : null; }
function baseL(b, a, bb) { return [b.cx + a * b.right[0] + bb * b.inward[0], b.cy + a * b.right[1] + bb * b.inward[1]]; }
function inRect(rc, x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx >= rc[0] - 1 && tx <= rc[2] + 1 && ty >= rc[1] - 1 && ty <= rc[3] + 1; }

// A* over tiles. Walking = 1, bridging over void = 2.4 (needs blocks), mining a wall = by hardness.
const AS = { g: new Float32Array(N), came: new Int32Array(N), seen: new Uint32Array(N), closed: new Uint32Array(N), gen: 0 };
function astar(r, from, goalSet, gx, gy, opt) {
  const m = r.map, bridge = opt.bridge, mine = opt.mine, maxN = opt.max || 7000;
  const gen = ++AS.gen;
  const heap = []; // [f, i]
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, rr = l + 1; let s = k; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (rr < heap.length && heap[rr][0] < heap[s][0]) s = rr; if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s; } } return top; };
  const h = (i) => (Math.abs((i % W) - gx) + Math.abs(((i / W) | 0) - gy)) * 1.05;
  AS.seen[from] = gen; AS.g[from] = 0; AS.came[from] = -1; push(h(from), from);
  let n = 0;
  while (heap.length) {
    const [, i] = pop();
    if (AS.closed[i] === gen) continue; AS.closed[i] = gen;
    if (goalSet(i)) { const path = []; let k = i; while (k !== from && k >= 0) { path.push(k); k = AS.came[k]; } return path.reverse(); }
    if (++n > maxN) break;
    const tx = i % W, ty = (i / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = tx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = ty + (d === 2 ? 1 : d === 3 ? -1 : 0);
      if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) continue;
      const j = ny * W + nx;
      let c;
      if (m.obj[j] || m.g[j] === G.ROCK) { if (!goalSet(j) || m.obj[j] !== 1) continue; c = 1; }
      else if (m.w[j]) { if (!mine) continue; c = 2 + BW.BLOCKS[m.w[j]].hard * 2.2; }
      else if (m.g[j] || m.f[j]) c = 1;
      else { if (!bridge || m.noBuild[j]) continue; c = 2.4; }
      const ng = AS.g[i] + c;
      if (AS.seen[j] === gen && ng >= AS.g[j]) continue;
      AS.seen[j] = gen; AS.g[j] = ng; AS.came[j] = i; push(ng + h(j), j);
    }
  }
  return null;
}
function pathTo(r, e, gi, opt) { const gx = gi % W, gy = (gi / W) | 0; return astar(r, tileOf(e.x, e.y), (i) => i === gi, gx, gy, opt); }
function pathNear(r, e, ti, opt) { // any walkable/buildable tile 4-adjacent to ti
  const gx = ti % W, gy = (ti / W) | 0;
  return astar(r, tileOf(e.x, e.y), (i) => { const x = i % W, y = (i / W) | 0; return Math.abs(x - gx) + Math.abs(y - gy) === 1 && !r.map.obj[i]; }, gx, gy, opt);
}
function botWish(r, e) {
  const R = e.res, inv = e.inv, bl = blocksOf(e), hard = r.diff === 'hard';
  if (bl < 16 && R.iron >= 4) return 'wool';
  if (e.sword < 2 && R.iron >= 10) return 'sword2';
  if (e.pick < 1 && R.iron >= 10 && bl >= 16) return 'pick';
  if (e.armor < 2 && R.iron >= 24) return 'armor2';
  if (!e.ai.built && e.ai.role === 'def' && r.teams[e.team].bed) { if (hard && R.iron >= 24 && !inv.end) return 'end'; if (R.gold >= 4 && !inv.wood && r.diff !== 'easy') return 'wood'; }
  if (bl < 40 && R.iron >= 4) return 'wool';
  if (e.sword < 3 && R.gold >= 7) return 'sword3';
  if (e.armor < 3 && R.gold >= 12) return 'armor3';
  if (!inv.gapple && R.gold >= 3 && r.diff !== 'easy') return 'gapple';
  if (SK[r.diff].fireball && !inv.fireball && R.iron >= 40) return 'fireball';
  if (e.pick < 2 && R.iron >= 10) return 'pick';
  if (e.sword < 4 && R.em >= 4) return 'sword4';
  if (e.armor < 4 && R.em >= 6) return 'armor4';
  return null;
}
function upWish(r, e) {
  const up = r.teams[e.team].up, d = e.res.dia;
  if (!up.sharp && d >= 4) return 'sharp';
  if (up.prot < 1 && d >= 2) return 'prot';
  if (up.forge < 1 && d >= 2) return 'forge';
  if (!up.heal && d >= 1) return 'heal';
  if (up.prot < 2 && d >= 4) return 'prot';
  if (up.forge < 2 && d >= 4) return 'forge';
  if (up.haste < 1 && d >= 2) return 'haste';
  return null;
}
function bedRing(r, t) {
  const b = r.map.bases[t], out = [];
  for (let a = -1; a <= 1; a++) for (let bb = 1; bb <= 4; bb++) { if (a === 0 && (bb === 2 || bb === 3)) continue; const p = baseL(b, a, bb); out.push(p[1] * W + p[0]); }
  return out;
}
function foeNear(r, e, maxD) {
  let best = null, bd = maxD;
  for (const o of r.ents.values()) {
    if (o.team === e.team || o.dead || o.elim) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function clearLine(r, a, b) { // walkable straight line between two entities?
  const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 12);
  for (let k = 1; k < n; k++) { const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n; const tx = Math.floor(x / T), ty = Math.floor(y / T); if (!BW.floorAt(r.map, tx, ty) || BW.solidAt(r.map, tx, ty)) return false; }
  return true;
}
function think(r, e, now) {
  const ai = e.ai, tm = r.teams[e.team], el = (now - r.goAt) / 1000, sk = SK[r.diff];
  if (!ai.rushAt) ai.rushAt = sk.rushAt * (ai.role === 'def' ? 1.5 : 1) * (0.8 + rnd() * 0.4);
  if (e.hp < 9 && e.inv.gapple) useItem(r, e, 'gapple', e.x, e.y, now);
  if (e.inv.speed && ai.goal && ai.goal.type === 'attack') useItem(r, e, 'speed', e.x, e.y, now);
  // Intruders in our base pull every nearby bot back.
  const base = r.map.bases[e.team];
  let intr = null;
  if (tm.bed) for (const o of r.ents.values()) if (o.team !== e.team && !o.dead && !o.elim && inRect(base.rect, o.x, o.y)) { intr = o; break; }
  const foe = foeNear(r, e, 6.5 * T);
  if (foe && (clearLine(r, e, foe) || Math.hypot(foe.x - e.x, foe.y - e.y) < 70)) { ai.enemy = foe; return; }
  if (ai.enemy && (ai.enemy.dead || ai.enemy.elim || Math.hypot(ai.enemy.x - e.x, ai.enemy.y - e.y) > 9 * T || !clearLine(r, e, ai.enemy))) ai.enemy = null;
  if (ai.enemy) return;
  // Fireball people bridging at us.
  if (foe && e.inv.fireball && now > ai.fbAt && sk.fireball) {
    const ft = tileOf(foe.x, foe.y);
    if (r.map.f[ft] && !r.map.g[ft]) { ai.fbAt = now + 5000; e.held = 'fireball'; useItem(r, e, 'fireball', foe.x, foe.y - 10, now); return; }
  }
  if (intr && Math.hypot(intr.x - e.x, intr.y - e.y) < 22 * T && (!ai.goal || ai.goal.type !== 'defend' || ai.goal.t !== intr.id)) {
    ai.goal = { type: 'defend', t: intr.id }; ai.path = null;
  }
  if (ai.goal && !goalDone(r, e, ai.goal, now)) { if (!ai.path && !ai.goal.here) plan(r, e); return; }
  ai.goal = choose(r, e, now, el); ai.path = null; plan(r, e);
}
function goalDone(r, e, g, now) {
  if (g.until && now > g.until) return true;
  if (g.type === 'defend') { const o = r.ents.get(g.t); return !o || o.dead || o.elim || !inRect(r.map.bases[e.team].rect, o.x, o.y); }
  if (g.type === 'attack') { const bed = r.map.beds[g.team]; return !bed.alive; }
  if (g.type === 'hunt') { const o = r.ents.get(g.t); return !o || o.dead || o.elim; }
  if (g.type === 'collect') return !!botWish(r, e) && !g.dia;
  if (g.type === 'build') return e.ai.built || !blocksOf(e);
  return !!g.done;
}
function choose(r, e, now, el) {
  const ai = e.ai, tm = r.teams[e.team], bl = blocksOf(e);
  if (tm.bed && !ai.built && ai.role === 'def' && bl >= 10) return { type: 'build' };
  if (botWish(r, e)) return { type: 'shop' };
  if (upWish(r, e)) return { type: 'upgrade' };
  if (ai.role === 'def' && el > 70 && e.res.dia < 4 && bl >= 26 && rnd() < 0.35) {
    let best = null, bd = 1e9; for (let gi = 0; gi < r.gens.length; gi++) { const g = r.gens[gi]; if (g.kind !== 'dia') continue; const d = Math.hypot(g.x - e.x, g.y - e.y); if (d < bd) { bd = d; best = gi; } }
    if (best != null) return { type: 'collect', gi: best, dia: true, until: now + 40000 };
  }
  if (el >= ai.rushAt && bl >= 18) {
    let tgt = -1, bd = 1e9;
    for (let t = 0; t < 4; t++) { if (t === e.team || !r.map.beds[t].alive) continue; const b = r.map.beds[t]; const d = Math.hypot(b.x - e.x, b.y - e.y) * (0.8 + rnd() * 0.5); if (d < bd) { bd = d; tgt = t; } }
    if (tgt >= 0) return { type: 'attack', team: tgt, until: now + 90000 };
    const o = foeNear(r, e, 1e9); if (o) return { type: 'hunt', t: o.id, until: now + 30000 };
  }
  const myGen = r.gens.findIndex((g) => g.team === e.team && g.kind === 'iron');
  return { type: 'collect', gi: myGen, until: now + 5000 + rnd() * 9000 };
}
function standTile(r, e) { // where a builder stands to wall in the bed
  const b = r.map.bases[e.team];
  for (const a of [-2, 2]) { const p = baseL(b, a, 2); const i = p[1] * W + p[0]; if (BW.floorAt(r.map, p[0], p[1]) && !BW.solidAt(r.map, p[0], p[1])) return i; }
  const p = baseL(b, 0, 0); return p[1] * W + p[0];
}
function plan(r, e) {
  const ai = e.ai, g = ai.goal; if (!g) return;
  const bridge = blocksOf(e) > 0, opt = { bridge, mine: true };
  let path = null;
  if (g.type === 'collect') path = pathTo(r, e, r.gens[g.gi].tile, { bridge: g.dia ? bridge : false, mine: g.dia });
  else if (g.type === 'shop' || g.type === 'upgrade') { const n = r.map.npcs.find((x) => x.team === e.team && x.kind === (g.type === 'shop' ? 'shop' : 'up')); path = pathNear(r, e, n.tile, { bridge: false, mine: true }); if (!path) path = pathNear(r, e, n.tile, opt); }
  else if (g.type === 'build') path = pathTo(r, e, standTile(r, e), { bridge: false, mine: true });
  else if (g.type === 'attack') { const b = r.map.beds[g.team]; path = astar(r, tileOf(e.x, e.y), (i) => { const x = i % W, y = (i / W) | 0; return !r.map.obj[i] && [b.foot, b.head].some((bi) => Math.abs(x - bi % W) + Math.abs(y - ((bi / W) | 0)) === 1); }, Math.floor(b.x / T), Math.floor(b.y / T), opt); }
  else if (g.type === 'hunt' || g.type === 'defend') { const o = r.ents.get(g.t); if (o) path = pathTo(r, e, tileOf(o.x, o.y), opt); }
  if (!path) { // can't get there (out of blocks?) -> go home and gear up
    if (g.type === 'collect' && !g.dia) { g.here = true; ai.path = null; return; }
    ai.goal = { type: 'collect', gi: r.gens.findIndex((x) => x.team === e.team && x.kind === 'iron'), until: Date.now() + 6000 };
    ai.path = pathTo(r, e, r.gens[ai.goal.gi].tile, { bridge: false, mine: true }); ai.pi = 0; ai.planAt = Date.now();
    if (!ai.path) ai.goal.here = true;
    return;
  }
  ai.path = path; ai.pi = 0; ai.planAt = Date.now();
}
function arrive(r, e, now) {
  const ai = e.ai, g = ai.goal; if (!g) return;
  if (g.type === 'shop') { let k = 0, w; while (k++ < 8 && (w = botWish(r, e))) if (buy(r, e, w) !== 'ok') break; g.done = true; }
  else if (g.type === 'upgrade') { let k = 0, w; while (k++ < 6 && (w = upWish(r, e))) if (upgrade(r, e, w) !== 'ok') break; g.done = true; }
  else if (g.type === 'hunt' || g.type === 'defend') { ai.path = null; ai.planAt = 0; }
  else g.here = true;
}
function moveToward(r, e, x, y, dt, slow) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy); if (d < 0.5) { e.mv = false; return d; }
  const sp = BW.SPEED * (Date.now() < e.speedUntil ? 1.35 : 1) * (Date.now() < e.slowUntil ? 0.55 : 1) * (slow || 1);
  const st = Math.min(d, sp * dt);
  BW.move(r.map, e, dx / d * st, dy / d * st, true);
  e.mv = true; e.ang = Math.atan2(dy, dx);
  return d;
}
function aiTick(r, e, now) {
  const ai = e.ai;
  e.mv = false;
  if (e.dead || e.elim || now < r.goAt) return;
  if (Math.hypot(e.vx, e.vy) > 70) return; // flying from a hit
  if (now >= ai.thinkAt) { ai.thinkAt = now + 300 + rnd() * 250; think(r, e, now); }
  // --- fighting
  if (ai.enemy) { fight(r, e, now); return; }
  const g = ai.goal; if (!g) return;
  // --- path following (bridge over void, dig through walls)
  if (ai.path) {
    if ((g.type === 'hunt' || g.type === 'defend') && now - ai.planAt > 2500) { ai.path = null; return; }
    if (stepPath(r, e, now) === 'done') arrive(r, e, now);
    return;
  }
  atGoal(r, e, now, g);
}
function fight(r, e, now) {
  const ai = e.ai, sk = SK[r.diff];
  {
    const f = ai.enemy;
    if (f.dead || f.elim) { ai.enemy = null; return; }
    if (e.held !== 'sword' && e.held !== 'kbstick') e.held = e.inv.kbstick && rnd() < 0.3 ? 'kbstick' : 'sword';
    stopMine(r, e);
    const dx = f.x - e.x, dy = f.y - e.y, d = Math.hypot(dx, dy);
    if (now > ai.strafeAt) { ai.strafeAt = now + 500 + rnd() * 900; ai.strafe = rnd() < 0.5 ? 1 : -1; }
    if (d > 46) moveToward(r, e, f.x - dy / d * 26 * ai.strafe * sk.aim, f.y + dx / d * 26 * ai.strafe * sk.aim, DT);
    else moveToward(r, e, e.x - dy / d * 30 * ai.strafe, e.y + dx / d * 30 * ai.strafe, DT, 0.6);
    e.ang = Math.atan2(dy, dx) + (rnd() - 0.5) * sk.aim;
    e.sprint = d > 60;
    if (d < BW.MELEE + 30 && now - (e.hopAt || 0) > 900 && rnd() < (r.diff === 'hard' ? 0.05 : r.diff === 'normal' ? 0.025 : 0.008)) { e.hopAt = now; r.ev(['hop', e.id]); }
    if (d < BW.MELEE - 6) {
      if (!ai.reactAt) ai.reactAt = now + sk.react * (0.7 + rnd() * 0.6);
      if (now >= ai.reactAt && now >= ai.swingAt) { swing(r, e, e.ang, now); ai.swingAt = now + sk.swing * (0.8 + rnd() * 0.4); }
    } else ai.reactAt = 0;
  }
}
// Follow ai.path one tick: walk, bridge over void, dig through walls. -> 'done' | 'go' | 'fail'
function stepPath(r, e, now) {
  const ai = e.ai, sk = SK[r.diff];
  {
    if (ai.pi >= ai.path.length) { ai.path = null; return 'done'; }
    const i = ai.path[ai.pi], c = tc(i), m = r.map;
    if (m.obj[i] || m.g[i] === G.ROCK) { ai.path = null; return 'fail'; }
    if (m.w[i]) {
      e.held = e.pick ? 'pick' : 'sword'; e.ang = Math.atan2(c.y - e.y, c.x - e.x);
      if (Math.hypot(c.x - e.x, c.y - e.y) > T * 1.6) { moveToward(r, e, c.x, c.y, DT); return 'go'; }
      if (mineStep(r, e, i, DT) === 'none' && m.noMine && m.noMine[i]) ai.path = null;
      return 'go';
    }
    if (!m.g[i] && !m.f[i]) {
      const key = blockKey(e); if (!key) { ai.path = null; if (r.game === 'bw') ai.goal = null; return 'fail'; }
      e.held = key; e.ang = Math.atan2(c.y - e.y, c.x - e.x);
      const prev = ai.pi > 0 ? tc(ai.path[ai.pi - 1]) : null;
      if (prev && Math.hypot(prev.x - e.x, prev.y - e.y) > 8) { moveToward(r, e, prev.x, prev.y, DT); return 'go'; }
      if (now >= ai.placeAt) { ai.placeAt = now + sk.place * (0.8 + rnd() * 0.4); if (!place(r, e, i, key)) { ai.fails = (ai.fails || 0) + 1; if (ai.fails > 4) { ai.fails = 0; ai.path = null; } } else ai.fails = 0; }
      return 'go';
    }
    if (e.held !== 'sword' && !(ai.goal && ai.goal.type === 'attack') && r.game !== 'hide') e.held = 'sword';
    const d = moveToward(r, e, c.x, c.y, DT);
    if (d < 6) ai.pi++;
    // stuck?
    if (Math.hypot(e.x - ai.lx, e.y - ai.ly) > 6) { ai.lx = e.x; ai.ly = e.y; ai.stuckT = now; }
    else if (now - ai.stuckT > 1800) { ai.stuckT = now; ai.path = null; BW.move(r.map, e, (rnd() - 0.5) * 20, (rnd() - 0.5) * 20, true); return 'fail'; }
    return 'go';
  }
}
function atGoal(r, e, now, g) {
  const ai = e.ai;
  if (g.type === 'attack') {
    const bed = r.map.beds[g.team];
    if (!bed.alive) { ai.goal = null; return; }
    const ti = [bed.foot, bed.head].sort((a, b) => { const A = tc(a), B = tc(b); return Math.hypot(A.x - e.x, A.y - e.y) - Math.hypot(B.x - e.x, B.y - e.y); })[0];
    const c = tc(ti); e.held = e.pick ? 'pick' : 'sword'; e.ang = Math.atan2(c.y - e.y, c.x - e.x);
    const res = mineStep(r, e, ti, DT);
    if (res === 'far' || res === 'none') { ai.path = null; plan(r, e); }
    return;
  }
  if (g.type === 'build') {
    const ring = bedRing(r, e.team).filter((i) => !r.map.w[i] && BW.canPlace(r.map, i, aliveEnts(r)) === 'wall');
    if (!ring.length || !blocksOf(e)) { ai.built = true; g.done = true; return; }
    const sk2 = SK[r.diff];
    const key = r.diff === 'hard' && e.inv.end ? 'end' : r.diff !== 'easy' && e.inv.wood ? 'wood' : blockKey(e);
    e.held = key; const c = tc(ring[0]); e.ang = Math.atan2(c.y - e.y, c.x - e.x);
    if (now >= ai.placeAt) { ai.placeAt = now + sk2.place; if (!place(r, e, ring[0], key)) { ai.bfail = (ai.bfail || 0) + 1; if (ai.bfail > 6) { ai.built = true; g.done = true; } } }
    return;
  }
  if (g.type === 'collect') { e.held = 'sword'; const gg = r.gens[g.gi]; if (gg && Math.hypot(gg.x - e.x, gg.y - e.y) > 20) moveToward(r, e, gg.x, gg.y, DT, 0.5); if (g.dia && e.res.dia >= 4) g.done = true; return; }
  if (g.type === 'hunt' || g.type === 'defend') { ai.path = null; plan(r, e); }
}

// ============================================================ tick
function physics(r, e, dt) {
  const sp = Math.hypot(e.vx, e.vy);
  if (sp > 4) {
    BW.move(r.map, e, e.vx * dt, e.vy * dt, false);
    const k = Math.exp(-6.5 * dt); e.vx *= k; e.vy *= k;
  } else { e.vx = 0; e.vy = 0; }
}
function tickRoom(r, now) {
  if (r.state === 'lobby') {
    if (r.startAt && now >= r.startAt) startMatch(r);
    else if (r.kind === 'public' && now - (r.pushAt || 0) > 1000) { r.pushAt = now; pushRoom(r); }
    return;
  }
  if (r.state !== 'play') return;
  const m = r.map;
  if (humans(r).length) r.lastHuman = now;
  else if (now - r.lastHuman > 45000) { r.state = 'dead'; killRoom(r); return; }
  if (r.game !== 'bw') { MINI.tick(r, now); if (r.state !== 'play') return; tickProj(r, now); if (r.state === 'play') flush(r); return; }
  const el = (now - r.goAt) / 1000;
  // timeline
  while (r.tl < BW.TIMELINE.length && el >= BW.TIMELINE[r.tl].t) {
    const ev = BW.TIMELINE[r.tl].ev; r.tl++;
    if (ev === 'dia2') r.tier.dia = 1; if (ev === 'em2') r.tier.em = 1; if (ev === 'dia3') r.tier.dia = 2; if (ev === 'em3') r.tier.em = 2;
    r.ev(['tl', r.tl - 1]);
    if (ev === 'beds') for (const b of m.beds) if (b.alive) destroyBed(r, b, null);
    if (ev === 'end') {
      let best = -1, bs = -1;
      for (let t = 0; t < 4; t++) { if (r.teams[t].elim) continue; let s = 0; for (const e of r.ents.values()) if (e.team === t) s += (e.elim ? 0 : 1000) + e.stats.finals * 10 + e.stats.kills; if (s > bs) { bs = s; best = t; } }
      endMatch(r, best); return;
    }
  }
  // generators (only once the match has started)
  if (now >= r.goAt) for (let gi = 0; gi < r.gens.length; gi++) {
    const g = r.gens[gi]; let every;
    if (g.team != null) {
      const tm = r.teams[g.team]; if (tm.elim) continue;
      if (g.kind === 'em') { if (tm.up.forge < 3) continue; every = 45; }
      else every = BW.GEN[g.kind].every / BW.GEN.forgeMult[tm.up.forge];
    } else every = BW.GEN[g.kind].every[r.tier[g.kind]];
    if (g.n >= BW.GEN[g.kind].cap) { g.acc = 0; continue; }
    g.acc += DT;
    if (g.acc >= every) { g.acc -= every; g.n++; g.last = now; r.ev(['gen', gi, g.n, Math.round(every * 10)]); }
  }
  // entities
  for (const e of r.ents.values()) {
    if (e.dead) { if (!e.elim && now >= e.respawnAt) respawn(r, e); continue; }
    if (e.elim) continue;
    if (e.ctl === 'ai') { physics(r, e, DT); aiTick(r, e, now); }
    else {
      e.kbBudget *= 0.86;
      if (e.mineReq && now < e.mineReq.until) mineStep(r, e, e.mineReq.i, DT); else if (e.mine) stopMine(r, e);
    }
    // the void
    if (!BW.groundUnder(m, e.x, e.y) && !e.god) { e.fall += DT; if (e.fall > (e.ctl === 'human' ? 0.3 : 0.08)) die(r, e, 'void', null); continue; }
    e.fall = 0;
    // pick up generator drops
    for (let gi = 0; gi < r.gens.length; gi++) {
      const g = r.gens[gi]; if (!g.n) continue;
      if (Math.abs(g.x - e.x) < 34 && Math.abs(g.y - e.y) < 34) { e.res[g.kind] += g.n; r.ev(['pick', e.id, gi, g.n]); g.n = 0; e.dirty = true; }
    }
    // healing
    const tm = r.teams[e.team];
    let heal = 0;
    if (now - e.lastDmgAt > 5000) heal += 0.45;
    if (tm.up.heal && inRect(m.bases[e.team].rect, e.x, e.y)) heal += 1;
    if (now < e.regenUntil) heal += 2.2;
    if (heal && e.hp < BW.MAX_HP) { e.hp = Math.min(BW.MAX_HP, e.hp + heal * DT); }
    if (Math.ceil(e.hp) !== e.lastHp) { e.lastHp = Math.ceil(e.hp); e.dirty = true; }
    // traps
    for (let t = 0; t < 4; t++) {
      if (t === e.team || !r.teams[t].up.trap || !r.teams[t].bed) continue;
      if (inRect(m.bases[t].rect, e.x, e.y)) {
        r.teams[t].up.trap = 0; e.slowUntil = now + 6000; r.teamsDirty = true;
        r.ev(['trap', t, e.id]);
        if (e.conn) send(e.conn, { t: 'slow', ms: 6000 });
      }
    }
  }
  tickProj(r, now);
  if (r.state !== 'play') return;
  flush(r);
}
function tickProj(r, now) {
  const m = r.map;
  for (let k = r.projs.length - 1; k >= 0; k--) {
    const p = r.projs[k]; let done = false;
    const steps = 3;
    for (let s = 0; s < steps && !done; s++) {
      p.x += p.vx * DT / steps; p.y += p.vy * DT / steps; p.life -= DT / steps;
      const ptx = Math.floor(p.x / T), pty = Math.floor((p.y + 16) / T);
      if (p.kind === 'egg') {
        const i = pty * W + ptx;
        if (BW.inb(ptx, pty) && !m.g[i] && !m.f[i] && !m.noBuild[i] && !m.obj[i] && p.placed < 30) { setTile(r, i, 1, p.team, 0, 0); p.placed++; }
      }
      if (BW.solidAt(m, ptx, pty) && p.kind !== 'egg') { done = true; break; }
      if (p.kind !== 'egg' && p.kind !== 'pearl') for (const v of r.ents.values()) {
        if (v.dead || v.elim || v.team === p.team || v.id === p.owner) continue;
        if (r.game === 'spleef' && ((v.z || 0) !== (p.z || 0) || v.fallUntil)) continue;
        if (Math.hypot(v.x - p.x, v.y - 16 - p.y) < 20) {
          if (p.kind === 'arrow') hurt(r, v, p.dmg, r.ents.get(p.owner), 'arrow', p.vx, p.vy, 220, false);
          else if (p.kind === 'snow') { MINI.snowHit(r, v, p); }
          done = true; break;
        }
      }
      if (p.life <= 0) done = true;
    }
    if (done) {
      r.projs.splice(k, 1);
      if (p.kind === 'fb') explode(r, p.x, p.y + 16, 1.7, 4.5, p.owner, 'fireball');
      else if (p.kind === 'pearl') {
        const o = r.ents.get(p.owner);
        if (o && !o.dead && !o.elim) {
          let x = clamp(p.x, T, (W - 1) * T), y = clamp(p.y + 16, T, (H - 1) * T);
          for (let s = 0; s < 6 && BW.hits(m, x, y, false); s++) { x -= p.vx * 0.02; y -= p.vy * 0.02; }
          r.ev(['tp', o.id, Math.round(o.x), Math.round(o.y), Math.round(x), Math.round(y)]);
          o.x = x; o.y = y; o.kbBudget += 900;
          if (o.conn) send(o.conn, { t: 'pos', x: Math.round(x), y: Math.round(y) });
          hurt(r, o, 1, null, 'pearl', 0, 0, 0, false);
        }
      } else if (p.kind === 'arrow') r.ev(['arrow', Math.round(p.x), Math.round(p.y)]);
      else if (p.kind === 'snow') MINI.snowLand(r, p);
    }
  }
  // TNT
  for (let k = r.tnts.length - 1; k >= 0; k--) { const tn = r.tnts[k]; if (now >= tn.at) { r.tnts.splice(k, 1); explode(r, tn.x, tn.y, 2.6, 9, tn.owner, 'tnt'); } }
}
function flags(e, now) {
  return (e.dead ? 1 : 0) | (e.mv ? 2 : 0) | (e.mine ? 4 : 0) | (e.bow ? 8 : 0) | (now < e.regenUntil ? 16 : 0) | (now < e.speedUntil ? 32 : 0) | (now < e.invulnUntil - 400 ? 64 : 0) | (e.elim ? 128 : 0) | (e.ctl === 'ai' && !e.bot ? 256 : 0) | (e.god ? 512 : 0);
}
function flush(r) {
  const now = Date.now();
  const p = [];
  for (const e of r.ents.values()) { const a = [e.id, Math.round(e.x), Math.round(e.y), q2(e.ang), flags(e, now), HELD.indexOf(e.held), Math.ceil(e.hp)]; if (r.game !== 'bw') a.push(MINI.extra(r, e, now)); p.push(a); }
  const pr = r.projs.map((x) => [x.id, x.kind, Math.round(x.x), Math.round(x.y)]);
  const msg = { t: 's', n: now, p, pr };
  if (r.events.length) { msg.e = r.events; r.events = []; }
  if (r.teamsDirty) { r.teamsDirty = false; msg.teams = teamsInfo(r); }
  if (r.game !== 'bw') MINI.snapExtra(r, msg, now);
  const s = JSON.stringify(msg);
  for (const e of r.ents.values()) if (e.conn) {
    send(e.conn, s);
    if (e.dirty) { e.dirty = false; send(e.conn, meMsg(e)); }
  }
}
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) { try { tickRoom(r, now); } catch (err) { console.error('bedwars tick', err && err.stack); } }
  if (++spaceTick % 2 === 0) { try { tickSpace(HUB, now); for (const r of rooms.values()) if (r.state === 'lobby') tickSpace(r.space, now); } catch (err) { console.error('bedwars space', err && err.stack); } }
}, TICK);
let spaceTick = 0;
// Drop dead sockets.
setInterval(() => {
  for (const c of conns) { if (c.alive === false) { try { c.ws.terminate(); } catch (e) {} continue; } c.alive = false; try { c.ws.ping(); } catch (e) {} }
  for (const r of rooms.values()) if (r.state === 'lobby' && !r.members.length) killRoom(r);
}, 15000);

// ============================================================ connections
function lobbyList() {
  const out = { solo: 0, duos: 0, squads: 0, ctf: 0, spleef: 0, hide: 0, playing: 0, hub: HUB.conns.size, inGame: { bw: 0, ctf: 0, spleef: 0, hide: 0 } };
  for (const r of rooms.values()) {
    if (r.state === 'lobby' && r.kind === 'public') out[r.mode] = (out[r.mode] || 0) + r.members.length;
    if (r.state === 'play') { const n = humans(r).length; out.playing += n; out.inGame[r.game] = (out.inGame[r.game] || 0) + n; }
  }
  return out;
}
export function bwOnline() { return lobbyList(); }
export function handleBedwarsUpgrade(req, socket, head) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    const { cid, nick } = worldIdentity(req);
    if (!cid) { try { ws.send(JSON.stringify({ t: 'err', code: 'login', msg: 'Log in to ScrollHub to play Bedwars.' })); ws.close(4000); } catch (e) {} return; }
    const c = { ws, cid, nick: String(nick || 'Guest').slice(0, 20), look: worldLook(cid), room: null, ent: null, space: null, pid: nextPid++, alive: true, tok: 40, tokAt: Date.now() };
    c.owner = !!(req._auth && OWNERS.has(String(req._auth.username || '').toLowerCase()));
    // One session per account: the newest tab wins and takes over the old one's seat.
    for (const o of [...conns]) if (o.cid === cid) {
      try { o.ws.send(JSON.stringify({ t: 'err', code: 'replaced', msg: 'You opened Bedwars in another tab.' })); } catch (e) {}
      const r = o.room; o.room = null; conns.delete(o); leaveSpace(o);
      if (r) { if (r.state === 'lobby') { const mb = r.members.find((x) => x.conn === o); if (mb) { mb.conn = c; c.room = r; } } else if (r.state === 'play' && o.ent) { o.ent.conn = null; } }
      try { o.ws.terminate(); } catch (e) {}
    }
    conns.add(c);
    ws.on('pong', () => { c.alive = true; });
    send(c, { t: 'hello', now: Date.now(), nick: c.nick, look: c.look, stats: bwStats(cid), online: lobbyList(), qc: BW_QC, owner: c.owner });
    // Rejoin a match in progress.
    if (!c.room) for (const r of rooms.values()) {
      if (r.state === 'play') { const e = [...r.ents.values()].find((x) => x.cid === cid && !x.bot); if (e) { e.conn = c; e.ctl = 'human'; c.room = r; c.ent = e; e.dirty = true; r.ev(['dc', e.id, 0]); send(c, fullState(r, e)); break; } }
      if (r.state === 'lobby') { const mb = r.members.find((x) => x.cid === cid); if (mb) { mb.conn = c; c.room = r; pushRoom(r); break; } }
    }
    if (c.room && c.room.state === 'lobby') { enterSpace(c, c.room.space); pushRoom(c.room); }
    else if (!c.room) goHub(c);
    ws.on('message', (buf, isBinary) => {
      c.alive = true;
      if (isBinary) { voiceFrame(c, buf); return; }
      let msg; try { msg = JSON.parse(buf.toString()); } catch (e) { return; }
      if (!msg || typeof msg.t !== 'string') return;
      const now = Date.now();
      c.tok = Math.min(60, c.tok + (now - c.tokAt) / 20); c.tokAt = now;
      if (c.tok < 1) return; c.tok--;
      try { onMsg(c, msg, now); } catch (err) { console.error('bedwars msg', err && err.stack); }
    });
    const bye = () => { if (!conns.has(c)) return; conns.delete(c); if (c.room) leaveRoom(c, true); leaveSpace(c); };
    ws.on('close', bye); ws.on('error', bye);
  });
}
function onMsg(c, m, now) {
  const r = c.room, t = m.t;
  if (t === 'ping') return send(c, { t: 'pong', c: m.c, n: now });
  if (t === 'vc') { c.voice = !!m.on; send(c, { t: 'vcstate', on: c.voice, off: VOICE_OFF, muted: !!c.vmuted, range: VOICE_R }); return; }
  if (t === 'adm') { if (c.owner) { try { adminMsg(c, m, now); } catch (err) { send(c, { t: 'admres', ok: false, msg: 'Error: ' + (err && err.message) }); } } return; }
  if (LOCKED && !c.owner && (t === 'quick' || t === 'practice' || t === 'create' || t === 'join')) return send(c, { t: 'err', msg: '🔒 New Bedwars matches are paused by the owners. Try again soon!' });
  // ---- menus
  const game = MG.isMini(m.game) ? m.game : 'bw';
  if (t === 'quick') {
    const mode = game !== 'bw' ? game : BW.MODES[m.mode] ? m.mode : 'solo';
    let room = null;
    for (const x of rooms.values()) if (x.kind === 'public' && x.state === 'lobby' && x.game === game && x.mode === mode && x.members.length < capOf(x) && (!x.startAt || x.startAt - now > 2500)) { room = x; break; }
    if (!room) room = makeRoom('public', mode, 'normal', '', game);
    return joinLobby(c, room);
  }
  if (t === 'practice') { const room = makeRoom('practice', m.mode, m.diff, c.cid, game); return joinLobby(c, room, 0); }
  if (t === 'create') { const room = makeRoom('private', m.mode, m.diff, c.cid, game); return joinLobby(c, room, 0); }
  if (t === 'join') {
    const room = codes.get(String(m.code || '').toUpperCase().trim());
    if (!room || room.state !== 'lobby') return send(c, { t: 'err', msg: 'No open room with that code.' });
    return joinLobby(c, room);
  }
  if (t === 'leave' || t === 'hub') { if (c.room) leaveRoom(c); else goHub(c); return; }
  if (t === 'look') { c.look = worldLook(c.cid); return; }
  if (c.space && (t === 'mv' || t === 'sw' || t === 'hop' || (t === 'qc' && (!r || r.state !== 'play')))) return spaceMsg(c, m, now);
  if (!r) return;
  if (r.state === 'lobby') {
    if (t === 'team' && r.kind === 'private' && r.game !== 'hide') {
      const tm = Number(m.team); const mb = r.members.find((x) => x.conn === c);
      if (mb && tm >= 0 && tm < nTeams(r) && r.members.filter((x) => x.team === tm).length < per(r)) { mb.team = tm; pushRoom(r); }
    } else if (t === 'cfg' && r.kind === 'private' && r.host === c.cid) {
      if (r.game === 'bw' && BW.MODES[m.mode]) { r.mode = m.mode; for (const t2 of [0, 1, 2, 3]) { const mm = r.members.filter((x) => x.team === t2); while (mm.length > per(r)) { const x = mm.pop(); x.team = bestTeam(r); } } }
      if (SK[m.diff]) r.diff = m.diff;
      pushRoom(r);
    } else if (t === 'start' && r.kind === 'private' && r.host === c.cid) { r.startAt = now + 3000; pushRoom(r); }
    return;
  }
  if (r.state !== 'play') return;
  const e = c.ent; if (!e || e.conn !== c) return;
  if (t === 'qc') { if (now - (e.qcAt || 0) < 1200) return; e.qcAt = now; const i = m.i | 0; if (i >= 0 && i < BW_QC.length) r.ev(['qc', e.id, i]); return; }
  if (e.dead || e.elim) return;
  if (now < r.goAt) return;
  if (r.game !== 'bw' && MINI.onMsg(r, e, m, now)) return;
  if (t === 'mv') {
    let x = Number(m.x), y = Number(m.y); if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dt = Math.min(1, (now - (e.lastMv || now - 50)) / 1000); e.lastMv = now;
    const allow = BW.SPEED * (now < e.speedUntil ? 1.35 : 1) * dt * 1.6 + 26 + e.kbBudget;
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
    let bad = false;
    if (d > allow && !e.god) { x = e.x + dx / d * allow; y = e.y + dy / d * allow; bad = true; }
    if (BW.hits(r.map, x, y, false) && !BW.hits(r.map, e.x, e.y, false)) { x = e.x; y = e.y; bad = true; }
    e.x = clamp(x, T, (W - 1) * T); e.y = clamp(y, T, (H - 1) * T);
    if (Number.isFinite(m.a)) e.ang = m.a / 100;
    e.mv = !!m.m; e.sprint = m.m === 2; e.bow = !!m.b && e.inv.bow > 0;
    if (bad) send(c, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) });
    return;
  }
  if (t === 'sw') { swing(r, e, Number(m.a) / 100 || 0, now, !!m.j); return; }
  if (t === 'hop') { if (now - (e.hopAt || 0) < (r.game === 'spleef' ? 900 : 450)) return; e.hopAt = now; r.ev(['hop', e.id]); return; }
  if (t === 'mine') { const i = m.i | 0; e.mineReq = i >= 0 && i < N ? { i, until: now + 260 } : null; return; }
  if (t === 'pl') { const i = m.i | 0; if (!place(r, e, i, String(m.b))) { e.dirty = true; const mm = r.map; send(c, { t: 'fix', i, f: mm.f[i], fc: mm.fc[i], w: mm.w[i], wc: mm.wc[i] }); } return; }
  if (t === 'sel') { const it = String(m.it); if ((r.game !== 'bw' ? MG.hotbar(r.game, e.inv, e.team) : BW.hotbar({ ...e.inv, pick: e.pick })).includes(it)) e.held = it; return; }
  if (t === 'use') { useItem(r, e, String(m.it), Number(m.x) || e.x, Number(m.y) || e.y, now); return; }
  if (t === 'bow') { shootBow(r, e, Number(m.a) / 100 || 0, m.p, now); return; }
  if (t === 'buy') { const res = buy(r, e, String(m.id)); send(c, { t: 'buy', id: m.id, res }); return; }
  if (t === 'up') { const res = upgrade(r, e, String(m.id)); send(c, { t: 'buy', id: m.id, res, up: 1 }); return; }
  if (DEBUG && t === 'debug') {
    if (m.res) { for (const k of RES) e.res[k] += m.res[k] | 0; e.dirty = true; }
    if (m.time) r.goAt -= m.time * 1000;
    if (m.tp) { e.x = m.tp[0]; e.y = m.tp[1]; send(c, { t: 'pos', x: e.x, y: e.y }); }
    if (m.kill) { const v = r.ents.get(m.kill); if (v) die(r, v, 'melee', e); }
    if (m.bed != null) destroyBed(r, r.map.beds[m.bed], e);
  }
}


// ============================================================ owner panel
function roomSummary(r) {
  const now = Date.now();
  const o = { id: r.id, game: r.game, kind: r.kind, mode: r.mode, diff: r.diff, code: r.code, state: r.state };
  if (r.state === 'lobby') { o.players = r.members.map((m) => ({ nick: m.nick, team: m.team, pid: m.conn ? m.conn.pid : 0 })); o.startIn = r.startAt ? Math.max(0, r.startAt - now) : 0; }
  else if (r.ents) {
    o.elapsed = Math.max(0, (now - r.goAt) / 1000);
    o.teams = r.game === 'bw' ? r.teams.map((t) => ({ bed: t.bed, elim: t.elim })) : null;
    if (r.game !== 'bw') o.info = MINI.adminInfo(r);
    o.players = [...r.ents.values()].map((e) => ({ id: e.id, nick: e.nick, team: e.team, bot: e.bot, human: !!e.cid && !e.bot, online: !!e.conn, dead: e.dead, elim: e.elim, hp: Math.ceil(e.hp), god: !!e.god, res: e.res, sword: e.sword, armor: e.armor, k: e.stats.kills, f: e.stats.finals }));
  }
  return o;
}
function now0() { return Date.now(); }
function adminInfo(c) {
  const where = (x) => x.room ? (x.room.state === 'play' ? 'match #' + x.room.id : x.room.state === 'lobby' ? 'waiting #' + x.room.id : 'results #' + x.room.id) : x.space ? 'hub' : '—';
  return {
    t: 'adminfo', locked: LOCKED, voiceOff: VOICE_OFF, now: Date.now(), myRoom: c.room ? c.room.id : 0, myEnt: c.ent ? c.ent.id : 0,
    rooms: [...rooms.values()].filter((r) => r.state !== 'dead').map(roomSummary),
    conns: [...conns].map((x) => ({ pid: x.pid, nick: x.nick, owner: !!x.owner, where: where(x), voice: !!x.voice, vmuted: !!x.vmuted, talking: now0() - (x.vTalkAt || 0) < 1500 })),
  };
}
function adminMsg(c, m, now) {
  const a = String(m.a || '');
  const ok = (msg) => send(c, { t: 'admres', ok: true, msg });
  const no = (msg) => send(c, { t: 'admres', ok: false, msg });
  const room = () => rooms.get(Number(m.room));
  const ent = (r) => r && r.ents && r.ents.get(Number(m.id));
  if (a === 'info') return send(c, adminInfo(c));
  if (a === 'announce') {
    const text = String(m.text || '').trim().slice(0, 140); if (!text) return no('Type a message first.');
    for (const x of conns) send(x, { t: 'ann', text, from: c.nick });
    return ok('Announcement sent to ' + conns.size + ' players.');
  }
  if (a === 'lock') { LOCKED = !!m.on; return ok(LOCKED ? 'New matches are paused.' : 'New matches are open again.'); }
  if (a === 'voiceoff') { VOICE_OFF = !!m.on; for (const x of conns) if (x.voice) send(x, { t: 'vcstate', on: x.voice, off: VOICE_OFF, muted: !!x.vmuted, range: VOICE_R }); return ok(VOICE_OFF ? 'Voice chat is off for everyone.' : 'Voice chat is back on.'); }
  if (a === 'vmute') {
    const x = [...conns].find((y) => y.pid === Number(m.pid)); if (!x) return no('Player not found.');
    x.vmuted = !x.vmuted; send(x, { t: 'vcstate', on: !!x.voice, off: VOICE_OFF, muted: x.vmuted, range: VOICE_R });
    return ok(x.vmuted ? x.nick + ' can’t talk in voice now.' : x.nick + ' can talk again.');
  }
  if (a === 'kick') {
    const x = [...conns].find((y) => y.pid === Number(m.pid)); if (!x) return no('Player not found.');
    if (x.owner) return no('You can’t kick an owner.');
    send(x, { t: 'err', code: 'kicked', msg: String(m.reason || 'You were removed from Bedwars by an owner.').slice(0, 120) });
    setTimeout(() => { try { x.ws.close(4001); } catch (e) {} }, 150);
    return ok('Kicked ' + x.nick + '.');
  }
  // ---- your own powers (in a match)
  if (a === 'self') {
    const r = c.room, e = c.ent; if (!r || r.state !== 'play' || !e) return no('Join a match first.');
    const op = String(m.op);
    if (op === 'god') { e.god = !e.god; if (e.god) { e.hp = BW.MAX_HP; e.dead = false; } e.dirty = true; send(c, { t: 'god', on: e.god }); return ok(e.god ? 'God mode ON — no damage, no void, walk on air.' : 'God mode OFF.'); }
    if (op === 'res') { e.res.iron += 64; e.res.gold += 32; e.res.dia += 16; e.res.em += 16; e.dirty = true; return ok('+64 iron, +32 gold, +16 diamonds, +16 emeralds'); }
    if (op === 'kit' && r.game !== 'bw') { MINI.kit(r, e); return ok('Max kit given.'); }
    if (op === 'kit') { e.sword = 4; e.armor = 4; e.pick = 4; e.inv.wool += 64; e.inv.end += 32; e.inv.fireball += 5; e.inv.tnt += 3; e.inv.pearl += 3; e.inv.gapple += 3; e.inv.bow = 1; e.inv.arrows += 32; e.inv.kbstick = 1; e.dirty = true; r.ev(['gear', e.id, e.sword, e.armor, e.pick]); return ok('Max kit given.'); }
    return no('Unknown power.');
  }
  // ---- room controls
  const r = room(); if (!r) return no('That match is gone.');
  if (a === 'start') { if (r.state !== 'lobby') return no('Already started.'); startMatch(r); return ok('Match #' + r.id + ' started.'); }
  if (a === 'delete') {
    for (const x of humans(r)) { x.room = null; x.ent = null; send(x, { t: 'ann', text: 'This match was closed by an owner.', from: c.nick }); goHub(x); }
    if (r.space) for (const x of [...r.space.conns]) { x.room = null; goHub(x); }
    r.state = 'dead'; killRoom(r); return ok('Match #' + r.id + ' closed.');
  }
  if (r.state !== 'play') return no('That match isn’t being played right now.');
  if (a === 'end') { const w = Number(m.winner); endMatch(r, w >= 0 && w < 8 ? w : -1); return ok('Match #' + r.id + ' ended.'); }
  if (a === 'time') { const sec = clamp(Number(m.sec) || 0, 0, 1200); if (r.game !== 'bw') { MINI.skip(r, sec * 1000); return ok('Skipped ' + sec + 's ahead.'); } r.goAt -= sec * 1000; roomSend(r, { t: 'goat', goAt: r.goAt }); return ok('Skipped ' + sec + 's ahead.'); }
  if (a === 'bed') { const t = Number(m.team); const b = r.map.beds[t]; if (r.game !== 'bw') return no('That match has no beds.'); if (!b || !b.alive) return no('That bed is already gone.'); destroyBed(r, b, null); return ok(BW.TEAMS[t].name + ' bed destroyed.'); }
  if (a === 'ent') {
    const e = ent(r); if (!e) return no('Player not found.');
    const op = String(m.op);
    if (op === 'kill') { if (e.dead || e.elim) return no('Already dead.'); e.god = false; die(r, e, 'melee', null); return ok(e.nick + ' killed.'); }
    if (op === 'elim') { if (e.elim) return no('Already eliminated.'); e.god = false; if (!e.dead) die(r, e, 'melee', null); e.elim = true; e.dead = true; e.dirty = true; r.teamsDirty = true; checkWin(r); return ok(e.nick + ' eliminated.'); }
    if (op === 'heal') { if (e.dead) return no('They’re dead.'); e.hp = BW.MAX_HP; e.absorb = 4; e.dirty = true; return ok(e.nick + ' healed.'); }
    if (op === 'res') { e.res.iron += 32; e.res.gold += 16; e.res.dia += 4; e.res.em += 4; e.dirty = true; return ok('Gave ' + e.nick + ' resources.'); }
    if (op === 'revive') { if (!e.dead && !e.elim) return no('They’re alive.'); e.elim = false; e.dead = true; e.respawnAt = 0; r.teams[e.team].elim = false; r.teamsDirty = true; return ok(e.nick + ' will respawn now.'); }
    if (op === 'tpme' || op === 'bring') {
      const me = c.ent; if (!me || c.room !== r) return no('You need to be in that match.');
      if (e.dead || me.dead) return no('Both of you need to be alive.');
      const from = op === 'tpme' ? me : e, to = op === 'tpme' ? e : me;
      from.x = to.x + 30; from.y = to.y; from.vx = from.vy = 0; from.kbBudget += 2000;
      if (from.conn) send(from.conn, { t: 'pos', x: Math.round(from.x), y: Math.round(from.y) });
      r.ev(['tp', from.id, Math.round(to.x), Math.round(to.y), Math.round(from.x), Math.round(from.y)]);
      return ok(op === 'tpme' ? 'Teleported to ' + e.nick + '.' : 'Brought ' + e.nick + ' to you.');
    }
    return no('Unknown action.');
  }
  return no('Unknown command.');
}

// ============================================================ minigames (CTF, TNT Spleef, Prop Hunt)
initMini({
  DT, SK, BOT_NAMES, send, roomSend, humans, makeEnt, botLook, emptyInv, leaveSpace, fullState, endMatch,
  swing, hurt, knock, place, stopMine, mineStep, useItem, shootBow, moveToward, physics, pathTo, pathNear, astar,
  stepPath, fight, foeNear, clearLine, aliveEnts, setTile, die: (r, v, kind, att) => die(r, v, kind, att),
});
export const __bwTest = DEBUG ? { makeRoom, startMatch, rooms, tickRoom } : null;
