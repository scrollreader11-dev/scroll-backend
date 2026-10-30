// ============================================================
// ScrollHub Casino — a coins game app (Blackjack, Slots, Coinflip,
// case opening) with a cosmetics store that shows up in chat.
// Self-contained: own persistence (tmp + Upstash KV) and HTTP API.
// Identity = sh_cid / sh_nick cookies (same as chat).
// ============================================================
import fs from 'node:fs';
import { WebSocketServer } from 'ws';

const CASINO_FILE = '/tmp/scrollhub-casino.json';
const START_COINS = 1000;
const DAILY_COINS = 750;
const DAILY_MS = 20 * 3600 * 1000; // claimable every 20h
const GOTD_BONUS = 1500; // coin bonus for playing the Game of the Day (once/day)

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

const casino = { users: {}, gotd: null, codes: {} }; // cid -> profile; gotd override; event codes
function blankProfile() {
  return { coins: START_COINS, lastDaily: 0, streak: 0, gotdClaimed: '', nick: '', inventory: [], tag: '', color: '', banner: '', avatarFx: '', titleFx: '', stats: { wagered: 0, won: 0, biggest: 0, plays: 0, casesOpened: 0, peak: START_COINS, crashBest: 0, tipped: 0 } };
}
function load(raw) { try { const d = JSON.parse(raw); if (d && d.users) casino.users = d.users; if (d && 'gotd' in d) casino.gotd = d.gotd; if (d && d.codes) casino.codes = d.codes; } catch (e) {} }
export async function initCasino() {
  try { if (fs.existsSync(CASINO_FILE)) load(fs.readFileSync(CASINO_FILE, 'utf8')); } catch (e) {}
  try { const s = await kvGet('sh:casino'); if (s) load(s); } catch (e) { console.log('kv casino load failed:', e.message); }
  // One-time wipe for the new login system: clears every old anonymous profile
  // (coins/cosmetics) exactly once across all deploys, then never again.
  try {
    const marker = await kvGet('sh:reset_accounts_v1');
    if (!marker) {
      casino.users = {};
      save();
      try { await kvSet('sh:casino', JSON.stringify({ users: {} })); } catch (e) {}
      await kvSet('sh:reset_accounts_v1', String(Date.now()));
      console.log('casino: one-time account/economy reset applied');
    }
  } catch (e) { console.log('reset check failed:', e.message); }
}
let dirty = false;
function blob() { return JSON.stringify({ users: casino.users, gotd: casino.gotd, codes: casino.codes }); }
function save() { dirty = true; try { fs.writeFileSync(CASINO_FILE, blob()); } catch (e) {} }
async function flush() { if (!dirty) return; dirty = false; try { await kvSet('sh:casino', blob()); } catch (e) { dirty = true; } }
setInterval(flush, 8000);
export { flush as flushCasino };
// Flush on shutdown so a redeploy doesn't drop the last few seconds.
for (const sig of ['SIGTERM', 'SIGINT']) {
  try { process.on(sig, async () => { try { await flush(); } catch (e) {} }); } catch (e) {}
}

// ---- identity ----
function parseCookies(req) {
  const out = {}; const h = req.headers.cookie || '';
  h.split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
function who(req) {
  if (req._auth) return { cid: req._auth.id, nick: String(req._auth.username).slice(0, 40) }; // trusted login
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
  if (!p) return { tag: '', color: '', banner: '', avatarFx: '', titleFx: '' };
  return { tag: p.tag || '', color: p.color || '', banner: p.banner || '', avatarFx: p.avatarFx || '', titleFx: p.titleFx || '' };
}
// Admin: add (or remove, if negative) Scrolls for a player by client id.
export function grantCoins(cid, amount) {
  if (!cid) return null;
  const p = profileOf(cid);
  p.coins = Math.max(0, Math.floor(p.coins + (Number(amount) || 0)));
  if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
  save(); flush();
  return p.coins;
}

// Admin event: grant Scrolls to EVERY account (online or not). Returns count.
export function grantEveryone(amount) {
  const a = Math.floor(Number(amount) || 0); let n = 0;
  for (const cid in casino.users) {
    const p = casino.users[cid];
    p.coins = Math.max(0, p.coins + a);
    if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
    n++;
  }
  save(); flush();
  return n;
}

// ---- admin: Game of the Day override ----
export function setGotdOverride(game) {
  casino.gotd = (game && game.label) ? {
    label: String(game.label).slice(0, 80),
    url: String(game.url || '').slice(0, 500),
    imageUrl: String(game.imageUrl || '').slice(0, 500),
  } : null;
  save(); flush();
  return casino.gotd;
}
export function getGotdOverride() { return casino.gotd; }

// ---- admin: redeemable event codes (Scroll giveaways) ----
function normCode(s) { return String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24); }
export function createEventCode(opts) {
  const code = normCode(opts.code);
  const amount = Math.max(1, Math.min(10000000, Math.floor(Number(opts.amount) || 0)));
  const max = Math.max(0, Math.min(1000000, Math.floor(Number(opts.max) || 0))); // 0 = unlimited claims
  if (!code) return null;
  casino.codes[code] = { amount, max, claimedBy: {}, count: 0, createdAt: Date.now() };
  save(); flush();
  return { code, amount, max };
}
export function listEventCodes() {
  return Object.entries(casino.codes).map(([code, c]) => ({ code, amount: c.amount, max: c.max, count: c.count }));
}
export function deleteEventCode(code) {
  const k = normCode(code);
  if (casino.codes[k]) { delete casino.codes[k]; save(); flush(); return true; }
  return false;
}

