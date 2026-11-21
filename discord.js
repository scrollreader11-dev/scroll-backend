// ============================================================
// ScrollHub "Servers" — a Discord-style layer that lives ALONGSIDE the
// existing global chat. Any logged-in user can create servers (guilds) with
// text + voice channels, DM other users, and share images/files.
//
// - REST under /api/dc/* for data (create/join, channels, messages, upload).
// - A WebSocket at /dc-ws for live message push AND WebRTC voice signaling.
// - State is kept in memory and mirrored to Upstash (sh:discord) like chat.
// ============================================================
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { resolveSession, accountByName, sessionFromToken, roleForName } from './auth.js';

let getCosmetics = () => ({ color: '', tag: '' });
let kvGet = async () => null;
let kvSet = async () => {};

// ---- state ----
const dc = {
  guilds: {},        // gid -> {id,name,icon,ownerId,createdAt,channels:[{id,name,type}],memberIds:[],invites:{code:{by,ts}}}
  messages: {},      // channelId (or dm id) -> [msg]
  rev: {},           // channelId -> number
  channelIndex: {},  // channelId -> {guildId,type}
  dms: {},           // dmId -> {id,userIds:[a,b],ts}
  userGuilds: {},    // uid -> [gid]
  files: {},         // fileId -> {ct,b64}  (small; mirrored to KV too)
  settings: { defaultGuild: '' }, // staff-chosen server every account joins
};

let _dirty = false;
function markDirty() { _dirty = true; }
async function flush() {
  if (!_dirty) return;
  _dirty = false;
  try {
    const trimmed = {};
    for (const k in dc.messages) trimmed[k] = (dc.messages[k] || []).slice(-400);
    await kvSet('sh:discord', JSON.stringify({
      guilds: dc.guilds, messages: trimmed, rev: dc.rev,
      channelIndex: dc.channelIndex, dms: dc.dms, userGuilds: dc.userGuilds, settings: dc.settings,
    }));
  } catch (e) { _dirty = true; }
}

export async function initDiscord(deps) {
  getCosmetics = deps.getCosmetics || getCosmetics;
  kvGet = deps.kvGet || kvGet;
  kvSet = deps.kvSet || kvSet;
  try {
    const raw = await kvGet('sh:discord');
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(dc, {
        guilds: s.guilds || {}, messages: s.messages || {}, rev: s.rev || {},
        channelIndex: s.channelIndex || {}, dms: s.dms || {}, userGuilds: s.userGuilds || {}, settings: s.settings || { defaultGuild: '' },
        files: {},
      });
    }
  } catch (e) { console.log('discord load failed:', e.message); }
  ensureGlobal();
  ensureVoiceChannels();
  setInterval(flush, 12000);
}
// Every server should have somewhere to talk. Servers that lost (or never had) a voice channel get one.
function ensureVoiceChannels() {
  let changed = false;
  for (const g of Object.values(dc.guilds)) {
    if (g.channels.some((c) => c.type === 'voice')) continue;
    const cid = g.id + '_voice_' + rid(4);
    g.channels.push({ id: cid, name: 'voice', type: 'voice' });
    dc.channelIndex[cid] = { guildId: g.id, type: 'voice' }; dc.messages[cid] = []; dc.rev[cid] = 0;
    changed = true;
  }
  if (changed) markDirty();
}
// A built-in server every account joins, so the Discord is never empty.
const GLOBAL_ID = 'g_global';
function ensureGlobal() {
  let g = dc.guilds[GLOBAL_ID];
  if (!g) {
    g = { id: GLOBAL_ID, name: 'ScrollHub', icon: 'S', ownerId: 'system', createdAt: Date.now(), channels: [], memberIds: [], invites: {}, names: { system: 'ScrollHub' } };
    const mk = (nm, type, topic) => { const cid = GLOBAL_ID + '_' + slug(nm); g.channels.push({ id: cid, name: slug(nm), type, topic: topic || '' }); dc.channelIndex[cid] = { guildId: GLOBAL_ID, type }; if (type === 'text') { dc.messages[cid] = dc.messages[cid] || []; dc.rev[cid] = dc.rev[cid] || 1; } };
    mk('welcome', 'text', 'Start here. Be kind and have fun.'); mk('general', 'text', 'Chat about anything.'); mk('games', 'text', 'Talk about games, tips and scores.'); mk('scroll-racing', 'text', 'Racing lobbies and lap times.'); mk('looking-for-group', 'text', 'Find people to play with.'); mk('Lounge', 'voice'); mk('Game night', 'voice');
    dc.guilds[GLOBAL_ID] = g;
    dc.messages[GLOBAL_ID + '_welcome'].push({ id: rid(14), uid: 'system', name: 'ScrollHub', color: '', title: '', titleFx: '', avatarFx: '', avatar: '', role: 'owner', content: 'Welcome to the ScrollHub Discord. Make your own server with the plus button, or hop into a voice channel to talk while you play.', attachments: [], ts: Date.now(), edited: false });
    markDirty();
  }
  return g;
}
// The server every account joins. Staff can pick it; until then, a server named like "ScrollHub Official" is used.
function defaultGuild() {
  const id = dc.settings && dc.settings.defaultGuild;
  if (id && dc.guilds[id]) return dc.guilds[id];
  const norm = (n) => String(n || '').toLowerCase().replace(/[^a-z]/g, '');
  const hit = Object.values(dc.guilds).filter((g) => g.id !== GLOBAL_ID && /^scrollhuboff[a-z]{0,6}$/.test(norm(g.name)));
  return hit.sort((a, b) => b.memberIds.length - a.memberIds.length)[0] || null;
}
function autoJoin(g, me) {
  if (!g || (g.left && g.left.includes(me.id))) return;
  if (!g.memberIds.includes(me.id)) { addMember(g, me.id); (g.names = g.names || {})[me.id] = me.username; }
}
export function discordGuildList() { const d = defaultGuild(); return { guilds: Object.values(dc.guilds).map((g) => ({ id: g.id, name: g.name, members: g.memberIds.length, builtin: g.id === GLOBAL_ID })), defaultId: d ? d.id : '' }; }
export function discordSetDefault(gid, everyone) {
  const g = dc.guilds[gid]; if (!g) return { error: 'no-such-server' };
  dc.settings.defaultGuild = gid; let added = 0;
  if (Array.isArray(everyone)) for (const a of everyone) { if (!g.memberIds.includes(a.id) && !(g.left && g.left.includes(a.id))) { addMember(g, a.id); (g.names = g.names || {})[a.id] = a.username; added++; } }
  markDirty(); return { ok: true, added, name: g.name };
}

