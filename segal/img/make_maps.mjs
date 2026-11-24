// توليد خرائط «ثبّت الدبوس» من بيانات Natural Earth (حزمة world-atlas، ملكية عامة)
// التشغيل: npm i world-atlas@2 d3-geo topojson-client ثم node make_maps.mjs <مسار node_modules> > ../maps.js
import { createRequire } from 'module';
const base = process.argv[2] || './node_modules/';
const require = createRequire(base + 'x.js');
const { geoPath, geoTransform, geoBounds, geoClipRectangle, geoEquirectangular } = require('d3-geo');
const topo = require('topojson-client');

const MAPS = {
  // المملكة وما حولها
  sa: { name: 'المملكة العربية السعودية', lon0: 33.5, lon1: 57, lat0: 15, lat1: 33, W: 1000, res: '50m' },
  // الوطن العربي
  arab: { name: 'الوطن العربي', lon0: -18, lon1: 61, lat0: -3, lat1: 39, W: 1000, res: '110m' },
  // العالم: إسقاط متساوي المسافات حقيقي (يقص الأشكال عند خط التاريخ)
  world: { name: 'العالم', lon0: -180, lon1: 180, lat0: -58, lat1: 78, W: 1000, res: '110m', world: true }
};
const SA_ID = '682';
const out = {};
for (const [key, m] of Object.entries(MAPS)) {
  const world = require(`world-atlas/countries-${m.res}.json`);
  const feats = topo.feature(world, world.objects.countries).features;
  const mid = m.world ? 0 : ((m.lat0 + m.lat1) / 2) * Math.PI / 180;
  const ky = m.W / ((m.lon1 - m.lon0) * Math.cos(mid));
  const kx = ky * Math.cos(mid);
  const H = Math.round((m.lat1 - m.lat0) * ky);
  const tr = geoTransform({ point(lon, lat) { this.stream.point((lon - m.lon0) * kx, (m.lat1 - lat) * ky); } });
  // قص على حدود الخريطة حتى لا تدخل أشكال الدول البعيدة كاملة
  const clip = geoClipRectangle(-8, -8, m.W + 8, H + 8);
  const proj = m.world
    ? geoEquirectangular().scale(m.W / (2 * Math.PI)).translate([m.W / 2, m.lat1 * ky]).clipExtent([[-8, -8], [m.W + 8, H + 8]])
    : { stream: (s) => tr.stream(clip(s)) };
  const path = geoPath(proj);
  const pad = 4;
  const near = m.world ? feats.filter((f) => f.id !== '010') : feats.filter((f) => {
    const [[a, b], [c, d]] = geoBounds(f);
    return !(c < m.lon0 - pad || a > m.lon1 + pad || d < m.lat0 - pad || b > m.lat1 + pad) || (a > c);
  }).filter((f) => { const [[a], [c]] = geoBounds(f); return !(a > c && f.id !== SA_ID && (m.lon0 > -30)); });
  const rnd = (s) => s.replace(/-?\d+\.\d+/g, (n) => (Math.round(+n * (m.res === '50m' ? 2 : 1)) / (m.res === '50m' ? 2 : 1)).toString());
  const land = [], hi = [];
  near.forEach((f) => {
    const d = rnd(path(f) || '');
    if (!d) return;
    if (key === 'sa' && f.id === SA_ID) hi.push(d); else land.push(d);
  });
  out[key] = { name: m.name, w: m.W, h: H, lon0: m.lon0, lat1: m.lat1, kx: +kx.toFixed(4), ky: +ky.toFixed(4), land: land.join(''), hi: hi.join('') };
}
console.log('/* خرائط «ثبّت الدبوس»: مولّدة آليًا بـ img/make_maps.mjs من Natural Earth (ملكية عامة)، لا تُعدَّل يدويًا */');
console.log('/* الإسقاط: x = (خط الطول - lon0) × kx ، y = (lat1 - خط العرض) × ky */');
console.log('window.FZ_MAPS=' + JSON.stringify(out) + ';');
