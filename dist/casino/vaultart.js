/* Scrolls Casino: art for the bartender's service and for the Owner Vault.
   - A.barKeeper / A.barGlass: the bartender walks to you, shakes a drink, pours it and slides it down the bar.
   - The Owner Vault: obsidian floor and crimson walls, the animated grate, the Ban Hammer, the Mod Menu desk,
     the Rig Console treasury, the podium, throne, braziers and banners.
   - A.playerProps: the drink in your hand, the owner's hammer, the ice block when frozen.
   - SC.vfx (world effects: lightning, shockwave, warp, ice) and SC.gfx (screen effects: party, fireworks, storm, disco, snow).
   world.js owns the state (SC.bar.jobs, SC.vault.gate) and the network messages; this file only draws. */
(function () {
  var SC = window.SC = window.SC || {}, A = SC.art; if (!A || !A.obj) return;
  var O = A.obj, OL = A.OL || '#120e2e', rr = A.rr, ell = A.ell, circ = A.circ, shade = A.shade, shadow = A.shadow, TAU = Math.PI * 2;
  function fs(c, fill, stroke, lw) { c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 3; c.stroke(); } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(p) { return 1 - Math.pow(1 - clamp(p, 0, 1), 3); }
  function glow(c, x, y, r, col, a) {   // soft additive light
    c.save(); c.globalCompositeOperation = 'lighter'; var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
  }

  SC.vault = SC.vault || { gate: { open: 0 }, own: false };
  SC.bar = SC.bar || { jobs: [], say: null };
  // Drink names and colours, in the same order as the server's DRINKS list.
  var DRINK = [['#4a2410', 'Fizzy Cola', '🥤'], ['#ff9f1c', 'Juice Box', '🧃'], ['#ff4d6d', 'Tropical Punch', '🍹'], ['#7a4a2a', 'Hot Cocoa', '☕'], ['#f6efe0', 'Milkshake', '🥛'], ['#c89b6a', 'Bubble Tea', '🧋']];
  SC.bar.drinks = DRINK;

  // ================================================================ floor and walls
  var _floor = A.floorTile;
  A.floorTile = function (c, type, x, y, S, v) {
    if (type !== 'o') return _floor(c, type, x, y, S, v);
    var u = S / 48; c.save(); c.translate(x, y); c.scale(u, u);
    c.fillStyle = '#150a14'; c.fillRect(0, 0, 48, 48);
    c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(2, 2, 21, 21); c.fillRect(25, 25, 21, 21);
    c.strokeStyle = 'rgba(255,209,102,.38)'; c.lineWidth = 1.5; c.strokeRect(1, 1, 46, 46);
    c.strokeStyle = 'rgba(255,59,92,.16)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 48); c.lineTo(48, 0); c.stroke();
    c.fillStyle = 'rgba(255,209,102,.6)'; c.beginPath(); c.arc(24, 24, 1.8, 0, TAU); c.fill();
    c.restore();
  };
  var _wall = A.wallTile;
  A.wallTile = function (c, x, y, S, face, zone, edges) {
    if (!face || zone !== 'o') return _wall(c, x, y, S, face, zone, edges);
    var u = S / 48; c.save(); c.translate(x, y); c.scale(u, u);
    var g = c.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, '#5a1428'); g.addColorStop(1, '#2a0914'); c.fillStyle = g; c.fillRect(0, 0, 48, 48);
    c.fillStyle = 'rgba(255,209,102,.10)'; for (var i = 6; i < 48; i += 12) c.fillRect(i, 8, 2, 26);
    c.fillStyle = '#1a060d'; c.fillRect(0, 36, 48, 12); c.fillStyle = '#d4a63a'; c.fillRect(0, 35, 48, 2.5);
    c.fillStyle = '#1d0710'; c.fillRect(0, 0, 48, 7); c.fillStyle = 'rgba(255,59,92,.35)'; c.fillRect(0, 6, 48, 1.5);
    c.restore();
  };

  // ================================================================ bartender
  function glass(c, x, y, fill, col, kind) {   // a tumbler standing on the bar top; y is its base
    c.save();
    c.fillStyle = 'rgba(10,6,30,.35)'; ell(c, x, y + 1, 9, 3); c.fill();
    c.beginPath(); c.moveTo(x - 7, y - 24); c.lineTo(x + 7, y - 24); c.lineTo(x + 5, y); c.lineTo(x - 5, y); c.closePath();
    c.save(); c.clip();
    c.fillStyle = 'rgba(210,240,255,.28)'; c.fillRect(x - 8, y - 25, 16, 26);
    if (fill > 0) { c.fillStyle = col; c.globalAlpha = 0.92; c.fillRect(x - 8, y - 24 * fill, 16, 24 * fill + 1); c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 8, y - 24 * fill, 16, 2); }
    c.restore();
    c.beginPath(); c.moveTo(x - 7, y - 24); c.lineTo(x + 7, y - 24); c.lineTo(x + 5, y); c.lineTo(x - 5, y); c.closePath(); c.strokeStyle = OL; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(x - 5, y - 21, 2, 15);
    if (fill > 0.85 && kind !== 4) { c.fillStyle = 'rgba(255,255,255,.55)'; rr(c, x - 3, y - 24 * fill - 3, 6, 6, 1.5); c.fill(); }
    if (fill > 0.8 && (kind === 1 || kind === 2 || kind === 5)) { c.strokeStyle = kind === 2 ? '#ff6ec7' : '#ffffff'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 2, y - 8); c.lineTo(x + 6, y - 34); c.stroke(); }
    c.restore();
  }
  function sound(job, key, fn) { if (job[key]) return; job[key] = 1; try { if (SC.nearType && SC.nearType('bar') < 620 && !(SC.sfxMuted && SC.sfxMuted())) fn(); } catch (e) {} }
  function standFor(rx, lo, hi) { return rx - 62 >= lo ? rx - 62 : clamp(rx + 62, lo, hi); }
  var K = { walk: 0.8, shake: 1.9, pour: 2.5, slide: 3.3, land: 3.6 };

  A.barKeeper = function (c, o, t, ctx) {
    var x = o.x, y = o.y, W = o.w || 340, now = performance.now(), jobs = SC.bar.jobs;
    var lo = x - W / 2 + 34, hi = x + W / 2 - 34, idleX = x - 40 + Math.sin(t * 0.4) * 60;
    for (var i = jobs.length - 1; i >= 0; i--) if ((now - jobs[i].t0) / 1000 > jobs[i].ms / 1000 + 1.4) jobs.splice(i, 1);
    var job = null, e = 0;
    for (i = 0; i < jobs.length; i++) { var ee = (now - jobs[i].t0) / 1000; if (ee >= 0 && ee < K.slide) { job = jobs[i]; e = ee; } }
    var dt = o._lt != null ? clamp(t - o._lt, 0, 0.1) : 0; o._lt = t;
    if (o.bx == null) o.bx = idleX;
    var tx = idleX, rx = 0;
    if (job) { rx = clamp(job.x, lo, hi); job.sx = standFor(rx, lo, hi); tx = job.sx; }
    var d = tx - o.bx, step = (job ? 330 : 70) * dt; o.bx += Math.abs(d) <= step ? d : (d > 0 ? step : -step);
    var walking = Math.abs(tx - o.bx) > 2, bx = o.bx, by = y - 62;
    var shaking = job && e >= K.walk && e < K.shake, pouring = job && e >= K.shake && e < K.pour, sliding = job && e >= K.pour;
    A.drawGim(c, bx, by, A.NPC.bartender, { t: t, lookAt: job ? { x: rx - bx, y: 90 } : ctx.lookAt(x, y - 80), blink: ctx.blink(5), moving: walking, walk: t * 13, dance: !!shaking, dir: 0 });
    if (job) {
      var dr = DRINK[job.d] || DRINK[0], dirv = rx >= job.sx ? 1 : -1;
      if (e > 0.05) sound(job, 's0', function () { SC.sfxTone(520, 0.07, 'triangle', 0.12); SC.sfxTone(780, 0.09, 'triangle', 0.1, 0.06); });
      if (e > 0.1 && !job.said && SC.bar.say) { job.said = 1; SC.bar.say('Coming right up' + (job.nick ? ', ' + job.nick : '') + '!', bx); }
      if (shaking) {
        var sy = by - 34 + Math.sin(t * 34) * 4, sx = bx + 16 * dirv + Math.sin(t * 29) * 3;
        c.save(); c.translate(sx, sy); c.rotate(Math.sin(t * 34) * 0.35);
        rr(c, -6, -13, 12, 24, 4); fs(c, '#c9d3e0', OL, 2.5); rr(c, -4.5, -20, 9, 9, 3); fs(c, '#9aa7b8', OL, 2); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-3.5, -9, 2, 14);
        c.restore();
        if (Math.sin(t * 34) > 0.9) { c.fillStyle = 'rgba(255,255,255,.7)'; circ(c, sx + (Math.random() - 0.5) * 24, sy - 16 - Math.random() * 10, 1.6); c.fill(); }
        if (Math.floor((e - K.walk) * 9) !== job.shk) { job.shk = Math.floor((e - K.walk) * 9); try { if (SC.nearType('bar') < 620) SC.sfxNoise(0.05, 0.1, 0, 3600); } catch (e2) {} }
      }
      if (pouring) {
        var gx0 = job.sx + 26 * dirv, gy0 = y - 48, pe = (e - K.shake) / (K.pour - K.shake);
        c.save(); c.translate(gx0 - 8 * dirv, gy0 - 62); c.rotate(-0.95 * dirv); rr(c, -6, -13, 12, 24, 4); fs(c, '#c9d3e0', OL, 2.5); rr(c, -4.5, -20, 9, 9, 3); fs(c, '#9aa7b8', OL, 2); c.restore();
        c.strokeStyle = dr[0]; c.lineWidth = 3; c.beginPath(); c.moveTo(gx0 - 1 * dirv, gy0 - 52); c.lineTo(gx0, gy0 - 24 * pe); c.stroke();
        sound(job, 's1', function () { SC.sfxNoise(0.55, 0.12, 0, 1400); SC.sfxTone(700, 0.5, 'sine', 0.05, 0, 1100); });
      }
      if (sliding && !job.said2 && SC.bar.say) { job.said2 = 1; SC.bar.say(dr[2] + ' One ' + dr[1] + '!', bx); }
    }
  };

  // The glasses on the bar top: filling, sliding to whoever ordered, then waiting to be picked up.
  A.barGlass = function (c, o, t) {
    var now = performance.now(), jobs = SC.bar.jobs, W = o.w || 340, lo = o.x - W / 2 + 34, hi = o.x + W / 2 - 34, gy = o.y - 48;
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i], e = (now - j.t0) / 1000; if (e < K.shake || e > j.ms / 1000 + 0.55) continue;
      var rx = clamp(j.x, lo, hi), sx = standFor(rx, lo, hi), dirv = rx >= sx ? 1 : -1, home = sx + 26 * dirv, dr = DRINK[j.d] || DRINK[0], gx, fill = 1, hop = 0;
      if (e < K.pour) { gx = home; fill = (e - K.shake) / (K.pour - K.shake); }
      else if (e < K.slide) {
        var p = ease((e - K.pour) / (K.slide - K.pour)); gx = home + (rx - home) * p;
        sound(j, 's2', function () { SC.sfxNoise(0.5, 0.07, 0, 500); });
        c.fillStyle = 'rgba(255,255,255,.18)'; for (var k = 1; k < 4; k++) { c.fillRect(gx - dirv * (10 + k * 9), gy - 3 - k, 8, 1.5); }
      } else {
        gx = rx; var lp = e - K.slide; if (lp < 0.3) hop = -Math.abs(Math.sin(lp / 0.3 * Math.PI * 1.5)) * 5 * (1 - lp / 0.3);
        sound(j, 's3', function () { SC.sfxTone(2100, 0.12, 'triangle', 0.1); SC.sfxTone(3100, 0.1, 'triangle', 0.06, 0.03); });
      }
      var drawA = e > j.ms / 1000 ? Math.max(0, 1 - (e - j.ms / 1000) / 0.55) : 1; c.globalAlpha = drawA;
      glass(c, gx, gy + hop, fill, dr[0], j.d); c.globalAlpha = 1;
    }
  };

  // ================================================================ things players carry
  function hammerShape(c, glowOn) {   // upright hammer, origin at the middle of the head
    c.save();
    rr(c, -5, -4, 10, 76, 4); fs(c, '#6b3a1e', OL, 3);
    c.fillStyle = '#d4a63a'; [10, 28, 46].forEach(function (yy) { c.fillRect(-5.5, yy, 11, 4); });
    rr(c, -7, 66, 14, 10, 4); fs(c, '#d4a63a', OL, 2.5);
    if (glowOn) { c.shadowColor = '#ff3b5c'; c.shadowBlur = 16; }
    var g = c.createLinearGradient(0, -22, 0, 18); g.addColorStop(0, '#aeb6c8'); g.addColorStop(0.5, '#6f788c'); g.addColorStop(1, '#3f4658');
    rr(c, -36, -22, 72, 40, 7); fs(c, g, OL, 3.5); c.shadowBlur = 0;
    rr(c, -36, -22, 11, 40, 5); fs(c, '#d4a63a', OL, 2.5); rr(c, 25, -22, 11, 40, 5); fs(c, '#d4a63a', OL, 2.5);
    c.strokeStyle = '#ff3b5c'; c.lineWidth = 3.5; c.shadowColor = '#ff3b5c'; c.shadowBlur = 10; circ(c, 0, -2, 11); c.stroke(); c.beginPath(); c.moveTo(-7, 6); c.lineTo(7, -10); c.stroke(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(-22, -19, 40, 4);
    c.restore();
  }
  A.drawHammer = hammerShape;
  A.playerProps = function (c, p, t, sc) {
    var side = p.dir === 1 ? -1 : 1, s = sc || 1;
    c.save(); c.translate(p.x, p.y); c.scale(s, s);
    if (p.hammer) {
      var sw = 0, age = p.slamAt != null ? t - p.slamAt : 9; if (age < 0.55) { var q = age / 0.55; sw = q < 0.35 ? -(q / 0.35) * 1.5 : -1.5 + ((q - 0.35) / 0.65) * 2.9; }
      c.save(); c.translate(side * 20, -24); c.rotate(side * (0.5 + sw) + Math.sin(t * 2) * 0.03); c.scale(0.5, 0.5); c.translate(0, -48); hammerShape(c, true); c.restore();
    }
    if (p.drink && t < p.drink.until) {
      var cyc = (t - p.drink.from) % 7, sip = cyc < 1 ? Math.sin(cyc * Math.PI) : 0;
      c.font = '17px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.drink.e, side * 17 - side * sip * 4, -22 - sip * 24 + Math.sin(t * 2.2) * 0.8);
    } else if (p.drink) p.drink = null;
    if (p.frozen) {
      c.fillStyle = 'rgba(150,220,255,.38)'; rr(c, -24, -74, 48, 82, 12); c.fill(); c.strokeStyle = 'rgba(235,250,255,.85)'; c.lineWidth = 3; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, -60); c.lineTo(-6, -44); c.moveTo(10, -30); c.lineTo(17, -14); c.stroke();
    }
    c.restore();
  };

  // ================================================================ Owner Vault objects
  // The grate in the doorway between The Vault and the Owner Vault: it slides up into the wall when an owner walks up.
  O.vgate = function (c, o, t) {
    var x = o.x, y = o.y, G = SC.vault.gate, open = ease(G.open), mine = !!SC.vault.own, moving = G.open > 0.02 && G.open < 0.98;
    c.fillStyle = '#0a0409'; c.fillRect(x - 24, y - 96, 48, 192);
    c.fillStyle = 'rgba(255,59,92,.16)'; c.fillRect(x - 24, y - 96, 48, 192);
    c.save(); c.beginPath(); c.rect(x - 24, y - 96, 48, 192); c.clip();
    var off = -open * 196;
    if (open < 0.99) {
      c.translate(0, off);
      var ay = y - 96;
      rr(c, x - 22, ay + 2, 44, 188, 4); fs(c, '#2b2432', OL, 3);
      for (var k = 0; k < 15; k++) { var yy = ay + 8 + k * 12.4; c.fillStyle = '#4a4356'; c.fillRect(x - 21, yy, 42, 6); c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x - 21, yy, 42, 1.5); c.fillStyle = 'rgba(255,59,92,' + (0.35 + 0.25 * Math.sin(t * 3 + k)) + ')'; c.fillRect(x - 21, yy + 7, 42, 3); }
      c.fillStyle = '#d4a63a'; c.fillRect(x - 22, ay + 2, 5, 188); c.fillRect(x + 17, ay + 2, 5, 188);
      circ(c, x, ay + 96, 15); fs(c, '#d4a63a', OL, 3.5); circ(c, x, ay + 96, 10); fs(c, '#1b0b12', OL, 2);
      c.fillStyle = mine ? '#2bd576' : (Math.sin(t * 4) > 0 ? '#ff3b5c' : '#8a1a2b'); circ(c, x, ay + 96, 5); c.fill();
    }
    c.restore();
    // frame: gold posts at both ends of the opening
    [-1, 1].forEach(function (s) { var py = y + s * 96; rr(c, x - 29, py - (s < 0 ? 18 : 2), 58, 20, 5); fs(c, '#3a2230', OL, 3); c.fillStyle = '#d4a63a'; c.fillRect(x - 25, py - (s < 0 ? 15 : -1), 50, 3); c.fillStyle = moving || (open < 0.1 && !mine) ? (Math.sin(t * 8) > 0 ? '#ff3b5c' : '#5a0f1c') : '#2bd576'; circ(c, x, py - (s < 0 ? 8 : 8) + (s < 0 ? 0 : 0), 4.2); c.fill(); });
    if (open > 0.4 && !mine) {   // the doorway is open for the owner, but not for you
      c.save(); c.beginPath(); c.rect(x - 22, y - 94, 44, 188); c.clip();
      for (var s2 = 0; s2 < 10; s2++) { var yy2 = (y - 94) + ((s2 * 22 + t * 60) % 200); c.fillStyle = 'rgba(255,59,92,' + (0.16 + 0.1 * Math.sin(t * 6 + s2)) + ')'; c.fillRect(x - 22, yy2, 44, 8); }
      c.strokeStyle = 'rgba(255,120,140,.8)'; c.lineWidth = 2; c.strokeRect(x - 20, y - 92, 40, 184);
      c.restore();
    }
    if (moving) { c.fillStyle = '#ffd166'; for (var q = 0; q < 5; q++) { circ(c, x + (Math.random() - 0.5) * 40, y - 96 + Math.random() * 190, 1.4 + Math.random() * 1.2); c.fill(); } }
    glow(c, x, y, 120, '255,59,92', open < 0.5 ? 0.16 : 0.1);
    // floor lettering on the Vault side of the grate
    c.save(); c.globalAlpha = 0.65 + 0.3 * Math.sin(t * 2.2);
    A.label(c, '🔒', x - 88, y - 18, { size: 22, stroke: false });
    A.label(c, 'OWNERS ONLY', x - 88, y + 10, { size: 12, color: '#ff6b81', glow: '#ff3b5c', blur: 8, lw: 3 });
    c.restore();
    c.fillStyle = 'rgba(255,209,102,.8)'; for (var h = 0; h < 6; h++) { c.save(); c.translate(x - 54 + h * 6, y + 40); c.rotate(0.6); c.fillRect(0, 0, 3, 18); c.restore(); }
  };

  O.hammer = function (c, o, t) {
    var x = o.x, y = o.y, hy = y - 108 + Math.sin(t * 2) * 6;
    shadow(c, x, y + 2, 36, 10);
    rr(c, x - 32, y - 14, 64, 14, 4); fs(c, '#2a1a2a', OL, 3); c.fillStyle = '#d4a63a'; c.fillRect(x - 30, y - 10, 60, 2.5);
    rr(c, x - 21, y - 44, 42, 32, 4); fs(c, '#3b2339', OL, 3); ell(c, x, y - 46, 27, 8); fs(c, '#d4a63a', OL, 3);
    c.fillStyle = 'rgba(255,59,92,.7)'; ell(c, x, y - 47, 16, 4); c.fill();
    glow(c, x, hy, 84, '255,59,92', 0.4 + 0.12 * Math.sin(t * 3)); glow(c, x, hy, 48, '255,209,102', 0.22);
    c.save(); c.translate(x, hy); c.rotate(-0.45 + Math.sin(t * 1.3) * 0.1); c.scale(0.95, 0.95); c.translate(0, -8); hammerShape(c, true); c.restore();
    for (var i = 0; i < 6; i++) { var a = t * 1.5 + i * TAU / 6, sx = x + Math.cos(a) * 52, sy = hy + Math.sin(a) * 18; c.fillStyle = 'rgba(255,230,160,' + (0.5 + 0.4 * Math.sin(t * 5 + i)) + ')'; circ(c, sx, sy, 2.2); c.fill(); }
    A.neon(c, 'BAN HAMMER', x, y - 176, '#ff3b5c', 15, t, 3);
  };

  O.modterm = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 56, 10);
    rr(c, x - 52, y - 24, 104, 24, 6); fs(c, '#2a1f3d', OL, 3); c.fillStyle = 'rgba(92,242,255,.35)'; c.fillRect(x - 48, y - 22, 96, 2);
    rr(c, x - 6, y - 40, 12, 18, 3); fs(c, '#1b1636', OL, 2.5);
    rr(c, x - 45, y - 104, 90, 66, 8); fs(c, '#14102a', OL, 3.5); rr(c, x - 39, y - 98, 78, 54, 4); fs(c, '#03120b', OL, 2);
    c.save(); c.beginPath(); c.rect(x - 39, y - 98, 78, 54); c.clip();
    for (var i = 0; i < 6; i++) { var w = 22 + 40 * Math.abs(Math.sin(i * 2.1 + Math.floor(t * 1.5 + i))); c.fillStyle = i === 2 ? '#ff5c6c' : '#2bd576'; c.globalAlpha = 0.85; c.fillRect(x - 35, y - 93 + i * 8, w, 4); }
    c.globalAlpha = 1;
    for (var d = 0; d < 4; d++) { c.fillStyle = d === 1 ? '#ff3b5c' : '#ffd166'; circ(c, x + 14 + Math.sin(t * 0.7 + d * 1.7) * 18, y - 56 + Math.cos(t * 0.9 + d * 2.3) * 5, 2.4); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x - 39, y - 98 + ((t * 30) % 54), 78, 6);
    if (Math.sin(t * 5) > 0) { c.fillStyle = '#2bd576'; c.fillRect(x + 28, y - 51, 5, 7); }
    c.restore();
    rr(c, x - 32, y - 16, 64, 9, 3); fs(c, '#3b3158', OL, 2);
    glow(c, x, y - 70, 74, '92,242,255', 0.16);
    A.neon(c, 'MOD MENU', x, y - 128, '#5cf2ff', 15, t, 5);
  };

  O.rigcon = function (c, o, t) {   // the treasury: a chest of gold. Opens the Rig Console.
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 62, 11);
    rr(c, x - 52, y - 40, 104, 40, 7); fs(c, '#5a2f12', OL, 3.5); c.fillStyle = '#d4a63a'; [-36, 0, 36].forEach(function (dx) { c.fillRect(x + dx - 4, y - 40, 8, 40); }); c.fillRect(x - 52, y - 24, 104, 5);
    circ(c, x, y - 20, 7); fs(c, '#ffd166', OL, 2.5);
    c.fillStyle = '#ffd166'; ell(c, x, y - 42, 50, 14); c.fill(); c.strokeStyle = OL; c.lineWidth = 3; c.stroke();
    for (var i = 0; i < 12; i++) { var cx = x - 40 + (i * 37 % 80), cy = y - 46 - ((i * 13) % 14); circ(c, cx, cy, 6); fs(c, i % 2 ? '#ffd166' : '#ffb703', OL, 1.5); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(cx - 2, cy - 3, 2, 3); }
    for (var s = 0; s < 4; s++) { var a = (t * 0.9 + s * 0.27) % 1; c.fillStyle = 'rgba(255,255,255,' + (1 - a) + ')'; var sx = x - 38 + s * 25, sy = y - 62 - a * 24; c.fillRect(sx - 1, sy - 5, 2, 10); c.fillRect(sx - 5, sy - 1, 10, 2); }
    glow(c, x, y - 60, 92, '255,200,80', 0.26 + 0.06 * Math.sin(t * 3));
    A.neon(c, 'RIG CONSOLE', x, y - 112, '#ffd166', 14, t, 7);
  };

  O.podium = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 26, 8);
    c.beginPath(); c.moveTo(x - 22, y); c.lineTo(x - 18, y - 58); c.lineTo(x + 18, y - 58); c.lineTo(x + 22, y); c.closePath(); fs(c, '#4a1020', OL, 3);
    c.fillStyle = '#d4a63a'; c.fillRect(x - 20, y - 30, 40, 3); rr(c, x - 22, y - 64, 44, 10, 3); fs(c, '#6a1a2e', OL, 2.5);
    c.strokeStyle = OL; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 4, y - 62); c.quadraticCurveTo(x + 14, y - 86, x + 2, y - 98); c.stroke();
    circ(c, x + 2, y - 100, 5); fs(c, '#2a2438', OL, 2.5);
    var on = Math.sin(t * 3) > -0.2; rr(c, x - 22, y - 128, 44, 16, 6); fs(c, on ? '#c1121f' : '#4a0a12', OL, 2.5); A.label(c, 'ON AIR', x, y - 120, { size: 9, color: '#fff', stroke: false });
    if (on) glow(c, x, y - 120, 36, '255,59,92', 0.3);
    A.neon(c, 'ANNOUNCE', x, y - 146, '#ffd166', 12, t, 2);
  };

  O.throne = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 46, 10);
    rr(c, x - 34, y - 124, 68, 100, 16); fs(c, '#7d1424', OL, 3.5); rr(c, x - 26, y - 114, 52, 82, 11); fs(c, '#a3263a', 'rgba(255,209,102,.7)', 2);
    rr(c, x - 44, y - 78, 14, 50, 6); fs(c, '#d4a63a', OL, 3); rr(c, x + 30, y - 78, 14, 50, 6); fs(c, '#d4a63a', OL, 3);
    rr(c, x - 42, y - 44, 84, 34, 9); fs(c, '#b02a40', OL, 3.5); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x - 36, y - 40, 72, 4);
    var cy = y - 148 + Math.sin(t * 2) * 3;
    c.beginPath(); c.moveTo(x - 20, cy + 14); c.lineTo(x - 22, cy - 6); c.lineTo(x - 10, cy + 4); c.lineTo(x, cy - 12); c.lineTo(x + 10, cy + 4); c.lineTo(x + 22, cy - 6); c.lineTo(x + 20, cy + 14); c.closePath(); fs(c, '#ffd166', OL, 3);
    [['#ff3b5c', -12], ['#5cf2ff', 0], ['#2bd576', 12]].forEach(function (g) { circ(c, x + g[1], cy + 7, 2.8); fs(c, g[0], OL, 1.2); });
    glow(c, x, cy, 52, '255,209,102', 0.3);
  };

  O.brazier = function (c, o, t) {
    var x = o.x, y = o.y;
    shadow(c, x, y + 2, 18, 6);
    c.strokeStyle = OL; c.lineWidth = 4; c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x - 5, y - 20); c.moveTo(x + 10, y); c.lineTo(x + 5, y - 20); c.stroke();
    c.beginPath(); c.moveTo(x - 17, y - 34); c.lineTo(x + 17, y - 34); c.lineTo(x + 10, y - 18); c.lineTo(x - 10, y - 18); c.closePath(); fs(c, '#2a2438', OL, 3); c.fillStyle = '#d4a63a'; c.fillRect(x - 16, y - 34, 32, 3);
    var fl = Math.sin(t * 11 + x) * 3, f2 = Math.sin(t * 15 + x * 2) * 2;
    [['#ff6b1a', 19, 11], ['#ffb703', 14, 7], ['#fff1b0', 8, 4]].forEach(function (f, i) {
      c.beginPath(); c.moveTo(x - f[2], y - 34); c.quadraticCurveTo(x - f[2] - 3, y - 34 - f[1] * 0.6, x + fl * 0.3 - i, y - 34 - f[1] - fl - f2 * (i + 1) * 0.3); c.quadraticCurveTo(x + f[2] + 3, y - 34 - f[1] * 0.6, x + f[2], y - 34); c.closePath(); c.fillStyle = f[0]; c.fill();
    });
    glow(c, x, y - 44, 86, '255,140,40', 0.26 + Math.sin(t * 9 + x) * 0.04);
  };

  O.vrune = function (c, o, t) {   // crimson runner from the grate to the hammer, and a sigil under it
    var x = o.x, y = o.y, r = 124;
    rr(c, 2880, y - 28, x - 2880, 56, 4); c.fillStyle = 'rgba(122,20,36,.9)'; c.fill(); c.strokeStyle = 'rgba(255,209,102,.75)'; c.lineWidth = 3; c.stroke();
    c.fillStyle = 'rgba(255,209,102,.5)'; for (var i = 0; i < 6; i++) { c.beginPath(); var rx = 2900 + i * ((x - 2960) / 5); c.moveTo(rx, y); c.lineTo(rx + 7, y - 7); c.lineTo(rx + 14, y); c.lineTo(rx + 7, y + 7); c.closePath(); c.fill(); }
    c.save(); c.translate(x, y); c.scale(1, 0.62);
    circ(c, 0, 0, r); c.fillStyle = 'rgba(70,8,22,.8)'; c.fill(); c.strokeStyle = 'rgba(255,209,102,.8)'; c.lineWidth = 4; c.stroke();
    circ(c, 0, 0, r - 14); c.strokeStyle = 'rgba(255,59,92,.55)'; c.lineWidth = 2; c.setLineDash([10, 8]); c.lineDashOffset = -t * 30; c.stroke(); c.setLineDash([]);
    c.rotate(t * 0.25); c.strokeStyle = 'rgba(255,209,102,.6)'; c.lineWidth = 2.5; c.beginPath();
    for (var k = 0; k < 5; k++) { var a = k * TAU * 2 / 5 - Math.PI / 2; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * (r - 24), Math.sin(a) * (r - 24)); } c.closePath(); c.stroke();
    c.restore();
    glow(c, x, y, 150, '255,59,92', 0.14 + 0.04 * Math.sin(t * 2));
  };

  O.vbanner = function (c, o, t) {
    var x = o.x, y = o.y, sw = Math.sin(t * 1.2 + x) * 1.6;
    c.fillStyle = '#d4a63a'; c.fillRect(x - 22, y - 80, 44, 5);
    c.beginPath(); c.moveTo(x - 18, y - 75); c.lineTo(x + 18, y - 75); c.lineTo(x + 18 + sw, y - 4); c.lineTo(x + sw * 0.5, y - 16); c.lineTo(x - 18 + sw, y - 4); c.closePath(); fs(c, '#a3132a', OL, 3);
    c.strokeStyle = '#d4a63a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 14, y - 70); c.lineTo(x + 14, y - 70); c.stroke();
    c.save(); c.translate(x + sw * 0.3, y - 42); c.scale(0.24, 0.24); c.rotate(-0.4); hammerShape(c, false); c.restore();
  };

  // ================================================================ world effects (positions follow the player they belong to)
  var list = [];
  SC.vfx = {
    add: function (k, id, x, y) { list.push({ k: k, id: id, x: x, y: y, at: performance.now() / 1000 }); },
    draw: function (c, who, dt) {
      var now = performance.now() / 1000;
      for (var i = list.length - 1; i >= 0; i--) {
        var f = list[i], age = now - f.at, life = f.k === 'smite' ? 2.2 : f.k === 'slam' ? 0.9 : f.k === 'warp' ? 1 : 0.8;
        if (age > life) { list.splice(i, 1); continue; }
        var w = who(f.id); if (w) { f.x = w.x; f.y = w.y; }
        var x = f.x, y = f.y;
        if (f.k === 'smite') {
          if (age < 1.0) {   // a red target closes in
            var q = age / 1.0; c.strokeStyle = 'rgba(255,59,92,' + (0.4 + 0.5 * q) + ')'; c.lineWidth = 3; ell(c, x, y, 62 - q * 34, 26 - q * 14); c.stroke(); ell(c, x, y, 14, 6); c.stroke();
            c.fillStyle = 'rgba(255,59,92,.12)'; ell(c, x, y, 62 - q * 34, 26 - q * 14); c.fill();
            A.label(c, '⚡', x, y - 86 - Math.sin(age * 12) * 3, { size: 24, stroke: false });
          } else if (age < 1.5) {
            var b = age - 1.0, seed = Math.floor(b * 24);
            c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
            for (var pass = 0; pass < 2; pass++) {
              c.strokeStyle = pass ? '#ffffff' : 'rgba(140,170,255,.8)'; c.lineWidth = pass ? 3 : 9; c.beginPath(); c.moveTo(x + 6, y - 520);
              for (var s = 1; s <= 12; s++) { var jx = Math.sin(seed * 7.3 + s * 3.1) * 22; c.lineTo(x + jx * (1 - s / 12), y - 520 + s * (520 / 12)); }
              c.stroke();
            }
            c.restore();
            glow(c, x, y - 20, 160, '170,200,255', 0.55 * (1 - b * 1.6));
            c.strokeStyle = 'rgba(255,255,255,' + (0.8 - b) + ')'; c.lineWidth = 4; ell(c, x, y, 20 + b * 160, 8 + b * 64); c.stroke();
          } else { c.fillStyle = 'rgba(0,0,0,' + (0.5 * (1 - (age - 1.5) / 0.7)) + ')'; ell(c, x, y, 26, 10); c.fill(); }
        } else if (f.k === 'slam') {
          var p = age / life; c.strokeStyle = 'rgba(255,209,102,' + (1 - p) + ')'; c.lineWidth = 5 * (1 - p) + 1; ell(c, x, y, 20 + p * 170, 8 + p * 68); c.stroke();
          c.strokeStyle = 'rgba(255,59,92,' + (0.8 - p) + ')'; ell(c, x, y, 10 + p * 110, 4 + p * 44); c.stroke();
          c.strokeStyle = 'rgba(30,10,20,' + (0.8 - p) + ')'; c.lineWidth = 3; for (var r = 0; r < 8; r++) { var ra = r * TAU / 8 + 0.3; c.beginPath(); c.moveTo(x + Math.cos(ra) * 14, y + Math.sin(ra) * 6); c.lineTo(x + Math.cos(ra) * (14 + p * 90), y + Math.sin(ra) * (6 + p * 36)); c.stroke(); }
        } else if (f.k === 'warp') {
          var wp = age / life; c.strokeStyle = 'rgba(190,140,255,' + (1 - wp) + ')'; c.lineWidth = 4; ell(c, x, y, 40 * (1 - wp * 0.4), 15 * (1 - wp * 0.4)); c.stroke();
          for (var u = 0; u < 9; u++) { var ux = x + Math.sin(u * 2.4 + wp * 4) * 26, uy = y - wp * 130 - (u * 17 % 40); c.fillStyle = 'rgba(220,190,255,' + (1 - wp) + ')'; c.fillRect(ux - 1.5, uy, 3, 14); }
          glow(c, x, y - 30, 70, '190,140,255', 0.4 * (1 - wp));
        } else {   // freeze / thaw: ice shards
          var ip = age / life; c.fillStyle = 'rgba(190,235,255,' + (1 - ip) + ')';
          for (var m = 0; m < 10; m++) { var ma = m * TAU / 10, md = 12 + ip * 56; c.save(); c.translate(x + Math.cos(ma) * md, y - 30 + Math.sin(ma) * md * 0.7); c.rotate(ma); c.beginPath(); c.moveTo(0, -7); c.lineTo(4, 0); c.lineTo(0, 7); c.lineTo(-4, 0); c.closePath(); c.fill(); c.restore(); }
        }
      }
    },
  };

  // ================================================================ screen effects
  var gfx = { until: {}, p: [], flash: 0, next: 0, bolt: null, snow: null };
  SC.gfx = {
    start: function (k, secs) { gfx.until[k] = performance.now() / 1000 + (secs || 10); gfx.next = 0; },
    active: function () { var n = performance.now() / 1000; for (var k in gfx.until) if (gfx.until[k] > n) return true; return false; },
    draw: function (c, W, H, dt) {
      var now = performance.now() / 1000, on = function (k) { return gfx.until[k] > now; }, i;
      c.save();
      if (on('storm')) {
        c.fillStyle = 'rgba(5,8,28,.34)'; c.fillRect(0, 0, W, H);
        c.strokeStyle = 'rgba(190,210,255,.35)'; c.lineWidth = 1.2; c.beginPath(); for (i = 0; i < 70; i++) { var rx = Math.random() * W, ry = Math.random() * H; c.moveTo(rx, ry); c.lineTo(rx - 5, ry + 16); } c.stroke();
        if (now > gfx.next) { gfx.next = now + 0.9 + Math.random() * 1.6; gfx.flash = 1; gfx.bolt = { x: W * (0.15 + Math.random() * 0.7), seed: Math.random() * 99 }; try { SC.sfx && SC.sfx('thunder'); } catch (e) {} }
        if (gfx.flash > 0) { c.fillStyle = 'rgba(220,230,255,' + (gfx.flash * 0.45) + ')'; c.fillRect(0, 0, W, H); if (gfx.bolt && gfx.flash > 0.4) { c.strokeStyle = 'rgba(255,255,255,' + gfx.flash + ')'; c.lineWidth = 3; c.beginPath(); c.moveTo(gfx.bolt.x, 0); for (i = 1; i <= 9; i++) c.lineTo(gfx.bolt.x + Math.sin(gfx.bolt.seed + i * 2.7) * 38, i * H / 9 * 0.85); c.stroke(); } gfx.flash = Math.max(0, gfx.flash - dt * 3); }
      }
      if (on('disco')) {
        c.globalCompositeOperation = 'lighter'; var cols = ['255,59,122', '58,134,255', '255,209,102', '43,213,118', '177,133,255', '92,242,255'];
        for (i = 0; i < 6; i++) { var a = now * 0.7 + i * TAU / 6; c.fillStyle = 'rgba(' + cols[i] + ',.12)'; c.beginPath(); c.moveTo(W / 2, -20); c.lineTo(W / 2 + Math.cos(a) * W * 1.1 - 90, H * (0.7 + 0.3 * Math.sin(a))); c.lineTo(W / 2 + Math.cos(a) * W * 1.1 + 90, H * (0.7 + 0.3 * Math.sin(a))); c.closePath(); c.fill(); }
        c.globalCompositeOperation = 'source-over';
      }
      if (on('party')) {
        c.globalCompositeOperation = 'lighter'; var ph = now * 2.4; var g1 = c.createRadialGradient(0, 0, 10, 0, 0, W * 0.6); g1.addColorStop(0, 'hsla(' + (ph * 60 % 360) + ',100%,60%,.16)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g1; c.fillRect(0, 0, W, H);
        var g2 = c.createRadialGradient(W, H, 10, W, H, W * 0.6); g2.addColorStop(0, 'hsla(' + ((ph * 60 + 180) % 360) + ',100%,60%,.16)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'source-over';
        for (i = 0; i < 5; i++) gfx.p.push({ t: 'conf', x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 140, life: 0, max: 5, col: 'hsl(' + ((Math.random() * 360) | 0) + ',95%,62%)', w: 4 + Math.random() * 5, ph: Math.random() * 6 });
      }
      if (on('fireworks') && now > gfx.next) {
        gfx.next = now + 0.32 + Math.random() * 0.3; var fx = W * (0.12 + Math.random() * 0.76), fy = H * (0.1 + Math.random() * 0.4), hue = (Math.random() * 360) | 0;
        for (i = 0; i < 34; i++) { var fa = Math.random() * TAU, fsd = 70 + Math.random() * 190; gfx.p.push({ t: 'fw', x: fx, y: fy, vx: Math.cos(fa) * fsd, vy: Math.sin(fa) * fsd, life: 0, max: 1.1 + Math.random() * 0.6, col: 'hsl(' + ((hue + Math.random() * 40) | 0) + ',100%,64%)' }); }
        try { SC.sfxNoise && SC.sfxNoise(0.18, 0.1, 0, 900); SC.sfxTone && SC.sfxTone(180, 0.2, 'sine', 0.1, 0, 60); } catch (e) {}
      }
      if (on('snow')) {
        if (!gfx.snow) { gfx.snow = []; for (i = 0; i < 90; i++) gfx.snow.push({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2.5, v: 30 + Math.random() * 50, ph: Math.random() * 6 }); }
        c.fillStyle = 'rgba(255,255,255,.85)'; gfx.snow.forEach(function (f) { f.y += f.v * dt / H; if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); } c.beginPath(); c.arc(f.x * W + Math.sin(now + f.ph) * 14, f.y * H, f.s, 0, TAU); c.fill(); });
      }
      for (i = gfx.p.length - 1; i >= 0; i--) {
        var q = gfx.p[i]; q.life += dt; if (q.life > q.max) { gfx.p.splice(i, 1); continue; }
        if (q.t === 'fw') { q.vy += 120 * dt; q.vx *= 0.985; q.x += q.vx * dt; q.y += q.vy * dt; c.globalAlpha = 1 - q.life / q.max; c.fillStyle = q.col; c.beginPath(); c.arc(q.x, q.y, 2.4, 0, TAU); c.fill(); }
        else { q.x += (q.vx + Math.sin(q.life * 4 + q.ph) * 30) * dt; q.y += q.vy * dt; c.globalAlpha = Math.min(1, (q.max - q.life) * 2); c.save(); c.translate(q.x, q.y); c.rotate(q.life * 5 + q.ph); c.fillStyle = q.col; c.fillRect(-q.w / 2, -2, q.w, 4); c.restore(); }
      }
      c.globalAlpha = 1; c.restore();
    },
  };

  // sounds for the vault
  if (SC.sfxAdd && SC.sfxTone && SC.sfxNoise) {
    var T = SC.sfxTone, N = SC.sfxNoise;
    SC.sfxAdd('gate', function () { N(0.9, 0.16, 0, 160); T(70, 0.9, 'sawtooth', 0.07, 0, 45); T(110, 0.5, 'square', 0.05, 0.5, 80); });
    SC.sfxAdd('gateclose', function () { N(0.7, 0.14, 0, 160); T(60, 0.7, 'sawtooth', 0.07, 0, 40); T(90, 0.18, 'square', 0.14, 0.62, 40); N(0.12, 0.3, 0.62, 400); });
    SC.sfxAdd('thunder', function () { N(1.1, 0.35, 0, 60); T(70, 0.9, 'sine', 0.25, 0, 30); });
    SC.sfxAdd('smite', function () { N(0.35, 0.3, 0.95, 200); T(55, 1.0, 'sawtooth', 0.22, 0.95, 28); N(1.2, 0.3, 1.0, 50); });
    SC.sfxAdd('slam', function () { T(90, 0.5, 'sine', 0.35, 0, 36); N(0.45, 0.35, 0, 90); });
    SC.sfxAdd('warp', function () { T(300, 0.5, 'sine', 0.14, 0, 1500); T(450, 0.5, 'triangle', 0.08, 0.05, 1800); });
    SC.sfxAdd('ice', function () { for (var i = 0; i < 6; i++) T(2400 + i * 260, 0.1, 'triangle', 0.08, i * 0.03); });
    SC.sfxAdd('announce', function () { [0, 4, 7, 12].forEach(function (n, i) { T(SC.sfxNotes[n + 4], 0.22, 'square', 0.1, i * 0.1); }); });
  }
})();
