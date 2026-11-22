/* ScrollHub first-visit tutorial: a spotlight tour. Everything is dimmed except the one thing to click.
   The final stage sends the player into the casino (same-origin iframe) to play 3 rounds. The server counts
   real bets (/api/casino/tut) and pays the one-time reward, so nothing here can be spoofed. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var h = Hub.h, icon = Hub.icon;
  var st = null, stage = 0, raf = 0, ui = null, lastPoll = 0, missingAt = 0, claiming = false, checkedFor = '', paintKey = '';

  function api(body) { return Hub.api('/api/casino/tut', body ? { body: body } : {}); }
  function route() { return Hub.parse().name; }
  function arg0() { return (Hub.parse().args || [])[0]; }
  function vis(el) { if (!el) return null; var r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? el : null; }
  function qv(sels, root) { root = root || document; for (var i = 0; i < sels.length; i++) { var els = root.querySelectorAll(sels[i]); for (var k = 0; k < els.length; k++) if (vis(els[k])) return els[k]; } return null; }
  function rect(el) { if (!el) return null; var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function navEl(name) { return function () { return qv(['#side .nav a[href="#/' + name + '"]', '#tabbar a[href="#/' + name + '"]']); }; }
  function frame() { return document.querySelector('#player iframe'); }
  function sc() { var f = frame(); try { return f && f.contentWindow && f.contentWindow.SC && f.contentWindow.SC.tourRect ? f.contentWindow.SC : null; } catch (e) { return null; } }
  function offset() { var f = frame(); return f ? f.getBoundingClientRect() : { left: 0, top: 0 }; }
  function onCasinoPage() { return route() === 'game' && arg0() === 'scrollhub-casino'; }

  // ---- stages ----------------------------------------------------------------
  var S = [
    { id: 'welcome', center: true, ic: 'sparkles', t: 'Welcome to ScrollHub', p: 'Quick tour: you will click through the hub, then play 3 casino rounds. Finish and you get 1,000,000 Scrolls.', btn: 'Start' },
    { id: 'orig', sel: navEl('originals'), t: 'Originals', p: 'Games built for ScrollHub live here, like Bedwars, Scroll Racing and Royale. Click Originals.', done: function () { return route() === 'originals'; } },
    { id: 'tile', ok: function () { return route() === 'originals'; }, go: '#/originals', sel: function () { return qv(['#view a[href^="#/game/"]']); }, t: 'Open a game', p: 'Every game has its own page. Click any game.', done: function () { return route() === 'game'; } },
    { id: 'back', sel: function () { return qv(['#topbar .back']); }, t: 'Go back', p: 'The arrow takes you back to where you were. Click it.', done: function () { return route() !== 'game'; } },
    { id: 'home', sel: navEl('home'), t: 'Home', p: 'Home is your starting page. Click Home.', done: function () { return route() === 'home'; } },
    { id: 'gift', info: true, optional: true, sel: function () { return qv(['#side .me .gift']); }, t: 'Daily reward', p: 'Claim free Scrolls here every day. Scrolls are the currency for the Store and the casino. They are virtual and have no cash value.', btn: 'Next' },
    { id: 'discord', info: true, skip: function () { return !navEl('discord')(); }, sel: navEl('discord'), t: 'Discord', p: 'Chat with other players, join voice channels and message friends from this tab. It needs an account, not a guest name.', btn: 'Next' },
    { id: 'cjump', ok: function () { return route() === 'home'; }, go: '#/home', sel: function () { return qv(['.jump a[href="#/game/scrollhub-casino"]']); }, t: 'Open the casino', p: 'Click Casino. Play 3 rounds there and the 1,000,000 Scrolls are yours.', done: onCasinoPage },
    { id: 'play', ok: onCasinoPage, go: '#/game/scrollhub-casino', enter: function () { api({ action: 'start' }).then(function (r) { if (r && !r.error) st = r; }); },
      sel: function () { return qv(['.gp-act .btn.primary']); },
      t: function (el) { var x = el ? el.textContent : ''; return el && el.disabled ? 'Installing' : /install|get/i.test(x) ? 'Install the casino' : 'Press Play'; },
      p: function (el) { var x = el ? el.textContent : ''; return el && el.disabled ? 'Hang on a moment. The Play button shows up when it is ready.' : /install|get/i.test(x) ? 'Games install to your library the first time. It only takes a moment, then press Play.' : 'This launches the casino in a window on top of the hub.'; },
      done: function () { return !!Hub.playing; } },
    { id: 'world', back: 'play', need: function () { return !!Hub.playing; }, done: function () { return st && (st.n | 0) >= st.need; }, view: worldView },
    { id: 'leave',
      view: function () {
        var bar = document.querySelector('#player .pbar'), btn = bar && bar.querySelector('button[aria-label="Back to ScrollHub"]');
        if (bar) bar.classList.remove('hide');                // the game bar auto-hides; keep it up while we point at it
        var r = btn && vis(btn) ? rect(btn) : null;
        return { rect: r, t: 'Leaving a game', p: 'Press this arrow, or Esc on your keyboard, to leave any game and come back to the hub. Click it now.' };
      }, done: function () { return !Hub.playing; } },
    { id: 'account', info: true, optional: true, sel: function () { return qv(['#side .me .who', '#topbar .avatar-btn']); }, t: 'Your account', p: 'Profile, settings and sign out are in this menu. To leave ScrollHub entirely, sign out here and close the tab. Your Scrolls are saved to your account.', btn: 'Next' },
    { id: 'claim', center: true, ic: 'gift', t: 'Tutorial complete', p: 'You played 3 rounds. Claim your reward.', btn: function () { return 'Claim ' + Hub.num(st ? st.reward : 1000000) + ' Scrolls'; }, act: claim },
    { id: 'reward', center: true, ic: 'gift', big: true, t: function () { return '+' + Hub.num(st ? st.reward : 1000000) + ' Scrolls'; }, p: 'Added to your balance. Enjoy the games.', btn: 'Keep playing', act: finishTour },
  ];
  function idx(id) { for (var i = 0; i < S.length; i++) if (S[i].id === id) return i; return 0; }
  function go(i) { for (var k = i; k < S.length; k++) S[k]._in = false; stage = i; missingAt = 0; paintKey = ''; }

  function walkToSlot() { var W = sc(); if (W && W.tourWalk) W.tourWalk('slot'); }
  function worldView() {
    var f = frame(), W = sc(), n = st ? st.n | 0 : 0, need = st ? st.need : 3;
    if (!f || !W) return { hidden: true };          // casino still loading
    if (!f._tf) { f._tf = 1; try { f.contentWindow.focus(); } catch (e) {} }
    var off = offset(), cur = W.panelKind || '';
    if (cur === 'slots') {
      var d = null; try { d = f.contentDocument.getElementById('slSpin'); } catch (e) {}
      var r = d && vis(d) ? d.getBoundingClientRect() : null;
      return { rect: r ? { x: r.left + off.left, y: r.top + off.top, w: r.width, h: r.height } : null, t: 'Pull the lever', p: 'Press the button to spin. Round ' + Math.min(n + 1, need) + ' of ' + need + '. Any bet is fine.' };
    }
    if (cur) return { nodim: true, t: 'Close this window', p: 'Close it with the X, then walk up to a slot machine.' };
    var m = W.tourRect('slot');
    if (m && m.on) return { rect: { x: m.x + off.left, y: m.y + off.top, w: m.w, h: m.h }, t: 'Play a slot machine', p: 'Click the machine, or walk to it with WASD and press E. Round ' + Math.min(n + 1, need) + ' of ' + need + '.' };
    var dir = !m ? 'somewhere on the floor' : Math.abs(m.dx) > Math.abs(m.dy) ? (m.dx < 0 ? 'to the left' : 'to the right') : (m.dy < 0 ? 'up' : 'down');
    return { nodim: true, arrow: m ? Math.atan2(m.dy, m.dx) : null, btnText: 'Walk me there', act: walkToSlot, t: 'Find a slot machine', p: 'Slot machines are ' + dir + '. Walk there with WASD or by clicking, or let the game walk you there. Round ' + Math.min(n + 1, need) + ' of ' + need + '.' };
  }

  // ---- overlay ---------------------------------------------------------------
  function build() {
    var tip = h('div', { class: 'tip', role: 'dialog', 'aria-label': 'Tutorial' });
    ui = { root: h('div', { class: 'tour' }), dim: [0, 1, 2, 3].map(function () { return h('div', { class: 'dim' }); }), ring: h('div', { class: 'ring' }), arrow: h('div', { class: 'arrow' }), hole: h('div', { class: 'hole' }), tip: tip };
    ui.dim.forEach(function (d) { ui.root.appendChild(d); }); ui.root.appendChild(ui.hole); ui.root.appendChild(ui.ring); ui.root.appendChild(ui.arrow); ui.root.appendChild(tip);
    document.body.appendChild(ui.root);
  }
  function box(el, x, y, w, hh) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = Math.max(0, w) + 'px'; el.style.height = Math.max(0, hh) + 'px'; }

  function paint(v, s) {
    if (!ui) build();
    var vw = window.innerWidth, vh = window.innerHeight, r = v.rect, pad = 8, tip = ui.tip;
    ui.root.style.display = v.hidden ? 'none' : '';
    if (v.hidden) return;
    var noDiscord = !navEl('discord')(), center = !!v.center || (!r && !v.nodim), nodim = !!v.nodim;
    ui.root.classList.toggle('nodim', nodim);
    var key = [s.id, v.t, v.p, v.btnText, center, nodim].join('|');
    if (key !== paintKey) {
      paintKey = key; tip.textContent = '';
      tip.classList.toggle('center', center); tip.classList.toggle('big', !!v.big);
      if (center && v.ic) tip.appendChild(h('div', { class: 'tt-ic' }, icon(v.ic)));
      tip.appendChild(h('div', { class: 'tt-step', text: s.id === 'reward' ? 'Tutorial complete' : 'Step ' + (Math.min(stage, idx('reward') - 1) + 1 - (noDiscord && stage > idx('discord') ? 1 : 0)) + ' of ' + (idx('reward') - (noDiscord ? 1 : 0)) }));
      tip.appendChild(h('h3', { text: v.t })); tip.appendChild(h('p', { text: v.p }));
      if (v.btnText) { var b = h('button', { class: 'btn primary', type: 'button' }, v.btnText); var fn = v.act || s.act; b.addEventListener('click', function () { if (fn) fn(); else go(stage + 1); }); tip.appendChild(b); }
    }
    if (v.arrow != null) { var rad = Math.min(vw, vh) * 0.3; ui.arrow.style.display = ''; ui.arrow.style.left = (vw / 2 + Math.cos(v.arrow) * rad) + 'px'; ui.arrow.style.top = (vh / 2 + Math.sin(v.arrow) * rad) + 'px'; ui.arrow.style.transform = 'translate(-50%,-50%) rotate(' + v.arrow + 'rad)'; }
    else ui.arrow.style.display = 'none';
    if (nodim) { tip.style.left = '50%'; tip.style.top = 'auto'; tip.style.bottom = 'calc(24px + env(safe-area-inset-bottom, 0px))'; tip.style.transform = 'translateX(-50%)'; return; }
    tip.style.bottom = 'auto'; tip.style.transform = ''; ui.arrow.style.display = 'none';
    if (center || !r) {
      box(ui.dim[0], 0, 0, vw, vh); [1, 2, 3].forEach(function (i) { box(ui.dim[i], 0, 0, 0, 0); });
      ui.ring.style.display = 'none'; ui.hole.style.display = 'none';
      tip.style.left = '50%'; tip.style.top = '50%'; tip.style.transform = 'translate(-50%,-50%)'; return;
    }
    var x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad), w = Math.min(vw - x, r.w + pad * 2), hh = Math.min(vh - y, r.h + pad * 2);
    box(ui.dim[0], 0, 0, vw, y); box(ui.dim[1], 0, y + hh, vw, vh - y - hh); box(ui.dim[2], 0, y, x, hh); box(ui.dim[3], x + w, y, vw - x - w, hh);
    box(ui.ring, x, y, w, hh); ui.ring.style.display = '';
    box(ui.hole, x, y, w, hh); ui.hole.style.display = v.info ? '' : 'none';   // info steps block the target; click steps let clicks through
    var tw = tip.offsetWidth, th = tip.offsetHeight, m = 14, tx, ty;
    if (x + w + m + tw < vw - 8) { tx = x + w + m; ty = y + hh / 2 - th / 2; }
    else if (x - m - tw > 8) { tx = x - m - tw; ty = y + hh / 2 - th / 2; }
    else if (y + hh + m + th < vh - 8) { tx = x + w / 2 - tw / 2; ty = y + hh + m; }
    else { tx = x + w / 2 - tw / 2; ty = y - m - th; }
    tip.style.left = Math.max(8, Math.min(vw - tw - 8, tx)) + 'px'; tip.style.top = Math.max(8, Math.min(vh - th - 8, ty)) + 'px';
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    var s = S[stage]; if (!s) return;
    if (!s._in) { s._in = true; if (s.enter) s.enter(); }
    if (s.back && s.need && !s.need()) { go(idx(s.back)); return; }
    if (s.skip && s.skip()) { go(stage + 1); return; }
    if (s.done && s.done()) { go(stage + 1); return; }
    var now = Date.now();
    if (stage >= idx('world') && stage < idx('leave') && now - lastPoll > 1500) { lastPoll = now; api().then(function (r) { if (r && !r.error) st = r; }); }
    if (s.ok && !s.ok()) {                                   // wrong page for this step: take them there
      if (!s._nav || now - s._nav > 700) { s._nav = now; if (s.go) location.hash = s.go; }
      paint({ hidden: true }, s); return;
    }
    var v;
    if (s.view) v = s.view();
    else {
      var el = s.sel ? s.sel() : null, rr = rect(el);
      if (el && rr && (rr.y < 0 || rr.y + rr.h > window.innerHeight)) { try { el.scrollIntoView({ block: 'center' }); } catch (e) {} rr = rect(el); }
      v = { rect: rr, t: typeof s.t === 'function' ? s.t(el) : s.t, p: typeof s.p === 'function' ? s.p(el) : s.p, ic: s.ic, big: s.big, center: s.center || (s.optional && !rr), info: s.info };
    }
    if (s.btn) v.btnText = typeof s.btn === 'function' ? s.btn() : s.btn;
    if (!s.view && !v.center && !v.rect) { if (!missingAt) missingAt = now; if (now - missingAt > 6000) v.nodim = true; } else missingAt = 0;   // target never showed up: stop blocking
    if (s.view && v.nodim === undefined && !v.rect && !v.hidden) v.nodim = true;
    v.id = s.id; paint(v, s);
  }

  function claim() {
    if (claiming) return; claiming = true;
    api({ action: 'finish' }).then(function (r) {
      claiming = false;
      if (r && r.ok) { st = r; Hub.loadWallet && Hub.loadWallet().then(function () { Hub.renderChrome && Hub.renderChrome(); }); go(idx('reward')); }
      else { if (r && r.n != null) st = r; Hub.toast((r && r.message) || 'Could not claim. Try again.', { bad: true }); }
    }, function () { claiming = false; Hub.toast('Could not reach the server. Try again.', { bad: true }); });
  }
  function finishTour() {
    cancelAnimationFrame(raf); raf = 0; if (ui) { ui.root.remove(); ui = null; }
    var f = frame(); if (f) { try { f.src = f.src; } catch (e) {} }   // reload the casino so its balance is current
  }

  function check() {
    if (raf || !Hub.ready || !Hub.me || Hub.me.kind === 'none' || !Hub.canCasino() || !Hub.byId || !Hub.byId['scrollhub-casino']) return;
    var key = Hub.me.kind + ':' + Hub.me.id; if (checkedFor === key) return; checkedFor = key;
    api().then(function (r) {
      if (!r || r.error || !r.show) return;
      st = r; go(r.started ? ((r.n | 0) >= r.need ? idx('account') : idx('cjump')) : 0);
      raf = requestAnimationFrame(tick);
    });
  }
  Hub.on('ready', function () { setTimeout(check, 1200); });
  if (Hub.ready) setTimeout(check, 1200);
})();
