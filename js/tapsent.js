/* Кликабельные примеры: каждое слово предложения нажимается — открывается окошко со словом
 * (пиньинь, значение, состав, озвучка, карточка) и кнопками «＋ В подборку». Используется везде, где показаны примеры. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store;
  const HAN = /[一-鿿]/;

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

  HZ.tapSent = tapSent;
  HZ.wordPop = wordPop;
})();
