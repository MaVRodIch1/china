import json,sys,re
sys.path.insert(0,'tools')
from ids import components
d=json.load(open('tools/cache/draft.json',encoding='utf-8'))
src=open('js/data/hsk-starter.js',encoding='utf-8').read()
have=set(re.findall(r"^    \['(.)'",src,re.M))
ru={}
for l in open('tools/content/ru_words.tsv',encoding='utf-8'):
    a=l.rstrip('\n').split('\t'); ru[a[0]]=a[1]
gl={}
for l in open('tools/content/ru_glyphs.tsv',encoding='utf-8'):
    a=l.rstrip('\n').split('\t'); gl[a[0]]=a[1]
for k,v in re.findall(r"'(.)': '([^']+)'",src.split('rows:')[0]): gl.setdefault(k,v)
new=[c for c in d['chars'] if c not in have]
new.sort(key=lambda c:(d['chars'][c]['lv'],d['chars'][c]['fr']))
def order(): return new
if __name__=='__main__':
    a,b=int(sys.argv[1]),int(sys.argv[2])
    for c in new[a:b]:
        e=d['chars'][c]; ety=e['ety'] or {}
        cs=components(e['dec'])
        ct=[]
        for x in cs:
            t=gl.get(x,'')
            r=''
            if ety.get('phonetic')==x: r='*звук'
            if ety.get('semantic')==x: r='*смысл'
            ct.append(f"{x}{('='+t) if t else ''}{r}")
        ws=[w for w in dict.fromkeys(e['words'])][:4]
        print(f"{c} {e['py']} L{e['lv']} s{e['strokes']} | {e['def'][:50]} | {' '.join(ct)} | {ety.get('type','')}: {(ety.get('hint') or '')[:70]} | {' '.join(w+':'+ru.get(w,'?') for w in ws)}")
