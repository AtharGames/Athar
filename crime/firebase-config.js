/* =========================================================
   مسرح جريمة | إعدادات Firebase
   الصق هنا إعدادات مشروعك من:
   Firebase Console ← إعدادات المشروع ← تطبيقاتك ← تطبيق ويب ← SDK setup and configuration ← Config
   المهم يكون فيها databaseURL (يظهر بعد إنشاء Realtime Database).
   هذه الإعدادات ليست سرية؛ الحماية تكون بقواعد قاعدة البيانات (database.rules.json).
   إذا صارت null تشتغل اللعبة على ntfy.sh كاحتياطي.
   (Analytics غير مستخدم في اللعبة، فما أضفنا measurementId)
   ========================================================= */
window.CRIME_FIREBASE = window.CRIME_FIREBASE || {
  apiKey: "AIzaSyDFq6tWQHgG6QMVHcQL85wjfBcxOg4ofDs",
  authDomain: "athar-gamesmsr7.firebaseapp.com",
  databaseURL: "https://athar-gamesmsr7-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "athar-gamesmsr7",
  storageBucket: "athar-gamesmsr7.firebasestorage.app",
  messagingSenderId: "399568951161",
  appId: "1:399568951161:web:44845b0506e43264a681a8"
};

/* مثال:
window.CRIME_FIREBASE = {
  apiKey: "AIza....",
  authDomain: "athar-games.firebaseapp.com",
  databaseURL: "https://athar-games-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "athar-games",
  appId: "1:1234567890:web:abcdef"
};
*/
