# لإعادة التوليد: python3 make.py <مجلد الإخراج>  (يحتاج numpy و scipy و ffmpeg)
# مؤثر الثعبان: فحيح وانزلاق (بلا موسيقى ولا آلات). عدّاد الأرقام والسلم يستخدمان أصوات athar-sound.js
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
