import { randomBytes, createHash } from 'node:crypto';
import * as nfs from 'node:fs';
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
import { withCompression } from './staticzip.js';
import { brotliCompressSync, gzipSync, constants as zconst } from 'node:zlib';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';
import { handleSkribblUpgrade } from './skribbl.js';
import { handleWorldUpgrade, worldOnline, worldTouch } from './casinoworld.js';
import './dist/arcade/bedwars/shared.js';
import './dist/arcade/bedwars/mg.js';
import * as GMS from './gamemaps.js';
import { handleBedwarsUpgrade, bwOnline, bwAdminRooms, bwEndRoom } from './bedwars.js';
import { worldIdentity, bwStats, hasProfile } from './casino.js';
import { tableState, tableControl } from './casinotables.js';
import { setChatCheck, setIpFn, recent as chatRecent } from './chatguard.js';
import { likeCount, likedBy, likeToggle, setSubHook, setAutoHook, trustSet, trustList, isTrusted, questEvent, questsView, questClaim, surveyState, surveySubmit, surveyAdmin, surveySet, subBlockSet, subBlockList, hallSprites, hallMapSubs, subPending, subLatest, subList, subGet, subDecide, tourAdmin, rigList, rigAdd, rigDelete, rigClear, rigToggle, casinoCfgGet, casinoCfgSet, adminPlayerOp, PLAYER_OPS, handleCasino, initCasino, getCosmetics, handleBattleUpgrade, grantCoins, buildAchievements, setGotdOverride, getGotdOverride, createEventCode, listEventCodes, deleteEventCode, grantEveryone, setTourPrizes, endTournamentNow, tournamentState, publicUserCard, coinRank, setProfileImage, setProfileMeta, getProfileMeta, adminStoreList, adminProfile, adminSetCoins, adminGiveItem, adminGiveAllItems, adminTakeItem, adminClearInventory, adminSetField, adminResetProfile, walletCoins } from './casino.js';
import { createSiteOps } from './siteops.js';
import { createPush } from './push.js';
import { handleAuth, resolveSession, accountByName, roleForName, setRole, revokeSessions, staffResetCode, searchNames, listStaff, isOwnerName, allAccounts, setAccountBan, accountBan } from './auth.js';
import { initDiscord, handleDiscord, serveDiscordFile, handleDiscordUpgrade, iceServers, discordGuildList, discordSetDefault, dcAdminOp, dcAdminState, monChannels, monMessages, monRecent, monSearch, monDelete, modHQAdd, modHQRemove, modHQPost } from './discord.js';
await initCasino();

// Keep the server (and the Wisp proxy tunnels) alive no matter what: a single
// unhandled error in any request/handler must NOT take the whole process down,
// because a crash drops every in-flight proxy connection (Wisp MuxTaskEnded).
process.on('unhandledRejection', (err) => { try { console.error('unhandledRejection:', err && err.message ? err.message : err); } catch (e) {} });
process.on('uncaughtException', (err) => { try { console.error('uncaughtException:', err && err.message ? err.message : err); } catch (e) {} });

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');
const SERVER_STARTED = Date.now();
const UPSTREAM = process.env.UPSTREAM_ORIGIN || 'https://petezahgames.com';
const TMDB_BASE = 'https://api.themoviedb.org/3';

// Cache rules for everything served from dist/. Pages revalidate so a deploy shows up on the next refresh; hashed
// bundles and pictures/video are cached so repeat visits cost no bandwidth (pages reference them with ?v= when they change).
const SERVE_HEADERS = (res, pathname) => {
  if (/^\/assets\//.test(pathname)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  else if (/^\/storage\/images\//.test(pathname)) res.setHeader('cache-control', 'public, max-age=604800, immutable');
  else if (/(\.html|\/)$/.test(pathname) || /\/sw\.js$/.test(pathname)) res.setHeader('cache-control', 'no-cache');
  else if (/\.(png|jpe?g|webp|gif|avif|ico|mp4|webm|mp3|ogg|woff2?)$/i.test(pathname)) res.setHeader('cache-control', 'public, max-age=86400');
  if (/\.(png|jpe?g)$/i.test(pathname)) res.setHeader('vary', 'Accept');
};
const sirvServe = sirv(distDir, { dev: false, etag: true, setHeaders: SERVE_HEADERS });
const serve = withCompression(sirvServe, distDir, SERVE_HEADERS);

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
    if (_stateDirty) { _stateDirty = false; await kvSet('sh:state', JSON.stringify({ settings: admin.settings, bansByIp: admin.bansByIp, stats, customGames: admin.customGames, chatOwners: admin.chatOwners, audit: admin.audit, notes: admin.notes })); }
  } catch (e) { _stateDirty = true; }
  try {
    if (_chatDirty) { _chatDirty = false; const trimmed = {}; for (const k in chat.messages) trimmed[k] = (chat.messages[k] || []).slice(-800); await kvSet('sh:chat', JSON.stringify({ channels: chat.channels, messages: trimmed, rev: chat.rev, announcements: chat.announcements })); }
  } catch (e) { _chatDirty = true; }
}
setInterval(kvFlush, 12000);

const admin = {
  settings: { maintenance: false, redirect: '', announcement: '', schoolMode: false, schoolSet: 'blooket' },
  bansByIp: {},   // ip -> {nickname, reason, ts}
  kicks: {},      // clientId -> {message, ts}  (one-shot)
  broadcast: null,// {text, ts}  shown to everyone once
  commands: {},   // clientId -> [ {type, ...} ]  (one-shot queue)
  frozen: {},     // clientId -> until (0 = indefinite)
  customGames: [],// admin-added games shown to everyone
  chatOwners: {}, // clientId -> true  (designated chat owners)
  audit: [],      // staff action log: {ts, by, role, action, target, detail}
  notes: {}       // shared staff notes, one per admin panel: key -> {text, by, ts}
};
// ── Extended admin state ───────────────────────────────────────────────────
const muted = {};        // ip -> { until (0=permanent), reason }
const playerNotes = {};  // clientId -> string  (admin sticky notes)
const wordFilter = [];   // strings to block in chat
const coinHistory = [];  // { ts, name, amount, reason } — ring buffer 500
const onlineHistory = [];// { ts, count } — 24h at 5-min intervals (288 max)
const errorLog = [];     // { ts, msg } — last 100 console.error calls
const lastMsgTime = new Map(); // clientId -> ts (slow mode tracking)
const slowMode = {};     // channelId -> seconds (0 = off)

// Capture console.error to errorLog for the system health viewer
const _origErr = console.error.bind(console);
console.error = (...a) => {
  errorLog.push({ ts: Date.now(), msg: a.map(String).join(' ').slice(0, 500) });
  if (errorLog.length > 100) errorLog.shift();
  _origErr(...a);
};
// Replicates the frontend's generateGameId so ids stay consistent.
function makeGameId(label, url) {
  let u = String(url || '').trim();
  try { u = decodeURIComponent(u); } catch (e) {}
  u = u.replace(/\/index\.html(?=([?#]|$))/gi, '').replace(/\/+$/, '');
  return (String(label || '') + '-' + u).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
}
// ---- Admin: recent server log (ring buffer, secrets scrubbed) ----
const LOG_RING = []; let logSeq = 0;
for (const lvl of ['log', 'info', 'warn', 'error']) {
  const orig = console[lvl].bind(console);
  console[lvl] = (...a) => {
    try {
      let t = a.map((x) => (typeof x === 'string' ? x : x && x.stack ? x.stack : (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })())).join(' ');
      t = t.replace(/((?:token|secret|password|passwd|authorization|api[_-]?key|cookie)["'\s:=]+)[^\s"',;]{4,}/gi, '$1[hidden]').replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[hidden]').slice(0, 400);
      LOG_RING.push({ n: ++logSeq, ts: Date.now(), lvl, t }); if (LOG_RING.length > 400) LOG_RING.shift();
    } catch (e) {}
    orig(...a);
  };
}
const players = new Map(); // clientId -> {id, nickname, ip, location, firstSeen, lastSeen}
const chatMsgCount = new Map(); // cid -> number of chat messages sent (for achievements)
const nameOwners = new Map(); // lowercased nickname -> cid currently holding it
// Changes on every restart (and when an admin resets): clients whose stored
// nickname predates this value are forced to re-enter their name on next load.
let nickEpoch = Date.now();
const geoCache = new Map(); // ip -> location string
const stats = { peakOnline: 0, peakAt: 0, hourly: new Array(24).fill(0), gamePlays: {}, totalSessions: 0 };

// ---- bandwidth meter: Render's free plan caps outbound traffic, so count it by month, category and path ----
stats.traffic = stats.traffic && stats.traffic.months ? stats.traffic : { months: {} };
const bootPaths = new Map(), TRAFFIC_SINCE = Date.now(), wsOpen = new Map();
function addTraffic(path, bytes, cat) {
  if (!(bytes > 0)) return;
  const now = new Date().toISOString(), m = now.slice(0, 7), d = now.slice(0, 10), T = stats.traffic;
  const mo = T.months[m] || (T.months[m] = { bytes: 0, cats: {}, days: {} });
  cat = cat || (path.startsWith('/api/') ? 'api' : path.startsWith('/storage/images/') ? 'images' : 'site');
  mo.bytes += bytes; mo.cats[cat] = (mo.cats[cat] || 0) + bytes; mo.days[d] = (mo.days[d] || 0) + bytes;
  const keys = Object.keys(T.months).sort(); while (keys.length > 6) delete T.months[keys.shift()];
  const key = path.slice(0, 110); bootPaths.set(key, (bootPaths.get(key) || 0) + bytes);
  if (bootPaths.size > 700) [...bootPaths.entries()].sort((a, b) => a[1] - b[1]).slice(0, 150).forEach(([k]) => bootPaths.delete(k));
  _stateDirty = true;
}
function trackSocket(path, socket) {
  const e = { path, cat: path === '/wisp/' || path.startsWith('/wisp') ? 'proxy' : 'games', last: 0 }; wsOpen.set(socket, e);
  const flush = () => { const d = socket.bytesWritten - e.last; if (d > 0) { e.last += d; addTraffic('ws:' + path, d, e.cat); } };
  e.flush = flush; socket.once('close', () => { flush(); wsOpen.delete(socket); });
}
setInterval(() => { for (const e of wsOpen.values()) { try { e.flush(); } catch {} } }, 20000);
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
  if (Array.isArray(saved.audit)) admin.audit = saved.audit.slice(-400);
  if (saved.notes && typeof saved.notes === 'object') admin.notes = saved.notes;
}
try {
  const fs = await import('node:fs');
  if (fs.existsSync(STATE_FILE)) applyState(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')));
} catch {}
// Durable copy wins over the ephemeral /tmp copy.
try { const s = await kvGet('sh:state'); if (s) applyState(JSON.parse(s)); } catch (e) { console.log('kv state load failed:', e.message); }
// ScrollHub Servers (Discord-style layer) — load its durable state now that KV is ready.
// Pop-ups for people who are not on the site (web push). Owners and mods also get staff alerts and a Mod HQ post.
let push = { send() {}, handle: async () => false };
try { push = await createPush({ admin, saveState, kvGet, kvSet, resolveSession, sendJson, readBody }); } catch (e) { console.log('push init failed:', e.message); }
// Everyone on staff (owner, co-owner, mod) is put in Mod HQ automatically; nobody has to open Discord or accept an invite.
async function syncStaffToModHQ() {
  try {
    const staff = await listStaff();
    for (const st of staff) { const a = await accountByName(st.username); if (a) modHQAdd(a.id, a.username); }
  } catch (e) {}
}
setTimeout(syncStaffToModHQ, 10000).unref(); setInterval(syncStaffToModHQ, 5 * 60 * 1000).unref();
async function staffAlert(o) {
  try {
    if (o.channel && o.text) modHQPost(o.channel, o.text);
    const hook = process.env.APPLICATIONS_WEBHOOK_URL || process.env.SUBMISSIONS_WEBHOOK_URL;
    if (o.hook && hook && /^https:\/\//.test(hook)) { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000); fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: String(o.text).replace(/[@`]/g, '').slice(0, 400) }), signal: ctl.signal }).catch(() => {}).finally(() => clearTimeout(t)); }
    const staff = await listStaff();
    for (const st of staff) {
      const a = await accountByName(st.username); if (!a) continue;
      modHQAdd(a.id, a.username);
      if (o.push && (!o.topOnly || st.role === 'owner' || st.role === 'coowner')) push.send(a.id, 'staff', { title: o.title, body: o.body, url: o.url || '/hub/#/admin', tag: 'staff-' + (o.channel || 'x') });
    }
  } catch (e) {}
}
try { await initDiscord({ getCosmetics, kvGet, kvSet, push: (uid, kind, p) => push.send(uid, kind, p) }); } catch (e) { console.log('discord init failed:', e.message); }
async function saveState() {
  _stateDirty = true;
  try {
    const fs = await import('node:fs');
    fs.writeFileSync(STATE_FILE, JSON.stringify({ settings: admin.settings, bansByIp: admin.bansByIp, stats, customGames: admin.customGames, chatOwners: admin.chatOwners, audit: admin.audit, notes: admin.notes }));
  } catch {}
}
setInterval(saveState, 60000);
// Online history — record player count every 5 min (288 samples = 24h)
setInterval(() => {
  prunePlayers();
  const now = Date.now();
  const cnt = [...players.values()].filter(p => now - p.lastSeen < PLAYER_TTL).length;
  onlineHistory.push({ ts: now, count: cnt });
  if (onlineHistory.length > 288) onlineHistory.shift();
}, 5 * 60 * 1000);

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

// ---- typed chat in the casino and in Games: the shared filter (chatguard.js) asks us about bans, mutes and the word list ----
setIpFn(clientIp);
setChatCheck((ctx, text) => {
  const gc = admin.settings.gameChat || {};
  if (gc[ctx.scope] === false) return 'Chat is turned off right now.';
  if (ctx.ip && banActive(ctx.ip)) return 'You are banned.';
  if (ctx.cid && frozenActive(ctx.cid)) return 'You are timed out.';
  if (ctx.ip && muted[ctx.ip] && (muted[ctx.ip].until === 0 || muted[ctx.ip].until > Date.now())) return 'You are muted from chat.';
  if (wordFilter.length) { const cl = text.toLowerCase(); if (wordFilter.some((w) => cl.includes(w))) return 'That message has blocked content.'; }
  return '';
});
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
  const a = req._auth; // trusted login identity, if any
  const id = a ? a.id : String(body.id || '').slice(0, 64);
  const activity = String(body.activity || '').slice(0, 80);
  const ip = clientIp(req);
  if (!id) return sendJson(res, 400, { error: 'no id' });
  const nickname = a ? a.username : uniqueNick(cleanNick(String(body.nickname || 'Guest').slice(0, 40)), id);

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
    account: !!a,  // true = logged-in account, false = guest session
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
    redirect: admin.settings.redirect || (admin.settings.schoolMode && String((req._auth && req._auth.username) || '').toLowerCase() !== 'scrollreader11' ? location_school(req) : ''),
    announcement: admin.settings.announcement || '',
    kick: kick || null,
    broadcast: admin.broadcast || null,
    frozen: frozenActive(id),
    takeover: admin.settings.takeover || null,
    nickEpoch: 0, // disabled: login owns identity, so never re-trigger the old nickname prompt (even for cached presence scripts)
    commands,
  });
}

// ---- Custom game thumbnails (admin uploads) ----
// Small images uploaded from the add-game tool are stored in KV (base64) and
// served from /ci/<id>. Keeps thumbnails on our own domain so they always load,
// and survives redeploys (unlike /tmp).
const IMG_CT_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
function extForCt(ct) {
  ct = String(ct || '').toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'png';
}
// Accepts a data URL (data:image/png;base64,....) from the admin tool, stores it
// in KV, and returns a same-origin /ci/<id>.<ext> URL to use as a game thumbnail.
async function handleGameImg(req, res) {
  const body = await readBody(req);
  const who = await resolveSession(req);
  if (!who || (who.role !== 'owner' && who.role !== 'coowner')) return sendJson(res, 403, { error: 'owner only' });
  const dataUrl = String(body.dataUrl || '');
  const m = /^data:(image\/[a-z.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!m) return sendJson(res, 400, { error: 'Expected a base64 image data URL' });
  const ct = m[1].toLowerCase();
  const b64 = m[2].replace(/\s+/g, '');
  // Cap at ~600KB decoded so KV stays small.
  if (Math.floor(b64.length * 0.75) > 600 * 1024) return sendJson(res, 413, { error: 'Image too large (max ~600KB)' });
  const ext = extForCt(ct);
  const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  try { await kvSet('sh:img:' + id, JSON.stringify({ ct, b64 })); }
  catch (e) { return sendJson(res, 500, { error: 'storage failed' }); }
  // Use a relative URL so the image loads from whichever server the client is on.
  // Both servers share the same KV store, so either can serve any image ID.
  return sendJson(res, 200, { ok: true, url: '/ci/' + id + '.' + ext });
}
// Read a raw request body (binary) up to maxBytes; returns a Buffer or null if too big.
async function readRawBody(req, maxBytes) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > maxBytes) return null; chunks.push(c); }
  return Buffer.concat(chunks);
}
// Profile picture / banner upload. The account page POSTs the raw image bytes
// with the file's Content-Type. Stores it via the same sh:img KV as thumbnails,
// records the URL on the user's profile, and returns { avatar_url } / { banner_url }.
async function handleProfileImageUpload(req, res, kind) {
  const auth = req._auth || await resolveSession(req);
  if (!auth) return sendJson(res, 401, { error: 'auth' });
  // DELETE (or ?clear=1) removes the current image.
  if (req.method === 'DELETE' || /[?&]clear=1(&|$)/.test(req.url || '')) {
    try { setProfileImage(auth.id, kind, ''); } catch (e) {}
    return sendJson(res, 200, kind === 'banner' ? { banner_url: '' } : { avatar_url: '' });
  }
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('image/')) return sendJson(res, 400, { error: 'Expected an image' });
  const buf = await readRawBody(req, 900 * 1024); // ~900KB cap (before base64)
  if (!buf) return sendJson(res, 413, { error: 'Image too large (max ~900KB)' });
  if (!buf.length) return sendJson(res, 400, { error: 'empty' });
  const ext = extForCt(ct);
  const id = (kind === 'banner' ? 'b' : 'a') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  try { await kvSet('sh:img:' + id, JSON.stringify({ ct, b64: buf.toString('base64') })); }
  catch (e) { return sendJson(res, 500, { error: 'storage failed' }); }
  // Use a relative URL so the image loads from whichever server the client is on.
  // Both servers share the same KV store, so either can serve any image ID.
  const imgUrl = '/ci/' + id + '.' + ext;
  try { setProfileImage(auth.id, kind, imgUrl); } catch (e) {}
  return sendJson(res, 200, kind === 'banner' ? { banner_url: imgUrl } : { avatar_url: imgUrl });
}
// Serves a stored custom thumbnail.
async function serveGameImg(req, res, url) {
  const id = url.slice(4).split('.')[0].split('?')[0];
  if (!/^[a-z0-9]+$/i.test(id)) { res.writeHead(404); res.end('no'); return; }
  let rec = null;
  try { const s = await kvGet('sh:img:' + id); if (s) rec = JSON.parse(s); } catch (e) {}
  if (!rec || !rec.b64) { res.writeHead(404); res.end('no'); return; }
  const buf = Buffer.from(rec.b64, 'base64');
  res.writeHead(200, { 'content-type': rec.ct || 'image/png', 'cache-control': 'public, max-age=604800, immutable', 'content-length': buf.length });
  res.end(req.method === 'HEAD' ? undefined : buf);
}

