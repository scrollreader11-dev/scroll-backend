// ============================================================
// Scrolls Casino — shared multiplayer games for the 2D world.
// Everyone on the floor plays the same rounds: one Crash rocket,
// one Roulette spin, one Big Wheel spin, seated Blackjack tables,
// and player-vs-player Coinflip / Dice duels. Money moves through
// casino.js's wallet (same balance, stats, tournament and win pops
// as the solo games). Messages arrive over /world-ws as {t:'g', g, a}.
// ============================================================
import { walletBet, walletRefund, walletSettle, walletCoins, crashRoll, crashRate, jackpotInfo } from './casino.js';

let io = null; // { broadcast(o), sendTo(pl, o), players: Map }
export function initTables(api) { io = api; crashRound(); roulRound(); wheelRound(); setInterval(tick, 50); }

const now = () => Date.now();
const ERR = { broke: 'Not enough Scrolls', 'bad-bet': 'Enter a valid bet' };
function plByCid(cid) { for (const p of io.players.values()) if (p.cid === cid) return p; return null; }
function sendCoins(cid) { const p = plByCid(cid); if (p) io.sendTo(p, { t: 'coins', c: walletCoins(cid) }); }
function emit(g, o) { io.broadcast(Object.assign({ t: 'g', g, now: now() }, o)); }
function fail(pl, g, msg) { io.sendTo(pl, { t: 'g', g, ev: 'err', msg: ERR[msg] || msg, now: now() }); }
function amtOf(v) { const a = Math.floor(Number(v) || 0); return a >= 1 && a <= 1e9 ? a : 0; }
function take(pl, g, amt) { const r = walletBet(pl.cid, amt); if (r.error) { fail(pl, g, r.error); return false; } sendCoins(pl.cid); return true; }

// ================================================================ OWNER CONTROLS
// Set from the casino Owner panel (server.js 'casino.table.*'): pick when Crash crashes, which
// Roulette number lands and which Big Wheel color lands. Queues are used up one round at a time.
const ctl = { crashQueue: [], crashFixed: 0, roulQueue: [], wheelQueue: [] };
const clampX = (v) => Math.max(1, Math.min(1000, Math.round(Number(v) * 100) / 100));
export function tableState() {
  const m = crash.phase === 'run' ? crashMult(now()) : crash.phase === 'end' ? crash.point : 1;
  return { crash: { id: crash.id, phase: crash.phase, mult: m, point: crash.point, queue: ctl.crashQueue.slice(), fixed: ctl.crashFixed, hist: crash.hist.slice(0, 8) },
    roulette: { id: roul.id, phase: roul.phase, result: roul.phase === 'spin' ? roul.result : null, queue: ctl.roulQueue.slice(), hist: roul.hist.slice(0, 8) },
    wheel: { id: wheel.id, phase: wheel.phase, queue: ctl.wheelQueue.slice(), hist: wheel.hist.slice(0, 8) } };
}
export function tableControl(g, op, value, count) {
  const n = Math.max(1, Math.min(50, Math.floor(Number(count) || 1)));
  if (g === 'crash') {
    if (op === 'clear') { ctl.crashQueue = []; ctl.crashFixed = 0; return { ok: true }; }
    if (op === 'fixed') { ctl.crashFixed = value === '' || value == null || Number(value) <= 0 ? 0 : clampX(value); return { ok: true }; }
    if (op === 'now') { // this round: the rocket crashes at this multiplier (or right away if it is already past it)
      if (crash.phase === 'end') return { error: 'bad-phase', message: 'The round is over. Use "next round" instead.' };
      crash.point = clampX(value); return { ok: true };
    }
    if (op === 'next') { if (!(Number(value) >= 1)) return { error: 'bad-value', message: 'Enter a multiplier of 1.00 or more.' }; for (let i = 0; i < n; i++) ctl.crashQueue.push(clampX(value)); ctl.crashQueue.length = Math.min(ctl.crashQueue.length, 50); return { ok: true }; }
  }
  if (g === 'roulette') {
    if (op === 'clear') { ctl.roulQueue = []; return { ok: true }; }
    const v = Math.floor(Number(value)); if (!(v >= 0 && v <= 36)) return { error: 'bad-value', message: 'Pick a number from 0 to 36.' };
    if (op === 'now') { if (roul.phase !== 'bet') return { error: 'bad-phase', message: 'The wheel is already spinning. Use "next spin" instead.' }; ctl.roulQueue.unshift(v); return { ok: true }; }
    if (op === 'next') { for (let i = 0; i < n; i++) ctl.roulQueue.push(v); ctl.roulQueue.length = Math.min(ctl.roulQueue.length, 50); return { ok: true }; }
  }
  if (g === 'wheel') {
    if (op === 'clear') { ctl.wheelQueue = []; return { ok: true }; }
    const c = String(value); if (!WPAY[c]) return { error: 'bad-value', message: 'Pick grey, blue, green or gold.' };
    if (op === 'now') { if (wheel.phase !== 'bet') return { error: 'bad-phase', message: 'The wheel is already spinning. Use "next spin" instead.' }; ctl.wheelQueue.unshift(c); return { ok: true }; }
    if (op === 'next') { for (let i = 0; i < n; i++) ctl.wheelQueue.push(c); ctl.wheelQueue.length = Math.min(ctl.wheelQueue.length, 50); return { ok: true }; }
  }
  return { error: 'bad-op', message: 'Unknown control.' };
}

