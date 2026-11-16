/* ScrollHub background music — synthesized live with WebAudio (no audio files).
   SHMusic.want('lobby' | 'casino' | 'disco' | null) picks the track (call it as often as you like).
   SHMusic.disco(ms) plays disco for a while, SHMusic.season('xmas' | '') switches to the holiday versions.
   Follows the 🔊 sound mute (SC.sfxMuted) and has its own 🎵 on/off (SHMusic.toggle()). */
(function () {
  if (window.SHMusic) return;
  var ac = null, master = null, cur = null, wantName = null, season = 'xmas', discoUntil = 0, off = false, started = false;
  try { off = localStorage.getItem('sh_music_off') === '1'; } catch (e) {}
  var VOL = 0.26;
  function ctx() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    return ac;
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { var a = ctx(); if (a && a.state === 'suspended') a.resume(); started = true; }, { passive: true }); });

  // ------------------------------------------------------------ instruments
  var noiseBuf = null;
  function noise() { if (noiseBuf) return noiseBuf; var n = ac.sampleRate, b = ac.createBuffer(1, n, n), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return (noiseBuf = b); }
  function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function env(g, t, a, peak, dur, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function osc(out, type, m, t, dur, vol, o) {
    o = o || {}; var v = ac.createOscillator(), g = ac.createGain(), last = g;
    v.type = type; v.frequency.setValueAtTime(mf(m), t); if (o.detune) v.detune.value = o.detune;
    if (o.slide) v.frequency.exponentialRampToValueAtTime(mf(o.slide), t + dur);
    v.connect(g);
    if (o.lp) { var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); if (o.lpEnd) f.frequency.exponentialRampToValueAtTime(o.lpEnd, t + dur); f.Q.value = o.q || 1; g.connect(f); last = f; }
    env(g, t, o.a || 0.01, vol, dur, o.r || Math.min(0.2, dur * 0.6)); last.connect(out); v.start(t); v.stop(t + dur + 0.05);
  }
  function kick(out, t, vol) { var v = ac.createOscillator(), g = ac.createGain(); v.frequency.setValueAtTime(140, t); v.frequency.exponentialRampToValueAtTime(42, t + 0.22); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); v.connect(g); g.connect(out); v.start(t); v.stop(t + 0.32); }
  function nz(out, t, dur, vol, type, freq, q) { var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.8; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02); }
  function hat(out, t, vol, open) { nz(out, t, open ? 0.18 : 0.045, vol, 'highpass', 8000); }
  function snare(out, t, vol) { nz(out, t, 0.16, vol, 'bandpass', 1800, 0.7); osc(out, 'triangle', 50, t, 0.08, vol * 0.5); }
  function clap(out, t, vol) { for (var k = 0; k < 3; k++) nz(out, t + k * 0.011, 0.12, vol * (k === 2 ? 1 : 0.6), 'bandpass', 1400, 1.2); }
  function sleigh(out, t, vol) { nz(out, t, 0.09, vol, 'bandpass', 9000, 2.5); nz(out, t + 0.03, 0.07, vol * 0.6, 'bandpass', 11000, 3); }
  function bell(out, m, t, dur, vol) { osc(out, 'sine', m, t, dur, vol, { a: 0.003, r: dur * 0.9 }); osc(out, 'sine', m + 19.02, t, dur * 0.5, vol * 0.25, { a: 0.003, r: dur * 0.45 }); osc(out, 'sine', m + 12, t, dur * 0.7, vol * 0.3, { a: 0.003, r: dur * 0.6 }); }
  function rhodes(out, m, t, dur, vol) { osc(out, 'sine', m, t, dur, vol, { a: 0.006, r: dur * 0.7 }); osc(out, 'triangle', m + 12, t, dur * 0.35, vol * 0.18, { a: 0.004, r: dur * 0.3 }); }
  function pluck(out, m, t, dur, vol) { osc(out, 'square', m, t, dur, vol, { a: 0.004, r: dur * 0.8, lp: 2600, lpEnd: 700 }); }
  function pad(out, m, t, dur, vol) { osc(out, 'sawtooth', m, t, dur, vol, { a: 0.25, r: 0.4, lp: 1100, detune: -8 }); osc(out, 'sawtooth', m, t, dur, vol, { a: 0.25, r: 0.4, lp: 1100, detune: 8 }); }
  function chord(fn, out, ms, t, dur, vol) { ms.forEach(function (m) { fn(out, m, t, dur, vol); }); }

  // chords as midi notes
  var CH = { C: [60, 64, 67], Am: [57, 60, 64], F: [53, 57, 60, 65], G: [55, 59, 62], G7: [55, 59, 62, 65], Dm: [57, 62, 65], Em: [55, 59, 64],
    Dm7: [57, 60, 62, 65], G9: [55, 59, 62, 65, 69], Cmaj7: [55, 59, 60, 64], A7: [55, 57, 61, 64], Fmaj7: [57, 60, 64, 65], E7: [56, 59, 62, 64] };
  var ROOT = { C: 36, Am: 33, F: 41, G: 43, G7: 43, Dm: 38, Em: 40, Dm7: 38, G9: 43, Cmaj7: 36, A7: 45, Fmaj7: 41, E7: 40 };

  // ------------------------------------------------------------ tracks: bar(out, i, t0, beat)
  var TRACKS = {};
  // Games hub: bouncy chiptune
  TRACKS.lobby = { bpm: 104, bar: function (o, i, t, b, x) {
    var prog = ['C', 'Am', 'F', 'G'], ch = prog[i % 4], r = ROOT[ch];
    for (var s = 0; s < 8; s++) { var tt = t + s * b / 2, n = CH[ch][s % CH[ch].length] + 12; pluck(o, n, tt, b * 0.45, 0.05); }
    [0, 1.5, 2, 3.5].forEach(function (p, k) { osc(o, 'triangle', r + (k === 2 ? 7 : 0) + 12, t + p * b, b * 0.45, 0.16, { r: 0.08 }); });
    kick(o, t, 0.35); kick(o, t + 2 * b, 0.3); snare(o, t + b, 0.08); snare(o, t + 3 * b, 0.08);
    for (var h = 0; h < 8; h++) hat(o, t + h * b / 2, h % 2 ? 0.03 : 0.018);
    var MEL = [[76, 74, 72, 67], [72, 74, 76, 79], [77, 76, 72, 69], [71, 74, 79, 74]];
    if (i % 8 >= 4) MEL[i % 4].forEach(function (m, k) { osc(o, 'square', m, t + k * b, b * 0.8, 0.035, { lp: 3000, r: 0.15 }); });
    if (x) { for (var q = 0; q < 8; q++) sleigh(o, t + q * b / 2, q % 2 ? 0.05 : 0.08); }
  } };
  // Holiday hub: Jingle Bells (public domain, 1857) on bells, with sleigh bells
  var JB_A = [[64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2], [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4], [65, 1], [65, 1], [65, 1.5], [65, 0.5], [65, 1], [64, 1], [64, 1], [64, 0.5], [64, 0.5], [64, 1], [62, 1], [62, 1], [64, 1], [62, 2], [67, 2]];
  var JB_B = JB_A.slice(0, 15).concat([[65, 1], [64, 1], [64, 1], [64, 0.5], [64, 0.5], [67, 1], [67, 1], [65, 1], [62, 1], [60, 4]]);
  function barsOf(seq) { var bars = [], beat = 0; seq.forEach(function (n) { var bi = Math.floor(beat / 4 + 1e-6); (bars[bi] = bars[bi] || []).push([n[0], beat - bi * 4, n[1]]); beat += n[1]; }); return bars; }
  var JB = barsOf(JB_A).concat(barsOf(JB_B)), JB_CH = ['C', 'C', 'C', 'C', 'F', 'C', 'G7', 'G7', 'C', 'C', 'C', 'C', 'F', 'C', 'G7', 'C'];
  TRACKS.lobbyX = { bpm: 128, bar: function (o, i, t, b) {
    var k = i % 16, ch = JB_CH[k], r = ROOT[ch];
    (JB[k] || []).forEach(function (n) { bell(o, n[0] + 12, t + n[1] * b, Math.max(0.35, n[2] * b * 1.1), 0.09); });
    [0, 1, 2, 3].forEach(function (p) { osc(o, 'triangle', r + (p % 2 ? 7 : 0) + 12, t + p * b, b * 0.5, 0.14, { r: 0.1 }); });
    [1, 3].forEach(function (p) { chord(pluck, o, CH[ch], t + p * b, b * 0.4, 0.025); });
    kick(o, t, 0.25); kick(o, t + 2 * b, 0.22);
    for (var q = 0; q < 8; q++) sleigh(o, t + q * b / 2, q % 2 ? 0.06 : 0.1);
  } };
  // Halloween hub: spooky minor organ arps, tolling bell and a wobbly theremin
  TRACKS.lobbyH = { bpm: 96, bar: function (o, i, t, b) {
    var prog = ['Am', 'F', 'Dm', 'E7'], ch = prog[i % 4], r = ROOT[ch];
    var arp = CH[ch].concat([CH[ch][1] + 12]);
    for (var s = 0; s < 8; s++) osc(o, 'square', arp[s % arp.length] + 12, t + s * b / 2, b * 0.42, 0.03, { lp: 1800, lpEnd: 600, r: 0.1 });
    osc(o, 'sawtooth', r, t, b * 3.8, 0.06, { lp: 380, a: 0.08, r: 0.4 });
    osc(o, 'triangle', r + 12, t, b * 3.8, 0.08, { a: 0.05, r: 0.4 });
    if (i % 2 === 0) bell(o, 45, t, 2.6, 0.06);
    kick(o, t, 0.2); kick(o, t + 2.5 * b, 0.12); nz(o, t + 2 * b, 0.25, 0.03, 'bandpass', 900, 0.5);
    if (i % 8 >= 4) { var v = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(); var mel = [76, 77, 74, 71][i % 4];
      v.type = 'sine'; v.frequency.setValueAtTime(mf(mel), t); v.frequency.linearRampToValueAtTime(mf(mel - 2), t + b * 3.5); lfo.frequency.value = 6; lg.gain.value = 9; lfo.connect(lg); lg.connect(v.frequency);
      env(g, t, 0.3, 0.035, b * 3.8, 0.6); v.connect(g); g.connect(o); v.start(t); v.stop(t + b * 4); lfo.start(t); lfo.stop(t + b * 4); }
  } };
  // Casino lounge: smooth jazz ii-V-I with walking bass, swung ride, rhodes comping
  TRACKS.casino = { bpm: 92, bar: function (o, i, t, b, x) {
    var prog = ['Dm7', 'G9', 'Cmaj7', 'A7', 'Dm7', 'G9', 'Fmaj7', 'E7'], ch = prog[i % 8], r = ROOT[ch], sw = b * 0.66;
    var walk = [r, r + 4, r + 7, r + (ch === 'E7' ? 6 : 9)];
    walk.forEach(function (m, k) { osc(o, 'triangle', m + 12, t + k * b, b * 0.9, 0.17, { lp: 900, r: 0.1 }); });
    chord(rhodes, o, CH[ch], t, b * 1.4, 0.04); chord(rhodes, o, CH[ch], t + b + sw, b * 0.9, 0.032);
    if (i % 2) chord(rhodes, o, CH[ch], t + 3 * b + sw, b * 0.7, 0.025);
    [0, 1, 1 + 0.66, 2, 3, 3 + 0.66].forEach(function (p) { nz(o, t + p * b, 0.22, 0.022, 'highpass', 6500); });
    nz(o, t + b, 0.1, 0.03, 'bandpass', 2000, 0.6); nz(o, t + 3 * b, 0.1, 0.03, 'bandpass', 2000, 0.6);
    kick(o, t, 0.12);
    var tones = CH[ch].map(function (m) { return m + 12; });
    if (i % 4 === 1 || i % 4 === 2) { for (var n = 0; n < 4; n++) if ((i * 7 + n * 3) % 5 < 3) osc(o, 'sine', tones[(i + n * 2) % tones.length] + (n === 3 ? 2 : 0), t + n * b + (n % 2 ? sw : 0), b * 0.6, 0.05, { a: 0.02, r: 0.2 }); }
    if (x) { tones.forEach(function (m, k) { bell(o, m + 12, t + k * b * 0.5 + 2 * b, 1.2, 0.03); }); for (var q = 0; q < 4; q++) sleigh(o, t + q * b, 0.035); }
  } };
  // Disco: four on the floor, octave bass, clap, open hats, string stabs
  TRACKS.disco = { bpm: 122, bar: function (o, i, t, b, x) {
    var prog = ['Am', 'Dm', 'G', 'C', 'F', 'Dm', 'E7', 'Am'], ch = prog[i % 8], r = ROOT[ch];
    for (var k = 0; k < 4; k++) kick(o, t + k * b, 0.42);
    clap(o, t + b, 0.12); clap(o, t + 3 * b, 0.12);
    for (var h = 0; h < 16; h++) hat(o, t + h * b / 4, h % 4 === 2 ? 0.06 : 0.018, h % 4 === 2);
    for (var s = 0; s < 8; s++) osc(o, 'sawtooth', r + (s % 2 ? 24 : 12), t + s * b / 2, b * 0.4, 0.07, { lp: 900, lpEnd: 300, q: 4, r: 0.06 });
    [0.5, 1.5, 2.5, 3.5].forEach(function (p) { chord(function (oo, m, tt, d, v) { osc(oo, 'sawtooth', m + 12, tt, d, v, { lp: 3200, lpEnd: 1200, r: 0.08, detune: 6 }); }, o, CH[ch], t + p * b, b * 0.28, 0.022); });
    if (i % 4 === 3) [0, 0.25, 0.5, 0.75].forEach(function (p, n) { osc(o, 'sawtooth', CH[ch][n % CH[ch].length] + 24, t + (3 + p) * b, b * 0.22, 0.03, { lp: 4000, r: 0.05 }); });
    if (i % 8 >= 4) { var arp = CH[ch].concat([CH[ch][0] + 12]); for (var a = 0; a < 16; a++) osc(o, 'square', arp[a % arp.length] + 24, t + a * b / 4, b * 0.2, 0.015, { lp: 3500, r: 0.04 }); }
    if (x) { bell(o, CH[ch][0] + 24, t, 0.8, 0.05); bell(o, CH[ch][2] + 24, t + 2 * b, 0.8, 0.04); for (var q = 0; q < 8; q++) sleigh(o, t + q * b / 2 + b / 4, 0.04); }
  } };

  // ------------------------------------------------------------ player
  function pick() {
    if (discoUntil > Date.now()) return 'disco';
    if (!wantName) return null;
    if (wantName === 'lobby' && season === 'xmas') return 'lobbyX';
    if (wantName === 'lobby' && season === 'halloween') return 'lobbyH';
    return wantName;
  }
  function muted() { return off || (window.SC && SC.sfxMuted && SC.sfxMuted()); }
  function startTrack(name) {
    var a = ctx(); if (!a) return;
    if (cur) { var old = cur; old.g.gain.cancelScheduledValues(a.currentTime); old.g.gain.setValueAtTime(old.g.gain.value, a.currentTime); old.g.gain.linearRampToValueAtTime(0.0001, a.currentTime + 1.2); setTimeout(function () { try { old.g.disconnect(); } catch (e) {} }, 1600); old.dead = true; }
    cur = null; if (!name || !TRACKS[name]) return;
    var g = a.createGain(); g.gain.setValueAtTime(0.0001, a.currentTime); g.gain.linearRampToValueAtTime(1, a.currentTime + 1.5); g.connect(master);
    cur = { name: name, tr: TRACKS[name], g: g, i: 0, next: a.currentTime + 0.15 };
  }
  function tick() {
    var a = ac; if (!a || a.state !== 'running') return;
    master.gain.setTargetAtTime(muted() || document.hidden ? 0 : VOL, a.currentTime, 0.25);
    var name = pick(); if (!cur || cur.name !== name) { if (name || cur) startTrack(name); }
    if (!cur || muted() || document.hidden) { if (cur) cur.next = Math.max(cur.next, a.currentTime + 0.15); return; }
    var beat = 60 / cur.tr.bpm;
    while (cur.next < a.currentTime + 0.6) {
      if (cur.next < a.currentTime - 0.05) cur.next = a.currentTime + 0.05;
      try { cur.tr.bar(cur.g, cur.i, cur.next, beat, season === 'xmas'); } catch (e) {}
      cur.i++; cur.next += beat * 4;
    }
  }
  setInterval(tick, 150);

  window.SHMusic = {
    want: function (name) { wantName = name || null; },
    disco: function (ms) { discoUntil = Date.now() + (ms || 30000); },
    season: function (v) { var nv = v || ''; if (nv !== season) { season = nv; if (cur) cur.name = '_'; } },
    isOff: function () { return off; },
    toggle: function () { off = !off; try { localStorage.setItem('sh_music_off', off ? '1' : '0'); } catch (e) {} return off; },
    now: function () { return cur ? cur.name : null; },
    _render: function (name, bars, x) { // debug: render a track offline, returns {peak, rms, data}
      var keepAc = ac, keepNoise = noiseBuf, tr = TRACKS[name], beat = 60 / tr.bpm, secs = bars * beat * 4 + 1, sr = 22050;
      var oc = new OfflineAudioContext(1, Math.ceil(sr * secs), sr); ac = oc; noiseBuf = null;
      var g = oc.createGain(); g.gain.value = VOL; g.connect(oc.destination);
      for (var i = 0; i < bars; i++) tr.bar(g, i, 0.05 + i * beat * 4, beat, !!x);
      ac = keepAc; noiseBuf = keepNoise;
      return oc.startRendering().then(function (buf) { var d = buf.getChannelData(0), pk = 0, sq = 0; for (var j = 0; j < d.length; j++) { var v = Math.abs(d[j]); if (v > pk) pk = v; sq += v * v; } return { peak: pk, rms: Math.sqrt(sq / d.length), sr: sr, data: Array.from(d) }; });
    },
  };
})();
