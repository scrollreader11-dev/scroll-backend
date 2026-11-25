// ============================================================
// Scrolls Casino — shared 2D world (one floor everyone walks around in).
// Positions, character looks, emotes, quick-chat, "playing X" status, win
// pops, the big-win feed, and the shared multiplayer games (casinotables.js).
// server.js routes /world-ws here.
// ============================================================
import { WebSocketServer } from 'ws';
import { worldIdentity, worldProfile, worldLook, worldOwnsEmote, getCosmetics, setPlayHook, setJackpotHook } from './casino.js';
import { chatSay, ipOf } from './chatguard.js';
import { initTables, tablesSnapshot, tablesJoin, tablesLeave, handleTableMsg } from './casinotables.js';

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

// Must match the client map (dist/casino/world.js): 60 x 44 tiles of 48px.
const TILE = 48, WORLD_W = 60 * TILE, WORLD_H = 44 * TILE;
const SPAWN = { x: 30 * TILE, y: 38 * TILE };
const SPEED = 230;            // px/s walking (client sprint is not allowed)
const MAX_PLAYERS = 150;
const HEARTBEAT_MS = 15000;   // ping everyone; drop sockets that stop answering
const RESUME_MS = 10 * 60 * 1000;
const GAMES = new Set(['', 'slots', 'blackjack', 'roulette', 'dice', 'coinflip', 'duels', 'mines', 'plinko', 'wheel', 'crash', 'cases', 'battles', 'shop', 'wardrobe', 'atm', 'leaderboard', 'tournament', 'player', 'bar', 'piano']);
// Preset quick-chat lines (index-only on the wire, so nothing needs moderating).
export const QUICKCHAT = ['Hi! 👋', 'GG!', "Let's go!", 'Nice win!', 'Join my table!', 'Duel me!', 'Follow me', 'One more spin…', 'So close 😩', 'Lucky!', 'brb', 'Bye!', 'Rigged 😤', "I'm rich! 🤑", 'Help?', 'Thanks!'];
const DRINKS = ['🥤', '🧃', '🍹', '☕', '🥛', '🧋'];

const players = new Map(); // pid -> player
const lastPos = new Map(); // cid -> {x, y, ts}  (resume where you stood after a reconnect)
let nextPid = 1;
let dirty = new Set();

