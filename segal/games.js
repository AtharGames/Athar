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
  // «الوحدة» في اللعب الفردي هي المشارك، وفي الفرق هي الفريق
  const unitKey = (c, pid) => (c.ind ? pid : String(c.P[pid].t));
  const unitColor = (c, k) => (c.ind ? window.FZ.pcolor(k) : teamColor(c.T, k));
  const unitTag = (c, k) => (c.ind ? `<span class="tchip" style="--tc:${window.FZ.pcolor(k)}">${esc(pname(c.P, k))}</span>` : tag(c.T, k));
  // شارة اسم المشارك (مع فريقه في وضع الفرق)
  const whoTag = (c, pid) => (c.ind ? '' : (c.P[pid] ? tag(c.T, c.P[pid].t) : ''));

  // سحب عنصر من بنك الفقرة حسب التصنيفات والمستويات المختارة (وعناصر المقدّم الخاصة أولًا)
  function fromBank(c, gid, custom = [], extra = null) {
    const B = C.BANK[gid];
    const sel = (c.cfg.cats && c.cfg.cats[gid]) || [];
    const lv = c.cfg.levels && c.cfg.levels.length ? c.cfg.levels : [0, 1, 2];
    const all = custom.concat(B.items);
    const ok = (it) => (!extra || extra(it)) && (it.cat === 'mine' || ((!sel.length || sel.includes(it.cat)) && lv.includes(it.lvl)));
    return c.pick(gid, all, ok)[1];
  }

  // سبب الرجوع للحكم الآلي (يظهر صغيرًا تحت النتيجة للمقدّم)
  const aiNote = (rev) => (rev.by === 'ai' || !rev.aiErr ? '' : rev.aiErr === 'off' ? '<small class="ai-why"> — الذكاء مطفأ من الإعدادات</small>' : `<small class="ai-why"> — تعذّر الذكاء: ${esc(rev.aiErr)}</small>`);

  // ---------- عين الصقر: الصورة والكشف بالبقعة الضوئية ----------
  const hawkPic = (d, extra = '') => `<div class="hk-wrap look" style="aspect-ratio:${d.w}/${d.h}"><img src="img/hawk/${d.img}.jpg" alt="${esc(d.t)}" draggable="false">${extra}</div>`;
  function hawkReveal(el, c, { done, host, mine } = {}) {
    const d = c.d, rv = c.rev || {}, hl = rv.hl || [], ok = rv.k, ar2 = d.w / d.h;
    const mid = 'hkm' + Math.random().toString(36).slice(2, 8);
    const holes = hl.map(([x, y, r]) => `<ellipse class="hole" cx="${x}" cy="${y}" rx="${r}" ry="${r * ar2}" fill="#000"/>`).join('');
    const rings = hl.map(([x, y, r]) => `<ellipse class="ring" cx="${x}" cy="${y}" rx="${r}" ry="${r * ar2}" fill="none" stroke="#FFD66B" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`).join('');
    el.innerHTML = `<div class="hk-rev"><div class="q-big small">${esc(d.q)}</div>
      <div class="hk-wrap rev" style="aspect-ratio:${d.w}/${d.h}"><img src="img/hawk/${d.img}.jpg" alt="${esc(d.t)}" draggable="false">
        <svg class="hk-spot" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><mask id="${mid}"><rect width="100" height="100" fill="#fff"/>${holes}</mask></defs>
        <rect class="dim" width="100" height="100" fill="#07041A" mask="url(#${mid})"/>${rings}</svg></div>
      <div class="hk-ans" hidden>✓ ${esc((d.opts || [])[ok] || '')}</div><div class="hk-res"></div></div>`;
    const root = $('.hk-rev', el), wrap = $('.hk-wrap', root);
    const alive = () => root.isConnected;
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? Math.min(ms, 80) : ms));
    (async () => {
      await wait(500);
      if (!alive()) return;
      wrap.classList.add('spot'); FX.swoosh && FX.swoosh();
      await wait(1000);
      if (!alive()) return;
      const a = $('.hk-ans', root); a.hidden = false; FX.pop(820);
      await wait(500);
      if (!alive()) return;
      if (host) teamMCReveal($('.hk-res', root), c, d.opts);
      else if (mine) {
        const my = (rv.ans || {})[mine.unit];
        $('.hk-res', root).innerHTML = my ? (my.ok ? `<p class="rx-me ok">✓ ${mine.ind ? 'جاوبت صح' : 'فريقك جاوب صح'}${my.fast ? ' والأسرع!' : ''}</p>` : `<p class="rx-me no">✗ ${mine.ind ? 'جوابك' : 'جواب فريقك'}: ${esc(d.opts[my.v] || '')}</p>`) : '<p class="rx-me none">ما وصل جواب</p>';
      }
      if (Object.values(rv.ans || {}).some((x) => x.ok)) FX.clap(3); else FX.wrong();
      await wait(1300);
      if (alive() && done) done();
    })();
  }

  // ---------- سرعة البديهة: الحساب والكشف المتحرك للجميع ----------
  const secs = (ms) => ar((Math.max(0, ms) / 1000).toFixed(2)).replace('.', '٫') + ' ث';
  function reflexScore(c, right = c.k.ans, mult = 1) {
    const pp = {}, tm = {}, fast = [];
    let ok = 0;
    Object.keys(c.A || {}).forEach((pid) => {
      const a = c.A[pid], hit = +a.v === right;
      pp[pid] = hit ? speedPts(a.t, c.at, c.dl) * mult : 0;
      if (hit) { ok++; tm[pid] = Math.max(0, a.t - c.at); fast.push(pid); }
    });
    fast.sort((x, y) => tm[x] - tm[y]);
    return { pp, rev: { k: c.k, right: ok, n: Object.keys(c.A || {}).length, top: fast.slice(0, 5), tm, picks: Object.fromEntries(Object.keys(c.A || {}).map((p) => [p, +c.A[p].v])) } };
  }
  // إعلان الأسرع للجميع (سرعة البديهة وأسئلة السرعة)
  function fastAnnounce(ann, c, rv, ans, myPid) {
    const top = rv.top || [];
    const tag = (pid) => `<span class="tchip" style="--tc:${window.FZ.pcolor(pid)}">${esc(pname(c.P, pid))}</span>${whoTag(c, pid)}`;
    let mineLine = '';
    if (myPid != null) {
      const pick = rv.picks ? rv.picks[myPid] : undefined;
      mineLine = pick === undefined ? '<p class="rx-me none">ما ضغطت هالمرة</p>'
        : pick === ans ? `<p class="rx-me ok">✓ صح! وقتك ${secs(rv.tm[myPid])}</p>` : '<p class="rx-me no">✗ اخترت غلط</p>';
    }
    if (!top.length) {
      ann.innerHTML = `<div class="rx-ban none">😮 ما أحد جابها!</div>${mineLine}`;
      FX.wrong();
      return;
    }
    const f = top[0];
    ann.innerHTML = `<div class="rx-ban"><small>⚡ الأسرع</small><div class="who">${tag(f)}</div><b class="time">${secs(rv.tm[f])}</b><em>${plus((c.pp || rv.pp || {})[f] || 0)}</em></div>
      <ol class="rx-podium">${top.slice(1, 3).map((pid, i) => `<li style="--d:${i}"><i>${ar(i + 2)}</i>${tag(pid)}<span>${secs(rv.tm[pid])}</span></li>`).join('')}</ol>
      <p class="rx-sum">أصاب <b>${ar(rv.right || 0)}</b> من ${ar(rv.n || 0)}</p>${mineLine}`;
    FX.whistle && FX.whistle();
    if (myPid == null || f === myPid) setTimeout(() => FX.clap(4), 250);
  }
  function reflexReveal(el, c, { done, mine } = {}) {
    const G0 = GAMES.reflex, g = SC.reflex(c.d.s), rv = c.rev || {}, ans = (rv.k || {}).ans;
    const counts = {};
    Object.values(rv.picks || {}).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    el.innerHTML = `<div class="rx-rev">${G0.grid(c.d)}<div class="rx-ann" aria-live="polite"></div></div>`;
    const root = $('.rx-rev', el), ann = $('.rx-ann', root);
    $$('.rx-cell', root).forEach((b) => { b.disabled = true; });
    const alive = () => root.isConnected;
    const fast = window.FZ.reduced();
    const wait = (ms) => new Promise((r) => setTimeout(r, fast ? Math.min(ms, 80) : ms));
    const myPid = mine && mine.pid;
    (async () => {
      await wait(350);
      // ١) العدّ: نرقّم العناصر المطلوبة واحد واحد
      if (g.mode === 'count') {
        const svg = $('.rx-fsvg', root), nums = $('.nums', svg);
        $('.rx-field', root).classList.add('show');
        const T = SC.reflexTargets(g);
        const step = Math.max(110, Math.min(300, 2400 / T.length));
        for (let i = 0; i < T.length && alive(); i++) {
          nums.insertAdjacentHTML('beforeend', `<g transform="translate(${T[i].x} ${T[i].y})"><g class="nb"><circle r="11" fill="#0A2463" stroke="#fff" stroke-width="2"/><text y="4.5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">${ar(i + 1)}</text></g></g>`);
          FX.tick(0.2);
          await wait(step);
        }
      }
      if (!alive()) return;
      // ٢) الجواب الصحيح وعدد اللي اختار كل خانة
      $$('.rx-cell', root).forEach((b, i) => {
        b.classList.add(i === ans ? 'is-right' : 'is-dim');
        if (counts[i]) b.insertAdjacentHTML('beforeend', `<b class="cnt">${ar(counts[i])}</b>`);
        if (myPid != null && rv.picks && rv.picks[myPid] === i && i !== ans) b.classList.add('my-wrong');
      });
      FX.pop(820);
      await wait(700);
      if (!alive()) return;
      // ٣) الإعلان: الأسرع ووقته
      fastAnnounce(ann, c, rv, ans, myPid);
      await wait(1600);
      if (alive() && done) done();
    })();
  }

  // ---------- تحدي الرسم: الكشف بالتشويق للجميع ----------
  const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  // تعليق محلي لو ما فيه ذكاء
  function localNote(sim, seed) {
    const r = rng((seed >>> 0) || 1);
    const L = sim >= 70 ? ['تحفة! قريبة من الأصل مرة 👏', 'يد فنان، ما شاء الله', 'نسخة طبق الأصل تقريبًا 🎯']
      : sim >= 50 ? ['الفكرة واضحة، والألوان تبي ضبط بسيط', 'قريبة، باقي لمسات بسيطة ✨', 'العناصر في أماكنها تقريبًا']
        : sim >= 30 ? ['روح الصورة موجودة… تقريبًا 😄', 'نشوف المحاولة، والوقت ظلمك', 'بداية حلوة، كمّل المرة الجاية']
          : ['فن تجريدي جريء 🎨', 'لوحة من مدرسة خاصة 😅', 'الحَكَم يحتاج نظارة يمكن 👓'];
    return r.pick(L);
  }
  function drawReveal(el, c, { done, imgs, load, mine } = {}) {
    const t = SC.target(c.d.s), rv = c.rev || {}, sim = rv.sim || {};
    const order = Object.keys(sim).sort((a, b) => (sim[a] - sim[b]) || ((rv.rank || {})[b] - (rv.rank || {})[a]));
    const n = order.length, myPid = mine && mine.pid;
    const col = (pid) => (c.P[pid] ? (c.ind ? window.FZ.pcolor(pid) : teamColor(c.T, c.P[pid].t)) : '#888');
    el.innerHTML = `<div class="dr-rev"><figure class="frame orig">${t.svg}<figcaption>الأصل: ${esc(t.title)}</figcaption></figure>
      <div class="dr-grid ${n > 4 ? 'many' : ''}">${n ? '' : '<p class="empty">ما وصلت رسمات</p>'}</div>
      <p class="judge">${rv.by === 'ai' ? '🤖 حكم الذكاء الاصطناعي' : '🔍 حكم آلي بمقارنة الألوان والأماكن'}${mine ? '' : aiNote(rv)}</p></div>`;
    const root = $('.dr-rev', el), grid = $('.dr-grid', root);
    const alive = () => root.isConnected;
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? Math.min(ms, 80) : ms));
    const countTo = (node, to, ms) => new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => { if (!node.isConnected) return res(); const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(2, -10 * p); node.textContent = ar(Math.round(to * (p >= 1 ? 1 : e))) + '٪'; if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step); setTimeout(() => { if (node.isConnected) node.textContent = ar(to) + '٪'; res(); }, ms + 120);
    });
    (async () => {
      const pics = imgs || (load ? ((await load()) || {}) : {});
      const src = (pid) => { const v = pics[pid]; return typeof v === 'string' ? v : (v && v.v) || ''; };
      await wait(500);
      for (let i = 0; i < n && alive(); i++) {
        const pid = order[i], top = n - i <= 3, rank = n - i, me = myPid != null && pid === myPid;
        const card = document.createElement('figure');
        card.className = `frame dr-card ${top ? 'top wait' : ''} ${me ? 'me' : ''}`;
        card.style.setProperty('--tc', col(pid));
        card.innerHTML = `<i class="dr-rk">${ar(rank)}</i><img src="${src(pid)}" alt="رسمة ${esc(pname(c.P, pid))}">
          <figcaption><span class="tchip" style="--tc:${col(pid)}">${esc(pname(c.P, pid))}</span>${whoTag(c, pid)}<b class="dr-sim">٠٪</b><em>${plus((c.pp || rv.pp || {})[pid] || 0)}</em></figcaption>
          <p class="dr-note" hidden>${esc((rv.notes || {})[pid] || '')}</p>`;
        grid.prepend(card);
        if (top) {
          if (rank === 1) FX.play('riser', 0.55);
          for (let k = 0; k < 5 && alive(); k++) { FX.tick(0.2); await wait(170); }
          card.classList.remove('wait');
        }
        FX.pop(top ? 700 : 520);
        await countTo($('.dr-sim', card), sim[pid] || 0, top ? 900 : 450);
        if (!alive()) return;
        const nt = $('.dr-note', card); if (nt.textContent) nt.hidden = false;
        if (i === n - 1) {
          card.classList.add('win'); card.insertAdjacentHTML('afterbegin', '<span class="dr-crown">👑</span>'); FX.play('stamp', 0.7);
          FX.clap(5);
          if (myPid == null || me) window.FZ.confetti(document.getElementById('confetti'), { count: 110 });
        }
        await wait(top ? 900 : Math.max(180, 1400 / Math.max(1, n - 3)));
      }
      await wait(700);
      if (alive() && done) done();
    })();
  }

  // ---------- أدق وصف: صورة حقيقية أو مشهد مرسوم، وكشف بالتشويق ----------
  // الصورة: { svg, title, facts:[{label, w}], img? }
  function descPic(d) {
    if (d.p != null && C.desc && C.desc[d.p]) {
      const it = C.desc[d.p], img = 'img/desc/' + it.img + '.jpg';
      return { img, title: it.t, photo: true, facts: it.facts.map((f) => ({ label: f.label, w: f.kw, have: true })),
        svg: `<img class="desc-photo" src="${img}" alt="${esc(it.t)}" draggable="false">` };
    }
    const sc = SC.scene(d.s);
    return { svg: sc.svg, title: '', photo: false, facts: sc.facts, scene: sc };
  }
  // جذر الكلمة للمطابقة: بلا واو العطف وحروف الجر و«ال»
  const dStem = (w) => SC.strip(w).replace(/^(و|ف|ب|ل)(?=ال)/, '').replace(/^ال(?=..)/, '');
  const dHit = (t, w) => t === w || (w.length >= 3 && t.includes(w) && t.length - w.length <= 4) || (/^\d+$/.test(w) && t === w);
  // تقييم محلي لوصف صورة حقيقية: كل حقيقة لها كلمات تدل عليها
  function descPhotoScore(text, facts) {
    const nt = SC.norm(text), toks = nt.split(' ').filter(Boolean).map(dStem);
    const hits = [];
    facts.forEach((f) => {
      const ws = f.w.map((x) => dStem(SC.norm(x)));
      const ok = ws.some((w) => (w.includes(' ') ? (' ' + nt + ' ').includes(' ' + w + ' ') : toks.some((t) => dHit(t, w))));
      if (ok) hits.push(f.label);
    });
    const words = toks.length;
    const score = Math.min(100, Math.round(92 * hits.length / Math.max(1, Math.min(facts.length, 8)) * 0.9 + Math.min(10, words / 4)));
    return { score: hits.length ? score : Math.min(score, 8), hits };
  }
  // تظليل الكلمات اللي أصاب فيها داخل النص
  function descMark(text, facts) {
    const ws = [].concat(...facts.filter((f) => f.have || (typeof f.n === 'number' && f.n > 0) || f.text).map((f) => f.w || [])).map((x) => dStem(SC.norm(x))).filter((w) => w && !w.includes(' '));
    return String(text || '').split(/(\s+)/).map((p) => {
      const t = dStem(SC.norm(p));
      return t && ws.some((w) => dHit(t, w)) ? `<mark>${esc(p)}</mark>` : esc(p);
    }).join('');
  }
  const DESC_WEAK = 30;
  function descNote(score, seed) {
    const r = rng((seed >>> 0) || 1);
    const L = score >= 15 ? ['شفت نص الصورة تقريبًا 😄', 'الوقت ظلمك يمكن ⏳', 'بداية، والمرة الجاية أدق', 'وصفك مختصر مفيد… مختصر مرة 😅']
      : ['تبي نظارة؟ 👓', 'وصف من الذاكرة يمكن 😅', 'الصورة تسلّم عليك 👋', 'كأنك تصف صورة ثانية 🤔', 'الحَكَم يدوّر التفاصيل وما لقاها 🔍'];
    return r.pick(L);
  }
  function descReveal(el, c, { done, texts, load, mine } = {}) {
    const pic = descPic(c.d), rv = c.rev || {}, sc = rv.sc || {};
    const order = Object.keys(sc).sort((a, b) => (sc[a] - sc[b]) || (a < b ? 1 : -1));
    const n = order.length, myPid = mine && mine.pid;
    // التعليق الطريف للأوصاف الضعيفة فقط
    const weak = (pid) => (sc[pid] || 0) < DESC_WEAK || !((rv.hits || {})[pid] || []).length;
    const col = (pid) => (c.P[pid] ? (c.ind ? window.FZ.pcolor(pid) : teamColor(c.T, c.P[pid].t)) : '#888');
    el.innerHTML = `<div class="ds-rev"><figure class="frame ds-pic ${pic.photo ? 'photo' : ''}">${pic.svg}${pic.title ? `<figcaption>${esc(pic.title)}</figcaption>` : ''}</figure>
      <ol class="ds-list">${n ? '' : '<li class="empty">ما أرسل أحد</li>'}</ol>
      <p class="judge">${rv.by === 'ai' ? '🤖 حكم الذكاء الاصطناعي' : '🔍 حكم آلي يطابق العناصر والأعداد والألوان'}${mine ? '' : aiNote(rv)}</p></div>`;
    const root = $('.ds-rev', el), list = $('.ds-list', root);
    const alive = () => root.isConnected;
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? Math.min(ms, 80) : ms));
    const countTo = (node, to, ms) => new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => { if (!node.isConnected) return res(); const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(2, -10 * p); node.textContent = ar(Math.round(to * (p >= 1 ? 1 : e))); if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step); setTimeout(() => { if (node.isConnected) node.textContent = ar(to); res(); }, ms + 120);
    });
    (async () => {
      const raw = texts || (load ? ((await load()) || {}) : {});
      const txt = (pid) => { const v = raw[pid]; return typeof v === 'string' ? v : (v && v.v) || ''; };
      await wait(500);
      for (let i = 0; i < n && alive(); i++) {
        const pid = order[i], top = n - i <= 3, rank = n - i, me = myPid != null && pid === myPid;
        const li = document.createElement('li');
        li.className = `ds-card ${top ? 'top wait' : ''} ${me ? 'me' : ''}`;
        li.style.setProperty('--tc', col(pid));
        const hits = (rv.hits || {})[pid] || [];
        li.innerHTML = `<header><i class="ds-rk">${ar(rank)}</i><span class="tchip" style="--tc:${col(pid)}">${esc(pname(c.P, pid))}</span>${whoTag(c, pid)}
            <span class="ds-meter"><b class="ds-sc">٠</b><small>/١٠٠</small></span><em>${plus((c.pp || rv.pp || {})[pid] || 0)}</em></header>
          <p class="ds-txt">${descMark(txt(pid), pic.facts) || '<span class="dim">…</span>'}</p>
          <div class="ds-hits" hidden><b>${hits.length ? `✓ أصاب ${hits.length === 1 ? 'تفصيلة وحدة' : hits.length === 2 ? 'تفصيلتين' : ar(hits.length) + (hits.length < 11 ? ' تفاصيل' : ' تفصيلة')}:` : '✗ ما أصاب ولا تفصيلة'}</b>${hits.map((h) => `<span>${esc(h)}</span>`).join('')}</div>
          <p class="ds-note" hidden>${weak(pid) ? esc((rv.notes || {})[pid] || '') : ''}</p>`;
        list.prepend(li);
        if (top) {
          if (rank === 1) FX.play('riser', 0.55);
          for (let k = 0; k < 5 && alive(); k++) { FX.tick(0.2); await wait(170); }
          li.classList.remove('wait');
        }
        FX.pop(top ? 700 : 520);
        await countTo($('.ds-sc', li), sc[pid] || 0, top ? 900 : 450);
        if (!alive()) return;
        li.style.setProperty('--p', ((sc[pid] || 0) / 100).toFixed(3));
        const hb = $('.ds-hits', li); hb.hidden = false;
        const nt = $('.ds-note', li); if (nt.textContent) nt.hidden = false;
        if (i === n - 1) {
          li.classList.add('win'); li.insertAdjacentHTML('afterbegin', '<span class="dr-crown">👑</span>'); FX.play('stamp', 0.7);
          FX.clap(5);
          if (myPid == null || me) window.FZ.confetti(document.getElementById('confetti'), { count: 110 });
        }
        await wait(top ? 1100 : Math.max(180, 1400 / Math.max(1, n - 3)));
      }
      await wait(700);
      if (alive() && done) done();
    })();
  }

  // ---------- ثبّت الدبوس: صورة المعلم، التلميح في نص الوقت، والكشف بالتشويق ----------
  function pinHead(c) {
    const d = c.d;
    return `<div class="pin-q ${d.img ? 'has-pic' : ''}">${d.img ? `<figure class="frame pin-pic"><img src="img/pin/${esc(d.img)}.jpg" alt="${esc(d.p)}" draggable="false"></figure>` : ''}
      <div class="pin-qt"><div class="q-big">وين تقع: <b class="place">${esc(d.p)}</b>؟</div>${d.h ? `<p class="pin-hint" hidden><i>💡</i> ${esc(d.h)}</p>` : ''}</div></div>`;
  }
  // التلميح يظهر إذا انتصف الوقت
  function pinHintTimer(el, c) {
    const h = $('.pin-hint', el); if (!h) return;
    const ms = c.left && c.dl ? Math.max(0, (c.left() - c.dl / 2) * 1000) : 0;
    setTimeout(() => { if (h.isConnected && h.hidden) { h.hidden = false; FX.pop(640); } }, ms);
  }
  function pinReveal(el, c, { done, mine, game } = {}) {
    const M = window.FZ_MAPS[c.d.m], rv = c.rev || {}, truth = rv.k;
    const xy = (lat, lon) => [(lon - M.lon0) * M.kx, (M.lat1 - lat) * M.ky];
    const rows = Object.keys(rv.ans || {}).map((tid) => { const a = rv.ans[tid]; const [lat, lon] = String(a.v).split(',').map(Number); return Object.assign({ tid, lat, lon }, a); })
      .filter((r) => !isNaN(r.lat)).sort((a, b) => b.err - a.err);
    const n = rows.length, myU = mine && mine.unit;
    el.innerHTML = `<div class="pr-rev"><div class="map-wrap pr-map">${game.map(c.d.m)}</div>
      <div class="pr-side"><div class="pr-place">${c.d.img ? `<img src="img/pin/${esc(c.d.img)}.jpg" alt="">` : '<i>📍</i>'}<b>${esc(c.d.p)}</b></div>
      <ol class="pr-list">${n ? '' : '<li class="empty">ما ثبّت أحد دبوسه</li>'}</ol></div></div>`;
    const root = $('.pr-rev', el), svg = $('svg.map', root), g = $('.pins', svg), list = $('.pr-list', root);
    const alive = () => root.isConnected;
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? Math.min(ms, 80) : ms));
    const NS = 'http://www.w3.org/2000/svg';
    let zoom = 1; const marks = [];
    const place = (node, x, y) => { node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${zoom.toFixed(3)})`); };
    const add = (html, x, y) => { const w = document.createElementNS(NS, 'g'); w.innerHTML = html; g.appendChild(w); marks.push([w, x, y]); place(w, x, y); return w; };
    const countKm = (node, to, ms) => new Promise((res) => {
      const t0 = performance.now();
      const step = (now) => { if (!node.isConnected) return res(); const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(2, -10 * p); node.textContent = num(Math.round(to * (p >= 1 ? 1 : e))); if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step); setTimeout(() => { if (node.isConnected) node.textContent = num(Math.round(to)); res(); }, ms + 120);
    });
    (async () => {
      await wait(500); if (!alive() || !truth) return;
      const [tx, ty] = xy(truth[0], truth[1]);
      // النجمة: المكان الصحيح أولًا
      const star = add('<g class="truth-star pr-pop"><circle r="16"/><path d="M0 -11l3.2 6.6 7.3 1-5.3 5.1 1.3 7.2L0 5.5l-6.5 3.4 1.3-7.2-5.3-5.1 7.3-1z"/></g>', tx, ty);
      FX.whistle && FX.whistle(); await wait(900);
      for (let i = 0; i < n && alive(); i++) {
        const r = rows[i], top = n - i <= 3, rank = n - i, me = myU != null && r.tid === myU, col = unitColor(c, r.tid);
        const li = document.createElement('li');
        li.className = `pr-row ${top ? 'top wait' : ''} ${me ? 'me' : ''}`;
        li.innerHTML = `<i class="pr-rk">${ar(rank)}</i>${unitTag(c, r.tid)}<span class="pr-km"><b>؟</b> <small>كم</small></span>${r.ex ? '<em class="exact" hidden>🎯 إصابة!</em>' : ''}<strong hidden>${plus(r.pts)}</strong>`;
        list.prepend(li);
        if (top) { if (rank === 1) FX.play('riser', 0.55); for (let k = 0; k < 5 && alive(); k++) { FX.tick(0.2); await wait(170); } li.classList.remove('wait'); }
        const [x, y] = xy(r.lat, r.lon);
        const ln = document.createElementNS(NS, 'line');
        ln.setAttribute('class', 'dist pr-line'); ln.setAttribute('x1', x); ln.setAttribute('y1', y); ln.setAttribute('x2', tx); ln.setAttribute('y2', ty);
        ln.setAttribute('stroke', col); ln.setAttribute('vector-effect', 'non-scaling-stroke');
        g.insertBefore(ln, g.firstChild);
        add(`<g class="pr-drop">${pinSvg(0, 0, col)}</g>`, x, y);
        FX.pop(top ? 700 : 520);
        await countKm($('.pr-km b', li), r.err, top ? 900 : 450);
        if (!alive()) return;
        $$('[hidden]', li).forEach((x) => { x.hidden = false; });
        if (r.ex) FX.clap(3);
        if (i === n - 1) {
          li.classList.add('win'); li.insertAdjacentHTML('afterbegin', '<span class="pr-crown">👑</span>'); FX.play('stamp', 0.7);
          // تقريب الخريطة على المكان وأقرب دبوس
          const W = Math.max(M.w * 0.22, Math.abs(x - tx) * 2.6, Math.abs(y - ty) * 2.6 * M.w / M.h);
          const H = W * M.h / M.w;
          let vx = Math.min(Math.max(0, (x + tx) / 2 - W / 2), M.w - W), vy = Math.min(Math.max(0, (y + ty) / 2 - H / 2), M.h - H);
          if (W < M.w * 0.98 && !window.FZ.reduced()) {
            const t0 = performance.now(), D = 1300;
            await new Promise((res) => {
              const step = (now) => {
                if (!svg.isConnected) return res();
                const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
                const cw = M.w + (W - M.w) * e, ch = M.h + (H - M.h) * e;
                svg.setAttribute('viewBox', `${(vx * e).toFixed(1)} ${(vy * e).toFixed(1)} ${cw.toFixed(1)} ${ch.toFixed(1)}`);
                zoom = cw / M.w; marks.forEach(([w, mx, my]) => place(w, mx, my));
                if (p < 1) requestAnimationFrame(step); else res();
              };
              requestAnimationFrame(step); setTimeout(res, D + 200);
            });
          }
          FX.clap(5);
          if (myU == null || me) window.FZ.confetti(document.getElementById('confetti'), { count: 110 });
        }
        await wait(top ? 1000 : Math.max(180, 1400 / Math.max(1, n - 3)));
      }
      await wait(800);
      if (alive() && done) done();
    })();
  }

  // ---------- رتّبها صح: بطاقات بإيموجي ومعلومة، نقاط جزئية، وكشف بالتشويق ----------
  const ocP = (x) => { const [t, e = '', f = ''] = String(x).split('|'); return { t, e, f }; };
  const ocIn = (x, fact) => { const o = ocP(x); return `${o.e ? `<em class="oc-e">${o.e}</em>` : ''}<span class="oc-t">${esc(o.t)}${fact && o.f ? `<small class="oc-f">${esc(o.f)}</small>` : ''}</span>`; };
  const ORDER_PART = 15, ORDER_BONUS = 20;
  function orderReveal(el, c, { done, mine } = {}) {
    const rv = c.rev || {}, right = rv.k.right, picks = rv.picks || {}, sc = c.pp || rv.pp || {};
    const myPid = mine && mine.pid;
    const ids = Object.keys(picks).sort((a, b) => (a === myPid ? -1 : b === myPid ? 1 : pname(c.P, a).localeCompare(pname(c.P, b), 'ar')));
    const col = (pid) => (c.P[pid] ? (c.ind ? window.FZ.pcolor(pid) : teamColor(c.T, c.P[pid].t)) : '#888');
    el.innerHTML = `<div class="or-rev"><div class="q-big small">${esc(c.d.t)}</div>
      <ol class="or-slots">${right.map((_, j) => `<li class="or-slot"><div class="or-in"><div class="or-back"><b>${ar(j + 1)}</b><span>؟</span></div><div class="or-front ocard"><i>${ar(j + 1)}</i>${ocIn(c.d.items[right[j]], true)}</div></div></li>`).join('')}</ol>
      <div class="or-board">${ids.length ? ids.map((pid) => `<div class="or-row ${pid === myPid ? 'me' : ''}" data-p="${pid}" style="--tc:${col(pid)}"><span class="tchip" style="--tc:${col(pid)}">${esc(pname(c.P, pid))}</span>${whoTag(c, pid)}
        <span class="or-cells">${right.map(() => '<i></i>').join('')}</span><b class="or-pts">…</b></div>`).join('') : '<p class="dim">ما أرسل أحد</p>'}</div></div>`;
    const root = $('.or-rev', el), slots = $$('.or-slot', root), rows = $$('.or-row', root);
    const alive = () => root.isConnected;
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? Math.min(ms, 80) : ms));
    (async () => {
      await wait(600);
      for (let j = 0; j < right.length && alive(); j++) {
        slots[j].classList.add('shake');
        for (let k = 0; k < 3 && alive(); k++) { FX.tick(0.2); await wait(170); }
        slots[j].classList.remove('shake'); slots[j].classList.add('flip'); FX.play('flip', 0.8, 0.95 + j * 0.04);
        await wait(380);
        let hits = 0;
        rows.forEach((r, i) => {
          const v = String(picks[r.dataset.p] || '').split(',').map(Number), ok = v[j] === right[j];
          if (ok) hits++;
          setTimeout(() => { const cell = $$('.or-cells i', r)[j]; if (cell) cell.className = ok ? 'ok' : 'no'; }, Math.min(i * 40, 600));
        });
        if (hits) FX.tick(0.35);
        await wait(Math.min(rows.length * 40, 600) + 650);
      }
      if (!alive()) return;
      // النقاط وترتيب اللوحة
      const order = ids.slice().sort((a, b) => (sc[b] || 0) - (sc[a] || 0));
      const board = $('.or-board', root);
      order.forEach((pid, i) => {
        const r = rows.find((x) => x.dataset.p === pid); if (!r) return;
        board.appendChild(r);
        const n = (rv.nc || {})[pid] || 0, b = $('.or-pts', r);
        b.innerHTML = n === 4 ? `✨ مثالي ${plus(sc[pid] || 0)}` : plus(sc[pid] || 0);
        r.classList.add(n === 4 ? 'perfect' : n ? 'part' : 'zero');
        r.style.animationDelay = Math.min(i * 60, 500) + 'ms'; r.classList.add('reord');
      });
      const best = order[0];
      if (best && (sc[best] || 0) > 0) {
        const r = rows.find((x) => x.dataset.p === best);
        r.classList.add('win'); r.insertAdjacentHTML('afterbegin', '<span class="pr-crown">👑</span>'); FX.play('stamp', 0.7);
        FX.clap(5);
        if (myPid == null || myPid === best) window.FZ.confetti(document.getElementById('confetti'), { count: 100 });
      }
      await wait(1400);
      if (alive() && done) done();
    })();
  }

  // ---------- الكلمة الدخيلة: صور، جولة صعبة بست كلمات، وكشف بالإقصاء ----------
  const odP = (x) => { const [t, e = ''] = String(x).split('|'); return { t, e }; };
  const odIn = (x) => { const o = odP(x); return `${o.e ? `<em class="od-e">${o.e}</em>` : ''}<span class="od-t">${esc(o.t)}</span>`; };
  const odGrid = (w, extra = '') => `<div class="od-grid n${w.length} ${w.some((x) => odP(x).e) ? 'pics' : ''}">${w.map((x, i) => `<div class="od-tile" data-i="${i}">${odIn(x)}${extra}</div>`).join('')}</div>`;
  function oddReveal(el, c, { done, mine } = {}) {
    const d = c.d, rv = c.rev || {}, ans = rv.k.ans, myPid = mine && mine.pid;
    const counts = {}; Object.values(rv.picks || {}).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    el.innerHTML = `<div class="od-rev">${d.gold ? '<span class="q-gold">🌟 الجولة الذهبية · النقاط دبل</span>' : ''}<div class="q-big small">وش الدخيلة؟</div>
      ${odGrid(d.w, '<b class="od-n"></b>')}<p class="od-why" hidden><i>🔗</i> ${esc(rv.k.why)}</p><div class="rx-ann" aria-live="polite"></div></div>`;
    const root = $('.od-rev', el), tiles = $$('.od-tile', root), ann = $('.rx-ann', root);
    const mineV = myPid != null && rv.picks ? rv.picks[myPid] : undefined;
    if (mineV !== undefined && tiles[mineV]) tiles[mineV].classList.add('mine');
    const alive = () => root.isConnected;
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? Math.min(ms, 80) : ms));
    const cnt = (i) => { const n = counts[i] || 0; const b = $('.od-n', tiles[i]); b.textContent = n ? `${ar(n)} 👆` : '٠'; b.classList.add('on'); };
    (async () => {
      await wait(700);
      // الكلمات الصحيحة تنطفي وحدة وحدة
      const others = window.FZ.shuffle(tiles.map((_, i) => i).filter((i) => i !== ans));
      for (const i of others) {
        if (!alive()) return;
        tiles[i].classList.add('peek'); FX.tick(0.2); await wait(260);
        cnt(i); await wait(360);
        tiles[i].classList.remove('peek'); tiles[i].classList.add('out'); FX.swoosh && FX.swoosh(); await wait(Math.max(220, 1500 / others.length));
      }
      if (!alive()) return;
      // الباقية هي الدخيلة
      tiles[ans].classList.add('peek');
      for (let k = 0; k < 4 && alive(); k++) { FX.tick(0.25); await wait(180); }
      tiles[ans].classList.remove('peek'); tiles[ans].classList.add('is-odd'); cnt(ans); FX.right(); FX.pop(760);
      await wait(600); if (!alive()) return;
      $('.od-why', root).hidden = false;
      await wait(900); if (!alive()) return;
      fastAnnounce(ann, c, rv, ans, myPid);
      await wait(2000);
      if (alive() && done) done();
    })();
  }

  // ---------- أكمل المثل أو البيت: كشف بالإقصاء ثم كتابة التكملة ----------
  const pvLine = (d, fill) => `<span class="q-cat">${esc(d.kd)}</span><blockquote class="verse">${esc(d.t).replace('……', fill != null ? `<mark class="pv-fill">${esc(fill)}</mark>` : '<span class="gap">……</span>').replace(' … ', '<br>')}</blockquote>`;
  function provReveal(el, c, { done, mine } = {}) {
    const d = c.d, rv = c.rev || {}, k = rv.k, ans = rv.ans || {};
    const myU = mine ? mine.unit : null;
    const counts = {}; Object.values(ans).forEach((x) => { counts[x.v] = (counts[x.v] || 0) + 1; });
    const keys = c.ind ? Object.keys(ans).sort((a, b) => (ans[b].ok - ans[a].ok)) : Object.keys(c.T);
    el.innerHTML = `<div class="pv-rev">${pvLine(d, '')}
      <div class="od-grid pv-opts">${d.o.map((o, i) => `<div class="od-tile" data-i="${i}"><span class="od-t">${esc(o)}</span><b class="od-n"></b></div>`).join('')}</div>
      <div class="team-res pv-res">${keys.map((tid, i) => { const a = ans[tid]; return `<span class="tres pv-chip ${a ? (a.ok ? 'ok' : 'no') : 'none'} ${tid === myU ? 'me' : ''}" style="--tc:${unitColor(c, tid)};--d:${Math.min(i, 10)}">${esc(c.ind ? pname(c.P, tid) : teamName(c.T, tid))}<b>${a ? (a.ok ? '✓' : '✗') : '—'}</b>${a && a.fast ? '<em>الأسرع ' + plus(20) + '</em>' : ''}</span>`; }).join('')}</div></div>`;
    const root = $('.pv-rev', el), tiles = $$('.od-tile', root), fill = $('.pv-fill', root), res = $('.pv-res', root);
    if (myU != null && ans[myU] && tiles[ans[myU].v]) tiles[ans[myU].v].classList.add('mine');
    const alive = () => root.isConnected;
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? Math.min(ms, 80) : ms));
    const cnt = (i) => { const n = counts[i] || 0, b = $('.od-n', tiles[i]); b.textContent = n ? `${ar(n)} 👆` : '٠'; b.classList.add('on'); };
    (async () => {
      await wait(700);
      const wrong = window.FZ.shuffle(tiles.map((_, i) => i).filter((i) => i !== k));
      for (const i of wrong) {
        if (!alive()) return;
        tiles[i].classList.add('peek'); FX.tick(0.2); await wait(240);
        cnt(i); await wait(320);
        tiles[i].classList.remove('peek'); tiles[i].classList.add('out'); FX.swoosh(); await wait(380);
      }
      if (!alive()) return;
      tiles[k].classList.add('peek');
      for (let j = 0; j < 3 && alive(); j++) { FX.tick(0.25); await wait(180); }
      tiles[k].classList.remove('peek'); tiles[k].classList.add('is-odd'); cnt(k);
      // كتابة التكملة داخل البيت حرفًا حرفًا
      const word = Array.from(d.o[k]);
      FX.play('write', 0.7);
      fill.classList.add('writing');
      for (let j = 1; j <= word.length && alive(); j++) { fill.textContent = word.slice(0, j).join(''); await wait(60); }
      fill.classList.remove('writing'); fill.classList.add('done');
      await wait(500); if (!alive()) return;
      res.classList.add('show');
      const anyOk = Object.values(ans).some((x) => x.ok);
      if (anyOk) { FX.right(); setTimeout(() => FX.clap(4), 300); } else FX.wrong();
      if (myU != null && ans[myU] && ans[myU].ok) window.FZ.confetti(document.getElementById('confetti'), { count: 70 });
      await wait(1600);
      if (alive() && done) done();
    })();
  }

  // ---------- أسئلة السرعة: الجولة الذهبية والكشف للجميع ----------
  let goldShown = '';
  function goldSplash(key, big, sub = 'سؤال صعب ونقاطه دبل') {
    if (goldShown === key || window.FZ.reduced()) { goldShown = key; return; }
    goldShown = key;
    const ov = document.createElement('div');
    ov.className = 'gold-splash' + (big ? '' : ' small');
    ov.innerHTML = `<div class="gs-box"><i>🌟</i><b>الجولة الذهبية</b><small>${esc(sub)}</small></div>`;
    document.body.appendChild(ov);
    FX.play('wbig', 0.8); FX.whistle && FX.whistle(0.15); setTimeout(() => FX.clap(3), 350);
    setTimeout(() => ov.remove(), 1900);
  }
  function quickReveal(el, c, { done, mine } = {}) {
    const d = c.d, rv = c.rev || {}, ans = (rv.k || {}).correct;
    const counts = {};
    Object.values(rv.picks || {}).forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    el.innerHTML = `<div class="rx-rev">${d.gold ? '<span class="q-gold">🌟 الجولة الذهبية · النقاط دبل</span>' : ''}<div class="q-big small">${esc(d.q)}</div>${mcHost(d.o)}
      ${rv.k && rv.k.cite ? `<p class="cite" hidden>${esc(rv.k.cite)}</p>` : ''}<div class="rx-ann" aria-live="polite"></div></div>`;
    const root = $('.rx-rev', el), ann = $('.rx-ann', root);
    const alive = () => root.isConnected;
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? Math.min(ms, 80) : ms));
    const myPid = mine && mine.pid;
    (async () => {
      await wait(450);
      if (!alive()) return;
      $$('.mc-opt', root).forEach((o, i) => {
        o.classList.add(i === ans ? 'is-right' : 'is-dim');
        if (counts[i]) o.insertAdjacentHTML('beforeend', `<b class="cnt">${ar(counts[i])}</b>`);
        if (myPid != null && rv.picks && rv.picks[myPid] === i && i !== ans) o.classList.add('my-wrong');
      });
      const ct = $('.cite', root); if (ct) ct.hidden = false;
      FX.pop(820);
      await wait(700);
      if (!alive()) return;
      fastAnnounce(ann, c, rv, ans, myPid);
      await wait(1600);
      if (alive() && done) done();
    })();
  }

  // ---------- كم السعر؟ النطاقات والكشف بالدور ----------
  // بالضبط (فرق ≤ ٠٫٥٪) ثم الأحمر (قريب جدًا) ثم الأصفر ثم الأزرق (في المدى)، وخارجها صفر. الصعب نطاقاته أوسع
  const PRICE_BANDS = [{ r: 0.15, y: 0.45, g: 0.9 }, { r: 0.30, y: 0.9, g: 1.5 }];
  const PRICE_EXACT = 0.005;
  const PRICE_PTS = { ex: 150, r: 90, y: 50, g: 20, o: 0 };
  const BAND_TXT = { ex: '🎯 بالضبط', r: 'قريب جدًا', y: 'قريب', g: 'في المدى', o: 'بعيد' };
  const pct = (x) => ar(x >= 0.1 ? Math.round(x * 100) : Math.round(x * 1000) / 10).replace('.', '٫') + '٪';
  const iso = (t) => `\u2066${t}\u2069`;
  const priceArt = (d) => (window.FZ_ART && FZ_ART(d.art || 'tag')) || `<span class="p-emo">${d.e || '🏷️'}</span>`;
  function priceLegend(b) {
    return `<div class="pc-bands"><span class="bd b-ex">🎯 بالضبط <b>${plus(PRICE_PTS.ex)}</b></span><span class="bd b-r">${iso('±' + pct(b.r))} <b>${plus(PRICE_PTS.r)}</b></span><span class="bd b-y">${iso('±' + pct(b.y))} <b>${plus(PRICE_PTS.y)}</b></span>${b.g ? `<span class="bd b-g">${iso('±' + pct(b.g))} <b>${plus(PRICE_PTS.g)}</b></span>` : ''}</div>`;
  }
  function priceCard(d, big = false) {
    const b = d.b || PRICE_BANDS[0];
    return `<div class="pcard ${big ? 'big' : ''}"><div class="pc-art">${priceArt(d)}</div>
      <div class="pc-txt"><b>${esc(d.n)}</b><small>${esc(d.st)}</small></div>
      <div class="pc-tag"><span>؟</span><i>${esc(d.u || 'ريال')}</i></div>${priceLegend(b)}</div>`;
  }
  function priceScore(c) {
    const v = c.k.v, b = c.d.b || PRICE_BANDS[0], tp = {}, ans = {};
    Object.keys(c.A || {}).forEach((pid) => {
      if (!c.P[pid]) return;
      const x = parseFloat(c.A[pid].v);
      if (isNaN(x)) return;
      const se = (x - v) / v, e = Math.abs(se);
      const band = e <= PRICE_EXACT ? 'ex' : e <= b.r ? 'r' : e <= b.y ? 'y' : b.g && e <= b.g ? 'g' : 'o';
      const tid = unitKey(c, pid);
      tp[tid] = PRICE_PTS[band];
      ans[tid] = { v: x, se: Math.round(se * 10000) / 10000, b: band, pts: PRICE_PTS[band], t: c.A[pid].t || 0 };
    });
    return { tp, rev: { k: v, ans } };
  }
  // كشف النتائج: السعر بعدّاد، ثم النطاقات، ثم الإجابات من الأبعد للأقرب (الأقرب ٣ على مهل)
  function priceReveal(el, c, { done, mine } = {}) {
    const d = c.d, b = d.b || PRICE_BANDS[0], v = +c.rev.k, u = d.u || 'ريال';
    const rows = Object.keys(c.rev.ans || {}).map((tid) => Object.assign({ tid }, c.rev.ans[tid]))
      .sort((a, z) => Math.abs(z.se) - Math.abs(a.se) || (z.t || 0) - (a.t || 0));
    const span = (b.g || b.y) * 1.15;
    const pos = (se) => 50 + Math.max(-1, Math.min(1, se / span)) * 46;
    const dec = String(v).includes('.') ? String(v).split('.')[1].length : 0;
    el.innerHTML = `<div class="pr-rev">
      <div class="pr-top"><div class="pr-art">${priceArt(d)}</div><div class="pr-name"><b>${esc(d.n)}</b><small>${esc(d.st)}</small></div></div>
      <div class="pr-truth"><small>${d.est ? 'السعر التقريبي' : 'السعر الحقيقي'}</small><b><span class="odo">${num(0)}</span> <i>${esc(u)}</i></b></div>
      <div class="pr-gauge">${b.g ? `<div class="zone b-g" style="left:${pos(-b.g)}%;right:${100 - pos(b.g)}%"></div>` : ''}<div class="zone b-y" style="left:${pos(-b.y)}%;right:${100 - pos(b.y)}%"></div><div class="zone b-r" style="left:${pos(-b.r)}%;right:${100 - pos(b.r)}%"></div>
        <div class="mid"></div><span class="lab lo">أقل</span><span class="lab hi">أعلى</span><div class="marks"></div></div>
      ${priceLegend(b)}
      <ol class="pr-list"></ol></div>`;
    const root = $('.pr-rev', el), odo = $('.odo', root), list = $('.pr-list', root), marks = $('.marks', root), gauge = $('.pr-gauge', root);
    const alive = () => root.isConnected;
    const fast = window.FZ.reduced();
    const wait = (ms) => new Promise((r) => setTimeout(r, fast ? Math.min(ms, 120) : ms));
    const fmt = (x) => num(dec ? Math.round(x * 10 ** dec) / 10 ** dec : Math.round(x));
    const diffTxt = (r) => (r.se === 0 ? 'بالضبط' : Math.abs(r.se) < 0.01 ? `${r.se > 0 ? 'أعلى' : 'أقل'} بأقل من ${ar(1)}٪` : `${r.se > 0 ? 'أعلى' : 'أقل'} بـ${ar(Math.round(Math.abs(r.se) * 100))}٪`);
    const bandFx = (bd) => { if (bd === 'ex') { FX.clap(5); window.FZ.confetti(document.getElementById('confetti'), { count: 90 }); } else if (bd === 'r') FX.right(); else if (bd === 'y') FX.pop(760); else if (bd === 'g') FX.pop(560); else FX.wrong(); };
    (async () => {
      // ١) العدّاد
      const T0 = performance.now(), dur = fast ? 150 : 1500;
      let lastTick = 0;
      await new Promise((res) => {
        const step = (t) => {
          if (!alive()) return res();
          const p = Math.min(1, (t - T0) / dur), e = 1 - Math.pow(1 - p, 3);
          odo.textContent = fmt(v * e);
          if (t - lastTick > 90 && p < 1) { FX.tick(0.12); lastTick = t; }
          if (p < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
      });
      if (!alive()) return;
      odo.textContent = fmt(v);
      root.classList.add('t-on'); FX.whistle && FX.whistle();
      await wait(700);
      gauge.classList.add('on');
      await wait(600);
      if (!rows.length) { list.innerHTML = '<li class="empty">ما أرسل أحد</li>'; if (done) done(); return; }
      // ٢) الإجابات بالدور
      const n = rows.length, rest = Math.max(0, n - 3);
      const gap = rest > 6 ? Math.max(140, 2600 / rest) : 750;
      for (let i = 0; i < n; i++) {
        if (!alive()) return;
        const r = rows[i], top = n - i <= 3, me = mine != null && String(r.tid) === String(mine);
        const li = document.createElement('li');
        li.className = `pr-row b-${r.b} ${top ? 'top' : ''} ${me ? 'me' : ''}`;
        li.innerHTML = `${top ? `<i class="rk">${ar(n - i)}</i>` : ''}${unitTag(c, r.tid)}<b class="guess">${top ? '؟' : num(r.v)}</b><small>${top ? '…' : diffTxt(r)}</small><em class="band">${top ? '' : BAND_TXT[r.b]}</em><strong>${top ? '' : plus(r.pts)}</strong>`;
        list.prepend(li);
        const mk = document.createElement('i');
        const land = () => {
          mk.className = `mk b-${r.b} ${Math.abs(r.se) > span ? 'edge' : ''} ${me ? 'me' : ''}`;
          mk.style.cssText = `left:${pos(r.se)}%;--c:${unitColor(c, r.tid)}`;
          marks.appendChild(mk);
        };
        if (top) {
          // تشويق: الاسم يظهر والرقم مخفي لحظات
          li.classList.add('wait');
          for (let k = 0; k < 6 && alive(); k++) { FX.tick(0.2); await wait(170); }
          if (!alive()) return;
          li.classList.remove('wait');
          $('.guess', li).textContent = num(r.v); $('small', li).textContent = diffTxt(r);
          $('.band', li).textContent = BAND_TXT[r.b]; $('strong', li).innerHTML = plus(r.pts);
          li.classList.add('flip'); land(); bandFx(r.b);
          await wait(1100);
        } else {
          land();
          if (me) bandFx(r.b); else FX.tick(0.16);
          await wait(gap);
        }
      }
      if (alive() && done) done();
    })();
  }

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
  // ---------- اقتراحات أعضاء الفريق (القائد يعتمد) ----------
  const sgName = (c, pid) => (c.P[pid] ? c.P[pid].n : '—') + (pid === c.me.pid ? ' (أنت)' : '');
  // قائمة الاقتراحات: الأعضاء يشوفون اقتراحات بعض، والقائد يضغط أي اقتراح ليعتمده
  function sgBox(el, c, { fmt, pick }) {
    el.insertAdjacentHTML('beforeend', `<div class="sg-box"><b>💬 اقتراحات الفريق</b><div class="sg-list"></div></div>`);
    const list = $('.sg-list', el.lastElementChild);
    const paint = (sg) => {
      const ids = Object.keys(sg || {}).filter((pid) => pid !== (c.can ? c.me.pid : ''));
      list.innerHTML = ids.length ? ids.map((pid) => `<button type="button" class="sg-chip" data-p="${pid}" style="--tc:${window.FZ.pcolor(pid)}" ${pick ? '' : 'disabled'}><i>${esc(sgName(c, pid))}</i><b>${fmt(sg[pid])}</b></button>`).join('')
        : '<span class="dim">ما وصل اقتراح للحين</span>';
      if (pick) $$('.sg-chip', list).forEach((b) => b.addEventListener('click', () => { pick(sg[b.dataset.p], b.dataset.p); FX.tick(0.25); }));
    };
    paint(c.sugg()); c.onSugg(paint);
    return paint;
  }
  function numPhone(el, c, { unit = '', ph = 'اكتب الرقم', suggest = false } = {}) {
    const sg = suggest && c.suggest, member = sg && !c.can;
    if (!c.can && !member) return;
    const mine = member ? c.sugg()[c.me.pid] : null, locked = c.sent != null;
    const val = locked ? num(+c.sent) : mine != null ? num(+mine) : '';
    const label = member ? (mine != null ? 'غيّر اقتراحك' : 'اقترح على القائد') : sg ? 'اعتماد الإجابة' : 'إرسال';
    el.insertAdjacentHTML('beforeend', `<form class="num-in" autocomplete="off">
      <div class="num-box"><input inputmode="decimal" enterkeyhint="send" placeholder="${member ? 'اقتراحك' : ph}" ${locked ? 'disabled' : ''} value="${esc(val)}"><small>${esc(unit)}</small></div>
      <button class="btn btn-primary tactile" ${locked ? 'disabled' : ''}>${label}</button></form>`);
    const f = $('.num-in', el), inp = $('input', f), btn = $('button', f);
    if (sg) sgBox(el, c, { fmt: (v) => `${num(+v)} <small>${esc(unit)}</small>`, pick: !member && !locked ? (v) => { inp.value = num(+v); inp.classList.remove('bad'); } : null });
    if (!locked && !member) setTimeout(() => inp.focus(), 60);
    inp.addEventListener('input', () => {
      const v = parseNum(inp.value);
      inp.classList.toggle('bad', inp.value.trim() !== '' && v == null);
    });
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = parseNum(inp.value);
      if (v == null || v < 0) { inp.classList.add('bad'); FX.wrong(); return; }
      inp.blur();
      if (member) { btn.disabled = true; c.suggest(String(v)).then(() => { btn.disabled = false; btn.textContent = 'غيّر اقتراحك'; }); return; }
      inp.disabled = true; btn.disabled = true;
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
      rows.push({ tid: unitKey(c, pid), pid, v, err: e, t: c.A[pid].t });
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
      ${unitTag(c, r.tid)}<b class="guess">${fmt(r.v)}</b><small>${errFmt(r)}</small>${r.ex ? '<em class="exact">إصابة!</em>' : ''}<strong>${plus(r.pts)}</strong></li>`).join('')
      || '<li class="empty">ما أرسل أحد</li>'}</ol>`);
    // صوت: طقطقة لكل صف ثم ختم وتصفيق للأقرب
    rows.forEach((r, i) => setTimeout(() => FX.tick(0.15), 120 + i * 80));
    if (rows.length) setTimeout(() => { FX.play('stamp', 0.6); if (rows.some((r) => r.ex)) FX.clap(5); else FX.clap(3); }, 200 + rows.length * 80);
  }

  // نقاط اختيار متعدد للفرق: الصح ١٠٠ وأسرع فريق صح +٢٠
  function teamMC(c) {
    const tp = {}, ans = {};
    let fastest = null;
    Object.keys(c.A || {}).forEach((pid) => {
      const p = c.P[pid]; if (!p) return;
      const v = +c.A[pid].v, ok = v === c.k.correct, tid = unitKey(c, pid);
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
    const keys = c.ind ? Object.keys(c.rev.ans || {}).sort((a, b) => (c.rev.ans[b].ok - c.rev.ans[a].ok)) : Object.keys(c.T);
    el.insertAdjacentHTML('beforeend', mcHost(opts, c.rev.k, counts) + `<div class="team-res">${keys.map((tid) => {
      const a = c.rev.ans[tid];
      return `<span class="tres ${a ? (a.ok ? 'ok' : 'no') : 'none'}" style="--tc:${unitColor(c, tid)}">${esc(c.ind ? pname(c.P, tid) : teamName(c.T, tid))}<b>${a ? (a.ok ? '✓' : '✗') : '—'}</b>${a && a.fast ? '<em>الأسرع ' + plus(20) + '</em>' : ''}</span>`;
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
      ${top.length ? `<ol class="fast-list">${top.map((pid, i) => `<li><i>${ar(i + 1)}</i>${esc(pname(c.P, pid))}${whoTag(c, pid)}<b>${plus(c.pp[pid] || 0)}</b></li>`).join('')}</ol>` : ''}</div>`);
  }

  // =========================================================
  // الفقرات
  // =========================================================
  const GAMES = {

    // ---------- ١) كم السعر؟ ----------
    price: {
      name: 'كم السعر؟', ico: '💰', mode: 'team', rounds: 3, time: 30, anim: true, suggest: true,
      idea: 'خمّنوا السعر، وكل ما قربتوا زادت نقاطكم',
      how: 'تظهر سلعة أو صفقة. كل واحد يقترح سعره من جواله، والقائد يشوف الاقتراحات ويعتمد الرقم. بالضبط ١٥٠، والنطاق الأحمر (قريب جدًا) ٩٠، والأصفر ٥٠، والأزرق (في المدى) ٢٠، واللي برّا النطاقات صفر.',
      howSolo: 'تظهر سلعة أو صفقة، وكل واحد يكتب تقديره من جواله. بالضبط ١٥٠، والنطاق الأحمر (قريب جدًا) ٩٠، والأصفر ٥٠، والأزرق (في المدى) ٢٠، واللي برّا النطاقات صفر.',
      make(c) {
        const mine = (c.cfg.prices || []).map((r) => ({ n: r[0], st: r[1], v: +r[2], e: r[3] || '🏷️', cat: 'mine', lvl: 1, art: 'tag', u: 'ريال' }));
        const it = fromBank(c, 'price', mine);
        const b = PRICE_BANDS[it.lvl === 2 ? 1 : 0];
        return { d: { n: it.n, st: it.st, e: it.e || '🏷️', art: it.art || 'tag', u: it.u || 'ريال', est: it.est ? 1 : 0, b }, k: { v: +it.v } };
      },
      score: (c) => priceScore(c),
      host(el, c) { el.innerHTML = priceCard(c.d, true); },
      reveal(el, c) { priceReveal(el, c, { done: c.done }); },
      phone(el, c) { el.innerHTML = priceCard(c.d); numPhone(el, c, { unit: c.d.u || 'ريال', ph: 'السعر', suggest: true }); },
      phoneRev(el, c) { priceReveal(el, c, { done: c.done, mine: c.me && c.me.unit }); }
    },

    // ---------- ٢) سرعة البديهة ----------
    reflex: {
      name: 'سرعة البديهة', ico: '🎯', mode: 'solo', rounds: 5, time: 8, anim: true,
      idea: 'اضغط المطلوب قبل غيرك',
      how: 'يظهر أمر وفوقه صور أو أشكال أو ألوان، أو صورة تعدّ فيها بسرعة (كم نجمة؟ كم خط؟). اضغط الصحيح بأسرع ما يمكن: الأسرع ياخذ أكثر، والخطأ صفر.',
      make(c) { const seed = c.seed; return { d: { s: seed }, k: { ans: SC.reflex(seed).ans } }; },
      score: (c) => reflexScore(c),
      grid(d, ans = -1, counts = null) {
        const g = SC.reflex(d.s);
        const cells = g.cells.map((cell, i) =>
          `<button class="rx-cell tactile ${g.mode === 'count' ? 'rx-opt' : ''} ${ans === i ? 'is-right' : ans >= 0 ? 'is-dim' : ''}" data-i="${i}">${SC.reflexCell(cell)}${counts ? `<b class="cnt">${ar(counts[i] || 0)}</b>` : ''}</button>`).join('');
        if (g.mode === 'count') return `<div class="rx-cmd">${esc(g.cmd)}</div><div class="rx-field">${SC.reflexField(g)}</div><div class="rx-opts">${cells}</div>`;
        return `<div class="rx-cmd">${esc(g.cmd)}</div><div class="rx-grid ${g.mode === 'image' ? 'rx-img' : ''}">${cells}</div>`;
      },
      host(el, c) { el.innerHTML = this.grid(c.d); $$('.rx-cell', el).forEach((b) => { b.disabled = true; }); },
      reveal(el, c) { reflexReveal(el, c, { done: c.done }); },
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
      phoneRev(el, c) { reflexReveal(el, c, { done: c.done, mine: c.me }); }
    },

    // ---------- ٣) عين الصقر ----------
    hawk: {
      name: 'عين الصقر', ico: '👁️', mode: 'team', rounds: 3, time: 20, view: 8, anim: true,
      idea: 'ركّزوا في الصورة، ثم جاوبوا عن تفاصيلها',
      how: 'تظهر صورة حقيقية (مطبخ، سوق خضار، ملعب، مواقف…) لثوانٍ ثم تختفي، ويأتي سؤال عن تفصيلة فيها. اجمعوا ما لاحظه كل واحد، والقائد يرسل. الصح ١٠٠ والأسرع +٢٠.',
      howSolo: 'تظهر صورة حقيقية لثوانٍ ثم تختفي، ويأتي سؤال عن تفصيلة فيها. كل واحد يجاوب من جواله: الصح ١٠٠ والأسرع بين المصيبين +٢٠.',
      make(c) {
        const it = fromBank(c, 'hawk');
        const r = rng(c.seed);
        const q = it.qs[r.int(0, it.qs.length - 1)];
        const order = r.shuffle(q[1].map((_, i) => i));
        return { d: { img: it.img, t: it.t, w: it.w, h: it.h, q: q[0], opts: order.map((i) => q[1][i]) }, k: { correct: order.indexOf(q[2]), hl: q[3] } };
      },
      score(c) { const r = teamMC(c); r.rev.hl = c.k.hl; return r; },
      host(el, c) {
        el.innerHTML = c.view ? hawkPic(c.d, '<span class="look-tag">ركّزوا! 👁️</span>')
          : `<div class="q-big">${esc(c.d.q)}</div>${mcHost(c.d.opts)}`;
      },
      reveal(el, c) { hawkReveal(el, c, { done: c.done, host: true }); },
      phone(el, c) {
        if (c.view) { el.innerHTML = hawkPic(c.d, '<span class="look-tag">ركّز!</span>'); return; }
        el.innerHTML = `<div class="q-big">${esc(c.d.q)}</div>`;
        mcPhone(el, c.d.opts, c);
      },
      phoneRev(el, c) { hawkReveal(el, c, { done: c.done, mine: c.me }); }
    },

    // ---------- ٤) أسئلة السرعة ----------
    quick: {
      name: 'أسئلة السرعة', ico: '⚡', mode: 'solo', rounds: 5, time: 15, anim: true,
      idea: 'سؤال ثقافي وخيارات، والأسرع يكسب أكثر',
      how: 'سؤال من بنك ديوان (أو من المقدّم) وخياراته على جوالك. الصح يعطيك ٥٠ وحتى ٥٠ زيادة حسب سرعتك. وآخر جولة ذهبية: سؤال صعب ونقاطه دبل.',
      make(c) {
        // آخر جولة: الجولة الذهبية بسؤال صعب ونقاط مضاعفة
        const gold = !!(c.last && c.rounds > 1);
        const q = c.hostQ || (window.AtharQuiz && window.AtharQuiz.next(gold && c.quiz ? Object.assign({}, c.quiz, { levels: [2] }) : c.quiz));
        if (!q) return null;
        return { d: { q: q.q, o: q.opts, cat: q.cat || '', gold: gold ? 1 : 0 }, k: { correct: q.correct, cite: q.cite || '' } };
      },
      score: (c) => reflexScore(c, c.k.correct, c.d.gold ? 2 : 1),
      host(el, c) {
        el.innerHTML = `${c.d.gold ? '<span class="q-gold">🌟 الجولة الذهبية · النقاط دبل</span>' : ''}${c.d.cat ? `<span class="q-cat">${esc(c.d.cat)}</span>` : ''}<div class="q-big ${c.d.gold ? 'gold' : ''}">${esc(c.d.q)}</div>${mcHost(c.d.o)}`;
        if (c.d.gold) goldSplash(c.d.q, true);
      },
      reveal(el, c) { quickReveal(el, c, { done: c.done }); },
      phone(el, c) {
        el.innerHTML = `${c.d.gold ? '<span class="q-gold">🌟 ذهبية · دبل</span>' : ''}<div class="q-big ${c.d.gold ? 'gold' : ''}">${esc(c.d.q)}</div>`;
        mcPhone(el, c.d.o, c);
        if (c.d.gold) goldSplash(c.d.q, false);
      },
      phoneRev(el, c) { quickReveal(el, c, { done: c.done, mine: c.me }); }
    },

    // ---------- ٥) تحدي الرسم ----------
    draw: {
      name: 'تحدي الرسم', ico: '🎨', mode: 'duel', rounds: 1, time: 60, anim: true,
      idea: 'رسّام من كل فريق يقلّد الصورة',
      how: 'يُختار رسّام من كل فريق، وتظهر صورة أصلية (رسمة أو صورة حقيقية). ارسمها بأدق ما تقدر قبل نهاية الوقت، والحَكَم يقارن الألوان والأماكن والعناصر ويعلّق على كل رسمة. الأدق ١٠٠ والثاني ٧٠…',
      howSolo: 'تظهر صورة أصلية (رسمة أو صورة حقيقية)، والكل يرسمها من جواله بأدق ما يقدر قبل نهاية الوقت. الحَكَم يقارن الألوان والأماكن والعناصر ويعلّق على كل رسمة: الأدق ١٠٠ والثاني ٧٠…',
      make(c) { return { d: { s: c.seed }, k: {} }; },
      async score(c) {
        const t = SC.target(c.d.s);
        if (t.img) t.el = await loadImg(t.img);
        const sims = {}, notes = {};
        let by = 'local', aiErr = '';
        const ids = Object.keys(c.A || {});
        // التحكيم بالذكاء إن كان مفعّلًا، وإلا المقارنة الآلية
        if (c.ai && ids.length) {
          try {
            const res = await c.ai.drawings({ title: t.title, target: t, items: ids.map((pid) => ({ id: pid, img: c.A[pid].v })) });
            ids.forEach((pid) => { const r = res[pid]; if (r != null) { sims[pid] = typeof r === 'number' ? r : r.score; if (r.note) notes[pid] = r.note; } });
            if (Object.keys(sims).length) by = 'ai'; else aiErr = 'ما رجعت نتيجة';
          } catch (e) { aiErr = String((e && e.message) || e).slice(0, 260); console.warn('[segal-ai]', aiErr); }
        } else if (ids.length) aiErr = c.ai === null ? 'off' : '';
        for (const pid of ids) {
          if (sims[pid] == null) {
            const img = await loadImg(c.A[pid].v);
            sims[pid] = img && (t.prims || t.el) ? SC.similarity(t, img) : 0;
          }
          if (!notes[pid]) notes[pid] = localNote(sims[pid], c.d.s + pid.length);
        }
        const rows = rankBy(ids.map((pid) => ({ pid, err: -sims[pid] })), 'err');
        const pp = {}, tp = {};
        rows.forEach((r) => { pp[r.pid] = sims[r.pid] > 0 ? (RANK_PTS[r.rank] || 10) : 0; if (!c.ind && c.P[r.pid]) tp[String(c.P[r.pid].t)] = pp[r.pid]; });
        return { pp, tp, rev: { sim: sims, notes, by, aiErr, rank: Object.fromEntries(rows.map((r) => [r.pid, r.rank])) } };
      },
      host(el, c) {
        const t = SC.target(c.d.s);
        el.innerHTML = `<div class="draw-host"><figure class="frame">${t.svg}<figcaption>${esc(t.title)}</figcaption></figure>
          <div class="drawers">${c.ind ? '<span class="drawer all">✏️ الكل يرسم الآن من جواله</span>' : (c.drawers || []).map((pid) => `<span class="drawer ${c.A && c.A[pid] ? 'done' : ''}" style="--tc:${c.P[pid] ? teamColor(c.T, c.P[pid].t) : '#888'}">✏️ ${esc(pname(c.P, pid))}</span>`).join('')}</div></div>`;
      },
      reveal(el, c) { drawReveal(el, c, { done: c.done, imgs: Object.fromEntries(Object.keys(c.A || {}).map((p) => [p, c.A[p].v])) }); },
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
      phoneRev(el, c) { drawReveal(el, c, { done: c.done, mine: c.me, load: c.loadA }); }
    },

    // ---------- ٦) قرّب من الرقم ----------
    number: {
      name: 'قرّب من الرقم', ico: '🔢', mode: 'team', rounds: 3, time: 25, suggest: true,
      idea: 'قدّروا الرقم أو الإحصائية',
      how: 'سؤال جوابه رقم (عدد، مسافة، سنة…). كل واحد يقترح رقمه من جواله، والقائد يشوف الاقتراحات ويعتمد التقدير النهائي، والأقرب يكسب أكثر.',
      howSolo: 'سؤال جوابه رقم (عدد، مسافة، سنة…). كل واحد يرسل تقديره، والأقرب يكسب أكثر.',
      make(c) {
        const mine = (c.cfg.numbers || []).map((r) => ({ q: r[0], v: +r[1], u: r[2] || '', cat: 'mine', lvl: 1 }));
        const it = fromBank(c, 'number', mine);
        return { d: { q: it.q, u: it.u || '' }, k: { v: +it.v } };
      },
      score: (c) => closeness(c, c.k.v, (v) => { const x = parseFloat(v); return isNaN(x) ? null : Math.abs(x - c.k.v) / Math.max(Math.abs(c.k.v), 1e-9); }, (e) => e <= 0.005),
      host(el, c) { el.innerHTML = `<div class="q-big">${esc(c.d.q)}</div><div class="unit-tag">الإجابة بـ «${esc(c.d.u)}»</div>`; },
      reveal(el, c) {
        el.innerHTML = `<div class="q-big small">${esc(c.d.q)}</div><div class="truth"><small>الإجابة</small><b>${num(c.rev.k)} <i>${esc(c.d.u)}</i></b></div>`;
        closenessReveal(el, c, (v) => num(+v), (r) => `فرق ${num(Math.round(r.err * 100))}٪`);
      },
      phone(el, c) { el.innerHTML = `<div class="q-big">${esc(c.d.q)}</div>`; numPhone(el, c, { unit: c.d.u, ph: 'تقديركم', suggest: true }); },
      phoneRev(el, c) { el.innerHTML = `<div class="q-big small">${esc(c.d.q)}</div><div class="truth"><small>الإجابة</small><b>${num(c.rev.k)} <i>${esc(c.d.u)}</i></b></div>`; }
    },

    // ---------- ٧) أدق وصف ----------
    describe: {
      name: 'أدق وصف', ico: '🖼️', mode: 'solo', rounds: 1, time: 60, anim: true,
      idea: 'صف الصورة كتابةً بكل تفاصيلها',
      how: 'تظهر صورة حقيقية أو مشهد مرسوم، واكتب وصفًا شاملًا: العناصر وأعدادها وألوانها والخلفية. كل تفصيلة صحيحة تزيد نقاطك، والوصف الأدق يكسب.',
      make(c) {
        // نصف الجولات صورة حقيقية، والباقي مشهد مرسوم
        const photos = C.desc || [];
        if (photos.length && rng(c.seed ^ 0x5bd1e995)() < 0.5) return { d: { p: c.pick('desc', photos)[0] }, k: {} };
        return { d: { s: c.seed }, k: {} };
      },
      async score(c) {
        const pic = descPic(c.d);
        const pp = {}, hits = {}, notes = {};
        let by = 'local', aiErr = '';
        const ids = Object.keys(c.A || {});
        if (c.ai && ids.length) {
          try {
            const scene = pic.photo ? { img: pic.img, facts: pic.facts } : pic.scene;
            const res = await c.ai.descriptions({ scene, items: ids.map((pid) => ({ id: pid, text: c.A[pid].v })) });
            ids.forEach((pid) => { if (res[pid]) { pp[pid] = res[pid].score; hits[pid] = res[pid].hits || []; if (res[pid].note) notes[pid] = res[pid].note; } });
            if (Object.keys(pp).length) by = 'ai'; else aiErr = 'ما رجعت نتيجة';
          } catch (e) { aiErr = String((e && e.message) || e).slice(0, 260); console.warn('[segal-ai]', aiErr); }
        } else if (ids.length) aiErr = c.ai === null ? 'off' : '';
        ids.forEach((pid, i) => {
          if (pp[pid] == null) {
            const r = pic.photo ? descPhotoScore(c.A[pid].v, pic.facts) : SC.describeScore(c.A[pid].v, pic.facts);
            pp[pid] = r.score; hits[pid] = r.hits;
          }
          if (!notes[pid]) notes[pid] = descNote(pp[pid], (c.d.s || c.d.p || 7) * 31 + i);
        });
        const sc = Object.assign({}, pp);
        const top = ids.slice().sort((a, b) => pp[b] - pp[a]).slice(0, 3);
        return { pp, rev: { sc, hits, notes, top, by, aiErr } };
      },
      host(el, c) { const p = descPic(c.d); el.innerHTML = `<div class="scene-wrap big ${p.photo ? 'photo' : ''}">${p.svg}</div>`; },
      reveal(el, c) { descReveal(el, c, { done: c.done, texts: Object.fromEntries(Object.keys(c.A || {}).map((p) => [p, c.A[p].v])) }); },
      phone(el, c) {
        const p = descPic(c.d);
        el.innerHTML = `<div class="scene-wrap ${p.photo ? 'photo' : ''}">${p.svg}</div>`;
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
      phoneRev(el, c) { descReveal(el, c, { done: c.done, mine: c.me, load: c.loadA }); }
    },

    // ---------- ٨) ثبّت الدبوس ----------
    pin: {
      name: 'ثبّت الدبوس', ico: '📍', mode: 'team', rounds: 3, time: 25, anim: true, suggest: true,
      idea: 'حدّدوا المكان على الخريطة',
      how: 'تظهر خريطة واسم مكان (وأحيانًا صورته)، وفي نص الوقت يظهر تلميح. كل واحد يقترح مكانه على الخريطة، والقائد يشوف دبابيس فريقه ويعتمد الدبوس النهائي، والأقرب بالكيلومترات يكسب أكثر، والإصابة الدقيقة +٣٠.',
      howSolo: 'تظهر خريطة واسم مكان (وأحيانًا صورته)، وفي نص الوقت يظهر تلميح. كل واحد يضع دبوسه من جواله، والأقرب بالكيلومترات يكسب أكثر، والإصابة الدقيقة +٣٠.',
      make(c) {
        const it = fromBank(c, 'pin');
        return { d: { m: it.cat, p: it.p, h: it.h || '', img: it.img || '' }, k: { lat: it.lat, lon: it.lon } };
      },
      score(c) {
        const ex = { sa: 25, arab: 80, world: 150 }[c.d.m] || 80;
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
      host(el, c) { el.innerHTML = `${pinHead(c)}<div class="map-wrap">${this.map(c.d.m)}</div>`; pinHintTimer(el, c); },
      reveal(el, c) { pinReveal(el, c, { done: c.done, game: this }); },
      phone(el, c) {
        const M = window.FZ_MAPS[c.d.m], NS = 'http://www.w3.org/2000/svg';
        const sg = !!c.suggest, member = sg && !c.can, locked = c.sent != null;
        const ll = (v) => { const [lat, lon] = String(v).split(',').map(Number); return isNaN(lat) || isNaN(lon) ? null : { lat, lon }; };
        const xy = (p) => [(p.lon - M.lon0) * M.kx, (M.lat1 - p.lat) * M.ky];
        el.innerHTML = `${pinHead(c)}<div class="map-wrap tap">${this.map(c.d.m, locked ? [Object.assign(ll(c.sent), { c: c.me.color })] : [])}</div>`;
        pinHintTimer(el, c);
        const svg = $('svg.map', el), g = $('.pins', svg);
        let cur = member ? ll(c.sugg()[c.me.pid] || '') : null, btn = null;
        const drawMine = () => { if (!cur) return; const [x, y] = xy(cur); g.innerHTML = pinSvg(x, y, member ? window.FZ.pcolor(c.me.pid) : c.me.color, true); };
        if (cur) drawMine();
        if ((c.can || member) && !locked) {
          el.insertAdjacentHTML('beforeend', `<button class="btn btn-primary tactile pin-send" ${cur ? '' : 'disabled'}>${member ? (cur ? 'غيّر اقتراحك' : 'اقترح هذا المكان') : sg ? 'اعتمد هذا الدبوس' : 'ثبّت الدبوس هنا'}</button>
            <p class="hint">${member ? 'اضغط على الخريطة واقترح مكانك، والقائد يشوف دبوسك ويعتمد' : sg ? 'دبابيس فريقك ظاهرة على الخريطة؛ اضغط أي مكان أو اقتراح ثم اعتمد' : 'اضغط على الخريطة لتحديد المكان، وتقدر تعدّله قبل التثبيت'}</p>`);
          btn = $('.pin-send', el);
          svg.addEventListener('pointerdown', (e) => {
            const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
            const p = pt.matrixTransform(svg.getScreenCTM().inverse());
            cur = { lat: M.lat1 - p.y / M.ky, lon: M.lon0 + p.x / M.kx };
            drawMine(); btn.disabled = false; FX.tick(0.2);
          });
          btn.addEventListener('click', () => {
            if (!cur) return;
            const v = `${cur.lat.toFixed(3)},${cur.lon.toFixed(3)}`;
            btn.disabled = true;
            if (member) { c.suggest(v).then(() => { btn.disabled = false; btn.textContent = 'غيّر اقتراحك'; }); return; }
            c.submit(v);
          });
        }
        if (!sg) return;
        // دبابيس اقتراحات الفريق على الخريطة
        const layer = document.createElementNS(NS, 'g'); layer.setAttribute('class', 'sg-pins'); svg.insertBefore(layer, g);
        const r = M.w * 0.016, fs = M.w * 0.034;
        const paintMap = (all) => {
          layer.innerHTML = Object.keys(all || {}).filter((pid) => pid !== c.me.pid).map((pid) => {
            const p = ll(all[pid]); if (!p) return '';
            const [x, y] = xy(p);
            return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g class="sg-pin"><circle r="${r}" fill="${window.FZ.pcolor(pid)}" stroke-width="${(r * 0.35).toFixed(1)}"/><text y="${(-r * 1.7).toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="middle">${esc(c.P[pid] ? c.P[pid].n : '')}</text></g></g>`;
          }).join('');
        };
        paintMap(c.sugg()); c.onSugg(paintMap);
        sgBox(el, c, { fmt: () => '📍', pick: !member && !locked ? (v) => { const p = ll(v); if (!p) return; cur = p; drawMine(); if (btn) btn.disabled = false; } : null });
      },
      phoneRev(el, c) { pinReveal(el, c, { done: c.done, mine: c.me, game: this }); }
    },

    // ---------- ٩) رتّبها صح ----------
    order: {
      name: 'رتّبها صح', ico: '📶', mode: 'solo', rounds: 4, time: 15, anim: true,
      idea: 'رتّب البطاقات حسب المعيار',
      how: 'تظهر ٤ بطاقات بترتيب عشوائي ومعيار (من الأقدم للأحدث، من الأثقل للأخف…). اسحبها للترتيب الصحيح من الأعلى للأسفل واضغط تأكيد. كل بطاقة في مكانها الصحيح ١٥ نقطة، والترتيب الكامل من ٧٠ إلى ١٢٠ حسب سرعتك.',
      make(c) {
        const it = fromBank(c, 'order');
        let order = window.FZ.shuffle([0, 1, 2, 3]);
        if (order.every((v, i) => v === i)) order = [1, 0, 3, 2];
        return { d: { t: it.t, items: order.map((i) => it.items[i]) }, k: { right: order.map((_, j) => order.indexOf(j)) } };
      },
      score(c) {
        const pp = {}, picks = {}, nc = {}, right = c.k.right;
        let perfect = 0;
        Object.keys(c.A || {}).forEach((pid) => {
          const v = String(c.A[pid].v), a = v.split(',').map(Number);
          const n = right.filter((x, j) => a[j] === x).length;
          picks[pid] = v; nc[pid] = n;
          pp[pid] = n === right.length ? window.FZ.speedPts(c.A[pid].t, c.at, c.dl) + ORDER_BONUS : n * ORDER_PART;
          if (n === right.length) perfect++;
        });
        return { pp, rev: { k: c.k, picks, nc, right: perfect, n: Object.keys(picks).length } };
      },
      host(el, c) { el.innerHTML = `<div class="q-big">${esc(c.d.t)}</div><ol class="cards-row">${c.d.items.map((x) => `<li class="ocard">${ocIn(x)}</li>`).join('')}</ol>`; },
      reveal(el, c) { orderReveal(el, c, { done: c.done }); },
      phone(el, c) {
        el.innerHTML = `<div class="q-big">${esc(c.d.t)}</div><p class="hint">الأول فوق ⬆️ — اسحب البطاقة أو استخدم الأسهم</p>`;
        let cur = c.sent != null ? c.sent.split(',').map(Number) : [0, 1, 2, 3];
        el.insertAdjacentHTML('beforeend', `<ol class="sorter"></ol><button class="btn btn-primary tactile order-send">تأكيد الترتيب</button>`);
        const ol = $('.sorter', el), btn = $('.order-send', el);
        const locked = c.sent != null;
        btn.disabled = locked;
        const draw = () => {
          ol.innerHTML = cur.map((i, j) => `<li class="ocard tactile" data-j="${j}"><i>${ar(j + 1)}</i>${ocIn(c.d.items[i])}${locked ? '' : `<button class="up" aria-label="لأعلى" ${j === 0 ? 'disabled' : ''}>▲</button><button class="dn" aria-label="لأسفل" ${j === 3 ? 'disabled' : ''}>▼</button>`}</li>`).join('');
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
      phoneRev(el, c) { orderReveal(el, c, { done: c.done, mine: c.me }); }
    },

    // ---------- ١٠) الكلمة الدخيلة ----------
    odd: {
      name: 'الكلمة الدخيلة', ico: '🚫', mode: 'solo', rounds: 5, time: 10, anim: true,
      idea: 'اكتشف الكلمة أو الصورة اللي ما تنتمي للباقي',
      how: 'تظهر ٤ كلمات أو صور يجمعها رابط خفي إلا واحدة. اضغط الدخيلة بأسرع ما يمكن، والخطأ صفر. وآخر جولة ذهبية: ٦ كلمات صعبة ونقاطها دبل.',
      make(c) {
        const gold = !!(c.last && c.rounds > 1);
        let it;
        if (gold) { const six = C.BANK.odd.items.filter((x) => x.six); it = c.pick('odd', six, () => true)[1]; }
        else it = fromBank(c, 'odd', [], (x) => !x.six);
        const order = window.FZ.shuffle(it.w.map((_, i) => i));
        return { d: { w: order.map((i) => it.w[i]), gold }, k: { ans: order.indexOf(it.ans), why: it.why } };
      },
      score: (c) => reflexScore(c, c.k.ans, c.d.gold ? 2 : 1),
      host(el, c) {
        el.innerHTML = `${c.d.gold ? '<span class="q-gold">🌟 الجولة الذهبية · النقاط دبل</span>' : ''}<div class="q-big ${c.d.gold ? 'gold' : ''}">وش الدخيلة؟</div>${odGrid(c.d.w)}`;
        if (c.d.gold) goldSplash('odd' + c.d.w.join(), true, '٦ كلمات صعبة ونقاطها دبل');
      },
      reveal(el, c) { oddReveal(el, c, { done: c.done }); },
      phone(el, c) {
        el.innerHTML = `${c.d.gold ? '<span class="q-gold">🌟 ذهبية · دبل</span>' : ''}<div class="q-big ${c.d.gold ? 'gold' : ''}">وش الدخيلة؟</div>${odGrid(c.d.w)}`;
        if (c.d.gold) goldSplash('odd' + c.d.w.join(), false, '٦ كلمات صعبة ونقاطها دبل');
        const tiles = $$('.od-tile', el), lock = !c.can || c.sent != null;
        tiles.forEach((t) => {
          t.classList.add('tactile'); t.setAttribute('role', 'button'); t.tabIndex = 0;
          if (c.sent != null && +c.sent === +t.dataset.i) t.classList.add('picked');
          if (lock) { t.classList.add('off'); return; }
          t.addEventListener('click', () => {
            if (t.closest('.od-grid').classList.contains('done')) return;
            t.closest('.od-grid').classList.add('done'); t.classList.add('picked'); tiles.forEach((x) => x.classList.add('off'));
            FX.tick(0.25); c.submit(String(t.dataset.i));
          });
        });
      },
      phoneRev(el, c) { oddReveal(el, c, { done: c.done, mine: c.me }); }
    },

    // ---------- ١١) أكمِل المثل أو البيت ----------
    proverb: {
      name: 'أكمِل المثل', ico: '✍️', mode: 'team', rounds: 4, time: 25, anim: true,
      idea: 'أكملوا المثل أو بيت الشعر (من الجاهلية إلى العصر الحديث)',
      how: 'يظهر مثل أو بيت شعر (فصيح ونبطي) ناقص آخره. تشاوروا ٢٥ ثانية، والقائد يختار التكملة. الصح ١٠٠، ولو أصاب أكثر من فريق فالأسرع +٢٠.',
      howSolo: 'يظهر مثل أو بيت شعر ناقص آخره، وكل واحد يختار التكملة من جواله. الصح ١٠٠، والأسرع بين المصيبين +٢٠.',
      make(c) {
        const it = fromBank(c, 'proverb');
        const opts = window.FZ.shuffle([it.a, ...it.o]);
        return { d: { kd: it.kd, t: it.t, o: opts }, k: { correct: opts.indexOf(it.a) } };
      },
      score: (c) => teamMC(c),
      line: (d, fill) => pvLine(d, fill),
      host(el, c) { el.innerHTML = pvLine(c.d) + mcHost(c.d.o); },
      reveal(el, c) { provReveal(el, c, { done: c.done }); },
      phone(el, c) { el.innerHTML = pvLine(c.d); mcPhone(el, c.d.o, c); },
      phoneRev(el, c) { provReveal(el, c, { done: c.done, mine: c.me }); }
    },

    // ---------- ١٢) الألغام ----------
    mines: {
      name: 'الألغام', ico: '💣', mode: 'mines', rounds: 2, time: 12, place: 15,
      idea: 'خبّوا لغمكم، وافتحوا الخانات بالدور',
      how: 'لوحة ٤×٤: كل فريق (قائده) يخبّي لغمًا في خانة سرًا. بعدها بالدور كل واحد يفتح خانة: الآمنة +١٠ لرصيد الجولة، واللي ينفجر عليه لغم يخسر رصيد الجولة ويطلع منها. اللي يصمد يحفظ رصيده.',
      howSolo: 'لوحة: كل مشارك يخبّي لغمًا في خانة سرًا. بعدها بالدور كل واحد يفتح خانة: الآمنة +١٠ لرصيد الجولة، واللي ينفجر عليه لغم يخسر رصيد الجولة ويطلع منها. اللي يصمد يحفظ رصيده.'
    }
  };

  // ---------- لوحة الرسم ----------
  const PAD = `<div class="pad">
    <canvas class="pad-c" width="600" height="450" aria-label="لوحة الرسم"></canvas>
    <div class="pad-tools">
      <div class="swatches">${['#FFFFFF', '#1d1d1d', '#8FD3F7', '#1E6FE0', '#1B2A6B', '#2E9E5B', '#6CC070', '#FFD34D', '#F59E0B', '#F2683C', '#D94841', '#8B5A2B', '#F2D38B', '#7D8597', '#E0559B', '#8257E5']
      .map((c, i) => `<button class="sw ${i === 1 ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="لون"></button>`).join('')}</div>
      <div class="pad-row">
        <button class="tool on" data-t="pen" aria-label="قلم">✏️</button>
        <button class="tool" data-t="erase" aria-label="ممحاة">🧽</button>
        <button class="tool" data-t="fill" aria-label="تعبئة">🪣</button>
        <button class="tool size" data-s="1" aria-label="سماكة القلم"><i></i></button>
        <button class="tool" data-a="undo" aria-label="تراجع" disabled>↩️</button>
        <button class="tool" data-a="redo" aria-label="إعادة" disabled>↪️</button>
        <button class="tool" data-a="clear" aria-label="مسح الكل">🗑️</button>
      </div>
      <button class="btn btn-primary tactile pad-send">إرسال الرسمة</button>
    </div></div>`;
  function drawPad(el, c) {
    const cv = $('.pad-c', el), x = cv.getContext('2d', { willReadFrequently: true });
    const W = cv.width, H = cv.height;
    const SIZES = [6, 16, 34];
    let color = '#1d1d1d', tool = 'pen', size = 1, hist = [], redo = [];
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    x.lineCap = 'round'; x.lineJoin = 'round';
    const bU = $('[data-a="undo"]', el), bR = $('[data-a="redo"]', el), bS = $('.tool.size', el);
    const sync = () => {
      bU.disabled = !hist.length; bR.disabled = !redo.length;
      const d = $('i', bS); d.style.width = d.style.height = [8, 14, 22][size] + 'px';
      d.style.background = tool === 'erase' ? '#fff' : color; d.style.border = tool === 'erase' ? '2px dashed #999' : '2px solid rgba(0,0,0,.25)';
    };
    // قبل أي تغيير نحفظ اللوحة، وأي رسم جديد يمسح «الإعادة»
    const snap = () => { hist.push(x.getImageData(0, 0, W, H)); if (hist.length > 30) hist.shift(); redo = []; sync(); };
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    let last = null;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      const [px, py] = pos(e);
      snap();
      if (tool === 'fill') { flood(x, px | 0, py | 0, color, W, H); FX.pop(380); return; }
      last = [px, py];
      const ink = tool === 'erase' ? '#FFFFFF' : color;
      x.strokeStyle = ink; x.lineWidth = SIZES[size] * (tool === 'erase' ? 1.6 : 1);
      x.beginPath(); x.arc(px, py, x.lineWidth / 2, 0, Math.PI * 2); x.fillStyle = ink; x.fill();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!last) return;
      const [px, py] = pos(e);
      x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(px, py); x.stroke(); last = [px, py];
    });
    const up = () => { last = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    $$('.sw', el).forEach((b) => b.addEventListener('click', () => {
      color = b.dataset.c; $$('.sw', el).forEach((s) => s.classList.toggle('on', s === b)); FX.tick(0.12);
      if (tool === 'erase') { tool = 'pen'; $$('.tool[data-t]', el).forEach((s) => s.classList.toggle('on', s.dataset.t === 'pen')); }
      sync();
    }));
    $$('.tool[data-t]', el).forEach((b) => b.addEventListener('click', () => { tool = b.dataset.t; $$('.tool[data-t]', el).forEach((s) => s.classList.toggle('on', s === b)); FX.tick(0.12); sync(); }));
    bS.addEventListener('click', () => { size = (size + 1) % 3; bS.dataset.s = size; FX.tick(0.12); sync(); });
    bU.addEventListener('click', () => { const h = hist.pop(); if (!h) return; redo.push(x.getImageData(0, 0, W, H)); x.putImageData(h, 0, 0); FX.tick(0.15); sync(); });
    bR.addEventListener('click', () => { const h = redo.pop(); if (!h) return; hist.push(x.getImageData(0, 0, W, H)); x.putImageData(h, 0, 0); FX.tick(0.15); sync(); });
    $('[data-a="clear"]', el).addEventListener('click', () => { snap(); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); });
    sync();
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
  function minesBoard(st, { mark = -1, tap = false, bombs = null, T = {}, owners = null, pick = -1 } = {}) {
    const n = st.n;
    let h = `<div class="mines" style="--n:${n}">`;
    for (let i = 0; i < n * n; i++) {
      const r = st.rev && st.rev[i];
      const own = owners && owners[i];
      const cls = (r === 'ok' ? 'safe' : r ? 'boom' : bombs && bombs[i] ? 'bomb-show' : '') + (i === pick ? ' picking' : '');
      h += `<button class="mcell tactile ${cls} ${i === mark ? 'mine-mark' : ''}" data-i="${i}" ${!tap || r || i === mark ? 'disabled' : ''}>${r === 'ok' ? '✓' : r ? '💥' : bombs && bombs[i] ? '💣' : i === mark ? '💣' : ''}${own ? `<span class="owners">${own.map((tid) => `<i style="background:${String(tid).startsWith('#') ? tid : teamColor(T, tid)}"></i>`).join('')}</span>` : ''}</button>`;
    }
    return h + '</div>';
  }

  // مؤثرات خانة اللغم: انفجار (وميض، موجة، شظايا، دخان، اهتزاز) أو نجاة (حلقة خضراء و+١٠)
  function minesFx(board, cell, kind, { big = false } = {}) {
    if (!board) return;
    const b = board.querySelector(`.mcell[data-i="${cell}"]`); if (!b) return;
    const box = document.createElement('div');
    box.className = `mx-fx ${kind} ${big ? 'big' : ''}`;
    if (kind === 'boom') {
      let parts = '<i class="fx-flash"></i><i class="fx-ring"></i><i class="fx-ring r2"></i><i class="fx-smoke"></i>';
      for (let k = 0; k < 14; k++) { const a = (k / 14) * 360 + Math.random() * 18, d = 60 + Math.random() * 70; parts += `<i class="fx-shard" style="--a:${a.toFixed(0)}deg;--d:${d.toFixed(0)}px;--s:${(0.6 + Math.random() * 0.8).toFixed(2)}"></i>`; }
      box.innerHTML = parts + '<b class="fx-emo">💥</b>';
      board.classList.remove('shake-hard'); void board.offsetWidth; board.classList.add('shake-hard');
      if (big && !window.FZ.reduced()) { const fl = document.createElement('div'); fl.className = 'mx-screen-flash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 700); }
    } else box.innerHTML = '<i class="fx-ring ok"></i><b class="fx-plus">+١٠</b>';
    b.appendChild(box);
    setTimeout(() => box.remove(), 1800);
  }
  // نهاية جولة الألغام: كشف الألغام واحدًا واحدًا مع أصحابها
  async function minesEndAnim(board, { bombs = {}, owners = {}, T = {} } = {}) {
    if (!board) return;
    const cells = [...new Set(Object.values(bombs))];
    const wait = (ms) => new Promise((r) => setTimeout(r, window.FZ.reduced() ? 40 : ms));
    await wait(500);
    for (const cell of cells) {
      if (!board.isConnected) return;
      const b = board.querySelector(`.mcell[data-i="${cell}"]`); if (!b) continue;
      if (!b.classList.contains('boom')) { b.classList.add('bomb-show', 'pop-bomb'); b.textContent = '💣'; }
      const own = owners[cell];
      if (own) b.insertAdjacentHTML('beforeend', `<span class="owners">${own.map((tid) => `<i style="background:${String(tid).startsWith('#') ? tid : teamColor(T, tid)}"></i>`).join('')}</span>`);
      FX.play('boom', 0.25, 1.4); FX.tick(0.2);
      await wait(Math.max(260, 1800 / cells.length));
    }
    await wait(400);
  }

  const ORDER = ['price', 'reflex', 'hawk', 'quick', 'draw', 'number', 'describe', 'pin', 'order', 'odd', 'proverb', 'mines'];
  // نظام الفقرة الفعلي: في اللعب الفردي كل الفقرات فردية (والألغام لكل مشارك)
  const howOf = (g, ind) => (ind && g.howSolo ? g.howSolo : g.how);
  const modeLabel = (g, ind) => (ind ? (g.mode === 'mines' ? 'بالدور — لغم لكل مشارك' : g.mode === 'duel' ? 'فردي — الكل يرسم' : MODE_LABEL.solo) : MODE_LABEL[g.mode]);
  const effMode = (g, ind) => (ind ? (g.mode === 'mines' ? 'mines' : 'solo') : g.mode);
  const MODE_LABEL = { team: 'جماعي — القائد يرسل', solo: 'فردي — الكل من جواله', duel: 'مواجهة — رسّام من كل فريق', mines: 'بالدور — لغم لكل فريق' };
  // فقرات لها بنك محتوى يُستعرض ويُصفّى
  const BANKED = ['price', 'hawk', 'number', 'order', 'odd', 'proverb', 'pin'];
  return { GAMES, ORDER, BANKED, MODE_LABEL, effMode, howOf, modeLabel, minesBoard, minesFx, minesEndAnim, pinSvg, tag, teamColor, teamName, pname, mcHost };
})();
