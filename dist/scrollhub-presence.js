/* ScrollHub presence + admin enforcement (runs on every visitor's page). */
(function () {
  if (location.pathname.indexOf('/admin') === 0) return; // admin page is exempt

  var CID_KEY = 'scrollhub_cid', NICK_KEY = 'scrollhub_nick', BC_KEY = 'scrollhub_bc_seen';
  var cid = '';
  try { cid = localStorage.getItem(CID_KEY) || ''; } catch (e) {}
  if (!cid) {
    cid = (self.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    try { localStorage.setItem(CID_KEY, cid); } catch (e) {}
  }
  var nickname = '';
  try { nickname = localStorage.getItem(NICK_KEY) || ''; } catch (e) {}

  function el(tag, css, html) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (html != null) e.innerHTML = html;
    return e;
  }
  var OVERLAY = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;' +
    'background:#020810;color:#fff;font-family:"Segoe UI",system-ui,sans-serif;text-align:center;padding:24px;';

  function fullOverlay(title, msg, accent) {
    var o = el('div', OVERLAY);
    o.innerHTML = '<div style="max-width:440px"><div style="font-size:2rem;font-weight:800;margin-bottom:12px;color:' +
      (accent || '#6ea8fe') + '">' + title + '</div><div style="font-size:1rem;line-height:1.5;color:#c3cad8">' +
      msg + '</div></div>';
    return o;
  }

  // ---- nickname gate ----
  function askNickname(done) {
    var o = el('div', OVERLAY);
    var box = el('div', 'max-width:380px;width:100%;background:#0b1626;border:1px solid #1f3454;border-radius:16px;padding:28px 24px;');
    box.innerHTML =
      '<div style="font-size:1.4rem;font-weight:800;margin-bottom:6px">Welcome to ScrollHub</div>' +
      '<div style="font-size:.9rem;color:#9fb0c8;margin-bottom:18px">Pick a nickname to continue.</div>';
    var input = el('input');
    input.type = 'text'; input.maxLength = 24; input.placeholder = 'Your nickname';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:12px 14px;border-radius:10px;border:1px solid #27406a;background:#0a1322;color:#fff;font-size:1rem;outline:none;margin-bottom:14px';
    var btn = el('button', 'width:100%;padding:12px;border:none;border-radius:10px;background:#2f68d8;color:#fff;font-size:.95rem;font-weight:600;cursor:pointer', 'Continue');
    function submit() {
      var v = (input.value || '').trim().slice(0, 24);
      if (!v) { input.style.borderColor = '#e06a74'; input.focus(); return; }
      nickname = v;
      try { localStorage.setItem(NICK_KEY, v); } catch (e) {}
      document.body.removeChild(o);
      done();
    }
    btn.onclick = submit;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
    box.appendChild(input); box.appendChild(btn); o.appendChild(box);
    document.body.appendChild(o); setTimeout(function () { input.focus(); }, 50);
  }

  // ---- banners / popups ----
  var annBanner = null;
  function showAnnouncement(text) {
    if (!text) { if (annBanner) { annBanner.remove(); annBanner = null; } return; }
    if (annBanner && annBanner.dataset.text === text) return;
    if (annBanner) annBanner.remove();
    annBanner = el('div', 'position:fixed;top:0;left:0;right:0;z-index:2147483000;background:#2f68d8;color:#fff;' +
      'font-family:system-ui,sans-serif;font-size:.9rem;padding:10px 40px 10px 16px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.3)');
    annBanner.dataset.text = text;
    annBanner.textContent = text;
    var x = el('span', 'position:absolute;right:12px;top:50%;transform:translateY(-50%);cursor:pointer;font-weight:700', '×');
    x.onclick = function () { if (annBanner) { annBanner.remove(); annBanner = null; } };
    annBanner.appendChild(x);
    document.body.appendChild(annBanner);
  }
  function showPopup(text) {
    var o = el('div', OVERLAY.replace('#020810', 'rgba(2,8,16,.78)'));
    var box = el('div', 'max-width:400px;background:#0b1626;border:1px solid #1f3454;border-radius:16px;padding:26px 24px');
    box.innerHTML = '<div style="font-size:1.1rem;font-weight:700;margin-bottom:14px">' + text + '</div>';
    var btn = el('button', 'padding:10px 22px;border:none;border-radius:10px;background:#2f68d8;color:#fff;font-weight:600;cursor:pointer', 'OK');
    btn.onclick = function () { document.body.removeChild(o); };
    box.appendChild(btn); o.appendChild(box); document.body.appendChild(o);
  }

  // ---- fun effects ----
  function ensureFx() {
    if (document.getElementById('sh-fx')) return;
    var st = el('style'); st.id = 'sh-fx';
    st.textContent =
      '@keyframes sh-shake{0%,100%{transform:translate(0,0)}10%{transform:translate(-8px,4px)}20%{transform:translate(8px,-4px)}' +
      '30%{transform:translate(-8px,-4px)}40%{transform:translate(8px,4px)}50%{transform:translate(-6px,6px)}' +
      '60%{transform:translate(6px,-6px)}70%{transform:translate(-6px,-2px)}80%{transform:translate(6px,2px)}90%{transform:translate(-4px,4px)}}' +
      '.sh-shaking{animation:sh-shake .5s ease-in-out 6}' +
      '@keyframes sh-flash{0%{background:#ff3b3b}25%{background:#3bdcff}50%{background:#b53bff}75%{background:#3bff6a}100%{background:#ffd23b}}';
    document.head.appendChild(st);
  }
  function shakeScreen() {
    ensureFx();
    var t = document.body; t.classList.remove('sh-shaking'); void t.offsetWidth; t.classList.add('sh-shaking');
    setTimeout(function () { t.classList.remove('sh-shaking'); }, 3200);
  }
  function flashScreen() {
    ensureFx();
    var f = el('div', 'position:fixed;inset:0;z-index:2147483600;pointer-events:none;opacity:.85;animation:sh-flash .18s linear 10');
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 1900);
  }
  function showToast(text) {
    var t = el('div', 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483600;background:#0b1626;' +
      'border:1px solid #27406a;color:#fff;font-family:system-ui,sans-serif;font-size:.92rem;padding:12px 18px;border-radius:12px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,.45);max-width:80vw;text-align:center');
    t.textContent = text; document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 400); }, 5000);
  }

  var frozenOverlay = null;
  function setFrozen(on) {
    if (on) {
      if (!frozenOverlay) {
        frozenOverlay = fullOverlay('❄ Frozen', 'An administrator has frozen your screen. Please wait…', '#6ea8fe');
        frozenOverlay.style.cursor = 'not-allowed';
        document.body.appendChild(frozenOverlay);
      }
    } else if (frozenOverlay) { frozenOverlay.remove(); frozenOverlay = null; }
  }

  // ---- rickroll: play in-page via YouTube embed (no redirect) ----
  function playRickroll() {
    var old = document.getElementById('sh-rr'); if (old) old.remove();
    var wrap = el('div', 'position:fixed;right:16px;bottom:16px;z-index:2147483600;width:260px;background:#0b1626;border:1px solid #27406a;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.6)');
    wrap.id = 'sh-rr';
    var f = el('iframe', 'width:260px;height:150px;border:0;display:block');
    f.allow = 'autoplay; encrypted-media';
    f.src = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0';
    var bar = el('div', 'display:flex;justify-content:space-between;align-items:center;padding:6px 10px;color:#cfe;font:600 12px system-ui', '🎵 Now playing');
    var x = el('span', 'cursor:pointer;font-weight:800;color:#9fb0c8', '×');
    x.onclick = function () { wrap.remove(); };
    bar.appendChild(x);
    wrap.appendChild(f); wrap.appendChild(bar);
    document.body.appendChild(wrap);
  }

  // ---- jumpscare: original horrifying animatronic + synth scream ----
  var FACE_SVG = '<svg viewBox="0 0 400 440" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">' +
    '<defs><radialGradient id="g" cx="50%" cy="45%" r="60%"><stop offset="0%" stop-color="#3a0f0a"/><stop offset="100%" stop-color="#0a0302"/></radialGradient>' +
    '<radialGradient id="eye" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff6c2"/><stop offset="45%" stop-color="#ffd21a"/><stop offset="100%" stop-color="#b35a00"/></radialGradient></defs>' +
    '<rect width="400" height="440" fill="url(#g)"/>' +
    '<polygon points="60,30 150,120 90,150" fill="#20110c"/><polygon points="340,30 250,120 310,150" fill="#20110c"/>' +
    '<polygon points="200,60 90,150 70,330 200,430 330,330 310,150" fill="#4a150d"/>' +
    '<path d="M200,70 L186,250 L200,420" stroke="#1c0804" stroke-width="2" fill="none" opacity=".7"/>' +
    '<path d="M120,160 L150,210 M280,160 L250,210" stroke="#1c0804" stroke-width="3" opacity=".6"/>' +
    '<ellipse cx="138" cy="190" rx="46" ry="36" fill="#000"/><circle cx="138" cy="190" r="30" fill="url(#eye)"/><ellipse cx="138" cy="190" rx="6" ry="24" fill="#000"/>' +
    '<ellipse cx="262" cy="190" rx="46" ry="36" fill="#000"/><circle cx="262" cy="190" r="30" fill="url(#eye)"/><ellipse cx="262" cy="190" rx="6" ry="24" fill="#000"/>' +
    '<polygon points="200,240 165,300 235,300" fill="#30100a"/><ellipse cx="200" cy="250" rx="20" ry="14" fill="#060101"/>' +
    '<path d="M95,300 Q200,340 305,300 L285,405 Q200,445 115,405 Z" fill="#120302"/>' +
    // upper teeth
    '<g fill="#efe7cf">' +
    '<polygon points="110,306 134,306 122,352"/><polygon points="138,308 162,308 150,360"/><polygon points="166,310 190,310 178,364"/>' +
    '<polygon points="194,310 218,310 206,364"/><polygon points="222,308 246,308 234,360"/><polygon points="250,306 274,306 262,352"/><polygon points="278,304 300,304 289,346"/>' +
    // lower teeth
    '<polygon points="122,404 146,404 134,360"/><polygon points="150,408 174,408 162,366"/><polygon points="178,410 202,410 190,368"/>' +
    '<polygon points="206,410 230,410 218,368"/><polygon points="234,408 258,408 246,366"/><polygon points="262,404 286,404 274,360"/></g>' +
    '<path d="M70,330 L50,360 M330,330 L350,360" stroke="#1c0804" stroke-width="4" opacity=".6"/>' +
    '</svg>';

  function scream() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var ctx = new AC(); if (ctx.state === 'suspended') ctx.resume();
      var t0 = ctx.currentTime, dur = 1.7;
      var master = ctx.createGain(); master.gain.setValueAtTime(0.95, t0);
      master.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); master.connect(ctx.destination);
      // distorted noise
      var buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      var noise = ctx.createBufferSource(); noise.buffer = buf;
      var ws = ctx.createWaveShaper(), cv = new Float32Array(1024);
      for (var j = 0; j < 1024; j++) { var x = j / 512 - 1; cv[j] = Math.tanh(x * 9); }
      ws.curve = cv; var ng = ctx.createGain(); ng.gain.value = 0.55;
      noise.connect(ng); ng.connect(ws); ws.connect(master);
      // descending screech
      var o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(1300, t0); o1.frequency.exponentialRampToValueAtTime(140, t0 + dur);
      var g1 = ctx.createGain(); g1.gain.value = 0.32; o1.connect(g1); g1.connect(master);
      var o2 = ctx.createOscillator(); o2.type = 'square';
      o2.frequency.setValueAtTime(2100, t0); o2.frequency.exponentialRampToValueAtTime(520, t0 + dur);
      var g2 = ctx.createGain(); g2.gain.value = 0.14; o2.connect(g2); g2.connect(master);
      noise.start(t0); o1.start(t0); o2.start(t0);
      noise.stop(t0 + dur); o1.stop(t0 + dur); o2.stop(t0 + dur);
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, (dur + 0.4) * 1000);
    } catch (e) {}
  }

  function jumpscare() {
    var o = el('div', 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden');
    var face = el('div', 'width:min(96vw,96vh);height:min(96vw,96vh);transform:scale(.15);will-change:transform');
    face.innerHTML = FACE_SVG;
    o.appendChild(face); document.body.appendChild(o);
    scream();
    requestAnimationFrame(function () { face.style.transition = 'transform .1s steps(2)'; face.style.transform = 'scale(1.25)'; });
    var n = 0, iv = setInterval(function () {
      o.style.background = (n++ % 2) ? '#000' : '#300';
      face.style.transform = 'scale(' + (1.12 + Math.random() * 0.3) + ') translate(' + (Math.random() * 36 - 18) + 'px,' + (Math.random() * 36 - 18) + 'px) rotate(' + (Math.random() * 8 - 4) + 'deg)';
    }, 45);
    setTimeout(function () {
      clearInterval(iv); o.style.transition = 'opacity .5s'; o.style.opacity = '0';
      setTimeout(function () { try { o.remove(); } catch (e) {} }, 520);
    }, 2600);
  }

  function runCommand(c) {
    if (!c || !c.type) return;
    if (c.type === 'popup') showPopup(c.text || '');
    else if (c.type === 'message') showToast(c.text || '');
    else if (c.type === 'shake') shakeScreen();
    else if (c.type === 'flash') flashScreen();
    else if (c.type === 'jumpscare') jumpscare();
    else if (c.type === 'tabtitle') { try { document.title = c.title || c.text || document.title; } catch (e) {} }
    else if (c.type === 'redirect') { if (c.url) { try { location.href = c.url; } catch (e) {} } }
    else if (c.type === 'rickroll') playRickroll();
  }

  var stopped = false, maintOverlay = null;
  function apply(state) {
    if (stopped) return;
    if (state.banned) {
      stopped = true;
      var why = state.reason ? ('Reason: ' + state.reason) : 'You have been banned by an administrator.';
      document.body.appendChild(fullOverlay('Access blocked', why, '#e06a74'));
      return;
    }
    if (state.kick) {
      stopped = true;
      document.body.appendChild(fullOverlay('Kicked', state.kick.message || 'You have been removed.', '#e0a86a'));
      setTimeout(function () { try { location.href = 'about:blank'; } catch (e) {} }, 4000);
      return;
    }
    if (state.redirect) {
      try {
        var here = location.href;
        if (here.indexOf(state.redirect) !== 0) { location.href = state.redirect; return; }
      } catch (e) {}
    }
    if (state.maintenance) {
      if (!maintOverlay) {
        maintOverlay = fullOverlay('Under maintenance', 'ScrollHub is temporarily closed. Check back soon.', '#6ea8fe');
        document.body.appendChild(maintOverlay);
      }
    } else if (maintOverlay) { maintOverlay.remove(); maintOverlay = null; }
    setFrozen(!!state.frozen);
    showAnnouncement(state.announcement);
    if (state.broadcast && state.broadcast.ts) {
      var seen = '';
      try { seen = localStorage.getItem(BC_KEY) || ''; } catch (e) {}
      if (String(state.broadcast.ts) !== seen) {
        try { localStorage.setItem(BC_KEY, String(state.broadcast.ts)); } catch (e) {}
        showPopup(state.broadcast.text);
      }
    }
    if (Array.isArray(state.commands)) state.commands.forEach(runCommand);
  }

  function beat() {
    if (stopped) return;
    fetch('/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cid, nickname: nickname || 'Guest' }),
      keepalive: true,
    }).then(function (r) { return r.json(); }).then(apply).catch(function () {});
  }

  function start() { beat(); setInterval(beat, 12000); }
  function boot() { if (nickname) start(); else askNickname(start); }
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
