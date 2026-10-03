/* Игры с предложениями и аркады: «Собери предложение», «Пропуск», «Читалка», «На слух», «Тоны», «Лови слово», «Мемори». */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs, G = HZ.games;

  /* ====== Банк предложений ====== */
  const HAN = /[一-鿿]/;
  const LETTER = /[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;
  let BANK = null;

  /** Разбор предложения на слова (самое длинное совпадение со словарём HSK) с выравниванием пиньиня по слогам. */
  function build(z, p, m, key) {
    const chars = [...z];
    const syl = p.split(/\s+/).filter(x => LETTER.test(x));
    if (chars.filter(c => HAN.test(c)).length !== syl.length) return null;
    const tokens = [];
    let i = 0, k = 0, pre = '';
    while (i < chars.length) {
      if (!HAN.test(chars[i])) {
        if (tokens.length) tokens[tokens.length - 1].suf += chars[i]; else pre += chars[i];
        i++; continue;
      }
      let run = 0; while (i + run < chars.length && HAN.test(chars[i + run]) && run < 4) run++;
      let w = chars[i], n = 1;
      for (let l = run; l >= 2; l--) { const sub = chars.slice(i, i + l).join(''); if (HZ.wordByKey['w:' + sub]) { w = sub; n = l; break; } }
      const e = HZ.wordByKey['w:' + w] || HZ.byChar[w] || null;
      let py = syl.slice(k, k + n).map(s => s.replace(/[^A-Za-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, '')).join('');
      if (e && e.py && e.py.replace(/[\s']/g, '').toLowerCase() === py.toLowerCase()) py = e.py.replace(/\s/g, ''); // регистр как в словаре
      tokens.push({ w, py, pre, suf: '', e, lvl: e ? Math.min(e.h || 3, 4) : 3 });
      pre = ''; i += n; k += n;
    }
    const lvl = Math.max(...tokens.map(t => t.lvl));
    return { z, m, key, tokens, lvl, py: syl.join(' '), ch: key };
  }
  function bank() {
    if (BANK) return BANK;
    const seen = new Set(); BANK = [];
    const add = (z, p, m, key) => { if (!z || seen.has(z)) return; const s = build(z, p, m, key); if (s) { seen.add(z); BANK.push(s); } };
    HZ.words.forEach(w => w.sents.forEach(s => add(s.z, s.p, s.m, w.key)));
    HZ.chars.forEach(c => c.sents.forEach(s => add(s.z, s.p, s.m, c.ch)));
    return BANK;
  }
  const text = s => s.tokens.map(t => t.pre + t.w + t.suf).join('');
  const LV = { '1': 'HSK 1', '2': 'HSK 1–2', '3': 'HSK 1–3', mine: 'Мои слова' };
  function sentPool(minTok = 1, maxTok = 99) {
    const lv = store.s.settings.sentLvl || '1';
    let list = bank().filter(s => s.tokens.length >= minTok && s.tokens.length <= maxTok);
    const col = G.gameCol();
    if (col) { // предложения, где есть слово или иероглиф выбранной подборки
      const set = new Set(col.chars);
      const mine = list.filter(s => s.tokens.some(t => t.e && (t.e.isWord ? t.e.chars.length && t.e.chars.every(c => set.has(c)) : set.has(t.w))));
      if (mine.length >= 8) return mine;
      const some = list.filter(s => s.tokens.some(t => [...t.w].some(c => set.has(c))));
      if (some.length >= 8) return some;
    }
    if (lv === 'mine') {
      const mine = list.filter(s => srs.get(s.key) || s.tokens.some(t => t.e && srs.get(t.e.key || t.e.ch)));
      if (mine.length >= 8) return mine;
      return list.filter(s => s.lvl <= 1);
    }
    return list.filter(s => s.lvl <= +lv);
  }
  const firstGloss = m => (m || '').split(/[;,(]/)[0].trim();

  /* Предложение с подсказкой по касанию слова */
  function sentNode(s, opts = {}) {
    const showPy = opts.py !== undefined ? opts.py : !!store.s.settings.sentPy;
    const peek = h('div.sent-peek.muted', 'Коснитесь слова, чтобы увидеть пиньинь и значение');
    const line = h('div.sent-zh' + (showPy ? '.with-py' : ''), { lang: 'zh' }, s.tokens.map(t => {
      const isBlank = opts.blank === t;
      return h('span.sent-tok' + (isBlank ? '.blank' : ''), {
        onclick: () => {
          if (isBlank) return;
          ui.clear(peek).append(h('b.zh', t.w), ' ', ui.py(t.e && t.e.py ? t.e.py : t.py), t.e && t.e.m ? ' · ' + firstGloss(t.e.m) : '');
          peek.classList.remove('muted');
        }
      }, t.pre, h('ruby', isBlank ? '＿＿' : t.w, h('rt', isBlank ? '' : t.py)), t.suf);
    }));
    const tog = h('button.btn.sm', { type: 'button', onclick: () => {
      store.s.settings.sentPy = !store.s.settings.sentPy; store.save();
      line.classList.toggle('with-py', store.s.settings.sentPy);
      tog.textContent = store.s.settings.sentPy ? '👁 Пиньинь: вкл' : '👁 Пиньинь: выкл';
    } }, showPy ? '👁 Пиньинь: вкл' : '👁 Пиньинь: выкл');
    return h('div.sent-box', line, h('div.sent-tools', ui.speakBtn(text(s)), tog), peek);
  }
  const fullSentence = s => h('div', h('div.sent-zh.with-py.left', { lang: 'zh' }, s.tokens.map(t => h('span.sent-tok', t.pre, h('ruby', t.w, h('rt', t.py)), t.suf))), h('div.mt', s.m));

  function summary(area, o) {
    ui.clear(area).append(h('div.summary',
      h('div.big', o.emoji), h('h2', o.title),
      o.record ? h('p.gold-text', '🎉 Новый рекорд!') : null,
      h('div.stat-row', o.stats.map(([v, l]) => h('div.stat', h('b', String(v)), h('span', l)))),
      o.bad && o.bad.length ? h('div.cd-sec', h('h4', 'Над чем поработать'), h('div.sent-bad', o.bad)) : null,
      h('div.actions', h('button.btn.primary.lg', { onclick: o.again }, 'Играть ещё'), h('a.btn', { href: '#/games' }, 'К играм'))));
  }
  function frame(title, hud) {
    const view = document.getElementById('view');
    const area = h('div.game');
    ui.clear(view).append(area);
    const body = h('div.game-body');
    area.append(h('div.study-head', h('a.icon-btn', { href: '#/games', 'aria-label': 'Выйти' }, '✕'), h('h3', title), hud || h('span')), body);
    return { area, body };
  }

  /* ====== Вопросы для runQuiz ====== */
  function pickTranslations(s, pool) {
    const mine = new Set(s.tokens.map(t => t.w));
    const cands = pool.filter(x => x.m !== s.m).map(x => ({ x, sc: x.tokens.filter(t => mine.has(t.w)).length * 3 + (Math.abs(x.tokens.length - s.tokens.length) <= 2 ? 2 : 0) + Math.random() * 3 }))
      .sort((a, b) => b.sc - a.sc);
    const out = [], seen = new Set([s.m]);
    for (const c of cands) { if (seen.has(c.x.m)) continue; seen.add(c.x.m); out.push(c.x); if (out.length >= 3) break; }
    return out;
  }
  function readingQ(s, all, audio) {
    const ds = pickTranslations(s, all);
    const q = {
      prompt: audio ? h('button.btn.lg.audio-prompt', { type: 'button', onclick: () => ui.speak(text(s)) }, '🔊 Послушать ещё раз') : sentNode(s),
      sub: audio ? 'Что сказали? Выберите перевод' : 'Выберите верный перевод',
      one: true, answer: s.z, reveal: fullSentence(s),
      options: HZ.shuffle([s, ...ds]).map(x => ({ key: x.z, label: x.m }))
    };
    if (audio) q.audio = text(s);
    return q;
  }
  function clozeQ(s) {
    const cand = s.tokens.filter(t => t.e && t.e.isWord);
    const content = cand.filter(t => !(t.e.pos || []).some(p => p === 'u' || p === 'y' || p === 'e'));
    const pickFrom = content.length ? content : cand;
    const blank = pickFrom[HZ.rand(pickFrom.length)];
    const ruLow = s.m.toLowerCase();
    const pos0 = (blank.e.pos || [])[0];
    const len = [...blank.w].length;
    const cs = HZ.words.filter(w => w.ch !== blank.w && w.h <= Math.max(s.lvl, 1) && !s.tokens.some(t => t.w === w.ch)).map(w => {
      const g = firstGloss(w.m).toLowerCase().replace(/[^а-яё ]/g, '').trim();
      const stem = g.length >= 4 ? g.slice(0, Math.max(4, g.length - 2)) : g;
      const clash = stem && ruLow.includes(stem);
      return { w, sc: clash ? -99 : ((w.pos || []).includes(pos0) ? 3 : 0) + ([...w.ch].length === len ? 2 : 0) + Math.random() * 3 };
    }).filter(c => c.sc > -50).sort((a, b) => b.sc - a.sc);
    const opts = [blank.e], seen = new Set([blank.w]);
    for (const c of cs) { if (seen.has(c.w.ch)) continue; seen.add(c.w.ch); opts.push(c.w); if (opts.length >= 4) break; }
    return {
      prompt: h('div', sentNode(s, { blank, py: false }), h('p.q-text.small', s.m)),
      sub: 'Какое слово пропущено?', big: true, answer: blank.w, reveal: fullSentence(s),
      options: HZ.shuffle(opts).map(w => ({ key: w.ch, label: w.ch }))
    };
  }

  /* ====== Тоны ====== */
  const MARK = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
  const BASE_MAP = {}; Object.keys(MARK).forEach(b => [...MARK[b]].forEach(c => { BASE_MAP[c] = b; }));
  const baseOf = syl => [...syl].map(c => BASE_MAP[c] || c).join('');
  function setTone(syl, t) {
    const b = baseOf(syl).toLowerCase();
    if (t === 5) return b;
    let idx = b.search(/[ae]/);
    if (idx < 0) { const o = b.indexOf('ou'); idx = o >= 0 ? o : -1; }
    if (idx < 0) { for (let i = b.length - 1; i >= 0; i--) if ('aeiouü'.includes(b[i])) { idx = i; break; } }
    if (idx < 0) return null;
    return b.slice(0, idx) + MARK[b[idx]][t - 1] + b.slice(idx + 1);
  }
  function toneQ(e) {
    const sylls = e.py.split(/\s+/);
    const base = sylls.map(s => baseOf(s).toLowerCase());
    if (base.some(b => !/[aeiouü]/.test(b))) return null;
    const cur = sylls.map(s => HZ.toneOf(s));
    const seen = new Set([sylls.map(s => s.toLowerCase()).join(' ')]);
    const out = [e.py.toLowerCase()];
    let guard = 0;
    while (out.length < 4 && guard++ < 60) {
      const v = sylls.map((s, i) => (Math.random() < (sylls.length === 1 ? 1 : .6) ? setTone(s, [1, 2, 3, 4][HZ.rand(4)]) : s.toLowerCase()));
      if (v.some(x => x === null)) continue;
      const str = v.join(' ');
      if (seen.has(str)) continue; seen.add(str); out.push(str);
    }
    if (out.length < 4) return null;
    const big = h('div.big-char.xl', { lang: 'zh', style: e.isWord && e.s > 1 ? { fontSize: e.s >= 4 ? '3.2rem' : '4.6rem' } : null }, e.ch);
    return {
      prompt: h('div', big, h('p.muted.center', 'Слоги: ' + base.join(' · '), h('span.muted', ' (' + firstGloss(e.m) + ')'))),
      sub: 'Выберите вариант с правильными тонами', answer: e.py.toLowerCase(), cur,
      options: HZ.shuffle(out).map(p => ({ key: p, label: p }))
    };
  }

  /* ====== Пулы ====== */
  function mixPool() {
    const col = G.gameCol();
    if (col) {
      const p = [...G.colEntries(col), ...G.colWords(col)];
      if (p.length >= 12) return dedupe(p);
    }
    const c = HZ.chars.filter(x => srs.get(x.ch)), w = HZ.words.filter(x => srs.get(x.key));
    const lvl = +(store.s.settings.sentLvl === 'mine' ? 1 : (store.s.settings.sentLvl || 1));
    let pool = [...c, ...w];
    if (pool.length < 12) pool = [...HZ.chars.filter(x => x.h <= lvl), ...HZ.words.filter(x => x.h <= lvl)];
    return dedupe(pool);
  }
  function dedupe(pool) { const seen = new Set(); return pool.filter(e => !seen.has(e.ch) && seen.add(e.ch)); } // знак и слово из него не дублируются

  /* ====== Собери предложение ====== */
  function runBuilder() {
    const pool = sentPool(3, 9);
    if (pool.length < 8) return ui.toast('Мало подходящих предложений — выберите другой уровень');
    const N = 8, list = HZ.sample(pool, N);
    const hud = h('span.game-hud');
    const { area, body } = frame('Собери предложение', hud);
    let idx = 0, score = 0, right = 0, hints = 0, locked = false;
    const bad = [];
    const drawHud = () => ui.clear(hud).append(h('span.hud-pill', `${Math.min(idx + 1, N)}/${N}`), h('span.hud-pill', '⭐ ' + score));

    function next() {
      if (idx >= N) return finish();
      const s = list[idx]; locked = false; drawHud();
      const order = HZ.shuffle(s.tokens.map((t, i) => ({ t, i })));
      const placed = []; // индексы в order
      let used = 0;
      const line = h('div.sb-line'), bankEl = h('div.sb-bank'), msg = h('div.sb-msg');
      const showPy = () => !!store.s.settings.sentPy;
      const chip = (o, inLine) => h('button.sb-chip' + (inLine ? '.in' : ''), { type: 'button', onclick: () => inLine ? remove(o) : add(o) },
        h('span.zh', o.t.w), showPy() ? h('small', o.t.py) : null);
      function draw() {
        ui.clear(line).append(...(placed.length ? placed.map(o => chip(o, true)) : [h('span.muted', 'Нажимайте слова по порядку')]));
        ui.clear(bankEl).append(...order.filter(o => !placed.includes(o)).map(o => chip(o, false)));
        if (placed.length === order.length) check();
      }
      function add(o) { if (locked) return; placed.push(o); ui.sfx('click'); draw(); }
      function remove(o) { if (locked) return; placed.splice(placed.indexOf(o), 1); draw(); }
      function check() {
        locked = true;
        const got = placed.map(o => o.t.w).join(''), want = s.tokens.map(t => t.w).join('');
        const ok = got === want;
        const key = s.key; srs.record(key, ok);
        line.classList.add(ok ? 'ok' : 'bad');
        if (ok) { right++; score += hints ? 5 : 10; ui.sfx('ok'); } else { bad.push(s); ui.sfx('bad'); }
        hints = 0; drawHud();
        ui.speak(text(s));
        ui.clear(msg).append(h('div.reveal', fullSentence(s)), h('div.actions.center.mt', h('button.btn.primary', { type: 'button', onclick: () => { idx++; next(); } }, idx + 1 >= N ? 'Результат' : 'Дальше →')));
      }
      const hint = h('button.btn.sm', { type: 'button', onclick: () => {
        if (locked) return;
        // убрать неверные слова с начала и подставить следующее верное
        let k = 0; while (k < placed.length && placed[k].t === s.tokens[k] ) k++;
        placed.length = k;
        const o = order.find(x => x.t === s.tokens[k] && !placed.includes(x));
        if (o) { placed.push(o); hints++; }
        draw();
      } }, '💡 Подсказка');
      const tog = h('button.btn.sm', { type: 'button', onclick: () => { store.s.settings.sentPy = !store.s.settings.sentPy; store.save(); draw(); tog.textContent = showPy() ? '👁 Пиньинь: вкл' : '👁 Пиньинь: выкл'; } }, showPy() ? '👁 Пиньинь: вкл' : '👁 Пиньинь: выкл');
      ui.clear(body).append(
        h('div.q-card.pop-in', h('p.muted.center', 'Переведите на китайский:'), h('div.q-text', s.m)),
        line, bankEl, h('div.sent-tools', hint, tog), msg);
      draw();
    }
    function finish() {
      const xp = right * 4 + (right === N ? 20 : 0);
      HZ.gami.addXP(xp); HZ.gami.onGame(right, N); store.save();
      if (right >= N / 2) ui.confetti(80);
      summary(area, { emoji: right === N ? '🏆' : right >= N / 2 ? '👍' : '💪', title: 'Предложения собраны', stats: [[score, 'очков'], [right + '/' + N, 'верно'], ['+' + xp, 'XP']],
        bad: bad.map(s => h('div.sent-bad-row', h('span.zh', text(s)), h('small.muted', s.m))), again: runBuilder });
    }
    next();
  }

  /* ====== Лови слово (аркада) ====== */
  function runRain() {
    const pool = mixPool().filter(e => e.m && firstGloss(e.m).length <= 22);
    if (pool.length < 8) return ui.toast('Мало слов для игры');
    const hud = h('span.game-hud');
    const { area, body } = frame('Лови слово', hud);
    const field = h('div.rain-field'), prompt = h('div.rain-prompt'), hint = h('div.rain-hint');
    body.append(prompt, hint, field);
    let lives = 3, score = 0, round = 0, combo = 0, bestCombo = 0, raf = 0, cards = [], target = null, tStart = 0, over = false, wrongSet = new Set(), right = 0, wrong = 0, lastT = 0;
    const drawHud = () => ui.clear(hud).append(...[h('span.hud-pill', '❤️'.repeat(Math.max(0, lives)) || '💔'), h('span.hud-pill', '⭐ ' + score), combo >= 2 ? h('span.hud-pill.hot', '🔥 ×' + combo) : null].filter(Boolean));
    const cleanup = () => cancelAnimationFrame(raf);
    HZ.router.onLeave(cleanup);

    function newRound() {
      if (over) return;
      cards.forEach(c => c.el.remove()); cards = [];
      const e = pool[HZ.rand(pool.length)];
      const ds = [], seen = new Set([firstGloss(e.m)]);
      for (const x of HZ.shuffle(pool)) { const g = firstGloss(x.m); if (x === e || seen.has(g)) continue; seen.add(g); ds.push(x); if (ds.length >= 3) break; }
      target = e; round++;
      const dur = Math.max(3.4, 9 - round * 0.22);
      const lanes = HZ.shuffle([0, 1, 2, 3]);
      const now = performance.now();
      [e, ...ds].forEach((x, i) => {
        const el = h('button.rain-card', { type: 'button', dataset: { ok: x === e ? '1' : '' }, style: { left: lanes[i] * 25 + '%' }, onclick: () => hit(c) }, h('span.zh', x.ch));
        const c = { e: x, el, y: -60, v: 0, delay: HZ.shuffle([0, 0.3, 0.7, 1.1])[i] * 1000, dur: dur * (0.9 + Math.random() * 0.25), done: false };
        cards.push(c); field.appendChild(el);
      });
      tStart = now;
      ui.clear(prompt).append(h('span.muted', 'Поймай: '), h('b.rain-target', firstGloss(e.m)));
      ui.clear(hint).append(h('span', ' '));
      drawHud();
    }
    function hit(c) {
      if (over || c.done) return;
      c.done = true;
      if (c.e === target) {
        right++; combo++; bestCombo = Math.max(bestCombo, combo); score += 10 + Math.min(combo, 10) * 2;
        srs.record(target.key || target.ch, true); ui.sfx('ok'); ui.speak(target.ch);
        c.el.classList.add('good');
        cards.forEach(k => { if (k !== c) k.el.classList.add('fade'); });
        const t = target; target = null;
        setTimeout(() => { if (!over) newRound(); }, 450);
      } else {
        wrong++; combo = 0; lives--; wrongSet.add(c.e.key || c.e.ch); ui.sfx('bad');
        srs.record(c.e.key || c.e.ch, false); c.el.classList.add('bad');
        setTimeout(() => c.el.remove(), 300);
        if (lives <= 0) return finish();
      }
      drawHud();
    }
    function miss() {
      if (!target) return;
      const t = target; target = null; combo = 0; lives--; wrong++; wrongSet.add(t.key || t.ch);
      srs.record(t.key || t.ch, false); ui.sfx('bad');
      const c = cards.find(k => k.e === t); if (c) c.el.classList.add('reveal-me');
      ui.clear(hint).append(ui.py(t.py, 'lg'), ' · ', t.ch, ' — ', firstGloss(t.m));
      drawHud();
      if (lives <= 0) return setTimeout(finish, 900);
      setTimeout(() => { if (!over) newRound(); }, 1400);
    }
    function loop(ts) {
      if (over) return;
      const H = field.clientHeight, now = performance.now();
      cards.forEach(c => {
        if (c.done) return;
        const t = now - tStart - c.delay;
        if (t < 0) { c.el.style.visibility = 'hidden'; return; }
        c.el.style.visibility = 'visible';
        const y = -60 + (H + 60 - 10) * (t / 1000 / c.dur);
        c.el.style.transform = `translateY(${y}px)`;
        if (y >= H - 70) { c.done = true; if (c.e === target) miss(); else c.el.classList.add('fade'); }
      });
      // подсказка пиньинем во второй половине падения
      if (target && !hint.textContent.trim() && now - tStart > 2800) ui.clear(hint).append(h('span.muted', 'Подсказка: '), ui.py(target.py));
      raf = requestAnimationFrame(loop);
    }
    function finish() {
      over = true; cleanup();
      const prev = store.s.best.rain || 0; const rec = score > prev && prev > 0;
      if (score > prev) store.s.best.rain = score;
      const xp = right * 3; HZ.gami.addXP(xp); HZ.gami.onGame(right, right + wrong); store.save();
      summary(area, { emoji: score >= 150 ? '🏆' : score >= 60 ? '👍' : '💪', title: 'Игра окончена', record: rec,
        stats: [[score, 'очков'], [right, 'поймано'], [bestCombo, 'лучшая серия'], ['+' + xp, 'XP']],
        bad: [...wrongSet].map(k => { const e = HZ.entry(k); return e ? h('div.sent-bad-row', h('span.zh', e.ch), h('small.muted', ui.py(e.py), ' · ', firstGloss(e.m))) : null; }).filter(Boolean),
        again: runRain });
    }
    newRound(); raf = requestAnimationFrame(loop);
  }

  /* ====== Мемори ====== */
  function runMemory() {
    const all = mixPool().filter(e => e.m && firstGloss(e.m).length <= 16);
    if (all.length < 8) return ui.toast('Мало слов для игры');
    const pairs = HZ.sample(all, 8);
    const hud = h('span.game-hud');
    const { area, body } = frame('Мемори', hud);
    const cards = HZ.shuffle(pairs.flatMap(e => [{ e, side: 'z' }, { e, side: 'm' }]));
    let first = null, lock = false, moves = 0, found = 0, t0 = Date.now(), timer;
    const timeEl = h('span.hud-pill', '⏱ 0'), movesEl = h('span.hud-pill', '↺ 0');
    ui.clear(hud).append(timeEl, movesEl);
    timer = setInterval(() => { timeEl.textContent = '⏱ ' + Math.round((Date.now() - t0) / 1000); }, 500);
    HZ.router.onLeave(() => clearInterval(timer));
    const grid = h('div.mem-grid');
    cards.forEach(c => {
      c.el = h('button.mem-card', { type: 'button', dataset: { pair: String(pairs.indexOf(c.e)) }, onclick: () => flip(c) }, h('span.mem-back', '汉'), h('span.mem-face' + (c.side === 'z' ? '.zh.z' : '.m'), c.side === 'z' ? c.e.ch : firstGloss(c.e.m)));
      grid.appendChild(c.el);
    });
    body.append(h('p.muted.center', 'Найдите пары: иероглиф ↔ значение'), grid);
    function flip(c) {
      if (lock || c.open || c.matched) return;
      c.open = true; c.el.classList.add('open'); if (c.side === 'z') ui.speak(c.e.ch);
      if (!first) { first = c; return; }
      moves++; movesEl.textContent = '↺ ' + moves;
      const a = first; first = null;
      if (a.e === c.e) {
        a.matched = c.matched = true; a.el.classList.add('matched'); c.el.classList.add('matched'); ui.sfx('ok'); srs.record(c.e.key || c.e.ch, true);
        if (++found === pairs.length) finish();
      } else {
        lock = true; ui.sfx('bad'); srs.record(c.e.key || c.e.ch, false); wrongKeys.add(c.e.key || c.e.ch);
        setTimeout(() => { a.open = c.open = false; a.el.classList.remove('open'); c.el.classList.remove('open'); lock = false; }, 900);
      }
    }
    const wrongKeys = new Set();
    function finish() {
      clearInterval(timer);
      const secs = Math.round((Date.now() - t0) / 1000);
      const xp = Math.max(8, 40 - Math.max(0, moves - 8) * 2);
      const rec = !store.s.best.memory || moves < store.s.best.memory; const prev = store.s.best.memory;
      if (rec) store.s.best.memory = moves;
      HZ.gami.addXP(xp); HZ.gami.onGame(8, moves); ui.confetti(90); store.save();
      setTimeout(() => summary(area, { emoji: moves <= 10 ? '🏆' : '🎯', title: 'Все пары найдены!', record: rec && !!prev,
        stats: [[moves, 'ходов'], [secs + ' с', 'время'], ['+' + xp, 'XP']],
        bad: [...wrongKeys].map(k => { const e = HZ.entry(k); return e ? h('div.sent-bad-row', h('span.zh', e.ch), h('small.muted', ui.py(e.py), ' · ', firstGloss(e.m))) : null; }).filter(Boolean),
        again: runMemory }), 600);
    }
  }

  /* ====== Регистрация ====== */
  const need = (min) => () => sentPool(min).length >= 8;
  G.extra = [
    { group: 'Предложения', ico: '🧱', name: 'Собери предложение', desc: 'Переведите фразу, расставив слова по порядку', go: runBuilder },
    { group: 'Предложения', ico: '🕳️', name: 'Пропуск', desc: 'Вставьте пропущенное слово в китайское предложение', go: () => G.runQuiz({ title: 'Пропуск', pool: sentPool(2), makeQ: clozeQ, count: 10, kind: 'quiz', types: ['cloze'] }) },
    { group: 'Предложения', ico: '📖', name: 'Читалка', desc: 'Прочитайте предложение (слова подсказывают по касанию) и выберите перевод', go: () => { const all = sentPool(); G.runQuiz({ title: 'Читалка', pool: all, makeQ: s => readingQ(s, all, false), count: 10, kind: 'quiz', types: ['read'] }); } },
    { group: 'Предложения', ico: '🎧', name: 'На слух', desc: 'Послушайте предложение и выберите перевод', go: () => { const all = sentPool(); G.runQuiz({ title: 'На слух', pool: all, makeQ: s => readingQ(s, all, true), count: 10, kind: 'quiz', types: ['listen'] }); } },
    { group: 'Аркады', ico: '🌧️', name: 'Лови слово', get desc() { return 'Слова падают — коснитесь того, что значит названное. Рекорд: ' + (store.s.best.rain || 0); }, go: runRain },
    { group: 'Аркады', ico: '🃏', name: 'Мемори', desc: 'Найдите пары «иероглиф — значение» за минимум ходов', go: runMemory },
    { group: 'Аркады', ico: '🎼', name: 'Тоны', desc: 'Выберите правильные тоны слова — тренировка слуха и глаз', go: () => {
      const pool = mixPool().filter(e => toneQ(e));
      G.runQuiz({ title: 'Тоны', pool, makeQ: e => toneQ(e) || toneQ(pool.find(x => toneQ(x))), count: 10, kind: 'quiz', types: ['tone'] }); } }
  ];
  G.sentLevels = LV;
  G.mixPool = mixPool; G.summary = summary; G.frame = frame;
  G.sentPoolSize = () => sentPool().length;
  HZ.sentences = { bank, build, sentPool };
})();
