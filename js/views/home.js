/* Главный экран, статистика, настройки. */
(function () {
  'use strict';
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs;

  /* ---- персональные рекомендации ---- */
  function recommendations() {
    const out = [];
    const due = srs.dueList().length, budget = srs.newBudget(), avail = srs.newList(1).length;
    const hard = srs.hardList();
    const st = HZ.gami.streakNow();
    if (!Object.keys(store.s.cards).length) out.push({ ico: '👋', text: 'Начните с пиктограмм: 人, 口, 日, 月, 山, 水 — они рисуют сам предмет и запоминаются легче всего.', btn: 'Первые иероглифы', go: '#/study/new' });
    if (st > 0 && !HZ.gami.activeToday()) out.push({ ico: '🔥', text: `Ваша серия — ${st} ${HZ.plural(st, 'день', 'дня', 'дней')}. Позанимайтесь сегодня, чтобы не потерять её!`, btn: due ? 'Повторить' : 'Учить', go: due ? '#/study/review' : '#/study/new' });
    const tones = HZ.collections.weakTones();
    if (tones.length) out.push({ ico: '🎵', text: `Слабое место: ${tones[0].tone}-й тон — верно только ${Math.round(tones[0].acc * 100)}% ответов. Потренируйте его.`, btn: 'Тренировать', go: '#/collection/smart-tone' });
    const rads = HZ.collections.weakRadicals();
    if (rads.length) out.push({ ico: '🔍', text: `Часто ошибаетесь в иероглифах с ключом ${rads[0].r} (${HZ.radicals[rads[0].r] || ''}): ${Math.round(rads[0].acc * 100)}% верных.`, btn: 'Разобрать', go: '#/collection/smart-rad' });
    if (hard.length >= 3) out.push({ ico: '🧩', text: `${hard.length} ${HZ.plural(hard.length, 'иероглиф', 'иероглифа', 'иероглифов')} запоминаются хуже остальных. Придумайте для них свои образы и потренируйтесь.`, btn: 'Тренировать сложные', go: '#/study/hard' });
    // адаптация темпа
    const days = Object.keys(store.s.log).sort().slice(-7).map(k => store.s.log[k]);
    const rev = days.reduce((a, d) => a + d.rev, 0), ok = days.reduce((a, d) => a + d.ok, 0);
    if (rev >= 30) {
      const acc = ok / rev, n = store.s.settings.newPerDay;
      if (acc < 0.7 && n > 3) out.push({ ico: '🐢', text: `Точность за неделю ${Math.round(acc * 100)}% — материал даётся трудно. Рекомендуем снизить темп до ${Math.max(3, n - 2)} новых в день.`, btn: 'Снизить темп', act: () => { store.s.settings.newPerDay = Math.max(3, n - 2); store.save(); ui.toast('Темп изменён'); HZ.router.render(); } });
      else if (acc > 0.92 && n < 20) out.push({ ico: '🚀', text: `Точность за неделю ${Math.round(acc * 100)}% — отлично! Можно ускориться до ${n + 2} новых в день.`, btn: 'Ускориться', act: () => { store.s.settings.newPerDay = n + 2; store.save(); ui.toast('Темп изменён'); HZ.router.render(); } });
    }
    if (budget && avail && !due) out.push({ ico: '✨', text: `Сегодня можно выучить ещё ${Math.min(budget, avail)} ${HZ.plural(Math.min(budget, avail), 'иероглиф', 'иероглифа', 'иероглифов')}.`, btn: 'Учить новые', go: '#/study/new' });
    if (!store.s.settings.onboarded && Object.keys(store.s.cards).length < 3) out.push({ ico: '🎓', text: 'Уже знаете часть иероглифов? Пройдите короткий тест — приложение отметит известные и подберёт темп.', btn: 'Пройти тест', act: () => HZ.games.placement() });
    return out.slice(0, 4);
  }

  function ring(pct, label, sub) {
    const r = 46, c = 2 * Math.PI * r;
    return h('div.ring', { html: `<svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r="${r}" class="rb"/><circle cx="55" cy="55" r="${r}" class="rf" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 55 55)"/></svg>` },
      h('div.ring-in', h('b', label), h('span', sub)));
  }

  function home() {
    const view = document.getElementById('view');
    const cnt = srs.counts();
    const due = srs.dueList().length, budget = srs.newBudget(), avail = Math.min(budget, srs.newList().length);
    const hard = srs.hardList().length;
    const wc = srs.wordCounts(), wAvail = Math.min(srs.newWordBudget(), srs.newWordList().length);
    const li = HZ.gami.levelInfo(), st = HZ.gami.streakNow();
    const t = store.today();
    const quests = HZ.gami.questsToday();
    const started = cnt.learned + cnt.learning;
    const recs = recommendations();

    // 7 дней
    const week = [];
    for (let i = 6; i >= 0; i--) { const d = HZ.addDays(new Date(), -i); week.push({ d, v: (store.s.log[HZ.dayKey(d)] || {}).rev || 0 }); }
    const maxW = Math.max(5, ...week.map(x => x.v));

    ui.clear(view).append(h('div.page.home',
      h('section.hero',
        h('div', h('h1', started ? 'Добро пожаловать обратно!' : 'Давайте учить иероглифы'),
          h('p.muted', due ? `Сегодня к повторению: ${due}. Примерно ${Math.max(1, Math.round(due * 0.4))} мин.` : avail ? 'Повторений нет — можно учить новое.' : 'На сегодня всё! Загляните в игры.')),
        h('div.hero-actions',
          h('a.btn.primary.lg', { href: due ? '#/study/review' : '#/study/new' }, due ? `Повторить · ${due}` : avail ? `Учить новые · ${avail}` : 'Играть'),
          due && avail ? h('a.btn.lg', { href: '#/study/new' }, `Новые · ${avail}`) : null)),

      h('div.stat-cards',
        h('a.stat-card', { href: '#/study/review' }, h('span.ico', '🔁'), h('b', due), h('span', 'повторить сегодня')),
        h('a.stat-card', { href: '#/study/new' }, h('span.ico', '✨'), h('b', avail), h('span', 'новых на сегодня')),
        h('a.stat-card', { href: '#/stats' }, h('span.ico', '🔥'), h('b', st), h('span', HZ.plural(st, 'день подряд', 'дня подряд', 'дней подряд'))),
        h('a.stat-card', { href: '#/stats' }, h('span.ico', '🏅'), h('b', 'Ур. ' + li.lvl), h('span', li.title + ` · ${li.into}/${li.need} XP`))),

      h('div.grid2',
        h('section.panel', h('h3', 'Прогресс обучения'),
          h('div.progress-wrap', ring(cnt.total ? (cnt.learned + cnt.learning * 0.4) / cnt.total : 0, Math.round((cnt.learned + cnt.learning) / cnt.total * 100) + '%', 'начато'),
            h('ul.legend',
              h('li', h('i.dot.done'), h('b', cnt.learned), ' выучено'),
              h('li', h('i.dot.learn'), h('b', cnt.learning), ' в процессе'),
              h('li', h('i.dot.new'), h('b', cnt.fresh), ' новых'),
              h('li', h('i.dot.hard'), h('b', hard), ' сложных'))),
          h('div.stacked', h('i.done', { style: { flex: cnt.learned } }), h('i.learn', { style: { flex: cnt.learning } }), h('i.new', { style: { flex: cnt.fresh } })),
          h('div.week', week.map(w => h('div.wday', h('i', { style: { height: Math.max(4, w.v / maxW * 44) + 'px' }, title: `${w.v} повторений` }), h('small', WD[w.d.getDay()])))),
          h('p.muted.small', `Сегодня: повторений ${t.rev}, новых ${t.newc}, XP ${t.xp}`)),

        h('section.panel', h('h3', 'Задания на сегодня'),
          h('ul.quests', quests.map(q => h('li' + (q.done ? '.done' : ''),
            h('span.q-check', q.done ? '✓' : ''), h('div.q-main', h('span', q.text), h('div.progress.sm', h('i', { style: { width: Math.round(q.val / q.target * 100) + '%' } }))),
            h('small', q.done ? 'готово' : `${q.val}/${q.target} · +${q.xp} XP`)))))),

      h('section.panel', h('h3', '📘 Слова HSK'),
        h('div.row.between.wrap', h('div', h('b', wc.learned + wc.learning), ` из ${wc.total} начато · выучено ${wc.learned}`,
          h('div.stacked.mt', h('i.done', { style: { flex: wc.learned } }), h('i.learning', { style: { flex: wc.learning } }), h('i.new', { style: { flex: wc.fresh } }))),
          h('div.row.wrap', wAvail ? h('a.btn.primary', { href: '#/study/words' }, `Учить слова · ${wAvail}`) : h('span.muted', 'Лимит слов на сегодня выбран'), h('a.btn', { href: '#/words' }, 'Все слова')))),

      recs.length ? h('section.panel', h('h3', 'Рекомендации для вас'), h('ul.recs', recs.map(r => h('li', h('span.r-ico', r.ico), h('span.r-text', r.text),
        r.go ? h('a.btn.sm', { href: r.go }, r.btn) : h('button.btn.sm', { onclick: r.act }, r.btn))))) : null,

      h('section.panel', h('h3', 'Быстрый старт'), h('div.quick',
        h('a.btn', { href: '#/games' }, '🎮 Игры'), h('a.btn', { href: '#/texts' }, '📖 Чтение'), h('a.btn', { href: '#/collections' }, '🗂️ Подборки'), h('a.btn', { href: '#/library' }, '🔎 Все иероглифы'),
        hard ? h('a.btn', { href: '#/study/hard' }, '🧩 Сложные · ' + hard) : null))));
  }

  /* ====== Статистика ====== */
  function stats() {
    const view = document.getElementById('view');
    const cnt = srs.counts(), li = HZ.gami.levelInfo();
    let revs = 0, oks = 0, games = 0;
    Object.values(store.s.log).forEach(l => { revs += l.rev; oks += l.ok; games += l.games; });
    // 14 дней
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = HZ.addDays(new Date(), -i); const l = store.s.log[HZ.dayKey(d)] || { rev: 0, ok: 0 }; days.push({ d, rev: l.rev, ok: l.ok }); }
    const mx = Math.max(5, ...days.map(x => x.rev));
    const W = 560, H = 140, bw = W / days.length;
    const bars = days.map((x, i) => {
      const bh = x.rev / mx * (H - 30), oh = x.ok / mx * (H - 30);
      return `<g><rect x="${i * bw + 6}" y="${H - 20 - bh}" width="${bw - 12}" height="${bh}" rx="4" class="b-bad"/><rect x="${i * bw + 6}" y="${H - 20 - oh}" width="${bw - 12}" height="${oh}" rx="4" class="b-ok"/><text x="${i * bw + bw / 2}" y="${H - 5}" text-anchor="middle">${x.d.getDate()}</text></g>`;
    }).join('');
    const fc = srs.forecast(7);
    const fmx = Math.max(3, ...fc);
    const names = ['Сегодня', 'Завтра'];
    // уровни HSK
    const hskRows = [1, 2, 3, 4, 5].map(lv => {
      const cs = HZ.chars.filter(c => c.h === lv); if (!cs.length) return null;
      const m = cs.filter(c => srs.isMastered(srs.get(c.ch))).length, s = cs.filter(c => srs.get(c.ch)).length;
      return h('div.hsk-row', h('span', 'HSK ' + lv), h('div.stacked.sm', h('i.done', { style: { flex: m } }), h('i.learn', { style: { flex: s - m } }), h('i.new', { style: { flex: cs.length - s } })), h('small', `${m}/${cs.length}`));
    }).filter(Boolean);
    // слова по уровням
    const wRows = [1, 2, 3, 4, 5].map(lv => {
      const ws = HZ.words.filter(w => w.h === lv);
      const m = ws.filter(w => srs.isMastered(srs.get(w.key))).length, s = ws.filter(w => srs.get(w.key)).length;
      return h('div.hsk-row', h('span', 'HSK ' + lv), h('div.stacked.sm', h('i.done', { style: { flex: m } }), h('i.learn', { style: { flex: s - m } }), h('i.new', { style: { flex: ws.length - s } })), h('small', `${m}/${ws.length}`));
    });
    // тоны
    const toneRows = [1, 2, 3, 4].map(tn => {
      let ok = 0, bad = 0; HZ.chars.forEach(c => { const k = srs.get(c.ch); if (k && c.tone === tn) { ok += k.ok; bad += k.bad; } });
      const t = ok + bad; return h('div.hsk-row', h('span.t' + tn, tn + '-й тон'), h('div.progress.sm', h('i', { style: { width: (t ? ok / t * 100 : 0) + '%' } })), h('small', t ? Math.round(ok / t * 100) + '%' : '—'));
    });
    const hardTop = srs.hardList().slice(0, 10);
    const ach = HZ.gami.ACHIEVEMENTS;

    ui.clear(view).append(h('div.page',
      h('h1', 'Статистика'),
      h('div.stat-cards',
        h('div.stat-card', h('span.ico', '⭐'), h('b', store.s.xp), h('span', `XP · ур. ${li.lvl} «${li.title}»`)),
        h('div.stat-card', h('span.ico', '🔥'), h('b', HZ.gami.streakNow()), h('span', `серия · рекорд ${store.s.streak.best}`)),
        h('div.stat-card', h('span.ico', '🎯'), h('b', revs ? Math.round(oks / revs * 100) + '%' : '—'), h('span', `точность · ${revs} повторений`)),
        h('div.stat-card', h('span.ico', '🧠'), h('b', cnt.learned), h('span', `выучено из ${cnt.total}`))),
      h('section.panel', h('h3', 'Повторения за 14 дней'), h('svg.chart', { viewBox: `0 0 ${W} ${H}`, html: bars, role: 'img', 'aria-label': 'График повторений' }), h('p.muted.small', 'Яркие столбцы — верные ответы, бледные — все повторения.')),
      h('div.grid2',
        h('section.panel', h('h3', 'Прогноз повторений'), h('div.week', fc.map((v, i) => h('div.wday', h('b.small', v), h('i', { style: { height: Math.max(4, v / fmx * 44) + 'px' } }), h('small', i < 2 ? names[i] : WD[HZ.addDays(new Date(), i).getDay()]))))),
        h('section.panel', h('h3', 'Иероглифы по уровням HSK'), hskRows, h('h3.mt', 'Слова по уровням HSK'), wRows)),
      h('div.grid2',
        h('section.panel', h('h3', 'Точность по тонам'), toneRows, h('p.muted.small', 'Тон первого слога иероглифа.')),
        h('section.panel', h('h3', 'Хуже всего запоминаются'), hardTop.length ? h('div.mini-grid', hardTop.map(ch => h('a.mini', { href: '#/char/' + ch, title: HZ.byChar[ch].m }, ch))) : h('p.muted', 'Пока нет данных — отлично!'),
          hardTop.length ? h('a.btn.sm.mt', { href: '#/study/hard' }, 'Тренировать') : null)),
      h('section.panel', h('h3', `Достижения · ${Object.keys(store.s.ach).length}/${ach.length}`),
        h('div.ach-grid', ach.map(a => h('div.ach' + (store.s.ach[a.id] ? '.on' : ''), { title: a.desc }, h('span.ico', a.ico), h('b', a.name), h('small.muted', a.desc)))))));
  }

  /* ====== Настройки ====== */
  function settings() {
    const view = document.getElementById('view');
    const s = store.s.settings;
    const row = (label, ctrl, hint) => h('div.set-row', h('div', h('b', label), hint ? h('p.muted.small', hint) : null), ctrl);
    const sel = (key, opts, after) => { const e = h('select.input', opts.map(([v, t]) => h('option', { value: v }, t))); e.value = String(s[key]); e.onchange = () => { s[key] = typeof s[key] === 'number' ? +e.value : e.value; store.save(); after && after(); }; return e; };
    const toggle = key => { const c = h('input', { type: 'checkbox' }); c.checked = !!s[key]; c.onchange = () => { s[key] = c.checked; store.save(); }; return h('label.switch', c, h('i')); };
    const cols = HZ.collections.all().filter(c => !c.dynamic);
    const file = h('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
    file.onchange = () => {
      const f = file.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { try { store.importJSON(r.result); ui.toast('Прогресс загружен ✓'); applyTheme(); HZ.gami.refreshHeader(); HZ.router.render(); } catch (e) { ui.toast('Не удалось прочитать файл: ' + e.message, 'warn', 4000); } };
      r.readAsText(f);
    };
    ui.clear(view).append(h('div.page.narrow',
      h('h1', 'Настройки'),
      cloudPanel(),
      h('section.panel',
        row('Тема', sel('theme', [['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']], applyTheme)),
        row('Новых иероглифов в день', sel('newPerDay', [1, 2, 3, 5, 7, 10, 15, 20, 30].map(n => [n, String(n)])), 'Чем больше — тем больше повторений в ближайшие дни.'),
        row('Новых слов в день', sel('newWordsPerDay', [0, 1, 2, 3, 5, 7, 10, 15, 20].map(n => [n, String(n)])), 'Слова учатся отдельно от иероглифов; 0 — не вводить новые слова.'),
        row('Откуда брать новые иероглифы', sel('newSource', [['all', 'Все иероглифы по порядку'], ...cols.map(c => [c.id, c.name])])),
        row('Режим повторения', sel('reviewStyle', [['flip', 'Карточки: вспомнить и оценить'], ['choice', 'Выбор ответа (авто-оценка)']]), 'В режиме выбора оценка ставится автоматически по ответу и скорости.')),
      h('section.panel',
        row('Звуковые эффекты', toggle('sfx')),
        row('Скорость озвучки', sel('rate', [[0.6, 'Медленно'], [0.8, 'Обычно'], [1, 'Быстро']], () => ui.speak('你好')), 'Используется китайский голос вашей системы (zh-CN).'),
        row('Проверить озвучку', h('button.btn', { onclick: () => ui.speak('你好，欢迎！') }, '🔊 你好'))),
      h('section.panel', h('h3', 'Данные'),
        row('Экспорт прогресса', h('button.btn', { onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([store.exportJSON()], { type: 'application/json' })), download: `hanzi-progress-${HZ.dayKey()}.json` }); a.click(); } }, '⬇ Скачать'), 'Резервная копия: перенос на другое устройство.'),
        row('Импорт прогресса', h('button.btn', { onclick: () => file.click() }, '⬆ Загрузить'), 'Заменит текущий прогресс.'), file,
        row('Тест уровня', h('button.btn', { onclick: () => HZ.games.placement() }, 'Пройти')),
        row('Сбросить всё', h('button.btn.danger', { onclick: () => ui.confirmBox('Сбросить весь прогресс?', 'Будут удалены карточки, заметки, подборки и достижения. Это нельзя отменить.', 'Сбросить', () => { HZ.sync.wipe(); store.reset(); applyTheme(); HZ.gami.refreshHeader(); HZ.router.go('#/'); ui.toast('Прогресс сброшен'); }, true) }, 'Сбросить'))),
      h('section.panel', h('h3', 'О приложении'),
        h('p.muted', 'Прогресс хранится только в вашем браузере (localStorage). Новые наборы иероглифов добавляются файлом с HZ.addPack(...) — см. README.'),
        h('p.muted.small', `Иероглифов в базе: ${HZ.chars.length}. Порядок черт — Hanzi Writer (нужен интернет).`))));
  }

  function cloudPanel() {
    const sy = HZ.sync, h2 = h;
    if (!sy.enabled) return h2('section.panel', h2('h3', '☁️ Облако'), h2('p.muted', 'Синхронизация между устройствами выключена: в js/config.js не заданы ключи Supabase (инструкция — в README).'));
    const msg = { idle: 'Не выполнен вход', syncing: 'Синхронизация…', ok: sy.lastSync ? 'Синхронизировано в ' + new Date(sy.lastSync).toLocaleTimeString('ru-RU') : 'Подключено', error: 'Ошибка: ' + sy.error }[sy.status] || '';
    const box = h2('section.panel', h2('h3', '☁️ Облако'), h2('p' + (sy.status === 'error' ? '.gold-text' : '.muted'), msg));
    if (sy.user) {
      box.append(h2('p', 'Вы вошли как ', h2('b', sy.user.email || '')),
        h2('div.row.wrap', h2('button.btn', { onclick: () => sy.syncNow() }, '🔄 Синхронизировать'), h2('button.btn', { onclick: () => sy.signOut().then(() => ui.toast('Вы вышли')) }, 'Выйти')),
        h2('p.muted.small', 'Прогресс сохраняется в облако автоматически. Настройки (тема, темп) остаются локальными.'));
    } else {
      const email = h2('input.input', { type: 'email', placeholder: 'ваша@почта.com', autocomplete: 'email' });
      const btn = h2('button.btn.primary', { onclick: async () => {
        const v = email.value.trim(); if (!/^\S+@\S+\.\S+$/.test(v)) { ui.toast('Введите корректный email', 'warn'); return; }
        btn.disabled = true;
        try { await sy.signIn(v); ui.toast('Ссылка для входа отправлена на ' + v + ' ✉️', '', 5000); } catch (e) { ui.toast('Не удалось отправить: ' + (e.message || e), 'warn', 5000); } finally { btn.disabled = false; }
      } }, 'Войти по ссылке');
      box.append(h2('p.muted', 'Войдите, чтобы сохранять прогресс в облаке и продолжать на любом устройстве. Мы отправим ссылку для входа — пароль не нужен.'), h2('div.row.wrap', email, btn));
    }
    return box;
  }

  function applyTheme() {
    const t = store.s.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#16161a' : '#faf7f2';
  }

  HZ.applyTheme = applyTheme;
  HZ.views.home = home; HZ.views.stats = stats; HZ.views.settings = settings;
})();
