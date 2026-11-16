/* =========================================================
   القضية | أدوات مشتركة بين شاشة المشرف وصفحة الجوال
   ========================================================= */
window.Q = (() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const num = (n) => String(n).replace(/\d/g, (d) => AR[d]);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ألوان الفرق الستة المعتمدة
  const COLORS = ['#E8554E', '#E59A1C', '#1FA971', '#8257E5', '#E0559B', '#0FA3B1'];

  // أيقونات أنواع البطاقات
  const ICONS = {
    killer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 10.6 7.5 5.3a1.6 1.6 0 0 1 2.1-1.1L12 5l2.4-.8a1.6 1.6 0 0 1 2.1 1.1l1.3 5.3z"/><path d="M2.5 11.2h19v1.9h-19z"/><path d="M6.6 14.6h10.8a5.4 5.4 0 0 1-10.8 0z"/><path class="eye" d="M8.6 15.4h2.2M13.2 15.4h2.2" fill="none" stroke-width="1.4" stroke-linecap="round"/></svg>',
    victim: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.2" r="3.7"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0z"/></svg>',
    weapon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 3.2 10.2 13.8l-2-2L18.8 1.2z"/><path d="M6.6 11.4l6 6-1.4 1.4-1.6-1.6-4 4-1.8-1.8 4-4-1.6-1.6z"/></svg>',
    place: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/></svg>',
    time: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1.1 10.3 3.9 2.3-1 1.7-5.1-3V6.2h2.2z"/></svg>'
  };

  // أنواع البطاقات الخمسة
  const CATS = [
    { k: 'killer', name: 'القاتل', not: 'مو القاتل' },
    { k: 'victim', name: 'المقتول', not: 'مو المقتول' },
    { k: 'weapon', name: 'الأداة', not: 'مو أداة الجريمة' },
    { k: 'place', name: 'المكان', not: 'مو مكان الجريمة' },
    { k: 'time', name: 'الوقت', not: 'مو وقت الجريمة' }
  ];
  const CK = CATS.map((c) => c.k);
  const CATMAP = Object.fromEntries(CATS.map((c) => [c.k, c]));
  const catOf = (id) => String(id).split(':')[0];
  const idxOf = (id) => +String(id).split(':')[1];
  const nameOf = (items, id) => (items[catOf(id)] || [])[idxOf(id)] ?? '';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } }
  };

  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (arr) => arr[rand(arr.length)];
  function shuffle(a) {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }
  // رموز بلا حروف متشابهة (لا O ولا 0 ولا I ولا 1)
  const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function uid(n) {
    let s = '';
    const r = new Uint32Array(n);
    try { crypto.getRandomValues(r); } catch { for (let i = 0; i < n; i++) r[i] = Math.random() * 1e9; }
    for (let i = 0; i < n; i++) s += ABC[r[i] % ABC.length];
    return s;
  }
  const fill = (s, map) => s.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? '');

  // بطاقة دليل
  function cardHTML(items, id, opts = {}) {
    const k = catOf(id);
    return `<div class="ev-card${opts.cls ? ' ' + opts.cls : ''}" data-cat="${k}">
      <span class="ev-ico">${ICONS[k]}</span>
      <b>${esc(nameOf(items, id))}</b>
      <small>${esc(opts.tag || CATMAP[k].name)}</small>
    </div>`;
  }

  // صوت احتياطي إذا لم يتوفر ملف الأصوات
  const S = window.AtharSound || new Proxy({ on: true, toggle: () => true }, { get: (t, p) => (p in t ? t[p] : () => {}) });

  // الثيمات وزر الصوت
  function initChrome() {
    const THEMES = ['light', 'navy', 'blue'];
    const setTheme = (t) => {
      if (!THEMES.includes(t)) t = 'light';
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem('athar-theme', t); } catch { /* تجاهل */ }
      $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
    };
    $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); S.tongue(0, 0.2); }));
    setTheme(document.documentElement.dataset.theme);
    const sb = $('#soundBtn');
    if (sb) {
      sb.setAttribute('aria-pressed', String(S.on));
      sb.addEventListener('click', () => {
        const on = S.toggle();
        sb.setAttribute('aria-pressed', String(on));
        toast(on ? 'رجّعنا الصوت' : 'سكّرنا الصوت… على راحتكم');
      });
    }
  }

  // تنبيه قصير أسفل الشاشة
  let toastT = 0;
  function toast(text, color) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = text;
    t.style.setProperty('--c', color || 'var(--accent)');
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // قصاصات ملوّنة للفوز
  let confRaf = 0;
  function confetti(cv, colors, alive) {
    cancelAnimationFrame(confRaf);
    if (!cv || reducedMotion()) return;
    const g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const cols = [...colors, '#5CC2F5', '#3B98EA', '#BFE3FC', '#FFFFFF'];
    const parts = Array.from({ length: 170 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.4,
      vx: (Math.random() - 0.5) * 26 * dpr, vy: (-Math.random() * 22 - 6) * dpr,
      s: (5 + Math.random() * 8) * dpr, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: cols[rand(cols.length)]
    }));
    const t0 = performance.now();
    const step = (now) => {
      const age = now - t0;
      g.clearRect(0, 0, W, H);
      if (age > 5200 || !alive()) return;
      g.globalAlpha = age > 4200 ? 1 - (age - 4200) / 1000 : 1;
      parts.forEach((p) => {
        p.vy += 0.45 * dpr; p.vx *= 0.985;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
        g.restore();
      });
      confRaf = requestAnimationFrame(step);
    };
    confRaf = requestAnimationFrame(step);
  }

  return { $, $$, num, esc, COLORS, ICONS, CATS, CK, CATMAP, catOf, idxOf, nameOf, store, rand, pick, shuffle, uid, fill, cardHTML, S, initChrome, toast, confetti, reducedMotion };
})();
