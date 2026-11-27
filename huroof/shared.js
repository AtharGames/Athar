/* =========================================================
   إنسان حيوان جماد | أدوات مشتركة بين شاشة المقدّم وصفحة المشارك
   (الحروف، تطبيع الإجابات، التصحيح الآلي، النقاط، الأصوات، الثيمات، النوافذ)
   ========================================================= */
window.HUI = (() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.AtharSound;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } }
  };

  // ---------- أرقام ونصوص ----------
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // رقم بإشارة + معزول حتى لا تنقلب الإشارة داخل النص العربي
  const plus = (n) => `⁦+${ar(n)}⁩`;
  const clock = (sec) => { sec = Math.max(0, Math.ceil(sec)); return ar(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`); };

  // ---------- الحروف ----------
  const LETTERS = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي'];
  const HARD = 'ثذضظ'; // حروف صعبة مستبعدة افتراضيًا (يقدر المقدّم يرجّعها)

  // الخانات الافتراضية، ويقدر المقدّم يعدّلها
  const DEFAULT_CATS = ['إنسان', 'حيوان', 'جماد', 'بلاد'];
  const SUGGEST = ['نبات', 'أكلة', 'مهنة', 'لون', 'مدينة', 'فاكهة', 'اسم بنت', 'اسم ولد', 'صحابي', 'سورة', 'ماركة', 'رياضة'];
  const MAX_CATS = 8;

  // ---------- تطبيع الإجابة للمقارنة ----------
  // يشيل التشكيل والتطويل والمسافات، ويوحّد الهمزات والتاء المربوطة والألف المقصورة
  function norm(s) {
    return String(s || '')
      .replace(/[ً-ٰٟـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[^ء-يa-zA-Z0-9]/g, '')
      .toLowerCase();
  }
  // بدون «ال» التعريف في البداية
  const core = (s) => { const n = norm(s); return n.length > 3 && n.startsWith('ال') ? n.slice(2) : n; };
  // هل تبدأ الإجابة بالحرف؟ («ال» ما تُحسب: البرازيل تصلح لحرف الباء)
  function startsWith(answer, letter) {
    const n = norm(answer), L = norm(letter);
    if (!n || !L) return false;
    if (n.startsWith(L)) return true;
    return n.startsWith('ال') && n.slice(2).startsWith(L);
  }

  // ---------- التصحيح الآلي لجولة ----------
  // answers: { pid: { 0:'..', 1:'..' } }  ← النتيجة: { pid: [حالة لكل خانة] }
  // الحالات: ok صحيح ووحيد، dup صحيح ومكرر، bad خطأ أو لا يبدأ بالحرف، empty فارغ
  function autoMarks(answers, nCats, letter) {
    const marks = {}, count = [];
    for (let i = 0; i < nCats; i++) count.push({});
    Object.keys(answers || {}).forEach((pid) => {
      const v = answers[pid] || {};
      marks[pid] = [];
      for (let i = 0; i < nCats; i++) {
        const a = (v[i] || '').trim();
        if (!a) { marks[pid][i] = 'empty'; continue; }
        if (!startsWith(a, letter)) { marks[pid][i] = 'bad'; continue; }
        marks[pid][i] = 'ok';
        const k = core(a);
        count[i][k] = (count[i][k] || 0) + 1;
      }
    });
    Object.keys(marks).forEach((pid) => {
      const v = answers[pid] || {};
      marks[pid].forEach((m, i) => { if (m === 'ok' && count[i][core(v[i])] > 1) marks[pid][i] = 'dup'; });
    });
    return marks;
  }
  // ---------- التصحيح مع حكم الذكاء الاصطناعي ----------
  // verdict: { '<الخانة>|<الإجابة بعد التطبيع>': { ok, key, why } } (من HuroofAI)
  // ← { marks: { pid: [حالة] }, notes: { pid: [سبب الخطأ] }, ai: { pid: [هل حكم عليها الذكاء؟] } }
  const aiKey = (i, a) => `${i}|${norm(a)}`;
  function smartMarks(answers, nCats, letter, verdict) {
    const marks = {}, notes = {}, ai = {}, count = [], keys = {};
    for (let i = 0; i < nCats; i++) count.push({});
    Object.keys(answers || {}).forEach((pid) => {
      const v = answers[pid] || {};
      marks[pid] = []; notes[pid] = []; ai[pid] = []; keys[pid] = [];
      for (let i = 0; i < nCats; i++) {
        const a = (v[i] || '').trim();
        notes[pid][i] = ''; ai[pid][i] = false;
        if (!a) { marks[pid][i] = 'empty'; continue; }
        if (!startsWith(a, letter)) { marks[pid][i] = 'bad'; notes[pid][i] = `ما تبدأ بحرف «${letter}»`; continue; }
        const w = verdict && verdict[aiKey(i, a)];
        if (w) {
          ai[pid][i] = true;
          if (!w.ok) { marks[pid][i] = 'bad'; notes[pid][i] = w.why || 'غير صحيحة'; continue; }
        }
        marks[pid][i] = 'ok';
        // التكرار بالصيغة الموحّدة من الذكاء إن وُجدت
        const k = core((w && w.key) || a) || core(a);
        keys[pid][i] = k;
        count[i][k] = (count[i][k] || 0) + 1;
      }
    });
    Object.keys(marks).forEach((pid) => {
      marks[pid].forEach((m, i) => { if (m === 'ok' && count[i][keys[pid][i]] > 1) marks[pid][i] = 'dup'; });
    });
    return { marks, notes, ai };
  }
  // الإجابات المختلفة اللي تحتاج حكم الذكاء (تبدأ بالحرف وما حُكم عليها)
  function aiItems(answers, nCats, letter, verdict) {
    const seen = new Set(), items = [];
    Object.keys(answers || {}).forEach((pid) => {
      const v = answers[pid] || {};
      for (let i = 0; i < nCats; i++) {
        const a = (v[i] || '').trim(), k = aiKey(i, a);
        if (!a || seen.has(k) || !startsWith(a, letter) || (verdict && verdict[k])) continue;
        seen.add(k);
        items.push({ id: items.length, c: i, a, k });
      }
    });
    return items;
  }

  const pointsOf = (mark, s) => (mark === 'ok' ? s.pu : mark === 'dup' ? s.pd : 0);

  // مجموع كل مشارك من الجولات المعتمدة
  function totals(room) {
    const t = {}, g = (room && room.g) || {};
    Object.keys(g).forEach((r) => {
      const sc = g[r].s || {};
      Object.keys(sc).forEach((pid) => { t[pid] = (t[pid] || 0) + sum(sc[pid]); });
    });
    return t;
  }
  const sum = (arr) => Object.values(arr || {}).reduce((a, b) => a + (+b || 0), 0);
  const asList = (o, n) => { const out = []; for (let i = 0; i < n; i++) out.push((o && o[i]) || ''); return out; };
  const catsOf = (s) => (s && s.cats ? Object.values(s.cats) : DEFAULT_CATS.slice());
  const roundsDone = (room) => Object.keys((room && room.g) || {}).map(Number).sort((a, b) => a - b);

  // ترتيب المشاركين بالمجموع (المتساوون بنفس المركز)
  function ranking(room) {
    const t = totals(room), p = (room && room.p) || {};
    const list = Object.keys(p).map((pid) => ({ pid, name: p[pid].n, on: p[pid].on !== false, total: t[pid] || 0 }))
      .sort((a, b) => b.total - a.total || (a.name < b.name ? -1 : 1));
    let rank = 0, last = null;
    list.forEach((x, i) => { if (x.total !== last) { rank = i + 1; last = x.total; } x.rank = rank; });
    return list;
  }

  // لون ثابت لكل مشارك من ألوان فرق أثَر
  const COLORS = ['#E8554E', '#E59A1C', '#1FA971', '#8257E5', '#E0559B', '#0FA3B1'];
  const colorOf = (pid) => {
    let h = 0;
    for (const ch of String(pid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return COLORS[h % COLORS.length];
  };

  // =========================================================
  // مؤثرات اللعبة: تصفيرة «قف!» وخربشة القلم وتقليب الحروف
  // (مؤثرات فم وورق فقط، بلا موسيقى ولا آلات، وتحترم زر الكتم)
  // =========================================================
  const FX = (() => {
    let ctx = null, out = null, nbuf = null;
    function ac() {
      if (!S || !S.on) return null;
      try {
        if (!ctx) {
          const C = window.AudioContext || window.webkitAudioContext;
          if (!C) return null;
          ctx = new C();
          out = ctx.createDynamicsCompressor(); out.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
      } catch { return null; }
    }
    // فك الصوت في الجوال مع أول لمسة
    ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, () => { if (S && S.on) ac(); }, { capture: true, passive: true }));
    function noise(c) {
      if (!nbuf) {
        nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = nbuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource(); s.buffer = nbuf; s.loop = true; return s;
    }
    // تصفيرة حكم بالفم: نغمة عالية بترعيد سريع ونَفَس
    function whistle(delay = 0, dur = 0.7) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      [0, dur * 0.55].forEach((st, k) => {
        const len = k ? dur * 0.6 : dur * 0.42;
        const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        o.type = 'sine'; o.frequency.value = k ? 2650 : 2850;
        lfo.frequency.value = 38; lg.gain.value = 0.5;
        const am = c.createGain(); am.gain.value = 0.5;
        lfo.connect(lg).connect(am.gain);
        g.gain.setValueAtTime(0.0001, t + st);
        g.gain.exponentialRampToValueAtTime(0.22, t + st + 0.02);
        g.gain.setValueAtTime(0.22, t + st + len - 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + st + len);
        o.connect(am).connect(g).connect(out);
        o.start(t + st); lfo.start(t + st); o.stop(t + st + len + 0.05); lfo.stop(t + st + len + 0.05);
        // نَفَس الهواء مع التصفيرة
        const n = noise(c), f = c.createBiquadFilter(), ng = c.createGain();
        f.type = 'bandpass'; f.frequency.value = 2800; f.Q.value = 2;
        ng.gain.setValueAtTime(0.0001, t + st);
        ng.gain.exponentialRampToValueAtTime(0.08, t + st + 0.02);
        ng.gain.exponentialRampToValueAtTime(0.0001, t + st + len);
        n.connect(f).connect(ng).connect(out); n.start(t + st); n.stop(t + st + len + 0.05);
      });
    }
    // خربشة قلم رصاص على الورق: دفعات ضجيج قصيرة
    function scribble(strokes = 3, delay = 0, vol = 0.16) {
      const c = ac(); if (!c) return;
      for (let k = 0; k < strokes; k++) {
        const t = c.currentTime + delay + k * 0.075, len = 0.05 + Math.random() * 0.03;
        const n = noise(c), f = c.createBiquadFilter(), g = c.createGain();
        f.type = 'bandpass'; f.frequency.setValueAtTime(3200 + Math.random() * 1600, t); f.Q.value = 1.4;
        f.frequency.linearRampToValueAtTime(2200, t + len);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + len + 0.02);
      }
    }
    // تقليب ورقة «فرّ»
    function flip(delay = 0, vol = 0.12) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      const n = noise(c), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'highpass'; f.frequency.value = 1800;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 0.06);
    }
    return { whistle, scribble, flip };
  })();

  // ---------- عجلة الحروف: تقليب سريع ثم ثبات بارتداد ----------
  function rollLetter(node, final, { pool = LETTERS, dur = 1500, sound = true } = {}) {
    return new Promise((res) => {
      const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      node.classList.remove('landed');
      if (reduce) { node.textContent = final; node.classList.add('landed'); res(); return; }
      node.classList.add('rolling');
      const t0 = performance.now();
      let last = 0;
      const step = (t) => {
        const k = (t - t0) / dur;
        if (k >= 1) {
          node.textContent = final;
          node.classList.remove('rolling'); void node.offsetWidth; node.classList.add('landed');
          if (sound && S) S.drop(420, 0, 0.26);
          res(); return;
        }
        // يتباطأ تدريجيًا مثل العجلة
        const gap = 45 + 260 * k * k;
        if (t - last > gap) {
          last = t;
          node.textContent = pool[(Math.random() * pool.length) | 0];
          if (sound) FX.flip(0, 0.07 + 0.05 * k);
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
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

  // ---------- قصاصات ورق ملوّنة عند الفوز ----------
  function confetti(canvas, { x = 0.5, y = 0.4, count = 120 } = {}) {
    if (!canvas || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ['#F59E0B', '#FACC15', '#5CC2F5', '#1E6FE0', '#16A34A', '#E5484D', '#FFFFFF'];
    const ps = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 9;
      return { x: W * x, y: H * y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, w: 7 + Math.random() * 6, h: 4 + Math.random() * 5,
        r: Math.random() * 6, vr: (Math.random() - .5) * .4, col: cols[(Math.random() * cols.length) | 0] };
    });
    const t0 = performance.now(), DUR = 2100;
    const tick = (t) => {
      const k = (t - t0) / DUR;
      c.clearRect(0, 0, W, H);
      if (k >= 1) return;
      ps.forEach((p) => {
        p.vy += 0.3; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        c.save(); c.globalAlpha = 1 - k * k; c.translate(p.x, p.y); c.rotate(p.r);
        c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        c.restore();
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- إبقاء الشاشة مضاءة أثناء اللعب ----------
  let wake = null;
  async function keepAwake() {
    try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch { /* تجاهل */ }
  }

  const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* تجاهل */ } };

  // علامة التصحيح بقلم المعلم
  const MARK = {
    ok: { sym: '✓', label: 'صح' },
    dup: { sym: '✓', label: 'مكرر' },
    bad: { sym: '✗', label: 'خطأ' },
    todo: { sym: '؟', label: 'تحتاج تصحيح' },
    empty: { sym: '—', label: 'فاضي' }
  };

  return {
    $, $$, S, FX, store, ar, toLatin, esc, plus, clock, LETTERS, HARD, DEFAULT_CATS, SUGGEST, MAX_CATS,
    norm, core, startsWith, autoMarks, smartMarks, aiItems, aiKey, pointsOf, totals, sum, asList, catsOf, roundsDone, ranking, colorOf,
    rollLetter, initChrome, setTheme, show, toast, confirmBox, confetti, keepAwake, vibrate, MARK
  };
})();
