/* Хранилище прогресса (localStorage) с экспортом/импортом. */
(function () {
  'use strict';
  const HZ = window.HZ;
  const KEY = 'hanzi-app.v1';

  const defaults = () => ({
    v: 1,
    created: Date.now(),
    settings: { theme: 'auto', newPerDay: 5, newWordsPerDay: 5, reviewStyle: 'flip', newSource: 'all', sfx: true, tts: true, rate: 0.8, onboarded: false },
    cards: {},         // иероглиф -> состояние SRS
    notes: {},         // иероглиф -> {assoc, note}
    collections: [],   // пользовательские подборки [{id,name,chars}]
    xp: 0,
    ach: {},           // id -> время получения
    streak: { count: 0, best: 0, last: null },
    log: {},           // YYYY-MM-DD -> {rev, ok, newc, xp, games}
    quests: {},        // {date, done:{id:true}}
    best: {},          // рекорды игр
    evo: null,         // состояние игры «Эволюция»
    texts: {},         // прочитанные тексты: id -> {done, best, n}
    walk: null,        // «Долина знаков»
    myWords: {}        // свои слова и примеры: 'w:слово' -> {w, py, m, custom, ex:[{id,z,p,m}], t}
  });

  let state;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        state = Object.assign(defaults(), d, { settings: Object.assign(defaults().settings, d.settings || {}) });
        return;
      }
    } catch (e) { /* повреждённые данные — начинаем заново */ }
    state = defaults();
  }
  load();

  let timer = null;
  const saveListeners = [];
  function save() {
    state.updated = Date.now();
    saveListeners.forEach(f => f());
    clearTimeout(timer);
    timer = setTimeout(flush, 150);
  }
  function flush() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* хранилище недоступно */ }
  }
  window.addEventListener('beforeunload', flush);

  HZ.store = {
    get s() { return state; },
    save, flush,
    onSave(f) { saveListeners.push(f); },
    replace(next) { state = Object.assign(defaults(), next, { settings: Object.assign(defaults().settings, next.settings || {}) }); flush(); },
    today() { // журнал за сегодня
      const k = HZ.dayKey();
      return state.log[k] || (state.log[k] = { rev: 0, ok: 0, newc: 0, neww: 0, xp: 0, games: 0 });
    },
    note(ch) { return state.notes[ch] || (state.notes[ch] = { assoc: '', note: '' }); },
    exportJSON() { flush(); return JSON.stringify(state, null, 2); },
    importJSON(text) {
      const d = JSON.parse(text);
      if (!d || typeof d !== 'object' || !d.cards || !d.settings) throw new Error('Неверный формат файла');
      state = Object.assign(defaults(), d, { settings: Object.assign(defaults().settings, d.settings) });
      flush();
      if (HZ.applyMyWords) HZ.applyMyWords();
    },
    reset() { state = defaults(); flush(); }
  };
})();
