// ============================================================
// ScrollHub Casino — a coins game app (Blackjack, Slots, Coinflip,
// case opening) with a cosmetics store that shows up in chat.
// Self-contained: own persistence (tmp + Upstash KV) and HTTP API.
// Identity = sh_cid / sh_nick cookies (same as chat).
// ============================================================
import fs from 'node:fs';
import { WebSocketServer } from 'ws';
import { handleMore, liveSnap, liveRestore } from './casinomore.js';
import './dist/arcade/bannergen.js'; // sets globalThis.SHBanner (custom banners from the Sprite Studio)

const CASINO_FILE = '/tmp/scrollhub-casino.json';
const START_COINS = 1000;
const DAILY_COINS = 750;
const DAILY_MS = 20 * 3600 * 1000; // claimable every 20h
const GOTD_BONUS = 1500; // coin bonus for playing the Game of the Day (once/day)

// ---- durable storage (mirrors server.js pattern) ----
const KV_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const kvEnabled = !!(KV_URL && KV_TOKEN);
export async function kvGet(key) {
  if (!kvEnabled) return null;
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(['GET', key]) });
  if (!r.ok) throw new Error('kv get ' + r.status);
  const j = await r.json();
  return j && typeof j.result === 'string' ? j.result : null;
}
export async function kvSet(key, value) {
  if (!kvEnabled) return;
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(['SET', key, value]) });
  if (!r.ok) throw new Error('kv set ' + r.status);
}

