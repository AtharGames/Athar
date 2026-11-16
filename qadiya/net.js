/* =========================================================
   القضية | طبقة الاتصال بين شاشة المشرف وجوالات الفرق
   - الوضع الافتراضي: خدمة ntfy.sh المجانية (بلا حساب ولا إعداد)
     كل قناة «موضوع» عشوائي لا يعرفه إلا من معه الرمز.
   - وضع الاختبار ?net=local : نفس المتصفح عبر BroadcastChannel
   الاستخدام:
     QadiyaNet.publish(name, obj)
     QadiyaNet.subscribe(name, onMsg, { since, onStatus, onId })
   ========================================================= */
window.QadiyaNet = (() => {
  'use strict';
  const BASE = 'https://ntfy.sh';
  const PREFIX = 'athar-qadiya-';
  const LOCAL = new URLSearchParams(location.search).get('net') === 'local';

  const topicOf = (name) => PREFIX + name;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- نشر رسالة (مع إعادة المحاولة عند الضغط أو انقطاع الشبكة) ----------
  async function publish(name, obj) {
    const body = JSON.stringify(obj);
    if (LOCAL) return localPublish(topicOf(name), body);
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

  // ---------- الاشتراك في قناة ----------
  // since: 'all' لاسترجاع كل الرسائل المحفوظة، أو رقم آخر رسالة وصلت
  function subscribe(name, onMsg, opts = {}) {
    const topic = topicOf(name);
    const status = opts.onStatus || (() => {});
    if (LOCAL) return localSubscribe(topic, onMsg, status);

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
  // وضع الاختبار المحلي: نفس المتصفح، تبويبات متعددة
  // =========================================================
  const LKEY = 'qadiya-net:';
  function localPublish(topic, body) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LKEY + topic) || '[]'); } catch { /* تجاهل */ }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    list.push({ id, body });
    if (list.length > 80) list = list.slice(-80);
    try { localStorage.setItem(LKEY + topic, JSON.stringify(list)); } catch { /* تجاهل */ }
    try { const bc = new BroadcastChannel(LKEY + topic); bc.postMessage({ id, body }); bc.close(); } catch { /* تجاهل */ }
    return Promise.resolve(true);
  }
  function localSubscribe(topic, onMsg, status) {
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

  return { publish, subscribe, local: LOCAL };
})();
