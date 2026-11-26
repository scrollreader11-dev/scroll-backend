// ============================================================
// Bedwars 2D — server. Matchmaking (quick play / private rooms / practice),
// the authoritative game sim (combat, blocks, beds, generators, projectiles,
// explosions, team upgrades), AI bots, and Scroll rewards.
// server.js routes /bw-ws here. Rules shared with the client: dist/arcade/bedwars/shared.js
// ============================================================
import { WebSocketServer } from 'ws';
import './dist/arcade/bedwars/shared.js';
import './dist/arcade/bedwars/mg.js';
import './dist/arcade/bedwars/racecore.js';
import { MINI, initMini } from './minigames.js';
import * as GMS from './gamemaps.js';
import { nextQuestion, SETS as QSETS } from './quizbank.js';
import { worldIdentity, worldLook, bwReward, bwStats, bwLeaderboard, grantCoins } from './casino.js';

const BW = globalThis.BW;
const MG = globalThis.MG;
const { T, G } = BW;
let W = BW.W, H = BW.H, N = W * H;
BW.onDims((w, h) => { W = w; H = h; N = w * h; });
const MAXN = 200 * 200;
const TICK = 50, DT = TICK / 1000;
const DEBUG = process.env.BW_DEBUG === '1';
const wss = new WebSocketServer({ noServer: true, maxPayload: 8192 });
const HELD = BW.HOTBAR_ORDER;
const RES = BW.RES;

const conns = new Set();
// Bedwars owners (checked against the logged-in ScrollHub account, never the guest nickname).
import { subAdd, subMine, subGet, subRemoveOwn } from './casino.js';
import { chatSay, ipOf } from './chatguard.js';
const SUB = { add: subAdd, mine: subMine, get: subGet, removeOwn: subRemoveOwn };
const OWNERS = new Set(['scrollreader11', 'pakajo', 'hihihi', 'SuperCoolAdminDude25']);
;
globalThis.SH_NAME_BANNED = (n) => (GMS.store.nameBans || []).includes(String(n || '').toLowerCase()); // only Scrollreader11 gets the owner panel
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
  let out = null, pout = null;
  const p = partyOf(c), mates = p ? new Set() : null;
  if (p) for (const cid of p.members) { if (cid === c.cid) continue; const r = connByCid(cid); if (!r || !r.voice || r.ws.readyState !== 1) continue; mates.add(r);
    if (!pout) { pout = Buffer.allocUnsafe(buf.length + 4); pout[0] = 1; pout.writeUInt32BE((2000000000 + c.pid) >>> 0, 1); buf.copy(pout, 5, 1); }
    try { if (r.ws.bufferedAmount < 256 * 1024) r.ws.send(pout, { binary: true }); } catch (e) {} }
  for (const r of me.group) {
    if (r === c || !r.voice || (mates && mates.has(r))) continue;
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
    room: sp.room ? roomInfo(sp.room, c) : null, lb: sp.kind === 'hub' ? bwLeaderboard() : null, online: lobbyList(), stats: bwStats(c.cid), qc: BW_QC, motd: GMS.store.settings.motd, hubfx: GMS.store.settings.hubFx !== 0, x2: GMS.rewardMult() > 1,
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
  for (const c of sp.conns) if (!c.spectator) p.push([c.pid, Math.round(c.sx), Math.round(c.sy), q2(c.sang), (c.smv ? 2 : 0) | (c.smv === 2 ? 1024 : 0), c.sheld | 0, 20]);
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
    const lim = sp.kind === 'hub' ? BW.HUB_W : W;
    c.sx = clamp(x, T, (lim - 1) * T); c.sy = clamp(y, T, (lim - 1) * T);
    if (Number.isFinite(m.a)) c.sang = m.a / 100;
    c.smv = m.m | 0; c.sheld = m.h | 0;
    return;
  }
  if (t === 'sw') { if (now - (c.swAt || 0) < 110) return; c.swAt = now; sp.events.push(['sw', c.pid, m.a | 0]); return; }
  if (t === 'hop') { if (now - (c.hopAt || 0) < 450) return; c.hopAt = now; sp.events.push(['hop', c.pid]); return; }
  if (t === 'qc') { if (now - (c.qcAt || 0) < 1200) return; c.qcAt = now; const i = m.i | 0; if (i >= 0 && i < BW_QC.length) sp.events.push(['qc', c.pid, i]); return; }
  if (t === 'lb2') {
    if (now - (c.lb2At || 0) < 800) return; c.lb2At = now;
    const g = String(m.game) === 'quiz' ? 'quiz' : MG.isMini(String(m.game)) ? String(m.game) : 'bw';
    send(c, { t: 'lb2', game: g, rows: g === 'bw' ? bwLeaderboard() : GMS.gameLb(g), myElo: g === 'duel' ? GMS.eloOf(c.cid) : undefined });
    return;
  }
}

