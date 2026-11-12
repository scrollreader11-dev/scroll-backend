/* ============================================================
   Scrolls Casino 2D — shared core + game panels.
   The game logic is the same as the classic casino (same server
   routes); each panel opens when you use its machine in the world.
   ============================================================ */
(function () {
  var SC = window.SC = window.SC || {};
  var $ = function (s) { return document.getElementById(s); };
  var RAR = { common: '#9aa7bd', uncommon: '#4cc9f0', rare: '#5c7cfa', epic: '#b185ff', legendary: '#ffb14e', mythic: '#ff5c8a' };
  SC.RAR = RAR;
  var state = SC.state = { profile: null, store: [], cases: {}, dailyMs: 0, nick: '' };
  var fmt = SC.fmt = function (n) { return Number(n || 0).toLocaleString(); };
  var esc = SC.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  SC.toast = function (m) { var t = $('toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('show'); }, 2400); };
  SC.api = function (path, body) {
    return fetch('/api/casino/' + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'include' })
      .then(function (r) { return r.json(); }).catch(function () { return { error: 'network' }; });
  };
  var api = SC.api, toast = SC.toast;
  SC.profileListeners = [];
  SC.setProfile = function (p) { if (!p) return; state.profile = p; SC.profileListeners.forEach(function (f) { try { f(p); } catch (e) { console.error(e); } }); };
  var setProfile = SC.setProfile;
  SC.errMsg = function (e) { return { broke: 'Not enough Scrolls', 'bad-bet': 'Enter a valid bet', 'bad-amount': 'Enter a valid amount', owned: 'You already own that', 'not-owned': "You don't own that", 'no-recipient': 'Could not find that player', 'already-owns': 'They already own that', self: "You can't tip yourself", 'bad-code': 'That code is not valid', 'already-redeemed': 'You already redeemed that code', 'code-exhausted': 'That code is all used up', 'no-id': 'Log in to ScrollHub first', network: 'Connection problem — try again' }[e] || 'Something went wrong'; };
  var errMsg = SC.errMsg;

  // Inline input modal (prompt() is blocked inside the app's sandboxed iframe).
  var imCb = null;
  SC.askInput = function (title, placeholder, cb) { imCb = cb; $('imTitle').textContent = title; var inp = $('imInput'); inp.value = ''; inp.placeholder = placeholder || ''; $('imodal').style.display = 'flex'; setTimeout(function () { inp.focus(); }, 50); };
  function imClose() { $('imodal').style.display = 'none'; imCb = null; }
  $('imCancel').onclick = imClose;
  $('imOk').onclick = function () { var v = $('imInput').value.trim(); var cb = imCb; imClose(); if (cb) cb(v); };
  $('imInput').addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); $('imOk').click(); } else if (e.key === 'Escape') imClose(); });
  var askInput = SC.askInput;

  function betChips(attr, inputId) {
    document.querySelectorAll('[' + attr + ']').forEach(function (b) {
      b.onclick = function () { var v = b.getAttribute(attr); var i = $(inputId); if (v === 'max') i.value = state.profile ? state.profile.coins : 0; else if (v === 'half') i.value = Math.max(1, Math.floor((+i.value || 0) / 2)); else if (v === 'x2') i.value = (+i.value || 0) * 2; else i.value = (+i.value || 0) + +v; };
    });
  }

  // ---- ATM: daily + redeem ----
  function updateDaily() {
    var p = state.profile; if (!p || !$('daily')) return;
    var streak = p.streak || 0, sk = streak > 0 ? (' 🔥' + streak) : '';
    var left = p.lastDaily ? state.dailyMs - (Date.now() - p.lastDaily) : 0;
    if (left <= 0) { $('daily').disabled = false; $('daily').textContent = 'Claim daily Scrolls' + sk; }
    else { $('daily').disabled = true; var h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000); $('daily').textContent = 'Next daily in ' + h + 'h ' + m + 'm' + sk; }
    $('atmBal').textContent = fmt(p.coins);
  }
  SC.updateDaily = updateDaily;
  setInterval(updateDaily, 30000);
  SC.profileListeners.push(updateDaily);
  $('daily').onclick = function () { api('daily', {}).then(function (d) { if (d.gained) { toast('+' + fmt(d.gained) + ' Scrolls! 🔥 ' + (d.streak || 1) + '-day streak' + (d.milestone ? ' — milestone bonus!' : '')); SC.fx && SC.fx('confetti'); } else if (d.error === 'cooldown') toast('Not yet — come back later'); setProfile(d.profile); updateDaily(); }); };
  $('redeemGo').onclick = function () { var code = $('redeemCode').value.trim(); if (!code) return; api('redeem', { code: code }).then(function (d) { if (d.error) { toast(errMsg(d.error)); return; } toast('🎁 Redeemed +' + fmt(d.gained) + ' Scrolls!'); $('redeemCode').value = ''; setProfile(d.profile); SC.fx && SC.fx('confetti'); }); };

  // ---- blackjack ----
  function pcard(c) {
    if (c.hidden) return '<div class="pcard back"></div>';
    var names = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }; var n = names[c.n] || c.n; var red = (c.s === '♥' || c.s === '♦');
    return '<div class="pcard' + (red ? ' red' : '') + '">' + n + '<br>' + c.s + '</div>';
  }
  function renderBj(st) {
    if (!st) return;
    $('bjFelt').style.display = 'block';
    $('bjDealer').innerHTML = st.dealer.map(pcard).join('');
    $('bjPlayer').innerHTML = st.player.map(pcard).join('');
    $('bjPV').textContent = st.playerValue; $('bjDV').textContent = st.done ? st.dealerValue : '?';
    var m = $('bjMsg'); m.className = 'msg';
    if (st.done) {
      $('bjActions').style.display = 'none'; $('bjBetRow').style.display = 'flex';
      var r = st.result;
      if (r === 'blackjack') { m.textContent = 'Blackjack! 🎉'; m.classList.add('win'); }
      else if (r === 'win') { m.textContent = 'You win! 🎉'; m.classList.add('win'); }
      else if (r === 'push') { m.textContent = 'Push — bet returned.'; m.classList.add('push'); }
      else if (r === 'bust') { m.textContent = 'Bust! 💥'; m.classList.add('lose'); }
      else { m.textContent = 'Dealer wins.'; m.classList.add('lose'); }
    } else { $('bjActions').style.display = 'flex'; $('bjBetRow').style.display = 'none'; m.textContent = ''; }
  }
  $('bjDeal').onclick = function () { api('bj/start', { bet: +$('bjBet').value }).then(function (d) { if (d.error) { toast(errMsg(d.error)); return; } setProfile(d.profile); renderBj(d.state); }); };
  $('bjHit').onclick = function () { api('bj/hit', {}).then(function (d) { if (d.error) return; setProfile(d.profile); renderBj(d.state); }); };
  $('bjStand').onclick = function () { api('bj/stand', {}).then(function (d) { if (d.error) return; setProfile(d.profile); renderBj(d.state); }); };
  betChips('data-bj', 'bjBet');

  // ---- slots ----
  betChips('data-sl', 'slBet');
  $('slSpin').onclick = function () {
    var bet = +$('slBet').value; var btn = $('slSpin'); if (btn.disabled) return; btn.disabled = true;
    ['r0', 'r1', 'r2'].forEach(function (id) { $(id).classList.add('spin'); $(id).textContent = '🎰'; });
    api('slots', { bet: bet }).then(function (d) {
      if (d.error) { btn.disabled = false; ['r0', 'r1', 'r2'].forEach(function (id) { $(id).classList.remove('spin'); }); toast(errMsg(d.error)); return; }
      d.reels.forEach(function (sym, i) {
        setTimeout(function () {
          var r = $('r' + i); r.classList.remove('spin'); r.textContent = sym;
          if (i === 2) {
            btn.disabled = false; setProfile(d.profile); var m = $('slMsg'); m.className = 'msg';
            if (d.win > 0) { m.textContent = (d.line || 'Win') + ' +' + fmt(d.win) + '!'; m.classList.add('win'); if (d.win >= bet * 5) SC.fx && SC.fx('confetti'); }
            else { m.textContent = 'No win — try again'; m.classList.add('lose'); }
          }
        }, 350 * (i + 1));
      });
    });
  };

  // ---- coinflip ----
  betChips('data-cf', 'cfBet');
  function flip(side) {
    var bet = +$('cfBet').value;
    var c = $('coin'); c.classList.add('flipping');
    api('coinflip', { bet: bet, side: side }).then(function (d) {
      setTimeout(function () {
        c.classList.remove('flipping');
        if (d.error) { toast(errMsg(d.error)); return; }
        c.textContent = d.landed === 'heads' ? 'S' : '★'; setProfile(d.profile);
        var m = $('cfMsg'); m.className = 'msg';
        if (d.won) { m.textContent = 'Landed ' + d.landed + ' — you win +' + fmt(d.payout - bet) + '! 🎉'; m.classList.add('win'); }
        else { m.textContent = 'Landed ' + d.landed + ' — you lose.'; m.classList.add('lose'); }
      }, 900);
    });
  }
  $('cfHeads').onclick = function () { flip('heads'); };
  $('cfTails').onclick = function () { flip('tails'); };

  // ---- cases ----
  function renderCases() {
    var row = $('caserow'); row.innerHTML = '';
    Object.keys(state.cases).forEach(function (id) {
      var c = state.cases[id];
      var best = Math.max.apply(null, c.pool.map(function (i) { return i.v; }));
      var d = document.createElement('div'); d.className = 'casebox';
      d.innerHTML = '<div class="ic">' + (id === 'highroller' ? '💰' : '📦') + '</div><h3>' + esc(c.name) + '</h3>' +
        '<div class="hint" style="margin:4px 0">Top prize 📜 ' + fmt(best) + '</div>' +
        '<button class="btn gold" data-case="' + id + '">Open — 📜 ' + fmt(c.price) + '</button>';
      row.appendChild(d);
    });
    row.querySelectorAll('[data-case]').forEach(function (b) { b.onclick = function () { openCase(b.dataset.case); }; });
  }
  var opening = false;
  function openCase(id) {
    if (opening) return; var c = state.cases[id]; if (!c) return;
    if (state.profile.coins < c.price) { toast('Not enough Scrolls'); return; }
    opening = true; $('caseMsg').textContent = '';
    api('case', { caseId: id }).then(function (d) {
      if (d.error) { opening = false; toast(errMsg(d.error)); return; }
      if (state.profile) { state.profile.coins = Math.max(0, state.profile.coins - c.price); setProfile(state.profile); }
      var strip = $('strip'); var reveal = $('reveal'); reveal.style.display = 'block';
      var items = []; for (var i = 0; i < 40; i++) items.push(c.pool[(Math.random() * c.pool.length) | 0]);
      items[36] = { v: d.item.v, r: d.item.r };
      strip.style.transition = 'none'; strip.style.transform = 'translateX(0)';
      strip.innerHTML = items.map(function (it) { return '<div class="slot" style="color:' + (RAR[it.r] || '#fff') + '">📜 ' + fmt(it.v) + '</div>'; }).join('');
      var slotW = 88; var target = 36 * slotW - (reveal.clientWidth / 2) + slotW / 2;
      requestAnimationFrame(function () { requestAnimationFrame(function () { strip.style.transition = 'transform 4s cubic-bezier(.12,.8,.2,1)'; strip.style.transform = 'translateX(' + (-target) + 'px)'; }); });
      setTimeout(function () {
        opening = false;
        api('me').then(function (mm) { if (mm && mm.profile) setProfile(mm.profile); });
        var m = $('caseMsg'); m.className = 'msg';
        if (d.item.v === 0) { m.textContent = 'Ouch — nothing. 💀'; m.classList.add('lose'); }
        else if (d.net > 0) { m.innerHTML = '<span style="color:' + RAR[d.item.r] + '">' + d.item.r.toUpperCase() + '</span> — won 📜 ' + fmt(d.item.v) + ' (net +' + fmt(d.net) + ')'; m.classList.add('win'); if (d.net > c.price) SC.fx && SC.fx('confetti'); }
        else { m.innerHTML = '<span style="color:' + RAR[d.item.r] + '">' + d.item.r.toUpperCase() + '</span> — 📜 ' + fmt(d.item.v) + ' (net ' + fmt(d.net) + ')'; m.classList.add('lose'); }
      }, 4200);
    });
  }

  // ---- leaderboard / tournament ----
  var tourTimer = null;
  function fmtLeft(ms) { if (ms <= 0) return 'ended'; var s = Math.floor(ms / 1000); var d = Math.floor(s / 86400); var h = Math.floor(s % 86400 / 3600); var m = Math.floor(s % 3600 / 60); return (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm'; }
  SC.fmtLeft = fmtLeft;
  function loadTour() {
    api('tournament').then(function (d) {
      var medals = ['🥇', '🥈', '🥉'];
      $('tourTop').innerHTML = (d.prizes || []).map(function (p, i) { return '<div class="prize"><div style="font-size:1.4rem">' + medals[i] + '</div><div style="font-weight:700;color:#ffd166">📜 ' + fmt(p) + '</div></div>'; }).join('');
      if (tourTimer) clearInterval(tourTimer);
      function tick() { $('tourCountdown').textContent = 'Resets in ' + fmtLeft(d.endsAt - Date.now()); }
      tick(); tourTimer = setInterval(tick, 30000);
      $('tourYou').innerHTML = d.you && d.you.rank ? ("You're #" + d.you.rank + ' this week — net 📜 ' + fmt(d.you.net)) : 'Win a game this week to join the board!';
      var tb = $('tourLb'); tb.innerHTML = '';
      (d.top || []).forEach(function (u, i) { var tr = document.createElement('tr'); if (u.mine) tr.className = 'mine'; tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + (medals[i] || '') + ' ' + esc(u.nick || 'player') + (u.mine ? ' (you)' : '') + '</td><td>📜 ' + fmt(u.net) + '</td>'; tb.appendChild(tr); });
      if (!(d.top || []).length) tb.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--mut)">No winners yet this week — be the first!</td></tr>';
      var lw = d.lastWinners || [];
      $('tourLast').innerHTML = lw.length ? ('<div class="hint" style="margin-bottom:6px">Last week\'s winners</div>' + lw.map(function (w, i) { return '<div>' + (medals[i] || '') + ' <b>' + esc(w.nick) + '</b> — won 📜 ' + fmt(w.prize) + ' (net 📜 ' + fmt(w.net) + ')</div>'; }).join('')) : '';
    });
  }
  function loadLb() {
    api('leaderboard').then(function (d) {
      var tb = $('lb'); tb.innerHTML = '';
      (d.top || []).forEach(function (u, i) {
        var medal = (i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '');
        var tip = (u.mine || !u.id) ? '' : '<button class="chip" data-tip="' + esc(u.id) + '" data-tipn="' + esc(u.nick || 'player') + '">🎁 Tip</button>';
        var tr = document.createElement('tr'); if (u.mine) tr.className = 'mine';
        tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + medal + esc(u.nick || 'Player') + (u.mine ? ' (you)' : '') + '</td><td>📜 ' + fmt(u.coins) + '</td><td>' + tip + '</td>';
        tb.appendChild(tr);
      });
      tb.querySelectorAll('[data-tip]').forEach(function (b) { b.onclick = function () { SC.tipPlayer(b.dataset.tip, b.dataset.tipn, loadLb); }; });
    });
  }
  SC.tipPlayer = function (cid, nick, after) {
    askInput('Tip Scrolls to ' + nick, 'amount', function (v) {
      var amt = parseInt(v, 10); if (!amt || amt < 1) return;
      api('tip', { toCid: cid, amount: amt }).then(function (r) { if (r.error) { toast(errMsg(r.error)); return; } toast('Sent ' + fmt(r.amount) + ' to ' + r.toNick + '! 🎁'); setProfile(r.profile); if (after) after(); });
    });
  };

  // ---- case battles (WebSocket) ----
  var bws = null, myCid = '', curBattle = null;
  function bwsSend(o) { try { if (bws && bws.readyState === 1) bws.send(JSON.stringify(o)); } catch (e) {} }
  function connectBattles() {
    if (bws && (bws.readyState === 0 || bws.readyState === 1)) return;
    var proto = location.protocol === 'https:' ? 'wss' : 'ws';
    bws = new WebSocket(proto + '://' + location.host + '/battle-ws');
    bws.onmessage = function (ev) { var m; try { m = JSON.parse(ev.data); } catch (e) { return; } onBattle(m); };
    bws.onclose = function () { setTimeout(function () { if (SC.panelKind === 'battles') connectBattles(); }, 2000); };
  }
  function fillCaseSelect() {
    var s = $('bCase'); if (s.options.length) return;
    Object.keys(state.cases).forEach(function (id) { var o = document.createElement('option'); o.value = id; o.textContent = state.cases[id].name + ' (' + fmt(state.cases[id].price) + ')'; s.appendChild(o); });
    updateCost();
  }
  function updateCost() { var c = state.cases[$('bCase').value]; if (!c) return; $('bCost').textContent = 'Cost to join: 📜 ' + fmt(c.price * (+$('bRounds').value)) + ' (' + $('bRounds').value + ' cases)'; }
  $('bCase').onchange = updateCost; $('bRounds').onchange = updateCost;
  $('bCreate').onclick = function () { bwsSend({ t: 'create', caseId: $('bCase').value, players: +$('bPlayers').value, rounds: +$('bRounds').value }); };
  $('brLeave').onclick = function () { bwsSend({ t: 'leave' }); showLobby(); };
  $('brStart').onclick = function () { bwsSend({ t: 'start' }); };
  function onBattle(m) {
    if (m.t === 'hello') { myCid = m.cid; return; }
    if (m.t === 'coins') { if (state.profile) { state.profile.coins = m.coins; setProfile(state.profile); } return; }
    if (m.t === 'error') { toast(m.msg || 'Error'); return; }
    if (m.t === 'lobby') { renderLobby(m.battles); return; }
    if (m.t === 'state') { curBattle = m.battle; showRoom(); renderRoom(); return; }
    if (m.t === 'roll') { applyRoll(m); return; }
    if (m.t === 'done') { curBattle = m.battle; renderRoom(); showWinner(m.winner); return; }
  }
  function showLobby() { $('battleLobby').style.display = 'block'; $('battleRoom').style.display = 'none'; }
  function showRoom() { $('battleLobby').style.display = 'none'; $('battleRoom').style.display = 'block'; }
  function renderLobby(list) {
    var el = $('bList'); el.innerHTML = '';
    if (!list || !list.length) { el.innerHTML = '<div class="hint">No open battles — create one above!</div>'; return; }
    list.forEach(function (b) {
      var d = document.createElement('div'); d.className = 'betrow'; d.style.justifyContent = 'space-between';
      d.innerHTML = '<span><b>' + esc(b.caseName) + '</b> · ' + b.players + '/' + b.maxPlayers + ' players · ' + b.rounds + ' rounds · 📜 ' + fmt(b.cost) + '</span>';
      var j = document.createElement('button'); j.className = 'btn small'; j.textContent = 'Join'; j.onclick = function () { bwsSend({ t: 'join', id: b.id }); };
      d.appendChild(j); el.appendChild(d);
    });
  }
  function pullChip(v) { return '<span class="pull">' + fmt(v) + '</span>'; }
  function renderRoom() {
    if (!curBattle) return; var b = curBattle;
    $('brTitle').textContent = b.caseName + ' — ' + b.rounds + ' rounds';
    $('brStart').style.display = (b.state === 'waiting' && b.players[0] && b.players[0].cid === myCid) ? 'inline-block' : 'none';
    $('brStatus').textContent = b.state === 'waiting' ? ('Waiting for players (' + b.players.length + '/' + b.maxPlayers + ')… empty seats fill with bots when you start.') : (b.state === 'rolling' ? ('Round ' + b.round + ' / ' + b.rounds + ' — pot 📜 ' + fmt(b.pot)) : '');
    var g = $('brPlayers'); g.innerHTML = '';
    for (var i = 0; i < b.maxPlayers; i++) {
      var p = b.players[i]; var d = document.createElement('div'); d.className = 'seat'; d.setAttribute('data-seat', i);
      if (p) d.innerHTML = '<div style="font-weight:700">' + (p.bot ? '🤖 ' : '') + esc(p.nick) + (p.cid === myCid ? ' (you)' : '') + '</div><div class="val" style="font-size:1.3rem" data-total>📜 ' + fmt(p.total) + '</div><div data-pulls style="margin-top:8px;font-size:.8rem;min-height:20px">' + (p.pulls || []).map(pullChip).join('') + '</div>';
      else d.innerHTML = '<div style="color:var(--mut)">Empty seat</div>';
      g.appendChild(d);
    }
    $('brResult').textContent = '';
  }
  function applyRoll(m) {
    if (!curBattle) return; curBattle.round = m.round; curBattle.pot = m.pot;
    $('brStatus').textContent = 'Round ' + m.round + ' / ' + m.rounds + ' — pot 📜 ' + fmt(m.pot);
    m.results.forEach(function (r, i) {
      var seat = curBattle.players.findIndex(function (p) { return p.cid === r.cid; }); if (seat < 0) seat = i;
      var card = document.querySelector('[data-seat="' + seat + '"]'); if (!card) return;
      var tot = card.querySelector('[data-total]'); var pulls = card.querySelector('[data-pulls]');
      if (tot) tot.textContent = '📜 ' + fmt(r.total);
      if (pulls) { var sp = document.createElement('span'); sp.className = 'pull'; sp.style.color = RAR[r.r] || '#fff'; sp.textContent = fmt(r.v); pulls.appendChild(sp); }
      var pm = curBattle.players[seat]; if (pm) { pm.total = r.total; (pm.pulls = pm.pulls || []).push(r.v); }
    });
  }
  function showWinner(w) {
    if (!w) return; var me = w.cids.indexOf(myCid) >= 0;
    var el = $('brResult'); el.className = 'msg ' + (me ? 'win' : 'lose');
    el.textContent = (me ? '🎉 You won ' : '🏆 ' + w.nicks.join(' & ') + ' won ') + '📜 ' + fmt(w.share) + (w.cids.length > 1 ? ' each!' : '!');
    if (me) SC.fx && SC.fx('confetti');
  }

  // ---- dice ----
  var dcOver = true;
  function updDcInfo() { var t = Math.max(2, Math.min(98, +$('dcTarget').value || 50)); var ch = dcOver ? 100 - t : t; var mu = ch > 0 ? (99 / ch) : 0; $('dcInfo').textContent = 'Win chance ' + ch + '% · pays ' + mu.toFixed(2) + '×'; }
  $('dcDir').onclick = function () { dcOver = !dcOver; $('dcDir').textContent = dcOver ? 'Roll OVER' : 'Roll UNDER'; updDcInfo(); };
  $('dcTarget').oninput = updDcInfo; updDcInfo();
  betChips('data-dc', 'dcBet');
  $('dcRoll').onclick = function () {
    var bet = +$('dcBet').value, t = +$('dcTarget').value;
    var el = $('diceRoll'); el.style.color = ''; var iv = setInterval(function () { el.textContent = (Math.random() * 100).toFixed(2); }, 55);
    api('dice', { bet: bet, target: t, dir: dcOver ? 'over' : 'under' }).then(function (d) {
      setTimeout(function () {
        clearInterval(iv);
        if (d.error) { el.textContent = '—'; toast(errMsg(d.error)); return; }
        el.textContent = d.roll.toFixed(2); el.style.color = d.won ? '#2bd576' : '#ff5c6c'; setProfile(d.profile);
        var m = $('dcMsg'); m.className = 'msg';
        if (d.won) { m.textContent = 'Rolled ' + d.roll.toFixed(2) + ' — win +' + fmt(d.win) + '! (' + d.mult.toFixed(2) + '×)'; m.classList.add('win'); }
        else { m.textContent = 'Rolled ' + d.roll.toFixed(2) + ' — you lose.'; m.classList.add('lose'); }
      }, 700);
    });
  };

  // ---- roulette ----
  betChips('data-rlb', 'rlBet');
  document.querySelectorAll('[data-rl]').forEach(function (b) {
    b.onclick = function () {
      var choice = b.dataset.rl; if (choice === 'num') choice = String(+$('rlNumIn').value || 0);
      var bet = +$('rlBet').value;
      var el = $('rlNum'); var iv = setInterval(function () { el.textContent = Math.floor(Math.random() * 37); }, 65);
      api('roulette', { bet: bet, choice: choice }).then(function (d) {
        setTimeout(function () {
          clearInterval(iv);
          if (d.error) { el.textContent = '—'; toast(errMsg(d.error)); return; }
          var col = d.color === 'red' ? '#ff5c6c' : d.color === 'green' ? '#2bd576' : '#cbd5e1';
          el.innerHTML = '<span style="color:' + col + '">' + d.number + '</span>';
          setProfile(d.profile); var m = $('rlMsg'); m.className = 'msg';
          if (d.win > 0) { m.textContent = d.number + ' ' + d.color + ' — win +' + fmt(d.win) + '! 🎉'; m.classList.add('win'); }
          else { m.textContent = d.number + ' ' + d.color + ' — you lose.'; m.classList.add('lose'); }
        }, 1500);
      });
    };
  });

  // ---- mines ----
  function mnReset() { var g = $('mnGrid'); g.innerHTML = ''; for (var i = 0; i < 25; i++) (function (i) { var t = document.createElement('button'); t.className = 'mtile'; t.onclick = function () { mnPick(i, t); }; g.appendChild(t); })(i); }
  function mnLock(lock) { document.querySelectorAll('#mnGrid button').forEach(function (b) { b.disabled = lock; }); }
  betChips('data-mn', 'mnBet');
  $('mnStart').onclick = function () {
    api('mines/start', { bet: +$('mnBet').value, mines: +$('mnMines').value }).then(function (d) {
      if (d.error) { toast(errMsg(d.error)); return; }
      setProfile(d.profile); mnReset(); mnLock(false);
      $('mnSetup').style.display = 'none'; $('mnPlay').style.display = 'flex';
      $('mnMult').textContent = '1.00× · 0 safe'; $('mnMsg').textContent = ''; $('mnMsg').className = 'msg';
    });
  };
  function mnPick(i, btn) {
    api('mines/pick', { tile: i }).then(function (d) {
      if (d.error) return; setProfile(d.profile);
      if (d.hit) {
        mnLock(true); btn.textContent = '💣'; btn.classList.add('boom');
        (d.mineField || []).forEach(function (pos) { var b = $('mnGrid').children[pos]; if (b) { b.textContent = '💣'; b.style.opacity = '.6'; } });
        var m = $('mnMsg'); m.className = 'msg lose'; m.textContent = 'Boom! 💥 Lost the bet.';
        $('mnSetup').style.display = 'flex'; $('mnPlay').style.display = 'none';
      } else {
        btn.textContent = '💎'; btn.classList.add('gem'); btn.disabled = true;
        $('mnMult').textContent = d.mult.toFixed(2) + '× · ' + d.picks + ' safe (' + fmt(d.cashout) + ')';
      }
    });
  }
  $('mnCash').onclick = function () {
    api('mines/cashout', {}).then(function (d) {
      if (d.error) return; setProfile(d.profile); mnLock(true);
      (d.mineField || []).forEach(function (pos) { var b = $('mnGrid').children[pos]; if (b && b.textContent !== '💎') { b.textContent = '💣'; b.style.opacity = '.5'; } });
      var m = $('mnMsg'); m.className = 'msg win'; m.textContent = 'Cashed out +' + fmt(d.win) + '! (' + d.mult.toFixed(2) + '×)';
      $('mnSetup').style.display = 'flex'; $('mnPlay').style.display = 'none';
    });
  };
  mnReset();

  // ---- plinko ----
  var PKMULT = [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110];
  function buildPkSlots(hi) { $('pkSlots').innerHTML = PKMULT.map(function (m, i) { var big = m >= 5; return '<div class="pks' + (i === hi ? ' hi' : big ? ' big' : '') + '">' + m + '×</div>'; }).join(''); }
  function plinkoAnim(path, cb) {
    var cv = $('pkCanvas'); if (!cv || !cv.getContext) { cb && cb(); return; }
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height, rows = path.length;
    var rowH = (H - 34) / (rows + 1), slotW = (W - 20) / (rows + 2);
    var xs = [0], x = 0; for (var i = 0; i < rows; i++) { x += path[i] ? 0.5 : -0.5; xs.push(x); }
    var start = null, total = rows * 85;
    function frame(ts) {
      if (!start) start = ts; var p = Math.min((ts - start) / total, 1);
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,255,255,.3)';
      for (var r = 0; r < rows; r++) for (var c = 0; c <= r + 1; c++) { ctx.beginPath(); ctx.arc(W / 2 + (c - (r + 1) / 2) * slotW, 20 + r * rowH, 2, 0, 7); ctx.fill(); }
      var fr = p * rows, ri = Math.floor(fr), frac = fr - ri;
      var xu = ri < rows ? (xs[ri] + (xs[ri + 1] - xs[ri]) * frac) : xs[rows];
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(W / 2 + xu * slotW, Math.min(20 + fr * rowH, H - 12), 6, 0, 7); ctx.fill();
      if (p < 1) requestAnimationFrame(frame); else cb && cb();
    }
    requestAnimationFrame(frame);
  }
  betChips('data-pk', 'pkBet');
  $('pkDrop').onclick = function () {
    api('plinko', { bet: +$('pkBet').value }).then(function (d) {
      if (d.error) { toast(errMsg(d.error)); return; }
      buildPkSlots(-1);
      plinkoAnim(d.path, function () {
        buildPkSlots(d.slot); setProfile(d.profile); var m = $('pkMsg'); m.className = 'msg';
        if (d.win > 0) { m.textContent = d.mult + '× — win +' + fmt(d.win) + '! 🎉'; m.classList.add('win'); }
        else { m.textContent = d.mult + '× — you lose.'; m.classList.add('lose'); }
      });
    });
  };
  buildPkSlots(-1);

  // ---- wheel ----
  var WSEG = [0, 1.5, 0, 2, 0, 1.2, 0, 1.5, 0, 3, 0, 1.2, 0, 1.5, 0, 2, 0, 1.2, 0, 4];
  function wheelCells() { return WSEG.map(function (m) { return '<div class="wcell' + (m === 0 ? ' bust' : m >= 3 ? ' big' : '') + '">' + (m === 0 ? '✖' : (m + '×')) + '</div>'; }).join(''); }
  function buildWheelStrip() { var s = $('whStrip'); var html = ''; for (var rep = 0; rep < 10; rep++) html += wheelCells(); s.innerHTML = html; s.style.transition = 'none'; s.style.transform = 'translateX(0)'; }
  betChips('data-wh', 'whBet');
  $('whSpin').onclick = function () {
    api('wheel', { bet: +$('whBet').value }).then(function (d) {
      if (d.error) { toast(errMsg(d.error)); return; }
      buildWheelStrip(); var s = $('whStrip'); var cellW = 62; var rep = 8;
      var cellIndex = rep * WSEG.length + d.idx; var container = s.parentElement.clientWidth;
      var offset = cellIndex * cellW + 31 - container / 2;
      requestAnimationFrame(function () { s.style.transition = 'transform 4s cubic-bezier(.16,.84,.3,1)'; s.style.transform = 'translateX(-' + offset + 'px)'; });
      setTimeout(function () {
        setProfile(d.profile); var m = $('whMsg'); m.className = 'msg';
        if (d.win > 0) { m.textContent = 'Landed ' + d.mult + '× — win +' + fmt(d.win) + '! 🎉'; m.classList.add('win'); }
        else { m.textContent = 'Landed ' + (d.mult === 0 ? 'bust' : d.mult + '×') + ' — you lose.'; m.classList.add('lose'); }
      }, 4150);
    });
  };
  buildWheelStrip();

  // ---- crash ----
  var cr = { raf: 0, running: false, start: 0, k: 0, cp: 0, bet: 0 };
  function crScaleY(m) { var cv = $('crCanvas'); return cv.height - 8 - Math.min(cv.height - 22, (Math.log(Math.max(1, m)) / Math.log(cr.cp * 1.4 + 0.2)) * (cv.height - 26)); }
  function crDraw(mult, boom) {
    var cv = $('crCanvas'); if (!cv || !cv.getContext) return; var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    var el = performance.now() - cr.start, tMax = Math.max(el, 2600), pts = 48;
    function px(t) { return (t / tMax) * (W - 16) + 8; }
    ctx.beginPath(); ctx.moveTo(8, H - 8);
    for (var i = 0; i <= pts; i++) { var t = el * (i / pts); ctx.lineTo(px(t), crScaleY(Math.exp(cr.k * t))); }
    ctx.lineTo(px(el), H - 8); ctx.closePath();
    var gd = ctx.createLinearGradient(0, 0, 0, H); var cc = boom ? '255,82,82' : '92,242,255'; gd.addColorStop(0, 'rgba(' + cc + ',.45)'); gd.addColorStop(1, 'rgba(' + cc + ',0)'); ctx.fillStyle = gd; ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, H - 8);
    for (i = 0; i <= pts; i++) { t = el * (i / pts); ctx.lineTo(px(t), crScaleY(Math.exp(cr.k * t))); }
    ctx.strokeStyle = boom ? '#ff5252' : '#5cf2ff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.font = '22px serif'; ctx.fillText(boom ? '💥' : '🚀', px(el) - 10, crScaleY(mult) + 8);
  }
  function crEnd() { cr.running = false; cancelAnimationFrame(cr.raf); $('crSetup').style.display = 'flex'; $('crPlay').style.display = 'none'; }
  function crLoop() {
    var el = performance.now() - cr.start, mult = Math.exp(cr.k * el);
    if (mult >= cr.cp) {
      $('crMult').textContent = cr.cp.toFixed(2) + '×'; $('crMult').style.color = '#ff5252'; crDraw(cr.cp, true);
      crEnd(); api('crash/bust', {}).then(function (r) { if (r && r.profile) setProfile(r.profile); });
      var m = $('crMsg'); m.className = 'msg lose'; m.textContent = '💥 Crashed at ' + cr.cp.toFixed(2) + '× — lost ' + fmt(cr.bet) + '.';
      return;
    }
    $('crMult').textContent = mult.toFixed(2) + '×'; $('crMult').style.color = '#eaf0ff'; crDraw(mult, false);
    cr.raf = requestAnimationFrame(crLoop);
  }
  betChips('data-cr', 'crBet');
  $('crStart').onclick = function () {
    if (cr.running) return; var bet = +$('crBet').value;
    api('crash/start', { bet: bet }).then(function (d) {
      if (d.error) { toast(errMsg(d.error)); return; }
      setProfile(d.profile); cr.running = true; cr.start = performance.now(); cr.k = d.k; cr.cp = d.crashPoint; cr.bet = bet;
      $('crSetup').style.display = 'none'; $('crPlay').style.display = 'flex'; $('crMsg').textContent = ''; $('crMsg').className = 'msg';
      crLoop();
    });
  };
  $('crCash').onclick = function () {
    if (!cr.running) return;
    var el = performance.now() - cr.start, mult = Math.min(Math.exp(cr.k * el), cr.cp);
    crEnd();
    api('crash/cashout', { mult: +mult.toFixed(2) }).then(function (d) {
      if (d.error) { toast(errMsg(d.error)); return; }
      setProfile(d.profile); var m = $('crMsg');
      if (d.busted) { m.className = 'msg lose'; m.textContent = '💥 Crashed at ' + (d.crashPoint || cr.cp).toFixed(2) + '× — too late!'; $('crMult').style.color = '#ff5252'; crDraw(cr.cp, true); }
      else { m.className = 'msg win'; m.textContent = 'Cashed out at ' + d.mult.toFixed(2) + '× — won +' + fmt(d.win) + '! 🎉'; $('crMult').textContent = d.mult.toFixed(2) + '×'; $('crMult').style.color = '#2bd576'; }
    });
  };
  SC.crashRunning = function () { return cr.running; };

  // Called by the world when a panel opens.
  var casesRendered = false;
  SC.games = {
    open: function (kind) {
      if (kind === 'leaderboard') loadLb();
      if (kind === 'tournament') loadTour();
      if (kind === 'battles') { connectBattles(); fillCaseSelect(); }
      if (kind === 'cases' && !casesRendered) { renderCases(); casesRendered = true; }
      if (kind === 'atm') updateDaily();
    },
  };
})();
