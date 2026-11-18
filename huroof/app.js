/* =========================================================
   إنسان حيوان جماد | شاشة المقدّم
   بيانات الغرفة في قاعدة البيانات (huroof/<الرمز>):
     s : الحالة والإعدادات { c: وقت الإنشاء، ph: المرحلة، r: رقم الجولة (نص)، L: حرف الجولة، at: وقت بدايتها،
                            dl: وقت الجولة بالثواني (٠ بدون)، R: عدد الجولات (٠ مفتوح)، pu/pd: نقاط الوحيدة/المكررة،
                            all: لازم تعبئة كل الخانات قبل التسليم؟، xl: حروف مستبعدة، used: حروف استُخدمت، cats: الخانات }
       المراحل: lobby انتظار ← pick اختيار الحرف ← play كتابة ← stop قف! ← grade تصحيح ← show نتيجة ← end الفائز
     p : المشاركون { n: الاسم، j: وقت الدخول، on: متصل؟ }
     a : الإجابات لكل جولة { <الجولة>: { <المشارك>: { v: {رقم الخانة: الإجابة}، d: سلّم؟، t } } }
     f : أول تسليم لكل جولة { p: المشارك (أو _host إذا أوقفها المقدّم أو خلص الوقت)، t: وقت الخادم }
     g : النتيجة المعتمدة لكل جولة { L: الحرف، s: { <المشارك>: [نقاط كل خانة] } }
   ========================================================= */
