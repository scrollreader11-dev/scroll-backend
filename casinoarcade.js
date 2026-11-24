/* Scrolls Casino: the Arcade. Three skill games that pay a little for being good. Nothing is wagered.
   The server runs every round (sequences, targets, questions) and checks every answer, so the browser only draws.
   Pay is deliberately small: a per-play ceiling, a daily ceiling, and a halving once a player has earned a lot today. */
import crypto from 'crypto';

const rnd = (n) => crypto.randomInt(n);
export const ARCADE_GAMES = ['echo', 'aim', 'math'];
export const ARC = { perPlay: 400, softCap: 3000, dayCap: 5000, idleMs: 10 * 60 * 1000 };
const sessions = new Map();   // cid -> the round in progress (kept in memory; a restart just ends it)

const day = () => new Date().toISOString().slice(0, 10);
function acct(p) {
  if (!p.arc || typeof p.arc !== 'object') p.arc = { day: '', earned: 0, plays: 0, best: {} };
  if (p.arc.day !== day()) { p.arc.day = day(); p.arc.earned = 0; p.arc.plays = 0; }
  if (!p.arc.best) p.arc.best = {};
  return p.arc;
}
function view(env) { const a = acct(env.p); return { earnedToday: a.earned, dayCap: ARC.dayCap, left: Math.max(0, ARC.dayCap - a.earned), perPlay: ARC.perPlay, halved: a.earned >= ARC.softCap, best: { ...a.best } }; }
function gate(env) {
  const cfg = env.cfg();
  if (cfg.closed) return { error: 'closed', message: 'The casino is closed for now.' };
  const g = (cfg.games && cfg.games.arcade) || {};
  if (g.off) return { error: 'disabled', message: 'The Arcade is switched off right now.' };
  return null;
}
// Pays for what was just earned, never past the play ceiling or the daily ceiling.
function award(env, s, raw) {
  const a = acct(env.p);
  let n = Math.floor(raw * (a.earned >= ARC.softCap ? 0.5 : 1));
  n = Math.max(0, Math.min(n, ARC.perPlay - s.earned, ARC.dayCap - a.earned));
  if (n > 0) {
    env.p.coins += n; a.earned += n; s.earned += n;
    if (env.p.coins > (env.p.stats.peak || 0)) env.p.stats.peak = env.p.coins;
    if (!s.counted) { s.counted = true; a.plays++; try { env.quest && env.quest('arcade'); } catch (e) {} }
  }
  return n;
}
function best(env, game, score) { const a = acct(env.p); if (score > (a.best[game] || 0)) a.best[game] = score; }
const reply = (env, s, extra) => ({ ok: true, ...extra, paid: s ? s.earned : 0, ...view(env), profile: env.publicProfile() });

// ---------------------------------------------------------------- echo (memory)
const echoPay = (round) => 8 + 2 * round;
// ---------------------------------------------------------------- aim (reaction)
const AIM_N = 20, AIM_LIFE = 2000;
function aimTarget(i) { return { x: 9 + rnd(82), y: 12 + rnd(76), r: Math.max(4.2, 8 - i * 0.2) }; }
// ---------------------------------------------------------------- math (speed)
const MATH_MS = 45000;
function mathQ(level) {
  const r = (a, b) => a + rnd(b - a + 1);
  let a, b, op, ans;
  if (level <= 1) { a = r(2, 12); b = r(2, 12); op = '+'; ans = a + b; }
  else if (level === 2) { a = r(12, 60); b = r(5, 40); if (rnd(2)) { op = '+'; ans = a + b; } else { op = '−'; if (b > a) [a, b] = [b, a]; ans = a - b; } }
  else if (level === 3) { a = r(3, 9); b = r(3, 9); op = '×'; ans = a * b; }
  else if (level === 4) { a = r(6, 12); b = r(6, 12); op = '×'; ans = a * b; }
  else { a = r(11, 19); b = r(4, 9); op = '×'; ans = a * b; }
  return { q: a + ' ' + op + ' ' + b, ans };
}

