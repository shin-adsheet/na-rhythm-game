import numpy as np, json, sys, wave
from scipy.signal import lfilter, butter, sosfilt, fftconvolve
"""
「な 2」チップチューン・アレンジ v2
- メロディは原曲（耳コピ・清書済み）。和音・ベース・ドラム・構成は新しく編曲
- 帯域制限した矩形波（PolyBLEP）でギザギザの耳障りな音を抑え、ディレイ・リバーブ・サイドチェイン・マスタリングまで
"""
SR = 44100
BPM = 122.0; BEAT = 60 / BPM; S16 = BEAT / 4; BAR = BEAT * 4; NB = 42
L = int(NB * BAR * SR)
mel = json.load(open(sys.argv[1]))['notes']
rng = np.random.default_rng(7)

def mf(m): return 440.0 * 2 ** ((m - 69) / 12)
def db(x): return 10 ** (x / 20)

# ---------------- 発音体 ----------------
def poly_blep(t, dt):
    out = np.zeros_like(t)
    m = t < dt; x = t[m] / dt[m]; out[m] = x + x - x * x - 1
    m = t > 1 - dt; x = (t[m] - 1) / dt[m]; out[m] = x * x + x + x + 1
    return out
def pulse(freq, duty):
    """freq, duty は配列（ビブラート・ポルタメント・PWM 用）"""
    dt = freq / SR
    ph = np.cumsum(dt) % 1.0
    duty = np.broadcast_to(duty, ph.shape)
    naive = np.where(ph < duty, 1.0, -1.0)
    return naive + poly_blep(ph, dt) - poly_blep((ph - duty) % 1.0, dt)
def tri4(freq):
    ph = np.cumsum(freq / SR) % 1.0
    tri = 1 - 4 * np.abs(ph - 0.5)
    return np.round(tri * 7.5) / 7.5          # ファミコンの 4 ビット三角波
def lp1(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    return lfilter([1 - a], [1, -a], x)
# ファミコンのノイズ（15 ビット LFSR）
def lfsr(short=False):
    reg = 1; out = []
    for _ in range(93 if short else 32767):
        b = (reg ^ (reg >> (6 if short else 1))) & 1
        reg = (reg >> 1) | (b << 14); out.append(1.0 if reg & 1 else -1.0)
    return np.array(out)
NZ_LONG, NZ_SHORT = lfsr(False), lfsr(True)
def noise(n, rate, short=False):
    src = NZ_SHORT if short else NZ_LONG
    idx = (np.arange(n) * rate / SR).astype(int) % len(src)
    return src[idx]
def adsr(n, a, d, s, r, gate):
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-4), s))
    return e * np.clip(1 - (t - gate) / max(r, 1e-4), 0, 1) * (t >= 0)

# ---------------- バス（ステム） ----------------
stems = {k: np.zeros((2, L)) for k in ['lead', 'harm', 'counter', 'arp', 'pad', 'bass', 'kick', 'snare', 'hat', 'cym', 'tom']}
def put(stem, t0, sig, pan=0.0, gain=1.0):
    i = int(round(t0 * SR))
    if i >= L or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[: L - i] * gain
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    stems[stem][0, i:i + len(sig)] += sig * l * 1.414
    stems[stem][1, i:i + len(sig)] += sig * r * 1.414

def section(b):
    return 'A1' if b < 8 else 'A2' if b < 16 else 'F' if b < 18 else 'B' if b < 26 else ('C1' if b < 34 else 'C2')

