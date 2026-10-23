import numpy as np, sys, json
from scipy.signal import stft, medfilt
sr=22050; x=np.fromfile(sys.argv[1],dtype=np.float32)
BPM=122.0; P=60/BPM; PH=0.0154; S16=P/4
dur=len(x)/sr
nfft=4096; hop=256
f,t,Z=stft(x,sr,nperseg=nfft,noverlap=nfft-hop,boundary=None,padded=False)
A=np.abs(Z)
NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
# ---- chroma ----
midi_of_bin=np.full(len(f),-1.0); ok=(f>55)&(f<2000); midi_of_bin[ok]=69+12*np.log2(f[ok]/440)
pc=np.where(ok,np.round(midi_of_bin)%12,-1).astype(int)
C=np.zeros((12,A.shape[1]))
for k in range(12): C[k]=(A[pc==k]**0.5).sum(0)
def frames_between(a,b): return (t>=a)&(t<b)
# key
prof_maj=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]); prof_min=np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
tot=C.sum(1); ks=[]
for r in range(12):
    ks.append((np.corrcoef(np.roll(prof_maj,r),tot)[0,1],NAMES[r]+' major',r,'maj')); ks.append((np.corrcoef(np.roll(prof_min,r),tot)[0,1],NAMES[r]+' minor',r,'min'))
ks.sort(reverse=True); print('key', [(k[1],round(k[0],3)) for k in ks[:3]])
key_root=ks[0][2]; key_mode=ks[0][3]
# chords per half bar (2 beats)
templ=[]
for r in range(12):
    for q,iv in (('',[0,4,7]),('m',[0,3,7])):
        v=np.zeros(12); v[[(r+i)%12 for i in iv]]=1; v[r]+=0.5; templ.append((NAMES[r]+q,r,q,v/np.linalg.norm(v)))
nb=int((dur-PH)/P)
chords=[]
for hb in range(0,nb,2):
    a=PH+hb*P; b=a+2*P
    v=C[:,frames_between(a,b)].mean(1) if frames_between(a,b).any() else np.zeros(12)
    v=v/ (np.linalg.norm(v)+1e-9)
    sc=[(float(v@tv),name,r,q) for name,r,q,tv in templ]
    sc.sort(reverse=True); chords.append(sc[0])
# smooth: keep chord if next is same etc
names=[c[1] for c in chords]
print('chords per 2 beats:')
for bar in range(0,len(names),8):
    print(f'{bar//2:3d}', ' '.join(f'{n:4s}' for n in names[bar:bar+8]))
# ---- melody (harmonic salience) ----
mids=np.arange(55,86)  # G3..C#6
logA=A
sal=np.zeros((len(mids),A.shape[1]))
df=f[1]-f[0]
for i,m in enumerate(mids):
    f0=440*2**((m-69)/12)
    s=0
    for h in range(1,6):
        k=int(round(f0*h/df))
        if k+1>=len(f): break
        s=s+ (0.8**(h-1))*A[k-1:k+2].max(0)
    sal[i]=s
mel_idx=sal.argmax(0); mel_val=sal.max(0)
thr=np.percentile(mel_val,45)
mel=np.where(mel_val>thr, mids[mel_idx], 0)
# 16分ごと
n16=int((dur-PH)/S16)
notes=[]
for k in range(n16):
    a=PH+k*S16; b=a+S16; fr=frames_between(a,b)
    vals=mel[fr]; vals=vals[vals>0]
    if len(vals)<max(1,fr.sum()//2): notes.append(0); continue
    m=int(np.median(vals)); notes.append(m)
# snap to scale
scale=[0,2,4,5,7,9,11] if key_mode=='maj' else [0,2,3,5,7,8,10]
def snap(m):
    if m==0: return 0
    best=min(range(m-1,m+2), key=lambda q: (0 if (q-key_root)%12 in scale else 1, abs(q-m)))
    return best
notes=[snap(m) for m in notes]
# octave fix: keep within +-7 of running median
out=[]; run=[]
for m in notes:
    if m:
        med=np.median(run[-16:]) if run else m
        while m-med>7: m-=12
        while med-m>7: m+=12
        run.append(m)
    out.append(m)
# 1マスだけの孤立音を消す
for i in range(1,len(out)-1):
    if out[i] and out[i-1]==0 and out[i+1]==0: out[i]=0
def nm(m): return NAMES[m%12]+str(m//12-1) if m else '.'
print('melody per bar (16ths):')
for bar in range(0,len(out),16):
    print(f'{bar//16:3d}', ' '.join(f'{nm(m):4s}' for m in out[bar:bar+16]))
json.dump({'bpm':BPM,'phase':PH,'key':ks[0][1],'chords':names,'melody':out,'dur':dur},open(sys.argv[2],'w'))
