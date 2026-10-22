// ============================================================
// Skribbl-style multiplayer draw & guess.
// Self-contained game server over WebSockets (ws), noServer mode.
// server.js routes /skribbl-ws upgrades here.
// ============================================================
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ noServer: true });

const WORDS = (
  'apple banana rocket pizza guitar dragon rainbow castle robot pirate ninja zombie ' +
  'volcano island anchor cactus diamond igloo jungle kangaroo lighthouse mushroom ' +
  'octopus parachute pyramid sandwich telescope umbrella vampire waterfall windmill ' +
  'xylophone yachtballoon basketball butterfly campfire dinosaur dolphin elephant ' +
  'firework flamingo football giraffe hamburger helicopter icecream jellyfish koala ' +
  'lemonade lightning mountain penguin rainbowcake scarecrow snowman spaceship ' +
  'spider starfish strawberry submarine sunflower tornado tractor treasure unicorn ' +
  'wizard alien angel banana bridge bubble cactus candle cherry cloud crown donut ' +
  'dragonfly feather fountain ghost gingerbread hammock hedgehog iceberg kite ladder ' +
  'lollipop meteor mermaid moon mountain mushroom narwhal otter owl panda peacock ' +
  'pineapple pumpkin rabbit raccoon rainbow river rocket sandcastle seahorse shark ' +
  'skateboard sloth snail snowflake squirrel surfboard swing tent tiger toaster ' +
  'tulip turtle violin walrus watermelon whale wheel yoyo zebra'
).split(/\s+/).filter(Boolean);

const rooms = new Map(); // roomId -> room

const DRAW_TIME = 75;     // seconds to draw
const PICK_TIME = 12;     // seconds to pick a word
const INTER_TIME = 6;     // seconds between turns
const MAX_ROUNDS = 3;     // full rotations before a match resets

function makeRoom(id) {
  const room = {
    id,
    players: new Map(), // ws -> {id, name, score, guessed, color}
    order: [],          // player ids in turn order
    turnIndex: -1,
    roundNum: 1,
    phase: 'lobby',     // lobby | pick | draw | intermission | over
    drawerId: '',
    word: '',
    wordChoices: [],
    timeLeft: 0,
    strokes: [],        // kept so late joiners / re-renders can catch up
    hints: 0,
    tick: null,
  };
  rooms.set(id, room);
  return room;
}

function pid() { return 'p' + Math.random().toString(36).slice(2, 9); }
function pickWords(n) {
  const out = [];
  while (out.length < n) { const w = WORDS[(Math.random() * WORDS.length) | 0]; if (!out.includes(w)) out.push(w); }
  return out;
}
function mask(word, hints) {
  let shown = 0;
  return word.split('').map((ch, i) => {
    if (ch === ' ') return ' ';
    if (i < hints) { shown++; return ch; }
    return '_';
  }).join('');
}
function roster(room) {
  return [...room.players.values()].map((p) => ({ id: p.id, name: p.name, score: p.score, color: p.color, guessed: p.guessed, drawer: p.id === room.drawerId }))
    .sort((a, b) => b.score - a.score);
}
function send(ws, obj) { try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) {} }
function broadcast(room, obj, exceptWs) { for (const ws of room.players.keys()) { if (ws !== exceptWs) send(ws, obj); } }
function sysChat(room, text, kind) { broadcast(room, { t: 'chat', name: '', text, kind: kind || 'sys' }); }

function pushState(room) {
  for (const [ws, p] of room.players) {
    send(ws, {
      t: 'state',
      room: room.id,
      phase: room.phase,
      you: p.id,
      drawerId: room.drawerId,
      roundNum: room.roundNum,
      maxRounds: MAX_ROUNDS,
      timeLeft: room.timeLeft,
      players: roster(room),
      // The drawer sees the real word; everyone else sees the mask.
      word: room.phase === 'draw' ? (p.id === room.drawerId ? room.word : mask(room.word, room.hints)) : '',
      wordLen: room.word ? room.word.replace(/ /g, '').length : 0,
      // Only the drawer who is choosing gets the word choices.
      choices: (room.phase === 'pick' && p.id === room.drawerId) ? room.wordChoices : [],
    });
  }
}

function startTick(room) {
  if (room.tick) return;
  room.tick = setInterval(() => stepRoom(room), 1000);
}
function stopTick(room) { if (room.tick) { clearInterval(room.tick); room.tick = null; } }

