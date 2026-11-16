/* =========================================================
   أصوات أثَر المشتركة
   مؤثرات من الطبيعة ومن الفم فقط، بلا موسيقى ولا آلات.
   تُولَّد داخل المتصفح عبر Web Audio API بلا ملفات صوتية.
   الاستخدام: AtharSound.drop(480) ، AtharSound.toggle() ...
   ========================================================= */
window.AtharSound = (() => {
  'use strict';
  const KEY = 'athar-sound';
  let ctx = null, master = null, noiseBuf = null, on = true;
  try { on = localStorage.getItem(KEY) !== '0'; } catch { /* تجاهل */ }

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

  // هواء مفلتر: أساس النَّفَس والريح
  function air(t, { dur, vol, f0, f1 = f0, q = 1, atk = 0.005 }) {
    const c = ctx;
    const s = noise(c), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.Q.value = q;
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
  function drop(freq = 480, delay = 0, vol = 0.24) {
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

  // نَفَس خاطف «ووش»، صاعد أو هابط
  function whoosh(up = true, delay = 0) {
    const c = ac(); if (!c) return;
    air(c.currentTime + delay, up
      ? { dur: 0.34, vol: 0.2, f0: 600, f1: 2400, q: 1.2, atk: 0.2 }
      : { dur: 0.4, vol: 0.2, f0: 2200, f1: 500, q: 1.2, atk: 0.03 });
  }

  // هبّة ريح قوية
  function gust(delay = 0) {
    const c = ac(); if (!c) return;
    air(c.currentTime + delay, { dur: 0.85, vol: 0.35, f0: 2600, f1: 380, q: 0.8, atk: 0.02 });
  }

  return {
    get on() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* تجاهل */ }
      if (on) tongue(0, 0.22);
      return on;
    },
    tongue, drop, chirp, sigh, whoosh, gust
  };
})();
