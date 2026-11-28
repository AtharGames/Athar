# توليد أصوات سِجَال الجديدة: انفجار، نبض قلب، ألعاب نارية (بلا موسيقى ولا آلات)
import numpy as np, subprocess, sys, os
from scipy.signal import butter, sosfilt
SR = 44100
S = sys.argv[1]; OUT = sys.argv[2]
def load(p):
    raw = subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','1','-ar',str(SR),'-f','f32le','-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
def save(x, name, gain_db=0):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.95 * 10 ** (gain_db / 20)
    p = os.path.join(OUT, name + '.mp3')
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-b:a','96k',p], input=x.astype(np.float32).tobytes())
def lp(x, f): return sosfilt(butter(4, f, 'low', fs=SR, output='sos'), x)
def bp(x, a, b): return sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
rng = np.random.default_rng(7)
def mix(*parts):
    n = max(len(p) + o for p, o in parts); y = np.zeros(n)
    for p, o in parts: y[o:o + len(p)] += p
    return y

# ١) انفجار: ضربة + هبوط منخفض + ضجيج يخفت + شظايا متناثرة
imp = load(f'{S}/motion/impact.flac'); sub = load(f'{S}/motion/sub-drop.flac')
n = int(SR * 1.8); noise = rng.standard_normal(n)
roar = lp(noise, 900) * env(n, 0.008, 0.35)
deb = np.zeros(n)
for k in range(40):
    o = int(SR * (0.08 + rng.random() * 1.1)); L = int(SR * 0.012)
    if o + L < n: deb[o:o + L] += bp(rng.standard_normal(L), 1500, 6000) * env(L, 0.001, 0.004) * (0.5 * np.exp(-o / SR / 0.6))
boom = mix((imp * 1.0, 0), (sub * 0.9, 0), (roar * 0.8, 0), (deb * 0.6, int(SR * 0.05)))
save(boom[:int(SR * 1.9)], 'boom')

# ٢) نبض قلب: «لُب-دُب»
def thump(f, d, amp):
    m = int(SR * d); t = np.arange(m) / SR
    s = np.sin(2 * np.pi * f * t * (1 - 0.3 * t / d)) * env(m, 0.004, d / 3)
    s += lp(rng.standard_normal(m), 180) * env(m, 0.002, d / 5) * 0.6
    return s * amp
beat = mix((thump(58, 0.16, 1.0), 0), (thump(50, 0.14, 0.7), int(SR * 0.2)))
save(np.concatenate([beat, np.zeros(int(SR * 0.15))]), 'heart')

# ٣) ألعاب نارية: صعود هوائي ثم فرقعة وطقطقة
m = int(SR * 0.7); t = np.arange(m) / SR
rise = np.zeros(m)
for i in range(0, m, 512):
    seg = rng.standard_normal(min(512, m - i)); fc = 800 + 2600 * (i / m)
    rise[i:i + len(seg)] = bp(seg, fc * 0.8, fc * 1.2)
rise *= np.linspace(0.2, 1, m) * 0.5
bang_n = int(SR * 1.6)
bang = lp(rng.standard_normal(bang_n), 2500) * env(bang_n, 0.002, 0.12)
crk = np.zeros(bang_n)
for k in range(90):
    o = int(SR * (0.1 + rng.random() * 1.3)); L = int(SR * 0.006)
    if o + L < bang_n: crk[o:o + L] += bp(rng.standard_normal(L), 2500, 9000) * env(L, 0.0005, 0.002) * (0.8 * np.exp(-o / SR / 0.9))
save(mix((rise, 0), (bang, m), (crk * 0.7, m)), 'fire', -1)
print('ok')
