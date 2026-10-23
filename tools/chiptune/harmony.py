import json, sys, itertools
"""メロディに合う和音を小節ごとに選ぶ（動的計画法）。A マイナーのダイアトニック＋よく使う進行を優先"""
mel=json.load(open(sys.argv[1]))['notes']
CH = {  # 名前: (ルート, 構成音)
 'Am': (9,[9,0,4]), 'C': (0,[0,4,7]), 'Dm': (2,[2,5,9]), 'Em': (4,[4,7,11]),
 'F': (5,[5,9,0]), 'G': (7,[7,11,2]), 'E': (4,[4,8,11]),
}
names=list(CH)
def fit(bar, ch):
    root,tones=CH[ch]; sc=0
    for s,l,m in mel:
        if s//16!=bar: continue
        pc=m%12; pos=s%16; w=l*(1.6 if pos%4==0 else 1.0)*(1.3 if pos==0 else 1)
        if pc in tones: sc+=1.0*w
        elif any((pc-t)%12==1 for t in tones): sc-=1.1*w        # 和音の半音上はぶつかる
        elif pc==8 and ch!='E': sc-=2*w
        else: sc+=0.25*w                                        # 9th・6th などの色
    return sc
GOOD={('F','G'),('G','Am'),('G','Em'),('Em','Am'),('Am','F'),('Dm','G'),('C','G'),('G','C'),('Am','Dm'),('F','Em'),('Em','F'),('Am','G'),('F','C'),('C','F'),('Dm','Em'),('E','Am'),('Am','Em'),('G','E')}
def trans(a,b,bar):
    if a==b: return -0.3
    return 0.8 if (a,b) in GOOD else 0.0
NB=42
# 区間ごとに、使える和音とテンプレート
def section(b): return 'A' if b<16 else 'F' if b<18 else 'B' if b<26 else 'C'
INF=-1e9
best=[{c:(fit(0,c)+(1.5 if c=='Am' else 0),None) for c in names}]
for b in range(1,NB):
    row={}
    for c in names:
        cand=[]
        for p,(v,_) in best[-1].items():
            bonus=0
            if section(b)=='C':  # サビは 4-5-3-6（F G Em Am）に寄せる
                want=['F','G','Em','Am'][(b-26)%4]; bonus+=1.2 if c==want else 0
            if section(b)=='B':
                want=['Am','Em','F','G'][(b-18)%4]; bonus+=0.8 if c==want else 0
            if section(b)=='F':
                want=['F','G'][b-16]; bonus+=1.5 if c==want else 0
            if c=='E' and section(b)!='F' and b!=41: bonus-=1.0
            cand.append((v+trans(p,c,b)+fit(b,c)+bonus,p))
        row[c]=max(cand)
    best.append(row)
# 最後の小節は E（ドミナント）で頭の Am に戻る
end='E' if best[-1]['E'][0]>best[-1]['G'][0]-2 else 'G'
seq=[end]
for b in range(NB-1,0,-1): seq.append(best[b][seq[-1]][1])
seq=seq[::-1]
for b in range(0,NB,4): print(f'{b:2d}', ' '.join(f'{c:3s}' for c in seq[b:b+4]))
json.dump(seq,open(sys.argv[2],'w'))
