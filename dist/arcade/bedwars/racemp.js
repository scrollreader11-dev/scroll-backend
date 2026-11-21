/* Scroll Racing inside the Bedwars lobby. When a race match starts, the real racing game opens full screen on top of the
   engine (an iframe of /racing/?mp=1). This file is the bridge: it hands the iframe the race setup, feeds it each server
   snapshot, and sends back whatever the player's kart reports. The engine keeps the rooms, bots, rewards and end screen. */
(function () {
  'use strict';
  var ctx = null, frame = null, ready = false, init = null, pend = [], listening = false;
  function attach(c) { ctx = c; }
  function post(d) { if (frame && ready) { try { frame.contentWindow.postMessage(d, location.origin); } catch (e) {} } else pend.push(d); }
  function onMessage(e) {
    if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    var d = e.data || {};
    if (d.sr === 'ready') { ready = true; if (init) post({ sr: 'init', init: init }); pend.splice(0).forEach(post); }
    else if (d.sr === 'send' && d.msg && ctx && typeof d.msg.t === 'string' && /^rc[a-z]?$/.test(d.msg.t)) ctx.send(d.msg);
    else if (d.sr === 'leave' && ctx) ctx.send({ t: 'leave' });
  }
  function open(m) {
    close();
    var byId = {}; (m.ents || []).forEach(function (e) { byId[e.id] = e; });
    init = {
      track: m.track, laps: m.laps, goAt: m.goAt, you: m.you, serverNow: m.now, localNow: Date.now(),
      racers: (m.racers || []).map(function (r) { var e = byId[r.id] || {}; return { id: r.id, slot: r.slot, bot: r.bot, nick: e.nick || 'Racer', look: e.look || null }; }),
    };
    ready = false; pend = [];
    if (!listening) { listening = true; window.addEventListener('message', onMessage); }
    frame = document.createElement('iframe'); frame.id = 'raceFrame'; frame.title = 'Scroll Racing'; frame.allow = 'autoplay';
    frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:9000;background:#0b1020';
    frame.src = '/racing/?mp=1';
    document.body.appendChild(frame);
    frame.addEventListener('load', function () { try { frame.contentWindow.focus(); } catch (e) {} });
  }
  function close() { if (frame) { try { frame.remove(); } catch (e) {} } frame = null; ready = false; init = null; pend = []; }
  function snap(m) { post({ sr: 'snap', rc: m.rc, rce: m.rce, rcc: m.rcc }); }
  function msg(m) { post({ sr: 'msg', m: m }); }
  window.RMP = { attach: attach, open: open, close: close, snap: snap, msg: msg };
})();