// ================================================================ CRASH
const CR_BET = 7000, CR_END = 4000;
const crash = { id: 0, phase: 'bet', until: 0, start: 0, point: 1, bets: new Map(), hist: [] };
function crashMult(t) { return Math.max(1, Math.floor(Math.exp(crashRate() * Math.max(0, t - crash.start)) * 100) / 100); }
function crashPub() {
  return { id: crash.id, phase: crash.phase, until: crash.until, start: crash.start, k: crashRate(), hist: crash.hist.slice(0, 14),
    point: crash.phase === 'end' ? crash.point : undefined,
    bets: [...crash.bets.values()].map((b) => ({ pid: b.pid, nick: b.nick, bet: b.bet, auto: b.auto, cashed: b.cashed, win: b.win })) };
}
function crashRound() { crash.id++; crash.phase = 'bet'; crash.until = now() + CR_BET; crash.bets = new Map(); crash.point = ctl.crashQueue.length ? ctl.crashQueue.shift() : ctl.crashFixed ? ctl.crashFixed : crashRoll(); emit('crash', { ev: 'state', s: crashPub() }); }
function crashCash(b, m) {
  b.cashed = m; b.win = Math.floor(b.bet * m);
  walletSettle(b.cid, b.bet, b.win); sendCoins(b.cid);
  emit('crash', { ev: 'cash', pid: b.pid, nick: b.nick, m, win: b.win });
}
function crashTick(t) {
  if (crash.phase === 'bet' && t >= crash.until) { crash.phase = 'run'; crash.start = t; emit('crash', { ev: 'state', s: crashPub() }); return; }
  if (crash.phase === 'run') {
    const m = crashMult(t);
    for (const b of crash.bets.values()) if (!b.cashed && b.auto >= 1.01 && m >= b.auto && b.auto < crash.point) crashCash(b, b.auto);
    if (m >= crash.point) {
      crash.phase = 'end'; crash.until = t + CR_END;
      for (const b of crash.bets.values()) if (!b.cashed) walletSettle(b.cid, b.bet, 0);
      crash.hist.unshift(crash.point); crash.hist.length = Math.min(crash.hist.length, 20);
      emit('crash', { ev: 'state', s: crashPub() });
    }
    return;
  }
  if (crash.phase === 'end' && t >= crash.until) crashRound();
}
function crashMsg(pl, m) {
  if (m.a === 'bet') {
    if (crash.phase !== 'bet') return fail(pl, 'crash', 'Wait for the next round');
    if (crash.bets.has(pl.cid)) return fail(pl, 'crash', 'You already bet this round');
    const amt = amtOf(m.amt); if (!amt) return fail(pl, 'crash', 'bad-bet');
    if (!take(pl, 'crash', amt)) return;
    const auto = Math.max(0, Math.min(1000, Math.floor((Number(m.auto) || 0) * 100) / 100));
    const b = { pid: pl.id, cid: pl.cid, nick: pl.nick, bet: amt, auto: auto >= 1.01 ? auto : 0, cashed: 0, win: 0 };
    crash.bets.set(pl.cid, b);
    emit('crash', { ev: 'bet', b: { pid: b.pid, nick: b.nick, bet: b.bet, auto: b.auto, cashed: 0, win: 0 } });
  } else if (m.a === 'cash') {
    const b = crash.bets.get(pl.cid);
    if (crash.phase !== 'run' || !b || b.cashed) return;
    const mult = crashMult(now());
    if (mult >= crash.point) return; // too late — the crash lands on the next tick
    crashCash(b, mult);
  }
}