// ---- Staff monitor: read-only view over every channel (DMs are owner-only) ----
function monMsg(m, cid) { return { id: m.id, channel: cid, uid: m.uid, name: m.name, role: m.role || null, content: String(m.content || '').slice(0, 2000), ts: m.ts, attachments: (m.attachments || []).map((a) => a.url), edited: !!m.edited }; }
function monChannelLabel(cid) {
  if (cid.startsWith('dm:')) { const d = dc.dms[cid]; return d ? 'DM: ' + Object.values(d.otherName || {}).join(' and ') : 'DM'; }
  const ix = dc.channelIndex[cid]; const g = ix && dc.guilds[ix.guildId]; const c = g && g.channels.find((x) => x.id === cid);
  return g && c ? g.name + ' / ' + c.name : cid;
}
export function monChannels(owner) {
  const guilds = Object.values(dc.guilds).map((g) => ({ id: g.id, name: g.name, members: g.memberIds.length, channels: g.channels.filter((c) => c.type === 'text').map((c) => { const a = dc.messages[c.id] || []; return { id: c.id, name: c.name, count: a.length, last: a.length ? a[a.length - 1].ts : 0, locked: !!c.locked, slow: c.slow || 0 }; }) }));
  const dms = owner ? Object.values(dc.dms).map((d) => { const a = dc.messages[d.id] || []; return { id: d.id, users: Object.values(d.otherName || {}), count: a.length, last: a.length ? a[a.length - 1].ts : d.ts || 0 }; }).filter((d) => d.count).sort((x, y) => y.last - x.last) : [];
  return { guilds, dms };
}
export function monMessages(cid, owner, limit) {
  if (cid.startsWith('dm:') && !owner) return { error: 'owner only' };
  if (!cid.startsWith('dm:') && !dc.channelIndex[cid]) return { error: 'no-such-channel' };
  const a = dc.messages[cid] || [];
  return { ok: true, label: monChannelLabel(cid), messages: a.slice(-Math.min(300, limit || 100)).map((m) => monMsg(m, cid)) };
}
export function monRecent(owner, limit, since) {
  const out = [];
  for (const cid in dc.messages) {
    if (cid.startsWith('dm:') && !owner) continue;
    if (!cid.startsWith('dm:') && !dc.channelIndex[cid]) continue;
    const a = dc.messages[cid]; for (let i = a.length - 1; i >= 0 && i >= a.length - 30; i--) { if (a[i].ts <= (since || 0)) break; out.push({ ...monMsg(a[i], cid), where: monChannelLabel(cid) }); }
  }
  out.sort((x, y) => y.ts - x.ts); return { ok: true, messages: out.slice(0, Math.min(200, limit || 60)) };
}
export function monSearch(q, owner, limit) {
  q = String(q || '').toLowerCase().trim(); if (q.length < 2) return { ok: true, messages: [] };
  const out = [];
  for (const cid in dc.messages) {
    if (cid.startsWith('dm:') && !owner) continue;
    if (!cid.startsWith('dm:') && !dc.channelIndex[cid]) continue;
    for (const m of dc.messages[cid]) { if (String(m.content || '').toLowerCase().includes(q) || String(m.name || '').toLowerCase() === q) out.push({ ...monMsg(m, cid), where: monChannelLabel(cid) }); }
  }
  out.sort((x, y) => y.ts - x.ts); return { ok: true, messages: out.slice(0, Math.min(200, limit || 80)) };
}
export function monDelete(cid, mid, owner) {
  if (cid.startsWith('dm:') && !owner) return { error: 'owner only' };
  const arr = dc.messages[cid]; if (!arr) return { error: 'no-message' };
  const i = arr.findIndex((x) => x.id === mid); if (i < 0) return { error: 'no-message' };
  const m = arr[i]; arr.splice(i, 1); bumpRev(cid); markDirty();
  try { wsBroadcastChannel(cid, { t: 'del', channel: cid, id: mid }); } catch {}
  return { ok: true, who: m.name, where: monChannelLabel(cid) };
}

