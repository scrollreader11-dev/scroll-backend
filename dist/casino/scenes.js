/* ============================================================
   Scrolls Casino 2D — animated table scenes for the game panels.
   Blackjack: dealer, shoe, cards flying out and flipping, every
   seated player's character holding their hand, chips moving.
   Roulette: tilted 3D wheel with the shared ball, croupier, and a
   clickable felt layout with everyone's chips on it.
   ============================================================ */
(function () {
  var SC = window.SC, A = SC.art, OL = A.OL, TAU = Math.PI * 2;
  var rr = A.rr, ell = A.ell, circ = A.circ;
  var S = SC.scene = {};
  var PCOL = ['#3a86ff', '#ff5c8a', '#2bd576', '#ffb703', '#9b5de5', '#00bbf9', '#f15bb5', '#fb5607'];
  SC.pidColor = function (pid) { return PCOL[(Math.abs(pid | 0)) % PCOL.length]; };
  function fs(c, f, st, lw) { if (f) { c.fillStyle = f; c.fill(); } if (st) { c.strokeStyle = st; c.lineWidth = lw || 3; c.lineJoin = 'round'; c.stroke(); } }
  var ease = function (p) { p = Math.max(0, Math.min(1, p)); return 1 - Math.pow(1 - p, 3); };
  var CARDN = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  // Sets the canvas backing size for crisp drawing; returns logical scale.
  function prep(cv, W, H) {
    var d = Math.min(window.devicePixelRatio || 1, 2), cw = cv.clientWidth || W, k = cw / W;
    var pw = Math.round(cw * d), ph = Math.round(H * k * d);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; cv.style.height = (H * k) + 'px'; }
    var c = cv.getContext('2d'); c.setTransform(d * k, 0, 0, d * k, 0, 0); return { c: c, k: k };
  }
  // ---------------------------------------------------------------- shared drawing
  function cardShape(c, x, y, w, h, rot, face, flip) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(Math.max(0.05, Math.abs(flip == null ? 1 : flip)), 1);
    var showFace = face && !face.hidden && (flip == null || flip > 0);
    c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, -w / 2 + 2, -h / 2 + 3, w, h, 5); c.fill();
    rr(c, -w / 2, -h / 2, w, h, 5); fs(c, showFace ? '#fff' : '#2b3bb0', OL, 2);
    if (showFace) {
      var red = face.s === '♥' || face.s === '♦', lab = CARDN[face.n] || face.n;
      c.fillStyle = red ? '#d00' : '#111'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 ' + Math.round(h * 0.27) + 'px Fredoka, sans-serif'; c.fillText(lab, -w * 0.18, -h * 0.28);
      c.font = Math.round(h * 0.42) + 'px serif'; c.fillText(face.s, 0, h * 0.12);
    } else {
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; rr(c, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 3); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.25)'; c.font = '700 ' + Math.round(h * 0.3) + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('S', 0, 1);
    }
    c.restore();
  }
  var CHIPC = [[1e9, '#111', '#ffd166'], [10000, '#7b2cbf', '#fff'], [1000, '#111827', '#ffd166'], [500, '#9b5de5', '#fff'], [100, '#2bd576', '#fff'], [25, '#3a86ff', '#fff'], [5, '#e63946', '#fff'], [0, '#e9ecef', '#3a86ff']];
  function chipCol(v) { for (var i = 0; i < CHIPC.length; i++) if (v >= CHIPC[i][0]) return CHIPC[i]; return CHIPC[CHIPC.length - 1]; }
  function chip(c, x, y, r, col, edge) {
    ell(c, x, y + r * 0.18, r, r * 0.5); fs(c, A.shade(col, -0.3), OL, 1.6);
    ell(c, x, y, r, r * 0.5); fs(c, col, OL, 1.6);
    c.strokeStyle = edge || '#fff'; c.lineWidth = 1.6; c.setLineDash([2.5, 3.5]); ell(c, x, y, r * 0.78, r * 0.38); c.stroke(); c.setLineDash([]);
  }
  function chipStack(c, x, y, amt, r, tint) {
    var col = tint ? [0, tint, '#fff'] : chipCol(amt), n = Math.max(1, Math.min(7, Math.round(Math.log10(amt + 1) * 1.6)));
    for (var i = 0; i < n; i++) chip(c, x, y - i * r * 0.32, r, col[1], col[2]);
    return y - (n - 1) * r * 0.32;
  }
  function felt(c, W, H, col) {
    var g = c.createRadialGradient(W / 2, H * 0.35, 30, W / 2, H * 0.5, W * 0.75); g.addColorStop(0, A.shade(col, 0.12)); g.addColorStop(1, A.shade(col, -0.35));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(0,0,0,.06)'; for (var i = 0; i < 40; i++) c.fillRect((i * 97) % W, (i * 53) % H, 2, 2);
  }

  // ================================================================ BLACKJACK
  var BW = 660, BH = 430;
  var SEAT = [{ x: 82, y: 278 }, { x: 206, y: 302 }, { x: 330, y: 310 }, { x: 454, y: 302 }, { x: 578, y: 278 }];
  var SHOE = { x: 560, y: 70 }, DEALER = { x: 330, y: 92 };
  var bjAnim = {}; // tableId -> {seat:[{cards:[{c, t0}], bet, chipT, res, resT}], dealer:[{c,t0,flipT}], round}
  function slotOfSeatCard(i, k, n) { var s = SEAT[i]; return { x: s.x - (n - 1) * 9 + k * 18, y: s.y + 66 + Math.abs(k - (n - 1) / 2) * 3, rot: (k - (n - 1) / 2) * 0.2 }; }
  function slotOfDealerCard(k, n) { return { x: DEALER.x - (n - 1) * 22 + k * 44, y: 150, rot: 0 }; }
  function syncBj(T, now) {
    var a = bjAnim[T.id] || (bjAnim[T.id] = { seat: [{}, {}, {}, {}, {}].map(function () { return { cards: [], bet: 0 }; }), dealer: [] });
    var delay = 0;
    T.seats.forEach(function (st, i) {
      var sa = a.seat[i], hand = st && st.hand || [];
      if (!st || hand.length < sa.cards.length) { if (sa.cards.length) sa.sweep = { cards: sa.cards, t0: now }; sa.cards = []; }
      for (var k = sa.cards.length; k < hand.length; k++) { sa.cards.push({ c: hand[k], t0: now + delay }); delay += 0.18; SC.sfx && SC.sfx('card'); }
      sa.cards.forEach(function (cd, k) { cd.c = hand[k] || cd.c; });
      var bet = st ? st.bet : 0;
      if (bet && bet !== sa.bet) sa.chipT = now; sa.bet = bet;
      var res = st && T.phase === 'done' ? st.result : '';
      if (res && res !== sa.res) { sa.res = res; sa.resT = now; } if (!res) sa.res = '';
      sa.st = st;
    });
    var d = T.dealer || [];
    if (d.length < a.dealer.length) { a.dealerSweep = { cards: a.dealer, t0: now }; a.dealer = []; }
    for (var k2 = a.dealer.length; k2 < d.length; k2++) { a.dealer.push({ c: d[k2], t0: now + delay }); delay += 0.22; }
    a.dealer.forEach(function (cd, k) { var nc = d[k]; if (cd.c && cd.c.hidden && nc && !nc.hidden) cd.flipT = now; cd.c = nc || cd.c; });
    return a;
  }
  function drawFlying(c, cd, to, now, w, h) {
    var p = (now - cd.t0) / 0.42;
    if (p < 0) return;
    var e = ease(p), x = SHOE.x + (to.x - SHOE.x) * e, y = SHOE.y + (to.y - SHOE.y) * e - Math.sin(Math.min(1, p) * Math.PI) * 30;
    var flip = p < 1 ? Math.cos((1 - e) * Math.PI) : 1; // back → face as it lands
    if (cd.flipT != null) { var fp = (now - cd.flipT) / 0.4; flip = fp < 1 ? Math.cos((1 - ease(fp)) * Math.PI) : 1; }
    if (cd.c && cd.c.hidden) flip = -1;
    cardShape(c, x, y, w, h, to.rot * e + (1 - e) * -0.6, cd.c, flip);
  }
  function holdingHand(c, x, y, look, cards, now, rot) {
    // character peeking over the table edge, holding its cards fanned in front
    A.drawGim(c, x, y + 46, look, { t: now, scale: 1.45, dir: 0, shadow: false, blink: (now % 4) < 0.12 });
  }
  S.bj = function (cv, T, now, me, lookOf) {
    var P = prep(cv, BW, BH), c = P.c;
    felt(c, BW, BH, '#16794a');
    // table arc + text
    c.strokeStyle = 'rgba(255,215,120,.55)'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(BW / 2, 150, 270, 140, 0, 0.12, Math.PI - 0.12); c.stroke();
    A.label(c, 'BLACKJACK PAYS 3 TO 2', BW / 2, 222, { size: 15, color: 'rgba(255,232,163,.75)', stroke: false });
    A.label(c, 'Dealer stands on 17 · Insurance? Never.', BW / 2, 241, { size: 10, color: 'rgba(255,232,163,.5)', stroke: false, weight: 600 });
    // dealer + rim behind dealer
    c.fillStyle = '#5a2d14'; c.fillRect(0, 0, BW, 28); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 28, BW, 6);
    A.drawGim(c, DEALER.x, 92, A.NPC.dealer, { t: now, scale: 1.55, shadow: false, blink: (now % 3.7) < 0.12, lookAt: T && T.phase === 'play' && T.turn >= 0 ? { x: SEAT[T.turn].x - DEALER.x, y: 60 } : null });
    // shoe + discard
    rr(c, SHOE.x - 30, SHOE.y - 26, 60, 44, 6); fs(c, '#2b2150', OL, 2.5);
    for (var s = 0; s < 4; s++) cardShape(c, SHOE.x - 4 + s * 2, SHOE.y - 6 - s, 30, 42, -0.25, null, -1);
    rr(c, 70, 52, 50, 60, 8); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill(); A.label(c, 'DISCARD', 95, 82, { size: 8, color: 'rgba(255,255,255,.35)', stroke: false });
    if (!T) { A.label(c, 'Loading table…', BW / 2, BH / 2, { size: 16 }); return; }
    var a = syncBj(T, now);
    // dealer cards
    a.dealer.forEach(function (cd, k) { drawFlying(c, cd, slotOfDealerCard(k, a.dealer.length), now, 46, 66); });
    if (T.dealer && T.dealer.length && T.dealerValue) A.label(c, String(T.dealerValue), DEALER.x, 196, { size: 16, color: '#ffd166', lw: 4 });
    sweep(c, a.dealerSweep, now, 46, 66, function (k, n) { return slotOfDealerCard(k, n); });
    // seats
    for (var i = 0; i < 5; i++) {
      var st = T.seats[i], sa = a.seat[i], sp = SEAT[i];
      // betting circle
      c.strokeStyle = st ? (T.turn === i && T.phase === 'play' ? '#ffd166' : 'rgba(255,255,255,.8)') : 'rgba(255,255,255,.35)'; c.lineWidth = T.turn === i && T.phase === 'play' ? 3.5 : 2;
      ell(c, sp.x, sp.y - 32, 26, 12); c.stroke();
      if (!st) {
        rr(c, sp.x - 36, sp.y + 34, 72, 28, 14); fs(c, 'rgba(15,10,40,.78)', 'rgba(255,255,255,.6)', 2);
        A.label(c, 'SIT HERE', sp.x, sp.y + 48, { size: 12, color: '#fff', stroke: false });
        rr(c, sp.x - 52, sp.y + 84, 104, 14, 7); fs(c, '#6b3a1e', OL, 2);
        sweep(c, sa.sweep, now, 34, 48, function (k, n) { return slotOfSeatCard(i, k, n); });
        continue;
      }
      // character behind its cards, then the rail in front of its body
      var look = lookOf(st.pid) || { skin: 'gim', body: '#9aa7bd' };
      A.drawGim(c, sp.x, sp.y + 84, look, { t: now + i, scale: 1.5, dir: 0, shadow: false, blink: ((now + i * 1.3) % 4) < 0.12, lookAt: { x: 0, y: 1 } });
      // chips on the circle (slide in from the player when placed)
      if (st.bet) {
        var cp = sa.chipT != null ? ease((now - sa.chipT) / 0.35) : 1, cx = sp.x, cy = sp.y - 32 + (1 - cp) * 60;
        var res = sa.res, rt = sa.resT != null ? (now - sa.resT) : 0;
        if (res === 'lose' || res === 'bust') { var lp = ease((rt - 0.6) / 0.5); cx += (DEALER.x - cx) * lp; cy += (150 - cy) * lp; if (lp < 1) chipStack(c, cx, cy, st.bet, 11); }
        else { chipStack(c, cx, cy, st.bet, 11); if (res === 'win' || res === 'bj') { var wp = ease((rt - 0.5) / 0.55); chipStack(c, DEALER.x + (sp.x + 26 - DEALER.x) * wp, 150 + (sp.y - 34 - 150) * wp, st.bet * (res === 'bj' ? 1.5 : 1), 11); } }
        A.label(c, '📜 ' + Number(st.bet).toLocaleString() + (st.dbl ? ' ×2' : ''), sp.x, sp.y - 8, { size: 10, color: '#fff', lw: 3 });
      }
      // cards held up in front of the character
      var n = sa.cards.length;
      sa.cards.forEach(function (cd, k) {
        var to = slotOfSeatCard(i, k, n);
        drawFlying(c, cd, to, now, 34, 48);
      });
      if (n) { // little hands gripping the fan
        var hb = A.baseHex(look.body);
        [-1, 1].forEach(function (s2) { circ(c, sp.x + s2 * (n * 9 + 5), sp.y + 80, 7.5); fs(c, hb, OL, 2.2); });
      }
      sweep(c, sa.sweep, now, 34, 48, function (k, nn) { return slotOfSeatCard(i, k, nn); });
      // rail
      rr(c, sp.x - 52, sp.y + 86, 104, 14, 7); fs(c, '#6b3a1e', OL, 2);
      A.label(c, (st.pid === me ? '⭐ ' : '') + st.nick, sp.x, sp.y + 93, { size: 10, color: st.pid === me ? '#ffd166' : '#fff', lw: 3, maxW: 98 });
      if (st.value) { rr(c, sp.x + 32, sp.y + 22, 30, 20, 10); fs(c, st.value > 21 ? '#c1121f' : '#120e2e', OL, 2); A.label(c, String(st.value), sp.x + 47, sp.y + 32, { size: 11, color: '#fff', stroke: false }); }
      if (sa.res) {
        var rp = Math.min(1, (now - sa.resT) / 0.3), lab = { win: 'WIN!', bj: 'BLACKJACK!', push: 'PUSH', lose: 'LOSE', bust: 'BUST' }[sa.res];
        c.save(); c.translate(sp.x, sp.y - 62); c.scale(0.6 + rp * 0.4, 0.6 + rp * 0.4);
        A.label(c, lab, 0, 0, { size: 17, color: sa.res === 'win' || sa.res === 'bj' ? '#2bd576' : sa.res === 'push' ? '#ffd166' : '#ff5c6c', lw: 5 }); c.restore();
      } else if (st.result === 'bust') A.label(c, 'BUST', sp.x, sp.y - 62, { size: 15, color: '#ff5c6c', lw: 5 });
      if (T.phase === 'play' && T.turn === i) { var bob = Math.sin(now * 6) * 3; A.label(c, st.pid === me ? '▼ YOUR TURN' : '▼ ' + st.nick, sp.x, sp.y - 82 + bob, { size: 11, color: '#ffd166', lw: 4, maxW: 120 }); }
    }
    // front rail of the table
    c.fillStyle = '#5a2d14'; c.fillRect(0, BH - 16, BW, 16);
  };
  function sweep(c, sw, now, w, h, slot) {
    if (!sw) return; var p = (now - sw.t0) / 0.45; if (p >= 1) return;
    sw.cards.forEach(function (cd, k) { var from = slot(k, sw.cards.length), e = ease(p); cardShape(c, from.x + (95 - from.x) * e, from.y + (82 - from.y) * e, w * (1 - e * 0.3), h * (1 - e * 0.3), from.rot * (1 - e), cd.c, -1 + 2 * (1 - e) > 0 ? 1 : -1); });
  }
  // Click on the scene → which seat (for sitting down)
  S.bjSeatAt = function (cv, ev) {
    var r = cv.getBoundingClientRect(), k = r.width / BW, x = (ev.clientX - r.left) / k, y = (ev.clientY - r.top) / k;
    for (var i = 0; i < 5; i++) { var s = SEAT[i]; if (Math.abs(x - s.x) < 56 && y > s.y - 50 && y < s.y + 100) return i; }
    return -1;
  };

  // ================================================================ ROULETTE
  var RW = 660, RH = 330;
  var WHEELN = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var WC = { x: 160, y: 182, R: 126, sq: 0.6 };
  var LAY = { x0: 330, zeroW: 26, x1: 648, y0: 70, rowH: 44, outH: 40 };
  function colOf(n) { return n === 0 ? '#1f9d55' : REDS.indexOf(n) >= 0 ? '#c1121f' : '#16161e'; }
  function cellRect(choice) {
    var cw = (LAY.x1 - LAY.x0 - LAY.zeroW) / 12, gx = LAY.x0 + LAY.zeroW;
    if (choice === '0' || choice === 'green') return { x: LAY.x0, y: LAY.y0, w: LAY.zeroW, h: LAY.rowH * 3 };
    if (/^\d+$/.test(choice)) { var n = +choice, col = Math.floor((n - 1) / 3), row = 2 - ((n - 1) % 3); return { x: gx + col * cw, y: LAY.y0 + row * LAY.rowH, w: cw, h: LAY.rowH }; }
    var outs = ['red', 'black', 'even', 'odd'], i = outs.indexOf(choice), ow = (LAY.x1 - gx) / 4;
    if (i >= 0) return { x: gx + i * ow, y: LAY.y0 + LAY.rowH * 3 + 6, w: ow, h: LAY.outH };
    return null;
  }
  var rlLast = { id: -1, sweepT: 0, res: null, resT: 0 };
  S.roulette = function (cv, R, view, now, me, lookOf, hover) {
    var P = prep(cv, RW, RH), c = P.c;
    felt(c, RW, RH, '#13804e');
    // ---- wheel (tilted): bowl, pockets, turret, ball
    var x = WC.x, y = WC.y, Rr = WC.R;
    c.save(); c.translate(x, y + 14); c.scale(1, WC.sq); circ(c, 0, 0, Rr + 18); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill(); c.restore();
    c.save(); c.translate(x, y); c.scale(1, WC.sq);
    circ(c, 0, 0, Rr + 16); fs(c, '#5a2d14', OL, 3);
    circ(c, 0, 0, Rr + 6); fs(c, '#3d1f0e', null);
    circ(c, 0, 0, Rr - 2); fs(c, '#8a5a2b', null); // ball track
    var rot = view.rot, s37 = TAU / 37;
    for (var i = 0; i < 37; i++) {
      var a0 = rot + i * s37, a1 = a0 + s37, n = WHEELN[i];
      c.beginPath(); c.arc(0, 0, Rr * 0.82, a0, a1); c.arc(0, 0, Rr * 0.6, a1, a0, true); c.closePath(); c.fillStyle = colOf(n); c.fill();
      c.strokeStyle = '#d4a63a'; c.lineWidth = 1; c.stroke();
      var am = a0 + s37 / 2; c.save(); c.translate(Math.cos(am) * Rr * 0.72, Math.sin(am) * Rr * 0.72); c.rotate(am + Math.PI / 2); c.fillStyle = '#fff'; c.font = '700 11px Fredoka, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), 0, 0); c.restore();
    }
    circ(c, 0, 0, Rr * 0.6); var cg = c.createRadialGradient(-10, -10, 4, 0, 0, Rr * 0.6); cg.addColorStop(0, '#c08552'); cg.addColorStop(1, '#6b3a1e'); fs(c, cg, OL, 2);
    for (var sp = 0; sp < 8; sp++) { var sa = rot + sp * TAU / 8; c.strokeStyle = 'rgba(255,209,102,.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(Math.cos(sa) * Rr * 0.18, Math.sin(sa) * Rr * 0.18); c.lineTo(Math.cos(sa) * Rr * 0.58, Math.sin(sa) * Rr * 0.58); c.stroke(); }
    c.restore();
    // turret (drawn upright so it reads as 3D)
    c.save(); c.translate(x, y);
    ell(c, 0, 0, 22, 13); fs(c, '#ffcf3f', OL, 2.5);
    rr(c, -6, -30, 12, 30, 4); fs(c, '#ffcf3f', OL, 2.5);
    [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(function (d) { var aa = rot + Math.atan2(d[1], d[0]); var ex = Math.cos(aa) * 24, ey = Math.sin(aa) * 24 * WC.sq; c.strokeStyle = OL; c.lineWidth = 6; c.beginPath(); c.moveTo(0, -24); c.lineTo(ex, ey - 24); c.stroke(); c.strokeStyle = '#ffcf3f'; c.lineWidth = 3; c.stroke(); circ(c, ex, ey - 24, 4.5); fs(c, '#ffe08a', OL, 1.8); });
    circ(c, 0, -32, 7); fs(c, '#ffe08a', OL, 2);
    c.restore();
    // ball
    var br = view.ballR != null ? view.ballR : 26, rad = Rr * (0.71 + (br - 20) / 6 * 0.21);
    if (view.spinning && view.p > 0.6 && view.p < 0.96) rad += Math.abs(Math.sin(now * 22)) * 7 * (1 - view.p);
    var bx = x + Math.cos(view.ball) * rad, by = y + Math.sin(view.ball) * rad * WC.sq;
    circ(c, bx + 1.5, by + 3, 7); c.fillStyle = 'rgba(0,0,0,.3)'; c.fill();
    circ(c, bx, by, 7); var bg = c.createRadialGradient(bx - 2, by - 2, 1, bx, by, 7); bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#c9d1e0'); fs(c, bg, OL, 1.8);
    // croupier behind the layout
    A.drawGim(c, 560, 64, A.NPC.croupier, { t: now, scale: 1.05, shadow: false, blink: (now % 4.3) < 0.12, lookAt: { x: x - 560, y: 80 } });
    // ---- betting layout
    var g0 = LAY.x0 + LAY.zeroW, cw = (LAY.x1 - g0) / 12;
    var zr = cellRect('0'); rr(c, zr.x, zr.y, zr.w, zr.h, 8); fs(c, '#1f9d55', '#fff', 1.6); A.label(c, '0', zr.x + zr.w / 2, zr.y + zr.h / 2, { size: 14, stroke: false });
    for (var n2 = 1; n2 <= 36; n2++) { var r = cellRect(String(n2)); c.fillStyle = colOf(n2); c.fillRect(r.x, r.y, r.w, r.h); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.2; c.strokeRect(r.x, r.y, r.w, r.h); A.label(c, String(n2), r.x + r.w / 2, r.y + r.h / 2 + 1, { size: 12, stroke: false }); }
    [['red', 'RED', '#c1121f'], ['black', 'BLACK', '#16161e'], ['even', 'EVEN', 'rgba(0,0,0,.18)'], ['odd', 'ODD', 'rgba(0,0,0,.18)']].forEach(function (o) { var r2 = cellRect(o[0]); rr(c, r2.x + 2, r2.y, r2.w - 4, r2.h, 8); fs(c, o[2], '#fff', 1.6); A.label(c, o[1], r2.x + r2.w / 2, r2.y + r2.h / 2, { size: 12, stroke: false }); });
    if (hover) { var hr = cellRect(hover); if (hr) { c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(hr.x, hr.y, hr.w, hr.h); } }
    // winning number marker ("dolly")
    var showRes = R && R.phase === 'bet' && view.res != null && view.rel != null && (R.until - SC.now()) > 11000;
    if (showRes) {
      var wr = cellRect(String(view.res)), pulse = 1 + Math.sin(now * 8) * 0.08;
      c.save(); c.shadowColor = '#ffd166'; c.shadowBlur = 16; c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.strokeRect(wr.x + 1, wr.y + 1, wr.w - 2, wr.h - 2); c.restore();
      c.save(); c.translate(wr.x + wr.w / 2, wr.y + 6); c.scale(pulse, pulse); rr(c, -7, -16, 14, 18, 4); fs(c, '#fff', OL, 2); circ(c, 0, -18, 6); fs(c, '#ffd166', OL, 2); c.restore();
      A.label(c, view.res + ' ' + (view.res === 0 ? 'GREEN' : REDS.indexOf(view.res) >= 0 ? 'RED' : 'BLACK'), x, 26, { size: 22, color: view.res === 0 ? '#2bd576' : REDS.indexOf(view.res) >= 0 ? '#ff5c6c' : '#fff', lw: 5 });
    }
    // chips (each player's in their own body color), stacked per cell
    var bets = (R && R.bets) || [], per = {};
    bets.forEach(function (b) { var k = b.choice + '|' + b.pid; per[k] = per[k] || { choice: b.choice, pid: b.pid, nick: b.nick, amt: 0 }; per[k].amt += b.amt; });
    var byCell = {};
    Object.keys(per).forEach(function (k) { var e = per[k]; (byCell[e.choice] = byCell[e.choice] || []).push(e); });
    Object.keys(byCell).forEach(function (ch) {
      var r3 = cellRect(ch); if (!r3) return;
      byCell[ch].forEach(function (e, j) {
        var tint = SC.pidColor(e.pid);
        var cx = r3.x + r3.w / 2 + (j % 3 - 1) * 7, cy = r3.y + r3.h / 2 + 8 - Math.floor(j / 3) * 6;
        var won = showRes && (+ch === view.res || (ch === 'red' && REDS.indexOf(view.res) >= 0) || (ch === 'black' && view.res !== 0 && REDS.indexOf(view.res) < 0) || (ch === 'even' && view.res !== 0 && view.res % 2 === 0) || (ch === 'odd' && view.res % 2 === 1) || (ch === 'green' && view.res === 0));
        if (showRes && !won) return; // losing chips were raked
        if (won) cy -= Math.abs(Math.sin(now * 6 + j)) * 5;
        var top = chipStack(c, cx, cy, e.amt, 8, tint);
        if (e.pid === me) { c.fillStyle = '#ffd166'; circ(c, cx, top - 9, 2.5); c.fill(); }
      });
    });
    // rake sweep after a spin
    if (R && R.phase === 'spin' && view.p > 0.98) { /* resolved next frame by result */ }
    var spinning = R && R.phase === 'spin';
    A.label(c, spinning ? 'NO MORE BETS' : 'Click the table to bet', LAY.x0 + (LAY.x1 - LAY.x0) / 2, LAY.y0 + LAY.rowH * 3 + LAY.outH + 26, { size: 12, color: spinning ? '#ff9bd6' : 'rgba(255,255,255,.7)', stroke: spinning, lw: 3 });
  };
  S.roulCellAt = function (cv, ev) {
    var r = cv.getBoundingClientRect(), k = r.width / RW, x = (ev.clientX - r.left) / k, y = (ev.clientY - r.top) / k;
    var list = ['0', 'red', 'black', 'even', 'odd']; for (var n = 1; n <= 36; n++) list.push(String(n));
    for (var i = 0; i < list.length; i++) { var rc = cellRect(list[i]); if (rc && x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h) return list[i]; }
    return null;
  };
})();
