/* =========================================================
   سِجَال | رسومات «كم السعر؟»
   رسمة مسطّحة لكل سلعة (بدون صور خارجية)، كلها على لوحة 160×120
     FZ_ART(key) ← نص SVG، أو '' لو ما فيه رسمة بهذا الاسم
   ========================================================= */
window.FZ_ART = (() => {
  'use strict';
  const sh = '<ellipse cx="80" cy="110" rx="48" ry="6" fill="#000" opacity=".16"/>';
  const wrap = (body, shadow = true) => `<svg viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${shadow ? sh : ''}${body}</svg>`;

  const A = {
    // جوال
    phone: `<rect x="56" y="10" width="48" height="96" rx="10" fill="#2B2F3A"/><rect x="60" y="16" width="40" height="84" rx="6" fill="url(#ph)"/>
      <defs><linearGradient id="ph" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5CC2F5"/><stop offset="1" stop-color="#8257E5"/></linearGradient></defs>
      <rect x="72" y="19" width="16" height="5" rx="2.5" fill="#111"/><circle cx="72" cy="44" r="5" fill="#fff" opacity=".85"/><circle cx="86" cy="44" r="5" fill="#fff" opacity=".6"/>
      <rect x="66" y="58" width="28" height="4" rx="2" fill="#fff" opacity=".7"/><rect x="66" y="66" width="20" height="4" rx="2" fill="#fff" opacity=".5"/><path d="M62 30 92 18v6L62 36z" fill="#fff" opacity=".12"/>`,
    // سيارة سيدان
    sedan: `<path d="M18 84c0-10 6-14 16-16l18-14c4-3 9-5 15-5h30c6 0 10 2 14 5l16 14c12 1 16 6 16 16v8H18z" fill="#E8554E"/>
      <path d="M56 56c3-2 6-3 11-3h28c4 0 7 1 10 3l12 11H46z" fill="#BFE3FC"/><rect x="78" y="53" width="4" height="15" fill="#E8554E"/>
      <rect x="18" y="84" width="124" height="8" rx="3" fill="#B83F39"/><circle cx="46" cy="94" r="12" fill="#2B2F3A"/><circle cx="46" cy="94" r="5" fill="#C9CED6"/>
      <circle cx="116" cy="94" r="12" fill="#2B2F3A"/><circle cx="116" cy="94" r="5" fill="#C9CED6"/><rect x="132" y="76" width="9" height="5" rx="2" fill="#FFD66B"/><rect x="19" y="77" width="7" height="4" rx="2" fill="#FFB4A8"/>`,
    // جيب لاندكروزر
    suv: `<path d="M16 88V66c0-6 4-10 10-11l14-2 14-15c3-3 7-5 12-5h44c6 0 9 2 12 6l10 14c9 1 12 6 12 12v23z" fill="#F4F1EA"/>
      <path d="M58 40h38c4 0 6 1 8 4l8 12H48z" fill="#2C4A6B"/><rect x="76" y="39" width="4" height="18" fill="#F4F1EA"/>
      <rect x="16" y="80" width="128" height="10" rx="3" fill="#9AA3AE"/><rect x="58" y="28" width="46" height="4" rx="2" fill="#6B7380"/>
      <circle cx="44" cy="94" r="13" fill="#2B2F3A"/><circle cx="44" cy="94" r="6" fill="#C9CED6"/><circle cx="118" cy="94" r="13" fill="#2B2F3A"/><circle cx="118" cy="94" r="6" fill="#C9CED6"/>
      <rect x="134" y="66" width="9" height="6" rx="2" fill="#FFD66B"/><path d="M20 62h10" stroke="#C9CED6" stroke-width="3" stroke-linecap="round"/>`,
    // مضخة بنزين
    pump: `<rect x="46" y="20" width="46" height="86" rx="6" fill="#1FA971"/><rect x="52" y="28" width="34" height="22" rx="4" fill="#E9FFF4"/>
      <text x="69" y="44" font-size="12" font-weight="700" text-anchor="middle" fill="#167A52" font-family="sans-serif">91</text><rect x="52" y="58" width="34" height="8" rx="3" fill="#167A52"/>
      <rect x="40" y="100" width="58" height="8" rx="3" fill="#167A52"/><path d="M92 40h10c4 0 6 3 6 6v34c0 4 4 6 7 4" fill="none" stroke="#2B2F3A" stroke-width="5" stroke-linecap="round"/>
      <rect x="108" y="76" width="12" height="20" rx="3" fill="#2B2F3A"/>`,
    // قطار مترو
    train: `<rect x="34" y="18" width="92" height="76" rx="18" fill="#1E6FE0"/><rect x="44" y="28" width="72" height="30" rx="8" fill="#BFE3FC"/>
      <rect x="78" y="28" width="4" height="30" fill="#1E6FE0"/><rect x="34" y="66" width="92" height="8" fill="#F59E0B"/>
      <circle cx="52" cy="82" r="5" fill="#FFF3C4"/><circle cx="108" cy="82" r="5" fill="#FFF3C4"/><path d="M48 94 38 108M112 94l10 14" stroke="#2B2F3A" stroke-width="5" stroke-linecap="round"/>`,
    // جواز سفر
    passport: `<rect x="48" y="12" width="66" height="94" rx="6" fill="#146B45"/><rect x="48" y="12" width="8" height="94" rx="3" fill="#0F5236"/>
      <circle cx="84" cy="50" r="17" fill="none" stroke="#E8C66B" stroke-width="3"/><path d="M73 52c4-9 18-9 22 0M84 33v34" stroke="#E8C66B" stroke-width="2.5" fill="none"/>
      <rect x="66" y="78" width="36" height="4" rx="2" fill="#E8C66B"/><rect x="72" y="86" width="24" height="3" rx="1.5" fill="#E8C66B" opacity=".7"/>`,
    // بطاقة/رخصة
    idcard: `<rect x="24" y="26" width="112" height="72" rx="10" fill="#5CC2F5"/><rect x="24" y="26" width="112" height="18" rx="9" fill="#1E6FE0"/>
      <rect x="34" y="52" width="30" height="36" rx="5" fill="#fff"/><circle cx="49" cy="64" r="7" fill="#8AA0B8"/><path d="M38 86c2-9 20-9 22 0" fill="#8AA0B8"/>
      <rect x="72" y="56" width="52" height="5" rx="2.5" fill="#fff"/><rect x="72" y="66" width="40" height="5" rx="2.5" fill="#fff" opacity=".8"/><rect x="72" y="76" width="46" height="5" rx="2.5" fill="#fff" opacity=".6"/>`,
    // دباب
    moto: `<circle cx="42" cy="88" r="17" fill="none" stroke="#2B2F3A" stroke-width="7"/><circle cx="118" cy="88" r="17" fill="none" stroke="#2B2F3A" stroke-width="7"/>
      <path d="M42 88 66 62h34l18 26" fill="none" stroke="#8257E5" stroke-width="7" stroke-linejoin="round"/><path d="M64 60c6-12 26-14 36-4l-4 8H66z" fill="#8257E5"/>
      <path d="M100 56l10-16h10" stroke="#2B2F3A" stroke-width="5" stroke-linecap="round" fill="none"/><rect x="58" y="52" width="22" height="6" rx="3" fill="#2B2F3A"/>`,
    // يد تحكم
    gamepad: `<path d="M38 48c6-8 20-8 26-4h32c6-4 20-4 26 4 10 14 14 46 2 50-8 3-14-8-20-16H56c-6 8-12 19-20 16-12-4-8-36 2-50z" fill="#E8554E"/>
      <path d="M50 62h18M59 53v18" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="104" cy="58" r="5" fill="#FFD66B"/><circle cx="116" cy="66" r="5" fill="#5CC2F5"/>
      <circle cx="92" cy="66" r="5" fill="#1FA971"/><circle cx="104" cy="74" r="5" fill="#fff"/>`,
    // سماعات
    earbuds: `<rect x="40" y="46" width="80" height="58" rx="22" fill="#fff" stroke="#D5DBE3" stroke-width="3"/><path d="M40 70h80" stroke="#D5DBE3" stroke-width="3"/>
      <circle cx="80" cy="86" r="3" fill="#1FA971"/><path d="M58 18c10 0 14 8 14 16s-4 12-8 12v18h-8V34c-4-2-6-6-6-10 0-4 3-6 8-6z" fill="#F4F6F9" stroke="#D5DBE3" stroke-width="2"/>
      <path d="M102 18c-10 0-14 8-14 16s4 12 8 12v18h8V34c4-2 6-6 6-10 0-4-3-6-8-6z" fill="#F4F6F9" stroke="#D5DBE3" stroke-width="2"/>`,
    // كيس رز
    sack: `<path d="M46 32c10-6 58-6 68 0l8 66c1 8-6 12-14 12H52c-8 0-15-4-14-12z" fill="#F2E3C6"/><path d="M48 32c8-10 56-10 64 0-6 6-58 6-64 0z" fill="#E2CDA3"/>
      <path d="M62 22c6 4 30 4 36 0l-2 8H64z" fill="#C0A06A"/><rect x="54" y="56" width="52" height="30" rx="6" fill="#E8554E"/>
      <text x="80" y="77" font-size="14" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">10kg</text>`,
    // تمر
    dates: `<rect x="30" y="56" width="100" height="44" rx="8" fill="#C77B30"/><rect x="30" y="56" width="100" height="10" rx="5" fill="#9E5D20"/>
      <g fill="#6B2F12"><ellipse cx="50" cy="52" rx="9" ry="13" transform="rotate(-20 50 52)"/><ellipse cx="68" cy="48" rx="9" ry="13" transform="rotate(10 68 48)"/><ellipse cx="86" cy="50" rx="9" ry="13" transform="rotate(-8 86 50)"/><ellipse cx="104" cy="49" rx="9" ry="13" transform="rotate(18 104 49)"/></g>
      <g fill="#fff" opacity=".22"><ellipse cx="47" cy="46" rx="2.5" ry="5"/><ellipse cx="66" cy="42" rx="2.5" ry="5"/><ellipse cx="84" cy="44" rx="2.5" ry="5"/><ellipse cx="102" cy="43" rx="2.5" ry="5"/></g>`,
    // ماء
    water: `<g><path d="M54 30h16l4 8v62c0 4-3 6-6 6H56c-3 0-6-2-6-6V38z" fill="#BFE3FC"/><rect x="56" y="22" width="12" height="8" rx="2" fill="#1E6FE0"/><rect x="50" y="56" width="24" height="18" fill="#1E6FE0"/></g>
      <g><path d="M88 30h16l4 8v62c0 4-3 6-6 6H90c-3 0-6-2-6-6V38z" fill="#BFE3FC"/><rect x="90" y="22" width="12" height="8" rx="2" fill="#1E6FE0"/><rect x="84" y="56" width="24" height="18" fill="#1E6FE0"/></g>
      <path d="M58 82v14M92 82v14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
    // كوب قهوة
    cup: `<path d="M48 36h60l-7 68c-1 5-4 7-9 7H64c-5 0-8-2-9-7z" fill="#fff" stroke="#E2D6C6" stroke-width="2"/><rect x="44" y="28" width="68" height="10" rx="4" fill="#6B3E26"/>
      <rect x="51" y="58" width="54" height="24" fill="#1FA971"/><circle cx="78" cy="70" r="8" fill="#fff"/><path d="M70 18c-4 4 4 6 0 10M86 16c-4 4 4 6 0 10" stroke="#C9B8A6" stroke-width="3" fill="none" stroke-linecap="round"/>`,
    // دلّة
    dallah: `<path d="M64 40h32l6 50c1 8-6 14-22 14s-23-6-22-14z" fill="#D4A54A"/><path d="M66 40c0-10 28-10 28 0z" fill="#E8C66B"/><circle cx="80" cy="26" r="5" fill="#E8C66B"/>
      <path d="M71 30h18l-4 10H75z" fill="#C8963A"/><path d="M60 62c-14-2-22-16-30-24l-4 4c8 8 14 26 34 30" fill="#D4A54A"/><path d="M100 50c16 0 18 30 0 34" fill="none" stroke="#C8963A" stroke-width="6"/>
      <path d="M62 80h36" stroke="#E8C66B" stroke-width="3"/>`,
    // كتاب/مصحف
    book: `<path d="M30 30c18-6 34-4 50 6v68c-16-10-32-12-50-6z" fill="#146B45"/><path d="M130 30c-18-6-34-4-50 6v68c16-10 32-12 50-6z" fill="#1A7D52"/>
      <path d="M80 36v68" stroke="#0F5236" stroke-width="3"/><path d="M40 46c12-3 24-2 32 3M88 49c8-5 20-6 32-3" stroke="#E8C66B" stroke-width="2.5" fill="none"/><circle cx="56" cy="70" r="8" fill="none" stroke="#E8C66B" stroke-width="2.5"/><circle cx="104" cy="70" r="8" fill="none" stroke="#E8C66B" stroke-width="2.5"/>`,
    // شنطة مدرسية
    backpack: `<path d="M50 40c0-16 60-16 60 0v58c0 6-4 10-10 10H60c-6 0-10-4-10-10z" fill="#1E6FE0"/><path d="M66 26c0-10 28-10 28 0" fill="none" stroke="#174FA8" stroke-width="6"/>
      <rect x="58" y="66" width="44" height="30" rx="6" fill="#5CC2F5"/><path d="M58 76h44" stroke="#174FA8" stroke-width="3"/><rect x="76" y="72" width="8" height="8" rx="2" fill="#FFD66B"/>`,
    // ساعة
    watch: `<rect x="62" y="8" width="36" height="104" rx="10" fill="#2B2F3A"/><rect x="50" y="32" width="60" height="56" rx="16" fill="#3A4050"/><rect x="56" y="38" width="48" height="44" rx="11" fill="#0E1726"/>
      <path d="M80 60V46M80 60l10 6" stroke="#5CC2F5" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="60" r="18" fill="none" stroke="#1FA971" stroke-width="3" stroke-dasharray="70 120"/><rect x="110" y="50" width="5" height="12" rx="2" fill="#6B7380"/>`,
    // قلاية هوائية
    airfryer: `<path d="M44 30c0-12 72-12 72 0v66c0 8-6 12-14 12H58c-8 0-14-4-14-12z" fill="#2B2F3A"/><rect x="56" y="22" width="48" height="26" rx="8" fill="#3A4050"/>
      <circle cx="80" cy="35" r="8" fill="#0E1726"/><text x="80" y="38.5" font-size="8" font-weight="700" text-anchor="middle" fill="#5CC2F5" font-family="sans-serif">200</text>
      <rect x="52" y="60" width="56" height="38" rx="8" fill="#3A4050"/><rect x="66" y="72" width="28" height="8" rx="4" fill="#9AA3AE"/><path d="M60 62h40" stroke="#5CC2F5" stroke-width="2" opacity=".5"/>
      <path d="M118 46c6 2 6 10 0 12" stroke="#E8554E" stroke-width="3" fill="none" opacity=".7"/>`,
    // وجبة برجر
    burger: `<path d="M30 54h36l-4 50H34z" fill="#E8554E"/><path d="M34 54 30 42h8l2 12M46 54l-2-16h8l1 16M56 54l2-14h8l-3 14" fill="#FFC93C"/>
      <rect x="28" y="62" width="40" height="12" fill="#fff" opacity=".9"/>
      <ellipse cx="108" cy="58" rx="30" ry="17" fill="#E5A04A"/><g fill="#fff"><ellipse cx="98" cy="50" rx="2" ry="1.2"/><ellipse cx="110" cy="47" rx="2" ry="1.2"/><ellipse cx="118" cy="53" rx="2" ry="1.2"/></g>
      <path d="M78 66h60l-4 6H82z" fill="#7DC254"/><rect x="78" y="70" width="60" height="9" rx="4" fill="#FFC93C"/><rect x="80" y="78" width="56" height="11" rx="5" fill="#6B3E26"/>
      <path d="M80 90h56c0 10-8 14-28 14s-28-4-28-14z" fill="#E5A04A"/>`,
    // صحن مندي
    mandi: `<ellipse cx="80" cy="86" rx="62" ry="18" fill="#E9EEF3"/><ellipse cx="80" cy="82" rx="54" ry="14" fill="#F7E7B8"/>
      <g fill="#F0C858" opacity=".7"><circle cx="46" cy="80" r="2"/><circle cx="58" cy="88" r="2"/><circle cx="104" cy="88" r="2"/><circle cx="116" cy="80" r="2"/><circle cx="70" cy="92" r="2"/><circle cx="92" cy="92" r="2"/></g>
      <path d="M52 74c-2-22 16-34 30-34 18 0 32 12 28 30-2 8-14 12-30 12s-26-2-28-8z" fill="#C8752E"/><path d="M62 56c6-8 18-10 26-6" stroke="#E5A04A" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M106 62c8-4 16 0 14 8l-8-2z" fill="#B8662A"/><circle cx="40" cy="74" r="4" fill="#7DC254"/><circle cx="124" cy="72" r="4" fill="#E8554E"/>`,
    // حليب
    milk: `<path d="M56 34 66 18h28l10 16v68c0 4-3 6-6 6H62c-3 0-6-2-6-6z" fill="#fff" stroke="#D5DBE3" stroke-width="2"/><rect x="66" y="10" width="28" height="9" rx="3" fill="#1E6FE0"/>
      <path d="M56 58c8-6 16 6 24 0s16 6 24 0v30H56z" fill="#5CC2F5"/><rect x="66" y="40" width="28" height="10" rx="3" fill="#1E6FE0"/><text x="80" y="82" font-size="11" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">2L</text>`,
    // سلك شاحن
    cable: `<path d="M38 94c-6-30 30-26 40-46s34-26 46-6" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/><path d="M38 94c-6-30 30-26 40-46s34-26 46-6" fill="none" stroke="#E2E6EC" stroke-width="2"/>
      <rect x="28" y="92" width="20" height="16" rx="4" fill="#E9EEF3" stroke="#C9CED6" stroke-width="2"/><rect x="33" y="104" width="10" height="8" rx="2" fill="#9AA3AE"/>
      <rect x="114" y="28" width="20" height="16" rx="4" fill="#E9EEF3" stroke="#C9CED6" stroke-width="2" transform="rotate(-30 124 36)"/><path d="m128 22 6-4" stroke="#9AA3AE" stroke-width="6" stroke-linecap="round"/>`,
    // حديد تسليح
    rebar: `<g stroke-linecap="round"><path d="M22 92 138 52" stroke="#6B4A3A" stroke-width="9"/><path d="M22 80 138 40" stroke="#7A5444" stroke-width="9"/><path d="M22 68 138 28" stroke="#6B4A3A" stroke-width="9"/></g>
      <g stroke="#4A3026" stroke-width="2" opacity=".7"><path d="M34 86l4 8M52 80l4 8M70 74l4 8M88 68l4 8M106 62l4 8M124 56l4 8"/><path d="M34 74l4 8M52 68l4 8M70 62l4 8M88 56l4 8M106 50l4 8M124 44l4 8"/></g>
      <path d="M60 96c10-4 20 4 30 0" stroke="#F59E0B" stroke-width="5" fill="none"/>`,
    // ميزانية (عملات وأعمدة)
    budget: `<rect x="30" y="70" width="18" height="34" rx="3" fill="#5CC2F5"/><rect x="54" y="54" width="18" height="50" rx="3" fill="#3B98EA"/><rect x="78" y="38" width="18" height="66" rx="3" fill="#1E6FE0"/>
      <path d="M32 60 60 44l22-8 26-20" stroke="#1FA971" stroke-width="4" fill="none" stroke-linecap="round"/><path d="m100 14 10 1-2 10" stroke="#1FA971" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g><ellipse cx="122" cy="98" rx="18" ry="6" fill="#C8963A"/><rect x="104" y="80" width="36" height="18" fill="#E8C66B"/><ellipse cx="122" cy="80" rx="18" ry="6" fill="#F5D88A"/><ellipse cx="122" cy="72" rx="18" ry="6" fill="#E8C66B"/><ellipse cx="122" cy="66" rx="18" ry="6" fill="#F5D88A"/></g>`,
    // لوحة سيارة
    plate: `<rect x="16" y="34" width="128" height="54" rx="8" fill="#fff" stroke="#2B2F3A" stroke-width="4"/><path d="M118 34v54M16 61h102" stroke="#2B2F3A" stroke-width="3"/>
      <text x="67" y="56" font-size="18" font-weight="800" text-anchor="middle" fill="#2B2F3A" font-family="sans-serif">م ل ك ١</text><text x="67" y="81" font-size="17" font-weight="800" text-anchor="middle" fill="#2B2F3A" font-family="sans-serif">K L Z 1</text>
      <rect x="122" y="40" width="16" height="42" rx="3" fill="#1FA971"/><path d="M126 52h8M126 60h8" stroke="#fff" stroke-width="2"/>`,
    // لوحة دبي
    plateae: `<rect x="16" y="38" width="128" height="46" rx="8" fill="#fff" stroke="#2B2F3A" stroke-width="4"/><rect x="22" y="44" width="30" height="34" rx="4" fill="#E8554E"/>
      <text x="37" y="68" font-size="18" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">P</text><text x="98" y="74" font-size="34" font-weight="800" text-anchor="middle" fill="#2B2F3A" font-family="sans-serif">7</text>
      <text x="37" y="80" font-size="5" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">DUBAI</text>`,
    // صقر
    falcon: `<path d="M98 104c-4-20-2-34 2-44" stroke="#6B4A3A" stroke-width="5"/><path d="M82 104h40" stroke="#6B4A3A" stroke-width="6" stroke-linecap="round"/>
      <path d="M70 92c-14-10-18-34-6-52 8-12 24-16 34-8 6 5 6 14 2 22 10 8 14 22 10 36-10 6-26 8-40 2z" fill="#F4F1EA"/>
      <path d="M78 54c10 8 24 22 24 40-10-6-22-18-24-40z" fill="#E2DCCF"/><path d="M72 62c4 4 6 10 4 16M84 70c4 4 6 10 4 16" stroke="#8A7F6A" stroke-width="2" fill="none" opacity=".6"/>
      <circle cx="96" cy="34" r="4" fill="#2B2F3A"/><path d="M104 36c6 0 10 4 8 8l-8-2z" fill="#F59E0B"/><path d="M96 92l-4 12M106 92l2 12" stroke="#F59E0B" stroke-width="3"/>`,
    // لوحة فنية
    painting: `<rect x="26" y="14" width="108" height="92" rx="4" fill="#C8963A"/><rect x="34" y="22" width="92" height="76" fill="#22302A"/>
      <path d="M58 98c0-30 8-50 22-50s22 20 22 50z" fill="#3A2A22"/><circle cx="80" cy="44" r="13" fill="#D9A77A"/><path d="M66 40c2-14 26-14 28 0-6-6-22-6-28 0z" fill="#4A3026"/>
      <circle cx="74" cy="76" r="7" fill="#BFE3FC" opacity=".85"/><path d="M86 70l8 10" stroke="#D9A77A" stroke-width="5" stroke-linecap="round"/><rect x="30" y="18" width="100" height="84" fill="none" stroke="#E8C66B" stroke-width="2"/>`,
    // ماسة
    diamond: `<path d="M44 44 60 24h40l16 20-36 56z" fill="#F2A1C8"/><path d="M44 44h72L80 100z" fill="#E0559B"/><path d="M60 24l-4 20 24 56 24-56-4-20" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>
      <path d="M56 44 80 24l24 20M44 44h72" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/><path d="M122 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff"/><path d="M36 70l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFD66B"/>`,
    // ماسة زرقاء
    bluediamond: `<path d="M44 44 60 24h40l16 20-36 56z" fill="#9FD7FF"/><path d="M44 44h72L80 100z" fill="#1E6FE0"/><path d="M60 24l-4 20 24 56 24-56-4-20" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>
      <path d="M56 44 80 24l24 20M44 44h72" stroke="#fff" stroke-width="2" fill="none" opacity=".6"/><path d="M122 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff"/>`,
    // سيارة كلاسيكية
    classiccar: `<path d="M14 86c0-8 6-12 14-13l14-2c8-14 20-20 38-20 14 0 24 6 32 18l22 4c8 1 12 6 12 13v4H14z" fill="#C9CED6"/><path d="M50 70c6-10 16-14 30-14 10 0 18 4 24 14z" fill="#2C4A6B"/>
      <circle cx="42" cy="92" r="12" fill="#2B2F3A"/><circle cx="42" cy="92" r="5" fill="#E8554E"/><circle cx="122" cy="92" r="12" fill="#2B2F3A"/><circle cx="122" cy="92" r="5" fill="#E8554E"/>
      <path d="M60 78h44" stroke="#9AA3AE" stroke-width="2"/><circle cx="146" cy="80" r="3" fill="#FFD66B"/><path d="M20 82h12" stroke="#9AA3AE" stroke-width="3"/>`,
    // طابع بريد
    stamp: `<rect x="40" y="18" width="80" height="92" fill="#fff" stroke="#E2E6EC" stroke-width="1"/>
      <g fill="#E9EEF3">${Array.from({ length: 9 }, (_, i) => `<circle cx="${44 + i * 9}" cy="18" r="3"/><circle cx="${44 + i * 9}" cy="110" r="3"/>`).join('')}${Array.from({ length: 10 }, (_, i) => `<circle cx="40" cy="${22 + i * 9.5}" r="3"/><circle cx="120" cy="${22 + i * 9.5}" r="3"/>`).join('')}</g>
      <rect x="50" y="28" width="60" height="72" fill="#B8325E"/><path d="M58 76c10-8 18 4 28-6s14-4 18 0" stroke="#F2A1C8" stroke-width="3" fill="none"/><path d="M60 58l20-14 20 14v20H60z" fill="#8E1F45"/><text x="80" y="94" font-size="9" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">1c</text>`,
    // موزة على الجدار
    banana: `<rect x="20" y="10" width="120" height="96" rx="4" fill="#F4F1EA"/><path d="M50 64c14 18 46 20 64-6-8 30-50 34-64 6z" fill="#FACC15"/><path d="M50 64c-4-2-4-6 0-6" stroke="#6B4A3A" stroke-width="3" fill="none"/>
      <rect x="66" y="52" width="30" height="12" rx="1" fill="#C9CED6" opacity=".9" transform="rotate(-12 81 58)"/>`,
    // ديناصور
    dino: `<path d="M24 92c10-30 30-40 56-40 14 0 24-6 32-14 8-8 22-8 28 0 4 6 0 12-8 12h-12c-6 8-8 18-10 28l-2 18h-10l-2-16H66l-4 16H52l-2-18c-10 0-18 6-26 14z" fill="#8FB3A0"/>
      <g fill="#E8554E"><path d="M50 56l6-14 6 12z"/><path d="M64 52l7-16 6 14z"/><path d="M78 50l7-14 5 14z"/><path d="M92 46l6-12 4 12z"/></g><circle cx="128" cy="40" r="2.5" fill="#2B2F3A"/>`,
    // بيتزا
    pizza: `<path d="M24 34c38-14 74-14 112 0L80 108z" fill="#F5C26B"/><path d="M28 34c36-12 68-12 104 0l-6 8c-30-10-62-10-92 0z" fill="#C8752E"/>
      <g fill="#E8554E"><circle cx="66" cy="56" r="7"/><circle cx="94" cy="58" r="7"/><circle cx="80" cy="80" r="6"/></g><g fill="#7DC254"><circle cx="78" cy="50" r="3"/><circle cx="72" cy="70" r="3"/><circle cx="92" cy="74" r="3"/></g>
      <circle cx="128" cy="86" r="16" fill="#F59E0B"/><text x="128" y="92" font-size="17" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">₿</text>`,
    // صفقة/شركة
    building: `<rect x="34" y="24" width="46" height="84" fill="#3B98EA"/><rect x="80" y="44" width="46" height="64" fill="#1E6FE0"/>
      <g fill="#BFE3FC">${[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2].map((c) => `<rect x="${40 + c * 13}" y="${32 + r * 12}" width="8" height="7" rx="1"/>`).join('')).join('')}${[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => `<rect x="${86 + c * 13}" y="${52 + r * 12}" width="8" height="7" rx="1"/>`).join('')).join('')}</g>
      <circle cx="122" cy="30" r="14" fill="#1FA971"/><text x="122" y="36" font-size="16" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">$</text>`,
    // ساعة جيب فاخرة
    luxwatch: `<path d="M64 12h32l-4 22H68zM68 86h24l4 22H64z" fill="#6B4A3A"/><circle cx="80" cy="60" r="32" fill="#E8C66B"/><circle cx="80" cy="60" r="26" fill="#FBF6E9"/>
      <g stroke="#2B2F3A" stroke-width="2">${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${80 + Math.sin(a) * 21} ${60 - Math.cos(a) * 21}L${80 + Math.sin(a) * 24} ${60 - Math.cos(a) * 24}"/>`; }).join('')}</g>
      <path d="M80 60V42M80 60l12 6" stroke="#2B2F3A" stroke-width="3" stroke-linecap="round"/><circle cx="80" cy="60" r="3" fill="#B8325E"/><rect x="110" y="56" width="6" height="8" rx="2" fill="#C8963A"/>`,
    // زبادي
    yogurt: `<path d="M44 46h72l-8 54c-1 6-5 8-10 8H62c-5 0-9-2-10-8z" fill="#fff" stroke="#D5DBE3" stroke-width="2"/><ellipse cx="80" cy="46" rx="38" ry="9" fill="#5CC2F5"/>
      <rect x="54" y="66" width="52" height="22" rx="5" fill="#1E6FE0"/><text x="80" y="81" font-size="11" font-weight="700" text-anchor="middle" fill="#fff" font-family="sans-serif">1kg</text>`,
    // علامة سعر عامة
    tag: `<path d="M30 54 62 22h56c4 0 8 4 8 8v56c0 4-4 8-8 8H62z" fill="#F59E0B"/><circle cx="56" cy="58" r="7" fill="#fff"/><path d="M56 58C40 58 28 40 34 28" stroke="#6B4A3A" stroke-width="3" fill="none"/>
      <text x="94" y="68" font-size="30" font-weight="800" text-anchor="middle" fill="#fff" font-family="sans-serif">؟</text>`
  };

  return (key) => (A[key] ? wrap(A[key]) : '');
})();
