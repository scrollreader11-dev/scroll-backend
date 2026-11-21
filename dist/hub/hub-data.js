/* ScrollHub Hub: data layer (identity, catalog, library, installs and updates, notifications, friends). */
(function () {
  'use strict';
  var Hub = window.Hub, ls = Hub.ls;

  // ---------- identity ----------
  Hub.me = { kind: 'none', id: '', name: '', owner: false, avatar: '', banner: '', color: '', pub: true };
  Hub.loadMe = function () {
    return Hub.api('/api/auth/me').then(function (a) {
      if (a && a.loggedIn) {
        Hub.me = { kind: 'user', id: a.id, name: a.username, owner: a.role === 'owner' || a.role === 'coowner' || String(a.username).toLowerCase() === 'scrollreader11', role: a.role || null, avatar: '', banner: '', color: '', pub: true };
        return Hub.api('/api/me').then(function (m) { var u = (m && m.user) || {}; Hub.me.avatar = u.avatar_url || ''; Hub.me.banner = u.banner_url || ''; Hub.me.color = u.profile_color || ''; Hub.me.pub = u.profile_public !== false; return Hub.me; });
      }
      var nick = Hub.cookie('sh_nick'), cid = Hub.cookie('sh_cid');
      if (nick && cid && nick.toLowerCase() !== 'guest') { Hub.me = { kind: 'guest', id: cid, name: nick, owner: false, avatar: '', banner: '', color: '', pub: true }; return Hub.me; }
      Hub.me = { kind: 'none', id: '', name: '', owner: false, avatar: '', banner: '', color: '', pub: true }; return Hub.me;
    });
  };
  Hub.initials = function (n) { n = Hub.clean(n || '?'); return (n.charAt(0) || '?').toUpperCase(); };

  // ---------- School Mode ----------
  Hub.school = { on: false, exempt: false, gamble: false };
  Hub.loadSchool = function () {
    return Hub.api('/api/school').then(function (s) {
      var n = { on: !!s.on, exempt: !!s.exempt, gamble: !!s.gamble };
      var ch = n.on !== Hub.school.on || n.exempt !== Hub.school.exempt || n.gamble !== Hub.school.gamble;
      Hub.school = n; if (ch) Hub.emit('school'); return n;
    });
  };
  Hub.locked = function () { return Hub.school.on && !Hub.school.exempt; };
  Hub.canCasino = function () { return !Hub.locked() || Hub.school.gamble; };
  Hub.canStore = function () { return !Hub.locked(); };

  // ---------- catalog ----------
  var GENRE_MAP = {
    Action: ['action'], Arcade: ['arcade'], Puzzle: ['puzzle'], Adventure: ['adventure'], Strategy: ['strategy', 'tower defense', 'defense', 'turn-based', 'war'],
    Sports: ['sports', 'soccer', 'basketball', 'football', 'golf', 'hockey', 'tennis'], Simulation: ['simulation', 'cooking', 'idle', 'clicker', 'building', 'physics'],
    Multiplayer: ['multiplayer', '2 player', 'io', 'io game'], Racing: ['racing', 'driving'], Platformer: ['platformer', 'runner', 'obstacle course'],
    Shooter: ['shooter', 'shooting'], Horror: ['horror'], Fighting: ['fighting'], Casual: ['casual', 'card game'], Skill: ['skill'], RPG: ['rpg', 'roguelike', 'fantasy'],
    Music: ['music', 'rhythm'], Survival: ['survival', 'escape', 'stealth'],
    Casino: ['casino'], Party: ['party'], Creative: ['creative', 'tools'], 'Battle Royale': ['battle royale'],
  };
  var G_LOOKUP = {}; Object.keys(GENRE_MAP).forEach(function (g) { GENRE_MAP[g].forEach(function (a) { G_LOOKUP[a] = g; }); G_LOOKUP[g.toLowerCase()] = g; });
  Hub.GENRE_ICON = { Action: 'swords', Arcade: 'gamepad-2', Puzzle: 'puzzle', Adventure: 'mountain', Strategy: 'brain', Sports: 'trophy', Simulation: 'hammer', Multiplayer: 'users', Racing: 'car', Platformer: 'footprints', Shooter: 'crosshair', Horror: 'ghost', Fighting: 'sword', Casual: 'sparkles', Skill: 'target', RPG: 'castle', Music: 'music', Survival: 'flame', Casino: 'dices', Party: 'party-popper', Creative: 'paintbrush', 'Battle Royale': 'rocket' };
  function genresOf(list) { var out = [], seen = {}; (list || []).forEach(function (c) { var g = G_LOOKUP[String(c).toLowerCase().trim()]; if (g && !seen[g]) { seen[g] = 1; out.push(g); } }); return out; }

  Hub.games = []; Hub.byId = {}; Hub.manifest = { originals: [], versions: {}, feed: [], serverTime: 0 }; Hub.originals = [];

  Hub.loadManifest = function () {
    return Hub.api('/api/hub/manifest').then(function (m) {
      if (!m || !m.originals) return Hub.manifest;
      Hub.manifest = m; Hub.originals = m.originals.map(origGame);
      Hub.originals.forEach(function (g) { var o = Hub.byId[g.id]; if (o) { var i = Hub.games.indexOf(o); if (i >= 0) Hub.games[i] = g; } Hub.byId[g.id] = g; });
      // owner-pushed versions for web games
      Hub.games.forEach(function (g) { if (g.kind === 'web') { var x = m.versions && m.versions[g.id]; g.v = (x && x.v) || '1.0.0'; g.rev = ''; g.ts = (x && x.ts) || 0; g.notes = (x && x.notes) || ''; g.hist = (x && x.hist) || []; } });
      Hub.emit('manifest'); return m;
    });
  };
  function origGame(o) {
    var x = (Hub.manifest.versions || {})[o.id] || {};
    return { id: o.id, kind: 'original', title: o.title, dev: o.dev, tagline: o.tagline, desc: o.desc, art: o.art, url: o.url, entry: o.entry, tags: o.tags, cats: genresOf(o.tags), players: o.players, v: o.v || '1.0.0', rev: o.rev || '', ts: o.ts || 0, notes: o.notes || '', hist: x.hist || [], files: o.files || [], casino: !!o.casino, accent: o.accent };
  }
  var ART_LOCAL = /^\/(storage|arcade|hub|casino)\//;
  function webGame(g, id) {
    var cats = genresOf(g.categories);
    return { id: id, kind: 'web', title: Hub.clean(g.label), dev: 'Web game', art: g.imageUrl || '', url: g.url, cats: cats, tags: cats, v: '1.0.0', rev: '', ts: 0, notes: '', hist: [] };
  }
  Hub.loadCatalog = function () {
    return fetch('/storage/data/collection.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      var arr = Array.isArray(d) ? d : (d.games || []), seen = {}, out = [];
      arr.forEach(function (g) {
        if (!g || !g.label || typeof g.url !== 'string' || g.url.charAt(0) !== '/') return;
        if (/^see all/i.test(g.label) || /request games/i.test(g.label)) return;
        var cs = (g.categories || []).map(function (c) { return String(c).toLowerCase(); });
        var base = 'w-' + Hub.slug(Hub.clean(g.label) || g.label), id = base, n = 2; if (!base || base === 'w-') return;
        while (seen[id]) id = base + '-' + (n++); seen[id] = 1;
        out.push(webGame(g, id));
      });
      Hub.webGames = out;
      var orig = Hub.originals.slice();
      Hub.games = orig.concat(out); Hub.byId = {}; Hub.games.forEach(function (g) { Hub.byId[g.id] = g; });
      var vs = (Hub.manifest.versions || {}); out.forEach(function (g) { var x = vs[g.id]; if (x) { g.v = x.v; g.ts = x.ts; g.notes = x.notes; g.hist = x.hist || []; } });
      Hub.genreCounts = {}; out.forEach(function (g) { g.cats.forEach(function (c) { Hub.genreCounts[c] = (Hub.genreCounts[c] || 0) + 1; }); });
      Hub.emit('catalog'); return out;
    });
  };
  // games the current visitor may see (School Mode shows ScrollHub Originals only)
  Hub.visible = function () {
    if (!Hub.locked()) return Hub.games;
    return Hub.games.filter(function (g) { return g.kind === 'original' && (!g.casino || Hub.canCasino()) && g.id !== 'scrollhub-sprite-lab'; });
  };
  Hub.genres = function () { return Object.keys(Hub.genreCounts || {}).filter(function (g) { return Hub.genreCounts[g] >= 5; }).sort(function (a, b) { return Hub.genreCounts[b] - Hub.genreCounts[a]; }); };
  Hub.search = function (q, limit) {
    q = Hub.clean(q).toLowerCase(); if (!q) return [];
    var words = q.split(/\s+/), res = [];
    Hub.visible().forEach(function (g) {
      var t = g.title.toLowerCase(), s = 0;
      if (t === q) s = 100; else if (t.indexOf(q) === 0) s = 80; else if (t.indexOf(' ' + q) >= 0) s = 60; else if (t.indexOf(q) >= 0) s = 45;
      else if (words.length > 1 && words.every(function (w) { return t.indexOf(w) >= 0; })) s = 35;
      else if (g.cats.some(function (c) { return c.toLowerCase() === q; })) s = 20;
      if (s) { if (g.kind === 'original') s += 6; res.push([s, g]); }
    });
    res.sort(function (a, b) { return b[0] - a[0] || a[1].title.length - b[1].title.length; });
    return res.slice(0, limit || 400).map(function (x) { return x[1]; });
  };
  // deterministic "top games" ordering without any random seed drift: originals first, then catalog order
  Hub.related = function (g, n) {
    var c = g.cats[0], out = [];
    Hub.visible().forEach(function (x) { if (x !== g && out.length < 80 && (c ? x.cats.indexOf(c) >= 0 : true)) out.push(x); });
    return out.slice(0, n || 14);
  };

  // ---------- library ----------
  var LIB = { inst: {}, later: {}, hist: [], plays: {}, dismissed: {}, seen: {}, checked: 0 }, libKey = '';
  Hub.lib = LIB;
  Hub.loadLib = function (id) {
    libKey = 'sh_hub_lib:' + (id || 'anon'); var d = ls.get(libKey, null) || {};
    LIB.inst = d.inst || {}; LIB.later = d.later || {}; LIB.hist = d.hist || []; LIB.plays = d.plays || {}; LIB.dismissed = d.dismissed || {}; LIB.seen = d.seen || {}; LIB.checked = d.checked || 0;
  };
  Hub.saveLib = function () { if (libKey) ls.set(libKey, LIB); };
  Hub.recents = function (n) {
    var seen = {}, out = [];
    LIB.hist.forEach(function (h) { var g = Hub.byId[h.id]; if (g && !seen[h.id] && vis(g)) { seen[h.id] = 1; out.push(g); } });
    Object.keys(LIB.inst).sort(function (a, b) { return (LIB.inst[b].at || 0) - (LIB.inst[a].at || 0); }).forEach(function (id) { var g = Hub.byId[id]; if (g && !seen[id] && vis(g)) { seen[id] = 1; out.push(g); } });
    return out.slice(0, n || 6);
  };
  function vis(g) { return Hub.visible().indexOf(g) >= 0; }
  Hub.owned = function () {
    var ids = {}; Object.keys(LIB.inst).forEach(function (i) { ids[i] = 1; }); LIB.hist.forEach(function (h) { ids[h.id] = 1; });
    return Object.keys(ids).map(function (i) { return Hub.byId[i]; }).filter(function (g) { return g && vis(g); });
  };
  Hub.lastUsed = function (g) { for (var i = 0; i < LIB.hist.length; i++) if (LIB.hist[i].id === g.id) return LIB.hist[i].at; return (LIB.inst[g.id] && LIB.inst[g.id].at) || 0; };
  Hub.later = function () { return Object.keys(LIB.later).map(function (i) { return Hub.byId[i]; }).filter(function (g) { return g && vis(g); }).sort(function (a, b) { return LIB.later[b.id] - LIB.later[a.id]; }); };
  Hub.toggleLater = function (g) { if (LIB.later[g.id]) { delete LIB.later[g.id]; Hub.toast('Removed from Play later', { icon: 'bookmark-check' }); } else { LIB.later[g.id] = Date.now(); Hub.toast('Added to Play later', { icon: 'bookmark-check' }); } Hub.saveLib(); Hub.emit('lib'); };

  // ---------- versions, installs, updates ----------
  Hub.verOf = function (g) { return { v: g.v || '1.0.0', rev: g.rev || '' }; };
  Hub.isInstalled = function (g) { return !!LIB.inst[g.id]; };
  Hub.needsUpdate = function (g) { var r = LIB.inst[g.id]; if (!r) return false; var x = Hub.verOf(g); return r.v !== x.v || (!!x.rev && r.rev !== x.rev); };
  Hub.updatable = function () { return Hub.games.filter(function (g) { return Hub.needsUpdate(g) && vis(g); }); };
  Hub.buildLabel = function (g) { return 'v' + g.v + (g.rev ? ' (build ' + g.rev + ')' : ''); };

  var dl = Hub.dl = { items: {}, order: [], busy: false, done: [] };
  Hub.dlOf = function (g) { return dl.items[g.id] || null; };
  Hub.status = function (g) {
    var d = dl.items[g.id];
    if (d && (d.state === 'run' || d.state === 'queued')) return { k: d.state === 'run' ? 'dl' : 'queued', pct: d.shown || 0, update: d.update };
    if (!LIB.inst[g.id]) return { k: 'none' };
    return { k: Hub.needsUpdate(g) ? 'upd' : 'inst' };
  };
  Hub.install = function (g, o) {
    o = o || {}; if (dl.items[g.id] && (dl.items[g.id].state === 'run' || dl.items[g.id].state === 'queued')) return;
    dl.items[g.id] = { id: g.id, state: 'queued', pct: 0, shown: 0, bytes: 0, total: 0, update: !!LIB.inst[g.id], at: Date.now() };
    dl.order = dl.order.filter(function (i) { return i !== g.id; }); dl.order.push(g.id);
    Hub.emit('dl', g); pump();
  };
  Hub.updateAll = function () { var l = Hub.updatable(); l.forEach(function (g) { Hub.install(g); }); return l.length; };
  Hub.cancelInstall = function (g) { var d = dl.items[g.id]; if (d && d.state === 'queued') { delete dl.items[g.id]; dl.order = dl.order.filter(function (i) { return i !== g.id; }); Hub.emit('dl', g); } };
  function pump() {
    if (dl.busy) return; var id = dl.order.find(function (i) { return dl.items[i] && dl.items[i].state === 'queued'; }); if (!id) return;
    var g = Hub.byId[id]; if (!g) { delete dl.items[id]; return pump(); }
    dl.busy = true; var d = dl.items[id]; d.state = 'run'; Hub.emit('dl', g);
    var tick = setInterval(function () { var t = d.total > 0 ? Math.min(98, d.bytes / d.total * 100) : Math.min(90, d.shown + 4); d.shown += (t - d.shown) * 0.22 + 0.4; if (d.shown > 99) d.shown = 99; Hub.emit('dlprog', g); }, 80);
    var t0 = Date.now();
    downloadGame(g, d).then(function (res) {
      var wait = Math.max(0, 900 - (Date.now() - t0)); return Hub.sleep(wait).then(function () { return res; });
    }).then(function (res) {
      clearInterval(tick); var wasUpd = d.update; d.shown = 100; d.state = 'done';
      LIB.inst[g.id] = { v: g.v || '1.0.0', rev: g.rev || '', at: Date.now(), size: res.size, urls: res.urls };
      Hub.saveLib(); dl.done.unshift({ id: g.id, at: Date.now(), update: wasUpd, v: g.v }); dl.done = dl.done.slice(0, 20);
      Hub.toast(g.title + (wasUpd ? ' updated to ' : ' installed, ') + (wasUpd ? 'v' + g.v : Hub.bytes(res.size)), { icon: 'package-check' });
      setTimeout(function () { delete dl.items[g.id]; dl.order = dl.order.filter(function (i) { return i !== g.id; }); Hub.emit('dl', g); }, 400);
      Hub.emit('lib'); Hub.emit('dl', g);
    }).catch(function (e) {
      clearInterval(tick); d.state = 'err'; Hub.toast('Could not download ' + g.title + '. Check your connection and try again.', { bad: true, ms: 4200 });
      setTimeout(function () { delete dl.items[g.id]; dl.order = dl.order.filter(function (i) { return i !== g.id; }); Hub.emit('dl', g); }, 600);
    }).then(function () { dl.busy = false; pump(); });
  }
  var CACHE = 'sh-hub-games-v1', CAP = 28 * 1048576;
  function entryUrl(g) {
    if (g.kind === 'original') return g.entry || g.url.split('?')[0];
    var m = /[?&]url=([^&#]+)/.exec(g.url); if (!m) return null;
    var u = decodeURIComponent(m[1]); if (/^\/embed\.html/.test(u) || /^https?:\/\/(?!cdn\.jsdelivr\.net)/i.test(u)) return null;
    return u;
  }
  function assetsFrom(html, base) {
    var out = [], re = /(?:src|href)=["']([^"'#]+)["']/g, m, seen = {};
    while ((m = re.exec(html))) {
      var u = m[1]; if (/^(?:data|mailto|blob|javascript):/i.test(u)) continue;
      if (/^(?:[a-z]+:)?\/\//i.test(u)) { if (!/^https?:\/\/cdn\.jsdelivr\.net\//i.test(u)) continue; }
      if (!/\.(?:js|css|png|jpe?g|webp|svg|json|woff2?|mp3|ogg|wav|wasm|gif)(?:\?|$)/i.test(u)) continue;
      var abs; try { abs = new URL(u, base).href; } catch (e) { continue; }
      var sameOrigin = abs.indexOf(location.origin + '/') === 0, cdn = /^https:\/\/cdn\.jsdelivr\.net\//.test(abs);
      if ((sameOrigin || cdn) && !seen[abs]) { seen[abs] = 1; out.push(abs); }
    }
    return out;
  }
  function downloadGame(g, d) {
    var url = entryUrl(g); if (!url) return Promise.resolve({ size: 0, urls: [] });
    var cachesOk = typeof caches !== 'undefined', total = 0, urls = [];
    return (cachesOk ? caches.open(CACHE).catch(function () { return null; }) : Promise.resolve(null)).then(function (cache) {
      function grab(u) {
        var abs = new URL(u, location.href).href;
        return fetch(abs, { cache: 'reload', credentials: abs.indexOf(location.origin) === 0 ? 'same-origin' : 'omit' }).then(function (r) {
          if (!r.ok) throw new Error('http ' + r.status);
          var cl = +r.headers.get('content-length') || 0; if (cl) d.total += cl;
          var copy = cache ? r.clone() : null, p;
          if (r.body && r.body.getReader) {
            var rd = r.body.getReader(), n = 0, ctype = (r.headers.get('content-type') || '');
            p = (function loop() { return rd.read().then(function (x) { if (x.done) return { n: n, ctype: ctype }; n += x.value.length; d.bytes += x.value.length; if (total + n > CAP) { try { rd.cancel(); } catch (e) {} throw new Error('too-big'); } return loop(); }); })();
          } else p = r.text().then(function (t) { d.bytes += t.length; return { n: t.length, ctype: r.headers.get('content-type') || '' }; });
          return p.then(function (info) { total += info.n; if (cache && copy) { return cache.put(abs, copy).then(function () { urls.push(abs); }, function () {}).then(function () { return info; }); } return info; });
        });
      }
      // entry page first; its text decides which other files to fetch
      var absEntry = new URL(url, location.href).href, text = '';
      return fetch(absEntry, { cache: 'reload', credentials: absEntry.indexOf(location.origin) === 0 ? 'same-origin' : 'omit' }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        var cl = +r.headers.get('content-length') || 0; if (cl) d.total += cl;
        var copy = cache ? r.clone() : null;
        return r.text().then(function (t) { text = t; total += t.length; d.bytes += t.length; if (cache && copy) return cache.put(absEntry, copy).then(function () { urls.push(absEntry); }, function () {}); });
      }).then(function () {
        var files = assetsFrom(text, absEntry).slice(0, 60); d.total += 0;
        var i = 0; function next() { if (i >= files.length) return Promise.resolve(); var f = files[i++]; return grab(f).then(function () {}, function (e) { if (e && e.message === 'too-big') throw e; }).then(next); }
        // two lanes
        return Promise.all([next(), next()]);
      }).then(function () { return { size: total, urls: urls.length <= 80 ? urls : urls.slice(0, 80) }; });
    });
  }
  Hub.uninstall = function (g) {
    var rec = LIB.inst[g.id]; delete LIB.inst[g.id]; Hub.saveLib();
    if (rec && rec.urls && typeof caches !== 'undefined') caches.open(CACHE).then(function (c) { rec.urls.forEach(function (u) { c.delete(u); }); }).catch(function () {});
    Hub.toast(g.title + ' uninstalled', { icon: 'trash-2' }); Hub.emit('lib');
  };
  Hub.uninstallAll = function () {
    LIB.inst = {}; Hub.saveLib(); if (typeof caches !== 'undefined') caches.delete(CACHE).catch(function () {}); Hub.toast('All downloaded games removed', { icon: 'trash-2' }); Hub.emit('lib');
  };
  Hub.storageUsed = function () { var n = 0; Object.keys(LIB.inst).forEach(function (i) { n += LIB.inst[i].size || 0; }); return n; };
  Hub.checkUpdates = function (silent) {
    return Hub.loadManifest().then(function () {
      LIB.checked = Date.now(); Hub.saveLib(); var u = Hub.updatable(); Hub.emit('upd', u);
      if (u.length && Hub.prefs.auto) { Hub.updateAll(); if (!silent) Hub.toast('Updating ' + u.length + (u.length === 1 ? ' game' : ' games') + '...', { icon: 'refresh-cw' }); }
      else if (!silent) Hub.toast(u.length ? u.length + ' update' + (u.length === 1 ? '' : 's') + ' available' : 'All your games are up to date', { icon: 'refresh-cw' });
      return u;
    });
  };

  // ---------- play ----------
  Hub.launchUrl = function (g) {
    var u = g.url; if (g.kind !== 'original') return u;
    var rec = LIB.inst[g.id], v = (rec ? rec.v + '-' + (rec.rev || '') : (g.v + '-' + (g.rev || '')));
    if (rec && Hub.needsUpdate(g)) v = g.v + '-' + (g.rev || '');
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'hv=' + encodeURIComponent(v);
  };
  Hub.record = function (g) {
    LIB.hist = LIB.hist.filter(function (h) { return !(h.id === g.id && Date.now() - h.at < 600000); });
    LIB.hist.unshift({ id: g.id, at: Date.now() }); LIB.hist = LIB.hist.slice(0, 200); LIB.plays[g.id] = (LIB.plays[g.id] || 0) + 1; Hub.saveLib(); Hub.emit('lib');
  };

  // ---------- wallet / rewards ----------
  Hub.wallet = null;
  Hub.loadWallet = function () {
    return Hub.api('/api/casino/me').then(function (w) { if (w && w.profile) { Hub.wallet = w; Hub.emit('wallet'); } return Hub.wallet; });
  };
  Hub.dailyReady = function () { var w = Hub.wallet; if (!w || !w.profile) return false; return !w.profile.lastDaily || Date.now() - w.profile.lastDaily >= (w.dailyMs || 86400000); };
  Hub.dailyNext = function () { var w = Hub.wallet; if (!w) return 0; var p = w.profile, cont = p.lastDaily && Date.now() - p.lastDaily <= 44 * 3600e3, s = (cont ? (p.streak || 0) : 0) + 1; return (w.dailyCoins || 0) + Math.min(s, 14) * 120 + (s % 7 === 0 ? 3000 : 0); };
  Hub.claimDaily = function () {
    return Hub.api('/api/casino/daily', { body: {} }).then(function (r) {
      if (r && r.ok) { if (Hub.wallet) Hub.wallet.profile = r.profile; Hub.toast('Claimed ' + Hub.num(r.gained) + ' Scrolls. Streak: ' + r.streak, { icon: 'gift' }); Hub.emit('wallet'); }
      else if (r && r.error === 'cooldown') { Hub.toast('Daily reward is not ready yet', { bad: true }); if (r.profile && Hub.wallet) Hub.wallet.profile = r.profile; Hub.emit('wallet'); }
      else Hub.toast('Could not claim right now', { bad: true });
      return r;
    });
  };
  Hub.redeem = function (code) {
    return Hub.api('/api/casino/redeem', { body: { code: code } }).then(function (r) {
      if (r && r.ok) { if (Hub.wallet) Hub.wallet.profile = r.profile; Hub.toast('Code redeemed: +' + Hub.num(r.gained) + ' Scrolls', { icon: 'ticket' }); Hub.emit('wallet'); }
      else Hub.toast({ 'bad-code': 'That code is not valid', 'already-redeemed': 'You already used that code', 'code-exhausted': 'That code has run out' }[r && r.error] || 'Could not redeem that code', { bad: true });
      return r;
    });
  };

  // ---------- friends ----------
  Hub.friends = { friends: [], incoming: [], outgoing: [], guest: true, loaded: false };
  Hub.loadFriends = function () {
    if (Hub.me.kind !== 'user') { Hub.friends = { friends: [], incoming: [], outgoing: [], guest: true, loaded: true }; Hub.emit('friends'); return Promise.resolve(Hub.friends); }
    return Hub.api('/api/friends').then(function (r) { if (r && r.friends) { Hub.friends = { friends: r.friends, incoming: r.incoming || [], outgoing: r.outgoing || [], guest: false, loaded: true }; } else Hub.friends = { friends: [], incoming: [], outgoing: [], guest: false, loaded: true }; Hub.emit('friends'); return Hub.friends; });
  };
  Hub.onlineFriends = function () { return Hub.friends.friends.filter(function (f) { return f.online; }); };

  // ---------- notifications ----------
  Hub.notifs = function () {
    var out = [], p = Hub.prefs, dis = LIB.dismissed;
    function push(n) { if (dis[n.id]) return; n.unread = !LIB.seen[n.id]; out.push(n); }
    if (p.nDaily && Hub.dailyReady() && Hub.wallet) push({ id: 'daily:' + new Date().toDateString(), type: 'daily', icon: 'gift', title: 'Daily reward is ready', body: 'Claim ' + Hub.num(Hub.dailyNext()) + ' Scrolls now.', ts: Date.now() });
    if (p.nUpd) Hub.updatable().forEach(function (g) { push({ id: 'upd:' + g.id + ':' + g.v + ':' + g.rev, type: 'update', game: g, title: g.title + ' has an update', body: 'Version ' + g.v + (g.notes ? ': ' + g.notes : ''), ts: g.ts || Date.now() }); });
    if (p.nFriends) Hub.friends.incoming.forEach(function (f) { push({ id: 'fr:' + f.id, type: 'friend', friend: f, icon: 'user-plus', title: f.username + ' wants to be friends', body: 'Accept the request to see when they are online.', ts: Date.now() }); });
    if (p.nNews) (Hub.manifest.feed || []).slice(0, 6).forEach(function (f) { push({ id: 'feed:' + f.id + ':' + f.v + ':' + f.ts, type: 'news', icon: 'megaphone', game: Hub.byId[f.id], title: f.title + ' updated to v' + f.v, body: f.notes || 'A new version is out.', ts: f.ts }); });
    out.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    return out;
  };
  Hub.unreadCount = function () { return Hub.notifs().filter(function (n) { return n.unread; }).length; };
  Hub.markSeen = function () { Hub.notifs().forEach(function (n) { LIB.seen[n.id] = 1; }); Hub.saveLib(); Hub.emit('notifs'); };
  Hub.dismiss = function (id) { LIB.dismissed[id] = 1; Hub.saveLib(); Hub.emit('notifs'); };

  // ---------- owner tools ----------
  Hub.publish = function (g, notes, version) {
    return Hub.api('/api/hub/publish', { body: { id: g.id, title: g.title, notes: notes || '', version: version || '' } }).then(function (r) {
      if (r && r.ok) { Hub.toast('Update v' + r.v + ' pushed for ' + g.title, { icon: 'send' }); return Hub.loadManifest().then(function () { Hub.emit('lib'); Hub.emit('upd', Hub.updatable()); return r; }); }
      Hub.toast((r && r.message) || 'Could not publish the update', { bad: true }); return r;
    });
  };
})();
