import numpy as np, json, sys
from scipy.signal import stft
"""メロディの清書：明らかな誤検出を直し、原曲の『声の立ち上がり』で音を区切る"""
tr=json.load(open(sys.argv[1])); mel=list(tr['melody'][:42*16])
sr=22050; x=np.fromfile(sys.argv[2],dtype=np.float32)
BPM=122.0; P=60/BPM; PH=0.0154; S16=P/4
NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
nm=lambda m: NAMES[m%12]+str(m//12-1) if m else '.'
def setbar(b, s, notes):
    for i,v in enumerate(notes): mel[b*16+s+i]=v
N=lambda s: {'A4':69,'B4':71,'C5':72,'D5':74,'E5':76,'F5':77,'G5':79,'A5':81,'G4':67,'E4':64,'F4':65,'.':0}[s]
# --- 個別の直し（耳コピの誤検出） ---
setbar(0,0,[N(x) for x in 'E5 E5 . . D5 D5 . . E5 E5 . . G5 G5 . .'.split()])
setbar(4,12,[N('G5'),N('G5')])
setbar(6,0,[N('A4'),N('A4')])
setbar(8,12,[N('C5'),N('C5')])
setbar(15,0,[N(x) for x in 'G4 G4 . . A4 A4 A4 .'.split()])
for b in (20,24): setbar(b,2,[N('E5'),N('E5'),N('E5')])
setbar(32,8,[N('A4')])
# --- 一般則：前後どちらとも 7 半音以上離れた 1 マスは前の音に寄せる ---
for i in range(1,len(mel)-1):
    m=mel[i]
    if m and mel[i-1] and mel[i+1] and abs(m-mel[i-1])>7 and abs(m-mel[i+1])>7: mel[i]=mel[i-1]
# --- 原曲の中域の立ち上がり（16分ごと） ---
f,t,Z=stft(x,sr,nperseg=1024,noverlap=1024-128,boundary=None,padded=False)
A=np.log1p(50*np.abs(Z)); band=(f>250)&(f<3000)
flux=np.concatenate([[0],np.maximum(0,np.diff(A[band],axis=1)).sum(0)])
fr=sr/128
on=[]
for k in range(len(mel)):
    tk=PH+k*S16; i=int((tk-t[0])*fr); on.append(flux[max(0,i-2):i+3].max() if i<len(flux) else 0)
on=np.array(on); thr=np.percentile(on[np.array(mel)>0],55)
# --- ノートにまとめる：同じ高さが続いても、強い立ち上がりがあれば打ち直す ---
notes=[]; i=0
while i<len(mel):
    m=mel[i]
    if not m: i+=1; continue
    j=i
    while j+1<len(mel) and mel[j+1]==m and on[j+1]<thr: j+=1
    notes.append([i, j-i+1, int(m)]); i=j+1
json.dump({'notes':notes,'melody':mel},open(sys.argv[3],'w'))
print('notes',len(notes))
for b in range(0,42):
    row=['.']*16
    for s,l,m in notes:
        if s//16==b:
            row[s%16]=nm(m)
            for q in range(1,l):
                if (s+q)//16==b: row[(s+q)%16]='-'
    print(f'{b:2d}',' '.join(f'{c:3s}' for c in row))
