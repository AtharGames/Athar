/* =========================================================
   سِجَال | جوال المشارك
   يدخل برمز الغرفة، يختار فريقه، ويعرض الفقرة الجارية حسب دوره
   (فردي: يجاوب بنفسه، جماعي: القائد يرسل والباقي يتشاورون، مواجهة: الرسّام، ألغام: صاحب الدور)
   ========================================================= */
(() => {
  'use strict';
  const F = window.FZ, Net = window.FazaaNet, GM = window.FZ_GAMES;
  const { $, $$, esc, ar, num, plus, FX, store } = F;
  const G = GM.GAMES;
  const ME_KEY = 'fazaa-me';

  // هويتي: في وضع التجربة المحلي لكل تبويب هوية مستقلة (sessionStorage)
  const meStore = Net.local ? {
    json(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    put(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* تجاهل */ } }
  } : store;
  let me = meStore.json(ME_KEY, null); // { room, pid, name }
  let S = null, T = {}, P = {}, SCORE = null;
  let offset = 0, timer = 0, watchers = [], offMine = null, offLead = null, endCbs = [], ended = false;
  let rendered = '';       // مفتاح آخر عرض حتى ما نعيد الرسم بلا داعي
  let mineAns = null, leadAns = null, myBomb = null;
  const now = () => Date.now() + offset;
  const room = () => me && me.room;

  // ---------- الدخول ----------
  const qs = new URLSearchParams(location.search);
  if (qs.get('r')) $('#codeIn').value = ar(qs.get('r'));
  if (me && me.name) $('#nameIn').value = me.name;

  $('#joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    FX.unlock();
    const code = F.toLatin($('#codeIn').value).replace(/\D/g, '');
    const name = $('#nameIn').value.trim().slice(0, 20);
    const err = $('#joinErr');
    err.hidden = true;
    if (code.length !== 5) { err.textContent = 'الرمز ٥ أرقام'; err.hidden = false; return; }
    if (!name) { err.textContent = 'اكتب اسمك'; err.hidden = false; return; }
    const btn = $('button', e.currentTarget); btn.disabled = true;
    try {
      const s = await Net.get(code + '/s');
      if (!s) { err.textContent = 'ما لقينا غرفة بهذا الرمز'; err.hidden = false; return; }
      const pid = me && me.room === code && me.pid ? me.pid : F.uid(10);
      me = { room: code, pid, name };
      meStore.put(ME_KEY, me);
      const ex = await Net.get(`${code}/p/${pid}`);
      if (ex && ex.t != null) { await Net.update(`${code}/p/${pid}`, { n: name, on: true }); start(); }
      else teamScreen();
    } catch (x) { console.error(x); err.textContent = 'تعذّر الاتصال، حاول مرة ثانية'; err.hidden = false; }
    finally { btn.disabled = false; }
  });

  // ---------- اختيار الفريق ----------
  let offTeams = null;
  function teamScreen(change = false) {
    F.show('screen-team');
    $('#meName').textContent = me.name; $('#meRoom').textContent = 'غرفة ' + ar(me.room);
    if (offTeams) offTeams();
    let TT = {}, PP = {};
    const draw = () => {
      $('#teamPick').innerHTML = F.teamList(TT).map((t) => {
        const n = F.members(PP, t.id).length;
        return `<button class="tpick tactile" data-t="${t.id}" style="--tc:${t.c}"><b>${esc(t.n)}</b><small>${ar(n)} ${n === 1 ? 'مشارك' : 'مشاركين'}${t.l && PP[t.l] ? ' — 👑 ' + esc(PP[t.l].n) : ' — بلا قائد'}</small></button>`;
      }).join('');
    };
    const o1 = Net.watch(me.room + '/T', (v) => { TT = v || {}; draw(); });
    const o2 = Net.watch(me.room + '/p', (v) => { PP = v || {}; draw(); });
    offTeams = () => { o1(); o2(); offTeams = null; };
    $('#teamPick').onclick = async (e) => {
      const b = e.target.closest('.tpick'); if (!b) return;
      FX.pop(560);
      try {
        if (change) await Net.update(`${me.room}/p/${me.pid}`, { t: b.dataset.t });
        else await Net.set(`${me.room}/p/${me.pid}`, { n: me.name, t: b.dataset.t, j: Net.TS, on: true });
        offTeams && offTeams();
        start();
      } catch (x) { console.error(x); F.toast('تعذّر الدخول، حاول مرة ثانية'); }
    };
  }

  // ---------- المتابعة ----------
  function start() {
    watchers.forEach((w) => w()); watchers = [];
    $('#meName').textContent = me.name; $('#meRoom').textContent = 'غرفة ' + ar(me.room);
    if (!Net.local) Net.presence(`${me.room}/p/${me.pid}/on`, true, false).catch(() => {});
    watchers.push(Net.watch(me.room + '/T', (v) => { T = v || {}; render(false); }));
    watchers.push(Net.watch(me.room + '/p', (v) => {
      P = v || {};
      if (!P[me.pid]) { kicked(); return; }
      render(false);
    }));
    watchers.push(Net.watch(me.room + '/sc', (v) => { SCORE = v; }));
    watchers.push(Net.watch(me.room + '/s', (v) => {
      if (!v) { closed(); return; }
      const fresh = !S || S.r !== v.r || S.ph !== v.ph || S.sub !== v.sub;
      // المقدّم أنهى الوقت مبكرًا: نرسل الرسمة أو الوصف قبل القفل
      if (S && S.r === v.r && S.ph === 'play' && v.ph === 'lock' && !ended) { ended = true; S = v; endCbs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
      S = v;
      if (fresh) onRound();
      render(fresh);
    }));
    F.keepAwake(); window.__fzAwake = true;
  }
  function kicked() {
    watchers.forEach((w) => w()); watchers = [];
    clearInterval(timer);
    F.show('screen-join');
    F.toast('أُخرجت من الغرفة');
  }
  function closed() {
    watchers.forEach((w) => w()); watchers = [];
    clearInterval(timer);
    meStore.del(ME_KEY); me = me ? { name: me.name } : null; if (me) meStore.put(ME_KEY, me);
    F.show('screen-join');
    F.toast('انتهت الغرفة');
  }

  // ---------- من أنا؟ ----------
  function whoAmI() {
    const p = P[me.pid] || {};
    const tid = String(p.t);
    const t = T[tid] || {};
    return { pid: me.pid, name: me.name, team: tid, teamName: t.n || '', color: t.c || '#888', leader: t.l, isLeader: t.l === me.pid };
  }
  function canAnswer(m) {
    if (!S) return false;
    if (S.m === 'solo') return true;
    if (S.m === 'team') return m.isLeader;
    if (S.m === 'duel') return !!(S.dw && S.dw[me.pid]);
    if (S.m === 'turn') return S.cur === me.pid;
    return false;
  }

  // جولة جديدة: نتابع إجابتي وإجابة قائدي
  function onRound() {
    endCbs = []; ended = false; mineAns = null; leadAns = null;
    if (offMine) { offMine(); offMine = null; }
    if (offLead) { offLead(); offLead = null; }
    if (!S || !S.r || (S.ph !== 'play' && S.ph !== 'lock' && S.ph !== 'reveal')) return;
    offMine = Net.watch(`${me.room}/a/${S.r}/${me.pid}`, (v) => { const was = mineAns; mineAns = v ? v.v : null; if (was !== mineAns && S.ph === 'play' && S.g === 'mines') render(true); });
    const m = whoAmI();
    if (S.m === 'team' && m.leader && !m.isLeader) {
      offLead = Net.watch(`${me.room}/a/${S.r}/${m.leader}`, (v) => { leadAns = v ? v.v : null; leadNote(); });
    }
    // لغمي (أو لغم فريقي) في الألغام
    if (S.g === 'mines') {
      const d = parse(S.d) || {};
      if (S.sub === 'place') myBomb = null;
      else if (d.pr && myBomb == null) {
        const who = d.unit === 'team' ? m.leader : me.pid;
        if (who) Net.get(`${me.room}/a/${d.pr}/${who}`).then((v) => { if (v) { myBomb = +v.v; render(true); } });
      }
    }
    if (S.ph === 'play' && (S.m !== 'turn' || S.cur === me.pid)) { FX.whistle(); F.vibrate(60); }
  }
  const parse = (j) => { try { return j ? JSON.parse(j) : null; } catch { return null; } };

  // ---------- العرض ----------
  function render(force) {
    if (!S || !P[me.pid]) return;
    const m = whoAmI();
    $('#meName').textContent = me.name;
    $('#meRoom').innerHTML = `<span class="tchip mini" style="--tc:${m.color}">${esc(m.teamName)}</span>${m.isLeader ? ' 👑 القائد' : ''}`;
    const key = [S.ph, S.r, S.sub, S.g, m.isLeader, m.leader, m.team, S.cur, (S.dw && S.dw[me.pid]) ? 1 : 0, S.ph === 'play' && S.g === 'mines' ? S.d : '', mineAns != null ? 1 : 0].join('|');
    if (!force && key === rendered) return;
    rendered = key;
    clearInterval(timer);
    if (S.ph === 'lobby') return waitView(`<div class="w-ico">⏳</div><h2>أهلًا ${esc(me.name)}</h2><p>أنت في فريق <span class="tchip" style="--tc:${m.color}">${esc(m.teamName)}</span>${m.isLeader ? '<br><b class="lead-badge">👑 أنت قائد الفريق</b>' : ''}</p><p class="muted">انتظر المقدّم يبدأ السِجَال…</p><button class="btn btn-ghost" id="chgTeam">غيّر فريقي</button>`, () => { $('#chgTeam').onclick = () => { watchers.forEach((w) => w()); watchers = []; teamScreen(true); }; });
    if (S.ph === 'intro') return introView(m);
    if (S.ph === 'board') return boardView(m);
    if (S.ph === 'end') return endView(m);
    if (S.g === 'mines') return minesView(m);
    if (S.ph === 'play' || S.ph === 'lock') return playView(m);
    if (S.ph === 'reveal') return revealView(m);
  }
  function waitView(html, after) {
    F.show('screen-wait');
    $('#waitCard').innerHTML = html;
    if (after) after();
  }
  function roleLine(g, m) {
    if (g.mode === 'team') return m.isLeader ? '<b class="lead-badge">👑 أنت القائد: تشاور مع فريقك وأرسل الإجابة</b>' : `<span class="muted">القائد ${m.leader && P[m.leader] ? '«' + esc(P[m.leader].n) + '»' : ''} يرسل، وأنت تشاور معه</span>`;
    if (g.mode === 'duel') return S.dw && S.dw[me.pid] ? '<b class="lead-badge">✏️ أنت رسّام فريقك!</b>' : `<span class="muted">رسّام فريقك: ${esc((Object.keys(S.dw || {}).filter((p) => P[p] && String(P[p].t) === m.team).map((p) => P[p].n)[0]) || '—')}</span>`;
    if (g.mode === 'mines') return parse(S.d) && parse(S.d).unit === 'solo' ? '<b class="lead-badge">💣 كل واحد يلعب بنفسه</b>' : (m.isLeader ? '<b class="lead-badge">👑 أنت تضغط عن فريقك</b>' : '<span class="muted">القائد يخبّي اللغم ويضغط عن الفريق</span>');
    return '<b class="lead-badge">📱 كلكم تجاوبون من جوالاتكم</b>';
  }
  function introView(m) {
    const g = G[S.g]; if (!g) return;
    waitView(`<div class="booth-sign small"><span class="b-ico">${g.ico}</span><h2>${esc(g.name)}</h2><span class="mode-badge m-${g.mode}">${GM.MODE_LABEL[g.mode]}</span></div>
      <p class="how">${esc(g.how)}</p><p>${roleLine(g, m)}</p><p class="muted">الفقرة ${ar((S.gi || 0) + 1)} من ${ar(S.gn || 1)}</p>`);
    FX.swoosh();
  }
  function bar(g, m) {
    const parts = [`<span class="pb-g">${g.ico} ${esc(g.name)}</span>`];
    if (S.rn) parts.push(`<small>${ar((S.ri || 0) + 1)}/${ar(S.rn)}</small>`);
    $('#pbar').innerHTML = `${parts.join('')}<span class="pb-role">${roleLine(g, m)}</span><span id="pTimer"></span>`;
  }
  function tickTimer(onView) {
    const t = () => {
      if (!S || S.ph !== 'play') { $('#pTimer') && ($('#pTimer').innerHTML = ''); return; }
      const left = (S.at + S.dl * 1000 - now()) / 1000;
      const el = $('#pTimer');
      if (el) el.innerHTML = S.at > now() ? F.ring(1, '…', 'pre') : F.ring(left / S.dl, F.clock(left), left <= 5 ? 'hot' : '');
      if (onView && S.vw && now() >= S.at + S.vw * 1000) { const f = onView; onView = null; f(); }
      if (!ended && left <= 1.3) { ended = true; endCbs.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
    };
    t(); timer = setInterval(t, 250);
  }

  function submit(v) {
    if (!S || (S.ph !== 'play' && S.ph !== 'lock')) { F.toast('انتهى الوقت'); return Promise.resolve(false); }
    const r = S.r;
    return Net.set(`${me.room}/a/${r}/${me.pid}`, { v: String(v), t: Net.TS })
      .then(() => { mineAns = String(v); FX.pop(700); F.vibrate(30); sentNote(); return true; })
      .catch((e) => { console.warn(e); F.toast(S && S.ph === 'play' ? 'ما وصلت، حاول مرة ثانية' : 'انتهى الوقت'); return false; });
  }
  function sentNote() {
    const n = $('#sentNote'); if (n) { n.hidden = false; n.textContent = 'وصلت إجابتك ✓'; }
  }
  function leadNote() {
    const n = $('#sentNote'); if (!n) return;
    if (leadAns != null) { n.hidden = false; n.textContent = 'أرسل القائد الإجابة ✓'; }
  }

  function playView(m) {
    const g = G[S.g]; if (!g) return;
    F.show('screen-game');
    bar(g, m);
    const el = $('#pgame');
    const d = parse(S.d) || {};
    const can = canAnswer(m) && S.ph === 'play';
    const inView = () => !!(S.vw && now() < S.at + S.vw * 1000);
    const view = inView();
    const draw = () => {
      const view = inView();
      el.innerHTML = '<div class="pg-body"></div><p class="sent-note" id="sentNote" hidden></p>';
      const body = $('.pg-body', el);
      const waitText = g.mode === 'duel' ? `يرسم الآن: ${Object.keys(S.dw || {}).map((p) => (P[p] ? P[p].n : '')).filter(Boolean).join('، ')}` : '';
      g.phone(body, { d, me: m, can, sent: mineAns, submit, view, r: S.r, P, T, waitText, onEnd: (f) => endCbs.push(f) });
      if (g.mode === 'team' && !m.isLeader) {
        body.insertAdjacentHTML('beforeend', `<p class="consult">🗣️ تشاوروا! ${m.leader && P[m.leader] ? 'القائد «' + esc(P[m.leader].n) + '» يرسل' : ''}</p>`);
        leadNote();
      }
      if (mineAns != null) sentNote();
      if (S.ph === 'lock') body.insertAdjacentHTML('beforeend', '<div class="judging">⏳ نجمع الإجابات…</div>');
    };
    draw();
    tickTimer(view ? () => { draw(); FX.swoosh(); } : null);
  }

  function myPts(m, rev) {
    const p = rev.pp && rev.pp[me.pid], t = rev.tp && rev.tp[m.team];
    return `<div class="my-pts">${p != null ? `<span>أنت <b>${plus(p)}</b></span>` : ''}<span class="tchip" style="--tc:${m.color}">${esc(m.teamName)} <b>${plus(t || 0)}</b></span></div>`;
  }
  function revealView(m) {
    const g = G[S.g]; if (!g) return;
    F.show('screen-game');
    bar(g, m);
    $('#pTimer').innerHTML = '';
    const d = parse(S.d) || {}, rev = parse(S.k) || {};
    const el = $('#pgame');
    el.innerHTML = '<div class="pg-body reveal"></div>';
    const body = $('.pg-body', el);
    try { g.phoneRev(body, { d, rev, me: m, P, T }); } catch (e) { console.error(e); }
    body.insertAdjacentHTML('afterbegin', myPts(m, rev));
    const got = (rev.pp && rev.pp[me.pid]) || (g.mode !== 'solo' && rev.tp && rev.tp[m.team]);
    if (got > 0) FX.right(); else FX.wrong();
  }

  // ---------- الألغام ----------
  function minesView(m) {
    const g = G.mines;
    F.show('screen-game');
    bar(g, m);
    const d = parse(S.d) || {}, el = $('#pgame');
    const n = d.n || 4;
    if (S.ph === 'reveal') {
      const rev = parse(S.k) || {};
      const bm = {}; Object.values(rev.bombs || {}).forEach((c) => { bm[c] = 1; });
      el.innerHTML = `<div class="pg-body reveal">${myPts(m, rev)}${GM.minesBoard({ n, rev: d.rev }, { bombs: bm, owners: rev.owners, T })}</div>`;
      $('#pTimer').innerHTML = '';
      return;
    }
    if (S.sub === 'place') {
      const can = canAnswer(m);
      const mark = mineAns != null ? +mineAns : -1;
      el.innerHTML = `<div class="pg-body"><p class="m-msg">${can ? (mark >= 0 ? 'خبّيت لغمك 💣 — تقدر تنتظر الباقين' : 'اضغط خانة تخبّي فيها لغمك 💣') : 'قائدكم يخبّي لغم الفريق… لا تقولون للفرق الثانية 🤫'}</p>
        ${GM.minesBoard({ n, rev: {} }, { mark, tap: can && mark < 0 })}</div>`;
      $$('.mcell', el).forEach((b) => b.addEventListener('click', () => {
        if (b.disabled) return;
        $$('.mcell', el).forEach((x) => { x.disabled = true; });
        b.classList.add('mine-mark'); b.textContent = '💣';
        submit(b.dataset.i);
      }));
      tickTimer();
      return;
    }
    // الأدوار
    const myTurn = S.cur === me.pid && S.ph === 'play';
    const iAmOut = (d.out || []).includes(d.unit === 'team' ? m.team : me.pid);
    const last = S.ph === 'lock' && d.last ? d.last : null;
    const nm = (ak) => (d.unit === 'team' ? (T[ak] ? T[ak].n : '') : (P[ak] ? P[ak].n : ''));
    el.innerHTML = `<div class="pg-body">
      ${last ? `<div class="m-flash ${last.boom ? 'boom' : 'ok'}">${last.boom ? `💥 انفجر على ${esc(nm(last.ak))}!` : `✓ ${esc(nm(last.ak))} نجا`}</div>`
      : myTurn ? '<div class="m-turn me">دورك! اختر خانة 👇</div>' : `<div class="m-turn">الدور على <b>${esc(nm(S.ak))}</b></div>`}
      ${iAmOut ? '<p class="m-msg out">انفجر عليكم لغم في هذي الجولة 💥</p>' : `<p class="m-msg">رصيدكم بالجولة: <b>${ar((d.pot || {})[d.unit === 'team' ? m.team : me.pid] || 0)}</b></p>`}
      ${GM.minesBoard({ n, rev: d.rev || {} }, { mark: myBomb != null ? myBomb : -1, tap: myTurn })}</div>`;
    if (myTurn) { F.vibrate([80, 60, 80]); FX.whistle(); }
    if (last && last.boom && last.ak === (d.unit === 'team' ? m.team : me.pid)) { FX.boom(); F.vibrate([100, 50, 200]); }
    $$('.mcell', el).forEach((b) => b.addEventListener('click', () => {
      if (b.disabled) return;
      $$('.mcell', el).forEach((x) => { x.disabled = true; });
      b.classList.add('picked');
      submit(b.dataset.i);
    }));
    tickTimer();
  }

  // ---------- النتائج والنهاية ----------
  function standings() {
    const sc = (SCORE && SCORE.T) || {};
    return F.teamList(T).map((t) => ({ t: t.id, n: t.n, c: t.c, pts: sc[t.id] || 0 })).sort((a, b) => b.pts - a.pts);
  }
  function boardView(m) {
    const st = standings();
    const pos = st.findIndex((x) => x.t === m.team);
    const g = G[S.g];
    waitView(`<div class="w-ico">${g ? g.ico : '📊'}</div><h2>نتائج ${g ? '«' + esc(g.name) + '»' : ''}</h2>
      <p>فريقك <span class="tchip" style="--tc:${m.color}">${esc(m.teamName)}</span> في المركز <b class="big-num">${ar(pos + 1)}</b></p>
      <ol class="mini-rank">${st.map((x) => `<li style="--tc:${x.c}" class="${x.t === m.team ? 'mine' : ''}"><b>${esc(x.n)}</b><span>${num(x.pts)}</span></li>`).join('')}</ol>
      ${SCORE && SCORE.P && SCORE.P[me.pid] ? `<p class="muted">نقاطك الشخصية: ${num(SCORE.P[me.pid])}</p>` : ''}`);
  }
  function endView(m) {
    const st = standings();
    const won = S.win != null && String(S.win) === m.team;
    waitView(`<div class="w-ico">${won ? '🏆' : '👏'}</div><h2>${won ? 'فزتوا!' : 'انتهى السِّجال'}</h2>
      <ol class="mini-rank">${st.map((x) => `<li style="--tc:${x.c}" class="${x.t === m.team ? 'mine' : ''}"><b>${esc(x.n)}</b><span>${num(x.pts)}</span></li>`).join('')}</ol>`);
    if (won) { window.AtharSound.winner(); F.confetti($('#confetti')); } else FX.clap(6);
  }

  // ---------- البدء ----------
  F.initChrome();
  Net.onStatus((on) => { $('#netDot').dataset.on = String(on); $('#netText').textContent = Net.local ? 'تجربة محلية' : on ? 'متصل' : 'غير متصل'; });
  Net.offset((v) => { offset = v; });
  window.addEventListener('storage', (e) => { if (e.key === F.THEME_KEY && e.newValue) document.documentElement.dataset.theme = e.newValue; });
  // رجوع تلقائي للغرفة نفسها
  (async () => {
    const r = qs.get('r');
    if (me && me.room && me.pid && (!r || r === me.room)) {
      try {
        const ex = await Net.get(`${me.room}/p/${me.pid}`);
        const s = await Net.get(`${me.room}/s`);
        if (ex && s) { start(); return; }
      } catch { /* تجاهل */ }
    }
  })();
})();
