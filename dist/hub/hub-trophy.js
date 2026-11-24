/* ScrollHub Hub: Trophy room. Achievements as objects on lit shelves; locked ones are shadows with their progress on the plaque. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var h = Hub.h;

  // Material per rarity: [highlight, body, shadow].
  var METAL = { common: ['#f0b78d', '#b9774a', '#5c3720'], uncommon: ['#f1f5fb', '#aab4c8', '#4f5a6e'], rare: ['#b4c6ff', '#5c7cfa', '#243585'], epic: ['#e3d0ff', '#b185ff', '#4e3190'], legendary: ['#fff0bd', '#ffb14e', '#94581a'] };
  var FORM = { first_bet: 'chip', warmup: 'chip', grinder: 'cup', daily: 'medal', tenk: 'star', fiftyk: 'medal', hundredk: 'crown', jackpot: 'gem', legendluck: 'cup', caseopener: 'crate', casehardened: 'crate', collector: 'star', whale: 'gem', tothemoon: 'rocket', generous: 'crate', sayhi: 'bubble', chatterbox: 'bubble' };
  var GROUPS = [['Casino floor', ['first_bet', 'warmup', 'grinder', 'daily']], ['Stacking Scrolls', ['tenk', 'fiftyk', 'hundredk', 'whale']], ['Big wins', ['jackpot', 'legendluck', 'tothemoon']], ['Cases and style', ['caseopener', 'casehardened', 'collector', 'generous']], ['Chat', ['sayhi', 'chatterbox']]];

  function defs() {
    if (document.getElementById('tr-defs')) return;
    var g = '';
    Object.keys(METAL).forEach(function (k) {
      var m = METAL[k];
      g += '<linearGradient id="tm-' + k + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + m[2] + '"/><stop offset=".22" stop-color="' + m[0] + '"/><stop offset=".5" stop-color="' + m[1] + '"/><stop offset="1" stop-color="' + m[2] + '"/></linearGradient>';
      g += '<linearGradient id="tm-' + k + 'v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + m[1] + '"/><stop offset="1" stop-color="' + m[2] + '"/></linearGradient>';
    });
    g += '<linearGradient id="tm-plinth" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2d3856"/><stop offset="1" stop-color="#161d31"/></linearGradient>';
    var d = document.createElement('div'); d.id = 'tr-defs'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = '<svg width="0" height="0"><defs>' + g + '</defs></svg>'; document.body.appendChild(d);
  }
  function star(cx, cy, ro, ri) { var p = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro; p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); } return p.join(' '); }
  function shape(form, M) {
    var m = 'url(#tm-' + M + ')', v = 'url(#tm-' + M + 'v)';
    switch (form) {
      case 'cup': return '<path d="M34 30C14 28 14 58 38 62" fill="none" stroke="' + m + '" stroke-width="5" stroke-linecap="round"/><path d="M86 30C106 28 106 58 82 62" fill="none" stroke="' + m + '" stroke-width="5" stroke-linecap="round"/><path d="M32 18H88V40C88 62 76 72 60 74C44 72 32 62 32 40Z" fill="' + m + '"/><rect x="30" y="16" width="60" height="5" rx="2.5" fill="' + v + '"/><rect x="55" y="74" width="10" height="16" fill="' + m + '"/><ellipse cx="60" cy="82" rx="9" ry="3.5" fill="' + v + '"/><path d="M42 104L46 90H74L78 104Z" fill="' + m + '"/>';
      case 'medal': return '<path d="M44 6L60 40L48 44L32 12Z" fill="' + v + '"/><path d="M76 6L60 40L72 44L88 12Z" fill="' + v + '"/><circle cx="60" cy="68" r="30" fill="' + m + '"/><circle cx="60" cy="68" r="23" fill="none" stroke="' + v + '" stroke-width="2.5"/><polygon points="' + star(60, 68, 14, 6) + '" fill="' + v + '"/><rect x="54" y="96" width="12" height="8" fill="' + m + '"/>';
      case 'chip': { var n = ''; for (var i = 0; i < 8; i++) n += '<rect x="55" y="23" width="10" height="11" rx="1.5" fill="' + v + '" transform="rotate(' + i * 45 + ' 60 56)"/>'; return '<circle cx="60" cy="56" r="34" fill="' + m + '"/>' + n + '<circle cx="60" cy="56" r="22" fill="none" stroke="' + v + '" stroke-width="2.5"/><circle cx="60" cy="56" r="12" fill="' + v + '"/><path d="M44 104L60 88L76 104Z" fill="' + m + '"/>'; }
      case 'star': return '<polygon points="' + star(60, 50, 36, 15) + '" fill="' + m + '"/><rect x="55" y="78" width="10" height="20" fill="' + m + '"/><path d="M42 104L48 94H72L78 104Z" fill="' + v + '"/>';
      case 'crown': return '<path d="M26 82L30 38L46 56L60 30L74 56L90 38L94 82Z" fill="' + m + '"/><rect x="26" y="80" width="68" height="12" rx="3" fill="' + v + '"/><circle cx="30" cy="35" r="4" fill="#fff" opacity=".85"/><circle cx="60" cy="27" r="4" fill="#fff" opacity=".85"/><circle cx="90" cy="35" r="4" fill="#fff" opacity=".85"/><rect x="46" y="92" width="28" height="12" fill="' + m + '"/>';
      case 'gem': return '<polygon points="36,32 84,32 98,52 60,94 22,52" fill="' + m + '"/><polygon points="36,32 84,32 98,52 22,52" fill="#fff" opacity=".16"/><path d="M36 32L47 52L60 32L73 52L84 32M22 52H98M47 52L60 94L73 52" fill="none" stroke="' + v + '" stroke-width="1.6" opacity=".75"/><path d="M46 104L53 92H67L74 104Z" fill="' + m + '"/>';
      case 'crate': return '<g transform="translate(0 8)"><path d="M78 50L96 40V86L78 96Z" fill="' + v + '"/><rect x="26" y="50" width="52" height="46" fill="' + m + '"/><path d="M26 50L44 40H96L78 50Z" fill="' + m + '"/><path d="M26 50L44 40H96L78 50Z" fill="#fff" opacity=".2"/><rect x="48" y="50" width="8" height="46" fill="#000" opacity=".25"/><path d="M48 50L66 40H74L56 50Z" fill="#000" opacity=".22"/><path d="M52 50C40 38 38 28 48 28C55 28 55 42 52 50Z" fill="' + v + '"/><path d="M52 50C64 38 68 28 58 28C51 28 50 42 52 50Z" fill="' + v + '"/></g>';
      case 'rocket': return '<path d="M60 8C78 26 80 54 72 78H48C40 54 42 26 60 8Z" fill="' + m + '"/><circle cx="60" cy="40" r="8" fill="#0a1020"/><circle cx="60" cy="40" r="8" fill="none" stroke="' + v + '" stroke-width="3"/><path d="M48 60L32 86L48 78Z" fill="' + v + '"/><path d="M72 60L88 86L72 78Z" fill="' + v + '"/><rect x="52" y="78" width="16" height="7" fill="' + v + '"/><path d="M44 104L51 85H69L76 104Z" fill="' + m + '"/>';
      default: return '<path d="M34 24H86A14 14 0 0 1 100 38V60A14 14 0 0 1 86 74H58L44 92V74H34A14 14 0 0 1 20 60V38A14 14 0 0 1 34 24Z" fill="' + m + '"/><circle cx="44" cy="49" r="5" fill="#0a1020" opacity=".75"/><circle cx="60" cy="49" r="5" fill="#0a1020" opacity=".75"/><circle cx="76" cy="49" r="5" fill="#0a1020" opacity=".75"/><rect x="44" y="90" width="14" height="14" fill="' + m + '"/>';
    }
  }
  function svg(a) {
    var M = METAL[a.rarity] ? a.rarity : 'common';
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 120 120'); s.setAttribute('class', 'tr-svg'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.innerHTML = shape(FORM[a.id] || 'cup', M) + '<rect x="26" y="104" width="68" height="12" rx="2" fill="url(#tm-plinth)"/><rect x="26" y="104" width="68" height="1.6" fill="#fff" opacity=".14"/>';
    return s;
  }
  function num(n) { return Number(n).toLocaleString('en-US'); }

  // Empty stretches of shelf, so every shelf runs the full width of the case.
  function fillers(n) {
    var out = [], n4 = (4 - n % 4) % 4, n2 = (2 - n % 2) % 2;
    for (var i = 0; i < n4; i++) out.push(h('div', { class: 'tr-cell tr-fill' + (i < n2 ? '' : ' f4'), 'aria-hidden': 'true' }, [h('div', { class: 'tr-stage' }), h('div', { class: 'tr-shelf' })]));
    return out;
  }
  Hub.views.trophies = function () {
    defs();
    var v = h('div', { class: 'tr-page' }), lead = h('p', { class: 'page-sub' }), cab = h('div', { class: 'tr-case' }, h('div', { class: 'skel', style: 'height:340px;border-radius:16px' }));
    v.appendChild(h('h1', { class: 'page', text: 'Trophy room' })); v.appendChild(lead); v.appendChild(cab);
    lead.textContent = 'Everything you have earned, on display.';
    Hub.api('/api/achievements').then(function (r) {
      if (!v.isConnected) return; Hub.clear(cab);
      var list = (r && r.achievements) || [];
      if (!list.length) { cab.appendChild(Hub.emptyState('trophy', 'No trophies yet', 'Play a game or say hi in chat and your first trophy goes on the shelf.')); return; }
      var byId = {}; list.forEach(function (a) { byId[a.id] = a; });
      var got = list.filter(function (a) { return a.unlocked; }).length;
      var next = list.filter(function (a) { return !a.unlocked && a.progress; }).sort(function (a, b) { return b.progress.current / b.progress.target - a.progress.current / a.progress.target; })[0];
      lead.textContent = got + ' of ' + list.length + ' trophies on the shelves.' + (next ? ' ' + Hub.clean(next.name) + ' is next, ' + Math.round(next.progress.current / next.progress.target * 100) + '% there.' : ' Every shelf is full.');
      var groups = GROUPS.map(function (g) { return [g[0], g[1].map(function (id) { return byId[id]; }).filter(Boolean)]; });
      var rest = list.filter(function (a) { return !GROUPS.some(function (g) { return g[1].indexOf(a.id) >= 0; }); }); if (rest.length) groups.push(['More', rest]);
      var idx = 0;
      groups.forEach(function (g) {
        if (!g[1].length) return;
        var n = g[1].filter(function (a) { return a.unlocked; }).length;
        cab.appendChild(h('div', { class: 'tr-group' }, [
          h('div', { class: 'tr-gh' }, [h('h2', { text: g[0] }), h('span', { text: n + ' of ' + g[1].length })]),
          h('div', { class: 'tr-row' }, g[1].map(function (a) {
            var pct = a.progress ? Math.round(a.progress.current / a.progress.target * 100) : 100, d = (idx++ * 90) + 'ms';
            var plaque = [h('div', { class: 'tr-n', text: Hub.clean(a.name) }), h('div', { class: 'tr-d', text: Hub.clean(a.desc) })];
            if (a.unlocked) plaque.push(h('div', { class: 'tr-r', text: a.rarity.charAt(0).toUpperCase() + a.rarity.slice(1) }));
            else if (a.progress) plaque.push(h('div', { class: 'tr-p' }, [h('div', { class: 'tr-bar' }, h('i', { style: 'width:' + Math.max(2, pct) + '%' })), h('div', { class: 'tr-pt', text: num(a.progress.current) + ' of ' + num(a.progress.target) + (a.progress.unit ? (a.progress.unit === 'x' ? 'x' : ' ' + a.progress.unit) : '') })]));
            return h('figure', { class: 'tr-cell ' + (a.unlocked ? 'got' : 'lock') + ' r-' + a.rarity, tabindex: '0', style: '--d:' + d, 'aria-label': Hub.clean(a.name) + ', ' + (a.unlocked ? 'earned' : pct + ' percent') }, [
              h('div', { class: 'tr-stage' }, svg(a)), h('div', { class: 'tr-shelf' }), h('figcaption', { class: 'tr-plaque' }, plaque)]);
          }).concat(fillers(g[1].length)))]));
      });
      setTimeout(function () { cab.classList.add('on'); }, 250);   // the one moment of motion: the lights come on
    });
    return v;
  };
})();
