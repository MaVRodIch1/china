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
      h('span.zh.w', e.ch), h('span.wp', ui.py(e.py)), h('span.wm.muted', e.m), h('span.chip.sm' + (e.custom ? '.new' : ''), e.custom ? 'моё' : 'HSK ' + e.h));
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
      h('div.filters.f3', q, sel('hsk', [['', 'Все HSK'], ['1', 'HSK 1'], ['2', 'HSK 2'], ['3', 'HSK 3'], ['0', 'Мои слова']]),
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
        h('div.chips', h('span.chip.' + st.cls, st.t), h('span.chip' + (e.custom ? '.new' : ''), e.custom ? 'моё слово' : 'HSK ' + e.h),
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
    const my = e.my || [];
    if (my.length || !opts.compact) root.append(h('section.cd-sec', h('h4', '📝 Мои примеры'),
      my.length ? my.map(s => h('div.sent', h('div.zh', s.z, ui.speakBtn(s.z, 'sm')), s.p ? h('div', ui.py(s.p)) : null, s.m ? h('div.muted', s.m) : null)) : h('p.muted.small', 'Добавьте свои предложения с этим словом — они появятся и в играх с предложениями.'),
      !opts.compact ? h('div.row.wrap', h('button.btn.sm', { onclick: () => wordUI.examples(e.key, () => HZ.router.render()) }, '＋ Добавить пример'),
        e.custom ? h('button.btn.sm', { onclick: () => wordUI.editWord(e.key) }, '✎ Изменить слово') : null) : null));
    if (!opts.compact) root.append(h('section.cd-sec', h('h4', '🗂 В подборку'), toCollection(e)));
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

  /* ====== Свои слова, примеры, добавление в подборку ====== */
  const firstGloss = m => (m || '').split(/[;,(]/)[0].trim();
  const HANRE = /[一-鿿]/;

  function toCollection(e) {
    const mine = store.s.collections;
    const box = h('div.row.wrap');
    const inCols = mine.filter(c => (c.words || []).includes(e.key));
    if (inCols.length) box.append(h('span.muted.small', 'Уже в: '), ...inCols.map(c => h('a.chip.link', { href: '#/collection/' + c.id }, '⭐ ' + c.name)));
    const others = mine.filter(c => !(c.words || []).includes(e.key));
    if (others.length) {
      const sel = h('select.input', others.map(c => h('option', { value: c.id }, c.name)));
      box.append(sel, h('button.btn.sm', { onclick: () => { HZ.collections.addWords(sel.value, [e.key]); ui.toast('Добавлено в подборку'); HZ.router.render(); } }, '＋ Добавить'));
    }
    box.append(h('button.btn.sm', { onclick: () => ui.prompt('Новая подборка', 'Название', '', 'Создать', n => { const c = HZ.collections.create(n, [], [e.key]); ui.toast('Подборка создана'); HZ.router.go('#/collection/' + c.id); }) }, '＋ Новая подборка с этим словом'));
    return box;
  }

  /** Окно со своими примерами к слову: список + форма (пиньинь подставляется сам, можно цифрами). */
  function examples(key, onDone) {
    const e = HZ.wordByKey[key]; if (!e) return;
    const list = h('div.ex-list');
    const drawList = () => {
      ui.clear(list);
      const ex = (store.s.myWords[key] || {}).ex || [];
      if (!ex.length) list.append(h('p.muted.small', 'Своих примеров пока нет.'));
      ex.forEach(x => list.append(h('div.ex-row',
        h('div.ex-t', h('div', h('span.zh', x.z), ' ', ui.speakBtn(x.z, 'sm')), x.p ? h('div', ui.py(x.p)) : null, x.m ? h('div.muted', x.m) : null),
        h('button.btn.sm', { type: 'button', title: 'Удалить', onclick: () => { HZ.collections.removeExample(key, x.id); drawList(); if (onDone) onDone(); } }, '🗑'))));
    };
    const z = h('textarea.input', { rows: 2, placeholder: `Предложение со словом ${e.ch}…` });
    const p = h('input.input', { placeholder: 'Пиньинь: подставится сам, можно исправить (и цифрами: wo3 ai4 ni3)' });
    const m = h('input.input', { placeholder: 'Перевод на русский' });
    const pPrev = h('div.py-prev'), warn = h('div.small.warn-text');
    let touched = false;
    const upd = () => {
      ui.clear(pPrev).append(p.value ? ui.py(HZ.pyNum(p.value), 'lg') : '');
      warn.textContent = p.value.includes('?') ? '⚠ Для некоторых знаков нет чтения в словаре — замените «?» на пиньинь.' : z.value.trim() && !z.value.includes(e.ch) ? `⚠ В примере нет слова «${e.ch}» — так тоже можно, но лучше с ним.` : '';
    };
    z.oninput = () => { if (!touched) p.value = HZ.autoPy(z.value); upd(); };
    p.oninput = () => { touched = true; upd(); };
    drawList();
    ui.modal('Примеры: ' + e.ch, h('div.ex-dialog', h('div.ex-head', h('b.zh', e.ch), ' ', ui.py(e.py || ''), h('span.muted', ' — ' + (e.m || ''))), list,
      h('h4', 'Новый пример'), z, p, pPrev, m, warn), [
      { label: 'Закрыть', onclick: () => { if (onDone) onDone(); } },
      { label: '＋ Сохранить пример', primary: true, onclick: () => {
        if (!z.value.trim()) { z.focus(); return false; }
        HZ.collections.addExample(key, z.value, p.value, m.value);
        z.value = ''; p.value = ''; m.value = ''; touched = false; upd(); drawList();
        ui.toast('Пример сохранён ✓'); if (onDone) onDone();
        return false;
      } }]);
  }

  function editWord(key) {
    const e = HZ.wordByKey[key]; if (!e || !e.custom) return;
    const p = h('input.input', { value: e.py, placeholder: 'пиньинь (можно цифрами)' }), m = h('input.input', { value: e.m, placeholder: 'перевод' });
    const pPrev = h('div.py-prev'); const upd = () => ui.clear(pPrev).append(ui.py(HZ.pyNum(p.value), 'lg')); p.oninput = upd; upd();
    ui.modal('Своё слово: ' + e.ch, h('div.ex-dialog', h('label.field', h('span', 'Пиньинь'), p), pPrev, h('label.field', h('span', 'Перевод'), m)), [
      { label: '🗑 Удалить слово', danger: true, onclick: () => { ui.confirmBox('Удалить слово?', `«${e.ch}» и его примеры будут удалены из всех подборок.`, 'Удалить', () => { HZ.collections.deleteWord(key); HZ.router.go('#/words'); }, true); } },
      { label: 'Сохранить', primary: true, onclick: () => { if (!m.value.trim()) { m.focus(); return false; } HZ.collections.saveWord(e.ch, p.value, m.value); ui.toast('Сохранено'); HZ.router.render(); } }]);
  }

  /** Добавление целых слов и фраз в свою подборку: из базы — сразу, новые — с пиньинем, переводом и примером. */
  function addWords(colId, onDone) {
    const ta = h('textarea.input', { rows: 3, placeholder: 'Например: 你好 朋友 打篮球 一路平安' });
    const prev = h('div.aw-prev');
    const forms = new Map();
    let items = [], timer = null;
    function parse() {
      const toks = [...new Set(ta.value.split(/[\s,，、;；。.!?！？]+/).map(x => x.trim()).filter(Boolean))];
      items = toks.map(t => {
        const zh = [...t].filter(c => HANRE.test(c)).join('');
        if (!zh) return { t, kind: 'bad' };
        const e = HZ.wordByKey['w:' + zh];
        if ([...zh].length === 1 && HZ.byChar[zh]) return { t: zh, kind: 'char', e: HZ.byChar[zh] };
        if (e) return { t: zh, kind: 'word', e };
        return { t: zh, kind: 'new' };
      });
      ui.clear(prev).append(...items.map(row));
      if (!items.length) prev.append(h('p.muted.small', 'Здесь появится разбор: что уже есть в базе, а что нужно заполнить.'));
    }
    function row(it) {
      if (it.kind === 'bad') return h('div.aw-row.bad', h('b', it.t), h('span.muted', ' — не китайский текст, пропущу'));
      if (it.kind !== 'new') return h('div.aw-row.ok', '✓ ', h('b.zh', it.t), ' ', ui.py(it.e.py), h('span.muted', ' — ' + firstGloss(it.e.m) + ' '), h('span.chip.sm', it.kind === 'char' ? 'иероглиф' : it.e.custom ? 'моё слово' : 'слово HSK ' + it.e.h));
      let f = forms.get(it.t);
      if (!f) {
        const auto = HZ.autoPy(it.t);
        f = { py: h('input.input', { value: auto ? auto[0].toLowerCase() + auto.slice(1) : '', placeholder: 'пиньинь: ni3 hao3 или nǐ hǎo' }),
          m: h('input.input', { placeholder: 'перевод (обязательно)' }),
          ez: h('input.input', { placeholder: 'свой пример на китайском (необязательно)' }),
          em: h('input.input', { placeholder: 'перевод примера' }), pv: h('div.py-prev') };
        const upd = () => ui.clear(f.pv).append(f.py.value ? ui.py(HZ.pyNum(f.py.value)) : '', f.py.value.includes('?') ? h('span.warn-text', ' ⚠ замените «?»') : '');
        f.py.oninput = upd; upd();
        forms.set(it.t, f);
      }
      return h('div.aw-row.new', h('div', '✎ ', h('b.zh', it.t), ' ', h('span.chip.sm.new', 'нет в базе — заполните')), h('div.aw-grid', h('div', f.py, f.pv), f.m, f.ez, f.em));
    }
    ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(parse, 250); });
    parse();
    ui.modal('Добавить слова и фразы', h('div.aw-dialog', h('p.muted.small', 'Впишите слова через пробел, запятую или с новой строки. Слова из базы добавятся сразу; для своих укажите пиньинь и перевод, можно сразу дать пример. Примеры можно добавлять и позже кнопкой «💬 Примеры».'), ta, prev), [
      { label: 'Отмена' },
      { label: 'Добавить', primary: true, onclick: () => {
        parse();
        const keys = [], chars = [];
        for (const it of items) {
          if (it.kind === 'word') keys.push(it.e.key);
          else if (it.kind === 'char') chars.push(it.t);
          else if (it.kind === 'new') {
            const f = forms.get(it.t);
            if (!f.m.value.trim()) { f.m.classList.add('err'); f.m.focus(); ui.toast(`Укажите перевод для «${it.t}»`, 'warn'); return false; }
          }
        }
        items.filter(it => it.kind === 'new').forEach(it => {
          const f = forms.get(it.t);
          const k = HZ.collections.saveWord(it.t, f.py.value, f.m.value);
          if (f.ez.value.trim()) HZ.collections.addExample(k, f.ez.value, HZ.autoPy(f.ez.value), f.em.value);
          keys.push(k);
        });
        if (!keys.length && !chars.length) { ui.toast('Нечего добавлять'); return false; }
        HZ.collections.addWords(colId, keys); HZ.collections.addChars(colId, chars);
        ui.toast(`Добавлено: ${keys.length} ${HZ.plural(keys.length, 'слово', 'слова', 'слов')}${chars.length ? `, ${chars.length} ${HZ.plural(chars.length, 'иероглиф', 'иероглифа', 'иероглифов')}` : ''}`);
        if (onDone) onDone();
      } }]);
  }

  const wordUI = { examples, editWord, addWords, toCollection };
  HZ.wordUI = wordUI;
  HZ.views.words = list; HZ.views.word = page; HZ.wordDetail = detail; HZ.libTabs = tabs;
})();
