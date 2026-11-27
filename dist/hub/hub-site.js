/* ScrollHub Hub: sitewide pages and tools. What's New, Site status, Apply to be a mod, the Report button,
   Install app, and the offline notice. The server checks every rule again; this file only draws it. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub || !Hub.views) return;
  var h = Hub.h, icon = Hub.icon;

  var TAG = { new: ['New', 'ok'], fix: ['Fixed', 'warn'], event: ['Event', 'ev'], info: ['Info', 'info'] };
  function signedIn() { return Hub.me && Hub.me.kind === 'user'; }
  function head(title, sub) { return [h('h1', { class: 'page', text: title }), sub ? h('p', { class: 'page-sub', text: sub }) : null]; }
  function errBox(msg) { return h('div', { class: 'st-note bad', role: 'alert' }, [icon('circle-alert'), h('span', { text: msg })]); }

  // ---------------------------------------------------------------- What's New
  var news = { list: null, at: 0 };
  function seenTs() { return +Hub.ls.get('sh_news_seen', 0) || 0; }
  function loadNews(force) {
    if (!force && news.list && Date.now() - news.at < 60000) return Promise.resolve(news.list);
    return Hub.api('/api/news').then(function (r) {
      if (r && r.ok) { news.list = r.news || []; news.at = Date.now(); var top = 0; news.list.forEach(function (n) { if (n.ts > top) top = n.ts; }); Hub.newsTop = top; var was = Hub.newsUnseen; Hub.newsUnseen = top > seenTs(); if (was !== Hub.newsUnseen) Hub.emit('notifs'); }
      return news.list || [];
    }, function () { return news.list || []; });
  }
  Hub.loadNews = loadNews;
  Hub.markNewsSeen = function () { if (Hub.newsTop) Hub.ls.set('sh_news_seen', Hub.newsTop); Hub.newsUnseen = false; Hub.emit('notifs'); };

  Hub.views.news = function () {
    var v = h('div', { class: 'st-page' }), list = h('div', { class: 'nw-list' }, [1, 2, 3].map(function () { return h('div', { class: 'skel', style: 'height:96px;border-radius:16px' }); }));
    head("What's New", 'Changes to ScrollHub and the casino, newest first.').forEach(function (e) { e && v.appendChild(e); }); v.appendChild(list);
    var was = seenTs();
    loadNews(true).then(function (l) {
      if (!v.isConnected) return; Hub.clear(list);
      if (!l.length) { list.appendChild(Hub.emptyState('megaphone', 'Nothing posted yet', 'New features and fixes will show up here.')); return; }
      l.forEach(function (n) {
        var t = TAG[n.tag] || TAG.info, fresh = n.ts > was;
        list.appendChild(h('article', { class: 'nw-card' + (fresh ? ' fresh' : '') }, [
          h('div', { class: 'nw-top' }, [h('span', { class: 'nw-tag ' + t[1], text: t[0] }), fresh ? h('span', { class: 'nw-new', text: 'Just in' }) : null, n.pin ? h('span', { class: 'nw-pin' }, [icon('star'), 'Pinned']) : null, h('time', { class: 'nw-date', datetime: new Date(n.ts).toISOString(), text: Hub.dateShort(n.ts) })]),
          h('h2', { text: n.title }), n.body ? h('p', { text: n.body }) : null, n.link ? h('a', Object.assign({ class: 'btn sm primary nw-go', href: n.link.url }, /^https:/.test(n.link.url) ? { target: '_blank', rel: 'noopener' } : {}), [n.link.label, icon('chevron-right')]) : null]));
      });
      list.appendChild(h('p', { class: 'hint', style: 'margin-top:8px' }, ['Spotted something broken? ', h('button', { class: 'linkbtn', type: 'button', text: 'Report a problem', onclick: function () { Hub.reportModal({ kind: 'bug' }); } })]));
      Hub.markNewsSeen();
    });
    return v;
  };

  // Home gets a small pill while there is news you have not read.
  var homeView = Hub.views.home;
  if (homeView) Hub.views.home = function (a) {
    var node = homeView(a);
    if (node && node.insertBefore && Hub.me && Hub.me.kind === 'user' && !Hub.me.role && !Hub.ls.get('sh_modcta_off', false)) {
      var cta = h('div', { class: 'nw-pill mod' }, [icon('user-plus'), h('a', { href: '#/apply', class: 'nw-stretch' }, [h('span', { text: 'Want to help run ScrollHub? ' }), h('b', { style: 'margin:0', text: 'Become a mod' })]), h('a', { href: '#/apply', class: 'btn sm primary nw-btn' }, ['Apply now', icon('chevron-right')]), h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Hide this', onclick: function () { Hub.ls.set('sh_modcta_off', true); cta.remove(); } }, icon('x'))]);
      node.insertBefore(cta, node.firstChild);
    }
    if (node && node.insertBefore && Hub.me && Hub.me.kind === 'user' && !Hub.pushHas && !Hub.ls.get('sh_pushcta_off', false) && !(pushOK && Notification.permission === 'denied') && (pushOK || isIOS)) {
      var pc = h('div', { class: 'nw-pill push' }, [icon('bell'), h('span', { class: 'nw-stretch', text: pushOK ? 'Get a pop-up when someone messages you, even when ScrollHub is closed.' : 'Add ScrollHub to your Home Screen to get pop-ups for messages.' }),
        h('button', { class: 'btn sm primary nw-btn', type: 'button', onclick: function () { if (pushOK) { Hub.toast('Asking your browser…'); Hub.pushEnable().then(function (r) { if (r && r.ok) { Hub.toast('Pop-ups are on', { icon: 'bell' }); pc.remove(); } else Hub.toast((r && r.message) || 'Could not turn them on', { bad: true }); }); } else Hub.installApp(); } }, pushOK ? 'Turn on' : 'How'),
        h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Hide this', onclick: function () { Hub.ls.set('sh_pushcta_off', true); pc.remove(); } }, icon('x'))]);
      node.insertBefore(pc, node.firstChild);
    }
    if (Hub.newsUnseen && node && node.insertBefore) node.insertBefore(h('a', { class: 'nw-pill', href: '#/news' }, [icon('megaphone'), h('span', { text: "There's news you haven't read" }), h('b', { text: 'Read it' })]), node.firstChild);
    return node;
  };

  // ---------------------------------------------------------------- Site status
  Hub.views.status = function () {
    var v = h('div', { class: 'st-page' }), body = h('div');
    head('Site status', 'Whether ScrollHub and its games are working right now.').forEach(function (e) { e && v.appendChild(e); }); v.appendChild(body); body.appendChild(h('div', { class: 'skel', style: 'height:120px;border-radius:16px' }));
    var timer = null;
    function dur(s) { var d = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? d + 'd ' + hh + 'h' : hh ? hh + 'h ' + m + 'm' : Math.max(1, m) + 'm'; }
    function paint(r, ms) {
      Hub.clear(body);
      if (!r || !r.ok) { body.appendChild(h('div', { class: 'st-hero bad' }, [icon('triangle-alert'), h('div', {}, [h('h2', { text: 'We cannot reach the server' }), h('p', { text: navigator.onLine === false ? 'Your device is offline. Check your connection.' : 'It may be restarting. This page tries again by itself.' })])])); return; }
      var off = r.services.filter(function (s) { return s.state === 'off'; }), maint = r.maintenance;
      var tone = maint ? 'warn' : off.length ? 'warn' : 'ok', title = maint ? 'Down for maintenance' : off.length ? 'Some games are switched off' : 'Everything is working', sub = maint ? 'ScrollHub is being updated. It will be back soon.' : off.length ? off.map(function (s) { return s.name; }).join(', ') + (off.length === 1 ? ' is' : ' are') + ' turned off for now.' : 'All games and the website are up.';
      body.appendChild(h('div', { class: 'st-hero ' + tone }, [icon(tone === 'ok' ? 'circle-check' : 'triangle-alert'), h('div', {}, [h('h2', { text: title }), h('p', { text: sub })])]));
      if (r.announcement) body.appendChild(h('div', { class: 'st-note' }, [icon('megaphone'), h('span', { text: r.announcement })]));
      var st = h('div', { class: 'stats' });
      function stat(k, val) { st.appendChild(h('div', { class: 'stat' }, [h('div', { class: 'k', text: k }), h('div', { class: 'v', text: val })])); }
      stat('Players online', Hub.num(r.online)); stat('Server running for', dur(r.uptimeSec)); stat('Response time', ms + ' ms');
      if (Hub.me && Hub.me.role) stat('Browser errors, last hour', Hub.num(r.errorsLastHour));
      body.appendChild(st);
      var sv = h('ul', { class: 'st-list', 'aria-label': 'Services' });
      r.services.forEach(function (s) { var lab = s.state === 'up' ? 'Working' : s.state === 'maint' ? 'Maintenance' : 'Off'; sv.appendChild(h('li', { class: 'st-row ' + s.state }, [h('i', { class: 'st-dot', 'aria-hidden': 'true' }), h('span', { class: 'st-n', text: s.name }), h('span', { class: 'st-s', text: lab })])); });
      body.appendChild(sv);
      if (Hub.me && Hub.me.owner && !r.durable) body.appendChild(h('div', { class: 'st-note warn' }, [icon('hard-drive'), h('span', { text: 'Owner note: saved data is not set to survive restarts on this server. Connect durable storage so accounts and balances are kept.' })]));
      body.appendChild(h('p', { class: 'hint', style: 'margin-top:14px', text: 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + '. Something wrong that is not listed? ' }, h('button', { class: 'linkbtn', type: 'button', text: 'Report it', onclick: function () { Hub.reportModal({ kind: 'bug' }); } })));
    }
    function load() { var t0 = Date.now(); Hub.api('/api/status').then(function (r) { if (v.isConnected) paint(r, Date.now() - t0); }); }
    load(); timer = setInterval(function () { if (!v.isConnected) { clearInterval(timer); return; } if (!document.hidden) load(); }, 15000);
    return v;
  };

  // ---------------------------------------------------------------- Apply to be a mod
  Hub.views.apply = function () {
    var v = h('div', { class: 'st-page' }), body = h('div');
    head('Apply to be a moderator', 'Moderators keep ScrollHub friendly and fair. Tell us who you are and how you would help.').forEach(function (e) { e && v.appendChild(e); }); v.appendChild(body); body.appendChild(h('div', { class: 'skel', style: 'height:160px;border-radius:16px' }));
    function paint(r) {
      Hub.clear(body);
      if (!r || !r.ok) { body.appendChild(Hub.emptyState('triangle-alert', 'Could not load the form', 'Try again in a moment.', h('button', { class: 'btn primary', type: 'button', text: 'Try again', onclick: load }))); return; }
      if (r.isStaff) { body.appendChild(Hub.emptyState('shield', 'You are already on the team', 'Owners review applications in Admin tools.', h('a', { class: 'btn primary', href: '#/admin/apps', text: 'Open Admin tools' }))); return; }
      if (!r.signedIn) { body.appendChild(Hub.emptyState('user', 'Sign in to apply', 'Applications are tied to your ScrollHub account so we know who you are.', h('button', { class: 'btn primary', type: 'button', text: 'Sign in or create an account', onclick: function () { Hub.showLogin && Hub.showLogin(); } }))); return; }
      var m = r.mine;
      if (m) {
        var map = { pending: ['info', 'clock', 'Your application is in', 'We read every one. Check back here for the answer.'], accepted: ['ok', 'circle-check', 'You were accepted', 'Welcome to the team. An owner will give you the mod role.'], denied: ['bad', 'circle-alert', 'Not this time', 'You can apply again 7 days after the answer.'], waitlist: ['warn', 'clock', 'You are on the waitlist', 'We liked your application but have no open spot yet.'] }[m.status] || ['info', 'info', 'Application sent', ''];
        body.appendChild(h('div', { class: 'st-hero ' + map[0], role: 'status' }, [icon(map[1]), h('div', {}, [h('h2', { text: map[2] }), h('p', { text: map[3] }), m.note ? h('p', { class: 'st-quote', text: 'Note from the team: ' + m.note }) : null, h('p', { class: 'hint', text: 'Sent ' + Hub.dateShort(m.ts) })])]));
        if (m.status === 'pending' || m.status === 'accepted' || m.status === 'waitlist' || (m.status === 'denied' && Date.now() - (m.decidedAt || m.ts) < 7 * 86400000)) return;
      }
      if (!r.open) { body.appendChild(Hub.emptyState('clock', 'Applications are closed', 'We are not taking new mods right now. Check back soon.')); return; }
      body.appendChild(h('div', { class: 'st-note' }, [icon('info'), h('span', { text: 'Be honest and specific. Short answers like "i like games" will not get picked. It takes about five minutes.' })]));
      var form = h('form', { class: 'ap-form', novalidate: 'novalidate' }), fields = {};
      r.questions.forEach(function (q) {
        var el = q.kind === 'line' ? h('input', { class: 'input', type: 'text', maxlength: String(q.max), autocomplete: 'off', spellcheck: 'false' }) : h('textarea', { class: 'input', maxlength: String(q.max), rows: '4' });
        var optional = q.min === 0, cnt = h('span', { class: 'ap-c', 'aria-hidden': 'true' }), id = 'ap-' + q.id; el.id = id;
        var lab = h('label', { class: 'ap-q', for: id }, [h('span', { class: 'ap-l', text: q.label + (optional ? ' (optional)' : '') }), q.hint ? h('span', { class: 'hint', text: q.hint }) : null]);
        function upd() { var n = el.value.trim().length; cnt.textContent = q.kind === 'line' ? '' : n + ' / ' + q.max; cnt.className = 'ap-c' + (q.min && n < q.min ? ' low' : ''); el.removeAttribute('aria-invalid'); }
        el.addEventListener('input', upd); upd(); fields[q.id] = el;
        form.appendChild(h('div', { class: 'ap-f' }, [lab, el, cnt]));
      });
      var msg = h('div', { 'aria-live': 'polite' }), go = h('button', { class: 'btn primary', type: 'submit', text: 'Send application' });
      form.appendChild(msg); form.appendChild(go); body.appendChild(form);
      form.addEventListener('submit', function (e) {
        e.preventDefault(); Hub.clear(msg); var answers = {}; Object.keys(fields).forEach(function (k) { answers[k] = fields[k].value; });
        go.disabled = true;
        Hub.api('/api/apply', { body: { answers: answers } }).then(function (x) {
          go.disabled = false;
          if (x && x.ok) { Hub.toast('Application sent', { icon: 'send' }); load(); return; }
          msg.appendChild(errBox((x && x.message) || 'Could not send right now. Try again.'));
          if (x && x.field && fields[x.field]) { fields[x.field].setAttribute('aria-invalid', 'true'); fields[x.field].focus(); }
        });
      });
    }
    function load() { Hub.api('/api/apply').then(function (r) { if (v.isConnected) paint(r); }); }
    load();
    return v;
  };

  // ---------------------------------------------------------------- Report
  Hub.reportModal = function (o) {
    o = o || {}; var kind = o.kind || (o.username ? 'player' : 'bug');
    var who = h('input', { class: 'input', type: 'text', placeholder: 'Their ScrollHub username', maxlength: '30', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Player username' });
    var ta = h('textarea', { class: 'input', maxlength: '500', rows: '4', 'aria-label': 'What happened' }), msg = h('div', { 'aria-live': 'polite' });
    var whoF = h('label', { class: 'field' }, [h('span', { text: 'Who are you reporting?' }), who]);
    var send = h('button', { class: 'btn primary block', type: 'button', text: 'Send report' });
    who.value = o.username || '';
    function setKind(k) { kind = k; whoF.hidden = k !== 'player'; ta.placeholder = k === 'player' ? 'What did they do? Include where it happened.' : k === 'bug' ? 'What broke? Which game or page, and what did you click?' : 'Tell us what is on your mind.'; Hub.clear(msg); }
    var seg = Hub.seg([['player', 'A player'], ['bug', 'A problem'], ['other', 'Something else']], kind, setKind);
    var body = h('div', { class: 'mbody' }, [h('h3', { text: 'Report' }), h('p', { class: 'hint', text: 'Reports go to the moderators. Only the team can read them.' }), h('div', { style: 'margin:10px 0 14px' }, seg), whoF, h('label', { class: 'field' }, [h('span', { text: 'Details' }), ta]), msg, send]);
    var m = Hub.modal(body, { small: true, label: 'Report' }); setKind(kind);
    send.addEventListener('click', function () {
      Hub.clear(msg); var text = ta.value.trim();
      if (kind === 'player') {
        if (!signedIn()) { msg.appendChild(errBox('Sign in to report a player.')); return; }
        if (!who.value.trim()) { msg.appendChild(errBox('Type the username of the player.')); who.focus(); return; }
        if (text.length < 8) { msg.appendChild(errBox('Say what happened, in a few words.')); ta.focus(); return; }
        send.disabled = true;
        Hub.api('/api/social/report', { body: { username: who.value.trim(), reason: text } }).then(function (r) { send.disabled = false; if (r && r.ok) { Hub.toast('Report sent. Thank you.', { icon: 'flag' }); m.close(); } else msg.appendChild(errBox(r && r.error === 'no-account' ? 'No player has that username. Check the spelling.' : (r && r.message) || 'Could not send right now.')); });
      } else {
        if (text.length < 4) { msg.appendChild(errBox('Write a little more first.')); ta.focus(); return; }
        send.disabled = true;
        Hub.api('/api/hub/feedback', { body: { text: (kind === 'bug' ? '[Problem report] ' : '') + text + (kind === 'bug' ? ' (page: ' + location.hash + ')' : ''), kind: kind } }).then(function (r) { send.disabled = false; if (r && r.ok) { Hub.toast('Thanks, we got it', { icon: 'send' }); m.close(); } else msg.appendChild(errBox((r && r.message) || 'Could not send right now.')); });
      }
    });
  };

  // ---------------------------------------------------------------- Install app + offline
  var deferred = null;
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { deferred = null; Hub.toast('ScrollHub is installed', { icon: 'download' }); });
  Hub.canInstall = function () { return !standalone() && !(window.ShStealth && window.ShStealth.inFrame && window.ShStealth.inFrame()); };
  Hub.installApp = function () {
    if (deferred) { var d = deferred; deferred = null; d.prompt(); return; }
    var ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent));
    var steps = ios ? ['Open ScrollHub in Safari.', 'Tap the Share button.', 'Choose Add to Home Screen, then tap Add.'] : ['Open the browser menu (the three dots).', 'Choose Install ScrollHub, or Add to Home screen.', 'Open it from your home screen or desktop like any app.'];
    Hub.modal(h('div', { class: 'mbody' }, [h('h3', { text: 'Install ScrollHub' }), h('p', { class: 'hint', text: 'Installed, ScrollHub opens in its own window, loads faster, and shows a friendly page if you lose your connection.' }), h('ol', { class: 'st-steps' }, steps.map(function (s) { return h('li', { text: s }); }))]), { small: true, label: 'Install ScrollHub' });
  };
  if ('serviceWorker' in navigator && location.protocol !== 'file:') { window.addEventListener('load', function () { try { navigator.serviceWorker.register('/hub/sw.js', { scope: '/hub/' }).catch(function () {}); } catch (e) {} }); }

  var bar = null;
  function offline(on) {
    if (on && !bar) { bar = h('div', { id: 'offbar', role: 'status' }, [icon('wifi'), h('span', { text: 'You are offline. Games and chat need a connection.' })]); document.body.appendChild(bar); }
    if (!on && bar) { bar.remove(); bar = null; Hub.toast('Back online', { icon: 'wifi' }); }
  }
  window.addEventListener('offline', function () { offline(true); }); window.addEventListener('online', function () { offline(false); });
  if (navigator.onLine === false) offline(true);


  // ---------------------------------------------------------------- pop-ups when ScrollHub is closed (web push)
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.userAgent));
  var pushOK = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  Hub.pushHas = false;
  function key64(k) { var p = '='.repeat((4 - k.length % 4) % 4), b = (k + p).replace(/-/g, '+').replace(/_/g, '/'), r = atob(b), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function withTimeout(pr, ms, tag) { return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error(tag || 'timeout')); }, ms); pr.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); }); }); }
  // The registration that belongs to /hub/ (the site also has a root worker, which must not be used for pop-ups).
  function reg() {
    return navigator.serviceWorker.getRegistrations().then(function (list) {
      for (var i = 0; i < list.length; i++) if (/\/hub\/$/.test(list[i].scope)) return list[i];
      return navigator.serviceWorker.register('/hub/sw.js', { scope: '/hub/' });
    }).then(function (r) {
      if (r.active) return r;
      var w = r.installing || r.waiting; if (!w) return r;
      return withTimeout(new Promise(function (res) { if (w.state === 'activated') return res(r); w.addEventListener('statechange', function () { if (w.state === 'activated') res(r); }); }), 10000, 'sw');
    });
  }
  Hub.pushRefresh = function () {
    if (!pushOK || !signedIn()) { Hub.pushHas = false; return Promise.resolve(false); }
    return reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { Hub.pushHas = !!s && Notification.permission === 'granted'; return Hub.pushHas; }).catch(function () { return false; });
  };
  Hub.pushEnable = function () {
    if (!pushOK) return Promise.resolve({ error: 'unsupported', message: 'This browser cannot show pop-ups when ScrollHub is closed.' });
    if (Notification.permission === 'denied') return Promise.resolve({ error: 'denied', message: 'Pop-ups are blocked for this site. Allow notifications in your browser settings, then try again.' });
    var framed = false; try { framed = window.top !== window.self; } catch (e) { framed = true; }
    var ask = new Promise(function (res) { var done = false, fin = function (p) { if (!done) { done = true; res(p); } }; try { var r = Notification.requestPermission(fin); if (r && r.then) r.then(fin, function () { fin('denied'); }); } catch (e) { fin('denied'); } });
    return withTimeout(ask, 45000, 'prompt').then(function (perm) {
      if (perm !== 'granted') return { error: 'denied', message: perm === 'default' ? 'You closed the permission box. Tap Turn on again and choose Allow.' : 'Pop-ups were blocked. Allow notifications for ScrollHub in your browser settings.' };
      return withTimeout(Promise.all([reg(), Hub.api('/api/push/key')]), 15000, 'setup').then(function (a) {
        if (!a[1] || !a[1].key) return { error: 'server', message: 'ScrollHub could not get its pop-up key. Try again in a minute.' };
        return a[0].pushManager.getSubscription().then(function (old) { return old || withTimeout(a[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key64(a[1].key) }), 20000, 'subscribe'); });
      }).then(function (sub) { if (sub && sub.error) return sub; return Hub.api('/api/push/subscribe', { body: { subscription: sub.toJSON() } }).then(function (r) { Hub.pushHas = !!(r && r.ok); return r && r.ok ? { ok: true } : { error: 'server', message: (r && r.message) || 'ScrollHub could not save this device. Try again.' }; }); });
    }).catch(function (e) {
      var m = e && e.message;
      if (framed) return { error: 'framed', message: 'Pop-ups cannot be turned on from inside another page. Open ScrollHub in its own tab and try there.' };
      if (m === 'prompt') return { error: 'timeout', message: 'Your browser never showed the permission box. Check the address bar for a blocked-notifications icon.' };
      if (m === 'subscribe' || (e && e.name === 'AbortError')) return { error: 'push', message: 'Your browser could not connect to its push service. Check your connection, or try a different browser.' };
      return { error: 'failed', message: 'Could not turn pop-ups on. Reload the page and try again.' };
    });
  };
  Hub.pushDisable = function () {
    if (!pushOK) return Promise.resolve();
    return reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { if (!s) return; var ep = s.endpoint; return s.unsubscribe().then(function () { return Hub.api('/api/push/unsubscribe', { body: { endpoint: ep } }); }); }).then(function () { Hub.pushHas = false; }, function () { Hub.pushHas = false; });
  };
  Hub.pushSettings = function () {
    var box = h('div', { class: 'pu-box' });
    box.appendChild(h('h4', { text: 'Pop-ups when ScrollHub is closed' }));
    box.appendChild(h('p', { class: 'hint', text: 'Get a pop-up on this device when someone messages you or sends a request, even if ScrollHub is not open.' }));
    var body = h('div'); box.appendChild(body);
    function paint() {
      Hub.clear(body);
      if (!signedIn()) { body.appendChild(h('p', { class: 'hint', text: 'Sign in to turn pop-ups on.' })); return; }
      if (!pushOK) {
        body.appendChild(h('div', { class: 'st-note' }, [icon('info'), h('span', { text: isIOS ? 'On iPhone and iPad, pop-ups only work after you add ScrollHub to your Home Screen. Install it, open it from your Home Screen, then come back here.' : 'This browser does not support pop-ups when a site is closed. Try Chrome, Edge or Firefox, or install ScrollHub.' })]));
        if (Hub.canInstall()) body.appendChild(h('div', { style: 'margin-top:10px' }, h('button', { class: 'btn sm primary', type: 'button', onclick: Hub.installApp }, [icon('download'), 'How to install'])));
        return;
      }
      if (Notification.permission === 'denied') { body.appendChild(h('div', { class: 'st-note bad' }, [icon('circle-alert'), h('span', { text: 'Pop-ups are blocked for this site. Allow notifications for ScrollHub in your browser settings, then reload.' })])); return; }
      Hub.pushRefresh().then(function (on) {
        Hub.clear(body);
        body.appendChild(Hub.toggle('Pop-ups on this device', on ? 'On' : 'Off', on, function (v) {
          if (v) Hub.pushEnable().then(function (r) { if (r && r.ok) Hub.toast('Pop-ups are on', { icon: 'bell' }); else Hub.toast((r && r.message) || 'Could not turn them on', { bad: true }); paint(); });
          else Hub.pushDisable().then(function () { Hub.toast('Pop-ups are off'); paint(); });
        }));
        if (!on) return;
        Hub.api('/api/push/state').then(function (st) {
          if (!st || !st.ok || !body.isConnected) return; var p = st.prefs, rows = [['dm', 'Direct messages', 'Someone messages you.'], ['friend', 'Friend requests', 'A new request, or someone accepts yours.'], ['mention', 'Mentions', 'Someone @mentions you in a server.']];
          if (st.staff) rows.push(['staff', 'Staff alerts', 'New mod applications and player reports.']);
          rows.forEach(function (r) { body.appendChild(Hub.toggle(r[1], r[2], p[r[0]] !== false, function (v) { var o = {}; o[r[0]] = v; Hub.api('/api/push/prefs', { body: o }); })); });
          body.appendChild(h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn sm', type: 'button', onclick: function (e) { var b = e.currentTarget; b.disabled = true; Hub.api('/api/push/test', { body: {} }).then(function (r) { b.disabled = false; if (r && r.ok) Hub.toast('Test sent. Close this tab to see it.', { icon: 'bell' }); else Hub.toast((r && r.message) || 'Could not send a test', { bad: true }); }); } }, [icon('send'), 'Send a test pop-up'])));
        });
      });
    }
    paint(); return box;
  };
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', function (e) {
    var m = e.data || {};
    if (m.t === 'go' && m.url) { var i = m.url.indexOf('#'); if (m.url.indexOf('/hub/') === 0 && i >= 0) location.hash = m.url.slice(i + 1).replace(/^\//, '#/').replace(/^#\/?/, '#/'); else location.href = m.url; }
    if (m.t === 'push' && m.d && Hub.me && Hub.me.kind === 'user') Hub.toast((m.d.title ? m.d.title + ': ' : '') + (m.d.body || ''), { icon: 'bell', ms: 4500 });
  });

  // ---------------------------------------------------------------- menus and support links
  Hub.menuExtras = function (items, me) {
    var at = items.length, extra = [{ label: "What's New", icon: 'megaphone', fn: function () { location.hash = '#/news'; }, right: Hub.newsUnseen ? 'New' : null }, { label: 'Site status', icon: 'gauge', fn: function () { location.hash = '#/status'; } }, { label: 'Report a problem', icon: 'flag', fn: function () { Hub.reportModal(); } }];
    if (me.kind === 'user' && !me.role) extra.push({ label: 'Apply to be a mod', icon: 'user-plus', fn: function () { location.hash = '#/apply'; } });
    if (Hub.canInstall()) extra.push({ label: 'Install app', icon: 'download', fn: Hub.installApp });
    items.splice.apply(items, [at, 0].concat(extra));
  };
  var support = Hub.supportModal;
  if (support) Hub.supportModal = function () {
    support(); var f = document.querySelector('.modal .faq'); if (!f) return;
    f.appendChild(h('div', { class: 'st-links' }, [h('a', { class: 'btn sm', href: '#/status', onclick: function () { var m = document.querySelector('.mclose'); m && m.click(); } }, [icon('gauge'), 'Site status']), h('button', { class: 'btn sm', type: 'button', onclick: function () { var c = document.querySelector('.mclose'); c && c.click(); Hub.reportModal(); } }, [icon('flag'), 'Report a problem']), h('a', { class: 'btn sm', href: '#/apply', onclick: function () { var c = document.querySelector('.mclose'); c && c.click(); } }, [icon('user-plus'), 'Apply to be a mod'])]));
  };

  // ---------------------------------------------------------------- the small "More" block (sidebar) and More tab (phone)
  function moreItems() {
    var me = Hub.me || {}, l = [{ id: 'news', label: "What's New", icon: 'megaphone', hash: '#/news', dot: !!Hub.newsUnseen }, { id: 'status', label: 'Site status', icon: 'gauge', hash: '#/status' }];
    if (me.kind === 'user' && !me.role) l.push({ id: 'apply', label: 'Become a mod', icon: 'user-plus', hash: '#/apply', hot: true });
    l.push({ id: 'report', label: 'Report a problem', icon: 'flag', fn: function () { Hub.reportModal(); } });
    if (Hub.canInstall()) l.push({ id: 'install', label: 'Install app', icon: 'download', fn: Hub.installApp });
    return l;
  }
  Hub.moreBlock = function (root) {
    var open = Hub.ls.get('sh_nav_more', true) !== false, wide = window.innerWidth > 1100, items = moreItems(), anyDot = items.some(function (x) { return x.dot; });
    var wrap = h('nav', { class: 'nav nav-more', 'aria-label': 'More' });
    var head = h('button', { class: 'nav-g more' + (open ? '' : ' shut'), type: 'button', 'aria-expanded': open ? 'true' : 'false', title: open ? 'Hide extra pages' : 'Show extra pages' }, [h('span', { text: 'More' }), !open && anyDot ? h('i', { class: 'dot plain mdot' }) : null, icon('chevron-down')]);
    head.addEventListener('click', function () { Hub.ls.set('sh_nav_more', !open); Hub.renderChrome(); }); wrap.appendChild(head);
    if (open || !wide) items.forEach(function (x) {
      var kids = [icon(x.icon), h('span', { text: x.label }), x.dot ? h('i', { class: 'dot plain nav-dot' }) : null], cls = (root === x.id ? 'on ' : '') + (x.hot ? 'hot' : '');
      if (x.hash) wrap.appendChild(h('a', { href: x.hash, class: cls, 'aria-current': root === x.id ? 'page' : null, title: x.label }, kids));
      else wrap.appendChild(h('button', { type: 'button', class: 'nb ' + cls, title: x.label, onclick: x.fn }, kids));
    });
    return wrap;
  };
  Hub.moreMenu = function (anchor) {
    Hub.menu(anchor, moreItems().map(function (x) { return { label: x.label, icon: x.icon, right: x.dot ? 'New' : null, fn: x.hash ? function () { location.hash = x.hash; } : x.fn }; }), { above: true, align: 'right' });
  };
  Hub.on('prefs', function () {});

  // ---------------------------------------------------------------- keyboard and screen reader help
  var skip = document.getElementById('skipLink');
  if (skip) skip.addEventListener('click', function (e) { e.preventDefault(); var sc = document.getElementById('scroll'); if (sc) sc.focus(); });
  var ann = h('div', { class: 'sr-only', id: 'routeAnn', 'aria-live': 'polite', role: 'status' }); document.body.appendChild(ann);
  var firstNav = true;
  window.addEventListener('hashchange', function () {
    if (firstNav) { firstNav = false; }
    setTimeout(function () {
      if (!Hub.ready || Hub.playing) return; ann.textContent = document.title;
      var sc = document.getElementById('scroll'), a = document.activeElement;
      if (sc && !document.querySelector('.modal') && (!a || a === document.body || /^(A|BUTTON)$/.test(a.tagName))) sc.focus({ preventScroll: true });
    }, 120);
  });

  Hub.on('ready', function () { Hub.pushRefresh && Hub.pushRefresh().then(function (on) { if (on && Hub.parse().name === 'home') Hub.render(true); }); loadNews(true); setInterval(function () { if (!document.hidden) loadNews(true); }, 300000); });
})();
