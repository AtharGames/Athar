/* =========================================================
   ترابيع | منطق اللعبة
   ========================================================= */
(() => {
  'use strict';

  // ---------- أدوات مساعدة ----------
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const num  = (n) => Number(n).toLocaleString('ar-EG');
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // تخزين آمن (قد لا يتوفر localStorage في بعض البيئات)
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } }
  };

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- ثوابت ----------
  const THEMES  = ['light', 'navy', 'blue'];
  const PALETTE = [
    { c: '#E8554E', n: 'مرجاني' },
    { c: '#E59A1C', n: 'عنبري' },
    { c: '#1FA971', n: 'زمردي' },
    { c: '#8257E5', n: 'بنفسجي' },
    { c: '#E0559B', n: 'وردي' },
    { c: '#0FA3B1', n: 'فيروزي' }
  ];
  const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن'];
  const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
  const MIN_SIZE = 3, MAX_SIZE = 14, MAX_TEAMS = PALETTE.length;

  // نصوص عفوية
  const TXT = {
    capture: ['كفو يا {t}!', 'يا سلام عليكم يا {t}!', 'ضربة معلّم يا {t}!', 'ما شاء الله عليكم يا {t}!', 'هذا الشغل يا {t}!'],
    steal:   ['سرقة عيني عينك! {t} خذوا {n} من {v}', 'يا ساتر! {t} شالوا {n} من {v}', '{v}، ودّعوا {n} من مربعاتكم… خذوها {t}'],
    skip:    ['راحت عليكم يا {t}! الدور لـ {x}', 'معليش يا {t}، الجايات أكثر. الدور لـ {x}', 'يا {t} ركّزوا شوي! الدور لـ {x}'],
    hints:   ['جاوبوا صح… واختاروا مربعكم', 'ورّونا شطارتكم', 'السؤال عليكم، ركّزوا', 'فرصتكم… لا تضيّعونها'],
    blocked: ['على هونك! هذا مربع {v}. اختاروا مربع فاضي أو جنبه', 'لا لا، مربع {v} ما ينلمس مباشرة… اختاروا جنبه', 'ممنوع يا محترم! مربعات {v} تنسرق من الجنب بس'],
    win:     ['مبروك يا وحوش!', 'كفو والله، تستاهلون!', 'هذي الهيبة!', 'ما قصّرتوا يا أبطال!']
  };
  const fill = (s, o) => s.replace(/\{(\w)\}/g, (_, k) => o[k]);

  // =========================================================
  // الثيم
  // =========================================================
  function setTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    document.documentElement.dataset.theme = t;
    store.set('athar-theme', t);
    $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  }

  // =========================================================
  // الصوت: مؤثرات من الطبيعة ومن الفم فقط
  // بلا موسيقى ولا آلات، تُولَّد داخل المتصفح بلا ملفات صوتية
  // =========================================================
  const Sound = (() => {
    let ctx = null, master = null, noiseBuf = null;
    let on = store.get('tarabee-sound', '1') === '1';

    function ac() {
      if (!on) return null;
      try {
        if (!ctx) {
          const C = window.AudioContext || window.webkitAudioContext;
          if (!C) return null;
          ctx = new C();
          // ضاغط عام يمنع التشويش عند تداخل الأصوات
          master = ctx.createDynamicsCompressor();
          master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
      } catch { return null; }
    }

    function noise(c) {
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource();
      s.buffer = noiseBuf; s.loop = true;
      return s;
    }

    // هواء مفلتر: أساس النَّفَس والريح والهمس
    function air(t, { dur, vol, f0, f1 = f0, q = 1, atk = 0.005, type = 'bandpass' }) {
      const c = ctx;
      const s = noise(c), f = c.createBiquadFilter(), g = c.createGain();
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(master);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }

    // نقرة لسان «تك»
    function tongue(delay = 0, vol = 0.3) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      air(t, { dur: 0.03, vol, f0: 2300, q: 4, atk: 0.001 });
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(650, t + 0.03);
      g.gain.setValueAtTime(vol * 0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.06);
    }

    // قطرة ماء «بلوب»
    function drop(freq, delay = 0, vol = 0.24) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 2.6, t + 0.08);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.16);
    }

    // زقزقة عصفور
    function chirp(delay = 0, base = 3000) {
      const c = ac(); if (!c) return;
      for (let k = 0; k < 3; k++) {
        const t = c.currentTime + delay + k * 0.09;
        const o = c.createOscillator(), g = c.createGain();
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.6, t + 0.05);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.08, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(g).connect(master); o.start(t); o.stop(t + 0.08);
      }
    }

    // تنهيدة «هاااه»
    function sigh(delay = 0) {
      const c = ac(); if (!c) return;
      air(c.currentTime + delay, { dur: 0.75, vol: 0.22, f0: 1300, f1: 380, q: 0.8, atk: 0.09 });
    }

    // ريح تشتد تدريجياً أثناء العدّ، ترجع دالة الإيقاف
    function wind() {
      const c = ac(); if (!c) return () => {};
      const t = c.currentTime;
      const s = noise(c), f = c.createBiquadFilter(), gust = c.createGain(), out = c.createGain();
      f.type = 'bandpass'; f.Q.value = 1.6;
      f.frequency.setValueAtTime(280, t);
      f.frequency.exponentialRampToValueAtTime(1800, t + 4.5);
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.8; lg.gain.value = 0.35; gust.gain.value = 0.65;
      lfo.connect(lg).connect(gust.gain);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.3, t + 4.5);
      s.connect(f).connect(gust).connect(out).connect(master);
      s.start(); lfo.start();
      return () => {
        try {
          const n = c.currentTime;
          out.gain.cancelScheduledValues(n);
          out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), n);
          out.gain.exponentialRampToValueAtTime(0.0001, n + 0.15);
          s.stop(n + 0.2); lfo.stop(n + 0.2);
        } catch { /* تجاهل */ }
      };
    }

    return {
      get on() { return on; },
      toggle() { on = !on; store.set('tarabee-sound', on ? '1' : '0'); if (on) this.click(); return on; },
      click() { tongue(0, 0.22); },
      // احتلال: قطرات ماء متتابعة، والسرقة قطرات أثقل مع نقرة
      pop(i, stolen) {
        if (stolen) { drop(200 + i * 25, i * 0.07, 0.26); tongue(i * 0.07 + 0.02, 0.12); }
        else drop(480 + i * 90, i * 0.07);
      },
      // تجاوز الدور: «تسك تسك… هاه»
      skip() { tongue(0, 0.3); tongue(0.13, 0.3); sigh(0.3); },
      // تراجع: نَفَس خاطف للخلف
      undo() { const c = ac(); if (c) air(c.currentTime, { dur: 0.32, vol: 0.18, f0: 600, f1: 2200, q: 1.2, atk: 0.2 }); },
      tick() { tongue(0, 0.1); },
      wind,
      // لحظة الإعلان: هبّة ريح قوية
      release() { const c = ac(); if (c) air(c.currentTime, { dur: 0.85, vol: 0.35, f0: 2600, f1: 380, q: 0.8, atk: 0.02 }); },
      // فرحة الفوز: زقزقة عصافير
      celebrate() { chirp(0.4, 2800); chirp(0.9, 3400); chirp(1.4, 3000); chirp(2.0, 3600); chirp(2.6, 2900); },
      // محاولة غير مسموحة: «تسك» خفيفة
      nope() { tongue(0, 0.28); tongue(0.09, 0.2); },
      sigh
    };
  })();

  // =========================================================
  // واجهة عامة: شاشات، رسائل، تأكيد
  // =========================================================
  const el = {
    newGameBtn: $('#newGameBtn'), soundBtn: $('#soundBtn'),
    teamsList: $('#teamsList'), addTeamBtn: $('#addTeamBtn'),
    rowsOut: $('#rowsOut'), colsOut: $('#colsOut'), sizeNote: $('#sizeNote'),
    randomToggle: $('#randomToggle'), randomDesc: $('#randomDesc'), mini: $('#miniGrid'),
    game: $('.game'), board: $('#board'), turnBox: $('#turnBox'), turnName: $('#turnName'), turnHint: $('#turnHint'),
    scores: $('#scores'), skipBtn: $('#skipBtn'), undoBtn: $('#undoBtn'), endBtn: $('#endBtn'),
    toast: $('#toast'),
    modal: $('#modal'), modalTitle: $('#modalTitle'), modalText: $('#modalText'), modalYes: $('#modalYes'), modalNo: $('#modalNo'),
    reveal: $('#reveal'), revealKicker: $('#revealKicker'), revealRows: $('#revealRows'), revealActions: $('#revealActions'),
    winnerBox: $('#winnerBox'), winnerName: $('#winnerName'), winnerSub: $('#winnerSub'), confetti: $('#confetti')
  };

  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    el.newGameBtn.hidden = id !== 'screen-game';
    window.scrollTo(0, 0);
  }

  let toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
  }

  // نافذة تأكيد مبنية داخل الصفحة (بدل confirm)
  let modalCb = null, lastFocus = null;
  function ask({ title, text, yes, no }, onYes) {
    el.modalTitle.textContent = title;
    el.modalText.textContent = text;
    el.modalYes.textContent = yes;
    el.modalNo.textContent = no;
    modalCb = onYes;
    lastFocus = document.activeElement;
    el.modal.hidden = false;
    el.modalNo.focus();
  }
  function closeModal(confirmed) {
    if (el.modal.hidden) return;
    el.modal.hidden = true;
    const cb = modalCb; modalCb = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (confirmed && cb) cb();
  }

  // =========================================================
  // الإعدادات
  // =========================================================
  const setup = {
    teams: [{ name: 'الفريق الأول', color: 0 }, { name: 'الفريق الثاني', color: 1 }],
    rows: 8, cols: 8, random: false
  };

  function renderTeams() {
    el.teamsList.innerHTML = '';
    setup.teams.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'team-row';

      const sw = document.createElement('button');
      sw.className = 'swatch';
      sw.style.setProperty('--c', PALETTE[t.color].c);
      sw.setAttribute('aria-label', `لون الفريق: ${PALETTE[t.color].n}. اضغط للتغيير`);
      sw.addEventListener('click', () => {
        // ننتقل للون التالي غير المستخدم
        const used = setup.teams.map((x) => x.color);
        let c = t.color;
        do { c = (c + 1) % PALETTE.length; } while (used.includes(c) && c !== t.color);
        t.color = c;
        Sound.click();
        renderTeams();
      });

      const input = document.createElement('input');
      input.type = 'text';
      input.value = t.name;
      input.maxLength = 18;
      input.placeholder = `الفريق ${ORDINALS[i]}`;
      input.setAttribute('aria-label', `اسم الفريق ${ORDINALS[i]}`);
      input.addEventListener('input', (e) => { t.name = e.target.value; });

      row.append(sw, input);

      if (setup.teams.length > 2) {
        const rm = document.createElement('button');
        rm.className = 'team-remove';
        rm.textContent = '×';
        rm.setAttribute('aria-label', 'شيل الفريق');
        rm.addEventListener('click', () => { setup.teams.splice(i, 1); Sound.click(); renderTeams(); });
        row.append(rm);
      }
      el.teamsList.append(row);
    });
    el.addTeamBtn.hidden = setup.teams.length >= MAX_TEAMS;
  }

  function addTeam() {
    if (setup.teams.length >= MAX_TEAMS) return;
    const used = setup.teams.map((x) => x.color);
    const color = PALETTE.findIndex((_, k) => !used.includes(k));
    setup.teams.push({ name: `الفريق ${ORDINALS[setup.teams.length]}`, color });
    Sound.click();
    renderTeams();
  }

  function renderSize() {
    el.rowsOut.textContent = num(setup.rows);
    el.colsOut.textContent = num(setup.cols);
    el.sizeNote.textContent = `${num(setup.rows * setup.cols)} مربع`;
    $$('#presets .chip').forEach((b) => {
      const s = Number(b.dataset.size);
      b.setAttribute('aria-pressed', String(setup.rows === s && setup.cols === s));
    });
  }

  // معاينة مصغّرة لطريقة تعبئة المربعات
  let miniTimer = 0;
  function renderMini() {
    if (!el.mini.children.length) {
      for (let i = 0; i < 9; i++) el.mini.append(document.createElement('i'));
    }
    const cells = [...el.mini.children];
    const on = setup.random ? shuffle([0, 1, 2, 3, 5, 6, 7, 8]).slice(0, 4) : [1, 3, 5, 7];
    cells.forEach((c, i) => {
      c.className = i === 4 ? 'on mid' : (on.includes(i) ? 'on' : '');
    });
  }
  function renderRandom() {
    el.randomToggle.checked = setup.random;
    el.randomDesc.textContent = setup.random
      ? 'شغّالة: تاخذ مربعك ومعه ٤ مربعات بالحظ من الثمانية اللي حوله. أنت وحظّك!'
      : 'مطفية: تاخذ مربعك ومعه الأربعة اللي جنبه على شكل (+)، ثابتة ومضمونة.';
    clearInterval(miniTimer);
    renderMini();
    if (setup.random && !reducedMotion()) miniTimer = setInterval(renderMini, 1100);
  }

  // =========================================================
  // اللعب
  // =========================================================
  let game = null;
  let cells = [];
  let pending = [];   // مؤقتات حركة التعبئة

  const total  = () => game.rows * game.cols;
  const counts = () => game.teams.map((_, k) => game.grid.reduce((a, v) => a + (v === k ? 1 : 0), 0));
  const label  = (i) => `${LETTERS[Math.floor(i / game.cols)]}${num((i % game.cols) + 1)}`;

  function startGame() {
    game = {
      rows: setup.rows, cols: setup.cols, random: setup.random,
      teams: setup.teams.map((t, i) => ({ name: t.name.trim() || `الفريق ${ORDINALS[i]}`, color: PALETTE[t.color].c })),
      grid: new Array(setup.rows * setup.cols).fill(-1),
      turn: 0, history: [], over: false
    };
    clearInterval(miniTimer);
    hideReveal();
    buildBoard();
    renderScores();
    renderTurn();
    el.skipBtn.disabled = el.undoBtn.disabled = el.endBtn.disabled = false;
    el.endBtn.textContent = 'انتهت اللعبة';
    show('screen-game');
    toast(`بسم الله… البداية مع ${game.teams[0].name}`);
  }

  function buildBoard() {
    el.board.style.setProperty('--rows', game.rows);
    el.board.style.setProperty('--cols', game.cols);
    el.board.classList.remove('locked');
    el.board.innerHTML = '';
    cells = [];
    for (let i = 0; i < total(); i++) {
      const b = document.createElement('button');
      b.className = 'cell';
      b.dataset.i = i;
      b.textContent = label(i);
      b.setAttribute('aria-label', `مربع ${label(i)}`);
      cells.push(b);
    }
    el.board.append(...cells);
  }

  function paint(i, anim) {
    const b = cells[i], owner = game.grid[i];
    b.classList.remove('pop', 'origin');
    if (owner < 0) {
      b.classList.remove('owned');
      b.style.removeProperty('--c');
      b.setAttribute('aria-label', `مربع ${label(i)}`);
      return;
    }
    b.classList.add('owned');
    b.style.setProperty('--c', game.teams[owner].color);
    b.setAttribute('aria-label', `مربع ${label(i)}، لـ ${game.teams[owner].name}`);
    if (anim) { void b.offsetWidth; b.classList.add(anim); }
  }

  function paintAll() {
    pending.forEach(clearTimeout); pending = [];
    for (let i = 0; i < cells.length; i++) paint(i);
  }

  // تعليم مربعات الخصوم بأنها غير قابلة للاختيار المباشر
  function markBlocked() {
    cells.forEach((b, k) => {
      const o = game.grid[k];
      b.classList.toggle('blocked', !game.over && o >= 0 && o !== game.turn);
    });
  }

  function renderTurn() {
    markBlocked();
    const t = game.teams[game.turn];
    el.game.style.setProperty('--turn', t.color);
    el.turnName.textContent = t.name;
    el.turnHint.textContent = pick(TXT.hints);
    el.turnBox.classList.remove('swap'); void el.turnBox.offsetWidth; el.turnBox.classList.add('swap');
    $$('.score', el.scores).forEach((s, k) => s.classList.toggle('now', !game.over && k === game.turn));
  }

  let prevCounts = [];
  function renderScores() {
    const cs = counts();
    if (el.scores.children.length !== game.teams.length) {
      el.scores.innerHTML = '';
      game.teams.forEach((t) => {
        const d = document.createElement('div');
        d.className = 'score';
        d.style.setProperty('--c', t.color);
        d.innerHTML = '<span class="score-dot"></span><span class="score-name"></span><span class="score-num"><b></b><small>مربع</small></span><span class="score-bar"></span>';
        $('.score-name', d).textContent = t.name;
        el.scores.append(d);
      });
      prevCounts = [];
    }
    [...el.scores.children].forEach((d, k) => {
      $('b', d).textContent = num(cs[k]);
      $('.score-bar', d).style.width = `${(cs[k] / total()) * 100}%`;
      if (prevCounts[k] !== undefined && prevCounts[k] !== cs[k]) {
        d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump');
      }
    });
    prevCounts = cs;
  }

  // المربعات التي تُعبّأ عند اختيار مربع
  function targetsFor(i) {
    const r = Math.floor(i / game.cols), c = i % game.cols;
    const inside = (rr, cc) => rr >= 0 && rr < game.rows && cc >= 0 && cc < game.cols;
    const out = [];
    if (game.random) {
      // المربع المختار + ٤ عشوائية من الثمانية المحيطة (من أصل ٩)
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if ((dr || dc) && inside(r + dr, c + dc)) out.push((r + dr) * game.cols + c + dc);
      }
      return [i, ...shuffle(out).slice(0, 4)];
    }
    // علامة (+) الثابتة
    [[-1, 0], [0, 1], [1, 0], [0, -1]].forEach(([dr, dc]) => {
      if (inside(r + dr, c + dc)) out.push((r + dr) * game.cols + c + dc);
    });
    return [i, ...out];
  }

  function capture(i) {
    if (game.over) { toast('خلصت اللعبة يا جماعة! نعيدها؟'); return; }
    const me = game.turn, team = game.teams[me];

    // لا يجوز اختيار مربع الخصم مباشرة، يؤخذ فقط إذا كان جار المربع المختار
    const owner = game.grid[i];
    if (owner >= 0 && owner !== me) {
      Sound.nope();
      const b = cells[i];
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      toast(fill(pick(TXT.blocked), { v: game.teams[owner].name }));
      return;
    }
    const targets = targetsFor(i);

    game.history.push({ grid: game.grid.slice(), turn: me });

    const stolen = {};
    targets.forEach((t, k) => {
      const prev = game.grid[t];
      const isSteal = prev >= 0 && prev !== me;
      if (isSteal) stolen[prev] = (stolen[prev] || 0) + 1;
      game.grid[t] = me;
      Sound.pop(k, isSteal);
      // تعبئة متتابعة
      pending.push(setTimeout(() => paint(t, k === 0 ? 'origin' : 'pop'), k * 70));
    });

    const victims = Object.keys(stolen).map(Number);
    if (victims.length) {
      const n = victims.reduce((a, v) => a + stolen[v], 0);
      toast(fill(pick(TXT.steal), {
        t: team.name,
        n: n === 1 ? 'مربع' : n === 2 ? 'مربعين' : `${num(n)} مربعات`,
        v: victims.map((v) => game.teams[v].name).join(' و')
      }));
    } else {
      toast(fill(pick(TXT.capture), { t: team.name }));
    }

    renderScores();

    if (game.grid.every((v) => v >= 0)) {
      game.over = true;
      el.board.classList.add('locked');
      el.endBtn.disabled = true;
      toast('اللوحة امتلت… نعدّ المربعات!');
      setTimeout(endGame, 1100);
      return;
    }
    nextTurn();
  }

  function nextTurn() {
    game.turn = (game.turn + 1) % game.teams.length;
    renderTurn();
  }

  function skipTurn() {
    if (game.over) return;
    const cur = game.teams[game.turn].name;
    game.history.push({ grid: game.grid.slice(), turn: game.turn });
    Sound.skip();
    nextTurn();
    toast(fill(pick(TXT.skip), { t: cur, x: game.teams[game.turn].name }));
  }

  function undo() {
    if (game.over) return;
    const h = game.history.pop();
    if (!h) { toast('ما فيه شي نتراجع عنه!'); return; }
    game.grid = h.grid; game.turn = h.turn;
    Sound.undo();
    paintAll(); renderScores(); renderTurn();
    toast('رجّعنا الحركة… ولا كأن شي صار');
  }

  // =========================================================
  // إعلان الفائز
  // =========================================================
  let confettiRaf = 0;

  function hideReveal() {
    el.reveal.hidden = true;
    cancelAnimationFrame(confettiRaf);
  }

  function endGame() {
    game.over = true;
    el.board.classList.add('locked');
    el.skipBtn.disabled = el.undoBtn.disabled = true;
    el.endBtn.disabled = false;
    el.endBtn.textContent = 'ورّني النتيجة';
    $$('.score', el.scores).forEach((s) => s.classList.remove('now'));

    const cs = counts(), max = Math.max(...cs);
    const winners = cs.map((v, k) => (v === max ? k : -1)).filter((k) => k >= 0);

    // تجهيز الصفوف
    el.revealRows.innerHTML = '';
    const rows = game.teams.map((t) => {
      const r = document.createElement('div');
      r.className = 'r-row';
      r.style.setProperty('--c', t.color);
      r.innerHTML = '<span class="r-name"></span><span class="r-track"><span class="r-bar"></span></span><span class="r-num"><b>٠</b><small>مربع</small></span>';
      $('.r-name', r).textContent = t.name;
      el.revealRows.append(r);
      return { root: r, bar: $('.r-bar', r), n: $('b', r) };
    });

    el.winnerBox.hidden = true;
    el.revealActions.hidden = true;
    el.revealKicker.textContent = 'لحظة الحقيقة… نعدّ المربعات';
    el.reveal.classList.remove('done');
    el.reveal.classList.add('counting');
    el.reveal.hidden = false;
    el.reveal.scrollTop = 0;

    const setShown = (shown) => rows.forEach((row, k) => {
      const v = Math.min(cs[k], shown);
      row.n.textContent = num(v);
      row.bar.style.width = `${max ? (v / max) * 100 : 0}%`;
    });

    const finish = () => {
      stopRoll();
      setShown(max);
      el.reveal.classList.remove('counting');
      el.reveal.classList.add('done');
      winners.forEach((k) => rows[k].root.classList.add('win'));

      if (max === 0) {
        el.revealKicker.textContent = 'أفا!';
        el.winnerName.textContent = 'ما أحد أخذ ولا مربع';
        el.winnerSub.textContent = 'شكلكم جايين تتفرجون… نعيدها؟';
        el.winnerBox.style.removeProperty('--win');
      } else if (winners.length > 1) {
        el.revealKicker.textContent = 'تعادل!';
        el.winnerName.textContent = winners.map((k) => game.teams[k].name).join(' و');
        el.winnerSub.textContent = `كل فريق بـ ${num(max)} مربع… ما أحد غلب أحد!`;
        el.winnerBox.style.setProperty('--win', game.teams[winners[0]].color);
      } else {
        const w = game.teams[winners[0]];
        el.revealKicker.textContent = 'الفائز بلا منازع';
        el.winnerName.textContent = w.name;
        el.winnerSub.textContent = `بـ ${num(max)} مربع من أصل ${num(total())}… ${pick(TXT.win)}`;
        el.winnerBox.style.setProperty('--win', w.color);
      }
      el.winnerBox.hidden = false;
      el.revealActions.hidden = false;
      el.reveal.scrollTop = 0;

      Sound.release();
      if (max > 0) {
        Sound.celebrate();
        confetti(winners.map((k) => game.teams[k].color));
      } else {
        Sound.sigh(0.4);
      }
      $('#againBtn').focus({ preventScroll: true });
    };

    let stopRoll = () => {};
    if (reducedMotion()) { finish(); return; }

    stopRoll = Sound.wind();
    const dur = clamp(max * 75, 1800, 4200);
    const t0 = performance.now() + 900;
    let last = 0;
    const frame = (now) => {
      if (el.reveal.hidden) { stopRoll(); return; }
      const p = clamp((now - t0) / dur, 0, 1);
      const shown = Math.floor(p * max);
      if (shown !== last) { last = shown; setShown(shown); Sound.tick(); }
      if (p < 1) requestAnimationFrame(frame); else finish();
    };
    requestAnimationFrame(frame);
  }

  // قصاصات ملوّنة
  function confetti(colors) {
    if (reducedMotion()) return;
    const cv = el.confetti, g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const cols = [...colors, '#5CC2F5', '#3B98EA', '#BFE3FC', '#FFFFFF'];
    const parts = Array.from({ length: 170 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3,
      y: H * 0.45,
      vx: (Math.random() - 0.5) * 26 * dpr,
      vy: (-Math.random() * 22 - 6) * dpr,
      s: (5 + Math.random() * 8) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      c: pick(cols)
    }));
    const t0 = performance.now();
    cancelAnimationFrame(confettiRaf);
    const step = (now) => {
      const age = now - t0;
      g.clearRect(0, 0, W, H);
      if (age > 5200 || el.reveal.hidden) return;
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

  // =========================================================
  // ربط الأحداث
  // =========================================================
  // الثيم والصوت
  $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); Sound.click(); }));
  setTheme(document.documentElement.dataset.theme);

  el.soundBtn.setAttribute('aria-pressed', String(Sound.on));
  el.soundBtn.addEventListener('click', () => {
    const on = Sound.toggle();
    el.soundBtn.setAttribute('aria-pressed', String(on));
    toast(on ? 'رجّعنا الصوت' : 'سكّرنا الصوت… على راحتكم');
  });

  // التنقل
  $('#toSetupBtn').addEventListener('click', () => { Sound.click(); show('screen-setup'); renderRandom(); });
  $('#backIntroBtn').addEventListener('click', () => { Sound.click(); clearInterval(miniTimer); show('screen-intro'); });
  $('#brandLink').addEventListener('click', (e) => {
    e.preventDefault();
    if ($('#screen-game').classList.contains('active') && game && !game.over) {
      ask({ title: 'تبي تطلع من اللعبة؟', text: 'اللعبة الحالية بتروح عليكم.', yes: 'إيه، طلّعني', no: 'لا، هوّنت' },
        () => { clearInterval(miniTimer); show('screen-intro'); });
    } else {
      hideReveal(); clearInterval(miniTimer); show('screen-intro');
    }
  });

  // الإعدادات
  el.addTeamBtn.addEventListener('click', addTeam);
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    setup.rows = setup.cols = Number(b.dataset.size);
    Sound.click(); renderSize();
  });
  $$('.step-btn').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.step;
    setup[k] = clamp(setup[k] + Number(b.dataset.d), MIN_SIZE, MAX_SIZE);
    Sound.click(); renderSize();
  }));
  el.randomToggle.addEventListener('change', () => { setup.random = el.randomToggle.checked; Sound.click(); renderRandom(); });
  $('#startBtn').addEventListener('click', startGame);

  // اللعب
  el.board.addEventListener('click', (e) => {
    const b = e.target.closest('.cell'); if (!b || !game) return;
    capture(Number(b.dataset.i));
  });
  el.skipBtn.addEventListener('click', skipTurn);
  el.undoBtn.addEventListener('click', undo);
  el.endBtn.addEventListener('click', () => {
    if (game.over) { el.reveal.hidden = false; return; }
    Sound.click();
    ask({ title: 'هل تريد أن تنهي اللعبة يا محترم؟', text: 'بنعدّ المربعات ونعلن الفائز قدّام الكل.', yes: 'إيه، خلّصنا', no: 'لا، كمّلوا' }, endGame);
  });
  el.newGameBtn.addEventListener('click', () => {
    Sound.click();
    if (game && !game.over && game.history.length) {
      ask({ title: 'تبي تهدم كل شي وتبدأ من جديد؟', text: 'اللعبة الحالية بتروح عليكم.', yes: 'إيه، من جديد', no: 'لا، هوّنت' },
        () => { show('screen-setup'); renderRandom(); });
    } else { show('screen-setup'); renderRandom(); }
  });

  // نافذة التأكيد
  el.modalYes.addEventListener('click', () => closeModal(true));
  el.modalNo.addEventListener('click', () => { Sound.click(); closeModal(false); });
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closeModal(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(false); });

  // شاشة الفائز
  $('#againBtn').addEventListener('click', startGame);
  $('#changeBtn').addEventListener('click', () => { hideReveal(); show('screen-setup'); renderRandom(); });
  $('#peekBtn').addEventListener('click', hideReveal);

  // تهيئة أولى
  renderTeams();
  renderSize();
  renderRandom();
  clearInterval(miniTimer);
})();
