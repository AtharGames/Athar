/* =========================================================
   الأسطول البحري | شاشة المقدّم
   ثلاثة أوضاع:
   A) المقدّم يدير كل شيء: التقسيم (عشوائي أو يدوي) والقصف على هذه الشاشة
   B) الفرق ترسم أساطيلها من جوالاتها، والقصف من شاشة المقدّم
   C) الفرق ترسم وتقصف من جوالاتها، والمقدّم يمنح الضربات ويعرض المعركة
   هذه الشاشة هي المرجع: تتحقق من كل أسطول وكل ضربة ثم تنشر الوضع للجوالات.
   ========================================================= */
(() => {
  'use strict';
  const F = window.Fleet, NET = window.FleetNet;
  const { $, $$, ar, esc, sgn, num, sfx, toast, show, SHIPS } = F;
  const KEY = 'athar-fleet-host';
  const MODE_NAME = { A: 'المقدّم يدير كل شيء', B: 'الفرق ترسم والمقدّم يقصف', C: 'الفرق ترسم وتقصف' };

  F.initChrome();
  $$('.u-ico').forEach((s) => { s.innerHTML = F.ico(s.dataset.ico); });

  // ---------- الحالة ----------
  let G = F.store.get(KEY, null);
  if (G && (!G.teams || G.v !== 1)) G = null;
  const setup = {
    n: 2, mode: 'A', place: 'random',
    names: F.TEAM_NAMES.slice()
  };
  let aim = -1;            // المربع المحدد للقصف
  let flash = null;        // حركة آخر ضربة
  let bannerTimer = 0;
  let sub = null;          // اشتراك صندوق رسائل الجوالات
  let seenSet = new Set();

  let saveTimer = 0;
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { if (G) F.store.set(KEY, G); }, 120); };
  const saveNow = () => { if (G) F.store.set(KEY, G); };

  const team = (i) => G.teams[i];
  const isOnline = (t) => t.seen && Date.now() - t.seen < 75000;

  // =========================================================
  // البداية
  // =========================================================
  function renderIntro() {
    const card = $('#resumeCard');
    if (G && G.phase !== 'end') {
      const st = G.phase === 'play' ? 'المعركة شغّالة' : 'في تجهيز الأساطيل';
      $('#resumeText').textContent = `${ar(G.teams.length)} فرق · ${MODE_NAME[G.mode]} · ${st}`;
      card.hidden = false;
    } else card.hidden = true;
  }
  $('#startBtn').onclick = () => { F.S.whoosh(true); renderSetup(); show('screen-setup'); };
  $('#resumeBtn').onclick = () => { F.S.tongue(); resume(); };
  $('#resumeDrop').onclick = async () => {
    if (!(await F.confirmBox({ title: 'نحذف المسابقة السابقة؟', text: 'تضيع النقاط والأساطيل المحفوظة.', yes: 'احذفها', danger: true }))) return;
    dropGame();
    renderIntro();
  };

  function dropGame() {
    if (G && G.net) NET.drop([`${G.net.room}-p`, `${G.net.room}-u`]);
    if (sub) { sub.close(); sub = null; }
    G = null;
    F.store.del(KEY);
    $('#netDot').hidden = true;
  }

  // =========================================================
  // الإعداد
  // =========================================================
  function renderSetup() {
    $$('#countSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === setup.n)));
    $$('#modes .mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === setup.mode)));
    $$('#placeModes .mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.place === setup.place)));
    $('#placeCard').hidden = setup.mode !== 'A';
    const box = $('#names');
    // نحافظ على ما كُتب
    $$('input', box).forEach((inp, i) => { setup.names[i] = inp.value; });
    box.innerHTML = Array.from({ length: setup.n }, (_, i) => `
      <label class="name-field" style="--tc:${F.TEAM_COLORS[i]}">
        <i class="dot"></i>
        <input type="text" maxlength="22" value="${esc(setup.names[i] || F.TEAM_NAMES[i])}" aria-label="اسم الفريق ${ar(i + 1)}">
      </label>`).join('');
    const ok = setup.mode === 'A' || !!NET;
    $('#setupNext').textContent = setup.mode === 'A' && setup.place === 'random' ? 'وزّع وابدأ المعركة' : 'التالي';
    $('#setupNext').disabled = !ok;
  }
  $('#countSeg').onclick = (e) => { const b = e.target.closest('[data-n]'); if (!b) return; setup.n = +b.dataset.n; F.S.tongue(0, 0.2); renderSetup(); };
  $('#modes').onclick = (e) => { const b = e.target.closest('[data-mode]'); if (!b) return; setup.mode = b.dataset.mode; F.S.tongue(0, 0.2); renderSetup(); };
  $('#placeModes').onclick = (e) => { const b = e.target.closest('[data-place]'); if (!b) return; setup.place = b.dataset.place; F.S.tongue(0, 0.2); renderSetup(); };
  $('#setupBack').onclick = () => { renderIntro(); show('screen-intro'); };
  $('#setupNext').onclick = async () => {
    $$('#names input').forEach((inp, i) => { setup.names[i] = inp.value.trim() || F.TEAM_NAMES[i]; });
    if (G && G.phase !== 'end') {
      if (!(await F.confirmBox({ title: 'نبدأ مسابقة جديدة؟', text: 'المسابقة المحفوظة الحالية بتنحذف.', yes: 'ابدأ جديدة', danger: true }))) return;
    }
    dropGame();
    newGame();
  };

  function newGame() {
    const online = setup.mode !== 'A';
    G = {
      v: 1, mode: setup.mode, place: setup.place, phase: 'prep',
      teams: Array.from({ length: setup.n }, (_, i) => ({
        name: setup.names[i] || F.TEAM_NAMES[i], color: F.TEAM_COLORS[i],
        fleet: null, hits: {}, score: 0, strikes: F.START_STRIKES, ready: false,
        key: online ? F.uid(4) : '', seen: 0
      })),
      log: [], att: 0, tgt: 1, evId: 0, ev: null, rej: [],
      net: online ? { room: F.uid(5), since: 'all', seen: [], seq: 0 } : null
    };
    if (G.mode === 'A' && G.place === 'random') {
      G.teams.forEach((t) => { t.fleet = F.random(); t.ready = true; });
      startBattle(true);
      return;
    }
    addLog('sys', `تجهيز ${ar(G.teams.length)} فرق · ${MODE_NAME[G.mode]}`);
    saveNow();
    if (online) connect();
    renderPrep();
    show('screen-prep');
  }

  // =========================================================
  // تجهيز الأساطيل
  // =========================================================
  function joinLink(code) {
    const u = new URL('play.html', location.href);
    u.search = '';
    u.searchParams.set('c', code);
    const p = new URLSearchParams(location.search);
    ['net', 'fbemu'].forEach((k) => { if (p.get(k)) u.searchParams.set(k, p.get(k)); });
    return u.href;
  }
  const codeOf = (t) => G.net.room + t.key;
  const prettyCode = (c) => `${c.slice(0, 5)}-${c.slice(5)}`;

  function renderPrep() {
    if (!G) return;
    const online = !!G.net;
    $('#prepTitle').textContent = online ? 'دخول الفرق ورسم الأساطيل' : 'رسم الأساطيل';
    $('#prepText').textContent = online
      ? (G.mode === 'B' ? 'كل فريق يدخل برمزه، يرسم أسطوله من جواله ويضغط «ثبّت». والقصف بعدها من هنا.'
        : 'كل فريق يدخل برمزه ويرسم أسطوله. وقت المعركة يقصف كل فريق من جواله متى ما عنده ضربات.')
      : 'ارسم أسطول كل فريق، أو وزّعه عشوائيًا.';
    $('#joinHint').hidden = !online;
    if (online) {
      const u = new URL('play.html', location.href);
      $('#joinUrl').textContent = u.host + u.pathname;
      $('#netLabel').textContent = `الاتصال: ${NET.label}`;
    }
    $('#prepGrid').innerHTML = G.teams.map((t, i) => {
      const status = t.ready ? '<span class="st ok">جاهز ✓</span>'
        : online ? (isOnline(t) ? '<span class="st on">دخل ويرسم…</span>' : '<span class="st">ما دخل بعد</span>')
          : '<span class="st">ما انرسم</span>';
      const join = online ? `
        <div class="tjoin">
          <div class="qr">${F.qrSVG(joinLink(codeOf(t)))}</div>
          <div><span class="muted">رمز الفريق</span><b class="tcode" dir="ltr">${prettyCode(codeOf(t))}</b>
          <button class="btn btn-small btn-ghost" data-act="copy" data-i="${i}">نسخ الرابط</button></div>
        </div>` : '';
      return `<article class="tcard${t.ready ? ' ready' : ''}" style="--tc:${t.color}">
        <header><i class="dot"></i><strong>${esc(t.name)}</strong>${status}</header>
        ${join}
        <div class="tacts">
          <button class="btn btn-small" data-act="edit" data-i="${i}">${F.ico('i-anchor')}${online ? 'ارسم بدلهم' : (t.fleet ? 'عدّل الأسطول' : 'ارسم الأسطول')}</button>
          <button class="btn btn-small" data-act="rand" data-i="${i}">${F.ico('i-dice')}عشوائي</button>
        </div>
      </article>`;
    }).join('');
    const notReady = G.teams.filter((t) => !t.ready).length;
    $('#prepNote').textContent = notReady ? `باقي ${ar(notReady)} ${notReady === 1 ? 'فريق' : 'فرق'} ما جهزوا. تقدر تبدأ ونوزّع لهم عشوائيًا.` : 'كل الأساطيل جاهزة ⚓';
    $('#battleBtn').classList.toggle('pulse', !notReady);
  }

  $('#prepGrid').onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = +b.dataset.i, t = team(i);
    if (b.dataset.act === 'copy') {
      try { await navigator.clipboard.writeText(joinLink(codeOf(t))); toast('انسخ الرابط ✓'); } catch { toast(joinLink(codeOf(t))); }
    }
    if (b.dataset.act === 'rand') {
      t.fleet = F.random(); t.ready = true;
      F.S.whoosh(true);
      addLog('sys', `توزيع عشوائي لأسطول ${t.name}`);
      commit();
    }
    if (b.dataset.act === 'edit') openEditor(i);
  };
  $('#prepBack').onclick = async () => {
    if (!(await F.confirmBox({ title: 'ترجع للإعداد؟', text: 'بتنلغي هذي المسابقة وتبدأ تجهيز جديد.', yes: 'ارجع', danger: true }))) return;
    dropGame();
    renderSetup();
    show('screen-setup');
  };
  $('#battleBtn').onclick = async () => {
    const missing = G.teams.filter((t) => !t.ready);
    if (missing.length) {
      const ok = await F.confirmBox({
        title: 'نبدأ المعركة؟',
        text: `${missing.map((t) => t.name).join('، ')} ما جهّزوا أساطيلهم. نوزّع لهم عشوائيًا ونبدأ؟`,
        yes: 'وزّع وابدأ'
      });
      if (!ok) return;
      missing.forEach((t) => { t.fleet = F.random(); t.ready = true; addLog('sys', `توزيع عشوائي لأسطول ${t.name}`); });
    }
    startBattle();
  };

  function startBattle(fromRandom = false) {
    G.phase = 'play';
    G.att = 0; G.tgt = 1;
    addLog('sys', fromRandom ? `🚀 بدأت المعركة: ${ar(G.teams.length)} فرق بتوزيع عشوائي` : '🚀 بدأت المعركة! كل فريق معه ضربة');
    F.sfx.whistle();
    saveNow();
    renderBattle();
    show('screen-battle');
    pub();
    if (fromRandom) toast('توزّعت كل الأساطيل عشوائيًا، وبدأت المعركة ⚓');
  }

  // =========================================================
  // محرر الأسطول وعرضه
  // =========================================================
  let ed = null, edTeam = -1;
  function openEditor(i) {
    edTeam = i;
    const t = team(i);
    $('#editTitle').textContent = `أسطول ${t.name}`;
    ed = F.editor($('#editor'), { fleet: t.fleet ? F.clone(t.fleet) : F.empty(), toast });
    $('#editModal').hidden = false;
  }
  $('#editSave').onclick = async () => {
    let f = ed.fleet;
    if (!F.isComplete(f)) {
      const ok = await F.confirmBox({ title: 'الأسطول ناقص', text: 'نكمّل الناقص عشوائيًا ونحفظ؟', yes: 'كمّل واحفظ' });
      if (!ok) return;
      f = F.clone(f);
      if (!F.fillRandom(f)) { toast('ما فيه مكان كافٍ للباقي، حرّك بعض القطع'); return; }
    }
    const t = team(edTeam);
    t.fleet = f; t.ready = true;
    addLog('sys', `رسم المقدّم أسطول ${t.name}`);
    $('#editModal').hidden = true;
    sfx.place();
    commit();
  };

  let viewBoard = null;
  function openView(i) {
    const t = team(i);
    $('#viewTitle').textContent = `أسطول ${t.name}`;
    if (!viewBoard) viewBoard = F.makeBoard($('#viewBoard'));
    viewBoard.paint({ own: t.fleet, pb: F.publicBoard(t.fleet, t.hits), lock: true });
    $('#viewModal').hidden = false;
  }

  $$('.modal [data-close]').forEach((b) => { b.onclick = () => { b.closest('.modal').hidden = true; }; });
  $$('.modal').forEach((m) => {
    if (m.id === 'confirm') return;
    m.addEventListener('click', (e) => { if (e.target === m && m.id !== 'editModal') m.hidden = true; });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    ['viewModal', 'adjModal', 'editModal'].forEach((id) => { $('#' + id).hidden = true; });
  });

  // =========================================================
  // المعركة
  // =========================================================
  const board = F.makeBoard($('#battleBoard'), { onCell: (i) => onCell(i) });

  function fixTargets() {
    const n = G.teams.length;
    if (G.att >= n) G.att = 0;
    if (G.tgt >= n || G.tgt === G.att) G.tgt = (G.att + 1) % n;
  }

  function renderBattle() {
    if (!G || G.phase === 'prep') return;
    fixTargets();
    const att = team(G.att), tgt = team(G.tgt);

    $('#attChips').innerHTML = G.teams.map((t, i) => `
      <button class="chip${i === G.att ? ' on' : ''}${t.strikes > 0 ? '' : ' empty'}" data-att="${i}" style="--tc:${t.color}" aria-pressed="${i === G.att}">
        <i class="dot"></i><span>${esc(t.name)}</span><b class="strk">${F.ico('i-bolt')}${ar(t.strikes)}</b>
      </button>`).join('');
    $('#tgtTabs').innerHTML = G.teams.map((t, i) => i === G.att ? '' : `
      <button class="tab${i === G.tgt ? ' on' : ''}" data-tgt="${i}" style="--tc:${t.color}" aria-pressed="${i === G.tgt}">
        <i class="dot"></i>${esc(t.name)}<small>${ar(F.explored(F.publicBoard(t.fleet, t.hits)))}/١٠٠</small>
      </button>`).join('');

    const pb = F.publicBoard(tgt.fleet, tgt.hits);
    $('#radarFrame').style.setProperty('--tc', tgt.color);
    $('#frameTitle').textContent = `أسطول ${tgt.name}`;
    const sunkCount = pb.k.length, totalShips = SHIPS.S.count + SHIPS.W.count + SHIPS.B.count;
    $('#frameStat').textContent = `غرق ${ar(sunkCount)} من ${ar(totalShips)} · انكشف ${ar(F.explored(pb))} مربع`;
    if (aim >= 0 && pb.b[aim] !== '.') aim = -1;
    board.paint({ pb, aim, flash, onlyFog: true });

    const canFire = G.phase === 'play' && att.strikes > 0;
    $('#fireBtn').disabled = !(canFire && aim >= 0);
    $('#fireText').innerHTML = att.strikes <= 0
      ? `<b>${esc(att.name)}</b> ما عندهم ضربات. اسألهم سؤال!`
      : aim >= 0 ? `الهدف: <b>${F.cellName(aim)}</b> في أسطول ${esc(tgt.name)} · اضغط «أطلق» أو المربع مرة ثانية`
        : `دور <b>${esc(att.name)}</b> (${ar(att.strikes)} ${att.strikes === 1 ? 'ضربة' : 'ضربات'}) · اختر مربعًا`;
    $('#firebar').style.setProperty('--tc', att.color);
    $('#modeNote').hidden = G.mode !== 'C';
    $('#modeNote').textContent = 'في هذا الوضع تقصف الفرق من جوالاتها، وتقدر تقصف عنهم من هنا لو احتاجوا.';

    renderScores();
    renderLog();
    const rc = $('#roomChip');
    rc.hidden = !G.net;
    if (G.net) rc.textContent = `غرفة ${G.net.room}`;
  }

  function renderScores() {
    const order = G.teams.map((t, i) => i).sort((a, b) => team(b).score - team(a).score);
    const top = team(order[0]).score;
    $('#scores').innerHTML = order.map((i, rank) => {
      const t = team(i);
      const on = G.net ? `<i class="presence${isOnline(t) ? ' on' : ''}" title="${isOnline(t) ? 'متصل' : 'غير متصل'}"></i>` : '';
      return `<li class="srow${i === G.att ? ' att' : ''}" style="--tc:${t.color}">
        <span class="rank">${rank === 0 && top > 0 ? F.ico('i-trophy') : ar(rank + 1)}</span>
        <button class="sname" data-att="${i}"><i class="dot"></i>${esc(t.name)}${on}</button>
        <span class="spts">${num(t.score)}<small>نقطة</small></span>
        <span class="sstr">${F.ico('i-bolt')}${ar(t.strikes)}</span>
        <span class="sbtns">
          <button class="qbtn ok" data-q="1" data-i="${i}" aria-label="إجابة صحيحة لـ ${esc(t.name)}">${F.ico('i-check')}</button>
          <button class="qbtn no" data-q="0" data-i="${i}" aria-label="إجابة خاطئة لـ ${esc(t.name)}">${F.ico('i-x')}</button>
          <button class="qbtn more" data-adj-open="${i}" aria-label="تعديل ${esc(t.name)}">⋯</button>
        </span>
      </li>`;
    }).join('');
  }

  function renderLog() {
    $('#log').innerHTML = G.log.slice(0, 60).map((l) => `<li class="lg-${l.k}">${esc(l.x)}</li>`).join('');
  }

  function addLog(k, x) {
    G.log.unshift({ k, x, t: Date.now() });
    if (G.log.length > 120) G.log.length = 120;
  }

  // التفاعل
  $('#attChips').onclick = (e) => { const b = e.target.closest('[data-att]'); if (!b) return; selectAtt(+b.dataset.att); };
  $('#tgtTabs').onclick = (e) => {
    const b = e.target.closest('[data-tgt]'); if (!b) return;
    G.tgt = +b.dataset.tgt; aim = -1; F.S.whoosh(true); save(); renderBattle();
  };
  function selectAtt(i) {
    G.att = i; aim = -1;
    if (G.tgt === i) G.tgt = (i + 1) % G.teams.length;
    F.S.tongue(0, 0.2); save(); renderBattle();
  }

  $('#scores').onclick = (e) => {
    const q = e.target.closest('[data-q]');
    if (q) { answer(+q.dataset.i, q.dataset.q === '1'); return; }
    const a = e.target.closest('[data-adj-open]');
    if (a) { openAdj(+a.dataset.adjOpen); return; }
    const s = e.target.closest('[data-att]');
    if (s) selectAtt(+s.dataset.att);
  };

  function answer(i, ok) {
    const t = team(i);
    if (ok) {
      t.strikes++;
      sfx.whistle();
      addLog('quiz', `✓ إجابة صحيحة من ${t.name}: ضربة جديدة (${ar(t.strikes)})`);
      toast(`✓ ${t.name} كسبوا ضربة`, 'ok');
      // في الوضعين A و B نجهّز الفريق مهاجمًا مباشرة
      if (G.mode !== 'C') { G.att = i; if (G.tgt === i) G.tgt = (i + 1) % G.teams.length; aim = -1; }
    } else {
      sfx.wrong();
      addLog('miss', `✗ إجابة خاطئة من ${t.name}`);
      toast(`✗ إجابة خاطئة من ${t.name}`, 'bad');
    }
    commit();
  }

  function onCell(i) {
    if (!G || G.phase !== 'play') return;
    const att = team(G.att);
    if (att.strikes <= 0) { sfx.deny(); toast(`${att.name} ما عندهم ضربات. اسألهم سؤال!`, 'bad'); return; }
    if (aim === i) { fire(G.att, G.tgt, i); return; }
    aim = i; sfx.aim(); renderBattle();
  }
  $('#fireBtn').onclick = () => { if (aim >= 0) fire(G.att, G.tgt, aim); };

  // تنفيذ الضربة (من الشاشة أو من جوال فريق) بعد التحقق
  function fire(ai, ti, i, mid = '') {
    const att = team(ai), tgt = team(ti);
    if (ai === ti || att.strikes <= 0 || tgt.hits[i]) return false;
    const res = F.resolve(tgt.fleet, i);
    tgt.hits[i] = 1;
    att.strikes--;
    att.score += res.pts;
    if (res.kind === 'hit') att.strikes++;
    const sunk = res.k >= 0 && F.isSunk(tgt.fleet, tgt.hits, res.k) ? res.t : '';
    const where = F.cellName(i);
    let title, text;
    if (res.kind === 'miss') {
      title = 'ماء!'; text = `${att.name} قصفوا ${where} عند ${tgt.name}`;
      addLog('miss', `💦 ${att.name} ← ${tgt.name} (${where}): ماء`);
      sfx.splash();
    } else if (res.kind === 'trap') {
      title = `فخ! ${sgn(res.pts)}`; text = `${F.shotText(res)} · ${where} عند ${tgt.name}`;
      addLog('trap', `💥 ${att.name} ← ${tgt.name} (${where}): ${F.shotText(res)} = ${sgn(res.pts)}`);
      sfx.trap();
    } else {
      title = sunk ? `أغرقتم ${SHIPS[sunk].name}!` : `إصابة! ${sgn(res.pts)}`;
      text = `${F.shotText(res)} · ${sunk ? sgn(res.pts) + ' · ' : ''}وضربة إضافية لـ ${att.name}`;
      addLog('hit', `🔥 ${att.name} ← ${tgt.name} (${where}): ${F.shotText(res)} = ${sgn(res.pts)} وضربة إضافية`);
      if (sunk) { addLog('hit', `⚓ غرقت ${SHIPS[sunk].name} لـ ${tgt.name}`); sfx.sink(); } else sfx.hit();
    }
    G.ev = { id: ++G.evId, a: ai, t: ti, i, k: res.kind, p: res.pts, s: res.t, w: res.sw, r: res.tr, sk: sunk, m: mid };
    // نعرض الهدف المقصوف على الشاشة الكبيرة
    G.tgt = ti;
    if (G.mode === 'C' && mid) { G.att = ai; }
    aim = -1;
    flash = { i, kind: res.kind };
    setTimeout(() => { flash = null; }, 1200);
    commit();
    showBanner(res.kind, sunk, title, text);
    if (res.kind === 'trap') F.shake($('#radarFrame'));
    // هل غرق الأسطول كاملًا؟
    if (sunk && F.publicBoard(tgt.fleet, tgt.hits).k.length === tgt.fleet.ships.length) {
      addLog('sys', `🌊 أسطول ${tgt.name} غرق كاملًا!`);
      commit();
    }
    return true;
  }

  function showBanner(kind, sunk, title, text) {
    const b = $('#banner');
    b.dataset.kind = sunk ? 'sunk' : kind;
    $('#bannerIco').innerHTML = F.ico(kind === 'miss' ? 'i-splash' : kind === 'trap' ? 'i-mine' : sunk ? SHIPS[sunk].ico : 'i-fire');
    $('#bannerTitle').textContent = title;
    $('#bannerText').textContent = text;
    b.hidden = false;
    b.classList.remove('in'); void b.offsetWidth; b.classList.add('in');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { b.hidden = true; }, 2600);
  }

  // تعديل النقاط والضربات
  let adjTeam = -1;
  function openAdj(i) {
    adjTeam = i;
    const t = team(i);
    $('#adjTitle').textContent = t.name;
    $('#adjScore').textContent = num(t.score);
    $('#adjStrikes').textContent = ar(t.strikes);
    $('#adjModal').hidden = false;
  }
  $('#adjModal').addEventListener('click', (e) => {
    const b = e.target.closest('[data-adj]');
    if (!b) return;
    const t = team(adjTeam), v = +b.dataset.v;
    if (b.dataset.adj === 'p') { t.score += v; addLog('sys', `تعديل يدوي: ${t.name} ${sgn(v)} نقطة`); }
    else { t.strikes = Math.max(0, t.strikes + v); addLog('sys', `تعديل يدوي: ${t.name} ${sgn(v)} ضربة`); }
    F.S.tongue(0, 0.2);
    $('#adjScore').textContent = num(t.score);
    $('#adjStrikes').textContent = ar(t.strikes);
    commit();
  });
  $('#adjView').onclick = async () => {
    const ok = await F.confirmBox({ title: 'نعرض الأسطول على الشاشة؟', text: 'إذا الشاشة معروضة للكل، بيشوفونه الفرق الثانية.', yes: 'اعرضه' });
    if (!ok) return;
    $('#adjModal').hidden = true;
    openView(adjTeam);
  };

  // نهاية المسابقة
  $('#endBtn').onclick = async () => {
    if (!(await F.confirmBox({ title: 'ننهي المسابقة؟', text: 'بنعلن الفائز حسب النقاط. تقدر ترجع للمعركة بعدها.', yes: 'أعلن الفائز' }))) return;
    G.phase = 'end';
    addLog('sys', '🏁 انتهت المسابقة');
    commit();
    renderEnd();
    show('screen-end');
    sfx.win();
    setTimeout(() => F.confetti($('#confetti')), 250);
  };
  $('#toIntroBtn').onclick = () => { saveNow(); renderIntro(); show('screen-intro'); };
  $('#backBattle').onclick = () => { G.phase = 'play'; commit(); renderBattle(); show('screen-battle'); };
  $('#newGame').onclick = () => { dropGame(); renderSetup(); show('screen-setup'); };

  function ranking() {
    const order = G.teams.map((t, i) => i).sort((a, b) => team(b).score - team(a).score);
    let last = null, rank = 0;
    return order.map((i, k) => { const s = team(i).score; if (s !== last) { rank = k + 1; last = s; } return { i, rank }; });
  }
  function renderEnd() {
    const rk = ranking();
    const winners = rk.filter((r) => r.rank === 1).map((r) => team(r.i));
    $('#winName').textContent = winners.length > 1 ? 'تعادل!' : winners[0].name;
    $('#winText').textContent = winners.length > 1
      ? `${winners.map((t) => t.name).join(' و ')} بنفس النقاط: ${num(winners[0].score)}`
      : `فازوا بـ ${num(winners[0].score)} نقطة. مبروك يا أبطال البحر 🌊`;
    $('#screen-end').style.setProperty('--tc', winners[0].color);
    $('#finalList').innerHTML = rk.map(({ i, rank }) => {
      const t = team(i), pb = F.publicBoard(t.fleet, t.hits);
      return `<li class="${rank === 1 ? 'first' : ''}" style="--tc:${t.color}">
        <span class="rank">${ar(rank)}</span><i class="dot"></i><strong>${esc(t.name)}</strong>
        <span class="muted">خسروا ${ar(pb.k.length)} قطع</span><b>${num(t.score)}</b></li>`;
    }).join('');
  }

  // =========================================================
  // الاتصال بالجوالات (الوضعان B و C)
  // =========================================================
  function connect() {
    if (!G || !G.net || sub) return;
    seenSet = new Set(G.net.seen || []);
    $('#netDot').hidden = false;
    sub = NET.subscribe(`${G.net.room}-u`, onUp, {
      since: G.net.since,
      onId: (id) => { G.net.since = id; save(); },
      onStatus: (s) => {
        const on = s === 'on';
        $('#netDot').dataset.on = String(on);
        $('#netText').textContent = on ? 'متصل' : 'يعيد الاتصال…';
        if (on) pub(true);
      }
    });
  }

  const reject = (mid, r) => { G.rej.push({ m: mid, r }); if (G.rej.length > 3) G.rej.shift(); };

  function onUp(m) {
    if (!G || !G.net || !m || typeof m !== 'object' || m.r !== G.net.room) return;
    if (m.mid) {
      if (seenSet.has(m.mid)) return;
      seenSet.add(m.mid);
      G.net.seen.push(m.mid);
      if (G.net.seen.length > 300) G.net.seen.splice(0, G.net.seen.length - 300);
    }
    const ti = G.teams.findIndex((t) => t.key && t.key === m.k);
    if (ti < 0) return;
    const t = team(ti);
    const wasOn = isOnline(t);
    t.seen = Date.now();

    if (m.type === 'hello') {
      if (!wasOn) { commit(); }
      else pub();
      return;
    }
    if (m.type === 'fleet') {
      if (G.phase !== 'prep') { reject(m.mid, 'المعركة بدأت، ما يمديك تغيّر الأسطول'); commit(); return; }
      const f = F.decode(String(m.f || ''), t.key);
      const err = F.validate(f);
      if (err) { reject(m.mid, `الأسطول ما انقبل: ${err}`); commit(); return; }
      t.fleet = f; t.ready = true;
      addLog('sys', `⚓ وصل أسطول ${t.name}`);
      toast(`⚓ وصل أسطول ${t.name}`, 'ok');
      sfx.place();
      commit();
      return;
    }
    if (m.type === 'unready') {
      if (G.phase === 'prep' && t.ready) { t.ready = false; addLog('sys', `${t.name} يعدّلون أسطولهم`); commit(); }
      return;
    }
    if (m.type === 'shot') {
      const tgt = Number(m.t), i = Number(m.i);
      let why = '';
      if (G.mode !== 'C') why = 'القصف من شاشة المقدّم';
      else if (G.phase !== 'play') why = 'المعركة متوقفة';
      else if (!Number.isInteger(tgt) || tgt < 0 || tgt >= G.teams.length || tgt === ti) why = 'هدف غير صحيح';
      else if (!Number.isInteger(i) || i < 0 || i > 99) why = 'مربع غير صحيح';
      else if (t.strikes <= 0) why = 'ما عندكم ضربات';
      else if (team(tgt).hits[i]) why = 'المربع هذا انقصف قبلكم';
      if (why) { reject(m.mid, why); commit(); return; }
      fire(ti, tgt, i, m.mid);
    }
  }

  // نشر الوضع العلني للجوالات (بلا أساطيل ولا مفاتيح)
  let pubTimer = 0, lastPub = '';
  function pub(force = false) {
    if (!G || !G.net) return;
    clearTimeout(pubTimer);
    pubTimer = setTimeout(() => {
      const p = {
        m: G.mode, ph: G.phase,
        T: G.teams.map((t) => ({
          n: t.name, c: t.color, h: F.hash(G.net.room + t.key),
          sc: t.score, st: t.strikes, rd: t.ready ? 1 : 0, on: isOnline(t) ? 1 : 0,
          pb: G.phase !== 'prep' && t.fleet ? F.packPB(F.publicBoard(t.fleet, t.hits)) : null
        })),
        ev: G.ev, rj: G.rej
      };
      const js = JSON.stringify(p);
      if (!force && js === lastPub) return;
      lastPub = js;
      G.net.seq = (G.net.seq || 0) + 1;
      p.s = G.net.seq;
      NET.publish(`${G.net.room}-p`, p);
      save();
    }, force ? 0 : 220);
  }

  // تحديث كل شيء بعد أي تغيير
  function commit() {
    save();
    if (!G) return;
    if (G.phase === 'prep' && $('#screen-prep').classList.contains('active')) renderPrep();
    if (G.phase !== 'prep' && $('#screen-battle').classList.contains('active')) renderBattle();
    pub();
  }

  // حالة الاتصال للفرق تتغير مع الوقت
  setInterval(() => {
    if (!G || !G.net) return;
    if ($('#screen-prep').classList.contains('active')) renderPrep();
    if ($('#screen-battle').classList.contains('active')) renderScores();
    pub();
  }, 15000);

  // =========================================================
  // الاستئناف بعد إعادة تحميل الصفحة
  // =========================================================
  function resume() {
    if (!G) return;
    if (G.net) connect();
    if (G.phase === 'prep') { renderPrep(); show('screen-prep'); }
    else if (G.phase === 'end') { renderEnd(); show('screen-end'); }
    else { renderBattle(); show('screen-battle'); }
    pub(true);
  }

  // تنبيه إذا أوضاع الجوال بلا اتصال متاح
  if (!NET) { $$('#modes [data-mode="B"], #modes [data-mode="C"]').forEach((b) => { b.disabled = true; }); }

  renderIntro();
  renderSetup();
  // إذا كانت هناك مسابقة جارية بأوضاع الجوال نعيد الاتصال حتى لا تضيع رسائل الفرق
  if (G && G.net && G.phase !== 'end') connect();
})();
