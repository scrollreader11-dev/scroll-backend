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
import { resolveSession, accountByName, sessionFromToken } from './auth.js';

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
      channelIndex: dc.channelIndex, dms: dc.dms, userGuilds: dc.userGuilds,
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
        channelIndex: s.channelIndex || {}, dms: s.dms || {}, userGuilds: s.userGuilds || {},
        files: {},
      });
    }
  } catch (e) { console.log('discord load failed:', e.message); }
  setInterval(flush, 12000);
}

// ---- helpers ----
function rid(n = 12) { const c = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function sendJson(res, status, obj) { res.writeHead(status, { 'Content-Type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }
async function readBody(req) { const ch = []; for await (const c of req) ch.push(c); if (!ch.length) return {}; try { return JSON.parse(Buffer.concat(ch).toString('utf8') || '{}'); } catch { return {}; } }
function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'channel'; }
function clean(s, n) { return String(s == null ? '' : s).slice(0, n); }

function viewerColor(uid) { try { const c = getCosmetics(uid); return c.color || ''; } catch { return ''; } }
// Full casino cosmetics for a user: name color + name/ring/title effects.
function cosFull(uid) {
  try { const c = getCosmetics(uid); return { color: c.color || '', title: c.tag || '', titleFx: c.titleFx || '', avatarFx: c.avatarFx || '' }; }
  catch { return { color: '', title: '', titleFx: '', avatarFx: '' }; }
}
function dmId(a, b) { return 'dm:' + [a, b].sort().join(':'); }

function bumpRev(cid) { dc.rev[cid] = (dc.rev[cid] || 0) + 1; }

function guildPublic(g) {
  return { id: g.id, name: g.name, icon: g.icon || '', ownerId: g.ownerId, channels: g.channels, memberCount: g.memberIds.length };
}
function isMember(g, uid) { return g && g.memberIds.includes(uid); }

function addMember(g, uid) {
  if (!g.memberIds.includes(uid)) {
    g.memberIds.push(uid);
    (dc.userGuilds[uid] = dc.userGuilds[uid] || []).push(g.id);
    markDirty();
  }
}

function createGuild(ownerId, name, icon) {
  const id = 'g_' + rid(10);
  const g = { id, name: clean(name, 40) || 'New Server', icon: clean(icon, 8), ownerId, createdAt: Date.now(), channels: [], memberIds: [], invites: {} };
  const mk = (nm, type) => { const cid = id + '_' + slug(nm) + '_' + rid(4); g.channels.push({ id: cid, name: slug(nm), type }); dc.channelIndex[cid] = { guildId: id, type }; dc.messages[cid] = []; dc.rev[cid] = 1; return cid; };
  mk('general', 'text');
  mk('random', 'text');
  mk('General', 'voice');
  dc.guilds[id] = g;
  addMember(g, ownerId);
  markDirty();
  return g;
}

// ---- REST ----
export async function handleDiscord(url, req, res) {
  const auth = req._auth || await resolveSession(req);
  if (!auth) return sendJson(res, 401, { error: 'login-required' });
  const me = auth; // {id, username}
  const path = url.split('?')[0];
  const q = new URL(req.url || url, 'http://x').searchParams;

  // Serve uploaded files (public once you have the URL).
  // (handled separately in server.js for /dcf/)

  if (path === '/api/dc/boot') {
    const gids = dc.userGuilds[me.id] || [];
    const guilds = gids.map((id) => dc.guilds[id]).filter(Boolean).map(guildPublic);
    const dms = Object.values(dc.dms).filter((d) => d.userIds.includes(me.id)).map((d) => {
      const other = d.userIds.find((u) => u !== me.id) || me.id;
      const msgs = dc.messages[d.id] || [];
      return { id: d.id, user: { id: other, username: d.otherName && d.otherName[other] || 'User' }, lastTs: msgs.length ? msgs[msgs.length - 1].ts : d.ts };
    }).sort((a, b) => b.lastTs - a.lastTs);
    const mc = cosFull(me.id);
    return sendJson(res, 200, { me: { id: me.id, username: me.username, color: mc.color, title: mc.title, titleFx: mc.titleFx, avatarFx: mc.avatarFx }, guilds, dms });
  }

  if (path === '/api/dc/guild' && req.method === 'POST') {
    const b = await readBody(req);
    if (!clean(b.name, 40).trim()) return sendJson(res, 400, { error: 'name-required' });
    const g = createGuild(me.id, b.name, b.icon);
    return sendJson(res, 200, { ok: true, guild: guildPublic(g) });
  }

  // /api/dc/guild/:id/channel  (create)   | /invite | /leave
  let m;
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/channel$/)) && req.method === 'POST') {
    const g = dc.guilds[m[1]];
    if (!g) return sendJson(res, 404, { error: 'no-guild' });
    if (!isMember(g, me.id)) return sendJson(res, 403, { error: 'not-member' });
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
      g.memberIds = g.memberIds.filter((u) => u !== me.id);
      dc.userGuilds[me.id] = (dc.userGuilds[me.id] || []).filter((x) => x !== g.id);
      markDirty();
    }
    return sendJson(res, 200, { ok: true });
  }
  if ((m = path.match(/^\/api\/dc\/guild\/([^/]+)\/members$/))) {
    const g = dc.guilds[m[1]];
    if (!g || !isMember(g, me.id)) return sendJson(res, 403, { error: 'not-member' });
    const members = g.memberIds.map((uid) => { const c = cosFull(uid); return { id: uid, username: g.names && g.names[uid] || 'User', owner: uid === g.ownerId, color: c.color, title: c.title, titleFx: c.titleFx, avatarFx: c.avatarFx }; });
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
    const msgs = (dc.messages[cid] || []).slice(-80);
    return sendJson(res, 200, { messages: msgs, rev: dc.rev[cid] || 0, names: await namesForMessages(cid, msgs) });
  }

  if (path === '/api/dc/send' && req.method === 'POST') {
    const b = await readBody(req);
    const cid = clean(b.channel, 80);
    if (!canAccessChannel(cid, me.id)) return sendJson(res, 403, { error: 'no-access' });
    const content = clean(b.content, 2000).trim();
    const atts = Array.isArray(b.attachments) ? b.attachments : [];
    if (!content && !atts.length) return sendJson(res, 400, { error: 'empty' });
    const cc = cosFull(me.id);
    const msg = {
      id: rid(14), uid: me.id, name: me.username, color: cc.color, title: cc.title, titleFx: cc.titleFx, avatarFx: cc.avatarFx, content,
      attachments: atts.slice(0, 4).map((a) => ({ url: clean(a.url, 300), name: clean(a.name, 80), type: clean(a.type, 20), w: +a.w || 0, h: +a.h || 0 }))
        .filter((a) => a.url.startsWith('/dcf/') || /^https?:\/\//.test(a.url)),
      ts: Date.now(), edited: false,
    };
    (dc.messages[cid] = dc.messages[cid] || []).push(msg);
    if (dc.messages[cid].length > 500) dc.messages[cid] = dc.messages[cid].slice(-500);
    bumpRev(cid);
    markDirty();
    wsBroadcastChannel(cid, { t: 'msg', channel: cid, message: msg });
    return sendJson(res, 200, { ok: true, message: msg });
  }

  if (path === '/api/dc/upload' && req.method === 'POST') {
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
const voiceRooms = new Map();          // channelId -> Set(conn)

function wsBroadcastChannel(cid, obj) {
  const s = JSON.stringify(obj);
  for (const c of conns) { if (c.readyState === 1 && c.subs && c.subs.has(cid)) { try { c.send(s); } catch {} } }
}
function voiceRoster(cid) {
  const set = voiceRooms.get(cid);
  if (!set) return [];
  return [...set].map((c) => { const cc = cosFull(c.uid); return { peer: c.peerId, uid: c.uid, name: c.uname, color: cc.color, avatarFx: cc.avatarFx }; });
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
  if (set) { set.delete(conn); if (!set.size) voiceRooms.delete(cid); }
  voiceBroadcast(cid, { t: 'voice-leave', peer: conn.peerId });
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
      ws.uid = auth.id; ws.uname = auth.username; ws.peerId = rid(10); ws.subs = new Set(); ws.voiceCid = null;
      conns.add(ws);
      ws.send(JSON.stringify({ t: 'hello', peer: ws.peerId }));
      ws.on('message', (raw) => {
        let d; try { d = JSON.parse(raw.toString()); } catch { return; }
        if (d.t === 'sub' && typeof d.channel === 'string') {
          if (canAccessChannel(d.channel, ws.uid)) ws.subs.add(d.channel);
        } else if (d.t === 'unsub') { ws.subs.delete(d.channel); }
        else if (d.t === 'voice-join' && typeof d.channel === 'string') {
          if (!canAccessChannel(d.channel, ws.uid)) return;
          leaveVoice(ws);
          ws.voiceCid = d.channel;
          const set = voiceRooms.get(d.channel) || new Set(); set.add(ws); voiceRooms.set(d.channel, set);
          // tell the newcomer who's already here
          ws.send(JSON.stringify({ t: 'voice-peers', channel: d.channel, peers: voiceRoster(d.channel).filter((p) => p.peer !== ws.peerId) }));
          // tell everyone else a newcomer arrived (they will initiate the offer)
          { const cc = cosFull(ws.uid); voiceBroadcast(d.channel, { t: 'voice-join', peer: ws.peerId, uid: ws.uid, name: ws.uname, color: cc.color, avatarFx: cc.avatarFx }, ws); }
        } else if (d.t === 'voice-leave') { leaveVoice(ws); }
        else if (d.t === 'signal' && d.to) {
          // relay WebRTC offer/answer/ICE to the target peer in the same room
          const set = ws.voiceCid && voiceRooms.get(ws.voiceCid);
          if (!set) return;
          for (const c of set) { if (c.peerId === d.to && c.readyState === 1) { try { c.send(JSON.stringify({ t: 'signal', from: ws.peerId, data: d.data })); } catch {} break; } }
        } else if (d.t === 'voice-mute') {
          if (ws.voiceCid) voiceBroadcast(ws.voiceCid, { t: 'voice-mute', peer: ws.peerId, muted: !!d.muted }, ws);
        }
      });
      ws.on('close', () => { leaveVoice(ws); conns.delete(ws); });
      ws.on('error', () => { try { leaveVoice(ws); conns.delete(ws); } catch {} });
    });
  }).catch(() => { try { socket.destroy(); } catch {} });
}
