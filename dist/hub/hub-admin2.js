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
})();
