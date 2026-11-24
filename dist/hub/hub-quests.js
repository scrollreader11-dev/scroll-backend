/* ScrollHub Hub: daily quests with a streak, and the occasional questionnaire. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub) return;
  var h = Hub.h, icon = Hub.icon;
  function num(n) { return Number(n || 0).toLocaleString('en-US'); }

  // ---------- daily quests ----------
  var box = null, view = null, survey = null;
  function load() {
    return Hub.api('/api/quests').then(function (r) { if (r && r.view) { view = r.view; paint(); } return view; });
  }
  function claim(q, btn) {
    btn.disabled = true;
    Hub.api('/api/quests', { body: { id: q.id } }).then(function (r) {
      if (r && r.ok) {
        view = r.view; paint(); Hub.loadWallet && Hub.loadWallet();
        var extra = (r.milestone ? ' plus ' + num(r.milestone) + ' for the streak' : '') + (r.bonus ? ' plus ' + num(r.bonus) + ' for finishing all three' : '');
        Hub.toast('+' + num(r.gained) + ' Scrolls' + extra);
      } else { if (r && r.view) { view = r.view; paint(); } Hub.toast((r && r.message) || 'Could not claim that', { bad: true }); }
    });
  }
  function untilReset() {
    if (!view) return '';
    var ms = Math.max(0, view.resetsAt - Date.now()), hrs = Math.floor(ms / 3600000), min = Math.floor(ms % 3600000 / 60000);
    return hrs ? hrs + ' h ' + min + ' min' : min + ' min';
  }
  function paint() {
    if (!box || !box.isConnected && box._painted) { if (!box) return; }
    box._painted = true; Hub.clear(box);
    if (!view) { box.appendChild(h('p', { class: 'sec-sub', text: 'Loading your quests.' })); return; }
    var v = view, ms = v.nextMilestone, left = ms ? ms.days - v.streak : 0;
    var streak = h('div', { class: 'dq-streak' }, [
      h('div', { class: 'dq-n', text: String(v.streak) }),
      h('div', { class: 'dq-l', text: 'day streak' }),
      h('div', { class: 'dq-s', text: v.atRisk && !v.kept ? 'Finish a quest today to keep it.' : v.kept ? 'Kept for today.' : v.streak ? '' : 'Finish a quest to start one.' }),
      ms ? h('div', { class: 'dq-m', text: left + (left === 1 ? ' day' : ' days') + ' to ' + num(ms.reward) + ' Scrolls' }) : null,
      v.best > v.streak ? h('div', { class: 'dq-s', text: 'Best: ' + v.best }) : null,
    ]);
    var list = h('div', { class: 'dq-list' }, v.quests.map(function (q) {
      var pct = Math.round(q.prog / q.goal * 100);
      var act = q.claimed ? h('span', { class: 'dq-done' }, [icon('check'), 'Claimed']) : q.done ? h('button', { class: 'btn primary sm', type: 'button', onclick: function (e) { claim(q, e.currentTarget); } }, 'Claim ' + num(q.reward)) : h('span', { class: 'dq-rw', text: num(q.reward) + ' Scrolls' });
      return h('div', { class: 'dq-q' + (q.claimed ? ' is-done' : '') }, [
        h('div', { class: 'dq-t' }, [h('b', { text: q.text }), h('span', { class: 'dq-c', text: q.prog + ' / ' + q.goal })]),
        h('div', { class: 'dq-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(q.goal), 'aria-valuenow': String(q.prog), 'aria-label': q.text }, h('i', { style: 'width:' + pct + '%' })),
        h('div', { class: 'dq-a' }, act),
      ]);
    }));
    var foot = h('div', { class: 'dq-foot' }, [
      h('span', { text: 'Finish all three for ' + num(v.allBonus) + ' extra' + (v.allBonusTaken ? ' (taken today)' : '') + '. New quests in ' + untilReset() + '.' }),
      survey && survey.on && !survey.answered ? h('button', { class: 'btn sm', type: 'button', onclick: function () { Hub.openSurvey(); } }, 'Answer a few questions for ' + num(survey.reward) + ' Scrolls') : null,
    ]);
    box.appendChild(h('div', { class: 'dq' }, [streak, h('div', { class: 'dq-main' }, [list, foot])]));
  }
  Hub.questsBlock = function () {
    if (Hub.me.kind !== 'user') return null;
    box = h('div', { class: 'dq-wrap' });
    var sec = h('section', { class: 'sec' }, [h('div', { class: 'sec-h' }, h('h2', { text: 'Daily quests' })), h('p', { class: 'sec-sub', text: 'Three small goals a day. Come back every day to build a streak.' }), box]);
    paint(); load(); loadSurvey();
    return sec;
  };
  setInterval(function () { if (box && box.isConnected && !document.hidden) load(); }, 30000);

  // ---------- questionnaire ----------
  function loadSurvey() { return Hub.api('/api/feedback').then(function (r) { if (r && r.ok) { survey = r; if (view) paint(); } return survey; }); }
  Hub.openSurvey = function () {
    (survey ? Promise.resolve(survey) : loadSurvey()).then(function (sv) {
      if (!sv || !sv.on || sv.answered || !sv.signedIn) return;
      var ans = {}, err = h('p', { class: 'fb-err', role: 'alert' }), m, sub;
      function pick(q, v, multi, el) {
        if (multi) { var l = ans[q.id] || (ans[q.id] = []), i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else if (l.length < q.max) l.push(v); [].forEach.call(el.children, function (b) { b.setAttribute('aria-pressed', l.indexOf(b.dataset.v) >= 0 ? 'true' : 'false'); }); }
        else { ans[q.id] = v; [].forEach.call(el.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.v) === String(v) ? 'true' : 'false'); }); }
      }
      var qs = sv.questions.map(function (q) {
        var ctl;
        if (q.type === 'text') { ctl = h('textarea', { class: 'input', rows: '2', maxlength: '300', 'aria-label': q.q, oninput: function (e) { ans[q.id] = e.target.value; } }); }
        else if (q.type === 'scale') {
          ctl = h('div', { class: 'fb-opts fb-scale', role: 'group', 'aria-label': q.q }); [1, 2, 3, 4, 5].forEach(function (n) { ctl.appendChild(h('button', { class: 'fb-o', type: 'button', 'data-v': String(n), 'aria-pressed': 'false', onclick: function () { pick(q, n, false, ctl); } }, String(n))); });
          ctl = h('div', null, [ctl, h('div', { class: 'fb-ends' }, [h('span', { text: q.min }), h('span', { text: q.max })])]);
        } else {
          var multi = q.type === 'many', grp = h('div', { class: 'fb-opts', role: 'group', 'aria-label': q.q });
          q.opts.forEach(function (o) { grp.appendChild(h('button', { class: 'fb-o', type: 'button', 'data-v': o, 'aria-pressed': 'false', onclick: function () { pick(q, o, multi, grp); } }, o)); }); ctl = grp;
        }
        return h('div', { class: 'fb-q' }, [h('div', { class: 'fb-h', text: q.q + (q.req ? '' : ' (optional)') }), ctl]);
      });
      sub = h('button', { class: 'btn primary', type: 'button', onclick: function () {
        sub.disabled = true; err.textContent = '';
        Hub.api('/api/feedback', { body: { a: ans } }).then(function (r) {
          if (r && r.ok) { survey.answered = true; m.close(); Hub.loadWallet && Hub.loadWallet(); Hub.toast('Thank you! +' + num(r.reward) + ' Scrolls'); if (box) paint(); }
          else { sub.disabled = false; err.textContent = (r && r.message) || 'Could not send that. Try again.'; if (r && /already/i.test(err.textContent)) survey.answered = true; }
        });
      } }, 'Send and get ' + num(sv.reward) + ' Scrolls');
      var body = h('div', { class: 'mbody fb' }, [h('h3', { text: 'Quick questions' }), h('p', { class: 'hint', text: 'About a minute. Your answers go to the people who build ScrollHub. You get ' + num(sv.reward) + ' Scrolls for answering, one time.' }), qs, err, h('div', { class: 'adm-row', style: 'margin-top:14px' }, [sub, h('button', { class: 'btn', type: 'button', onclick: function () { m.close(); } }, 'Not now')])]);
      m = Hub.modal(body, { small: true, label: 'Questionnaire', onClose: function () { try { localStorage.setItem('sh_fb_snooze', String(Date.now() + 3 * 86400000)); } catch (e) {} } });
    });
  };
  // Pops up now and then: signed in, a bit after arriving, never during a game, and not again for 3 days after "Not now".
  var started = Date.now(), asked = false;
  setInterval(function () {
    if (asked || Hub.me.kind !== 'user' || Hub.playing || document.hidden || Date.now() - started < 90000) return;
    if (document.querySelector('.modal, .tour')) return;
    var until = 0; try { until = +localStorage.getItem('sh_fb_snooze') || 0; } catch (e) {}
    if (Date.now() < until) { asked = true; return; }
    asked = true;
    loadSurvey().then(function (sv) { if (sv && sv.on && !sv.answered && sv.signedIn) Hub.openSurvey(); });
  }, 15000);
})();
