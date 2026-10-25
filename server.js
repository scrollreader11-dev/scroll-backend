// ============================================================
// SCROLL UNBLOCKER — all-in-one server
// Serves the website (dist/) + Wisp proxy (same-origin) and
// implements the backend APIs the app needs:
//   - /api/tmdb/*   Movies/TV catalog (TMDB)        [TMDB_API_KEY]
//   - /api/generate AI chat (Groq)                   [GROQ_API_KEY]
//   - /api/ai/*     conversation history (stubbed, local-only)
//   - /api/legal/*  policy gate (always accepted)
// Missing game/app assets are proxied from petezahgames.com.
// ============================================================
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import sirv from 'sirv';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import { handleSkribblUpgrade } from './skribbl.js';
import { handleCasino, initCasino, getCosmetics, handleBattleUpgrade, grantCoins, buildAchievements } from './casino.js';
await initCasino();

// Keep the server (and the Wisp proxy tunnels) alive no matter what: a single
// unhandled error in any request/handler must NOT take the whole process down,
// because a crash drops every in-flight proxy connection (Wisp MuxTaskEnded).
process.on('unhandledRejection', (err) => { try { console.error('unhandledRejection:', err && err.message ? err.message : err); } catch (e) {} });
process.on('uncaughtException', (err) => { try { console.error('uncaughtException:', err && err.message ? err.message : err); } catch (e) {} });

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');
const UPSTREAM = process.env.UPSTREAM_ORIGIN || 'https://petezahgames.com';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const serve = sirv(distDir, {
  dev: false, etag: true,
  // Vite's /assets/* files are content-hashed, so they can be cached forever.
  // A returning visitor's browser then never re-requests the whole JS/CSS
  // bundle — zero load on the server for repeat visits and navigation.
  // (Non-hashed files like presence.js keep revalidating so updates propagate.)
  setHeaders(res, pathname) {
    if (/^\/assets\//.test(pathname)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    // Game thumbnails rarely change: cache hard so the grid loads instantly on
    // repeat visits and navigation instead of re-requesting ~1,200 images.
    else if (/^\/storage\/images\//.test(pathname)) res.setHeader('cache-control', 'public, max-age=604800, immutable');
  },
});

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}
function looksLikeFile(path) {
  const last = path.split('/').pop() || '';
  return last.includes('.');
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}
function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || (req.socket && req.socket.remoteAddress) || '';
}

// ============================================================
// ADMIN + LIVE PRESENCE
// In-memory (kept warm by the UptimeRobot pinger). Best-effort
// persisted to /tmp so it survives a warm restart; a full redeploy
// resets it, which is fine for an MVP.
// ============================================================
// No hardcoded default: set ADMIN_PASSWORD in your environment. If it is unset,
// the admin panel is disabled entirely (never a known/guessable password in a
// public repo).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const STATE_FILE = '/tmp/scrollhub-admin-state.json';
const PLAYER_TTL = 35000; // ms since last heartbeat before "offline"

// ------------------------------------------------------------
// Durable cloud storage (Upstash Redis REST).
// /tmp is wiped on every Render redeploy / sleep, so chat + admin
// state are mirrored to Upstash when its env vars are present.
// Falls back to /tmp-only behavior when they are not.
// ------------------------------------------------------------
const KV_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const kvEnabled = !!(KV_URL && KV_TOKEN);
async function kvGet(key) {
  if (!kvEnabled) return null;
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(['GET', key]),
  });
  if (!r.ok) throw new Error('kv get ' + r.status);
  const j = await r.json();
  return j && typeof j.result === 'string' ? j.result : null;
}
async function kvSet(key, value) {
  if (!kvEnabled) return;
  const r = await fetch(KV_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(['SET', key, value]),
  });
  if (!r.ok) throw new Error('kv set ' + r.status);
}
// Debounced KV writers so a busy chat can't blow the free command budget.
let _stateDirty = false, _chatDirty = false;
async function kvFlush() {
  if (!kvEnabled) return;
  try {
    if (_stateDirty) { _stateDirty = false; await kvSet('sh:state', JSON.stringify({ settings: admin.settings, bansByIp: admin.bansByIp, stats, customGames: admin.customGames, chatOwners: admin.chatOwners })); }
  } catch (e) { _stateDirty = true; }
  try {
    if (_chatDirty) { _chatDirty = false; const trimmed = {}; for (const k in chat.messages) trimmed[k] = (chat.messages[k] || []).slice(-800); await kvSet('sh:chat', JSON.stringify({ channels: chat.channels, messages: trimmed, rev: chat.rev, announcements: chat.announcements })); }
  } catch (e) { _chatDirty = true; }
}
setInterval(kvFlush, 12000);

