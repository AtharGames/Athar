/* =========================================================
   مسرح جريمة | إعدادات Firebase
   الصق هنا إعدادات مشروعك من:
   Firebase Console ← إعدادات المشروع ← تطبيقاتك ← تطبيق ويب ← SDK setup and configuration ← Config
   المهم يكون فيها databaseURL (يظهر بعد إنشاء Realtime Database).
   هذه الإعدادات ليست سرية؛ الحماية تكون بقواعد قاعدة البيانات (database.rules.json).
   إذا تركتها null تشتغل اللعبة على ntfy.sh كاحتياطي.
   ========================================================= */
window.CRIME_FIREBASE = window.CRIME_FIREBASE || null;

/* مثال:
window.CRIME_FIREBASE = {
  apiKey: "AIza....",
  authDomain: "athar-games.firebaseapp.com",
  databaseURL: "https://athar-games-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "athar-games",
  appId: "1:1234567890:web:abcdef"
};
*/
