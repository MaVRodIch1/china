/* Подборки: встроенные (HSK, темы, черты, ключи, похожие, частотные), умные (динамические) и пользовательские. */
(function () {
  'use strict';
  const HZ = window.HZ, store = HZ.store;

  // Часто используемые иероглифы (порядок приблизительно по частоте в текстах)
  const FREQ = '的一是不了在人有我他这们中来上大和国地说时出就会也你对生能子那下年后作家去学都同多好看想';
  // Похожие по написанию — группы для тренировки различения
  const SIMILAR = [
    { name: '买 · 卖', chars: '买卖' },
    { name: '木 · 林 · 本 · 休 · 体', chars: '木林本休体' },
    { name: '你 · 他 · 她 · 们', chars: '你他她们' },
    { name: '日 · 目 · 月 · 明', chars: '日目月明' },
    { name: '人 · 大 · 太 · 天', chars: '人大太天' },
    { name: '小 · 少', chars: '小少' },
    { name: '口 · 吃 · 喝 · 叫 · 听', chars: '口吃喝叫听' },
    { name: '说 · 话 · 读', chars: '说话读' },
    { name: '东 · 西 · 南 · 北', chars: '东西南北' },
    { name: '开 · 关 · 门', chars: '开关门' }
  ];
  const THEME_ICO = { food: '🍜', travel: '✈️', work: '💼', family: '👨‍👩‍👧', emotion: '💗', daily: '☀️', nature: '🌿', body: '🖐️', number: '🔢', color: '🎨', animal: '🐾' };

  const inData = arr => arr.filter(ch => HZ.byChar[ch]);

  function builtin() {
    const out = [], all = HZ.chars;
    // HSK
    [[1, 'HSK 1', 'Базовый уровень: самые нужные иероглифы'], [2, 'HSK 2', 'Элементарный уровень'], [3, 'HSK 3', 'Средний уровень'], [4, 'HSK 4', 'Средне-продвинутый уровень'], [5, 'HSK 5', 'Продвинутый уровень'], [6, 'Вне HSK 3.0 (1–5)', 'Знаки вне списка уровней 1–5: базовые элементы и иероглифы из прежнего набора']].forEach(([lv, name, desc]) => {
      const cs = all.filter(c => c.h === lv).map(c => c.ch);
      if (cs.length) out.push({ id: 'hsk' + lv, name, desc: desc + ' (стандарт HSK 3.0)', group: 'HSK', ico: '🏮', chars: cs });
    });
    // Темы
    Object.keys(HZ.themes).forEach(t => {
      const cs = all.filter(c => c.th.includes(t)).map(c => c.ch);
      if (cs.length) out.push({ id: 'theme-' + t, name: HZ.themes[t], desc: 'Тематическая подборка', group: 'Темы', ico: THEME_ICO[t] || '📌', chars: cs });
    });
    // Частотные
    const f = inData([...FREQ]);
    if (f.length) {
      out.push({ id: 'freq-20', name: 'Топ-20 самых частотных', desc: 'Основа любого текста', group: 'Частотные', ico: '📈', chars: f.slice(0, 20) });
      out.push({ id: 'freq-all', name: 'Частотные знаки', desc: 'Самые употребительные иероглифы набора', group: 'Частотные', ico: '📈', chars: f });
    }
    // Черты
    [[1, 4, '1–4 черты'], [5, 7, '5–7 черт'], [8, 10, '8–10 черт'], [11, 99, '11 и более черт']].forEach(([a, b, name]) => {
      const cs = all.filter(c => c.s >= a && c.s <= b).sort((x, y) => x.s - y.s).map(c => c.ch);
      if (cs.length) out.push({ id: `str-${a}`, name, desc: 'По сложности написания', group: 'Количество черт', ico: '✒️', chars: cs });
    });
    // Ключи (≥3 иероглифа с одним ключом)
    const byRad = {};
    all.forEach(c => (byRad[c.r] = byRad[c.r] || []).push(c.ch));
    Object.keys(byRad).filter(r => byRad[r].length >= 6).sort((a, b) => byRad[b].length - byRad[a].length).forEach(r =>
      out.push({ id: 'rad-' + r, name: `Ключ ${r} — ${HZ.radicals[r] || ''}`.trim(), desc: 'Иероглифы с одним ключом', group: 'Ключи', ico: '🔑', chars: byRad[r] }));
    // Похожие
    SIMILAR.forEach((g, i) => {
      const cs = inData([...g.chars]);
      if (cs.length >= 2) out.push({ id: 'sim-' + i, name: g.name, desc: 'Похожее написание — учимся различать', group: 'Похожие', ico: '👀', chars: cs });
    });
    return out;
  }

  function smart() {
    const hard = HZ.srs.hardList();
    const out = [{ id: 'smart-hard', name: 'Мои сложные', desc: 'Автоматически: иероглифы, которые вы чаще всего забываете', group: 'Умные', ico: '🧩', chars: hard, dynamic: true }];
    const due = HZ.srs.dueList();
    out.push({ id: 'smart-due', name: 'К повторению сегодня', desc: 'Автоматически: пора повторить', group: 'Умные', ico: '⏰', chars: due, dynamic: true });
    // слабые тоны
    const toneAcc = weakTones();
    if (toneAcc.length) {
      const w = toneAcc[0];
      out.push({ id: 'smart-tone', name: `Слабый тон: ${w.tone}-й`, desc: `Автоматически: точность ${Math.round(w.acc * 100)}%`, group: 'Умные', ico: '🎵', chars: HZ.chars.filter(c => c.tone === w.tone && HZ.srs.get(c.ch)).map(c => c.ch), dynamic: true });
    }
    const wr = weakRadicals();
    if (wr.length) out.push({ id: 'smart-rad', name: `Слабый ключ: ${wr[0].r}`, desc: `Автоматически: точность ${Math.round(wr[0].acc * 100)}%`, group: 'Умные', ico: '🔍', chars: HZ.chars.filter(c => c.r === wr[0].r && HZ.srs.get(c.ch)).map(c => c.ch), dynamic: true });
    return out;
  }

  /** Точность по тонам (минимум 6 ответов на тон) */
  function weakTones() {
    const st = {};
    HZ.chars.forEach(c => { const k = HZ.srs.get(c.ch); if (!k) return; const s = st[c.tone] = st[c.tone] || { ok: 0, bad: 0 }; s.ok += k.ok; s.bad += k.bad; });
    return Object.keys(st).filter(t => t < 5 && st[t].ok + st[t].bad >= 6).map(t => ({ tone: +t, acc: st[t].ok / (st[t].ok + st[t].bad), n: st[t].ok + st[t].bad }))
      .filter(x => x.acc < 0.8).sort((a, b) => a.acc - b.acc);
  }
  /** Точность по ключам (минимум 6 ответов) */
  function weakRadicals() {
    const st = {};
    HZ.chars.forEach(c => { const k = HZ.srs.get(c.ch); if (!k) return; const s = st[c.r] = st[c.r] || { ok: 0, bad: 0 }; s.ok += k.ok; s.bad += k.bad; });
    return Object.keys(st).filter(r => st[r].ok + st[r].bad >= 6).map(r => ({ r, acc: st[r].ok / (st[r].ok + st[r].bad), n: st[r].ok + st[r].bad }))
      .filter(x => x.acc < 0.75).sort((a, b) => a.acc - b.acc);
  }

  function user() {
    return store.s.collections.map(c => ({ id: c.id, name: c.name, desc: 'Моя подборка', group: 'Мои подборки', ico: '⭐', chars: c.chars.filter(ch => HZ.byChar[ch]), words: (c.words || []).filter(k => HZ.wordByKey[k]), user: true }));
  }

  /* ---------- Свои слова и примеры ---------- */
  /** Регистрирует свои слова (которых нет в базе) как обычные слова и прикрепляет свои примеры. Идемпотентно. */
  function applyMyWords() {
    const mw = store.s.myWords || (store.s.myWords = {});
    Object.keys(mw).forEach(k => {
      const d = mw[k]; if (!d || !d.w) return;
      let e = HZ.wordByKey[k];
      if (!e && d.custom) { HZ.addWords([[d.w, d.py || '', d.m || '', 0, '']]); e = HZ.wordByKey[k]; e.custom = true; }
      if (!e) return;
      if (e.custom) { e.py = d.py || ''; e.m = d.m || ''; e.tone = HZ.firstTone(e.py); }
      e.my = (d.ex || []).filter(x => x && x.z);
    });
    if (HZ.sentences && HZ.sentences.reset) HZ.sentences.reset();
  }
  const myWord = k => store.s.myWords[k] || (store.s.myWords[k] = { w: k.slice(2), ex: [], t: Date.now() });
  /** Своё слово: w — китайский текст, py — пиньинь (можно цифрами), m — перевод. Возвращает ключ 'w:…'. */
  function saveWord(w, py, m) {
    const k = 'w:' + w.trim();
    const d = myWord(k);
    if (!HZ.wordByKey[k] || HZ.wordByKey[k].custom) Object.assign(d, { custom: true, py: HZ.pyNum(py || '').trim(), m: (m || '').trim() });
    d.t = Date.now(); store.save(); applyMyWords();
    return k;
  }
  function deleteWord(k) {
    const e = HZ.wordByKey[k];
    if (e && e.custom) { HZ.words.splice(HZ.words.indexOf(e), 1); delete HZ.wordByKey[k]; }
    delete store.s.myWords[k];
    store.s.collections.forEach(c => { if (c.words) c.words = c.words.filter(x => x !== k); });
    store.save(); applyMyWords();
  }
  function addExample(k, z, p, m) {
    const d = myWord(k);
    d.ex = d.ex || [];
    d.ex.push({ id: Date.now().toString(36) + HZ.rand(1e4).toString(36), z: z.trim(), p: HZ.pyNum(p || '').trim(), m: (m || '').trim() });
    d.t = Date.now(); store.save(); applyMyWords();
  }
  function removeExample(k, id) {
    const d = store.s.myWords[k]; if (!d) return;
    d.ex = (d.ex || []).filter(x => x.id !== id); d.t = Date.now(); store.save(); applyMyWords();
  }
  function addWordsTo(id, keys) { const c = raw(id); if (!c) return; c.words = c.words || []; keys.forEach(k => { if (HZ.wordByKey[k] && !c.words.includes(k)) c.words.push(k); }); store.save(); }
  function removeWordFrom(id, k) { const c = raw(id); if (c) { c.words = (c.words || []).filter(x => x !== k); store.save(); } }

  function all() {
    const ext = [];
    HZ.collectionProviders.forEach(fn => ext.push(...fn()));
    return [...user(), ...smart(), ...builtin(), ...ext];
  }
  function get(id) { return all().find(c => c.id === id); }

  /* ---------- Управление пользовательскими ---------- */
  const uid = () => 'u' + Date.now().toString(36) + HZ.rand(1e4).toString(36);
  function create(name, chars = [], words = []) {
    const c = { id: uid(), name, chars: [...new Set(chars)], words: [...new Set(words)] };
    store.s.collections.push(c); store.save();
    HZ.gami.check();
    return c;
  }
  const raw = id => store.s.collections.find(c => c.id === id);
  function rename(id, name) { const c = raw(id); if (c) { c.name = name; store.save(); } }
  function remove(id) { store.s.collections = store.s.collections.filter(c => c.id !== id); if (store.s.settings.newSource === id) store.s.settings.newSource = 'all'; store.save(); }
  function addChars(id, chars) { const c = raw(id); if (!c) return; chars.forEach(ch => { if (!c.chars.includes(ch) && HZ.byChar[ch]) c.chars.push(ch); }); store.save(); }
  function removeChar(id, ch) { const c = raw(id); if (c) { c.chars = c.chars.filter(x => x !== ch); store.save(); } }
  function merge(ids, name) {
    const set = [], ws = [];
    ids.forEach(id => { const c = get(id); if (c) { c.chars.forEach(ch => { if (!set.includes(ch)) set.push(ch); }); (c.words || []).forEach(k => { if (!ws.includes(k)) ws.push(k); }); } });
    return create(name, set, ws);
  }

  HZ.getCollection = get;
  HZ.collections = { all, get, create, rename, remove, addChars, removeChar, merge, weakTones, weakRadicals, raw, addWords: addWordsTo, removeWord: removeWordFrom, saveWord, deleteWord, addExample, removeExample, applyMyWords };
  HZ.applyMyWords = applyMyWords;
  applyMyWords();
})();
