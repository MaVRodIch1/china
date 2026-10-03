/* Мини-игры: викторина, скорость, аудирование, «из чего состоит», сопоставление, сложные, тест уровня. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs;

  /* ====== Генератор вопросов ====== */
  const TYPES = {
    zh2ru: 'Иероглиф → значение',
    ru2zh: 'Значение → иероглиф',
    zh2py: 'Иероглиф → пиньинь',
    audio2zh: 'Слух → иероглиф',
    comp2zh: 'Части → иероглиф'
  };

  // похожесть для подбора правдоподобных неверных ответов
  function similarity(a, b) {
    let s = 0;
    if (a.r === b.r) s += 3;
    if (a.tone === b.tone) s += 1;
    if (a.h === b.h) s += 1;
    s += Math.max(0, 3 - Math.abs(a.s - b.s));
    if (a.comps.some(x => b.comps.some(y => x.g === y.g))) s += 3;
    return s + Math.random() * 3;
  }
  function distractors(e, pool, keyFn, n = 3) {
    const seen = new Set([keyFn(e)]);
    const cands = pool.filter(x => x.ch !== e.ch).sort((a, b) => similarity(e, b) - similarity(e, a));
    const out = [];
    for (const c of cands) {
      const k = keyFn(c);
      if (seen.has(k)) continue;
      seen.add(k); out.push(c);
      if (out.length >= n) break;
    }
    return out;
  }
  function pinyinDistractors(e, pool) { // тоны: предпочитаем тот же слог с другим тоном
    const base = HZ.baseSyl(e.py);
    const same = pool.filter(x => x.ch !== e.ch && HZ.baseSyl(x.py) === base && x.py !== e.py);
    const out = []; const seen = new Set([e.py]);
    same.forEach(x => { if (!seen.has(x.py) && out.length < 3) { seen.add(x.py); out.push(x); } });
    if (out.length < 3) distractors(e, pool, c => c.py, 6).forEach(x => { if (!seen.has(x.py) && out.length < 3) { seen.add(x.py); out.push(x); } });
    // синтетические варианты с другим тоном, если не хватает
    return out;
  }

  const firstMean = m => m.split(/[;,]/)[0].trim();
  const bigZh = e => h('div.big-char.xl', { lang: 'zh', style: e.isWord && e.s > 1 ? { fontSize: e.s >= 4 ? '3.2rem' : '4.6rem' } : null }, e.ch);

  function makeQuestion(e, type, pool) {
    let q;
    if (type === 'comp2zh' && e.comps.length < 2) type = 'zh2ru';
    if (type === 'zh2ru') {
      const ds = distractors(e, pool, c => c.m);
      q = { prompt: bigZh(e), sub: 'Что это значит?', options: HZ.shuffle([e, ...ds]).map(c => ({ key: c.ch, label: c.m })) };
    } else if (type === 'ru2zh') {
      const ds = distractors(e, pool, c => c.ch);
      q = { prompt: h('div.q-text', e.m), sub: 'Выберите иероглиф', big: true, options: HZ.shuffle([e, ...ds]).map(c => ({ key: c.ch, label: c.ch })) };
    } else if (type === 'zh2py') {
      const ds = pinyinDistractors(e, pool);
      q = { prompt: bigZh(e), sub: 'Как читается? (обратите внимание на тон)', options: HZ.shuffle([e, ...ds]).map(c => ({ key: c.ch, label: c.py })) };
    } else if (type === 'audio2zh') {
      const ds = distractors(e, pool, c => c.ch);
      q = { prompt: h('button.btn.lg.audio-prompt', { type: 'button', onclick: () => ui.speak(e.ch) }, '🔊 Послушать'), sub: 'Какой иероглиф вы слышите?', big: true, audio: e.ch,
        options: HZ.shuffle([e, ...ds]).map(c => ({ key: c.ch, label: c.ch })) };
    } else { // comp2zh
      const ds = distractors(e, pool, c => c.ch);
      q = { prompt: h('div.big-char.lg', { lang: 'zh' }, e.comps.map(c => c.g).join(' + ')), sub: `Какой иероглиф получается? (${e.m})`, big: true, options: HZ.shuffle([e, ...ds]).map(c => ({ key: c.ch, label: c.ch })) };
    }
    q.type = type; q.answer = e.ch;
    return q;
  }
  HZ.quiz = { makeQuestion, TYPES };

  /* ====== Движок викторин ====== */
  /** opts: {title, types, pool (массив e), count, time (сек), lives, kind ('quiz'|'speed'), onFinish(res)} */
  function runQuiz(opts) {
    const view = document.getElementById('view');
    const area = h('div.game');
    ui.clear(view).append(area);
    const all = HZ.chars;
    const pool = opts.pool.length >= 4 ? opts.pool : all;
    const order = HZ.shuffle(pool);
    let idx = 0, score = 0, combo = 0, bestCombo = 0, right = 0, wrong = 0, locked = false, timeLeft = opts.time || 0, timerId = null, qStart = 0;
    const mistakes = new Set(); const results = [];
    const total = opts.count || order.length;

    function cleanup() { clearInterval(timerId); document.removeEventListener('keydown', onKey); }
    HZ.router.onLeave(cleanup);

    const hud = h('div.game-hud');
    const body = h('div.game-body');
    area.append(h('div.study-head', h('button.icon-btn', { onclick: () => finish(true), 'aria-label': 'Выйти' }, '✕'), h('h3', opts.title), hud), body);

    function drawHud() {
      ui.clear(hud).append(...[
        opts.time ? h('span.hud-pill' + (timeLeft <= 10 ? '.danger' : ''), '⏱ ' + timeLeft) : h('span.hud-pill', `${Math.min(idx + 1, total)}/${total}`),
        h('span.hud-pill', '⭐ ' + score),
        combo >= 2 ? h('span.hud-pill.hot', '🔥 ×' + combo) : null,
        opts.lives ? h('span.hud-pill', '❤️'.repeat(Math.max(0, opts.lives - wrong)) || '💔') : null].filter(Boolean));
    }

    function nextQ() {
      if (idx >= total || (opts.lives && wrong >= opts.lives)) return finish();
      const e = order[idx % order.length];
      const type = opts.types[HZ.rand(opts.types.length)];
      const q = opts.makeQ ? opts.makeQ(e) : makeQuestion(e, type, e.isWord ? HZ.words : all);
      locked = false; qStart = Date.now();
      drawHud();
      ui.clear(body);
      const opt = h('div.options' + (q.big ? '.big' : '') + (q.one ? '.one' : ''));
      q.options.forEach((o, i) => {
        const b = h('button.opt', { type: 'button', dataset: { k: o.key }, onclick: () => pick(b, o, q, e) }, h('kbd', String(i + 1)), h('span' + (q.big ? '.zh' : ''), o.label));
        opt.appendChild(b);
      });
      body.append(h('div.q-card.pop-in', h('div.q-prompt', q.prompt), h('p.muted.center', q.sub)), opt);
      if (q.audio) setTimeout(() => ui.speak(q.audio), 200);
    }

    function pick(btn, o, q, e) {
      if (locked) return; locked = true;
      const ok = o.key === q.answer;
      body.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.dataset.k === q.answer) b.classList.add('right'); });
      srs.record(e.key || e.ch, ok);
      results.push({ ch: e.key || e.ch, ok });
      if (ok) {
        btn.classList.add('pulse');
        right++; combo++; bestCombo = Math.max(bestCombo, combo);
        score += opts.kind === 'speed' ? 1 + Math.floor(combo / 5) : 10 + Math.min(combo, 10);
        ui.sfx('ok');
      } else {
        btn.classList.add('wrong'); wrong++; combo = 0; mistakes.add(e.key || e.ch); ui.sfx('bad');
      }
      drawHud();
      const delay = ok ? (opts.kind === 'speed' ? 280 : 650) : (opts.kind === 'speed' ? 800 : 1500);
      if (!ok && opts.kind !== 'speed') body.append(h('div.reveal', q.reveal || [ui.py(e.py, 'lg'), ' · ', e.m]));
      idx++;
      setTimeout(() => { if (document.body.contains(area)) nextQ(); }, delay);
    }

    function onKey(ev) {
      if (!document.body.contains(area)) return cleanup();
      if (/^[1-4]$/.test(ev.key)) { const b = body.querySelectorAll('.opt')[+ev.key - 1]; if (b && !locked) b.click(); }
    }
    document.addEventListener('keydown', onKey);

    function finish(early) {
      cleanup();
      const n = right + wrong;
      const acc = n ? Math.round(right / n * 100) : 0;
      let xp = 0, record = false;
      if (n > 0) {
        xp = right * 3 + (opts.kind === 'speed' ? 0 : 0);
        if (!early && wrong === 0 && n >= 8 && opts.kind !== 'speed') { xp += 20; HZ.gami.flag('perfect'); }
        if (opts.kind === 'speed') {
          const prev = store.s.best.speed || 0;
          if (score > prev) { store.s.best.speed = score; record = prev > 0; }
        }
        HZ.gami.addXP(xp);
        HZ.gami.onGame(right, n);
        if (!early && acc >= 70) ui.confetti(80);
      }
      store.save();
      const res = { right, wrong, score, acc, results };
      if (opts.onFinish && n > 0 && !early) { opts.onFinish(res, area); return; }
      ui.clear(area).append(h('div.summary',
        h('div.big', early ? '👋' : acc >= 90 ? '🏆' : acc >= 60 ? '👍' : '💪'),
        h('h2', early ? 'Игра остановлена' : opts.title + ': результат'),
        record ? h('p.gold-text', '🎉 Новый рекорд!') : null,
        h('div.stat-row',
          h('div.stat', h('b', score), h('span', 'очков')),
          h('div.stat', h('b', acc + '%'), h('span', 'точность')),
          h('div.stat', h('b', bestCombo), h('span', 'лучшая серия')),
          h('div.stat', h('b', '+' + xp), h('span', 'XP'))),
        opts.kind === 'speed' && store.s.best.speed ? h('p.muted', 'Ваш рекорд: ' + store.s.best.speed) : null,
        mistakes.size ? h('div.cd-sec', h('h4', 'Над чем поработать'), h('div.mini-grid', [...mistakes].map(k => h('a.mini', { href: HZ.isKey(k) ? '#/word/' + encodeURIComponent(k.slice(2)) : '#/char/' + k }, HZ.isKey(k) ? k.slice(2) : k)))) : null,
        h('div.actions', h('button.btn.primary.lg', { onclick: () => runQuiz(opts) }, 'Играть ещё'), h('a.btn', { href: '#/games' }, 'К играм'))));
    }

    if (opts.time) {
      timerId = setInterval(() => { timeLeft--; drawHud(); if (timeLeft <= 0) finish(); }, 1000);
    }
    nextQ();
  }

  /* ====== Сопоставление иероглиф — пиньинь — перевод ====== */
  function runMatch(poolE) {
    const view = document.getElementById('view');
    const area = h('div.game');
    ui.clear(view).append(area);
    const pool = poolE.length >= 5 ? poolE : HZ.chars;
    const rounds = 3, per = 4;
    let round = 0, mistakes = 0, matched = 0, t0 = Date.now(), timerId;
    const bad = new Set();
    const hud = h('span.hud-pill', '⏱ 0');
    timerId = setInterval(() => { hud.textContent = '⏱ ' + Math.round((Date.now() - t0) / 1000); }, 500);
    const cleanup = () => clearInterval(timerId);
    HZ.router.onLeave(cleanup);
    const body = h('div.match-body');
    area.append(h('div.study-head', h('button.icon-btn', { onclick: () => { cleanup(); HZ.router.go('#/games'); }, 'aria-label': 'Выйти' }, '✕'), h('h3', 'Сопоставление'), hud), h('p.muted.center', 'Выберите по одному элементу в каждой колонке, чтобы собрать тройку: иероглиф · пиньинь · значение.'), body);
    const order = HZ.shuffle(pool);

    function nextRound() {
      if (round >= rounds) return finish();
      const set = order.slice(round * per, round * per + per);
      const sel = { z: null, p: null, m: null };
      let left = set.length;
      ui.clear(body);
      const cols = { z: h('div.m-col'), p: h('div.m-col'), m: h('div.m-col') };
      const make = (k, e) => {
        const label = k === 'z' ? h('span.zh', e.ch) : k === 'p' ? ui.py(e.py) : h('span', e.m);
        const b = h('button.m-item.' + k, { type: 'button', onclick: () => choose(k, e, b) }, label);
        return b;
      };
      ['z', 'p', 'm'].forEach(k => HZ.shuffle(set).forEach(e => cols[k].appendChild(make(k, e))));
      body.append(h('div.match-grid', cols.z, cols.p, cols.m));
      function choose(k, e, b) {
        if (b.disabled) return;
        if (sel[k]) sel[k].b.classList.remove('sel');
        if (sel[k] && sel[k].b === b) { sel[k] = null; return; }
        sel[k] = { e, b }; b.classList.add('sel');
        if (sel.z && sel.p && sel.m) {
          const ok = sel.z.e === sel.p.e && sel.p.e === sel.m.e;
          const items = [sel.z.b, sel.p.b, sel.m.b];
          if (ok) {
            items.forEach(x => { x.classList.remove('sel'); x.classList.add('right'); x.disabled = true; });
            srs.record(sel.z.e.key || sel.z.e.ch, true); matched++; left--; ui.sfx('ok');
            if (!left) setTimeout(() => { round++; nextRound(); }, 500);
          } else {
            mistakes++; [sel.z.e, sel.p.e, sel.m.e].forEach(x => bad.add(x.key || x.ch)); srs.record(sel.z.e.key || sel.z.e.ch, false);
            items.forEach(x => { x.classList.add('wrong'); });
            ui.sfx('bad');
            setTimeout(() => items.forEach(x => x.classList.remove('wrong', 'sel')), 450);
          }
          sel.z = sel.p = sel.m = null;
        }
      }
    }
    function finish() {
      cleanup();
      const secs = Math.round((Date.now() - t0) / 1000);
      const xp = Math.max(5, matched * 4 - mistakes * 2) + (mistakes === 0 ? 15 : 0);
      HZ.gami.addXP(xp); HZ.gami.onGame(matched, matched + mistakes);
      ui.confetti(80); store.save();
      ui.clear(area).append(h('div.summary', h('div.big', mistakes === 0 ? '🏆' : '🎯'), h('h2', 'Все пары собраны!'),
        h('div.stat-row', h('div.stat', h('b', secs + ' с'), h('span', 'время')), h('div.stat', h('b', mistakes), h('span', 'ошибок')), h('div.stat', h('b', '+' + xp), h('span', 'XP'))),
        bad.size ? h('div.cd-sec', h('h4', 'Путались'), h('div.mini-grid', [...bad].map(k => h('a.mini', { href: HZ.isKey(k) ? '#/word/' + encodeURIComponent(k.slice(2)) : '#/char/' + k }, HZ.isKey(k) ? k.slice(2) : k)))) : null,
        h('div.actions', h('button.btn.primary.lg', { onclick: () => runMatch(poolE) }, 'Ещё раз'), h('a.btn', { href: '#/games' }, 'К играм'))));
    }
    nextRound();
  }

  /* ====== Тест уровня ====== */
  function placement() {
    const sample = HZ.sample(HZ.chars.filter(c => srs.isNew(c.ch)), 16);
    if (sample.length < 4) { ui.toast('Недостаточно новых иероглифов для теста'); return; }
    runQuiz({
      title: 'Тест уровня', types: ['zh2ru'], pool: sample, count: sample.length, kind: 'placement',
      onFinish: (res, area) => {
        let known = 0;
        res.results.forEach(r => { if (r.ok) { srs.markKnown(r.ch, 10); known++; } });
        const rec = res.acc >= 80 ? 10 : res.acc >= 50 ? 7 : 5;
        store.s.settings.newPerDay = rec; store.s.settings.onboarded = true; store.save();
        ui.clear(area).append(h('div.summary', h('div.big', '🎓'), h('h2', 'Тест пройден'),
          h('p', `Вы уже знаете ${known} из ${res.results.length}. Эти иероглифы отмечены как известные и вернутся на повторение через 10 дней.`),
          h('p', `Рекомендованный темп: ${rec} новых иероглифов в день (можно изменить в настройках).`),
          h('div.actions', h('a.btn.primary.lg', { href: '#/' }, 'Начать учиться'))));
      }
    });
  }

  /* ====== Хаб игр ====== */
  /* Выбранная для игр подборка (любая: встроенная, умная, своя). null — «авто». */
  function gameCol() {
    const id = store.s.settings.gameSrc;
    if (!id || id === 'auto') return null;
    const c = HZ.getCollection(id);
    return c && c.chars.filter(ch => HZ.byChar[ch]).length >= 4 ? c : null;
  }
  const colEntries = c => c.chars.map(ch => HZ.byChar[ch]).filter(Boolean);
  function colWords(c) { // слова подборки: целиком из её иероглифов, иначе — содержащие хотя бы один
    const set = new Set(c.chars);
    const all = HZ.words.filter(w => w.chars.length && w.chars.every(x => set.has(x)));
    return all.length >= 8 ? all : HZ.words.filter(w => w.chars.some(x => set.has(x)));
  }
  const learnedPool = () => { const c = gameCol(); if (c) return colEntries(c); const l = HZ.chars.filter(c => srs.get(c.ch)); return l.length >= 6 ? l : HZ.chars; };

  const wordPool = () => { const c = gameCol(); if (c) { const w = colWords(c); if (w.length >= 6) return w; } const l = HZ.words.filter(w => srs.get(w.key)); return l.length >= 8 ? l : HZ.words.slice(0, 80); };

  /** Выпадающий список подборок для игр (общий для хаба и отдельных игр); onChange вызывается после смены. */
  function srcSelect(onChange) {
    const sel = h('select.input', { onchange: () => { store.s.settings.gameSrc = sel.value; store.save(); if (onChange) onChange(); } });
    sel.append(h('option', { value: 'auto' }, 'Авто — изученное и выбранный уровень'));
    const groups = {};
    HZ.collections.all().filter(c => c.chars.length >= 4).forEach(c => (groups[c.group || 'Другое'] = groups[c.group || 'Другое'] || []).push(c));
    ['Мои подборки', 'Умные', ...Object.keys(groups).filter(g => g !== 'Мои подборки' && g !== 'Умные')].forEach(g => {
      if (groups[g]) sel.append(h('optgroup', { label: g }, groups[g].map(c => h('option', { value: c.id }, `${c.name} (${c.chars.length})`))));
    });
    const cur = gameCol();
    sel.value = cur ? cur.id : 'auto';
    return sel;
  }

  function hub() {
    const view = document.getElementById('view');
    const hard = srs.hardList().map(ch => HZ.byChar[ch]);
    const games = [
      { ico: '❓', name: 'Викторина', desc: '10 вопросов: значение, пиньинь, иероглиф', go: () => runQuiz({ title: 'Викторина', types: ['zh2ru', 'ru2zh', 'zh2py', 'comp2zh'], pool: learnedPool(), count: 10, kind: 'quiz' }) },
      { ico: '⚡', name: 'Скорость', desc: '60 секунд: сколько иероглифов узнаете? Рекорд: ' + (store.s.best.speed || 0), go: () => runQuiz({ title: 'Скорость', types: ['zh2ru', 'zh2py'], pool: learnedPool(), time: 60, count: 9999, kind: 'speed' }) },
      { ico: '🔗', name: 'Сопоставление', desc: 'Иероглиф · пиньинь · перевод — собери тройки', go: () => runMatch(learnedPool()) },
      { ico: '👂', name: 'Аудирование', desc: 'Услышьте слово и найдите иероглиф', go: () => runQuiz({ title: 'Аудирование', types: ['audio2zh'], pool: learnedPool(), count: 10, kind: 'quiz' }) },
      { ico: '🧩', name: 'Из чего состоит?', desc: 'По частям соберите иероглиф', go: () => runQuiz({ title: 'Из чего состоит?', types: ['comp2zh'], pool: (() => { const p = learnedPool().filter(c => c.comps.length >= 2); return p.length >= 4 ? p : HZ.chars.filter(c => c.comps.length >= 2); })(), count: 10, kind: 'quiz', lives: 3 }) },
      { ico: '📘', name: 'Слова: викторина', desc: 'Значение, пиньинь и слово — по словам HSK', go: () => runQuiz({ title: 'Слова', types: ['zh2ru', 'ru2zh', 'zh2py'], pool: wordPool(), count: 10, kind: 'quiz' }) },
      { ico: '🔗', name: 'Слова: сопоставление', desc: 'Слово · пиньинь · перевод', go: () => runMatch(wordPool()) },
      { ico: '🎯', name: 'Тренировка сложных', desc: hard.length >= 4 ? `${hard.length} иероглифов, которые вы забываете` : 'Появится, когда накопятся ошибки (нужно от 4)', disabled: hard.length < 4, go: () => runQuiz({ title: 'Сложные', types: ['zh2ru', 'ru2zh', 'zh2py', 'comp2zh'], pool: hard, count: Math.min(12, hard.length * 2), kind: 'quiz' }) },
      { ico: '🎓', name: 'Тест уровня', desc: 'Отметьте уже известные иероглифы и подберите темп', go: placement }
    ];
    games.forEach(g => { g.group = g.group || 'Классика'; });
    const evo = { group: 'Idle и приключения', ico: '🧬', name: 'Эволюция', desc: 'Idle-игра: отвечай, призывай существ и сливай их. Учит иероглифы из выбранной подборки', go: () => HZ.router.go('#/evo') };
    const all = [evo, ...(HZ.games.extra || []), ...games];
    const order = ['Idle и приключения', 'Предложения', 'Аркады', 'Классика'];
    const lvl = h('select.input', { onchange: () => { store.s.settings.sentLvl = lvl.value; store.save(); hub(); } },
      Object.keys(HZ.games.sentLevels || {}).map(k => h('option', { value: k }, HZ.games.sentLevels[k])));
    lvl.value = store.s.settings.sentLvl || '1';
    // источник для всех игр: своя или любая другая подборка
    const colSel = srcSelect(hub);
    const cur = gameCol();
    const srcInfo = cur ? `Все игры используют подборку «${cur.name}»: ${colEntries(cur).length} иероглифов, ${colWords(cur).length} слов.` : 'Выберите подборку — во всех играх будут её иероглифы, слова и предложения с ними.';
    ui.clear(view).append(h('div.page',
      h('h1', 'Игры'), h('p.muted', 'Играйте, чтобы закреплять иероглифы. Каждая игра приносит XP и помогает находить слабые места.'),
      h('div.panel.game-src', h('label.field', h('span', '🎯 Что тренируем'), colSel), h('p.muted.small', srcInfo)),
      order.map(grp => {
        const list = all.filter(g => g.group === grp);
        if (!list.length) return null;
        return h('section', h('div.game-sec-head', h('h2', grp), grp === 'Предложения' ? h('label.sent-lvl', h('span.muted.small', 'Уровень предложений: '), lvl) : null),
          h('div.game-grid', list.map(g => h('button.game-card' + (g.disabled ? '.disabled' : ''), { type: 'button', onclick: () => { if (g.disabled) return ui.toast(g.desc); g.go(); } },
            h('div.ico', g.ico), h('b', g.name), h('span.muted', g.desc)))));
      })));
  }

  HZ.games = { hub, runQuiz, runMatch, placement, srcSelect, gameCol, colEntries, colWords, learnedPool, wordPool };
})();