const casino = { users: {}, gotd: null, codes: {}, tour: null, custom: [], rigs: [], rigLog: [], cfg: { closed: false, maxBet: 0, minBet: 0, maxPayout: 0, games: {} } }; // cid -> profile; gotd override; event codes; weekly tournament
const TUT_PLAYS = 3, TUT_REWARD = 1000000, TUT_VER = 2;
// Owner-adjustable tour settings (admin panel > Site controls): on/off, reward, and a version that replays it for everyone.
const tutOn = () => !(casino.cfg && casino.cfg.tutOn === false);
const tutReward = () => { const v = casino.cfg && casino.cfg.tutReward; return Number.isFinite(v) && v >= 0 ? Math.floor(v) : TUT_REWARD; };
const tutVer = () => Math.max(TUT_VER, (casino.cfg && casino.cfg.tutVer) | 0); // tutorial: casino rounds required, one-time Scroll reward
function blankProfile() {
  return { coins: (casino.cfg && casino.cfg.startCoins) || START_COINS, lastDaily: 0, streak: 0, gotdClaimed: '', weekNet: 0, weekKey: '', nick: '', inventory: [], tag: '', color: '', banner: '', avatarFx: '', titleFx: '', avatar: '', banner_url: '', profile_color: '', profile_public: true, look: { skin: 'skin_gim', body: 'body_sky', hat: '', acc: '', trail: '' }, stats: { wagered: 0, won: 0, biggest: 0, plays: 0, casesOpened: 0, peak: START_COINS, crashBest: 0, tipped: 0 } };
}
// Uploaded images live at /ci/<id>.<ext> on every server (shared KV). Old uploads were
// saved with the full address of whatever link they were uploaded on, which breaks when
// someone visits on a different link — so always store/serve the relative path.
export function relImg(u) {
  const s = String(u || '');
  const m = s.match(/^(?:https?:)?\/\/[^/]+(\/ci\/[A-Za-z0-9]+\.[A-Za-z0-9]+)(?:[?#].*)?$/);
  return m ? m[1] : s;
}
function fixImgs(p) { if (p) { if (p.avatar) p.avatar = relImg(p.avatar); if (p.banner_url) p.banner_url = relImg(p.banner_url); } }
function load(raw) { try { const d0 = JSON.parse(raw); if (d0 && Array.isArray(d0.custom)) { casino.custom = d0.custom; syncCustomStore(); } } catch (e) {} try { const d = JSON.parse(raw); if (d && d.users) { casino.users = d.users; for (const k in casino.users) fixImgs(casino.users[k]); } if (d && 'gotd' in d) casino.gotd = d.gotd; if (d && d.codes) casino.codes = d.codes; if (d && d.tour) casino.tour = d.tour; if (d && d.jackpot) casino.jackpot = d.jackpot; if (d && Array.isArray(d.rigs)) casino.rigs = d.rigs; if (d && Array.isArray(d.rigLog)) casino.rigLog = d.rigLog; if (d && d.cfg) casino.cfg = { closed: false, maxBet: 0, minBet: 0, maxPayout: 0, games: {}, ...d.cfg, games: { ...(d.cfg.games || {}) } }; } catch (e) {} }
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
let rigDry = false, rigPlays = null, rigPending = []; // owner rigging tool: see the Rigging section
function blob() { return JSON.stringify({ users: casino.users, gotd: casino.gotd, codes: casino.codes, tour: casino.tour, jackpot: casino.jackpot, custom: casino.custom, cfg: casino.cfg, rigs: casino.rigs, rigLog: casino.rigLog.slice(-120) }); }
function save() { dirty = true; if (rigDry) return; try { fs.writeFileSync(CASINO_FILE, blob()); } catch (e) {} }
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
  if (!p) return { tag: '', color: '', banner: '', avatarFx: '', titleFx: '', avatar: '' };
  return { tag: p.tag || '', color: p.color || '', banner: banOut(p.banner), avatarFx: p.avatarFx || '', titleFx: p.titleFx || '', avatar: relImg(p.avatar) };
}
// Profile picture / banner image + public-profile meta (set from the account page).
export function setProfileImage(cid, kind, url) {
  if (!cid) return null;
  const p = profileOf(cid);
  if (kind === 'avatar') p.avatar = relImg(url);
  else if (kind === 'banner') p.banner_url = relImg(url);
  save(); flush();
  return p;
}
export function setProfileMeta(cid, meta) {
  if (!cid) return null;
  const p = profileOf(cid);
  if (typeof meta.profile_color === 'string') p.profile_color = meta.profile_color.slice(0, 32);
  if (typeof meta.profile_public === 'boolean') p.profile_public = meta.profile_public;
  save(); flush();
  return p;
}
export function getProfileMeta(cid) {
  const p = casino.users[cid];
  if (!p) return { avatar_url: '', banner_url: '', profile_color: '', profile_public: true };
  return { avatar_url: relImg(p.avatar), banner_url: relImg(p.banner_url), profile_color: p.profile_color || '', profile_public: p.profile_public !== false };
}
// Admin: add (or remove, if negative) Scrolls for a player by client id.

// ---- Owner tools: casino limits, per-game switches, store item controls, player operations ----
export const GAME_LIST = [
  ['slots', 'Slots'], ['coinflip', 'Coinflip'], ['dice', 'Dice'], ['roulette', 'Roulette'], ['plinko', 'Plinko'], ['wheel', 'Big Wheel'], ['blackjack', 'Blackjack'], ['mines', 'Mines'], ['crash', 'Crash'], ['cases', 'Cases'],
  ['keno', 'Keno'], ['scratch', 'Scratch Cards'], ['baccarat', 'Baccarat'], ['shell', 'Shell Game'], ['penalty', 'Penalty Shootout'], ['war', 'Casino War'], ['hilo', 'Hi-Lo'], ['poker', 'Video Poker'],
];
function cfgNorm() { const c = casino.cfg; c.games = c.games || {}; c.items = c.items || {}; return c; }
export function casinoCfgGet() {
  const c = cfgNorm();
  return { cfg: { closed: !!c.closed, minBet: c.minBet || 0, maxBet: c.maxBet || 0, maxPayout: c.maxPayout || 0, dailyCoins: c.dailyCoins || 0, startCoins: c.startCoins || 0, games: c.games, items: c.items }, defaults: { dailyCoins: DAILY_COINS, startCoins: START_COINS }, games: GAME_LIST.map((g) => ({ id: g[0], name: g[1] })),
    items: STORE.filter((it) => !it.staff && it.price > 0).map((it) => ({ id: it.id, label: it.label, type: it.type, price: it.price, rarity: it.rarity || '' })) };
}
export function casinoCfgSet(a) {
  const c = cfgNorm(); const n = (v, hi) => Math.max(0, Math.min(hi, Math.floor(Number(v)) || 0));
  if (a.closed !== undefined) c.closed = !!a.closed;
  if (a.minBet !== undefined) c.minBet = n(a.minBet, 1e9);
  if (a.maxBet !== undefined) c.maxBet = n(a.maxBet, 1e12);
  if (a.maxPayout !== undefined) c.maxPayout = n(a.maxPayout, 1e12);
  if (a.dailyCoins !== undefined) c.dailyCoins = n(a.dailyCoins, 1e7);
  if (a.startCoins !== undefined) c.startCoins = n(a.startCoins, 1e9);
  if (a.game && a.game.id) {
    if (!GAME_LIST.some((g) => g[0] === a.game.id)) return { error: 'bad-game' };
    const g = (c.games[a.game.id] = c.games[a.game.id] || {});
    if (a.game.off !== undefined) g.off = !!a.game.off;
    if (a.game.min !== undefined) g.min = n(a.game.min, 1e9);
    if (a.game.max !== undefined) g.max = n(a.game.max, 1e12);
    if (!g.off && !g.min && !g.max) delete c.games[a.game.id];
  }
  if (a.item && a.item.id) {
    const it = STORE.find((x) => x.id === a.item.id); if (!it || it.staff) return { error: 'bad-item' };
    const o = (c.items[it.id] = c.items[it.id] || {});
    if (a.item.off !== undefined) o.off = !!a.item.off;
    if (a.item.price !== undefined) { if (a.item.price === '' || a.item.price === null) delete o.price; else o.price = n(a.item.price, 1e9); }
    if (!o.off && o.price == null) delete c.items[it.id];
  }
  save(); flush(); return { ok: true };
}
// Player operations. `mod` ops are safe for moderators; the rest touch the economy and are owner only.
export const PLAYER_OPS = {
  'coins.set': { eco: 1, arg: 'number', run: (p, v) => { p.coins = Math.max(0, Math.min(1e12, Math.floor(v))); } },
  'coins.add': { eco: 1, arg: 'number', run: (p, v) => { p.coins = Math.max(0, Math.min(1e12, p.coins + Math.floor(v))); } },
  'coins.take': { eco: 1, arg: 'number', run: (p, v) => { p.coins = Math.max(0, p.coins - Math.floor(Math.abs(v))); } },
  'coins.reset': { eco: 1, run: (p) => { p.coins = (casino.cfg && casino.cfg.startCoins) || START_COINS; } },
  'coins.zero': { eco: 1, run: (p) => { p.coins = 0; } },
  'coins.double': { eco: 1, run: (p) => { p.coins = Math.min(1e12, p.coins * 2); } },
  'coins.halve': { eco: 1, run: (p) => { p.coins = Math.floor(p.coins / 2); } },
  'streak.set': { eco: 1, arg: 'number', run: (p, v) => { p.streak = Math.max(0, Math.min(1000, Math.floor(v))); } },
  'streak.clear': { eco: 1, run: (p) => { p.streak = 0; } },
  'stats.reset': { eco: 1, run: (p) => { p.stats = { plays: 0, won: 0, biggest: 0, wagered: 0, peak: p.coins }; } },
  'weekly.reset': { eco: 1, run: (p) => { p.weekNet = 0; } },
  'peak.reset': { eco: 1, run: (p) => { if (p.stats) p.stats.peak = p.coins; } },
  'tag.clear': { run: (p) => { p.tag = ''; p.titleFx = ''; } },
  'color.clear': { run: (p) => { p.color = ''; } },
  'banner.clear': { run: (p) => { p.banner = ''; } },
  'avatarfx.clear': { run: (p) => { p.avatarFx = ''; } },
  'titlefx.clear': { run: (p) => { p.titleFx = ''; } },
  'avatar.clear': { run: (p) => { p.avatar = ''; } },
  'bannerimage.clear': { run: (p) => { p.banner_url = ''; } },
  'look.reset': { run: (p) => { p.look = { ...LOOK_DEFAULT }; } },
  'cosmetics.clear': { run: (p) => { p.tag = ''; p.titleFx = ''; p.color = ''; p.banner = ''; p.avatarFx = ''; p.avatar = ''; p.banner_url = ''; p.look = { ...LOOK_DEFAULT }; } },
  'profile.private': { run: (p) => { p.profile_public = false; } },
  'profile.public': { run: (p) => { p.profile_public = true; } },
  'nick.clear': { run: (p) => { p.nick = ''; } },
};
export function adminPlayerOp(cid, op, val, owner) {
  const o = PLAYER_OPS[op]; if (!o) return { error: 'bad-op' };
  if (o.eco && !owner) return { error: 'owner only' };
  if (o.arg === 'number' && !Number.isFinite(Number(val))) return { error: 'bad-value', message: 'That needs a number.' };
  const p = profileOf(cid); o.run(p, Number(val)); save(); flush();
  return { ok: true, coins: p.coins };
}
export function hasProfile(cid) { return !!(cid && casino.users[cid]); }
export function grantCoins(cid, amount) {
  if (!cid) return null;
  const p = profileOf(cid);
  p.coins = Math.max(0, Math.floor(p.coins + (Number(amount) || 0)));
  if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
  save(); flush();
  return p.coins;
}

// ---- staff panel helpers (no HTTP here; server.js checks the caller's role first) ----
export function adminStoreList() { return STORE.map((it) => ({ id: it.id, type: it.type, label: it.label, price: it.price, rarity: it.rarity || 'common' })); }
export function adminProfile(cid) {
  if (!cid) return null;
  const p = profileOf(cid);
  return { coins: p.coins, streak: p.streak || 0, lastDaily: p.lastDaily || 0, inventory: p.inventory.slice(), tag: p.tag || '', color: p.color || '', look: { ...ensureLook(p) }, stats: { ...p.stats }, nick: p.nick || '' };
}
export function adminSetCoins(cid, amount) {
  const p = profileOf(cid); if (!p) return null;
  p.coins = Math.max(0, Math.min(1e12, Math.floor(Number(amount) || 0)));
  if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
  save(); flush(); return p.coins;
}
export function adminGiveItem(cid, itemId) {
  const it = STORE.find((x) => x.id === itemId); const p = profileOf(cid);
  if (!it || !p) return null;
  if (!p.inventory.includes(itemId)) p.inventory.push(itemId);
  save(); flush(); return p.inventory.slice();
}
export function adminGiveAllItems(cid) {
  const p = profileOf(cid); if (!p) return null;
  for (const it of STORE) if (!it.staff && !p.inventory.includes(it.id)) p.inventory.push(it.id);
  save(); flush(); return p.inventory.slice();
}
export function adminTakeItem(cid, itemId) {
  const p = profileOf(cid); if (!p) return null;
  p.inventory = p.inventory.filter((x) => x !== itemId);
  const gone = STORE.find((x) => x.id === itemId);
  if (gone && gone.type === 'tag' && p.tag === gone.label) { p.tag = ''; if (gone.staff) p.titleFx = ''; }
  save(); flush(); return p.inventory.slice();
}
export function adminClearInventory(cid) {
  const p = profileOf(cid); if (!p) return null;
  p.inventory = []; p.tag = ''; p.color = '';
  save(); flush(); return [];
}
export function adminSetField(cid, field, value) {
  const p = profileOf(cid); if (!p) return null;
  if (field === 'streak') p.streak = Math.max(0, Math.min(100000, Math.floor(Number(value) || 0)));
  else if (field === 'dailyReady') p.lastDaily = 0;
  else return null;
  save(); flush(); return true;
}
export function adminResetProfile(cid) {
  if (!cid || !casino.users[cid]) return null;
  casino.users[cid] = blankProfile(); save(); flush(); return true;
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

// ---- weekly tournament (ranked by net Scrolls won this week) ----
function currentWeekKey() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10); // the week's Monday (UTC)
}
function weekEndsAt(weekKey) { return Date.parse(weekKey + 'T00:00:00Z') + 7 * 86400000; }
function ensureTour() { if (!casino.tour) casino.tour = { weekKey: currentWeekKey(), prizes: [50000, 25000, 10000], lastWinners: [] }; return casino.tour; }
function ensureWeek(p) { const cur = currentWeekKey(); if (p.weekKey !== cur) { p.weekKey = cur; p.weekNet = 0; } }
// At week rollover, pay the top 3 of the week that just ended.
function checkTournamentRollover() {
  const t = ensureTour();
  const cur = currentWeekKey();
  if (t.weekKey === cur) return;
  const ending = t.weekKey;
  const ranked = Object.values(casino.users)
    .filter((u) => u.weekKey === ending && (u.weekNet || 0) > 0)
    .sort((a, b) => (b.weekNet || 0) - (a.weekNet || 0))
    .slice(0, 3);
  const winners = [];
  ranked.forEach((u, i) => {
    const prize = t.prizes[i] || 0;
    if (prize > 0) { u.coins += prize; if (u.coins > (u.stats.peak || 0)) u.stats.peak = u.coins; }
    winners.push({ nick: u.nick || 'player', net: u.weekNet || 0, prize });
  });
  t.lastWinners = winners;
  t.weekKey = cur;
  save(); flush();
}
export function tournamentState(cid) {
  const t = ensureTour();
  const cur = currentWeekKey();
  const rows = Object.entries(casino.users)
    .filter(([id, u]) => u.weekKey === cur && (u.weekNet || 0) > 0)
    .map(([id, u]) => ({ id, nick: u.nick || 'player', net: u.weekNet || 0, mine: id === cid }))
    .sort((a, b) => b.net - a.net);
  const youIdx = rows.findIndex((r) => r.mine);
  const me = cid && casino.users[cid] && casino.users[cid].weekKey === cur ? (casino.users[cid].weekNet || 0) : 0;
  return {
    prizes: t.prizes, endsAt: weekEndsAt(cur), weekKey: cur,
    top: rows.slice(0, 15),
    you: { rank: youIdx >= 0 ? youIdx + 1 : null, net: me },
    lastWinners: t.lastWinners || [],
  };
}
// Public profile card data for /api/user/:username.
export function publicUserCard(cid) {
  const p = casino.users[cid];
  if (!p) return null;
  const cur = currentWeekKey();
  return {
    coins: p.coins,
    stats: {
      plays: p.stats.plays || 0, won: p.stats.won || 0, biggest: p.stats.biggest || 0,
      wagered: p.stats.wagered || 0, peak: p.stats.peak || p.coins,
      crashBest: p.stats.crashBest || 0, casesOpened: p.stats.casesOpened || 0, tipped: p.stats.tipped || 0,
    },
    cosmetics: { color: p.color || '', title: p.tag || '', titleFx: p.titleFx || '', banner: banOut(p.banner), avatarFx: p.avatarFx || '' },
    weekNet: p.weekKey === cur ? (p.weekNet || 0) : 0,
  };
}
// Rank (1-based) of a player on the richest-players board, or null.
export function coinRank(cid) {
  const u = casino.users[cid]; if (!u) return null;
  let rank = 1; for (const id in casino.users) { if (casino.users[id].coins > u.coins) rank++; }
  return rank;
}

export function setTourPrizes(p1, p2, p3) {
  const t = ensureTour();
  t.prizes = [Math.max(0, Math.floor(Number(p1) || 0)), Math.max(0, Math.floor(Number(p2) || 0)), Math.max(0, Math.floor(Number(p3) || 0))];
  save(); flush();
  return t.prizes;
}
// Admin: end the current week now (pay out and start a fresh week).
export function endTournamentNow() {
  const t = ensureTour();
  const ending = t.weekKey;
  const ranked = Object.values(casino.users).filter((u) => u.weekKey === ending && (u.weekNet || 0) > 0).sort((a, b) => (b.weekNet || 0) - (a.weekNet || 0)).slice(0, 3);
  const winners = [];
  ranked.forEach((u, i) => { const prize = t.prizes[i] || 0; if (prize > 0) { u.coins += prize; if (u.coins > (u.stats.peak || 0)) u.stats.peak = u.coins; } winners.push({ nick: u.nick || 'player', net: u.weekNet || 0, prize }); });
  t.lastWinners = winners;
  // Force a fresh week by clearing everyone's accumulator for the current key.
  for (const id in casino.users) { casino.users[id].weekNet = 0; casino.users[id].weekKey = currentWeekKey(); }
  t.weekKey = currentWeekKey();
  save(); flush();
  return winners;
}
setInterval(() => { try { checkTournamentRollover(); } catch (e) {} }, 60000);

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
  // Staff name tags: never sold, never in cases; an owner hands them out from the admin panel.
  { id: 'tag_staff_owner', type: 'tag', label: 'OWNER MAN', price: 0, rarity: 'mythic', staff: true, fx: 'gold' },
  { id: 'tag_staff_coowner', type: 'tag', label: 'CO OWNER MAN', price: 0, rarity: 'mythic', staff: true, fx: 'shimmer' },
  { id: 'tag_staff_admin', type: 'tag', label: 'ADMIN DUDE', price: 0, rarity: 'legendary', staff: true, fx: 'pulse' },
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
  { id: 'tag_TruePlonker', type: 'tag', label: 'TRUE PLONKER', price: 9999, rarity: 'mythic' },
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

  // ===== 2D casino world: character cosmetics (price 0 = free for everyone) =====
  // Character shapes
  { id: 'skin_gim', type: 'skin', label: 'Classic Gim', value: 'gim', price: 0, rarity: 'common' },
  { id: 'skin_cat', type: 'skin', label: 'Cat', value: 'cat', price: 0, rarity: 'common' },
  { id: 'skin_bear', type: 'skin', label: 'Bear', value: 'bear', price: 3000, rarity: 'common' },
  { id: 'skin_bunny', type: 'skin', label: 'Bunny', value: 'bunny', price: 4500, rarity: 'uncommon' },
  { id: 'skin_frog', type: 'skin', label: 'Frog', value: 'frog', price: 4500, rarity: 'uncommon' },
  { id: 'skin_penguin', type: 'skin', label: 'Penguin', value: 'penguin', price: 7500, rarity: 'rare' },
  { id: 'skin_robot', type: 'skin', label: 'Robot', value: 'robot', price: 9000, rarity: 'rare' },
  { id: 'skin_ghost', type: 'skin', label: 'Ghost', value: 'ghost', price: 15000, rarity: 'epic' },
  { id: 'skin_alien', type: 'skin', label: 'Alien', value: 'alien', price: 18000, rarity: 'epic' },
  { id: 'skin_dino', type: 'skin', label: 'Dino', value: 'dino', price: 30000, rarity: 'legendary' },
  { id: 'skin_imp', type: 'skin', label: 'Imp', value: 'imp', price: 60000, rarity: 'mythic' },
  { id: 'skin_fox', type: 'skin', label: 'Fox', value: 'fox', price: 0, rarity: 'common' },
  { id: 'skin_pig', type: 'skin', label: 'Piggy', value: 'pig', price: 2500, rarity: 'common' },
  { id: 'skin_duck', type: 'skin', label: 'Duck', value: 'duck', price: 3500, rarity: 'common' },
  { id: 'skin_panda', type: 'skin', label: 'Panda', value: 'panda', price: 5000, rarity: 'uncommon' },
  { id: 'skin_mushroom', type: 'skin', label: 'Mushroom', value: 'mushroom', price: 6000, rarity: 'uncommon' },
  { id: 'skin_slime', type: 'skin', label: 'Slime', value: 'slime', price: 6500, rarity: 'uncommon' },
  { id: 'skin_snowman', type: 'skin', label: 'Snowman', value: 'snowman', price: 8000, rarity: 'rare' },
  { id: 'skin_pumpkin', type: 'skin', label: 'Pumpkin', value: 'pumpkin', price: 8000, rarity: 'rare' },
  { id: 'skin_shark', type: 'skin', label: 'Shark', value: 'shark', price: 12000, rarity: 'rare' },
  { id: 'skin_octopus', type: 'skin', label: 'Octopus', value: 'octopus', price: 14000, rarity: 'epic' },
  { id: 'skin_skeleton', type: 'skin', label: 'Skeleton', value: 'skeleton', price: 16000, rarity: 'epic' },
  { id: 'skin_ninja', type: 'skin', label: 'Ninja', value: 'ninja', price: 20000, rarity: 'epic' },
  { id: 'skin_astro', type: 'skin', label: 'Astronaut', value: 'astro', price: 28000, rarity: 'legendary' },
  { id: 'skin_knight', type: 'skin', label: 'Knight', value: 'knight', price: 32000, rarity: 'legendary' },
  { id: 'skin_unicorn', type: 'skin', label: 'Unicorn', value: 'unicorn', price: 55000, rarity: 'mythic' },
  { id: 'skin_dragon', type: 'skin', label: 'Dragon', value: 'dragon', price: 90000, rarity: 'mythic' },
  // Body colors (hex) and animated materials (m:*)
  { id: 'body_sky', type: 'body', label: 'Sky', value: '#3fa9ff', price: 0, rarity: 'common' },
  { id: 'body_grass', type: 'body', label: 'Grass', value: '#3fd27a', price: 0, rarity: 'common' },
  { id: 'body_sun', type: 'body', label: 'Sunny', value: '#ffcc33', price: 0, rarity: 'common' },
  { id: 'body_coral', type: 'body', label: 'Coral', value: '#ff6b6b', price: 0, rarity: 'common' },
  { id: 'body_grape', type: 'body', label: 'Grape', value: '#9b6bff', price: 0, rarity: 'common' },
  { id: 'body_bubble', type: 'body', label: 'Bubblegum', value: '#ff8ad8', price: 0, rarity: 'common' },
  { id: 'body_snow', type: 'body', label: 'Snow', value: '#eef2ff', price: 0, rarity: 'common' },
  { id: 'body_coal', type: 'body', label: 'Charcoal', value: '#4a4f6a', price: 0, rarity: 'common' },
  { id: 'body_mint', type: 'body', label: 'Mint', value: '#5eead4', price: 2000, rarity: 'common' },
  { id: 'body_tang', type: 'body', label: 'Tangerine', value: '#ff922b', price: 2000, rarity: 'common' },
  { id: 'body_lav', type: 'body', label: 'Lavender', value: '#c4b5fd', price: 3500, rarity: 'uncommon' },
  { id: 'body_crim', type: 'body', label: 'Crimson', value: '#dc143c', price: 5000, rarity: 'rare' },
  { id: 'body_mid', type: 'body', label: 'Midnight', value: '#2a3a9a', price: 5000, rarity: 'rare' },
  { id: 'body_gold', type: 'body', label: 'Solid Gold', value: 'm:gold', price: 25000, rarity: 'legendary' },
  { id: 'body_chrome', type: 'body', label: 'Chrome', value: 'm:chrome', price: 30000, rarity: 'legendary' },
  { id: 'body_lava', type: 'body', label: 'Lava (animated)', value: 'm:lava', price: 40000, rarity: 'legendary' },
  { id: 'body_galaxy', type: 'body', label: 'Galaxy (animated)', value: 'm:galaxy', price: 50000, rarity: 'mythic' },
  { id: 'body_rainbow', type: 'body', label: 'Rainbow (animated)', value: 'm:rainbow', price: 75000, rarity: 'mythic' },
  // Hats
  { id: 'hat_cap', type: 'hat', label: 'Ball Cap', value: 'cap', price: 1500, rarity: 'common' },
  { id: 'hat_beanie', type: 'hat', label: 'Beanie', value: 'beanie', price: 2000, rarity: 'common' },
  { id: 'hat_party', type: 'hat', label: 'Party Hat', value: 'party', price: 2500, rarity: 'common' },
  { id: 'hat_phones', type: 'hat', label: 'Headphones', value: 'phones', price: 4000, rarity: 'uncommon' },
  { id: 'hat_chef', type: 'hat', label: 'Chef Hat', value: 'chef', price: 4000, rarity: 'uncommon' },
  { id: 'hat_cowboy', type: 'hat', label: 'Cowboy Hat', value: 'cowboy', price: 6000, rarity: 'rare' },
  { id: 'hat_prop', type: 'hat', label: 'Propeller Cap', value: 'prop', price: 6000, rarity: 'rare' },
  { id: 'hat_top', type: 'hat', label: 'Top Hat', value: 'top', price: 9000, rarity: 'rare' },
  { id: 'hat_viking', type: 'hat', label: 'Viking Helm', value: 'viking', price: 12000, rarity: 'epic' },
  { id: 'hat_wizard', type: 'hat', label: 'Wizard Hat', value: 'wizard', price: 15000, rarity: 'epic' },
  { id: 'hat_halo', type: 'hat', label: 'Halo (animated)', value: 'halo', price: 22000, rarity: 'epic' },
  { id: 'hat_horns', type: 'hat', label: 'Devil Horns', value: 'horns', price: 22000, rarity: 'epic' },
  { id: 'hat_crown', type: 'hat', label: 'Royal Crown', value: 'crown', price: 50000, rarity: 'legendary' },
  { id: 'hat_beret', type: 'hat', label: 'Beret', value: 'beret', price: 3000, rarity: 'common' },
  { id: 'hat_flowers', type: 'hat', label: 'Flower Crown', value: 'flowers', price: 5000, rarity: 'uncommon' },
  { id: 'hat_santa', type: 'hat', label: 'Santa Hat', value: 'santa', price: 6000, rarity: 'rare' },
  { id: 'hat_grad', type: 'hat', label: 'Grad Cap', value: 'grad', price: 7000, rarity: 'rare' },
  { id: 'hat_pirate', type: 'hat', label: 'Pirate Hat', value: 'pirate', price: 14000, rarity: 'epic' },
  { id: 'hat_antlers', type: 'hat', label: 'Antlers', value: 'antlers', price: 18000, rarity: 'epic' },
  { id: 'hat_flame', type: 'hat', label: 'Flame Crown (animated)', value: 'flame', price: 30000, rarity: 'legendary' },
  { id: 'hat_storm', type: 'hat', label: 'Storm Cloud (animated)', value: 'storm', price: 26000, rarity: 'epic' },
  { id: 'hat_ufo', type: 'hat', label: 'Tiny UFO (animated)', value: 'ufo', price: 28000, rarity: 'legendary' },
  { id: 'hat_orbit', type: 'hat', label: 'Planet Orbit (animated)', value: 'orbit', price: 35000, rarity: 'legendary' },
  { id: 'hat_neon', type: 'hat', label: 'Neon Halo (animated)', value: 'neon', price: 45000, rarity: 'mythic' },
  // Face / neck accessories
  { id: 'acc_shades', type: 'acc', label: 'Sunglasses', value: 'shades', price: 2000, rarity: 'common' },
  { id: 'acc_nerd', type: 'acc', label: 'Nerd Glasses', value: 'nerd', price: 2500, rarity: 'common' },
  { id: 'acc_stache', type: 'acc', label: 'Mustache', value: 'stache', price: 3000, rarity: 'uncommon' },
  { id: 'acc_bowtie', type: 'acc', label: 'Bow Tie', value: 'bowtie', price: 3500, rarity: 'uncommon' },
  { id: 'acc_monocle', type: 'acc', label: 'Monocle', value: 'monocle', price: 6000, rarity: 'rare' },
  { id: 'acc_patch', type: 'acc', label: 'Eye Patch', value: 'patch', price: 6000, rarity: 'rare' },
  { id: 'acc_scarf', type: 'acc', label: 'Cozy Scarf', value: 'scarf', price: 7000, rarity: 'rare' },
  { id: 'acc_chain', type: 'acc', label: 'Gold Chain', value: 'chain', price: 15000, rarity: 'epic' },
  { id: 'acc_pixel', type: 'acc', label: 'Deal-With-It Shades', value: 'pixel', price: 25000, rarity: 'legendary' },
  { id: 'acc_cape', type: 'acc', label: 'Royal Cape', value: 'cape', price: 30000, rarity: 'legendary' },
  { id: 'acc_hearts', type: 'acc', label: 'Heart Shades', value: 'hearts', price: 8000, rarity: 'rare' },
  { id: 'acc_medal', type: 'acc', label: 'Gold Medal', value: 'medal', price: 12000, rarity: 'epic' },
  { id: 'acc_wings', type: 'acc', label: 'Angel Wings', value: 'wings', price: 40000, rarity: 'legendary' },
  { id: 'acc_butterfly', type: 'acc', label: 'Butterfly Wings (animated)', value: 'butterfly', price: 24000, rarity: 'epic' },
  { id: 'acc_firewings', type: 'acc', label: 'Phoenix Wings (animated)', value: 'firewings', price: 55000, rarity: 'mythic' },
  { id: 'acc_aura', type: 'acc', label: 'Power Aura (animated)', value: 'aura', price: 32000, rarity: 'legendary' },
  { id: 'acc_pet', type: 'acc', label: 'Ghost Buddy (animated)', value: 'pet', price: 20000, rarity: 'epic' },
  { id: 'acc_orbs', type: 'acc', label: 'Spinning Orbs (animated)', value: 'orbs', price: 28000, rarity: 'legendary' },
  // Walking trails
  { id: 'trail_sparkle', type: 'trail', label: 'Sparkles', value: 'sparkle', price: 5000, rarity: 'uncommon' },
  { id: 'trail_hearts', type: 'trail', label: 'Hearts', value: 'hearts', price: 6000, rarity: 'uncommon' },
  { id: 'trail_bubbles', type: 'trail', label: 'Bubbles', value: 'bubbles', price: 6000, rarity: 'uncommon' },
  { id: 'trail_music', type: 'trail', label: 'Music Notes', value: 'music', price: 8000, rarity: 'rare' },
  { id: 'trail_snow', type: 'trail', label: 'Snowfall', value: 'snow', price: 9000, rarity: 'rare' },
  { id: 'trail_coins', type: 'trail', label: 'Coin Drop', value: 'coins', price: 15000, rarity: 'epic' },
  { id: 'trail_stars', type: 'trail', label: 'Shooting Stars', value: 'stars', price: 15000, rarity: 'epic' },
  { id: 'trail_fire', type: 'trail', label: 'Fire Walk', value: 'fire', price: 25000, rarity: 'legendary' },
  { id: 'trail_rainbow', type: 'trail', label: 'Rainbow Road', value: 'rainbow', price: 45000, rarity: 'mythic' },
  { id: 'trail_petals', type: 'trail', label: 'Cherry Petals', value: 'petals', price: 8000, rarity: 'rare' },
  { id: 'trail_ghosts', type: 'trail', label: 'Spooky Ghosts', value: 'ghosts', price: 12000, rarity: 'epic' },
  { id: 'trail_pixels', type: 'trail', label: 'Pixel Burst', value: 'pixels', price: 14000, rarity: 'epic' },
  { id: 'trail_lightning', type: 'trail', label: 'Lightning Steps', value: 'lightning', price: 30000, rarity: 'legendary' },
  { id: 'trail_galaxy', type: 'trail', label: 'Galaxy Dust', value: 'galaxy', price: 50000, rarity: 'mythic' },
  // Emotes (shown in a bubble over your character)
  { id: 'emo_wave', type: 'emote', label: 'Wave', value: '👋', price: 0, rarity: 'common' },
  { id: 'emo_laugh', type: 'emote', label: 'Laugh', value: '😂', price: 0, rarity: 'common' },
  { id: 'emo_wow', type: 'emote', label: 'Wow', value: '😮', price: 0, rarity: 'common' },
  { id: 'emo_thumbs', type: 'emote', label: 'Thumbs Up', value: '👍', price: 0, rarity: 'common' },
  { id: 'emo_heart', type: 'emote', label: 'Love', value: '❤️', price: 0, rarity: 'common' },
  { id: 'emo_cry', type: 'emote', label: 'Cry', value: '😭', price: 0, rarity: 'common' },
  { id: 'emo_gg', type: 'emote', label: 'GG', value: 'GG', price: 0, rarity: 'common' },
  { id: 'emo_fire', type: 'emote', label: 'On Fire', value: '🔥', price: 1500, rarity: 'common' },
  { id: 'emo_cool', type: 'emote', label: 'Cool', value: '😎', price: 1500, rarity: 'common' },
  { id: 'emo_party', type: 'emote', label: 'Party', value: '🎉', price: 2000, rarity: 'uncommon' },
  { id: 'emo_salute', type: 'emote', label: 'Salute', value: '🫡', price: 2500, rarity: 'uncommon' },
  { id: 'emo_skull', type: 'emote', label: 'Dead', value: '💀', price: 3000, rarity: 'uncommon' },
  { id: 'emo_clown', type: 'emote', label: 'Clown', value: '🤡', price: 3000, rarity: 'uncommon' },
  { id: 'emo_rich', type: 'emote', label: 'Money Face', value: '🤑', price: 4000, rarity: 'rare' },
  { id: 'emo_moai', type: 'emote', label: 'Stone Face', value: '🗿', price: 5000, rarity: 'rare' },
  { id: 'emo_crown', type: 'emote', label: 'King', value: '👑', price: 10000, rarity: 'epic' },
  { id: 'emo_rain', type: 'emote', label: 'Make It Rain', value: '💸', price: 15000, rarity: 'legendary' },
  { id: 'emo_sleep', type: 'emote', label: 'Sleepy', value: '😴', price: 1500, rarity: 'common' },
  { id: 'emo_pray', type: 'emote', label: 'Please', value: '🙏', price: 2000, rarity: 'uncommon' },
  { id: 'emo_mind', type: 'emote', label: 'Mind Blown', value: '🤯', price: 3500, rarity: 'uncommon' },
  { id: 'emo_100', type: 'emote', label: '100', value: '💯', price: 4000, rarity: 'rare' },
  { id: 'emo_party2', type: 'emote', label: 'Party Face', value: '🥳', price: 4500, rarity: 'rare' },
  { id: 'emo_dice', type: 'emote', label: 'Roll the Dice', value: '🎲', price: 6000, rarity: 'epic' },
];
function storeItem(id) { return STORE.find((s) => s.id === id) || null; }
// ---- Sprite Studio: custom gims / hats / accessories drawn by the owner ----
const SPRITE_OWNER = 'scrollreader11';
const SPR_CH = '0123456789abcdefghijklmnopqrstuv';
const SPR_FX = ['none', 'bounce', 'wiggle', 'spin', 'pulse', 'float', 'rainbow', 'glow', 'sparkle', 'shake'];
const TAG_FX = ['', 'pulse', 'gold', 'shimmer', 'rainbow'];
function syncCustomStore() {
  for (let i = STORE.length - 1; i >= 0; i--) if (STORE[i].custom) STORE.splice(i, 1);
  for (const it of casino.custom) if (!it.replaces) STORE.push({ id: it.id, type: it.type, label: it.label, value: it.value, price: it.price, rarity: it.rarity, custom: true, ...(it.fx ? { fx: it.fx } : {}), ...(it.ref ? { ref: it.ref } : {}) });
}
function cleanSprite(sp) {
  if (!sp || typeof sp !== 'object') return null;
  const w = 32, h = 32;
  const pal = Array.isArray(sp.pal) ? sp.pal.slice(0, 31).map((c) => String(c)).filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)) : [];
  const okPx = (px) => typeof px === 'string' && px.length === w * h && [...px].every((ch) => { const i = SPR_CH.indexOf(ch); return i >= 0 && i <= pal.length; });
  if (!pal.length || !okPx(sp.px) || !/[1-9a-v]/.test(sp.px)) return null;
  const frames = Array.isArray(sp.frames) ? sp.frames.slice(0, 7).filter((f) => okPx(f) && /[1-9a-v]/.test(f)) : [];
  const fps = Math.max(1, Math.min(15, Math.round(Number(sp.fps) || 6)));
  const fx = SPR_FX.includes(sp.fx) ? sp.fx : 'none';
  return { w, h, pal, px: sp.px, back: okPx(sp.back) && /[1-9a-v]/.test(sp.back) ? sp.back : '', eyes: !!sp.eyes, feet: sp.feet !== false, frames, fps, fx };
}
// Custom banners are stored on profiles as a short 'cb:<key>' reference and expanded when sent out.
function banOut(v) { if (typeof v === 'string' && v.startsWith('cb:')) { const it = casino.custom.find((x) => x.ref === v); return it ? it.value : ''; } return v || ''; }
function overrideMap() { const o = { skin: {}, hat: {}, acc: {} }; for (const it of casino.custom) if (it.replaces && it.sprite && o[it.type]) o[it.type][it.replaces] = it.value; return o; }
function spriteMap() { const out = {}; for (const it of casino.custom) if (it.sprite) out[it.value] = it.sprite; return out; }
function isSpriteOwner(req) { const a = req._auth; const n = a && (a.username || (a.account && a.account.username) || a.name); return String(n || '').toLowerCase() === SPRITE_OWNER; }
async function handleSprites(path, req, res) {
  if (path === '/api/casino/sprites') { sendJson(res, 200, { sprites: spriteMap(), overrides: overrideMap(), items: casino.custom.map((it) => ({ id: it.id, type: it.type, label: it.label, value: it.value, price: it.price, rarity: it.rarity, at: it.at, params: it.params, fx: it.fx || '', replaces: it.replaces || '' })), canEdit: isSpriteOwner(req) }); return true; }
  if (path === '/api/casino/sprites/save' && req.method === 'POST') {
    if (!isSpriteOwner(req)) return (sendJson(res, 403, { error: 'Only Scrollreader11 can save sprites.' }), true);
    const b = await readBody(req);
    const type = ['skin', 'hat', 'acc', 'banner', 'tag'].includes(b.type) ? b.type : null;
    if (!type) return (sendJson(res, 400, { error: 'Pick what you are making first.' }), true);
    let sprite = null, params = null, value = null, fx = '';
    let label = String(b.label || '').replace(/[<>]/g, '').trim().slice(0, 28) || 'My creation';
    if (type === 'banner') { params = globalThis.SHBanner.clean(b.banner); value = globalThis.SHBanner.css(params); }
    else if (type === 'tag') {
      label = Array.from(String((b.tag && b.tag.text) || '').replace(/[\u0000-\u001f<>&"`\\]/g, '')).slice(0, 18).join('').trim();
      if (!label) return (sendJson(res, 400, { error: 'Type the name tag text first.' }), true);
      fx = TAG_FX.includes(b.tag && b.tag.fx) ? b.tag.fx : '';
    } else { sprite = cleanSprite(b.sprite); if (!sprite) return (sendJson(res, 400, { error: 'Draw something first!' }), true); }
    let replaces = '';
    if (b.replaces && ['skin', 'hat', 'acc'].includes(type)) {
      const orig = STORE.find((x) => !x.custom && x.type === type && x.value === b.replaces);
      if (!orig) return (sendJson(res, 400, { error: 'Could not find the item you want to replace.' }), true);
      replaces = orig.value;
    }
    const price = Math.max(0, Math.min(1000000, Math.floor(Number(b.price) || 0)));
    const rarity = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(b.rarity) ? b.rarity : 'rare';
    let it = b.id ? casino.custom.find((x) => x.id === b.id) : null;
    if (it) {
      if (it.type !== type) return (sendJson(res, 400, { error: 'You can’t change the type of a saved item — save it as new instead.' }), true);
      Object.assign(it, { label, price, rarity, sprite, params, fx, replaces, at: Date.now() }); if (value) it.value = value;
    } else {
      if (casino.custom.length >= 300) return (sendJson(res, 400, { error: 'That’s a lot of creations! Delete some first.' }), true);
      const key = Math.random().toString(36).slice(2, 9);
      it = { id: 'cu_' + type + '_' + key, type, label, value: value || (type === 'tag' ? label : 'c:' + key), price, rarity, sprite, params, fx, replaces, at: Date.now(), ...(type === 'banner' ? { ref: 'cb:' + key } : {}) };
      casino.custom.push(it);
    }
    if (replaces) for (const x of casino.custom) if (x !== it && x.type === type && x.replaces === replaces) x.replaces = ''; // only one replacement per original
    syncCustomStore(); save(); flush();
    sendJson(res, 200, { ok: true, item: { id: it.id, value: it.value } }); return true;
  }
  if (path === '/api/casino/sprites/delete' && req.method === 'POST') {
    if (!isSpriteOwner(req)) return (sendJson(res, 403, { error: 'Only Scrollreader11 can delete sprites.' }), true);
    const b = await readBody(req); const i = casino.custom.findIndex((x) => x.id === b.id);
    if (i < 0) return (sendJson(res, 404, { error: 'Not found' }), true);
    const it = casino.custom[i]; casino.custom.splice(i, 1);
    for (const cid in casino.users) { const u = casino.users[cid]; if (u.look && u.look[it.type] === it.id) u.look[it.type] = it.type === 'skin' ? 'skin_gim' : ''; if (it.type === 'banner' && (u.banner === it.value || u.banner === it.ref)) u.banner = ''; if (it.type === 'tag' && u.tag === it.label) u.tag = ''; }
    syncCustomStore(); save(); flush();
    sendJson(res, 200, { ok: true }); return true;
  }
  return false;
}
// School Mode: every paid cosmetic costs 100 Scrolls; prices go back to normal when it's off
function schoolOn() { try { return !!(globalThis.SH_SCHOOL && globalThis.SH_SCHOOL()); } catch (e) { return false; } }
function itemCfg(it) { const m = casino.cfg && casino.cfg.items; return (m && it && m[it.id]) || null; }
export function priceOf(it) { if (!it) return 0; const o = itemCfg(it); const base = o && o.price != null && it.price > 0 ? o.price : it.price; return base > 0 && schoolOn() ? 100 : base; }
function storeList(p) {
  const base = STORE.filter((it) => (!it.staff || (p && p.inventory.includes(it.id))) && !((itemCfg(it) || {}).off && !(p && p.inventory.includes(it.id))));
  return base.map((it) => { const pr = priceOf(it); return pr !== it.price ? { ...it, was: it.price, price: pr } : it; });
}
// Character look (2D casino world). Slots hold item ids.
const LOOK_SLOTS = ['skin', 'body', 'hat', 'acc', 'trail'];
const LOOK_DEFAULT = { skin: 'skin_gim', body: 'body_sky', hat: '', acc: '', trail: '' };
function ensureLook(p) {
  if (!p.look || typeof p.look !== 'object') p.look = { ...LOOK_DEFAULT };
  for (const k of LOOK_SLOTS) if (typeof p.look[k] !== 'string') p.look[k] = LOOK_DEFAULT[k];
  return p.look;
}
function ownsItem(p, it) { return !!it && ((it.price === 0 && !it.staff) || p.inventory.includes(it.id)); }
// Resolved look values the renderer needs (ids -> draw keys).
function lookValues(p) {
  const l = ensureLook(p); const out = {};
  for (const k of LOOK_SLOTS) { const it = l[k] ? storeItem(l[k]) : null; out[k] = it ? it.value : (k === 'skin' ? 'gim' : k === 'body' ? '#3fa9ff' : ''); }
  return out;
}
export function worldIdentity(req) { return who(req); }
export function worldProfile(cid) { return cid ? profileOf(cid) : null; }
export function worldLook(cid) {
  const p = casino.users[cid];
  if (!p) return { skin: 'gim', body: '#3fa9ff', hat: '', acc: '', trail: '' };
  return lookValues(p);
}
export function worldOwnsEmote(cid, emoteId) {
  const it = storeItem(String(emoteId || ''));
  if (!it || it.type !== 'emote') return null;
  const p = casino.users[cid];
  if (it.price !== 0 && !(p && p.inventory.includes(it.id))) return null;
  return it.value;
}
// ---- shared wallet for the 2D world's multiplayer tables (casinotables.js) ----
export function walletCoins(cid) { const p = casino.users[cid]; return p ? p.coins : 0; }
export function walletBet(cid, bet) {
  const p = profileOf(cid); bet = Math.floor(Number(bet) || 0);
  if (bet < 1) return { error: 'bad-bet' };
  if (bet > p.coins) return { error: 'broke' };
  p.coins -= bet; save(); return { ok: true, coins: p.coins };
}
export function walletRefund(cid, amount) { const p = profileOf(cid); p.coins += Math.max(0, Math.floor(amount)); save(); return p.coins; }
// Finish a play: pay out and record it (stats, tournament, win pops) exactly like a solo game.
export function walletSettle(cid, bet, payout) { const p = profileOf(cid); payout = Math.max(0, Math.floor(payout)); p.coins += payout; recordPlay(p, bet, payout); save(); return p.coins; }
export function crashRoll() { return Math.min(250, rollCrashPoint()); }
export function crashRate() { return CRASH_K; } // (function: CRASH_K is declared further down)
// Progressive slots jackpot.
const JACKPOT_SEED = 25000;
function ensureJackpot() { if (!casino.jackpot || typeof casino.jackpot.pool !== 'number') casino.jackpot = { pool: JACKPOT_SEED, last: null }; return casino.jackpot; }
export function jackpotInfo() { const j = ensureJackpot(); return { pool: Math.floor(j.pool), last: j.last }; }
let jackpotHook = null;
export function setJackpotHook(fn) { jackpotHook = fn; }
// ---- Bedwars 2D (bedwars.js): lifetime stats + Scroll rewards with a daily cap ----
const BW_DAILY_CAP = 1500;
function bwOf(p) {
  if (!p.bw || typeof p.bw !== 'object') p.bw = { games: 0, wins: 0, kills: 0, finals: 0, beds: 0, deaths: 0, day: '', earned: 0 };
  return p.bw;
}
export function bwStats(cid) { const p = casino.users[cid]; if (!p) return null; const b = bwOf(p); const day = new Date().toISOString().slice(0, 10); return { ...b, earnedToday: b.day === day ? b.earned : 0, cap: BW_DAILY_CAP, coins: p.coins }; }
// Top Bedwars players for the hub leaderboard (cached; it scans every profile).
let bwLbCache = null, bwLbAt = 0;
export function bwLeaderboard() {
  if (bwLbCache && Date.now() - bwLbAt < 30000) return bwLbCache;
  const rows = [];
  for (const id in casino.users) { const u = casino.users[id]; if (u && u.bw && (u.bw.wins || u.bw.finals)) rows.push({ nick: u.nick || 'Player', wins: u.bw.wins | 0, finals: u.bw.finals | 0, beds: u.bw.beds | 0 }); }
  rows.sort((a, b) => b.wins - a.wins || b.finals - a.finals);
  bwLbCache = rows.slice(0, 10); bwLbAt = Date.now();
  return bwLbCache;
}
export function bwReward(cid, amount, st) {
  const p = profileOf(cid); if (!p) return null;
  if (st.nick && st.nick !== 'Guest' && !p.nick) p.nick = String(st.nick).slice(0, 40);
  bwLbAt = 0;
  const b = bwOf(p), day = new Date().toISOString().slice(0, 10);
  if (b.day !== day) { b.day = day; b.earned = 0; }
  b.games++; if (st.win) b.wins++;
  b.kills += st.kills | 0; b.finals += st.finals | 0; b.beds += st.beds | 0; b.deaths += st.deaths | 0;
  if (globalThis.SH_BOOST) amount = Math.floor(amount * globalThis.SH_BOOST());
  const give = Math.max(0, Math.min(Math.floor(amount), BW_DAILY_CAP - b.earned));
  b.earned += give; p.coins += give;
  if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
  save();
  return { give, coins: p.coins, capped: give < Math.floor(amount), stats: { ...b } };
}
// Lets the 2D world react to every finished play (win pops + big-win feed).
let playHook = null;
export function setPlayHook(fn) { playHook = fn; }

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
  if (req._bodyP) return req._bodyP;
  return (req._bodyP = new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); }));
}
function clampBet(bet, coins) { bet = Math.floor(Number(bet) || 0); return bet; }
function publicProfile(cid) {
  const p = profileOf(cid);
  return { coins: p.coins, lastDaily: p.lastDaily, streak: p.streak || 0, gotdClaimed: p.gotdClaimed || '', inventory: p.inventory, tag: p.tag, color: p.color, banner: banOut(p.banner), avatarFx: p.avatarFx || '', titleFx: p.titleFx || '', look: { ...ensureLook(p) }, lookValues: lookValues(p), stats: p.stats };
}
function recordPlay(p, bet, payout) {
  if (p.tut && p.tut.on && !p.tut.done && bet >= 1) p.tut.n = Math.min(99, (p.tut.n | 0) + 1); // tutorial progress
  p.stats.plays++; p.stats.wagered += bet;
  const net = payout - bet;
  if (net > 0) p.stats.won += net;
  if (payout > p.stats.biggest) p.stats.biggest = payout;
  if (p.stats.casesOpened == null) p.stats.casesOpened = 0;
  if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
  // Weekly tournament: accumulate this week's net result.
  ensureWeek(p); p.weekNet = (p.weekNet || 0) + net;
  if (rigPlays) rigPlays.push({ bet, payout });
  if (playHook) { if (rigDry) rigPending.push(() => playHook(p, bet, payout)); else { try { playHook(p, bet, payout); } catch (e) {} } }
}

