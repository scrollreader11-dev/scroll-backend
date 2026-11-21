/* Scrolls Casino: eight more games. Every outcome is rolled here with a secure random source;
   the browser only draws what this file returns. Wallet changes go through the same
   profile, stats, tournament and play-hook path as the older games (env.recordPlay). */
import crypto from 'crypto';

const rnd = (n) => crypto.randomInt(n);                                     // 0 .. n-1
const rf = () => crypto.randomInt(1, 281474976710655) / 281474976710656;    // (0, 1)

export const MORE_GAMES = ['keno', 'scratch', 'baccarat', 'shell', 'penalty', 'war', 'hilo', 'poker'];
export const MORE_NAMES = { keno: 'Keno', scratch: 'Scratch Cards', baccarat: 'Baccarat', shell: 'Shell Game', penalty: 'Penalty Shootout', war: 'Casino War', hilo: 'Hi-Lo', poker: 'Video Poker' };

// ---------------------------------------------------------------- helpers
function gate(env, game, bet) {
  const cfg = env.cfg();
  if (cfg.closed) return { error: 'closed', message: 'The casino is closed for now.' };
  const g = (cfg.games && cfg.games[game]) || {};
  if (g.off) return { error: 'disabled', message: (MORE_NAMES[game] || 'This game') + ' is switched off right now.' };
  const max = g.max || cfg.maxBet || 0;
  if (max && bet > max) return { error: 'max-bet', max, message: 'The table limit is ' + max + ' Scrolls.' };
  const min = g.min || cfg.minBet || 0;
  if (min && bet < min) return { error: 'min-bet', min, message: 'The minimum bet is ' + min + ' Scrolls.' };
  return null;
}
function takeBet(env, game, raw) {
  const bet = Math.floor(Number(raw));
  if (!Number.isFinite(bet) || bet < 1) return { error: 'bad-bet' };
  const g = gate(env, game, bet); if (g) return g;
  if (bet > env.p.coins) return { error: 'broke' };
  env.p.coins -= bet;
  return { bet };
}
function payOut(env, game, bet, payout) {
  payout = Math.max(0, Math.floor(payout));
  const cap = env.cfg().maxPayout || 0;
  if (cap && payout > cap) payout = cap;
  env.p.coins += payout; env.recordPlay(env.p, bet, payout); env.save();
  return payout;
}
function done(env, extra, bet, payout) { return { ok: true, ...extra, bet, payout, win: payout - bet, profile: env.publicProfile() }; }
const ranks = (n) => (n <= 10 ? String(n) : 'JQKA'[n - 11]);
const randCard = () => ({ r: 2 + rnd(13), s: rnd(4) });                      // 2..14 (ace high), infinite deck

// ---------------------------------------------------------------- keno tables (40 numbers, 10 drawn)
function C(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }
export const KENO = (() => {
  const T = {}, total = C(40, 10), TARGET = 0.95, CAP = 1000;
  for (let n = 1; n <= 10; n++) {
    const P = []; for (let k = 0; k <= n; k++) P[k] = (C(n, k) * C(40 - n, 10 - k)) / total;
    let best = null;
    for (let kmin = 1; kmin <= n && !best; kmin++) {
      // share the return across the paying hit counts (more to the likelier ones), capping the top prize and re-sharing the rest
      const ks = []; for (let k = kmin; k <= n; k++) ks.push(k);
      const w = {}; ks.forEach((k) => { w[k] = Math.pow(P[k], 0.4); });
      const mult = {}, fixed = {}; let left = TARGET, guard = 0;
      while (guard++ < 12) {
        const free = ks.filter((k) => !fixed[k]), ws = free.reduce((a, k) => a + w[k], 0); let capped = false;
        free.forEach((k) => { const m = (left * (w[k] / ws)) / P[k]; if (m > CAP) { fixed[k] = true; mult[k] = CAP; left -= CAP * P[k]; capped = true; } else mult[k] = m; });
        if (!capped) break;
      }
      const row = []; let ok = true;
      for (let k = 0; k <= n; k++) {
        if (k < kmin) { row[k] = 0; continue; }
        let m = mult[k]; m = m >= 100 ? Math.floor(m) : Math.floor(m * 10) / 10; if (m < 1) ok = false; row[k] = m;
      }
      if (ok) best = row;
    }
    T[n] = best || (() => { const r = new Array(n + 1).fill(0); r[n] = 5; return r; })();
  }
  return T;
})();
export function kenoRtp(n) { const total = C(40, 10); let s = 0; for (let k = 0; k <= n; k++) s += ((C(n, k) * C(40 - n, 10 - k)) / total) * (KENO[n][k] || 0); return s; }

