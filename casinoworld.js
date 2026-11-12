// ============================================================
// Scrolls Casino — shared 2D world (one floor everyone walks around in).
// Positions, character looks, emotes, "playing X" status, win pops and a
// big-win feed. All money still moves through the /api/casino/* routes;
// this socket only carries presence. server.js routes /world-ws here.
// ============================================================
import { WebSocketServer } from 'ws';
import { worldIdentity, worldProfile, worldLook, worldOwnsEmote, getCosmetics, setPlayHook } from './casino.js';

const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

// Must match the client map (dist/casino/world.js): 44 x 32 tiles of 48px.
const TILE = 48, WORLD_W = 44 * TILE, WORLD_H = 32 * TILE;
const SPAWN = { x: 22 * TILE, y: 28 * TILE };
const SPEED = 230;            // px/s, same as client
const MAX_PLAYERS = 150;
const GAMES = new Set(['', 'slots', 'blackjack', 'roulette', 'dice', 'coinflip', 'mines', 'plinko', 'wheel', 'crash', 'cases', 'battles', 'shop', 'wardrobe', 'atm', 'leaderboard', 'tournament', 'player']);

const players = new Map(); // pid -> player
let nextPid = 1;
let dirty = new Set();

function send(ws, o) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} }
function broadcast(o, except) { const s = JSON.stringify(o); for (const p of players.values()) if (p.ws !== except && p.ws.readyState === 1) { try { p.ws.send(s); } catch (e) {} } }
function cosOf(cid) { const c = getCosmetics(cid); return { tag: c.tag || '', color: c.color || '', titleFx: c.titleFx || '' }; }
function pub(p) { return { id: p.id, cid: p.cid, nick: p.nick, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, mv: p.mv, look: p.look, cos: p.cos, busy: p.busy }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Every finished casino play: pop a number over the player, and announce big wins.
setPlayHook((prof, bet, payout) => {
  let pl = null;
  for (const p of players.values()) if (worldProfile(p.cid) === prof) { pl = p; break; }
  if (!pl) return;
  const net = payout - bet;
  broadcast({ t: 'pop', id: pl.id, v: net });
  const mult = bet > 0 ? payout / bet : 0;
  if (net >= 10000 || (mult >= 20 && net >= 1000)) {
    broadcast({ t: 'feed', nick: pl.nick, game: pl.busy || '', amount: net, mult: Math.round(mult * 100) / 100 });
  }
});

// 10 Hz movement snapshots — only players that moved.
setInterval(() => {
  if (!dirty.size) return;
  const ps = [];
  for (const id of dirty) { const p = players.get(id); if (p) ps.push([p.id, Math.round(p.x), Math.round(p.y), p.dir, p.mv ? 1 : 0]); }
  dirty = new Set();
  if (ps.length) broadcast({ t: 'snap', ps });
}, 100);

export function worldOnline() { return players.size; }

export function handleWorldUpgrade(req, socket, head) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    const { cid, nick } = worldIdentity(req);
    if (!cid) { send(ws, { t: 'error', code: 'login', msg: 'Log in to ScrollHub to enter the casino.' }); try { ws.close(4000); } catch (e) {} return; }
    if (players.size >= MAX_PLAYERS) { send(ws, { t: 'error', code: 'full', msg: 'The casino floor is full right now — try again in a minute.' }); try { ws.close(4002); } catch (e) {} return; }
    worldProfile(cid); // make sure a profile exists so look/cosmetics resolve
    // One avatar per account: a second tab replaces the first.
    for (const p of players.values()) if (p.cid === cid) { send(p.ws, { t: 'error', code: 'replaced', msg: 'You opened the casino somewhere else.' }); try { p.ws.close(4001); } catch (e) {} }

    const me = {
      id: nextPid++, cid, nick: String(nick || 'Guest').slice(0, 24), ws,
      x: SPAWN.x + (Math.random() * 160 - 80), y: SPAWN.y + (Math.random() * 60 - 30), dir: 0, mv: false,
      look: worldLook(cid), cos: cosOf(cid), busy: '',
      lastMove: Date.now(), moveTokens: 30, lastEmote: 0, lastBusy: 0,
    };
    players.set(me.id, me);
    send(ws, { t: 'welcome', you: pub(me), players: [...players.values()].filter((p) => p !== me).map(pub), world: { w: WORLD_W, h: WORLD_H } });
    broadcast({ t: 'join', p: pub(me) }, ws);

    ws.on('message', (buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
      if (!m || typeof m.t !== 'string') return;
      const now = Date.now();

      if (m.t === 'mv') {
        // token bucket: ~30 msgs/s max
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
      if (m.t === 'emote') {
        if (now - me.lastEmote < 1200) return;
        const val = worldOwnsEmote(cid, m.id);
        if (!val) return;
        me.lastEmote = now;
        broadcast({ t: 'emote', id: me.id, e: val, k: String(m.id) });
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
      if (m.t === 'ping') { send(ws, { t: 'pong', n: players.size }); return; }
    });

    const bye = () => {
      if (players.get(me.id) !== me) return;
      players.delete(me.id); dirty.delete(me.id);
      broadcast({ t: 'leave', id: me.id });
    };
    ws.on('close', bye);
    ws.on('error', bye);
  });
}
