// Web push: pop-ups that reach a phone or computer when ScrollHub is closed.
// Keys are made on first start and saved with the admin settings. Subscriptions are saved to durable storage when it is connected.
import * as webpush from 'web-push';
import * as nfs from 'node:fs';

const FILE = '/tmp/scrollhub-push.json';
const KINDS = ['dm', 'friend', 'mention', 'staff'];

export async function createPush(deps) {
  const { admin, saveState, kvGet, kvSet, resolveSession, sendJson, readBody } = deps;
  const subs = new Map();   // uid -> [{ endpoint, keys, ts }]
  const prefs = new Map();  // uid -> { dm, friend, mention, staff }
  let dirty = false;

  try { const raw = (await kvGet('sh:push')) || (nfs.existsSync(FILE) ? nfs.readFileSync(FILE, 'utf8') : ''); if (raw) { const s = JSON.parse(raw); for (const k in s.subs || {}) subs.set(k, s.subs[k]); for (const k in s.prefs || {}) prefs.set(k, s.prefs[k]); } } catch (e) { console.log('push load failed:', e.message); }
  async function flush() {
    if (!dirty) return; dirty = false;
    const body = JSON.stringify({ subs: Object.fromEntries(subs), prefs: Object.fromEntries(prefs) });
    try { nfs.writeFileSync(FILE, body); } catch {}
    try { await kvSet('sh:push', body); } catch { dirty = true; }
  }
  setInterval(flush, 15000).unref();

  let v = (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY } : (admin.settings.vapid || null);
  if (!v || !v.publicKey) { v = webpush.generateVAPIDKeys(); admin.settings.vapid = v; try { await saveState(); } catch {} }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@scrollhub.app', v.publicKey, v.privateKey);

  const pref = (uid) => ({ dm: true, friend: true, mention: true, staff: true, ...(prefs.get(uid) || {}) });
  const lastSent = new Map();
  // Fire and forget. Never throws.
  function send(uid, kind, p) {
    try {
      const list = subs.get(uid); if (!list || !list.length || pref(uid)[kind] === false) return;
      const tag = String(p.tag || kind), key = uid + '|' + tag, now = Date.now();
      if (now - (lastSent.get(key) || 0) < 2500) return; lastSent.set(key, now); if (lastSent.size > 4000) lastSent.clear();
      const body = JSON.stringify({ title: String(p.title || 'ScrollHub').slice(0, 80), body: String(p.body || '').slice(0, 160), url: String(p.url || '/hub/'), tag, kind, icon: '/hub/icon-192.png?v=3' });
      for (const s of list.slice()) {
        webpush.sendNotification(s, body, { TTL: 3600, urgency: kind === 'staff' ? 'normal' : 'high' }).catch((e) => {
          if (e && (e.statusCode === 404 || e.statusCode === 410)) { const cur = (subs.get(uid) || []).filter((x) => x.endpoint !== s.endpoint); if (cur.length) subs.set(uid, cur); else subs.delete(uid); dirty = true; }
        });
      }
    } catch {}
  }

  async function handle(url, req, res) {
    const path = url.split('?')[0];
    if (path === '/api/push/key' && req.method === 'GET') { sendJson(res, 200, { ok: true, key: v.publicKey }); return true; }
    const me = req._auth || await resolveSession(req).catch(() => null);
    if (!me) { sendJson(res, 401, { error: 'signin', message: 'Sign in first.' }); return true; }
    if (path === '/api/push/state' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, count: (subs.get(me.id) || []).length, prefs: pref(me.id), staff: !!me.role }); return true;
    }
    const body = await readBody(req);
    if (path === '/api/push/subscribe' && req.method === 'POST') {
      const s = body.subscription;
      if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 600 || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') { sendJson(res, 400, { error: 'bad', message: 'That device could not be registered.' }); return true; }
      const list = (subs.get(me.id) || []).filter((x) => x.endpoint !== s.endpoint);
      list.unshift({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh.slice(0, 200), auth: s.keys.auth.slice(0, 100) }, ts: Date.now() });
      subs.set(me.id, list.slice(0, 5)); dirty = true;
      sendJson(res, 200, { ok: true }); return true;
    }
    if (path === '/api/push/unsubscribe' && req.method === 'POST') {
      const ep = String(body.endpoint || ''); const cur = (subs.get(me.id) || []).filter((x) => x.endpoint !== ep);
      if (cur.length) subs.set(me.id, cur); else subs.delete(me.id); dirty = true; sendJson(res, 200, { ok: true }); return true;
    }
    if (path === '/api/push/prefs' && req.method === 'POST') {
      const p = pref(me.id); for (const k of KINDS) if (typeof body[k] === 'boolean') p[k] = body[k];
      prefs.set(me.id, p); dirty = true; sendJson(res, 200, { ok: true, prefs: p }); return true;
    }
    if (path === '/api/push/test' && req.method === 'POST') {
      if (!(subs.get(me.id) || []).length) { sendJson(res, 200, { error: 'none', message: 'Turn pop-ups on for this device first.' }); return true; }
      lastSent.delete(me.id + '|test'); send(me.id, 'dm', { title: 'ScrollHub', body: 'Pop-ups are working. You will see messages and requests like this.', url: '/hub/', tag: 'test' });
      sendJson(res, 200, { ok: true }); return true;
    }
    return false;
  }
  return { send, handle, publicKey: v.publicKey, flush };
}
