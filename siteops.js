// Site operations: sitewide news, public status, browser error reports, rate limits, and mod applications.
// server.js hands this module the pieces it needs (settings, saving, sessions); nothing here touches game state.

const DAY = 86400000;
const TAGS = ['new', 'fix', 'event', 'info'];

const DEFAULT_NEWS = [
  { id: 'n-news', ts: Date.UTC(2026, 10, 26, 18), tag: 'new', title: 'One What\'s New page for the whole site', body: 'News from ScrollHub and the casino now lives in one place. The little board in the casino lobby shows the same list.' },
  { id: 'n-apply', ts: Date.UTC(2026, 10, 26, 18), tag: 'new', title: 'Apply to be a moderator', body: 'Want to help run ScrollHub? Open your profile menu and choose Apply to be a mod. Tell us how you plan to contribute. Every application gets read.' },
  { id: 'n-report', ts: Date.UTC(2026, 10, 26, 18), tag: 'new', title: 'Report button and status page', body: 'Report a player or a problem from the profile menu. The Status page shows whether games are up.' },
  { id: 'n-app', ts: Date.UTC(2026, 10, 26, 18), tag: 'new', title: 'Install ScrollHub as an app', body: 'Use Install app in the profile menu. The hub opens like an app and shows a friendly page when you are offline.' },
  { id: 'n-hs', ts: Date.UTC(2026, 10, 24, 18), tag: 'new', title: 'Arcade high scores', body: 'A board in the casino Arcade shows the best round per game. Press E on it for every top ten.' },
  { id: 'n-duel', ts: Date.UTC(2026, 10, 24, 18), tag: 'new', title: 'Duel board', body: 'See every open duel on the casino floor from one board.' },
  { id: 'n-bar', ts: Date.UTC(2026, 10, 22, 18), tag: 'fix', title: 'Bartender serves drinks', body: 'Order at the casino bar and the bartender really pours it.' },
  { id: 'n-phone', ts: Date.UTC(2026, 10, 22, 18), tag: 'fix', title: 'Casino phone layout', body: 'The casino buttons no longer run off the edge of small screens.' },
  { id: 'n-world', ts: Date.UTC(2026, 10, 20, 18), tag: 'new', title: 'Games hub world', body: 'A much bigger world with eight regions, signposts and a minimap (M).' },
];

const GAME_NAMES = [['bw', 'Bedwars'], ['race', 'Scroll Racing'], ['royale', 'Scroll Royale'], ['ctf', 'Capture the Flag'], ['spleef', 'TNT Spleef'], ['hide', 'Prop Hunt'], ['duel', 'Duels'], ['murder', 'Murder Mystery'], ['build', 'Build Battle'], ['casino', 'Casino']];

export const APP_QUESTIONS = [
  { id: 'discord', label: 'Your Discord username', hint: 'So we can reach you if you are accepted.', min: 2, max: 40, kind: 'line' },
  { id: 'online', label: 'When are you usually online?', hint: 'Days, hours and your time zone.', min: 5, max: 160, kind: 'line' },
  { id: 'why', label: 'Why do you want to be a mod?', hint: '', min: 30, max: 700, kind: 'text' },
  { id: 'plan', label: 'How do you plan to contribute?', hint: 'Be specific: what will you do each week to help ScrollHub?', min: 30, max: 700, kind: 'text' },
  { id: 'exp', label: 'Have you moderated or helped run a server or community before?', hint: 'Optional. Say where and what you did.', min: 0, max: 500, kind: 'text' },
  { id: 'spam', label: 'A player keeps spamming chat after being asked to stop. What do you do?', hint: '', min: 20, max: 500, kind: 'text' },
  { id: 'friend', label: 'A friend of yours breaks a rule. What do you do?', hint: '', min: 20, max: 500, kind: 'text' },
  { id: 'extra', label: 'Anything else we should know?', hint: 'Optional.', min: 0, max: 500, kind: 'text' },
];

const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\r/g, '').trim().slice(0, n);

