/* =========================================================
   أسئلة أثَر المشتركة: ربط الألعاب ببنك ديوان
   - ثلاثة مصادر: من ديوان، من المقدّم، بدون أسئلة
   - اختيار الدواوين والمستويات، ويُحفظ لكل لعبة وحدها
   - الأسئلة ما تتكرر بين كل الألعاب حتى تخلص (athar-diwan-used)
   - نافذة سؤال جاهزة: سؤال ديوان بخيارات، أو حكم المقدّم (صح / غلط)
   يحتاج ../diwan/data.js قبله. الاستخدام: AtharQuiz.settingsUI(…) و AtharQuiz.ask(…)
   ========================================================= */
window.AtharQuiz = (() => {
  'use strict';

  const DW = window.DIWAN_DATA || { diwans: [], questions: [] };
  const LEVELS = ['سهل', 'متوسط', 'صعب'];
  const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ'];
  const USED_KEY = 'athar-diwan-used';
  const SOURCES = {
    diwan: { t: 'من ديوان', s: 'سؤال بخيارات على الشاشة' },
    host: { t: 'من المقدّم', s: 'يسأل ويحكم صح أو غلط' },
    none: { t: 'بدون أسئلة', s: 'نلعب على طول' }
  };

  // الدواوين وأسئلتها: [الديوان، القسم، المستوى، النص، الخيارات، رقم الإجابة، العزو، الرقم]
  const CATS = DW.diwans
    .map((d, i) => ({ id: d.id, name: d.title, q: DW.questions.filter((x) => x[0] === i && Array.isArray(x[4]) && x[4].length >= 2) }))
    .filter((c) => c.q.length);

  // ---------- أدوات ----------
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const num = (n) => ar(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } }
  };
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- الإعدادات (لكل لعبة مفتاحها) ----------
  function load(game, def = 'diwan', sources = ['diwan', 'host', 'none']) {
    const s = Object.assign({ src: def, cats: CATS.map((c) => c.id), levels: [0, 1, 2] }, store.get('athar-quiz-' + game, {}) || {});
    if (!sources.includes(s.src)) s.src = def;
    s.cats = (Array.isArray(s.cats) ? s.cats : []).filter((id) => CATS.some((c) => c.id === id));
    if (!s.cats.length) s.cats = CATS.map((c) => c.id);
    s.levels = (Array.isArray(s.levels) ? s.levels : []).filter((l) => [0, 1, 2].includes(l));
    if (!s.levels.length) s.levels = [0, 1, 2];
    // إذا تعذّر تحميل ديوان، نرجع لأسئلة المقدّم
    if (s.src === 'diwan' && !CATS.length) s.src = sources.includes('host') ? 'host' : 'none';
    return s;
  }
  const save = (game, s) => store.set('athar-quiz-' + game, { src: s.src, cats: s.cats, levels: s.levels });
  const poolSize = (s) => CATS.filter((c) => s.cats.includes(c.id)).reduce((n, c) => n + c.q.filter((x) => s.levels.includes(x[2])).length, 0);

  // ---------- سحب سؤال بلا تكرار ----------
  function next(s) {
    const lv = s && s.levels && s.levels.length ? s.levels : [0, 1, 2];
    const ids = s && s.cats && s.cats.length ? s.cats : CATS.map((c) => c.id);
    const elig = (c, l) => c.q.map((x, i) => (l.includes(x[2]) ? i : -1)).filter((i) => i >= 0);
    let list = CATS.filter((c) => ids.includes(c.id)).map((c) => ({ c, idx: elig(c, lv) })).filter((x) => x.idx.length);
    if (!list.length) list = CATS.map((c) => ({ c, idx: elig(c, [0, 1, 2]) })).filter((x) => x.idx.length);
    if (!list.length) return null;
    const total = list.reduce((n, x) => n + x.idx.length, 0);
    let r = Math.random() * total, sel = list[0];
    for (const x of list) { if ((r -= x.idx.length) <= 0) { sel = x; break; } }
    const used = store.get(USED_KEY, {}) || {};
    const u = new Set(used[sel.c.id] || []);
    let free = sel.idx.filter((i) => !u.has(i));
    if (!free.length) { sel.idx.forEach((i) => u.delete(i)); free = sel.idx.slice(); }
    const i = pick(free);
    u.add(i); used[sel.c.id] = [...u]; store.set(USED_KEY, used);
    const [, , level, q, opts, right, cite] = sel.c.q[i];
    const order = shuffle(opts.map((_, k) => k));
    return { q, opts: order.map((k) => opts[k]), correct: order.indexOf(right), cat: `${sel.c.name} · ${LEVELS[level] || ''}`, cite };
  }

  // =========================================================
  // واجهة الإعدادات: المصدر + الدواوين + المستوى
  // =========================================================
  function settingsUI(box, { game, def = 'diwan', sources = ['diwan', 'host', 'none'], labels = {}, onChange } = {}) {
    if (!box) return { get: () => load(game, def, sources) };
    const s = load(game, def, sources);
    const lab = (k) => Object.assign({}, SOURCES[k], labels[k] || {});
    function render() {
      const n = poolSize(s);
      box.classList.add('aq-settings');
      box.innerHTML = `
        <div class="aq-src aq-c${sources.length}" role="group" aria-label="مصدر الأسئلة">
          ${sources.map((k) => `<button type="button" class="aq-chip" data-src="${k}" aria-pressed="${s.src === k}" ${k === 'diwan' && !CATS.length ? 'disabled' : ''}>${esc(lab(k).t)}<small>${esc(lab(k).s)}</small></button>`).join('')}
        </div>
        <div class="aq-diwan" ${s.src === 'diwan' ? '' : 'hidden'}>
          <span class="aq-label">دواوين الأسئلة</span>
          <div class="aq-cats" role="group" aria-label="الدواوين">
            ${CATS.map((c) => `<button type="button" class="aq-chip" data-cat="${c.id}" aria-pressed="${s.cats.includes(c.id)}">${esc(c.name)}<small>${num(c.q.length)} سؤال</small></button>`).join('')}
          </div>
          <span class="aq-label">المستوى</span>
          <div class="aq-src aq-c3" role="group" aria-label="المستوى">
            ${LEVELS.map((l, i) => `<button type="button" class="aq-chip" data-lv="${i}" aria-pressed="${s.levels.includes(i)}">${l}</button>`).join('')}
          </div>
          <p class="aq-note">${CATS.length ? `${num(n)} سؤالًا من ديوان في اختياركم، وما تتكرر حتى تخلص.` : 'تعذّر تحميل بنك ديوان.'}</p>
        </div>`;
    }
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.src) s.src = b.dataset.src;
      else if (b.dataset.cat) {
        const id = b.dataset.cat;
        if (s.cats.includes(id)) { if (s.cats.length === 1) return; s.cats = s.cats.filter((x) => x !== id); } else s.cats.push(id);
      } else if (b.dataset.lv) {
        const l = +b.dataset.lv;
        if (s.levels.includes(l)) { if (s.levels.length === 1) return; s.levels = s.levels.filter((x) => x !== l); } else s.levels.push(l);
      } else return;
      save(game, s);
      render();
      if (window.AtharSound && AtharSound.tongue) AtharSound.tongue(0, 0.2);
      if (onChange) onChange(get());
    });
    const get = () => ({ src: s.src, cats: s.cats.slice(), levels: s.levels.slice() });
    render();
    return { get };
  }

  // =========================================================
  // نافذة السؤال
  // =========================================================
  const TXT = {
    right: ['كفو يا {t}!', 'يا سلام عليكم يا {t}!', 'ضربة معلّم يا {t}!', 'عداكم العيب يا {t}!', 'هذا الشغل يا {t}!'],
    wrong: ['أفا! الجواب غلط', 'وييين خطأ!', 'راحت عليكم يا {t}!', 'معليش، الجايات أكثر'],
    timeout: ['خلص الوقت!', 'راح الوقت عليكم يا {t}!']
  };
  const say = (k, t) => pick(TXT[k]).replace('{t}', t || '');

  let wrap = null, state = null;
  function ensure() {
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.className = 'aq-overlay';
    wrap.hidden = true;
    wrap.innerHTML = '<div class="aq-card" role="dialog" aria-modal="true" aria-live="polite"></div>';
    document.body.append(wrap);
    wrap.addEventListener('click', onClick);
    document.addEventListener('keydown', (e) => {
      if (!state || wrap.hidden) return;
      if (e.key === 'Escape' && state.cancel) { e.preventDefault(); finish('cancel'); }
    });
    return wrap;
  }

  /* ask({
       settings: {src, cats, levels},  team: {name, color},  kicker,
       time: ثواني (اختياري)، cover: true لعرض «اعرض السؤال» أولًا،
       cancel: true للسماح بالإغلاق، rightText/wrongText: سطر النتيجة،
       sounds: { right(), wrong(), tick(), open() },
       onDone(result)  // 'right' | 'wrong' | 'timeout' | 'cancel'
     }) */
  function ask(o) {
    ensure();
    close(true);
    const src = o.settings && o.settings.src === 'host' ? 'host' : 'diwan';
    let Q = src === 'diwan' ? next(o.settings) : null;
    state = Object.assign({ src: Q ? 'diwan' : 'host', Q, stage: o.cover ? 'cover' : 'q', left: o.time || 0, wrong: [] }, o);
    wrap.hidden = false;
    document.documentElement.classList.add('aq-open');
    render();
    if (state.stage === 'q') startQ();
  }

  function startQ() {
    state.stage = 'q';
    if (state.sounds && state.sounds.open) state.sounds.open();
    render();
    if (state.time) {
      state.left = state.time;
      state.iv = setInterval(() => {
        if (!state || state.paused) return;
        state.left--;
        if (state.left > 0 && state.left <= 5 && state.sounds && state.sounds.tick) state.sounds.tick();
        const r = wrap.querySelector('.aq-timer');
        if (r) { r.style.setProperty('--p', state.left / state.time); r.querySelector('b').textContent = ar(Math.max(0, state.left)); r.classList.toggle('low', state.left <= 5); }
        if (state.left <= 0) result('timeout');
      }, 1000);
    }
  }

  function render() {
    const s = state, card = wrap.querySelector('.aq-card');
    const t = s.team || {};
    card.style.setProperty('--tc', t.color || 'var(--accent)');
    const head = `<p class="aq-kicker">${esc(s.kicker || (t.name ? `سؤال ${t.name}` : 'السؤال'))}${s.Q && s.stage !== 'cover' ? `<span class="aq-cat">${esc(s.Q.cat)}</span>` : ''}</p>`;
    const cancel = s.cancel && s.stage !== 'done' ? '<button type="button" class="aq-x" data-aq="cancel" aria-label="إغلاق">×</button>' : '';
    if (s.stage === 'cover') {
      card.innerHTML = `${cancel}${head}
        <h2 class="aq-team">${esc(t.name || '')}</h2>
        <p class="aq-sub">${s.src === 'diwan' ? 'سؤال من ديوان بخيارات… جاهزين؟' : 'المقدّم بيسألكم الحين… جاهزين؟'}</p>
        <button type="button" class="aq-btn aq-main" data-aq="show">اعرض السؤال</button>`;
      card.querySelector('[data-aq="show"]').focus();
      return;
    }
    const timer = s.time && s.stage === 'q' ? `<span class="aq-timer" style="--p:${s.left / s.time}"><b>${ar(s.left)}</b></span>` : '';
    if (s.src === 'host') {
      card.innerHTML = `${cancel}<div class="aq-top">${head}${timer}</div>
        <h2 class="aq-q">المقدّم يسأل…</h2>
        ${s.stage === 'q' ? `<div class="aq-judge">
          <button type="button" class="aq-btn aq-ok" data-aq="judge" data-v="1">صح!</button>
          <button type="button" class="aq-btn aq-bad" data-aq="judge" data-v="0">غلط!</button>
        </div>` : resultHTML()}`;
      return;
    }
    const Q = s.Q, done = s.stage === 'done';
    const opts = Q.opts.map((o, i) => {
      let cls = 'aq-opt';
      if (done && i === Q.correct) cls += ' right';
      if (s.wrong.includes(i)) cls += ' wrong';
      return `<button type="button" class="${cls}" data-aq="opt" data-i="${i}" ${done ? 'disabled' : ''}><span class="aq-l">${LETTERS[i] || ar(i + 1)}</span><span>${esc(o)}</span></button>`;
    }).join('');
    card.innerHTML = `${cancel}<div class="aq-top">${head}${timer}</div>
      <h2 class="aq-q">${esc(Q.q)}</h2>
      <div class="aq-opts">${opts}</div>
      ${done ? resultHTML() : '<div class="aq-tools"><button type="button" class="aq-link" data-aq="swap">ما عجبهم السؤال؟ بدّله</button></div>'}
      ${Q.cite ? `<small class="aq-cite">ديوان: ${esc(Q.cite)}</small>` : ''}`;
  }

  function resultHTML() {
    const s = state, ok = s.res === 'right', name = s.team && s.team.name;
    const msg = ok ? say('right', name) : s.res === 'timeout' ? say('timeout', name) : say('wrong', name);
    const sub = ok ? (s.rightText || '') : (s.wrongText || '');
    return `<div class="aq-res ${ok ? 'ok' : 'bad'}"><strong>${esc(msg)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
      <button type="button" class="aq-btn aq-main" data-aq="done">تمام، نكمّل</button>`;
  }

  function result(r) {
    if (!state || state.stage !== 'q') return;
    clearInterval(state.iv);
    state.stage = 'done'; state.res = r;
    const snd = state.sounds || {};
    if (r === 'right' && snd.right) snd.right(); else if (r !== 'right' && snd.wrong) snd.wrong();
    render();
    const btn = wrap.querySelector('[data-aq="done"]');
    if (btn) btn.focus({ preventScroll: true });
  }

  function onClick(e) {
    if (!state) return;
    const b = e.target.closest('[data-aq]');
    if (!b) return;
    const a = b.dataset.aq;
    if (a === 'show') startQ();
    else if (a === 'opt' && state.stage === 'q') {
      const i = +b.dataset.i;
      if (i === state.Q.correct) result('right');
      else { state.wrong.push(i); result('wrong'); }
    } else if (a === 'judge' && state.stage === 'q') result(b.dataset.v === '1' ? 'right' : 'wrong');
    else if (a === 'swap' && state.stage === 'q') {
      const Q = next(state.settings);
      if (Q) { state.Q = Q; state.wrong = []; render(); }
    } else if (a === 'done') finish(state.res);
    else if (a === 'cancel') finish('cancel');
  }

  function finish(res) {
    const cb = state && state.onDone;
    close();
    if (cb) cb(res);
  }

  function close(silent) {
    if (state) clearInterval(state.iv);
    state = null;
    if (wrap) wrap.hidden = true;
    document.documentElement.classList.remove('aq-open');
    return silent;
  }

  const isOpen = () => !!(state && wrap && !wrap.hidden);
  const pause = (p) => { if (state) state.paused = p; };

  return { available: CATS.length > 0, cats: CATS, LEVELS, SOURCES, load, save, next, poolSize, settingsUI, ask, close, isOpen, pause, reduced };
})();
