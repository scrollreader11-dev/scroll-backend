/* ScrollHub Hub: boot, sign-in, profile, settings, notifications, friends, player and startup. */
(function () {
  'use strict';
  var Hub = window.Hub, h = Hub.h, icon = Hub.icon, $ = Hub.$, $$ = Hub.$$;

  // ---------- logo: the scroll S inside the glass orb ----------
  function glossLogo(mini) {
    var svg = '<svg viewBox="0 0 240 240" aria-hidden="true"><defs>' +
      '<radialGradient id="gb' + (mini ? 'm' : '') + '" cx="50%" cy="36%" r="64%"><stop offset="0" stop-color="#2a6be0" stop-opacity=".55"/><stop offset=".55" stop-color="#0c2f80" stop-opacity=".78"/><stop offset="1" stop-color="#030b24" stop-opacity=".96"/></radialGradient>' +
      '<radialGradient id="gr' + (mini ? 'm' : '') + '" cx="50%" cy="50%" r="50%"><stop offset=".80" stop-color="#6db0ff" stop-opacity="0"/><stop offset=".96" stop-color="#8ac6ff" stop-opacity=".85"/><stop offset="1" stop-color="#d4ebff" stop-opacity="1"/></radialGradient>' +
      '<linearGradient id="gs' + (mini ? 'm' : '') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<radialGradient id="gu' + (mini ? 'm' : '') + '" cx="50%" cy="100%" r="62%"><stop offset="0" stop-color="#6cb8ff" stop-opacity=".9"/><stop offset="1" stop-color="#6cb8ff" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="gc' + (mini ? 'm' : '') + '"><circle cx="120" cy="120" r="112"/></clipPath></defs>' +
      '<circle cx="120" cy="120" r="112" fill="url(#gb' + (mini ? 'm' : '') + ')"/>' +
      '<g clip-path="url(#gc' + (mini ? 'm' : '') + ')"><ellipse cx="120" cy="236" rx="116" ry="70" fill="url(#gu' + (mini ? 'm' : '') + ')"/><ellipse cx="120" cy="50" rx="82" ry="42" fill="url(#gs' + (mini ? 'm' : '') + ')" opacity=".55"/></g>' +
      '<circle cx="120" cy="120" r="112" fill="url(#gr' + (mini ? 'm' : '') + ')"/><circle cx="120" cy="120" r="111" fill="none" stroke="rgba(200,230,255,.6)" stroke-width="1.4"/></svg>';
    return h('div', { class: 'gloss' + (mini ? ' mini' : '') }, [h('div', { class: 'floor' }), h('div', { class: 'orb', html: svg }), h('img', { class: 'mk', src: '/hub/logo.png?v=3', alt: '', draggable: 'false' }), h('div', { class: 'mark-sweep' })]);
  }

  // ---------- background video ----------
  Hub.syncVideo = function () {
    var v = $('#bgv'); if (!v) return; var want = Hub.prefs.video === 'on' && !Hub.prefs.reduce && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) && Hub.prefs.motion !== 'reduce';
    if (!want) { try { v.pause(); } catch (e) {} return; }
    var src = window.innerWidth < 900 ? '/hub/bg-m.mp4' : '/hub/bg.mp4';
    if (v.getAttribute('data-src') !== src) { v.setAttribute('data-src', src); v.src = src; v.load(); }
    v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () { var once = function () { v.play().catch(function () {}); document.removeEventListener('pointerdown', once); document.removeEventListener('touchstart', once); }; document.addEventListener('pointerdown', once, { once: true }); document.addEventListener('touchstart', once, { once: true }); });
  };
  document.addEventListener('visibilitychange', function () { var v = $('#bgv'); if (!v) return; if (document.hidden) { try { v.pause(); } catch (e) {} } else Hub.syncVideo(); });

  // ---------- sign in ----------
  function showLogin(opts) {
    opts = opts || {}; var host = $('#login'); Hub.clear(host); host.hidden = false; $('#app').classList.remove('on');
    var mode = Hub.locked() ? 'guest' : 'signin', card = h('div', { class: 'login-card' });
    function build() {
      Hub.clear(card); card.appendChild(glossLogo(true));
      if (mode === 'guest') {
        var nick = h('input', { class: 'input', id: 'lgNick', placeholder: 'Pick a nickname', maxlength: '16', autocomplete: 'nickname', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Nickname' }), err = h('div', { class: 'err', role: 'alert' });
        var f = h('form', { novalidate: true }, [h('label', { class: 'field' }, [h('span', { text: 'Nickname' }), nick]), err, h('button', { class: 'btn primary block', type: 'submit', style: 'height:48px' }, 'Continue')]);
        f.addEventListener('submit', function (e) { e.preventDefault(); err.textContent = ''; var n = nick.value.trim(); if (n.length < 2) { err.textContent = 'Pick a nickname with at least 2 letters.'; return; } var b = $('button', f); b.disabled = true; Hub.api('/api/arcade/nick', { body: { nick: n } }).then(function (r) { b.disabled = false; if (r && r.ok) finish(); else err.textContent = (r && r.error) || 'Could not set that nickname.'; }); });
        card.appendChild(h('h1', { text: Hub.locked() ? 'Enter a nickname' : 'Play as a guest' })); card.appendChild(h('p', { class: 'sub', text: Hub.locked() ? 'School Mode is on. A nickname is all you need.' : 'No account needed. Your games stay on this device.' })); card.appendChild(f);
        if (!Hub.locked()) card.appendChild(h('p', { class: 'swap' }, [h('button', { class: 'link', type: 'button', text: 'Sign in with an account', onclick: function () { mode = 'signin'; build(); } })]));
        else card.appendChild(h('p', { class: 'swap' }, [h('button', { class: 'link', type: 'button', text: 'I have an account', onclick: function () { mode = 'signin'; build(); } })]));
        setTimeout(function () { try { nick.focus({ preventScroll: true }); } catch (e) {} }, 400); return;
      }
      var up = mode === 'signup', user = h('input', { class: 'input', placeholder: 'Username', maxlength: '20', autocomplete: 'username', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Username', required: true }), pass = h('input', { class: 'input', type: 'password', placeholder: 'Password', maxlength: '100', autocomplete: up ? 'new-password' : 'current-password', 'aria-label': 'Password', required: true }), err2 = h('div', { class: 'err', role: 'alert' });
      card.appendChild(h('h1', { text: up ? 'Create your account' : 'Sign in' })); card.appendChild(h('p', { class: 'sub', text: up ? 'Keep your Scrolls, friends and library on every device.' : 'Use your ScrollHub account to bring your Scrolls and friends along.' }));
      var form = h('form', { novalidate: true }, [h('label', { class: 'field' }, [h('span', { text: 'Username' }), user]), h('label', { class: 'field' }, [h('span', { text: 'Password' }), pass]), err2, h('button', { class: 'btn primary block', type: 'submit', style: 'height:48px', text: up ? 'Create account' : 'Sign in' })]);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); err2.textContent = ''; var u = user.value.trim(), p = pass.value; if (!u || !p) { err2.textContent = 'Enter your username and password.'; return; }
        var b = $('button[type=submit]', form); b.disabled = true;
        Hub.api(up ? '/api/auth/signup' : '/api/auth/login', { body: { username: u, password: p } }).then(function (r) { b.disabled = false; if (r && r.ok) { if (r.token) Hub.ls.setRaw('sh_token', r.token); finish(); } else err2.textContent = (r && r.message) || (r && r.error === 'network' ? 'Could not reach ScrollHub. Check your connection.' : 'Something went wrong. Try again.'); });
      });
      card.appendChild(form); card.appendChild(h('div', { class: 'or', text: 'or' }));
      card.appendChild(h('button', { class: 'btn block', type: 'button', style: 'height:46px', text: 'Play as a guest', onclick: function () { mode = 'guest'; build(); } }));
      card.appendChild(h('p', { class: 'swap' }, [up ? 'Already have an account? ' : 'New here? ', h('button', { class: 'link', type: 'button', text: up ? 'Sign in' : 'Create an account', onclick: function () { mode = up ? 'signin' : 'signup'; build(); } })]));
      setTimeout(function () { try { user.focus({ preventScroll: true }); } catch (e) {} }, 400);
    }
    build(); host.appendChild(card);
    function finish() { host.hidden = true; Hub.loadMe().then(function () { startApp(true); }); }
  }
  Hub.showLogin = showLogin;

  // ---------- profile menu ----------
  Hub.profileMenu = function (anchor) {
    var m = Hub.me, items = [{ label: 'View profile', icon: 'user', fn: function () { location.hash = '#/profile'; } }, { label: 'My Rewards', icon: 'gift', fn: Hub.rewardsModal }, { label: 'Redeem a code', icon: 'ticket', fn: Hub.redeemModal }, { label: 'Friends', icon: 'users', fn: function () { location.hash = '#/friends'; } }];
    if (m.role) items.splice(1, 0, { label: 'Admin tools', icon: 'shield', fn: function () { location.hash = '#/admin'; } });
    if (m.owner) items.push({ label: 'Owner tools', icon: 'hammer', fn: function () { Hub.settingsModal('owner'); } });
    items.push({ label: 'Settings', icon: 'settings', fn: function () { Hub.settingsModal('account'); } }, { label: 'Support', icon: 'life-buoy', fn: Hub.supportModal }, { label: 'Feedback', icon: 'message-square', fn: Hub.feedbackModal }, { sep: true });
    if (m.kind === 'user') items.push({ label: 'Sign out', icon: 'log-out', fn: signOut }); else items.push({ label: 'Sign in or switch account', icon: 'log-out', fn: signOut });
    Hub.menu(anchor, items, { align: window.innerWidth > 760 ? 'left' : 'left' });
  };
  function signOut() {
    Hub.api('/api/auth/logout', { body: {} }).then(function () {
      Hub.ls.del('sh_token'); ['sh_sid', 'sh_cid', 'sh_nick'].forEach(function (n) { document.cookie = n + '=;Path=/;Max-Age=0;SameSite=Lax'; });
      Hub.me = { kind: 'none', id: '', name: '', owner: false }; Hub.dcReset && Hub.dcReset(); Hub.wallet = null; Hub.friends = { friends: [], incoming: [], outgoing: [], guest: true, loaded: true }; Hub.closeFly(); showLogin();
    });
  }

  // ---------- rewards + redeem ----------
  Hub.rewardsModal = function () {
    var body = h('div', { class: 'mbody' }, [h('h3', { text: 'My Rewards' }), h('p', { class: 'hint', text: 'Come back every day to keep your streak going.' }), Hub.rewardCard()]);
    var m = Hub.modal(body, { small: true, label: 'My Rewards' });
    var inp = h('input', { class: 'input', placeholder: 'Enter a code', maxlength: '24', 'aria-label': 'Redeem code', autocapitalize: 'characters', autocomplete: 'off' }), go = h('button', { class: 'btn primary', type: 'button', text: 'Redeem' });
    go.addEventListener('click', function () { if (!inp.value.trim()) return; go.disabled = true; Hub.redeem(inp.value.trim()).then(function (r) { go.disabled = false; if (r && r.ok) inp.value = ''; }); });
    body.appendChild(h('h4', { text: 'Redeem a code' })); body.appendChild(h('div', { style: 'display:flex;gap:10px' }, [inp, go]));
    Hub.on('wallet', function () { if (!body.isConnected) return; var old = $('.reward', body); if (old) old.replaceWith(Hub.rewardCard()); });
  };
  Hub.redeemModal = function () {
    var inp = h('input', { class: 'input', placeholder: 'Enter your code', maxlength: '24', 'aria-label': 'Code', autocapitalize: 'characters', autocomplete: 'off' }), go = h('button', { class: 'btn primary block', type: 'button', style: 'margin-top:12px', text: 'Redeem' });
    var body = h('div', { class: 'mbody' }, [h('h3', { text: 'Redeem a code' }), h('p', { class: 'hint', text: 'Event codes give you Scrolls. Codes are shared on special occasions.' }), inp, go]); var m = Hub.modal(body, { small: true, label: 'Redeem a code' });
    function run() { if (!inp.value.trim()) return; go.disabled = true; Hub.redeem(inp.value.trim()).then(function (r) { go.disabled = false; if (r && r.ok) m.close(); }); }
    go.addEventListener('click', run); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') run(); });
  };

  // ---------- notifications ----------
  Hub.notifFlyout = function (anchor) {
    var unreadOnly = false, body = h('div', { class: 'fly-b' }), wrap = h('div');
    function paintN() {
      Hub.clear(body); var list = Hub.notifs().filter(function (n) { return !unreadOnly || n.unread; });
      if (!list.length) { body.appendChild(h('div', { class: 'empty', style: 'padding:36px 10px;border:0;background:none' }, [icon('bell'), h('h3', { text: unreadOnly ? 'No unread notifications' : 'You are all caught up' })])); return; }
      list.slice(0, 20).forEach(function (n) {
        var ico = n.game && n.game.art && n.type !== 'daily' ? Hub.artEl(n.game, 'ni', true) : h('div', { class: 'ni' }, icon(n.icon || 'bell'));
        var acts = null;
        if (n.type === 'daily') acts = h('div', { class: 'acts' }, [h('button', { class: 'btn sm primary', type: 'button', text: 'Claim', onclick: function () { Hub.claimDaily().then(paintN); } }), h('button', { class: 'btn sm', type: 'button', text: 'Dismiss', onclick: function () { Hub.dismiss(n.id); paintN(); } })]);
        else if (n.type === 'update') acts = h('div', { class: 'acts' }, [h('button', { class: 'btn sm primary', type: 'button', text: 'Update', onclick: function () { Hub.install(n.game); Hub.dismiss(n.id); paintN(); } }), h('button', { class: 'btn sm', type: 'button', text: 'Dismiss', onclick: function () { Hub.dismiss(n.id); paintN(); } })]);
        else if (n.type === 'friend') acts = h('div', { class: 'acts' }, [h('button', { class: 'btn sm primary', type: 'button', text: 'Accept', onclick: function () { Hub.api('/api/friends/accept', { body: { id: n.friend.id } }).then(function () { Hub.loadFriends().then(paintN); }); } }), h('button', { class: 'btn sm', type: 'button', text: 'Decline', onclick: function () { Hub.api('/api/friends/decline', { body: { id: n.friend.id } }).then(function () { Hub.loadFriends().then(paintN); }); } })]);
        else acts = n.game ? h('div', { class: 'acts' }, [h('a', { class: 'btn sm', href: '#/game/' + encodeURIComponent(n.game.id), text: 'View', onclick: function () { Hub.closeFly(); } }), h('button', { class: 'btn sm', type: 'button', text: 'Dismiss', onclick: function () { Hub.dismiss(n.id); paintN(); } })]) : null;
        body.appendChild(h('div', { class: 'nt' + (n.unread ? ' unread' : '') }, [ico, h('div', { class: 'nb' }, [h('div', { class: 'nt1', text: n.title }), h('div', { class: 'nt2', text: n.body }), acts]), h('span', { class: 'tm', text: Hub.ago(n.ts) })]));
      });
    }
    var sw = Hub.toggle('Show unread only', '', false, function (v) { unreadOnly = v; paintN(); }); sw.style.margin = '0 12px 10px'; sw.style.width = 'calc(100% - 24px)';
    var head = h('div', { class: 'fly-h' }, [h('span', { text: 'Notifications' }), h('span', { class: 'sp' }), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Notification settings', onclick: function () { Hub.closeFly(); Hub.settingsModal('notifications'); } }, icon('ellipsis')), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Close', onclick: Hub.closeFly }, icon('x'))]);
    wrap.appendChild(head); wrap.appendChild(sw); wrap.appendChild(body); paintN();
    var f = Hub.flyout(anchor, wrap, { label: 'Notifications', onClose: Hub.markSeen });
    if (window.innerWidth > 760) { var r = anchor.getBoundingClientRect(); f.el.style.left = Math.min(r.right + 14, window.innerWidth - f.el.offsetWidth - 10) + 'px'; f.el.style.top = Math.max(10, r.top) + 'px'; }
  };

  // ---------- friends (a page in the main menu; the floating bar is gone) ----------
  Hub.friendsPanel = function () { location.hash = '#/friends'; };
  function syncFriendsUi() {
    var n = $('.nav a[href="#/friends"]');
    if (n) { var d = $('.dot', n), req = Hub.friends.incoming.length; if (req && !d) n.appendChild(h('i', { class: 'dot plain nav-dot' })); else if (!req && d) d.remove(); }
    if (Hub.parse().name === 'friends' && Hub.ready && !document.querySelector('.fr-page input:focus')) Hub.render(true);
  }
  Hub.on('friends', syncFriendsUi);
  var lastFrLoad = 0;
  Hub.views.friends = function () {
    if (Hub.me.kind === 'user' && Date.now() - lastFrLoad > 15000) { lastFrLoad = Date.now(); Hub.loadFriends(); }
    var v = h('div', { class: 'fr-page' }), F = Hub.friends;
    v.appendChild(h('h1', { class: 'page', text: 'Friends' }));
    v.appendChild(h('p', { class: 'page-sub', text: 'See who is online, jump into a chat, or add someone new.' }));
    if (Hub.me.kind !== 'user') { v.appendChild(Hub.emptyState('users', 'Sign in to add friends', 'Friends need an account so they can find you.', h('button', { class: 'btn primary', type: 'button', text: 'Sign in', onclick: function () { signOut(); } }))); return v; }
    var inp = h('input', { class: 'input', placeholder: 'Add a friend by username', maxlength: '20', autocapitalize: 'off', autocomplete: 'off', 'aria-label': 'Friend username' }), add = h('button', { class: 'btn primary', type: 'button', text: 'Send request' });
    function doAdd() { var u = inp.value.trim(); if (!u) return; add.disabled = true; Hub.api('/api/friends/add', { body: { username: u } }).then(function (r) { add.disabled = false; if (r && r.error) Hub.toast(r.message || 'Could not add that player', { bad: true }); else { Hub.toast('Request sent to ' + u, { icon: 'user-plus' }); inp.value = ''; Hub.loadFriends(); } }); }
    add.addEventListener('click', doAdd); inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAdd(); });
    v.appendChild(h('div', { class: 'fr-card' }, [h('div', { class: 'fr-add2' }, [inp, add])]));
    function person(f, extra, sub) {
      return h('div', { class: 'fr-row' }, [h('a', { class: 'fr-who', href: '#/profile/' + encodeURIComponent(f.username) }, [h('span', { class: 'avatar' + (f.online ? ' live' : ''), text: Hub.initials(f.username) }), h('div', { class: 'sp' }, [h('div', { class: 'nn', text: f.username }), h('div', { class: 'aa' + (!sub && f.online ? ' on' : ''), text: sub || (f.online ? (Hub.clean(f.activity) || 'Online') : 'Offline') })])]), h('div', { class: 'fr-acts' }, extra)]);
    }
    if (F.incoming.length) {
      var rq = h('div', { class: 'fr-list' });
      F.incoming.forEach(function (f) { rq.appendChild(person(f, [h('button', { class: 'btn sm primary', type: 'button', text: 'Accept', onclick: function () { Hub.api('/api/friends/accept', { body: { id: f.id } }).then(function () { Hub.loadFriends(); }); } }), h('button', { class: 'btn sm', type: 'button', text: 'Decline', onclick: function () { Hub.api('/api/friends/decline', { body: { id: f.id } }).then(function () { Hub.loadFriends(); }); } })], 'Wants to be your friend')); });
      v.appendChild(h('div', { class: 'sec' }, [h('div', { class: 'sec-h' }, h('h2', { text: 'Requests (' + F.incoming.length + ')' })), h('div', { style: 'height:12px' }), rq]));
    }
    var on = F.friends.filter(function (f) { return f.online; }), off = F.friends.filter(function (f) { return !f.online; });
    function msgBtn(f) { return h('button', { class: 'btn sm', type: 'button', onclick: function () { if (Hub.openDm) Hub.openDm(f.username); } }, [Hub.icon('message-square'), 'Message']); }
    function group(title, list, emptyText) {
      var box = h('div', { class: 'fr-list' });
      if (!list.length) box.appendChild(h('p', { class: 'fr-none', text: emptyText })); else list.forEach(function (f) { box.appendChild(person(f, [msgBtn(f), h('a', { class: 'btn sm ghost', href: '#/profile/' + encodeURIComponent(f.username), text: 'Profile' })])); });
      return h('div', { class: 'sec' }, [h('div', { class: 'sec-h' }, h('h2', { text: title })), h('div', { style: 'height:12px' }), box]);
    }
    v.appendChild(group('Online (' + on.length + ')', on, F.friends.length ? 'Nobody is online right now.' : 'No friends yet. Add someone above.'));
    if (off.length) v.appendChild(group('Offline (' + off.length + ')', off, ''));
    if (F.outgoing && F.outgoing.length) v.appendChild(h('div', { class: 'sec' }, [h('div', { class: 'sec-h' }, h('h2', { text: 'Sent requests' })), h('div', { style: 'height:12px' }), h('p', { class: 'fr-none', text: F.outgoing.map(function (f) { return f.username; }).join(', ') + '. Waiting for them to accept.' })]));
    return v;
  };

  // ---------- profile page ----------
  Hub.views.profile = function (a) {
    var who = a[0] ? a[0] : Hub.me.name, mine = !a[0] || String(a[0]).toLowerCase() === String(Hub.me.name).toLowerCase(), v = h('div'), host = h('div');
    v.appendChild(host); host.appendChild(h('div', { class: 'skel', style: 'height:200px' }));
    function draw(u) {
      Hub.clear(host); var banner = h('div', { class: 'pf-banner' }), bsrc = mine ? Hub.me.banner : (u && (u.banner || (u.cosmetics && u.cosmetics.banner && u.cosmetics.banner.url))) || '';
      if (bsrc) banner.appendChild(h('img', { src: bsrc, alt: '', onerror: function (e) { e.target.remove(); } }));
      if (mine && Hub.me.kind === 'user') banner.appendChild(h('button', { class: 'btn sm edit', type: 'button', onclick: function () { pickImage('banner'); } }, [icon('camera'), 'Change banner']));
      host.appendChild(banner);
      var av = mine ? Hub.avatarEl('lg') : Hub.avatarEl('lg', { name: who, avatar: u && u.avatar, color: u && u.cosmetics && u.cosmetics.color });
      var coins = mine ? (Hub.wallet && Hub.wallet.profile ? Hub.wallet.profile.coins : null) : (u && u.coins);
      var head = h('div', { class: 'pf-head' }, [av, h('div', { class: 'nm' }, [h('h1', { text: who }), h('div', { class: 'sub', text: mine ? (Hub.me.kind === 'user' ? 'ScrollHub account' : 'Guest') : (u && u.online ? 'Online now' : 'Offline') })])]);
      if (mine) head.appendChild(h('div', { class: 'pf-edit' }, [Hub.me.kind === 'user' ? h('button', { class: 'btn sm', type: 'button', onclick: function () { pickImage('avatar'); } }, [icon('camera'), 'Change picture']) : null, h('button', { class: 'btn sm', type: 'button', onclick: function () { Hub.settingsModal('account'); } }, [icon('settings'), 'Edit profile'])]));
      host.appendChild(head);
      var stats = h('div', { class: 'stats' }); function st(k, val) { stats.appendChild(h('div', { class: 'stat' }, [h('div', { class: 'k', text: k }), h('div', { class: 'v', text: val }) ])); }
      st('Scrolls', coins != null ? Hub.num(coins) : 'n/a');
      if (mine) { st('Games installed', String(Object.keys(Hub.lib.inst).length)); st('Games played', String(Object.keys(Hub.lib.plays).length)); st('Daily streak', Hub.wallet && Hub.wallet.profile ? String(Hub.wallet.profile.streak || 0) : '0'); }
      else if (u) { st('Rank', u.rank ? '#' + u.rank : 'Unranked'); st('Achievements', u.achCount + ' / ' + u.achTotal); st('Member since', u.createdAt ? Hub.dateShort(u.createdAt) : 'n/a'); }
      host.appendChild(stats);
      if (mine) {
        var rec = Hub.recents(14), r = Hub.row('Recently played', rec, {}); if (r) host.appendChild(r);
        host.appendChild(h('div', { class: 'sec' }, [h('div', { class: 'sec-h' }, h('h2', { text: 'Achievements' })), h('div', { style: 'height:12px' }), h('div', { class: 'ach', id: 'achBox' }, h('div', { class: 'skel', style: 'height:84px' }))]));
        Hub.api('/api/achievements').then(function (r2) { var box = $('#achBox'); if (!box) return; Hub.clear(box); var list = (r2 && r2.achievements) || []; if (!list.length) { box.appendChild(h('p', { style: 'color:var(--text2)', text: 'Play games to unlock achievements.' })); return; } list.sort(function (x, y) { return (y.unlocked ? 1 : 0) - (x.unlocked ? 1 : 0); }).slice(0, 24).forEach(function (x) { var pct = x.progress ? Math.round(x.progress.current / x.progress.target * 100) : 100; box.appendChild(h('div', { class: 'a' + (x.unlocked ? '' : ' lock') }, [h('div', { class: 'ai' }, icon(x.unlocked ? 'trophy' : 'lock')), h('div', { style: 'min-width:0;flex:1' }, [h('div', { class: 'n', text: Hub.clean(x.name) }), h('div', { class: 'd', text: Hub.clean(x.desc) }), x.unlocked ? null : h('div', { class: 'mini-bar pb' }, h('i', { style: 'width:' + pct + '%' }))])])); }); });
      } else if (u && u.badges && u.badges.length) {
        host.appendChild(h('div', { class: 'sec' }, [h('div', { class: 'sec-h' }, h('h2', { text: 'Achievements' })), h('div', { style: 'height:12px' }), h('div', { class: 'ach' }, u.badges.slice(0, 18).map(function (b) { return h('div', { class: 'a' }, [h('div', { class: 'ai' }, icon('trophy')), h('div', {}, [h('div', { class: 'n', text: Hub.clean(b.name) }), h('div', { class: 'd', text: b.rarity || '' })])]); }))]));
      }
    }
    if (mine || !a[0]) draw(null); else Hub.api('/api/user/' + encodeURIComponent(who)).then(function (u) { if (u && u.username) draw(u); else { Hub.clear(host); host.appendChild(Hub.emptyState('user', 'Player not found', 'That profile does not exist or is private.', h('a', { class: 'btn primary', href: '#/home', text: 'Back to Home' }))); } });
    if (mine && Hub.me.kind !== 'none') Hub.loadWallet().then(function () { if (Hub.parse().name === 'profile') draw(null); });
    return v;
  };
  function pickImage(kind) {
    var inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none' }); document.body.appendChild(inp);
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; inp.remove(); if (!f) return;
      var W = kind === 'banner' ? 1200 : 320, H = kind === 'banner' ? 360 : 320, img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), s = Math.max(W / img.width, H / img.height), w = img.width * s, hh = img.height * s; x.drawImage(img, (W - w) / 2, (H - hh) / 2, w, hh); URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (!b) { Hub.toast('Could not read that image', { bad: true }); return; } Hub.api('/api/me/' + kind, { raw: b }).then(function (r) { var k = kind === 'banner' ? 'banner_url' : 'avatar_url'; if (r && r[k]) { Hub.me[kind === 'banner' ? 'banner' : 'avatar'] = r[k]; Hub.toast(kind === 'banner' ? 'Banner updated' : 'Profile picture updated'); if (kind !== 'banner') Hub.emit('avatar'); Hub.renderChrome(); if (Hub.parse().name === 'profile') Hub.render(true); } else Hub.toast((r && r.error) || 'Upload failed', { bad: true }); }); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { Hub.toast('Could not read that image', { bad: true }); }; img.src = url;
    });
    inp.click();
  }

  // ---------- settings ----------
  var SET_TABS = [['account', 'Account'], ['app', 'App'], ['notifications', 'Notifications'], ['storage', 'Storage and updates'], ['access', 'Accessibility'], ['about', 'About']];
  Hub.settingsModal = function (tab) {
    var tabs = SET_TABS.slice(); if (Hub.me.owner) tabs.splice(5, 0, ['owner', 'Owner']);
    var nav = h('div', { class: 'mnav' }, [h('h2', { text: 'Settings' })]), body = h('div', { class: 'mbody' }), cur = tab || 'account';
    function pane() {
      $$('button', nav).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-t') === cur); }); Hub.clear(body); var fn = PANES[cur]; if (fn) fn(body, pane); body.scrollTop = 0;
    }
    tabs.forEach(function (t) { nav.appendChild(h('button', { type: 'button', 'data-t': t[0], text: t[1], onclick: function () { cur = t[0]; pane(); } })); });
    var wrap = h('div', { style: 'display:contents' }, [nav, body]); Hub.modal(wrap, { label: 'Settings' }); pane();
  };
  function kv(l, d, ctrl) { return h('div', { class: 'kv' }, [h('div', { class: 'l' }, [h('b', { text: l }), d ? h('span', { text: d }) : null]), ctrl]); }
  var PANES = {
    account: function (b) {
      var m = Hub.me; b.appendChild(h('h3', { text: 'Account' }));
      b.appendChild(h('div', { class: 'acct' }, [Hub.avatarEl('lg'), h('div', {}, [h('div', { style: 'font-size:20px;font-weight:700', text: m.name || 'Guest' }), h('div', { style: 'color:var(--text2)', text: m.kind === 'user' ? 'ScrollHub account' : 'Guest on this device' }), m.kind === 'user' ? h('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' }, [h('button', { class: 'btn sm', type: 'button', text: 'Change picture', onclick: function () { pickImage('avatar'); } }), h('button', { class: 'btn sm', type: 'button', text: 'Change banner', onclick: function () { pickImage('banner'); } })]) : null])]));
      if (m.kind === 'guest') {
        var nick = h('input', { class: 'input', value: m.name, maxlength: '16', 'aria-label': 'Nickname' }), save = h('button', { class: 'btn primary sm', type: 'button', text: 'Save nickname' });
        save.addEventListener('click', function () { Hub.api('/api/arcade/nick', { body: { nick: nick.value } }).then(function (r) { if (r && r.ok) { Hub.me.name = r.nick; Hub.toast('Nickname saved'); Hub.renderChrome(); } else Hub.toast((r && r.error) || 'Could not save', { bad: true }); }); });
        b.appendChild(h('h4', { text: 'Nickname' })); b.appendChild(h('div', { style: 'display:flex;gap:10px' }, [nick, save]));
        b.appendChild(h('h4', { text: 'Create an account' })); b.appendChild(h('p', { class: 'hint', text: 'An account keeps your Scrolls, friends and library on every device.' })); b.appendChild(h('button', { class: 'btn primary', type: 'button', text: 'Sign in or create account', onclick: function () { signOut(); } }));
      } else if (m.kind === 'user') {
        b.appendChild(h('h4', { text: 'Profile' }));
        b.appendChild(kv('Public profile', 'Let other players see your profile page.', Hub.toggle('', '', m.pub, function (v) { Hub.me.pub = v; Hub.api('/api/me', { body: { profile_public: v, profile_color: m.color } }); })));
        var colors = ['#3b82f6', '#06b6d4', '#6366f1', '#0ea5e9', '#2563eb', '#14b8a6'], cw = h('div', { style: 'display:flex;gap:8px' });
        colors.forEach(function (c) { var bb = h('button', { type: 'button', 'aria-label': 'Color ' + c, style: 'width:30px;height:30px;border-radius:50%;background:' + c + ';box-shadow:' + (m.color === c ? '0 0 0 3px #04070e,0 0 0 5px #fff' : 'inset 0 1px 0 rgba(255,255,255,.35)') }); bb.addEventListener('click', function () { Hub.me.color = c; Hub.api('/api/me', { body: { profile_public: m.pub, profile_color: c } }); Hub.renderChrome(); PANES.account(Hub.clear($('.mbody')), null); }); cw.appendChild(bb); });
        b.appendChild(kv('Avatar color', 'Used when you have no picture.', cw));
        b.appendChild(h('h4', { text: 'Password' }));
        var cur = h('input', { class: 'input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password', 'aria-label': 'Current password' }), nw = h('input', { class: 'input', type: 'password', placeholder: 'New password (6+ characters)', autocomplete: 'new-password', style: 'margin-top:10px', 'aria-label': 'New password' }), pb = h('button', { class: 'btn sm', type: 'button', style: 'margin-top:12px', text: 'Change password' });
        pb.addEventListener('click', function () { Hub.api('/api/auth/change-password', { body: { current: cur.value, new: nw.value } }).then(function (r) { if (r && r.ok) { Hub.toast('Password changed'); cur.value = nw.value = ''; } else Hub.toast((r && r.message) || 'Could not change password', { bad: true }); }); });
        b.appendChild(cur); b.appendChild(nw); b.appendChild(pb);
      }
      b.appendChild(h('h4', { text: 'Redeem a code' })); b.appendChild(h('button', { class: 'btn', type: 'button', text: 'Redeem', onclick: Hub.redeemModal }));
    },
    app: function (b) {
      b.appendChild(h('h3', { text: 'App' }));
      b.appendChild(h('h4', { text: 'Appearance' }));
      b.appendChild(h('p', { class: 'hint', text: Hub.themeNow().forced ? 'The site owner set the look for everyone right now.' : 'Pick a background and accent color. Only you see your choice.' }));
      b.appendChild(Hub.themePicker({ bg: Hub.prefs.bg || 'auto', accent: Hub.prefs.accent || 'auto', dim: Hub.prefs.dim || 0, url: Hub.ls.raw('sh_hub_bg') || Hub.prefs.bgUrl || '', auto: 'Site default', upload: true,
        onChange: function (part) { if ('bg' in part) Hub.setPref('bg', part.bg); if ('accent' in part) Hub.setPref('accent', part.accent); if ('dim' in part) Hub.setPref('dim', part.dim); if ('url' in part && /^https:/.test(part.url)) Hub.setPref('bgUrl', part.url); } }));
      b.appendChild(h('h4', { text: 'Motion and size' }));
      b.appendChild(kv('Background', 'Looping video behind the hub.', Hub.seg([['on', 'Animated'], ['still', 'Still']], Hub.prefs.video, function (v) { Hub.setPref('video', v); })));
      b.appendChild(kv('Interface size', 'Make everything a little smaller or larger.', Hub.seg([['sm', 'Small'], ['md', 'Default'], ['lg', 'Large']], Hub.prefs.size, function (v) { Hub.setPref('size', v); })));
      b.appendChild(kv('Recent games in sidebar', 'Show the Most Recent list.', Hub.toggle('', '', Hub.prefs.recents, function (v) { Hub.setPref('recents', v); Hub.renderChrome(); })));
    },
    notifications: function (b) {
      b.appendChild(h('h3', { text: 'Notifications' })); b.appendChild(h('p', { class: 'hint', text: 'Choose what shows up in the bell.' }));
      [['nUpd', 'Game updates', 'When an installed game has a new version.'], ['nDaily', 'Daily reward', 'When your reward is ready to claim.'], ['nFriends', 'Friend requests', 'When someone wants to be your friend.'], ['nDiscord', 'Discord pop-ups', 'Show a pop-up for direct messages and mentions while you are playing or browsing. Nothing pops up while Discord is open.'], ['nNews', 'Announcements', 'New versions pushed by ScrollHub.']].forEach(function (x) { b.appendChild(kv(x[1], x[2], Hub.toggle('', '', Hub.prefs[x[0]], function (v) { Hub.setPref(x[0], v); Hub.emit('notifs'); }))); });
    },
    storage: function (b, redo) {
      b.appendChild(h('h3', { text: 'Storage and updates' }));
      b.appendChild(kv('Automatic updates', 'Download new versions of installed games as soon as they are published.', Hub.toggle('', '', Hub.prefs.auto, function (v) { Hub.setPref('auto', v); })));
      var used = Hub.storageUsed(), n = Object.keys(Hub.lib.inst).length, up = Hub.updatable().length;
      b.appendChild(kv('Installed games', n + (n === 1 ? ' game' : ' games') + ', ' + Hub.bytes(used) + ' on this device.', h('button', { class: 'btn sm', type: 'button', text: 'View', onclick: function () { location.hash = '#/library/queue'; } })));
      b.appendChild(kv('Check for updates', Hub.lib.checked ? 'Last checked ' + Hub.ago(Hub.lib.checked) + ' ago. ' + (up ? up + ' available.' : 'Everything is current.') : 'Not checked yet.', h('button', { class: 'btn sm primary', type: 'button', text: 'Check now', onclick: function (e) { e.currentTarget.disabled = true; Hub.checkUpdates(false).then(function () { redo && redo(); }); } })));
      if (up) b.appendChild(kv('Updates ready', up + (up === 1 ? ' game has' : ' games have') + ' a new version.', h('button', { class: 'btn sm primary', type: 'button', text: 'Update all', onclick: function () { Hub.updateAll(); } })));
      var est = h('span', { text: '' }); b.appendChild(kv('Browser storage', 'Space used by downloaded game files.', est));
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { est.textContent = Hub.bytes(e.usage || 0) + ' of ' + Hub.bytes(e.quota || 0); }, function () {});
      b.appendChild(h('h4', { text: 'Remove downloads' })); b.appendChild(h('p', { class: 'hint', text: 'Removes every installed game from this device. Your account and progress are not affected.' }));
      b.appendChild(h('button', { class: 'btn danger', type: 'button', text: 'Uninstall all games', onclick: function () { if (!n) { Hub.toast('Nothing is installed'); return; } Hub.uninstallAll(); redo && redo(); } }));
    },
    access: function (b) {
      b.appendChild(h('h3', { text: 'Accessibility' }));
      b.appendChild(kv('Reduce motion', 'Turns off the background video and animations.', Hub.toggle('', '', Hub.prefs.motion === 'reduce', function (v) { Hub.setPref('motion', v ? 'reduce' : 'auto'); })));
      b.appendChild(kv('High contrast', 'Stronger borders and brighter secondary text.', Hub.toggle('', '', !!Hub.prefs.contrast, function (v) { Hub.setPref('contrast', v); })));
      b.appendChild(kv('Interface size', 'Larger text and buttons.', Hub.seg([['sm', 'Small'], ['md', 'Default'], ['lg', 'Large']], Hub.prefs.size, function (v) { Hub.setPref('size', v); })));
    },
    about: function (b) {
      b.appendChild(h('h3', { text: 'About' })); var ref = (Hub.manifest.originals[0] || {}).rev || '';
      b.appendChild(kv('ScrollHub Hub', 'Version ' + Hub.version, h('span', { style: 'color:var(--text3)', text: Hub.deviceName() })));
      b.appendChild(h('h4', { text: 'Credits' })); b.appendChild(h('p', { class: 'hint', text: 'The web game catalog and proxy plumbing come from PeteZah. Interface icons are from Lucide (ISC license). Background video is a licensed stock loop. ScrollHub Originals are built by ScrollHub.' }));
      b.appendChild(h('a', { class: 'btn sm', href: 'https://petezahgames.com', target: '_blank', rel: 'noopener', text: 'PeteZah' }));
      b.appendChild(h('h4', { text: 'Help' })); b.appendChild(h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [h('button', { class: 'btn sm', type: 'button', text: 'Support', onclick: Hub.supportModal }), h('button', { class: 'btn sm', type: 'button', text: 'Send feedback', onclick: Hub.feedbackModal })]));
    },
    owner: function (b) {
      b.appendChild(h('h3', { text: 'Owner tools' })); b.appendChild(h('p', { class: 'hint', text: 'Open any game page to publish an update. Recent pushes and player feedback are listed here.' }));
      b.appendChild(h('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:6px' }, [h('a', { class: 'btn sm', href: '#/admin', text: 'Admin tools' }), h('button', { class: 'btn sm', type: 'button', text: 'Refresh versions', onclick: function () { Hub.loadManifest().then(function () { Hub.toast('Versions refreshed'); }); } })]));
      b.appendChild(h('h4', { text: 'Recent update pushes' })); var feed = (Hub.manifest.feed || []).slice(0, 8);
      if (!feed.length) b.appendChild(h('p', { class: 'hint', text: 'Nothing pushed yet.' })); feed.forEach(function (f) { b.appendChild(h('div', { class: 'fb' }, [h('b', { text: f.title + ' v' + f.v }), '  ' + Hub.ago(f.ts) + ' ago. ' + (f.notes || '')])); });
      b.appendChild(h('h4', { text: 'Player feedback' })); var box = h('div', {}, h('p', { class: 'hint', text: 'Loading...' })); b.appendChild(box);
      Hub.api('/api/hub/feedback').then(function (r) { Hub.clear(box); var l = (r && r.items) || []; if (!l.length) box.appendChild(h('p', { class: 'hint', text: 'No feedback yet.' })); l.slice(0, 20).forEach(function (f) { box.appendChild(h('div', { class: 'fb' }, [h('b', { text: f.from + ' (' + f.kind + ')' }), '  ' + Hub.ago(f.ts) + ' ago. ' + f.text])); }); });
    },
  };

  // ---------- support + feedback ----------
  Hub.supportModal = function () {
    var faq = [['What does Install do?', 'Install downloads the game to this device and tracks its version. When a new version is published you get an Update prompt, or it updates itself if automatic updates are on.'], ['A game shows a black screen.', 'Press the refresh button in the game bar, or open it in a new tab. Some web games need a moment to load.'], ['How do I add this to my iPhone or iPad?', 'In Safari, tap the Share button and choose Add to Home Screen. ScrollHub then opens like an app.'], ['Why can I only see a few games?', 'School Mode limits ScrollHub to the Originals. Ask whoever runs your class if you need more.'], ['I lost my Scrolls or my account.', 'Use Feedback to tell us your username and what happened.']];
    var body = h('div', { class: 'mbody faq' }, [h('h3', { text: 'Support' })].concat(faq.map(function (f) { return h('details', {}, [h('summary', {}, [f[0], icon('chevron-down')]), h('p', { text: f[1] })]); })).concat([h('button', { class: 'btn primary', type: 'button', style: 'margin-top:18px', text: 'Send feedback', onclick: function () { m.close(); Hub.feedbackModal(); } })])); var m = Hub.modal(body, { small: true, label: 'Support' });
  };
  Hub.feedbackModal = function () {
    var kind = 'idea', ta = h('textarea', { class: 'input', placeholder: 'Tell us what happened or what you would like to see.', maxlength: '600', 'aria-label': 'Your feedback' }), send = h('button', { class: 'btn primary block', type: 'button', style: 'margin-top:12px', text: 'Send feedback' });
    var body = h('div', { class: 'mbody' }, [h('h3', { text: 'Feedback' }), h('div', { style: 'margin:6px 0 14px' }, Hub.seg([['idea', 'Idea'], ['bug', 'Problem'], ['other', 'Other']], 'idea', function (v) { kind = v; })), ta, send]); var m = Hub.modal(body, { small: true, label: 'Feedback' });
    send.addEventListener('click', function () { if (ta.value.trim().length < 4) { Hub.toast('Write a little more first', { bad: true }); return; } send.disabled = true; Hub.api('/api/hub/feedback', { body: { text: ta.value, kind: kind } }).then(function (r) { send.disabled = false; if (r && r.ok) { Hub.toast('Thanks, we got it', { icon: 'send' }); m.close(); } else Hub.toast((r && r.message) || 'Could not send right now', { bad: true }); }); });
  };


  // ---------- per-game loading screen ----------
  // Progress is driven from script (width, percent text, status text), so it still reads correctly on
  // devices or settings where CSS animation is off; the CSS motion on top is decoration only.
  function buildLoader(g) {
    var art = g.art && String(g.art);
    var cover = h('div', { class: 'pl-cover' });
    if (art) { var im = new Image(); im.alt = ''; im.decoding = 'async'; im.onerror = function () { cover.classList.add('noart'); cover.textContent = (g.title || '?').charAt(0).toUpperCase(); }; im.src = art; cover.appendChild(im); }
    else { cover.classList.add('noart'); cover.textContent = (g.title || '?').charAt(0).toUpperCase(); }
    var back = h('div', { class: 'pl-back' });
    if (art) back.style.backgroundImage = 'url("' + art.replace(/"/g, '%22') + '")';
    var pct = h('span', { class: 'pl-pct', text: '0%' }), fill = h('i'), status = h('span', { class: 'pl-status', text: 'Connecting' });
    var meta = [g.dev, g.players && (/^[0-9]/.test(g.players) ? g.players + ' players' : g.players)].filter(Boolean).join('  /  ');
    var tip = g.tagline || (g.cats && g.cats.length ? g.cats.slice(0, 3).join('  /  ') : '');
    var slow = h('div', { class: 'pl-slow', hidden: '' }, [h('p', { text: 'Taking longer than usual.' }), h('div', { class: 'pl-btns' }, [
      h('button', { type: 'button', class: 'btn primary', text: 'Show the game', onclick: function () { el.onSkip && el.onSkip(); } }),
      h('button', { type: 'button', class: 'btn', text: 'Back', onclick: function () { el.onExit && el.onExit(); } })])]);
    var el = h('div', { class: 'pload', role: 'status', 'aria-live': 'polite' }, [back, h('div', { class: 'pl-shade' }),
      h('div', { class: 'pl-main' }, [
        h('div', { class: 'pl-ringwrap' }, [cover, h('div', { class: 'pl-logo' }, [glossLogo(true)])]),
        h('div', { class: 'pl-text' }, [
          h('h2', { class: 'pl-title', text: g.title }),
          meta ? h('p', { class: 'pl-meta', text: meta }) : null,
          h('div', { class: 'pl-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [fill]),
          h('div', { class: 'pl-row' }, [status, pct]),
          tip ? h('p', { class: 'pl-tip', text: tip }) : null, slow])])]);
    var t0 = Date.now(), v = 0, done = false, steps = [[0, 'Connecting'], [22, 'Loading assets'], [55, 'Preparing the game'], [82, 'Almost ready']];
    function paint() { var r = Math.round(v); fill.style.width = v + '%'; pct.textContent = r + '%'; el.setAttribute('aria-valuenow', String(r)); var s = steps[0][1]; steps.forEach(function (x) { if (v >= x[0]) s = x[1]; }); if (!done && status.textContent !== s) status.textContent = s; }
    var iv = setInterval(function () { var e = Date.now() - t0; if (!done) { v += (93 - v) * 0.035; if (v > 93) v = 93; paint(); if (e > 12000) slow.hidden = false; } }, 90);
    el.finish = function (force) {
      if (done) return; done = true;
      var wait = force ? 0 : Math.max(0, 1500 - (Date.now() - t0));
      setTimeout(function () { fill.style.transition = 'width .35s cubic-bezier(.4,0,.2,1)'; v = 100; status.textContent = 'Ready'; paint(); clearInterval(iv); setTimeout(function () { el.classList.add("done"); setTimeout(function () { try { el.remove(); } catch (e) {} }, 750); }, 420); }, wait);
    };
    paint(); return el;
  }

  // ---------- player ----------
  var player = null;
  Hub.play = function (g) {
    if (player) return; Hub.record(g); Hub.playing = true; document.title = 'Playing ' + g.title;
    var frame = h('iframe', { allow: 'autoplay; fullscreen; gamepad; clipboard-write; microphone; accelerometer; gyroscope', allowfullscreen: '', title: g.title, referrerpolicy: 'no-referrer-when-downgrade' });
    var load = buildLoader(g);
    var bar = h('div', { class: 'pbar' }), tab = h('button', { class: 'ptab', type: 'button', 'aria-label': 'Show game bar' }, icon('chevron-down'));
    var el = h('div', { id: 'player', role: 'dialog', 'aria-label': 'Playing ' + g.title }, [frame, load, tab, bar]), timer;
    function showBar() { bar.classList.remove('hide'); tab.classList.remove('show'); clearTimeout(timer); timer = setTimeout(hideBar, 3200); }
    function hideBar() { if (bar.matches(':hover')) { timer = setTimeout(hideBar, 2000); return; } bar.classList.add('hide'); tab.classList.add('show'); }
    function close() { clearTimeout(timer); document.removeEventListener('keydown', onKey, true); try { frame.src = 'about:blank'; } catch (e) {} el.remove(); player = null; Hub.playing = false; Hub.render(true); try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) {} }
    function onKey(e) { if (e.key === 'Escape' && !document.fullscreenElement) { e.stopPropagation(); close(); } }
    var fsOk = !!(el.requestFullscreen || el.webkitRequestFullscreen) && !/iPhone|iPod/.test(navigator.userAgent);
    bar.appendChild(h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Back to ScrollHub', title: 'Back to ScrollHub', onclick: close }, icon('arrow-left'))); bar.appendChild(h('span', { class: 'ttl', text: g.title }));
    bar.appendChild(h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Reload game', title: 'Reload', onclick: function () { frame.src = frame.src; } }, icon('rotate-ccw')));
    bar.appendChild(h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Open in a new tab', title: 'Open in a new tab', onclick: function () { window.open(Hub.launchUrl(g), '_blank', 'noopener'); } }, icon('external-link')));
    if (fsOk) bar.appendChild(h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Full screen', title: 'Full screen', onclick: function () { var f = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen(); if (f && f.catch) f.catch(function () {}); } }, icon('fullscreen')));
    bar.appendChild(h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Hide game bar', title: 'Hide bar', onclick: hideBar }, icon('chevron-up')));
    tab.addEventListener('click', showBar); document.addEventListener('keydown', onKey, true);
    var started = false;
    frame.addEventListener('load', function () { if (!started) return; load.finish(); });
    load.onSkip = function () { load.finish(true); };
    load.onExit = close;
    document.body.appendChild(el); frame.src = Hub.launchUrl(g); setTimeout(function () { started = true; }, 0); player = { close: close }; timer = setTimeout(hideBar, 3600);
    el.addEventListener('mousemove', function (e) { if (e.clientY < 60) showBar(); });
  };

  // ---------- startup ----------
  function startApp(fresh) {
    Hub.loadLib(Hub.me.id); Hub.ready = true; $('#login').hidden = true; Hub.emit('ready');
    var app = $('#app'); app.classList.add('on'); Hub.renderChrome(); if (!location.hash || location.hash === '#') location.replace('#/home'); Hub.render(false);
    Hub.loadWallet().then(function () { Hub.renderChrome(); }); Hub.loadFriends();
    if (!Hub.lib.checked || Date.now() - Hub.lib.checked > 120000) Hub.checkUpdates(true);
    setInterval(function () { if (!document.hidden) { Hub.checkUpdates(true); Hub.loadSchool(); } }, 5 * 60000);
    setInterval(function () { if (!document.hidden && Hub.me.kind === 'user') Hub.loadFriends(); }, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { Hub.loadSchool(); if (Date.now() - (Hub.lib.checked || 0) > 60000) Hub.checkUpdates(true); } });
    setInterval(function () { if (!document.hidden) Hub.loadSchool(); }, 15000);
  }
  function boot() {
    Hub.applyPrefs(); Hub.syncVideo();
    var bl = $('#bootLogo'); bl.replaceWith(Object.assign(glossLogo(false), { id: 'bootLogo' }));
    var seen = false; try { seen = sessionStorage.getItem('sh_hub_booted') === '1'; } catch (e) {}
    var t0 = Date.now(), minMs = seen ? 500 : 2900;
    var load = Promise.all([Hub.loadSchool(), Hub.loadManifest().then(function () { return Hub.loadCatalog(); }), Hub.loadMe()]).catch(function (e) { if (window.console) console.error(e); });
    load.then(function () { return Hub.sleep(Math.max(0, minMs - (Date.now() - t0))); }).then(function () {
      try { sessionStorage.setItem('sh_hub_booted', '1'); } catch (e) {}
      var b = $('#boot'); b.classList.add('out'); setTimeout(function () { b.remove(); }, 800);
      if (!Hub.games.length) { showFatal(); return; }
      if (Hub.me.kind === 'none') showLogin(); else startApp(false);
    });
    $('#boot').addEventListener('click', function () { minMs = 0; });
  }
  function showFatal() {
    var host = $('#login'); host.hidden = false; Hub.clear(host);
    host.appendChild(h('div', { class: 'login-card' }, [glossLogo(true), h('h1', { text: 'Cannot reach ScrollHub' }), h('p', { class: 'sub', text: 'Check your connection and try again.' }), h('button', { class: 'btn primary block', type: 'button', style: 'height:48px', text: 'Try again', onclick: function () { location.reload(); } })]));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
