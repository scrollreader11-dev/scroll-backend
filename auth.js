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
function summarize(a) { return { username: a.username, id: a.id, createdAt: a.createdAt || 0, lastSeen: a.lastSeen || 0, role: isOwnerName(a.username) ? 'owner' : (a.role === 'coowner' ? 'coowner' : a.role === 'mod' ? 'mod' : null), ban: accountBan(a) }; }
function patchList(a) { // keep the cached all-accounts list fresh without rescanning
  if (!scanList) return;
  const i = scanList.findIndex((x) => x.username.toLowerCase() === a.username.toLowerCase());
  if (i >= 0) scanList[i] = summarize(a); else scanList.push(summarize(a));
}
async function putAccount(acct) {
  acctCache.set(acct.username.toLowerCase(), acct); patchList(acct);
  try { await kvSet(userKey(acct.username), JSON.stringify(acct)); } catch (e) {}
}

async function createSession(acct) {
  const token = crypto.randomBytes(24).toString('hex');
  const sess = { id: acct.id, username: acct.username, iat: Date.now(), exp: Date.now() + SESSION_MS };
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
  // A staff "reset token" stamps the account; sessions issued before that moment stop working.
  try {
    const a = await getAccount(s.username);
    const iat = s.iat || ((s.exp || 0) - SESSION_MS);
    if (a && a.revokedBefore && iat <= a.revokedBefore) { sessions.delete(token); try { await kvDel(sessKey(token)); } catch (e) {} return null; }
    if (a && banActive(a)) return null; // account banned by staff
    if (a && Date.now() - (a.lastSeen || 0) > 15 * 60 * 1000) { a.lastSeen = Date.now(); putAccount(a).catch(() => {}); }
  } catch (e) {}
  return s;
}

function banActive(a) { return !!(a && a.ban && (a.ban.until === 0 || a.ban.until > Date.now())); }
// Account-level ban (works on offline players). until: ms timestamp, 0 = permanent. Pass null to lift.
export async function setAccountBan(username, ban) {
  const a = await accountByName(username);
  if (!a) return null;
  if (ban) { a.ban = { until: ban.until || 0, reason: String(ban.reason || '').slice(0, 120), by: String(ban.by || ''), ts: Date.now() }; a.revokedBefore = Date.now(); for (const [tok, sess] of sessions) if (sess.username.toLowerCase() === a.username.toLowerCase()) sessions.delete(tok); }
  else delete a.ban;
  await putAccount(a);
  return a;
}
export function accountBan(a) { return banActive(a) ? { until: a.ban.until, reason: a.ban.reason || '', by: a.ban.by || '' } : null; }

