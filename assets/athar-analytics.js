/* =========================================================
   إحصائيات أثَر للألعاب — Google Analytics 4
   ملف واحد مشترك تستدعيه كل الصفحات:
   - يحسب زيارات الصفحة الرئيسية وكل لعبة (شاشة المقدّم وجوال المشارك)
   - يرسل اسم اللعبة ونوع الشاشة مع كل زيارة لتسهيل الفرز في التقارير
   - يوفّر الدالة atharTrack() لتسجيل أحداث داخل الألعاب لاحقاً
   لتفعيله: ضع معرّف القياس (Measurement ID) مكان GA_ID بالأسفل
   ========================================================= */
(function () {
  'use strict';

  // معرّف القياس من Google Analytics (يبدأ بـ G-)
  var GA_ID = 'G-XXXXXXXXXX';

  // دالة فارغة آمنة حتى لا تتعطل الألعاب إذا لم تُفعَّل الإحصائيات
  window.atharTrack = function () {};

  // لا تعمل قبل وضع المعرّف الحقيقي، ولا أثناء التجربة المحلية
  var host = location.hostname;
  if (!/^G-[A-Z0-9]{6,}$/.test(GA_ID) || GA_ID === 'G-XXXXXXXXXX') return;
  if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1') return;

  // أسماء الألعاب حسب مجلداتها في المستودع
  var GAMES = {
    tarabee: 'ترابيع',
    telephone: 'من سيربح التيلفون',
    snakes: 'السلم والثعبان',
    sahm: 'سهمك الصاعد',
    crime: 'مسرح جريمة',
    buzzer: 'جرس أثَر',
    fleet: 'الأسطول البحري',
    huroof: 'إنسان حيوان جماد',
    diwan: 'ديوان'
  };

  // استخراج اسم المجلد ونوع الشاشة من المسار: /Athar/<game>/<page>.html
  var parts = location.pathname.split('/').filter(Boolean);
  var folder = '';
  for (var i = 0; i < parts.length; i++) {
    if (GAMES[parts[i]]) { folder = parts[i]; break; }
  }
  var file = (parts[parts.length - 1] || '').toLowerCase();
  var screen = 'host';                                   // شاشة المقدّم أو الصفحة الرئيسية
  if (file === 'play.html' || file === 'team.html') screen = 'player'; // جوال المشارك أو الفريق
  var gameName = folder ? GAMES[folder] : 'الرئيسية';

  // تحميل مكتبة Google Analytics
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', GA_ID, {
    game_name: gameName,      // اسم اللعبة (بعد تسجيله كبُعد مخصص في GA)
    screen_type: screen       // host أو player
  });

  // تسجيل حدث من داخل أي لعبة، مثال: atharTrack('game_start', { teams: 4 })
  window.atharTrack = function (eventName, params) {
    try {
      var p = params || {};
      p.game_name = gameName;
      p.screen_type = screen;
      gtag('event', eventName, p);
    } catch (e) {}
  };
})();
