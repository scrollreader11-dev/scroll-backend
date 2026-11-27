/* Scrolls Casino: Owner panel (owner and co-owner only).
   Rig a game: choose the game, the player and what should happen. Everything is applied on the server
   (casino.js) and logged to the audit log. The button only appears for staff with that role. */
(function () {
  var SC = window.SC = window.SC || {};
  var $ = function (s) { return document.getElementById(s); };
  var esc = SC.esc;
  var S = { rules: [], log: [], games: [], ready: false, built: false, tbl: null, timer: 0 };
  var SHARED = { crash: 1, roulette: 1, wheel: 1, blackjack: 1 };
  function staff(body) {
    return fetch('/api/staff/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' })
      .then(function (r) { return r.json(); }).catch(function () { return { error: 'network' }; });
  }
  function err(r) { SC.toast((r && (r.message || (r.error === 'owner only' ? 'Only the owner can do that' : r.error))) || 'That did not work'); }
  function gname(id) { if (id === '*') return 'All games'; var g = S.games.filter(function (x) { return x[0] === id; })[0]; return g ? g[1] : id; }

  // ---- button: shown only to the owner and co-owners
  fetch('/api/auth/me', { credentials: 'include' }).then(function (r) { return r.json(); }).then(function (d) {
    if (d && (d.role === 'owner' || d.role === 'coowner')) { S.role = d.role; var b = $('ownerBtn'); if (b) b.style.display = ''; }
  }).catch(function () {});
  var ob = $('ownerBtn'); if (ob) ob.onclick = function () { if (SC.openPanel) SC.openPanel('owner'); };

  function build() {
    if (S.built) return; S.built = true;
    var host = document.querySelector('#panel .view[data-panel="owner"]');
    host.innerHTML =
      '<h3 class="ow-h" style="margin-top:0">Live tables</h3><div class="hint">Crash, Roulette and the Big Wheel run one round for everyone, so they are controlled here instead of by a rig. Changes apply to the round shown below or to the next ones.</div>' +
      '<div id="owTables"></div>' +
      '<h3 class="ow-h">Rig a game</h3><div class="hint">Shared tables and seated Blackjack are not listed, they cannot be rigged for one player.</div>' +
      '<div class="hint">Rig a game. Pick the game, the player and what should happen. It runs on the server, so the player just sees a normal round. Every change is logged.</div>' +
      '<div class="ow-grid">' +
        '<label>Game<select id="owGame"></select></label>' +
        '<label>Player<input type="text" id="owWho" placeholder="Username, or empty for everyone" autocomplete="off" autocapitalize="off" spellcheck="false" /></label>' +
        '<label class="wide">What happens<select id="owMode"><option value="win">They win the round</option><option value="lose">They lose the round</option><option value="payout">It pays out a set multiplier</option><option value="chance">They win a set share of rounds</option></select></label>' +
        '<label class="mode m-payout">Pays at least (x the bet)<input type="number" id="owMin" value="10" min="0" step="0.5" /></label>' +
        '<label class="mode m-payout">and at most (x the bet)<input type="number" id="owMax" placeholder="no limit" min="0" step="0.5" /></label>' +
        '<label class="mode m-chance wide">Win chance, percent<input type="number" id="owChance" value="70" min="0" max="100" /></label>' +
        '<label>For how many rounds<input type="number" id="owUses" value="1" min="0" /></label>' +
        '<label>Stops after (minutes)<input type="number" id="owMins" value="0" min="0" /></label>' +
        '<label class="wide">Note<input type="text" id="owNote" maxlength="80" placeholder="Optional note for yourself" /></label>' +
      '</div>' +
      '<div class="hint" id="owHint" style="margin-top:8px"></div>' +
      '<label class="ow-check"><input type="checkbox" id="owStaff" /> With no player, also apply to staff accounts (skipped by default)</label>' +
      '<div class="betrow" id="owPresets"></div>' +
      '<div class="betrow c"><button class="btn gold" id="owAdd" style="min-width:200px">Add rig</button></div>' +
      '<h3 class="ow-h">Active rigs</h3><div class="hint">A player rig beats an everyone rig, and one game beats all games. A round counts when it finishes.</div>' +
      '<div id="owRules"></div><div class="betrow c"><button class="chip" id="owClear">Delete all rigs</button></div>' +
      '<h3 class="ow-h">Recent rigged rounds</h3><div id="owLog"></div>';
    var presets = [['Next round wins', { mode: 'win', uses: 1 }], ['Next 3 lose', { mode: 'lose', uses: 3 }], ['Pay 10x once', { mode: 'payout', min: 10, max: 10, uses: 1 }], ['Jackpot once', { mode: 'payout', min: 100, max: '', uses: 1 }], ['Win 70% of rounds', { mode: 'chance', chance: 70, uses: 0 }], ['Win 30% of rounds', { mode: 'chance', chance: 30, uses: 0 }]];
    presets.forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = p[0];
      b.onclick = function () { var v = p[1]; $('owMode').value = v.mode; if (v.min != null) $('owMin').value = v.min; if (v.max != null) $('owMax').value = v.max; if (v.chance != null) $('owChance').value = v.chance; if (v.uses != null) $('owUses').value = v.uses; sync(); };
      $('owPresets').appendChild(b);
    });
    tablesBuild();
    if (SC.staffExtras) SC.staffExtras(host, 'casino-owner', ['casino']);
    $('owMode').onchange = sync; sync();
    $('owAdd').onclick = add;
    $('owClear').onclick = function () { if (!S.rules.length) return; staff({ action: 'casino.rig.clear' }).then(function (x) { if (x && x.ok) { take(x); SC.toast('All rigs deleted'); } else err(x); }); };
    ['owGame', 'owWho', 'owMin', 'owMax', 'owChance', 'owUses', 'owMins', 'owNote'].forEach(function (id) { $(id).addEventListener('keydown', function (e) { e.stopPropagation(); }); });
  }
  // ---- live tables (Crash, Roulette, Big Wheel)
  function tset(game, op, value, count) {
    return staff({ action: 'casino.table.set', game: game, op: op, value: value, count: count }).then(function (x) { if (x && x.ok) { S.tbl = x; tablesPaint(); return x; } err(x); return x; });
  }
  function tget() { staff({ action: 'casino.table.get' }).then(function (x) { if (x && x.ok) { S.tbl = x; tablesPaint(); } }); }
  function tpoll() { clearInterval(S.timer); S.timer = setInterval(function () { var v = document.querySelector('#panel .view[data-panel="owner"]'); if (!v || !v.classList.contains('on')) { clearInterval(S.timer); return; } tget(); }, 1000); }
  function field(id, label, html) { return '<label>' + label + html + '</label>'; }
  function tablesBuild() {
    var h = '';
    h += '<div class="ow-card"><div class="ow-t">Crash</div><div class="ow-s" id="owCrSt"></div>' +
      '<div class="ow-grid">' + field('owCrX', 'Crash at (x)', '<input type="number" id="owCrX" value="2" min="1" step="0.1" />') + field('owCrN', 'For how many rounds', '<input type="number" id="owCrN" value="1" min="1" max="50" />') + '</div>' +
      '<div class="betrow" id="owCrB"></div><div class="ow-s" id="owCrQ"></div></div>';
    h += '<div class="ow-card"><div class="ow-t">Roulette</div><div class="ow-s" id="owRoSt"></div>' +
      '<div class="ow-grid">' + field('owRoV', 'Number (0 to 36)', '<input type="number" id="owRoV" value="7" min="0" max="36" />') + field('owRoN', 'For how many spins', '<input type="number" id="owRoN" value="1" min="1" max="50" />') + '</div>' +
      '<div class="betrow" id="owRoB"></div><div class="ow-s" id="owRoQ"></div></div>';
    h += '<div class="ow-card"><div class="ow-t">Big Wheel</div><div class="ow-s" id="owWhSt"></div>' +
      '<div class="ow-grid">' + field('owWhV', 'Color', '<select id="owWhV"><option value="grey">Grey</option><option value="blue">Blue</option><option value="green">Green</option><option value="gold">Gold</option></select>') + field('owWhN', 'For how many spins', '<input type="number" id="owWhN" value="1" min="1" max="50" />') + '</div>' +
      '<div class="betrow" id="owWhB"></div><div class="ow-s" id="owWhQ"></div></div>';
    $('owTables').innerHTML = h;
    function btn(host, label, fn, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (cls ? ' ' + cls : ''); b.textContent = label; b.onclick = function () { fn(); }; $(host).appendChild(b); }
    var cx = function () { return $('owCrX').value; }, cn = function () { return $('owCrN').value; };
    btn('owCrB', 'Crash this round at X', function () { tset('crash', 'now', cx()).then(function (x) { if (x && x.ok) SC.toast('This round crashes at ' + cx() + 'x'); }); });
    btn('owCrB', 'Queue X for the next rounds', function () { tset('crash', 'next', cx(), cn()).then(function (x) { if (x && x.ok) SC.toast('Queued'); }); });
    btn('owCrB', 'Every round at X', function () { tset('crash', 'fixed', cx()).then(function (x) { if (x && x.ok) SC.toast('Every round crashes at ' + cx() + 'x'); }); });
    btn('owCrB', 'Crash right now', function () { tset('crash', 'now', 1).then(function (x) { if (x && x.ok) SC.toast('Crashing'); }); }, 'red');
    btn('owCrB', 'Back to random', function () { tset('crash', 'clear').then(function (x) { if (x && x.ok) SC.toast('Crash is random again'); }); });
    btn('owRoB', 'Land on it this spin', function () { tset('roulette', 'now', $('owRoV').value).then(function (x) { if (x && x.ok) SC.toast('This spin lands on ' + $('owRoV').value); }); });
    btn('owRoB', 'Queue for the next spins', function () { tset('roulette', 'next', $('owRoV').value, $('owRoN').value).then(function (x) { if (x && x.ok) SC.toast('Queued'); }); });
    btn('owRoB', 'Back to random', function () { tset('roulette', 'clear').then(function (x) { if (x && x.ok) SC.toast('Roulette is random again'); }); });
    btn('owWhB', 'Land on it this spin', function () { tset('wheel', 'now', $('owWhV').value).then(function (x) { if (x && x.ok) SC.toast('This spin lands on ' + $('owWhV').value); }); });
    btn('owWhB', 'Queue for the next spins', function () { tset('wheel', 'next', $('owWhV').value, $('owWhN').value).then(function (x) { if (x && x.ok) SC.toast('Queued'); }); });
    btn('owWhB', 'Back to random', function () { tset('wheel', 'clear').then(function (x) { if (x && x.ok) SC.toast('Wheel is random again'); }); });
    ['owCrX', 'owCrN', 'owRoV', 'owRoN', 'owWhV', 'owWhN'].forEach(function (id) { $(id).addEventListener('keydown', function (e) { e.stopPropagation(); }); });
  }
  function tablesPaint() {
    var t = S.tbl; if (!t || !$('owCrSt')) return;
    var c = t.crash, r = t.roulette, w = t.wheel, q = function (a, f) { return a.length ? 'Queued: ' + a.map(f || String).join(', ') : ''; };
    $('owCrSt').textContent = c.phase === 'run' ? 'Flying at ' + c.mult.toFixed(2) + 'x. Set to crash at ' + c.point.toFixed(2) + 'x.' : c.phase === 'end' ? 'Crashed at ' + c.point.toFixed(2) + 'x.' : 'Betting open. This round is set to crash at ' + c.point.toFixed(2) + 'x.';
    $('owCrQ').textContent = [c.fixed ? 'Every round: ' + c.fixed + 'x' : '', q(c.queue, function (v) { return v + 'x'; }), c.hist && c.hist.length ? 'Recent: ' + c.hist.map(function (v) { return (v.point || v) + 'x'; }).join(', ') : ''].filter(Boolean).join(' · ');
    $('owRoSt').textContent = r.phase === 'spin' && r.result != null ? 'Spinning, it lands on ' + r.result + '.' : r.phase === 'bet' ? 'Betting open.' : 'Round in progress.';
    $('owRoQ').textContent = q(r.queue);
    $('owWhSt').textContent = w.phase === 'bet' ? 'Betting open.' : 'Round in progress.';
    $('owWhQ').textContent = q(w.queue);
  }
  function sync() {
    var m = $('owMode').value;
    [].forEach.call(document.querySelectorAll('#panel [data-panel="owner"] .mode'), function (el) { el.style.display = el.classList.contains('m-' + m) ? '' : 'none'; });
    $('owHint').textContent = m === 'win' ? 'Every counted round ends in a win for the player.' : m === 'lose' ? 'Every counted round ends in a loss.' : m === 'payout' ? 'Pays between those multipliers when the game has one that fits. Slots pays 3x, 4x, 6x, 10x, 20x, 50x or 150x for a line, for example. If nothing fits, the closest one is used.' : 'Each round is decided up front with that chance, so over time they win about that share.';
  }
  function take(x) { S.rules = x.rules || []; S.log = x.log || []; if (x.games) S.games = x.games; paint(); }
  function describe(r) {
    var m = r.mode === 'win' ? 'wins' : r.mode === 'lose' ? 'loses' : r.mode === 'payout' ? 'pays ' + r.min + 'x' + (r.max ? ' to ' + r.max + 'x' : ' or more') : 'wins ' + r.chance + '% of rounds';
    return (r.name && r.name !== '*' ? r.name : 'Everyone') + ' · ' + gname(r.game) + ' · ' + m;
  }
  function detail(r) {
    var b = [r.uses ? Math.max(0, r.left) + ' of ' + r.uses + ' rounds left' : 'no round limit'];
    if (r.expires) b.push(r.expires < Date.now() ? 'expired' : 'ends ' + new Date(r.expires).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    b.push(r.hits + ' used'); if (r.cid === '*' && r.staff) b.push('staff included'); if (r.note) b.push(r.note);
    return b.join(' · ');
  }
  function paint() {
    var el = $('owRules'); el.innerHTML = '';
    if (!S.rules.length) el.innerHTML = '<div class="ow-empty">No rigs yet. Everything plays fair.</div>';
    S.rules.slice().reverse().forEach(function (r) {
      var live = r.on && !(r.expires && r.expires < Date.now()) && !(r.uses && r.left <= 0);
      var row = document.createElement('div'); row.className = 'ow-row';
      row.innerHTML = '<div class="ow-tx"><div class="ow-t">' + esc(describe(r)) + '</div><div class="ow-s">' + esc(detail(r)) + '</div></div><span class="ow-b' + (live ? ' on' : '') + '">' + (live ? 'Active' : 'Off') + '</span>';
      var t = document.createElement('button'); t.type = 'button'; t.className = 'chip'; t.textContent = r.on ? 'Turn off' : 'Turn on';
      t.onclick = function () { staff({ action: 'casino.rig.toggle', id: r.id }).then(function (x) { if (x && x.ok) take(x); else err(x); }); };
      var d = document.createElement('button'); d.type = 'button'; d.className = 'chip red'; d.textContent = 'Delete';
      d.onclick = function () { staff({ action: 'casino.rig.del', id: r.id }).then(function (x) { if (x && x.ok) take(x); else err(x); }); };
      row.appendChild(t); row.appendChild(d); el.appendChild(row);
    });
    var lg = $('owLog'); lg.innerHTML = '';
    if (!S.log.length) lg.innerHTML = '<div class="ow-empty">Rigged rounds will show up here.</div>';
    S.log.slice(0, 40).forEach(function (l) {
      var x = l.bet ? Math.round(l.payout / l.bet * 100) / 100 : 0, row = document.createElement('div'); row.className = 'ow-row';
      row.innerHTML = '<div class="ow-tx"><div class="ow-t">' + esc((l.name || 'Player') + ' · ' + gname(l.game)) + '</div><div class="ow-s">Bet ' + SC.fmt(l.bet) + ', paid ' + SC.fmt(l.payout) + (l.bet ? ' (' + x + 'x)' : '') + ' · ' + new Date(l.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + (l.ok ? '' : ' · closest match') + '</div></div>';
      lg.appendChild(row);
    });
  }
  function add() {
    var mode = $('owMode').value;
    if (mode === 'payout' && !(Number($('owMin').value) > 0)) { SC.toast('Enter the multiplier it should pay'); return; }
    var b = $('owAdd'); b.disabled = true;
    staff({ action: 'casino.rig.add', game: $('owGame').value, mode: mode, username: $('owWho').value.trim(), min: $('owMin').value, max: $('owMax').value, chance: $('owChance').value, uses: $('owUses').value, minutes: $('owMins').value, staff: $('owStaff').checked, note: $('owNote').value.trim() })
      .then(function (x) { b.disabled = false; if (x && x.ok) { take(x); SC.toast('Rig added'); } else err(x); });
  }
  function load() {
    staff({ action: 'casino.rig.list' }).then(function (x) {
      if (!x || !x.ok) { err(x); return; }
      var sel = $('owGame'); if (!S.ready) { sel.innerHTML = '<option value="*">All games</option>' + x.games.filter(function (g) { return !SHARED[g[0]]; }).map(function (g) { return '<option value="' + g[0] + '">' + esc(g[1]) + '</option>'; }).join(''); S.ready = true; }
      take(x);
    });
  }
  var prevOpen = SC.games && SC.games.open;
  SC.games.open = function (kind) { if (prevOpen) prevOpen(kind); if (kind === 'owner') { build(); load(); tget(); tpoll(); } };
})();
