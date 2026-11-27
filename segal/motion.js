/* =========================================================
   سِجَال | طبقة الحركة (تشتغل على الشاشة الكبيرة والجوال)
   تراقب ما ترسمه اللعبة وتضيف له حركة، بدون ما تلمس بيانات الألعاب:
     ١) دخول متتابع غير منتظم للبطاقات والخيارات والخانات (لا يتجاوز نص ثانية)
     ٢) تموّج عند الضغط، وتثبيت الاختيار في الجوال مع اهتزاز خفيف
     ٣) لافتة «الجولة ٢ من ٣» على الشاشة الكبيرة، تدخل بارتداد وتطلع بسرعة لليسار
     ٤) النقاط تعدّ تصاعديًا، وشرارات لما تكسب، وصفوف الترتيب تنزلق لأماكنها الجديدة
   ========================================================= */
window.FZ_MO = (() => {
  'use strict';
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const F = () => window.FZ || {};
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- ١) الدخول المتتابع ----------
  const KINDS = [
    ['.q-big, .rx-cmd', 'mo-in-text'],
    ['.mc-opt, .rx-cell, .pcard, .hk-wrap.look, .scene-wrap, .truth, .num-in, .desc-in, .solo-sum, .rx-field, .w-ico, .order-list, .sorter, .map-wrap', 'mo-in'],
    ['.tres, .fast-list li, .rank-list li, .prow, .brow, .team-res', 'mo-in-row']
  ];
  const ALL = KINDS.map((k) => k[0]).join(', ');
  // تأخيرات بعناقيد غير منتظمة (٢–٤ إطارات)، وأقصاها ٤٤٠ ملي ثانية
  const GAP = [0, 55, 95, 160, 200, 265, 305, 365, 405, 440];
  const seen = new WeakSet();
  const last = new WeakMap();
  function enter(root) {
    const els = [...root.querySelectorAll(ALL)].filter((el) => !seen.has(el));
    els.forEach((el) => seen.add(el));
    if (!els.length || reduced()) return;
    // نفس المحتوى أعيد رسمه (تحديث حالة): بدون حركة حتى ما يرمش
    const sig = root.textContent.replace(/\s+/g, '').slice(0, 260) + '|' + root.getElementsByTagName('*').length;
    const prev = last.get(root), now = performance.now();
    last.set(root, { sig, t: now });
    if (prev && prev.sig === sig && now - prev.t < 8000) return;
    let i = 0;
    els.slice(0, 28).forEach((el) => {
      if (el.parentElement && el.parentElement.closest('.mo-in, .mo-in-text, .mo-in-row')) return; // عنصر داخل عنصر متحرك
      if (getComputedStyle(el).animationName !== 'none') return; // له حركته الخاصة
      const cls = KINDS.find((k) => el.matches(k[0]))[1];
      el.style.setProperty('--mo-d', GAP[Math.min(i++, GAP.length - 1)] + 'ms');
      el.classList.add(cls);
      const done = (e) => { if (e.target !== el) return; el.classList.remove(cls); el.style.removeProperty('--mo-d'); el.removeEventListener('animationend', done); };
      el.addEventListener('animationend', done);
    });
  }

  // ---------- ٢) الضغط ----------
  document.addEventListener('pointerdown', (e) => {
    if (reduced()) return;
    const b = e.target.closest('.mc-opt, .rx-cell, .btn, .mode-card, .bk-skip');
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect();
    const s = Math.max(r.width, r.height) * 2.2;
    const rip = document.createElement('span');
    rip.className = 'mo-rip';
    rip.style.cssText = `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px;--s:${s}px`;
    b.classList.add('mo-rip-host');
    b.appendChild(rip);
    setTimeout(() => { rip.remove(); if (!b.querySelector('.mo-rip')) b.classList.remove('mo-rip-host'); }, 600);
  }, { passive: true });
  function lockIn(el) {
    if (reduced() || el.classList.contains('mo-lock')) return;
    el.classList.add('mo-lock');
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* */ }
    setTimeout(() => el.classList.remove('mo-lock'), 650);
  }

  // ---------- ٣) لافتة الجولة ----------
  let lastRound = '';
  function roundBanner(title, sub, small) {
    const key = title + '|' + sub;
    if (key === lastRound || reduced()) { lastRound = key; return; }
    lastRound = key;
    const ov = document.createElement('div');
    ov.className = 'mo-round' + (small ? ' small' : '');
    ov.innerHTML = `<i class="band"></i><div class="pill">${title}<small>${sub}</small></div>`;
    document.body.appendChild(ov);
    if (!small && F().FX && F().FX.swoosh) F().FX.swoosh();
    setTimeout(() => ov.remove(), 1150);
  }

  // ---------- ٤) النقاط ----------
  const toNum = (t) => {
    const s = (F().toLatin ? F().toLatin(t) : t).replace(/[⁦-⁩\s٬,]/g, '').replace('−', '-');
    const m = s.match(/[+-]?\d+/);
    return m ? +m[0] : null;
  };
  function countUp(el, from, to, fmt, dur = 700) {
    if (reduced() || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      if (!el.isConnected) return;
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(2, -10 * p);
      el.textContent = fmt(Math.round(from + (to - from) * (p >= 1 ? 1 : e)));
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = fmt(from);
    requestAnimationFrame(step);
    setTimeout(() => { if (el.isConnected) el.textContent = fmt(to); }, dur + 80); // ضمان الرقم النهائي لو توقفت الإطارات
  }
  function sparks(host, n = 12) {
    if (reduced()) return;
    const cols = ['var(--gold)', '#5CC2F5', '#1FA971', '#E0559B', '#fff'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, d = 40 + Math.random() * 40;
      s.className = 'mo-spark';
      s.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--c:${cols[i % cols.length]};--sd:${Math.random() * 80}ms`;
      host.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }
  const plusFmt = (v) => (F().plus ? F().plus(v) : (v >= 0 ? '+' : '') + v);
  const numFmt = (v) => (F().num ? F().num(v) : String(v));
  function points(root) {
    // شرائط نقاط الجولة ونقاطي في الجوال
    root.querySelectorAll('.tdot.pts b, .my-pts b').forEach((b) => {
      if (seen.has(b)) return; seen.add(b);
      const v = toNum(b.textContent);
      if (v == null) return;
      countUp(b, 0, v, plusFmt);
      const box = b.closest('.my-pts');
      if (box && v > 0 && !box.dataset.mo) { box.dataset.mo = '1'; box.classList.add('mo-win'); sparks(box); }
    });
    root.querySelectorAll('.tdot.pts').forEach((t, i) => { if (!t.style.getPropertyValue('--mo-d')) t.style.setProperty('--mo-d', GAP[Math.min(i, GAP.length - 1)] + 'ms'); });
  }
  // صفوف الترتيب: تنزلق لمكانها الجديد والنقاط تعدّ من القديم
  let board = new Map();
  function snapBoard(side) {
    board = new Map();
    side.querySelectorAll('.srow').forEach((r) => {
      const n = r.querySelector('.nm b'), p = r.querySelector('.pts');
      if (n && p) board.set(n.textContent, { top: r.getBoundingClientRect().top, pts: toNum(p.firstChild ? p.firstChild.textContent : p.textContent) || 0, w: r.style.getPropertyValue('--w') });
    });
  }
  function animateBoard(side) {
    const old = board;
    if (!reduced()) side.querySelectorAll('.srow').forEach((r) => {
      const n = r.querySelector('.nm b'), p = r.querySelector('.pts');
      if (!n || !p) return;
      const o = old.get(n.textContent);
      if (!o) return;
      const dy = o.top - r.getBoundingClientRect().top;
      if (Math.abs(dy) > 2) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.16,1,.3,1)' });
      const nv = toNum(p.firstChild ? p.firstChild.textContent : p.textContent) || 0;
      if (nv !== o.pts && p.firstChild && p.firstChild.nodeType === 3) {
        const node = p.firstChild;
        const t0 = performance.now();
        const step = (t) => { if (!node.isConnected) return; const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(2, -10 * k); node.textContent = numFmt(Math.round(o.pts + (nv - o.pts) * (k >= 1 ? 1 : e))); if (k < 1) requestAnimationFrame(step); };
        node.textContent = numFmt(o.pts); requestAnimationFrame(step);
        setTimeout(() => { if (node.isConnected) node.textContent = numFmt(nv); }, 780);
        if (nv > o.pts) { r.classList.add('mo-gain'); setTimeout(() => r.classList.remove('mo-gain'), 950); }
        const w = r.style.getPropertyValue('--w');
        if (o.w && w && o.w !== w) { r.style.setProperty('--w', o.w); void r.offsetWidth; requestAnimationFrame(() => r.style.setProperty('--w', w)); }
      }
    });
    requestAnimationFrame(() => snapBoard(side));
  }

  // ---------- المراقبة ----------
  const queued = new Set();
  function schedule(root) {
    if (queued.has(root)) return;
    queued.add(root);
    requestAnimationFrame(() => { queued.delete(root); enter(root); points(root); });
  }
  function watch(sel, fn, opts = { childList: true, subtree: true }) {
    const el = $(sel);
    if (!el) return;
    new MutationObserver(() => fn(el)).observe(el, opts);
    fn(el);
  }
  function init() {
    ['#stage', '#pgame', '#endList', '#boardList', '#waitCard', '#whoStrip', '#endPlayers', '#playersTop'].forEach((s) => watch(s, schedule));
    // الجوال: تثبيت الاختيار
    const pg = $('#pgame');
    if (pg) new MutationObserver((ms) => ms.forEach((m) => {
      const t = m.target;
      if (m.type !== 'attributes' || !(t instanceof Element)) return;
      if ((m.attributeName === 'class' && t.classList.contains('picked') && !(m.oldValue || '').includes('picked')) ||
        (m.attributeName === 'aria-pressed' && t.getAttribute('aria-pressed') === 'true' && m.oldValue !== 'true')) lockIn(t);
    })).observe(pg, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'aria-pressed'] });
    // الترتيب الجانبي في الشاشة الكبيرة
    const side = $('#sideScore');
    if (side) { snapBoard(side); new MutationObserver(() => animateBoard(side)).observe(side, { childList: true }); }
    // لافتة الجولة: الشاشة الكبيرة
    const meta = $('#gMeta');
    if (meta) new MutationObserver(() => {
      const t = meta.textContent || '';
      if (t.includes('الجولة')) roundBanner(`<i>${($('#gIco') || {}).textContent || ''}</i>${($('#gName') || {}).textContent || ''}`, t, false);
    }).observe(meta, { childList: true, characterData: true, subtree: true });
    // الجوال بدون لافتة: الخانات لازم تبان فورًا في فقرات السرعة
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { sparks, roundBanner };
})();