// ================================================================ ROULETTE
const RL_BET = 16000, RL_SPIN = 6500;
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const roul = { id: 0, phase: 'bet', until: 0, bets: [], result: null, color: '', hist: [] };
function rColor(n) { return n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black'; }
function rPayout(choice, amt, n) {
  const c = rColor(n);
  if (/^\d{1,2}$/.test(choice)) return +choice === n ? amt * 36 : 0;
  if (choice === 'red' || choice === 'black') return c === choice ? amt * 2 : 0;
  if (choice === 'green') return n === 0 ? amt * 14 : 0;
  if (choice === 'even') return n !== 0 && n % 2 === 0 ? amt * 2 : 0;
  if (choice === 'odd') return n % 2 === 1 ? amt * 2 : 0;
  return 0;
}
function roulPub() { return { id: roul.id, phase: roul.phase, until: roul.until, result: roul.phase === 'spin' ? roul.result : null, color: roul.phase === 'spin' ? roul.color : '', hist: roul.hist.slice(0, 14), bets: roul.bets.map((b) => ({ pid: b.pid, nick: b.nick, choice: b.choice, amt: b.amt })) }; }
function roulRound() { roul.id++; roul.phase = 'bet'; roul.until = now() + RL_BET; roul.bets = []; roul.result = null; emit('roulette', { ev: 'state', s: roulPub() }); }
function roulTick(t) {
  if (roul.phase === 'bet' && t >= roul.until) {
    roul.result = ctl.roulQueue.length ? ctl.roulQueue.shift() : Math.floor(Math.random() * 37); roul.color = rColor(roul.result);
    roul.phase = 'spin'; roul.until = t + RL_SPIN;
    emit('roulette', { ev: 'state', s: roulPub() });
  } else if (roul.phase === 'spin' && t >= roul.until) {
    const per = new Map();
    for (const b of roul.bets) { const e = per.get(b.cid) || { cid: b.cid, pid: b.pid, nick: b.nick, bet: 0, pay: 0 }; e.bet += b.amt; e.pay += rPayout(b.choice, b.amt, roul.result); per.set(b.cid, e); }
    const wins = [];
    for (const e of per.values()) { walletSettle(e.cid, e.bet, e.pay); sendCoins(e.cid); wins.push({ pid: e.pid, nick: e.nick, net: e.pay - e.bet }); }
    roul.hist.unshift(roul.result); roul.hist.length = Math.min(roul.hist.length, 20);
    emit('roulette', { ev: 'result', result: roul.result, color: roul.color, wins });
    roulRound();
  }
}
function roulMsg(pl, m) {
  if (m.a === 'bet') {
    if (roul.phase !== 'bet') return fail(pl, 'roulette', 'Bets are closed — wait for the next spin');
    const ch = String(m.choice || '');
    if (!/^(red|black|green|even|odd)$/.test(ch) && !(/^\d{1,2}$/.test(ch) && +ch <= 36)) return fail(pl, 'roulette', 'Pick a bet');
    if (roul.bets.filter((b) => b.cid === pl.cid).length >= 12) return fail(pl, 'roulette', 'Max 12 bets per spin');
    const amt = amtOf(m.amt); if (!amt) return fail(pl, 'roulette', 'bad-bet');
    if (!take(pl, 'roulette', amt)) return;
    const b = { pid: pl.id, cid: pl.cid, nick: pl.nick, choice: ch, amt };
    roul.bets.push(b);
    emit('roulette', { ev: 'bet', b: { pid: b.pid, nick: b.nick, choice: ch, amt } });
  } else if (m.a === 'clear') {
    if (roul.phase !== 'bet') return;
    const mine = roul.bets.filter((b) => b.cid === pl.cid); if (!mine.length) return;
    roul.bets = roul.bets.filter((b) => b.cid !== pl.cid);
    walletRefund(pl.cid, mine.reduce((a, b) => a + b.amt, 0)); sendCoins(pl.cid);
    emit('roulette', { ev: 'clear', pid: pl.id });
  }
}

// ================================================================ BIG WHEEL
// 31 segments: 15 grey (2x), 10 blue (3x), 5 green (6x), 1 gold (30x) — ~3% edge each.
export const WHEEL = (() => { const a = Array(31).fill('grey'); a[0] = 'gold'; [3, 9, 15, 21, 27].forEach((i) => { a[i] = 'green'; }); [1, 5, 7, 11, 13, 17, 19, 23, 25, 29].forEach((i) => { a[i] = 'blue'; }); return a; })();
const WPAY = { grey: 2, blue: 3, green: 6, gold: 30 };
const WH_BET = 15000, WH_SPIN = 6500;
const wheel = { id: 0, phase: 'bet', until: 0, bets: [], idx: -1, hist: [] };
function wheelPub() { return { id: wheel.id, phase: wheel.phase, until: wheel.until, idx: wheel.phase === 'spin' ? wheel.idx : -1, hist: wheel.hist.slice(0, 14), bets: wheel.bets.map((b) => ({ pid: b.pid, nick: b.nick, color: b.color, amt: b.amt })) }; }
function wheelRound() { wheel.id++; wheel.phase = 'bet'; wheel.until = now() + WH_BET; wheel.bets = []; wheel.idx = -1; emit('wheel', { ev: 'state', s: wheelPub() }); }
function wheelTick(t) {
  if (wheel.phase === 'bet' && t >= wheel.until) {
    { const want = ctl.wheelQueue.shift(), pool = want ? WHEEL.map((c, i) => (c === want ? i : -1)).filter((i) => i >= 0) : []; wheel.idx = pool.length ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * WHEEL.length); } wheel.phase = 'spin'; wheel.until = t + WH_SPIN;
    emit('wheel', { ev: 'state', s: wheelPub() });
  } else if (wheel.phase === 'spin' && t >= wheel.until) {
    const col = WHEEL[wheel.idx], per = new Map();
    for (const b of wheel.bets) { const e = per.get(b.cid) || { cid: b.cid, pid: b.pid, nick: b.nick, bet: 0, pay: 0 }; e.bet += b.amt; if (b.color === col) e.pay += b.amt * WPAY[col]; per.set(b.cid, e); }
    const wins = [];
    for (const e of per.values()) { walletSettle(e.cid, e.bet, e.pay); sendCoins(e.cid); wins.push({ pid: e.pid, nick: e.nick, net: e.pay - e.bet }); }
    wheel.hist.unshift(col); wheel.hist.length = Math.min(wheel.hist.length, 20);
    emit('wheel', { ev: 'result', idx: wheel.idx, color: col, wins });
    wheelRound();
  }
}
function wheelMsg(pl, m) {
  if (m.a !== 'bet') return;
  if (wheel.phase !== 'bet') return fail(pl, 'wheel', 'Wait for the next spin');
  const color = String(m.color || ''); if (!WPAY[color]) return fail(pl, 'wheel', 'Pick a color');
  if (wheel.bets.filter((b) => b.cid === pl.cid).length >= 8) return fail(pl, 'wheel', 'Max 8 bets per spin');
  const amt = amtOf(m.amt); if (!amt) return fail(pl, 'wheel', 'bad-bet');
  if (!take(pl, 'wheel', amt)) return;
  const b = { pid: pl.id, cid: pl.cid, nick: pl.nick, color, amt };
  wheel.bets.push(b);
  emit('wheel', { ev: 'bet', b: { pid: b.pid, nick: b.nick, color, amt } });
}

