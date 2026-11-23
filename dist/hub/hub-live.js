/* ScrollHub Hub: live strip. Shows what the owner has switched on for everyone: a boost, a countdown, a poll.
   Also applies the site name from Branding. Data comes from /api/school (polled every 15 s). */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var h = Hub.h, icon = Hub.icon, bar = null, tick = 0;

  function fmt(ms) {
    if (ms < 0) ms = 0; var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), hr = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d ? d + 'd ' + hr + 'h ' + m + 'm' : hr ? hr + ':' + p(m) + ':' + p(x) : m + ':' + p(x);
  }
  function pollModal(poll) {
    var body = h('div', { class: 'mbody poll' }), m;
    function paint(p) {
      Hub.clear(body); var tot = p.counts.reduce(function (a, b) { return a + b; }, 0), voted = p.mine >= 0;
      body.appendChild(h('h3', { text: p.q }));
      body.appendChild(h('p', { class: 'hint', text: voted ? 'Thanks, your vote is in. ' + tot + ' vote' + (tot === 1 ? '' : 's') + ' so far.' : 'Pick one. You can change your vote until it closes.' }));
      p.opts.forEach(function (o, i) {
        var pc = tot ? Math.round(p.counts[i] * 100 / tot) : 0;
        body.appendChild(h('button', { type: 'button', class: 'pl-opt' + (p.mine === i ? ' on' : ''), onclick: function () {
          Hub.api('/api/poll/vote', { body: { id: p.id, i: i } }).then(function (r) { if (r && r.ok) { Hub.school.live = r.live; Hub.emit('live'); if (r.live && r.live.poll) paint(r.live.poll); } else Hub.toast((r && r.error) || 'Could not vote', { bad: true }); });
        } }, [h('i', { class: 'pl-fill', style: 'width:' + pc + '%' }), h('span', { class: 'pl-t', text: o }), h('b', { class: 'pl-n', text: voted || tot ? pc + '%' : '' })]));
      });
    }
    paint(poll); m = Hub.modal(body, { small: true, label: 'Poll' });
  }
  function render() {
    var L = (Hub.school && Hub.school.live) || {}, now = Date.now();
    var any = L.boost || L.countdown || L.poll;
    if (!any) { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); bar = null; clearInterval(tick); tick = 0; return; }
    var main = document.querySelector('.main'); if (!main) return;
    if (!bar) { bar = h('div', { class: 'livebar', role: 'status' }); main.insertBefore(bar, main.firstChild); }
    Hub.clear(bar);
    if (L.boost) bar.appendChild(h('span', { class: 'lv boost' }, [icon('zap'), h('b', { text: 'x' + L.boost.mult + ' Scrolls' }), h('span', { class: 'lv-t', 'data-until': String(L.boost.until), text: (L.boost.label ? L.boost.label + ' · ' : '') + fmt(L.boost.until - now) + ' left' })]));
    if (L.countdown) bar.appendChild(h('span', { class: 'lv cd' }, [icon('timer'), h('b', { text: L.countdown.label }), h('span', { class: 'lv-t', 'data-at': String(L.countdown.at), text: L.countdown.at > now ? fmt(L.countdown.at - now) : 'Now' })]));
    if (L.poll) { var pl = L.poll, tot = pl.counts.reduce(function (a, b) { return a + b; }, 0); bar.appendChild(h('button', { type: 'button', class: 'lv poll', onclick: function () { var P = Hub.school.live && Hub.school.live.poll; if (P) pollModal(P); } }, [icon('circle-check'), h('b', { text: 'Poll' }), h('span', { class: 'lv-t', text: pl.q }), h('span', { class: 'lv-go', text: pl.mine >= 0 ? 'Voted · ' + tot : 'Vote' })])); }
    if (!tick) tick = setInterval(function () {
      if (!bar) return; var n = Date.now();
      [].forEach.call(bar.querySelectorAll('[data-at]'), function (e) { var at = +e.getAttribute('data-at'); e.textContent = at > n ? fmt(at - n) : 'Now'; });
      [].forEach.call(bar.querySelectorAll('[data-until]'), function (e) { var u = +e.getAttribute('data-until'); if (u <= n) { Hub.school.live = Object.assign({}, Hub.school.live, { boost: null }); render(); } else e.textContent = e.textContent.replace(/[\d:dhm ]+ left$/, fmt(u - n) + ' left'); });
    }, 1000);
  }
  var lastName = 'ScrollHub';
  Hub.siteName = function () { var b = Hub.school && Hub.school.brand; return b && b.name ? b.name : 'ScrollHub'; };
  function brand() {
    var nm = Hub.siteName(); if (nm !== lastName) {
      var t = document.title; if (t === lastName) document.title = nm; else if (t.slice(-(lastName.length + 3)) === ' - ' + lastName) document.title = t.slice(0, -lastName.length) + nm;
      lastName = nm;
    }
    [].forEach.call(document.querySelectorAll('[data-brand-name]'), function (e) { e.textContent = nm; });
  }
  Hub.on('subs:new', function (x) {
    var line = x.n + ' creation' + (x.n === 1 ? '' : 's') + ' waiting for your approval';
    Hub.toast(line + '. Open Admin, Review.', { icon: 'megaphone', ms: 7000 });
  });
  Hub.on('live', function () { render(); brand(); });
  Hub.on('school', function () { render(); brand(); });
  brand();
  render();
})();
