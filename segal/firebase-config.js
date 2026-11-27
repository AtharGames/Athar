/* =========================================================
   سِجَال | إعدادات Firebase الخاصة باللعبة
   مشروع مستقل (athar-segal) عن باقي الألعاب (لكل لعبة حدّ اتصالاتها الخاص).
   البيانات تحت العقدة fazaa/ (الاسم الأول للعبة) فالقواعد تبقى كما هي.
   (Analytics غير مستخدم، فما أضفنا measurementId)
   الإعدادات ليست سرية؛ الحماية بقواعد قاعدة البيانات (segal/database.rules.json).
   ما دام databaseURL فارغًا تعمل اللعبة بوضع التجربة المحلي (تبويبات على نفس الجهاز).
   التحكيم بالذكاء (اختياري): Firebase Console ← AI Logic ← Gemini Developer API، ثم ai: true
   ========================================================= */
window.FAZAA_FIREBASE = window.FAZAA_FIREBASE || {
  apiKey: "AIzaSyA-ECnk5X3gp__kdwlO9m0KnrBBVZ-Gkto",
  authDomain: "athar-segal.firebaseapp.com",
  databaseURL: "https://athar-segal-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "athar-segal",
  storageBucket: "athar-segal.firebasestorage.app",
  messagingSenderId: "75582217857",
  appId: "1:75582217857:web:f00fbfa3ee2a6a7347b780",
  // تحكيم الرسم والوصف بالذكاء الاصطناعي (Firebase AI Logic)
  ai: true,
  // مفتاح reCAPTCHA v3 نفسه المستخدم في إنسان حيوان جماد (نفس النطاق athargames.github.io)
  appCheckSiteKey: "6Ley5jEuAAAAAGDue8EQ85RvusAooRRB07Z7Rvz4",
  appCheckProvider: "v3",
  aiModel: "gemini-3.5-flash-lite"
};
