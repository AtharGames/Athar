/* =========================================================
   سهمك الصاعد | منطق المسابقة
   مسابقة أسئلة بنكهة سوق الأسهم: إجابة صحيحة = مكافأة + دخول السوق،
   وبعد كل دور كامل تتغيّر أسعار أسهم المدن (حظ + منطق).
   ========================================================= */
(() => {
  'use strict';

  const S = window.AtharSound;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // تخزين آمن (قد يُمنع localStorage في بعض المتصفحات)
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } }
  };

  // ---------- ثوابت ----------
  const THEMES = ['light', 'navy', 'blue'];
  const TEAM_COLORS = ['#E8554E', '#E59A1C', '#1FA971', '#8257E5', '#E0559B', '#0FA3B1'];
  const TEAM_NAMES = ['الفريق الأول', 'الفريق الثاني', 'الفريق الثالث', 'الفريق الرابع', 'الفريق الخامس', 'الفريق السادس'];
  const CITIES = ['مكة المكرمة', 'المدينة المنورة', 'الرياض', 'جدة', 'الدمام', 'الطائف', 'أبها', 'تبوك', 'حائل', 'بريدة'];
  const ANSWER_TIMES = [15, 30, 45, 60, 90];
  const TRADE_TIMES = [30, 60, 90, 120, 180];
  const ROUND_OPTIONS = [0, 5, 8, 10];           // صفر = مفتوح، والمشرف ينهيها
  const MAX_BUYS = 2, MAX_SELLS = 2;             // حد العمليات في الدور الواحد
  const SURPRISE_CHANCE = 0.25;                  // احتمال المفاجأة بعد الإجابة الصحيحة
  const MIN_PRICE = 5;
  const CFG_KEY = 'athar-sahm-cfg', SAVE_KEY = 'athar-sahm-save';
  const LETTERS = ['أ', 'ب', 'ج', 'د'];

  // ---------- أدوات ----------
  const num = (n) => Math.round(n).toLocaleString('en-US')
    .replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]).replace(/,/g, '٬');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = rint(0, i);[a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const secLabel = (s) => (s % 60 ? `${num(s)} ث` : `${num(s / 60)} د`);
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICON = {
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 8h-4.5v6h-5v-6H5z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19l-7-8h4.5V5h5v6H19z"/></svg>',
    flat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10.5h14v3H5z"/></svg>'
  };

  // ---------- الإعدادات ----------
  const cfg = Object.assign({
    count: 3, names: [], cash: 10000, price: 100,
    tAnswer: 30, tTrade: 60, mode: 'seq', rounds: 0, luck: true
  }, (() => { try { return JSON.parse(store.get(CFG_KEY)) || {}; } catch { return {}; } })());
  cfg.count = clamp(parseInt(cfg.count, 10) || 3, 2, 6);
  if (!Array.isArray(cfg.names)) cfg.names = [];
  const saveCfg = () => store.set(CFG_KEY, JSON.stringify(cfg));

  // ---------- حالة اللعب ----------
  let G = null;        // الحالة المحفوظة: الفرق، الشركات، الجولة، الدور…
  let cur = null;      // السؤال الحالي (لا يُحفظ)
  let tr = null;       // جلسة التداول الحالية (لا تُحفظ)
  let sheet = null;    // نافذة البيع/الشراء المفتوحة

  const el = {
    counts: $('#counts'), teamInputs: $('#teamInputs'),
    cashInput: $('#cashInput'), priceInput: $('#priceInput'),
    stage: $('#stage'), board: $('#board'), teams: $('#teams'), layout: $('#layout'),
    roundPill: $('#roundPill'), timer: $('#timer'), timerRing: $('#timerRing'), timerNum: $('#timerNum'),
    pauseBtn: $('#pauseBtn'), confetti: $('#confetti')
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

  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  // نافذة تأكيد داخل الصفحة
  let confirmYes = null;
  function ask({ title, text, yes }, onYes) {
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmYes').textContent = yes;
    confirmYes = onYes;
    $('#confirm').hidden = false;
    $('#confirmYes').focus();
  }
  function closeAsk(run) {
    $('#confirm').hidden = true;
    const f = confirmYes; confirmYes = null;
    if (run && f) f();
  }

  // =========================================================
  // شاشة الإعدادات
  // =========================================================
  function chipGroup(box, values, label, current, onPick) {
    box.innerHTML = '';
    values.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.type = 'button';
      b.textContent = label(v);
      b.setAttribute('aria-pressed', String(v === current()));
      b.addEventListener('click', () => {
        onPick(v); saveCfg(); S.tongue(0, 0.2);
        $$('.chip', box).forEach((c, i) => c.setAttribute('aria-pressed', String(values[i] === current())));
      });
      box.append(b);
    });
  }

  // أزرار ثابتة في الصفحة (طريقة اللعب، المفاجآت)
  function staticChips(box, current, onPick) {
    const sync = () => $$('.chip', box).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.v === current())));
    $$('.chip', box).forEach((c) => c.addEventListener('click', () => { onPick(c.dataset.v); saveCfg(); S.tongue(0, 0.2); sync(); }));
    sync();
  }

  function renderTeamInputs() {
    el.teamInputs.innerHTML = '';
    for (let i = 0; i < cfg.count; i++) {
      const row = document.createElement('div');
      row.className = 'team-row';
      row.innerHTML = '<span class="team-no"></span><input type="text" maxlength="18" autocomplete="off">';
      const no = $('.team-no', row), input = $('input', row);
      no.style.setProperty('--c', TEAM_COLORS[i]);
      no.textContent = num(i + 1);
      input.placeholder = TEAM_NAMES[i];
      input.value = cfg.names[i] || '';
      input.setAttribute('aria-label', `اسم ${TEAM_NAMES[i]}`);
      input.addEventListener('input', () => { cfg.names[i] = input.value; saveCfg(); });
      el.teamInputs.append(row);
    }
  }

  function initSetup() {
    chipGroup(el.counts, [2, 3, 4, 5, 6], num, () => cfg.count, (v) => { cfg.count = v; renderTeamInputs(); });
    renderTeamInputs();
    chipGroup($('#answerChips'), ANSWER_TIMES, secLabel, () => cfg.tAnswer, (v) => { cfg.tAnswer = v; });
    chipGroup($('#tradeChips'), TRADE_TIMES, secLabel, () => cfg.tTrade, (v) => { cfg.tTrade = v; });
    chipGroup($('#roundChips'), ROUND_OPTIONS, (v) => (v ? num(v) : 'مفتوح'), () => cfg.rounds, (v) => { cfg.rounds = v; });
    staticChips($('#modeChips'), () => cfg.mode, (v) => { cfg.mode = v; });
    staticChips($('#luckChips'), () => (cfg.luck ? '1' : '0'), (v) => { cfg.luck = v === '1'; });

    el.cashInput.value = cfg.cash; el.priceInput.value = cfg.price;
    const bindNum = (input, key, min, max) => input.addEventListener('change', () => {
      cfg[key] = clamp(parseInt(input.value, 10) || min, min, max);
      input.value = cfg[key]; saveCfg();
    });
    bindNum(el.cashInput, 'cash', 500, 50000);
    bindNum(el.priceInput, 'price', 50, 1000);
    refreshResume();
  }

  function readSave() {
    try {
      const d = JSON.parse(store.get(SAVE_KEY));
      return d && d.G && Array.isArray(d.G.teams) && Array.isArray(d.G.cos) ? d : null;
    } catch { return null; }
  }
  function refreshResume() {
    const d = readSave();
    $('#resumeCard').hidden = !d;
    if (d) $('#resumeText').textContent = `الجولة ${num(d.G.round)} · ${d.G.teams.map((t) => t.name).join('، ')}`;
  }

  // =========================================================
  // بداية المسابقة والحفظ
  // =========================================================
  function startGame() {
    // قراءة الحقول الرقمية حتى لو لم يخرج المؤشر منها
    cfg.cash = clamp(parseInt(el.cashInput.value, 10) || 10000, 500, 50000);
    cfg.price = clamp(parseInt(el.priceInput.value, 10) || 100, 50, 1000);
    saveCfg();
    G = {
      cfg: { cash: cfg.cash, price: cfg.price, tAnswer: cfg.tAnswer, tTrade: cfg.tTrade, mode: cfg.mode, rounds: cfg.rounds, luck: cfg.luck },
      teams: Array.from({ length: cfg.count }, (_, i) => ({
        name: (cfg.names[i] || '').trim() || TEAM_NAMES[i],
        color: TEAM_COLORS[i], cash: cfg.cash, shares: CITIES.map(() => 0), prev: cfg.cash
      })),
      // last: آخر حركة للسعر (نسبة موجبة أو سالبة)، ups: عدد مرات الصعود المتتالية
      cos: CITIES.map((name) => ({ name, price: cfg.price, hist: [cfg.price], last: 0, ups: 0 })),
      demand: CITIES.map(() => 0),   // صافي الأسهم المشتراة في الجولة الحالية
      round: 1, turn: 0, phase: 'turn', deck: [], market: null
    };
    S.whoosh(true); S.drop(520, 0.25);
    show('screen-game');
    beginTurn();
  }

  function save() { if (G) store.set(SAVE_KEY, JSON.stringify({ G })); }

  function resume() {
    const d = readSave();
    if (!d) return refreshResume();
    G = d.G;
    S.whoosh(true);
    show('screen-game');
    if (G.phase === 'market' && G.market) renderMarket(false);
    else beginTurn();
  }

  const wealth = (t) => t.cash + t.shares.reduce((s, q, i) => s + q * G.cos[i].price, 0);
  const isFast = () => G.cfg.mode === 'fast';

  // =========================================================
  // المؤقّت
  // =========================================================
  const T = { id: 0, left: 0, total: 0, onEnd: null, paused: false };
  function drawTimer() {
    el.timerNum.textContent = num(Math.max(0, T.left));
    el.timerRing.style.setProperty('--p', T.total ? T.left / T.total : 0);
    el.timerRing.classList.toggle('low', T.left <= 5);
  }
  function startTimer(sec, onEnd) {
    stopTimer();
    Object.assign(T, { left: sec, total: sec, onEnd, paused: false });
    el.timer.hidden = false;
    el.pauseBtn.textContent = 'إيقاف مؤقت';
    drawTimer();
    T.id = setInterval(() => {
      if (T.paused) return;
      T.left--;
      if (T.left > 0 && T.left <= 5) S.tongue(0, 0.25);
      drawTimer();
      if (T.left <= 0) { const f = T.onEnd; stopTimer(); if (f) f(); }
    }, 1000);
  }
  function stopTimer() {
    clearInterval(T.id); T.id = 0; T.onEnd = null;
    el.timer.hidden = true;
  }
  function togglePause() {
    if (!T.id) return;
    T.paused = !T.paused;
    el.pauseBtn.textContent = T.paused ? 'كمّل الوقت' : 'إيقاف مؤقت';
    el.timerRing.classList.toggle('paused', T.paused);
    S.tongue(0, 0.2);
  }

  // =========================================================
  // عناصر ثابتة: أرصدة الفرق وشاشة الأسعار
  // =========================================================
  function renderTeams(active = -1, bump = -1) {
    el.teams.style.setProperty('--n', G.teams.length);
    el.teams.innerHTML = G.teams.map((t, i) => `
      <div class="team${i === active ? ' active' : ''}${i === bump ? ' bump' : ''}" style="--c:${t.color}">
        <span class="team-name">${esc(t.name)}</span>
        <span class="team-cash"><b>${num(t.cash)}</b><small>نقدًا</small></span>
        <span class="team-wealth">الثروة ${num(wealth(t))}</span>
      </div>`).join('');
  }

  // خط صغير يبيّن مسار السعر
  function spark(hist) {
    const h = hist.slice(-8);
    if (h.length < 2) return '<svg class="spark" viewBox="0 0 60 22" aria-hidden="true"><path d="M2 11H58"/></svg>';
    const lo = Math.min(...h), hi = Math.max(...h), span = hi - lo || 1;
    const pts = h.map((v, i) => `${(2 + (i * 56) / (h.length - 1)).toFixed(1)},${(19 - ((v - lo) / span) * 16).toFixed(1)}`);
    return `<svg class="spark" viewBox="0 0 60 22" aria-hidden="true"><path d="M${pts.join('L')}"/></svg>`;
  }

  // شارة نسبة التغيّر
  function badge(pct) {
    const p = Math.round(pct * 100);
    const kind = p > 0 ? 'up' : p < 0 ? 'down' : 'flat';
    return `<span class="chg ${kind}">${ICON[kind]}${num(Math.abs(p))}٪</span>`;
  }

  function renderBoard() {
    el.board.innerHTML = `
      <h3>شاشة الأسعار</h3>
      <ul class="prices">${G.cos.map((c) => `
        <li>
          <span class="p-name">${esc(c.name)}</span>
          ${spark(c.hist)}
          <b class="p-price">${num(c.price)}</b>
          ${badge(c.last)}
        </li>`).join('')}
      </ul>`;
  }

  function setLayout(mode) {   // split: المرحلة + شاشة الأسعار، full: المرحلة فقط
    el.layout.dataset.mode = mode;
    el.board.hidden = mode === 'full';
    if (mode === 'split') renderBoard();
  }

  function renderPill() {
    const total = G.cfg.rounds ? ` من ${num(G.cfg.rounds)}` : '';
    el.roundPill.innerHTML = `الجولة <b>${num(G.round)}</b>${total}`;
  }

  // =========================================================
  // الدور والسؤال
  // =========================================================
  function beginTurn() {
    stopTimer();
    G.phase = 'turn'; G.market = null; cur = null; tr = null;
    save();
    renderPill();
    setLayout('split');
    const t = G.teams[G.turn];
    if (isFast()) {
      renderTeams();
      el.stage.innerHTML = `
        <div class="panel center">
          <p class="kicker">السؤال ${num(G.turn + 1)} من ${num(G.teams.length)} في هذه الجولة</p>
          <h2 class="big">سؤال للأسرع</h2>
          <p class="muted">أول فريق يطلب الإجابة يُحدَّد من الأزرار، والخطأ يُخرجه من هذا السؤال.</p>
          <button class="btn btn-primary btn-big" data-act="question">اعرض السؤال</button>
        </div>`;
    } else {
      renderTeams(G.turn);
      el.stage.innerHTML = `
        <div class="panel center" style="--c:${t.color}">
          <p class="kicker">الدور الآن على</p>
          <h2 class="big team-title">${esc(t.name)}</h2>
          <p class="muted">إجابة صحيحة = مكافأة مالية ودخول السوق.</p>
          <button class="btn btn-primary btn-big" data-act="question">اعرض السؤال</button>
        </div>`;
    }
  }

  // سحب سؤال بلا تكرار حتى ينتهي البنك
  function drawQuestion() {
    const bank = window.SAHM_QUESTIONS || [];
    if (!G.deck.length) G.deck = shuffle(bank.map((_, i) => i));
    const item = bank[G.deck.pop()];
    const order = shuffle([0, 1, 2, 3]);
    return { q: item.q, opts: order.map((k) => item.a[k]), correct: order.indexOf(0) };
  }

  function showQuestion(sound = true) {
    cur = Object.assign(drawQuestion(), {
      team: isFast() ? -1 : G.turn, locked: [], wrong: [], done: false, result: null
    });
    G.phase = 'question';
    if (sound) S.whoosh(true);
    renderQuestion();
    startTimer(G.cfg.tAnswer, () => finishQuestion('timeout'));
  }

  function renderQuestion() {
    const fast = isFast();
    const t = cur.team >= 0 ? G.teams[cur.team] : null;
    renderTeams(cur.team);
    const canAnswer = !cur.done && cur.team >= 0;

    const buzz = fast && !cur.done ? `
      <div class="buzz">
        <span class="muted">من جاوب أول؟</span>
        <div class="buzz-row">${G.teams.map((x, i) => `
          <button class="buzz-btn${i === cur.team ? ' on' : ''}" style="--c:${x.color}" data-act="buzz" data-i="${i}"
            ${cur.locked.includes(i) ? 'disabled' : ''}>${esc(x.name)}</button>`).join('')}
        </div>
      </div>` : '';

    const opts = cur.opts.map((o, i) => {
      let cls = 'opt';
      if (cur.done && i === cur.correct) cls += ' right';
      if (cur.wrong.includes(i)) cls += ' wrong';
      const off = !canAnswer || cur.wrong.includes(i);
      return `<button class="${cls}" data-act="answer" data-i="${i}" ${off ? 'disabled' : ''}>
        <span class="opt-l">${LETTERS[i]}</span><span class="opt-t">${esc(o)}</span></button>`;
    }).join('');

    const tools = cur.done ? '' : `
      <div class="q-tools"><button class="btn btn-ghost btn-sm" data-act="skip">بدّل السؤال</button></div>`;

    el.stage.innerHTML = `
      <div class="panel question" style="--c:${t ? t.color : 'var(--accent)'}">
        <p class="kicker">${t ? `سؤال ${esc(t.name)}` : 'سؤال للأسرع'}</p>
        <h2 class="q-text">${esc(cur.q)}</h2>
        ${buzz}
        <div class="opts">${opts}</div>
        ${cur.done ? resultHTML() : tools}
      </div>`;
  }

  function buzz(i) {
    if (!cur || cur.done || cur.locked.includes(i)) return;
    cur.team = i;
    S.drop(560, 0, 0.22);
    renderQuestion();
  }

  function answer(i) {
    if (!cur || cur.done || cur.team < 0 || cur.wrong.includes(i)) return;
    if (i === cur.correct) return finishQuestion('correct');
    // إجابة خاطئة
    cur.wrong.push(i);
    if (!isFast()) return finishQuestion('wrong');
    cur.locked.push(cur.team);
    S.sigh();
    if (cur.locked.length >= G.teams.length) return finishQuestion('allwrong');
    cur.team = -1;
    renderQuestion();
  }

  // =========================================================
  // نتيجة السؤال: المكافأة والمفاجآت
  // =========================================================
  function finishQuestion(kind) {
    if (!cur || cur.done) return;
    stopTimer();
    cur.done = true;
    cur.result = { kind };
    if (kind === 'correct') {
      const t = G.teams[cur.team];
      // المكافأة مرتبطة برصيد الفريق النقدي (١٫٢٥٪ إلى ٥٪)، وبحد أدنى ١٪ من الرصيد الابتدائي
      const reward = Math.max(round5(t.cash * rnd(0.0125, 0.05)), round5(G.cfg.cash * 0.01));
      t.cash += reward;
      cur.result.reward = reward;
      cur.result.surprise = G.cfg.luck && Math.random() < SURPRISE_CHANCE ? rollSurprise(cur.team) : null;
      S.chirp(0, 3000); S.drop(620, 0.3);
      if (cur.result.surprise) S.gust(0.6);
    } else {
      S.sigh();
    }
    renderQuestion();
    renderBoard();
    if (kind === 'correct') renderTeams(cur.team, cur.team);
  }

  // المفاجآت الخمس كما في المسابقة الأصلية
  function rollSurprise(ti) {
    const t = G.teams[ti];
    const type = ['glitch', 'drop', 'rise', 'cash', 'shares'][rint(0, 4)];
    const ci = rint(0, G.cos.length - 1), c = G.cos[ci];
    if (type === 'glitch') {
      return { type, tone: 'bad', title: 'خلل في النظام!', text: 'تعطّل نظام التداول، ولا بيع ولا شراء لهذا الفريق في هذا الدور.' };
    }
    if (type === 'drop' || type === 'rise') {
      const old = c.price;
      const f = type === 'drop' ? rnd(0.4, 0.8) : rnd(1.4, 1.8);
      movePrice(c, Math.max(MIN_PRICE, Math.round(old * f)));
      return type === 'drop'
        ? { type, tone: 'bad', title: 'هبوط مفاجئ!', text: `تلاعب في السوق نزّل سهم ${c.name} من ${num(old)} إلى ${num(c.price)}.` }
        : { type, tone: 'ok', title: 'صعود مفاجئ!', text: `صفقة تجارية رفعت سهم ${c.name} من ${num(old)} إلى ${num(c.price)}.` };
    }
    // المنح موزونة على الرصيد الابتدائي (١٠٪ إلى ٦٠٪)
    const value = G.cfg.cash * rnd(0.1, 0.6);
    if (type === 'cash') {
      const gift = round5(value);
      t.cash += gift;
      return { type, tone: 'ok', title: 'منحة مالية!', text: `خطأ في النظام أضاف ${num(gift)} إلى رصيد ${t.name}.` };
    }
    const qty = Math.max(1, Math.round(value / c.price));
    t.shares[ci] += qty;
    return { type, tone: 'ok', title: 'منحة أسهم!', text: `خطأ في النظام منح ${t.name} ${num(qty)} سهمًا في ${c.name}.` };
  }

  // تسجيل حركة سعر (تُستخدم في المفاجآت وفي تحديث السوق)
  function movePrice(c, price) {
    const old = c.price;
    c.price = Math.max(MIN_PRICE, Math.round(price));
    c.last = (c.price - old) / old;
    c.ups = c.last > 0 ? c.ups + 1 : 0;
    c.hist.push(c.price);
    if (c.hist.length > 24) c.hist.shift();
  }

  function resultHTML() {
    const r = cur.result;
    if (r.kind === 'correct') {
      const t = G.teams[cur.team];
      const s = r.surprise;
      const glitch = s && s.type === 'glitch';
      return `
        <div class="result ok">
          <strong>إجابة صحيحة!</strong>
          <span>مكافأة ${esc(t.name)}: <b dir="ltr">+${num(r.reward)}</b></span>
        </div>
        ${s ? `<div class="surprise ${s.tone}"><strong>${esc(s.title)}</strong><span>${esc(s.text)}</span></div>` : ''}
        <button class="btn btn-primary btn-big" data-act="${glitch ? 'next' : 'trade'}">${glitch ? 'التالي' : 'افتح السوق للفريق'}</button>`;
    }
    const msg = r.kind === 'timeout' ? 'انتهى الوقت!' : r.kind === 'allwrong' ? 'كل الفرق أخطأت!' : 'إجابة خاطئة!';
    const sub = isFast() ? 'لا أحد يدخل السوق في هذا السؤال.' : 'ضاعت فرصة الفريق في هذه الجولة.';
    return `
      <div class="result bad"><strong>${msg}</strong><span>${sub}</span></div>
      <button class="btn btn-primary btn-big" data-act="next">التالي</button>`;
  }

  // =========================================================
  // التداول: بيع وشراء
  // =========================================================
  function openTrade() {
    if (!cur || cur.team < 0) return;
    tr = { team: cur.team, buys: MAX_BUYS, sells: MAX_SELLS };
    G.phase = 'trade';
    setLayout('full');
    S.whoosh(true);
    renderTrade();
    startTimer(G.cfg.tTrade, closeTrade);
  }

  function renderTrade() {
    const t = G.teams[tr.team];
    renderTeams(tr.team);
    const rows = G.cos.map((c, i) => {
      const own = t.shares[i];
      const canBuy = tr.buys > 0 && t.cash >= c.price;
      const canSell = tr.sells > 0 && own > 0;
      return `
        <li class="t-row${own ? ' owned' : ''}">
          <span class="t-name">${esc(c.name)}</span>
          <span class="t-price"><b>${num(c.price)}</b>${badge(c.last)}</span>
          <span class="t-own">${own ? `تملك <b>${num(own)}</b>` : '<i>لا تملك</i>'}</span>
          <span class="t-acts">
            <button class="btn btn-buy btn-sm" data-act="buy" data-i="${i}" ${canBuy ? '' : 'disabled'}>شراء</button>
            <button class="btn btn-sell btn-sm" data-act="sell" data-i="${i}" ${canSell ? '' : 'disabled'}>بيع</button>
          </span>
        </li>`;
    }).join('');
    el.stage.innerHTML = `
      <div class="panel trade" style="--c:${t.color}">
        <div class="trade-head">
          <div>
            <p class="kicker">السوق مفتوح لـ</p>
            <h2 class="team-title">${esc(t.name)}</h2>
          </div>
          <div class="trade-stats">
            <span>الرصيد النقدي <b>${num(t.cash)}</b></span>
            <span>باقي الشراء <b>${num(tr.buys)}</b></span>
            <span>باقي البيع <b>${num(tr.sells)}</b></span>
          </div>
        </div>
        <ul class="t-list">${rows}</ul>
        <button class="btn btn-primary btn-big" data-act="closeTrade">أنهينا التداول</button>
      </div>`;
  }

  function openSheet(kind, i) {
    if (!tr) return;
    const t = G.teams[tr.team], c = G.cos[i];
    const max = kind === 'buy' ? Math.floor(t.cash / c.price) : t.shares[i];
    if (max < 1 || (kind === 'buy' ? tr.buys : tr.sells) < 1) return;
    sheet = { kind, i, max };
    $('#sheetTitle').textContent = `${kind === 'buy' ? 'شراء أسهم' : 'بيع أسهم'} ${c.name}`;
    $('#sheetInfo').textContent = kind === 'buy'
      ? `سعر السهم ${num(c.price)} · تقدر تشتري حتى ${num(max)} سهمًا`
      : `سعر السهم ${num(c.price)} · تملك ${num(max)} سهمًا`;
    $('#sheetOk').textContent = kind === 'buy' ? 'تأكيد الشراء' : 'تأكيد البيع';
    const quick = [...new Set([Math.max(1, Math.round(max / 4)), Math.max(1, Math.round(max / 2)), max])];
    $('#qtyQuick').innerHTML = quick.map((q) => `<button class="chip" data-q="${q}">${q === max ? `الكل (${num(q)})` : num(q)}</button>`).join('');
    const input = $('#qtyInput');
    input.max = max; input.value = Math.min(max, quick[0]);
    $('#sheet').hidden = false;
    S.tongue(0, 0.2);
    updateSheet();
    input.focus(); input.select();
  }

  function sheetQty() { return clamp(parseInt($('#qtyInput').value, 10) || 0, 0, sheet.max); }
  function setSheetQty(q) { $('#qtyInput').value = clamp(q, 1, sheet.max); updateSheet(); }
  function updateSheet() {
    if (!sheet) return;
    const q = sheetQty(), c = G.cos[sheet.i];
    $('#sheetTotal').innerHTML = q
      ? `${sheet.kind === 'buy' ? 'التكلفة' : 'يدخل رصيدك'}: <b>${num(q * c.price)}</b>`
      : 'اكتب عدد الأسهم';
    $('#sheetOk').disabled = q < 1;
  }
  function closeSheet() { $('#sheet').hidden = true; sheet = null; }

  function confirmSheet() {
    if (!sheet || !tr) return;
    const q = sheetQty();
    if (q < 1) return;
    const t = G.teams[tr.team], c = G.cos[sheet.i];
    if (sheet.kind === 'buy') {
      t.cash -= q * c.price; t.shares[sheet.i] += q; G.demand[sheet.i] += q; tr.buys--;
      S.drop(520); S.drop(700, 0.12);
    } else {
      t.cash += q * c.price; t.shares[sheet.i] -= q; G.demand[sheet.i] -= q; tr.sells--;
      S.drop(520); S.drop(380, 0.12);
    }
    closeSheet();
    renderTrade();
  }

  function closeTrade() {
    if (!tr) return;
    closeSheet();
    stopTimer();
    tr = null;
    S.whoosh(false);
    advance();
  }

  // الانتقال للدور التالي أو لشاشة السوق بعد اكتمال الدور
  function advance() {
    stopTimer();
    cur = null; tr = null;
    G.turn++;
    if (G.turn >= G.teams.length) endRound();
    else beginTurn();
  }

  // =========================================================
  // تحديث السوق بعد كل جولة: حظ + منطق
  // =========================================================
  function computeChange(c, netShares) {
    // ١) الطلب: كثرة الشراء ترفع، وكثرة البيع تنزّل (بحد أقصى ١٢٪)
    const pool = G.cfg.cash * G.teams.length;
    const demand = clamp(((netShares * c.price) / pool) * 0.5, -0.12, 0.12);
    let pct;
    if (c.last < 0) {
      // ٢) المنطق: السهم الذي نزل يرتفع في الجولة التالية، وكل ما كان النزول أكبر كان الارتداد أقوى
      pct = Math.max(0.03, rnd(0.05, 0.2) + Math.min(0.1, Math.abs(c.last) * 0.4) + demand);
    } else {
      // ٣) الحظ: حركة عشوائية، والسهم الذي صعد مرتين متتاليتين يغلب عليه التصحيح
      const luck = c.ups >= 2 && Math.random() < 0.7 ? -rnd(0.06, 0.2) : rnd(-0.18, 0.18);
      pct = luck + demand;
      if (Math.abs(pct) < 0.02) pct = pct < 0 ? -0.03 : 0.03;
    }
    return pct;
  }

  function endRound() {
    const rows = G.cos.map((c, i) => {
      const old = c.price;
      movePrice(c, old * (1 + computeChange(c, G.demand[i])));
      return { old, price: c.price, pct: c.last };
    });
    G.demand = CITIES.map(() => 0);
    G.turn = 0;
    G.phase = 'market';
    G.market = {
      rows,
      ranks: G.teams.map((t, i) => { const w = wealth(t); const d = w - t.prev; t.prev = w; return { i, w, d }; })
        .sort((a, b) => b.w - a.w)
    };
    save();
    renderMarket(true);
  }

  function renderMarket(animate) {
    stopTimer();
    renderPill();
    renderTeams();
    setLayout('full');
    const m = G.market;
    const last = G.cfg.rounds && G.round >= G.cfg.rounds;
    const ups = m.rows.filter((r) => r.pct > 0).length;
    el.stage.innerHTML = `
      <div class="panel market${animate ? ' anim' : ''}">
        <div class="market-head">
          <div>
            <p class="kicker">نهاية الجولة ${num(G.round)}</p>
            <h2>شاشة السوق</h2>
          </div>
          <p class="market-sum"><span class="chg up">${ICON.up}${num(ups)} صاعدة</span><span class="chg down">${ICON.down}${num(m.rows.length - ups)} هابطة</span></p>
        </div>
        <ul class="m-list">${m.rows.map((r, i) => `
          <li class="m-row ${r.pct > 0 ? 'up' : 'down'}" style="--d:${i * 0.22}s">
            <span class="m-name">${esc(G.cos[i].name)}</span>
            <span class="m-old">${num(r.old)}</span>
            <span class="m-arrow" aria-hidden="true">←</span>
            <b class="m-new">${num(r.price)}</b>
            ${badge(r.pct)}
          </li>`).join('')}
        </ul>
        <h3 class="rank-title">ترتيب الفرق بالثروة (النقد + قيمة الأسهم)</h3>
        <ol class="ranks">${m.ranks.map((r, k) => {
          const t = G.teams[r.i];
          const d = Math.round(r.d);
          return `<li class="rank" style="--c:${t.color}; --d:${m.rows.length * 0.22 + k * 0.12}s">
            <span class="rank-no">${num(k + 1)}</span>
            <span class="rank-name">${esc(t.name)}</span>
            <span class="rank-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : d < 0 ? '−' : ''}${num(Math.abs(d))}</span>
            <b class="rank-w">${num(r.w)}</b>
          </li>`;
        }).join('')}
        </ol>
        <button class="btn btn-primary btn-big" data-act="${last ? 'finish' : 'nextRound'}">${last ? 'أعلن النتيجة النهائية' : 'الجولة التالية'}</button>
      </div>`;
    if (animate && !reducedMotion()) {
      // صوت لكل سهم مع ظهوره: قطرة عالية للصاعد ومنخفضة للهابط
      m.rows.forEach((r, i) => S.drop(r.pct > 0 ? 640 : 300, i * 0.22, 0.2));
    }
  }

  function nextRound() {
    G.round++;
    S.whoosh(true);
    beginTurn();
  }

  // =========================================================
  // النهاية: بيع كل الأسهم بسعر السوق وإعلان الفائز
  // =========================================================
  let confettiRaf = 0;

  function finish() {
    stopTimer(); closeSheet();
    G.teams.forEach((t) => {
      t.sold = t.shares.reduce((s, q, i) => s + q * G.cos[i].price, 0);
      t.cash += t.sold;
      t.shares = t.shares.map(() => 0);
    });
    const sorted = [...G.teams].sort((a, b) => b.cash - a.cash);
    const top = sorted[0].cash;
    const winners = sorted.filter((t) => t.cash === top);
    const start = G.cfg.cash;
    store.del(SAVE_KEY);

    $('.trophy').style.setProperty('--win', winners[0].color);
    $('#winnerName').style.setProperty('--win', winners[0].color);
    if (winners.length > 1) {
      $('#victoryKicker').textContent = 'تعادل في القمة!';
      $('#winnerName').textContent = winners.map((t) => t.name).join(' و');
      $('#winnerText').textContent = `تساووا في المركز الأول بمبلغ ${num(top)} بعد بيع كل الأسهم بسعر السوق.`;
    } else {
      $('#victoryKicker').textContent = 'أغلق السوق… والسهم الصاعد هو';
      $('#winnerName').textContent = winners[0].name;
      $('#winnerText').textContent = `بيعت كل الأسهم بسعر السوق، وأنهى (${winners[0].name}) المسابقة بمبلغ ${num(top)}.`;
    }

    const board = $('#finalBoard');
    board.innerHTML = '';
    sorted.forEach((t, i) => {
      const r = document.createElement('div');
      r.className = 'final-row' + (t.cash === top ? ' win' : '');
      r.style.setProperty('--c', t.color);
      r.style.animationDelay = `${0.15 * i + 0.4}s`;
      const gain = Math.round(((t.cash - start) / start) * 100);
      r.innerHTML = `<span class="final-rank">${num(i + 1)}</span><span class="final-name">${esc(t.name)}</span>
        <span class="final-pts"><span>${num(t.cash)}</span><small>${gain >= 0 ? 'ربح' : 'خسارة'} ${num(Math.abs(gain))}٪ عن البداية</small></span>`;
      board.append(r);
    });

    G = null; cur = null; tr = null;
    show('screen-victory');
    S.winner();
    confetti(winners.map((t) => t.color));
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

  function backToSetup() {
    cancelAnimationFrame(confettiRaf);
    S.tongue(0, 0.2);
    refreshResume();
    show('screen-setup');
  }

  // =========================================================
  // ربط الأحداث
  // =========================================================
  $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); S.tongue(0, 0.2); }));
  setTheme(document.documentElement.dataset.theme);

  const soundBtn = $('#soundBtn');
  soundBtn.setAttribute('aria-pressed', String(S.on));
  soundBtn.addEventListener('click', () => soundBtn.setAttribute('aria-pressed', String(S.toggle())));

  $('#startBtn').addEventListener('click', () => {
    if (readSave()) {
      ask({ title: 'نبدأ مسابقة جديدة؟', text: 'فيه مسابقة محفوظة ما اكتملت، وبدء مسابقة جديدة يحذفها.', yes: 'ابدأ من جديد' }, startGame);
    } else startGame();
  });
  $('#resumeBtn').addEventListener('click', resume);
  $('#discardBtn').addEventListener('click', () => ask(
    { title: 'نحذف المسابقة المحفوظة؟', text: 'ما تقدر ترجع لها بعد الحذف.', yes: 'احذفها' },
    () => { store.del(SAVE_KEY); refreshResume(); }
  ));
  $('#resetBtn').addEventListener('click', backToSetup);
  el.pauseBtn.addEventListener('click', togglePause);

  $('#endBtn').addEventListener('click', () => ask(
    { title: 'ننهي المسابقة الآن؟', text: 'تُباع كل الأسهم بسعر السوق الحالي ويُعلن الفائز.', yes: 'أنهِ وأعلن الفائز' },
    finish
  ));
  $('#confirmYes').addEventListener('click', () => closeAsk(true));
  $('#confirmNo').addEventListener('click', () => closeAsk(false));
  $('#confirm').addEventListener('click', (e) => { if (e.target.id === 'confirm') closeAsk(false); });

  // أزرار منطقة اللعب (تُرسم ديناميكيًا)
  el.stage.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || !G) return;
    const i = parseInt(b.dataset.i, 10);
    switch (b.dataset.act) {
      case 'question': showQuestion(); break;
      case 'skip': stopTimer(); showQuestion(false); S.tongue(0, 0.2); break;
      case 'buzz': buzz(i); break;
      case 'answer': answer(i); break;
      case 'trade': openTrade(); break;
      case 'next': S.tongue(0, 0.2); advance(); break;
      case 'buy': openSheet('buy', i); break;
      case 'sell': openSheet('sell', i); break;
      case 'closeTrade': closeTrade(); break;
      case 'nextRound': nextRound(); break;
      case 'finish': finish(); break;
      default: break;
    }
  });

  // نافذة الكمية
  $('#qtyInput').addEventListener('input', updateSheet);
  $('#qtyMinus').addEventListener('click', () => setSheetQty(sheetQty() - 1));
  $('#qtyPlus').addEventListener('click', () => setSheetQty(sheetQty() + 1));
  $('#qtyQuick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (b) { setSheetQty(parseInt(b.dataset.q, 10)); S.tongue(0, 0.2); }
  });
  $('#sheetOk').addEventListener('click', confirmSheet);
  $('#sheetCancel').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#sheet').hidden) closeSheet();
      else if (!$('#confirm').hidden) closeAsk(false);
    } else if (e.key === 'Enter' && !$('#sheet').hidden && document.activeElement === $('#qtyInput')) {
      confirmSheet();
    }
  });

  initSetup();
})();
