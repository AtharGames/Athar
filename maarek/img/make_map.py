# توليد خريطة «معارك» بفورونوي مقصوص على قارة، بحدود متعرجة متسقة
# الاستخدام: python3 make_map.py original-config.json out.json [20|30]
# ٢٠: مواقع دول اللعبة الأصلية، ٣٠: بذور عشوائية موزعة بالتساوي (للحملات من ٥ و٦ فرق)
import json, math, random, sys
import numpy as np
from shapely.geometry import Polygon, Point, MultiPolygon, box
from shapely.ops import unary_union
from scipy.spatial import Voronoi

cfg = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
NR = int(sys.argv[3]) if len(sys.argv) > 3 else 20
W, H = (1000, 660) if NR == 20 else (1160, 760)
random.seed(7); np.random.seed(7)

# حقل ضجيج ناعم (مجموع موجات جيبية) لإزاحة النقاط
waves = [(random.uniform(.004, .02), random.uniform(.004, .02), random.uniform(0, 6.28), random.uniform(0, 6.28)) for _ in range(7)]
def field(x, y, amp):
    dx = sum(math.sin(x * a + y * b + p) for a, b, p, q in waves) / len(waves)
    dy = sum(math.cos(x * b - y * a + q) for a, b, p, q in waves) / len(waves)
    # تفاصيل أدق
    dx += .35 * math.sin(x * .06 + y * .045) ; dy += .35 * math.cos(x * .05 - y * .065)
    return x + dx * amp, y + dy * amp

# القارة: شكل قطبي بضجيج منخفض التردد
cx, cy = W / 2, H / 2
pts = []
N = 220
ph = [random.uniform(0, 6.28) for _ in range(5)]
for i in range(N):
    t = 2 * math.pi * i / N
    r = 1 + .07 * math.sin(3 * t + ph[0]) + .05 * math.sin(5 * t + ph[1]) + .03 * math.sin(9 * t + ph[2]) + .02 * math.sin(14 * t + ph[3])
    # قطع ناقص ممتلئ (سوبر إليبس)
    c, s = math.cos(t), math.sin(t)
    e = 2.6
    rx = (W / 2 - 62) * r; ry = (H / 2 - 52) * r
    x = cx + rx * math.copysign(abs(c) ** (2 / e), c)
    y = cy + ry * math.copysign(abs(s) ** (2 / e), s)
    pts.append((x, y))
land = Polygon(pts).buffer(0)
# خلجان: قضمات بحرية تعطي الساحل شخصية
for (bx, by, br) in [(cx + 40, 18, 70), (W - 10, cy + 60, 75), (20, cy - 40, 60), (cx - 160, H - 8, 62), (W - 160, 12, 46)]:
    land = land.difference(Point(bx, by).buffer(br, 48))
# بحيرة داخلية واحدة
lake = Polygon([field(470 + 34 * math.cos(t), 330 + 22 * math.sin(t), 6) for t in np.linspace(0, 2 * math.pi, 60, endpoint=False)])
land = land.buffer(0)

# البذور
if NR == 20:
    seeds = []
    for k in range(1, 21):
        r = cfg[str(k)]
        x = 125 + (r["x"] - 80) / (560 - 80) * (W - 250)
        y = 105 + (r["y"] - 10) / (275 - 10) * (H - 210)
        seeds.append((x, y))
    seeds = np.array(seeds)
else:
    # نقاط عشوائية داخل القارة ثم تنعيم لويد حتى تتقارب مساحات الأقاليم
    inner = land.buffer(-45)
    minx, miny, maxx, maxy = inner.bounds
    pts = []
    while len(pts) < NR:
        p = Point(random.uniform(minx, maxx), random.uniform(miny, maxy))
        if inner.contains(p) and all(p.distance(Point(q)) > 70 for q in pts): pts.append((p.x, p.y))
    seeds = np.array(pts)
    for _ in range(40):
        vv = Voronoi(np.vstack([seeds, [[-4000, -4000], [5000, -4000], [-4000, 5000], [5000, 5000]]]))
        new = []
        for i in range(NR):
            poly = Polygon([vv.vertices[j] for j in vv.regions[vv.point_region[i]]]).intersection(land)
            c = poly.centroid if not poly.is_empty else Point(seeds[i])
            new.append((c.x, c.y))
        seeds = np.array(new)

