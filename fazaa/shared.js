/* =========================================================
   فزعة | أدوات مشتركة بين شاشة المقدّم وجوال المشارك
   (أرقام ونصوص، مولّد عشوائي ببذرة، الفرق، النقاط، الأصوات، الثيمات، النوافذ)
   ========================================================= */
window.FZ = (() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.AtharSound;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } },
    json(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } }
  };

  // ---------- أرقام ونصوص ----------
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // رقم بفواصل الآلاف وأرقام عربية (والكسور بفاصلة عشرية عربية)
  function num(n) {
    if (n == null || isNaN(n)) return '—';
    const neg = n < 0; n = Math.abs(+n);
    const [i, f] = (Math.round(n * 100) / 100).toString().split('.');
    const s = i.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') + (f ? '٫' + f : '');
    return (neg ? '−' : '') + ar(s);
  }
  // رقم بإشارة + معزول حتى لا تنقلب الإشارة داخل النص العربي
  const plus = (n) => `⁦${n >= 0 ? '+' : '−'}${ar(Math.abs(n))}⁩`;
  const clock = (sec) => { sec = Math.max(0, Math.ceil(sec)); return ar(sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : String(sec)); };
  // تحويل نص رقم مكتوب بأي أرقام إلى عدد
  const parseNum = (s) => { const v = parseFloat(toLatin(String(s || '')).replace(/[٬,\s]/g, '').replace('٫', '.')); return isNaN(v) ? null : v; };

  // ---------- مولّد عشوائي ببذرة (نفس المشهد على كل الأجهزة) ----------
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const f = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.shuffle = (arr) => { const x = [...arr]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
    return f;
  }
  const R = rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  const shuffle = (a) => R.shuffle(a);
  const uid = (n = 10) => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[(Math.random() * 36) | 0]).join('');

  // ---------- الفرق ----------
  const TEAM_COLORS = ['#E8554E', '#E59A1C', '#1FA971', '#8257E5', '#E0559B', '#0FA3B1'];
  const TEAM_NAMES = ['الصقور', 'النخيل', 'الدروع', 'السهام', 'النجوم', 'الموج'];
  const teamList = (T) => Object.keys(T || {}).sort((a, b) => a - b).map((k) => Object.assign({ id: k }, T[k]));
  const members = (P, t) => Object.keys(P || {}).filter((pid) => P[pid] && String(P[pid].t) === String(t));

  // نقاط الترتيب للفقرات اللي تعتمد على الأقرب أو الأفضل
  const RANK_PTS = [100, 70, 50, 35, 25, 15];
  // ترتيب بالخطأ (الأصغر أفضل) مع التعادل
  function rankBy(list, key) {
    const s = [...list].sort((a, b) => a[key] - b[key]);
    let pos = 0;
    s.forEach((x, i) => { if (i > 0 && s[i][key] !== s[i - 1][key]) pos = i; x.rank = pos; });
    return s;
  }
  // نقاط السرعة: صح = ٥٠ + حتى ٥٠ حسب الوقت المتبقي
  const speedPts = (t, at, dl) => { const k = Math.max(0, Math.min(1, 1 - (t - at) / (dl * 1000))); return 50 + Math.round(50 * k); };

  // ---------- المسافة بين نقطتين على الأرض (كم) ----------
  function km(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  }

  // ---------- مؤثرات اللعبة (مولّدة، بلا موسيقى ولا آلات) ----------
  const FX = (() => {
    let ctx = null;
    const c = () => {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    const ok = () => S && S.on && c();
    function noise(dur) {
      const x = ctx, b = x.createBuffer(1, Math.ceil(x.sampleRate * dur), x.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = x.createBufferSource(); s.buffer = b; return s;
    }
    return {
      // صافرة فم: بداية الجولة
      whistle(delay = 0) {
        if (!ok()) return;
        const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(), v = ctx.createOscillator(), vg = ctx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(2050, t); o.frequency.linearRampToValueAtTime(2350, t + 0.08); o.frequency.setValueAtTime(2300, t + 0.36);
        v.frequency.value = 26; vg.gain.value = 55; v.connect(vg); vg.connect(o.frequency);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.03); g.gain.setValueAtTime(0.11, t + 0.38); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        const n = noise(0.5), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
        nf.type = 'bandpass'; nf.frequency.value = 2300; nf.Q.value = 3; ng.gain.value = 0.05;
        n.connect(nf); nf.connect(ng); ng.connect(ctx.destination);
        o.connect(g); g.connect(ctx.destination);
        o.start(t); v.start(t); n.start(t); o.stop(t + 0.52); v.stop(t + 0.52); n.stop(t + 0.5);
      },
      // طقّة لسان: ضغطة أو عدّ تنازلي
      tick(vol = 0.18) { if (S && S.on) S.tongue(0, vol); },
      // فرقعة هواء منخفضة: انفجار اللغم
      boom() {
        if (!ok()) return;
        const t = ctx.currentTime, n = noise(1.2), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'lowpass'; f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.9);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
        n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t); n.stop(t + 1.2);
        if (S.gust) S.gust(0.05);
      },
      // تصفيق قصير (نبضات ضجيج)
      clap(times = 6) {
        if (!ok()) return;
        for (let i = 0; i < times; i++) {
          const t = ctx.currentTime + i * (0.11 + Math.random() * 0.05), n = noise(0.09), f = ctx.createBiquadFilter(), g = ctx.createGain();
          f.type = 'bandpass'; f.frequency.value = 1200 + Math.random() * 600; f.Q.value = 0.9;
          g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          n.connect(f); f.connect(g); g.connect(ctx.destination); n.start(t); n.stop(t + 0.09);
        }
      },
      right() { if (S && S.on) { S.chirp(0, 3200); S.chirp(0.12, 3600); } },
      wrong() { if (S && S.on) S.sigh(0); },
      pop(f = 520) { if (S && S.on) S.drop(f, 0, 0.22); },
      swoosh() { if (S && S.on) S.whoosh(true, 0); },
      unlock() { c(); }
    };
  })();

  // ---------- الثيمات: ثيم الساحة الليلي افتراضي ----------
  const THEME_KEY = 'athar-fazaa-theme';
  const GAME_THEMES = ['fest'];
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    store.set(THEME_KEY, t);
    if (!GAME_THEMES.includes(t)) store.set('athar-theme', t);
    const m = $('meta[name="theme-color"]');
    if (m) m.content = { fest: '#170F33', light: '#FFFFFF', navy: '#0A2463', blue: '#1E6FE0' }[t] || '#0A2463';
    $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  }
  function initChrome() {
    $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); FX.tick(0.2); }));
    setTheme(document.documentElement.dataset.theme);
    const sb = $('#soundBtn');
    if (sb) {
      sb.setAttribute('aria-pressed', String(S.on));
      sb.addEventListener('click', () => sb.setAttribute('aria-pressed', String(S.toggle())));
    }
    // أول لمسة تفتح الصوت في المتصفحات
    window.addEventListener('pointerdown', () => FX.unlock(), { once: true });
  }

  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
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
      y.textContent = yes; n.textContent = no; n.hidden = !no;
      y.classList.toggle('btn-danger', danger);
      m.hidden = false;
      const done = (v) => { m.hidden = true; y.onclick = n.onclick = m.onclick = null; res(v); };
      y.onclick = () => done(true);
      n.onclick = () => done(false);
      m.onclick = (e) => { if (e.target === m) done(false); };
      y.focus();
    });
  }

  // ---------- قصاصات ورق ورايات عند الفوز ----------
  function confetti(canvas, { x = 0.5, y = 0.35, count = 140 } = {}) {
    if (!canvas || reduced()) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ['#F59E0B', '#FACC15', '#5CC2F5', '#1E6FE0', '#1FA971', '#E8554E', '#FFFFFF', '#E0559B'];
    const ps = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 9;
      return { x: W * x, y: H * y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, w: 8 + Math.random() * 6, h: 6 + Math.random() * 6,
        r: Math.random() * 6, vr: (Math.random() - .5) * .4, col: cols[(Math.random() * cols.length) | 0], tri: Math.random() < 0.45 };
    });
    const t0 = performance.now(), DUR = 2400;
    const tick = (t) => {
      const k = (t - t0) / DUR;
      c.clearRect(0, 0, W, H);
      if (k >= 1) return;
      ps.forEach((p) => {
        p.vy += 0.3; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.globalAlpha = 1 - k * k; c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col;
        if (p.tri) { c.beginPath(); c.moveTo(-p.w / 2, -p.h / 2); c.lineTo(p.w / 2, -p.h / 2); c.lineTo(0, p.h * 0.8); c.fill(); }
        else c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        c.restore();
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let wake = null;
  async function keepAwake() {
    try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch { /* تجاهل */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wake === null && window.__fzAwake) keepAwake(); });
  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* تجاهل */ } };

  // حلقة الوقت (SVG) — k من ١ إلى ٠
  const ring = (k, label, cls = '') => `<div class="ring ${cls}" style="--k:${Math.max(0, Math.min(1, k)).toFixed(3)}"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="r-bg" cx="22" cy="22" r="19"/><circle class="r-fg" cx="22" cy="22" r="19" pathLength="100"/></svg><b>${label}</b></div>`;

  // رايات الساحة (زينة): مثلثات بألوان الفرق على حبل
  function bunting(n = 14) {
    let s = '<svg class="bunting" viewBox="0 0 ' + n * 40 + ' 46" preserveAspectRatio="none" aria-hidden="true"><path class="rope" d="M0 6 Q' + n * 20 + ' 22 ' + n * 40 + ' 6"/>';
    for (let i = 0; i < n; i++) {
      const x = i * 40 + 20, y = 6 + 16 * (1 - Math.pow((x - n * 20) / (n * 20), 2)) * 0.98;
      s += `<path class="flag f${i % 6}" style="--i:${i}" d="M${x - 13} ${y - 1}L${x + 13} ${y - 1}L${x} ${y + 22}Z"/>`;
    }
    return s + '</svg>';
  }

  return {
    $, $$, S, FX, store, ar, toLatin, esc, num, plus, clock, parseNum, rng, R, shuffle, uid,
    TEAM_COLORS, TEAM_NAMES, teamList, members, RANK_PTS, rankBy, speedPts, km,
    THEME_KEY, GAME_THEMES, setTheme, initChrome, show, toast, confirmBox, confetti, reduced, keepAwake, vibrate, ring, bunting
  };
})();
