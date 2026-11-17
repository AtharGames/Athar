/* =========================================================
   جرس أثَر | شاشة المقدّم
   بيانات الغرفة في قاعدة البيانات (buzzer/<الرمز>):
     s : الحالة { r: رقم جولة الجرس (يتغيّر مع كل فتح جديد)، n: رقم السؤال المعروض، a: الجرس مفتوح؟، m: الطريقة (q طابور / 1 الأسرع فقط)،
                  k: كم واحد جاوب غلط من الطابور، at: وقت فتح الجرس، c: وقت إنشاء الغرفة،
                  ex: المستبعدون من هذا السؤال }
     p : المشاركون { n: الاسم، j: وقت الدخول، on: متصل؟ }
     x : الممنوعون من الجرس
     b : الضغطات لكل سؤال { t: وقت الخادم }
   ========================================================= */
(() => {
  'use strict';
  const { diff, $, $$, S, store, ar, esc, secs, ordinal, colorOf, queueOf, initChrome, show, toast, confirmBox } = window.BuzzUI;
  const NET = window.BuzzNet;
  const HOST_KEY = 'athar-buzzer-host';
  const STALE = 12 * 60 * 60 * 1000; // غرفة أقدم من ١٢ ساعة تُعتبر منتهية

  const el = {
    netDot: $('#netDot'), netText: $('#netText'),
    resumeCard: $('#resumeCard'), resumeCode: $('#resumeCode'), resumeBtn: $('#resumeBtn'),
    createBtn: $('#createBtn'), joinLink: $('#joinLink'),
    qr: $('#qr'), joinUrl: $('#joinUrl'), roomCode: $('#roomCode'), copyBtn: $('#copyBtn'), endBtn: $('#endBtn'),
    stage: $('#stage'), roundPill: $('#roundPill'), modePill: $('#modePill'),
    waiting: $('#waiting'), waitTitle: $('#waitTitle'), waitText: $('#waitText'),
    winner: $('#winner'), winKicker: $('#winKicker'), winName: $('#winName'), winTime: $('#winTime'),
    queue: $('#queue'),
    resetBtn: $('#resetBtn'), wrongBtn: $('#wrongBtn'), wrongHint: $('#wrongHint'),
    armBtn: $('#armBtn'), armLabel: $('#armLabel'),
    peopleCount: $('#peopleCount'), peopleEmpty: $('#peopleEmpty'), peopleList: $('#peopleList')
  };

  let mode = 'q';        // الطريقة المختارة قبل فتح الغرفة
  let code = null;       // رمز الغرفة الحالية
  let room = null;       // آخر نسخة من بيانات الغرفة
  let stopWatch = null;
  let loaded = false;    // وصلت أول نسخة من الغرفة؟
  let busy = false;
  let lastRound = null, lastLen = 0;
  const seenRows = new Set(), seenPeople = new Set();
  let peopleSig = '', queueSig = '';

  const MODE_NAME = { q: 'طابور بالترتيب', 1: 'الأسرع فقط' };
  const extra = () => {
    // نحافظ على وسوم الاختبار في رابط المشاركين
    const src = new URLSearchParams(location.search), out = new URLSearchParams();
    ['net', 'fbemu'].forEach((k) => { if (src.get(k)) out.set(k, src.get(k)); });
    return out;
  };
  const joinLink = () => {
    const u = new URL('play.html', location.href);
    const q = extra(); q.set('r', code);
    u.search = q.toString(); u.hash = '';
    return u.href;
  };

  // ---------- إنشاء الغرفة ----------
  const randomCode = () => String(10000 + Math.floor(Math.random() * 90000));

  async function createRoom() {
    if (busy) return;
    busy = true; el.createBtn.disabled = true; el.createBtn.textContent = 'لحظة… نجهّز الغرفة';
    try {
      let c = null;
      for (let i = 0; i < 8 && !c; i++) {
        const tryCode = randomCode();
        const s = await NET.get(tryCode + '/s');
        if (!s) c = tryCode;
        else if (typeof s.c === 'number' && Date.now() - s.c > STALE) { await NET.remove(tryCode); c = tryCode; }
      }
      if (!c) throw new Error('no-code');
      await NET.set(c + '/s', { r: '1', n: 1, a: true, m: mode, k: 0, at: NET.TS, c: NET.TS });
      store.set(HOST_KEY, c);
      S.whoosh(true);
      openRoom(c);
    } catch (e) {
      console.warn('[buzzer] create', e && e.message);
      toast('ما قدرنا نفتح الغرفة، تأكد من الإنترنت وجرّب مرة ثانية');
    } finally {
      busy = false; el.createBtn.disabled = false; el.createBtn.textContent = 'افتح غرفة جديدة';
    }
  }

  function openRoom(c) {
    code = c; room = null; loaded = false;
    lastRound = null; lastLen = 0; peopleSig = queueSig = '';
    seenRows.clear(); seenPeople.clear();
    el.roomCode.textContent = c;
    const link = joinLink();
    el.joinUrl.textContent = link.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    el.qr.innerHTML = qrSVG(link);
    show('screen-room');
    if (stopWatch) stopWatch();
    stopWatch = NET.watch(c, onRoom);
    keepAwake();
  }

  function closeRoom(msg) {
    if (stopWatch) { stopWatch(); stopWatch = null; }
    code = null; room = null;
    store.del(HOST_KEY);
    el.resumeCard.hidden = true;
    show('screen-intro');
    if (msg) toast(msg);
  }

  function qrSVG(text) {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(text); q.make();
      return q.createSvgTag({ cellSize: 4, margin: 1, scalable: true, alt: 'رمز QR للدخول' });
    } catch { return ''; }
  }

  // ---------- استقبال بيانات الغرفة ----------
  function onRoom(data) {
    if (!data || !data.s) {
      if (loaded || data === null) closeRoom(loaded ? 'انتهت الغرفة' : 'الغرفة هذي ما عادت موجودة');
      return;
    }
    loaded = true;
    room = data;
    render();
  }

  // ---------- الرسم ----------
  function render() {
    const s = room.s, q = queueOf(room), k = Math.min(s.k || 0, Math.max(0, q.length - 1));
    const ex = s.ex || {}, hasEx = Object.keys(ex).length > 0;

    // أصوات وصول الضغطات
    if (lastRound !== s.r) { lastRound = s.r; lastLen = 0; seenRows.clear(); }
    if (q.length > lastLen) {
      if (lastLen === 0) {
        S.chirp(0, 3200); S.drop(520, 0.12);
        // وميض ذهبي على المسرح لأول ضغطة
        el.stage.classList.remove('flash'); void el.stage.offsetWidth; el.stage.classList.add('flash');
      } else S.drop(420);
    }
    lastLen = q.length;

    el.roundPill.textContent = `السؤال ${ar(s.n || s.r)}`;
    el.modePill.textContent = MODE_NAME[s.m] || MODE_NAME.q;
    $$('#roomModes .mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === s.m)));

    el.stage.dataset.state = q.length ? 'buzzed' : (s.a ? 'open' : 'closed');
    el.waiting.hidden = q.length > 0;
    el.winner.hidden = q.length === 0;

    if (!q.length) {
      el.waitTitle.textContent = s.a ? (hasEx ? 'الجرس مفتوح للبقية' : 'الجرس مفتوح') : 'الجرس مقفول';
      el.waitText.textContent = s.a ? 'بانتظار أول ضغطة…' : 'افتحه إذا جهزت للسؤال';
    } else {
      const cur = q[k], first = q[0];
      el.winKicker.textContent = k === 0 ? 'الأسرع' : `الدور الآن على ${ordinal(k)}`;
      el.winName.textContent = cur.name;
      el.winTime.innerHTML = timeText(q, k, s);
    }

    // الترتيب الكامل (يظهر من ثاني ضغطة)
    const sig = q.map((x) => x.pid + ':' + x.name).join('|') + '#' + k + '#' + s.r;
    if (sig !== queueSig) {
      queueSig = sig;
      el.queue.innerHTML = q.length < 2 ? '' : q.map((x, i) => {
        const fresh = !seenRows.has(x.pid);
        return `<li class="q-row${i < k ? ' done' : ''}${i === k ? ' now' : ''}${fresh ? ' in' : ''}" style="--c:${colorOf(x.pid)}">
          <span class="q-rank">${ar(i + 1)}</span>
          <span class="q-name">${esc(x.name)}</span>
          <span class="q-time">${i === 0 ? 'الأسرع' : diff(x.t - q[0].t)}</span>
        </li>`;
      }).join('');
      q.forEach((x) => seenRows.add(x.pid));
    }

    // أزرار المقدّم
    el.wrongBtn.disabled = q.length === 0;
    el.wrongHint.textContent = (q.length && k + 1 >= q.length) ? 'افتح الجرس للبقية' : 'الدور للي بعده';
    el.armBtn.setAttribute('aria-pressed', String(!!s.a));
    el.armLabel.innerHTML = s.a ? 'قفل الجرس<small>وقّفه مؤقتًا</small>' : 'فتح الجرس<small>مقفول الآن</small>';

    renderPeople(q, k);
  }

  function timeText(q, k, s) {
    const cur = q[k];
    if (k === 0) {
      const react = cur.t - (s.at || 0);
      return react >= 0 && react < 3600000 ? `ضغط بعد <b>${secs(react)}</b> ثانية من فتح الجرس` : 'أول ضغطة';
    }
    return `بفارق <b>${secs(cur.t - q[0].t)}</b> ثانية عن الأول`;
  }

  function renderPeople(q, k) {
    const p = room.p || {}, x = room.x || {}, ex = room.s.ex || {};
    const ids = Object.keys(p).sort((a, b) => (p[a].j || 0) - (p[b].j || 0) || (a < b ? -1 : 1));
    const rank = {};
    q.forEach((it, i) => { rank[it.pid] = i; });

    const rows = ids.map((id) => {
      const blocked = !!x[id], off = p[id].on === false;
      let note = '';
      if (blocked) note = 'ممنوع من الجرس';
      else if (id in rank) note = rank[id] < k ? 'جاوب غلط' : (rank[id] === k ? 'عليه الدور' : `ترتيبه ${ar(rank[id] + 1)}`);
      else if (ex[id]) note = 'جاوب غلط';
      else if (off) note = 'غير متصل';
      return { id, name: p[id].n || 'مشارك', blocked, off, note };
    });

    el.peopleCount.textContent = ar(rows.length);
    el.peopleEmpty.hidden = rows.length > 0;

    const sig = JSON.stringify(rows);
    if (sig === peopleSig) return;
    peopleSig = sig;
    el.peopleList.innerHTML = rows.map((r) => {
      const fresh = !seenPeople.has(r.id);
      return `<li class="person${r.blocked ? ' blocked' : ''}${r.off ? ' off' : ''}${fresh ? ' in' : ''}" data-pid="${r.id}">
        <span class="avatar" style="--c:${colorOf(r.id)}">${esc([...r.name][0] || '؟')}</span>
        <span class="p-text"><span class="p-name">${esc(r.name)}</span>${r.note ? `<span class="p-note">${r.note}</span>` : ''}</span>
        <button class="p-btn${r.blocked ? ' on' : ''}" data-act="block" aria-pressed="${r.blocked}">${r.blocked ? 'فك المنع' : 'منع'}</button>
        <button class="p-btn x" data-act="kick" aria-label="إخراج ${esc(r.name)} من الغرفة"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </li>`;
    }).join('');
    rows.forEach((r) => seenPeople.add(r.id));
  }

  // ---------- أوامر المقدّم ----------
  const fail = () => toast('ما وصل الأمر، تأكد من الإنترنت');

  // سؤال جديد: يصفّر الجرس للكل
  function reset() {
    if (!room) return;
    const r = room.s.r;
    S.whoosh(true);
    NET.update(code, {
      's/r': String(+r + 1), 's/n': (room.s.n || 1) + 1, 's/k': 0, 's/a': true, 's/at': NET.TS, 's/ex': null, ['b/' + r]: null
    }).catch(fail);
  }

  // إجابة خاطئة: الدور للي بعده، وإذا خلص الطابور ينفتح الجرس للبقية
  function wrong() {
    if (!room) return;
    const s = room.s, q = queueOf(room), k = s.k || 0;
    if (!q.length) return;
    S.sigh();
    if (k + 1 < q.length) {
      NET.update(code, { 's/k': k + 1 }).catch(fail);
      return;
    }
    const up = { 's/r': String(+s.r + 1), 's/k': 0, 's/a': true, 's/at': NET.TS, ['b/' + s.r]: null };
    q.forEach((it) => { up['s/ex/' + it.pid] = true; });
    NET.update(code, up).catch(fail);
  }

  function toggleArm() {
    if (!room) return;
    const a = !room.s.a;
    S.tongue();
    NET.update(code, a ? { 's/a': true, 's/at': NET.TS } : { 's/a': false }).catch(fail);
  }

  function setMode(m) {
    mode = m;
    $$('#introModes .mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    if (room && room.s.m !== m) NET.update(code, { 's/m': m }).catch(fail);
  }

  async function onPeopleClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn || !room) return;
    const pid = btn.closest('.person').dataset.pid;
    const name = (room.p && room.p[pid] && room.p[pid].n) || 'المشارك';
    if (btn.dataset.act === 'block') {
      const blocked = !!(room.x && room.x[pid]);
      S.tongue();
      (blocked ? NET.remove(`${code}/x/${pid}`) : NET.set(`${code}/x/${pid}`, true)).catch(fail);
      toast(blocked ? `رجّعنا الجرس لـ${name}` : `منعنا ${name} من الجرس`);
    } else {
      const ok = await confirmBox({
        title: `تطلّع ${name} من الغرفة؟`,
        text: 'يقدر يرجع يدخل بالرمز. إذا تبي توقفه بس، استخدم «منع».',
        yes: 'طلّعه', danger: true
      });
      if (ok) NET.update(code, { ['p/' + pid]: null, ['x/' + pid]: null }).catch(fail);
    }
  }

  async function endRoom() {
    const ok = await confirmBox({
      title: 'تنهي الغرفة؟',
      text: 'كل المشاركين بيطلعون منها، والرمز ما عاد يشتغل.',
      yes: 'أنهِ الغرفة', danger: true
    });
    if (!ok) return;
    const c = code;
    closeRoom('انتهت الغرفة');
    NET.remove(c).catch(() => {});
  }

  async function copyLink() {
    const link = joinLink();
    try {
      await navigator.clipboard.writeText(link);
      toast('انتسخ رابط الدخول');
    } catch {
      const t = document.createElement('textarea');
      t.value = link; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); toast('انتسخ رابط الدخول'); } catch { toast(link); }
      t.remove();
    }
  }

  // إبقاء الشاشة شغّالة طول الغرفة
  let wake = null;
  async function keepAwake() {
    try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch { /* تجاهل */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && code) keepAwake(); });

  // ---------- الربط ----------
  initChrome();
  NET.onStatus((on) => {
    el.netDot.dataset.on = String(on);
    el.netText.textContent = on ? (NET.local ? 'تجربة محلية' : 'مباشر') : 'غير متصل';
  });

  $$('#introModes .mode, #roomModes .mode').forEach((b) => b.addEventListener('click', () => { S.tongue(0, 0.2); setMode(b.dataset.mode); }));
  el.createBtn.addEventListener('click', createRoom);
  el.resetBtn.addEventListener('click', reset);
  el.wrongBtn.addEventListener('click', wrong);
  el.armBtn.addEventListener('click', toggleArm);
  el.copyBtn.addEventListener('click', copyLink);
  el.endBtn.addEventListener('click', endRoom);
  el.peopleList.addEventListener('click', onPeopleClick);

  // رابط المشارك يحمل وسوم الاختبار إن وُجدت
  const q0 = extra().toString();
  if (q0) el.joinLink.href = 'play.html?' + q0;

  // اختصارات لوحة المفاتيح للمقدّم: N سؤال جديد، X إجابة خاطئة، L قفل/فتح
  document.addEventListener('keydown', (e) => {
    if (!room || !$('#confirm').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === 'n') reset();
    else if (key === 'x') wrong();
    else if (key === 'l') toggleArm();
  });

  // غرفة سابقة على هذا الجهاز؟
  const saved = store.get(HOST_KEY);
  if (saved && /^\d{5}$/.test(saved)) {
    NET.get(saved + '/s').then((s) => {
      if (s && code === null) {
        el.resumeCode.textContent = saved;
        el.resumeCard.hidden = false;
        el.resumeBtn.onclick = () => openRoom(saved);
      } else if (!s) store.del(HOST_KEY);
    }).catch(() => {});
  }
})();
