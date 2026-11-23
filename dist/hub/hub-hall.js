/* ScrollHub Hub: Hall of creations. Every gim, hat, banner, name tag and map that a player made and the owner approved. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var h = Hub.h, icon = Hub.icon, CH = '0123456789abcdefghijklmnopqrstuv';
  var TYPE = { skin: 'Gim', hat: 'Hat', acc: 'Accessory', banner: 'Banner', tag: 'Name tag' }, GAME = { bw: 'Bedwars', ctf: 'Capture the Flag', spleef: 'TNT Spleef', hide: 'Prop Hunt' };

  function pic(it) {
    if (it.type === 'banner') { var b = h('div', { class: 'hl-pic wide' }); b.style.background = String(it.value || ''); return b; }
    if (it.type === 'tag') return h('div', { class: 'hl-pic wide hl-tag', text: Hub.clean(it.label) });
    var d = it.sprite; if (!d || !d.px) return h('div', { class: 'hl-pic' });
    var c = h('canvas', { width: '32', height: '32', class: 'hl-pic', 'aria-label': Hub.clean(it.label) }), x = c.getContext('2d'), frames = [d.px].concat(d.frames || []), fi = 0;
    function draw() { x.clearRect(0, 0, 32, 32); var px = frames[fi % frames.length]; for (var i = 0; i < 1024; i++) { var k = CH.indexOf(px[i]); if (k > 0 && d.pal[k - 1]) { x.fillStyle = d.pal[k - 1]; x.fillRect(i % 32, (i / 32) | 0, 1, 1); } } fi++; }
    draw(); if (frames.length > 1) { var t = setInterval(function () { if (!c.isConnected) { clearInterval(t); return; } draw(); }, Math.max(66, 1000 / (d.fps || 6))); }
    return c;
  }
  var RANKS = [[15, 'Master maker'], [5, 'Artisan'], [1, 'Creator']];
  Hub.creatorRank = function (n) { for (var i = 0; i < RANKS.length; i++) if (n >= RANKS[i][0]) return RANKS[i][1]; return ''; };
  function likeBtn(it, key, data) {
    var b = h('button', { type: 'button', class: 'hl-like' + (it.liked ? ' on' : ''), 'aria-pressed': it.liked ? 'true' : 'false', 'aria-label': 'Like ' + Hub.clean(it.label || it.name) }, [icon('heart'), h('span', { text: String(it.likes || 0) })]);
    b.addEventListener('click', function () {
      if (!data.me) { Hub.toast('Sign in to like creations.'); return; }
      Hub.api('/api/hall', { body: { key: key } }).then(function (r) { if (!r || r.error) { Hub.toast((r && r.message) || 'Could not like that.'); return; } it.liked = r.liked; it.likes = r.n; b.classList.toggle('on', r.liked); b.setAttribute('aria-pressed', r.liked ? 'true' : 'false'); b.lastChild.textContent = String(r.n); });
    });
    return b;
  }
  function by(name) { return h('a', { class: 'hl-by', href: '#/profile/' + encodeURIComponent(name), text: 'by ' + Hub.clean(name) }); }

  // Creator chip on profiles: Hub.creatorChip(name, el) adds the rank next to the name if they have approved creations.
  var cache = null;
  Hub.creatorChip = function (name, el) {
    function put(d) { var m = (d.makers || []).filter(function (x) { return String(x.name).toLowerCase() === String(name).toLowerCase(); })[0]; if (!m || !el.isConnected) return; el.appendChild(h('span', { class: 'hl-badge', text: Hub.creatorRank(m.items), title: m.items + ' approved creations, ' + m.likes + ' likes' })); }
    if (cache) put(cache); else Hub.api('/api/hall').then(function (r) { if (r && r.ok) { cache = r; put(r); } });
  };
  Hub.views.hall = function () {
    var v = h('div', { class: 'hl-page' }), grid = h('div', { class: 'hl-grid' }), tab = 'gear', type = '', data = null, sort = 'new';
    v.appendChild(h('h1', { class: 'page', text: 'Hall of creations' }));
    v.appendChild(h('p', { class: 'page-sub', text: 'Gims, hats, banners, name tags and maps that players made and Scrollreader11 approved. Make your own in the Sprite Studio or the map builder in Games.' }));
    var tabs = h('div', { class: 'hl-tabs' }), chips = h('div', { class: 'hl-chips' });
    v.appendChild(tabs); v.appendChild(chips); v.appendChild(grid);
    function paintTabs() {
      Hub.clear(tabs); [['gear', 'Gims and gear'], ['maps', 'Maps'], ['makers', 'Top makers']].forEach(function (t) { tabs.appendChild(h('button', { type: 'button', class: 'hl-tab' + (tab === t[0] ? ' on' : ''), text: t[1] + (data && t[0] !== 'makers' ? ' (' + (t[0] === 'gear' ? data.sprites.length : data.maps.length) + ')' : ''), onclick: function () { tab = t[0]; type = ''; paint(); } })); });
      Hub.clear(chips); if (tab === 'makers' || !data) return;
      var so = h('select', { class: 'hl-sort', 'aria-label': 'Sort' }, [h('option', { value: 'new', text: 'Newest' }), h('option', { value: 'likes', text: 'Most liked' })]); so.value = sort; so.addEventListener('change', function () { sort = so.value; paint(); });
      if (tab === 'maps') { chips.appendChild(so); return; }
      [['', 'All']].concat(Object.keys(TYPE).map(function (k) { return [k, TYPE[k]]; })).forEach(function (t) { chips.appendChild(h('button', { type: 'button', class: 'hl-chip' + (type === t[0] ? ' on' : ''), text: t[1], onclick: function () { type = t[0]; paint(); } })); });
    chips.appendChild(so);
    }
    function sorted(l) { return l.slice().sort(function (a, b) { return sort === 'likes' ? (b.likes - a.likes) || (b.at - a.at) : b.at - a.at; }); }
    function paint() {
      paintTabs(); Hub.clear(grid);
      if (!data) { for (var i = 0; i < 6; i++) grid.appendChild(h('div', { class: 'skel', style: 'height:150px;border-radius:16px' })); return; }
      if (tab === 'makers') {
        if (!data.makers.length) { grid.appendChild(Hub.emptyState('sparkles', 'No makers yet', 'Be the first: make something in the Sprite Studio or the map builder.')); return; }
        grid.className = 'hl-list';
        data.makers.forEach(function (m, i) { grid.appendChild(h('div', { class: 'hl-mk' }, [h('div', { class: 'hl-rk', text: String(i + 1) }), h('a', { class: 'hl-mn', href: '#/profile/' + encodeURIComponent(m.name), text: Hub.clean(m.name) }), h('span', { class: 'hl-badge', text: Hub.creatorRank(m.items) }), h('div', { class: 'hl-ms', text: m.items + (m.items === 1 ? ' creation' : ' creations') + ' \u00b7 ' + m.likes + (m.likes === 1 ? ' like' : ' likes') })])); });
        return;
      }
      grid.className = 'hl-grid';
      if (tab === 'gear') {
        var l = sorted(data.sprites.filter(function (x) { return !type || x.type === type; }));
        if (!l.length) { grid.appendChild(Hub.emptyState('sparkles', 'Nothing here yet', 'When the owner approves a creation it shows up here with the maker’s name.')); return; }
        l.forEach(function (it) { grid.appendChild(h('div', { class: 'hl-card r-' + it.rarity }, [pic(it), h('div', { class: 'hl-n', text: Hub.clean(it.label) }), h('div', { class: 'hl-m', text: (TYPE[it.type] || it.type) + ' · ' + it.rarity }), by(it.by), likeBtn(it, 's:' + it.id, data)])); });
      } else {
        if (!data.maps.length) { grid.appendChild(Hub.emptyState('sparkles', 'No player maps yet', 'Approved maps from the map builder appear here.')); return; }
        sorted(data.maps).forEach(function (m) { grid.appendChild(h('div', { class: 'hl-card hl-map' }, [h('div', { class: 'hl-pic wide hl-gm', text: GAME[m.game] || m.game }), h('div', { class: 'hl-n', text: Hub.clean(m.name) }), h('div', { class: 'hl-m', text: m.walls + ' blocks · ' + m.props + ' props · in the rotation' }), m.desc ? h('div', { class: 'hl-m', text: Hub.clean(m.desc) }) : null, by(m.by), likeBtn(m, 'm:' + m.id, data)])); });
      }
    }
    paint();
    Hub.api('/api/hall').then(function (r) { if (!v.isConnected) return; data = r && r.ok ? r : { sprites: [], maps: [], makers: [] }; paint(); });
    return v;
  };
})();
