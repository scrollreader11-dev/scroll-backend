/* ScrollHub Hub: components, shell and main views. */
(function () {
  'use strict';
  var Hub = window.Hub, h = Hub.h, icon = Hub.icon, $ = Hub.$, $$ = Hub.$$;

  // ---------- art ----------
  function fallbackSrc(src) {
    if (!src) return null;
    var CDN = /^https:\/\/cdn\.jsdelivr\.net\/gh\/[^\/]+\/[^\/@]+@[^\/]+\/dist(\/.*)$/, m = String(src).match(CDN); if (m) return m[1];
    if (String(src).indexOf('https://wsrv.nl/') === 0) { try { var u = new URL(src).searchParams.get('url'); if (!u) return null; return u.indexOf('https://petezahgames.com/') === 0 ? u.slice('https://petezahgames.com'.length) : '/imgx/' + u; } catch (e) { return null; } }
    return null;
  }
  function phEl(g, small) {
    var hh = Hub.hash(g.title) % 40, e = h('div', { class: 'ph', style: '--h1:hsl(' + (212 + hh * 0.7) + ',78%,' + (38 + hh % 9) + '%);--h2:hsl(' + (222 + hh * 0.5) + ',72%,16%)' }, h('span', { text: small ? Hub.initials(g.title) : g.title }));
    return e;
  }
  function artEl(g, cls, small) {
    var wrap = h('div', { class: cls || 'art' }); wrap.appendChild(phEl(g, small));
    if (g.art) {
      var img = new Image(); img.alt = ''; img.decoding = 'async'; img.loading = cls === 'gp-cover' ? 'eager' : 'lazy'; img.referrerPolicy = 'no-referrer'; img.style.opacity = '0'; img.style.transition = 'opacity .35s';
      img.onload = function () { img.style.opacity = '1'; var ph = wrap.querySelector('.ph'); if (ph) ph.style.opacity = '0'; };
      img.onerror = function () { var alt = !img._t && fallbackSrc(img.getAttribute('src')); if (alt) { img._t = 1; img.src = alt; } else if (img.parentNode) img.parentNode.removeChild(img); };
      img.src = g.art; wrap.appendChild(img);
    }
    return wrap;
  }
  Hub.artEl = artEl;

  // ---------- status slots (painted live as installs progress) ----------
  function fillSlot(el, g) {
    var st = Hub.status(g), mode = el.getAttribute('data-mode'); Hub.clear(el);
    el.className = el.className.replace(/\s?(ok|up|dl)\b/g, '');
    if (mode === 'rec') {
      if (st.k === 'dl' || st.k === 'queued') { el.appendChild(h('div', { class: 'mini-bar' }, h('i', { style: 'width:' + Math.round(st.pct) + '%' }))); }
      else if (st.k === 'upd') { el.classList.add('up'); el.textContent = 'Update available'; }
      else if (st.k === 'inst') el.textContent = 'Installed'; else el.textContent = g.dev;
      return;
    }
    if (st.k === 'dl') { el.classList.add('dl'); el.appendChild(h('span', { text: (st.update ? 'Updating ' : 'Downloading ') + Math.round(st.pct) + '%' })); el.appendChild(h('div', { class: 'mini-bar' }, h('i', { style: 'width:' + Math.round(st.pct) + '%' }))); }
    else if (st.k === 'queued') { el.appendChild(icon('clock')); el.appendChild(h('span', { text: 'Waiting in queue' })); }
    else if (st.k === 'upd') { el.classList.add('up'); el.appendChild(icon('arrow-down-to-line')); el.appendChild(h('span', { text: 'Update available' })); }
    else if (st.k === 'inst') { el.classList.add('ok'); el.appendChild(icon('circle-check')); el.appendChild(h('span', { text: 'Installed' })); }
    else el.appendChild(h('span', { text: 'Free' }));
  }
  function slot(g, mode, cls) { var e = h('div', { class: (cls || 'p') + ' slot', 'data-g': g.id, 'data-mode': mode || 'card' }); fillSlot(e, g); return e; }
  function paint(g) { $$('.slot[data-g="' + g.id + '"]').forEach(function (e) { fillSlot(e, g); }); }
  function paintAll() { $$('.slot').forEach(function (e) { var g = Hub.byId[e.getAttribute('data-g')]; if (g) fillSlot(e, g); }); }
  Hub.paint = paint;

  // ---------- cards ----------
  function pillFor(g) {
    var st = Hub.status(g);
    if (st.k === 'upd') return h('span', { class: 'pill up' }, [icon('arrow-down-to-line'), 'Update']);
    if (g.kind === 'original') return h('span', { class: 'pill' }, [icon('sparkles'), 'Original']);
    if (g.cats[0]) return h('span', { class: 'pill' }, g.cats[0]);
    return null;
  }
  function card(g) {
    var art = artEl(g, 'art'), pl = pillFor(g); if (pl) art.appendChild(pl);
    var a = h('a', { class: 'card', href: '#/game/' + encodeURIComponent(g.id), 'aria-label': g.title }, [art, h('div', { class: 'meta' }, [h('div', { class: 't', text: g.title }), h('div', { class: 's', text: g.kind === 'original' ? g.dev : (g.cats.slice(0, 2).join(', ') || 'Game') }), slot(g, 'card')])]);
    return a;
  }
  function skelCards(n) { var f = document.createDocumentFragment(); for (var i = 0; i < n; i++) f.appendChild(h('div', { class: 'card sk' }, [h('div', { class: 'art skel' }), h('div', { class: 'meta' }, [h('div', { class: 'skel', style: 'height:14px;width:80%' }), h('div', { class: 'skel', style: 'height:11px;width:50%;margin-top:6px' })])])); return f; }
  function row(title, games, o) {
    o = o || {}; if (!games.length) return null;
    var scroller = h('div', { class: 'row' }); games.forEach(function (g) { scroller.appendChild(card(g)); });
    var l = h('button', { class: 'row-btn l', type: 'button', 'aria-label': 'Scroll left' }, icon('chevron-left')), r = h('button', { class: 'row-btn r', type: 'button', 'aria-label': 'Scroll right' }, icon('chevron-right'));
    function sync() { l.classList.toggle('show', scroller.scrollLeft > 8); r.classList.toggle('show', scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 8); }
    scroller.addEventListener('scroll', Hub.debounce(sync, 40), { passive: true }); setTimeout(sync, 80); window.addEventListener('resize', sync);
    l.addEventListener('click', function () { scroller.scrollBy({ left: -scroller.clientWidth * 0.85, behavior: 'smooth' }); }); r.addEventListener('click', function () { scroller.scrollBy({ left: scroller.clientWidth * 0.85, behavior: 'smooth' }); });
    var head = h('div', { class: 'sec-h' }, [h('h2', { text: title }), o.href ? h('a', { class: 'chev', href: o.href, 'aria-label': 'Show all ' + title }, icon('chevron-right')) : null]);
    return h('section', { class: 'sec' }, [head, o.sub ? h('p', { class: 'sec-sub', text: o.sub }) : h('div', { style: 'height:10px' }), h('div', { class: 'row-wrap' }, [l, scroller, r])]);
  }
  function emptyState(ic, title, body, btn) { return h('div', { class: 'empty' }, [icon(ic), h('h3', { text: title }), h('p', { text: body }), btn || null]); }
  function tileLg(g, o) {
    o = o || {}; var a = h('a', { class: 'tile-lg ' + (o.cls || 'big') + (g.casino ? ' shift' : ''), href: o.href || '#/game/' + encodeURIComponent(g.id) }, [h('img', { class: 'bgimg', src: g.art, alt: '', decoding: 'async' }), h('div', { class: 'cap' }, [o.kicker ? h('span', { class: 'k', text: o.kicker }) : null, h('h3', { text: o.title || g.title }), h('p', { text: o.sub != null ? o.sub : (g.tagline || '') })])]);
    var img = a.querySelector('img'); img.onerror = function () { var alt = fallbackSrc(img.getAttribute('src')); if (alt && !img._t) { img._t = 1; img.src = alt; } else img.style.display = 'none'; };
    return a;
  }

  // ---------- shell: sidebar / topbar / tabbar ----------
  var NAV = [['home', 'Home', 'house'], ['originals', 'Originals', 'crown'], ['library', 'My Library', 'library-big'], ['store', 'Store', 'shopping-bag'], ['discord', 'Discord', 'message-square'], ['friends', 'Friends', 'users'], ['hall', 'Hall of creations', 'sparkles'], ['trophies', 'Trophy room', 'trophy'], ['admin', 'Admin tools', 'shield']];
  function navItems(tabbar) { return NAV.filter(function (n) { return !(n[0] === 'casino' && !Hub.canCasino()) && !(n[0] === 'store' && !Hub.canStore()) && !(n[0] === 'discord' && Hub.me.kind !== 'user') && !(n[0] === 'friends' && (Hub.me.kind !== 'user' || tabbar)) && !((n[0] === 'hall' || n[0] === 'trophies') && tabbar) && !(n[0] === 'news' && tabbar) && !(n[0] === 'admin' && (!Hub.me.role || tabbar)); }); }
  function curRoot() { var r = Hub.parse().name; return r === 'genre' || r === 'search' ? 'store' : (r === 'game' ? Hub.lastRoot || 'home' : r); }
  function avatarEl(cls, who) {
    var m = who || Hub.me, a = h('span', { class: 'avatar' + (cls ? ' ' + cls : '') });
    if (m.avatar) { var i = new Image(); i.alt = ''; i.src = m.avatar; i.onerror = function () { i.remove(); a.textContent = Hub.initials(m.name); }; a.appendChild(i); } else a.textContent = Hub.initials(m.name);
    if (m.color && /^#[0-9a-f]{3,8}$/i.test(m.color) && !m.avatar) a.style.background = m.color;
    return a;
  }
  Hub.avatarEl = avatarEl;
  function renderSide() {
    var side = Hub.clear($('#side')), m = Hub.me, root = curRoot();
    var who = h('button', { class: 'who', type: 'button', 'aria-label': 'Account menu', 'aria-haspopup': 'menu' }, [avatarEl(), h('div', { class: 'meta', style: 'min-width:0' }, [h('div', { class: 'name', text: m.name || 'Guest' }), h('div', { class: 'sub' }, [m.kind === 'user' ? icon('coins', '') : null, h('span', { text: Hub.wallet && Hub.wallet.profile ? Hub.num(Hub.wallet.profile.coins) + ' Scrolls' : (m.kind === 'user' ? 'Online' : 'Guest') })])])]);
    who.addEventListener('click', function () { Hub.profileMenu(who); });
    var gift = h('button', { class: 'iconbtn gift', type: 'button', 'aria-label': 'Daily reward' }, [icon('gift'), Hub.dailyReady() ? h('i', { class: 'dot plain' }) : null]); gift.addEventListener('click', function () { Hub.rewardsModal(); });
    var n = Hub.unreadCount(), bell = h('button', { class: 'iconbtn', type: 'button', id: 'bellBtn', 'aria-label': 'Notifications' + (n ? ', ' + n + ' unread' : ''), 'aria-haspopup': 'dialog' }, [icon('bell'), n ? h('i', { class: 'dot', text: n > 9 ? '9+' : String(n) }) : null]); bell.addEventListener('click', function () { Hub.notifFlyout(bell); });
    side.appendChild(h('div', { class: 'me' }, [who, gift, bell]));
    var nav = h('nav', { class: 'nav', 'aria-label': 'Main' }), grp = { home: 'Play', discord: 'Social', admin: 'Staff' }, wide = window.innerWidth > 1100, coll = Hub.ls.get('sh_nav_coll', {}) || {}, curG = '';
    function groupHead(name) {
      var shut = !!coll[name] && wide, b = h('button', { class: 'nav-g' + (shut ? ' shut' : ''), type: 'button', 'aria-expanded': shut ? 'false' : 'true', title: shut ? 'Show ' + name : 'Hide ' + name }, [h('span', { text: name }), icon('chevron-down')]);
      b.addEventListener('click', function () { coll[name] = !coll[name]; Hub.ls.set('sh_nav_coll', coll); renderSide(); }); return b;
    }
    navItems().forEach(function (it) {
      if (grp[it[0]]) { curG = grp[it[0]]; nav.appendChild(groupHead(curG)); }
      if (wide && coll[curG] && root !== it[0]) return;
      nav.appendChild(h('a', { href: '#/' + it[0], class: root === it[0] ? 'on' : '', 'aria-current': root === it[0] ? 'page' : null }, [icon(it[2]), h('span', { text: it[1] }), (it[0] === 'discord' && Hub.dcUnread) || (it[0] === 'friends' && Hub.friends.incoming.length) ? h('i', { class: 'dot plain nav-dot' }) : null]));
    });
    side.appendChild(nav);
    if (Hub.moreBlock) side.appendChild(Hub.moreBlock(root));
    var rec = Hub.recents(6);
    if (Hub.prefs.recents && rec.length) {
      side.appendChild(h('div', { class: 'sect', text: 'Most Recent' }));
      var list = h('div', { class: 'recents' }); rec.forEach(function (g) { var t = artEl(g, 'tile', true); list.appendChild(h('a', { class: 'rec', href: '#/game/' + encodeURIComponent(g.id), title: g.title }, [t, h('div', { class: 'info' }, [h('div', { class: 't', text: g.title }), slot(g, 'rec', 's')])])); });
      side.appendChild(list);
    }
    var hist = Hub.lib.hist, ids = []; hist.forEach(function (x) { if (ids.indexOf(x.id) < 0 && Hub.byId[x.id] && ids.length < 4) ids.push(x.id); });
    var col = h('div', { class: 'collage' }); for (var i = 0; i < 4; i++) { var gg = Hub.byId[ids[i]]; col.appendChild(gg && gg.art ? h('img', { src: gg.art, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', onerror: function (e) { e.target.removeAttribute('src'); } }) : h('div')); }
    side.appendChild(h('a', { class: 'rec', href: '#/library/history', style: 'margin-top:6px' }, [col, h('div', { class: 'info' }, h('div', { class: 't', text: 'Play history' }))]));
    side.appendChild(h('div', { class: 'grow' }));
    var cur = Hub.dl.order.map(function (i) { return Hub.byId[i]; }).filter(Boolean)[0], upd = Hub.updatable().length;
    var q = h('a', { class: 'queue-link', href: '#/library/queue', 'aria-label': 'Install queue' }, [h('span', { style: 'position:relative;display:grid' }, [icon('download', ''), upd ? h('i', { class: 'dot plain', style: 'top:-4px;right:-5px' }) : null]), h('div', { class: 'tx' }, [h('div', { class: 't', text: 'Install queue' }), h('div', { class: 's', text: cur ? (Hub.dl.items[cur.id].update ? 'Updating ' : 'Installing ') + cur.title : (upd ? upd + (upd === 1 ? ' update' : ' updates') + ' available' : 'Manage recent installations') })])]);
    side.appendChild(q);
  }
  function renderTabbar() {
    var bar = Hub.clear($('#tabbar')), root = curRoot(); navItems(true).forEach(function (it) { bar.appendChild(h('a', { href: '#/' + it[0], class: root === it[0] ? 'on' : '', 'aria-current': root === it[0] ? 'page' : null }, [icon(it[2]), h('span', { text: it[1] === 'My Library' ? 'Library' : it[1] })])); });
    if (Hub.moreMenu) { var mb = h('button', { type: 'button', 'aria-label': 'More pages', 'aria-haspopup': 'menu', class: ['news', 'status', 'apply'].indexOf(root) >= 0 ? 'on' : '' }, [icon('ellipsis'), h('span', { text: 'More' }), Hub.newsUnseen ? h('i', { class: 'dot plain nav-dot' }) : null]); mb.addEventListener('click', function () { Hub.moreMenu(mb); }); bar.appendChild(mb); }
  }
  var DETAIL = { game: 1, search: 1, genre: 1, profile: 1 };
  function renderTop() {
    var top = Hub.clear($('#topbar')), r = Hub.parse(), detail = DETAIL[r.name] || (r.name === 'store' && r.args[0]);
    var left;
    if (detail) { left = h('button', { class: 'back', type: 'button', 'aria-label': 'Back' }, icon('arrow-left')); left.addEventListener('click', function () { if (Hub.hasPrev) history.back(); else location.hash = '#/' + (Hub.lastRoot || 'home'); }); }
    else { left = h('button', { class: 'back avatar-btn', type: 'button', 'aria-label': 'Account menu' }, avatarEl()); left.style.padding = '0'; left.style.background = 'none'; left.style.border = '0'; left.addEventListener('click', function () { Hub.profileMenu(left); }); if (window.innerWidth > 760) { left = h('span', { class: 'top-spacer' }); } }
    top.appendChild(left);
    if (r.name === 'discord') top.appendChild(h('span', { class: 'grow' })); else top.appendChild(buildSearch());
    var bell = h('button', { class: 'iconbtn only-m', type: 'button', 'aria-label': 'Notifications' }, [icon('bell'), Hub.unreadCount() ? h('i', { class: 'dot plain' }) : null]); bell.addEventListener('click', function () { Hub.notifFlyout(bell); });
    top.appendChild(bell); top.appendChild(h('span', { class: 'top-spacer only-d' }));
  }
  // Pages and tools reachable from the search box, so nothing is more than a few letters away.
  function pageList() {
    var me = Hub.me || {}, L = [
      { t: 'Home', s: 'Page', i: 'house', k: 'home start main', go: function () { location.hash = '#/home'; } },
      { t: 'Scrolls Casino', s: 'Open the casino', i: 'dices', k: 'casino slots blackjack roulette plinko mines crash gamble bet scrolls coins', go: function () { location.hash = '#/game/scrollhub-casino'; }, need: Hub.canCasino() },
      { t: 'ScrollHub Originals', s: 'Games made by ScrollHub', i: 'crown', k: 'originals royale bedwars racing arcade', go: function () { location.hash = '#/originals'; } },
      { t: 'My Library', s: 'Your installed and played games', i: 'library-big', k: 'library installed games mine', go: function () { location.hash = '#/library'; } },
      { t: 'Play history', s: 'Games you played recently', i: 'clock', k: 'history recent played', go: function () { location.hash = '#/library/history'; } },
      { t: 'Install queue', s: 'Installs and updates', i: 'download', k: 'install queue updates download', go: function () { location.hash = '#/library/queue'; } },
      { t: 'Store', s: 'Browse every game', i: 'shopping-bag', k: 'store browse all games catalog genre', go: function () { location.hash = '#/store'; }, need: Hub.canStore() },
      { t: 'Discord', s: 'Servers, DMs and voice', i: 'message-square', k: 'discord chat dm voice servers messages talk', go: function () { location.hash = '#/discord'; }, need: me.kind === 'user' },
      { t: 'Friends', s: 'Requests, online and offline friends', i: 'users', k: 'friends requests add online', go: function () { location.hash = '#/friends'; }, need: me.kind === 'user' },
      { t: 'Profile', s: 'Your picture, banner and achievements', i: 'user', k: 'profile picture avatar banner achievements me', go: function () { location.hash = '#/profile/' + encodeURIComponent(me.name || ''); }, need: me.kind === 'user' },
      { t: "What's New", s: 'News and changes', i: 'megaphone', k: 'news whats new updates changes changelog', go: function () { location.hash = '#/news'; } },
      { t: 'Site status', s: 'Is everything working?', i: 'gauge', k: 'status down outage working online uptime', go: function () { location.hash = '#/status'; } },
      { t: 'Report a problem or player', s: 'Tell the moderators', i: 'flag', k: 'report bug problem player abuse cheat', go: function () { Hub.reportModal && Hub.reportModal(); } },
      { t: 'Apply to be a mod', s: 'Join the team', i: 'user-plus', k: 'apply mod moderator staff application join team', go: function () { location.hash = '#/apply'; }, need: me.kind === 'user' && !me.role },
      { t: 'Install app', s: 'Add ScrollHub to your device', i: 'download', k: 'install app pwa home screen offline', go: function () { Hub.installApp && Hub.installApp(); }, need: !!(Hub.canInstall && Hub.canInstall()) },
      { t: 'Settings', s: 'Account, notifications, display', i: 'settings', k: 'settings account notifications display options preferences', go: function () { Hub.settingsModal('account'); } },
      { t: 'Daily reward', s: 'Claim your Scrolls', i: 'gift', k: 'daily reward gift claim scrolls streak', go: function () { Hub.rewardsModal(); }, need: me.kind === 'user' },
      { t: 'Notifications', s: 'Your latest alerts', i: 'bell', k: 'notifications alerts bell', go: function () { var b = $('#bellBtn'); if (b) b.click(); } },
      { t: 'Admin tools', s: me.role === 'owner' ? 'Owner panel' : me.role === 'coowner' ? 'Co-owner panel' : 'Moderator panel', i: 'shield', k: 'admin owner mod staff panel ban players', go: function () { location.hash = '#/admin'; }, need: !!me.role }
    ];
    return L.filter(function (x) { return x.need !== false; });
  }
  function pageHits(q) { q = q.trim().toLowerCase(); if (q.length < 2) return []; return pageList().filter(function (x) { return x.t.toLowerCase().indexOf(q) >= 0 || (' ' + x.k).indexOf(' ' + q) >= 0; }).slice(0, 3); }
  function buildSearch() {
    var wrap = h('div', { class: 'search', role: 'search' }), input = h('input', { type: 'search', placeholder: Hub.canStore() ? 'Search for games and more' : 'Search ScrollHub games', 'aria-label': 'Search games', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'search', maxlength: '60' });
    var clr = h('button', { class: 'clr', type: 'button', 'aria-label': 'Clear search', hidden: true }, icon('x')), box = null, sel = -1, list = [];
    wrap.appendChild(h('div', { class: 'field-s' }, [icon('search'), input, clr]));
    var q0 = Hub.parse(); if (q0.name === 'search') { input.value = q0.args[0] || ''; clr.hidden = !input.value; }
    function close() { if (box) { box.remove(); box = null; } sel = -1; }
    function go(q) { close(); q = q.trim(); if (!q) return; input.blur(); location.hash = '#/search/' + encodeURIComponent(q); }
    function show() {
      var q = input.value; clr.hidden = !q; close(); var empty = !q.trim(); if (empty && document.activeElement !== input) return; list = empty ? [] : Hub.search(q, 5); var pg = empty ? pageList().filter(function (x) { return ['Home', 'Install queue', 'Play history', 'Notifications'].indexOf(x.t) < 0; }).slice(0, 7) : pageHits(q); if (!list.length && !pg.length) return;
      box = h('div', { class: 'suggest', role: 'listbox' });
      pg.forEach(function (p0) {
        var pb = h('button', { class: 'sug page', type: 'button', role: 'option' }, [h('span', { class: 'pgi' }, icon(p0.i)), h('div', {}, [h('div', { class: 't', text: p0.t }), h('div', { class: 's', text: p0.s })])]);
        pb.addEventListener('pointerdown', function (e) { e.preventDefault(); }); pb.addEventListener('click', function () { close(); input.blur(); input.value = ''; clr.hidden = true; p0.go(); }); box.appendChild(pb);
      });
      list.forEach(function (g, i) {
        var b = h('button', { class: 'sug', type: 'button', role: 'option' }, [artEl(g, 'tile', true), h('div', {}, [h('div', { class: 't', text: g.title }), h('div', { class: 's', text: g.kind === 'original' ? 'ScrollHub Original' : (g.cats[0] || 'Game') })])]);
        b.addEventListener('pointerdown', function (e) { e.preventDefault(); }); b.addEventListener('click', function () { close(); input.blur(); location.hash = '#/game/' + encodeURIComponent(g.id); }); box.appendChild(b);
      });
      box.appendChild(h('div', { class: 'sug-foot', text: empty ? 'Jump to a page, or type to search games' : 'Press enter to search' })); wrap.appendChild(box);
    }
    input.addEventListener('input', Hub.debounce(show, 90));
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var s = $$('.sug', wrap); if (sel >= 0 && s[sel]) { s[sel].click(); } else go(input.value); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { var s2 = $$('.sug', wrap); if (!s2.length) return; sel = e.key === 'ArrowDown' ? (sel + 1) % s2.length : (sel - 1 + s2.length) % s2.length; s2.forEach(function (x, i) { x.classList.toggle('sel', i === sel); }); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); input.blur(); }
    });
    input.addEventListener('focus', show); input.addEventListener('blur', function () { setTimeout(close, 160); });
    clr.addEventListener('click', function () { input.value = ''; clr.hidden = true; close(); input.focus(); });
    document.addEventListener('keydown', function (e) { if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '') && !$('.modal') && input.isConnected) { e.preventDefault(); input.focus(); } });
    return wrap;
  }

  // ---------- router ----------
  Hub.views = {}; Hub.hasPrev = false; Hub.lastRoot = 'home';
  Hub.parse = function () { var s = location.hash.replace(/^#\/?/, ''), parts = s ? s.split('/').map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } }) : []; return { name: parts[0] || 'home', args: parts.slice(1) }; };
  var firstRoute = true, lastKey = '';
  Hub.render = function (keepScroll) {
    var r = Hub.parse(), name = r.name, view = Hub.views[name]; if (!view) { location.replace('#/home'); return; }
    if (['home', 'originals', 'library', 'casino', 'store', 'discord', 'friends', 'hall', 'trophies', 'admin'].indexOf(name) >= 0) Hub.lastRoot = name;
    if (name === 'casino') { location.replace('#/game/scrollhub-casino'); return; }
    if ((name === 'casino' && !Hub.canCasino()) || (name === 'store' && !Hub.canStore()) || (name === 'genre' && !Hub.canStore())) { location.replace('#/home'); return; }
    Hub.closeMenu(); Hub.closeFly();
    var host = $('#view'), sc = $('#scroll'), top = sc.scrollTop; Hub.clear(host);
    var node; try { node = view(r.args); } catch (e) { if (window.console) console.error(e); node = emptyState('triangle-alert', 'Something went wrong', 'This page could not be shown. Try again.', h('a', { class: 'btn primary', href: '#/home', text: 'Back to Home' })); }
    host.appendChild(node); host.style.animation = 'none'; void host.offsetWidth; host.style.animation = ''; host.className = 'view';
    sc.scrollTop = keepScroll ? top : 0; renderTop(); renderSide(); renderTabbar();
    var ttl = { home: 'Home', originals: 'Originals', library: 'My Library', casino: 'Casino', store: 'Store', profile: 'Profile', search: 'Search', discord: 'Discord', friends: 'Friends', hall: 'Hall of creations', trophies: 'Trophy room', admin: 'Admin tools', news: "What's New", status: 'Site status', apply: 'Apply to be a mod' }[name];
    if (!Hub.playing) document.title = (name === 'game' && Hub.byId[r.args[0]] ? Hub.byId[r.args[0]].title : (ttl || (Hub.siteName ? Hub.siteName() : 'ScrollHub'))) + ' - ' + (Hub.siteName ? Hub.siteName() : 'ScrollHub');
  };
  window.addEventListener('hashchange', function () { if (!firstRoute) Hub.hasPrev = true; firstRoute = false; if (!Hub.ready) return; Hub.render(false); });

  // ---------- views: home ----------
  var SEASONS = { xmas: 'Winter Holidays', halloween: 'Halloween', thanksgiving: 'Thanksgiving', newyear: 'New Year', valentines: 'Valentines Day', stpatricks: 'St. Patricks Day', easter: 'Easter', july4: 'Fourth of July', summer: 'Summer' };
  function genreRowList(genres, n) { var out = []; genres.forEach(function (g) { var l = Hub.visible().filter(function (x) { return x.kind === 'web' && x.cats.indexOf(g) >= 0; }).slice(0, 16); if (l.length >= 8 && out.length < n) out.push([g, l]); }); return out; }
  Hub.views.home = function () {
    var v = h('div'), orig = Hub.originals.filter(function (g) { return Hub.visible().indexOf(g) >= 0; }), vis = Hub.visible();
    var byNew = orig.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }), fresh = byNew[0] && byNew[0].ts && Date.now() - byNew[0].ts < 14 * 86400e3 ? byNew[0] : null;
    var feat = fresh || Hub.byId['scrollhub-royale'] || orig[0], second = (Hub.canCasino() ? Hub.byId['scrollhub-casino'] : null) || Hub.byId['scrollhub-bedwars'] || orig[1];
    if (feat === second) second = orig.filter(function (g) { return g !== feat; })[0];
    var jumps = [['Casino', 'dices', '#/game/scrollhub-casino', Hub.canCasino()], ['Discord', 'message-square', '#/discord', Hub.me.kind === 'user'], ['Friends', 'users', '#/friends', Hub.me.kind === 'user'], ['My Library', 'library-big', '#/library'], ['Browse games', 'shopping-bag', '#/store/all', Hub.canStore()]].filter(function (j) { return j[3] !== false && (j[0] !== 'Scroll Racing' || Hub.byId['scrollhub-racing']); });
    var blocks = []; function blk(id, label, node) { if (node) blocks.push({ id: id, label: label, node: node }); }
    blk('jump', 'Quick links', h('nav', { class: 'jump', 'aria-label': 'Quick links' }, jumps.map(function (j) { return h('a', { class: 'chip', href: j[2] }, [icon(j[1]), j[0]]); })));
    if (feat) {
      var hero = h('div', { class: 'hero' }), right = h('div', { class: 'hero-r' }), season = Hub.wallet && Hub.wallet.season, sl = SEASONS[season];
      hero.appendChild(tileLg(feat, { kicker: fresh ? 'Just updated' : 'Featured', cls: 'big', sub: fresh && fresh.notes ? 'v' + fresh.v + ': ' + fresh.notes : feat.tagline }));
      if (second) right.appendChild(tileLg(second, { kicker: 'Play now', cls: 'big', sub: second.tagline }));
      var pair = h('div', { class: 'pair' });
      if (!Hub.locked()) {
        var t1 = h('a', { class: 'tile-lg tile-sm', href: '#/store/all' }, h('div', { class: 'cap' }, [h('h3', { text: 'Browse games' }), h('p', { text: 'Every game in the store' })]));
        t1.style.background = 'linear-gradient(120deg,#0e2a6b,#0a1636)'; pair.appendChild(t1);
      } else {
        var t0 = h('div', { class: 'tile-lg tile-sm', style: 'background:linear-gradient(120deg,#0e2a6b,#0a1636)' }, h('div', { class: 'cap' }, [h('h3', { text: 'School Mode is on' }), h('p', { text: 'ScrollHub Originals are open' })])); pair.appendChild(t0);
      }
      var t2 = h('a', { class: 'tile-lg tile-sm', href: sl ? '#/game/scrollhub-arcade' : '#/originals', style: 'background:linear-gradient(120deg,#12307a,#0a1636)' }, h('div', { class: 'cap' }, [h('h3', { text: sl ? sl : 'Whats new' }), h('p', { text: sl ? 'Seasonal looks are live' : 'Latest updates' })]));
      pair.appendChild(t2); right.appendChild(pair); hero.appendChild(right); blk('hero', 'Featured games', hero);
    }
    blk('quests', 'Daily quests', Hub.questsBlock ? Hub.questsBlock() : null);
    var rec = Hub.recents(14); blk('recent', 'Continue playing', row('Continue playing', rec, { href: '#/library/games' }));
    blk('originals', 'ScrollHub Originals', row('ScrollHub Originals', orig, { href: '#/originals', sub: 'Made by ScrollHub. Updated whenever new code ships.' }));
    if (!Hub.locked()) {
      var top = Hub.webGames.slice(0, 16); blk('top', 'Top games', row('Top games', top, { href: '#/store/all', sub: 'Trending games you do not want to miss' }));
      var upd = vis.filter(function (g) { return g.ts; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 14); blk('updated', 'Recently updated', row('Recently updated', upd, { sub: 'Fresh versions pushed by ScrollHub' }));
      genreRowList(['Multiplayer', 'Racing', 'Shooter', 'Puzzle', 'Sports', 'Action'], 4).forEach(function (p) { blk('g:' + p[0], p[0] + ' games', row(p[0] + ' games', p[1], { href: '#/store/all/' + encodeURIComponent(p[0]) })); });
      blk('genres', 'Browse by genre', genrePanel());
    }
    // The player's own order and hidden rows (set under Customize home).
    var saved = Array.isArray(Hub.prefs.homeOrder) ? Hub.prefs.homeOrder : [], hide = Array.isArray(Hub.prefs.homeHide) ? Hub.prefs.homeHide : [];
    var ordered = saved.map(function (id) { return blocks.filter(function (b) { return b.id === id; })[0]; }).filter(Boolean);
    blocks.forEach(function (b) { if (ordered.indexOf(b) < 0) ordered.push(b); });
    Hub.homeDefault = blocks.map(function (b) { return b.id; });
    Hub.homeBlocks = ordered.map(function (b) { return { id: b.id, label: b.label }; });
    v.appendChild(h('div', { class: 'home-tools' }, h('button', { class: 'btn sm', type: 'button', onclick: function () { Hub.homeLayout(); } }, [icon('layout-grid'), 'Customize home'])));
    ordered.forEach(function (b) { if (hide.indexOf(b.id) < 0) v.appendChild(b.node); });
    return v;
  };
  // Reorder and hide home rows. Up and down buttons, so it works with a keyboard and on a phone.
  Hub.homeLayout = function () {
    if (!Hub.homeBlocks) { Hub.toast('Open the Home page first, then customize it.'); return; }
    var list = Hub.homeBlocks || [], order = list.map(function (b) { return b.id; }), hide = (Hub.prefs.homeHide || []).slice(), m;
    var box = h('div', { class: 'mbody' }), rows = h('div', { class: 'hc-list' });
    function commit() { Hub.setPref('homeOrder', order.slice()); Hub.setPref('homeHide', hide.slice()); if (Hub.parse().name === 'home') Hub.render(true); }
    function label(id) { return (list.filter(function (b) { return b.id === id; })[0] || {}).label || id; }
    function paint() {
      Hub.clear(rows);
      order.forEach(function (id, i) {
        var up = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Move ' + label(id) + ' up', onclick: function () { if (i > 0) { order.splice(i - 1, 0, order.splice(i, 1)[0]); commit(); paint(); } } }, icon('chevron-up'));
        var dn = h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Move ' + label(id) + ' down', onclick: function () { if (i < order.length - 1) { order.splice(i + 1, 0, order.splice(i, 1)[0]); commit(); paint(); } } }, icon('chevron-down'));
        if (i === 0) up.disabled = true; if (i === order.length - 1) dn.disabled = true;
        var show = Hub.toggle('', '', hide.indexOf(id) < 0, function (on) { var k = hide.indexOf(id); if (on && k >= 0) hide.splice(k, 1); if (!on && k < 0) hide.push(id); commit(); });
        show.setAttribute('aria-label', 'Show ' + label(id));
        rows.appendChild(h('div', { class: 'hc-row' }, [h('div', { class: 'hc-n', text: label(id) }), up, dn, show]));
      });
    }
    paint();
    box.appendChild(h('h3', { text: 'Customize home' })); box.appendChild(h('p', { class: 'hint', text: 'Move rows up or down and switch off the ones you do not want. It only changes your own home page.' })); box.appendChild(rows);
    box.appendChild(h('div', { class: 'adm-row', style: 'margin-top:16px' }, [h('button', { class: 'btn', type: 'button', text: 'Reset to default', onclick: function () { order = (Hub.homeDefault || order).slice(); hide = []; Hub.setPref('homeOrder', []); Hub.setPref('homeHide', []); if (Hub.parse().name === 'home') Hub.render(true); paint(); } })]));
    m = Hub.modal(box, { small: true, label: 'Customize home' });
  };
  function genrePanel() {
    var gs = Hub.genres().filter(function (g) { return Hub.GENRE_ICON[g]; }).slice(0, 12), grid = h('div', { class: 'genres' });
    gs.forEach(function (g) { grid.appendChild(h('a', { class: 'genre', href: '#/store/all/' + encodeURIComponent(g) }, [h('div', { class: 'gi' }, icon(Hub.GENRE_ICON[g])), h('div', { class: 'gl', text: g }), h('div', { class: 'gc', text: Hub.genreCounts[g] + ' games' })])); });
    return h('section', { class: 'genre-panel' }, [h('h2', { text: 'Browse by genre' }), grid]);
  }

  // ---------- originals ----------
  Hub.views.originals = function () {
    var v = h('div'), orig = Hub.originals.filter(function (g) { return Hub.visible().indexOf(g) >= 0; });
    v.appendChild(h('h1', { class: 'page', text: 'ScrollHub Originals' })); v.appendChild(h('p', { class: 'page-sub', text: 'Games we build and update ourselves. Install one and new versions arrive automatically.' }));
    var f = h('div', { class: 'feat' }); orig.slice(0, 6).forEach(function (g, i) { f.appendChild(tileLg(g, { kicker: i === 0 ? 'Featured' : 'Original', cls: 'big', sub: g.tagline })); }); v.appendChild(f);
    var grid = h('div', { class: 'grid', style: 'margin-top:30px' }); orig.forEach(function (g) { grid.appendChild(card(g)); });
    v.appendChild(h('div', { class: 'sec', style: 'margin-top:26px' }, [h('div', { class: 'sec-h' }, h('h2', { text: 'All originals' })), h('div', { style: 'height:12px' }), grid]));
    var feed = (Hub.manifest.feed || []).filter(function (x) { return Hub.byId[x.id]; }).slice(0, 8);
    if (feed.length) {
      var list = h('div', { class: 'list' }); feed.forEach(function (f2) { var g = Hub.byId[f2.id]; list.appendChild(h('a', { class: 'lrow', href: '#/game/' + encodeURIComponent(g.id) }, [artEl(g, 'th', true), h('div', { class: 'tx' }, [h('div', { class: 'tt', text: g.title + '  v' + f2.v }), h('div', { class: 'ss', text: f2.notes || 'New version released' })]), h('div', { class: 'rt', text: Hub.ago(f2.ts) + ' ago' })])); });
      v.appendChild(h('div', { class: 'sec' }, [h('div', { class: 'sec-h' }, h('h2', { text: 'Update log' })), h('div', { style: 'height:12px' }), list]));
    }
    return v;
  };

  // ---------- library ----------
  var libFilter = { genre: '', state: '', sort: 'recent' };
  var TABS = [['games', 'My games'], ['later', 'Play later'], ['history', 'Play history'], ['queue', 'Install queue']];
  Hub.views.library = function (a) {
    var tab = a[0] || 'games', v = h('div'), tabs = h('div', { class: 'tabs', role: 'tablist' });
    var updN = Hub.updatable().length;
    TABS.forEach(function (t) { tabs.appendChild(h('a', { class: 'tab' + (t[0] === tab ? ' on' : ''), href: '#/library/' + t[0], role: 'tab', 'aria-selected': t[0] === tab ? 'true' : 'false' }, [t[1], t[0] === 'queue' && updN ? h('span', { class: 'n', text: String(updN) }) : null])); });
    v.appendChild(tabs);
    if (tab === 'games') libGames(v); else if (tab === 'later') libLater(v); else if (tab === 'history') libHistory(v); else libQueue(v);
    return v;
  };
  function libGames(v) {
    var all = Hub.owned(), list = all.filter(function (g) {
      if (libFilter.genre && g.cats.indexOf(libFilter.genre) < 0) return false;
      var st = Hub.status(g).k; if (libFilter.state === 'inst' && !Hub.isInstalled(g)) return false; if (libFilter.state === 'upd' && st !== 'upd') return false; if (libFilter.state === 'none' && Hub.isInstalled(g)) return false; return true;
    });
    if (libFilter.sort === 'az') list.sort(function (a, b) { return a.title.localeCompare(b.title); }); else if (libFilter.sort === 'new') list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }); else list.sort(function (a, b) { return Hub.lastUsed(b) - Hub.lastUsed(a); });
    var gen = []; all.forEach(function (g) { g.cats.forEach(function (c) { if (gen.indexOf(c) < 0) gen.push(c); }); }); gen.sort();
    var STATES = [['', 'All games'], ['inst', 'Installed'], ['upd', 'Update available'], ['none', 'Not installed']], SORTS = [['recent', 'Last used'], ['az', 'Name (A to Z)'], ['new', 'Recently updated']];
    var bar = h('div', { class: 'toolbar' }), chipF = h('button', { class: 'chip' + (libFilter.genre || libFilter.state ? ' on' : ''), type: 'button', 'aria-label': 'Filters' }, icon('list-filter'));
    chipF.addEventListener('click', function () { libFilter = { genre: '', state: '', sort: libFilter.sort }; Hub.render(true); });
    var chG = h('button', { class: 'chip' + (libFilter.genre ? ' on' : ''), type: 'button', 'aria-haspopup': 'menu' }, [libFilter.genre || 'Genre', icon('chevron-down')]);
    chG.addEventListener('click', function () { Hub.menu(chG, [{ label: 'All genres', on: !libFilter.genre, fn: function () { libFilter.genre = ''; Hub.render(true); } }].concat(gen.map(function (g) { return { label: g, on: libFilter.genre === g, fn: function () { libFilter.genre = g; Hub.render(true); } }; }))); });
    var stl = STATES.filter(function (s) { return s[0] === libFilter.state; })[0][1], chS = h('button', { class: 'chip' + (libFilter.state ? ' on' : ''), type: 'button', 'aria-haspopup': 'menu' }, [libFilter.state ? stl : 'Play state', icon('chevron-down')]);
    chS.addEventListener('click', function () { Hub.menu(chS, STATES.map(function (s) { return { label: s[1], on: libFilter.state === s[0], fn: function () { libFilter.state = s[0]; Hub.render(true); } }; })); });
    var sl = SORTS.filter(function (s) { return s[0] === libFilter.sort; })[0][1], chO = h('button', { class: 'chip', type: 'button', 'aria-haspopup': 'menu' }, [icon('trending-up'), sl, icon('chevron-down')]);
    chO.addEventListener('click', function () { Hub.menu(chO, SORTS.map(function (s) { return { label: s[1], on: libFilter.sort === s[0], fn: function () { libFilter.sort = s[0]; Hub.render(true); } }; })); });
    var add = h('a', { class: 'iconbtn', href: Hub.canStore() ? '#/store' : '#/originals', 'aria-label': 'Find games to add' }, icon('plus')); add.style.border = '1px solid var(--stroke2)'; add.style.borderRadius = '50%';
    bar.appendChild(chipF); bar.appendChild(chG); bar.appendChild(chS); bar.appendChild(chO); bar.appendChild(h('span', { class: 'count', text: list.length + (list.length === 1 ? ' game' : ' games') })); bar.appendChild(add); v.appendChild(bar);
    if (!all.length) { v.appendChild(emptyState('library-big', 'Your library is empty', 'Games you install or play show up here. Start with a ScrollHub Original.', h('a', { class: 'btn primary', href: '#/originals', text: 'Browse Originals' }))); return; }
    if (!list.length) { v.appendChild(emptyState('list-filter', 'No games match these filters', 'Clear a filter to see more of your library.')); return; }
    var grid = h('div', { class: 'grid' }); list.forEach(function (g) { grid.appendChild(card(g)); }); v.appendChild(grid);
  }
  function libLater(v) {
    var l = Hub.later(); v.appendChild(h('h1', { class: 'page', text: 'Play later' })); v.appendChild(h('p', { class: 'page-sub', text: 'Games you saved for another day.' }));
    if (!l.length) { v.appendChild(emptyState('bookmark-plus', 'Nothing saved yet', 'Use the bookmark button on any game page to keep it here.', h('a', { class: 'btn primary', href: '#/home', text: 'Find something to play' }))); return; }
    var grid = h('div', { class: 'grid' }); l.forEach(function (g) { grid.appendChild(card(g)); }); v.appendChild(grid);
  }
  function dayBucket(ts) { var d = new Date(); d.setHours(0, 0, 0, 0); var t = d.getTime(); if (ts >= t) return 'Today'; if (ts >= t - 86400e3) return 'Yesterday'; if (ts >= t - 6 * 86400e3) return 'This week'; return 'Older'; }
  function libHistory(v) {
    var hist = Hub.lib.hist.filter(function (x) { return Hub.byId[x.id] && Hub.visible().indexOf(Hub.byId[x.id]) >= 0; }), uniq = {}; hist.forEach(function (x) { uniq[x.id] = 1; });
    var top = h('div', { class: 'toolbar' }, [h('span', { style: 'color:var(--text2)', text: 'Showing your last ' + Math.min(hist.length, 60) + ' sessions' }), h('span', { class: 'count', text: Object.keys(uniq).length + ' games' })]); v.appendChild(top);
    if (!hist.length) { v.appendChild(emptyState('history', 'No play history yet', 'Launch a game and it will be listed here.', h('a', { class: 'btn primary', href: '#/home', text: 'Browse games' }))); return; }
    var cur = '', list = null; hist.slice(0, 60).forEach(function (x) {
      var b = dayBucket(x.at); if (b !== cur) { cur = b; v.appendChild(h('h2', { class: 'group-h', text: b })); list = h('div', { class: 'list' }); v.appendChild(list); }
      var g = Hub.byId[x.id]; list.appendChild(h('a', { class: 'lrow', href: '#/game/' + encodeURIComponent(g.id) }, [artEl(g, 'th', true), h('div', { class: 'tx' }, [h('div', { class: 'tt', text: g.title }), h('div', { class: 'ss', text: 'Played ' + Hub.dateLong(x.at) })]), h('div', { class: 'rt' }, [icon(Hub.pickDevice(), ''), h('span', { text: 'via ' + Hub.deviceName() })])]));
    });
  }
  function libQueue(v) {
    var upd = Hub.updatable(), active = Hub.dl.order.map(function (i) { return Hub.byId[i]; }).filter(Boolean);
    var bar = h('div', { class: 'toolbar' }, [h('button', { class: 'btn sm primary', type: 'button', onclick: function () { var n = Hub.updateAll(); Hub.toast(n ? 'Updating ' + n + (n === 1 ? ' game' : ' games') : 'Everything is up to date', { icon: 'refresh-cw' }); Hub.render(true); } }, [icon('arrow-down-to-line'), 'Update all' + (upd.length ? ' (' + upd.length + ')' : '')]),
      h('button', { class: 'btn sm', type: 'button', onclick: function (e) { var b = e.currentTarget; b.disabled = true; Hub.checkUpdates(false).then(function () { b.disabled = false; Hub.render(true); }); } }, [icon('refresh-cw'), 'Check for updates']),
      h('span', { class: 'count', text: Hub.lib.checked ? 'Last checked ' + Hub.ago(Hub.lib.checked) + ' ago' : 'Not checked yet' })]);
    v.appendChild(bar);
    var q = h('div', { class: 'list' });
    active.forEach(function (g) { var d = Hub.dl.items[g.id]; q.appendChild(h('div', { class: 'lrow' }, [artEl(g, 'th', true), h('div', { class: 'tx' }, [h('div', { class: 'tt', text: g.title }), h('div', { class: 'ss', text: d.state === 'queued' ? 'Waiting in queue' : (d.update ? 'Updating to v' + g.v : 'Installing v' + g.v) }), h('div', { class: 'bar' }, slot(g, 'rec', 'slot'))]), d.state === 'queued' ? h('button', { class: 'btn sm', type: 'button', onclick: function () { Hub.cancelInstall(g); Hub.render(true); } }, 'Cancel') : null])); });
    upd.filter(function (g) { return !Hub.dl.items[g.id]; }).forEach(function (g) { q.appendChild(h('div', { class: 'lrow' }, [artEl(g, 'th', true), h('div', { class: 'tx' }, [h('div', { class: 'tt', text: g.title }), h('div', { class: 'ss', text: 'Update to ' + Hub.buildLabel(g) + (g.notes ? '. ' + g.notes : '') })]), h('button', { class: 'btn sm primary', type: 'button', onclick: function () { Hub.install(g); Hub.render(true); } }, 'Update')])); });
    if (q.children.length) { v.appendChild(h('h2', { class: 'group-h', style: 'margin-top:8px', text: 'In progress and waiting' })); v.appendChild(q); }
    else v.appendChild(emptyState('package-check', 'Everything is up to date', 'Installs and updates show up here while they download.'));
    var done = Hub.dl.done.filter(function (x) { return Hub.byId[x.id]; }); if (done.length) {
      v.appendChild(h('h2', { class: 'group-h', text: 'Recently completed' })); var l2 = h('div', { class: 'list' }); done.slice(0, 8).forEach(function (x) { var g = Hub.byId[x.id]; l2.appendChild(h('a', { class: 'lrow', href: '#/game/' + encodeURIComponent(g.id) }, [artEl(g, 'th', true), h('div', { class: 'tx' }, [h('div', { class: 'tt', text: g.title }), h('div', { class: 'ss', text: (x.update ? 'Updated to v' : 'Installed v') + x.v + ', ' + Hub.ago(x.at) + ' ago' })]), h('div', { class: 'rt' }, icon('circle-check'))])); }); v.appendChild(l2);
    }
    var inst = Object.keys(Hub.lib.inst).map(function (i) { return Hub.byId[i]; }).filter(Boolean);
    if (inst.length) { v.appendChild(h('h2', { class: 'group-h', text: 'Installed (' + Hub.bytes(Hub.storageUsed()) + ')' })); var l3 = h('div', { class: 'list' }); inst.forEach(function (g) { var rec = Hub.lib.inst[g.id]; l3.appendChild(h('a', { class: 'lrow', href: '#/game/' + encodeURIComponent(g.id) }, [artEl(g, 'th', true), h('div', { class: 'tx' }, [h('div', { class: 'tt', text: g.title }), h('div', { class: 'ss', text: 'v' + rec.v + (rec.rev ? ' build ' + rec.rev : '') + ', ' + Hub.bytes(rec.size || 0) })]), h('div', { class: 'rt' }, Hub.needsUpdate(g) ? h('span', { class: 'tag blue', text: 'Update available' }) : icon('circle-check'))])); }); v.appendChild(l3); }
  }

  // ---------- store ----------
  var QUICK_LIST = null;
  Hub.views.store = function (a) {
    if (a[0] === 'all') return storeAll(a[1] || '');
    var v = h('div'), web = Hub.webGames; v.appendChild(h('h1', { class: 'page', text: 'Store' })); v.appendChild(h('h2', { style: 'margin:6px 0 14px;font-size:24px;font-weight:600', text: 'Featured' }));
    var f = h('div', { class: 'feat' }); Hub.originals.slice(0, 2).concat(web.slice(0, 4)).forEach(function (g, i) { f.appendChild(tileLg(g, { kicker: g.kind === 'original' ? 'Original' : 'Popular', cls: 'big', sub: g.tagline || g.cats.slice(0, 3).join(', ') })); }); v.appendChild(f);
    var q = h('div', { class: 'quick' }); [['All games', 'layout-grid', '#/store/all'], ['Multiplayer', 'users', '#/store/all/Multiplayer'], ['Racing', 'car', '#/store/all/Racing']].forEach(function (x) { q.appendChild(h('button', { type: 'button', onclick: function () { location.hash = x[2]; } }, [icon(x[1]), x[0]])); });
    q.appendChild(h('button', { type: 'button', onclick: function () { Hub.redeemModal(); } }, [icon('ticket'), 'Redeem a code'])); v.appendChild(q);
    var r1 = row('Top games', web.slice(0, 16), { href: '#/store/all', sub: 'Trending games you do not want to miss' }); if (r1) v.appendChild(r1);
    Hub.genres().slice(0, 9).forEach(function (g) { var l = web.filter(function (x) { return x.cats.indexOf(g) >= 0; }).slice(0, 16); var rr = row(g + ' games', l, { href: '#/store/all/' + encodeURIComponent(g) }); if (rr) v.appendChild(rr); });
    v.appendChild(genrePanel()); return v;
  };
  var allState = { genre: '', sort: 'pop' };
  function storeAll(genre) {
    allState.genre = genre ? decodeURIComponent(genre) : ''; var v = h('div'), SORTS = [['pop', 'Popular'], ['az', 'Name (A to Z)'], ['za', 'Name (Z to A)'], ['new', 'Recently updated']];
    v.appendChild(h('h1', { class: 'page', text: allState.genre ? allState.genre + ' games' : 'All games' }));
    var bar = h('div', { class: 'toolbar' }), gens = Hub.genres();
    var chG = h('button', { class: 'chip' + (allState.genre ? ' on' : ''), type: 'button', 'aria-haspopup': 'menu' }, [allState.genre || 'All genres', icon('chevron-down')]);
    chG.addEventListener('click', function () { Hub.menu(chG, [{ label: 'All genres', on: !allState.genre, fn: function () { location.hash = '#/store/all'; } }].concat(gens.map(function (g) { return { label: g, right: String(Hub.genreCounts[g]), on: allState.genre === g, fn: function () { location.hash = '#/store/all/' + encodeURIComponent(g); } }; }))); });
    var cur = SORTS.filter(function (s) { return s[0] === allState.sort; })[0], chS = h('button', { class: 'chip', type: 'button', 'aria-haspopup': 'menu' }, [icon('trending-up'), cur[1], icon('chevron-down')]);
    var countEl = h('span', { class: 'count' });
    bar.appendChild(chG); bar.appendChild(chS); bar.appendChild(countEl); v.appendChild(bar);
    var grid = h('div', { class: 'grid' }), sentinel = h('div', { style: 'height:1px' }), list = [], shown = 0;
    function build() {
      list = Hub.visible().filter(function (g) { return g.kind === 'web' || true; }).filter(function (g) { return !allState.genre || g.cats.indexOf(allState.genre) >= 0; });
      if (allState.sort === 'az') list = list.slice().sort(function (a, b) { return a.title.localeCompare(b.title); }); else if (allState.sort === 'za') list = list.slice().sort(function (a, b) { return b.title.localeCompare(a.title); }); else if (allState.sort === 'new') list = list.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      Hub.clear(grid); shown = 0; countEl.textContent = Hub.num(list.length) + ' games'; more();
    }
    function more() { var end = Math.min(list.length, shown + 48); for (; shown < end; shown++) grid.appendChild(card(list[shown])); }
    chS.addEventListener('click', function () { Hub.menu(chS, SORTS.map(function (s) { return { label: s[1], on: allState.sort === s[0], fn: function () { allState.sort = s[0]; chS.lastChild.previousSibling.textContent = s[1]; build(); } }; })); });
    v.appendChild(grid); v.appendChild(sentinel); build();
    if (window.IntersectionObserver) { var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting && shown < list.length) more(); }, { root: $('#scroll'), rootMargin: '900px' }); io.observe(sentinel); }
    else { var b = h('div', { class: 'more' }, h('button', { class: 'btn', type: 'button', text: 'Show more', onclick: more })); v.appendChild(b); }
    return v;
  }
  Hub.views.genre = function (a) { location.replace('#/store/all/' + encodeURIComponent(a[0] || '')); return h('div'); };
  Hub.views.search = function (a) {
    var q = a[0] || '', v = h('div'), res = Hub.search(q, 600);
    v.appendChild(h('h1', { class: 'page', text: 'Results for "' + q + '"' })); v.appendChild(h('p', { class: 'page-sub', text: res.length ? Hub.num(res.length) + (res.length === 1 ? ' game found' : ' games found') : '' }));
    if (!res.length) { v.appendChild(emptyState('search', 'No games found', 'Check the spelling or try a shorter name, like "road" or "run".', Hub.canStore() ? h('a', { class: 'btn primary', href: '#/store/all', text: 'Browse all games' }) : null)); return v; }
    var grid = h('div', { class: 'grid' }), shown = 0, sentinel = h('div', { style: 'height:1px' });
    function more() { var end = Math.min(res.length, shown + 48); for (; shown < end; shown++) grid.appendChild(card(res[shown])); }
    more(); v.appendChild(grid); v.appendChild(sentinel);
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { if (e[0].isIntersecting && shown < res.length) more(); }, { root: $('#scroll'), rootMargin: '900px' }).observe(sentinel);
    return v;
  };

  // ---------- game page ----------
  Hub.views.game = function (a) {
    var g = Hub.byId[a[0]]; var vis = g && Hub.visible().indexOf(g) >= 0;
    if (!g || !vis) return emptyState('search', 'Game not found', 'That game is not available here.', h('a', { class: 'btn primary', href: '#/home', text: 'Back to Home' }));
    var v = h('div', { class: 'gp' }), st = Hub.status(g), rec = Hub.lib.inst[g.id];
    if (g.art) { var bk = h('div', { class: 'gp-back' }, h('img', { src: g.art, alt: '', referrerpolicy: 'no-referrer', onerror: function (e) { e.target.style.display = 'none'; } })); v.appendChild(bk); }
    var cover = artEl(g, 'gp-cover');
    var info = h('div', { class: 'gp-info' }); info.appendChild(h('h1', { text: g.title }));
    var meta = h('div', { class: 'gp-meta' }, [h('span', { text: g.dev })]); (g.cats.length ? g.cats : []).slice(0, 4).forEach(function (c) { meta.appendChild(h('a', { class: 'tag', href: Hub.canStore() ? '#/store/all/' + encodeURIComponent(c) : '#/originals', text: c })); }); if (g.kind === 'original') meta.appendChild(h('span', { class: 'tag blue', text: 'Original' }));
    info.appendChild(meta);
    var act = h('div', { class: 'gp-act' }), inst = Hub.isInstalled(g), upd = Hub.needsUpdate(g);
    function play() { Hub.play(g); }
    if (st.k === 'dl' || st.k === 'queued') {
      act.appendChild(h('button', { class: 'btn primary', type: 'button', disabled: true }, [icon('loader'), st.k === 'queued' ? 'Queued' : (st.update ? 'Updating' : 'Installing')]));
      if (st.k === 'queued') act.appendChild(h('button', { class: 'btn', type: 'button', onclick: function () { Hub.cancelInstall(g); } }, 'Cancel'));
    } else if (!inst) {
      act.appendChild(h('button', { class: 'btn primary', type: 'button', onclick: function () { Hub.install(g); } }, [icon('download'), 'Install']));
      act.appendChild(h('button', { class: 'btn', type: 'button', onclick: play }, [icon('play'), 'Play now']));
    } else if (upd) {
      act.appendChild(h('button', { class: 'btn primary', type: 'button', onclick: function () { Hub.install(g); } }, [icon('arrow-down-to-line'), 'Update to v' + g.v]));
      act.appendChild(h('button', { class: 'btn', type: 'button', onclick: play }, [icon('play'), 'Play']));
    } else act.appendChild(h('button', { class: 'btn primary', type: 'button', onclick: play }, [icon('play'), 'Play']));
    var later = !!Hub.lib.later[g.id];
    act.appendChild(h('button', { class: 'iconbtn', style: 'border:1px solid var(--stroke2);border-radius:12px;width:46px;height:46px', type: 'button', 'aria-label': later ? 'Remove from Play later' : 'Play later', title: later ? 'Saved for later' : 'Play later', onclick: function () { Hub.toggleLater(g); } }, icon(later ? 'bookmark-check' : 'bookmark-plus')));
    var more = h('button', { class: 'iconbtn', style: 'border:1px solid var(--stroke2);border-radius:12px;width:46px;height:46px', type: 'button', 'aria-label': 'More options', 'aria-haspopup': 'menu' }, icon('ellipsis'));
    more.addEventListener('click', function () {
      var items = [{ label: 'Copy link', icon: 'link', fn: function () { var u = location.origin + '/hub/#/game/' + encodeURIComponent(g.id); if (navigator.clipboard) navigator.clipboard.writeText(u).then(function () { Hub.toast('Link copied', { icon: 'link' }); }, function () { Hub.toast(u); }); else Hub.toast(u); } }, { label: 'Open in a new tab', icon: 'external-link', fn: function () { window.open(Hub.launchUrl(g), '_blank', 'noopener'); } }];
      if (inst) items.push({ sep: true }, { label: 'Check for update', icon: 'refresh-cw', fn: function () { Hub.checkUpdates(false); } }, { label: 'Uninstall', icon: 'trash-2', danger: true, fn: function () { Hub.uninstall(g); } });
      Hub.menu(more, items, { align: 'right' });
    });
    act.appendChild(more); info.appendChild(act);
    if (st.k === 'dl') { var pr = h('div', { class: 'gp-prog' }, [h('div', { class: 'row2' }, [h('span', { text: st.update ? 'Updating' : 'Downloading' }), h('span', { class: 'slot', 'data-g': g.id, 'data-mode': 'rec' })]), h('div', { class: 'mini-bar' }, h('i', { 'data-gprog': g.id, style: 'width:' + Math.round(st.pct) + '%' }))]); info.appendChild(pr); }
    v.appendChild(h('div', { class: 'gp-head' }, [cover, info]));
    var stats = h('div', { class: 'stats' });
    function stat(k, val) { stats.appendChild(h('div', { class: 'stat' }, [h('div', { class: 'k', text: k }), h('div', { class: 'v', text: val })])); }
    stat('Version', 'v' + g.v + (g.rev ? ' / ' + g.rev : '')); stat('Status', upd ? 'Update available' : inst ? 'Installed' : 'Not installed'); stat('Players', g.players || (g.cats.indexOf('Multiplayer') >= 0 ? 'Multiplayer' : 'Single player')); stat('Installed size', rec ? Hub.bytes(rec.size || 0) : 'Not installed'); stat('Updated', g.ts ? Hub.dateShort(g.ts) : 'Launch version'); v.appendChild(stats);
    var desc = g.desc || (g.cats.length ? g.title + ' is a ' + g.cats.slice(0, 3).join(', ').toLowerCase() + ' game. Install it to keep it in your library and get new versions as they are published.' : g.title + '. Install it to keep it in your library and get new versions as they are published.');
    v.appendChild(h('div', { class: 'rel' }, [h('div', { class: 'panel' }, [h('h3', { text: 'About this game' }), h('p', { text: desc })]),
      h('div', { class: 'panel' }, [h('h3', { text: "What's new" }), changelog(g)])]));
    var rel = row('More like this', Hub.related(g, 14), {}); if (rel) v.appendChild(rel);
    if (Hub.me.owner) v.appendChild(ownerPanel(g));
    return v;
  };
  function changelog(g) {
    var hist = (g.hist || []).slice(0, 4), box = h('div', { class: 'chlog' });
    if (!hist.length) { box.appendChild(h('div', { class: 'it' }, [h('span', { class: 'vv', text: 'v' + g.v }), h('div', {}, [h('div', { class: 'nn', text: 'Launch version.' })])])); return box; }
    hist.forEach(function (x) { box.appendChild(h('div', { class: 'it' }, [h('span', { class: 'vv', text: 'v' + x.v }), h('div', {}, [h('div', { class: 'nn', text: x.notes || 'Improvements and fixes.' }), h('div', { class: 'dd', text: Hub.dateShort(x.ts) })])])); });
    return box;
  }
  function ownerPanel(g) {
    var notes = h('textarea', { class: 'input', placeholder: 'What changed in this update? Players see this in their update notice.', maxlength: '600', 'aria-label': 'Release notes' }), ver = h('input', { class: 'input', placeholder: 'Version (optional, for example ' + g.v.replace(/\d+$/, function (n) { return +n + 1; }) + ')', maxlength: '12', 'aria-label': 'Version', style: 'margin-top:10px' });
    var btn = h('button', { class: 'btn primary', type: 'button', style: 'margin-top:12px' }, [icon('send'), 'Publish update']);
    btn.addEventListener('click', function () { btn.disabled = true; Hub.publish(g, notes.value, ver.value.trim()).then(function () { btn.disabled = false; notes.value = ''; ver.value = ''; Hub.render(true); }); });
    return h('div', { class: 'panel' }, [h('h3', { text: 'Owner tools' }), h('p', { text: 'Publishing bumps the version for everyone. Players who installed this game get an Update prompt, or it updates itself if they have auto-update on.' + (g.kind === 'original' ? ' New code you deploy is detected automatically as build ' + (g.rev || 'n/a') + '.' : '') }), h('div', { style: 'margin-top:14px' }, [notes, ver, btn])]);
  }

  // ---------- casino page ----------
  var CASINO = [['Crash', 'trending-up', 'Cash out before it crashes'], ['Blackjack', 'dices', 'Beat the dealer to 21'], ['Slots', 'sparkles', 'Spin for matching symbols'], ['Roulette', 'circle-dot', 'Pick a number or a color'], ['Mines', 'bomb', 'Find gems, dodge mines'], ['Plinko', 'target', 'Drop the ball, chase the multiplier'], ['Case Battles', 'swords', 'Open cases against other players'], ['Coinflip', 'coins', 'Heads or tails, double or nothing']];
  Hub.views.casino = function () {
    var g = Hub.byId['scrollhub-casino'], v = h('div');
    v.appendChild(h('h1', { class: 'page', text: 'Casino' })); v.appendChild(h('p', { class: 'page-sub', text: 'Play money only. Scrolls are an in-game currency with no real value.' }));
    if (g) v.appendChild(tileLg(g, { kicker: 'Original', cls: 'big', sub: g.tagline }));
    v.appendChild(rewardCard());
    var grid = h('div', { class: 'genres', style: 'margin-top:26px' }); CASINO.forEach(function (c) { grid.appendChild(h('a', { class: 'genre', href: g ? '#/game/' + g.id : '#/home' }, [h('div', { class: 'gi' }, icon(c[1])), h('div', { class: 'gl', text: c[0] }), h('div', { class: 'gc', text: c[2] })])); });
    v.appendChild(h('section', { class: 'genre-panel' }, [h('h2', { text: 'On the casino floor' }), grid]));
    return v;
  };
  function rewardCard() {
    var w = Hub.wallet, ready = Hub.dailyReady(), streak = w && w.profile ? (w.profile.streak || 0) : 0, left = 0;
    if (w && w.profile && !ready) left = (w.dailyMs || 86400000) - (Date.now() - w.profile.lastDaily);
    var track = h('div', { class: 'streak' }); for (var i = 0; i < 7; i++) track.appendChild(h('i', { class: i < (streak % 7 === 0 && streak > 0 ? 7 : streak % 7) ? 'f' : '' }));
    var btn = h('button', { class: 'btn primary', type: 'button', disabled: !ready }, [icon('gift'), ready ? 'Claim ' + Hub.num(Hub.dailyNext()) : 'Come back in ' + Math.max(1, Math.ceil(left / 3600e3)) + 'h']);
    btn.addEventListener('click', function () { btn.disabled = true; Hub.claimDaily().then(function () { Hub.render(true); }); });
    return h('div', { class: 'reward' }, [h('div', { class: 'ri' }, icon('gift')), h('div', { class: 'rt' }, [h('b', { text: 'Daily reward' }), h('span', { text: 'Streak: ' + streak + (streak === 1 ? ' day' : ' days') + '. A bonus lands every 7th day.' }), track]), btn]);
  }
  Hub.rewardCard = rewardCard;

  // ---------- live refresh ----------
  var refreshSide = Hub.debounce(function () { if (!Hub.ready) return; renderSide(); renderTabbar(); }, 60);
  Hub.on('dl', function (g) { paint(g); refreshSide(); var n = Hub.parse(); if (n.name === 'game' && n.args[0] === g.id) Hub.render(true); if (n.name === 'library' && n.args[0] === 'queue') Hub.render(true); });
  Hub.on('dlprog', function (g) { paint(g); var d = Hub.dl.items[g.id]; if (d) { $$('[data-gprog="' + g.id + '"]').forEach(function (e) { e.style.width = Math.round(d.shown) + '%'; }); } });
  Hub.on('lib', function () { paintAll(); refreshSide(); var n = Hub.parse(); if (['library', 'game', 'originals'].indexOf(n.name) >= 0) Hub.render(true); });
  Hub.on('wallet', function () { refreshSide(); var n = Hub.parse(); if (n.name === 'casino') Hub.render(true); });
  Hub.on('notifs', function () { refreshSide(); renderTop(); });
  Hub.on('friends', function () { refreshSide(); });
  Hub.on('upd', function () { refreshSide(); });
  Hub.on('manifest', function () { if (!Hub.ready) return; var n = Hub.parse(); refreshSide(); if (n.name === 'game' || n.name === 'originals' || n.name === 'home') Hub.render(true); });
  Hub.on('school', function () { if (Hub.ready) Hub.render(true); });
  Hub.renderChrome = function () { renderSide(); renderTop(); renderTabbar(); };
  Hub.card = card; Hub.row = row; Hub.emptyState = emptyState; Hub.tileLg = tileLg;
})();