// ================================================================ BLACKJACK (seated tables)
const BJ_SEATS = 5, BJ_BET = 12000, BJ_TURN = 15000, BJ_DONE = 4500;
const SUITS = ['♠', '♥', '♦', '♣'];
function shoe() { const d = []; for (let k = 0; k < 4; k++) for (const s of SUITS) for (let n = 1; n <= 13; n++) d.push({ n, s }); for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } return d; }
function hv(cards) { let t = 0, a = 0; for (const c of cards) { let v = Math.min(c.n, 10); if (c.n === 1) { a++; v = 11; } t += v; } while (t > 21 && a) { t -= 10; a--; } return t; }
const tables = {};
['bj1', 'bj2', 'bj3'].forEach((id) => { tables[id] = { id, seats: Array(BJ_SEATS).fill(null), dealer: [], deck: [], phase: 'idle', turn: -1, until: 0 }; });
function bjPub(T) {
  const hide = T.phase === 'play' || T.phase === 'bet' || T.phase === 'idle';
  const dealer = hide && T.dealer.length ? [T.dealer[0], { hidden: true }] : T.dealer;
  return { id: T.id, phase: T.phase, turn: T.turn, until: T.until, dealer, dealerValue: T.dealer.length ? hv(hide ? [T.dealer[0]] : T.dealer) : 0,
    seats: T.seats.map((s) => s && { pid: s.pid, nick: s.nick, bet: s.bet, hand: s.hand, value: s.hand.length ? hv(s.hand) : 0, done: s.done, result: s.result, dbl: s.dbl, away: s.away }) };
}
function bjEmit(T) { emit('bj', { ev: 'state', s: bjPub(T) }); }
function seatOf(cid) { for (const id in tables) { const T = tables[id]; const i = T.seats.findIndex((s) => s && s.cid === cid); if (i >= 0) return { T, i, s: T.seats[i] }; } return null; }
function bjDeal(T) {
  T.deck = shoe(); T.dealer = [T.deck.pop(), T.deck.pop()];
  for (const s of T.seats) if (s && s.bet > 0) { s.hand = [T.deck.pop(), T.deck.pop()]; s.done = false; s.result = ''; if (hv(s.hand) === 21) { s.done = true; s.result = 'bj'; } }
  T.phase = 'play';
  if (hv(T.dealer) === 21) return bjDealer(T);
  bjNext(T, -1);
}
function bjNext(T, from) {
  for (let i = from + 1; i < BJ_SEATS; i++) { const s = T.seats[i]; if (s && s.bet > 0 && !s.done) { T.turn = i; T.until = now() + (s.away ? 400 : BJ_TURN); bjEmit(T); return; } }
  bjDealer(T);
}
function bjDealer(T) {
  T.phase = 'dealer'; T.turn = -1;
  const anyLive = T.seats.some((s) => s && s.bet > 0 && s.result !== 'bust');
  if (anyLive) while (hv(T.dealer) < 17) T.dealer.push(T.deck.pop());
  const dv = hv(T.dealer), dBJ = T.dealer.length === 2 && dv === 21;
  for (const s of T.seats) {
    if (!s || s.bet <= 0) continue;
    const pv = hv(s.hand), pBJ = s.result === 'bj';
    let pay = 0, res;
    if (pv > 21) res = 'bust';
    else if (pBJ && !dBJ) { pay = Math.floor(s.bet * 2.5); res = 'bj'; }
    else if (dBJ && !pBJ) res = 'lose';
    else if (dv > 21 || pv > dv) { pay = s.bet * 2; res = 'win'; }
    else if (pv === dv) { pay = s.bet; res = 'push'; }
    else res = 'lose';
    s.result = res; s.done = true;
    walletSettle(s.cid, s.bet, pay); sendCoins(s.cid);
  }
  T.phase = 'done'; T.until = now() + BJ_DONE; bjEmit(T);
}
function bjReset(T) {
  T.seats = T.seats.map((s) => (s && !s.away ? Object.assign(s, { bet: 0, hand: [], done: false, result: '', dbl: false }) : null));
  T.dealer = []; T.phase = 'idle'; T.turn = -1; T.until = 0; bjEmit(T);
}
function bjTick(t) {
  for (const id in tables) {
    const T = tables[id];
    if (T.phase === 'bet' && t >= T.until) bjDeal(T);
    else if (T.phase === 'play' && t >= T.until && T.turn >= 0) { const s = T.seats[T.turn]; if (s) s.done = true; bjNext(T, T.turn); }
    else if (T.phase === 'done' && t >= T.until) bjReset(T);
  }
}
function bjMsg(pl, m) {
  const mine = seatOf(pl.cid);
  if (m.a === 'sit') {
    const T = tables[m.table]; const i = Math.floor(Number(m.seat));
    if (!T || !(i >= 0 && i < BJ_SEATS)) return;
    if (mine) { if (mine.T === T && mine.i === i) return; return fail(pl, 'bj', 'Leave your current seat first'); }
    if (T.seats[i]) return fail(pl, 'bj', 'That seat is taken');
    T.seats[i] = { pid: pl.id, cid: pl.cid, nick: pl.nick, bet: 0, hand: [], done: false, result: '', dbl: false, away: false };
    return bjEmit(T);
  }
  if (!mine) return;
  const { T, i, s } = mine;
  if (m.a === 'leave') {
    if (T.phase === 'idle' || (T.phase === 'bet' && !s.bet) || T.phase === 'done' || !s.bet) { T.seats[i] = null; bjEmit(T); return; }
    if (T.phase === 'bet') { walletRefund(s.cid, s.bet); sendCoins(s.cid); T.seats[i] = null; if (!T.seats.some((x) => x && x.bet > 0)) { T.phase = 'idle'; T.until = 0; } bjEmit(T); return; }
    s.away = true; if (T.turn === i) { s.done = true; bjNext(T, i); } else bjEmit(T);
    return;
  }
  if (m.a === 'bet') {
    if (!(T.phase === 'idle' || T.phase === 'bet') || s.bet > 0) return;
    const amt = amtOf(m.amt); if (!amt) return fail(pl, 'bj', 'bad-bet');
    if (!take(pl, 'bj', amt)) return;
    s.bet = amt;
    if (T.phase === 'idle') { T.phase = 'bet'; T.until = now() + BJ_BET; }
    if (T.seats.every((x) => !x || x.bet > 0)) return bjDeal(T); // everyone in — deal now
    return bjEmit(T);
  }
  if (T.phase !== 'play' || T.turn !== i) return;
  if (m.a === 'hit') {
    s.hand.push(T.deck.pop()); const v = hv(s.hand);
    if (v > 21) { s.done = true; s.result = 'bust'; } else if (v === 21) s.done = true;
    if (s.done) bjNext(T, i); else { T.until = now() + BJ_TURN; bjEmit(T); }
  } else if (m.a === 'stand') { s.done = true; bjNext(T, i); }
  else if (m.a === 'double') {
    if (s.hand.length !== 2) return;
    if (!take(pl, 'bj', s.bet)) return;
    s.bet *= 2; s.dbl = true; s.hand.push(T.deck.pop()); s.done = true; if (hv(s.hand) > 21) s.result = 'bust';
    bjNext(T, i);
  }
}

