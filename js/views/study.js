/* Сессия обучения: новые иероглифы, повторение, сложные, подборка. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs;

  /** mode: 'review' | 'new' | 'hard' | 'collection' ; arg — id подборки */
  function start(mode, arg) {
    const view = document.getElementById('view');
    const s = store.s.settings;
    let queue = [], cram = false, title = '';
    if (mode === 'review') {
      title = 'Повторение';
      queue = srs.dueList(60).map(ch => ({ ch, kind: 'rev' }));
    } else if (mode === 'new') {
      title = 'Новые иероглифы';
      queue = srs.newList(srs.newBudget()).map(ch => ({ ch, kind: 'intro' }));
    } else if (mode === 'hard') {
      title = 'Сложные иероглифы'; cram = true;
      queue = HZ.shuffle(srs.hardList().slice(0, 20)).map(ch => ({ ch, kind: 'rev' }));
    } else if (mode === 'collection') {
      const col = HZ.getCollection(arg);
      title = col ? col.name : 'Подборка';
      if (!col) return HZ.router.go('#/collections');
      const fresh = col.chars.filter(srs.isNew).slice(0, Math.max(0, srs.newBudget()));
      const known = col.chars.filter(c => !srs.isNew(c));
      cram = true;
      queue = [...fresh.map(ch => ({ ch, kind: 'intro' })), ...HZ.shuffle(known).slice(0, 30).map(ch => ({ ch, kind: 'rev' }))];
    }
    if (!queue.length) {
      ui.clear(view).append(h('div.empty',
        h('div.big', '🎉'), h('h2', 'Здесь пока пусто'),
        h('p.muted', mode === 'new' ? 'Дневной лимит новых иероглифов исчерпан или все иероглифы уже начаты. Лимит можно изменить в настройках.' :
          mode === 'hard' ? 'Сложных иероглифов пока нет — отличная память!' : 'Все карточки на сегодня повторены.'),
        h('a.btn.primary', { href: '#/' }, 'На главную')));
      return;
    }

    const stats = { total: queue.length, done: 0, ok: 0, bad: 0, xp: 0, newc: 0, seenNew: new Set() };
    let cur = null, revealed = false, shownAt = 0, introNew = new Set();

    const area = h('div.study');
    ui.clear(view).append(area);

    function remaining() { return queue.length; }
    function header() {
      const pct = Math.round(stats.done / (stats.done + remaining()) * 100) || 0;
      return h('div.study-head',
        h('button.icon-btn', { onclick: () => { cleanup(); finish(true); }, 'aria-label': 'Завершить' }, '✕'),
        h('div.progress', h('i', { style: { width: pct + '%' } })),
        h('div.study-count', `${remaining()} осталось`));
    }

    function next() {
      if (!queue.length) return finish();
      cur = queue.shift(); revealed = false; shownAt = Date.now();
      render();
    }

    function requeue(item, pos) { queue.splice(Math.min(queue.length, pos), 0, item); }

    function reward(ok, easy) {
      const xp = ok ? (easy ? 12 : 10) : 2;
      stats.xp += xp; HZ.gami.addXP(xp);
    }

    // ---------- оценка ----------
    function gradeCard(g, auto) {
      const e = HZ.byChar[cur.ch];
      const wasNew = srs.isNew(cur.ch) || introNew.has(cur.ch);
      let c;
      if (cram) {
        srs.record(cur.ch, g > 1);
        c = srs.get(cur.ch);
        if (g === 1) requeue(cur, 4);
      } else {
        c = srs.grade(cur.ch, g);
        if (c.st === 'learn') requeue(cur, g === 1 ? 3 : 6);
      }
      const ok = g > 1;
      if (ok) stats.ok++; else stats.bad++;
      stats.done++;
      reward(ok, g === 4);
      HZ.gami.onReview(ok, false);
      ui.sfx(ok ? 'ok' : 'bad');
      return ok;
    }

    function introDone(known) {
      const ch = cur.ch;
      if (known) srs.markKnown(ch);
      else {
        srs.create(ch);
        srs.grade(ch, 3); // первый шаг обучения пройден
        introNew.add(ch);
        requeue({ ch, kind: 'rev' }, 4);
      }
      store.today().newc++; stats.newc++; stats.done++;
      stats.xp += 15; HZ.gami.addXP(15);
      HZ.gami.touch(); HZ.gami.checkQuests(); HZ.gami.check();
      store.save();
      ui.sfx('ok');
      next();
    }

    // ---------- отрисовка ----------
    function render() {
      const e = HZ.byChar[cur.ch];
      ui.clear(area);
      area.append(header());
      const c = srs.get(cur.ch);
      const tag = cur.kind === 'intro' ? h('span.chip.new', '✨ Новый') : c && c.st === 'learn' ? h('span.chip.learn', 'Учится') : h('span.chip.done', 'Повторение');
      const card = h('div.study-card.pop-in');
      area.append(h('div.row.center', tag), card);

      if (cur.kind === 'intro') {
        card.append(HZ.card.detail(e, { compact: true }));
        area.append(h('div.actions',
          h('button.btn.primary.lg', { onclick: () => introDone(false) }, 'Запомнил(а) →'),
          h('button.btn', { onclick: () => introDone(true), title: 'Пропустить: повторится через 14 дней' }, 'Уже знаю')));
        return;
      }
      if (s.reviewStyle === 'choice') return renderChoice(card, e);
      renderFlip(card, e);
    }

    function renderFlip(card, e) {
      const front = h('div.flip-front', h('div.big-char.xl', { lang: 'zh' }, e.ch), h('p.muted', 'Вспомните: значение, чтение, состав'));
      card.append(front, ui.speakBtn(e.ch, 'corner'));
      const act = h('div.actions');
      area.append(act);
      const showBtn = h('button.btn.primary.lg', { onclick: reveal }, 'Показать ответ (пробел)');
      act.append(showBtn);
      function reveal() {
        if (revealed) return; revealed = true;
        ui.clear(card).append(HZ.card.detail(e, { compact: true }));
        const c = srs.get(cur.ch) || srs.create(cur.ch);
        ui.clear(act);
        [[1, 'Снова', 'again'], [2, 'Трудно', 'hard'], [3, 'Хорошо', 'good'], [4, 'Легко', 'easy']].forEach(([g, name, cls]) =>
          act.append(h('button.grade.' + cls, { onclick: () => { gradeCard(g); next(); } }, h('b', name), h('small', cram ? '' : srs.label(c, g)), h('kbd', String(g)))));
        card.scrollIntoView({ block: 'nearest' });
      }
      cur.reveal = reveal;
    }

    function renderChoice(card, e) {
      const types = ['zh2ru', 'zh2py', 'ru2zh'];
      const type = types[HZ.rand(types.length)];
      const q = HZ.quiz.makeQuestion(e, type, HZ.chars);
      card.append(h('div.q-prompt', q.prompt), h('p.muted.center', q.sub || ''));
      const opts = h('div.options' + (q.big ? '.big' : ''));
      let answered = false;
      q.options.forEach((o, i) => {
        const b = h('button.opt', { onclick: () => pick(b, o) }, h('kbd', String(i + 1)), h('span' + (q.big ? '.zh' : ''), o.label));
        b.dataset.k = o.key; opts.appendChild(b);
      });
      card.append(opts);
      const act = h('div.actions'); area.append(act);
      function pick(btn, o) {
        if (answered) return; answered = true;
        const ok = o.key === q.answer;
        const secs = (Date.now() - shownAt) / 1000;
        opts.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.dataset.k === q.answer) b.classList.add('right'); });
        if (!ok) btn.classList.add('wrong'); else btn.classList.add('pulse');
        gradeCard(ok ? (secs < 3 && !cur.retry ? 4 : 3) : 1);
        if (!ok) cur.retry = true;
        card.append(h('div.reveal', HZ.card.detail(e, { compact: true })));
        act.append(h('button.btn.primary.lg', { onclick: next }, 'Дальше →'));
        cur.after = true;
      }
      cur.pick = i => { const b = opts.querySelectorAll('.opt')[i]; if (b && !answered) b.click(); };
    }

    // ---------- завершение ----------
    function finish(early) {
      cleanup();
      const acc = stats.ok + stats.bad ? Math.round(stats.ok / (stats.ok + stats.bad) * 100) : 100;
      if (!early && stats.done > 0) { ui.confetti(100); ui.sfx('level'); }
      ui.clear(area).append(h('div.summary',
        h('div.big', early ? '👋' : '🎉'),
        h('h2', early ? 'Сессия остановлена' : 'Сессия завершена!'),
        h('div.stat-row',
          h('div.stat', h('b', stats.done), h('span', 'карточек')),
          h('div.stat', h('b', acc + '%'), h('span', 'верно')),
          h('div.stat', h('b', stats.newc), h('span', 'новых')),
          h('div.stat', h('b', '+' + stats.xp), h('span', 'XP'))),
        h('div.actions',
          h('a.btn.primary.lg', { href: '#/' }, 'На главную'),
          mode !== 'collection' && srs.dueList().length && mode !== 'hard' ? h('button.btn', { onclick: () => start('review') }, 'Ещё повторение') : null,
          mode === 'review' && srs.newBudget() && srs.newList(1).length ? h('button.btn', { onclick: () => start('new') }, 'Учить новые') : null)));
    }

    function onKey(ev) {
      if (!document.body.contains(area)) return cleanup();
      if (ev.target.matches('input,textarea,select') || ev.ctrlKey || ev.metaKey) return;
      if (!cur) return;
      const k = ev.key;
      if (cur.kind === 'intro') { if (k === 'Enter' || k === ' ') { ev.preventDefault(); introDone(false); } return; }
      if (s.reviewStyle === 'choice') {
        if (cur.after && (k === 'Enter' || k === ' ')) { ev.preventDefault(); next(); }
        else if (/^[1-4]$/.test(k) && cur.pick) cur.pick(+k - 1);
      } else {
        if (!revealed && (k === ' ' || k === 'Enter')) { ev.preventDefault(); cur.reveal && cur.reveal(); }
        else if (revealed && /^[1-4]$/.test(k)) { gradeCard(+k); next(); }
      }
    }
    function cleanup() { document.removeEventListener('keydown', onKey); }
    document.addEventListener('keydown', onKey);
    HZ.router.onLeave(cleanup);
    next();
  }

  HZ.study = { start };
})();
