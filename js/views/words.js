/* Слова HSK: список, карточка слова. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs;

  const filters = { q: '', hsk: '', state: '', pos: '' };
  const POS = { n: 'сущ.', v: 'глагол', a: 'прил.', d: 'нареч.', m: 'числ.', q: 'сч. слово', r: 'мест.', p: 'предлог', c: 'союз', u: 'частица', y: 'частица', t: 'время', f: 'направление', e: 'межд.' };

  function stateOf(e) {
    const c = srs.get(e.key);
    if (!c) return { t: 'Новое', cls: 'new' };
    if (srs.isMastered(c)) return { t: 'Выучено', cls: 'done' };
    return { t: c.st === 'learn' ? 'Учится' : 'Повторяется', cls: 'learn' };
  }
  function matches(e) {
    const q = filters.q.trim().toLowerCase();
    if (q && !(e.ch + ' ' + e.py + ' ' + HZ.baseSyl(e.py) + ' ' + e.m).toLowerCase().includes(q)) return false;
    if (filters.hsk && String(e.h) !== filters.hsk) return false;
    if (filters.pos && !e.pos.includes(filters.pos)) return false;
    if (filters.state) {
      const c = srs.get(e.key);
      if (filters.state === 'new' && c) return false;
      if (filters.state === 'learn' && (!c || srs.isMastered(c))) return false;
      if (filters.state === 'done' && !srs.isMastered(c)) return false;
    }
    return true;
  }
  function row(e) {
    const st = stateOf(e);
    return h('a.word-row.' + st.cls, { href: '#/word/' + encodeURIComponent(e.ch) },
      h('span.zh.w', e.ch), h('span.wp', ui.py(e.py)), h('span.wm.muted', e.m), h('span.chip.sm', 'HSK ' + e.h));
  }

  function tabs(active) {
    return h('div.tabs', h('a.tab' + (active === 'chars' ? '.on' : ''), { href: '#/library' }, `Иероглифы · ${HZ.chars.length}`), h('a.tab' + (active === 'words' ? '.on' : ''), { href: '#/words' }, `Слова · ${HZ.words.length}`), h('a.tab' + (active === 'texts' ? '.on' : ''), { href: '#/texts' }, `Тексты · ${HZ.texts.length}`));
  }

  function list() {
    const view = document.getElementById('view');
    const box = h('div.word-list'), count = h('span.muted');
    let shown = 200;
    function draw(reset) {
      if (reset === true) shown = 200;
      const l = HZ.words.filter(matches);
      ui.clear(box).append(...l.slice(0, shown).map(row));
      if (!l.length) box.append(h('p.muted', 'Ничего не найдено'));
      if (l.length > shown) box.append(h('button.btn', { onclick: () => { shown += 300; draw(); } }, `Показать ещё (${l.length - shown})`));
      count.textContent = `${l.length} из ${HZ.words.length}`;
    }
    const sel = (key, opts) => { const s = h('select.input', opts.map(([v, t]) => h('option', { value: v }, t))); s.value = filters[key]; s.onchange = () => { filters[key] = s.value; draw(true); }; return s; };
    const q = h('input.input', { type: 'search', placeholder: 'Поиск: слово, пиньинь, перевод…', value: filters.q });
    q.oninput = () => { filters.q = q.value; draw(true); };
    const fresh = srs.newWordList().length;
    ui.clear(view).append(h('div.page', h('h1', 'Слова'), tabs('words'),
      h('div.row.wrap', h('a.btn.primary', { href: '#/study/words' }, `▶ Учить слова · ${Math.min(fresh, srs.newWordBudget())}`), h('span.muted.small', `Лимит новых слов в день: ${store.s.settings.newWordsPerDay} (в настройках)`)),
      h('div.filters.f3', q, sel('hsk', [['', 'Все HSK'], ['1', 'HSK 1'], ['2', 'HSK 2'], ['3', 'HSK 3']]),
        sel('state', [['', 'Любой статус'], ['new', 'Новые'], ['learn', 'Изучаются'], ['done', 'Выучены']]),
        sel('pos', [['', 'Любая часть речи'], ...Object.entries(POS).filter(([k]) => !['y', 'e'].includes(k))])),
      count, box));
    draw();
  }

  /** Подробная карточка слова (compact — в сессии обучения). */
  function detail(e, opts = {}) {
    const st = stateOf(e);
    const root = h('div.card-detail');
    root.append(h('div.cd-head',
      h('div.big-char.word', { lang: 'zh', style: { fontSize: e.s >= 4 ? '2.6rem' : e.s === 3 ? '3.4rem' : '4.2rem' } }, e.ch),
      h('div.cd-meta',
        h('div.row', ui.py(e.py, 'lg'), ui.speakBtn(e.ch)),
        h('div.cd-mean', e.m),
        h('div.chips', h('span.chip.' + st.cls, st.t), h('span.chip', 'HSK ' + e.h),
          e.pos.filter(p => POS[p]).slice(0, 2).map(p => h('span.chip', POS[p]))))));
    if (e.chars.length) root.append(h('section.cd-sec', h('h4', '🧩 Из каких иероглифов'),
      h('div.comps', e.chars.map(c => {
        const x = HZ.byChar[c];
        return h((x ? 'a' : 'div') + '.comp', x ? { href: '#/char/' + c } : {}, h('span.g', c), h('span.t', x ? x.py + ' — ' + x.m.split(/[;,]/)[0] : ''));
      })),
      e.chars.length > 1 ? h('p.muted.small', e.chars.join(' + ') + ' = ' + e.ch + '. Нажмите на иероглиф, чтобы увидеть его мнемонику.') : null));
    if (e.chars.length > 1) {
      const hints = e.chars.map(c => HZ.byChar[c]).filter(Boolean);
      if (hints.length) root.append(h('section.cd-sec', h('h4', '💡 Подсказки по составу'), h('ul.list', hints.map(x => h('li', h('span.zh', x.ch), ' ', ui.py(x.py), h('span.muted', ' — ' + x.m)))),
        h('p.muted.small', 'Придумайте короткую историю, связав значения иероглифов — так слово запоминается лучше.')));
    }
    if (e.sents.length) root.append(h('section.cd-sec', h('h4', '💬 Пример'), e.sents.map(s =>
      h('div.sent', h('div.zh', s.z, ui.speakBtn(s.z, 'sm')), h('div', ui.py(s.p)), h('div.muted', s.m)))));
    if (!opts.compact) {
      const nt = store.note(e.key);
      const area = h('textarea.input', { rows: 2, placeholder: 'Ваша ассоциация или заметка к слову…', maxlength: 400 }, nt.assoc);
      area.addEventListener('input', () => { nt.assoc = area.value; store.save(); });
      area.addEventListener('blur', () => HZ.gami.check());
      root.append(h('section.cd-sec', h('h4', '✍️ Моя ассоциация'), area));
      const c = srs.get(e.key);
      const stat = h('section.cd-sec', h('h4', '📊 Ваш прогресс'));
      if (c) stat.append(h('div.chips', h('span.chip', `Верно: ${c.ok}`), h('span.chip', `Ошибок: ${c.bad}`),
        h('span.chip', c.st === 'review' ? `Интервал: ${srs.fmtDays(c.ivl)}` : 'Идёт обучение'),
        c.st === 'review' ? h('span.chip', 'Повтор: ' + new Date(c.due).toLocaleDateString('ru-RU')) : null));
      else {
        stat.append(h('p.muted', 'Слово ещё не изучалось.'), h('div.row.wrap',
          h('button.btn.primary', { onclick: () => { srs.create(e.key); store.save(); ui.toast('Добавлено в изучение'); HZ.router.render(); } }, '＋ Начать изучать'),
          h('button.btn', { onclick: () => { srs.markKnown(e.key); ui.toast('Отмечено как известное'); HZ.router.render(); } }, 'Уже знаю')));
      }
      root.append(stat);
    } else {
      const nt = store.s.notes[e.key];
      if (nt && nt.assoc) root.append(h('section.cd-sec', h('h4', '✍️ Моя ассоциация'), h('p.mnemonic.mine', nt.assoc)));
    }
    return root;
  }

  function page(w) {
    const view = document.getElementById('view');
    const e = HZ.wordByKey['w:' + w];
    if (!e) { ui.clear(view).append(h('div.empty', h('h2', 'Слово не найдено'), h('a.btn', { href: '#/words' }, 'К списку'))); return; }
    const i = HZ.words.indexOf(e), prev = HZ.words[i - 1], next = HZ.words[i + 1];
    ui.clear(view).append(h('div.page',
      h('div.row.between', h('a.btn.sm', { href: '#/words' }, '← Все слова'),
        h('div.row', prev ? h('a.btn.sm', { href: '#/word/' + encodeURIComponent(prev.ch) }, '‹ ' + prev.ch) : null, next ? h('a.btn.sm', { href: '#/word/' + encodeURIComponent(next.ch) }, next.ch + ' ›') : null)),
      detail(e)));
  }

  HZ.views.words = list; HZ.views.word = page; HZ.wordDetail = detail; HZ.libTabs = tabs;
})();