export function createSiteOps(ctx) {
  const { admin, saveState, resolveSession, sendJson, readBody, clientIp, audit, logEvent } = ctx;
  const st = () => admin.settings;

  // ------------------------------------------------------------ rate limits
  const hits = new Map();
  function tooMany(key, max, windowMs) {
    const now = Date.now(); let a = hits.get(key);
    if (!a) { a = []; hits.set(key, a); }
    while (a.length && a[0] <= now - windowMs) a.shift();
    if (a.length >= max) return Math.max(1, Math.ceil((a[0] + windowMs - now) / 1000));
    a.push(now); return 0;
  }
  setInterval(() => { const cut = Date.now() - 3600000; for (const [k, a] of hits) { if (!a.length || a[a.length - 1] < cut) hits.delete(k); } }, 300000).unref();
  const who = (req) => clientIp(req) + '|' + String(req.headers['authorization'] || req.headers['x-sh-token'] || '').slice(-20);
  const RULES = [
    ['POST', '/api/auth/signup', 'signup', 30, 3600000, 'ip', 'Too many accounts were made from this network. Try again in a little while.'],
    ['POST', '/api/auth/login', 'login', 60, 600000, 'ip', 'Too many sign-in tries. Wait a bit and try again.'],
    ['POST', '/api/chat/send', 'chat', 45, 60000, 'who', 'You are sending messages too fast. Slow down for a moment.'],
    ['POST', '/api/dm/send', 'dm', 45, 60000, 'who', 'You are sending messages too fast. Slow down for a moment.'],
    ['POST', '/api/social/report', 'report', 8, 600000, 'who', 'You have sent a lot of reports. Give us a little while to read them.'],
    ['POST', '/api/friends/add', 'friend', 30, 600000, 'who', 'Too many friend requests. Try again in a few minutes.'],
    ['POST', '/api/apply', 'apply', 4, 3600000, 'who', 'You already sent an application a moment ago.'],
    ['POST', '/api/client-error', 'cerr', 20, 60000, 'ip', 'Slow down.'],
  ];
  // Returns true (and answers 429) when this request is over its limit.
  function guard(req, res, url) {
    for (const r of RULES) {
      if (req.method !== r[0] || url !== r[1]) continue;
      const wait = tooMany(r[2] + '|' + (r[5] === 'ip' ? clientIp(req) : who(req)), r[3], r[4]);
      if (!wait) return false;
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(wait), 'cache-control': 'no-store' });
      res.end(JSON.stringify({ error: 'rate', message: r[6], retryAfter: wait }));
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ news
  function newsList() {
    if (!Array.isArray(st().news)) st().news = DEFAULT_NEWS.map((n) => ({ ...n, by: 'ScrollHub' }));
    return st().news;
  }

  // ------------------------------------------------------------ browser errors (memory only)
  const errs = new Map();
  function noteError(b, ip) {
    const msg = clean(b.msg, 240); if (!msg || /^script error\.?$/i.test(msg)) return false;
    const src = clean(b.src, 160).replace(/^https?:\/\/[^/]+/, ''), line = parseInt(b.line, 10) || 0;
    const key = msg.slice(0, 120) + '|' + src + '|' + line, now = Date.now();
    let e = errs.get(key);
    if (!e) { if (errs.size >= 150) { const old = [...errs.entries()].sort((a, c) => a[1].last - c[1].last)[0]; if (old) errs.delete(old[0]); } e = { key, msg, src, line, col: parseInt(b.col, 10) || 0, stack: clean(b.stack, 900), page: clean(b.page, 120), count: 0, first: now, last: now, ips: new Set() }; errs.set(key, e); }
    e.count++; e.last = now; e.page = clean(b.page, 120) || e.page; if (e.ips.size < 200) e.ips.add(ip);
    return true;
  }

  // ------------------------------------------------------------ mod applications
  const apps = () => { if (!Array.isArray(st().modApps)) st().modApps = []; return st().modApps; };
  const appsOpen = () => st().appsOpen !== false;
  function ping(text) {
    const url = process.env.APPLICATIONS_WEBHOOK_URL || process.env.SUBMISSIONS_WEBHOOK_URL;
    if (!url || !/^https:\/\//.test(url)) return;
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: String(text).replace(/[@`]/g, '').slice(0, 400) }), signal: ctl.signal }).catch(() => {}).finally(() => clearTimeout(t));
  }

  // ------------------------------------------------------------ public routes
  async function handle(url, req, res) {
    if (url === '/api/news' && req.method === 'GET') {
      const l = newsList().slice().sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || b.ts - a.ts).slice(0, 40);
      res.writeHead(200, { 'Content-Type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, news: l.map((n) => ({ id: n.id, ts: n.ts, tag: n.tag, title: n.title, body: n.body, pin: !!n.pin })) }));
      return true;
    }
    if (url === '/api/status' && req.method === 'GET') {
      const off = st().gamesOff || {}, now = Date.now();
      const maint = !!st().maintenance;
      const services = [{ id: 'site', name: 'ScrollHub website', state: maint ? 'maint' : 'up' }];
      for (const [k, n] of GAME_NAMES) services.push({ id: k, name: n, state: maint ? 'maint' : off[k] ? 'off' : 'up' });
      const hourAgo = now - 3600000; let recent = 0; for (const e of errs.values()) if (e.last > hourAgo) recent += e.count;
      const online = ctx.onlineCount ? ctx.onlineCount() : 0;
      res.writeHead(200, { 'Content-Type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, now, uptimeSec: Math.round(process.uptime()), maintenance: maint, online, durable: !!ctx.durable, errorsLastHour: recent, services, announcement: st().announcement || '' }));
      return true;
    }
    if (url === '/api/client-error' && req.method === 'POST') {
      const b = await readBody(req); noteError(b, clientIp(req));
      res.writeHead(204); res.end(); return true;
    }
    if (url === '/api/apply' && req.method === 'GET') {
      let me = null; try { me = await resolveSession(req); } catch (e) {}
      const mine = me ? apps().filter((a) => a.user.toLowerCase() === me.username.toLowerCase()).sort((a, b) => b.ts - a.ts)[0] : null;
      sendJson(res, 200, { ok: true, open: appsOpen(), signedIn: !!me, isStaff: !!(me && me.role), questions: APP_QUESTIONS, mine: mine ? { status: mine.status, ts: mine.ts, decidedAt: mine.decidedAt || 0, note: mine.status === 'pending' ? '' : (mine.note || '') } : null });
      return true;
    }
    if (url === '/api/apply' && req.method === 'POST') {
      let me = null; try { me = await resolveSession(req); } catch (e) {}
      if (!me) { sendJson(res, 401, { error: 'signin', message: 'Sign in to your ScrollHub account to apply.' }); return true; }
      if (me.role) { sendJson(res, 200, { error: 'staff', message: 'You are already on the team.' }); return true; }
      if (!appsOpen()) { sendJson(res, 200, { error: 'closed', message: 'Applications are closed right now. Check back soon.' }); return true; }
      const body = await readBody(req), a = (body && body.answers) || {}, list = apps(), now = Date.now();
      const mine = list.filter((x) => x.user.toLowerCase() === me.username.toLowerCase()).sort((x, y) => y.ts - x.ts)[0];
      if (mine && mine.status === 'pending') { sendJson(res, 200, { error: 'pending', message: 'You already have an application waiting. We will get to it.' }); return true; }
      if (mine && mine.status === 'denied' && now - (mine.decidedAt || mine.ts) < 7 * DAY) { sendJson(res, 200, { error: 'wait', message: 'You can apply again 7 days after your last answer.' }); return true; }
      const answers = {};
      for (const q of APP_QUESTIONS) {
        const v = clean(a[q.id], q.max);
        if (v.length < q.min) { sendJson(res, 200, { error: 'short', field: q.id, message: q.min <= 5 ? 'Please answer: ' + q.label : 'Write a bit more for "' + q.label + '" (at least ' + q.min + ' characters).' }); return true; }
        if (v) answers[q.id] = v;
      }
      const rec = { id: 'a' + now.toString(36) + Math.floor(Math.random() * 1296).toString(36), user: me.username, ts: now, answers, status: 'pending', note: '', by: '', decidedAt: 0 };
      list.unshift(rec);
      if (list.length > 300) { for (let i = list.length - 1; i >= 0 && list.length > 300; i--) if (list[i].status !== 'pending') list.splice(i, 1); }
      try { logEvent('apply', me.username, 'mod application'); } catch (e) {}
      ping('New mod application from ' + me.username + '. Read it in Admin tools > Mod applications.');
      await saveState().catch(() => {});
      sendJson(res, 200, { ok: true });
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ staff actions (called from handleStaff)
  async function staff(action, body, w) {
    const top = w.role === 'owner' || w.role === 'coowner';
    const no = { error: 'owner only', message: 'Only the owner or a co-owner can do that.' };
    if (action === 'errors.list') {
      return { ok: true, items: [...errs.values()].sort((a, b) => b.last - a.last).slice(0, 80).map((e) => ({ msg: e.msg, src: e.src, line: e.line, col: e.col, stack: e.stack, page: e.page, count: e.count, first: e.first, last: e.last, people: e.ips.size })) };
    }
    if (action === 'errors.clear') { if (!top) return no; errs.clear(); audit(w, 'errors.clear', '', 'cleared browser error reports'); return { ok: true }; }
    if (action === 'news.save') {
      if (!top) return no;
      const title = clean(body.title, 80), text = clean(body.body, 600), tag = TAGS.includes(body.tag) ? body.tag : 'info';
      if (title.length < 3) return { error: 'short', message: 'Give it a title.' };
      const l = newsList(); let n = body.id ? l.find((x) => x.id === String(body.id)) : null;
      if (n) { n.title = title; n.body = text; n.tag = tag; n.pin = !!body.pin; audit(w, 'news.save', n.id, 'edited: ' + title); }
      else { n = { id: 'n' + Date.now().toString(36), ts: Date.now(), tag, title, body: text, pin: !!body.pin, by: w.username }; l.unshift(n); if (l.length > 80) l.length = 80; audit(w, 'news.save', n.id, 'posted: ' + title); }
      await saveState().catch(() => {}); return { ok: true, id: n.id };
    }
    if (action === 'news.delete') {
      if (!top) return no; const l = newsList(), i = l.findIndex((x) => x.id === String(body.id));
      if (i < 0) return { error: 'gone', message: 'That post is already gone.' };
      audit(w, 'news.delete', l[i].id, l[i].title); l.splice(i, 1); await saveState().catch(() => {}); return { ok: true };
    }
    if (action === 'apps.list') {
      if (!top) return no;
      return { ok: true, open: appsOpen(), questions: APP_QUESTIONS, items: apps().slice().sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.ts - a.ts).slice(0, 120) };
    }
    if (action === 'apps.open') { if (!top) return no; st().appsOpen = !!body.open; audit(w, 'apps.open', '', st().appsOpen ? 'applications opened' : 'applications closed'); await saveState().catch(() => {}); return { ok: true, open: st().appsOpen }; }
    if (action === 'apps.decide') {
      if (!top) return no; const a = apps().find((x) => x.id === String(body.id));
      if (!a) return { error: 'gone', message: 'That application is gone.' };
      const s = ['accepted', 'denied', 'waitlist', 'pending'].includes(body.status) ? body.status : null; if (!s) return { error: 'bad', message: 'Pick a decision.' };
      a.status = s; a.note = clean(body.note, 300); a.by = w.username; a.decidedAt = s === 'pending' ? 0 : Date.now();
      audit(w, 'apps.decide', a.user, s + (a.note ? ': ' + a.note : '')); await saveState().catch(() => {}); return { ok: true };
    }
    if (action === 'apps.delete') {
      if (!top) return no; const l = apps(), i = l.findIndex((x) => x.id === String(body.id));
      if (i < 0) return { ok: true }; audit(w, 'apps.delete', l[i].user, 'deleted application'); l.splice(i, 1); await saveState().catch(() => {}); return { ok: true };
    }
    return { error: 'unknown', message: 'Unknown action.' };
  }

  return { guard, handle, staff, newsList, appsOpen };
}
