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
const TILE = 48, WORLD_W = 76 * TILE, WORLD_H = 124 * TILE;   // rows 0..43 are the casino everyone sees; rows 44..123 are the secret Owner Vault
const SPAWN = { x: 30 * TILE, y: 38 * TILE };
const SPEED = 230;            // px/s walking (client sprint is not allowed)
const MAX_PLAYERS = 150;
const IDLE_MS = Number(process.env.WORLD_IDLE_MS) || 120000;   // no real activity for this long = removed from the world (owners excepted)
const HEARTBEAT_MS = 15000;   // ping everyone; drop sockets that stop answering
const RESUME_MS = 10 * 60 * 1000;
const GAMES = new Set(['', 'slots', 'blackjack', 'roulette', 'dice', 'coinflip', 'duels', 'mines', 'plinko', 'wheel', 'crash', 'cases', 'battles', 'shop', 'wardrobe', 'atm', 'leaderboard', 'tournament', 'player', 'bar', 'piano', 'echo', 'aim', 'mathrush', 'trivia', 'colorclash', 'pattern', 'scramble', 'hiscores']);
// Preset quick-chat lines (index-only on the wire, so nothing needs moderating).
export const QUICKCHAT = ['Hi! 👋', 'GG!', "Let's go!", 'Nice win!', 'Join my table!', 'Duel me!', 'Follow me', 'One more spin…', 'So close 😩', 'Lucky!', 'brb', 'Bye!', 'Rigged 😤', "I'm rich! 🤑", 'Help?', 'Thanks!'];
const DRINKS = ['🥤', '🧃', '🍹', '☕', '🥛', '🧋'];
// The bar in The Lounge (must match dist/casino/world.js: add('bar', 240, 1250) with a 176px half width).
// The bartender makes one drink at a time; orders queue up for a few seconds at most.
const BAR = { x: 240, y: 1250, half: 176 }, DRINK_MS = 3600;
let barFree = 0;
// Owner Vault: the room east of The Vault (tiles x60..74, y2..12). Only owner / co-owner accounts may stand in it,
// and the server enforces that here, so a modified client cannot walk through the grate.
const VAULT = { y0: 45 * TILE, hatch: { x: 2515, y: 128 }, ladder: { x: 1632, y: 2330 }, inn: { x: 1632, y: 2430 }, out: { x: 2515, y: 200 } };
const kickBlock = new Map();   // cid -> until: a removed player cannot walk straight back in
export function worldKick(cid, ms) { if (cid) kickBlock.set(cid, Date.now() + (ms || 60000)); for (const p of [...players.values()]) if (p.cid === cid) { send(p.ws, { t: 'error', code: 'kicked', msg: 'You were removed from the casino by staff.' }); try { p.ws.close(4003); } catch (e) {} removePlayer(p); } }

const players = new Map(); // pid -> player
// Called when an account does something real over HTTP (spins, bets, shop) so a player busy at a machine is not counted as away.
export function worldTouch(cid) { if (!cid) return; const t = Date.now(); for (const p of players.values()) if (p.cid === cid) p.lastAct = t; }
const lastPos = new Map(); // cid -> {x, y, ts}  (resume where you stood after a reconnect)
let nextPid = 1;
let dirty = new Set();

