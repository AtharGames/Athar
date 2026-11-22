/* =========================================================
   إنسان حيوان جماد | إعدادات Firebase الخاصة باللعبة
   مشروع مستقل (athar-huroof) عن باقي الألعاب، فلكل لعبة حدّ اتصالاتها الخاص.
   هذه الإعدادات ليست سرية؛ الحماية بقواعد قاعدة البيانات (huroof/database.rules.json).
   (Analytics غير مستخدم، فما أضفنا measurementId)
   التصحيح بالذكاء من نفس المشروع: Firebase Console ← AI Logic ← Gemini Developer API (مجاني).
   ========================================================= */
window.HUROOF_FIREBASE = window.HUROOF_FIREBASE || {
  apiKey: "AIzaSyDX32wntGQcI-oXN594jLVbOGbVu3df4lo",
  authDomain: "athar-huroof.firebaseapp.com",
  databaseURL: "https://athar-huroof-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "athar-huroof",
  storageBucket: "athar-huroof.firebasestorage.app",
  messagingSenderId: "686127627460",
  appId: "1:686127627460:web:ebd80d61bc42c29dd71d91",
  // التصحيح بالذكاء الاصطناعي (Firebase AI Logic): مفتاح موقع reCAPTCHA v3 المسجّل في App Check
  // (فارغ = الطلب يمشي بدون App Check، ويفشل إذا كان App Check مفروضًا على AI Logic)
  appCheckSiteKey: "",
  aiModel: "gemini-3.5-flash-lite"
};