function beginTurn(room) {
  const ids = [...room.players.values()].map((p) => p.id);
  if (ids.length < 2) { room.phase = 'lobby'; room.drawerId = ''; room.word = ''; stopTick(room); pushState(room); return; }
  room.turnIndex++;
  if (room.turnIndex >= room.order.length) {
    // rotation finished
    room.roundNum++;
    room.turnIndex = 0;
    if (room.roundNum > MAX_ROUNDS) { endMatch(room); return; }
  }
  // Rebuild order to include anyone who joined mid-match.
  if (room.turnIndex === 0) room.order = ids;
  const drawerId = room.order[room.turnIndex];
  if (!drawerId || !ids.includes(drawerId)) { return beginTurn(room); }
  room.drawerId = drawerId;
  room.phase = 'pick';
  room.word = '';
  room.hints = 0;
  room.strokes = [];
  room.wordChoices = pickWords(3);
  room.timeLeft = PICK_TIME;
  for (const p of room.players.values()) p.guessed = false;
  broadcast(room, { t: 'clear' });
  const drawerName = nameOf(room, drawerId);
  sysChat(room, drawerName + ' is choosing a word…', 'sys');
  pushState(room);
}
function nameOf(room, id) { for (const p of room.players.values()) if (p.id === id) return p.name; return '?'; }

function startDrawing(room, word) {
  room.word = word;
  room.phase = 'draw';
  room.hints = 0;
  room.timeLeft = DRAW_TIME;
  room.strokes = [];
  broadcast(room, { t: 'clear' });
  sysChat(room, nameOf(room, room.drawerId) + ' is drawing now!', 'sys');
  pushState(room);
}

function endTurn(room, reason) {
  room.phase = 'intermission';
  room.timeLeft = INTER_TIME;
  broadcast(room, { t: 'roundEnd', word: room.word, players: roster(room), reason: reason || '' });
  sysChat(room, 'The word was "' + room.word + '"', 'reveal');
  pushState(room);
}

function endMatch(room) {
  room.phase = 'over';
  room.timeLeft = INTER_TIME + 4;
  broadcast(room, { t: 'matchEnd', players: roster(room) });
  sysChat(room, '🏆 Match over! ' + (roster(room)[0] ? roster(room)[0].name + ' wins!' : ''), 'reveal');
  pushState(room);
}

function stepRoom(room) {
  if (room.players.size < 2 && room.phase !== 'lobby') {
    room.phase = 'lobby'; room.drawerId = ''; room.word = ''; stopTick(room); pushState(room); return;
  }
  if (room.timeLeft > 0) room.timeLeft--;

  if (room.phase === 'pick') {
    if (room.timeLeft <= 0) startDrawing(room, room.wordChoices[0]);
    else pushState(room);
    return;
  }
  if (room.phase === 'draw') {
    // Reveal a letter as a hint at 2/3 and 1/3 time remaining.
    const twoThird = Math.floor(DRAW_TIME / 3);
    if (room.timeLeft === DRAW_TIME - twoThird && room.hints < 1) { room.hints = 1; }
    else if (room.timeLeft === Math.floor(DRAW_TIME / 3) && room.hints < 2) { room.hints = 2; }
    const everyoneGuessed = [...room.players.values()].filter((p) => p.id !== room.drawerId).every((p) => p.guessed) && room.players.size > 1;
    if (room.timeLeft <= 0 || everyoneGuessed) { endTurn(room, everyoneGuessed ? 'all' : 'time'); return; }
    pushState(room);
    return;
  }
  if (room.phase === 'intermission' || room.phase === 'over') {
    if (room.timeLeft <= 0) {
      if (room.phase === 'over') { room.roundNum = 1; room.turnIndex = -1; for (const p of room.players.values()) p.score = 0; }
      beginTurn(room);
    }
    return;
  }
}

function maybeStart(room) {
  if (room.phase === 'lobby' && room.players.size >= 2) {
    room.order = [...room.players.values()].map((p) => p.id);
    room.turnIndex = -1;
    room.roundNum = 1;
    startTick(room);
    beginTurn(room);
  }
}

