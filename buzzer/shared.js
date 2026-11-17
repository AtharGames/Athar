/* =========================================================
   جرس أثَر | أدوات مشتركة بين شاشة المقدّم وصفحة المشارك
   (الثيمات، الصوت، الأرقام، ترتيب الضغطات، نافذة التأكيد، التنبيه العائم)
   ========================================================= */
window.BuzzUI = (() => {
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
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // أجزاء من الثانية: ١٫٢٣٤
  const secs = (ms) => ar((Math.max(0, ms) / 1000).toFixed(3)).replace('.', '٫');
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

  return { $, $$, S, store, ar, toLatin, esc, secs, ordinal, colorOf, queueOf, initChrome, show, toast, confirmBox };
})();
