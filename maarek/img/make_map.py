# توليد خريطة «معارك»: ٢٠ إقليمًا بفورونوي مقصوص على قارة، بحدود متعرجة متسقة
import json, math, random, sys
import numpy as np
from shapely.geometry import Polygon, Point, MultiPolygon, box
from shapely.ops import unary_union
from scipy.spatial import Voronoi

cfg = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
W, H = 1000, 660
random.seed(7); np.random.seed(7)

# البذور: مواقع الدول الأصلية بعد تمديدها لتملأ مساحة أطول (أنسب للجوال)
seeds = []
for k in range(1, 21):
    r = cfg[str(k)]
    x = 125 + (r["x"] - 80) / (560 - 80) * (W - 250)
    y = 105 + (r["y"] - 10) / (275 - 10) * (H - 210)
    seeds.append((x, y))
seeds = np.array(seeds)

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

# فورونوي مع نقاط وهمية بعيدة لإغلاق الخلايا
far = np.array([[-3000, -3000], [4000, -3000], [-3000, 4000], [4000, 4000]])
vor = Voronoi(np.vstack([seeds, far]))
cells = []
for i in range(20):
    reg = vor.regions[vor.point_region[i]]
    poly = Polygon([vor.vertices[j] for j in reg]).intersection(land)
    if isinstance(poly, MultiPolygon):
        poly = max(poly.geoms, key=lambda g: g.area)
    cells.append(poly)

# التجاور: حد مشترك أطول من ١٨
adj = {i: [] for i in range(20)}
for i in range(20):
    for j in range(i + 1, 20):
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
    coast = p.exterior.difference(unary_union([c for k, c in enumerate(cells) if k != i]).buffer(1)).length > 25
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
for r in regions: r['name'] = NAMES[r['id']]; r['kind'] = KIND[r['id']]
json.dump({'w': W, 'h': H, 'coast': coast_d, 'lake': lake_d, 'regions': regions}, open(OUT, 'w'), ensure_ascii=False)

# مقارنة بالتجاور الأصلي
orig = {int(k): set(v['nb']) for k, v in cfg.items()}
for r in regions:
    a = set(r['nb']); o = orig[r['id']]
    if a != o: print(r['id'], 'زيادة', sorted(a - o), 'نقص', sorted(o - a))
print('مناطق', [(r['id'], r['area'], r['r']) for r in regions])
