/* =========================================================
   سِجَال | شاشة المقدّم
   المقدّم هو المرجع: يفتح الغرفة، يجهّز كل جولة، يحسب النقاط ويكتبها.
   مسارات الغرفة (fazaa/<الرمز>/):
     s   حالة العرض (المرحلة، الفقرة، الجولة، البيانات العامة، الكشف)
     T   الفرق {الاسم، اللون، القائد}     p   المشاركون {الاسم، الفريق، الحضور}
     a/<الجولة>/<المشارك>  الإجابات      sc  النقاط      cfg  إعدادات المقدّم (للاستئناف)
   ========================================================= */
(() => {
  'use strict';
  const F = window.FZ, Net = window.FazaaNet, GM = window.FZ_GAMES, AI = window.FazaaAI;
  const { $, $$, esc, ar, num, plus, FX, store, R } = F;
  const G = GM.GAMES, C = window.FZ_CONTENT;

  // ---------- الإعدادات (تُحفظ على هذا الجهاز) ----------
  const SET_KEY = 'fazaa-settings';
  const defSettings = () => ({
    play: 'solo', teams: 3, names: F.TEAM_NAMES.slice(),
    playlist: GM.ORDER.map((id) => ({ id, on: true, rounds: G[id].rounds })),
    speed: 1, agg: 'avg', cup: false, rotate: false,
    mines: { unit: 'team', size: 4 }, cats: {}, levels: [0, 1, 2], ai: true, bank: true,
    prices: [], numbers: []
  });
  function loadSettings() {
    const s = Object.assign(defSettings(), store.json(SET_KEY, {}) || {});
    // نضمن وجود كل الفقرات في القائمة
    const have = new Set(s.playlist.map((x) => x.id));
    GM.ORDER.forEach((id) => { if (!have.has(id)) s.playlist.push({ id, on: true, rounds: G[id].rounds }); });
    s.playlist = s.playlist.filter((x) => G[x.id]);
    // خرائط الإصدار الأول صارت تصنيفات «ثبّت الدبوس»
    if (Array.isArray(s.maps)) { s.cats = Object.assign({ pin: s.maps }, s.cats || {}); delete s.maps; }
    s.cats = s.cats || {}; if (!Array.isArray(s.levels) || !s.levels.length) s.levels = [0, 1, 2];
    // الإعدادات المحفوظة قبل تفعيل الذكاء كان التحكيم فيها مطفأً: نشغّله مرة وحدة
    if (!s.aiV) { s.ai = true; s.aiV = 1; }
    return s;
  }
  let SET = loadSettings();
  const saveSettings = () => store.put(SET_KEY, SET);

  // ---------- حالة الغرفة ----------
  let room = null;          // رمز الغرفة
  let P = {}, T = {}, SCORE = { T: {}, P: {}, G: {} };
  let S = {};               // نسخة من حالة العرض
  let A = {};               // إجابات الجولة الحالية
  let run = null;           // الفقرة الجارية { queue, gi, ri, used, ... }
  let ind = SET.play !== 'teams'; // لعب فردي: فريق واحد ضمني وكل مشارك لنفسه
  let offset = 0, timerId = 0, offA = null, roundBusy = false, minesSt = null;
  const now = () => Date.now() + offset;
  const path = (p) => `${room}/${p}`;

  // =========================================================
  // الواجهة العامة
  // =========================================================
  function boothsHTML() {
    return GM.ORDER.map((id) => `<span class="booth" title="${esc(G[id].idea)}"><i>${G[id].ico}</i>${esc(G[id].name)}</span>`).join('');
  }
  function netStatus(on) {
    const d = $('#netDot');
    d.dataset.on = String(on);
    $('#netText').textContent = Net.local ? 'تجربة محلية' : on ? 'متصل' : 'غير متصل';
  }

  // ---------- الإعدادات ----------
  function settingsUI() {
    const b = $('#setBody');
    const pl = SET.playlist;
    b.innerHTML = `
      <section class="set-sec"><h4>الفقرات وترتيبها</h4>
        <div class="presets"><button class="chip" data-pre="all">الكل</button><button class="chip" data-pre="quick">سريعة (٦)</button><button class="chip" data-pre="team">جماعية</button><button class="chip" data-pre="solo">فردية</button></div>
        <ol class="pl">${pl.map((x, i) => `<li class="${x.on ? '' : 'off'}" data-i="${i}">
          <label class="sw-toggle"><input type="checkbox" ${x.on ? 'checked' : ''} data-k="on"><span></span></label>
          <i class="pl-ico">${G[x.id].ico}</i><span class="pl-name"><b>${esc(G[x.id].name)}</b><small>${GM.MODE_LABEL[G[x.id].mode]}</small></span>
          <span class="stepper"><button type="button" data-k="r-">−</button><b>${ar(x.rounds)}</b><button type="button" data-k="r+">+</button><small>جولات</small></span>
          <span class="mv"><button type="button" data-k="up" ${i === 0 ? 'disabled' : ''} aria-label="لأعلى">▲</button><button type="button" data-k="dn" ${i === pl.length - 1 ? 'disabled' : ''} aria-label="لأسفل">▼</button></span>
        </li>`).join('')}</ol></section>

      <section class="set-sec"><h4>نظام اللعب</h4>
        <div class="row-set"><span>طريقة اللعب</span><span class="seg ${room ? 'locked' : ''}" data-k="play">${[['solo', '👤 فردي'], ['teams', '👥 فرق']].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${SET.play === v}">${t}</button>`).join('')}</span></div>
        <p class="hint">${SET.play === 'teams' ? 'فرق: كل مشارك يختار فريقه، وفي الفقرات الجماعية يتشاور الفريق ويرسل القائد.' : 'فردي: كل مشارك يلعب لنفسه من جواله في كل الفقرات، والترتيب للأشخاص.'}${room ? ' (يتغير قبل فتح الغرفة فقط)' : ''}</p>
      </section>
      <section class="set-sec" ${SET.play === 'teams' ? '' : 'hidden'}><h4>الفرق</h4>
        <div class="row-set"><span>عدد الفرق</span><span class="stepper ${room ? 'locked' : ''}"><button type="button" id="tMinus">−</button><b>${ar(SET.teams)}</b><button type="button" id="tPlus">+</button></span></div>
        ${room ? '<p class="hint">عدد الفرق يتغير قبل فتح الغرفة فقط، والأسماء تقدر تعدّلها الحين.</p>' : ''}
        <div class="names">${Array.from({ length: SET.teams }, (_, i) => `<label class="tname" style="--tc:${F.TEAM_COLORS[i]}"><i></i><input data-t="${i}" maxlength="16" value="${esc(SET.names[i] || F.TEAM_NAMES[i])}"></label>`).join('')}</div>
      </section>

      <section class="set-sec"><h4>النقاط واللعب</h4>
        <div class="row-set"><span>الوقت</span><span class="seg" data-k="speed">${[[0.75, 'أسرع'], [1, 'عادي'], [1.5, 'أطول']].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${SET.speed === v}">${t}</button>`).join('')}</span></div>
        <div class="row-set" ${SET.play === 'teams' ? '' : 'hidden'}><span>نقاط الفقرات الفردية للفريق</span><span class="seg" data-k="agg">${[['avg', 'متوسط الأعضاء'], ['sum', 'مجموع الأعضاء']].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${SET.agg === v}">${t}</button>`).join('')}</span></div>
        <p class="hint">المتوسط عادل إذا اختلفت أعداد الفرق.</p>
        <label class="row-set chk"><span>نظام البطولة: الفائز بكل فقرة ٣ نقاط والثاني ٢ والثالث ١ (والتعادل بمجموع النقاط)</span><input type="checkbox" id="cupChk" ${SET.cup ? 'checked' : ''}></label>
        <label class="row-set chk" ${SET.play === 'teams' ? '' : 'hidden'}><span>القائد يتبدّل كل فقرة</span><input type="checkbox" id="rotChk" ${SET.rotate ? 'checked' : ''}></label>
        <label class="row-set chk" ${SET.play === 'teams' ? '' : 'hidden'}><span>🪙 الحصالة: ${esc(window.FZ_BANK ? FZ_BANK.RULES : '')}</span><input type="checkbox" id="bankChk" ${SET.bank !== false ? 'checked' : ''}></label>
        <label class="row-set chk"><span>تحكيم الرسم والوصف بالذكاء الاصطناعي ${AI.ready ? '' : '<small>(يحتاج تفعيل AI Logic في Firebase)</small>'}</span><input type="checkbox" id="aiChk" ${SET.ai && AI.ready ? 'checked' : ''} ${AI.ready ? '' : 'disabled'}></label>
      </section>

      <section class="set-sec"><h4>💣 الألغام</h4>
        <div class="row-set" ${SET.play === 'teams' ? '' : 'hidden'}><span>من يلعب</span><span class="seg" data-k="unit">${[['team', 'الفرق (القائد)'], ['solo', 'كل مشارك']].map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${SET.mines.unit === v}">${t}</button>`).join('')}</span></div>
        <div class="row-set"><span>حجم اللوحة</span><span class="seg" data-k="size">${[4, 5, 6].map((v) => `<button type="button" data-v="${v}" aria-pressed="${SET.mines.size === v}">${ar(v)}×${ar(v)}</button>`).join('')}</span></div>
        <p class="hint">مع «كل مشارك» تكبر اللوحة تلقائيًا إذا كثر العدد.</p>
      </section>

      <section class="set-sec"><h4>📚 محتوى الفقرات</h4>
        <div class="row-set"><span>المستوى</span><span class="seg multi" data-k="levels">${C.LEVELS.map((t, v) => `<button type="button" data-v="${v}" aria-pressed="${SET.levels.includes(v)}">${t}</button>`).join('')}</span></div>
        <p class="hint">اختر التصنيفات لكل فقرة (بدون اختيار = الكل)، والرقم عدد العناصر المتاحة بالمستوى المختار.</p>
        <div class="bank-cats">${GM.BANKED.map((gid) => {
          const B = C.BANK[gid], sel = SET.cats[gid] || [];
          return `<div class="bc-row"><b>${G[gid].ico} ${esc(G[gid].name)}</b><div class="bc-chips">${Object.keys(B.cats).map((k) => {
            const n = B.items.filter((it) => it.cat === k && SET.levels.includes(it.lvl)).length;
            return `<button type="button" class="chip cat ${sel.includes(k) ? 'on' : ''}" data-g="${gid}" data-c="${k}">${esc(B.cats[k])} <small>${ar(n)}</small></button>`;
          }).join('')}</div></div>`;
        }).join('')}</div>
        <button type="button" class="btn tactile" id="openBank">📚 استعرض بنك الفقرات</button>
      </section>

      <section class="set-sec"><h4>⚡ أسئلة السرعة</h4><div id="quizBox"></div></section>

      <section class="set-sec"><h4>💰 منتجات «كم السعر؟»</h4>
        <p class="hint">أسعار البنك الموثّقة من نوفمبر ٢٠٢٦، وتصنيف «تقديرية» أسعاره تقريبية. أضف منتجاتك بأسعارها الحالية: سطر لكل منتج بالشكل: <code>المنتج | المتجر | السعر</code></p>
        <textarea id="pricesTa" rows="4" placeholder="آيفون ١٧ برو | مكتبة جرير | 5199">${esc(SET.prices.map((x) => x.slice(0, 3).join(' | ')).join('\n'))}</textarea>
      </section>
      <section class="set-sec"><h4>🔢 أسئلة «قرّب من الرقم»</h4>
        <p class="hint">أضف أسئلتك: <code>السؤال | الرقم | الوحدة</code></p>
        <textarea id="numsTa" rows="3" placeholder="كم عدد أعضاء فريقنا؟ | 24 | عضو">${esc(SET.numbers.map((x) => x.join(' | ')).join('\n'))}</textarea>
      </section>`;

    // الفقرات
    $('.pl', b).addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const i = +btn.closest('li').dataset.i, k = btn.dataset.k;
      if (k === 'r-') pl[i].rounds = Math.max(1, pl[i].rounds - 1);
      if (k === 'r+') pl[i].rounds = Math.min(10, pl[i].rounds + 1);
      if (k === 'up' && i > 0) [pl[i - 1], pl[i]] = [pl[i], pl[i - 1]];
      if (k === 'dn' && i < pl.length - 1) [pl[i + 1], pl[i]] = [pl[i], pl[i + 1]];
      saveSettings(); settingsUI(); FX.tick(0.15);
    });
    $$('.pl input[data-k="on"]', b).forEach((c) => c.addEventListener('change', () => { pl[+c.closest('li').dataset.i].on = c.checked; c.closest('li').classList.toggle('off', !c.checked); saveSettings(); lobbySum(); }));
    $$('[data-pre]', b).forEach((c) => c.addEventListener('click', () => {
      const pre = c.dataset.pre;
      const quick = ['price', 'reflex', 'hawk', 'quick', 'odd', 'mines'];
      pl.forEach((x) => { const m = G[x.id].mode; x.on = pre === 'all' || (pre === 'quick' && quick.includes(x.id)) || (pre === 'team' && (m === 'team' || m === 'duel' || m === 'mines')) || (pre === 'solo' && m === 'solo'); });
      saveSettings(); settingsUI(); lobbySum();
    }));
    // الفرق
    const tStep = (d) => { if (room) return; SET.teams = Math.max(2, Math.min(6, SET.teams + d)); saveSettings(); settingsUI(); };
    $('#tMinus', b).addEventListener('click', () => tStep(-1));
    $('#tPlus', b).addEventListener('click', () => tStep(1));
    $$('.tname input', b).forEach((inp) => inp.addEventListener('change', () => {
      const i = +inp.dataset.t, v = inp.value.trim().slice(0, 16) || F.TEAM_NAMES[i];
      SET.names[i] = v; saveSettings();
      if (room && T[i]) Net.set(path(`T/${i}/n`), v);
    }));
    // الأزرار المقطّعة
    $$('.seg', b).forEach((seg) => seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button'); if (!btn) return;
      const k = seg.dataset.k, raw = btn.dataset.v, v = isNaN(+raw) ? raw : +raw;
      if (k === 'play') { if (room) return; SET.play = v; saveSettings(); settingsUI(); paintMode(); return; }
      if (k === 'speed') SET.speed = v;
      if (k === 'agg') SET.agg = v;
      if (k === 'unit') SET.mines.unit = v;
      if (k === 'size') SET.mines.size = v;
      if (k === 'levels') { const has = SET.levels.includes(v); if (has && SET.levels.length === 1) return; SET.levels = has ? SET.levels.filter((x) => x !== v) : SET.levels.concat(v).sort(); saveSettings(); settingsUI(); return; }
      saveSettings();
      if (seg.classList.contains('multi')) $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', String(SET[k].includes(isNaN(+x.dataset.v) ? x.dataset.v : +x.dataset.v))));
      else $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
      FX.tick(0.15);
    }));
    // تصنيفات المحتوى
    $$('.chip.cat', b).forEach((ch) => ch.addEventListener('click', () => {
      const g = ch.dataset.g, k = ch.dataset.c, cur = SET.cats[g] || [];
      SET.cats[g] = cur.includes(k) ? cur.filter((x) => x !== k) : cur.concat(k);
      ch.classList.toggle('on'); saveSettings(); FX.tick(0.12);
    }));
    $('#openBank', b).addEventListener('click', () => openBank());
    $('#cupChk', b).addEventListener('change', (e) => { SET.cup = e.target.checked; saveSettings(); });
    $('#rotChk', b).addEventListener('change', (e) => { SET.rotate = e.target.checked; saveSettings(); });
    $('#bankChk', b).addEventListener('change', (e) => { SET.bank = e.target.checked; saveSettings(); });
    $('#aiChk', b).addEventListener('change', (e) => { SET.ai = e.target.checked; saveSettings(); });
    // أسئلة السرعة من بنك ديوان أو من المقدّم
    if (window.AtharQuiz) window.AtharQuiz.settingsUI($('#quizBox', b), { game: 'fazaa', def: 'diwan', sources: ['diwan', 'host'], labels: { host: { t: 'من المقدّم', s: 'تكتب السؤال وخياراته قبل كل جولة' } } });
    // المحتوى الخاص
    $('#pricesTa', b).addEventListener('change', (e) => {
      SET.prices = e.target.value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x.length >= 3 && x[0] && F.parseNum(x[2]) > 0).map((x) => [x[0], x[1] || '', F.parseNum(x[2]), '🏷️']);
      saveSettings();
    });
    $('#numsTa', b).addEventListener('change', (e) => {
      SET.numbers = e.target.value.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((x) => x.length >= 2 && x[0] && F.parseNum(x[1]) != null).map((x) => [x[0], F.parseNum(x[1]), x[2] || '']);
      saveSettings();
    });
  }
  // =========================================================
  // بنك الفقرات: استعراض المحتوى بالتصنيف والمستوى والبحث
  // =========================================================
  const bankView = { g: 'number', cat: '', lvl: -1, q: '' };
  function bankRow(gid, it) {
    const cat = `<span class="bk-cat">${esc(C.BANK[gid].cats[it.cat] || '')}</span><span class="bk-lvl l${it.lvl}">${C.LEVELS[it.lvl]}</span>`;
    if (gid === 'price') return `<li><span class="bk-emo bk-art">${(window.FZ_ART && FZ_ART(it.art)) || it.e}</span><div><b>${esc(it.n)}</b><small>${esc(it.st)}</small></div><strong>${num(it.v)} ${it.u && it.u !== 'ريال' ? esc(it.u) : 'ر.س'}${it.est ? ' ≈' : ''}</strong>${cat}</li>`;
    if (gid === 'number') return `<li><div><b>${esc(it.q)}</b></div><strong>${num(it.v)} <small>${esc(it.u)}</small></strong>${cat}</li>`;
    if (gid === 'order') return `<li><div><b>${esc(it.t)}</b><small>${it.items.map(esc).join(' ← ')}</small></div>${cat}</li>`;
    if (gid === 'odd') return `<li><div><b>${it.w.map((w, i) => (i === it.ans ? `<mark>${esc(w)}</mark>` : esc(w))).join('، ')}</b><small>${esc(it.why)}</small></div>${cat}</li>`;
    if (gid === 'proverb') return `<li><div><small>${esc(it.kd)}</small><b>${esc(it.t).replace('……', `<mark>${esc(it.a)}</mark>`).replace(' … ', ' ✦ ')}</b></div>${cat}</li>`;
    if (gid === 'hawk') return `<li><span class="bk-emo bk-photo"><img src="img/hawk/${it.img}.jpg" alt="" loading="lazy"></span><div><b>${esc(it.t)}</b><small>${ar(it.qs.length)} أسئلة: ${esc(it.qs.map((q) => q[0]).join(' • '))}</small></div>${cat}</li>`;
    if (gid === 'pin') return `<li><span class="bk-emo">📍</span><div><b>${esc(it.p)}</b><small>${ar(it.lat.toFixed(2))}° ، ${ar(it.lon.toFixed(2))}°</small></div>${cat}</li>`;
    return '';
  }
  function bankUI() {
    const B = C.BANK[bankView.g];
    const items = B.items.filter((it) => (!bankView.cat || it.cat === bankView.cat) && (bankView.lvl < 0 || it.lvl === bankView.lvl)
      && (!bankView.q || JSON.stringify(it).includes(bankView.q)));
    $('#bankTabs').innerHTML = GM.BANKED.map((gid) => `<button type="button" class="bk-tab ${gid === bankView.g ? 'on' : ''}" data-g="${gid}">${G[gid].ico} ${esc(G[gid].name)} <small>${ar(C.BANK[gid].items.length)}</small></button>`).join('');
    $('#bankFilters').innerHTML = `<button type="button" class="chip ${!bankView.cat ? 'on' : ''}" data-c="">الكل</button>${Object.keys(B.cats).map((k) => `<button type="button" class="chip ${bankView.cat === k ? 'on' : ''}" data-c="${k}">${esc(B.cats[k])} <small>${ar(B.items.filter((x) => x.cat === k).length)}</small></button>`).join('')}
      <span class="bk-sep"></span><button type="button" class="chip ${bankView.lvl < 0 ? 'on' : ''}" data-l="-1">كل المستويات</button>${C.LEVELS.map((t, i) => `<button type="button" class="chip ${bankView.lvl === i ? 'on' : ''}" data-l="${i}">${t}</button>`).join('')}`;
    $('#bankCount').textContent = `${ar(items.length)} عنصر`;
    $('#bankList').innerHTML = items.map((it) => bankRow(bankView.g, it)).join('') || '<li class="empty">ما فيه نتائج</li>';
  }
  function openBank(gid) {
    if (gid) bankView.g = gid;
    bankView.cat = ''; bankView.lvl = -1; bankView.q = ''; $('#bankSearch').value = '';
    bankUI(); $('#bankModal').hidden = false;
  }
  $('#bankTabs').addEventListener('click', (e) => { const b = e.target.closest('.bk-tab'); if (!b) return; bankView.g = b.dataset.g; bankView.cat = ''; bankUI(); FX.tick(0.12); });
  $('#bankFilters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.c != null) bankView.cat = b.dataset.c;
    if (b.dataset.l != null) bankView.lvl = +b.dataset.l;
    bankUI();
  });
  $('#bankSearch').addEventListener('input', (e) => { bankView.q = e.target.value.trim(); bankUI(); });
  $('#bankClose').addEventListener('click', () => { $('#bankModal').hidden = true; });
  $('#bankModal').addEventListener('click', (e) => { if (e.target.id === 'bankModal') $('#bankModal').hidden = true; });

  function openSettings() { settingsUI(); $('#settingsModal').hidden = false; }
  function closeSettings() {
    // نقرأ النصوص حتى لو ما تحرك المؤشر منها
    ['#pricesTa', '#numsTa'].forEach((s) => { const t = $(s); if (t) t.dispatchEvent(new Event('change')); });
    $('#settingsModal').hidden = true; lobbySum();
  }
  function lobbySum() {
    const on = SET.playlist.filter((x) => x.on);
    $('#plSum').innerHTML = on.length ? `${ar(on.length)} فقرات: ${on.map((x) => G[x.id].ico).join(' ')}` : '<b class="warn">ما اخترت أي فقرة</b>';
  }

  // =========================================================
  // الغرفة
  // =========================================================
  async function openRoom() {
    const btn = $('#openRoom'); btn.disabled = true;
    try {
      let code = '';
      for (let k = 0; k < 6; k++) {
        code = String(10000 + Math.floor(Math.random() * 90000));
        const ex = await Net.get(code + '/s');
        if (!ex) break;
      }
      room = code;
      T = {};
      ind = SET.play !== 'teams';
      if (ind) T[0] = { n: 'الساحة', c: '#E59A1C' };
      else for (let i = 0; i < SET.teams; i++) T[i] = { n: SET.names[i] || F.TEAM_NAMES[i], c: F.TEAM_COLORS[i] };
      SCORE = { T: {}, P: {}, G: {} };
      await Net.set(room, { s: { c: Date.now(), ph: 'lobby', r: '0' }, T });
      store.set('fazaa-host-room', room);
      enterLobby();
    } catch (e) {
      console.error(e); F.toast('تعذّر فتح الغرفة، تأكد من الاتصال');
    } finally { btn.disabled = false; }
  }

  let watchers = [];
  function watchRoom() {
    watchers.forEach((w) => w()); watchers = [];
    watchers.push(Net.watch(path('p'), (v) => { P = v || {}; onPlayers(); }));
    watchers.push(Net.watch(path('T'), (v) => { if (v) { T = v; onPlayers(); } }));
  }

  function enterLobby() {
    watchRoom();
    $('#roomCode').textContent = ar(room);
    const url = new URL('play.html?r=' + room, location.href).href;
    $('#joinLink').href = url; $('#joinLink').textContent = url.replace(/^https?:\/\//, '');
    try {
      const q = window.qrcode(0, 'M'); q.addData(url); q.make();
      $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 1, scalable: true, alt: 'رمز QR للدخول' });
    } catch { $('#qr').innerHTML = ''; }
    $('#brandSub').textContent = 'غرفة ' + ar(room);
    lobbySum();
    F.show('screen-lobby');
    F.keepAwake(); window.__fzAwake = true;
  }

  async function closeRoom() {
    const ok = await F.confirmBox({ title: 'إغلاق الغرفة؟', text: 'تنحذف الغرفة ونتائجها ويطلع كل المشاركين.', yes: 'أغلق', danger: true });
    if (!ok) return;
    stopTimer(); if (offA) offA(); watchers.forEach((w) => w()); watchers = [];
    try { await Net.remove(room); } catch { /* تجاهل */ }
    store.del('fazaa-host-room');
    room = null; run = null; P = {}; T = {};
    $('#brandSub').textContent = 'شاشة المقدّم';
    F.show('screen-intro');
  }

  // ---------- المشاركون والفرق ----------
  const online = (pid) => P[pid] && P[pid].on !== false;
  const teamIds = () => Object.keys(T).sort((a, b) => a - b);
  const membersOf = (tid) => F.members(P, tid).sort((a, b) => (P[a].j || 0) - (P[b].j || 0));
  // قائد لكل فريق: يبقى ما دام موجودًا، وإلا أول عضو متصل
  // الوحدة: المشارك في الفردي والفريق في الفرق
  const unitIds = () => (ind ? Object.keys(P).sort((a, b) => (P[a].j || 0) - (P[b].j || 0)) : teamIds());
  const unitName = (k) => (ind ? (P[k] ? P[k].n : '—') : (T[k] ? T[k].n : ''));
  const unitColor = (k) => (ind ? F.pcolor(k) : (T[k] ? T[k].c : '#888'));
  const mUnit = () => (ind ? 'solo' : SET.mines.unit);
  function ensureLeaders(force = false) {
    if (ind) return;
    const up = {};
    teamIds().forEach((tid) => {
      const ms = membersOf(tid), cur = T[tid].l;
      if (!force && cur && P[cur] && String(P[cur].t) === tid && online(cur)) return;
      const on = ms.filter(online);
      const next = on[0] || ms[0] || null;
      if ((next || null) !== (cur || null)) up[`${tid}/l`] = next;
    });
    if (Object.keys(up).length) { Object.keys(up).forEach((k) => { const [tid] = k.split('/'); T[tid].l = up[k]; }); Net.update(path('T'), up); }
  }
  function rotateLeaders() {
    if (ind) return;
    const up = {};
    teamIds().forEach((tid) => {
      const on = membersOf(tid).filter(online);
      if (!on.length) return;
      const i = on.indexOf(T[tid].l);
      up[`${tid}/l`] = on[(i + 1) % on.length];
      T[tid].l = up[`${tid}/l`];
    });
    if (Object.keys(up).length) Net.update(path('T'), up);
  }
  function onPlayers() {
    if (!room) return;
    ensureLeaders();
    $('#pCount').textContent = ar(Object.keys(P).length);
    $('#teamsBoard').classList.toggle('solo', ind);
    if (ind) {
      const ps = unitIds();
      $('#teamsBoard').innerHTML = `<div class="tcol solo-col" style="--tc:#E59A1C"><header><b>المشاركون</b><span>${ar(ps.length)}</span></header>
        <div class="chips">${ps.map((pid) => `<button class="pchip ${online(pid) ? '' : 'off'}" data-pid="${pid}" style="--tc:${F.pcolor(pid)}">${esc(P[pid].n)}</button>`).join('') || '<span class="empty">بانتظار المشاركين… امسحوا الرمز وادخلوا</span>'}</div></div>`;
      sideScore();
      if (S.ph === 'play') liveAnswers();
      return;
    }
    $('#teamsBoard').innerHTML = teamIds().map((tid) => {
      const ms = membersOf(tid);
      return `<div class="tcol" style="--tc:${T[tid].c}"><header><b>${esc(T[tid].n)}</b><span>${ar(ms.length)}</span></header>
        <div class="chips">${ms.map((pid) => `<button class="pchip ${online(pid) ? '' : 'off'} ${T[tid].l === pid ? 'lead' : ''}" data-pid="${pid}">${T[tid].l === pid ? '<i>👑</i>' : ''}${esc(P[pid].n)}</button>`).join('') || '<span class="empty">بانتظار المشاركين…</span>'}</div></div>`;
    }).join('');
    sideScore();
    if (S.ph === 'play') liveAnswers();
  }
  // قائمة مشارك: قائد / نقل / إخراج
  function playerMenu(pid) {
    const p = P[pid]; if (!p) return;
    $('#pmName').textContent = p.n;
    const tid = String(p.t);
    $('#pmBody').innerHTML = ind ? '<button class="btn btn-ghost danger" data-a="kick">إخراج من الغرفة</button>' : `<button class="btn tactile" data-a="lead" ${T[tid] && T[tid].l === pid ? 'disabled' : ''}>👑 اجعله قائد ${esc(T[tid] ? T[tid].n : '')}</button>
      <div class="pm-move"><small>انقله إلى:</small>${teamIds().filter((x) => x !== tid).map((x) => `<button class="chip" data-a="move" data-t="${x}" style="--tc:${T[x].c}">${esc(T[x].n)}</button>`).join('')}</div>
      <button class="btn btn-ghost danger" data-a="kick">إخراج من الغرفة</button>`;
    $('#pMenu').hidden = false;
    $('#pmBody').onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'lead') { T[tid].l = pid; await Net.set(path(`T/${tid}/l`), pid); }
      if (b.dataset.a === 'move') { await Net.set(path(`p/${pid}/t`), b.dataset.t); if (T[tid].l === pid) await Net.set(path(`T/${tid}/l`), null); }
      if (b.dataset.a === 'kick') { await Net.remove(path(`p/${pid}`)); if (T[tid] && T[tid].l === pid) await Net.set(path(`T/${tid}/l`), null); }
      $('#pMenu').hidden = true; FX.tick(0.2);
    };
  }

  // =========================================================
  // النقاط
  // =========================================================
  function cupTable() {
    const cup = {};
    unitIds().forEach((t) => { cup[t] = 0; });
    Object.keys(SCORE.G || {}).forEach((gi) => {
      const rows = unitIds().map((t) => ({ t, v: -(SCORE.G[gi][t] || 0) }));
      F.rankBy(rows, 'v').forEach((r) => { if (-r.v > 0) cup[r.t] += [3, 2, 1][r.rank] || 0; });
    });
    return cup;
  }
  function standings() {
    const cup = SET.cup ? cupTable() : null;
    return unitIds().map((t) => ({ t, pts: (ind ? SCORE.P[t] : SCORE.T[t]) || 0, cup: cup ? cup[t] : 0 }))
      .sort((a, b) => (b.cup - a.cup) || (b.pts - a.pts));
  }
  let holdSide = false; // أثناء الكشف المتحرك نؤجّل تحديث الترتيب حتى ما ينكشف الفائز
  function sideScore() {
    if (holdSide) return;
    const st = standings(), max = Math.max(1, ...st.map((x) => x.pts));
    const rows = ind ? st.slice(0, 12) : st;
    $('#sideScore').innerHTML = `<h4>${ind ? 'الترتيب' : 'الفرق'}</h4>${rows.map((x, i) => `<div class="srow" style="--tc:${unitColor(x.t)};--w:${(x.pts / max * 100).toFixed(1)}%">
      <span class="pos">${ar(i + 1)}</span><span class="nm"><b>${esc(unitName(x.t))}</b>${ind ? '' : `<small>${T[x.t].l && P[T[x.t].l] ? '👑 ' + esc(P[T[x.t].l].n) : 'بلا قائد'}</small>`}</span>
      <span class="pts">${num(x.pts)}${SET.cup ? `<small>🏅${ar(x.cup)}</small>` : ''}</span><i class="bar"></i></div>`).join('')}${!ind && SET.bank !== false && SCORE.B ? `<p class="side-bank">🪙 باقي في الحصالة <b>${num(SCORE.B)}</b></p>` : ''}`;
  }
  // تطبيق نقاط جولة: pp شخصية، tp للفريق (إن وُجدت) وإلا تُجمع من الأعضاء
  let lastBank = null;
  const isLastRound = () => run.gi + 1 >= run.queue.length && run.ri + 1 >= run.queue[run.gi].rounds;
  function applyScores(pp = {}, tp = null, opt = {}) {
    lastBank = null;
    Object.keys(pp).forEach((pid) => { SCORE.P[pid] = (SCORE.P[pid] || 0) + pp[pid]; });
    if (ind) {
      // الفردي: نقاط الفقرة لكل مشارك
      const gi = String(run.gi);
      SCORE.G[gi] = SCORE.G[gi] || {};
      Object.keys(pp).forEach((pid) => { SCORE.G[gi][pid] = (SCORE.G[gi][pid] || 0) + pp[pid]; });
      Net.set(path('sc'), SCORE);
      sideScore();
      return pp;
    }
    let team = tp;
    if (!team) {
      team = {};
      teamIds().forEach((tid) => {
        const ms = membersOf(tid).filter((pid) => online(pid) || pp[pid] != null);
        const sum = ms.reduce((s, pid) => s + (pp[pid] || 0), 0);
        team[tid] = ms.length ? Math.round(SET.agg === 'sum' ? sum : sum / ms.length) : 0;
      });
    }
    // الحصالة: نقاط الجولة كلها للفريق الأعلى حسب الفرق
    if (opt.bank && window.FZ_BANK) {
      const r = FZ_BANK.compute(team, teamIds(), SCORE.B || 0, isLastRound());
      team = r.final; lastBank = r.info; SCORE.B = r.info.left;
    }
    const gi = String(run.gi);
    SCORE.G[gi] = SCORE.G[gi] || {};
    Object.keys(team).forEach((tid) => {
      SCORE.T[tid] = (SCORE.T[tid] || 0) + (team[tid] || 0);
      SCORE.G[gi][tid] = (SCORE.G[gi][tid] || 0) + (team[tid] || 0);
    });
    Net.set(path('sc'), SCORE);
    sideScore();
    return team;
  }

  // =========================================================
  // سير العرض
  // =========================================================
  const gameOf = () => G[run.queue[run.gi].id];
  const timeOf = (g, t = g.time) => Math.round(t * SET.speed);
  function setState(o) {
    S = o;
    return Net.set(path('s'), o);
  }
  function saveRun() { Net.set(path('cfg'), JSON.stringify({ run, SET: { agg: SET.agg, cup: SET.cup } })); }

  function startShow() {
    const queue = SET.playlist.filter((x) => x.on).map((x) => ({ id: x.id, rounds: x.rounds }));
    if (!queue.length) { F.toast('اختر فقرة وحدة على الأقل'); openSettings(); return; }
    if (!Object.keys(P).length && !Net.local) { F.toast('ما دخل أحد بعد'); }
    run = { queue, gi: -1, ri: -1, used: {}, rk: run ? run.rk : 0, duel: {} };
    SCORE = { T: {}, P: {}, G: {} };
    Net.set(path('sc'), SCORE);
    FX.whistle();
    nextGame();
  }

  function nextGame() {
    stopTimer();
    run.gi++; run.ri = -1;
    if (run.gi >= run.queue.length) { endShow(); return; }
    const g = gameOf();
    if (SET.rotate && run.gi > 0) rotateLeaders(); else ensureLeaders();
    const duel = g.mode === 'duel' && !ind;
    if (duel) pickDrawers();
    setState({ ph: 'intro', g: run.queue[run.gi].id, gi: run.gi, gn: run.queue.length, ri: 0, rn: run.queue[run.gi].rounds, r: S.r || '0', dw: duel ? run.dw : null });
    saveRun();
    renderIntro();
  }

  // الرسّامون: واحد من كل فريق بالتناوب
  function pickDrawers() {
    run.dw = {};
    teamIds().forEach((tid) => {
      const on = membersOf(tid).filter(online);
      if (!on.length) return;
      const k = (run.duel[tid] || 0) % on.length;
      run.dw[on[k]] = true;
    });
  }

  function head(g, sub) {
    $('#gIco').textContent = g.ico;
    $('#gName').textContent = g.name;
    $('#gMeta').textContent = sub;
  }

  function renderIntro() {
    const g = gameOf(), q = run.queue[run.gi];
    head(g, `الفقرة ${ar(run.gi + 1)} من ${ar(run.queue.length)} — ${ar(q.rounds)} ${q.rounds > 2 ? 'جولات' : q.rounds === 2 ? 'جولتان' : 'جولة'}`);
    $('#timer').innerHTML = ''; $('#answered').innerHTML = '';
    const roles = ind ? '' : g.mode === 'duel'
      ? `<div class="roles"><b>الرسّامون:</b> ${Object.keys(run.dw || {}).map((pid) => `<span class="tchip" style="--tc:${T[P[pid].t].c}">✏️ ${esc(P[pid].n)}</span>`).join('') || 'ما فيه أحد متصل'} <button class="chip" id="reDraw">بدّل الرسّامين</button></div>`
      : (g.mode === 'team' || (g.mode === 'mines' && mUnit() === 'team'))
        ? `<div class="roles"><b>القادة:</b> ${teamIds().map((tid) => `<span class="tchip" style="--tc:${T[tid].c}">👑 ${T[tid].l && P[T[tid].l] ? esc(P[T[tid].l].n) : '—'}</span>`).join('')}</div>` : '';
    $('#stage').innerHTML = `<div class="g-intro" style="--d:0"><div class="booth-sign"><span class="b-ico">${g.ico}</span><h2>${esc(g.name)}</h2>
      <span class="mode-badge m-${GM.effMode(g, ind)}">${GM.modeLabel(g, ind)}</span></div><p class="how">${esc(GM.howOf(g, ind))}</p>${roles}</div>`;
    const rd = $('#reDraw');
    if (rd) rd.onclick = () => { teamIds().forEach((t) => { run.duel[t] = (run.duel[t] || 0) + 1; }); pickDrawers(); Net.set(path('s/dw'), run.dw); renderIntro(); };
    $('#nextBtn').textContent = 'ابدأ الجولة'; $('#nextBtn').disabled = false;
    $('#skipBtn').hidden = false;
    $('#whoStrip').innerHTML = '';
    F.show('screen-stage'); sideScore();
    FX.swoosh();
  }

  // ---------- جولة عادية ----------
  async function startRound(hostQ = null) {
    const g = gameOf(), id = run.queue[run.gi].id;
    if (g.mode === 'mines') { minesPlace(); return; }
    // أسئلة السرعة من المقدّم: نطلب السؤال أولًا
    const quiz = window.AtharQuiz ? window.AtharQuiz.load('fazaa', 'diwan', ['diwan', 'host']) : null;
    if (id === 'quick' && !hostQ && quiz && quiz.src === 'host') { askHostQ(); return; }
    run.ri++;
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const pick = (gid, list, ok = () => true) => {
      const used = run.used[gid] = run.used[gid] || [];
      let elig = list.map((_, i) => i).filter((i) => ok(list[i]));
      if (!elig.length) elig = list.map((_, i) => i);
      let free = elig.filter((i) => !used.includes(i));
      if (!free.length) { run.used[gid] = used.filter((i) => !elig.includes(i)); free = elig; }
      const i = free[Math.floor(Math.random() * free.length)];
      run.used[gid].push(i);
      return [i, list[i]];
    };
    const made = g.make({ seed, cfg: SET, pick, quiz, hostQ, last: run.ri + 1 >= run.queue[run.gi].rounds, rounds: run.queue[run.gi].rounds });
    if (!made) { F.toast('ما فيه أسئلة متاحة'); afterRound(); return; }
    run.cur = { d: made.d, k: made.k };
    run.rk = (run.rk || 0) + 1;
    const r = String(run.rk);
    const vw = g.view || 0, dl = vw + timeOf(g);
    if (g.mode === 'team') ensureLeaders();
    const st = { ph: 'play', g: id, gi: run.gi, gn: run.queue.length, ri: run.ri, rn: run.queue[run.gi].rounds, r, m: GM.effMode(g, ind), at: now() + 1200, dl, vw, d: JSON.stringify(made.d) };
    if (st.m === 'duel') st.dw = run.dw;
    A = {}; roundBusy = false;
    await setState(st);
    saveRun();
    if (offA) offA();
    offA = Net.watch(path('a/' + r), (v) => { A = v || {}; liveAnswers(); });
    head(g, `الجولة ${ar(run.ri + 1)} من ${ar(st.rn)}`);
    $('#nextBtn').textContent = 'أنهِ الوقت'; $('#skipBtn').hidden = true;
    renderPlay(vw > 0);
    FX.whistle();
    startTimer();
  }
  const ctxBase = () => ({ d: run.cur.d, k: run.cur.k, P, T, A, ind, at: S.at, dl: S.dl, left: () => (S.at + S.dl * 1000 - now()) / 1000, drawers: Object.keys(S.dw || {}) });
  function renderPlay(view) {
    const g = gameOf();
    g.host($('#stage'), Object.assign(ctxBase(), { view }));
    $('#stage').dataset.view = view ? '1' : '';
    liveAnswers();
  }
  // من المطلوب منه يجاوب؟
  function expected() {
    const g = gameOf();
    if (S.m === 'duel') return Object.keys(S.dw || {});
    if (S.m === 'team' || (g.mode === 'mines' && S.m === 'team')) return teamIds().map((t) => T[t].l).filter((pid) => pid && online(pid));
    return Object.keys(P).filter(online);
  }
  function liveAnswers() {
    if (S.ph !== 'play' || !run) return;
    const exp = expected(), got = Object.keys(A || {});
    const n = exp.filter((pid) => got.includes(pid)).length;
    $('#answered').innerHTML = `<b>${ar(got.length)}</b> / ${ar(exp.length)} ${S.m === 'team' ? 'قادة' : 'أرسلوا'}`;
    if (S.m === 'team' || S.m === 'duel') {
      $('#whoStrip').innerHTML = teamIds().map((t) => {
        const who = S.m === 'duel' ? Object.keys(S.dw || {}).find((pid) => P[pid] && String(P[pid].t) === t) : T[t].l;
        return `<span class="tdot ${who && A[who] ? 'done' : ''}" style="--tc:${T[t].c}">${esc(T[t].n)}${who && A[who] ? ' ✓' : ''}</span>`;
      }).join('');
    } else $('#whoStrip').innerHTML = '';
    if (run.queue[run.gi].id === 'draw') {
      $$('.drawer', $('#stage')).forEach((el, i) => { const pid = Object.keys(S.dw || {})[i]; el.classList.toggle('done', !!(pid && A[pid])); });
    }
    // الكل أرسل؟ ننهي الجولة بعد لحظة
    if (exp.length && n >= exp.length && !roundBusy && run.queue[run.gi].id !== 'mines') { roundBusy = true; setTimeout(endRound, 700); }
  }
  function startTimer() {
    stopTimer();
    const tick = () => {
      const left = (S.at + S.dl * 1000 - now()) / 1000;
      const pre = (S.at - now()) / 1000;
      const vwLeft = (S.at + (S.vw || 0) * 1000 - now()) / 1000;
      // عين الصقر: انتهت المشاهدة؟
      if (S.vw && $('#stage').dataset.view === '1' && vwLeft <= 0) { renderPlay(false); FX.swoosh(); }
      if (pre > 0) $('#timer').innerHTML = F.ring(1, '…', 'pre');
      else {
        const k = left / S.dl;
        $('#timer').innerHTML = F.ring(k, F.clock(left), left <= 5 ? 'hot' : '');
        if (left <= 5 && left > 0 && Math.ceil(left) !== startTimer.last) { startTimer.last = Math.ceil(left); FX.tick(0.14); }
      }
      if (left <= 0) { stopTimer(); if (S.g === 'mines') minesTimeout(); else endRound(); }
    };
    tick(); timerId = setInterval(tick, 250);
  }
  function stopTimer() { clearInterval(timerId); timerId = 0; }

  let endingR = null; // يمنع إنهاء الجولة مرتين (ضغطة المقدّم مع وصول آخر جواب)
  async function endRound() {
    if (S.ph !== 'play' || endingR === S.r) return;
    endingR = S.r;
    stopTimer(); roundBusy = true;
    const g = gameOf();
    $('#nextBtn').disabled = true;
    // مهلة قصيرة لوصول آخر الإجابات (إرسال تلقائي من الجوالات)
    await Net.update(path('s'), { ph: 'lock' }); S.ph = 'lock';
    $('#stage').insertAdjacentHTML('beforeend', '<div class="judging">⏳ نجمع الإجابات…</div>');
    await new Promise((r) => setTimeout(r, run.queue[run.gi].id === 'draw' || run.queue[run.gi].id === 'describe' ? 2200 : 900));
    A = (await Net.get(path('a/' + S.r))) || {};
    // الفرق: نحتسب إجابة القائد فقط (الحماية في القواعد أيضًا)
    if (S.m === 'team') {
      const leaders = new Set(teamIds().map((t) => T[t].l));
      Object.keys(A).forEach((pid) => { if (!leaders.has(pid)) delete A[pid]; });
    }
    const c = Object.assign(ctxBase(), { A, ai: SET.ai && AI.ready ? AI : (AI.ready ? null : undefined) });
    let res;
    try { res = await g.score(c); } catch (e) { console.error(e); res = { pp: {}, rev: {} }; }
    // الفردي: نقاط فقرات «الأقرب» ترجع بمفتاح المشارك
    const bankOn = !ind && SET.bank !== false;
    holdSide = !!g.anim || bankOn;
    const pp = ind ? (res.pp && Object.keys(res.pp).length ? res.pp : (res.tp || {})) : (res.pp || {});
    const tp = applyScores(pp, ind || g.mode === 'solo' ? null : (res.tp || {}), { bank: bankOn });
    const rev = Object.assign({}, res.rev, { pp, tp: ind ? {} : tp }, bankOn && lastBank ? { bank: lastBank } : {});
    await setState(Object.assign({}, S, { ph: 'reveal', k: JSON.stringify(rev) }));
    const rev_r = S.r;
    saveRun();
    // فقرات الكشف المتحرك (كم السعر) تعرض النقاط بعد ما يخلص الكشف
    const fin = () => {
      if (holdSide) { holdSide = false; sideScore(); }
      $('#whoStrip').innerHTML = roundTeamPts(tp);
      if (!g.anim && !rev.bank) { const best = Math.max(0, ...Object.values(tp)); if (best > 0) FX.clap(5); else FX.wrong(); }
    };
    // بعد الكشف: الحصالة (في الفرق) ثم النقاط
    const after = () => (rev.bank && window.FZ_BANK ? FZ_BANK.show({ info: rev.bank, T, done: fin }) : fin());
    $('#whoStrip').innerHTML = '';
    g.reveal($('#stage'), Object.assign(c, { rev, pp, done: g.anim ? after : null }));
    $('#answered').innerHTML = ''; $('#timer').innerHTML = '';
    if (!g.anim) { if (rev.bank) setTimeout(() => { if (S.ph === 'reveal' && S.r === rev_r) after(); else fin(); }, 1500); else fin(); }
    $('#nextBtn').textContent = run.ri + 1 < run.queue[run.gi].rounds ? 'الجولة التالية' : 'نتائج الفقرة';
    $('#nextBtn').disabled = false;
  }
  const roundTeamPts = (tp) => (ind
    ? Object.keys(tp).filter((k) => tp[k] > 0).sort((a, b) => tp[b] - tp[a]).slice(0, 8).map((k) => `<span class="tdot pts" style="--tc:${unitColor(k)}">${esc(unitName(k))} <b>${plus(tp[k])}</b></span>`).join('')
    : teamIds().map((t) => `<span class="tdot pts" style="--tc:${T[t].c}">${esc(T[t].n)} <b>${plus(tp[t] || 0)}</b></span>`).join(''));

  function afterRound() {
    if (window.FZ_BANK) FZ_BANK.close();
    if (holdSide) { holdSide = false; sideScore(); }
    if (run.ri + 1 < run.queue[run.gi].rounds) startRound();
    else gameBoard();
  }

  // ---------- سؤال من المقدّم ----------
  function askHostQ() {
    const box = $('#hqOpts');
    box.innerHTML = [0, 1, 2, 3].map((i) => `<label class="hq-opt"><input type="radio" name="hqR" value="${i}" ${i === 0 ? 'checked' : ''}><input type="text" maxlength="60" placeholder="الخيار ${ar(i + 1)}"></label>`).join('');
    $('#hqQ').value = '';
    $('#hostQ').hidden = false;
    setTimeout(() => $('#hqQ').focus(), 50);
  }
  $('#hqForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#hqQ').value.trim();
    const rows = $$('.hq-opt').map((l) => ({ t: $('input[type=text]', l).value.trim(), ok: $('input[type=radio]', l).checked })).filter((x) => x.t);
    if (!q || rows.length < 2 || !rows.some((x) => x.ok)) { F.toast('اكتب السؤال وخيارين واختر الصحيح'); return; }
    $('#hostQ').hidden = true;
    startRound({ q, opts: rows.map((x) => x.t), correct: rows.findIndex((x) => x.ok), cat: 'من المقدّم' });
  });
  $('#hqCancel').addEventListener('click', () => { $('#hostQ').hidden = true; gameBoard(); });

  // =========================================================
  // الألغام: تخبئة ثم أدوار
  // =========================================================
  function minesActors() {
    if (mUnit() === 'team') return teamIds().filter((t) => membersOf(t).some(online));
    return Object.keys(P).filter(online).sort((a, b) => (P[a].j || 0) - (P[b].j || 0));
  }
  async function minesPlace() {
    run.ri++;
    const g = G.mines;
    ensureLeaders();
    const actors = minesActors();
    let n = SET.mines.size;
    if (mUnit() === 'solo') while (n < 8 && n * n < actors.length * 2.5) n++;
    run.rk = (run.rk || 0) + 1;
    const r = String(run.rk);
    minesSt = { n, rev: {}, pot: {}, out: [], order: actors, turn: -1, pr: r, unit: mUnit(), own: {} };
    A = {}; roundBusy = false;
    await setState({ ph: 'play', g: 'mines', sub: 'place', gi: run.gi, gn: run.queue.length, ri: run.ri, rn: run.queue[run.gi].rounds, r, m: mUnit() === 'team' ? 'team' : 'solo', at: now() + 1000, dl: timeOf(g, g.place), vw: 0, d: JSON.stringify(minesPublic()) });
    if (offA) offA();
    offA = Net.watch(path('a/' + r), (v) => { A = v || {}; liveAnswers(); minesPlaceProgress(); });
    head(g, `الجولة ${ar(run.ri + 1)} من ${ar(S.rn)} — خبّوا الألغام`);
    $('#nextBtn').textContent = 'أنهِ التخبئة'; $('#skipBtn').hidden = true;
    minesPlaceProgress();
    FX.whistle();
    startTimer();
  }
  const actorName = (ak) => (minesSt.unit === 'team' ? (T[ak] ? T[ak].n : '') : (P[ak] ? P[ak].n : '؟'));
  const actorColor = (ak) => (minesSt.unit === 'team' ? (T[ak] ? T[ak].c : '#888') : ind ? F.pcolor(ak) : (P[ak] && T[P[ak].t] ? T[P[ak].t].c : '#888'));
  const minesPublic = () => ({ n: minesSt.n, rev: minesSt.rev, pot: minesSt.pot, out: minesSt.out, order: minesSt.order, turn: minesSt.turn, pr: minesSt.pr, unit: minesSt.unit, last: minesSt.last || null });
  function minesPlaceProgress() {
    if (S.sub !== 'place') return;
    const keyOf = (pid) => (minesSt.unit === 'team' ? String(P[pid] && P[pid].t) : pid);
    const placed = new Set(Object.keys(A || {}).map(keyOf));
    $('#stage').innerHTML = `<div class="mines-host">${GM.minesBoard({ n: minesSt.n, rev: {} })}
      <div class="mines-side"><p class="how">كل ${minesSt.unit === 'team' ? 'قائد' : 'مشارك'} يخبّي لغمه في خانة من جواله… محد يشوف إلا لغمه.</p>
      <div class="actors">${minesSt.order.map((ak) => `<span class="actor ${placed.has(ak) ? 'done' : ''}" style="--tc:${actorColor(ak)}">${esc(actorName(ak))} ${placed.has(ak) ? '💣' : '…'}</span>`).join('')}</div></div></div>`;
    if (minesSt.order.length && minesSt.order.every((ak) => placed.has(ak)) && !roundBusy) { roundBusy = true; setTimeout(minesStartTurns, 700); }
  }
  async function minesStartTurns() {
    if (S.sub !== 'place') return;
    stopTimer();
    A = (await Net.get(path('a/' + minesSt.pr))) || {};
    const bombs = {}; // مفتاح اللاعب ← الخانة
    Object.keys(A).forEach((pid) => {
      const ak = minesSt.unit === 'team' ? String(P[pid] && P[pid].t) : pid;
      if (minesSt.unit === 'team' && T[ak] && T[ak].l !== pid && bombs[ak] != null) return;
      const v = +A[pid].v;
      if (v >= 0 && v < minesSt.n * minesSt.n) bombs[ak] = v;
    });
    // اللي ما خبّى: لغم عشوائي
    minesSt.order.forEach((ak) => { if (bombs[ak] == null) bombs[ak] = Math.floor(Math.random() * minesSt.n * minesSt.n); });
    minesSt.bombs = bombs;
    minesSt.order.forEach((ak) => { minesSt.pot[ak] = 0; });
    run.mines = minesSt;
    saveRun();
    roundBusy = false;
    minesNextTurn();
  }
  const bombCells = () => new Set(Object.values(minesSt.bombs));
  async function minesNextTurn() {
    const alive = minesSt.order.filter((ak) => !minesSt.out.includes(ak));
    const N = minesSt.n * minesSt.n, opened = Object.keys(minesSt.rev).length;
    const safeLeft = [...Array(N).keys()].filter((i) => !minesSt.rev[i] && !bombCells().has(i)).length;
    if (alive.length <= (minesSt.order.length > 1 ? 1 : 0) || safeLeft === 0 || opened >= N) { minesFinish(); return; }
    // الدور التالي (نتخطى المنسحبين)
    let k = minesSt.turn;
    for (let s = 0; s < minesSt.order.length; s++) { k = (k + 1) % minesSt.order.length; if (!minesSt.out.includes(minesSt.order[k])) break; }
    minesSt.turn = k;
    const ak = minesSt.order[k];
    let cur = ak;
    if (minesSt.unit === 'team') {
      cur = T[ak].l && online(T[ak].l) ? T[ak].l : membersOf(ak).find(online) || T[ak].l;
    }
    run.rk++;
    const r = String(run.rk);
    A = {}; roundBusy = false;
    await setState({ ph: 'play', g: 'mines', sub: 'turn', gi: run.gi, gn: run.queue.length, ri: run.ri, rn: run.queue[run.gi].rounds, r, m: 'turn', cur: cur || '', ak, at: now() + 400, dl: timeOf(G.mines), vw: 0, d: JSON.stringify(minesPublic()) });
    if (offA) offA();
    offA = Net.watch(path('a/' + r), (v) => { const a = v && cur && v[cur]; if (a && !roundBusy) { roundBusy = true; minesMove(ak, +a.v); } });
    head(G.mines, `الجولة ${ar(run.ri + 1)} من ${ar(S.rn)} — بالدور`);
    minesRender();
    startTimer();
  }
  function minesRender(flash = null) {
    const ak = S.ak;
    $('#stage').innerHTML = `<div class="mines-host">${GM.minesBoard(minesSt)}
      <div class="mines-side">
        ${flash ? `<div class="m-flash ${flash.boom ? 'boom' : 'ok'}">${flash.boom ? `💥 انفجر على ${esc(actorName(flash.ak))}!<small>لغم ${flash.owners.map(actorName).map(esc).join(' و')}</small>` : `✓ ${esc(actorName(flash.ak))} نجا ${plus(10)}`}</div>`
        : `<div class="m-turn" style="--tc:${actorColor(ak)}">الدور على <b>${esc(actorName(ak))}</b>${minesSt.unit === 'team' && P[S.cur] ? `<small>👑 ${esc(P[S.cur].n)} يضغط</small>` : ''}</div>`}
        <div class="actors">${minesSt.order.map((x) => `<span class="actor ${minesSt.out.includes(x) ? 'out' : ''} ${x === ak && !flash ? 'now' : ''}" style="--tc:${actorColor(x)}">${esc(actorName(x))}<b>${minesSt.out.includes(x) ? '💥' : ar(minesSt.pot[x] || 0)}</b></span>`).join('')}</div>
      </div></div>`;
  }
  async function minesMove(ak, cell) {
    stopTimer();
    if (!(cell >= 0 && cell < minesSt.n * minesSt.n) || minesSt.rev[cell]) cell = minesRandomCell(ak);
    const owners = Object.keys(minesSt.bombs).filter((x) => minesSt.bombs[x] === cell);
    const boom = owners.length > 0;
    if (boom) { minesSt.rev[cell] = 'b'; minesSt.out.push(ak); minesSt.pot[ak] = 0; FX.boom(); F.vibrate([60, 40, 120]); }
    else { minesSt.rev[cell] = 'ok'; minesSt.pot[ak] = (minesSt.pot[ak] || 0) + 10; FX.pop(640); }
    minesSt.last = { ak, cell, boom, owners };
    await Net.update(path('s'), { ph: 'lock', d: JSON.stringify(minesPublic()) }); S.ph = 'lock';
    minesRender({ ak, boom, owners });
    setTimeout(minesNextTurn, boom ? 2200 : 1300);
  }
  function minesRandomCell(ak) {
    const N = minesSt.n * minesSt.n;
    const free = [...Array(N).keys()].filter((i) => !minesSt.rev[i] && i !== minesSt.bombs[ak]);
    return free.length ? free[Math.floor(Math.random() * free.length)] : 0;
  }
  function minesTimeout() {
    if (S.sub === 'place') { minesStartTurns(); return; }
    if (S.sub === 'turn' && !roundBusy) { roundBusy = true; minesMove(S.ak, minesRandomCell(S.ak)); }
  }
  async function minesFinish() {
    stopTimer();
    const pp = {}, tp = {};
    minesSt.order.forEach((ak) => {
      const v = minesSt.out.includes(ak) ? 0 : (minesSt.pot[ak] || 0);
      if (minesSt.unit === 'team') tp[ak] = v; else pp[ak] = v;
    });
    const team = applyScores(pp, minesSt.unit === 'team' ? tp : null);
    // كشف كل الألغام وأصحابها
    const owners = {};
    Object.keys(minesSt.bombs).forEach((ak) => { const c = minesSt.bombs[ak]; (owners[c] = owners[c] || []).push(minesSt.unit === 'team' ? ak : (ind ? F.pcolor(ak) : String(P[ak] ? P[ak].t : '0'))); });
    const rev = { pp, tp: team, bombs: minesSt.bombs, owners, out: minesSt.out, pot: minesSt.pot };
    await setState(Object.assign({}, S, { ph: 'reveal', sub: 'end', k: JSON.stringify(rev), d: JSON.stringify(minesPublic()) }));
    const bm = {}; Object.values(minesSt.bombs).forEach((c) => { bm[c] = 1; });
    $('#stage').innerHTML = `<div class="mines-host">${GM.minesBoard(minesSt, { bombs: bm, owners, T })}
      <div class="mines-side"><h3 class="m-end">نهاية الجولة</h3><div class="actors">${minesSt.order.map((x) => `<span class="actor ${minesSt.out.includes(x) ? 'out' : 'won'}" style="--tc:${actorColor(x)}">${esc(actorName(x))}<b>${minesSt.out.includes(x) ? '💥 ٠' : plus(minesSt.pot[x] || 0)}</b></span>`).join('')}</div></div></div>`;
    $('#whoStrip').innerHTML = roundTeamPts(team);
    $('#timer').innerHTML = ''; $('#answered').innerHTML = '';
    FX.clap(5);
    $('#nextBtn').textContent = run.ri + 1 < run.queue[run.gi].rounds ? 'الجولة التالية' : 'نتائج الفقرة';
    $('#nextBtn').disabled = false;
  }

  // =========================================================
  // النتائج والنهاية
  // =========================================================
  function gameBoard() {
    stopTimer();
    const g = gameOf(), gi = String(run.gi);
    const gp = SCORE.G[gi] || {};
    const st = standings();
    const last = run.gi + 1 >= run.queue.length;
    const gWin = unitIds().filter((t) => (gp[t] || 0) > 0).sort((a, b) => (gp[b] || 0) - (gp[a] || 0))[0];
    setState({ ph: 'board', g: run.queue[run.gi].id, gi: run.gi, gn: run.queue.length, r: S.r });
    saveRun();
    $('#boardTitle').textContent = `نتائج «${g.name}»`;
    $('#boardSub').innerHTML = gWin ? `بطل الفقرة: <b style="color:${unitColor(gWin)}">${esc(unitName(gWin))}</b> ${plus(gp[gWin] || 0)}` : '';
    boardList($('#boardList'), ind ? st.slice(0, 10) : st, gp);
    playersTop($('#playersTop'));
    $('#boardNext').textContent = last ? 'إعلان الفائز 🏆' : `الفقرة التالية: ${G[run.queue[run.gi + 1].id].ico} ${G[run.queue[run.gi + 1].id].name}`;
    F.show('screen-board');
    FX.clap(4);
  }
  function boardList(el, st, gp = null) {
    const max = Math.max(1, ...st.map((x) => x.pts));
    el.innerHTML = st.map((x, i) => `<div class="prow ${i === 0 ? 'first' : ''}" style="--tc:${unitColor(x.t)};--w:${(x.pts / max * 100).toFixed(1)}%;--i:${i}">
      <span class="pos">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ar(i + 1)}</span><b class="nm">${esc(unitName(x.t))}</b>
      <span class="bar"><i></i></span><span class="pts">${num(x.pts)}${gp ? `<small>${plus(gp[x.t] || 0)}</small>` : ''}${SET.cup ? `<em>🏅 ${ar(x.cup)}</em>` : ''}</span></div>`).join('');
  }
  function playersTop(el) {
    if (ind) { el.innerHTML = ''; return; } // في الفردي الترتيب نفسه للأشخاص
    const top = Object.keys(SCORE.P || {}).filter((pid) => P[pid]).sort((a, b) => SCORE.P[b] - SCORE.P[a]).slice(0, 5);
    el.innerHTML = top.length ? `<h4>نجوم الساحة</h4><ol>${top.map((pid) => `<li><span class="tchip" style="--tc:${T[P[pid].t] ? T[P[pid].t].c : '#888'}">${esc(P[pid].n)}</span><b>${num(SCORE.P[pid])}</b></li>`).join('')}</ol>` : '';
  }
  function endShow() {
    stopTimer();
    const st = standings();
    const w = st[0];
    // في الفردي الجوالات تحسب الفائز من النقاط (رمز المشارك أطول من حقل win)
    setState({ ph: 'end', r: S.r, win: w && !ind ? w.t : null });
    $('#winTitle').innerHTML = w && w.pts > 0 ? `${ind ? 'البطل' : 'الفائز'}: <span style="color:${unitColor(w.t)}">${esc(unitName(w.t))}</span>` : 'انتهى السِّجال';
    boardList($('#endList'), ind ? st.slice(0, 10) : st);
    playersTop($('#endPlayers'));
    F.show('screen-end');
    window.AtharSound.winner();
    F.confetti($('#confetti'));
    setTimeout(() => F.confetti($('#confetti'), { x: 0.25 }), 700);
    setTimeout(() => F.confetti($('#confetti'), { x: 0.75 }), 1300);
    store.del('fazaa-host-run');
  }

  // =========================================================
  // الأزرار
  // =========================================================
  $('#openRoom').addEventListener('click', () => { FX.unlock(); openRoom(); });
  // اختيار طريقة اللعب من الواجهة
  const paintMode = () => $$('#modePick .mode-card').forEach((b) => b.setAttribute('aria-pressed', String((SET.play === 'teams' ? 'teams' : 'solo') === b.dataset.play)));
  $$('#modePick .mode-card').forEach((b) => b.addEventListener('click', () => {
    SET.play = b.dataset.play; saveSettings(); paintMode(); FX.tick(0.25);
    if (SET.play === 'teams') { const cm = $('.coin-mini', b); if (cm) { cm.style.animation = 'none'; void cm.offsetWidth; cm.style.animation = ''; } }
  }));
  paintMode();
  $('#openSet').addEventListener('click', openSettings);
  $('#openBankIntro').addEventListener('click', () => openBank());
  $('#setBtn').addEventListener('click', openSettings);
  $('#lobbySet').addEventListener('click', openSettings);
  $('#setDone').addEventListener('click', closeSettings);
  $('#settingsModal').addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
  $('#closeRoom').addEventListener('click', closeRoom);
  $('#endClose').addEventListener('click', closeRoom);
  $('#startShow').addEventListener('click', startShow);
  $('#againBtn').addEventListener('click', () => { run = null; setState({ ph: 'lobby', r: S.r }); Net.set(path('sc'), null); enterLobby(); });
  $('#boardNext').addEventListener('click', nextGame);
  $('#teamsBoard').addEventListener('click', (e) => { const b = e.target.closest('.pchip'); if (b) playerMenu(b.dataset.pid); });
  $('#pmClose').addEventListener('click', () => { $('#pMenu').hidden = true; });
  $('#pMenu').addEventListener('click', (e) => { if (e.target.id === 'pMenu') $('#pMenu').hidden = true; });
  $('#nextBtn').addEventListener('click', () => {
    if (S.ph === 'intro') { startRound(); return; }
    if (S.ph === 'play') {
      if (S.g === 'mines') { if (S.sub === 'place') minesStartTurns(); else minesTimeout(); return; }
      endRound(); return;
    }
    if (S.ph === 'reveal') afterRound();
  });
  $('#skipBtn').addEventListener('click', async () => {
    const ok = await F.confirmBox({ title: 'تخطّي الفقرة؟', text: 'ننتقل للفقرة اللي بعدها بدون نقاط.', yes: 'تخطَّ' });
    if (ok) { run.gi = run.gi; gameBoardOrNext(); }
  });
  function gameBoardOrNext() { if (run.gi + 1 >= run.queue.length) endShow(); else nextGame(); }
  // لوحة المفاتيح: المسافة أو Enter = التالي
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input,textarea,select') || !$('#settingsModal').hidden || !$('#hostQ').hidden) return;
    if (e.key === ' ' || e.key === 'Enter') {
      const scr = $('.screen.active');
      if (scr && scr.id === 'screen-stage' && !$('#nextBtn').disabled) { e.preventDefault(); $('#nextBtn').click(); }
      if (scr && scr.id === 'screen-board') { e.preventDefault(); $('#boardNext').click(); }
    }
  });

  // =========================================================
  // البدء والاستئناف
  // =========================================================
  F.initChrome();
  $('#booths').innerHTML = boothsHTML();
  $('#localNote').hidden = !Net.local;
  Net.onStatus(netStatus);
  Net.offset((v) => { offset = v; });

  // استئناف غرفة مفتوحة بعد تحديث الصفحة
  (async () => {
    const saved = store.get('fazaa-host-room');
    if (!saved) return;
    try {
      const s = await Net.get(saved + '/s');
      if (!s) { store.del('fazaa-host-room'); return; }
      room = saved;
      T = (await Net.get(path('T'))) || {};
      ind = Object.keys(T).length === 1;
      SCORE = Object.assign({ T: {}, P: {}, G: {} }, (await Net.get(path('sc'))) || {});
      const cfg = await Net.get(path('cfg'));
      S = s;
      enterLobby();
      if (cfg && s.ph !== 'lobby' && s.ph !== 'end') {
        const o = JSON.parse(cfg);
        run = o.run;
        if (run && run.queue && run.gi >= 0 && run.gi < run.queue.length) {
          F.toast('رجعنا للغرفة ' + ar(room));
          if (run.ri < 0) { run.gi--; nextGame(); } else gameBoard();
        }
      }
    } catch (e) { console.warn(e); }
  })();
})();
