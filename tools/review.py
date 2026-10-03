import json,glob,sys
d=json.load(open('tools/cache/draft3.json',encoding='utf-8'))
ru={};S={}
for f in ['tools/content/ru_words.tsv']+sorted(glob.glob('tools/content/ru_words_*.tsv')):
    for l in open(f,encoding='utf-8'):
        a=l.rstrip('\n').split('\t'); ru[a[0]]=a[1]
for f in sorted(glob.glob('tools/content/sent_*.tsv')):
    for l in open(f,encoding='utf-8'):
        a=l.rstrip('\n').split('\t'); S[a[0]]=(a[1],a[2])
a,b=int(sys.argv[1]),int(sys.argv[2])
for w in d['words'][a:b]:
    z,r=S[w['w']]
    print(f"{w['w']} {w['py']} | {w['en'][0][:34]} | {ru[w['w']]} | {z} | {r}")
