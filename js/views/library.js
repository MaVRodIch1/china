/* Библиотека иероглифов, страница иероглифа, подборки. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs;

  const filters = { q: '', hsk: '', theme: '', state: '', sort: 'order' };

  function matches(e) {
    const q = filters.q.trim().toLowerCase();
    if (q) {
      const hay = (e.ch + ' ' + e.py + ' ' + HZ.baseSyl(e.py) + ' ' + e.m + ' ' + e.r + ' ' + (HZ.radicals[e.r] || '') + ' ' + e.words.map(w => w.w + w.m).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.hsk && String(e.h) !== filters.hsk) return false;
    if (filters.theme && !e.th.includes(filters.theme)) return false;
    if (filters.state) {
      const c = srs.get(e.ch);
      if (filters.state === 'new' && c) return false;
      if (filters.state === 'learn' && (!c || srs.isMastered(c))) return false;
      if (filters.state === 'done' && !srs.isMastered(c)) return false;
      if (filters.state === 'hard' && !srs.isHard(e.ch)) return false;
    }
    return true;
  }

  function tile(e) {
    const st = HZ.card.stateLabel(e.ch);
    return h('a.tile.' + st.cls, { href: '#/char/' + e.ch, title: `${e.py} — ${e.m}` },
      srs.isHard(e.ch) ? h('i.hard-dot', { title: 'Сложный' }) : null,
      h('span.zh', e.ch), h('small.t' + e.tone, e.py), h('small.muted.ellipsis', e.m));
  }

  function library() {
    const view = document.getElementById('view');
    const grid = h('div.tile-grid'), count = h('span.muted');
    function draw() {
      let list = HZ.chars.filter(matches);
      if (filters.sort === 'strokes') list = list.slice().sort((a, b) => a.s - b.s);
      else if (filters.sort === 'py') list = list.slice().sort((a, b) => HZ.baseSyl(a.py).localeCompare(HZ.baseSyl(b.py)));
      else if (filters.sort === 'hard') list = list.slice().sort((a, b) => srs.difficulty(b.ch) - srs.difficulty(a.ch));
      ui.clear(grid).append(...list.map(tile));
      if (!list.length) grid.append(h('p.muted', 'Ничего не найдено'));
      count.textContent = `${list.length} из ${HZ.chars.length}`;
    }
    const sel = (key, opts) => { const s = h('select.input', { 'aria-label': key }, opts.map(([v, t]) => h('option', { value: v }, t))); s.value = filters[key]; s.onchange = () => { filters[key] = s.value; draw(); }; return s; };
    const q = h('input.input', { type: 'search', placeholder: 'Поиск: иероглиф, пиньинь, перевод, ключ…', value: filters.q });
    q.oninput = () => { filters.q = q.value; draw(); };
    ui.clear(view).append(h('div.page',
      h('h1', 'Иероглифы'), HZ.libTabs('chars'),
      h('div.filters', q,
        sel('hsk', [['', 'Все HSK'], ['1', 'HSK 1'], ['2', 'HSK 2'], ['3', 'HSK 3'], ['4', 'Вне HSK']]),
        sel('theme', [['', 'Все темы'], ...Object.entries(HZ.themes)]),
        sel('state', [['', 'Любой статус'], ['new', 'Новые'], ['learn', 'Изучаются'], ['done', 'Выучены'], ['hard', 'Сложные']]),
        sel('sort', [['order', 'По порядку изучения'], ['strokes', 'По числу черт'], ['py', 'По пиньиню'], ['hard', 'По сложности']])),
      count, grid));
    draw();
  }

  function charPage(ch) {
    const view = document.getElementById('view');
    const e = HZ.byChar[ch];
    if (!e) { ui.clear(view).append(h('div.empty', h('h2', 'Иероглиф не найден'), h('a.btn', { href: '#/library' }, 'К списку'))); return; }
    const i = HZ.chars.indexOf(e), prev = HZ.chars[i - 1], next = HZ.chars[i + 1];
    ui.clear(view).append(h('div.page',
      h('div.row.between', h('a.btn.sm', { href: '#/library' }, '← Все иероглифы'),
        h('div.row', prev ? h('a.btn.sm', { href: '#/char/' + prev.ch }, '‹ ' + prev.ch) : null, next ? h('a.btn.sm', { href: '#/char/' + next.ch }, next.ch + ' ›') : null)),
      HZ.card.detail(e)));
  }

  /* ====== Подборки ====== */
  let selectMode = false; const picked = new Set();

  function collections() {
    const view = document.getElementById('view');
    const all = HZ.collections.all();
    const groups = {};
    all.forEach(c => (groups[c.group] = groups[c.group] || []).push(c));
    const order = ['Мои подборки', 'Умные', 'HSK', 'Темы', 'Частотные', 'Количество черт', 'Ключи', 'Похожие'];
    const keys = [...order.filter(k => groups[k]), ...Object.keys(groups).filter(k => !order.includes(k))];

    const card = c => {
      const learned = c.chars.filter(ch => srs.get(ch)).length;
      const pct = c.chars.length ? Math.round(learned / c.chars.length * 100) : 0;
      const body = [h('div.col-ico', c.ico || '📚'), h('b', c.name), h('span.muted.small', `${c.chars.length} ${HZ.plural(c.chars.length, 'иероглиф', 'иероглифа', 'иероглифов')}`),
        h('div.preview.zh', c.chars.slice(0, 6).join('')), h('div.progress.sm', h('i', { style: { width: pct + '%' } }))];
      if (selectMode && c.user) {
        const on = picked.has(c.id);
        return h('button.col-card' + (on ? '.picked' : ''), { type: 'button', onclick: () => { on ? picked.delete(c.id) : picked.add(c.id); collections(); } }, ...body);
      }
      if (selectMode) return h('div.col-card.disabled', ...body);
      return h('a.col-card', { href: '#/collection/' + c.id }, ...body);
    };

    const mergeBar = selectMode ? h('div.row.wrap', h('span.muted', `Выбрано: ${picked.size}. Объединить можно свои подборки.`),
      h('button.btn.primary', { disabled: picked.size < 2, onclick: () => ui.prompt('Объединить подборки', 'Название новой подборки', [...picked].map(id => HZ.collections.get(id).name).join(' + ').slice(0, 40), 'Создать', n => {
        const c = HZ.collections.merge([...picked], n); selectMode = false; picked.clear(); ui.toast('Подборки объединены'); HZ.router.go('#/collection/' + c.id);
      }) }, 'Объединить'),
      h('button.btn', { onclick: () => { selectMode = false; picked.clear(); collections(); } }, 'Отмена')) : null;

    ui.clear(view).append(h('div.page',
      h('div.row.between.wrap', h('h1', 'Подборки'),
        h('div.row', store.s.collections.length >= 2 ? h('button.btn', { onclick: () => { selectMode = true; collections(); } }, '⛓ Объединить') : null,
          h('button.btn.primary', { onclick: () => ui.prompt('Новая подборка', 'Название', '', 'Создать', n => { const c = HZ.collections.create(n); HZ.router.go('#/collection/' + c.id); }) }, '＋ Новая'))),
      mergeBar,
      keys.map(k => h('section', h('h3.group-title', k),
        k === 'Мои подборки' && !groups[k].length ? h('p.muted', 'Пока нет своих подборок.') : null,
        h('div.col-grid', groups[k].map(card)))),
      !groups['Мои подборки'] ? h('section', h('h3.group-title', 'Мои подборки'), h('p.muted', 'Создайте свою подборку кнопкой «Новая» или добавляйте иероглифы из их карточек.')) : null));
  }

  function collectionPage(id) {
    const view = document.getElementById('view');
    const c = HZ.collections.get(id);
    if (!c) { HZ.router.go('#/collections'); return; }
    const fresh = c.chars.filter(srs.isNew).length;
    const acts = h('div.row.wrap',
      h('button.btn.primary', { onclick: () => HZ.router.go('#/study/collection/' + c.id), disabled: !c.chars.length }, fresh ? `▶ Учить (${fresh} нов.)` : '▶ Тренировать'),
      h('button.btn', { disabled: c.chars.length < 4, onclick: () => HZ.games.runQuiz({ title: c.name, types: ['zh2ru', 'ru2zh', 'zh2py'], pool: c.chars.map(x => HZ.byChar[x]), count: 10, kind: 'quiz' }) }, '❓ Викторина'),
      h('button.btn', { disabled: c.chars.length < 4, onclick: () => { store.s.settings.gameSrc = c.id; store.save(); HZ.router.go('#/games'); } }, '🎯 Все игры с этой подборкой'),
      h('button.btn', { disabled: c.chars.length < 5, onclick: () => HZ.games.runMatch(c.chars.map(x => HZ.byChar[x])) }, '🔗 Сопоставление'),
      !c.dynamic ? h('button.btn', { onclick: () => { store.s.settings.newSource = store.s.settings.newSource === c.id ? 'all' : c.id; store.save(); ui.toast(store.s.settings.newSource === c.id ? 'Новые иероглифы берутся из этой подборки' : 'Источник новых: все иероглифы'); collectionPage(id); } },
        store.s.settings.newSource === c.id ? '✓ Источник новых' : '📥 Учить новые отсюда') : null,
      !c.user ? h('button.btn', { onclick: () => ui.prompt('Копия подборки', 'Название', c.name + ' (моя)', 'Создать копию', n => { const k = HZ.collections.create(n, c.chars); ui.toast('Копия создана — её можно редактировать'); HZ.router.go('#/collection/' + k.id); }) }, '⧉ Копировать для редактирования') : null);
    const grid = h('div.tile-grid');
    c.chars.forEach(ch => {
      const e = HZ.byChar[ch]; if (!e) return;
      const t = tile(e);
      if (c.user) { const x = h('button.tile-x', { title: 'Убрать из подборки', onclick: ev => { ev.preventDefault(); ev.stopPropagation(); HZ.collections.removeChar(c.id, ch); collectionPage(id); } }, '✕'); t.appendChild(x); }
      grid.appendChild(t);
    });
    if (!c.chars.length) grid.append(h('p.muted', 'Подборка пуста.'));
    const manage = c.user ? h('div.row.wrap',
      h('button.btn', { onclick: () => addDialog(c) }, '＋ Добавить иероглифы'),
      h('button.btn', { onclick: () => ui.prompt('Переименовать', 'Название', c.name, 'Сохранить', n => { HZ.collections.rename(c.id, n); collectionPage(id); }) }, '✎ Переименовать'),
      h('button.btn.danger', { onclick: () => ui.confirmBox('Удалить подборку?', `«${c.name}» будет удалена. Иероглифы и прогресс останутся.`, 'Удалить', () => { HZ.collections.remove(c.id); HZ.router.go('#/collections'); }, true) }, '🗑 Удалить')) : null;
    ui.clear(view).append(h('div.page', h('a.btn.sm', { href: '#/collections' }, '← Подборки'),
      h('h1', (c.ico || '') + ' ' + c.name), h('p.muted', c.desc + ` · ${c.chars.length} ${HZ.plural(c.chars.length, 'иероглиф', 'иероглифа', 'иероглифов')}`), acts, manage, grid));
  }

  function addDialog(c) {
    const q = h('input.input', { type: 'search', placeholder: 'Найти иероглиф…' });
    const list = h('div.tile-grid.small');
    const draw = () => {
      const s = q.value.trim().toLowerCase();
      ui.clear(list).append(...HZ.chars.filter(e => !s || (e.ch + e.py + HZ.baseSyl(e.py) + e.m).toLowerCase().includes(s)).slice(0, 80).map(e => {
        const has = (HZ.collections.get(c.id).chars).includes(e.ch);
        const b = h('button.tile' + (has ? '.done' : ''), { type: 'button', onclick: () => { HZ.collections.addChars(c.id, [e.ch]); b.classList.add('done'); } },
          h('span.zh', e.ch), h('small.muted.ellipsis', e.m));
        return b;
      }));
    };
    q.oninput = draw; draw();
    ui.modal('Добавить в «' + c.name + '»', h('div', q, list), [{ label: 'Готово', primary: true, onclick: () => { collectionPage(c.id); } }]);
  }

  HZ.views.library = library; HZ.views.char = charPage; HZ.views.collections = collections; HZ.views.collection = collectionPage;
  HZ.tile = tile;
})();