const OLD_GAMES = { '/api/casino/slots': 'slots', '/api/casino/coinflip': 'coinflip', '/api/casino/dice': 'dice', '/api/casino/roulette': 'roulette', '/api/casino/plinko': 'plinko', '/api/casino/wheel': 'wheel', '/api/casino/bj/start': 'blackjack', '/api/casino/mines/start': 'mines', '/api/casino/crash/start': 'crash', '/api/casino/case': 'cases' };
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
// Rigging (owner tool). A rule says: for this player (or everyone) in this game, make the next
// rounds win, lose, pay between A and B times the bet, or win a set share of the time.
// The round is played normally, then re-rolled in memory (wallet, stats, jackpot and the round in
// progress are put back each time) until it fits the rule. Only the round that fits is kept.
// ============================================================
const RIG_MODES = ['win', 'lose', 'payout', 'chance'];
const rigRound = new Map(); // "cid:game" -> 'win' | 'lose' (the coin for a win-chance rule, kept until the round ends)
function rigClean(o, by) {
  const mode = RIG_MODES.includes(o.mode) ? o.mode : 'win';
  const game = o.game === '*' || GAME_LIST.some((g) => g[0] === o.game) ? o.game : '*';
  const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  const min = num(o.min, 2, 0, 100000), max = o.max === '' || o.max == null ? 0 : num(o.max, 0, 0, 100000);
  const uses = Math.floor(num(o.uses, 1, 0, 100000));
  const mins = Math.floor(num(o.minutes, 0, 0, 525600));
  return { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), game, cid: o.cid ? String(o.cid) : '*', name: o.cid ? String(o.name || '') : '*', mode, min: Math.min(min, max || min), max: max && max < min ? min : max, chance: num(o.chance, 50, 0, 100), uses, left: uses, expires: mins ? Date.now() + mins * 60000 : 0, staff: !!o.staff, note: String(o.note || '').slice(0, 80), by: String(by || ''), created: Date.now(), hits: 0, on: true };
}
export function rigList() { return { rules: casino.rigs.slice(), log: casino.rigLog.slice(-80).reverse(), games: GAME_LIST }; }
export function rigAdd(o, by) { const r = rigClean(o || {}, by); casino.rigs.push(r); if (casino.rigs.length > 60) casino.rigs.shift(); save(); flush(); return r; }
export function rigDelete(id) { const n = casino.rigs.length; casino.rigs = casino.rigs.filter((r) => r.id !== id); save(); flush(); return casino.rigs.length !== n; }
export function rigClear() { casino.rigs = []; rigRound.clear(); save(); flush(); }
export function rigToggle(id, on) { const r = casino.rigs.find((x) => x.id === id); if (!r) return null; r.on = on == null ? !r.on : !!on; if (r.on && r.uses && r.left <= 0) r.left = r.uses; save(); flush(); return r; }
function rigFind(cid, gid, isStaff) {
  const now = Date.now(); let best = null, bs = -1;
  for (const r of casino.rigs) {
    if (!r.on || (r.expires && now > r.expires) || (r.uses && r.left <= 0)) continue;
    if (r.game !== '*' && r.game !== gid) continue;
    if (r.cid !== '*' && r.cid !== cid) continue;
    if (r.cid === '*' && isStaff && !r.staff) continue;
    const sc = (r.cid !== '*' ? 2 : 0) + (r.game !== '*' ? 1 : 0) + r.created / 1e15;
    if (sc > bs) { bs = sc; best = r; }
  }
  return best;
}
function rigWant(rule, cid, gid) {
  if (rule.mode !== 'chance') return rule.mode;
  const k = cid + ':' + gid; let w = rigRound.get(k);
  if (!w) { w = Math.random() * 100 < rule.chance ? 'win' : 'lose'; rigRound.set(k, w); }
  return w;
}
function rigDone(rule, cid, gid, p, bet, payout, tries, ok) { // a round counted against a rule
  rigRound.delete(cid + ':' + gid);
  rule.hits++; if (rule.uses) { rule.left--; if (rule.left <= 0) rule.on = false; }
  casino.rigLog.push({ ts: Date.now(), name: p.nick || '', game: gid, mode: rule.mode, bet, payout, tries, ok: !!ok, rule: rule.id });
  if (casino.rigLog.length > 200) casino.rigLog.shift();
}
function rigSnap(cid) {
  const p = casino.users[cid], j = casino.jackpot;
  return { p: p && { coins: p.coins, stats: structuredClone(p.stats), weekNet: p.weekNet, weekKey: p.weekKey }, jp: j && { pool: j.pool, last: j.last ? { ...j.last } : j.last }, bj: structuredClone(bj[cid]), mines: structuredClone(mines[cid]), crash: structuredClone(crash[cid]), more: liveSnap(cid) };
}
function rigRestore(cid, s, reshuffle) {
  const p = casino.users[cid];
  if (p && s.p) { p.coins = s.p.coins; p.stats = structuredClone(s.p.stats); p.weekNet = s.p.weekNet; p.weekKey = s.p.weekKey; }
  if (casino.jackpot && s.jp) { casino.jackpot.pool = s.jp.pool; casino.jackpot.last = s.jp.last ? { ...s.jp.last } : s.jp.last; }
  for (const [store, key] of [[bj, 'bj'], [mines, 'mines'], [crash, 'crash']]) {
    if (s[key] === undefined) delete store[cid]; else { const c = structuredClone(s[key]); if (reshuffle && Array.isArray(c.deck)) for (let i = c.deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c.deck[i], c.deck[j]] = [c.deck[j], c.deck[i]]; } store[cid] = c; }
  }
  liveRestore(cid, s.more, reshuffle);
}
// How far a replayed round is from what the rule wants (0 = fits).
function rigScore(rule, want, kind, resp, plays, tries, bjDeal) {
  if (resp && resp.error) return { ok: true, dist: 0, resolved: false, err: true };
  const lo = rule.min || 0, hi = rule.max || Infinity;
  if (kind === 'crash') {
    const cp = Number(resp.crashPoint) || 1;
    if (want === 'win') return { ok: cp >= Math.max(2.5, lo), dist: Math.max(0, Math.max(2.5, lo) - cp), resolved: true, crash: cp };
    if (want === 'lose') return { ok: cp <= 1.15, dist: Math.max(0, cp - 1.15), resolved: true, crash: cp };
    const top = hi === Infinity ? lo * 2 + 1 : hi, d = cp < lo ? lo - cp : cp > top ? cp - top : 0;
    return { ok: d === 0, dist: d, resolved: true, crash: cp };
  }
  if (!plays.length && bjDeal) { // blackjack deal: the dealer's hidden card is already set, so pick a deal the rule can still work with
    if (want === 'win') return { ok: bjDeal <= 15, dist: Math.max(0, bjDeal - 15), resolved: false };
    if (want === 'lose') return { ok: bjDeal >= 17, dist: Math.max(0, 17 - bjDeal), resolved: false };
  }
  if (!plays.length) return want === 'lose' ? { ok: tries >= 40, dist: 1, resolved: false } : { ok: true, dist: 0, resolved: false };
  const last = plays[plays.length - 1], ratio = last.bet > 0 ? last.payout / last.bet : 0;
  if (want === 'win') return { ok: ratio > 1, dist: ratio > 1 ? 0 : 1 - ratio + 0.001, resolved: true, ratio };
  if (want === 'lose') return { ok: ratio < 1, dist: ratio < 1 ? 0 : ratio - 1 + 0.001, resolved: true, ratio };
  const d = ratio < lo ? lo - ratio : ratio > hi ? ratio - hi : 0;
  return { ok: d === 0, dist: d, resolved: true, ratio };
}
function rigKind(path, method) {
  if (method !== 'POST') return null;
  if (path === '/api/casino/crash/start') return { gid: 'crash', kind: 'crash' };
  if (path === '/api/casino/bj/start' || path === '/api/casino/bj/hit' || path === '/api/casino/bj/stand') return { gid: 'blackjack', kind: 'gen' };
  if (OLD_GAMES[path] && path !== '/api/casino/mines/start') return { gid: OLD_GAMES[path], kind: 'gen' };
  const m = path.match(/^\/api\/casino\/g\/([a-z]+)(?:\/([a-z]+))?$/);
  if (m && m[1] !== 'info' && m[2] !== 'state' && GAME_LIST.some((g) => g[0] === m[1])) return { gid: m[1], kind: 'gen' };
  return null;
}
async function rigGate(url, req, res, cid, p, rk) {
  const rule = rigFind(cid, rk.gid, !!(req._auth && req._auth.role)); if (!rule) return false;
  await readBody(req);
  const want = rigWant(rule, cid, rk.gid), MAXT = want === 'payout' ? 4000 : 600;
  if (rk.gid === 'blackjack' && url.split('?')[0] === '/api/casino/bj/stand' && bj[cid] && !bj[cid].done) { // the dealer's hidden card is already dealt: swap it for one the rule can work with
    const g = bj[cid], pv = handValue(g.player), cards = [];
    for (const s0 of SUITS) for (let n = 1; n <= 13; n++) cards.push({ n, s: s0 });
    const withHole = (c) => handValue([g.dealer[0], c]);
    if (want === 'lose' && pv < 21) { const c = cards.filter((x) => withHole(x) > pv && withHole(x) <= 21).sort((a, b) => withHole(a) - withHole(b))[0]; if (c) g.dealer[1] = c; }
    else if (want === 'win' && withHole(g.dealer[1]) >= Math.min(pv, 17)) { const c = cards.filter((x) => withHole(x) <= 15).sort((a, b) => withHole(b) - withHole(a))[0]; if (c) g.dealer[1] = c; }
  }
  let best = null, ok = false, i = 0; const seen = new Set();
  for (; i < MAXT; i++) {
    const before = rigSnap(cid);
    rigDry = true; rigPlays = []; rigPending = []; req._rigSkip = true;
    const cap = { statusCode: 200, body: '', writeHead(c) { this.statusCode = c; }, end(b) { this.body = b || ''; } };
    try { await handleCasino(url, req, cap); } finally { rigDry = false; }
    const plays = rigPlays, pending = rigPending; rigPlays = null; rigPending = [];
    let resp = {}; try { resp = JSON.parse(cap.body); } catch (e) {}
    const ev = rigScore(rule, want, rk.kind, resp, plays, i, url.split('?')[0] === '/api/casino/bj/start' && bj[cid] && !bj[cid].done ? handValue(bj[cid].dealer) : 0);
    const att = { cap, plays, pending, ev, after: rigSnap(cid) };
    if (!best || ev.dist < best.ev.dist) best = att;
    if (ev.ok) { ok = true; best = att; break; }
    seen.add(ev.ratio != null ? ev.ratio : ev.crash != null ? ev.crash : 'x');
    rigRestore(cid, before, true);
    if (i >= 60 && seen.size === 1) break;               // nothing about this round is random, so stop trying
  }
  rigRestore(cid, best.after, false);
  rigDry = false;
  for (const f of best.pending) { try { f(); } catch (e) {} }
  save();
  const last = best.plays[best.plays.length - 1];
  if (best.ev.resolved && !best.ev.err) rigDone(rule, cid, rk.gid, p, last ? last.bet : Number((await readBody(req)).bet) || 0, last ? last.payout : 0, i + 1, ok);
  res.writeHead(best.cap.statusCode, { 'Content-Type': 'application/json', 'cache-control': 'no-store' }); res.end(best.cap.body);
  return true;
}
// Mines decides each tile as it is picked, so its rig moves the bombs instead of re-rolling.
function rigMinesIntent(cid, req, g) {
  const rule = rigFind(cid, 'mines', !!(req._auth && req._auth.role)); if (!rule) return null;
  const want = rigWant(rule, cid, 'mines');
  if (want === 'win') return { rule, act: 'safe' };
  if (want === 'lose') return { rule, act: 'boom' };
  const lo = rule.min || 2, cur = minesMult(g.mines, g.picks.length);
  return cur < lo ? { rule, act: 'safe' } : { rule, act: null };
}

