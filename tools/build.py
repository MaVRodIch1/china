#!/usr/bin/env python3
"""Шаг 2: собирает js/data/hsk3-chars.js (иероглифы) и js/data/hsk-words.js (слова) из tools/cache/draft.json
и русских текстов tools/content/*. Также обновляет уровни HSK в js/data/hsk-starter.js."""
import json, re, os, sys, glob
sys.path.insert(0, os.path.dirname(__file__))
from ids import components
from pypinyin import pinyin, Style
ROOT = os.path.join(os.path.dirname(__file__), '..')
d = json.load(open(os.path.join(ROOT, 'tools/cache/draft.json'), encoding='utf-8'))
W, CH = d['words'], d['chars']
starter_path = os.path.join(ROOT, 'js/data/hsk-starter.js')
starter = open(starter_path, encoding='utf-8').read()
have = re.findall(r"^    \['(.)'", starter, re.M)

def tsv(path):
    m = {}
    for l in open(path, encoding='utf-8'):
        a = l.rstrip('\n').split('\t')
        if len(a) >= 2: m[a[0]] = a[1]
    return m
ru_words = tsv(os.path.join(ROOT, 'tools/content/ru_words.tsv'))
gl = tsv(os.path.join(ROOT, 'tools/content/ru_glyphs.tsv'))
for k, v in re.findall(r"'(.)': '([^']+)'", starter.split('rows:')[0]): gl.setdefault(k, v)

RADNORM = {'⺼': '月', '⺮': '竹', '⺀': '冫', '⺌': '小', '⺈': '刀', '氺': '水', '飞': '飞'}
rows_ru = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'tools/content/ru_chars_*.txt'))):
    for l in open(f, encoding='utf-8'):
        a = l.rstrip('\n').split('|')
        if len(a) == 7: rows_ru[a[0]] = a

# ---- пиньинь предложений ----
def syl(text):
    out = []
    for item in pinyin(text, style=Style.TONE, errors=lambda x: list(x)):
        out.append(item[0])
    # тональные изменения 不 / 一
    ch = list(text)
    def tone(s):
        for t, m in enumerate(['āēīōūǖ', 'áéíóúǘ', 'ǎěǐǒǔǚ', 'àèìòùǜ'], 1):
            if any(c in s for c in m): return t
        return 5
    for i, c in enumerate(ch[:-1]):
        nxt = tone(out[i + 1]) if i + 1 < len(out) else 5
        if c == '不' and out[i] == 'bù' and nxt == 4: out[i] = 'bú'
        if c == '一' and out[i] == 'yī' and nxt:
            if nxt == 4 or nxt == 5 and False: out[i] = 'yí'
            elif nxt in (1, 2, 3): out[i] = 'yì'
    res = ''
    for s in out:
        if s in '，。！？、；：…': res += {'，': ',', '。': '.', '！': '!', '？': '?', '、': ',', '；': ';', '：': ':', '…': '…'}[s]
        else: res += (' ' if res else '') + s
    return res[0].upper() + res[1:] if res else res

def py_glyph(g):
    return ' '.join(x[0] for x in pinyin(g, style=Style.TONE)) if all('一' <= c <= '鿿' for c in g) else ''

def comps_str(c):
    e = CH[c]; ety = e.get('ety') or {}
    out = []
    for x in components(e['dec']):
        if x == c: continue
        ph = ety.get('phonetic') == x
        t = gl.get(x, '')
        if ph:
            p = py_glyph(x)
            t = (f"{p} — звук" if p else 'звук')
        elif not t:
            t = py_glyph(x)
        out.append(f"{x}={t}{'~' if ph else ''}")
    return ';'.join(out)

# ---- слова ----
words_by_char = {}
for w in W:
    for c in dict.fromkeys(w['w']):
        words_by_char.setdefault(c, []).append(w)
def words_str(c):
    ws = [w for w in words_by_char.get(c, []) if len(w['w']) > 1]
    ws.sort(key=lambda w: (w['lv'], w['fr']))
    return ';'.join(f"{w['w']}|{w['py']}|{ru_words[w['w']]}" for w in ws[:3])

# ---- новые иероглифы ----
new = sorted([c for c in CH if c not in have], key=lambda c: (CH[c]['lv'], CH[c]['fr']))
PYFIX = {'得': 'de', '着': 'zhe', '长': 'cháng', '便': 'biàn', '地': 'dì', '了': 'le'}
rads_used = {}
out_rows = []
for c in new:
    e = CH[c]; r = rows_ru[c]
    rad = RADNORM.get(e['rad'], e['rad'])
    rads_used[rad] = gl.get(rad, '')
    py = PYFIX.get(c, e['py'])
    sent = f"{r[5]}|{syl(r[5])}|{r[6]}" if r[5] else ''
    out_rows.append([c, py, r[1], e['strokes'], rad, e['lv'], r[2], comps_str(c), r[3], r[4], words_str(c), sent])
def q(s): return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"
lines = []
for r in out_rows:
    lines.append('    [' + ','.join([q(r[0]), q(r[1]), q(r[2]), str(r[3]), q(r[4]), str(r[5]), q(r[6]), q(r[7]), q(r[8]), q(r[9]), q(r[10]), q(r[11])]) + ']')
rad_js = ','.join(f"{q(k)}:{q(v)}" for k, v in rads_used.items() if v)
open(os.path.join(ROOT, 'js/data/hsk3-chars.js'), 'w', encoding='utf-8').write(
    "/* Иероглифы HSK 1–3 (стандарт HSK 2.0), добавленные к стартовому набору. Сгенерировано tools/build.py.\n"
    " * Источники: complete-hsk-vocabulary (уровни слов), Make Me a Hanzi (черты, разложение, роль компонентов); русские тексты — tools/content. */\n"
    "HZ.addPack({\n  id: 'hsk3',\n  name: 'HSK 1–3',\n  radicals: {" + rad_js + "},\n  rows: [\n" + ',\n'.join(lines) + "\n  ]\n});\n")

# ---- файл слов ----
wl = []
for w in W:
    wl.append('  [' + ','.join([q(w['w']), q(w['py']), q(ru_words[w['w']]), str(w['lv']), q(','.join(w['pos'][:2]))]) + ']')
open(os.path.join(ROOT, 'js/data/hsk-words.js'), 'w', encoding='utf-8').write(
    "/* Слова HSK 1–3 (HSK 2.0, 595 слов). Формат: [слово, пиньинь, перевод, уровень, части речи]. Сгенерировано tools/build.py. */\n"
    "HZ.addWords([\n" + ',\n'.join(wl) + "\n]);\n")

# ---- уровни стартовых иероглифов по данным ----
def fix(m):
    c = m.group(1)
    lv = CH[c]['lv'] if c in CH else 4
    return m.group(0)[:m.start(2) - m.start(0)] + str(lv) + m.group(0)[m.end(2) - m.start(0):]
pat = re.compile(r"^    \['(.)','[^']*','[^']*',\d+,'[^']*',(\d+),", re.M)
starter2 = pat.sub(fix, starter)
open(starter_path, 'w', encoding='utf-8').write(starter2)
print(len(out_rows), 'новых иероглифов;', len(W), 'слов;', sum(1 for r in out_rows if not r[10]), 'без слов;', sum(1 for r in out_rows if not r[7]), 'без компонентов')
print('радикалы без названия:', [k for k, v in rads_used.items() if not v])
