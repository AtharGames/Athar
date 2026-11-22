/* =========================================================
   إنسان حيوان جماد | صفحة المشارك (الجوال)
   يدخل برمز الغرفة واسمه، ويعبّي الخانات بالحرف.
   الإجابات تُحفظ أولًا بأول، وأول من يسلّم يوقف الكل، والنتيجة توصل من المقدّم.
   ========================================================= */
(() => {
  'use strict';
  const H = window.HUI;
  const { $, S, FX, store, ar, toLatin, esc, plus, clock, LETTERS, startsWith, catsOf, sum, ranking, roundsDone,
    rollLetter, initChrome, show, toast, confirmBox, confetti, keepAwake, vibrate } = H;
  const NET = window.HuroofNet;
  // embed=1: ورقة المقدّم داخل شاشته (يلعب معهم)، بمعرّف مستقل وبلا أصوات (الشاشة الأم تصدرها)
  const EMBED = new URLSearchParams(location.search).get('embed') === '1' && window.parent !== window;
  const ME_KEY = EMBED ? 'athar-huroof-me-host' : 'athar-huroof-me';
  if (EMBED) {
    document.documentElement.classList.add('embed');
    Object.keys(FX).forEach((k) => { FX[k] = () => {}; });
    ['tongue', 'drop', 'chirp', 'sigh', 'whoosh', 'gust', 'winner'].forEach((k) => { if (typeof S[k] === 'function') S[k] = () => {}; });
  }

  const el = {
    netDot: $('#netDot'), meName: $('#meName'), meRoom: $('#meRoom'),
    form: $('#joinForm'), code: $('#codeInput'), name: $('#nameInput'), joinBtn: $('#joinBtn'), error: $('#joinError'),
    game: $('#game'), stamp: $('#myLetter'), title: $('#statusTitle'), text: $('#statusText'),
    round: $('#myRound'), timer: $('#myTimer'), timebar: $('#myTimebar'), timefill: $('#myTimefill'),
    sheet: $('#sheetForm'), lines: $('#lines'), doneBtn: $('#doneBtn'), doneLabel: $('#doneLabel'), doneHint: $('#doneHint'),
    result: $('#result'), resRound: $('#resRound'), resTotal: $('#resTotal'), resRank: $('#resRank'), gradedBy: $('#gradedBy'),
    endCard: $('#endCard'), endKicker: $('#endKicker'), endTitle: $('#endTitle'), endText: $('#endText'),
    paper: $('#myPaper'), paperTable: $('#paperTable'),
    overlay: $('#stopOverlay'), ovWho: $('#ovWho'), confetti: $('#confetti'), leave: $('#leaveBtn')
  };

  let me = null;                 // { room, name, pid }
  let room = { s: null, p: null, f: null, g: null };
  let stops = [];
  let seenSelf = false, gotS = false, online = false, busy = false;
  let offset = 0;
  // حالة الجولة الحالية
  let curR = null, vals = [], locked = false, submitted = false, finalSent = null, draftTimer = 0, tickTimer = 0, rollTimer = 0;
  let lastPh = '', lastKey = '', stopShown = null, endShown = false;
  const myAns = {};              // إجاباتي لكل جولة (للورقة)
  const fetching = new Set();
  const now = () => Date.now() + offset;

  const newPid = () => {
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    const buf = new Uint8Array(10);
    (window.crypto || window.msCrypto).getRandomValues(buf);
    buf.forEach((b) => { s += a[b % a.length]; });
    return s;
  };
  const loadMe = () => { try { return JSON.parse(store.get(ME_KEY) || 'null'); } catch { return null; } };
  const draftKey = (r) => `athar-huroof-draft-${me.room}-${r}`;

  // =========================================================
  // الدخول والخروج
  // =========================================================
  function showError(msg) { el.error.textContent = msg; el.error.hidden = !msg; }

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
      S.drop(520);
      enter();
    } catch (e) {
      console.warn('[huroof] join', e && e.message);
      if (!silent) showError('ما قدرنا ندخّلك، تأكد من الإنترنت وجرّب مرة ثانية.');
    } finally {
      busy = false; el.joinBtn.disabled = false; el.joinBtn.textContent = 'ادخل الغرفة';
    }
  }

  function enter() {
    room = { s: null, p: null, f: null, g: null };
    seenSelf = false; gotS = false; curR = null; locked = false; submitted = false; finalSent = null;
    lastPh = ''; lastKey = ''; stopShown = null; endShown = false;
    el.meName.textContent = me.name;
    el.meRoom.textContent = `غرفة ${me.room}`;
    setStatus('لحظة…', 'نوصّلك بالغرفة');
    show('screen-game');
    stops.forEach((f) => f()); stops = [];
    ['s', 'p', 'f', 'g'].forEach((k) => {
      stops.push(NET.watch(`${me.room}/${k}`, (v) => {
        room[k] = v;
        if (k === 's') gotS = true;
        schedule();
      }));
    });
    keepAwake();
  }

  function exit(msg) {
    stops.forEach((f) => f()); stops = [];
    clearInterval(tickTimer); clearInterval(rollTimer); clearTimeout(draftTimer);
    tickTimer = 0; rollTimer = 0;
    const last = me;
    me = null;
    store.del(ME_KEY);
    el.overlay.hidden = true;
    el.meName.textContent = 'إنسان حيوان جماد';
    el.meRoom.textContent = 'ادخل برمز الغرفة';
    if (last) { el.code.value = last.room; el.name.value = last.name; }
    show('screen-join');
    showError(msg || '');
  }

  // نجمع التحديثات المتتالية في رسم واحد
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; onRoom(); });
  }

  function onRoom() {
    if (!me || !gotS) return;
    if (!room.s) { exit('المقدّم أنهى الغرفة. إذا فتح غرفة جديدة ادخل برمزها.'); return; }
    if (room.p === null && !seenSelf) return; // ننتظر قائمة المشاركين
    const mine = room.p && room.p[me.pid];
    if (mine) seenSelf = true;
    else if (seenSelf) { exit('المقدّم طلّعك من الغرفة.'); return; }
    render();
  }

  // =========================================================
  // الرسم
  // =========================================================
  function setStatus(title, text) { el.title.textContent = title; el.text.textContent = text; }

  function render() {
    const s = room.s, ph = s.ph, cats = catsOf(s);
    const f = room.f && room.f[s.r];
    el.game.dataset.ph = ph;
    el.round.textContent = ph === 'end' ? 'انتهت اللعبة' : s.r === '0' ? 'قبل البداية' : `الجولة ${ar(ph === 'pick' ? +s.r + 1 : +s.r)}${s.R ? ` من ${ar(s.R)}` : ''}`;
    const key = ph + '|' + s.r;
    const entered = key !== lastKey;
    lastKey = key;

    // تقليب الحرف أثناء اختيار المقدّم
    if (ph === 'pick') startThinking(); else stopThinking();
    if (ph !== 'play') { clearInterval(tickTimer); tickTimer = 0; el.timer.hidden = true; el.timebar.hidden = true; }

    el.result.hidden = true;
    el.endCard.hidden = true;
    el.sheet.hidden = true;

    if (ph === 'lobby') {
      el.stamp.textContent = '؟';
      setStatus('أنت في الغرفة!', 'انتظر المقدّم يبدأ أول جولة، وهذي خانات ورقتك:');
      buildLines(cats, null, true);
      el.sheet.hidden = false;
      el.doneBtn.hidden = true; el.doneHint.textContent = '';
    }

    if (ph === 'pick') {
      setStatus('المقدّم يسحب الحرف…', 'جهّز قلمك!');
    }

    if (ph === 'play') {
      if (curR !== s.r) setupRound(s, cats);
      el.sheet.hidden = false;
      el.doneBtn.hidden = false;
      if (!f) {
        if (!submitted) setStatus('يلا اكتب!', `كل الكلمات بحرف «${s.L}»، وأول من يسلّم يوقف الكل.`);
        tickTimer = tickTimer || setInterval(tick, 250);
        tick();
      }
      updateDone(s, cats);
    }

    // وقفت الأقلام: أول تسليم وصل
    if (f && (ph === 'play' || ph === 'stop' || ph === 'grade') && curR === s.r) {
      lockSheet(s);
      el.sheet.hidden = false;
      el.doneBtn.hidden = true;
      if (stopShown !== s.r) { stopShown = s.r; announceStop(f); }
    }
    if (ph === 'stop' || ph === 'grade') {
      const mineFirst = f && f.p === me.pid;
      setStatus(mineFirst ? 'سلّمت أول! 👏' : 'قف! وقفت الأقلام', ph === 'grade' ? gradingText(s) : 'نجمع الأوراق…');
      if (curR !== s.r) el.sheet.hidden = true;
      el.game.classList.toggle('grading', ph === 'grade');
    } else el.game.classList.remove('grading');

    if (ph === 'show') renderShow(s, cats, entered);
    if (ph === 'end') renderEnd(entered);

    // ورقتي: كل الجولات المعتمدة
    const rs = roundsDone(room);
    el.paper.hidden = !rs.length || ph === 'play' || ph === 'stop' || ph === 'grade' || ph === 'lobby';
    if (!el.paper.hidden) renderPaper(s, cats, rs);

    if (ph !== lastPh) {
      if (ph === 'pick' && lastPh) FX.flip();
      lastPh = ph;
    }
  }

  // ---------- الخانات ----------
  function buildLines(cats, letter, preview) {
    const sig = cats.join('|') + '|' + (preview ? 'p' : curR);
    if (el.lines.dataset.sig === sig) return;
    el.lines.dataset.sig = sig;
    el.lines.innerHTML = cats.map((c, i) => `
      <label class="line" data-i="${i}">
        <span class="ln-label">${esc(c)}</span>
        <span class="ln-field">
          <input type="text" data-i="${i}" maxlength="40" enterkeyhint="${i === cats.length - 1 ? 'done' : 'next'}" autocomplete="off" autocorrect="off" spellcheck="false"
            value="${preview ? '' : esc(vals[i] || '')}" ${preview ? 'disabled placeholder="…"' : ''}>
          <span class="ln-mark" aria-hidden="true"></span>
        </span>
        <span class="ln-warn"></span>
      </label>`).join('');
  }

  function setupRound(s, cats) {
    curR = s.r; locked = false; submitted = false; finalSent = null;
    try { vals = JSON.parse(store.get(draftKey(s.r)) || '[]') || []; } catch { vals = []; }
    el.lines.dataset.sig = '';
    buildLines(cats, s.L, false);
    el.lines.classList.remove('locked');
    el.game.classList.remove('locked');
    cats.forEach((_, i) => warn(i, s.L));
    // الحرف يتقلب ثم يثبت
    rollLetter(el.stamp, s.L, { dur: 800 });
    S.whoosh(true, 0.05);
    vibrate(60);
    const first = el.lines.querySelector('input');
    if (first && !vals.some(Boolean)) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch { /* تجاهل */ } }, 900);
  }

  function warn(i, L) {
    const line = el.lines.querySelector(`.line[data-i="${i}"]`); if (!line) return;
    const v = (vals[i] || '').trim();
    const bad = v && !startsWith(v, L);
    line.classList.toggle('filled', !!v && !bad);
    line.classList.toggle('off-letter', !!bad);
    line.querySelector('.ln-warn').textContent = bad ? `ما تبدأ بحرف «${L}»` : '';
  }

  function updateDone(s, cats) {
    const filled = cats.filter((_, i) => (vals[i] || '').trim()).length;
    const need = s.all ? cats.length - filled : (filled ? 0 : 1);
    el.doneBtn.disabled = locked || submitted || need > 0;
    el.doneLabel.textContent = submitted ? 'سلّمت ✓' : 'سلّمت!';
    el.doneHint.textContent = locked || submitted ? '' :
      need > 0 ? (s.all ? `عبّ كل الخانات عشان تقدر تسلّم (باقي ${ar(need)})` : 'اكتب خانة وحدة على الأقل') : 'إذا سلّمت، توقف أقلام الكل!';
  }

  function onInput(e) {
    const inp = e.target.closest('input[data-i]'); if (!inp || locked || !room.s || room.s.ph !== 'play') return;
    const i = +inp.dataset.i;
    vals[i] = inp.value.slice(0, 40);
    store.set(draftKey(curR), JSON.stringify(vals));
    warn(i, room.s.L);
    updateDone(room.s, catsOf(room.s));
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => pushAnswers(false), 450);
  }

  const answerObj = () => {
    const o = {};
    vals.forEach((v, i) => { const t = (v || '').trim().slice(0, 40); if (t && i < 8) o[i] = t; });
    return o;
  };
  function pushAnswers(done) {
    if (!me || curR === null) return Promise.resolve();
    const body = { t: NET.TS }, v = answerObj();
    if (Object.keys(v).length) body.v = v;
    if (done) body.d = true;
    return NET.set(`${me.room}/a/${curR}/${me.pid}`, body).catch((e) => console.warn('[huroof] answers', e && e.message));
  }

  async function submit(e) {
    e.preventDefault();
    const s = room.s;
    if (!s || s.ph !== 'play' || locked || submitted || el.doneBtn.disabled) return;
    submitted = true;
    clearTimeout(draftTimer);
    el.lines.classList.add('locked');
    $$inputs().forEach((x) => { x.disabled = true; });
    updateDone(s, catsOf(s));
    setStatus('سلّمت!', 'ننتظر نشوف مين الأسرع…');
    FX.scribble(2);
    vibrate(40);
    await pushAnswers(true);
    // أول تسليم يُكتب مرة واحدة فقط (القاعدة تمنع الثاني)
    NET.set(`${me.room}/f/${s.r}`, { p: me.pid, t: NET.TS }).catch(() => { /* أحد سبقك */ });
  }
  const $$inputs = () => [...el.lines.querySelectorAll('input')];

  function lockSheet(s) {
    if (locked) return;
    locked = true;
    clearTimeout(draftTimer);
    el.lines.classList.add('locked');
    el.game.classList.add('locked');
    $$inputs().forEach((x) => { x.disabled = true; x.blur(); });
    el.doneHint.textContent = '';
    // نرسل آخر ما كُتب فورًا (القواعد تعطي مهلة قصيرة بعد «قف!»)
    if (finalSent !== s.r && !submitted) { finalSent = s.r; pushAnswers(false); }
  }

  function announceStop(f) {
    const mine = f.p === me.pid;
    const who = f.p === '_host' ? null : (room.p && room.p[f.p] && room.p[f.p].n) || 'مشارك';
    FX.whistle();
    vibrate(mine ? [60, 40, 60] : [200, 80, 200]);
    if (mine) { S.chirp(0.4); return; }
    const s = room.s;
    const timeUp = f.p === '_host' && s.dl && typeof s.at === 'number' && f.t >= s.at + s.dl * 1000 - 400;
    el.ovWho.textContent = who ? `${who} سلّم أول` : (timeUp ? 'خلص الوقت!' : 'المقدّم أوقف الجولة');
    el.overlay.hidden = false;
    el.overlay.classList.remove('in'); void el.overlay.offsetWidth; el.overlay.classList.add('in');
    setTimeout(() => { el.overlay.hidden = true; }, 1900);
  }

  function tick() {
    const s = room.s;
    if (!s || s.ph !== 'play' || !s.dl || typeof s.at !== 'number') { el.timer.hidden = true; el.timebar.hidden = true; return; }
    const left = (s.at + s.dl * 1000 - now()) / 1000;
    el.timer.hidden = false; el.timebar.hidden = false;
    el.timer.textContent = left > 0 ? clock(left) : 'خلص الوقت';
    el.timer.classList.toggle('hurry', left <= 10);
    el.timefill.style.transform = `scaleX(${Math.max(0, Math.min(1, left / s.dl))})`;
  }

  function startThinking() {
    if (rollTimer) return;
    el.stamp.classList.add('thinking');
    rollTimer = setInterval(() => { el.stamp.textContent = LETTERS[(Math.random() * LETTERS.length) | 0]; }, 160);
  }
  function stopThinking() {
    if (!rollTimer) return;
    clearInterval(rollTimer); rollTimer = 0;
    el.stamp.classList.remove('thinking');
    if (room.s && room.s.L) el.stamp.textContent = room.s.L;
  }

  // من يصحّح الحين؟
  function gradingText(s) {
    if (s.ai && s.aq === 'run') return 'الذكاء الاصطناعي يصحّح الأوراق…';
    if (s.mo === 'auto') return 'نعتمد التصحيح…';
    if (s.mo === 'opt') return 'صحّحها الذكاء الاصطناعي، وننتظر تأكيد المقدّم…';
    return s.ai ? 'المقدّم يراجع تصحيح الذكاء الاصطناعي…' : 'المقدّم يصحّح الأوراق…';
  }
  const BY = {
    host: 'اعتمدها المقدّم',
    ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9.2l-5.2 1.8L12 16.4l-1.8-5.4L5 9.2l5.2-1.8z"/></svg> صحّحها الذكاء الاصطناعي',
    auto: 'تصحيح آلي'
  };

  // ---------- نتيجة الجولة ----------
  const markOf = (pts, ans, s) => (!ans ? 'empty' : pts > 0 && pts === s.pu ? 'ok' : pts > 0 && pts === s.pd ? 'dup' : pts > 0 ? 'ok' : 'bad');

  function renderShow(s, cats, entered) {
    const g = room.g && room.g[s.r];
    const pts = g && g.s && g.s[me.pid];
    const list = ranking(room), meRow = list.find((x) => x.pid === me.pid);
    const rp = sum(pts);
    el.stamp.textContent = s.L;
    if (curR === s.r) {
      el.sheet.hidden = false; el.doneBtn.hidden = true; el.doneHint.textContent = '';
      // علامات قلم المعلم على الخانات
      cats.forEach((_, i) => {
        const line = el.lines.querySelector(`.line[data-i="${i}"]`); if (!line) return;
        const p = pts ? +pts[i] || 0 : 0, mk = markOf(p, (vals[i] || '').trim(), s);
        line.dataset.mark = mk;
        line.classList.remove('off-letter', 'filled');
        line.querySelector('.ln-mark').innerHTML = `${mk === 'dup' ? '<em>مكرر</em>' : ''}<i>${mk === 'bad' ? '✗' : mk === 'empty' ? '' : '✓'}</i><b>${ar(p)}</b>`;
        // سبب الخطأ من الذكاء أو المقدّم
        const why = mk === 'bad' && g && g.n && g.n[me.pid] && g.n[me.pid][i];
        line.querySelector('.ln-warn').textContent = why || '';
      });
    }
    el.result.hidden = false;
    el.gradedBy.hidden = !(g && BY[g.by]);
    if (g && BY[g.by]) el.gradedBy.innerHTML = BY[g.by];
    el.resRound.textContent = pts ? plus(rp) : '—';
    el.resTotal.textContent = ar(meRow ? meRow.total : 0);
    el.resRank.textContent = meRow ? `${ar(meRow.rank)} من ${ar(list.length)}` : '—';
    setStatus(pts ? (rp ? `جبت ${ar(rp)} نقطة!` : 'ما جبت نقاط هالمرة') : 'وصلت النتيجة', 'الجولة الجاية قريب…');
    if (entered && pts) { if (rp) S.chirp(0.1); else S.sigh(0.1); FX.scribble(3, 0.2); }
  }

  // ---------- الفائز ----------
  function renderEnd(entered) {
    const list = ranking(room), meRow = list.find((x) => x.pid === me.pid);
    const top = list.filter((x) => x.rank === 1);
    const win = meRow && meRow.rank === 1;
    el.endCard.hidden = false;
    el.endCard.classList.toggle('winner', !!win);
    el.endKicker.textContent = 'النتيجة النهائية';
    el.endTitle.textContent = win ? (top.length > 1 ? 'تعادلت على المركز الأول!' : 'مبروك! أنت الفائز') : `ترتيبك ${meRow ? ar(meRow.rank) : '—'} من ${ar(list.length)}`;
    el.endText.textContent = `${win ? '' : `الفائز: ${top.map((x) => x.name).join(' و ')} • `}مجموعك ${ar(meRow ? meRow.total : 0)} نقطة`;
    setStatus('انتهت اللعبة', 'شكرًا على المشاركة!');
    el.stamp.textContent = '★';
    if (entered && !endShown) {
      endShown = true;
      if (win) { S.winner(); setTimeout(() => confetti(el.confetti), 250); vibrate([80, 60, 80, 60, 200]); }
      else S.chirp(0.1);
    }
  }

  // ---------- ورقتي ----------
  function renderPaper(s, cats, rs) {
    // إجابات الجولات السابقة من قاعدة البيانات (مرة وحدة لكل جولة)
    rs.forEach((r) => {
      if (String(r) === curR) myAns[r] = vals.slice();
      else if (!(r in myAns) && !fetching.has(r)) {
        fetching.add(r);
        let local = null;
        try { local = JSON.parse(store.get(draftKey(r)) || 'null'); } catch { /* تجاهل */ }
        NET.get(`${me.room}/a/${r}/${me.pid}/v`).then((v) => {
          myAns[r] = v ? cats.map((_, i) => v[i] || '') : (local || []);
          schedule();
        }).catch(() => { myAns[r] = local || []; }).finally(() => fetching.delete(r));
      }
    });
    let grand = 0;
    const rows = rs.map((r) => {
      const g = room.g[r], pts = (g.s && g.s[me.pid]) || null, a = myAns[r] || [];
      const tot = sum(pts); grand += tot;
      return `<tr><th class="lt-h">${esc(g.L)}</th>${cats.map((_, i) => {
        const ans = (a[i] || '').trim(), p = pts ? +pts[i] || 0 : 0, mk = pts ? markOf(p, ans, s) : 'empty';
        return `<td class="pc ${mk}"><span class="ans">${ans ? esc(ans) : '—'}</span>${pts && ans ? `<span class="pp">${ar(p)}</span>` : ''}</td>`;
      }).join('')}<td class="sum"><b>${pts ? ar(tot) : '—'}</b></td></tr>`;
    }).join('');
    el.paperTable.innerHTML = `<thead><tr><th class="lt-h">حرف</th>${cats.map((c) => `<th>${esc(c)}</th>`).join('')}<th class="sum">مجموع</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><th colspan="${cats.length + 1}">المجموع الكلي</th><td class="sum"><b>${ar(grand)}</b></td></tr></tfoot>`;
  }

  // =========================================================
  // الربط
  // =========================================================
  initChrome();
  NET.onStatus((on) => { online = on; el.netDot.dataset.on = String(on); });
  NET.offset((v) => { offset = v; });

  el.code.addEventListener('input', () => { el.code.value = toLatin(el.code.value).replace(/\D/g, '').slice(0, 5); });
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = toLatin(el.code.value).replace(/\D/g, '');
    const name = el.name.value.trim().replace(/\s+/g, ' ').slice(0, 20);
    if (code.length !== 5) { showError('رمز الغرفة خمسة أرقام.'); el.code.focus(); return; }
    if (!name) { showError('اكتب اسمك عشان يعرفك المقدّم.'); el.name.focus(); return; }
    const old = loadMe();
    // نفس الجوال يرجع بنفس المعرّف، فتبقى نقاطه
    const pid = old && old.room === code ? old.pid : newPid();
    join(code, name, pid, false);
  });
  el.lines.addEventListener('input', onInput);
  // زر «التالي» في كيبورد الجوال ينقل للخانة اللي بعدها
  el.lines.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const inp = e.target.closest('input[data-i]'); if (!inp) return;
    e.preventDefault();
    const next = el.lines.querySelector(`input[data-i="${+inp.dataset.i + 1}"]`);
    if (next) next.focus(); else inp.blur();
  });
  el.sheet.addEventListener('submit', submit);
  el.leave.addEventListener('click', async () => {
    const ok = await confirmBox({ title: 'تطلع من الغرفة؟', text: 'تقدر ترجع بنفس الرمز، ونقاطك تبقى محفوظة.', yes: 'اطلع' });
    if (!ok || !me) return;
    const m = me;
    exit('');
    NET.remove(`${m.room}/p/${m.pid}`).catch(() => {});
    // نحفظ المعرّف عشان ترجع بنقاطك، بدون دخول تلقائي
    store.set(ME_KEY, JSON.stringify(Object.assign({}, m, { auto: false })));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && me) {
      keepAwake();
      // رجوع من الخلفية: نعلن الحضور من جديد
      if (!NET.local) NET.presence(`${me.room}/p/${me.pid}/on`, true, false).catch(() => {});
    }
  });

  // رمز من الرابط أو دخول سابق
  const params = new URLSearchParams(location.search);
  if (EMBED) {
    // نبلّغ الشاشة الأم بارتفاع الورقة، ونتبع ثيمها
    const post = () => { try { parent.postMessage({ huroofH: document.documentElement.scrollHeight }, location.origin); } catch { /* تجاهل */ } };
    try { new ResizeObserver(post).observe(document.body); } catch { setInterval(post, 800); }
    window.addEventListener('storage', (e) => { if (e.key === 'athar-theme' && e.newValue) document.documentElement.dataset.theme = e.newValue; });
    const code = (params.get('r') || '').replace(/\D/g, '').slice(0, 5);
    const name = (params.get('n') || 'المقدّم').trim().slice(0, 20) || 'المقدّم';
    const old = loadMe();
    if (code.length === 5) join(code, name, old && old.room === code ? old.pid : newPid(), false);
    return;
  }
  const qr = (params.get('r') || '').replace(/\D/g, '').slice(0, 5);
  const saved = loadMe();
  if (qr) el.code.value = qr;
  if (saved && saved.name) el.name.value = saved.name;
  if (saved && saved.room && (!qr || qr === saved.room) && saved.auto !== false) {
    el.code.value = saved.room;
    join(saved.room, saved.name, saved.pid, true);
  } else if (qr) setTimeout(() => el.name.focus(), 300);
})();