// ============================================================ rooms / lobby
function newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c = ''; for (let i = 0; i < 4; i++) c += A[(rnd() * A.length) | 0]; } while (codes.has(c)); return c; }
function makeRoom(kind, mode, diff, host, game) {
  game = MG.isMini(game) ? game : 'bw';
  const r = { id: nextRoom++, mapId: null, game, kind, mode: game !== 'bw' ? game : BW.MODES[mode] ? mode : 'solo', diff: SK[diff] ? diff : 'normal', code: kind === 'private' ? newCode() : '', host: host || '', state: 'lobby', members: [], startAt: 0, created: Date.now() };
  const sc = schoolCfg(); if (sc) { r.school = true; r.qset = sc.set || 'blooket'; r.quiz = sc.quiz !== false; }
  r.space = makeSpace('wait', r);
  rooms.set(r.id, r); if (r.code) codes.set(r.code, r);
  return r;
}
// ---- School mode (set from the site admin panel): up to 30 players per game + quiz power-ups
function seasonCfg() { try { return globalThis.SH_SEASON ? globalThis.SH_SEASON() : 'xmas'; } catch (e) { return ''; } }
function schoolCfg() { try { return globalThis.SH_SCHOOL ? globalThis.SH_SCHOOL() : null; } catch (e) { return null; } }
const SCHOOL_CAP = { bw: [4, 25, 100], ctf: [2, 50, 100], hide: [2, 100, 100], spleef: [100, 1, 100], murder: [100, 1, 100], build: [4, 25, 100], royale: [100, 1, 100] }; // [teams, per team, max] — lobbies hold (practically) everyone
function autoPer(n, biggest) { const p = n <= 4 ? 1 : n <= 8 ? 2 : n <= 16 ? 4 : Math.ceil(n / 4); return Math.max(p, biggest || 0); }
function autoModeName(p) { return p === 1 ? 'Solo' : p === 2 ? 'Duos' : p === 4 ? 'Squads' : 'Teams of ' + p; }
function basePer(r) { return r.game !== 'bw' ? MG.GAMES[r.game].per : r.autoPer || BW.MODES[r.mode].per; }
function per(r) { return SCHOOL_CAP[r.game] && r.kind !== 'practice' ? SCHOOL_CAP[r.game][1] : basePer(r); }
function nTeams(r) { return SCHOOL_CAP[r.game] && r.kind !== 'practice' ? SCHOOL_CAP[r.game][0] : r.game !== 'bw' ? MG.GAMES[r.game].teams : 4; }
function capOf(r) { return SCHOOL_CAP[r.game] && r.kind !== 'practice' ? SCHOOL_CAP[r.game][2] : r.game !== 'bw' ? MG.GAMES[r.game].max : 4 * per(r); }
function bestTeam(r) {
  if (r.game === 'hide') return r.members.length < capOf(r) ? 0 : -1;
  const cnt = new Array(128).fill(0); for (const m of r.members) cnt[m.team]++;
  let best = -1; for (let t = 0; t < nTeams(r); t++) if (cnt[t] < per(r) && (best < 0 || cnt[t] < cnt[best])) best = t;
  return best;
}
function lobbyAutoPer(r) { const cnt = new Array(4).fill(0); for (const m of r.members) if (m.team < 4) cnt[m.team]++; return autoPer(r.members.length, Math.max(...cnt)); }
function lobbySlots(r) { // how many places to draw per team (team games) or in total (free-for-all), counting bots that will fill in
  if (r.game === 'bw') return lobbyAutoPer(r);
  if (r.game === 'ctf') { const cnt = [0, 0]; for (const m of r.members) if (m.team < 2) cnt[m.team]++; return Math.max(r.noBots ? 1 : MG.GAMES.ctf.per, cnt[0], cnt[1]); }
  return Math.max(r.members.length, r.noBots ? Math.min(2, MG.GAMES[r.game].max) : MG.GAMES[r.game].max);
}
function roomInfo(r, c) {
  return {
    t: 'room', id: r.id, game: r.game, kind: r.kind, code: r.code, mode: r.mode, diff: r.diff, state: r.state, host: r.host,
    startIn: r.startAt ? Math.max(0, r.startAt - Date.now()) : 0, per: per(r), teams: nTeams(r), cap: capOf(r), you: c ? c.cid : '',
    mapId: r.mapId || '', mapName: r.mapId && r.mapId !== 'default' && GMS.getMap(r.mapId) ? GMS.getMap(r.mapId).name : '', maps: r.kind === 'private' ? GMS.publishedMaps(r.game) : null,
    members: r.members.map((m) => ({ cid: m.cid, pid: m.conn ? m.conn.pid : 0, nick: m.nick, team: m.team, look: m.look })),
    bots: !r.noBots, slots: lobbySlots(r), autoMode: r.game === 'bw' ? autoModeName(lobbyAutoPer(r)) : '',
  };
}
function pushRoom(r) { for (const m of r.members) if (m.conn) send(m.conn, roomInfo(r, m.conn)); }
function joinLobby(c, r, team) {
  if (c.watch) stopWatch(c, true);
  leaveRoom(c, true);
  const t = r.game !== 'hide' && team != null && team >= 0 && team < nTeams(r) && r.members.filter((m) => m.team === team).length < per(r) ? team : bestTeam(r);
  if (t < 0) return send(c, { t: 'err', msg: 'That room is full.' });
  r.members.push({ cid: c.cid, nick: c.nick, look: c.look, team: t, conn: c });
  c.room = r; c.ent = null;
  if (r.kind === 'public') {
    const now = Date.now();
    if (!r.startAt) r.startAt = now + (r.school ? 45000 : 25000);
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
function killRoom(r) { rooms.delete(r.id); if (r.code) codes.delete(r.code); if (r.watchers) for (const w of [...r.watchers]) stopWatch(w); }

// ============================================================ parties, friends & spectating
const parties = new Map(); let nextParty = 1;
const invites = new Map(); // target cid -> [{ id, from, at }]
const PARTY_MAX = 4;
function connByCid(cid) { for (const o of conns) if (o.cid === cid) return o; return null; }
function partyOf(c) { return c && c.party ? parties.get(c.party) || null : null; }
function gameName(g) { return g === 'bw' ? 'Bedwars' : (MG.GAMES[g] || {}).name || g; }
function whereOf(o) {
  if (!o) return { s: 'off' };
  if (o.watch) return { s: 'watch', game: o.watch.game, room: o.watch.id, txt: 'Watching ' + gameName(o.watch.game) };
  const r = o.room;
  if (r) {
    const full = r.members.length >= capOf(r);
    if (r.state === 'lobby') return { s: 'lobby', game: r.game, room: r.id, kind: r.kind, join: r.kind !== 'practice' && !full, txt: (r.kind === 'practice' ? 'Practice ' : 'Waiting for ') + gameName(r.game) };
    if (r.state === 'play') return { s: 'play', game: r.game, room: r.id, kind: r.kind, watch: true, txt: 'Playing ' + gameName(r.game) + (r.kind === 'practice' ? ' (practice)' : '') };
    return { s: 'end', game: r.game, txt: 'Finishing ' + gameName(r.game) };
  }
  return { s: 'hub', txt: 'In the hub' };
}
function partyInfo(p) {
  return { t: 'party', id: p.id, leader: p.leader, members: p.members.map((cid) => { const o = connByCid(cid); return { cid, nick: p.nicks[cid] || '?', look: o ? o.look : null, on: !!o, where: whereOf(o), talk: !!(o && o.voice && Date.now() - (o.vTalkAt || 0) < 400) }; }) };
}
function pushParty(p) { const s = JSON.stringify(partyInfo(p)); for (const cid of p.members) { const o = connByCid(cid); if (o) send(o, s); } }
function partyLeave(c, why) {
  const p = partyOf(c); c.party = 0; send(c, { t: 'party', id: 0 });
  if (!p) return;
  p.members = p.members.filter((x) => x !== c.cid);
  if (p.members.length <= 1) {
    for (const cid of p.members) { const o = connByCid(cid); if (o) { o.party = 0; send(o, { t: 'party', id: 0 }); send(o, { t: 'toast', msg: 'Your party closed — ' + c.nick + ' ' + (why || 'left') + '.' }); } }
    parties.delete(p.id); return;
  }
  if (p.leader === c.cid) p.leader = p.members[0];
  for (const cid of p.members) { const o = connByCid(cid); if (o) send(o, { t: 'toast', msg: '' + c.nick + ' ' + (why || 'left') + ' the party.' }); }
  pushParty(p);
}
function partyMates(c) { // members the leader brings along (not stuck mid-match)
  const p = partyOf(c); if (!p || p.leader !== c.cid) return [];
  return p.members.filter((x) => x !== c.cid).map(connByCid).filter((o) => o && !(o.room && o.room.state === 'play'));
}
function joinWithParty(c, room, team) {
  const mates = partyMates(c);
  let t = team;
  if (mates.length && room.game !== 'hide' && nTeams(room) > 1) { // the team with the most free seats, so you all fit
    const cnt = new Array(128).fill(0); for (const m of room.members) cnt[m.team]++;
    let best = -1; for (let k = 0; k < nTeams(room); k++) { const free = per(room) - cnt[k]; if (free > 0 && (best < 0 || free > per(room) - cnt[best])) best = k; }
    if (best >= 0) t = best;
  }
  joinLobby(c, room, t);
  if (c.room !== room) return;
  const mine = (room.members.find((m) => m.conn === c) || {}).team;
  for (const o of mates) {
    if (o.watch) stopWatch(o, true);
    joinLobby(o, room, mine);
    if (o.room === room) send(o, { t: 'toast', msg: '' + c.nick + ' brought the party into ' + gameName(room.game) + '!' });
  }
  const p = partyOf(c); if (p) pushParty(p);
}
function startWatch(c, r) {
  if (!r || r.state !== 'play' || !r.ents) return send(c, { t: 'err', msg: 'That match isn’t running any more.' });
  if (c.room) leaveRoom(c, true); else leaveSpace(c);
  if (c.watch) stopWatch(c, true);
  c.watch = r; (r.watchers || (r.watchers = new Set())).add(c);
  const dummy = { id: -1, team: -1, mrole: '', elim: true };
  const st = fullState(r, dummy); st.watch = true; st.you = -1; st.team = -1;
  send(c, st);
}
function stopWatch(c, quiet) {
  const r = c.watch; if (!r) return; c.watch = null; if (r.watchers) r.watchers.delete(c);
  if (!quiet && conns.has(c)) goHub(c);
}
function socialMsg(c, m, now) {
  const t = m.t;
  if (t === 'soc') { // friends + party snapshot
    const S0 = globalThis.SH_SOCIAL;
    const fr = S0 ? S0.friends(c.cid) : [], inc = S0 ? S0.incoming(c.cid) : [];
    const p = partyOf(c);
    send(c, {
      t: 'soc', party: p ? partyInfo(p) : null, invites: (invites.get(c.cid) || []).filter((x) => now - x.at < 120000 && parties.has(x.id)),
      friends: fr.map((f) => { const o = connByCid(f.id); return { cid: f.id, nick: f.name, look: o ? o.look : null, arcade: !!o, site: !!(S0 && S0.online(f.id)), where: whereOf(o), inParty: !!(p && p.members.includes(f.id)) }; })
        .sort((a, b) => (b.arcade - a.arcade) || (b.site - a.site) || a.nick.localeCompare(b.nick)),
      incoming: inc.map((x) => ({ id: x.id, nick: x.name })),
    });
    return true;
  }
  if (t === 'pinv') {
    let o = m.cid ? connByCid(String(m.cid)) : null;
    if (!o && m.name) { const n = String(m.name).toLowerCase().trim(); for (const x of conns) if (x.nick.toLowerCase() === n) { o = x; break; } }
    if (!o) return send(c, { t: 'err', msg: 'They’re not in Games right now — they need to open the arcade first.' }), true;
    if (o === c) return send(c, { t: 'err', msg: 'You can’t invite yourself' }), true;
    let p = partyOf(c);
    if (!p) { p = { id: nextParty++, leader: c.cid, members: [c.cid], nicks: { [c.cid]: c.nick } }; parties.set(p.id, p); c.party = p.id; }
    if (p.members.includes(o.cid)) return send(c, { t: 'err', msg: o.nick + ' is already in your party.' }), true;
    if (p.members.length >= PARTY_MAX) return send(c, { t: 'err', msg: 'Parties can have up to ' + PARTY_MAX + ' players.' }), true;
    const list = (invites.get(o.cid) || []).filter((x) => now - x.at < 120000 && x.id !== p.id);
    list.push({ id: p.id, from: c.nick, at: now }); invites.set(o.cid, list);
    send(o, { t: 'pinvite', id: p.id, from: c.nick });
    send(c, { t: 'toast', msg: 'Party invite sent to ' + o.nick });
    pushParty(p); return true;
  }
  if (t === 'pacc' || t === 'pdec') {
    const id = m.id | 0, list = invites.get(c.cid) || [], inv = list.find((x) => x.id === id);
    invites.set(c.cid, list.filter((x) => x.id !== id));
    const p = parties.get(id);
    if (t === 'pdec') { if (p) { const l = connByCid(p.leader); if (l) send(l, { t: 'toast', msg: '' + c.nick + ' declined your party invite.' }); } return true; }
    if (!inv || !p) return send(c, { t: 'err', msg: 'That invite expired.' }), true;
    if (p.members.length >= PARTY_MAX) return send(c, { t: 'err', msg: 'That party is full.' }), true;
    if (c.party && c.party !== p.id) partyLeave(c);
    p.members.push(c.cid); p.nicks[c.cid] = c.nick; c.party = p.id;
    for (const cid of p.members) { const o = connByCid(cid); if (o && o !== c) send(o, { t: 'toast', msg: '' + c.nick + ' joined the party!' }); }
    send(c, { t: 'toast', msg: 'You joined the party! The leader picks the games — you’ll always be on their team. Party voice works anywhere on the map.' });
    pushParty(p);
    // jump into the leader's lobby if they are waiting in one
    const l = connByCid(p.leader); if (!schoolCfg() && l && l.room && l.room.state === 'lobby' && l.room.kind !== 'practice' && !(c.room && c.room.state === 'play')) joinLobby(c, l.room, (l.room.members.find((x) => x.conn === l) || {}).team);
    return true;
  }
  if (t === 'pleave') { partyLeave(c); return true; }
  if (t === 'pkick' || t === 'plead') {
    const p = partyOf(c); if (!p || p.leader !== c.cid) return true;
    const cid = String(m.cid || ''); if (!p.members.includes(cid) || cid === c.cid) return true;
    if (t === 'plead') { p.leader = cid; pushParty(p); return true; }
    const o = connByCid(cid);
    if (o) { partyLeave(o, 'was removed from'); } else { p.members = p.members.filter((x) => x !== cid); pushParty(p); }
    return true;
  }
  if (t === 'fjoin' || t === 'fwatch') { // jump into / watch a friend's (or party mate's) match
    const cid = String(m.cid || ''), S0 = globalThis.SH_SOCIAL, p = partyOf(c);
    const ok = (S0 && S0.friends(c.cid).some((f) => f.id === cid)) || (p && p.members.includes(cid)) || c.owner;
    if (!ok) return send(c, { t: 'err', msg: 'You can only join friends and party members.' }), true;
    const o = connByCid(cid); if (!o) return send(c, { t: 'err', msg: 'They’re not in Games right now.' }), true;
    const r = o.room || o.watch;
    if (!r) { // they're in the hub — walk over to them
      if (c.room) leaveRoom(c); else if (c.watch) stopWatch(c); 
      if (c.space === HUB) { c.sx = o.sx; c.sy = o.sy; send(c, { t: 'pos', x: Math.round(o.sx), y: Math.round(o.sy) }); }
      send(c, { t: 'toast', msg: '' + o.nick + ' is in the hub — teleported you next to them!' }); return true;
    }
    if (r.state === 'lobby' && t === 'fjoin' && schoolCfg() && !c.owner) return send(c, { t: 'err', msg: 'Games are locked in School Mode — wait for your teacher’s vote.' }), true;
    if (r.state === 'lobby' && t === 'fjoin') {
      if (r.kind === 'practice') return send(c, { t: 'err', msg: o.nick + ' is in a solo practice match.' }), true;
      if (r.members.length >= capOf(r)) return send(c, { t: 'err', msg: 'Their lobby is full.' }), true;
      if (c.watch) stopWatch(c, true);
      joinWithParty(c, r, (r.members.find((x) => x.conn === o) || {}).team); return true;
    }
    if (r.state === 'play') { if (c.room === r) return true; if (c.room && c.room.state === 'play') return send(c, { t: 'err', msg: 'Finish (or leave) your own match first.' }), true; startWatch(c, r); send(c, { t: 'toast', msg: 'Spectating ' + o.nick + ' — press Leave to go back.' }); return true; }
    return send(c, { t: 'err', msg: 'Their match is just finishing — try again in a moment.' }), true;
  }
  return false;
}
setInterval(() => { // tidy parties where nobody is online, and refresh who's talking/where
  for (const p of parties.values()) {
    if (!p.members.some((cid) => connByCid(cid))) { parties.delete(p.id); continue; }
    pushParty(p);
  }
}, 4000);

// ============================================================ match setup
function emptyInv() { return { kbstick: 0, wool: 0, wood: 0, end: 0, obby: 0, bow: 0, arrows: 0, fireball: 0, tnt: 0, gapple: 0, pearl: 0, egg: 0, speed: 0 }; }
function makeEnt(r, o) {
  const b = r.map.bases[o.team % r.map.bases.length];
  const e = {
    quiz: !!r.quiz && !o.bot, energy: r.game === 'murder' ? 60 : 100, qz: { right: 0, wrong: 0, streak: 0, best: 0 }, qs: {}, qLock: 0,
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
function resolveMap(r) {
  if (r.mapId === 'default') return null;
  if (r.mapId) { const m = GMS.getMap(r.mapId); if (m && (m.ok || r.testMap)) return m; }
  return GMS.pickMap(r.game);
}
function startMatch(r) {
  r.custom = resolveMap(r);
  GMS.log('' + (r.game === 'bw' ? 'Bedwars ' + r.mode : MG.GAMES[r.game].name) + ' #' + r.id + ' started (' + r.members.length + ' players' + (r.custom ? ', map "' + r.custom.name + '"' : '') + ')');
  if (r.game !== 'bw') return MINI.start(r);
  r.state = 'play';
  r.map = r.custom ? MG.buildCustom(r.custom) : BW.genMap();
  r.ents = new Map();
  r.teams = [0, 1, 2, 3].map(() => ({ bed: true, elim: false, up: { sharp: 0, prot: 0, forge: 0, haste: 0, heal: 0, trap: 0 } }));
  r.gens = r.map.gens.map((g) => ({ ...g, n: 0, acc: 0, last: 0 }));
  r.projs = []; r.tnts = []; r.events = []; r.tl = 0; r.tier = { dia: 0, em: 0 };
  r.goAt = Date.now() + 4200; r.lastHuman = Date.now();
  r.ev = (a) => r.events.push(a);
  const used = new Set();
  for (const m of r.members) { const e = makeEnt(r, { cid: m.cid, nick: m.nick, look: m.look, team: m.team, conn: m.conn }); if (m.conn) { leaveSpace(m.conn); m.conn.ent = e; m.conn.room = r; } }
  { // Bedwars picks Solo / Duos / Squads from how many people are here
    const humansN = [...r.ents.values()].length, cnt = [0, 0, 0, 0]; for (const e of r.ents.values()) cnt[e.team]++;
    r.autoPer = autoPer(humansN, 0);
    const parties = Math.max(...cnt); if (parties > r.autoPer && parties <= 25) { // keep friends together, but rebalance if a team is overloaded
      const sorted = [...r.ents.values()].sort((a, b) => cnt[b.team] - cnt[a.team]);
      for (const e of sorted) { if (cnt[e.team] > r.autoPer) { let best = 0; for (let t = 1; t < 4; t++) if (cnt[t] < cnt[best]) best = t; if (cnt[best] < r.autoPer) { cnt[e.team]--; e.team = best; cnt[best]++; const b = r.map.bases[best]; e.x = b.spawn.x; e.y = b.spawn.y; } } }
      r.autoPer = Math.max(r.autoPer, ...cnt);
    }
    r.mode = r.autoPer === 1 ? 'solo' : r.autoPer === 2 ? 'duos' : 'squads';
  }
  let roleIdx = [0, 0, 0, 0];
  for (const e of r.ents.values()) roleIdx[e.team]++;
  if (r.noBots) { // no bots: only add one if someone would be alone on the map
    const used = [0, 1, 2, 3].filter((t) => [...r.ents.values()].some((e) => e.team === t));
    if (used.length < 2) { const t = [0, 1, 2, 3].find((x) => !used.includes(x)); const e = makeEnt(r, { nick: pick(BOT_NAMES), look: botLook(), team: t, bot: true }); e.ai.role = 'atk'; }
  }
  for (let t = 0; t < 4 && !r.noBots; t++) {
    while ([...r.ents.values()].filter((e) => e.team === t).length < basePer(r)) {
      let name; do { name = pick(BOT_NAMES); } while (used.has(name) && used.size < BOT_NAMES.length); used.add(name);
      const e = makeEnt(r, { nick: name, look: botLook(), team: t, bot: true });
      e.ai.role = roleIdx[t]++ === 0 ? 'def' : 'atk';
    }
  }
  for (const e of r.ents.values()) if (e.conn) send(e.conn, fullState(r, e));
}

// ============================================================ School-mode quiz (Gimkit-style)
function quizReward(r, e) {
  const st = e.qz.streak, murder = r.game === 'murder';
  // every game except Murder Mystery: each right answer = a quarter of the bar (4 answers fill it, never more than full)
  const cap = murder ? 250 : 100, out = { en: murder ? 10 + Math.min(10, st * 2) : 25 };
  out.en = Math.max(0, Math.min(out.en, cap - e.energy)); e.energy = Math.min(cap, e.energy + out.en);
  if (r.game === 'bw') {
    e.res.iron += 6; e.res.gold += 2; out.iron = 6; out.gold = 2;
    if (st > 0 && st % 3 === 0) { e.res.dia += 1; out.dia = 1; }
    if (st > 0 && st % 5 === 0) { e.res.em += 1; out.em = 1; }
  } else if (r.game === 'royale') { MINI.rgQuiz(r, e, out);
  } else if (r.game === 'murder') {
    // Murder Mystery: answers only give energy (gold still comes from picking it up on the map)
  } else if (st > 0 && st % 4 === 0 && !e.dead) { e.speedUntil = Date.now() + 8000; out.speed = 1; }
  e.dirty = true;
  return out;
}
function quizMsg(r, e, c, m, now) {
  if (!e.quiz) return;
  if (m.t === 'qz') {
    if (e.qs.cur && now - e.qs.cur.at < 400) return;
    const q = nextQuestion(e.qs, r.qset);
    return send(c, { t: 'qz', q: q.q, choices: q.choices, set: (QSETS[r.qset] || QSETS.blooket).name, en: Math.ceil(e.energy), qz: e.qz });
  }
  const cur = e.qs.cur; if (!cur || cur.done) return;
  if (now - cur.at < 150) return send(c, { t: 'qr', retry: 1 }); // no machine-gun guessing
  cur.done = true;
  const ok = (m.i | 0) === cur.ans;
  let gain = null;
  if (ok) { e.qz.right++; e.qz.streak++; e.qz.best = Math.max(e.qz.best, e.qz.streak); gain = quizReward(r, e); }
  else { e.qz.wrong++; e.qz.streak = 0; e.dirty = true; }
  GMS.recordQuiz(e.cid, e.nick, ok, e.qz.streak);
  classRecord(e.cid, e.nick, ok, r.qset, cur.i);
  send(c, { t: 'qr', ok, ans: cur.ans, gain, en: Math.ceil(e.energy), qz: e.qz });
}
function quizBoard(r) {
  return [...r.ents.values()].filter((e) => e.quiz).map((e) => ({ nick: e.nick, team: e.team, right: e.qz.right, wrong: e.qz.wrong, best: e.qz.best })).sort((a, b) => b.right - a.right).slice(0, 30);
}

// ============================================================ Teacher tools: class stats, class question, game vote
const CLASS = { since: Date.now(), kids: new Map(), miss: new Map(), cq: null, vote: null };
function classReset() { CLASS.since = Date.now(); CLASS.kids.clear(); CLASS.miss.clear(); CLASS.cq = null; }
function classRecord(cid, nick, ok, setKey, qi) {
  if (!cid) return;
  const k = CLASS.kids.get(cid) || { nick, right: 0, wrong: 0, last: 0 };
  k.nick = nick; if (ok) k.right++; else k.wrong++; k.last = Date.now(); CLASS.kids.set(cid, k);
  const set = QSETS[setKey] || QSETS.blooket, it = set.items[qi]; if (!it) return;
  const key = setKey + ':' + qi, q = CLASS.miss.get(key) || { q: it.q, a: it.a, miss: 0, total: 0 };
  q.total++; if (!ok) q.miss++; CLASS.miss.set(key, q);
}
function classInfo() {
  const kids = [...CLASS.kids.values()].map((k) => ({ nick: k.nick, right: k.right, wrong: k.wrong, acc: k.right + k.wrong ? Math.round(k.right / (k.right + k.wrong) * 100) : 0, ago: Math.round((Date.now() - k.last) / 1000) })).sort((a, b) => b.right - a.right);
  const miss = [...CLASS.miss.values()].filter((q) => q.miss > 0).map((q) => ({ q: q.q, a: q.a, miss: q.miss, total: q.total, pct: Math.round(q.miss / q.total * 100) })).sort((a, b) => b.pct - a.pct || b.miss - a.miss).slice(0, 10);
  const sc = schoolCfg(), set = QSETS[(sc && sc.set) || 'blooket'] || QSETS.blooket;
  let cq = null;
  if (CLASS.cq) { const c = CLASS.cq; const ans = [...c.answers.values()]; cq = { id: c.id, q: c.q, a: c.a, open: Date.now() < c.until, left: Math.max(0, Math.ceil((c.until - Date.now()) / 1000)), sent: c.sent, answered: ans.length, right: ans.filter((x) => x.ok).length, wrongNames: ans.filter((x) => !x.ok).map((x) => x.nick).slice(0, 30), counts: c.counts, choices: c.choices }; }
  let vote = null;
  if (CLASS.vote) { const v = CLASS.vote; vote = { left: Math.max(0, Math.ceil((v.endAt - Date.now()) / 1000)), counts: voteCounts(), voters: v.votes.size }; }
  const online = [...conns].filter((x) => !x.spectator && !x.owner).map((x) => ({ pid: x.pid, nick: x.nick, where: x.room ? (x.room.state === 'play' ? '' + (x.room.game === 'bw' ? 'Bedwars' : MG.GAMES[x.room.game].name) : 'waiting') : x.watch ? 'watching' : 'hub' })).sort((a, b) => a.nick.localeCompare(b.nick));
  const live = [...rooms.values()].filter((r) => r.state === 'play' && r.ents).map((r) => ({ id: r.id, game: r.game, n: [...r.ents.values()].filter((e) => e.conn).length, mins: Math.floor((Date.now() - r.goAt) / 60000) }));
  const bannedNames = (GMS.store.nameBans || []).slice(-30);
  return { online, live, bannedNames, since: CLASS.since, kids, miss, set: set.items.map((it, i) => ({ i, q: it.q.slice(0, 90) })), setName: set.name, cq, vote, until: sc && sc.until || 0 };
}
function sendClassQuestion(by, qi) {
  const sc = schoolCfg(), key = (sc && sc.set) || 'blooket', set = QSETS[key] || QSETS.blooket;
  const i = qi >= 0 && qi < set.items.length ? qi : (Math.random() * set.items.length) | 0;
  const st = {}; st.deck = [i]; st.set = key;
  const q = nextQuestion(st, key);
  const id = Date.now();
  CLASS.cq = { id, i, q: q.q, a: set.items[i].a, choices: q.choices, ans: st.cur.ans, until: Date.now() + 45000, answers: new Map(), counts: [0, 0, 0, 0], sent: 0, set: key };
  for (const c of conns) { if (c.spectator) continue; send(c, { t: 'cq', id, q: q.q, choices: q.choices, secs: 45, from: by.nick }); CLASS.cq.sent++; }
  GMS.log('' + by.nick + ' sent a class question');
}
function classAnswer(c, m) {
  const cq = CLASS.cq; if (!cq || cq.id !== Number(m.id) || Date.now() > cq.until || !c.cid || cq.answers.has(c.cid)) return;
  const i = m.i | 0, ok = i === cq.ans;
  cq.answers.set(c.cid, { nick: c.nick, ok }); if (i >= 0 && i < 4) cq.counts[i]++;
  classRecord(c.cid, c.nick, ok, cq.set, cq.i); GMS.recordQuiz(c.cid, c.nick, ok, 0);
  const e = c.ent && c.room && c.room.state === 'play' ? c.ent : null;
  let gain = null; if (ok && e && e.quiz) { const cap = c.room && c.room.game === 'murder' ? 250 : 100; const add = Math.max(0, Math.min(25, cap - e.energy)); e.energy += add; e.dirty = true; gain = { en: add }; }
  send(c, { t: 'qr', ok, ans: cq.ans, gain, en: e && e.quiz ? Math.ceil(e.energy) : -1, qz: e && e.quiz ? e.qz : { right: 0, wrong: 0, streak: 0 }, cq: 1 });
}
// ---- class game vote (owner starts it; everyone not mid-match votes; winner launches a room with everyone in it)
const VOTE_GAMES = ['bw', 'ctf', 'spleef', 'hide', 'murder', 'build', 'duel', 'royale', 'race'];
function voteCounts() { const n = {}; VOTE_GAMES.forEach((g) => { n[g] = 0; }); if (CLASS.vote) for (const g of CLASS.vote.votes.values()) n[g]++; return n; }
function voteTargets() { return [...conns].filter((c) => !c.spectator && !(c.room && c.room.state === 'play')); }
function voteVoters() { const out = {}; if (!CLASS.vote) return out; for (const c of conns) { const g = c.cid && CLASS.vote.votes.get(c.cid); if (!g) continue; (out[g] || (out[g] = [])).length < 12 && out[g].push({ n: c.nick, l: c.look }); } return out; }
function voteBroadcast() { if (!CLASS.vote) return; const msg = { t: 'vote', endAt: CLASS.vote.endAt, left: Math.max(0, CLASS.vote.endAt - Date.now()), total: Math.max(1, CLASS.vote.total || 0), counts: voteCounts(), voters: voteVoters(), games: CLASS.vote.games }; for (const c of voteTargets()) send(c, msg); }
function startVote(by, secs, games) {
  const list = (Array.isArray(games) && games.length ? games : VOTE_GAMES).filter((g) => VOTE_GAMES.includes(g));
  CLASS.vote = { endAt: Date.now() + (secs || 20) * 1000, votes: new Map(), games: list.length >= 2 ? list : VOTE_GAMES, by: by.nick };
  CLASS.vote.total = voteTargets().length;
  voteBroadcast(); GMS.log('' + by.nick + ' started a game vote');
  clearTimeout(CLASS.voteT); CLASS.voteT = setTimeout(endVote, (secs || 20) * 1000 + 200);
}
function endVote(cancel) {
  const v = CLASS.vote; if (!v) return; CLASS.vote = null; clearTimeout(CLASS.voteT);
  const targets = voteTargets();
  if (cancel) { for (const c of targets) send(c, { t: 'vote', done: 1, cancel: 1 }); return; }
  const n = {}; v.games.forEach((g) => { n[g] = 0; }); for (const g of v.votes.values()) if (n[g] != null) n[g]++;
  const top = Math.max(...Object.values(n)); const best = Object.keys(n).filter((g) => n[g] === top);
  const g = best[(Math.random() * best.length) | 0];
  const players = targets.filter((c) => !c.watch);
  const mode = g === 'bw' ? (players.length > 8 ? 'squads' : players.length > 4 ? 'duos' : 'solo') : g;
  for (const c of targets) send(c, { t: 'vote', done: 1, winner: g, counts: n });
  if (g === 'duel') { // 1v1: pair everyone up
    for (let i = 0; i < players.length; i += 2) { const room = makeRoom('public', 'duel', GMS.store.settings.publicDiff, '', 'duel'); joinLobby(players[i], room); if (players[i + 1]) joinLobby(players[i + 1], room); room.startAt = Date.now() + 6000; pushRoom(room); }
  } else {
    let room = makeRoom('public', mode, GMS.store.settings.publicDiff, '', g);
    for (const c of players) { if (room.members.length >= capOf(room)) { room.startAt = Date.now() + 6000; pushRoom(room); room = makeRoom('public', mode, GMS.store.settings.publicDiff, '', g); } joinLobby(c, room); }
    room.startAt = Date.now() + 8000; pushRoom(room);
  }
  GMS.log('Vote winner: ' + g + ' (' + top + ' votes, ' + players.length + ' players)');
}
setInterval(() => { // live vote counts + School Mode timer
  if (CLASS.vote) voteBroadcast();
  const sc = schoolCfg();
  const ss = seasonCfg(); if (ss !== CLASS.lastSeason) { const first = CLASS.lastSeason === undefined; CLASS.lastSeason = ss; if (!first) for (const c of conns) send(c, { t: 'season', v: ss }); }
  const qOn = !!(sc && sc.quiz !== false);
  if (qOn !== CLASS.lastQuiz) { const first = CLASS.lastQuiz === undefined; CLASS.lastQuiz = qOn; if (!first) for (const r of rooms.values()) if (r.school) { r.quiz = qOn; if (r.ents) for (const e of r.ents.values()) if (!e.bot) { e.quiz = qOn; if (qOn && !(e.energy > 0)) e.energy = 100; e.dirty = true; } } }
  const gam = !!(sc && sc.gamble);
  if (!!sc !== CLASS.lastSchool || gam !== CLASS.lastGamble || qOn !== CLASS.lastQz) { CLASS.lastSchool = !!sc; CLASS.lastGamble = gam; CLASS.lastQz = qOn; for (const c of conns) send(c, { t: 'school', on: !!sc, gamble: gam, quiz: qOn }); }
  if (sc && sc.until && Date.now() > sc.until && globalThis.SH_SET_SCHOOL) { globalThis.SH_SET_SCHOOL(false, null, 0); GMS.log('School mode timer ended — school mode OFF'); for (const c of conns) send(c, { t: 'toast', msg: 'Class time is over — School Mode is off!' }); }
}, 1000);
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
    custom: r.custom || null, cfg: GMS.clientCfg(r.game),
    t: 'game', you: e.id, team: e.team, mode: r.mode, kind: r.kind, code: r.code, diff: r.diff, goAt: r.goAt, now: Date.now(),
    ents: [...r.ents.values()].map(entPub), beds: m.beds.map((b) => (b.alive ? 1 : 0)), gens: r.gens.map((g) => [g.n, g.last]),
    teams: teamsInfo(r), tier: r.tier, tl: r.tl, blocks, tnts: r.tnts.map((x) => [x.id, x.x, x.y, x.at]), qc: BW_QC,
  };
}
function meMsg(e) {
  const now = Date.now();
  return { t: 'me', en: e.quiz ? Math.ceil(e.energy) : -1, qz: e.quiz ? e.qz : null, role: e.team, mr: e.mrole || '', gold: e.gold | 0, z: e.z || 0, prop: e.prop || '', hp: Math.ceil(e.hp), absorb: Math.ceil(e.absorb), inv: e.inv, res: e.res, sword: e.sword, armor: e.armor, pick: e.pick, held: e.held, dead: e.dead, elim: e.elim, respawn: e.dead && !e.elim ? Math.max(0, e.respawnAt - now) : 0, speed: Math.max(0, e.speedUntil - now), slow: Math.max(0, e.slowUntil - now), stats: e.stats };
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
  if (now < v.invulnUntil && kind !== 'gun') return false;
  const red = Math.min(0.8, BW.ARMORS[v.armor].red + 0.06 * r.teams[v.team].up.prot);
  let dmg = amount * (1 - red);
  if (v.absorb > 0) { const a = Math.min(v.absorb, dmg); v.absorb -= a; dmg -= a; }
  v.hp -= dmg; v.lastDmgAt = now; if (kind !== 'gun') v.invulnUntil = now + (kind === 'melee' ? 300 : 120);
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
  if (e.onehit) dmg = 100;
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
  const b = r.map.bases[e.team % r.map.bases.length];
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
  GMS.log('' + (r.game === 'bw' ? 'Bedwars' : MG.GAMES[r.game].name) + ' #' + r.id + ' ended — ' + (winner >= 0 ? (r.game === 'hide' ? (winner ? 'seekers' : 'hiders') : (BW.TEAMS[winner] || {}).name) + ' won' : 'draw'));
  const stats = [...r.ents.values()].map((e) => ({ id: e.id, nick: e.nick, team: e.team, bot: e.bot, look: e.look, ...e.stats }));
  const mult = r.kind === 'public' ? 1 : 0.5;
  const extra = r.game !== 'bw' ? MINI.endInfo(r) : {};
  if (r.game === 'duel' && r.kind !== 'practice') extra.elo = GMS.duelElo(r, winner);
  if (r.quiz) extra.quiz = quizBoard(r);
  for (const e of r.ents.values()) {
    if (e.bot || !e.cid) continue;
    const win = r.game !== 'bw' ? MINI.isWinner(r, e, winner) : e.team === winner;
    const amount = (r.game !== 'bw' ? MINI.reward(r, e, win) : 15 + (win ? 100 : 0) + e.stats.kills * 3 + e.stats.finals * 8 + e.stats.beds * 25) * mult * GMS.rewardMult();
    let rew = null; try { rew = bwReward(e.cid, amount, { win, nick: e.nick, kills: e.stats.kills | 0, finals: e.stats.finals | 0, beds: e.stats.beds | 0, deaths: e.stats.deaths | 0 }); } catch (err) {}
    try { if (r.kind === 'public') GMS.recordResult(e.cid, e.nick, r.game, win, e.stats); } catch (err) {}
    if (e.conn) send(e.conn, { t: 'end', game: r.game, winner, win, you: e.id, team: e.team, stats, reward: rew, mins: Math.max(0, (Date.now() - r.goAt) / 60000), ...extra });
  }
  if (r.watchers) for (const w of r.watchers) { send(w, { t: 'end', game: r.game, winner, win: false, watch: true, you: -1, team: -1, stats, reward: null, mins: Math.max(0, (Date.now() - r.goAt) / 60000), ...extra }); }
  setTimeout(() => { if (r.watchers) for (const w of [...r.watchers]) stopWatch(w); }, 9000);
  setTimeout(() => killRoom(r), 60000);
}

// ============================================================ bots
function newAI(r, e) { return { role: 'atk', goal: null, path: null, pi: 0, thinkAt: 0, enemy: null, swingAt: 0, reactAt: 0, placeAt: 0, stuckT: 0, lx: 0, ly: 0, built: false, rushAt: 0, fbAt: 0, strafe: rnd() < 0.5 ? 1 : -1, strafeAt: 0 }; }
function blocksOf(e) { return e.inv.wool + e.inv.wood + e.inv.end; }
function blockKey(e) { return e.inv.wool ? 'wool' : e.inv.wood ? 'wood' : e.inv.end ? 'end' : e.inv.obby ? 'obby' : null; }
function baseL(b, a, bb) { return [b.cx + a * b.right[0] + bb * b.inward[0], b.cy + a * b.right[1] + bb * b.inward[1]]; }
function inRect(rc, x, y) { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx >= rc[0] - 1 && tx <= rc[2] + 1 && ty >= rc[1] - 1 && ty <= rc[3] + 1; }

// A* over tiles. Walking = 1, bridging over void = 2.4 (needs blocks), mining a wall = by hardness.
const AS = { g: new Float32Array(MAXN), came: new Int32Array(MAXN), seen: new Uint32Array(MAXN), closed: new Uint32Array(MAXN), gen: 0 };
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
    if (o.team === e.team || o.dead || o.elim || o.vanish) continue;
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
  const base = r.map.bases[e.team % r.map.bases.length];
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
  if (g.type === 'defend') { const o = r.ents.get(g.t); return !o || o.dead || o.elim || !inRect(r.map.bases[e.team % r.map.bases.length].rect, o.x, o.y); }
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
  if (!r.school && ai.role === 'def' && el > 70 && e.res.dia < 4 && bl >= 26 && rnd() < 0.35) {
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
  const b = r.map.bases[e.team % r.map.bases.length];
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
  if (r.quiz && r.game === 'bw' && !e.dead) { // School Mode: generators are off, so bots "answer questions" like a student would
    const ai0 = e.ai; if (!ai0.qAt) ai0.qAt = now + 2000 + rnd() * 3000;
    if (now >= ai0.qAt && now >= r.goAt) {
      ai0.qAt = now + 4500 + rnd() * 4000;
      if (rnd() < 0.75) { e.qz.streak++; e.qz.right++; const st = e.qz.streak; e.res.iron += 6; e.res.gold += 2; if (st % 3 === 0) e.res.dia += 1; if (st % 5 === 0) e.res.em += 1; }
      else { e.qz.streak = 0; e.qz.wrong++; }
    }
  }
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
    if (e.held !== 'sword' && !(ai.goal && ai.goal.type === 'attack') && r.game !== 'hide' && r.game !== 'murder' && r.game !== 'build') e.held = 'sword';
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
  if (r.paused) return;
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
    if (r.quiz) { g.acc = 0; continue; } // School mode with questions on: resources come from answering questions
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
    if (tm.up.heal && inRect(m.bases[e.team % m.bases.length].rect, e.x, e.y)) heal += 1;
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
          if (p.kind === 'arrow') hurt(r, v, r.game === 'murder' ? 100 : p.dmg, r.ents.get(p.owner), 'arrow', p.vx, p.vy, 220, false);
          else if (p.kind === 'snow') { MINI.snowHit(r, v, p); }
          else if (p.kind === 'bullet') hurt(r, v, p.dmg, r.ents.get(p.owner), 'gun', p.vx, p.vy, 55, false);
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
  return (e.dead ? 1 : 0) | (e.mv ? 2 : 0) | (e.mine ? 4 : 0) | (e.bow ? 8 : 0) | (now < e.regenUntil ? 16 : 0) | (now < e.speedUntil ? 32 : 0) | (now < e.invulnUntil - 400 ? 64 : 0) | (e.elim ? 128 : 0) | (e.ctl === 'ai' && !e.bot ? 256 : 0) | (e.god ? 512 : 0) | (e.vanish ? 1024 : 0) | (e.giant ? 2048 : 0) | (e.tiny ? 4096 : 0);
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
  if (r.watchers) for (const w of r.watchers) send(w, s);
  for (const e of r.ents.values()) if (e.conn) {
    send(e.conn, s);
    if (e.dirty) { e.dirty = false; send(e.conn, meMsg(e)); }
  }
}
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) { try { BW.useMap(r.map); tickRoom(r, now); } catch (err) { console.error('bedwars tick', err && err.stack); } finally { BW.setDims(72, 72); } }
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
  const out = { solo: 0, duos: 0, squads: 0, ctf: 0, spleef: 0, hide: 0, duel: 0, murder: 0, build: 0, royale: 0, race: 0, playing: 0, hub: HUB.conns.size, inGame: { bw: 0, ctf: 0, spleef: 0, hide: 0, duel: 0, murder: 0, build: 0, royale: 0, race: 0 } };
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
    if (!cid) { try { ws.send(JSON.stringify({ t: 'err', code: 'login', msg: 'Pick a nickname to play' })); ws.close(4000); } catch (e) {} return; }
    const c = { ws, cid, nick: String(nick || 'Guest').slice(0, 20), look: worldLook(cid), ip: ipOf(req), cst: {}, room: null, ent: null, space: null, pid: nextPid++, alive: true, tok: 40, tokAt: Date.now() };
    c.owner = !!(req._auth && OWNERS.has(String(req._auth.username || '').toLowerCase()));
    c.mapper = !!(req._auth && String(req._auth.username || '').toLowerCase() === GMS.MAPPER);
    c.uname = req._auth && req._auth.username ? String(req._auth.username) : '';
    c.maker = !!(req._auth && req._auth.username);   // any signed-in account may build; maps go to the owner for approval
    try { const tk = globalThis.SH_TEACHER_KEY && globalThis.SH_TEACHER_KEY(); const ck = /(?:^|;\s*)sh_teacher=([^;]+)/.exec(req.headers.cookie || ''); c.teacher = !!(tk && ck && decodeURIComponent(ck[1]) === tk); } catch (e) { c.teacher = false; }
    c.spectator = !!(c.teacher && !c.owner); // the teacher watches; she isn't a player
    if (GMS.store.renames && GMS.store.renames[cid]) c.nick = GMS.store.renames[cid];
    let isBuilder = false; try { isBuilder = new URL(req.url, 'http://x').searchParams.get('builder') === '1'; } catch (e) {}
    if (isBuilder) { // the map builder page: its own little channel, never a player
      send(c, { t: 'hello', builder: true, mapper: c.mapper, maker: !!c.maker, nick: c.nick });
      ws.on('message', (buf, bin) => { if (bin) return; let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; } if (!m) return; if (m.t === 'ping') return send(c, { t: 'pong', c: m.c, n: Date.now() }); if (m.t === 'mb') { try { mbMsg(c, m); } catch (err) { send(c, { t: 'mbs', ok: false, msg: 'Error: ' + (err && err.message) }); } } });
      return;
    }
    const nameBan = !c.owner && !c.teacher && (GMS.store.nameBans || []).includes(c.nick.toLowerCase());
    const banned = GMS.banInfo(cid) || (nameBan ? { until: 0 } : null);
    if (banned && !c.owner) { try { ws.send(JSON.stringify({ t: 'err', code: 'kicked', msg: 'You’re banned from Games' + (banned.until ? ' until ' + new Date(banned.until).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '') + '.' })); ws.close(4001); } catch (e) {} return; }
    // One session per account: the newest tab wins and takes over the old one's seat.
    for (const o of [...conns]) if (o.cid === cid) {
      try { o.ws.send(JSON.stringify({ t: 'err', code: 'replaced', msg: 'You opened Bedwars in another tab.' })); } catch (e) {}
      const r = o.room; o.room = null; conns.delete(o); leaveSpace(o);
      if (r) { if (r.state === 'lobby') { const mb = r.members.find((x) => x.conn === o); if (mb) { mb.conn = c; c.room = r; } } else if (r.state === 'play' && o.ent) { o.ent.conn = null; } }
      try { o.ws.terminate(); } catch (e) {}
    }
    conns.add(c);
    for (const p of parties.values()) if (p.members.includes(cid)) { c.party = p.id; p.nicks[cid] = c.nick; }
    ws.on('pong', () => { c.alive = true; });
    send(c, { t: 'hello', now: Date.now(), nick: c.nick, look: c.look, stats: bwStats(cid), online: lobbyList(), qc: BW_QC, owner: c.owner, teacher: !!c.teacher, mapper: c.mapper, motd: GMS.store.settings.motd, hubfx: GMS.store.settings.hubFx !== 0, x2: GMS.rewardMult() > 1, elo: GMS.eloOf(cid), cid, school: !!schoolCfg(), gamble: !!(schoolCfg() && schoolCfg().gamble), squiz: !!(schoolCfg() && schoolCfg().quiz !== false), season: seasonCfg() });
    setTimeout(() => { try { socialMsg(c, { t: 'soc' }, Date.now()); } catch (e) {} }, 600);
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
      try { BW.useMap(c.room && c.room.map); onMsg(c, msg, now); } catch (err) { console.error('bedwars msg', err && err.stack); } finally { BW.setDims(72, 72); }
    });
    const bye = () => { if (!conns.has(c)) return; conns.delete(c); try { if (c.watch) stopWatch(c, true); BW.useMap(c.room && c.room.map); if (c.room) leaveRoom(c, true); } finally { BW.setDims(72, 72); } leaveSpace(c); };
    ws.on('close', bye); ws.on('error', bye);
  });
}
function onMsg(c, m, now) {
  const r = c.room, t = m.t;
  if (t === 'ping') return send(c, { t: 'pong', c: m.c, n: now });
  if (c.frozen && (t === 'mv' || t === 'sw' || t === 'hop' || t === 'mine' || t === 'pl' || t === 'use' || t === 'bow' || t === 'dig')) {
    if (t === 'mv' && now - (c.frzAt || 0) > 700) { c.frzAt = now; const e0 = c.ent; if (e0 && r && r.state === 'play') send(c, { t: 'pos', x: Math.round(e0.x), y: Math.round(e0.y) }); else if (c.space) send(c, { t: 'pos', x: Math.round(c.sx), y: Math.round(c.sy) }); }
    return;
  }
  if (t === 'vc') { c.voice = !!m.on; send(c, { t: 'vcstate', on: c.voice, off: VOICE_OFF, muted: !!c.vmuted, range: VOICE_R }); return; }
  if (t === 'adm' && !c.owner && c.teacher) { const TA = ['info', 'class', 'classreset', 'cq', 'cqclose', 'vote', 'skick', 'sban', 'srename', 'swatch', 'sunban']; if (TA.includes(String(m.a))) { try { if (m.a === 'info') send(c, { t: 'adminfo', teacher: true, school: schoolCfg(), rooms: [], conns: [], bans: [], logs: [], maps: [], rot: {}, mega: [], settings: {}, now: Date.now() }); else adminMsg(c, m, now); } catch (err) { send(c, { t: 'admres', ok: false, msg: 'Error: ' + (err && err.message) }); } } return; }
  if (t === 'adm') { if (c.owner) { try { adminMsg(c, m, now); } catch (err) { send(c, { t: 'admres', ok: false, msg: 'Error: ' + (err && err.message) }); } } return; }
  if (LOCKED && !c.owner && (t === 'quick' || t === 'practice' || t === 'create' || t === 'join')) return send(c, { t: 'err', msg: 'New Bedwars matches are paused by the owners. Try again soon!' });
  if (t === 'cqa') { classAnswer(c, m); return; }
  if (t === 'vote') { if (CLASS.vote && Date.now() < CLASS.vote.endAt && c.cid && CLASS.vote.games.includes(String(m.g))) { CLASS.vote.votes.set(c.cid, String(m.g)); voteBroadcast(); } return; }
  if (t === 'soc' || t === 'pinv' || t === 'pacc' || t === 'pdec' || t === 'pleave' || t === 'pkick' || t === 'plead' || t === 'fjoin' || t === 'fwatch') { socialMsg(c, m, now); return; }
  if (c.watch && (t === 'leave' || t === 'hub' || t === 'quick' || t === 'practice' || t === 'create' || t === 'join')) stopWatch(c, t !== 'leave' && t !== 'hub');
  if (c.watch) return;
  // ---- menus
  const game = MG.isMini(m.game) ? m.game : 'bw';
  if ((t === 'quick' || t === 'practice' || t === 'create' || t === 'join') && c.spectator) return send(c, { t: 'err', msg: 'You’re watching as the teacher — use Teacher Tools to spectate a match.' });
  if ((t === 'quick' || t === 'practice' || t === 'create') && !c.owner && globalThis.SH_GAME_OFF && globalThis.SH_GAME_OFF(game)) return send(c, { t: 'err', msg: 'This game is switched off right now. Try another one!' });
  if ((t === 'quick' || t === 'practice' || t === 'create' || t === 'join') && schoolCfg() && !c.owner) return send(c, { t: 'err', msg: 'Games are locked in School Mode — your teacher starts the next game with a vote.' });
  if (t === 'quick') {
    const mode = game !== 'bw' ? game : BW.MODES[m.mode] ? m.mode : 'solo';
    let room = null;
    const pp = partyOf(c);
    if (pp && pp.leader !== c.cid && pp.members.length > 1) return send(c, { t: 'err', msg: 'Your party leader (' + (pp.nicks[pp.leader] || '?') + ') picks the game. Leave the party to queue alone.' });
    const size = 1 + partyMates(c).length;
    for (const x of rooms.values()) if (x.kind === 'public' && x.state === 'lobby' && x.game === game && (game === 'bw' || x.mode === mode) && x.members.length + size <= capOf(x) && (!x.startAt || x.startAt - now > 2500)) { room = x; break; }
    if (!room) room = makeRoom('public', mode, GMS.store.settings.publicDiff, '', game);
    return joinWithParty(c, room);
  }
  if (t === 'practice') {
    const room = makeRoom('practice', m.mode, m.diff, c.cid, game);
    if (m.map) { const cm = GMS.getMap(String(m.map)); if (!cm || cm.game !== game) return send(c, { t: 'err', msg: 'That map doesn’t exist any more.' }); if (!cm.ok && !c.mapper) return send(c, { t: 'err', msg: 'That map isn’t finished yet.' }); if (!cm.ok) { const pr = MG.validateCustom(cm); return send(c, { t: 'err', msg: 'Map not ready: ' + pr.slice(0, 2).join(' · ') }); } room.mapId = cm.id; room.testMap = true; }
    return joinWithParty(c, room, 0);
  }
  if (t === 'create') { const room = makeRoom('private', m.mode, m.diff, c.cid, game); return joinWithParty(c, room, 0); }
  if (t === 'join') {
    const room = codes.get(String(m.code || '').toUpperCase().trim());
    if (!room || room.state !== 'lobby') return send(c, { t: 'err', msg: 'No open room with that code.' });
    return joinWithParty(c, room);
  }
  if (t === 'leave' || t === 'hub') { if (c.room) leaveRoom(c); else goHub(c); return; }
  if (t === 'say') {   // typed chat: same filter as the casino. Everyone in the same place hears it.
    const rr = chatSay({ scope: 'games', cid: c.cid, nick: c.nick, ip: c.ip, st: c.cst }, m.text, now);
    if (!rr.ok) { if (rr.err) send(c, { t: 'sayerr', msg: rr.err }); return; }
    const r0 = c.room;
    if (r0 && r0.state === 'play') { const e0 = c.ent; if (e0 && e0.conn === c) r0.ev(['say', e0.id, rr.text, c.nick]); else send(c, { t: 'say', nick: c.nick, text: rr.text, self: true }); }
    else if (r0 && r0.state === 'lobby') { for (const mb of r0.members) if (mb.conn) send(mb.conn, { t: 'say', nick: c.nick, text: rr.text }); }
    else if (c.space) c.space.events.push(['say', c.pid, rr.text, c.nick]);
    else send(c, { t: 'say', nick: c.nick, text: rr.text, self: true });
    return;
  }
  if (t === 'look') { c.look = worldLook(c.cid); if (c.space && !c.spectator) c.space.events.push(['pj', c.pid, c.nick, c.look, Math.round(c.sx), Math.round(c.sy), spaceTeam(c)]); send(c, { t: 'mylook', look: c.look }); return; }
  if (c.space && (t === 'mv' || t === 'sw' || t === 'hop' || t === 'lb2' || (t === 'qc' && (!r || r.state !== 'play')))) return spaceMsg(c, m, now);
  if (!r) return;
  if (r.state === 'lobby') {
    if (t === 'team' && r.kind === 'private' && r.game !== 'hide') {
      const tm = Number(m.team); const mb = r.members.find((x) => x.conn === c);
      if (mb && tm >= 0 && tm < nTeams(r) && r.members.filter((x) => x.team === tm).length < per(r)) { mb.team = tm; pushRoom(r); }
    } else if (t === 'cfg' && r.kind === 'private' && r.host === c.cid) {
      if (r.game === 'bw' && BW.MODES[m.mode]) { r.mode = m.mode; for (const t2 of [0, 1, 2, 3]) { const mm = r.members.filter((x) => x.team === t2); while (mm.length > per(r)) { const x = mm.pop(); x.team = bestTeam(r); } } }
      if (SK[m.diff]) r.diff = m.diff;
      if (typeof m.bots === 'boolean') r.noBots = !m.bots;
      if (m.map != null) { const id = String(m.map); if (id === '' || id === 'default') r.mapId = id || null; else { const cm = GMS.getMap(id); if (cm && cm.ok && cm.game === r.game) r.mapId = id; } }
      pushRoom(r);
    } else if (t === 'start' && r.kind === 'private' && r.host === c.cid) { r.startAt = now + 3000; pushRoom(r); }
    return;
  }
  if (r.state !== 'play') return;
  const e = c.ent; if (!e || e.conn !== c) return;
  if (t === 'qc') { if (now - (e.qcAt || 0) < 1200) return; e.qcAt = now; const i = m.i | 0; if (i >= 0 && i < BW_QC.length) r.ev(['qc', e.id, i]); return; }
  if (t === 'qz' || t === 'qa') { quizMsg(r, e, c, m, now); return; }
  if (e.dead || e.elim) return;
  if (now < r.goAt && !(r.game === 'race' && t === 'rcc')) return;
  if (r.game !== 'bw' && MINI.onMsg(r, e, m, now)) return;
  if (t === 'mv') {
    let x = Number(m.x), y = Number(m.y); if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const dt = Math.min(1, (now - (e.lastMv || now - 50)) / 1000); e.lastMv = now;
    const allow = BW.SPEED * (now < e.speedUntil ? 1.35 : 1) * (e.rgMul || 1) * dt * 1.6 + 26 + e.kbBudget;
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
    let bad = false;
    if (d > allow && !e.god) { x = e.x + dx / d * allow; y = e.y + dy / d * allow; bad = true; }
    if (BW.hits(r.map, x, y, false) && !BW.hits(r.map, e.x, e.y, false)) { x = e.x; y = e.y; bad = true; }
    if (e.quiz && !e.dead && !e.god) { // School mode: walking uses energy, answering questions refills it
      const moved = Math.hypot(x - e.x, y - e.y);
      if (e.energy <= 0 && moved > 2) { x = e.x; y = e.y; if (now - (e.noEnAt || 0) > 500) { e.noEnAt = now; bad = true; } else bad = false; }
      else if (moved > 0.5) { const before = Math.ceil(e.energy); e.energy = Math.max(0, e.energy - moved / T * (m.m === 2 ? 1.6 : 1) * 0.9); if (Math.ceil(e.energy) !== before) e.dirty = true; }
    }
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
  if (t === 'sel') { const it = String(m.it); if ((r.game !== 'bw' ? MG.hotbar(r.game, e.inv, r.game === 'murder' ? e.mrole : e.team) : BW.hotbar({ ...e.inv, pick: e.pick })).includes(it)) e.held = it; return; }
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
// Hub admin: live rooms (read-only snapshot + end). Server-side only; server.js checks the caller's role.
export function bwAdminRooms() { return { rooms: [...rooms.values()].filter((r) => r.state !== 'dead').map(roomSummary), online: conns.size }; }
export function bwEndRoom(id) { const r = rooms.get(Number(id)); if (!r || r.state === 'dead') return false; if (r.state === 'play') endMatch(r, -1); else return false; return true; }

function adminInfo(c) {
  const where = (x) => x.room ? (x.room.state === 'play' ? (x.room.game === 'bw' ? 'Bedwars' : MG.GAMES[x.room.game].short) + ' #' + x.room.id : x.room.state === 'lobby' ? 'waiting #' + x.room.id : 'results #' + x.room.id) : x.space ? 'hub' : '—';
  const me = c.ent;
  return {
    t: 'adminfo', locked: LOCKED, voiceOff: VOICE_OFF, now: Date.now(), myRoom: c.room ? c.room.id : 0, myEnt: c.ent ? c.ent.id : 0, mapper: c.mapper,
    my: me ? { god: !!me.god, vanish: !!me.vanish, onehit: !!me.onehit, speed: Date.now() < me.speedUntil } : null,
    rooms: [...rooms.values()].filter((r) => r.state !== 'dead').map(roomSummary),
    conns: [...conns].map((x) => ({ pid: x.pid, nick: x.nick, owner: !!x.owner, where: where(x), voice: !!x.voice, vmuted: !!x.vmuted, frozen: !!x.frozen, coins: bwStats(x.cid) ? bwStats(x.cid).coins : 0, talking: now0() - (x.vTalkAt || 0) < 1500 })),
    settings: GMS.store.settings, x2Left: Math.max(0, (GMS.store.settings.doubleUntil || 0) - Date.now()),
    bans: Object.entries(GMS.store.bans).map(([cid, b]) => ({ cid, nick: b.nick, until: b.until, by: b.by })),
    logs: GMS.store.logs.slice(-60).reverse(),
    maps: GMS.listMaps(), rot: GMS.store.rot,
    school: schoolCfg(),
    season: seasonCfg(),
    mega: MEGA.map((o) => ({ id: o.id, icon: o.icon, label: o.label, cat: o.cat, scope: o.scope, danger: !!o.danger })),
  };
}
// ---- the map builder's channel (only the map maker's account may use it)
function mbMsg(c, m) {
  if (!c.mapper && !c.maker) return send(c, { t: 'mbs', ok: false, msg: 'Sign in to build maps.' });
  const a = String(m.a || '');
  if (!c.mapper) {   // any signed-in player: build and send for approval. Nothing goes live until the owner says so.
    const me = String(c.uname || c.nick), subs = () => SUB.mine(me, 'map');
    const mineList = () => subs().filter((x) => x.status !== 'approved').map((x) => { const s0 = SUB.get(x.id); const pl = s0 && s0.payload; return { id: x.id, name: x.title, game: pl && pl.game || 'bw', author: me, at: x.at, ok: false, pending: x.status === 'pending', rejected: x.status === 'rejected', note: x.note, rot: false }; });
    const list = () => send(c, { t: 'mbl', maps: [...mineList(), ...GMS.listMaps().filter((x) => x.ok)], rot: {}, maker: true });
    if (a === 'list') return list();
    if (a === 'get') { const id = String(m.id); if (id.startsWith('s_')) { const s0 = SUB.get(id); if (!s0 || s0.by.toLowerCase() !== me.toLowerCase() || !s0.payload || s0.payload.dropped) return send(c, { t: 'mbg', map: null }); return send(c, { t: 'mbg', map: { ...s0.payload, id } }); } const cm = GMS.getMap(id); return send(c, { t: 'mbg', map: cm && cm.ok ? { ...cm, id: '' } : null }); }
    if (a === 'save') {
      const raw = m.map || {}, r0 = GMS.checkMap(raw); if (!r0.ok) return send(c, { t: 'mbs', ok: false, msg: r0.msg });
      if (r0.problems.length) return send(c, { t: 'mbs', ok: true, saved: false, problems: r0.problems, msg: 'Fix the problems first, then send it again.' });
      const rid = String(raw.id || '').startsWith('s_') ? String(raw.id) : '';
      const r = SUB.add({ kind: 'map', by: me, byId: c.cid, title: r0.cm.name, payload: r0.cm, replaceId: rid });
      if (r.err) return send(c, { t: 'mbs', ok: false, msg: r.err });
      send(c, { t: 'mbs', ok: true, id: r.sub.id, pending: !r.auto, auto: !!r.auto, problems: [], msg: r.auto ? 'Live in the rotation. You are a trusted maker.' : 'Sent to Scrollreader11 for approval.' }); return list();
    }
    if (a === 'del') { SUB.removeOwn(String(m.id), me); return list(); }
    return;
  }
  const list = () => send(c, { t: 'mbl', maps: GMS.listMaps(), rot: GMS.store.rot });
  if (a === 'list') return list();
  if (a === 'get') {
    const id = String(m.id);
    if (id.startsWith('s_')) { const s0 = SUB.get(id), pl = s0 && s0.kind === 'map' && s0.payload && !s0.payload.dropped ? s0.payload : null; return send(c, { t: 'mbg', map: pl ? { ...pl, id: undefined, name: pl.name } : null }); }   // look at a player's waiting map
    const cm = GMS.getMap(id); return send(c, { t: 'mbg', map: cm });
  }
  if (a === 'save') { const res = GMS.saveMap(m.map || {}, c.nick); send(c, { t: 'mbs', ...res }); return list(); }
  if (a === 'del') { GMS.deleteMap(String(m.id), c.nick); return list(); }
  if (a === 'rot') { GMS.setRotation(String(m.game), String(m.id), !!m.on); return list(); }
}

// ============================================================ owner powers (Scrollreader11 only)
// scope: 'p' = the picked player, 'r' = the picked match, 'g' = everyone
function megaEnt(x) { return x && x.room && x.room.state === 'play' && x.ent ? x.ent : null; }
function megaFx(x, kind, extra) { send(x, { t: 'fx', kind, ...(extra || {}) }); }
const MEGA = [
  { id: 'heal', icon: '', label: 'Full heal', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.hp = BW.MAX_HP; e.dead = false; e.dirty = true; return 'Healed ' + e.nick; } },
  { id: 'onehp', icon: '', label: 'Set to 1 HP', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); if (!e.god) e.hp = 1; e.dirty = true; return e.nick + ' is on 1 HP'; } },
  { id: 'kill', icon: '', label: 'Kill', cat: 'Player', scope: 'p', danger: true, fn: (k) => { const e = k.ent(); e.god = false; die(k.x.room, e, 'void', null); return 'Killed ' + e.nick; } },
  { id: 'pgod', icon: '', label: 'Toggle god mode', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.god = !e.god; if (e.god) e.hp = BW.MAX_HP; e.dirty = true; if (k.x) send(k.x, { t: 'god', on: e.god }); return e.nick + (e.god ? ' is a god now' : ' is mortal again'); } },
  { id: 'pspeed', icon: '', label: 'Speed 60s', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.speedUntil = Date.now() + 60000; e.dirty = true; return e.nick + ' is fast'; } },
  { id: 'pslow', icon: '', label: 'Slow 30s', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.slowUntil = Date.now() + 30000; e.dirty = true; return e.nick + ' is slow'; } },
  { id: 'pgiant', icon: '', label: 'Make giant', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.giant = !e.giant; e.tiny = false; return e.nick + (e.giant ? ' is GIANT' : ' is normal size'); } },
  { id: 'ptiny', icon: '', label: 'Make tiny', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.tiny = !e.tiny; e.giant = false; return e.nick + (e.tiny ? ' is tiny' : ' is normal size'); } },
  { id: 'shake', icon: '', label: 'Shake their screen', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'shake'); return 'Shook ' + k.x.nick + '’s screen'; } },
  { id: 'flip', icon: '', label: 'Upside-down screen 15s', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'flip', { ms: 15000 }); return k.x.nick + ' is upside down'; } },
  { id: 'pvanish', icon: '', label: 'Toggle invisible', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.vanish = !e.vanish; return e.nick + (e.vanish ? ' is invisible' : ' is visible'); } },
  { id: 'ponehit', icon: '', label: 'Toggle one-hit kills', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.onehit = !e.onehit; return e.nick + (e.onehit ? ' one-shots now' : ' hits normally'); } },
  { id: 'pregen', icon: '', label: 'Regen 30s', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.regenUntil = Date.now() + 30000; e.dirty = true; return e.nick + ' is regenerating'; } },
  { id: 'pabsorb', icon: '', label: '+10 golden hearts', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.absorb = (e.absorb || 0) + 10; e.dirty = true; return e.nick + ' got golden hearts'; } },
  { id: 'prespawn', icon: '', label: 'Respawn now', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); if (!e.dead || e.elim) throw new Error(e.nick + ' isn’t waiting to respawn.'); respawn(k.x.room, e); return e.nick + ' respawned'; } },
  { id: 'plaunch', icon: '', label: 'Launch', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(), an = rnd() * Math.PI * 2; knock(k.x.room, e, Math.cos(an), Math.sin(an), 1100); return 'Launched ' + e.nick; } },
  { id: 'prandtp', icon: '', label: 'Teleport somewhere random', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(), rr = k.x.room; for (let t = 0; t < 80; t++) { const i = (rnd() * N) | 0; if (rr.map.g[i] && rr.map.g[i] !== G.ROCK && !BW.solidAt(rr.map, i % W, (i / W) | 0)) { e.x = (i % W) * T + T / 2; e.y = ((i / W) | 0) * T + T / 2; e.kbBudget += 2000; send(k.x, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) }); return e.nick + ' was teleported'; } } throw new Error('No free spot found.'); } },
  { id: 'pcenter', icon: '', label: 'Teleport to map middle', cat: 'Player', scope: 'p', fn: (k) => { const e = k.ent(); e.x = W * T / 2; e.y = H * T / 2; e.kbBudget += 2000; send(k.x, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) }); return e.nick + ' is in the middle'; } },
  { id: 'gsword', icon: '', label: 'Diamond sword', cat: 'Gear', scope: 'p', fn: (k) => { const e = k.ent(); e.sword = 4; e.dirty = true; k.x.room.ev(['gear', e.id, e.sword, e.armor, e.pick]); return e.nick + ' got a diamond sword'; } },
  { id: 'garmor', icon: '', label: 'Diamond armor', cat: 'Gear', scope: 'p', fn: (k) => { const e = k.ent(); e.armor = 4; e.dirty = true; k.x.room.ev(['gear', e.id, e.sword, e.armor, e.pick]); return e.nick + ' got diamond armor'; } },
  { id: 'gstrip', icon: '', label: 'Strip gear (wood + leather)', cat: 'Gear', scope: 'p', danger: true, fn: (k) => { const e = k.ent(); e.sword = 1; e.armor = 1; e.dirty = true; k.x.room.ev(['gear', e.id, e.sword, e.armor, e.pick]); return e.nick + ' lost their gear'; } },
  { id: 'gbow', icon: '', label: 'Bow + 64 arrows', cat: 'Gear', scope: 'p', fn: (k) => { const e = k.ent(); e.inv.bow = 1; e.inv.arrows = (e.inv.arrows || 0) + 64; e.dirty = true; return e.nick + ' got a bow'; } },
  { id: 'gtnt', icon: '', label: '+5 TNT', cat: 'Gear', scope: 'p', fn: (k) => { const e = k.ent(); e.inv.tnt = (e.inv.tnt || 0) + 5; e.dirty = true; return '+5 TNT for ' + e.nick; } },
  { id: 'gfire', icon: '', label: '+10 fireballs', cat: 'Gear', scope: 'p', fn: (k) => { const e = k.ent(); e.inv.fireball = (e.inv.fireball || 0) + 10; e.dirty = true; return '+10 fireballs for ' + e.nick; } },
  { id: 'gpearl', icon: '', label: '+5 ender pearls', cat: 'Gear', scope: 'p', fn: (k) => { const e = k.ent(); e.inv.pearl = (e.inv.pearl || 0) + 5; e.dirty = true; return '+5 pearls for ' + e.nick; } },
  { id: 'gapple', icon: '', label: '+5 golden apples', cat: 'Gear', scope: 'p', fn: (k) => { const e = k.ent(); e.inv.gapple = (e.inv.gapple || 0) + 5; e.dirty = true; return '+5 golden apples for ' + e.nick; } },
  { id: 'gwool', icon: '', label: '+128 wool', cat: 'Gear', scope: 'p', fn: (k) => { const e = k.ent(); e.inv.wool = (e.inv.wool || 0) + 128; e.dirty = true; return '+128 wool for ' + e.nick; } },
  { id: 'gclear', icon: '', label: 'Empty inventory', cat: 'Gear', scope: 'p', danger: true, fn: (k) => { const e = k.ent(); for (const q in e.inv) e.inv[q] = 0; e.dirty = true; return e.nick + '’s inventory is empty'; } },
  { id: 'c1k', icon: '', label: '+1,000 Scrolls', cat: 'Account', scope: 'p', fn: (k) => { grantCoins(k.x.cid, 1000); send(k.x, { t: 'ann', text: '+1,000 Scrolls!', from: k.c.nick }); return '+1,000 Scrolls for ' + k.x.nick; } },
  { id: 'c10k', icon: '', label: '+10,000 Scrolls', cat: 'Account', scope: 'p', fn: (k) => { grantCoins(k.x.cid, 10000); send(k.x, { t: 'ann', text: '+10,000 Scrolls!', from: k.c.nick }); return '+10,000 Scrolls for ' + k.x.nick; } },
  { id: 'eloup', icon: '', label: 'Duel rank +100', cat: 'Account', scope: 'p', fn: (k) => { const q = GMS.store.elo[k.x.cid] || (GMS.store.elo[k.x.cid] = { r: 1000, w: 0, l: 0, nick: k.x.nick }); q.r += 100; GMS.save(); return k.x.nick + ' is now ' + q.r; } },
  { id: 'elodown', icon: '', label: 'Duel rank -100', cat: 'Account', scope: 'p', fn: (k) => { const q = GMS.store.elo[k.x.cid] || (GMS.store.elo[k.x.cid] = { r: 1000, w: 0, l: 0, nick: k.x.nick }); q.r = Math.max(0, q.r - 100); GMS.save(); return k.x.nick + ' is now ' + q.r; } },
  { id: 'phub', icon: '', label: 'Send to hub', cat: 'Account', scope: 'p', fn: (k) => { if (k.x.watch) stopWatch(k.x); else if (k.x.room) leaveRoom(k.x); else goHub(k.x); return k.x.nick + ' sent to the hub'; } },
  { id: 'whisper', icon: '', label: 'Private message (uses text box)', cat: 'Account', scope: 'p', fn: (k) => { const t = String(k.m.text || '').slice(0, 140).trim(); if (!t) throw new Error('Type a message in the text box.'); send(k.x, { t: 'ann', text: '' + t, from: k.c.nick + ' (private)' }); return 'Whispered to ' + k.x.nick; } },
  { id: 'spin', icon: '', label: 'Spin their screen', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'spin'); return 'Spun ' + k.x.nick; } },
  { id: 'mirror', icon: '', label: 'Mirror screen 15s', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'mirror', { ms: 15000 }); return k.x.nick + ' sees backwards'; } },
  { id: 'invert', icon: '', label: 'Invert colors 15s', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'invert', { ms: 15000 }); return 'Colors inverted for ' + k.x.nick; } },
  { id: 'dark', icon: '', label: 'Lights out 10s', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'dark', { ms: 10000 }); return 'Lights out for ' + k.x.nick; } },
  { id: 'blurp', icon: '', label: 'Blurry vision 8s', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'blur', { ms: 8000 }); return k.x.nick + ' needs glasses'; } },
  { id: 'jumpscare', icon: '', label: 'Jumpscare', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'flash', { col: '#000' }); megaFx(k.x, 'big', { text: 'BOO!', col: '#ff3b5c', sfx: 'no' }); megaFx(k.x, 'shake'); return 'Spooked ' + k.x.nick; } },
  { id: 'fakewin', icon: '', label: 'Fake “YOU WIN” banner', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'big', { text: 'YOU WIN!', sub: '…just kidding', sfx: 'level' }); return 'Pranked ' + k.x.nick; } },
  { id: 'gray', icon: '', label: 'Black & white 15s', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'gray', { ms: 15000 }); return k.x.nick + ' lost all color'; } },
  { id: 'zoom', icon: '', label: 'Zoomed way in 10s', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'zoom', { ms: 10000 }); return k.x.nick + ' is zoomed in'; } },
  { id: 'clown', icon: '', label: 'Clown rain', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'rain', { em: 'HA', sfx: 'no' }); return 'Clowned ' + k.x.nick; } },
  { id: 'poop', icon: '', label: 'Poop rain', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'rain', { em: '#' }); return k.x.nick + ' got pooped on'; } },
  { id: 'fakeban', icon: '', label: 'Fake “you’re banned”', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'flash', { col: '#ff3b5c' }); megaFx(k.x, 'big', { text: 'YOU ARE BANNED', sub: 'jk', col: '#ff3b5c', sfx: 'no' }); return 'Fake-banned ' + k.x.nick; } },
  { id: 'fakerich', icon: '', label: 'Fake +1,000,000 Scrolls', cat: 'Trolls', scope: 'p', fn: (k) => { megaFx(k.x, 'rain', { em: '$' }); megaFx(k.x, 'big', { text: '+1,000,000 SCROLLS!', sub: '(not really)', sfx: 'level' }); return 'Got ' + k.x.nick + '’s hopes up'; } },
  { id: 'tntdrop', icon: '', label: 'Drop TNT on them', cat: 'Trolls', scope: 'p', fn: (k) => { const e = k.ent(), r = k.x.room; const tn = { id: nextProj++, x: e.x, y: e.y, at: Date.now() + 1500, owner: 0, team: -9 }; r.tnts.push(tn); r.ev(['tnt', tn.id, Math.round(tn.x), Math.round(tn.y), 1500]); return 'TNT dropped on ' + e.nick; } },
  { id: 'freeze5', icon: '', label: 'Freeze 5 seconds', cat: 'Trolls', scope: 'p', fn: (k) => { const x = k.x; x.frozen = true; send(x, { t: 'frozen', on: true }); setTimeout(() => { x.frozen = false; send(x, { t: 'frozen', on: false }); }, 5000); return x.nick + ' frozen for 5s'; } },
  { id: 'swap', icon: '', label: 'Swap places with a random player', cat: 'Trolls', scope: 'p', fn: (k) => { const e = k.ent(), r = k.x.room; const o = [...r.ents.values()].filter((q) => q !== e && !q.dead && !q.elim); if (!o.length) throw new Error('Nobody to swap with.'); const q = o[(rnd() * o.length) | 0]; const ex = e.x, ey = e.y; e.x = q.x; e.y = q.y; q.x = ex; q.y = ey; for (const z of [e, q]) { z.kbBudget += 2000; if (z.conn) send(z.conn, { t: 'pos', x: Math.round(z.x), y: Math.round(z.y) }); } return e.nick + ' swapped with ' + q.nick; } },
  { id: 'turtle', icon: '', label: 'Turtle mode (tiny + slow)', cat: 'Trolls', scope: 'p', fn: (k) => { const e = k.ent(); e.tiny = true; e.giant = false; e.slowUntil = Date.now() + 30000; e.dirty = true; megaFx(k.x, 'big', { text: 'TURTLE MODE', col: '#2bd576' }); return e.nick + ' is a turtle'; } },
  { id: 'rconfetti', icon: '', label: 'Confetti for the match', cat: 'Match', scope: 'r', fn: (k) => { for (const x of humans(k.room())) megaFx(x, 'confetti', { sfx: 'level' }); return 'Confetti!'; } },
  { id: 'rmoney', icon: '', label: 'Money rain for the match', cat: 'Match', scope: 'r', fn: (k) => { for (const x of humans(k.room())) megaFx(x, 'rain', { em: '$' }); return 'Making it rain'; } },
  { id: 'rkit', icon: '', label: 'Max gear for everyone', cat: 'Match', scope: 'r', fn: (k) => { const r = k.room(); for (const e of k.live()) { e.sword = 4; e.armor = 4; e.pick = 4; e.dirty = true; r.ev(['gear', e.id, 4, 4, 4]); } return 'Everyone is fully geared'; } },
  { id: 'rtnt', icon: '', label: '5 TNT for everyone', cat: 'Match', scope: 'r', fn: (k) => { for (const e of k.live()) { e.inv.tnt = (e.inv.tnt || 0) + 5; e.dirty = true; } return 'TNT for everyone'; } },
  { id: 'rshuffle', icon: '', label: 'Shuffle everyone’s spots', cat: 'Match', scope: 'r', fn: (k) => { const L = k.live(), pos = L.map((e) => [e.x, e.y]).sort(() => rnd() - 0.5); L.forEach((e, i) => { e.x = pos[i][0]; e.y = pos[i][1]; e.kbBudget += 2000; if (e.conn) send(e.conn, { t: 'pos', x: Math.round(e.x), y: Math.round(e.y) }); }); return 'Shuffled ' + L.length + ' players'; } },
  { id: 'rgens', icon: '', label: 'Overflow every generator', cat: 'Match', scope: 'r', fn: (k) => { const r = k.room(); if (!r.gens) throw new Error('This game has no generators.'); for (const g of r.gens) g.n = (g.n || 0) + 16; return 'Generators overflowing'; } },
  { id: 'rups', icon: '', label: 'Max all team upgrades', cat: 'Match', scope: 'r', fn: (k) => { const r = k.room(); if (r.game !== 'bw') throw new Error('Bedwars only.'); for (const tm of r.teams) Object.assign(tm.up, { sharp: 1, prot: 4, forge: 4, haste: 2, heal: 1 }); r.teamsDirty = true; return 'Every team is maxed'; } },
  { id: 'gparty', icon: '', label: 'Confetti for EVERYONE online', cat: 'Everyone', scope: 'g', fn: () => { for (const x of conns) megaFx(x, 'confetti', { sfx: 'level' }); return 'Confetti for ' + conns.size + ' players'; } },
  { id: 'rbots3', icon: '', label: 'Add 3 bots', cat: 'Match', scope: 'r', fn: (k) => { const r = k.room(); let n = 0; for (let i = 0; i < 3; i++) { adminMsg(k.c, { a: 'fun', op: 'addbot', room: r.id }); n++; } return 'Added bots'; } },
];
function megaRun(c, m) {
  const op = MEGA.find((o) => o.id === String(m.op));
  if (!op) return { ok: false, msg: 'Unknown power.' };
  const x = [...conns].find((y) => y.pid === Number(m.pid));
  const r = rooms.get(Number(m.room));
  const k = {
    c, m, x, r,
    ent: () => { const e = megaEnt(x); if (!e) throw new Error((x ? x.nick : 'They') + ' isn’t in a match.'); return e; },
    room: () => { if (!r || r.state !== 'play') throw new Error('Pick a running match.'); return r; },
    live: () => [...k.room().ents.values()].filter((e) => !e.dead && !e.elim),
  };
  if (op.scope === 'p' && !x) return { ok: false, msg: 'Pick a player first.' };
  if (op.scope === 'r' && (!r || r.state !== 'play')) return { ok: false, msg: 'Pick a running match first.' };
  try { const msg = op.fn(k); GMS.log('' + c.nick + ': ' + op.label + (x && op.scope === 'p' ? ' → ' + x.nick : r && op.scope === 'r' ? ' → #' + r.id : '')); return { ok: true, msg: msg || op.label + ' done.' }; }
  catch (err) { return { ok: false, msg: err.message || 'Didn’t work.' }; }
}
function adminMsg(c, m, now) {
  const a = String(m.a || '');
  const ok = (msg) => send(c, { t: 'admres', ok: true, msg });
  const no = (msg) => send(c, { t: 'admres', ok: false, msg });
  const room = () => rooms.get(Number(m.room));
  const ent = (r) => r && r.ents && r.ents.get(Number(m.id));
  if (a === 'info') return send(c, adminInfo(c));
  if (a === 'x') { const res = megaRun(c, m); return send(c, { t: 'admres', ok: res.ok, msg: res.msg }); }
  if (a === 'class') { const d = classInfo(); if (c.owner && globalThis.SH_TEACHER_KEY) d.tkey = globalThis.SH_TEACHER_KEY(); return send(c, { t: 'cls', d }); }
  if (a === 'newteacher' && c.owner) { if (globalThis.SH_NEW_TEACHER_KEY) globalThis.SH_NEW_TEACHER_KEY(); return ok('New teacher link made — the old one stopped working.'); }
  if (a === 'skick' || a === 'sban' || a === 'srename' || a === 'swatch' || a === 'sunban') {
    if (a === 'sunban') { const n = String(m.name || '').toLowerCase(); GMS.store.nameBans = (GMS.store.nameBans || []).filter((x) => x !== n); for (const [cid, b] of Object.entries(GMS.store.bans)) if ((b.nick || '').toLowerCase() === n) GMS.unban(cid); GMS.save(); return ok('Unbanned ' + (m.name || '')); }
    if (a === 'swatch') { const r = rooms.get(Number(m.room)); if (!r || r.state !== 'play') return no('That match isn’t running.'); startWatch(c, r); return ok('Watching match #' + r.id); }
    const x = [...conns].find((y) => y.pid === Number(m.pid)); if (!x) return no('Student not found.');
    if (x.owner || x.teacher) return no('You can’t do that to them.');
    if (a === 'skick') { send(x, { t: 'err', code: 'kicked', msg: 'Your teacher removed you from the game.' }); setTimeout(() => { try { x.ws.close(4001); } catch (e) {} }, 150); GMS.log('' + c.nick + ' kicked ' + x.nick); return ok('Kicked ' + x.nick); }
    if (a === 'sban') {
      const n = x.nick.toLowerCase(); GMS.store.nameBans = [...new Set([...(GMS.store.nameBans || []), n])];
      GMS.ban(x.cid, x.nick, 0, c.nick); GMS.save();
      send(x, { t: 'err', code: 'kicked', msg: 'That name is banned by your teacher.' }); setTimeout(() => { try { x.ws.close(4001); } catch (e) {} }, 150);
      GMS.log('' + c.nick + ' banned the name ' + x.nick); return ok('Banned “' + x.nick + '”');
    }
    if (a === 'srename') {
      let nn = String(m.nick || '').replace(/[^\w .-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
      if (nn.length < 2) return no('Type a new name (2+ letters).');
      const old = x.nick; x.nick = nn; if (x.ent) x.ent.nick = nn;
      (GMS.store.renames || (GMS.store.renames = {}))[x.cid] = nn; GMS.save();
      if (CLASS.kids.has(x.cid)) CLASS.kids.get(x.cid).nick = nn;
      send(x, { t: 'toast', msg: 'Your teacher changed your name to ' + nn });
      if (x.space && !x.room) goHub(x);
      GMS.log('' + c.nick + ' renamed ' + old + ' → ' + nn); return ok('Renamed ' + old + ' → ' + nn);
    }
  }
  if (a === 'classreset') { classReset(); return send(c, { t: 'admres', ok: true, msg: 'Class stats reset' }); }
  if (a === 'cq') { sendClassQuestion(c, m.i == null || m.i === '' ? -1 : m.i | 0); return send(c, { t: 'admres', ok: true, msg: 'Question sent to everyone' }); }
  if (a === 'cqclose') { if (CLASS.cq) CLASS.cq.until = Date.now(); for (const x of conns) send(x, { t: 'cqend' }); return send(c, { t: 'admres', ok: true, msg: 'Class question closed' }); }
  if (a === 'vote') { if (m.op === 'stop') { endVote(false); return send(c, { t: 'admres', ok: true, msg: 'Vote ended early' }); } if (m.op === 'cancel') { endVote(true); return send(c, { t: 'admres', ok: true, msg: 'Vote cancelled' }); } startVote(c, Math.max(10, Math.min(60, m.sec | 0 || 20))); return send(c, { t: 'admres', ok: true, msg: 'Game vote started' }); }
  if (a === 'schooltimer') { const mins = Math.max(0, Math.min(240, Number(m.mins) || 0)); if (globalThis.SH_SET_SCHOOL) globalThis.SH_SET_SCHOOL(mins > 0 ? true : undefined, null, mins > 0 ? Date.now() + mins * 60000 : 0); if (mins > 0) classReset(); return send(c, { t: 'admres', ok: true, msg: mins > 0 ? 'School mode ON for ' + mins + ' min' : 'Timer cleared' }); }
  if (a === 'season') { const sv = typeof m.v === 'string' && ['', 'xmas', 'halloween', 'thanksgiving', 'newyear', 'valentines', 'stpatricks', 'easter', 'july4', 'summer'].includes(m.v) ? m.v : (m.v ? 'xmas' : ''); if (globalThis.SH_SET_SEASON) globalThis.SH_SET_SEASON(sv); GMS.log('' + c.nick + ' set holiday decorations: ' + (sv || 'off')); return send(c, { t: 'admres', ok: true, msg: sv ? 'Holiday: ' + sv : 'Holiday decorations off' }); }
  if (a === 'squiz') { if (globalThis.SH_SET_SQUIZ) globalThis.SH_SET_SQUIZ(!!m.v); GMS.log('' + c.nick + ' turned School Mode questions ' + (m.v ? 'ON' : 'OFF')); return send(c, { t: 'admres', ok: true, msg: m.v ? 'Questions ON' : 'Questions OFF — School Mode stays locked' }); }
  if (a === 'gamble') { if (globalThis.SH_SET_GAMBLE) globalThis.SH_SET_GAMBLE(!!m.v); GMS.log('' + c.nick + ' ' + (m.v ? 'unlocked' : 'locked') + ' the casino for School Mode'); return send(c, { t: 'admres', ok: true, msg: m.v ? 'Casino unlocked for School Mode' : 'Casino locked again' }); }
  if (a === 'school') { if (globalThis.SH_SET_SCHOOL) globalThis.SH_SET_SCHOOL(m.on === undefined ? undefined : !!m.on, m.set || m.v ? String(m.set || m.v) : null); GMS.log('' + c.nick + ' set school mode ' + (schoolCfg() ? 'ON (' + schoolCfg().set + ')' : 'OFF')); return send(c, { t: 'admres', ok: true, msg: 'School mode ' + (schoolCfg() ? 'ON' : 'OFF') }); }
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
  const who = () => [...conns].find((y) => y.pid === Number(m.pid));
  if (a === 'coins') {
    const x = who(); if (!x) return no('Player not found.');
    const amt = clamp(Math.round(Number(m.amount) || 0), -1000000, 1000000); if (!amt) return no('Pick an amount.');
    const bal = grantCoins(x.cid, amt); send(x, { t: 'ann', text: (amt > 0 ? 'You got ' + amt.toLocaleString() + ' Scrolls!' : amt.toLocaleString() + ' Scrolls taken away.') + ' Balance: ' + (bal || 0).toLocaleString(), from: c.nick });
    GMS.log('' + c.nick + ' gave ' + amt + ' Scrolls to ' + x.nick); return ok((amt > 0 ? 'Gave ' : 'Took ') + Math.abs(amt).toLocaleString() + ' Scrolls ' + (amt > 0 ? 'to ' : 'from ') + x.nick + '.');
  }
  if (a === 'ban') {
    const x = who(); if (!x) return no('Player not found.'); if (x.owner) return no('You can’t ban an owner.');
    const mins = clamp(Math.round(Number(m.mins) || 0), 0, 60 * 24 * 365);
    GMS.ban(x.cid, x.nick, mins, c.nick); GMS.log('' + c.nick + ' banned ' + x.nick + (mins ? ' for ' + mins + ' min' : ' forever'));
    send(x, { t: 'err', code: 'kicked', msg: 'You were banned from Games' + (mins ? ' for ' + (mins >= 1440 ? Math.round(mins / 1440) + ' day(s)' : mins >= 60 ? Math.round(mins / 60) + ' hour(s)' : mins + ' minutes') : '') + '.' });
    setTimeout(() => { try { x.ws.close(4001); } catch (e) {} }, 150);
    return ok('Banned ' + x.nick + '.');
  }
  if (a === 'unban') { GMS.unban(String(m.cid)); GMS.log('' + c.nick + ' unbanned someone'); return ok('Unbanned.'); }
  if (a === 'freeze') { const x = who(); if (!x) return no('Player not found.'); if (x.owner && x !== c) return no('You can’t freeze an owner.'); x.frozen = !x.frozen; send(x, { t: 'frozen', on: x.frozen }); return ok(x.frozen ? x.nick + ' is frozen' : x.nick + ' can move again.'); }
  if (a === 'slap') {
    const x = who(); if (!x) return no('Player not found.');
    const r2 = x.room, e2 = x.ent;
    if (r2 && r2.state === 'play' && e2 && !e2.dead) { const an = Math.random() * Math.PI * 2; knock(r2, e2, Math.cos(an), Math.sin(an), 1100); r2.ev(['hit', e2.id, 0, 1, 0, 'punch']); }
    send(x, { t: 'ann', text: 'SLAPPED!', from: c.nick }); return ok('Slapped ' + x.nick + '');
  }
  if (a === 'tpto' || a === 'bringp') {
    const x = who(); if (!x || x === c) return no('Player not found.');
    const from = a === 'tpto' ? c : x, to = a === 'tpto' ? x : c;
    if (from.room && to.room === from.room && from.room.state === 'play' && from.ent && to.ent) { from.ent.x = to.ent.x + 30; from.ent.y = to.ent.y; from.ent.kbBudget += 2000; send(from, { t: 'pos', x: Math.round(from.ent.x), y: Math.round(from.ent.y) }); return ok('Teleported.'); }
    if (from.space && from.space === to.space) { from.sx = to.sx + 30; from.sy = to.sy; send(from, { t: 'pos', x: Math.round(from.sx), y: Math.round(from.sy) }); return ok('Teleported.'); }
    return no('You need to be in the same place (hub, waiting island or match).');
  }
  if (a === 'joinmatch') {
    const r2 = rooms.get(Number(m.room)); if (!r2 || r2.state !== 'play') return no('That match isn’t running.');
    if (c.room && c.room.state === 'play') return no('Leave your match first.');
    if (r2.game === 'royale') return no('You can’t drop into a Scroll Royal match — wait for the next one.');
    if (r2.game === 'race') return no('You can’t join a race that already started — wait for the next one.');
    if (r2.game === 'spleef') return no('You can’t drop into a Spleef round — wait for the next one.');
    const tm = r2.game === 'hide' ? 1 : clamp(Number(m.team) || 0, 0, r2.game === 'ctf' ? 1 : 3);
    if (r2.game === 'bw' && !r2.teams[tm].bed) return no('That team has no bed — pick another.');
    leaveRoom(c, true); leaveSpace(c);
    const e = makeEnt(r2, { cid: c.cid, nick: c.nick, look: c.look, team: tm, conn: c });
    if (r2.game !== 'bw') MINI.lateJoin(r2, e);
    c.room = r2; c.ent = e; r2.teamsDirty = true;
    r2.ev(['spawn', e.id, Math.round(e.x), Math.round(e.y)]);
    for (const x of humans(r2)) if (x !== c) send(x, { t: 'join', ent: entPub(e) });
    send(c, fullState(r2, e)); GMS.log('' + c.nick + ' joined match #' + r2.id);
    return ok('You joined match #' + r2.id + '.');
  }
  if (a === 'double') { const mins = clamp(Math.round(Number(m.mins) || 0), 0, 24 * 60); GMS.store.settings.doubleUntil = mins ? Date.now() + mins * 60000 : 0; GMS.save(); GMS.log('' + c.nick + (mins ? ' started 2× Scrolls for ' + mins + ' min' : ' ended 2× Scrolls')); if (mins) for (const x of conns) send(x, { t: 'ann', text: 'DOUBLE SCROLLS for the next ' + mins + ' minutes! Every game pays 2×', from: c.nick }); return ok(mins ? '2× Scrolls on for ' + mins + ' minutes.' : '2× Scrolls ended.'); }
  if (a === 'setting') { if (!GMS.setSetting(String(m.k), m.v)) return no('Bad value.'); GMS.log('' + c.nick + ' set ' + m.k + ' = ' + m.v); if (m.k === 'motd' && m.v) for (const x of conns) send(x, { t: 'motd', text: GMS.store.settings.motd }); if (m.k === 'hubFx') for (const x of conns) send(x, { t: 'hubfx', on: GMS.store.settings.hubFx !== 0 }); return ok('Saved. New matches use it.'); }
  if (a === 'endall') { let n = 0; for (const r2 of rooms.values()) if (r2.state === 'play') { endMatch(r2, -1); n++; } GMS.log('' + c.nick + ' ended all matches'); return ok('Ended ' + n + ' match(es).'); }
  if (a === 'maprot' || a === 'mapdel') {
    if (!c.mapper) return no('Only the map maker can change maps.');
    if (a === 'mapdel') return GMS.deleteMap(String(m.id), c.nick) ? ok('Map deleted.') : no('Map not found.');
    return GMS.setRotation(String(m.game), String(m.id), !!m.on) ? ok('Rotation updated.') : no('Couldn’t change that (is the map finished?).');
  }
  if (a === 'kick') {
    const x = [...conns].find((y) => y.pid === Number(m.pid)); if (!x) return no('Player not found.');
    if (x.owner) return no('You can’t kick an owner.');
    send(x, { t: 'err', code: 'kicked', msg: String(m.reason || 'You were removed from Games by an owner.').slice(0, 120) }); GMS.log('' + c.nick + ' kicked ' + x.nick);
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
    if (op === 'vanish') { e.vanish = !e.vanish; return ok(e.vanish ? 'You’re invisible to players and bots.' : 'You’re visible again.'); }
    if (op === 'speed') { const on = !(Date.now() < e.speedUntil); e.speedUntil = on ? Date.now() + 15 * 60000 : 0; e.dirty = true; return ok(on ? 'Speed boost on (15 min).' : 'Speed boost off.'); }
    if (op === 'onehit') { e.onehit = !e.onehit; return ok(e.onehit ? 'One-hit kills ON.' : 'One-hit kills off.'); }
    if (op === 'blocks') { e.inv.wool += 999; e.inv.end += 99; e.dirty = true; return ok('+999 wool, +99 end stone.'); }
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
  if (a === 'mini') {
    const op = String(m.op);
    if (r.game === 'ctf' && op === 'score') { const tm = clamp(Number(m.team) || 0, 0, 1); r.score[tm]++; r.flagsDirty = true; r.ev(['cap', 0, 1 - tm, r.score[0], r.score[1]]); MINI.checkEnd(r, Date.now()); return ok('+1 capture for ' + BW.TEAMS[tm].name + '.'); }
    if (r.game === 'ctf' && op === 'retflags') { for (const f of r.flags) { f.state = 0; f.carrier = 0; f.x = r.map.bases[f.team].fx; f.y = r.map.bases[f.team].fy; } for (const e of r.ents.values()) e.carry = -1; r.flagsDirty = true; r.ev(['ret', 0, 0]); r.ev(['ret', 0, 1]); return ok('Both flags sent home.'); }
    if (r.game === 'spleef' && op === 'sd') { r.sdAt = Date.now(); roomSend(r, { t: 'mgt', sdAt: r.sdAt }); return ok('Sudden death started!'); }
    if (r.game === 'hide' && op === 'release') { if (r.phase !== 'hide') return no('The seekers are already out.'); r.seekAt = Date.now(); roomSend(r, { t: 'mgt', seekAt: r.seekAt, endAt: r.endAt }); return ok('Seekers released!'); }
    return no('Unknown control.');
  }
  if (a === 'fun') {
    const op = String(m.op);
    if (!r) return no('Pick a match.');
    if (op !== 'restart' && r.state !== 'play') return no('That match isn’t running.');
    const live = [...r.ents.values()].filter((e) => !e.dead && !e.elim);
    const freeTile = (e) => {
      for (let tries = 0; tries < 60; tries++) {
        const i = (rnd() * N) | 0;
        if (r.game === 'spleef') { if (r.map.L[e.z || 0][i] === 1) return i; continue; }
        if (r.map.g[i] && r.map.g[i] !== G.ROCK && !BW.solidAt(r.map, i % W, (i / W) | 0)) return i;
      }
      return -1;
    };
    const tpEnt = (e, x, y) => { e.x = x; e.y = y; e.vx = e.vy = 0; e.kbBudget += 2000; if (e.conn) send(e.conn, { t: 'pos', x: Math.round(x), y: Math.round(y) }); };
    if (op === 'bringall') {
      const cx = c.room === r && c.ent && !c.ent.dead ? c.ent.x : W * T / 2, cy = c.room === r && c.ent && !c.ent.dead ? c.ent.y : H * T / 2;
      let k = 0; for (const e of live) { if (e === c.ent) continue; const an = k / Math.max(1, live.length - 1) * Math.PI * 2; tpEnt(e, cx + Math.cos(an) * 70, cy + Math.sin(an) * 70); k++; }
      GMS.log('' + c.nick + ' pulled everyone together in #' + r.id);
      return ok('Everyone teleported to you.');
    }
    if (op === 'scatter') { for (const e of live) { const i = freeTile(e); if (i >= 0) tpEnt(e, (i % W) * T + T / 2, ((i / W) | 0) * T + T / 2); } return ok('Everyone scattered!'); }
    if (op === 'launchall') { for (const e of live) { const an = rnd() * Math.PI * 2; knock(r, e, Math.cos(an), Math.sin(an), 1100); } roomSend(r, { t: 'ann', text: 'WHEEE!', from: c.nick }); return ok('Launched them all'); }
    if (op === 'healall') { for (const e of live) { e.hp = BW.MAX_HP; e.dirty = true; } r.ev(['drink', live[0] ? live[0].id : 0]); return ok('Everyone healed'); }
    if (op === 'hurtall') { for (const e of live) { if (!e.god) { e.hp = 1; e.lastDmgAt = Date.now(); e.dirty = true; } } roomSend(r, { t: 'ann', text: 'Half a heart. Good luck.', from: c.nick }); return ok('Everyone is on 1 HP'); }
    if (op === 'speedall' || op === 'slowall') {
      for (const e of live) { if (op === 'speedall') e.speedUntil = Date.now() + 30000; else e.slowUntil = Date.now() + 30000; e.dirty = true; }
      roomSend(r, { t: 'ann', text: op === 'speedall' ? 'SPEED BOOST for 30s!' : 'Sloooow mode for 30s', from: c.nick });
      return ok(op === 'speedall' ? 'Everyone is fast for 30s' : 'Everyone is slow for 30s');
    }
    if (op === 'giant' || op === 'tiny' || op === 'normal') {
      for (const e of r.ents.values()) { e.giant = op === 'giant'; e.tiny = op === 'tiny'; }
      roomSend(r, { t: 'ann', text: op === 'giant' ? 'GIANT MODE' : op === 'tiny' ? 'tiny mode' : 'Back to normal size', from: c.nick });
      return ok(op === 'giant' ? 'Everyone is GIANT' : op === 'tiny' ? 'Everyone is tiny' : 'Sizes reset.');
    }
    if (op === 'disco') { roomSend(r, { t: 'disco', ms: 30000 }); GMS.log('' + c.nick + ' started a disco in #' + r.id); return ok('Disco for 30 seconds!'); }
    if (op === 'chaos') {
      if (r.game === 'build') return no('Not while they’re building!');
      if (r.game === 'spleef') { for (let k = 0; k < 50; k++) { const z = (rnd() * MG.SP_LAYERS) | 0, L = r.map.L[z]; for (let t2 = 0; t2 < 30; t2++) { const i = (rnd() * N) | 0; if (L[i] === 1) { MINI.snowLand(r, { z, x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2 - 16, owner: 0 }); break; } } } roomSend(r, { t: 'ann', text: 'FLOOR STORM!', from: c.nick }); return ok('Floor storm!'); }
      let n2 = 0;
      for (let k = 0; k < 14; k++) {
        const i = (rnd() * N) | 0; if (!r.map.g[i] || r.map.g[i] === G.ROCK) continue;
        const tn = { id: nextProj++, x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2, at: Date.now() + 1000 + rnd() * 2600, owner: 0, team: -9 };
        r.tnts.push(tn); r.ev(['tnt', tn.id, Math.round(tn.x), Math.round(tn.y), tn.at - Date.now()]); n2++;
      }
      roomSend(r, { t: 'ann', text: 'TNT RAIN! RUN!', from: c.nick });
      GMS.log('' + c.nick + ' dropped TNT rain on #' + r.id);
      return ok('TNT rain incoming (' + n2 + ')');
    }
    if (op === 'addbot') {
      if (r.game === 'spleef' || r.game === 'duel' || r.game === 'build' || r.game === 'royale' || r.game === 'race') return no('Bots can’t join a running ' + MG.GAMES[r.game].name + ' match.');
      const used = new Set([...r.ents.values()].map((e) => e.nick));
      let name; do { name = BOT_NAMES[(rnd() * BOT_NAMES.length) | 0]; } while (used.has(name) && used.size < BOT_NAMES.length);
      let team = 0;
      if (r.game === 'bw') { let best = -1; for (let t2 = 0; t2 < 4; t2++) { if (!r.teams[t2].bed && ![...r.ents.values()].some((e) => e.team === t2 && !e.elim)) continue; const n3 = [...r.ents.values()].filter((e) => e.team === t2).length; if (best < 0 || n3 < [...r.ents.values()].filter((e) => e.team === best).length) best = t2; } team = Math.max(0, best); }
      else if (r.game === 'ctf') team = [...r.ents.values()].filter((e) => e.team === 0).length <= [...r.ents.values()].filter((e) => e.team === 1).length ? 0 : 1;
      else if (r.game === 'hide') team = 1;
      const e = makeEnt(r, { nick: name, look: botLook(), team, bot: true });
      if (r.game !== 'bw') MINI.lateJoin(r, e);
      r.teamsDirty = true; r.ev(['spawn', e.id, Math.round(e.x), Math.round(e.y)]);
      for (const x of humans(r)) send(x, { t: 'join', ent: entPub(e) });
      return ok('' + name + ' joined' + (r.game === 'hide' ? ' as a seeker' : '') + '.');
    }
    if (op === 'clearbots') {
      let n3 = 0;
      for (const e of [...r.ents.values()]) if (e.bot) { r.ents.delete(e.id); r.ev(['dc', e.id]); n3++; }
      r.teamsDirty = true; checkWin(r);
      return ok('Removed ' + n3 + ' bot(s).');
    }
    if (op === 'pause') {
      if (r.paused) {
        const d = Date.now() - r.pausedAt; r.paused = false;
        r.goAt += d; ['endAt', 'seekAt', 'sdAt', 'buildEnd', 'voteNext', 'nextTaunt', 'goldAt'].forEach((k) => { if (r[k]) r[k] += d; });
        if (r.pick) r.pick.forEach((q) => { q.at += d; });
        if (r.crum) for (const [k, v] of r.crum) r.crum.set(k, v + d);
        for (const e of r.ents.values()) { if (e.respawnAt) e.respawnAt += d; if (e.arrowAt) e.arrowAt += d; }
        for (const x of humans(r)) { if (x.pausedFroze) { x.frozen = false; x.pausedFroze = false; send(x, { t: 'frozen', on: false }); } }
        roomSend(r, { t: 'ann', text: 'Unpaused!', from: c.nick }); roomSend(r, { t: 'goat', goAt: r.goAt });
        return ok('Match unpaused');
      }
      r.paused = true; r.pausedAt = Date.now();
      for (const x of humans(r)) { if (!x.frozen) { x.frozen = true; x.pausedFroze = true; send(x, { t: 'frozen', on: true }); } }
      roomSend(r, { t: 'ann', text: 'Match paused by ' + c.nick, from: c.nick });
      return ok('Match paused');
    }
    if (op === 'restart') {
      if (r.state !== 'play' && r.state !== 'end') return no('Nothing to restart.');
      const players = humans(r);
      if (!players.length) return no('Nobody is in that match.');
      r.members = players.map((x, k) => ({ cid: x.cid, nick: x.nick, look: x.look, team: r.game === 'bw' || r.game === 'ctf' ? k % (r.game === 'ctf' ? 2 : 4) : k, conn: x, pid: x.pid }));
      r.paused = false; r.winner = null; r.projs = []; r.tnts = []; r.events = [];
      startMatch(r);
      GMS.log('' + c.nick + ' restarted match #' + r.id);
      return ok('Match restarted with a fresh map');
    }
    return no('Unknown fun action.');
  }
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
  stepPath, fight, foeNear, clearLine, aliveEnts, setTile, addProj: (r, pj) => { pj.id = nextProj++; r.projs.push(pj); return pj; }, die: (r, v, kind, att) => die(r, v, kind, att),
});
export const __bwTest = DEBUG ? { makeRoom, startMatch, rooms, tickRoom } : null;