const admin = {
  settings: { maintenance: false, redirect: '', announcement: '' },
  bansByIp: {},   // ip -> {nickname, reason, ts}
  kicks: {},      // clientId -> {message, ts}  (one-shot)
  broadcast: null,// {text, ts}  shown to everyone once
  commands: {},   // clientId -> [ {type, ...} ]  (one-shot queue)
  frozen: {},     // clientId -> until (0 = indefinite)
  customGames: [],// admin-added games shown to everyone
  chatOwners: {}  // clientId -> true  (designated chat owners)
};
// Replicates the frontend's generateGameId so ids stay consistent.
function makeGameId(label, url) {
  let u = String(url || '').trim();
  try { u = decodeURIComponent(u); } catch (e) {}
  u = u.replace(/\/index\.html(?=([?#]|$))/gi, '').replace(/\/+$/, '');
  return (String(label || '') + '-' + u).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}
const players = new Map(); // clientId -> {id, nickname, ip, location, firstSeen, lastSeen}
const chatMsgCount = new Map(); // cid -> number of chat messages sent (for achievements)
const nameOwners = new Map(); // lowercased nickname -> cid currently holding it
// Changes on every restart (and when an admin resets): clients whose stored
// nickname predates this value are forced to re-enter their name on next load.
let nickEpoch = Date.now();
const geoCache = new Map(); // ip -> location string
const stats = { peakOnline: 0, peakAt: 0, hourly: new Array(24).fill(0), gamePlays: {}, totalSessions: 0 };
const events = []; // recent activity: {ts, type, nickname, detail}
function logEvent(type, nickname, detail) {
  events.push({ ts: Date.now(), type, nickname: String(nickname || '').slice(0, 40), detail: String(detail || '').slice(0, 80) });
  if (events.length > 250) events.shift();
}

function applyState(saved) {
  if (!saved) return;
  if (saved.settings) admin.settings = saved.settings;
  if (saved.bansByIp) admin.bansByIp = saved.bansByIp;
  if (saved.stats) Object.assign(stats, saved.stats);
  if (Array.isArray(saved.customGames)) admin.customGames = saved.customGames;
  if (saved.chatOwners) admin.chatOwners = saved.chatOwners;
}
try {
  const fs = await import('node:fs');
  if (fs.existsSync(STATE_FILE)) applyState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
} catch {}
// Durable copy wins over the ephemeral /tmp copy.
try { const s = await kvGet('sh:state'); if (s) applyState(JSON.parse(s)); } catch (e) { console.log('kv state load failed:', e.message); }
async function saveState() {
  _stateDirty = true;
  try {
    const fs = await import('node:fs');
    fs.writeFileSync(STATE_FILE, JSON.stringify({ settings: admin.settings, bansByIp: admin.bansByIp, stats, customGames: admin.customGames, chatOwners: admin.chatOwners }));
  } catch {}
}
setInterval(saveState, 60000);

async function geoLookup(ip) {
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return 'Local';
  if (geoCache.has(ip)) return geoCache.get(ip);
  // ip-api free tier is ~45 req/min; back off globally if it ever 429s so we
  // never get the whole server IP temporarily banned.
  if (Date.now() < geoCooldownUntil) return 'Unknown';
  geoCache.set(ip, 'Locating…');
  try {
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country`);
    if (r.status === 429) { geoCooldownUntil = Date.now() + 120000; geoCache.delete(ip); return 'Unknown'; }
    const d = await r.json();
    const loc = d.status === 'success'
      ? [d.city, d.regionName, d.country].filter(Boolean).join(', ')
      : 'Unknown';
    geoCache.set(ip, loc);
    return loc;
  } catch { geoCache.set(ip, 'Unknown'); return 'Unknown'; }
}
let geoCooldownUntil = 0;
// Reserve a nickname to one person at a time. If it's taken by someone else
// who's online, append a number so each active player has a unique name.
function uniqueNick(name, cid) {
  const base = String(name || 'Guest');
  if (!cid || base.toLowerCase() === 'guest') return base; // guests may share "Guest"
  for (const [k, v] of nameOwners) if (v === cid) nameOwners.delete(k); // release this cid's old claims
  let candidate = base, n = 1;
  while (n <= 999) {
    const key = candidate.toLowerCase();
    const owner = nameOwners.get(key);
    if (!owner || owner === cid) { nameOwners.set(key, cid); return candidate; }
    n++; candidate = base + n;
  }
  const fallback = base + Math.floor(1000 + Math.random() * 9000);
  nameOwners.set(fallback.toLowerCase(), cid); return fallback;
}
function prunePlayers() {
  const now = Date.now();
  for (const [id, p] of players) if (now - p.lastSeen > PLAYER_TTL) { logEvent('leave', p.nickname); players.delete(id); for (const [k, v] of nameOwners) if (v === id) nameOwners.delete(k); }
}
setInterval(prunePlayers, 15000);

// ---- auto-filter for offensive nicknames ----
const BAD_WORDS = [
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'kike', 'spic', 'chink', 'coon',
  'cunt', 'fuck', 'shit', 'bitch', 'dick', 'pussy', 'cock', 'whore', 'slut',
  'rape', 'nazi', 'hitler', 'kys', 'pedo',
];
function cleanNick(nick) {
  const low = nick.toLowerCase().replace(/[^a-z]/g, '');
  for (const w of BAD_WORDS) {
    if (low.includes(w)) return 'Guest' + Math.floor(1000 + Math.random() * 9000);
  }
  return nick;
}

// ---- timed-ban + timed-freeze helpers (auto-expire) ----
function banActive(ip) {
  const b = admin.bansByIp[ip];
  if (!b) return null;
  if (b.until && Date.now() > b.until) { delete admin.bansByIp[ip]; saveState(); return null; }
  return b;
}
function frozenActive(id) {
  if (!(id in admin.frozen)) return false;
  const until = admin.frozen[id];
  if (until && Date.now() > until) { delete admin.frozen[id]; return false; }
  return true;
}

// Visitor heartbeat. Returns live site state + any command for this client.
async function handlePresence(req, res) {
  const body = await readBody(req);
  const id = String(body.id || '').slice(0, 64);
  const activity = String(body.activity || '').slice(0, 80);
  const ip = clientIp(req);
  if (!id) return sendJson(res, 400, { error: 'no id' });
  const nickname = uniqueNick(cleanNick(String(body.nickname || 'Guest').slice(0, 40)), id);

  const ban = banActive(ip);
  if (ban) {
    players.delete(id);
    return sendJson(res, 200, { banned: true, reason: ban.reason || '', nickname });
  }
  const now = Date.now();
  const existing = players.get(id);
  // analytics
  try {
    stats.hourly[new Date().getHours()]++;
    if (!existing) { stats.totalSessions++; logEvent('join', nickname); }
    if (activity && activity.indexOf('\u{1F3AE}') === 0 && activity !== (existing && existing.activity)) {
      const gn = activity.replace(/^\u{1F3AE}\s*/u, '').trim();
      if (gn && gn !== 'In a game') { stats.gamePlays[gn] = (stats.gamePlays[gn] || 0) + 1; logEvent('play', nickname, gn); }
    }
  } catch (e) {}
  players.set(id, {
    id, nickname, ip,
    activity: activity || existing?.activity || '',
    location: existing?.location || 'Locating…',
    firstSeen: existing?.firstSeen || now,
    lastSeen: now,
  });
  if (!existing || existing.location === 'Locating…') {
    geoLookup(ip).then((loc) => { const p = players.get(id); if (p) p.location = loc; });
  }
  const kick = admin.kicks[id];
  if (kick) delete admin.kicks[id];
  const commands = admin.commands[id] || [];
  if (commands.length) delete admin.commands[id];
  return sendJson(res, 200, {
    banned: false,
    nickname, // sanitized — client updates its stored nick if it changed
    maintenance: admin.settings.maintenance,
    redirect: admin.settings.redirect || '',
    announcement: admin.settings.announcement || '',
    kick: kick || null,
    broadcast: admin.broadcast || null,
    frozen: frozenActive(id),
    takeover: admin.settings.takeover || null,
    nickEpoch,
    commands,
  });
}

// Password-guarded admin control endpoint.
async function handleAdmin(req, res) {
  const body = await readBody(req);
  if (!ADMIN_PASSWORD || body.password !== ADMIN_PASSWORD) return sendJson(res, 403, { error: 'bad password' });
  const action = body.action;

  if (action === 'state') {
    prunePlayers();
    const list = [...players.values()].sort((a, b) => b.lastSeen - a.lastSeen).map((p) => ({
      id: p.id, nickname: p.nickname, location: p.location, ip: p.ip,
      activity: p.activity || '',
      online: Date.now() - p.lastSeen < PLAYER_TTL,
      since: p.firstSeen,
      frozen: frozenActive(p.id),
      frozenUntil: admin.frozen[p.id] || 0,
      chatOwner: !!admin.chatOwners[p.id],
    }));
    const bans = Object.entries(admin.bansByIp).map(([ip, b]) => ({ ip, nickname: b.nickname, reason: b.reason || '', ts: b.ts, until: b.until || 0 }));
    const online = list.filter((p) => p.online).length;
    if (online > stats.peakOnline) { stats.peakOnline = online; stats.peakAt = Date.now(); }
    const topGames = Object.entries(stats.gamePlays).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, plays]) => ({ name, plays }));
    return sendJson(res, 200, {
      settings: admin.settings, players: list, bans, count: list.length,
      stats: { peakOnline: stats.peakOnline, peakAt: stats.peakAt, hourly: stats.hourly, topGames, totalSessions: stats.totalSessions },
      events: events.slice(-60).reverse(),
      customGames: admin.customGames,
      announcements: chat.announcements.slice(-20),
    });
  }
  if (action === 'settings') {
    const s = body.settings || {};
    if (typeof s.maintenance === 'boolean') admin.settings.maintenance = s.maintenance;
    if (typeof s.redirect === 'string') admin.settings.redirect = s.redirect.trim();
    if (typeof s.announcement === 'string') admin.settings.announcement = s.announcement.slice(0, 300);
    await saveState();
    return sendJson(res, 200, { ok: true, settings: admin.settings });
  }
  if (action === 'ban') {
    const id = String(body.id || '');
    const p = players.get(id);
    const ip = p?.ip || String(body.ip || '');
    const reason = String(body.reason || '').slice(0, 120);
    const mins = Number(body.minutes) || 0; // 0 = permanent
    const until = mins > 0 ? Date.now() + mins * 60000 : 0;
    if (ip) {
      admin.bansByIp[ip] = { nickname: p?.nickname || 'Unknown', reason, ts: Date.now(), until };
      logEvent('ban', p?.nickname || 'Unknown', reason + (mins ? ` (${mins}m)` : ' (permanent)'));
      players.delete(id); delete admin.frozen[id]; await saveState();
    }
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'unban') {
    const ip = String(body.ip || '');
    if (ip) { delete admin.bansByIp[ip]; await saveState(); }
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'kick') {
    const id = String(body.id || '');
    admin.kicks[id] = { message: String(body.message || 'You have been kicked.').slice(0, 200), ts: Date.now() };
    logEvent('kick', players.get(id)?.nickname || 'Unknown');
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'broadcast') {
    const text = String(body.text || '').slice(0, 300);
    admin.broadcast = text ? { text, ts: Date.now() } : null;
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'givecoins') {
    const id = String(body.id || '');
    const amount = Math.max(-10000000, Math.min(10000000, Math.floor(Number(body.amount) || 0)));
    const bal = grantCoins(id, amount);
    if (bal === null) return sendJson(res, 400, { error: 'bad id' });
    logEvent('coins', players.get(id)?.nickname || 'Player', (amount >= 0 ? '+' : '') + amount + ' Scrolls');
    return sendJson(res, 200, { ok: true, balance: bal });
  }
  if (action === 'giveall') {
    const amount = Math.max(0, Math.min(1000000, Math.floor(Number(body.amount) || 0)));
    prunePlayers();
    let n = 0;
    for (const [id] of players) { grantCoins(id, amount); n++; }
    logEvent('coins', 'Everyone', '+' + amount + ' Scrolls to ' + n);
    return sendJson(res, 200, { ok: true, count: n });
  }
  if (action === 'resetnicks') {
    nickEpoch = Date.now();
    nameOwners.clear();
    logEvent('reset', 'Nicknames', 'everyone re-enters on next load');
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'takeover') {
    // Persistent site-wide visual effect applied to everyone online (and
    // anyone who joins) until turned off.
    const MODES = ['disco', 'matrix', 'snow', 'confetti', 'strobe', 'invert', 'spin', 'bounce'];
    const mode = String(body.mode || '');
    admin.settings.takeover = MODES.includes(mode) ? { mode, ts: Date.now() } : null;
    await saveState();
    return sendJson(res, 200, { ok: true, takeover: admin.settings.takeover });
  }
  if (action === 'freeze') {
    const id = String(body.id || '');
    const mins = Number(body.minutes) || 0; // 0 = until manually unfrozen
    if (body.on) admin.frozen[id] = mins > 0 ? Date.now() + mins * 60000 : 0;
    else delete admin.frozen[id];
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'command') {
    const id = String(body.id || '');
    const cmd = body.cmd || {};
    const type = String(cmd.type || '');
    const ALLOWED = ['popup', 'message', 'redirect', 'shake', 'flash', 'tabtitle', 'rickroll', 'jumpscare'];
    if (!id || !ALLOWED.includes(type)) return sendJson(res, 400, { error: 'bad command' });
    const clean = { type, ts: Date.now() };
    if (cmd.text != null) clean.text = String(cmd.text).slice(0, 300);
    if (cmd.url != null) clean.url = String(cmd.url).slice(0, 500);
    if (cmd.title != null) clean.title = String(cmd.title).slice(0, 120);
    if (!admin.commands[id]) admin.commands[id] = [];
    admin.commands[id].push(clean);
    if (admin.commands[id].length > 10) admin.commands[id] = admin.commands[id].slice(-10);
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'sendall') {
    const cmd = body.cmd || {};
    const type = String(cmd.type || '');
    const ALLOWED = ['popup', 'message', 'redirect', 'shake', 'flash', 'tabtitle', 'rickroll', 'jumpscare'];
    if (!ALLOWED.includes(type)) return sendJson(res, 400, { error: 'bad command' });
    const clean = { type, ts: Date.now() };
    if (cmd.text != null) clean.text = String(cmd.text).slice(0, 300);
    if (cmd.url != null) clean.url = String(cmd.url).slice(0, 500);
    if (cmd.title != null) clean.title = String(cmd.title).slice(0, 120);
    prunePlayers();
    let n = 0;
    for (const [id] of players) {
      if (!admin.commands[id]) admin.commands[id] = [];
      admin.commands[id].push({ ...clean });
      if (admin.commands[id].length > 10) admin.commands[id] = admin.commands[id].slice(-10);
      n++;
    }
    logEvent('broadcast', 'Everyone', type + (clean.text ? ': ' + clean.text : ''));
    return sendJson(res, 200, { ok: true, sent: n });
  }
  if (action === 'addgame') {
    const label = String(body.label || '').slice(0, 80).trim();
    const url = String(body.url || '').slice(0, 500).trim();
    if (!label || !url) return sendJson(res, 400, { error: 'Label and URL are required' });
    const imageUrl = String(body.imageUrl || '').slice(0, 500).trim() || '/storage/images/main/googleforms.jpg';
    const cats = String(body.category || '').slice(0, 40).trim();
    const g = { id: makeGameId(label, url), label, url, imageUrl, categories: cats ? [cats] : [], isGlobal: true };
    admin.customGames = admin.customGames.filter((x) => x.id !== g.id);
    admin.customGames.unshift(g);
    await saveState();
    return sendJson(res, 200, { ok: true, game: g });
  }
  if (action === 'delgame') {
    const id = String(body.id || '');
    admin.customGames = admin.customGames.filter((x) => x.id !== id);
    await saveState();
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'announce') {
    const title = String(body.title || '').slice(0, 100).trim();
    const content = String(body.content || '').slice(0, 1000).trim();
    if (!title && !content) return sendJson(res, 400, { error: 'Title or message required' });
    const a = { id: 'a' + Date.now().toString(36), title: title || 'Announcement', content, important: body.important ? 1 : 0, at: Date.now() };
    chat.announcements.push(a);
    if (chat.announcements.length > 30) chat.announcements = chat.announcements.slice(-30);
    await saveChat();
    return sendJson(res, 200, { ok: true, announcement: a });
  }
  if (action === 'delannounce') {
    const id = String(body.id || '');
    chat.announcements = chat.announcements.filter((x) => x.id !== id);
    await saveChat();
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'setowner') {
    const id = String(body.id || '');
    if (!id) return sendJson(res, 400, { error: 'no id' });
    if (body.on) admin.chatOwners[id] = true; else delete admin.chatOwners[id];
    await saveState();
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 400, { error: 'unknown action' });
}

// ---------- Movies (TMDB) ----------
async function tmdbFetch(endpoint) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error('TMDB_API_KEY not configured');
  const url = `${TMDB_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${key}`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`TMDB ${r.status}`);
  return r.json();
}
async function handleTmdb(path, query, res) {
  const q = query.get('q') || query.get('query') || '';
  const FIXED = {
    '/search': `/search/multi?query=${encodeURIComponent(q)}&include_adult=false`,
    '/movie/popular': '/movie/popular?language=en-US&page=1',
    '/movie/trending': '/trending/movie/week',
    '/movie/top_rated': '/movie/top_rated?language=en-US&page=1',
    '/movie/now_playing': '/movie/now_playing?language=en-US&page=1',
    '/movie/search': `/search/movie?query=${encodeURIComponent(q)}&include_adult=false`,
    '/tv/popular': '/tv/popular?language=en-US&page=1',
    '/tv/trending': '/trending/tv/week',
    '/tv/top_rated': '/tv/top_rated?language=en-US&page=1',
    '/tv/now_playing': '/tv/on_the_air?language=en-US&page=1',
    '/tv/search': `/search/tv?query=${encodeURIComponent(q)}&include_adult=false`,
  };
  let endpoint = FIXED[path];
  if (!endpoint) {
    let m;
    if ((m = path.match(/^\/movie\/(\d+)$/))) endpoint = `/movie/${m[1]}?append_to_response=videos,credits`;
    else if ((m = path.match(/^\/tv\/(\d+)$/))) endpoint = `/tv/${m[1]}?append_to_response=videos,credits`;
    else if ((m = path.match(/^\/tv\/(\d+)\/season\/(\d+)$/))) endpoint = `/tv/${m[1]}/season/${m[2]}`;
  }
  if (!endpoint) return sendJson(res, 404, { error: 'Unknown TMDB endpoint' });
  try {
    sendJson(res, 200, await tmdbFetch(endpoint));
  } catch (e) {
    const msg = String(e.message || e);
    sendJson(res, msg.includes('not configured') ? 503 : 502, { error: msg });
  }
}

// ---------- AI (Groq) ----------
const MODEL_MAP = {
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b',
  'llama3-8b-8192': 'openai/gpt-oss-20b',
  'llama3-70b-8192': 'openai/gpt-oss-120b',
};
async function handleGenerate(req, res) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return sendJson(res, 503, { error: 'AI is not configured yet (missing GROQ_API_KEY).' });
  const body = await readBody(req);
  const { prompt, model, system, groqMessages } = body;
  const resolvedModel = (model && (MODEL_MAP[model] || model)) || 'openai/gpt-oss-20b';
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  if (Array.isArray(groqMessages) && groqMessages.length) messages.push(...groqMessages);
  else if (prompt) messages.push({ role: 'user', content: prompt });
  if (!messages.length) return sendJson(res, 400, { error: 'Empty prompt' });
  try {
    const gr = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: resolvedModel, messages, temperature: 0.7, max_tokens: 2048 }),
    });
    const data = await gr.json().catch(() => ({}));
    if (!gr.ok) return sendJson(res, 502, { error: data?.error?.message || `Groq ${gr.status}` });
    const msg = data.choices?.[0]?.message || {};
    let content =
      (typeof msg.content === 'string' && msg.content.trim()) ||
      (typeof msg.reasoning === 'string' && msg.reasoning.trim()) || '';
    if (!content && Array.isArray(msg.content)) {
      content = msg.content.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('').trim();
    }
    sendJson(res, 200, { response: content || 'No response.' });
  } catch (e) {
    sendJson(res, 502, { error: String(e.message || e) });
  }
}

// ---------- missing-asset upstream proxy (games/app icons/iframe) ----------
// ---- upstream asset cache ----------------------------------
// One small/medium asset is fetched from upstream ONCE, then served from RAM to
// every other player. This is the big lever for concurrent users on a tiny
// instance: shared game assets stop re-hitting petezahgames.com per person.
const CACHE_MAX_ITEM = 2 * 1024 * 1024;     // only cache responses <= 2MB
const CACHE_MAX_TOTAL = 56 * 1024 * 1024;   // total RAM budget for the cache (leave headroom on 512MB so we never OOM-kill Wisp)
const CACHE_TTL = 6 * 3600 * 1000;          // 6h freshness
const assetCache = new Map();               // url -> {status, ctype, body, ts}
let cacheBytes = 0;
const inflight = new Map();                  // url -> Promise (dedupes concurrent first-loads)
// Fresh hit only (within TTL) — drives the fast path.
function cacheGet(url) {
  const e = assetCache.get(url);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) return null; // stale: keep it for fallback, just don't count as fresh
  assetCache.delete(url); assetCache.set(url, e); // LRU: move to newest
  return e;
}
// Any copy we still hold, fresh or stale — used to keep the site working when
// upstream rate-limits us or errors.
function cachePeek(url) { return assetCache.get(url) || null; }
function cachePut(url, status, ctype, body) {
  if (!body || body.length > CACHE_MAX_ITEM) return;
  while (cacheBytes + body.length > CACHE_MAX_TOTAL && assetCache.size) {
    const k = assetCache.keys().next().value; const old = assetCache.get(k);
    assetCache.delete(k); cacheBytes -= old.body.length;
  }
  if (assetCache.has(url)) cacheBytes -= assetCache.get(url).body.length;
  assetCache.set(url, { status, ctype, body, ts: Date.now() });
  cacheBytes += body.length;
}

// ---- outbound concurrency limiter -------------------------
// All players share one server IP, so bursts of upstream fetches trip the
// source site's rate limiter (the "Too Many Requests" error). Cap how many
// requests we make at once and queue the rest — smooth instead of spiky.
const MAX_UPSTREAM = 6;
let activeUpstream = 0;
const upQueue = [];
function acquireUpstream() {
  if (activeUpstream < MAX_UPSTREAM) { activeUpstream++; return Promise.resolve(); }
  return new Promise((res) => upQueue.push(res));
}
function releaseUpstream() {
  const next = upQueue.shift();
  if (next) next(); else activeUpstream--;
}
// A 1x1 transparent PNG — shown instead of a broken/missing image so the page
// never surfaces an error; cached only briefly so it refills once upstream is ok.
const BLANK_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');
function looksImage(url) { return /\.(png|jpe?g|gif|webp|bmp|svg|ico)(\?|$)/i.test(url); }
function gentleFallback(req, res, url) {
  if (looksImage(url) || /image\//.test(req.headers['accept'] || '')) {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=15', 'content-length': BLANK_PNG.length });
    res.end(req.method === 'HEAD' ? undefined : BLANK_PNG);
  } else {
    res.writeHead(503, { 'content-type': 'text/plain', 'retry-after': '3', 'cache-control': 'no-store' });
    res.end('Busy, retry');
  }
}
// Game assets are content-stable, so let browsers cache images/fonts/media
// hard (a week, no revalidation) — scrolling back or refreshing becomes
// instant instead of re-requesting every thumbnail. Code/markup stays short.
function cacheControlFor(ctype) {
  ctype = String(ctype || '');
  if (/^(image|font|audio|video)\//.test(ctype) || /application\/font|wasm/.test(ctype)) return 'public, max-age=604800, immutable';
  if (/text\/html/.test(ctype)) return 'public, max-age=300';
  return 'public, max-age=86400';
}
function serveCached(res, e) {
  res.writeHead(e.status, {
    'content-type': e.ctype,
    'cache-control': cacheControlFor(e.ctype),
    'access-control-allow-origin': '*',
    'content-length': e.body.length,
    'x-sh-cache': 'hit',
  });
  res.end(e.body);
}

// The games list: pull it LIVE from PeteZah so new games show up
// automatically, with the bundled snapshot as a safe fallback. Cached
// briefly so we don't refetch on every page load.
let collectionCache = { data: null, ts: 0, source: '', ubg: 0 };
function countGames(txt) { try { const d = JSON.parse(txt); const g = Array.isArray(d) ? d : (d.games || []); return g.length; } catch (e) { return -1; } }

// ---- ubgwtf.gitlab.io game pack ----
// Scrape ubgwtf's "all games" index for every game slug and build catalog
// entries. Games load straight from GitLab (zero load on this server) and
// thumbnails come from GitLab too. Cached 6h; failures are harmless.
let ubgCache = { games: [], ts: 0 };
function titleCase(s) { return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
// Hand-pinned, known-good versions of specific games. These REPLACE every
// other copy in the catalog (deduped by name) and sit near the top so they're
// easy to find and test. Add more here as needed.
// Inline SVG thumbnail (data URI) so self-hosted games get an instant, always-
// available image with no external request and no CDN dependency.
function localThumb(label, c1, c2) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/>' +
    '</linearGradient></defs><rect width="400" height="400" fill="url(#g)"/>' +
    '<text x="200" y="218" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" ' +
    'font-size="44" font-weight="800" fill="#ffffff">' + label + '</text></svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// Self-hosted games: served as static files from THIS domain, so they load
// instantly, work on locked-down school networks, and scale to many players.
// Pinned at the top of the catalog. Each game keeps its own LICENSE file.
const CATALOG_OVERRIDES = [
  { label: '2048', url: '/iframe.html?url=/storage/games/2048/index.html', imageUrl: localThumb('2048', '#edc22e', '#8f7a66'), categories: ['Puzzle', 'ScrollHub Originals'] },
  { label: 'Hextris', url: '/iframe.html?url=/storage/games/hextris/index.html', imageUrl: localThumb('HEXTRIS', '#e74c3c', '#f39c12'), categories: ['Arcade', 'ScrollHub Originals'] },
  { label: 'Clumsy Bird', url: '/iframe.html?url=/storage/games/clumsy-bird/index.html', imageUrl: localThumb('Clumsy Bird', '#4ec0ca', '#5ab552'), categories: ['Arcade', 'ScrollHub Originals'] },
  { label: 'Astray', url: '/iframe.html?url=/storage/games/astray/index.html', imageUrl: localThumb('ASTRAY', '#6a11cb', '#2575fc'), categories: ['Adventure', 'ScrollHub Originals'] },
  { label: 'Pac-Man', url: '/iframe.html?url=/storage/games/pacman/index.html', imageUrl: localThumb('PAC-MAN', '#141430', '#ffcc00'), categories: ['Arcade', 'ScrollHub Originals'] },
];
async function fetchUbgGames() {
  // The ubgwtf.gitlab.io pack loads games AND thumbnails straight from
  // gitlab.io, which school filters block -> black-screen games + blank images.
  // Excluded by default so only domain-proxied games (which actually work at
  // school) are shown. Set INCLUDE_UBG=1 to re-enable (e.g. for home use).
  if (process.env.INCLUDE_UBG !== '1') return [];
  const now = Date.now();
  if (ubgCache.games.length && now - ubgCache.ts < 6 * 3600 * 1000) return ubgCache.games;
  try {
    const ac = new AbortController(); const to = setTimeout(() => { try { ac.abort(); } catch (e) {} }, 20000);
    let up; try { up = await fetch('https://ubgwtf.gitlab.io/game/', { headers: { 'user-agent': 'Mozilla/5.0' }, signal: ac.signal }); } finally { clearTimeout(to); }
    if (up && up.ok) {
      const html = await up.text();
      const slugs = new Set();
      const re = /\/game\/([a-z0-9][a-z0-9-]*)\.html/gi;
      let m; while ((m = re.exec(html))) { const s = m[1].toLowerCase(); if (s !== 'index') slugs.add(s); }
      const games = [...slugs].map((s) => ({
        label: titleCase(s),
        // Load the game directly from GitLab (cross-origin) via a same-origin
        // wrapper, so its assets load correctly and the main page doesn't proxy it.
        url: '/extframe.html?url=https://ubgwtf.gitlab.io/' + s + '/',
        imageUrl: 'https://ubgwtf.gitlab.io/assets/upload/ubgwtforg/png/' + s + '.webp',
        categories: ['🆕 New Games'],
      }));
      // Feature Stickman Dragon Fight first among the new games.
      const si = games.findIndex((g) => /stickman-dragon-fight/.test(g.url));
      if (si > 0) { const [sg] = games.splice(si, 1); games.unshift(sg); }
      if (games.length) ubgCache = { games, ts: now };
    }
  } catch (e) {}
  return ubgCache.games;
}

async function buildCatalog(now) {
  let baseTxt = null, source = '';
  try {
    const ac = new AbortController(); const to = setTimeout(() => { try { ac.abort(); } catch (e) {} }, 15000);
    let up; try { up = await fetch(UPSTREAM + '/storage/data/collection.json', { headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' }, signal: ac.signal }); } finally { clearTimeout(to); }
    if (up && up.ok) { const txt = await up.text(); JSON.parse(txt); baseTxt = txt; source = 'live'; }
  } catch (e) {}
  if (!baseTxt) { try { const fs = await import('node:fs'); baseTxt = fs.readFileSync(join(distDir, 'storage/data/collection.json'), 'utf8'); source = 'bundled'; } catch (e) {} }
  let obj = { games: [] };
  if (baseTxt) { try { const d = JSON.parse(baseTxt); if (Array.isArray(d)) obj = { games: d }; else if (d && typeof d === 'object' && Array.isArray(d.games)) obj = d; } catch (e) {} }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.games)) obj = { games: [] };
  const base = obj.games;
  const ubg = await fetchUbgGames();
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isNew = (g) => (g.categories || []).some((c) => String(c).indexOf('New Games') >= 0);

  // Pinned, known-good versions of specific games (replace any other copies).
  const overrideKeys = new Set(CATALOG_OVERRIDES.map((o) => norm(o.label)));

  // Combine ubg-first (so a ubg copy wins over a broken PeteZah dupe), drop
  // anything an override replaces, then dedupe clones by normalized name.
  const combined = [...ubg, ...base].filter((g) => !overrideKeys.has(norm(g.label)));
  const seen = new Set(); const uniq = [];
  for (const g of combined) { const k = norm(g.label); if (!k || seen.has(k)) continue; seen.add(k); uniq.push(g); }

  // All GitLab-sourced games go to the BOTTOM of the site. The original games
  // keep the top (in their normal order) with their own reliable images, so the
  // top tiles never depend on the external GitLab image host (which fails to
  // load on some devices, e.g. iPad).
  const isGitlab = (g) => /gitlab\.io/i.test(String(g.url || '') + ' ' + String(g.imageUrl || ''));
  const topGames = uniq.filter((g) => !isGitlab(g));
  const bottomGames = uniq.filter((g) => isGitlab(g));
  // Keep non-GitLab overrides pinned on top; send GitLab overrides to the bottom.
  const topOverrides = CATALOG_OVERRIDES.filter((g) => !isGitlab(g));
  const bottomOverrides = CATALOG_OVERRIDES.filter((g) => isGitlab(g));
  const seeAll = bottomGames.length ? [{
    label: 'See All ' + bottomGames.length + '+ New Games', url: '/newgames',
    imageUrl: '/storage/images/main/arcade.jpg',
    categories: ['🆕 New Games'],
  }] : [];
  obj.games = [...topOverrides, ...topGames, ...seeAll, ...bottomOverrides, ...bottomGames];
  // Serve game thumbnails from the jsDelivr CDN (the repo's images are public),
  // so ~1,200 images load from a fast global edge in parallel instead of from
  // the single Render server. This makes the grid snappy and takes the image
  // bandwidth off the origin. Set IMG_CDN_BASE="" to serve from Render instead.
  const IMG_CDN = process.env.IMG_CDN_BASE !== undefined
    ? process.env.IMG_CDN_BASE
    : 'https://cdn.jsdelivr.net/gh/scrollreader11-dev/scroll-backend@main/dist';
  // Externally-hosted thumbnails (~760) are the slow part. Routing them through
  // this small free server (Wisp tunnel OR our own proxy) both crawls and
  // starves game loading. Instead, serve them through a free image CDN (wsrv.nl)
  // that fetches, globally caches, AND shrinks each one to a small webp — so the
  // browser downloads tiny images in parallel and this server does ZERO image
  // work (freeing it to load games). Set IMG_PROXY_BASE="" to fall back to /imgx/.
  const IMG_PROXY = process.env.IMG_PROXY_BASE !== undefined ? process.env.IMG_PROXY_BASE : 'https://wsrv.nl/';
  const thumb = (srcUrl) => IMG_PROXY
    ? IMG_PROXY + '?url=' + encodeURIComponent(srcUrl) + '&w=360&output=webp&q=72&maxage=30d'
    : null;
  for (const g of obj.games) {
    if (!g || typeof g.imageUrl !== 'string') continue;
    const img = g.imageUrl;
    // External thumbnails -> image CDN (or /imgx/ cache if the CDN is disabled).
    if (img.startsWith('/!!/')) g.imageUrl = thumb(img.slice(4)) || ('/imgx/' + img.slice(4));
    // PeteZah-proxied thumbnails -> image CDN pointed at the upstream source.
    else if (img.startsWith('/storage/ag/')) { const t = thumb(UPSTREAM + img); if (t) g.imageUrl = t; }
    // Local images -> jsDelivr CDN (fast global edge, off the origin).
    else if (IMG_CDN && img.startsWith('/storage/images/')) g.imageUrl = IMG_CDN + img;
  }
  return { text: JSON.stringify(obj), source, ubg: bottomGames.length };
}

async function serveCollection(req, res, debug) {
  const now = Date.now();
  const sendData = (txt, source, ubg) => {
    if (debug) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ source, games: countGames(txt), ubgAdded: ubg, cachedAgeSec: Math.round((now - collectionCache.ts) / 1000) })); return; }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=600', 'access-control-allow-origin': '*', 'x-sh-catalog': source }); res.end(req.method === 'HEAD' ? undefined : txt);
  };
  if (!debug && collectionCache.data && now - collectionCache.ts < 10 * 60 * 1000) return sendData(collectionCache.data, 'cache', collectionCache.ubg);
  try {
    const built = await buildCatalog(now);
    // Only accept/cache a real catalog. A build with just the few pinned games
    // (base failed to load) is treated as a failure so we fall back to bundled.
    if (built.text && countGames(built.text) > 5) { collectionCache = { data: built.text, ts: now, source: built.source, ubg: built.ubg }; return sendData(built.text, built.source, built.ubg); }
  } catch (e) {}
  if (collectionCache.data) return sendData(collectionCache.data, 'cache', collectionCache.ubg);
  // Last resort: serve the bundled catalog file raw so the site is NEVER empty.
  try {
    const fs = await import('node:fs');
    const raw = fs.readFileSync(join(distDir, 'storage/data/collection.json'), 'utf8');
    if (raw && countGames(raw) > 0) return sendData(raw, 'bundled-raw', 0);
  } catch (e) {}
  res.writeHead(502, { 'content-type': 'text/plain' }); res.end('no catalog');
}
async function proxyUpstream(req, res) {
  const key = req.url;
  const isCacheable = (req.method === 'GET' || req.method === 'HEAD') && !req.headers['range'];

  // Fast path: already in RAM.
  if (isCacheable) {
    const hit = cacheGet(key);
    if (hit) { if (req.method === 'HEAD') { res.writeHead(hit.status, { 'content-type': hit.ctype, 'content-length': hit.body.length }); res.end(); } else serveCached(res, hit); return; }
    // Collapse concurrent first-loads of the same asset into one upstream fetch.
    if (inflight.has(key)) {
      try {
        const e = await inflight.get(key);
        if (e) { if (req.method === 'HEAD') { res.writeHead(e.status, { 'content-type': e.ctype, 'content-length': e.body.length }); res.end(); } else serveCached(res, e); return; }
      } catch (err) {}
      // fell through: the shared fetch was non-cacheable (too big / streamed) — fetch our own below
    }
  }

  // Same-origin passthroughs to external game hosts (so games load directly,
  // not through the Wisp proxy): /ubg/* -> ubgwtf, /gf/* -> gameflare.
  let target;
  if (req.url.startsWith('/imgx/')) {
    // Cached proxy for an arbitrary external thumbnail. Validate the URL and
    // block internal/private hosts so this can't be abused as an open relay.
    const raw = req.url.slice(6);
    let host = '';
    try { host = new URL(raw).hostname; } catch (e) {}
    if (!/^https?:\/\//i.test(raw) || !host || host === '::1' ||
        /^(localhost|127\.|10\.|0\.|169\.254\.|192\.168\.)/i.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
      return gentleFallback(req, res, raw);
    }
    target = raw;
  }
  else if (req.url.startsWith('/ubg/')) target = 'https://ubgwtf.gitlab.io' + req.url.slice(4);
  else if (req.url.startsWith('/gf/')) target = 'https://www.gameflare.com' + req.url.slice(3);
  else target = UPSTREAM + req.url;
  const headers = {
    'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
    'accept': req.headers['accept'] || '*/*',
  };
  if (req.headers['range']) headers['range'] = req.headers['range'];

  // For cacheable requests, run the fetch under an in-flight promise so parallel
  // callers share it and the result lands in cache.
  let resolveInflight = null;
  if (isCacheable && !inflight.has(key)) {
    inflight.set(key, new Promise((r) => { resolveInflight = r; }));
  }
  const finishInflight = (val) => { if (resolveInflight) { resolveInflight(val); resolveInflight = null; } inflight.delete(key); };

  // One upstream fetch with a timeout, honoring the global concurrency limit and
  // retrying once on a 429 (after a short wait) before giving up.
  async function fetchUpstream() {
    await acquireUpstream();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const ac = new AbortController();
        const to = setTimeout(() => { try { ac.abort(); } catch (e) {} }, 25000);
        let up;
        try { up = await fetch(target, { headers, redirect: 'follow', signal: ac.signal }); }
        finally { clearTimeout(to); }
        if (up.status === 429 && attempt === 0) {
          const ra = Number(up.headers.get('retry-after')) || 0;
          await new Promise((r) => setTimeout(r, Math.min(1500, ra ? ra * 1000 : 600)));
          continue;
        }
        return up;
      }
    } finally { releaseUpstream(); }
    return null;
  }

  try {
    const up = await fetchUpstream();
    // Rate-limited / errored upstream: serve a stale copy if we have one, else a
    // gentle fallback — never a raw "Too Many Requests" to the player.
    if (!up || up.status === 429 || up.status >= 500) {
      const stale = cachePeek(key);
      if (stale) {
        finishInflight(null);
        if (req.method === 'HEAD') { res.writeHead(stale.status, { 'content-type': stale.ctype, 'content-length': stale.body.length }); res.end(); }
        else { res.writeHead(stale.status, { 'content-type': stale.ctype, 'cache-control': cacheControlFor(stale.ctype), 'access-control-allow-origin': '*', 'content-length': stale.body.length, 'x-sh-cache': 'stale' }); res.end(stale.body); }
        return;
      }
      finishInflight(null);
      gentleFallback(req, res, key);
      return;
    }
    // Upstream gate answers protected assets with 403 — just a missing asset.
    if (up.status === 403) { finishInflight(null); res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    const ctype = up.headers.get('content-type') || 'application/octet-stream';
    const outHeaders = {
      'content-type': ctype,
      'cache-control': cacheControlFor(ctype),
      'access-control-allow-origin': '*',
    };
    const ar = up.headers.get('accept-ranges'); if (ar) outHeaders['accept-ranges'] = ar;
    if (up.status === 206) { const cr = up.headers.get('content-range'); if (cr) outHeaders['content-range'] = cr; }
    const enc = up.headers.get('content-encoding');
    const len = up.headers.get('content-length');
    if (!enc && len) outHeaders['content-length'] = len;

    // Decide whether to buffer+cache: 200, cacheable request, and known size <= limit.
    const sizeOk = !len || Number(len) <= CACHE_MAX_ITEM;
    if (isCacheable && up.status === 200 && sizeOk && up.body) {
      const ab = await up.arrayBuffer();
      const body = Buffer.from(ab);
      if (body.length <= CACHE_MAX_ITEM) cachePut(key, 200, ctype, body);
      finishInflight(body.length <= CACHE_MAX_ITEM ? { status: 200, ctype, body } : null);
      outHeaders['content-length'] = body.length;
      outHeaders['x-sh-cache'] = 'miss';
      res.writeHead(200, outHeaders);
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(body);
      return;
    }

    // Big or non-cacheable: stream straight through, guard both ends.
    finishInflight(null);
    res.writeHead(up.status, outHeaders);
    if (req.method === 'HEAD' || !up.body) { res.end(); return; }
    const src = Readable.fromWeb(up.body);
    src.on('error', function () { try { res.destroy(); } catch (e) {} });
    res.on('close', function () { try { src.destroy(); } catch (e) {} });
    src.pipe(res);
  } catch (e) {
    finishInflight(null);
    const stale = cachePeek(key);
    if (stale) { try { res.writeHead(stale.status, { 'content-type': stale.ctype, 'access-control-allow-origin': '*', 'content-length': stale.body.length, 'x-sh-cache': 'stale' }); res.end(req.method === 'HEAD' ? undefined : stale.body); } catch (e2) {} return; }
    try { gentleFallback(req, res, key); } catch (e2) {}
  }
}

// ============================================================
// CHAT — one shared ScrollHub server with custom channels (tabs).
// Identity comes from the nickname cookie the presence script sets.
// ============================================================
const CHAT_FILE = '/tmp/scrollhub-chat.json';
const chat = {
  channels: [
    { id: 'general', name: 'general', description: 'Main chat', category: 'Text channels', slowmodeSeconds: 0, canSend: true },
    { id: 'games', name: 'games', description: 'Talk about games', category: 'Text channels', slowmodeSeconds: 0, canSend: true },
  ],
  messages: { general: [], games: [] },
  rev: { general: 1, games: 1 },
  announcements: [],
};
function applyChat(s) {
  if (!s) return;
  if (Array.isArray(s.channels) && s.channels.length) chat.channels = s.channels;
  if (s.messages) chat.messages = s.messages;
  if (s.rev) chat.rev = s.rev;
  if (Array.isArray(s.announcements)) chat.announcements = s.announcements;
}
try {
  const fs = await import('node:fs');
  if (fs.existsSync(CHAT_FILE)) applyChat(JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8')));
} catch (e) {}
// Durable copy wins over the ephemeral /tmp copy — this is what makes
// history survive a redeploy or the free instance sleeping.
try { const s = await kvGet('sh:chat'); if (s) applyChat(JSON.parse(s)); } catch (e) { console.log('kv chat load failed:', e.message); }
async function saveChat() {
  _chatDirty = true;
  try {
    const fs = await import('node:fs');
    const trimmed = {};
    for (const k in chat.messages) trimmed[k] = (chat.messages[k] || []).slice(-800);
    fs.writeFileSync(CHAT_FILE, JSON.stringify({ channels: chat.channels, messages: trimmed, rev: chat.rev, announcements: chat.announcements }));
  } catch (e) {}
}
setInterval(saveChat, 60000);

function parseCookies(req) {
  const out = {}; const h = req.headers.cookie || '';
  h.split(';').forEach(function (p) { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
function colorFor(seed) {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 'hsl(' + (h % 360) + ' 70% 66%)';
}
function isChatOwner(req) {
  const c = parseCookies(req);
  if (ADMIN_PASSWORD && c.sh_owner === ADMIN_PASSWORD) return true;         // the admin
  return !!admin.chatOwners[c.sh_cid];                     // a designated owner
}
function chatViewer(req) {
  const c = parseCookies(req);
  let nick = 'Guest'; try { nick = c.sh_nick ? decodeURIComponent(c.sh_nick) : 'Guest'; } catch (e) {}
  nick = cleanNick(String(nick).slice(0, 40)) || 'Guest';
  const cid = String(c.sh_cid || ('anon-' + clientIp(req))).slice(0, 64);
  const owner = isChatOwner(req);
  // Casino cosmetics the player bought/equipped show up in chat.
  let cos = { tag: '', color: '' };
  try { cos = getCosmetics(cid); } catch (e) {}
  const displayName = nick + (cos.tag ? ' ' + cos.tag : '') + (owner ? ' 👑' : '');
  const color = owner ? 'hsl(45 90% 60%)' : (cos.color || colorFor(cid));
  return { id: cid, username: displayName, avatar: '', color, rank: owner ? 'Owner' : '', owner };
}
function chatStanding(req, v) {
  const ip = clientIp(req);
  return { muted: !!banActive(ip), timedOut: frozenActive(v.id), until: 0 };
}
function chatBootPayload(req) {
  const v = chatViewer(req);
  const ch = chat.channels[0] ? chat.channels[0].id : 'general';
  return {
    live: true, join: true,
    guild: { name: 'ScrollHub', tag: 'SH' },
    channels: chat.channels,
    channelId: ch,
    messages: (chat.messages[ch] || []).slice(-300),
    hasMore: false,
    rev: String(chat.rev[ch] || 1),
    emotes: {},
    viewer: v,
    powers: v.owner
      ? { messages: true, timeout: true, ban: true, roles: false, channels: true }
      : { messages: true, timeout: false, ban: false, roles: false, channels: false },
    roles: [],
    standing: chatStanding(req, v),
    rules: { accepted: true, items: [] },
    announcements: chat.announcements.slice(-20),
  };
}
function chatFeed(req, res, q) {
  const ch = q.get('channel') || 'general';
  if (!chat.messages[ch]) return sendJson(res, 200, { channelId: ch, messages: [], rev: '0', hasMore: false });
  const v = q.get('v') || '0';
  if (v === String(chat.rev[ch])) return sendJson(res, 200, { channelId: ch, unchanged: true, rev: v });
  return sendJson(res, 200, { channelId: ch, messages: chat.messages[ch].slice(-120), rev: String(chat.rev[ch]), hasMore: false });
}
const IMG_RE = /(https?:\/\/[^\s]+?\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?[^\s]*)?)/ig;
const GIF_HOST_RE = /(https?:\/\/(?:[a-z0-9.-]*\.)?(?:tenor\.com|giphy\.com|media\.tenor\.com|media[0-9]*\.giphy\.com)\/[^\s]+)/ig;
// Resolve @nickname mentions to <@cid> tokens against the currently-online players.
function resolveMentions(content) {
  prunePlayers();
  const now = Date.now();
  const online = [...players.values()].filter((p) => now - p.lastSeen < PLAYER_TTL);
  // Longest nicknames first so "@AdminBob" wins over "@Admin".
  const byLen = online.filter((p) => p.nickname).sort((a, b) => b.nickname.length - a.nickname.length);
  let out = content;
  const mentioned = new Set();
  for (const p of byLen) {
    const nick = p.nickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('@' + nick + '(?![\\w])', 'ig');
    if (re.test(out)) { mentioned.add(p.id); out = out.replace(re, '<@' + p.id + '>'); }
  }
  // Also honor pre-formed <@cid> tokens inserted by the @-autocomplete.
  let tok; const tokRe = /<@([a-zA-Z0-9_-]{1,64})>/g;
  while ((tok = tokRe.exec(out))) { if ([...players.keys()].includes(tok[1])) mentioned.add(tok[1]); }
  const everyone = /@everyone\b/i.test(out);
  return { content: out, mentioned: [...mentioned], everyone };
}
// Pull image + gif URLs out of message content for inline rendering.
function extractMedia(content) {
  const images = [];
  let gif = '';
  let m;
  IMG_RE.lastIndex = 0;
  while ((m = IMG_RE.exec(content))) {
    const u = m[1];
    if (/\.gif(\?|$)/i.test(u) && !gif) gif = u;
    else if (images.length < 4) images.push(u);
  }
  if (!gif) { GIF_HOST_RE.lastIndex = 0; const g = GIF_HOST_RE.exec(content); if (g) gif = g[1]; }
  return { images, gif };
}
async function chatSend(req, res) {
  const body = await readBody(req);
  const ch = String(body.channelId || 'general');
  let content = String(body.content || '').slice(0, 1200).trim();
  if (!chat.messages[ch]) return sendJson(res, 400, { error: 'Unknown channel' });
  if (!content) return sendJson(res, 400, { error: 'Empty message' });
  const v = chatViewer(req);
  if (banActive(clientIp(req))) return sendJson(res, 403, { error: 'You are banned.' });
  if (frozenActive(v.id)) return sendJson(res, 403, { error: 'You are timed out.' });
  const media = extractMedia(content);
  const mres = resolveMentions(content);
  content = mres.content;
  const note = {
    id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    channelId: ch, content, author: v, at: Date.now(), edited: 0, system: false, kind: '',
    reply: null, images: media.images, gif: media.gif,
  };
  const replyTo = String(body.replyTo || '');
  if (replyTo) { const src = chat.messages[ch].find((m) => m.id === replyTo); if (src) note.reply = { id: src.id, content: src.content, author: src.author.username }; }
  chat.messages[ch].push(note);
  if (chat.messages[ch].length > 800) chat.messages[ch] = chat.messages[ch].slice(-800);
  chat.rev[ch] = (chat.rev[ch] || 1) + 1;
  chatMsgCount.set(v.id, (chatMsgCount.get(v.id) || 0) + 1);
  saveChat();
  // Ping mentioned players so they notice even outside the chat tab. Include a
  // readable snippet (mention tokens → @names) so they see what was said.
  const targets = mres.everyone ? [...players.keys()] : mres.mentioned;
  if (targets.length) {
    let snippet = content.replace(/<@([a-zA-Z0-9_-]{1,64})>/g, (m, id) => '@' + ((players.get(id) || {}).nickname || 'you'));
    snippet = snippet.replace(/\s+/g, ' ').trim().slice(0, 120);
    const text = '💬 ' + v.username + (mres.everyone ? ' pinged everyone' : ' mentioned you') + ' in #' + ch + (snippet ? ': ' + snippet : '');
    for (const id of targets) {
      if (id === v.id) continue;
      if (!admin.commands[id]) admin.commands[id] = [];
      admin.commands[id].push({ type: 'message', text, ts: Date.now() });
      if (admin.commands[id].length > 10) admin.commands[id] = admin.commands[id].slice(-10);
    }
  }
  return sendJson(res, 200, { ok: true, message: note });
}
async function chatEdit(req, res) {
  const body = await readBody(req);
  const ch = String(body.channelId || 'general'); const v = chatViewer(req);
  const m = (chat.messages[ch] || []).find((x) => x.id === body.messageId);
  if (!m) return sendJson(res, 404, { error: 'Not found' });
  if (m.author.id !== v.id) return sendJson(res, 403, { error: 'Not your message' });
  m.content = String(body.content || '').slice(0, 1200); m.edited = Date.now();
  chat.rev[ch] = (chat.rev[ch] || 1) + 1;
  saveChat();
  return sendJson(res, 200, { ok: true });
}
async function chatDelete(req, res) {
  const body = await readBody(req);
  const ch = String(body.channelId || 'general'); const v = chatViewer(req);
  const arr = chat.messages[ch]; if (!arr) return sendJson(res, 404, { error: 'No channel' });
  const i = arr.findIndex((x) => x.id === body.messageId);
  if (i < 0) return sendJson(res, 404, { error: 'Not found' });
  if (arr[i].author.id !== v.id && !isChatOwner(req)) return sendJson(res, 403, { error: 'Not your message' });
  arr.splice(i, 1); chat.rev[ch] = (chat.rev[ch] || 1) + 1;
  saveChat();
  return sendJson(res, 200, { ok: true });
}
function chatPresence(req, res) {
  prunePlayers();
  const now = Date.now();
  const online = [...players.values()].filter((p) => now - p.lastSeen < PLAYER_TTL);
  const members = online.map((p) => ({ id: p.id, username: p.nickname, avatar: '', color: colorFor(p.id), status: 'online' }));
  return sendJson(res, 200, { groups: [{ role: null, members }], count: members.length, typing: [] });
}
// Profile card shown when you click a player's name in chat.
function chatMember(req, res, q) {
  const id = String(q.get('id') || '');
  if (!id) return sendJson(res, 200, { id: '', username: 'Member' });
  const p = players.get(id);
  const cos = getCosmetics(id);
  const owner = !!admin.chatOwners[id];
  const nick = p ? p.nickname : 'Member';
  return sendJson(res, 200, {
    id,
    username: nick + (cos.tag ? ' ' + cos.tag : '') + (owner ? ' 👑' : ''),
    avatar: '', color: owner ? 'hsl(45 90% 60%)' : (cos.color || colorFor(id)),
    rank: owner ? 'Owner' : 'Member', owner,
    roles: [], staff: false,
    joinedAt: p ? p.firstSeen : 0,
    banned: p ? !!banActive(p.ip) : false,
    timeoutUntil: frozenActive(id) ? Date.now() + 60000 : 0,
    site: null,
  });
}
// @-autocomplete: online players whose name matches, newest-active first.
function chatMentions(req, res, q) {
  prunePlayers();
  const now = Date.now();
  const me = chatViewer(req).id;
  const query = String((q && q.get('q')) || '').toLowerCase();
  const online = [...players.values()]
    .filter((p) => now - p.lastSeen < PLAYER_TTL && p.id !== me && p.nickname)
    .filter((p) => !query || p.nickname.toLowerCase().includes(query))
    .sort((a, b) => {
      // Prefix matches rank above substring matches, then by most recent.
      const ap = a.nickname.toLowerCase().startsWith(query) ? 0 : 1;
      const bp = b.nickname.toLowerCase().startsWith(query) ? 0 : 1;
      return ap - bp || b.lastSeen - a.lastSeen;
    })
    .slice(0, 8)
    .map((p) => ({ id: p.id, username: p.nickname, avatar: '', color: colorFor(p.id) }));
  return sendJson(res, 200, { users: online });
}
async function chatMod(req, res, kind) {
  if (!isChatOwner(req)) return sendJson(res, 403, { error: 'Only the owner can moderate.' });
  const body = await readBody(req);
  const userId = String(body.userId || '');
  const minutes = Number(body.minutes) || 0;
  const reason = String(body.reason || 'Moderated in chat').slice(0, 120);
  const clear = !!body.clear;
  const p = players.get(userId);
  if (kind === 'timeout') {
    if (clear) delete admin.frozen[userId];
    else admin.frozen[userId] = minutes > 0 ? Date.now() + minutes * 60000 : 0;
  } else {
    const ip = p && p.ip;
    if (clear) { if (ip) delete admin.bansByIp[ip]; }
    else if (ip) {
      admin.bansByIp[ip] = { nickname: (p && p.nickname) || 'Unknown', reason, ts: Date.now(), until: minutes > 0 ? Date.now() + minutes * 60000 : 0 };
      players.delete(userId); logEvent('ban', (p && p.nickname) || 'Unknown', reason);
    }
    await saveState();
  }
  return sendJson(res, 200, { ok: true });
}

async function chatChannel(req, res) {
  if (!isChatOwner(req)) return sendJson(res, 403, { error: 'Only the owner can manage channels.' });
  const body = await readBody(req);
  if (body.remove) {
    const id = String(body.id || '');
    if (chat.channels.length <= 1) return sendJson(res, 400, { error: 'Keep at least one channel' });
    chat.channels = chat.channels.filter((c) => c.id !== id);
    delete chat.messages[id]; delete chat.rev[id];
    await saveChat();
    return sendJson(res, 200, { ok: true });
  }
  const name = String(body.name || '').slice(0, 40).trim();
  if (!name) return sendJson(res, 400, { error: 'Channel name required' });
  const desc = String(body.description || '').slice(0, 120);
  const cat = String(body.category || 'Text channels').slice(0, 40);
  const slow = Number(body.slowmodeSeconds) || 0;
  const ro = !!body.readOnly;
  let id = String(body.id || '');
  const existing = id && chat.channels.find((c) => c.id === id);
  if (existing) {
    existing.name = name; existing.description = desc; existing.category = cat; existing.slowmodeSeconds = slow; existing.readOnly = ro;
  } else {
    id = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'channel');
    let base = id, n = 2; while (chat.channels.some((c) => c.id === id)) id = base + '-' + (n++);
    chat.channels.push({ id, name, description: desc, category: cat, slowmodeSeconds: slow, readOnly: ro, canSend: true });
    chat.messages[id] = []; chat.rev[id] = 1;
  }
  await saveChat();
  return sendJson(res, 200, { ok: true, id });
}

const httpServer = createServer(async (req, res) => {
 try {
  const parsed = new URL(req.url || '/', 'http://localhost');
  const url = parsed.pathname;

  if (url === '/admin' || url === '/admin/') {
    req.url = '/admin/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url === '/skribbl' || url === '/skribbl/' || url === '/draw' || url === '/draw/') {
    req.url = '/skribbl/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url === '/casino' || url === '/casino/') {
    req.url = '/casino/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url.split('?')[0].startsWith('/api/casino/')) { if (await handleCasino(url, req, res)) return; }
  if (url === '/storage/data/collection.json') return serveCollection(req, res, parsed.searchParams.get('debug') === '1');
  if (url.startsWith('/ubg/') || url.startsWith('/gf/') || url.startsWith('/imgx/')) return proxyUpstream(req, res);
  if (url === '/newgames' || url === '/newgames/') {
    req.url = '/newgames/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url.split('?')[0] === '/api/changelog') {
    return sendJson(res, 200, { entries: [{
      id: 'ubg-newgames', title: '🎮 1,000+ new games added!',
      content: 'We just dropped a massive pack of brand-new games — Stickman Dragon Fight, Retro Bowl, Geometry Dash, 1v1.LOL and tons more. Open the Games page and look for the 🆕 New Games category at the top, or tap the "See All New Games" tile to browse them all. New games sync in automatically from now on. Have fun! 🚀',
      username: 'ScrollHub', created_at: Date.now(), likes: 0,
    }] });
  }
  if (url.split('?')[0] === '/api/likes') return sendJson(res, 200, { count: 0, userLiked: false });

  // Legal gate — always accepted.
  if (url === '/api/legal/status') return sendJson(res, 200, { accepted: true, needsCaptcha: false, gate: false, version: '1' });
  if (url === '/api/legal/accept') return sendJson(res, 200, { ok: true, accepted: true, version: '1' });

  // Movies (TMDB).
  if (url.startsWith('/api/tmdb/')) return handleTmdb(url.replace(/^\/api\/tmdb/, ''), parsed.searchParams, res);

  // AI (Groq).
  if (url === '/api/generate' && req.method === 'POST') return handleGenerate(req, res);

  // Game catalog extras — admin-added games are served as "globals" so the
  // games page shows them to everyone.
  if (url === '/api/games/catalog') {
    // Built-in, always-present ScrollHub original.
    const builtins = [{
      id: 'scrollhub-draw-guess', label: 'Draw & Guess (Multiplayer)', url: '/skribbl',
      imageUrl: '/storage/images/main/googleforms.jpg', categories: ['Multiplayer', 'ScrollHub Originals'], isGlobal: true,
    }, {
      id: 'scrollhub-casino', label: 'Scrolls Casino', url: '/casino',
      imageUrl: '/casino/cover.png', categories: ['Casino', 'ScrollHub Originals'], isGlobal: true,
    }];
    const customIds = new Set(admin.customGames.map((g) => g.id));
    const globals = [...builtins.filter((b) => !customIds.has(b.id)), ...admin.customGames];
    res.writeHead(200, { 'Content-Type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ globals, exclusions: [], overrides: [] }));
    return;
  }

  // No real account system — return a guest so the account/settings page
  // opens (and the appearance/wallpaper picker is reachable) without a login.
  if (url === '/api/me') {
    const c = parseCookies(req);
    const cid = String(c.sh_cid || '').slice(0, 64);
    let nick = ''; try { nick = c.sh_nick ? decodeURIComponent(c.sh_nick) : ''; } catch (e) {}
    nick = cleanNick(String(nick).slice(0, 40));
    return sendJson(res, 200, { user: { id: cid || 0, username: nick || 'Guest', email: '', is_admin: 0, is_owner: false, guest: !nick } });
  }
  if (url.split('?')[0] === '/api/achievements') {
    const c = parseCookies(req);
    const cid = String(c.sh_cid || '').slice(0, 64);
    return sendJson(res, 200, buildAchievements(cid, { chatMsgs: chatMsgCount.get(cid) || 0 }));
  }
  if (url === '/api/settings') { if (req.method === 'POST') return sendJson(res, 200, { ok: true }); return sendJson(res, 200, {}); }

  // AI conversation history — stubbed so the UI works with local-only history.
  if (url === '/api/ai/conversations' && req.method === 'GET') return sendJson(res, 200, { conversations: [] });
  if (url.startsWith('/api/ai/')) return sendJson(res, 200, { ok: true });

  // Chat (one shared server, custom channels).
  if (url === '/api/chat/boot') return sendJson(res, 200, chatBootPayload(req));
  if (url === '/api/chat/feed') return chatFeed(req, res, parsed.searchParams);
  if (url === '/api/chat/send' && req.method === 'POST') return chatSend(req, res);
  if (url === '/api/chat/edit' && req.method === 'POST') return chatEdit(req, res);
  if (url === '/api/chat/delete' && req.method === 'POST') return chatDelete(req, res);
  if (url === '/api/chat/channel' && req.method === 'POST') return chatChannel(req, res);
  if (url.split('?')[0] === '/api/chat/mentions') return chatMentions(req, res, parsed.searchParams);
  if (url.split('?')[0] === '/api/chat/member') return chatMember(req, res, parsed.searchParams);
  if (url === '/api/chat/presence') return chatPresence(req, res);
  if (url === '/api/chat/ban' && req.method === 'POST') return chatMod(req, res, 'ban');
  if (url === '/api/chat/timeout' && req.method === 'POST') return chatMod(req, res, 'timeout');
  if (url === '/api/chat/face') { if (req.method === 'POST') return sendJson(res, 200, { ok: true }); return sendJson(res, 200, { signedIn: true, emotes: {} }); }
  if (url === '/api/chat/commands') return sendJson(res, 200, { commands: [] });
  if (url === '/api/chat/pass') return sendJson(res, 200, {});
  if (url === '/api/announcements/active') return sendJson(res, 200, { announcements: chat.announcements.slice(-20) });
  if (url.startsWith('/api/chat/')) return sendJson(res, 200, { ok: true }); // typing/rules/logout/report/etc.

  // Live presence (visitor heartbeat) + admin control.
  if (url === '/api/presence' && req.method === 'POST') return handlePresence(req, res);
  if (url === '/api/admin' && req.method === 'POST') return handleAdmin(req, res);

  // Other unknown API routes 404.
  if (url.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"not found"}');
    return;
  }

  serve(req, res, () => {
    if (looksLikeFile(url)) return proxyUpstream(req, res);
    req.url = '/index.html';
    serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  });
 } catch (err) {
  try { console.error('request handler error:', err && err.message); if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Server error'); } else res.end(); } catch (e) {}
 }
});

httpServer.on('upgrade', (req, socket, head) => {
 try {
  // Banned IPs can't use the proxy tunnel (respects timed-ban expiry).
  const ip = clientIp(req);
  if (banActive(ip)) { try { socket.destroy(); } catch {} return; }
  // Skribbl draw & guess has its own WebSocket channel.
  if ((req.url || '').split('?')[0] === '/skribbl-ws') return handleSkribblUpgrade(req, socket, head);
  // Casino case battles have theirs.
  if ((req.url || '').split('?')[0] === '/battle-ws') return handleBattleUpgrade(req, socket, head);
  wisp.routeRequest(req, socket, head);
 } catch (err) { try { console.error('upgrade error:', err && err.message); socket.destroy(); } catch (e) {} }
});
httpServer.on('clientError', (err, socket) => { try { socket.destroy(); } catch (e) {} });

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Scroll Unblocker running on port ${PORT}`);
  console.log(kvEnabled ? 'Durable storage: Upstash Redis (ON)' : 'Durable storage: OFF (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)');
});
// Best-effort final flush so the last messages aren't lost on shutdown.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => { try { await kvFlush(); } catch {} process.exit(0); });
}
