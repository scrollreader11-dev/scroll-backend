/* Scrolls Casino: the Arcade. Three skill games that pay a little for being good. Nothing is wagered.
   The server runs every round (sequences, targets, questions) and checks every answer, so the browser only draws.
   Pay is deliberately small: a per-play ceiling, a daily ceiling, and a halving once a player has earned a lot today. */
import crypto from 'crypto';

const rnd = (n) => crypto.randomInt(n);
export const ARCADE_GAMES = ['echo', 'aim', 'math', 'trivia', 'color', 'pattern', 'scramble'];
export const ARC = { perPlay: 400, softCap: 3000, dayCap: 5000, idleMs: 10 * 60 * 1000 };
let boardCache = null;
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
// Targets from the fifth on drift across the arena; every sixth one is a small gold target worth double.
// The server knows exactly where a target is at any moment, so a click is checked against where it really was.
function aimTarget(i) {
  const gold = i % 6 === 5, r = gold ? 4 : Math.max(4.2, 8 - i * 0.2), x = 9 + rnd(82), y = 12 + rnd(76);
  let vx = 0, vy = 0;
  if (i >= 4) {
    const ex = Math.min(91, Math.max(9, x + rnd(61) - 30)), ey = Math.min(88, Math.max(12, y + rnd(41) - 20)), sec = AIM_LIFE / 1000;
    vx = Math.round((ex - x) / sec * 100) / 100; vy = Math.round((ey - y) / sec * 100) / 100;
  }
  return { x, y, r, vx, vy, gold };
}
const aimPos = (t, el) => { const k = Math.min(Math.max(el, 0), AIM_LIFE) / 1000; return { x: t.x + t.vx * k, y: t.y + t.vy * k }; };
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

