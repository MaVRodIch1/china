/* Чтение: тексты трёх уровней HSK 3.0, разбор слов по касанию, вопросы на понимание, учить слова из текста. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs;
  const HAN = /[一-鿿]/;
  const firstGloss = m => (m || '').split(/[;(]/)[0].trim();
  const prog = id => (store.s.texts || {})[id];

  /* ====== Разбор текста на предложения и слова ====== */
  const cache = {};
  function parse(t) {
    if (cache[t.id]) return cache[t.id];
    const paras = t.paras.map(p => p.map(([z, py, ru]) => HZ.sentences.build(z, py, ru, t.id) || {
      z, m: ru, py, key: t.id, tokens: [...z].map(c => ({ w: c, py: '', pre: '', suf: '', e: HZ.byChar[c] || null, lvl: 3 }))
    }));
    const words = new Map(), chars = new Set();
    paras.forEach(p => p.forEach(s => s.tokens.forEach(tk => {
      if (tk.e && tk.e.isWord) words.set(tk.e.key, tk.e);
      [...tk.w].forEach(c => { if (HAN.test(c) && HZ.byChar[c]) chars.add(c); });
    })));
    return (cache[t.id] = { paras, words: [...words.values()], chars: [...chars] });
  }
  /** Слова и иероглифы текста (для режима изучения и подборок) */
  HZ.textVocab = id => { const t = HZ.textById(id); return t ? parse(t) : { words: [], chars: [] }; };

  const keyOf = tk => (tk.e ? (tk.e.key || tk.e.ch) : null);
  function known(tk) {
    const e = tk.e; if (!e) return true;
    if (srs.get(e.key || e.ch)) return true;
    return !!(e.isWord && e.chars.length && e.chars.every(c => srs.get(c)));
  }
  const newWordsOf = P => P.words.filter(w => srs.isNew(w.key));
  const newCharsOf = P => P.chars.filter(c => srs.isNew(c));
  const sentText = s => s.tokens.map(t => t.pre + t.w + t.suf).join('');

  /* ====== Список текстов ====== */
  let lvFilter = '';
  function list() {
    const view = document.getElementById('view');
    const box = h('div.text-list');
    const draw = () => {
      ui.clear(box);
      const items = HZ.texts.filter(t => !lvFilter || String(t.lvl) === lvFilter);
      [1, 2, 3].forEach(lv => {
        const ts = items.filter(t => t.lvl === lv);
        if (!ts.length) return;
        box.append(h('h3.text-lv', `HSK ${lv}`, h('span.muted.small', ` · ${ts.length} ${HZ.plural(ts.length, 'текст', 'текста', 'текстов')}`)),
          h('div.text-grid', ts.map(t => {
            const P = parse(t), pr = prog(t.id), n = newWordsOf(P).length, sc = t.paras.reduce((a, p) => a + p.length, 0);
            return h('a.text-card' + (pr && pr.done ? '.done' : ''), { href: '#/text/' + t.id },
              h('div.text-card-top', h('span.chip.sm', t.topic), pr && pr.done ? h('span.chip.sm.done', `✓ ${pr.best}/${t.qs.length}`) : null),
              h('b.zh.text-card-zh', t.zh), h('div.muted.small', t.ru),
              h('div.muted.small', `${sc} ${HZ.plural(sc, 'предложение', 'предложения', 'предложений')} · ${n ? n + ' ' + HZ.plural(n, 'новое слово', 'новых слова', 'новых слов') : 'все слова знакомы'}`));
          })));
      });
    };
    const sel = h('select.input', { onchange: () => { lvFilter = sel.value; draw(); } },
      [['', 'Все уровни'], ['1', 'HSK 1'], ['2', 'HSK 2'], ['3', 'HSK 3']].map(([v, l]) => h('option', { value: v }, l)));
    sel.value = lvFilter;
    const done = Object.values(store.s.texts || {}).filter(x => x.done).length;
    ui.clear(view).append(h('div.page', h('h1', 'Чтение'), HZ.libTabs('texts'),
      h('p.muted', 'Короткие тексты на трёх уровнях: коснитесь любого слова — увидите пиньинь, значение и иероглифы с карточками. После текста — вопросы на понимание, а слова можно сразу выучить. Все тексты написаны только знаками своего уровня или проще.'),
      h('div.row.wrap', sel, h('span.muted', `Прочитано: ${done} из ${HZ.texts.length}`)), box));
    draw();
  }

  /* ====== Чтение ====== */
  function reader(id) {
    const t = HZ.textById(id);
    if (!t) return HZ.router.go('#/texts');
    const P = parse(t), s = store.s.settings, view = document.getElementById('view');
    let selTok = null;
    const sheet = h('div.rd-sheet');
    const body = h('div.rd-body');
    const info = h('span.muted.small');
    const trShown = new Set();
    const nTok = P.paras.reduce((a, p) => a + p.reduce((b, x) => b + x.tokens.length, 0), 0);

    function tokNode(tk) {
      const unk = s.rdHi !== false && !known(tk) && tk.e;
      const n = h('span.rd-tok' + (unk ? '.unk' : '') + (selTok === tk ? '.sel' : ''), { onclick: () => { selTok = tk; ui.speak(tk.w); openSheet(tk); drawBody(); } },
        tk.pre, h('ruby', tk.w, h('rt', tk.py)), tk.suf);
      return n;
    }
    function sentNode(sn, i) {
      const showTr = s.rdTr === 'all' || trShown.has(sn);
      const tr = h('div.rd-tr' + (showTr ? '' : '.hide'), sn.m);
      return h('div.rd-sent',
        h('div.rd-line' + (s.sentPy ? '.with-py' : ''), { lang: 'zh' }, sn.tokens.map(tokNode)),
        h('div.rd-act', h('button.icon-btn.sm', { type: 'button', title: 'Прослушать', 'aria-label': 'Прослушать', onclick: () => ui.speak(sentText(sn)) }, '🔊'),
          h('button.icon-btn.sm', { type: 'button', title: 'Перевод', 'aria-label': 'Показать перевод', onclick: () => { trShown.has(sn) ? trShown.delete(sn) : trShown.add(sn); tr.classList.toggle('hide'); } }, '🌐')),
        tr);
    }
    function drawBody() {
      ui.clear(body).append(...P.paras.map(p => h('div.rd-para', p.map(sentNode))));
      const unk = P.words.filter(w => !(srs.get(w.key) || w.chars.every(c => srs.get(c)))).length;
      info.textContent = `${P.words.length} слов в тексте · незнакомых: ${unk}`;
    }

    /* Нижняя панель: слово → иероглифы → карточка знака */
    function learnBtn(key, label) {
      if (!key || !srs.isNew(key)) return h('span.chip.done', '✓ В изучении');
      return h('button.btn.sm', { type: 'button', onclick: () => { srs.create(key); store.save(); ui.toast('Добавлено в повторение ✓'); openSheet(selTok); drawBody(); } }, label);
    }
    function closeSheet() { sheet.classList.remove('open'); selTok = null; drawBody(); }
    function openSheet(tk, charView) {
      ui.clear(sheet);
      const e = tk.e;
      const head = h('div.rd-sheet-head', h('div.rd-sheet-w.zh', { lang: 'zh' }, charView ? charView : tk.w),
        h('button.icon-btn', { type: 'button', onclick: () => ui.speak(charView || tk.w), 'aria-label': 'Прослушать' }, '🔊'),
        h('button.icon-btn.rd-x', { type: 'button', onclick: closeSheet, 'aria-label': 'Закрыть' }, '✕'));
      let content;
      if (charView) { // карточка отдельного иероглифа
        const c = HZ.byChar[charView];
        content = c ? h('div',
          h('div.rd-py', ui.py(c.py, 'lg'), h('span.chip.sm', 'HSK ' + (c.h > 3 ? '—' : c.h))),
          h('div.rd-m', c.m),
          c.comps && c.comps.length ? h('div.muted.small', 'Состав: ' + c.comps.map(x => x.g + ' — ' + x.t).join('; ')) : null,
          c.mn ? h('div.rd-mn', '💡 ' + c.mn) : null,
          h('div.rd-btns', h('a.btn.sm.primary', { href: '#/char/' + c.ch }, 'Карточка →'), learnBtn(c.ch, '➕ Учить иероглиф'),
            e && e.isWord ? h('button.btn.sm', { type: 'button', onclick: () => openSheet(tk) }, '← К слову') : null)) : h('p.muted', 'Нет данных');
      } else if (e) {
        const wordChars = [...tk.w].filter(c => HAN.test(c));
        content = h('div',
          h('div.rd-py', ui.py(e.py || tk.py, 'lg'), e.pos && e.pos.length ? h('span.chip.sm', e.pos[0]) : null, h('span.chip.sm', 'HSK ' + (e.h > 3 ? '—' : e.h))),
          h('div.rd-m', firstGloss(e.m) || e.m),
          e.m && e.m.includes(';') ? h('div.muted.small', e.m) : null,
          wordChars.length > 1 || e.isWord ? h('div.rd-chars', wordChars.map(c => { const ce = HZ.byChar[c]; return h('button.rd-char', { type: 'button', onclick: () => openSheet(tk, c) }, h('span.zh', c), h('small', ce ? ce.py : ''), h('small.muted', ce ? firstGloss(ce.m) : '')); })) : null,
          h('div.rd-btns', h('a.btn.sm.primary', { href: e.isWord ? '#/word/' + encodeURIComponent(e.ch) : '#/char/' + e.ch }, 'Карточка →'),
            learnBtn(e.key || e.ch, e.isWord ? '➕ Учить слово' : '➕ Учить иероглиф')));
        // одиночный иероглиф без слова: сразу его карточка
        if (!e.isWord) { openSheet(tk, tk.w); return; }
      } else content = h('p.muted', 'Нет данных');
      sheet.append(head, content);
      sheet.classList.add('open');
    }

    /* Панель инструментов */
    const bPy = h('button.btn.sm', { type: 'button', onclick: () => { s.sentPy = !s.sentPy; store.save(); tools(); drawBody(); } });
    const bTr = h('button.btn.sm', { type: 'button', onclick: () => { s.rdTr = s.rdTr === 'all' ? 'tap' : 'all'; store.save(); tools(); drawBody(); } });
    const bHi = h('button.btn.sm', { type: 'button', onclick: () => { s.rdHi = s.rdHi === false; store.save(); tools(); drawBody(); } });
    const bAll = h('button.btn.sm', { type: 'button', onclick: () => ui.speak(P.paras.flat().map(sentText).join('')) }, '🔊 Весь текст');
    function tools() {
      bPy.textContent = s.sentPy ? '👁 Пиньинь: вкл' : '👁 Пиньинь: выкл';
      bTr.textContent = s.rdTr === 'all' ? '🌐 Перевод: весь' : '🌐 Перевод: по касанию';
      bHi.textContent = s.rdHi === false ? '🖍 Незнакомые: не выделять' : '🖍 Незнакомые: выделять';
    }
    tools();

    /* Вопросы на понимание */
    const quiz = h('div.panel.rd-quiz');
    const result = h('div.rd-result');
    function buildQuiz() {
      let answered = 0, right = 0;
      ui.clear(quiz).append(h('h3', 'Проверьте понимание'), ...t.qs.map(([q, ok, ...bad], qi) => {
        const opts = HZ.shuffle([ok, ...bad]);
        const box = h('div.rd-q', h('p.rd-qt', `${qi + 1}. ${q}`));
        const row = h('div.rd-opts');
        opts.forEach(o => {
          const b = h('button.rd-opt', { type: 'button', onclick: () => {
            row.querySelectorAll('button').forEach(x => { x.disabled = true; if (x.dataset.ok) x.classList.add('right'); });
            if (o === ok) { right++; ui.sfx('ok'); } else { b.classList.add('wrong'); ui.sfx('bad'); }
            if (++answered === t.qs.length) finish(right);
          } }, o);
          if (o === ok) b.dataset.ok = '1';
          row.appendChild(b);
        });
        box.appendChild(row);
        return box;
      }), result);
    }
    function finish(right) {
      const total = t.qs.length;
      store.s.texts = store.s.texts || {};
      const old = store.s.texts[t.id];
      const first = !old || !old.done;
      const rec = store.s.texts[t.id] = { done: (old && old.done) || Date.now(), best: Math.max(old ? old.best : 0, right), n: (old ? old.n : 0) + 1 };
      const xp = first ? 15 + right * 5 : 5;
      store.save();
      HZ.gami.addXP(xp); HZ.gami.onGame(right, total);
      if (right === total) ui.confetti(80);
      ui.clear(result).append(h('div.rd-result-box', h('b', right === total ? '🏆 Отлично!' : right >= total / 2 ? '👍 Хорошо' : '💪 Попробуйте перечитать'),
        h('span', ` Верно ${right} из ${total} · +${xp} XP`),
        h('div.row.wrap.mt', h('button.btn.sm', { type: 'button', onclick: () => { buildQuiz(); } }, 'Пройти ещё раз'), h('a.btn.sm', { href: '#/texts' }, 'К списку текстов'))));
    }

    /* Действия: выучить слова, подборка */
    function colOf() {
      const name = 'Текст: ' + t.ru;
      let c = store.s.collections.find(x => x.name === name);
      if (!c) c = HZ.collections.create(name, P.chars);
      else HZ.collections.addChars(c.id, P.chars);
      return c;
    }
    const nw = newWordsOf(P).length, nc = newCharsOf(P).length;
    const actions = h('div.panel', h('h3', 'Закрепите'),
      h('div.row.wrap',
        nw ? h('a.btn.primary', { href: '#/study/textwords/' + t.id }, `📚 Выучить слова · ${nw}`) : h('span.chip.done', '✓ Все слова из текста уже в изучении'),
        nc ? h('a.btn', { href: '#/study/textchars/' + t.id }, `🈶 Выучить иероглифы · ${nc}`) : null,
        h('button.btn', { type: 'button', onclick: () => { const c = colOf(); ui.toast('Подборка «' + c.name + '» сохранена ✓'); } }, '🗂 Сохранить знаки как подборку'),
        h('button.btn', { type: 'button', onclick: () => { const c = colOf(); store.s.settings.gameSrc = c.id; store.save(); HZ.router.go('#/games'); } }, '🎯 Играть с этими знаками')));

    drawBody(); buildQuiz();
    ui.clear(view).append(h('div.page.reader',
      h('a.btn.sm', { href: '#/texts' }, '← Тексты'),
      h('div.rd-title', h('h1.zh', t.zh), h('div.rd-title-py.muted', t.py), h('div.rd-title-ru', t.ru),
        h('div.row.wrap', h('span.chip.sm', 'HSK ' + t.lvl), h('span.chip.sm', t.topic), info)),
      h('div.rd-tools', bPy, bTr, bHi, bAll),
      body, quiz, actions, h('div.rd-pad')), sheet);
    HZ.router.onLeave(() => sheet.remove());
  }

  HZ.views.texts = list; HZ.views.text = reader;
})();
