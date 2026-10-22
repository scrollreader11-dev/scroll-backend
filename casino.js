// ============================================================
// ScrollHub Casino — a coins game app (Blackjack, Slots, Coinflip,
// case opening) with a cosmetics store that shows up in chat.
// Self-contained: own persistence (tmp + Upstash KV) and HTTP API.
// Identity = sh_cid / sh_nick cookies (same as chat).
// ============================================================
import fs from 'node:fs';

const CASINO_FILE = '/tmp/scrollhub-casino.json';
const START_COINS = 1000;
const DAILY_COINS = 750;
const DAILY_MS = 20 * 3600 * 1000; // claimable every 20h

// ---- durable storage (mirrors server.js pattern) ----
const KV_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const kvEnabled = !!(KV_URL && KV_TOKEN);
async function kvGet(key) {
  if (!kvEnabled) return null;
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(['GET', key]) });
  if (!r.ok) throw new Error('kv get ' + r.status);
  const j = await r.json();
  return j && typeof j.result === 'string' ? j.result : null;
}
async function kvSet(key, value) {
  if (!kvEnabled) return;
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(['SET', key, value]) });
  if (!r.ok) throw new Error('kv set ' + r.status);
}

const casino = { users: {} }; // cid -> profile
function blankProfile() {
  return { coins: START_COINS, lastDaily: 0, inventory: [], tag: '', color: '', stats: { wagered: 0, won: 0, biggest: 0, plays: 0 } };
}
function load(raw) { try { const d = JSON.parse(raw); if (d && d.users) casino.users = d.users; } catch (e) {} }
export async function initCasino() {
  try { if (fs.existsSync(CASINO_FILE)) load(fs.readFileSync(CASINO_FILE, 'utf8')); } catch (e) {}
  try { const s = await kvGet('sh:casino'); if (s) load(s); } catch (e) { console.log('kv casino load failed:', e.message); }
}
let dirty = false;
function save() { dirty = true; try { fs.writeFileSync(CASINO_FILE, JSON.stringify({ users: casino.users })); } catch (e) {} }
async function flush() { if (!dirty) return; dirty = false; try { await kvSet('sh:casino', JSON.stringify({ users: casino.users })); } catch (e) { dirty = true; } }
setInterval(flush, 12000);

// ---- identity ----
function parseCookies(req) {
  const out = {}; const h = req.headers.cookie || '';
  h.split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
function who(req) {
  const c = parseCookies(req);
  const cid = String(c.sh_cid || '').slice(0, 64);
  let nick = 'Guest'; try { nick = c.sh_nick ? decodeURIComponent(c.sh_nick) : 'Guest'; } catch (e) {}
  return { cid, nick: String(nick).slice(0, 40) };
}
function profileOf(cid) {
  if (!cid) return null;
  if (!casino.users[cid]) { casino.users[cid] = blankProfile(); save(); }
  return casino.users[cid];
}
// Cosmetics the chat system reads to decorate a player's name.
export function getCosmetics(cid) {
  const p = casino.users[cid];
  if (!p) return { tag: '', color: '' };
  return { tag: p.tag || '', color: p.color || '' };
}

// ---- store catalog ----
export const STORE = [
  { id: 'tag_fire', type: 'tag', label: '🔥 Fire', price: 2000, rarity: 'common' },
  { id: 'tag_cool', type: 'tag', label: '😎 Cool', price: 2000, rarity: 'common' },
  { id: 'tag_gamer', type: 'tag', label: '🎮 Gamer', price: 3500, rarity: 'uncommon' },
  { id: 'tag_star', type: 'tag', label: '⭐ Star', price: 3500, rarity: 'uncommon' },
  { id: 'tag_rocket', type: 'tag', label: '🚀 Rocket', price: 6000, rarity: 'rare' },
  { id: 'tag_crown', type: 'tag', label: '👑 Royalty', price: 12000, rarity: 'epic' },
  { id: 'tag_diamond', type: 'tag', label: '💎 Diamond', price: 25000, rarity: 'legendary' },
  { id: 'tag_goat', type: 'tag', label: '🐐 GOAT', price: 50000, rarity: 'mythic' },
  { id: 'col_red', type: 'color', label: 'Red name', value: '#ff5252', price: 2500, rarity: 'common' },
  { id: 'col_green', type: 'color', label: 'Green name', value: '#2bd576', price: 2500, rarity: 'common' },
  { id: 'col_blue', type: 'color', label: 'Blue name', value: '#4cc9f0', price: 2500, rarity: 'common' },
  { id: 'col_purple', type: 'color', label: 'Purple name', value: '#b185ff', price: 4000, rarity: 'uncommon' },
  { id: 'col_pink', type: 'color', label: 'Pink name', value: '#ff6ec7', price: 4000, rarity: 'uncommon' },
  { id: 'col_gold', type: 'color', label: 'Gold name', value: '#ffd166', price: 15000, rarity: 'epic' },
  { id: 'col_rainbow', type: 'color', label: 'Aqua glow', value: '#00e5ff', price: 30000, rarity: 'legendary' },
];
function storeItem(id) { return STORE.find((s) => s.id === id) || null; }

// ---- cases (CS2-style loot, coin values with rarity) ----
export const CASES = {
  starter: { name: 'Starter Case', price: 1000, pool: [
    { v: 0, w: 32, r: 'common' }, { v: 500, w: 30, r: 'common' }, { v: 900, w: 20, r: 'uncommon' },
    { v: 1500, w: 11, r: 'rare' }, { v: 3000, w: 5, r: 'epic' }, { v: 8000, w: 1.6, r: 'legendary' }, { v: 25000, w: 0.4, r: 'mythic' },
  ] },
  highroller: { name: 'High Roller', price: 5000, pool: [
    { v: 0, w: 30, r: 'common' }, { v: 2500, w: 32, r: 'common' }, { v: 4500, w: 20, r: 'uncommon' },
    { v: 8000, w: 11, r: 'rare' }, { v: 16000, w: 5, r: 'epic' }, { v: 40000, w: 1.6, r: 'legendary' }, { v: 120000, w: 0.4, r: 'mythic' },
  ] },
};
function openCase(def) {
  const total = def.pool.reduce((s, i) => s + i.w, 0);
  let roll = Math.random() * total;
  for (const item of def.pool) { roll -= item.w; if (roll <= 0) return item; }
  return def.pool[0];
}
export { openCase };

// ---- helpers ----
function sendJson(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); });
}
function clampBet(bet, coins) { bet = Math.floor(Number(bet) || 0); return bet; }
function publicProfile(cid) {
  const p = profileOf(cid);
  return { coins: p.coins, lastDaily: p.lastDaily, inventory: p.inventory, tag: p.tag, color: p.color, stats: p.stats };
}
function recordPlay(p, bet, payout) {
  p.stats.plays++; p.stats.wagered += bet;
  const net = payout - bet;
  if (net > 0) p.stats.won += net;
  if (payout > p.stats.biggest) p.stats.biggest = payout;
}

