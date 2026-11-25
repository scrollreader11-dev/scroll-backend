/* Scrolls Casino: the Arcade. Skill games that pay a little. The server runs every round and checks every answer;
   this file only draws the pads, the targets and the sums. Nothing here is a bet. */
(function () {
  var SC = window.SC; if (!SC || !SC.games) return;
  var api = SC.api, fmt = SC.fmt, toast = SC.toast;
  var $ = function (id) { return document.getElementById(id); };
  function sfx(n) { try { SC.sfx && SC.sfx(n); } catch (e) {} }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function post(act, body) { return api('g/arcade' + (act ? '/' + act : ''), body || {}); }
  function applyProfile(d) { if (d && d.profile) SC.setProfile(d.profile); }
  function section(id, html) { var host = document.querySelector('#panel .pbody'); if (!host || document.querySelector('[data-panel="' + id + '"]')) return; var s = document.createElement('section'); s.className = 'view center'; s.dataset.panel = id; s.style.position = 'relative'; s.innerHTML = html; host.appendChild(s); }
  var GAME = { echo: 'echo', aim: 'aim', mathrush: 'math' };   // panel kind -> server game
  var run = { kind: '', token: 0 };                              // which round is on screen; a new token cancels older timers
  function live(kind, tok) { return SC.panelKind === kind && run.token === tok; }

  var CSS = '.ar-stat{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:6px 0 12px;font-size:13px;color:var(--mut)}.ar-stat span{background:rgba(0,0,0,.25);border-radius:9px;padding:4px 10px}.ar-stat b{color:var(--gold)}' +
    '.ar-pads{display:grid;grid-template-columns:repeat(2,120px);gap:12px;justify-content:center;margin:14px auto}.ar-pad{height:120px;border-radius:22px;border:4px solid var(--line);cursor:pointer;opacity:.55;transition:opacity .08s,transform .08s;box-shadow:0 6px 0 rgba(0,0,0,.35)}.ar-pad.lit{opacity:1;transform:scale(1.04);filter:brightness(1.35)}.ar-pad:disabled{cursor:default}.ar-pads.go .ar-pad{opacity:.85}.ar-pads.go .ar-pad:active{transform:translateY(3px)}' +
    '.ar-arena{position:relative;width:min(560px,100%);aspect-ratio:16/9;margin:10px auto;border-radius:18px;border:4px solid var(--line);background:repeating-linear-gradient(45deg,#1b1546,#1b1546 14px,#20194f 14px,#20194f 28px);overflow:hidden;cursor:crosshair;touch-action:manipulation}' +
    '.ar-tg{position:absolute;aspect-ratio:1;border-radius:50%;transform:translate(-50%,-50%);border:4px solid #fff;background:radial-gradient(circle,#ff5c6c 0 22%,#fff 22% 44%,#ff5c6c 44% 66%,#fff 66%);cursor:crosshair;padding:0;animation:arpop .12s ease-out}@keyframes arpop{from{transform:translate(-50%,-50%) scale(.3)}to{transform:translate(-50%,-50%) scale(1)}}' +
    '.ar-life{height:6px;border-radius:3px;background:rgba(255,255,255,.12);width:min(560px,100%);margin:0 auto 4px;overflow:hidden}.ar-life i{display:block;height:100%;background:var(--gold);width:100%}' +
    '.ar-q{font-size:56px;font-weight:800;margin:14px 0 10px;font-variant-numeric:tabular-nums}.ar-in{width:150px;height:56px;font-size:30px;text-align:center;border-radius:14px;border:3px solid var(--line);background:#fff;color:#111;font-weight:700}.ar-time{height:10px;border-radius:5px;background:rgba(255,255,255,.12);width:min(360px,100%);margin:0 auto 6px;overflow:hidden}.ar-time i{display:block;height:100%;background:var(--green);width:100%}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  var STATS = '<div class="ar-stat" data-ar="stat"></div><div class="ar-combo" data-ar="combo"></div>';
  st.textContent += '.ar-combo{min-height:22px;text-align:center;font-weight:800;color:#ffb347;font-size:15px;margin:-6px 0 6px}.ar-combo.bump{animation:arbump .25s ease-out}@keyframes arbump{from{transform:scale(1.5)}to{transform:scale(1)}}' +
    '.ar-pop{position:absolute;left:50%;top:40%;transform:translate(-50%,0);font-weight:900;font-size:26px;color:var(--gold);text-shadow:0 2px 0 rgba(0,0,0,.5);pointer-events:none;animation:arrise .9s ease-out forwards;z-index:5;white-space:nowrap}.ar-pop.bad{color:var(--red)}.ar-pop.big{font-size:34px;color:#b8ff5c}' +
    '@keyframes arrise{0%{opacity:0;transform:translate(-50%,10px) scale(.6)}15%{opacity:1;transform:translate(-50%,0) scale(1.15)}100%{opacity:0;transform:translate(-50%,-48px) scale(1)}}' +
    '.ar-shake{animation:arshake .28s}@keyframes arshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}}' +
    '.ar-flash-ok{animation:arok .35s}@keyframes arok{from{box-shadow:0 0 0 0 rgba(43,213,118,.9)}to{box-shadow:0 0 0 22px rgba(43,213,118,0)}}.ar-flash-no{animation:arno .35s}@keyframes arno{from{box-shadow:0 0 0 0 rgba(255,92,108,.9)}to{box-shadow:0 0 0 22px rgba(255,92,108,0)}}' +
    '.ar-tg.gold{border-color:#ffd166;background:radial-gradient(circle,#fff 0 22%,#ffd166 22% 44%,#fff 44% 66%,#ffd166 66%);box-shadow:0 0 18px #ffd166;animation:arpop .12s ease-out,argold .5s ease-in-out infinite alternate}@keyframes argold{from{filter:brightness(1)}to{filter:brightness(1.4)}}' +
    '.ar-burst{position:absolute;width:14px;height:14px;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);animation:arburst .5s ease-out forwards}@keyframes arburst{to{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.2)}}' +
    '.ar-key{display:inline-block;min-width:20px;padding:1px 6px;border-radius:6px;background:rgba(255,255,255,.14);font-size:11px;font-weight:700;margin-left:6px;color:var(--mut)}';
  // Little bits of feedback every game shares: a rising "+12", a streak counter, a shake on a miss.
  function host(kind) { return document.querySelector('[data-panel="' + kind + '"]'); }
  function pop(kind, text, cls, x, y, into) { var h = into || host(kind); if (!h) return; var e = document.createElement('div'); e.className = 'ar-pop' + (cls ? ' ' + cls : ''); e.textContent = text; if (x != null) { e.style.left = x + '%'; } if (y != null) e.style.top = y + '%'; h.appendChild(e); setTimeout(function () { e.remove(); }, 950); }
  function combo(kind, n, word) { var h = host(kind), c = h && h.querySelector('[data-ar="combo"]'); if (!c) return; if (n >= 2) { c.textContent = '🔥 ' + n + (word ? ' ' + word : ' in a row'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } else c.textContent = ''; }
  function shake(el) { if (!el) return; el.classList.remove('ar-shake'); void el.offsetWidth; el.classList.add('ar-shake'); }
  function flashEl(el, ok) { if (!el) return; var c = ok ? 'ar-flash-ok' : 'ar-flash-no'; el.classList.remove('ar-flash-ok', 'ar-flash-no'); void el.offsetWidth; el.classList.add(c); }
  function tone(f, d, type, v) { try { SC.sfxTone && SC.sfxTone(f, d, type || 'triangle', v || 0.2); } catch (e) {} }
  function good(streak) { try { SC.sfxTone && SC.sfxTone(520 + Math.min(streak, 10) * 60, 0.12, 'triangle', 0.2); } catch (e) {} }
  section('echo', '<div class="hint">Watch the pattern, then repeat it. It grows by one every round and pays a little more each time.</div>' + STATS + '<div class="ar-pads" id="ecPads"></div><div class="mg-row"><button class="btn gold act" id="ecGo">Start</button></div><div class="msg center" id="ecMsg"></div>');
  section('aim', '<div class="hint">20 targets. Click each one before it fades. Quick hits score 3, a miss costs a point.</div>' + STATS + '<div class="ar-life"><i id="amLife"></i></div><div class="ar-arena" id="amArena"></div><div class="mg-row"><button class="btn gold act" id="amGo">Start</button></div><div class="msg center" id="amMsg"></div>');
  section('mathrush', '<div class="hint">45 seconds. Answer as many sums as you can. A streak of three makes them harder.</div>' + STATS + '<div class="ar-time"><i id="mhBar"></i></div><div class="ar-q" id="mhQ">&nbsp;</div><div class="mg-row"><input class="ar-in" id="mhIn" type="text" inputmode="numeric" autocomplete="off" disabled /><button class="btn gold act" id="mhGo">Start</button></div><div class="msg center" id="mhMsg"></div>');

  function msg(id, t, cls) { var m = $(id); if (m) { m.textContent = t || ''; m.className = 'msg center' + (cls ? ' ' + cls : ''); } }
  var info = null;
  function paintStats(kind, d) {
    if (d) info = d; if (!info) return;
    var host = document.querySelector('[data-panel="' + kind + '"] [data-ar="stat"]'); if (!host) return;
    var g = GAME[kind], b = info.best && info.best[g];
    host.innerHTML = '<span>Today <b>' + fmt(info.earnedToday) + '</b> / ' + fmt(info.dayCap) + '</span>' + (b ? '<span>Best <b>' + b + '</b></span>' : '') + (info.halved ? '<span>Pay is halved for the rest of today</span>' : '') + '<span>Up to ' + fmt(info.perPlay) + ' a round</span>';
  }
  function fail(d) { toast(d.message || SC.errMsg(d.error)); }
  function refresh(kind) { return post('info').then(function (d) { if (d && d.ok) { paintStats(kind, d); applyProfile(d); } }); }
  function begin(kind, btn) {
    btn.disabled = true; var tok = ++run.token; run.kind = kind;
    return post('start', { game: GAME[kind] }).then(function (d) {
      if (d.error) { btn.disabled = false; if (d.error === 'capped') paintStats(kind, d); fail(d); return null; }
      paintStats(kind, d); d.tok = tok; return d;
    });
  }
  function finish(kind, btn, id, text, d) { btn.disabled = false; btn.textContent = 'Play again'; paintStats(kind, d); applyProfile(d); msg(id, text + (d.paid ? ' You earned ' + fmt(d.paid) + ' Scrolls.' : d.left === 0 ? ' You hit today’s limit.' : '')); }

  // ---------------------------------------------------------------- echo
  var COL = ['#ff5c6c', '#3a86ff', '#2bd576', '#ffd166'], PITCH = [262, 330, 392, 523];
  function pads() { var h = $('ecPads'); if (h.children.length) return h; COL.forEach(function (c, i) { var b = document.createElement('button'); b.className = 'ar-pad'; b.style.background = c; b.dataset.i = i; b.setAttribute('aria-label', 'Pad ' + (i + 1)); h.appendChild(b); }); return h; }
  function flash(i) { var b = pads().children[i]; b.classList.add('lit'); tone(PITCH[i] * 2, 0.28, 'triangle', 0.22); return sleep(340).then(function () { b.classList.remove('lit'); return sleep(130); }); }
  async function ecPlay(seq, round, tok) {
    var h = pads(); h.classList.remove('go'); msg('ecMsg', 'Round ' + round + ': watch'); await sleep(450);
    for (var i = 0; i < seq.length; i++) { if (!live('echo', tok)) return; await flash(seq[i]); }
    if (!live('echo', tok)) return; var got = []; h.classList.add('go'); msg('ecMsg', 'Round ' + round + ': your turn');
    h.onclick = function (e) {
      var b = e.target.closest('.ar-pad'); if (!b || !h.classList.contains('go') || !live('echo', tok)) return;
      var i = +b.dataset.i; got.push(i); b.classList.add('lit'); tone(PITCH[i] * 2, 0.2, 'triangle', 0.2); setTimeout(function () { b.classList.remove('lit'); }, 120);
      if (got.length < seq.length) return;
      h.classList.remove('go'); h.onclick = null;
      post('step', { seq: got }).then(function (d) {
        if (!live('echo', tok)) return; applyProfile(d); paintStats('echo', d);
        if (d.error) { fail(d); $('ecGo').disabled = false; return; }
        if (d.over) { combo('echo', 0); shake(pads()); finish('echo', $('ecGo'), 'ecMsg', d.score ? 'Wrong pad. You cleared ' + d.score + (d.score === 1 ? ' round.' : ' rounds.') : 'Wrong pad.', d); sfx(d.score ? 'win' : 'lose'); return; }
        msg('ecMsg', 'Round ' + (d.round - 1) + ' cleared' + (d.gain ? ' (+' + d.gain + ')' : '')); if (d.gain) pop('echo', '+' + d.gain, d.round % 5 === 1 ? 'big' : ''); combo('echo', d.round - 1, 'rounds'); sfx('win'); ecPlay(d.seq, d.round, tok);
      });
    };
  }
  var ECKEY = { q: 0, w: 1, a: 2, s: 3, '1': 0, '2': 1, '3': 2, '4': 3 };
  document.addEventListener('keydown', function (e) { if (SC.panelKind !== 'echo' || /^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName || '') || e.ctrlKey || e.metaKey || e.altKey) return; var i = ECKEY[(e.key || '').toLowerCase()]; if (i == null) return; var h = $('ecPads'); if (!h || !h.classList.contains('go')) return; e.preventDefault(); e.stopPropagation(); h.children[i].click(); }, true);
  $('ecGo').onclick = function () { var b = this; pads(); begin('echo', b).then(function (d) { if (d) { b.textContent = 'Playing'; ecPlay(d.seq, 1, d.tok); } }); };

  // ---------------------------------------------------------------- aim
  // From the fifth target on they drift; the small gold ones are worth double. The server tracks the same motion.
  var amTimer = 0, amAnim = 0, amT0 = 0, amLife = 2000, amTarget = null, amBtn = null, amSent = false, amHits = 0;
  function amStopTimers() { clearTimeout(amTimer); cancelAnimationFrame(amAnim); }
  function amFrame() {
    if (!amTarget || !amBtn) return; var el = performance.now() - amT0, k = Math.min(el, amLife) / 1000, t = amTarget;
    amBtn.style.left = (t.x + t.vx * k) + '%'; amBtn.style.top = (t.y + t.vy * k) + '%';
    var bar = $('amLife'); if (bar) bar.style.width = Math.max(0, (1 - el / amLife) * 100) + '%';
    if (el < amLife) amAnim = requestAnimationFrame(amFrame);
  }
  function amArm(tok) { amStopTimers(); amFrame(); amTimer = setTimeout(function () { amSend({ timeout: true }, tok); }, Math.max(30, amLife - (performance.now() - amT0))); }
  function amShow(d, tok) {
    var arena = $('amArena'); arena.innerHTML = ''; if (!live('aim', tok)) return;
    var t = d.t; amTarget = { x: t.x, y: t.y, vx: t.vx || 0, vy: t.vy || 0 }; amLife = d.life; amT0 = performance.now(); amSent = false;
    var b = document.createElement('button'); b.className = 'ar-tg' + (t.gold ? ' gold' : ''); b.style.left = t.x + '%'; b.style.top = t.y + '%'; b.style.width = (t.r * 2) + '%'; b.setAttribute('aria-label', t.gold ? 'Gold target' : 'Target'); arena.appendChild(b); amBtn = b;
    amArm(tok);
  }
  function amBurst(x, y, gold) {
    var arena = $('amArena'); if (!arena) return;
    for (var i = 0; i < 9; i++) { var e = document.createElement('i'); e.className = 'ar-burst'; var a = i / 9 * Math.PI * 2; e.style.left = x + '%'; e.style.top = y + '%'; e.style.setProperty('--dx', Math.cos(a) * 38 + 'px'); e.style.setProperty('--dy', Math.sin(a) * 38 + 'px'); e.style.background = gold ? '#ffd166' : ['#ff5c6c', '#fff', '#ffd166'][i % 3]; arena.appendChild(e); setTimeout(function (n) { n.remove(); }.bind(null, e), 520); }
  }
  function amSend(body, tok) {
    if (amSent || !live('aim', tok)) return; amSent = true; amStopTimers();
    var at = amTarget ? { x: amTarget.x + amTarget.vx * Math.min(performance.now() - amT0, amLife) / 1000, y: amTarget.y + amTarget.vy * Math.min(performance.now() - amT0, amLife) / 1000 } : { x: 50, y: 50 };
    post('step', body).then(function (d) {
      if (!live('aim', tok)) return; applyProfile(d); paintStats('aim', d);
      if (d.error && d.error !== 'early') { fail(d); $('amGo').disabled = false; return; }
      if (d.error === 'early') { amSent = false; amArm(tok); return; }
      if (d.over) { $('amArena').innerHTML = ''; $('amLife').style.width = '0'; combo('aim', 0); finish('aim', $('amGo'), 'amMsg', 'Done: ' + d.score + ' points.', d); sfx(d.score >= 30 ? 'win' : 'click'); return; }
      if (d.miss) {   // same target keeps going: a stray click costs a point, nothing more
        amHits = 0; combo('aim', 0); shake($('amArena')); flashEl($('amArena'), false); tone(180, 0.15, 'sawtooth', 0.12); pop('aim', '−1', 'bad', 50, 20, $('amArena'));
        msg('amMsg', 'Missed. Target ' + (d.i + 1) + ' of 20 · ' + d.pts + ' points', 'lose'); amSent = false; amArm(tok); return;
      }
      if (d.hit) { amHits++; var gold = amTarget && d.gain >= 15 && amTarget.gold; amBurst(at.x, at.y, d.gain >= 15); good(amHits); combo('aim', amHits, 'hits'); if (d.gain) pop('aim', '+' + d.gain, d.gain >= 15 ? 'big' : '', at.x, Math.max(8, at.y - 10), $('amArena')); flashEl($('amArena'), true); }
      else { amHits = 0; combo('aim', 0); tone(200, 0.2, 'sawtooth', 0.1); msg('amMsg', 'Too slow', 'lose'); }
      if (d.hit) msg('amMsg', 'Target ' + (d.i + 1) + ' of 20 · ' + d.pts + ' points'); amShow(d, tok);
    });
  }
  $('amArena').addEventListener('pointerdown', function (e) {
    var tok = run.token; if (run.kind !== 'aim' || amSent || !$('amArena').firstChild) return;
    var r = this.getBoundingClientRect(); amSend({ x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }, tok); e.preventDefault();
  });
  $('amGo').onclick = function () { var b = this; amStopTimers(); amHits = 0; begin('aim', b).then(function (d) { if (d) { b.textContent = 'Playing'; msg('amMsg', 'Target 1 of 20'); amShow(d, d.tok); } }); };

  // ---------------------------------------------------------------- math
  var mhTimer = 0, mhStreak = 0;
  function mhOver(tok, d) { combo('mathrush', 0); clearInterval(mhTimer); $('mhIn').disabled = true; $('mhBar').style.width = '0'; $('mhQ').innerHTML = '&nbsp;'; finish('mathrush', $('mhGo'), 'mhMsg', 'Time. ' + d.score + ' right.', d); sfx(d.score >= 12 ? 'win' : 'click'); }
  $('mhGo').onclick = function () {
    var b = this, inp = $('mhIn'); clearInterval(mhTimer); mhStreak = 0;
    begin('mathrush', b).then(function (d) {
      if (!d) return; var tok = d.tok, ends = Date.now() + d.ms, busy = false; b.textContent = 'Playing'; $('mhQ').textContent = d.q; inp.value = ''; inp.disabled = false; inp.focus(); msg('mhMsg', '');
      mhTimer = setInterval(function () { if (!live('mathrush', tok)) { clearInterval(mhTimer); return; } var f = (ends - Date.now()) / d.ms; $('mhBar').style.width = Math.max(0, f * 100) + '%'; if (f <= 0) { clearInterval(mhTimer); post('step', { finish: true }).then(function (r) { if (live('mathrush', tok)) { applyProfile(r); mhOver(tok, r); } }); } }, 100);
      inp.onkeydown = function (e) {
        if (e.key !== 'Enter' || busy || !inp.value.trim()) return; busy = true; var v = inp.value; inp.value = '';
        post('step', { v: v }).then(function (r) {
          busy = false; if (!live('mathrush', tok)) return; applyProfile(r); paintStats('mathrush', r);
          if (r.error) { fail(r); return; } if (r.over) { mhOver(tok, r); return; }
          if (r.tooFast) { inp.value = v; return; }
          $('mhQ').textContent = r.q; msg('mhMsg', r.correct ? 'Right' + (r.gain ? ' (+' + r.gain + ')' : '') : 'Not quite', r.correct ? 'win' : 'lose');
          if (r.correct) { mhStreak++; good(mhStreak); if (r.gain) pop('mathrush', '+' + r.gain, mhStreak % 3 === 0 ? 'big' : '', 50, 30); combo('mathrush', mhStreak, 'streak'); flashEl($('mhQ'), true); } else { mhStreak = 0; combo('mathrush', 0); shake($('mhQ')); tone(200, 0.2, 'sawtooth', 0.1); }
        });
      };
    });
  };

  SC.arc = { post: post, begin: begin, finish: finish, paintStats: paintStats, msg: msg, section: section, live: live, run: run, GAME: GAME, applyProfile: applyProfile, pop: pop, combo: combo, shake: shake, flashEl: flashEl, tone: tone, good: good, fail: fail, refresh: refresh, sleep: sleep, sfx: sfx, STATS: STATS };
  var OPEN = { echo: 1, aim: 1, mathrush: 1 };
  var prevOpen = SC.games.open;
  SC.games.open = function (kind) {
    if (prevOpen) prevOpen(kind);
    if (!OPEN[kind]) return; run.token++; amStopTimers(); clearInterval(mhTimer);
    var go = { echo: 'ecGo', aim: 'amGo', mathrush: 'mhGo' }[kind]; if ($(go)) { $(go).disabled = false; $(go).textContent = 'Start'; }
    if (kind === 'aim') { $('amArena').innerHTML = ''; $('amLife').style.width = '100%'; amSent = false; } if (kind === 'mathrush') { $('mhQ').innerHTML = '&nbsp;'; $('mhIn').disabled = true; $('mhBar').style.width = '100%'; }
    msg({ echo: 'ecMsg', aim: 'amMsg', mathrush: 'mhMsg' }[kind], ''); if (kind === 'echo') { pads().classList.remove('go'); }
    refresh(kind);
  };
})();
