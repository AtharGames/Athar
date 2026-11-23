/* =========================================================
   سِجَال | تعريف الفقرات (تُحمّل في شاشة المقدّم وجوال المشارك)
   كل فقرة: الاسم، نظام اللعب (team جماعي بقائد / solo فردي / duel مواجهة / mines الألغام)،
   make() تجهّز الجولة، score() تحسب النقاط، host/reveal للعرض، phone/phoneRev للجوال
   ========================================================= */
window.FZ_GAMES = (() => {
  'use strict';
  const { $, $$, esc, ar, num, plus, parseNum, rng, RANK_PTS, rankBy, speedPts, km, FX } = window.FZ;
  const SC = window.FZ_SCENE;
  const C = window.FZ_CONTENT;
  const L = ['أ', 'ب', 'ج', 'د'];
  const teamName = (T, id) => (T[id] && T[id].n) || '';
  const teamColor = (T, id) => (T[id] && T[id].c) || '#888';
  const tag = (T, id) => `<span class="tchip" style="--tc:${teamColor(T, id)}">${esc(teamName(T, id))}</span>`;
  const pname = (P, pid) => (P[pid] && P[pid].n) || '؟';

  // ---------- أدوات مشتركة ----------
  // خيارات متعددة على الجوال
  function mcPhone(el, opts, c, { big = false } = {}) {
    el.insertAdjacentHTML('beforeend', `<div class="mc ${big ? 'mc-big' : ''}">${opts.map((o, i) =>
      `<button class="mc-opt tactile" data-i="${i}" ${!c.can || c.sent != null ? 'disabled' : ''} aria-pressed="${String(c.sent != null && +c.sent === i)}"><i>${L[i]}</i><span>${esc(o)}</span></button>`).join('')}</div>`);
    $$('.mc-opt', el).forEach((b) => b.addEventListener('click', () => {
      if (b.disabled) return;
      $$('.mc-opt', el).forEach((x) => { x.disabled = true; });
      b.setAttribute('aria-pressed', 'true');
      FX.tick(0.25);
      c.submit(String(b.dataset.i));
    }));
  }
  // خيارات على الشاشة الكبيرة (مع الصحيح عند الكشف)
  const mcHost = (opts, correct = -1, counts = null) => `<div class="mc mc-host">${opts.map((o, i) =>
    `<div class="mc-opt ${i === correct ? 'is-right' : correct >= 0 ? 'is-dim' : ''}"><i>${L[i]}</i><span>${esc(o)}</span>${counts ? `<b class="cnt">${ar(counts[i] || 0)}</b>` : ''}</div>`).join('')}</div>`;

  // إدخال رقم
  function numPhone(el, c, { unit = '', ph = 'اكتب الرقم' } = {}) {
    if (!c.can) return;
    el.insertAdjacentHTML('beforeend', `<form class="num-in" autocomplete="off">
      <div class="num-box"><input inputmode="decimal" enterkeyhint="send" placeholder="${ph}" ${c.sent != null ? 'disabled' : ''} value="${c.sent != null ? esc(num(+c.sent)) : ''}"><small>${esc(unit)}</small></div>
      <button class="btn btn-primary tactile" ${c.sent != null ? 'disabled' : ''}>إرسال</button></form>`);
    const f = $('.num-in', el), inp = $('input', f);
    if (c.sent == null) setTimeout(() => inp.focus(), 60);
    inp.addEventListener('input', () => {
      const v = parseNum(inp.value);
      inp.classList.toggle('bad', inp.value.trim() !== '' && v == null);
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = parseNum(inp.value);
      if (v == null || v < 0) { inp.classList.add('bad'); FX.wrong(); return; }
      inp.disabled = true; $('button', f).disabled = true; inp.blur();
      c.submit(String(v));
    });
  }

  // نقاط فقرات «الأقرب» للفرق
  function closeness(c, trueVal, errOf, exactOf) {
    const rows = [];
    Object.keys(c.A || {}).forEach((pid) => {
      const p = c.P[pid]; if (!p) return;
      const v = c.A[pid].v;
      const e = errOf(v);
      if (e == null) return;
      rows.push({ tid: String(p.t), pid, v, err: e, t: c.A[pid].t });
    });
    const ranked = rankBy(rows, 'err');
    const tp = {}, ans = {};
    ranked.forEach((x) => {
      let pts = RANK_PTS[x.rank] || 10;
      const exact = exactOf(x.err);
      if (exact) pts += 30;
      tp[x.tid] = pts;
      ans[x.tid] = { v: x.v, err: Math.round(x.err * 1000) / 1000, pts, ex: exact || undefined, rank: x.rank };
    });
    return { tp, rev: { k: trueVal, ans } };
  }
  function closenessReveal(el, c, fmt, errFmt) {
    const rows = Object.keys(c.rev.ans || {}).map((tid) => Object.assign({ tid }, c.rev.ans[tid])).sort((a, b) => a.rank - b.rank);
    el.insertAdjacentHTML('beforeend', `<ol class="rank-list">${rows.map((r) => `<li class="${r.rank === 0 ? 'first' : ''}">
      ${tag(c.T, r.tid)}<b class="guess">${fmt(r.v)}</b><small>${errFmt(r)}</small>${r.ex ? '<em class="exact">إصابة!</em>' : ''}<strong>${plus(r.pts)}</strong></li>`).join('')
      || '<li class="empty">ما أرسل أحد</li>'}</ol>`);
  }

  // نقاط اختيار متعدد للفرق: الصح ١٠٠ وأسرع فريق صح +٢٠
  function teamMC(c) {
    const tp = {}, ans = {};
    let fastest = null;
    Object.keys(c.A || {}).forEach((pid) => {
      const p = c.P[pid]; if (!p) return;
      const v = +c.A[pid].v, ok = v === c.k.correct, tid = String(p.t);
      ans[tid] = { v, ok };
      tp[tid] = ok ? 100 : 0;
      if (ok && (!fastest || c.A[pid].t < fastest.t)) fastest = { tid, t: c.A[pid].t };
    });
    if (fastest && Object.values(ans).filter((x) => x.ok).length > 1) { tp[fastest.tid] += 20; ans[fastest.tid].fast = true; }
    return { tp, rev: { k: c.k.correct, ans } };
  }
  function teamMCReveal(el, c, opts) {
    const counts = {};
    Object.values(c.rev.ans || {}).forEach((x) => { counts[x.v] = (counts[x.v] || 0) + 1; });
    el.insertAdjacentHTML('beforeend', mcHost(opts, c.rev.k, counts) + `<div class="team-res">${Object.keys(c.T).map((tid) => {
      const a = c.rev.ans[tid];
      return `<span class="tres ${a ? (a.ok ? 'ok' : 'no') : 'none'}" style="--tc:${teamColor(c.T, tid)}">${esc(teamName(c.T, tid))}<b>${a ? (a.ok ? '✓' : '✗') : '—'}</b>${a && a.fast ? '<em>الأسرع ' + plus(20) + '</em>' : ''}</span>`;
    }).join('')}</div>`);
  }

  // نقاط اختيار متعدد فردي: صح = سرعة
  function soloMC(c, isRight) {
    const pp = {};
    let right = 0;
    const fast = [];
    Object.keys(c.A || {}).forEach((pid) => {
      const a = c.A[pid];
      const ok = isRight(a.v);
      pp[pid] = ok ? speedPts(a.t, c.at, c.dl) : 0;
      if (ok) { right++; fast.push({ pid, t: a.t }); }
    });
    fast.sort((a, b) => a.t - b.t);
    return { pp, rev: { k: c.k, right, n: Object.keys(c.A || {}).length, top: fast.slice(0, 5).map((x) => x.pid) } };
  }
  function soloTop(el, c) {
    const top = c.rev.top || [];
    el.insertAdjacentHTML('beforeend', `<div class="solo-sum"><span>أصاب <b>${ar(c.rev.right || 0)}</b> من ${ar(c.rev.n || 0)}</span>
      ${top.length ? `<ol class="fast-list">${top.map((pid, i) => `<li><i>${ar(i + 1)}</i>${esc(pname(c.P, pid))}${c.P[pid] ? tag(c.T, c.P[pid].t) : ''}<b>${plus(c.pp[pid] || 0)}</b></li>`).join('')}</ol>` : ''}</div>`);
  }

  // =========================================================
  // الفقرات
  // =========================================================
  const GAMES = {

    // ---------- ١) كم السعر؟ ----------
    price: {
      name: 'كم السعر؟', ico: '💰', mode: 'team', rounds: 3, time: 30,
      idea: 'خمّنوا سعر المنتج، والأقرب يكسب',
      how: 'يظهر منتج من متجر معيّن. تشاوروا في سعره الحقيقي، والقائد يرسل الرقم. الأقرب ١٠٠ والثاني ٧٠ وهكذا، والإصابة الدقيقة +٣٠.',
      make(c) {
        const list = (c.cfg.prices && c.cfg.prices.length ? c.cfg.prices : []).concat(C.price);
        const [, it] = c.pick('price', list);
        return { d: { n: it[0], st: it[1], e: it[3] || '🏷️' }, k: { v: +it[2] } };
      },
      score: (c) => closeness(c, c.k.v, (v) => { const x = parseFloat(v); return isNaN(x) ? null : Math.abs(x - c.k.v) / c.k.v; }, (e) => e <= 0.02),
      card: (d) => `<div class="product"><span class="p-emo">${d.e}</span><div><b>${esc(d.n)}</b><small>${esc(d.st)}</small></div><span class="tagprice">؟ ريال</span></div>`,
      host(el, c) { el.innerHTML = this.card(c.d); },
      reveal(el, c) {
        el.innerHTML = `<div class="truth"><small>السعر الحقيقي</small><b>${num(c.rev.k)} <i>ريال</i></b></div>`;
        closenessReveal(el, c, (v) => num(+v), (r) => `فرق ${num(Math.round(r.err * 100))}٪`);
      },
      phone(el, c) { el.innerHTML = this.card(c.d); numPhone(el, c, { unit: 'ريال', ph: 'السعر' }); },
      phoneRev(el, c) { el.innerHTML = `<div class="truth"><small>السعر الحقيقي</small><b>${num(c.rev.k)} <i>ريال</i></b></div>`; }
    },

    // ---------- ٢) سرعة البديهة ----------
    reflex: {
      name: 'سرعة البديهة', ico: '🎯', mode: 'solo', rounds: 5, time: 8,
      idea: 'اضغط العنصر المطلوب قبل غيرك',
      how: 'تظهر شبكة أشكال وألوان، والمطلوب مكتوب فوقها (مثل: أزرق + مربع). اضغط الصحيح بأسرع ما يمكن، والخطأ صفر.',
      make(c) { const seed = c.seed; return { d: { s: seed }, k: { ans: SC.reflex(seed).ans } }; },
      score: (c) => soloMC(c, (v) => +v === c.k.ans),
      grid(d, ans = -1, counts = null) {
        const g = SC.reflex(d.s);
        return `<div class="rx-cmd">${esc(g.cmd)}</div><div class="rx-grid">${g.cells.map((cell, i) =>
          `<button class="rx-cell tactile ${ans === i ? 'is-right' : ans >= 0 ? 'is-dim' : ''}" data-i="${i}">${SC.reflexCell(cell)}${counts ? `<b class="cnt">${ar(counts[i] || 0)}</b>` : ''}</button>`).join('')}</div>`;
      },
      host(el, c) { el.innerHTML = this.grid(c.d); $$('.rx-cell', el).forEach((b) => { b.disabled = true; }); },
      reveal(el, c) {
        const counts = {};
        Object.values(c.A || {}).forEach((a) => { counts[a.v] = (counts[a.v] || 0) + 1; });
        el.innerHTML = this.grid(c.d, c.rev.k.ans, counts);
        $$('.rx-cell', el).forEach((b) => { b.disabled = true; });
        soloTop(el, c);
      },
      phone(el, c) {
        el.innerHTML = this.grid(c.d);
        $$('.rx-cell', el).forEach((b) => {
          b.disabled = c.sent != null;
          if (c.sent != null && +c.sent === +b.dataset.i) b.classList.add('picked');
          b.addEventListener('click', () => {
            $$('.rx-cell', el).forEach((x) => { x.disabled = true; });
            b.classList.add('picked'); FX.tick(0.25);
            c.submit(String(b.dataset.i));
          });
        });
      },
      phoneRev(el, c) { el.innerHTML = this.grid(c.d, c.rev.k.ans); $$('.rx-cell', el).forEach((b) => { b.disabled = true; }); }
    },

    // ---------- ٣) عين الصقر ----------
    hawk: {
      name: 'عين الصقر', ico: '👁️', mode: 'team', rounds: 3, time: 20, view: 8,
      idea: 'ركّزوا في المشهد، ثم جاوبوا عن تفاصيله',
      how: 'يظهر مشهد (واحة، سوق شعبي، قرية تراثية، ساحل) لثوانٍ ثم يختفي، ويأتي سؤال عن تفصيلة صغيرة. اجمعوا ما لاحظه كل واحد، والقائد يرسل. الصح ١٠٠ والأسرع +٢٠.',
      make(c) { const seed = c.seed, sc = SC.scene(seed), q = SC.ask(sc, seed); return { d: { s: seed }, k: { correct: q.correct } }; },
      score: (c) => teamMC(c),
      host(el, c) {
        const sc = SC.scene(c.d.s), q = SC.ask(sc, c.d.s);
        el.innerHTML = c.view ? `<div class="scene-wrap look">${sc.svg}<span class="look-tag">ركّزوا! 👁️</span></div>`
          : `<div class="q-big">${esc(q.q)}</div>${mcHost(q.opts)}`;
      },
      reveal(el, c) {
        const sc = SC.scene(c.d.s), q = SC.ask(sc, c.d.s);
        el.innerHTML = `<div class="q-big small">${esc(q.q)}</div><div class="scene-wrap mini">${sc.svg}</div>`;
        teamMCReveal(el, c, q.opts);
      },
      phone(el, c) {
        const sc = SC.scene(c.d.s), q = SC.ask(sc, c.d.s);
        if (c.view) { el.innerHTML = `<div class="scene-wrap look">${sc.svg}<span class="look-tag">ركّز!</span></div>`; return; }
        el.innerHTML = `<div class="q-big">${esc(q.q)}</div>`;
        mcPhone(el, q.opts, c);
      },
      phoneRev(el, c) {
        const sc = SC.scene(c.d.s), q = SC.ask(sc, c.d.s);
        el.innerHTML = `<div class="scene-wrap mini">${sc.svg}</div><div class="truth"><small>${esc(q.q)}</small><b>${esc(q.opts[q.correct])}</b></div>`;
      }
    },

    // ---------- ٤) أسئلة السرعة ----------
    quick: {
      name: 'أسئلة السرعة', ico: '⚡', mode: 'solo', rounds: 5, time: 15,
      idea: 'سؤال ثقافي وخيارات، والأسرع يكسب أكثر',
      how: 'سؤال من بنك ديوان (أو من المقدّم) وخياراته على جوالك. الصح يعطيك ٥٠ وحتى ٥٠ زيادة حسب سرعتك.',
      make(c) {
        const q = c.hostQ || (window.AtharQuiz && window.AtharQuiz.next(c.quiz));
        if (!q) return null;
        return { d: { q: q.q, o: q.opts, cat: q.cat || '' }, k: { correct: q.correct, cite: q.cite || '' } };
      },
      score: (c) => soloMC(c, (v) => +v === c.k.correct),
      host(el, c) { el.innerHTML = `${c.d.cat ? `<span class="q-cat">${esc(c.d.cat)}</span>` : ''}<div class="q-big">${esc(c.d.q)}</div>${mcHost(c.d.o)}`; },
      reveal(el, c) {
        const counts = {};
        Object.values(c.A || {}).forEach((a) => { counts[a.v] = (counts[a.v] || 0) + 1; });
        el.innerHTML = `<div class="q-big small">${esc(c.d.q)}</div>${mcHost(c.d.o, c.rev.k.correct, counts)}${c.rev.k.cite ? `<p class="cite">${esc(c.rev.k.cite)}</p>` : ''}`;
        soloTop(el, c);
      },
      phone(el, c) { el.innerHTML = `<div class="q-big">${esc(c.d.q)}</div>`; mcPhone(el, c.d.o, c); },
      phoneRev(el, c) { el.innerHTML = `<div class="q-big small">${esc(c.d.q)}</div><div class="truth"><small>الإجابة</small><b>${esc(c.d.o[c.rev.k.correct])}</b></div>`; }
    },

    // ---------- ٥) تحدي الرسم ----------
    draw: {
      name: 'تحدي الرسم', ico: '🎨', mode: 'duel', rounds: 1, time: 60,
      idea: 'رسّام من كل فريق يقلّد الصورة',
      how: 'يُختار رسّام من كل فريق، وتظهر صورة أصلية. ارسمها بأدق ما تقدر قبل نهاية الوقت، والحَكَم يقارن الألوان والأماكن والعناصر. الأدق ١٠٠ والثاني ٧٠…',
      make(c) { return { d: { s: c.seed }, k: {} }; },
      async score(c) {
        const t = SC.target(c.d.s);
        const sims = {};
        let by = 'local';
        const ids = Object.keys(c.A || {});
        // التحكيم بالذكاء إن كان مفعّلًا، وإلا المقارنة الآلية
        if (c.ai && ids.length) {
          try {
            const res = await c.ai.drawings({ title: t.title, target: t, items: ids.map((pid) => ({ id: pid, img: c.A[pid].v })) });
            ids.forEach((pid) => { if (res[pid] != null) sims[pid] = res[pid]; });
            if (Object.keys(sims).length) by = 'ai';
          } catch (e) { console.warn('[fazaa-ai]', e && e.message); }
        }
        for (const pid of ids) {
          if (sims[pid] != null) continue;
          sims[pid] = await new Promise((res) => {
            const img = new Image();
            img.onload = () => res(SC.similarity(t.prims, img));
            img.onerror = () => res(0);
            img.src = c.A[pid].v;
          });
        }
        const rows = rankBy(ids.map((pid) => ({ pid, err: -sims[pid] })), 'err');
        const pp = {}, tp = {};
        rows.forEach((r) => { pp[r.pid] = sims[r.pid] > 0 ? (RANK_PTS[r.rank] || 10) : 0; if (c.P[r.pid]) tp[String(c.P[r.pid].t)] = pp[r.pid]; });
        return { pp, tp, rev: { sim: sims, by, rank: Object.fromEntries(rows.map((r) => [r.pid, r.rank])) } };
      },
      host(el, c) {
        const t = SC.target(c.d.s);
        el.innerHTML = `<div class="draw-host"><figure class="frame">${t.svg}<figcaption>${esc(t.title)}</figcaption></figure>
          <div class="drawers">${(c.drawers || []).map((pid) => `<span class="drawer ${c.A && c.A[pid] ? 'done' : ''}" style="--tc:${c.P[pid] ? teamColor(c.T, c.P[pid].t) : '#888'}">✏️ ${esc(pname(c.P, pid))}</span>`).join('')}</div></div>`;
      },
      reveal(el, c) {
        const t = SC.target(c.d.s);
        const ids = Object.keys(c.rev.sim || {}).sort((a, b) => c.rev.rank[a] - c.rev.rank[b]);
        el.innerHTML = `<div class="gallery"><figure class="frame orig">${t.svg}<figcaption>الأصل</figcaption></figure>${ids.map((pid) => `
          <figure class="frame ${c.rev.rank[pid] === 0 ? 'win' : ''}" style="--tc:${c.P[pid] ? teamColor(c.T, c.P[pid].t) : '#888'}"><img src="${c.A[pid] ? c.A[pid].v : ''}" alt="رسمة ${esc(pname(c.P, pid))}">
          <figcaption>${esc(pname(c.P, pid))}<span class="sim">تطابق ${ar(c.rev.sim[pid])}٪</span><b>${plus(c.pp[pid] || 0)}</b></figcaption></figure>`).join('')}</div>
          <p class="judge">${c.rev.by === 'ai' ? '🤖 حكم الذكاء الاصطناعي' : '🔍 حكم آلي بمقارنة الألوان والأماكن'}</p>`;
      },
      phone(el, c) {
        const t = SC.target(c.d.s);
        if (!c.can) {
          el.innerHTML = `<figure class="frame">${t.svg}<figcaption>${esc(t.title)}</figcaption></figure><p class="wait-note">${esc(c.waitText || 'الرسّامون يرسمون الآن…')}</p>`;
          return;
        }
        if (c.sent != null) { el.innerHTML = `<figure class="frame"><img src="${c.sent}" alt="رسمتك"><figcaption>رسمتك وصلت ✓</figcaption></figure>`; return; }
        el.innerHTML = `<figure class="frame ref">${t.svg}</figure>${PAD}`;
        drawPad(el, c);
      },
      phoneRev(el, c) {
        const me = c.me.pid;
        el.innerHTML = c.rev.sim && c.rev.sim[me] != null ? `<div class="truth"><small>تطابق رسمتك</small><b>${ar(c.rev.sim[me])}٪</b></div>` : `<div class="truth"><small>الأدق</small><b>${esc(pname(c.P, Object.keys(c.rev.rank || {}).find((p) => c.rev.rank[p] === 0)))}</b></div>`;
      }
    },

    // ---------- ٦) قرّب من الرقم ----------
    number: {
      name: 'قرّب من الرقم', ico: '🔢', mode: 'team', rounds: 3, time: 25,
      idea: 'قدّروا الرقم أو الإحصائية',
      how: 'سؤال جوابه رقم (عدد، مسافة، سنة…). تشاوروا والقائد يرسل التقدير، والأقرب يكسب أكثر.',
      make(c) {
        const list = (c.cfg.numbers && c.cfg.numbers.length ? c.cfg.numbers : []).concat(C.number);
        const [, it] = c.pick('number', list);
        return { d: { q: it[0], u: it[2] || '' }, k: { v: +it[1] } };
      },
      score: (c) => closeness(c, c.k.v, (v) => { const x = parseFloat(v); return isNaN(x) ? null : Math.abs(x - c.k.v) / Math.max(Math.abs(c.k.v), 1e-9); }, (e) => e <= 0.005),
      host(el, c) { el.innerHTML = `<div class="q-big">${esc(c.d.q)}</div><div class="unit-tag">الإجابة بـ «${esc(c.d.u)}»</div>`; },
      reveal(el, c) {
        el.innerHTML = `<div class="q-big small">${esc(c.d.q)}</div><div class="truth"><small>الإجابة</small><b>${num(c.rev.k)} <i>${esc(c.d.u)}</i></b></div>`;
        closenessReveal(el, c, (v) => num(+v), (r) => `فرق ${num(Math.round(r.err * 100))}٪`);
      },
      phone(el, c) { el.innerHTML = `<div class="q-big">${esc(c.d.q)}</div>`; numPhone(el, c, { unit: c.d.u, ph: 'تقديركم' }); },
      phoneRev(el, c) { el.innerHTML = `<div class="q-big small">${esc(c.d.q)}</div><div class="truth"><small>الإجابة</small><b>${num(c.rev.k)} <i>${esc(c.d.u)}</i></b></div>`; }
    },

    // ---------- ٧) أدق وصف ----------
    describe: {
      name: 'أدق وصف', ico: '🖼️', mode: 'solo', rounds: 1, time: 60,
      idea: 'صف الصورة كتابةً بكل تفاصيلها',
      how: 'تظهر صورة، واكتب وصفًا شاملًا: العناصر وأعدادها وألوانها والخلفية. كل تفصيلة صحيحة تزيد نقاطك، والوصف الأطول والأدق يكسب.',
      make(c) { return { d: { s: c.seed }, k: {} }; },
      async score(c) {
        const sc = SC.scene(c.d.s);
        const pp = {}, hits = {};
        let by = 'local';
        const ids = Object.keys(c.A || {});
        if (c.ai && ids.length) {
          try {
            const res = await c.ai.descriptions({ scene: sc, items: ids.map((pid) => ({ id: pid, text: c.A[pid].v })) });
            ids.forEach((pid) => { if (res[pid]) { pp[pid] = res[pid].score; hits[pid] = res[pid].hits || []; } });
            if (Object.keys(pp).length) by = 'ai';
          } catch (e) { console.warn('[fazaa-ai]', e && e.message); }
        }
        ids.forEach((pid) => {
          if (pp[pid] != null) return;
          const r = SC.describeScore(c.A[pid].v, sc.facts);
          pp[pid] = r.score; hits[pid] = r.hits;
        });
        const top = ids.sort((a, b) => pp[b] - pp[a]).slice(0, 3);
        return { pp, rev: { hits, top, by } };
      },
      host(el, c) { el.innerHTML = `<div class="scene-wrap big">${SC.scene(c.d.s).svg}</div>`; },
      reveal(el, c) {
        el.innerHTML = `<div class="desc-rev"><div class="scene-wrap mini">${SC.scene(c.d.s).svg}</div><ol class="desc-top">${(c.rev.top || []).map((pid, i) =>
          `<li><header><i>${ar(i + 1)}</i>${esc(pname(c.P, pid))}${c.P[pid] ? tag(c.T, c.P[pid].t) : ''}<b>${plus(c.pp[pid] || 0)}</b></header>
          <p>${esc((c.A[pid] && c.A[pid].v) || '')}</p><small>${(c.rev.hits[pid] || []).map(esc).join('، ')}</small></li>`).join('') || '<li class="empty">ما أرسل أحد</li>'}</ol></div>
          <p class="judge">${c.rev.by === 'ai' ? '🤖 حكم الذكاء الاصطناعي' : '🔍 حكم آلي يطابق العناصر والأعداد والألوان'}</p>`;
      },
      phone(el, c) {
        el.innerHTML = `<div class="scene-wrap">${SC.scene(c.d.s).svg}</div>`;
        if (c.sent != null) { el.insertAdjacentHTML('beforeend', `<p class="sent-text">${esc(c.sent)}</p>`); return; }
        el.insertAdjacentHTML('beforeend', `<form class="desc-in"><textarea rows="5" maxlength="900" placeholder="صف كل ما تراه: العناصر، أعدادها، ألوانها، الخلفية…"></textarea>
          <div class="row"><small class="wc">٠ كلمة</small><button class="btn btn-primary tactile">إرسال الوصف</button></div></form>`);
        const f = $('.desc-in', el), ta = $('textarea', f), wc = $('.wc', f);
        const key = 'fazaa-desc-' + c.r;
        ta.value = window.FZ.store.get(key) || '';
        const upd = () => { wc.textContent = `${ar(ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0)} كلمة`; window.FZ.store.set(key, ta.value); };
        upd();
        ta.addEventListener('input', upd);
        f.addEventListener('submit', (e) => { e.preventDefault(); if (!ta.value.trim()) { FX.wrong(); return; } c.submit(ta.value.trim().slice(0, 900)); });
        // إرسال تلقائي قبل نهاية الوقت
        c.onEnd(() => { if (ta.value.trim()) c.submit(ta.value.trim().slice(0, 900)); });
      },
      phoneRev(el, c) {
        const h = (c.rev.hits || {})[c.me.pid];
        el.innerHTML = `<div class="scene-wrap mini">${SC.scene(c.d.s).svg}</div>${h ? `<p class="hits">أصبت في: ${esc(h.join('، ') || '—')}</p>` : ''}`;
      }
    },

    // ---------- ٨) ثبّت الدبوس ----------
    pin: {
      name: 'ثبّت الدبوس', ico: '📍', mode: 'team', rounds: 3, time: 25,
      idea: 'حدّدوا المكان على الخريطة',
      how: 'تظهر خريطة واسم مكان. تشاوروا والقائد يضع الدبوس، والأقرب بالكيلومترات يكسب أكثر، والإصابة الدقيقة +٣٠.',
      make(c) {
        const [, it] = c.pick('pin', C.pin.filter((x) => (c.cfg.maps || ['sa', 'arab']).includes(x[0])));
        return { d: { m: it[0], p: it[1] }, k: { lat: it[2], lon: it[3] } };
      },
      score(c) {
        const ex = c.d.m === 'sa' ? 25 : 80;
        const r = closeness(c, [c.k.lat, c.k.lon], (v) => { const [a, b] = String(v).split(',').map(Number); return isNaN(a) || isNaN(b) ? null : km(a, b, c.k.lat, c.k.lon); }, (e) => e <= ex);
        return r;
      },
      map(m, pins = [], truth = null) {
        const M = window.FZ_MAPS[m];
        const xy = (lat, lon) => [(lon - M.lon0) * M.kx, (M.lat1 - lat) * M.ky];
        let s = `<svg class="map" viewBox="0 0 ${M.w} ${M.h}" xmlns="http://www.w3.org/2000/svg"><rect class="sea" width="${M.w}" height="${M.h}"/><path class="land" d="${M.land}"/>${M.hi ? `<path class="land hi" d="${M.hi}"/>` : ''}<g class="pins">`;
        if (truth) {
          const [tx, ty] = xy(truth[0], truth[1]);
          pins.forEach((p) => { const [x, y] = xy(p.lat, p.lon); s += `<line class="dist" x1="${x}" y1="${y}" x2="${tx}" y2="${ty}" stroke="${p.c}"/>`; });
        }
        pins.forEach((p) => { const [x, y] = xy(p.lat, p.lon); s += pinSvg(x, y, p.c); });
        if (truth) { const [x, y] = xy(truth[0], truth[1]); s += `<g class="truth-star" transform="translate(${x} ${y})"><circle r="16"/><path d="M0 -11l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L0 5.5l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z"/></g>`; }
        return s + '</g></svg>';
      },
      host(el, c) { el.innerHTML = `<div class="q-big">وين تقع: <b class="place">${esc(c.d.p)}</b>؟</div><div class="map-wrap">${this.map(c.d.m)}</div>`; },
      reveal(el, c) {
        const pins = Object.keys(c.rev.ans || {}).map((tid) => { const [lat, lon] = String(c.rev.ans[tid].v).split(',').map(Number); return { lat, lon, c: teamColor(c.T, tid) }; });
        el.innerHTML = `<div class="pin-rev"><div class="map-wrap">${this.map(c.d.m, pins, c.rev.k)}</div><div><div class="q-big small">${esc(c.d.p)}</div></div></div>`;
        closenessReveal($('.pin-rev > div:last-child', el), c, () => '📍', (r) => `${num(Math.round(r.err))} كم`);
      },
      phone(el, c) {
        el.innerHTML = `<div class="q-big">وين تقع: <b class="place">${esc(c.d.p)}</b>؟</div><div class="map-wrap tap">${this.map(c.d.m, c.sent ? [{ lat: +c.sent.split(',')[0], lon: +c.sent.split(',')[1], c: c.me.color }] : [])}</div>`;
        if (!c.can || c.sent != null) return;
        el.insertAdjacentHTML('beforeend', `<button class="btn btn-primary tactile pin-send" disabled>ثبّت الدبوس هنا</button><p class="hint">اضغط على الخريطة لتحديد المكان، وتقدر تعدّله قبل التثبيت</p>`);
        const M = window.FZ_MAPS[c.d.m], svg = $('svg.map', el), g = $('.pins', svg), btn = $('.pin-send', el);
        let cur = null;
        svg.addEventListener('pointerdown', (e) => {
          const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
          const p = pt.matrixTransform(svg.getScreenCTM().inverse());
          cur = { lat: M.lat1 - p.y / M.ky, lon: M.lon0 + p.x / M.kx };
          g.innerHTML = pinSvg(p.x, p.y, c.me.color, true);
          btn.disabled = false; FX.tick(0.2);
        });
        btn.addEventListener('click', () => { if (!cur) return; btn.disabled = true; c.submit(`${cur.lat.toFixed(3)},${cur.lon.toFixed(3)}`); });
      },
      phoneRev(el, c) {
        const pins = Object.keys(c.rev.ans || {}).map((tid) => { const [lat, lon] = String(c.rev.ans[tid].v).split(',').map(Number); return { lat, lon, c: teamColor(c.T, tid) }; });
        el.innerHTML = `<div class="q-big small">${esc(c.d.p)}</div><div class="map-wrap">${this.map(c.d.m, pins, c.rev.k)}</div>`;
        const a = c.rev.ans && c.rev.ans[c.me.team];
        if (a) el.insertAdjacentHTML('beforeend', `<div class="truth"><small>بُعد دبوسكم</small><b>${num(Math.round(a.err))} <i>كم</i></b></div>`);
      }
    },

    // ---------- ٩) رتّبها صح ----------
    order: {
      name: 'رتّبها صح', ico: '📶', mode: 'solo', rounds: 4, time: 15,
      idea: 'رتّب البطاقات حسب المعيار',
      how: 'تظهر ٤ بطاقات بترتيب عشوائي ومعيار (من الأقدم للأحدث، من الشمال للجنوب…). اسحبها للترتيب الصحيح من الأعلى للأسفل واضغط تأكيد. الترتيب الصحيح كاملًا = نقاط، والأسرع أكثر.',
      make(c) {
        const [, it] = c.pick('order', C.order);
        let order = window.FZ.shuffle([0, 1, 2, 3]);
        if (order.every((v, i) => v === i)) order = [1, 0, 3, 2];
        return { d: { t: it[0], items: order.map((i) => it[1][i]) }, k: { right: order.map((_, j) => order.indexOf(j)) } };
      },
      score(c) { const want = c.k.right.join(','); return soloMC(c, (v) => v === want); },
      host(el, c) { el.innerHTML = `<div class="q-big">${esc(c.d.t)}</div><ol class="cards-row">${c.d.items.map((x) => `<li class="ocard">${esc(x)}</li>`).join('')}</ol>`; },
      reveal(el, c) {
        el.innerHTML = `<div class="q-big small">${esc(c.d.t)}</div><ol class="cards-row right">${c.rev.k.right.map((i, j) => `<li class="ocard"><i>${ar(j + 1)}</i>${esc(c.d.items[i])}</li>`).join('')}</ol>`;
        soloTop(el, c);
      },
      phone(el, c) {
        el.innerHTML = `<div class="q-big">${esc(c.d.t)}</div><p class="hint">الأول فوق ⬆️ — اسحب البطاقة أو استخدم الأسهم</p>`;
        let cur = c.sent != null ? c.sent.split(',').map(Number) : [0, 1, 2, 3];
        el.insertAdjacentHTML('beforeend', `<ol class="sorter"></ol><button class="btn btn-primary tactile order-send">تأكيد الترتيب</button>`);
        const ol = $('.sorter', el), btn = $('.order-send', el);
        const locked = c.sent != null;
        btn.disabled = locked;
        const draw = () => {
          ol.innerHTML = cur.map((i, j) => `<li class="ocard tactile" data-j="${j}"><i>${ar(j + 1)}</i><span>${esc(c.d.items[i])}</span>${locked ? '' : `<button class="up" aria-label="لأعلى" ${j === 0 ? 'disabled' : ''}>▲</button><button class="dn" aria-label="لأسفل" ${j === 3 ? 'disabled' : ''}>▼</button>`}</li>`).join('');
        };
        draw();
        if (locked) return;
        ol.addEventListener('click', (e) => {
          const b = e.target.closest('button'); if (!b) return;
          const j = +b.closest('li').dataset.j, k = b.classList.contains('up') ? j - 1 : j + 1;
          [cur[j], cur[k]] = [cur[k], cur[j]]; draw(); FX.tick(0.15);
        });
        // السحب باللمس
        let drag = null;
        ol.addEventListener('pointerdown', (e) => {
          const li = e.target.closest('li'); if (!li || e.target.closest('button')) return;
          drag = { j: +li.dataset.j, y0: e.clientY, li, h: li.offsetHeight + 8 };
          li.classList.add('dragging'); li.setPointerCapture(e.pointerId);
        });
        ol.addEventListener('pointermove', (e) => {
          if (!drag) return;
          const dy = e.clientY - drag.y0;
          drag.li.style.transform = `translateY(${dy}px)`;
          const k = Math.max(0, Math.min(3, drag.j + Math.round(dy / drag.h)));
          if (k !== drag.j) {
            const v = cur.splice(drag.j, 1)[0]; cur.splice(k, 0, v);
            drag.y0 += (k - drag.j) * drag.h; drag.j = k; FX.tick(0.12);
            draw(); drag.li = ol.children[k]; drag.li.classList.add('dragging');
            drag.li.style.transform = `translateY(${e.clientY - drag.y0}px)`;
          }
        });
        const end = () => { if (!drag) return; drag.li.classList.remove('dragging'); drag.li.style.transform = ''; drag = null; draw(); };
        ol.addEventListener('pointerup', end); ol.addEventListener('pointercancel', end);
        btn.addEventListener('click', () => { btn.disabled = true; $$('button', ol).forEach((b) => { b.disabled = true; }); c.submit(cur.join(',')); });
      },
      phoneRev(el, c) { el.innerHTML = `<div class="q-big small">${esc(c.d.t)}</div><ol class="sorter done">${c.rev.k.right.map((i, j) => `<li class="ocard"><i>${ar(j + 1)}</i><span>${esc(c.d.items[i])}</span></li>`).join('')}</ol>`; }
    },

    // ---------- ١٠) الكلمة الدخيلة ----------
    odd: {
      name: 'الكلمة الدخيلة', ico: '🚫', mode: 'solo', rounds: 5, time: 10,
      idea: 'اكتشف الكلمة اللي ما تنتمي للباقي',
      how: 'تظهر ٤ كلمات يجمعها رابط خفي إلا واحدة. اضغط الدخيلة بأسرع ما يمكن خلال ١٠ ثوانٍ، والخطأ صفر.',
      make(c) {
        const [, it] = c.pick('odd', C.odd);
        const order = window.FZ.shuffle([0, 1, 2, 3]);
        return { d: { w: order.map((i) => it[0][i]) }, k: { ans: order.indexOf(it[1]), why: it[2] } };
      },
      score: (c) => soloMC(c, (v) => +v === c.k.ans),
      host(el, c) { el.innerHTML = `<div class="q-big">وش الدخيلة؟</div>${mcHost(c.d.w)}`; },
      reveal(el, c) {
        const counts = {};
        Object.values(c.A || {}).forEach((a) => { counts[a.v] = (counts[a.v] || 0) + 1; });
        el.innerHTML = `<div class="q-big small">الدخيلة: <b>${esc(c.d.w[c.rev.k.ans])}</b></div><p class="why">${esc(c.rev.k.why)}</p>${mcHost(c.d.w, c.rev.k.ans, counts)}`;
        soloTop(el, c);
      },
      phone(el, c) { el.innerHTML = '<div class="q-big">وش الدخيلة؟</div>'; mcPhone(el, c.d.w, c, { big: true }); },
      phoneRev(el, c) { el.innerHTML = `<div class="truth"><small>الدخيلة</small><b>${esc(c.d.w[c.rev.k.ans])}</b></div><p class="why">${esc(c.rev.k.why)}</p>`; }
    },

    // ---------- ١١) أكمِل المثل أو البيت ----------
    proverb: {
      name: 'أكمِل المثل', ico: '✍️', mode: 'team', rounds: 4, time: 25,
      idea: 'أكملوا المثل أو بيت الشعر',
      how: 'يظهر مثل أو بيت شعر (فصيح ونبطي) ناقص آخره. تشاوروا ٢٥ ثانية، والقائد يختار التكملة. الصح ١٠٠، ولو أصاب أكثر من فريق فالأسرع +٢٠.',
      make(c) {
        const [, it] = c.pick('proverb', C.proverb);
        const opts = window.FZ.shuffle([it[2], ...it[3]]);
        return { d: { kd: it[0], t: it[1], o: opts }, k: { correct: opts.indexOf(it[2]) } };
      },
      score: (c) => teamMC(c),
      line: (d, fill) => `<span class="q-cat">${esc(d.kd)}</span><blockquote class="verse">${esc(d.t).replace('……', fill ? `<mark>${esc(fill)}</mark>` : '<span class="gap">……</span>').replace(' … ', '<br>')}</blockquote>`,
      host(el, c) { el.innerHTML = this.line(c.d) + mcHost(c.d.o); },
      reveal(el, c) { el.innerHTML = this.line(c.d, c.d.o[c.rev.k]); teamMCReveal(el, c, c.d.o); },
      phone(el, c) { el.innerHTML = this.line(c.d); mcPhone(el, c.d.o, c); },
      phoneRev(el, c) { el.innerHTML = this.line(c.d, c.d.o[c.rev.k]); }
    },

    // ---------- ١٢) الألغام ----------
    mines: {
      name: 'الألغام', ico: '💣', mode: 'mines', rounds: 2, time: 12, place: 15,
      idea: 'خبّوا لغمكم، وافتحوا الخانات بالدور',
      how: 'لوحة ٤×٤: كل فريق (قائده) يخبّي لغمًا في خانة سرًا. بعدها بالدور كل واحد يفتح خانة: الآمنة +١٠ لرصيد الجولة، واللي ينفجر عليه لغم يخسر رصيد الجولة ويطلع منها. اللي يصمد يحفظ رصيده.'
    }
  };

  // ---------- لوحة الرسم ----------
  const PAD = `<div class="pad">
    <canvas class="pad-c" width="600" height="450" aria-label="لوحة الرسم"></canvas>
    <div class="pad-tools">
      <div class="swatches">${['#FFFFFF', '#1d1d1d', '#8FD3F7', '#1E6FE0', '#1B2A6B', '#2E9E5B', '#6CC070', '#FFD34D', '#F59E0B', '#D94841', '#8B5A2B', '#F2D38B', '#7D8597', '#E0559B']
      .map((c, i) => `<button class="sw ${i === 1 ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="لون"></button>`).join('')}</div>
      <div class="pad-row">
        <button class="tool on" data-t="pen" aria-label="قلم">✏️</button>
        <button class="tool" data-t="fill" aria-label="تعبئة">🪣</button>
        <button class="tool size" data-s="1" aria-label="حجم القلم">●</button>
        <button class="tool" data-a="undo" aria-label="تراجع">↩️</button>
        <button class="tool" data-a="clear" aria-label="مسح الكل">🗑️</button>
        <button class="btn btn-primary tactile pad-send">إرسال</button>
      </div>
    </div></div>`;
  function drawPad(el, c) {
    const cv = $('.pad-c', el), x = cv.getContext('2d', { willReadFrequently: true });
    const W = cv.width, H = cv.height;
    let color = '#1d1d1d', tool = 'pen', size = 1, hist = [];
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const snap = () => { hist.push(x.getImageData(0, 0, W, H)); if (hist.length > 25) hist.shift(); };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    let last = null;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      const [px, py] = pos(e);
      snap();
      if (tool === 'fill') { flood(x, px | 0, py | 0, color, W, H); FX.pop(380); return; }
      last = [px, py];
      x.strokeStyle = color; x.lineWidth = [6, 16, 40][size];
      x.beginPath(); x.arc(px, py, x.lineWidth / 2, 0, Math.PI * 2); x.fillStyle = color; x.fill();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!last) return;
      const [px, py] = pos(e);
      x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(px, py); x.stroke(); last = [px, py];
    });
    const up = () => { last = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    $$('.sw', el).forEach((b) => b.addEventListener('click', () => { color = b.dataset.c; $$('.sw', el).forEach((s) => s.classList.toggle('on', s === b)); FX.tick(0.12); }));
    $$('.tool[data-t]', el).forEach((b) => b.addEventListener('click', () => { tool = b.dataset.t; $$('.tool[data-t]', el).forEach((s) => s.classList.toggle('on', s === b)); }));
    $('.tool.size', el).addEventListener('click', (e) => { size = (size + 1) % 3; e.currentTarget.dataset.s = size; e.currentTarget.style.fontSize = ['12px', '18px', '26px'][size]; });
    $('[data-a="undo"]', el).addEventListener('click', () => { const h = hist.pop(); if (h) x.putImageData(h, 0, 0); });
    $('[data-a="clear"]', el).addEventListener('click', () => { snap(); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); });
    let done = false;
    const send = () => {
      if (done) return; done = true;
      const s = document.createElement('canvas'); s.width = 240; s.height = 180;
      s.getContext('2d').drawImage(cv, 0, 0, 240, 180);
      c.submit(s.toDataURL('image/jpeg', 0.72));
    };
    $('.pad-send', el).addEventListener('click', send);
    c.onEnd(send);
  }
  // تعبئة منطقة متصلة بنفس اللون
  function flood(x, sx, sy, hex, W, H) {
    const img = x.getImageData(0, 0, W, H), d = img.data;
    const i0 = (sy * W + sx) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2]];
    const n = parseInt(hex.slice(1), 16), f = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    if (Math.abs(t[0] - f[0]) + Math.abs(t[1] - f[1]) + Math.abs(t[2] - f[2]) < 6) return;
    const same = (i) => Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) < 60;
    const st = [[sx, sy]];
    while (st.length) {
      let [px, py] = st.pop();
      let i = (py * W + px) * 4;
      while (py >= 0 && same(i)) { py--; i -= W * 4; }
      py++; i += W * 4;
      let L = false, Rr = false;
      while (py < H && same(i)) {
        d[i] = f[0]; d[i + 1] = f[1]; d[i + 2] = f[2]; d[i + 3] = 255;
        if (px > 0) { if (same(i - 4)) { if (!L) { st.push([px - 1, py]); L = true; } } else L = false; }
        if (px < W - 1) { if (same(i + 4)) { if (!Rr) { st.push([px + 1, py]); Rr = true; } } else Rr = false; }
        py++; i += W * 4;
      }
    }
    x.putImageData(img, 0, 0);
  }
  function pinSvg(x, y, c, pulse = false) {
    return `<g class="pin ${pulse ? 'pulse' : ''}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><ellipse rx="7" ry="3" fill="rgba(0,0,0,.35)"/><path d="M0 0C-3-9-14-15-14-26a14 14 0 0 1 28 0C14-15 3-9 0 0z" fill="${c}" stroke="#fff" stroke-width="3"/><circle cy="-26" r="5" fill="#fff"/></g>`;
  }

  // ---------- لوحة الألغام (للمقدّم والجوال) ----------
  // st: { n: حجم اللوحة, rev: {خانة: 'ok' أو 'boom:مفتاح'}, ... }  mark: خانة لغمي
  function minesBoard(st, { mark = -1, tap = false, bombs = null, T = {}, owners = null } = {}) {
    const n = st.n;
    let h = `<div class="mines" style="--n:${n}">`;
    for (let i = 0; i < n * n; i++) {
      const r = st.rev && st.rev[i];
      const own = owners && owners[i];
      const cls = r === 'ok' ? 'safe' : r ? 'boom' : bombs && bombs[i] ? 'bomb-show' : '';
      h += `<button class="mcell tactile ${cls} ${i === mark ? 'mine-mark' : ''}" data-i="${i}" ${!tap || r || i === mark ? 'disabled' : ''}>${r === 'ok' ? '✓' : r ? '💥' : bombs && bombs[i] ? '💣' : i === mark ? '💣' : ''}${own ? `<span class="owners">${own.map((tid) => `<i style="background:${teamColor(T, tid)}"></i>`).join('')}</span>` : ''}</button>`;
    }
    return h + '</div>';
  }

  const ORDER = ['price', 'reflex', 'hawk', 'quick', 'draw', 'number', 'describe', 'pin', 'order', 'odd', 'proverb', 'mines'];
  const MODE_LABEL = { team: 'جماعي — القائد يرسل', solo: 'فردي — الكل من جواله', duel: 'مواجهة — رسّام من كل فريق', mines: 'بالدور — لغم لكل فريق' };
  return { GAMES, ORDER, MODE_LABEL, minesBoard, pinSvg, tag, teamColor, teamName, pname, mcHost };
})();
