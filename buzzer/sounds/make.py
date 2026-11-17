# لإعادة التوليد: python3 make.py <مجلد الإخراج>  (يحتاج numpy و scipy و ffmpeg)
# توليد مؤثرات جرس أثَر: جرس طاولة معدني (ليس آلة موسيقية) وصوت منع إلكتروني
import numpy as np, subprocess, sys
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 44100
OUT = sys.argv[1]

def strike(f0, dur, amp=1.0, decay=1.0, bright=1.0):
    t = np.arange(int(SR*dur))/SR
    ratios = [1.0, 2.41, 4.07, 5.93, 8.21, 10.9]
    amps   = [1.0, .62, .42, .26, .15, .08]
    decs   = [2.4, 1.5, .85, .5, .3, .18]
    y = np.zeros_like(t)
    for r, a, d in zip(ratios, amps, decs):
        for det in (-0.0018, 0.0018):           # زوج متقارب يعطي لمعان المعدن
            y += a*(bright if r > 3 else 1)*np.sin(2*np.pi*f0*r*(1+det)*t + np.random.rand()*6)*np.exp(-t/(d*decay))
    # طرقة المطرقة: ضجيج قصير عالي التردد
    n = np.random.randn(len(t))*np.exp(-t/0.004)
    n = sosfilt(butter(2, 3500, 'hp', fs=SR, output='sos'), n)
    y = y/len(ratios) + 0.9*n
    att = np.minimum(1, t/0.0015)
    return amp*y*att

def place(total, parts):
    y = np.zeros(int(SR*total))
    for at, s in parts:
        i = int(SR*at); j = min(len(y), i+len(s)); y[i:j] += s[:j-i]
    return y

def finish(y, name, gain=1.0, drive=1.6):
    y = np.tanh(drive*y/np.max(np.abs(y)))      # قوة وحضور بدون تشويه حاد
    y = gain*0.97*y/np.max(np.abs(y))
    fade = int(SR*0.03); y[-fade:] *= np.linspace(1, 0, fade)
    wavfile.write(f'/tmp/{name}.wav', SR, (y*32767).astype(np.int16))
    subprocess.run(['ffmpeg','-y','-loglevel','error','-i',f'/tmp/{name}.wav','-ac','1','-b:a','128k',f'{OUT}/{name}.mp3'], check=True)

np.random.seed(7)
# ١) شاشة المقدّم: أول ضغطة: جرس قوي «دِنغ-دِنغ»
finish(place(2.2, [(0, strike(1180, 2.2, 1.0, 1.0, 1.15)), (0.17, strike(1180, 2.0, 0.85, 1.0, 1.15))]), 'bell-host', drive=2.2)
# ٢) شاشة المقدّم: الضغطات اللي بعدها: جرس أخف
finish(place(1.1, [(0, strike(1420, 1.1, 1.0, .55))]), 'bell-next', gain=.55)
# ٣) جوال المشارك عند الضغط: دِنغ واحدة واضحة
finish(place(1.3, [(0, strike(1520, 1.3, 1.0, .7, 1.1))]), 'bell-press', drive=2.0)
# ٤) صوت المنع: «بززز بززز» إلكتروني عند الضغط والجرس مقفول
t = np.arange(int(SR*0.5))/SR
saw = lambda f: 2*((t*f) % 1) - 1
b = saw(146) + saw(151.5) + 0.6*np.sign(np.sin(2*np.pi*73*t))
b = sosfilt(butter(2, 1800, 'lp', fs=SR, output='sos'), b)
gate = ((t < 0.17) | ((t > 0.24) & (t < 0.44))).astype(float)
gate = np.convolve(gate, np.ones(80)/80, 'same')
finish(b*gate, 'deny', gain=.85, drive=1.4)
print('done')