function send(ws, o) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} }
// Someone inside the Owner Vault is invisible to everybody who is not an owner: nothing about them is sent to those sockets.
function hiddenMsg(o) { const id = o.t === 'join' ? (o.p && o.p.id) : o.id; if (id == null) return false; const p = players.get(id); return !!(p && p.hidden); }
function broadcast(o, except) { const s = JSON.stringify(o), hid = hiddenMsg(o); for (const p of players.values()) if (p.ws !== except && p.ws.readyState === 1) { if (hid && !p.own) continue; try { p.ws.send(s); } catch (e) {} } }
function bcastPublic(o) { const s = JSON.stringify(o); for (const p of players.values()) if (!p.own && p.ws.readyState === 1) { try { p.ws.send(s); } catch (e) {} } }
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
    if (me.hidden && !p.own) continue;
    if (Math.hypot(p.x - me.x, p.y - me.y) > VOICE_R) continue;
    if (!out) { out = Buffer.allocUnsafe(buf.length + 4); out[0] = 1; out.writeUInt32BE(me.id >>> 0, 1); buf.copy(out, 5, 1); }
    try { if (p.ws.bufferedAmount < 256 * 1024) p.ws.send(out, { binary: true }); } catch (e) {}
  }
}
function pub(p) { return { id: p.id, cid: p.cid, nick: p.nick, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, mv: p.mv, look: p.look, cos: p.cos, busy: p.busy, own: p.own ? 1 : 0, hm: p.hammer ? 1 : 0, sc: p.scale || 1, fz: p.frozen > Date.now() ? 1 : 0 }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

initTables({ broadcast, sendTo: (pl, o) => send(pl.ws, o), players });

// Every finished casino play: pop a number over the player, and announce big wins.
setPlayHook((prof, bet, payout) => {
  let pl = null;
  for (const p of players.values()) if (worldProfile(p.cid) === prof) { pl = p; break; }
  if (!pl) return;
  const net = payout - bet;
  const mult = bet > 0 ? payout / bet : 0;
  broadcast({ t: 'pop', id: pl.id, v: net, m: Math.round(mult * 10) / 10 });
  if (net >= 10000 || (mult >= 20 && net >= 1000)) broadcast({ t: 'feed', nick: pl.nick, game: pl.busy || '', amount: net, mult: Math.round(mult * 100) / 100 });
});
setJackpotHook((prof, amount) => { broadcast({ t: 'feed', nick: prof.nick || 'Someone', game: 'jackpot', amount, mult: 0 }); });

// 10 Hz movement snapshots — only players that moved.
setInterval(() => {
  if (!dirty.size) return;
  const ps = [], pubPs = [];
  for (const id of dirty) { const p = players.get(id); if (p) { const e = [p.id, Math.round(p.x), Math.round(p.y), p.dir, p.mv ? 1 : 0]; ps.push(e); if (!p.hidden) pubPs.push(e); } }
  dirty = new Set();
  if (ps.length) { const a = JSON.stringify({ t: 'snap', ps }), b = pubPs.length ? JSON.stringify({ t: 'snap', ps: pubPs }) : null; for (const p of players.values()) { const m = p.own ? a : b; if (m && p.ws.readyState === 1) { try { p.ws.send(m); } catch (e) {} } } }
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

// Away too long (tab hidden, walked off, left it open): remove the avatar so nobody stands there forever.
setInterval(() => {
  const now = Date.now();
  for (const p of [...players.values()]) {
    if (p.own || now - (p.lastAct || 0) < IDLE_MS) continue;
    send(p.ws, { t: 'error', code: 'idle', msg: 'You were away for a couple of minutes, so you were taken out of the casino. Walk back in whenever you like.' });
    try { p.ws.close(4003, 'idle'); } catch (e) {}
    removePlayer(p);
  }
}, 10000).unref();

function removePlayer(p) {
  if (players.get(p.id) !== p) return;
  players.delete(p.id); dirty.delete(p.id);
  lastPos.set(p.cid, { x: p.x, y: p.y, ts: Date.now() });
  broadcast({ t: 'leave', id: p.id });
  // Give a quick reconnect a moment before giving up their blackjack seat / duels.
  const cid = p.cid;
  setTimeout(() => { for (const q of players.values()) if (q.cid === cid) return; tablesLeave({ cid }); }, 20000);
}


// ---- Owner Vault operations. Everything here is checked against the account role the socket was opened with.
const VFX = new Set(['party', 'fireworks', 'storm', 'disco', 'snow']);
const SPOTS = { lobby: [1440, 1824], slots: [350, 500], stakes: [1440, 330], lounge: [360, 1500], vault: [2515, 400], arena: [2515, 1000], shop: [2520, 1700], arcade: [3240, 900], owner: [VAULT.inn.x, VAULT.inn.y] };
// An owner going down the hatch (or coming back up) vanishes from, or reappears for, everyone who is not an owner.
function setVault(me, inside, quiet) {   // quiet: the vent hop already told everyone what happened
  if (inside === !!me.hidden) return;
  if (inside) { if (!quiet) bcastPublic({ t: 'vfx', k: 'hatch', id: me.id }); bcastPublic({ t: 'leave', id: me.id }); me.hidden = true; }
  else { me.hidden = false; bcastPublic({ t: 'join', p: pub(me) }); if (!quiet) bcastPublic({ t: 'vfx', k: 'hatch', id: me.id }); }
}
function teleport(p, x, y) { p.x = clamp(x, 0, WORLD_W); p.y = clamp(y, 0, WORLD_H); p.tpUntil = Date.now() + 450; dirty.add(p.id); send(p.ws, { t: 'pos', x: p.x, y: p.y }); }
function vaultOp(me, m, now) {
  if (!me.own) { send(me.ws, { t: 'vdeny' }); return; }
  me.vTok = Math.min(12, me.vTok + (now - me.vAt) / 1000 * 4); me.vAt = now;
  if (me.vTok < 1) return; me.vTok--;
  const op = String(m.op || '');
  const tgt = (m.id != null) ? players.get(Number(m.id)) : null;
  // A co-owner may use the tools but never on the owner.
  const protectedT = (t) => t && t !== me && t.role === 'owner' && me.role !== 'owner';
  switch (op) {
    case 'hammer': { me.hammer = !!m.on; broadcast({ t: 'vhammer', id: me.id, on: me.hammer }); return; }
    case 'slam': { broadcast({ t: 'vfx', k: 'slam', id: me.id }); return; }
    case 'speed': { me.fast = !!m.on; send(me.ws, { t: 'vstate', fast: me.fast, scale: me.scale }); return; }
    case 'size': {
      const s = [0.5, 1, 1.7, 2.6].includes(Number(m.s)) ? Number(m.s) : 1;
      const t = tgt || me; if (protectedT(t)) return;
      t.scale = s; broadcast({ t: 'vsize', id: t.id, s }); if (t === me) send(me.ws, { t: 'vstate', fast: me.fast, scale: me.scale });
      return;
    }
    case 'enter': {   // down the hatch in The Vault
      if (me.hidden || (me.lockUntil || 0) > now || Math.hypot(me.x - VAULT.hatch.x, me.y - VAULT.hatch.y) > 160) return;
      me.lockUntil = now + 1250;
      broadcast({ t: 'vfx', k: 'vent', id: me.id, d: 'in' });   // everyone watching sees the owner hop into the vent
      setTimeout(() => {
        if (players.get(me.id) !== me || me.hidden || Math.hypot(me.x - VAULT.hatch.x, me.y - VAULT.hatch.y) > 220) return;
        setVault(me, true, true); teleport(me, VAULT.inn.x, VAULT.inn.y);
      }, 1100);
      return;
    }
    case 'leave': {   // back up the ladder
      if (!me.hidden || (me.lockUntil || 0) > now) return;
      me.lockUntil = now + 1100;
      teleport(me, VAULT.out.x, VAULT.out.y); setVault(me, false, true);
      broadcast({ t: 'vfx', k: 'vent', id: me.id, d: 'out' });   // ...and pop back out of it
      return;
    }
    case 'warp': {
      const sp = SPOTS[String(m.spot || '')]; if (!sp) return;
      const inside = sp[1] > VAULT.y0;
      if (inside) { setVault(me, true); } else if (me.hidden) setVault(me, false);
      teleport(me, sp[0], sp[1]);
      broadcast({ t: 'vfx', k: 'warp', id: me.id });
      return;
    }
    case 'goto': {
      if (!tgt || tgt === me) return;
      if (me.hidden) setVault(me, false);
      teleport(me, tgt.x + 40, tgt.y); broadcast({ t: 'vfx', k: 'warp', id: me.id });
      return;
    }
    case 'bring': {
      if (!tgt || tgt === me || protectedT(tgt)) return;
      // Never carry anyone down into the vault: they would only be pushed back out by the server.
      const base = me.hidden ? VAULT.out : me;
      teleport(tgt, base.x + (Math.random() * 80 - 40), base.y + 50);
      broadcast({ t: 'vfx', k: 'warp', id: tgt.id });
      return;
    }
    case 'freeze': {
      if (!tgt || tgt === me || protectedT(tgt)) return;
      tgt.frozen = m.on === false ? 0 : now + 60000;
      broadcast({ t: 'vfx', k: tgt.frozen ? 'freeze' : 'thaw', id: tgt.id });
      send(tgt.ws, { t: 'vstate', fast: tgt.fast, scale: tgt.scale, frozen: tgt.frozen ? 1 : 0 });
      return;
    }
    case 'smite': {   // lightning bolt, then out of the casino for a minute
      if (!tgt || tgt === me || protectedT(tgt)) return;
      broadcast({ t: 'vfx', k: 'smite', id: tgt.id, by: me.id, b: m.ban ? 1 : 0 });   // b: 1 = the hammer came down for a ban
      const cid = tgt.cid;
      setTimeout(() => { worldKick(cid, 60000); }, 2400);
      return;
    }
    case 'announce': {
      const text = String(m.text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 140); if (!text) return;
      broadcast({ t: 'vannounce', text, by: me.nick });
      return;
    }
    case 'fx': { const k = String(m.k || ''); if (VFX.has(k)) broadcast({ t: 'vfx', k, by: me.nick }); return; }
  }
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
    { const kb = kickBlock.get(cid); if (kb && kb > Date.now() && !(req._auth && req._auth.role)) { send(ws, { t: 'error', code: 'kicked', msg: 'You were removed from the casino. Try again in a minute.' }); try { ws.close(4003); } catch (e) {} return; } }
    if (players.size >= MAX_PLAYERS) { send(ws, { t: 'error', code: 'full', msg: 'The casino floor is full right now — try again in a minute.' }); try { ws.close(4002); } catch (e) {} return; }
    worldProfile(cid); // make sure a profile exists so look/cosmetics resolve
    if (!resume) { const lp = lastPos.get(cid); if (lp && Date.now() - lp.ts < RESUME_MS) resume = lp; }

    const me = {
      id: nextPid++, cid, nick: String(nick || 'Guest').slice(0, 24), ws, alive: true,
      x: resume ? clamp(resume.x, 0, WORLD_W) : SPAWN.x + (Math.random() * 160 - 80),
      y: resume ? clamp(resume.y, 0, WORLD_H) : SPAWN.y + (Math.random() * 60 - 30),
      dir: 0, mv: false, look: worldLook(cid), cos: cosOf(cid), busy: '',
      ip: ipOf(req), lastAct: Date.now(), cst: {}, role: (req._auth && req._auth.role) || null, own: !!(req._auth && (req._auth.role === 'owner' || req._auth.role === 'coowner')), hammer: false, scale: 1, fast: false, frozen: 0, lastDrink: 0, tpUntil: 0, hidden: false, vTok: 12, vAt: Date.now(), lastMove: Date.now(), moveTokens: 30, gTokens: 20, lastG: Date.now(), lastEmote: 0, lastBusy: 0,
    };
    me.hidden = me.own && me.y > VAULT.y0;
    players.set(me.id, me);
    lastPos.delete(cid);
    ws.on('pong', () => { me.alive = true; });
    send(ws, { t: 'welcome', now: Date.now(), you: Object.assign(pub(me), { role: me.role }), vault: me.own ? 1 : 0, players: [...players.values()].filter((p) => p !== me && p.cid !== cid && (!p.hidden || me.own)).map(pub), world: { w: WORLD_W, h: WORLD_H }, qc: QUICKCHAT, games: tablesSnapshot() });
    broadcast({ t: 'join', p: pub(me) }, ws);
    tablesJoin(me);

    ws.on('message', (buf, isBinary) => {
      me.alive = true;
      if (isBinary) { voiceFrame(me, buf); return; }
      let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
      if (!m || typeof m.t !== 'string') return;
      // Keep-alives and look refreshes do not prove anyone is there; everything else (moving, chatting, table moves, a real input) does.
      if (m.t !== 'ping' && m.t !== 'look') me.lastAct = Date.now();
      if (m.t === 'act') return;
      const now = Date.now();
      if (m.t === 'vc') { me.voice = !!m.on; send(ws, { t: 'vcstate', on: me.voice, range: VOICE_R }); return; }

      if (m.t === 'mv') {
        me.moveTokens = Math.min(30, me.moveTokens + (now - me.lastMove) / 33);
        const dt = Math.min(1, (now - me.lastMove) / 1000); me.lastMove = now;
        if (me.moveTokens < 1) return; me.moveTokens--;
        let x = Number(m.x), y = Number(m.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        x = clamp(x, 0, WORLD_W); y = clamp(y, 0, WORLD_H);
        // Frozen by staff, or trying to step into the Owner Vault without being an owner: stay where you were.
        if (now < me.tpUntil || now < (me.lockUntil || 0)) return;
        if ((me.frozen > now) || (!me.own && y > VAULT.y0)) { send(ws, { t: 'pos', x: Math.round(me.x), y: Math.round(me.y) }); return; }
        // No teleporting: limit distance to what walking could cover (+ slack for jitter).
        const maxD = SPEED * (me.fast ? 2.1 : 1) * dt * 1.6 + 30;
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
        // Stand at the bar. The bartender makes it (about 3.6 seconds), slides it to you, then you get the drink.
        if (now - me.lastDrink < 5000) return;
        if (Math.abs(me.x - BAR.x) > BAR.half + 90 || me.y < BAR.y - 6 || me.y > BAR.y + 150) return;
        const start = Math.max(now, barFree);
        if (start - now > 9000) { send(ws, { t: 'barbusy' }); return; }
        me.lastDrink = now; barFree = start + DRINK_MS - 500;
        const di = (Math.random() * DRINKS.length) | 0, wait = start - now;
        broadcast({ t: 'serve', id: me.id, nick: me.nick, d: di, x: Math.round(me.x), in: wait, ms: DRINK_MS });
        const who = me;
        setTimeout(() => { if (players.get(who.id) === who) broadcast({ t: 'emote', id: who.id, e: DRINKS[di], k: 'drink' }); }, wait + DRINK_MS);
        return;
      }
      if (m.t === 'v') { vaultOp(me, m, now); return; }
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