export function handleArcade(path, body, env) {
  const m = path.match(/^\/api\/casino\/g\/arcade(?:\/([a-z]+))?$/); if (!m) return null;
  const act = m[1] || 'info', cid = env.cid;
  for (const [k, v] of sessions) if (Date.now() - v.at > ARC.idleMs) sessions.delete(k);
  if (act === 'info') return { ok: true, games: ARCADE_GAMES, ...view(env), profile: env.publicProfile() };
  const g = gate(env); if (g) return g;
  let s = sessions.get(cid);

  if (act === 'start') {
    const game = String(body.game || ''); if (!ARCADE_GAMES.includes(game)) return { error: 'bad-game' };
    if (acct(env.p).earned >= ARC.dayCap) return { ...reply(env, null, {}), ok: false, error: 'capped', message: 'You hit today’s Arcade limit. It resets at midnight UTC.' };
    s = { game, cid, at: Date.now(), startedAt: Date.now(), earned: 0, counted: false };
    if (game === 'echo') { s.seq = [rnd(4), rnd(4), rnd(4)]; s.round = 1; s.shownAt = Date.now(); }
    if (game === 'aim') { s.i = 0; s.pts = 0; s.miss = 0; s.t = aimTarget(0); s.shownAt = Date.now(); }
    if (game === 'math') { s.endsAt = Date.now() + MATH_MS; s.ok = 0; s.streak = 0; s.level = 1; s.qq = mathQ(1); s.shownAt = Date.now(); }
    sessions.set(cid, s);
    if (game === 'echo') return reply(env, s, { game, seq: s.seq, round: 1 });
    if (game === 'aim') return reply(env, s, { game, n: AIM_N, i: 0, t: s.t, life: AIM_LIFE });
    return reply(env, s, { game, q: s.qq.q, ms: MATH_MS, level: 1 });
  }
  if (!s) return { error: 'no-round', message: 'Start a round first.' };
  s.at = Date.now();

  if (act === 'end') {
    sessions.delete(cid);
    return reply(env, s, { done: true, game: s.game, score: s.game === 'echo' ? s.round - 1 : s.game === 'aim' ? s.pts : s.ok });
  }
  if (act !== 'step') return { error: 'bad-action' };

  // ---- echo: repeat the pattern. Each finished round pays a little more, and the pattern grows by one.
  if (s.game === 'echo') {
    const got = Array.isArray(body.seq) ? body.seq.map((x) => Math.floor(Number(x))) : [];
    const need = s.seq.length, humanMs = need * 140;   // pressing faster than this is not a person
    const right = got.length === need && got.every((x, i) => x === s.seq[i]) && Date.now() - s.shownAt >= humanMs;
    if (!right) { const score = s.round - 1; best(env, 'echo', score); sessions.delete(cid); return reply(env, s, { game: 'echo', over: true, score }); }
    const gain = award(env, s, echoPay(s.round)), done = s.round;
    best(env, 'echo', done);
    s.round++; if (s.round > 30) { sessions.delete(cid); return reply(env, s, { game: 'echo', over: true, score: done, gain }); }
    s.seq.push(rnd(4)); s.shownAt = Date.now();
    return reply(env, s, { game: 'echo', correct: true, gain, seq: s.seq, round: s.round });
  }

  // ---- aim: hit each target before it fades. Faster hits score more; a miss costs a point.
  if (s.game === 'aim') {
    const el = Date.now() - s.shownAt; let gain = 0, hit = false, timeout = false;
    if (body.timeout) { if (el < AIM_LIFE - 250) return { error: 'early' }; timeout = true; s.miss++; s.pts = Math.max(0, s.pts - 1); }
    else {
      const cx = Number(body.x), cy = Number(body.y);
      const dx = cx - s.t.x, dy = (cy - s.t.y) * 0.5625;   // the arena is 16:9
      if (!Number.isFinite(cx) || !Number.isFinite(cy) || Math.hypot(dx, dy) > s.t.r + 0.6 || el < 110 || el > AIM_LIFE + 900) { s.miss++; s.pts = Math.max(0, s.pts - 1); return reply(env, s, { game: 'aim', hit: false, i: s.i, pts: s.pts, t: s.t, life: AIM_LIFE, miss: true }); }
      hit = true; const p = el < 700 ? 3 : el < 1250 ? 2 : 1; s.pts += p; gain = award(env, s, p * 5);
    }
    s.i++;
    if (s.i >= AIM_N) { best(env, 'aim', s.pts); sessions.delete(cid); return reply(env, s, { game: 'aim', over: true, hit, timeout, gain, score: s.pts, pts: s.pts }); }
    s.t = aimTarget(s.i); s.shownAt = Date.now();
    return reply(env, s, { game: 'aim', hit, timeout, gain, i: s.i, pts: s.pts, t: s.t, life: AIM_LIFE });
  }

  // ---- math: as many right answers as you can in 45 seconds. Harder sums as the streak grows.
  if (s.game === 'math') {
    const now = Date.now(), over = now > s.endsAt + 1500;
    if (over || body.finish) { best(env, 'math', s.ok); sessions.delete(cid); return reply(env, s, { game: 'math', over: true, score: s.ok }); }
    if (now - s.shownAt < 450) return reply(env, s, { game: 'math', tooFast: true, q: s.qq.q, left: Math.max(0, s.endsAt - now), level: s.level });
    const v = Math.floor(Number(body.v)); let gain = 0, correct = false;
    if (Number.isFinite(v) && v === s.qq.ans) { correct = true; s.ok++; s.streak++; gain = award(env, s, 6 + s.level * 2); s.level = Math.min(5, 1 + Math.floor(s.streak / 3)); }
    else s.streak = 0, s.level = Math.max(1, s.level - 1);
    s.qq = mathQ(s.level); s.shownAt = Date.now();
    return reply(env, s, { game: 'math', correct, gain, q: s.qq.q, ok: s.ok, left: Math.max(0, s.endsAt - Date.now()), level: s.level });
  }
  return { error: 'bad-action' };
}
