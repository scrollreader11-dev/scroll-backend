/* ScrollHub game loader: full-screen animated loading screen shown inside the
 * game wrapper pages (iframe.html / extframe.html) while a game loads.
 * Usage: include this script, then call SHLoader.done() when the game frame
 * has loaded. It finds the game's name + cover from the catalog by its url. */
(function () {
  var MIN_MS = 1600;
  // Lite visuals on iPads / slower devices (mirrors the app's lowFx()).
  var LITE = (function () {
    try {
      var o = localStorage.getItem('lowFx'); if (o === 'true') return true; if (o === 'false') return false;
      var b = localStorage.getItem('batterySaver'); if (b === 'true') return true;
    } catch (e) {}
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod|CrOS/.test(ua)) return true;
    if (/Macintosh/.test(ua) && 'ontouchend' in document) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true; } catch (e) {}
    return false;
  })();
  var started = Date.now();
  var gameUrl = new URLSearchParams(location.search).get('url') || '';

  var css = [
    '#shl{position:fixed;inset:0;z-index:10;overflow:hidden;background:#05070d;color:#fff;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;transition:opacity .55s ease}',
    '#shl.out{opacity:0;pointer-events:none}',
    '#shl .bd{position:absolute;inset:-10%;background-size:cover;background-position:center;filter:blur(60px) saturate(1.6) brightness(.55);opacity:0;transition:opacity 1s;animation:shl-zoom 14s ease-in-out infinite alternate}',
    '#shl .bd.on{opacity:.55}',
    '#shl .stage{position:absolute;inset:0;perspective:1100px;transition:transform .6s cubic-bezier(.6,0,.2,1),filter .5s}',
    '#shl.out .stage{transform:scale(1.25);filter:blur(6px)}',
    '#shl .wall{position:absolute;left:50%;top:50%;width:170vmax;height:170vmax;margin:-85vmax 0 0 -85vmax;display:flex;gap:14px;justify-content:center;transform:rotateX(32deg) rotateZ(-16deg);opacity:0;transition:opacity 1s}',
    '#shl .wall.on{opacity:1}',
    '#shl .col{display:flex;flex-direction:column;gap:14px;width:clamp(84px,7.5vw,140px);flex:none;animation:shl-up linear infinite;will-change:transform}',
    '#shl .col.dn{animation-name:shl-dn}',
    '#shl .card{position:relative;aspect-ratio:3/4;border-radius:14px;overflow:hidden;flex:none;background:linear-gradient(150deg,#1e2a4a,#0d1326 60%,#1a1238);border:1px solid rgba(255,255,255,.08);box-shadow:0 30px 60px -20px rgba(0,0,0,.8)}',
    '#shl .card span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;font-size:12px;font-weight:800;line-height:1.15;color:rgba(190,210,255,.55);overflow-wrap:anywhere}',
    '#shl .card img{position:relative;width:100%;height:100%;object-fit:cover;display:block}',
    '#shl .sweep{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 40%,rgba(120,180,255,.1) 50%,transparent 60%);background-size:250% 100%;animation:shl-sweep 4.5s ease-in-out infinite;mix-blend-mode:screen}',
    '#shl .vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 50% 46% at 50% 50%,rgba(5,7,13,.9) 0%,rgba(5,7,13,.55) 45%,rgba(5,7,13,.05) 80%),linear-gradient(to bottom,rgba(5,7,13,.85),transparent 22%,transparent 78%,rgba(5,7,13,.9))}',
    '#shl .scan{position:absolute;inset:0;pointer-events:none;opacity:.06;background:repeating-linear-gradient(to bottom,#fff 0 1px,transparent 1px 3px)}',
    '#shl .ctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;animation:shl-rise .7s cubic-bezier(.2,.9,.2,1) both;transition:transform .5s,opacity .4s}',
    '#shl.out .ctr{transform:scale(.92);opacity:0}',
    '#shl .brand{position:absolute;top:20px;left:50%;transform:translateX(-50%);font-size:15px;font-weight:800;letter-spacing:.5px;background:linear-gradient(90deg,#7c8cff,#4cc9f0,#b388ff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 12px rgba(80,160,255,.5))}',
    '#shl .feat{position:relative;width:clamp(96px,12vw,140px);aspect-ratio:3/4;margin-bottom:6px;display:none;animation:shl-float 3.2s ease-in-out infinite alternate}',
    '#shl .feat.on{display:block}',
    '#shl .feat img{position:relative;width:100%;height:100%;object-fit:cover;border-radius:18px;display:block;box-shadow:0 25px 60px -10px rgba(40,120,255,.55)}',
    '#shl .ring{position:absolute;inset:-3px;border-radius:21px;background:conic-gradient(from 0deg,#3b82f6,#22d3ee,#a855f7,#3b82f6);animation:shl-spin 3s linear infinite}',
    '#shl .ring:after{content:"";position:absolute;inset:-14px;border-radius:30px;background:inherit;filter:blur(22px);opacity:.55}',
    '#shl .eye{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.32em;color:rgba(160,200,255,.85)}',
    '#shl .dot{width:7px;height:7px;border-radius:50%;background:#22d3ee;box-shadow:0 0 10px #22d3ee;animation:shl-blink 1.1s ease-in-out infinite}',
    '#shl h1{margin:0;max-width:min(820px,92vw);font-size:clamp(30px,5.6vw,68px);font-weight:800;line-height:1.02;letter-spacing:-.035em;background:linear-gradient(90deg,#fff 0%,#9cc8ff 30%,#fff 50%,#c4a8ff 70%,#fff 100%);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:shl-text 5s linear infinite;filter:drop-shadow(0 6px 30px rgba(60,140,255,.35));overflow-wrap:anywhere}',
    '#shl .bar{position:relative;width:min(360px,78vw);height:6px;margin-top:10px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}',
    '#shl .fill{position:relative;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#3b82f6,#22d3ee,#a855f7);box-shadow:0 0 16px rgba(34,211,238,.8);transition:width .25s ease}',
    '#shl .fill:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);background-size:40% 100%;background-repeat:no-repeat;animation:shl-shine 1.2s linear infinite}',
    '#shl .meta{width:min(360px,78vw);display:flex;justify-content:space-between;font-size:12px;color:rgba(200,215,240,.7)}',
    '#shl .tip{animation:shl-tip .4s ease both}',
    '#shl .pct{font-variant-numeric:tabular-nums;font-weight:700;color:rgba(230,240,255,.9)}',
    '@keyframes shl-up{from{transform:translateY(0)}to{transform:translateY(-50%)}}',
    '@keyframes shl-dn{from{transform:translateY(-50%)}to{transform:translateY(0)}}',
    '@keyframes shl-zoom{from{transform:scale(1)}to{transform:scale(1.15)}}',
    '@keyframes shl-sweep{0%{background-position:120% 0}100%{background-position:-120% 0}}',
    '@keyframes shl-spin{to{transform:rotate(360deg)}}',
    '@keyframes shl-float{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-8px) rotate(2deg)}}',
    '@keyframes shl-blink{0%,100%{opacity:1}50%{opacity:.25}}',
    '@keyframes shl-text{to{background-position:-250% 0}}',
    '@keyframes shl-shine{from{background-position:-40% 0}to{background-position:140% 0}}',
    '@keyframes shl-tip{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
    '@keyframes shl-rise{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){#shl *{animation:none!important}}',
    '#shl.lite .stage{perspective:none}#shl.lite .wall{transform:rotate(-12deg) scale(1.05)}#shl.lite .col{animation-duration:60s!important}',
    '#shl.lite .card{box-shadow:none}#shl.lite .bd,#shl.lite .sweep,#shl.lite .scan,#shl.lite .ring:after{display:none}',
    '#shl.lite h1{animation:none;filter:none}#shl.lite .ring,#shl.lite .feat,#shl.lite .fill:after{animation:none}#shl.lite.out .stage{filter:none}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var root = document.createElement('div');
  root.id = 'shl';
  if (LITE) root.className = 'lite';
  root.innerHTML =
    '<div class="bd"></div>' +
    '<div class="stage"><div class="wall"></div></div>' +
    '<div class="sweep"></div><div class="vig"></div><div class="scan"></div>' +
    '<div class="ctr">' +
      '<div class="brand">ScrollHub</div>' +
      '<div class="feat"><div class="ring"></div><img alt=""></div>' +
      '<div class="eye"><span class="dot"></span> NOW LOADING</div>' +
      '<h1>Your game</h1>' +
      '<div class="bar"><div class="fill"></div></div>' +
      '<div class="meta"><span class="tip">Warming up the engine</span><span class="pct">0%</span></div>' +
    '</div>';
  (document.body || document.documentElement).appendChild(root);

  var $ = function (s) { return root.querySelector(s); };
  var fill = $('.fill'), pct = $('.pct'), tipEl = $('.tip');

  // Progress creeps toward 92% until the game reports loaded, then jumps to 100%.
  var prog = 0, finished = false;
  var creep = setInterval(function () {
    if (finished) return;
    prog += (92 - prog) * 0.06;
    setProg(prog);
  }, 120);
  function setProg(v) { fill.style.width = v + '%'; pct.textContent = Math.round(v) + '%'; }

  var TIPS = ['Warming up the engine', 'Loading assets', 'Tip: press F11 for fullscreen',
    'Tip: favorite a game to find it faster', 'Tip: your saves stay in this browser', 'Almost there'];
  var ti = 0;
  var tipTimer = setInterval(function () {
    ti = (ti + 1) % TIPS.length;
    var n = tipEl.cloneNode(false); n.textContent = TIPS[ti];
    tipEl.parentNode.replaceChild(n, tipEl); tipEl = n;
  }, 1700);

  function innerUrl(u) {
    try { return new URL(u, location.origin).searchParams.get('url') || ''; } catch (e) { return ''; }
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function buildWall(list) {
    var wall = $('.wall');
    var COLS = LITE ? 5 : 9, PER = LITE ? 4 : 6, src = list.slice(0, COLS * PER);
    if (!src.length) return;
    for (var c = 0; c < COLS; c++) {
      var col = el('div', 'col' + (c % 2 ? ' dn' : ''));
      col.style.animationDuration = (30 + (c * 7) % 16) + 's';
      for (var k = 0; k < 2; k++) {
        for (var i = 0; i < PER; i++) {
          var g = src[(c + i * COLS) % src.length];
          var card = el('div', 'card');
          var s = el('span'); s.textContent = g.label; card.appendChild(s);
          var img = el('img'); img.alt = ''; img.decoding = 'async'; img.src = g.imageUrl;
          img.onerror = function () { this.style.display = 'none'; };
          card.appendChild(img);
          col.appendChild(card);
        }
      }
      wall.appendChild(col);
    }
    wall.classList.add('on');
  }

  function showGame(g) {
    if (g.label) { $('h1').textContent = g.label; document.title = g.label + ' · ScrollHub'; }
    if (g.imageUrl) {
      var f = $('.feat'), im = f.querySelector('img');
      im.onload = function () { f.classList.add('on'); };
      im.src = g.imageUrl;
      var bd = $('.bd'); bd.style.backgroundImage = 'url("' + g.imageUrl.replace(/"/g, '%22') + '")'; bd.classList.add('on');
    }
  }

  function getJson(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  Promise.all([getJson('/storage/data/collection.json'), getJson('/api/games/catalog')]).then(function (res) {
    var games = (res[0] && Array.isArray(res[0].games)) ? res[0].games : [];
    var globals = (res[1] && Array.isArray(res[1].globals)) ? res[1].globals : [];
    var all = globals.concat(games).filter(function (g) { return g && g.label && g.imageUrl; });
    if (finished && root.classList.contains('out')) return;
    buildWall(games.filter(function (g) { return g && g.label && g.imageUrl; }));
    if (gameUrl) {
      for (var i = 0; i < all.length; i++) {
        if (innerUrl(all[i].url) === gameUrl) { showGame(all[i]); break; }
      }
    }
  });

  var hidden = false;
  function hide() {
    if (hidden) return; hidden = true;
    finished = true; setProg(100);
    var wait = Math.max(350, MIN_MS - (Date.now() - started));
    setTimeout(function () {
      root.classList.add('out');
      clearInterval(creep); clearInterval(tipTimer);
      setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 650);
    }, wait);
  }

  window.SHLoader = { done: hide, remove: function () { hidden = true; if (root.parentNode) root.parentNode.removeChild(root); } };
})();
