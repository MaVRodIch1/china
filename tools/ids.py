"""Разбор IDS-разложения Make Me a Hanzi на компоненты."""
ARITY = {'⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2, '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2}
def parse(s, i=0):
    c = s[i]
    if c in ARITY:
        kids = []; i += 1
        for _ in range(ARITY[c]):
            k, i = parse(s, i); kids.append(k)
        return (c, kids), i
    return c, i + 1
def leaves(t):
    if isinstance(t, str): return [t]
    return [x for k in t[1] for x in leaves(k)]
def components(dec):
    if not dec or dec == '？': return []
    t, _ = parse(dec)
    if isinstance(t, str): return []
    L = [x for x in leaves(t) if x != '？']
    return L if len(L) <= 4 else [''.join(leaves(k)) if not isinstance(k, str) else k for k in t[1]]
