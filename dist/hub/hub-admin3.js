/* ScrollHub Hub: admin panels for sitewide news, mod applications and browser error reports. The server checks the role on every call. */
(function () {
  'use strict';
  var Hub = window.Hub; if (!Hub || !Hub.adminKit) return;
  var K = Hub.adminKit, P = K.PANES, h = Hub.h, icon = Hub.icon, card = K.card, btn = K.btn, inp = K.inp, field = K.field, post = K.post, toastErr = K.toastErr, confirmBox = K.confirmBox, empty = K.empty, loading = K.loading;
  function alive(host) { return document.body.contains(host); }
  function when(ms) { return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  K.TABS.push(['news', 'News and updates', 'megaphone', 1, 'Messaging', 'news post update changelog whats new announce patch notes']);
  K.TABS.push(['apps', 'Mod applications', 'user-plus', 1, 'People', 'apply applicants mod moderator recruit applications accept deny']);
  K.TABS.push(['errors', 'Browser errors', 'triangle-alert', 0, 'Monitor', 'errors bugs crashes javascript exceptions broken report']);
  if (K.ACT) { K.ACT.news = ['news']; K.ACT.apps = ['apps']; K.ACT.errors = ['errors']; }

  // ---------- News ----------
  P.news = function (host) {
    var box = h('div');
    var title = inp('Short title', { }), text = h('textarea', { class: 'input', maxlength: '600', rows: '3', placeholder: 'What changed, in a sentence or two.', 'aria-label': 'Details' }), tag = h('select', { class: 'input', 'aria-label': 'Kind' }, [['new', 'New'], ['fix', 'Fixed'], ['event', 'Event'], ['info', 'Info']].map(function (o) { return h('option', { value: o[0], text: o[1] }); }));
    var pin = Hub.toggle('Pin to the top', '', false, function () {}), editId = '', linkLabel = inp('Button text, like Become a mod'), linkUrl = inp('Link: #/apply or https://...');
    var save = btn('Post', function (b) {
      if (title.value.trim().length < 3) { Hub.toast('Give it a title', { bad: true }); return; }
      K.busy(b, post({ action: 'news.save', id: editId, title: title.value, body: text.value, tag: tag.value, pin: pin.getAttribute('aria-checked') === 'true', linkLabel: linkLabel.value, linkUrl: linkUrl.value })).then(function (r) {
        if (r && r.ok) { Hub.toast(editId ? 'Saved' : 'Posted'); editId = ''; title.value = ''; text.value = ''; linkLabel.value = ''; linkUrl.value = ''; save.lastChild.textContent = 'Post'; Hub.loadNews && Hub.loadNews(true); load(); } else toastErr(r);
      });
    }, { primary: true, icon: 'send' });
    host.appendChild(card('Write a news post', 'Shows on the What\'s New page for everyone, and on the board in the casino lobby. The bell dot appears for players who have not read it.', [field('Title', title), field('Details', text), h('div', { class: 'adm-row wrap' }, [h('div', { style: 'flex:1;min-width:160px' }, field('Button text (optional)', linkLabel)), h('div', { style: 'flex:1;min-width:160px' }, field('Button link (optional)', linkUrl))]), h('div', { class: 'adm-row wrap', style: 'margin-top:10px' }, [h('div', { style: 'flex:1;min-width:140px' }, field('Kind', tag)), pin]), h('div', { class: 'adm-row', style: 'margin-top:12px' }, [save])]));
    host.appendChild(card('Posts', 'Newest first. Edit or remove any post.', box));
    function load() {
      Hub.clear(box); box.appendChild(loading());
      Hub.api('/api/news').then(function (r) {
        if (!alive(host)) return; Hub.clear(box); var l = (r && r.news) || [];
        if (!l.length) { box.appendChild(empty('No posts yet.')); return; }
        l.forEach(function (n) {
          box.appendChild(h('div', { class: 'adm-sub', style: 'padding:10px 0;border-top:1px solid var(--line,rgba(255,255,255,.08))' }, [
            h('div', { class: 'adm-row wrap', style: 'gap:8px' }, [h('b', { text: n.title }), h('span', { class: 'hint', text: (n.pin ? 'Pinned · ' : '') + n.tag + ' · ' + when(n.ts) }), h('span', { style: 'flex:1' }),
              btn('Edit', function () { editId = n.id; title.value = n.title; text.value = n.body; tag.value = n.tag; linkLabel.value = n.link ? n.link.label : ''; linkUrl.value = n.link ? n.link.url : ''; pin.setAttribute('aria-checked', n.pin ? 'true' : 'false'); save.lastChild.textContent = 'Save changes'; title.focus(); window.scrollTo && document.getElementById('scroll') && (document.getElementById('scroll').scrollTop = 0); }, { ghost: true, icon: 'pencil' }),
              btn('Remove', function () { confirmBox('Remove this post?', n.title, 'Remove').then(function (ok) { if (ok) post({ action: 'news.delete', id: n.id }).then(function (x) { x && x.ok ? (Hub.toast('Removed'), Hub.loadNews && Hub.loadNews(true), load()) : toastErr(x); }); }); }, { ghost: true, icon: 'trash-2' })]),
            n.body ? h('p', { class: 'hint', style: 'margin:4px 0 0', text: n.body }) : null]));
        });
      });
    }
    load();
  };

  // ---------- Mod applications ----------
  P.apps = function (host) {
    var body = h('div'); host.appendChild(body);
    var STAT = { pending: 'Waiting', accepted: 'Accepted', denied: 'Denied', waitlist: 'Waitlist' };
    function paint(r) {
      Hub.clear(body);
      if (!r || !r.ok) { body.appendChild(empty('Could not load applications.')); return; }
      body.appendChild(card('Applications', 'Players apply from the profile menu or at #/apply. Share that link in Discord. A ping goes to your Discord webhook when one arrives.', [
        Hub.toggle('Taking applications', r.open ? 'On: signed-in players can apply.' : 'Off: the form says applications are closed.', r.open, function (v) { post({ action: 'apps.open', open: v }).then(function (x) { x && x.ok ? Hub.toast(v ? 'Applications open' : 'Applications closed') : toastErr(x); }); })]));
      var pend = r.items.filter(function (a) { return a.status === 'pending'; });
      body.appendChild(h('p', { class: 'hint', style: 'margin:14px 2px 6px', text: pend.length ? pend.length + ' waiting for an answer' : 'Nothing is waiting.' }));
      if (!r.items.length) { body.appendChild(empty('No applications yet.')); return; }
      var qs = {}; r.questions.forEach(function (q) { qs[q.id] = q.label; });
      r.items.forEach(function (a) {
        var note = inp('Note for the applicant (optional)'); note.maxLength = 300; note.value = a.note || '';
        var det = h('details', { class: 'adm-card', style: 'padding:12px 16px' }, [h('summary', { style: 'cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, [h('b', { text: a.user }), h('span', { class: 'adm-badge ' + (a.status === 'accepted' ? 'mod' : 'none'), text: STAT[a.status] }), h('span', { class: 'hint', text: when(a.ts) + (a.by ? ' · answered by ' + a.by : '') })])]);
        r.questions.forEach(function (q) { if (a.answers[q.id]) det.appendChild(h('div', { style: 'margin:10px 0 0' }, [h('div', { class: 'hint', text: q.label }), h('div', { style: 'white-space:pre-wrap;overflow-wrap:anywhere', text: a.answers[q.id] })])); });
        function decide(s) { return function (b) { K.busy(b, post({ action: 'apps.decide', id: a.id, status: s, note: note.value })).then(function (x) { if (x && x.ok) { Hub.toast(STAT[s]); post({ action: 'apps.list' }).then(function (y) { if (alive(host)) paint(y); }); } else toastErr(x); }); }; }
        det.appendChild(h('div', { style: 'margin-top:12px' }, [field('Note', note), h('div', { class: 'adm-row wrap' }, [btn('Accept', decide('accepted'), { primary: true, icon: 'circle-check' }), btn('Waitlist', decide('waitlist'), { ghost: true }), btn('Deny', decide('denied'), { ghost: true }),
          h('a', { class: 'btn sm ghost', href: '#/admin/staff' }, [icon('shield'), 'Roles and staff']),
          btn('Delete', function () { confirmBox('Delete this application?', a.user + '\'s application will be removed for good.', 'Delete').then(function (ok) { if (ok) post({ action: 'apps.delete', id: a.id }).then(function () { post({ action: 'apps.list' }).then(function (y) { if (alive(host)) paint(y); }); }); }); }, { ghost: true, icon: 'trash-2' })])]));
        if (a.status === 'pending') det.open = true; body.appendChild(det);
      });
    }
    body.appendChild(loading());
    post({ action: 'apps.list' }).then(function (r) { if (alive(host)) paint(r); });
  };

  // ---------- Browser errors ----------
  P.errors = function (host) {
    var body = h('div'); host.appendChild(body);
    function paint(r) {
      Hub.clear(body);
      if (!r || !r.ok) { body.appendChild(empty('Could not load error reports.')); return; }
      var tools = [btn('Refresh', load, { ghost: true, icon: 'refresh-cw' })];
      if (Hub.me.role === 'owner' || Hub.me.role === 'coowner') tools.push(btn('Clear all', function () { confirmBox('Clear all error reports?', 'They are only kept in memory anyway.', 'Clear').then(function (ok) { if (ok) post({ action: 'errors.clear' }).then(load); }); }, { ghost: true, icon: 'trash-2' }));
      body.appendChild(card('Browser errors', 'Pages that broke in a player\'s browser, grouped so the same bug shows once. Kept in memory, so a server restart clears them.', h('div', { class: 'adm-row wrap' }, tools)));
      if (!r.items.length) { body.appendChild(empty('No errors reported. That is good news.')); return; }
      r.items.forEach(function (e) {
        body.appendChild(h('details', { class: 'adm-card', style: 'padding:12px 16px' }, [h('summary', { style: 'cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, [h('span', { class: 'adm-badge mod', text: e.count + (e.count === 1 ? ' time' : ' times') }), h('b', { style: 'overflow-wrap:anywhere', text: e.msg }), h('span', { class: 'hint', text: e.people + (e.people === 1 ? ' person · ' : ' people · ') + 'last ' + when(e.last) })]),
          h('div', { class: 'hint', style: 'margin-top:10px', text: (e.page || 'unknown page') + ' · ' + (e.src || 'no file') + (e.line ? ':' + e.line : '') }), e.stack ? h('pre', { style: 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;margin:8px 0 0;opacity:.85', text: e.stack }) : null]));
      });
    }
    function load() { post({ action: 'errors.list' }).then(function (r) { if (alive(host)) paint(r); }); }
    body.appendChild(loading()); load();
  };
})();