# فورونوي مع نقاط وهمية بعيدة لإغلاق الخلايا
far = np.array([[-3000, -3000], [4000, -3000], [-3000, 4000], [4000, 4000]])
vor = Voronoi(np.vstack([seeds, far]))
cells = []
for i in range(NR):
    reg = vor.regions[vor.point_region[i]]
    poly = Polygon([vor.vertices[j] for j in reg]).intersection(land)
    if isinstance(poly, MultiPolygon):
        poly = max(poly.geoms, key=lambda g: g.area)
    cells.append(poly)

# التجاور: حد مشترك أطول من ١٨
adj = {i: [] for i in range(NR)}
for i in range(NR):
    for j in range(i + 1, NR):
        L = cells[i].buffer(.5).intersection(cells[j].buffer(.5)).length / 2
        if L > 18:
            adj[i].append(j); adj[j].append(i)

def densify(coords, step=3.0):
    out = []
    for (x1, y1), (x2, y2) in zip(coords[:-1], coords[1:]):
        n = max(1, int(math.hypot(x2 - x1, y2 - y1) / step))
        for k in range(n):
            out.append((x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n))
    return out

def to_path(poly, amp=9):
    c = densify(list(poly.exterior.coords))
    c = [field(x, y, amp) for x, y in c]
    d = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in c) + 'Z'
    return d, Polygon(c)

regions = []
for i, p in enumerate(cells):
    d, wp = to_path(p)
    # نقطة التسمية: أبعد نقطة داخلية تقريبًا
    best, bd = None, -1
    minx, miny, maxx, maxy = wp.bounds
    for _ in range(4000):
        q = Point(random.uniform(minx, maxx), random.uniform(miny, maxy))
        if wp.contains(q):
            dd = wp.exterior.distance(q) - .15 * q.distance(wp.centroid)
            if dd > bd: bd, best = dd, q
    coast = land.exterior.intersection(p.buffer(1.5)).length > 25
    # زخارف داخل الإقليم بعيدًا عن التسمية والحدود
    deco = []
    for _ in range(3000):
        q = Point(random.uniform(minx, maxx), random.uniform(miny, maxy))
        if len(deco) >= 2: break
        if wp.contains(q) and wp.exterior.distance(q) > 16 and q.distance(best) > 52 and all(q.distance(Point(a, b)) > 40 for a, b in deco):
            deco.append((round(q.x, 1), round(q.y, 1)))
    regions.append({'deco': deco, 'id': i + 1, 'd': d, 'x': round(best.x, 1), 'y': round(best.y, 1), 'r': round(wp.exterior.distance(best), 1),
                    'area': round(wp.area), 'coast': bool(coast), 'nb': [j + 1 for j in adj[i]]})

