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
  function section(id, html) { var host = document.querySelector('#panel .pbody'); if (!host || document.querySelector('[data-panel="' + id + '"]')) return; var s = document.createElement('section'); s.className = 'view center'; s.dataset.panel = id; s.innerHTML = html; host.appendChild(s); }
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

  var STATS = '<div class="ar-stat" data-ar="stat"></div>';
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
  function flash(i) { var b = pads().children[i]; b.classList.add('lit'); sfx('click'); return sleep(340).then(function () { b.classList.remove('lit'); return sleep(130); }); }
  async function ecPlay(seq, round, tok) {
    var h = pads(); h.classList.remove('go'); msg('ecMsg', 'Round ' + round + ': watch'); await sleep(450);
    for (var i = 0; i < seq.length; i++) { if (!live('echo', tok)) return; await flash(seq[i]); }
    if (!live('echo', tok)) return; var got = []; h.classList.add('go'); msg('ecMsg', 'Round ' + round + ': your turn');
    h.onclick = function (e) {
      var b = e.target.closest('.ar-pad'); if (!b || !h.classList.contains('go') || !live('echo', tok)) return;
      var i = +b.dataset.i; got.push(i); b.classList.add('lit'); sfx('click'); setTimeout(function () { b.classList.remove('lit'); }, 120);
      if (got.length < seq.length) return;
      h.classList.remove('go'); h.onclick = null;
      post('step', { seq: got }).then(function (d) {
        if (!live('echo', tok)) return; applyProfile(d); paintStats('echo', d);
        if (d.error) { fail(d); $('ecGo').disabled = false; return; }
        if (d.over) { finish('echo', $('ecGo'), 'ecMsg', d.score ? 'Wrong pad. You cleared ' + d.score + (d.score === 1 ? ' round.' : ' rounds.') : 'Wrong pad.', d); sfx(d.score ? 'win' : 'lose'); return; }
        msg('ecMsg', 'Round ' + (d.round - 1) + ' cleared' + (d.gain ? ' (+' + d.gain + ')' : '')); ecPlay(d.seq, d.round, tok);
      });
    };
  }
  $('ecGo').onclick = function () { var b = this; pads(); begin('echo', b).then(function (d) { if (d) { b.textContent = 'Playing'; ecPlay(d.seq, 1, d.tok); } }); };

  // ---------------------------------------------------------------- aim
  var amTimer = 0, amAnim = 0;
  function amStopTimers() { clearTimeout(amTimer); cancelAnimationFrame(amAnim); }
  function amShow(d, tok) {
    var arena = $('amArena'); arena.innerHTML = ''; if (!live('aim', tok)) return;
    var t = d.t, b = document.createElement('button'); b.className = 'ar-tg'; b.style.left = t.x + '%'; b.style.top = t.y + '%'; b.style.width = (t.r * 2) + '%'; b.setAttribute('aria-label', 'Target'); arena.appendChild(b);
    var t0 = performance.now(), bar = $('amLife'); amStopTimers();
    (function tick() { var f = 1 - (performance.now() - t0) / d.life; bar.style.width = Math.max(0, f * 100) + '%'; if (f > 0) amAnim = requestAnimationFrame(tick); })();
    amTimer = setTimeout(function () { amSend({ timeout: true }, tok); }, d.life);
    amSent = false;
  }
  var amSent = false;
  function amSend(body, tok) {
    if (amSent || !live('aim', tok)) return; amSent = true; amStopTimers();
    post('step', body).then(function (d) {
      if (!live('aim', tok)) return; applyProfile(d); paintStats('aim', d);
      if (d.error && d.error !== 'early') { fail(d); $('amGo').disabled = false; return; }
      if (d.error === 'early') { amSent = false; return; }
      if (d.over) { $('amArena').innerHTML = ''; $('amLife').style.width = '0'; finish('aim', $('amGo'), 'amMsg', 'Done: ' + d.score + ' points.', d); sfx(d.score >= 30 ? 'win' : 'click'); return; }
      msg('amMsg', 'Target ' + (d.i + 1) + ' of 20 · ' + d.pts + ' points'); if (d.hit) sfx('click'); amShow(d, tok);
    });
  }
  $('amArena').addEventListener('pointerdown', function (e) {
    var tok = run.token; if (run.kind !== 'aim' || amSent || !$('amArena').firstChild) return;
    var r = this.getBoundingClientRect(); amSend({ x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }, tok); e.preventDefault();
  });
  $('amGo').onclick = function () { var b = this; amStopTimers(); begin('aim', b).then(function (d) { if (d) { b.textContent = 'Playing'; msg('amMsg', 'Target 1 of 20'); amShow(d, d.tok); } }); };

  // ---------------------------------------------------------------- math
  var mhTimer = 0;
  function mhOver(tok, d) { clearInterval(mhTimer); $('mhIn').disabled = true; $('mhBar').style.width = '0'; $('mhQ').innerHTML = '&nbsp;'; finish('mathrush', $('mhGo'), 'mhMsg', 'Time. ' + d.score + ' right.', d); sfx(d.score >= 12 ? 'win' : 'click'); }
  $('mhGo').onclick = function () {
    var b = this, inp = $('mhIn'); clearInterval(mhTimer);
    begin('mathrush', b).then(function (d) {
      if (!d) return; var tok = d.tok, ends = Date.now() + d.ms, busy = false; b.textContent = 'Playing'; $('mhQ').textContent = d.q; inp.value = ''; inp.disabled = false; inp.focus(); msg('mhMsg', '');
      mhTimer = setInterval(function () { if (!live('mathrush', tok)) { clearInterval(mhTimer); return; } var f = (ends - Date.now()) / d.ms; $('mhBar').style.width = Math.max(0, f * 100) + '%'; if (f <= 0) { clearInterval(mhTimer); post('step', { finish: true }).then(function (r) { if (live('mathrush', tok)) { applyProfile(r); mhOver(tok, r); } }); } }, 100);
      inp.onkeydown = function (e) {
        if (e.key !== 'Enter' || busy || !inp.value.trim()) return; busy = true; var v = inp.value; inp.value = '';
        post('step', { v: v }).then(function (r) {
          busy = false; if (!live('mathrush', tok)) return; applyProfile(r); paintStats('mathrush', r);
          if (r.error) { fail(r); return; } if (r.over) { mhOver(tok, r); return; }
          if (r.tooFast) { inp.value = v; return; }
          $('mhQ').textContent = r.q; msg('mhMsg', r.correct ? 'Right' + (r.gain ? ' (+' + r.gain + ')' : '') : 'Not quite', r.correct ? 'win' : 'lose'); if (r.correct) sfx('click');
        });
      };
    });
  };

  SC.arc = { post: post, begin: begin, finish: finish, paintStats: paintStats, msg: msg, section: section, live: live, run: run, GAME: GAME, applyProfile: applyProfile, fail: fail, refresh: refresh, sleep: sleep, sfx: sfx, STATS: STATS };
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
