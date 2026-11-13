/* ============================================================
   DC call audio relay.
   Calls and voice channels normally send audio straight between people (WebRTC).
   On school / phone / strict networks that direct link often can't connect, so
   nobody hears anything. This script also sends your voice through our server
   (the same way Bedwars and casino voice work) and plays someone's relayed
   voice only while the direct link to them isn't working, so you never hear
   anyone twice. Video still uses the direct link.
   ============================================================ */
(function () {
  if (window.__dcRelay) return; window.__dcRelay = true;
  var OWS = window.WebSocket, OPC = window.RTCPeerConnection;
  if (!OWS || !OPC) return;

  var sock = null, inVoice = false, myNid = 0, muted = false;
  var nidToPeer = {}, peerToNid = {};
  var pcs = [];                       // every RTCPeerConnection the page makes
  var pcPeer = new WeakMap();         // pc -> remote peer id (matched from outgoing offers/answers)
  var tickT = 0, loading = null;
  var stats = window.__dcRelayStats = { tx: 0, rx: 0, played: 0 };

  // ---- learn which connection belongs to which person
  window.RTCPeerConnection = function (cfg, extra) {
    var pc = extra === undefined ? new OPC(cfg) : new OPC(cfg, extra);
    pcs.push(pc);
    pc.addEventListener('connectionstatechange', function () { if (pc.connectionState === 'closed') drop(pc); });
    return pc;
  };
  window.RTCPeerConnection.prototype = OPC.prototype;
  try { Object.setPrototypeOf(window.RTCPeerConnection, OPC); } catch (e) {}
  function drop(pc) { var i = pcs.indexOf(pc); if (i >= 0) pcs.splice(i, 1); }
  function directOk(peer) {
    for (var i = 0; i < pcs.length; i++) {
      var pc = pcs[i]; if (pcPeer.get(pc) !== peer) continue;
      var s = pc.iceConnectionState;
      if (pc.connectionState === 'connected' || s === 'connected' || s === 'completed') return true;
    }
    return false;
  }
  function everyoneDirect() {
    var any = false;
    for (var p in peerToNid) { any = true; if (!directOk(p)) return false; }
    return any;
  }

  // ---- the voice engine (shared with game voice)
  function engine() {
    if (window.BWV) return Promise.resolve(window.BWV);
    if (!loading) loading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = '/arcade/bedwars/voice.js?v=2';
      s.onload = function () { window.BWV ? res(window.BWV) : rej(); }; s.onerror = rej;
      document.head.appendChild(s);
    });
    return loading;
  }
  function sendBin(buf) {
    if (!sock || sock.readyState !== 1 || !inVoice || sock.bufferedAmount > 64000) return;
    if (everyoneDirect()) return;     // everyone already hears you directly
    try { OWS.prototype.send.call(sock, buf); stats.tx++; } catch (e) {}
  }
  function startRelay() {
    engine().then(function (V) {
      if (!inVoice) return;
      V.listen(); V.reset();
      try { sock && sock.readyState === 1 && OWS.prototype.send.call(sock, '{"t":"relay","on":true}'); } catch (e) {}
      if (!V.on && V.supported()) V.start(sendBin).then(function () { V.setMuted(muted); if (!inVoice) V.stop(); }).catch(function () {});
      else V.setMuted(muted);
      clearInterval(tickT);
      tickT = setInterval(function () { V.tick(0, 0, function () { return { x: 0, y: 0 }; }); }, 100);
    }).catch(function () {});
  }
  function stopRelay() {
    inVoice = false; clearInterval(tickT);
    nidToPeer = {}; peerToNid = {};
    try { sock && sock.readyState === 1 && OWS.prototype.send.call(sock, '{"t":"relay","on":false}'); } catch (e) {}
    if (window.BWV) { try { BWV.stop(); BWV.reset(); } catch (e) {} }
  }
  function addPeer(p) { if (p && p.peer && p.nid) { nidToPeer[p.nid] = p.peer; peerToNid[p.peer] = p.nid; } }

  // ---- watch the chat socket
  function onOut(ws, data) {
    if (typeof data !== 'string' || data.charAt(0) !== '{') return;
    var m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m.t === 'voice-join') { inVoice = true; nidToPeer = {}; peerToNid = {}; startRelay(); }
    else if (m.t === 'voice-leave') stopRelay();
    else if (m.t === 'voice-mute') { muted = !!m.muted; if (window.BWV) BWV.setMuted(muted); }
    else if (m.t === 'signal' && m.to && m.data && m.data.sdp && m.data.sdp.sdp) {
      for (var i = pcs.length - 1; i >= 0; i--) {
        var ld = pcs[i].localDescription;
        if (ld && ld.sdp === m.data.sdp.sdp) { pcPeer.set(pcs[i], m.to); break; }
      }
    }
  }
  function onIn(ev) {
    var d = ev.data;
    if (typeof d !== 'string') {
      if (!inVoice || !window.BWV || !(d instanceof ArrayBuffer)) return;
      var u8 = new Uint8Array(d); if (u8.length < 6 || u8[0] !== 1) return;
      var nid = ((u8[1] << 24) | (u8[2] << 16) | (u8[3] << 8) | u8[4]) >>> 0;
      var peer = nidToPeer[nid]; stats.rx++;
      if (peer && directOk(peer)) return;   // already hearing them directly
      BWV.onFrame(u8); stats.played++;
      return;
    }
    if (d.charAt(0) !== '{') return;
    var m; try { m = JSON.parse(d); } catch (e) { return; }
    if (m.t === 'hello') myNid = m.nid || 0;
    else if (m.t === 'voice-peers') { (m.peers || []).forEach(addPeer); }
    else if (m.t === 'voice-join') addPeer(m);
    else if (m.t === 'voice-leave') { var n = peerToNid[m.peer]; if (n) { delete nidToPeer[n]; delete peerToNid[m.peer]; } }
  }

  function W(url, protocols) {
    var ws = protocols === undefined ? new OWS(url) : new OWS(url, protocols);
    if (/\/dc-ws/.test(String(url))) {
      ws.binaryType = 'arraybuffer';
      var rejoin = inVoice;
      sock = ws;
      ws.addEventListener('message', onIn);
      ws.addEventListener('open', function () { if (rejoin && inVoice) startRelay(); });
      ws.addEventListener('close', function () { if (sock === ws) { /* the page re-sends voice-join on reconnect */ } });
      var send = ws.send;
      ws.send = function (data) { try { onOut(ws, data); } catch (e) {} return send.apply(ws, arguments); };
    }
    return ws;
  }
  W.prototype = OWS.prototype;
  ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { try { W[k] = OWS[k]; } catch (e) {} });
  try { Object.setPrototypeOf(W, OWS); } catch (e) {}
  window.WebSocket = W;
})();
