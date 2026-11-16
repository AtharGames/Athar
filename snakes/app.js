/* =========================================================
   السلم والثعبان | منطق اللعبة
   القواعد: نرد، سلالم ترفع، ثعابين تنزّل، وأول من يصل ١٠٠ يفوز
   ========================================================= */
(() => {
  'use strict';

  // ---------- أدوات مساعدة ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const num = (n) => Number(n).toLocaleString('ar-EG');
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const S = window.AtharSound;
  const NS = 'http://www.w3.org/2000/svg';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } }
  };

  // عنصر SVG بخصائصه
  function svg(tag, attrs = {}, parent = null) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.append(n);
    return n;
  }

  // ---------- ثوابت اللعب ----------
  const LAST = 100;
  const MIN_TEAMS = 2, MAX_TEAMS = 4;
  const THEMES = ['light', 'navy', 'blue'];
  const SAVE_KEY = 'snakes-save', SKIN_KEY = 'snakes-skin';
  const STEP_MS = 190;          // زمن القفزة بين مربعين
  const SLIDE_MS = 850;         // زمن طلوع السلم أو نزول الثعبان

  const TEAM_THEMES = [
    { c: '#E8554E', name: 'الفريق الأحمر' },
    { c: '#E59A1C', name: 'الفريق الذهبي' },
    { c: '#1FA971', name: 'الفريق الأخضر' },
    { c: '#8257E5', name: 'الفريق البنفسجي' }
  ];

  // أشكال اللوحة (الألوان الفعلية في style.css، وهنا عيّنة للمعاينة)
  const SKINS = [
    { id: 'classic', name: 'الكلاسيكية', sw: ['#E5484D', '#F2C230', '#2FA862', '#3B82F6'], frame: '#13295A' },
    { id: 'wood',    name: 'الخشبية',    sw: ['#EBCB98', '#C99A5E', '#C99A5E', '#EBCB98'], frame: '#5A341A' },
    { id: 'jungle',  name: 'الغابة',     sw: ['#DDEFB9', '#8FCB7B', '#8FCB7B', '#DDEFB9'], frame: '#1E5631' },
    { id: 'desert',  name: 'الصحراء',    sw: ['#F8E7BC', '#EBC380', '#EBC380', '#F8E7BC'], frame: '#A4532B' },
    { id: 'athar',   name: 'أثَر',        sw: ['#F3F9FF', '#BFE3FC', '#BFE3FC', '#F3F9FF'], frame: '#0A2463' }
  ];

  // توزيعات السلالم والثعابين (السلم: من الأسفل للأعلى، الثعبان: من الرأس للذيل)
  const LAYOUTS = [
    {
      id: 'original', name: 'الأصلية',
      ladders: { 4: 25, 11: 30, 20: 59, 34: 53, 37: 84, 63: 81 },
      snakes:  { 27: 1, 53: 12, 57: 24, 72: 51, 88: 46, 95: 75, 98: 79 }
    },
    {
      id: 'quick', name: 'على السريع', note: 'سلالم أكثر… توصلون بسرعة',
      ladders: { 3: 24, 8: 32, 15: 36, 21: 42, 29: 51, 46: 67, 58: 77, 61: 82, 70: 89, 74: 95 },
      snakes:  { 34: 6, 49: 11, 63: 39, 87: 55, 97: 65 }
    },
    {
      id: 'long', name: 'لأهل النفَس الطويل', note: 'ثعابين أكثر… الله يعينكم',
      ladders: { 6: 27, 19: 38, 33: 52, 45: 64, 60: 79 },
      snakes:  { 17: 4, 30: 9, 41: 20, 49: 11, 56: 35, 68: 47, 74: 53, 86: 58, 91: 70, 96: 62, 99: 80 }
    }
  ];

  // ألوان الثعابين: [الجسم، النقوش]
  const SNAKE_COLORS = [
    ['#43A952', '#1E6B2D'], ['#E2803D', '#97461A'], ['#8F5FD3', '#573092'],
    ['#1F9FAD', '#0D5C66'], ['#D94A55', '#8B1F29'], ['#C7A52B', '#77600F'],
    ['#5E82B8', '#30497A'], ['#6FB23C', '#3C6B14'], ['#B5578F', '#70285A'],
    ['#4AA58A', '#1D6450'], ['#A8703F', '#643C17']
  ];

  // ---------- العبارات العفوية ----------
  const T = {
    turn: ['دور فريق الطحاطيح {t}', 'دور الأساطير {t}', 'يله دوركم {t}'],
    turnSub: ['ارموا النرد وورّونا حظكم', 'فرصتكم… لا تضيّعونها', 'ورّونا شطارتكم'],
    ladder: ['كفو يا {t}!', 'يا سلام عليكم يا {t}!', 'ما شاء الله عليكم يا {t}!', 'عداكم العيب يا {t}!', 'ضربة معلّم يا {t}!'],
    snake: ['أفا يا {t}!', 'يا ساتر يا {t}!', 'راحت عليكم يا {t}!'],
    snakeTail: ['معليش، الجايات أكثر', 'ركّزوا شوي!', 'الثعبان ما يرحم'],
    winKicker: ['الفائز بلا منازع', 'الفااائز ويستاهل', 'مبروك يا وحوش!', 'هذي الهيبة!', 'ما قصّرتوا يا أبطال!'],
  };
  const say = (arr, name) => pick(arr).replace('{t}', name);

  const ICONS = {
    ok:   '<svg viewBox="0 0 24 24"><path d="M7 21V3M17 21V3M7 7h10M7 12h10M7 17h10"/></svg>',
    bad:  '<svg viewBox="0 0 24 24"><path d="M5 6c4-3 6 3 10 0s4 4 0 6-8 1-8 5 6 3 10 1"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17v.5"/><circle cx="12" cy="12" r="9.5" stroke-width="2"/></svg>'
  };

  // ---------- الإعدادات ----------
  const cfg = {
    count: 4,
    names: TEAM_THEMES.map((t) => t.name),
    skin: store.get(SKIN_KEY, 'classic'),
    layout: 'original'
  };
  if (!SKINS.some((s) => s.id === cfg.skin)) cfg.skin = 'classic';

  // ---------- حالة اللعب ----------
  let teams = [], cur = 0, busy = false, turnTitle = '', turnSub = '';
  let ladders = {}, snakes = {};

  const el = {
    soundBtn: $('#soundBtn'), counts: $('#counts'), teamInputs: $('#teamInputs'),
    skins: $('#skins'), layouts: $('#layouts'), skinDots: $('#skinDots'),
    frame: $('#boardFrame'), tiles: $('#tiles'), decor: $('#decor'), pawns: $('#pawns'),
    turnPanel: $('#turnPanel'), turnChip: $('#turnChip'), turnTitle: $('#turnTitle'), turnSub: $('#turnSub'),
    dice: $('#dice'), diceResult: $('#diceResult'), rollBtn: $('#rollBtn'), nextBtn: $('#nextBtn'),
    standings: $('#standings'), manualHint: $('#manualHint'), manualForm: $('#manualForm'), manualInput: $('#manualInput'),
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

  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  // رسالة بزر واحد، وبعد إغلاقها يُنفَّذ after إن وُجد
  let modalAfter = null;
  function info({ title, text, icon = 'info', tone = '' }, after) {
    el.modalTitle.textContent = title;
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
  function ask({ title, text, yes }, onYes) {
    el.confirmTitle.textContent = title;
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
  // شاشة التجهيز
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

  // عيّنة مصغّرة لشكل اللوحة
  function swatch(skin) {
    const s = document.createElement('span');
    s.className = 'swatch';
    s.style.setProperty('--f', skin.frame);
    skin.sw.forEach((c) => { const i = document.createElement('i'); i.style.background = c; s.append(i); });
    return s;
  }

  function renderSkins() {
    el.skins.innerHTML = '';
    el.skinDots.innerHTML = '';
    SKINS.forEach((skin) => {
      // بطاقة في شاشة التجهيز
      const card = document.createElement('button');
      card.className = 'skin-card';
      card.setAttribute('aria-pressed', String(skin.id === cfg.skin));
      const name = document.createElement('span');
      name.textContent = skin.name;
      card.append(swatch(skin), name);
      card.addEventListener('click', () => setSkin(skin.id));
      el.skins.append(card);

      // زر صغير تحت اللوحة أثناء اللعب
      const dot = document.createElement('button');
      dot.className = 'skin-dot';
      dot.title = skin.name;
      dot.setAttribute('aria-label', `شكل اللوحة: ${skin.name}`);
      dot.setAttribute('aria-pressed', String(skin.id === cfg.skin));
      dot.append(swatch(skin));
      dot.addEventListener('click', () => setSkin(skin.id));
      el.skinDots.append(dot);
    });
  }

  function setSkin(id, silent = false) {
    cfg.skin = id;
    store.set(SKIN_KEY, id);
    el.frame.dataset.skin = id;
    renderSkins();
    if (!silent) S.tongue(0, 0.2);
  }

  function renderLayouts() {
    el.layouts.innerHTML = '';
    LAYOUTS.forEach((lay) => {
      const b = document.createElement('button');
      b.className = 'layout-card';
      b.setAttribute('aria-pressed', String(lay.id === cfg.layout));
      const nL = Object.keys(lay.ladders).length, nS = Object.keys(lay.snakes).length;
      const strong = document.createElement('strong');
      strong.textContent = lay.name;
      const small = document.createElement('small');
      small.textContent = `${num(nL)} سلالم و${num(nS)} ثعابين` + (lay.note ? ` · ${lay.note}` : '');
      b.append(strong, small);
      b.addEventListener('click', () => { cfg.layout = lay.id; S.tongue(0, 0.2); renderLayouts(); });
      el.layouts.append(b);
    });
  }

  // =========================================================
  // رسم اللوحة
  // =========================================================
  // مركز المربع: المربع ١ أسفل اليمين، والصفوف تتعرّج صعودًا
  function center(n) {
    const row = Math.floor((n - 1) / 10), idx = (n - 1) % 10;
    const col = row % 2 === 0 ? idx : 9 - idx;      // العمود من اليمين
    return { x: 1000 - (col + 0.5) * 100, y: 1000 - (row + 0.5) * 100, row, col };
  }

  function drawTiles() {
    el.tiles.innerHTML = '';
    for (let n = 1; n <= LAST; n++) {
      const c = center(n), x = c.x - 50, y = c.y - 50;
      const g = svg('g', {}, el.tiles);
      svg('rect', { x, y, width: 100, height: 100, class: `tile k${(c.row + c.col) % 5} ${(c.row + c.col) % 2 ? 'b' : 'a'}` }, g);
      svg('rect', { x, y, width: 100, height: 100, fill: 'url(#tileShade)' }, g);
      svg('rect', { x: x + 0.75, y: y + 0.75, width: 98.5, height: 98.5, class: 'tile-edge' }, g);
      const t = svg('text', { x: x + 76, y: y + 30, class: 'tile-num', 'text-anchor': 'middle' }, g);
      t.textContent = num(n);
      if (n === 1 || n === LAST) {
        const tag = svg('text', { x: c.x, y: y + 88, class: 'tile-tag', 'text-anchor': 'middle' }, g);
        tag.textContent = n === 1 ? 'البداية' : 'النهاية';
      }
    }
  }

  function drawLadder(from, to) {
    const a = center(from), b = center(to);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const gap = 17, ext = 20;
    const g = svg('g', { class: 'ladder' }, el.decor);
    // الدرجات
    for (let d = 8; d <= L - 8; d += 36) {
      const px = a.x + ux * d, py = a.y + uy * d;
      svg('line', { x1: px + nx * gap, y1: py + ny * gap, x2: px - nx * gap, y2: py - ny * gap, class: 'rung' }, g);
    }
    // القائمان مع لمعة
    [1, -1].forEach((s) => {
      const p = {
        x1: a.x - ux * ext + nx * gap * s, y1: a.y - uy * ext + ny * gap * s,
        x2: b.x + ux * ext + nx * gap * s, y2: b.y + uy * ext + ny * gap * s
      };
      svg('line', { ...p, class: 'rail' }, g);
      svg('line', { ...p, class: 'rail-hi' }, g);
    });
  }

  function drawSnake(headN, tailN, i) {
    const h = center(headN), t = center(tailN);
    const dx = t.x - h.x, dy = t.y - h.y, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const waves = Math.max(2, Math.round(L / 150));
    const amp = Math.min(34, 14 + L * 0.05) * (i % 2 ? 1 : -1);
    const N = Math.max(24, Math.round(L / 9));
    const [body, dark] = SNAKE_COLORS[i % SNAKE_COLORS.length];

    // خط الوسط المتموّج
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const s = k / N, off = Math.sin(s * Math.PI * waves) * amp;
      pts.push({ x: h.x + dx * s + nx * off, y: h.y + dy * s + ny * off, w: 15 * (1 - 0.8 * s) + 2 });
    }
    // حواف الجسم (يضيق نحو الذيل)
    const left = [], right = [], belly = [];
    pts.forEach((p, k) => {
      const a = pts[Math.max(0, k - 1)], b = pts[Math.min(N, k + 1)];
      const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const px = -(b.y - a.y) / tl, py = (b.x - a.x) / tl;
      left.push(`${(p.x + px * p.w).toFixed(1)} ${(p.y + py * p.w).toFixed(1)}`);
      right.push(`${(p.x - px * p.w).toFixed(1)} ${(p.y - py * p.w).toFixed(1)}`);
      belly.push(`${(p.x - px * p.w * 0.45).toFixed(1)},${(p.y - py * p.w * 0.45).toFixed(1)}`);
      p.px = px; p.py = py;
    });

    const g = svg('g', { class: 'snake' }, el.decor);
    svg('path', { d: `M${left.join('L')}L${right.reverse().join('L')}Z`, fill: body, stroke: dark, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
    // نقوش الظهر
    for (let k = 3; k < N - 1; k += 3) {
      const p = pts[k];
      svg('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: (p.w * 0.5).toFixed(1), fill: dark, opacity: 0.6 }, g);
    }
    // لمعة جانبية
    svg('polyline', { points: belly.join(' '), fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.3 }, g);

    // الرأس متجه بعكس الجسم
    const ang = Math.atan2(pts[0].y - pts[2].y, pts[0].x - pts[2].x) * 180 / Math.PI;
    const head = svg('g', { transform: `translate(${h.x} ${h.y}) rotate(${ang.toFixed(1)})` }, g);
    svg('path', { d: 'M26 0H42M42 0l9-6M42 0l9 6', fill: 'none', stroke: '#D81E5B', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, head);
    svg('ellipse', { cx: 6, cy: 0, rx: 25, ry: 18, fill: body, stroke: dark, 'stroke-width': 2.5 }, head);
    svg('ellipse', { cx: -2, cy: 0, rx: 10, ry: 8, fill: dark, opacity: 0.45 }, head);
    [-9.5, 9.5].forEach((y) => {
      svg('circle', { cx: 13, cy: y, r: 6.5, fill: '#fff', stroke: dark, 'stroke-width': 1.5 }, head);
      svg('circle', { cx: 15, cy: y, r: 3.2, fill: '#111' }, head);
    });
  }

  function drawDecor() {
    el.decor.innerHTML = '';
    Object.entries(ladders).forEach(([a, b]) => drawLadder(+a, b));
    Object.entries(snakes).forEach(([a, b], i) => drawSnake(+a, b, i));
  }

  // ---------- القطع ----------
  const SLOTS = [[-23, -15], [23, -15], [-23, 20], [23, 20]];

  function buildPawns() {
    el.pawns.innerHTML = '';
    teams.forEach((t, i) => {
      const g = svg('g', { class: 'pawn' }, el.pawns);
      const b = svg('g', { class: 'pawn-body', filter: 'url(#pawnShadow)' }, g);
      const shape = 'M-21 20Q-24 31 0 31Q24 31 21 20L9-5H-9Z';
      svg('path', { d: shape, fill: t.color }, b);
      svg('circle', { cx: 0, cy: -15, r: 14, fill: t.color }, b);
      svg('path', { d: shape, fill: 'url(#pawnShine)' }, b);
      svg('circle', { cx: 0, cy: -15, r: 14, fill: 'url(#pawnShine)' }, b);
      svg('path', { d: shape, class: 'pawn-line' }, b);
      svg('circle', { cx: 0, cy: -15, r: 14, class: 'pawn-line' }, b);
      const tx = svg('text', { x: 0, y: 24, class: 'pawn-num', 'text-anchor': 'middle' }, b);
      tx.textContent = num(i + 1);
      t.el = g;
    });
  }

  // وضع القطع في مربعاتها (تتوزّع إن اجتمع أكثر من فريق في مربع)
  function placePawns(ms = 0) {
    teams.forEach((t, i) => {
      const c = center(t.pos);
      const shared = teams.some((o) => o !== t && o.pos === t.pos);
      const [ox, oy] = shared ? SLOTS[i] : [0, 0];
      t.el.style.transitionDuration = `${reducedMotion() ? 0 : ms}ms`;
      t.el.style.transform = `translate(${c.x + ox}px, ${c.y + oy}px) scale(${shared ? 0.74 : 1})`;
      t.el.classList.toggle('active', i === cur);
    });
    // صاحب الدور فوق الجميع
    if (teams[cur]) el.pawns.append(teams[cur].el);
  }

  // ---------- النرد ثلاثي الأبعاد ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const FACE_ROT = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };
  let spin = 0;

  function buildDice() {
    el.dice.innerHTML = '';
    for (let f = 1; f <= 6; f++) {
      const face = document.createElement('div');
      face.className = `face f${f}`;
      for (let k = 0; k < 9; k++) {
        const i = document.createElement('i');
        if (PIPS[f].includes(k)) i.className = 'pip';
        face.append(i);
      }
      el.dice.append(face);
    }
    showDice(1, false);
  }

  function showDice(f, roll = true) {
    if (roll) spin += 720;
    const [rx, ry] = FACE_ROT[f];
    el.dice.style.transform = `rotateX(${spin + rx}deg) rotateY(${spin + ry}deg)`;
  }

  // =========================================================
  // اللعب
  // =========================================================
  function applyLayout() {
    const lay = LAYOUTS.find((l) => l.id === cfg.layout) || LAYOUTS[0];
    cfg.layout = lay.id;
    ladders = lay.ladders; snakes = lay.snakes;
  }

  function newTurnText() {
    const name = teams[cur].name;
    turnTitle = say(T.turn, name);
    turnSub = pick(T.turnSub);
  }

  function startGame() {
    teams = Array.from({ length: cfg.count }, (_, i) => ({
      name: (cfg.names[i] || '').trim() || TEAM_THEMES[i].name,
      color: TEAM_THEMES[i].c, pos: 1
    }));
    cur = 0;
    enterGame();
    el.diceResult.textContent = '';
    S.whoosh(true);
    save();
  }

  // دخول شاشة اللعب (بداية جديدة أو استكمال محفوظ)
  function enterGame() {
    busy = false;
    cancelAnimationFrame(confettiRaf);
    applyLayout();
    el.frame.dataset.skin = cfg.skin;
    drawTiles();
    drawDecor();
    buildPawns();
    newTurnText();
    show('screen-game');
    placePawns(0);
    render();
  }

  function render() {
    const t = teams[cur];
    el.turnPanel.style.setProperty('--c', t.color);
    el.turnChip.textContent = num(cur + 1);
    el.turnTitle.textContent = turnTitle;
    el.turnSub.textContent = turnSub;
    el.manualHint.textContent = `اكتبوا رقم المربع (من ١ إلى ١٠٠) وننقل ${t.name} له على طول.`;
    el.rollBtn.disabled = el.nextBtn.disabled = busy;

    el.standings.innerHTML = '';
    teams.forEach((tm, i) => {
      const r = document.createElement('div');
      r.className = 'stand' + (i === cur ? ' on' : '');
      r.style.setProperty('--c', tm.color);
      r.style.setProperty('--p', `${tm.pos}%`);
      r.innerHTML = '<span class="stand-no"></span><span class="stand-name"></span><span class="stand-pos"></span><i class="stand-bar"></i>';
      $('.stand-no', r).textContent = num(i + 1);
      $('.stand-name', r).textContent = tm.name;
      $('.stand-pos', r).textContent = `مربع ${num(tm.pos)}`;
      el.standings.append(r);
    });
  }

  function save() {
    store.set(SAVE_KEY, JSON.stringify({
      v: 1, layout: cfg.layout, cur,
      teams: teams.map((t) => ({ name: t.name, pos: t.pos }))
    }));
  }

  // استكمال لعبة محفوظة إن وُجدت
  function loadSave() {
    try {
      const d = JSON.parse(store.get(SAVE_KEY, 'null'));
      if (!d || !Array.isArray(d.teams) || d.teams.length < MIN_TEAMS || d.teams.length > MAX_TEAMS) return false;
      teams = d.teams.map((t, i) => ({
        name: String(t.name || TEAM_THEMES[i].name).slice(0, 20),
        color: TEAM_THEMES[i].c,
        pos: Math.min(LAST, Math.max(1, parseInt(t.pos, 10) || 1))
      }));
      if (teams.some((t) => t.pos === LAST)) return false;
      cfg.count = teams.length;
      teams.forEach((t, i) => { cfg.names[i] = t.name; });
      cfg.layout = d.layout;
      cur = Math.min(teams.length - 1, Math.max(0, parseInt(d.cur, 10) || 0));
      return true;
    } catch { return false; }
  }

  // رمي النرد ثم المشي
  async function roll() {
    if (busy) return;
    busy = true; render();
    const n = Math.floor(Math.random() * 6) + 1;
    const spinMs = reducedMotion() ? 0 : 950;
    el.diceResult.textContent = '…';
    showDice(n);
    // خشخشة النرد بنقرات لسان
    [0, 0.11, 0.24, 0.4, 0.58, 0.78].forEach((d) => S.tongue(d, 0.2));
    await sleep(spinMs);
    S.drop(520);
    el.diceResult.textContent = `طلع لكم ${num(n)}`;
    await sleep(250);
    await walk(teams[cur], n);
    await resolve(teams[cur]);
  }

  // المشي مربعًا مربعًا (ما يتعدّى ١٠٠)
  async function walk(team, steps) {
    const target = Math.min(LAST, team.pos + steps);
    while (team.pos < target) {
      team.pos++;
      placePawns(STEP_MS - 30);
      S.tongue(0, 0.16);
      await sleep(reducedMotion() ? 0 : STEP_MS);
    }
  }

  // تطبيق أثر المربع: فوز، سلم، أو ثعبان
  async function resolve(team) {
    const from = team.pos;
    if (from === LAST) { finish(team); return; }

    if (ladders[from] || snakes[from]) {
      const up = Boolean(ladders[from]);
      await sleep(280);
      team.pos = up ? ladders[from] : snakes[from];
      if (up) { S.whoosh(true); S.chirp(0.3); } else { S.whoosh(false); S.sigh(0.35); }
      placePawns(SLIDE_MS);
      await sleep(reducedMotion() ? 0 : SLIDE_MS + 80);
      save();
      if (team.pos === LAST) { finish(team); return; }
      busy = false; render();
      info(up
        ? { title: say(T.ladder, team.name), text: `لقيتوا سلّم! طلعتوا من المربع ${num(from)} إلى المربع ${num(team.pos)}.`, icon: 'ok', tone: 'ok' }
        : { title: say(T.snake, team.name), text: `لدغكم الثعبان ونزلتوا من المربع ${num(from)} إلى المربع ${num(team.pos)}. ${pick(T.snakeTail)}`, icon: 'bad', tone: 'bad' });
      return;
    }
    save();
    busy = false; render();
  }

  function nextTurn() {
    if (busy) return;
    cur = (cur + 1) % teams.length;
    newTurnText();
    el.diceResult.textContent = '';
    S.drop(380);
    placePawns(200);
    render();
    save();
  }

  // النقل اليدوي للفريق صاحب الدور
  async function manualMove() {
    if (busy) return;
    const raw = el.manualInput.value.trim()
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    const v = /^\d{1,3}$/.test(raw) ? parseInt(raw, 10) : NaN;
    if (!(v >= 1 && v <= LAST)) {
      S.sigh();
      info({ title: 'على هونك!', text: 'اكتب رقم مربع من ١ إلى ١٠٠.', icon: 'info' });
      return;
    }
    el.manualInput.value = '';
    el.manualInput.blur();
    busy = true; render();
    teams[cur].pos = v;
    S.whoosh(true);
    placePawns(600);
    await sleep(reducedMotion() ? 0 : 650);
    await resolve(teams[cur]);
  }

  // =========================================================
  // النهاية
  // =========================================================
  let confettiRaf = 0;

  async function finish(winner) {
    store.del(SAVE_KEY);
    await sleep(reducedMotion() ? 0 : 600);
    busy = false;
    const sorted = [...teams].sort((a, b) => b.pos - a.pos);

    el.trophy.style.setProperty('--win', winner.color);
    el.winnerName.style.setProperty('--win', winner.color);
    el.victoryKicker.textContent = pick(T.winKicker);
    el.winnerName.textContent = winner.name;
    el.winnerText.textContent = `كفو والله يا ${winner.name}! وصلتوا المربع ١٠٠ وتستاهلون.`;

    el.finalBoard.innerHTML = '';
    sorted.forEach((t, i) => {
      const r = document.createElement('div');
      r.className = 'final-row' + (t === winner ? ' win' : '');
      r.style.setProperty('--c', t.color);
      r.style.animationDelay = `${0.15 * i + 0.4}s`;
      r.innerHTML = '<span class="final-rank"></span><span class="final-name"></span><span class="final-pts"></span>';
      $('.final-rank', r).textContent = num(i + 1);
      $('.final-name', r).textContent = t.name;
      $('.final-pts', r).textContent = `مربع ${num(t.pos)}`;
      el.finalBoard.append(r);
    });

    show('screen-victory');
    // انبثاق + هتاف جمهور + تصفيق
    S.winner();
    confetti([winner.color]);
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

  // الرجوع لشاشة التجهيز
  function toSetup() {
    cancelAnimationFrame(confettiRaf);
    store.del(SAVE_KEY);
    renderCounts(); renderTeamInputs(); renderLayouts();
    show('screen-setup');
  }

  // =========================================================
  // ربط الأحداث
  // =========================================================
  $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); S.tongue(0, 0.2); }));
  setTheme(document.documentElement.dataset.theme);

  el.soundBtn.setAttribute('aria-pressed', String(S.on));
  el.soundBtn.addEventListener('click', () => el.soundBtn.setAttribute('aria-pressed', String(S.toggle())));

  $('#startBtn').addEventListener('click', startGame);
  el.rollBtn.addEventListener('click', roll);
  el.nextBtn.addEventListener('click', nextTurn);
  el.manualForm.addEventListener('submit', (e) => { e.preventDefault(); manualMove(); });

  $('#restartBtn').addEventListener('click', () => {
    if (busy) return;
    S.tongue(0, 0.2);
    ask({ title: 'تبي تهدم كل شي وتبدأ من جديد؟', text: 'كل الفرق بترجع للمربع ١.', yes: 'إيه، من جديد' }, startGame);
  });
  $('#exitBtn').addEventListener('click', () => {
    if (busy) return;
    S.tongue(0, 0.2);
    ask({ title: 'تبي تطلع من اللعبة يا معلم؟', text: 'اللعبة الحالية بتروح عليكم.', yes: 'إيه، طلّعني' }, () => { S.whoosh(false); toSetup(); });
  });
  $('#againBtn').addEventListener('click', startGame);
  $('#changeTeamsBtn').addEventListener('click', () => { S.tongue(0, 0.2); toSetup(); });

  el.modalOk.addEventListener('click', closeInfo);
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closeInfo(); });
  el.confirmYes.addEventListener('click', () => closeAsk(true));
  el.confirmNo.addEventListener('click', () => closeAsk(false));
  el.confirm.addEventListener('click', (e) => { if (e.target === el.confirm) closeAsk(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeAsk(false); closeInfo(); } });

  // ---------- تهيئة أولى ----------
  buildDice();
  renderCounts();
  renderTeamInputs();
  renderSkins();
  renderLayouts();
  setSkin(cfg.skin, true);
  if (loadSave()) enterGame();
})();