// ---- store catalog ----
export const STORE = [
  { id: 'tag_fire', type: 'tag', label: '🔥 Fire', price: 2000, rarity: 'common' },
  { id: 'tag_cool', type: 'tag', label: '😎 Cool', price: 2000, rarity: 'common' },
  { id: 'tag_gamer', type: 'tag', label: '🎮 Gamer', price: 3500, rarity: 'uncommon' },
  { id: 'tag_star', type: 'tag', label: '⭐ Star', price: 3500, rarity: 'uncommon' },
  { id: 'tag_rocket', type: 'tag', label: '🚀 Rocket', price: 6000, rarity: 'rare' },
  { id: 'tag_ninja', type: 'tag', label: '🥷 Ninja', price: 6000, rarity: 'rare' },
  { id: 'tag_dj', type: 'tag', label: '🎧 DJ', price: 6000, rarity: 'rare' },
  { id: 'tag_ghost', type: 'tag', label: '👻 Ghost', price: 4500, rarity: 'uncommon' },
  { id: 'tag_shark', type: 'tag', label: '🦈 Shark', price: 7500, rarity: 'rare' },
  { id: 'tag_crown', type: 'tag', label: '👑 Royalty', price: 12000, rarity: 'epic' },
  { id: 'tag_alien', type: 'tag', label: '👽 Alien', price: 12000, rarity: 'epic' },
  { id: 'tag_dragon', type: 'tag', label: '🐉 Dragon', price: 18000, rarity: 'epic' },
  { id: 'tag_skull', type: 'tag', label: '☠️ Menace', price: 18000, rarity: 'epic' },
  { id: 'tag_diamond', type: 'tag', label: '💎 Diamond', price: 25000, rarity: 'legendary' },
  { id: 'tag_mystic', type: 'tag', label: '🔮 Mystic', price: 32000, rarity: 'legendary' },
  { id: 'tag_goat', type: 'tag', label: '🐐 GOAT', price: 50000, rarity: 'mythic' },
  { id: 'tag_king', type: 'tag', label: '♛ Overlord', price: 100000, rarity: 'mythic' },
  { id: 'col_red', type: 'color', label: 'Red name', value: '#ff5252', price: 2500, rarity: 'common' },
  { id: 'col_green', type: 'color', label: 'Green name', value: '#2bd576', price: 2500, rarity: 'common' },
  { id: 'col_blue', type: 'color', label: 'Blue name', value: '#4cc9f0', price: 2500, rarity: 'common' },
  { id: 'col_orange', type: 'color', label: 'Orange name', value: '#ff922b', price: 2500, rarity: 'common' },
  { id: 'col_purple', type: 'color', label: 'Purple name', value: '#b185ff', price: 4000, rarity: 'uncommon' },
  { id: 'col_pink', type: 'color', label: 'Pink name', value: '#ff6ec7', price: 4000, rarity: 'uncommon' },
  { id: 'col_lime', type: 'color', label: 'Lime name', value: '#c0ff33', price: 4000, rarity: 'uncommon' },
  { id: 'col_cyan', type: 'color', label: 'Cyan name', value: '#22e0d6', price: 5500, rarity: 'rare' },
  { id: 'col_crimson', type: 'color', label: 'Crimson name', value: '#dc143c', price: 5500, rarity: 'rare' },
  { id: 'col_gold', type: 'color', label: 'Gold name', value: '#ffd166', price: 15000, rarity: 'epic' },
  { id: 'col_aqua', type: 'color', label: 'Aqua glow', value: '#00e5ff', price: 30000, rarity: 'legendary' },
  { id: 'col_hot', type: 'color', label: 'Hot magenta', value: '#ff2d95', price: 45000, rarity: 'legendary' },
  { id: 'col_white', type: 'color', label: 'Clean white', value: '#f5f7ff', price: 3000, rarity: 'common' },
  { id: 'col_teal', type: 'color', label: 'Teal name', value: '#14b8a6', price: 4000, rarity: 'uncommon' },
  { id: 'col_violet', type: 'color', label: 'Violet name', value: '#8b5cf6', price: 5500, rarity: 'rare' },
  { id: 'col_sun', type: 'color', label: 'Sunset', value: '#ff7849', price: 5500, rarity: 'rare' },
  { id: 'col_mint', type: 'color', label: 'Mint', value: '#5eead4', price: 6500, rarity: 'rare' },
  { id: 'col_rose', type: 'color', label: 'Rose gold', value: '#e8a0a0', price: 15000, rarity: 'epic' },
  { id: 'col_emer', type: 'color', label: 'Emerald', value: '#10d070', price: 18000, rarity: 'epic' },
  { id: 'col_ice', type: 'color', label: 'Ice', value: '#a5f3fc', price: 30000, rarity: 'legendary' },
  { id: 'col_blood', type: 'color', label: 'Blood', value: '#b00020', price: 40000, rarity: 'legendary' },
  { id: 'col_void', type: 'color', label: 'Void black', value: '#0b0b12', price: 60000, rarity: 'mythic' },
  { id: 'tag_heart', type: 'tag', label: '❤️ Loved', price: 2000, rarity: 'common' },
  { id: 'tag_lightning', type: 'tag', label: '⚡ Flash', price: 3500, rarity: 'uncommon' },
  { id: 'tag_wizard', type: 'tag', label: '🧙 Wizard', price: 6000, rarity: 'rare' },
  { id: 'tag_robot', type: 'tag', label: '🤖 Bot', price: 6000, rarity: 'rare' },
  { id: 'tag_money', type: 'tag', label: '💰 Rich', price: 9000, rarity: 'rare' },
  { id: 'tag_trophy', type: 'tag', label: '🏆 Champion', price: 15000, rarity: 'epic' },
  { id: 'tag_fox', type: 'tag', label: '🦊 Sly', price: 7500, rarity: 'rare' },
  { id: 'tag_wolf', type: 'tag', label: '🐺 Wolf', price: 12000, rarity: 'epic' },
  { id: 'tag_phoenix', type: 'tag', label: '🔥 Phoenix', price: 22000, rarity: 'epic' },
  { id: 'tag_devil', type: 'tag', label: '😈 Devil', price: 20000, rarity: 'epic' },
  { id: 'tag_angel', type: 'tag', label: '😇 Angel', price: 20000, rarity: 'epic' },
  { id: 'tag_galaxy', type: 'tag', label: '🌌 Cosmic', price: 35000, rarity: 'legendary' },
  { id: 'tag_infinity', type: 'tag', label: '♾️ Infinite', price: 75000, rarity: 'mythic' },
  // Animated name effects (equip in the color slot; rendered by the chat).
  { id: 'fx_pulse', type: 'color', label: '💫 Pulse Glow (animated)', value: 'fx:pulse', price: 40000, rarity: 'legendary' },
  { id: 'fx_shimmer', type: 'color', label: '✨ Gold Shimmer (animated)', value: 'fx:shimmer', price: 55000, rarity: 'legendary' },
  { id: 'fx_rainbow', type: 'color', label: '🌈 Rainbow (animated)', value: 'fx:rainbow', price: 90000, rarity: 'mythic' },
  // Profile banners (shown behind your name on your profile card).
  { id: 'ban_sunset', type: 'banner', label: '🌅 Sunset Banner', value: 'linear-gradient(135deg,#ff6ec7,#ffa94d)', price: 8000, rarity: 'uncommon' },
  { id: 'ban_ocean', type: 'banner', label: '🌊 Ocean Banner', value: 'linear-gradient(135deg,#4cc9f0,#4361ee)', price: 8000, rarity: 'uncommon' },
  { id: 'ban_forest', type: 'banner', label: '🌲 Forest Banner', value: 'linear-gradient(135deg,#2bd576,#0b7a4b)', price: 8000, rarity: 'uncommon' },
  { id: 'ban_night', type: 'banner', label: '🌌 Midnight Banner', value: 'linear-gradient(135deg,#1a1a2e,#4a00e0)', price: 10000, rarity: 'rare' },
  { id: 'ban_lava', type: 'banner', label: '🌋 Lava Banner', value: 'linear-gradient(135deg,#f12711,#f5af19)', price: 12000, rarity: 'rare' },
  { id: 'ban_aurora', type: 'banner', label: '✦ Aurora Banner (animated)', value: 'anim:aurora', price: 40000, rarity: 'legendary' },
  { id: 'ban_rainbow', type: 'banner', label: '🌈 Rainbow Banner (animated)', value: 'anim:rainbow', price: 60000, rarity: 'legendary' },
  { id: 'ban_galaxy', type: 'banner', label: '🪐 Galaxy Banner (animated)', value: 'anim:galaxy', price: 85000, rarity: 'mythic' },
  // Animated avatar rings (glow around your profile picture).
  { id: 'av_pulse', type: 'avatar', label: '💠 Pulse Ring (animated)', value: 'ring:pulse', price: 15000, rarity: 'rare' },
  { id: 'av_gold', type: 'avatar', label: '🥇 Gold Ring (animated)', value: 'ring:gold', price: 25000, rarity: 'epic' },
  { id: 'av_fire', type: 'avatar', label: '🔥 Fire Ring (animated)', value: 'ring:fire', price: 35000, rarity: 'epic' },
  { id: 'av_rainbow', type: 'avatar', label: '🌈 Rainbow Ring (animated)', value: 'ring:rainbow', price: 70000, rarity: 'mythic' },
  // Animated title effects — animate your equipped title/tag badge.
  { id: 'tfx_pulse', type: 'titlefx', label: '💠 Pulse Title (animated)', value: 'pulse', price: 20000, rarity: 'rare' },
  { id: 'tfx_gold', type: 'titlefx', label: '🥇 Gold Title (animated)', value: 'gold', price: 30000, rarity: 'epic' },
  { id: 'tfx_shimmer', type: 'titlefx', label: '✨ Shimmer Title (animated)', value: 'shimmer', price: 45000, rarity: 'legendary' },
  { id: 'tfx_rainbow', type: 'titlefx', label: '🌈 Rainbow Title (animated)', value: 'rainbow', price: 80000, rarity: 'mythic' },
];
function storeItem(id) { return STORE.find((s) => s.id === id) || null; }

