/* =========================================================
   الصفحة الرئيسية: مبدّل الثيمات فقط
   ========================================================= */
(() => {
  'use strict';
  const THEMES = ['light', 'navy', 'blue'];
  const dots = [...document.querySelectorAll('.theme-dot')];

  function setTheme(t) {
    if (!THEMES.includes(t)) t = 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('athar-theme', t); } catch { /* تجاهل */ }
    dots.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
  }

  dots.forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.setTheme)));
  setTheme(document.documentElement.dataset.theme);
})();
