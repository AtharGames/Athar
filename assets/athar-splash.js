/* =========================================================
   شاشة البداية: الأصوات، بدء الانتقال، ثم إزالتها وإعادة التمرير
   (الحركة نفسها في assets/athar-splash.css)
   الأصوات مؤثرات هواء مولّدة عبر Web Audio API، بلا موسيقى ولا آلات،
   وتحترم إعداد كتم الصوت المشترك (athar-sound) في localStorage.
   ========================================================= */
(() => {
  'use strict';
  const root = document.documentElement;
  const splash = document.getElementById('splash');
  if (!splash || !root.classList.contains('splash-on')) return;

  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TOTAL = reduced ? 1300 : 3500;  // المدة الكلية بالملي ثانية
  const LEAVE = reduced ? 1000 : 2900;  // بداية الانتقال
  const t0 = performance.now();
  let done = false, skipped = false;

  /* ---------- الأصوات ---------- */
  let soundOn = !reduced;
  try { if (localStorage.getItem('athar-sound') === '0') soundOn = false; } catch { /* تجاهل */ }

  let ctx = null, master = null, noiseBuf = null, scheduled = false;

  // الزمن المنقضي من الحركة بالثواني (نقرأه من حركة الشاشة نفسها إن أمكن)
  function elapsed() {
    try {
      const a = splash.getAnimations().find((x) => x.animationName === 'splash-out');
      if (a && typeof a.currentTime === 'number') return a.currentTime / 1000;
    } catch { /* تجاهل */ }
    return (performance.now() - t0) / 1000;
  }

  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    return s;
  }

  // نفخة هواء مفلترة: التردد ينزلق من f0 إلى f1، والصوت يتحرك بين السماعتين من pan0 إلى pan1
  function air(t, { dur, vol, f0, f1 = f0, q = 1, atk = 0.08, type = 'bandpass', pan0 = 0, pan1 = pan0, flutter = 0 }) {
    const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g);
    let out = g;
    // رفرفة سريعة في الشدة تعطي إحساس اللمعان
    if (flutter) {
      const trem = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
      trem.gain.value = 0.55; lfo.frequency.value = flutter; depth.gain.value = 0.45;
      lfo.connect(depth); depth.connect(trem.gain);
      g.connect(trem); out = trem;
      lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(pan0, t);
      if (pan1 !== pan0) p.pan.linearRampToValueAtTime(pan1, t + dur);
      out.connect(p); out = p;
    }
    out.connect(master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  // إشارات الصوت على الخط الزمني (بالثواني من بداية الحركة)
  const CUES = [
    // نَفَس خافت مع ظهور الأيقونة
    [0.00, () => ({ dur: 0.65, vol: 0.3, f0: 260, f1: 720, q: 0.8, atk: 0.3 })],
    // سبلاش: هبّة هواء تعبر من اليمين إلى اليسار مع كشف الاسم
    [0.65, () => ({ dur: 0.95, vol: 0.55, f0: 480, f1: 2600, q: 1.1, atk: 0.45, pan0: 0.7, pan1: -0.7 })],
    [0.65, () => ({ dur: 0.95, vol: 0.16, f0: 180, f1: 420, q: 0.7, atk: 0.4, pan0: 0.5, pan1: -0.5 })],
    // وشّة قصيرة مع تمدد الخط
    [1.60, () => ({ dur: 0.4, vol: 0.16, f0: 3200, f1: 6400, q: 2, atk: 0.12 })],
    // اللمعة: هواء حادّ مرفرف يعبر مع شريط الضوء
    [2.02, () => ({ dur: 0.75, vol: 0.2, f0: 6500, f1: 9500, q: 3, atk: 0.3, type: 'highpass', pan0: 0.6, pan1: -0.6, flutter: 26 })],
    // الانتقال: سحبة هواء نازلة مع تلاشي الشاشة
    [2.90, () => ({ dur: 0.6, vol: 0.8, f0: 2400, f1: 260, q: 0.9, atk: 0.2 })],
  ];

  // جدولة الإشارات التي لم يفت وقتها بعد
  function schedule() {
    if (scheduled || done || skipped || !ctx || ctx.state !== 'running') return;
    scheduled = true;
    const now = elapsed();
    CUES.forEach(([at, make]) => {
      if (at + 0.05 >= now) air(ctx.currentTime + Math.max(0, at - now) + 0.02, make());
    });
  }

  function initSound() {
    if (!soundOn) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ctx = new C();
      // الهواء المفلتر خافت بطبعه فنرفعه، ومحدِّد يمنع أي تشويش
      master = ctx.createGain(); master.gain.value = 4;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.ratio.value = 12;
      const out = ctx.createGain(); out.gain.value = 0.6;
      master.connect(limiter); limiter.connect(out); out.connect(ctx.destination);
      ctx.addEventListener('statechange', schedule);
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      schedule();
    } catch { ctx = null; }
  }

  /* ---------- الانتقال والإنهاء ---------- */
  // بدء الانتقال: نطلق حركة دخول عناصر الصفحة خلف الشاشة
  function leave() { root.classList.add('splash-leaving'); }

  // إزالة الشاشة وإعادة التمرير
  function finish() {
    if (done) return;
    done = true;
    root.classList.remove('splash-on', 'splash-leaving');
    splash.remove();
    if (ctx) setTimeout(() => { try { ctx.close(); } catch { /* تجاهل */ } }, 900);
  }

  // تخطٍّ باللمس أو بأي مفتاح (اللمسة تسمح للمتصفح بالصوت فنُسمع سحبة الخروج)
  function skip() {
    if (done || skipped) return;
    skipped = true;
    leave();
    splash.classList.add('is-skipped');
    if (ctx && soundOn) {
      const play = () => { try { air(ctx.currentTime + 0.01, { dur: 0.35, vol: 0.45, f0: 2200, f1: 300, q: 0.9, atk: 0.1 }); } catch { /* تجاهل */ } };
      if (ctx.state === 'running') play();
      else ctx.resume().then(play).catch(() => {});
    }
    setTimeout(finish, 380);
  }

  splash.addEventListener('animationstart', (e) => {
    if (e.target === splash && e.animationName === 'splash-out') leave();
  });
  // الإنهاء عند اكتمال حركة التلاشي نفسها، مع مؤقتات احتياطية
  splash.addEventListener('animationend', (e) => {
    if (e.target === splash && e.animationName === 'splash-out') finish();
  });
  setTimeout(leave, LEAVE);
  setTimeout(finish, TOTAL + 400);

  splash.addEventListener('pointerdown', skip);
  document.addEventListener('keydown', skip, { once: true });

  initSound();
})();
