/* Scrolls Casino: Owner panel (owner and co-owner only).
   Rig a game: choose the game, the player and what should happen. Everything is applied on the server
   (casino.js) and logged to the audit log. The button only appears for staff with that role. */
(function () {
  var SC = window.SC = window.SC || {};
  var $ = function (s) { return document.getElementById(s); };
  var esc = SC.esc;
  var S = { rules: [], log: [], games: [], ready: false, built: false };
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
    $('owMode').onchange = sync; sync();
    $('owAdd').onclick = add;
    $('owClear').onclick = function () { if (!S.rules.length) return; staff({ action: 'casino.rig.clear' }).then(function (x) { if (x && x.ok) { take(x); SC.toast('All rigs deleted'); } else err(x); }); };
    ['owGame', 'owWho', 'owMin', 'owMax', 'owChance', 'owUses', 'owMins', 'owNote'].forEach(function (id) { $(id).addEventListener('keydown', function (e) { e.stopPropagation(); }); });
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
      var sel = $('owGame'); if (!S.ready) { sel.innerHTML = '<option value="*">All games</option>' + x.games.map(function (g) { return '<option value="' + g[0] + '">' + esc(g[1]) + '</option>'; }).join(''); S.ready = true; }
      take(x);
    });
  }
  var prevOpen = SC.games && SC.games.open;
  SC.games.open = function (kind) { if (prevOpen) prevOpen(kind); if (kind === 'owner') { build(); load(); } };
})();