coast_d, _ = to_path(land, 9)
lake_d = 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in lake.exterior.coords) + 'Z'
NAMES = {1:'مرفأ النوارس',2:'ساحل اللؤلؤ',3:'خليج المرجان',4:'رأس الصخر',5:'غابة الأرز',6:'سهل الخيل',7:'وادي السدر',8:'كثبان العنبر',9:'جبال الغيم',10:'بحيرة القمر',11:'واحة الظل',12:'ثغر الفجر',13:'هضبة الصقور',14:'رمال الذهب',15:'ممر الذئاب',16:'مروج الندى',17:'تلال الزعفران',18:'قمم البرق',19:'مضيق الريح',20:'وادي النخيل'}
KIND = {1:'wave',2:'wave',3:'wave',4:'rock',5:'tree',6:'grass',7:'tree',8:'dune',9:'peak',10:'grass',11:'palm',12:'peak',13:'peak',14:'dune',15:'rock',16:'grass',17:'grass',18:'peak',19:'rock',20:'palm'}
NAMES30 = ['مرفأ النوارس','ساحل اللؤلؤ','خليج المرجان','رأس الصخر','غابة الأرز','سهل الخيل','وادي السدر','كثبان العنبر','جبال الغيم','بحيرة القمر','واحة الظل','ثغر الفجر','هضبة الصقور','رمال الذهب','ممر الذئاب','مروج الندى','تلال الزعفران','قمم البرق','مضيق الريح','وادي النخيل','وادي العقيق','سهل الغزلان','جبال الثلج','ساحل الصدف','كهوف الصدى','مروج الخزامى','هضبة النسور','رمال الفضة','غابة البلوط','ثغر الغروب']
if NR == 20:
    for r in regions: r['name'] = NAMES[r['id']]; r['kind'] = KIND[r['id']]
else:
    # الأسماء والزخارف حسب الموقع: الساحل موج وصخر، الشمال قمم وغابات، الجنوب كثبان ونخيل، الوسط مروج
    coastal = [r for r in regions if r['coast']]; inland = [r for r in regions if not r['coast']]
    cn = ['مرفأ النوارس','ساحل اللؤلؤ','خليج المرجان','رأس الصخر','ثغر الفجر','مضيق الريح','ساحل الصدف','ثغر الغروب','كهوف الصدى']
    north = ['جبال الغيم','قمم البرق','جبال الثلج','غابة الأرز','غابة البلوط','هضبة النسور']
    south = ['كثبان العنبر','رمال الذهب','رمال الفضة','وادي النخيل','واحة الظل']
    mid = ['سهل الخيل','وادي السدر','هضبة الصقور','ممر الذئاب','مروج الندى','تلال الزعفران','وادي العقيق','سهل الغزلان','مروج الخزامى']
    used = set()
    def take(pool, fallback):
        for nm in pool + fallback:
            if nm not in used: used.add(nm); return nm
    kinds = {}
    for nm in cn: kinds[nm] = 'rock' if ('رأس' in nm or 'كهوف' in nm or 'مضيق' in nm) else 'wave'
    for nm in north: kinds[nm] = 'tree' if 'غابة' in nm else 'peak'
    for nm in south: kinds[nm] = 'palm' if ('نخيل' in nm or 'واحة' in nm) else 'dune'
    for nm in mid: kinds[nm] = 'grass' if ('مروج' in nm or 'سهل' in nm or 'تلال' in nm) else ('rock' if 'ممر' in nm else 'tree')
    # بحيرة القمر: أكبر إقليم داخلي
    lake = max(inland, key=lambda r: r['area']) if inland else None
    for r in sorted(regions, key=lambda r: r['y']):
        if r is lake: r['name'] = 'بحيرة القمر'; r['kind'] = 'lake'; used.add(r['name']); continue
        zone = north if r['y'] < H * .33 else south if r['y'] > H * .66 else mid
        if r['coast']: r['name'] = take(cn, zone + mid + north + south)
        else: r['name'] = take(zone, mid + north + south)
        r['kind'] = kinds.get(r['name'], 'grass')
json.dump({'w': W, 'h': H, 'coast': coast_d, 'lake': lake_d, 'regions': regions}, open(OUT, 'w'), ensure_ascii=False)

# مقارنة بالتجاور الأصلي
orig = {int(k): set(v['nb']) for k, v in cfg.items()} if NR == 20 else {}
for r in regions:
    if not orig: break
    a = set(r['nb']); o = orig[r['id']]
    if a != o: print(r['id'], 'زيادة', sorted(a - o), 'نقص', sorted(o - a))
print('مناطق', [(r['id'], r['area'], r['r']) for r in regions])
