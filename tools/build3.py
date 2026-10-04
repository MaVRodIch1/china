#!/usr/bin/env python3
"""Сборка данных HSK 3.0 (уровни 1–5): js/data/hsk3-chars.js, js/data/hsk-words.js, обновление уровней в hsk-starter.js.
Вход: tools/cache/draft3.json (HSK 3.0), tools/cache/draft.json (старый список — только для уже существующих иероглифов),
русские тексты в tools/content/. Запуск: HSK_STD=new python3 tools/prep.py && HSK_STD=old python3 tools/prep.py && python3 tools/build3.py"""
import json, re, os, sys, glob
sys.path.insert(0, os.path.dirname(__file__))
from ids import components
from pypinyin import pinyin, Style
ROOT = os.path.join(os.path.dirname(__file__), '..')
P = lambda *a: os.path.join(ROOT, *a)
D3 = json.load(open(P('tools/cache/draft3.json'), encoding='utf-8'))
D2 = json.load(open(P('tools/cache/draft.json'), encoding='utf-8'))
starter_path = P('js/data/hsk-starter.js')
starter = open(starter_path, encoding='utf-8').read()
starter_chars = re.findall(r"^    \['(.)'", starter, re.M)

def tsv(path):
    m = {}
    for l in open(path, encoding='utf-8'):
        a = l.rstrip('\n').split('\t')
        if len(a) >= 2: m[a[0]] = a[1]
    return m
ru_words = {}
for f in [P('tools/content/ru_words.tsv')] + sorted(glob.glob(P('tools/content/ru_words_*.tsv'))):
    ru_words.update(tsv(f))
sents = {}
for f in sorted(glob.glob(P('tools/content/sent_*.tsv'))):
    for l in open(f, encoding='utf-8'):
        a = l.rstrip('\n').split('\t')
        if len(a) == 3: sents[a[0]] = (a[1], a[2])
# вторые примеры (для слов HSK 1–3)
sents2 = {}
for f in sorted(glob.glob(P('tools/content/sent2_*.tsv'))):
    for l in open(f, encoding='utf-8'):
        a = l.rstrip('\n').split('\t')
        if len(a) == 3: sents2[a[0]] = (a[1], a[2])
gl = tsv(P('tools/content/ru_glyphs.tsv'))
for k, v in re.findall(r"'(.)': '([^']+)'", starter.split('rows:')[0]): gl.setdefault(k, v)

def load_rows(pattern):
    out = {}
    for f in sorted(glob.glob(P(pattern))):
        for l in open(f, encoding='utf-8'):
            a = l.rstrip('\n').split('|')
            if len(a) == 7: out[a[0]] = a
    return out
rows_old = load_rows('tools/content/ru_chars_*.txt')   # 492 иероглифа первой версии
rows_new = load_rows('tools/content/ru3_chars_*.txt')  # 324 новых (HSK 3.0, уровни 1–3)
rows_new.update(load_rows('tools/content/ru4_chars_*.txt'))  # 269 новых (HSK 3.0, уровень 4)
rows_new.update(load_rows('tools/content/ru5_chars_*.txt'))  # 289 новых (HSK 3.0, уровень 5)

PUNCT = {'，': ',', '。': '.', '！': '!', '？': '?', '、': ',', '；': ';', '：': ':', '…': '…'}
def tone(s):
    for t, m in enumerate(['āēīōūǖ', 'áéíóúǘ', 'ǎěǐǒǔǚ', 'àèìòùǜ'], 1):
        if any(c in s for c in m): return t
    return 5
def syl(text):
    out = [item[0] for item in pinyin(text, style=Style.TONE, errors=lambda x: list(x))]
    for i, c in enumerate(text[:-1]):
        nxt = tone(out[i + 1]) if i + 1 < len(out) else 5
        if c == '不' and out[i] == 'bù' and nxt == 4: out[i] = 'bú'
        if c == '一' and out[i] == 'yī':
            if nxt == 4: out[i] = 'yí'
            elif nxt in (1, 2, 3): out[i] = 'yì'
    for m in re.finditer(r'中国|北京|汉语|中文|英语|英文|上海|四川|日本|长城|联合国|中华民族|[李王林][先太主老经]|老[李王]|大卫|安娜|小明', text):
        out[m.start()] = out[m.start()][0].upper() + out[m.start()][1:]
    res = ''
    for s in out:
        if s in PUNCT: res += PUNCT[s]
        elif s in '“”《》（）—': res += s
        else: res += (' ' if res and res[-1] not in '“《（' else '') + s
    return res[0].upper() + res[1:] if res else res
def py_glyph(g):
    return ' '.join(x[0] for x in pinyin(g, style=Style.TONE)) if all('一' <= c <= '鿿' for c in g) else ''

# ---------- слова ----------
words = sorted(D3['words'], key=lambda w: (w['lv'], w['fr']))
words_by_char = {}
for src in (D3['words'], D2['words']):
    for w in src:
        for c in dict.fromkeys(w['w']):
            words_by_char.setdefault(c, {})[w['w']] = w
