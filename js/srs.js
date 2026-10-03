/* Система интервального повторения (SRS).
 * Алгоритм — вариант SM-2 в духе Anki:
 *  • новые карточки проходят короткие шаги обучения (1 и 10 минут);
 *  • после выпуска интервал растёт: «Хорошо» ×ease, «Легко» ×ease×1.3, «Трудно» ×1.2;
 *  • «Снова» — ошибка: ease падает, интервал сокращается, карточка возвращается в обучение;
 *  • ease учитывает сложность: слабые карточки возвращаются чаще;
 *  • «сложные» (leech-подобные) определяются по числу ошибок и доле верных ответов. */
(function () {
  'use strict';
  const HZ = window.HZ, store = HZ.store;
  const STEPS = [1, 10]; // минуты
  const MIN_EASE = 1.3;
  const DAY = 864e5;
  const GRADES = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };

  const cards = () => store.s.cards;
  const get = ch => cards()[ch];
  const isNew = ch => !cards()[ch];

  function create(ch) {
    return (cards()[ch] = { st: 'learn', step: 0, ease: 2.5, ivl: 0, due: Date.now(), reps: 0, lapses: 0, ok: 0, bad: 0, intro: Date.now(), last: 0, relearn: false });
  }

  // дата выхода: начало дня + n суток (как в Anki — карточка «поспевает» утром)
  const dueIn = days => HZ.addDays(HZ.startOfDay(), days).getTime();

  function nextState(c, g) {
    // возвращает копию карточки после оценки g (не меняет оригинал)
    const n = Object.assign({}, c);
    const now = Date.now();
    if (n.st === 'learn') {
      if (g === 1) { n.step = 0; n.due = now + STEPS[0] * 60000; }
      else if (g === 2) { n.due = now + STEPS[Math.min(n.step, STEPS.length - 1)] * 60000; }
      else if (g === 3) {
        n.step++;
        if (n.step >= STEPS.length) { n.st = 'review'; n.ivl = n.relearn ? Math.max(1, n.ivl) : 1; n.relearn = false; n.due = dueIn(n.ivl); }
        else n.due = now + STEPS[n.step] * 60000;
      } else {
        n.st = 'review'; n.ivl = n.relearn ? Math.max(2, n.ivl) : 3; n.relearn = false; n.due = dueIn(n.ivl);
      }
    } else {
      if (g === 1) {
        n.lapses++; n.ease = Math.max(MIN_EASE, n.ease - 0.2);
        n.ivl = Math.max(1, Math.round(n.ivl * 0.4));
        n.st = 'learn'; n.relearn = true; n.step = 0; n.due = now + STEPS[0] * 60000;
      } else {
        const over = Math.max(0, (now - n.due) / DAY); // просрочка в днях
        const base = n.ivl + over * (g === 2 ? 0 : g === 3 ? 0.5 : 1);
        if (g === 2) { n.ease = Math.max(MIN_EASE, n.ease - 0.15); n.ivl = Math.max(n.ivl + 1, Math.round(base * 1.2)); }
        else if (g === 3) { n.ivl = Math.max(n.ivl + 1, Math.round(base * n.ease)); }
        else { n.ease += 0.15; n.ivl = Math.max(n.ivl + 2, Math.round(base * n.ease * 1.3)); }
        n.due = dueIn(n.ivl);
      }
    }
    return n;
  }

  function label(c, g) { // подпись на кнопке: через какое время вернётся
    const n = nextState(c, g);
    if (n.st === 'learn') {
      const m = Math.max(1, Math.round((n.due - Date.now()) / 60000));
      return m + ' мин';
    }
    return fmtDays(n.ivl);
  }
  function fmtDays(d) {
    if (d < 30) return d + ' д';
    if (d < 365) return Math.round(d / 30 * 10) / 10 + ' мес';
    return Math.round(d / 365 * 10) / 10 + ' г';
  }

  /** Оценить карточку (влияет на расписание). Возвращает обновлённую карточку. */
  function grade(ch, g) {
    let c = get(ch) || create(ch);
    Object.assign(c, nextState(c, g));
    c.reps++; c.last = Date.now(); c.seen = true;
    if (g === 1) c.bad++; else c.ok++;
    store.save();
    return c;
  }

  /** Фиксация результата вне расписания (игры, тренировки): влияет только на счётчики сложности. */
  function record(ch, ok) {
    const c = get(ch);
    if (!c) return;
    if (ok) c.ok++; else c.bad++;
    store.save();
  }

  /** «Уже знаю»: сразу в повторение с большим интервалом. */
  function markKnown(ch, days = 14) {
    const c = get(ch) || create(ch);
    Object.assign(c, { st: 'review', ivl: days, due: dueIn(days), step: 0, relearn: false, seen: true, ok: c.ok + 1 });
    store.save();
  }

  function accuracy(c) { const t = c.ok + c.bad; return t ? c.ok / t : 1; }

  /** Сложный иероглиф: часто ошибаетесь или низкий ease. */
  function isHard(ch) {
    const c = get(ch);
    if (!c) return false;
    const t = c.ok + c.bad;
    return c.lapses >= 2 || c.ease < 2.0 || (t >= 4 && accuracy(c) < 0.65);
  }
  /** Оценка сложности (чем больше — тем хуже запоминается) */
  function difficulty(ch) {
    const c = get(ch);
    if (!c) return 0;
    const t = c.ok + c.bad;
    return (1 - accuracy(c)) * Math.min(1, t / 6) * 2 + c.lapses * 0.5 + (2.5 - c.ease);
  }

  const isMastered = c => c && c.st === 'review' && c.ivl >= 21;

  function dueList(limit = 9999) {
    const endToday = HZ.endOfDay().getTime();
    const out = [];
    for (const ch in cards()) {
      if (!HZ.entry(ch)) continue; // карточка удалённого из набора слова/иероглифа
      const c = cards()[ch];
      if (c.st === 'learn') out.push({ ch, due: c.due - 1e12, learn: true });       // обучаемые — вперёд
      else if (c.due <= endToday) out.push({ ch, due: c.due });
    }
    out.sort((a, b) => a.due - b.due);
    return out.slice(0, limit).map(x => x.ch);
  }

  function newBudget() { return Math.max(0, store.s.settings.newPerDay - store.today().newc); }

  /** Новые иероглифы по выбранному источнику (всё / подборка). */
  function newList(limit = 9999) {
    const src = store.s.settings.newSource;
    let pool = HZ.chars.map(c => c.ch);
    if (src && src !== 'all') {
      const col = HZ.getCollection && HZ.getCollection(src);
      if (col && col.chars.length) pool = col.chars;
    }
    return pool.filter(isNew).slice(0, limit);
  }

  function counts() {
    let learned = 0, learning = 0;
    for (const ch in cards()) { if (HZ.isKey(ch) || !HZ.entry(ch)) continue; const c = cards()[ch]; if (isMastered(c)) learned++; else learning++; }
    return { learned, learning, fresh: HZ.chars.length - learned - learning, total: HZ.chars.length };
  }
  function wordCounts() {
    let learned = 0, learning = 0;
    for (const k in cards()) { if (!HZ.isKey(k) || !HZ.entry(k)) continue; const c = cards()[k]; if (isMastered(c)) learned++; else learning++; }
    return { learned, learning, fresh: HZ.words.length - learned - learning, total: HZ.words.length };
  }
  const newWordBudget = () => Math.max(0, store.s.settings.newWordsPerDay - (store.today().neww || 0));
  /** Новые слова: по уровню HSK и частоте (как в списке) */
  function newWordList(limit = 9999) { return HZ.words.filter(w => isNew(w.key)).slice(0, limit).map(w => w.key); }
  const hardList = () => HZ.chars.map(c => c.ch).filter(isHard).sort((a, b) => difficulty(b) - difficulty(a));

  function forecast(days = 7) { // сколько карточек созреет в ближайшие дни
    const arr = new Array(days).fill(0);
    const base = HZ.startOfDay().getTime();
    for (const ch in cards()) {
      const c = cards()[ch];
      if (c.st === 'learn') { arr[0]++; continue; }
      const d = Math.max(0, Math.floor((c.due - base) / DAY));
      if (d < days) arr[d]++;
    }
    return arr;
  }

  HZ.srs = { GRADES, get, isNew, create, grade, label, record, markKnown, isHard, difficulty, accuracy, isMastered, dueList, newBudget, newList, counts, wordCounts, newWordBudget, newWordList, hardList, forecast, fmtDays, nextState };
})();
