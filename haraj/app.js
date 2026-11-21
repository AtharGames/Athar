/* =========================================================
   على السَّوم | حرّاج السيارات — منطق المسابقة
   على نمط «سهمك الصاعد»: رصيد لكل فريق، والإجابة الصحيحة = عمولة + دخول الحراج،
   ثم مزاد حي على السيارات بمطرقة تعدّ لحالها، وحالة مخفية تنكشف بعد البيع،
   وأسعار الموديلات تتغيّر كل جولة (حظ + منطق)، والشريطي يزاحم ويشتري.
   ========================================================= */
(() => {
  'use strict';

  const S = window.AtharSound || { on: false, toggle: () => false, tongue() {}, drop() {}, chirp() {}, sigh() {}, whoosh() {}, gust() {}, winner() {} };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // تخزين آمن (قد يُمنع localStorage في بعض المتصفحات)
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    raw(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } }
  };

  // =========================================================
  // الثوابت
  // =========================================================
  const THEMES = ['lot', 'sand', 'light', 'navy', 'blue'];
  const ATHAR_THEMES = ['light', 'navy', 'blue'];
  const THEME_KEY = 'athar-haraj-theme';
  const CFG_KEY = 'athar-haraj-cfg', SAVE_KEY = 'athar-haraj-save', USED_KEY = 'athar-haraj-used';

  const TEAM_COLORS = ['#E8554E', '#E59A1C', '#1FA971', '#8257E5', '#E0559B', '#0FA3B1'];
  const TEAM_NAMES = ['الفريق الأول', 'الفريق الثاني', 'الفريق الثالث', 'الفريق الرابع', 'الفريق الخامس', 'الفريق السادس'];
  const FLAG_COLORS = ['#E8554E', '#FFC21A', '#1E6FE0', '#1FA971', '#F97316', '#8257E5'];

  // الموديلات: السعر الأساسي لرصيد ١٥٠ ألف (يتناسب مع الرصيد الذي يختاره المقدّم)
  const MODELS = [
    { name: 'أكسنت', body: 'sedan', base: 42000 },
    { name: 'سوناتا', body: 'sedan', base: 68000 },
    { name: 'كامري', body: 'sedan', base: 92000 },
    { name: 'كابرس', body: 'sedan', base: 105000 },
    { name: 'ددسن', body: 'pickup', base: 38000 },
    { name: 'هايلكس', body: 'pickup', base: 86000 },
    { name: 'شاص', body: 'pickup', base: 150000 },
    { name: 'يوكن', body: 'suv', base: 190000 },
    { name: 'باترول', body: 'suv', base: 215000 },
    { name: 'لاندكروزر', body: 'suv', base: 250000 }
  ];
  const PAINTS = [
    { n: 'أبيض', c: '#F4F6F8' }, { n: 'أسود', c: '#2A2E35' }, { n: 'فضي', c: '#B8BEC7' }, { n: 'رمادي', c: '#6B737D' },
    { n: 'أحمر', c: '#D93A3F' }, { n: 'كحلي', c: '#24427E' }, { n: 'بيج', c: '#D9C7A3' }, { n: 'عنابي', c: '#7A1F2B' },
    { n: 'زيتي', c: '#5B6B3A' }, { n: 'ذهبي', c: '#C9A24A' }
  ];
  // الحالة المخفية: تنكشف بعد البيع (f معامل القيمة، w وزن الظهور)
  const CONDS = [
    { k: 'blanc', t: 'كرت بلانش!', d: 'نظيفة نظافة، ولا فيها خدش', f: 1.25, w: 1, tone: 'good' },
    { k: 'agency', t: 'وكالة ما فتحت', d: 'صيانتها بالوكالة وكل شي موثّق', f: 1.12, w: 2, tone: 'good' },
    { k: 'clean', t: 'سليمة', d: 'ما فيها شي يذكر', f: 1, w: 3, tone: 'mid' },
    { k: 'paint', t: 'فيها رش', d: 'رش خفيف على الرفرف والباب', f: 0.88, w: 2, tone: 'mid' },
    { k: 'crash', t: 'مصدومة ومعدّلة', d: 'صدمة أمامية ومعدّلة عند ورشة', f: 0.72, w: 1.5, tone: 'bad' },
    { k: 'gear', t: 'القير يرفس!', d: 'تبي لها قير جديد', f: 0.62, w: 1, tone: 'bad' },
    { k: 'engine', t: 'مكينة ضاربة!', d: 'المكينة تبي فتح من أولها', f: 0.48, w: 0.6, tone: 'bad' }
  ];
  // ملاحظة صاحب السيارة: أحيانًا تصدق وأحيانًا لا
  const NOTES = {
    good: ['سيارة شيخ، ما تشكي من شي', 'ما تنزل من كراجها إلا يوم الجمعة', 'مكيفها يجمّد الموية', 'على الفحص، وأتحدى', 'راعيها مسافر ويبي يبيعها على السريع', 'صيانتها كلها بالوكالة'],
    bad: ['فيها ملاحظات بسيطة', 'تشغيل وتمشي', 'على الكرت… وما أضمن شي', 'تبي لها شوية لمسات', 'صوت خفيف من تحت… عادي', 'أبيعها على حالها'],
    any: ['ممشاها قليل وراعيها ما يطلع إلا للمسجد', 'ما ينقصها إلا الكلام', 'الصبغ وكالة… تقريبًا', 'استخدام عائلي', 'لا تسأل عن السعر، تعال وشوف']
  };

  const ANSWER_TIMES = [15, 30, 45, 60, 90];
  const LOT_OPTIONS = [1, 2, 3];
  const ROUND_OPTIONS = [0, 4, 6, 8];          // صفر = مفتوح، والمقدّم ينهيها
  const HAMMER_OPTIONS = [2, 3, 4, 6, 0];      // صفر = يدوي
  const SURPRISE_CHANCE = 0.25;
  const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ'];
  const LEVELS = ['سهل', 'متوسط', 'صعب'];

  // العبارات العفوية ({t} الفريق، {p} المبلغ، {s} الزيادة، {m} الموديل)
  const TXT = {
    turn: ['الدور الآن على', 'يله دوركم يا', 'السؤال عليكم يا', 'فرصتكم يا'],
    right: ['كفو يا {t}!', 'يا سلام عليكم يا {t}!', 'ضربة معلّم يا {t}!', 'عداكم العيب يا {t}!', 'هذا الشغل يا {t}!'],
    wrong: ['أفا! الجواب غلط', 'وييين خطأ!', 'راحت عليكم يا {t}!', 'معليش، الجايات أكثر'],
    timeout: ['خلص الوقت!', 'راح الوقت عليكم يا {t}!'],
    open: ['على السوووم! مين يفتح؟', 'السوم يبدأ من {p}… مين يفتح؟', 'يا جماعة الخير، السيارة تنتظركم!'],
    bid: ['السوم وصل {p}… مين يزيد؟', '{t} سامت بـ{p}!', '{p}! زيدوا يا جماعة', 'كفو يا {t}! {p}', 'على السوم {p}… فيه أحد؟'],
    call1: ['{p}… أول مرة', 'على السوم {p}… أول مرة'],
    call2: ['{p}… ثاني مرة!', 'ثاني مرة… آخر فرصة!'],
    none1: ['ما أحد يفتح؟', 'يا جماعة السيارة نظيفة!'],
    none2: ['آخر نداء… ما أحد يبيها؟'],
    soldTeam: ['مبروك عليكم يا {t}! الله يجعلها فال خير', 'الله يبارك لكم فيها يا {t}', 'بالبركة يا {t}! بـ{p} وهي لكم'],
    dealerBid: ['الشريطي: زِد {s} وخلّها عليّ!', 'الشريطي دخل على الخط! {p}', 'الشريطي: أنا آخذها بـ{p}', 'الشريطي يحك راسه… {p}!'],
    dealerWin: ['الشريطي لهفها!', 'راحت للشريطي… عداكم العيب!', 'الشريطي لهفها من تحت خشومكم!'],
    unsold: ['ما أحد سام… رجعت لراعيها', 'ولا سوم!؟ ترجع المعرض'],
    gainBig: ['لهفتوها لهف يا {t}!', 'فاااال طيب يا {t}!', 'يا فنان! صفقة العمر'],
    gain: ['كسبانين يا {t}!', 'زينة والله يا {t}', 'ما شاء الله، شريتوا صح'],
    even: ['راس براس… لا كسب ولا خسارة', 'شريتوها بقيمتها بالضبط'],
    loss: ['أفا! طلعت مقلب', 'يا ساتر… شربتوها يا {t}!', 'الله يعوّض عليكم يا {t}'],
    dealerIdle: ['الشريطي يتفرّج… ويحسب', 'الشريطي ساكت… وعينه على السيارة', 'الشريطي يشرب شاهي ويراقب']
  };

  // =========================================================
  // أدوات
  // =========================================================
  const ar = (s) => String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const num = (n) => ar(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬');
  const iso = (s) => '⁦' + s + '⁩';   // عزل الأرقام ذات الإشارة داخل النص العربي
  const signed = (n) => iso((n > 0 ? '+' : n < 0 ? '−' : '') + num(Math.abs(n)));
  // المبالغ بالعامية: ٤٥ ألف، ١٢٠ ألف، وإلا الرقم كاملًا
  const money = (n) => (n >= 1000 && n % 1000 === 0 ? `${num(n / 1000)} ألف` : num(n));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const r500 = (n) => Math.max(500, Math.round(n / 500) * 500);
  const r1000 = (n) => Math.max(1000, Math.round(n / 1000) * 1000);
  const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rint(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fill = (s, v = {}) => s.replace(/\{(\w)\}/g, (_, k) => (v[k] != null ? v[k] : ''));
  const say = (k, v) => fill(pick(TXT[k]), v);
  const secLabel = (s) => (s % 60 ? `${num(s)} ث` : `${num(s / 60)} د`);
  const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const weighted = (list) => { let r = Math.random() * list.reduce((s, x) => s + x.w, 0); for (const x of list) { if ((r -= x.w) <= 0) return x; } return list[list.length - 1]; };
  // أقرب زيادة «مرتبة» لمبلغ ما
  const NICE = [500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];
  const nice = (n) => NICE.find((x) => x >= n * 0.85) || NICE[NICE.length - 1];

  const ICON = {
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 8h-4.5v6h-5v-6H5z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19l-7-8h4.5V5h5v6H19z"/></svg>',
    flat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10.5h14v3H5z"/></svg>'
  };

  // =========================================================
  // رسومات SVG: السيارة والمطرقة والشريطي
  // =========================================================
  const BODY = {
    sedan: {
      body: 'M10 80Q8 66 22 62L60 56Q80 36 106 32L150 32Q172 32 190 52L216 58Q232 62 232 76L232 86Q232 92 224 92L16 92Q10 92 10 86Z',
      glass: 'M68 56Q84 40 104 38L118 38L118 56ZM124 38L148 38Q166 40 182 56L124 56Z',
      line: 'M121 58V90M10 78H232', extra: '', wheels: [58, 186], wy: 92
    },
    suv: {
      body: 'M10 82Q8 64 22 60L52 56L70 28Q74 22 82 22L198 22Q208 22 212 30L224 56Q232 60 232 72L232 86Q232 92 224 92L16 92Q10 92 10 86Z',
      glass: 'M60 56L75 30L116 30L116 56ZM122 30L160 30L160 56L122 56ZM166 30L202 30L214 56L166 56Z',
      line: 'M119 58V90M163 58V90M10 76H232', extra: '<path class="c-rack" d="M86 17H196M100 17V22M180 17V22"/>', wheels: [56, 188], wy: 92
    },
    pickup: {
      body: 'M10 82Q8 64 22 60L54 56L72 28Q76 24 84 24L128 24Q136 24 136 32L136 58L232 58L232 86Q232 92 224 92L16 92Q10 92 10 86Z',
      glass: 'M62 56L78 30L128 30L128 56Z',
      line: 'M100 58V90M136 62H232M10 76H232', extra: '', wheels: [56, 190], wy: 92
    }
  };
  function carSVG(body, cls = '') {
    const b = BODY[body] || BODY.sedan;
    const wheel = (x) => `<g class="c-wheel"><circle cx="${x}" cy="${b.wy}" r="19"/><g class="wheel-rot"><circle class="rim" cx="${x}" cy="${b.wy}" r="9"/><path class="spoke" d="M${x - 9} ${b.wy}H${x + 9}M${x} ${b.wy - 9}V${b.wy + 9}"/></g></g>`;
    return `<svg class="${cls}" viewBox="0 0 242 120" aria-hidden="true">
      <ellipse class="shadow" cx="121" cy="112" rx="112" ry="6"/>
      <g class="car">
        <path class="c-body" d="${b.body}"/>${b.extra}
        <path class="c-glass" d="${b.glass}"/>
        <path class="c-line" d="${b.line}"/>
        <path class="c-lamp" d="M12 68Q12 64 20 63L32 62L30 71L14 72Z"/>
        <rect class="c-tail" x="226" y="${body === 'pickup' ? 64 : 62}" width="6" height="10" rx="2"/>
        ${b.wheels.map(wheel).join('')}
      </g>
    </svg>`;
  }
  const GAVEL = `<svg class="gavel" id="gavel" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M24 38L58 6" stroke="var(--car-line)" stroke-width="10" stroke-linecap="round"/>
    <path d="M24 38L58 6" stroke="#B7773D" stroke-width="6" stroke-linecap="round"/>
    <g transform="rotate(-43 21 40)"><rect class="g-head" x="3" y="31" width="36" height="18" rx="6"/><rect class="g-band" x="11" y="31" width="4" height="18"/><rect class="g-band" x="27" y="31" width="4" height="18"/></g>
  </svg>`;
  const DEALER = `<svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M6 47c2-10 9-14 18-14s16 4 18 14z" fill="#F4F1EA" stroke="#2B2B2B" stroke-width="1.5"/>
    <path d="M9 31C8 15 14 7 24 7s16 8 15 24l-4-2c0-10-4-15-11-15S13 19 13 29z" fill="#D93A3F"/>
    <circle cx="24" cy="25" r="10" fill="#E0B48A"/>
    <path d="M12 19c3-8 21-8 24 0-6-3-18-3-24 0z" fill="#D93A3F"/>
    <path d="M14 15l4 4M20 13l4 4M26 13l4 4M31 15l3 3" stroke="#fff" stroke-width="1.2" opacity=".7"/>
    <ellipse cx="24" cy="14" rx="12" ry="3" fill="#1B1B1B"/>
    <rect x="15.5" y="22" width="7.5" height="4.5" rx="1.8" fill="#111"/><rect x="25" y="22" width="7.5" height="4.5" rx="1.8" fill="#111"/>
    <path d="M23 23.5h2" stroke="#111" stroke-width="1.4"/>
    <path d="M19 30.5c2 1.6 8 1.6 10 0" stroke="#3B2A1A" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  </svg>`;

  // أعلام الحراج حسب عرض الحاوية
  function fillBunting(box) {
    if (!box) return;
    const n = Math.max(6, Math.floor((box.clientWidth || 360) / 34));
    if (box.childElementCount === n) return;
    box.innerHTML = Array.from({ length: n }, (_, k) => `<i style="--c:${FLAG_COLORS[k % FLAG_COLORS.length]};--d:${(-k * 0.27).toFixed(2)}s"></i>`).join('');
  }
  const refreshBunting = () => $$('.bunting').forEach(fillBunting);

  // =========================================================
  // المؤثرات الصوتية الخاصة باللعبة (Web Audio، بلا موسيقى ولا آلات)
  // =========================================================
  const FX = (() => {
    let ctx = null, out = null, nb = null;
    function ac() {
      if (!S.on) return null;
      try {
        if (!ctx) {
          const C = window.AudioContext || window.webkitAudioContext;
          if (!C) return null;
          ctx = new C();
          out = ctx.createDynamicsCompressor();
          out.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return ctx;
      } catch { return null; }
    }
    function noise(c) {
      if (!nb) {
        nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource(); s.buffer = nb; s.loop = true; return s;
    }
    function env(g, t, atk, vol, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + atk);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    // نفخة ضوضاء مفلترة
    function burst(t, { dur, vol, f0, f1 = f0, q = 1, type = 'bandpass', atk = 0.003 }) {
      const c = ctx, s = noise(c), f = c.createBiquadFilter(), g = c.createGain();
      f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, atk, vol, dur);
      s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
    // نغمة قصيرة (للطرق والصفير)
    function tone(t, { type = 'sine', f0, f1 = f0, dur, vol, atk = 0.004, lp = 0 }) {
      const c = ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, atk, vol, dur);
      let node = o;
      if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
      node.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
      return o;
    }
    return {
      // محرك يقرّب ثم يهدأ
      engine() {
        const c = ac(); if (!c) return; const t = c.currentTime;
        tone(t, { type: 'sawtooth', f0: 46, f1: 92, dur: 0.9, vol: 0.16, atk: 0.25, lp: 420 });
        tone(t + 0.85, { type: 'sawtooth', f0: 70, f1: 40, dur: 0.6, vol: 0.12, atk: 0.02, lp: 300 });
        burst(t, { dur: 1.3, vol: 0.12, f0: 260, f1: 160, q: 0.7, type: 'lowpass', atk: 0.3 });
        burst(t + 0.95, { dur: 0.25, vol: 0.06, f0: 3200, f1: 2400, q: 6, atk: 0.02 });   // صرير فرامل خفيف
      },
      // بوري مزدوج
      horn(delay = 0) {
        const c = ac(); if (!c) return; const t = c.currentTime + delay;
        [0, 0.2].forEach((d) => {
          tone(t + d, { type: 'square', f0: 410, dur: 0.14, vol: 0.05, atk: 0.01, lp: 1700 });
          tone(t + d, { type: 'square', f0: 517, dur: 0.14, vol: 0.05, atk: 0.01, lp: 1700 });
        });
      },
      // طقّة خشب: «أول مرة… ثاني مرة»
      knock() {
        const c = ac(); if (!c) return; const t = c.currentTime;
        tone(t, { f0: 230, f1: 120, dur: 0.1, vol: 0.4, atk: 0.002 });
        burst(t, { dur: 0.035, vol: 0.28, f0: 1900, q: 3, atk: 0.001 });
      },
      // ضربة المطرقة الأخيرة
      gavel() {
        const c = ac(); if (!c) return; const t = c.currentTime;
        tone(t, { f0: 170, f1: 62, dur: 0.32, vol: 0.7, atk: 0.002 });
        tone(t, { f0: 360, f1: 170, dur: 0.07, vol: 0.32, atk: 0.001 });
        burst(t, { dur: 0.14, vol: 0.55, f0: 900, q: 0.8, type: 'lowpass', atk: 0.001 });
      },
      // تصفيق
      claps(n = 14, delay = 0.15) {
        const c = ac(); if (!c) return; let t = c.currentTime + delay;
        for (let i = 0; i < n; i++) {
          t += rnd(0.05, 0.12);
          burst(t, { dur: 0.06, vol: rnd(0.18, 0.32), f0: rnd(950, 1600), q: 0.9, atk: 0.001 });
        }
      },
      // تصفيرة بالفم «فيو فيو» للشريطي
      whistle() {
        const c = ac(); if (!c) return; const t = c.currentTime;
        tone(t, { f0: 1500, f1: 2600, dur: 0.2, vol: 0.12, atk: 0.03 });
        tone(t + 0.24, { f0: 2500, f1: 1400, dur: 0.36, vol: 0.12, atk: 0.03 });
        burst(t, { dur: 0.6, vol: 0.03, f0: 2200, q: 2, atk: 0.05 });
      },
      // سوم جديد: نقرة وقطرة تعلو
      bid(level = 0) { S.tongue(0, 0.25); S.drop(520 + Math.min(level, 10) * 40, 0.03, 0.22); }
    };
  })();

  // =========================================================
  // بنك ديوان (بلا تكرار، ويُحفظ المستخدم بين الجلسات)
  // =========================================================
  const DW = window.DIWAN_DATA || { diwans: [], questions: [] };
  const QB = DW.diwans.map((d, i) => ({ id: d.id, name: d.title, q: DW.questions.filter((x) => x[0] === i && Array.isArray(x[4]) && x[4].length >= 2) })).filter((c) => c.q.length);
  const Qs = (() => {
    const used = store.get(USED_KEY, {}) || {};
    const eligible = (c, lv) => c.q.map((x, i) => (lv.includes(x[2]) ? i : -1)).filter((i) => i >= 0);
    function next(cats, lv) {
      if (!lv || !lv.length) lv = [0, 1, 2];
      let list = QB.filter((c) => cats.includes(c.id)).map((c) => ({ c, idx: eligible(c, lv) })).filter((x) => x.idx.length);
      if (!list.length) list = QB.map((c) => ({ c, idx: eligible(c, [0, 1, 2]) })).filter((x) => x.idx.length);
      if (!list.length) return null;
      const total = list.reduce((s, x) => s + x.idx.length, 0);
      let r = Math.random() * total, sel = list[0];
      for (const x of list) { if ((r -= x.idx.length) <= 0) { sel = x; break; } }
      const { c: cat, idx } = sel;
      const u = new Set(used[cat.id] || []);
      let free = idx.filter((i) => !u.has(i));
      if (!free.length) { idx.forEach((i) => u.delete(i)); free = idx.slice(); }
      const i = pick(free);
      u.add(i); used[cat.id] = [...u]; store.set(USED_KEY, used);
      const [, , level, q, opts, right, cite] = cat.q[i];
      const order = shuffle(opts.map((_, k) => k));
      return { q, opts: order.map((k) => opts[k]), correct: order.indexOf(right), cat: `${cat.name} · ${LEVELS[level] || ''}`, cite };
    }
    return { next };
  })();

  // =========================================================
  // الإعدادات
  // =========================================================
  const cfg = Object.assign({
    count: 3, names: [], cash: 150000, lots: 2, rounds: 6, hammer: 3,
    qsrc: 'diwan', mode: 'seq', tAnswer: 30, dealer: true, luck: true,
    cats: QB.map((c) => c.id), levels: [0, 1, 2]
  }, store.get(CFG_KEY, {}) || {});
  cfg.count = clamp(parseInt(cfg.count, 10) || 3, 2, 6);
  if (!Array.isArray(cfg.names)) cfg.names = [];
  if (!['diwan', 'host', 'none'].includes(cfg.qsrc)) cfg.qsrc = 'diwan';
  if (!LOT_OPTIONS.includes(cfg.lots)) cfg.lots = 2;
  if (!ROUND_OPTIONS.includes(cfg.rounds)) cfg.rounds = 6;
  if (!HAMMER_OPTIONS.includes(cfg.hammer)) cfg.hammer = 3;
  if (!ANSWER_TIMES.includes(cfg.tAnswer)) cfg.tAnswer = 30;
  cfg.cats = (Array.isArray(cfg.cats) ? cfg.cats : []).filter((id) => QB.some((c) => c.id === id));
  if (!cfg.cats.length) cfg.cats = QB.map((c) => c.id);
  cfg.levels = (Array.isArray(cfg.levels) ? cfg.levels : []).filter((l) => [0, 1, 2].includes(l));
  if (!cfg.levels.length) cfg.levels = [0, 1, 2];
  const saveCfg = () => store.set(CFG_KEY, cfg);

  // =========================================================
  // الحالة
  // =========================================================
  let G = null;        // الحالة المحفوظة
  let cur = null;      // السؤال الحالي
  let A = null;        // المزاد الحي (لا يُحفظ)

  const el = {
    counts: $('#counts'), teamInputs: $('#teamInputs'), cashInput: $('#cashInput'),
    stage: $('#stage'), board: $('#board'), teams: $('#teams'), layout: $('#layout'),
    roundPill: $('#roundPill'), timer: $('#timer'), timerRing: $('#timerRing'), timerNum: $('#timerNum'),
    pauseBtn: $('#pauseBtn'), confetti: $('#confetti')
  };

  const scale = () => (G ? G.cfg.cash : cfg.cash) / 150000;
  const condOf = (car) => CONDS.find((c) => c.k === car.cond) || CONDS[2];
  const carEst = (car) => r500(car.base * G.models[car.m].idx);                  // القيمة التقديرية (بدون الحالة)
  const carVal = (car) => r500(car.base * G.models[car.m].idx * condOf(car).f);  // القيمة الحقيقية
  const modelPrice = (mi) => r500(MODELS[mi].base * scale() * G.models[mi].idx);
  const teamCars = (t) => t.cars.map((id) => G.cars[id]).filter(Boolean);
  const garageVal = (t) => teamCars(t).reduce((s, c) => s + carVal(c), 0);
  const wealth = (t) => t.cash + garageVal(t);
  const qsrc = () => G.cfg.qsrc;
  const isFast = () => G.cfg.mode === 'fast' && qsrc() !== 'none';

  // =========================================================
  // واجهة عامة
  // =========================================================
  function setTheme(t) {
    if (!THEMES.includes(t)) t = 'lot';
    document.documentElement.dataset.theme = t;
    store.set(THEME_KEY, t);
    if (ATHAR_THEMES.includes(t)) store.set('athar-theme', t);   // ثيمات أثَر العامة فقط
    $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
    const m = $('meta[name="theme-color"]');
    if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#14171C';
  }

  function show(id) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  // نافذة تأكيد داخل الصفحة
  let confirmYes = null, pausedByAsk = false;
  function ask({ title, text, yes, no = 'لا، هوّنت' }, onYes) {
    // المطرقة تتوقف ما دامت النافذة مفتوحة
    pausedByAsk = !!(A && !A.sold && !A.paused);
    if (pausedByAsk) A.paused = true;
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmYes').textContent = yes;
    $('#confirmNo').textContent = no;
    confirmYes = onYes;
    $('#confirm').hidden = false;
    $('#confirmYes').focus();
  }
  function closeAsk(run) {
    $('#confirm').hidden = true;
    if (pausedByAsk && A) A.paused = false;
    pausedByAsk = false;
    const f = confirmYes; confirmYes = null;
    if (run && f) f();
  }

  // =========================================================
  // شاشة الإعدادات
  // =========================================================
  function chipGroup(box, values, label, current, onPick) {
    box.innerHTML = '';
    values.forEach((v) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.type = 'button';
      b.innerHTML = label(v);
      b.setAttribute('aria-pressed', String(v === current()));
      b.addEventListener('click', () => {
        onPick(v); saveCfg(); S.tongue(0, 0.2);
        $$('.chip', box).forEach((c, i) => c.setAttribute('aria-pressed', String(values[i] === current())));
      });
      box.append(b);
    });
  }
  function staticChips(box, current, onPick) {
    const sync = () => $$('.chip', box).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.v === current())));
    $$('.chip', box).forEach((c) => c.addEventListener('click', () => { onPick(c.dataset.v); saveCfg(); S.tongue(0, 0.2); sync(); }));
    sync();
  }

  function renderTeamInputs() {
    el.teamInputs.innerHTML = '';
    for (let i = 0; i < cfg.count; i++) {
      const row = document.createElement('div');
      row.className = 'team-row';
      row.innerHTML = '<span class="team-no"></span><input type="text" maxlength="18" autocomplete="off">';
      const no = $('.team-no', row), input = $('input', row);
      no.style.setProperty('--c', TEAM_COLORS[i]);
      no.textContent = num(i + 1);
      input.placeholder = TEAM_NAMES[i];
      input.value = cfg.names[i] || '';
      input.setAttribute('aria-label', `اسم ${TEAM_NAMES[i]}`);
      input.addEventListener('input', () => { cfg.names[i] = input.value; saveCfg(); });
      el.teamInputs.append(row);
    }
  }

  function renderCats() {
    const box = $('#catChips');
    if (!QB.length) { box.innerHTML = ''; $('#catNote').textContent = 'تعذّر تحميل بنك ديوان، استخدموا أسئلة المقدّم.'; return; }
    box.innerHTML = QB.map((c) => `<button class="chip" type="button" data-c="${c.id}" aria-pressed="${cfg.cats.includes(c.id)}">${esc(c.name)} <small>${num(c.q.length)} سؤال</small></button>`).join('');
    const lv = $('#levelChips');
    lv.innerHTML = LEVELS.map((l, i) => `<button class="chip" type="button" data-l="${i}" aria-pressed="${cfg.levels.includes(i)}">${l}</button>`).join('');
    const n = QB.filter((c) => cfg.cats.includes(c.id)).reduce((s, c) => s + c.q.filter((x) => cfg.levels.includes(x[2])).length, 0);
    $('#catNote').textContent = `${num(n)} سؤالًا من ديوان في الاختيار الحالي، وما تتكرر حتى تخلص.`;
  }

  function initSetup() {
    chipGroup(el.counts, [2, 3, 4, 5, 6], num, () => cfg.count, (v) => { cfg.count = v; renderTeamInputs(); });
    renderTeamInputs();
    chipGroup($('#lotChips'), LOT_OPTIONS, (v) => `${num(v)}<small>${v === 1 ? 'سيارة' : 'سيارات'}</small>`, () => cfg.lots, (v) => { cfg.lots = v; });
    chipGroup($('#roundChips'), ROUND_OPTIONS, (v) => (v ? num(v) : 'مفتوح'), () => cfg.rounds, (v) => { cfg.rounds = v; });
    chipGroup($('#hammerChips'), HAMMER_OPTIONS, (v) => (v ? `${num(v)} ث` : 'يدوي'), () => cfg.hammer, (v) => { cfg.hammer = v; });
    chipGroup($('#answerChips'), ANSWER_TIMES, secLabel, () => cfg.tAnswer, (v) => { cfg.tAnswer = v; });
    staticChips($('#modeChips'), () => cfg.mode, (v) => { cfg.mode = v; });
    staticChips($('#dealerChips'), () => (cfg.dealer ? '1' : '0'), (v) => { cfg.dealer = v === '1'; });
    staticChips($('#luckChips'), () => (cfg.luck ? '1' : '0'), (v) => { cfg.luck = v === '1'; });
    const syncQ = () => {
      $$('[data-needs-q]').forEach((f) => { f.hidden = cfg.qsrc === 'none'; });
      $$('[data-needs-diwan]').forEach((f) => { f.hidden = cfg.qsrc !== 'diwan'; });
    };
    staticChips($('#qsrcChips'), () => cfg.qsrc, (v) => { cfg.qsrc = v; syncQ(); });
    syncQ();
    renderCats();
    $('#catChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      const id = b.dataset.c;
      if (cfg.cats.includes(id)) { if (cfg.cats.length === 1) return; cfg.cats = cfg.cats.filter((x) => x !== id); } else cfg.cats.push(id);
      saveCfg(); S.tongue(0, 0.2); renderCats();
    });
    $('#levelChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-l]'); if (!b) return;
      const l = parseInt(b.dataset.l, 10);
      if (cfg.levels.includes(l)) { if (cfg.levels.length === 1) return; cfg.levels = cfg.levels.filter((x) => x !== l); } else cfg.levels.push(l);
      saveCfg(); S.tongue(0, 0.2); renderCats();
    });
    el.cashInput.value = cfg.cash;
    el.cashInput.addEventListener('change', () => {
      cfg.cash = clamp(r1000(parseInt(el.cashInput.value, 10) || 150000), 50000, 2000000);
      el.cashInput.value = cfg.cash; saveCfg();
    });
    refreshResume();
  }

  function readSave() {
    const d = store.get(SAVE_KEY);
    return d && Array.isArray(d.teams) && Array.isArray(d.models) ? d : null;
  }
  function refreshResume() {
    const d = readSave();
    $('#resumeCard').hidden = !d;
    if (d) $('#resumeText').textContent = `الجولة ${num(d.round)} · ${d.teams.map((t) => t.name).join('، ')}`;
  }

  // =========================================================
  // البداية والحفظ
  // =========================================================
  function startGame() {
    cfg.cash = clamp(r1000(parseInt(el.cashInput.value, 10) || 150000), 50000, 2000000);
    saveCfg();
    let src = cfg.qsrc;
    if (src === 'diwan' && !QB.length) src = 'host';
    G = {
      cfg: { cash: cfg.cash, lots: cfg.lots, rounds: cfg.rounds, hammer: cfg.hammer, qsrc: src, mode: cfg.mode, tAnswer: cfg.tAnswer, dealer: cfg.dealer, luck: cfg.luck, cats: cfg.cats.slice(), levels: cfg.levels.slice() },
      teams: Array.from({ length: cfg.count }, (_, i) => ({
        name: (cfg.names[i] || '').trim() || TEAM_NAMES[i], color: TEAM_COLORS[i], cash: cfg.cash, cars: [], prev: cfg.cash
      })),
      models: MODELS.map(() => ({ idx: 1, hist: [1], last: 0, ups: 0 })),
      cars: {}, nextId: 1,
      round: 1, turn: 0, turnDone: false, phase: 'turn', elig: [], slot: 0, log: [], lastModel: -1, intro: null, market: null
    };
    S.whoosh(true); FX.horn();
    show('screen-game');
    beginRound();
  }

  function save() { if (G) store.set(SAVE_KEY, G); }

  function resume() {
    const d = readSave();
    if (!d) return refreshResume();
    G = d;
    S.whoosh(true);
    show('screen-game');
    if (G.phase === 'market' && G.market) renderMarket(false);
    else if (G.phase === 'gate' || G.phase === 'auction') showGate();
    else if (G.turnDone) advance();
    else beginTurn();
  }

  // =========================================================
  // المؤقّت (للأسئلة)
  // =========================================================
  const T = { id: 0, left: 0, total: 0, onEnd: null, paused: false };
  function drawTimer() {
    el.timerNum.textContent = num(Math.max(0, T.left));
    el.timerRing.style.setProperty('--p', T.total ? T.left / T.total : 0);
    el.timerRing.classList.toggle('low', T.left <= 5);
  }
  function startTimer(sec, onEnd) {
    stopTimer();
    Object.assign(T, { left: sec, total: sec, onEnd, paused: false });
    el.timer.hidden = false;
    el.pauseBtn.textContent = 'وقّف الوقت';
    el.timerRing.classList.remove('paused');
    drawTimer();
    T.id = setInterval(() => {
      if (T.paused) return;
      T.left--;
      if (T.left > 0 && T.left <= 5) S.tongue(0, 0.25);
      drawTimer();
      if (T.left <= 0) { const f = T.onEnd; stopTimer(); if (f) f(); }
    }, 1000);
  }
  function stopTimer() { clearInterval(T.id); T.id = 0; T.onEnd = null; el.timer.hidden = true; }
  function togglePause() {
    if (!T.id) return;
    T.paused = !T.paused;
    el.pauseBtn.textContent = T.paused ? 'كمّل الوقت' : 'وقّف الوقت';
    el.timerRing.classList.toggle('paused', T.paused);
    S.tongue(0, 0.2);
  }

  // =========================================================
  // الفرق ولوحة الأسعار
  // =========================================================
  function renderTeams(active = -1, bump = -1) {
    el.teams.style.setProperty('--n', G.teams.length);
    const auction = G.phase === 'gate' || G.phase === 'auction';
    el.teams.innerHTML = G.teams.map((t, i) => {
      const n = t.cars.length;
      const tag = G.elig[i] ? '<span class="team-tag in">بالحراج</span>'
        : (auction ? '<span class="team-tag">يتفرّج</span>' : '');
      return `<div class="team${i === active ? ' active' : ''}${i === bump ? ' bump' : ''}${auction && !G.elig[i] ? ' out' : ''}" style="--c:${t.color}">
        ${tag}
        <span class="team-name">${esc(t.name)}</span>
        <span class="team-cash"><b>${num(t.cash)}</b><small>ريال</small></span>
        <span class="team-garage">${n ? `الكراج: ${n === 1 ? 'سيارة وحدة' : n === 2 ? 'سيارتين' : `${num(n)} سيارات`} · ${money(garageVal(t))}` : 'الكراج فاضي'}</span>
      </div>`;
    }).join('');
  }

  function spark(hist) {
    const h = hist.slice(-8);
    if (h.length < 2) return '<svg class="spark flat" viewBox="0 0 54 22" aria-hidden="true"><path class="sp-line" d="M2 11H52"/></svg>';
    const lo = Math.min(...h), hi = Math.max(...h), span = hi - lo || 1;
    const pts = h.map((v, i) => `${(2 + (i * 50) / (h.length - 1)).toFixed(1)},${(19 - ((v - lo) / span) * 16).toFixed(1)}`);
    const kind = h[h.length - 1] > h[0] ? 'up' : h[h.length - 1] < h[0] ? 'down' : 'flat';
    return `<svg class="spark ${kind}" viewBox="0 0 54 22" aria-hidden="true"><path class="sp-line" d="M${pts.join('L')}"/></svg>`;
  }
  function badge(pct) {
    const p = Math.round(pct * 100);
    const kind = p > 0 ? 'up' : p < 0 ? 'down' : 'flat';
    return `<span class="chg ${kind}">${ICON[kind]}${num(Math.abs(p))}٪</span>`;
  }

  function renderBoard() {
    el.board.innerHTML = `
      <h3>أسعار الحراج اليوم</h3>
      <ul class="prices">${MODELS.map((m, i) => `
        <li>
          <span class="p-name">${esc(m.name)}</span>
          ${spark(G.models[i].hist)}
          <b class="p-price">${money(modelPrice(i))}</b>
          ${badge(G.models[i].last)}
        </li>`).join('')}
      </ul>
      <p class="muted">متوسط سعر الموديل، والسيارة تختلف بسنتها وحالتها.</p>`;
  }

  function setLayout(mode) {
    el.layout.dataset.mode = mode;
    el.board.hidden = mode === 'full';
    if (mode === 'split') renderBoard();
  }

  function renderPill() {
    const total = G.cfg.rounds ? ` من ${num(G.cfg.rounds)}` : '';
    el.roundPill.innerHTML = `الجولة <b>${num(G.round)}</b>${total}`;
  }

  // =========================================================
  // الجولة والأسئلة
  // =========================================================
  function beginRound() {
    stopLoop();
    G.elig = G.teams.map(() => false);
    G.turn = 0; G.turnDone = false; G.slot = 0; G.log = []; G.intro = null; G.market = null; G.lastModel = -1;
    if (qsrc() === 'none') {
      // بدون أسئلة: الكل يدخل الحراج، وقد تسبقه مفاجأة لفريق
      G.elig = G.teams.map(() => true);
      if (G.cfg.luck && Math.random() < 0.4) {
        const ti = rint(0, G.teams.length - 1);
        G.intro = Object.assign({ team: ti }, rollSurprise(ti));
      }
      return showGate();
    }
    beginTurn();
  }

  function beginTurn() {
    stopTimer();
    G.phase = 'turn'; G.turnDone = false; cur = null;
    save();
    renderPill();
    setLayout('split');
    const t = G.teams[G.turn];
    if (isFast()) {
      renderTeams();
      el.stage.innerHTML = `
        <div class="panel center">
          <p class="kicker">السؤال ${num(G.turn + 1)} من ${num(G.teams.length)} في هالجولة</p>
          <h2 class="big">سؤال للأسرع</h2>
          <p class="muted">أول فريق يجاوب صح ياخذ عمولة ويدخل الحراج. الغلط يطلّعه من هالسؤال.</p>
          <button class="btn btn-primary btn-big" data-act="question">اعرض السؤال</button>
        </div>`;
    } else {
      renderTeams(G.turn);
      el.stage.innerHTML = `
        <div class="panel center" style="--c:${t.color}">
          <p class="kicker">${pick(TXT.turn)}</p>
          <h2 class="big team-title">${esc(t.name)}</h2>
          <p class="muted">جاوبوا صح وتاخذون عمولة وتدخلون الحراج هالجولة.</p>
          <button class="btn btn-primary btn-big" data-act="question">اعرض السؤال</button>
        </div>`;
    }
  }

  function showQuestion(sound = true) {
    let base = null;
    if (qsrc() === 'diwan') base = Qs.next(G.cfg.cats, G.cfg.levels);
    if (!base) base = { host: true, q: '', opts: [], correct: -1 };
    cur = Object.assign(base, { team: isFast() ? -1 : G.turn, locked: [], wrong: [], done: false, result: null });
    G.phase = 'question';
    if (sound) S.whoosh(true);
    renderQuestion();
    startTimer(G.cfg.tAnswer, () => finishQuestion('timeout'));
  }

  function renderQuestion() {
    const fast = isFast();
    const t = cur.team >= 0 ? G.teams[cur.team] : null;
    renderTeams(cur.team);
    const canAnswer = !cur.done && cur.team >= 0;
    const buzz = fast && !cur.done ? `
      <div class="buzz">
        <span class="muted">مين جاوب أول؟</span>
        <div class="buzz-row">${G.teams.map((x, i) => `
          <button class="buzz-btn${i === cur.team ? ' on' : ''}" style="--c:${x.color}" data-act="buzz" data-i="${i}"
            ${cur.locked.includes(i) ? 'disabled' : ''}>${esc(x.name)}</button>`).join('')}
        </div>
      </div>` : '';
    const head = `<p class="kicker">${t ? `سؤال ${esc(t.name)}` : 'سؤال للأسرع'}${cur.cat ? `<span class="q-cat">${esc(cur.cat)}</span>` : ''}</p>`;

    if (cur.host) {
      const judge = cur.done ? '' : `
        <div class="judge">
          <button class="btn btn-ok" data-act="judge" data-i="1" ${canAnswer ? '' : 'disabled'}>صح!</button>
          <button class="btn btn-bad" data-act="judge" data-i="0" ${canAnswer ? '' : 'disabled'}>غلط!</button>
        </div>`;
      el.stage.innerHTML = `
        <div class="panel question" style="--c:${t ? t.color : 'var(--accent)'}">
          ${head}
          <h2 class="q-text">${esc(G.cfg.qsrc === 'host' ? 'المقدّم يسأل الحين…' : 'المقدّم يسأل من عنده')}</h2>
          ${buzz}${judge}
          ${cur.done ? resultHTML() : ''}
        </div>`;
      return;
    }
    const opts = cur.opts.map((o, i) => {
      let cls = 'opt';
      if (cur.done && i === cur.correct) cls += ' right';
      if (cur.wrong.includes(i)) cls += ' wrong';
      const off = !canAnswer || cur.wrong.includes(i);
      return `<button class="${cls}" data-act="answer" data-i="${i}" ${off ? 'disabled' : ''}>
        <span class="opt-l">${LETTERS[i] || num(i + 1)}</span><span class="opt-t">${esc(o)}</span></button>`;
    }).join('');
    const tools = cur.done ? '' : '<div class="q-tools"><button class="btn btn-ghost btn-sm" data-act="skip">ما عجبهم السؤال؟ بدّله</button></div>';
    el.stage.innerHTML = `
      <div class="panel question" style="--c:${t ? t.color : 'var(--accent)'}">
        ${head}
        <h2 class="q-text">${esc(cur.q)}</h2>
        ${buzz}
        <div class="opts">${opts}</div>
        ${cur.done ? resultHTML() : tools}
        ${cur.cite ? `<small class="q-cite">ديوان: ${esc(cur.cite)}</small>` : ''}
      </div>`;
  }

  function buzz(i) {
    if (!cur || cur.done || cur.locked.includes(i)) return;
    cur.team = i;
    S.drop(560, 0, 0.22);
    renderQuestion();
  }
  function answer(i) {
    if (!cur || cur.done || cur.team < 0 || cur.wrong.includes(i)) return;
    if (i === cur.correct) return finishQuestion('correct');
    cur.wrong.push(i);
    wrongAnswer();
  }
  function judge(ok) {
    if (!cur || !cur.host || cur.done || cur.team < 0) return;
    if (ok) finishQuestion('correct'); else wrongAnswer();
  }
  function wrongAnswer() {
    if (!isFast()) return finishQuestion('wrong');
    cur.locked.push(cur.team);
    S.sigh();
    if (cur.locked.length >= G.teams.length) return finishQuestion('allwrong');
    cur.team = -1;
    renderQuestion();
  }

  function finishQuestion(kind) {
    if (!cur || cur.done) return;
    stopTimer();
    cur.done = true;
    cur.result = { kind };
    if (kind === 'correct') {
      const ti = cur.team, t = G.teams[ti];
      // العمولة: ٢٪ إلى ٥٪ من الرصيد، وبحد أدنى ٢٪ من الرصيد الابتدائي
      const reward = Math.max(r500(t.cash * rnd(0.02, 0.05)), r500(G.cfg.cash * 0.02));
      t.cash += reward;
      G.elig[ti] = true;
      cur.result.reward = reward;
      cur.result.surprise = G.cfg.luck && Math.random() < SURPRISE_CHANCE ? rollSurprise(ti) : null;
      S.chirp(0, 3000); S.drop(620, 0.3);
      if (cur.result.surprise) S.gust(0.6);
    } else {
      S.sigh();
    }
    G.turnDone = true;
    save();
    renderQuestion();
    if (kind === 'correct') renderTeams(cur.team, cur.team);
  }

  function resultHTML() {
    const r = cur.result;
    if (r.kind === 'correct') {
      const t = G.teams[cur.team], s = r.surprise;
      return `
        <div class="result ok">
          <strong>${esc(fill(pick(TXT.right), { t: t.name }))}</strong>
          <span>عمولتكم ${signed(r.reward)} ريال، ${s && s.type === 'block' ? 'بس…' : 'وأنتم داخل الحراج!'}</span>
        </div>
        ${s ? surpriseHTML(s) : ''}
        <button class="btn btn-primary btn-big" data-act="next">تمام، نكمّل</button>`;
    }
    const t = cur.team >= 0 ? G.teams[cur.team] : null;
    const msg = r.kind === 'timeout' ? fill(pick(TXT.timeout), { t: t ? t.name : '' }) : r.kind === 'allwrong' ? 'كل الفرق غلطت!' : fill(pick(TXT.wrong), { t: t ? t.name : '' });
    const sub = isFast() ? 'ولا أحد ياخذ هالسؤال.' : 'تتفرّجون على الحراج هالجولة.';
    return `
      <div class="result bad"><strong>${esc(msg)}</strong><span>${sub}</span></div>
      <button class="btn btn-primary btn-big" data-act="next">تمام، نكمّل</button>`;
  }

  function advance() {
    stopTimer();
    cur = null;
    G.turn++; G.turnDone = false;
    if (G.turn >= G.teams.length) showGate();
    else beginTurn();
  }

  // =========================================================
  // المفاجآت
  // =========================================================
  function rollSurprise(ti) {
    const t = G.teams[ti];
    const type = pick(['block', 'drop', 'rise', 'cash', 'car', 'saher']);
    if (type === 'block') {
      G.elig[ti] = false;
      return { type, tone: 'bad', title: 'البطاقة انرفضت!', text: `جهاز الشبكة علّق على ${t.name}… ما تقدرون تسوّمون هالجولة.` };
    }
    if (type === 'drop' || type === 'rise') {
      const mi = rint(0, MODELS.length - 1);
      const f = type === 'drop' ? rnd(0.7, 0.85) : rnd(1.15, 1.35);
      moveModel(mi, f);
      const p = num(Math.abs(Math.round(G.models[mi].last * 100)));
      return type === 'drop'
        ? { type, tone: 'bad', title: 'استدعاء من الوكالة!', text: `طلع عيب مصنعي في ${MODELS[mi].name}، ونزل سعرها ${p}٪.` }
        : { type, tone: 'ok', title: `${MODELS[mi].name} صارت ترند!`, text: `الكل يدوّر عليها، وطلع سعرها ${p}٪.` };
    }
    if (type === 'cash') {
      const gift = r500(G.cfg.cash * rnd(0.05, 0.15));
      t.cash += gift;
      return { type, tone: 'ok', title: 'عمولة سمسرة!', text: `${t.name} سمسروا على صفقة وأخذوا ${money(gift)} ريال.` };
    }
    if (type === 'car') {
      const car = makeCar(rint(0, 4));   // من الموديلات الأرخص
      car.owner = ti; car.paid = 0;
      G.cars[car.id] = car; t.cars.push(car.id);
      return { type, tone: 'ok', title: 'ورث من العم!', text: `عم ${t.name} أهداهم ${MODELS[car.m].name} ${num(car.year)}… وطلعت «${condOf(car).t}» بقيمة ${money(carVal(car))}.` };
    }
    const fine = Math.min(t.cash, r500(G.cfg.cash * rnd(0.02, 0.05)));
    t.cash -= fine;
    return { type: 'saher', tone: 'bad', title: 'ساهر صادكم!', text: `مخالفة سرعة على ${t.name}: ${signed(-fine)} ريال.` };
  }
  const surpriseHTML = (s) => `<div class="surprise ${s.tone}"><strong>${esc(s.title)}</strong><span>${esc(s.text)}</span></div>`;

  function moveModel(mi, factor) {
    const m = G.models[mi], old = m.idx;
    m.idx = Math.max(0.3, old * factor);
    m.last = (m.idx - old) / old;
    m.ups = m.last > 0 ? m.ups + 1 : 0;
    m.hist.push(m.idx);
    if (m.hist.length > 24) m.hist.shift();
  }

  // =========================================================
  // السيارات
  // =========================================================
  function makeCar(forceModel = -1) {
    let m = forceModel;
    if (m < 0) { do { m = rint(0, MODELS.length - 1); } while (m === G.lastModel && MODELS.length > 1); G.lastModel = m; }
    const year = rint(2014, 2025);
    const yf = 0.62 + (year - 2014) * 0.045;
    const cond = weighted(CONDS);
    let pool;
    const r = Math.random();
    if (cond.tone === 'good') pool = r < 0.55 ? NOTES.good : r < 0.7 ? NOTES.bad : NOTES.any;
    else if (cond.tone === 'bad') pool = r < 0.4 ? NOTES.good : r < 0.75 ? NOTES.bad : NOTES.any;
    else pool = pick([NOTES.good, NOTES.bad, NOTES.any]);
    const paint = pick(PAINTS);
    return {
      id: G.nextId++, m, year,
      km: Math.max(3, Math.round((2026 - year) * rnd(9, 28))) * 1000,
      paint: paint.c, paintName: paint.n, cond: cond.k, note: pick(pool),
      base: MODELS[m].base * scale() * yf * rnd(0.94, 1.06),
      owner: -1, paid: 0
    };
  }

  // =========================================================
  // بوابة الحراج: من دخل ومن يتفرّج
  // =========================================================
  function showGate() {
    stopTimer(); stopLoop();
    G.phase = 'gate';
    save();
    renderPill();
    setLayout('full');
    renderTeams();
    const any = G.elig.some(Boolean);
    const chips = G.teams.map((t, i) => `<span class="${G.elig[i] ? '' : 'off'}" style="--c:${t.color}">${esc(t.name)}</span>`).join('');
    const intro = G.intro ? surpriseHTML(G.intro) : '';
    if (!any) {
      el.stage.innerHTML = `
        <div class="panel center">
          <p class="kicker">الجولة ${num(G.round)}</p>
          <h2 class="big">ولا أحد دخل الحراج!</h2>
          <div class="gate">${chips}</div>
          <p class="muted">${G.cfg.dealer ? 'الشريطي بياخذ سيارات هالجولة على راحته… الله يعينكم الجولة الجاية.' : 'الحراج سكّر هالجولة… الله يعينكم الجولة الجاية.'}</p>
          <button class="btn btn-primary btn-big" data-act="market">ورّني لوحة الحراج</button>
        </div>`;
      return;
    }
    const left = G.cfg.lots - G.slot;
    el.stage.innerHTML = `
      <div class="panel center">
        <p class="kicker">الجولة ${num(G.round)}${G.slot ? ' · نكمّل الحراج' : ''}</p>
        <h2 class="big">${G.slot ? 'نكمّل؟' : 'الحراج فتح!'}</h2>
        ${intro}
        <div class="gate">${chips}</div>
        <p class="muted">${left === 1 ? 'سيارة وحدة بتدخل' : left === 2 ? 'سيارتين بيدخلون' : `${num(left)} سيارات بتدخل`} الحراج${G.slot ? ' بعد' : ' هالجولة'}. اللي برّا يتفرّج، واللي داخل يسوّم${G.cfg.dealer ? '… وانتبهوا من الشريطي!' : '.'}</p>
        <button class="btn btn-primary btn-big" data-act="lot">${G.slot ? 'دخّل السيارة اللي بعدها' : 'يلا! دخّلوا أول سيارة'}</button>
      </div>`;
  }

  // =========================================================
  // المزاد
  // =========================================================
  let loopId = 0;
  function stopLoop() { clearInterval(loopId); loopId = 0; }
  const hammerMs = () => G.cfg.hammer * 1000;

  function startLot() {
    stopLoop();
    G.phase = 'auction';
    const car = makeCar();
    save();
    const est = carEst(car);
    const steps = [...new Set([nice(est * 0.02), nice(est * 0.05), nice(est * 0.1)])];
    const cond = condOf(car);
    A = {
      car, est, steps, step: steps[Math.min(1, steps.length - 1)],
      open: r1000(est * rnd(0.45, 0.6)),
      cur: 0, lead: -1, bids: [], stage: 0, due: 0, paused: false, ready: false, sold: false,
      // الشريطي يعرف حالة السيارة الحقيقية، ويدفع أقل منها
      dmax: G.cfg.dealer ? r500(est * cond.f * rnd(0.72, 0.92)) : 0,
      line: '', hot: false, dline: pick(TXT.dealerIdle), dtalk: false
    };
    A.line = say('open', { p: money(A.open) });
    renderTeams();
    renderLot();
    FX.engine(); FX.horn(1.05);
    setTimeout(() => {
      if (!A || A.car !== car) return;
      A.ready = true;
      A.due = Date.now() + hammerMs() * 1.6;   // مهلة أطول قبل أول سوم
      renderBidZone();
      if (G.cfg.hammer) loopId = setInterval(tick, 100);
    }, reducedMotion() ? 200 : 1300);
  }

  function renderLot() {
    const car = A.car, m = MODELS[car.m];
    el.stage.innerHTML = `
      <div class="panel auction">
        <div class="auc-head">
          <div>
            <p class="lot-no">السيارة ${num(G.slot + 1)} من ${num(G.cfg.lots)} · الجولة ${num(G.round)}</p>
            <h2>${esc(m.name)} ${num(car.year)}</h2>
          </div>
          <span class="muted">قيمتها التقديرية بالسوق: <b>${money(A.est)}</b></span>
        </div>
        <div class="showroom" id="showroom">
          <div class="bunting"></div>
          ${GAVEL}
          <div class="car-wrap arrive" id="carWrap" style="--car:${car.paint}">${carSVG(m.body)}</div>
        </div>
        <div class="specs">
          <span>${esc(m.name)}</span>
          <span>موديل ${num(car.year)}</span>
          <span>الممشى ${num(car.km)} كم</span>
          <span><i class="sw" style="--sw:${car.paint}"></i>${esc(car.paintName)}</span>
        </div>
        <p class="note-q">صاحبها يقول: <b>«${esc(car.note)}»</b></p>
        <div class="bid-zone" id="bidZone"></div>
        <div id="revealBox"></div>
      </div>`;
    fillBunting($('#showroom .bunting'));
    renderBidZone();
  }

  function whoName(w) { return w === -2 ? 'الشريطي' : G.teams[w] ? G.teams[w].name : ''; }
  const nextPrice = () => (A.lead === -1 ? A.open : A.cur + A.step);

  function renderBidZone(bump = false) {
    const box = $('#bidZone');
    if (!box || !A) return;
    if (A.sold) { box.innerHTML = ''; return; }
    const lead = A.lead;
    const who = lead === -1 ? '<span class="pt-who none">ما أحد فتح</span>'
      : `<span class="pt-who" style="--c:${lead === -2 ? 'var(--dealer)' : G.teams[lead].color}">${esc(whoName(lead))}</span>`;
    const labels = lead === -1 ? ['ما أحد؟', 'آخر نداء', 'ترجع'] : ['أول مرة', 'ثاني مرة', 'تم البيع!'];
    const calls = labels.map((l, k) => `<div class="call${k === 2 ? ' last' : ''}${A.stage > k ? ' on' : ''}"><i></i><span>${l}</span></div>`).join('');
    const price = nextPrice();
    const bidders = G.teams.map((t, i) => {
      let why = '';
      if (!G.elig[i]) why = 'يتفرّج';
      else if (lead === i) why = '';
      else if (price > t.cash) why = 'ما يكفي الرصيد';
      const off = !A.ready || !!why || lead === i;
      const sub = lead === i ? `معه السوم` : why || (lead === -1 ? `يفتح بـ${money(A.open)}` : iso('+' + num(A.step)));
      return `<button class="bid-btn${lead === i ? ' is-lead' : ''}" style="--c:${t.color}" data-act="bid" data-i="${i}" ${off ? 'disabled' : ''}>
        <b>${esc(t.name)}</b><small>${sub}</small></button>`;
    }).join('');
    const dealer = G.cfg.dealer ? `
      <div class="dealer${A.dtalk ? ' talk' : ''}${lead === -2 ? ' is-lead' : ''}">
        ${DEALER}
        <div class="d-say">${esc(A.dline)}<small>الشريطي يعرف السيارات زين… إذا زاحم غالبًا السيارة تستاهل.</small></div>
      </div>` : '';
    const manual = !G.cfg.hammer;
    const callBtn = manual ? `<button class="btn" data-act="call">${lead === -1 ? (A.stage === 0 ? 'ما أحد يفتح؟' : A.stage === 1 ? 'آخر نداء' : 'ترجع') : (A.stage === 0 ? 'أول مرة' : A.stage === 1 ? 'ثاني مرة' : 'تم البيع!')}</button>` : '';
    const pauseBtn = manual ? '' : `<button class="btn" data-act="pauseHammer">${A.paused ? 'كمّل المطرقة' : 'وقّف المطرقة'}</button>`;
    const hist = A.bids.slice(-4).reverse().map((b) => `<span>${esc(whoName(b.who))} ${money(b.price)}</span>`).join('');
    box.innerHTML = `
      <div class="price-tag${bump ? ' bump' : ''}">
        <span class="pt-label">${lead === -1 ? 'السوم الافتتاحي' : 'على السوم'}</span>
        <b class="pt-val">${num(lead === -1 ? A.open : A.cur)}</b>
        ${who}
      </div>
      <p class="call-line${A.hot ? ' hot' : ''}">${esc(A.line)}</p>
      <div class="calls">${calls}</div>
      ${dealer}
      <div class="steps"><span>الزيادة:</span>${A.steps.map((s) => `<button class="chip" data-act="step" data-s="${s}" aria-pressed="${s === A.step}">${iso('+' + num(s))}</button>`).join('')}</div>
      <div class="bidders">${bidders}</div>
      <div class="host-tools">
        <button class="btn" data-act="undo" ${A.bids.length ? '' : 'disabled'}>رجّع آخر سوم</button>
        ${pauseBtn}${callBtn}
        ${lead === -1 ? '<button class="btn" data-act="noSale">ما أحد يبيها</button>' : '<button class="btn btn-sold" data-act="sellNow">تم البيع! (المطرقة)</button>'}
      </div>
      ${hist ? `<div class="history">${hist}</div>` : ''}`;
    A.dtalk = false;
    paintCalls();
  }

  // تعبئة شريط النداء الحالي حسب الوقت المتبقي
  function paintCalls() {
    if (!A || !G.cfg.hammer) return;
    const ms = hammerMs() * (A.lead === -1 && A.stage === 0 ? 1.6 : 1);
    const p = A.ready && !A.sold ? clamp(1 - (A.due - Date.now()) / ms, 0, 1) : 0;
    $$('#bidZone .call').forEach((c, k) => c.style.setProperty('--p', k === A.stage ? p.toFixed(3) : (A.stage > k ? 1 : 0)));
  }

  function tick() {
    if (!A || A.sold || !A.ready) return;
    if (A.paused) { A.due += 100; return; }
    paintCalls();
    if (Date.now() >= A.due) nextCall();
  }
  function schedule() { A.due = Date.now() + hammerMs(); }

  function knockGavel(cls = 'knock') {
    const g = $('#gavel');
    if (!g) return;
    g.classList.remove('knock', 'slam'); void g.getBoundingClientRect(); g.classList.add(cls);
  }

  // النداء التالي: أول مرة، ثاني مرة، ثم البيع (والشريطي قد يدخل قبلها)
  function nextCall() {
    if (!A || A.sold) return;
    const dealerOn = G.cfg.dealer;
    if (A.lead === -1) {
      if (dealerOn && A.open <= A.dmax && Math.random() < (A.stage >= 1 ? 0.8 : 0.45)) return dealerBid();
      A.stage++;
      if (A.stage >= 3) return unsold();
      A.line = say(A.stage === 1 ? 'none1' : 'none2'); A.hot = A.stage === 2;
    } else {
      if (dealerOn && A.lead !== -2) {
        const chance = A.stage === 0 ? 0.25 : A.stage === 1 ? 0.45 : 0.6;
        if (A.cur + A.steps[0] <= A.dmax && Math.random() < chance) return dealerBid();
      }
      A.stage++;
      if (A.stage >= 3) return sell();
      A.line = say(A.stage === 1 ? 'call1' : 'call2', { p: money(A.cur) }); A.hot = A.stage === 2;
    }
    FX.knock(); knockGavel();
    schedule();
    renderBidZone();
  }

  function dealerBid() {
    // الشريطي يزيد بأصغر زيادة، وأحيانًا بأكبر منها إذا ما تعدّى حدّه
    let inc = A.steps[0];
    const big = A.steps[Math.min(1, A.steps.length - 1)];
    if (Math.random() < 0.3 && A.cur + big <= A.dmax) inc = big;
    const price = A.lead === -1 ? A.open : A.cur + inc;
    A.cur = price; A.lead = -2; A.stage = 0;
    A.bids.push({ who: -2, price });
    A.dline = say('dealerBid', { p: money(price), s: money(inc || A.steps[0]) });
    A.line = `الشريطي سام بـ${money(price)}!`; A.hot = false; A.dtalk = true;
    FX.whistle();
    schedule();
    renderBidZone(true);
  }

  function teamBid(i) {
    if (!A || A.sold || !A.ready || !G.elig[i] || A.lead === i) return;
    const t = G.teams[i], price = nextPrice();
    if (price > t.cash) return;
    A.cur = price; A.lead = i; A.stage = 0;
    A.bids.push({ who: i, price });
    A.line = say('bid', { t: t.name, p: money(price) }); A.hot = false;
    FX.bid(A.bids.length);
    schedule();
    renderBidZone(true);
  }

  function undoBid() {
    if (!A || A.sold || !A.bids.length) return;
    A.bids.pop();
    const prev = A.bids[A.bids.length - 1];
    if (prev) { A.cur = prev.price; A.lead = prev.who; } else { A.cur = 0; A.lead = -1; }
    A.stage = 0; A.hot = false;
    A.line = 'رجّعنا آخر سوم… ولا كأن شي صار';
    S.whoosh(false);
    schedule();
    renderBidZone();
  }

  // البيع: ضربة المطرقة + ملصق «تم البيع!» ثم كشف الحالة
  function sell() {
    if (!A || A.sold || A.lead === -1) return;
    A.sold = true; stopLoop();
    const car = A.car, price = A.cur, lead = A.lead;
    if (lead === -2) {
      car.owner = -2; car.paid = price;
    } else {
      const t = G.teams[lead];
      t.cash -= price;
      car.owner = lead; car.paid = price;
      G.cars[car.id] = car; t.cars.push(car.id);
    }
    G.log.push({ m: car.m, price, est: A.est });
    G.slot++;
    save();
    FX.gavel(); FX.claps(lead === -2 ? 6 : 14, 0.12);
    knockGavel('slam');
    const room = $('#showroom'); if (room) { room.classList.remove('shake'); void room.offsetWidth; room.classList.add('shake'); }
    const wrap = $('#carWrap');
    if (wrap) {
      wrap.classList.remove('arrive', 'bounce'); void wrap.offsetWidth; wrap.classList.add('bounce');
      const st = document.createElement('div');
      st.className = 'sold-sticker' + (lead === -2 ? ' dealer' : '');
      st.innerHTML = `تم البيع!<small>${esc(whoName(lead))} · ${money(price)}</small>`;
      wrap.append(st);
    }
    renderTeams(-1, lead >= 0 ? lead : -1);
    renderBidZone();
    setTimeout(() => showReveal(car, price, lead), reducedMotion() ? 100 : 950);
  }

  function unsold() {
    if (!A || A.sold) return;
    A.sold = true; stopLoop();
    G.slot++;
    save();
    S.sigh(); knockGavel('slam'); FX.knock();
    const wrap = $('#carWrap');
    if (wrap) {
      const st = document.createElement('div');
      st.className = 'sold-sticker none';
      st.innerHTML = `ما انباعت<small>${esc(pick(TXT.unsold))}</small>`;
      wrap.append(st);
    }
    renderBidZone();
    setTimeout(() => showReveal(A.car, 0, -1), reducedMotion() ? 100 : 700);
  }

  function showReveal(car, price, lead) {
    const box = $('#revealBox');
    if (!box || !A || A.car !== car) return;
    const cond = condOf(car);
    const value = r500(car.base * G.models[car.m].idx * cond.f);
    const more = G.slot < G.cfg.lots;
    const nextBtn = `<button class="btn btn-primary btn-big" data-act="${more ? 'lot' : 'market'}">${more ? 'دخّل السيارة اللي بعدها' : 'ورّني لوحة الحراج'}</button>`;
    let line = '', tone = cond.tone, rows = '';
    if (lead >= 0) {
      const t = G.teams[lead], diff = value - price;
      const k = diff > price * 0.15 ? 'gainBig' : diff > 0 ? 'gain' : diff === 0 ? 'even' : 'loss';
      line = `${esc(fill(pick(TXT.soldTeam), { t: t.name, p: money(price) }))}<br>${esc(fill(pick(TXT[k]), { t: t.name }))}`;
      tone = diff > 0 ? 'good' : diff < 0 ? 'bad' : 'mid';
      rows = `<div class="rv-rows">
        <div><small>دفعتوا</small><b>${num(price)}</b></div>
        <div><small>قيمتها الحين</small><b>${num(value)}</b></div>
        <div><small>${diff >= 0 ? 'كسبانين' : 'خسرانين'}</small><b class="${diff >= 0 ? 'pos' : 'neg'}">${signed(diff)}</b></div>
      </div>`;
      if (diff > 0) { S.chirp(0, 3200); } else if (diff < 0) { S.sigh(0.1); }
    } else if (lead === -2) {
      line = `${esc(pick(TXT.dealerWin))}<br>${cond.tone === 'bad' ? 'وطلعت مقلب عليه… حتى الشريطي ينضحك عليه!' : 'والشريطي عارف وش يسوي!'}`;
    } else {
      line = `وللعلم… هذي كانت حالتها.`;
    }
    box.innerHTML = `
      <div class="reveal ${tone}">
        <span class="rv-k">فتحنا الكبوت… وطلعت:</span>
        <h3>${esc(cond.t)}</h3>
        <p>${esc(cond.d)}</p>
        ${rows}
        <p class="rv-line">${line}</p>
        ${nextBtn}
      </div>`;
    box.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }

  // =========================================================
  // لوحة الحراج بعد الجولة: حظ + منطق
  // =========================================================
  function computeChange(mi) {
    const m = G.models[mi];
    // الطلب: بيع الموديل فوق ٨٠٪ من تقديره يرفع سعره، وتحته ينزّله
    let demand = 0;
    G.log.filter((x) => x.m === mi).forEach((s) => { demand += clamp((s.price / s.est - 0.8) * 0.25, -0.06, 0.1); });
    demand = clamp(demand, -0.08, 0.14);
    let pct;
    if (m.last < 0) {
      // المنطق: الموديل اللي نزل يرجع يطلع، وكل ما كان النزول أكبر كان الرجوع أقوى
      pct = Math.max(0.03, rnd(0.04, 0.14) + Math.min(0.08, Math.abs(m.last) * 0.4) + demand);
    } else {
      // الحظ: حركة عشوائية، واللي طلع مرتين ورا بعض يغلب عليه التصحيح
      const luck = m.ups >= 2 && Math.random() < 0.7 ? -rnd(0.05, 0.15) : rnd(-0.12, 0.12);
      pct = luck + demand;
      if (Math.abs(pct) < 0.02) pct = pct < 0 ? -0.025 : 0.025;
    }
    return pct;
  }

  function endRound() {
    stopLoop(); A = null;
    const rows = MODELS.map((_, i) => {
      const old = modelPrice(i);
      moveModel(i, 1 + computeChange(i));
      return { old, price: modelPrice(i), pct: G.models[i].last };
    });
    G.phase = 'market';
    G.market = {
      rows,
      ranks: G.teams.map((t, i) => { const w = wealth(t); const d = w - t.prev; t.prev = w; return { i, w, d }; }).sort((a, b) => b.w - a.w)
    };
    save();
    renderMarket(true);
  }

  function renderMarket(animate) {
    stopTimer();
    renderPill();
    setLayout('full');
    G.elig = G.teams.map(() => false);
    renderTeams();
    const m = G.market;
    const last = G.cfg.rounds && G.round >= G.cfg.rounds;
    const ups = m.rows.filter((r) => r.pct > 0).length;
    const any = G.teams.some((t) => t.cars.length);
    const buyer = G.cfg.dealer ? 'الشريطي' : 'المعرض';
    el.stage.innerHTML = `
      <div class="panel market${animate ? ' anim' : ''}">
        <div class="market-head">
          <div>
            <p class="kicker">نهاية الجولة ${num(G.round)}</p>
            <h2>لوحة الحراج</h2>
          </div>
          <p><span class="chg up">${ICON.up}${num(ups)} طالعة</span> <span class="chg down">${ICON.down}${num(m.rows.length - ups)} نازلة</span></p>
        </div>
        <ul class="m-list">${m.rows.map((r, i) => `
          <li class="m-row ${r.pct > 0 ? 'up' : 'down'}" style="--d:${(i * 0.12).toFixed(2)}s">
            <span class="m-name">${esc(MODELS[i].name)}</span>
            ${badge(r.pct)}
            <span class="m-price">${money(r.old)} ← <b>${money(r.price)}</b></span>
          </li>`).join('')}
        </ul>
        <h3 class="sec-title">الترتيب (الفلوس + قيمة الكراج)</h3>
        <ol class="ranks">${m.ranks.map((r, k) => {
          const t = G.teams[r.i];
          return `<li class="rank" style="--c:${t.color}; --d:${(m.rows.length * 0.12 + k * 0.1).toFixed(2)}s">
            <span class="rank-no">${num(k + 1)}</span>
            <span class="rank-name">${esc(t.name)}</span>
            <span class="rank-delta ${r.d > 0 ? 'up' : r.d < 0 ? 'down' : ''}">${Math.round(r.d) ? signed(Math.round(r.d)) : ''}</span>
            <b class="rank-w">${num(wealth(t))}</b>
          </li>`;
        }).join('')}
        </ol>
        ${any ? `<h3 class="sec-title">الكراجات</h3>
        <p class="muted">تبون تبيعون؟ اضغطوا على السيارة و${buyer} يعطيكم سعره.</p>
        <div class="garages">${G.teams.map((t, i) => (t.cars.length ? garageHTML(t, i) : '')).join('')}</div>` : ''}
        <button class="btn btn-primary btn-big" data-act="${last ? 'finish' : 'nextRound'}">${last ? 'لحظة الحقيقة… ورّني النتيجة' : 'الجولة اللي بعدها'}</button>
      </div>`;
    if (animate) {
      FX.knock();
      if (!reducedMotion()) m.rows.forEach((r, i) => S.drop(r.pct > 0 ? 640 : 300, 0.2 + i * 0.12, 0.18));
    }
  }

  function garageHTML(t, i) {
    const cars = teamCars(t);
    const list = cars.length ? cars.map((c) => `
      <button class="g-car" data-act="sellCar" data-id="${c.id}" style="--car:${c.paint}">
        ${carSVG(MODELS[c.m].body)}
        <span class="gc-t"><b>${esc(MODELS[c.m].name)} ${num(c.year)}</b><small>${esc(condOf(c).t)} · شريتوها ${money(c.paid)}</small></span>
        <span class="gc-v">${money(carVal(c))}<span class="gc-sell">بيع</span></span>
      </button>`).join('') : '<p class="g-empty">الكراج فاضي</p>';
    return `<div class="garage" style="--c:${t.color}">
      <h4>${esc(t.name)}<small>${money(garageVal(t))}</small></h4>
      <div class="g-cars">${list}</div>
    </div>`;
  }

  // البيع على الشريطي (أو المعرض إذا الشريطي مطفي)
  function sellCar(id) {
    const car = G.cars[id];
    if (!car || car.owner < 0) return;
    const t = G.teams[car.owner], val = carVal(car);
    if (!car.offer || car.offer.r !== G.round) {
      car.offer = { r: G.round, v: G.cfg.dealer ? r500(val * rnd(0.86, 0.97)) : r500(val * 0.95) };
      save();
    }
    const offer = car.offer.v;
    if (G.cfg.dealer) FX.whistle(); else S.tongue(0, 0.2);
    ask({
      title: G.cfg.dealer ? `الشريطي يعرض عليكم ${money(offer)}… ها؟ نبيع؟` : `المعرض يشتريها بـ${money(offer)}`,
      text: `${MODELS[car.m].name} ${num(car.year)} قيمتها الحين ${money(val)}، وشريتوها بـ${money(car.paid)}.`,
      yes: 'إيه، بعها'
    }, () => {
      t.cash += offer;
      t.cars = t.cars.filter((x) => x !== id);
      delete G.cars[id];
      save();
      FX.claps(6, 0); S.drop(700, 0.05); S.drop(880, 0.15);
      renderMarket(false);
    });
  }

  function nextRound() {
    G.round++;
    S.whoosh(true);
    beginRound();
  }

  // =========================================================
  // النهاية: تُقيَّم كل السيارات بقيمتها السوقية ويُعلن الفائز
  // =========================================================
  let confettiRaf = 0;
  function finish() {
    stopTimer(); stopLoop(); A = null; cur = null;
    const res = G.teams.map((t) => ({ t, w: wealth(t), cars: t.cars.length }));
    res.sort((a, b) => b.w - a.w);
    const top = res[0].w;
    const winners = res.filter((r) => r.w === top);
    const start = G.cfg.cash;
    store.del(SAVE_KEY);

    // سيارة الفائز: أغلى سيارة في كراجه، وإلا جيب بلونه
    const w0 = winners[0].t;
    const best = teamCars(w0).sort((a, b) => carVal(b) - carVal(a))[0];
    $('#winCar').innerHTML = `<div class="car-wrap bounce" style="--car:${best ? best.paint : w0.color}">${carSVG(best ? MODELS[best.m].body : 'suv')}<div class="sold-sticker">${winners.length > 1 ? 'راس براس!' : 'مبروك!'}</div></div>`;
    $('.victory').style.setProperty('--win-c', w0.color);
    if (winners.length > 1) {
      $('#victoryKicker').textContent = 'راس براس!';
      $('#winnerName').textContent = winners.map((r) => r.t.name).join(' و');
      $('#winnerText').textContent = `كل فريق بـ${money(top)}… ما أحد غلب أحد! الحسم عند المقدّم.`;
    } else {
      $('#victoryKicker').textContent = pick(['سكّر الحراج… والفااائز ويستاهل', 'سكّر الحراج… والفائز بلا منازع', 'سكّر الحراج… هذي الهيبة!']);
      $('#winnerName').textContent = w0.name;
      $('#winnerText').textContent = `بعنا كل السيارات بقيمتها السوقية، وطلع مع (${w0.name}) ${num(top)} ريال. مبروك يا وحوش!`;
    }
    const board = $('#finalBoard');
    board.innerHTML = '';
    res.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'final-row' + (r.w === top ? ' win' : '');
      row.style.setProperty('--c', r.t.color);
      row.style.animationDelay = `${0.15 * i + 0.4}s`;
      const gain = Math.round(((r.w - start) / start) * 100);
      row.innerHTML = `<span class="final-rank">${num(i + 1)}</span><span class="final-name">${esc(r.t.name)}</span>
        <span class="final-pts"><span>${num(r.w)}</span><small>${gain >= 0 ? 'ربح' : 'خسارة'} ${num(Math.abs(gain))}٪ · ${r.cars ? (r.cars === 1 ? 'سيارة وحدة' : r.cars === 2 ? 'سيارتين' : `${num(r.cars)} سيارات`) : 'بلا سيارات'}</small></span>`;
      board.append(row);
    });
    G = null;
    show('screen-victory');
    FX.gavel(); S.winner();
    confetti(winners.map((r) => r.t.color));
  }

  function confetti(colors) {
    if (reducedMotion()) return;
    const cv = el.confetti, g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const cols = [...colors, ...FLAG_COLORS];
    // قصاصات على شكل أعلام الحراج المثلثة
    const parts = Array.from({ length: 160 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.4,
      vx: (Math.random() - 0.5) * 26 * dpr, vy: (-Math.random() * 22 - 6) * dpr,
      s: (7 + Math.random() * 8) * dpr, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: cols[Math.floor(Math.random() * cols.length)]
    }));
    const t0 = performance.now();
    cancelAnimationFrame(confettiRaf);
    const step = (now) => {
      const age = now - t0;
      g.clearRect(0, 0, W, H);
      if (age > 5200 || !$('#screen-victory').classList.contains('active')) return;
      g.globalAlpha = age > 4200 ? 1 - (age - 4200) / 1000 : 1;
      parts.forEach((p) => {
        p.vy += 0.45 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        g.beginPath(); g.moveTo(-p.s / 2, -p.s / 2); g.lineTo(p.s / 2, -p.s / 2); g.lineTo(0, p.s * 0.7); g.closePath(); g.fill();
        g.restore();
      });
      confettiRaf = requestAnimationFrame(step);
    };
    confettiRaf = requestAnimationFrame(step);
  }

  function backToSetup() {
    cancelAnimationFrame(confettiRaf);
    S.tongue(0, 0.2);
    refreshResume();
    show('screen-setup');
  }

  // =========================================================
  // ربط الأحداث
  // =========================================================
  $$('.theme-dot').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.setTheme); S.tongue(0, 0.2); }));
  setTheme(document.documentElement.dataset.theme);

  const soundBtn = $('#soundBtn');
  soundBtn.setAttribute('aria-pressed', String(S.on));
  soundBtn.setAttribute('aria-label', S.on ? 'سكّر الصوت' : 'رجّع الصوت');
  soundBtn.addEventListener('click', () => {
    const on = S.toggle();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'سكّر الصوت' : 'رجّع الصوت');
  });

  $('#startBtn').addEventListener('click', () => {
    if (readSave()) {
      ask({ title: 'تبي تهدم كل شي وتبدأ من جديد؟', text: 'فيه حرّاج محفوظ ما خلص، والجديد بيمسحه.', yes: 'إيه، من جديد' }, startGame);
    } else startGame();
  });
  $('#resumeBtn').addEventListener('click', resume);
  $('#discardBtn').addEventListener('click', () => ask(
    { title: 'نشيل الحراج المحفوظ؟', text: 'ما تقدرون ترجعون له بعدين.', yes: 'إيه، شيله' },
    () => { store.del(SAVE_KEY); refreshResume(); }
  ));
  $('#resetBtn').addEventListener('click', backToSetup);
  el.pauseBtn.addEventListener('click', togglePause);
  $('#endBtn').addEventListener('click', () => ask(
    { title: 'هل تريد أن تنهي اللعبة يا محترم؟', text: 'بنقيّم كل السيارات بقيمتها السوقية ونعلن الفائز قدّام الكل.', yes: 'إيه، خلّصنا', no: 'لا، كمّلوا' },
    finish
  ));
  $('#confirmYes').addEventListener('click', () => closeAsk(true));
  $('#confirmNo').addEventListener('click', () => closeAsk(false));
  $('#confirm').addEventListener('click', (e) => { if (e.target.id === 'confirm') closeAsk(false); });

  el.stage.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled || !G) return;
    const i = parseInt(b.dataset.i, 10);
    switch (b.dataset.act) {
      case 'question': showQuestion(); break;
      case 'skip': stopTimer(); showQuestion(false); S.tongue(0, 0.2); break;
      case 'buzz': buzz(i); break;
      case 'answer': answer(i); break;
      case 'judge': judge(i === 1); break;
      case 'next': S.tongue(0, 0.2); advance(); break;
      case 'lot': S.tongue(0, 0.2); startLot(); break;
      case 'bid': teamBid(i); break;
      case 'step': if (A) { A.step = parseInt(b.dataset.s, 10); S.tongue(0, 0.2); renderBidZone(); } break;
      case 'undo': undoBid(); break;
      case 'pauseHammer': if (A) { A.paused = !A.paused; S.tongue(0, 0.2); renderBidZone(); } break;
      case 'call': nextCall(); break;
      case 'sellNow': sell(); break;
      case 'noSale': unsold(); break;
      case 'market': S.tongue(0, 0.2); endRound(); break;
      case 'sellCar': sellCar(parseInt(b.dataset.id, 10)); break;
      case 'nextRound': nextRound(); break;
      case 'finish': finish(); break;
      default: break;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#confirm').hidden) return closeAsk(false);
    // اختصار للمقدّم: رقم الفريق يسوّم له (١–٦)
    if (!A || A.sold || !$('#confirm').hidden || /input|textarea/i.test((e.target && e.target.tagName) || '')) return;
    const d = '١٢٣٤٥٦'.indexOf(e.key) >= 0 ? '١٢٣٤٥٦'.indexOf(e.key) : '123456'.indexOf(e.key);
    if (d >= 0 && d < G.teams.length) teamBid(d);
  });
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(refreshBunting, 150); });

  refreshBunting();
  initSetup();
})();
