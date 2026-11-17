# لإعادة التوليد: python3 make.py <مجلد الإخراج>  (يحتاج numpy و scipy و ffmpeg)
# جرس السوق: جرس نحاسي يُقرع بسرعة عند الإعلان عن أسعار الجولة (مؤثر أداة، بلا موسيقى ولا آلات)
import numpy as np, subprocess, sys
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 44100; OUT = sys.argv[1]; rng = np.random.default_rng(9)

def strike(f0, amp, dur=1.2):
    n = int(SR*dur); t = np.arange(n)/SR
    ratios = [1.0, 2.0, 2.73, 4.18, 5.4]; amps = [1, .45, .55, .25, .12]; decs = [.9, .6, .4, .22, .12]
    y = sum(a*np.sin(2*np.pi*f0*r*(1+rng.uniform(-.001,.001))*t + rng.random()*6)*np.exp(-t/d) for r, a, d in zip(ratios, amps, decs))
    hit = sosfilt(butter(2, 2500, 'hp', fs=SR, output='sos'), rng.standard_normal(n))*np.exp(-t/0.003)
    return amp*(y/2.2 + .6*hit)

total = 2.2; y = np.zeros(int(SR*total))
t = 0.0; k = 0
while t < 1.15:                         # قرع سريع ~٩ ضربات في الثانية
    s = strike(780, 0.75 + 0.25*rng.random())
    i = int(SR*t); j = min(len(y), i+len(s)); y[i:j] += s[:j-i]
    t += 0.11 + rng.uniform(-.01, .01); k += 1
y = np.tanh(1.5*y/np.max(np.abs(y))); y = 0.95*y/np.max(np.abs(y))
f = int(SR*0.05); y[-f:] *= np.linspace(1, 0, f)
wavfile.write('/tmp/bell.wav', SR, (y*32767).astype(np.int16))
subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/bell.wav','-ac','1','-b:a','128k',f'{OUT}/bell.mp3'], check=True)
print('done')
