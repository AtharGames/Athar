/* =========================================================
   سِجَال | مولّدات المشاهد ببذرة (نفس المشهد على كل الأجهزة)
   - FZ_SCENE.scene(seed)   ← مشهد غني بالتفاصيل لعين الصقر وأدق وصف: { svg, facts, kind, title }
   - FZ_SCENE.ask(scene, seed) ← سؤال عن تفصيلة في المشهد بأربعة خيارات
   - FZ_SCENE.describeScore(text, facts) ← تقييم الوصف المكتوب (٠–١٠٠) مع التفاصيل اللي أصاب فيها
   - FZ_SCENE.target(seed)  ← صورة بسيطة لتحدي الرسم: { prims, svg, title } و paint(ctx) و similarity()
   - FZ_SCENE.reflex(seed)  ← شبكة سرعة البديهة: { cmd, mode, cells, ans }
   ========================================================= */
window.FZ_SCENE = (() => {
  'use strict';
  const { rng } = window.FZ;
  const EMO = 'font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif"';
  const COLORS = { 'أحمر': '#D94841', 'أزرق': '#2F6FD6', 'أخضر': '#2E9E5B', 'أصفر': '#F2C21B', 'بني': '#8B5A2B', 'أبيض': '#F7F4EC', 'بنفسجي': '#7E57C2', 'برتقالي': '#EE8A2A' };
  const CNAMES = Object.keys(COLORS);
  const SIGNS = ['تمور', 'عطارة', 'بخور', 'قهوة', 'خيّاط', 'حلويات', 'بهارات', 'عسل', 'سجاد', 'فخّار', 'عود', 'أقمشة', 'خبز', 'حلاوة', 'دلال', 'مشالح', 'سبح', 'كتب', 'فواكه', 'ورد'];

  // كلمات للبحث في الوصف (بعد التطبيع)
  const W = {
    palm: ['نخل', 'نخله', 'نخيل', 'نخلات', 'نخلتين', 'نخلتان'],
    camel: ['جمل', 'جمال', 'ابل', 'ناقه', 'نوق', 'بعير', 'جملين'],
    horse: ['حصان', 'خيل', 'خيول', 'احصنه', 'فرس', 'حصانين'],
    tent: ['خيمه', 'خيام', 'خيمات', 'خيمتين', 'بيت شعر'],
    bird: ['طير', 'طيور', 'عصفور', 'عصافير', 'نوارس', 'نورس', 'طيرين'],
    sun: ['شمس'], moon: ['قمر', 'هلال'], star: ['نجوم', 'نجمه', 'نجم'],
    dune: ['كثبان', 'رمل', 'رمال', 'صحراء', 'كثيب', 'تلال'],
    shop: ['محل', 'محلات', 'دكان', 'دكاكين', 'سوق'],
    sign: ['لوحه', 'لافته', 'مكتوب'],
    lantern: ['فانوس', 'فوانيس', 'مصباح', 'مصابيح', 'فانوسين'],
    crate: ['صندوق', 'صناديق', 'كرتون', 'كراتين', 'صندوقين'],
    cat: ['قطه', 'قطط', 'بس', 'قطوه', 'قطتين'],
    pot: ['جره', 'جرار', 'فخار', 'زير', 'جرتين'],
    house: ['بيت', 'بيوت', 'منزل', 'منازل', 'مبنى', 'مباني', 'بيتين'],
    window: ['نافذه', 'نوافذ', 'شباك', 'شبابيك', 'دريشه', 'درايش'],
    door: ['باب', 'ابواب', 'بيبان'],
    goat: ['ماعز', 'عنز', 'غنم', 'خروف', 'خرفان', 'معز', 'تيس'],
    falcon: ['صقر', 'صقور', 'شاهين', 'صقرين'],
    cloud: ['غيم', 'غيوم', 'سحاب', 'سحابه', 'غيمه', 'غيمتين'],
    well: ['بئر', 'بير', 'قليب'],
    boat: ['قارب', 'قوارب', 'سفينه', 'سفن', 'مركب', 'مراكب', 'شراع', 'قاربين'],
    sea: ['بحر', 'ماء', 'موج', 'شاطئ', 'ساحل'],
    crab: ['سلطعون', 'سرطان', 'قبقب', 'قباقب', 'سلطعونات'],
    umbrella: ['شمسيه', 'مظله', 'مظلات', 'شماسي'],
    lighthouse: ['منار', 'مناره', 'فنار']
  };
  const NUMW = { 'واحد': 1, 'واحده': 1, 'وحده': 1, 'اثنين': 2, 'اثنان': 2, 'ثنتين': 2, 'اثنتين': 2, 'اثنتان': 2, 'ثلاث': 3, 'ثلاثه': 3, 'اربع': 4, 'اربعه': 4,
    'خمس': 5, 'خمسه': 5, 'ست': 6, 'سته': 6, 'سبع': 7, 'سبعه': 7, 'ثمان': 8, 'ثمانيه': 8, 'ثماني': 8, 'تسع': 9, 'تسعه': 9, 'عشر': 10, 'عشره': 10 };

  function norm(s) {
    return String(s || '').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^ء-ي0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const strip = (w) => (w.length > 4 && w.startsWith('ال') ? w.slice(2) : w).replace(/^و(?=ال)/, '').replace(/^(وال|بال|فال)/, '');

  // ---------- أدوات الرسم ----------
  const emoji = (ch, x, y, s) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${s}" text-anchor="middle" ${EMO}>${ch}</text>`;
  const bird = (x, y, s = 1) => `<path d="M${x} ${y}q${4 * s} ${-5 * s} ${8 * s} 0q${4 * s} ${-5 * s} ${8 * s} 0" fill="none" stroke="#1d1d1d" stroke-width="${1.8 * s}" stroke-linecap="round"/>`;
  function slots(r, n, x0, x1, minGap) {
    const out = [];
    for (let k = 0; k < n * 40 && out.length < n; k++) {
      const x = x0 + r() * (x1 - x0);
      if (out.every((o) => Math.abs(o - x) >= minGap)) out.push(x);
    }
    while (out.length < n) out.push(x0 + r() * (x1 - x0));
    return out;
  }
  const otherColors = (r, but, n) => r.shuffle(CNAMES.filter((c) => !but.includes(c))).slice(0, n);

  // =========================================================
  // المشاهد
  // =========================================================
  const SKY = { day: ['#7CC6F2', '#D9F0FB'], sunset: ['#EE7E3B', '#FBD38D'], night: ['#121D52', '#3A4A98'] };
  function skyDefs(id, t) { return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY[t][0]}"/><stop offset="1" stop-color="${SKY[t][1]}"/></linearGradient></defs>`; }

  function oasis(r, id) {
    const t = r.pick(['day', 'day', 'sunset', 'night']);
    const night = t === 'night';
    let s = skyDefs(id, t) + `<rect width="400" height="250" fill="url(#${id})"/>`;
    const facts = [];
    if (night) {
      const mx = r.int(40, 360);
      s += `<circle cx="${mx}" cy="42" r="20" fill="#FBE7A1"/><circle cx="${mx + 9}" cy="36" r="17" fill="${SKY.night[0]}"/>`;
      for (let i = 0; i < 12; i++) s += `<circle cx="${r.int(5, 395)}" cy="${r.int(6, 95)}" r="${(r() * 1.2 + 0.6).toFixed(1)}" fill="#fff" opacity=".85"/>`;
      facts.push({ k: 'moon', label: 'القمر', w: W.moon, have: true }, { k: 'star', label: 'النجوم', w: W.star, have: true });
    } else {
      s += `<circle cx="${r.int(40, 360)}" cy="${t === 'sunset' ? 112 : 46}" r="24" fill="${t === 'sunset' ? '#F25C2A' : '#FFD34D'}"/>`;
      facts.push({ k: 'sun', label: 'الشمس', w: W.sun, have: true });
    }
    s += `<path d="M0 150 Q70 112 150 140 T300 128 T400 140 V250 H0Z" fill="${night ? '#5B4C82' : '#E5B86B'}"/>`;
    s += `<path d="M0 178 Q90 150 200 172 T400 166 V250 H0Z" fill="${night ? '#7B6AA2' : '#F2D49B'}"/>`;
    facts.push({ k: 'dune', label: 'الرمال', w: W.dune, have: true });
    // طيور
    const nb = night ? 0 : r.int(0, 6);
    for (let i = 0; i < nb; i++) s += bird(r.int(20, 370), r.int(18, 92), 0.9 + r() * 0.5);
    facts.push({ k: 'bird', label: 'الطيور', w: W.bird, n: nb });
    // خيام: وحدة كبيرة بلون مميز
    const nt = r.int(1, 3), tc = r.shuffle(['أحمر', 'أخضر', 'أزرق', 'أبيض', 'بني', 'بنفسجي', 'أصفر']);
    const tx = slots(r, nt, 50, 350, 90);
    let big = '';
    tx.forEach((x, i) => {
      const k = i === 0 ? 1.35 : 0.85, y = 178 + (i === 0 ? 4 : -2), w = 56 * k, h = 40 * k, c = COLORS[tc[i]];
      s += `<path d="M${x - w / 2} ${y}L${x} ${y - h}L${x + w / 2} ${y}Z" fill="${c}" stroke="rgba(0,0,0,.25)"/><path d="M${x - 7 * k} ${y}L${x} ${y - 16 * k}L${x + 7 * k} ${y}Z" fill="rgba(0,0,0,.35)"/>`;
      if (i === 0) big = tc[i];
    });
    facts.push({ k: 'tent', label: 'الخيام', w: W.tent, n: nt, color: big, colorLabel: 'لون الخيمة الكبيرة' });
    const np = r.int(1, 5), nc = r.int(0, 5), nh = r.int(0, 4);
    slots(r, np, 20, 380, 34).forEach((x) => { s += emoji('🌴', x, r.int(150, 172), r.int(40, 50)); });
    slots(r, nc, 20, 380, 38).forEach((x) => { s += emoji('🐪', x, r.int(212, 238), r.int(30, 36)); });
    slots(r, nh, 20, 380, 36).forEach((x) => { s += emoji('🐎', x, r.int(205, 240), r.int(26, 32)); });
    facts.push({ k: 'palm', label: 'النخيل', w: W.palm, n: np }, { k: 'camel', label: 'الجمال', w: W.camel, n: nc }, { k: 'horse', label: 'الخيول', w: W.horse, n: nh });
    return { s, facts, title: night ? 'ليلة في الصحراء' : 'واحة في الصحراء' };
  }

  function souq(r) {
    let s = `<rect width="400" height="250" fill="#EAD7AE"/><rect y="0" width="400" height="26" fill="#C9A26B"/><rect y="200" width="400" height="50" fill="#B89463"/>`;
    for (let i = 0; i < 9; i++) s += `<rect x="${i * 46 + 4}" y="4" width="38" height="18" rx="3" fill="#B8925C" opacity=".6"/>`;
    const facts = [];
    const dc = r.shuffle(['أزرق', 'أخضر', 'أحمر', 'بني', 'أصفر', 'بنفسجي']).slice(0, 3);
    const signAt = r.int(0, 2), word = r.pick(SIGNS);
    const xs = [70, 200, 330];
    xs.forEach((x, i) => {
      const aw = r.pick(['#D94841', '#2F6FD6', '#2E9E5B', '#EE8A2A']);
      s += `<path d="M${x - 52} 92 h104 v108 h-104z" fill="#D9C08F" stroke="#A9895A" stroke-width="2"/>`;
      s += `<path d="M${x - 60} 92 L${x - 48} 74 H${x + 48} L${x + 60} 92Z" fill="${aw}"/>`;
      for (let k = 0; k < 6; k++) s += `<path d="M${x - 56 + k * 20} 92 l6 -16 h8 l-4 16z" fill="#fff" opacity=".55"/>`;
      s += `<path d="M${x - 24} 200 V138 a24 24 0 0 1 48 0 V200Z" fill="${COLORS[dc[i]]}" stroke="rgba(0,0,0,.3)" stroke-width="2"/><circle cx="${x + 14}" cy="172" r="2.6" fill="#F2C21B"/>`;
      if (i === signAt) s += `<rect x="${x - 46}" y="40" width="92" height="28" rx="5" fill="#2B1E10" stroke="#C9A26B" stroke-width="2"/><text x="${x}" y="60" text-anchor="middle" font-size="17" font-weight="700" fill="#FBE7A1" font-family="Thmanyah Sans,IBM Plex Sans Arabic,sans-serif">${word}</text>`;
    });
    facts.push({ k: 'shop', label: 'المحلات', w: W.shop, n: 3 }, { k: 'sign', label: 'اللوحة', w: W.sign, text: word, textLabel: 'الكلمة المكتوبة على اللوحة' },
      { k: 'door', label: 'الأبواب', w: W.door, n: 3, color: dc[signAt], colorLabel: 'لون باب المحل اللي فوقه اللوحة' });
    const nl = r.int(1, 5);
    slots(r, nl, 20, 380, 40).forEach((x) => { s += `<path d="M${x} 26 v14" stroke="#5a4325" stroke-width="2"/><rect x="${x - 7}" y="40" width="14" height="18" rx="4" fill="#F2C21B" stroke="#7a5a2a" stroke-width="2"/><circle cx="${x}" cy="49" r="11" fill="#FFE48A" opacity=".35"/>`; });
    const ncr = r.int(1, 5);
    slots(r, ncr, 25, 375, 30).forEach((x) => { const y = r.int(206, 222); s += `<rect x="${x - 13}" y="${y}" width="26" height="18" fill="#9C6B36" stroke="#5f3f1d" stroke-width="2"/><path d="M${x - 11} ${y + 3} h22" stroke="#4a2a10" stroke-width="5" stroke-dasharray="3 2"/>`; });
    const ncat = r.int(0, 3), npot = r.int(0, 3);
    slots(r, ncat, 20, 380, 40).forEach((x) => { s += emoji('🐈', x, r.int(236, 246), 26); });
    slots(r, npot, 20, 380, 40).forEach((x) => { s += emoji('🏺', x, 200, 28); });
    facts.push({ k: 'lantern', label: 'الفوانيس', w: W.lantern, n: nl }, { k: 'crate', label: 'صناديق التمر', w: W.crate, n: ncr },
      { k: 'cat', label: 'القطط', w: W.cat, n: ncat }, { k: 'pot', label: 'الجِرار', w: W.pot, n: npot });
    return { s, facts, title: 'سوق شعبي' };
  }

  function village(r, id) {
    const t = r.pick(['day', 'sunset']);
    let s = skyDefs(id, t) + `<rect width="400" height="250" fill="url(#${id})"/>`;
    s += `<circle cx="${r.int(40, 360)}" cy="${t === 'sunset' ? 100 : 40}" r="22" fill="${t === 'sunset' ? '#F25C2A' : '#FFD34D'}"/>`;
    const facts = [{ k: 'sun', label: 'الشمس', w: W.sun, have: true }];
    const ncl = r.int(0, 3);
    slots(r, ncl, 30, 370, 70).forEach((x) => { const y = r.int(22, 60); s += `<g fill="#fff" opacity=".92"><ellipse cx="${x}" cy="${y}" rx="24" ry="10"/><ellipse cx="${x + 12}" cy="${y - 7}" rx="14" ry="10"/><ellipse cx="${x - 12}" cy="${y - 4}" rx="11" ry="8"/></g>`; });
    facts.push({ k: 'cloud', label: 'الغيوم', w: W.cloud, n: ncl });
    s += `<rect y="185" width="400" height="65" fill="#D9B98A"/>`;
    const nhs = r.int(2, 3), dcol = r.shuffle(['أزرق', 'أخضر', 'أحمر', 'بني', 'أصفر']);
    const hx = nhs === 2 ? [110, 290] : [70, 200, 330];
    let wins = 0;
    hx.forEach((x, i) => {
      const big = i === 0, w = big ? 120 : 96, h = big ? 100 : 78, y = 190 - h;
      s += `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" fill="#C48E55" stroke="#8a5f33" stroke-width="2"/>`;
      for (let k = 0; k < w / 14; k++) s += `<path d="M${x - w / 2 + k * 14} ${y} l7 -9 l7 9z" fill="#C48E55" stroke="#8a5f33" stroke-width="1.5"/>`;
      s += `<rect x="${x - 13}" y="${190 - 36}" width="26" height="36" fill="${COLORS[dcol[i]]}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>`;
      const nw = r.int(1, 3);
      for (let k = 0; k < nw; k++) {
        const wx = x - w / 2 + 12 + k * ((w - 36) / Math.max(1, nw - 1) || 0) + (nw === 1 ? (w - 36) / 2 : 0);
        s += `<path d="M${wx} ${y + 30} v-10 a6 6 0 0 1 12 0 v10z" fill="#3a2a1a"/>`;
      }
      wins += nw;
    });
    facts.push({ k: 'house', label: 'البيوت', w: W.house, n: nhs }, { k: 'window', label: 'النوافذ', w: W.window, n: wins },
      { k: 'door', label: 'الأبواب', w: W.door, n: nhs, color: dcol[0], colorLabel: 'لون باب البيت الكبير' });
    const np = r.int(1, 4), ng = r.int(0, 4), nf = r.int(0, 2), well = r() < 0.5;
    slots(r, np, 15, 385, 40).forEach((x) => { s += emoji('🌴', x, r.int(186, 200), r.int(44, 54)); });
    slots(r, ng, 20, 380, 36).forEach((x) => { s += emoji('🐐', x, r.int(226, 244), 28); });
    slots(r, nf, 20, 380, 60).forEach((x) => { s += `<path d="M${x} 246 v-22" stroke="#5a3d20" stroke-width="3"/><path d="M${x - 12} 224 h24" stroke="#5a3d20" stroke-width="3"/>` + emoji('🦅', x, 222, 26); });
    if (well) { const x = r.int(40, 360); s += `<rect x="${x - 18}" y="214" width="36" height="22" fill="#9a8a78" stroke="#5e5246" stroke-width="2"/><path d="M${x - 18} 214 v-18 M${x + 18} 214 v-18 M${x - 22} 196 h44" stroke="#5a3d20" stroke-width="3"/>`; }
    facts.push({ k: 'palm', label: 'النخيل', w: W.palm, n: np }, { k: 'goat', label: 'الماعز', w: W.goat, n: ng }, { k: 'falcon', label: 'الصقور', w: W.falcon, n: nf },
      { k: 'well', label: 'البئر', w: W.well, have: well });
    return { s, facts, title: 'قرية تراثية' };
  }

  function coast(r, id) {
    const t = r.pick(['day', 'day', 'sunset']);
    let s = skyDefs(id, t) + `<rect width="400" height="250" fill="url(#${id})"/>`;
    const sx = r.int(40, 360);
    s += `<circle cx="${sx}" cy="${t === 'sunset' ? 112 : 44}" r="23" fill="${t === 'sunset' ? '#F25C2A' : '#FFD34D'}"/>`;
    s += `<rect y="118" width="400" height="62" fill="#2F7FD6"/><path d="M0 130 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" stroke="#9fd3ff" stroke-width="2" fill="none" opacity=".7"/>`;
    s += `<path d="M0 182 Q100 170 200 182 T400 178 V250 H0Z" fill="#F2D49B"/>`;
    const facts = [{ k: 'sun', label: 'الشمس', w: W.sun, have: true }, { k: 'sea', label: 'البحر', w: W.sea, have: true }];
    const nbo = r.int(1, 4), sc = r.shuffle(['أبيض', 'أحمر', 'أصفر', 'أخضر', 'أزرق', 'برتقالي']);
    slots(r, nbo, 40, 360, 70).forEach((x, i) => {
      const k = i === 0 ? 1.3 : 0.8, y = 150 + (i === 0 ? 8 : 0);
      s += `<path d="M${x - 30 * k} ${y} h${60 * k} l${-10 * k} ${12 * k} h${-40 * k}z" fill="#7A4A22"/><path d="M${x} ${y} V${y - 48 * k}" stroke="#4a2a10" stroke-width="${2 * k}"/><path d="M${x + 2} ${y - 46 * k} L${x + 2} ${y - 4} L${x + 30 * k} ${y - 6}Z" fill="${COLORS[sc[i]]}" stroke="rgba(0,0,0,.25)"/>`;
    });
    facts.push({ k: 'boat', label: 'القوارب', w: W.boat, n: nbo, color: sc[0], colorLabel: 'لون شراع القارب الكبير' });
    const ng = r.int(0, 6);
    for (let i = 0; i < ng; i++) s += bird(r.int(20, 370), r.int(16, 96), 1 + r() * 0.4);
    facts.push({ k: 'bird', label: 'الطيور', w: W.bird, n: ng });
    const light = r() < 0.6;
    if (light) {
      const lc = r.pick(['أحمر', 'أزرق', 'أخضر']), x = sx > 200 ? 40 : 360;
      s += `<path d="M${x - 12} 182 L${x - 7} 92 H${x + 7} L${x + 12} 182Z" fill="#fff" stroke="#555"/>`;
      for (let k = 0; k < 3; k++) s += `<path d="M${x - 11 + k * 0.6} ${170 - k * 28} L${x - 10 + k * 0.6} ${158 - k * 28} H${x + 10 - k * 0.6} L${x + 11 - k * 0.6} ${170 - k * 28}Z" fill="${COLORS[lc]}"/>`;
      s += `<rect x="${x - 9}" y="80" width="18" height="12" fill="#FFE48A" stroke="#555"/><path d="M${x - 11} 80 L${x} 70 L${x + 11} 80Z" fill="${COLORS[lc]}"/>`;
      facts.push({ k: 'lighthouse', label: 'المنارة', w: W.lighthouse, have: true, color: lc, colorLabel: 'لون خطوط المنارة' });
    }
    const np = r.int(0, 3), ncr = r.int(0, 3), nu = r.int(0, 3);
    slots(r, np, 60, 340, 40).forEach((x) => { s += emoji('🌴', x, r.int(196, 212), r.int(42, 50)); });
    slots(r, ncr, 20, 380, 36).forEach((x) => { s += emoji('🦀', x, r.int(228, 246), 24); });
    slots(r, nu, 20, 380, 50).forEach((x) => { s += emoji('⛱️', x, r.int(222, 240), 34); });
    facts.push({ k: 'palm', label: 'النخيل', w: W.palm, n: np }, { k: 'crab', label: 'السلطعونات', w: W.crab, n: ncr }, { k: 'umbrella', label: 'المظلات', w: W.umbrella, n: nu });
    return { s, facts, title: 'ساحل البحر' };
  }

  const KINDS = { oasis, souq, village, coast };
  function scene(seed, kind) {
    const r = rng(seed), id = 'sk' + (seed % 100000);
    kind = kind || r.pick(Object.keys(KINDS));
    const o = KINDS[kind](r, id);
    return { kind, title: o.title, facts: o.facts, svg: `<svg class="scene" viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${o.title}">${o.s}</svg>` };
  }

  // ---------- سؤال عين الصقر ----------
  function ask(sc, seed) {
    const r = rng(seed ^ 0x5bd1e995);
    const pool = [];
    sc.facts.forEach((f) => {
      if (typeof f.n === 'number') pool.push({ q: `كم عدد ${f.label}؟`, type: 'n', f });
      if (f.color) pool.push({ q: `ما ${f.colorLabel}؟`, type: 'c', f });
      if (f.text) pool.push({ q: `ما ${f.textLabel}؟`, type: 't', f });
    });
    // نفضّل الألوان والكلمات قليلًا لأنها أمتع
    const pick = r.pick(pool.concat(pool.filter((p) => p.type !== 'n')));
    let opts, right;
    if (pick.type === 'n') {
      right = String(pick.f.n);
      const c = new Set([pick.f.n]);
      const cand = r.shuffle([-2, -1, 1, 2, 3, -3].map((d) => pick.f.n + d).filter((v) => v >= 0));
      cand.forEach((v) => { if (c.size < 4) c.add(v); });
      opts = [...c].sort((a, b) => a - b).map((v) => window.FZ.ar(v));
      right = window.FZ.ar(right);
    } else if (pick.type === 'c') {
      right = pick.f.color;
      opts = r.shuffle([right, ...otherColors(r, [right], 3)]);
    } else {
      right = pick.f.text;
      opts = r.shuffle([right, ...r.shuffle(SIGNS.filter((x) => x !== right)).slice(0, 3)]);
    }
    return { q: pick.q, opts, correct: opts.indexOf(right) };
  }

  // ---------- تقييم الوصف ----------
  // لكل تفصيلة موجودة: ذكرها (٦) + العدد الصحيح (٤) + اللون/الكلمة الصحيحة (٤)، وطول الوصف حتى ١٠
  function describeScore(text, facts) {
    const toks = norm(text).split(' ').filter(Boolean).map(strip);
    const words = toks.length;
    const hits = [];
    let got = 0, max = 10;
    const findIdx = (list) => {
      const ws = list.map(norm);
      const idx = [];
      toks.forEach((t, i) => { if (ws.some((w) => t === w || (w.length >= 3 && t.startsWith(w) && t.length - w.length <= 3) || (t.length >= 3 && w.startsWith(t) && w.length - t.length <= 1))) idx.push(i); });
      // كلمتين مثل «بيت شعر»
      ws.filter((w) => w.includes(' ')).forEach((w) => { const p = w.split(' '); toks.forEach((t, i) => { if (t === p[0] && toks[i + 1] === p[1]) idx.push(i); }); });
      return idx;
    };
    // العدد المرتبط بالكلمة: المثنى أولًا، ثم الكلمة السابقة، فاللاحقة، فالتي قبلها
    const numNear = (i) => {
      const t = toks[i];
      if (/(تين|تان|ين|ان)$/.test(t) && t.length >= 5) return 2;
      for (const d of [-1, 1, -2]) {
        const x = toks[i + d];
        if (!x) continue;
        if (/^\d+$/.test(x)) return +x;
        if (NUMW[x] != null) return NUMW[x];
      }
      return null;
    };
    facts.forEach((f) => {
      const exists = f.have || (typeof f.n === 'number' && f.n > 0) || f.text;
      if (!exists) return;
      max += 6;
      const idx = findIdx(f.w);
      const said = idx.length > 0;
      let note = '';
      if (said) { got += 6; note = f.label; }
      if (typeof f.n === 'number') {
        max += 4;
        if (said && idx.some((i) => numNear(i) === f.n || (f.n === 1 && numNear(i) == null && !/(ات|ين|ان)$/.test(toks[i])))) { got += 4; note += ' + العدد'; }
      }
      if (f.color) {
        max += 4;
        const cw = norm(f.color).replace(/^ال/, '');
        if (said && idx.some((i) => toks.slice(Math.max(0, i - 4), i + 5).some((t) => t.includes(cw) || (cw === 'ابيض' && t.includes('بيضا')) || (cw === 'اخضر' && t.includes('خضرا')) || (cw === 'احمر' && t.includes('حمرا')) || (cw === 'اصفر' && t.includes('صفرا')) || (cw === 'ازرق' && t.includes('زرقا'))))) { got += 4; note += ' + اللون'; }
      }
      if (f.text) {
        max += 4;
        if (toks.includes(strip(norm(f.text)))) { got += 4; note += ' + الكلمة'; if (!said) { got += 6; note = f.label + ' + الكلمة'; } }
      }
      if (note) hits.push(note);
    });
    got += Math.min(10, Math.round(words / 4));
    return { score: Math.min(100, Math.round(100 * got / max)), hits, words };
  }

  // =========================================================
  // صور تحدي الرسم: أشكال بسيطة تُرسم في SVG وفي Canvas من نفس القائمة
  // =========================================================
  const TARGETS = {
    beach: (r) => [
      { t: 'rect', x: 0, y: 0, w: 300, h: 120, f: '#8FD3F7' }, { t: 'rect', x: 0, y: 108, w: 300, h: 46, f: '#1E6FE0' },
      { t: 'rect', x: 0, y: 150, w: 300, h: 75, f: '#F2D38B' }, { t: 'circ', x: r.int(40, 120), y: r.int(32, 52), r: 24, f: '#FFD34D' },
      ...palm(r.int(190, 250), 196)
    ],
    night: (r) => {
      const mx = r.int(200, 260);
      return [
        { t: 'rect', x: 0, y: 0, w: 300, h: 225, f: '#1B2A6B' }, { t: 'circ', x: mx, y: 52, r: 26, f: '#FBE7A1' }, { t: 'circ', x: mx + 12, y: 44, r: 23, f: '#1B2A6B' },
        { t: 'circ', x: 60, y: 40, r: 3, f: '#FFFFFF' }, { t: 'circ', x: 120, y: 70, r: 3, f: '#FFFFFF' }, { t: 'circ', x: 160, y: 30, r: 3, f: '#FFFFFF' },
        { t: 'poly', p: [[0, 160], [90, 125], [190, 158], [300, 135], [300, 225], [0, 225]], f: '#C89B5E' },
        { t: 'poly', p: [[r.int(40, 70), 182], [r.int(90, 110), 120], [r.int(140, 165), 182]], f: '#D94841' }
      ];
    },
    house: (r) => {
      const x = r.int(70, 120);
      return [
        { t: 'rect', x: 0, y: 0, w: 300, h: 160, f: '#9ED8F5' }, { t: 'rect', x: 0, y: 155, w: 300, h: 70, f: '#6CC070' },
        { t: 'rect', x, y: 95, w: 90, h: 70, f: '#F5D7A1' }, { t: 'poly', p: [[x - 10, 98], [x + 45, 55], [x + 100, 98]], f: '#D94841' },
        { t: 'rect', x: x + 34, y: 125, w: 22, h: 40, f: '#8B5A2B' },
        { t: 'rect', x: 232, y: 120, w: 14, h: 45, f: '#8B5A2B' }, { t: 'circ', x: 239, y: 105, r: 30, f: '#2E9E5B' },
        { t: 'circ', x: r.int(30, 60), y: 36, r: 20, f: '#FFD34D' }
      ];
    },
    mountains: (r) => [
      { t: 'rect', x: 0, y: 0, w: 300, h: 225, f: '#BFE6FA' }, { t: 'circ', x: r.int(200, 260), y: 45, r: 22, f: '#F59E0B' },
      { t: 'poly', p: [[0, 180], [90, 60], [180, 180]], f: '#7D8597' }, { t: 'poly', p: [[65, 93], [90, 60], [115, 93]], f: '#FFFFFF' },
      { t: 'poly', p: [[110, 180], [205, 85], [300, 180]], f: '#5C677D' }, { t: 'poly', p: [[183, 107], [205, 85], [227, 107]], f: '#FFFFFF' },
      { t: 'rect', x: 0, y: 175, w: 300, h: 50, f: '#6CC070' }
    ],
    boat: (r) => {
      const x = r.int(90, 170);
      return [
        { t: 'rect', x: 0, y: 0, w: 300, h: 130, f: '#F9C784' }, { t: 'circ', x: r.int(200, 250), y: 128, r: 34, f: '#F2683C' },
        { t: 'rect', x: 0, y: 128, w: 300, h: 97, f: '#2F6FD6' },
        { t: 'poly', p: [[x - 50, 150], [x + 50, 150], [x + 35, 172], [x - 35, 172]], f: '#7A4A22' },
        { t: 'rect', x: x - 2, y: 72, w: 4, h: 80, f: '#4A2A10' }, { t: 'poly', p: [[x + 3, 76], [x + 3, 146], [x + 46, 146]], f: '#FFFFFF' }
      ];
    },
    oasis: (r) => [
      { t: 'rect', x: 0, y: 0, w: 300, h: 225, f: '#9ED8F5' }, { t: 'rect', x: 0, y: 120, w: 300, h: 105, f: '#F2D38B' },
      { t: 'ell', x: r.int(130, 170), y: 175, rx: 70, ry: 20, f: '#1E6FE0' }, { t: 'circ', x: 250, y: 40, r: 22, f: '#FFD34D' },
      ...palm(r.int(40, 70), 168), ...palm(r.int(230, 260), 160)
    ]
  };
  Object.assign(TARGETS, {
    mosque: (r) => {
      const x = r.int(110, 150);
      return [
        { t: 'rect', x: 0, y: 0, w: 300, h: 225, f: '#F9C784' }, { t: 'rect', x: 0, y: 170, w: 300, h: 55, f: '#F2D38B' },
        { t: 'ell', x, y: 112, rx: 36, ry: 34, f: '#2E9E5B' }, { t: 'rect', x: x - 50, y: 110, w: 100, h: 62, f: '#FFFFFF' },
        { t: 'rect', x: x + 62, y: 62, w: 16, h: 110, f: '#FFFFFF' }, { t: 'poly', p: [[x + 60, 64], [x + 70, 40], [x + 80, 64]], f: '#2E9E5B' },
        { t: 'rect', x: x - 12, y: 140, w: 24, h: 32, f: '#8B5A2B' }, { t: 'rect', x: x - 38, y: 124, w: 14, h: 18, f: '#8FD3F7' }, { t: 'rect', x: x + 24, y: 124, w: 14, h: 18, f: '#8FD3F7' }, { t: 'circ', x: 250, y: 40, r: 18, f: '#F2683C' }
      ];
    },
    rainbow: (r) => {
      const cx = r.int(130, 170);
      return [
        { t: 'rect', x: 0, y: 0, w: 300, h: 225, f: '#BFE6FA' },
        { t: 'circ', x: cx, y: 200, r: 120, f: '#D94841' }, { t: 'circ', x: cx, y: 200, r: 104, f: '#F59E0B' }, { t: 'circ', x: cx, y: 200, r: 88, f: '#FFD34D' },
        { t: 'circ', x: cx, y: 200, r: 72, f: '#2E9E5B' }, { t: 'circ', x: cx, y: 200, r: 56, f: '#1E6FE0' }, { t: 'circ', x: cx, y: 200, r: 40, f: '#BFE6FA' },
        { t: 'rect', x: 0, y: 185, w: 300, h: 40, f: '#6CC070' }, { t: 'ell', x: 60, y: 40, rx: 34, ry: 14, f: '#FFFFFF' }
      ];
    },
    apples: (r) => {
      const x = r.int(130, 170);
      return [
        { t: 'rect', x: 0, y: 0, w: 300, h: 225, f: '#9ED8F5' }, { t: 'rect', x: 0, y: 180, w: 300, h: 45, f: '#6CC070' },
        { t: 'rect', x: x - 10, y: 110, w: 20, h: 75, f: '#8B5A2B' }, { t: 'circ', x, y: 90, r: 58, f: '#2E9E5B' },
        { t: 'circ', x: x - 25, y: 75, r: 8, f: '#D94841' }, { t: 'circ', x: x + 22, y: 70, r: 8, f: '#D94841' }, { t: 'circ', x: x + 5, y: 105, r: 8, f: '#D94841' },
        { t: 'circ', x: x - 30, y: 110, r: 8, f: '#D94841' }, { t: 'circ', x: 260, y: 36, r: 18, f: '#FFD34D' }
      ];
    }
  });
  const TARGET_TITLES = { mosque: 'مسجد وقت الغروب', rainbow: 'قوس المطر', apples: 'شجرة تفاح', beach: 'شاطئ ونخلة', night: 'ليلة وخيمة', house: 'بيت وشجرة', mountains: 'جبال وشمس', boat: 'قارب وقت الغروب', oasis: 'واحة ونخلتين' };
  function palm(x, base) {
    return [
      { t: 'poly', p: [[x - 5, base], [x + 5, base], [x + 3, base - 80], [x - 1, base - 80]], f: '#8B5A2B' },
      { t: 'ell', x: x - 22, y: base - 84, rx: 26, ry: 8, f: '#2E9E5B', rot: 20 }, { t: 'ell', x: x + 24, y: base - 84, rx: 26, ry: 8, f: '#2E9E5B', rot: -20 },
      { t: 'ell', x: x - 14, y: base - 94, rx: 22, ry: 7, f: '#24864C', rot: -30 }, { t: 'ell', x: x + 16, y: base - 94, rx: 22, ry: 7, f: '#24864C', rot: 30 }
    ];
  }
  function primSvg(p) {
    if (p.t === 'rect') return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${p.f}"/>`;
    if (p.t === 'circ') return `<circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${p.f}"/>`;
    if (p.t === 'ell') return `<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="${p.f}" transform="rotate(${p.rot || 0} ${p.x} ${p.y})"/>`;
    return `<path d="M${p.p.map((q) => q.join(' ')).join('L')}Z" fill="${p.f}"/>`;
  }
  function paint(ctx, prims, w = 300, h = 225) {
    ctx.save(); ctx.scale(w / 300, h / 225);
    prims.forEach((p) => {
      ctx.fillStyle = p.f; ctx.beginPath();
      if (p.t === 'rect') ctx.rect(p.x, p.y, p.w, p.h);
      else if (p.t === 'circ') ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      else if (p.t === 'ell') ctx.ellipse(p.x, p.y, p.rx, p.ry, (p.rot || 0) * Math.PI / 180, 0, Math.PI * 2);
      else { p.p.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
      ctx.fill();
    });
    ctx.restore();
  }
  function target(seed) {
    const r = rng(seed);
    const kind = r.pick(Object.keys(TARGETS));
    const prims = TARGETS[kind](r);
    return { kind, title: TARGET_TITLES[kind], prims, svg: `<svg class="target" viewBox="0 0 300 225" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${TARGET_TITLES[kind]}">${prims.map(primSvg).join('')}</svg>` };
  }
  // تشابه رسمة مع الصورة الأصلية (٠–١٠٠): مقارنة الألوان على شبكة ٢٠×١٥ مع ترجيح الشكل العام
  function grid(drawFn) {
    const c = document.createElement('canvas'); c.width = 20; c.height = 15;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, 20, 15);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    drawFn(x, 20, 15);
    return x.getImageData(0, 0, 20, 15).data;
  }
  function similarity(prims, img) {
    const a = grid((x, w, h) => paint(x, prims, w, h));
    const b = grid((x, w, h) => x.drawImage(img, 0, 0, w, h));
    let d = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) {
      const dr = a[i] - b[i], dg = a[i + 1] - b[i + 1], db = a[i + 2] - b[i + 2];
      d += Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db); n++;
    }
    const avg = d / n; // ٠ تطابق تام
    return Math.max(0, Math.min(100, Math.round(100 * (1 - avg / 120))));
  }

  // =========================================================
  // سرعة البديهة
  // =========================================================
  const SHAPE_D = {
    'مربع': 'M7 7h26v26H7z', 'دائرة': 'M20 5a15 15 0 1 1 0 30a15 15 0 1 1 0-30z', 'مثلث': 'M20 5l16 29H4z',
    'نجمة': 'M20 3l4.9 10.6 11.6 1.3-8.6 7.9 2.4 11.4L20 28.4 9.7 34.2l2.4-11.4-8.6-7.9 11.6-1.3z', 'معيّن': 'M20 3l15 17-15 17L5 20z',
    'قلب': 'M20 35S4 25 4 14a8 8 0 0 1 16-2a8 8 0 0 1 16 2c0 11-16 21-16 21z'
  };
  function reflex(seed) {
    const r = rng(seed);
    const C = window.FZ_CONTENT.reflex;
    const mode = r.pick(['shape', 'shape', 'object', 'ink']);
    const n = 9, ans = r.int(0, n - 1);
    const cells = [];
    let cmd;
    if (mode === 'shape') {
      const tc = r.pick(C.colors), ts = r.pick(C.shapes);
      cmd = `اضغط: ${tc[0]} + ${ts}`;
      for (let i = 0; i < n; i++) {
        if (i === ans) { cells.push({ s: ts, c: tc[1] }); continue; }
        let c, s;
        do { c = r.pick(C.colors); s = r.pick(C.shapes); } while (c[0] === tc[0] && s === ts);
        // نصعّبها: بعض الخانات تشترك في اللون أو الشكل
        if (r() < 0.35) c = tc; else if (r() < 0.35) s = ts;
        if (c[0] === tc[0] && s === ts) s = C.shapes[(C.shapes.indexOf(ts) + 1) % C.shapes.length];
        cells.push({ s, c: c[1] });
      }
    } else if (mode === 'object') {
      const objs = r.shuffle(C.objects).slice(0, n);
      cmd = `اضغط: ${objs[ans][0]}`;
      objs.forEach((o) => cells.push({ e: o[1] }));
    } else {
      const ink = r.pick(C.colors);
      cmd = `اضغط على الكلمة المكتوبة باللون ${ink[0]}`;
      for (let i = 0; i < n; i++) {
        if (i === ans) { const w = r.pick(C.colors.filter((c) => c[0] !== ink[0])); cells.push({ w: w[0], c: ink[1] }); continue; }
        const c = r.pick(C.colors.filter((x) => x[0] !== ink[0]));
        // خانة فخ: الكلمة نفسها اسم اللون المطلوب لكن بحبر مختلف
        const w = (i === (ans + 3) % n) ? ink : r.pick(C.colors.filter((x) => x[0] !== c[0]));
        cells.push({ w: w[0], c: c[1] });
      }
    }
    return { cmd, mode, cells, ans };
  }
  function reflexCell(c) {
    if (c.e) return `<span class="rx-emo">${c.e}</span>`;
    if (c.w) return `<span class="rx-word" style="color:${c.c}">${c.w}</span>`;
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${SHAPE_D[c.s]}" fill="${c.c}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/></svg>`;
  }

  return { scene, ask, describeScore, target, paint, similarity, reflex, reflexCell, norm, COLORS };
})();
