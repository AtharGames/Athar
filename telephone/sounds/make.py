# لإعادة التوليد: python3 make.py <مجلد الإخراج>  (يحتاج numpy و scipy و ffmpeg)
# رنّة تيلفون قديم: مطرقة كهربائية تضرب جرسين بسرعة «رررن رررن» (مؤثر أداة، بلا موسيقى ولا آلات)
import numpy as np, subprocess, sys
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 44100; OUT = sys.argv[1]; rng = np.random.default_rng(5)

def strike(f0, amp):
    n = int(SR*0.45); t = np.arange(n)/SR
    ratios = [1.0, 2.32, 4.1, 5.6]; amps = [1, .5, .3, .15]; decs = [.28, .16, .09, .05]
    y = sum(a*np.sin(2*np.pi*f0*r*t)*np.exp(-t/d) for r, a, d in zip(ratios, amps, decs))
    hit = sosfilt(butter(2, 3000, 'hp', fs=SR, output='sos'), rng.standard_normal(n))*np.exp(-t/0.002)
    return amp*(y/2 + .5*hit)

def burst(total, start, dur, rate=22):
    y = np.zeros(int(SR*total))
    k = 0; t = start
    while t < start + dur:
        s = strike(1320 if k % 2 else 1040, 0.85 + 0.15*rng.random())   # الجرسان بالتناوب
        i = int(SR*t); j = min(len(y), i+len(s)); y[i:j] += s[:j-i]
        t += 1/rate; k += 1
    return y

y = burst(1.5, 0.0, 0.42) + burst(1.5, 0.62, 0.42)   # رررن… رررن
y = np.tanh(1.6*y/np.max(np.abs(y))); y = 0.95*y/np.max(np.abs(y))
f = int(SR*0.03); y[-f:] *= np.linspace(1, 0, f)
wavfile.write('/tmp/ring.wav', SR, (y*32767).astype(np.int16))
subprocess.run(['ffmpeg','-y','-loglevel','error','-i','/tmp/ring.wav','-ac','1','-b:a','128k',f'{OUT}/ring.mp3'], check=True)
print('done')