// ---- Staff controls: mutes, locks, slow mode, global switches ----
const lastSend = new Map();
function sendBlock(me, cid) {
  const staff = isStaffAuth(me);
  const mu = dc.settings.muted && dc.settings.muted[me.id];
  if (mu && mu > Date.now() && !staff) return { error: 'muted', message: 'You are muted in the Discord until ' + new Date(mu).toLocaleTimeString() + '.' };
  const ix = dc.channelIndex[cid], g = ix && dc.guilds[ix.guildId], ch = g && g.channels.find((c) => c.id === cid);
  if (ch && ch.locked && !staff && g.ownerId !== me.id) return { error: 'locked', message: 'This channel is locked.' };
  if (ch && ch.slow > 0 && !staff) { const k = me.id + cid, wait = ch.slow * 1000 - (Date.now() - (lastSend.get(k) || 0)); if (wait > 0) return { error: 'slow', message: 'Slow mode is on. Wait ' + Math.ceil(wait / 1000) + 's.' }; lastSend.set(k, Date.now()); }
  return null;
}
export function dcAdminState() {
  const s = dc.settings, now = Date.now();
  return { flags: s.flags || {}, maxLen: s.maxLen || 0, muted: Object.keys(s.muted || {}).filter((u) => s.muted[u] > now).length, servers: Object.keys(dc.guilds).length, channels: Object.keys(dc.channelIndex).length, dms: Object.keys(dc.dms).length };
}
export function dcAdminOp(op, a) {
  const s = dc.settings; s.muted = s.muted || {}; s.flags = s.flags || {};
  const chan = (cid) => { const ix = dc.channelIndex[cid], g = ix && dc.guilds[ix.guildId]; return g && g.channels.find((c) => c.id === cid); };
  const clampN = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Math.floor(Number(v)) || d));
  let c;
  switch (op) {
    case 'mute': s.muted[a.uid] = Date.now() + clampN(a.minutes, 1, 43200, 10) * 60000; markDirty(); return { ok: true };
    case 'unmute': delete s.muted[a.uid]; markDirty(); return { ok: true };
    case 'purgeuser': { let n = 0; for (const cid in dc.messages) { const arr = dc.messages[cid], keep = arr.filter((m) => m.uid !== a.uid); if (keep.length !== arr.length) { n += arr.length - keep.length; dc.messages[cid] = keep; bumpRev(cid); } } markDirty(); return { ok: true, removed: n }; }
    case 'lock': case 'unlock': c = chan(a.channel); if (!c) return { error: 'no-channel' }; c.locked = op === 'lock'; markDirty(); return { ok: true };
    case 'slow': c = chan(a.channel); if (!c) return { error: 'no-channel' }; c.slow = clampN(a.seconds, 0, 3600, 0); markDirty(); return { ok: true };
    case 'clearchannel': c = chan(a.channel); if (!c) return { error: 'no-channel' }; { const n = (dc.messages[a.channel] || []).length; dc.messages[a.channel] = []; bumpRev(a.channel); markDirty(); return { ok: true, removed: n }; }
    case 'say': {
      c = chan(a.channel); if (!c) return { error: 'no-channel' }; const text = clean(a.text, 1000).trim(); if (!text) return { error: 'empty' };
      const msg = { id: rid(14), uid: 'system', name: 'ScrollHub', color: '', title: '', titleFx: '', avatarFx: '', avatar: '', role: 'owner', content: text, attachments: [], ts: Date.now(), edited: false };
      (dc.messages[a.channel] = dc.messages[a.channel] || []).push(msg); bumpRev(a.channel); markDirty(); wsBroadcastChannel(a.channel, { t: 'msg', channel: a.channel, message: msg }); return { ok: true };
    }
    case 'flag': if (!['dmsOff', 'voiceOff', 'uploadsOff'].includes(a.flag)) return { error: 'bad-flag' }; s.flags[a.flag] = !!a.on; markDirty(); return { ok: true };
    case 'maxlen': s.maxLen = a.value ? clampN(a.value, 50, 2000, 2000) : 0; markDirty(); return { ok: true };
    case 'kickuser': { const g = dc.guilds[a.guild]; if (!g || a.uid === g.ownerId) return { error: 'bad-target' }; g.memberIds = g.memberIds.filter((u) => u !== a.uid); if (dc.userGuilds[a.uid]) dc.userGuilds[a.uid] = dc.userGuilds[a.uid].filter((x) => x !== g.id); (g.left = g.left || []).push(a.uid); markDirty(); return { ok: true }; }
    case 'renameserver': { const g = dc.guilds[a.guild]; const nm = clean(a.name, 40).trim(); if (!g || !nm) return { error: 'bad-target' }; g.name = nm; markDirty(); return { ok: true }; }
    case 'clearicon': { const g = dc.guilds[a.guild]; if (!g) return { error: 'bad-target' }; g.iconUrl = ''; markDirty(); return { ok: true }; }
    case 'deleteserver': { const g = dc.guilds[a.guild]; if (!g || g.id === GLOBAL_ID) return { error: 'bad-target' }; for (const ch of g.channels) { delete dc.messages[ch.id]; delete dc.rev[ch.id]; delete dc.channelIndex[ch.id]; } for (const uid of g.memberIds) { if (dc.userGuilds[uid]) dc.userGuilds[uid] = dc.userGuilds[uid].filter((x) => x !== g.id); } delete dc.guilds[g.id]; if (dc.settings.defaultGuild === g.id) dc.settings.defaultGuild = ''; markDirty(); return { ok: true }; }
    default: return { error: 'bad-op' };
  }
}
function isStaffAuth(auth) { return !!(auth && auth.role); }
function canManage(g, auth) { return !!g && (g.ownerId === auth.id || (g.id === GLOBAL_ID && isStaffAuth(auth))); }

