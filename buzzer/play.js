/* =========================================================
   جرس أثَر | صفحة المشارك (الجوال)
   يدخل برمز الغرفة واسمه، ثم يضغط الجرس.
   الضغطة تُكتب مرة واحدة بوقت الخادم، والترتيب يُحسب منه.
   ========================================================= */
(() => {
  'use strict';
  const { $, S, store, ar, toLatin, esc, secs, ordinal, queueOf, initChrome, show, toast, confirmBox } = window.BuzzUI;
  const NET = window.BuzzNet;
  const ME_KEY = 'athar-buzzer-me';

  const el = {
    netDot: $('#netDot'), meName: $('#meName'), meRoom: $('#meRoom'),
    form: $('#joinForm'), code: $('#codeInput'), name: $('#nameInput'), joinBtn: $('#joinBtn'), error: $('#joinError'),
    wrap: $('#bellWrap'), title: $('#statusTitle'), text: $('#statusText'),
    bell: $('#bell'), label: $('#bellLabel'), mini: $('#miniQueue'), leave: $('#leaveBtn')
  };

  let me = null;          // { room, name, pid }
  let room = null;        // آخر نسخة من بيانات الغرفة
  let stopWatch = null;
  let seenSelf = false;   // ظهرت في قائمة المشاركين؟
  let pending = null;     // رقم السؤال اللي ضغطت فيه وما وصل تأكيده
  let lastState = '', lastKey = '';
  let online = false, busy = false;

  const newPid = () => {
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    const buf = new Uint8Array(10);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    buf.forEach((b) => { s += a[b % a.length]; });
    return s;
  };
  const loadMe = () => { try { return JSON.parse(store.get(ME_KEY) || 'null'); } catch { return null; } };
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* تجاهل */ } };

  // ---------- الدخول ----------
  function showError(msg) {
    el.error.textContent = msg; el.error.hidden = !msg;
  }

  async function join(code, name, pid, silent) {
    if (busy) return;
    busy = true; el.joinBtn.disabled = true; el.joinBtn.textContent = 'لحظة… ندخّلك';
    showError('');
    try {
      const s = await NET.get(code + '/s');
      if (!s) {
        if (silent) store.del(ME_KEY);
        else showError('ما لقينا غرفة بهذا الرمز. تأكد من الأرقام اللي على الشاشة.');
        return;
      }
      await NET.set(`${code}/p/${pid}`, { n: name, j: NET.TS, on: true });
      me = { room: code, name, pid };
      store.set(ME_KEY, JSON.stringify(me));
      NET.presence(`${code}/p/${pid}/on`, true, false).catch(() => {});
      enter();
    } catch (e) {
      console.warn('[buzzer] join', e && e.message);
      if (!silent) showError('ما قدرنا ندخّلك، تأكد من الإنترنت وجرّب مرة ثانية.');
    } finally {
      busy = false; el.joinBtn.disabled = false; el.joinBtn.textContent = 'ادخل الغرفة';
    }
  }

  function enter() {
    room = null; seenSelf = false; pending = null; lastState = ''; lastKey = '';
    el.meName.textContent = me.name;
    el.meRoom.textContent = `غرفة ${me.room}`;
    setState('wait', 'لحظة…', 'نوصّلك بالغرفة', 'انتظر');
    el.mini.innerHTML = '';
    show('screen-bell');
    if (stopWatch) stopWatch();
    stopWatch = NET.watch(me.room, onRoom);
    keepAwake();
  }

  function exit(msg) {
    if (stopWatch) { stopWatch(); stopWatch = null; }
    const last = me;
    me = null; room = null;
    store.del(ME_KEY);
    el.meName.textContent = 'جرس أثَر';
    el.meRoom.textContent = 'ادخل برمز الغرفة';
    if (last) { el.code.value = last.room; el.name.value = last.name; }
    show('screen-join');
    showError(msg || '');
  }

  // ---------- استقبال بيانات الغرفة ----------
  function onRoom(data) {
    if (!me) return;
    if (!data || !data.s) { exit('المقدّم أنهى الغرفة. إذا فتح غرفة جديدة ادخل برمزها.'); return; }
    const mine = data.p && data.p[me.pid];
    if (mine) seenSelf = true;
    else if (seenSelf) { exit('المقدّم طلّعك من الغرفة.'); return; }
    room = data;
    render();
  }

  // ---------- الحالة والرسم ----------
  function setState(state, title, text, label) {
    el.wrap.dataset.state = state;
    el.title.textContent = title;
    el.text.textContent = text;
    el.label.textContent = label;
    el.bell.setAttribute('aria-disabled', String(state !== 'ready'));
  }

  function render() {
    const s = room.s, q = queueOf(room);
    const k = Math.min(s.k || 0, Math.max(0, q.length - 1));
    const idx = q.findIndex((x) => x.pid === me.pid);
    const blocked = !!(room.x && room.x[me.pid]);
    const excluded = !!(s.ex && s.ex[me.pid]);
    if (pending !== null && (pending !== s.r || idx >= 0)) pending = null;

    let state;
    if (blocked) {
      state = 'blocked';
      setState(state, 'موقوف مؤقتًا', 'المقدّم منعك من الجرس', 'ممنوع');
    } else if (idx >= 0 && idx === k) {
      state = 'first';
      const react = q[0].t - (s.at || 0);
      setState(state, k === 0 ? 'أنت الأول!' : 'دورك الآن!',
        k === 0 ? (react >= 0 && react < 3600000 ? `ضغطت بعد ${secs(react)} ثانية` : 'جاوب بسرعة') : 'اللي قبلك ما جاوب صح',
        'جاوب!');
    } else if (idx > k) {
      state = 'rank';
      setState(state, `أنت ${ordinal(idx)}`, `بفارق ${secs(q[idx].t - q[0].t)} ثانية عن الأول`, ar(idx + 1));
    } else if (idx >= 0 || excluded) {
      state = 'done';
      setState(state, 'خلصت محاولتك', 'انتظر السؤال الجاي', 'انتظر');
    } else if (pending !== null) {
      state = 'rank';
      setState(state, 'انضغط!', 'نحسب ترتيبك…', '…');
    } else if (!s.a) {
      state = 'wait';
      setState(state, 'الجرس مقفول', 'انتظر المقدّم يفتحه', 'انتظر');
    } else if (s.m === '1' && q.length) {
      state = 'locked';
      setState(state, `سبقك ${q[0].name}`, 'الجرس انقفل على البقية', 'مقفول');
    } else {
      state = 'ready';
      setState(state, 'اضغط الجرس!', q.length ? `سبقك ${q[0].name}، اضغط واحجز دورك` : 'أول من يضغط هو اللي يجاوب', 'اضغط');
    }

    // تنبيه عند تغيّر الحال
    const key = state + ':' + s.r + ':' + k;
    if (key !== lastKey) {
      if (state === 'first') { S.chirp(0, 3300); vibrate([90, 60, 90]); }
      else if (state === 'ready' && lastState && lastState !== 'ready') { S.whoosh(true); vibrate(30); }
      else if ((state === 'locked' || state === 'done') && lastState === 'ready') S.sigh();
      else if (state === 'blocked') vibrate(120);
      lastKey = key; lastState = state;
    }

    renderMini(q, k, idx);
  }

  // أول ثلاثة + ترتيبي إن كنت أبعد
  function renderMini(q, k, idx) {
    const row = (x, i) => `<li class="${i === idx ? 'me ' : ''}${i === k ? 'now ' : ''}${i < k ? 'done' : ''}">
      <span class="q-rank">${ar(i + 1)}</span>
      <span class="q-name">${esc(x.name)}${i === idx ? ' (أنت)' : ''}</span>
      <span class="q-time">${i === 0 ? 'الأسرع' : '+' + secs(x.t - q[0].t) + ' ث'}</span>
    </li>`;
    let html = q.slice(0, 3).map(row).join('');
    if (idx > 2) html += row(q[idx], idx);
    else if (q.length > 3) html += `<li class="more">و${ar(q.length - 3)} غيرهم بالطابور</li>`;
    if (el.mini.dataset.sig !== html) { el.mini.dataset.sig = html; el.mini.innerHTML = html; }
  }

  // ---------- الضغطة ----------
  function press(e) {
    if (e) e.preventDefault();
    if (!me || !room) return;
    el.bell.classList.add('down');
    setTimeout(() => el.bell.classList.remove('down'), 140);

    if (el.wrap.dataset.state !== 'ready') {
      // مقفول: هزّة خفيفة بدون تسجيل
      el.bell.classList.remove('shake'); void el.bell.offsetWidth; el.bell.classList.add('shake');
      return;
    }
    const r = room.s.r;
    pending = r;
    S.tongue(0, 0.35);
    vibrate(40);
    render();
    NET.set(`${me.room}/b/${r}/${me.pid}`, { t: NET.TS }).catch(() => {
      if (pending === r) {
        pending = null;
        if (room) render();
        toast(online ? 'ما انحسبت الضغطة' : 'النت مقطوع، ما وصلت الضغطة');
      }
    });
  }

  async function leave() {
    const ok = await confirmBox({ title: 'تطلع من الغرفة؟', text: 'تقدر ترجع تدخل بنفس الرمز.', yes: 'اطلع', danger: true });
    if (!ok || !me) return;
    const { room: c, pid } = me;
    exit('');
    NET.remove(`${c}/p/${pid}`).catch(() => {});
  }

  // إبقاء شاشة الجوال شغّالة
  let wake = null;
  async function keepAwake() {
    try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch { /* تجاهل */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && me) keepAwake(); });

  // ---------- الربط ----------
  initChrome();
  NET.onStatus((on) => {
    online = on;
    el.netDot.dataset.on = String(on);
    // بعد رجوع الاتصال نرجّع علامة «متصل» (تُرفض تلقائيًا لو أُخرج من الغرفة)
    if (on && me) NET.presence(`${me.room}/p/${me.pid}/on`, true, false).catch(() => {});
  });

  el.code.addEventListener('input', () => { el.code.value = toLatin(el.code.value).replace(/\D/g, '').slice(0, 5); showError(''); });
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = toLatin(el.code.value).replace(/\D/g, '');
    const name = el.name.value.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (code.length !== 5) { showError('رمز الغرفة خمسة أرقام.'); el.code.focus(); return; }
    if (!name) { showError('اكتب اسمك أو اسم فريقك.'); el.name.focus(); return; }
    S.tongue(0, 0.2); // يفتح الصوت على الجوال من أول لمسة
    const old = loadMe();
    join(code, name, (old && old.room === code && old.pid) || newPid(), false);
  });

  // pointerdown أسرع من click على الجوال
  el.bell.addEventListener('pointerdown', press);
  el.bell.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) press(e); });
  el.bell.addEventListener('contextmenu', (e) => e.preventDefault());
  el.leave.addEventListener('click', leave);

  // تعبئة الرمز من الرابط (QR) والرجوع التلقائي بعد تحديث الصفحة
  const urlCode = toLatin(new URLSearchParams(location.search).get('r') || '').replace(/\D/g, '').slice(0, 5);
  const saved = loadMe();
  if (urlCode) el.code.value = urlCode;
  if (saved && saved.name) el.name.value = saved.name;
  if (saved && /^\d{5}$/.test(saved.room || '') && saved.pid && saved.name && (!urlCode || urlCode === saved.room)) {
    el.code.value = saved.room;
    join(saved.room, saved.name, saved.pid, true);
  } else if (urlCode) {
    el.name.focus();
  }
})();
