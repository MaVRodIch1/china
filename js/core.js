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

  /* ---------- Утилиты ---------- */
  HZ.rand = n => Math.floor(Math.random() * n);
  HZ.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = HZ.rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  HZ.sample = (a, n) => HZ.shuffle(a).slice(0, n);
  HZ.pad = n => String(n).padStart(2, '0');
  HZ.dayKey = (d = new Date()) => `${d.getFullYear()}-${HZ.pad(d.getMonth() + 1)}-${HZ.pad(d.getDate())}`;
  HZ.startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  HZ.endOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  HZ.addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  HZ.plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; if (m > 10 && m < 20) return c; if (k > 1 && k < 5) return b; if (k === 1) return a; return c; };
  HZ.hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
})();
