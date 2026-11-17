/* =========================================================
   الأسطول البحري | إعدادات Firebase الخاصة باللعبة
   مشروع مستقل عن «مسرح جريمة» و«جرس أثَر»، فلكل لعبة حدّ اتصالاتها الخاص.
   الصق هنا إعدادات مشروعك من:
   Firebase Console ← إعدادات المشروع ← تطبيقاتك ← تطبيق ويب ← Config
   المهم يكون فيها databaseURL (يظهر بعد إنشاء Realtime Database).
   هذه الإعدادات ليست سرية؛ الحماية بقواعد قاعدة البيانات (fleet/database.rules.json).
   ما دامت null تشتغل أوضاع الجوال على ntfy.sh كاحتياطي مجاني بلا إعداد.
   ========================================================= */
window.FLEET_FIREBASE = window.FLEET_FIREBASE || null;

/* مثال بعد إنشاء المشروع:
window.FLEET_FIREBASE = {
  apiKey: "AIza....",
  authDomain: "athar-fleet.firebaseapp.com",
  databaseURL: "https://athar-fleet-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "athar-fleet",
  storageBucket: "athar-fleet.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/