def words_str(c):
    ws = [w for w in words_by_char.get(c, {}).values() if len(w['w']) > 1 and w['w'] in ru_words]
    # приоритет: слова HSK 3.0, затем по уровню и частоте
    ws.sort(key=lambda w: (w['w'] not in {x['w'] for x in D3['words']}, w['lv'], w['fr']))
    return ';'.join(f"{w['w']}|{w['py']}|{ru_words[w['w']].split(';')[0].strip()}" for w in ws[:3])

# ---------- иероглифы ----------
RADNORM = {'⺼': '月', '⺮': '竹', '⺀': '冫', '⺌': '小', '⺈': '刀', '氺': '水'}
lvl3 = {c: e['lv'] for c, e in D3['chars'].items()}
PYFIX = {'得': 'de', '着': 'zhe', '长': 'cháng', '便': 'biàn', '地': 'dì', '了': 'le', '还': 'hái', '思': 'sī', '宜': 'yí', '切': 'qiē'}
def comps_str(c, e):
    ety = e.get('ety') or {}
    out = []
    for x in components(e['dec']):
        if x == c: continue
        ph = ety.get('phonetic') == x
        t = gl.get(x, '')
        if ph:
            p = py_glyph(x); t = f"{p} — звук" if p else 'звук'
        elif not t: t = py_glyph(x)
        out.append(f"{x}={t}{'~' if ph else ''}")
    return ';'.join(out)
def q(s): return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'") + "'"

allchars = {}
for c, r in rows_old.items(): allchars[c] = (D2['chars'].get(c) or D3['chars'][c], r)
for c, r in rows_new.items(): allchars[c] = (D3['chars'][c], r)
OUT = max(lvl3.values()) + 1  # уровень «вне списка HSK 3.0»
def lv_of(c): return lvl3.get(c, OUT)
order = sorted(allchars, key=lambda c: (lv_of(c), (D3['chars'].get(c) or D2['chars'][c])['fr']))
rad_used = {}; lines = []
for c in order:
    e, r = allchars[c]
    rad = RADNORM.get(e['rad'], e['rad']); rad_used[rad] = gl.get(rad, '')
    py = PYFIX.get(c, e['py'])
    sent = f"{r[5]}|{syl(r[5])}|{r[6]}" if r[5] else ''
    lines.append('    [' + ','.join([q(c), q(py), q(r[1]), str(e['strokes']), q(rad), str(lv_of(c)), q(r[2]), q(comps_str(c, e)), q(r[3]), q(r[4]), q(words_str(c)), q(sent)]) + ']')
rad_js = ','.join(f"{q(k)}:{q(v)}" for k, v in rad_used.items() if v)
open(P('js/data/hsk3-chars.js'), 'w', encoding='utf-8').write(
    f"/* Иероглифы HSK 3.0 (уровни 1–{OUT - 1}), добавленные к стартовому набору. Сгенерировано tools/build3.py.\n"
    f" * Уровни — по первому слову HSK 3.0 с иероглифом; {OUT} — вне списка. Источники: complete-hsk-vocabulary, Make Me a Hanzi; русские тексты — tools/content. */\n"
    "HZ.addPack({\n  id: 'hsk3',\n  name: 'HSK 3.0',\n  radicals: {" + rad_js + "},\n  rows: [\n" + ',\n'.join(lines) + "\n  ]\n});\n")

# ---------- слова ----------
wl = []
for w in words:
    z, r = sents[w['w']]
    sent = f"{z}|{syl(z)}|{r}"
    if w['w'] in sents2: z2, r2 = sents2[w['w']]; sent += f"¶{z2}|{syl(z2)}|{r2}"  # ¶ разделяет примеры
    wl.append('  [' + ','.join([q(w['w']), q(w['py']), q(ru_words[w['w']]), str(w['lv']), q(','.join(w['pos'][:2])), q(sent)]) + ']')
open(P('js/data/hsk-words.js'), 'w', encoding='utf-8').write(
    f"/* Слова HSK 3.0, уровни 1–{OUT - 1} ({len(words)} слов). Формат: [слово, пиньинь, перевод, уровень, части речи, примеры «иероглифы|пиньинь|перевод» через ¶]. Сгенерировано tools/build3.py. */\n"
    "HZ.addWords([\n" + ',\n'.join(wl) + "\n]);\n")

# ---------- уровни стартовых иероглифов ----------
pat = re.compile(r"^(    \['(.)','[^']*','[^']*',\d+,'[^']*',)(\d+),", re.M)
starter2 = pat.sub(lambda m: f"{m.group(1)}{lv_of(m.group(2))},", starter)
open(starter_path, 'w', encoding='utf-8').write(starter2)
print(len(order), 'иероглифов в hsk3-chars;', len(words), 'слов;', sum(1 for c in order if not words_str(c)), 'иероглифов без слов')
print('уровни:', {l: sum(1 for c in starter_chars + order if lv_of(c) == l) for l in range(1, OUT + 1)})
