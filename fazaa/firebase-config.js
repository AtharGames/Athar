/* =========================================================
   فزعة | إعدادات Firebase الخاصة باللعبة
   مشروع مستقل عن باقي الألعاب (لكل لعبة حدّ اتصالاتها الخاص).
   الإعدادات ليست سرية؛ الحماية بقواعد قاعدة البيانات (fazaa/database.rules.json).
   ما دام databaseURL فارغًا تعمل اللعبة بوضع التجربة المحلي (تبويبات على نفس الجهاز).
   التحكيم بالذكاء (اختياري): Firebase Console ← AI Logic ← Gemini Developer API، ثم ai: true
   ========================================================= */
window.FAZAA_FIREBASE = window.FAZAA_FIREBASE || {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  // تحكيم الرسم والوصف بالذكاء الاصطناعي (Firebase AI Logic)
  ai: false,
  appCheckSiteKey: "",
  aiModel: "gemini-3.5-flash-lite"
};
