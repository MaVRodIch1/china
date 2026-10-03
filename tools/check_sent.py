import json,glob,re,collections
d=json.load(open('tools/cache/draft3.json',encoding='utf-8'))
chars=set(d['chars'])
S={}
for f in sorted(glob.glob('tools/content/sent_*.tsv')):
    for i,l in enumerate(open(f,encoding='utf-8'),1):
        a=l.rstrip('\n').split('\t')
        if len(a)!=3: print('BAD',f,i,l[:40]); continue
        S[a[0]]=(a[1],a[2])
words={w['w']:w for w in d['words']}
print(len(S),len(words),'missing',[w for w in words if w not in S][:10],'extra',[w for w in S if w not in words][:10])
nocont=[w for w,(z,r) in S.items() if w not in z and w.replace('儿','') not in z]
print('not containing word:',len(nocont),nocont[:60])
oov=collections.Counter()
bad=[]
for w,(z,r) in S.items():
    o=[c for c in z if '一'<=c<='鿿' and c not in chars]
    if o: bad.append((w,z,''.join(o))); oov.update(o)
print('sentences with chars outside HSK3.0 1-3 char set:',len(bad))
print(oov.most_common(60))
for b in bad[:60]: print(b)