// ---------------------------------------------------------------- trivia (knowledge)
const TRIVIA = [
  ['Which planet is known as the Red Planet?', 'Mars', 'Venus', 'Jupiter', 'Mercury'], ['What is the largest ocean on Earth?', 'Pacific', 'Atlantic', 'Indian', 'Arctic'],
  ['How many continents are there?', '7', '5', '6', '8'], ['What gas do plants absorb from the air?', 'Carbon dioxide', 'Oxygen', 'Nitrogen', 'Helium'],
  ['What is the capital of France?', 'Paris', 'Lyon', 'Nice', 'Marseille'], ['Which animal is the largest mammal?', 'Blue whale', 'Elephant', 'Giraffe', 'Hippo'],
  ['How many sides does a hexagon have?', '6', '5', '7', '8'], ['What is H2O commonly called?', 'Water', 'Salt', 'Hydrogen', 'Air'],
  ['Who wrote Romeo and Juliet?', 'William Shakespeare', 'Charles Dickens', 'Mark Twain', 'Jane Austen'], ['What is the hardest natural material?', 'Diamond', 'Gold', 'Iron', 'Quartz'],
  ['Which is the tallest mountain above sea level?', 'Mount Everest', 'K2', 'Kilimanjaro', 'Denali'], ['How many minutes are in two hours?', '120', '90', '100', '180'],
  ['What is the capital of Japan?', 'Tokyo', 'Kyoto', 'Osaka', 'Seoul'], ['Which organ pumps blood around the body?', 'Heart', 'Lungs', 'Liver', 'Kidney'],
  ['What is 9 times 9?', '81', '72', '99', '89'], ['Which planet has the most visible rings?', 'Saturn', 'Mars', 'Earth', 'Neptune'],
  ['What do bees make?', 'Honey', 'Silk', 'Wax paper', 'Milk'], ['Which country has the Great Pyramid of Giza?', 'Egypt', 'Mexico', 'Peru', 'Iraq'],
  ['What is the freezing point of water in Celsius?', '0', '32', '10', '-10'], ['Which instrument has black and white keys?', 'Piano', 'Violin', 'Flute', 'Drums'],
  ['What is the largest planet in our solar system?', 'Jupiter', 'Saturn', 'Earth', 'Neptune'], ['Which season comes after winter?', 'Spring', 'Summer', 'Autumn', 'Monsoon'],
  ['What is the square root of 64?', '8', '6', '7', '9'], ['Who painted the Mona Lisa?', 'Leonardo da Vinci', 'Michelangelo', 'Picasso', 'Van Gogh'],
  ['Which blood cells carry oxygen?', 'Red blood cells', 'White blood cells', 'Platelets', 'Plasma'], ['What is the main language of Brazil?', 'Portuguese', 'Spanish', 'English', 'French'],
  ['How many players are on a soccer team on the field?', '11', '9', '10', '12'], ['Which metal is liquid at room temperature?', 'Mercury', 'Iron', 'Copper', 'Silver'],
  ['What is the capital of Australia?', 'Canberra', 'Sydney', 'Melbourne', 'Perth'], ['Which gas do humans need to breathe?', 'Oxygen', 'Helium', 'Methane', 'Argon'],
  ['What is the smallest prime number?', '2', '1', '3', '0'], ['Which ocean is between Africa and Australia?', 'Indian', 'Atlantic', 'Pacific', 'Arctic'],
  ['How many bones does an adult human have (about)?', '206', '106', '306', '406'], ['What force keeps us on the ground?', 'Gravity', 'Magnetism', 'Friction', 'Wind'],
  ['Which US state is the largest by area?', 'Alaska', 'Texas', 'California', 'Montana'], ['What is the first letter of the Greek alphabet?', 'Alpha', 'Beta', 'Omega', 'Delta'],
  ['Which part of a plant makes food from sunlight?', 'Leaf', 'Root', 'Stem', 'Seed'], ['What is 15 percent of 200?', '30', '15', '25', '20'],
  ['Who was the first President of the United States?', 'George Washington', 'Abraham Lincoln', 'Thomas Jefferson', 'John Adams'], ['What is the chemical symbol for gold?', 'Au', 'Ag', 'Gd', 'Go'],
  ['Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Earth', 'Mars'], ['How many degrees are in a right angle?', '90', '45', '180', '60'],
  ['What is a baby kangaroo called?', 'Joey', 'Cub', 'Pup', 'Kit'], ['Which language is spoken in Mexico?', 'Spanish', 'Portuguese', 'Mexican', 'Italian'],
  ['What do we call frozen water?', 'Ice', 'Steam', 'Vapor', 'Frost gas'], ['Which is the longest river often listed in Africa?', 'Nile', 'Congo', 'Niger', 'Zambezi'],
  ['What is the capital of Canada?', 'Ottawa', 'Toronto', 'Vancouver', 'Montreal'], ['What is 12 times 12?', '144', '124', '122', '134'],
  ['Which vitamin do we get from sunlight?', 'Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B12'], ['What shape is a stop sign?', 'Octagon', 'Hexagon', 'Pentagon', 'Circle'],
  ['Which planet do we live on?', 'Earth', 'Mars', 'Venus', 'Saturn'], ['What is the opposite of ancient?', 'Modern', 'Old', 'Tiny', 'Dusty'],
  ['How many days are in a leap year?', '366', '365', '364', '367'], ['What is the main ingredient of bread?', 'Flour', 'Sugar', 'Rice', 'Butter'],
  ['What is the biggest desert in the world (by area)?', 'Antarctic', 'Sahara', 'Gobi', 'Arabian'], ['Which sense does the nose give us?', 'Smell', 'Taste', 'Touch', 'Hearing'],
  ['What is the boiling point of water in Celsius at sea level?', '100', '90', '110', '212'], ['Who discovered that the Earth orbits the Sun, a model published in 1543?', 'Copernicus', 'Newton', 'Darwin', 'Edison'],
  ['What is the plural of mouse (the animal)?', 'Mice', 'Mouses', 'Meese', 'Mices'], ['What is the longest bone in the human body?', 'Femur', 'Spine', 'Humerus', 'Tibia'],
  ['Which country is shaped like a boot?', 'Italy', 'Spain', 'Greece', 'Portugal'], ['What is 7 times 8?', '56', '54', '49', '63'],
];
const TRIVIA_N = 10, TRIVIA_MS = 15000;
function triviaAsk(s) {
  const t = TRIVIA[s.order[s.i]], opts = [t[1], t[2], t[3], t[4]];
  for (let i = 3; i > 0; i--) { const j = rnd(i + 1); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  s.cur = { q: t[0], opts, ans: t[1] }; s.shownAt = Date.now();
  return { i: s.i, n: TRIVIA_N, q: t[0], opts, ms: TRIVIA_MS };
}
// ---------------------------------------------------------------- color (Stroop: name the ink, not the word)
const COLORS = ['red', 'blue', 'green', 'yellow'], COLOR_MS = 30000;
function colorQ(s) { const word = COLORS[rnd(4)]; let ink = COLORS[rnd(4)]; if (rnd(4) !== 0) while (ink === word) ink = COLORS[rnd(4)]; s.cur = { word, ink }; s.shownAt = Date.now(); return { word, ink }; }
// ---------------------------------------------------------------- pattern (what comes next)
const PATTERN_N = 12, PATTERN_MS = 25000;
function patternQ(level) {
  const r = (lo, hi) => lo + rnd(hi - lo + 1); let seq = [];
  const kind = rnd(level <= 1 ? 2 : level === 2 ? 4 : 6);
  if (kind === 0) { const a = r(1, 20), d = r(2, 9); for (let i = 0; i < 6; i++) seq.push(a + d * i); }                    // counting up by a step
  else if (kind === 1) { const a = r(60, 99), d = r(3, 11); for (let i = 0; i < 6; i++) seq.push(a - d * i); }              // counting down
  else if (kind === 2) { const a = r(1, 4), m = r(2, 3); for (let i = 0; i < 6; i++) seq.push(a * Math.pow(m, i)); }         // doubling or tripling
  else if (kind === 3) { const a = r(1, 8); for (let i = 0; i < 6; i++) seq.push((a + i) * (a + i)); }                       // square numbers
  else if (kind === 4) { seq = [r(1, 4), r(2, 6)]; for (let i = 2; i < 7; i++) seq.push(seq[i - 1] + seq[i - 2]); }          // each is the sum of the two before
  else { let v = r(2, 9); const d = r(1, 3); for (let i = 0; i < 6; i++) { seq.push(v); v += d + i; } }                       // gaps that grow
  const ans = seq.pop(); if (seq.length > 5) seq = seq.slice(-5);
  return { seq, ans };
}
// ---------------------------------------------------------------- scramble (unjumble the word)
const WORDS = ('planet ocean garden window pencil rocket castle forest bridge island market jungle dragon silver purple yellow orange button candle camera guitar monkey turtle rabbit butter cookie dinner hammer helmet ladder magnet mirror pillow pocket school summer winter tunnel valley wizard zombie anchor basket cactus desert engine farmer galaxy hunter insect jacket kitten lemon nature office parrot quartz ribbon shadow thunder velvet whistle yogurt cheese bottle puzzle laptop screen keyboard battery diamond volcano penguin giraffe dolphin freezer blanket picture station teacher library triangle holiday journey weather balloon pumpkin chicken crystal mission network program science history planet').split(' ').filter((w, i, a) => a.indexOf(w) === i);
const SCRAMBLE_MS = 45000;
function scrambleQ(s) {
  const w = WORDS[rnd(WORDS.length)]; let a = w.split('');
  for (let tries = 0; tries < 8; tries++) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } if (a.join('') !== w) break; }
  s.cur = { w }; s.shownAt = Date.now(); return { s: a.join(''), len: w.length };
}

