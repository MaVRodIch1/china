#!/usr/bin/env python3
"""Шаг 1: собирает из открытых источников «черновик» данных: HSK 3.0 уровни 1–4 (HSK_STD=new) или HSK 2.0 уровни 1–3 (HSK_STD=old).
Источники: complete-hsk-vocabulary (слова, уровни, пиньинь), Make Me a Hanzi (черты, разложение, этимология).
Результат: tools/cache/draft.json (используется build.py и для написания русских текстов)."""
import json, re, os, urllib.request
from pypinyin import pinyin, Style
import unicodedata

def norm(x): return unicodedata.normalize('NFC', x).replace(' ', '').lower()
def base(x): return ''.join(c for c in unicodedata.normalize('NFD', x) if unicodedata.category(c) != 'Mn')
def HZtone(x):
    for t, m in enumerate(['āēīōūǖ', 'áéíóúǘ', 'ǎěǐǒǔǚ', 'àèìòùǜ'], 1):
        if any(c in x for c in m): return t
    return 5
def pyw(word, pos):
    s = [x[0] for x in pinyin(word, style=Style.TONE)]
    s = ' '.join(s)
    if any(t in pos for t in ('ns', 'nr', 'nz')): s = s[0].upper() + s[1:]
    return s

C = os.path.join(os.path.dirname(__file__), 'cache'); os.makedirs(C, exist_ok=True)
def get(url, name):
    p = os.path.join(C, name)
    if not os.path.exists(p):
        urllib.request.urlretrieve(url, p)
    return p
STD = os.environ.get('HSK_STD', 'new')   # 'new' — HSK 3.0, 'old' — HSK 2.0
H = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/exclusive/' + STD + '/%d.json'
M = 'https://raw.githubusercontent.com/skishore/makemeahanzi/master/'
# Основное чтение слова (HSK) там, где автоматический выбор неверен
WORDFIX = {'得': 'de', '长': 'cháng', '便宜': 'pián yi', '教': 'jiāo', '地': 'dì', '分': 'fēn', '行': 'xíng',
           '切': 'qiē', '大方': 'dà fang', '大爷': 'dà ye'}
words = []
MAXLV = int(os.environ.get('HSK_MAX', '4')) if STD == 'new' else 3   # HSK 3.0 — уровни 1–4
for lv in range(1, MAXLV + 1):
    for w in json.load(open(get(H % lv, f'{STD}{lv}.json' if STD == 'new' else f'hsk{lv}.json'), encoding='utf-8')):
        py = pyw(w['simplified'], w.get('pos', []))
        def compat(fp):  # то же чтение, но в словаре может быть нейтральный тон
            a, b = fp.lower().split(), py.lower().split()
            if len(a) != len(b): return False
            return all(x == y or (HZtone(x) == 5 and base(x) == base(y)) for x, y in zip(a, b))
        proper = any(t in w.get('pos', []) for t in ('ns', 'nr', 'nz'))
        cands = [f for f in w['forms'] if compat(f['transcriptions']['pinyin']) and (proper or not f['transcriptions']['pinyin'][0].isupper())]
        f = cands[0] if cands else None
        if f: py = f['transcriptions']['pinyin']
        else: f = w['forms'][0]
        py = WORDFIX.get(w['simplified'], py)
        py = py if w.get('pos', [''])[:1] in (['ns'], ['nz']) else py[0].lower() + py[1:]
        words.append(dict(w=w['simplified'], py=py, en=f['meanings'][:3], lv=lv, pos=w.get('pos', []), fr=w.get('frequency', 99999), rad=w.get('radical', '')))
mm = {}
for line in open(get(M + 'dictionary.txt', 'dictionary.txt'), encoding='utf-8'):
    d = json.loads(line); mm[d['character']] = d
strokes = {}
for line in open(get(M + 'graphics.txt', 'graphics.txt'), encoding='utf-8'):
    d = json.loads(line); strokes[d['character']] = len(d['medians'])
isch = lambda c: '一' <= c <= '鿿'
chars = {}
for w in words:
    sy = [x[0] for x in pinyin(w['w'], style=Style.TONE)]
    for i, c in enumerate(w['w']):
        if not isch(c): continue
        e = chars.setdefault(c, dict(ch=c, lv=w['lv'], fr=w['fr'], py=None, words=[]))
        e['lv'] = min(e['lv'], w['lv'])
        e['words'].append(w['w'])
        if len(sy) == len(w['w']):
            cand = (w['lv'], 0 if len(w['w']) == 1 else 1, w['fr'])
            if e['py'] is None or cand < e['pyk']: e['py'] = sy[i]; e['pyk'] = cand
        if len(w['w']) == 1: e['fr'] = min(e['fr'], w['fr'])
        else: e['fr'] = min(e['fr'], w['fr'] + 100000) if e['fr'] > 100000 else e['fr']
for c, e in chars.items():
    m = mm.get(c, {})
    e['def'] = m.get('definition', ''); e['dec'] = m.get('decomposition', ''); e['rad'] = m.get('radical', '')
    e['ety'] = m.get('etymology'); e['strokes'] = strokes.get(c, 0)
    e.pop('pyk', None)
    if e['py'] is None: e['py'] = (m.get('pinyin') or [''])[0]
json.dump(dict(words=words, chars=chars), open(os.path.join(C, 'draft.json' if STD == 'old' else 'draft3.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(len(words), 'words', len(chars), 'chars', sum(1 for e in chars.values() if not e['py']), 'no pinyin', sum(1 for e in chars.values() if not e['strokes']), 'no strokes')
