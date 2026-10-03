#!/usr/bin/env python3
"""Проверка пакетов контента HSK 4.
  python3 tools/check_batch.py words <вход words_N.tsv> <ru_words_4NN.tsv> <sent_4NN.tsv>
  python3 tools/check_batch.py chars <вход chars_N.tsv> <ru4_chars_0N.txt>
Проверяет: всё ли покрыто, формат, кириллица в переводах, предложение содержит слово/иероглиф,
все иероглифы предложения — из HSK 3.0 уровней 1–4 (tools/cache/allowed_l4.txt)."""
import sys, re, os
ROOT = os.path.join(os.path.dirname(__file__), '..')
allowed = set(open(os.path.join(ROOT, 'tools/cache/allowed_l4.txt'), encoding='utf-8').read())
han = lambda c: '一' <= c <= '鿿'
CYR = re.compile('[а-яё]', re.I)
THEMES = {'', 'food', 'travel', 'work', 'family', 'emotion', 'daily', 'nature', 'body', 'number', 'color', 'animal'}
def inp(p): return [l.rstrip('\n').split('\t') for l in open(p, encoding='utf-8') if l.strip() and not l.startswith('#')]
probs = []
def sent_ok(where, key, z, ru):
    if not z: probs.append(f'{where}: «{key}» — нет предложения'); return
    bad = sorted({c for c in z if han(c) and c not in allowed})
    if bad: probs.append(f'{where}: «{key}» — знаки вне HSK 1–4: {"".join(bad)} — {z}')
    if key not in z: probs.append(f'{where}: «{key}» — предложение не содержит его: {z}')
    if not re.search('[。！？!?…”]$', z): probs.append(f'{where}: «{key}» — предложение без конечного знака: {z}')
    if not CYR.search(ru or ''): probs.append(f'{where}: «{key}» — нет русского перевода предложения')
    if len([c for c in z if han(c)]) > 22: probs.append(f'{where}: «{key}» — слишком длинное предложение ({z})')
mode = sys.argv[1]
if mode == 'words':
    items = [r[0] for r in inp(sys.argv[2])]
    ru = {}; sents = {}
    for i, l in enumerate(open(sys.argv[3], encoding='utf-8'), 1):
        a = l.rstrip('\n').split('\t')
        if len(a) != 2: probs.append(f'ru строка {i}: нужно 2 колонки — {l.strip()}'); continue
        ru[a[0]] = a[1]
        if not CYR.search(a[1]) and not a[1].startswith('('): probs.append(f'ru строка {i}: «{a[0]}» — перевод без кириллицы')
    for i, l in enumerate(open(sys.argv[4], encoding='utf-8'), 1):
        a = l.rstrip('\n').split('\t')
        if len(a) != 3: probs.append(f'sent строка {i}: нужно 3 колонки — {l.strip()}'); continue
        sents[a[0]] = (a[1], a[2]); sent_ok(f'sent строка {i}', a[0], a[1], a[2])
    for w in items:
        if w not in ru: probs.append(f'нет перевода для «{w}»')
        if w not in sents: probs.append(f'нет предложения для «{w}»')
    extra = [w for w in list(ru) + list(sents) if w not in items]
    if extra: probs.append('лишние записи: ' + ' '.join(sorted(set(extra))))
elif mode == 'chars':
    items = [r[0] for r in inp(sys.argv[2])]
    got = {}
    for i, l in enumerate(open(sys.argv[3], encoding='utf-8'), 1):
        a = l.rstrip('\n').split('|')
        if len(a) != 7: probs.append(f'строка {i}: нужно 7 полей через | — {l.strip()[:60]}'); continue
        c, m, th, mn, et, z, r = a
        got[c] = a
        if not CYR.search(m): probs.append(f'строка {i}: «{c}» — значение без кириллицы')
        if th not in THEMES: probs.append(f'строка {i}: «{c}» — неизвестная тема «{th}»')
        if len(mn) < 25 or not CYR.search(mn): probs.append(f'строка {i}: «{c}» — слишком короткая мнемоника')
        sent_ok(f'строка {i}', c, z, r)
    for c in items:
        if c not in got: probs.append(f'нет строки для «{c}»')
print('\n'.join(probs) if probs else 'OK')
print(f'проблем: {len(probs)}')