// ================================================================ DUELS (coinflip / dice, player vs player)
const DUEL_TTL = 120000, DUEL_FEE = 0.02;
const duels = new Map(); let duelSeq = 1;
function duelPub(d) { return { id: d.id, game: d.game, amt: d.amt, a: { pid: d.a.pid, nick: d.a.nick, pick: d.a.pick }, b: d.b && { pid: d.b.pid, nick: d.b.nick }, target: d.target || 0, targetNick: d.targetNick || '', state: d.state, res: d.res || null, created: d.created }; }
function duelList() { return [...duels.values()].map(duelPub); }
function duelsEmit() { emit('duel', { ev: 'list', list: duelList() }); }
function duelMsg(pl, m) {
  if (m.a === 'create') {
    const game = m.game === 'dice' ? 'dice' : 'flip';
    for (const d of duels.values()) if (d.state === 'open' && d.a.cid === pl.cid) return fail(pl, 'duel', 'You already have an open duel');
    const amt = amtOf(m.amt); if (!amt) return fail(pl, 'duel', 'bad-bet');
    let target = 0, targetNick = '';
    if (m.target) { const tp = io.players.get(Number(m.target)); if (!tp || tp.cid === pl.cid) return fail(pl, 'duel', 'That player left'); target = tp.id; targetNick = tp.nick; }
    if (!take(pl, 'duel', amt)) return;
    const d = { id: duelSeq++, game, amt, a: { pid: pl.id, cid: pl.cid, nick: pl.nick, pick: m.pick === 'tails' ? 'tails' : 'heads' }, b: null, target, targetNick, state: 'open', created: now() };
    duels.set(d.id, d); duelsEmit();
    if (target) { const tp = io.players.get(target); if (tp) io.sendTo(tp, { t: 'g', g: 'duel', ev: 'challenge', d: duelPub(d), now: now() }); }
    return;
  }
  const d = duels.get(Number(m.id)); if (!d) return;
  if (m.a === 'cancel') {
    if (d.state !== 'open' || d.a.cid !== pl.cid) return;
    duels.delete(d.id); walletRefund(d.a.cid, d.amt); sendCoins(d.a.cid); duelsEmit(); return;
  }
  if (m.a === 'decline') {
    if (d.state !== 'open' || d.target !== pl.id) return;
    duels.delete(d.id); walletRefund(d.a.cid, d.amt); sendCoins(d.a.cid);
    const ap = plByCid(d.a.cid); if (ap) io.sendTo(ap, { t: 'g', g: 'duel', ev: 'declined', nick: pl.nick, now: now() });
    duelsEmit(); return;
  }
  if (m.a === 'join') {
    if (d.state !== 'open') return fail(pl, 'duel', 'That duel already started');
    if (d.a.cid === pl.cid) return fail(pl, 'duel', "You can't duel yourself");
    if (d.target && d.target !== pl.id) return fail(pl, 'duel', 'That challenge is for someone else');
    if (!take(pl, 'duel', d.amt)) return;
    d.b = { pid: pl.id, cid: pl.cid, nick: pl.nick };
    let win, res;
    if (d.game === 'flip') { const landed = Math.random() < 0.5 ? 'heads' : 'tails'; win = landed === d.a.pick ? d.a : d.b; res = { landed }; }
    else { let ra, rb; do { ra = 1 + Math.floor(Math.random() * 100); rb = 1 + Math.floor(Math.random() * 100); } while (ra === rb); win = ra > rb ? d.a : d.b; res = { ra, rb }; }
    const lose = win === d.a ? d.b : d.a;
    const payout = Math.floor(d.amt * 2 * (1 - DUEL_FEE));
    walletSettle(win.cid, d.amt, payout); walletSettle(lose.cid, d.amt, 0);
    sendCoins(win.cid); sendCoins(lose.cid);
    d.state = 'done'; d.res = Object.assign(res, { winner: win.pid, winnerNick: win.nick, loserNick: lose.nick, payout }); d.doneAt = now();
    emit('duel', { ev: 'result', d: duelPub(d) }); duelsEmit();
  }
}
function duelTick(t) {
  let ch = false;
  for (const d of duels.values()) {
    if (d.state === 'open' && t - d.created > DUEL_TTL) { duels.delete(d.id); walletRefund(d.a.cid, d.amt); sendCoins(d.a.cid); ch = true; }
    else if (d.state === 'done' && t - d.doneAt > 9000) { duels.delete(d.id); ch = true; }
  }
  if (ch) duelsEmit();
}

