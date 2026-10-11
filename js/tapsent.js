/* Кликабельные примеры: каждое слово предложения нажимается — открывается окошко со словом
 * (пиньинь, значение, состав, озвучка, карточка) и кнопками «＋ В подборку». Используется везде, где показаны примеры. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store;
  const HAN = /[一-鿿]/;
  if (store.s.settings.autoAdd === undefined) store.s.settings.autoAdd = true;

  /** Простой разбор без пиньиня (для своих примеров): самое длинное совпадение со словарём. */
  function split(z) {
    const cs = [...z], out = [];
    for (let i = 0; i < cs.length;) {
      if (!HAN.test(cs[i])) { out.push({ w: cs[i], e: null }); i++; continue; }
      let n = 1;
      for (let l = 4; l >= 2; l--) if (HZ.wordByKey['w:' + cs.slice(i, i + l).join('')]) { n = l; break; }
      const w = cs.slice(i, i + n).join('');
      out.push({ w, e: HZ.wordByKey['w:' + w] || HZ.byChar[w] || null }); i += n;
    }
    return out;
  }
  const keyOf = e => e.key || e.ch;

  /** Выбор подборки и добавление (слова — в words, иероглифы — в chars). */
  function addBox(entries, label) {
    const mine = store.s.collections;
    const add = id => {
      const ws = entries.filter(e => e.isWord).map(e => e.key), cs = entries.filter(e => !e.isWord).map(e => e.ch);
      if (ws.length) HZ.collections.addWords(id, ws);
      if (cs.length) HZ.collections.addChars(id, cs);
      const c = HZ.collections.get(id); ui.toast(`Добавлено в «${c ? c.name : 'подборку'}»`, 'gold'); ui.sfx && ui.sfx('ok');
    };
    const box = h('div.ts-add');
    if (mine.length) {
      const sel = h('select.input', mine.map(c => h('option', { value: c.id }, c.name)));
      if (store.s.lastCol && mine.some(c => c.id === store.s.lastCol)) sel.value = store.s.lastCol;
      box.append(h('div.row', sel, h('button.btn.primary', { type: 'button', onclick: () => { store.s.lastCol = sel.value; store.save(); add(sel.value); } }, label || '＋ В подборку')));
    }
    box.append(h('button.btn.sm', { type: 'button', onclick: () => ui.prompt('Новая подборка', 'Название', '', 'Создать', n => {
      const c = HZ.collections.create(n, entries.filter(e => !e.isWord).map(e => e.ch), entries.filter(e => e.isWord).map(e => e.key));
      store.s.lastCol = c.id; store.save(); ui.toast(`Подборка «${n}» создана`, 'gold');
    }) }, '＋ Новая подборка'));
    return box;
  }

  /** Окошко слова из примера. */
  function wordPop(e, sent) {
    offerAdd(e);
    const parts = e.isWord && e.chars.length > 1 ? h('div.ts-parts', e.chars.map(c => { const x = HZ.byChar[c]; return h(x ? 'a' : 'span', x ? { href: '#/char/' + c, class: 'ts-part' } : { class: 'ts-part' }, h('b.zh', c), h('small', x ? x.py + ' · ' + (x.m || '').split(/[;,]/)[0] : '')); })) : null;
    const body = h('div.ts-pop',
      h('div.ts-head', h('span.zh.ts-big', e.ch), h('div', h('div.row', ui.py(e.py, 'lg'), ui.speakBtn(e.ch)), h('div.ts-m', e.m), h('span.chip.sm', e.isWord ? (e.custom ? 'моё слово' : 'слово · ' + HZ.lvName(e.h)) : 'иероглиф · ' + HZ.lvName(e.h)))),
      e.mn ? h('p.mnemonic.small', e.mn) : null,
      parts,
      addBox([e]),
      sent ? h('details.ts-more', h('summary', 'Всё предложение в подборку'), addBox(sent.filter(Boolean), '＋ Все слова предложения')) : null);
    ui.modal(e.isWord ? 'Слово из примера' : 'Иероглиф из примера', body, [
      { label: 'Открыть карточку', onclick: () => { HZ.router.go((e.isWord ? '#/word/' : '#/char/') + encodeURIComponent(e.ch)); } },
      { label: 'Закрыть', primary: true }]);
  }

  /** Предложение с кликабельными словами: { z, p, m } → элемент. */
  function tapSent(s, extra) {
    const toks = split(s.z), uniq = [];
    toks.forEach(t => { if (t.e && !uniq.includes(t.e)) uniq.push(t.e); });
    const zh = h('div.zh.ts-line', toks.map(t => t.e ? h('button.ts-w', { type: 'button', title: (t.e.py || '') + ' — ' + (t.e.m || '').split(/[;,]/)[0], onclick: ev => { ev.stopPropagation(); wordPop(t.e, uniq); } }, t.w) : h('span', t.w)),
      ui.speakBtn(s.z, 'sm'), extra || null);
    return h('div.sent', zh, s.p ? h('div', ui.py(s.p)) : null, s.m ? h('div.muted', s.m) : null);
  }

  /* ====== Быстрое добавление: открыли знак или слово — через 10 с оно само попадёт в текущую подборку, если не отказаться ====== */
  const WAIT = 10000;
  let pend = null; const declined = new Set();
  const inCol = (c, e) => c && (e.isWord ? (c.words || []).includes(e.key) : c.chars.includes(e.ch));
  function curCol() {
    const mine = store.s.collections;
    return mine.find(c => c.id === store.s.lastCol) || mine[0] || null;
  }
  function commit(p, silent) {
    clearTimeout(p.timer); p.bar.remove(); if (pend === p) pend = null;
    let c = store.s.collections.find(x => x.id === p.col);
    if (!c) { c = HZ.collections.create('Мои слова', [], []); store.s.lastCol = c.id; }
    if (p.e.isWord) HZ.collections.addWords(c.id, [p.e.key]); else HZ.collections.addChars(c.id, [p.e.ch]);
    store.s.lastCol = c.id; store.save();
    if (!silent) ui.toast(`✓ ${p.e.ch} — в «${c.name}»`, 'gold', 1800);
  }
  function offerAdd(e) {
    if (!e || store.s.settings.autoAdd === false || declined.has(e.key || e.ch)) return;
    const c = curCol();
    if (inCol(c, e)) return;
    if (pend) { if (pend.e === e) return; commit(pend, true); }   // прошлое предложение молча принимается
    const p = { e, col: c ? c.id : '' };
    const sel = h('select.input.qa-sel', { 'aria-label': 'Подборка', onchange: () => { p.col = sel.value; store.s.lastCol = sel.value; store.save(); restart(); } },
      store.s.collections.map(x => h('option', { value: x.id }, x.name)), c ? null : h('option', { value: '' }, '＋ новая «Мои слова»'));
    sel.value = p.col;
    const bar = h('div.qa-bar', { role: 'status' },
      h('div.qa-row', h('span.zh.qa-ch', e.ch), h('div.qa-txt', h('b', 'Добавить в подборку?'), h('small.muted', 'добавится само через 10 с')), sel),
      h('div.qa-row', h('button.btn.sm.primary', { type: 'button', onclick: () => commit(p) }, '✓ Добавить'), h('button.btn.sm', { type: 'button', onclick: () => { declined.add(e.key || e.ch); clearTimeout(p.timer); bar.remove(); pend = null; } }, '✕ Не надо'),
        h('button.btn.sm.qa-off', { type: 'button', title: 'Больше не предлагать (включить можно в настройках)', onclick: () => { store.s.settings.autoAdd = false; store.save(); clearTimeout(p.timer); bar.remove(); pend = null; ui.toast('Автодобавление выключено — включить можно в настройках'); } }, 'Не предлагать')),
      h('i.qa-time'));
    p.bar = bar;
    const restart = () => { clearTimeout(p.timer); const t = bar.querySelector('.qa-time'); t.style.animation = 'none'; void t.offsetWidth; t.style.animation = ''; p.timer = setTimeout(() => commit(p), WAIT); };
    document.body.append(bar); pend = p; restart();
  }
  HZ.offerAdd = offerAdd;

  HZ.tapSent = tapSent;
  HZ.wordPop = wordPop;
})();
