# لإعادة التوليد: python3 make.py <مجلد الإخراج>  (يحتاج numpy و scipy و ffmpeg)
# مؤثرات السلم والثعبان: خشخشة نرد، طرقات خشبية صاعدة للسلم، فحيح وانزلاق للثعبان (بلا موسيقى ولا آلات)
import numpy as np, subprocess, sys
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 44100
OUT = sys.argv[1]
rng = np.random.default_rng(11)
bp = lambda x, lo, hi: sosfilt(butter(2, [lo, hi], 'bp', fs=SR, output='sos'), x)

def place(total, parts):
    y = np.zeros(int(SR*total))
    for at, s in parts:
        i = int(SR*at); j = min(len(y), i+len(s)); y[i:j] += s[:j-i]
    return y

def finish(y, name, gain=0.95, drive=1.4):
    y = np.tanh(drive*y/np.max(np.abs(y)))
    y = gain*y/np.max(np.abs(y))
    f = int(SR*0.02); y[-f:] *= np.linspace(1, 0, f)
    wavfile.write(f'/tmp/{name}.wav', SR, (y*32767).astype(np.int16))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'/tmp/{name}.wav','-ac','1','-b:a','128k',f'{OUT}/{name}.mp3'], check=True)

# نقرة نرد بلاستيكي على خشب: ضجيج قصير مرشّح + رنين صغير
def click(amp=1.0):
    n = int(SR*0.05); t = np.arange(n)/SR
    x = bp(rng.standard_normal(n), 1800, 7000)*np.exp(-t/0.006)
    f = rng.uniform(2600, 4200)
    x += 0.35*np.sin(2*np.pi*f*t)*np.exp(-t/0.012)
    return amp*x

# ١) خشخشة النرد (~٠٫٩٥ ثانية مثل دوران النرد) ثم ارتدادتان واستقرار
times, t, a = [], 0.0, 1.0
while t < 0.72:
    times.append((t, a*rng.uniform(.55, 1))); t += rng.uniform(.035, .085); a *= 0.985
times += [(0.80, .85), (0.88, .55), (0.93, .3)]
finish(place(1.05, [(at, click(am)) for at, am in times]), 'dice')

# طرقة خشبية: رنين منخفض قصير مع ضربة
def knock(f, amp=1.0):
    n = int(SR*0.18); t = np.arange(n)/SR
    body = np.sin(2*np.pi*f*t)*np.exp(-t/0.045) + 0.5*np.sin(2*np.pi*f*2.3*t)*np.exp(-t/0.02)
    hit = bp(rng.standard_normal(n), 800, 4000)*np.exp(-t/0.004)
    return amp*(body + 0.6*hit)

# ٢) السلم: سبع طرقات تصعد بالنبرة خلال ~٠٫٨٥ ثانية ثم «بُب» فم للوصول
steps = [(i*0.11, knock(330*1.12**i, 0.8+0.03*i)) for i in range(7)]
n = int(SR*0.12); tt = np.arange(n)/SR
pop = np.sin(2*np.pi*(380 + 900*tt/0.12)*tt)*np.exp(-tt/0.03)   # فرقعة فم صاعدة
finish(place(1.05, steps + [(0.8, 1.1*pop)]), 'ladder')

# ٣) الثعبان: فحيح يكبر ثم انزلاق نازل
dur = 1.0; n = int(SR*dur); t = np.arange(n)/SR
hiss = sosfilt(butter(4, 4500, 'hp', fs=SR, output='sos'), rng.standard_normal(n))
hiss *= np.clip(t/0.18, 0, 1)*np.exp(-np.clip(t-0.35, 0, None)/0.12)
# انزلاق: ضجيج بمرشّح يتحرك من ٢٢٠٠ إلى ٢٥٠ هرتز
slide = np.zeros(n); noise = rng.standard_normal(n); seg = 1024
for i in range(0, n, seg):
    k = i/n
    fc = 2200*(1-k)**2 + 250
    if t[i] < 0.25: continue
    slide[i:i+seg] = bp(noise[i:i+seg], fc*0.7, fc*1.3)
slide *= np.clip((t-0.25)/0.08, 0, 1)*np.exp(-np.clip(t-0.3, 0, None)/0.35)
finish(0.9*hiss + 1.3*slide, 'snake', drive=1.6)
print('done')
