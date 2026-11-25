/* Scrolls Casino: more Arcade games (Trivia Run, Color Clash, Pattern Pro, Word Scramble). Same rules as arcade.js:
   the server asks every question and checks every answer, this file only draws it. */
(function () {
  var SC = window.SC; if (!SC || !SC.arc) return;
  var A = SC.arc, fmt = SC.fmt, $ = function (id) { return document.getElementById(id); };
  var post = A.post, msg = A.msg, live = A.live, run = A.run;
  A.GAME.trivia = 'trivia'; A.GAME.colorclash = 'color'; A.GAME.pattern = 'pattern'; A.GAME.scramble = 'scramble';

  var st = document.createElement('style');
  st.textContent = '.ar-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(520px,100%);margin:12px auto}.ar-opt{padding:14px 10px;border-radius:14px;border:3px solid var(--line);background:rgba(255,255,255,.07);color:inherit;font:inherit;font-weight:700;cursor:pointer;min-height:56px}' +
    '.ar-opt:hover:not(:disabled){border-color:var(--gold)}.ar-opt.ok{background:#1f8a4c;border-color:#2bd576}.ar-opt.no{background:#8a1f2f;border-color:#ff5c6c}.ar-opt:disabled{cursor:default}' +
    '.ar-big{font-size:26px;font-weight:700;margin:12px auto;max-width:520px;line-height:1.25}.ar-seq{font-size:40px;font-weight:800;letter-spacing:.04em;margin:14px 0;font-variant-numeric:tabular-nums}' +
    '.ar-word{font-size:50px;font-weight:800;letter-spacing:.16em;margin:16px 0 8px;text-transform:uppercase}.ar-ink{font-size:68px;font-weight:900;margin:8px 0;text-transform:uppercase;letter-spacing:.04em}' +
    '.ar-ink-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:min(520px,100%);margin:10px auto}.ar-ink-row button{height:64px;border-radius:14px;border:4px solid var(--line);cursor:pointer;font-weight:800;font-size:15px;color:#111;text-transform:capitalize}';
  document.head.appendChild(st);

  var S = A.STATS;
  A.section('trivia', '<div class="hint">10 questions, 15 seconds each. Answers in the first five seconds pay extra.</div>' + S + '<div class="ar-time"><i id="trBar"></i></div><div class="ar-big" id="trQ">&nbsp;</div><div class="ar-opts" id="trOpts"></div><div class="mg-row"><button class="btn gold act" id="trGo">Start</button></div><div class="msg center" id="trMsg"></div>');
  A.section('colorclash', '<div class="hint">30 seconds. Pick the colour the word is printed in, not the word it spells.</div>' + S + '<div class="ar-time"><i id="ccBar"></i></div><div class="ar-ink" id="ccWord">&nbsp;</div><div class="ar-ink-row" id="ccBtns"></div><div class="mg-row"><button class="btn gold act" id="ccGo">Start</button></div><div class="msg center" id="ccMsg"></div>');
  A.section('pattern', '<div class="hint">12 number patterns, 25 seconds each. They get trickier as you go.</div>' + S + '<div class="ar-time"><i id="paBar"></i></div><div class="ar-seq" id="paSeq">&nbsp;</div><div class="mg-row"><input class="ar-in" id="paIn" type="text" inputmode="numeric" autocomplete="off" disabled /><button class="btn gold act" id="paGo">Start</button></div><div class="msg center" id="paMsg"></div>');
  A.section('scramble', '<div class="hint">45 seconds. Unjumble as many words as you can. Five skips per round.</div>' + S + '<div class="ar-time"><i id="wsBar"></i></div><div class="ar-word" id="wsWord">&nbsp;</div><div class="mg-row"><input class="ar-in" id="wsIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:210px" disabled /><button class="btn act" id="wsSkip" disabled>Skip</button><button class="btn gold act" id="wsGo">Start</button></div><div class="msg center" id="wsMsg"></div>');

  var timers = {};
  function stopAll() { for (var k in timers) { clearInterval(timers[k]); clearTimeout(timers[k]); } timers = {}; }
  function bar(id, kind, tok, ms, onEnd) {
    var end = Date.now() + ms, el = $(id); clearInterval(timers[id]);
    timers[id] = setInterval(function () {
      if (!live(kind, tok)) { clearInterval(timers[id]); return; }
      var f = (end - Date.now()) / ms; el.style.width = Math.max(0, f * 100) + '%';
      if (f <= 0) { clearInterval(timers[id]); onEnd && onEnd(); }
    }, 80);
    el.style.width = '100%';
  }

  // ---------------------------------------------------------------- trivia
  function trShow(d, tok) {
    $('trQ').textContent = d.q; var h = $('trOpts'); h.innerHTML = '';
    d.opts.forEach(function (o, i) { var b = document.createElement('button'); b.className = 'ar-opt'; b.textContent = o; b.onclick = function () { trPick(i, b, tok); }; h.appendChild(b); });
    msg('trMsg', 'Question ' + (d.i + 1) + ' of ' + d.n);
    bar('trBar', 'trivia', tok, d.ms, function () { trSend({ timeout: true }, null, tok); });
  }
  var trBusy = false;
  function trPick(i, b, tok) { trSend({ pick: i }, b, tok); }
  function trSend(body, btn, tok) {
    if (trBusy || !live('trivia', tok)) return; trBusy = true; clearInterval(timers.trBar);
    Array.prototype.forEach.call($('trOpts').children, function (x) { x.disabled = true; });
    post('step', body).then(function (d) {
      trBusy = false; if (!live('trivia', tok)) return; A.applyProfile(d); A.paintStats('trivia', d);
      if (d.tooFast) { Array.prototype.forEach.call($('trOpts').children, function (x) { x.disabled = false; }); bar('trBar', 'trivia', tok, 15000, function () { trSend({ timeout: true }, null, tok); }); return; }
      if (d.error) { if (d.error === 'early') { bar('trBar', 'trivia', tok, 500, function () { trSend({ timeout: true }, null, tok); }); return; } A.fail(d); $('trGo').disabled = false; return; }
      Array.prototype.forEach.call($('trOpts').children, function (x) { if (x.textContent === d.answer) x.classList.add('ok'); });
      if (btn && !d.correct) btn.classList.add('no'); A.sfx(d.correct ? 'click' : 'lose');
      A.sleep(d.over ? 900 : 700).then(function () {
        if (!live('trivia', tok)) return;
        if (d.over) { $('trBar').style.width = '0'; $('trOpts').innerHTML = ''; $('trQ').innerHTML = '&nbsp;'; A.finish('trivia', $('trGo'), 'trMsg', 'You got ' + d.score + ' of 10.', d); A.sfx(d.score >= 7 ? 'win' : 'click'); return; }
        trShow(d, tok);
      });
    });
  }
  $('trGo').onclick = function () { var b = this; stopAll(); trBusy = false; A.begin('trivia', b).then(function (d) { if (d) { b.textContent = 'Playing'; trShow(d, d.tok); } }); };

  // ---------------------------------------------------------------- colour clash
  var CC = { red: '#ff5c6c', blue: '#3a86ff', green: '#2bd576', yellow: '#ffd166' }, ccBusy = false;
  var ccBtns = $('ccBtns'); Object.keys(CC).forEach(function (c) { var b = document.createElement('button'); b.style.background = CC[c]; b.textContent = c; b.dataset.c = c; b.disabled = true; ccBtns.appendChild(b); });
  function ccShow(d) { var w = $('ccWord'); w.textContent = d.word; w.style.color = CC[d.ink]; }
  function ccOver(d, tok) { clearInterval(timers.ccBar); $('ccBar').style.width = '0'; Array.prototype.forEach.call(ccBtns.children, function (x) { x.disabled = true; }); $('ccWord').innerHTML = '&nbsp;'; A.finish('colorclash', $('ccGo'), 'ccMsg', 'Time. ' + d.score + ' right.', d); A.sfx(d.score >= 18 ? 'win' : 'click'); }
  ccBtns.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled || ccBusy) return; var tok = run.token; if (!live('colorclash', tok)) return; ccBusy = true;
    post('step', { c: b.dataset.c }).then(function (d) {
      ccBusy = false; if (!live('colorclash', tok)) return; A.applyProfile(d); A.paintStats('colorclash', d);
      if (d.error) { A.fail(d); return; } if (d.over) { ccOver(d, tok); return; } if (d.tooFast) return;
      ccShow(d); msg('ccMsg', d.correct ? 'Right' + (d.gain ? ' (+' + d.gain + ')' : '') : 'Wrong', d.correct ? 'win' : 'lose'); if (d.correct) A.sfx('click');
    });
  });
  $('ccGo').onclick = function () {
    var b = this; stopAll(); ccBusy = false;
    A.begin('colorclash', b).then(function (d) {
      if (!d) return; var tok = d.tok; b.textContent = 'Playing'; ccShow(d); msg('ccMsg', ''); Array.prototype.forEach.call(ccBtns.children, function (x) { x.disabled = false; });
      bar('ccBar', 'colorclash', tok, d.ms, function () { post('step', { finish: true }).then(function (r) { if (live('colorclash', tok)) { A.applyProfile(r); ccOver(r, tok); } }); });
    });
  };

  // ---------------------------------------------------------------- pattern
  var paBusy = false;
  function paShow(d, tok) {
    $('paSeq').textContent = d.seq.join(', ') + ', ?'; var inp = $('paIn'); inp.value = ''; inp.disabled = false; inp.focus(); msg('paMsg', 'Pattern ' + (d.i + 1) + ' of ' + d.n);
    bar('paBar', 'pattern', tok, d.ms, function () { paSend({ timeout: true }, tok); });
  }
  function paSend(body, tok) {
    if (paBusy || !live('pattern', tok)) return; paBusy = true; clearInterval(timers.paBar); $('paIn').disabled = true;
    post('step', body).then(function (d) {
      paBusy = false; if (!live('pattern', tok)) return; A.applyProfile(d); A.paintStats('pattern', d);
      if (d.tooFast) { $('paIn').disabled = false; bar('paBar', 'pattern', tok, 25000, function () { paSend({ timeout: true }, tok); }); return; }
      if (d.error) { if (d.error === 'early') { $('paIn').disabled = false; bar('paBar', 'pattern', tok, 500, function () { paSend({ timeout: true }, tok); }); return; } A.fail(d); $('paGo').disabled = false; return; }
      msg('paMsg', (d.correct ? 'Right' + (d.gain ? ' (+' + d.gain + ')' : '') : 'It was ' + d.answer), d.correct ? 'win' : 'lose'); A.sfx(d.correct ? 'click' : 'lose');
      A.sleep(900).then(function () {
        if (!live('pattern', tok)) return;
        if (d.over) { $('paBar').style.width = '0'; $('paSeq').innerHTML = '&nbsp;'; A.finish('pattern', $('paGo'), 'paMsg', 'You got ' + d.score + ' of 12.', d); A.sfx(d.score >= 8 ? 'win' : 'click'); return; }
        paShow(d, tok);
      });
    });
  }
  $('paIn').onkeydown = function (e) { if (e.key !== 'Enter' || !this.value.trim()) return; paSend({ v: this.value }, run.token); };
  $('paGo').onclick = function () { var b = this; stopAll(); paBusy = false; A.begin('pattern', b).then(function (d) { if (d) { b.textContent = 'Playing'; paShow(d, d.tok); } }); };

  // ---------------------------------------------------------------- scramble
  var scBusy = false;
  function scOver(d) { clearInterval(timers.wsBar); $('wsBar').style.width = '0'; $('wsIn').disabled = true; $('wsSkip').disabled = true; $('wsWord').innerHTML = '&nbsp;'; A.finish('scramble', $('wsGo'), 'wsMsg', 'Time. ' + d.score + ' words.', d); A.sfx(d.score >= 8 ? 'win' : 'click'); }
  function scSend(body, tok) {
    if (scBusy || !live('scramble', tok)) return; scBusy = true;
    post('step', body).then(function (d) {
      scBusy = false; if (!live('scramble', tok)) return; A.applyProfile(d); A.paintStats('scramble', d);
      if (d.error) { A.fail(d); return; } if (d.over) { scOver(d); return; }
      if (d.tooFast) return; if (d.noSkips) { msg('wsMsg', 'No skips left', 'lose'); $('wsSkip').disabled = true; return; }
      if (d.s) { $('wsWord').textContent = d.s; $('wsIn').value = ''; }
      if (d.skipped) { msg('wsMsg', 'Skipped (' + (5 - d.skips) + ' left)'); if (d.skips >= 5) $('wsSkip').disabled = true; }
      else if (d.correct) { msg('wsMsg', 'Right' + (d.gain ? ' (+' + d.gain + ')' : ''), 'win'); A.sfx('click'); }
      else { msg('wsMsg', 'Not it', 'lose'); $('wsIn').select(); }
    });
  }
  $('wsIn').onkeydown = function (e) { if (e.key === 'Enter' && this.value.trim()) scSend({ w: this.value }, run.token); };
  $('wsSkip').onclick = function () { scSend({ skip: true }, run.token); };
  $('wsGo').onclick = function () {
    var b = this; stopAll(); scBusy = false;
    A.begin('scramble', b).then(function (d) {
      if (!d) return; var tok = d.tok; b.textContent = 'Playing'; $('wsWord').textContent = d.s; var i = $('wsIn'); i.value = ''; i.disabled = false; i.focus(); $('wsSkip').disabled = false; msg('wsMsg', '');
      bar('wsBar', 'scramble', tok, d.ms, function () { post('step', { finish: true }).then(function (r) { if (live('scramble', tok)) { A.applyProfile(r); scOver(r); } }); });
    });
  };

  var NEW = { trivia: 'trGo', colorclash: 'ccGo', pattern: 'paGo', scramble: 'wsGo' }, MSG = { trivia: 'trMsg', colorclash: 'ccMsg', pattern: 'paMsg', scramble: 'wsMsg' };
  var prevOpen = SC.games.open;
  SC.games.open = function (kind) {
    if (prevOpen) prevOpen(kind);
    if (!NEW[kind]) return; run.token++; stopAll(); trBusy = ccBusy = paBusy = scBusy = false;
    var go = $(NEW[kind]); go.disabled = false; go.textContent = 'Start'; msg(MSG[kind], '');
    if (kind === 'trivia') { $('trOpts').innerHTML = ''; $('trQ').innerHTML = '&nbsp;'; $('trBar').style.width = '100%'; }
    if (kind === 'colorclash') { $('ccWord').innerHTML = '&nbsp;'; $('ccBar').style.width = '100%'; Array.prototype.forEach.call(ccBtns.children, function (x) { x.disabled = true; }); }
    if (kind === 'pattern') { $('paSeq').innerHTML = '&nbsp;'; $('paIn').disabled = true; $('paBar').style.width = '100%'; }
    if (kind === 'scramble') { $('wsWord').innerHTML = '&nbsp;'; $('wsIn').disabled = true; $('wsSkip').disabled = true; $('wsBar').style.width = '100%'; }
    A.refresh(kind);
  };
})();
