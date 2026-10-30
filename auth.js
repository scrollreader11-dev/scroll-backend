// ============================================================
// ScrollHub Auth — username/password accounts with durable sessions.
// Accounts and sessions live in Upstash KV so they survive redeploys
// and move with the data if the site is ever rehosted.
// Identity for the rest of the app is derived from the signed session
// cookie (sh_sid), so sh_cid/sh_nick can no longer be forged.
// ============================================================
import crypto from 'node:crypto';

const KV_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const KV_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const kvEnabled = !!(KV_URL && KV_TOKEN);
async function kv(cmd) {
  if (!kvEnabled) return null;
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('kv ' + r.status);
  const j = await r.json();
  return j ? j.result : null;
}
async function kvGet(k) { const v = await kv(['GET', k]); return typeof v === 'string' ? v : null; }
async function kvSet(k, v) { await kv(['SET', k, v]); }
async function kvDel(k) { await kv(['DEL', k]); }

// ---- in-memory caches (KV is the source of truth) ----
const sessions = new Map(); // token -> { id, username, exp }
const acctCache = new Map(); // usernameLower -> account

const SESSION_MS = 120 * 24 * 3600 * 1000; // ~4 months
const USER_RE = /^[a-zA-Z0-9_]{3,20}$/;

function normUser(u) { return String(u || '').trim(); }
function userKey(u) { return 'sh:acct:' + normUser(u).toLowerCase(); }
function sessKey(t) { return 'sh:sess:' + t; }

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function makeAccount(username, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return {
    id: 'u_' + crypto.randomBytes(10).toString('hex'),
    username: normUser(username),
    salt,
    hash: hashPassword(password, salt),
    createdAt: Date.now(),
  };
}
function verifyPassword(acct, password) {
  try {
    const h = hashPassword(password, acct.salt);
    const a = Buffer.from(h, 'hex'), b = Buffer.from(acct.hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

async function getAccount(username) {
  const key = normUser(username).toLowerCase();
  if (acctCache.has(key)) return acctCache.get(key);
  try { const raw = await kvGet(userKey(username)); if (raw) { const a = JSON.parse(raw); acctCache.set(key, a); return a; } } catch (e) {}
  return null;
}
async function putAccount(acct) {
  acctCache.set(acct.username.toLowerCase(), acct);
  try { await kvSet(userKey(acct.username), JSON.stringify(acct)); } catch (e) {}
}

async function createSession(acct) {
  const token = crypto.randomBytes(24).toString('hex');
  const sess = { id: acct.id, username: acct.username, exp: Date.now() + SESSION_MS };
  sessions.set(token, sess);
  try { await kvSet(sessKey(token), JSON.stringify(sess)); } catch (e) {}
  return token;
}
async function loadSession(token) {
  if (!token) return null;
  let s = sessions.get(token);
  if (!s) {
    try { const raw = await kvGet(sessKey(token)); if (raw) { s = JSON.parse(raw); sessions.set(token, s); } } catch (e) {}
  }
  if (!s) return null;
  if (s.exp && Date.now() > s.exp) { sessions.delete(token); try { await kvDel(sessKey(token)); } catch (e) {} return null; }
  return s;
}

// ---- cookies ----
function parseCookies(req) {
  const out = {}; const h = req.headers.cookie || '';
  h.split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return out;
}
function cookieStr(name, value, maxAgeSec, httpOnly) {
  let s = name + '=' + value + ';Path=/;Max-Age=' + maxAgeSec + ';SameSite=Lax';
  if (httpOnly) s += ';HttpOnly';
  return s;
}
// Set sh_sid (HttpOnly, trusted) plus sh_cid/sh_nick mirrors that client
// scripts read for display. Only sh_sid is trusted on the server.
function authCookies(acct, token) {
  const age = Math.floor(SESSION_MS / 1000);
  return [
    cookieStr('sh_sid', token, age, true),
    cookieStr('sh_cid', acct.id, age, false),
    cookieStr('sh_nick', encodeURIComponent(acct.username), age, false),
  ];
}
function clearCookies() {
  return ['sh_sid', 'sh_cid', 'sh_nick'].map((n) => n + '=;Path=/;Max-Age=0;SameSite=Lax');
}

// Trusted identity for the current request, or null if not logged in.
export async function resolveSession(req) {
  const c = parseCookies(req);
  const s = await loadSession(c.sh_sid);
  if (!s) return null;
  return { id: s.id, username: s.username };
}

function sendJson(res, code, obj, cookies) {
  const headers = { 'Content-Type': 'application/json', 'cache-control': 'no-store' };
  if (cookies && cookies.length) headers['Set-Cookie'] = cookies;
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e4) req.destroy(); }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); });
}

// ============================================================
// Router — returns true if it handled the request.
// ============================================================
export async function handleAuth(url, req, res) {
  const path = url.split('?')[0];
  if (!path.startsWith('/api/auth/')) return false;

  if (path === '/api/auth/me') {
    const s = await resolveSession(req);
    sendJson(res, 200, s ? { loggedIn: true, username: s.username, id: s.id } : { loggedIn: false });
    return true;
  }

  if (path === '/api/auth/signup' && req.method === 'POST') {
    const body = await readBody(req);
    const username = normUser(body.username);
    const password = String(body.password || '');
    if (!USER_RE.test(username)) { sendJson(res, 200, { error: 'bad-username', message: '3–20 letters, numbers or underscores.' }); return true; }
    if (password.length < 6 || password.length > 100) { sendJson(res, 200, { error: 'bad-password', message: 'Password must be at least 6 characters.' }); return true; }
    const existing = await getAccount(username);
    if (existing) { sendJson(res, 200, { error: 'taken', message: 'That username is taken.' }); return true; }
    const acct = makeAccount(username, password);
    await putAccount(acct);
    const token = await createSession(acct);
    sendJson(res, 200, { ok: true, username: acct.username, id: acct.id }, authCookies(acct, token));
    return true;
  }

  if (path === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const username = normUser(body.username);
    const password = String(body.password || '');
    const acct = await getAccount(username);
    if (!acct || !verifyPassword(acct, password)) { sendJson(res, 200, { error: 'bad-login', message: 'Wrong username or password.' }); return true; }
    const token = await createSession(acct);
    sendJson(res, 200, { ok: true, username: acct.username, id: acct.id }, authCookies(acct, token));
    return true;
  }

  if (path === '/api/auth/logout' && req.method === 'POST') {
    const c = parseCookies(req);
    if (c.sh_sid) { sessions.delete(c.sh_sid); try { await kvDel(sessKey(c.sh_sid)); } catch (e) {} }
    sendJson(res, 200, { ok: true }, clearCookies());
    return true;
  }

  sendJson(res, 404, { error: 'unknown' });
  return true;
}
