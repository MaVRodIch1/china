#!/usr/bin/env python3
"""Сборка текстов для чтения: tools/content/texts.txt -> js/data/texts.js (пиньинь считается pypinyin).
Запуск: python3 tools/build_texts.py [--show]  (--show печатает пиньинь для проверки)"""
import re, os, sys, json
from pypinyin import pinyin, Style
ROOT = os.path.join(os.path.dirname(__file__), '..')
PUNCT = {'，': ',', '。': '.', '！': '!', '？': '?', '、': ',', '；': ';', '：': ':', '…': '…'}
NAMES = r'中国|北京|西安|上海|小明|小花|小黑|汉语|汉字'
def tone(s):
    for t, m in enumerate(['āēīōūǖ', 'áéíóúǘ', 'ǎěǐǒǔǚ', 'àèìòùǜ'], 1):
        if any(c in s for c in m): return t
    return 5
FIX = {'得': None}
def syl(text):
    out = [item[0] for item in pinyin(text, style=Style.TONE, errors=lambda x: list(x))]
    for i, c in enumerate(text[:-1]):
        nxt = tone(out[i + 1]) if i + 1 < len(out) else 5
        if c == '不' and out[i] == 'bù' and nxt == 4: out[i] = 'bú'
        if c == '一' and out[i] == 'yī':
            if nxt == 4: out[i] = 'yí'
            elif nxt in (1, 2, 3): out[i] = 'yì'
    # ручные исправления многозначных знаков
    for i, c in enumerate(text):
        if c == '得' and out[i] != 'de': out[i] = 'de'            # частица после глагола
        if c == '都' and out[i] != 'dōu': out[i] = 'dōu'
    for m in re.finditer(r'(慢慢|认真)地', text): out[m.end() - 1] = 'de'
    for m in re.finditer(r'睡很多觉', text): out[m.end() - 1] = 'jiào'
    for m in re.finditer(NAMES, text):
        out[m.start()] = out[m.start()][0].upper() + out[m.start()][1:]
    res = ''
    for k, sy in enumerate(out):
        if sy in PUNCT: res += PUNCT[sy]
        elif sy == '“': res += (' ' if res and res[-1] != ' ' else '') + '“'
        elif sy in '”》）': res += sy
        elif sy in '《（—': res += (' ' if res else '') + sy
        else:
            sp = res and res[-1] not in '“《（ '
            res += (' ' if sp else '') + sy
    # пробел после двоеточия перед кавычкой уже есть; заглавные в начале фраз и реплик
    res = re.sub(r'(^|[.!?]”?\s+|“)([a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])', lambda m: m.group(1) + m.group(2).upper(), res)
    if re.match(r'^(小花|小明)：', text): res = re.sub(r'^(\S+ \S+): (\S)', lambda m: m.group(1) + ': ' + m.group(2).upper(), res)
    return res

texts, cur, para = [], None, []
def flush_para():
    global para
    if cur is not None and para: cur['paras'].append(para)
    para = []
for l in open(os.path.join(ROOT, 'tools/content/texts.txt'), encoding='utf-8'):
    l = l.rstrip('\n')
    if l.startswith('#') : continue
    if l.startswith('==='):
        flush_para()
        a = [x.strip() for x in l[3:].split('|')]
        cur = {'id': a[0], 'lvl': int(a[1]), 'topic': a[2], 'zh': a[3], 'ru': a[4], 'paras': [], 'qs': []}
        cur['py'] = syl(a[3]); texts.append(cur); continue
    if cur is None: continue
    if l.startswith('?'):
        flush_para()
        q = [x.strip() for x in l[1:].split('|')]
        assert len(q) == 5, l
        cur['qs'].append(q); continue
    if not l.strip(): flush_para(); continue
    zh, ru = l.split('\t')
    para.append([zh, syl(zh), ru])
flush_para()
if '--show' in sys.argv:
    for t in texts:
        print('==', t['id'], t['zh'], t['py'])
        for p in t['paras']:
            for z, py, r in p: print('  ', z, '\n     ', py)
# проверки
for t in texts:
    assert 3 <= len(t['qs']) <= 4, t['id']
    for z, py, r in [s for p in t['paras'] for s in p]:
        han = len([c for c in z if '一' <= c <= '鿿'])
        n = len(re.findall(r'[a-zA-Züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+', py))
        assert han == n, (t['id'], z, py)
js = '/* Тексты для чтения (HSK 3.0, уровни 1–3). Сгенерировано tools/build_texts.py из tools/content/texts.txt. */\nHZ.addTexts(' + json.dumps(texts, ensure_ascii=False, indent=1) + ');\n'
open(os.path.join(ROOT, 'js/data/texts.js'), 'w', encoding='utf-8').write(js)
print(len(texts), 'texts', sum(len(p) for t in texts for p in t['paras']), 'paragraphs', len(js) // 1024, 'KB')
