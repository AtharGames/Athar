/* =========================================================
   الأسطول البحري | أدوات مشتركة بين شاشة المقدّم وجوال الفريق
   (قواعد الوحدات، نموذج الأسطول، رسم اللوح، محرر التقسيم، الأصوات، الثيمات)
   ========================================================= */
window.Fleet = (() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const S = window.AtharSound;

  // =========================================================
  // القواعد (كما في المسابقة الأصلية)
  // =========================================================
  const ROWS = ['أ', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر'];
  const SHIPS = {
    S: { name: 'غواصة', plural: 'غواصات', size: 4, pts: 1000, count: 2, ico: 'i-sub' },
    W: { name: 'سفينة', plural: 'سفن', size: 3, pts: 500, count: 5, ico: 'i-ship' },
    B: { name: 'قارب', plural: 'قوارب', size: 2, pts: 50, count: 10, ico: 'i-boat' }
  };
  const ORDER = ['S', 'W', 'B'];
  const SWIM = { name: 'سبّاح', plural: 'سبّاحين', pts: 5, count: 50, ico: 'i-swim' };
  const TRAP = { name: 'فخ', plural: 'أفخاخ', pts: -100, count: 5, ico: 'i-mine' };
  const START_STRIKES = 1; // ضربة البداية لكل فريق
  // =========================================================
  // بيانات الأسطول قابلة للتعديل من الإعداد (الافتراضي = المسابقة الأصلية)
  // cfg: { S:{c,z,p}, W:{c,z,p}, B:{c,z,p}, sw:{c,p}, tr:{c,p} }
  // c العدد، z حجم القطعة بالمربعات، p النقاط (وللفخ: مقدار الخصم)
  // =========================================================
  const DEFAULTS = { S: { c: 2, z: 4, p: 1000 }, W: { c: 5, z: 3, p: 500 }, B: { c: 10, z: 2, p: 50 }, sw: { c: 50, p: 5 }, tr: { c: 5, p: 100 } };
  const FIELDS = [
    { u: 'S', name: 'غواصة', ico: 'i-sub', f: [['c', 'العدد', 0, 6, 1], ['z', 'الحجم (مربعات)', 1, 5, 1], ['p', 'نقاط المربع', 0, 5000, 100]] },
    { u: 'W', name: 'سفينة', ico: 'i-ship', f: [['c', 'العدد', 0, 8, 1], ['z', 'الحجم (مربعات)', 1, 5, 1], ['p', 'نقاط المربع', 0, 5000, 50]] },
    { u: 'B', name: 'قارب', ico: 'i-boat', f: [['c', 'العدد', 0, 15, 1], ['z', 'الحجم (مربعات)', 1, 5, 1], ['p', 'نقاط المربع', 0, 2000, 10]] },
    { u: 'sw', name: 'جنود (سبّاحين)', ico: 'i-swim', f: [['c', 'العدد', 0, 200, 10], ['p', 'نقاط الجندي', 0, 100, 1]] },
    { u: 'tr', name: 'أفخاخ', ico: 'i-mine', f: [['c', 'العدد', 0, 15, 1], ['p', 'خصم الفخ', 0, 1000, 50]] }
  ];
  const MAX_CELLS = 60; // أقصى مجموع مربعات للقطع حتى يتسع التوزيع في خريطة ١٠×١٠
  function normCfg(c) {
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    if (c && typeof c === 'object') {
      if (typeof c.sw === 'number') out.sw.c = c.sw; // صيغة قديمة: عدد الجنود فقط
      FIELDS.forEach(({ u, f }) => f.forEach(([k, , min, max]) => {
        const v = c[u] && typeof c[u] === 'object' ? Number(c[u][k]) : NaN;
        if (Number.isInteger(v)) out[u][k] = Math.max(min, Math.min(max, v));
      }));
      out.sw.c = Math.max(0, Math.min(200, Math.round(out.sw.c) || 0));
    }
    return out;
  }
  const cfgCells = (c) => ORDER.reduce((a, t) => a + c[t].c * c[t].z, 0);
  const isDefaultCfg = (c) => JSON.stringify(normCfg(c)) === JSON.stringify(DEFAULTS);
  function setRules(c) {
    const n = normCfg(c);
    ORDER.forEach((t) => { SHIPS[t].count = n[t].c; SHIPS[t].size = n[t].z; SHIPS[t].pts = n[t].p; });
    SWIM.count = n.sw.c; SWIM.pts = n.sw.p;
    TRAP.count = n.tr.c; TRAP.pts = -n.tr.p;
    return n;
  }
  // وصف مختصر للبيانات الحالية
  function cfgSummary(c) {
    const n = normCfg(c);
    return [
      ...ORDER.map((t) => `${SHIPS[t].name}: ${ar(n[t].c)} بحجم ${ar(n[t].z)} ونقاط المربع ${ar(n[t].p)}`),
      `جنود: ${ar(n.sw.c)} ونقاط الجندي ${ar(n.sw.p)}`, `أفخاخ: ${ar(n.tr.c)} وخصم الفخ ${ar(n.tr.p)}`
    ];
  }
  const TEAM_COLORS = ['#E8554E', '#E59A1C', '#1FA971', '#8257E5', '#E0559B', '#0FA3B1'];
  const TEAM_NAMES = ['أسرة الفرسان', 'أسرة الأمل', 'أسرة الصقور', 'أسرة النصر', 'أسرة الشموخ', 'أسرة الريادة'];

  // =========================================================
  // أرقام ونصوص
  // =========================================================
  const ar = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // رقم بإشارة معزول حتى لا تنقلب الإشارة داخل النص العربي
  const sgn = (n) => `⁦${n > 0 ? '+' : n < 0 ? '−' : ''}${ar(Math.abs(n))}⁩`;
  const num = (n) => (n < 0 ? `⁦−${ar(Math.abs(n))}⁩` : ar(n));
  const cellName = (i) => `${ROWS[Math.floor(i / 10)]}${ar((i % 10) + 1)}`;
  const uid = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  // بصمة قصيرة لمفتاح الفريق: تُنشر علنًا بدل المفتاح نفسه
  const hash = (s) => { let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0; return h.toString(36).slice(0, 6); };

  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* تجاهل */ } }
  };

  // =========================================================
  // نموذج الأسطول: { ships:[[نوع،صف،عمود،رأسي]], sw:{خانة:عدد}, tr:{خانة:عدد} }
  // =========================================================
  const empty = () => ({ ships: [], sw: {}, tr: {} });
  const clone = (f) => JSON.parse(JSON.stringify(f));
  const shipCells = ([t, r, c, v]) => Array.from({ length: SHIPS[t].size }, (_, k) => (v ? (r + k) * 10 + c : r * 10 + c + k));
  function occ(f) {
    const o = new Array(100).fill(-1);
    f.ships.forEach((s, i) => shipCells(s).forEach((x) => { if (x >= 0 && x < 100) o[x] = i; }));
    return o;
  }
  const sum = (m) => Object.values(m || {}).reduce((a, b) => a + b, 0);
  function counts(f) {
    const c = { S: 0, W: 0, B: 0, sw: sum(f.sw), tr: sum(f.tr) };
    f.ships.forEach((s) => { c[s[0]]++; });
    return c;
  }
  function left(f) {
    const c = counts(f);
    return { S: SHIPS.S.count - c.S, W: SHIPS.W.count - c.W, B: SHIPS.B.count - c.B, sw: SWIM.count - c.sw, tr: TRAP.count - c.tr };
  }
  const isComplete = (f) => Object.values(left(f)).every((x) => x === 0);
  const totalItems = () => SHIPS.S.count + SHIPS.W.count + SHIPS.B.count + SWIM.count + TRAP.count;
  const placedItems = (f) => totalItems() - Object.values(left(f)).reduce((a, b) => a + Math.max(0, b), 0);

  // هل تتسع القطعة؟ يرجّع '' إذا تمام، أو سبب الرفض
  function fits(f, t, r, c, v, ignore = -1) {
    const size = SHIPS[t].size;
    if (r < 0 || c < 0 || (v ? r + size > 10 : c + size > 10)) return 'edge';
    const o = occ(f);
    for (const x of shipCells([t, r, c, v])) if (o[x] !== -1 && o[x] !== ignore) return 'overlap';
    return '';
  }
  const place = (f, t, r, c, v) => { f.ships.push([t, r, c, v ? 1 : 0]); };
  function addStack(f, kind, i, n) {
    f[kind][i] = (f[kind][i] || 0) + n;
    if (f[kind][i] <= 0) delete f[kind][i];
  }
  function eraseAt(f, i) {
    let did = false;
    const k = occ(f)[i];
    if (k !== -1) { f.ships.splice(k, 1); did = true; }
    if (f.sw[i]) { delete f.sw[i]; did = true; }
    if (f.tr[i]) { delete f.tr[i]; did = true; }
    return did;
  }
  // تدوير قطعة موضوعة، مع زحزحتها إذا لزم حتى تبقى داخل الخريطة
  function rotateAt(f, i) {
    const k = occ(f)[i];
    if (k === -1) return false;
    const [t, r, c, v] = f.ships[k];
    const nv = v ? 0 : 1, size = SHIPS[t].size;
    for (let sh = 0; sh < size; sh++) {
      const r2 = nv ? r - sh : r, c2 = nv ? c : c - sh;
      if (!fits(f, t, r2, c2, nv, k)) { f.ships[k] = [t, r2, c2, nv]; return true; }
    }
    return false;
  }

  // إكمال الناقص عشوائيًا (يحافظ على ما وُضع يدويًا). يرجّع false إذا ما فيه مكان كافٍ
  function fillRandom(f) {
    const rnd = (n) => Math.floor(Math.random() * n);
    let done = false;
    for (let attempt = 0; attempt < 40 && !done; attempt++) {
      const g = clone(f);
      let ok = true;
      for (const t of ORDER) {
        while (ok && left(g)[t] > 0) {
          let placed = false;
          for (let k = 0; k < 500; k++) {
            const v = rnd(2), r = rnd(10), c = rnd(10);
            if (!fits(g, t, r, c, v)) { place(g, t, r, c, v); placed = true; break; }
          }
          if (!placed) ok = false;
        }
      }
      if (ok) { f.ships = g.ships; done = true; }
    }
    if (!done) return false;
    // الأفخاخ (١ إلى ٣ في الخانة) ثم السبّاحين (١ إلى ١٢ في الخانة)، ويجوز تجميعهم فوق القطع
    let l = left(f).tr;
    while (l > 0) { const n = Math.min(l, 1 + rnd(3)); addStack(f, 'tr', rnd(100), n); l -= n; }
    l = left(f).sw;
    while (l > 0) { const n = Math.min(l, 1 + rnd(12)); addStack(f, 'sw', rnd(100), n); l -= n; }
    return true;
  }
  const random = () => { const f = empty(); fillRandom(f); return f; };

  // تحقق كامل من أسطول وصل من جوال (يرجّع '' إذا سليم)
  function validate(f) {
    if (!f || !Array.isArray(f.ships) || typeof f.sw !== 'object' || typeof f.tr !== 'object' || !f.sw || !f.tr) return 'صيغة غير صحيحة';
    const g = empty();
    for (const s of f.ships) {
      if (!Array.isArray(s) || !SHIPS[s[0]] || ![0, 1].includes(s[3])) return 'قطعة غير صحيحة';
      if (!Number.isInteger(s[1]) || !Number.isInteger(s[2])) return 'قطعة غير صحيحة';
      if (fits(g, s[0], s[1], s[2], s[3])) return 'قطع متداخلة أو خارج الخريطة';
      place(g, s[0], s[1], s[2], s[3]);
    }
    for (const kind of ['sw', 'tr']) {
      for (const [k, n] of Object.entries(f[kind])) {
        const i = +k;
        if (!Number.isInteger(i) || i < 0 || i > 99 || !Number.isInteger(n) || n <= 0) return 'تجميع غير صحيح';
        g[kind][i] = n;
      }
    }
    if (!isComplete(g)) return 'الأسطول ناقص أو زايد';
    return '';
  }

  // ترميز خفيف للأسطول بمفتاح الفريق قبل إرساله (حتى ما يُقرأ من الرسائل مباشرة)
  function encode(f, key) {
    const s = JSON.stringify({ s: f.ships, w: f.sw, t: f.tr });
    let o = '';
    for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ (key.charCodeAt(i % key.length) & 31));
    return btoa(o);
  }
  function decode(str, key) {
    try {
      const s = atob(str);
      let o = '';
      for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ (key.charCodeAt(i % key.length) & 31));
      const j = JSON.parse(o);
      return { ships: j.s, sw: j.w, tr: j.t };
    } catch { return null; }
  }

  // =========================================================
  // القصف
  // =========================================================
  function resolve(f, i) {
    const k = occ(f)[i];
    const t = k >= 0 ? f.ships[k][0] : '';
    const sw = f.sw[i] || 0, tr = f.tr[i] || 0;
    const pts = (t ? SHIPS[t].pts : 0) + sw * SWIM.pts + tr * TRAP.pts;
    const kind = tr ? 'trap' : (t || sw) ? 'hit' : 'miss';
    return { t, k, sw, tr, pts, kind };
  }
  const isSunk = (f, hits, k) => k >= 0 && shipCells(f.ships[k]).every((x) => hits[x]);

  // اللوح العلني لفريق: ما انكشف فقط (ينشر للجوالات ويُرسم منه عند المقدّم)
  // b: ١٠٠ حرف ( . مجهول، ~ ماء، s/w/b إصابة قطعة، o سبّاحين أو فخ بلا قطعة )
  // x: {خانة:[سبّاحين، أفخاخ]} للخانات المكشوفة فقط، k: القطع الغارقة كاملة
  function publicBoard(f, hits) {
    const o = occ(f);
    let b = '';
    const x = {}, k = [];
    for (let i = 0; i < 100; i++) {
      if (!hits[i]) { b += '.'; continue; }
      const sw = f.sw[i] || 0, tr = f.tr[i] || 0;
      if (sw || tr) x[i] = [sw, tr];
      b += o[i] >= 0 ? f.ships[o[i]][0].toLowerCase() : (sw || tr) ? 'o' : '~';
    }
    f.ships.forEach((s, idx) => { if (isSunk(f, hits, idx)) k.push(s); });
    return { b, x, k };
  }
  const explored = (pb) => (pb && pb.b ? pb.b.replace(/\./g, '').length : 0);
  // ضغط اللوح العلني قبل النشر (حتى تبقى رسالة الوضع صغيرة مع ٦ فرق)
  function packPB(pb) {
    if (!pb) return null;
    const x = Object.entries(pb.x).map(([i, [sw, tr]]) => `${i}.${sw}.${tr}`).join(',');
    const k = pb.k.map((s) => `${s[0]}${s[1]}${s[2]}${s[3]}`).join('');
    return { b: pb.b, x, k };
  }
  function unpackPB(p) {
    if (!p || typeof p.b !== 'string' || p.b.length !== 100) return null;
    const x = {};
    String(p.x || '').split(',').filter(Boolean).forEach((e) => { const [i, sw, tr] = e.split('.').map(Number); x[i] = [sw || 0, tr || 0]; });
    const k = [];
    const ks = String(p.k || '');
    for (let j = 0; j + 3 < ks.length; j += 4) if (SHIPS[ks[j]]) k.push([ks[j], +ks[j + 1], +ks[j + 2], +ks[j + 3]]);
    return { b: p.b, x, k };
  }

  // =========================================================
  // الأيقونات (تُحقن مرة في الصفحة)
  // =========================================================
  const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
    <symbol id="i-sub" viewBox="0 0 24 24"><path d="M2.5 14.5c0-2.2 1.8-4 4-4h10c2.8 0 5 1.8 5 4s-2.2 4-5 4h-10c-2.2 0-4-1.8-4-4z"/><path d="M9.5 10.6V7.4h4.2l1.3 3.2z"/><rect x="11.4" y="3.6" width="1.5" height="4"/><rect x="11.4" y="3.6" width="3" height="1.4"/><circle cx="8" cy="14.5" r="1" fill-opacity=".35"/><circle cx="11.5" cy="14.5" r="1" fill-opacity=".35"/><circle cx="15" cy="14.5" r="1" fill-opacity=".35"/></symbol>
    <symbol id="i-ship" viewBox="0 0 24 24"><path d="M1.5 13.5h21l-3.2 5.6H4.6z"/><path d="M6.5 13.5V10.6h4V7.8h3.4v2.8h3.4v2.9z"/><rect x="12" y="3.5" width="1.6" height="4.4"/><path d="M13.6 4.2l3.4 1-3.4 1z"/></symbol>
    <symbol id="i-boat" viewBox="0 0 24 24"><path d="M2.5 15.5h19l-3.3 4.3H5.8z"/><path d="M11.4 2.8v11.2H4.6z"/><path d="M13 5.6l6 8.4h-6z"/></symbol>
    <symbol id="i-swim" viewBox="0 0 24 24"><circle cx="16" cy="6.4" r="2.5"/><path d="M3.6 12.6l5.3-4.2 3.2 2.1 3-1.1 3.4 2.3-1.3 1.7-2.4-1.5-3.1 1.1-2.2-1.5-4 3z"/><path d="M1.5 17.2c2.1 0 2.1-1.5 4.2-1.5s2.1 1.5 4.2 1.5 2.1-1.5 4.2-1.5 2.1 1.5 4.2 1.5 2.1-1.5 4.2-1.5v2.2c-2.1 0-2.1 1.5-4.2 1.5s-2.1-1.5-4.2-1.5-2.1 1.5-4.2 1.5-2.1-1.5-4.2-1.5-2.1 1.5-4.2 1.5z"/></symbol>
    <symbol id="i-mine" viewBox="0 0 24 24"><circle cx="12" cy="13" r="6.2"/><path d="M11 2.6h2v4h-2zM11 19h2v3h-2zM1.8 12h4v2h-4zM18.2 12h4v2h-4zM4.6 5.3L6 3.9l2.9 2.9-1.4 1.4zM16.6 17.3L18 15.9l2.1 2.1-1.4 1.4zM15.1 6.8L18 3.9l1.4 1.4-2.9 2.9zM3.9 18.4L6 16.3l1.4 1.4-2.1 2.1z"/><circle cx="9.8" cy="11" r="1.5" fill-opacity=".4"/></symbol>
    <symbol id="i-splash" viewBox="0 0 24 24"><path d="M12 3.5c2.6 3.6 4.1 6.2 4.1 8.3a4.1 4.1 0 0 1-8.2 0c0-2.1 1.5-4.7 4.1-8.3z"/><path d="M5 13.4c1 1.4 1.7 2.5 1.7 3.3a1.7 1.7 0 0 1-3.4 0c0-.8.7-1.9 1.7-3.3zM19 13.4c1 1.4 1.7 2.5 1.7 3.3a1.7 1.7 0 0 1-3.4 0c0-.8.7-1.9 1.7-3.3z"/></symbol>
    <symbol id="i-fire" viewBox="0 0 24 24"><path d="M12 1.5l2.2 5.3 5.1-2.4-2.2 5.3 5.4 2.3-5.4 2.3 2.2 5.3-5.1-2.4L12 22.5l-2.2-5.3-5.1 2.4 2.2-5.3L1.5 12l5.4-2.3-2.2-5.3 5.1 2.4z"/></symbol>
    <symbol id="i-aim" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2.3a5.7 5.7 0 1 0 0 11.4 5.7 5.7 0 0 0 0-11.4z"/><path d="M11 .8h2v6h-2zM11 17.2h2v6h-2zM.8 11h6v2h-6zM17.2 11h6v2h-6z"/><circle cx="12" cy="12" r="1.6"/></symbol>
    <symbol id="i-rotate" viewBox="0 0 24 24"><path d="M12 4a8 8 0 1 1-7.4 5h2.3A6 6 0 1 0 12 6v3L7.5 5 12 1z"/></symbol>
    <symbol id="i-eraser" viewBox="0 0 24 24"><path d="M14.6 3.4l6 6a2 2 0 0 1 0 2.8L13 19.8h7v2H8.4l-5-5a2 2 0 0 1 0-2.8L11.8 3.4a2 2 0 0 1 2.8 0zM6.2 13.2l-1.4 1.4 4.6 4.6.6.6h.2l2-2z"/></symbol>
    <symbol id="i-dice" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm2 3.6a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm8 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm-4 3.8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm-4 3.8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm8 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24"><path d="M9 2h6l1 2h4v2H4V4h4zM5.5 7.5h13l-1 12.6a2 2 0 0 1-2 1.9h-7a2 2 0 0 1-2-1.9z"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M9.5 15.2l-4-4L4 12.6l5.5 5.5L20.2 7.4 18.8 6z"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M6.4 5L12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z"/></symbol>
    <symbol id="i-eye" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 5c5 0 9 4.3 10 7-1 2.7-5 7-10 7S3 14.7 2 12c1-2.7 5-7 10-7zm0 3.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"/></symbol>
    <symbol id="i-trophy" viewBox="0 0 24 24"><path d="M7 3h10v2h3.5v2.5A4.5 4.5 0 0 1 16.6 12 5 5 0 0 1 13 14.8V18h3.5v3h-9v-3H11v-3.2A5 5 0 0 1 7.4 12 4.5 4.5 0 0 1 3.5 7.5V5H7zm10 4v3.6a2.5 2.5 0 0 0 1.5-2.3V7zM5.5 7v1.3A2.5 2.5 0 0 0 7 10.6V7z"/></symbol>
    <symbol id="i-anchor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M12 1.5a3 3 0 0 1 1 5.8V9h4v2h-4v8.8a7 7 0 0 0 5.9-5.8H16.5l3-3.5 3 3.5h-1.6A9 9 0 0 1 3.1 14H1.5l3-3.5 3 3.5H5.1A7 7 0 0 0 11 19.8V11H7V9h4V7.3a3 3 0 0 1 1-5.8zm0 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></symbol>
    <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13.5 2L4 14h6.5l-1.5 8L19 9.5h-6.5L13.5 2z"/></symbol>
  </svg>`;
  function sprite() {
    if (document.getElementById('i-sub')) return;
    document.body.insertAdjacentHTML('afterbegin', SPRITE);
  }
  const ico = (id, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

  // =========================================================
  // رسم اللوح ١٠×١٠
  // =========================================================
  function makeBoard(el, { onCell, onHover } = {}) {
    el.classList.add('board');
    let h = '<span class="corner" aria-hidden="true"></span>';
    for (let c = 0; c < 10; c++) h += `<span class="lbl col" aria-hidden="true">${ar(c + 1)}</span>`;
    for (let r = 0; r < 10; r++) {
      h += `<span class="lbl row" aria-hidden="true">${ROWS[r]}</span>`;
      for (let c = 0; c < 10; c++) h += `<button type="button" class="cell" data-i="${r * 10 + c}" aria-label="${ROWS[r]}${ar(c + 1)}"></button>`;
    }
    el.innerHTML = h;
    const cells = $$('.cell', el);
    el.onclick = (e) => { const b = e.target.closest('.cell'); if (b && onCell) onCell(+b.dataset.i); };
    if (onHover) {
      el.onpointerover = (e) => { if (e.pointerType !== 'mouse') return; const b = e.target.closest('.cell'); onHover(b ? +b.dataset.i : -1); };
      el.onpointerleave = () => onHover(-1);
    }

    // شكل جزء القطعة: بداية/وسط/نهاية وأفقي/رأسي
    const segClass = (s, x) => {
      const cs = shipCells(s), k = cs.indexOf(x);
      return `hull hull-${s[0]} ${s[3] ? 'v' : 'h'} ${k === 0 ? 'p0' : k === cs.length - 1 ? 'p9' : 'pm'}`;
    };

    // view: { pb:لوح علني, own:أسطول ظاهر, ghost:{cells,bad}, aim, pending, flash:{i,kind}, dim }
    function paint(view = {}) {
      const pb = view.pb || null;
      const own = view.own || null;
      const oo = own ? occ(own) : null;
      const sunkMap = {};
      if (pb && pb.k) pb.k.forEach((s) => shipCells(s).forEach((x) => { sunkMap[x] = s; }));
      const ghost = view.ghost && view.ghost.cells ? new Set(view.ghost.cells) : null;
      for (let i = 0; i < 100; i++) {
        const cell = cells[i];
        const code = pb ? pb.b[i] : '.';
        let cls = 'cell', inner = '';
        if (own && oo[i] >= 0) {
          const s = own.ships[oo[i]];
          cls += ' ' + segClass(s, i);
          if (shipCells(s)[0] === i) inner += ico(SHIPS[s[0]].ico, 'ship-ico');
        }
        if (sunkMap[i]) {
          const s = sunkMap[i];
          cls += ' sunk ' + segClass(s, i);
          if (shipCells(s)[0] === i) inner += ico(SHIPS[s[0]].ico, 'ship-ico');
        }
        if (code === '.') {
          if (!own) cls += ' fog';
        } else if (code === '~') {
          cls += ' miss'; inner += ico('i-splash', 'mark');
        } else {
          const x = pb.x && pb.x[i];
          cls += x && x[1] ? ' trap' : ' hit';
          if (code !== 'o') cls += ' hit-' + code.toUpperCase();
          if (!sunkMap[i] && !(own && oo[i] >= 0)) {
            inner += code !== 'o' ? ico(SHIPS[code.toUpperCase()].ico, 'mark') : '';
          }
          inner += ico(x && x[1] ? 'i-mine' : 'i-fire', 'burst');
        }
        // التجميع: من اللوح العلني إن انكشف، ومن الأسطول الظاهر
        const sw = (own && own.sw[i]) || (pb && pb.x && pb.x[i] && pb.x[i][0]) || 0;
        const tr = (own && own.tr[i]) || (pb && pb.x && pb.x[i] && pb.x[i][1]) || 0;
        if (sw) inner += `<b class="badge b-sw">${ico('i-swim')}${ar(sw)}</b>`;
        if (tr) inner += `<b class="badge b-tr">${ico('i-mine')}${ar(tr)}</b>`;
        if (own && code !== '.') cls += ' shot';
        if (ghost && ghost.has(i)) cls += view.ghost.bad ? ' ghost bad' : ' ghost';
        if (view.aim === i) { cls += ' aim'; inner += ico('i-aim', 'reticle'); }
        if (view.pending === i) cls += ' pending';
        if (view.flash && view.flash.i === i) cls += ' flash-' + view.flash.kind;
        if (cell.className !== cls) cell.className = cls;
        if (cell._h !== inner) { cell.innerHTML = inner; cell._h = inner; }
        cell.disabled = !!view.lock || (!!view.onlyFog && code !== '.');
      }
      el.classList.toggle('dim', !!view.dim);
    }
    return { el, cells, paint };
  }

  // اهتزاز اللوح (للفخ)
  function shake(el) {
    if (!el || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  // =========================================================
  // محرر التقسيم اليدوي (مشترك بين المقدّم والجوال)
  // =========================================================
  const TOOLS = [
    { id: 'S', label: `غواصة` },
    { id: 'W', label: `سفينة` },
    { id: 'B', label: `قارب` },
    { id: 'sw', label: 'سبّاحين', sub: 'تجميع' },
    { id: 'tr', label: 'أفخاخ', sub: 'تجميع' },
    { id: 'er', label: 'ممحاة', sub: 'تفريغ خانة' }
  ];
  const toolIco = { S: 'i-sub', W: 'i-ship', B: 'i-boat', sw: 'i-swim', tr: 'i-mine', er: 'i-eraser' };

  function editor(root, { fleet, onChange, toast: say = () => {} }) {
    let f = fleet || empty();
    const st = { tool: 'S', v: 0, batch: 5, hover: -1 };
    root.classList.add('editor');
    root.innerHTML = `
      <div class="ed-tools" role="group" aria-label="القطع">
        ${TOOLS.map((t) => `<button type="button" class="tool t-${t.id}" data-tool="${t.id}" aria-pressed="false">
          ${ico(toolIco[t.id])}<span class="tl">${t.label}</span><span class="tn"></span></button>`).join('')}
      </div>
      <div class="ed-opts">
        <button type="button" class="chip-btn" data-act="rot">${ico('i-rotate')}<span class="rot-l"></span></button>
        <div class="batch" role="group" aria-label="كم تضيف كل ضغطة">
          <span class="muted">كل ضغطة:</span>
          ${[1, 5, 10, 0].map((n) => `<button type="button" data-batch="${n}" aria-pressed="false">${n ? ar(n) : 'الباقي'}</button>`).join('')}
        </div>
        <p class="ed-hint muted"></p>
      </div>
      <div class="board-wrap"><div class="ed-board"></div></div>
      <div class="ed-foot">
        <div class="prog"><i></i></div>
        <span class="prog-t"></span>
        <div class="ed-acts">
          <button type="button" class="btn btn-small" data-act="fill">${ico('i-dice')}كمّل الناقص عشوائيًا</button>
          <button type="button" class="btn btn-small" data-act="rand">${ico('i-dice')}عشوائي بالكامل</button>
          <button type="button" class="btn btn-small btn-ghost" data-act="clear">${ico('i-trash')}مسح الكل</button>
        </div>
      </div>`;

    const board = makeBoard($('.ed-board', root), {
      onCell: (i) => tap(i),
      onHover: (i) => { st.hover = i; draw(); }
    });

    const changed = () => { draw(); if (onChange) onChange(f); };

    function nextTool() {
      const l = left(f);
      const order = ['S', 'W', 'B', 'tr', 'sw'];
      const nx = order.find((t) => l[t] > 0);
      if (nx) st.tool = nx;
    }

    function tap(i) {
      const r = Math.floor(i / 10), c = i % 10;
      const l = left(f);
      if (st.tool === 'er') {
        if (eraseAt(f, i)) { S.whoosh(false); changed(); }
        return;
      }
      if (SHIPS[st.tool]) {
        // الضغط على قطعة موضوعة يدوّرها
        if (occ(f)[i] >= 0) {
          if (rotateAt(f, i)) { S.tongue(0, 0.25); changed(); } else { sfx.deny(); say('ما فيه مكان لتدويرها هنا'); }
          return;
        }
        if (l[st.tool] <= 0) { sfx.deny(); say(`خلصت ال${SHIPS[st.tool].plural}`); return; }
        const why = fits(f, st.tool, r, c, st.v);
        if (why) { sfx.deny(); say(why === 'edge' ? 'القطعة تطلع برا الخريطة، غيّر الاتجاه أو المكان' : 'تتداخل مع قطعة ثانية'); return; }
        place(f, st.tool, r, c, st.v);
        sfx.place();
        if (left(f)[st.tool] <= 0) nextTool();
        changed();
        return;
      }
      // التجميع: سبّاحين أو أفخاخ
      const rem = l[st.tool];
      if (rem <= 0) { sfx.deny(); say(st.tool === 'sw' ? 'وزّعت كل السبّاحين' : 'وزّعت كل الأفخاخ'); return; }
      const n = st.batch ? Math.min(st.batch, rem) : rem;
      addStack(f, st.tool, i, n);
      S.drop(st.tool === 'sw' ? 520 : 300, 0, 0.2);
      if (left(f)[st.tool] <= 0) nextTool();
      changed();
    }

    function draw() {
      const l = left(f);
      $$('.tool', root).forEach((b) => {
        const t = b.dataset.tool;
        b.setAttribute('aria-pressed', String(t === st.tool));
        const n = $('.tn', b);
        if (t === 'er') { n.textContent = TOOLS[5].sub; b.classList.remove('done'); return; }
        const total = SHIPS[t] ? SHIPS[t].count : t === 'sw' ? SWIM.count : TRAP.count;
        b.hidden = total === 0; // وحدة ألغاها المقدّم
        if (SHIPS[t]) $('.tl', b).textContent = `${SHIPS[t].name} (${ar(SHIPS[t].size)})`;
        n.textContent = l[t] > 0 ? `باقي ${ar(l[t])}` : l[t] < 0 ? `زايد ${ar(-l[t])}` : 'اكتمل';
        b.classList.toggle('done', l[t] === 0);
        b.classList.toggle('over', l[t] < 0);
      });
      const isShip = !!SHIPS[st.tool], isStack = st.tool === 'sw' || st.tool === 'tr';
      const rot = $('[data-act="rot"]', root);
      rot.hidden = !isShip;
      $('.rot-l', root).textContent = st.v ? 'رأسي' : 'أفقي';
      rot.classList.toggle('v', !!st.v);
      $('.batch', root).hidden = !isStack;
      $$('[data-batch]', root).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.batch === st.batch)));
      $('.ed-hint', root).textContent = isShip ? 'اضغط المربع الأول للقطعة، واضغط قطعة موضوعة لتدويرها'
        : isStack ? 'اضغط أي خانة للإضافة، ويجوز التجميع فوق القطع' : 'اضغط خانة لتفريغها (القطعة كاملة مع ما فوقها)';
      const done = placedItems(f);
      $('.prog i', root).style.width = `${(done / totalItems()) * 100}%`;
      $('.prog-t', root).textContent = isComplete(f) ? 'الأسطول مكتمل ✓' : `وضعت ${ar(done)} من ${ar(totalItems())}`;
      root.classList.toggle('complete', isComplete(f));
      // معاينة مكان القطعة بالماوس
      let ghost = null;
      if (isShip && st.hover >= 0 && occ(f)[st.hover] < 0 && l[st.tool] > 0) {
        const r = Math.floor(st.hover / 10), c = st.hover % 10, size = SHIPS[st.tool].size;
        const cs = [];
        for (let k = 0; k < size; k++) { const rr = st.v ? r + k : r, cc = st.v ? c : c + k; if (rr < 10 && cc < 10) cs.push(rr * 10 + cc); }
        ghost = { cells: cs, bad: !!fits(f, st.tool, r, c, st.v) };
      }
      board.paint({ own: f, ghost });
    }

    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tool]');
      if (t) { st.tool = t.dataset.tool; S.tongue(0, 0.2); draw(); return; }
      const bt = e.target.closest('[data-batch]');
      if (bt) { st.batch = +bt.dataset.batch; S.tongue(0, 0.2); draw(); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'rot') { st.v = st.v ? 0 : 1; S.tongue(0, 0.22); draw(); }
      if (act === 'fill') {
        if (isComplete(f)) { say('الأسطول مكتمل أصلًا'); return; }
        const g = clone(f);
        if (fillRandom(g)) { f = g; sfx.place(); nextTool(); changed(); } else { sfx.deny(); say('ما فيه مكان كافٍ للباقي، حرّك بعض القطع'); }
      }
      if (act === 'rand') { f = random(); S.whoosh(true); changed(); }
      if (act === 'clear') { f = empty(); st.tool = 'S'; S.whoosh(false); changed(); }
    });

    draw();
    return {
      get fleet() { return f; },
      set(nf) { f = nf || empty(); draw(); },
      draw
    };
  }

  // =========================================================
  // المؤثرات الصوتية (بلا موسيقى ولا آلات)
  // =========================================================
  const sfx = (() => {
    let ctx = null, out = null, nb = null;
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
    // فك الصوت مع أول لمسة (متطلب الجوال)
    ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { if (S && S.on) ac(); }, { capture: true, passive: true }));
    function noise(c) {
      if (!nb) {
        nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource(); s.buffer = nb; s.loop = true; return s;
    }
    function env(g, t, a, peak, dur) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }
    // انفجار مكتوم: ضجيج منخفض + ارتطام
    function boom(size = 1, delay = 0) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay, dur = 0.9 + size * 0.5;
      const n = noise(c), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.frequency.setValueAtTime(1300 * size, t); f.frequency.exponentialRampToValueAtTime(40, t + dur);
      env(g, t, 0.006, 0.9, dur);
      n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + dur + 0.05);
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.7);
      env(og, t, 0.004, 0.8, 0.75);
      o.connect(og).connect(out); o.start(t); o.stop(t + 0.8);
    }
    // رذاذ ماء
    function splash(delay = 0) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      const n = noise(c), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.6);
      env(g, t, 0.02, 0.5, 0.7);
      n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 0.75);
      S.drop(620, delay + 0.18, 0.18); S.drop(820, delay + 0.32, 0.12); S.drop(540, delay + 0.45, 0.1);
    }
    // صفّارة بحّار بالفم: نفَس + تصفير صاعد مع اهتزاز خفيف
    function whistle(delay = 0) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(2500, t + 0.32);
      o.frequency.setValueAtTime(2500, t + 0.5);
      o.frequency.exponentialRampToValueAtTime(2150, t + 0.75);
      lfo.frequency.value = 7; lg.gain.value = 28; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
      g.gain.setValueAtTime(0.16, t + 0.62); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.82);
      o.connect(g).connect(out); o.start(t); lfo.start(t); o.stop(t + 0.85); lfo.stop(t + 0.85);
      const n = noise(c), f = c.createBiquadFilter(), ng = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 2;
      env(ng, t, 0.05, 0.05, 0.8);
      n.connect(f).connect(ng).connect(out); n.start(t, Math.random()); n.stop(t + 0.85);
    }
    // فقاعات الغرق
    function bubbles(delay = 0) {
      [0, 0.12, 0.2, 0.34, 0.45, 0.6].forEach((d, k) => S.drop(260 + k * 40 + Math.random() * 60, delay + d, 0.16));
    }
    function deny() {
      const c = ac(); if (!c) return;
      const t = c.currentTime;
      const n = noise(c), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 3;
      env(g, t, 0.01, 0.3, 0.16);
      n.connect(f).connect(g).connect(out); n.start(t, Math.random()); n.stop(t + 0.2);
    }
    return {
      boom, splash, whistle, bubbles, deny,
      place: () => S.tongue(0, 0.28),
      aim: () => S.tongue(0, 0.22),
      hit: () => boom(1),
      trap: () => { boom(1.5); S.gust(0.15); },
      sink: () => { boom(1.2); bubbles(0.5); },
      wrong: () => S.sigh(),
      win: () => S.winner()
    };
  })();

  // =========================================================
  // الثيمات، الصوت، الشاشات، التنبيه، التأكيد، القصاصات
  // =========================================================
  const THEMES = ['light', 'navy', 'blue', 'ops'];
  function setTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('athar-theme', t); } catch { /* تجاهل */ }
    $$('.theme-dot').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  }
  function initChrome() {
    sprite();
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

  let toastTimer = 0;
  function toast(msg, kind = '') {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false; t.dataset.kind = kind;
    t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }

  function confirmBox({ title, text, yes, no = 'إلغاء', danger = false }) {
    return new Promise((res) => {
      const m = $('#confirm');
      $('#confirmTitle').textContent = title;
      $('#confirmText').textContent = text || '';
      const y = $('#confirmYes'), n = $('#confirmNo');
      y.textContent = yes; n.textContent = no;
      y.classList.toggle('btn-danger', danger);
      m.hidden = false;
      const done = (v) => { m.hidden = true; y.onclick = n.onclick = m.onclick = null; document.removeEventListener('keydown', onKey); res(v); };
      const onKey = (e) => { if (e.key === 'Escape') done(false); };
      document.addEventListener('keydown', onKey);
      y.onclick = () => done(true);
      n.onclick = () => done(false);
      m.onclick = (e) => { if (e.target === m) done(false); };
      y.focus();
    });
  }

  function confetti(canvas, { x = 0.5, y = 0.4, count = 140 } = {}) {
    if (!canvas || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cols = ['#F97316', '#FACC15', '#22B8CF', '#1E6FE0', '#FFFFFF', '#5CC2F5', '#EF4444'];
    const ps = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 10;
      return { x: W * x, y: H * y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 7, w: 6 + Math.random() * 7, h: 4 + Math.random() * 5,
        r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: cols[(Math.random() * cols.length) | 0] };
    });
    const t0 = performance.now(), DUR = 2400;
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

  function qrSVG(text) {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(text); q.make();
      return q.createSvgTag({ cellSize: 4, margin: 1, scalable: true, alt: 'رمز QR' });
    } catch { return ''; }
  }

  // وصف نتيجة القصف بجملة
  function shotText(res, att, tgt) {
    if (res.kind === 'miss') return `${att} قصف ${tgt}… ماء! 💦`;
    const parts = [];
    if (res.t) parts.push(`جزء من ${SHIPS[res.t].name}`);
    if (res.sw) parts.push(`${ar(res.sw)} ${res.sw === 1 ? 'سبّاح' : 'سبّاحين'}`);
    if (res.tr) parts.push(`${ar(res.tr)} ${res.tr === 1 ? 'فخ' : 'أفخاخ'}`);
    return parts.join(' و ');
  }

  return {
    $, $$, S, ROWS, SHIPS, ORDER, SWIM, TRAP, START_STRIKES, TEAM_COLORS, TEAM_NAMES, totalItems, setRules, DEFAULTS, FIELDS, MAX_CELLS, normCfg, cfgCells, isDefaultCfg, cfgSummary,
    ar, esc, sgn, num, cellName, uid, toLatin, hash, store,
    empty, clone, shipCells, occ, counts, left, isComplete, placedItems, fits, place, addStack, eraseAt, rotateAt,
    fillRandom, random, validate, encode, decode, resolve, isSunk, publicBoard, explored, packPB, unpackPB,
    sprite, ico, makeBoard, shake, editor, sfx, setTheme, initChrome, show, toast, confirmBox, confetti, qrSVG, shotText
  };
})();
