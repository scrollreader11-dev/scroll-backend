/* ScrollHub Hub: more admin panels. Live rooms, server log, scheduler, polls and countdown, boosts, raffle and rain,
   game switches, branding, backup. Every action runs on the server and checks the caller's role there too. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub || !Hub.adminKit) return;
  var K = Hub.adminKit, P = K.PANES, h = Hub.h, icon = Hub.icon, card = K.card, btn = K.btn, inp = K.inp, field = K.field, post = K.post, toastErr = K.toastErr, confirmBox = K.confirmBox, empty = K.empty, loading = K.loading;
  function alive(host) { return document.body.contains(host); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function localInput(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function when(ms) { return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function mins(n) { n = Math.max(0, Math.round(n / 60000)); return n >= 60 ? Math.floor(n / 60) + 'h ' + (n % 60) + 'm' : n + 'm'; }
  function sel(opts, val) { var s = h('select', { class: 'input' }); opts.forEach(function (o) { s.appendChild(h('option', { value: o[0], text: o[1] })); }); s.value = String(val); return s; }
  function done(label) { return function (r) { r && r.ok ? Hub.toast(label) : toastErr(r); return r; }; }

  // ---------- Live rooms ----------
  P.rooms = function (host) {
    var box = h('div'), top = h('div', { class: 'adm-stats' });
    host.appendChild(top); host.appendChild(card('Matches', 'Everything running in Bedwars, Racing, Royale and the minigames right now. Refreshes by itself.', box));
    var NAMES = { bw: 'Bedwars', race: 'Racing', royale: 'Royale', ctf: 'Capture the Flag', spleef: 'TNT Spleef', hide: 'Prop Hunt', duel: 'Duels', murder: 'Murder Mystery', build: 'Build Battle' };
    function stat(l, v) { return h('div', { class: 'adm-stat' }, [h('div', { class: 'sv', text: String(v) }), h('div', { class: 'sl', text: l })]); }
    function paint(r) {
      Hub.clear(top); Hub.clear(box); var rooms = r.rooms || [], play = rooms.filter(function (x) { return x.state === 'play'; }).length;
      top.appendChild(stat('Connected to Games', r.online || 0)); top.appendChild(stat('Matches running', play)); top.appendChild(stat('Lobbies waiting', rooms.length - play)); top.appendChild(stat('In the casino world', typeof r.world === 'number' ? r.world : (r.world && r.world.count) || 0));
      if (!rooms.length) { box.appendChild(empty('Nothing is running. When someone starts a match it appears here.')); return; }
      rooms.forEach(function (x) {
        var names = (x.players || []).filter(function (p) { return p.human !== false && !p.bot; }).map(function (p) { return p.nick; });
        var meta = (NAMES[x.game] || x.game) + (x.mode && x.mode !== x.game ? ' · ' + x.mode : '') + ' · ' + x.kind + (x.code ? ' · code ' + x.code : '');
        box.appendChild(h('div', { class: 'adm-row wrap rm' }, [
          h('div', { style: 'flex:1;min-width:200px' }, [h('b', { text: '#' + x.id + ' ' + (x.state === 'play' ? 'Playing' : x.state === 'lobby' ? 'Waiting' : 'Results') }), h('div', { class: 'hint', text: meta }), h('div', { class: 'hint', text: (names.length ? names.slice(0, 8).join(', ') + (names.length > 8 ? ' and ' + (names.length - 8) + ' more' : '') : 'No human players') + (x.elapsed ? ' · ' + Math.round(x.elapsed / 60 * 10) / 10 + ' min in' : '') })]),
          x.state === 'play' ? btn('End match', function (b) { confirmBox('End match #' + x.id + '?', 'Everyone in it goes back to the lobby. This cannot be undone.', 'End match').then(function (ok) { if (ok) K.busy(b, post({ action: 'rooms.end', id: x.id })).then(function (r2) { r2 && r2.ok ? Hub.toast('Match ended') : toastErr(r2); load(); }); }); }, { danger: true }) : null,
        ]));
      });
    }
    function load() { post({ action: 'rooms.list' }).then(function (r) { if (r && r.ok && alive(host)) paint(r); else if (r && !r.ok) { Hub.clear(box); box.appendChild(empty('Could not load rooms.')); } }); }
    load(); var t = setInterval(function () { if (!alive(host)) { clearInterval(t); return; } if (!document.hidden) load(); }, 4000);
  };

  // ---------- Server log ----------
  P.logs = function (host) {
    var out = h('pre', { class: 'logbox', tabindex: '0', 'aria-label': 'Server log' }), head = h('div', { class: 'hint' }), since = 0, paused = false, lvl = sel([['all', 'Everything'], ['warn', 'Warnings and errors'], ['error', 'Errors only']], 'all'), lines = [];
    var tools = h('div', { class: 'adm-row wrap', style: 'margin-bottom:12px' }, [lvl, Hub.toggle('Pause', '', false, function (v) { paused = v; }), btn('Clear view', function () { lines = []; paintLog(); }), btn('Copy', function () { try { navigator.clipboard.writeText(out.textContent); Hub.toast('Copied'); } catch (e) { Hub.toast('Copy failed', { bad: true }); } })]);
    host.appendChild(card('Server log', 'The last few hundred lines the server printed. Keys and tokens are hidden. Updates every few seconds.', [head, tools, out]));
    function ok(l) { return lvl.value === 'all' || (lvl.value === 'warn' ? l.lvl === 'warn' || l.lvl === 'error' : l.lvl === 'error'); }
    function paintLog() { var stick = out.scrollTop + out.clientHeight >= out.scrollHeight - 30; out.textContent = lines.filter(ok).map(function (l) { var d = new Date(l.ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' ' + (l.lvl === 'log' || l.lvl === 'info' ? '    ' : l.lvl.toUpperCase().slice(0, 4) + ' ') + l.t; }).join('\n') || 'Nothing logged yet.'; if (stick) out.scrollTop = out.scrollHeight; }
    lvl.addEventListener('change', paintLog);
    function load() { if (paused) return; post({ action: 'log.tail', since: since }).then(function (r) { if (!r || !r.ok || !alive(host)) return; since = r.last; if (r.lines.length) { lines = lines.concat(r.lines).slice(-600); } head.textContent = 'Up ' + mins(r.up * 1000) + ' · memory ' + r.mem + ' MB'; paintLog(); }); }
    load(); var t = setInterval(function () { if (!alive(host)) { clearInterval(t); return; } if (!document.hidden) load(); }, 3000);
  };

  // ---------- Scheduler ----------
  P.schedule = function (host) {
    var list = h('div'), text = h('textarea', { class: 'input', rows: '2', maxlength: '300', placeholder: 'What should the announcement say?' }), at = inp('', { type: 'datetime-local' }), every = sel([['0', 'Once'], ['60', 'Every hour'], ['360', 'Every 6 hours'], ['1440', 'Every day'], ['10080', 'Every week']], 0), clr = sel([['0', 'Leave it up'], ['5', 'Remove after 5 min'], ['30', 'Remove after 30 min'], ['120', 'Remove after 2 hours'], ['1440', 'Remove after 1 day']], 30);
    at.value = localInput(Date.now() + 15 * 60000);
    host.appendChild(card('Schedule an announcement', 'It goes up as the site announcement at the time you pick, then comes down by itself if you ask it to.', [field('Message', text), h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:200px' }, field('When', at)), h('div', { style: 'flex:1;min-width:160px' }, field('Repeat', every)), h('div', { style: 'flex:1;min-width:160px' }, field('Take it down', clr))]), h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Schedule it', function (b) { var ms = new Date(at.value).getTime(); K.busy(b, post({ action: 'sched.add', text: text.value, at: ms, every: +every.value, clearMins: +clr.value })).then(function (r) { if (r && r.ok) { text.value = ''; Hub.toast('Scheduled'); paint(r.items); } else toastErr(r); }); }, { primary: true })])]));
    host.appendChild(card('Coming up', '', list));
    function paint(items) {
      Hub.clear(list); items = (items || []).filter(function (x) { return x.at || x.clearAt; });
      if (!items.length) { list.appendChild(empty('Nothing is scheduled.')); return; }
      items.sort(function (a, b) { return (a.at || a.clearAt) - (b.at || b.clearAt); }).forEach(function (x) {
        list.appendChild(h('div', { class: 'adm-row wrap', style: 'padding:8px 0;border-top:1px solid rgba(255,255,255,.07)' }, [h('div', { style: 'flex:1;min-width:200px' }, [h('b', { text: x.text }), h('div', { class: 'hint', text: (x.at ? 'Goes up ' + when(x.at) : 'Comes down ' + when(x.clearAt)) + (x.every ? ' · repeats' : '') + (x.clearMins ? ' · stays ' + x.clearMins + ' min' : '') })]), btn('Remove', function () { post({ action: 'sched.del', id: x.id }).then(function (r) { if (r && r.ok) paint(r.items); else toastErr(r); }); }, { danger: true })]));
      });
    }
    post({ action: 'sched.list' }).then(function (r) { paint(r && r.items); });
  };

  // ---------- Polls and countdown ----------
  P.live = function (host) {
    var cdBox = h('div'), poBox = h('div'), label = inp('Label, for example Winter update'), cdAt = inp('', { type: 'datetime-local' });
    cdAt.value = localInput(Date.now() + 60 * 60000);
    function refresh() { return Hub.loadSchool().then(function () { paintCd(); paintPo(); }); }
    function paintCd() {
      Hub.clear(cdBox); var c = Hub.school.live && Hub.school.live.countdown;
      cdBox.appendChild(h('p', { class: 'hint', text: c ? 'Showing now: ' + c.label + ' (' + when(c.at) + ')' : 'No countdown is showing.' }));
      cdBox.appendChild(h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:200px' }, field('Label', label)), h('div', { style: 'flex:1;min-width:200px' }, field('Ends at', cdAt))]));
      cdBox.appendChild(h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Show countdown', function (b) { K.busy(b, post({ action: 'live.countdown', label: label.value, at: new Date(cdAt.value).getTime() })).then(function (r) { done('Countdown is live')(r); refresh(); }); }, { primary: true }), btn('Remove', function () { post({ action: 'live.countdown', label: '' }).then(function (r) { done('Countdown removed')(r); refresh(); }); })]));
    }
    var q = inp('Question'), opts = h('textarea', { class: 'input', rows: '4', placeholder: 'One choice per line (2 to 6)' }), pm = sel([['0', 'Until I close it'], ['10', '10 minutes'], ['60', '1 hour'], ['1440', '1 day']], 60);
    function paintPo() {
      Hub.clear(poBox); var p = Hub.school.live && Hub.school.live.poll;
      if (p) {
        var tot = p.counts.reduce(function (a, b) { return a + b; }, 0);
        poBox.appendChild(h('p', { class: 'hint', text: 'Running now: ' + p.q + ' (' + tot + ' vote' + (tot === 1 ? '' : 's') + ')' }));
        p.opts.forEach(function (o, i) { var pc = tot ? Math.round(p.counts[i] * 100 / tot) : 0; poBox.appendChild(h('div', { class: 'pl-opt ro' }, [h('i', { class: 'pl-fill', style: 'width:' + pc + '%' }), h('span', { class: 'pl-t', text: o }), h('b', { class: 'pl-n', text: p.counts[i] + ' · ' + pc + '%' })])); });
        poBox.appendChild(h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Close the poll', function () { post({ action: 'live.poll', end: true }).then(function (r) { done('Poll closed')(r); refresh(); }); }, { danger: true }), btn('Refresh results', refresh)]));
        return;
      }
      poBox.appendChild(h('p', { class: 'hint', text: 'No poll is running. Players see it in a strip at the top of the hub and vote with one tap.' }));
      poBox.appendChild(field('Question', q)); poBox.appendChild(field('Choices', opts)); poBox.appendChild(field('Closes', pm));
      poBox.appendChild(h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Start poll', function (b) { K.busy(b, post({ action: 'live.poll', q: q.value, opts: opts.value.split('\n'), mins: +pm.value })).then(function (r) { if (r && r.ok) { q.value = ''; opts.value = ''; Hub.toast('Poll is live'); refresh(); } else toastErr(r); }); }, { primary: true })]));
    }
    host.appendChild(card('Countdown banner', 'A ticking timer in a strip at the top of the hub for everyone. Good for an update, a tournament or a giveaway.', cdBox));
    host.appendChild(card('Poll', 'Ask everyone a question. One vote each, they can change it until it closes.', poBox));
    refresh();
  };

  // ---------- Boosts and events ----------
  P.events = function (host) {
    var box = h('div'), mult = sel([['1.5', 'x1.5'], ['2', 'x2'], ['3', 'x3'], ['5', 'x5']], 2), mn = sel([['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour'], ['180', '3 hours'], ['720', '12 hours'], ['1440', '1 day']], 60), lab = inp('Name, for example Happy hour');
    host.appendChild(card('Scroll boost', 'Multiplies the Scrolls players earn from daily rewards and from Bedwars, Racing and the minigames. Casino bets and payouts are not touched. Players see a strip at the top with the time left.', box));
    function paint(b) {
      Hub.clear(box);
      if (b) box.appendChild(h('div', { class: 'adm-row wrap', style: 'margin-bottom:14px' }, [h('div', { style: 'flex:1;min-width:200px' }, [h('b', { text: 'x' + b.mult + ' is on' + (b.label ? ' · ' + b.label : '') }), h('div', { class: 'hint', text: mins(b.until - Date.now()) + ' left' })]), btn('End it now', function () { post({ action: 'boost.set', mins: 0 }).then(function (r) { done('Boost ended')(r); load(); Hub.loadSchool(); }); }, { danger: true })]));
      box.appendChild(h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:120px' }, field('Multiplier', mult)), h('div', { style: 'flex:1;min-width:160px' }, field('For', mn)), h('div', { style: 'flex:2;min-width:200px' }, field('Name (optional)', lab))]));
      box.appendChild(h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn(b ? 'Replace the boost' : 'Start the boost', function (bt) { K.busy(bt, post({ action: 'boost.set', mult: +mult.value, mins: +mn.value, label: lab.value })).then(function (r) { done('Boost started')(r); load(); Hub.loadSchool(); }); }, { primary: true })]));
    }
    function load() { post({ action: 'boost.get' }).then(function (r) { paint(r && r.boost); }); }
    load();
  };

  // ---------- Raffle and rain ----------
  P.fun = function (host) {
    var online = h('p', { class: 'hint', text: 'Checking who is online...' }), amt = inp('Scrolls each', { type: 'number', inputmode: 'numeric' }), cnt = inp('Winners', { type: 'number', inputmode: 'numeric' }), ramt = inp('Scrolls each', { type: 'number', inputmode: 'numeric' }), res = h('div');
    amt.value = '50000'; cnt.value = '1'; ramt.value = '10000';
    function count() { post({ action: 'fun.online' }).then(function (r) { online.textContent = r && r.ok ? r.players.length + ' player' + (r.players.length === 1 ? '' : 's') + ' online with a casino profile right now.' : 'Could not check who is online.'; }); }
    function show(r) { Hub.clear(res); if (r && r.ok) res.appendChild(h('div', { class: 'adm-card', style: 'margin-top:12px' }, [h('b', { text: r.message })])); }
    host.appendChild(card('Raffle', 'Picks random players who are online right now and pays each winner. The winners are announced to everyone as a pop-up.', [online, h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:160px' }, field('Prize each', amt)), h('div', { style: 'flex:1;min-width:120px' }, field('Winners (1 to 10)', cnt))]), h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Draw winners', function (b) { confirmBox('Draw the raffle?', 'Winners are paid straight away and announced to everyone.', 'Draw').then(function (ok) { if (ok) K.busy(b, post({ action: 'fun.raffle', amount: +amt.value, count: +cnt.value })).then(function (r) { r && r.ok ? Hub.toast('Winners paid') : toastErr(r); show(r); count(); }); }); }, { primary: true }), btn('Recount online', count)])]));
    host.appendChild(card('Scroll rain', 'Gives every player who is online right now the same amount of Scrolls and announces it.', [h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:160px' }, field('Scrolls each', ramt))]), h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Make it rain', function (b) { confirmBox('Start the rain?', 'Everyone online gets ' + (+ramt.value || 0).toLocaleString() + ' Scrolls now.', 'Make it rain').then(function (ok) { if (ok) K.busy(b, post({ action: 'fun.rain', amount: +ramt.value })).then(function (r) { r && r.ok ? Hub.toast('It is raining Scrolls') : toastErr(r); show(r); }); }); }, { primary: true })]), res]));
    host.appendChild(card('Party', 'Sets off confetti cannons on every screen that is open on the hub. Good for a milestone or just because. Players can also find a secret code.', h('div', { class: 'adm-row' }, [btn('Throw a party', function (b) { K.busy(b, post({ action: 'fun.party' })).then(function (r) { r && r.ok ? Hub.toast(r.message) : toastErr(r); Hub.party && Hub.party(); }); }, { primary: true })])));
    count();
  };

  // ---------- Game switches ----------
  P.games = function (host) {
    var box = h('div');
    host.appendChild(card('Game switches', 'Turn a game off for everyone except staff, for example while you fix a bug. Players already inside a match finish it. New matches or casino play are refused with a friendly message.', box));
    box.appendChild(loading());
    post({ action: 'games.get' }).then(function (r) {
      Hub.clear(box); if (!r || !r.ok) { box.appendChild(empty('Could not load the list.')); return; }
      r.games.forEach(function (g) { box.appendChild(Hub.toggle(g.name, g.key === 'casino' ? 'Stops the casino world and every casino bet.' : 'Stops new matches from starting.', !g.off, function (on) { post({ action: 'games.set', key: g.key, off: !on }).then(function (x) { x && x.ok ? Hub.toast(g.name + (on ? ' is open' : ' is off')) : toastErr(x); Hub.loadSchool(); }); })); });
    });
  };

  // ---------- Branding ----------
  P.brand = function (host) {
    var name = inp('Site name'), tag = inp('Tagline');
    Hub.loadSchool().then(function () { var b = Hub.school.brand || {}; name.value = b.name || ''; tag.value = b.tagline || ''; });
    host.appendChild(card('Branding', 'The site name shows in the browser tab title. Leave it empty to use the default. The logo stays as it is.', [field('Site name', name), field('Tagline', tag), h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Save', function (b) { K.busy(b, post({ action: 'brand.set', name: name.value, tagline: tag.value })).then(function (r) { done('Saved')(r); Hub.loadSchool(); }); }, { primary: true }), btn('Back to default', function () { name.value = ''; tag.value = ''; post({ action: 'brand.set', name: '', tagline: '' }).then(function (r) { done('Back to default')(r); Hub.loadSchool(); }); })])]));
  };

  // ---------- Backup and export ----------
  P.backup = function (host) {
    var file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    host.appendChild(card('Export', 'Downloads one file with your site settings, scheduled announcements, custom games, the audit log and traffic totals. It never includes passwords, keys, or the teacher link.', h('div', { class: 'adm-row' }, [btn('Download backup', function (b) { K.busy(b, post({ action: 'backup.export' })).then(function (r) { if (!r || !r.ok) return toastErr(r); var blob = new Blob([JSON.stringify(r.file, null, 2)], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(blob), download: 'scrollhub-backup-' + new Date().toISOString().slice(0, 10) + '.json' }); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); Hub.toast('Backup downloaded'); }); }, { primary: true, icon: 'download' })])));
    host.appendChild(card('Restore settings', 'Loads the site settings from a backup file you exported earlier: maintenance, school options, season, site look, game switches, schedule and branding. Accounts, Scrolls and items are not touched.', [file, h('div', { class: 'adm-row' }, [btn('Choose a backup file', function () { file.click(); })])]));
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return; if (f.size > 4e6) { Hub.toast('That file is too big to be a backup', { bad: true }); return; }
      var rd = new FileReader(); rd.onload = function () {
        var j; try { j = JSON.parse(rd.result); } catch (e) { Hub.toast('That is not a backup file', { bad: true }); return; }
        confirmBox('Restore these settings?', 'This replaces your current site settings with the ones in "' + f.name + '".', 'Restore').then(function (ok) { if (ok) post({ action: 'backup.import', file: j }).then(function (r) { r && r.ok ? Hub.toast('Restored ' + r.restored + ' settings') : toastErr(r); Hub.loadSchool(); }); });
      }; rd.readAsText(f); file.value = '';
    });
  };

  // ---------- Submissions: things players made in the Sprite Studio and the map builder ----------
  P.subs = function (host) {
    var CH = '0123456789abcdefghijklmnopqrstuv', RAR = [['common', 'Common'], ['uncommon', 'Uncommon'], ['rare', 'Rare'], ['epic', 'Epic'], ['legendary', 'Legendary'], ['mythic', 'Mythic']];
    var KIND = { sprite: 'Sprite Studio', map: 'Map builder' }, TYPE = { skin: 'Gim', hat: 'Hat', acc: 'Accessory', banner: 'Banner', tag: 'Name tag' };
    var pend = h('div'), hist = h('div'), bulk = h('div', { class: 'adm-row wrap', style: 'margin-bottom:10px' }), blockBox = h('div'), trustBox = h('div'), cur = { pending: [], blocked: [], trusted: [] };
    host.appendChild(card('Waiting for you', 'Everything players send from the Sprite Studio and the map builder lands here first. Nothing reaches the shop or the game until you approve it. Approved gims, hats and tags go straight onto the maker\u2019s profile.', [bulk, pend]));
    host.appendChild(card('Trusted makers', 'What these players send goes live right away, with no waiting. You still see it under Recent decisions and can remove it any time. Blocking a player removes their trust.', trustBox));
    host.appendChild(card('Blocked players', 'These players can still play but can no longer send creations.', blockBox));
    host.appendChild(card('Recent decisions', 'The last 40 things you approved or rejected.', hist));
    function pic(o) {
      var sp = o.sprite; if (!sp) return h('div', { class: 'sub-pic sub-gm', text: o.map ? ({ bw: 'Bedwars', ctf: 'CTF', spleef: 'Spleef', hide: 'Prop Hunt' }[o.map.game] || 'Map') : '' });
      if (sp.type === 'banner') { var bd = h('div', { class: 'sub-pic wide' }); bd.style.background = String(sp.value || ''); return bd; }
      if (sp.type === 'tag') return h('div', { class: 'sub-pic wide sub-tag', text: Hub.clean(sp.label) });
      var d = sp.sprite; if (!d || !d.px) return h('div', { class: 'sub-pic' });
      var c = h('canvas', { width: '32', height: '32', class: 'sub-pic', 'aria-label': 'Preview of ' + Hub.clean(o.title) }), x = c.getContext('2d'), frames = [d.px].concat(d.frames || []), fi = 0;
      function draw() { x.clearRect(0, 0, 32, 32); var px = frames[fi % frames.length]; for (var i = 0; i < 1024; i++) { var k = CH.indexOf(px[i]); if (k > 0 && d.pal[k - 1]) { x.fillStyle = d.pal[k - 1]; x.fillRect(i % 32, (i / 32) | 0, 1, 1); } } fi++; }
      draw(); if (frames.length > 1) { var t = setInterval(function () { if (!c.isConnected) { clearInterval(t); return; } draw(); }, Math.max(66, 1000 / (d.fps || 6))); }
      return c;
    }
    function ask(o, approve) {
      return new Promise(function (resolve) {
        var done = false, m, note = h('textarea', { class: 'input', rows: '2', maxlength: '200', placeholder: approve ? 'Optional note the player sees' : 'Why not? The player sees this' });
        var price = null, rar = null, rotOn = false, kids = [];
        if (approve && o.sprite) { price = inp('', { type: 'number', min: '0', max: '1000000' }); price.value = String(o.sprite.price || 0); rar = sel(RAR, o.sprite.rarity || 'rare'); kids.push(h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:140px' }, field('Shop price (Scrolls)', price)), h('div', { style: 'flex:1;min-width:140px' }, field('Rarity', rar))])); }
        if (approve && o.map) { rotOn = !o.map.problems.length; kids.push(Hub.toggle('Add it to the match rotation', '', rotOn, function (v) { rotOn = v; })); if (o.map.problems.length) kids.push(h('p', { class: 'hint', text: 'It has problems so it will be saved but not put in rotation.' })); }
        function fin(v) { if (done) return; done = true; m.close(); resolve(v); }
        var body = h('div', { class: 'mbody' }, [h('h3', { text: (approve ? 'Approve ' : 'Reject ') + Hub.clean(o.title) + '?' }), h('p', { class: 'hint', text: 'From ' + Hub.clean(o.by) + '.' }), kids, field('Note', note), h('div', { class: 'adm-row', style: 'margin-top:16px' }, [btn(approve ? 'Approve' : 'Reject', function () { fin({ note: note.value, price: price ? +price.value || 0 : undefined, rarity: rar ? rar.value : undefined, rotation: o.map ? rotOn : undefined }); }, { primary: approve, danger: !approve }), btn('Cancel', function () { fin(null); }, { ghost: true })])]);
        m = Hub.modal(body, { small: true, label: 'Decide', onClose: function () { if (!done) { done = true; resolve(null); } } });
      });
    }
    function bulkAsk(mode, user) {
      return new Promise(function (resolve) {
        var done = false, m, note = h('textarea', { class: 'input', rows: '2', maxlength: '200', placeholder: 'Optional note the players see' }), price = inp('', { type: 'number', min: '0', max: '1000000' }), rar = sel(RAR, 'rare'), kids = [];
        price.value = '100';
        if (mode === 'approve') { kids.push(h('p', { class: 'hint', text: 'Maps with problems are skipped. Every other map joins the rotation. Gims, hats, banners and tags go into the shop at this price and rarity.' })); kids.push(h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:140px' }, field('Shop price (Scrolls)', price)), h('div', { style: 'flex:1;min-width:140px' }, field('Rarity', rar))])); }
        function fin(v) { if (done) return; done = true; m.close(); resolve(v); }
        var n = cur.pending.filter(function (x) { return !user || String(x.by).toLowerCase() === user.toLowerCase(); }).length;
        var body = h('div', { class: 'mbody' }, [h('h3', { text: (mode === 'approve' ? 'Approve ' : 'Reject ') + n + (user ? ' from ' + Hub.clean(user) : ' waiting') + '?' }), kids, field('Note', note), h('div', { class: 'adm-row', style: 'margin-top:16px' }, [btn(mode === 'approve' ? 'Approve all' : 'Reject all', function () { fin({ note: note.value, price: +price.value || 0, rarity: rar.value }); }, { primary: mode === 'approve', danger: mode !== 'approve' }), btn('Cancel', function () { fin(null); }, { ghost: true })])]);
        m = Hub.modal(body, { small: true, label: 'Bulk decision', onClose: function () { if (!done) { done = true; resolve(null); } } });
      });
    }
    function runBulk(mode, user, b) { bulkAsk(mode, user).then(function (v) { if (v) K.busy(b, post({ action: 'subs.bulk', mode: mode, user: user || '', note: v.note, price: v.price, rarity: v.rarity })).then(function (r) { if (r && r.ok) Hub.toast((mode === 'approve' ? 'Approved ' : 'Rejected ') + r.done + (r.skipped ? ', skipped ' + r.skipped + ' with problems' : '')); else toastErr(r); load(); }); }); }
    function paintBulk() {
      Hub.clear(bulk); if (!cur.pending.length) return;
      var names = []; cur.pending.forEach(function (x) { if (names.indexOf(x.by) < 0) names.push(x.by); });
      var who = h('select', { class: 'input', 'aria-label': 'Player' }); who.appendChild(h('option', { value: '', text: 'Everyone (' + cur.pending.length + ')' })); names.forEach(function (n) { who.appendChild(h('option', { value: n, text: Hub.clean(n) + ' (' + cur.pending.filter(function (x) { return x.by === n; }).length + ')' })); });
      who.value = names.indexOf(cur.who) >= 0 ? cur.who : ''; who.addEventListener('change', function () { cur.who = who.value; });
      bulk.appendChild(who); bulk.appendChild(btn('Approve all', function (b) { runBulk('approve', who.value, b); }, { primary: true })); bulk.appendChild(btn('Reject all', function (b) { runBulk('reject', who.value, b); }, { danger: true }));
    }
    function paintTrusted() {
      Hub.clear(trustBox); if (!cur.trusted.length) { trustBox.appendChild(empty('Nobody is trusted yet. Use Trust maker on a waiting creation.')); return; }
      cur.trusted.forEach(function (u) { trustBox.appendChild(h('div', { class: 'adm-row', style: 'padding:6px 0' }, [h('b', { style: 'flex:1', text: Hub.clean(u) }), btn('Remove trust', function (b) { K.busy(b, post({ action: 'subs.untrust', user: u })).then(function (r) { r && r.ok ? Hub.toast('Trust removed') : toastErr(r); load(); }); })])); });
    }
    function paintBlocked() {
      Hub.clear(blockBox); if (!cur.blocked.length) { blockBox.appendChild(empty('Nobody is blocked.')); return; }
      cur.blocked.forEach(function (u) { blockBox.appendChild(h('div', { class: 'adm-row', style: 'padding:6px 0' }, [h('b', { style: 'flex:1', text: Hub.clean(u) }), btn('Unblock', function (b) { K.busy(b, post({ action: 'subs.unblock', user: u })).then(function (r) { r && r.ok ? Hub.toast('Unblocked') : toastErr(r); load(); }); })])); });
    }
    function row(o, isDone) {
      var meta = (KIND[o.kind] || o.kind) + (o.sprite ? ' · ' + (TYPE[o.sprite.type] || o.sprite.type) : '') + (o.map ? ' · ' + o.map.game : '') + ' · by ' + Hub.clean(o.by) + ' · ' + when(o.at);
      var lines = [h('b', { text: Hub.clean(o.title) }), h('div', { class: 'hint', text: meta })];
      if (o.map) {
        lines.push(h('div', { class: 'hint', text: (o.map.walls || 0) + ' blocks · ' + (o.map.props || 0) + ' props' + (o.map.desc ? ' · ' + Hub.clean(o.map.desc) : '') }));
        (o.map.problems || []).forEach(function (pr) { lines.push(h('div', { class: 'hint sub-bad', text: 'Problem: ' + Hub.clean(pr) })); });
        if (!(o.map.problems || []).length) lines.push(h('div', { class: 'hint', text: 'No problems found.' }));
      }
      if (isDone) lines.push(h('div', { class: 'hint', text: (o.status === 'approved' ? (o.auto ? 'Auto-approved (trusted maker)' : 'Approved') : 'Rejected') + (o.decidedAt ? ' ' + when(o.decidedAt) : '') + (o.note ? ' · ' + Hub.clean(o.note) : '') }));
      var acts = isDone ? null : h('div', { class: 'adm-row' }, [
        btn('Approve', function (b) { ask(o, true).then(function (v) { if (v) K.busy(b, post({ action: 'subs.approve', id: o.id, note: v.note, price: v.price, rarity: v.rarity, rotation: v.rotation })).then(function (r) { if (r && r.ok) { Hub.toast('Approved'); if (r.problems && r.problems.length) Hub.toast('Saved, but it has problems so it is not in rotation'); } else toastErr(r); load(); }); }); }, { primary: true }),
        o.map ? btn('Open in builder', function () { window.open('/arcade/bedwars/builder.html?open=' + encodeURIComponent(o.id), '_blank', 'noopener'); }, { icon: 'search' }) : null,
        btn('Reject', function (b) { ask(o, false).then(function (v) { if (v) K.busy(b, post({ action: 'subs.reject', id: o.id, note: v.note })).then(function (r) { r && r.ok ? Hub.toast('Rejected') : toastErr(r); load(); }); }); }, { danger: true }),
        o.blocked || o.trusted ? null : btn('Trust maker', function (b) { confirmBox('Trust ' + Hub.clean(o.by) + '?', 'Everything they send from now on goes live right away without waiting for you. This one is approved too. You can remove trust any time.', 'Trust maker').then(function (ok) { if (!ok) return; K.busy(b, post({ action: 'subs.trust', user: o.by })).then(function (r) { if (!(r && r.ok)) { toastErr(r); return load(); } ask(o, true).then(function (v) { if (!v) return load(); post({ action: 'subs.approve', id: o.id, note: v.note, price: v.price, rarity: v.rarity, rotation: v.rotation }).then(function () { Hub.toast('Trusted and approved'); load(); }); }); }); }); }, { icon: 'shield' }),
        btn(o.blocked ? 'Blocked' : 'Block player', function (b) { if (o.blocked) return; confirmBox('Block ' + Hub.clean(o.by) + '?', 'They can no longer send creations and everything they have waiting is rejected. You can unblock them below.', 'Block player').then(function (ok) { if (ok) K.busy(b, post({ action: 'subs.block', user: o.by })).then(function (r) { r && r.ok ? Hub.toast('Blocked' + (r.rejected ? ', rejected ' + r.rejected : '')) : toastErr(r); load(); }); }); }, { ghost: true })]);
      return h('div', { class: 'adm-row wrap sub-row' }, [isDone ? null : pic(o), h('div', { style: 'flex:1;min-width:200px' }, lines), acts]);
    }
    function load() {
      post({ action: 'subs.list' }).then(function (r) {
        if (!alive(host)) return; Hub.clear(pend); Hub.clear(hist);
        if (!r || !r.ok) { pend.appendChild(empty('Could not load submissions.')); return; }
        if (Hub.school.subs) { Hub.school.subs.n = r.pending.length; Hub.emit('live'); }
        cur.pending = r.pending; cur.blocked = r.blocked || []; cur.trusted = r.trusted || []; paintBulk(); paintBlocked(); paintTrusted();
        if (!r.pending.length) pend.appendChild(empty('Nothing waiting. You will get a bell notification and a pop-up when someone sends something.'));
        r.pending.forEach(function (o) { pend.appendChild(row(o, false)); });
        if (!r.done.length) hist.appendChild(empty('No decisions yet.'));
        r.done.forEach(function (o) { hist.appendChild(row(o, true)); });
      });
    }
    load(); var t = setInterval(function () { if (!alive(host)) { clearInterval(t); return; } if (!document.hidden) load(); }, 10000);
  };

  P.feedback = function (host) {
    var body = h('div');
    host.appendChild(body);
    function paint(r) {
      Hub.clear(body);
      if (!r || !r.ok) { body.appendChild(empty('Could not load the questionnaire.')); return; }
      var rew = inp('', { type: 'number', min: '0', max: '50000000' }); rew.value = String(r.reward);
      body.appendChild(card('Questionnaire', 'A short set of questions pops up now and then for signed-in players. Answering pays a one-time reward, once per round.', [
        Hub.toggle('Ask players', r.on ? 'On: it pops up for players who have not answered.' : 'Off: nothing pops up.', r.on, function (v) { post({ action: 'fb.set', on: v }).then(function (x) { x && x.ok ? Hub.toast(v ? 'Questionnaire on' : 'Questionnaire off') : toastErr(x); }); }),
        h('div', { class: 'adm-row wrap', style: 'margin-top:12px' }, [h('div', { style: 'flex:1;min-width:180px' }, field('Reward per answer (Scrolls)', rew)), btn('Save reward', function (b) { K.busy(b, post({ action: 'fb.set', reward: +rew.value || 0 })).then(function (x) { if (x && x.ok) { Hub.toast('Reward saved'); paint(x); } else toastErr(x); }); })]),
        h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Start a new round', function (b) { confirmBox('Start round ' + (r.round + 1) + '?', 'Everyone can answer again and get the reward again. Old answers are kept but this page shows only the new round.', 'Start new round').then(function (ok) { if (ok) K.busy(b, post({ action: 'fb.set', newRound: true })).then(function (x) { x && x.ok ? (Hub.toast('New round started'), paint(x)) : toastErr(x); }); }); })]),
      ]));
      body.appendChild(card('Round ' + r.round + ' results', r.count + ' answered' + (r.count ? ', average rating ' + r.avg + ' out of 5' : '') + '.', r.count ? r.questions.map(function (q) {
        var t = r.tally[q.id] || {}, max = Math.max(1, Math.max.apply(null, Object.keys(t).map(function (k) { return t[k]; })));
        return h('div', { style: 'margin:10px 0' }, [h('b', { text: q.q }), Object.keys(t).map(function (k) {
          return h('div', { class: 'adm-row', style: 'gap:8px;margin-top:4px' }, [h('span', { class: 'hint', style: 'width:210px;flex:none', text: Hub.clean(k) }), h('div', { style: 'flex:1;height:8px;border-radius:4px;background:var(--line,rgba(255,255,255,.1))' }, h('div', { style: 'height:100%;border-radius:4px;background:var(--accent,#7aa2ff);width:' + Math.round(t[k] / max * 100) + '%' })), h('span', { class: 'hint', style: 'width:28px;text-align:right', text: String(t[k]) })]);
        })]);
      }) : empty('No answers in this round yet.')));
      body.appendChild(card('What players wrote', 'The newest 60 notes from this round.', r.notes.length ? r.notes.map(function (n) {
        return h('div', { style: 'padding:8px 0;border-top:1px solid var(--line,rgba(255,255,255,.08))' }, [h('div', { class: 'hint', text: Hub.clean(n.by) + ' · ' + when(n.at) }), n.bug ? h('div', { text: 'Broken or annoying: ' + Hub.clean(n.bug) }) : null, n.idea ? h('div', { text: 'Idea: ' + Hub.clean(n.idea) }) : null]);
      }) : empty('Nothing written yet.')));
    }
    post({ action: 'fb.get' }).then(function (r) { if (alive(host)) paint(r); });
  };

  P.gamechat = function (host) {
    var body = h('div'); host.appendChild(body);
    function paint(r) {
      Hub.clear(body);
      if (!r || !r.ok) { body.appendChild(empty('Could not load game chat.')); return; }
      function sw(label, hint, key) { return Hub.toggle(label, hint, r[key], function (v) { post({ action: 'gamechat.set', [key]: v }).then(function (x) { if (x && x.ok) { r[key] = v; Hub.toast(label + (v ? ' on' : ' off')); } else toastErr(x); }); }); }
      body.appendChild(card('Typed chat', 'Players can type short messages in the casino and in Games. Links, phone numbers, bad words and your word filter are blocked before anyone sees them, and your mutes and timeouts apply. Turn a place off here any time.', [sw('Casino chat', 'The text bar on the casino floor.', 'casino'), sw('Games chat', 'The text bar in the Games hub, lobbies and matches.', 'games')]));
      body.appendChild(card('Recent messages', 'The newest 200 lines that were allowed through, newest first. Use Players to mute or time someone out.', r.recent.length ? r.recent.map(function (m) {
        return h('div', { style: 'padding:6px 0;border-top:1px solid var(--line,rgba(255,255,255,.08))' }, [h('span', { class: 'hint', text: when(m.at) + ' · ' + (m.scope === 'casino' ? 'Casino' : 'Games') + ' · ' }), h('b', { text: Hub.clean(m.nick) }), h('span', { text: ' ' + Hub.clean(m.text) })]);
      }) : empty('Nothing has been said yet.')));
      body.appendChild(h('div', null, btn('Refresh', function () { post({ action: 'gamechat.get' }).then(paint); })));
    }
    post({ action: 'gamechat.get' }).then(function (r) { if (alive(host)) paint(r); });
  };
})();
