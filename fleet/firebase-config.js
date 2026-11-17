/* =========================================================
   الأسطول البحري | إعدادات Firebase الخاصة باللعبة
   مشروع مستقل (athar-ship) عن «مسرح جريمة» و«جرس أثَر»، فلكل لعبة حدّ اتصالاتها الخاص.
   هذه الإعدادات ليست سرية؛ الحماية بقواعد قاعدة البيانات (fleet/database.rules.json).
   لو صارت null تشتغل أوضاع الجوال على ntfy.sh كاحتياطي.
   (Analytics غير مستخدم، فما أضفنا measurementId)
   ========================================================= */
window.FLEET_FIREBASE = window.FLEET_FIREBASE || {
  apiKey: "AIzaSyDUvuVE40h0YPZ6LzDDN46l_S0h62bUHW8",
  authDomain: "athar-ship.firebaseapp.com",
  databaseURL: "https://athar-ship-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "athar-ship",
  storageBucket: "athar-ship.firebasestorage.app",
  messagingSenderId: "357930785311",
  appId: "1:357930785311:web:cc9a2437e652e893ad132a"
};