# ---------------- 和音 ----------------
PROG = (['C', 'Am', 'F', 'G'] * 4)[:16] + ['F', 'G'] + ['Am', 'F', 'Am', 'F', 'Am', 'F', 'G', 'G'] + (['F', 'G', 'Am', 'Am', 'Dm', 'G', 'Am', 'Am'] * 2)
PROG[41] = 'G'
VOICE = {   # パッド用（7th などの色つき、C4 前後で近い形）
    'C': [60, 64, 67, 74], 'Am': [57, 60, 64, 67], 'F': [57, 60, 64, 65], 'G': [59, 62, 67, 69],
    'Dm': [57, 60, 62, 65], 'Em': [59, 62, 64, 67],
}
ROOT = {'C': 36, 'Am': 33, 'F': 41, 'G': 43, 'Dm': 38, 'Em': 40}
TONES = {'C': [0, 4, 7], 'Am': [9, 0, 4], 'F': [5, 9, 0], 'G': [7, 11, 2], 'Dm': [2, 5, 9], 'Em': [4, 7, 11]}
SCALE = [9, 11, 0, 2, 4, 5, 7]

# ---------------- リード（原曲のメロディ） ----------------
prev_end, prev_m = -1, None
for k, (s, ln, m) in enumerate(mel):
    b = s // 16; sec = section(b)
    t0 = s * S16; dur = ln * S16
    n = int((dur + 0.12) * SR); tt = np.arange(n) / SR
    # ポルタメント（つながった短い音程はなめらかに）
    f = np.full(n, mf(m))
    if prev_m is not None and abs(s - prev_end) <= 1 and 0 < abs(m - prev_m) <= 5:
        g = np.clip(tt / 0.035, 0, 1); f = mf(prev_m) * (mf(m) / mf(prev_m)) ** g
    else:
        f = f * 2 ** (-0.6 * np.exp(-tt / 0.012) / 12)      # 立ち上がりに少ししゃくる
    # 遅れて深くなるビブラート
    vib = np.clip((tt - 0.16) / 0.2, 0, 1) * 0.0145 * np.sin(2 * np.pi * 5.6 * tt)
    f = f * (1 + vib)
    duty = 0.25 - 0.07 * np.clip(tt / max(dur, 0.1), 0, 1)   # PWM
    env = adsr(n, 0.003, 0.12, 0.72, 0.06, dur * 0.95)
    sig = pulse(f, duty) * env
    put('lead', t0, sig, 0.0, db(-9))
    # サビは 1 オクターブ下を重ねて太く
    if sec in ('C1', 'C2'):
        put('lead', t0, pulse(f / 2, 0.5) * env, 0.0, db(-19))
    # サビ後半は 3 度上のハモリ
    if sec == 'C2':
        h = m; c = 0
        while c < 2:
            h += 1
            if h % 12 in SCALE: c += 1
        put('harm', t0, pulse(f * mf(h) / mf(m), 0.125) * env, 0.5, db(-15))
    prev_end, prev_m = s + ln, m

# ---------------- イントロの休みに「返事」のフレーズ ----------------
for b in (2, 3, 6, 7, 10, 11):
    ch = PROG[b]; base = [57 + ((t - 9) % 12) for t in TONES[ch]]
    up = sorted(base) + [x + 12 for x in sorted(base)] + [sorted(base)[0] + 24]
    pat = up[:7] if b % 2 == 0 else up[:7][::-1]
    for i, m in enumerate(pat):
        s16 = 2 + i * 2 if b % 2 == 0 else i * 2
        if s16 > 15: break
        n = int(S16 * 1.6 * SR)
        env = adsr(n, 0.002, 0.05, 0.5, 0.04, S16 * 1.3)
        put('counter', b * BAR + s16 * S16, pulse(np.full(n, mf(m + 12)), 0.125) * env, -0.3 if i % 2 else 0.3, db(-15))

