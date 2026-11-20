/* =========================================================
   معارك | منطق اللعبة
   خريطة ٢٠ إقليمًا، عواصم وخزائن، سوق بأسعار أسبوعية،
   شحن بالأسئلة، ومعارك تُحسم بالإجابات. يُحفظ كل شيء تلقائيًا.
   ========================================================= */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.AtharSound;
  const MAP = window.MAAREK_MAP;
  // الأسئلة من بنك ديوان (../diwan/data.js): [الديوان، القسم، المستوى، النص، الخيارات، رقم الإجابة، العزو، الرقم]
  const DW = window.DIWAN_DATA || { diwans: [], questions: [] };
  const QB = {
    cats: DW.diwans.map((d, i) => ({ id: d.id, name: d.title, q: DW.questions.filter((x) => x[0] === i && Array.isArray(x[4]) && x[4].length >= 2) }))
  };
  const LEVELS = ['سهل', 'متوسط', 'صعب'];
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- أرقام عربية ----------
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const num = (n) => ar(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬');
  // عزل الأرقام ذات الإشارة حتى لا تنقلب داخل النص العربي
  const iso = (s) => '⁦' + s + '⁩';
  const signed = (n) => iso((n > 0 ? '+' : n < 0 ? '−' : '') + num(Math.abs(n)));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- القواعد ----------
  const COLORS = ['#E8554E', '#E59A1C', '#1FA971', '#8257E5', '#E0559B', '#0FA3B1'];
  const NAMES = ['الصقور', 'الفرسان', 'النخيل', 'البرق', 'الشهب', 'الموج'];
  const R = {
    startMoney: 300, startBat: 30,          // البداية
    perRegion: 10, capitalBonus: 50,         // الدخل الأسبوعي
    chargeReward: 40,                        // مكسب كل إجابة صحيحة في الشحن
    rounds: 4, hitRatio: 0.3,                // المعركة
    cannon: 4, wallScore: 20,                // قيمة المدفع والسور
    minAttack: 4, blockRatio: 3              // شروط الهجوم
  };
  const BASE = { bat: 10, can: 36, wall: 130 };
  const ITEMS = {
    bat: { name: 'كتائب', one: 'كتيبة', icon: 'i-helmet', hint: 'قوة ضاربة ١' },
    can: { name: 'مدافع', one: 'مدفع', icon: 'i-cannon', hint: 'قوة ضاربة ٤' },
    wall: { name: 'أسوار', one: 'سور', icon: 'i-wall', hint: 'نصف الضرر على المدافع' }
  };
  const KEY_SAVE = 'maarek-save', KEY_USED = 'maarek-used-diwan', KEY_PREF = 'maarek-prefs';
  const TIPS = [
    'المال وحده لا يكفي لتكون قويًا.',
    'أسعار السوق تتغيّر من أسبوع لأسبوع… راقبها قبل ما تشتري.',
    'تحالف مؤقت مع جارك قد يضمن لك الفوز في النهاية.',
    'مدفع واحد أقوى من أربع كتائب.',
    'السور على العاصمة نصف النصر.',
    'الأمان ما يدوم… حصّن حدودك.',
    'الهجوم خير وسيلة للدفاع.',
    'لا تحزن على إقليم خسرته… بعضهم يتركه طُعمًا لك.',
    'لا تدخل معركة مهاجمًا إلا وأنت ضامن الغلبة.',
    'فرّق تسد… وزّع كتائبك بحكمة.',
    'إذا كانت الحملة بوقت محدد فاجعل نصيبك من الأقاليم الأكبر.',
    'جاوب صح في الشحن… الخزينة تحب العلم.'
  ];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } }
  };

  // =========================================================
  // المؤثرات: مقاطع مولّدة (sounds/make.py) + أصوات أثَر المشتركة
  // =========================================================
  const SFX = (() => {
    const base = new URL('sounds/', document.currentScript ? document.currentScript.src : location.href);
    const cache = {};
    ['hooves', 'clash', 'applause', 'coins', 'whistle', 'flag'].forEach((n) => {
      const a = new Audio(new URL(n + '.mp3', base).href); a.preload = 'auto'; cache[n] = a;
    });
    function play(n, vol = 0.8, delay = 0) {
      if (!S.on || !cache[n]) return;
      const go = () => { try { const a = cache[n].cloneNode(); a.volume = vol; a.play().catch(() => {}); } catch { /* تجاهل */ } };
      delay ? setTimeout(go, delay * 1000) : go();
    }
    return {
      play,
      move: () => play('hooves', 0.7),
      hit: () => play('clash', 0.75),
      conquer: () => { play('flag', 0.85); play('applause', 0.6, 0.45); },
      coins: () => play('coins', 0.6),
      alarm: () => play('whistle', 0.55),
      right: () => { S.chirp(0, 3200); S.drop(620, 0.05); },
      wrong: () => S.sigh(),
      tick: () => S.tongue(0, 0.18),
      click: () => S.tongue(0, 0.22),
      turn: () => S.whoosh(true),
      win: () => S.winner()
    };
  })();

  // =========================================================
  // الحالة
  // =========================================================
  let G = null;                 // الحملة الحالية
  const UI = { sel: null, mode: null, src: null, pending: new Set() };
  const reg = (id) => G.regions[id - 1];
  const NB = (id) => MAP.regions[id - 1].nb;
  const team = (i = G.turn) => G.teams[i];
  const regionsOf = (t) => G.regions.filter((r) => r.owner === t);
  const power = (u) => u.bat + R.cannon * u.can;
  const save = () => { if (G) store.set(KEY_SAVE, G); };

  // =========================================================
  // بنك الأسئلة (بلا تكرار، ويُحفظ المستخدم بين الجلسات)
  // =========================================================
  const Qs = (() => {
    let used = store.get(KEY_USED, {});
    // الأسئلة المتاحة في قسم حسب المستويات المختارة
    const eligible = (c, lv) => c.q.map((x, i) => (lv.includes(x[2]) ? i : -1)).filter((i) => i >= 0);
    function next(cats, lv) {
      if (!lv || !lv.length) lv = [0, 1, 2];
      let list = QB.cats.filter((c) => cats.includes(c.id)).map((c) => ({ c, idx: eligible(c, lv) })).filter((x) => x.idx.length);
      if (!list.length) list = QB.cats.map((c) => ({ c, idx: eligible(c, [0, 1, 2]) })).filter((x) => x.idx.length);
      // اختيار الديوان بحسب عدد أسئلته
      const total = list.reduce((s, x) => s + x.idx.length, 0);
      let r = Math.random() * total, sel = list[0];
      for (const x of list) { if ((r -= x.idx.length) <= 0) { sel = x; break; } }
      const { c: cat, idx } = sel;
      let u = new Set(used[cat.id] || []);
      let free = idx.filter((i) => !u.has(i));
      if (!free.length) { idx.forEach((i) => u.delete(i)); free = idx.slice(); }
      const i = pick(free);
      u.add(i); used[cat.id] = [...u]; store.set(KEY_USED, used);
      const [, , level, q, opts, right, cite] = cat.q[i];
      const order = shuffle(opts.map((_, k) => k));
      return { cat: cat.name + ' · ' + LEVELS[level], q, opts: order.map((k) => opts[k]), right: order.indexOf(right), cite };
    }
    return { next };
  })();

  // عرض سؤال بخيارات ومؤقت. يرجّع دالة تنظيف.
  function askQuestion(box, { teamIdx, label, onAnswer }) {
    const Q = Qs.next(G.settings.cats, G.settings.levels);
    const t = team(teamIdx);
    const secs = G.settings.timer;
    box.innerHTML = `
      <div class="q-head">
        <span class="q-who" style="--c:${t.color}"><i></i>${esc(label || 'سؤال لفريق ' + t.name)}</span>
        <span class="q-cat">${esc(Q.cat)}</span>
        ${secs ? `<span class="timer" style="--p:1"><span>${ar(secs)}</span></span>` : ''}
      </div>
      <p class="q-text">${esc(Q.q)}</p>
      <div class="opts">${Q.opts.map((o, k) => `<button class="opt" data-k="${k}"><b>${'أبجد'[k]}</b><span>${esc(o)}</span></button>`).join('')}</div>
      <p class="q-res" aria-live="polite"></p>${Q.cite ? `<small class="q-cite">ديوان: ${esc(Q.cite)}</small>` : ''}`;
    let done = false, timer = 0;
    const end = Date.now() + secs * 1000;
    let lastSec = secs;
    const finish = (k) => {
      if (done) return; done = true; clearInterval(timer);
      const ok = k === Q.right;
      $$('.opt', box).forEach((b, j) => {
        b.disabled = true;
        if (j === Q.right) b.classList.add('right');
        else if (j === k) b.classList.add('wrong');
        else b.classList.add('fade');
      });
      ok ? SFX.right() : SFX.wrong();
      onAnswer(ok, k === -1, Q);
    };
    $$('.opt', box).forEach((b) => b.addEventListener('click', () => finish(+b.dataset.k)));
    if (secs) {
      const tm = $('.timer', box);
      timer = setInterval(() => {
        const left = Math.max(0, (end - Date.now()) / 1000);
        tm.style.setProperty('--p', String(left / secs));
        const s = Math.ceil(left);
        if (s !== lastSec) { lastSec = s; tm.firstElementChild.textContent = ar(s); if (s <= 5 && s > 0) { tm.classList.add('low'); SFX.tick(); } }
        if (left <= 0) finish(-1);
      }, 100);
    }
    return () => { done = true; clearInterval(timer); };
  }

  // =========================================================
  // الهيكل العام: الثيمات، الصوت، الشاشات، التنبيه، التأكيد، القصاصات
  // =========================================================
  const THEMES = ['light', 'navy', 'blue', 'parch', 'camp'];
  function setTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('athar-theme', t); } catch { /* تجاهل */ }
    $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  }
  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }
  let toastTimer = 0;
  function toast(msg, kind = '') {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false; t.dataset.kind = kind;
    t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
  }
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }
  function confirmBox(title, text, yes = 'نعم', no = 'لا') {
    return new Promise((res) => {
      $('#confirmTitle').textContent = title; $('#confirmText').textContent = text;
      $('#confirmYes').textContent = yes; $('#confirmNo').textContent = no;
      openModal('confirmModal');
      const done = (v) => { closeModal('confirmModal'); $('#confirmYes').onclick = $('#confirmNo').onclick = null; res(v); };
      $('#confirmYes').onclick = () => done(true);
      $('#confirmNo').onclick = () => done(false);
    });
  }
  function confetti(colors) {
    const canvas = $('#confetti');
    if (reduced) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = colors.concat(['#F2B705', '#FFFFFF', '#5CC2F5']);
    const ps = Array.from({ length: 160 }, () => {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 10;
      return { x: W / 2, y: H * 0.35, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 7, w: 6 + Math.random() * 7, h: 4 + Math.random() * 5,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: pick(cols) };
    });
    let f = 0;
    (function frame() {
      c.clearRect(0, 0, W, H);
      ps.forEach((p) => {
        p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
      });
      if (++f < 220) requestAnimationFrame(frame); else c.clearRect(0, 0, W, H);
    })();
  }
  function bump(el) { if (!el) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

  // =========================================================
  // الإعدادات
  // =========================================================
  const prefs = Object.assign({ count: 4, names: NAMES.slice(), colors: COLORS.slice(), weeks: 12, timer: 25, charge: 3, capitals: 'pick', cats: QB.cats.map((c) => c.id), levels: [0, 1, 2] }, store.get(KEY_PREF, {}));
  // ترحيل الإعدادات القديمة (أقسام اللعبة الأصلية) إلى دواوين ديوان
  prefs.cats = (prefs.cats || []).filter((id) => QB.cats.some((c) => c.id === id));
  if (!prefs.cats.length) prefs.cats = QB.cats.map((c) => c.id);
  prefs.levels = (Array.isArray(prefs.levels) ? prefs.levels : []).filter((l) => [0, 1, 2].includes(l));
  if (!prefs.levels.length) prefs.levels = [0, 1, 2];

  function segInit(id, key, cast = Number) {
    const el = $('#' + id);
    const sync = () => $$('button', el).forEach((b) => b.setAttribute('aria-pressed', String(cast(b.dataset.v) === prefs[key])));
    $$('button', el).forEach((b) => b.addEventListener('click', () => { prefs[key] = cast(b.dataset.v); sync(); SFX.click(); store.set(KEY_PREF, prefs); }));
    sync();
  }
  function flagSVG(color) {
    return `<svg viewBox="0 0 30 34" aria-hidden="true"><path d="M3 2v31" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M4 3c6-3 10 3 16 0s9-1 9-1v14s-3-2-9 1-10-3-16 0z" fill="${color}"/></svg>`;
  }
  function renderSetup() {
    const tc = $('#teamCount');
    tc.innerHTML = [2, 3, 4, 5, 6].map((n) => `<button data-n="${n}" aria-pressed="${n === prefs.count}">${ar(n)} فرق</button>`).join('');
    $$('button', tc).forEach((b) => b.addEventListener('click', () => { prefs.count = +b.dataset.n; store.set(KEY_PREF, prefs); SFX.click(); renderSetup(); }));
    const list = $('#teamList');
    list.innerHTML = Array.from({ length: prefs.count }, (_, i) => `
      <li class="team-row">
        <button class="swatch" data-i="${i}" aria-label="تغيير لون الفريق ${ar(i + 1)}">${flagSVG(prefs.colors[i])}</button>
        <input value="${esc(prefs.names[i] || NAMES[i])}" maxlength="16" data-i="${i}" aria-label="اسم الفريق ${ar(i + 1)}">
      </li>`).join('');
    $$('input', list).forEach((inp) => inp.addEventListener('input', () => { prefs.names[+inp.dataset.i] = inp.value; store.set(KEY_PREF, prefs); }));
    // تبديل اللون بين الألوان غير المستخدمة
    $$('.swatch', list).forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      const taken = prefs.colors.slice(0, prefs.count).filter((_, j) => j !== i);
      let k = COLORS.indexOf(prefs.colors[i]);
      do { k = (k + 1) % COLORS.length; } while (taken.includes(COLORS[k]));
      prefs.colors[i] = COLORS[k]; store.set(KEY_PREF, prefs); SFX.click(); renderSetup();
    }));
    const chips = $('#catChips');
    chips.innerHTML = QB.cats.map((c) => `<button class="chip" data-c="${c.id}" aria-pressed="${prefs.cats.includes(c.id)}">${esc(c.name)} <small>${ar(c.q.length)}</small></button>`).join('');
    $$('.chip', chips).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.c;
      if (prefs.cats.includes(id)) { if (prefs.cats.length === 1) { toast('لازم قسم واحد على الأقل'); return; } prefs.cats = prefs.cats.filter((x) => x !== id); }
      else prefs.cats.push(id);
      store.set(KEY_PREF, prefs); SFX.click(); renderSetup();
    }));
    const lv = $('#lvChips');
    lv.innerHTML = LEVELS.map((l, i) => `<button class="chip" data-l="${i}" aria-pressed="${prefs.levels.includes(i)}">${l}</button>`).join('');
    $$('.chip', lv).forEach((b) => b.addEventListener('click', () => {
      const l = +b.dataset.l;
      if (prefs.levels.includes(l)) { if (prefs.levels.length === 1) { toast('لازم مستوى واحد على الأقل'); return; } prefs.levels = prefs.levels.filter((x) => x !== l); }
      else prefs.levels.push(l);
      store.set(KEY_PREF, prefs); SFX.click(); renderSetup();
    }));
    const n = QB.cats.filter((c) => prefs.cats.includes(c.id)).reduce((s, c) => s + c.q.filter((x) => prefs.levels.includes(x[2])).length, 0);
    $('#catNote').textContent = QB.cats.length ? `${num(n)} سؤالًا من بنك ديوان في الدواوين والمستويات المختارة. الأسئلة ما تتكرر حتى تخلص.` : 'تعذّر تحميل بنك ديوان.';
  }

  // =========================================================
  // بدء الحملة
  // =========================================================
  function newGame() {
    const teams = Array.from({ length: prefs.count }, (_, i) => ({
      name: (prefs.names[i] || '').trim() || NAMES[i], color: prefs.colors[i],
      money: R.startMoney, capital: null, alive: true, needCap: false
    }));
    G = {
      v: 1, teams,
      regions: MAP.regions.map((r) => ({ id: r.id, name: r.name, owner: null, bat: 0, can: 0, wall: false, oldCap: false })),
      turn: 0, week: 1, phase: 'capitals', battle: null,
      settings: { weeks: prefs.weeks, timer: prefs.timer, charge: prefs.charge, cats: prefs.cats.slice(), levels: prefs.levels.slice(), capitals: prefs.capitals },
      prices: { ...BASE }, prev: { ...BASE },
      used: { attack: false, occupy: false, charge: false }
    };
    UI.sel = null; UI.pending.clear();
    if (prefs.capitals === 'random') {
      randomCapitals().forEach((id, i) => setCapital(i, id, false));
      startPlay();
    }
    save();
    enterGame();
    if (G.phase === 'capitals') {
      setMode('capital');
      news('ابدؤوا باختيار العواصم: كل فريق يضغط على إقليم يكون عاصمته.');
    }
  }

  // عواصم متباعدة على الخريطة
  function randomCapitals() {
    const ids = MAP.regions.map((r) => r.id);
    const dist = (a) => { const d = { [a]: 0 }, q = [a]; while (q.length) { const x = q.shift(); NB(x).forEach((y) => { if (d[y] == null) { d[y] = d[x] + 1; q.push(y); } }); } return d; };
    const D = {}; ids.forEach((i) => { D[i] = dist(i); });
    const chosen = [pick(ids)];
    while (chosen.length < G.teams.length) {
      let best = [], bd = -1;
      ids.filter((i) => !chosen.includes(i)).forEach((i) => {
        const m = Math.min(...chosen.map((c) => D[c][i]));
        if (m > bd) { bd = m; best = [i]; } else if (m === bd) best.push(i);
      });
      chosen.push(pick(best));
    }
    return shuffle(chosen);
  }

  function setCapital(t, id, anim = true) {
    const r = reg(id);
    r.owner = t; r.bat = R.startBat; r.oldCap = false;
    G.teams[t].capital = id;
    if (anim) plant(id, G.teams[t].color);
  }

  function startPlay() {
    G.phase = 'play'; G.turn = 0; G.week = 1;
    beginTurn(true);
  }

  function enterGame() {
    show('screen-game');
    buildMap();
    renderAll();
    rotateNews(true);
  }

  // =========================================================
  // الخريطة
  // =========================================================
  const svgEl = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const DECO = {
    peak: '<path d="M-16 9L-5 -9L1 0L6 -6L16 9Z"/><path d="M-8 -4l3 2 2-3"/>',
    tree: '<path d="M-10 8l6-10h-3l5-9 5 9h-3l6 10z"/><path d="M0 8v5"/><path d="M8 10l4-7h-2l3-6 3 6h-2l4 7z"/>',
    palm: '<path d="M0 12C1 4 0 -2 -2 -8"/><path d="M-2 -8c-6-3-11-1-13 3M-2 -8c5-4 11-3 13 1M-2 -8c-2-5-7-7-11-6M-2 -8c3-5 8-6 11-4"/>',
    dune: '<path d="M-18 6c6-8 12-8 18 0M-2 6c6-6 12-6 18 0"/><path d="M-12 11h22"/>',
    wave: '<path d="M-16 0c4-4 8 4 12 0s8 4 12 0 8 4 8 0"/><path d="M-10 8c4-4 8 4 12 0s8 4 10 0"/>',
    grass: '<path d="M-12 8c0-6 2-9 4-12M-10 8c2-5 4-7 7-8M2 8c0-6 2-9 4-12M4 8c2-5 4-7 7-8M-4 8c0-4-2-7-4-9"/>',
    rock: '<path d="M-14 8l4-10 8-4 8 5 8 9z"/><path d="M-2 -6l2 8 8 6"/>',
    lake: '<ellipse class="lk" cx="0" cy="0" rx="24" ry="13"/><path d="M-10 0c3-2 6 2 9 0s6 2 9 0"/>'
  };
  function buildMap() {
    const svg = $('#map');
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${MAP.w} ${MAP.h}`);
    const defs = svgEl('defs', {}, svg);
    // ملمس الرَقّ: بقع وخدوش خفيفة
    const pat = svgEl('pattern', { id: 'paperTex', width: 120, height: 120, patternUnits: 'userSpaceOnUse' }, defs);
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 26; i++) svgEl('circle', { cx: (rnd() * 120).toFixed(1), cy: (rnd() * 120).toFixed(1), r: (0.6 + rnd() * 1.8).toFixed(1), fill: 'var(--ink)', 'fill-opacity': (0.04 + rnd() * 0.06).toFixed(2) }, pat);
    for (let i = 0; i < 5; i++) { const x = rnd() * 120, y = rnd() * 120; svgEl('path', { d: `M${x.toFixed(1)} ${y.toFixed(1)}q${(rnd() * 20).toFixed(1)} ${(rnd() * 6 - 3).toFixed(1)} ${(14 + rnd() * 20).toFixed(1)} ${(rnd() * 4 - 2).toFixed(1)}`, stroke: 'var(--ink)', 'stroke-opacity': '.06', fill: 'none' }, pat); }
    MAP.regions.forEach((r) => { const cp = svgEl('clipPath', { id: 'clip-' + r.id }, defs); svgEl('path', { d: r.d }, cp); });

    svgEl('rect', { class: 'm-sea', x: 0, y: 0, width: MAP.w, height: MAP.h }, svg);
    // أمواج البحر
    const waves = svgEl('g', {}, svg);
    for (let i = 0; i < 46; i++) {
      const x = rnd() * MAP.w, y = rnd() * MAP.h;
      svgEl('path', { class: 'm-wave', d: `M${x.toFixed(0)} ${y.toFixed(0)}c6-5 12 5 18 0s12 5 18 0` }, waves);
    }
    svgEl('path', { class: 'm-coast-glow', d: MAP.coast }, svg);
    svgEl('path', { class: 'm-land', d: MAP.coast }, svg);
    svgEl('path', { class: 'm-tex', d: MAP.coast }, svg);

    const gReg = svgEl('g', { id: 'gReg' }, svg);
    MAP.regions.forEach((r) => {
      const g = svgEl('g', { class: 'reg', 'data-id': r.id, tabindex: 0, role: 'button' }, gReg);
      svgEl('path', { class: 'r-fill', d: r.d }, g);
    });
    // الزخارف
    const gDeco = svgEl('g', {}, svg);
    MAP.regions.forEach((r) => {
      r.deco.slice(0, r.kind === 'lake' ? 1 : 2).forEach(([x, y]) => {
        const g = svgEl('g', { class: 'deco', transform: `translate(${x} ${y})` }, gDeco);
        g.innerHTML = DECO[r.kind] || '';
      });
    });
    // الحدود المنقطة والساحل
    const gInk = svgEl('g', {}, svg);
    MAP.regions.forEach((r) => svgEl('path', { class: 'r-ink', d: r.d }, gInk));
    svgEl('path', { class: 'm-coast', d: MAP.coast }, svg);
    // طبقة الحدود التفاعلية (تحديد وأهداف)
    const gOl = svgEl('g', { id: 'gOl' }, svg);
    MAP.regions.forEach((r) => {
      const g = svgEl('g', { class: 'ol', 'data-id': r.id }, gOl);
      svgEl('path', { class: 'r-tgt', d: r.d }, g);
      svgEl('path', { class: 'r-sel', d: r.d }, g);
    });
    svgEl('g', { id: 'gFx' }, svg);
    svgEl('g', { id: 'gLbl' }, svg);

    svg.onclick = (e) => { const g = e.target.closest('.reg'); if (g) onRegion(+g.dataset.id); };
    svg.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.reg')) { e.preventDefault(); onRegion(+e.target.closest('.reg').dataset.id); } };
  }

  const SHIELD = 'M0 -22L20 -15V1C20 13 10 20 0 24C-10 20 -20 13 -20 1V-15Z';
  function renderLabels(popIds = []) {
    const gl = $('#gLbl');
    if (!gl) return;
    gl.innerHTML = '';
    MAP.regions.forEach((m) => {
      const r = reg(m.id);
      const t = r.owner != null ? team(r.owner) : null;
      const g = svgEl('g', { class: 'lbl' + (popIds.includes(m.id) ? ' pop' : ''), transform: `translate(${m.x} ${m.y})` }, gl);
      let h = '';
      if (t) {
        h += `<path class="shield" d="${SHIELD}" fill="${t.color}" transform="translate(0 -8)"/>`;
        h += `<text class="cnt" x="0" y="-1" text-anchor="middle">${ar(r.bat)}</text>`;
        if (t.capital === m.id) h += `<path class="crown" transform="translate(0 -40)" d="M-13 6l-2-12 7 5 8-10 8 10 7-5-2 12z"/>`;
        if (r.wall) h += `<g transform="translate(29 -12)"><path class="wall" d="M-10 10V-6h4v-4h4v4h4v-4h4v4h4v16z"/></g>`;
        if (r.can) h += `<g transform="translate(-31 -10)"><rect class="can-badge" x="-14" y="-10" width="28" height="20" rx="6"/><text class="can-t" x="0" y="4.5" text-anchor="middle">${ar(r.can)}م</text></g>`;
      } else {
        h += `<path class="shield neutral" d="${SHIELD}" transform="translate(0 -8) scale(.8)"/>`;
        h += `<text class="cnt neutral" x="0" y="-2" text-anchor="middle">${r.bat ? ar(r.bat) : '·'}</text>`;
      }
      if (r.oldCap && !(t && t.capital === m.id)) h += `<path class="oldcap" transform="translate(${t ? 0 : 0} ${t ? -40 : -34}) scale(.7)" d="M-13 6l-2-12 7 5 8-10 8 10 7-5-2 12z"/>`;
      h += `<text class="nm" x="0" y="${t ? 36 : 30}" text-anchor="middle">${esc(r.name)}</text>`;
      g.innerHTML = h;
    });
  }

  // أهداف صالحة لكل وضع
  function connectedOwn(id) {
    const t = reg(id).owner, seen = new Set([id]), q = [id];
    while (q.length) { const x = q.shift(); NB(x).forEach((y) => { if (!seen.has(y) && reg(y).owner === t) { seen.add(y); q.push(y); } }); }
    seen.delete(id); return [...seen];
  }
  function targets() {
    if (!G) return [];
    const me = G.turn, mode = UI.mode, src = UI.src;
    const own = (r) => r.owner === me;
    switch (mode) {
      case 'capital': return G.regions.filter((r) => (G.phase === 'capitals' ? r.owner == null : own(r))).map((r) => r.id);
      case 'attack-src': return G.regions.filter((r) => own(r) && r.bat >= R.minAttack && NB(r.id).some((n) => reg(n).owner != null && reg(n).owner !== me)).map((r) => r.id);
      case 'attack-dst': return NB(src).filter((n) => reg(n).owner != null && reg(n).owner !== me);
      case 'occupy-src': return G.regions.filter((r) => own(r) && r.bat >= 2 && NB(r.id).some((n) => reg(n).owner == null)).map((r) => r.id);
      case 'occupy-dst': return NB(src).filter((n) => reg(n).owner == null);
      case 'move-src': return G.regions.filter((r) => own(r) && (r.bat >= 2 || r.can > 0) && connectedOwn(r.id).length).map((r) => r.id);
      case 'move-dst': return connectedOwn(src);
      default: return [];
    }
  }

  function refreshMap() {
    const svg = $('#map');
    if (!svg || !G) return;
    const tg = new Set(targets());
    const base = UI.mode ? UI.mode.split('-')[0] : '';
    svg.setAttribute('class', 'map' + (UI.mode ? ' picking mode-' + base : ''));
    MAP.regions.forEach((m) => {
      const r = reg(m.id);
      const g = $(`.reg[data-id="${m.id}"]`, svg), ol = $(`.ol[data-id="${m.id}"]`, svg);
      const owned = r.owner != null && !UI.pending.has(m.id);
      g.classList.toggle('owned', owned);
      g.style.setProperty('--c', r.owner != null ? team(r.owner).color : 'transparent');
      g.setAttribute('aria-label', `${r.name}${r.owner != null ? '، ' + team(r.owner).name + '، ' + ar(r.bat) + ' كتيبة' : '، بلا صاحب'}`);
      ol.classList.toggle('tgt', tg.has(m.id));
      ol.classList.toggle('src', UI.src === m.id);
      ol.classList.toggle('sel', !UI.mode && UI.sel === m.id);
    });
  }

  // على الشاشات الضيقة الخريطة تُسحب أفقيًا: نوسّطها على الإقليم المطلوب
  function focusRegion(id) {
    const sc = $('#mapScroll');
    if (!sc || !id || sc.scrollWidth <= sc.clientWidth + 2) return;
    const m = MAP.regions[id - 1];
    const sw = sc.scrollWidth, cw = sc.clientWidth;
    const lx = Math.max(0, Math.min(sw - cw, (m.x / MAP.w) * sw - cw / 2));
    // في اتجاه RTL يبدأ التمرير من اليمين (صفر) وتكون القيم سالبة نحو اليسار
    sc.scrollTo({ left: lx - (sw - cw), behavior: reduced ? 'auto' : 'smooth' });
  }

  // غرس الراية وانتشار لون الفريق
  function plant(id, color) {
    const fx = $('#gFx');
    const m = MAP.regions[id - 1];
    if (!fx) return;
    UI.pending.add(id);
    const ink = svgEl('g', { class: 'ink-spread', 'clip-path': `url(#clip-${id})` }, fx);
    svgEl('circle', { cx: m.x, cy: m.y, r: 190, fill: color }, ink);
    const p = svgEl('g', { class: 'plant', transform: `translate(${m.x + 22} ${m.y - 26})` }, fx);
    p.innerHTML = `<ellipse class="pl-dust" cx="0" cy="2" rx="14" ry="4"/><g class="pl-g"><path class="pl-pole" d="M0 2V-48"/><path class="pl-cloth" fill="${color}" d="M1 -47c6-3 10 3 16 0s9-1 9-1v15s-3-2-9 1-10-3-16 0z"/></g>`;
    refreshMap();
    setTimeout(() => { UI.pending.delete(id); ink.remove(); refreshMap(); }, reduced ? 50 : 1050);
    setTimeout(() => p.remove(), reduced ? 50 : 2600);
  }

  // =========================================================
  // الأوضاع والنقر على الأقاليم
  // =========================================================
  const HINTS = {
    'capital': () => G.phase === 'capitals' ? `فريق ${team().name}: اضغط على إقليم يكون عاصمتك` : `سقطت عاصمتك! اختر عاصمة جديدة من أقاليمك`,
    'attack-src': () => 'اختر الإقليم اللي تنطلق منه قواتك (٤ كتائب أو أكثر)',
    'attack-dst': () => `اختر الإقليم المجاور اللي تهاجمه من ${reg(UI.src).name}`,
    'occupy-src': () => 'اختر إقليمًا لك تخرج منه الكتائب',
    'occupy-dst': () => `اختر أرضًا بلا صاحب مجاورة لـ ${reg(UI.src).name}`,
    'move-src': () => 'اختر الإقليم اللي تنقل منه',
    'move-dst': () => `اختر الإقليم اللي تنقل إليه من ${reg(UI.src).name}`
  };
  function setMode(mode, src = null) {
    UI.mode = mode; UI.src = src;
    refreshMap(); renderHint(); renderActions();
  }
  function renderHint() {
    const h = $('#hint');
    const forced = UI.mode === 'capital';
    h.classList.toggle('active', !!UI.mode);
    $('#hintText').textContent = UI.mode ? HINTS[UI.mode]() : 'اختر أداة من الأدوات، أو اضغط على إقليم لتشوف تفاصيله.';
    $('#cancelMode').hidden = !UI.mode || forced;
  }

  function onRegion(id) {
    if (!G || G.phase === 'over') { UI.sel = id; renderRegionCard(); refreshMap(); return; }
    const r = reg(id), me = G.turn;
    const tg = targets();
    if (UI.mode === 'capital') {
      if (!tg.includes(id)) { toast(G.phase === 'capitals' ? 'هذا الإقليم صار عاصمة لفريق آخر' : 'اختر إقليمًا من أقاليمك'); return; }
      if (G.phase === 'capitals') {
        setCapital(me, id);
        SFX.conquer();
        const next = G.teams.findIndex((t) => t.capital == null);
        if (next < 0) { startPlay(); setMode(null); toast('اكتملت العواصم… انطلقت الحملة!', 'gold'); }
        else { G.turn = next; setMode('capital'); }
      } else {
        const t = team(); t.capital = id; t.needCap = false; r.oldCap = false;
        SFX.conquer(); plant(id, t.color);
        toast(`صار ${r.name} عاصمة فريق ${t.name}`, 'gold');
        setMode(null);
      }
      save(); renderAll([id]); return;
    }
    if (!UI.mode) { UI.sel = id; SFX.click(); renderRegionCard(); refreshMap(); return; }

    const [kind, step] = UI.mode.split('-');
    if (!tg.includes(id)) {
      // تمكين تغيير نقطة الانطلاق بالضغط على إقليم آخر صالح
      if (step === 'dst' && r.owner === me) {
        const keep = UI.mode;
        UI.mode = kind + '-src';
        const ok = targets().includes(id);
        UI.mode = keep;
        if (ok) { setMode(kind + '-dst', id); SFX.click(); return; }
      }
      toast(whyNot(kind, step, id), 'bad'); return;
    }
    SFX.click();
    if (step === 'src') { setMode(kind + '-dst', id); focusRegion(id); return; }
    if (kind === 'attack') openAttack(UI.src, id);
    else if (kind === 'occupy') openOccupy(UI.src, id);
    else if (kind === 'move') openMove(UI.src, id);
  }
  function whyNot(kind, step, id) {
    const r = reg(id), me = G.turn;
    if (kind === 'attack') {
      if (step === 'src') return r.owner !== me ? 'ابدأ الهجوم من إقليم من أقاليمك' : r.bat < R.minAttack ? 'يجب أن تبدأ الهجوم من إقليم فيه ٤ كتائب أو أكثر' : 'هذا الإقليم ما يجاور أي عدو';
      return r.owner === me ? 'ما تقدر تهاجم إقليمًا من أقاليمك' : r.owner == null ? 'هذه أرض بلا صاحب… استخدم «احتلال»' : 'هذا الإقليم ليس مجاورًا لإقليمك';
    }
    if (kind === 'occupy') {
      if (step === 'src') return r.owner !== me ? 'اختر إقليمًا تابعًا لك' : r.bat < 2 ? 'ما تقدر تخرج من إقليم فيه كتيبة واحدة' : 'ما فيه أرض بلا صاحب مجاورة لهذا الإقليم';
      return r.owner != null ? 'هذا الإقليم له صاحب… الاحتلال للأرض اللي بلا صاحب' : 'هذه الأرض ليست مجاورة لإقليمك';
    }
    if (step === 'src') return r.owner !== me ? 'حدد إقليمًا تابعًا لك تنقل منه' : 'ما تقدر تنقل من إقليم فيه كتيبة واحدة أو ما يتصل بأقاليمك';
    return r.owner !== me ? 'ما تقدر تنقل إلى إقليم ما تملكه' : 'هذا الإقليم ما يتصل بأقاليمك من هنا';
  }

  // =========================================================
  // نافذة الكميات
  // =========================================================
  function openQty({ title, sub, rows, check, okText = 'تأكيد', onOk }) {
    $('#qtyTitle').textContent = title;
    $('#qtySub').textContent = sub || '';
    $('#qtyOk').textContent = okText;
    const vals = {};
    const box = $('#qtyRows');
    box.innerHTML = rows.map((r) => {
      vals[r.key] = r.value;
      return `<div class="qty" data-k="${r.key}">
        <span class="qty-l"><svg class="ico"><use href="#${r.icon}"/></svg>${esc(r.label)} <small>(${ar(r.min)}–${ar(r.max)})</small></span>
        <span class="stepper"><button data-d="1" aria-label="زيادة"><svg class="ico"><use href="#i-plus"/></svg></button><output>${ar(r.value)}</output><button data-d="-1" aria-label="إنقاص"><svg class="ico"><use href="#i-minus"/></svg></button><button class="max" data-d="max">الكل</button></span>
      </div>`;
    }).join('') + '<p class="power-line" id="qtyPower"></p>';
    const sync = () => {
      rows.forEach((r) => {
        const row = $(`.qty[data-k="${r.key}"]`, box);
        $('output', row).textContent = ar(vals[r.key]);
        $('[data-d="1"]', row).disabled = vals[r.key] >= r.max;
        $('[data-d="-1"]', row).disabled = vals[r.key] <= r.min;
      });
      const res = check ? check(vals) : { ok: true };
      $('#qtyWarn').hidden = !res.warn; $('#qtyWarn').textContent = res.warn || '';
      $('#qtyPower').textContent = res.info || '';
      $('#qtyOk').disabled = !res.ok;
    };
    rows.forEach((r) => {
      const row = $(`.qty[data-k="${r.key}"]`, box);
      $$('button', row).forEach((b) => {
        let hold = 0;
        const step = () => {
          const d = b.dataset.d;
          vals[r.key] = d === 'max' ? r.max : Math.max(r.min, Math.min(r.max, vals[r.key] + +d));
          sync(); SFX.tick();
        };
        b.addEventListener('click', step);
        // الضغط المطوّل للزيادة السريعة
        b.addEventListener('pointerdown', () => { if (b.dataset.d === 'max') return; hold = setTimeout(function rep() { step(); hold = setTimeout(rep, 70); }, 420); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => clearTimeout(hold)));
      });
    });
    sync();
    openModal('qtyModal');
    $('#qtyOk').onclick = () => { closeModal('qtyModal'); onOk(vals); };
  }

  function openOccupy(src, dst) {
    const s = reg(src), d = reg(dst);
    openQty({
      title: `احتلال ${d.name}`,
      sub: `كم كتيبة تخرج من ${s.name} لتحتل الأرض؟`,
      rows: [
        { key: 'bat', label: 'كتائب', icon: 'i-helmet', min: 1, max: s.bat - 1, value: Math.max(1, Math.min(s.bat - 1, Math.ceil((s.bat - 1) / 3))) },
        ...(s.can ? [{ key: 'can', label: 'مدافع', icon: 'i-cannon', min: 0, max: s.can, value: 0 }] : [])
      ],
      okText: 'احتل',
      onOk: (v) => {
        s.bat -= v.bat; d.bat = v.bat;
        if (v.can) { s.can -= v.can; d.can = v.can; }
        d.owner = G.turn;
        G.used.occupy = true;
        SFX.move(); setTimeout(SFX.conquer, 500);
        plant(dst, team().color);
        news(`فريق ${team().name} احتل ${d.name}.`);
        setMode(null); UI.sel = dst; save(); renderAll([dst, src]);
      }
    });
  }

  function openMove(src, dst) {
    const s = reg(src), d = reg(dst);
    const rows = [];
    if (s.bat > 1) rows.push({ key: 'bat', label: 'كتائب', icon: 'i-helmet', min: 0, max: s.bat - 1, value: s.bat - 1 });
    if (s.can > 0) rows.push({ key: 'can', label: 'مدافع', icon: 'i-cannon', min: 0, max: s.can, value: 0 });
    openQty({
      title: `نقل من ${s.name} إلى ${d.name}`,
      sub: 'يبقى في الإقليم كتيبة واحدة على الأقل.',
      rows,
      check: (v) => ({ ok: (v.bat || 0) + (v.can || 0) > 0 }),
      okText: 'انقل',
      onOk: (v) => {
        s.bat -= v.bat || 0; d.bat += v.bat || 0;
        s.can -= v.can || 0; d.can += v.can || 0;
        SFX.move();
        setMode(null); UI.sel = dst; save(); renderAll([src, dst]);
      }
    });
  }

  function openAttack(src, dst) {
    const s = reg(src), d = reg(dst);
    const defP = power(d) * (d.wall ? 2 : 1);
    const rows = [{ key: 'bat', label: 'كتائب', icon: 'i-helmet', min: 1, max: s.bat - 1, value: s.bat - 1 }];
    if (s.can) rows.push({ key: 'can', label: 'مدافع', icon: 'i-cannon', min: 0, max: s.can, value: s.can });
    openQty({
      title: `هجوم على ${d.name}`,
      sub: `من ${s.name} على ${d.name} (فريق ${team(d.owner).name}). يبقى كتيبة واحدة على الأقل في ${s.name}.`,
      rows,
      check: (v) => {
        const p = v.bat + R.cannon * (v.can || 0);
        const info = `قوتك الضاربة ${num(p)} مقابل قوة المدافع ${num(power(d))}${d.wall ? ' خلف سور' : ''}.`;
        if (defP > R.blockRatio * p) return { ok: false, info, warn: 'هذا الإقليم عدد قواته أكبر بكثير من قواتك (أكثر من ثلاثة أضعاف)… زد قواتك أو اختر هدفًا آخر.' };
        return { ok: true, info };
      },
      okText: 'إلى المعركة',
      onOk: (v) => startBattle(src, dst, v.bat, v.can || 0)
    });
  }

  // =========================================================
  // المعركة
  // =========================================================
  let cleanQ = null;
  function startBattle(src, dst, bat, can) {
    const s = reg(src), d = reg(dst);
    s.bat -= bat; s.can -= can;
    G.used.attack = true;
    G.battle = {
      src, dst, round: 1, step: 'intro', log: [],
      isCap: team(d.owner).capital === dst,
      att: { team: G.turn, bat, can, max: bat + R.cannon * can },
      def: { team: d.owner, bat: d.bat, can: d.can, wall: d.wall, max: Math.max(1, power(d)) }
    };
    setMode(null);
    save(); renderAll();
    openBattle();
  }

  function sideHTML(u, wall) {
    return `<span class="unit"><svg class="ico"><use href="#i-helmet"/></svg>${ar(u.bat)}</span>
      <span class="unit"><svg class="ico"><use href="#i-cannon"/></svg>${ar(u.can)}</span>
      ${wall ? '<span class="unit"><svg class="ico"><use href="#i-wall"/></svg>سور</span>' : ''}
      <span class="unit"><b>القوة ${num(power(u))}</b></span>`;
  }
  function renderSides(turn, B = G.battle) {
    [['att', $('#bAtt'), reg(B.src).name], ['def', $('#bDef'), reg(B.dst).name]].forEach(([k, el, place]) => {
      const u = B[k], t = team(u.team);
      el.style.setProperty('--c', t.color);
      $('.b-name', el).textContent = 'فريق ' + t.name;
      $('.b-from', el).textContent = (k === 'att' ? 'ينطلق من ' : 'يدافع عن ') + place + (k === 'def' && B.isCap ? ' (العاصمة)' : '');
      $('.b-bar i', el).style.width = Math.max(0, Math.min(100, (power(u) / u.max) * 100)) + '%';
      $('.b-units', el).innerHTML = sideHTML(u, k === 'def' && u.wall);
      el.classList.toggle('turn', turn === k);
    });
    $('#bRound').textContent = `الجولة ${ar(Math.min(B.round, R.rounds))} من ${ar(R.rounds)}`;
  }

  function openBattle() {
    const B = G.battle;
    $('#battle').hidden = false;
    $('#bTitle').textContent = `معركة ${reg(B.dst).name}`;
    renderSides(null);
    const st = $('#bStage'), act = $('#bActions');
    st.innerHTML = `<div class="b-intro">
      ${B.isCap ? `<div class="danger"><svg class="ico"><use href="#i-crown"/></svg>خطر! هجوم على عاصمة فريق ${esc(team(B.def.team).name)}</div>` : ''}
      <p>فريق <b>${esc(team(B.att.team).name)}</b> يزحف على <b>${esc(reg(B.dst).name)}</b>.</p>
      <p class="muted">${ar(R.rounds)} جولات: سؤال للمهاجم ثم سؤال للمدافع. الإجابة الصحيحة ضربة${B.def.wall ? '، والسور يخفف الضرب على المدافع للنصف' : ''}.</p>
    </div>`;
    act.innerHTML = `<button class="btn btn-danger btn-xl" id="bGo"><svg class="ico"><use href="#i-sword"/></svg>${B.step === 'intro' ? 'ابدأ المعركة' : 'تابع المعركة'}</button>`;
    if (B.isCap && B.step === 'intro') SFX.alarm(); else SFX.move();
    $('#bGo').onclick = () => { SFX.click(); askStep(B.step === 'def' ? 'def' : 'att'); };
  }

  function askStep(side) {
    const B = G.battle;
    B.step = side; save();
    renderSides(side);
    const t = team(B[side].team);
    const st = $('#bStage'), act = $('#bActions');
    const label = side === 'att' ? `سؤال المهاجم: فريق ${t.name}` : `سؤال المدافع: فريق ${t.name}`;
    act.innerHTML = side === 'att'
      ? `<button class="btn btn-sm" id="bOut"><svg class="ico"><use href="#i-retreat"/></svg>انسحاب وترك الهجوم</button>`
      : `<button class="btn btn-sm" id="bOut"><svg class="ico"><use href="#i-flag"/></svg>تنازل عن الإقليم</button>`;
    cleanQ = askQuestion(st, {
      teamIdx: B[side].team, label,
      onAnswer: (ok, timeout) => {
        const other = side === 'att' ? 'def' : 'att';
        const res = $('.q-res', st);
        if (ok) {
          let dmg = Math.max(1, Math.round(power(B[side]) * R.hitRatio * rand(0.85, 1.15)));
          if (other === 'def' && B.def.wall) dmg = Math.ceil(dmg / 2);
          const before = power(B[other]);
          applyDamage(B[other], dmg);
          const lost = before - power(B[other]);
          res.className = 'q-res ok';
          res.textContent = `إجابة صحيحة! ضربة أسقطت ${num(lost)} من قوة ${side === 'att' ? 'المدافع' : 'المهاجم'}.`;
          SFX.hit();
          hitFx(other, lost);
        } else {
          res.className = 'q-res bad';
          res.textContent = timeout ? 'انتهى الوقت… ضاعت الضربة.' : 'إجابة خاطئة… ضاعت الضربة.';
        }
        renderSides(null);
        save();
        const over = power(B.def) <= 0 ? 'capture' : power(B.att) <= 0 ? 'fail' : null;
        act.innerHTML = `<button class="btn btn-primary btn-xl" id="bNext">${over ? 'نتيجة المعركة' : 'متابعة'}</button>`;
        $('#bNext').onclick = () => {
          SFX.click();
          if (over) return finishBattle(over);
          if (side === 'att') return askStep('def');
          B.round++;
          if (B.round > R.rounds) return finishBattle('hold');
          askStep('att');
        };
      }
    });
    $('#bOut').onclick = async () => {
      const ok = await confirmBox(side === 'att' ? 'انسحاب؟' : 'تنازل؟',
        side === 'att' ? 'ترجع قواتك الباقية إلى إقليمها وتنتهي المعركة.' : 'يصير الإقليم للمهاجم، وتنسحب قواتك الباقية إلى إقليم مجاور لك إن وُجد.');
      if (!ok) return;
      if (cleanQ) cleanQ();
      finishBattle(side === 'att' ? 'withdraw' : 'surrender');
    };
  }

  function applyDamage(u, dmg) {
    const k = Math.min(u.bat, dmg); u.bat -= k;
    const rest = dmg - k;
    if (rest > 0) u.can -= Math.min(u.can, Math.ceil(rest / R.cannon));
  }
  function hitFx(side, lost) {
    const el = side === 'att' ? $('#bAtt') : $('#bDef');
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
    const card = $('.battle-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
    const vs = $('.b-vs'); vs.classList.remove('clash'); void vs.offsetWidth; vs.classList.add('clash');
    const d = document.createElement('span');
    d.className = 'dmg'; d.textContent = iso('−' + num(lost));
    d.style.top = '6px'; d.style.insetInlineEnd = '14px';
    el.style.position = 'relative'; el.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }

  function finishBattle(outcome) {
    const B = G.battle;
    if (cleanQ) { cleanQ(); cleanQ = null; }
    const s = reg(B.src), d = reg(B.dst);
    const A = team(B.att.team), D = team(B.def.team);
    let title, text, color = A.color, capFell = false;
    if (outcome === 'capture' || outcome === 'surrender') {
      if (outcome === 'surrender') {
        // انسحاب المدافع إلى أقوى إقليم مجاور له
        const ref = NB(B.dst).map(reg).filter((r) => r.owner === B.def.team).sort((a, b) => b.bat - a.bat)[0];
        if (ref) { ref.bat += B.def.bat; ref.can += B.def.can; }
      }
      if (D.capital === B.dst) { D.capital = null; D.needCap = true; d.oldCap = true; capFell = true; }
      d.owner = B.att.team; d.bat = B.att.bat; d.can = B.att.can; d.wall = false;
      if (d.bat < 1 && s.bat > 1) { d.bat = 1; s.bat -= 1; }
      title = outcome === 'capture' ? `فوز ساحق لفريق ${A.name}!` : `تنازل المدافع عن ${d.name}`;
      text = outcome === 'capture' ? `سقط ${d.name} ورفرفت عليه راية ${A.name}.` : `تنازل فريق ${D.name} عن إقليمه، ودخله فريق ${A.name}.`;
      if (capFell) text += ` وسقطت عاصمة فريق ${D.name}!`;
      SFX.conquer();
    } else {
      s.bat += B.att.bat; s.can += B.att.can;
      d.bat = B.def.bat; d.can = B.def.can;
      color = D.color;
      if (outcome === 'fail') { title = 'فشل ذريع في محاولة الاحتلال'; text = `خسر فريق ${A.name} كل قواته المهاجمة، وصمد ${d.name}.`; SFX.wrong(); }
      else if (outcome === 'withdraw') { title = `فريق ${A.name} ترك الهجوم`; text = `انسحب بمن بقي إلى ${s.name}.`; S.gust(); }
      else { title = `صمد ${d.name}!`; text = `انتهت الجولات الأربع وما سقط الإقليم، فرجع فريق ${A.name} بمن بقي إلى ${s.name}.`; S.gust(); }
    }
    // خروج المدافع إذا خسر كل أقاليمه
    let out = false;
    if (!regionsOf(B.def.team).length) { D.alive = false; D.needCap = false; out = true; text += ` وخرج فريق ${D.name} من الحملة.`; }
    news(`${title} ${text}`);
    G.battle = null;
    save();
    renderSides(null, B);
    $('#bAtt').classList.remove('turn'); $('#bDef').classList.remove('turn');
    $('#bStage').innerHTML = `<div class="b-result" style="--c:${color}"><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;
    $('#bActions').innerHTML = `<button class="btn btn-primary btn-xl" id="bClose">رجوع للخريطة</button>`;
    $('#bClose').onclick = () => {
      $('#battle').hidden = true;
      const won = outcome === 'capture' || outcome === 'surrender';
      if (won) plant(B.dst, A.color);
      UI.sel = B.dst;
      renderAll([B.src, B.dst]);
      if (out) toast(`خرج فريق ${D.name} من الحملة`, 'bad');
      if (G.teams.filter((t) => t.alive).length === 1) { setTimeout(() => endGame('conquest'), won ? 1300 : 300); return; }
      if (capFell) setTimeout(() => openRename(B.dst, D), won ? 900 : 0);
    };
  }

  function openRename(id, loser) {
    const r = reg(id);
    $('#renameSub').textContent = `سقطت عاصمة فريق ${loser.name} (${r.name}). تقدر تسمّي الإقليم باسم جديد لفريقك.`;
    $('#renameInput').value = '';
    openModal('renameModal');
    const done = (name) => {
      closeModal('renameModal');
      if (name) { r.name = name; news(`صار اسم العاصمة المنهارة «${name}».`); }
      save(); renderAll([id]);
    };
    $('#renameOk').onclick = () => done($('#renameInput').value.trim());
    $('#renameSkip').onclick = () => done('');
  }

  // =========================================================
  // السوق
  // =========================================================
  const sellPrice = (k) => Math.max(1, Math.round(G.prices[k] * 0.6));
  let mRegion = null;
  function openMarket() {
    const own = regionsOf(G.turn);
    const t = team();
    if (!mRegion || reg(mRegion).owner !== G.turn) mRegion = (UI.sel && reg(UI.sel).owner === G.turn) ? UI.sel : (t.capital || own[0].id);
    const sel = $('#marketRegion');
    sel.innerHTML = own.map((r) => `<option value="${r.id}">${esc(r.name)}${t.capital === r.id ? ' (العاصمة)' : ''}</option>`).join('');
    sel.value = mRegion;
    sel.onchange = () => { mRegion = +sel.value; renderMarket(); };
    renderMarket();
    openModal('marketModal');
  }
  const mQty = { bat: 5, can: 1 };
  function renderMarket() {
    const t = team(), r = reg(mRegion);
    $('#marketMoney').textContent = num(t.money);
    const row = (k) => {
      const it = ITEMS[k], p = G.prices[k], prev = G.prev[k];
      const diff = p - prev;
      const trend = diff ? `<span class="trend ${diff > 0 ? 'up' : 'dn'}">${diff > 0 ? '▲' : '▼'} ${signed(diff)}</span>` : '<span class="trend">ثابت</span>';
      const have = k === 'wall' ? (r.wall ? 'موجود' : 'لا يوجد') : `عندك ${ar(r[k])}`;
      let ops;
      if (k === 'wall') {
        ops = r.wall
          ? `<button class="btn btn-sm" data-op="sell" data-k="wall">بيع السور ${signed(sellPrice('wall'))}</button>`
          : `<button class="btn btn-sm btn-gold" data-op="buy" data-k="wall" ${t.money < p ? 'disabled' : ''}>شراء سور (${num(p)})</button>`;
      } else {
        const q = mQty[k];
        const canSell = k === 'bat' ? r.bat - 1 >= q : r.can >= q;
        ops = `<span class="stepper"><button data-q="1" data-k="${k}" aria-label="زيادة"><svg class="ico"><use href="#i-plus"/></svg></button><output>${ar(q)}</output><button data-q="-1" data-k="${k}" aria-label="إنقاص"><svg class="ico"><use href="#i-minus"/></svg></button></span>
          <button class="btn btn-sm btn-gold" data-op="buy" data-k="${k}" ${t.money < p * q ? 'disabled' : ''}>شراء (${num(p * q)})</button>
          <button class="btn btn-sm" data-op="sell" data-k="${k}" ${canSell ? '' : 'disabled'}>بيع ${signed(sellPrice(k) * q)}</button>`;
      }
      return `<div class="mrow">
        <span class="m-item"><svg class="ico"><use href="#${it.icon}"/></svg><span>${it.name}<small>${it.hint} · ${have}</small></span></span>
        <span class="m-price">سعر الشراء<b>${num(p)}</b>${trend}</span>
        <span class="m-price">سعر البيع<b>${num(sellPrice(k))}</b></span>
        <span class="m-ops">${ops}</span>
      </div>`;
    };
    $('#marketTable').innerHTML = row('bat') + row('can') + row('wall');
    $$('#marketTable [data-q]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.k; mQty[k] = Math.max(1, Math.min(99, mQty[k] + +b.dataset.q)); SFX.tick(); renderMarket();
    }));
    $$('#marketTable [data-op]').forEach((b) => b.addEventListener('click', () => trade(b.dataset.op, b.dataset.k)));
  }
  function trade(op, k) {
    const t = team(), r = reg(mRegion);
    const q = k === 'wall' ? 1 : mQty[k];
    if (op === 'buy') {
      const cost = G.prices[k] * q;
      if (t.money < cost) { toast('الخزينة ما تكفي', 'bad'); return; }
      t.money -= cost;
      if (k === 'wall') r.wall = true; else r[k] += q;
      toast(`اشتريت ${k === 'wall' ? 'سورًا' : ar(q) + ' ' + (q === 1 ? ITEMS[k].one : ITEMS[k].name)} على ${r.name}`, 'gold');
    } else {
      if (k === 'wall') r.wall = false;
      else if (k === 'bat') { if (r.bat - 1 < q) return; r.bat -= q; }
      else { if (r.can < q) return; r.can -= q; }
      t.money += sellPrice(k) * q;
    }
    SFX.coins();
    save(); renderMarket(); renderAll([mRegion]); bump($('#tbMoney').parentElement);
  }

  // تغيّر الأسعار كل أسبوع: حظ + منطق (الهابط يميل للصعود، والكل يرجع نحو سعره الأساسي)
  function updatePrices() {
    const changes = [];
    for (const k in BASE) {
      const p = G.prices[k], prev = G.prev[k];
      let drift = (BASE[k] - p) / BASE[k] * 0.35;
      if (p < prev) drift += 0.08;
      const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      let np = Math.round(p * (1 + drift + g * 0.18));
      np = Math.max(Math.round(BASE[k] * 0.55), Math.min(Math.round(BASE[k] * 1.6), np));
      G.prev[k] = p; G.prices[k] = np;
      if (np !== p) changes.push(`${ITEMS[k].one} ${num(np)} ${np > p ? '▲' : '▼'}`);
    }
    if (changes.length) news('تغيّرت أسعار السوق: ' + changes.join('، ') + '.');
  }

  // =========================================================
  // الشحن
  // =========================================================
  function openCharge() {
    G.used.charge = true; save(); renderActions();
    const total = G.settings.charge;
    let left = total, right = 0, gain = 0;
    const box = $('#chargeQ');
    const stats = () => { $('#chLeft').textContent = ar(left); $('#chRight').textContent = ar(right); $('#chGain').textContent = num(gain); };
    const ask = () => {
      $('#chargeNext').hidden = true;
      cleanQ = askQuestion(box, {
        teamIdx: G.turn, label: `فريق ${team().name}: سؤال ${ar(total - left + 1)} من ${ar(total)}`,
        onAnswer: (ok, timeout) => {
          left--;
          const res = $('.q-res', box);
          if (ok) {
            right++; gain += R.chargeReward; team().money += R.chargeReward;
            res.className = 'q-res ok'; res.textContent = `صح! ${signed(R.chargeReward)} للخزينة`;
            SFX.coins(); bump($('#tbMoney').parentElement);
          } else { res.className = 'q-res bad'; res.textContent = timeout ? 'انتهى الوقت' : 'خطأ… الإجابة الصحيحة باللون الأخضر'; }
          stats(); save(); renderTurnbar(); renderStandings();
          const btn = $('#chargeNext');
          btn.hidden = false;
          btn.textContent = left ? 'السؤال التالي' : 'إنهاء الشحن';
          btn.onclick = () => {
            SFX.click();
            if (left) return ask();
            closeModal('chargeModal');
            toast(gain ? `حصّلت ${num(gain)} للخزينة من الشحن` : 'ما حصّلت شيئًا هالمرة… حظًا أوفر', gain ? 'gold' : '');
            if (gain) news(`فريق ${team().name} شحن خزينته بـ ${num(gain)}.`);
          };
        }
      });
    };
    stats(); openModal('chargeModal'); ask();
  }

  // =========================================================
  // الأدوار والأسابيع
  // =========================================================
  function beginTurn(first = false) {
    const t = team();
    G.used = { attack: false, occupy: false, charge: false };
    UI.sel = null; UI.mode = null; UI.src = null;
    if (!first && G.week > 1) {
      const n = regionsOf(G.turn).length;
      const inc = n * R.perRegion, bonus = t.capital ? R.capitalBonus : 0;
      t.money += inc + bonus;
      setTimeout(() => toast(`فريق ${t.name}: حصلت على ${num(inc)}${bonus ? ` وكذلك ${num(bonus)} إضافية للعاصمة` : ''}`, 'gold'), 450);
      if (inc + bonus) setTimeout(SFX.coins, 450);
    }
    save();
    if (t.needCap && regionsOf(G.turn).length) setMode('capital');
    setTimeout(() => focusRegion(t.capital || (regionsOf(G.turn)[0] || {}).id), 60);
  }

  async function endTurn() {
    if (UI.mode === 'capital') { toast('اختر عاصمتك الجديدة أولًا'); return; }
    let i = G.turn, wrapped = false;
    do { i = (i + 1) % G.teams.length; if (i === 0) wrapped = true; } while (!G.teams[i].alive);
    G.turn = i;
    if (wrapped) {
      G.week++;
      if (G.settings.weeks && G.week > G.settings.weeks) { G.week = G.settings.weeks; save(); endGame('time'); return; }
      updatePrices();
    }
    SFX.turn();
    beginTurn();
    renderAll();
    const tb = $('#turnbar'); tb.classList.remove('swap'); void tb.offsetWidth; tb.classList.add('swap');
    rotateNews();
  }

  // =========================================================
  // العرض
  // =========================================================
  function renderTurnbar() {
    const t = team();
    $('#turnbar').style.setProperty('--c', t.color);
    $('#tbLabel').textContent = G.phase === 'capitals' ? 'يختار عاصمته' : G.phase === 'over' ? 'انتهت الحملة' : 'الدور على';
    $('#tbTeam').textContent = 'فريق ' + t.name;
    $('#tbWeek').textContent = G.phase === 'capitals' ? 'اختيار العواصم' : `الأسبوع ${ar(G.week)}${G.settings.weeks ? ' من ' + ar(G.settings.weeks) : ''}`;
    $('#tbMoney').textContent = num(t.money);
  }
  function renderActions() {
    const t = G ? team() : null;
    const locked = !G || G.phase !== 'play' || UI.mode === 'capital' || !t.alive;
    $$('.act').forEach((b) => {
      const a = b.dataset.act;
      const used = G && G.used[a];
      b.classList.toggle('used', !!used);
      b.classList.toggle('on', !!UI.mode && UI.mode.startsWith(a + '-'));
      b.disabled = locked || !!used;
    });
  }
  function renderRegionCard() {
    const box = $('#regionCard');
    if (!UI.sel) { box.innerHTML = '<p class="muted">اضغط على أي إقليم لتشوف تفاصيله.</p>'; return; }
    const r = reg(UI.sel), t = r.owner != null ? team(r.owner) : null;
    const isCap = t && t.capital === r.id;
    box.innerHTML = `
      <div class="rc-head"><span class="rc-dot" style="--c:${t ? t.color : 'var(--land-2)'}"></span>
        <div><h3>${esc(r.name)}</h3><span class="rc-owner">${t ? 'فريق ' + esc(t.name) : 'أرض بلا صاحب'}</span></div></div>
      <div class="rc-units">
        ${isCap ? '<span class="unit cap"><svg class="ico"><use href="#i-crown"/></svg>العاصمة</span>' : ''}
        ${r.oldCap && !isCap ? '<span class="unit"><svg class="ico"><use href="#i-crown"/></svg>عاصمة قديمة</span>' : ''}
        <span class="unit"><svg class="ico"><use href="#i-helmet"/></svg>${ar(r.bat)} كتيبة</span>
        <span class="unit"><svg class="ico"><use href="#i-cannon"/></svg>${ar(r.can)} مدفع</span>
        ${r.wall ? '<span class="unit"><svg class="ico"><use href="#i-wall"/></svg>سور</span>' : ''}
        ${t ? `<span class="unit"><b>القوة ${num(power(r))}</b></span>` : ''}
      </div>
      <p class="rc-nb">يجاور: ${NB(r.id).map((n) => esc(reg(n).name)).join('، ')}</p>`;
  }
  function renderStandings() {
    $('#standings').innerHTML = G.teams.map((t, i) => {
      const rs = regionsOf(i);
      const p = rs.reduce((s, r) => s + power(r), 0);
      return `<li class="st${i === G.turn && G.phase !== 'over' ? ' now' : ''}${t.alive ? '' : ' out'}" style="--c:${t.color}">
        <i></i><b>${esc(t.name)}${t.capital ? '' : (t.alive && G.phase === 'play' ? ' · بلا عاصمة' : '')}</b>
        <small><span><svg class="ico"><use href="#i-flag"/></svg>${ar(rs.length)}</span><span><svg class="ico"><use href="#i-sword"/></svg>${num(p)}</span><span><svg class="ico"><use href="#i-coins"/></svg>${num(t.money)}</span></small>
      </li>`;
    }).join('');
  }
  function renderAll(pop = []) {
    if (!G) return;
    renderTurnbar(); renderActions(); renderHint(); renderRegionCard(); renderStandings();
    renderLabels(pop); refreshMap();
  }

  // أخبار الحملة: أحداث أو نصائح متناوبة
  let newsTimer = 0, tipIdx = (Math.random() * TIPS.length) | 0;
  function news(text) {
    const p = $('#newsText');
    p.textContent = text; p.classList.remove('in'); void p.offsetWidth; p.classList.add('in');
    clearTimeout(newsTimer); newsTimer = setTimeout(() => rotateNews(), 14000);
  }
  function rotateNews(now) {
    clearTimeout(newsTimer);
    const go = () => { const p = $('#newsText'); p.textContent = TIPS[tipIdx++ % TIPS.length]; p.classList.remove('in'); void p.offsetWidth; p.classList.add('in'); newsTimer = setTimeout(go, 12000); };
    now ? go() : (newsTimer = setTimeout(go, 6000));
  }

  // =========================================================
  // النهاية والنقاط
  // =========================================================
  function scoreOf(i) {
    const t = G.teams[i], rs = regionsOf(i);
    const p = rs.reduce((s, r) => s + power(r) + (r.wall ? R.wallScore : 0), 0);
    return { regions: rs.length, power: p, money: t.money, total: rs.length * 100 + (t.capital ? 100 : 0) + p + Math.floor(t.money / 10) };
  }
  function endGame(reason) {
    G.phase = 'over'; G.battle = null; save();
    UI.mode = null;
    const rows = G.teams.map((t, i) => ({ i, t, ...scoreOf(i) }));
    rows.sort((a, b) => (b.t.alive - a.t.alive) || (b.total - a.total));
    let winners;
    if (reason === 'conquest') winners = rows.filter((r) => r.t.alive).slice(0, 1);
    else winners = rows.filter((r) => r.total === rows[0].total);
    const w = winners[0].t;
    $('#endKicker').textContent = reason === 'conquest' ? 'سيطر على الميدان' : reason === 'time' ? 'انتهت مدة الحملة' : 'انتهت الحملة';
    $('#endTitle').textContent = winners.length > 1 ? 'تعادل: ' + winners.map((r) => 'فريق ' + r.t.name).join(' و') : `الفوز لفريق ${w.name}`;
    $('#endReason').textContent = reason === 'conquest' ? 'بقي وحده في الميدان بعد خروج كل الفرق.' : 'الفائز صاحب أعلى نقاط.';
    $('.end-hero').style.setProperty('--wc', w.color);
    $('#scoreBody').innerHTML = rows.map((r) => `<tr class="${winners.includes(r) ? 'win' : ''}" style="--c:${r.t.color}">
      <td><i></i>${esc(r.t.name)}${r.t.alive ? '' : ' <small class="muted">(خرج)</small>'}</td><td>${ar(r.regions)}</td><td>${num(r.power)}</td><td>${num(r.money)}</td><td>${num(r.total)}</td></tr>`).join('');
    show('screen-end');
    store.del(KEY_SAVE);
    setTimeout(() => { SFX.win(); confetti(winners.map((r) => r.t.color)); }, 350);
  }

  // =========================================================
  // الربط
  // =========================================================
  function onAction(a) {
    if (!G || G.phase !== 'play') return;
    SFX.click();
    if (a === 'end') { if (UI.mode && UI.mode !== 'capital') setMode(null); endTurn(); return; }
    if (a === 'market') { setMode(null); openMarket(); return; }
    if (a === 'charge') { setMode(null); openCharge(); return; }
    // تبديل الوضع
    if (UI.mode && UI.mode.startsWith(a + '-')) { setMode(null); return; }
    UI.mode = a + '-src'; UI.src = null;
    const tg = targets();
    if (!tg.length) {
      UI.mode = null;
      toast(a === 'attack' ? 'ما عندك إقليم يقدر يهاجم: يحتاج ٤ كتائب ويجاور عدوًا' : a === 'occupy' ? 'ما فيه أرض بلا صاحب تجاور إقليمًا فيه كتيبتان أو أكثر' : 'ما عندك قوات تقدر تنقلها بين أقاليم متصلة', 'bad');
      renderAll(); return;
    }
    // نقطة انطلاق واحدة: نختارها مباشرة
    if (tg.length === 1) { setMode(a + '-dst', tg[0]); return; }
    setMode(a + '-src');
  }

  function init() {
    // الثيمات والصوت
    $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); S.tongue(0, 0.2); }));
    setTheme(document.documentElement.dataset.theme);
    const sb = $('#soundBtn');
    sb.setAttribute('aria-pressed', String(S.on));
    sb.addEventListener('click', () => sb.setAttribute('aria-pressed', String(S.toggle())));
    // الهيرو بلا حركة عند تقليل الحركة
    if (reduced) $$('animate').forEach((a) => a.remove());

    // البداية
    const saved = store.get(KEY_SAVE, null);
    if (saved && saved.v === 1 && saved.phase !== 'over') {
      $('#resumeBtn').hidden = false; $('#resumeNote').hidden = false;
      $('#resumeNote').textContent = `حملة محفوظة: ${saved.phase === 'capitals' ? 'اختيار العواصم' : 'الأسبوع ' + ar(saved.week)} · ${ar(saved.teams.length)} فرق (${saved.teams.map((t) => t.name).join('، ')})`;
    }
    $('#newBtn').onclick = async () => {
      SFX.click();
      if (store.get(KEY_SAVE, null) && !(await confirmBox('حملة جديدة؟', 'فيه حملة محفوظة… بدء حملة جديدة يمسحها.', 'نعم، حملة جديدة', 'لا'))) return;
      renderSetup(); show('screen-setup');
    };
    $('#resumeBtn').onclick = () => {
      SFX.click();
      G = store.get(KEY_SAVE, null);
      if (!G) return;
      G.settings.cats = (G.settings.cats || []).filter((id) => QB.cats.some((c) => c.id === id));
      if (!G.settings.cats.length) G.settings.cats = QB.cats.map((c) => c.id);
      if (!G.settings.levels) G.settings.levels = [0, 1, 2];
      enterGame();
      if (G.phase === 'capitals') setMode('capital');
      else if (team().needCap && regionsOf(G.turn).length) setMode('capital');
      if (G.battle) openBattle();
    };
    $$('[data-go]').forEach((b) => b.addEventListener('click', () => { SFX.click(); show(b.dataset.go); }));
    segInit('optWeeks', 'weeks'); segInit('optTimer', 'timer'); segInit('optCharge', 'charge'); segInit('optCapitals', 'capitals', String);
    $('#startBtn').onclick = () => { SFX.click(); newGame(); };
    $('#rulesBtn').onclick = $('#rulesBtn2').onclick = () => { SFX.click(); openModal('rulesModal'); };

    // الحملة
    $$('.act').forEach((b) => b.addEventListener('click', () => onAction(b.dataset.act)));
    $('#cancelMode').onclick = () => { SFX.click(); setMode(null); };
    $('#quitBtn').onclick = async () => {
      if (await confirmBox('إنهاء الحملة؟', 'تنتهي الحملة الآن ويُحسب الفائز بالنقاط.', 'نعم، احسب النقاط', 'لا')) endGame('quit');
    };
    $('#againBtn').onclick = () => { SFX.click(); renderSetup(); show('screen-setup'); };
    $('#mapBackBtn').onclick = () => { SFX.click(); show('screen-game'); renderAll(); };

    // إغلاق النوافذ
    $$('[data-close]').forEach((b) => b.addEventListener('click', () => { b.closest('.modal').hidden = true; }));
    $$('.modal').forEach((m) => m.addEventListener('click', (e) => {
      if (e.target === m && ['qtyModal', 'marketModal', 'rulesModal'].includes(m.id)) m.hidden = true;
    }));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = ['qtyModal', 'marketModal', 'rulesModal'].find((id) => !$('#' + id).hidden);
      if (open) { closeModal(open); return; }
      if (UI.mode && UI.mode !== 'capital' && $('#battle').hidden) setMode(null);
    });
    // تحديث السوق بعد الإغلاق
    const mm = $('#marketModal');
    new MutationObserver(() => { if (mm.hidden && G) renderAll(); }).observe(mm, { attributes: true, attributeFilter: ['hidden'] });
  }

  init();
})();
