/* ============================================================
   Scrolls Casino 2D — multiplayer game panels.
   Shared Crash / Roulette / Big Wheel rounds, seated Blackjack
   tables, and player-vs-player Coinflip & Dice duels. All state
   comes from the server over the world socket (SC.gs).
   ============================================================ */
(function () {
  var SC = window.SC, A = SC.art, fmt = SC.fmt, esc = SC.esc, toast = SC.toast;
  var $ = function (id) { return document.getElementById(id); };
  var gs = SC.gs = { crash: null, roulette: null, wheel: null, bj: {}, duels: [], jp: { pool: 0, last: null } };
  var send = function (o) { SC.netSend(Object.assign({ t: 'g' }, o)); };
  var me = function () { return SC.myId ? SC.myId() : 0; };
  var secs = function (until) { return Math.max(0, Math.ceil((until - SC.now()) / 1000)); };
  var sfx = function (n) { SC.sfx && SC.sfx(n); };
  var cur = { kind: '', data: null };
  var raf = 0;

  // Generic +chip buttons: <button class="chip" data-for="inputId" data-v="100|half|x2|max">
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-for]'); if (!b) return;
    var i = $(b.dataset.for); if (!i) return; var v = b.dataset.v, coins = SC.state.profile ? SC.state.profile.coins : 0;
    if (v === 'max') i.value = coins; else if (v === 'half') i.value = Math.max(1, Math.floor((+i.value || 0) / 2)); else if (v === 'x2') i.value = (+i.value || 0) * 2; else i.value = (+i.value || 0) + +v;
    sfx('chip');
  });
  var amtOf = function (id) { return Math.floor(+$(id).value || 0); };
  function plist(rows) { return rows.length ? rows.join('') : '<div class="hint" style="margin:6px 0">No bets yet — be the first!</div>'; }
  function prow(nick, mine, left, right, rcls, pre) { return '<div class="prow' + (mine ? ' mine' : '') + '"><span class="pn">' + (pre || '') + esc(nick) + (mine ? ' (you)' : '') + '</span><span class="pl">' + left + '</span><span class="pr ' + (rcls || '') + '">' + right + '</span></div>'; }

  // ================================================================ CRASH
  function crashMult() { var c = gs.crash; if (!c) return 1; if (c.phase === 'end') return c.point || 1; if (c.phase !== 'run') return 1; return Math.max(1, Math.floor(Math.exp(c.k * Math.max(0, SC.now() - c.start)) * 100) / 100); }
  SC.crashMult = crashMult;
  function myCrashBet() { var c = gs.crash; if (!c) return null; for (var i = 0; i < c.bets.length; i++) if (c.bets[i].pid === me()) return c.bets[i]; return null; }
  function renderCrash() {
    var c = gs.crash; if (!c) return;
    $('crHist').innerHTML = (c.hist || []).map(function (p) { return '<span class="hchip" style="background:' + (p < 2 ? '#5a2030' : p < 10 ? '#1a5e3a' : '#7a5a00') + '">' + p.toFixed(2) + '×</span>'; }).join('');
    var b = myCrashBet();
    var rows = (c.bets || []).slice().sort(function (x, y) { return y.bet - x.bet; }).map(function (x) {
      var st = x.cashed ? '<b>' + x.cashed.toFixed(2) + '×</b> +' + fmt(x.win - x.bet) : c.phase === 'end' ? 'busted' : c.phase === 'run' ? 'flying…' : (x.auto ? 'auto ' + x.auto + '×' : 'ready');
      return prow(x.nick, x.pid === me(), '📜 ' + fmt(x.bet), st, x.cashed ? 'win' : c.phase === 'end' ? 'lose' : '');
    });
    $('crPlayers').innerHTML = plist(rows);
    crashButton();
  }
  function crashButton() {
    var c = gs.crash, b = myCrashBet(), btn = $('crAct'); if (!c || !btn) return;
    btn.className = 'btn'; btn.disabled = false;
    if (c.phase === 'bet' && !b) { btn.className = 'btn gold'; btn.textContent = 'Place bet'; }
    else if (c.phase === 'bet') { btn.disabled = true; btn.textContent = 'Bet placed ✓  📜 ' + fmt(b.bet); }
    else if (c.phase === 'run' && b && !b.cashed) { btn.className = 'btn green'; btn.textContent = 'Cash out  📜 ' + fmt(Math.floor(b.bet * crashMult())); }
    else if (b && b.cashed) { btn.disabled = true; btn.textContent = 'Cashed at ' + b.cashed.toFixed(2) + '×  (+' + fmt(b.win - b.bet) + ')'; }
    else { btn.disabled = true; btn.textContent = c.phase === 'run' ? 'Round in progress…' : 'Next round soon…'; }
  }
  $('crAct').onclick = function () {
    var c = gs.crash; if (!c) return; var b = myCrashBet();
    if (c.phase === 'bet' && !b) { var amt = amtOf('crBet2'); if (amt < 1) return toast('Enter a valid bet'); send({ g: 'crash', a: 'bet', amt: amt, auto: +$('crAuto').value || 0 }); sfx('chip'); }
    else if (c.phase === 'run' && b && !b.cashed) send({ g: 'crash', a: 'cash' });
  };
  function crashFrame() {
    var c = gs.crash; if (!c) return;
    var m = crashMult(), big = $('crBig'), ph = $('crPhase');
    if (c.phase === 'bet') { ph.textContent = '⏳ Launching in ' + secs(c.until) + 's — place your bets'; big.textContent = 'Ready'; big.style.color = '#93a0c4'; }
    else if (c.phase === 'run') { ph.textContent = '🚀 Flying — cash out before it crashes!'; big.textContent = m.toFixed(2) + '×'; big.style.color = m >= 2 ? '#2bd576' : '#eaf0ff'; }
    else { ph.textContent = '💥 Crashed — next round in ' + secs(c.until) + 's'; big.textContent = '💥 ' + (c.point || 1).toFixed(2) + '×'; big.style.color = '#ff5c6c'; }
    crashButton();
    var cv = $('crCanvas2'), x = cv.getContext('2d'), W = cv.width, H = cv.height; x.clearRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 1; for (var gy = 1; gy < 5; gy++) { x.beginPath(); x.moveTo(0, gy * H / 5); x.lineTo(W, gy * H / 5); x.stroke(); }
    if (c.phase === 'bet') { var p = 1 - (c.until - SC.now()) / 7000; x.fillStyle = 'rgba(92,242,255,.25)'; x.fillRect(0, H - 6, W * Math.max(0, Math.min(1, p)), 6); return; }
    var el = c.phase === 'run' ? SC.now() - c.start : Math.log(c.point || 1) / c.k, tMax = Math.max(el, 8000), top = Math.max(2, m * 1.15);
    var X = function (tt) { return 12 + (tt / tMax) * (W - 24); }, Y = function (mm) { return H - 12 - (mm - 1) / (top - 1) * (H - 30); };
    x.beginPath(); x.moveTo(X(0), Y(1)); for (var i = 1; i <= 60; i++) { var tt = el * i / 60; x.lineTo(X(tt), Y(Math.exp(c.k * tt))); }
    var col = c.phase === 'end' ? '#ff5252' : '#5cf2ff'; x.strokeStyle = col; x.lineWidth = 4; x.lineJoin = 'round'; x.stroke();
    x.lineTo(X(el), H - 12); x.lineTo(X(0), H - 12); x.closePath(); var gd = x.createLinearGradient(0, 0, 0, H); gd.addColorStop(0, c.phase === 'end' ? 'rgba(255,82,82,.35)' : 'rgba(92,242,255,.35)'); gd.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gd; x.fill();
    (c.bets || []).forEach(function (b) { if (!b.cashed) return; var tt = Math.log(b.cashed) / c.k; if (tt > el) return; x.fillStyle = '#2bd576'; x.beginPath(); x.arc(X(tt), Y(b.cashed), 4, 0, 7); x.fill(); x.fillStyle = '#dfffe9'; x.font = '600 11px Fredoka, sans-serif'; x.fillText(b.nick, X(tt) + 6, Y(b.cashed) - 6); });
    x.font = '26px serif'; x.fillText(c.phase === 'end' ? '💥' : '🚀', X(el) - 13, Y(m) + 8);
  }

  // ================================================================ ROULETTE (animated scene)
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var rColor = function (n) { return n === 0 ? 'green' : REDS.indexOf(n) >= 0 ? 'red' : 'black'; };
  var lastRoul = null, rlHover = null;
  var TOKENS = [[10, '#e9ecef', 1], [50, '#e63946'], [100, '#2bd576'], [500, '#9b5de5'], [1000, '#111827', 1], [5000, '#7b2cbf']];
  function tray(el, onPick, sel) {
    el.innerHTML = TOKENS.map(function (t) { return '<button class="ctok' + (t[2] ? ' dark' : '') + (t[0] === sel ? ' on' : '') + '" style="--c:' + t[1] + (t[0] === 10 ? ';color:#3a86ff' : '') + '" data-tok="' + t[0] + '">' + (t[0] >= 1000 ? t[0] / 1000 + 'K' : t[0]) + '</button>'; }).join('');
    el.querySelectorAll('[data-tok]').forEach(function (b) { b.onclick = function () { onPick(+b.dataset.tok, b); sfx('chip'); }; });
  }
  tray($('rlTray'), function (v, b) { $('rlAmt').value = v; $('rlTray').querySelectorAll('.ctok').forEach(function (x) { x.classList.toggle('on', x === b); }); }, 100);
  $('rlScene').addEventListener('click', function (e) {
    var ch = SC.scene.roulCellAt($('rlScene'), e); if (!ch) return;
    var r = gs.roulette; if (!r || r.phase !== 'bet') return toast('No more bets — wait for the next spin');
    send({ g: 'roulette', a: 'bet', choice: ch === '0' ? '0' : ch, amt: amtOf('rlAmt') }); sfx('chip');
  });
  $('rlScene').addEventListener('mousemove', function (e) { rlHover = SC.scene.roulCellAt($('rlScene'), e); });
  $('rlScene').addEventListener('mouseleave', function () { rlHover = null; });
  $('rlClear').onclick = function (e) { e.preventDefault(); send({ g: 'roulette', a: 'clear' }); sfx('click'); };
  function renderRoul() {
    var r = gs.roulette; if (!r) return;
    $('rlHist').innerHTML = (r.hist || []).map(function (n) { return '<span class="hchip ' + rColor(n) + '">' + n + '</span>'; }).join('');
    var per = {};
    (r.bets || []).forEach(function (b) { var k = b.pid; per[k] = per[k] || { nick: b.nick, pid: b.pid, amt: 0, list: [] }; per[k].amt += b.amt; per[k].list.push(b.choice); });
    $('rlPlayers').innerHTML = plist(Object.keys(per).map(function (k) { var p = per[k]; var uniq = p.list.filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 6).join(', '); return prow(p.nick, p.pid === me(), '📜 ' + fmt(p.amt), esc(uniq), '', '<span class="dot" style="background:' + SC.pidColor(p.pid) + ';margin:0 6px 0 0"></span>'); }));
  }
  function roulFrame() {
    var r = gs.roulette; if (!r) return;
    $('rlPhase').textContent = r.phase === 'bet' ? '🪙 Bets close in ' + secs(r.until) + 's' : '🎡 No more bets — spinning…';
    SC.scene.roulette($('rlScene'), r, SC.roulView(), performance.now() / 1000, me(), SC.lookOfPid, r.phase === 'bet' ? rlHover : null);
  }

  // ================================================================ BIG WHEEL
  var WLAB = { grey: '2×', blue: '3×', green: '6×', gold: '30×' };
  document.querySelectorAll('[data-whc]').forEach(function (b) {
    b.onclick = function () { var amt = amtOf('whAmt'); if (amt < 1) return toast('Enter a bet'); send({ g: 'wheel', a: 'bet', color: b.dataset.whc, amt: amt }); sfx('chip'); };
  });
  function renderWheel() {
    var w = gs.wheel; if (!w) return;
    $('whHist').innerHTML = (w.hist || []).map(function (c) { return '<span class="hchip" style="background:' + A.WHEEL_COL[c] + ';color:' + (c === 'gold' ? '#3a2600' : '#fff') + '">' + WLAB[c] + '</span>'; }).join('');
    var tot = { grey: 0, blue: 0, green: 0, gold: 0 }, mine = { grey: 0, blue: 0, green: 0, gold: 0 }, per = {};
    (w.bets || []).forEach(function (b) { tot[b.color] += b.amt; if (b.pid === me()) mine[b.color] += b.amt; per[b.pid] = per[b.pid] || { nick: b.nick, pid: b.pid, list: [] }; per[b.pid].list.push(b); });
    Object.keys(tot).forEach(function (k) { $('whT_' + k).textContent = tot[k] ? '📜 ' + fmt(tot[k]) + (mine[k] ? ' (you ' + fmt(mine[k]) + ')' : '') : '—'; });
    $('whPlayers').innerHTML = plist(Object.keys(per).map(function (k) { var p = per[k]; var amt = p.list.reduce(function (a, b) { return a + b.amt; }, 0); return prow(p.nick, p.pid === me(), '📜 ' + fmt(amt), p.list.map(function (b) { return '<span class="dot" style="background:' + A.WHEEL_COL[b.color] + '"></span>'; }).join('')); }));
  }
  function wheelFrame() {
    var w = gs.wheel; if (!w) return;
    $('whPhase').textContent = w.phase === 'bet' ? '🎡 Spinning in ' + secs(w.until) + 's — pick a color' : '🎡 Spinning…';
    var cv = $('whCanvas'), x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
    var R = cv.width * 0.4; A.drawBigWheel(x, cv.width / 2, cv.height / 2 + 8, R, w.segs || A.DEFAULT_WHEEL, SC.wheelAngle ? SC.wheelAngle() : 0, performance.now() / 1000, w.phase === 'spin');
  }

  // ================================================================ BLACKJACK (animated scene)
  var lastTurnKey = '', bjPending = -1;
  function mySeat(T) { if (!T) return -1; for (var i = 0; i < T.seats.length; i++) if (T.seats[i] && T.seats[i].pid === me()) return i; return -1; }
  $('bjScene').addEventListener('click', function (e) {
    var id = cur.data && cur.data.table, T = gs.bj[id]; if (!T) return;
    var i = SC.scene.bjSeatAt($('bjScene'), e); if (i < 0 || T.seats[i]) return;
    if (mySeat(T) >= 0) return toast('Leave your seat first to move');
    send({ g: 'bj', a: 'sit', table: id, seat: i }); if (SC.walkToSeat) SC.walkToSeat(id, i); sfx('click');
  });
  function renderBj() {
    var id = cur.data && cur.data.table, T = gs.bj[id]; if (!T) return;
    var mi = mySeat(T), s = mi >= 0 ? T.seats[mi] : null, ctl = $('bjCtl');
    if (!s) { ctl.innerHTML = '<div class="hint center" style="margin-top:10px">👆 Click an empty <b>SIT HERE</b> spot on the table to join.</div>'; return; }
    var h = '';
    if ((T.phase === 'idle' || T.phase === 'bet') && !s.bet) {
      if (bjPending < 0) bjPending = SC._bjLast || 100;
      h += '<div class="chiptray" id="bjTray"></div><div class="bjbetline">Your bet: <span style="color:var(--gold)">📜 ' + fmt(bjPending) + '</span><button class="chip" id="bjClr">Clear</button><button class="btn gold" id="bjBetGo">Place bet</button></div>';
    } else if (T.phase === 'play' && T.turn === mi) h += '<div class="betrow c" style="margin-top:12px"><button class="btn green" data-bja="hit">🃏 Hit</button><button class="btn red" data-bja="stand">✋ Stand</button>' + (s.hand.length === 2 ? '<button class="btn blue" data-bja="double">💰 Double</button>' : '') + '</div>';
    else if (s.bet) h += '<div class="hint center" style="margin-top:10px">Bet in: 📜 ' + fmt(s.bet) + (s.dbl ? ' (doubled)' : '') + '</div>';
    h += '<div class="betrow c"><button class="chip" id="bjLeave">Leave seat</button></div>';
    ctl.innerHTML = h;
    var trayEl = $('bjTray');
    if (trayEl) {
      tray(trayEl, function (v) { bjPending += v; renderBj(); }, 0);
      $('bjClr').onclick = function () { bjPending = 0; renderBj(); };
      $('bjBetGo').onclick = function () { if (bjPending < 1) return toast('Add some chips first'); SC._bjLast = bjPending; send({ g: 'bj', a: 'bet', table: id, amt: bjPending }); bjPending = -1; sfx('chip'); };
    }
    ctl.querySelectorAll('[data-bja]').forEach(function (b) { b.onclick = function () { send({ g: 'bj', a: b.dataset.bja }); sfx('card'); }; });
    $('bjLeave').onclick = function () { send({ g: 'bj', a: 'leave' }); };
  }
  function bjFrame() {
    var id = cur.data && cur.data.table, T = gs.bj[id];
    SC.scene.bj($('bjScene'), T, performance.now() / 1000, me(), SC.lookOfPid);
    if (!T) return;
    var mi = mySeat(T), ph = $('bjPhase');
    if (T.phase === 'idle') ph.textContent = '🃏 Sit down and place a bet to start a hand';
    else if (T.phase === 'bet') ph.textContent = '⏳ Dealing in ' + secs(T.until) + 's — place your bets';
    else if (T.phase === 'play') { var s = T.seats[T.turn]; ph.textContent = T.turn === mi ? '👉 Your turn! (' + secs(T.until) + 's)' : '⏳ ' + (s ? s.nick : '…') + "'s turn (" + secs(T.until) + 's)'; }
    else if (T.phase === 'dealer') ph.textContent = '🃏 Dealer plays…';
    else ph.textContent = '✅ Hand over — next hand in ' + secs(T.until) + 's';
  }

  // ================================================================ DUELS
  var duelGame = 'flip', duelTab = 'duel', pick = 'heads', recent = [];
  document.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { pick = b.dataset.pick; document.querySelectorAll('[data-pick]').forEach(function (x) { x.classList.toggle('on', x === b); }); sfx('click'); }; });
  $('duCreate').onclick = function () {
    var a = amtOf('duAmt'); if (a < 1) return toast('Enter a stake');
    var g = cur.kind === 'duels' ? $('duGame').value : duelGame;
    send({ g: 'duel', a: 'create', game: g, amt: a, pick: pick }); sfx('chip');
  };
  function renderDuels() {
    var list = gs.duels || [], show = list.filter(function (d) { return d.state === 'open' && (cur.kind === 'duels' || d.game === duelGame); });
    $('duList').innerHTML = show.length ? show.map(function (d) {
      var mine = d.a.pid === me(), forMe = d.target === me(), locked = d.target && !forMe && !mine;
      var info = d.game === 'flip' ? (d.a.pick === 'heads' ? 'they pick Heads — you get Tails' : 'they pick Tails — you get Heads') : 'highest roll (1–100) wins';
      var btn = mine ? '<button class="chip" data-dcancel="' + d.id + '">Cancel</button>' : locked ? '<span class="hint" style="margin:0">for ' + esc(d.targetNick) + '</span>' : '<button class="btn small gold" data-djoin="' + d.id + '">Duel · 📜 ' + fmt(d.amt) + '</button>';
      return '<div class="drow' + (forMe ? ' forme' : '') + '"><span class="dic">' + (d.game === 'flip' ? '🪙' : '🎲') + '</span><div class="dmid"><b>' + esc(d.a.nick) + (mine ? ' (you)' : '') + '</b> · 📜 ' + fmt(d.amt) + (d.target ? ' · ⚔️ challenge' : '') + '<div class="hint" style="margin:0;font-size:12px">' + info + '</div></div>' + btn + '</div>';
    }).join('') : '<div class="hint">No open duels — create one and wait for a challenger, or challenge someone by walking up to them.</div>';
    $('duList').querySelectorAll('[data-djoin]').forEach(function (b) { b.onclick = function () { send({ g: 'duel', a: 'join', id: +b.dataset.djoin }); sfx('chip'); }; });
    $('duList').querySelectorAll('[data-dcancel]').forEach(function (b) { b.onclick = function () { send({ g: 'duel', a: 'cancel', id: +b.dataset.dcancel }); }; });
    $('duRecent').innerHTML = recent.length ? recent.map(function (d) {
      var r = d.res; return '<div class="drow small"><span class="dic">' + (d.game === 'flip' ? '🪙' : '🎲') + '</span><div class="dmid">🏆 <b>' + esc(r.winnerNick) + '</b> beat ' + esc(r.loserNick) + ' · won 📜 ' + fmt(r.payout) + '<div class="hint" style="margin:0;font-size:12px">' + (d.game === 'flip' ? 'landed ' + r.landed : esc(d.a.nick) + ' rolled ' + r.ra + ' · ' + esc(d.b.nick) + ' rolled ' + r.rb) + '</div></div></div>';
    }).join('') : '<div class="hint">No duels yet.</div>';
    $('duPickWrap').style.display = (cur.kind === 'duels' ? $('duGame').value : duelGame) === 'flip' ? '' : 'none';
  }
  $('duGame').onchange = renderDuels;
  function showDuelResult(d) {
    var r = d.res, mine = d.a.pid === me() || (d.b && d.b.pid === me()), won = r.winner === me();
    if (!mine) return;
    var ov = $('duAnim'); ov.style.display = 'flex';
    var face = $('duFace'), txt = $('duText');
    txt.textContent = d.game === 'flip' ? 'Flipping…' : 'Rolling…'; txt.className = '';
    var t0 = Date.now(), iv = setInterval(function () {
      var age = Date.now() - t0;
      if (d.game === 'flip') { face.textContent = Math.floor(age / 90) % 2 ? '★' : 'S'; face.className = 'coinbig flipping'; }
      else face.textContent = (1 + Math.floor(Math.random() * 100)) + ' : ' + (1 + Math.floor(Math.random() * 100));
      if (age > 1500) {
        clearInterval(iv);
        if (d.game === 'flip') { face.className = 'coinbig'; face.textContent = r.landed === 'heads' ? 'S' : '★'; } else { face.className = 'dicebig'; face.textContent = r.ra + ' : ' + r.rb; }
        txt.textContent = won ? '🎉 You won 📜 ' + fmt(r.payout) + '!' : '😩 ' + r.winnerNick + ' won this one'; txt.className = won ? 'win' : 'lose';
        sfx(won ? 'bigwin' : 'lose'); if (won) SC.fx && SC.fx('confetti');
        setTimeout(function () { ov.style.display = 'none'; }, 2600);
      }
    }, 70);
    if (d.game === 'dice') face.className = 'dicebig';
  }
  // Challenge popup (someone walked up and challenged you)
  var chalTimer = 0;
  function showChallenge(d) {
    var el = $('challenge');
    $('chText').innerHTML = '⚔️ <b>' + esc(d.a.nick) + '</b> challenges you to a <b>' + (d.game === 'flip' ? 'Coinflip' : 'Dice') + '</b> duel for 📜 ' + fmt(d.amt) + (d.game === 'flip' ? '<div class="hint" style="margin:2px 0 0">They picked ' + d.a.pick + '</div>' : '');
    el.classList.add('show'); sfx('challenge');
    $('chAccept').onclick = function () { send({ g: 'duel', a: 'join', id: d.id }); el.classList.remove('show'); };
    $('chDecline').onclick = function () { send({ g: 'duel', a: 'decline', id: d.id }); el.classList.remove('show'); };
    clearTimeout(chalTimer); chalTimer = setTimeout(function () { el.classList.remove('show'); }, 30000);
  }
  SC.challenge = function (pid, nick, game) {
    SC.askInput((game === 'flip' ? '🪙 Coinflip' : '🎲 Dice') + ' duel with ' + nick + ' — stake', 'amount', function (v) {
      var a = parseInt(v, 10); if (!a || a < 1) return;
      send({ g: 'duel', a: 'create', game: game, amt: a, pick: 'heads', target: pid }); toast('Challenge sent to ' + nick + '!');
    });
  };

  // ================================================================ WIRING
  function setTab(t) {
    duelTab = t;
    document.querySelectorAll('#panel .view').forEach(function (s) { s.classList.toggle('on', s.dataset.panel === (t === 'duel' ? 'duel' : cur.kind + '-house')); });
    document.querySelectorAll('#duTabs .tab').forEach(function (b) { b.classList.toggle('on', b.dataset.dt === t); });
  }
  document.querySelectorAll('#duTabs .tab').forEach(function (b) { b.onclick = function () { setTab(b.dataset.dt); sfx('click'); }; });
  function loop() {
    raf = 0; if (!cur.kind) return;
    try {
      if (cur.kind === 'crash') crashFrame();
      else if (cur.kind === 'roulette') roulFrame();
      else if (cur.kind === 'wheel') wheelFrame();
      else if (cur.kind === 'blackjack') bjFrame();
    } catch (e) {}
    raf = requestAnimationFrame(loop);
  }
  SC.mp = {
    open: function (kind, data) {
      cur.kind = kind; cur.data = data || null;
      $('duTabs').style.display = (kind === 'coinflip' || kind === 'dice') ? 'flex' : 'none';
      if (kind === 'coinflip' || kind === 'dice') { duelGame = kind === 'coinflip' ? 'flip' : 'dice'; setTab('duel'); $('duTitle').textContent = kind === 'coinflip' ? '🪙 Coinflip duels' : '🎲 Dice duels'; $('duGameWrap').style.display = 'none'; renderDuels(); }
      else if (kind === 'duels') { document.querySelectorAll('#panel .view').forEach(function (s) { s.classList.toggle('on', s.dataset.panel === 'duel'); }); $('duTitle').textContent = '⚔️ All open duels'; $('duGameWrap').style.display = ''; renderDuels(); }
      else if (kind === 'crash') renderCrash();
      else if (kind === 'roulette') renderRoul();
      else if (kind === 'wheel') renderWheel();
      else if (kind === 'blackjack') { if (data && data.table) $('pSub').textContent = 'Table ' + data.table.slice(2) + ' · up to 5 players'; renderBj(); }
      if (!raf) raf = requestAnimationFrame(loop);
    },
    close: function () { cur.kind = ''; cur.data = null; },
    snapshot: function (g) {
      gs.crash = g.crash; gs.roulette = g.roulette; gs.wheel = g.wheel; gs.bj = g.bj || {}; gs.duels = g.duels || []; gs.jp = g.jp || gs.jp;
      if (gs.crash) gs.crash.seenAt = Date.now();
      if (cur.kind) SC.mp.open(cur.kind, cur.data);
    },
    onGame: function (m) {
      var near = function (type) { return SC.nearType ? SC.nearType(type) : 9999; };
      if (m.ev === 'err') { toast(m.msg || 'Something went wrong'); return; }
      if (m.g === 'crash') {
        if (m.ev === 'state') {
          var prev = gs.crash && gs.crash.phase; var segs = gs.crash;
          gs.crash = m.s; gs.crash.seenAt = Date.now();
          if (m.s.phase === 'run' && prev !== 'run' && (cur.kind === 'crash' || near('crash') < 520)) sfx('launch');
          if (m.s.phase === 'end' && prev === 'run' && (cur.kind === 'crash' || near('crash') < 520)) sfx('boom');
        } else if (m.ev === 'bet' && gs.crash) gs.crash.bets.push(m.b);
        else if (m.ev === 'cash' && gs.crash) { gs.crash.bets.forEach(function (b) { if (b.pid === m.pid) { b.cashed = m.m; b.win = m.win; } }); if (m.pid === me()) { sfx('cash'); toast('Cashed out at ' + m.m.toFixed(2) + '× — +' + fmt(m.win) + '!'); } }
        if (cur.kind === 'crash') renderCrash();
      } else if (m.g === 'roulette') {
        if (m.ev === 'state') gs.roulette = m.s;
        else if (m.ev === 'bet' && gs.roulette) gs.roulette.bets.push(m.b);
        else if (m.ev === 'clear' && gs.roulette) gs.roulette.bets = gs.roulette.bets.filter(function (b) { return b.pid !== m.pid; });
        else if (m.ev === 'result') {
          lastRoul = { result: m.result, color: m.color, at: Date.now() };
          var mw = (m.wins || []).filter(function (w) { return w.pid === me(); })[0];
          if (mw && (cur.kind === 'roulette' || near('roulette') < 600)) { sfx(mw.net > 0 ? 'win' : 'lose'); toast('Roulette: ' + m.result + ' ' + m.color + (mw.net > 0 ? ' — you won +' + fmt(mw.net) + '!' : ' — no luck this spin')); }
        }
        if (cur.kind === 'roulette') renderRoul();
      } else if (m.g === 'wheel') {
        if (m.ev === 'state') { var segs2 = gs.wheel && gs.wheel.segs; gs.wheel = m.s; if (!gs.wheel.segs) gs.wheel.segs = segs2; }
        else if (m.ev === 'bet' && gs.wheel) gs.wheel.bets.push(m.b);
        else if (m.ev === 'result') { var ww = (m.wins || []).filter(function (w) { return w.pid === me(); })[0]; if (ww) { sfx(ww.net > 0 ? 'bigwin' : 'lose'); toast('Big Wheel: ' + WLAB[m.color] + (ww.net > 0 ? ' — you won +' + fmt(ww.net) + '!' : ' — not this time')); } }
        if (cur.kind === 'wheel') renderWheel();
      } else if (m.g === 'bj') {
        if (m.ev === 'state') {
          var old = gs.bj[m.s.id]; gs.bj[m.s.id] = m.s;
          var mi = mySeat(m.s);
          if (mi >= 0) {
            var key = m.s.id + ':' + m.s.turn + ':' + m.s.phase;
            if (m.s.phase === 'play' && m.s.turn === mi && key !== lastTurnKey) { lastTurnKey = key; sfx('turn'); if (cur.kind !== 'blackjack') toast("🃏 It's your turn at blackjack!"); }
            if (old && old.phase !== 'play' && m.s.phase === 'play') sfx('card');
            if (m.s.phase === 'done' && old && old.phase !== 'done') { var st = m.s.seats[mi]; if (st && st.bet) sfx(st.result === 'win' || st.result === 'bj' ? 'win' : st.result === 'push' ? 'click' : 'lose'); }
          }
          if (cur.kind === 'blackjack' && cur.data && cur.data.table === m.s.id) renderBj();
        }
      } else if (m.g === 'duel') {
        if (m.ev === 'list') gs.duels = m.list;
        else if (m.ev === 'challenge') showChallenge(m.d);
        else if (m.ev === 'declined') toast(m.nick + ' declined your duel — refunded');
        else if (m.ev === 'result') { recent.unshift(m.d); recent = recent.slice(0, 6); showDuelResult(m.d); if (SC.onDuelResult) SC.onDuelResult(m.d); }
        if (cur.kind === 'coinflip' || cur.kind === 'dice' || cur.kind === 'duels') renderDuels();
      }
    },
  };
})();