# ---------------- アルペジオ ----------------
for b in range(NB):
    sec = section(b)
    if sec == 'A1': continue
    ch = PROG[b]; v = VOICE[ch]
    pat = [v[0], v[1], v[2], v[3], v[2] + 12, v[3], v[2], v[1]]
    step = S16 / 2 if sec in ('C1', 'C2') else S16
    count = int(round(BAR / step))
    for i in range(count):
        m = pat[i % len(pat)] + 12
        n = int(step * SR)
        env = adsr(n, 0.001, 0.025, 0.35, 0.006, step * 0.85)
        g = db(-19) if sec == 'A2' else db(-18)
        put('arp', b * BAR + i * step, pulse(np.full(n, mf(m)), 0.125) * env, 0.35 if (i // 2) % 2 else -0.35, g)

# ---------------- パッド（2 本の矩形波を少しずらして） ----------------
for b in range(NB):
    sec = section(b)
    if sec in ('A1',): continue
    v = VOICE[PROG[b]]
    n = int((BAR + 0.15) * SR)
    env = adsr(n, 0.09, 0.3, 0.8, 0.12, BAR - 0.02)
    acc = np.zeros(n)
    for m in v:
        acc += pulse(np.full(n, mf(m) * 1.004), 0.5) + pulse(np.full(n, mf(m) * 0.996), 0.5)
    acc = lp1(lp1(acc, 2400), 2400) * env / len(v)
    put('pad', b * BAR, acc, 0.0, db(-17 if sec in ('A2', 'F') else -15))

# ---------------- ベース ----------------
def bass_note(t0, m, dur, gain=1.0, slide_from=None):
    n = int((dur + 0.02) * SR); tt = np.arange(n) / SR
    f = np.full(n, mf(m))
    if slide_from is not None: f = mf(slide_from) * (mf(m) / mf(slide_from)) ** np.clip(tt / 0.03, 0, 1)
    env = adsr(n, 0.002, 0.06, 0.85, 0.015, dur)
    sig = tri4(f) * env + lp1(pulse(f * 2, 0.25), 1200) * env * 0.18
    put('bass', t0, sig, 0.0, db(-9.5) * gain)
for b in range(NB):
    sec = section(b); r = ROOT[PROG[b]]; nxt = ROOT[PROG[(b + 1) % NB]]
    t0 = b * BAR
    if sec == 'A1':
        pat = [(0, 0, 3), (6, 0, 2), (8, 0, 2), (12, 12, 2)] if b >= 4 else [(0, 0, 6), (8, 0, 6)]
    elif sec == 'A2':
        pat = [(i, 12 if i % 4 == 2 else 0, 2) for i in range(0, 16, 2)]
    elif sec == 'F':
        pat = [(i, 0, 2) for i in range(0, 12, 2)] + [(12, 2, 1), (13, 4, 1), (14, 5, 1), (15, 7, 1)]
    elif sec == 'B':
        pat = [(0, 0, 3), (3, 0, 2), (6, 12, 2), (8, 0, 3), (11, 0, 2), (14, 12, 2)]
    else:
        pat = [(i, 12 if i % 4 == 2 else 0, 2) for i in range(0, 14, 2)] + [(14, 0, 1)]
    for (s16, off, ln) in pat:
        bass_note(t0 + s16 * S16, r + off, ln * S16 * 0.9)
    if sec in ('C1', 'C2', 'B') and nxt != r:   # 次の和音へ半音で寄る
        bass_note(t0 + 15 * S16, nxt - 1 if nxt - 1 > r else nxt + 1, S16 * 0.8, 0.85)

# ---------------- ドラム ----------------
def kick(t, g=1.0):
    n = int(0.32 * SR); tt = np.arange(n) / SR
    f = 46 + 130 * np.exp(-tt * 32)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9.5)
    s[: int(0.004 * SR)] += noise(int(0.004 * SR), 30000) * 0.5
    put('kick', t, np.tanh(s * 1.6), 0.0, db(-5) * g)
def snare(t, g=1.0):
    n = int(0.24 * SR); tt = np.arange(n) / SR
    nz = sosfilt(butter(2, [1200, 7000], 'band', fs=SR, output='sos'), noise(n, 18000)) * np.exp(-tt * 17)
    tone = np.sin(2 * np.pi * np.cumsum(190 - 30 * tt / 0.24) / SR) * np.exp(-tt * 35)
    put('snare', t, nz * 1.3 + tone * 0.6, 0.05, db(-6) * g)
def clap(t, g=1.0):
    n = int(0.2 * SR); tt = np.arange(n) / SR
    burst = sum(np.exp(-np.clip(tt - d, 0, None) * 120) * (tt >= d) for d in (0, 0.009, 0.018))
    nz = sosfilt(butter(2, [900, 4000], 'band', fs=SR, output='sos'), noise(n, 20000)) * (burst + np.exp(-tt * 14) * 0.6)
    put('snare', t, nz, -0.1, db(-10) * g)
def hat(t, g=1.0, open_=False, pan=0.25):
    n = int((0.22 if open_ else 0.035) * SR); tt = np.arange(n) / SR
    s = sosfilt(butter(2, 7000, 'high', fs=SR, output='sos'), noise(n, 32000, short=True)) * np.exp(-tt * (13 if open_ else 95))
    put('hat', t, s, pan, db(-13) * g)
def crash(t, g=1.0):
    n = int(2.0 * SR); tt = np.arange(n) / SR
    s = sosfilt(butter(2, 3500, 'high', fs=SR, output='sos'), noise(n, 26000)) * np.exp(-tt * 2.1)
    put('cym', t, s, -0.2, db(-15) * g)
def tom(t, m, g=1.0):
    n = int(0.22 * SR); tt = np.arange(n) / SR
    f = mf(m) * (1 + 0.6 * np.exp(-tt * 30))
    put('tom', t, tri4(f) * np.exp(-tt * 13), 0.0, db(-8) * g)
def riser(t0, length):
    n = int(length * SR); tt = np.arange(n) / SR
    nz = noise(n, 25000)
    fc = 600 + 9000 * (tt / length) ** 2
    out = np.zeros(n); blk = 512
    for i in range(0, n, blk):
        sos = butter(2, min(fc[i], 18000), 'high', fs=SR, output='sos')
        out[i:i + blk] = sosfilt(sos, nz[i:i + blk])
    put('cym', t0, out * (tt / length) ** 1.5, 0.0, db(-19))

for b in range(NB):
    sec = section(b); b0 = b * BAR
    if b in (0, 8, 18, 26, 34): crash(b0, 0.9 if b == 0 else 1.0)
    if sec == 'A1':
        for k in range(0, 16, 2): hat(b0 + k * S16, 0.55 if k % 4 else 0.35)
        if b >= 4:
            for k in (0, 8): kick(b0 + k * S16, 0.85)
            snare(b0 + 12 * S16, 0.7)
        else:
            kick(b0, 0.7)
    elif sec == 'A2':
        for k in (0, 6, 8): kick(b0 + k * S16)
        for k in (4, 12): snare(b0 + k * S16)
        for k in range(16): hat(b0 + k * S16, 0.85 if k % 2 == 0 else 0.45, open_=(k == 14))
        if b == 15:
            for i, (k, m) in enumerate([(8, 57), (10, 55), (12, 52), (14, 48)]): tom(b0 + k * S16, m)
    elif sec == 'F':
        kick(b0); kick(b0 + 8 * S16)
        for k in range(0, 16, 2 if b == 16 else 1): snare(b0 + k * S16, 0.3 + 0.7 * ((b - 16) * 16 + k) / 32)
        if b == 16: riser(b0, 2 * BAR)
    elif sec == 'B':
        for k in (0, 6, 8, 11): kick(b0 + k * S16, 1.0 if k in (0, 8) else 0.8)
        for k in (4, 12): snare(b0 + k * S16)
        for k in range(0, 16, 2): hat(b0 + k * S16, 0.85, open_=(k == 14))
        if b == 25:
            for k in (8, 10, 12, 13, 14, 15): snare(b0 + k * S16, 0.6 + 0.04 * k)
            riser(b0, BAR)
    else:
        for k in (0, 4, 8, 12): kick(b0 + k * S16)
        for k in (4, 12): snare(b0 + k * S16); clap(b0 + k * S16)
        for k in range(16): hat(b0 + k * S16, 1.0 if k % 4 == 2 else 0.5, open_=(k % 4 == 2), pan=0.25 if k % 2 else -0.15)
        if b == 33:
            for k in (12, 13, 14, 15): snare(b0 + k * S16, 0.75)
        if b == 41:
            for i, (k, m) in enumerate([(8, 60), (9, 57), (10, 55), (11, 52), (12, 50), (13, 48), (14, 45), (15, 43)]): tom(b0 + k * S16, m, 0.9)

# ---------------- ミックス ----------------
# キックでパッド・アルペジオ・ハモリを少し沈める（サイドチェイン）
kenv = np.abs(stems['kick'][0]) + np.abs(stems['kick'][1])
kenv = lfilter([1 - np.exp(-1 / (0.09 * SR))], [1, -np.exp(-1 / (0.09 * SR))], kenv)
kenv = kenv / (kenv.max() + 1e-9)
duck = 1 - 0.55 * np.clip(kenv * 2.2, 0, 1)
for k in ('pad', 'arp', 'harm', 'counter'): stems[k] *= duck

# ピンポン・ディレイ（3/16、左右に跳ねる）
def pingpong(x, time, fb=0.36, fc=3800):
    D = int(time * SR); y = np.zeros_like(x)
    lastL = np.zeros(D); lastR = np.zeros(D)
    a = np.exp(-2 * np.pi * fc / SR); zl = zr = 0.0
    for i in range(0, x.shape[1], D):
        seg = slice(i, min(i + D, x.shape[1])); n = seg.stop - seg.start
        inL = x[0, seg] + fb * lastR[:n]; inR = x[1, seg] * 0.0 + fb * lastL[:n]
        fl, zl = lfilter([1 - a], [1, -a], inL, zi=[zl * a])[0], 0.0
        fr = lfilter([1 - a], [1, -a], inR)
        y[0, seg] = fr; y[1, seg] = fl
        lastL = np.pad(fl, (0, D - n)); lastR = np.pad(fr, (0, D - n))
    return y
send_delay = stems['lead'] * 0.30 + stems['counter'] * 0.55 + stems['arp'] * 0.25
delay = pingpong(send_delay, 3 * S16)

# リバーブ（合成したインパルス応答をたたみ込む）
ir_n = int(1.5 * SR); tt = np.arange(ir_n) / SR
ir = np.stack([rng.standard_normal(ir_n), rng.standard_normal(ir_n)]) * np.exp(-tt * 4.0)
ir[:, : int(0.012 * SR)] = 0
ir = np.stack([lp1(ir[0], 6000), lp1(ir[1], 6000)]); ir /= np.abs(ir).sum(1, keepdims=True) ** 0.5 * 60
send_rev = stems['lead'] * 0.22 + stems['snare'] * 0.35 + stems['pad'] * 0.3 + stems['counter'] * 0.3 + stems['harm'] * 0.3 + stems['tom'] * 0.3
rev = np.stack([fftconvolve(send_rev[0], ir[0])[:L], fftconvolve(send_rev[1], ir[1])[:L]])

mix = sum(stems.values()) + delay * db(-6) + rev * db(-4)
# 低域の掃除とマスター
hp = butter(2, 28, 'high', fs=SR, output='sos')
mix = np.stack([sosfilt(hp, mix[0]), sosfilt(hp, mix[1])])
mix = mix / (np.percentile(np.abs(mix), 99.9) + 1e-9) * 0.9
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix *= db(-1) / np.abs(mix).max()
fade = int(0.01 * SR); mix[:, :fade] *= np.linspace(0, 1, fade)
pcm = (mix.T * 32767).astype(np.int16)
w = wave.open(sys.argv[2], 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
rms = lambda v: 20 * np.log10(np.sqrt((v ** 2).mean()) + 1e-12)
print('長さ', round(L / SR, 2), '秒 / 全体RMS', round(rms(mix), 1), 'dBFS')
peak = max(np.abs(s).max() for s in stems.values())
for k, v in stems.items(): print(f'  {k:7s} {rms(v):6.1f} dB')