// ---- helpers ----
function rid(n = 12) { const c = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function sendJson(res, status, obj) { res.writeHead(status, { 'Content-Type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }
async function readBody(req) { const ch = []; for await (const c of req) ch.push(c); if (!ch.length) return {}; try { return JSON.parse(Buffer.concat(ch).toString('utf8') || '{}'); } catch { return {}; } }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'channel'; }
function clean(s, n) { return String(s == null ? '' : s).slice(0, n); }

function viewerColor(uid) { try { const c = getCosmetics(uid); return c.color || ''; } catch { return ''; } }
// Full casino cosmetics for a user: name color + name/ring/title effects.
function cosFull(uid) {
  try { const c = getCosmetics(uid); return { color: c.color || '', title: c.tag || '', titleFx: c.titleFx || '', avatarFx: c.avatarFx || '', avatar: c.avatar || '' }; }
  catch { return { color: '', title: '', titleFx: '', avatarFx: '', avatar: '' }; }
}
function dmId(a, b) { return 'dm:' + [a, b].sort().join(':'); }

function bumpRev(cid) { dc.rev[cid] = (dc.rev[cid] || 0) + 1; }

function guildPublic(g) {
  return { id: g.id, name: g.name, icon: g.icon || '', iconUrl: g.iconUrl || '', ownerId: g.ownerId, channels: g.channels, memberCount: g.memberIds.length, builtin: g.id === GLOBAL_ID };
}
function isMember(g, uid) { return g && g.memberIds.includes(uid); }

function addMember(g, uid) {
  if (!g.memberIds.includes(uid)) {
    g.memberIds.push(uid);
    (dc.userGuilds[uid] = dc.userGuilds[uid] || []).push(g.id);
    markDirty();
  }
}

function createGuild(ownerId, name, icon, ownerName) {
  const id = 'g_' + rid(10);
  const g = { id, name: clean(name, 40) || 'New Server', icon: clean(icon, 8), ownerId, createdAt: Date.now(), channels: [], memberIds: [], invites: {}, names: {} };
  if (ownerName) g.names[ownerId] = ownerName;
  const mk = (nm, type) => { const cid = id + '_' + slug(nm) + '_' + rid(4); g.channels.push({ id: cid, name: slug(nm), type }); dc.channelIndex[cid] = { guildId: id, type }; dc.messages[cid] = []; dc.rev[cid] = 1; return cid; };
  mk('general', 'text');
  mk('random', 'text');
  mk('General', 'voice');
  dc.guilds[id] = g;
  addMember(g, ownerId);
  markDirty();
  return g;
}

// ---- ICE servers for voice/video calls ----
// Calls between two different networks (home Wi-Fi, school, phone data) need a TURN relay.
// The client bundle used to hard-code the old public "openrelayproject" login, which no
// longer works, so calls connected but nobody could hear anyone. index.html now asks for
// this list and gives it to every RTCPeerConnection.
// Configure ONE of these on the host for the most reliable relay (all free tiers):
//   METERED_API_KEY + METERED_DOMAIN (yourapp.metered.live)      — metered.ca, 20 GB/mo free
//   CF_TURN_KEY_ID + CF_TURN_API_TOKEN                            — Cloudflare Realtime TURN
//   TURN_URLS (comma list) + TURN_USERNAME + TURN_CREDENTIAL      — any static TURN server
//   TURN_URLS + TURN_SECRET                                       — your own coturn (REST auth)
// Without any of them we fall back to Open Relay's documented shared-secret relay.
const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] };
let iceCache = { at: 0, list: null, source: '' };
function restCreds(secret, ttl) {
  const username = `${Math.floor(Date.now() / 1000) + ttl}:scrollhub`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}
export async function iceServers() {
  const now = Date.now();
  if (iceCache.list && now - iceCache.at < 30 * 60 * 1000) return iceCache;
  const env = process.env;
  let list = null, source = '';
  try {
    if (env.METERED_API_KEY && env.METERED_DOMAIN) {
      const r = await fetch(`https://${env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${encodeURIComponent(env.METERED_API_KEY)}`, { signal: AbortSignal.timeout(6000) });
      const j = await r.json(); if (Array.isArray(j) && j.length) { list = j; source = 'metered'; }
    } else if (env.CF_TURN_KEY_ID && env.CF_TURN_API_TOKEN) {
      const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CF_TURN_KEY_ID}/credentials/generate-ice-servers`, { method: 'POST', headers: { authorization: `Bearer ${env.CF_TURN_API_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ ttl: 86400 }), signal: AbortSignal.timeout(6000) });
      const j = await r.json(); if (j && j.iceServers) { list = [].concat(j.iceServers); source = 'cloudflare'; }
    } else if (env.TURN_URLS && (env.TURN_SECRET || env.TURN_USERNAME)) {
      const urls = env.TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean);
      const c = env.TURN_SECRET ? restCreds(env.TURN_SECRET, 86400) : { username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL || '' };
      list = [{ urls, ...c }]; source = 'custom';
    }
  } catch (e) { list = null; }
  if (!list) {
    const h = 'staticauth.openrelay.metered.ca';
    list = [{ urls: [`turn:${h}:80`, `turn:${h}:80?transport=tcp`, `turn:${h}:443`, `turns:${h}:443?transport=tcp`], ...restCreds('openrelayprojectsecret', 86400) }];
    source = 'openrelay';
  }
  iceCache = { at: now, list: [STUN, ...list], source };
  return iceCache;
}

