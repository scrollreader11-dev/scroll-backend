/* ScrollHub Hub: Discord. Servers, text channels, direct messages, image sharing and voice channels. */
(function () {
  'use strict';
  var Hub = window.Hub, h = Hub.h, icon = Hub.icon, $ = Hub.$, $$ = Hub.$$;
  var S = { boot: false, me: null, guilds: [], dms: [], gid: null, cid: null, view: 'guild', msgs: {}, rev: {}, members: {}, unread: {}, typing: {}, ws: null, wsOpen: false, peer: '', pane: 'list', pending: [], loadingBoot: null, voice: null };
  var dom = {};

  function api(path, body) { return Hub.api(path, body === undefined ? undefined : { body: body }); }
  function guild() { for (var i = 0; i < S.guilds.length; i++) if (S.guilds[i].id === S.gid) return S.guilds[i]; return null; }
  function isMgr(g) { return !!g && S.me && (g.ownerId === S.me.id || (g.builtin && !!S.me.role)); }
  function chan(g, id) { if (!g) return null; for (var i = 0; i < g.channels.length; i++) if (g.channels[i].id === id) return g.channels[i]; return null; }
  function curDm() { for (var i = 0; i < S.dms.length; i++) if (S.dms[i].id === S.cid) return S.dms[i]; return null; }
  function hue(s) { return Hub.hash(s) % 360; }
  function tint(s) { var x = hue(s); return 'linear-gradient(150deg,hsl(' + x + ' 70% 52%),hsl(' + ((x + 40) % 360) + ' 70% 34%))'; }
  function timeStr(ts) { var d = new Date(ts), hr = d.getHours(), m = d.getMinutes(); return (hr % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (hr < 12 ? 'AM' : 'PM'); }
  function dayLabel(ts) { var d = new Date(ts), n = new Date(), y = new Date(Date.now() - 864e5); if (d.toDateString() === n.toDateString()) return 'Today'; if (d.toDateString() === y.toDateString()) return 'Yesterday'; return Hub.dateLong(ts); }
  function sameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }
  function totalUnread() { var n = 0, k; for (k in S.unread) n += S.unread[k]; return n; }
  function setUnread(cid, n) { if (n) S.unread[cid] = n; else delete S.unread[cid]; Hub.dcUnread = totalUnread(); Hub.emit('dcunread'); }

  // ---------- data ----------
  function boot() {
    if (S.loadingBoot) return S.loadingBoot;
    S.loadingBoot = api('/api/dc/boot').then(function (r) {
      S.loadingBoot = null;
      if (!r || r.error) { S.boot = 'error'; return; }
      S.me = r.me; S.guilds = r.guilds || []; S.dms = r.dms || []; S.boot = true;
      if (!S.gid && S.view === 'guild') { var g = S.guilds[0]; if (g) { S.gid = g.id; var t = firstText(g); S.cid = t && t.id; } }
      connect();
    }, function () { S.loadingBoot = null; S.boot = 'error'; });
    return S.loadingBoot;
  }
  function firstText(g) { for (var i = 0; i < g.channels.length; i++) if (g.channels[i].type === 'text') return g.channels[i]; return null; }
  function loadMsgs(cid, force) {
    if (!cid) return Promise.resolve();
    var after = force ? 0 : (S.rev[cid] || 0);
    return api('/api/dc/messages?channel=' + encodeURIComponent(cid) + (after ? '&after=' + after : '')).then(function (r) {
      if (!r || r.error || r.unchanged) return;
      S.msgs[cid] = r.messages || []; S.rev[cid] = r.rev || 0;
      if (cid === S.cid) paintMsgs(true);
    });
  }
  function loadMembers(gid) {
    return api('/api/dc/guild/' + gid + '/members').then(function (r) { if (r && r.members) { S.members[gid] = r.members; if (gid === S.gid) paintMembers(); } });
  }

  // ---------- websocket ----------
  var wsTimer = null, wsTry = 0, pollTimer = null;
  function connect() {
    if (S.ws || !Hub.token()) return;
    var ws;
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/dc-ws?t=' + encodeURIComponent(Hub.token())); } catch (e) { return; }
    S.ws = ws;
    ws.onopen = function () { S.wsOpen = true; wsTry = 0; subAll(); };
    ws.onmessage = function (ev) { var d; try { d = JSON.parse(ev.data); } catch (e) { return; } onWs(d); };
    ws.onclose = function () { S.ws = null; S.wsOpen = false; clearTimeout(wsTimer); if (Hub.me.kind === 'user') wsTimer = setTimeout(connect, Math.min(15000, 1200 * Math.pow(1.6, wsTry++))); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
    if (!window.__dcPing) window.__dcPing = setInterval(function () { if (S.wsOpen) try { S.ws.send('{"t":"ping"}'); } catch (e) {} }, 25000);
  }
  function wsSend(o) { if (S.wsOpen) { try { S.ws.send(JSON.stringify(o)); return true; } catch (e) {} } return false; }
  function subAll() {
    S.guilds.forEach(function (g) { g.channels.forEach(function (c) { if (c.type === 'text') wsSend({ t: 'sub', channel: c.id }); }); });
    S.dms.forEach(function (d) { wsSend({ t: 'sub', channel: d.id }); });
  }
  function onWs(d) {
    if (d.t === 'hello') { S.peer = d.peer; return; }
    if (d.t === 'notify') { onNotify(d); return; }
    if (d.t === 'msg') {
      var arr = S.msgs[d.channel] || (S.msgs[d.channel] = []);
      if (arr.some(function (x) { return x.id === d.message.id; })) return;
      arr.push(d.message); S.rev[d.channel] = (S.rev[d.channel] || 0) + 1;
      if (d.channel === S.cid && Hub.parse().name === 'discord') { paintMsgs(false); if (d.message.uid !== S.me.id) markSeen(); }
      else if (d.message.uid !== (S.me && S.me.id)) setUnread(d.channel, (S.unread[d.channel] || 0) + 1);
      if (Hub.parse().name === 'discord') { paintRail(); paintChannels(); }
      return;
    }
    if (d.t === 'del') { var a2 = S.msgs[d.channel]; if (a2) { S.msgs[d.channel] = a2.filter(function (x) { return x.id !== d.id; }); if (d.channel === S.cid) paintMsgs(false); } return; }
    if (d.t === 'edit') { var a3 = S.msgs[d.channel]; if (a3) { for (var i = 0; i < a3.length; i++) if (a3[i].id === d.message.id) a3[i] = d.message; if (d.channel === S.cid) paintMsgs(false); } return; }
    if (d.t === 'typing') { if (d.channel === S.cid) { S.typing[d.uid] = { name: d.name, until: Date.now() + 4000 }; paintTyping(); setTimeout(paintTyping, 4200); } return; }
    if (d.t.indexOf('call-') === 0) { callWs(d); return; }
    if (d.t.indexOf('voice') === 0 || d.t === 'signal') { voiceWs(d); return; }
  }
  // ---------- pop-up notifications (never while the Discord page itself is open) ----------
  var pops = {}, popBox = null;
  function chanInfo(cid) { for (var i = 0; i < S.guilds.length; i++) { var g = S.guilds[i], c = g.channels.filter(function (x) { return x.id === cid; })[0]; if (c) return { g: g, c: c }; } return null; }
  function refreshDms() { api('/api/dc/boot').then(function (r) { if (r && r.dms) { S.dms = r.dms; subAll(); if (Hub.parse().name === 'discord') paintAll(); } }); }
  function onNotify(d) {
    var known = d.dm ? S.dms.some(function (x) { return x.id === d.channel; }) : !!chanInfo(d.channel);
    if (d.dm && !known) { setUnread(d.channel, (S.unread[d.channel] || 0) + 1); refreshDms(); }
    if (Hub.parse().name === 'discord') return;            // already in Discord: stay quiet
    if (Hub.prefs.nDiscord === false) return;
    var me = (Hub.me && Hub.me.name || '').toLowerCase(), mention = !!me && String(d.text || '').toLowerCase().indexOf('@' + me) >= 0;
    var ci = d.dm ? null : chanInfo(d.channel);
    if (!d.dm && !mention && (!ci || ci.g.builtin)) return; // the big public server only pings you when you are mentioned
    showPop({ cid: d.channel, from: d.from, avatar: d.avatar, where: d.dm ? 'Direct message' : d.where, text: d.text, mention: mention, dm: !!d.dm });
    try { if (document.hidden && window.Notification && Notification.permission === 'granted') { var n = new Notification(d.from + (d.dm ? '' : ' in ' + d.where), { body: String(d.text || '').slice(0, 140), tag: 'dc-' + d.channel }); n.onclick = function () { window.focus(); openChannel(d.channel); n.close(); }; } } catch (e) {}
  }
  function openChannel(cid) {
    // Mid-game: open Discord in a new tab so the game keeps running.
    if (Hub.playing) { window.open(location.origin + '/#/discord/open/' + encodeURIComponent(cid), '_blank', 'noopener'); markSeen(); setUnread(cid, 0); return; }
    var ci = chanInfo(cid);
    if (ci) { S.view = 'guild'; S.gid = ci.g.id; S.cid = cid; } else { S.view = 'dm'; S.gid = null; S.cid = cid; }
    setPane('chat'); markSeen(); if (Hub.parse().name !== 'discord') location.hash = '#/discord'; else { paintAll(); loadMsgs(cid, true); }
  }
  function showPop(n) {
    if (!popBox) { popBox = h('div', { id: 'dcpop', 'aria-live': 'polite' }); document.body.appendChild(popBox); }
    var old = pops[n.cid];
    if (old && old.el.isConnected) { old.count++; old.text.textContent = n.text; old.sub.textContent = old.where + '  ·  ' + old.count + ' new'; clearTimeout(old.t); old.t = setTimeout(old.close, 6500); return; }
    while (popBox.children.length >= 3) popBox.removeChild(popBox.firstChild);
    var text = h('div', { class: 'pt', text: n.text || '' }), sub = h('div', { class: 'ps', text: n.where }), close = function () { el.classList.add('out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); if (pops[n.cid] && pops[n.cid].el === el) delete pops[n.cid]; }, 240); };
    var el = h('div', { class: 'dcp' + (n.mention ? ' men' : ''), role: 'button', tabindex: '0' }, [avatar({ username: n.from, avatar: n.avatar }, 40), h('div', { class: 'pb' }, [h('div', { class: 'pn' }, [h('b', { text: n.from }), n.mention ? h('i', { text: 'mentioned you' }) : null]), sub, text]), h('button', { type: 'button', class: 'px', 'aria-label': 'Dismiss', onclick: function (e) { e.stopPropagation(); close(); } }, icon('x'))]);
    var rec = { el: el, text: text, sub: sub, where: n.where, count: 1, close: close, t: setTimeout(close, 6500) };
    pops[n.cid] = rec;
    el.addEventListener('mouseenter', function () { clearTimeout(rec.t); }); el.addEventListener('mouseleave', function () { rec.t = setTimeout(close, 3000); });
    el.addEventListener('click', function () { clearTimeout(rec.t); close(); openChannel(n.cid); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') el.click(); });
    popBox.appendChild(el);
  }
  function startPoll() {
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (Hub.parse().name !== 'discord' || document.hidden) return; if (!S.wsOpen && S.cid) loadMsgs(S.cid); }, 3500);
  }
  function markSeen() { if (S.cid && S.unread[S.cid]) setUnread(S.cid, 0); }

  // ---------- view ----------
  Hub.on && Hub.on('avatar', function () { boot().then(function () { if (S.gid) loadMembers(S.gid); if (Hub.parse().name === 'discord') paintAll(); }); });
  function dcMode() { var on = Hub.parse().name === 'discord', sc = $('#scroll'); if (sc) sc.classList.toggle('dcmode', on); document.body.classList.toggle('in-dc', on); }
  window.addEventListener('hashchange', function () { setTimeout(dcMode, 0); });
  Hub.views.discord = function (a) {
    setTimeout(dcMode, 0);
    var root = h('div', { class: 'dc' + (S.pane === 'chat' ? ' m-chat' : '') });
    dom = { root: root };
    if (Hub.me.kind !== 'user') { root.appendChild(Hub.emptyState('message-square', 'Sign in to use Discord', 'Create a ScrollHub account to chat, make servers and talk in voice.', h('button', { class: 'btn primary', type: 'button', text: 'Sign in', onclick: function () { Hub.signOutToLogin ? Hub.signOutToLogin() : location.reload(); } }))); return root; }
    if (a[0] === 'join' && a[1]) { root.appendChild(h('div', { class: 'dc-boot' }, [h('div', { class: 'adm-loading' }, [h('i'), h('i'), h('i')]), h('p', { text: 'Joining server' })])); boot().then(function () { return api('/api/dc/join', { code: a[1] }); }).then(function (r) { if (r && r.guild) { S.guilds = S.guilds.filter(function (g) { return g.id !== r.guild.id; }).concat([r.guild]); S.gid = r.guild.id; S.view = 'guild'; var t = firstText(r.guild); S.cid = t && t.id; S.pane = 'chat'; subAll(); Hub.toast('Joined ' + r.guild.name, { icon: 'users' }); } else Hub.toast('That invite is not valid', { bad: true }); location.replace('#/discord'); }); return root; }
    if (a[0] === 'open' && a[1]) { var want = a[1]; root.appendChild(h('div', { class: 'dc-boot' }, [h('div', { class: 'adm-loading' }, [h('i'), h('i'), h('i')]), h('p', { text: 'Opening chat' })])); boot().then(function () { var ci = chanInfo(want); if (ci) { S.view = 'guild'; S.gid = ci.g.id; } else { S.view = 'dm'; S.gid = null; } S.cid = want; S.pane = 'chat'; location.replace('#/discord'); }); return root; }
    if (S.boot !== true) {
      root.appendChild(h('div', { class: 'dc-boot' }, S.boot === 'error' ? [icon('triangle-alert'), h('p', { text: 'Discord could not load right now.' }), h('button', { class: 'btn sm primary', type: 'button', text: 'Try again', onclick: function () { S.boot = false; Hub.render(true); } })] : [h('div', { class: 'adm-loading' }, [h('i'), h('i'), h('i')]), h('p', { text: 'Loading Discord' })]));
      if (S.boot !== 'error') boot().then(function () { if (Hub.parse().name === 'discord') Hub.render(true); });
      return root;
    }
    build(root); startPoll();
    if (S.cid) { loadMsgs(S.cid, true).then(markSeen); } if (S.gid && S.view === 'guild') loadMembers(S.gid);
    return root;
  };

  function build(root) {
    dom.rail = h('nav', { class: 'dc-rail', 'aria-label': 'Servers' });
    dom.side = h('aside', { class: 'dc-side' });
    dom.chat = h('section', { class: 'dc-chat' });
    dom.mem = h('aside', { class: 'dc-mem' });
    [dom.rail, dom.side, dom.chat, dom.mem].forEach(function (e) { root.appendChild(e); });
    paintRail(); paintChannels(); paintChat(); paintMembers();
  }
  function setPane(p) { S.pane = p; if (dom.root) dom.root.classList.toggle('m-chat', p === 'chat'); }

  function paintRail() {
    if (!dom.rail) return; var r = Hub.clear(dom.rail);
    var dmUn = 0; S.dms.forEach(function (d) { dmUn += S.unread[d.id] || 0; });
    var home = h('button', { type: 'button', class: 'dr-i home' + (S.view === 'dm' ? ' on' : ''), title: 'Direct messages', 'aria-label': 'Direct messages' }, [icon('message-square'), dmUn ? h('i', { class: 'bd', text: dmUn > 9 ? '9+' : String(dmUn) }) : null]);
    home.addEventListener('click', function () { S.view = 'dm'; S.gid = null; var d = S.dms[0]; S.cid = d ? d.id : null; setPane('list'); paintAll(); if (S.cid) loadMsgs(S.cid, true); });
    r.appendChild(home); r.appendChild(h('div', { class: 'dr-sep' }));
    S.guilds.forEach(function (g) {
      var un = 0; g.channels.forEach(function (c) { un += S.unread[c.id] || 0; });
      var b = h('button', { type: 'button', class: 'dr-i' + (S.view === 'guild' && S.gid === g.id ? ' on' : ''), title: g.name, 'aria-label': g.name, style: 'background:' + tint(g.id) }, [g.iconUrl ? h('img', { src: g.iconUrl, alt: '', class: 'dr-img', onerror: function (e) { e.target.remove(); } }) : h('span', { text: Hub.initials(g.name) }), un ? h('i', { class: 'bd', text: un > 9 ? '9+' : String(un) }) : null]);
      b.addEventListener('click', function () { S.view = 'guild'; S.gid = g.id; var t = (chan(g, S.cid) && chan(g, S.cid).type === 'text') ? chan(g, S.cid) : firstText(g); S.cid = t && t.id; setPane('list'); paintAll(); if (S.cid) loadMsgs(S.cid, true).then(markSeen); loadMembers(g.id); });
      r.appendChild(b);
    });
    var add = h('button', { type: 'button', class: 'dr-i add', title: 'Create or join a server', 'aria-label': 'Create or join a server' }, icon('plus')); add.addEventListener('click', serverDialog); r.appendChild(add);
    var back = h('button', { type: 'button', class: 'dr-i exit', title: 'Back to the hub', 'aria-label': 'Back to the hub' }, icon('house')); back.addEventListener('click', function () { location.hash = '#/home'; }); r.appendChild(back);
  }
  function paintAll() { paintRail(); paintChannels(); paintChat(); paintMembers(); }

  function paintChannels() {
    if (!dom.side) return; var s = Hub.clear(dom.side);
    if (S.view === 'dm') {
      s.appendChild(h('div', { class: 'ds-head' }, [h('h2', { text: 'Direct messages' })]));
      var inp = h('input', { class: 'input', placeholder: 'Message someone by username', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') openDm(inp.value.trim()); });
      s.appendChild(h('div', { class: 'ds-find' }, [inp, h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Start conversation', onclick: function () { openDm(inp.value.trim()); } }, icon('send'))]));
      var l = h('div', { class: 'ds-list' });
      if (!S.dms.length) l.appendChild(h('p', { class: 'ds-empty', text: 'No conversations yet. Type a username above to start one.' }));
      S.dms.forEach(function (d) { var un = S.unread[d.id] || 0; var b = h('button', { type: 'button', class: 'dch dm' + (S.cid === d.id ? ' on' : ''), 'aria-current': S.cid === d.id ? 'true' : null }, [avatar(d.user, 28), h('span', { class: 'cn', text: d.user.username }), un ? h('i', { class: 'bd', text: String(un) }) : null]); b.addEventListener('click', function () { S.cid = d.id; setPane('chat'); paintChannels(); paintChat(); loadMsgs(d.id, true).then(markSeen); }); l.appendChild(b); });
      s.appendChild(l); if (S.voice) s.appendChild(voiceBar()); return;
    }
    var g = guild(); if (!g) { s.appendChild(h('p', { class: 'ds-empty', text: 'Pick a server on the left.' })); return; }
    var head = h('button', { type: 'button', class: 'ds-head srv', 'aria-haspopup': 'menu' }, [h('h2', { text: g.name }), icon('chevron-down')]); head.addEventListener('click', function () { serverMenu(head, g); }); s.appendChild(head);
    var list = h('div', { class: 'ds-list' });
    [['text', 'Text channels'], ['voice', 'Voice channels']].forEach(function (grp) {
      var chs = g.channels.filter(function (c) { return c.type === grp[0]; }); if (!chs.length && !isMgr(g)) return;
      var top = h('div', { class: 'dgh' }, [h('span', { text: grp[1] })]); if (isMgr(g)) top.appendChild(h('button', { type: 'button', class: 'dgp', 'aria-label': 'Add a ' + grp[0] + ' channel', onclick: function () { channelDialog(g, grp[0]); } }, icon('plus'))); list.appendChild(top);
      chs.forEach(function (c) {
        if (c.type === 'text') { var un = S.unread[c.id] || 0; var b = h('button', { type: 'button', class: 'dch' + (S.cid === c.id ? ' on' : '') + (un ? ' un' : ''), 'aria-current': S.cid === c.id ? 'true' : null }, [h('span', { class: 'hs', text: '#' }), h('span', { class: 'cn', text: c.name }), un ? h('i', { class: 'bd', text: un > 9 ? '9+' : String(un) }) : null]); b.addEventListener('click', function () { S.cid = c.id; setPane('chat'); paintChannels(); paintChat(); loadMsgs(c.id, true).then(markSeen); }); list.appendChild(b); }
        else { var vb = h('button', { type: 'button', class: 'dch voice' + (S.voice && S.voice.cid === c.id ? ' on' : '') }, [icon('volume-2'), h('span', { class: 'cn', text: c.name })]); vb.addEventListener('click', function () { joinVoice(g, c); }); list.appendChild(vb); var roster = (S.voice && S.voice.rooms && S.voice.rooms[c.id]) || []; if (roster.length) { var rl = h('div', { class: 'vroster' }); roster.forEach(function (p) { rl.appendChild(h('div', { class: 'vp' + (p.speaking ? ' sp' : '') }, [h('span', { class: 'avatar', style: 'background:' + tint(p.name), text: Hub.initials(p.name) }), h('span', { text: p.name })])); }); list.appendChild(rl); } }
      });
    });
    s.appendChild(list);
    if (S.voice) s.appendChild(voiceBar());
  }

  function voiceBar() {
    var v = S.voice, g = guild();
    return h('div', { class: 'dvbar' }, [h('div', { class: 'vt' }, [h('b', { text: !v.connected ? 'Connecting' : (S.call && S.call.ringing ? 'Calling' : (S.call ? 'In call' : 'Voice connected')) }), h('span', { text: v.name })]), h('button', { type: 'button', class: 'iconbtn' + (v.muted ? ' off' : ''), 'aria-label': v.muted ? 'Unmute' : 'Mute', onclick: function () { toggleMute(); } }, icon(v.muted ? 'mic-off' : 'mic')), h('button', { type: 'button', class: 'iconbtn leave', 'aria-label': 'Leave voice', onclick: function () { leaveVoice(); } }, icon('power'))]);
  }

  function paintMembers() {
    if (!dom.mem) return; var m = Hub.clear(dom.mem);
    if (S.view === 'dm') { var d = curDm(); if (d) { m.appendChild(h('div', { class: 'dm-card' }, [avatar(d.user, 84), h('h3', { text: d.user.username }), h('a', { class: 'btn sm', href: '#/profile/' + encodeURIComponent(d.user.username) }, [icon('user'), 'View profile']), callButtons(d)])); } return; }
    var g = guild(); if (!g) return; var list = S.members[g.id] || [];
    m.appendChild(h('div', { class: 'dmh', text: 'Members, ' + (list.length || g.memberCount) }));
    list.slice().sort(function (a, b) { return (b.owner ? 1 : 0) - (a.owner ? 1 : 0) || a.username.localeCompare(b.username); }).forEach(function (u) {
      var row = h('button', { type: 'button', class: 'dmem' }, [avatar(u, 32), h('span', { class: 'mn', style: u.color ? 'color:' + u.color : '', text: u.username }), u.owner || u.staff ? h('span', { class: 'adm-badge ' + (u.owner ? 'owner' : 'mod'), text: u.owner ? 'Owner' : 'Staff' }) : null]);
      row.addEventListener('click', function () { if (S.me && u.id === S.me.id) location.hash = '#/profile/' + encodeURIComponent(S.me.username); else if (S.me && u.id !== 'system') memberMenu(row, g, u); });
      m.appendChild(row);
    });
  }
  function avatar(u, size) {
    var a = h('span', { class: 'avatar', style: 'width:' + size + 'px;height:' + size + 'px;background:' + tint(u.username || u.name || '?') });
    var url = u.avatar; if (url) { var i = new Image(); i.alt = ''; i.loading = 'lazy'; i.onerror = function () { i.remove(); a.textContent = Hub.initials(u.username || u.name); }; i.src = url; a.appendChild(i); } else a.textContent = Hub.initials(u.username || u.name);
    return a;
  }

  // ---------- chat pane ----------
  function paintChat() {
    if (!dom.chat) return; var c = Hub.clear(dom.chat);
    var g = guild(), title = '', sub = '';
    if (S.view === 'dm') { var d = curDm(); title = d ? d.user.username : 'Direct messages'; }
    else { var ch = chan(g, S.cid); title = ch ? ch.name : ''; sub = ch && ch.topic || ''; }
    if (!S.cid) { c.appendChild(h('div', { class: 'dc-none' }, [icon('message-square'), h('h3', { text: S.view === 'dm' ? 'Your messages' : 'Pick a channel' }), h('p', { text: S.view === 'dm' ? 'Start a conversation with a username in the box on the left.' : 'Choose a text channel to start chatting.' })])); return; }
    var back = h('button', { type: 'button', class: 'iconbtn dc-back', 'aria-label': 'Back to channels', onclick: function () { setPane('list'); } }, icon('arrow-left'));
    c.appendChild(h('div', { class: 'dc-top' }, [back, h('span', { class: 'hs', text: S.view === 'dm' ? '@' : '#' }), h('h2', { text: title }), sub ? h('span', { class: 'tp', text: sub }) : null, h('span', { class: 'grow' }), S.view === 'dm' && curDm() ? h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Voice call', title: 'Voice call', onclick: function () { toggleCall(curDm(), false); } }, icon('phone')) : null, S.view === 'dm' && curDm() ? h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Video call', title: 'Video call', onclick: function () { toggleCall(curDm(), true); } }, icon('video')) : null, h('button', { type: 'button', class: 'iconbtn only-m2', 'aria-label': 'Members', onclick: function () { dom.root.classList.toggle('show-mem'); } }, icon('users'))]));
    dom.callpanel = h('div', { class: 'dc-callpanel', hidden: true }); c.appendChild(dom.callpanel); paintCallPanel();
    dom.scroller = h('div', { class: 'dc-msgs', role: 'log', 'aria-live': 'polite' }); c.appendChild(dom.scroller);
    dom.typing = h('div', { class: 'dc-typing', 'aria-live': 'polite' }); c.appendChild(dom.typing);
    c.appendChild(composer(title));
    c.appendChild(h('div', { class: 'dc-note', text: S.view === 'dm' ? 'Staff safety notice: the site owner can review direct messages.' : 'Staff safety notice: site staff can review messages in servers.' }));
    paintMsgs(true);
  }
  function paintTyping() { if (!dom.typing) return; var n = Date.now(), names = []; for (var k in S.typing) { if (S.typing[k].until > n) names.push(S.typing[k].name); else delete S.typing[k]; } dom.typing.textContent = names.length ? (names.length > 2 ? 'Several people are typing' : names.join(' and ') + (names.length > 1 ? ' are typing' : ' is typing')) : ''; }

  var URLRE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
  function body(text) {
    var f = document.createDocumentFragment(), last = 0, m; text = String(text || ''); URLRE.lastIndex = 0;
    while ((m = URLRE.exec(text))) { if (m.index > last) f.appendChild(document.createTextNode(text.slice(last, m.index))); f.appendChild(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer nofollow', text: m[0] })); last = m.index + m[0].length; }
    if (last < text.length) f.appendChild(document.createTextNode(text.slice(last)));
    return f;
  }
  function paintMsgs(toEnd) {
    if (!dom.scroller) return; var sc = dom.scroller, near = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140; Hub.clear(sc);
    var list = S.msgs[S.cid] || [];
    if (!list.length) { sc.appendChild(h('div', { class: 'dc-first' }, [h('div', { class: 'big', text: S.view === 'dm' ? '@' : '#' }), h('h3', { text: S.view === 'dm' ? 'This is the start of your conversation' : 'Welcome to #' + ((chan(guild(), S.cid) || {}).name || 'channel') }), h('p', { text: 'Say hello. Be the first to post.' })])); return; }
    var prev = null;
    list.forEach(function (m) {
      if (!prev || !sameDay(prev.ts, m.ts)) sc.appendChild(h('div', { class: 'dsep' }, h('span', { text: dayLabel(m.ts) })));
      var cont = prev && prev.uid === m.uid && m.ts - prev.ts < 5 * 60 * 1000 && sameDay(prev.ts, m.ts);
      var mine = S.me && m.uid === S.me.id, can = mine || isMgr(guild()) || (S.me && S.me.role === 'owner');
      var acts = h('div', { class: 'macts' }); if (mine) acts.appendChild(h('button', { type: 'button', 'aria-label': 'Edit message', onclick: function () { editMsg(m, el); } }, icon('pencil'))); if (can) acts.appendChild(h('button', { type: 'button', 'aria-label': 'Delete message', onclick: function () { api('/api/dc/delete', { channel: S.cid, id: m.id }).then(function (r) { if (r && r.ok) { S.msgs[S.cid] = (S.msgs[S.cid] || []).filter(function (x) { return x.id !== m.id; }); paintMsgs(false); } else Hub.toast('Could not delete that message', { bad: true }); }); } }, icon('trash-2')));
      var content = h('div', { class: 'mt' }, [body(m.content), m.edited ? h('span', { class: 'ed', text: ' (edited)' }) : null]);
      var atts = null; if (m.attachments && m.attachments.length) { atts = h('div', { class: 'matt' }); m.attachments.forEach(function (a) { var im = h('img', { src: a.url, alt: a.name || 'Image', loading: 'lazy', referrerpolicy: 'no-referrer' }); im.addEventListener('click', function () { window.open(a.url, '_blank', 'noopener'); }); im.addEventListener('error', function () { im.replaceWith(h('a', { href: a.url, target: '_blank', rel: 'noopener', text: a.name || 'Attachment' })); }); atts.appendChild(im); }); }
      var el;
      if (cont) el = h('div', { class: 'dm-msg cont' }, [h('span', { class: 'mtime', text: timeStr(m.ts) }), h('div', { class: 'mb' }, [content, atts]), acts]);
      else {
        var nm = h('span', { class: 'mn', style: m.color ? 'color:' + m.color : '', text: m.name }); nm.addEventListener('click', function () { location.hash = '#/profile/' + encodeURIComponent(m.name); });
        el = h('div', { class: 'dm-msg' }, [avatar(m, 40), h('div', { class: 'mb' }, [h('div', { class: 'mh' }, [nm, m.role ? h('span', { class: 'adm-badge ' + m.role, text: m.role === 'owner' ? 'Owner' : 'Mod' }) : null, m.title ? h('span', { class: 'mtag', text: Hub.clean(m.title) }) : null, h('span', { class: 'mts', text: timeStr(m.ts) })]), content, atts]), acts]);
      }
      sc.appendChild(el); prev = m;
    });
    if (toEnd || near) sc.scrollTop = sc.scrollHeight;
  }
  function editMsg(m, el) {
    var mt = $('.mt', el), t = h('textarea', { class: 'input dc-edit', rows: '2', maxlength: '2000' }); t.value = m.content;
    function done(save) { if (save && t.value.trim() && t.value.trim() !== m.content) api('/api/dc/edit', { channel: S.cid, id: m.id, content: t.value }).then(function (r) { if (r && r.ok) { m.content = r.message.content; m.edited = true; } paintMsgs(false); }); else paintMsgs(false); }
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(true); } else if (e.key === 'Escape') done(false); });
    mt.replaceWith(h('div', { class: 'mt' }, [t, h('div', { class: 'ehint', text: 'Enter to save, Escape to cancel' })])); t.focus();
  }

  // ---------- composer + uploads ----------
  function composer(title) {
    var ta = h('textarea', { class: 'dc-ta', rows: '1', placeholder: 'Message ' + (S.view === 'dm' ? '@' : '#') + title, maxlength: '2000', 'aria-label': 'Message', enterkeyhint: 'send' });
    var chips = h('div', { class: 'dc-pend' }), file = h('input', { type: 'file', accept: 'image/*', hidden: true, multiple: true });
    var send = h('button', { type: 'button', class: 'iconbtn send', 'aria-label': 'Send message' }, icon('send'));
    var attach = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Attach an image' }, icon('image-plus'));
    function paintPend() { Hub.clear(chips); S.pending.forEach(function (p, i) { chips.appendChild(h('div', { class: 'pc' }, [h('img', { src: p.preview, alt: '' }), h('button', { type: 'button', 'aria-label': 'Remove image', onclick: function () { S.pending.splice(i, 1); paintPend(); } }, icon('x'))])); }); chips.hidden = !S.pending.length; }
    function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; }
    var lastType = 0;
    ta.addEventListener('input', function () { grow(); if (Date.now() - lastType > 2500 && ta.value) { lastType = Date.now(); wsSend({ t: 'typing', channel: S.cid }); } });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); go(); } });
    ta.addEventListener('paste', function (e) { var items = (e.clipboardData && e.clipboardData.files) || []; if (items.length) { e.preventDefault(); addFiles(items); } });
    function addFiles(fl) { Array.prototype.slice.call(fl, 0, 4).forEach(function (f) { if (!/^image\//.test(f.type)) return; prep(f).then(function (p) { if (p && S.pending.length < 4) { S.pending.push(p); paintPend(); } }); }); }
    attach.addEventListener('click', function () { file.click(); }); file.addEventListener('change', function () { addFiles(file.files); file.value = ''; });
    var busy = false;
    function go() {
      if (busy) return; var txt = ta.value.trim(), cid = S.cid; if (!txt && !S.pending.length) return; busy = true; send.disabled = true;
      var ups = S.pending.map(function (p) { return api('/api/dc/upload', { dataUrl: p.dataUrl, w: p.w, h: p.h, name: p.name }); });
      Promise.all(ups).then(function (rs) {
        var atts = []; rs.forEach(function (r) { if (r && r.ok) atts.push({ url: r.url, name: r.name, type: 'image', w: r.w, h: r.h }); });
        if (S.pending.length && !atts.length) throw new Error('upload');
        return api('/api/dc/send', { channel: cid, content: txt, attachments: atts });
      }).then(function (r) {
        busy = false; send.disabled = false;
        if (r && r.ok) { ta.value = ''; grow(); S.pending = []; paintPend(); var arr = S.msgs[cid] || (S.msgs[cid] = []); if (!arr.some(function (x) { return x.id === r.message.id; })) { arr.push(r.message); S.rev[cid] = (S.rev[cid] || 0) + 1; } if (cid === S.cid) paintMsgs(true); ta.focus(); }
        else Hub.toast(r && r.error === 'no-access' ? 'You cannot post here' : 'Message not sent', { bad: true });
      }, function () { busy = false; send.disabled = false; Hub.toast('Image upload failed. Try a smaller picture.', { bad: true }); });
    }
    send.addEventListener('click', go);
    var wrap = h('div', { class: 'dc-comp' }, [chips, h('div', { class: 'cin' }, [attach, ta, send]), file]);
    wrap.addEventListener('dragover', function (e) { e.preventDefault(); wrap.classList.add('drag'); }); wrap.addEventListener('dragleave', function () { wrap.classList.remove('drag'); }); wrap.addEventListener('drop', function (e) { e.preventDefault(); wrap.classList.remove('drag'); addFiles(e.dataTransfer.files); });
    paintPend(); return wrap;
  }
  function prep(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1400, w = img.naturalWidth, hh = img.naturalHeight, k = Math.min(1, max / Math.max(w, hh)), cw = Math.round(w * k), ch = Math.round(hh * k), c = document.createElement('canvas'); c.width = cw; c.height = ch;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, cw, ch);
        var q = 0.85, data = c.toDataURL('image/jpeg', q); while (data.length > 1.4 * 1024 * 1024 && q > 0.35) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
        URL.revokeObjectURL(url); if (data.length > 1.45 * 1024 * 1024) { Hub.toast('That picture is too large', { bad: true }); resolve(null); return; }
        resolve({ dataUrl: data, preview: data, w: cw, h: ch, name: (file.name || 'image').slice(0, 60) });
      };
      img.onerror = function () { URL.revokeObjectURL(url); Hub.toast('Could not read that image', { bad: true }); resolve(null); }; img.src = url;
    });
  }

  // ---------- dialogs ----------
  function serverDialog() {
    var nm = h('input', { class: 'input', placeholder: 'Server name', maxlength: '40' }), code = h('input', { class: 'input', placeholder: 'Paste an invite code or link', autocomplete: 'off', autocapitalize: 'off' }), m;
    var body = h('div', { class: 'mbody' }, [h('h3', { text: 'Add a server' }), h('p', { class: 'hint', text: 'Make a space for your friends, or join one with an invite.' }),
      h('label', { class: 'field' }, [h('span', { text: 'Create your own' }), nm]), h('button', { class: 'btn primary block', type: 'button', text: 'Create server', onclick: function (e) { var b = e.currentTarget; if (!nm.value.trim()) { Hub.toast('Name your server first', { bad: true }); return; } b.disabled = true; api('/api/dc/guild', { name: nm.value.trim(), icon: '' }).then(function (r) { b.disabled = false; if (r && r.guild) { S.guilds.push(r.guild); S.view = 'guild'; S.gid = r.guild.id; var t = firstText(r.guild); S.cid = t && t.id; setPane('chat'); m.close(); subAll(); paintAll(); loadMsgs(S.cid, true); loadMembers(r.guild.id); Hub.toast('Server created', { icon: 'users' }); } else Hub.toast('Could not create the server', { bad: true }); }); } }),
      h('h4', { text: 'Have an invite?' }), h('label', { class: 'field' }, [h('span', { text: 'Invite code' }), code]), h('button', { class: 'btn block', type: 'button', text: 'Join server', onclick: function (e) { var b = e.currentTarget, c = code.value.trim().split('/').pop().replace(/[^a-z0-9]/gi, ''); if (!c) { Hub.toast('Paste an invite first', { bad: true }); return; } b.disabled = true; api('/api/dc/join', { code: c }).then(function (r) { b.disabled = false; if (r && r.guild) { S.guilds = S.guilds.filter(function (g) { return g.id !== r.guild.id; }).concat([r.guild]); S.view = 'guild'; S.gid = r.guild.id; var t = firstText(r.guild); S.cid = t && t.id; setPane('chat'); m.close(); subAll(); paintAll(); loadMsgs(S.cid, true); loadMembers(r.guild.id); Hub.toast('Joined ' + r.guild.name, { icon: 'users' }); } else Hub.toast('That invite is not valid', { bad: true }); }); } })]);
    m = Hub.modal(body, { small: true, label: 'Add a server' });
  }
  function channelDialog(g, type) {
    var nm = h('input', { class: 'input', placeholder: type === 'voice' ? 'Hangout' : 'new-channel', maxlength: '24' }), m;
    var body = h('div', { class: 'mbody' }, [h('h3', { text: 'New ' + type + ' channel' }), h('label', { class: 'field', style: 'margin-top:14px' }, [h('span', { text: 'Name' }), nm]), h('button', { class: 'btn primary block', type: 'button', text: 'Create channel', onclick: function (e) { if (!nm.value.trim()) return; var b = e.currentTarget; b.disabled = true; api('/api/dc/guild/' + g.id + '/channel', { name: nm.value, type: type }).then(function (r) { b.disabled = false; if (r && r.guild) { replaceGuild(r.guild); m.close(); subAll(); paintAll(); } else Hub.toast('Could not create that channel', { bad: true }); }); } })]);
    m = Hub.modal(body, { small: true, label: 'New channel' });
  }
  function squarePrep(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var s = Math.min(img.naturalWidth, img.naturalHeight), out = Math.min(256, s), c = document.createElement('canvas'); c.width = out; c.height = out;
        c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, out, out);
        URL.revokeObjectURL(url); resolve({ dataUrl: c.toDataURL('image/jpeg', 0.88), w: out, h: out, name: 'server-icon' });
      };
      img.onerror = function () { URL.revokeObjectURL(url); Hub.toast('Could not read that image', { bad: true }); resolve(null); }; img.src = url;
    });
  }
  function serverPicture(g) {
    var f = h('input', { type: 'file', accept: 'image/*', hidden: true }), m;
    var prev = h('div', { class: 'dc-iconprev' }); function paintPrev() { Hub.clear(prev); prev.style.background = tint(g.id); if (g.iconUrl) prev.appendChild(h('img', { src: g.iconUrl, alt: '' })); else prev.appendChild(h('span', { text: Hub.initials(g.name) })); }
    paintPrev();
    f.addEventListener('change', function () {
      var file = f.files && f.files[0]; if (!file) return;
      squarePrep(file).then(function (p) { if (!p) return; return api('/api/dc/upload', p).then(function (r) { if (!r || !r.url) { Hub.toast('Could not upload that picture', { bad: true }); return; } return api('/api/dc/guild/' + g.id + '/icon', { url: r.url }).then(function (r2) { if (r2 && r2.guild) { replaceGuild(r2.guild); g = r2.guild; paintPrev(); paintAll(); Hub.toast('Server picture updated'); } else Hub.toast('Could not save that picture', { bad: true }); }); }); });
      f.value = '';
    });
    m = Hub.modal(h('div', { class: 'mbody' }, [h('h3', { text: 'Server picture' }), h('p', { class: 'hint', text: 'Pick a square-ish image. It is cropped to the middle.' }), prev,
      h('div', { class: 'adm-row', style: 'margin-top:14px' }, [h('button', { class: 'btn primary', type: 'button', text: 'Choose image', onclick: function () { f.click(); } }), h('button', { class: 'btn', type: 'button', text: 'Remove picture', onclick: function () { api('/api/dc/guild/' + g.id + '/icon', { url: '' }).then(function (r2) { if (r2 && r2.guild) { replaceGuild(r2.guild); g = r2.guild; paintPrev(); paintAll(); } }); } })]), f]), { small: true, label: 'Server picture' });
  }
  function replaceGuild(ng) { S.guilds = S.guilds.map(function (g) { return g.id === ng.id ? ng : g; }); }
  function serverMenu(anchor, g) {
    var items = [{ label: 'Invite people', icon: 'user-plus', fn: function () { api('/api/dc/guild/' + g.id + '/invite', {}).then(function (r) { if (!r || !r.code) { Hub.toast('Could not make an invite', { bad: true }); return; } var link = location.origin + '/#/discord/join/' + r.code; var body = h('div', { class: 'mbody' }, [h('h3', { text: 'Invite to ' + g.name }), h('p', { class: 'hint', text: 'Send this link to a friend. They need a ScrollHub account.' }), h('div', { class: 'dc-inv' }, [h('code', { text: link })]), h('div', { class: 'adm-row', style: 'margin-top:14px' }, [h('button', { class: 'btn primary', type: 'button', text: 'Copy link', onclick: function () { if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { Hub.toast('Link copied', { icon: 'link' }); }, function () { Hub.toast(link); }); else Hub.toast(link); } }), h('span', { class: 'hint', style: 'margin:0', text: 'Code: ' + r.code })])]); Hub.modal(body, { small: true, label: 'Invite' }); }); } }];
    if (isMgr(g)) { items.push({ label: 'Change server picture', icon: 'image-plus', fn: function () { serverPicture(g); } });
      items.push({ label: 'Rename server', icon: 'pencil', fn: function () { var inp = h('input', { class: 'input', value: g.name, maxlength: '40' }), m; m = Hub.modal(h('div', { class: 'mbody' }, [h('h3', { text: 'Rename server' }), h('label', { class: 'field', style: 'margin-top:14px' }, [h('span', { text: 'Name' }), inp]), h('button', { class: 'btn primary block', type: 'button', text: 'Save', onclick: function () { api('/api/dc/guild/' + g.id + '/rename', { name: inp.value }).then(function (r) { if (r && r.guild) { replaceGuild(r.guild); m.close(); paintAll(); } }); } })]), { small: true, label: 'Rename server' }); } });
      var cur = chan(g, S.cid); if (cur && g.channels.length > 1) items.push({ label: 'Delete channel #' + cur.name, icon: 'trash-2', danger: true, fn: function () { api('/api/dc/guild/' + g.id + '/channel/delete', { channel: cur.id }).then(function (r) { if (r && r.guild) { replaceGuild(r.guild); var t = firstText(r.guild); S.cid = t && t.id; paintAll(); if (S.cid) loadMsgs(S.cid, true); } else Hub.toast('Could not delete that channel', { bad: true }); }); } }); }
    if (g.ownerId === S.me.id && !g.builtin) items.push({ label: 'Delete server', icon: 'trash-2', danger: true, fn: function () { api('/api/dc/guild/' + g.id + '/delete', {}).then(function (r) { if (r && r.ok) leaveLocal(g); }); } });
    else if (!g.builtin) items.push({ label: 'Leave server', icon: 'log-out', danger: true, fn: function () { api('/api/dc/guild/' + g.id + '/leave', {}).then(function () { leaveLocal(g); }); } });
    Hub.menu(anchor, items);
  }
  function leaveLocal(g) { S.guilds = S.guilds.filter(function (x) { return x.id !== g.id; }); var n = S.guilds[0]; S.gid = n ? n.id : null; var t = n && firstText(n); S.cid = t && t.id; paintAll(); if (S.cid) loadMsgs(S.cid, true); }
  function memberMenu(anchor, g, u) {
    var items = [{ label: 'Message', icon: 'send', fn: function () { openDm(u.username); } }, { label: 'View profile', icon: 'user', fn: function () { location.hash = '#/profile/' + encodeURIComponent(u.username); } }];
    if (isMgr(g) && !u.owner) items.push({ label: 'Remove from server', icon: 'x', danger: true, fn: function () { api('/api/dc/guild/' + g.id + '/kick', { uid: u.id }).then(function (r) { if (r && r.ok) { loadMembers(g.id); Hub.toast('Removed ' + u.username); } else Hub.toast('Could not remove them', { bad: true }); }); } });
    Hub.menu(anchor, items);
  }
  function openDm(name) {
    if (!name) return;
    api('/api/dc/dm/open', { username: name }).then(function (r) {
      if (!r || !r.dm) { Hub.toast(r && r.error === 'self' ? 'That is you' : 'No player with that name', { bad: true }); return; }
      if (!S.dms.some(function (d) { return d.id === r.dm.id; })) { S.dms.unshift({ id: r.dm.id, user: r.dm.user, lastTs: Date.now() }); wsSend({ t: 'sub', channel: r.dm.id }); }
      S.view = 'dm'; S.gid = null; S.cid = r.dm.id; setPane('chat'); if (Hub.parse().name !== 'discord') location.hash = '#/discord'; else { paintAll(); loadMsgs(r.dm.id, true); }
    });
  }
  Hub.openDm = function (name) { S.boot === true ? openDm(name) : boot().then(function () { openDm(name); }); };

  // ---------- voice (WebRTC mesh, signalled over the same socket) ----------
  var CAM = { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' };
  function joinVoice(g, c, opts) {
    opts = opts || {};
    if (S.voice && S.voice.cid === c.id) { leaveVoice(); return; }
    if (S.voice) leaveVoice();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.RTCPeerConnection) { Hub.toast('Voice is not supported on this browser', { bad: true }); return; }
    if (!S.wsOpen) { Hub.toast('Still connecting. Try again in a moment.', { bad: true }); return; }
    var v = S.voice = { cid: c.id, name: opts.label || (g.name + ' / ' + c.name), stream: null, peers: {}, rooms: {}, connected: false, muted: false, ice: null, audioBox: h('div', { style: 'display:none' }) };
    document.body.appendChild(v.audioBox);
    paintChannels();
    var AUD = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    function getMedia() {
      if (!opts.video) return navigator.mediaDevices.getUserMedia({ audio: AUD });
      return navigator.mediaDevices.getUserMedia({ audio: AUD, video: CAM }).catch(function () { Hub.toast('Camera unavailable, joining with audio only', { bad: true }); return navigator.mediaDevices.getUserMedia({ audio: AUD }); });
    }
    Promise.all([getMedia(), Hub.api('/api/ice')]).then(function (rs) {
      if (S.voice !== v) { rs[0].getTracks().forEach(function (t) { t.stop(); }); return; }
      v.stream = rs[0]; v.ice = (rs[1] && rs[1].iceServers) || [{ urls: 'stun:stun.l.google.com:19302' }]; v.connected = true;
      v.rooms[c.id] = [{ peer: S.peer, name: S.me.username, speaking: false, me: true }]; watch(v.stream, v.rooms[c.id][0]);
      wsSend({ t: 'voice-join', channel: c.id }); paintChannels(); paintMembers(); callBar(); if (opts.onJoined) opts.onJoined(v);
    }, function () { Hub.toast('Microphone access was blocked', { bad: true }); leaveVoice(); });
  }
  function leaveVoice() {
    var v = S.voice; if (!v) return; wsSend({ t: 'voice-leave' });
    if (S.call) { var cl = S.call; S.call = null; clearTimeout(cl.timer); if (cl.ringing) wsSend({ t: 'call-cancel', toUid: cl.uid, dmId: cl.dmId }); }
    Object.keys(v.peers).forEach(function (k) { try { v.peers[k].pc.close(); } catch (e) {} }); if (v.stream) v.stream.getTracks().forEach(function (t) { t.stop(); }); if (v.audioBox.parentNode) v.audioBox.parentNode.removeChild(v.audioBox); if (v.ctx) try { v.ctx.close(); } catch (e) {} clearInterval(v.tick);
    S.voice = null; if (Hub.parse().name === 'discord') { paintChannels(); paintMembers(); } callBar();
  }
  function toggleMute() { var v = S.voice; if (!v || !v.stream) return; v.muted = !v.muted; v.stream.getAudioTracks().forEach(function (t) { t.enabled = !v.muted; }); wsSend({ t: 'voice-mute', muted: v.muted }); paintChannels(); }
  function watch(stream, entry) {
    var v = S.voice; if (!v) return;
    try { v.ctx = v.ctx || new (window.AudioContext || window.webkitAudioContext)(); var an = v.ctx.createAnalyser(); an.fftSize = 256; v.ctx.createMediaStreamSource(stream).connect(an); entry.an = an; entry.buf = new Uint8Array(an.frequencyBinCount); } catch (e) { return; }
    if (!v.tick) v.tick = setInterval(function () { var ch = false, rm = v.rooms[v.cid] || []; rm.forEach(function (p) { if (!p.an) return; p.an.getByteFrequencyData(p.buf); var s = 0; for (var i = 0; i < p.buf.length; i++) s += p.buf[i]; var sp = (s / p.buf.length) > 14 && !(p.me && v.muted); if (sp !== p.speaking) { p.speaking = sp; ch = true; } }); if (ch) { rings(); if (Hub.parse().name === 'discord') paintChannels(); } }, 220);
  }
  function liveVideo(st) { return !!(st && st.getVideoTracks().some(function (t) { return t.readyState === 'live' && !t.muted; })); }
  function mkPeer(id, name, initiator) {
    var v = S.voice; if (!v || v.peers[id]) return v && v.peers[id];
    var pc = new RTCPeerConnection({ iceServers: v.ice }), entry = { pc: pc, name: name, making: false, ignore: false, started: false, polite: String(S.peer) < String(id) };
    v.peers[id] = entry;
    v.stream.getTracks().forEach(function (t) { pc.addTrack(t, v.stream); });
    pc.onicecandidate = function (e) { if (e.candidate) wsSend({ t: 'signal', to: id, data: { candidate: e.candidate } }); };
    pc.ontrack = function (e) {
      var st = e.streams[0]; entry.stream = st;
      var a = entry.audio || (entry.audio = h('audio', { autoplay: true, playsinline: true })); a.srcObject = st; if (!a.parentNode) v.audioBox.appendChild(a); a.play && a.play().catch(function () {});
      var r = (v.rooms[v.cid] || []).filter(function (p) { return p.peer === id; })[0]; if (r && !r.an) watch(st, r);
      if (e.track.kind === 'video') { e.track.onmute = e.track.onunmute = e.track.onended = function () { callBar(); }; st.onremovetrack = function () { callBar(); }; }
      callBar();
    };
    pc.onnegotiationneeded = function () {
      if (!entry.started) return;
      entry.making = true;
      pc.setLocalDescription().then(function () { wsSend({ t: 'signal', to: id, data: { sdp: pc.localDescription } }); }).catch(function () {}).then(function () { entry.making = false; });
    };
    pc.onconnectionstatechange = function () { if (pc.connectionState === 'failed') { try { pc.close(); } catch (e) {} } };
    if (initiator) pc.createOffer().then(function (o) { return pc.setLocalDescription(o).then(function () { entry.started = true; wsSend({ t: 'signal', to: id, data: { sdp: pc.localDescription } }); }); });
    return entry;
  }
  function setRoom(peers) { var v = S.voice; if (!v) return; v.rooms[v.cid] = [{ peer: S.peer, name: S.me.username, speaking: false, me: true, an: (v.rooms[v.cid] && v.rooms[v.cid][0] && v.rooms[v.cid][0].an), buf: (v.rooms[v.cid] && v.rooms[v.cid][0] && v.rooms[v.cid][0].buf) }].concat(peers); if (Hub.parse().name === 'discord') paintChannels(); }
  function voiceWs(d) {
    var v = S.voice; if (!v || !v.connected) return;
    if (d.t === 'voice-peers') { setRoom((d.peers || []).map(function (p) { return { peer: p.peer, name: p.name, speaking: false }; })); }
    else if (d.t === 'voice-join') { var rm = (v.rooms[v.cid] || []).filter(function (p) { return p.peer !== d.peer; }); rm.push({ peer: d.peer, name: d.name, speaking: false }); v.rooms[v.cid] = rm; mkPeer(d.peer, d.name, true); if (Hub.parse().name === 'discord') paintChannels(); }
    else if (d.t === 'voice-leave') { var e = v.peers[d.peer]; if (e) { try { e.pc.close(); } catch (x) {} if (e.audio && e.audio.parentNode) e.audio.parentNode.removeChild(e.audio); delete v.peers[d.peer]; } v.rooms[v.cid] = (v.rooms[v.cid] || []).filter(function (p) { return p.peer !== d.peer; }); if (S.call && !S.call.ringing && v.rooms[v.cid].length <= 1) { Hub.toast('Call ended'); leaveVoice(); return; } if (Hub.parse().name === 'discord') paintChannels(); }
    else if (d.t === 'signal') {
      var ent = v.peers[d.from] || mkPeer(d.from, '', false); if (!ent) return; var pc = ent.pc, data = d.data || {};
      if (data.sdp) {
        var collision = data.sdp.type === 'offer' && (ent.making || pc.signalingState !== 'stable');
        ent.ignore = !ent.polite && collision; if (ent.ignore) return;
        pc.setRemoteDescription(data.sdp).then(function () { if (data.sdp.type === 'offer') return pc.setLocalDescription().then(function () { ent.started = true; wsSend({ t: 'signal', to: d.from, data: { sdp: pc.localDescription } }); }); }).catch(function () {});
      } else if (data.candidate) { if (!ent.ignore) pc.addIceCandidate(data.candidate).catch(function () {}); }
    }
  }

  // ---------- 1:1 voice calls in direct messages ----------
  var ringEl = null, ringTone = null;
  function inCallWith(d) { return !!(S.voice && S.call && S.call.dmId === d.id); }
  function callButtons(d) {
    var mine = inCallWith(d), row = h('div', { class: 'dm-calls' });
    if (mine) {
      row.appendChild(h('button', { type: 'button', class: 'btn sm call-end', onclick: function () { leaveVoice(); } }, [icon('phone'), S.call.ringing ? 'Cancel call' : 'Hang up']));
      row.appendChild(h('button', { type: 'button', class: 'btn sm', onclick: function () { toggleMute(); paintMembers(); } }, [icon(S.voice.muted ? 'mic-off' : 'mic'), S.voice.muted ? 'Unmute' : 'Mute']));
      row.appendChild(h('button', { type: 'button', class: 'btn sm', onclick: function () { toggleCam(); } }, [icon(hasCam() ? 'video-off' : 'video'), hasCam() ? 'Camera off' : 'Camera on']));
    } else {
      row.appendChild(h('button', { type: 'button', class: 'btn sm call-go', onclick: function () { startCall(d, false); } }, [icon('phone'), 'Voice call']));
      row.appendChild(h('button', { type: 'button', class: 'btn sm call-go', onclick: function () { startCall(d, true); } }, [icon('video'), 'Video call']));
    }
    return row;
  }
  function toggleCall(d, video) { if (!d) return; if (inCallWith(d)) { leaveVoice(); return; } startCall(d, !!video); }
  function startCall(d, video) {
    if (!S.wsOpen) { Hub.toast('Still connecting. Try again in a moment.', { bad: true }); return; }
    if (S.voice) leaveVoice();
    var call = { dmId: d.id, uid: d.user.id, name: d.user.username, ringing: true, timer: 0, video: !!video };
    joinVoice(null, { id: d.id, name: d.user.username }, { video: !!video, label: 'Call with ' + d.user.username, onJoined: function () {
      S.call = call; wsSend({ t: 'call-ring', toUid: d.user.id, dmId: d.id, video: !!video });
      call.timer = setTimeout(function () { if (S.call === call && call.ringing) { Hub.toast(d.user.username + ' did not answer'); leaveVoice(); } }, 45000);
      paintChannels(); paintMembers(); callBar();
    } });
  }
  function stopRing() { if (ringTone) { clearInterval(ringTone.t); try { ringTone.ctx.close(); } catch (e) {} ringTone = null; } if (ringEl) { if (ringEl.parentNode) ringEl.parentNode.removeChild(ringEl); clearTimeout(ringEl._t); ringEl = null; } }
  function ringSound() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume();
      function beep() { var o = ctx.createOscillator(), gn = ctx.createGain(); o.frequency.value = 520; o.connect(gn); gn.connect(ctx.destination); gn.gain.setValueAtTime(0.0001, ctx.currentTime); gn.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03); gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5); o.start(); o.stop(ctx.currentTime + 0.55); }
      beep(); ringTone = { ctx: ctx, t: setInterval(beep, 1800) };
    } catch (e) {}
  }
  function incoming(d) {
    stopRing();
    var from = d.fromName || 'Someone', dm = S.dms.filter(function (x) { return x.id === d.dmId; })[0];
    var el = h('div', { class: 'dc-ring', role: 'alertdialog', 'aria-label': 'Incoming call from ' + from }, [
      h('div', { class: 'rg-card' }, [
        h('div', { class: 'rg-av' }, [h('i', { class: 'rg-p1' }), h('i', { class: 'rg-p2' }), avatar(dm ? dm.user : { username: from }, 132)]),
        h('div', { class: 'rg-name', text: from }),
        h('div', { class: 'rg-sub', text: d.video ? 'Incoming video call' : 'Incoming voice call' }),
        h('div', { class: 'rg-btns' }, [
          h('div', { class: 'rg-b' }, [h('button', { type: 'button', class: 'rg-round no', 'aria-label': 'Decline', onclick: function () { wsSend({ t: 'call-decline', toUid: d.fromUid, dmId: d.dmId }); stopRing(); } }, icon('phone')), h('span', { text: 'Decline' })]),
          h('div', { class: 'rg-b' }, [h('button', { type: 'button', class: 'rg-round yes', 'aria-label': 'Accept', onclick: function () { acceptCall(d, dm); } }, icon(d.video ? 'video' : 'phone')), h('span', { text: 'Accept' })])
        ])
      ])]);
    el._from = d.fromUid; el._t = setTimeout(stopRing, 45000); ringEl = el; document.body.appendChild(el); ringSound();
  }
  function acceptCall(d, dm) {
    stopRing();
    if (S.voice) leaveVoice();
    if (!dm) refreshDms();
    S.view = 'dm'; S.gid = null; S.cid = d.dmId;
    var call = { dmId: d.dmId, uid: d.fromUid, name: d.fromName, ringing: false, timer: 0, video: !!d.video };
    if (Hub.parse().name !== 'discord') location.hash = '#/discord'; else { paintAll(); loadMsgs(d.dmId, true); }
    joinVoice(null, { id: d.dmId, name: d.fromName }, { video: !!d.video, label: 'Call with ' + d.fromName, onJoined: function () { S.call = call; wsSend({ t: 'call-accept', toUid: d.fromUid, dmId: d.dmId }); paintChannels(); paintMembers(); callBar(); } });
  }
  function callWs(d) {
    if (d.t === 'call-ring') {
      if (S.voice) { wsSend({ t: 'call-decline', toUid: d.fromUid, dmId: d.dmId }); return; }
      incoming(d); return;
    }
    if (d.t === 'call-cancel') { if (ringEl && ringEl._from === d.fromUid) { stopRing(); Hub.toast('Missed call from ' + (d.fromName || 'someone')); } return; }
    if (d.t === 'call-accept') { if (S.call && S.call.uid === d.fromUid) { S.call.ringing = false; clearTimeout(S.call.timer); paintChannels(); paintMembers(); callBar(); } return; }
    if (d.t === 'call-decline') { if (S.call && S.call.uid === d.fromUid) { Hub.toast((d.fromName || 'They') + ' declined the call'); S.call.ringing = false; leaveVoice(); } }
  }
  // Small floating bar so a call stays controllable outside the Discord page.
  var barEl = null;
  function callBar() {
    try { paintCallPanel(); paintMembers(); } catch (e) {}
    var show = !!(S.voice && Hub.parse().name !== 'discord');
    if (!show) { if (barEl && barEl.parentNode) barEl.parentNode.removeChild(barEl); barEl = null; return; }
    if (barEl && barEl.parentNode) barEl.parentNode.removeChild(barEl);
    barEl = h('div', { class: 'dc-callbar' }, [h('span', { class: 'cd' }), h('div', { class: 'cb' }, [h('b', { text: S.call && S.call.ringing ? 'Calling' : (S.call ? 'In call' : 'In voice') }), h('span', { text: S.voice.name })]),
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': S.voice.muted ? 'Unmute' : 'Mute', onclick: function () { toggleMute(); callBar(); } }, icon(S.voice.muted ? 'mic-off' : 'mic')),
      h('button', { type: 'button', class: 'iconbtn leave', 'aria-label': 'Leave call', onclick: function () { leaveVoice(); } }, icon('phone'))]);
    document.body.appendChild(barEl);
  }
  window.addEventListener('hashchange', function () { if (S.voice) callBar(); });
  function hasCam() { var v = S.voice; return !!(v && v.stream && v.stream.getVideoTracks().some(function (t) { return t.readyState === 'live'; })); }
  function toggleCam() {
    var v = S.voice; if (!v || !v.stream) return;
    var vt = v.stream.getVideoTracks()[0];
    if (vt) {
      Object.keys(v.peers).forEach(function (k) { var pc = v.peers[k].pc; pc.getSenders().forEach(function (s) { if (s.track === vt) { try { pc.removeTrack(s); } catch (e) {} } }); });
      vt.stop(); v.stream.removeTrack(vt); callBar(); return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: CAM }).then(function (ms) {
      if (S.voice !== v) { ms.getTracks().forEach(function (t) { t.stop(); }); return; }
      var t = ms.getVideoTracks()[0]; v.stream.addTrack(t);
      Object.keys(v.peers).forEach(function (k) { try { v.peers[k].pc.addTrack(t, v.stream); } catch (e) {} });
      callBar();
    }, function () { Hub.toast('Camera access was blocked', { bad: true }); });
  }
  // The call panel: one tile per person, video when their camera is on, a glowing ring when they talk.
  function callTile(v, key, name, user, me) {
    v.tiles = v.tiles || {};
    var t = v.tiles[key];
    if (!t) {
      var vid = h('video', { autoplay: true, playsinline: true, muted: true }); vid.muted = true;
      var av = avatar(user, 96); av.classList.add('ct-av');
      var nm = h('div', { class: 'ct-name', text: me ? name + ' (you)' : name });
      var el = h('div', { class: 'ctile', 'data-key': key }, [vid, av, nm]);
      t = v.tiles[key] = { el: el, vid: vid, av: av, nm: nm };
    }
    return t;
  }
  function paintCallPanel() {
    var host = dom.callpanel; if (!host) return;
    var v = S.voice, show = !!(v && S.call && S.view === 'dm' && S.cid === S.call.dmId && Hub.parse().name === 'discord');
    host.hidden = !show; if (!show) { while (host.firstChild) host.removeChild(host.firstChild); return; }
    var rm = v.rooms[v.cid] || [], other = rm.filter(function (p) { return !p.me; })[0], dm = curDm();
    var mine = callTile(v, 'me', S.me.username, { username: S.me.username, avatar: Hub.me.avatar }, true);
    var tiles = [mine], mineVid = hasCam();
    mine.vid.style.transform = 'scaleX(-1)'; if (mine.vid.srcObject !== v.stream) mine.vid.srcObject = v.stream;
    mine.el.classList.toggle('hasvid', mineVid);
    if (other) {
      var ent = v.peers[other.peer], ot = callTile(v, other.peer, other.name, { username: other.name, avatar: dm && dm.user.avatar }, false);
      var ov = !!(ent && liveVideo(ent.stream));
      if (ent && ent.stream && ot.vid.srcObject !== ent.stream) ot.vid.srcObject = ent.stream;
      ot.el.classList.toggle('hasvid', ov); tiles.push(ot);
    } else { var wt = callTile(v, 'wait', S.call.name, dm ? dm.user : { username: S.call.name }, false); wt.el.classList.add('waiting'); wt.nm.textContent = S.call.ringing ? 'Calling ' + S.call.name : S.call.name; tiles.push(wt); }
    host.classList.toggle('solo', tiles.length < 2);
    while (host.firstChild) host.removeChild(host.firstChild);
    tiles.forEach(function (t) { host.appendChild(t.el); if (t.el.classList.contains('hasvid') && t.vid.paused) t.vid.play().catch(function () {}); });
    var bar = h('div', { class: 'ct-bar' }, [
      h('button', { type: 'button', class: 'ctb' + (v.muted ? ' off' : ''), 'aria-label': v.muted ? 'Unmute' : 'Mute', onclick: function () { toggleMute(); callBar(); } }, icon(v.muted ? 'mic-off' : 'mic')),
      h('button', { type: 'button', class: 'ctb' + (mineVid ? '' : ' off'), 'aria-label': mineVid ? 'Turn camera off' : 'Turn camera on', onclick: function () { toggleCam(); } }, icon(mineVid ? 'video' : 'video-off')),
      h('button', { type: 'button', class: 'ctb end', 'aria-label': 'Hang up', onclick: function () { leaveVoice(); } }, icon('phone'))]);
    host.appendChild(bar); rings();
  }
  // Light the ring on whoever is talking right now.
  function rings() {
    var v = S.voice; if (!v || !v.tiles) return; var rm = v.rooms[v.cid] || [];
    Object.keys(v.tiles).forEach(function (k) {
      var on = false; rm.forEach(function (p) { if ((k === 'me' && p.me) || p.peer === k) on = p.me ? (p.speaking && !v.muted) : p.speaking; });
      v.tiles[k].el.classList.toggle('sp', !!on);
    });
    var dmAv = document.querySelector('.dm-card .avatar'); if (dmAv) { var o = rm.filter(function (p) { return !p.me; })[0]; dmAv.classList.toggle('sp', !!(o && o.speaking)); }
  }
  window.addEventListener('beforeunload', function () { if (S.voice) leaveVoice(); });

  // keep unread badge and sign-out state in sync
  Hub.on('dcunread', function () { if (Hub.ready) { var n = $('.nav a[href="#/discord"]'); if (n) { var d = $('.dot', n); if (Hub.dcUnread && !d) n.appendChild(h('i', { class: 'dot plain nav-dot' })); else if (!Hub.dcUnread && d) d.remove(); } } });
  Hub.dcReset = function () { if (S.voice) leaveVoice(); if (S.ws) { try { S.ws.close(); } catch (e) {} } S = { boot: false, me: null, guilds: [], dms: [], gid: null, cid: null, view: 'guild', msgs: {}, rev: {}, members: {}, unread: {}, typing: {}, ws: null, wsOpen: false, peer: '', pane: 'list', pending: [], loadingBoot: null, voice: null }; Hub.dcUnread = 0; };
  // Warm up in the background so unread badges work before the page is opened.
  Hub.on('ready', function () { if (Hub.me.kind === 'user') boot(); });
})();
