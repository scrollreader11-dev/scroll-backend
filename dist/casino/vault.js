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

  // ================================================================ the two things every admin panel ends with
  // Recent activity for that panel (from the staff audit log) and a notepad shared by all staff.
  function agoT(ts) { var m = Math.max(0, Math.round((Date.now() - ts) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago'; }
  SC.staffExtras = function (host, key, prefixes) {
    if (!host || host.querySelector('.sx[data-k="' + key + '"]')) return;
    var box = document.createElement('div'); box.className = 'sx'; box.dataset.k = key;
    box.innerHTML =
      '<div class="ow-card"><div class="ow-t">🕘 Recent activity</div><div class="ow-s">The latest changes staff made on this panel.</div><div class="sx-list"></div><div class="betrow"><button type="button" class="chip sx-r">Refresh</button></div></div>' +
      '<div class="ow-card"><div class="ow-t">📝 Team notes</div><div class="ow-s">A notepad for this panel. Everyone on staff sees it.</div><textarea class="sx-ta" rows="4" maxlength="1500" placeholder="Leave a note for the other staff..." aria-label="Team notes"></textarea><div class="betrow"><button type="button" class="chip on sx-s">Save note</button></div><div class="ow-s sx-m">Loading notes...</div></div>';
    host.appendChild(box);
    var list = box.querySelector('.sx-list'), ta = box.querySelector('.sx-ta'), meta = box.querySelector('.sx-m');
    noKeys(ta);
    function loadAct() {
      staff({ action: 'panel.activity', prefixes: prefixes || [], limit: 6 }).then(function (r) {
        var l = (r && r.items) || []; list.innerHTML = '';
        if (!l.length) { list.innerHTML = '<div class="ow-empty">Nothing on this panel has been changed yet.</div>'; return; }
        l.forEach(function (e) { var d = document.createElement('div'); d.className = 'sx-it'; d.innerHTML = '<span class="sx-at">' + agoT(e.ts) + '</span><b>' + esc(e.by) + '</b><span class="sx-ac">' + esc(e.action) + '</span>' + (e.target ? '<span class="sx-tg">' + esc(e.target) + '</span>' : '') + (e.detail ? '<span class="sx-dt">' + esc(e.detail) + '</span>' : ''); list.appendChild(d); });
      });
    }
    function showNote(n) { ta.value = n ? n.text : ''; meta.textContent = n ? 'Last edited by ' + n.by + ' · ' + agoT(n.ts) : 'No notes yet.'; }
    staff({ action: 'notes.get', key: key }).then(function (r) { showNote(r && r.note); });
    box.querySelector('.sx-r').onclick = loadAct;
    box.querySelector('.sx-s').onclick = function () { staff({ action: 'notes.set', key: key, text: ta.value }).then(function (r) { if (r && r.ok) { SC.toast(r.note ? 'Note saved' : 'Note cleared'); showNote(r.note); loadAct(); } else SC.toast(say(r)); }); };
    loadAct();
  };

  // ================================================================ WALL OF SHAME
  // The board in the Owner Vault shows who is really banned right now. world art reads SC.shame.
  var shame = SC.shame = { list: [], at: 0, fresh: {}, busy: false };
  function stillBanned(b) { return !!b && (!b.until || b.until > Date.now()); }
  SC.shameRefresh = function () {
    if (shame.busy || !allowed()) return; shame.busy = true;
    staff({ action: 'players.list', filter: 'banned', sort: 'recent', limit: 24 }).then(function (r) {
      shame.busy = false; if (!r || !r.ok) return;
      var l = (r.players || []).filter(function (p) { return stillBanned(p.ban); }).map(function (p) { return { name: p.username, until: p.ban.until || 0, reason: p.ban.reason || '', by: p.ban.by || '', ts: p.ban.ts || 0 }; });
      l.sort(function (a, b) { return b.ts - a.ts; });
      var had = {}; shame.list.forEach(function (x) { had[x.name] = 1; });
      if (shame.at) l.forEach(function (x) { if (!had[x.name]) shame.fresh[x.name] = performance.now(); });
      shame.list = l; shame.at = performance.now();
    }, function () { shame.busy = false; });
  };
  setInterval(function () { var w = W(); if (allowed() && w.me && w.me.y > 44 * 48 && (!shame.at || performance.now() - shame.at > 15000)) SC.shameRefresh(); }, 1000);

  // ================================================================ SECURITY CAMERAS
  var cm = { built: false, timer: 0 };
  function buildCams() {
    var host = view('cams'); if (!host || !SC.cams) return;
    if (!allowed()) { host.innerHTML = '<div class="ow-empty">Only owners can use the cameras.</div>'; cm.built = false; return; }
    if (!cm.built) {
      cm.built = true; host.innerHTML = '<div class="ow-s" style="margin:0 0 8px">Live views of six spots on the casino floor. Players cannot see these.</div><div class="camgrid"></div>';
      var grid = host.querySelector('.camgrid');
      SC.cams.feeds.forEach(function (f, i) {
        var d = document.createElement('div'); d.className = 'cam';
        d.innerHTML = '<div class="cam-h"><span class="cam-rec">● REC</span><b>' + esc(f.name) + '</b><span class="cam-n" data-i="' + i + '">👥 0</span></div>';
        d.appendChild(f.cv);
        var bt = document.createElement('div'); bt.className = 'betrow'; bt.appendChild(chip('Go there', function () { net({ op: 'warp', spot: f.spot }); if (SC.closePanel) SC.closePanel(); }));
        d.appendChild(bt); grid.appendChild(d);
      });
    }
    SC.cams.watch = 1; clearInterval(cm.timer);
    cm.timer = setInterval(function () {
      if (!visible('cams')) { clearInterval(cm.timer); SC.cams.watch = 0; return; }
      [].forEach.call(host.querySelectorAll('.cam-n'), function (e) { var f = SC.cams.feeds[+e.dataset.i]; if (f) e.textContent = '👥 ' + f.n; });
    }, 400);
  }

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
          who.value = ''; hmBans(); hmPeople(); SC.shameRefresh();
        } else SC.toast(say(r));
      });
    };
    $('hmSmite').onclick = function () {
      var p = find(who.value); if (!p) { SC.toast('They are not in the casino right now'); return; }
      net({ op: 'smite', id: p.id }); SC.toast('⚡ Smiting ' + p.nick);
    };
    $('hmCarry').onclick = function () { hm.carry = !hm.carry; net({ op: 'hammer', on: hm.carry }); $('hmCarry').classList.toggle('on', hm.carry); $('hmCarry').textContent = hm.carry ? 'Put the hammer away' : 'Carry the hammer'; };
    $('hmSlam').onclick = function () { net({ op: 'slam' }); swing(); };
    hmPeople(); hmBans(); SC.staffExtras(host, 'casino-hammer', ['ban', 'unban']);
    if (SC.vault && SC.vault.tab === 'bans') { SC.vault.tab = ''; setTimeout(function () { var b = $('hmBans'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'start' }); }, 80); }
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
        row.appendChild(chip('Lift ban', function () { staff({ action: 'player.unban', username: p.username }).then(function (x) { if (x && x.ok) { SC.toast('Ban lifted for ' + p.username); hmBans(); SC.shameRefresh(); } else SC.toast(say(x)); }); }));
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
    mdPaint(); SC.staffExtras(host, 'casino-modmenu', ['player', 'fun', 'boost', 'casino']); clearInterval(md.timer);
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

  // ================================================================ swing the hammer at someone in the world: ban or smite
  var pick = null;
  function closePick() { if (pick && pick.parentNode) pick.parentNode.removeChild(pick); pick = null; }
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pick) { closePick(); e.stopPropagation(); } }, true);
  SC.hammerPick = function (p) {
    if (!allowed() || !p) return; closePick();
    var d = document.createElement('div'); d.className = 'hpick'; pick = d;
    d.innerHTML = '<div class="hp-t">🔨 ' + esc(p.nick) + '</div><div class="hp-s">Swing the hammer. What happens to them?</div><div class="hp-row" id="hpRow"></div><div class="hp-row" id="hpBan"></div><label class="hp-r">Reason<select id="hpWhy"></select></label>';
    document.body.appendChild(d);
    var whys = ['Breaking the rules', 'Cheating', 'Harassing players', 'Spam', 'Exploiting a bug'], sel = d.querySelector('#hpWhy');
    whys.forEach(function (w) { var o = document.createElement('option'); o.textContent = w; sel.appendChild(o); }); noKeys(sel);
    function done() { closePick(); }
    var row = d.querySelector('#hpRow'), bans = d.querySelector('#hpBan');
    var sm = document.createElement('button'); sm.className = 'btn dark small'; sm.textContent = '⚡ Smite (kick for 1 min)';
    sm.onclick = function () { net({ op: 'smite', id: p.id }); done(); };
    var cn = document.createElement('button'); cn.className = 'btn small'; cn.textContent = 'Cancel'; cn.onclick = done;
    row.appendChild(sm); row.appendChild(cn);
    [['Ban 1 hour', 60], ['Ban 1 day', 1440], ['Ban 7 days', 10080], ['Ban forever', 0]].forEach(function (b) {
      var x = document.createElement('button'); x.className = 'btn red small'; x.textContent = '🔨 ' + b[0];
      x.onclick = function () {
        x.disabled = true;
        staff({ action: 'player.ban', username: p.nick, minutes: b[1], reason: sel.value }).then(function (r) {
          if (r && r.ok) { net({ op: 'smite', id: p.id, ban: 1 }); SC.shameRefresh(); SC.toast('🔨 ' + p.nick + ' banned (' + b[0].toLowerCase().replace('ban ', '') + ')'); }
          else if (r && r.error === 'no-account') { net({ op: 'smite', id: p.id }); SC.toast(p.nick + ' has no account to ban, so they were smitten instead.'); }
          else SC.toast(say(r));
          done();
        });
      };
      bans.appendChild(x);
    });
    var iv = setInterval(function () { if (!pick || pick !== d) { clearInterval(iv); return; } if (!(W().players && W().players()[p.id])) done(); }, 500);
  };

  var prev = SC.games && SC.games.open;
  if (SC.games) SC.games.open = function (kind) {
    if (prev) prev(kind);
    if (kind === 'hammer') buildHammer();
    if (kind === 'cams') buildCams();
    if (kind === 'modmenu') buildMod();
  };
})();