function send(ws, o) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} }
function broadcast(o, except) { const s = JSON.stringify(o); for (const p of players.values()) if (p.ws !== except && p.ws.readyState === 1) { try { p.ws.send(s); } catch (e) {} } }
function cosOf(cid) { const c = getCosmetics(cid); return { tag: c.tag || '', color: c.color || '', titleFx: c.titleFx || '' }; }
// ---- proximity voice (same protocol as Bedwars): the server only forwards a speaker's
// mic frames to players standing near them, so it works on any network.
const VOICE_R = 440; // px (~9 tiles)
function voiceFrame(me, buf) {
  if (!me.voice || buf.length < 2 || buf.length > 1200 || buf[0] !== 1) return;
  const now = Date.now();
  me.vtok = Math.min(40, (me.vtok == null ? 40 : me.vtok) + (now - (me.vAt || now)) / 1000 * 32); me.vAt = now;
  if (me.vtok < 1) return; me.vtok--;
  let out = null;
  for (const p of players.values()) {
    if (p === me || !p.voice || p.ws.readyState !== 1) continue;
    if (Math.hypot(p.x - me.x, p.y - me.y) > VOICE_R) continue;
    if (!out) { out = Buffer.allocUnsafe(buf.length + 4); out[0] = 1; out.writeUInt32BE(me.id >>> 0, 1); buf.copy(out, 5, 1); }
    try { if (p.ws.bufferedAmount < 256 * 1024) p.ws.send(out, { binary: true }); } catch (e) {}
  }
}
function pub(p) { return { id: p.id, cid: p.cid, nick: p.nick, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, mv: p.mv, look: p.look, cos: p.cos, busy: p.busy }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

initTables({ broadcast, sendTo: (pl, o) => send(pl.ws, o), players });

// Every finished casino play: pop a number over the player, and announce big wins.
setPlayHook((prof, bet, payout) => {
  let pl = null;
  for (const p of players.values()) if (worldProfile(p.cid) === prof) { pl = p; break; }
  if (!pl) return;
  const net = payout - bet;
  broadcast({ t: 'pop', id: pl.id, v: net });
  const mult = bet > 0 ? payout / bet : 0;
  if (net >= 10000 || (mult >= 20 && net >= 1000)) broadcast({ t: 'feed', nick: pl.nick, game: pl.busy || '', amount: net, mult: Math.round(mult * 100) / 100 });
});
setJackpotHook((prof, amount) => { broadcast({ t: 'feed', nick: prof.nick || 'Someone', game: 'jackpot', amount, mult: 0 }); });

// 10 Hz movement snapshots — only players that moved.
setInterval(() => {
  if (!dirty.size) return;
  const ps = [];
  for (const id of dirty) { const p = players.get(id); if (p) ps.push([p.id, Math.round(p.x), Math.round(p.y), p.dir, p.mv ? 1 : 0]); }
  dirty = new Set();
  if (ps.length) broadcast({ t: 'snap', ps });
}, 100);

// Heartbeat: protocol-level ping; a socket that misses one round is dead (sleeping
// laptop, dropped wifi) and gets removed so it doesn't linger as a ghost avatar.
setInterval(() => {
  for (const p of players.values()) {
    if (p.alive === false) { try { p.ws.terminate(); } catch (e) {} removePlayer(p); continue; }
    p.alive = false; try { p.ws.ping(); } catch (e) {}
  }
  const cut = Date.now() - RESUME_MS;
  for (const [cid, v] of lastPos) if (v.ts < cut) lastPos.delete(cid);
}, HEARTBEAT_MS);

function removePlayer(p) {
  if (players.get(p.id) !== p) return;
  players.delete(p.id); dirty.delete(p.id);
  lastPos.set(p.cid, { x: p.x, y: p.y, ts: Date.now() });
  broadcast({ t: 'leave', id: p.id });
  // Give a quick reconnect a moment before giving up their blackjack seat / duels.
  const cid = p.cid;
  setTimeout(() => { for (const q of players.values()) if (q.cid === cid) return; tablesLeave({ cid }); }, 20000);
}

export function worldOnline() { return players.size; }

export function handleWorldUpgrade(req, socket, head) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    const { cid, nick } = worldIdentity(req);
    if (!cid) { send(ws, { t: 'error', code: 'login', msg: 'Log in to ScrollHub to enter the casino.' }); try { ws.close(4000); } catch (e) {} return; }
    // One avatar per account: a reconnect or second tab replaces the old one *immediately*.
    let resume = null;
    for (const p of [...players.values()]) if (p.cid === cid) {
      resume = { x: p.x, y: p.y };
      send(p.ws, { t: 'error', code: 'replaced', msg: 'You opened the casino somewhere else.' });
      removePlayer(p);
      try { p.ws.terminate(); } catch (e) {}
    }
    if (players.size >= MAX_PLAYERS) { send(ws, { t: 'error', code: 'full', msg: 'The casino floor is full right now — try again in a minute.' }); try { ws.close(4002); } catch (e) {} return; }
    worldProfile(cid); // make sure a profile exists so look/cosmetics resolve
    if (!resume) { const lp = lastPos.get(cid); if (lp && Date.now() - lp.ts < RESUME_MS) resume = lp; }

    const me = {
      id: nextPid++, cid, nick: String(nick || 'Guest').slice(0, 24), ws, alive: true,
      x: resume ? clamp(resume.x, 0, WORLD_W) : SPAWN.x + (Math.random() * 160 - 80),
      y: resume ? clamp(resume.y, 0, WORLD_H) : SPAWN.y + (Math.random() * 60 - 30),
      dir: 0, mv: false, look: worldLook(cid), cos: cosOf(cid), busy: '',
      ip: ipOf(req), cst: {}, lastMove: Date.now(), moveTokens: 30, gTokens: 20, lastG: Date.now(), lastEmote: 0, lastBusy: 0,
    };
    players.set(me.id, me);
    lastPos.delete(cid);
    ws.on('pong', () => { me.alive = true; });
    send(ws, { t: 'welcome', now: Date.now(), you: pub(me), players: [...players.values()].filter((p) => p !== me && p.cid !== cid).map(pub), world: { w: WORLD_W, h: WORLD_H }, qc: QUICKCHAT, games: tablesSnapshot() });
    broadcast({ t: 'join', p: pub(me) }, ws);
    tablesJoin(me);

    ws.on('message', (buf, isBinary) => {
      me.alive = true;
      if (isBinary) { voiceFrame(me, buf); return; }
      let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
      if (!m || typeof m.t !== 'string') return;
      const now = Date.now();
      if (m.t === 'vc') { me.voice = !!m.on; send(ws, { t: 'vcstate', on: me.voice, range: VOICE_R }); return; }

      if (m.t === 'mv') {
        me.moveTokens = Math.min(30, me.moveTokens + (now - me.lastMove) / 33);
        const dt = Math.min(1, (now - me.lastMove) / 1000); me.lastMove = now;
        if (me.moveTokens < 1) return; me.moveTokens--;
        let x = Number(m.x), y = Number(m.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        x = clamp(x, 0, WORLD_W); y = clamp(y, 0, WORLD_H);
        // No teleporting: limit distance to what walking could cover (+ slack for jitter).
        const maxD = SPEED * dt * 1.6 + 30;
        const dx = x - me.x, dy = y - me.y, d = Math.hypot(dx, dy);
        let corrected = false;
        if (d > maxD) { x = me.x + dx / d * maxD; y = me.y + dy / d * maxD; corrected = true; }
        me.x = x; me.y = y;
        me.dir = [0, 1, 2, 3].includes(m.d) ? m.d : me.dir;
        me.mv = !!m.m;
        dirty.add(me.id);
        if (corrected) send(ws, { t: 'pos', x: Math.round(me.x), y: Math.round(me.y) });
        return;
      }
      if (m.t === 'ping') { send(ws, { t: 'pong', now, n: players.size }); return; }
      if (m.t === 'g') {
        me.gTokens = Math.min(20, me.gTokens + (now - me.lastG) / 80); me.lastG = now;
        if (me.gTokens < 1) return; me.gTokens--;
        handleTableMsg(me, m);
        return;
      }
      if (m.t === 'emote') {
        if (now - me.lastEmote < 1100) return;
        const val = worldOwnsEmote(cid, m.id);
        if (!val) return;
        me.lastEmote = now;
        broadcast({ t: 'emote', id: me.id, e: val, k: String(m.id) });
        return;
      }
      if (m.t === 'qc') {
        if (now - me.lastEmote < 1100) return;
        const i = Math.floor(Number(m.i));
        if (!(i >= 0 && i < QUICKCHAT.length)) return;
        me.lastEmote = now;
        broadcast({ t: 'qc', id: me.id, i });
        return;
      }
      if (m.t === 'say') {   // typed chat: filtered, rate limited, and the sender alone hears why if it is refused
        const r = chatSay({ scope: 'casino', cid, nick: me.nick, ip: me.ip, st: me.cst }, m.text, now);
        if (r.err !== undefined && !r.ok) { if (r.err) send(ws, { t: 'sayerr', msg: r.err }); return; }
        broadcast({ t: 'say', id: me.id, nick: me.nick, text: r.text });
        return;
      }
      if (m.t === 'drink') {
        if (now - me.lastEmote < 3000) return; me.lastEmote = now;
        broadcast({ t: 'emote', id: me.id, e: DRINKS[(Math.random() * DRINKS.length) | 0], k: 'drink' });
        return;
      }
      if (m.t === 'piano') {
        if (now - me.lastEmote < 600) return; me.lastEmote = now;
        broadcast({ t: 'piano', id: me.id, n: Math.floor(Number(m.n)) % 24 });
        return;
      }
      if (m.t === 'busy') {
        if (now - me.lastBusy < 150) return; me.lastBusy = now;
        const g = String(m.g || '');
        if (!GAMES.has(g)) return;
        me.busy = g;
        broadcast({ t: 'busy', id: me.id, g });
        return;
      }
      if (m.t === 'look') { // re-read after equipping something
        me.look = worldLook(cid); me.cos = cosOf(cid);
        broadcast({ t: 'look', id: me.id, look: me.look, cos: me.cos });
        return;
      }
    });

    ws.on('close', () => removePlayer(me));
    ws.on('error', () => removePlayer(me));
  });
}