// ---- blackjack (transient per-user hands) ----
const bj = {}; // cid -> {deck, player, dealer, bet, done}
const SUITS = ['♠', '♥', '♦', '♣'];
function freshDeck() {
  const d = [];
  for (const s of SUITS) for (let n = 1; n <= 13; n++) d.push({ n, s });
  for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards) { let v = Math.min(c.n, 10); if (c.n === 1) { aces++; v = 11; } total += v; }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
function bjState(cid, reveal) {
  const g = bj[cid];
  if (!g) return null;
  return {
    player: g.player, dealer: reveal ? g.dealer : [g.dealer[0], { hidden: true }],
    playerValue: handValue(g.player), dealerValue: reveal ? handValue(g.dealer) : handValue([g.dealer[0]]),
    bet: g.bet, done: g.done, result: g.result || '',
  };
}

// ============================================================
// Router — returns true if it handled the request.
// ============================================================
export async function handleCasino(url, req, res) {
  const path = url.split('?')[0];
  if (!path.startsWith('/api/casino/')) return false;
  const { cid, nick } = who(req);
  if (!cid) { sendJson(res, 200, { error: 'no-id', message: 'Pick a nickname on the site first.' }); return true; }
  const p = profileOf(cid);

  if (path === '/api/casino/me') { sendJson(res, 200, { profile: publicProfile(cid), store: STORE, cases: CASES, nick, dailyMs: DAILY_MS, dailyCoins: DAILY_COINS }); return true; }

  if (path === '/api/casino/daily' && req.method === 'POST') {
    const now = Date.now();
    if (now - p.lastDaily < DAILY_MS) { sendJson(res, 200, { error: 'cooldown', nextIn: DAILY_MS - (now - p.lastDaily), profile: publicProfile(cid) }); return true; }
    p.lastDaily = now; p.coins += DAILY_COINS; save();
    sendJson(res, 200, { ok: true, gained: DAILY_COINS, profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/slots' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet;
    // weighted reel symbols
    const SYM = [ { s: '🍒', w: 28, pay: 3 }, { s: '🍋', w: 24, pay: 4 }, { s: '🔔', w: 18, pay: 6 }, { s: '⭐', w: 14, pay: 10 }, { s: '💎', w: 9, pay: 20 }, { s: '7️⃣', w: 5, pay: 50 }, { s: '🎰', w: 2, pay: 150 } ];
    const spin = () => { const t = SYM.reduce((a, x) => a + x.w, 0); let r = Math.random() * t; for (const x of SYM) { r -= x.w; if (r <= 0) return x; } return SYM[0]; };
    const reels = [spin(), spin(), spin()];
    let payout = 0, line = '';
    if (reels[0].s === reels[1].s && reels[1].s === reels[2].s) { payout = bet * reels[0].pay; line = 'JACKPOT — three ' + reels[0].s; }
    else if (reels[0].s === reels[1].s || reels[1].s === reels[2].s || reels[0].s === reels[2].s) { payout = Math.floor(bet * 1.5); line = 'Two match'; }
    p.coins += payout; recordPlay(p, bet, payout); save();
    sendJson(res, 200, { reels: reels.map((r) => r.s), payout, win: payout - bet, line, profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/coinflip' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    const side = body.side === 'tails' ? 'tails' : 'heads';
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet;
    // slight house edge: 49% win
    const landed = Math.random() < 0.49 ? side : (side === 'heads' ? 'tails' : 'heads');
    const won = landed === side;
    const payout = won ? bet * 2 : 0;
    p.coins += payout; recordPlay(p, bet, payout); save();
    sendJson(res, 200, { landed, won, payout, profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/bj/start' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet; save();
    const deck = freshDeck();
    const g = { deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], bet, done: false, result: '' };
    bj[cid] = g;
    // natural blackjack
    if (handValue(g.player) === 21) { settleBj(cid); }
    sendJson(res, 200, { state: bjState(cid, g.done), profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/bj/hit' && req.method === 'POST') {
    const g = bj[cid]; if (!g || g.done) return (sendJson(res, 200, { error: 'no-game' }), true);
    g.player.push(g.deck.pop());
    if (handValue(g.player) > 21) { g.done = true; g.result = 'bust'; /* bet already taken */ save(); }
    sendJson(res, 200, { state: bjState(cid, g.done), profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/bj/stand' && req.method === 'POST') {
    const g = bj[cid]; if (!g || g.done) return (sendJson(res, 200, { error: 'no-game' }), true);
    settleBj(cid);
    sendJson(res, 200, { state: bjState(cid, true), profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/case' && req.method === 'POST') {
    const body = await readBody(req); const def = CASES[String(body.caseId || '')];
    if (!def) return (sendJson(res, 200, { error: 'bad-case' }), true);
    if (def.price > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= def.price;
    const item = openCase(def);
    p.coins += item.v; recordPlay(p, def.price, item.v); save();
    sendJson(res, 200, { item, caseName: def.name, net: item.v - def.price, profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/buy' && req.method === 'POST') {
    const body = await readBody(req); const it = storeItem(String(body.itemId || ''));
    if (!it) return (sendJson(res, 200, { error: 'bad-item' }), true);
    if (p.inventory.includes(it.id)) return (sendJson(res, 200, { error: 'owned', profile: publicProfile(cid) }), true);
    if (it.price > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= it.price; p.inventory.push(it.id); save();
    sendJson(res, 200, { ok: true, profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/equip' && req.method === 'POST') {
    const body = await readBody(req); const id = String(body.itemId || '');
    if (id === 'none-tag') { p.tag = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-color') { p.color = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    const it = storeItem(id);
    if (!it || !p.inventory.includes(it.id)) return (sendJson(res, 200, { error: 'not-owned' }), true);
    if (it.type === 'tag') p.tag = it.label; else p.color = it.value;
    save();
    sendJson(res, 200, { ok: true, profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/leaderboard') {
    const top = Object.entries(casino.users).map(([id, u]) => ({ id, coins: u.coins, biggest: u.stats.biggest }))
      .sort((a, b) => b.coins - a.coins).slice(0, 15);
    sendJson(res, 200, { top }); return true;
  }

  sendJson(res, 404, { error: 'unknown' }); return true;
}

function settleBj(cid) {
  const g = bj[cid]; if (!g) return;
  const p = profileOf(cid);
  // dealer draws to 17
  while (handValue(g.dealer) < 17) g.dealer.push(g.deck.pop());
  const pv = handValue(g.player), dv = handValue(g.dealer);
  let payout = 0, result;
  const natural = g.player.length === 2 && pv === 21;
  if (pv > 21) { result = 'bust'; payout = 0; }
  else if (natural && !(g.dealer.length === 2 && dv === 21)) { result = 'blackjack'; payout = Math.floor(g.bet * 2.5); }
  else if (dv > 21 || pv > dv) { result = 'win'; payout = g.bet * 2; }
  else if (pv === dv) { result = 'push'; payout = g.bet; }
  else { result = 'lose'; payout = 0; }
  g.done = true; g.result = result;
  p.coins += payout; recordPlay(p, g.bet, payout); save();
}