// ============================================================
// Router — returns true if it handled the request.
// ============================================================
export async function handleCasino(url, req, res) {
  const path = url.split('?')[0];
  if (!path.startsWith('/api/casino/')) return false;
  if (path.startsWith('/api/casino/sprites')) { if (await handleSprites(path, req, res)) return true; }
  const { cid, nick } = who(req);
  if (!cid) { sendJson(res, 200, { error: 'no-id', message: 'Log in to ScrollHub first.' }); return true; }
  const p = profileOf(cid);
  if (nick && nick !== 'Guest' && p.nick !== nick) { p.nick = nick; save(); } // keep a name for the leaderboard/tips
  try { checkTournamentRollover(); } catch (e) {} // pay out last week if the week just rolled over
  ensureWeek(p);

  // Owner rigging (see the Rigging section): re-rolls this round until it fits an active rule.
  if (!req._rigSkip && casino.rigs.length) { const rk = rigKind(path, req.method); if (rk && await rigGate(url, req, res, cid, p, rk)) return true; }

  // Owner table limits apply to every game, old and new.
  if (req.method === 'POST' && OLD_GAMES[path]) {
    const gid = OLD_GAMES[path], cf = casino.cfg || {}, gc = (cf.games && cf.games[gid]) || {}, bb = await readBody(req), bet = Math.floor(Number(bb.bet || bb.price || 0)) || 0;
    const max = gc.max || cf.maxBet || 0, min = gc.min || cf.minBet || 0;
    if (cf.closed) { sendJson(res, 200, { error: 'closed', message: 'The casino is closed for now.' }); return true; }
    if (gc.off) { sendJson(res, 200, { error: 'disabled', message: 'That game is switched off right now.' }); return true; }
    if (max && bet > max) { sendJson(res, 200, { error: 'max-bet', max, message: 'The table limit is ' + max + ' Scrolls.' }); return true; }
    if (min && bet > 0 && bet < min) { sendJson(res, 200, { error: 'min-bet', min, message: 'The minimum bet is ' + min + ' Scrolls.' }); return true; }
  }
  if (path.startsWith('/api/casino/g/')) {
    const mb = req.method === 'POST' ? await readBody(req) : {};
    const r = handleMore(path, mb, { cid, p, cfg: () => casino.cfg, save, recordPlay, publicProfile: () => publicProfile(cid) });
    if (r) { sendJson(res, 200, r); return true; }
  }

  // First-visit tutorial: the casino step only counts real bets (recordPlay) made after it was started,
  // and the one-time reward is paid here on the server, once per identity.
  if (path === '/api/casino/tut') {
    if (!tutOn()) { sendJson(res, 200, { show: false, started: false, done: false, n: 0, need: TUT_PLAYS, reward: 0, coins: p.coins, off: true }); return true; }
    if (!p.tut || p.tut.legacy || (p.tut.ver | 0) < tutVer()) {   // everyone gets the tour on their next join; bump TUT_VER to replay it for all
      const prev = p.tut && !p.tut.legacy ? p.tut : null;
      p.tut = { done: false, on: false, n: 0, ver: tutVer(), paid: !!(prev && (prev.paid || prev.done)) };   // the reward is only ever paid once per player
      save();
    }
    const t = p.tut, tstat = () => ({ show: !t.done, started: !!t.on, done: !!t.done, n: t.n | 0, need: TUT_PLAYS, reward: t.paid ? 0 : tutReward(), coins: p.coins });
    if (req.method === 'POST') {
      const tb = await readBody(req), act = String(tb.action || '');
      if (act === 'start' && !t.done && !t.on) { t.on = true; t.n = 0; save(); }
      else if (act === 'finish') {
        if (t.done) { sendJson(res, 200, { ...tstat(), error: 'already', message: 'The tutorial reward was already claimed.' }); return true; }
        if (!t.on || (t.n | 0) < TUT_PLAYS) { sendJson(res, 200, { ...tstat(), error: 'not-yet', message: 'Play ' + TUT_PLAYS + ' casino rounds first.' }); return true; }
        const pay = t.paid ? 0 : tutReward(); t.done = true; t.paid = true; t.at = Date.now(); p.coins += pay;
        if (p.coins > (p.stats.peak || 0)) p.stats.peak = p.coins;
        save(); flush();
        sendJson(res, 200, { ...tstat(), ok: true, paid: pay }); return true;
      }
    }
    sendJson(res, 200, tstat()); return true;
  }

  if (path === '/api/casino/me') { sendJson(res, 200, { profile: publicProfile(cid), store: storeList(p), school: schoolOn(), season: (globalThis.SH_SEASON ? globalThis.SH_SEASON() : 'xmas'), cases: CASES, nick, dailyMs: DAILY_MS, dailyCoins: DAILY_COINS }); return true; }

  if (path === '/api/casino/daily' && req.method === 'POST') {
    const now = Date.now();
    const gap = now - p.lastDaily;
    if (p.lastDaily && gap < DAILY_MS) { sendJson(res, 200, { error: 'cooldown', nextIn: DAILY_MS - gap, streak: p.streak || 0, profile: publicProfile(cid) }); return true; }
    // Streak continues if the last claim was within ~44h; otherwise it resets.
    const STREAK_GRACE = 44 * 3600 * 1000;
    const cont = p.lastDaily && gap <= STREAK_GRACE;
    p.streak = (cont ? (p.streak || 0) : 0) + 1;
    // Base reward grows with streak (capped), plus a milestone bonus every 7 days.
    const base = (casino.cfg.dailyCoins || DAILY_COINS) + Math.min(p.streak, 14) * 120;
    const milestone = p.streak % 7 === 0 ? 3000 : 0;
    const boost = globalThis.SH_BOOST ? globalThis.SH_BOOST() : 1;
    const gained = Math.round((base + milestone) * boost);
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
    // Progressive jackpot shared by every slot machine: 1% of each bet feeds the pot,
    // and every spin has a small chance (bigger bets = better odds) to win all of it.
    const jp = ensureJackpot();
    jp.pool += Math.max(1, Math.floor(bet * 0.01));
    let jackpotWon = 0;
    if (Math.random() < Math.min(1 / 1500, bet / 3000000)) {
      jackpotWon = Math.floor(jp.pool); payout += jackpotWon; line = '💰 PROGRESSIVE JACKPOT!';
      jp.last = { nick: p.nick || 'Player', amount: jackpotWon, ts: Date.now() }; jp.pool = JACKPOT_SEED;
    }
    p.coins += payout; recordPlay(p, bet, payout); save();
    if (jackpotWon && jackpotHook) { if (rigDry) rigPending.push(() => jackpotHook(p, jackpotWon)); else { try { jackpotHook(p, jackpotWon); } catch (e) {} } }
    sendJson(res, 200, { reels: reels.map((r) => r.s), payout, win: payout - bet, line, jackpot: jackpotWon, jackpotPool: Math.floor(jp.pool), profile: publicProfile(cid) }); return true;
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
    if (handValue(g.player) > 21) { g.done = true; g.result = 'bust'; /* bet already taken */ recordPlay(p, g.bet, 0); save(); }
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
    if (it.staff) return (sendJson(res, 200, { error: 'not-for-sale' }), true);
    if ((itemCfg(it) || {}).off) return (sendJson(res, 200, { error: 'unavailable', message: 'That item is not for sale right now.' }), true);
    if (p.inventory.includes(it.id) || it.price === 0) return (sendJson(res, 200, { error: 'owned', profile: publicProfile(cid) }), true);
    const cost = priceOf(it);
    if (cost > p.coins) return (sendJson(res, 200, { error: 'broke', profile: publicProfile(cid) }), true);
    p.coins -= cost; p.inventory.push(it.id); save(); flush();
    sendJson(res, 200, { ok: true, profile: publicProfile(cid) }); return true;
  }
  if (path === '/api/casino/equip' && req.method === 'POST') {
    const body = await readBody(req); const id = String(body.itemId || '');
    if (id === 'none-tag') { p.tag = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-color') { p.color = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-banner') { p.banner = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-avatarFx') { p.avatarFx = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-titlefx') { p.titleFx = ''; save(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    if (id === 'none-hat' || id === 'none-acc' || id === 'none-trail') { ensureLook(p)[id.slice(5)] = ''; save(); flush(); return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); }
    const it = storeItem(id);
    if (!it || !ownsItem(p, it)) return (sendJson(res, 200, { error: 'not-owned' }), true);
    if (it.type === 'emote') return (sendJson(res, 200, { ok: true, profile: publicProfile(cid) }), true); // emotes are used, not equipped
    if (LOOK_SLOTS.includes(it.type)) ensureLook(p)[it.type] = it.id;
    else if (it.type === 'tag') { p.tag = it.label; if (it.custom || it.staff) p.titleFx = it.fx || ''; }
    else if (it.type === 'banner') p.banner = it.ref || it.value;
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
    const ri = rigMinesIntent(cid, req, g);
    if (ri && ri.act === 'safe' && g.positions.has(tile)) { // rigged: move the bomb to a tile that is still hidden
      const free = []; for (let t = 0; t < 25; t++) if (t !== tile && !g.positions.has(t) && !g.picks.includes(t)) free.push(t);
      if (free.length) { g.positions.delete(tile); g.positions.add(free[Math.floor(Math.random() * free.length)]); }
    } else if (ri && ri.act === 'boom' && !g.positions.has(tile)) { // rigged: this tile is a bomb after all
      const old = [...g.positions].filter((t) => !g.picks.includes(t)); if (old.length) { g.positions.delete(old[Math.floor(Math.random() * old.length)]); g.positions.add(tile); }
    }
    if (g.positions.has(tile)) {
      g.done = true; recordPlay(p, g.bet, 0); save();
      if (ri) rigDone(ri.rule, cid, 'mines', p, g.bet, 0, 1, ri.act !== 'safe');
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
    { const rm = rigFind(cid, 'mines', !!(req._auth && req._auth.role)); if (rm) rigDone(rm, cid, 'mines', p, g.bet, payout, 1, true); }
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
    if (it.staff) return (sendJson(res, 200, { error: 'not-giftable' }), true);
    if (!p.inventory.includes(itemId)) return (sendJson(res, 200, { error: 'not-owned' }), true);
    const rid = toCid && casino.users[toCid] ? toCid : null;
    if (!rid) return (sendJson(res, 200, { error: 'no-recipient' }), true);
    if (rid === cid) return (sendJson(res, 200, { error: 'self' }), true);
    const rp = casino.users[rid];
    if (rp.inventory.includes(itemId)) return (sendJson(res, 200, { error: 'already-owns' }), true);
    p.inventory = p.inventory.filter((x) => x !== itemId);
    if (p.tag === it.label) p.tag = '';
    if (p.color === it.value) p.color = '';
    if (p.banner === it.value || (it.ref && p.banner === it.ref)) p.banner = '';
    if (p.avatarFx === it.value) p.avatarFx = '';
    if (LOOK_SLOTS.includes(it.type) && ensureLook(p)[it.type] === it.id) p.look[it.type] = LOOK_DEFAULT[it.type];
    rp.inventory.push(itemId);
    save(); flush();
    sendJson(res, 200, { ok: true, itemId, toNick: rp.nick || 'player', profile: publicProfile(cid) }); return true;
  }

  if (path === '/api/casino/tournament') {
    sendJson(res, 200, tournamentState(cid)); return true;
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

// ---- admin: welcome tour controls (owner only; server.js checks the role) ----
export function tourAdmin(op, a) {
  a = a || {}; casino.cfg = casino.cfg || {};
  if (op === 'set') {
    if (typeof a.on === 'boolean') casino.cfg.tutOn = a.on;
    if (a.reward != null) { const r = Math.floor(Number(a.reward)); if (!Number.isFinite(r) || r < 0 || r > 1e12) return { error: 'bad-value', message: 'Reward must be a number from 0 to 1,000,000,000,000.' }; casino.cfg.tutReward = r; }
    save(); flush();
  } else if (op === 'replay') { casino.cfg.tutVer = tutVer() + 1; save(); flush(); }
  else if (op === 'reset') {
    if (!a.cid) return { error: 'no-id' };
    const p = profileOf(a.cid); p.tut = { done: false, on: false, n: 0, ver: tutVer(), paid: !a.payAgain }; save(); flush();
  }
  const ver = tutVer(); let done = 0, started = 0, pending = 0, total = 0;
  for (const p of Object.values(casino.users)) { total++; const t = p.tut; if (t && !t.legacy && (t.ver | 0) >= ver) { if (t.done) done++; else if (t.on) started++; else pending++; } else pending++; }
  return { ok: true, on: tutOn(), reward: tutReward(), version: ver, plays: TUT_PLAYS, counts: { total, done, started, pending } };
}
