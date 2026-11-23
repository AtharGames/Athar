/* =========================================================
   فزعة | طبقة الاتصال اللحظي بين شاشة المقدّم وجوالات المشاركين
   ١) Firebase Realtime Database (الأساسي): مشروع مستقل، إعداداته في firebase-config.js
   ٢) ?net=local : تجربة على نفس المتصفح (تبويبات متعددة) بلا إنترنت
   الواجهة:
     FazaaNet.get(path) / set(path, val) / update(path, obj) / remove(path)
     FazaaNet.watch(path, cb)        ← يرجّع دالة إيقاف
     FazaaNet.onStatus(cb)           ← حالة الاتصال (true/false)
     FazaaNet.presence(path, onVal, offVal)
     FazaaNet.TS                     ← وقت الخادم (يُستبدل عند الكتابة)
   كل المسارات نسبية إلى fazaa/
     FazaaNet.offset(cb)          ← فرق ساعة الجهاز عن الخادم (ms)
   ========================================================= */
window.FazaaNet = (() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const FB = window.FAZAA_FIREBASE && window.FAZAA_FIREBASE.databaseURL ? window.FAZAA_FIREBASE : null;
  const MODE = (params.get('net') === 'local' || window.FAZAA_NET === 'local' || !FB) ? 'local' : 'firebase';
  const ROOT = 'fazaa/';
  const TS = Object.freeze({ '.sv': 'timestamp' });

  // =========================================================
  // ١) Firebase Realtime Database (Modular SDK)
  // =========================================================
  const SDK = 'https://www.gstatic.com/firebasejs/13.4.0/';
  let fbReady = null;

  function fb() {
    if (!fbReady) {
      fbReady = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-database.js')])
        .then(([A, D]) => {
          const app = A.getApps().find((a) => a.name === 'athar-fazaa') || A.initializeApp(FB, 'athar-fazaa');
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

  const fbApi = {
    async get(path) {
      const { D, db } = await fb();
      return (await D.get(D.ref(db, ROOT + path))).val();
    },
    async set(path, val) {
      const { D, db } = await fb();
      return D.set(D.ref(db, ROOT + path), val);
    },
    async update(path, obj) {
      const { D, db } = await fb();
      return D.update(D.ref(db, ROOT + path), obj);
    },
    async remove(path) {
      const { D, db } = await fb();
      return D.remove(D.ref(db, ROOT + path));
    },
    watch(path, cb) {
      let off = null, closed = false, timer = 0;
      const start = () => {
        fb().then(({ D, db }) => {
          if (closed) return;
          off = D.onValue(D.ref(db, ROOT + path), (s) => cb(s.val()), (e) => console.warn('[fazaa] watch', e && e.message));
        }).catch(() => { timer = setTimeout(start, 4000); }); // إعادة المحاولة إذا فشل تحميل المكتبة
      };
      start();
      return () => { closed = true; clearTimeout(timer); if (off) off(); };
    },
    onStatus(cb) {
      let off = null, closed = false, timer = 0;
      const start = () => {
        fb().then(({ D, db }) => {
          if (closed) return;
          off = D.onValue(D.ref(db, '.info/connected'), (s) => cb(!!s.val()));
        }).catch(() => { cb(false); timer = setTimeout(start, 4000); });
      };
      start();
      return () => { closed = true; clearTimeout(timer); if (off) off(); };
    },
    // فرق ساعة الجهاز عن ساعة الخادم، لعدّاد الوقت
    offset(cb) {
      let off = null, closed = false;
      fb().then(({ D, db }) => {
        if (closed) return;
        off = D.onValue(D.ref(db, '.info/serverTimeOffset'), (s) => cb(+s.val() || 0));
      }).catch(() => {});
      return () => { closed = true; if (off) off(); };
    },
    // الحضور: قيمة عند الاتصال وقيمة تُكتب تلقائيًا عند الانقطاع
    async presence(path, onVal, offVal) {
      const { D, db } = await fb();
      const r = D.ref(db, ROOT + path);
      await D.onDisconnect(r).set(offVal);
      return D.set(r, onVal);
    }
  };

  // =========================================================
  // ٢) الوضع المحلي: شجرة بيانات في localStorage + BroadcastChannel
  // =========================================================
  const LKEY = 'athar-fazaa-local';
  const watchers = new Set();
  let bc = null;
  try { bc = new BroadcastChannel(LKEY); bc.onmessage = () => notify(); } catch { /* تجاهل */ }
  window.addEventListener('storage', (e) => { if (e.key === LKEY) notify(); });

  const load = () => { try { return JSON.parse(localStorage.getItem(LKEY) || '{}') || {}; } catch { return {}; } };
  const save = (t) => {
    try { localStorage.setItem(LKEY, JSON.stringify(t)); } catch { /* تجاهل */ }
    try { bc && bc.postMessage(1); } catch { /* تجاهل */ }
    notify();
  };
  const parts = (p) => p.split('/').filter(Boolean);
  const getAt = (t, p) => parts(p).reduce((o, k) => (o && typeof o === 'object' && k in o ? o[k] : null), t);
  const stamp = (v) => {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      const o = {};
      Object.keys(v).forEach((k) => { const x = stamp(v[k]); if (x !== null && x !== undefined) o[k] = x; });
      return Object.keys(o).length ? o : null;
    }
    return v === undefined ? null : v;
  };
  function setAt(t, p, v) {
    const ks = parts(p);
    v = stamp(v);
    if (!ks.length) return v || {};
    const chain = [t];
    let o = t;
    for (let i = 0; i < ks.length - 1; i++) {
      if (!o[ks[i]] || typeof o[ks[i]] !== 'object') { if (v === null) return t; o[ks[i]] = {}; }
      o = o[ks[i]]; chain.push(o);
    }
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v;
    // تنظيف الفروع الفارغة مثل Firebase
    for (let i = chain.length - 1; i > 0; i--) if (!Object.keys(chain[i]).length) delete chain[i - 1][ks[i - 1]];
    return t;
  }
  function notify() {
    const t = load();
    watchers.forEach((w) => {
      const v = getAt(t, w.path), j = JSON.stringify(v);
      if (j !== w.last) { w.last = j; try { w.cb(v); } catch (e) { console.error(e); } }
    });
  }
  const localApi = {
    get: (path) => Promise.resolve(getAt(load(), path)),
    set(path, val) {
      const t = load();
      // محاكاة قاعدة «الإجابة تُكتب مرة واحدة»
      if (/^\d+\/a\/\d+\/[a-z0-9]+$/.test(path) && getAt(t, path) !== null) return Promise.reject(new Error('exists'));
      save(setAt(t, path, val));
      return Promise.resolve();
    },
    update(path, obj) {
      let t = load();
      Object.keys(obj).forEach((k) => { t = setAt(t, path + '/' + k, obj[k]); });
      save(t);
      return Promise.resolve();
    },
    remove(path) { save(setAt(load(), path, null)); return Promise.resolve(); },
    watch(path, cb) {
      const w = { path, cb, last: undefined };
      watchers.add(w);
      setTimeout(() => { const v = getAt(load(), path); w.last = JSON.stringify(v); cb(v); }, 20);
      return () => watchers.delete(w);
    },
    onStatus(cb) { setTimeout(() => cb(true), 20); return () => {}; },
    offset(cb) { setTimeout(() => cb(0), 20); return () => {}; },
    presence(path, onVal, offVal) {
      window.addEventListener('pagehide', () => {
        const t = load();
        // لا نعيد إنشاء مشارك أُخرج من الغرفة
        if (getAt(t, path.split('/').slice(0, -1).join('/')) !== null) save(setAt(t, path, offVal));
      });
      return localApi.set(path, onVal);
    }
  };

  const api = MODE === 'firebase' ? fbApi : localApi;
  return Object.assign({ TS, mode: MODE, local: MODE === 'local' }, api);
})();
