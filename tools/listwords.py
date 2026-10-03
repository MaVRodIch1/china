import json,sys
d=json.load(open('tools/cache/draft3.json',encoding='utf-8'))
ru={}
for l in open('tools/content/ru_words.tsv',encoding='utf-8'):
    a=l.rstrip('\n').split('\t'); ru[a[0]]=a[1]
import glob
for f in glob.glob('tools/content/ru_words_*.tsv'):
    for l in open(f,encoding='utf-8'):
        a=l.rstrip('\n').split('\t')
        if len(a)>=2: ru[a[0]]=a[1]
todo=[w for w in d['words'] if w['w'] not in ru]
if __name__=='__main__':
    a,b=int(sys.argv[1]),int(sys.argv[2])
    print(len(todo),'todo')
    for w in todo[a:b]:
        print(w['w'],w['py'],'|',w['en'][0][:45]+(' / '+w['en'][1][:30] if len(w['en'])>1 else ''),'|',','.join(w['pos'][:2]),w['lv'])
