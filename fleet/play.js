/* =========================================================
   الأسطول البحري | جوال الفريق
   الدخول برمز الفريق ← رسم الأسطول وإرساله ← متابعة المعركة (والقصف في الوضع C)
   الجوال لا يقرر شيئًا: يرسل طلبه، وشاشة المقدّم تتحقق وتنشر النتيجة.
   ========================================================= */
(() => {
  'use strict';
  const F = window.Fleet, NET = window.FleetNet;
  const { $, $$, ar, esc, sgn, num, sfx, toast, show, SHIPS } = F;

  F.initChrome();

  let code = '', room = '', key = '', me = -1;
  let P = null;               // آخر وضع علني من المقدّم
  let mine = null;            // { fleet, sent, ev } محفوظ لهذا الرمز
  let subs = [], helloTimer = 0;
  let ed = null, tab = 'strike', tgt = -1, aim = -1, pending = null, flash = null, ownFlash = null;
  let bannerTimer = 0;

  const LAST = 'athar-fleet-last';
  const keyOf = () => `athar-fleet-team-${code}`;
  const persist = () => F.store.set(keyOf(), mine);
  const uidm = () => Math.random().toString(36).slice(2, 10);
  const send = (type, extra = {}) => NET.publish(`${room}-u`, Object.assign({ type, r: room, k: key, mid: uidm() }, extra));

  // =========================================================
  // الدخول
  // =========================================================
  const clean = (s) => F.toLatin(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  $('#codeInput').addEventListener('input', (e) => {
    const c = clean(e.target.value).slice(0, 9);
    e.target.value = c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
  });
  $('#joinForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const c = clean($('#codeInput').value);
    if (c.length !== 9) { joinErr('الرمز ٩ خانات، مثل ABCDE-FGHJ'); return; }
    join(c);
  });
  function joinErr(t) { const el = $('#joinErr'); el.textContent = t; el.hidden = !t; if (t) sfx.deny(); }

  function join(c) {
    if (!NET) { joinErr('الاتصال غير متاح'); return; }
    code = c; room = c.slice(0, 5); key = c.slice(5);
    mine = F.store.get(keyOf(), null) || { fleet: null, sent: false, ev: 0 };
    P = null; me = -1; pending = null; aim = -1; tgt = -1;
    if (ed) ed.set(mine.fleet ? F.clone(mine.fleet) : F.empty());
    F.store.set(LAST, code);
    joinErr('');
    F.S.whoosh(true);
    show('screen-team');
    $('#netDot').hidden = false;
    $('#meSub').textContent = `رمز ${room}-${key}`;
    renderAll();
    subs.forEach((s) => s.close());
    subs = [NET.subscribe(`${room}-p`, onPub, {
      onStatus: (s) => {
        const on = s === 'on';
        $('#netDot').dataset.on = String(on);
        $('#netText').textContent = on ? 'متصل' : 'يعيد الاتصال…';
        if (on) hello();
      }
    })];
    clearInterval(helloTimer);
    helloTimer = setInterval(() => { if (document.visibilityState === 'visible') hello(); }, 30000);
    try { history.replaceState(null, '', location.pathname + keepParams()); } catch { /* تجاهل */ }
  }
  function keepParams() {
    const p = new URLSearchParams(location.search), q = new URLSearchParams();
    ['net', 'fbemu'].forEach((k) => { if (p.get(k)) q.set(k, p.get(k)); });
    const s = q.toString();
    return s ? '?' + s : '';
  }
  const hello = () => send('hello');

  $('#leaveBtn').onclick = async () => {
    if (!(await F.confirmBox({ title: 'تطلع من الفريق؟', text: 'تقدر ترجع بنفس الرمز متى ما بغيت.', yes: 'اطلع' }))) return;
    subs.forEach((s) => s.close()); subs = [];
    clearInterval(helloTimer);
    F.store.del(LAST);
    P = null; me = -1; code = '';
    $('#netDot').hidden = true;
    $('#meName').textContent = 'الأسطول البحري';
    $('#meSub').textContent = 'جوال الفريق';
    document.body.style.removeProperty('--tc');
    show('screen-join');
  };

  // =========================================================
  // استقبال الوضع العلني
  // =========================================================
  function onPub(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.T)) return;
    if (P && typeof p.s === 'number' && typeof P.s === 'number' && p.s < P.s) return; // رسالة أقدم
    const prev = P;
    p.T.forEach((t) => { t.pb = t.pb ? F.unpackPB(t.pb) : null; });
    P = p;
    me = p.T.findIndex((t) => t.h === F.hash(room + key));
    if (me < 0) { renderAll(); return; }
    // نتيجة طلب معلّق: رفض؟
    if (pending && Array.isArray(p.rj)) {
      const r = p.rj.find((x) => x.m === pending.mid);
      if (r) { toast(r.r, 'bad'); sfx.deny(); pending = null; }
    }
    // حدث قصف جديد
    if (p.ev && p.ev.id && p.ev.id !== mine.ev) {
      const first = !prev;
      mine.ev = p.ev.id; persist();
      if (!first) onEvent(p.ev);
    }
    if (p.ph === 'end' && prev && prev.ph !== 'end') { sfx.win(); setTimeout(() => F.confetti($('#confetti')), 250); }
    if (p.ph === 'play' && prev && prev.ph === 'prep') { sfx.whistle(); toast('بدأت المعركة! ⚓'); }
    renderAll();
  }

  function onEvent(ev) {
    const T = P.T, a = T[ev.a], t = T[ev.t];
    if (!a || !t) return;
    const res = { t: ev.s, sw: ev.w, tr: ev.r, kind: ev.k, pts: ev.p };
    const where = F.cellName(ev.i);
    if (pending && ev.m === pending.mid) pending = null;
    if (ev.a === me) {
      // نتيجة ضربتنا
      tgt = ev.t;
      flash = { i: ev.i, kind: ev.k };
      setTimeout(() => { flash = null; renderPlay(); }, 1200);
      playSound(ev);
      if (ev.k === 'miss') banner('miss', '', 'ماء!', `قصفتوا ${where} عند ${t.n}`);
      else if (ev.k === 'trap') banner('trap', '', `فخ! ${sgn(ev.p)}`, F.shotText(res));
      else banner('hit', ev.sk, ev.sk ? `أغرقتوا ${SHIPS[ev.sk].name}!` : `إصابة! ${sgn(ev.p)}`, `${F.shotText(res)} · وضربة إضافية لكم`);
      if (ev.k === 'trap') F.shake($('#pFrame'));
    } else if (ev.t === me) {
      // أحد قصفنا
      ownFlash = { i: ev.i, kind: ev.k };
      setTimeout(() => { ownFlash = null; renderPlay(); }, 1200);
      playSound(ev);
      const what = ev.k === 'miss' ? 'ماء، نجونا 💦' : ev.sk ? `غرقت ${SHIPS[ev.sk].name} لنا!` : F.shotText(res);
      toast(`${a.n} قصفونا في ${where}: ${what}`, ev.k === 'miss' ? 'ok' : 'bad');
      if (navigator.vibrate && ev.k !== 'miss') { try { navigator.vibrate(ev.k === 'trap' ? [80, 60, 80] : 120); } catch { /* تجاهل */ } }
    } else {
      toast(`${a.n} ← ${t.n} (${where}): ${ev.k === 'miss' ? 'ماء' : ev.k === 'trap' ? 'فخ!' : 'إصابة!'}`);
    }
  }
  function playSound(ev) {
    if (ev.k === 'miss') sfx.splash();
    else if (ev.k === 'trap') sfx.trap();
    else if (ev.sk) sfx.sink();
    else sfx.hit();
  }

  function banner(kind, sunk, title, text) {
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

  // =========================================================
  // الرسم
  // =========================================================
  function renderAll() {
    const T = P && P.T, my = T && me >= 0 ? T[me] : null;
    const wait = $('#waitBox');
    $('#prepBox').hidden = $('#playBox').hidden = $('#endBox').hidden = true;
    if (!my) {
      wait.hidden = false;
      $('#waitTitle').textContent = P ? 'الرمز هذا ما يطابق أي فريق' : 'نتصل بغرفة العمليات…';
      $('#waitText').textContent = P ? 'تأكدوا من الرمز على شاشة المقدّم، أو اطلعوا وادخلوا من جديد.' : 'خلّ الصفحة مفتوحة، ونربطك بشاشة المقدّم.';
      $('#teamName').textContent = '…';
      return;
    }
    wait.hidden = true;
    document.body.style.setProperty('--tc', my.c);
    $('#meName').textContent = my.n;
    $('#teamName').textContent = my.n;
    $('#teamMode').textContent = P.m === 'C' ? 'ترسمون وتقصفون من الجوال' : 'ترسمون من الجوال، والقصف عند المقدّم';
    $('#myScore').textContent = num(my.sc);
    const sEl = $('#myStrikes');
    if (sEl.textContent !== ar(my.st)) { sEl.textContent = ar(my.st); sEl.parentElement.classList.remove('bump'); void sEl.offsetWidth; sEl.parentElement.classList.add('bump'); }
    if (P.ph === 'prep') renderPrep(my);
    else if (P.ph === 'play') { $('#playBox').hidden = false; renderPlay(); }
    else renderEnd();
  }

  // ---------- رسم الأسطول ----------
  function renderPrep(my) {
    $('#prepBox').hidden = false;
    if (!ed) ed = F.editor($('#phoneEditor'), { fleet: mine.fleet ? F.clone(mine.fleet) : F.empty(), toast, onChange: (f) => { mine.fleet = f; persist(); syncSend(); } });
    const sent = $('#sentBox'), draw = $('#drawBox');
    if (my.rd) {
      sent.hidden = false; draw.hidden = true;
      $('#sentIco').innerHTML = F.ico('i-check');
      sent.className = 'card status ok';
      $('#sentTitle').textContent = mine.sent ? 'وصل أسطولكم للمقدّم ✓' : 'المقدّم جهّز أسطولكم ✓';
      $('#sentText').textContent = 'انتظروا بداية المعركة. تقدرون تعدّلون قبلها.';
    } else if (mine.sent) {
      sent.hidden = false; draw.hidden = true;
      sent.className = 'card status wait';
      $('#sentIco').innerHTML = '<span class="mini-sweep"></span>';
      $('#sentTitle').textContent = 'أرسلنا أسطولكم…';
      $('#sentText').textContent = 'ننتظر تأكيد شاشة المقدّم.';
    } else {
      sent.hidden = true; draw.hidden = false;
    }
    syncSend();
  }
  function syncSend() {
    const ok = ed && F.isComplete(ed.fleet);
    $('#sendFleet').disabled = !ok;
    $('#sendFleet').textContent = ok ? 'ثبّت أسطولنا وأرسله' : 'كمّلوا الأسطول أولًا';
  }
  $('#sendFleet').onclick = async () => {
    const f = ed.fleet;
    if (!F.isComplete(f)) return;
    $('#sendFleet').disabled = true;
    const ok = await send('fleet', { f: F.encode(f, key) });
    if (!ok) { toast('ما انرسل، تأكدوا من الاتصال وجرّبوا ثانية', 'bad'); $('#sendFleet').disabled = false; return; }
    mine.fleet = F.clone(f); mine.sent = true; persist();
    sfx.place();
    renderAll();
    // إذا ما وصل التأكيد خلال ١٢ ثانية نرجّع زر الإرسال
    setTimeout(() => { if (P && me >= 0 && P.ph === 'prep' && !P.T[me].rd && mine.sent) { mine.sent = false; persist(); renderAll(); toast('ما وصل التأكيد، أرسلوه مرة ثانية', 'bad'); } }, 12000);
  };
  $('#editAgain').onclick = () => {
    mine.sent = false; persist();
    send('unready');
    if (P && me >= 0) P.T[me].rd = 0;
    F.S.tongue();
    renderAll();
  };

  // ---------- المعركة ----------
  let pBoard = null, ownBoard = null;
  function renderPlay() {
    if (!P || me < 0 || P.ph !== 'play') return;
    const T = P.T, my = T[me];
    const canStrike = P.m === 'C';
    $('#phoneTabs').hidden = !canStrike;
    if (!canStrike) tab = 'own';
    $$('#phoneTabs [data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    $('#tab-strike').hidden = tab !== 'strike';
    $('#tab-own').hidden = tab !== 'own';

    if (tab === 'strike') {
      if (tgt < 0 || tgt === me || !T[tgt]) tgt = T.findIndex((t, i) => i !== me);
      $('#pTargets').innerHTML = T.map((t, i) => i === me ? '' : `
        <button class="tab${i === tgt ? ' on' : ''}" data-tgt="${i}" style="--tc:${t.c}" aria-pressed="${i === tgt}"><i class="dot"></i>${esc(t.n)}</button>`).join('');
      const t = T[tgt], pb = t.pb || { b: '.'.repeat(100), x: {}, k: [] };
      if (!pBoard) pBoard = F.makeBoard($('#pBoard'), { onCell: onCell });
      if (aim >= 0 && pb.b[aim] !== '.') aim = -1;
      $('#pFrame').style.setProperty('--tc', t.c);
      $('#pFrameTitle').textContent = `أسطول ${t.n}`;
      $('#pFrameStat').textContent = `غرق ${ar(pb.k.length)} · انكشف ${ar(F.explored(pb))}`;
      pBoard.paint({ pb, aim, pending: pending && pending.t === tgt ? pending.i : -1, flash, onlyFog: true, lock: !!pending });
      const btn = $('#pFireBtn');
      btn.disabled = !(my.st > 0 && aim >= 0 && !pending);
      btn.textContent = pending ? 'ينتظر…' : aim >= 0 ? `أطلق على ${F.cellName(aim)}` : 'أطلق';
      $('#pFireText').innerHTML = pending ? 'أرسلنا الضربة لغرفة العمليات…'
        : my.st <= 0 ? 'ما عندكم ضربات. جاوبوا صح عشان تكسبون ضربة!'
          : aim >= 0 ? `الهدف ${F.cellName(aim)} · اضغطوا «أطلق» أو المربع مرة ثانية` : 'اختاروا مربعًا في خريطة الخصم';
    } else {
      if (!ownBoard) ownBoard = F.makeBoard($('#ownBoard'));
      const pb = my.pb || { b: '.'.repeat(100), x: {}, k: [] };
      ownBoard.paint({ own: mine.fleet, pb, flash: ownFlash, lock: true });
      $('#ownStat').textContent = `خسرنا ${ar(pb.k.length)} قطع · انقصف ${ar(F.explored(pb))} مربع`;
      $('#ownNote').textContent = mine.fleet ? 'المربعات المقصوفة عليها علامة. هذا الأسطول يظهر لكم فقط.' : 'المقدّم جهّز أسطولكم، فنعرض لكم المربعات المقصوفة فقط.';
    }
    renderScores($('#pScores'), T);
  }

  function renderScores(el, T) {
    const order = T.map((t, i) => i).sort((a, b) => T[b].sc - T[a].sc);
    el.innerHTML = order.map((i, r) => `<li class="srow${i === me ? ' att' : ''}" style="--tc:${T[i].c}">
      <span class="rank">${ar(r + 1)}</span><span class="sname"><i class="dot"></i>${esc(T[i].n)}</span>
      <span class="spts">${num(T[i].sc)}<small>نقطة</small></span><span class="sstr">${F.ico('i-bolt')}${ar(T[i].st)}</span></li>`).join('');
  }

  $('#phoneTabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; F.S.tongue(0, 0.2); renderPlay(); };
  $('#pTargets').onclick = (e) => { const b = e.target.closest('[data-tgt]'); if (!b) return; tgt = +b.dataset.tgt; aim = -1; F.S.whoosh(true); renderPlay(); };

  function onCell(i) {
    if (!P || me < 0 || P.ph !== 'play' || pending) return;
    if (P.T[me].st <= 0) { sfx.deny(); toast('ما عندكم ضربات. جاوبوا صح أول!', 'bad'); return; }
    if (aim === i) { fireNow(); return; }
    aim = i; sfx.aim(); renderPlay();
  }
  $('#pFireBtn').onclick = () => fireNow();
  async function fireNow() {
    if (aim < 0 || pending) return;
    const mid = uidm();
    pending = { mid, t: tgt, i: aim, at: Date.now() };
    aim = -1;
    renderPlay();
    const ok = await NET.publish(`${room}-u`, { type: 'shot', r: room, k: key, mid, t: pending.t, i: pending.i });
    if (!ok) { pending = null; toast('ما انرسلت الضربة، جرّبوا ثانية', 'bad'); renderPlay(); return; }
    setTimeout(() => {
      if (pending && pending.mid === mid) { pending = null; toast('ما وصل الرد من المقدّم، جرّبوا ثانية', 'bad'); renderPlay(); }
    }, 12000);
  }

  // ---------- النهاية ----------
  function renderEnd() {
    $('#endBox').hidden = false;
    const T = P.T;
    const order = T.map((t, i) => i).sort((a, b) => T[b].sc - T[a].sc);
    const top = T[order[0]].sc, winners = order.filter((i) => T[i].sc === top);
    $('#pWin').textContent = winners.length > 1 ? 'تعادل!' : `${T[winners[0]].n} فازوا`;
    $('#pWinText').textContent = winners.includes(me) ? 'مبروك يا أبطال البحر! 🏆' : 'معركة حلوة، المرة الجاية لكم 🌊';
    let last = null, rank = 0;
    $('#pFinal').innerHTML = order.map((i, k) => {
      if (T[i].sc !== last) { rank = k + 1; last = T[i].sc; }
      return `<li class="${rank === 1 ? 'first' : ''}" style="--tc:${T[i].c}"><span class="rank">${ar(rank)}</span><i class="dot"></i><strong>${esc(T[i].n)}</strong><b>${num(T[i].sc)}</b></li>`;
    }).join('');
  }

  // =========================================================
  // البداية: من رابط QR أو آخر رمز محفوظ
  // =========================================================
  const qp = new URLSearchParams(location.search);
  const fromLink = clean(qp.get('c') || '');
  const last = F.store.get(LAST, '');
  if (fromLink.length === 9) join(fromLink);
  else if (last && last.length === 9) { $('#codeInput').value = `${last.slice(0, 5)}-${last.slice(5)}`; join(last); }
})();
