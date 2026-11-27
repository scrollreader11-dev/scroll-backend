/* Scrolls Casino: the small "What's new" board in the lobby. Public changes only. Press E on the board for the full list. */
(function () {
  var SC = window.SC; if (!SC) return;
  var LIST = [
    ['Arcade high scores', 'A wall board in the Arcade shows the best round per game. Press E on it for every top ten.', 'New'],
    ['Duel board', 'See every open duel on the floor from one board.', 'New'],
    ['Bartender serves drinks', 'Order at the bar and the bartender really pours it.', 'Fixed'],
    ['Phone layout', 'The casino buttons no longer run off the edge of small screens.', 'Fixed'],
    ['Games hub world', 'A much bigger world with eight regions, signposts and a minimap (M).', 'New']
  ];
  var KEY = 'sc_updates_seen', VER = LIST.length + ':' + LIST[0][0];
  var seen = ''; try { seen = localStorage.getItem(KEY) || ''; } catch (e) { }
  SC.updates = { list: LIST, unseen: seen !== VER, markSeen: function () { SC.updates.unseen = false; try { localStorage.setItem(KEY, VER); } catch (e) { } } };
  // The same list the hub's What's New page shows. The built-in list above is only a fallback if the server cannot be reached.
  try {
    fetch('/api/news', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok || !d.news || !d.news.length) return;
      var TAGN = { new: 'New', fix: 'Fixed', event: 'Event', info: 'Info' };
      LIST.length = 0; d.news.slice(0, 8).forEach(function (n) { LIST.push([n.title, n.body || '', TAGN[n.tag] || 'Info', n.link || null]); });
      VER = d.news[0].id + ':' + d.news[0].ts; SC.updates.unseen = seen !== VER;
    }).catch(function () { });
  } catch (e) { }

  if (SC.arc && SC.arc.section) {
    SC.arc.section('updates', '<div class="hint">What changed lately in Scrolls Casino and ScrollHub.</div><div id="upList" style="max-width:440px;margin:10px auto;text-align:left"></div>');
  }
  var prev = SC.games && SC.games.open;
  if (SC.games) SC.games.open = function (kind) {
    if (prev) prev(kind);
    if (kind !== 'updates') return;
    var h = document.getElementById('upList'); if (!h) return; h.innerHTML = '';
    LIST.forEach(function (u) {
      var d = document.createElement('div'); d.style.cssText = 'padding:9px 12px;border-radius:10px;margin:6px 0;background:rgba(255,255,255,.06)';
      var t = document.createElement('div'); t.style.cssText = 'display:flex;gap:8px;align-items:center;font-weight:700';
      var tag = document.createElement('span'); tag.textContent = u[2]; tag.style.cssText = 'font-size:11px;padding:1px 7px;border-radius:99px;color:#102;background:' + (u[2] === 'New' ? '#b8ff5c' : '#ffd166');
      var n = document.createElement('span'); n.textContent = u[0]; t.appendChild(tag); t.appendChild(n);
      var p = document.createElement('div'); p.style.cssText = 'font-size:13px;opacity:.8;margin-top:3px'; p.textContent = u[1];
      d.appendChild(t); d.appendChild(p);
      if (u[3]) { var go = document.createElement('a'); go.textContent = u[3].label + ' →'; go.href = /^#/.test(u[3].url) ? '/hub/' + u[3].url : u[3].url; go.target = '_blank'; go.rel = 'noopener'; go.style.cssText = 'display:inline-block;margin-top:6px;font-weight:700;color:var(--gold,#ffd166)'; d.appendChild(go); }
      h.appendChild(d);
    });
    var more = document.createElement('a'); more.href = '/hub/#/news'; more.target = '_blank'; more.rel = 'noopener'; more.textContent = 'See every update on ScrollHub'; more.style.cssText = 'display:block;text-align:center;margin:12px 0 4px;color:var(--gold,#ffd166)'; h.appendChild(more);
    SC.updates.markSeen();
  };
})();