// ---------------------------------------------------------------- scratch cards
const SCRATCH = [
  { sym: 'cherry', m: 2, w: 18 }, { sym: 'lemon', m: 3, w: 9 }, { sym: 'bell', m: 5, w: 5 },
  { sym: 'star', m: 10, w: 2.2 }, { sym: 'gem', m: 25, w: 0.8 }, { sym: 'crown', m: 100, w: 0.12 },
];
const SCRATCH_LOSE = 115.94, SCRATCH_W = SCRATCH.reduce((a, x) => a + x.w, SCRATCH_LOSE);
function scratchBoard(win) {
  const syms = SCRATCH.map((x) => x.sym), cnt = {}, cells = new Array(9).fill(null);
  if (win) { const idx = []; while (idx.length < 3) { const i = rnd(9); if (!idx.includes(i)) idx.push(i); } idx.forEach((i) => { cells[i] = win.sym; }); cnt[win.sym] = 3; }
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    let s; do { s = syms[rnd(syms.length)]; } while ((cnt[s] || 0) >= 2);
    cells[i] = s; cnt[s] = (cnt[s] || 0) + 1;
  }
  return cells;
}

// ---------------------------------------------------------------- baccarat
const bacVal = (r) => (r >= 10 ? 0 : r === 14 ? 1 : r);                       // ranks 2..14 mapped to baccarat points
const bacTot = (h) => h.reduce((a, c) => a + bacVal(c.r), 0) % 10;

// ---------------------------------------------------------------- video poker (8/5 Jacks or Better)
export const POKER_PAY = [['Royal Flush', 250], ['Straight Flush', 50], ['Four of a Kind', 25], ['Full House', 8], ['Flush', 5], ['Straight', 4], ['Three of a Kind', 3], ['Two Pair', 2], ['Jacks or Better', 1]];
function pokerEval(h) {
  const rs = h.map((c) => c.r).sort((a, b) => a - b), flush = h.every((c) => c.s === h[0].s), cnt = {};
  rs.forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
  const groups = Object.entries(cnt).map(([r, n]) => [+r, n]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const uniq = new Set(rs).size === 5;
  const straight = uniq && (rs[4] - rs[0] === 4 || (rs[4] === 14 && rs[0] === 2 && rs[1] === 3 && rs[2] === 4 && rs[3] === 5));
  if (straight && flush) return rs[0] === 10 ? 'Royal Flush' : 'Straight Flush';
  if (groups[0][1] === 4) return 'Four of a Kind';
  if (groups[0][1] === 3 && groups[1][1] === 2) return 'Full House';
  if (flush) return 'Flush';
  if (straight) return 'Straight';
  if (groups[0][1] === 3) return 'Three of a Kind';
  if (groups[0][1] === 2 && groups[1][1] === 2) return 'Two Pair';
  if (groups[0][1] === 2 && groups[0][0] >= 11) return 'Jacks or Better';
  return '';
}
const pokerMult = (name) => { const r = POKER_PAY.find((x) => x[0] === name); return r ? r[1] : 0; };
function shuffled() { const d = []; for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) d.push({ r, s }); for (let i = d.length - 1; i > 0; i--) { const j = rnd(i + 1); [d[i], d[j]] = [d[j], d[i]]; } return d; }

