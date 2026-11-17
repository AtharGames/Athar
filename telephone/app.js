/* =========================================================
   من سيربح التيلفون | منطق المسابقة
   القواعد: سُلّم تصاعدي مستقل لكل فريق، خزينة، وسائل مساعدة
   ========================================================= */
(() => {
  'use strict';

  // ---------- أدوات مساعدة ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const num = (n) => Number(n).toLocaleString('ar-EG');
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = window.AtharSound;

  // ---------- رنّة التيلفون المسجّلة (sounds/ring.mp3) ----------
  // تحترم زر الكتم المشترك، وتُحمَّل مسبقًا حتى تشتغل فورًا مع الضغطة.
  const RING_URL = new URL('sounds/ring.mp3', (document.currentScript && document.currentScript.src) || location.href).href;
  let ringCtx = null, ringBuf = null, ringRaw = null;
  fetch(RING_URL).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { ringRaw = b; }).catch(() => {});
  function playRing() {
    if (!S || !S.on) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!ringCtx && C) ringCtx = new C();
      if (ringCtx && ringCtx.state === 'suspended') ringCtx.resume().catch(() => {});
      const go = (b) => { const src = ringCtx.createBufferSource(); src.buffer = b; src.connect(ringCtx.destination); src.start(); };
      if (ringCtx && ringBuf) return go(ringBuf);
      if (ringCtx && ringRaw) return ringCtx.decodeAudioData(ringRaw.slice(0), (b) => { ringBuf = b; go(b); }, () => {});
      const a = new Audio(RING_URL); a.play().catch(() => {});
    } catch { /* تجاهل */ }
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } }
  };

  // ---------- ثوابت اللعب ----------
  const LADDER = [100, 300, 500, 800, 1000, 1500, 2000, 3000, 5000];  // سُلّم النقاط
  const MAX_ROUNDS = 20;
  const BANK_GAP = 2;            // الخزينة مرة كل جولتين
  const POINT_STEP = 50, MIN_POINTS = 50;
  const MIN_TEAMS = 2, MAX_TEAMS = 6;
  const THEMES = ['light', 'navy', 'blue'];
  const TEAM_THEMES = [
    { c: '#E8554E', name: 'الفريق الأحمر' },
    { c: '#E59A1C', name: 'الفريق الذهبي' },
    { c: '#1FA971', name: 'الفريق الأخضر' },
    { c: '#8257E5', name: 'الفريق البنفسجي' },
    { c: '#E0559B', name: 'الفريق الوردي' },
    { c: '#0FA3B1', name: 'الفريق الفيروزي' }
  ];
  const DEFAULT_TITLE = 'من سيربح التيلفون';
  const DEFAULT_HOST  = 'أبونواف';
  const LIFE = {
    fifty:    { label: 'حذف إجابتين (٥٠:٥٠)' },
    change:   { label: 'تغيير السؤال' },
    audience: { label: 'تصويت الجمهور' }
  };
  const ICONS = {
    ok:   '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    bad:  '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17v.5"/><circle cx="12" cy="12" r="9.5" stroke-width="2"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke-width="2"/></svg>'
  };

  // ---------- الإعدادات (العنوان والمقدّم محفوظان) ----------
  const cfg = {
    title: store.get('telephone-title', DEFAULT_TITLE),
    host:  store.get('telephone-host', DEFAULT_HOST),
    count: 2,
    names: TEAM_THEMES.map((t) => t.name)
  };
  const title = () => cfg.title.trim() || DEFAULT_TITLE;
  const host  = () => cfg.host.trim() || DEFAULT_HOST;

  // ---------- حالة اللعب ----------
  let teams = [], cur = 0, round = 1;

  const el = {
    soundBtn: $('#soundBtn'), titleInput: $('#titleInput'), hostInput: $('#hostInput'),
    counts: $('#counts'), teamInputs: $('#teamInputs'),
    game: $('.game'), desks: $('#desks'), hostSpeech: $('#hostSpeech'), roundNow: $('#roundNow'), roundMax: $('#roundMax'),
    qPoints: $('#qPoints'), ladder: $('#ladder'), activeName: $('#activeName'), audienceNote: $('#audienceNote'),
    modal: $('#modal'), modalIcon: $('#modalIcon'), modalTitle: $('#modalTitle'), modalText: $('#modalText'), modalOk: $('#modalOk'),
    confirm: $('#confirm'), confirmTitle: $('#confirmTitle'), confirmText: $('#confirmText'), confirmYes: $('#confirmYes'), confirmNo: $('#confirmNo'),
    victoryKicker: $('#victoryKicker'), winnerName: $('#winnerName'), winnerText: $('#winnerText'), finalBoard: $('#finalBoard'),
    confetti: $('#confetti'), trophy: $('.trophy')
  };

  // =========================================================
  // واجهة عامة
  // =========================================================
  function setTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    document.documentElement.dataset.theme = t;
    store.set('athar-theme', t);
    $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  }

  // عكس العنوان واسم المقدّم في كامل الواجهة
  function bindNames() {
    $$('[data-bind="title"]').forEach((n) => { n.textContent = title(); });
    $$('[data-bind="host"]').forEach((n) => { n.textContent = host(); });
    document.title = `${title()} مع ${host()} | أثَر`;
  }

  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  // رسالة بزر واحد، وبعد إغلاقها يُنفَّذ after إن وُجد
  let modalAfter = null;
  function info({ title: t, text, icon = 'info', tone = '' }, after) {
    el.modalTitle.textContent = t;
    el.modalText.textContent = text;
    el.modalIcon.innerHTML = ICONS[icon];
    el.modalIcon.className = `modal-icon ${tone}`;
    modalAfter = after || null;
    el.modal.hidden = false;
    el.modalOk.focus();
  }
  function closeInfo() {
    if (el.modal.hidden) return;
    el.modal.hidden = true;
    const cb = modalAfter; modalAfter = null;
    S.tongue(0, 0.2);
    if (cb) cb();
  }

  let confirmCb = null;
  function ask({ title: t, text, yes }, onYes) {
    el.confirmTitle.textContent = t;
    el.confirmText.textContent = text;
    el.confirmYes.textContent = yes;
    confirmCb = onYes;
    el.confirm.hidden = false;
    el.confirmNo.focus();
  }
  function closeAsk(ok) {
    if (el.confirm.hidden) return;
    el.confirm.hidden = true;
    const cb = confirmCb; confirmCb = null;
    if (ok && cb) cb(); else S.tongue(0, 0.2);
  }

  // =========================================================
  // شاشة البداية
  // =========================================================
  function renderCounts() {
    el.counts.innerHTML = '';
    for (let n = MIN_TEAMS; n <= MAX_TEAMS; n++) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = num(n);
      b.setAttribute('aria-label', `${num(n)} فرق`);
      b.setAttribute('aria-pressed', String(n === cfg.count));
      b.addEventListener('click', () => { cfg.count = n; S.tongue(0, 0.2); renderCounts(); renderTeamInputs(); });
      el.counts.append(b);
    }
  }

  function renderTeamInputs() {
    el.teamInputs.innerHTML = '';
    for (let i = 0; i < cfg.count; i++) {
      const row = document.createElement('div');
      row.className = 'team-row';
      const no = document.createElement('span');
      no.className = 'team-no';
      no.style.setProperty('--c', TEAM_THEMES[i].c);
      no.textContent = num(i + 1);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 20;
      input.value = cfg.names[i];
      input.placeholder = TEAM_THEMES[i].name;
      input.setAttribute('aria-label', `اسم الفريق ${num(i + 1)}`);
      input.addEventListener('input', (e) => { cfg.names[i] = e.target.value; });
      row.append(no, input);
      el.teamInputs.append(row);
    }
  }

  // =========================================================
  // اللعب
  // =========================================================
  function startGame() {
    teams = [];
    for (let i = 0; i < cfg.count; i++) {
      teams.push({
        name: cfg.names[i].trim() || TEAM_THEMES[i].name,
        color: TEAM_THEMES[i].c,
        score: 0,
        bankedScore: 0,
        lifelines: { fifty: true, change: true, audience: true },
        lastBankedRound: 0,
        ladderIndex: 0,                 // سُلّم مستقل لكل فريق
        currentQuestionPoints: LADDER[0]
      });
    }
    cur = 0; round = 1;
    cancelAnimationFrame(confettiRaf);
    render();
    show('screen-game');
    playRing(); // رنّة التيلفون عند فتح الاستوديو
  }

  function render(bumpIdx = -1) {
    const t = teams[cur];
    el.game.style.setProperty('--c', t.color);

    // طاولات الفرق
    el.desks.innerHTML = '';
    teams.forEach((team, i) => {
      const d = document.createElement('button');
      d.className = 'desk' + (i === cur ? ' active' : '');
      d.style.setProperty('--c', team.color);
      d.setAttribute('aria-pressed', String(i === cur));
      d.innerHTML =
        '<span class="desk-top"><span class="desk-no"></span><span class="desk-live">الدور هنا</span></span>' +
        '<h4 class="desk-name"></h4>' +
        '<div class="desk-score"><span></span><small>نقطة</small></div>' +
        '<div class="desk-meta"><span>الخزينة الآمنة: <b class="m-bank"></b></span><span>السؤال القادم: <b class="m-next"></b></span></div>';
      $('.desk-no', d).textContent = `طاولة ${num(i + 1)}`;
      $('.desk-name', d).textContent = team.name;
      $('.desk-score span', d).textContent = num(team.score);
      $('.m-bank', d).textContent = num(team.bankedScore);
      $('.m-next', d).textContent = num(team.currentQuestionPoints);
      if (i === bumpIdx) $('.desk-score', d).classList.add('bump');
      d.addEventListener('click', () => selectTeam(i));
      el.desks.append(d);
    });

    el.roundNow.textContent = num(round);
    el.roundMax.textContent = num(MAX_ROUNDS);
    el.activeName.textContent = t.name;
    el.qPoints.textContent = num(t.currentQuestionPoints);
    el.hostSpeech.textContent = `الدور الآن على (${t.name}). ألقِ السؤال شفهيًا بقيمة ${num(t.currentQuestionPoints)} نقطة، ثم سجّل النتيجة.`;

    // سُلّم الفريق
    el.ladder.innerHTML = '';
    LADDER.forEach((v, i) => {
      const r = document.createElement('span');
      r.className = 'rung' + (i < t.ladderIndex ? ' done' : i === t.ladderIndex ? ' now' : '');
      r.style.setProperty('--i', i);
      r.textContent = num(v);
      el.ladder.append(r);
    });

    // وسائل المساعدة
    $$('.life').forEach((b) => {
      const ok = t.lifelines[b.dataset.life];
      b.disabled = !ok;
      $('em', b).textContent = ok ? 'متاحة' : 'مستخدمة';
    });
    el.audienceNote.hidden = true;
  }

  function selectTeam(i) {
    if (i < 0 || i >= teams.length || i === cur) return;
    cur = i;
    S.tongue(0, 0.25); S.drop(440, 0.05, 0.16);
    render();
  }

  function changePoints(delta) {
    const t = teams[cur];
    t.currentQuestionPoints = Math.max(MIN_POINTS, t.currentQuestionPoints + delta);
    S.tongue(0, 0.16);
    render();
  }

  // الإشارة تقوى (صح) أو ينقطع الخط (خطأ) على سُلّم الفريق
  function ladderMoment(kind) {
    el.ladder.classList.remove('surge', 'cut'); void el.ladder.offsetWidth;
    el.ladder.classList.add(kind);
    clearTimeout(ladderMoment.t);
    ladderMoment.t = setTimeout(() => el.ladder.classList.remove(kind), 1300);
  }

  // مهلة قصيرة لرؤية لحظة السلّم قبل نافذة النتيجة، مع قفل أزرار التقييم حتى لا تنضغط مرتين
  let answering = false;
  const MOMENT_MS = 850;
  function afterMoment(fn) {
    answering = true;
    $$('#correctBtn, #wrongBtn').forEach((b) => { b.disabled = true; });
    setTimeout(() => {
      answering = false;
      $$('#correctBtn, #wrongBtn').forEach((b) => { b.disabled = false; });
      fn();
    }, MOMENT_MS);
  }

  function handleAnswer(correct) {
    if (answering) return;
    const t = teams[cur];
    if (correct) {
      const gained = t.currentQuestionPoints;
      t.score += gained;
      // تصعيد سُلّم هذا الفريق فقط
      t.ladderIndex = Math.min(t.ladderIndex + 1, LADDER.length - 1);
      t.currentQuestionPoints = LADDER[t.ladderIndex];
      S.drop(480, 0); S.drop(600, 0.09); S.drop(760, 0.18); S.chirp(0.32, 3100);
      render(cur);
      ladderMoment('surge');
      afterMoment(() => info({
        title: 'إجابة صحيحة!',
        text: `إجابة ممتازة من ${t.name}! أُضيفت ${num(gained)} نقطة وصار رصيدهم ${num(t.score)} نقطة. قيمة سؤالهم القادم ارتفعت إلى ${num(t.currentQuestionPoints)} نقطة.`,
        icon: 'ok', tone: 'ok'
      }, nextTurn));
    } else {
      t.score = t.bankedScore;
      // تصفير سُلّم هذا الفريق فقط
      t.ladderIndex = 0;
      t.currentQuestionPoints = LADDER[0];
      S.tongue(0, 0.3); S.tongue(0.13, 0.3); S.sigh(0.3);
      render(cur);
      ladderMoment('cut');
      afterMoment(() => info({
        title: 'إجابة خاطئة!',
        text: `للأسف إجابة غير صحيحة من ${t.name}. ضاعت النقاط غير المحفوظة، ورصيدهم المؤكد بالخزينة ${num(t.score)} نقطة. قيمة سؤالهم القادم رجعت إلى ${num(LADDER[0])} نقطة.`,
        icon: 'bad', tone: 'bad'
      }, nextTurn));
    }
  }

  function nextTurn() {
    cur++;
    if (cur >= teams.length) { cur = 0; round++; }
    if (round > MAX_ROUNDS) endGame();
    else { S.whoosh(true); render(); }
  }

  // ---------- وسائل المساعدة ----------
  function useLifeline(type) {
    const t = teams[cur];
    if (!t.lifelines[type]) return;
    t.lifelines[type] = false;
    S.whoosh(true); S.drop(640, 0.2, 0.18);
    render();

    if (type === 'fifty') {
      info({ title: 'حذف إجابتين (٥٠:٥٠)', text: `طلب ${t.name} حذف إجابتين. يا ${host()}، احذف خيارين خاطئين من الخيارات وأبلغهم شفهيًا.` });
    } else if (type === 'change') {
      info({ title: 'تغيير السؤال', text: `طلب ${t.name} تغيير السؤال. يا ${host()}، ألقِ عليهم سؤالًا آخر.` });
    } else {
      el.audienceNote.textContent = `تنبيه لـ${host()}: اطلب من الجمهور التصويت شفهيًا أو برفع الأيدي لمساعدة ${t.name}.`;
      el.audienceNote.hidden = false;
      info({ title: 'تصويت الجمهور', text: `الجمهور يساعد ${t.name}! استمع لتصويت الحضور لمعرفة الخيار المرجّح.` });
    }
  }

  // ---------- الخزينة ----------
  function openBank() {
    const t = teams[cur];
    if (t.lastBankedRound !== 0 && round - t.lastBankedRound < BANK_GAP) {
      S.tongue(0, 0.28); S.tongue(0.09, 0.2);
      info({ title: 'الخزينة مقفلة مؤقتًا', text: `الخزينة متاحة مرة واحدة كل جولتين لكل فريق. انتظروا الجولة القادمة يا ${t.name}.`, icon: 'lock' });
      return;
    }
    S.tongue(0, 0.2);
    ask({
      title: 'خزينة حفظ النقاط',
      text: `طاولة ${t.name}، رصيدهم الحالي ${num(t.score)} نقطة. نحفظه في الخزينة حتى لا يضيع عند أي إجابة خاطئة؟ (قيمة سؤالهم القادم ترجع إلى ${num(LADDER[0])} نقطة.)`,
      yes: 'تأكيد الحفظ'
    }, confirmBank);
  }

  function confirmBank() {
    const t = teams[cur];
    t.bankedScore = t.score;
    t.lastBankedRound = round;
    // الحفظ يرجّع هذا الفريق لأول السُلّم
    t.ladderIndex = 0;
    t.currentQuestionPoints = LADDER[0];
    S.drop(220, 0, 0.3); S.drop(170, 0.14, 0.3); S.whoosh(false, 0.3);
    render();
    info({
      title: 'تم الحفظ بالخزينة',
      text: `صار رصيد ${t.name} آمنًا (${num(t.bankedScore)} نقطة) ولن يضيع عند الإجابة الخاطئة. قيمة سؤالهم القادم رجعت إلى ${num(LADDER[0])} نقطة.`,
      icon: 'lock'
    });
  }

  // =========================================================
  // النهاية
  // =========================================================
  let confettiRaf = 0;

  function endGame() {
    const sorted = [...teams].sort((a, b) => b.score - a.score);
    const top = sorted[0].score;
    const winners = sorted.filter((t) => t.score === top);

    el.trophy.style.setProperty('--win', winners[0].color);
    el.winnerName.style.setProperty('--win', winners[0].color);
    if (top === 0) {
      el.victoryKicker.textContent = `انتهت «${title()}»`;
      el.winnerName.textContent = 'لا فائز هذه المرة';
      el.winnerText.textContent = `كل الأرصدة صفر. يقول ${host()}: نعيدها ونشوف من يستاهل!`;
    } else if (winners.length > 1) {
      el.victoryKicker.textContent = `تعادل في «${title()}»!`;
      el.winnerName.textContent = winners.map((t) => t.name).join(' و');
      el.winnerText.textContent = `تساووا في المركز الأول برصيد ${num(top)} نقطة. الحسم عند ${host()}!`;
    } else {
      el.victoryKicker.textContent = `مبروك الفوز في «${title()}»!`;
      el.winnerName.textContent = winners[0].name;
      el.winnerText.textContent = `تهانينا الحارة لـ(${winners[0].name}) على المركز الأول برصيد ${num(top)} نقطة، والجائزة يسلّمها ${host()}.`;
    }

    el.finalBoard.innerHTML = '';
    sorted.forEach((t, i) => {
      const r = document.createElement('div');
      r.className = 'final-row' + (top > 0 && t.score === top ? ' win' : '');
      r.style.setProperty('--c', t.color);
      r.style.animationDelay = `${0.15 * i + 0.4}s`;
      r.innerHTML = '<span class="final-rank"></span><span class="final-name"></span><span class="final-pts"><span></span><small></small></span>';
      $('.final-rank', r).textContent = num(i + 1);
      $('.final-name', r).textContent = t.name;
      $('.final-pts span', r).textContent = `${num(t.score)} نقطة`;
      $('.final-pts small', r).textContent = `بالخزينة: ${num(t.bankedScore)}`;
      el.finalBoard.append(r);
    });

    show('screen-victory');
    if (top > 0) {
      // انبثاق + هتاف جمهور + تصفيق
      S.winner();
      confetti(winners.map((t) => t.color));
    } else {
      S.gust(); S.sigh(0.5);
    }
  }

  function confetti(colors) {
    if (reducedMotion()) return;
    const cv = el.confetti, g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const cols = [...colors, '#5CC2F5', '#3B98EA', '#BFE3FC', '#FFFFFF'];
    const parts = Array.from({ length: 170 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.4,
      vx: (Math.random() - 0.5) * 26 * dpr, vy: (-Math.random() * 22 - 6) * dpr,
      s: (5 + Math.random() * 8) * dpr, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: cols[Math.floor(Math.random() * cols.length)]
    }));
    const t0 = performance.now();
    cancelAnimationFrame(confettiRaf);
    const step = (now) => {
      const age = now - t0;
      g.clearRect(0, 0, W, H);
      if (age > 5200 || !$('#screen-victory').classList.contains('active')) return;
      g.globalAlpha = age > 4200 ? 1 - (age - 4200) / 1000 : 1;
      parts.forEach((p) => {
        p.vy += 0.45 * dpr; p.vx *= 0.985;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = p.c;
        g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
        g.restore();
      });
      confettiRaf = requestAnimationFrame(step);
    };
    confettiRaf = requestAnimationFrame(step);
  }

  function resetGame() {
    cancelAnimationFrame(confettiRaf);
    S.tongue(0, 0.2);
    show('screen-setup');
  }

  // =========================================================
  // ربط الأحداث
  // =========================================================
  $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); S.tongue(0, 0.2); }));
  setTheme(document.documentElement.dataset.theme);

  el.soundBtn.setAttribute('aria-pressed', String(S.on));
  el.soundBtn.addEventListener('click', () => el.soundBtn.setAttribute('aria-pressed', String(S.toggle())));

  // زر أنوار المسرح: يطفّي حزم الضوء وتوهّج الأضواء الأرضية، ويحفظ الاختيار على الجهاز
  const lightsBtn = $('#lightsBtn');
  const lightsOn = () => document.documentElement.getAttribute('data-lights') !== 'off';
  lightsBtn.setAttribute('aria-pressed', String(lightsOn()));
  lightsBtn.addEventListener('click', () => {
    const on = !lightsOn();
    if (on) document.documentElement.removeAttribute('data-lights');
    else document.documentElement.setAttribute('data-lights', 'off');
    try { localStorage.setItem('tel-lights', on ? 'on' : 'off'); } catch { /* تجاهل */ }
    lightsBtn.setAttribute('aria-pressed', String(on));
    S.tongue(0, 0.2);
  });

  // العنوان واسم المقدّم: تحديث مباشر وحفظ
  el.titleInput.value = cfg.title;
  el.hostInput.value = cfg.host;
  el.titleInput.placeholder = DEFAULT_TITLE;
  el.hostInput.placeholder = DEFAULT_HOST;
  el.titleInput.addEventListener('input', (e) => { cfg.title = e.target.value; store.set('telephone-title', cfg.title); bindNames(); });
  el.hostInput.addEventListener('input', (e) => { cfg.host = e.target.value; store.set('telephone-host', cfg.host); bindNames(); });

  $('#startBtn').addEventListener('click', startGame);
  $('#minusBtn').addEventListener('click', () => changePoints(-POINT_STEP));
  $('#plusBtn').addEventListener('click', () => changePoints(POINT_STEP));
  $('#correctBtn').addEventListener('click', () => handleAnswer(true));
  $('#wrongBtn').addEventListener('click', () => handleAnswer(false));
  $$('.life').forEach((b) => b.addEventListener('click', () => useLifeline(b.dataset.life)));
  $('#bankBtn').addEventListener('click', openBank);
  $('#endBtn').addEventListener('click', () => {
    S.tongue(0, 0.2);
    ask({ title: 'ننهي المسابقة الآن؟', text: 'نعلن الفائز حسب الأرصدة الحالية دون إكمال بقية الجولات.', yes: 'نعم، أعلن الفائز' }, endGame);
  });
  $('#resetBtn').addEventListener('click', resetGame);

  el.modalOk.addEventListener('click', closeInfo);
  el.confirmYes.addEventListener('click', () => closeAsk(true));
  el.confirmNo.addEventListener('click', () => closeAsk(false));
  el.confirm.addEventListener('click', (e) => { if (e.target === el.confirm) closeAsk(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAsk(false); });

  // تهيئة أولى
  bindNames();
  renderCounts();
  renderTeamInputs();
})();
