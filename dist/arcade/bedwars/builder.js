/* ============================================================
   ScrollHub Games — Map Builder. Paint ground, blocks, props and spleef floors,
   place spawns / beds / generators / shops / flags / hiding spots, mirror
   everything with symmetry, test-play against bots and add maps to a game's
   rotation. Only the map maker's account can save (the server checks).
   ============================================================ */
(function () {
  'use strict';
  var B = window.BW, M = window.MG, D = window.BWD, SC = window.SC, A = SC.art;
  var T = B.T, W = B.W, H = B.H, N = W * H, G = B.G, TAU = Math.PI * 2;
  var $ = function (id) { return document.getElementById(id); };
  var cv = $('cv'), c = cv.getContext('2d');
  var touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function now() { return performance.now(); }
  function teamCol(t) { return (B.TEAMS[t] || B.TEAMS[0]).color; }
  var toastT = 0;
  function toast(msg, ms) { var el = $('toast'); el.innerHTML = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, ms || 1800); }

  // ------------------------------------------------------------------ editable map
  var E = null;
  var MK_TEAM = ['sp', 'bed', 'tg', 'shop', 'up', 'flag'], MK_LIST = ['dia', 'em', 'pick', 'hs', 'seek'];
  function emptyE(game) { var e = { id: null, game: game, name: '', g: new Uint8Array(N), w: new Uint8Array(N), wc: new Uint8Array(N), f: new Uint8Array(N), fc: new Uint8Array(N), prop: new Uint8Array(N), L: [], mk: {} }; for (var z = 0; z < M.SP_LAYERS; z++) e.L.push(new Uint8Array(N)); MK_TEAM.concat(MK_LIST).forEach(function (k) { e.mk[k] = []; }); return e; }
  function fromCm(cm) {
    var e = emptyE(cm.game); e.id = cm.id || null; e.name = cm.name || '';
    e.g = M.unrle(cm.g);
    (cm.w || []).forEach(function (q) { e.w[q[0]] = q[1]; e.wc[q[0]] = q[2] || 0; });
    (cm.f || []).forEach(function (q) { e.f[q[0]] = q[1]; e.fc[q[0]] = q[2] || 0; });
    (cm.props || []).forEach(function (q) { var k = M.PROP_KINDS.indexOf(q[1]); if (k >= 0) e.prop[q[0]] = k + 1; });
    if (cm.L) cm.L.forEach(function (s, z) { if (z < M.SP_LAYERS) e.L[z] = M.unrle(s); });
    var mk = cm.mk || {}; MK_TEAM.concat(MK_LIST).forEach(function (k) { e.mk[k] = (mk[k] || []).map(function (q) { return Array.isArray(q) ? q.slice() : q; }); });
    return e;
  }
  function toCm(e) {
    var cm = { v: 1, id: e.id || undefined, game: e.game, name: e.name, g: M.rle(e.g), w: [], f: [], props: [], mk: {} };
    for (var i = 0; i < N; i++) { if (e.w[i]) cm.w.push([i, e.w[i], e.wc[i]]); if (e.f[i]) cm.f.push([i, e.f[i], e.fc[i]]); if (e.prop[i]) cm.props.push([i, M.PROP_KINDS[e.prop[i] - 1]]); }
    if (e.game === 'spleef') cm.L = e.L.map(function (L) { return M.rle(L); });
    var need = { bw: ['sp', 'bed', 'tg', 'shop', 'up', 'dia', 'em'], ctf: ['sp', 'flag', 'pick'], spleef: ['sp'], hide: ['hs', 'seek'] }[e.game];
    need.forEach(function (k) { cm.mk[k] = e.mk[k]; });
    return cm;
  }
  function snap() { return { game: E.game, name: E.name, id: E.id, g: E.g.slice(), w: E.w.slice(), wc: E.wc.slice(), f: E.f.slice(), fc: E.fc.slice(), prop: E.prop.slice(), L: E.L.map(function (l) { return l.slice(); }), mk: JSON.parse(JSON.stringify(E.mk)) }; }
  var undo = [], redo = [];
  function pushUndo() { undo.push(snap()); if (undo.length > 60) undo.shift(); redo.length = 0; }
  function doUndo() { if (!undo.length) return; redo.push(snap()); E = undo.pop(); afterLoad(); toast('Undone', 700); }
  function doRedo() { if (!redo.length) return; undo.push(snap()); E = redo.pop(); afterLoad(); toast('Redone', 700); }

  // ------------------------------------------------------------------ palette
  var GROUND = [
    { id: 'g0', v: 0, name: 'Void (erase)', ic: 'void' }, { id: 'g1', v: G.GRASS, name: 'Grass' }, { id: 'g2', v: G.STONE, name: 'Stone' }, { id: 'g3', v: G.MID, name: 'Crystal' },
    { id: 'g4', v: G.PATH, name: 'Planks' }, { id: 'g7', v: G.COBBLE, name: 'Cobble' }, { id: 'g8', v: G.FLOOR, name: 'Wood floor' }, { id: 'g9', v: G.SNOW, name: 'Snow' }, { id: 'g10', v: G.ICE, name: 'Ice' }, { id: 'g11', v: G.CANDY, name: 'Candy stripes' }, { id: 'g12', v: G.SAND, name: 'Sand' }, { id: 'g13', v: G.BRICK, name: 'Red brick' },
    { id: 'g6', v: G.PAD, name: 'Team pad' }, { id: 'g5', v: G.ROCK, name: 'Rock pillar' }];
  var BLOCKS = [
    { id: 'w1', b: 1, mode: 'w', name: 'Wool wall', team: true }, { id: 'w2', b: 2, mode: 'w', name: 'Plank wall' }, { id: 'w3', b: 3, mode: 'w', name: 'End stone wall' }, { id: 'w4', b: 4, mode: 'w', name: 'Obsidian wall' },
    { id: 'f1', b: 1, mode: 'f', name: 'Wool bridge', team: true }, { id: 'f2', b: 2, mode: 'f', name: 'Plank bridge' }, { id: 'f3', b: 3, mode: 'f', name: 'End stone bridge' }, { id: 'bx', mode: 'x', name: 'Erase blocks', ic: 'erase' }];
  var PROPS = M.PROP_KINDS.map(function (k) { return { id: 'p' + k, prop: k, name: M.PROPS[k].name }; }).concat([{ id: 'px', prop: '', name: 'Erase props', ic: 'erase' }]);
  var MARKERS = {
    bw: [{ id: 'm_sp', mk: 'sp', name: 'Spawn', team: true }, { id: 'm_bed', mk: 'bed', name: 'Bed', team: true }, { id: 'm_tg', mk: 'tg', name: 'Generator', team: true }, { id: 'm_shop', mk: 'shop', name: 'Item Shop', team: true }, { id: 'm_up', mk: 'up', name: 'Upgrades', team: true }, { id: 'm_dia', mk: 'dia', name: 'Diamond gen' }, { id: 'm_em', mk: 'em', name: 'Emerald gen' }, { id: 'mx', mk: 'x', name: 'Erase marker', ic: 'erase' }],
    ctf: [{ id: 'm_sp', mk: 'sp', name: 'Spawn', team: true }, { id: 'm_flag', mk: 'flag', name: 'Flag', team: true }, { id: 'm_pick', mk: 'pick', name: 'Pickup spot' }, { id: 'mx', mk: 'x', name: 'Erase marker', ic: 'erase' }],
    spleef: [{ id: 'm_sp', mk: 'sp', name: 'Spawn' }, { id: 'mx', mk: 'x', name: 'Erase marker', ic: 'erase' }],
    hide: [{ id: 'm_hs', mk: 'hs', name: 'Hider spawn' }, { id: 'm_seek', mk: 'seek', name: 'Seeker cage' }, { id: 'mx', mk: 'x', name: 'Erase marker', ic: 'erase' }],
  };
  var FLOORS = [{ id: 'L1', floor: 1, name: 'Floor tile' }, { id: 'L0', floor: 0, name: 'Erase tile', ic: 'erase' }];
  var TABS = { ground: GROUND, blocks: BLOCKS, props: PROPS, markers: null, floors: FLOORS };
  var S = { tool: 'brush', size: 1, sym: 'off', tab: 'ground', item: GROUND[1], team: 0, dir: -1, layer: 0, grid: true, hover: -1, dragA: -1, dragB: -1, dirty: false };

  function palIcon(it) {
    var x = document.createElement('canvas'); x.width = x.height = 88; var g = x.getContext('2d'); g.translate(44, 50);
    try {
      if (it.ic === 'erase') { g.font = '700 44px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it.id === 'g0' ? 'X' : '', 0, 0); }
      else if (it.ic === 'void') { g.fillStyle = '#120c33'; g.fillRect(-28, -28, 56, 56); g.strokeStyle = '#ff5c6c'; g.lineWidth = 5; g.strokeRect(-28, -28, 56, 56); }
      else if (it.v != null) { var m = { g: new Uint8Array(N), bases: [] }; m.g[37 * W + 37] = it.v; var ch = D.chunk(m, 3, 3); if (ch) g.drawImage(ch, (37 - 36) * T, (37 - 36) * T, T, T + 30, -28, -28, 56, 66); if (it.v === G.ROCK) D.rock(g, 0, 26, 0); D.resetChunks(); }
      else if (it.b) { g.scale(1.6, 1.6); D.drawItem(g, ['', 'wool', 'wood', 'end', 'obby'][it.b], 1, { team: S.team }); }
      else if (it.prop) { g.translate(0, 26); g.scale(1.2, 1.2); D.prop(g, it.prop, 0, 0, 0, { face: true }); }
      else if (it.floor) { D.spTile(g, M.SP.kinds[S.layer], -20, -24, 1, true); }
      else if (it.mk) drawMarkerIcon(g, it);
    } catch (e) { }
    return x;
  }
  function drawMarkerIcon(g, it) {
    var k = it.mk, tc = teamCol(S.team);
    if (k === 'sp' || k === 'hs') { g.translate(0, 26); g.scale(1.3, 1.3); A.drawGim(g, 0, 0, { skin: 'gim', body: k === 'hs' ? '#2bd576' : tc }, { t: 0, dir: 0 }); }
    else if (k === 'bed') { g.scale(0.8, 0.8); D.bed(g, { team: S.team, x: 0, y: 10, dir: [0, 1] }, 0, false); }
    else if (k === 'tg') { D.res(g, 'iron', -10, 0, 1.6); D.res(g, 'gold', 12, 2, 1.6); }
    else if (k === 'shop' || k === 'up') { g.translate(0, 22); g.scale(1.1, 1.1); D.npc(g, { kind: k, x: 0, y: 0 }, 0, false); }
    else if (k === 'dia' || k === 'em') D.res(g, k, 0, 0, 2.6);
    else if (k === 'flag') { g.translate(-8, 30); D.flag(g, 0, 0, S.team, 0); }
    else if (k === 'pick') { D.drawItem(g, 'gapple', 1.6); }
    else if (k === 'seek') { g.font = '700 46px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('x', 0, 0); }
  }
  function tabsFor(game) { var t = [['ground', 'Ground'], ['blocks', 'Blocks'], ['props', 'Props'], ['markers', 'Markers']]; if (game === 'spleef') t.splice(1, 0, ['floors', 'Floors']); return t; }
  function renderSide() {
    $('tabs').innerHTML = tabsFor(E.game).map(function (q) { return '<button data-tab="' + q[0] + '"' + (q[0] === S.tab ? ' class="on"' : '') + '>' + q[1] + '</button>'; }).join('');
    var list = S.tab === 'markers' ? MARKERS[E.game] : TABS[S.tab];
    if (!list) { S.tab = 'ground'; list = GROUND; }
    if (list.indexOf(S.item) < 0) S.item = list[S.tab === 'ground' ? 1 : 0];
    var pal = $('pal'); pal.innerHTML = '';
    list.forEach(function (it) { var d = document.createElement('div'); d.className = 'pi' + (it === S.item ? ' on' : ''); d.appendChild(palIcon(it)); var s = document.createElement('span'); s.textContent = it.name; d.appendChild(s); d.onclick = function () { S.item = it; if (S.tool === 'pick' || S.tool === 'pan') setTool('brush'); renderSide(); }; pal.appendChild(d); });
    var nT = E.game === 'ctf' ? 2 : 4, needTeam = S.item.team;
    $('teamRow').classList.toggle('hidden', !needTeam);
    $('teams').innerHTML = needTeam ? Array.from({ length: nT }, function (_, t) { return '<button data-team="' + t + '" style="background:' + teamCol(t) + '"' + (t === S.team ? ' class="on"' : '') + '></button>'; }).join('') : '';
    $('rotDir').classList.toggle('hidden', S.item.mk !== 'bed');
    $('layerRow').classList.toggle('hidden', E.game !== 'spleef');
    $('layerSeg').innerHTML = M.SP.kinds.map(function (k, z) { return '<button data-z="' + z + '"' + (z === S.layer ? ' class="on"' : '') + '>' + (z + 1) + '</button>'; }).join('');
    [].forEach.call($('gameSeg').children, function (b) { b.classList.toggle('on', b.dataset.g === E.game); });
    [].forEach.call($('tools').children, function (b) { b.classList.toggle('on', b.dataset.t === S.tool); });
    [].forEach.call($('sizes').children, function (b) { b.classList.toggle('on', +b.dataset.s === S.size); });
    [].forEach.call($('symSeg').children, function (b) { b.classList.toggle('on', b.dataset.y === S.sym); });
  }
  function setTool(t) { S.tool = t; renderSide(); }

  // ------------------------------------------------------------------ editing
  function ix(x, y) { return y * W + x; }
  function inb(x, y) { return x >= 1 && y >= 1 && x < W - 1 && y < H - 1; }
  // symmetric copies of a tile: [{x, y, k (rotation/mirror index), mx, my}]
  function symPts(x, y) {
    var o = [{ x: x, y: y, k: 0 }];
    if (S.sym === 'x' || S.sym === '4') o.push({ x: W - 1 - x, y: y, k: 1, mx: 1 });
    if (S.sym === 'y' || S.sym === '4') o.push({ x: x, y: H - 1 - y, k: 2, my: 1 });
    if (S.sym === '4') o.push({ x: W - 1 - x, y: H - 1 - y, k: 3, mx: 1, my: 1 });
    if (S.sym === 'rot') { var px = x, py = y; for (var r = 1; r < 4; r++) { var nx = W - 1 - py, ny = px; px = nx; py = ny; o.push({ x: px, y: py, k: r, rot: r }); } }
    var seen = {}; return o.filter(function (p) { var key = p.x + ',' + p.y; if (seen[key]) return false; seen[key] = 1; return true; });
  }
  function dropChunksAround(i) { var x = i % W, y = (i / W) | 0; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var tx = x + dx, ty = y + dy; if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue; D.dropChunk(Math.floor(tx / D.CH), Math.floor(ty / D.CH)); } }
  function removeMarkerAt(i) { var hit = false; MK_TEAM.forEach(function (k) { var L = E.mk[k]; for (var j = L.length - 1; j >= 0; j--) { var mi = L[j][1]; if (mi === i || (k === 'bed' && mi + M.DIRS[L[j][2] & 3][1] * W + M.DIRS[L[j][2] & 3][0] === i)) { L.splice(j, 1); hit = true; } } }); MK_LIST.forEach(function (k) { var L = E.mk[k]; for (var j = L.length - 1; j >= 0; j--) if (L[j] === i) { L.splice(j, 1); hit = true; } }); return hit; }
  function defaultBedDir(x, y) { var dx = 36 - x, dy = 36 - y; return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3); }
  function mapTeam(t, p) {
    if (!p.k) return t;
    if (p.rot) return E.game === 'bw' ? (t + p.rot) % 4 : -1;
    if (E.game === 'ctf' && (p.mx || p.my) && !(p.mx && p.my)) return 1 - t;
    if (E.game === 'bw' && p.mx && !p.my) return t === 1 ? 3 : t === 3 ? 1 : -1;
    if (E.game === 'bw' && p.my && !p.mx) return t === 0 ? 2 : t === 2 ? 0 : -1;
    return -1;
  }
  function mapDir(d, p) { if (p.rot) return (d + p.rot) % 4; if (p.mx && (d === 0 || d === 2)) d = 2 - d; if (p.my && (d === 1 || d === 3)) d = 4 - d; return d; }
  // Apply the current item to one tile (no symmetry; `p` describes which mirror copy this is).
  function applyAt(x, y, p) {
    if (!inb(x, y)) return;
    var i = ix(x, y), it = S.item;
    if (it.v != null) { if (E.g[i] === it.v) return; E.g[i] = it.v; if (it.v === 0 || it.v === G.ROCK) { E.w[i] = 0; E.prop[i] = 0; } dropChunksAround(i); }
    else if (it.mode === 'w') { if (!E.g[i] && !E.f[i]) return; E.w[i] = it.b; E.wc[i] = it.team ? S.team : 0; E.prop[i] = 0; }
    else if (it.mode === 'f') { if (E.g[i]) return; E.f[i] = it.b; E.fc[i] = it.team ? S.team : 0; }
    else if (it.mode === 'x') { E.w[i] = 0; E.f[i] = 0; }
    else if (it.prop != null) { if (it.prop) { if (!E.g[i] || E.g[i] === G.ROCK) return; E.prop[i] = M.PROP_KINDS.indexOf(it.prop) + 1; E.w[i] = 0; } else E.prop[i] = 0; }
    else if (it.floor != null) { E.L[S.layer][i] = it.floor; }
    else if (it.mk) placeMarker(x, y, i, p);
    S.dirty = true;
  }
  function placeMarker(x, y, i, p) {
    var k = S.item.mk;
    if (k === 'x') { removeMarkerAt(i); return; }
    if (MK_TEAM.indexOf(k) >= 0 && S.item.team !== false && (S.item.team || k === 'sp')) {
      if (E.game === 'spleef') { if (!E.mk.sp.some(function (q) { return q[1] === i; }) && E.mk.sp.length < 8) { removeMarkerAt(i); E.mk.sp.push([E.mk.sp.length, i]); } return; }
      var t = mapTeam(S.team, p); if (t < 0) return;
      removeMarkerAt(i);
      E.mk[k] = E.mk[k].filter(function (q) { return q[0] !== t; });
      if (k === 'bed') { var d = mapDir(S.dir >= 0 ? S.dir : defaultBedDir(x, y), p), hd = M.DIRS[d]; if (!inb(x + hd[0], y + hd[1])) return; removeMarkerAt(ix(x + hd[0], y + hd[1])); E.mk.bed.push([t, i, d]); }
      else E.mk[k].push([t, i]);
      return;
    }
    if (k === 'seek') { E.mk.seek = [i]; return; }
    if (E.mk[k].indexOf(i) < 0) { removeMarkerAt(i); E.mk[k].push(i); }
  }
  function applyBrush(x, y) {
    var r = S.size, h = Math.floor((r - 1) / 2), isMk = !!S.item.mk;
    for (var dy = 0; dy < (isMk ? 1 : r); dy++) for (var dx = 0; dx < (isMk ? 1 : r); dx++) {
      var tx = x - h + dx, ty = y - h + dy;
      symPts(tx, ty).forEach(function (p) { applyAt(p.x, p.y, p); });
    }
  }
  function applyRect(a, b) {
    var x0 = Math.min(a % W, b % W), x1 = Math.max(a % W, b % W), y0 = Math.min((a / W) | 0, (b / W) | 0), y1 = Math.max((a / W) | 0, (b / W) | 0);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) symPts(x, y).forEach(function (p) { applyAt(p.x, p.y, p); });
  }
  function layerArr() { return S.item.floor != null ? E.L[S.layer] : E.g; }
  function applyFill(x0, y0) {
    var arr = layerArr(), start = ix(x0, y0), from = arr[start], seen = new Uint8Array(N), q = [start], out = [];
    seen[start] = 1;
    while (q.length && out.length < N) { var i = q.pop(); out.push(i); var x = i % W, y = (i / W) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = x + d[0], ny = y + d[1]; if (!inb(nx, ny)) return; var j = ix(nx, ny); if (seen[j] || arr[j] !== from) return; seen[j] = 1; q.push(j); }); }
    out.forEach(function (i2) { symPts(i2 % W, (i2 / W) | 0).forEach(function (p) { applyAt(p.x, p.y, p); }); });
  }
  function eyedrop(i) {
    if (E.prop[i]) { var pk = M.PROP_KINDS[E.prop[i] - 1]; S.tab = 'props'; S.item = PROPS.filter(function (q) { return q.prop === pk; })[0]; }
    else if (E.w[i]) { S.tab = 'blocks'; S.item = BLOCKS.filter(function (q) { return q.mode === 'w' && q.b === E.w[i]; })[0]; if (E.w[i] === 1) S.team = E.wc[i]; }
    else { S.tab = 'ground'; S.item = GROUND.filter(function (q) { return q.v === E.g[i]; })[0] || GROUND[1]; }
    setTool('brush'); toast('Picked ' + S.item.name, 900);
  }

  // ------------------------------------------------------------------ camera & input
  var cam = { x: 36 * T, y: 36 * T, z: 0.7 }, dpr = 1;
  function resize() { dpr = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  addEventListener('resize', resize); resize();
  function toWorld(sx, sy) { return { x: cam.x + (sx - innerWidth / 2) / cam.z, y: cam.y + (sy - innerHeight / 2) / cam.z }; }
  function tileAt(sx, sy) { var w = toWorld(sx, sy), tx = Math.floor(w.x / T), ty = Math.floor(w.y / T); return inb(tx, ty) ? ix(tx, ty) : -1; }
  var ptrs = {}, mode = null, last = null, pinch = null, keys = {};
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(ptrs);
    if (ids.length === 2) { if (mode === 'paint' && undo.length) { /* second finger: cancel the stroke */ E = undo.pop(); afterLoad(); } mode = 'pinch'; var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, camx: cam.x, camy: cam.y }; return; }
    if (e.button === 2 || e.button === 1 || keys[' '] || S.tool === 'pan') { mode = 'pan'; last = { x: e.clientX, y: e.clientY }; return; }
    var i = tileAt(e.clientX, e.clientY); if (i < 0) return;
    if (S.tool === 'pick') { eyedrop(i); return; }
    pushUndo();
    if (S.tool === 'fill') { applyFill(i % W, (i / W) | 0); changed(); mode = null; return; }
    if (S.tool === 'rect') { mode = 'rect'; S.dragA = S.dragB = i; return; }
    mode = 'paint'; applyBrush(i % W, (i / W) | 0); S.lastPaint = i; changed();
  });
  cv.addEventListener('pointermove', function (e) {
    if (ptrs[e.pointerId]) { ptrs[e.pointerId].x = e.clientX; ptrs[e.pointerId].y = e.clientY; }
    S.hover = tileAt(e.clientX, e.clientY); hoverInfo();
    if (mode === 'pinch') { var ids = Object.keys(ptrs); if (ids.length < 2) return; var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y); cam.z = Math.max(0.25, Math.min(2.2, pinch.z * d / pinch.d)); var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; cam.x = pinch.camx - (mx - pinch.cx) / cam.z; cam.y = pinch.camy - (my - pinch.cy) / cam.z; return; }
    if (mode === 'pan') { cam.x -= (e.clientX - last.x) / cam.z; cam.y -= (e.clientY - last.y) / cam.z; last = { x: e.clientX, y: e.clientY }; return; }
    if (mode === 'rect') { if (S.hover >= 0) S.dragB = S.hover; return; }
    if (mode === 'paint' && S.hover >= 0 && S.hover !== S.lastPaint) {
      // fill in the line between samples so fast strokes don't leave gaps
      var a2 = S.lastPaint, ax = a2 % W, ay = (a2 / W) | 0, bx = S.hover % W, by = (S.hover / W) | 0, n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      if (!S.item.mk) for (var k = 1; k <= n; k++) applyBrush(Math.round(ax + (bx - ax) * k / n), Math.round(ay + (by - ay) * k / n));
      S.lastPaint = S.hover; changed();
    }
  });
  function endPtr(e) {
    delete ptrs[e.pointerId];
    if (mode === 'rect') { applyRect(S.dragA, S.dragB); S.dragA = S.dragB = -1; changed(); }
    if (!Object.keys(ptrs).length) mode = null; else if (mode === 'pinch') mode = 'pan', last = ptrs[Object.keys(ptrs)[0]];
  }
  cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('wheel', function (e) { e.preventDefault(); var before = toWorld(e.clientX, e.clientY); cam.z = Math.max(0.25, Math.min(2.2, cam.z * (e.deltaY > 0 ? 0.88 : 1.14))); var after = toWorld(e.clientX, e.clientY); cam.x += before.x - after.x; cam.y += before.y - after.y; }, { passive: false });
  addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    var k = e.key.toLowerCase(); keys[k] = true;
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); doRedo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { e.preventDefault(); save(); return; }
    if (k === 'b') setTool('brush'); if (k === 'r') setTool('rect'); if (k === 'f') setTool('fill'); if (k === 'i') setTool('pick'); if (k === 'h') setTool('pan');
    if (k === 'g') { S.grid = !S.grid; }
    if (k === '[') { S.size = [1, 1, 2, 3, 3, 5][S.size] || 1; renderSide(); } if (k === ']') { S.size = { 1: 2, 2: 3, 3: 5, 5: 5 }[S.size]; renderSide(); }
    if (/^[1-4]$/.test(k)) { S.team = Math.min(+k - 1, E.game === 'ctf' ? 1 : 3); renderSide(); }
    if (k === 'q') rotBed();
    if (k === ' ') e.preventDefault();
    var pan = 40 / cam.z; if (k === 'arrowleft') cam.x -= pan; if (k === 'arrowright') cam.x += pan; if (k === 'arrowup') cam.y -= pan; if (k === 'arrowdown') cam.y += pan;
  });
  addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
  function rotBed() { S.dir = ((S.dir < 0 ? 1 : S.dir) + 1) % 4; toast('Bed faces ' + ['→', '↓', '←', '↑'][S.dir], 800); }

  // ------------------------------------------------------------------ UI wiring
  $('tools').onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) setTool(b.dataset.t); };
  $('sizes').onclick = function (e) { var b = e.target.closest('[data-s]'); if (b) { S.size = +b.dataset.s; renderSide(); } };
  $('symSeg').onclick = function (e) { var b = e.target.closest('[data-y]'); if (b) { S.sym = b.dataset.y; renderSide(); if (S.sym === 'rot') toast('⟳ 4-way rotation — great for Bedwars. Team markers copy to all 4 teams!', 2600); if ((S.sym === 'x') && E.game === 'ctf') toast('↔ Mirror — red markers copy to blue automatically', 2400); } };
  $('tabs').onclick = function (e) { var b = e.target.closest('[data-tab]'); if (b) { S.tab = b.dataset.tab; S.item = null; renderSide(); } };
  $('teams').onclick = function (e) { var b = e.target.closest('[data-team]'); if (b) { S.team = +b.dataset.team; renderSide(); } };
  $('layerSeg').onclick = function (e) { var b = e.target.closest('[data-z]'); if (b) { S.layer = +b.dataset.z; renderSide(); } };
  $('rotDir').onclick = rotBed;
  $('sideTog').onclick = function () { $('side').classList.toggle('mini'); };
  $('gameSeg').onclick = function (e) { var b = e.target.closest('[data-g]'); if (!b || b.dataset.g === E.game) return; pushUndo(); E.game = b.dataset.g; if (E.game === 'spleef' && !E.L[0].some(Boolean)) { var bl = fromCm(M.blankCustom('spleef')); E.L = bl.L; } S.tab = 'ground'; afterLoad(); toast('This map is now for ' + M.GAMES[E.game].name + '. Place its markers from Markers', 2400); };
  $('name').oninput = function () { E.name = this.value; S.dirty = true; validate(); };
  $('undo').onclick = doUndo; $('redo').onclick = doRedo;
  $('grid').onclick = function () { S.grid = !S.grid; };
  $('status').onclick = function () { $('probs').classList.toggle('hidden'); };
  $('save').onclick = function () { save(); };
  $('test').onclick = function () { save(function (id) { if (S.problems.length) { toast('Fix the problems first (tap the yellow badge)', 2400); $('probs').classList.remove('hidden'); return; } window.open('/arcade?test=' + id + '&g=' + E.game, '_blank'); toast('▶ Opening a practice match on your map…', 2000); }); };
  $('openMaps').onclick = function () { send({ t: 'mb', a: 'list' }); $('maps').classList.remove('hidden'); };
  [].forEach.call(document.querySelectorAll('[data-x]'), function (b) { b.onclick = function () { b.closest('.modal').classList.add('hidden'); }; });
  var newGame = 'bw';
  $('newGame').onclick = function (e) { var b = e.target.closest('[data-g]'); if (!b) return; newGame = b.dataset.g; [].forEach.call(this.children, function (x) { x.classList.toggle('on', x === b); }); };
  function confirmLose() { return !S.dirty || confirm('Throw away unsaved changes?'); }
  $('newBlank').onclick = function () { if (!confirmLose()) return; loadCm(M.blankCustom(newGame)); $('maps').classList.add('hidden'); toast('New ' + M.GAMES[newGame].name + ' map', 1400); };
  $('newCopy').onclick = function () { if (!confirmLose()) return; var cm = M.toCustom(newGame, (Math.random() * 1e6) | 0); cm.name = M.GAMES[newGame].name + ' remix'; loadCm(cm); $('maps').classList.add('hidden'); toast('Copied the built-in ' + M.GAMES[newGame].name + ' map — make it yours!', 2200); };

  // ------------------------------------------------------------------ validation, saving, loading
  S.problems = [];
  var vT = 0;
  function changed() { S.dirty = true; clearTimeout(vT); vT = setTimeout(validate, 250); try { localStorage.setItem('sh_builder_draft', JSON.stringify(toCm(E))); } catch (e) {} }
  function validate() {
    S.problems = M.validateCustom(toCm(E));
    var st = $('status'); st.className = S.problems.length ? 'bad' : 'ok';
    st.textContent = S.problems.length ? '' + S.problems.length + ' to fix' : 'Ready to play';
    $('probs').innerHTML = '<h4>' + (S.problems.length ? 'Before this map can be played:' : 'This map is ready!') + '</h4>' + (S.problems.length ? '<ul>' + S.problems.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' : '<div class="hint">Save it, test it ▶, then add it to the rotation in Maps.</div>');
  }
  function afterLoad() { D.resetChunks(); $('name').value = E.name || ''; renderSide(); validate(); }
  function loadCm(cm) { E = fromCm(cm); undo.length = 0; redo.length = 0; S.dirty = false; S.tab = 'ground'; S.item = null; afterLoad(); cam.x = 36 * T; cam.y = 36 * T; }
  var saveCb = null;
  function save(cb) {
    if (!S.mapper && !S.maker) { toast('Sign in to send maps', 2000); return; }
    if (!E.name.trim()) { E.name = M.GAMES[E.game].name + ' map'; $('name').value = E.name; }
    saveCb = cb || null; send({ t: 'mb', a: 'save', map: toCm(E) }); toast(S.mapper ? 'Saving…' : 'Sending…', 900);
  }
  function renderMaps(list, rot) {
    $('defRot').innerHTML = !S.mapper ? '' : ['bw', 'ctf', 'spleef', 'hide'].map(function (g) { return '<label class="sw"><input type="checkbox" data-def="' + g + '"' + (rot[g] && rot[g].def ? ' checked' : '') + '> ' + M.GAMES[g].icon + ' ' + M.GAMES[g].name + '</label>'; }).join(' ');
    $('mapList').innerHTML = list.length ? list.map(function (m) {
      return '<tr><td>' + M.GAMES[m.game].icon + '</td><td><b>' + esc(m.name) + '</b><br><span class="hint">' + esc(m.author || '') + ' · ' + new Date(m.at).toLocaleDateString() + '</span></td><td>' + (m.pending ? '<span class="tg" style="background:#7aa2ff;color:#06143a">waiting for approval</span>' : m.rejected ? '<span class="tg" style="background:#ff7a7a;color:#3a0606">not approved</span>' + (m.note ? '<br><span class="hint">' + esc(m.note) + '</span>' : '') : m.ok ? '<span class="tg" style="background:#2bd576;color:#05240f">ready</span>' : '<span class="tg" style="background:#ffd166;color:#2a1300">unfinished</span>') + '</td>' +
        '<td>' + (m.ok && S.mapper ? '<label class="sw"><input type="checkbox" data-rot="' + m.id + '" data-g="' + m.game + '"' + (m.rot ? ' checked' : '') + '> in rotation</label>' : '') + '</td>' +
        '<td style="text-align:right;white-space:nowrap"><button class="b" data-open="' + m.id + '">' + (S.mapper || m.pending || m.rejected ? 'Edit' : 'Copy and edit') + '</button> ' + (m.ok ? '<button class="b green" data-test="' + m.id + '" data-g="' + m.game + '">▶</button> ' : '') + '' + (S.mapper || m.pending || m.rejected ? '<button class="b red" data-del="' + m.id + '"></button>' : '') + '</td></tr>';
    }).join('') : '<tr><td class="hint">No maps yet — make one!</td></tr>';
  }
  $('maps').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.def) send({ t: 'mb', a: 'rot', game: t.dataset.def, id: 'default', on: t.checked });
    if (t.dataset.rot) send({ t: 'mb', a: 'rot', game: t.dataset.g, id: t.dataset.rot, on: t.checked });
  });
  var delArm = '';
  $('maps').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.open) { if (!confirmLose()) return; send({ t: 'mb', a: 'get', id: b.dataset.open }); $('maps').classList.add('hidden'); }
    if (b.dataset.test) window.open('/arcade?test=' + b.dataset.test + '&g=' + b.dataset.g, '_blank');
    if (b.dataset.del) { if (delArm !== b.dataset.del) { delArm = b.dataset.del; b.textContent = 'Sure?'; return; } send({ t: 'mb', a: 'del', id: b.dataset.del }); delArm = ''; if (E.id === b.dataset.del) E.id = null; }
  });

  // ------------------------------------------------------------------ server
  var ws = null;
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/bw-ws?builder=1');
    ws.onmessage = function (ev) {
      var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'hello') { S.mapper = !!m.mapper; S.maker = !!m.maker; if (!S.mapper && !S.maker) { $('lock').classList.remove('hidden'); $('lockMsg').innerHTML = 'Sign in to ScrollHub to build maps.<br>Your maps are sent to Scrollreader11, who decides what goes live.'; } else { $('lock').classList.add('hidden'); if (!S.mapper) $('save').textContent = 'Send for approval'; send({ t: 'mb', a: 'list' }); } }
      if (m.t === 'err' && m.code === 'login') { $('lock').classList.remove('hidden'); $('lockMsg').textContent = 'Log in to ScrollHub first.'; }
      if (m.t === 'mbl') renderMaps(m.maps, m.rot);
      if (m.t === 'mbg' && m.map) { loadCm(m.map); toast('Opened "' + esc(m.map.name) + '"', 1400); }
      if (m.t === 'mbs') {
        if (!m.ok) { toast('' + esc(m.msg || 'Couldn’t save'), 2400); return; }
        if (m.pending) { E.id = m.id; S.dirty = false; toast('Sent for approval! Scrollreader11 will review it. Check the map list for the answer.', 4200); saveCb = null; return; }
        if (m.saved === false) { S.problems = m.problems || []; toast(esc(m.msg || 'Fix the problems first'), 3200); saveCb = null; return; }
        E.id = m.id; S.dirty = false;
        toast(m.problems && m.problems.length ? 'Saved as a draft — ' + m.problems.length + ' thing(s) to fix before it can be played' : 'Saved! It’s ready to play', 2400);
        var cb = saveCb; saveCb = null; if (cb) cb(m.id);
      }
    };
    ws.onclose = function () { setTimeout(connect, 1500); };
  }

  // ------------------------------------------------------------------ rendering
  var viewMap = { g: null, bases: [] };
  function hoverInfo() {
    var i = S.hover; if (i < 0) { $('hover').textContent = ''; return; }
    var x = i % W, y = (i / W) | 0, g = GROUND.filter(function (q) { return q.v === E.g[i]; })[0];
    $('hover').textContent = 'Tile ' + x + ', ' + y + ' · ' + (g ? g.name : '?') + (E.w[i] ? ' · wall' : '') + (E.prop[i] ? ' · ' + M.PROPS[M.PROP_KINDS[E.prop[i] - 1]].name : '');
  }
  function tc(i) { return { x: (i % W) * T + T / 2, y: ((i / W) | 0) * T + T / 2 }; }
  function frame() {
    var t = now() / 1000;
    var z = cam.z, vw = innerWidth / z, vh = innerHeight / z, L = cam.x - vw / 2, Tp = cam.y - vh / 2;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    D.sky(c, innerWidth, innerHeight, cam.x, cam.y, t, z);
    if (!E) { requestAnimationFrame(frame); return; }
    c.setTransform(dpr * z, 0, 0, dpr * z, -L * dpr * z, -Tp * dpr * z);
    viewMap.g = E.g; viewMap.bases = (E.mk.sp || []).map(function (q) { return { cx: q[1] % W, cy: (q[1] / W) | 0 }; });
    var CS = D.CH * T;
    for (var cy = Math.floor((Tp - 140) / CS); cy <= Math.floor((Tp + vh) / CS); cy++) for (var cx = Math.floor(L / CS); cx <= Math.floor((L + vw) / CS); cx++) {
      if (cx < 0 || cy < 0 || cx * D.CH >= W || cy * D.CH >= H) continue;
      var ch = D.chunk(viewMap, cx, cy); if (ch) c.drawImage(ch, cx * CS, cy * CS);
    }
    var tx0 = Math.max(0, Math.floor(L / T) - 1), tx1 = Math.min(W - 1, Math.ceil((L + vw) / T) + 1), ty0 = Math.max(0, Math.floor(Tp / T) - 1), ty1 = Math.min(H - 1, Math.ceil((Tp + vh) / T) + 2), x, y, i;
    // spleef floors: the selected one bright, the others faint
    if (E.game === 'spleef') {
      for (var zz = M.SP_LAYERS - 1; zz >= 0; zz--) {
        if (zz < S.layer) continue;
        c.save(); c.globalAlpha = zz === S.layer ? 1 : 0.28;
        var Lz = E.L[zz];
        for (y = ty0; y <= ty1; y++) for (x = tx0; x <= tx1; x++) { i = y * W + x; if (Lz[i]) D.spTile(c, M.SP.kinds[zz], x * T + (zz - S.layer) * 6, y * T + (zz - S.layer) * 10, i, !Lz[i + W]); }
        c.restore();
      }
      if (S.layer > 0) { c.save(); c.globalAlpha = 0.12; var Lu = E.L[S.layer - 1]; for (y = ty0; y <= ty1; y++) for (x = tx0; x <= tx1; x++) { i = y * W + x; if (Lu[i]) { c.fillStyle = '#fff'; c.fillRect(x * T, y * T, T, T); } } c.restore(); }
    }
    for (y = ty0; y <= ty1; y++) for (x = tx0; x <= tx1; x++) { i = y * W + x; if (E.f[i]) D.floorBlock(c, E.f[i], E.fc[i], x * T, y * T, !E.g[i + W] && !E.f[i + W], 1); }
    // sorted things
    var list = [];
    for (y = ty0; y <= ty1; y++) for (x = tx0; x <= tx1; x++) {
      i = y * W + x;
      if (E.w[i]) list.push({ y: (y + 1) * T, k: 'w', i: i, x: x, ty: y });
      else if (E.g[i] === G.ROCK) list.push({ y: (y + 1) * T - 1, k: 'rock', x: x * T + T / 2, by: (y + 1) * T - 4 });
      if (E.prop[i]) list.push({ y: y * T + T / 2 + 12, k: 'prop', kind: M.PROP_KINDS[E.prop[i] - 1], x: x * T + T / 2, py: y * T + T / 2 + 12 });
    }
    markerDrawables(list, t);
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (d) {
      if (d.k === 'w') D.wallBlock(c, E.w[d.i], E.wc[d.i], d.x * T, d.ty * T, 1);
      else if (d.k === 'rock') D.rock(c, d.x, d.by, t);
      else if (d.k === 'prop') D.prop(c, d.kind, d.x, d.py, t, { face: true });
      else if (d.k === 'fn') d.fn();
    });
    // grid
    if (S.grid && z > 0.35) { c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1 / z; c.beginPath(); for (x = tx0; x <= tx1 + 1; x++) { c.moveTo(x * T, ty0 * T); c.lineTo(x * T, (ty1 + 1) * T); } for (y = ty0; y <= ty1 + 1; y++) { c.moveTo(tx0 * T, y * T); c.lineTo((tx1 + 1) * T, y * T); } c.stroke();
      c.strokeStyle = 'rgba(255,209,102,.25)'; c.lineWidth = 2 / z; c.beginPath(); c.moveTo(36 * T, 0); c.lineTo(36 * T, H * T); c.moveTo(0, 36 * T); c.lineTo(W * T, 36 * T); c.stroke(); }
    c.strokeStyle = 'rgba(255,92,108,.5)'; c.lineWidth = 3 / z; c.strokeRect(T, T, (W - 2) * T, (H - 2) * T);
    // cursor / brush preview (+ symmetric ghosts)
    if (S.dragA >= 0) { var ax = S.dragA % W, ay = (S.dragA / W) | 0, bx = S.dragB % W, by = (S.dragB / W) | 0; c.fillStyle = 'rgba(255,209,102,.18)'; c.strokeStyle = '#ffd166'; c.lineWidth = 2 / z; var rx = Math.min(ax, bx) * T, ry = Math.min(ay, by) * T, rw = (Math.abs(bx - ax) + 1) * T, rh = (Math.abs(by - ay) + 1) * T; c.fillRect(rx, ry, rw, rh); c.strokeRect(rx, ry, rw, rh); }
    else if (S.hover >= 0 && S.tool !== 'pan' && !touch) {
      var hx = S.hover % W, hy = (S.hover / W) | 0, sz = S.item && S.item.mk ? 1 : S.size, h2 = Math.floor((sz - 1) / 2);
      symPts(hx, hy).forEach(function (p, k) { c.strokeStyle = k ? 'rgba(255,255,255,.35)' : '#fff'; c.lineWidth = 2 / z; c.setLineDash([6 / z, 4 / z]); c.strokeRect((p.x - h2) * T, (p.y - h2) * T, sz * T, sz * T); c.setLineDash([]); });
    }
    requestAnimationFrame(frame);
  }
  function label(text, x, y, col) { D.tag(c, text, x, y, { size: 11, color: '#fff', bg: col || 'rgba(20,16,50,.85)' }); }
  function markerDrawables(list, t) {
    var mk = E.mk, g = E.game;
    var push = function (y, fn) { list.push({ y: y, k: 'fn', fn: fn }); };
    if (g === 'bw' || g === 'ctf') (mk.sp || []).forEach(function (q) { var p = tc(q[1]); push(p.y, function () { c.save(); c.globalAlpha = 0.85; A.drawGim(c, p.x, p.y + 6, { skin: 'gim', body: teamCol(q[0]) }, { t: t, dir: 0 }); c.restore(); label(B.TEAMS[q[0]].name.toUpperCase() + ' SPAWN', p.x, p.y - 52, teamCol(q[0])); }); });
    if (g === 'spleef') (mk.sp || []).forEach(function (q, k) { var p = tc(q[1]); push(p.y, function () { c.save(); c.globalAlpha = 0.85; A.drawGim(c, p.x, p.y + 6, { skin: 'gim', body: teamCol(k) }, { t: t, dir: 0 }); c.restore(); label('SPAWN ' + (k + 1), p.x, p.y - 52); }); });
    if (g === 'bw') {
      (mk.bed || []).forEach(function (q) { var d = M.DIRS[q[2] & 3], fx = q[1] % W, fy = (q[1] / W) | 0; push((fy + Math.max(0, d[1]) + 1) * T, function () { D.bed(c, { team: q[0], x: (fx + fx + d[0] + 1) * T / 2, y: (fy + fy + d[1] + 1) * T / 2, dir: d }, t, false); }); });
      (mk.tg || []).forEach(function (q) { var p = tc(q[1]); push(p.y + 12, function () { D.gen(c, { kind: 'iron', team: q[0], x: p.x - 9, y: p.y }, 3, t, null); D.gen(c, { kind: 'gold', team: q[0], x: p.x + 9, y: p.y }, 1, t, null); }); });
      ['shop', 'up'].forEach(function (k) { (mk[k] || []).forEach(function (q) { var p = tc(q[1]); push(p.y + 12, function () { D.npc(c, { kind: k, x: p.x, y: p.y + 10, team: q[0] }, t, false); c.strokeStyle = teamCol(q[0]); c.lineWidth = 3; A.ell(c, p.x, p.y + 14, 24, 9); c.stroke(); }); }); });
      ['dia', 'em'].forEach(function (k) { (mk[k] || []).forEach(function (i) { var p = tc(i); push(p.y + 10, function () { D.gen(c, { kind: k, x: p.x, y: p.y }, 1, t, { title: k === 'dia' ? 'Diamond' : 'Emerald', sub: 'generator' }); }); }); });
    }
    if (g === 'ctf') {
      (mk.flag || []).forEach(function (q) { var p = tc(q[1]); push(p.y, function () { D.flagStand(c, p.x, p.y, q[0], t, true); D.flag(c, p.x, p.y, q[0], t); }); });
      (mk.pick || []).forEach(function (i) { var p = tc(i); push(p.y, function () { D.pad(c, p.x, p.y, t); label('PICKUP', p.x, p.y - 34); }); });
    }
    if (g === 'hide') {
      (mk.hs || []).forEach(function (i) { var p = tc(i); push(p.y, function () { c.save(); c.globalAlpha = 0.8; A.drawGim(c, p.x, p.y + 6, { skin: 'gim', body: '#2bd576' }, { t: t, dir: 0 }); c.restore(); label('HIDER SPAWN', p.x, p.y - 52, '#14874a'); }); });
      (mk.seek || []).forEach(function (i) { var p = tc(i), x0 = ((i % W) - 3) * T, y0 = (((i / W) | 0) - 3) * T; push(p.y + 200, function () { c.strokeStyle = '#ff5c6c'; c.lineWidth = 4; c.setLineDash([10, 8]); c.strokeRect(x0, y0, 7 * T, 7 * T); c.setLineDash([]); A.drawGim(c, p.x, p.y + 6, { skin: 'ninja', body: '#ff4b5c' }, { t: t, dir: 0 }); label('SEEKER CAGE', p.x, y0 - 14, '#c1121f'); }); });
    }
  }

  // ------------------------------------------------------------------ start
  var draft = null; try { draft = JSON.parse(localStorage.getItem('sh_builder_draft') || 'null'); } catch (e) {}
  loadCm(draft && draft.game ? draft : M.toCustom('bw', 3));
  if (draft && draft.game) toast('Restored your last unsaved work', 1600); else { E.name = 'My Bedwars map'; $('name').value = E.name; validate(); }
  $('lock').classList.remove('hidden');
  connect();
  requestAnimationFrame(frame);
  window.MB = { get E() { return E; }, S: S, cam: cam, send: send, toCm: function () { return toCm(E); }, loadCm: loadCm };
})();