// ---------------------------------------------------------------- per-player rounds in progress
const live = { war: {}, hilo: {}, poker: {} };
// Rig support (owner tool): copy and put back one player's rounds in progress while a round is re-rolled in memory.
export function liveSnap(cid) { const o = {}; for (const g in live) o[g] = live[g][cid] ? structuredClone(live[g][cid]) : undefined; return o; }
export function liveRestore(cid, snap, reshuffle) {
  for (const g in live) {
    const v = snap && snap[g];
    if (v === undefined) { delete live[g][cid]; continue; }
    const c = structuredClone(v);
    if (reshuffle && Array.isArray(c.deck)) for (let i = c.deck.length - 1; i > 0; i--) { const j = rnd(i + 1); [c.deck[i], c.deck[j]] = [c.deck[j], c.deck[i]]; }
    live[g][cid] = c;
  }
}
const STALE = 30 * 60 * 1000;
function active(game, cid) { const g = live[game][cid]; if (g && Date.now() - g.t > STALE) { delete live[game][cid]; return null; } return g || null; }
const hiloP = (r) => ({ hi: (14 - r) / 13, lo: (r - 2) / 13 });
const hiloNext = (mult, p) => (p > 0 ? Math.min(1000, Math.floor(mult * (0.985 / p) * 100) / 100) : 0);
function hiloView(g) { const p = hiloP(g.card.r); return { card: g.card, mult: g.mult, steps: g.steps, bet: g.bet, hi: p.hi > 0 ? hiloNext(g.mult, p.hi) : 0, lo: p.lo > 0 ? hiloNext(g.mult, p.lo) : 0, pHi: +p.hi.toFixed(4), pLo: +p.lo.toFixed(4) }; }

