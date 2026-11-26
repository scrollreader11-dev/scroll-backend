/* Scrolls Casino: the Owner Vault panels (Ban Hammer and Mod Menu).
   Only owners and co-owners can walk into the vault, and every action here is checked again on the server:
   bans, Scrolls and events go through /api/staff/act (role checked per request, logged in the audit log),
   and the in-world tools (teleport, freeze, smite, announce...) go through the casino socket, which only accepts
   them from an owner account. A hidden or edited button gives a non-owner nothing. */
(function () {
  var SC = window.SC = window.SC || {};
  var $ = function (s) { return document.getElementById(s); }, esc = SC.esc;
  var hm = { built: false, mins: 1440, reason: 'Breaking the rules', arm: null, armT: 0, carry: false };
  var md = { built: false, tab: 'players', sel: 0, timer: 0 };

  function staff(body) {
    return fetch('/api/staff/act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' })
      .then(function (r) { return r.json(); }).catch(function () { return { error: 'network' }; });
  }
  function say(r) { return (r && (r.message || r.error)) || 'That did not work'; }
  function net(o) { o.t = 'v'; if (SC.netSend) SC.netSend(o); }
  function W() { return SC._world || {}; }
  function allowed() { return SC.role === 'owner' || SC.role === 'coowner'; }
  function inCasino() {   // everybody on the floor except me
    var P = W().players ? W().players() : {}, out = [];
    for (var id in P) if (!P[id].leaving) out.push(P[id]);
    return out.sort(function (a, b) { return String(a.nick).localeCompare(String(b.nick)); });
  }
  function find(nick) { var l = inCasino(), n = String(nick || '').trim().toLowerCase(); for (var i = 0; i < l.length; i++) if (String(l[i].nick).toLowerCase() === n) return l[i]; return null; }
  function chip(label, fn, cls) { var b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (cls ? ' ' + cls : ''); b.textContent = label; b.onclick = fn; return b; }
  function noKeys(el) { el.addEventListener('keydown', function (e) { e.stopPropagation(); }); }
  function view(kind) { return document.querySelector('#panel .view[data-panel="' + kind + '"]'); }
  function visible(kind) { var v = view(kind); return !!(v && v.classList.contains('on')); }

  // ================================================================ BAN HAMMER
  function buildHammer() {
    var host = view('hammer'); if (!host) return;
    if (!allowed()) { host.innerHTML = '<div class="ow-empty">Only owners can lift the hammer.</div>'; hm.built = false; return; }
    if (hm.built) { hmPeople(); hmBans(); return; } hm.built = true;
    host.innerHTML =
      '<div class="hm-hero"><div class="hm-ico" id="hmIco">🔨</div><div><div class="ow-t">Who gets the hammer?</div><div class="ow-s">Bans lock the whole ScrollHub account, not just the casino. Staff accounts are protected by the server.</div></div></div>' +
      '<div class="ow-card"><div class="ow-grid"><label class="wide">Username<input type="text" id="hmWho" maxlength="40" placeholder="Type a username" autocomplete="off" autocapitalize="off" spellcheck="false" /></label></div>' +
      '<div class="ow-s" style="margin-top:6px">In the casino right now</div><div class="betrow" id="hmPeople"></div>' +
      '<div class="betrow" id="hmFound"></div></div>' +
      '<div class="ow-card"><div class="ow-t">How long</div><div class="betrow" id="hmDur"></div>' +
      '<div class="ow-t" style="margin-top:10px">Why</div><div class="betrow" id="hmWhy"></div>' +
      '<div class="ow-grid"><label class="wide">Reason shown to them<input type="text" id="hmReason" maxlength="100" /></label></div></div>' +
      '<div class="betrow c"><button class="btn red" id="hmBan" style="min-width:240px">🔨 Ban</button><button class="btn dark" id="hmSmite">⚡ Smite (kick for 1 min)</button></div>' +
      '<div class="ow-card"><div class="ow-t">Your hammer</div><div class="ow-s">Carry it so everyone sees it in your hand. Swing it for a shockwave.</div><div class="betrow"><button class="chip" id="hmCarry">Carry the hammer</button><button class="chip" id="hmSlam">Swing it</button></div></div>' +
      '<h3 class="ow-h">Banned accounts</h3><div class="hint">The most recent ones. You can lift a ban here.</div><div id="hmBans"><div class="ow-empty">Loading…</div></div>';
    var who = $('hmWho'), reason = $('hmReason'); noKeys(who); noKeys(reason); reason.value = hm.reason;
    reason.oninput = function () { hm.reason = reason.value; };
    var durs = [['10 minutes', 10], ['1 hour', 60], ['1 day', 1440], ['7 days', 10080], ['Forever', 0]];
    durs.forEach(function (d) { var b = chip(d[0], function () { hm.mins = d[1]; paint(); }); b._m = d[1]; $('hmDur').appendChild(b); });
    ['Cheating', 'Harassing players', 'Spam', 'Exploiting a bug', 'Breaking the rules'].forEach(function (w) { var b = chip(w, function () { hm.reason = w; reason.value = w; paint(); }); b._w = w; $('hmWhy').appendChild(b); });
    function paint() {
      [].forEach.call($('hmDur').children, function (b) { b.classList.toggle('on', b._m === hm.mins); });
      [].forEach.call($('hmWhy').children, function (b) { b.classList.toggle('on', b._w === hm.reason); });
    }
    paint();
    var t = 0; who.oninput = function () {
      disarm(); clearTimeout(t); var q = who.value.trim(); if (q.length < 2) { $('hmFound').innerHTML = ''; return; }
      t = setTimeout(function () { staff({ action: 'players.search', q: q }).then(function (r) { var f = $('hmFound'); f.innerHTML = ''; ((r && r.players) || []).slice(0, 8).forEach(function (p) { f.appendChild(chip(p.username + (p.online ? ' •' : '') + (p.role ? ' (' + p.role + ')' : ''), function () { who.value = p.username; f.innerHTML = ''; })); }); }); }, 220);
    };
    function disarm() { hm.arm = null; clearTimeout(hm.armT); $('hmBan').textContent = '🔨 Ban'; }
    $('hmBan').onclick = function () {
      var name = who.value.trim(); if (!name) { SC.toast('Pick a player first'); return; }
      if (hm.arm !== name) {
        hm.arm = name; $('hmBan').textContent = '🔨 Click again to ban ' + name; clearTimeout(hm.armT); hm.armT = setTimeout(disarm, 4500); return;
      }
      disarm();
      var dur = hm.mins ? durs.filter(function (d) { return d[1] === hm.mins; })[0][0] : 'forever';
      staff({ action: 'player.ban', username: name, minutes: hm.mins, reason: (hm.reason || 'Banned by staff').trim() }).then(function (r) {
        if (r && r.ok) {
          SC.toast('🔨 ' + name + ' banned (' + dur + ')'); swing();
          var p = find(name); if (p) net({ op: 'smite', id: p.id }); else net({ op: 'slam' });
          who.value = ''; hmBans(); hmPeople();
        } else SC.toast(say(r));
      });
    };
    $('hmSmite').onclick = function () {
      var p = find(who.value); if (!p) { SC.toast('They are not in the casino right now'); return; }
      net({ op: 'smite', id: p.id }); SC.toast('⚡ Smiting ' + p.nick);
    };
    $('hmCarry').onclick = function () { hm.carry = !hm.carry; net({ op: 'hammer', on: hm.carry }); $('hmCarry').classList.toggle('on', hm.carry); $('hmCarry').textContent = hm.carry ? 'Put the hammer away' : 'Carry the hammer'; };
    $('hmSlam').onclick = function () { net({ op: 'slam' }); swing(); };
    hmPeople(); hmBans();
  }
  function swing() { var e = $('hmIco'); if (!e) return; e.classList.remove('swing'); void e.offsetWidth; e.classList.add('swing'); }
  function hmPeople() {
    var host = $('hmPeople'); if (!host) return; host.innerHTML = '';
    var l = inCasino(); if (!l.length) { host.innerHTML = '<span class="ow-s">Nobody else is here.</span>'; return; }
    l.slice(0, 24).forEach(function (p) { host.appendChild(chip(p.nick, function () { $('hmWho').value = p.nick; })); });
  }
  function hmBans() {
    staff({ action: 'players.list', filter: 'banned', sort: 'recent', limit: 10 }).then(function (r) {
      var host = $('hmBans'); if (!host) return; host.innerHTML = '';
      var l = (r && r.players) || []; if (!l.length) { host.innerHTML = '<div class="ow-empty">Nobody is banned.</div>'; return; }
      l.forEach(function (p) {
        var row = document.createElement('div'); row.className = 'ow-row'; row.innerHTML = '<div class="ow-tx"><div class="ow-t">' + esc(p.username) + '</div></div>';
        row.appendChild(chip('Lift ban', function () { staff({ action: 'player.unban', username: p.username }).then(function (x) { if (x && x.ok) { SC.toast('Ban lifted for ' + p.username); hmBans(); } else SC.toast(say(x)); }); }));
        host.appendChild(row);
      });
    });
  }

  // ================================================================ MOD MENU
  function buildMod() {
    var host = view('modmenu'); if (!host) return;
    if (!allowed()) { host.innerHTML = '<div class="ow-empty">Only owners can use the Mod Menu.</div>'; md.built = false; return; }
    if (!md.built) {
      md.built = true;
      host.innerHTML = '<div class="tabs" id="mdTabs"></div><div id="mdBody"></div>';
      [['players', '👥 Players'], ['casino', '🎪 Casino'], ['me', '🧍 Me']].forEach(function (t) { var b = document.createElement('button'); b.className = 'tab'; b.textContent = t[1]; b.dataset.k = t[0]; b.onclick = function () { md.tab = t[0]; mdPaint(); }; $('mdTabs').appendChild(b); });
    }
    var want = SC.vault && SC.vault.tab; if (want) { md.tab = want === 'cast' ? 'casino' : want; SC.vault.tab = ''; }
    mdPaint(); clearInterval(md.timer);
    md.timer = setInterval(function () { if (!visible('modmenu')) { clearInterval(md.timer); return; } if (md.tab === 'players' && !document.activeElement.matches('input')) mdPlayers(); }, 1500);
  }
  function mdPaint() {
    [].forEach.call($('mdTabs').children, function (b) { b.classList.toggle('on', b.dataset.k === md.tab); });
    var body = $('mdBody'); body.innerHTML = '';
    if (md.tab === 'players') mdPlayers(); else if (md.tab === 'casino') mdCasino(body); else mdMe(body);
  }
  function mdPlayers() {
    var body = $('mdBody'); if (md.tab !== 'players' || !body) return;
    var l = inCasino(), me = W().me, selP = null; l.forEach(function (p) { if (p.id === md.sel) selP = p; });
    if (!selP) md.sel = 0;
    var h = '<div class="hint">' + (l.length ? l.length + ' other player' + (l.length === 1 ? '' : 's') + ' on the floor. Tap one to see what you can do.' : 'Nobody else is on the floor right now.') + '</div><div id="mdList"></div><div id="mdAct"></div>';
    body.innerHTML = h;
    var list = $('mdList');
    l.forEach(function (p) {
      var row = document.createElement('div'); row.className = 'ow-row' + (p.id === md.sel ? ' sel' : ''); row.style.cursor = 'pointer';
      row.innerHTML = '<div class="ow-tx"><div class="ow-t">' + esc(p.nick) + (p.own ? ' 👑' : '') + '</div><div class="ow-s">' + (p.frozen ? '🧊 frozen · ' : '') + (p.scale !== 1 ? 'size ' + p.scale + ' · ' : '') + (p.busy ? 'at ' + esc(p.busy) : 'walking around') + '</div></div>';
      row.onclick = function () { md.sel = p.id; mdPlayers(); };
      list.appendChild(row);
    });
    if (!selP) return;
    var a = $('mdAct'), card = document.createElement('div'); card.className = 'ow-card'; a.appendChild(card);
    card.innerHTML = '<div class="ow-t">' + esc(selP.nick) + '</div><div class="betrow" id="mdBtns"></div><div class="ow-grid"><label class="wide">Scrolls<input type="number" id="mdAmt" value="1000" min="1" /></label></div><div class="betrow" id="mdCoin"></div>';
    var B = $('mdBtns'), id = selP.id;
    B.appendChild(chip('➡️ Go to them', function () { net({ op: 'goto', id: id }); }));
    B.appendChild(chip('⬅️ Bring here', function () { net({ op: 'bring', id: id }); }));
    B.appendChild(chip(selP.frozen ? '🔥 Thaw' : '🧊 Freeze', function () { net({ op: 'freeze', id: id, on: !selP.frozen }); setTimeout(mdPlayers, 400); }));
    B.appendChild(chip('🐭 Tiny', function () { net({ op: 'size', id: id, s: 0.5 }); }));
    B.appendChild(chip('🦖 Giant', function () { net({ op: 'size', id: id, s: 2.6 }); }));
    B.appendChild(chip('Normal size', function () { net({ op: 'size', id: id, s: 1 }); }));
    B.appendChild(chip('⚡ Smite', function () { net({ op: 'smite', id: id }); }, 'red'));
    B.appendChild(chip('🔨 Ban…', function () { SC.openPanel('hammer'); setTimeout(function () { var w = $('hmWho'); if (w) w.value = selP.nick; }, 60); }, 'red'));
    var amt = $('mdAmt'); noKeys(amt);
    [['Give', 'give'], ['Take', 'take']].forEach(function (m) {
      $('mdCoin').appendChild(chip(m[0] + ' Scrolls', function () {
        var n = Math.floor(Number(amt.value) || 0); if (n < 1) { SC.toast('Pick an amount'); return; }
        staff({ action: 'player.coins', username: selP.nick, mode: m[1], amount: n }).then(function (r) { SC.toast(r && r.ok ? (m[1] === 'give' ? 'Gave ' : 'Took ') + n.toLocaleString() + ' Scrolls ' + (m[1] === 'give' ? 'to ' : 'from ') + selP.nick : say(r)); });
      }));
    });
  }
  function mdCasino(body) {
    body.innerHTML =
      '<div class="ow-card"><div class="ow-t">📢 Announcement</div><div class="ow-s">A big banner on every screen in the casino.</div><div class="ow-grid"><label class="wide">Message<input type="text" id="mdSay" maxlength="140" placeholder="What should everyone read?" /></label></div><div class="betrow"><button class="btn gold small" id="mdSayGo">Announce</button></div></div>' +
      '<div class="ow-card"><div class="ow-t">✨ Show</div><div class="ow-s">Everyone in the casino sees it for about ten seconds.</div><div class="betrow" id="mdFx"></div></div>' +
      '<div class="ow-card"><div class="ow-t">☔ Scrolls for everyone</div><div class="ow-grid"><label>Amount each<input type="number" id="mdRain" value="1000" min="1" /></label><label>Raffle winners<input type="number" id="mdWin" value="3" min="1" max="10" /></label></div><div class="betrow"><button class="chip" id="mdRainGo">☔ Rain on everyone online</button><button class="chip" id="mdRaffGo">🎟️ Raffle it</button></div></div>' +
      '<div class="ow-card"><div class="ow-t">⚡ Earnings boost</div><div class="ow-s">Multiplies Scroll winnings site wide for a while.</div><div class="betrow" id="mdBoost"></div></div>' +
      '<div class="betrow c"><button class="btn gold" id="mdRig">★ Open the Rig Console</button></div>';
    noKeys($('mdSay')); noKeys($('mdRain')); noKeys($('mdWin'));
    $('mdSayGo').onclick = function () { var t = $('mdSay').value.trim(); if (!t) return; net({ op: 'announce', text: t }); $('mdSay').value = ''; };
    $('mdSay').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('mdSayGo').onclick(); });
    [['🎉 Party', 'party'], ['🎆 Fireworks', 'fireworks'], ['⛈️ Storm', 'storm'], ['🪩 Disco', 'disco'], ['❄️ Snow', 'snow']].forEach(function (f) { $('mdFx').appendChild(chip(f[0], function () { net({ op: 'fx', k: f[1] }); })); });
    $('mdRainGo').onclick = function () { staff({ action: 'fun.rain', amount: Number($('mdRain').value) || 0 }).then(function (r) { SC.toast(r && r.ok ? r.message : say(r)); if (r && r.ok) net({ op: 'fx', k: 'party' }); }); };
    $('mdRaffGo').onclick = function () { staff({ action: 'fun.raffle', amount: Number($('mdRain').value) || 0, count: Number($('mdWin').value) || 1 }).then(function (r) { SC.toast(r && r.ok ? r.message : say(r)); if (r && r.ok) net({ op: 'fx', k: 'fireworks' }); }); };
    [['2× for 15 min', 15, 2], ['2× for 1 hour', 60, 2], ['3× for 10 min', 10, 3], ['End boost', 0, 1]].forEach(function (b) {
      $('mdBoost').appendChild(chip(b[0], function () { staff({ action: 'boost.set', mins: b[1], mult: b[2], label: 'Owner boost' }).then(function (r) { SC.toast(r && r.ok ? (b[1] ? 'Boost on: ' + b[0] : 'Boost ended') : say(r)); }); }));
    });
    $('mdRig').onclick = function () { SC.openPanel('owner'); };
  }
  function mdMe(body) {
    var me = W().me || {};
    body.innerHTML =
      '<div class="ow-card"><div class="ow-t">🏃 Speed</div><div class="ow-s">Double walking speed. The server allows it for owners only.</div><div class="betrow"><button class="chip" id="mdFast"></button></div></div>' +
      '<div class="ow-card"><div class="ow-t">📏 Size</div><div class="betrow" id="mdSize"></div></div>' +
      '<div class="ow-card"><div class="ow-t">🔨 Hammer</div><div class="betrow"><button class="chip" id="mdHam"></button><button class="chip" id="mdSlam">Swing it</button></div></div>' +
      '<div class="ow-card"><div class="ow-t">🌀 Warp pads</div><div class="betrow" id="mdWarp"></div></div>';
    function fastLbl() { $('mdFast').textContent = me.fast ? 'Speed boost: on' : 'Speed boost: off'; $('mdFast').classList.toggle('on', !!me.fast); }
    function hamLbl() { $('mdHam').textContent = me.hammer ? 'Put the hammer away' : 'Carry the hammer'; $('mdHam').classList.toggle('on', !!me.hammer); }
    fastLbl(); hamLbl();
    $('mdFast').onclick = function () { net({ op: 'speed', on: !me.fast }); setTimeout(fastLbl, 350); };
    $('mdHam').onclick = function () { hm.carry = !me.hammer; net({ op: 'hammer', on: hm.carry }); setTimeout(hamLbl, 350); };
    $('mdSlam').onclick = function () { net({ op: 'slam' }); };
    [['🐭 Tiny', 0.5], ['Normal', 1], ['🦖 Giant', 1.7], ['🌋 Mega', 2.6]].forEach(function (s) { $('mdSize').appendChild(chip(s[0], function () { net({ op: 'size', s: s[1] }); })); });
    [['Lobby', 'lobby'], ['Slot Alley', 'slots'], ['High Stakes', 'stakes'], ['The Lounge', 'lounge'], ['The Vault', 'vault'], ['Duel Arena', 'arena'], ['Shop', 'shop'], ['Arcade', 'arcade'], ['Owner Vault', 'owner']].forEach(function (w) {
      $('mdWarp').appendChild(chip(w[0], function () { net({ op: 'warp', spot: w[1] }); W().closePanel && W().closePanel(); }));
    });
  }

  var prev = SC.games && SC.games.open;
  if (SC.games) SC.games.open = function (kind) {
    if (prev) prev(kind);
    if (kind === 'hammer') buildHammer();
    if (kind === 'modmenu') buildMod();
  };
})();