// ---- REST ----
export async function handleDiscord(url, req, res) {
  const auth = req._auth || await resolveSession(req);
  if (!auth) return sendJson(res, 401, { error: 'login-required' });
  const me = auth; // {id, username, role}
  if (me.role) staffNames.add(String(me.username).toLowerCase());
  const path = url.split('?')[0];
  const q = new URL(req.url || url, 'http://x').searchParams;

  // Serve uploaded files (public once you have the URL).
  // (handled separately in server.js for /dcf/)

  if (path === '/api/dc/boot') {
    const gg = ensureGlobal();
    if (!gg.left || !gg.left.includes(me.id)) { if (!gg.memberIds.includes(me.id)) { addMember(gg, me.id); (gg.names = gg.names || {})[me.id] = me.username; } }
    autoJoin(defaultGuild(), me);
    const gids = dc.userGuilds[me.id] || [];
    const guilds = gids.map((id) => dc.guilds[id]).filter(Boolean).map(guildPublic);
    const dms = Object.values(dc.dms).filter((d) => d.userIds.includes(me.id)).map((d) => {
      const other = d.userIds.find((u) => u !== me.id) || me.id;
      const msgs = dc.messages[d.id] || [];
      const oc = cosFull(other);
      return { id: d.id, user: { id: other, username: d.otherName && d.otherName[other] || 'User', color: oc.color, avatarFx: oc.avatarFx, avatar: oc.avatar }, lastTs: msgs.length ? msgs[msgs.length - 1].ts : d.ts };
    }).sort((a, b) => b.lastTs - a.lastTs);
    const mc = cosFull(me.id);
    return sendJson(res, 200, { me: { id: me.id, username: me.username, role: me.role || null, color: mc.color, title: mc.title, titleFx: mc.titleFx, avatarFx: mc.avatarFx, avatar: mc.avatar }, guilds, dms });
  }

  if (path === '/api/dc/guild' && req.method === 'POST') {
    const b = await readBody(req);
    if (!clean(b.name, 40).trim()) return sendJson(res, 400, { error: 'name-required' });
    const g = createGuild(me.id, b.name, b.icon, me.username);
    return sendJson(res, 200, { ok: true, guild: guildPublic(g) });
  }

  // /api/dc/guild/:id/channel  (create)   | /invite | /leave
  let m;
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/channel$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (!g) return sendJson(res, 404, { error: 'no-guild' });
    if (!isMember(g, me.id) || (g.id === GLOBAL_ID && !canManage(g, me))) return sendJson(res, 403, { error: 'not-member' });
    const b = await readBody(req);
    const type = b.type === 'voice' ? 'voice' : 'text';
    const cid = g.id + '_' + slug(b.name) + '_' + rid(4);
    g.channels.push({ id: cid, name: slug(b.name), type });
    dc.channelIndex[cid] = { guildId: g.id, type };
    if (type === 'text') { dc.messages[cid] = []; dc.rev[cid] = 1; }
    markDirty();
    return sendJson(res, 200, { ok: true, guild: guildPublic(g) });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/invite$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (!g || !isMember(g, me.id)) return sendJson(res, 403, { error: 'not-member' });
    const code = rid(8);
    g.invites[code] = { by: me.id, ts: Date.now() };
    markDirty();
    return sendJson(res, 200, { ok: true, code });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/leave$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (g) {
      if (g.id === GLOBAL_ID || (defaultGuild() && g.id === defaultGuild().id)) (g.left = g.left || []).push(me.id);
      g.memberIds = g.memberIds.filter((u) => u !== me.id);
      dc.userGuilds[me.id] = (dc.userGuilds[me.id] || []).filter((x) => x !== g.id);
      markDirty();
    }
    return sendJson(res, 200, { ok: true });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/delete$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (!g) return sendJson(res, 200, { ok: true });
    if (g.ownerId !== me.id || g.id === GLOBAL_ID) return sendJson(res, 403, { error: 'not-owner' });
    for (const ch of g.channels) { delete dc.messages[ch.id]; delete dc.rev[ch.id]; delete dc.channelIndex[ch.id]; }
    for (const uid of g.memberIds) {
      if (dc.userGuilds[uid]) dc.userGuilds[uid] = dc.userGuilds[uid].filter((x) => x !== g.id);
    }
    delete dc.guilds[g.id];
    markDirty();
    return sendJson(res, 200, { ok: true });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/kick$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (!g) return sendJson(res, 404, { error: 'no-guild' });
    if (!canManage(g, me)) return sendJson(res, 403, { error: 'not-owner' });
    const b = await readBody(req);
    const uid = clean(b.uid, 64);
    if (!uid || uid === g.ownerId) return sendJson(res, 400, { error: 'bad-target' });
    g.memberIds = g.memberIds.filter((u) => u !== uid);
    if (dc.userGuilds[uid]) dc.userGuilds[uid] = dc.userGuilds[uid].filter((x) => x !== g.id);
    if (g.names) delete g.names[uid];
    markDirty();
    return sendJson(res, 200, { ok: true });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/members$/))) {
    const g = dc.guilds[m[1]];
    if (!g || !isMember(g, me.id)) return sendJson(res, 403, { error: 'not-member' });
    const members = g.memberIds.map((uid) => { const c = cosFull(uid); return { id: uid, username: g.names && g.names[uid] || 'User', owner: uid === g.ownerId, staff: !!(g.names && g.names[uid] && staffNames.has(String(g.names[uid]).toLowerCase())), color: c.color, title: c.title, titleFx: c.titleFx, avatarFx: c.avatarFx, avatar: c.avatar }; });
    return sendJson(res, 200, { members });
  }

  if (path === '/api/dc/join' && req.method === 'POST') {
    const b = await readBody(req);
    const code = clean(b.code, 16).trim();
    const g = Object.values(dc.guilds).find((x) => x.invites && x.invites[code]);
    if (!g) return sendJson(res, 404, { error: 'bad-code' });
    addMember(g, me.id);
    (g.names = g.names || {})[me.id] = me.username;
    return sendJson(res, 200, { ok: true, guild: guildPublic(g) });
  }

  if (path === '/api/dc/dm/open' && req.method === 'POST') {
    if (dc.settings.flags && dc.settings.flags.dmsOff && !isStaffAuth(me)) return sendJson(res, 403, { error: 'dms-off', message: 'Direct messages are switched off right now.' });
    const b = await readBody(req);
    const other = clean(b.username, 40).trim();
    const acct = await accountByName(other);
    if (!acct) return sendJson(res, 404, { error: 'no-user' });
    if (acct.id === me.id) return sendJson(res, 400, { error: 'self' });
    const id = dmId(me.id, acct.id);
    if (!dc.dms[id]) {
      dc.dms[id] = { id, userIds: [me.id, acct.id], ts: Date.now(), otherName: {} };
      dc.messages[id] = dc.messages[id] || [];
      dc.rev[id] = dc.rev[id] || 1;
    }
    dc.dms[id].otherName = dc.dms[id].otherName || {};
    dc.dms[id].otherName[me.id] = me.username;
    dc.dms[id].otherName[acct.id] = acct.username;
    markDirty();
    return sendJson(res, 200, { ok: true, dm: { id, user: { id: acct.id, username: acct.username } } });
  }

  if (path === '/api/dc/messages') {
    const cid = clean(q.get('channel'), 80);
    if (!canAccessChannel(cid, me.id)) return sendJson(res, 403, { error: 'no-access' });
    const after = +q.get('after') || 0;
    if (after && after === (dc.rev[cid] || 0)) return sendJson(res, 200, { unchanged: true, rev: after });
    // Show each sender's *current* picture/ring, not the one saved when the message was sent
    // (old saves can point at a link that no longer works, or a photo they've since changed).
    const live = {};
    const msgs = (dc.messages[cid] || []).slice(-80).map((m) => {
      if (!m || !m.uid) return m;
      const cc = live[m.uid] || (live[m.uid] = cosFull(m.uid));
      return { ...m, avatar: cc.avatar, avatarFx: cc.avatarFx };
    });
    return sendJson(res, 200, { messages: msgs, rev: dc.rev[cid] || 0, names: await namesForMessages(cid, msgs) });
  }

  if (path === '/api/dc/send' && req.method === 'POST') {
    const b = await readBody(req);
    const cid = clean(b.channel, 80);
    if (!canAccessChannel(cid, me.id)) return sendJson(res, 403, { error: 'no-access' });
    const blk = sendBlock(me, cid); if (blk) return sendJson(res, 403, blk);
    const content = clean(b.content, (dc.settings && dc.settings.maxLen) || 2000).trim();
    const atts = Array.isArray(b.attachments) ? b.attachments : [];
    if (!content && !atts.length) return sendJson(res, 400, { error: 'empty' });
    const cc = cosFull(me.id);
    const msg = {
      id: rid(14), uid: me.id, name: me.username, role: me.role || null, color: cc.color, title: cc.title, titleFx: cc.titleFx, avatarFx: cc.avatarFx, avatar: cc.avatar, content,
      attachments: atts.slice(0, 4).map((a) => ({ url: clean(a.url, 300), name: clean(a.name, 80), type: clean(a.type, 20), w: +a.w || 0, h: +a.h || 0 }))
        .filter((a) => a.url.startsWith('/dcf/') || /^https?:\/\//.test(a.url)),
      ts: Date.now(), edited: false,
    };
    (dc.messages[cid] = dc.messages[cid] || []).push(msg);
    if (dc.messages[cid].length > 500) dc.messages[cid] = dc.messages[cid].slice(-500);
    bumpRev(cid);
    markDirty();
    wsBroadcastChannel(cid, { t: 'msg', channel: cid, message: msg });
    try { // notifications: every other member's live sockets (the notifier script shows them)
      let ids = [], where = '';
      if (cid.startsWith('dm:')) { ids = (dc.dms[cid] || {}).userIds || []; where = 'DM'; }
      else { const ix = dc.channelIndex[cid]; const g = ix && dc.guilds[ix.guildId]; if (g) { ids = g.memberIds; const ch = (g.channels || []).find((x) => x.id === cid); where = g.name + (ch ? ' · #' + ch.name : ''); } }
      const set = new Set(ids.filter((u) => u !== me.id));
      const out = JSON.stringify({ t: 'notify', channel: cid, from: me.username, avatar: cosFull(me.id).avatar, where, text: content.slice(0, 140) || '📎 sent a file', dm: cid.startsWith('dm:'), ts: msg.ts });
      if (set.size) for (const c of conns) if (set.has(c.uid) && c.readyState === 1) { try { c.send(out); } catch {} }
    } catch {}
    return sendJson(res, 200, { ok: true, message: msg });
  }

  if (path === '/api/dc/delete' && req.method === 'POST') {
    const b = await readBody(req);
    const cid = clean(b.channel, 80), mid = clean(b.id, 40);
    if (!canAccessChannel(cid, me.id)) return sendJson(res, 403, { error: 'no-access' });
    const arr = dc.messages[cid] || [];
    const i = arr.findIndex((x) => x.id === mid);
    if (i < 0) return sendJson(res, 404, { error: 'no-message' });
    const ix = dc.channelIndex[cid]; const g = ix && dc.guilds[ix.guildId];
    if (arr[i].uid !== me.id && !canManage(g, me) && !(me.role === 'owner')) return sendJson(res, 403, { error: 'not-allowed' });
    arr.splice(i, 1); bumpRev(cid); markDirty();
    wsBroadcastChannel(cid, { t: 'del', channel: cid, id: mid });
    return sendJson(res, 200, { ok: true });
  }
  if (path === '/api/dc/edit' && req.method === 'POST') {
    const b = await readBody(req);
    const cid = clean(b.channel, 80), mid = clean(b.id, 40), content = clean(b.content, 2000).trim();
    if (!canAccessChannel(cid, me.id)) return sendJson(res, 403, { error: 'no-access' });
    const m2 = (dc.messages[cid] || []).find((x) => x.id === mid);
    if (!m2 || m2.uid !== me.id) return sendJson(res, 403, { error: 'not-allowed' });
    if (!content) return sendJson(res, 400, { error: 'empty' });
    m2.content = content; m2.edited = true; bumpRev(cid); markDirty();
    wsBroadcastChannel(cid, { t: 'edit', channel: cid, message: m2 });
    return sendJson(res, 200, { ok: true, message: m2 });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/channel\/delete$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (!g) return sendJson(res, 404, { error: 'no-guild' });
    if (!canManage(g, me)) return sendJson(res, 403, { error: 'not-owner' });
    const b = await readBody(req); const cid = clean(b.channel, 80);
    if (g.channels.length <= 1) return sendJson(res, 400, { error: 'last-channel' });
    g.channels = g.channels.filter((c) => c.id !== cid);
    delete dc.messages[cid]; delete dc.rev[cid]; delete dc.channelIndex[cid];
    markDirty();
    return sendJson(res, 200, { ok: true, guild: guildPublic(g) });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/icon$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (!g || !canManage(g, me)) return sendJson(res, 403, { error: 'not-owner' });
    const b = await readBody(req); const u = String(b.url || '');
    if (!u) g.iconUrl = '';
    else {
      const mm = u.match(/\/dcf\/([A-Za-z0-9]+\.(?:png|jpg|webp|gif))$/);
      if (!mm) return sendJson(res, 400, { error: 'bad-url' });
      g.iconUrl = '/dcf/' + mm[1];
    }
    markDirty();
    return sendJson(res, 200, { ok: true, guild: guildPublic(g) });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/rename$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (!g || !canManage(g, me)) return sendJson(res, 403, { error: 'not-owner' });
    const b = await readBody(req); const nm = clean(b.name, 40).trim();
    if (nm) g.name = nm; markDirty();
    return sendJson(res, 200, { ok: true, guild: guildPublic(g) });
  }
  if (path === '/api/dc/upload' && req.method === 'POST') {
    if (dc.settings.flags && dc.settings.flags.uploadsOff && !isStaffAuth(me)) return sendJson(res, 403, { error: 'uploads-off', message: 'Image uploads are switched off right now.' });
    const b = await readBody(req);
    const du = String(b.dataUrl || '');
    const mt = du.match(/^data:([\w/+.-]+);base64,(.+)$/);
    if (!mt) return sendJson(res, 400, { error: 'bad-data' });
    const ct = mt[1].toLowerCase();
    const okTypes = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
    const ext = okTypes[ct];
    if (!ext) return sendJson(res, 400, { error: 'type' });
    const b64 = mt[2];
    if (b64.length > 1.5 * 1024 * 1024) return sendJson(res, 413, { error: 'too-big' }); // ~1.1MB decoded
    const id = rid(16);
    dc.files[id] = { ct, b64 };
    try { await kvSet('sh:dcf:' + id, JSON.stringify({ ct, b64 })); } catch {}
    // Absolute URL to THIS (central) backend so the image loads from any mirror.
    const base = req.headers.host ? ('https://' + req.headers.host) : '';
    return sendJson(res, 200, { ok: true, url: base + '/dcf/' + id + '.' + ext, w: +b.w || 0, h: +b.h || 0, name: clean(b.name, 80), type: ct });
  }

  return sendJson(res, 404, { error: 'not-found' });
}