// ================================================================ WIRING
let lastJp = -1, jpAt = 0;
function tick() {
  const t = now();
  try { crashTick(t); } catch (e) { console.error('crash tick', e.message); }
  try { roulTick(t); } catch (e) { console.error('roulette tick', e.message); }
  try { wheelTick(t); } catch (e) { console.error('wheel tick', e.message); }
  try { bjTick(t); } catch (e) { console.error('bj tick', e.message); }
  if (t - jpAt > 1000) { jpAt = t; try { duelTick(t); const j = jackpotInfo(); if (j.pool !== lastJp) { lastJp = j.pool; io.broadcast({ t: 'jp', pool: j.pool, last: j.last }); } } catch (e) {} }
}

export function tablesSnapshot() {
  const bj = {}; for (const id in tables) bj[id] = bjPub(tables[id]);
  return { crash: crashPub(), roulette: roulPub(), wheel: Object.assign(wheelPub(), { segs: WHEEL }), bj, duels: duelList(), jp: jackpotInfo() };
}
// A player (re)joined: re-attach their seat at a blackjack table.
export function tablesJoin(pl) {
  const st = seatOf(pl.cid);
  if (st) { st.s.pid = pl.id; st.s.nick = pl.nick; st.s.away = false; bjEmit(st.T); }
}
// A player left the floor: free seats, refund open duels.
export function tablesLeave(pl) {
  const st = seatOf(pl.cid);
  if (st) { const { T, i, s } = st; if (T.phase === 'idle' || T.phase === 'done' || !s.bet) { T.seats[i] = null; bjEmit(T); } else if (T.phase === 'bet') { walletRefund(s.cid, s.bet); T.seats[i] = null; if (!T.seats.some((x) => x && x.bet > 0)) { T.phase = 'idle'; T.until = 0; } bjEmit(T); } else { s.away = true; if (T.turn === i) { s.done = true; bjNext(T, i); } } }
  let ch = false;
  for (const d of duels.values()) if (d.state === 'open' && d.a.cid === pl.cid) { duels.delete(d.id); walletRefund(d.a.cid, d.amt); ch = true; }
  if (ch) duelsEmit();
}
export function handleTableMsg(pl, m) {
  try {
    if (m.g === 'crash') crashMsg(pl, m);
    else if (m.g === 'roulette') roulMsg(pl, m);
    else if (m.g === 'wheel') wheelMsg(pl, m);
    else if (m.g === 'bj') bjMsg(pl, m);
    else if (m.g === 'duel') duelMsg(pl, m);
  } catch (e) { console.error('table msg', e.message); }
}
