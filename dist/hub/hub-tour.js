/* ScrollHub first-visit tutorial. Last step makes the player try the casino; the server counts real
   rounds (/api/casino/tut) and pays the one-time reward, so nothing here can be spoofed. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var h = Hub.h, icon = Hub.icon, st = null, card = null, scrim = null, chip = null, poll = 0, checkedFor = '';
  var STEPS = [
    { ic: 'sparkles', t: 'Welcome to ScrollHub', p: 'Every game in one launcher. This quick tour takes about a minute and ends with a reward.' },
    { ic: 'library-big', t: 'Find something to play', p: 'Home shows what is new and what you played last. Originals are games built for ScrollHub, like Bedwars, Scroll Racing and Royale. My Library keeps your recent games and favorites.' },
    { ic: 'users', t: 'Play with other people', p: 'Bedwars, Royale and Scroll Racing put you into live rooms with real players. Sign in to add friends, send messages and join the Discord tab.' },
    { ic: 'coins', t: 'Scrolls are the currency', p: 'You earn Scrolls by playing and by claiming your daily reward on Home. Spend them in the Store on skins and cosmetics. Scrolls are virtual and have no cash value.' },
    { ic: 'dices', t: 'Try the casino', p: 'Open the casino, walk up to any game and press E to play. Play 3 rounds of anything: slots, coinflip, dice, roulette. Finish and you get 1,000,000 Scrolls.', last: true },
  ];
  function api(body) { return Hub.api('/api/casino/tut', body ? { body: body } : {}); }
  function enabled() { return Hub.ready && Hub.me && Hub.me.kind !== 'none' && Hub.canCasino() && Hub.byId && Hub.byId['scrollhub-casino']; }

  function check() {
    if (!enabled()) return;
    var key = Hub.me.kind + ':' + Hub.me.id; if (checkedFor === key) return; checkedFor = key;
    api().then(function (r) {
      if (!r || r.error || !r.show) return;
      st = r;
      if (r.started) showChip(); else step(0);
    });
  }

  function closeCard() { if (card) { card.remove(); card = null; } if (scrim) { scrim.remove(); scrim = null; } }
  function step(i) {
    closeCard(); var s = STEPS[i];
    var dots = h('div', { class: 'tour-dots' }, STEPS.map(function (_, k) { return h('i', { class: k === i ? 'on' : k < i ? 'done' : '' }); }));
    var btn = h('button', { class: 'btn primary', type: 'button', onclick: function () { if (s.last) begin(); else step(i + 1); } }, s.last ? 'Open the casino' : 'Next');
    var back = i > 0 && !s.last ? h('button', { class: 'btn ghost', type: 'button', onclick: function () { step(i - 1); } }, 'Back') : null;
    scrim = h('div', { class: 'tour-scrim' });
    card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tutorial' }, [
      h('div', { class: 'tour-ic' }, icon(s.ic)),
      h('div', { class: 'tour-step', text: 'Step ' + (i + 1) + ' of ' + STEPS.length }),
      h('h2', { text: s.t }), h('p', { text: s.p }), dots,
      h('div', { class: 'tour-act' }, [back, btn]),
    ]);
    document.body.appendChild(scrim); document.body.appendChild(card); btn.focus();
  }

  function begin() {
    api({ action: 'start' }).then(function (r) {
      if (!r || r.error) { Hub.toast((r && r.message) || 'Could not start the tutorial. Try again.', { bad: true }); return; }
      st = r; closeCard(); openCasino(); showChip();
    });
  }
  function openCasino() { var g = Hub.byId['scrollhub-casino']; if (g && !Hub.playing) Hub.play(g); }

  function showChip() {
    if (chip) return;
    var bar = h('i'), txt = h('span', { class: 'tc-t' }), cnt = h('b', { class: 'tc-n' }), act = h('button', { class: 'btn primary sm', type: 'button' });
    chip = h('div', { class: 'tour-chip', role: 'status' }, [h('div', { class: 'tc-l' }, [txt, h('div', { class: 'tc-bar' }, bar)]), cnt, act]);
    document.body.appendChild(chip);
    chip._u = function () {
      if (!st) return; var n = Math.min(st.n | 0, st.need), ready = n >= st.need;
      bar.style.width = (n / st.need * 100) + '%'; cnt.textContent = n + ' / ' + st.need;
      txt.textContent = ready ? 'Tutorial done. Claim your reward.' : 'Tutorial: play ' + st.need + ' rounds (walk to a game, press E)';
      act.textContent = ready ? 'Claim ' + Hub.num(st.reward) : 'Open casino';
      act.onclick = ready ? claim : openCasino; act.hidden = !ready && !!Hub.playing;
    };
    chip._u(); pollNow(); poll = setInterval(pollNow, 2500);
  }
  function pollNow() {
    api().then(function (r) { if (!r || r.error) return; st = r; if (r.done) { stopChip(); return; } if (chip) chip._u(); });
  }
  function stopChip() { clearInterval(poll); poll = 0; if (chip) { chip.remove(); chip = null; } }

  var claiming = false;
  function claim() {
    if (claiming) return; claiming = true;
    api({ action: 'finish' }).then(function (r) {
      claiming = false;
      if (r && r.ok) { st = r; stopChip(); Hub.loadWallet && Hub.loadWallet().then(function () { Hub.renderChrome && Hub.renderChrome(); }); reward(r.paid); }
      else { if (r && r.n != null) { st = r; if (chip) chip._u(); } Hub.toast((r && r.message) || 'Could not claim. Try again.', { bad: true }); }
    }, function () { claiming = false; Hub.toast('Could not reach the server. Try again.', { bad: true }); });
  }
  function reward(n) {
    closeCard();
    scrim = h('div', { class: 'tour-scrim' });
    card = h('div', { class: 'tour-card reward', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Tutorial complete' }, [
      h('div', { class: 'tour-ic' }, icon('gift')), h('div', { class: 'tour-step', text: 'Tutorial complete' }),
      h('h2', { text: '+' + Hub.num(n) + ' Scrolls' }), h('p', { text: 'Added to your balance. Enjoy the games.' }),
      h('div', { class: 'tour-act' }, h('button', { class: 'btn primary', type: 'button', onclick: function () {
        closeCard(); var f = document.querySelector('#player iframe'); if (f) { try { f.src = f.src; } catch (e) {} } // reload the casino so its balance is current
      } }, 'Keep playing')),
    ]);
    document.body.appendChild(scrim); document.body.appendChild(card);
  }

  Hub.on('ready', function () { setTimeout(check, 1200); });
  if (Hub.ready) setTimeout(check, 1200);
})();