function canAccessChannel(cid, uid) {
  if (!cid) return false;
  if (cid.startsWith('dm:')) { const d = dc.dms[cid]; return !!(d && d.userIds.includes(uid)); }
  const idx = dc.channelIndex[cid];
  if (!idx) return false;
  const g = dc.guilds[idx.guildId];
  return !!(g && g.memberIds.includes(uid));
}
async function namesForMessages() { return {}; } // names are embedded on each message now

export async function serveDiscordFile(req, res, url) {
  const id = url.slice(5).split('.')[0].replace(/[^a-z0-9]/gi, '');
  let f = dc.files[id];
  if (!f) { try { const raw = await kvGet('sh:dcf:' + id); if (raw) { f = JSON.parse(raw); dc.files[id] = f; } } catch {} }
  if (!f) { res.writeHead(404); res.end('nf'); return; }
  const buf = Buffer.from(f.b64, 'base64');
  res.writeHead(200, { 'Content-Type': f.ct, 'Cache-Control': 'public, max-age=31536000, immutable' });
  res.end(buf);
}

// ============================================================
// WebSocket: live messages + WebRTC voice signaling.
// ============================================================
const wss = new WebSocketServer({ noServer: true });
const conns = new Set();               // all live sockets
const staffNames = new Set();          // lowercased usernames seen with a staff role
const voiceRooms = new Map();          // channelId -> Set(conn)

