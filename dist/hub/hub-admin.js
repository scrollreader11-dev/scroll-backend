/* ScrollHub Hub: Admin tools. Role based (owner / mod), no password. The server checks the role on every call. */
(function () {
  'use strict';
  var Hub = window.Hub, h = Hub.h, icon = Hub.icon, $ = Hub.$, $$ = Hub.$$;
  var cache = { state: null, at: 0 };

  function role() { return Hub.me && Hub.me.role || null; }
  function isOwner() { return role() === 'owner' || role() === 'coowner'; }   // full tools
  function isTrueOwner() { return role() === 'owner'; }                       // only the owner changes roles
  function post(body) { return Hub.api('/api/staff/act', { body: body }); }
  function toastErr(r, fallback) { Hub.toast((r && (r.message || (r.error === 'owner only' ? 'Only an owner can do that' : r.error))) || fallback || 'That did not work', { bad: true }); }
  function field(label, input) { return h('label', { class: 'field' }, [h('span', { text: label }), input]); }
  function inp(ph, o) { o = o || {}; var e = h('input', { class: 'input', type: o.type || 'text', placeholder: ph || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', inputmode: o.inputmode || null }); if (o.value != null) e.value = o.value; return e; }
  function btn(label, fn, o) { o = o || {}; var b = h('button', { type: 'button', class: 'btn sm' + (o.primary ? ' primary' : '') + (o.danger ? ' danger' : '') + (o.ghost ? ' ghost' : '') }, [o.icon ? icon(o.icon) : null, label]); b.addEventListener('click', function () { if (b.disabled) return; fn(b); }); return b; }
  function busy(b, p) { b.disabled = true; return p.then(function (r) { b.disabled = false; return r; }, function (e) { b.disabled = false; throw e; }); }
  function card(title, sub, kids, cls) { return h('section', { class: 'adm-card' + (cls ? ' ' + cls : '') }, [h('div', { class: 'adm-ch' }, [h('h3', { text: title }), sub ? h('p', { text: sub }) : null]), kids]); }
  function confirmBox(title, text, okLabel) {
    return new Promise(function (resolve) {
      var done = false, m;
      function fin(v) { if (done) return; done = true; m.close(); resolve(v); }
      var body = h('div', { class: 'mbody' }, [h('h3', { text: title }), h('p', { class: 'hint', text: text }), h('div', { class: 'adm-row', style: 'margin-top:18px' }, [btn(okLabel || 'Confirm', function () { fin(true); }, { danger: true }), btn('Cancel', function () { fin(false); }, { ghost: true })])]);
      m = Hub.modal(body, { small: true, label: title, onClose: function () { if (!done) { done = true; resolve(false); } } });
    });
  }
  function badge(r) { return h('span', { class: 'adm-badge ' + (r || 'none'), text: r === 'owner' ? 'Owner' : r === 'coowner' ? 'Co-owner' : r === 'mod' ? 'Mod' : 'Player' }); }
  function statTile(label, value, ic, hint) { return h('div', { class: 'adm-stat' }, [h('div', { class: 'si' }, icon(ic)), h('div', { class: 'sv', text: value }), h('div', { class: 'sl', text: label }), hint ? h('div', { class: 'sh', text: hint }) : null]); }
  function empty(t) { return h('p', { class: 'adm-empty', text: t }); }
  function loading() { return h('div', { class: 'adm-loading' }, [h('i'), h('i'), h('i')]); }
  function agoTxt(ts) { var a = Hub.ago(ts); return a === 'now' ? 'just now' : a + ' ago'; }
  function lastN(arr, n) { return (arr || []).slice(0, n); }

  var TABS = [
    ['overview', 'Overview', 'gauge', 0],
    ['players', 'Players', 'users', 0],
    ['insights', 'Insights', 'trending-up', 0],
    ['economy', 'Economy', 'coins', 1],
    ['staff', 'Roles and staff', 'shield', 0],
    ['announce', 'Announcements', 'megaphone', 0],
    ['moderation', 'Moderation', 'hammer', 0],
    ['chats', 'Discord monitor', 'message-square', 0],
    ['toolbox', 'Toolbox', 'hammer', 0],
    ['site', 'Site controls', 'server', 1],
    ['audit', 'Audit log', 'list-checks', 1],
  ];
  Hub.isStaff = function () { return !!role(); };

  // ---------- shell ----------
  Hub.views.admin = function (a) {
    var v = h('div', { class: 'adm' });
    if (!role()) { v.appendChild(Hub.emptyState('shield', 'Staff only', 'This area is only for owners and moderators.', h('a', { class: 'btn primary', href: '#/home', text: 'Back to Home' }))); return v; }
    var tab = a[0] || 'overview', tabs = TABS.filter(function (t) { return !t[3] || isOwner(); });
    if (!tabs.some(function (t) { return t[0] === tab; })) tab = 'overview';
    var own = isOwner();
    var hero = h('div', { class: 'adm-hero' }, [
      h('div', { class: 'ah-ic' }, icon(own ? 'crown' : 'shield')),
      h('div', { class: 'ah-tx' }, [h('div', { class: 'ah-k', text: 'Admin tools' }), h('h1', { text: role() === 'coowner' ? 'Co-owner panel' : own ? 'Owner panel' : 'Moderator panel' }), h('p', { text: role() === 'coowner' ? 'Nearly full control of the site. Only the owner changes roles or acts on owners.' : own ? 'Full control of the site: players, Scrolls, items, staff and settings.' : 'Moderation tools. Owners can change what you have access to.' })]),
      h('div', { class: 'ah-r' }, [badge(role()), h('span', { class: 'ah-n', text: Hub.me.name })]),
    ]);
    var nav = h('nav', { class: 'adm-nav', 'aria-label': 'Admin sections' });
    tabs.forEach(function (t) { nav.appendChild(h('a', { href: '#/admin/' + t[0], class: t[0] === tab ? 'on' : '', 'aria-current': t[0] === tab ? 'page' : null }, [icon(t[2]), h('span', { text: t[1] })])); });
    var host = h('div', { class: 'adm-main' });
    v.appendChild(hero); v.appendChild(h('div', { class: 'adm-grid' }, [nav, host]));
    (PANES[tab] || PANES.overview)(host);
    return v;
  };

  var PANES = {};


  // ---------- Discord monitor: every channel, live feed, search, delete ----------
  PANES.chats = function (host) {
    var own = isOwner(), state = { mode: 'live', channel: '', since: 0, timer: 0, rows: [] };
    var list = h('div', { class: 'mon-list' }), pane = h('div', { class: 'mon-pane' }), q = inp('Search every message or a username');
    var notice = h('p', { class: 'hint', text: own ? 'You can read every server channel and every direct message. Opening a direct message is written to the audit log. Members are told in Discord that messages can be reviewed.' : 'You can read every server channel. Direct messages are owner only. Deleting a message is written to the audit log.' });
    var wrap = h('div', { class: 'mon' }, [list, pane]);
    host.appendChild(card('Discord monitor', 'Read every channel in the Discord, search it, and remove messages that break the rules.', [notice, h('div', { class: 'adm-row', style: 'margin:12px 0' }, [q, btn('Search', function () { runSearch(); }, { primary: true }), btn('Live feed', function () { go('live'); }, { icon: 'zap' })]), wrap]));
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') runSearch(); });
    function alive() { return host.isConnected; }
    function stop() { clearInterval(state.timer); state.timer = 0; }
    function msgRow(m, showWhere) {
      var row = h('div', { class: 'mon-m' }, [
        h('div', { class: 'mh' }, [h('b', { text: Hub.clean(m.name) }), m.role ? badge(m.role) : null, showWhere && m.where ? h('span', { class: 'mw', text: Hub.clean(m.where) }) : null, h('span', { class: 'mt', text: new Date(m.ts).toLocaleString() })]),
        h('div', { class: 'mc', text: Hub.clean(m.content) || (m.attachments && m.attachments.length ? '' : '(empty)') })]);
      (m.attachments || []).forEach(function (u) { row.appendChild(h('a', { class: 'ma', href: u, target: '_blank', rel: 'noopener noreferrer' }, [h('img', { src: u, alt: 'attachment', loading: 'lazy' })])); });
      row.appendChild(h('div', { class: 'mx' }, [btn('Delete', function (e) { confirmBox('Delete this message?', Hub.clean(m.name) + ': ' + Hub.clean(m.content).slice(0, 120), 'Delete').then(function (ok) { if (!ok) return; post({ action: 'discord.del', channel: m.channel, id: m.id }).then(function (r) { if (r && r.ok) { row.remove(); Hub.toast('Message deleted'); } else toastErr(r); }); }); }, { danger: true, ghost: true, icon: 'trash-2' })]));
      return row;
    }
    function paint(rows, title, whereCol) { Hub.clear(pane); pane.appendChild(h('div', { class: 'mon-t', text: title })); var box = h('div', { class: 'mon-msgs' }); if (!rows.length) box.appendChild(empty('Nothing here yet.')); rows.forEach(function (m) { box.appendChild(msgRow(m, whereCol)); }); pane.appendChild(box); }
    function go(mode, channel, label) {
      stop(); state.mode = mode; state.channel = channel || ''; markList();
      if (mode === 'live') {
        Hub.clear(pane); pane.appendChild(loading());
        function poll() { if (!alive()) { stop(); return; } post({ action: 'discord.recent', limit: 60 }).then(function (r) { if (!alive() || state.mode !== 'live') return; paint((r && r.messages) || [], 'Live feed: newest messages from every channel (refreshes every 4 seconds)', true); }); }
        poll(); state.timer = setInterval(poll, 4000);
      } else {
        Hub.clear(pane); pane.appendChild(loading());
        post({ action: 'discord.msgs', channel: channel, limit: 150 }).then(function (r) { if (!alive()) return; if (!r || r.error) { Hub.clear(pane); pane.appendChild(empty(r && r.error === 'owner only' ? 'Only the owner can read direct messages.' : 'Could not load that channel.')); return; } paint(r.messages.slice().reverse(), r.label, false); });
      }
    }
    function runSearch() { var t = q.value.trim(); if (t.length < 2) { Hub.toast('Type at least two letters'); return; } stop(); state.mode = 'search'; markList(); Hub.clear(pane); pane.appendChild(loading()); post({ action: 'discord.search', q: t, limit: 100 }).then(function (r) { if (!alive()) return; paint((r && r.messages) || [], 'Search results for "' + t + '"', true); }); }
    function markList() { $$('.mon-i', list).forEach(function (e) { e.classList.toggle('on', (state.mode === 'live' && e.dataset.k === 'live') || (state.mode === 'chan' && e.dataset.k === state.channel)); }); }
    function item(label, k, fn, sub) { var b = h('button', { type: 'button', class: 'mon-i', 'data-k': k }, [h('span', { text: Hub.clean(label) }), sub != null ? h('i', { text: String(sub) }) : null]); b.addEventListener('click', fn); return b; }
    post({ action: 'discord.chans' }).then(function (r) {
      if (!alive()) return; Hub.clear(list); list.appendChild(item('Live feed', 'live', function () { go('live'); }));
      ((r && r.guilds) || []).forEach(function (g) {
        list.appendChild(h('div', { class: 'mon-g', text: Hub.clean(g.name) + '  ·  ' + g.members + ' members' }));
        g.channels.forEach(function (c) { list.appendChild(item('#' + c.name, c.id, function () { go('chan', c.id); }, c.count)); });
      });
      if (own && r && r.dms && r.dms.length) { list.appendChild(h('div', { class: 'mon-g', text: 'Direct messages (owner only)' })); r.dms.forEach(function (d) { list.appendChild(item(d.users.join(' and '), d.id, function () { go('chan', d.id); }, d.count)); }); }
      markList();
    });
    go('live');
    var obs = new MutationObserver(function () { if (!alive()) { stop(); obs.disconnect(); } }); obs.observe(document.body, { childList: true, subtree: true });
  };

  // ---------- Toolbox: a searchable catalog of controls; every entry calls a real server action ----------
  PANES.toolbox = function (host) {
    var own = isOwner(), T = { cfg: null, games: [], items: [], chans: [], target: inp('Player username (for player controls)'), chan: h('select', { class: 'input' }), shown: 120, group: 'all', q: '' };
    var listEl = h('div', { class: 'tb-list' }), countEl = h('div', { class: 'tb-count' }), chips = h('div', { class: 'tb-chips' }), search = inp('Search controls, for example "keno", "mute", "price"');
    var ENTRIES = [];
    function cfgSet(patch) { return post(Object.assign({ action: 'casino.cfg.set' }, patch)).then(function (r) { if (r && r.ok) { T.cfg = r.cfg; Hub.toast('Saved'); } else toastErr(r); return r; }); }
    function userOp(op, val, label) { var u = T.target.value.trim(); if (!u) { Hub.toast('Type a player username at the top first', { bad: true }); return Promise.resolve(); } return post({ action: 'player.op', username: u, op: op, value: val }).then(function (r) { if (r && r.ok) Hub.toast(label + ' done for ' + u); else toastErr(r); }); }
    function dcOp(op, extra, label, needUser, needChan) {
      var body = Object.assign({ action: 'dc.op', op: op }, extra || {});
      if (needUser) { var u = T.target.value.trim(); if (!u) { Hub.toast('Type a player username at the top first', { bad: true }); return Promise.resolve(); } body.username = u; }
      if (needChan) { if (!T.chan.value) { Hub.toast('Pick a channel at the top first', { bad: true }); return Promise.resolve(); } body.channel = T.chan.value; }
      return post(body).then(function (r) { if (r && r.ok) Hub.toast(label + ' done' + (r.removed != null ? ' (' + r.removed + ' messages)' : '')); else toastErr(r); return r; });
    }
    function sw(get, set) { var b = h('button', { type: 'button', class: 'tb-sw', role: 'switch' }); function paint() { var on = !!get(); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.textContent = on ? 'On' : 'Off'; } b.addEventListener('click', function () { set(!get()).then(paint); }); paint(); return b; }
    function num(get, set, ph) { var i = h('input', { class: 'input tb-n', type: 'text', inputmode: 'numeric', placeholder: ph || '0' }); i.value = get() || ''; return h('div', { class: 'tb-ctl' }, [i, btn('Save', function (e) { set(i.value.trim() === '' ? 0 : Number(i.value)); }, { primary: true })]); }
    function opBtn(label, fn, danger) { return h('div', { class: 'tb-ctl' }, btn(label, fn, { danger: !!danger })); }
    function numOp(label, fn, ph) { var i = h('input', { class: 'input tb-n', type: 'text', inputmode: 'numeric', placeholder: ph || 'amount' }); return h('div', { class: 'tb-ctl' }, [i, btn(label, function () { fn(i.value.trim()); })]); }
    function add(group, title, desc, ownerOnly, make) { ENTRIES.push({ group: group, title: title, desc: desc, owner: !!ownerOnly, make: make }); }
    function build() {
      ENTRIES = []; var cf = function () { return T.cfg || {}; };
      // Casino house
      add('Casino house', 'Casino open or closed', 'Closing the casino blocks every bet in every game.', 1, function () { return sw(function () { return !cf().closed; }, function (v) { return cfgSet({ closed: !v }).then(function () { return !cf().closed; }).then(function () { return v; }); }); });
      add('Casino house', 'Minimum bet, all games', 'Smallest bet allowed anywhere. 0 means no minimum.', 1, function () { return num(function () { return cf().minBet; }, function (v) { cfgSet({ minBet: v }); }); });
      add('Casino house', 'Maximum bet, all games', 'Largest bet allowed anywhere. 0 means no limit.', 1, function () { return num(function () { return cf().maxBet; }, function (v) { cfgSet({ maxBet: v }); }); });
      add('Casino house', 'Maximum payout (eight newer games)', 'Caps what one round of keno, scratch, baccarat, shells, penalty, war, hi-lo or poker can pay. 0 means no cap.', 1, function () { return num(function () { return cf().maxPayout; }, function (v) { cfgSet({ maxPayout: v }); }); });
      add('Casino house', 'Daily reward base amount', 'Base Scrolls for the daily reward (streak bonus is added on top). 0 uses the default.', 1, function () { return num(function () { return cf().dailyCoins; }, function (v) { cfgSet({ dailyCoins: v }); }); });
      add('Casino house', 'Starting Scrolls for new accounts', 'What a brand new account starts with. 0 uses the default.', 1, function () { return num(function () { return cf().startCoins; }, function (v) { cfgSet({ startCoins: v }); }); });
      // Per game
      T.games.forEach(function (g) {
        function gc() { return (cf().games || {})[g.id] || {}; }
        add('Casino games', g.name + ': switch', 'Turn ' + g.name + ' on or off for everyone.', 1, function () { return sw(function () { return !gc().off; }, function (v) { return cfgSet({ game: { id: g.id, off: !v } }).then(function () { return !gc().off; }).then(function () { return v; }); }); });
        add('Casino games', g.name + ': minimum bet', 'Smallest bet for ' + g.name + '. 0 uses the house minimum.', 1, function () { return num(function () { return gc().min; }, function (v) { cfgSet({ game: { id: g.id, min: v } }); }); });
        add('Casino games', g.name + ': maximum bet', 'Largest bet for ' + g.name + '. 0 uses the house maximum.', 1, function () { return num(function () { return gc().max; }, function (v) { cfgSet({ game: { id: g.id, max: v } }); }); });
      });
      // Store items
      T.items.forEach(function (it) {
        function ic() { return (cf().items || {})[it.id] || {}; }
        add('Store items', it.label + ': for sale', 'Hide ' + it.label + ' (' + it.type + ', ' + it.price + ' Scrolls) from the shop. Players who own it keep it.', 1, function () { return sw(function () { return !ic().off; }, function (v) { return cfgSet({ item: { id: it.id, off: !v } }).then(function () { return !ic().off; }).then(function () { return v; }); }); });
        add('Store items', it.label + ': price', 'Set the price of ' + it.label + '. Default is ' + it.price + '. Empty or 0 puts it back to default.', 1, function () { return num(function () { return ic().price; }, function (v) { cfgSet({ item: { id: it.id, price: v ? v : '' } }); }, String(it.price)); });
      });
      // Player economy (owner)
      add('Player Scrolls', 'Set Scrolls', 'Set the target player\'s Scrolls to an exact amount.', 1, function () { return numOp('Set', function (v) { userOp('coins.set', v, 'Set Scrolls'); }); });
      add('Player Scrolls', 'Add Scrolls', 'Give the target player Scrolls.', 1, function () { return numOp('Add', function (v) { userOp('coins.add', v, 'Add Scrolls'); }); });
      add('Player Scrolls', 'Take Scrolls', 'Take Scrolls from the target player (never below 0).', 1, function () { return numOp('Take', function (v) { userOp('coins.take', v, 'Take Scrolls'); }); });
      [['coins.reset', 'Reset Scrolls to the starting amount', 'Reset', 0], ['coins.zero', 'Set Scrolls to zero', 'Zero', 1], ['coins.double', 'Double Scrolls', 'Double', 0], ['coins.halve', 'Halve Scrolls', 'Halve', 0]].forEach(function (o) { add('Player Scrolls', o[1], 'Applies to the target player.', 1, function () { return opBtn(o[2], function () { userOp(o[0], null, o[1]); }, o[3]); }); });
      add('Player Scrolls', 'Set daily streak', 'Set the target player\'s daily streak.', 1, function () { return numOp('Set', function (v) { userOp('streak.set', v, 'Set streak'); }, 'days'); });
      [['streak.clear', 'Clear daily streak'], ['stats.reset', 'Reset casino stats'], ['weekly.reset', 'Reset this week\'s net'], ['peak.reset', 'Reset peak Scrolls']].forEach(function (o) { add('Player Scrolls', o[1], 'Applies to the target player.', 1, function () { return opBtn('Run', function () { userOp(o[0], null, o[1]); }, true); }); });
      // Player look (mods too)
      [['tag.clear', 'Remove name tag'], ['color.clear', 'Remove name color'], ['banner.clear', 'Remove chosen banner item'], ['avatarfx.clear', 'Remove avatar effect'], ['titlefx.clear', 'Remove name tag effect'], ['avatar.clear', 'Remove profile picture'], ['bannerimage.clear', 'Remove profile banner image'], ['look.reset', 'Reset casino character outfit'], ['cosmetics.clear', 'Remove every cosmetic and picture'], ['nick.clear', 'Clear casino nickname'], ['profile.private', 'Make profile private'], ['profile.public', 'Make profile public']].forEach(function (o) { add('Player profile', o[1], 'Applies to the target player. Moderators can use this.', 0, function () { return opBtn('Run', function () { userOp(o[0], null, o[1]); }); }); });
      // Discord
      add('Discord', 'Mute a player', 'Stops the target player posting anywhere in the Discord. Moderators are limited to 60 minutes.', 0, function () { return numOp('Mute', function (v) { dcOp('mute', { minutes: v || 10 }, 'Mute', true); }, 'minutes'); });
      add('Discord', 'Unmute a player', 'Lets the target player post again.', 0, function () { return opBtn('Unmute', function () { dcOp('unmute', {}, 'Unmute', true); }); });
      add('Discord', 'Delete every message by a player', 'Removes everything the target player ever posted in the Discord.', 1, function () { return opBtn('Purge', function () { dcOp('purgeuser', {}, 'Purge', true); }, true); });
      add('Discord', 'Lock channel', 'Only staff and the server owner can post in the chosen channel.', 0, function () { return opBtn('Lock', function () { dcOp('lock', {}, 'Lock', false, true); }); });
      add('Discord', 'Unlock channel', 'Lets everyone post in the chosen channel again.', 0, function () { return opBtn('Unlock', function () { dcOp('unlock', {}, 'Unlock', false, true); }); });
      add('Discord', 'Slow mode for channel', 'Seconds a player must wait between messages in the chosen channel. 0 turns it off.', 0, function () { return numOp('Set', function (v) { dcOp('slow', { seconds: v || 0 }, 'Slow mode', false, true); }, 'seconds'); });
      add('Discord', 'Clear all messages in channel', 'Wipes the chosen channel.', 1, function () { return opBtn('Clear', function () { dcOp('clearchannel', {}, 'Clear', false, true); }, true); });
      add('Discord', 'Post as ScrollHub in channel', 'Sends a message from the ScrollHub account into the chosen channel.', 1, function () { var i = h('input', { class: 'input', placeholder: 'Message' }); return h('div', { class: 'tb-ctl' }, [i, btn('Send', function () { if (i.value.trim()) dcOp('say', { text: i.value }, 'Post', false, true).then(function () { i.value = ''; }); })]); });
      var flags = {};
      [['dmsOff', 'Turn off direct messages for players'], ['voiceOff', 'Turn off voice and video calls'], ['uploadsOff', 'Turn off image uploads']].forEach(function (f) { add('Discord', f[1], 'Staff are not affected.', 1, function () { return sw(function () { return !!flags[f[0]]; }, function (v) { return dcOp('flag', { flag: f[0], on: v }, f[1]).then(function (r) { if (r && r.ok) flags[f[0]] = v; return v; }); }); }); });
      post({ action: 'dc.state' }).then(function (r) { if (r && r.flags) { Object.keys(r.flags).forEach(function (k) { flags[k] = r.flags[k]; }); render(); } });
      add('Discord', 'Maximum message length', 'Characters allowed per message (50 to 2000). 0 uses the default of 2000.', 1, function () { return num(function () { return 0; }, function (v) { dcOp('maxlen', { value: v }, 'Message length'); }); });
      add('Discord', 'Remove a player from a server', 'Uses the player above and the server of the chosen channel.', 0, function () { return opBtn('Remove', function () { var ch = T.chans.filter(function (c) { return c.id === T.chan.value; })[0]; if (!ch) { Hub.toast('Pick a channel at the top first', { bad: true }); return; } dcOp('kickuser', { guild: ch.gid }, 'Remove', true); }, true); });
      add('Discord', 'Rename the chosen channel\'s server', 'Type the new name.', 1, function () { var i = h('input', { class: 'input', placeholder: 'New name' }); return h('div', { class: 'tb-ctl' }, [i, btn('Rename', function () { var ch = T.chans.filter(function (c) { return c.id === T.chan.value; })[0]; if (!ch || !i.value.trim()) { Hub.toast('Pick a channel and type a name', { bad: true }); return; } dcOp('renameserver', { guild: ch.gid, name: i.value }, 'Rename'); })]); });
      add('Discord', 'Remove the chosen channel\'s server picture', 'Clears the server icon.', 1, function () { return opBtn('Remove', function () { var ch = T.chans.filter(function (c) { return c.id === T.chan.value; })[0]; if (!ch) { Hub.toast('Pick a channel at the top first', { bad: true }); return; } dcOp('clearicon', { guild: ch.gid }, 'Remove picture'); }); });
      add('Discord', 'Delete the chosen channel\'s server', 'Deletes the whole server and its messages. The built-in server cannot be deleted.', 1, function () { return opBtn('Delete', function () { var ch = T.chans.filter(function (c) { return c.id === T.chan.value; })[0]; if (!ch) { Hub.toast('Pick a channel at the top first', { bad: true }); return; } confirmBox('Delete this server?', ch.gname + ' and every message in it will be gone.', 'Delete').then(function (ok) { if (ok) dcOp('deleteserver', { guild: ch.gid }, 'Delete server'); }); }, true); });
      if (!own) ENTRIES = ENTRIES.filter(function (e) { return !e.owner; });
    }
    function groups() { var g = {}; ENTRIES.forEach(function (e) { g[e.group] = (g[e.group] || 0) + 1; }); return g; }
    function render() {
      var g = groups(), total = ENTRIES.length, words = T.q.toLowerCase().split(/\s+/).filter(Boolean);
      var rows = ENTRIES.filter(function (e) { if (T.group !== 'all' && e.group !== T.group) return false; var hay = (e.group + ' ' + e.title + ' ' + e.desc).toLowerCase(); return words.every(function (w) { return hay.indexOf(w) >= 0; }); });
      var types = ENTRIES.filter(function (e) { return e.group !== 'Casino games' && e.group !== 'Store items'; }).length;
      countEl.textContent = total + ' controls available to you: ' + types + ' standard controls, ' + (g['Casino games'] || 0) + ' per-game controls, ' + (g['Store items'] || 0) + ' per-item shop controls.' + (T.q || T.group !== 'all' ? '  Showing ' + rows.length + '.' : '');
      Hub.clear(chips);
      [['all', 'All']].concat(Object.keys(g).map(function (k) { return [k, k + ' (' + g[k] + ')']; })).forEach(function (o) { var b = h('button', { type: 'button', class: 'tb-chip' + (T.group === o[0] ? ' on' : ''), text: o[1] }); b.addEventListener('click', function () { T.group = o[0]; T.shown = 120; render(); }); chips.appendChild(b); });
      Hub.clear(listEl);
      if (!rows.length) listEl.appendChild(empty('No controls match that search.'));
      rows.slice(0, T.shown).forEach(function (e) { listEl.appendChild(h('div', { class: 'tb-row' }, [h('div', { class: 'tb-t' }, [h('div', { class: 'tb-n1', text: e.title }), h('div', { class: 'tb-d', text: e.desc }), h('div', { class: 'tb-g', text: e.group })]), e.make()])); });
      if (rows.length > T.shown) listEl.appendChild(h('div', { class: 'tb-more' }, btn('Show more (' + (rows.length - T.shown) + ' left)', function () { T.shown += 120; render(); })));
    }
    search.addEventListener('input', function () { T.q = search.value; T.shown = 120; render(); });
    host.appendChild(card('Toolbox', 'Every control here changes something real. Pick a player and a channel, then search for what you need.', [
      h('div', { class: 'tb-top' }, [field('Target player', T.target), field('Target channel', T.chan)]), field('Search', search), countEl, chips, listEl]));
    var loads = [post({ action: 'discord.chans' }).then(function (r) { T.chans = []; Hub.clear(T.chan); T.chan.appendChild(h('option', { value: '', text: 'No channel picked' })); ((r && r.guilds) || []).forEach(function (gd) { gd.channels.forEach(function (ch) { T.chans.push({ id: ch.id, gid: gd.id, gname: gd.name }); T.chan.appendChild(h('option', { value: ch.id, text: gd.name + ' / #' + ch.name })); }); }); })];
    if (own) loads.push(post({ action: 'casino.cfg.get' }).then(function (r) { if (r && r.ok) { T.cfg = r.cfg; T.games = r.games || []; T.items = r.items || []; } }));
    Promise.all(loads).then(function () { build(); render(); });
  };
  // ---------- overview ----------
  PANES.overview = function (host) {
    host.appendChild(loading());
    post({ action: 'state' }).then(function (r) {
      Hub.clear(host);
      if (!r || r.error) { host.appendChild(card('Overview', '', empty('Could not load the live data.'))); return; }
      cache.state = r;
      var st = r.stats || {}, online = (r.players || []).filter(function (p) { return p.online; }).length;
      host.appendChild(h('div', { class: 'adm-stats' }, [statTile('Online now', Hub.num(online), 'users', r.players ? r.players.length + ' seen recently' : ''), statTile('Peak online', Hub.num(st.peakOnline || 0), 'trending-up', st.peakAt ? agoTxt(st.peakAt) : ''), statTile('Sessions', Hub.num(st.totalSessions || 0), 'gamepad-2', 'since last restart'), statTile('Active bans', Hub.num((r.bans || []).length), 'skull', 'by network address')]));
      var hours = st.hourly || [], max = Math.max.apply(null, hours.concat([1]));
      var chart = h('div', { class: 'adm-bars' }); hours.forEach(function (n, i) { chart.appendChild(h('div', { class: 'ab', title: i + ':00  ' + n + ' sessions' }, [h('i', { style: 'height:' + Math.max(3, Math.round(n / max * 100)) + '%' }), h('b', { text: i % 6 === 0 ? String(i) : '' })])); });
      var top = h('div', { class: 'adm-top' }); (st.topGames || []).forEach(function (g, i) { top.appendChild(h('div', { class: 'at' }, [h('span', { class: 'n', text: String(i + 1) }), h('div', { class: 'x' }, [h('div', { text: Hub.clean(g.name) }), h('div', { class: 'mini-bar' }, h('i', { style: 'width:' + Math.round(g.plays / ((st.topGames[0] && st.topGames[0].plays) || 1) * 100) + '%' }))]), h('span', { class: 'p', text: Hub.num(g.plays) })])); });
      host.appendChild(h('div', { class: 'adm-two' }, [card('Activity by hour', 'Sessions started, by hour of the day', chart), card('Most played', 'Games opened most often', (st.topGames || []).length ? top : empty('No plays recorded yet.'))]));
      var feed = h('div', { class: 'adm-feed' });
      lastN(r.events, 14).forEach(function (e) { feed.appendChild(h('div', { class: 'ev' }, [h('span', { class: 'et', text: e.type }), h('span', { class: 'ed', text: Hub.clean((e.nickname ? e.nickname + ' ' : '') + (e.detail || '')) }), h('span', { class: 'ea', text: Hub.ago(e.ts) })])); });
      host.appendChild(card('Recent activity', 'Joins, bans, grants and more', (r.events || []).length ? feed : empty('Nothing has happened yet.')));
      if (isOwner()) {
        var hb = h('div', { class: 'adm-health' }, loading()); host.appendChild(card('Server health', 'Uptime, memory and recent errors', hb));
        post({ action: 'syshealth' }).then(function (x) {
          Hub.clear(hb); if (!x || !x.ok) { hb.appendChild(empty('Health data is not available.')); return; }
          var mb = function (n) { return (n / 1048576).toFixed(0) + ' MB'; };
          hb.appendChild(h('div', { class: 'adm-stats' }, [statTile('Uptime', x.uptimeFormatted, 'clock'), statTile('Memory', mb(x.memRss), 'hard-drive', mb(x.memHeap) + ' heap'), statTile('Online now', Hub.num(x.onlineNow), 'users')]));
          var oh = x.onlineHistory || [], mx = Math.max.apply(null, oh.map(function (o) { return o.count; }).concat([1])), ch2 = h('div', { class: 'adm-bars' });
          oh.slice(-48).forEach(function (o) { ch2.appendChild(h('div', { class: 'ab', title: new Date(o.ts).toLocaleTimeString('en-US') + '  ' + o.count + ' online' }, h('i', { style: 'height:' + Math.max(3, Math.round(o.count / mx * 100)) + '%' }))); });
          if (oh.length) { hb.appendChild(h('h4', { text: 'Players online, last few hours' })); hb.appendChild(ch2); }
          var er = x.errorLog || []; hb.appendChild(h('h4', { text: 'Recent server errors' }));
          if (!er.length) hb.appendChild(empty('No errors logged.')); else { var eb = h('div', { class: 'adm-audit' }); er.slice().reverse().slice(0, 12).forEach(function (e) { eb.appendChild(h('div', { class: 'au' }, [h('span', { class: 'at', text: Hub.ago(e.ts) }), h('span', { class: 'ad', text: Hub.clean(e.msg) })])); }); hb.appendChild(eb); }
        });
      }
    });
  };

  // ---------- insights ----------
  PANES.insights = function (host) {
    var lb = h('div', { class: 'adm-list' }, loading()), act = h('div', { class: 'adm-list' }, loading()), joins = h('div', { class: 'adm-bars tall' }), hist = h('div', { class: 'adm-audit' }, loading());
    host.appendChild(h('div', { class: 'adm-two' }, [card('Weekly tournament', 'Top players by Scrolls won this week', lb), card('Most active now', 'Longest sessions among people online', act)]));
    host.appendChild(card('New sessions per day', 'Joins over the last two weeks', joins));
    host.appendChild(card('Scroll history', 'Every grant, take and event payout. Newest first.', hist));
    post({ action: 'leaderboard' }).then(function (r) { Hub.clear(lb); var l = (r && r.top) || []; if (!l.length) { lb.appendChild(empty('Nobody has won Scrolls this week yet.')); return; } l.slice(0, 10).forEach(function (x, i) { lb.appendChild(h('div', { class: 'adm-pr' }, [h('span', { class: 'rk', text: String(i + 1) }), h('div', { class: 'sp' }, h('div', { class: 'nn', text: x.nick })), h('span', { class: 'adm-coins' }, [icon('coins'), Hub.num(x.net)])])); }); });
    post({ action: 'mostactive' }).then(function (r) { Hub.clear(act); var l = ((r && r.active) || []).filter(function (x) { return x.online; }); if (!l.length) { act.appendChild(empty('Nobody is online.')); return; } l.slice(0, 10).forEach(function (x) { act.appendChild(h('div', { class: 'adm-pr' }, [h('span', { class: 'avatar', text: Hub.initials(x.nickname) }), h('div', { class: 'sp' }, [h('div', { class: 'nn', text: x.nickname }), h('div', { class: 'ss', text: Hub.clean(x.activity || 'Browsing') })]), h('span', { class: 'adm-time', text: x.sessionMin + ' min' })])); }); });
    post({ action: 'sessionstats' }).then(function (r) { var d = (r && r.joinsByDay) || {}, days = [], now = Date.now(); for (var i = 13; i >= 0; i--) { var k = new Date(now - i * 864e5).toISOString().slice(0, 10); days.push([k, d[k] || 0]); } var mx = Math.max.apply(null, days.map(function (x) { return x[1]; }).concat([1])); days.forEach(function (x, i) { joins.appendChild(h('div', { class: 'ab', title: x[0] + '  ' + x[1] + ' sessions' }, [h('i', { style: 'height:' + Math.max(3, Math.round(x[1] / mx * 100)) + '%' }), h('b', { text: i % 3 === 0 ? x[0].slice(5) : '' })])); }); });
    post({ action: 'coinhistory' }).then(function (r) { Hub.clear(hist); var l = ((r && r.history) || []).slice().reverse(); if (!l.length) { hist.appendChild(empty('No Scroll changes recorded since the last restart.')); return; } l.slice(0, 60).forEach(function (e) { hist.appendChild(h('div', { class: 'au' }, [h('span', { class: 'at', text: Hub.ago(e.ts) }), h('b', { text: e.name }), h('span', { class: 'ac', text: (e.amount >= 0 ? '+' : '') + Hub.num(e.amount) }), h('span', { class: 'ad', text: Hub.clean(e.reason || '') })])); });  });
  };

  // ---------- players ----------
  function seen(p) { return p.online ? 'Online now' : (p.lastSeen ? 'Seen ' + agoTxt(p.lastSeen) : 'Joined ' + (p.createdAt ? Hub.dateShort(p.createdAt) : 'a while ago')); }
  PANES.players = function (host) {
    var st = { q: '', filter: 'all', sort: 'recent', offset: 0, total: 0 }, PAGE = 40;
    var q = inp('Search all players by username'), list = h('div', { class: 'adm-list' }), more = h('div', { class: 'adm-row', style: 'justify-content:center;margin-top:12px' }), chips = h('div', { class: 'adm-chips' }), sortSel = h('select', { class: 'input', 'aria-label': 'Sort players', style: 'width:auto' }), live = h('div', { class: 'adm-list' }), sum = h('div', { class: 'adm-sub' });
    var sorts = [['recent', 'Online first, then recent'], ['name', 'Name A to Z'], ['joined', 'Newest accounts']]; if (isOwner()) sorts.push(['scrolls', 'Most Scrolls']);
    sorts.forEach(function (x) { sortSel.appendChild(h('option', { value: x[0], text: x[1] })); });
    var counts = {};
    function paintChips() { Hub.clear(chips); [['all', 'All'], ['online', 'Online'], ['staff', 'Staff'], ['banned', 'Banned']].forEach(function (f) { var b = h('button', { type: 'button', class: 'chip' + (st.filter === f[0] ? ' on' : ''), text: f[1] + (counts[f[0]] != null ? '  ' + Hub.num(counts[f[0]]) : '') }); b.addEventListener('click', function () { st.filter = f[0]; load(true); }); chips.appendChild(b); }); }
    function row(p) {
      var b = h('button', { type: 'button', class: 'adm-pr' }, [h('span', { class: 'avatar', text: Hub.initials(p.username) }), h('div', { class: 'sp' }, [h('div', { class: 'nn', text: p.username }), h('div', { class: 'ss', text: seen(p) + (p.online && p.activity ? '  ' + Hub.clean(p.activity) : '') })]), p.banned ? h('span', { class: 'adm-badge ban', text: 'Banned' }) : null, p.role ? badge(p.role) : null, isOwner() && p.coins != null ? h('span', { class: 'adm-coins' }, [icon('coins'), Hub.num(p.coins)]) : null, p.online ? h('span', { class: 'adm-dot', title: 'Online' }) : null, icon('chevron-right')]);
      b.addEventListener('click', function () { openPlayer(p.username, function () { load(true); }); }); return b;
    }
    function load(reset) {
      if (reset) { st.offset = 0; Hub.clear(list); list.appendChild(loading()); }
      post({ action: 'players.list', q: st.q, filter: st.filter, sort: st.sort, offset: st.offset, limit: PAGE, refresh: reset && st.refresh }).then(function (r) {
        st.refresh = false;
        if (reset) Hub.clear(list); Hub.clear(more);
        if (!r || r.error) { list.appendChild(empty('Could not load players.')); return; }
        counts = r.counts || {}; paintChips(); st.total = r.total;
        sum.textContent = Hub.num(r.total) + (r.total === 1 ? ' player' : ' players') + (st.q ? ' match' : '') + (st.filter !== 'all' ? ' (' + st.filter + ')' : '');
        if (!r.players.length && !st.offset) { list.appendChild(empty(st.q ? 'No player matches that name.' : 'No players in this view.')); return; }
        r.players.forEach(function (p) { list.appendChild(row(p)); });
        st.offset += r.players.length;
        if (st.offset < r.total) more.appendChild(btn('Show more (' + Hub.num(r.total - st.offset) + ' left)', function () { load(false); }, { ghost: true }));
      });
    }
    q.addEventListener('input', Hub.debounce(function () { st.q = q.value.trim(); load(true); }, 240));
    sortSel.addEventListener('change', function () { st.sort = sortSel.value; load(true); });
    var tools = h('div', { class: 'adm-row wrap', style: 'margin-bottom:12px' }, [h('div', { style: 'flex:1;min-width:220px' }, q), sortSel, btn('Refresh', function () { st.refresh = true; load(true); }, { ghost: true, icon: 'refresh-cw' })]);
    host.appendChild(card('All players', 'Every account on the site, online or offline. Open anyone to ' + (isOwner() ? 'give Scrolls and items, ban, reset or manage them.' : 'moderate them.'), [tools, chips, sum, list, more]));
    host.appendChild(card('Online right now', 'People on the site this minute, including guests', live));
    live.appendChild(loading());
    post({ action: 'players.live' }).then(function (r) { Hub.clear(live); var l = (r && r.players) || []; if (!l.length) { live.appendChild(empty('Nobody is online.')); return; } l.forEach(function (p) { if (!p.account) { live.appendChild(h('div', { class: 'adm-pr guest' }, [h('span', { class: 'avatar', text: Hub.initials(p.nickname) }), h('div', { class: 'sp' }, [h('div', { class: 'nn', text: p.nickname }), h('div', { class: 'ss', text: 'Guest. ' + (p.activity ? Hub.clean(p.activity) : p.location || '') + (p.ip ? '  ' + p.ip : '') })]), h('div', { class: 'adm-row' }, [btn('Kick', function () { post({ action: 'kick', id: p.id, message: 'You have been removed by staff.' }).then(function (x) { x && x.ok ? Hub.toast('Kicked ' + p.nickname) : toastErr(x); }); }, { ghost: true })])])); return; } live.appendChild(row({ username: p.nickname, online: true, activity: p.activity || p.location })); }); });
    load(true);
  };

  function openPlayer(name, onChange) {
    var body = h('div', { class: 'mbody adm-pl' }, loading()), m = Hub.modal(body, { label: 'Player ' + name });
    function load() {
      post({ action: 'player.get', username: name }).then(function (r) {
        if (!m.el.isConnected) return;
        Hub.clear(body);
        if (!r || r.error) { body.appendChild(h('h3', { text: 'Player not found' })); body.appendChild(h('p', { class: 'hint', text: (r && r.message) || 'No account with that username.' })); return; }
        draw(r.player);
      });
    }
    function draw(p) {
      var own = isOwner(), lv = p.live, c = p.casino;
      body.appendChild(h('div', { class: 'pl-head' }, [h('span', { class: 'avatar big', text: Hub.initials(p.username) }), h('div', { class: 'sp' }, [h('h3', { text: p.username }), h('div', { class: 'pl-sub' }, [badge(p.role), h('span', { text: lv && lv.online ? 'Online' + (lv.activity ? ': ' + Hub.clean(lv.activity) : '') : (p.lastSeen ? 'Offline. Seen ' + agoTxt(p.lastSeen) : 'Offline') }), p.createdAt ? h('span', { text: 'Joined ' + Hub.dateShort(p.createdAt) }) : null, p.ban ? h('span', { class: 'adm-badge ban', text: p.ban.until ? 'Banned until ' + Hub.dateShort(p.ban.until) : 'Banned for good' }) : null])])]));
      var online = !!(lv && lv.online);
      // moderation
      var note = inp('Private staff note', { value: p.note || '' });
      function liveBtn(label, fn, o) { var b = btn(label, fn, o); if (!online) { b.disabled = true; b.title = 'They need to be online'; } return b; }
      var mod = h('div', { class: 'adm-row wrap' }, [
        liveBtn('Kick', function (b) { busy(b, post({ action: 'kick', id: p.id, message: 'You have been removed by staff.' })).then(function (x) { x && x.ok ? Hub.toast('Kick sent') : toastErr(x); }); }, { ghost: true }),
        liveBtn('Mute 1h', function (b) { busy(b, post({ action: 'mute', id: p.id, minutes: 60 })).then(function (x) { x && x.ok ? Hub.toast('Muted for 1 hour') : toastErr(x); }); }, { ghost: true }),
        liveBtn('Unmute', function (b) { busy(b, post({ action: 'unmute', id: p.id })).then(function (x) { x && x.ok ? Hub.toast('Unmuted') : toastErr(x); }); }, { ghost: true }),
        liveBtn('Freeze 10m', function (b) { busy(b, post({ action: 'freeze', id: p.id, on: true, minutes: 10 })).then(function (x) { x && x.ok ? Hub.toast('Frozen for 10 minutes') : toastErr(x); }); }, { ghost: true }),
        liveBtn('Unfreeze', function (b) { busy(b, post({ action: 'freeze', id: p.id, on: false })).then(function (x) { x && x.ok ? Hub.toast('Unfrozen') : toastErr(x); }); }, { ghost: true }),
        p.ban ? (own ? btn('Lift ban', function (b) { busy(b, post({ action: 'player.unban', username: p.username })).then(function (x) { if (x && x.ok) { Hub.toast('Ban lifted'); onChange && onChange(); Hub.clear(body); load(); } else toastErr(x); }); }, { primary: true }) : null)
          : (p.role === 'owner' || (p.role === 'coowner' && !isTrueOwner() && p.username !== Hub.me.name) || (p.role === 'mod' && !own) ? null : btn(own ? 'Ban account' : 'Ban 7 days', function () { confirmBox('Ban ' + p.username + '?', own ? 'Blocks this account from signing in until you lift the ban.' : 'Blocks this account from signing in for 7 days.', 'Ban').then(function (ok) { if (ok) post({ action: 'player.ban', username: p.username, minutes: own ? 0 : 10080, reason: 'Banned by staff' }).then(function (x) { if (x && x.ok) { Hub.toast('Banned ' + p.username); onChange && onChange(); Hub.clear(body); load(); } else toastErr(x); }); }); }, { danger: true })),
      ]);
      body.appendChild(h('h4', { text: 'Moderation' })); body.appendChild(mod); if (!online) body.appendChild(h('p', { class: 'hint', text: 'Kick, mute and freeze work while they are online. Bans, notes and everything below work any time.' }));
      body.appendChild(h('div', { class: 'adm-row', style: 'margin-top:12px' }, [h('div', { style: 'flex:1' }, note), btn('Save note', function (b) { busy(b, post({ action: 'setnote', id: p.id, note: note.value })).then(function (x) { x && x.ok ? Hub.toast('Note saved') : toastErr(x); }); })]));
      if (!own) { body.appendChild(h('p', { class: 'hint', style: 'margin-top:18px', text: 'Scrolls, items and roles can only be changed by an owner.' })); return; }
      // economy
      var bal = h('div', { class: 'pl-bal' }, [icon('coins'), h('b', { text: Hub.num(c ? c.coins : 0) }), h('span', { text: 'Scrolls' })]);
      var amt = inp('Amount', { type: 'number', inputmode: 'numeric' });
      function coins(mode) { return function (b) { var n = Math.floor(Number(amt.value)); if (!(n >= 0) || (!n && mode !== 'set')) { Hub.toast('Enter an amount first', { bad: true }); return; } busy(b, post({ action: 'player.coins', username: p.username, mode: mode, amount: n })).then(function (x) { if (x && x.ok) { bal.querySelector('b').textContent = Hub.num(x.balance); c.coins = x.balance; amt.value = ''; Hub.toast((mode === 'give' ? 'Gave ' : mode === 'take' ? 'Took ' : 'Set to ') + Hub.num(n) + ' Scrolls'); if (p.username.toLowerCase() === String(Hub.me.name).toLowerCase()) Hub.loadWallet && Hub.loadWallet(); } else toastErr(x); }); }; }
      body.appendChild(h('h4', { text: 'Scrolls' }));
      body.appendChild(h('div', { class: 'pl-eco' }, [bal, h('div', { class: 'adm-row wrap grow' }, [h('div', { style: 'flex:1;min-width:140px' }, amt), btn('Give', coins('give'), { primary: true }), btn('Take', coins('take'), { ghost: true }), btn('Set to', coins('set'), { ghost: true })])]));
      // inventory
      var invBox = h('div', { class: 'pl-inv' }), items = null, byId = {};
      function paintInv() {
        Hub.clear(invBox); var inv = c.inventory || [];
        if (!inv.length) { invBox.appendChild(empty('Nothing in their inventory.')); return; }
        inv.forEach(function (id) { var it = byId[id] || { label: id, rarity: 'common' }; invBox.appendChild(h('div', { class: 'ii r-' + it.rarity }, [h('span', { text: Hub.clean(it.label) || id }), h('button', { type: 'button', class: 'x', 'aria-label': 'Remove ' + id, onclick: function () { post({ action: 'player.item', username: p.username, mode: 'take', itemId: id }).then(function (x) { if (x && x.ok) { c.inventory = x.inventory; paintInv(); Hub.toast('Removed'); } else toastErr(x); }); } }, icon('x'))])); });
      }
      var sel = h('select', { class: 'input', 'aria-label': 'Item to give' }, h('option', { value: '', text: 'Loading items' }));
      post({ action: 'store.list' }).then(function (r) {
        items = (r && r.items) || []; items.forEach(function (it) { byId[it.id] = it; });
        Hub.clear(sel); sel.appendChild(h('option', { value: '', text: 'Choose an item to give' }));
        var types = {}; items.forEach(function (it) { (types[it.type] = types[it.type] || []).push(it); });
        Object.keys(types).forEach(function (t) { var g = h('optgroup', { label: t.charAt(0).toUpperCase() + t.slice(1) }); types[t].forEach(function (it) { g.appendChild(h('option', { value: it.id, text: (Hub.clean(it.label) || it.id) + '  (' + it.rarity + ')' })); }); sel.appendChild(g); });
        paintInv();
      });
      body.appendChild(h('h4', { text: 'Inventory' })); body.appendChild(invBox);
      body.appendChild(h('div', { class: 'adm-row wrap', style: 'margin-top:12px' }, [h('div', { style: 'flex:1;min-width:180px' }, sel), btn('Give item', function (b) { if (!sel.value) { Hub.toast('Choose an item first', { bad: true }); return; } busy(b, post({ action: 'player.item', username: p.username, mode: 'give', itemId: sel.value })).then(function (x) { if (x && x.ok) { c.inventory = x.inventory; paintInv(); Hub.toast('Item given'); } else toastErr(x); }); }, { primary: true }), btn('Give everything', function (b) { confirmBox('Give every item?', p.username + ' will own every item in the store.', 'Give everything').then(function (ok) { if (ok) busy(b, post({ action: 'player.item', username: p.username, mode: 'giveall' })).then(function (x) { if (x && x.ok) { c.inventory = x.inventory; paintInv(); Hub.toast('Everything given'); } else toastErr(x); }); }); }, { ghost: true }), btn('Clear all', function (b) { confirmBox('Clear inventory?', 'This removes every item ' + p.username + ' owns.', 'Clear').then(function (ok) { if (ok) busy(b, post({ action: 'player.item', username: p.username, mode: 'clear' })).then(function (x) { if (x && x.ok) { c.inventory = []; paintInv(); Hub.toast('Inventory cleared'); } else toastErr(x); }); }); }, { danger: true })]));
      // rewards + account
      var streak = inp('Streak', { type: 'number', value: c ? c.streak : 0, inputmode: 'numeric' });
      body.appendChild(h('h4', { text: 'Daily reward' }));
      body.appendChild(h('div', { class: 'adm-row wrap' }, [h('div', { style: 'width:120px' }, streak), btn('Set streak', function (b) { busy(b, post({ action: 'player.streak', username: p.username, value: Number(streak.value) || 0 })).then(function (x) { x && x.ok ? Hub.toast('Streak set') : toastErr(x); }); }), btn('Make reward claimable now', function (b) { busy(b, post({ action: 'player.dailyReset', username: p.username })).then(function (x) { x && x.ok ? Hub.toast('Daily reward is ready for them') : toastErr(x); }); }, { ghost: true })]));
      body.appendChild(h('h4', { text: 'Account' }));
      var isMod = p.role === 'mod', isCo = p.role === 'coowner', fixed = p.role === 'owner' || (isCo && !isTrueOwner() && p.username !== Hub.me.name);
      function setRole(b, rl, msg) { busy(b, post({ action: 'staff.setrole', username: p.username, role: rl })).then(function (x) { if (x && x.ok) { Hub.toast(msg); Hub.clear(body); load(); } else toastErr(x); }); }
      body.appendChild(h('div', { class: 'adm-row wrap' }, [
        isTrueOwner() && p.role !== 'owner' ? btn(isMod ? 'Remove moderator' : 'Make moderator', function (b) { setRole(b, isMod ? 'none' : 'mod', isMod ? 'Moderator removed' : p.username + ' is now a moderator'); }, { primary: !isMod && !isCo, ghost: isMod }) : null,
        isTrueOwner() && p.role !== 'owner' ? btn(isCo ? 'Switch to moderator' : 'Make co-owner', function (b) { setRole(b, isCo ? 'mod' : 'coowner', isCo ? p.username + ' is now a moderator' : p.username + ' is now a co-owner'); }, { primary: !isCo, ghost: isCo }) : null,
        isTrueOwner() && isCo ? btn('Remove co-owner', function (b) { setRole(b, 'none', 'Co-owner removed'); }, { ghost: true }) : null,
        btn('Sign out everywhere', function (b) { confirmBox('Reset ' + p.username + '\'s login?', 'Every device signed in as them is signed out. Their password is unchanged.', 'Sign out').then(function (ok) { if (ok) busy(b, post({ action: 'player.signout', username: p.username })).then(function (x) { x && x.ok ? Hub.toast('Signed out everywhere') : toastErr(x); }); }); }, { ghost: true }),
        fixed ? null : btn('Reset profile', function (b) { confirmBox('Reset ' + p.username + '\'s profile?', 'Wipes their Scrolls, items, stats and streak back to a new account. This cannot be undone.', 'Reset profile').then(function (ok) { if (ok) busy(b, post({ action: 'player.resetProfile', username: p.username })).then(function (x) { if (x && x.ok) { Hub.toast('Profile reset'); Hub.clear(body); load(); } else toastErr(x); }); }); }, { danger: true }),
      ]));
      // live effects + chat power
      var fxBox = h('div', { class: 'adm-chips' }), ftxt = inp('Text for popup or message');
      [['popup', 'Popup'], ['message', 'Message'], ['shake', 'Shake'], ['flash', 'Flash'], ['tabtitle', 'Tab title'], ['jumpscare', 'Jump scare'], ['rickroll', 'Rickroll']].forEach(function (f) { var b = btn(f[1], function () { post({ action: 'command', id: p.id, cmd: { type: f[0], text: ftxt.value, title: ftxt.value } }).then(function (x) { x && x.ok ? Hub.toast(f[1] + ' sent') : toastErr(x); }); }, { ghost: true }); if (!online) { b.disabled = true; } fxBox.appendChild(b); });
      body.appendChild(h('h4', { text: 'Send to their screen' })); body.appendChild(h('div', { style: 'margin-bottom:10px' }, ftxt)); body.appendChild(fxBox);
      body.appendChild(h('div', { style: 'margin-top:14px' }, Hub.toggle('Chat powers', 'Lets them delete chat messages and run chat tools.', !!p.chatOwner, function (v) { post({ action: 'setowner', id: p.id, on: v }).then(function (x) { x && x.ok ? Hub.toast(v ? 'Chat powers on' : 'Chat powers off') : toastErr(x); }); })));
    }
    load();
  }

  // ---------- economy (owner) ----------
  PANES.economy = function (host) {
    var all = inp('Amount', { type: 'number', inputmode: 'numeric' });
    host.appendChild(card('Give Scrolls to everyone', 'An event gift. Lands on every account, online or not.', h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:160px' }, all), btn('Give to all accounts', function (b) { var n = Math.floor(Number(all.value)); if (!(n > 0)) { Hub.toast('Enter an amount first', { bad: true }); return; } confirmBox('Give ' + Hub.num(n) + ' Scrolls to everyone?', 'Every account receives this amount.', 'Give').then(function (ok) { if (ok) busy(b, post({ action: 'giveallaccounts', amount: n })).then(function (x) { x && x.ok ? Hub.toast('Sent to ' + Hub.num(x.count) + ' accounts') : toastErr(x); }); }); }, { primary: true })])));
    // codes
    var codes = h('div', { class: 'adm-list' }), cAmt = inp('Scrolls per claim', { type: 'number', inputmode: 'numeric' }), cMax = inp('Max claims (blank is unlimited)', { type: 'number', inputmode: 'numeric' }), cName = inp('Code (blank makes one)');
    function paintCodes(list) { Hub.clear(codes); if (!list || !list.length) { codes.appendChild(empty('No event codes.')); return; } list.forEach(function (c) { codes.appendChild(h('div', { class: 'adm-pr' }, [h('div', { class: 'sp' }, [h('div', { class: 'nn mono', text: c.code }), h('div', { class: 'ss', text: Hub.num(c.amount) + ' Scrolls. ' + (c.max ? (c.used || 0) + ' of ' + c.max + ' claimed' : 'Unlimited') })]), btn('Delete', function () { post({ action: 'deletecode', code: c.code }).then(function (x) { paintCodes(x && x.codes); }); }, { ghost: true })])); }); }
    host.appendChild(card('Event codes', 'Players redeem these from their profile menu.', [h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:130px' }, cName), h('div', { style: 'flex:1;min-width:130px' }, cAmt), h('div', { style: 'flex:1;min-width:130px' }, cMax), btn('Create', function (b) { var amount = Math.floor(Number(cAmt.value)); if (!(amount > 0)) { Hub.toast('Enter the Scrolls amount', { bad: true }); return; } busy(b, post({ action: 'createcode', code: cName.value.trim(), amount: amount, max: Math.floor(Number(cMax.value)) || 0 })).then(function (x) { if (x && x.ok) { Hub.toast('Code ' + x.code.code + ' created'); cName.value = cAmt.value = cMax.value = ''; paintCodes(x.codes); } else toastErr(x); }); }, { primary: true })]), codes]));
    post({ action: 'listcodes' }).then(function (x) { paintCodes(x && x.codes); });
    // tournament
    var p1 = inp('1st', { type: 'number' }), p2 = inp('2nd', { type: 'number' }), p3 = inp('3rd', { type: 'number' });
    host.appendChild(card('Weekly tournament', 'Prizes for the top three players of the week.', h('div', { class: 'adm-row wrap' }, [h('div', { style: 'width:110px' }, p1), h('div', { style: 'width:110px' }, p2), h('div', { style: 'width:110px' }, p3), btn('Save prizes', function (b) { busy(b, post({ action: 'tourprizes', p1: Number(p1.value) || 0, p2: Number(p2.value) || 0, p3: Number(p3.value) || 0 })).then(function (x) { x && x.ok ? Hub.toast('Prizes saved') : toastErr(x); }); }), btn('End the week now', function (b) { confirmBox('End the week now?', 'Pays out the current top three immediately.', 'End week').then(function (ok) { if (ok) busy(b, post({ action: 'endweek' })).then(function (x) { x && x.ok ? Hub.toast('Week ended') : toastErr(x); }); }); }, { ghost: true })])));
    post({ action: 'tourstate' }).then(function (x) { var pr = x && x.tour && x.tour.prizes; if (pr) { p1.value = pr[0]; p2.value = pr[1]; p3.value = pr[2]; } });
  };

  // ---------- staff ----------
  PANES.staff = function (host) {
    var list = h('div', { class: 'adm-list' });
    function paint(staff) {
      Hub.clear(list);
      (staff || []).forEach(function (s) { list.appendChild(h('div', { class: 'adm-pr' }, [h('span', { class: 'avatar', text: Hub.initials(s.username) }), h('div', { class: 'sp' }, [h('div', { class: 'nn', text: s.username }), h('div', { class: 'ss', text: s.role === 'owner' ? 'Owner. Full access.' : s.role === 'coowner' ? 'Co-owner. Almost full access.' : 'Moderator' })]), badge(s.role), isTrueOwner() && s.role === 'mod' ? btn('Make co-owner', function (b) { busy(b, post({ action: 'staff.setrole', username: s.username, role: 'coowner' })).then(function (x) { if (x && x.ok) { Hub.toast(s.username + ' is now a co-owner'); paint(x.staff); } else toastErr(x); }); }, { ghost: true }) : null, isTrueOwner() && s.role === 'coowner' ? btn('Switch to mod', function (b) { busy(b, post({ action: 'staff.setrole', username: s.username, role: 'mod' })).then(function (x) { if (x && x.ok) { Hub.toast(s.username + ' is now a moderator'); paint(x.staff); } else toastErr(x); }); }, { ghost: true }) : null, isTrueOwner() && (s.role === 'mod' || s.role === 'coowner') ? btn('Remove', function (b) { confirmBox('Remove ' + s.username + ' as ' + (s.role === 'coowner' ? 'co-owner' : 'moderator') + '?', 'They lose the staff panel right away.', 'Remove').then(function (ok) { if (ok) busy(b, post({ action: 'staff.setrole', username: s.username, role: 'none' })).then(function (x) { if (x && x.ok) { Hub.toast('Removed'); paint(x.staff); } else toastErr(x); }); }); }, { ghost: true }) : null])); });
      if (!staff || !staff.length) list.appendChild(empty('No staff yet.'));
    }
    host.appendChild(card('Staff', 'Everyone who can open Admin tools.', list));
    post({ action: 'staff.list' }).then(function (r) { paint(r && r.staff); });
    if (isTrueOwner()) {
      var who = inp('Username to give a staff role'), res = h('div', { class: 'adm-list' });
      var deb = Hub.debounce(function () { var t = who.value.trim(); if (t.length < 2) { Hub.clear(res); return; } post({ action: 'players.search', q: t }).then(function (r) { Hub.clear(res); ((r && r.players) || []).slice(0, 5).forEach(function (p) { res.appendChild(h('button', { type: 'button', class: 'adm-pr', onclick: function () { who.value = p.username; Hub.clear(res); } }, [h('span', { class: 'avatar', text: Hub.initials(p.username) }), h('div', { class: 'sp' }, h('div', { class: 'nn', text: p.username })), p.role ? badge(p.role) : null])); }); }); }, 220);
      who.addEventListener('input', deb);
      host.appendChild(card('Grant a staff role', 'Moderators get the Moderator panel. Co-owners get nearly everything you have. Neither can give roles to anyone else, and you can switch a person between the two at any time.', [h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:200px' }, who), btn('Make moderator', function (b) { var n = who.value.trim(); if (!n) { Hub.toast('Enter a username', { bad: true }); return; } busy(b, post({ action: 'staff.setrole', username: n, role: 'mod' })).then(function (x) { if (x && x.ok) { Hub.toast(n + ' is now a moderator'); who.value = ''; paint(x.staff); } else toastErr(x); }); }, { primary: true }), btn('Make co-owner', function (b) { var n = who.value.trim(); if (!n) { Hub.toast('Enter a username', { bad: true }); return; } busy(b, post({ action: 'staff.setrole', username: n, role: 'coowner' })).then(function (x) { if (x && x.ok) { Hub.toast(n + ' is now a co-owner'); who.value = ''; paint(x.staff); } else toastErr(x); }); }, { ghost: true })]), res]));
    }
    var yes = '#i-check', rows = [['See who is online and open player profiles', 1, 1, 1], ['Kick, mute and freeze players', 1, 1, 1], ['Timed bans (mods up to 7 days)', 1, 1, 1], ['Announcements and chat tools', 1, 1, 1], ['Permanent bans and lifting bans', 0, 1, 1], ['Give or take Scrolls and items', 0, 1, 1], ['Reset a login or profile', 0, 1, 1], ['Toolbox, casino and site controls, audit log', 0, 1, 1], ['Act on the owner or another co-owner', 0, 0, 1], ['Grant, switch or remove staff roles', 0, 0, 1]];
    var tbl = h('div', { class: 'adm-perm' }, [h('div', { class: 'pr head' }, [h('span', { text: 'Permission' }), h('span', { text: 'Mod' }), h('span', { text: 'Co-owner' }), h('span', { text: 'Owner' })])]);
    rows.forEach(function (r) { tbl.appendChild(h('div', { class: 'pr' }, [h('span', { text: r[0] }), h('span', { class: r[1] ? 'y' : 'n' }, r[1] ? icon('check') : h('i')), h('span', { class: r[2] ? 'y' : 'n' }, r[2] ? icon('check') : h('i')), h('span', { class: r[3] ? 'y' : 'n' }, r[3] ? icon('check') : h('i'))])); });
    host.appendChild(card('What each role can do', '', tbl));
  };

  // ---------- announcements ----------
  PANES.announce = function (host) {
    var t = inp('Title'), c = h('textarea', { class: 'input', placeholder: 'Message', rows: '3', maxlength: '1000' }), imp = false, list = h('div', { class: 'adm-list' });
    function paint(l) { Hub.clear(list); if (!l || !l.length) { list.appendChild(empty('No announcements.')); return; } l.slice().reverse().forEach(function (a) { list.appendChild(h('div', { class: 'adm-pr' }, [h('div', { class: 'sp' }, [h('div', { class: 'nn', text: a.title }), h('div', { class: 'ss', text: a.content })]), btn('Delete', function () { post({ action: 'delannounce', id: a.id }).then(function () { load(); }); }, { ghost: true })])); }); }
    function load() { post({ action: 'state' }).then(function (r) { paint(r && r.announcements); }); }
    host.appendChild(card('New announcement', 'Shows in the notification bell for everyone.', [field('Title', t), field('Message', c), h('div', { class: 'adm-row' }, [Hub.toggle('Mark as important', '', false, function (v) { imp = v; })]), h('div', { class: 'adm-row' }, [btn('Post announcement', function (b) { if (!t.value.trim() && !c.value.trim()) { Hub.toast('Write something first', { bad: true }); return; } busy(b, post({ action: 'announce', title: t.value, content: c.value, important: imp })).then(function (x) { if (x && x.ok) { Hub.toast('Announcement posted'); t.value = c.value = ''; load(); } else toastErr(x); }); }, { primary: true })])]));
    var bc = inp('A short message everyone sees once');
    host.appendChild(card('Broadcast banner', 'A one-time pop-up for everyone online right now.', h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:220px' }, bc), btn('Send', function (b) { busy(b, post({ action: 'broadcast', text: bc.value })).then(function (x) { if (x && x.ok) { Hub.toast(bc.value ? 'Broadcast sent' : 'Broadcast cleared'); bc.value = ''; } else toastErr(x); }); }, { primary: true })])));
    if (isOwner()) {
      var ft = inp('Text (for popup, message or tab title)'), fx = h('div', { class: 'adm-chips' });
      [['popup', 'Popup'], ['message', 'Message'], ['shake', 'Shake'], ['flash', 'Flash'], ['tabtitle', 'Tab title'], ['rickroll', 'Rickroll'], ['jumpscare', 'Jump scare']].forEach(function (f) { fx.appendChild(btn(f[1], function () { confirmBox('Send "' + f[1] + '" to everyone online?', 'It plays on every screen right now.', 'Send').then(function (ok) { if (ok) post({ action: 'sendall', cmd: { type: f[0], text: ft.value, title: ft.value } }).then(function (x) { x && x.ok ? Hub.toast('Sent to ' + x.sent + ' players') : toastErr(x); }); }); }, { ghost: true })); });
      host.appendChild(card('Screen effects for everyone', 'Plays once on every screen that is online right now.', [h('div', { style: 'margin-bottom:10px' }, ft), fx]));
    }
    host.appendChild(card('Posted announcements', '', list)); load();
  };

  // ---------- moderation ----------
  PANES.moderation = function (host) {
    var reps = h('div', { class: 'adm-list' }), bans = h('div', { class: 'adm-list' }), log = h('div', { class: 'adm-log' }), words = h('div', { class: 'adm-tags' }), ch = h('select', { class: 'input' });
    function loadReports() { post({ action: 'reports' }).then(function (r) { Hub.clear(reps); var l = (r && r.reports) || []; if (!l.length) { reps.appendChild(empty('No open reports.')); return; } l.slice(0, 30).forEach(function (x) { reps.appendChild(h('div', { class: 'adm-pr' }, [h('div', { class: 'sp' }, [h('div', { class: 'nn', text: (x.fromName || x.from || 'Someone') + ' reported ' + (x.targetName || x.target || 'a player') }), h('div', { class: 'ss', text: Hub.clean(x.reason || x.text || '') + (x.ts ? '  ' + agoTxt(x.ts) : '') })])])); }); if (l.length) reps.appendChild(h('div', { class: 'adm-row', style: 'margin-top:10px' }, btn('Clear all reports', function () { post({ action: 'clearreports' }).then(loadReports); }, { ghost: true }))); }); }
    function loadBans() { post({ action: 'state' }).then(function (r) { Hub.clear(bans); var l = (r && r.bans) || []; if (!l.length) { bans.appendChild(empty('No active bans.')); return; } l.forEach(function (b) { bans.appendChild(h('div', { class: 'adm-pr' }, [h('div', { class: 'sp' }, [h('div', { class: 'nn', text: b.nickname || 'Unknown' }), h('div', { class: 'ss', text: (b.reason || 'No reason') + '  ' + (b.until ? 'until ' + Hub.dateShort(b.until) : 'permanent') })]), isOwner() ? btn('Unban', function () { post({ action: 'unban', ip: b.ip }).then(function () { Hub.toast('Unbanned'); loadBans(); }); }, { ghost: true }) : null])); }); }); }
    function loadLog() { post({ action: 'chatlog', channel: ch.value || 'general' }).then(function (r) { if (r && r.channels && !ch.children.length) { r.channels.forEach(function (c) { ch.appendChild(h('option', { value: c.id || c.name, text: '#' + (c.name || c.id) })); }); ch.value = r.channel; } Hub.clear(log); var l = (r && r.messages) || []; if (!l.length) { log.appendChild(empty('No messages in this channel.')); return; } l.slice(-60).reverse().forEach(function (m) { log.appendChild(h('div', { class: 'lm' }, [h('b', { text: Hub.clean(m.nick || m.username || m.author || 'Guest') }), h('span', { text: Hub.clean(m.text || m.content || '') }), h('button', { type: 'button', class: 'x', 'aria-label': 'Delete message', onclick: function () { post({ action: 'deletemsg', channel: ch.value || 'general', msgId: m.id }).then(function () { loadLog(); }); } }, icon('trash-2'))])); }); }); }
    ch.addEventListener('change', loadLog);
    function loadWords() { post({ action: 'wordfilterlist' }).then(function (r) { Hub.clear(words); ((r && r.wordFilter) || []).forEach(function (w) { words.appendChild(h('span', { class: 'tg' }, [w, h('button', { type: 'button', 'aria-label': 'Remove ' + w, onclick: function () { post({ action: 'removeword', word: w }).then(loadWords); } }, icon('x'))])); }); if (!words.children.length) words.appendChild(empty('No filtered words.')); }); }
    var nw = inp('Add a filtered word');
    host.appendChild(card('Reports', 'Players report each other from their profiles.', reps));
    host.appendChild(card('Active bans', isOwner() ? 'Lift a ban here.' : 'Only owners can lift a ban.', bans));
    host.appendChild(card('Chat log', 'Read a channel and remove messages.', [h('div', { style: 'max-width:260px;margin-bottom:12px' }, ch), log]));
    host.appendChild(card('Word filter', 'Messages with these words are blocked.', [h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:180px' }, nw), btn('Add word', function () { if (!nw.value.trim()) return; post({ action: 'addword', word: nw.value }).then(function () { nw.value = ''; loadWords(); }); }, { primary: true })]), words]));
    var slowSec = inp('Seconds between messages (0 is off)', { type: 'number', inputmode: 'numeric' });
    host.appendChild(card('Slow mode', 'Limits how often people can post in the selected chat channel.', h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:200px' }, slowSec), btn('Apply to channel', function (b) { busy(b, post({ action: 'setslow', channel: ch.value || 'general', seconds: Number(slowSec.value) || 0 })).then(function (x) { x && x.ok ? Hub.toast('Slow mode set to ' + x.seconds + 's') : toastErr(x); }); }, { primary: true })])));
    if (isOwner()) {
      var bulk = function (what, label, text) { return btn(label, function (b) { confirmBox(label + '?', text, label).then(function (ok) { if (ok) busy(b, post({ action: 'bulkaction', what: what })).then(function (x) { x && x.ok ? Hub.toast(label + ' done' + (x.count != null ? ' (' + x.count + ')' : '')) : toastErr(x); }); }); }, { danger: what !== 'unfreezeall', ghost: what === 'unfreezeall' }); };
      host.appendChild(card('Bulk actions', 'Act on everyone who is online right now.', h('div', { class: 'adm-row wrap' }, [bulk('kickguests', 'Kick all guests', 'Every guest is removed. Signed-in players stay.'), bulk('kickall', 'Kick everyone', 'Every player is removed, including signed-in ones.'), bulk('freezeall', 'Freeze everyone', 'Nobody can move or act until unfrozen.'), bulk('unfreezeall', 'Unfreeze everyone', '')])));
      var ip = inp('Network address, like 203.0.113.9'), ipm = inp('Minutes (blank is permanent)', { type: 'number' }), ipr = inp('Reason');
      host.appendChild(card('Ban a network address', 'Blocks a network address even if nobody is online from it. Lift it from Active bans.', h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:180px' }, ip), h('div', { style: 'width:150px' }, ipm), h('div', { style: 'flex:1;min-width:140px' }, ipr), btn('Ban address', function (b) { if (!ip.value.trim()) { Hub.toast('Enter an address', { bad: true }); return; } busy(b, post({ action: 'ipbanraw', ip: ip.value.trim(), minutes: Number(ipm.value) || 0, reason: ipr.value })).then(function (x) { if (x && x.ok) { Hub.toast('Address banned'); ip.value = ipm.value = ipr.value = ''; loadBans(); } else toastErr(x); }); }, { danger: true })])));
    }
    loadReports(); loadBans(); loadLog(); loadWords();
  };

  // ---------- site controls (owner) ----------
  PANES.site = function (host) {
    host.appendChild(loading());
    post({ action: 'state' }).then(function (r) {
      Hub.clear(host); var s = (r && r.settings) || {};
      function set(k, v) { var o = {}; o[k] = v; return post({ action: 'settings', settings: o }).then(function (x) { x && x.ok ? Hub.toast('Saved') : toastErr(x); }); }
      host.appendChild(card('Availability', 'Turn the whole site off for maintenance.', [Hub.toggle('Maintenance mode', 'Visitors see a maintenance page. Staff still get in.', !!s.maintenance, function (v) { set('maintenance', v); })]));
      // ---- Bandwidth meter (owner): this month's outbound data against Render's free cap ----
      function fmtB(n) { n = +n || 0; var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0; while (n >= 1024 && i < 4) { n /= 1024; i++; } return (i > 1 ? n.toFixed(2) : Math.round(n)) + ' ' + u[i]; }
      var bw = h('div');
      function paintBw() {
        post({ action: 'traffic' }).then(function (x) {
          Hub.clear(bw); if (!x || !x.ok) { bw.appendChild(empty('Could not load the bandwidth numbers.')); return; }
          var pct = Math.min(100, x.bytes / x.capBytes * 100), tone = pct > 85 ? 'var(--bad)' : pct > 60 ? 'var(--warn)' : 'var(--ok)';
          bw.appendChild(h('div', { style: 'display:flex;align-items:baseline;gap:10px;flex-wrap:wrap' }, [h('b', { style: 'font-size:28px;font-variant-numeric:tabular-nums', text: fmtB(x.bytes) }), h('span', { class: 'hint', style: 'margin:0', text: 'sent this month (' + x.month + ') of the ' + fmtB(x.capBytes) + ' free cap, ' + pct.toFixed(1) + '% used' })]));
          bw.appendChild(h('div', { style: 'height:10px;border-radius:6px;background:rgba(150,185,255,.16);overflow:hidden;margin:10px 0 14px' }, h('i', { style: 'display:block;height:100%;width:' + pct + '%;background:' + tone + ';border-radius:6px' })));
          var labels = { site: 'Pages and game files', images: 'Game pictures', api: 'API calls', proxy: 'Proxy tunnel (Wisp)', games: 'Live game connections', upstream: 'Files fetched for missing games' }, cats = Object.keys(x.cats || {}).sort(function (a, b) { return x.cats[b] - x.cats[a]; });
          var list = h('div', { class: 'adm-list' });
          cats.forEach(function (k) { list.appendChild(h('div', { class: 'adm-pr' }, [h('div', { class: 'sp' }, [h('b', { text: labels[k] || k })]), h('span', { text: fmtB(x.cats[k]) + '  ·  ' + (x.bytes ? Math.round(x.cats[k] / x.bytes * 100) : 0) + '%' })])); });
          if (!cats.length) list.appendChild(empty('Nothing counted yet this month.'));
          bw.appendChild(list);
          var days = Object.keys(x.days || {}).sort().slice(-7); if (days.length) bw.appendChild(h('p', { class: 'hint', style: 'margin-top:14px', text: 'Last days: ' + days.map(function (d) { return d.slice(5) + ' ' + fmtB(x.days[d]); }).join('  ·  ') }));
          if (x.top && x.top.length) { bw.appendChild(h('h4', { style: 'margin:18px 0 8px', text: 'Heaviest files since the server last restarted' })); var tl = h('div', { class: 'adm-list' }); x.top.slice(0, 10).forEach(function (t) { tl.appendChild(h('div', { class: 'adm-pr' }, [h('div', { class: 'sp' }, [h('span', { text: t.path, style: 'word-break:break-all' })]), h('span', { text: fmtB(t.bytes) })])); }); bw.appendChild(tl); }
          bw.appendChild(h('p', { class: 'hint', style: 'margin-top:12px', text: 'Live connections (' + x.openSockets + ' open) are counted every 20 seconds. Render may bill on a different monthly cycle than the calendar month shown here.' }));
        });
      }
      host.appendChild(card('Bandwidth', 'How much data the site has sent. Render\'s free plan suspends everything when the monthly cap runs out.', [bw, h('div', { class: 'adm-row', style: 'margin-top:12px' }, btn('Refresh', paintBw))]));
      paintBw();

      // ---- Welcome tour (owner) ----
      var tourBox = h('div'), tourRw = inp('Reward in Scrolls', { type: 'number' }), tourUser = inp('Username'), payAgain = false;
      function paintTour(x) {
        Hub.clear(tourBox); if (!x || !x.ok) { tourBox.appendChild(empty('Could not load the tour settings.')); return; }
        var c = x.counts;
        tourBox.appendChild(h('p', { class: 'hint', text: 'Version ' + x.version + '. Finished: ' + c.done + '. In progress: ' + c.started + '. Will see it next visit: ' + c.pending + '. Profiles: ' + c.total + '.' }));
        tourBox.appendChild(Hub.toggle('Show the tour', 'New and returning players get the guided tour once per version.', x.on, function (v) { post({ action: 'tour.set', on: v }).then(function (r) { r && r.ok ? Hub.toast(v ? 'Tour is on' : 'Tour is off') : toastErr(r); }); }));
        tourRw.value = String(x.reward);
        tourBox.appendChild(h('div', { class: 'adm-row wrap', style: 'margin:14px 0' }, [h('div', { style: 'flex:1;min-width:200px' }, field('Reward for finishing (once per player)', tourRw)), btn('Save reward', function () { post({ action: 'tour.set', reward: tourRw.value }).then(function (r) { r && r.ok ? (Hub.toast('Reward saved'), paintTour(r)) : toastErr(r); }); }, { primary: true })]));
        tourBox.appendChild(h('div', { class: 'adm-row wrap' }, [btn('Replay the tour for everyone', function () { confirmBox('Replay the tour for everyone?', 'Every player sees the tour again on their next visit. Players who already got the reward do not get it a second time.', 'Replay').then(function (ok) { if (!ok) return; post({ action: 'tour.replay' }).then(function (r) { r && r.ok ? (Hub.toast('Tour will replay for everyone'), paintTour(r)) : toastErr(r); }); }); })]));
        tourBox.appendChild(h('h4', { style: 'margin:18px 0 8px', text: 'Reset one player' }));
        tourBox.appendChild(h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:180px' }, tourUser), btn('Reset their tour', function () { var u = tourUser.value.trim(); if (!u) return; post({ action: 'tour.reset', username: u, payAgain: payAgain }).then(function (r) { r && r.ok ? (Hub.toast('Reset for ' + u), paintTour(r)) : toastErr(r); }); })]));
        tourBox.appendChild(Hub.toggle('Let them earn the reward again', 'Off: they replay the tour but are not paid twice.', payAgain, function (v) { payAgain = v; }));
      }
      host.appendChild(card('Welcome tour', 'The guided tour new players go through, ending with a few casino rounds and a reward.', tourBox));
      post({ action: 'tour.get' }).then(paintTour);

      // ---- Site look (owner): the default background / accent for everyone, optionally forced ----
      var look = h('div'), lk = Object.assign({ bg: 'video', accent: '', url: '', dim: 0, force: false }, s.theme || {});
      function paintLook() {
        Hub.clear(look);
        look.appendChild(Hub.themePicker({ bg: lk.bg, accent: lk.accent || 'blue', dim: lk.dim, url: lk.url, urlBox: true, onChange: function (part) { for (var k in part) lk[k] = part[k]; if (lk.accent === 'blue' || lk.accent === 'auto') lk.accent = ''; } }));
        look.appendChild(Hub.toggle('Force for everyone', 'On: players cannot pick their own background or accent. Off: this is only the default.', !!lk.force, function (v) { lk.force = v; }));
        look.appendChild(h('div', { class: 'adm-row wrap', style: 'margin-top:14px' }, [btn('Save site look', function () { post({ action: 'theme.set', theme: lk }).then(function (r) { if (r && r.ok) { Hub.toast('Site look saved'); Hub.loadSchool && Hub.loadSchool(); } else toastErr(r); }); }, { primary: true }), btn('Reset to default', function () { lk = { bg: 'video', accent: '', url: '', dim: 0, force: false }; post({ action: 'theme.set', theme: lk }).then(function (r) { if (r && r.ok) { Hub.toast('Back to the default look'); Hub.loadSchool && Hub.loadSchool(); paintLook(); } else toastErr(r); }); })]));
      }
      paintLook();
      host.appendChild(card('Site look', 'The background and accent color new visitors see. Players can still choose their own unless you force it.', look));

      var mins = inp('Minutes (blank is until turned off)', { type: 'number' });
      host.appendChild(card('School Mode', 'Hides games that are not on the school list.', [Hub.toggle('School Mode', 'Limits what players can open.', !!s.schoolMode, function (v) { set('schoolMode', v); }), Hub.toggle('Quiz questions', 'Players answer questions before playing.', s.schoolQuiz !== false, function (v) { set('schoolQuiz', v); }), Hub.toggle('Allow the casino', 'Unlocks the casino during School Mode.', !!s.schoolGamble, function (v) { set('schoolGamble', v); }), h('div', { class: 'adm-row wrap', style: 'margin-top:8px' }, [h('div', { style: 'width:min(300px,100%)' }, mins), btn('Turn on for a while', function () { var n = Number(mins.value); if (n > 0) set('schoolMins', n); }, { ghost: true })])]));
      var sets = [['blooket', 'Blooket'], ['u9', 'Unit 9'], ['u10', 'Unit 10'], ['both', 'Units 9 and 10']];
      host.appendChild(card('School Mode question set', 'Which set the quiz questions come from.', h('div', { class: 'adm-chips' }, sets.map(function (x) { var b = h('button', { type: 'button', class: 'chip' + ((s.schoolSet || 'blooket') === x[0] ? ' on' : ''), text: x[1] }); b.addEventListener('click', function () { set('schoolSet', x[0]); $$('.chip', b.parentNode).forEach(function (e) { e.classList.remove('on'); }); b.classList.add('on'); }); return b; }))));
      var seasons = [['', 'Off'], ['xmas', 'Winter'], ['halloween', 'Halloween'], ['thanksgiving', 'Thanksgiving'], ['newyear', 'New Year'], ['valentines', 'Valentines'], ['stpatricks', 'St Patricks'], ['easter', 'Easter'], ['july4', 'July 4th'], ['summer', 'Summer']];
      host.appendChild(card('Season', 'Decorations and the home page season tile.', h('div', { class: 'adm-chips' }, seasons.map(function (x) { var b = h('button', { type: 'button', class: 'chip' + ((s.season == null ? 'xmas' : s.season) === x[0] ? ' on' : ''), text: x[1] }); b.addEventListener('click', function () { set('season', x[0]); $$('.chip', b.parentNode).forEach(function (e) { e.classList.remove('on'); }); b.classList.add('on'); }); return b; }))));
      var fx = ['disco', 'matrix', 'snow', 'confetti', 'strobe', 'invert', 'spin', 'bounce'], cur = s.takeover && s.takeover.mode;
      host.appendChild(card('Site-wide effect', 'A visual effect shown to everyone until you turn it off.', h('div', { class: 'adm-chips' }, [btn('Off', function () { post({ action: 'takeover', mode: '' }).then(function () { Hub.toast('Effect off'); }); }, { ghost: true })].concat(fx.map(function (m) { return btn(m.charAt(0).toUpperCase() + m.slice(1), function () { post({ action: 'takeover', mode: m }).then(function () { Hub.toast(m + ' is on'); }); }, { ghost: m !== cur }); })))));
      var rd = inp('Redirect everyone to a link (blank is off)', { value: s.redirect || '' });
      host.appendChild(card('Redirect', 'Sends every visitor to another address.', h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:220px' }, rd), btn('Save', function () { set('redirect', rd.value.trim()); }, { primary: true })])));
      var dsSel = h('select', { class: 'input', 'aria-label': 'Default Discord server' });
      post({ action: 'discord.servers' }).then(function (x) { if (!x || !x.ok) return; (x.guilds || []).forEach(function (g) { var o = h('option', { value: g.id, text: g.name + ' (' + g.members + ' members)' }); if (g.id === x.defaultId) o.selected = true; dsSel.appendChild(o); }); });
      host.appendChild(card('Default Discord server', 'Every new account joins this server automatically.', [h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:240px' }, dsSel), btn('Make default and add everyone', function (b) { confirmBox('Add everyone?', 'Every account will be added to this server and new accounts will join it automatically.', 'Do it').then(function (ok) { if (ok) busy(b, post({ action: 'discord.setdefault', id: dsSel.value, everyone: true })).then(function (x) { x && x.ok ? Hub.toast('Default set, ' + x.added + ' accounts added') : toastErr(x); }); }); }, { primary: true }), btn('Make default only', function (b) { busy(b, post({ action: 'discord.setdefault', id: dsSel.value, everyone: false })).then(function (x) { x && x.ok ? Hub.toast('Default set') : toastErr(x); }); }, { ghost: true })])]));
      host.appendChild(card('Reset nicknames', 'Everyone is asked to pick a nickname again on their next visit.', btn('Reset nicknames', function (b) { confirmBox('Reset all nicknames?', 'Everyone picks a nickname again on their next visit.', 'Reset').then(function (ok) { if (ok) busy(b, post({ action: 'resetnicks' })).then(function (x) { x && x.ok ? Hub.toast('Nicknames reset') : toastErr(x); }); }); }, { danger: true })));
      var gl = inp('Game name'), gu = inp('Game link, https://...'), gi = inp('Picture link (optional)'), gc = inp('Category (optional)'), glist = h('div', { class: 'adm-list' });
      function paintGames(l) { Hub.clear(glist); if (!l || !l.length) { glist.appendChild(empty('No custom games added.')); return; } l.forEach(function (g) { glist.appendChild(h('div', { class: 'adm-pr' }, [h('div', { class: 'sp' }, [h('div', { class: 'nn', text: g.label }), h('div', { class: 'ss', text: g.url })]), btn('Remove', function () { post({ action: 'delgame', id: g.id }).then(function () { post({ action: 'state' }).then(function (r2) { paintGames(r2 && r2.customGames); }); }); }, { ghost: true })])); }); }
      host.appendChild(card('Custom games', 'Add a game by link. It shows up in the Store for everyone.', [h('div', { class: 'adm-grid2' }, [gl, gu, gi, gc]), h('div', { class: 'adm-row', style: 'margin:12px 0' }, btn('Add game', function (b) { if (!gl.value.trim() || !gu.value.trim()) { Hub.toast('A name and a link are needed', { bad: true }); return; } busy(b, post({ action: 'addgame', label: gl.value, url: gu.value, imageUrl: gi.value, category: gc.value })).then(function (x) { if (x && x.ok) { Hub.toast('Added ' + x.game.label); gl.value = gu.value = gi.value = gc.value = ''; post({ action: 'state' }).then(function (r2) { paintGames(r2 && r2.customGames); }); } else toastErr(x); }); }, { primary: true })), glist]));
      paintGames(r && r.customGames);
      var gt = inp('Game name shown'), gtu = inp('Game link'), gti = inp('Picture link (optional)');
      host.appendChild(card('Game of the Day', 'Override the daily pick on the casino board.', [h('div', { class: 'adm-grid2' }, [gt, gtu, gti]), h('div', { class: 'adm-row', style: 'margin-top:12px' }, [btn('Set Game of the Day', function (b) { if (!gt.value.trim() || !gtu.value.trim()) { Hub.toast('A name and a link are needed', { bad: true }); return; } busy(b, post({ action: 'setgotd', label: gt.value, url: gtu.value, imageUrl: gti.value })).then(function (x) { x && x.ok ? Hub.toast('Game of the Day set') : toastErr(x); }); }, { primary: true }), btn('Back to automatic', function (b) { busy(b, post({ action: 'cleargotd' })).then(function (x) { x && x.ok ? Hub.toast('Back to the daily pick') : toastErr(x); }); }, { ghost: true })])]));
      var tk = h('code', { class: 'adm-key', text: 'Hidden' }), tkShown = false, tkVal = '';
      host.appendChild(card('Teacher key', 'A secret key some pages accept. Keep it private.', h('div', { class: 'adm-row wrap' }, [tk, btn('Show or hide', function () { if (!tkVal) { post({ action: 'teacherKey' }).then(function (x) { tkVal = (x && x.teacherKey) || ''; tkShown = true; tk.textContent = tkVal || 'Unavailable'; }); return; } tkShown = !tkShown; tk.textContent = tkShown ? tkVal : 'Hidden'; }, { ghost: true }), btn('Make a new key', function (b) { confirmBox('Make a new teacher key?', 'The old key stops working.', 'Make new key').then(function (ok) { if (ok) busy(b, post({ action: 'newTeacherKey' })).then(function (x) { if (x && x.ok) { tkVal = x.teacherKey; tkShown = true; tk.textContent = tkVal; Hub.toast('New key made'); } else toastErr(x); }); }); }, { danger: true })])));
      host.appendChild(card('Game updates', 'Publishing an update to an installed game happens on that game\'s page.', h('div', { class: 'adm-row wrap' }, [h('a', { class: 'btn sm primary', href: '#/originals' }, [icon('crown'), 'Open Originals']), h('a', { class: 'btn sm ghost', href: '#/store' }, [icon('shopping-bag'), 'Open Store'])])));
    });
  };

  // ---------- audit (owner) ----------
  PANES.audit = function (host) {
    var box = h('div', { class: 'adm-audit' }); host.appendChild(card('Audit log', 'Every staff action that changed something. Newest first.', box)); box.appendChild(loading());
    post({ action: 'audit.list' }).then(function (r) {
      Hub.clear(box); var l = (r && r.audit) || []; if (!l.length) { box.appendChild(empty('Nothing has been logged yet.')); return; }
      l.forEach(function (e) { box.appendChild(h('div', { class: 'au' }, [h('span', { class: 'at', text: Hub.ago(e.ts) }), badge(e.role), h('b', { text: e.by }), h('span', { class: 'ac', text: e.action }), e.target ? h('span', { class: 'ag', text: e.target }) : null, e.detail ? h('span', { class: 'ad', text: Hub.clean(e.detail) }) : null])); });
    });
  };
})();
