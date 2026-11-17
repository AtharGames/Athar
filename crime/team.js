/* =========================================================
   مسرح جريمة | صفحة الفريق على الجوال
   تستقبل: الحالة العامة (pub) + حالة الفريق السرية (me)
   ترسل للمشرف: hello / pick / vote
   ========================================================= */
(() => {
  'use strict';
  const { $, $$, num, esc, ICONS, CATS, CK, CATMAP, catOf, nameOf, store, uid, cardHTML, S, initChrome, toast, pick } = window.Q;
  const NET = window.QadiyaNet;
  const CODE_KEY = 'athar-crime-code';

  let code = '', room = '', key = '';
  let pub = null, me = null, pubSeq = 0, meSeq = 0;
  let subs = [], conn = { p: false, m: false }, lastHello = 0;
  let notes = {}, seen = null, seenLost = null;
  let sel = {}, sentVote = 0, sentPick = '', sentAt = 0;

  const el = {
    joinForm: $('#joinForm'), codeInput: $('#codeInput'), joinError: $('#joinError'),
    meCard: $('#meCard'), meNo: $('#meNo'), meName: $('#meName'), meSub: $('#meSub'), netDot: $('#netDot'),
    banner: $('#banner'), pickBox: $('#pickBox'), pickOpts: $('#pickOpts'),
    voteBox: $('#voteBox'), voteTitle: $('#voteTitle'), voteHint: $('#voteHint'), voteForm: $('#voteForm'), voteSend: $('#voteSend'),
    resultBox: $('#resultBox'), hand: $('#hand'), lost: $('#lost'), notebook: $('#notebook'), log: $('#log')
  };

  const show = (id) => $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tm = (i) => (pub && pub.tm[i]) || ['', 'var(--accent)', 0];
  const cname = (id) => nameOf(pub ? pub.it : {}, id);

  // =========================================================
  // الدخول
  // =========================================================
  function join(c) {
    c = normCode(c);
    if (!/^[A-Z0-9]{9}$/.test(c)) {
      el.joinError.textContent = 'الرمز ٩ حروف وأرقام، مثل: ABCDE-FGHJ';
      el.joinError.hidden = false; S.sigh();
      return;
    }
    el.joinError.hidden = true;
    code = c; room = c.slice(0, 5); key = c.slice(5);
    store.set(CODE_KEY, code);
    if (location.hash.slice(1) !== code) history.replaceState(null, '', `${location.pathname}${location.search}#${code}`);
    notes = store.get(`athar-crime-notes-${code}`, {}) || {};
    pub = null; me = null; pubSeq = 0; meSeq = 0; seen = null; seenLost = null;
    subs.forEach((s) => s.close());
    conn = { p: false, m: false };
    subs = [
      NET.subscribe(`${room}-p`, onPub, { onStatus: (s) => { conn.p = s === 'on'; netState(); } }),
      NET.subscribe(`${room}-${key}`, onMe, { onStatus: (s) => { conn.m = s === 'on'; netState(); if (s === 'on') hello(); } })
    ];
    show('screen-team');
    S.tongue(0, 0.22);
    render();
  }

  function send(type, extra = {}) {
    return NET.publish(`${room}-u`, Object.assign({ type, room, k: key, mid: uid(8) }, extra));
  }
  function hello(force) {
    if (!force && Date.now() - lastHello < 15000) return;
    lastHello = Date.now();
    send('hello');
  }

  function netState() {
    const on = conn.p && conn.m;
    el.netDot.classList.toggle('on', on);
    el.netDot.title = on ? 'متصل' : 'جاري الاتصال…';
  }

  // =========================================================
  // استقبال الحالة
  // =========================================================
  function onPub(m) {
    if (!m || m.k !== 'pub' || !(m.s > pubSeq)) return;
    pubSeq = m.s; pub = m;
    render();
  }
  function onMe(m) {
    if (!m || m.k !== 'me' || !(m.s > meSeq)) return;
    meSeq = m.s; me = m;
    render();
  }

  // =========================================================
  // العرض
  // =========================================================
  function render() {
    if (!me || !pub || pub.id !== me.id) {
      el.meName.textContent = 'جاري الاتصال بالمشرف…';
      el.meSub.textContent = `رمز الفريق: ${code.slice(0, 5)}-${code.slice(5)}`;
      el.banner.innerHTML = '<span class="spinner" aria-hidden="true"></span> ننتظر شاشة المشرف… تأكدوا إن اللعبة مفتوحة عنده.';
      el.banner.className = 'banner';
      [el.pickBox, el.voteBox, el.resultBox].forEach((b) => { b.hidden = true; });
      el.hand.innerHTML = ''; el.notebook.innerHTML = ''; el.log.innerHTML = ''; el.lost.innerHTML = '';
      return;
    }
    const [name, color] = tm(me.t);
    document.documentElement.style.setProperty('--team', color);
    el.meCard.style.setProperty('--c', color);
    el.meNo.textContent = num(me.t + 1);
    el.meName.textContent = name;
    el.meSub.textContent = `بيدكم ${num(me.hd.length)} أوراق، تعرفون ${num(me.kn.length)}`;

    checkNewCards();
    renderBanner();
    renderPick();
    renderVote();
    renderResult();

    el.hand.innerHTML = me.hd.map((id) => cardHTML(pub.it, id)).join('') || '<p class="muted">ما بقي بيدكم أوراق</p>';
    el.lost.innerHTML = me.ls.map(([id, to]) => `<li>خذ <b style="--c:${tm(to)[1]}">${esc(tm(to)[0])}</b> منكم «${esc(cname(id))}»</li>`).join('');
    renderNotebook();
    el.log.innerHTML = pub.lg.length ? [...pub.lg].reverse().map(logLine).join('') : '<li class="muted">ما صار شي للحين</li>';
  }

  function logLine(e) {
    const c = (i) => `<b style="--c:${tm(i)[1]}">${esc(tm(i)[0])}</b>`;
    if (e.k === 'take') return `<li>${c(e.a)} خذوا ورقة من ${c(e.b)}</li>`;
    if (e.k === 'hint') return `<li>${c(e.a)} خذوا تلميحًا من الملف</li>`;
    if (e.k === 'miss') return `<li class="muted">${c(e.a)} ما وفّقوا في السؤال</li>`;
    if (e.k === 'revote') return '<li class="muted">ولا فريق عرف القاتل… إعادة التصويت</li>';
    if (e.k === 'extra') return '<li class="muted">نجمع أوراق أكثر قبل التصويت</li>';
    return '';
  }

  function banner(html, hot) {
    el.banner.innerHTML = html;
    el.banner.className = 'banner' + (hot ? ' hot' : '');
  }

  function renderBanner() {
    const tu = pub.tu, mine = tu && tu.t === me.t;
    const who = tu ? `<b style="--c:${tm(tu.t)[1]}">${esc(tm(tu.t)[0])}</b>` : '';
    switch (pub.ph) {
      case 'prep': case 'lobby': case 'deal':
        return banner('انضممتوا ✓ بطاقاتكم تحت. انتظروا المشرف يبدأ التحقيق.');
      case 'play':
        if (tu.st === 'idle') return banner('المشرف يوزّع الأوراق… استعدوا، يمكن تكون لكم');
        if (tu.st === 'ask') return mine ? banner('دوركم! السؤال عليكم، ركّزوا', true) : banner(`الدور على ${who}، السؤال ${num(tu.r)} من ${num(tu.R)}`);
        if (tu.st === 'pick') return mine ? banner('كفو! لكم ورقة… اختاروا الخصم تحت', true) : banner(`${who} لهم ورقة ويختارون خصم…`);
        if (tu.st === 'card') return banner(mine ? 'وصلتكم ورقة جديدة! شوفوا دفتر المحقق' : `${who} خذوا ورقة`, mine);
        return banner('خلصت فقرة الأسئلة… جهّزوا اتهامكم');
      case 'vote':
        return me.vr === pub.vr ? banner('وصل اتهامكم ✓ انتظروا لحظة الحقيقة على الشاشة') : banner('وقت التصويت! من القاتل؟', true);
      case 'reveal':
        return pub.rv && !pub.rv.ok ? banner('أفا! ولا فريق عرف القاتل… القاتل لسّه طليق، انتظروا المشرف') : banner('لحظة الحقيقة… شوفوا الشاشة!', true);
      case 'tie':
        return banner('تعادل! سؤال الحسم على الشاشة', true);
      case 'over':
        return banner('انحلّت القضية!', true);
    }
  }

  // ---------- اختيار الخصم ----------
  function renderPick() {
    const tu = pub.tu;
    const on = pub.ph === 'play' && tu && tu.st === 'pick' && tu.t === me.t;
    el.pickBox.hidden = !on;
    if (!on) return;
    const waiting = sentPick === tu.tok;
    el.pickOpts.innerHTML = pub.tm.map(([n, c, h], i) => i === me.t ? '' : `<button class="opp" style="--c:${c}" data-opp="${i}" ${tu.op.includes(i) && !waiting ? '' : 'disabled'}>
      <b>${esc(n)}</b><small>${tu.op.includes(i) ? `عنده ${num(h)} أوراق` : 'ما عنده جديد لكم'}</small></button>`).join('')
      + (waiting ? '<p class="muted wide-row"><span class="spinner" aria-hidden="true"></span> أرسلنا اختياركم…</p>' : '');
  }
  el.pickOpts.addEventListener('click', (e) => {
    const b = e.target.closest('[data-opp]');
    if (!b || b.disabled || !pub.tu) return;
    sentPick = pub.tu.tok;
    send('pick', { tok: pub.tu.tok, opp: +b.dataset.opp });
    S.tongue(0, 0.25);
    renderPick();
    // إذا ما تغيّرت الحالة خلال ٨ ثوانٍ نسمح بالمحاولة مرة ثانية
    setTimeout(() => { if (pub && pub.tu && pub.tu.st === 'pick' && sentPick === pub.tu.tok) { sentPick = ''; renderPick(); } }, 8000);
  });

  // ---------- التصويت ----------
  function renderVote() {
    const on = pub.ph === 'vote' && me.vr !== pub.vr;
    el.voteBox.hidden = !on;
    if (!on) return;
    if (sentVote === pub.vr && Date.now() - sentAt < 9000) {
      el.voteForm.innerHTML = '<p class="muted"><span class="spinner" aria-hidden="true"></span> جاري إرسال اتهامكم…</p>';
      el.voteSend.hidden = true;
      return;
    }
    el.voteSend.hidden = false;
    el.voteTitle.textContent = pub.vr > 1 ? 'أعيدوا الاتهام' : 'اتهامكم النهائي';
    el.voteHint.textContent = pub.wk.length ? `طلعوا من قائمة القتلة: ${pub.wk.map((i) => pub.it.killer[i]).join('، ')}` : 'اختاروا واحد من كل نوع، ثم أرسلوا.';
    if (sel.killer != null && pub.wk.includes(sel.killer)) delete sel.killer;
    el.voteForm.innerHTML = CATS.map((c) => `<fieldset class="pick-row"><legend><span class="ev-ico">${ICONS[c.k]}</span>${c.name}</legend>
      <div class="pick-chips">${pub.it[c.k].map((n, i) => {
        const id = `${c.k}:${i}`;
        const out = c.k === 'killer' && pub.wk.includes(i);
        const known = me.kn.some((x) => x[0] === id);
        return `<button type="button" class="pchip${known ? ' known' : ''}" data-k="${c.k}" data-i="${i}" aria-pressed="${sel[c.k] === i}" ${out ? 'disabled' : ''}>${esc(n)}</button>`;
      }).join('')}</div></fieldset>`).join('');
    el.voteSend.disabled = !CK.every((k) => sel[k] != null);
  }
  el.voteForm.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b || b.disabled) return;
    sel[b.dataset.k] = +b.dataset.i;
    S.tongue(0, 0.18);
    renderVote();
  });
  el.voteSend.addEventListener('click', () => {
    const known = CK.filter((k) => me.kn.some((x) => x[0] === `${k}:${sel[k]}`));
    const warn = known.length ? `انتبهوا: اخترتوا بطاقات تعرفون إنها مو من القضية (${known.map((k) => cname(`${k}:${sel[k]}`)).join('، ')}).` : 'بعد الإرسال ما تقدرون تغيّرون.';
    ask('نرسل الاتهام؟', `${CATS.map((c) => `${c.name}: ${pub.it[c.k][sel[c.k]]}`).join('، ')}. ${warn}`, 'إيه، أرسل', () => {
      sentVote = pub.vr; sentAt = Date.now();
      send('vote', { r: pub.vr, g: Object.assign({}, sel) });
      S.drop(620);
      renderVote();
      setTimeout(render, 9200);
    });
  });

  // ---------- النتيجة ----------
  function renderResult() {
    const r = pub.res;
    el.resultBox.hidden = !r;
    if (!r) return;
    const w = r.w >= 0 ? tm(r.w) : null;
    const meWin = r.w === me.t;
    el.resultBox.innerHTML = `${w ? `<h2 class="${meWin ? 'win-title' : ''}" style="--c:${w[1]}">${meWin ? 'مبروك يا أبطال! فزتوا' : `الفائز: ${esc(w[0])}`}</h2>` : '<h2>الحل الصحيح</h2>'}
      <div class="cards-grid sol">${CK.map((k) => cardHTML(pub.it, `${k}:${r.sol[k]}`)).join('')}</div>`;
    if (meWin && !renderResult.cheered) { renderResult.cheered = true; S.winner(); }
  }

  // ---------- دفتر المحقق ----------
  function renderNotebook() {
    const kn = new Map(me.kn.map((x) => [x[0], x[1]]));
    const sol = pub.res ? pub.res.sol : null;
    el.notebook.innerHTML = CATS.map((c) => `<div class="nb-col" data-cat="${c.k}">
      <div class="col-head"><span class="ev-ico">${ICONS[c.k]}</span><b>${c.name}</b></div>
      <div class="nb-items">${pub.it[c.k].map((n, i) => {
        const id = `${c.k}:${i}`;
        let cls = '', tag = '';
        if (sol && sol[c.k] === i) { cls = 'sol'; tag = 'الحل'; }
        else if (kn.has(id)) {
          const f = kn.get(id);
          cls = 'known';
          tag = f === -1 ? (me.hd.includes(id) ? 'بطاقتكم' : 'كانت عندكم') : f === -2 ? 'تلميح' : `من ${tm(f)[0]}`;
        } else if (c.k === 'killer' && pub.wk.includes(i)) { cls = 'known'; tag = 'استُبعد بالتصويت'; }
        else if (notes[id]) cls = notes[id];
        return `<button type="button" class="nb-item ${cls}" data-id="${id}" ${cls === 'known' || cls === 'sol' ? 'disabled' : ''}>
          <span>${esc(n)}</span>${tag ? `<small>${esc(tag)}</small>` : cls === 'x' ? '<small>مستبعد</small>' : cls === 'q' ? '<small>مشتبه</small>' : ''}</button>`;
      }).join('')}</div></div>`).join('');
  }
  el.notebook.addEventListener('click', (e) => {
    const b = e.target.closest('.nb-item');
    if (!b || b.disabled) return;
    const id = b.dataset.id;
    notes[id] = notes[id] === 'x' ? 'q' : notes[id] === 'q' ? '' : 'x';
    if (!notes[id]) delete notes[id];
    store.set(`athar-crime-notes-${code}`, notes);
    S.tongue(0, 0.15);
    renderNotebook();
  });

  // ---------- البطاقات الجديدة ----------
  function checkNewCards() {
    const skey = `athar-crime-seen-${code}-${me.id}`;
    if (!seen) { seen = store.get(skey, null); seenLost = store.get(skey + '-lost', []); }
    const ids = me.kn.map((x) => x[0]);
    if (!seen) {
      seen = ids;
      store.set(skey, seen);
      showCards('وصلت بطاقاتكم!', 'كل بطاقة عندكم تعني إنها مو من القضية. خبّوها عن الفرق الثانية.', ids);
    } else {
      const fresh = ids.filter((id) => !seen.includes(id));
      if (fresh.length) {
        seen = ids; store.set(skey, seen);
        const f = me.kn.find((x) => x[0] === fresh[0])[1];
        const src = f === -2 ? 'تلميح من الملف' : f >= 0 ? `من ${tm(f)[0]}` : '';
        showCards('ورقة جديدة!', `${src ? src + ': ' : ''}«${cname(fresh[0])}» ${CATMAP[catOf(fresh[0])].not}.`, fresh);
      }
    }
    const lostIds = me.ls.map((x) => x[0]);
    const newLost = me.ls.filter((x) => !seenLost.includes(x[0]));
    if (newLost.length) {
      seenLost = lostIds; store.set(skey + '-lost', seenLost);
      newLost.forEach(([id, to]) => toast(`أفا! ${tm(to)[0]} خذوا منكم «${cname(id)}»`, tm(to)[1]));
      S.sigh();
    }
  }

  function showCards(title, text, ids) {
    $('#cardTitle').textContent = title;
    $('#cardText').textContent = text;
    $('#cardShow').className = 'cards-grid' + (ids.length === 1 ? ' one' : '');
    $('#cardShow').innerHTML = ids.map((id) => cardHTML(pub.it, id, { cls: 'flip' })).join('');
    $('#cardModal').hidden = false;
    S.whoosh(); S.chirp(0.3);
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) try { navigator.vibrate(60); } catch { /* تجاهل */ }
    setTimeout(() => $('#cardOk').focus(), 30);
  }
  $('#cardOk').addEventListener('click', () => { $('#cardModal').hidden = true; });

  // ---------- تأكيد ----------
  let confirmCb = null;
  function ask(title, text, yes, cb) {
    $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; $('#confirmYes').textContent = yes;
    confirmCb = cb; $('#confirm').hidden = false;
    setTimeout(() => $('#confirmYes').focus(), 30);
  }
  $('#confirmYes').addEventListener('click', () => { $('#confirm').hidden = true; const f = confirmCb; confirmCb = null; f && f(); });
  $('#confirmNo').addEventListener('click', () => { $('#confirm').hidden = true; confirmCb = null; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { $('#confirm').hidden = true; $('#cardModal').hidden = true; }
  });

  $('#leaveBtn').addEventListener('click', () => ask('تبي تطلع من الفريق؟', 'تقدر ترجع بنفس الرمز في أي وقت.', 'إيه، طلّعني', () => {
    subs.forEach((s) => s.close()); subs = [];
    store.del(CODE_KEY);
    history.replaceState(null, '', location.pathname + location.search);
    code = ''; el.codeInput.value = '';
    show('screen-join');
  }));

  el.joinForm.addEventListener('submit', (e) => { e.preventDefault(); join(el.codeInput.value); });
  el.codeInput.addEventListener('input', () => {
    const c = normCode(el.codeInput.value).slice(0, 9);
    el.codeInput.value = c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
  });
  window.addEventListener('hashchange', () => { const h = normCode(location.hash.slice(1)); if (h && h !== code) join(h); });

  // =========================================================
  // تشغيل
  // =========================================================
  initChrome();
  const start = normCode(location.hash.slice(1)) || store.get(CODE_KEY, '');
  if (start) join(start);
})();
