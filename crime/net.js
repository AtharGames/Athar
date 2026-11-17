/* =========================================================
   مسرح جريمة | طبقة الاتصال بين شاشة المشرف وجوالات الفرق
   ثلاث طرق، تُختار تلقائيًا:
   ١) Firebase Realtime Database: إذا وُجدت الإعدادات في firebase-config.js (الأساسي)
   ٢) ntfy.sh: خدمة مجانية عامة بلا إعداد (احتياطي إذا ما فيه إعدادات)
   ٣) ?net=local : اختبار على نفس المتصفح عبر BroadcastChannel
   أنواع القنوات:
   - قناة «حالة» (تنتهي بـ -p أو مفتاح الفريق): يُحفظ فيها آخر وضع فقط
   - قناة «صندوق» (تنتهي بـ -u): رسائل الجوالات للمشرف بالترتيب
   الاستخدام:
     QadiyaNet.publish(name, obj)
     QadiyaNet.subscribe(name, onMsg, { since, onStatus, onId })
     QadiyaNet.drop([names])   // حذف قنوات لعبة منتهية (Firebase فقط)
   ========================================================= */
window.QadiyaNet = (() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const FB = window.CRIME_FIREBASE && window.CRIME_FIREBASE.databaseURL ? window.CRIME_FIREBASE : null;
  const MODE = params.get('net') === 'local' ? 'local'
    : params.get('net') === 'ntfy' ? 'ntfy'
    : FB ? 'firebase' : 'ntfy';

  const isQueue = (name) => /-u$/.test(name);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // =========================================================
  // ١) Firebase Realtime Database
  // =========================================================
  const SDK = 'https://www.gstatic.com/firebasejs/13.4.0/';
  const ROOT = 'crime/';
  let fbReady = null;

  // تحميل مكتبة Firebase مرة وحدة (Modular SDK)
  function fb() {
    if (!fbReady) {
      fbReady = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-database.js')])
        .then(([A, D]) => {
          const app = A.getApps().find((a) => a.name === 'athar-crime') || A.initializeApp(FB, 'athar-crime');
          const db = D.getDatabase(app);
          // محاكي Firebase للاختبار المحلي فقط
          const emu = params.get('fbemu');
          if (emu && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
            const [h, p] = emu.split(':');
            D.connectDatabaseEmulator(db, h, +p);
          }
          return { D, db };
        })
        .catch((e) => { fbReady = null; throw e; });
    }
    return fbReady;
  }

  async function fbPublish(name, obj) {
    try {
      const { D, db } = await fb();
      const val = { d: JSON.stringify(obj), t: D.serverTimestamp() };
      const r = D.ref(db, ROOT + name);
      if (isQueue(name)) await D.push(r, val);
      else await D.set(r, val);
      return true;
    } catch (e) {
      console.warn('[crime] Firebase publish', e && e.message);
      return false;
    }
  }

  function fbSubscribe(name, onMsg, opts, status) {
    let offs = [], closed = false, since = opts.since && opts.since !== 'all' ? opts.since : null;

    const handle = (snap) => {
      const v = snap.val();
      if (!v || typeof v.d !== 'string') return;
      let body;
      try { body = JSON.parse(v.d); } catch { return; }
      onMsg(body);
    };

    const start = () => {
      if (closed) return;
      fb().then(({ D, db }) => {
        if (closed) return;
        offs.push(D.onValue(D.ref(db, '.info/connected'), (s) => status(s.val() ? 'on' : 'off')));
        const r = D.ref(db, ROOT + name);
        if (isQueue(name)) {
          // صندوق الرسائل: كل رسالة جديدة بالترتيب، من بعد آخر رسالة وصلت
          const q = since ? D.query(r, D.orderByKey(), D.startAfter(since)) : D.query(r, D.orderByKey());
          offs.push(D.onChildAdded(q, (snap) => {
            since = snap.key;
            if (opts.onId) opts.onId(snap.key);
            handle(snap);
          }, () => status('off')));
        } else {
          // قناة الحالة: آخر وضع فقط
          offs.push(D.onValue(r, handle, () => status('off')));
        }
      }).catch(() => {
        status('off');
        setTimeout(start, 5000); // إعادة المحاولة إذا فشل تحميل المكتبة
      });
    };
    start();

    return { close() { closed = true; offs.forEach((f) => { try { f(); } catch { /* تجاهل */ } }); offs = []; } };
  }

  async function fbDrop(names) {
    try {
      const { D, db } = await fb();
      await Promise.all(names.map((n) => D.remove(D.ref(db, ROOT + n))));
    } catch { /* تجاهل */ }
  }

  // =========================================================
  // ٢) ntfy.sh (احتياطي)
  // =========================================================
  const BASE = 'https://ntfy.sh';
  const PREFIX = 'athar-crime-';
  const topicOf = (name) => PREFIX + name;

  async function ntfyPublish(name, obj) {
    const body = JSON.stringify(obj);
    for (let a = 0; a < 5; a++) {
      try {
        const r = await fetch(`${BASE}/${topicOf(name)}`, { method: 'POST', body });
        if (r.ok) return true;
        if (r.status !== 429 && r.status < 500) return false;
      } catch { /* انقطاع مؤقت */ }
      await wait(800 * 2 ** a + Math.random() * 400);
    }
    return false;
  }

  function ntfySubscribe(name, onMsg, opts, status) {
    const topic = topicOf(name);
    let es = null, closed = false, retry = 0, since = opts.since || 'all', timer = 0;

    const open = () => {
      if (closed) return;
      try { if (es) es.close(); } catch { /* تجاهل */ }
      es = new EventSource(`${BASE}/${topic}/sse?since=${encodeURIComponent(since)}`);
      es.onopen = () => { retry = 0; status('on'); };
      es.onmessage = (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (!m || m.event !== 'message' || typeof m.message !== 'string') return;
        since = m.id;
        if (opts.onId) opts.onId(m.id);
        let body;
        try { body = JSON.parse(m.message); } catch { return; }
        onMsg(body);
      };
      es.onerror = () => {
        status('off');
        try { es.close(); } catch { /* تجاهل */ }
        clearTimeout(timer);
        timer = setTimeout(open, Math.min(15000, 1000 * 2 ** retry++));
      };
    };

    // الجوال إذا رجع من الخلفية نتأكد أن الاتصال حي
    const onVis = () => {
      if (document.visibilityState === 'visible' && (!es || es.readyState === 2)) { retry = 0; open(); }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);
    open();

    return {
      close() {
        closed = true; clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('online', onVis);
        try { es && es.close(); } catch { /* تجاهل */ }
      }
    };
  }

  // =========================================================
  // ٣) وضع الاختبار المحلي: نفس المتصفح، تبويبات متعددة
  // =========================================================
  const LKEY = 'crime-net:';
  function localPublish(name, obj) {
    const topic = topicOf(name), body = JSON.stringify(obj);
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LKEY + topic) || '[]'); } catch { /* تجاهل */ }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    list.push({ id, body });
    if (list.length > 80) list = list.slice(-80);
    try { localStorage.setItem(LKEY + topic, JSON.stringify(list)); } catch { /* تجاهل */ }
    try { const bc = new BroadcastChannel(LKEY + topic); bc.postMessage({ id, body }); bc.close(); } catch { /* تجاهل */ }
    return Promise.resolve(true);
  }
  function localSubscribe(name, onMsg, opts, status) {
    const topic = topicOf(name);
    const seen = new Set();
    const handle = (m) => {
      if (!m || seen.has(m.id)) return;
      seen.add(m.id);
      try { onMsg(JSON.parse(m.body)); } catch { /* تجاهل */ }
    };
    let bc = null;
    try { bc = new BroadcastChannel(LKEY + topic); bc.onmessage = (e) => handle(e.data); } catch { /* تجاهل */ }
    setTimeout(() => {
      status('on');
      let list = [];
      try { list = JSON.parse(localStorage.getItem(LKEY + topic) || '[]'); } catch { /* تجاهل */ }
      list.forEach(handle);
    }, 30);
    return { close() { try { bc && bc.close(); } catch { /* تجاهل */ } } };
  }

  // =========================================================
  // الواجهة الموحّدة
  // =========================================================
  function publish(name, obj) {
    if (MODE === 'local') return localPublish(name, obj);
    if (MODE === 'firebase') return fbPublish(name, obj);
    return ntfyPublish(name, obj);
  }
  function subscribe(name, onMsg, opts = {}) {
    const status = opts.onStatus || (() => {});
    if (MODE === 'local') return localSubscribe(name, onMsg, opts, status);
    if (MODE === 'firebase') return fbSubscribe(name, onMsg, opts, status);
    return ntfySubscribe(name, onMsg, opts, status);
  }
  function drop(names) {
    if (MODE === 'firebase' && names && names.length) return fbDrop(names);
    return Promise.resolve();
  }

  const LABEL = { firebase: 'Firebase', ntfy: 'ntfy.sh', local: 'اختبار محلي' }[MODE];
  return { publish, subscribe, drop, mode: MODE, label: LABEL, local: MODE === 'local' };
})();