// ---- cases (CS2-style loot, coin values with rarity) ----
export const CASES = {
  starter: { name: 'Starter Case', price: 1000, pool: [
    { v: 0, w: 6, r: 'common' }, { v: 300, w: 40, r: 'common' }, { v: 600, w: 26, r: 'common' },
    { v: 900, w: 15, r: 'uncommon' }, { v: 1700, w: 7, r: 'rare' }, { v: 3500, w: 4, r: 'epic' },
    { v: 9000, w: 1.6, r: 'legendary' }, { v: 28000, w: 0.4, r: 'mythic' },
  ] },
  highroller: { name: 'High Roller', price: 5000, pool: [
    { v: 0, w: 6, r: 'common' }, { v: 1500, w: 40, r: 'common' }, { v: 3000, w: 26, r: 'common' },
    { v: 4500, w: 15, r: 'uncommon' }, { v: 8500, w: 7, r: 'rare' }, { v: 18000, w: 4, r: 'epic' },
    { v: 45000, w: 1.6, r: 'legendary' }, { v: 140000, w: 0.4, r: 'mythic' },
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
  return { coins: p.coins, lastDaily: p.lastDaily, streak: p.streak || 0, gotdClaimed: p.gotdClaimed || '', inventory: p.inventory, tag: p.tag, color: p.color, banner: p.banner || '', avatarFx: p.avatarFx || '', titleFx: p.titleFx || '', stats: p.stats };
}
function recordPlay(p, bet, payout) {
  p.stats.plays++; p.stats.wagered += bet;
  const net = payout - bet;
  if (net > 0) p.stats.won += net;
  if (payout > p.stats.biggest) p.stats.biggest = payout;
  if (p.stats.casesOpened == null) p.stats.casesOpened = 0;
  if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
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

// ---- crash (multiplier rises until it busts; cash out in time) ----
const crash = {}; // cid -> {bet, crashPoint, startTime, done}
const CRASH_K = 0.00014; // multiplier = e^(k * elapsedMs); ~2x at 5s, ~10x at ~16s
function crashMultAt(ms) { return Math.max(1, Math.floor(Math.exp(CRASH_K * Math.max(0, ms)) * 100) / 100); }
function rollCrashPoint() {
  const r = Math.random();
  if (r < 0.03) return 1.00; // instant bust ~3% (the house edge)
  const pt = 0.99 / (1 - r); // heavy-tailed; most rounds 1.1x–5x, rare big ones
  return Math.min(1000, Math.max(1.01, Math.floor(pt * 100) / 100));
}

// ---- mines (reveal safe tiles, avoid bombs, cash out) ----
const mines = {}; // cid -> {mines, bet, positions:Set, picks:[], done}
function minesMult(m, picks) {
  // Fair multiplier: product of remaining/safe-remaining, minus ~3% house edge.
  let mult = 1; const total = 25;
  for (let i = 0; i < picks; i++) mult *= (total - i) / (total - m - i);
  return mult * 0.97;
}

// ============================================================
// Router — returns true if it handled the request.
// ============================================================
export async function handleCasino(url, req, res) {
  const path = url.split('?')[0];
  if (!path.startsWith('/api/casino/')) return false;
  const { cid, nick } = who(req);
  if (!cid) { sendJson(res, 200, { error: 'no-id', message: 'Log in to ScrollHub first.' }); return true; }
  const p = profileOf(cid);
  if (nick && nick !== 'Guest' && p.nick !== nick) { p.nick = nick; save(); } // keep a name for the leaderboard/tips

  if (path === '/api/casino/me') { sendJson(res, 200, { profile: publicProfile(cid), store: STORE, cases: CASES, nick, dailyMs: DAILY_MS, dailyCoins: DAILY_COINS }); return true; }

  if (path === '/api/casino/daily' && req.method === 'POST') {
    const now = Date.now();
    const gap = now - p.lastDaily;
    if (p.lastDaily && gap < DAILY_MS) { sendJson(res, 200, { error: 'cooldown', nextIn: DAILY_MS - gap, streak: p.streak || 0, profile: publicProfile(cid) }); return true; }
    // Streak continues if the last claim was within ~44h; otherwise it resets.
    const STREAK_GRACE = 44 * 3600 * 1000;
    const cont = p.lastDaily && gap <= STREAK_GRACE;
    p.streak = (cont ? (p.streak || 0) : 0) + 1;
    // Base reward grows with streak (capped), plus a milestone bonus every 7 days.
    const base = DAILY_COINS + Math.min(p.streak, 14) * 120;
    const milestone = p.streak % 7 === 0 ? 3000 : 0;
    const gained = base + milestone;
    p.lastDaily = now; p.coins += gained;
    if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
    save(); flush();
    sendJson(res, 200, { ok: true, gained, streak: p.streak, milestone: milestone > 0, profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/gotd' && req.method !== 'POST') {
    const today = new Date().toISOString().slice(0, 10);
    sendJson(res, 200, { bonus: GOTD_BONUS, claimed: p.gotdClaimed === today, dateKey: today, override: casino.gotd || null }); return true;
  }

  // Redeem an event code (Scroll giveaway) — once per account.
  if (path === '/api/casino/redeem' && req.method === 'POST') {
    const body = await readBody(req);
    const code = normCode(body.code);
    const c = casino.codes[code];
    if (!c) return (sendJson(res, 200, { error: 'bad-code' }), true);
    if (c.claimedBy[cid]) return (sendJson(res, 200, { error: 'already-redeemed', profile: publicProfile(cid) }), true);
    if (c.max > 0 && c.count >= c.max) return (sendJson(res, 200, { error: 'code-exhausted' }), true);
    c.claimedBy[cid] = Date.now(); c.count++;
    p.coins += c.amount; if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
    save(); flush();
    sendJson(res, 200, { ok: true, gained: c.amount, profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/gotd-claim' && req.method === 'POST') {
    const today = new Date().toISOString().slice(0, 10); // UTC day key
    if (p.gotdClaimed === today) { sendJson(res, 200, { already: true, profile: publicProfile(cid) }); return true; }
    p.gotdClaimed = today; p.coins += GOTD_BONUS;
    if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
    save(); flush();
    sendJson(res, 200, { ok: true, gained: GOTD_BONUS, profile: publicProfile(cid) }); return true;
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
    p.coins += item.v; p.stats.casesOpened = (p.stats.casesOpened || 0) + 1; recordPlay(p, def.price, item.v); save();
    sendJson(res, 200, { item, caseName: def.name, net: item.v - def.price, profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/buy' && req.method === 'POST') {
    const body = await readBody(req); const it = storeItem(String(body.itemId || ''));
    if (!it) return (sendJson(res, 200, { error: 'bad-item' }), true);
    if (p.inventory.includes(it.id)) return (sendJson(res, 200, { error: 'owned', profile: publicProfile(cid) }), true);
    if (it.price > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= it.price; p.inventory.push(it.id); save(); flush();
    sendJson(res, 200, { ok: true, profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/equip' && req.method === 'POST') {
    const body = await readBody(req); const id = String(body.itemId || '');
    if (id === 'none-tag') { p.tag = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-color') { p.color = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-banner') { p.banner = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-avatarFx') { p.avatarFx = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-titlefx') { p.titleFx = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    const it = storeItem(id);
    if (!it || !p.inventory.includes(it.id)) return (sendJson(res, 200, { error: 'not-owned' }), true);
    if (it.type === 'tag') p.tag = it.label;
    else if (it.type === 'banner') p.banner = it.value;
    else if (it.type === 'avatar') p.avatarFx = it.value;
    else if (it.type === 'titlefx') p.titleFx = it.value;
    else p.color = it.value;
    save(); flush();
    sendJson(res, 200, { ok: true, profile: publicProfile(cid) }); return true;
  }

  // ---- dice (roll over/under a target) ----
  if (path === '/api/casino/dice' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    const over = body.dir !== 'under';
    let target = Math.floor(Number(body.target)); if (!Number.isFinite(target)) target = 50;
    target = Math.max(2, Math.min(98, target));
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet;
    const roll = Math.floor(Math.random() * 10001) / 100; // 0.00–100.00
    const winChance = over ? (100 - target) : target; // percent
    const won = over ? (roll > target) : (roll < target);
    const mult = won && winChance > 0 ? (99 / winChance) : 0; // ~1% house edge
    const payout = Math.floor(bet * mult);
    p.coins += payout; recordPlay(p, bet, payout); save();
    sendJson(res, 200, { roll, target, over, won, mult: +mult.toFixed(4), payout, win: payout - bet, profile: publicProfile(cid) }); return true;
  }

  // ---- roulette (red/black/green, even/odd, or an exact number 0-36) ----
  if (path === '/api/casino/roulette' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    const choice = String(body.choice || 'red');
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet;
    const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    const n = Math.floor(Math.random() * 37);
    const color = n === 0 ? 'green' : (REDS.has(n) ? 'red' : 'black');
    const numChoice = /^\d{1,2}$/.test(choice) ? parseInt(choice, 10) : null;
    let payout = 0;
    if (numChoice !== null && numChoice >= 0 && numChoice <= 36) { if (n === numChoice) payout = bet * 36; }
    else if (choice === 'red' && color === 'red') payout = bet * 2;
    else if (choice === 'black' && color === 'black') payout = bet * 2;
    else if (choice === 'green' && color === 'green') payout = bet * 14;
    else if (choice === 'even' && n !== 0 && n % 2 === 0) payout = bet * 2;
    else if (choice === 'odd' && n % 2 === 1) payout = bet * 2;
    p.coins += payout; recordPlay(p, bet, payout); save();
    sendJson(res, 200, { number: n, color, choice, payout, win: payout - bet, profile: publicProfile(cid) }); return true;
  }

  // ---- mines ----
  if (path === '/api/casino/mines/start' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    let m = Math.floor(Number(body.mines) || 3); m = Math.max(1, Math.min(24, m));
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet; save();
    const positions = new Set();
    while (positions.size < m) positions.add(Math.floor(Math.random() * 25));
    mines[cid] = { mines: m, bet, positions, picks: [], done: false };
    sendJson(res, 200, { ok: true, mines: m, picks: 0, mult: 1, profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/mines/pick' && req.method === 'POST') {
    const body = await readBody(req); const g = mines[cid];
    if (!g || g.done) return (sendJson(res, 200, { error: 'no-game' }), true);
    const tile = Math.floor(Number(body.tile));
    if (!(tile >= 0 && tile < 25) || g.picks.includes(tile)) return (sendJson(res, 200, { error: 'bad-tile' }), true);
    if (g.positions.has(tile)) {
      g.done = true; recordPlay(p, g.bet, 0); save();
      return (sendJson(res, 200, { hit: true, tile, done: true, mineField: [...g.positions], profile: publicProfile(cid) }), true);
    }
    g.picks.push(tile);
    const mult = minesMult(g.mines, g.picks.length);
    sendJson(res, 200, { hit: false, tile, picks: g.picks.length, mult: +mult.toFixed(4), cashout: Math.floor(g.bet * mult), profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/mines/cashout' && req.method === 'POST') {
    const g = mines[cid];
    if (!g || g.done || g.picks.length === 0) return (sendJson(res, 200, { error: 'no-game' }), true);
    const mult = minesMult(g.mines, g.picks.length);
    const payout = Math.floor(g.bet * mult);
    g.done = true; p.coins += payout; recordPlay(p, g.bet, payout); save();
    sendJson(res, 200, { ok: true, payout, mult: +mult.toFixed(4), win: payout - g.bet, mineField: [...g.positions], profile: publicProfile(cid) }); return true;
  }

  // ---- plinko (drop a ball through pegs into a multiplier slot) ----
  if (path === '/api/casino/plinko' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet;
    const ROWS = 16;
    const MULT = [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110]; // 17 slots
    const pathArr = []; let slot = 0;
    for (let i = 0; i < ROWS; i++) { const right = Math.random() < 0.5 ? 1 : 0; pathArr.push(right); slot += right; }
    const mult = MULT[slot];
    const payout = Math.floor(bet * mult);
    p.coins += payout; recordPlay(p, bet, payout); save();
    sendJson(res, 200, { path: pathArr, slot, mult, mults: MULT, payout, win: payout - bet, profile: publicProfile(cid) }); return true;
  }

  // ---- wheel (spin for a multiplier) ----
  if (path === '/api/casino/wheel' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet;
    const SEG = [0, 1.5, 0, 2, 0, 1.2, 0, 1.5, 0, 3, 0, 1.2, 0, 1.5, 0, 2, 0, 1.2, 0, 4]; // ~4.5% edge
    const idx = Math.floor(Math.random() * SEG.length);
    const mult = SEG[idx];
    const payout = Math.floor(bet * mult);
    p.coins += payout; recordPlay(p, bet, payout); save();
    sendJson(res, 200, { idx, segments: SEG, mult, payout, win: payout - bet, profile: publicProfile(cid) }); return true;
  }

  // ---- crash ----
  if (path === '/api/casino/crash/start' && req.method === 'POST') {
    const body = await readBody(req); const bet = clampBet(body.bet, p.coins);
    if (bet < 1) return (sendJson(res, 200, { error: 'bad-bet' }), true);
    if (bet > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= bet; save();
    crash[cid] = { bet, crashPoint: rollCrashPoint(), startTime: Date.now(), done: false };
    // Client animates the rocket to crashPoint; the server still validates every
    // cashout against its own clock (min of claimed and server multiplier).
    sendJson(res, 200, { ok: true, startTime: crash[cid].startTime, k: CRASH_K, crashPoint: crash[cid].crashPoint, profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/crash/cashout' && req.method === 'POST') {
    const g = crash[cid];
    if (!g || g.done) return (sendJson(res, 200, { error: 'no-game' }), true);
    g.done = true;
    const serverMult = crashMultAt(Date.now() - g.startTime);
    // Honor what the player saw, but never beyond the server clock.
    let claimed = Number((await readBody(req)).mult) || serverMult;
    const effective = Math.min(claimed, serverMult);
    if (effective >= g.crashPoint) { // busted before cashing out
      recordPlay(p, g.bet, 0); save();
      return (sendJson(res, 200, { busted: true, crashPoint: g.crashPoint, profile: publicProfile(cid) }), true);
    }
    const payout = Math.floor(g.bet * effective);
    p.coins += payout;
    if (effective > (p.stats.crashBest || 0)) p.stats.crashBest = effective;
    recordPlay(p, g.bet, payout); save();
    sendJson(res, 200, { busted: false, mult: effective, crashPoint: g.crashPoint, payout, win: payout - g.bet, profile: publicProfile(cid) }); return true;
  }
  // Reveal the bust point so the client can stop the rocket when a player sits idle.
  if (path === '/api/casino/crash/bust' && req.method === 'POST') {
    const g = crash[cid];
    if (!g) return (sendJson(res, 200, { error: 'no-game' }), true);
    if (!g.done) { g.done = true; recordPlay(p, g.bet, 0); save(); }
    sendJson(res, 200, { busted: true, crashPoint: g.crashPoint, profile: publicProfile(cid) }); return true;
  }

  // ---- tip / gift coins to another player ----
  if (path === '/api/casino/tip' && req.method === 'POST') {
    const body = await readBody(req);
    let amount = Math.floor(Number(body.amount) || 0);
    const toCid = String(body.toCid || '').slice(0, 64);
    const toNick = String(body.to || '').trim().toLowerCase();
    if (amount < 1) return (sendJson(res, 200, { error: 'bad-amount' }), true);
    if (amount > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    // Resolve recipient: prefer exact cid, else first matching nick.
    let rid = toCid && casino.users[toCid] ? toCid : null;
    if (!rid && toNick) rid = Object.keys(casino.users).find((id) => (casino.users[id].nick || '').toLowerCase() === toNick) || null;
    if (!rid) return (sendJson(res, 200, { error: 'no-recipient' }), true);
    if (rid === cid) return (sendJson(res, 200, { error: 'self' }), true);
    p.coins -= amount; casino.users[rid].coins += amount;
    p.stats.tipped = (p.stats.tipped || 0) + amount;
    save(); flush();
    sendJson(res, 200, { ok: true, amount, toNick: casino.users[rid].nick || 'player', profile: publicProfile(cid) }); return true;
  }
  // ---- gift a cosmetic you own to another player (transfers ownership) ----
  if (path === '/api/casino/gift' && req.method === 'POST') {
    const body = await readBody(req);
    const itemId = String(body.itemId || '');
    const toCid = String(body.toCid || '').slice(0, 64);
    const it = storeItem(itemId);
    if (!it) return (sendJson(res, 200, { error: 'bad-item' }), true);
    if (!p.inventory.includes(itemId)) return (sendJson(res, 200, { error: 'not-owned' }), true);
    const rid = toCid && casino.users[toCid] ? toCid : null;
    if (!rid) return (sendJson(res, 200, { error: 'no-recipient' }), true);
    if (rid === cid) return (sendJson(res, 200, { error: 'self' }), true);
    const rp = casino.users[rid];
    if (rp.inventory.includes(itemId)) return (sendJson(res, 200, { error: 'already-owns' }), true);
    p.inventory = p.inventory.filter((x) => x !== itemId);
    if (p.tag === it.label) p.tag = '';
    if (p.color === it.value) p.color = '';
    if (p.banner === it.value) p.banner = '';
    if (p.avatarFx === it.value) p.avatarFx = '';
    rp.inventory.push(itemId);
    save(); flush();
    sendJson(res, 200, { ok: true, itemId, toNick: rp.nick || 'player', profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/leaderboard') {
    const top = Object.entries(casino.users).map(([id, u]) => ({ id, nick: u.nick || '', coins: u.coins, biggest: u.stats.biggest, mine: id === cid }))
      .sort((a, b) => b.coins - a.coins).slice(0, 20);
    sendJson(res, 200, { top, you: { nick: p.nick || nick, coins: p.coins } }); return true;
  }

  sendJson(res, 404, { error: 'unknown' }); return true;
}

// ============================================================
// ACHIEVEMENTS — computed from persisted casino stats + chat activity.
// Feeds the Achievements tab (/api/achievements).
// ============================================================
const ACH = [
  { id: 'first_bet', name: 'First Bet', desc: 'Play your first casino game', rarity: 'common', icon: 'Dice5', color: '#9aa7bd', target: 1, unit: 'games', stat: (p) => p.stats.plays },
  { id: 'warmup', name: 'Warming Up', desc: 'Play 25 casino games', rarity: 'common', icon: 'Gamepad2', color: '#9aa7bd', target: 25, unit: 'games', stat: (p) => p.stats.plays },
  { id: 'grinder', name: 'Grinder', desc: 'Play 200 casino games', rarity: 'uncommon', icon: 'Flame', color: '#4cc9f0', target: 200, unit: 'games', stat: (p) => p.stats.plays },
  { id: 'daily', name: 'Daily Ritual', desc: 'Claim your daily Scrolls', rarity: 'common', icon: 'Timer', color: '#9aa7bd', target: 1, unit: '', stat: (p) => (p.lastDaily > 0 ? 1 : 0) },
  { id: 'tenk', name: 'Ten-K Club', desc: 'Reach 10,000 Scrolls', rarity: 'uncommon', icon: 'Star', color: '#4cc9f0', target: 10000, unit: 'Scrolls', stat: (p) => p.stats.peak },
  { id: 'fiftyk', name: 'High Roller', desc: 'Reach 50,000 Scrolls', rarity: 'rare', icon: 'Medal', color: '#5c7cfa', target: 50000, unit: 'Scrolls', stat: (p) => p.stats.peak },
  { id: 'hundredk', name: 'Scroll Baron', desc: 'Reach 100,000 Scrolls', rarity: 'epic', icon: 'Crown', color: '#b185ff', target: 100000, unit: 'Scrolls', stat: (p) => p.stats.peak },
  { id: 'jackpot', name: 'Jackpot!', desc: 'Win 5,000+ in a single game', rarity: 'rare', icon: 'Sparkles', color: '#5c7cfa', target: 5000, unit: 'Scrolls', stat: (p) => p.stats.biggest },
  { id: 'legendluck', name: 'Legendary Luck', desc: 'Win 25,000+ in a single game', rarity: 'legendary', icon: 'Trophy', color: '#ffb14e', target: 25000, unit: 'Scrolls', stat: (p) => p.stats.biggest },
  { id: 'caseopener', name: 'Case Opener', desc: 'Open 10 cases', rarity: 'uncommon', icon: 'Rocket', color: '#4cc9f0', target: 10, unit: 'cases', stat: (p) => p.stats.casesOpened || 0 },
  { id: 'casehardened', name: 'Case Hardened', desc: 'Open 100 cases', rarity: 'epic', icon: 'FlaskConical', color: '#b185ff', target: 100, unit: 'cases', stat: (p) => p.stats.casesOpened || 0 },
  { id: 'collector', name: 'Fashionista', desc: 'Own 3 items from the store', rarity: 'uncommon', icon: 'Palette', color: '#4cc9f0', target: 3, unit: 'items', stat: (p) => p.inventory.length },
  { id: 'whale', name: 'Whale', desc: 'Wager 100,000 Scrolls total', rarity: 'epic', icon: 'Globe', color: '#b185ff', target: 100000, unit: 'Scrolls', stat: (p) => p.stats.wagered },
  { id: 'tothemoon', name: 'To The Moon', desc: 'Cash out a 10x on Crash', rarity: 'epic', icon: 'Rocket', color: '#b185ff', target: 10, unit: 'x', stat: (p) => Math.floor(p.stats.crashBest || 0) },
  { id: 'generous', name: 'Generous', desc: 'Tip 10,000 Scrolls to others', rarity: 'rare', icon: 'Gift', color: '#5c7cfa', target: 10000, unit: 'Scrolls', stat: (p) => p.stats.tipped || 0 },
  { id: 'sayhi', name: 'Say Hi', desc: 'Send your first chat message', rarity: 'common', icon: 'MessageCircle', color: '#9aa7bd', target: 1, unit: '', stat: (p, x) => x.chatMsgs },
  { id: 'chatterbox', name: 'Chatterbox', desc: 'Send 100 chat messages', rarity: 'uncommon', icon: 'Bot', color: '#4cc9f0', target: 100, unit: 'messages', stat: (p, x) => x.chatMsgs },
];
export function buildAchievements(cid, extra) {
  const p = (cid && casino.users[cid]) ? casino.users[cid] : blankProfile();
  if (!p.stats.casesOpened) p.stats.casesOpened = 0;
  if (!p.stats.peak) p.stats.peak = p.coins;
  const x = extra || { chatMsgs: 0 };
  const achievements = ACH.map((a) => {
    const cur = Math.max(0, Math.floor(a.stat(p, x) || 0));
    const unlocked = cur >= a.target;
    return {
      id: a.id, name: a.name, desc: a.desc, rarity: a.rarity, icon: a.icon, color: a.color,
      unlocked, unlockedAt: null,
      progress: unlocked ? null : { current: Math.min(cur, a.target), target: a.target, unit: a.unit },
    };
  });
  return {
    achievements,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    total: ACH.length,
    stats: { timeMs: 0, gamesPlayed: p.stats.plays, uniqueGames: 0, vmSessions: 0 },
  };
}

function settleBj(cid) {
  const g = bj[cid]; if (!g) return;
  const p = profileOf(cid);
  // dealer plays it safe — stands on 16 (weaker than a real-casino dealer)
  while (handValue(g.dealer) < 16) g.dealer.push(g.deck.pop());
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

// ============================================================
// CS2-style CASE BATTLES — real-time multiplayer over WebSocket.
// Everyone opens the same case each round; highest total value wins the
// whole pot. Empty seats can be filled by bots so nobody waits forever.
// ============================================================
const battleWss = new WebSocketServer({ noServer: true });
const battles = new Map(); // id -> battle
const lobbyClients = new Set(); // ws of players not in a battle (see the lobby)

function bid() { return 'b' + Math.random().toString(36).slice(2, 8); }
function bSend(ws, o) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (e) {} }
function battlePublic(b) {
  return {
    id: b.id, caseId: b.caseId, caseName: CASES[b.caseId].name, price: CASES[b.caseId].price,
    rounds: b.rounds, maxPlayers: b.maxPlayers, cost: CASES[b.caseId].price * b.rounds,
    state: b.state, round: b.round,
    players: b.players.map((p) => ({ cid: p.cid, nick: p.nick, bot: !!p.bot, total: p.total, pulls: p.pulls })),
    winner: b.winner || null, pot: b.pot,
  };
}
function lobbyList() {
  return [...battles.values()].filter((b) => b.state === 'waiting')
    .map((b) => ({ id: b.id, caseName: CASES[b.caseId].name, players: b.players.length, maxPlayers: b.maxPlayers, rounds: b.rounds, cost: CASES[b.caseId].price * b.rounds }));
}
function broadcastLobby() { const msg = { t: 'lobby', battles: lobbyList() }; for (const ws of lobbyClients) bSend(ws, msg); }
function broadcastBattle(b, msg) { for (const p of b.players) if (p.ws) bSend(p.ws, msg); }

function leaveBattle(ws) {
  const b = ws._battle; if (!b) return;
  ws._battle = null;
  const idx = b.players.findIndex((p) => p.ws === ws);
  if (idx < 0) return;
  const pl = b.players[idx];
  if (b.state === 'waiting') {
    // refund and remove
    const prof = profileOf(pl.cid); if (prof) { prof.coins += CASES[b.caseId].price * b.rounds; save(); bSend(ws, { t: 'coins', coins: prof.coins }); }
    b.players.splice(idx, 1);
    if (b.players.length === 0) battles.delete(b.id);
    else broadcastBattle(b, { t: 'state', battle: battlePublic(b) });
    broadcastLobby();
  } else {
    pl.ws = null; // keep seat; they already paid and rolls continue
  }
  lobbyClients.add(ws);
  bSend(ws, { t: 'lobby', battles: lobbyList() });
}

function startBattle(b) {
  if (b.state !== 'waiting') return;
  // fill empty seats with bots
  while (b.players.length < b.maxPlayers) b.players.push({ cid: 'bot-' + Math.random().toString(36).slice(2, 6), nick: 'Bot', bot: true, total: 0, pulls: [], ws: null });
  b.state = 'rolling'; b.round = 0; b.pot = 0;
  broadcastLobby();
  broadcastBattle(b, { t: 'state', battle: battlePublic(b) });
  const def = CASES[b.caseId];
  const doRound = () => {
    if (b.round >= b.rounds) return finishBattle(b);
    b.round++;
    const results = b.players.map((p) => {
      const item = openCase(def);
      p.pulls.push(item.v); p.total += item.v; b.pot += item.v;
      return { cid: p.cid, nick: p.nick, bot: !!p.bot, v: item.v, r: item.r, total: p.total };
    });
    broadcastBattle(b, { t: 'roll', round: b.round, rounds: b.rounds, results, pot: b.pot });
    setTimeout(doRound, 4800);
  };
  setTimeout(doRound, 1200);
}
function finishBattle(b) {
  b.state = 'done';
  const max = Math.max(...b.players.map((p) => p.total));
  const winners = b.players.filter((p) => p.total === max);
  const share = Math.floor(b.pot / winners.length);
  for (const w of winners) {
    if (!w.bot) { const prof = profileOf(w.cid); if (prof) { prof.coins += share; prof.stats.biggest = Math.max(prof.stats.biggest, share); save(); if (w.ws) bSend(w.ws, { t: 'coins', coins: prof.coins }); } }
  }
  b.winner = { cids: winners.map((w) => w.cid), nicks: winners.map((w) => w.nick), share };
  broadcastBattle(b, { t: 'done', battle: battlePublic(b), winner: b.winner, pot: b.pot });
  // free clients back to lobby after a bit
  setTimeout(() => {
    for (const p of b.players) if (p.ws) { p.ws._battle = null; lobbyClients.add(p.ws); bSend(p.ws, { t: 'lobby', battles: lobbyList() }); }
    battles.delete(b.id); broadcastLobby();
  }, 9000);
}

export function handleBattleUpgrade(req, socket, head) {
  battleWss.handleUpgrade(req, socket, head, (ws) => {
    const { cid, nick } = who(req);
    ws._cid = cid; ws._nick = nick || 'Guest'; ws._battle = null;
    lobbyClients.add(ws);
    bSend(ws, { t: 'hello', cid, nick: ws._nick });
    bSend(ws, { t: 'lobby', battles: lobbyList() });

    ws.on('message', (buf) => {
      let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
      if (!m || !m.t) return;
      if (!ws._cid) { bSend(ws, { t: 'error', msg: 'Log in to ScrollHub first.' }); return; }

      if (m.t === 'create') {
        if (ws._battle) return;
        const caseId = String(m.caseId || '');
        if (!CASES[caseId]) return bSend(ws, { t: 'error', msg: 'Unknown case' });
        const maxPlayers = Math.max(2, Math.min(4, Number(m.players) || 2));
        const rounds = Math.max(1, Math.min(6, Number(m.rounds) || 3));
        const cost = CASES[caseId].price * rounds;
        const prof = profileOf(ws._cid);
        if (prof.coins < cost) return bSend(ws, { t: 'error', msg: 'Not enough coins (need ' + cost + ')' });
        prof.coins -= cost; save(); bSend(ws, { t: 'coins', coins: prof.coins });
        const b = { id: bid(), caseId, maxPlayers, rounds, state: 'waiting', round: 0, pot: 0, players: [], winner: null };
        b.players.push({ cid: ws._cid, nick: ws._nick, total: 0, pulls: [], ws });
        battles.set(b.id, b);
        ws._battle = b; lobbyClients.delete(ws);
        bSend(ws, { t: 'state', battle: battlePublic(b) });
        broadcastLobby();
        return;
      }
      if (m.t === 'join') {
        if (ws._battle) return;
        const b = battles.get(String(m.id || ''));
        if (!b || b.state !== 'waiting') return bSend(ws, { t: 'error', msg: 'Battle not available' });
        if (b.players.length >= b.maxPlayers) return bSend(ws, { t: 'error', msg: 'Battle full' });
        const cost = CASES[b.caseId].price * b.rounds;
        const prof = profileOf(ws._cid);
        if (prof.coins < cost) return bSend(ws, { t: 'error', msg: 'Not enough coins (need ' + cost + ')' });
        prof.coins -= cost; save(); bSend(ws, { t: 'coins', coins: prof.coins });
        b.players.push({ cid: ws._cid, nick: ws._nick, total: 0, pulls: [], ws });
        ws._battle = b; lobbyClients.delete(ws);
        broadcastBattle(b, { t: 'state', battle: battlePublic(b) });
        broadcastLobby();
        if (b.players.length >= b.maxPlayers) startBattle(b);
        return;
      }
      if (m.t === 'start') { // creator starts early, bots fill the rest
        const b = ws._battle;
        if (b && b.state === 'waiting' && b.players[0] && b.players[0].ws === ws) startBattle(b);
        return;
      }
      if (m.t === 'leave') { leaveBattle(ws); return; }
      if (m.t === 'lobby') { lobbyClients.add(ws); bSend(ws, { t: 'lobby', battles: lobbyList() }); return; }
    });

    ws.on('close', () => { lobbyClients.delete(ws); leaveBattle(ws); });
    ws.on('error', () => {});
  });
}