// ---------------------------------------------------------------- the router
// env: { cid, p, cfg(), save(), recordPlay(p,bet,payout), publicProfile() }
export function handleMore(path, body, env) {
  const m = path.match(/^\/api\/casino\/g\/([a-z]+)(?:\/([a-z]+))?$/); if (!m) return null;
  const game = m[1], act = m[2] || 'play', cid = env.cid, p = env.p;
  if (game === 'info') {
    const cfg = env.cfg();
    return { ok: true, keno: KENO, scratch: SCRATCH.map((x) => ({ sym: x.sym, m: x.m })), poker: POKER_PAY, names: MORE_NAMES, closed: !!cfg.closed, games: cfg.games || {}, maxBet: cfg.maxBet || 0, minBet: cfg.minBet || 0, profile: env.publicProfile() };
  }
  if (!MORE_GAMES.includes(game)) return null;

  // ---- keno
  if (game === 'keno') {
    let picks = Array.isArray(body.picks) ? body.picks.map((x) => Math.floor(Number(x))) : [];
    picks = [...new Set(picks)].filter((x) => x >= 1 && x <= 40);
    if (picks.length < 1 || picks.length > 10) return { error: 'bad-picks', message: 'Pick between 1 and 10 numbers.' };
    const t = takeBet(env, game, body.bet); if (t.error) return t;
    const pool = Array.from({ length: 40 }, (_, i) => i + 1), drawn = [];
    for (let i = 0; i < 10; i++) { const j = rnd(pool.length); drawn.push(pool.splice(j, 1)[0]); }
    const hits = picks.filter((x) => drawn.includes(x));
    const mult = KENO[picks.length][hits.length] || 0;
    const payout = payOut(env, game, t.bet, t.bet * mult);
    return done(env, { picks, drawn, hits, mult }, t.bet, payout);
  }

  // ---- scratch cards
  if (game === 'scratch') {
    const t = takeBet(env, game, body.bet); if (t.error) return t;
    let roll = rf() * SCRATCH_W, win = null;
    for (const o of SCRATCH) { if (roll < o.w) { win = o; break; } roll -= o.w; }
    const cells = scratchBoard(win);
    const payout = payOut(env, game, t.bet, win ? t.bet * win.m : 0);
    return done(env, { cells, sym: win ? win.sym : '', mult: win ? win.m : 0 }, t.bet, payout);
  }

  // ---- baccarat
  if (game === 'baccarat') {
    const side = ['player', 'banker', 'tie'].includes(body.side) ? body.side : 'player';
    const t = takeBet(env, game, body.bet); if (t.error) return t;
    const ph = [randCard(), randCard()], bh = [randCard(), randCard()];
    let pt = bacTot(ph), bt = bacTot(bh), p3 = null;
    if (pt < 8 && bt < 8) {
      if (pt <= 5) { p3 = randCard(); ph.push(p3); pt = bacTot(ph); }
      const pv = p3 ? bacVal(p3.r) : -1;
      let draw = false;
      if (!p3) draw = bt <= 5;
      else if (bt <= 2) draw = true;
      else if (bt === 3) draw = pv !== 8;
      else if (bt === 4) draw = pv >= 2 && pv <= 7;
      else if (bt === 5) draw = pv >= 4 && pv <= 7;
      else if (bt === 6) draw = pv === 6 || pv === 7;
      if (draw) { bh.push(randCard()); bt = bacTot(bh); }
    }
    const winner = pt > bt ? 'player' : bt > pt ? 'banker' : 'tie';
    let payout = 0;
    if (winner === 'tie') payout = side === 'tie' ? t.bet * 9 : t.bet;           // tie pays 8 to 1, other bets push
    else if (side === winner) payout = side === 'banker' ? t.bet * 1.95 : t.bet * 2;
    payout = payOut(env, game, t.bet, payout);
    return done(env, { player: ph, banker: bh, pt, bt, winner, side }, t.bet, payout);
  }

  // ---- shell game
  if (game === 'shell') {
    const pick = Math.floor(Number(body.pick)); if (!(pick >= 0 && pick <= 2)) return { error: 'bad-pick' };
    const t = takeBet(env, game, body.bet); if (t.error) return t;
    const prize = rnd(3), won = prize === pick;
    const payout = payOut(env, game, t.bet, won ? t.bet * 2.85 : 0);
    return done(env, { pick, prize, won }, t.bet, payout);
  }

  // ---- penalty shootout
  if (game === 'penalty') {
    const aim = Math.floor(Number(body.aim)); if (!(aim >= 0 && aim <= 2)) return { error: 'bad-pick' };
    const t = takeBet(env, game, body.bet); if (t.error) return t;
    const keeper = rnd(3), missed = rf() < 0.05;
    const outcome = keeper === aim ? 'saved' : missed ? 'miss' : 'goal';
    const payout = payOut(env, game, t.bet, outcome === 'goal' ? t.bet * 1.5 : 0);
    return done(env, { aim, keeper, outcome }, t.bet, payout);
  }

  // ---- casino war
  if (game === 'war') {
    const cur = active('war', cid);
    if (act === 'state') return { ok: true, active: !!cur, bet: cur ? cur.bet : 0, pc: cur && cur.pc, dc: cur && cur.dc, profile: env.publicProfile() };
    if (act === 'deal' || act === 'play') {
      if (cur) return { error: 'in-progress', pc: cur.pc, dc: cur.dc, bet: cur.bet };
      const t = takeBet(env, game, body.bet); if (t.error) return t;
      const pc = randCard(), dc = randCard();
      if (pc.r === dc.r) { live.war[cid] = { bet: t.bet, pc, dc, t: Date.now() }; env.save(); return { ok: true, tie: true, pc, dc, bet: t.bet, profile: env.publicProfile() }; }
      const won = pc.r > dc.r, payout = payOut(env, game, t.bet, won ? t.bet * 2 : 0);
      return done(env, { pc, dc, tie: false, won }, t.bet, payout);
    }
    if (!cur) return { error: 'no-round' };
    if (act === 'surrender') {
      delete live.war[cid]; const payout = payOut(env, game, cur.bet, Math.floor(cur.bet / 2));
      return done(env, { surrendered: true, pc: cur.pc, dc: cur.dc }, cur.bet, payout);
    }
    if (act === 'go') {
      if (cur.bet > p.coins) return { error: 'broke' };
      p.coins -= cur.bet; delete live.war[cid];
      const pc2 = randCard(), dc2 = randCard(), won = pc2.r >= dc2.r;
      const stake = cur.bet * 2, payout = payOut(env, game, stake, won ? cur.bet * 3 : 0);
      return done(env, { war: true, pc: cur.pc, dc: cur.dc, pc2, dc2, won }, stake, payout);
    }
    return { error: 'bad-action' };
  }

  // ---- hi-lo
  if (game === 'hilo') {
    const cur = active('hilo', cid);
    if (act === 'state') return { ok: true, active: !!cur, ...(cur ? hiloView(cur) : {}), profile: env.publicProfile() };
    if (act === 'start' || act === 'play') {
      if (cur) return { error: 'in-progress', ...hiloView(cur) };
      const t = takeBet(env, game, body.bet); if (t.error) return t;
      const g = { bet: t.bet, card: randCard(), mult: 1, steps: 0, t: Date.now() }; live.hilo[cid] = g; env.save();
      return { ok: true, ...hiloView(g), profile: env.publicProfile() };
    }
    if (!cur) return { error: 'no-round' };
    if (act === 'guess') {
      const dir = body.dir === 'lo' ? 'lo' : 'hi', pr = hiloP(cur.card.r)[dir];
      if (pr <= 0) return { error: 'impossible', ...hiloView(cur) };
      const next = randCard(), won = dir === 'hi' ? next.r > cur.card.r : next.r < cur.card.r, prev = cur.card;
      if (!won) { delete live.hilo[cid]; payOut(env, game, cur.bet, 0); return done(env, { prev, next, won: false, steps: cur.steps }, cur.bet, 0); }
      cur.mult = hiloNext(cur.mult, pr); cur.steps++; cur.card = next; cur.t = Date.now();
      if (cur.mult >= 1000) { delete live.hilo[cid]; const payout = payOut(env, game, cur.bet, cur.bet * cur.mult); return done(env, { prev, next, won: true, maxed: true, steps: cur.steps, mult: cur.mult }, cur.bet, payout); }
      return { ok: true, prev, won: true, ...hiloView(cur), profile: env.publicProfile() };
    }
    if (act === 'cash') {
      if (cur.steps < 1) return { error: 'too-early', message: 'Make one guess first.' };
      delete live.hilo[cid]; const payout = payOut(env, game, cur.bet, cur.bet * cur.mult);
      return done(env, { cashed: true, steps: cur.steps, mult: cur.mult, card: cur.card }, cur.bet, payout);
    }
    return { error: 'bad-action' };
  }

  // ---- video poker
  if (game === 'poker') {
    const cur = active('poker', cid);
    if (act === 'state') return { ok: true, active: !!cur, hand: cur && cur.hand, bet: cur ? cur.bet : 0, profile: env.publicProfile() };
    if (act === 'deal' || act === 'play') {
      if (cur) return { error: 'in-progress', hand: cur.hand, bet: cur.bet };
      const t = takeBet(env, game, body.bet); if (t.error) return t;
      const deck = shuffled(), hand = deck.splice(0, 5); live.poker[cid] = { bet: t.bet, deck, hand, t: Date.now() }; env.save();
      return { ok: true, hand, bet: t.bet, hint: pokerEval(hand), profile: env.publicProfile() };
    }
    if (!cur) return { error: 'no-round' };
    if (act === 'draw') {
      const holds = Array.isArray(body.holds) ? body.holds.slice(0, 5).map(Boolean) : [];
      const hand = cur.hand.map((c, i) => (holds[i] ? c : cur.deck.shift()));
      delete live.poker[cid];
      const name = pokerEval(hand), mult = pokerMult(name), payout = payOut(env, game, cur.bet, cur.bet * mult);
      return done(env, { hand, held: cur.hand.map((_, i) => !!holds[i]), name, mult }, cur.bet, payout);
    }
    return { error: 'bad-action' };
  }
  return null;
}
