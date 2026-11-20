# توليد مؤثرات «معارك» (بلا موسيقى ولا آلات): حوافر، صليل سيوف، تصفيق، عملات، صفير إنذار، رفرفة راية
# التشغيل: python3 make.py  (يحتاج numpy و scipy و ffmpeg)
import os, subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 44100
rng = np.random.default_rng(11)
HERE = os.path.dirname(os.path.abspath(__file__))

def env(n, a, d):
    """غلاف: صعود a ثانية ثم انحدار أُسّي d"""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
    return e

def bp(x, lo, hi, order=2):
    b, a = butter(order, [lo / (SR / 2), hi / (SR / 2)], btype='band')
    return lfilter(b, a, x)

def lp(x, f, order=2):
    b, a = butter(order, f / (SR / 2))
    return lfilter(b, a, x)

def save(name, x, gain=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    wav = os.path.join(HERE, name + '.wav')
    wavfile.write(wav, SR, (x * 32767).astype(np.int16))
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', '96k', os.path.join(HERE, name + '.mp3')], check=True)
    os.remove(wav)

def place(buf, x, t):
    i = int(t * SR); j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[:j - i]

# ١) وقع حوافر: طقّات خشبية على أرض، إيقاع ثلاثي الخبب
def hoof():
    n = int(.09 * SR)
    t = np.arange(n) / SR
    knock = np.sin(2 * np.pi * (380 + 140 * np.exp(-t * 60)) * t) * env(n, .001, .018)
    dirt = bp(rng.standard_normal(n), 300, 2500) * env(n, .001, .03) * .7
    return knock + dirt
buf = np.zeros(int(1.45 * SR))
t0 = 0.02
for g in range(4):
    for k, dt in enumerate([0, .085, .17]):
        place(buf, hoof() * (0.6 + .4 * (k == 2)) * (0.75 + .25 * g / 3), t0 + dt + rng.uniform(-.006, .006))
    t0 += .33
save('hooves', lp(buf, 5000))

# ٢) صليل سيفين: ارتطام معدني بترددات غير متناسقة + احتكاك «شِنغ»
n = int(1.1 * SR); t = np.arange(n) / SR
parts = [(2210, 1.0, .22), (3370, .7, .18), (4890, .5, .12), (6120, .35, .09), (1580, .4, .3)]
ring = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / d) for f, a, d in parts)
hit = bp(rng.standard_normal(n), 2000, 9000) * env(n, .0005, .02) * 2.2
scrape = bp(rng.standard_normal(n), 4000, 11000) * env(n, .03, .12) * .5 * (t < .35)
save('clash', ring * .6 + hit + scrape, .85)

# ٣) تصفيق جمهور قصير عند الفتح
n = int(2.0 * SR); buf = np.zeros(n)
def clap():
    m = int(.03 * SR)
    return bp(rng.standard_normal(m), rng.uniform(900, 1500), rng.uniform(2600, 4200)) * env(m, .0008, rng.uniform(.006, .011))
for _ in range(520):
    tt = 1.75 * rng.uniform(0, 1) ** 1.25
    place(buf, clap() * rng.uniform(.3, 1) * (1 - tt / 2.1), tt)
save('applause', lp(buf, 7000), .8)

# ٤) رنين عملات تتساقط في الخزينة
n = int(.9 * SR); buf = np.zeros(n)
def coin(f):
    m = int(.35 * SR); tt = np.arange(m) / SR
    return (np.sin(2 * np.pi * f * tt) + .5 * np.sin(2 * np.pi * f * 2.76 * tt) + .3 * np.sin(2 * np.pi * f * 5.4 * tt)) * np.exp(-tt / .07) \
        + bp(rng.standard_normal(m), 5000, 12000) * env(m, .0005, .004)
for k, tt in enumerate([0, .07, .12, .2, .26, .34]):
    place(buf, coin(rng.uniform(3600, 5200)) * (1 - k * .1), tt)
save('coins', buf, .7)

# ٥) صفير إنذار بالفم: صفرتان متقطعتان مع اهتزاز (خطر على العاصمة)
n = int(1.25 * SR); t = np.arange(n) / SR; buf = np.zeros(n)
for k, (s, e) in enumerate([(0, .42), (.55, 1.15)]):
    m = (t >= s) & (t < e)
    tt = t[m] - s
    f = 2650 + 120 * np.sin(2 * np.pi * 28 * tt) + (k * 180)
    ph = 2 * np.pi * np.cumsum(f) / SR
    a = np.minimum(1, tt / .03) * np.minimum(1, (e - s - tt) / .05)
    buf[m] += np.sin(ph) * a + .25 * bp(rng.standard_normal(m.sum()), 2000, 6000) * a
save('whistle', buf, .55)

# ٦) غرس الراية: رفرفة قماش ثم ضربة الخشب في الأرض
n = int(.9 * SR); buf = np.zeros(n)
for k in range(6):
    m = int(.06 * SR)
    place(buf, bp(rng.standard_normal(m), 500, 3000) * env(m, .004, .02) * (.4 + .1 * k), .03 + k * .07)
m = int(.25 * SR); tt = np.arange(m) / SR
thud = np.sin(2 * np.pi * (140 + 90 * np.exp(-tt * 40)) * tt) * env(m, .001, .06) + lp(rng.standard_normal(m), 900) * env(m, .001, .03) * .8
place(buf, thud * 1.6, .5)
save('flag', buf, .85)
print('تم توليد المؤثرات')
