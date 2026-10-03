import json,sys,glob
d=json.load(open('tools/cache/draft3.json',encoding='utf-8'))
ru={}
for f in ['tools/content/ru_words.tsv']+sorted(glob.glob('tools/content/ru_words_*.tsv')):
    for l in open(f,encoding='utf-8'):
        a=l.rstrip('\n').split('\t'); ru[a[0]]=a[1]
done=set()
for f in glob.glob('tools/content/sent_*.tsv'):
    for l in open(f,encoding='utf-8'):
        a=l.rstrip('\n').split('\t')
        if len(a)>=3: done.add(a[0])
todo=[w for w in d['words'] if w['w'] not in done]
if __name__=='__main__':
    n=int(sys.argv[1])
    print(len(todo),'todo')
    print(' ; '.join(f"{w['w']} [{w['py']}] {ru[w['w']].split(';')[0]}" for w in todo[:n]))
