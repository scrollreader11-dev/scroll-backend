/* Scrolls Casino: panels for the ten newer games (Game Row).
   Every result comes from /api/casino/g/<game>/<action>; this file only draws it. */
(function () {
  var SC = window.SC, api = SC.api, fmt = SC.fmt, toast = SC.toast, state = SC.state;
  var $ = function (id) { return document.getElementById(id); };
  var SUIT = ['♠', '♥', '♦', '♣'], INFO = null, busy = {};
  function sfx(n) { try { SC.sfx && SC.sfx(n); } catch (e) {} }
  function rank(r) { return r <= 10 ? String(r) : 'JQKA'.charAt(r - 11); }
  function card(c, cls) { var d = document.createElement('div'); d.className = 'pcard' + (c && (c.s === 1 || c.s === 2) ? ' red' : '') + (cls ? ' ' + cls : ''); d.innerHTML = c ? rank(c.r) + '<br>' + SUIT[c.s] : ''; if (!c) d.classList.add('back'); return d; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function err(d) { toast(d.message || SC.errMsg(d.error)); }
  function msg(id, text, cls) { var m = $(id); if (!m) return; m.textContent = text || ''; m.className = 'msg center' + (cls ? ' ' + cls : ''); }
  function result(id, d) { msg(id, d.payout > d.bet ? 'You won ' + fmt(d.payout - d.bet) + ' Scrolls!' : d.payout === d.bet ? 'Push. Your bet is back.' : d.payout > 0 ? 'You got ' + fmt(d.payout) + ' back.' : 'You lost ' + fmt(d.bet), d.payout > d.bet ? 'win' : d.payout === d.bet ? 'push' : 'lose'); if (d.payout > d.bet) sfx('win'); }
  function betRow(g, extra) {
    return '<div class="betrow c"><label>Bet</label><input type="number" id="' + g + 'Bet" value="100" min="1" />' +
      '<button class="chip" data-mb="' + g + ':10">10</button><button class="chip" data-mb="' + g + ':100">100</button><button class="chip" data-mb="' + g + ':1000">1k</button><button class="chip" data-mb="' + g + ':half">&frac12;</button><button class="chip" data-mb="' + g + ':x2">2&times;</button><button class="chip" data-mb="' + g + ':max">Max</button>' + (extra || '') + '</div>';
  }
  function bet(g) { return Math.max(1, Math.floor(+$(g + 'Bet').value || 0)); }
  function lock(g, on) { busy[g] = on; document.querySelectorAll('[data-panel="' + g + '"] button.act').forEach(function (b) { b.disabled = on; }); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-mb]'); if (!b) return;
    var p = b.getAttribute('data-mb').split(':'), i = $(p[0] + 'Bet'), v = p[1];
    if (v === 'max') i.value = state.profile ? state.profile.coins : 0; else if (v === 'half') i.value = Math.max(1, Math.floor((+i.value || 0) / 2)); else if (v === 'x2') i.value = Math.max(1, (+i.value || 0) * 2); else i.value = v;
    sfx('click');
  });
  function post(g, act, body) { return api('g/' + g + (act ? '/' + act : ''), body || {}); }
  function section(id, html) { var host = document.querySelector('#panel .pbody'); if (!host || document.querySelector('[data-panel="' + id + '"]')) return; var s = document.createElement('section'); s.className = 'view center'; s.dataset.panel = id; s.innerHTML = html; host.appendChild(s); }
  function applyProfile(d) { if (d && d.profile) SC.setProfile(d.profile); }

  var CSS = '.mg-grid{display:grid;gap:6px;margin:10px auto;max-width:440px}.mg-n{height:42px;border-radius:11px;border:3px solid var(--line);background:#3b2f8f;color:#fff;font-weight:700;font-size:16px;cursor:pointer}.mg-n.on{background:var(--gold);color:#2a1800}.mg-n.hit{background:var(--green);color:#04210f;animation:deal .25s}.mg-n.drawn{background:#6d4cff}.mg-n.miss{outline:3px solid var(--red)}' +
    '.mg-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:10px 0}.mg-big{font-size:64px;font-weight:800;line-height:1.1;margin:10px 0;font-variant-numeric:tabular-nums}.mg-big.win{color:var(--green)}.mg-big.lose{color:var(--red)}' +
    '.mg-pay{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;font-size:13px;color:var(--mut);margin:6px 0}.mg-pay b{color:var(--gold)}.mg-pay span{background:rgba(0,0,0,.25);border-radius:9px;padding:3px 8px}.mg-pay span.hl{background:var(--gold);color:#2a1800}.mg-pay span.hl b{color:#2a1800}' +
    '.mg-opt{height:44px;padding:0 16px;border-radius:13px;border:3px solid var(--line);background:#3b2f8f;color:#fff;font-weight:700;cursor:pointer}.mg-opt.on{background:var(--gold);color:#2a1800}' +
    '.mg-scr{display:grid;grid-template-columns:repeat(3,92px);gap:8px;justify-content:center;margin:12px auto}.mg-sc{height:92px;border-radius:16px;border:4px solid var(--line);background:repeating-linear-gradient(45deg,#8d96a8,#8d96a8 8px,#a5aebf 8px,#a5aebf 16px);display:grid;place-items:center;font-size:46px;cursor:pointer;color:transparent;user-select:none}.mg-sc.rev{background:#fffaf0;color:inherit;animation:deal .25s}.mg-sc.win{background:#bff5d0}' +
    '.mg-cups{display:flex;gap:22px;justify-content:center;margin:20px 0 8px}.mg-cup{width:96px;height:112px;cursor:pointer;position:relative;transition:transform .35s}.mg-cup .c{position:absolute;inset:0;border-radius:14px 14px 40px 40px;background:linear-gradient(180deg,#e9a64b,#b8741f);border:4px solid var(--line);transition:transform .45s}.mg-cup.up .c{transform:translateY(-64px)}.mg-cup .ball{position:absolute;left:50%;bottom:6px;width:30px;height:30px;margin-left:-15px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#ff5c6c);border:3px solid var(--line);opacity:0}.mg-cup.has .ball{opacity:1}.mg-cup.pick{outline:4px solid var(--gold);outline-offset:4px;border-radius:18px}.mg-cups.shuf .mg-cup:nth-child(1){animation:mgs1 .5s 3}.mg-cups.shuf .mg-cup:nth-child(2){animation:mgs2 .5s 3}.mg-cups.shuf .mg-cup:nth-child(3){animation:mgs3 .5s 3}@keyframes mgs1{50%{transform:translateX(118px)}}@keyframes mgs2{50%{transform:translateX(-59px) translateY(-14px)}}@keyframes mgs3{50%{transform:translateX(-118px)}}' +
    '.mg-goal{position:relative;width:min(380px,100%);height:210px;margin:12px auto;border:6px solid #fff;border-bottom:0;border-radius:10px 10px 0 0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.12) 0 2px,transparent 2px 18px),repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 2px,transparent 2px 18px),#0e5434;overflow:hidden}.mg-zone{position:absolute;top:0;bottom:0;width:33.33%;cursor:pointer;background:rgba(255,255,255,.04);border:0;color:#fff;font-weight:700}.mg-zone:hover{background:rgba(255,209,102,.25)}.mg-zone.pick{background:rgba(255,209,102,.35)}.mg-keep{position:absolute;bottom:0;width:62px;height:96px;left:50%;margin-left:-31px;font-size:56px;transition:left .35s,transform .35s;text-align:center}.mg-ball{position:absolute;bottom:-4px;left:50%;margin-left:-18px;font-size:36px;transition:left .35s,bottom .35s}' +
    '.mg-dice{display:flex;gap:14px;justify-content:center;margin:14px 0}.mg-die{width:84px;height:84px;border-radius:18px;background:#fffaf0;color:#111;border:4px solid var(--line);display:grid;place-items:center;font-size:62px;line-height:1}.mg-die.roll{animation:shake .25s infinite}' +
    '.mg-hand{display:flex;gap:8px;justify-content:center;margin:10px 0}.mg-hand .pcard{width:62px;height:88px;font-size:22px;cursor:default}.mg-hand .pcard.held{outline:4px solid var(--gold);transform:translateY(-8px)}.mg-hand .pcard.sel{cursor:pointer}' +
    '.mg-hist{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:6px 0}.mg-hist .pcard{width:38px;height:54px;font-size:14px;opacity:.75}.mg-table{width:100%;max-width:340px;margin:8px auto;border-collapse:collapse;font-size:14px}.mg-table td{padding:3px 8px;border-bottom:1px solid rgba(255,255,255,.1)}.mg-table tr.hl td{background:var(--gold);color:#2a1800;font-weight:700}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  // ------------------------------------------------ KENO
  var kenoPick = [];
  function kenoPaint() {
    var g = $('knGrid'); g.innerHTML = '';
    for (var i = 1; i <= 40; i++) (function (n) { var b = document.createElement('button'); b.className = 'mg-n' + (kenoPick.indexOf(n) >= 0 ? ' on' : ''); b.textContent = n; b.dataset.n = n; b.onclick = function () { if (busy.keno) return; var k = kenoPick.indexOf(n); if (k >= 0) kenoPick.splice(k, 1); else if (kenoPick.length < 10) kenoPick.push(n); else toast('Pick up to 10'); sfx('click'); kenoPaint(); }; g.appendChild(b); })(i);
    var row = INFO && INFO.keno && INFO.keno[kenoPick.length], p = $('knPay'); p.innerHTML = '';
    if (row) row.forEach(function (m, h) { if (m) p.innerHTML += '<span data-h="' + h + '">' + h + ' hit' + (h > 1 ? 's' : '') + ' <b>' + m + '&times;</b></span>'; });
    else p.textContent = 'Pick 1 to 10 numbers to see the pay table.';
  }
  function kenoPlay() {
    if (busy.keno) return; if (!kenoPick.length) { toast('Pick some numbers first'); return; }
    lock('keno', true); msg('knMsg', '');
    post('keno', 'play', { bet: bet('keno'), picks: kenoPick }).then(function (d) {
      if (d.error) { lock('keno', false); return err(d); }
      kenoPaint(); lock('keno', true);
      var btns = {}; document.querySelectorAll('#knGrid .mg-n').forEach(function (b) { btns[b.dataset.n] = b; });
      var i = 0, hits = 0;
      (function step() {
        if (i >= d.drawn.length) { applyProfile(d); lock('keno', false); result('knMsg', d); msg('knMsg', hits + ' hit' + (hits === 1 ? '' : 's') + (d.mult ? ' (' + d.mult + '×). ' : '. ') + $('knMsg').textContent, $('knMsg').className.replace('msg center ', '')); var pr = document.querySelector('#knPay [data-h="' + hits + '"]'); if (pr) pr.classList.add('hl'); return; }
        var n = d.drawn[i++], b = btns[n], isHit = d.picks.indexOf(n) >= 0; if (isHit) hits++; b.className = 'mg-n ' + (isHit ? 'hit' : 'drawn'); sfx(isHit ? 'coins' : 'click'); setTimeout(step, 150);
      })();
    });
  }
  section('keno', '<div class="hint">Pick up to 10 numbers. Ten numbers are drawn. The more you match, the more it pays.</div><div class="mg-grid" id="knGrid" style="grid-template-columns:repeat(8,1fr)"></div><div class="mg-pay" id="knPay"></div>' + betRow('keno') +
    '<div class="mg-row"><button class="btn small dark act" id="knQuick">Quick pick 5</button><button class="btn small dark act" id="knClear">Clear</button><button class="btn gold act" id="knGo">Draw</button></div><div class="msg center" id="knMsg"></div>');

  // ------------------------------------------------ SCRATCH
  var SYM = { cherry: '🍒', lemon: '🍋', bell: '🔔', star: '⭐', gem: '💎', crown: '👑' }, scr = null;
  function scratchReveal(i) {
    if (!scr || scr.shown[i]) return; scr.shown[i] = true; var el = $('scGrid').children[i]; el.classList.add('rev'); el.textContent = SYM[scr.d.cells[i]] || '?'; sfx('pop');
    if (scr.shown.every(Boolean)) scratchEnd();
  }
  function scratchEnd() {
    if (!scr) return; var d = scr.d; scr = null; applyProfile(d); lock('scratch', false);
    if (d.sym) { document.querySelectorAll('#scGrid .mg-sc').forEach(function (el, i) { if (d.cells[i] === d.sym) el.classList.add('win'); }); }
    result('scMsg', d); $('scAll').style.display = 'none';
  }
  function scratchBuy() {
    if (busy.scratch) return; lock('scratch', true); msg('scMsg', 'Scratch the tiles. Match three to win.');
    post('scratch', 'play', { bet: bet('scratch') }).then(function (d) {
      if (d.error) { lock('scratch', false); msg('scMsg', ''); return err(d); }
      scr = { d: d, shown: new Array(9).fill(false) }; var g = $('scGrid'); g.innerHTML = '';
      for (var i = 0; i < 9; i++) (function (i) { var t = document.createElement('div'); t.className = 'mg-sc'; t.textContent = '?'; t.onclick = function () { scratchReveal(i); }; g.appendChild(t); })(i);
      $('scAll').style.display = '';
    });
  }
  section('scratch', '<div class="hint">Buy a ticket, then tap each tile to scratch it. Three matching symbols win. Crowns pay 100&times;.</div><div class="mg-scr" id="scGrid"></div>' + betRow('scratch') +
    '<div class="mg-row"><button class="btn gold act" id="scGo">Buy ticket</button><button class="btn small dark" id="scAll" style="display:none">Reveal all</button></div><div class="mg-pay"><span>🍒 <b>2&times;</b></span><span>🍋 <b>3&times;</b></span><span>🔔 <b>5&times;</b></span><span>⭐ <b>10&times;</b></span><span>💎 <b>25&times;</b></span><span>👑 <b>100&times;</b></span></div><div class="msg center" id="scMsg"></div>');

  // ------------------------------------------------ LIMBO
  function limboChance() { var t = Math.max(1.01, Math.min(1000, +$('lbTarget').value || 2)); $('lbChance').textContent = 'Win chance ' + (99 / t).toFixed(2) + '%  ·  Pays ' + t.toFixed(2) + '×'; }
  function limboPlay() {
    if (busy.limbo) return; lock('limbo', true); var big = $('lbBig'); big.className = 'mg-big'; msg('lbMsg', '');
    post('limbo', 'play', { bet: bet('limbo'), target: +$('lbTarget').value || 2 }).then(function (d) {
      if (d.error) { lock('limbo', false); return err(d); }
      var t0 = performance.now(), dur = 900;
      (function tick(now) { var k = Math.min(1, (now - t0) / dur), v = 1 + (d.result - 1) * (1 - Math.pow(1 - k, 3)); big.textContent = v.toFixed(2) + '×'; if (k < 1) requestAnimationFrame(tick); else { big.textContent = d.result.toFixed(2) + '×'; big.className = 'mg-big ' + (d.won ? 'win' : 'lose'); applyProfile(d); lock('limbo', false); result('lbMsg', d); } })(t0);
    });
  }
  section('limbo', '<div class="hint">Pick a target multiplier. If the roll lands at or above it, you win bet &times; target.</div><div class="mg-big" id="lbBig">1.00&times;</div><div class="betrow c"><label>Target</label><input type="number" id="lbTarget" value="2" min="1.01" max="1000" step="0.01" /><button class="chip" data-t="1.5">1.5&times;</button><button class="chip" data-t="2">2&times;</button><button class="chip" data-t="5">5&times;</button><button class="chip" data-t="10">10&times;</button></div><div class="hint" id="lbChance"></div>' + betRow('limbo') + '<div class="mg-row"><button class="btn gold act" id="lbGo">Roll</button></div><div class="msg center" id="lbMsg"></div>');

  // ------------------------------------------------ BACCARAT
  var bacSide = 'player';
  function bacPlay() {
    if (busy.baccarat) return; lock('baccarat', true); msg('bcMsg', '');
    post('baccarat', 'play', { bet: bet('baccarat'), side: bacSide }).then(function (d) {
      if (d.error) { lock('baccarat', false); return err(d); }
      var pe = $('bcP'), be = $('bcB'); pe.innerHTML = ''; be.innerHTML = ''; $('bcPT').textContent = ''; $('bcBT').textContent = '';
      var seq = []; d.player.forEach(function (c, i) { seq.push(['p', c, i]); }); d.banker.forEach(function (c, i) { seq.push(['b', c, i]); });
      seq.sort(function (a, b) { return (a[2] - b[2]) || (a[0] === 'p' ? -1 : 1); });
      (async function () { for (var i = 0; i < seq.length; i++) { (seq[i][0] === 'p' ? pe : be).appendChild(card(seq[i][1])); sfx('pop'); await sleep(380); }
        $('bcPT').textContent = d.pt; $('bcBT').textContent = d.bt; applyProfile(d); lock('baccarat', false);
        result('bcMsg', d); $('bcMsg').textContent = (d.winner === 'tie' ? 'Tie. ' : (d.winner === 'player' ? 'Player' : 'Banker') + ' wins. ') + $('bcMsg').textContent; })();
    });
  }
  section('baccarat', '<div class="hint">Bet on the Player, the Banker or a Tie. Closest to 9 wins. Banker pays 0.95 to 1. Tie pays 8 to 1.</div><div class="felt"><div class="hand"><div class="lbl">Player <span class="val" id="bcPT"></span></div><div class="cards" id="bcP" style="justify-content:center"></div></div><div class="hand"><div class="lbl">Banker <span class="val" id="bcBT"></span></div><div class="cards" id="bcB" style="justify-content:center"></div></div></div>' +
    '<div class="mg-row" id="bcSide"><button class="mg-opt on" data-s="player">Player</button><button class="mg-opt" data-s="banker">Banker</button><button class="mg-opt" data-s="tie">Tie</button></div>' + betRow('baccarat') + '<div class="mg-row"><button class="btn gold act" id="bcGo">Deal</button></div><div class="msg center" id="bcMsg"></div>');

  // ------------------------------------------------ SHELL GAME
  var shellPick = -1;
  function shellPlay() {
    if (busy.shell) return; if (shellPick < 0) { toast('Tap a cup first'); return; }
    lock('shell', true); msg('shMsg', ''); var cups = $('shCups'); [].forEach.call(cups.children, function (c) { c.classList.remove('up', 'has'); });
    post('shell', 'play', { bet: bet('shell'), pick: shellPick }).then(async function (d) {
      if (d.error) { lock('shell', false); return err(d); }
      cups.children[d.prize].classList.add('has'); cups.children[d.prize].classList.add('up'); await sleep(900); cups.children[d.prize].classList.remove('up');
      cups.classList.add('shuf'); sfx('click'); await sleep(1600); cups.classList.remove('shuf');
      [].forEach.call(cups.children, function (c, i) { if (i === d.prize) c.classList.add('has'); });
      [].forEach.call(cups.children, function (c) { c.classList.add('up'); }); sfx(d.won ? 'win' : 'pop');
      applyProfile(d); lock('shell', false); result('shMsg', d);
    });
  }
  section('shell', '<div class="hint">Watch the ball, then pick the cup you think hides it. A correct pick pays 2.85&times;.</div><div class="mg-cups" id="shCups"><div class="mg-cup" data-i="0"><div class="ball"></div><div class="c"></div></div><div class="mg-cup" data-i="1"><div class="ball"></div><div class="c"></div></div><div class="mg-cup" data-i="2"><div class="ball"></div><div class="c"></div></div></div>' + betRow('shell') + '<div class="mg-row"><button class="btn gold act" id="shGo">Shuffle and reveal</button></div><div class="msg center" id="shMsg"></div>');

  // ------------------------------------------------ PENALTY
  var penAim = -1;
  function penPlay() {
    if (busy.penalty) return; if (penAim < 0) { toast('Pick a corner to aim at'); return; }
    lock('penalty', true); msg('pnMsg', ''); var keep = $('pnKeep'), ball = $('pnBall'); keep.style.left = '50%'; ball.style.left = '50%'; ball.style.bottom = '-4px'; keep.textContent = '🧤'; ball.textContent = '⚽';
    post('penalty', 'play', { bet: bet('penalty'), aim: penAim }).then(async function (d) {
      if (d.error) { lock('penalty', false); return err(d); }
      var xs = ['16.6%', '50%', '83.3%']; await sleep(250);
      keep.style.left = xs[d.keeper]; ball.style.left = d.outcome === 'miss' ? xs[d.aim] : xs[d.aim]; ball.style.bottom = d.outcome === 'miss' ? '260px' : '84px'; sfx('click'); await sleep(650);
      msg('pnMsg', d.outcome === 'goal' ? 'GOAL!' : d.outcome === 'saved' ? 'Saved by the keeper.' : 'Over the bar.', d.outcome === 'goal' ? 'win' : 'lose');
      applyProfile(d); lock('penalty', false); if (d.outcome === 'goal') { sfx('win'); $('pnMsg').textContent += ' You won ' + fmt(d.win) + ' Scrolls.'; }
    });
  }
  section('penalty', '<div class="hint">Aim at a corner. Beat the keeper to score and win 1.5&times;.</div><div class="mg-goal" id="pnGoal"><button class="mg-zone" data-a="0" style="left:0">Left</button><button class="mg-zone" data-a="1" style="left:33.33%">Middle</button><button class="mg-zone" data-a="2" style="left:66.66%">Right</button><div class="mg-keep" id="pnKeep">🧤</div><div class="mg-ball" id="pnBall">⚽</div></div>' + betRow('penalty') + '<div class="mg-row"><button class="btn gold act" id="pnGo">Shoot</button></div><div class="msg center" id="pnMsg"></div>');

  // ------------------------------------------------ CASINO WAR
  function warShow(d) { var e = $('wrCards'); e.innerHTML = ''; var mk = function (lbl, c, c2) { var w = document.createElement('div'); w.className = 'hand'; w.innerHTML = '<div class="lbl">' + lbl + '</div>'; var cs = document.createElement('div'); cs.className = 'cards'; cs.style.justifyContent = 'center'; cs.appendChild(card(c)); if (c2) cs.appendChild(card(c2)); w.appendChild(cs); e.appendChild(w); }; mk('You', d.pc, d.pc2); mk('Dealer', d.dc, d.dc2); }
  function warDeal() {
    if (busy.war) return; lock('war', true); msg('wrMsg', ''); $('wrChoice').style.display = 'none';
    post('war', 'deal', { bet: bet('war') }).then(function (d) {
      if (d.error === 'in-progress') { warShow(d); $('wrChoice').style.display = ''; lock('war', true); msg('wrMsg', 'Tie! Go to war or surrender for half your bet.'); return; }
      if (d.error) { lock('war', false); return err(d); }
      warShow(d); sfx('pop');
      if (d.tie) { applyProfile(d); $('wrChoice').style.display = ''; msg('wrMsg', 'Tie! Go to war (double the bet) or surrender for half back.', 'push'); return; }
      applyProfile(d); lock('war', false); result('wrMsg', d);
    });
  }
  function warAct(a) {
    api('g/war/' + a, {}).then(function (d) {
      if (d.error) { lock('war', false); $('wrChoice').style.display = 'none'; return err(d); }
      $('wrChoice').style.display = 'none'; warShow(d); applyProfile(d); lock('war', false); result('wrMsg', d);
      if (d.war) $('wrMsg').textContent = (d.won ? 'You won the war! ' : 'You lost the war. ') + $('wrMsg').textContent;
    });
  }
  section('war', '<div class="hint">Higher card wins. On a tie you can go to war (match your bet for a second draw) or surrender for half back. Aces are high.</div><div class="felt" id="wrCards" style="min-height:150px"></div><div class="mg-row" id="wrChoice" style="display:none"><button class="btn red" id="wrWar">Go to war</button><button class="btn dark" id="wrSur">Surrender</button></div>' + betRow('war') + '<div class="mg-row"><button class="btn gold act" id="wrGo">Deal</button></div><div class="msg center" id="wrMsg"></div>');

  // ------------------------------------------------ SIC BO
  var sicBet = { type: 'big', n: 0 }, DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  function sicBuild() {
    var h = '<button class="mg-opt on" data-t="big">Big 11-17</button><button class="mg-opt" data-t="small">Small 4-10</button><button class="mg-opt" data-t="triple">Any triple 30:1</button>';
    for (var i = 1; i <= 6; i++) h += '<button class="mg-opt" data-t="single" data-n="' + i + '">' + DIE[i - 1] + '</button>';
    for (var t = 4; t <= 17; t++) h += '<button class="mg-opt" data-t="total" data-n="' + t + '">' + t + ' <small>' + ((INFO && INFO.sicTotal && INFO.sicTotal[t]) || '') + ':1</small></button>';
    $('sbOpts').innerHTML = h;
  }
  function sicPlay() {
    if (busy.sicbo) return; lock('sicbo', true); msg('sbMsg', '');
    var dice = [].slice.call($('sbDice').children); dice.forEach(function (d) { d.classList.add('roll'); });
    post('sicbo', 'play', { bet: bet('sicbo'), type: sicBet.type, n: sicBet.n }).then(async function (d) {
      if (d.error) { dice.forEach(function (x) { x.classList.remove('roll'); }); lock('sicbo', false); return err(d); }
      await sleep(800); dice.forEach(function (x, i) { x.classList.remove('roll'); x.textContent = DIE[d.dice[i] - 1]; }); sfx('pop');
      applyProfile(d); lock('sicbo', false); result('sbMsg', d); $('sbMsg').textContent = 'Total ' + d.sum + (d.triple ? ' (triple). ' : '. ') + $('sbMsg').textContent;
    });
  }
  section('sicbo', '<div class="hint">Three dice. Choose one kind of bet. Big and small lose on a triple.</div><div class="mg-dice" id="sbDice"><div class="mg-die">⚀</div><div class="mg-die">⚁</div><div class="mg-die">⚂</div></div><div class="mg-row" id="sbOpts"></div>' + betRow('sicbo') + '<div class="mg-row"><button class="btn gold act" id="sbGo">Roll</button></div><div class="msg center" id="sbMsg"></div>');

  // ------------------------------------------------ HI-LO
  var hl = null;
  function hlPaint() {
    var s = hl, c = $('hlCard'); c.innerHTML = ''; var back = $('hlHist'); if (!s) { c.appendChild(card(null)); $('hlBtns').style.display = 'none'; $('hlStart').style.display = ''; $('hlInfo').textContent = ''; return; }
    c.appendChild(card(s.card)); $('hlBtns').style.display = ''; $('hlStart').style.display = 'none';
    $('hlHi').innerHTML = s.hi ? 'Higher<br><small>' + s.hi.toFixed(2) + '&times;</small>' : 'Higher<br><small>n/a</small>'; $('hlHi').disabled = !s.hi;
    $('hlLo').innerHTML = s.lo ? 'Lower<br><small>' + s.lo.toFixed(2) + '&times;</small>' : 'Lower<br><small>n/a</small>'; $('hlLo').disabled = !s.lo;
    $('hlCash').disabled = s.steps < 1; $('hlCash').innerHTML = 'Cash out ' + fmt(Math.floor(s.bet * s.mult));
    $('hlInfo').textContent = 'Streak ' + s.steps + '  ·  Multiplier ' + s.mult.toFixed(2) + '×  ·  Ties lose';
  }
  function hlGuess(dir) {
    if (busy.hilo) return; lock('hilo', true);
    post('hilo', 'guess', { dir: dir }).then(function (d) {
      lock('hilo', false); if (d.error && d.error !== 'impossible') { err(d); return; } if (d.error) return;
      if (d.prev) { var h = card(d.prev); $('hlHist').appendChild(h); }
      if (!d.won) { hl = null; hlPaint(); $('hlCard').innerHTML = ''; $('hlCard').appendChild(card(d.next)); applyProfile(d); result('hlMsg', d); sfx('lose'); $('hlStart').style.display = ''; return; }
      sfx('coins'); if (d.maxed) { hl = null; hlPaint(); applyProfile(d); result('hlMsg', d); return; } hl = d; hlPaint(); msg('hlMsg', 'Correct!', 'win');
    });
  }
  function hlRestore() { post('hilo', 'state').then(function (d) { if (d && d.active) { hl = d; $('hlHist').innerHTML = ''; hlPaint(); } else { hl = null; hlPaint(); } }); }
  section('hilo', '<div class="hint">Will the next card be higher or lower? Each right guess raises your multiplier. Cash out any time after your first guess.</div><div class="felt"><div class="cards" id="hlCard" style="justify-content:center"></div></div><div class="mg-hist" id="hlHist"></div><div class="hint" id="hlInfo"></div><div class="mg-row" id="hlBtns" style="display:none"><button class="btn green" id="hlHi">Higher</button><button class="btn red" id="hlLo">Lower</button><button class="btn gold" id="hlCash">Cash out</button></div>' + betRow('hilo') + '<div class="mg-row"><button class="btn gold act" id="hlStart">Start</button></div><div class="msg center" id="hlMsg"></div>');

  // ------------------------------------------------ VIDEO POKER
  var pk = null;
  function pkPaint(final) {
    var h = $('pkHand'); h.innerHTML = '';
    if (!pk) { for (var i = 0; i < 5; i++) h.appendChild(card(null)); return; }
    pk.hand.forEach(function (c, i) { var e = card(c, final ? '' : 'sel'); if (pk.held[i]) e.classList.add('held'); if (!final) e.onclick = function () { pk.held[i] = !pk.held[i]; sfx('click'); pkPaint(false); }; h.appendChild(e); });
  }
  function pkTable(hl) { var t = $('pkPay'); if (!INFO) return; t.innerHTML = INFO.poker.map(function (r) { return '<tr' + (r[0] === hl ? ' class="hl"' : '') + '><td>' + r[0] + '</td><td style="text-align:right">' + r[1] + '&times;</td></tr>'; }).join(''); }
  function pkDeal() {
    if (busy.poker) return; lock('poker', true); msg('pkMsg', '');
    post('poker', 'deal', { bet: bet('poker') }).then(function (d) {
      if (d.error && d.error !== 'in-progress') { lock('poker', false); return err(d); }
      pk = { hand: d.hand, held: [false, false, false, false, false], bet: d.bet }; pkPaint(false); pkTable(d.hint || ''); $('pkDeal').style.display = 'none'; $('pkDraw').style.display = ''; lock('poker', false); applyProfile(d); sfx('pop'); msg('pkMsg', 'Tap the cards you want to keep, then draw.');
    });
  }
  function pkDraw() {
    if (!pk || busy.poker) return; lock('poker', true);
    post('poker', 'draw', { holds: pk.held }).then(function (d) {
      lock('poker', false); if (d.error) return err(d);
      pk = { hand: d.hand, held: d.held, bet: d.bet }; pkPaint(true); pkTable(d.name); pk = null; $('pkDeal').style.display = ''; $('pkDraw').style.display = 'none'; applyProfile(d);
      result('pkMsg', d); if (d.name) $('pkMsg').textContent = d.name + '! ' + $('pkMsg').textContent;
    });
  }
  function pkRestore() { post('poker', 'state').then(function (d) { if (d && d.active) { pk = { hand: d.hand, held: [false, false, false, false, false], bet: d.bet }; pkPaint(false); $('pkDeal').style.display = 'none'; $('pkDraw').style.display = ''; } else { pk = null; pkPaint(); $('pkDeal').style.display = ''; $('pkDraw').style.display = 'none'; } pkTable(''); }); }
  section('poker', '<div class="hint">Jacks or Better. Keep the cards you like, draw once, and the best hand pays.</div><div class="mg-hand" id="pkHand"></div><table class="mg-table" id="pkPay"></table>' + betRow('poker') + '<div class="mg-row"><button class="btn gold act" id="pkDeal">Deal</button><button class="btn green" id="pkDraw" style="display:none">Draw</button></div><div class="msg center" id="pkMsg"></div>');

  // ------------------------------------------------ wiring
  function wire() {
    if (wire.done) return; wire.done = true;
    $('knQuick').onclick = function () { if (busy.keno) return; kenoPick = []; while (kenoPick.length < 5) { var n = 1 + Math.floor(Math.random() * 40); if (kenoPick.indexOf(n) < 0) kenoPick.push(n); } kenoPaint(); };
    $('knClear').onclick = function () { if (busy.keno) return; kenoPick = []; kenoPaint(); $('knMsg').textContent = ''; };
    $('knGo').onclick = kenoPlay; $('scGo').onclick = scratchBuy; $('scAll').onclick = function () { for (var i = 0; i < 9; i++) scratchReveal(i); };
    $('lbGo').onclick = limboPlay; $('lbTarget').oninput = limboChance; document.querySelectorAll('[data-t]').forEach(function (b) { if (b.closest('[data-panel="limbo"]')) b.onclick = function () { $('lbTarget').value = b.dataset.t; limboChance(); }; });
    $('bcGo').onclick = bacPlay; $('bcSide').onclick = function (e) { var b = e.target.closest('[data-s]'); if (!b) return; bacSide = b.dataset.s; [].forEach.call($('bcSide').children, function (x) { x.classList.toggle('on', x === b); }); };
    $('shCups').onclick = function (e) { var c = e.target.closest('.mg-cup'); if (!c || busy.shell) return; shellPick = +c.dataset.i; [].forEach.call($('shCups').children, function (x) { x.classList.toggle('pick', x === c); }); sfx('click'); }; $('shGo').onclick = shellPlay;
    $('pnGoal').onclick = function (e) { var z = e.target.closest('.mg-zone'); if (!z || busy.penalty) return; penAim = +z.dataset.a; [].forEach.call($('pnGoal').querySelectorAll('.mg-zone'), function (x) { x.classList.toggle('pick', x === z); }); sfx('click'); }; $('pnGo').onclick = penPlay;
    $('wrGo').onclick = warDeal; $('wrWar').onclick = function () { warAct('go'); }; $('wrSur').onclick = function () { warAct('surrender'); };
    $('sbOpts').onclick = function (e) { var b = e.target.closest('.mg-opt'); if (!b || busy.sicbo) return; sicBet = { type: b.dataset.t, n: +b.dataset.n || 0 }; [].forEach.call($('sbOpts').children, function (x) { x.classList.toggle('on', x === b); }); sfx('click'); }; $('sbGo').onclick = sicPlay;
    $('hlStart').onclick = function () { if (busy.hilo) return; lock('hilo', true); msg('hlMsg', ''); post('hilo', 'start', { bet: bet('hilo') }).then(function (d) { lock('hilo', false); if (d.error && d.error !== 'in-progress') return err(d); hl = d; $('hlHist').innerHTML = ''; hlPaint(); applyProfile(d); sfx('pop'); }); };
    $('hlHi').onclick = function () { hlGuess('hi'); }; $('hlLo').onclick = function () { hlGuess('lo'); };
    $('hlCash').onclick = function () { if (busy.hilo) return; lock('hilo', true); post('hilo', 'cash').then(function (d) { lock('hilo', false); if (d.error) return err(d); hl = null; hlPaint(); applyProfile(d); result('hlMsg', d); sfx('win'); }); };
    $('pkDeal').onclick = pkDeal; $('pkDraw').onclick = pkDraw;
  }
  var OPEN = {
    keno: function () { kenoPaint(); }, scratch: function () {}, limbo: function () { limboChance(); }, baccarat: function () {}, shell: function () {}, penalty: function () {},
    war: function () { post('war', 'state').then(function (d) { if (d && d.active) { warShow({ pc: d.pc, dc: d.dc }); $('wrChoice').style.display = ''; lock('war', true); msg('wrMsg', 'Tie! Go to war or surrender for half your bet.'); } }); },
    sicbo: function () { sicBuild(); }, hilo: hlRestore, poker: pkRestore,
  };
  function ready() { wire(); }
  var prevOpen = SC.games && SC.games.open;
  SC.games.open = function (kind) {
    if (prevOpen) prevOpen(kind);
    if (!OPEN[kind]) return; ready();
    if (INFO) { OPEN[kind](); return; }
    api('g/info').then(function (d) { INFO = d || {}; OPEN[kind](); });
  };
})();