// ---- staff roles ----
// Owners are fixed by username (plus anything listed in the OWNER_NAMES env var).
// Mods and co-owners are stored on the account and can only be granted or removed by the owner.
const OWNER_NAMES = new Set(['scrollreader11'].concat(String(process.env.OWNER_NAMES || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)));
export function isOwnerName(username) { return OWNER_NAMES.has(String(username || '').toLowerCase()); }
export async function roleForName(username) {
  if (isOwnerName(username)) return 'owner';
  const a = await getAccount(username);
  return a && a.role === 'coowner' ? 'coowner' : a && a.role === 'mod' ? 'mod' : null;
}
export async function setRole(username, role) {
  const a = await accountByName(username);
  if (!a) return null;
  if (isOwnerName(a.username)) return a;
  if (role === 'mod' || role === 'coowner') a.role = role; else delete a.role;
  await putAccount(a);
  return a;
}
// Stops every existing login of this account from working (they will have to sign in again).
export async function revokeSessions(username) {
  const a = await accountByName(username);
  if (!a) return false;
  a.revokedBefore = Date.now();
  await putAccount(a);
  for (const [tok, sess] of sessions) if (sess.username.toLowerCase() === a.username.toLowerCase()) sessions.delete(tok);
  return true;
}
// Staff list + name search. Names are indexed as accounts sign up or log in.
const knownNames = new Map(); // lower -> username
let namesLoaded = false;
async function loadNames() {
  if (namesLoaded) return; namesLoaded = true;
  try { const raw = await kvGet('sh:acctnames'); if (raw) JSON.parse(raw).forEach((n) => knownNames.set(String(n).toLowerCase(), n)); } catch (e) {}
}
let namesTimer = null;
function indexName(username) {
  const k = String(username).toLowerCase();
  if (knownNames.has(k)) return;
  knownNames.set(k, username);
  clearTimeout(namesTimer);
  namesTimer = setTimeout(() => { kvSet('sh:acctnames', JSON.stringify([...knownNames.values()])).catch(() => {}); }, 3000);
}
export async function searchNames(q, limit) {
  await loadNames();
  q = String(q || '').toLowerCase().trim();
  const out = [];
  for (const [k, n] of knownNames) { if (!q || k.includes(q)) out.push(n); if (out.length >= (limit || 20)) break; }
  return out;
}
// Every account (online or not). With KV we SCAN the account keys once and cache the result briefly.
let scanAt = 0, scanList = null, scanning = null;
async function scanAccounts() {
  const out = new Map();
  if (kvEnabled) {
    let cursor = '0', keys = [], guard = 0;
    do {
      const r = await kv(['SCAN', cursor, 'MATCH', 'sh:acct:*', 'COUNT', 500]);
      if (!r) break; cursor = String(r[0]); keys = keys.concat(r[1] || []);
    } while (cursor !== '0' && ++guard < 400);
    for (let i = 0; i < keys.length; i += 100) {
      const vals = await kv(['MGET'].concat(keys.slice(i, i + 100)));
      (vals || []).forEach((raw) => { if (!raw) return; try { const a = JSON.parse(raw); if (a && a.username) out.set(a.username.toLowerCase(), a); } catch (e) {} });
    }
  }
  for (const [k, a] of acctCache) out.set(k, a); // freshest copies win
  return out;
}
export async function allAccounts(force) {
  if (!force && scanList && Date.now() - scanAt < 45000) return scanList;
  if (!scanning) scanning = scanAccounts().then((m) => {
    scanList = [...m.values()].map(summarize);
    scanList.forEach((a) => indexName(a.username)); scanAt = Date.now(); return scanList;
  }).finally(() => { scanning = null; });
  return scanning;
}
export function invalidateAccounts() { scanAt = 0; }
export async function listStaff() {
  await loadNames();
  const out = [];
  for (const n of OWNER_NAMES) out.push({ username: knownNames.get(n) || n, role: 'owner' });
  for (const n of knownNames.values()) { if (isOwnerName(n)) continue; const a = await getAccount(n); if (a && (a.role === 'mod' || a.role === 'coowner')) out.push({ username: a.username, role: a.role }); }
  return out;
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

// Look up an account by username (for admin give/take by name). Returns the
// account object ({ id, username, ... }) or null.
export async function accountByName(username) {
  if (!USER_RE.test(normUser(username))) return null;
  return await getAccount(username);
}

// Pull the session token from (in order) an Authorization: Bearer header, an
// x-sh-token header, or the sh_sid cookie. The header forms let a ScrollHub
// frontend on ANY domain authenticate against this central backend, since
// cross-site cookies are unreliable/blocked by browsers.
function tokenFromReq(req) {
  const h = String(req.headers['authorization'] || '');
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  const x = req.headers['x-sh-token'];
  if (x) return String(x).trim();
  const c = parseCookies(req);
  return c.sh_sid || '';
}

// Trusted identity for the current request, or null if not logged in.
export async function resolveSession(req) {
  const s = await loadSession(tokenFromReq(req));
  if (!s) return null;
  indexName(s.username);
  return { id: s.id, username: s.username, role: await roleForName(s.username) };
}

// Identity straight from a token string (used by the WebSocket upgrade, which
// passes the token as a ?t= query param).
export async function sessionFromToken(token) {
  const s = await loadSession(token);
  if (!s) return null;
  return { id: s.id, username: s.username, role: await roleForName(s.username) };
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
    sendJson(res, 200, s ? { loggedIn: true, username: s.username, id: s.id, role: s.role || null } : { loggedIn: false });
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
    await putAccount(acct); indexName(acct.username);
    const token = await createSession(acct);
    // token is returned so cross-domain frontends can store it (header auth).
    sendJson(res, 200, { ok: true, username: acct.username, id: acct.id, token }, authCookies(acct, token));
    return true;
  }

  if (path === '/api/auth/login' && req.method === 'POST') {
    const body = await readBody(req);
    const username = normUser(body.username);
    const password = String(body.password || '');
    const acct = await getAccount(username);
    if (!acct || !verifyPassword(acct, password)) { sendJson(res, 200, { error: 'bad-login', message: 'Wrong username or password.' }); return true; }
    if (banActive(acct)) { sendJson(res, 200, { error: 'banned', message: 'This account is banned' + (acct.ban.until ? ' until ' + new Date(acct.ban.until).toLocaleString('en-US') : '') + (acct.ban.reason ? ': ' + acct.ban.reason : '.') }); return true; }
    indexName(acct.username);
    acct.lastSeen = Date.now(); putAccount(acct).catch(() => {});
    const token = await createSession(acct);
    sendJson(res, 200, { ok: true, username: acct.username, id: acct.id, token }, authCookies(acct, token));
    return true;
  }

  if (path === '/api/auth/change-password' && req.method === 'POST') {
    const s = await resolveSession(req);
    if (!s) return (sendJson(res, 200, { error: 'login', message: 'Log in first.' }), true);
    const body = await readBody(req);
    const cur = String(body.current || ''); const nw = String(body.new || '');
    const acct = await getAccount(s.username);
    if (!acct || !verifyPassword(acct, cur)) return (sendJson(res, 200, { error: 'bad-current', message: 'Your current password is wrong.' }), true);
    if (nw.length < 6 || nw.length > 100) return (sendJson(res, 200, { error: 'bad-password', message: 'New password must be at least 6 characters.' }), true);
    acct.salt = crypto.randomBytes(16).toString('hex');
    acct.hash = hashPassword(nw, acct.salt);
    await putAccount(acct);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (path === '/api/auth/logout' && req.method === 'POST') {
    const tok = tokenFromReq(req);
    if (tok) { sessions.delete(tok); try { await kvDel(sessKey(tok)); } catch (e) {} }
    sendJson(res, 200, { ok: true }, clearCookies());
    return true;
  }

  sendJson(res, 404, { error: 'unknown' });
  return true;
}