function wsBroadcastChannel(cid, obj) {
  const s = JSON.stringify(obj);
  for (const c of conns) { if (c.readyState === 1 && c.subs && c.subs.has(cid)) { try { c.send(s); } catch {} } }
}
function voiceRoster(cid) {
  const set = voiceRooms.get(cid);
  if (!set) return [];
  return [...set].map((c) => { const cc = cosFull(c.uid); return { peer: c.peerId, uid: c.uid, name: c.uname, color: cc.color, avatarFx: cc.avatarFx, avatar: cc.avatar }; });
}
function voiceBroadcast(cid, obj, except) {
  const set = voiceRooms.get(cid); if (!set) return;
  const s = JSON.stringify(obj);
  for (const c of set) { if (c !== except && c.readyState === 1) { try { c.send(s); } catch {} } }
}
function leaveVoice(conn) {
  if (!conn.voiceCid) return;
  const cid = conn.voiceCid; conn.voiceCid = null;
  const set = voiceRooms.get(cid);
  if (set) { set.delete(conn); if (!set.size && !hasPending(cid)) voiceRooms.delete(cid); }
  voiceBroadcast(cid, { t: 'voice-leave', peer: conn.peerId });
}
// Pending-leave grace: when a socket just drops (reconnect/blip) we DON'T tell
// the room immediately. We wait a few seconds; if the same user rejoins the same
// channel we cancel it, so a quick reconnect doesn't flash them out of the call.
const pendingLeaves = new Map(); // peerId -> { timer, cid, uid }
function hasPending(cid) { for (const v of pendingLeaves.values()) if (v.cid === cid) return true; return false; }
function leaveVoiceGraceful(conn) {
  if (!conn.voiceCid) return;
  const cid = conn.voiceCid, pid = conn.peerId, uid = conn.uid; conn.voiceCid = null;
  const set = voiceRooms.get(cid);
  if (set) set.delete(conn);
  const timer = setTimeout(() => {
    pendingLeaves.delete(pid);
    voiceBroadcast(cid, { t: 'voice-leave', peer: pid });
    const s = voiceRooms.get(cid); if (s && !s.size && !hasPending(cid)) voiceRooms.delete(cid);
  }, 6000);
  pendingLeaves.set(pid, { timer, cid, uid });
}
// On (re)join, clear any ghost the same user left behind in this channel.
function clearGhosts(uid, cid) {
  for (const [pid, info] of pendingLeaves) {
    if (info.uid === uid && info.cid === cid) {
      clearTimeout(info.timer); pendingLeaves.delete(pid);
      voiceBroadcast(cid, { t: 'voice-leave', peer: pid });
    }
  }
}