function handleGuess(room, ws, p, text) {
  text = String(text || '').slice(0, 120).trim();
  if (!text) return;
  // The drawer can't guess; just relay their chatter to others.
  if (room.phase === 'draw' && p.id !== room.drawerId && !p.guessed) {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (norm(text) === norm(room.word)) {
      p.guessed = true;
      // Earlier guesses score more; drawer earns a cut per correct guess.
      const gain = 100 + Math.max(0, room.timeLeft) * 4;
      p.score += gain;
      const drawer = [...room.players.values()].find((d) => d.id === room.drawerId);
      if (drawer) drawer.score += 35;
      send(ws, { t: 'youGuessed', gain });
      broadcast(room, { t: 'chat', name: p.name, text: ' guessed the word! (+' + gain + ')', kind: 'correct' });
      broadcast(room, { t: 'correct', id: p.id });
      pushState(room);
      return;
    }
    // "Close" nudge when within one character.
    if (close(norm(text), norm(room.word))) send(ws, { t: 'chat', name: '', text: '"' + text + '" is close!', kind: 'close' });
  }
  // Normal chat (hide messages that contain the exact word while drawing).
  if (room.phase === 'draw' && room.word && String(text).toLowerCase().includes(room.word.toLowerCase()) && p.id !== room.drawerId) return;
  broadcast(room, { t: 'chat', name: p.name, text: ': ' + text, kind: 'msg' });
}
function close(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let diff = 0; const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) diff++;
  return diff <= 2 && a.length > 2;
}

function cleanName(n) {
  n = String(n || 'Guest').slice(0, 20).replace(/[<>]/g, '').trim();
  return n || 'Guest';
}
const COLORS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#b185ff', '#f78c6b', '#9bffb0', '#ff9ff3'];

export function handleSkribblUpgrade(req, socket, head) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    let room = null, player = null;
    ws.on('message', (buf) => {
      let msg; try { msg = JSON.parse(buf.toString()); } catch (e) { return; }
      if (!msg || typeof msg.t !== 'string') return;

      if (msg.t === 'join') {
        const rid = String(msg.room || 'public').slice(0, 24).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'public';
        room = rooms.get(rid) || makeRoom(rid);
        player = { id: pid(), name: cleanName(msg.name), score: 0, guessed: false, color: COLORS[room.players.size % COLORS.length] };
        room.players.set(ws, player);
        send(ws, { t: 'joined', you: player.id, room: rid });
        sysChat(room, player.name + ' joined', 'join');
        pushState(room);
        maybeStart(room);
        return;
      }
      if (!room || !player) return;

      if (msg.t === 'draw' && player.id === room.drawerId && room.phase === 'draw') {
        const s = { x0: +msg.x0, y0: +msg.y0, x1: +msg.x1, y1: +msg.y1, c: String(msg.c || '#111').slice(0, 9), w: Math.min(60, Math.max(1, +msg.w || 4)) };
        room.strokes.push(s);
        if (room.strokes.length > 6000) room.strokes.shift();
        broadcast(room, { t: 'draw', ...s }, ws);
        return;
      }
      if (msg.t === 'fill' && player.id === room.drawerId && room.phase === 'draw') {
        const c = String(msg.c || '#fff').slice(0, 9);
        room.strokes.push({ fill: c });
        broadcast(room, { t: 'fill', c }, ws);
        return;
      }
      if (msg.t === 'clear' && player.id === room.drawerId) {
        room.strokes = [];
        broadcast(room, { t: 'clear' });
        return;
      }
      if (msg.t === 'pick' && player.id === room.drawerId && room.phase === 'pick') {
        const w = String(msg.word || '');
        if (room.wordChoices.includes(w)) startDrawing(room, w);
        return;
      }
      if (msg.t === 'guess') { handleGuess(room, ws, player, msg.text); return; }
      if (msg.t === 'skip' && player.id === room.drawerId && (room.phase === 'draw' || room.phase === 'pick')) {
        endTurn(room, 'skip'); return;
      }
    });

    ws.on('close', () => {
      if (!room || !player) return;
      const wasDrawer = player.id === room.drawerId;
      room.players.delete(ws);
      sysChat(room, player.name + ' left', 'leave');
      if (room.players.size === 0) { stopTick(room); rooms.delete(room.id); return; }
      if (room.players.size < 2) { room.phase = 'lobby'; room.drawerId = ''; room.word = ''; stopTick(room); broadcast(room, { t: 'clear' }); pushState(room); return; }
      if (wasDrawer && (room.phase === 'draw' || room.phase === 'pick')) endTurn(room, 'left');
      else pushState(room);
    });

    ws.on('error', () => {});
  });
}
