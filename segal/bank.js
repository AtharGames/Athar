/* =========================================================
   سِجَال | الحصالة (لعب الفرق)
   كل جولة تنصب نقاط الفرق في حصالة واحدة، والفريق الأعلى يكسرها:
     فرق كبير جدًا (٥٠٪ فأكثر عن الثاني) ← الحصالة كاملة
     فرق متوسط (٢٥–٥٠٪) ← ثلاثة أرباعها
     فرق بسيط (أقل من ٢٥٪) ← نصها، والباقي يبقى للجولة الجاية
     تعادل ← ما تنكسر وتكبر للجولة الجاية. وفي آخر جولة بالعرض تنكسر كاملة
   الخاسر ما ياخذ شي من الجولة.
     FZ_BANK.compute(raw, ids, carry, last) ← { final, info }
     FZ_BANK.show({ info, T, me, done })     ← عرض متحرك فوق الصفحة
   ========================================================= */
window.FZ_BANK = (() => {
  'use strict';
  const F = () => window.FZ;
  const TIERS = {
    big: { pct: 1, t: 'فرق كبير جدًا!', s: 'كسروها وأخذوها كاملة' },
    mid: { pct: 0.75, t: 'فرق متوسط', s: 'أخذوا ثلاثة أرباع الحصالة' },
    close: { pct: 0.5, t: 'فرق بسيط', s: 'أخذوا نصها، والباقي يبقى للجولة الجاية' },
    split: { pct: 1, t: 'تعادل في آخر جولة', s: 'تقاسموا الحصالة' }
  };

  // ---------- الحساب (يستخدمه المقدّم فقط) ----------
  function compute(raw, ids, carry = 0, last = false) {
    const r = {}; ids.forEach((t) => { r[t] = Math.max(0, Math.round(raw[t] || 0)); });
    const sum = ids.reduce((s, t) => s + r[t], 0), pot = sum + (carry || 0);
    const order = ids.slice().sort((a, b) => r[b] - r[a]);
    const top = r[order[0]] || 0, sec = ids.length > 1 ? r[order[1]] : 0;
    const final = {}; ids.forEach((t) => { final[t] = 0; });
    const info = { raw: r, ids, carry: carry || 0, sum, pot, wins: [], take: {}, tier: 'none', pct: 0, left: pot, last: !!last };
    if (pot <= 0 || top <= 0) return { final, info };
    if (top === sec) {
      const tied = ids.filter((t) => r[t] === top);
      if (!last) { info.tier = 'tie'; return { final, info }; }
      const each = Math.floor(pot / tied.length);
      tied.forEach((t) => { final[t] = each; info.take[t] = each; });
      Object.assign(info, { wins: tied, tier: 'split', pct: 1, left: pot - each * tied.length });
      return { final, info };
    }
    const gap = (top - sec) / top;
    const tier = gap >= 0.5 ? 'big' : gap >= 0.25 ? 'mid' : 'close';
    const pct = last ? 1 : TIERS[tier].pct;
    const take = Math.round(pot * pct);
    final[order[0]] = take; info.take[order[0]] = take;
    Object.assign(info, { wins: [order[0]], tier, pct, left: pot - take, gap: Math.round(gap * 100) / 100 });
    return { final, info };
  }

  // ---------- الأصوات (من مكتبة موشن خام) ----------
  const SND = {};
  ['coin1', 'coin2', 'hit', 'smash', 'whoosh', 'pop'].forEach((k) => { try { SND[k] = new Audio('sounds/' + k + '.mp3'); SND[k].preload = 'auto'; } catch (e) { /* بلا صوت */ } });
  let lastCoin = 0;
  function play(k, vol = 0.9) {
    const S = F().S;
    if (!S || !S.on || !SND[k]) return;
    if (k.startsWith('coin')) { const t = performance.now(); if (t - lastCoin < 45) return; lastCoin = t; }
    try { const a = SND[k].cloneNode(); a.volume = vol; a.play().catch(() => {}); } catch (e) { /* */ }
  }

  // ---------- الرسومات ----------
  const PIG = `<g class="legs" fill="#E2789F"><rect x="62" y="116" width="16" height="24" rx="6"/><rect x="86" y="120" width="16" height="22" rx="6"/><rect x="128" y="120" width="16" height="22" rx="6"/><rect x="152" y="116" width="16" height="24" rx="6"/></g>
    <path d="M34 82c-16-8-18 14-2 10 10-3 4-14-4-8" fill="none" stroke="#E2789F" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="110" cy="86" rx="80" ry="54" fill="#F7A8C4"/><ellipse cx="96" cy="66" rx="46" ry="20" fill="#FBC8DB" opacity=".75"/>
    <path d="M148 44 166 16l12 36z" fill="#E2789F"/><ellipse cx="190" cy="92" rx="19" ry="16" fill="#F48FB4"/><circle cx="184" cy="92" r="3.2" fill="#B9507A"/><circle cx="195" cy="92" r="3.2" fill="#B9507A"/>
    <circle cx="160" cy="70" r="5.5" fill="#2B2F3A"/><circle cx="162" cy="68" r="1.8" fill="#fff"/><circle cx="168" cy="98" r="7" fill="#F27BA6" opacity=".55"/>
    <rect x="92" y="34" width="44" height="8" rx="4" fill="#8E3A5E"/><path d="M60 110c20 10 80 10 100 0" stroke="#E2789F" stroke-width="3" fill="none" opacity=".5"/>`;
  const PIG_SVG = `<svg class="bk-pig" viewBox="0 0 220 160" aria-hidden="true"><defs>
      <clipPath id="bkL"><polygon points="-20,-20 114,-20 104,40 118,70 102,100 116,180 -20,180"/></clipPath>
      <clipPath id="bkR"><polygon points="114,-20 240,-20 240,180 116,180 102,100 118,70 104,40"/></clipPath></defs>
    <g class="whole">${PIG}</g><g class="half l" clip-path="url(#bkL)">${PIG}</g><g class="half r" clip-path="url(#bkR)">${PIG}</g>
    <path class="crack" d="M114 30 104 44 118 70 102 100 116 136" fill="none" stroke="#5A1F38" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
  const HAMMER = `<svg class="bk-hammer" viewBox="0 0 120 120" aria-hidden="true"><g class="hm"><rect x="56" y="30" width="10" height="84" rx="4" fill="#8A5A3B"/><rect x="30" y="12" width="62" height="28" rx="6" fill="#6B7380"/><rect x="30" y="12" width="62" height="9" rx="4" fill="#9AA3AE"/></g></svg>`;

  // ---------- العرض المتحرك ----------
  let cur = null;
  function close() { if (cur) cur.finish(true); }
  function show({ info, T = {}, me = null, done } = {}) {
    close();
    if (!info || !info.ids) { if (done) done(); return; }
    const { ar, esc, plus, num } = F();
    const reduced = F().reduced();
    const ov = document.createElement('div');
    ov.className = 'bk-ov';
    const ids = info.ids;
    ov.innerHTML = `<div class="bk-box" role="dialog" aria-label="الحصالة">
      <h3 class="bk-h">الحصالة</h3>
      <div class="bk-stage">${PIG_SVG}${HAMMER}<div class="bk-glow"></div></div>
      <div class="bk-count"><b>${num(0)}</b><small>نقطة في الحصالة</small></div>
      ${info.carry ? `<p class="bk-carry">🐷 من الجولات اللي قبل: <b>${plus(info.carry)}</b></p>` : ''}
      <div class="bk-teams">${ids.map((t) => `<div class="bk-team ${String(t) === String(me) ? 'me' : ''}" data-t="${esc(t)}" style="--tc:${(T[t] && T[t].c) || '#888'}">
        <b>${esc((T[t] && T[t].n) || 'فريق')}</b><span class="raw">${plus(info.raw[t] || 0)}</span><em class="got"></em></div>`).join('')}</div>
      <p class="bk-msg" aria-live="polite"></p>
      <button type="button" class="bk-skip">متابعة</button></div>`;
    document.body.appendChild(ov);
    const box = ov.querySelector('.bk-box'), pig = ov.querySelector('.bk-pig'), cnt = ov.querySelector('.bk-count b');
    const msg = ov.querySelector('.bk-msg'), stage = ov.querySelector('.bk-stage');
    let alive = true, finished = false, count = 0;
    const setCount = (v) => { count = v; cnt.textContent = num(Math.round(v)); };
    const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 80) : ms));
    const finish = (silent) => {
      if (finished) return; finished = true; alive = false;
      ov.classList.add('out');
      setTimeout(() => ov.remove(), 350);
      if (cur && cur.ov === ov) cur = null;
      if (done) done();
    };
    cur = { ov, finish };
    ov.querySelector('.bk-skip').addEventListener('click', () => finish());
    // نقطة داخل الصندوق
    const at = (el, fx = 0.5, fy = 0.5) => { const b = box.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - b.left + r.width * fx, y: r.top - b.top + r.height * fy }; };
    const slot = () => { const b = box.getBoundingClientRect(), r = pig.getBoundingClientRect(); return { x: r.left - b.left + r.width * (114 / 220), y: r.top - b.top + r.height * (38 / 160) }; };
    function coin(from, to, { dur = 560, lift = 90, size = 22, delay = 0, spin = true } = {}) {
      const c = document.createElement('i'); c.className = 'bk-coin'; c.style.width = c.style.height = size + 'px';
      c.style.left = (from.x - size / 2) + 'px'; c.style.top = (from.y - size / 2) + 'px';
      box.appendChild(c);
      const dx = to.x - from.x, dy = to.y - from.y;
      const a = c.animate([
        { transform: 'translate(0,0) scale(.6) rotateY(0)', opacity: 0 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 - lift}px) scale(1.1) rotateY(${spin ? 360 : 0}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px,${dy}px) scale(.8) rotateY(${spin ? 720 : 0}deg)`, opacity: 1 }
      ], { duration: reduced ? 1 : dur, delay: reduced ? 0 : delay, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'both' });
      return a.finished.then(() => { c.remove(); }).catch(() => c.remove());
    }

    (async () => {
      requestAnimationFrame(() => ov.classList.add('in'));
      play('pop', 0.7);
      await wait(500);
      if (info.carry) { setCount(info.carry); pig.classList.add('bump'); }
      await wait(info.carry ? 500 : 150);
      // ١) العملات من الفرق إلى الحصالة
      const jobs = [];
      let k = 0;
      const per = {};
      ids.forEach((t) => { const v = info.raw[t] || 0; per[t] = v > 0 ? Math.max(1, Math.min(9, Math.ceil(v / 20))) : 0; });
      const maxN = Math.max(0, ...ids.map((t) => per[t]));
      for (let i = 0; i < maxN; i++) {
        ids.forEach((t) => {
          if (i >= per[t]) return;
          const chip = ov.querySelector(`.bk-team[data-t="${CSS.escape(String(t))}"]`);
          const step = (info.raw[t] || 0) / per[t];
          const d = (k++) * 120;
          jobs.push(coin(at(chip, 0.5, 0.2), slot(), { delay: d }).then(() => {
            if (!alive) return;
            setCount(count + step); play(k % 2 ? 'coin1' : 'coin2', 0.8);
            pig.classList.remove('bump'); void pig.offsetWidth; pig.classList.add('bump');
          }));
        });
      }
      await Promise.all(jobs);
      if (!alive) return;
      setCount(info.pot);
      await wait(400);
      if (!alive) return;
      // ٢) التشويق: الحصالة تهتز
      if (info.tier === 'none') {
        msg.innerHTML = 'ما أحد جمع نقاط هالجولة… الحصالة تنتظر';
        await wait(1800); return finish();
      }
      pig.classList.add('shake');
      for (let i = 0; i < 6 && alive; i++) { F().FX.tick(0.18); await wait(160); }
      pig.classList.remove('shake');
      if (!alive) return;
      if (info.tier === 'tie') {
        pig.classList.add('wiggle');
        msg.innerHTML = `<b>تعادل!</b> ما أحد كسرها، والحصالة تكبر للجولة الجاية`;
        play('pop', 0.8); F().FX.whistle && F().FX.whistle();
        await wait(2600); return finish();
      }
      // ٣) المطرقة والكسر
      stage.classList.add('swing');
      await wait(330); play('hit', 1);
      pig.classList.add('cracked');
      await wait(380);
      stage.classList.remove('swing'); void stage.offsetWidth; stage.classList.add('swing');
      await wait(330);
      if (!alive) return;
      play('smash', 1); pig.classList.add('broke'); stage.classList.add('flash');
      if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) { /* */ }
      await wait(200);
      // ٤) العملات تطير للفائز
      play('whoosh', 0.8);
      const c0 = slot(); c0.y += 40;
      const wins = info.wins;
      const burst = [];
      wins.forEach((t) => {
        const chip = ov.querySelector(`.bk-team[data-t="${CSS.escape(String(t))}"]`);
        for (let i = 0; i < 16; i++) burst.push(coin({ x: c0.x + (Math.random() - 0.5) * 60, y: c0.y + (Math.random() - 0.5) * 30 }, at(chip, 0.5, 0.4), { delay: i * 45, lift: 120 + Math.random() * 80, dur: 640, size: 18 + Math.random() * 8 }).then(() => alive && play(i % 2 ? 'coin1' : 'coin2', 0.6)));
      });
      // الفرق الخاسرة تبهت
      ids.forEach((t) => {
        const chip = ov.querySelector(`.bk-team[data-t="${CSS.escape(String(t))}"]`);
        if (!wins.includes(t)) { chip.classList.add('lost'); chip.querySelector('.got').textContent = plus(0); }
      });
      const tierTxt = info.last && info.tier !== 'split' ? { t: 'آخر جولة!', s: 'الحصالة كاملة للفائز' } : TIERS[info.tier];
      const names = wins.map((t) => (T[t] && T[t].n) || 'فريق').join(' و');
      msg.innerHTML = `<b>${esc(tierTxt.t)}</b> ${esc(names)} ${esc(tierTxt.s)}`;
      await Promise.all(burst);
      if (!alive) return;
      wins.forEach((t) => {
        const chip = ov.querySelector(`.bk-team[data-t="${CSS.escape(String(t))}"]`);
        chip.classList.add('won');
        const g = chip.querySelector('.got'), target = info.take[t] || 0, T0 = performance.now();
        const step = (now) => { if (!alive) return; const p = Math.min(1, (now - T0) / 700); g.textContent = plus(Math.round(target * p)); if (p < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
      setCount(info.left);
      ov.querySelector('.bk-count small').textContent = info.left ? 'باقي في الحصالة للجولة الجاية' : 'الحصالة فاضية';
      F().FX.clap(5);
      const conf = document.getElementById('confetti');
      if (conf && (me == null || wins.map(String).includes(String(me)))) F().confetti(conf, { count: 120 });
      await wait(3200);
      finish();
    })();
  }

  // نص قصير للقواعد (للإعدادات والشرح)
  const RULES = 'نقاط الفرق تنصب في حصالة، والأعلى يكسرها: فرق كبير جدًا = الحصالة كاملة، متوسط = ٣ أرباعها، بسيط = نصها والباقي يبقى. والخاسر ما ياخذ شي من الجولة.';
  return { compute, show, close, TIERS, RULES };
})();
