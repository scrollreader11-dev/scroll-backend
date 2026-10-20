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

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');
const UPSTREAM = 'https://petezahgames.com';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const serve = sirv(distDir, { dev: false, etag: true });

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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'multicraft1122';
const STATE_FILE = '/tmp/scrollhub-admin-state.json';
const PLAYER_TTL = 35000; // ms since last heartbeat before "offline"

const admin = {
  settings: { maintenance: false, redirect: '', announcement: '' },
  bansByIp: {},   // ip -> {nickname, ts}
  kicks: {},      // clientId -> {message, ts}  (one-shot)
  broadcast: null // {text, ts}  shown to everyone once
};
const players = new Map(); // clientId -> {id, nickname, ip, location, firstSeen, lastSeen}
const geoCache = new Map(); // ip -> location string

try {
  const fs = await import('node:fs');
  if (fs.existsSync(STATE_FILE)) {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (saved.settings) admin.settings = saved.settings;
    if (saved.bansByIp) admin.bansByIp = saved.bansByIp;
  }
} catch {}
async function saveState() {
  try {
    const fs = await import('node:fs');
    fs.writeFileSync(STATE_FILE, JSON.stringify({ settings: admin.settings, bansByIp: admin.bansByIp }));
  } catch {}
}

async function geoLookup(ip) {
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return 'Local';
  if (geoCache.has(ip)) return geoCache.get(ip);
  geoCache.set(ip, 'Locating…');
  try {
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country`);
    const d = await r.json();
    const loc = d.status === 'success'
      ? [d.city, d.regionName, d.country].filter(Boolean).join(', ')
      : 'Unknown';
    geoCache.set(ip, loc);
    return loc;
  } catch { geoCache.set(ip, 'Unknown'); return 'Unknown'; }
}
function prunePlayers() {
  const now = Date.now();
  for (const [id, p] of players) if (now - p.lastSeen > PLAYER_TTL) players.delete(id);
}
setInterval(prunePlayers, 15000);

// Visitor heartbeat. Returns live site state + any command for this client.
async function handlePresence(req, res) {
  const body = await readBody(req);
  const id = String(body.id || '').slice(0, 64);
  const nickname = String(body.nickname || 'Guest').slice(0, 40);
  const ip = clientIp(req);
  if (!id) return sendJson(res, 400, { error: 'no id' });

  if (admin.bansByIp[ip]) {
    players.delete(id);
    return sendJson(res, 200, { banned: true });
  }
  const now = Date.now();
  const existing = players.get(id);
  players.set(id, {
    id, nickname, ip,
    location: existing?.location || 'Locating…',
    firstSeen: existing?.firstSeen || now,
    lastSeen: now,
  });
  if (!existing || existing.location === 'Locating…') {
    geoLookup(ip).then((loc) => { const p = players.get(id); if (p) p.location = loc; });
  }
  const kick = admin.kicks[id];
  if (kick) delete admin.kicks[id];
  return sendJson(res, 200, {
    banned: false,
    maintenance: admin.settings.maintenance,
    redirect: admin.settings.redirect || '',
    announcement: admin.settings.announcement || '',
    kick: kick || null,
    broadcast: admin.broadcast || null,
  });
}

// Password-guarded admin control endpoint.
async function handleAdmin(req, res) {
  const body = await readBody(req);
  if (body.password !== ADMIN_PASSWORD) return sendJson(res, 403, { error: 'bad password' });
  const action = body.action;

  if (action === 'state') {
    prunePlayers();
    const list = [...players.values()].sort((a, b) => b.lastSeen - a.lastSeen).map((p) => ({
      id: p.id, nickname: p.nickname, location: p.location, ip: p.ip,
      online: Date.now() - p.lastSeen < PLAYER_TTL,
      since: p.firstSeen,
    }));
    const bans = Object.entries(admin.bansByIp).map(([ip, b]) => ({ ip, nickname: b.nickname, ts: b.ts }));
    return sendJson(res, 200, { settings: admin.settings, players: list, bans, count: list.length });
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
    if (ip) { admin.bansByIp[ip] = { nickname: p?.nickname || 'Unknown', ts: Date.now() }; players.delete(id); await saveState(); }
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
    return sendJson(res, 200, { ok: true });
  }
  if (action === 'broadcast') {
    const text = String(body.text || '').slice(0, 300);
    admin.broadcast = text ? { text, ts: Date.now() } : null;
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
async function proxyUpstream(req, res) {
  const target = UPSTREAM + req.url;
  try {
    const headers = {
      'user-agent': req.headers['user-agent'] || 'Mozilla/5.0',
      'accept': req.headers['accept'] || '*/*',
    };
    if (req.headers['range']) headers['range'] = req.headers['range'];
    const up = await fetch(target, { headers, redirect: 'follow' });
    const outHeaders = {
      'content-type': up.headers.get('content-type') || 'application/octet-stream',
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': '*',
    };
    if (up.status === 206) {
      for (const h of ['content-range', 'accept-ranges']) {
        const v = up.headers.get(h);
        if (v) outHeaders[h] = v;
      }
    }
    if (req.method === 'HEAD') { res.writeHead(up.status, outHeaders); res.end(); return; }
    const buf = Buffer.from(await up.arrayBuffer());
    res.writeHead(up.status, outHeaders);
    res.end(buf);
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Upstream fetch failed');
  }
}

const httpServer = createServer((req, res) => {
  const parsed = new URL(req.url || '/', 'http://localhost');
  const url = parsed.pathname;

  if (url === '/admin' || url === '/admin/') {
    req.url = '/admin/index.html';
    return serve(req, res, () => { res.writeHead(404); res.end('Not found'); });
  }

  // Legal gate — always accepted.
  if (url === '/api/legal/status') return sendJson(res, 200, { accepted: true, needsCaptcha: false, gate: false, version: '1' });
  if (url === '/api/legal/accept') return sendJson(res, 200, { ok: true, accepted: true, version: '1' });

  // Movies (TMDB).
  if (url.startsWith('/api/tmdb/')) return handleTmdb(url.replace(/^\/api\/tmdb/, ''), parsed.searchParams, res);

  // AI (Groq).
  if (url === '/api/generate' && req.method === 'POST') return handleGenerate(req, res);

  // AI conversation history — stubbed so the UI works with local-only history.
  if (url === '/api/ai/conversations' && req.method === 'GET') return sendJson(res, 200, { conversations: [] });
  if (url.startsWith('/api/ai/')) return sendJson(res, 200, { ok: true });

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
});

httpServer.on('upgrade', (req, socket, head) => {
  // Banned IPs can't use the proxy tunnel.
  const ip = clientIp(req);
  if (admin.bansByIp[ip]) { try { socket.destroy(); } catch {} return; }
  wisp.routeRequest(req, socket, head);
});

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Scroll Unblocker running on port ${PORT}`);
});