export function handleDiscordUpgrade(req, socket, head) {
  // Cross-origin WebSockets can't send our auth header or cookie, so the token
  // rides in the ?t= query param; fall back to cookie for same-origin.
  let tok = '';
  try { tok = new URL(req.url, 'http://x').searchParams.get('t') || ''; } catch {}
  const idP = tok ? sessionFromToken(tok) : resolveSession(req);
  Promise.resolve(idP).then((auth) => {
    if (!auth) { try { socket.destroy(); } catch {} return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.uid = auth.id; ws.uname = auth.username; ws.peerId = rid(10); ws.subs = new Set(); ws.voiceCid = null; ws.staff = !!auth.role;
      conns.add(ws);
      ws.send(JSON.stringify({ t: 'hello', peer: ws.peerId }));
      ws.on('message', (raw) => {
        let d; try { d = JSON.parse(raw.toString()); } catch { return; }
        if (d.t === 'sub' && typeof d.channel === 'string') {
          if (canAccessChannel(d.channel, ws.uid)) ws.subs.add(d.channel);
        } else if (d.t === 'unsub') { ws.subs.delete(d.channel); }
        else if (d.t === 'typing' && typeof d.channel === 'string') {
          if (canAccessChannel(d.channel, ws.uid)) { const o = JSON.stringify({ t: 'typing', channel: d.channel, uid: ws.uid, name: ws.uname }); for (const c of conns) if (c !== ws && c.readyState === 1 && c.subs && c.subs.has(d.channel)) { try { c.send(o); } catch {} } }
        }
        else if (d.t === 'voice-join' && typeof d.channel === 'string') {
          if (!canAccessChannel(d.channel, ws.uid)) return;
          if (dc.settings.flags && dc.settings.flags.voiceOff && !ws.staff) { try { ws.send(JSON.stringify({ t: 'voice-off' })); } catch {} return; }
          leaveVoice(ws);
          clearGhosts(ws.uid, d.channel); // drop any stale copy of us from a dropped socket
          const set = voiceRooms.get(d.channel) || new Set();
          // Enforce ONE presence per user in a channel: evict any still-connected
          // older socket of the same user (a reconnect/refresh that left a ghost).
          for (const c of [...set]) {
            if (c !== ws && c.uid === ws.uid) {
              set.delete(c); c.voiceCid = null;
              voiceBroadcast(d.channel, { t: 'voice-leave', peer: c.peerId });
            }
          }
          ws.voiceCid = d.channel;
          set.add(ws); voiceRooms.set(d.channel, set);
          // tell the newcomer who's already here
          ws.send(JSON.stringify({ t: 'voice-peers', channel: d.channel, peers: voiceRoster(d.channel).filter((p) => p.peer !== ws.peerId) }));
          // tell everyone else a newcomer arrived (they will initiate the offer)
          { const cc = cosFull(ws.uid); voiceBroadcast(d.channel, { t: 'voice-join', peer: ws.peerId, uid: ws.uid, name: ws.uname, color: cc.color, avatarFx: cc.avatarFx, avatar: cc.avatar }, ws); }
        } else if (d.t === 'voice-leave') { leaveVoice(ws); }
        else if (d.t === 'signal' && d.to) {
          // relay WebRTC offer/answer/ICE to the target peer in the same room
          const set = ws.voiceCid && voiceRooms.get(ws.voiceCid);
          if (!set) return;
          for (const c of set) { if (c.peerId === d.to && c.readyState === 1) { try { c.send(JSON.stringify({ t: 'signal', from: ws.peerId, data: d.data })); } catch {} break; } }
        } else if (d.t === 'voice-mute') {
          if (ws.voiceCid) voiceBroadcast(ws.voiceCid, { t: 'voice-mute', peer: ws.peerId, muted: !!d.muted }, ws);
        } else if ((d.t === 'call-ring' || d.t === 'call-accept' || d.t === 'call-decline' || d.t === 'call-cancel') && typeof d.toUid === 'string' && typeof d.dmId === 'string') {
          // 1:1 call signaling: relay to every live socket of the target user.
          if (!canAccessChannel(d.dmId, ws.uid)) return;
          const out = JSON.stringify({ t: d.t, dmId: d.dmId, fromUid: ws.uid, fromName: ws.uname, video: !!d.video });
          for (const c of conns) { if (c.uid === d.toUid && c.readyState === 1) { try { c.send(out); } catch {} } }
        } else if (d.t === 'ping') { try { ws.send('{"t":"pong"}'); } catch {} }
      });
      ws.on('close', () => { leaveVoiceGraceful(ws); conns.delete(ws); });
      ws.on('error', () => { try { leaveVoiceGraceful(ws); conns.delete(ws); } catch {} });
    });
  }).catch(() => { try { socket.destroy(); } catch {} });
}
