/* =========================================================
   فزعة | التحكيم بالذكاء الاصطناعي (Gemini عبر Firebase AI Logic) — اختياري
   يشتغل في شاشة المقدّم فقط، ولو فشل ترجع اللعبة للتحكيم الآلي المحلي.
     FazaaAI.drawings({ title, target, items:[{id, img}] })   ← { id: نسبة التطابق ٠–١٠٠ }
     FazaaAI.descriptions({ scene, items:[{id, text}] })       ← { id: { score, hits } }
     FazaaAI.ready ← مفعّل في firebase-config.js (ai: true) ومعه الإعدادات
   للاختبار: ?ai=mock حَكَم وهمي محلي.
   ========================================================= */
window.FazaaAI = (() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const FB = window.FAZAA_FIREBASE || {};
  const SDK = 'https://www.gstatic.com/firebasejs/13.4.0/';
  const MODEL = FB.aiModel || 'gemini-3.5-flash-lite';
  const MODE = params.get('ai') === 'mock' ? 'mock' : (FB.ai && FB.databaseURL ? 'gemini' : 'off');

  let ready = null;
  function load() {
    if (!ready) {
      ready = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-ai.js')]).then(async ([A, AI]) => {
        const app = A.getApps().find((a) => a.name === 'athar-fazaa') || A.initializeApp(FB, 'athar-fazaa');
        if (FB.appCheckSiteKey) {
          const AC = await import(SDK + 'firebase-app-check.js');
          try { AC.initializeAppCheck(app, { provider: new AC.ReCaptchaV3Provider(FB.appCheckSiteKey), isTokenAutoRefreshEnabled: true }); } catch { /* مفعّل */ }
        }
        const ai = AI.getAI(app, { backend: new AI.GoogleAIBackend() });
        const S = AI.Schema;
        const schema = S.object({ properties: { results: S.array({ items: S.object({ properties: { id: S.string(), score: S.integer(), hits: S.array({ items: S.string() }) } }) }) } });
        return AI.getGenerativeModel(ai, { model: MODEL, generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 } });
      }).catch((e) => { ready = null; throw e; });
    }
    return ready;
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  const b64 = (dataUrl) => String(dataUrl).split(',')[1] || '';
  // تحويل SVG إلى صورة PNG لإرسالها للنموذج
  function svgToPng(svg, w = 400, h = 300) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h); res(c.toDataURL('image/png')); };
      img.onerror = rej;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  async function run(parts) {
    const m = await load();
    const r = await withTimeout(m.generateContent(parts), 30000);
    const data = JSON.parse(r.response.text());
    return data.results || [];
  }

  async function drawings({ title, target, items }) {
    if (MODE === 'mock') return Object.fromEntries(items.map((x, i) => [x.id, 80 - i * 7]));
    if (MODE !== 'gemini') throw new Error('ai-off');
    const parts = [
      'أنت حَكَم في «تحدي الرسم». الصورة الأولى هي الأصل، وبعدها رسمات المتسابقين بالترتيب مع معرّف كل رسمة. ' +
      'قيّم تطابق كل رسمة مع الأصل من ٠ إلى ١٠٠: الألوان، ومواضع العناصر، ووجود العناصر وأشكالها. لا تحكم على المهارة الفنية بل على التطابق. ' +
      'الرسمة الفارغة أو العشوائية تحت ١٠. أرجع score لكل id و hits فارغة. عنوان الأصل: ' + title,
      { inlineData: { mimeType: 'image/png', data: b64(await svgToPng(target.svg)) } }
    ];
    items.forEach((x) => { parts.push('id: ' + x.id); parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64(x.img) } }); });
    const out = {};
    (await run(parts)).forEach((r) => { if (r.id && typeof r.score === 'number') out[r.id] = Math.max(0, Math.min(100, Math.round(r.score))); });
    return out;
  }

  async function descriptions({ scene, items }) {
    if (MODE === 'mock') return Object.fromEntries(items.map((x) => [x.id, { score: Math.min(100, 20 + x.text.length / 3 | 0), hits: ['وهمي'] }]));
    if (MODE !== 'gemini') throw new Error('ai-off');
    const facts = scene.facts.map((f) => `${f.label}${typeof f.n === 'number' ? ': ' + f.n : ''}${f.color ? ' (' + f.colorLabel + ': ' + f.color + ')' : ''}${f.text ? ' (' + f.textLabel + ': ' + f.text + ')' : ''}`).join('، ');
    const parts = [
      'أنت حَكَم في «أدق وصف»: المتسابقون كتبوا وصفًا للصورة المرفقة. حقائق الصورة الصحيحة: ' + facts + '. ' +
      'قيّم كل وصف من ٠ إلى ١٠٠ حسب عدد التفاصيل الصحيحة (العناصر وأعدادها وألوانها والخلفية) ودقتها وشموله، واخصم على المعلومات الخاطئة. ' +
      'hits: قائمة قصيرة بالتفاصيل اللي أصاب فيها (كلمتان لكل واحدة).',
      { inlineData: { mimeType: 'image/png', data: b64(await svgToPng(scene.svg, 400, 250)) } },
      JSON.stringify(items.map((x) => ({ id: x.id, text: x.text })))
    ];
    const out = {};
    (await run(parts)).forEach((r) => { if (r.id && typeof r.score === 'number') out[r.id] = { score: Math.max(0, Math.min(100, Math.round(r.score))), hits: (r.hits || []).slice(0, 8) }; });
    return out;
  }

  return { drawings, descriptions, mode: MODE, ready: MODE !== 'off' };
})();
