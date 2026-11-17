/* =========================================================
   جرس أثَر | أدوات مشتركة بين شاشة المقدّم وصفحة المشارك
   (الثيمات، الصوت، الأرقام، ترتيب الضغطات، نافذة التأكيد، التنبيه العائم)
   ========================================================= */
window.BuzzUI = (() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.AtharSound;

  // ---------- مؤثرات الجرس المسجّلة (sounds/) ----------
  // جرس طاولة قوي للمقدّم، دِنغ للمشارك، وصوت منع عند الضغط والجرس مقفول.
  // تحترم زر كتم الصوت المشترك، وتُفك على الجوال من أول لمسة.
  const SFX = (() => {
    const BASE = new URL('sounds/', (document.currentScript && document.currentScript.src) || location.href).href;
    const NAMES = ['bell-host', 'bell-next', 'bell-press', 'deny'];
    const raw = {}, bufs = {};
    let ctx = null, out = null;
    const decode = (n) => {
      if (!ctx || bufs[n] || !raw[n]) return;
      try { ctx.decodeAudioData(raw[n].slice(0), (b) => { bufs[n] = b; }, () => {}); } catch { /* تجاهل */ }
    };
    NAMES.forEach((n) => {
      fetch(BASE + n + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((b) => { if (b) { raw[n] = b; decode(n); } }).catch(() => {});
    });
    function ensure() {
      try {
        if (!ctx) {
          const C = window.AudioContext || window.webkitAudioContext;
          if (!C) return null;
          ctx = new C();
          out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination);
          NAMES.forEach(decode);
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      } catch { /* تجاهل */ }
      return ctx;
    }
    // فك الصوت مع أي لمسة أو ضغطة زر (متطلب المتصفحات في الجوال)
    ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, ensure, { capture: true, passive: true }));
    function play(name, vol = 1) {
      if (!window.AtharSound || !window.AtharSound.on) return;
      const c = ensure();
      const b = bufs[name];
      if (c && b) {
        const src = c.createBufferSource(), g = c.createGain();
        src.buffer = b; g.gain.value = vol;
        src.connect(g).connect(out); src.start();
      } else {
        // احتياطي إذا ما انفك الملف بعد
        try { const a = new Audio(BASE + name + '.mp3'); a.volume = Math.min(1, vol); a.play().catch(() => {}); } catch { /* تجاهل */ }
      }
    }
    return { play };
  })();

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } }
  };

  // ---------- أرقام ونصوص ----------
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // أجزاء من الثانية: ١٫٢٣٤
  const secs = (ms) => ar((Math.max(0, ms) / 1000).toFixed(3)).replace('.', '٫');
  // فارق زمني بإشارة +، معزول حتى لا تنقلب الإشارة في الاتجاه العربي: ‎+٠٫١٨٠ ث
  const diff = (ms) => `\u2066+${secs(ms)}\u2069 ث`;
  const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
  const ordinal = (i) => ORD[i] || `رقم ${ar(i + 1)}`;

  // لون ثابت لكل مشارك من ألوان فرق أثَر
  const COLORS = ['#E8554E', '#E59A1C', '#1FA971', '#8257E5', '#E0559B', '#0FA3B1'];
  const colorOf = (pid) => {
    let h = 0;
    for (const ch of String(pid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  };

  // ---------- ترتيب ضغطات الجولة الحالية حسب وقت الخادم ----------
  function queueOf(room) {
    if (!room || !room.s) return [];
    const b = (room.b && room.b[room.s.r]) || {};
    const p = room.p || {};
    return Object.keys(b)
      .map((pid) => ({ pid, t: b[pid].t, name: (p[pid] && p[pid].n) || 'مشارك' }))
      .filter((x) => typeof x.t === 'number')
      .sort((a, c) => a.t - c.t || (a.pid < c.pid ? -1 : 1));
  }

  // ---------- الثيمات والصوت ----------
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    store.set('athar-theme', t);
    $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  }
  function initChrome() {
    $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); S.tongue(0, 0.2); }));
    setTheme(document.documentElement.dataset.theme);
    const sb = $('#soundBtn');
    if (sb) {
      sb.setAttribute('aria-pressed', String(S.on));
      sb.addEventListener('click', () => sb.setAttribute('aria-pressed', String(S.toggle())));
    }
  }

  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  // ---------- تنبيه عائم ----------
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- نافذة تأكيد داخل الصفحة ----------
  function confirmBox({ title, text, yes, no = 'إلغاء', danger = false }) {
    return new Promise((res) => {
      const m = $('#confirm');
      $('#confirmTitle').textContent = title;
      $('#confirmText').textContent = text || '';
      const y = $('#confirmYes'), n = $('#confirmNo');
      y.textContent = yes; n.textContent = no;
      y.classList.toggle('btn-danger', danger);
      m.hidden = false;
      const done = (v) => { m.hidden = true; y.onclick = n.onclick = m.onclick = null; res(v); };
      y.onclick = () => done(true);
      n.onclick = () => done(false);
      m.onclick = (e) => { if (e.target === m) done(false); };
      y.focus();
    });
  }

  // ---------- قصاصات احتفالية خفيفة ----------
  function confetti(canvas, { x = 0.5, y = 0.45, count = 110 } = {}) {
    if (!canvas || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ['#F59E0B', '#FCD34D', '#5CC2F5', '#1E6FE0', '#FFFFFF', '#0A2463'];
    const ps = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 9;
      return { x: W * x, y: H * y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
        r: Math.random() * 6, vr: (Math.random() - .5) * .4, col: cols[(Math.random() * cols.length) | 0] };
    });
    const t0 = performance.now(), DUR = 1900;
    const tick = (t) => {
      const k = (t - t0) / DUR;
      c.clearRect(0, 0, W, H);
      if (k >= 1) return;
      ps.forEach((p) => {
        p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.globalAlpha = 1 - k * k; c.translate(p.x, p.y); c.rotate(p.r);
        c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        c.restore();
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  return { SFX, confetti, diff, $, $$, S, store, ar, toLatin, esc, secs, ordinal, colorOf, queueOf, initChrome, show, toast, confirmBox };
})();
