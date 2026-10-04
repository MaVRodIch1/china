/* Карточка иероглифа: полный разбор (используется в библиотеке, обучении и играх). */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store;

  function stateLabel(ch) {
    const c = HZ.srs.get(ch);
    if (!c) return { t: 'Новый', cls: 'new' };
    if (HZ.srs.isMastered(c)) return { t: 'Выучен', cls: 'done' };
    return { t: c.st === 'learn' ? 'Учится' : 'Повторяется', cls: 'learn' };
  }

  function strokeBlock(e) {
    const box = h('div.stroke-box');
    const target = h('div.stroke-target');
    const msg = h('p.muted.small', `Количество черт: ${e.s}. Порядок черт загружается из открытой базы Hanzi Writer.`);
    let writer = null;
    const btnAnim = h('button.btn.sm', { type: 'button' }, '▶ Показать порядок черт');
    const btnQuiz = h('button.btn.sm', { type: 'button' }, '✍️ Прописать самому');
    async function ensure() {
      if (writer) return writer;
      try { await ui.loadHanziWriter(); } catch (err) { msg.textContent = 'Для анимации черт нужен интернет (Hanzi Writer). Количество черт: ' + e.s + '.'; return null; }
      const dark = document.documentElement.dataset.theme === 'dark';
      writer = window.HanziWriter.create(target, e.ch, {
        width: 180, height: 180, padding: 8, showOutline: true, strokeAnimationSpeed: 1, delayBetweenStrokes: 250,
        strokeColor: dark ? '#f2f2f2' : '#222', outlineColor: dark ? '#444' : '#ddd', radicalColor: '#e4572e', highlightColor: '#29a870'
      });
      return writer;
    }
    btnAnim.onclick = async () => { const w = await ensure(); if (w) { w.cancelQuiz(); w.animateCharacter(); } };
    btnQuiz.onclick = async () => {
      const w = await ensure(); if (!w) return;
      msg.textContent = 'Проведите пальцем или мышью по контуру, повторяя порядок черт.';
      w.quiz({ onComplete: s => {
        const mistakes = s.totalMistakes;
        ui.sfx(mistakes ? 'ok' : 'level');
        msg.textContent = mistakes ? `Готово! Ошибок: ${mistakes}.` : 'Безупречно! 🎉';
        HZ.gami.addXP(mistakes ? 5 : 10);
      } });
    };
    box.append(h('div.row.wrap', btnAnim, btnQuiz), target, msg);
    return box;
  }

  /** compact: компактный режим для сессии обучения (без редактора заметок и статистики) */
  function detail(e, opts = {}) {
    const st = stateLabel(e.ch);
    const root = h('div.card-detail');
    root.append(h('div.cd-head',
      h('div.big-char', { lang: 'zh' }, e.ch),
      h('div.cd-meta',
        h('div.row', ui.py(e.py, 'lg'), ui.speakBtn(e.ch)),
        h('div.cd-mean', e.m),
        h('div.chips',
          h('span.chip.' + st.cls, st.t),
          e.h ? h('span.chip', HZ.lvName(e.h)) : null,
          h('span.chip', e.s + ' ' + HZ.plural(e.s, 'черта', 'черты', 'черт')),
          h('a.chip.link', { href: '#/collection/rad-' + e.r, title: 'Все иероглифы с этим ключом' }, `Ключ ${e.r} · ${HZ.radicals[e.r] || ''}`)))));

    // Состав
    const comps = h('section.cd-sec', h('h4', '🧩 Из чего состоит'));
    if (e.comps.length) {
      comps.append(h('div.comps', e.comps.map(c => {
        const inLib = HZ.byChar[c.g];
        const tag = inLib ? 'a' : 'div';
        return h(tag + '.comp' + (c.ph ? '.ph' : ''), inLib ? { href: '#/char/' + c.g } : {},
          h('span.g', c.g), h('span.t', c.t), c.ph ? h('span.tag', 'фонетик') : h('span.tag.sem', 'смысл'));
      })), e.comps.length > 1 ? h('p.muted.small', e.comps.map(c => c.g).join(' + ') + ' = ' + e.ch) : null);
    } else comps.append(h('p.muted', 'Простой знак (пиктограмма или указательный знак): отдельных значимых частей нет — смотрите образ ниже.'));
    root.append(comps);

    // Мнемоника
    const nt = store.note(e.ch);
    const mn = h('section.cd-sec', h('h4', '💡 Мнемоника'), h('p.mnemonic', e.mn || 'Придумайте свой образ — это лучший способ запомнить!'));
    if (e.et) mn.append(h('p.etym', h('b', 'Происхождение: '), e.et));
    root.append(mn);

    if (!opts.compact) {
      const area = h('textarea.input', { rows: 2, placeholder: 'Ваша ассоциация или история…', maxlength: 400 }, nt.assoc);
      area.addEventListener('input', () => { nt.assoc = area.value; store.save(); });
      area.addEventListener('blur', () => HZ.gami.check());
      const note = h('textarea.input', { rows: 2, placeholder: 'Заметки (где встретили, чем путается…)', maxlength: 600 }, nt.note);
      note.addEventListener('input', () => { nt.note = note.value; store.save(); });
      root.append(h('section.cd-sec', h('h4', '✍️ Моя ассоциация'), area, h('h4.mt', '📝 Заметки'), note));
    } else if (nt.assoc) {
      root.append(h('section.cd-sec', h('h4', '✍️ Моя ассоциация'), h('p.mnemonic.mine', nt.assoc)));
    }

    // Слова
    if (e.words.length) root.append(h('section.cd-sec', h('h4', '📖 Слова'), h('ul.list', e.words.map(w =>
      h('li', h('span.zh', w.w), ' ', ui.py(w.p), h('span.muted', ' — ' + w.m), ui.speakBtn(w.w, 'sm'))))));
    const shown = new Set(e.words.map(w => w.w));
    const hskWords = HZ.words.filter(w => w.chars.includes(e.ch) && w.ch !== e.ch && !shown.has(w.ch)).slice(0, 12);
    if (hskWords.length) root.append(h('section.cd-sec', h('h4', '📚 Слова HSK с этим иероглифом'), h('div.chips', hskWords.map(w =>
      h('a.chip.link', { href: '#/word/' + encodeURIComponent(w.ch), title: w.m }, w.ch + ' · ' + w.m.split(/[;,(]/)[0].trim())))));
    // Предложения
    if (e.sents.length) root.append(h('section.cd-sec', h('h4', '💬 Примеры и живая речь'), e.sents.map((s, i) =>
      HZ.tapSent(s, i ? h('span.tag.sem', 'в живой речи') : null))));

    if (!opts.compact) {
      root.append(h('section.cd-sec', h('h4', '✒️ Порядок черт'), strokeBlock(e)));
      // Статистика и подборки
      const c = HZ.srs.get(e.ch);
      const stat = h('section.cd-sec', h('h4', '📊 Ваш прогресс'));
      if (c) stat.append(h('div.chips',
        h('span.chip', `Верно: ${c.ok}`), h('span.chip', `Ошибок: ${c.bad}`),
        h('span.chip', `Лёгкость: ${c.ease.toFixed(2)}`),
        h('span.chip', c.st === 'review' ? `Интервал: ${HZ.srs.fmtDays(c.ivl)}` : 'Идёт обучение'),
        c.st === 'review' ? h('span.chip', 'Повтор: ' + new Date(c.due).toLocaleDateString('ru-RU')) : null,
        HZ.srs.isHard(e.ch) ? h('span.chip.warn', '🧩 Сложный') : null));
      else stat.append(h('p.muted', 'Иероглиф ещё не изучался.'));
      const acts = h('div.row.wrap');
      if (!c) {
        acts.append(h('button.btn.primary', { onclick: () => { HZ.srs.create(e.ch); store.save(); HZ.gami.check(); ui.toast('Добавлено в изучение'); HZ.router.render(); } }, '＋ Начать изучать'),
          h('button.btn', { onclick: () => { HZ.srs.markKnown(e.ch); ui.toast('Отмечено как известное'); HZ.router.render(); } }, 'Уже знаю'));
      }
      acts.append(h('button.btn', { onclick: () => addToCollection(e.ch) }, '🗂️ В подборку'));
      stat.append(acts);
      root.append(stat);
    }
    return root;
  }

  function addToCollection(ch) {
    const list = store.s.collections;
    const sel = h('select.input', list.map(c => h('option', { value: c.id }, c.name)), h('option', { value: '__new' }, '＋ Новая подборка…'));
    if (!list.length) sel.value = '__new';
    const name = h('input.input', { placeholder: 'Название новой подборки', maxlength: 40 });
    const nameWrap = h('label.field', { style: { display: list.length ? 'none' : '' } }, h('span', 'Название'), name);
    sel.onchange = () => { nameWrap.style.display = sel.value === '__new' ? '' : 'none'; };
    ui.modal(`Добавить ${ch} в подборку`, h('div', h('label.field', h('span', 'Подборка'), sel), nameWrap), [
      { label: 'Отмена' },
      { label: 'Добавить', primary: true, onclick: () => {
        if (sel.value === '__new') {
          const n = name.value.trim(); if (!n) { name.focus(); return false; }
          HZ.collections.create(n, [ch]);
        } else HZ.collections.addChars(sel.value, [ch]);
        ui.toast('Добавлено в подборку ✓');
      } }]);
  }

  HZ.card = { detail: (e, o) => e.isWord ? HZ.wordDetail(e, o) : detail(e, o), stateLabel, addToCollection };
})();
