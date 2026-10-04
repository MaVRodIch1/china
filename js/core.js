/* Ядро: глобальное пространство имён HZ, реестр наборов данных, утилиты. */
(function () {
  'use strict';
  const HZ = (window.HZ = window.HZ || {});

  HZ.chars = [];          // все иероглифы (в порядке изучения)
  HZ.byChar = {};         // иероглиф -> запись
  HZ.radicals = {};       // ключ -> название
  HZ.packs = [];          // зарегистрированные наборы иероглифов
  HZ.collectionProviders = []; // функции, возвращающие готовые подборки
  HZ.views = {};          // экраны
  HZ.themes = {
    food: 'Еда и напитки', travel: 'Путешествия', work: 'Работа и учёба', family: 'Семья и люди',
    emotion: 'Эмоции', daily: 'Повседневная жизнь', nature: 'Природа', body: 'Тело',
    number: 'Числа', color: 'Цвета', animal: 'Животные'
  };

  /* ---------- Регистрация данных ---------- */
  // Строка слов: "слово|пиньинь|перевод;слово|..."
  function parseWords(s) {
    return (s || '').split(';').filter(Boolean).map(x => {
      const [w, p, m] = x.split('|');
      return { w, p, m };
    });
  }
  // Компоненты: "глиф=пояснение;глиф=пояснение~" (~ в конце — фонетик)
  function parseComps(s) {
    return (s || '').split(';').filter(Boolean).map(x => {
      const i = x.indexOf('=');
      let t = x.slice(i + 1), ph = false;
      if (t.endsWith('~')) { ph = true; t = t.slice(0, -1); }
      return { g: x.slice(0, i), t, ph };
    });
  }

  /**
   * Добавить набор иероглифов. Формат строки:
   * [иероглиф, пиньинь, значение, черт, ключ, HSK, темы, компоненты, мнемоника, происхождение, слова, предложения]
   * Чтобы расширять приложение, подключите ещё один файл с HZ.addPack({...}).
   */
  HZ.addPack = function (pack) {
    HZ.packs.push({ id: pack.id, name: pack.name });
    if (pack.radicals) Object.assign(HZ.radicals, pack.radicals);
    pack.rows.forEach(r => {
      const [ch, py, m, s, rad, h, th, comps, mn, et, words, sents] = r;
      if (HZ.byChar[ch]) return;
      const e = {
        ch, py, m, s, r: rad, h, th: (th || '').split(' ').filter(Boolean),
        comps: parseComps(comps), mn: mn || '', et: et || '',
        words: parseWords(words),
        sents: (sents || '').split(';').filter(Boolean).map(x => { const [z, p, t] = x.split('|'); return { z, p, m: t }; }),
        pack: pack.id, idx: HZ.chars.length
      };
      e.tone = HZ.toneOf(py);
      HZ.chars.push(e);
      HZ.byChar[ch] = e;
    });
  };

  HZ.words = [];          // слова (HSK)
  HZ.wordByKey = {};      // 'w:слово' -> запись
  /** Добавить слова: [слово, пиньинь, перевод, уровень HSK, части речи]. Запись совместима с иероглифом (ch, py, m, h …). */
  // примеры и тон слова разбираются только при первом обращении — запуск быстрее
  const own = (o, k, v) => { Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: true }); return v; };
  const WORD = {
    get sents() { return own(this, 'sents', this._s ? this._s.split('¶').map(x => { const [z, p, t] = x.split('|'); return { z, p, m: t }; }) : []); },
    set sents(v) { own(this, 'sents', v); },
    get tone() { return own(this, 'tone', HZ.firstTone(this.py)); },
    set tone(v) { own(this, 'tone', v); }
  };
  HZ.addWords = function (list) {
    list.forEach(([w, py, m, h, pos, sent, mn]) => {
      const key = 'w:' + w;
      if (HZ.wordByKey[key]) return;
      const e = Object.create(WORD);
      Object.assign(e, { ch: w, key, py, m, h, pos: pos ? pos.split(',') : [], s: [...w].length, r: '', th: [], comps: [], mn: mn || '', et: '', words: [], _s: sent || '',
        isWord: true, chars: [...w].filter(c => c >= '\u4e00' && c <= '\u9fff'), idx: HZ.words.length });
      HZ.words.push(e); HZ.wordByKey[key] = e;
    });
  };
  HZ.texts = [];          // тексты для чтения
  HZ.addTexts = list => list.forEach(t => HZ.texts.push(t));
  HZ.textById = id => HZ.texts.find(t => t.id === id);
  HZ.isKey = k => typeof k === 'string' && k.startsWith('w:');
  /** Запись по ключу SRS: иероглиф или слово */
  HZ.entry = k => HZ.isKey(k) ? HZ.wordByKey[k] : HZ.byChar[k];

  /** Добавить провайдер подборок: fn() -> [{id,name,desc,group,chars}] */
  HZ.addCollectionProvider = fn => HZ.collectionProviders.push(fn);

  /* ---------- Пиньинь и тоны ---------- */
  const TONE_MAP = { 1: 'āēīōūǖ', 2: 'áéíóúǘ', 3: 'ǎěǐǒǔǚ', 4: 'àèìòùǜ' };
  HZ.toneOf = function (syl) {
    for (const t of [1, 2, 3, 4]) for (const c of TONE_MAP[t]) if (syl.includes(c)) return t;
    return 5;
  };
  // Тон первого слога строки (для статистики)
  HZ.firstTone = py => HZ.toneOf((py || '').split(/\s+/)[0]);
  // Без диакритики (для подбора отвлекающих вариантов)
  HZ.baseSyl = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- Ввод пиньиня ---------- */
  const MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
  function markSyl(syl, t) {
    if (t === 5 || t === 0) return syl;
    const low = syl.toLowerCase();
    let idx = low.search(/[ae]/);
    if (idx < 0) idx = low.indexOf('ou');
    if (idx < 0) for (let i = low.length - 1; i >= 0; i--) if ('aeiouü'.includes(low[i])) { idx = i; break; }
    if (idx < 0) return syl;
    let ch = MARKS[low[idx]][t - 1];
    if (syl[idx] !== low[idx]) ch = ch.toUpperCase();
    return syl.slice(0, idx) + ch + syl.slice(idx + 1);
  }
  /** «ni3 hao3», «nv3», «lu:4» → «nǐ hǎo», «nǚ», «lǜ». Пиньинь со знаками тонов остаётся как есть. */
  HZ.pyNum = s => (s || '').replace(/([a-zA-ZüÜ:]+)([0-5])/g, (m, syl, t) => markSyl(syl.replace(/u:|v/g, 'ü').replace(/U:|V/g, 'Ü'), +t));
  const PY_PUNCT = { '，': ',', '。': '.', '！': '!', '？': '?', '、': ',', '；': ';', '：': ':', '“': '“', '”': '”', '…': '…' };
  /** Черновой пиньинь для китайского текста по словарю приложения (слова HSK, затем отдельные иероглифы).
   *  Неизвестные знаки помечаются «?» — их нужно дописать вручную. */
  HZ.autoPy = function (text) {
    const chars = [...(text || '')], out = [];
    const isHan = c => c >= '一' && c <= '鿿';
    let i = 0;
    while (i < chars.length) {
      const c = chars[i];
      if (!isHan(c)) {
        if (PY_PUNCT[c] && out.length) out[out.length - 1].s += PY_PUNCT[c];
        else if (/[A-Za-z0-9]/.test(c)) out.push({ s: c, c: null });
        i++; continue;
      }
      let run = 0; while (i + run < chars.length && isHan(chars[i + run]) && run < 4) run++;
      let done = false;
      for (let l = run; l >= 2 && !done; l--) {
        const e = HZ.wordByKey['w:' + chars.slice(i, i + l).join('')];
        const ps = e && e.py ? e.py.trim().split(/\s+/) : null;
        if (ps && ps.length === l) { ps.forEach((p, k) => out.push({ s: p, c: chars[i + k] })); i += l; done = true; }
      }
      if (!done) { const e = HZ.byChar[c] || HZ.wordByKey['w:' + c]; out.push({ s: e && e.py ? e.py.trim().split(/\s+/)[0] : '?', c }); i++; }
    }
    // тоновые изменения 不 и 一
    out.forEach((x, k) => {
      const nx = out[k + 1]; if (!nx || !nx.c) return;
      const t = HZ.toneOf(nx.s.replace(/[^\p{L}]/gu, ''));
      if (x.c === '不' && /^bù/.test(x.s) && t === 4) x.s = x.s.replace('bù', 'bú');
      if (x.c === '一' && /^yī/.test(x.s)) x.s = x.s.replace('yī', t === 4 ? 'yí' : t >= 1 && t <= 3 ? 'yì' : 'yī');
    });
    const res = out.map(x => x.s).join(' ');
    return res ? res[0].toUpperCase() + res.slice(1) : '';
  };

  /* ---------- Утилиты ---------- */
  HZ.rand = n => Math.floor(Math.random() * n);
  HZ.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = HZ.rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  HZ.sample = (a, n) => HZ.shuffle(a).slice(0, n);
  HZ.pad = n => String(n).padStart(2, '0');
  HZ.dayKey = (d = new Date()) => `${d.getFullYear()}-${HZ.pad(d.getMonth() + 1)}-${HZ.pad(d.getDate())}`;
  HZ.startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  HZ.endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  HZ.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  HZ.HSK_MAX = 5; // HSK 3.0, уровни 1–5; 6 — вне списка
  HZ.lvName = h => h > HZ.HSK_MAX ? 'вне HSK' : 'HSK ' + h;
  HZ.plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; if (m > 10 && m < 20) return c; if (k > 1 && k < 5) return b; if (k === 1) return a; return c; };
  HZ.hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
})();
