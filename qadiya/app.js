/* =========================================================
   القضية | شاشة المشرف
   مراحل اللعبة: setup → prep → (lobby | deal) → play → vote → reveal → (tie) → over
   ========================================================= */
(() => {
  'use strict';
  const { $, $$, num, esc, COLORS, ICONS, CATS, CK, CATMAP, catOf, nameOf, store, rand, pick, shuffle, uid, fill, cardHTML, S, initChrome, toast, confetti } = window.Q;
  const NET = window.QadiyaNet;
  // بنك أسئلة أثَر (من سهمك الصاعد): الخيار الأول هو الصحيح
  const BANK = (window.SAHM_QUESTIONS || []).filter((q) => q && q.q && Array.isArray(q.a) && q.a.length >= 2);

  const SKEY = 'athar-qadiya-settings';
  const GKEY = 'athar-qadiya-game';
  const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
  const DETAILS = ['victim', 'weapon', 'place', 'time'];

  // القوائم الأصلية (من لوحة المثال) مع عناصر إضافية تكفي ٦ فرق
  const DEFAULT_LISTS = {
    killer: ['فوزي', 'جاسر', 'يوسف', 'فيصل', 'حامد', 'ماجد', 'سلطان'],
    victim: ['أبو عامر', 'أبو حمد', 'أبو عثمان', 'أبو نورة', 'أبو راشد', 'أبو خالد', 'أبو سعد'],
    weapon: ['سيف', 'حجر', 'سكين', 'مسدس', 'سم', 'حبل', 'عصا'],
    place: ['مدرسة', 'صحراء', 'مزرعة', 'شقة', 'حديقة', 'استراحة', 'سوق'],
    time: ['٤:٠٠ فجرًا', '٧:٠٠ صباحًا', '١٠:٠٠ صباحًا', '٣:٠٠ ظهرًا', '٥:٠٠ عصرًا', '٨:٠٠ مساءً', '١٢:٠٠ ليلًا']
  };
  const defSettings = () => ({
    mode: 'local', count: 4, names: ORD.map((o) => `الفريق ${o}`),
    qSource: 'bank', rounds: 3, lists: JSON.parse(JSON.stringify(DEFAULT_LISTS))
  });

  // العبارات العفوية
  const SAY = {
    turn: ['يله دوركم يا {t}', 'السؤال عليكم يا {t}، ركّزوا', 'ورّونا شطارتكم يا {t}', 'فرصتكم يا {t}… لا تضيّعونها'],
    ok: ['كفو يا {t}!', 'يا سلام عليكم يا {t}!', 'ضربة معلّم يا {t}!', 'ما شاء الله عليكم يا {t}!', 'عداكم العيب يا {t}!'],
    bad: ['أفا! الجواب غلط', 'راحت عليكم يا {t}!', 'معليش يا {t}، الجايات أكثر', 'يا {t} ركّزوا شوي!'],
    take: ['سرقة عيني عينك! {t} خذوا ورقة من {o}', 'يا ساتر! {t} شالوا ورقة من {o}', '{o}، ودّعوا ورقة من أوراقكم… خذوها {t}'],
    win: ['الفااائز ويستاهل', 'مبروك يا أبطال!', 'كفو والله، تستاهلون!', 'هذي الهيبة!']
  };

  let set = loadSettings();
  let G = store.get(GKEY, null);
  if (G && G.v !== 1) G = null;

  const el = {
    fileBtn: $('#fileBtn'), counts: $('#counts'), teamInputs: $('#teamInputs'), listGrid: $('#listGrid'),
    needN: $('#needN'), roundsOut: $('#roundsOut'), setupError: $('#setupError'),
    resumeCard: $('#resumeCard'), resumeText: $('#resumeText'),
    prepBoard: $('#prepBoard'), prepNext: $('#prepNext'),
    joinGrid: $('#joinGrid'), netNote: $('#netNote'), dealGrid: $('#dealGrid'),
    roundPill: $('#roundPill'), turnChip: $('#turnChip'), board: $('#board'), turnPanel: $('#turnPanel'),
    teamsStrip: $('#teamsStrip'), log: $('#log'),
    voteKicker: $('#voteKicker'), voteLead: $('#voteLead'), voteGrid: $('#voteGrid'), revealBtn: $('#revealBtn'),
    revealTitle: $('#revealTitle'), accuseGrid: $('#accuseGrid'), verdict: $('#verdict'), revealActions: $('#revealActions'),
    tieLead: $('#tieLead'), tieQ: $('#tieQ'), tieTeams: $('#tieTeams'),
    winnerName: $('#winnerName'), winnerText: $('#winnerText'), solution: $('#solution'), finalBoard: $('#finalBoard'),
    confetti: $('#confetti'), trophy: $('.trophy')
  };

  // =========================================================
  // الإعدادات
  // =========================================================
  function loadSettings() {
    const d = defSettings();
    const s = Object.assign(d, store.get(SKEY, {}) || {});
    if (!['local', 'phones'].includes(s.mode)) s.mode = 'local';
    s.count = Math.min(6, Math.max(2, +s.count || 4));
    if (!Array.isArray(s.names)) s.names = d.names;
    while (s.names.length < 6) s.names.push(`الفريق ${ORD[s.names.length]}`);
    if (!['bank', 'host'].includes(s.qSource)) s.qSource = 'bank';
    s.rounds = Math.min(6, Math.max(1, +s.rounds || 3));
    CK.forEach((k) => { if (!Array.isArray(s.lists?.[k])) s.lists[k] = [...DEFAULT_LISTS[k]]; });
    return s;
  }
  const saveSettings = () => store.set(SKEY, set);
  const cleanList = (arr) => [...new Set((arr || []).map((x) => String(x).trim()).filter(Boolean))].slice(0, 20);

  function renderSetup() {
    $$('.mode').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === set.mode)));
    $$('#qSource button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.q === set.qSource)));
    el.roundsOut.textContent = num(set.rounds);
    el.needN.textContent = num(set.count + 1);

    el.counts.innerHTML = '';
    for (let n = 2; n <= 6; n++) {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = num(n);
      b.setAttribute('aria-pressed', String(n === set.count));
      b.setAttribute('aria-label', `${num(n)} فرق`);
      b.addEventListener('click', () => { set.count = n; saveSettings(); S.tongue(0, 0.2); renderSetup(); });
      el.counts.append(b);
    }
    el.teamInputs.innerHTML = '';
    for (let i = 0; i < set.count; i++) {
      const row = document.createElement('label');
      row.className = 'team-row'; row.style.setProperty('--c', COLORS[i]);
      row.innerHTML = `<span class="team-no">${num(i + 1)}</span><input type="text" maxlength="22" autocomplete="off" aria-label="اسم الفريق ${num(i + 1)}">`;
      const inp = $('input', row);
      inp.value = set.names[i]; inp.placeholder = `الفريق ${ORD[i]}`;
      inp.addEventListener('input', () => { set.names[i] = inp.value; saveSettings(); });
      el.teamInputs.append(row);
    }

    if (!el.listGrid.childElementCount) {
      CATS.forEach((c) => {
        const box = document.createElement('label');
        box.className = 'list-box'; box.dataset.cat = c.k;
        box.innerHTML = `<span class="list-label"><span class="ev-ico">${ICONS[c.k]}</span>${c.name} <em></em></span><textarea rows="7" spellcheck="false"></textarea>`;
        const ta = $('textarea', box);
        ta.addEventListener('input', () => { set.lists[c.k] = ta.value.split('\n'); saveSettings(); countLists(); });
        el.listGrid.append(box);
      });
    }
    $$('.list-box', el.listGrid).forEach((box) => {
      const ta = $('textarea', box);
      if (document.activeElement !== ta) ta.value = set.lists[box.dataset.cat].join('\n');
    });
    countLists();

    // متابعة لعبة محفوظة
    if (G && G.phase !== 'over') {
      el.resumeCard.hidden = false;
      const ph = { prep: 'القضية جاهزة', lobby: 'انضمام الفرق', deal: 'توزيع البطاقات', play: 'فقرة الأسئلة', vote: 'التصويت', reveal: 'لحظة الحقيقة', tie: 'سؤال الحسم' }[G.phase] || '';
      el.resumeText.textContent = `${G.teams.map((t) => t.name).join('، ')}، وصلتوا: ${ph}`;
    } else el.resumeCard.hidden = true;
  }

  function countLists() {
    $$('.list-box', el.listGrid).forEach((box) => {
      const n = cleanList(set.lists[box.dataset.cat]).length;
      const em = $('em', box);
      em.textContent = `(${num(n)})`;
      box.classList.toggle('short', n < set.count + 1);
    });
  }

  function setupError(msg) {
    el.setupError.textContent = msg;
    el.setupError.hidden = !msg;
    if (msg) { S.sigh(); el.setupError.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  // =========================================================
  // إنشاء القضية والتوزيع
  // =========================================================
  function pickItems(T) {
    const items = {};
    CK.forEach((k) => {
      const list = cleanList(set.lists[k]);
      const idx = shuffle(list.map((_, i) => i)).slice(0, T + 1).sort((a, b) => a - b);
      items[k] = idx.map((i) => list[i]);
    });
    return items;
  }

  // يوزّع: واحد من كل نوع هو الحل، والباقي لكل فريق بطاقة من كل نوع
  function deal(fixed) {
    G.sol = {};
    G.teams.forEach((t) => { t.hand = []; t.known = []; t.lost = []; t.seen = false; });
    CK.forEach((k) => {
      const n = G.items[k].length;
      const s = fixed && fixed[k] != null ? fixed[k] : rand(n);
      G.sol[k] = s;
      const rest = shuffle([...Array(n).keys()].filter((i) => i !== s));
      G.teams.forEach((t, i) => { const id = `${k}:${rest[i]}`; t.hand.push(id); t.known.push([id, -1]); });
    });
  }

  function createGame() {
    const T = set.count;
    for (const c of CATS) {
      if (cleanList(set.lists[c.k]).length < T + 1) {
        return setupError(`قائمة «${c.name}» تحتاج ${num(T + 1)} عناصر على الأقل (عدد الفرق + ١). افتح «عناصر القضية» وزِد عليها.`);
      }
    }
    setupError('');
    const qSource = BANK.length ? set.qSource : 'host';
    G = {
      v: 1, id: uid(6), mode: set.mode, qSource, rounds: set.rounds,
      teams: set.names.slice(0, T).map((n, i) => ({ name: n.trim() || `الفريق ${ORD[i]}`, color: COLORS[i], hand: [], known: [], lost: [], seen: false, on: false })),
      items: pickItems(T), sol: {}, phase: 'prep', turn: null, log: [], votes: [], voteRound: 1, wrong: [], reveal: null, winner: -1,
      q: { order: shuffle(BANK.map((_, i) => i)), pos: 0, opts: null, shown: false },
      net: set.mode === 'phones' ? { room: uid(5), keys: Array.from({ length: T }, () => uid(4)), seq: 0, since: 'all', seen: [] } : null
    };
    deal();
    S.whoosh();
    commit();
  }

  const knows = (t, id) => G.teams[t].known.some((k) => k[0] === id);
  const isSol = (id) => G.sol[catOf(id)] === +id.split(':')[1];
  const cardName = (id) => nameOf(G.items, id);
  const tName = (i) => G.teams[i].name;
  const solId = (k) => `${k}:${G.sol[k]}`;

  // =========================================================
  // الحفظ والتوجيه
  // =========================================================
  let saveT = 0;
  const save = () => { clearTimeout(saveT); if (G) store.set(GKEY, G); };
  const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(save, 400); };

  function commit() { save(); go(); publishSoon(); }

  let current = '';
  function show(id) {
    if (current !== id) {
      $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
      current = id;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    el.fileBtn.hidden = !G || id === 'screen-setup';
  }

  function go() {
    if (!G) { renderSetup(); return show('screen-setup'); }
    if (G.net) connectHost();
    switch (G.phase) {
      case 'prep': renderPrep(); return show('screen-prep');
      case 'lobby': renderLobby(); return show('screen-lobby');
      case 'deal': renderDeal(); return show('screen-deal');
      case 'play': renderPlay(); return show('screen-play');
      case 'vote': renderVote(); return show('screen-vote');
      case 'reveal': renderReveal(); return show('screen-reveal');
      case 'tie': renderTie(); return show('screen-tie');
      case 'over': renderVictory(); return show('screen-victory');
      default: renderSetup(); return show('screen-setup');
    }
  }

  // =========================================================
  // اللوحة العامة
  // =========================================================
  function boardHTML() {
    return CATS.map((c) => `<div class="col" data-cat="${c.k}">
      <div class="col-head"><span class="ev-ico">${ICONS[c.k]}</span><b>${c.name}</b></div>
      <ul>${G.items[c.k].map((name, i) => {
        const out = c.k === 'killer' && G.wrong.includes(i);
        return `<li class="${out ? 'out' : ''}">${esc(name)}${out ? '<small>استُبعد بالتصويت</small>' : ''}</li>`;
      }).join('')}</ul>
    </div>`).join('');
  }

  // =========================================================
  // القضية جاهزة
  // =========================================================
  function renderPrep() {
    el.prepBoard.innerHTML = boardHTML();
    el.prepNext.textContent = G.mode === 'phones' ? 'التالي: انضمام الفرق بالجوال' : 'التالي: توزيع البطاقات السرية';
  }

  // =========================================================
  // انضمام الفرق (جوال لكل فريق)
  // =========================================================
  const teamCode = (i) => G.net.room + G.net.keys[i];
  const prettyCode = (c) => `${c.slice(0, 5)}-${c.slice(5)}`;
  const teamLink = (i) => new URL(`team.html${NET.local ? '?net=local' : ''}#${teamCode(i)}`, location.href).href;
  const joinBase = () => new URL('team.html', location.href).href;

  function qrSVG(text) {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(text); q.make();
      return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'رمز QR للانضمام' });
    } catch { return ''; }
  }

  function renderLobby() {
    el.joinGrid.innerHTML = '';
    G.teams.forEach((t, i) => {
      const c = document.createElement('div');
      c.className = 'join-card' + (t.on ? ' on' : '');
      c.style.setProperty('--c', t.color);
      c.innerHTML = `<div class="join-head"><span class="team-no">${num(i + 1)}</span><b>${esc(t.name)}</b></div>
        <div class="qr">${qrSVG(teamLink(i))}</div>
        <div class="code" dir="ltr">${prettyCode(teamCode(i))}</div>
        <div class="join-status">${t.on ? 'انضموا ✓' : 'بانتظار الانضمام…'}</div>
        <button class="btn btn-sm copy">انسخ الرابط</button>`;
      $('.copy', c).addEventListener('click', () => copyText(teamLink(i)));
      el.joinGrid.append(c);
    });
    el.netNote.innerHTML = `أو من أي جوال افتحوا: <a href="${esc(joinBase())}" target="_blank" rel="noopener" dir="ltr">${esc(joinBase().replace(/^https?:\/\//, ''))}</a> واكتبوا رمز الفريق.
      <span class="net-dot ${hostNetOn ? 'on' : ''}"></span><span class="muted">${hostNetOn ? 'الاتصال شغّال' : 'جاري الاتصال…'}</span>`;
  }

  function copyText(s) {
    const done = () => { toast('انتسخ الرابط ✓'); S.tongue(0, 0.2); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(s).then(done, () => fallback());
    else fallback();
    function fallback() {
      const ta = document.createElement('textarea'); ta.value = s; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch { /* تجاهل */ }
      ta.remove();
    }
  }

  // =========================================================
  // توزيع البطاقات (شاشة واحدة)
  // =========================================================
  function renderDeal() {
    el.dealGrid.innerHTML = '';
    G.teams.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'deal-tile' + (t.seen ? ' seen' : '');
      b.style.setProperty('--c', t.color);
      b.innerHTML = `<span class="team-no">${num(i + 1)}</span><b>${esc(t.name)}</b><small>${t.seen ? 'شافوا بطاقاتهم ✓' : 'اضغطوا لعرض بطاقاتكم'}</small>`;
      b.addEventListener('click', () => showHand(i, () => { G.teams[i].seen = true; commit(); }));
      el.dealGrid.append(b);
    });
  }

  // عرض كل ما يعرفه الفريق خلف الستارة
  function showHand(i, after) {
    const t = G.teams[i];
    openSecret({
      team: i,
      bodyTitle: `بطاقات ${t.name}`,
      bodyText: 'كل بطاقة هنا مو من القضية. سجّلوها عندكم ولا تعلّمون أحد.',
      render: (box) => { box.innerHTML = knownHTML(i); },
      onDone: after
    });
  }

  function knownHTML(i) {
    const t = G.teams[i];
    return `<div class="cards-grid">${CK.flatMap((k) => t.known.filter((x) => catOf(x[0]) === k)).map(([id, from]) => {
      const tag = from === -1 ? (t.hand.includes(id) ? 'بطاقتكم' : 'كانت عندكم') : from === -2 ? 'تلميح' : `من ${G.teams[from].name}`;
      return cardHTML(G.items, id, { tag: `${CATMAP[catOf(id)].name}، ${tag}` });
    }).join('')}</div>`;
  }

  // =========================================================
  // فقرة الأسئلة
  // =========================================================
  function startPlay() {
    G.phase = 'play';
    G.turn = { t: 0, n: 0, total: G.rounds * G.teams.length, step: 'ask', tok: '', card: '', from: -1 };
    prepareQuestion();
    S.whoosh();
    toast(fill(pick(SAY.turn), { t: tName(0) }), G.teams[0].color);
    commit();
  }

  function prepareQuestion() {
    G.q.shown = false;
    if (G.qSource !== 'bank' || !BANK.length) { G.q.opts = null; return; }
    const q = BANK[G.q.order[G.q.pos % G.q.order.length]];
    G.q.opts = shuffle(q.a.map((_, i) => i));
  }
  const curQ = () => BANK[G.q.order[G.q.pos % G.q.order.length]];

  function qHTML(withReveal = true) {
    if (G.qSource !== 'bank' || !G.q.opts) {
      return '<div class="q-box host-q"><span class="ev-ico">?</span><p>المشرف يطرح سؤاله الآن</p></div>';
    }
    const q = curQ();
    return `<div class="q-box">
      <p class="q-text">${esc(q.q)}</p>
      <ol class="opts">${G.q.opts.map((oi, n) => `<li class="${G.q.shown && oi === 0 ? 'right' : ''}"><span>${'أبجد'[n] || num(n + 1)}</span>${esc(q.a[oi])}</li>`).join('')}</ol>
      ${withReveal ? `<div class="q-tools">
        <button class="btn btn-sm" data-act="qReveal">${G.q.shown ? 'أخفِ الإجابة' : 'اكشف الإجابة'}</button>
        <button class="btn btn-sm btn-ghost" data-act="qSkip">غيّر السؤال</button>
      </div>` : ''}
    </div>`;
  }

  const round = () => Math.floor(G.turn.n / G.teams.length) + 1;
  const roundsTotal = () => Math.ceil(G.turn.total / G.teams.length);
  const opponentsFor = (t) => G.teams.map((_, i) => i).filter((i) => i !== t && G.teams[i].hand.some((id) => !knows(t, id)));
  // البطاقات اللي ما يعرفها الفريق ومو من الحل (للتلميح)
  const hintPool = (t) => CK.flatMap((k) => G.items[k].map((_, i) => `${k}:${i}`)).filter((id) => !isSol(id) && !knows(t, id));

  function renderPlay() {
    const tr = G.turn, t = G.teams[tr.t];
    el.roundPill.innerHTML = tr.step === 'end' ? 'خلصت فقرة الأسئلة' : `السؤال ${num(round())} من ${num(roundsTotal())} لكل فريق`;
    el.turnChip.style.setProperty('--c', t.color);
    el.turnChip.innerHTML = tr.step === 'end' ? '<b>جاهزين للتصويت</b>' : `<span class="dot"></span>الدور على: <b>${esc(t.name)}</b>`;
    el.board.innerHTML = boardHTML();

    // لوحة الدور
    const P = el.turnPanel;
    P.style.setProperty('--c', t.color);
    if (tr.step === 'ask') {
      P.innerHTML = `<div class="tp-head"><span class="team-badge">${esc(t.name)}</span><span class="muted">السؤال عليكم</span></div>
        ${qHTML()}
        <div class="eval">
          <button class="btn btn-correct" data-act="ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>صح<small>ياخذون ورقة من خصم</small></button>
          <button class="btn btn-wrong" data-act="bad"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke-width="3" stroke-linecap="round"/></svg>غلط<small>الدور للي بعدهم</small></button>
        </div>`;
    } else if (tr.step === 'pick') {
      const opps = opponentsFor(tr.t);
      P.innerHTML = `<div class="tp-head"><span class="team-badge">${esc(t.name)}</span><span class="muted">جوابكم صح</span></div>
        <h3 class="tp-title">اختاروا الخصم اللي تاخذون منه ورقة</h3>
        <p class="muted">${G.mode === 'phones' ? 'يختارونه من جوالهم، أو اختر عنهم هنا.' : 'الورقة تطلع عشوائية من أوراقه، وتشوفونها بس أنتم.'}</p>
        <div class="opp-grid">${G.teams.map((o, i) => i === tr.t ? '' : `<button class="opp" style="--c:${o.color}" data-act="opp" data-i="${i}" ${opps.includes(i) ? '' : 'disabled'}>
          <b>${esc(o.name)}</b><small>${opps.includes(i) ? `عنده ${num(o.hand.length)} أوراق` : 'ما عنده جديد لكم'}</small></button>`).join('')}</div>`;
    } else if (tr.step === 'card') {
      const hint = tr.from === -2;
      P.innerHTML = `<div class="tp-head"><span class="team-badge">${esc(t.name)}</span></div>
        <div class="card-back" aria-hidden="true"><span>؟</span></div>
        <h3 class="tp-title">${hint ? `ما عند الخصوم جديد… ${esc(t.name)} خذوا تلميحًا من الملف` : `${esc(t.name)} خذوا ورقة من ${esc(tName(tr.from))}`}</h3>
        ${G.mode === 'phones'
          ? `<p class="muted">وصلت الورقة على جوال ${esc(t.name)}</p><button class="btn btn-ghost btn-sm" data-act="showCard">ما وصلت؟ اعرضها هنا</button>`
          : `<button class="btn" data-act="showCard">اعرض الورقة لـ${esc(t.name)}</button>`}
        <button class="btn btn-primary btn-big" data-act="next">الدور اللي بعده</button>`;
    } else {
      P.innerHTML = `<div class="tp-done"><h3 class="tp-title">خلصت فقرة الأسئلة!</h3>
        <p class="muted">كل فريق يراجع بطاقاته ويجهّز اتهامه.</p>
        <button class="btn btn-primary btn-big" data-act="vote">يلا للتصويت</button></div>`;
    }
    $('#toVoteBtn').hidden = tr.step === 'end';

    // شريط الفرق
    el.teamsStrip.innerHTML = '';
    G.teams.forEach((x, i) => {
      const d = document.createElement('div');
      d.className = 'tchip' + (i === tr.t && tr.step !== 'end' ? ' active' : '');
      d.style.setProperty('--c', x.color);
      d.innerHTML = `<span class="team-no">${num(i + 1)}</span>
        <span class="tchip-text"><b>${esc(x.name)}</b><small>${num(x.hand.length)} أوراق بيدهم، يعرفون ${num(x.known.length)}</small></span>
        ${G.mode === 'phones' ? `<span class="net-dot ${x.on ? 'on' : ''}" title="${x.on ? 'متصل' : 'غير متصل'}"></span>` : `<button class="btn btn-sm" data-act="hand" data-i="${i}">بطاقاتنا</button>`}`;
      el.teamsStrip.append(d);
    });

    // السجل
    el.log.innerHTML = G.log.length ? [...G.log].reverse().map(logLine).join('') : '<li class="muted">ما صار شي للحين… بسم الله نبدأ</li>';
  }

  function logLine(e) {
    const c = (i) => `<b style="--c:${G.teams[i].color}">${esc(tName(i))}</b>`;
    if (e.k === 'take') return `<li>${c(e.a)} خذوا ورقة من ${c(e.b)}</li>`;
    if (e.k === 'hint') return `<li>${c(e.a)} خذوا تلميحًا من الملف</li>`;
    if (e.k === 'miss') return `<li class="muted">${c(e.a)} ما وفّقوا في السؤال</li>`;
    if (e.k === 'revote') return `<li class="muted">ولا فريق عرف القاتل… إعادة التصويت</li>`;
    if (e.k === 'extra') return `<li class="muted">جولة أسئلة إضافية</li>`;
    return '';
  }

  function answerOk() {
    const tr = G.turn;
    S.chirp(); S.chirp(0.12, 3500);
    toast(fill(pick(SAY.ok), { t: tName(tr.t) }), G.teams[tr.t].color);
    if (opponentsFor(tr.t).length) {
      tr.step = 'pick'; tr.tok = uid(4);
    } else if (!giveHint(tr.t, true)) {
      toast(`${tName(tr.t)} يعرفون كل البطاقات! القضية محلولة عندهم`);
      return nextTurn();
    }
    commit();
  }

  function answerBad() {
    S.sigh();
    toast(fill(pick(SAY.bad), { t: tName(G.turn.t) }));
    G.log.push({ k: 'miss', a: G.turn.t });
    nextTurn();
  }

  function doPick(opp) {
    const tr = G.turn, me = tr.t;
    if (G.phase !== 'play' || tr.step !== 'pick') return;
    const cands = G.teams[opp].hand.filter((id) => !knows(me, id));
    if (!cands.length) return;
    const id = pick(cands);
    G.teams[opp].hand = G.teams[opp].hand.filter((x) => x !== id);
    G.teams[me].hand.push(id);
    G.teams[me].known.push([id, opp]);
    G.teams[opp].lost.push([id, me]);
    G.log.push({ k: 'take', a: me, b: opp });
    tr.step = 'card'; tr.card = id; tr.from = opp; tr.tok = '';
    S.whoosh(); S.tongue(0.25, 0.25);
    toast(fill(pick(SAY.take), { t: tName(me), o: tName(opp) }), G.teams[me].color);
    commit();
  }

  // تلميح: بطاقة غير معروفة للفريق ومو من الحل (لا تنتقل من صاحبها)
  function giveHint(t, asTurn) {
    const pool = hintPool(t);
    if (!pool.length) return false;
    const id = pick(pool);
    G.teams[t].known.push([id, -2]);
    G.log.push({ k: 'hint', a: t });
    if (asTurn) { G.turn.step = 'card'; G.turn.card = id; G.turn.from = -2; }
    S.whoosh();
    return id;
  }

  function showCard(t, id) {
    openSecret({
      team: t,
      bodyTitle: 'ورقتكم الجديدة',
      bodyText: `«${cardName(id)}» ${CATMAP[catOf(id)].not}. سجّلوها عندكم.`,
      render: (box) => { box.innerHTML = `<div class="cards-grid one">${cardHTML(G.items, id, { cls: 'flip' })}</div>`; }
    });
  }

  function nextTurn() {
    const tr = G.turn;
    tr.n++; tr.card = ''; tr.from = -1; tr.tok = '';
    G.q.pos++; prepareQuestion();
    if (tr.n >= tr.total) {
      tr.step = 'end';
      S.gust();
    } else {
      tr.t = (tr.t + 1) % G.teams.length;
      tr.step = 'ask';
      S.tongue(0, 0.22);
    }
    commit();
  }

  // =========================================================
  // التصويت
  // =========================================================
  function startVote() {
    G.phase = 'vote';
    G.votes = G.teams.map(() => null);
    S.gust();
    commit();
  }

  function renderVote() {
    el.voteKicker.textContent = G.voteRound > 1 ? `إعادة التصويت، المحاولة ${num(G.voteRound)}` : 'التصويت النهائي';
    const wrong = G.wrong.length ? ` المستبعدون من القتلة: ${G.wrong.map((i) => G.items.killer[i]).join('، ')}.` : '';
    el.voteLead.textContent = (G.mode === 'phones'
      ? 'كل فريق يرسل اتهامه من جواله: القاتل والمقتول والأداة والمكان والوقت.'
      : 'كل فريق يسجّل اتهامه بسرّية: القاتل والمقتول والأداة والمكان والوقت.') + wrong;
    el.voteGrid.innerHTML = '';
    G.teams.forEach((t, i) => {
      const done = !!G.votes[i];
      const d = document.createElement('div');
      d.className = 'vote-tile' + (done ? ' done' : '');
      d.style.setProperty('--c', t.color);
      d.innerHTML = `<span class="team-no">${num(i + 1)}</span>
        <span class="tchip-text"><b>${esc(t.name)}</b><small>${done ? 'وصل الاتهام ✓' : G.mode === 'phones' ? 'بانتظار اتهامهم من الجوال…' : 'ما سجّلوا للحين'}</small></span>
        <button class="btn btn-sm ${G.mode === 'local' && !done ? 'btn-primary' : 'btn-ghost'}" data-act="vote" data-i="${i}">${done ? 'عدّل' : G.mode === 'phones' ? 'سجّل عنهم' : 'سجّلوا اتهامكم'}</button>`;
      el.voteGrid.append(d);
    });
    const all = G.votes.every(Boolean);
    el.revealBtn.classList.toggle('waiting', !all);
    el.revealBtn.textContent = all ? 'اكشف الاتهامات' : `اكشف الاتهامات (${num(G.votes.filter(Boolean).length)} من ${num(G.teams.length)})`;
  }

  function voteForm(i) {
    const sel = Object.assign({}, G.votes[i] || {});
    openSecret({
      team: i,
      bodyTitle: `اتهام ${tName(i)}`,
      bodyText: 'اختاروا واحد من كل نوع.',
      doneLabel: 'اعتمد الاتهام',
      render: (box, setReady) => {
        box.innerHTML = accuseFormHTML(sel);
        const sync = () => setReady(CK.every((k) => sel[k] != null));
        box.onclick = (e) => {
          const b = e.target.closest('[data-k]');
          if (!b || b.disabled) return;
          sel[b.dataset.k] = +b.dataset.i;
          $$(`[data-k="${b.dataset.k}"]`, box).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          S.tongue(0, 0.18); sync();
        };
        sync();
      },
      onDone: () => { G.votes[i] = sel; S.drop(620); toast(`وصل اتهام ${tName(i)} ✓`, G.teams[i].color); commit(); }
    });
  }

  function accuseFormHTML(sel) {
    return CATS.map((c) => `<fieldset class="pick-row"><legend><span class="ev-ico">${ICONS[c.k]}</span>${c.name}</legend>
      <div class="pick-chips">${G.items[c.k].map((n, i) => {
        const out = c.k === 'killer' && G.wrong.includes(i);
        return `<button type="button" class="pchip" data-k="${c.k}" data-i="${i}" aria-pressed="${sel[c.k] === i}" ${out ? 'disabled' : ''}>${esc(n)}</button>`;
      }).join('')}</div></fieldset>`).join('');
  }

  function reveal() {
    const res = G.teams.map((_, i) => {
      const v = G.votes[i];
      if (!v) return { i, none: true, killer: false, det: 0 };
      return { i, killer: v.killer === G.sol.killer, det: DETAILS.filter((k) => v[k] === G.sol[k]).length };
    });
    const cands = res.filter((r) => r.killer);
    if (!cands.length) {
      const guessed = [...new Set(G.votes.filter(Boolean).map((v) => v.killer))];
      G.wrong = [...new Set([...G.wrong, ...guessed])];
      G.reveal = { ok: false, res, newWrong: guessed, anim: true };
    } else {
      const best = Math.max(...cands.map((r) => r.det));
      G.reveal = { ok: true, res, best, ties: cands.filter((r) => r.det === best).map((r) => r.i), anim: true };
    }
    G.phase = 'reveal';
    S.gust();
    commit();
  }

  // =========================================================
  // لحظة الحقيقة
  // =========================================================
  function renderReveal() {
    const R = G.reveal, anim = R.anim;
    R.anim = false; saveSoon();
    el.revealTitle.textContent = R.ok ? 'اتهامات الفرق' : 'مَن اتهمتوا بالقتل؟';
    el.accuseGrid.innerHTML = '';
    G.teams.forEach((t, i) => {
      const v = G.votes[i], r = R.res[i];
      const d = document.createElement('div');
      d.className = 'accuse' + (anim ? ' anim' : '') + (R.ok && r.killer ? ' good' : '');
      d.style.setProperty('--c', t.color);
      d.style.animationDelay = `${0.25 * i}s`;
      d.innerHTML = `<div class="accuse-head"><b>${esc(t.name)}</b>${R.ok ? `<span>${r.killer ? `عرفوا القاتل، و${num(r.det)} من ٤ تفاصيل` : r.none ? 'ما صوّتوا' : 'أخطأوا القاتل'}</span>` : ''}</div>
        ${v ? `<ul>${CATS.filter((c) => R.ok || c.k === 'killer').map((c) => {
          const right = v[c.k] === G.sol[c.k];
          const mark = R.ok ? (right ? 'right' : 'wrong') : (c.k === 'killer' ? 'wrong' : '');
          return `<li class="${mark}"><span class="ev-ico">${ICONS[c.k]}</span><small>${c.name}</small><b>${esc(G.items[c.k][v[c.k]])}</b></li>`;
        }).join('')}</ul>${R.ok ? '' : '<p class="muted hide-note">باقي التفاصيل مخفية لين ينكشف القاتل</p>'}` : '<p class="muted">ما وصل اتهامهم</p>'}`;
      el.accuseGrid.append(d);
    });

    const V = el.verdict, A = el.revealActions;
    V.hidden = false;
    V.className = 'verdict' + (anim ? ' anim' : '');
    V.style.animationDelay = anim ? `${0.25 * G.teams.length + 0.4}s` : '0s';
    A.innerHTML = '';
    if (!R.ok) {
      V.innerHTML = `<h2>أفا! ولا فريق عرف القاتل</h2>
        <p>طلعوا من قائمة القتلة: <b>${R.newWrong.map((k) => esc(G.items.killer[k])).join('، ') || '—'}</b></p>
        <p class="muted">نعيد التصويت، أو نلعب جولة أسئلة إضافية تجيب أوراق أكثر.</p>`;
      A.innerHTML = `<button class="btn btn-primary btn-big" data-act="revote">أعيدوا التصويت</button>
        <button class="btn" data-act="extra">جولة أسئلة إضافية ثم تصويت</button>`;
      if (anim) setTimeout(() => S.sigh(), 900 + 250 * G.teams.length);
    } else {
      V.innerHTML = `<h2>الحل الصحيح</h2>
        <div class="cards-grid sol">${CK.map((k) => cardHTML(G.items, solId(k), { cls: 'flip' })).join('')}</div>
        <p>${R.ties.length > 1 ? `راس براس! ${R.ties.map((i) => esc(tName(i))).join(' و')} عرفوا القاتل و${num(R.best)} من ٤ تفاصيل` : `${esc(tName(R.ties[0]))} عرفوا القاتل و${num(R.best)} من ٤ تفاصيل`}</p>`;
      A.innerHTML = R.ties.length > 1
        ? '<button class="btn btn-primary btn-big" data-act="tie">سؤال الحسم</button>'
        : '<button class="btn btn-primary btn-big" data-act="win">ورّني الفائز</button>';
      if (anim) setTimeout(() => { S.chirp(); S.chirp(0.15, 3400); }, 900 + 250 * G.teams.length);
    }
  }

  function revote(extra) {
    G.voteRound++;
    G.log.push({ k: extra ? 'extra' : 'revote' });
    if (extra) {
      G.phase = 'play';
      G.turn.total += G.teams.length;
      G.turn.step = 'ask';
      G.turn.t = G.turn.n % G.teams.length;
      prepareQuestion();
    } else {
      G.phase = 'vote';
      G.votes = G.teams.map(() => null);
    }
    G.reveal = null;
    S.whoosh();
    commit();
  }

  // =========================================================
  // سؤال الحسم
  // =========================================================
  function renderTie() {
    const ties = G.reveal.ties;
    el.tieLead.textContent = `${ties.map(tName).join(' و')} تعادلوا… الحسم عند المشرف!`;
    el.tieQ.innerHTML = qHTML();
    el.tieTeams.innerHTML = ties.map((i) => `<button class="opp" style="--c:${G.teams[i].color}" data-act="tieWin" data-i="${i}"><b>${esc(tName(i))}</b><small>جاوبوا أول وصح</small></button>`).join('');
  }

  // =========================================================
  // الفوز
  // =========================================================
  function setWinner(i) {
    G.winner = i;
    G.phase = 'over';
    commit();
    S.winner();
    confetti(el.confetti, [G.teams[i].color], () => current === 'screen-victory');
  }

  function renderVictory() {
    const w = G.teams[G.winner], R = G.reveal;
    el.trophy.style.setProperty('--win', w.color);
    el.winnerName.style.setProperty('--win', w.color);
    el.winnerName.textContent = w.name;
    el.winnerText.textContent = `${pick(SAY.win)}! عرفوا القاتل «${G.items.killer[G.sol.killer]}» و${num(R.res[G.winner].det)} من ٤ تفاصيل.`;
    el.solution.innerHTML = `<h2>ملف القضية</h2><div class="cards-grid sol">${CK.map((k) => cardHTML(G.items, solId(k))).join('')}</div>`;
    const order = [...R.res].sort((a, b) => (b.i === G.winner) - (a.i === G.winner) || b.killer - a.killer || b.det - a.det);
    el.finalBoard.innerHTML = order.map((r, n) => `<div class="final-row${r.i === G.winner ? ' win' : ''}" style="--c:${G.teams[r.i].color}; animation-delay:${0.12 * n + 0.3}s">
      <span class="final-rank">${num(n + 1)}</span><span class="final-name">${esc(tName(r.i))}</span>
      <span class="final-pts">${r.none ? 'ما صوّتوا' : `${r.killer ? 'عرفوا القاتل' : 'أخطأوا القاتل'}، و${num(r.det)} من ٤ تفاصيل`}</span></div>`).join('');
  }

  // =========================================================
  // الملف السري
  // =========================================================
  const fileModal = $('#fileModal');
  function openFile() {
    $('#fileGate').hidden = false; $('#fileBody').hidden = true;
    openModal(fileModal);
  }
  function renderFile() {
    const prep = G.phase === 'prep';
    $('#solGrid').innerHTML = CATS.map((c) => `<label class="sol-slot" data-cat="${c.k}">
      <span class="list-label"><span class="ev-ico">${ICONS[c.k]}</span>${c.name}</span>
      ${prep ? `<select data-k="${c.k}">${G.items[c.k].map((n, i) => `<option value="${i}" ${i === G.sol[c.k] ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : `<b>${esc(G.items[c.k][G.sol[c.k]])}</b>`}
    </label>`).join('');
    $('#solNote').textContent = prep ? 'تقدر تختار الحل بنفسك، والتوزيع يتجدد تلقائيًا.' : 'الحل ثابت بعد بداية التحقيق.';
    const canHint = G.phase === 'play';
    $('#dist').innerHTML = G.teams.map((t, i) => {
      const extra = t.known.filter(([id]) => !t.hand.includes(id));
      return `<div class="dist-row" style="--c:${t.color}">
        <div class="dist-name"><b>${esc(t.name)}</b>${canHint ? `<button class="btn btn-sm" data-hint="${i}">أعطهم تلميحًا</button>` : ''}</div>
        <div class="dist-cards"><span class="muted">بيدهم:</span> ${t.hand.map((id) => `<span class="mini" data-cat="${catOf(id)}">${esc(cardName(id))}</span>`).join('') || '—'}</div>
        ${extra.length ? `<div class="dist-cards"><span class="muted">يعرفون أيضًا:</span> ${extra.map(([id, f]) => `<span class="mini ghost" data-cat="${catOf(id)}">${esc(cardName(id))}</span>`).join('')}</div>` : ''}
      </div>`;
    }).join('');
  }

  $('#fileOpen').addEventListener('click', () => {
    renderFile(); $('#fileGate').hidden = true; $('#fileBody').hidden = false; S.whoosh();
  });
  $('#solGrid').addEventListener('change', (e) => {
    const s = e.target.closest('select'); if (!s || G.phase !== 'prep') return;
    const fixed = Object.assign({}, G.sol, { [s.dataset.k]: +s.value });
    deal(fixed); save(); publishSoon(); renderFile(); toast('تغيّر الحل وتجدد التوزيع');
  });
  $('#dist').addEventListener('click', (e) => {
    const b = e.target.closest('[data-hint]'); if (!b) return;
    const i = +b.dataset.hint;
    const id = giveHint(i, false);
    if (!id) { toast(`${tName(i)} يعرفون كل شي!`); return; }
    commit(); renderFile();
    toast(`أعطيت ${tName(i)} تلميحًا`, G.teams[i].color);
    if (G.mode === 'local') { closeModal(fileModal); showCard(i, id); }
  });
  $('#filePrint').addEventListener('click', () => {
    $('#printSheet').innerHTML = `<h1>القضية — الملف السري للمشرف</h1>
      <h2>الحل</h2><p>${CATS.map((c) => `${c.name}: <b>${esc(G.items[c.k][G.sol[c.k]])}</b>`).join('، ')}</p>
      <h2>بطاقات الفرق</h2>${G.teams.map((t) => `<p><b>${esc(t.name)}:</b> ${t.known.map(([id]) => esc(cardName(id))).join('، ')}</p>`).join('')}`;
    window.print();
  });

  // =========================================================
  // النوافذ
  // =========================================================
  let lastFocus = null;
  function openModal(m) {
    lastFocus = document.activeElement;
    m.hidden = false;
    const f = $('.btn-primary:not([hidden])', m) || $('button', m);
    setTimeout(() => f && f.focus(), 30);
  }
  function closeModal(m) {
    m.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = $$('.modal').find((x) => !x.hidden);
    if (m) closeModal(m);
  });

  function message(title, text, icon = '!') {
    $('#modalTitle').textContent = title; $('#modalText').textContent = text; $('#modalIcon').textContent = icon;
    openModal($('#modal'));
  }
  $('#modalOk').addEventListener('click', () => closeModal($('#modal')));

  let confirmCb = null;
  function ask(title, text, yes, cb) {
    $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; $('#confirmYes').textContent = yes;
    confirmCb = cb; openModal($('#confirm'));
  }
  $('#confirmYes').addEventListener('click', () => { closeModal($('#confirm')); const f = confirmCb; confirmCb = null; f && f(); });
  $('#confirmNo').addEventListener('click', () => { closeModal($('#confirm')); confirmCb = null; });

  // ستارة سرية لفريق: تمنع الفرق الثانية من الشوف
  const secret = $('#secretModal');
  let secretOpts = null;
  function openSecret(o) {
    secretOpts = o;
    const t = G.teams[o.team];
    secret.style.setProperty('--c', t.color);
    $('#secretBadge').textContent = t.name;
    $('#secretTitle').textContent = `سرّي لـ${t.name}`;
    $('#secretGateText').textContent = `باقي الفرق يبعّدون عن الشاشة… ${t.name} بس يقربون.`;
    $('#secretShow').textContent = `نحن ${t.name}، اعرض`;
    $('#secretGate').hidden = false; $('#secretBody').hidden = true;
    openModal(secret);
  }
  $('#secretShow').addEventListener('click', () => {
    const o = secretOpts; if (!o) return;
    $('#secretBodyTitle').textContent = o.bodyTitle;
    $('#secretBodyText').textContent = o.bodyText || '';
    const done = $('#secretDone');
    done.textContent = o.doneLabel || 'تم، أخفِ';
    done.disabled = false;
    $('#secretContent').onclick = null;
    o.render($('#secretContent'), (ok) => { done.disabled = !ok; });
    $('#secretGate').hidden = true; $('#secretBody').hidden = false;
    S.whoosh();
    done.focus();
  });
  $('#secretDone').addEventListener('click', () => {
    const o = secretOpts; secretOpts = null;
    $('#secretContent').innerHTML = '';
    closeModal(secret);
    if (o && o.onDone) o.onDone();
  });

  // =========================================================
  // الاتصال بالجوالات (المشرف)
  // =========================================================
  let hostSub = null, hostRoom = '', hostNetOn = false;
  const lastSent = {};
  let pubT = 0;

  function connectHost() {
    if (!G || !G.net || hostRoom === G.net.room) return;
    if (hostSub) hostSub.close();
    hostRoom = G.net.room;
    Object.keys(lastSent).forEach((k) => delete lastSent[k]);
    hostSub = NET.subscribe(`${G.net.room}-u`, onUp, {
      since: G.net.since,
      onId: (id) => { if (G && G.net) { G.net.since = id; saveSoon(); } },
      onStatus: (s) => {
        hostNetOn = s === 'on';
        if (current === 'screen-lobby') renderLobby();
      }
    });
    publishSoon();
  }

  function onUp(m) {
    if (!G || !G.net || !m || m.room !== G.net.room) return;
    // الفريق يُعرف من مفتاحه السري فقط
    const t = G.net.keys.indexOf(m.k);
    if (t < 0) return;
    if (m.mid) {
      if (G.net.seen.includes(m.mid)) return;
      G.net.seen.push(m.mid);
      if (G.net.seen.length > 60) G.net.seen = G.net.seen.slice(-60);
    }
    if (m.type === 'hello') {
      const was = G.teams[t].on;
      G.teams[t].on = true;
      delete lastSent[t]; delete lastSent.pub;
      if (!was) { S.drop(560); toast(`${tName(t)} انضموا ✓`, G.teams[t].color); }
      commit();
    } else if (m.type === 'pick') {
      if (G.phase === 'play' && G.turn.step === 'pick' && G.turn.t === t && m.tok === G.turn.tok && opponentsFor(t).includes(+m.opp)) doPick(+m.opp);
    } else if (m.type === 'vote') {
      const g = m.g || {};
      const valid = CK.every((k) => Number.isInteger(g[k]) && g[k] >= 0 && g[k] < G.items[k].length) && !G.wrong.includes(g.killer);
      if (G.phase === 'vote' && m.r === G.voteRound && valid) {
        G.votes[t] = g;
        S.drop(620);
        toast(`وصل اتهام ${tName(t)} ✓`, G.teams[t].color);
        commit();
      }
    }
  }

  function publishSoon() {
    if (!G || !G.net) return;
    clearTimeout(pubT);
    pubT = setTimeout(publishAll, 250);
  }

  function pubSnapshot() {
    const tr = G.turn;
    const showRes = G.phase === 'over' || G.phase === 'tie' || (G.phase === 'reveal' && G.reveal && G.reveal.ok);
    return {
      k: 'pub', id: G.id, ph: G.phase,
      tm: G.teams.map((t) => [t.name, t.color, t.hand.length]),
      it: G.items,
      tu: tr ? { t: tr.t, st: tr.step, r: round(), R: roundsTotal(), tok: tr.step === 'pick' ? tr.tok : '', op: tr.step === 'pick' ? opponentsFor(tr.t) : [] } : null,
      lg: G.log.slice(-5),
      vr: G.voteRound, vd: G.votes.map(Boolean), wk: G.wrong,
      rv: G.phase === 'reveal' && G.reveal ? { ok: G.reveal.ok, nw: G.reveal.newWrong || [] } : null,
      res: showRes ? { sol: G.sol, w: G.winner, ties: G.reveal ? G.reveal.ties || [] : [] } : null
    };
  }
  function privSnapshot(i) {
    const t = G.teams[i];
    return { k: 'me', id: G.id, t: i, hd: t.hand, kn: t.known, ls: t.lost, vr: G.votes[i] ? G.voteRound : 0, vg: G.votes[i] || null };
  }

  function publishAll() {
    if (!G || !G.net) return;
    const room = G.net.room;
    const p = pubSnapshot(), ps = JSON.stringify(p);
    if (lastSent.pub !== ps) { lastSent.pub = ps; G.net.seq++; NET.publish(`${room}-p`, Object.assign(p, { s: G.net.seq })); }
    G.teams.forEach((_, i) => {
      const s = privSnapshot(i), ss = JSON.stringify(s);
      if (lastSent[i] !== ss) { lastSent[i] = ss; G.net.seq++; NET.publish(`${room}-${G.net.keys[i]}`, Object.assign(s, { s: G.net.seq })); }
    });
    save();
  }

  // =========================================================
  // الأحداث
  // =========================================================
  $$('.mode').forEach((b) => b.addEventListener('click', () => { set.mode = b.dataset.mode; saveSettings(); S.tongue(0, 0.2); renderSetup(); }));
  $$('#qSource button').forEach((b) => b.addEventListener('click', () => { set.qSource = b.dataset.q; saveSettings(); S.tongue(0, 0.2); renderSetup(); }));
  $('#roundsMinus').addEventListener('click', () => { set.rounds = Math.max(1, set.rounds - 1); saveSettings(); S.drop(420); renderSetup(); });
  $('#roundsPlus').addEventListener('click', () => { set.rounds = Math.min(6, set.rounds + 1); saveSettings(); S.drop(560); renderSetup(); });
  $('#listsReset').addEventListener('click', () => { set.lists = JSON.parse(JSON.stringify(DEFAULT_LISTS)); saveSettings(); $$('.list-box textarea').forEach((t) => t.blur()); renderSetup(); toast('رجعت القوائم الأصلية'); });
  $('#startBtn').addEventListener('click', () => {
    if (G && G.phase !== 'over') {
      ask('عندك تحقيق ما خلص', 'تبي تهدم كل شي وتبدأ من جديد؟', 'إيه، من جديد', createGame);
    } else createGame();
  });
  $('#resumeBtn').addEventListener('click', () => { S.tongue(0, 0.2); go(); });
  $('#discardBtn').addEventListener('click', () => ask('نحذف التحقيق المحفوظ؟', 'اللعبة الحالية بتروح عليكم.', 'إيه، احذفه', () => { G = null; store.del(GKEY); renderSetup(); }));

  $('#prepNext').addEventListener('click', () => {
    S.tongue(0, 0.22);
    G.phase = G.mode === 'phones' ? 'lobby' : 'deal';
    commit();
  });
  $('#prepFile').addEventListener('click', openFile);
  $('#prepShuffle').addEventListener('click', () => { G.items = pickItems(G.teams.length); deal(); S.whoosh(); toast('قضية جديدة مختومة'); commit(); });
  $('#prepBack').addEventListener('click', () => { G = null; store.del(GKEY); go(); });
  el.fileBtn.addEventListener('click', openFile);

  $('#lobbyStart').addEventListener('click', () => {
    const missing = G.teams.filter((t) => !t.on).length;
    if (missing) ask('باقي فرق ما انضمت', `${num(missing)} من الفرق ما دخلوا للحين. نبدأ؟ اللي يدخل بعدين توصله بطاقاته.`, 'إيه، نبدأ', startPlay);
    else startPlay();
  });
  $('#dealStart').addEventListener('click', () => {
    const missing = G.teams.filter((t) => !t.seen).length;
    if (missing) ask('باقي فرق ما شافت بطاقاتها', 'نبدأ فقرة الأسئلة؟ يقدرون يشوفونها بعدين من زر «بطاقاتنا».', 'إيه، نبدأ', startPlay);
    else startPlay();
  });

  // أزرار ساحة التحقيق
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !G) return;
    const i = +b.dataset.i;
    switch (b.dataset.act) {
      case 'qReveal': G.q.shown = !G.q.shown; S.tongue(0, 0.2); commit(); break;
      case 'qSkip': G.q.pos++; prepareQuestion(); S.whoosh(false); commit(); break;
      case 'ok': answerOk(); break;
      case 'bad': answerBad(); break;
      case 'opp': doPick(i); break;
      case 'showCard': showCard(G.turn.t, G.turn.card); break;
      case 'next': nextTurn(); break;
      case 'vote':
        if (G.phase === 'play') startVote();
        else voteForm(i);
        break;
      case 'hand': showHand(i); break;
      case 'revote': revote(false); break;
      case 'extra': revote(true); break;
      case 'tie': G.phase = 'tie'; G.q.pos++; prepareQuestion(); S.whoosh(); commit(); break;
      case 'win': setWinner(G.reveal.ties[0]); break;
      case 'tieWin': setWinner(i); break;
    }
  });
  $('#toVoteBtn').addEventListener('click', () => ask('ننتقل للتصويت الآن؟', 'فقرة الأسئلة بتنتهي وكل فريق يقدّم اتهامه.', 'إيه، للتصويت', startVote));
  el.revealBtn.addEventListener('click', () => {
    const missing = G.votes.filter((v) => !v).length;
    if (missing) ask('باقي فرق ما صوّتت', `${num(missing)} من الفرق ما وصل اتهامهم. نكشف الحين؟ اللي ما صوّت ما يفوز.`, 'إيه، اكشف', reveal);
    else reveal();
  });
  $('#newGameBtn').addEventListener('click', () => { G = null; store.del(GKEY); S.tongue(0, 0.2); go(); });

  // =========================================================
  // تشغيل
  // =========================================================
  initChrome();
  renderSetup();
  show('screen-setup');
  if (!BANK.length) $('#qSource button[data-q="bank"]').disabled = true;
})();
