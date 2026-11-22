/* =========================================================
   إنسان حيوان جماد | التصحيح بالذكاء الاصطناعي (Gemini عبر Firebase AI Logic)
   يشتغل في شاشة المقدّم فقط: طلب واحد لكل جولة يراجع كل الإجابات دفعة وحدة.
   الواجهة:
     HuroofAI.grade({ letter, cats, items:[{id, c, a}] })
       ← Promise<{ <id>: { ok, key, why } }>   (ok صحيحة؟ key صيغة موحّدة لكشف التكرار، why سبب قصير)
     HuroofAI.ready  ← هل الإعدادات موجودة؟
   الإعداد في firebase-config.js:
     appCheckSiteKey : مفتاح reCAPTCHA v3 لـ App Check (Firebase يفرضه على AI Logic)
     aiModel         : اسم النموذج (اختياري)
   للاختبار: ?ai=mock مصحّح وهمي محلي (بدون إنترنت)، و?ai=off يعطّل الذكاء.
   ========================================================= */
window.HuroofAI = (() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const FB = window.HUROOF_FIREBASE || null;
  const SDK = 'https://www.gstatic.com/firebasejs/13.4.0/';
  // النموذج السريع أولًا، والأقوى احتياطًا (كلاهما متاح في الخطة المجانية)
  const MODELS = [(FB && FB.aiModel) || 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  const TIMEOUTS = [12000, 25000];
  const MODE = params.get('ai') === 'mock' ? 'mock' : params.get('ai') === 'off' ? 'off' : 'gemini';

  // تعليمات الحَكَم
  const SYSTEM = [
    'أنت حَكَم عادل في لعبة «إنسان حيوان جماد» (لعبة الحروف). المشاركون يكتبون كلمة تبدأ بحرف الجولة لكل خانة.',
    'لكل إجابة قرّر هل هي صحيحة للخانة:',
    '- لازم تبدأ بحرف الجولة، و«ال» التعريف في أولها ما تُحسب (البرازيل تصلح للباء). الهمزات على الألف كلها ألف.',
    '- إنسان: اسم علم لشخص (اسم شائع لذكر أو أنثى، أو شخصية معروفة). حيوان: أي حيوان أو طائر أو حشرة أو سمكة حقيقية.',
    '  جماد: شيء مادي غير حي (أداة، أثاث، جهاز، مادة…). نبات: نبات أو شجرة أو زهرة أو خضار أو ثمرة. بلاد: دولة، وتُقبل المدن والمناطق المعروفة.',
    '  أي خانة ثانية: احكم بالمعنى المفهوم من اسمها (مثل مهنة، أكلة، لون، سورة، صحابي، ماركة).',
    '- تسامح مع الأخطاء الإملائية البسيطة والتاء المربوطة والهمزات والكتابة باللهجة إذا كان المقصود واضحًا.',
    '- ارفض: الكلمات المخترعة أو غير المعروفة، والإجابة اللي ما تنتمي للخانة، واسم الخانة نفسه (مثل «حيوان»)، والصفات العامة.',
    '- إذا ما كنت متأكدًا والكلمة معروفة في الخليج أو العالم العربي فاقبلها.',
    'key: الصيغة الموحّدة القصيرة للإجابة (بدون «ال»، مفرد، إملاء موحّد) حتى نكشف الإجابات المتطابقة بين المشاركين، مثل «البطة» و«بط» ← «بط».',
    'why: سبب قصير جدًا بالعربية (من ٢ إلى ٦ كلمات)، مثل «ليس حيوانًا» أو «كلمة غير معروفة» أو «مدينة سعودية». ',
    'أرجع نتيجة لكل id بدون استثناء.'
  ].join('\n');

  // ---------- تحميل المكتبة مرة وحدة ----------
  let ready = null;
  function load() {
    if (!ready) {
      ready = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-ai.js')])
        .then(async ([A, AI]) => {
          const app = A.getApps().find((a) => a.name === 'athar-huroof') || A.initializeApp(FB, 'athar-huroof');
          // App Check: مفروض على AI Logic من Firebase، فنفعّله إذا وُجد المفتاح
          if (FB.appCheckSiteKey) {
            if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
            const AC = await import(SDK + 'firebase-app-check.js');
            try {
              AC.initializeAppCheck(app, { provider: new AC.ReCaptchaV3Provider(FB.appCheckSiteKey), isTokenAutoRefreshEnabled: true });
            } catch (e) { /* مفعّل من قبل */ }
          }
          const ai = AI.getAI(app, { backend: new AI.GoogleAIBackend() });
          const S = AI.Schema;
          const schema = S.object({
            properties: {
              results: S.array({
                items: S.object({
                  properties: { id: S.integer(), ok: S.boolean(), key: S.string(), why: S.string() }
                })
              })
            }
          });
          const models = MODELS.map((m) => AI.getGenerativeModel(ai, {
            model: m,
            systemInstruction: SYSTEM,
            generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 }
          }));
          return { models };
        })
        .catch((e) => { ready = null; throw e; });
    }
    return ready;
  }

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  // ---------- مصحّح وهمي للاختبار المحلي فقط ----------
  function mock({ items }) {
    const out = {};
    const bad = /^(.)\1+$|^[^ء-ي]+$/; // حرف مكرر أو بلا حروف عربية
    items.forEach((x) => {
      const t = String(x.a).replace(/^ال/, '').replace(/ة$/, 'ه');
      const ok = !bad.test(t) && t.length >= 2 && !/^(حيوان|انسان|إنسان|جماد|بلاد)$/.test(t);
      out[x.id] = { ok, key: t, why: ok ? '' : 'كلمة غير معروفة' };
    });
    return new Promise((res) => setTimeout(() => res(out), 900));
  }

  async function grade({ letter, cats, items }) {
    if (!items.length) return {};
    if (MODE === 'off') throw new Error('ai-off');
    if (MODE === 'mock') return mock({ items });
    if (!FB) throw new Error('no-config');
    const { models } = await load();
    const body = JSON.stringify({
      letter,
      categories: cats.map((c, i) => ({ c: i, name: c })),
      items: items.map((x) => ({ id: x.id, c: x.c, answer: x.a }))
    });
    const prompt = `حرف الجولة: «${letter}»\nالخانات والإجابات (JSON):\n${body}`;
    let lastErr = null;
    for (let k = 0; k < models.length; k++) {
      const m = models[k];
      try {
        const res = await withTimeout(m.generateContent(prompt), TIMEOUTS[k] || 25000);
        const data = JSON.parse(res.response.text());
        const out = {};
        (data.results || []).forEach((r) => {
          if (typeof r.id !== 'number') return;
          out[r.id] = { ok: !!r.ok, key: String(r.key || '').slice(0, 40), why: String(r.why || '').slice(0, 60) };
        });
        if (!Object.keys(out).length) throw new Error('empty');
        return out;
      } catch (e) {
        lastErr = e;
        console.warn('[huroof-ai]', e && (e.code || e.message));
      }
    }
    throw lastErr || new Error('ai-failed');
  }

  return { grade, mode: MODE, ready: MODE !== 'gemini' || !!FB };
})();
