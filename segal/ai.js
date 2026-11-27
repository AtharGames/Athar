/* =========================================================
   سِجَال | التحكيم بالذكاء الاصطناعي (Gemini عبر Firebase AI Logic) — اختياري
   يشتغل في شاشة المقدّم فقط، ولو فشل ترجع اللعبة للتحكيم الآلي المحلي.
     FazaaAI.drawings({ title, target, items:[{id, img}] })   ← { id: نسبة التطابق ٠–١٠٠ }
     FazaaAI.descriptions({ scene, items:[{id, text}] })       ← { id: { score, note, hits } } (scene رسمة أو صورة img)
     FazaaAI.ready ← مفعّل في firebase-config.js (ai: true) ومعه الإعدادات
   للاختبار: ?ai=mock حَكَم وهمي محلي.
   ========================================================= */
window.FazaaAI = (() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const FB = window.FAZAA_FIREBASE || {};
  const SDK = 'https://www.gstatic.com/firebasejs/13.4.0/';
  // النموذج الأساسي ثم بديل لو تعذّر (الأسماء من قائمة Firebase AI Logic)
  const MODELS = [FB.aiModel || 'gemini-3.5-flash-lite', 'gemini-3.6-flash'].filter((m, i, a) => a.indexOf(m) === i);
  const MODE = params.get('ai') === 'mock' ? 'mock' : (FB.ai && FB.databaseURL ? 'gemini' : 'off');

  let ready = null, AC = null, appCheck = null;
  function load() {
    if (!ready) {
      ready = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-ai.js')]).then(async ([A, AI]) => {
        const app = A.getApps().find((a) => a.name === 'athar-fazaa') || A.initializeApp(FB, 'athar-fazaa');
        if (FB.appCheckSiteKey) {
          AC = await import(SDK + 'firebase-app-check.js');
          try { appCheck = AC.initializeAppCheck(app, { provider: (FB.appCheckProvider === 'enterprise' ? new AC.ReCaptchaEnterpriseProvider(FB.appCheckSiteKey) : new AC.ReCaptchaV3Provider(FB.appCheckSiteKey)), isTokenAutoRefreshEnabled: true }); } catch { /* مفعّل */ }
        }
        const ai = AI.getAI(app, { backend: new AI.GoogleAIBackend() });
        const S = AI.Schema;
        const schema = S.object({ properties: { results: S.array({ items: S.object({ properties: { id: S.string(), score: S.integer(), hits: S.array({ items: S.string() }) } }) }) } });
        return MODELS.map((model) => AI.getGenerativeModel(ai, { model, generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 } }));
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
    const models = await load();
    let last = null;
    for (const m of models) {
      try {
        const r = await withTimeout(m.generateContent(parts), 30000);
        const data = JSON.parse(r.response.text());
        return data.results || [];
      } catch (e) { last = e; console.warn('[segal-ai]', e && e.message); }
    }
    // تشخيص: نختصر رسالة الخطأ ونفحص رمز App Check
    let msg = String((last && last.message) || last || 'ai-failed').replace(/Error fetching from \S+/g, '').replace(/\s+/g, ' ').trim();
    if (appCheck && AC) {
      try { const t = await AC.getToken(appCheck, false); msg += t && t.token ? ' | AppCheck: رمز موجود' : ' | AppCheck: بلا رمز'; }
      catch (e) { msg += ' | AppCheck: ' + String((e && e.message) || e).slice(0, 90); }
    } else if (FB.appCheckSiteKey) msg += ' | AppCheck: لم يبدأ';
    throw new Error(msg);
  }

  // صورة الأصل: رسمة SVG أو صورة حقيقية
  function imgToData(src, w = 400, h = 300) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); res(c.toDataURL('image/jpeg', 0.85)); };
      img.onerror = rej; img.src = src;
    });
  }
  // يرجع { id: { score, note } }: نسبة التطابق وتعليق قصير ظريف
  async function drawings({ title, target, items }) {
    if (MODE === 'mock') return Object.fromEntries(items.map((x, i) => [x.id, { score: 80 - i * 7, note: 'تعليق تجريبي' }]));
    if (MODE !== 'gemini') throw new Error('ai-off');
    const orig = target.img ? await imgToData(target.img) : await svgToPng(target.svg);
    const parts = [
      'أنت حَكَم ظريف في «تحدي الرسم». الصورة الأولى هي الأصل، وبعدها رسمات المتسابقين بالترتيب مع معرّف كل رسمة. ' +
      'قيّم تطابق كل رسمة مع الأصل من ٠ إلى ١٠٠: الألوان، ومواضع العناصر، ووجود العناصر وأشكالها. لا تحكم على المهارة الفنية بل على التطابق، وراعِ أن الأصل قد يكون صورة حقيقية والرسم بالإصبع على جوال. ' +
      'الرسمة الفارغة أو العشوائية تحت ١٠. أرجع score لكل id، وفي hits ضع عنصرًا واحدًا فقط: تعليق قصير ظريف باللهجة السعودية الخفيفة (من ٥ إلى ١٢ كلمة) عن الرسمة نفسها، لطيف وما فيه سخرية جارحة، ويجوز إيموجي واحد. عنوان الأصل: ' + title,
      { inlineData: { mimeType: 'image/' + (target.img ? 'jpeg' : 'png'), data: b64(orig) } }
    ];
    items.forEach((x) => { parts.push('id: ' + x.id); parts.push({ inlineData: { mimeType: 'image/jpeg', data: b64(x.img) } }); });
    const out = {};
    (await run(parts)).forEach((r) => { if (r.id && typeof r.score === 'number') out[r.id] = { score: Math.max(0, Math.min(100, Math.round(r.score))), note: String((r.hits || [])[0] || '').slice(0, 90) }; });
    return out;
  }

  async function descriptions({ scene, items }) {
    if (MODE === 'mock') return Object.fromEntries(items.map((x) => [x.id, { score: Math.min(100, 20 + x.text.length / 3 | 0), note: 'تعليق تجريبي', hits: ['وهمي'] }]));
    if (MODE !== 'gemini') throw new Error('ai-off');
    const facts = scene.facts.map((f) => `${f.label}${typeof f.n === 'number' ? ': ' + f.n : ''}${f.color ? ' (' + f.colorLabel + ': ' + f.color + ')' : ''}${f.text ? ' (' + f.textLabel + ': ' + f.text + ')' : ''}`).join('، ');
    const pic = scene.img ? { mimeType: 'image/jpeg', data: b64(await imgToData(scene.img, 512, 340)) } : { mimeType: 'image/png', data: b64(await svgToPng(scene.svg, 400, 250)) };
    const parts = [
      'أنت حَكَم في «أدق وصف»: المتسابقون كتبوا وصفًا للصورة المرفقة (قد تكون رسمة أو صورة حقيقية، وتفاصيلها الظاهرة فيها صحيحة حتى لو ما ذُكرت). أبرز حقائق الصورة: ' + facts + '. ' +
      'قيّم كل وصف من ٠ إلى ١٠٠ حسب عدد التفاصيل الصحيحة (العناصر وأعدادها وألوانها والخلفية) ودقتها وشموله، واخصم على المعلومات الخاطئة. ' +
      'hits: أول عنصر فيها تعليق قصير ظريف باللهجة السعودية الخفيفة (من ٥ إلى ١٢ كلمة) على الوصف نفسه، لطيف وما فيه سخرية جارحة، ويجوز إيموجي واحد؛ وبعده التفاصيل الصحيحة اللي أصاب فيها (كلمتان لكل واحدة، ٦ بالكثير).',
      { inlineData: pic },
      JSON.stringify(items.map((x) => ({ id: x.id, text: x.text })))
    ];
    const out = {};
    (await run(parts)).forEach((r) => { if (r.id && typeof r.score === 'number') out[r.id] = { score: Math.max(0, Math.min(100, Math.round(r.score))), note: String((r.hits || [])[0] || '').slice(0, 90), hits: (r.hits || []).slice(1, 7) }; });
    return out;
  }

  return { drawings, descriptions, mode: MODE, ready: MODE !== 'off' };
})();
