/* «Эволюция» — idle-игра со слиянием: существа приносят монеты, а призвать нового можно, только верно ответив
 * на вопрос по выбранной подборке иероглифов или слов. Чем лучше помните знак на существе, тем выше его доход. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs;

  // Линии существ: [файл, название, число стадий]. Уровень 1–20 раскладывается по стадиям линии.
  const LINES = [['slime', 'Слизень', 6], ['plant', 'Росток', 6], ['fish', 'Рыба', 6], ['snail', 'Улитка', 5], ['robot', 'Робот', 6],
    ['golem', 'Голем', 5], ['mushroom', 'Гриб', 5], ['cat', 'Кот', 5], ['crow', 'Ворон', 6], ['skeleton', 'Скелет', 5]];
  const MAXT = 20;
  const stageOf = (li, t) => Math.min(LINES[li][2] - 1, Math.floor((t - 1) * LINES[li][2] / MAXT));
  const spriteSrc = (li, t) => `img/evo/${LINES[li][0]}-${stageOf(li, t)}.webp`;
  const sprite = (li, t, cls = '') => h('img.evo-sprite' + cls, { src: spriteSrc(li, t), alt: LINES[li][1], draggable: false });
  const keyText = k => (HZ.isKey(k) ? k.slice(2) : k);
  function say(e, k) { if (e.sound === false || !k) return; const en = HZ.entry(k); if (en) ui.speak(en.ch); }
  const COLS = 5;
  const MAST_MAX = 5;
  const OFFLINE_CAP = 8 * 3600; // сек

  const UPS = {
    inc: { ico: '💰', name: 'Доход', desc: lv => `+25% к доходу (сейчас ×${(1 + .25 * lv).toFixed(2)})`, cost: lv => Math.round(100 * Math.pow(2.4, lv)), max: 25 },
    disc: { ico: '🏷️', name: 'Скидка на призыв', desc: lv => `−4% к цене призыва (сейчас −${lv * 4}%)`, cost: lv => Math.round(150 * Math.pow(2.6, lv)), max: 10 },
    slots: { ico: '🔲', name: 'Больше клеток', desc: lv => `+5 клеток (сейчас ${15 + 5 * lv})`, cost: lv => Math.round(500 * Math.pow(4, lv)), max: 4 },
    off: { ico: '🌙', name: 'Доход офлайн', desc: lv => `Пока вас нет, существа дают ${40 + lv * 10}% дохода`, cost: lv => Math.round(200 * Math.pow(2.5, lv)), max: 6 }
  };

  const tierInc = t => 0.5 * Math.pow(2.3, t - 1);

  function fmt(n) {
    if (n < 10) return (Math.floor(n * 10) / 10).toString().replace('.', ',');
    if (n < 1000) return String(Math.floor(n));
    const u = ['K', 'M', 'B', 'T', 'Qa', 'Qi'];
    let i = -1; while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : String(Math.floor(n))).replace('.', ',') + u[i];
  }

  /* ====== Состояние ====== */
  function init() {
    let e = store.s.evo;
    if (!e || typeof e !== 'object') e = store.s.evo = {};
    const d = { coins: 60, slots: 15, jade: 0, reb: 0, bestTier: 1, tiles: [], chars: [], maxTier: 1, spawned: 0, merges: 0, answered: 0, right: 0, bestCombo: 0,
      mast: {}, ups: { inc: 0, disc: 0, slots: 0, off: 0 }, src: 'c:hsk1', sound: true, sp: [], last: Date.now(), upd: 0 };
    Object.keys(d).forEach(k => { if (e[k] === undefined) e[k] = d[k]; });
    e.ups = Object.assign({}, d.ups, e.ups);
    if (e.maxTier > e.bestTier) e.bestTier = e.maxTier;
    const n = 15 + 5 * e.ups.slots;
    e.slots = n;
    if (!Array.isArray(e.sp)) e.sp = [];
    while (e.tiles.length < n) { e.tiles.push(0); e.chars.push(null); }
    while (e.sp.length < n) e.sp.push(null);
    e.tiles.length = n; e.chars.length = n; e.sp.length = n;
    return e;
  }
  const E = () => init();
  function lineOf(e, i) { if (e.sp[i] == null) e.sp[i] = HZ.hash(String(e.chars[i]) + i) % LINES.length; return e.sp[i]; }
  const touch = () => { store.s.evo.upd = Date.now(); store.save(); };

  /* ====== Расчёты ====== */
  function knownBonus() { // за каждую карточку, перешедшую в повторение, +1% дохода (до +200%)
    let n = 0; Object.values(store.s.cards).forEach(c => { if (c.st === 'review') n++; });
    return Math.min(2, n * 0.01);
  }
  const mult = e => (1 + .25 * e.ups.inc) * (1 + knownBonus()) * (1 + .04 * e.jade);
  const tileInc = (e, i) => tierInc(e.tiles[i]) * (1 + .2 * ((e.mast[e.chars[i]] || 0))) ;
  function income(e) { let s = 0; for (let i = 0; i < e.tiles.length; i++) if (e.tiles[i]) s += tileInc(e, i); return s * mult(e); }
  const gapOf = e => Math.max(3, 6 - Math.floor(Math.log2(1 + e.jade / 8))); // перерождения поднимают стартовый уровень существ
  const baseTier = e => Math.max(1, e.maxTier - gapOf(e));
  const rebirthGain = e => (e.maxTier >= 10 ? Math.pow(e.maxTier - 8, 2) : 0);
  const filled = e => e.tiles.filter(Boolean).length;
  function spawnCost(e) { return Math.round(10 * Math.pow(3.2, baseTier(e) - 1) * (1 - .04 * e.ups.disc) * (1 + .03 * filled(e))); }

  /* ====== Источники вопросов ====== */
  function sources() {
    const out = [{ id: 'learned', name: 'Мои изучаемые иероглифы', group: 'Мои', ico: '🧠' }];
    const gc = HZ.games && HZ.games.gameCol && HZ.games.gameCol();
    if (gc) out.unshift({ id: 'game', name: 'Как в играх: ' + gc.name, group: 'Мои', ico: '🎯', n: gc.chars.length });
    HZ.collections.all().forEach(c => { if (c.chars && c.chars.length >= 4) out.push({ id: 'c:' + c.id, name: c.name, group: c.group || 'Мои подборки', ico: c.ico || '🗂️', n: c.chars.length }); });
    [1, 2, 3].forEach(l => out.push({ id: 'w' + l, name: 'Слова HSK ' + l, group: 'Слова', ico: '📘', n: HZ.words.filter(w => w.h === l).length }));
    out.push({ id: 'wlearned', name: 'Мои изучаемые слова', group: 'Слова', ico: '📖' });
    return out;
  }
  function poolOf(id) {
    let p;
    if (id === 'game') { const gc = HZ.games.gameCol(); p = gc ? HZ.games.colEntries(gc) : null; }
    else if (id === 'learned') p = HZ.chars.filter(c => srs.get(c.ch));
    else if (id === 'wlearned') p = HZ.words.filter(w => srs.get(w.key));
    else if (/^w[123]$/.test(id)) p = HZ.words.filter(w => w.h === +id[1]);
    else if (id.startsWith('c:')) { const c = HZ.collections.get(id.slice(2)); p = c ? c.chars.map(ch => HZ.byChar[ch]).filter(Boolean) : []; }
    if (!p || p.length < 4) return null;
    return p;
  }
  function srcName(id) { const s = sources().find(x => x.id === id && poolOf(x.id)); return s ? s.name : 'HSK 1'; }

  /* ====== Очередь вопросов: ошибки возвращаются раньше ====== */
  let queue = [], queueSrc = null, qPool = null;
  function nextEntry(e) {
    let id = e.src, pool = poolOf(id);
    if (!pool) { id = e.src = 'c:hsk1'; pool = poolOf(id); store.save(); }
    if (queueSrc !== id) { queue = []; queueSrc = id; qPool = pool; }
    qPool = pool;
    if (!queue.length) {
      // слабые знаки (низкое мастерство) идут первыми
      queue = HZ.shuffle(pool).sort((a, b) => (e.mast[a.key || a.ch] || 0) - (e.mast[b.key || b.ch] || 0) + (Math.random() - .5) * 2);
    }
    return { entry: queue.shift(), pool };
  }
  const requeue = (entry, at = 3) => { queue.splice(Math.min(at, queue.length), 0, entry); };

  /* ====== Вид ====== */
  let T = null; // активное состояние UI

  function view() {
    const e = E();
    const root = document.getElementById('view');
    const area = h('div.page.evo');
    ui.clear(root).append(area);
    T = { area, sel: -1, info: -1, combo: 0, session: { right: 0, wrong: 0 }, el: {}, cells: [], t0: Date.now(), xpAcc: 0 };

    // офлайн-доход
    const away = Math.min(OFFLINE_CAP, Math.max(0, (Date.now() - (e.last || Date.now())) / 1000));
    let offGain = 0;
    if (away > 60) { offGain = income(e) * away * (.4 + .1 * e.ups.off); e.coins += offGain; }
    e.last = Date.now(); store.save();

    T.el.coins = h('b.evo-coins', '0');
    T.el.inc = h('span.muted', '');
    T.el.combo = h('span.hud-pill', '');
    T.el.spawn = h('button.btn.primary.lg.evo-spawn', { type: 'button', onclick: () => ask() });
    T.el.merge = h('button.btn.lg', { type: 'button', onclick: autoMerge, title: 'Слить любую пару одинаковых существ' }, '✨ Слить пару');
    T.el.srcBtn = h('button.btn.sm', { type: 'button', onclick: pickSource });
    T.el.board = h('div.evo-board');
    T.el.wrap = h('div.evo-wrap', T.el.board);
    T.el.snd = h('button.btn.sm', { type: 'button', onclick: () => { const e2 = E(); e2.sound = e2.sound === false; touch(); refresh(); } });
    T.el.rebText = h('p.muted.small', '');
    T.el.rebBtn = h('button.btn.primary', { type: 'button', onclick: rebirth }, '🌸 Переродиться');
    T.el.ups = h('div.evo-ups');
    T.el.ladder = h('div.evo-bestiary');

    area.append(
      h('div.evo-top',
        h('div', h('div.evo-coin-row', h('span.evo-coin', '🪙'), T.el.coins), T.el.inc),
        T.el.combo),
      h('div.evo-src', h('span.muted', 'Вопросы по: '), T.el.srcBtn, T.el.snd),
      h('div.evo-actions', T.el.spawn, T.el.merge),
      T.el.wrap,
      h('p.muted.small.center', 'Ответьте верно — появится существо с иероглифом. Коснитесь существа — откроется карточка и прозвучит знак. Перетащите на такое же — они сольются в следующее и получат новый иероглиф. Чем лучше знаете знак (точки), тем больше дохода.'),
      h('div.panel', h('h3', 'Улучшения'), T.el.ups),
      h('div.panel', h('h3', '🌸 Перерождение'), T.el.rebText, T.el.rebBtn),
      h('div.panel', h('h3', 'Бестиарий'), h('p.muted.small', 'Стадии существ открываются по мере роста уровня эволюции.'), T.el.ladder));

    buildBoard(); drawUps(); drawLadder(); refresh();
    if (offGain > 1) ui.toast(`🌙 Пока вас не было, существа принесли ${fmt(offGain)} 🪙`, 'gold', 4500);

    const iv = setInterval(tick, 250);
    let saveN = 0;
    function tick() {
      if (!document.body.contains(area)) return clearInterval(iv);
      const e = E(), now = Date.now(), dt = Math.min(2, (now - e.last) / 1000);
      e.last = now;
      e.coins += income(e) * dt;
      if (++saveN % 20 === 0) store.save();
      refresh(true);
    }
    HZ.router.onLeave(() => { clearInterval(iv); E().last = Date.now(); leaveSession(); });
  }

  function leaveSession() {
    if (!T) return;
    const s = T.session;
    if (s.right + s.wrong >= 5) { HZ.gami.addXP(s.right); HZ.gami.onGame(s.right, s.right + s.wrong); }
    else if (s.right) HZ.gami.addXP(s.right);
    store.save();
    T = null;
  }

  function buildBoard() {
    const e = E();
    ui.clear(T.el.board);
    T.el.board.style.gridTemplateColumns = `repeat(${COLS}, minmax(0, 1fr))`;
    T.cells = [];
    for (let i = 0; i < e.tiles.length; i++) {
      const c = h('div.evo-cell', { dataset: { i: String(i) } });
      T.cells.push(c); T.el.board.appendChild(c);
      c.addEventListener('pointerdown', ev => down(ev, i));
    }
    drawTiles();
  }

  function tileNode(e, i) {
    const t = e.tiles[i];
    if (!t) return null;
    const ch = e.chars[i], m = e.mast[ch] || 0, label = ch ? (HZ.isKey(ch) ? ch.slice(2) : ch) : '';
    return h('div.evo-tile.t' + Math.min(t, 20) + (T.sel === i ? '.sel' : '') + (T.info === i ? '.info' : ''),
      sprite(lineOf(e, i), t),
      h('span.evo-lv', String(t)),
      ch ? h('span.evo-ch.zh' + (label.length > 2 ? '.long' : ''), label) : null,
      h('span.evo-mast', Array.from({ length: MAST_MAX }, (_, k) => h('i' + (k < m ? '.on' : '')))));
  }
  function drawTiles() {
    const e = E();
    T.cells.forEach((c, i) => {
      ui.clear(c); c.classList.toggle('empty', !e.tiles[i]);
      const n = tileNode(e, i); if (n) c.appendChild(n);
    });
  }

  /* Карточка существа (окно по касанию): иероглиф, чтение, значение, пример, озвучка */
  function showCard(i) {
    const e = E();
    const k = e.chars[i], en = k ? HZ.entry(k) : null;
    if (!en || !e.tiles[i]) return;
    const m = e.mast[k] || 0, sn = en.sents && en.sents[0], t = e.tiles[i], li = lineOf(e, i);
    say(e, k);
    const mate = t < MAXT ? e.tiles.findIndex((x, j) => j !== i && x === t) : -1;
    ui.modal(`${LINES[li][1]} · уровень ${t}`, h('div.evo-card.big',
      h('div.evo-card-sp', sprite(li, t)),
      h('div.evo-card-ch.zh' + (en.ch.length > 2 ? '.long' : ''), { lang: 'zh', onclick: () => ui.speak(en.ch) }, en.ch),
      h('div.evo-card-py', ui.py(en.py, 'lg'), ' ', h('button.icon-btn.speak', { type: 'button', title: 'Прослушать', 'aria-label': 'Прослушать', onclick: () => ui.speak(en.ch) }, '🔊')),
      h('div.evo-card-m', en.m),
      h('div.evo-mast.inline', Array.from({ length: MAST_MAX }, (_, j) => h('i' + (j < m ? '.on' : ''))), h('small.muted', ` знание ${m}/${MAST_MAX} · +${Math.round(m * 20)}% дохода`)),
      h('div.muted.small', `Доход существа: ${fmt(tileInc(e, i) * mult(e))} 🪙/с`),
      sn ? h('div.evo-card-s', h('span.zh', sn.z), ' ', h('button.icon-btn.speak', { type: 'button', onclick: () => ui.speak(sn.z), 'aria-label': 'Прослушать пример' }, '🔊'), h('div.muted.small', sn.p + ' — ' + sn.m)) : null,
      h('a.btn.sm.mt', { href: en.isWord ? '#/word/' + encodeURIComponent(en.ch) : '#/char/' + en.ch }, 'Полная карточка →')),
      [{ label: 'Закрыть' }, ...(mate >= 0 ? [{ label: '✨ Слить с таким же', primary: true, onclick: () => { setTimeout(() => merge(i, mate), 0); } }] : [])]);
  }

  /* Вспышка с новым иероглифом поверх поля */
  function flash(e, k) {
    const en = HZ.entry(k);
    if (!en || !T) return;
    const f = h('div.evo-flash', h('div.evo-flash-ch.zh', en.ch), h('div', ui.py(en.py, 'lg')), h('div.muted', en.m));
    T.el.wrap.appendChild(f);
    setTimeout(() => f.classList.add('out'), 1500); setTimeout(() => f.remove(), 1900);
  }


  /* ====== Перетаскивание и клики ====== */
  let drag = null;
  function down(ev, i) {
    const e = E();
    if (ev.button > 0 || !e.tiles[i]) return;
    drag = { i, x: ev.clientX, y: ev.clientY, moved: false, ghost: null, id: ev.pointerId };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  }
  function move(ev) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) > 8) {
      drag.moved = true;
      const src = T.cells[drag.i].firstChild;
      if (src) {
        const r = src.getBoundingClientRect();
        drag.ghost = src.cloneNode(true); drag.ghost.classList.add('ghost');
        drag.ghost.style.width = r.width + 'px'; drag.ghost.style.height = r.height + 'px';
        document.body.appendChild(drag.ghost);
        src.style.opacity = '.3';
      }
    }
    if (drag.ghost) {
      const w = parseFloat(drag.ghost.style.width), hh = parseFloat(drag.ghost.style.height);
      drag.ghost.style.left = (ev.clientX - w / 2) + 'px'; drag.ghost.style.top = (ev.clientY - hh / 2) + 'px';
    }
  }
  function cancel() { endDrag(); drag = null; if (T) drawTiles(); }
  function endDrag() { window.removeEventListener('pointermove', move); if (drag && drag.ghost) drag.ghost.remove(); }
  function up(ev) {
    if (!drag) return;
    const d = drag; endDrag(); drag = null;
    if (!T) return;
    if (d.moved) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const cell = el && el.closest && el.closest('.evo-cell');
      if (cell && T.el.board.contains(cell)) moveTo(d.i, +cell.dataset.i); else drawTiles();
      return;
    }
    // клик
    T.info = d.i; drawTiles(); showCard(d.i);
  }

  function moveTo(a, b) {
    const e = E();
    T.sel = -1;
    if (a === b || !e.tiles[a]) return drawTiles();
    if (!e.tiles[b]) { // переместить
      e.tiles[b] = e.tiles[a]; e.chars[b] = e.chars[a]; e.sp[b] = lineOf(e, a); e.tiles[a] = 0; e.chars[a] = null; e.sp[a] = null;
      T.info = b; touch(); drawTiles(); say(e, e.chars[b]); return;
    }
    if (e.tiles[a] === e.tiles[b]) return merge(a, b);
    lineOf(e, a); lineOf(e, b);
    [e.tiles[a], e.tiles[b]] = [e.tiles[b], e.tiles[a]]; [e.chars[a], e.chars[b]] = [e.chars[b], e.chars[a]]; [e.sp[a], e.sp[b]] = [e.sp[b], e.sp[a]];
    T.info = b; touch(); drawTiles();
  }

  function merge(a, b) {
    const e = E();
    T.sel = -1;
    const t = e.tiles[a];
    if (a === b || !t || t !== e.tiles[b]) return drawTiles();
    if (t >= MAXT) { ui.toast('Это высшая ступень эволюции'); return drawTiles(); }
    // результат слияния получает НОВЫЙ иероглиф из выбранной подборки
    const li = lineOf(e, b);
    const { entry } = nextEntry(e);
    const nk = entry.key || entry.ch;
    e.tiles[a] = 0; e.chars[a] = null; e.sp[a] = null;
    e.tiles[b] = t + 1; e.chars[b] = nk; e.sp[b] = li;
    e.merges++;
    ui.sfx('ok');
    let newTier = false;
    if (t + 1 > e.maxTier) { e.maxTier = t + 1; newTier = true; }
    T.info = b;
    touch(); drawTiles(); drawLadder(); refresh();
    const node = T.cells[b].firstChild; if (node) node.classList.add('merged');
    if (newTier) evolved(t + 1, nk, li); else { flash(e, nk); }
    say(e, nk);
  }

  function autoMerge() {
    const e = E(), by = {};
    for (let i = 0; i < e.tiles.length; i++) { const t = e.tiles[i]; if (t && t < MAXT) (by[t] = by[t] || []).push(i); }
    const t = Object.keys(by).map(Number).sort((x, y) => x - y).find(k => by[k].length >= 2);
    if (!t) return ui.toast('Нет одинаковых существ для слияния');
    merge(by[t][0], by[t][1]);
  }

  function evolved(t, ch, li) {
    const e = E();
    const xp = 5 * t;
    HZ.gami.addXP(xp);
    ui.confetti(t >= 10 ? 160 : 70); ui.sfx('level');
    if (t >= MAXT) HZ.gami.flag('evoMax');
    if (t >= 5) HZ.gami.flag('evo5');
    const en = ch ? HZ.entry(ch) : null;
    ui.modal(`Уровень эволюции ${t}!`, h('div.center',
      h('div.evo-big', sprite(li, t)),
      h('p', `${LINES[li][1]} · доход уровня: ${fmt(tierInc(t))} 🪙/с · +${xp} XP`),
      en ? h('div.evo-recall', h('p.muted.small', 'Новый иероглиф существа:'), h('div.big-char.lg', { lang: 'zh' }, en.ch), h('div', ui.py(en.py), ' ', h('button.icon-btn.speak', { type: 'button', onclick: () => ui.speak(en.ch), 'aria-label': 'Прослушать' }, '🔊'), ' · ', en.m)) : null),
      [{ label: 'Дальше', primary: true }]);
  }

  /* ====== Вопрос для призыва ====== */
  function ask() {
    const e = E();
    const cost = spawnCost(e);
    if (e.coins < cost) return ui.toast('Не хватает монет — подождите или сливайте существ', 'gold');
    if (e.tiles.indexOf(0) < 0) return ui.toast('Поле заполнено — слейте одинаковых существ');
    const { entry, pool } = nextEntry(e);
    const types = entry.isWord ? ['zh2ru', 'ru2zh', 'zh2py'] : ['zh2ru', 'ru2zh', 'zh2py', 'zh2ru', 'ru2zh'];
    const q = HZ.quiz.makeQuestion(entry, types[HZ.rand(types.length)], pool);
    const key = entry.key || entry.ch;
    let locked = false;

    const body = h('div');
    const opt = h('div.options' + (q.big ? '.big' : ''));
    q.options.forEach((o, i) => {
      const b = h('button.opt', { type: 'button', dataset: { k: o.key }, onclick: () => pick(b, o) }, h('kbd', String(i + 1)), h('span' + (q.big ? '.zh' : ''), o.label));
      opt.appendChild(b);
    });
    const tierSpawn = spawnTier(e);
    body.append(h('div.q-card.pop-in', h('div.q-prompt', q.prompt), h('p.muted.center', q.sub)), opt,
      h('p.muted.small.center', `Награда: существо уровня ${tierSpawn}` + (T.combo >= 5 ? ` (бонус серии ×${T.combo})` : '')));
    let closeFn = null;
    const onKey = ev => { if (!document.getElementById('modal').classList.contains('open')) return document.removeEventListener('keydown', onKey); if (/^[1-4]$/.test(ev.key) && !locked) { const b = opt.children[+ev.key - 1]; if (b) b.click(); } };
    document.addEventListener('keydown', onKey);
    closeFn = ui.modal('Призыв · 🪙 ' + fmt(cost), body, []);
    const prevOnClick = document.getElementById('modal').onclick;
    document.getElementById('modal').onclick = null; // нельзя закрыть кликом мимо, пока вопрос не решён
    if (q.audio) setTimeout(() => ui.speak(q.audio), 200);

    function done() { document.removeEventListener('keydown', onKey); document.getElementById('modal').onclick = prevOnClick; closeFn(); }

    function pick(btn, o) {
      if (locked) return; locked = true;
      const ok = o.key === q.answer;
      opt.querySelectorAll('.opt').forEach(b => { b.disabled = true; if (b.dataset.k === q.answer) b.classList.add('right'); });
      srs.record(key, ok);
      e.answered++; const m = e.mast[key] || 0;
      if (ok) {
        btn.classList.add('pulse'); ui.sfx('ok');
        e.right++; T.session.right++; T.combo++; e.bestCombo = Math.max(e.bestCombo, T.combo);
        e.mast[key] = Math.min(MAST_MAX, m + 1);
        const c2 = spawnCost(e);
        e.coins = Math.max(0, e.coins - c2);
        const at = e.tiles.indexOf(0), tr = spawnTier(e);
        if (at >= 0) { e.tiles[at] = tr; e.chars[at] = key; e.sp[at] = HZ.rand(LINES.length); e.spawned++; if (tr > e.maxTier) e.maxTier = tr; T.info = at; }
        e.coins += income(e) * 4; // небольшой бонус за верный ответ
        touch(); drawTiles(); drawLadder(); refresh();
        const n = T.cells[at] && T.cells[at].firstChild; if (n) n.classList.add('merged');
        setTimeout(() => { done(); say(e, key); }, 550);
      } else {
        btn.classList.add('wrong'); ui.sfx('bad');
        T.session.wrong++; T.combo = 0;
        e.mast[key] = Math.max(0, m - 2);
        requeue(entry);
        touch(); refresh();
        body.append(h('div.reveal', ui.py(entry.py, 'lg'), ' · ', entry.m, h('div.mt', h('a', { href: entry.isWord ? '#/word/' + encodeURIComponent(entry.ch) : '#/char/' + entry.ch }, 'Открыть карточку →'))),
          h('div.actions.center.mt', h('button.btn.primary', { type: 'button', onclick: done }, 'Понятно')));
      }
    }
  }
  function spawnTier(e) { return Math.min(MAXT, baseTier(e) + Math.min(2, Math.floor(T.combo / 5))); }

  /* ====== Перерождение ====== */
  function rebirth() {
    const e = E(), g = rebirthGain(e);
    if (g <= 0) return;
    ui.confirmBox('Перерождение', `Вы получите +${g} 💚 нефрита (постоянный бонус к доходу, а существа начнут расти с более высокого уровня). Монеты, существа и улучшения сбросятся. Знание иероглифов и бестиарий останутся.`, 'Переродиться', () => {
      const e2 = E();
      e2.jade += g; e2.reb++;
      e2.coins = 60 + 25 * e2.jade;
      e2.ups = { inc: 0, disc: 0, slots: 0, off: 0 };
      e2.tiles = []; e2.chars = []; e2.sp = []; e2.maxTier = 1; e2.spawned = 0;
      e2.last = Date.now();
      init(); T.combo = 0; T.sel = -1; T.info = -1;
      HZ.gami.addXP(20 + g); HZ.gami.flag('evoReb');
      ui.confetti(160); ui.sfx('level');
      touch(); buildBoard(); drawUps(); drawLadder(); refresh();
      ui.toast(`🌸 Новая эра ${e2.reb + 1}! Нефрит: ${e2.jade}`, 'gold', 4500);
    });
  }

  /* ====== Улучшения, подборка ====== */
  function buy(k) {
    const e = E(), u = UPS[k], lv = e.ups[k];
    if (lv >= u.max) return;
    const c = u.cost(lv);
    if (e.coins < c) return ui.toast('Не хватает монет');
    e.coins -= c; e.ups[k]++;
    if (k === 'slots') { init(); buildBoard(); }
    ui.sfx('ok'); touch(); drawUps(); refresh();
  }
  function drawUps() {
    const e = E();
    ui.clear(T.el.ups);
    T.el.upBtns = {};
    Object.keys(UPS).forEach(k => {
      const u = UPS[k], lv = e.ups[k], maxed = lv >= u.max;
      const b = h('button.btn.evo-up', { type: 'button', onclick: () => buy(k) },
        h('span.ico', u.ico),
        h('span.evo-up-t', h('b', `${u.name} · ур. ${lv}`), h('small.muted', u.desc(lv))),
        h('span.evo-up-c', maxed ? 'MAX' : '🪙 ' + fmt(u.cost(lv))));
      b.disabled = maxed; T.el.upBtns[k] = b;
      T.el.ups.appendChild(b);
    });
  }
  function drawLadder() {
    const e = E();
    ui.clear(T.el.ladder);
    T.el.ladder.append(...LINES.map(([, name, S], li) => h('div.evo-line', h('b', name),
      h('div.evo-stages', Array.from({ length: S }, (_, st) => {
        const first = Math.floor(st * MAXT / S) + 1, known = first <= Math.max(e.bestTier || 1, e.maxTier);
        return h('div.evo-step' + (known ? '' : '.locked'), { title: known ? `${name}, с уровня ${first}` : 'Откроется на уровне ' + first },
          sprite(li, first), h('small', 'ур. ' + first));
      })))));
  }

  function refresh(quiet) {
    const e = E();
    if (!T) return;
    T.el.coins.textContent = fmt(e.coins);
    T.el.inc.textContent = `+${fmt(income(e))} 🪙/с · выученное +${Math.round(knownBonus() * 100)}%` + (e.jade ? ` · 💚 ${e.jade}` : '');
    const cost = spawnCost(e), full = e.tiles.indexOf(0) < 0;
    T.el.spawn.textContent = full ? 'Поле заполнено' : `🧬 Призвать · 🪙 ${fmt(cost)}`;
    T.el.spawn.disabled = full || e.coins < cost;
    T.el.combo.textContent = T.combo >= 2 ? `🔥 Серия ×${T.combo}${T.combo >= 5 ? ' · бонус к виду' : ''}` : `✔ ${e.right}/${e.answered}`;
    T.el.combo.classList.toggle('hot', T.combo >= 2);
    T.el.srcBtn.textContent = '📚 ' + srcName(e.src) + ' ▾';
    const g = rebirthGain(e);
    T.el.rebText.textContent = `Нефрит 💚 ${e.jade} (+${Math.round(e.jade * 4)}% к доходу${gapOf(e) < 6 ? `, существа сразу появляются на ${6 - gapOf(e)} ур. выше` : ''}). Перерождений: ${e.reb}. Сбрасываются монеты, существа и улучшения; знание иероглифов, бестиарий и нефрит остаются. ` + (g > 0 ? `Сейчас можно получить +${g} 💚.` : `Доступно с 10-го уровня эволюции (сейчас ${e.maxTier}).`);
    T.el.rebBtn.textContent = g > 0 ? `🌸 Переродиться · +${g} 💚` : '🌸 Переродиться';
    T.el.rebBtn.disabled = g <= 0;
    T.el.snd.textContent = e.sound === false ? '🔇 Звук выкл' : '🔊 Звук вкл';
    if (T.el.upBtns) Object.keys(UPS).forEach(k => { const u = UPS[k]; T.el.upBtns[k].classList.toggle('afford', e.ups[k] < u.max && e.coins >= u.cost(e.ups[k])); });
  }

  function pickSource() {
    const e = E();
    const groups = {};
    sources().forEach(s => (groups[s.group] = groups[s.group] || []).push(s));
    const body = h('div.evo-srcs');
    Object.keys(groups).forEach(g => {
      body.append(h('h4', g), h('div.evo-src-list', groups[g].map(s => {
        const ok = !!poolOf(s.id);
        return h('button.evo-src-item' + (e.src === s.id ? '.on' : '') + (ok ? '' : '.off'), { type: 'button', disabled: !ok, onclick: () => {
          e.src = s.id; queue = []; queueSrc = null; touch(); refresh(); document.getElementById('modal').classList.remove('open');
        } }, h('span', s.ico + ' ' + s.name), s.n ? h('small.muted', String(s.n)) : (ok ? null : h('small.muted', 'мало')));
      })));
    });
    ui.modal('Что учим в Эволюции?', h('div', h('p.muted.small', 'Вопросы берутся из выбранной подборки. Хотите учить свои — создайте подборку в разделе «Подборки».'), body), [{ label: 'Закрыть' }]);
  }

  HZ.evo = { view, LINES, tierInc, fmt, init, income, spawnCost };
})();