// Password-guarded admin control endpoint.

// Pages that School mode sends to the games hub instead.
function schoolHome() { return '/arcade'; } // School Mode always lands on the games hub (Gamble adds the casino)
function isTeacherReq(req) { try { const tk = admin.settings.teacherKey; const ck = /(?:^|;\s*)sh_teacher=([^;]+)/.exec(req.headers.cookie || ''); return !!(tk && ck && decodeURIComponent(ck[1]) === tk); } catch (e) { return false; } }
function location_school(req) { const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]; return proto + '://' + req.headers.host + schoolHome(); }
function schoolBlocked(url, req) {
  const p = url.split('?')[0];
  if (admin.settings.schoolGamble && p.startsWith('/casino')) return false; // Gamble switch: the casino opens alongside the games hub
  if (p.startsWith('/api/') || p.startsWith('/admin') || p.startsWith('/arcade') || p.startsWith('/hub') || p === '/play' || p === '/play/' || p.startsWith('/bedwars') || p.startsWith('/calltest') || p.startsWith('/bw-ws')) return false;
  if (p === '/' || p === '/index.html' || p.startsWith('/casino') && (p === '/casino' || p === '/casino/' || p.endsWith('.html'))) return true;
  if (/\.html?$/.test(p)) return true;
  if (!/\.[a-z0-9]{1,6}$/i.test(p)) return true; // app routes like /games, /chat, /proxy
  return false;
}
function teacherKey() { if (!admin.settings.teacherKey) { admin.settings.teacherKey = randomBytes(9).toString('base64url'); saveState().catch(() => {}); } return admin.settings.teacherKey; }
globalThis.SH_TEACHER_KEY = () => teacherKey();
globalThis.SH_NEW_TEACHER_KEY = () => { admin.settings.teacherKey = randomBytes(9).toString('base64url'); saveState().catch(() => {}); return admin.settings.teacherKey; };
globalThis.SH_SEASON = () => (admin.settings.season == null ? 'xmas' : admin.settings.season || '');
globalThis.SH_SET_SEASON = async (v) => { admin.settings.season = v ? String(v) : ''; try { await saveState(); } catch (e) {} };
globalThis.SH_SCHOOL = () => (admin.settings.schoolMode ? { set: admin.settings.schoolSet || 'blooket', until: admin.settings.schoolUntil || 0, gamble: !!admin.settings.schoolGamble, quiz: admin.settings.schoolQuiz !== false } : null);
globalThis.SH_SET_SQUIZ = async (v) => { admin.settings.schoolQuiz = !!v; logEvent('admin', 'admin', '📝 School Mode questions ' + (v ? 'ON' : 'OFF')); try { await saveState(); } catch (e) {} };
globalThis.SH_SET_GAMBLE = async (v) => { admin.settings.schoolGamble = !!v; logEvent('admin', 'admin', '🎰 School Mode gambling ' + (v ? 'UNLOCKED' : 'locked')); try { await saveState(); } catch (e) {} };
setAutoHook((sub) => {   // a trusted maker's map goes live right away, the same way an approval would publish it
  try {
    const sv = GMS.saveMap({ ...(sub.payload || {}) }, sub.by);
    if (!sv.ok) return null;
    if (sv.problems.length) { GMS.deleteMap(sv.id, 'auto'); return null; }
    GMS.setRotation(String(sub.payload.game), sv.id, true);
    return { mapId: sv.id, meta: { game: sub.payload.game, name: sub.payload.name } };
  } catch (e) { return null; }
});
setSubHook((sub, auto) => {
  if (auto) { try { logEvent('sub', sub.by, 'auto-approved ' + (sub.kind === 'map' ? 'map: ' : 'creation: ') + sub.title); } catch (e) {} return; }
  try {
    logEvent('sub', sub.by, (sub.kind === 'map' ? 'map: ' : 'creation: ') + sub.title);
    console.log('submission waiting for approval:', sub.kind, 'from', sub.by);
    const url = process.env.SUBMISSIONS_WEBHOOK_URL;   // optional: a Discord-style webhook that pings you
    if (url && /^https:\/\//.test(url)) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'New ' + (sub.kind === 'map' ? 'map' : 'creation') + ' from ' + sub.by + ': "' + String(sub.title).replace(/[@`]/g, '') + '" is waiting for your approval in Admin tools > Submissions.' }), signal: ctl.signal }).catch(() => {}).finally(() => clearTimeout(t));
    }
  } catch (e) {}
});
globalThis.SH_GAME_OFF = (k) => !!(admin.settings.gamesOff && admin.settings.gamesOff[k]);
globalThis.SH_BOOST = () => { const b = admin.settings.boost; return b && b.until > Date.now() && b.mult > 1 ? b.mult : 1; };
const GAME_KEYS = [['bw', 'Bedwars'], ['race', 'Scroll Racing'], ['royale', 'Scroll Royale'], ['ctf', 'Capture the Flag'], ['spleef', 'TNT Spleef'], ['hide', 'Prop Hunt'], ['duel', 'Duels'], ['murder', 'Murder Mystery'], ['build', 'Build Battle'], ['casino', 'Casino']];
function liveState(voter) {
  const l = admin.settings.live || {}, now = Date.now(), out = {};
  if (l.countdown && l.countdown.at > now - 60000) out.countdown = l.countdown;
  if (l.poll && (!l.poll.endAt || l.poll.endAt > now - 120000)) {
    const v = l.poll.votes || {}, counts = l.poll.opts.map(() => 0); for (const k in v) if (counts[v[k]] != null) counts[v[k]]++;
    out.poll = { id: l.poll.id, q: l.poll.q, opts: l.poll.opts, counts, endAt: l.poll.endAt || 0, mine: voter && v[voter] != null ? v[voter] : -1 };
  }
  const b = admin.settings.boost; if (b && b.until > now && b.mult > 1) out.boost = { mult: b.mult, until: b.until, label: b.label || '' };
  return out;
}
// Scheduled announcements: runs every 30 s
setInterval(() => {
  try {
    const now = Date.now(), list = admin.settings.sched || []; let ch = false;
    for (const it of list.slice()) {
      if (it.clearAt && it.clearAt <= now) { if (admin.settings.announcement === it.text) admin.settings.announcement = ''; it.clearAt = 0; ch = true; }
      if (it.at && it.at <= now) {
        admin.settings.announcement = it.text; ch = true;
        if (it.clearMins) it.clearAt = now + it.clearMins * 60000;
        if (it.every) { while (it.at <= now) it.at += it.every * 60000; } else { it.at = 0; it.done = now; }
      }
    }
    admin.settings.sched = list.filter((it) => it.at || it.clearAt || (it.done && now - it.done < 3600000));
    if (ch) saveState().catch(() => {});
  } catch (e) {}
}, 30000);
globalThis.SH_SET_SCHOOL = async (on, set, until) => { if (typeof on === 'boolean') { admin.settings.schoolMode = on; if (!on) admin.settings.schoolUntil = 0; } if (typeof until === 'number') admin.settings.schoolUntil = until; if (set && ['blooket', 'u9', 'u10', 'both'].includes(set)) admin.settings.schoolSet = set; try { await saveState(); } catch (e) {} };
// Actions a moderator may run through the legacy tool set. Everything else is owner-only.
const MOD_ACTIONS = new Set(['state', 'kick', 'mute', 'unmute', 'freeze', 'announce', 'delannounce', 'broadcast', 'reports', 'clearreports', 'chatlog', 'deletemsg', 'playerhistory', 'setnote', 'wordfilterlist', 'addword', 'removeword', 'setslow', 'ban', 'unban', 'sessionstats', 'mostactive', 'leaderboard', 'coinhistory', 'gamechat.get']);
function audit(who, action, target, detail) {
  admin.audit.push({ ts: Date.now(), by: who.username, role: who.role, action: String(action).slice(0, 40), target: String(target || '').slice(0, 60), detail: String(detail || '').slice(0, 160) });
  if (admin.audit.length > 400) admin.audit.shift();
  saveState().catch(() => {});
}
async function handleAdmin(req, res, body, who) {
  const action = body.action;
  if (!who || !who.role) return sendJson(res, 403, { error: 'staff only' });
  if (who.role === 'mod') {
    if (!MOD_ACTIONS.has(action)) return sendJson(res, 403, { error: 'owner only' });
    // Moderators can only issue timed bans (at most 7 days) so a permanent ban stays an owner call.
    if (action === 'ban') { const m = Number(body.minutes) || 0; if (m <= 0 || m > 10080) body.minutes = 10080; }
  }
  if (!['gamechat.get', 'state', 'chatlog', 'wordfilterlist', 'playerhistory', 'reports', 'sessionstats', 'mostactive', 'leaderboard', 'coinhistory'].includes(action)) {
    audit(who, action, body.id || body.username || body.channel || '', body.reason || body.text || body.title || '');
  }

  if (action === 'gamechat.get' || action === 'gamechat.set') {
    if (action === 'gamechat.set') {
      if (who.role !== 'owner') return sendJson(res, 403, { error: 'owner only' });
      const gc = admin.settings.gameChat || (admin.settings.gameChat = {});
      for (const k of ['casino', 'games']) if (body[k] != null) gc[k] = !!body[k];
      await saveState().catch(() => {});
    }
    const gc = admin.settings.gameChat || {};
    return sendJson(res, 200, { ok: true, casino: gc.casino !== false, games: gc.games !== false, recent: chatRecent.slice(-200).reverse() });
  }
  if (action === 'state') {
    prunePlayers();
    const _now = Date.now();
    const list = [...players.values()].sort((a, b) => b.lastSeen - a.lastSeen).map((p) => ({
      id: p.id, nickname: p.nickname, location: p.location, ip: p.ip,
      activity: p.activity || '',
      online: _now - p.lastSeen < PLAYER_TTL,
      since: p.firstSeen,
      frozen: frozenActive(p.id),
      frozenUntil: admin.frozen[p.id] || 0,
      chatOwner: !!admin.chatOwners[p.id],
      account: !!p.account,
      muted: !!(muted[p.ip] && (muted[p.ip].until === 0 || muted[p.ip].until > _now)),
      note: playerNotes[p.id] || '',
    }));
    const bans = Object.entries(admin.bansByIp).map(([ip, b]) => ({ ip, nickname: b.nickname, reason: b.reason || '', ts: b.ts, until: b.until || 0 }));
    const online = list.filter((p) => p.online).length;
    if (online > stats.peakOnline) { stats.peakOnline = online; stats.peakAt = Date.now(); }
    const topGames = Object.entries(stats.gamePlays).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, plays]) => ({ name, plays }));
    return sendJson(res, 200, {
      settings: { ...admin.settings, teacherKey: undefined }, players: list, bans, count: list.length,
      stats: { peakOnline: stats.peakOnline, peakAt: stats.peakAt, hourly: stats.hourly, topGames, totalSessions: stats.totalSessions },
      events: events.slice(-60).reverse(),
      customGames: admin.customGames,
      announcements: chat.announcements.slice(-20),
    });
  }
  if (action === 'teacherKey') return sendJson(res, 200, { ok: true, teacherKey: teacherKey() });
  if (action === 'newTeacherKey') { admin.settings.teacherKey = randomBytes(9).toString('base64url'); await saveState(); return sendJson(res, 200, { ok: true, teacherKey: admin.settings.teacherKey }); }
  if (action === 'settings') {
    const s = body.settings || {};
    if (typeof s.maintenance === 'boolean') admin.settings.maintenance = s.maintenance;
    if (typeof s.redirect === 'string') admin.settings.redirect = s.redirect.trim();
    if (typeof s.announcement === 'string') admin.settings.announcement = s.announcement.slice(0, 300);
    if (typeof s.schoolMode === 'boolean') { admin.settings.schoolMode = s.schoolMode; logEvent('admin', 'admin', '🏫 School mode ' + (s.schoolMode ? 'ON' : 'OFF')); }
    if (typeof s.schoolMins === 'number') { admin.settings.schoolUntil = s.schoolMins > 0 ? Date.now() + Math.min(240, s.schoolMins) * 60000 : 0; if (s.schoolMins > 0) admin.settings.schoolMode = true; }
    if (s.schoolMode === false) admin.settings.schoolUntil = 0;
    if (typeof s.schoolQuiz === 'boolean') { admin.settings.schoolQuiz = s.schoolQuiz; logEvent('admin', 'admin', '📝 School Mode questions ' + (s.schoolQuiz ? 'ON' : 'OFF')); }
    if (typeof s.schoolGamble === 'boolean') { admin.settings.schoolGamble = s.schoolGamble; logEvent('admin', 'admin', '🎰 School Mode gambling ' + (s.schoolGamble ? 'UNLOCKED' : 'locked')); }
    if (typeof s.season === 'string' && ['', 'xmas', 'halloween', 'thanksgiving', 'newyear', 'valentines', 'stpatricks', 'easter', 'july4', 'summer'].includes(s.season)) { admin.settings.season = s.season; logEvent('admin', 'admin', '🎄 Season decorations ' + (s.season ? 'ON (' + s.season + ')' : 'OFF')); }
    if (typeof s.schoolSet === 'string' && ['blooket', 'u9', 'u10', 'both'].includes(s.schoolSet)) admin.settings.schoolSet = s.schoolSet;
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
    const pName = players.get(id)?.nickname || id;
    logEvent('coins', pName, (amount >= 0 ? '+' : '') + amount + ' Scrolls');
    coinHistory.push({ ts: Date.now(), name: pName, amount, reason: 'Admin grant' });
    if (coinHistory.length > 500) coinHistory.shift();
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
  // Give / take Scrolls to any account by username (works offline too).
  if (action === 'scrolls') {
    const amount = Math.max(-10000000, Math.min(10000000, Math.floor(Number(body.amount) || 0)));
    const acct = await accountByName(String(body.username || ''));
    if (!acct) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' });
    const bal = grantCoins(acct.id, amount);
    logEvent('coins', acct.username, (amount >= 0 ? '+' : '') + amount + ' Scrolls');
    return sendJson(res, 200, { ok: true, username: acct.username, balance: bal });
  }
  // Event: grant Scrolls to EVERY account (not just those online now).
  if (action === 'giveallaccounts') {
    const amount = Math.max(0, Math.min(1000000, Math.floor(Number(body.amount) || 0)));
    const n = grantEveryone(amount);
    logEvent('coins', 'All accounts', '+' + amount + ' Scrolls to ' + n);
    return sendJson(res, 200, { ok: true, count: n });
  }
  // Game of the Day override.
  if (action === 'setgotd') {
    const g = setGotdOverride({ label: body.label, url: body.url, imageUrl: body.imageUrl });
    logEvent('gotd', 'Game of the Day', g ? ('set to ' + g.label) : 'cleared');
    return sendJson(res, 200, { ok: true, gotd: g });
  }
  if (action === 'cleargotd') {
    setGotdOverride(null);
    logEvent('gotd', 'Game of the Day', 'cleared (back to daily auto-pick)');
    return sendJson(res, 200, { ok: true, gotd: null });
  }
  // Event codes (Scroll giveaways players redeem once each).
  if (action === 'createcode') {
    const r = createEventCode({ code: body.code, amount: body.amount, max: body.max });
    if (!r) return sendJson(res, 200, { error: 'bad-code', message: 'Enter a code and amount.' });
    logEvent('event', 'Code ' + r.code, '+' + r.amount + ' Scrolls' + (r.max ? (' · ' + r.max + ' claims') : ' · unlimited'));
    return sendJson(res, 200, { ok: true, code: r, codes: listEventCodes() });
  }
  if (action === 'deletecode') {
    deleteEventCode(String(body.code || ''));
    return sendJson(res, 200, { ok: true, codes: listEventCodes() });
  }
  if (action === 'listcodes') {
    return sendJson(res, 200, { ok: true, codes: listEventCodes(), gotd: getGotdOverride() });
  }
  // Weekly tournament controls.
  if (action === 'tourprizes') {
    const prizes = setTourPrizes(body.p1, body.p2, body.p3);
    logEvent('tournament', 'Prizes', prizes.join(' / '));
    return sendJson(res, 200, { ok: true, prizes });
  }
  if (action === 'endweek') {
    const winners = endTournamentNow();
    logEvent('tournament', 'Week ended', winners.map((w) => w.nick + ' +' + w.prize).join(', ') || 'no winners');
    return sendJson(res, 200, { ok: true, winners });
  }
  if (action === 'tourstate') {
    return sendJson(res, 200, { ok: true, tour: tournamentState('') });
  }
  if (action === 'reports') {
    return sendJson(res, 200, { ok: true, reports: reports.slice(-80).reverse() });
  }
  if (action === 'clearreports') {
    reports.length = 0; socialSave();
    return sendJson(res, 200, { ok: true });
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
  // ── Mute / unmute (chat-only, separate from freeze) ───────────────────────
  if (action === 'mute') {
    const id = String(body.id || '');
    const p = players.get(id);
    if (!p) return sendJson(res, 400, { error: 'Player not found' });
    const minutes = Number(body.minutes) || 0;
    muted[p.ip] = { until: minutes > 0 ? Date.now() + minutes * 60000 : 0, reason: String(body.reason || 'Muted by admin').slice(0, 120) };
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'unmute') {
    const id = String(body.id || '');
    const p = players.get(id);
    if (p) delete muted[p.ip];
    return sendJson(res, 200, { ok: true });
  }
  // ── Player sticky note ────────────────────────────────────────────────────
  if (action === 'setnote') {
    const id = String(body.id || '');
    const note = String(body.note || '').slice(0, 500);
    if (note) playerNotes[id] = note; else delete playerNotes[id];
    return sendJson(res, 200, { ok: true });
  }
  // ── Player history (casino card) ──────────────────────────────────────────
  if (action === 'playerhistory') {
    const id = String(body.id || '');
    let card = null;
    try { card = publicUserCard(id); } catch (e) {}
    return sendJson(res, 200, { ok: true, history: card, note: playerNotes[id] || '', rank: coinRank(id) });
  }
  // ── Chat log (admin view, all channels) ──────────────────────────────────
  if (action === 'chatlog') {
    const ch = String(body.channel || 'general');
    return sendJson(res, 200, { ok: true, channel: ch, channels: chat.channels, messages: (chat.messages[ch] || []).slice(-200) });
  }
  // ── Delete a specific chat message (admin power) ─────────────────────────
  if (action === 'deletemsg') {
    const ch = String(body.channel || 'general');
    const msgId = String(body.msgId || '');
    const arr = chat.messages[ch]; if (!arr) return sendJson(res, 400, { error: 'No channel' });
    const i = arr.findIndex(m => m.id === msgId);
    if (i >= 0) { arr.splice(i, 1); chat.rev[ch] = (chat.rev[ch] || 1) + 1; saveChat(); }
    return sendJson(res, 200, { ok: true });
  }
  // ── Word filter ───────────────────────────────────────────────────────────
  if (action === 'addword') {
    const w = String(body.word || '').trim().toLowerCase().slice(0, 100);
    if (w && !wordFilter.includes(w)) wordFilter.push(w);
    return sendJson(res, 200, { ok: true, wordFilter });
  }
  if (action === 'removeword') {
    const w = String(body.word || '').trim().toLowerCase();
    const i = wordFilter.indexOf(w); if (i >= 0) wordFilter.splice(i, 1);
    return sendJson(res, 200, { ok: true, wordFilter });
  }
  if (action === 'wordfilterlist') {
    return sendJson(res, 200, { ok: true, wordFilter });
  }
  // ── Slow mode ─────────────────────────────────────────────────────────────
  if (action === 'setslow') {
    const ch = String(body.channel || 'general');
    const seconds = Math.max(0, Math.min(300, Number(body.seconds) || 0));
    slowMode[ch] = seconds;
    return sendJson(res, 200, { ok: true, channel: ch, seconds });
  }
  // ── Direct IP ban (no live player required) ───────────────────────────────
  if (action === 'ipbanraw') {
    const ip = String(body.ip || '').trim();
    if (!ip) return sendJson(res, 400, { error: 'no ip' });
    const reason = String(body.reason || 'Admin ban').slice(0, 120);
    const mins = Number(body.minutes) || 0;
    admin.bansByIp[ip] = { nickname: '[direct]', reason, ts: Date.now(), until: mins > 0 ? Date.now() + mins * 60000 : 0 };
    logEvent('ban', ip, reason);
    await saveState();
    return sendJson(res, 200, { ok: true });
  }
  // ── Bulk player actions ────────────────────────────────────────────────────
  if (action === 'bulkaction') {
    const what = String(body.what || '');
    prunePlayers();
    if (what === 'kickguests') {
      const msg = String(body.message || 'Guest session ended.').slice(0, 200);
      let n = 0;
      for (const [id, p] of players) { if (!p.account) { admin.kicks[id] = { message: msg, ts: Date.now() }; n++; } }
      return sendJson(res, 200, { ok: true, count: n });
    }
    if (what === 'kickall') {
      const msg = String(body.message || 'Server maintenance.').slice(0, 200);
      let n = 0;
      for (const [id] of players) { admin.kicks[id] = { message: msg, ts: Date.now() }; n++; }
      return sendJson(res, 200, { ok: true, count: n });
    }
    if (what === 'freezeall') {
      for (const [id] of players) admin.frozen[id] = 0;
      return sendJson(res, 200, { ok: true, count: players.size });
    }
    if (what === 'unfreezeall') {
      for (const id of Object.keys(admin.frozen)) delete admin.frozen[id];
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 400, { error: 'unknown bulk action' });
  }
  // ── Coin history ──────────────────────────────────────────────────────────
  if (action === 'coinhistory') {
    return sendJson(res, 200, { ok: true, history: coinHistory.slice(-200) });
  }
  // ── Leaderboard (tournament top players) ──────────────────────────────────
  if (action === 'leaderboard') {
    const tour = tournamentState('');
    return sendJson(res, 200, { ok: true, top: tour.top || [] });
  }
  // ── System health ─────────────────────────────────────────────────────────
  if (action === 'syshealth') {
    const uptimeSec = Math.floor(process.uptime());
    const h = Math.floor(uptimeSec / 3600), m = Math.floor((uptimeSec % 3600) / 60), s = uptimeSec % 60;
    const mem = process.memoryUsage();
    prunePlayers();
    const now = Date.now();
    const online = [...players.values()].filter(p => now - p.lastSeen < PLAYER_TTL).length;
    return sendJson(res, 200, {
      ok: true,
      uptime: uptimeSec,
      uptimeFormatted: `${h}h ${m}m ${s}s`,
      memRss: mem.rss,
      memHeap: mem.heapUsed,
      memHeapTotal: mem.heapTotal,
      onlineNow: online,
      onlineHistory,
      errorLog: errorLog.slice(-50),
    });
  }
  // ── Session / join stats ──────────────────────────────────────────────────
  if (action === 'sessionstats') {
    const byDay = {};
    for (const e of events) {
      if (e.type !== 'join') continue;
      const day = new Date(e.ts).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    }
    return sendJson(res, 200, { ok: true, joinsByDay: byDay, totalSessions: stats.totalSessions });
  }
  // ── Most active players (by session time) ────────────────────────────────
  if (action === 'mostactive') {
    prunePlayers();
    const now = Date.now();
    const active = [...players.values()].map(p => ({
      id: p.id, nickname: p.nickname, activity: p.activity || '',
      sessionMin: Math.round((now - p.firstSeen) / 60000),
      online: now - p.lastSeen < PLAYER_TTL,
    })).sort((a, b) => b.sessionMin - a.sessionMin).slice(0, 20);
    return sendJson(res, 200, { ok: true, active });
  }
  return sendJson(res, 400, { error: 'unknown action' });
}


// ============================================================
// STAFF PANEL — role based, no password. The caller's role comes from their login session.
//   owner: everything, including granting/removing mods and editing any account.
//   mod:   moderation tools only (see MOD_ACTIONS); cannot grant roles or touch economy.
// ============================================================
async function staffTarget(username) {
  const acct = await accountByName(String(username || ''));
  if (!acct) return null;
  return acct;
}
async function handleStaff(req, res) {
  const body = await readBody(req);
  const who = await resolveSession(req).catch(() => null);
  if (!who || !who.role) return sendJson(res, 403, { error: 'staff only' });
  const owner = who.role === 'owner' || who.role === 'coowner';   // full tools
  const trueOwner = who.role === 'owner';                          // only the owner changes roles or acts on owners
  const action = String(body.action || '');
  const needOwner = () => sendJson(res, 403, { error: 'owner only' });
  // Co-owners can do almost everything, but never act on the owner, and never on another co-owner.
  if (trueOwner === false && owner && body.username && /^(player\.(ban|coins|item|streak|dailyReset|resetProfile|signout|op)|dc\.op)$/.test(action) && (action !== 'dc.op' || ['mute', 'purgeuser', 'kickuser'].includes(String(body.op)))) {
    const tr0 = await roleForName(String(body.username)).catch(() => null);
    if (tr0 === 'owner' || (tr0 === 'coowner' && String(body.username).toLowerCase() !== String(who.username).toLowerCase())) return sendJson(res, 200, { error: 'fixed', message: 'Only the owner can do that to ' + (tr0 === 'owner' ? 'the owner' : 'a co-owner') + '.' });
  }

  if (/^tour\.(get|set|replay|reset)$/.test(action)) {
    if (!owner) return needOwner();
    const op = action.slice(5); let cid = '';
    if (op === 'reset') { const acct = await staffTarget(body.username); if (!acct) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' }); cid = acct.id; }
    const out = tourAdmin(op === 'get' ? 'get' : op, { on: body.on, reward: body.reward, cid, payAgain: !!body.payAgain });
    if (out && out.ok && op !== 'get') audit(who, 'tour.' + op, op === 'reset' ? body.username : '', op === 'set' ? 'on=' + out.on + ', reward=' + out.reward : op === 'replay' ? 'version ' + out.version : (body.payAgain ? 'reward can be paid again' : ''));
    return sendJson(res, 200, out);
  }
  if (/^(games|boost|sched|backup|log|rooms|live|brand|fun)\./.test(action)) {
    if (!owner) return needOwner();
    const st = admin.settings;
    if (action === 'games.get') return sendJson(res, 200, { ok: true, games: GAME_KEYS.map(([k, n]) => ({ key: k, name: n, off: !!(st.gamesOff && st.gamesOff[k]) })) });
    if (action === 'games.set') {
      const k = String(body.key || ''); if (!GAME_KEYS.some((g) => g[0] === k)) return sendJson(res, 200, { error: 'bad', message: 'Unknown game.' });
      st.gamesOff = st.gamesOff || {}; if (body.off) st.gamesOff[k] = true; else delete st.gamesOff[k];
      audit(who, 'games.set', k, body.off ? 'switched off' : 'switched on'); await saveState().catch(() => {});
      return sendJson(res, 200, { ok: true, off: !!body.off });
    }
    if (action === 'boost.get') return sendJson(res, 200, { ok: true, boost: st.boost && st.boost.until > Date.now() ? st.boost : null });
    if (action === 'boost.set') {
      const mins = Math.max(0, Math.min(24 * 60, Math.round(Number(body.mins) || 0))), mult = Math.max(1, Math.min(5, Math.round((Number(body.mult) || 1) * 10) / 10));
      st.boost = mins && mult > 1 ? { mult, until: Date.now() + mins * 60000, label: String(body.label || '').slice(0, 40) } : null;
      audit(who, 'boost.set', '', st.boost ? 'x' + mult + ' for ' + mins + ' min' : 'ended'); await saveState().catch(() => {});
      return sendJson(res, 200, { ok: true, boost: st.boost });
    }
    if (action === 'sched.list') return sendJson(res, 200, { ok: true, items: st.sched || [], now: Date.now() });
    if (action === 'sched.add') {
      const text = String(body.text || '').trim().slice(0, 300), at = Math.round(Number(body.at) || 0), every = Math.max(0, Math.min(10080, Math.round(Number(body.every) || 0))), clearMins = Math.max(0, Math.min(1440, Math.round(Number(body.clearMins) || 0)));
      if (!text) return sendJson(res, 200, { error: 'bad', message: 'Write the announcement text.' });
      if (!at || at < Date.now() - 60000) return sendJson(res, 200, { error: 'bad', message: 'Pick a time in the future.' });
      st.sched = st.sched || []; if (st.sched.length >= 30) return sendJson(res, 200, { error: 'bad', message: 'You already have 30 scheduled announcements.' });
      st.sched.push({ id: randomBytes(5).toString('hex'), text, at, every, clearMins, by: who.username });
      audit(who, 'sched.add', '', text.slice(0, 60)); await saveState().catch(() => {});
      return sendJson(res, 200, { ok: true, items: st.sched });
    }
    if (action === 'sched.del') { st.sched = (st.sched || []).filter((x) => x.id !== String(body.id)); audit(who, 'sched.del', '', ''); await saveState().catch(() => {}); return sendJson(res, 200, { ok: true, items: st.sched }); }
    if (action === 'backup.export') {
      const sc = { ...st }; delete sc.teacherKey;
      audit(who, 'backup.export', '', '');
      return sendJson(res, 200, { ok: true, file: { kind: 'scrollhub-backup', version: 1, at: new Date().toISOString(), settings: sc, customGames: admin.customGames, audit: admin.audit, months: stats.traffic ? Object.keys(stats.traffic.months).map((k) => ({ month: k, bytes: stats.traffic.months[k].bytes })) : [], totals: { sessions: stats.totalSessions } } });
    }
    if (action === 'backup.import') {
      const f = body.file; if (!f || f.kind !== 'scrollhub-backup' || !f.settings || typeof f.settings !== 'object') return sendJson(res, 200, { error: 'bad', message: 'That is not a ScrollHub backup file.' });
      const keep = admin.settings.teacherKey, keys = ['maintenance', 'redirect', 'announcement', 'schoolMode', 'schoolSet', 'schoolQuiz', 'schoolGamble', 'season', 'theme', 'gamesOff', 'sched', 'brand'];
      let n = 0; for (const k of keys) if (k in f.settings) { admin.settings[k] = f.settings[k]; n++; }
      admin.settings.teacherKey = keep; audit(who, 'backup.import', '', n + ' settings restored'); await saveState().catch(() => {});
      return sendJson(res, 200, { ok: true, restored: n });
    }
    if (action === 'log.tail') { const since = Number(body.since) || 0; return sendJson(res, 200, { ok: true, lines: LOG_RING.filter((x) => x.n > since).slice(-250), last: logSeq, up: Math.round(process.uptime()), mem: Math.round(process.memoryUsage().rss / 1048576) }); }
    if (action === 'rooms.list') return sendJson(res, 200, { ok: true, ...bwAdminRooms(), world: worldOnline() });
    if (action === 'rooms.end') { const okk = bwEndRoom(body.id); audit(who, 'rooms.end', String(body.id), okk ? 'ended' : 'not running'); return sendJson(res, 200, okk ? { ok: true } : { error: 'gone', message: 'That match is not running any more.' }); }
    if (action === 'brand.set') {
      const name = String(body.name || '').replace(/[<>]/g, '').trim().slice(0, 40), tagline = String(body.tagline || '').replace(/[<>]/g, '').trim().slice(0, 90);
      st.brand = name || tagline ? { name, tagline } : null; audit(who, 'brand.set', '', name); await saveState().catch(() => {});
      return sendJson(res, 200, { ok: true, brand: st.brand });
    }
    if (action === 'live.countdown') {
      st.live = st.live || {}; const label = String(body.label || '').trim().slice(0, 60), at = Math.round(Number(body.at) || 0);
      st.live.countdown = label && at > Date.now() ? { label, at } : null; audit(who, 'live.countdown', '', st.live.countdown ? label : 'cleared'); await saveState().catch(() => {});
      return sendJson(res, 200, { ok: true, countdown: st.live.countdown });
    }
    if (action === 'live.poll') {
      st.live = st.live || {};
      if (body.end) { st.live.poll = null; audit(who, 'live.poll', '', 'closed'); await saveState().catch(() => {}); return sendJson(res, 200, { ok: true }); }
      const q = String(body.q || '').trim().slice(0, 120), opts = (Array.isArray(body.opts) ? body.opts : []).map((x) => String(x || '').trim().slice(0, 50)).filter(Boolean).slice(0, 6);
      if (!q || opts.length < 2) return sendJson(res, 200, { error: 'bad', message: 'A poll needs a question and at least two choices.' });
      const mins = Math.max(0, Math.min(1440, Math.round(Number(body.mins) || 0)));
      st.live.poll = { id: randomBytes(4).toString('hex'), q, opts, votes: {}, endAt: mins ? Date.now() + mins * 60000 : 0 };
      audit(who, 'live.poll', '', q); await saveState().catch(() => {});
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'fun.party') {
      globalThis.SH_PARTY = { id: String(Date.now()), until: Date.now() + 45000, by: who.username };
      audit(who, 'fun.party', '', '');
      return sendJson(res, 200, { ok: true, message: 'Party started. Everyone on the site gets confetti within about 15 seconds.' });
    }
    if (action === 'fun.online') {
      const now = Date.now(), list = [...players.values()].filter((p2) => now - p2.lastSeen < 90000 && hasProfile(p2.id)).map((p2) => ({ id: p2.id, nickname: p2.nickname }));
      return sendJson(res, 200, { ok: true, players: list });
    }
    if (action === 'fun.rain' || action === 'fun.raffle') {
      const now = Date.now(), pool = [...players.values()].filter((p2) => now - p2.lastSeen < 90000 && hasProfile(p2.id));
      if (!pool.length) return sendJson(res, 200, { error: 'none', message: 'Nobody with a casino profile is online right now.' });
      const amount = Math.max(1, Math.min(5000000, Math.floor(Number(body.amount) || 0)));
      if (!amount) return sendJson(res, 200, { error: 'bad', message: 'Pick an amount.' });
      let winners = pool;
      if (action === 'fun.raffle') { const n = Math.max(1, Math.min(10, Math.floor(Number(body.count) || 1))); winners = pool.slice().sort(() => Math.random() - .5).slice(0, n); }
      for (const w of winners) grantCoins(w.id, amount);
      const names = winners.map((w) => w.nickname);
      const msg = action === 'fun.rain' ? 'Scroll rain! ' + amount.toLocaleString('en-US') + ' Scrolls for everyone online (' + winners.length + ' players).' : 'Raffle winner' + (names.length > 1 ? 's' : '') + ': ' + names.slice(0, 5).join(', ') + (names.length > 5 ? ' and ' + (names.length - 5) + ' more' : '') + ' won ' + amount.toLocaleString('en-US') + ' Scrolls each!';
      admin.broadcast = { text: msg.slice(0, 300), ts: Date.now() };
      audit(who, action, '', amount + ' x ' + winners.length);
      return sendJson(res, 200, { ok: true, winners: names, amount, message: msg });
    }
  }
  if (action === 'fb.get' || action === 'fb.set') {
    if (!trueOwner) return sendJson(res, 403, { error: 'owner only', message: 'Only the owner sees questionnaire answers.' });
    if (action === 'fb.set') { surveySet({ on: body.on, reward: body.reward, newRound: !!body.newRound }); audit(who, 'fb.set', '', body.newRound ? 'new round' : body.on != null ? (body.on ? 'on' : 'off') : 'reward ' + body.reward); }
    return sendJson(res, 200, { ok: true, ...surveyAdmin() });
  }
  if (/^subs\.(list|approve|reject|bulk|block|unblock|trust|untrust)$/.test(action)) {
    if (!trueOwner) return sendJson(res, 403, { error: 'owner only', message: 'Only the owner decides on submissions.' });
    const light = (x) => {
      const o = { id: x.id, kind: x.kind, by: x.by, title: x.title, at: x.at, status: x.status, note: x.note || '', decidedAt: x.decidedAt || 0, auto: !!x.auto };
      const pl = x.payload;
      if (x.status === 'pending' && pl && !pl.dropped) {
        if (x.kind === 'sprite') o.sprite = { type: pl.type, label: pl.label, price: pl.price, rarity: pl.rarity, fx: pl.fx, sprite: pl.sprite, params: pl.params, value: pl.type === 'banner' ? pl.value : '' };
        if (x.kind === 'map') { const c = GMS.checkMap(pl); o.map = { game: pl.game, name: pl.name, desc: pl.desc || '', walls: (pl.w || []).length, props: (pl.props || []).length, problems: c.ok ? c.problems : [c.msg || 'broken'] }; }
      }
      return o;
    };
    if (action === 'subs.list') {
      const pend = subList('pending').reverse().map(light), done = subList().filter((x) => x.status !== 'pending').slice(0, 40).map(light);
      const blocked = subBlockList().map((b) => b.user), trusted = trustList().map((t) => t.user);
      pend.forEach((o) => { o.blocked = blocked.includes(String(o.by).toLowerCase()); o.trusted = trusted.includes(String(o.by).toLowerCase()); });
      return sendJson(res, 200, { ok: true, pending: pend, done, blocked, trusted });
    }
    if (action === 'subs.trust' || action === 'subs.untrust') {
      const r = trustSet(body.user, action === 'subs.trust');
      if (r.err) return sendJson(res, 200, { error: 'bad', message: r.err });
      audit(who, action, String(body.user || ''), '');
      return sendJson(res, 200, { ok: true, trusted: trustList().map((t) => t.user) });
    }
    if (action === 'subs.block' || action === 'subs.unblock') {
      const r = subBlockSet(body.user, action === 'subs.block', body.reject !== false);
      if (r.err) return sendJson(res, 200, { error: 'bad', message: r.err });
      audit(who, action, String(body.user || ''), r.rejected ? 'rejected ' + r.rejected + ' waiting' : '');
      return sendJson(res, 200, { ok: true, rejected: r.rejected });
    }
    if (action === 'subs.bulk') {
      const mode = body.mode === 'reject' ? 'reject' : 'approve', only = body.user ? String(body.user).toLowerCase() : '';
      const rar = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(body.rarity) ? body.rarity : undefined;
      let ok = 0, skipped = 0;
      for (const sb of subList('pending')) {
        if (only && String(sb.by).toLowerCase() !== only) continue;
        if (mode === 'reject') { if (!subDecide(sb.id, false, { note: body.note, by: who.username }).err) ok++; continue; }
        if (sb.kind === 'map') {
          const sv = GMS.saveMap({ ...(sb.payload || {}) }, sb.by);
          if (!sv.ok || sv.problems.length) { skipped++; if (sv.ok) GMS.deleteMap(sv.id, who.username); continue; }
          GMS.setRotation(String(sb.payload.game), sv.id, true);
          if (!subDecide(sb.id, true, { note: body.note, by: who.username, mapId: sv.id, meta: { game: sb.payload.game, name: sb.payload.name } }).err) ok++;
        } else if (!subDecide(sb.id, true, { note: body.note, price: body.price, rarity: rar, by: who.username }).err) ok++;
      }
      audit(who, 'subs.bulk', only || 'everyone', mode + ' ' + ok + (skipped ? ', skipped ' + skipped : ''));
      return sendJson(res, 200, { ok: true, done: ok, skipped });
    }
    const id = String(body.id || ''), sub = subGet(id);
    if (!sub) return sendJson(res, 200, { error: 'gone', message: 'That submission is gone.' });
    if (action === 'subs.reject') {
      const r = subDecide(id, false, { note: body.note, by: who.username });
      if (r.err) return sendJson(res, 200, { error: 'bad', message: r.err });
      audit(who, 'subs.reject', sub.by, sub.kind + ': ' + sub.title); return sendJson(res, 200, { ok: true });
    }
    let extra = {};
    if (sub.kind === 'map') {
      if (sub.status !== 'pending') return sendJson(res, 200, { error: 'bad', message: 'It was already ' + sub.status + '.' });
      const sv = GMS.saveMap({ ...(sub.payload || {}) }, sub.by);
      if (!sv.ok) return sendJson(res, 200, { error: 'bad', message: sv.msg || 'The map could not be saved.' });
      extra = { mapId: sv.id, problems: sv.problems };
      if (body.rotation !== false && !sv.problems.length) GMS.setRotation(String(sub.payload.game), sv.id, true);
    }
    const r = subDecide(id, true, { note: body.note, price: body.price, rarity: body.rarity, by: who.username, mapId: extra.mapId, meta: sub.kind === 'map' ? { game: sub.payload.game, name: sub.payload.name } : null });
    if (r.err) return sendJson(res, 200, { error: 'bad', message: r.err });
    audit(who, 'subs.approve', sub.by, sub.kind + ': ' + sub.title);
    return sendJson(res, 200, { ok: true, ...extra });
  }
  if (action === 'theme.set') {
    if (!owner) return needOwner();
    const t = body.theme || {};
    const BG = ['video', 'stars', 'aurora', 'nebula', 'milkyway', 'galaxy', 'wormhole', 'colorflow', 'lightshapes', 'silk', 'heavyrain', 'rainytraffic', 'rainywindow', 'citynight', 'waterfall', 'waves', 'snow', 'fireworks', 'smoke', 'bokeh', 'tunnel', 'particles', 'sunset', 'custom'];
    const url = String(t.url || '').trim();
    admin.settings.theme = {
      bg: BG.includes(t.bg) ? t.bg : 'video',
      accent: /^#[0-9a-fA-F]{6}$/.test(String(t.accent || '')) ? String(t.accent).toLowerCase() : '',
      url: /^https:\/\/[^\s"'()<>\\]{3,300}$/.test(url) ? url : '',
      dim: Math.max(0, Math.min(60, Math.round(Number(t.dim) || 0))),
      force: !!t.force,
    };
    audit(who, 'theme.set', '', 'bg=' + admin.settings.theme.bg + (admin.settings.theme.force ? ', forced' : ''));
    await saveState().catch(() => {});
    return sendJson(res, 200, { ok: true, theme: admin.settings.theme });
  }
  if (action === 'traffic') {
    if (!owner) return needOwner();
    const m = new Date().toISOString().slice(0, 7), mo = stats.traffic.months[m] || { bytes: 0, cats: {}, days: {} };
    const capGb = Number(process.env.TRAFFIC_CAP_GB) || 5;
    const top = [...bootPaths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([path, bytes]) => ({ path, bytes }));
    return sendJson(res, 200, { ok: true, month: m, bytes: mo.bytes, cats: mo.cats, days: mo.days, capBytes: capGb * 1024 ** 3, months: Object.keys(stats.traffic.months).sort().map((k) => ({ month: k, bytes: stats.traffic.months[k].bytes })), top, since: TRAFFIC_SINCE, openSockets: wsOpen.size });
  }
  if (action === 'staff.list') return sendJson(res, 200, { ok: true, staff: await listStaff() });
  if (action === 'players.search') {
    const q = String(body.q || '').slice(0, 30);
    const names = await searchNames(q, 25);
    const now = Date.now();
    const live = new Map();
    for (const p of players.values()) if (p.account && now - p.lastSeen < PLAYER_TTL) live.set(String(p.nickname || '').toLowerCase(), true);
    const list = [];
    for (const n of names) list.push({ username: n, online: live.has(n.toLowerCase()), role: await roleForName(n) });
    return sendJson(res, 200, { ok: true, players: list });
  }
  if (action === 'player.get') {
    const acct = await staffTarget(body.username);
    if (!acct) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' });
    const live = players.get(acct.id) || null;
    const now = Date.now();
    const out = {
      username: acct.username, id: acct.id, createdAt: acct.createdAt || 0, lastSeen: acct.lastSeen || 0, ban: accountBan(acct), role: await roleForName(acct.username),
      live: live ? { online: now - live.lastSeen < PLAYER_TTL, location: live.location || '', activity: live.activity || '', since: live.firstSeen, frozen: frozenActive(acct.id), muted: !!(muted[live.ip] && (muted[live.ip].until === 0 || muted[live.ip].until > now)), ip: owner ? live.ip : undefined } : null,
      note: playerNotes[acct.id] || '', chatOwner: !!admin.chatOwners[acct.id],
    };
    if (owner) out.casino = adminProfile(acct.id);
    else { try { const c = publicUserCard(acct.id); out.card = c; } catch (e) {} }
    return sendJson(res, 200, { ok: true, player: out });
  }
  if (action === 'players.live') {
    prunePlayers();
    const now = Date.now();
    const list = [...players.values()].filter((p) => now - p.lastSeen < PLAYER_TTL).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 200).map((p) => ({ id: p.id, nickname: p.nickname, account: !!p.account, activity: p.activity || '', location: p.location || '', frozen: frozenActive(p.id), ip: owner ? p.ip : undefined }));
    return sendJson(res, 200, { ok: true, players: list });
  }
  if (action === 'players.list') {
    // Every account, online or offline. Filters: all | online | staff | banned. Sort: recent | name | joined | scrolls (owner).
    const q = String(body.q || '').toLowerCase().trim().slice(0, 30);
    const filter = String(body.filter || 'all'); const sort = String(body.sort || 'recent');
    const limit = Math.max(10, Math.min(100, Number(body.limit) || 40)); const offset = Math.max(0, Number(body.offset) || 0);
    const all = await allAccounts(!!body.refresh);
    const now = Date.now(); const live = new Map();
    for (const p of players.values()) if (p.account && now - p.lastSeen < PLAYER_TTL) live.set(p.id, p);
    let list = all.map((a) => ({ username: a.username, id: a.id, createdAt: a.createdAt, lastSeen: Math.max(a.lastSeen || 0, (live.get(a.id) || {}).lastSeen || 0), role: a.role, banned: !!a.ban, ban: a.ban ? { until: a.ban.until || 0, reason: a.ban.reason || '', by: a.ban.by || '', ts: a.ban.ts || 0 } : null, online: live.has(a.id), activity: live.has(a.id) ? (live.get(a.id).activity || '') : '' }));
    if (owner) list.forEach((x) => { x.coins = walletCoins(x.id); });
    const counts = { all: list.length, online: list.filter((x) => x.online).length, staff: list.filter((x) => x.role).length, banned: list.filter((x) => x.banned).length };
    if (q) list = list.filter((x) => x.username.toLowerCase().includes(q));
    if (filter === 'online') list = list.filter((x) => x.online); else if (filter === 'staff') list = list.filter((x) => x.role); else if (filter === 'banned') list = list.filter((x) => x.banned);
    if (sort === 'name') list.sort((a, b) => a.username.localeCompare(b.username));
    else if (sort === 'joined') list.sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === 'scrolls' && owner) list.sort((a, b) => (b.coins || 0) - (a.coins || 0));
    else list.sort((a, b) => (b.online - a.online) || (b.lastSeen - a.lastSeen) || (b.createdAt - a.createdAt));
    return sendJson(res, 200, { ok: true, total: list.length, counts, players: list.slice(offset, offset + limit) });
  }
  if (action === 'player.ban' || action === 'player.unban') {
    const t = await staffTarget(body.username);
    if (!t) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' });
    const tr = await roleForName(t.username);
    if (tr === 'owner' || (tr === 'coowner' && !trueOwner) || (tr === 'mod' && !owner)) return sendJson(res, 200, { error: 'fixed', message: 'You cannot ban ' + (tr === 'owner' ? 'an owner' : tr === 'coowner' ? 'a co-owner' : 'another moderator') + '.' });
    if (action === 'player.unban') {
      if (!owner) return needOwner();
      await setAccountBan(t.username, null); audit(who, 'unban account', t.username, ''); return sendJson(res, 200, { ok: true });
    }
    let mins = Math.floor(Number(body.minutes) || 0);
    if (!owner && (mins <= 0 || mins > 10080)) mins = 10080;
    const reason = String(body.reason || 'Banned by staff').slice(0, 120);
    await setAccountBan(t.username, { until: mins > 0 ? Date.now() + mins * 60000 : 0, reason, by: who.username });
    admin.kicks[t.id] = { message: 'Your account has been banned. ' + reason, ts: Date.now() };
    audit(who, 'ban account', t.username, (mins ? mins + 'm ' : 'permanent ') + reason);
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'discord.chans') return sendJson(res, 200, { ok: true, ...monChannels(owner) });
  if (action === 'discord.msgs') {
    const cid = String(body.channel || '').slice(0, 80); const r = monMessages(cid, owner, +body.limit || 100);
    if (r.error) return sendJson(res, r.error === 'owner only' ? 403 : 404, r);
    if (cid.startsWith('dm:')) { try { audit(who, 'discord.viewdm', r.label, ''); } catch (e) {} }
    return sendJson(res, 200, r);
  }
  if (action === 'discord.recent') return sendJson(res, 200, monRecent(owner, +body.limit || 60, +body.since || 0));
  if (action === 'discord.search') return sendJson(res, 200, monSearch(body.q, owner, +body.limit || 80));
  if (action === 'discord.del') {
    const r = monDelete(String(body.channel || '').slice(0, 80), String(body.id || '').slice(0, 40), owner);
    if (r.error) return sendJson(res, r.error === 'owner only' ? 403 : 404, r);
    try { audit(who, 'discord.delete', r.who + ' in ' + r.where, ''); } catch (e) {}
    return sendJson(res, 200, r);
  }
  if (action === 'casino.table.get') { if (!owner) return needOwner(); return sendJson(res, 200, { ok: true, ...tableState() }); }
  if (action === 'casino.table.set') {
    if (!owner) return needOwner();
    const g = String(body.game || ''), op = String(body.op || ''), r = tableControl(g, op, body.value, body.count);
    if (r.error) return sendJson(res, 200, r);
    audit(who, 'casino table', g, op + ' ' + String(body.value == null ? '' : body.value) + (body.count > 1 ? ' x' + body.count : ''));
    return sendJson(res, 200, { ok: true, ...tableState() });
  }
  if (action.startsWith('casino.rig.')) {
    if (!owner) return needOwner();
    if (action === 'casino.rig.list') return sendJson(res, 200, { ok: true, ...rigList() });
    if (action === 'casino.rig.add') {
      let cid = '', name = '';
      if (body.username && String(body.username).trim()) {
        const t = await staffTarget(body.username);
        if (!t) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' });
        cid = t.id; name = t.username;
      }
      const r = rigAdd({ ...body, cid, name }, who.username);
      audit(who, 'casino rig', name || 'everyone', r.game + ' ' + r.mode + (r.mode === 'payout' ? ' ' + r.min + '-' + (r.max || 'any') + 'x' : r.mode === 'chance' ? ' ' + r.chance + '%' : '') + (r.uses ? ' x' + r.uses : ''));
      return sendJson(res, 200, { ok: true, rule: r, ...rigList() });
    }
    if (action === 'casino.rig.del') { rigDelete(String(body.id || '')); audit(who, 'casino rig removed', String(body.id || ''), ''); return sendJson(res, 200, { ok: true, ...rigList() }); }
    if (action === 'casino.rig.toggle') { rigToggle(String(body.id || ''), body.on); return sendJson(res, 200, { ok: true, ...rigList() }); }
    if (action === 'casino.rig.clear') { rigClear(); audit(who, 'casino rig cleared', '', ''); return sendJson(res, 200, { ok: true, ...rigList() }); }
  }
  if (action === 'casino.cfg.get') { if (!owner) return needOwner(); return sendJson(res, 200, { ok: true, ...casinoCfgGet() }); }
  if (action === 'casino.cfg.set') {
    if (!owner) return needOwner();
    const r = casinoCfgSet(body); if (r.error) return sendJson(res, 400, r);
    try { const keys = Object.keys(body).filter((k) => k !== 'action'); audit(who, 'casino.cfg', keys.join(','), JSON.stringify(body.game || body.item || {}).slice(0, 120)); } catch (e) {}
    return sendJson(res, 200, { ok: true, ...casinoCfgGet() });
  }
  if (action === 'player.op') {
    const t = await staffTarget(body.username);
    if (!t) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' });
    const r = adminPlayerOp(t.id, String(body.op || ''), body.value, owner);
    if (r.error) return sendJson(res, r.error === 'owner only' ? 403 : 400, r);
    try { audit(who, 'player.' + body.op, t.username, body.value != null ? String(body.value).slice(0, 40) : ''); } catch (e) {}
    return sendJson(res, 200, r);
  }
  if (action === 'dc.state') return sendJson(res, 200, { ok: true, ...dcAdminState() });
  if (action === 'dc.op') {
    const op = String(body.op || ''); const OWNER_OPS = ['purgeuser', 'clearchannel', 'say', 'flag', 'maxlen', 'deleteserver', 'renameserver', 'clearicon'];
    if (OWNER_OPS.includes(op) && !owner) return needOwner();
    const a = { channel: String(body.channel || ''), guild: String(body.guild || ''), text: body.text, seconds: body.seconds, minutes: body.minutes, flag: body.flag, on: body.on, value: body.value, name: body.name };
    let label = a.channel || a.guild || a.flag || '';
    if (['mute', 'unmute', 'purgeuser', 'kickuser'].includes(op)) { const t = await staffTarget(body.username); if (!t) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' }); a.uid = t.id; label = t.username; }
    if (op === 'mute' && !owner) a.minutes = Math.min(60, Number(a.minutes) || 10);
    const r = dcAdminOp(op, a); if (r.error) return sendJson(res, 400, r);
    try { audit(who, 'discord.' + op, label, ''); } catch (e) {}
    return sendJson(res, 200, r);
  }
  if (action === 'discord.servers') { if (!owner) return needOwner(); return sendJson(res, 200, { ok: true, ...discordGuildList() }); }
  if (action === 'discord.setdefault') {
    if (!owner) return needOwner();
    let everyone = null; if (body.everyone) { try { everyone = (await allAccounts()).map((a) => ({ id: a.id, username: a.username })); } catch (e) { everyone = []; } }
    const r = discordSetDefault(String(body.id || ''), everyone); if (r.error) return sendJson(res, 400, r);
    try { audit(who, 'discord.setdefault', r.name + (body.everyone ? ' (added ' + r.added + ' existing accounts)' : '')); } catch (e) {}
    return sendJson(res, 200, r);
  }
  // ---- the two things every admin panel shows at the bottom: recent activity for that panel, and shared team notes (any staff member)
  if (action === 'panel.activity') {
    const pre = (Array.isArray(body.prefixes) ? body.prefixes : []).map((x) => String(x).toLowerCase()).filter(Boolean).slice(0, 14);
    const n = Math.max(1, Math.min(15, Number(body.limit) || 6));
    const items = admin.audit.filter((e) => !pre.length || pre.some((p) => String(e.action).toLowerCase().includes(p))).slice(-n).reverse();
    return sendJson(res, 200, { ok: true, items });
  }
  if (action === 'notes.get' || action === 'notes.set') {
    const key = String(body.key || '').replace(/[^a-z0-9_.-]/gi, '').slice(0, 40);
    if (!key) return sendJson(res, 400, { error: 'bad key', message: 'That panel has no notes' });
    const notes = admin.notes || (admin.notes = {});
    if (action === 'notes.set') {
      const text = String(body.text || '').slice(0, 1500);
      if (text.trim()) { if (!notes[key] && Object.keys(notes).length >= 80) return sendJson(res, 400, { error: 'full', message: 'Too many notes' }); notes[key] = { text, by: who.username, ts: Date.now() }; }
      else delete notes[key];
      audit(who, 'notes.set', key, text.slice(0, 60));
      saveState().catch(() => {});
    }
    return sendJson(res, 200, { ok: true, note: notes[key] || null });
  }
  if (/^(news|apps|errors)\./.test(action)) return sendJson(res, 200, await siteops.staff(action, body, who));
  if (action === 'audit.list') { if (!owner) return needOwner(); return sendJson(res, 200, { ok: true, audit: admin.audit.slice(-200).reverse() }); }

  // ---- everything below is owner only ----
  const ownerActions = ['staff.setrole', 'player.coins', 'player.item', 'player.streak', 'player.dailyReset', 'player.resetProfile', 'player.signout', 'player.resetpw', 'store.list'];
  if (ownerActions.includes(action) && !owner) return needOwner();
  if (action === 'staff.setrole' && !trueOwner) return needOwner();

  if (action === 'store.list') return sendJson(res, 200, { ok: true, items: adminStoreList() });

  if (action === 'staff.setrole') {
    const acct = await staffTarget(body.username);
    if (!acct) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' });
    if (isOwnerName(acct.username)) return sendJson(res, 200, { error: 'fixed', message: 'Owners cannot be changed.' });
    const role = body.role === 'mod' ? 'mod' : body.role === 'coowner' ? 'coowner' : null;
    const before = await roleForName(acct.username).catch(() => null);
    await setRole(acct.username, role);
    audit(who, role ? 'grant ' + role : 'remove ' + (before || 'role'), acct.username, '');
    if (role) modHQAdd(acct.id, acct.username); else modHQRemove(acct.id);
    return sendJson(res, 200, { ok: true, staff: await listStaff() });
  }

  const acct = ownerActions.includes(action) ? await staffTarget(body.username) : null;
  if (ownerActions.includes(action) && !acct) return sendJson(res, 200, { error: 'no-account', message: 'No account with that username.' });

  if (action === 'player.coins') {
    const mode = String(body.mode || 'give');
    const amt = Math.max(0, Math.min(1e12, Math.floor(Number(body.amount) || 0)));
    let bal;
    if (mode === 'set') bal = adminSetCoins(acct.id, amt);
    else bal = grantCoins(acct.id, mode === 'take' ? -amt : amt);
    audit(who, 'scrolls ' + mode, acct.username, String(amt) + ' -> ' + bal);
    coinHistory.push({ ts: Date.now(), name: acct.username, amount: mode === 'take' ? -amt : mode === 'set' ? 0 : amt, reason: 'Staff ' + mode + ' (' + who.username + ')' });
    if (coinHistory.length > 500) coinHistory.shift();
    return sendJson(res, 200, { ok: true, balance: bal });
  }
  if (action === 'player.item') {
    const mode = String(body.mode || 'give'); const itemId = String(body.itemId || '');
    let inv = null;
    if (mode === 'give') inv = adminGiveItem(acct.id, itemId);
    else if (mode === 'take') inv = adminTakeItem(acct.id, itemId);
    else if (mode === 'giveall') inv = adminGiveAllItems(acct.id);
    else if (mode === 'clear') inv = adminClearInventory(acct.id);
    if (!inv) return sendJson(res, 200, { error: 'bad-item', message: 'Unknown item.' });
    audit(who, 'item ' + mode, acct.username, itemId);
    return sendJson(res, 200, { ok: true, inventory: inv });
  }
  if (action === 'player.streak') { adminSetField(acct.id, 'streak', body.value); audit(who, 'set streak', acct.username, String(body.value)); return sendJson(res, 200, { ok: true }); }
  if (action === 'player.dailyReset') { adminSetField(acct.id, 'dailyReady', 0); audit(who, 'reset daily', acct.username, ''); return sendJson(res, 200, { ok: true }); }
  if (action === 'player.resetProfile') { adminResetProfile(acct.id); audit(who, 'reset profile', acct.username, ''); return sendJson(res, 200, { ok: true }); }
  if (action === 'player.resetpw') {
    if (isOwnerName(acct.username)) return sendJson(res, 200, { error: 'fixed', message: 'Owner accounts cannot be reset this way.' });
    const code = await staffResetCode(acct.username);
    audit(who, 'password reset code', acct.username, '');
    return sendJson(res, 200, { ok: true, code, minutes: 60 });
  }
  if (action === 'player.signout') {
    await revokeSessions(acct.username);
    audit(who, 'sign out everywhere', acct.username, '');
    return sendJson(res, 200, { ok: true });
  }
  // anything else is a legacy tool action (settings, bans, announcements, chat tools ...)
  return handleAdmin(req, res, body, who);
}


// ============================================================
// SCROLL RACING rewards. The client reports a finishing place; the server only pays if the race
// lasted long enough, the token is unused, and the account is under today's cap.
// ============================================================
const racingRuns = new Map(); // token -> { uid, t0, laps, diff, used }
const racingDaily = new Map(); // uid -> { day, total }
const racingLast = new Map(); // uid -> last start time
const RACE_PAY = [140, 95, 65, 40, 25, 15, 10, 10];
async function handleRacing(req, res, url) {
  const who = await resolveSession(req).catch(() => null);
  const body = await readBody(req);
  if (url === '/api/racing/start') {
    if (!who) return sendJson(res, 200, { ok: true, token: '' });
    const now = Date.now();
    if (now - (racingLast.get(who.id) || 0) < 8000) return sendJson(res, 200, { ok: true, token: '' });
    racingLast.set(who.id, now);
    for (const [k, v] of racingRuns) if (now - v.t0 > 3600000) racingRuns.delete(k);
    const laps = [1, 3, 5].includes(Number(body.laps)) ? Number(body.laps) : 3;
    const diff = ['easy', 'normal', 'hard'].includes(body.diff) ? body.diff : 'normal';
    const token = randomBytes(12).toString('hex');
    racingRuns.set(token, { uid: who.id, t0: now + 3600, laps, diff, used: false }); // the countdown is about 3.6s
    return sendJson(res, 200, { ok: true, token });
  }
  if (!who) return sendJson(res, 200, { error: 'login', message: 'Sign in to earn Scrolls.' });
  const run = racingRuns.get(String(body.token || ''));
  if (!run || run.uid !== who.id || run.used) return sendJson(res, 200, { error: 'bad-token', message: 'No reward for this race.' });
  run.used = true;
  const place = Math.floor(Number(body.place)), ms = Number(body.ms) || 0, elapsed = Date.now() - run.t0;
  if (!(place >= 1 && place <= 8)) return sendJson(res, 200, { error: 'bad-place', message: 'No reward for this race.' });
  if (elapsed < run.laps * 11000 || ms < run.laps * 11000 || ms > elapsed + 4000) return sendJson(res, 200, { error: 'too-fast', message: 'That race was too short to count.' });
  const mult = { easy: 0.6, normal: 1, hard: 1.4 }[run.diff] * (run.laps === 1 ? 0.4 : run.laps === 5 ? 1.5 : 1);
  let amount = Math.round(RACE_PAY[place - 1] * mult);
  const day = new Date().toISOString().slice(0, 10);
  let d = racingDaily.get(who.id); if (!d || d.day !== day) { d = { day, total: 0 }; racingDaily.set(who.id, d); }
  const room = Math.max(0, 2500 - d.total), capped = amount > room; amount = Math.min(amount, room); d.total += amount;
  let bal = null; if (amount > 0) { bal = grantCoins(who.id, amount); coinHistory.push({ ts: Date.now(), name: who.username, amount, reason: 'Scroll Racing ' + place + (place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th') }); if (coinHistory.length > 500) coinHistory.shift(); }
  return sendJson(res, 200, { ok: true, coins: amount, capped, balance: bal });
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
// Pinned catalog overrides. Stickman loads cross-origin from GitLab (works on
// open networks; may be blocked where gitlab.io is filtered). Thumbnail is
// routed through /imgx/ so it loads on our own domain.
const CATALOG_OVERRIDES = [
  // ── Top featured games ───────────────────────────────────────────────────
  { label: 'PolyTrack 0.6.0', url: '/iframe.html?url=/storage/ag/originals/polytrack-0.6.0/index.html', imageUrl: '/storage/ag/originals/polytrack-0.6.0/card.jpg', categories: ['Racing', 'Single Player'] },
  { label: 'Snow Road', url: '/gadget.html?url=https://cdn.jsdelivr.net/gh/nexorainteractives/Nexora-Assets@main/games/clsnowroad.html', imageUrl: '/storage/images/nexora/clsnowroad.webp', categories: ['Racing'] },
  { label: 'Wrestle Bros', url: '/gadget.html?url=https://cdn.jsdelivr.net/gh/nexorainteractives/Nexora-Assets@main/games/clwrestlebros.html', imageUrl: '/storage/images/nexora/clwrestlebros.webp', categories: ['Fighting', 'Multiplayer'] },
  { label: 'Escape Road 2', url: '/gadget.html?url=https://cdn.jsdelivr.net/gh/nexorainteractives/Nexora-Assets@main/games/clescaperoad2.html', imageUrl: '/storage/images/nexora/clescaperoad2.webp', categories: ['Racing', 'Action'] },
  { label: 'Burrito Bison', url: '/gadget.html?url=https://cdn.jsdelivr.net/gh/nexorainteractives/Nexora-Assets@main/games/clburritobison.html', imageUrl: '/storage/images/nexora/clburritobison.webp', categories: ['Platformer', 'Adventure'] },
  // ── Rest of pinned catalog ───────────────────────────────────────────────
  { label: 'Tomb of the Mask', url: '/iframe.html?url=/storage/ag/arsenic/tomb-of-the-mask/index.html', imageUrl: '/storage/images/main3/tombofthemask.png', categories: ['Arcade'] },
  { label: 'Paper.io 2', url: '/iframe.html?url=/storage/ag/originals/paperio2/index.html', imageUrl: '/storage/images/main/paper2.jpg', categories: ['.io'] },
  { label: 'Tactical Assassin 2', url: '/iframe.html?url=/storage/ag/echo/tacticalassasin2/index.html', imageUrl: '/storage/ag/echo/tacticalassasin2/tacticalassassin2.png', categories: ['Shooting'] },
  { label: 'Crazy Bikes', url: '/iframe.html?url=/storage/ag/arsenic/crazy-bikes/index.html', imageUrl: '/storage/images/main3/crazybikes.png', categories: ['Racing'] },
  { label: 'CrazyGames', url: '/iframe.html?url=/storage/ag/originals/crazygames/index.html', imageUrl: '/storage/ag/originals/crazygames/logo.png', categories: ['Arcade'] },
  { label: 'Melon Playground', url: '/iframe.html?url=/storage/ag/originals/melonplayground/index.html', imageUrl: '/storage/ag/originals/melonplayground/IMG_5304.jpeg', categories: ['Simulation'] },
  { label: 'Stickman Dragon Fight', url: '/extframe.html?url=https://ubgwtf.gitlab.io/stickman-dragon-fight/', imageUrl: '/imgx/https://ubgwtf.gitlab.io/assets/upload/ubgwtforg/png/stickman-dragon-fight.webp', categories: ['Fighting'] },
  // Nexora CDN games — routed through /gadget.html to handle Google Gadget XML format
  { label: 'Snow Rider 3D', url: '/iframe.html?url=/storage/ag/arsenic/snow-rider-3d/index.html', imageUrl: '/storage/images/main3/snowrider3d.png', categories: ['Racing', 'Sports'] },
  { label: '1v1.lol', url: '/gadget.html?url=https://cdn.jsdelivr.net/gh/nexorainteractives/Nexora-Assets@main/games/cl1v1lol.html', imageUrl: '/storage/images/nexora/cl1v1lol.webp', categories: ['Shooter', 'Multiplayer'] },
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
  // Always load the bundled catalog — it contains local additions (friends' games).
  // When the live fetch succeeds, merge bundled entries that aren't already present.
  let bundledGames = [];
  try { const fs = await import('node:fs'); const bt = fs.readFileSync(join(distDir, 'storage/data/collection.json'), 'utf8'); const bd = JSON.parse(bt); bundledGames = Array.isArray(bd) ? bd : (bd && bd.games ? bd.games : []); } catch (e) {}
  if (!baseTxt) { source = 'bundled'; }
  let obj = { games: [] };
  if (baseTxt) { try { const d = JSON.parse(baseTxt); if (Array.isArray(d)) obj = { games: d }; else if (d && typeof d === 'object' && Array.isArray(d.games)) obj = d; } catch (e) {} }
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.games)) obj = { games: [] };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Merge bundled extras into live base (bundled wins for games not in live, so friends' games always appear)
  if (baseTxt && bundledGames.length) {
    const liveNorm = new Set(obj.games.map((g) => norm(g.label)));
    for (const g of bundledGames) { if (g && !liveNorm.has(norm(g.label))) obj.games.push(g); }
  } else if (!baseTxt && bundledGames.length) {
    obj.games = bundledGames;
  }
  const base = obj.games;
  const ubg = await fetchUbgGames();
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

// ============================================================
// ScrollHub Hub (the launcher at /hub): ScrollHub Originals, per-game versions and
// update pushes. Installed games on a player's device are compared against the
// version + build ("rev") published here, so a new deploy or a manual push shows
// up as "Update" in everyone's library.
// ============================================================
const HUB_ORIGINALS = [
  { id: 'scrollhub-royale', title: 'Scroll Royale', dev: 'ScrollHub Studios', tagline: 'Drop in. Loot up. Outlast the storm.',
    desc: 'Jump from the battle bus onto a huge island of towns, farms and forests. Loot chests for rarity-tiered weapons, grab a jeep, a sports car or a tank, and outlast the closing storm. Up to 24 players, with bots filling empty slots.',
    tags: ['Battle Royale', 'Multiplayer', 'Shooter'], players: '1 to 24', url: '/arcade?play=royale', entry: '/arcade/bedwars/index.html', art: '/hub/art/royale.jpg', accent: '#3b82f6' },
  { id: 'scrollhub-bedwars', title: 'Bedwars 2D', dev: 'ScrollHub Studios', tagline: 'Guard your bed. Break theirs.',
    desc: 'Solo, Duos and Squads on floating islands. Mine resources, buy gear and upgrades, bridge to the middle for diamonds, and keep your bed alive. Big maps, bots, and party voice chat.',
    tags: ['Multiplayer', 'Strategy', 'Action'], players: '2 to 16', url: '/arcade?play=bw&mode=solo', entry: '/arcade/bedwars/index.html', art: '/arcade/bedwars/cover.png', accent: '#22b8cf' },
  { id: 'scrollhub-arcade', title: 'Game Hub', dev: 'ScrollHub Studios', tagline: 'One world. Every mode.',
    desc: 'Walk the hub world and step into a portal: Capture the Flag, TNT Spleef, Prop Hunt, Duels, Murder Mystery, Build Battle and more. Party up and your whole group comes along.',
    tags: ['Multiplayer', 'Party', 'Action'], players: '1 to 24', url: '/arcade', entry: '/arcade/bedwars/index.html', art: '/hub/art/arcade.jpg', accent: '#6366f1' },
  { id: 'scrollhub-ctf', title: 'Capture the Flag', dev: 'ScrollHub Studios', tagline: 'Steal their flag. Bring it home.',
    desc: 'Two teams of four. Grab the enemy flag, carry it back to your base and score three captures before the clock runs out. Bots fill empty spots.',
    tags: ['Multiplayer', 'Team', 'Action'], players: '2 to 8', url: '/arcade?play=ctf', entry: '/arcade/bedwars/index.html', art: '/hub/art/ctf.jpg', accent: '#3b82f6' },
  { id: 'scrollhub-spleef', title: 'TNT Spleef', dev: 'ScrollHub Studios', tagline: 'The floor falls away.',
    desc: 'Free for all on a floor that vanishes under your feet. Knock out the tiles around everyone else and be the last one standing.',
    tags: ['Multiplayer', 'Party', 'Arcade'], players: '2 to 8', url: '/arcade?play=spleef', entry: '/arcade/bedwars/index.html', art: '/hub/art/spleef.jpg', accent: '#60a5fa' },
  { id: 'scrollhub-prophunt', title: 'Prop Hunt', dev: 'ScrollHub Studios', tagline: 'Hide in plain sight.',
    desc: 'Hiders disguise themselves as props and blend into the map. Seekers get three minutes to find them all. Switch sides every round.',
    tags: ['Multiplayer', 'Party', 'Casual'], players: '2 to 8', url: '/arcade?play=hide', entry: '/arcade/bedwars/index.html', art: '/hub/art/hide.jpg', accent: '#38bdf8' },
  { id: 'scrollhub-duels', title: 'Duels', dev: 'ScrollHub Studios', tagline: 'One on one. First to five.',
    desc: 'A 1v1 sword fight on a small arena. Win five rounds before your opponent does, with ranked tracking on the leaderboard.',
    tags: ['Multiplayer', 'Fighting', 'Action'], players: '2', url: '/arcade?play=duel', entry: '/arcade/bedwars/index.html', art: '/hub/art/duel.jpg', accent: '#2563eb' },
  { id: 'scrollhub-murder', title: 'Murder Mystery', dev: 'ScrollHub Studios', tagline: 'Someone here is the murderer.',
    desc: 'One player is secretly the murderer, one is the detective, everyone else is trying to survive. Work out who to trust before it is too late.',
    tags: ['Multiplayer', 'Party', 'Strategy'], players: '2 to 8', url: '/arcade?play=murder', entry: '/arcade/bedwars/index.html', art: '/hub/art/murder.jpg', accent: '#1d4ed8' },
  { id: 'scrollhub-build', title: 'Build Battle', dev: 'ScrollHub Studios', tagline: 'Build the theme. Win the vote.',
    desc: 'Everyone gets the same theme and a plot of their own. Build it in 150 seconds, then the whole lobby votes on the best build.',
    tags: ['Multiplayer', 'Creative', 'Casual'], players: '2 to 4', url: '/arcade?play=build', entry: '/arcade/bedwars/index.html', art: '/hub/art/build.jpg', accent: '#0ea5e9' },
  { id: 'scrollhub-casino', title: 'Scrolls Casino', dev: 'ScrollHub Studios', tagline: 'Crash, Roulette, Mines and more.',
    desc: 'A full casino floor played with Scrolls, the in-game currency. Blackjack, Slots, Plinko, Case Battles, a weekly tournament and daily rewards. Play money only, nothing real is ever wagered.',
    tags: ['Casino', 'Casual', 'Multiplayer'], players: '1 or more', url: '/casino', entry: '/casino/index.html', art: '/hub/art/casino.jpg', accent: '#2563eb', casino: true },
  { id: 'scrollhub-draw-guess', title: 'Draw & Guess', dev: 'ScrollHub Studios', tagline: 'Sketch fast. Guess faster.',
    desc: 'Take turns drawing a secret word while everyone else races to guess it. Quick rounds, custom rooms and a live scoreboard.',
    tags: ['Party', 'Multiplayer', 'Casual'], players: '2 to 12', url: '/skribbl', entry: '/skribbl/index.html', art: '/hub/art/draw.jpg', accent: '#0ea5e9' },
  { id: 'scrollhub-sprite-lab', title: 'Sprite Lab', dev: 'ScrollHub Studios', tagline: 'Draw it. Animate it. Wear it.',
    desc: 'A pixel editor for characters, hats and banners. Paint frames, preview the animation and see your work in the game world.',
    tags: ['Creative', 'Tools', 'Single Player'], players: '1', url: '/arcade/sprites', entry: '/arcade/sprites.html', art: '/hub/art/sprites.jpg', accent: '#38bdf8' },
  { id: 'scrollhub-racing', title: 'Scroll Racing', dev: 'ScrollHub Studios', tagline: 'Drift. Grab items. Beat seven rivals online.',
    desc: 'A top-down kart racer starring your own gim. Race up to eight players (bots fill empty places) across four tracks, drift through corners for mini turbos, grab item boxes and fire Pulses, Seekers and Zaps. Finish high to earn Scrolls.',
    tags: ['Racing', 'Multiplayer', 'Arcade'], players: '1 to 8', url: '/arcade?play=race', entry: '/arcade/bedwars/index.html', art: '/hub/art/racing.jpg', accent: '#3b82f6' },
];
const _hubHash = new Map(); // file -> { sig, h }
function hubFileHash(rel) {
  try {
    const abs = join(distDir, rel); const st = nfs.statSync(abs); const sig = st.size + ':' + Math.floor(st.mtimeMs);
    const c = _hubHash.get(rel); if (c && c.sig === sig) return c.h;
    const h = createHash('sha1').update(nfs.readFileSync(abs)).digest('hex'); _hubHash.set(rel, { sig, h }); return h;
  } catch (e) { return ''; }
}
// The page plus every same-origin script/style/image it pulls in.
function hubAssets(entry) {
  const out = [entry];
  try {
    const html = nfs.readFileSync(join(distDir, entry), 'utf8'); const re = /(?:src|href)=["']([^"'#]+)["']/g; let m;
    while ((m = re.exec(html))) {
      let u = m[1]; if (/^(?:[a-z]+:)?\/\//i.test(u) || /^(?:data|mailto|blob|javascript):/i.test(u)) continue;
      u = u.split('?')[0]; if (!/\.(?:js|css|png|jpe?g|webp|svg|json|woff2?|mp3|ogg|wav)$/i.test(u)) continue;
      if (!u.startsWith('/')) u = entry.replace(/[^/]*$/, '') + u;
      out.push(u);
    }
  } catch (e) {}
  return [...new Set(out)];
}
function hubRev(files) { const h = createHash('sha1'); for (const f of files) h.update(f + ':' + hubFileHash(f)); return h.digest('hex').slice(0, 7); }
function hubVersions() { if (!admin.settings.hubVersions || typeof admin.settings.hubVersions !== 'object') admin.settings.hubVersions = {}; return admin.settings.hubVersions; }
function hubManifest() {
  const hv = hubVersions();
  const originals = HUB_ORIGINALS.map((g) => { const files = hubAssets(g.entry); const x = hv[g.id] || {}; return { ...g, files, rev: hubRev(files), v: x.v || '1.0.0', notes: x.notes || '', ts: x.ts || 0 }; });
  const versions = {}; const feed = [];
  for (const id of Object.keys(hv)) { const x = hv[id]; versions[id] = { v: x.v, notes: x.notes || '', ts: x.ts || 0, hist: (x.hist || []).slice(0, 6) }; for (const h of (x.hist || []).slice(0, 3)) feed.push({ id, title: x.title || id, v: h.v, notes: h.notes || '', ts: h.ts || 0 }); }
  feed.sort((a, b) => b.ts - a.ts);
  return { originals, versions, feed: feed.slice(0, 24), serverTime: Date.now() };
}

let collectionZ = null;
async function serveCollection(req, res, debug) {
  const now = Date.now();
  const sendData = (txt, source, ubg) => {
    if (debug) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ source, games: countGames(txt), ubgAdded: ubg, cachedAgeSec: Math.round((now - collectionCache.ts) / 1000) })); return; }
    const hdr = { 'content-type': 'application/json', 'cache-control': 'public, max-age=600', 'access-control-allow-origin': '*', 'x-sh-catalog': source, 'vary': 'Accept-Encoding' };
    const ae = String(req.headers['accept-encoding'] || '');
    const enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : '';
    if (enc && req.method !== 'HEAD' && typeof txt === 'string' && txt.length > 1024) {
      // The catalog is ~500 KB of JSON; send it compressed (kept until the text changes).
      if (!collectionZ || collectionZ.txt !== txt) collectionZ = { txt };
      const z = collectionZ;
      if (!z[enc]) z[enc] = enc === 'br' ? brotliCompressSync(Buffer.from(txt), { params: { [zconst.BROTLI_PARAM_QUALITY]: 5 } }) : gzipSync(Buffer.from(txt), { level: 6 });
      res.writeHead(200, { ...hdr, 'content-encoding': enc, 'content-length': z[enc].length }); res.end(z[enc]); return;
    }
    res.writeHead(200, hdr); res.end(req.method === 'HEAD' ? undefined : txt);
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
  res._trafficCat = 'upstream';
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
    let ctype = up.headers.get('content-type') || 'application/octet-stream';
    // Some upstream hosts serve .html files with text/plain which causes the
    // browser to display raw source instead of running the game. Force the
    // correct type whenever the path ends with .html.
    if (/\.html(?:[?#]|$)/i.test(req.url) && /^text\/plain/i.test(ctype)) {
      ctype = 'text/html; charset=utf-8';
    }
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

// ===================== Friends & DMs =====================
const friendsData = {}; // id -> { friends:[{id,name}], incoming:[{id,name}], outgoing:[{id,name}] }
const dms = {};         // "idA|idB" (sorted) -> [{ id, from, content, at }]
const dmReads = {};     // userId -> { convKey: lastReadAt }  (for unread badges)
const blockedData = {}; // userId -> [{ id, name }]
const reports = [];     // [{ id, reporter, reporterName, target, targetName, reason, at, handled }]
let _socialDirty = false;
function fentry(id) { if (!friendsData[id]) friendsData[id] = { friends: [], incoming: [], outgoing: [] }; return friendsData[id]; }
function convKey(a, b) { return [a, b].sort().join('|'); }
function socialSave() { _socialDirty = true; }
async function socialFlush() {
  if (!_socialDirty) return; _socialDirty = false;
  try { await kvSet('sh:friends', JSON.stringify(friendsData)); } catch (e) { _socialDirty = true; }
  try { await kvSet('sh:dms', JSON.stringify(dms)); } catch (e) { _socialDirty = true; }
  try { await kvSet('sh:dmreads', JSON.stringify(dmReads)); } catch (e) { _socialDirty = true; }
  try { await kvSet('sh:blocked', JSON.stringify(blockedData)); } catch (e) { _socialDirty = true; }
  try { await kvSet('sh:reports', JSON.stringify(reports.slice(-200))); } catch (e) { _socialDirty = true; }
}
setInterval(socialFlush, 8000);
try { const s = await kvGet('sh:friends'); if (s) Object.assign(friendsData, JSON.parse(s)); } catch (e) {}
try { const s = await kvGet('sh:dms'); if (s) Object.assign(dms, JSON.parse(s)); } catch (e) {}
try { const s = await kvGet('sh:dmreads'); if (s) Object.assign(dmReads, JSON.parse(s)); } catch (e) {}
try { const s = await kvGet('sh:blocked'); if (s) Object.assign(blockedData, JSON.parse(s)); } catch (e) {}
try { const s = await kvGet('sh:reports'); if (s) { const a = JSON.parse(s); if (Array.isArray(a)) reports.push(...a); } } catch (e) {}
function blockList(id) { return blockedData[id] || (blockedData[id] = []); }
function isBlocked(a, b) { return blockList(a).some((x) => x.id === b) || blockList(b).some((x) => x.id === a); }
function markRead(uid, key) { if (!dmReads[uid]) dmReads[uid] = {}; dmReads[uid][key] = Date.now(); }
function unreadCount(uid, friendId) {
  const key = convKey(uid, friendId);
  const msgs = dms[key] || [];
  const last = (dmReads[uid] && dmReads[uid][key]) || 0;
  let n = 0; for (const m of msgs) if (m.from === friendId && m.at > last) n++;
  return n;
}
for (const sig of ['SIGTERM', 'SIGINT']) { try { process.on(sig, () => { socialFlush().catch(() => {}); }); } catch (e) {} }

function isOnline(id) { const p = players.get(id); return !!(p && Date.now() - p.lastSeen < PLAYER_TTL); }
function friendBrief(x) {
  let cos = { color: '', tag: '', titleFx: '' }; try { cos = getCosmetics(x.id); } catch (e) {}
  const p = players.get(x.id);
  return { id: x.id, username: x.name, online: isOnline(x.id), activity: isOnline(x.id) ? (p.activity || '') : '', color: cos.color || '', title: cos.tag || '', titleFx: cos.titleFx || '' };
}
function hasId(list, id) { return list.some((x) => x.id === id); }
globalThis.SH_SOCIAL = { friends: (id) => fentry(id).friends.slice(), incoming: (id) => fentry(id).incoming.slice(), online: (id) => isOnline(id) };

async function handleSocial(url, req, res) {
  const a = req._auth;
  const path = url.split('?')[0];
  if (!a) { sendJson(res, 200, { error: 'login' }); return true; }
  const me = a.id, myName = a.username;
  const q = new URL(req.url || url, 'http://x').searchParams; // req.url carries the ?query

  if (path === '/api/friends' && req.method === 'GET') {
    const f = fentry(me);
    sendJson(res, 200, {
      friends: f.friends.map(friendBrief).sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0)),
      incoming: f.incoming.map((x) => ({ id: x.id, username: x.name })),
      outgoing: f.outgoing.map((x) => ({ id: x.id, username: x.name })),
    });
    return true;
  }
  if (path === '/api/friends/add' && req.method === 'POST') {
    const body = await readBody(req);
    const acct = await accountByName(String(body.username || ''));
    if (!acct) return (sendJson(res, 200, { error: 'no-account', message: 'No player with that username.' }), true);
    if (acct.id === me) return (sendJson(res, 200, { error: 'self', message: "You can't add yourself." }), true);
    if (isBlocked(me, acct.id)) return (sendJson(res, 200, { error: 'blocked', message: 'Unavailable.' }), true);
    const f = fentry(me), g = fentry(acct.id);
    if (hasId(f.friends, acct.id)) return (sendJson(res, 200, { error: 'already', message: 'Already friends.' }), true);
    if (hasId(f.incoming, acct.id)) { // they already asked you → accept
      f.incoming = f.incoming.filter((x) => x.id !== acct.id);
      g.outgoing = g.outgoing.filter((x) => x.id !== me);
      f.friends.push({ id: acct.id, name: acct.username }); g.friends.push({ id: me, name: myName });
      push.send(acct.id, 'friend', { title: 'New friend', body: myName + ' is now your friend', url: '/hub/#/friends', tag: 'fr-' + me });
      socialSave(); return (sendJson(res, 200, { ok: true, accepted: true }), true);
    }
    if (hasId(f.outgoing, acct.id)) return (sendJson(res, 200, { error: 'pending', message: 'Request already sent.' }), true);
    f.outgoing.push({ id: acct.id, name: acct.username }); g.incoming.push({ id: me, name: myName });
    push.send(acct.id, 'friend', { title: 'Friend request', body: myName + ' wants to be your friend', url: '/hub/#/friends', tag: 'fr-' + me });
    socialSave(); return (sendJson(res, 200, { ok: true, sent: true }), true);
  }
  if (path === '/api/friends/accept' && req.method === 'POST') {
    const body = await readBody(req); const oid = String(body.id || '');
    const f = fentry(me), g = fentry(oid);
    if (!hasId(f.incoming, oid)) return (sendJson(res, 200, { error: 'no-request' }), true);
    const name = (f.incoming.find((x) => x.id === oid) || {}).name || oid;
    f.incoming = f.incoming.filter((x) => x.id !== oid);
    g.outgoing = g.outgoing.filter((x) => x.id !== me);
    if (!hasId(f.friends, oid)) f.friends.push({ id: oid, name });
    if (!hasId(g.friends, me)) g.friends.push({ id: me, name: myName });
    push.send(oid, 'friend', { title: 'Request accepted', body: myName + ' accepted your friend request', url: '/hub/#/friends', tag: 'fr-' + me });
    socialSave(); return (sendJson(res, 200, { ok: true }), true);
  }
  if ((path === '/api/friends/decline' || path === '/api/friends/remove') && req.method === 'POST') {
    const body = await readBody(req); const oid = String(body.id || '');
    const f = fentry(me), g = fentry(oid);
    f.incoming = f.incoming.filter((x) => x.id !== oid);
    f.outgoing = f.outgoing.filter((x) => x.id !== oid);
    f.friends = f.friends.filter((x) => x.id !== oid);
    g.incoming = g.incoming.filter((x) => x.id !== me);
    g.outgoing = g.outgoing.filter((x) => x.id !== me);
    g.friends = g.friends.filter((x) => x.id !== me);
    socialSave(); return (sendJson(res, 200, { ok: true }), true);
  }
  if (path === '/api/social/blocked' && req.method === 'GET') {
    return (sendJson(res, 200, { blocked: blockList(me).map((x) => ({ id: x.id, username: x.name })) }), true);
  }
  if (path === '/api/social/block' && req.method === 'POST') {
    const body = await readBody(req);
    let tid = String(body.id || ''), tname = String(body.username || '');
    if (!tid && tname) { const acct = await accountByName(tname); if (acct) { tid = acct.id; tname = acct.username; } }
    if (!tid) return (sendJson(res, 200, { error: 'no-account', message: 'Could not find that player.' }), true);
    if (tid === me) return (sendJson(res, 200, { error: 'self' }), true);
    const bl = blockList(me);
    if (!bl.some((x) => x.id === tid)) bl.push({ id: tid, name: tname || tid });
    // Blocking also ends any friendship / pending requests both ways.
    const f = fentry(me), g = fentry(tid);
    f.friends = f.friends.filter((x) => x.id !== tid); f.incoming = f.incoming.filter((x) => x.id !== tid); f.outgoing = f.outgoing.filter((x) => x.id !== tid);
    g.friends = g.friends.filter((x) => x.id !== me); g.incoming = g.incoming.filter((x) => x.id !== me); g.outgoing = g.outgoing.filter((x) => x.id !== me);
    socialSave(); return (sendJson(res, 200, { ok: true }), true);
  }
  if (path === '/api/social/unblock' && req.method === 'POST') {
    const body = await readBody(req); const tid = String(body.id || '');
    blockedData[me] = blockList(me).filter((x) => x.id !== tid);
    socialSave(); return (sendJson(res, 200, { ok: true }), true);
  }
  if (path === '/api/social/report' && req.method === 'POST') {
    const body = await readBody(req);
    let tid = String(body.id || ''), tname = String(body.username || '');
    const reason = String(body.reason || '').slice(0, 500);
    if (!tid && tname) { const acct = await accountByName(tname); if (acct) { tid = acct.id; tname = acct.username; } }
    if (!tid) return (sendJson(res, 200, { error: 'no-account' }), true);
    reports.push({ id: 'r' + Date.now().toString(36), reporter: me, reporterName: myName, target: tid, targetName: tname || tid, reason, at: Date.now(), handled: false });
    if (reports.length > 300) reports.splice(0, reports.length - 300);
    staffAlert({ channel: 'reports', hook: true, text: '🚩 ' + myName + ' reported ' + (tname || tid) + ': ' + reason.slice(0, 300), push: true, title: 'New player report', body: myName + ' reported ' + (tname || tid), url: '/hub/#/admin/moderation' });
    socialSave(); return (sendJson(res, 200, { ok: true }), true);
  }

  // Unread-DM summary for the notification badges.
  if (path === '/api/dm/unread' && req.method === 'GET') {
    const f = fentry(me); const items = []; let total = 0;
    for (const fr of f.friends) {
      const count = unreadCount(me, fr.id);
      if (count > 0) {
        let cos = { color: '' }; try { cos = getCosmetics(fr.id); } catch (e) {}
        const color = (cos.color && !cos.color.startsWith('fx:')) ? cos.color : '';
        items.push({ id: fr.id, username: fr.name, count, color }); total += count;
      }
    }
    items.sort((a, b) => b.count - a.count);
    return (sendJson(res, 200, { total, items, requests: fentry(me).incoming.length }), true);
  }
  if (path === '/api/dm' && req.method === 'GET') {
    const withId = String(q.get('with') || '');
    if (!hasId(fentry(me).friends, withId)) return (sendJson(res, 200, { error: 'not-friends' }), true);
    const msgs = (dms[convKey(me, withId)] || []).slice(-120);
    markRead(me, convKey(me, withId)); socialSave(); // opening the thread clears its unread
    return (sendJson(res, 200, { messages: msgs, me }), true);
  }
  if (path === '/api/dm/send' && req.method === 'POST') {
    const body = await readBody(req);
    const to = String(body.to || ''); const content = String(body.content || '').trim().slice(0, 1000);
    if (!content) return (sendJson(res, 200, { error: 'empty' }), true);
    if (!hasId(fentry(me).friends, to)) return (sendJson(res, 200, { error: 'not-friends' }), true);
    if (isBlocked(me, to)) return (sendJson(res, 200, { error: 'blocked', message: 'You can\'t message this person.' }), true);
    const key = convKey(me, to);
    if (!dms[key]) dms[key] = [];
    const msg = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), from: me, content, at: Date.now() };
    dms[key].push(msg);
    if (dms[key].length > 500) dms[key] = dms[key].slice(-500);
    markRead(me, key); // sending means you've seen the thread
    push.send(to, 'dm', { title: myName, body: content.slice(0, 120), url: '/hub/#/friends', tag: 'fdm-' + me });
    socialSave(); return (sendJson(res, 200, { ok: true, message: msg }), true);
  }
  sendJson(res, 404, { error: 'unknown' }); return true;
}

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
  if (req._auth && req._auth.role) return true;                           // owner or mod account
  const cid = req._auth ? req._auth.id : c.sh_cid;
  return !!admin.chatOwners[cid];                          // a designated owner
}
function chatViewer(req) {
  const c = parseCookies(req);
  let nick, cid;
  if (req._auth) { cid = req._auth.id; nick = req._auth.username; }      // trusted login
  else {
    try { nick = c.sh_nick ? decodeURIComponent(c.sh_nick) : 'Guest'; } catch (e) { nick = 'Guest'; }
    cid = String(c.sh_cid || ('anon-' + clientIp(req))).slice(0, 64);
  }
  nick = cleanNick(String(nick).slice(0, 40)) || 'Guest';
  const owner = isChatOwner(req);
  // Casino cosmetics the player bought/equipped show up in chat.
  let cos = { tag: '', color: '' };
  try { cos = getCosmetics(cid); } catch (e) {}
  // The title/tag is a separate styled badge now (so it can animate on its own).
  const username = nick + (owner ? ' 👑' : '');
  // An equipped name color always wins; owners only default to gold if they
  // haven't picked one (so the owner glow no longer hides a chosen color).
  const color = cos.color || (owner ? 'hsl(45 90% 60%)' : colorFor(cid));
  return { id: cid, username, avatar: '', color, title: cos.tag || '', titleFx: cos.titleFx || '', rank: owner ? 'Owner' : '', owner };
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
  const senderIp = clientIp(req);
  if (muted[senderIp] && (muted[senderIp].until === 0 || muted[senderIp].until > Date.now())) {
    return sendJson(res, 403, { error: 'You are muted from chat.' });
  }
  if (wordFilter.length) {
    const cl = content.toLowerCase();
    if (wordFilter.some(w => cl.includes(w))) return sendJson(res, 400, { error: 'Message contains blocked content.' });
  }
  const slow = slowMode[ch] || 0;
  if (slow > 0) {
    const last = lastMsgTime.get(v.id) || 0;
    if (Date.now() - last < slow * 1000) return sendJson(res, 429, { error: `Slow mode: wait ${slow}s between messages.` });
  }
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
  if (slowMode[ch]) lastMsgTime.set(v.id, Date.now());
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
  const members = online.map((p) => {
    let cos = { tag: '', color: '', titleFx: '' }; try { cos = getCosmetics(p.id); } catch (e) {}
    const owner = !!admin.chatOwners[p.id];
    return { id: p.id, username: p.nickname + (owner ? ' 👑' : ''), avatar: '', color: cos.color || (owner ? 'hsl(45 90% 60%)' : colorFor(p.id)), title: cos.tag || '', titleFx: cos.titleFx || '', status: 'online' };
  });
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
  // Unlocked achievements become badges on the profile card.
  let badges = [];
  try {
    const ach = buildAchievements(id, { chatMsgs: chatMsgCount.get(id) || 0 });
    badges = ach.achievements.filter((a) => a.unlocked).map((a) => ({ name: a.name, icon: a.icon, color: a.color, rarity: a.rarity }));
  } catch (e) {}
  return sendJson(res, 200, {
    id,
    username: nick + (owner ? ' 👑' : ''),
    name: nick, // clean handle for linking to the full profile page
    title: cos.tag || '', titleFx: cos.titleFx || '',
    avatar: '', color: cos.color || (owner ? 'hsl(45 90% 60%)' : colorFor(id)),
    banner: cos.banner || '', avatarFx: cos.avatarFx || '',
    badges, achCount: badges.length,
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
    .map((p) => { let cos = { color: '' }; try { cos = getCosmetics(p.id); } catch (e) {} return { id: p.id, username: p.nickname, avatar: '', color: cos.color || colorFor(p.id) }; });
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

const siteops = createSiteOps({ staffAlert, admin, saveState, resolveSession, sendJson, readBody, clientIp, audit, logEvent, durable: kvEnabled, onlineCount: () => { const now = Date.now(); let n = 0; for (const p of players.values()) if (now - p.lastSeen < PLAYER_TTL) n++; return n; } });

const httpServer = createServer(async (req, res) => {
 try {
  const parsed = new URL(req.url || '/', 'http://localhost');
  const url = parsed.pathname;
  { const sk = req.socket, b0 = sk ? sk.bytesWritten : 0; res.once('close', () => { try { addTraffic(url, (sk ? sk.bytesWritten : 0) - b0, res._trafficCat); } catch {} }); }

  // Cross-origin data access: a ScrollHub frontend hosted on ANY domain can
  // call this central backend's data + file routes. Auth travels in a header
  // token (not a cookie), so Allow-Origin:* is safe here.
  if (/^\/(api|dcf|ci)\//.test(url) || url === '/api/version') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-sh-token');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  }

  // Rate limits (sign-up, sign-in, chat, reports, applications) and the sitewide news, status and applications routes.
  if (url.startsWith('/api/') && siteops.guard(req, res, url)) return;
  if (url.startsWith('/api/push/')) { try { req._auth = await resolveSession(req); } catch (e) { req._auth = null; } if (await push.handle(url, req, res)) return; }
  if (url === '/api/news' || url === '/api/status' || url === '/api/client-error' || url === '/api/apply') { if (await siteops.handle(url, req, res)) return; }

  // Auth endpoints (signup/login/logout/me).
  if (url.startsWith('/api/auth/')) { if (await handleAuth(url, req, res)) return; }
  // Resolve the trusted session once for identity-bearing routes so chat/casino
  // can read it synchronously (and can't be spoofed via client-set cookies).
  if (url.startsWith('/api/casino/') || url.startsWith('/api/arcade/') || url.startsWith('/api/chat/') || url === '/api/presence' || url === '/api/achievements' || url.startsWith('/api/friends') || url.startsWith('/api/dm') || url.startsWith('/api/social')) {
    try { req._auth = await resolveSession(req); } catch (e) { req._auth = null; }
    if (req.method === 'POST' && req._auth && url.startsWith('/api/casino/')) worldTouch(req._auth.id);
  }
  if (url.startsWith('/api/casino/') && req.method === 'POST' && admin.settings.gamesOff && admin.settings.gamesOff.casino && !(req._auth && req._auth.role)) return sendJson(res, 200, { error: 'off', message: 'The casino is switched off right now.' });
  if (url.startsWith('/api/friends') || url.startsWith('/api/dm') || url.startsWith('/api/social')) { if (await handleSocial(url, req, res)) return; }
  // Games hub (/arcade): who's playing + your Bedwars stats.
  // Games hub nickname box: no account needed — gives this browser a guest identity with the chosen name.
  if (url.split('?')[0] === '/api/poll/vote' && req.method === 'POST') {
    const body = await readBody(req); let w = null; try { w = await resolveSession(req); } catch (e) {}
    const voter = w ? w.id : (parseCookies(req).sh_cid || '');
    const poll = admin.settings.live && admin.settings.live.poll, i = Math.floor(Number(body.i));
    if (!voter) return sendJson(res, 400, { error: 'Open the site once more, then vote.' });
    if (!poll || poll.id !== String(body.id) || (poll.endAt && poll.endAt < Date.now())) return sendJson(res, 200, { error: 'This poll has ended.' });
    if (!(i >= 0 && i < poll.opts.length)) return sendJson(res, 400, { error: 'bad choice' });
    poll.votes[voter] = i; saveState().catch(() => {});
    return sendJson(res, 200, { ok: true, live: liveState(voter) });
  }
  if (url.split('?')[0] === '/api/quests') {
    let who = null; try { who = await resolveSession(req); } catch (e) {}
    if (!who) return sendJson(res, 200, { ok: true, guest: true });
    if (req.method === 'POST') { const b = await readBody(req); const r = questClaim(who.id, String(b.id || '')); return sendJson(res, 200, r.err ? { error: 'bad', message: r.err, view: questsView(who.id) } : r); }
    return sendJson(res, 200, { ok: true, view: questsView(who.id) });
  }
  if (url.split('?')[0] === '/api/feedback') {
    let who = null; try { who = await resolveSession(req); } catch (e) {}
    if (req.method === 'POST') {
      if (!who) return sendJson(res, 401, { error: 'login', message: 'Sign in to answer.' });
      const b = await readBody(req); const r = surveySubmit(who.id, who.username, b.a);
      return sendJson(res, 200, r.err ? { error: 'bad', message: r.err } : r);
    }
    return sendJson(res, 200, { ok: true, signedIn: !!who, ...surveyState(who && who.id) });
  }
  if (url.split('?')[0] === '/api/hall' && req.method === 'POST') {
    let who = null; try { who = await resolveSession(req); } catch (e) {}
    if (!who) return sendJson(res, 401, { error: 'login', message: 'Sign in to like creations.' });
    const b = await readBody(req), key = String(b.key || '');
    if (/^s:/.test(key) ? !hallSprites().some((x) => 's:' + x.id === key) : !hallMapSubs().some((x) => 'm:' + x.mapId === key)) return sendJson(res, 200, { error: 'gone' });
    const r = likeToggle(key, who.id); if (r.liked) questEvent(who.id, 'like', key); return sendJson(res, 200, r.err ? { error: 'bad' } : r);
  }
  if (url.split('?')[0] === '/api/hall' && req.method === 'GET') {
    let who = null; try { who = await resolveSession(req); } catch (e) {}
    const vid = who && who.id; if (vid) questEvent(vid, 'hall');
    const sprites = hallSprites().map((x) => ({ ...x, likes: likeCount('s:' + x.id), liked: likedBy('s:' + x.id, vid) }));
    const maps = hallMapSubs().map((x) => { const m = GMS.getMap(x.mapId); return m && m.ok ? { id: m.id, name: m.name, game: m.game, desc: m.desc || '', by: x.by, at: x.at, walls: (m.w || []).length, props: (m.props || []).length, likes: likeCount('m:' + m.id), liked: likedBy('m:' + m.id, vid) } : null; }).filter(Boolean);
    const mk = {};
    const add = (by, likes) => { const k = String(by).toLowerCase(); const o = mk[k] || (mk[k] = { name: by, items: 0, likes: 0 }); o.items++; o.likes += likes; };
    sprites.forEach((x) => add(x.by, x.likes)); maps.forEach((x) => add(x.by, x.likes));
    const makers = Object.values(mk).sort((a, b) => b.items - a.items || b.likes - a.likes).slice(0, 25);
    return sendJson(res, 200, { ok: true, sprites: sprites.slice(0, 200), maps: maps.slice(0, 100), makers, me: !!who });
  }
  if (url.split('?')[0] === '/api/school') {
    let who = null; try { who = await resolveSession(req); } catch (e) {}
    const exempt = String((who && who.username) || '').toLowerCase() === 'scrollreader11';
    return sendJson(res, 200, { on: !!admin.settings.schoolMode, exempt, teacher: isTeacherReq(req), gamble: !!admin.settings.schoolGamble, home: schoolHome(), theme: admin.settings.theme || null, brand: admin.settings.brand || null, season: globalThis.SH_SEASON ? SH_SEASON() : '', party: globalThis.SH_PARTY && globalThis.SH_PARTY.until > Date.now() ? globalThis.SH_PARTY : null, off: Object.keys(admin.settings.gamesOff || {}), live: liveState(who ? (who.id || '') : (parseCookies(req).sh_cid || '')), subs: who && who.role === 'owner' ? { n: subPending(), last: (subLatest() || {}).id || '' } : null });
  }
  if (url.split('?')[0] === '/api/arcade/nick' && req.method === 'POST') {
    const body = await readBody(req);
    let nick = String(body.nick || '').replace(/[^\w .-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    if (nick.length < 2) return sendJson(res, 400, { error: 'Pick a nickname with at least 2 letters.' });
    if (nick.toLowerCase().replace(/[^a-z0-9]/g, '') === 'scrollreader11') return sendJson(res, 400, { error: 'That name is taken — pick another.' });
    const clean = cleanNick(nick); if (clean !== nick) return sendJson(res, 400, { error: 'Pick a different nickname.' });
    if (globalThis.SH_NAME_BANNED && globalThis.SH_NAME_BANNED(nick)) return sendJson(res, 400, { error: 'That name isn’t allowed — pick another.' });
    const ck = parseCookies(req);
    const cid = /^g-[a-z0-9]{10,}$/.test(ck.sh_cid || '') ? ck.sh_cid : 'g-' + randomBytes(8).toString('hex');
    const secure = String(req.headers['x-forwarded-proto'] || '').startsWith('https') ? ';Secure' : '';
    res.writeHead(200, { 'Content-Type': 'application/json', 'cache-control': 'no-store', 'Set-Cookie': ['sh_cid=' + cid + ';Path=/;Max-Age=15552000;SameSite=Lax' + secure, 'sh_nick=' + encodeURIComponent(nick) + ';Path=/;Max-Age=15552000;SameSite=Lax' + secure] });
    return res.end(JSON.stringify({ ok: true, nick }));
  }
  if (url.split('?')[0] === '/api/arcade/info') {
    const id = worldIdentity(req);
    return sendJson(res, 200, { online: bwOnline(), casino: worldOnline(), me: id.cid ? { nick: id.nick, bw: bwStats(id.cid) } : null });
  }

  // Teacher link: /teacher/<key> marks this browser as the teacher (class tools in the games hub).
  if (url === '/teacher/leave' || url === '/teacher/leave/') { res.writeHead(302, { Location: '/arcade', 'cache-control': 'no-store', 'Set-Cookie': 'sh_teacher=;Path=/;Max-Age=0;SameSite=Lax;HttpOnly' }); res.end(); return; }
  if (url.startsWith('/teacher/')) {
    const key = decodeURIComponent(url.split('?')[0].slice(9)).replace(/\/+$/, '');
    const good = key && key === teacherKey();
    const secure = String(req.headers['x-forwarded-proto'] || '').startsWith('https') ? ';Secure' : '';
    res.writeHead(302, { Location: good ? '/arcade?teacher=1' : '/arcade', 'cache-control': 'no-store', ...(good ? { 'Set-Cookie': 'sh_teacher=' + encodeURIComponent(key) + ';Path=/;Max-Age=15552000;SameSite=Lax;HttpOnly' + secure } : {}) });
    res.end(); return;
  }
  // School mode: everyone (except the owner) only gets the games hub.
  if (admin.settings.schoolMode && req.method === 'GET' && schoolBlocked(url, req)) {
    let who = null; try { who = await resolveSession(req); } catch (e) {}
    const name = who && (who.username || (who.account && who.account.username) || who.name);
    if (String(name || '').toLowerCase() !== 'scrollreader11') { res.writeHead(302, { Location: schoolHome(), 'cache-control': 'no-store' }); res.end(); return; }
  }
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
  if ((url.split('?')[0] === '/' || url.split('?')[0] === '/index.html')) {
    res.setHeader('Cache-Control', 'no-cache');
    req.url = '/hub/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url === '/admin' || url === '/admin/') { res.writeHead(302, { Location: '/#/admin', 'cache-control': 'no-store' }); res.end(); return; }
  if (url === '/hub' || url === '/hub/') {
    req.url = '/hub/index.html' + (parsed.search || '');
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url === '/arcade' || url === '/arcade/' || url === '/play' || url === '/play/') {
    req.url = '/arcade/bedwars/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url === '/arcade/sprites' || url === '/arcade/sprites/' || url.startsWith('/arcade/sprites?')) {
    req.url = '/arcade/sprites.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url === '/arcade/builder' || url === '/arcade/builder/' || url.startsWith('/arcade/builder?')) {
    req.url = '/arcade/bedwars/builder.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url === '/arcade/bedwars' || url === '/arcade/bedwars/' || url === '/bedwars' || url === '/bedwars/') {
    req.url = '/arcade/bedwars/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }
  if (url === '/social' || url === '/social/') {
    req.url = '/social.html';
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
  if (url === '/api/kvtest') {
    // Self-test: confirms durable storage (Upstash) is connected by doing a
    // live write + read round-trip.
    const out = { configured: kvEnabled };
    if (kvEnabled) {
      try {
        const v = 'ok-' + Date.now();
        await kvSet('sh:selftest', v);
        const back = await kvGet('sh:selftest');
        out.roundtrip = back === v;
        out.durable = out.roundtrip;
      } catch (e) { out.error = String((e && e.message) || e).slice(0, 200); out.durable = false; }
    } else { out.durable = false; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(out));
    return;
  }
  // ---- Hub launcher: versions + update pushes ----
  if (url.split('?')[0] === '/api/hub/manifest') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify(hubManifest()));
  }
  if (url.split('?')[0] === '/api/hub/publish' && req.method === 'POST') {
    let who = null; try { who = await resolveSession(req); } catch (e) {}
    if (!who || String(who.username || '').toLowerCase() !== 'scrollreader11') return sendJson(res, 403, { error: 'owner-only', message: 'Only the owner can publish updates.' });
    const body = await readBody(req);
    const id = String(body.id || '').slice(0, 200);
    if (!/^[a-z0-9][a-z0-9._\-]*$/i.test(id)) return sendJson(res, 400, { error: 'bad-id', message: 'Unknown game.' });
    const hv = hubVersions(); const cur = hv[id] || { v: '1.0.0', hist: [] };
    let v = String(body.version || '').trim();
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(v)) { const p = String(cur.v || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0); v = p[0] + '.' + p[1] + '.' + (p[2] + 1); }
    const notes = String(body.notes || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 600);
    const title = String(body.title || cur.title || id).slice(0, 80);
    const ts = Date.now();
    hv[id] = { v, notes, ts, title, hist: [{ v, notes, ts }, ...(cur.hist || [])].slice(0, 10) };
    if (Object.keys(hv).length > 400) { const keep = Object.entries(hv).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).slice(0, 400); admin.settings.hubVersions = Object.fromEntries(keep); }
    logEvent('admin', 'admin', 'Hub update pushed: ' + title + ' v' + v);
    try { await saveState(); } catch (e) {}
    return sendJson(res, 200, { ok: true, id, v, ts });
  }
  if (url.split('?')[0] === '/api/hub/feedback') {
    let who = null; try { who = await resolveSession(req); } catch (e) {}
    const isOwner = !!who && String(who.username || '').toLowerCase() === 'scrollreader11';
    if (!Array.isArray(admin.settings.hubFeedback)) admin.settings.hubFeedback = [];
    if (req.method === 'GET') { if (!isOwner) return sendJson(res, 403, { error: 'owner-only' }); return sendJson(res, 200, { items: admin.settings.hubFeedback.slice(0, 100) }); }
    if (req.method === 'POST') {
      const body = await readBody(req); const text = String(body.text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 600);
      if (text.length < 4) return sendJson(res, 400, { error: 'short', message: 'Write a little more first.' });
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim(); const now = Date.now();
      globalThis.__hubFbRate = globalThis.__hubFbRate || new Map(); const last = globalThis.__hubFbRate.get(ip) || 0;
      if (now - last < 20000) return sendJson(res, 429, { error: 'slow', message: 'Please wait a moment before sending more.' });
      globalThis.__hubFbRate.set(ip, now); if (globalThis.__hubFbRate.size > 2000) globalThis.__hubFbRate.clear();
      const ck = parseCookies(req); let from = who ? who.username : 'Guest'; if (!who && ck.sh_nick) { try { from = decodeURIComponent(ck.sh_nick).slice(0, 24); } catch (e) {} }
      const kind = ['idea', 'bug', 'other'].includes(body.kind) ? body.kind : 'other';
      admin.settings.hubFeedback.unshift({ ts: now, from, kind, text }); admin.settings.hubFeedback = admin.settings.hubFeedback.slice(0, 200);
      if (kind === 'bug') staffAlert({ channel: 'reports', text: '🐞 Problem report from ' + from + ': ' + text.slice(0, 300), push: false });
      try { await saveState(); } catch (e) {} return sendJson(res, 200, { ok: true });
    }
  }
  if (url === '/api/games/catalog') {
    // Built-in, always-present ScrollHub original.
    const builtins = [{
      id: 'scrollhub-draw-guess', label: 'Draw & Guess (Multiplayer)', url: '/skribbl',
      imageUrl: '/storage/images/main/googleforms.jpg', categories: ['Multiplayer', 'ScrollHub Originals'], isGlobal: true,
    }, {
      id: 'scrollhub-casino', label: 'Scrolls Casino', url: '/casino',
      imageUrl: '/casino/cover.png', categories: ['Casino', 'ScrollHub Originals'], isGlobal: true,
    }, {
      id: 'scrollhub-bedwars', label: 'Bedwars 2D (Multiplayer)', url: '/arcade/bedwars',
      imageUrl: '/arcade/bedwars/cover.png', categories: ['Multiplayer', 'ScrollHub Originals'], isGlobal: true,
    }];
    const customIds = new Set(admin.customGames.map((g) => g.id));
    const globals = [...builtins.filter((b) => !customIds.has(b.id)), ...admin.customGames];
    res.writeHead(200, { 'Content-Type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ globals, exclusions: [], overrides: [] }));
    return;
  }

  // No real account system — return a guest so the account/settings page
  // opens (and the appearance/wallpaper picker is reachable) without a login.
  // Public profile card for a username (shareable /user/:username page).
  if (url.startsWith('/api/user/')) {
    const uname = decodeURIComponent(url.slice(10).split('/')[0].split('?')[0]);
    const acct = await accountByName(uname);
    if (!acct) return sendJson(res, 404, { error: 'not-found' });
    const card = publicUserCard(acct.id);
    const owner = !!admin.chatOwners[acct.id];
    const ach = buildAchievements(acct.id, { chatMsgs: chatMsgCount.get(acct.id) || 0 });
    const badges = ach.achievements.filter((a) => a.unlocked).map((a) => ({ name: a.name, icon: a.icon, color: a.color, rarity: a.rarity }));
    const p = players.get(acct.id);
    const online = !!(p && (Date.now() - p.lastSeen < PLAYER_TTL));
    const pmeta = getProfileMeta(acct.id);
    return sendJson(res, 200, {
      username: acct.username, id: acct.id, owner, avatar: pmeta.avatar_url || '', banner: pmeta.banner_url || '', createdAt: acct.createdAt || 0,
      online, activity: online ? (p.activity || '') : '',
      rank: coinRank(acct.id),
      coins: card ? card.coins : 0, weekNet: card ? card.weekNet : 0,
      stats: card ? card.stats : {}, cosmetics: card ? card.cosmetics : {},
      badges, achCount: badges.length, achTotal: ach.total,
    });
  }

  if (url.split('?')[0] === '/api/me/avatar' && (req.method === 'POST' || req.method === 'DELETE')) return handleProfileImageUpload(req, res, 'avatar');
  if (url.split('?')[0] === '/api/me/banner' && (req.method === 'POST' || req.method === 'DELETE')) return handleProfileImageUpload(req, res, 'banner');
  if (url === '/api/me') {
    const a = await resolveSession(req);
    const c = parseCookies(req);
    const cid = a ? a.id : String(c.sh_cid || '').slice(0, 64);
    const nick = a ? a.username : cleanNick(String((() => { try { return c.sh_nick ? decodeURIComponent(c.sh_nick) : ''; } catch (e) { return ''; } })()).slice(0, 40));
    // Persist profile edits (color / public toggle) for logged-in users.
    if (req.method === 'POST' && a) {
      try { const b = await readBody(req); setProfileMeta(a.id, { profile_color: b.profile_color, profile_public: b.profile_public }); } catch (e) {}
    }
    const meta = a ? getProfileMeta(a.id) : { avatar_url: '', banner_url: '', profile_color: '', profile_public: true };
    return sendJson(res, 200, { user: { id: cid || 0, username: nick || 'Guest', email: '', is_admin: 0, is_owner: false, guest: !a, avatar_url: meta.avatar_url, banner_url: meta.banner_url, profile_color: meta.profile_color, profile_public: meta.profile_public } });
  }
  if (url.split('?')[0] === '/api/achievements') {
    const a = req._auth || await resolveSession(req);
    const c = parseCookies(req);
    const cid = a ? a.id : String(c.sh_cid || '').slice(0, 64);
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
  if (url === '/api/admin' && req.method === 'POST') { const who = await resolveSession(req).catch(() => null); return handleAdmin(req, res, await readBody(req), who); }
  if (url === '/api/staff/me') { const who = await resolveSession(req).catch(() => null); return sendJson(res, 200, { role: who ? who.role : null, username: who ? who.username : '' }); }
  if (url === '/api/staff/act' && req.method === 'POST') return handleStaff(req, res);
  if ((url === '/api/racing/start' || url === '/api/racing/finish') && req.method === 'POST') return handleRacing(req, res, url);
  if (url === '/api/admin/gameimg' && req.method === 'POST') return handleGameImg(req, res);
  if (url.startsWith('/ci/')) return serveGameImg(req, res, url);
  // Which commit is live (Render sets RENDER_GIT_COMMIT). Open /api/version to check a deploy.
  if (url === '/api/version') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ commit: (process.env.RENDER_GIT_COMMIT || 'unknown').slice(0, 7), startedAt: new Date(SERVER_STARTED).toISOString() }));
    return;
  }

  // ScrollHub Servers (Discord-style): data API + uploaded files.
  // Relay servers for voice/video calls (index.html hands these to every RTCPeerConnection).
  if (url === '/api/ice') { const ic = await iceServers(); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ iceServers: ic.list, source: ic.source })); return; }
  if (url === '/calltest' || url === '/calltest/') { req.url = '/calltest.html'; return serve(req, res, () => { res.writeHead(404); res.end('Not found'); }); }
  if (url.startsWith('/api/dc/')) return handleDiscord(url, req, res);
  if (url.startsWith('/dcf/')) return serveDiscordFile(req, res, url.split('?')[0]);

  // CDN proxy — lets gadget.html rewrite game asset URLs so they load
  // through the server instead of directly from jsDelivr (which school
  // networks typically block).  Only CDN domains are allowed.
  if (url.startsWith('/cdn-proxy/')) {
    const raw = url.slice('/cdn-proxy/'.length);
    // Reconstruct full URL — raw is e.g. "cdn.jsdelivr.net/gh/..."
    const targetUrl = 'https://' + raw + (parsed.search || '');
    let targetHost = '';
    try { targetHost = new URL(targetUrl).hostname; } catch (e) {}
    const CDN_ALLOWLIST = ['cdn.jsdelivr.net', 'raw.githubusercontent.com', 'unpkg.com', 'cdnjs.cloudflare.com'];
    if (!CDN_ALLOWLIST.includes(targetHost)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('CDN host not allowed');
      return;
    }
    try {
      const ac = new AbortController();
      const to = setTimeout(() => { try { ac.abort(); } catch (e) {} }, 30000);
      let upstream;
      try {
        upstream = await fetch(targetUrl, {
          headers: { 'user-agent': 'Mozilla/5.0', 'accept': req.headers['accept'] || '*/*' },
          signal: ac.signal,
        });
      } finally { clearTimeout(to); }
      let ct = upstream.headers.get('content-type') || 'application/octet-stream';
      // Some CDNs (e.g. jsDelivr) serve .html files with text/plain; fix that.
      if ((ct.includes('text/plain') || ct === 'application/octet-stream') && raw.match(/\.html?(\?|$)/i)) {
        ct = 'text/html; charset=utf-8';
      }
      // ⚠️  Do NOT forward Content-Length from the CDN.
      // Node's fetch() decompresses gzip/br transparently, so the actual body
      // bytes we stream to the client are larger than the compressed
      // content-length the CDN sent. Forwarding that value causes browsers to
      // stop reading after content-length bytes and treat the truncated JS as
      // complete, producing "SyntaxError: Unexpected end of input".
      const headers = {
        'Content-Type': ct,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      };
      res.writeHead(upstream.status, headers);
      if (!upstream.body) { res.end(); return; }
      const reader = upstream.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(Buffer.from(value));
        return pump();
      };
      await pump();
    } catch (e) {
      if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('CDN proxy error: ' + (e && e.message)); }
      else res.end();
    }
    return;
  }

  // Other unknown API routes 404.
  if (url.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end('{"error":"not found"}');
    return;
  }

  serve(req, res, () => {
    if (looksLikeFile(url)) return proxyUpstream(req, res);
    req.url = '/hub/index.html';
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
  try { trackSocket((req.url || '').split('?')[0] || '/', socket); } catch {}
  // Skribbl draw & guess has its own WebSocket channel.
  if ((req.url || '').split('?')[0] === '/skribbl-ws') return handleSkribblUpgrade(req, socket, head);
  // 2D casino world: resolve the logged-in session first (cookie), then join.
  if ((req.url || '').split('?')[0] === '/world-ws') {
    resolveSession(req).then((a) => { req._auth = a; }, () => { req._auth = null; }).then(() => { if (admin.settings.gamesOff && admin.settings.gamesOff.casino && !(req._auth && req._auth.role)) { try { socket.destroy(); } catch (e) {} return; } handleWorldUpgrade(req, socket, head); });
    return;
  }
  // Bedwars 2D (Games section): same login resolution as the casino world.
  if ((req.url || '').split('?')[0] === '/bw-ws') {
    resolveSession(req).then((a) => { req._auth = a; }, () => { req._auth = null; }).then(() => handleBedwarsUpgrade(req, socket, head));
    return;
  }
  // Casino case battles have theirs.
  if ((req.url || '').split('?')[0] === '/battle-ws') return handleBattleUpgrade(req, socket, head);
  // ScrollHub Servers: live messages + voice signaling.
  if ((req.url || '').split('?')[0] === '/dc-ws') return handleDiscordUpgrade(req, socket, head);
  wisp.routeRequest(req, socket, head);
 } catch (err) { try { console.error('upgrade error:', err && err.message); socket.destroy(); } catch (e) {} }
});
httpServer.on('clientError', (err, socket) => { try { socket.destroy(); } catch (e) {} });

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
  banner(PORT);
  console.log(`Scroll Unblocker running on port ${PORT}`);
  console.log(kvEnabled ? 'Durable storage: Upstash Redis (ON)' : 'Durable storage: OFF (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)');
});
// Best-effort final flush so the last messages aren't lost on shutdown.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => { try { await kvFlush(); } catch {} process.exit(0); });
}


// Startup banner for the server console (colour only when the terminal supports it).
function banner(port) {
  const tty = process.stdout.isTTY && !process.env.NO_COLOR, c = (n, t) => (tty ? `\x1b[${n}m${t}\x1b[0m` : t);
  const art = [
    ' ____   ____ ____   ___  _     _     _   _ _   _ ____  ',
    '/ ___| / ___|  _ \\ / _ \\| |   | |   | | | | | | | __ ) ',
    '\\___ \\| |   | |_) | | | | |   | |   | |_| | | | |  _ \\ ',
    ' ___) | |___|  _ <| |_| | |___| |___|  _  | |_| | |_) |',
    '|____/ \\____|_| \\_\\\\___/|_____|_____|_| |_|\\___/|____/ ',
  ];
  const cols = [96, 96, 36, 34, 94];
  console.log('');
  art.forEach((l, i) => console.log('  ' + c(cols[i], l)));
  console.log('  ' + c(90, '-----------------------------------------------------'));
  console.log('  ' + c(93, '*') + ' ' + c(97, 'arcade online') + c(90, '  |  ') + c(92, 'port ' + port) + c(90, '  |  ') + c(95, 'have fun, play fair') + ' ' + c(93, '*'));
  console.log('');
}