export function handleArcade(path, body, env) {
  const m = path.match(/^\/api\/casino\/g\/arcade(?:\/([a-z]+))?$/); if (!m) return null;
  const act = m[1] || 'info', cid = env.cid;
  for (const [k, v] of sessions) if (Date.now() - v.at > ARC.idleMs) sessions.delete(k);
  if (act === 'info') return { ok: true, games: ARCADE_GAMES, ...view(env), profile: env.publicProfile() };
  if (act === 'board') {   // the Arcade high-score board: everyone's best round per game
    if (!boardCache || Date.now() - boardCache.at > 20000) {
      const users = (env.users && env.users()) || {}, all = {};
      for (const g of ARCADE_GAMES) {
        const rows = [];
        for (const id in users) { const u = users[id], sc = u && u.arc && u.arc.best && u.arc.best[g]; if (sc > 0) rows.push({ id, nick: String(u.nick || 'player').slice(0, 24), score: sc }); }
        rows.sort((a, b) => b.score - a.score); all[g] = rows.slice(0, 10);
      }
      boardCache = { at: Date.now(), all };
    }
    const boards = {}; for (const g of ARCADE_GAMES) boards[g] = boardCache.all[g].map((r) => ({ nick: r.nick, score: r.score, me: r.id === cid }));
    return { ok: true, boards };
  }
  const g = gate(env); if (g) return g;
  let s = sessions.get(cid);

  if (act === 'start') {
    const game = String(body.game || ''); if (!ARCADE_GAMES.includes(game)) return { error: 'bad-game' };
    if (acct(env.p).earned >= ARC.dayCap) return { ...reply(env, null, {}), ok: false, error: 'capped', message: 'You hit today’s Arcade limit. It resets at midnight UTC.' };
    s = { game, cid, at: Date.now(), startedAt: Date.now(), earned: 0, counted: false };
    if (game === 'echo') { s.seq = [rnd(4), rnd(4), rnd(4)]; s.round = 1; s.shownAt = Date.now(); }
    if (game === 'aim') { s.i = 0; s.pts = 0; s.miss = 0; s.t = aimTarget(0); s.shownAt = Date.now(); }
    if (game === 'math') { s.endsAt = Date.now() + MATH_MS; s.ok = 0; s.streak = 0; s.level = 1; s.qq = mathQ(1); s.shownAt = Date.now(); }
    if (game === 'trivia') { const idx = TRIVIA.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = rnd(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; } s.order = idx.slice(0, TRIVIA_N); s.i = 0; s.ok = 0; s.streak = 0; }
    if (game === 'color') { s.endsAt = Date.now() + COLOR_MS; s.ok = 0; s.streak = 0; }
    if (game === 'pattern') { s.i = 0; s.ok = 0; s.level = 1; }
    if (game === 'scramble') { s.endsAt = Date.now() + SCRAMBLE_MS; s.ok = 0; s.skips = 0; }
    sessions.set(cid, s);
    if (game === 'trivia') return reply(env, s, { game, ...triviaAsk(s) });
    if (game === 'color') return reply(env, s, { game, ms: COLOR_MS, ...colorQ(s) });
    if (game === 'pattern') { const q = patternQ(1); s.cur = q; s.shownAt = Date.now(); return reply(env, s, { game, i: 0, n: PATTERN_N, seq: q.seq, ms: PATTERN_MS, level: 1 }); }
    if (game === 'scramble') return reply(env, s, { game, ms: SCRAMBLE_MS, ...scrambleQ(s) });
    if (game === 'echo') return reply(env, s, { game, seq: s.seq, round: 1 });
    if (game === 'aim') return reply(env, s, { game, n: AIM_N, i: 0, t: s.t, life: AIM_LIFE });
    return reply(env, s, { game, q: s.qq.q, ms: MATH_MS, level: 1 });
  }
  if (!s) return { error: 'no-round', message: 'Start a round first.' };
  s.at = Date.now();

  if (act === 'end') {
    sessions.delete(cid);
    return reply(env, s, { done: true, game: s.game, score: s.game === 'echo' ? s.round - 1 : s.game === 'aim' ? s.pts : s.ok || 0 });
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
      const at = aimPos(s.t, el), moving = s.t.vx || s.t.vy, dx = cx - at.x, dy = (cy - at.y) * 0.5625;   // the arena is 16:9
      if (!Number.isFinite(cx) || !Number.isFinite(cy) || Math.hypot(dx, dy) > s.t.r + 0.6 + (moving ? 2.4 : 0) || el < 110 || el > AIM_LIFE + 900) { s.miss++; s.pts = Math.max(0, s.pts - 1); return reply(env, s, { game: 'aim', hit: false, i: s.i, pts: s.pts, t: s.t, life: AIM_LIFE, miss: true }); }
      hit = true; const p = (el < 700 ? 3 : el < 1250 ? 2 : 1) * (s.t.gold ? 2 : 1); s.pts += p; gain = award(env, s, p * 5);
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

  // ---- trivia: ten questions, fifteen seconds each. A quick right answer pays a little extra.
  if (s.game === 'trivia') {
    const el = Date.now() - s.shownAt; let correct = false, gain = 0;
    if (body.timeout) { if (el < TRIVIA_MS - 400) return { error: 'early' }; }
    else { const pick = Math.floor(Number(body.pick)); if (el < 500) return reply(env, s, { game: 'trivia', tooFast: true }); if (pick >= 0 && pick < 4 && s.cur.opts[pick] === s.cur.ans && el <= TRIVIA_MS + 1200) { correct = true; s.ok++; s.streak++; gain = award(env, s, 15 + (el < 5000 ? 10 : 0) + (s.streak >= 3 ? 5 : 0)); } }
    if (!correct) s.streak = 0;
    const answer = s.cur.ans; s.i++;
    if (s.i >= TRIVIA_N) { best(env, 'trivia', s.ok); sessions.delete(cid); return reply(env, s, { game: 'trivia', over: true, correct, gain, answer, score: s.ok }); }
    return reply(env, s, { game: 'trivia', correct, gain, answer, ok: s.ok, streak: s.streak, ...triviaAsk(s) });
  }
  // ---- color: pick the ink the word is printed in, not the word it spells. 30 seconds.
  if (s.game === 'color') {
    const now = Date.now();
    if (now > s.endsAt + 1500 || body.finish) { best(env, 'color', s.ok); sessions.delete(cid); return reply(env, s, { game: 'color', over: true, score: s.ok }); }
    if (now - s.shownAt < 280) return reply(env, s, { game: 'color', tooFast: true, ...s.cur, left: Math.max(0, s.endsAt - now) });
    const right = String(body.c) === s.cur.ink; let gain = 0;
    if (right) { s.ok++; s.streak++; gain = award(env, s, 6 + (s.streak >= 5 ? 2 : 0)); } else s.streak = 0;
    return reply(env, s, { game: 'color', correct: right, gain, ok: s.ok, left: Math.max(0, s.endsAt - Date.now()), ...colorQ(s) });
  }
  // ---- pattern: what number comes next? Twelve of them, getting trickier.
  if (s.game === 'pattern') {
    const el = Date.now() - s.shownAt; let correct = false, gain = 0;
    if (body.timeout) { if (el < PATTERN_MS - 400) return { error: 'early' }; }
    else { if (el < 600) return reply(env, s, { game: 'pattern', tooFast: true }); const v = Math.floor(Number(body.v)); if (Number.isFinite(v) && v === s.cur.ans && el <= PATTERN_MS + 1200) { correct = true; s.ok++; gain = award(env, s, 10 + s.level * 5); } }
    const answer = s.cur.ans; s.i++; s.level = Math.min(4, 1 + Math.floor(s.i / 3));
    if (s.i >= PATTERN_N) { best(env, 'pattern', s.ok); sessions.delete(cid); return reply(env, s, { game: 'pattern', over: true, correct, gain, answer, score: s.ok }); }
    const q = patternQ(s.level); s.cur = q; s.shownAt = Date.now();
    return reply(env, s, { game: 'pattern', correct, gain, answer, ok: s.ok, i: s.i, n: PATTERN_N, seq: q.seq, ms: PATTERN_MS, level: s.level });
  }
  // ---- scramble: unjumble as many words as you can in 45 seconds.
  if (s.game === 'scramble') {
    const now = Date.now();
    if (now > s.endsAt + 1500 || body.finish) { best(env, 'scramble', s.ok); sessions.delete(cid); return reply(env, s, { game: 'scramble', over: true, score: s.ok }); }
    if (body.skip) { if (s.skips >= 5) return reply(env, s, { game: 'scramble', noSkips: true, left: Math.max(0, s.endsAt - now) }); s.skips++; return reply(env, s, { game: 'scramble', skipped: true, skips: s.skips, left: Math.max(0, s.endsAt - now), ...scrambleQ(s) }); }
    if (now - s.shownAt < 700) return reply(env, s, { game: 'scramble', tooFast: true });
    const w = String(body.w || '').toLowerCase().trim(); let gain = 0, correct = false;
    if (w === s.cur.w) { correct = true; s.ok++; gain = award(env, s, 5 + s.cur.w.length * 2); return reply(env, s, { game: 'scramble', correct, gain, ok: s.ok, left: Math.max(0, s.endsAt - Date.now()), ...scrambleQ(s) }); }
    return reply(env, s, { game: 'scramble', correct: false, ok: s.ok, left: Math.max(0, s.endsAt - now) });
  }
  return { error: 'bad-action' };
}