(() => {
  'use strict';
  const H = window.HUI;
  const { $, $$, S, FX, store, ar, esc, plus, clock, LETTERS, HARD, DEFAULT_CATS, SUGGEST, MAX_CATS,
    autoMarks, pointsOf, sum, asList, catsOf, roundsDone, ranking, colorOf, rollLetter, initChrome, show, toast, confirmBox, confetti, keepAwake, MARK } = H;
  const NET = window.HuroofNet;
  const HOST_KEY = 'athar-huroof-host';
  const CFG_KEY = 'athar-huroof-cfg';
  const STALE = 12 * 60 * 60 * 1000;   // غرفة أقدم من ١٢ ساعة تُعتبر منتهية
  const GATHER = 3800;                  // مهلة جمع آخر الإجابات بعد «قف!» (القواعد تسمح ٥ ثوانٍ)

  const el = {
    netDot: $('#netDot'), netText: $('#netText'), heroLetter: $('#heroLetter'),
    resumeCard: $('#resumeCard'), resumeCode: $('#resumeCode'), resumeBtn: $('#resumeBtn'),
    settings: $('#settings'), settingsHome: $('#settingsHome'),
    catsList: $('#catsList'), catForm: $('#catForm'), catInput: $('#catInput'), suggest: $('#suggest'), catsReset: $('#catsReset'), catsHint: $('#catsHint'),
    segR: $('#segR'), segT: $('#segT'), allInput: $('#allInput'), puVal: $('#puVal'), pdVal: $('#pdVal'),
    lettersPick: $('#lettersPick'), lettersHint: $('#lettersHint'),
    createBtn: $('#createBtn'),
    room: $('#room'), joinbar: $('#joinbar'), qr: $('#qr'), joinUrl: $('#joinUrl'), roomCode: $('#roomCode'),
    copyBtn: $('#copyBtn'), settingsBtn: $('#settingsBtn'), endBtn: $('#endBtn'),
    stage: $('#stage'), roundPill: $('#roundPill'), timerPill: $('#timerPill'),
    bigLetter: $('#bigLetter'), pickTitle: $('#pickTitle'), pickText: $('#pickText'), rollBtn: $('#rollBtn'), startBtn: $('#startBtn'), lettersManual: $('#lettersManual'),
    playLetter: $('#playLetter'), playText: $('#playText'), timebar: $('#timebar'), timefill: $('#timefill'), progress: $('#progress'), forceStopBtn: $('#forceStopBtn'),
    stopWho: $('#stopWho'), stopText: $('#stopText'),
    gradeLetter: $('#gradeLetter'), gradeTable: $('#gradeTable'), approveBtn: $('#approveBtn'), lgOk: $('#lgOk'), lgDup: $('#lgDup'),
    showLetter: $('#showLetter'), showTitle: $('#showTitle'), showText: $('#showText'), board: $('#board'),
    nextBtn: $('#nextBtn'), regradeBtn: $('#regradeBtn'), sheetBtn: $('#sheetBtn'), finishBtn: $('#finishBtn'),
    winName: $('#winName'), winPts: $('#winPts'), finalBoard: $('#finalBoard'), totalsTable: $('#totalsTable'), againBtn: $('#againBtn'),
    peopleCount: $('#peopleCount'), peopleEmpty: $('#peopleEmpty'), peopleList: $('#peopleList'),
    confetti: $('#confetti'),
    setModal: $('#settingsModal'), setSlot: $('#settingsSlot'), setNote: $('#setNote'), setSave: $('#setSave'), setCancel: $('#setCancel'),
    sheetModal: $('#sheetModal'), roundsTable: $('#roundsTable'), sheetClose: $('#sheetClose')
  };

  // =========================================================
  // الإعدادات
  // =========================================================
  const DEFAULT_CFG = { cats: DEFAULT_CATS.slice(), R: 5, dl: 0, pu: 10, pd: 5, all: true, xl: HARD };
  function loadCfg() {
    try {
      const c = JSON.parse(store.get(CFG_KEY) || 'null');
      if (c && Array.isArray(c.cats) && c.cats.length) return Object.assign({}, DEFAULT_CFG, c);
    } catch { /* تجاهل */ }
    return JSON.parse(JSON.stringify(DEFAULT_CFG));
  }
  let cfg = loadCfg();
  let draft = cfg;          // النسخة اللي تعدّلها اللوحة الحين
  let lockCats = false;     // الخانات مقفولة بعد أول جولة
  const saveCfg = () => store.set(CFG_KEY, JSON.stringify(cfg));
  const onDraft = () => { if (draft === cfg) saveCfg(); };

  function renderSettings() {
    // الخانات: «حرف» أولًا و«مجموع» آخرًا ثابتتان
    el.catsList.innerHTML = '<span class="cat fixed">حرف</span>' + draft.cats.map((c, i) => `
      <span class="cat" data-i="${i}">
        <input type="text" value="${esc(c)}" maxlength="16" aria-label="اسم الخانة ${ar(i + 1)}" ${lockCats ? 'disabled' : ''}>
        ${lockCats ? '' : `<button type="button" class="cat-x" aria-label="احذف ${esc(c)}" ${draft.cats.length <= 1 ? 'disabled' : ''}>×</button>`}
      </span>`).join('') + '<span class="cat fixed sum">مجموع</span>';
    el.catForm.hidden = lockCats || draft.cats.length >= MAX_CATS;
    el.catsReset.hidden = lockCats;
    el.catsHint.textContent = lockCats ? 'تنقفل بعد أول جولة' : `${ar(draft.cats.length)} من ${ar(MAX_CATS)}`;
    el.suggest.innerHTML = lockCats || draft.cats.length >= MAX_CATS ? '' :
      SUGGEST.filter((x) => !draft.cats.includes(x)).slice(0, 8).map((x) => `<button type="button">+ ${esc(x)}</button>`).join('');
    $$('button', el.segR).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === draft.R)));
    $$('button', el.segT).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === draft.dl)));
    el.allInput.checked = !!draft.all;
    el.puVal.textContent = ar(draft.pu);
    el.pdVal.textContent = ar(draft.pd);
    el.lettersPick.innerHTML = LETTERS.map((L) => `<button type="button" class="lt${draft.xl.includes(L) ? ' off' : ''}" data-l="${L}" aria-pressed="${!draft.xl.includes(L)}">${L}</button>`).join('');
    const n = LETTERS.length - draft.xl.length;
    el.lettersHint.textContent = draft.xl ? `${ar(n)} حرفًا (مستبعد: ${[...draft.xl].join(' ')})` : 'كل الحروف';
  }

  function bindSettings() {
    el.catsList.addEventListener('input', (e) => {
      const chip = e.target.closest('.cat[data-i]'); if (!chip) return;
      const v = e.target.value.trim();
      if (v) { draft.cats[+chip.dataset.i] = v; onDraft(); }
    });
    el.catsList.addEventListener('change', () => renderSettings());
    el.catsList.addEventListener('click', (e) => {
      const x = e.target.closest('.cat-x'); if (!x || draft.cats.length <= 1) return;
      draft.cats.splice(+x.closest('.cat').dataset.i, 1);
      FX.scribble(2); onDraft(); renderSettings();
    });
    el.catForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addCat(el.catInput.value);
      el.catInput.value = '';
    });
    el.suggest.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (b) addCat(b.textContent.replace('+', ''));
    });
    el.catsReset.addEventListener('click', () => { draft.cats = DEFAULT_CATS.slice(); S.whoosh(false); onDraft(); renderSettings(); });
    el.segR.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; draft.R = +b.dataset.v; S.tongue(0, 0.2); onDraft(); renderSettings(); });
    el.segT.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; draft.dl = +b.dataset.v; S.tongue(0, 0.2); onDraft(); renderSettings(); });
    el.allInput.addEventListener('change', () => { draft.all = el.allInput.checked; S.tongue(0, 0.2); onDraft(); });
    $$('.stepper', el.settings).forEach((st) => st.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const k = st.dataset.key;
      draft[k] = Math.max(0, Math.min(100, draft[k] + +b.dataset.d));
      S.tongue(0, 0.2); onDraft(); renderSettings();
    }));
    el.lettersPick.addEventListener('click', (e) => {
      const b = e.target.closest('.lt'); if (!b) return;
      const L = b.dataset.l;
      if (draft.xl.includes(L)) draft.xl = draft.xl.replace(L, '');
      else if (LETTERS.length - draft.xl.length > 1) draft.xl += L;
      FX.flip(); onDraft(); renderSettings();
    });
  }
  function addCat(v) {
    v = String(v || '').trim().slice(0, 16);
    if (!v || lockCats || draft.cats.length >= MAX_CATS) return;
    if (draft.cats.includes(v)) { toast('الخانة موجودة'); return; }
    draft.cats.push(v);
    FX.scribble(3); onDraft(); renderSettings();
  }

  // =========================================================
  // الغرفة
  // =========================================================
  let code = null, room = null, stopWatch = null, loaded = false, busy = false;
  let offset = 0;                 // فرق الساعة عن الخادم
  let chosen = null;              // الحرف المختار للجولة القادمة
  let rolling = false;
  let lastPh = '', lastR = '', stopping = false, gatherTimer = 0, tickTimer = 0;
  let ov = {};                    // تعديلات المقدّم على التصحيح الآلي { pid: {i: mark} }
  const seenPeople = new Set(), doneSeen = new Set();
  const now = () => Date.now() + offset;

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
      await NET.set(c + '/s', {
        c: NET.TS, ph: 'lobby', r: '0', L: '', used: '',
        cats: cfg.cats.slice(), R: cfg.R, dl: cfg.dl, pu: cfg.pu, pd: cfg.pd, all: !!cfg.all, xl: cfg.xl
      });
      store.set(HOST_KEY, c);
      S.whoosh(true);
      openRoom(c);
    } catch (e) {
      console.warn('[huroof] create', e && e.message);
      toast('ما قدرنا نفتح الغرفة، تأكد من الإنترنت وجرّب مرة ثانية');
    } finally {
      busy = false; el.createBtn.disabled = false; el.createBtn.textContent = 'افتح غرفة جديدة';
    }
  }

  function openRoom(c) {
    code = c; room = null; loaded = false; chosen = null;
    lastPh = lastR = ''; stopping = false; ov = {};
    seenPeople.clear(); doneSeen.clear();
    el.roomCode.textContent = c;
    const link = joinLink();
    el.joinUrl.textContent = link.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    el.qr.innerHTML = qrSVG(link);
    el.bigLetter.textContent = '؟';
    show('screen-room');
    if (stopWatch) stopWatch();
    stopWatch = NET.watch(c, onRoom);
    keepAwake();
  }

  function closeRoom(msg) {
    if (stopWatch) { stopWatch(); stopWatch = null; }
    clearTimeout(gatherTimer); clearInterval(tickTimer);
    code = null; room = null;
    store.del(HOST_KEY);
    el.resumeCard.hidden = true;
    closeSettings();
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

  function onRoom(data) {
    if (!data || !data.s) {
      if (loaded || data === null) closeRoom(loaded ? 'انتهت الغرفة' : 'الغرفة هذي ما عادت موجودة');
      return;
    }
    loaded = true;
    room = data;
    render();
  }

  // ---------- أدوات قراءة الحالة ----------
  const players = () => {
    const p = (room && room.p) || {};
    return Object.keys(p).map((pid) => ({ pid, name: p[pid].n, on: p[pid].on !== false, j: p[pid].j || 0 }))
      .sort((a, b) => a.j - b.j || (a.pid < b.pid ? -1 : 1));
  };
  const nameOf = (pid) => (room.p && room.p[pid] && room.p[pid].n) || 'مشارك';
  const answersOf = (r) => (room.a && room.a[r]) || {};
  const firstOf = (r) => (room.f && room.f[r]) || null;
  const lastRound = (s) => s.R > 0 && +s.r >= s.R;
  const pool = (s) => {
    const xl = s.xl || '', used = s.used || '';
    let p = LETTERS.filter((L) => !xl.includes(L) && !used.includes(L));
    if (!p.length) p = LETTERS.filter((L) => !xl.includes(L)); // خلصت الحروف: نسمح بالتكرار
    return p;
  };

  // =========================================================
  // الرسم حسب المرحلة
  // =========================================================
  function render() {
    const s = room.s, ph = s.ph, cats = catsOf(s);
    const panel = ph === 'lobby' ? 'pick' : ph;
    el.room.dataset.ph = ph;
    el.joinbar.classList.toggle('compact', s.r !== '0' || ph !== 'lobby');
    $$('.panel', el.stage).forEach((p) => p.classList.toggle('active', p.id === 'ph-' + panel));

    // رقم الجولة
    const rNum = ph === 'lobby' || ph === 'pick' ? +s.r + 1 : +s.r;
    el.roundPill.textContent = ph === 'lobby' && s.r === '0' ? 'بانتظار البداية' : `الجولة ${ar(rNum)}${s.R ? ` من ${ar(s.R)}` : ''}`;
    if (ph === 'end') el.roundPill.textContent = `انتهت بعد ${ar(roundsDone(room).length)} جولات`;

    // انتقالات المراحل: أصوات ومؤقتات
    const changed = ph !== lastPh || s.r !== lastR;
    if (changed) onEnter(ph, s, lastPh);
    lastPh = ph; lastR = s.r;

    renderPeople(s, cats);
    if (panel === 'pick') renderPick(s);
    if (ph === 'play') renderPlay(s, cats);
    if (ph === 'stop') renderStop(s);
    if (ph === 'grade') renderGrade(s, cats);
    if (ph === 'show') renderShow(s);
    if (ph === 'end') renderEnd(s);
  }

  function onEnter(ph, s, prev) {
    clearTimeout(gatherTimer);
    clearInterval(tickTimer);
    el.timerPill.hidden = true;
    if (ph === 'play') {
      stopping = false; doneSeen.clear();
      if (prev && prev !== 'play') { FX.flip(); S.whoosh(true, 0.05); }
      el.playLetter.textContent = s.L;
      tickTimer = setInterval(tick, 200); tick();
    }
    if (ph === 'stop') {
      if (prev === 'play') { FX.whistle(); el.stage.classList.remove('jolt'); void el.stage.offsetWidth; el.stage.classList.add('jolt'); }
      // بعد مهلة الجمع ننتقل للتصحيح تلقائيًا
      const f = firstOf(s.r);
      const wait = f && typeof f.t === 'number' ? Math.max(600, f.t + GATHER - now()) : GATHER;
      gatherTimer = setTimeout(() => {
        if (room && room.s.ph === 'stop' && room.s.r === s.r) NET.update(code + '/s', { ph: 'grade' }).catch(() => {});
      }, wait);
    }
    if (ph === 'grade') {
      loadOv(s.r);
      if (prev === 'stop') FX.scribble(4);
    }
    if (ph === 'show' && prev === 'grade') { S.chirp(0.05); }
    if (ph === 'end' && prev && prev !== 'end') {
      S.winner();
      setTimeout(() => confetti(el.confetti, { y: 0.3 }), 250);
    }
    if (ph === 'pick' || ph === 'lobby') {
      if (prev === 'show') { chosen = null; el.bigLetter.textContent = '؟'; el.bigLetter.classList.remove('landed'); }
    }
  }

  // ---------- اختيار الحرف ----------
  function renderPick(s) {
    const ps = players(), nextR = +s.r + 1;
    el.pickTitle.textContent = chosen ? `حرف الجولة: ${chosen}` : (s.r === '0' ? 'اسحب حرف أول جولة' : 'اسحب حرف الجولة');
    const info = [];
    info.push(ps.length ? `${ar(ps.length)} مشارك في الغرفة` : 'بانتظار المشاركين…');
    info.push(s.dl ? `الوقت ${clock(s.dl)}` : 'بدون وقت');
    info.push(catsOf(s).join(' · '));
    el.pickText.textContent = info.join('  •  ');
    el.startBtn.disabled = !chosen || !ps.length || rolling;
    el.startBtn.textContent = chosen ? `ابدأ الجولة ${ar(nextR)} بحرف «${chosen}»` : 'ابدأ الجولة';
    el.rollBtn.disabled = rolling;
    const used = s.used || '', xl = s.xl || '';
    const sig = used + '|' + xl + '|' + chosen;
    if (el.lettersManual.dataset.sig !== sig) {
      el.lettersManual.dataset.sig = sig;
      el.lettersManual.innerHTML = LETTERS.map((L) => {
        const cls = ['lt', used.includes(L) ? 'used' : '', xl.includes(L) ? 'off' : '', chosen === L ? 'sel' : ''].join(' ');
        return `<button type="button" class="${cls}" data-l="${L}" title="${used.includes(L) ? 'استُخدم قبل' : ''}">${L}</button>`;
      }).join('');
    }
  }

  async function roll() {
    if (rolling || !room) return;
    rolling = true; renderPick(room.s);
    const p = pool(room.s);
    if (p.length === LETTERS.length - (room.s.xl || '').length && (room.s.used || '').length) toast('خلصت الحروف، نرجع نسحب من البداية');
    const L = p[(Math.random() * p.length) | 0];
    await rollLetter(el.bigLetter, L, { pool: p.length > 3 ? p : LETTERS });
    chosen = L; rolling = false;
    if (room) renderPick(room.s);
  }

  function pickManual(L) {
    if (rolling) return;
    chosen = L;
    el.bigLetter.textContent = L;
    el.bigLetter.classList.remove('landed'); void el.bigLetter.offsetWidth; el.bigLetter.classList.add('landed');
    S.drop(420, 0, 0.22);
    renderPick(room.s);
  }

  async function startRound() {
    const s = room.s;
    if (!chosen || busy) return;
    busy = true;
    try {
      const r = String(+s.r + 1);
      const used = (s.used || '').includes(chosen) ? s.used : (s.used || '') + chosen;
      await NET.remove(`${code}/a/${r}`).catch(() => {});
      await NET.update(code + '/s', { ph: 'play', r, L: chosen, at: NET.TS, used: used.slice(-80) });
      chosen = null;
    } catch (e) {
      console.warn('[huroof] start', e && e.message);
      toast('ما قدرنا نبدأ، تأكد من الإنترنت');
    } finally { busy = false; }
  }

  // ---------- الجولة شغّالة ----------
  function renderPlay(s, cats) {
    const ans = answersOf(s.r), ps = players();
    let done = 0;
    el.progress.innerHTML = ps.map((p) => {
      const a = ans[p.pid] || {}, v = a.v || {};
      const n = cats.reduce((k, _, i) => k + ((v[i] || '').trim() ? 1 : 0), 0);
      if (a.d) {
        done++;
        if (!doneSeen.has(p.pid)) { doneSeen.add(p.pid); S.tongue(0, 0.3); }
      }
      const dots = cats.map((_, i) => `<i class="${(v[i] || '').trim() ? 'on' : ''}"></i>`).join('');
      return `<li class="${a.d ? 'done' : ''}${p.on ? '' : ' off'}" style="--c:${colorOf(p.pid)}">
        <span class="pg-name">${esc(p.name)}</span><span class="dots">${dots}</span>
        <span class="pg-n">${a.d ? 'سلّم' : `${ar(n)}/${ar(cats.length)}`}</span></li>`;
    }).join('') || '<li class="empty muted">ما فيه مشاركين في الغرفة</li>';
    el.playText.textContent = done ? 'وصل التسليم…' : `أول من يسلّم يوقف الكل${s.all ? ' (بعد ما يعبّي كل الخانات)' : ''}.`;

    // أول تسليم: ننتقل لمرحلة «قف!»
    const f = firstOf(s.r);
    if (f && !stopping) {
      stopping = true;
      NET.update(code + '/s', { ph: 'stop' }).catch(() => { stopping = false; });
    }
  }

  function tick() {
    if (!room || room.s.ph !== 'play') return;
    const s = room.s;
    if (!s.dl || typeof s.at !== 'number') { el.timebar.hidden = true; el.timerPill.hidden = true; return; }
    const left = (s.at + s.dl * 1000 - now()) / 1000;
    el.timebar.hidden = false; el.timerPill.hidden = false;
    el.timefill.style.transform = `scaleX(${Math.max(0, Math.min(1, left / s.dl))})`;
    el.timerPill.textContent = clock(left);
    el.timerPill.classList.toggle('hurry', left <= 10);
    if (left <= 0) stopNow();
  }

  let stopReq = '';               // طلب إيقاف من المقدّم لهذي الجولة
  function stopNow() {
    if (!room || room.s.ph !== 'play') return;
    const r = room.s.r;
    if (firstOf(r) || stopReq === r) return;
    stopReq = r;
    NET.set(`${code}/f/${r}`, { p: '_host', t: NET.TS }).catch(() => { stopReq = ''; });
  }

  // ---------- قف! ----------
  function renderStop(s) {
    const f = firstOf(s.r);
    if (!f) { el.stopWho.textContent = ''; return; }
    if (f.p === '_host') {
      const timeUp = s.dl && typeof s.at === 'number' && f.t >= s.at + s.dl * 1000 - 400;
      el.stopWho.textContent = timeUp ? 'خلص الوقت!' : 'المقدّم أوقف الجولة';
    } else {
      const secs = typeof s.at === 'number' ? Math.max(0, Math.round((f.t - s.at) / 1000)) : null;
      el.stopWho.innerHTML = `<b style="--c:${colorOf(f.p)}">${esc(nameOf(f.p))}</b> سلّم أول${secs !== null ? ` بعد ${clock(secs)}` : ''}`;
    }
    el.stopText.textContent = 'نجمع الأوراق…';
  }

  // ---------- التصحيح ----------
  const ovKey = (r) => `athar-huroof-ov-${code}-${r}`;
  function loadOv(r) { try { ov = JSON.parse(store.get(ovKey(r)) || '{}') || {}; } catch { ov = {}; } }
  const saveOv = (r) => store.set(ovKey(r), JSON.stringify(ov));

  function marksFor(s, cats) {
    const ans = answersOf(s.r), ps = players();
    const all = {};
    ps.forEach((p) => { all[p.pid] = (ans[p.pid] && ans[p.pid].v) || {}; });
    const auto = autoMarks(all, cats.length, s.L);
    const out = {};
    ps.forEach((p) => {
      out[p.pid] = auto[p.pid].map((m, i) => (m !== 'empty' && ov[p.pid] && ov[p.pid][i]) || m);
    });
    return { all, marks: out };
  }

  function renderGrade(s, cats) {
    const { all, marks } = marksFor(s, cats), ps = players(), f = firstOf(s.r);
    el.gradeLetter.textContent = s.L;
    el.lgOk.textContent = ar(s.pu); el.lgDup.textContent = ar(s.pd);
    el.gradeTable.innerHTML = `<thead><tr><th class="who">الاسم</th>${cats.map((c) => `<th>${esc(c)}</th>`).join('')}<th class="sum">مجموع</th></tr></thead><tbody>${
      ps.map((p) => {
        const m = marks[p.pid], v = all[p.pid];
        const tot = m.reduce((k, x) => k + pointsOf(x, s), 0);
        return `<tr><th class="who" style="--c:${colorOf(p.pid)}"><span>${esc(p.name)}</span>${f && f.p === p.pid ? '<small class="first">سلّم أول</small>' : ''}</th>${
          cats.map((_, i) => {
            const a = (v[i] || '').trim(), mk = m[i];
            return `<td><button type="button" class="cell ${mk}" data-pid="${p.pid}" data-i="${i}" ${mk === 'empty' ? 'disabled' : ''} aria-label="${esc(a || 'فاضية')}: ${MARK[mk].label}">
              <span class="ans">${a ? esc(a) : '—'}</span><span class="mk"><i>${MARK[mk].sym}</i>${ar(pointsOf(mk, s))}</span></button></td>`;
          }).join('')
        }<td class="sum"><b>${ar(tot)}</b></td></tr>`;
      }).join('') || `<tr><td colspan="${cats.length + 2}" class="muted">ما فيه مشاركين</td></tr>`
    }</tbody>`;
  }

  function cycleCell(pid, i) {
    const s = room.s, cats = catsOf(s);
    const { marks } = marksFor(s, cats);
    const cur = marks[pid] && marks[pid][i];
    if (!cur || cur === 'empty') return;
    const next = { ok: 'dup', dup: 'bad', bad: 'ok' }[cur];
    ov[pid] = ov[pid] || {};
    ov[pid][i] = next;
    saveOv(s.r);
    if (next === 'bad') FX.scribble(2, 0, 0.2); else FX.scribble(1, 0, 0.18);
    renderGrade(s, cats);
  }

  async function approve() {
    if (busy) return;
    const s = room.s, cats = catsOf(s);
    const { marks } = marksFor(s, cats);
    const sc = {};
    Object.keys(marks).forEach((pid) => { sc[pid] = marks[pid].map((m) => pointsOf(m, s)); });
    busy = true; el.approveBtn.disabled = true;
    try {
      await NET.set(`${code}/g/${s.r}`, { L: s.L, s: sc });
      await NET.update(code + '/s', { ph: 'show' });
    } catch (e) {
      console.warn('[huroof] approve', e && e.message);
      toast('ما قدرنا نحفظ النتيجة، جرّب مرة ثانية');
    } finally { busy = false; el.approveBtn.disabled = false; }
  }

  // ---------- نتيجة الجولة ----------
  function renderShow(s) {
    const g = (room.g && room.g[s.r]) || { s: {} }, list = ranking(room);
    el.showLetter.textContent = s.L;
    el.showTitle.textContent = `نتيجة جولة حرف «${s.L}»`;
    el.showText.textContent = lastRound(s) ? 'هذي آخر جولة، جاهزين لإعلان الفائز؟' : 'المجموع وصل لورقة كل مشارك.';
    const sig = JSON.stringify([s.r, list.map((x) => [x.pid, x.total, x.on])]);
    if (el.board.dataset.sig !== sig) {
      el.board.dataset.sig = sig;
      el.board.innerHTML = list.map((x, k) => {
        const rp = sum(g.s && g.s[x.pid]);
        return `<li style="--c:${colorOf(x.pid)}; --d:${k * 70}ms" class="${x.rank === 1 && x.total > 0 ? 'top' : ''}">
          <span class="b-rank">${ar(x.rank)}</span><span class="b-name">${esc(x.name)}</span>
          <span class="b-round">${plus(rp)}</span><span class="b-total">${ar(x.total)}</span></li>`;
      }).join('') || '<li class="muted">ما فيه مشاركين</li>';
    }
    el.nextBtn.textContent = lastRound(s) ? 'أعلن الفائز' : 'الجولة التالية';
    el.finishBtn.hidden = lastRound(s);
  }

  // ---------- الفائز ----------
  function renderEnd() {
    const list = ranking(room);
    const top = list.filter((x) => x.rank === 1);
    el.winName.textContent = top.length ? top.map((x) => x.name).join(' و ') : 'ما فيه مشاركين';
    el.winPts.textContent = top.length ? `${ar(top[0].total)} نقطة${top.length > 1 ? ' (تعادل)' : ''}` : '';
    el.finalBoard.innerHTML = list.map((x, k) => `<li style="--c:${colorOf(x.pid)}; --d:${k * 90}ms" class="${x.rank === 1 ? 'top' : ''}">
      <span class="b-rank">${ar(x.rank)}</span><span class="b-name">${esc(x.name)}</span><span class="b-total">${ar(x.total)}</span></li>`).join('');
    el.totalsTable.innerHTML = roundsTableHTML();
  }

  // جدول الجولات: صف لكل مشارك وعمود لكل حرف ثم المجموع
  function roundsTableHTML() {
    const rs = roundsDone(room), list = ranking(room);
    if (!rs.length) return '<tbody><tr><td class="muted">ما فيه جولات معتمدة للحين</td></tr></tbody>';
    return `<thead><tr><th class="who">الاسم</th>${rs.map((r) => `<th class="lt-h">${esc(room.g[r].L)}</th>`).join('')}<th class="sum">مجموع</th></tr></thead><tbody>${
      list.map((x) => `<tr><th class="who" style="--c:${colorOf(x.pid)}"><span>${esc(x.name)}</span></th>${
        rs.map((r) => { const v = room.g[r].s && room.g[r].s[x.pid]; return `<td class="num">${v ? ar(sum(v)) : '—'}</td>`; }).join('')
      }<td class="sum"><b>${ar(x.total)}</b></td></tr>`).join('')
    }</tbody>`;
  }

  // ---------- المشاركون ----------
  let peopleSig = '';
  function renderPeople(s, cats) {
    const list = ranking(room), ans = answersOf(s.r), f = firstOf(s.r);
    el.peopleCount.textContent = ar(list.length);
    el.peopleEmpty.hidden = list.length > 0;
    const note = (x) => {
      if (s.ph === 'play' || s.ph === 'stop') {
        const a = ans[x.pid] || {}, v = a.v || {};
        if (f && f.p === x.pid) return 'سلّم أول';
        if (a.d) return 'سلّم';
        return `كتب ${ar(cats.filter((_, i) => (v[i] || '').trim()).length)} من ${ar(cats.length)}`;
      }
      return x.on ? 'متصل' : 'غير متصل';
    };
    const sig = JSON.stringify([s.ph, list.map((x) => [x.pid, x.name, x.on, x.total, note(x)])]);
    if (sig === peopleSig) return;
    peopleSig = sig;
    list.forEach((x) => { if (!seenPeople.has(x.pid)) { if (loadedPeople) S.drop(560, 0, 0.2); seenPeople.add(x.pid); } });
    loadedPeople = true;
    el.peopleList.innerHTML = list.map((x) => `
      <li class="person${x.on ? '' : ' off'}" style="--c:${colorOf(x.pid)}">
        <span class="avatar">${esc([...x.name][0] || '؟')}</span>
        <span class="p-text"><span class="p-name">${esc(x.name)}</span><span class="p-note">${esc(note(x))}</span></span>
        <span class="p-pts" title="المجموع">${ar(x.total)}</span>
        <button class="p-btn x" data-kick="${x.pid}" aria-label="طلّع ${esc(x.name)} من الغرفة">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </li>`).join('');
  }
  let loadedPeople = false;

  // =========================================================
  // الأزرار
  // =========================================================
  async function nextRound() {
    const s = room.s;
    if (lastRound(s)) return finish(true);
    chosen = null;
    await NET.update(code + '/s', { ph: 'pick', L: '' }).catch(() => toast('ما قدرنا ننتقل، جرّب مرة ثانية'));
  }

  async function finish(skipAsk) {
    if (!skipAsk) {
      const ok = await confirmBox({ title: 'ننهي اللعبة ونعلن الفائز؟', text: 'تنحسب الجولات المعتمدة فقط.', yes: 'أعلن الفائز' });
      if (!ok) return;
    }
    await NET.update(code + '/s', { ph: 'end' }).catch(() => toast('ما قدرنا ننهي، جرّب مرة ثانية'));
  }

  async function again() {
    const ok = await confirmBox({ title: 'لعبة جديدة؟', text: 'تتصفر النقاط والحروف، والمشاركون يبقون في الغرفة.', yes: 'ابدأ من جديد' });
    if (!ok) return;
    try {
      await NET.remove(code + '/a'); await NET.remove(code + '/f'); await NET.remove(code + '/g');
      await NET.update(code + '/s', { ph: 'lobby', r: '0', L: '', used: '' });
      chosen = null; el.bigLetter.textContent = '؟';
      S.whoosh(true);
    } catch { toast('ما قدرنا نصفّر، جرّب مرة ثانية'); }
  }

  async function forceStop() {
    const ok = await confirmBox({ title: 'نوقف الجولة الحين؟', text: 'تنقفل الأوراق على اللي كتبوه وننتقل للتصحيح.', yes: 'أوقفها', danger: true });
    if (ok) stopNow();
  }

  async function kick(pid) {
    const ok = await confirmBox({ title: `نطلّع ${nameOf(pid)}؟`, text: 'يقدر يرجع يدخل بالرمز، ونقاطه السابقة تبقى محفوظة إذا رجع من نفس الجوال.', yes: 'طلّعه', danger: true });
    if (ok) NET.remove(`${code}/p/${pid}`).catch(() => {});
  }

  async function endRoom() {
    const ok = await confirmBox({ title: 'ننهي الغرفة؟', text: 'يطلع كل المشاركين وتنحذف النتائج.', yes: 'أنهِ الغرفة', danger: true });
    if (!ok) return;
    try { await NET.remove(code); } catch { /* تجاهل */ }
    closeRoom('انتهت الغرفة');
  }

  function copyLink() {
    const link = joinLink();
    const done = () => { toast('انتسخ رابط الدخول'); S.tongue(0, 0.25); };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done).catch(() => toast(link));
    else toast(link);
  }

  // ---------- نافذة الإعدادات داخل الغرفة ----------
  function openSettings() {
    const s = room.s;
    draft = { cats: catsOf(s), R: s.R || 0, dl: s.dl || 0, pu: s.pu, pd: s.pd, all: !!s.all, xl: s.xl || '' };
    lockCats = s.r !== '0' || !['lobby', 'pick'].includes(s.ph);
    el.setNote.textContent = s.ph === 'play' ? 'الجولة شغّالة: التعديل يطبّق من الحين.' : '';
    el.setSlot.appendChild(el.settings);
    renderSettings();
    el.setModal.hidden = false;
  }
  function closeSettings() {
    el.setModal.hidden = true;
    if (el.settings.parentNode !== el.settingsHome) el.settingsHome.appendChild(el.settings);
    draft = cfg; lockCats = false;
    renderSettings();
  }
  async function saveSettings() {
    const d = draft;
    d.cats = d.cats.map((c) => c.trim()).filter(Boolean).slice(0, MAX_CATS);
    if (!d.cats.length) d.cats = DEFAULT_CATS.slice();
    const patch = { R: d.R, dl: d.dl, pu: d.pu, pd: d.pd, all: d.all, xl: d.xl };
    if (!lockCats) patch.cats = d.cats;
    try {
      await NET.update(code + '/s', patch);
      cfg = Object.assign(cfg, JSON.parse(JSON.stringify(d)));
      saveCfg();
      toast('انحفظت الإعدادات');
    } catch { toast('ما قدرنا نحفظ، جرّب مرة ثانية'); }
    closeSettings();
  }

  // ---------- صورة البطل: الحرف يتقلب كل شوي ----------
  function heroLoop() {
    const node = el.heroLetter;
    if (!node || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    setInterval(() => {
      if (!$('#screen-intro').classList.contains('active') || document.hidden) return;
      const L = LETTERS.filter((x) => !HARD.includes(x))[(Math.random() * 24) | 0];
      rollLetter(node, L, { dur: 900, sound: false });
    }, 3600);
  }

  // =========================================================
  // الربط
  // =========================================================
  initChrome();
  bindSettings();
  renderSettings();
  heroLoop();
  NET.onStatus((on) => {
    el.netDot.dataset.on = String(on);
    el.netText.textContent = on ? (NET.local ? 'تجربة محلية' : 'مباشر') : 'غير متصل';
  });
  NET.offset((v) => { offset = v; });

  el.createBtn.addEventListener('click', createRoom);
  el.rollBtn.addEventListener('click', roll);
  el.startBtn.addEventListener('click', startRound);
  el.lettersManual.addEventListener('click', (e) => { const b = e.target.closest('.lt'); if (b) pickManual(b.dataset.l); });
  el.forceStopBtn.addEventListener('click', forceStop);
  el.gradeTable.addEventListener('click', (e) => { const c = e.target.closest('.cell'); if (c) cycleCell(c.dataset.pid, +c.dataset.i); });
  el.approveBtn.addEventListener('click', approve);
  el.nextBtn.addEventListener('click', nextRound);
  el.regradeBtn.addEventListener('click', () => NET.update(code + '/s', { ph: 'grade' }).catch(() => {}));
  el.finishBtn.addEventListener('click', () => finish(false));
  el.sheetBtn.addEventListener('click', () => { el.roundsTable.innerHTML = roundsTableHTML(); el.sheetModal.hidden = false; FX.flip(); });
  el.sheetClose.addEventListener('click', () => { el.sheetModal.hidden = true; });
  el.sheetModal.addEventListener('click', (e) => { if (e.target === el.sheetModal) el.sheetModal.hidden = true; });
  el.againBtn.addEventListener('click', again);
  el.peopleList.addEventListener('click', (e) => { const b = e.target.closest('[data-kick]'); if (b) kick(b.dataset.kick); });
  el.copyBtn.addEventListener('click', copyLink);
  el.settingsBtn.addEventListener('click', openSettings);
  el.setSave.addEventListener('click', saveSettings);
  el.setCancel.addEventListener('click', closeSettings);
  el.setModal.addEventListener('click', (e) => { if (e.target === el.setModal) closeSettings(); });
  el.endBtn.addEventListener('click', endRoom);
  el.resumeBtn.addEventListener('click', () => { const c = store.get(HOST_KEY); if (c) openRoom(c); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && code) keepAwake(); });

  // رابط المشاركين يحافظ على وسوم الاختبار
  const jl = new URL('play.html', location.href); jl.search = extra().toString();
  $('#joinLink').href = jl.href;

  // غرفة مفتوحة من قبل؟
  (async () => {
    const c = store.get(HOST_KEY);
    if (!c) return;
    try {
      const s = await NET.get(c + '/s');
      if (s && !(typeof s.c === 'number' && Date.now() - s.c > STALE)) {
        el.resumeCode.textContent = c;
        el.resumeCard.hidden = false;
      } else store.del(HOST_KEY);
    } catch { /* تجاهل */ }
  })();
})();
