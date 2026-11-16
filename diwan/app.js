/* =========================================================
   ديوان | بنك أسئلة المسابقات الثقافية
   اختيار الديوان والقسم والمستوى، ترتيب عشوائي، تصفّح واختبار
   البيانات في data.js (window.DIWAN_DATA)
   ========================================================= */
(() => {
  'use strict';

  const { diwans: DIWANS, questions: QUESTIONS } = window.DIWAN_DATA;
  // فهارس حقول السؤال
  const D = 0, SEC = 1, LVL = 2, TXT = 3, OPTS = 4, ANS = 5, CITE = 6;
  const LEVELS = ['سهل', 'متوسط', 'صعب'];
  const LETTERS = ['أ', 'ب', 'ج'];
  const THEMES = ['diwan', 'light', 'navy', 'blue'];
  const PAGE = 30;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.AtharSound || null;

  /* ---------- أدوات ---------- */
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } },
  };
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // صيغة المعدود: ٣ أسئلة، ١١ سؤالًا، ١٠٠ سؤال
  function qWord(n) {
    if (n === 0) return 'لا أسئلة';
    if (n === 1) return 'سؤال واحد';
    if (n === 2) return 'سؤالان';
    const m = n % 100;
    if (m >= 3 && m <= 10) return `${ar(n)} أسئلة`;
    if (m >= 11) return `${ar(n)} سؤالًا`;
    return `${ar(n)} سؤال`;
  }
  // تبسيط النص للبحث: حذف التشكيل وتوحيد الهمزات والتاء والياء
  const norm = (s) => s
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .toLowerCase();
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const sound = (name, ...args) => { if (S && typeof S[name] === 'function') { try { S[name](...args); } catch { /* تجاهل */ } } };

  /* ---------- الحالة ---------- */
  const saved = store.get('diwan-filters', null) || {};
  const state = {
    // الدواوين المختارة (الكل افتراضيًا)
    diwans: new Set(Array.isArray(saved.diwans) ? saved.diwans.filter((i) => DIWANS[i]) : DIWANS.map((_, i) => i)),
    // الأقسام المستبعدة لكل ديوان: { رقم الديوان: [أرقام الأقسام] }
    off: saved.off && typeof saved.off === 'object' ? saved.off : {},
    levels: new Set(Array.isArray(saved.levels) ? saved.levels.filter((l) => l >= 0 && l <= 2) : [0, 1, 2]),
    random: !!saved.random,
    count: [0, 10, 20, 30, 50].includes(saved.count) ? saved.count : 0,
    // إخفاء الخيارات: يظهر السؤال وحده
    hideOpts: !!saved.hideOpts,
  };
  function persist() {
    store.set('diwan-filters', {
      diwans: [...state.diwans], off: state.off, levels: [...state.levels], random: state.random, count: state.count, hideOpts: state.hideOpts,
    });
  }
  const secOn = (d, s) => !(state.off[d] || []).includes(s);

  /* ---------- حساب الأسئلة المطابقة ---------- */
  function matching(ignoreLevel = false) {
    const out = [];
    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      if (!state.diwans.has(q[D]) || !secOn(q[D], q[SEC])) continue;
      if (!ignoreLevel && !state.levels.has(q[LVL])) continue;
      out.push(i);
    }
    return out;
  }
  // القائمة النهائية: ترتيب أصلي أو عشوائي، ثم العدد المطلوب
  function buildPool() {
    let list = matching();
    if (state.random) shuffle(list);
    if (state.count && list.length > state.count) list = list.slice(0, state.count);
    return list;
  }

  /* ---------- الثيم والصوت ---------- */
  function setTheme(t) {
    if (!THEMES.includes(t)) t = 'diwan';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('diwan-theme', t); } catch { /* تجاهل */ }
    $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  }
  $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); sound('tongue', 0, 0.2); }));
  setTheme(document.documentElement.dataset.theme);

  const soundBtn = $('#soundBtn');
  soundBtn.setAttribute('aria-pressed', String(S ? S.on : false));
  soundBtn.addEventListener('click', () => { if (S) soundBtn.setAttribute('aria-pressed', String(S.toggle())); });

  /* ---------- التنقل بين الشاشات ---------- */
  let current = 'home';
  function show(name) {
    current = name;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
    window.scrollTo(0, 0);
  }
  function go(name) {
    if (name !== 'home') history.pushState({ screen: name }, '');
    show(name);
  }
  // زر الرجوع في الجهاز يعيد إلى الاختيارات
  window.addEventListener('popstate', () => { closeConfirm(); show('home'); renderHome(); });
  $$('[data-go="home"]').forEach((b) => b.addEventListener('click', () => { sound('tongue', 0, 0.2); backHome(); }));
  function backHome() {
    if (history.state && history.state.screen) history.back();
    else { show('home'); renderHome(); }
  }

  /* =========================================================
     ١) الرئيسية
     ========================================================= */
  const diwanGrid = $('#diwanGrid');
  const sectionsBox = $('#sectionsBox');
  const TICK = '<span class="tick"><svg viewBox="0 0 16 16"><path d="M3 8.5l3.2 3L13 4.8"/></svg></span>';

  diwanGrid.innerHTML = DIWANS.map((d, i) => `
    <button class="diwan-btn" data-diwan="${i}" aria-pressed="false">
      ${TICK}
      <span class="d-num">الديوان ${ar(i + 1)}</span>
      <span class="d-title">${esc(d.title)}</span>
      <span class="d-count">${qWord(d.count)}</span>
    </button>`).join('');

  diwanGrid.addEventListener('click', (e) => {
    const b = e.target.closest('.diwan-btn'); if (!b) return;
    const i = +b.dataset.diwan;
    if (state.diwans.has(i)) state.diwans.delete(i); else state.diwans.add(i);
    sound('drop', state.diwans.has(i) ? 520 : 380, 0, 0.18);
    persist(); renderHome();
  });
  $('#allDiwans').addEventListener('click', () => { DIWANS.forEach((_, i) => state.diwans.add(i)); persist(); renderHome(); });
  $('#noDiwans').addEventListener('click', () => { state.diwans.clear(); persist(); renderHome(); });

  // الأقسام: مجموعة قابلة للطي لكل ديوان مختار
  const openGroups = new Set();
  function renderSections() {
    const chosen = [...state.diwans].sort((a, b) => a - b);
    if (!chosen.length) {
      sectionsBox.innerHTML = '<p class="sec-empty">اختر ديوانًا واحدًا على الأقل لتظهر أقسامه هنا.</p>';
      return;
    }
    const few = chosen.length <= 3;
    sectionsBox.innerHTML = chosen.map((d) => {
      const dw = DIWANS[d];
      const onCount = dw.sections.filter((_, s) => secOn(d, s)).length;
      const open = few || openGroups.has(d) ? ' open' : '';
      return `
      <details class="sec-group" data-diwan="${d}"${open}>
        <summary><h3>${esc(dw.title)}</h3><span class="muted">${ar(onCount)} من ${ar(dw.sections.length)} أقسام</span></summary>
        <div class="chips">
          ${dw.sections.map((sec, s) => `
          <button class="chip" data-diwan="${d}" data-sec="${s}" aria-pressed="${secOn(d, s)}" title="${esc(sec.label)}">
            ${esc(sec.name)} <small>${ar(sec.count)}</small>
          </button>`).join('')}
        </div>
      </details>`;
    }).join('');
  }
  sectionsBox.addEventListener('toggle', (e) => {
    const g = e.target.closest('.sec-group'); if (!g) return;
    const d = +g.dataset.diwan;
    if (g.open) openGroups.add(d); else openGroups.delete(d);
  }, true);
  sectionsBox.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const d = +b.dataset.diwan, s = +b.dataset.sec;
    const off = new Set(state.off[d] || []);
    if (off.has(s)) off.delete(s); else off.add(s);
    if (off.size) state.off[d] = [...off]; else delete state.off[d];
    openGroups.add(d);
    sound('drop', off.has(s) ? 380 : 520, 0, 0.18);
    persist(); renderHome();
  });

  // المستوى
  $('#levelRow').addEventListener('click', (e) => {
    const b = e.target.closest('.level-btn'); if (!b) return;
    const l = +b.dataset.level;
    if (state.levels.has(l)) state.levels.delete(l); else state.levels.add(l);
    sound('drop', state.levels.has(l) ? 520 : 380, 0, 0.18);
    persist(); renderHome();
  });

  // الترتيب والعدد
  const randomToggle = $('#randomToggle');
  randomToggle.addEventListener('change', () => { state.random = randomToggle.checked; sound('tongue', 0, 0.2); persist(); renderHome(); });
  $('#countRow').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.count = +b.dataset.count; sound('tongue', 0, 0.2); persist(); renderHome();
  });

  // إخفاء الخيارات: مفتاح في الاختيارات وآخر في البنك، وكلاهما يضبط الحالة نفسها
  const hideOptsToggle = $('#hideOptsToggle');
  const optsToggle = $('#optsToggle');
  function applyHideOpts() {
    document.body.classList.toggle('hide-opts', state.hideOpts);
    hideOptsToggle.checked = state.hideOpts;
    optsToggle.checked = !state.hideOpts;
    $$('.q-card.opts-open').forEach((c) => c.classList.remove('opts-open'));
    $$('[data-showopts]').forEach((b) => { b.textContent = 'أظهر الخيارات'; });
  }
  hideOptsToggle.addEventListener('change', () => { state.hideOpts = hideOptsToggle.checked; sound('tongue', 0, 0.2); persist(); applyHideOpts(); });
  optsToggle.addEventListener('change', () => { state.hideOpts = !optsToggle.checked; sound('tongue', 0, 0.2); persist(); applyHideOpts(); });

  function renderHome() {
    $$('.diwan-btn', diwanGrid).forEach((b) => b.setAttribute('aria-pressed', String(state.diwans.has(+b.dataset.diwan))));
    renderSections();
    // عدّاد كل مستوى ضمن الدواوين والأقسام المختارة
    const perLevel = [0, 0, 0];
    matching(true).forEach((i) => { perLevel[QUESTIONS[i][LVL]]++; });
    $$('.level-btn').forEach((b) => {
      const l = +b.dataset.level;
      b.setAttribute('aria-pressed', String(state.levels.has(l)));
      $('small', b).textContent = qWord(perLevel[l]);
    });
    randomToggle.checked = state.random;
    $$('#countRow .chip').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.count === state.count)));

    const total = matching().length;
    const n = state.count ? Math.min(state.count, total) : total;
    $('#matchCount').textContent = ar(n);
    const noun = n === 1 ? 'سؤال' : (n % 100 >= 3 && n % 100 <= 10 ? 'أسئلة' : (n % 100 >= 11 ? 'سؤالًا' : 'سؤال'));
    $('#matchLabel').textContent = total === 0 ? 'لا أسئلة مطابقة لاختيارك'
      : (n < total ? `${noun} من أصل ${ar(total)} مطابقة` : `${noun} حسب اختيارك`);
    $('#browseBtn').disabled = $('#quizBtn').disabled = total === 0;
  }

  $('#statQuestions').textContent = ar(QUESTIONS.length);
  $('#statDiwans').textContent = ar(DIWANS.length);

  /* =========================================================
     بطاقة السؤال
     ========================================================= */
  const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8"/><path d="M4.4 8.4l2.4 2.3 4.8-5"/></svg>';
  function cardHTML(qi, num, { big = false, shown = false, tag = 'div' } = {}) {
    const q = QUESTIONS[qi];
    const dw = DIWANS[q[D]];
    const optTag = big ? 'button' : 'div';
    return `
    <article class="q-card${big ? ' big' : ''}${shown ? ' show' : ''}" data-q="${qi}">
      <div class="q-meta">
        <span>${esc(dw.title)}</span><span aria-hidden="true">·</span><span>${esc(dw.sections[q[SEC]].name)}</span>
        <span class="lvl lv-${q[LVL]}">${LEVELS[q[LVL]]}</span>
      </div>
      <div class="q-head">
        <span class="q-num">${ar(num)}</span>
        <h3 class="q-text">${esc(q[TXT])}</h3>
      </div>
      <div class="opts">
        ${q[OPTS].map((o, k) => `
        <${optTag} class="opt${k === q[ANS] ? ' correct' : ''}" data-opt="${k}">
          <span class="ltr">${LETTERS[k]}</span>
          <span class="o-text">${esc(o)}</span>
          ${k === q[ANS] ? `<span class="cite">${CHECK}${esc(q[CITE])}</span>` : ''}
        </${optTag}>`).join('')}
      </div>
      ${big ? `<p class="q-source">المصدر: ${esc(dw.source)}</p>` : '<div class="q-foot"><button class="link-btn" data-showopts>أظهر الخيارات</button><button class="link-btn" data-reveal>أظهر الإجابة</button></div>'}
    </article>`;
  }

  /* =========================================================
     ٢) تصفّح البنك
     ========================================================= */
  const bankList = $('#bankList');
  const searchInput = $('#searchInput');
  const answersToggle = $('#answersToggle');
  const moreBtn = $('#moreBtn');
  const bank = { base: [], list: [], shown: 0, review: false };
  let searchIndex = null;

  function openBank(list, { review = false } = {}) {
    bank.base = list; bank.review = review;
    searchInput.value = '';
    if (review) answersToggle.checked = true;
    $('#reshuffleBtn').hidden = review || !state.random;
    go('bank');
    filterBank();
  }
  function filterBank() {
    const term = norm(searchInput.value.trim());
    if (term) {
      if (!searchIndex) searchIndex = QUESTIONS.map((q) => norm(`${q[TXT]} ${q[OPTS].join(' ')}`));
      bank.list = bank.base.filter((i) => searchIndex[i].includes(term));
    } else bank.list = bank.base;
    bank.shown = 0; bankList.innerHTML = '';
    $('#bankCount').textContent = qWord(bank.list.length);
    $('#bankSummary').textContent = bank.review ? 'مراجعة ما أخطأت فيه' : summary();
    $('#bankEmpty').hidden = bank.list.length > 0;
    renderMore();
  }
  function renderMore() {
    const next = bank.list.slice(bank.shown, bank.shown + PAGE);
    const shown = answersToggle.checked;
    bankList.insertAdjacentHTML('beforeend', next.map((qi, k) => cardHTML(qi, bank.shown + k + 1, { shown })).join(''));
    bank.shown += next.length;
    const left = bank.list.length - bank.shown;
    moreBtn.hidden = left <= 0;
    moreBtn.textContent = `عرض المزيد (باقي ${ar(left)})`;
    syncRevealButtons();
  }
  function syncRevealButtons() {
    bankList.classList.toggle('answers-on', answersToggle.checked);
  }
  function summary() {
    const names = [...state.diwans].sort((a, b) => a - b).map((d) => DIWANS[d].title);
    const head = names.length === DIWANS.length ? 'كل الدواوين' : (names.length <= 2 ? names.join(' و') : `${ar(names.length)} دواوين`);
    const lv = state.levels.size === 3 ? '' : ` · ${[...state.levels].sort().map((l) => LEVELS[l]).join(' و')}`;
    return `${head}${lv}${state.random ? ' · عشوائي' : ''}`;
  }

  moreBtn.addEventListener('click', () => { sound('tongue', 0, 0.2); renderMore(); });
  let searchTimer = 0;
  searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(filterBank, 180); });
  answersToggle.addEventListener('change', () => {
    $$('.q-card', bankList).forEach((c) => c.classList.toggle('show', answersToggle.checked));
    $$('[data-reveal]', bankList).forEach((b) => { b.textContent = 'أظهر الإجابة'; });
    syncRevealButtons(); sound('tongue', 0, 0.2);
  });
  bankList.addEventListener('click', (e) => {
    const ob = e.target.closest('[data-showopts]');
    if (ob) {
      const open = ob.closest('.q-card').classList.toggle('opts-open');
      ob.textContent = open ? 'أخفِ الخيارات' : 'أظهر الخيارات';
      sound('drop', open ? 520 : 380, 0, 0.18);
      return;
    }
    const b = e.target.closest('[data-reveal]'); if (!b) return;
    const card = b.closest('.q-card');
    const on = card.classList.toggle('show');
    b.textContent = on ? 'أخفِ الإجابة' : 'أظهر الإجابة';
    sound('drop', on ? 520 : 380, 0, 0.18);
  });
  $('#reshuffleBtn').addEventListener('click', () => { bank.base = buildPool(); sound('whoosh', true); filterBank(); });
  $('#browseBtn').addEventListener('click', () => { sound('whoosh', true); openBank(buildPool()); });

  /* =========================================================
     ٣) الاختبار
     ========================================================= */
  const quizCard = $('#quizCard');
  const nextBtn = $('#nextBtn');
  const revealBtn = $('#revealBtn');
  const showOptsBtn = $('#showOptsBtn');
  const gradeRow = $('#gradeRow');
  const quiz = { list: [], i: 0, results: [] }; // النتيجة لكل سؤال: right | wrong | skip

  function startQuiz(list) {
    quiz.list = list; quiz.i = 0; quiz.results = [];
    go('quiz');
    renderQuestion();
  }
  function renderQuestion() {
    const total = quiz.list.length;
    quizCard.innerHTML = cardHTML(quiz.list[quiz.i], quiz.i + 1, { big: true });
    $('#quizPos').textContent = `السؤال ${ar(quiz.i + 1)} من ${ar(total)}`;
    updateScore();
    $('#progressBar').style.width = `${(quiz.i / total) * 100}%`;
    nextBtn.disabled = true;
    nextBtn.textContent = quiz.i === total - 1 ? 'النتيجة' : 'التالي';
    revealBtn.disabled = false;
    // عند إخفاء الخيارات: زر لإظهارها، وتقييم يدوي بعد إظهار الإجابة
    showOptsBtn.hidden = !state.hideOpts; showOptsBtn.disabled = false;
    $('.quiz-actions').classList.toggle('three', state.hideOpts);
    gradeRow.hidden = true;
    $$('[data-grade]', gradeRow).forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }
  function updateScore() {
    const right = quiz.results.filter((r) => r === 'right').length;
    $('#quizScore').textContent = `الصحيحة: ${ar(right)}`;
  }
  function settle(result, picked = -1) {
    if (quiz.results[quiz.i]) return;
    quiz.results[quiz.i] = result;
    const card = $('.q-card', quizCard);
    card.classList.add('show');
    $$('.opt', card).forEach((o) => { o.disabled = true; if (+o.dataset.opt === picked && result === 'wrong') o.classList.add('wrong'); });
    if (result === 'right') sound('chirp'); else if (result === 'wrong') sound('sigh'); else sound('drop', 440, 0, 0.2);
    updateScore();
    $('#progressBar').style.width = `${((quiz.i + 1) / quiz.list.length) * 100}%`;
    nextBtn.disabled = false; revealBtn.disabled = true; showOptsBtn.disabled = true;
    // أُظهرت الإجابة والخيارات مخفية: المقدّم يحكم بنفسه
    if (result === 'skip' && state.hideOpts && !card.classList.contains('opts-open')) gradeRow.hidden = false;
    nextBtn.focus({ preventScroll: true });
  }
  function pick(k) {
    if (current !== 'quiz' || quiz.results[quiz.i]) return;
    // لا اختيار والخيارات مخفية
    if (state.hideOpts && !$('.q-card', quizCard).classList.contains('opts-open')) return;
    const q = QUESTIONS[quiz.list[quiz.i]];
    settle(k === q[ANS] ? 'right' : 'wrong', k);
  }
  function next() {
    if (current !== 'quiz' || !quiz.results[quiz.i]) return;
    if (quiz.i < quiz.list.length - 1) { quiz.i++; sound('tongue', 0, 0.2); renderQuestion(); window.scrollTo(0, 0); }
    else finish();
  }
  quizCard.addEventListener('click', (e) => { const o = e.target.closest('.opt'); if (o) pick(+o.dataset.opt); });
  nextBtn.addEventListener('click', next);
  revealBtn.addEventListener('click', () => settle('skip'));
  showOptsBtn.addEventListener('click', () => {
    const card = $('.q-card', quizCard); if (!card || quiz.results[quiz.i]) return;
    card.classList.add('opts-open'); showOptsBtn.disabled = true; sound('drop', 520, 0, 0.18);
  });
  gradeRow.addEventListener('click', (e) => {
    const b = e.target.closest('[data-grade]'); if (!b || current !== 'quiz') return;
    quiz.results[quiz.i] = b.dataset.grade;
    $$('[data-grade]', gradeRow).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    sound(b.dataset.grade === 'right' ? 'chirp' : 'sigh');
    updateScore();
  });
  document.addEventListener('keydown', (e) => {
    if (current !== 'quiz' || !$('#confirmModal').hidden) return;
    const map = { 1: 0, 2: 1, 3: 2, '١': 0, '٢': 1, '٣': 2 };
    if (e.key in map) pick(map[e.key]);
    else if (e.key === 'Enter' && !nextBtn.disabled && document.activeElement !== nextBtn) next();
  });
  $('#quizBtn').addEventListener('click', () => { sound('whoosh', true); startQuiz(buildPool()); });

  // إنهاء مبكر بنافذة تأكيد داخل الصفحة
  const confirmModal = $('#confirmModal');
  function closeConfirm() { confirmModal.hidden = true; }
  $('#quitBtn').addEventListener('click', () => {
    if (!quiz.results.length) { backHome(); return; }
    confirmModal.hidden = false; $('#confirmNo').focus();
  });
  $('#confirmNo').addEventListener('click', closeConfirm);
  $('#confirmYes').addEventListener('click', () => { closeConfirm(); finish(); });
  confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) closeConfirm(); });

  /* =========================================================
     ٤) النتيجة
     ========================================================= */
  function finish() {
    const done = quiz.results.length;
    const right = quiz.results.filter((r) => r === 'right').length;
    const wrong = quiz.results.filter((r) => r === 'wrong').length;
    const skip = done - right - wrong;
    const pct = done ? Math.round((right / done) * 100) : 0;
    $('#resultTitle').textContent = pct >= 90 ? 'ما شاء الله، إتقان' : pct >= 70 ? 'أحسنت' : pct >= 50 ? 'جيد، وتحتاج مراجعة' : 'راجع الأسئلة وأعد المحاولة';
    $('#resultScore').textContent = ar(right);
    $('#resultOf').textContent = `من ${ar(done)} · ٪${ar(pct)}`;
    $('#resRight').textContent = ar(right);
    $('#resWrong').textContent = ar(wrong);
    $('#resSkip').textContent = ar(skip);
    $('#reviewBtn').hidden = wrong + skip === 0;
    // استبدال شاشة الاختبار بالنتيجة دون إضافة خطوة رجوع جديدة
    history.replaceState({ screen: 'result' }, '');
    show('result');
    sound(pct >= 70 ? 'gust' : 'whoosh', pct >= 70 ? 0 : false);
    if (pct >= 70) sound('chirp', 0.25);
  }
  $('#againBtn').addEventListener('click', () => {
    sound('whoosh', true);
    history.replaceState({ screen: 'quiz' }, '');
    quiz.list = buildPool(); quiz.i = 0; quiz.results = [];
    show('quiz'); renderQuestion();
  });
  $('#reviewBtn').addEventListener('click', () => {
    const missed = quiz.list.filter((_, k) => quiz.results[k] && quiz.results[k] !== 'right');
    history.replaceState({ screen: 'bank' }, '');
    bank.base = missed; bank.review = true;
    searchInput.value = ''; answersToggle.checked = true;
    $('#reshuffleBtn').hidden = true;
    show('bank'); filterBank();
  });

  /* ---------- البدء ---------- */
  if (history.state && history.state.screen) history.replaceState(null, '');
  applyHideOpts();
  renderHome();
})();
