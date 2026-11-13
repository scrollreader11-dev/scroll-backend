/* Scrolls Casino 2D — tiny synthesized sound effects (WebAudio, no files).
   SC.sfx(name) plays one; SC.sfxMuted() / SC.sfxToggle() control the mute (remembered). */
(function () {
  var SC = window.SC = window.SC || {};
  var ac = null, master = null, muted = false;
  try { muted = localStorage.getItem('sh_casino_mute') === '1'; } catch (e) {}
  function ctx() {
    if (ac) return ac;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ac = new AC(); master = ac.createGain(); master.gain.value = 0.32; master.connect(ac.destination); return ac;
  }
  // Browsers only allow audio after a user gesture.
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { var a = ctx(); if (a && a.state === 'suspended') a.resume(); }, { passive: true }); });
  function tone(freq, dur, type, vol, when, slide) {
    var a = ctx(); if (!a || muted) return;
    var t0 = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, when, hp) {
    var a = ctx(); if (!a || muted) return;
    var t0 = a.currentTime + (when || 0), len = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    s.buffer = b; g.gain.value = vol || 0.2; s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  var NOTES = [261.6, 293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3, 659.3, 698.5, 784, 880, 987.8, 1046.5];
  var FX = {
    click: function () { tone(660, 0.06, 'triangle', 0.15); },
    open: function () { tone(520, 0.08, 'triangle', 0.15); tone(780, 0.1, 'triangle', 0.13, 0.05); },
    close: function () { tone(600, 0.07, 'triangle', 0.12); tone(420, 0.09, 'triangle', 0.1, 0.04); },
    chip: function () { tone(1800, 0.04, 'square', 0.06); tone(2400, 0.05, 'square', 0.05, 0.03); },
    card: function () { noise(0.09, 0.25, 0, 2500); },
    reel: function () { tone(220, 0.08, 'square', 0.08); },
    tick: function () { tone(1500, 0.025, 'square', 0.05); },
    win: function () { [0, 4, 7].forEach(function (n, i) { tone(NOTES[n + 4], 0.18, 'triangle', 0.2, i * 0.07); }); },
    bigwin: function () { [0, 2, 4, 7, 9, 11, 14].forEach(function (n, i) { tone(NOTES[n], 0.22, 'triangle', 0.22, i * 0.07); }); tone(NOTES[14], 0.6, 'sine', 0.15, 0.5); },
    jackpot: function () { for (var r = 0; r < 3; r++) [7, 9, 11, 14].forEach(function (n, i) { tone(NOTES[n], 0.16, 'square', 0.12, r * 0.32 + i * 0.07); }); FX.coins(); },
    coins: function () { for (var i = 0; i < 8; i++) tone(1800 + Math.random() * 900, 0.07, 'triangle', 0.1, i * 0.045); },
    lose: function () { tone(220, 0.25, 'sawtooth', 0.12, 0, 120); },
    launch: function () { noise(0.8, 0.12, 0, 300); tone(120, 0.8, 'sawtooth', 0.06, 0, 400); },
    boom: function () { noise(0.7, 0.4, 0, 60); tone(90, 0.5, 'sine', 0.3, 0, 40); },
    cash: function () { tone(988, 0.08, 'square', 0.12); tone(1319, 0.2, 'square', 0.12, 0.07); },
    pop: function () { tone(500, 0.07, 'sine', 0.18, 0, 900); },
    join: function () { tone(784, 0.12, 'sine', 0.08); tone(1047, 0.16, 'sine', 0.07, 0.08); },
    turn: function () { tone(880, 0.1, 'triangle', 0.18); tone(880, 0.1, 'triangle', 0.18, 0.15); },
    challenge: function () { [0, 4, 0, 7].forEach(function (n, i) { tone(NOTES[n + 3], 0.12, 'square', 0.1, i * 0.12); }); },
    drink: function () { for (var i = 0; i < 4; i++) tone(300 + i * 80, 0.06, 'sine', 0.12, i * 0.06, 500 + i * 80); },
  };
  SC.sfx = function (name, arg) {
    if (muted) return;
    if (name === 'note') return tone(NOTES[(arg || 0) % NOTES.length] * (arg >= 15 ? 2 : 1), 0.6, 'triangle', 0.22);
    var f = FX[name]; if (f) try { f(); } catch (e) {}
  };
  // Let other games (Bedwars) register their own sounds with the same synth.
  SC.sfxAdd = function (name, fn) { FX[name] = fn; };
  SC.sfxTone = tone; SC.sfxNoise = noise; SC.sfxNotes = NOTES;
  SC.sfxSweep = function (dur, vol, f0, f1, when, q) { // band-passed noise sweep (whooshes)
    var a = ctx(); if (!a || muted) return;
    var t0 = a.currentTime + (when || 0), len = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    var s = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q || 1.4;
    f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    s.buffer = b; g.gain.value = vol || 0.3; s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  };
  SC.sfxMuted = function () { return muted; };
  SC.sfxToggle = function () { muted = !muted; try { localStorage.setItem('sh_casino_mute', muted ? '1' : '0'); } catch (e) {} return muted; };
})();
