/* ============================================================
   Proximity voice for ScrollHub Games (hub, waiting island, Bedwars).
   Mic -> 12 kHz mono -> mu-law 40 ms frames -> WebSocket (binary).
   The server only forwards frames to players near the speaker; here each
   speaker gets its own little jitter buffer, and the mixer sets volume by
   distance and pans left/right by where they stand.        -> window.BWV
   ============================================================ */
(function () {
  var V = window.BWV = { on: false, muted: false, talking: false, range: 380 };
  var RATE = 12000, FRAME = 480;              // 40 ms frames
  var ac = null, stream = null, src = null, cap = null, mix = null, sink = null;
  var sendFn = null, inbuf = new Float32Array(FRAME), inLen = 0, acc = 0, accSum = 0, accN = 0, ratio = 4;
  var speakUntil = 0, noiseFloor = 0.004;
  var speakers = {};                          // id -> {chunks:[], len, started, gain, pan, lastAt}

  // ---- mu-law codec
  function mulawEnc(x) {
    var s = Math.max(-1, Math.min(1, x)) * 32635, sign = s < 0 ? 0x80 : 0; if (sign) s = -s;
    s += 132; var exp = 7; for (var m = 0x4000; (s & m) === 0 && exp > 0; m >>= 1) exp--;
    var man = (s >> (exp + 3)) & 0x0f; return ~(sign | (exp << 4) | man) & 0xff;
  }
  var DEC = new Float32Array(256);
  for (var i = 0; i < 256; i++) { var u = ~i & 0xff, sign = u & 0x80, exp = (u >> 4) & 7, man = u & 0x0f; var mag = ((man << 3) + 132) << exp; mag -= 132; DEC[i] = (sign ? -mag : mag) / 32768; }

  V.supported = function () { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)); };
  V.start = function (send) {
    sendFn = send;
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    ratio = ac.sampleRate / RATE;
    return ac.resume().then(function () {
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    }).then(function (s) {
      stream = s; src = ac.createMediaStreamSource(s);
      cap = ac.createScriptProcessor(2048, 1, 1);
      sink = ac.createGain(); sink.gain.value = 0;   // ScriptProcessors only run when connected
      src.connect(cap); cap.connect(sink); sink.connect(ac.destination);
      cap.onaudioprocess = function (e) { capture(e.inputBuffer.getChannelData(0)); };
      mix = ac.createScriptProcessor(1024, 0, 2); mix.onaudioprocess = mixOut; mix.connect(ac.destination);
      V.on = true; V.muted = false;
      return true;
    });
  };
  V.stop = function () {
    V.on = false; V.talking = false;
    try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (cap) cap.disconnect(); if (src) src.disconnect(); if (mix) mix.disconnect(); if (sink) sink.disconnect(); } catch (e) {}
    stream = src = cap = mix = sink = null; speakers = {};
  };
  V.setMuted = function (m) { V.muted = !!m; if (V.muted) V.talking = false; };
  V.reset = function () { speakers = {}; };

  function capture(data) {
    if (!V.on) return;
    for (var k = 0; k < data.length; k++) {           // box-filter downsample to 12 kHz
      accSum += data[k]; accN++; acc += 1;
      if (acc >= ratio) { acc -= ratio; inbuf[inLen++] = accSum / accN; accSum = 0; accN = 0; if (inLen === FRAME) { frame(); inLen = 0; } }
    }
  }
  function frame() {
    var e = 0; for (var k = 0; k < FRAME; k++) e += inbuf[k] * inbuf[k];
    var rms = Math.sqrt(e / FRAME), now = performance.now();
    if (rms < noiseFloor * 3) noiseFloor = noiseFloor * 0.98 + rms * 0.02;   // slowly learn the room noise
    if (rms > Math.max(0.012, noiseFloor * 3.2)) speakUntil = now + 380;        // voice detected (+ hangover)
    V.talking = !V.muted && now < speakUntil;
    if (!V.talking || !sendFn) return;
    var out = new Uint8Array(FRAME + 1); out[0] = 1;
    for (k = 0; k < FRAME; k++) out[k + 1] = mulawEnc(inbuf[k] * 1.4);
    sendFn(out.buffer);
  }
  // incoming: [1][speaker id u32][mu-law samples]
  V.onFrame = function (u8) {
    if (!V.on || !ac || u8.length < 6 || u8[0] !== 1) return;
    var id = ((u8[1] << 24) | (u8[2] << 16) | (u8[3] << 8) | u8[4]) >>> 0;
    var n = u8.length - 5, outN = Math.floor(n * ratio), pcm = new Float32Array(outN);
    for (var k = 0; k < outN; k++) {                    // linear upsample to the output rate
      var p = k / ratio, i0 = Math.floor(p), f = p - i0, a = DEC[u8[5 + Math.min(i0, n - 1)]], b = DEC[u8[5 + Math.min(i0 + 1, n - 1)]];
      pcm[k] = a + (b - a) * f;
    }
    var sp = speakers[id] || (speakers[id] = { chunks: [], off: 0, len: 0, started: false, gain: 0, g: 0, pan: 0, lastAt: 0 });
    sp.chunks.push(pcm); sp.len += outN; sp.lastAt = performance.now();
    var max = ac.sampleRate * 0.6; while (sp.len - sp.off > max && sp.chunks.length > 1) { var c0 = sp.chunks.shift(); sp.len -= c0.length; sp.off = 0; }
    if (!sp.started && sp.len - sp.off > ac.sampleRate * 0.12) sp.started = true;
  };
  // Called every frame with the listener position and a lookup for speaker positions.
  V.tick = function (lx, ly, posOf) {
    for (var id in speakers) {
      var sp = speakers[id], p = posOf(+id);
      if (!p) { sp.gain = 0; continue; }
      var d = Math.hypot(p.x - lx, p.y - ly), r = V.range;
      var g = d >= r ? 0 : Math.pow(1 - d / r, 1.3);
      sp.gain = Math.min(1, g * 1.15); sp.pan = Math.max(-0.85, Math.min(0.85, (p.x - lx) / (r * 0.55)));
      if (performance.now() - sp.lastAt > 8000) delete speakers[id];
    }
  };
  V.isTalking = function (id) { var sp = speakers[id]; return !!sp && performance.now() - sp.lastAt < 260 && sp.gain > 0.02; };
  function mixOut(e) {
    var L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1), N = L.length, k;
    for (k = 0; k < N; k++) { L[k] = 0; R[k] = 0; }
    for (var id in speakers) {
      var sp = speakers[id]; if (!sp.started) continue;
      var a = (sp.pan + 1) * Math.PI / 4, gl = Math.cos(a), gr = Math.sin(a);
      for (k = 0; k < N; k++) {
        if (!sp.chunks.length) { sp.started = false; break; }
        sp.g += (sp.gain - sp.g) * 0.002;                 // smooth volume changes as people move
        var ch = sp.chunks[0], s = ch[sp.off++] * sp.g;
        if (sp.off >= ch.length) { sp.chunks.shift(); sp.len -= ch.length; sp.off = 0; }
        L[k] += s * gl; R[k] += s * gr;
      }
    }
    for (k = 0; k < N; k++) { if (L[k] > 1) L[k] = 1; else if (L[k] < -1) L[k] = -1; if (R[k] > 1) R[k] = 1; else if (R[k] < -1) R[k] = -1; }
  }
})();
