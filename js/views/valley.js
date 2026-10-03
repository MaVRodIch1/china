/* «Долина знаков»: большая карта с камерой, локации по уровню героя, враги-кляксы, оружие и прокачка.
 * Учёба: задание «найди знак» (по значению или чтению) — верный знак даёт монеты, опыт и лечение;
 * ошибка порождает кляксы, которые несут на себе перепутанный знак. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs, G = HZ.games;
  const { makeRound, makeQueue, accOf, pool0, spriteOf, controls, setupCanvas, rr, firstGloss, keyOf, fmt } = HZ.play;

  /* ====== Мир ====== */
  const WW = 2400, WH = 1600;
  const CAMP = { x: WW / 2, y: WH / 2, r: 150 };
  const LOCS = [
    { name: 'Бамбуковая роща', ico: '🎋', req: 1, g: ['#9fd37f', '#94cb74', '#a6d887'], deco: ['🎋', '🌳', '🌿', '🍄', '🌸', '🪨', '🌼'], blob: '#2c2838', mul: 1, dmg: 1, coin: 1, xp: 1 },
    { name: 'Пустыня Гоби', ico: '🏜️', req: 5, g: ['#ead5a0', '#e2cb92', '#efdcac'], deco: ['🌵', '🪨', '🦴', '🏺', '🌾', '🐫'], blob: '#8a5226', mul: 2, dmg: 1.5, coin: 1.8, xp: 1.5 },
    { name: 'Снежные горы', ico: '🏔️', req: 10, g: ['#e6eff6', '#dce8f1', '#eef4f9'], deco: ['🌲', '❄️', '⛄', '🪨', '🏔️', '🌨️'], blob: '#2f63a8', mul: 3.5, dmg: 2.1, coin: 3, xp: 2.2 },
    { name: 'Огненная долина', ico: '🌋', req: 15, g: ['#6e4a3e', '#664338', '#76503f'], deco: ['🌋', '🔥', '🪨', '💀', '🌑', '♨️'], blob: '#d23f22', mul: 6, dmg: 2.9, coin: 5, xp: 3.2 },
    { name: 'Небесный храм', ico: '⛩️', req: 20, g: ['#f2dbe7', '#ebd1df', '#f6e3ec'], deco: ['⛩️', '🏮', '🌸', '☁️', '🎐', '🐉'], blob: '#7b3db3', mul: 10, dmg: 4, coin: 8, xp: 4.5 }
  ];
  const ETYPES = {
    small: { r: 15, hp: 16, sp: 110, dmg: 5, xp: 3, coin: 2 },
    mid: { r: 23, hp: 40, sp: 76, dmg: 8, xp: 7, coin: 5 },
    big: { r: 34, hp: 100, sp: 50, dmg: 13, xp: 18, coin: 14, split: true },
    king: { r: 48, hp: 520, sp: 44, dmg: 20, xp: 90, coin: 80 }
  };

  /* ====== Прокачка ====== */
  const UPS = {
    hp: { tab: 'hero', ico: '❤️', name: 'Здоровье', desc: lv => `+20 к здоровью (сейчас +${lv * 20})`, cost: lv => Math.round(50 * Math.pow(1.6, lv)), max: 20 },
    armor: { tab: 'hero', ico: '🛡️', name: 'Броня', desc: lv => `−5% урона от клякс (сейчас −${Math.min(60, lv * 5)}%)`, cost: lv => Math.round(80 * Math.pow(1.75, lv)), max: 12 },
    regen: { tab: 'hero', ico: '💗', name: 'Восстановление', desc: lv => `Здоровье восстанавливается быстрее (${(.5 + .6 * lv).toFixed(1)}/с, в лагере ×8)`, cost: lv => Math.round(70 * Math.pow(1.7, lv)), max: 15 },
    speed: { tab: 'hero', ico: '👟', name: 'Быстрые ноги', desc: lv => `+7% к скорости (сейчас ×${(1 + .07 * lv).toFixed(2)})`, cost: lv => Math.round(40 * Math.pow(1.7, lv)), max: 12 },
    magnet: { tab: 'hero', ico: '🧲', name: 'Магнит', desc: lv => `Монеты притягиваются издалека, знаки подбираются легче (+${lv * 18} px)`, cost: lv => Math.round(60 * Math.pow(1.8, lv)), max: 10 },
    income: { tab: 'eco', ico: '🌾', name: 'Ферма', desc: lv => `+1,2 🪙/с пассивно (сейчас +${(lv * 1.2).toFixed(1)})`, cost: lv => Math.round(50 * Math.pow(1.6, lv)), max: 30 },
    reward: { tab: 'eco', ico: '💎', name: 'Награда за знак', desc: lv => `+15% монет за верный знак (сейчас +${lv * 15}%)`, cost: lv => Math.round(80 * Math.pow(1.7, lv)), max: 30 },
    wisdom: { tab: 'eco', ico: '🧠', name: 'Мудрость', desc: lv => `Подсказка с чтением через ${Math.max(1.5, 9 - 1.2 * lv).toFixed(1)} с${lv >= 5 ? ', нужный знак светится' : ' (с 5 ур. нужный знак светится)'}`, cost: lv => Math.round(120 * Math.pow(2, lv)), max: 6 }
  };
  const WEAPONS = {
    brush: { ico: '🖌️', name: 'Кисть мастера', desc: 'Взмах по кляксам рядом с героем', cost: lv => Math.round(60 * Math.pow(1.75, lv)), max: 10,
      st: lv => ({ dmg: 12 + 6 * (lv - 1), cd: Math.max(.35, .8 - .045 * (lv - 1)), range: 90 + 5 * (lv - 1) }), info: s => `урон ${s.dmg} · раз в ${s.cd.toFixed(2)} с · радиус ${s.range}` },
    glyph: { ico: '🀄', name: 'Летящие знаки', desc: 'Метает иероглифы в дальних клякс', cost: lv => Math.round(150 * Math.pow(1.8, lv)), max: 10,
      st: lv => ({ dmg: 9 + 5 * (lv - 1), cd: Math.max(.4, 1.2 - .08 * (lv - 1)), range: 430, count: 1 + Math.floor((lv - 1) / 3) }), info: s => `урон ${s.dmg} · ${s.count} шт. раз в ${s.cd.toFixed(2)} с` },
    orbit: { ico: '🏮', name: 'Фонари-хранители', desc: 'Фонари кружат вокруг героя и обжигают клякс', cost: lv => Math.round(300 * Math.pow(1.85, lv)), max: 8,
      st: lv => ({ dmg: 8 + 4 * (lv - 1), n: 1 + Math.floor(lv / 2), radius: 72 + 5 * lv }), info: s => `урон ${s.dmg} · фонарей ${s.n}` },
    gong: { ico: '🔔', name: 'Гонг', desc: 'Волна бьёт и отбрасывает всех вокруг', cost: lv => Math.round(500 * Math.pow(1.9, lv)), max: 8,
      st: lv => ({ dmg: 25 + 12 * (lv - 1), cd: Math.max(2.2, 6 - .45 * (lv - 1)), radius: 150 + 12 * lv }), info: s => `урон ${s.dmg} · раз в ${s.cd.toFixed(1)} с · радиус ${s.radius}` }
  };
  const PET_MAX = 6;
  const petCost = n => Math.round(200 * Math.pow(2.5, n));

  function WS() {
    let v = store.s.walk;
    if (!v || typeof v !== 'object') v = store.s.walk = {};
    const d = { coins: 0, ups: {}, wp: { brush: 1, glyph: 0, orbit: 0, gong: 0 }, pets: [], skin: 0, right: 0, wrong: 0, bestCombo: 0, sound: true, last: Date.now(), upd: 0, hp: null, loc: 0, maxLoc: 0, kills: 0, deaths: 0 };
    if (v.xp === undefined) v.xp = (v.right || 0) * 10; // перенос прогресса из первой версии
    Object.keys(d).forEach(k => { if (v[k] === undefined) v[k] = d[k]; });
    v.ups = Object.assign({ hp: 0, armor: 0, regen: 0, speed: 0, magnet: 0, income: 0, reward: 0, wisdom: 0 }, v.ups);
    v.wp = Object.assign({ brush: 1, glyph: 0, orbit: 0, gong: 0 }, v.wp);
    if (!LOCS[v.loc]) v.loc = 0;
    return v;
  }
  const heroLvl = v => 1 + Math.floor(Math.sqrt(v.xp / 40));
  const xpAt = l => 40 * (l - 1) * (l - 1);
  const maxHp = v => 100 + 20 * v.ups.hp + 10 * (heroLvl(v) - 1);
  const armorMul = v => 1 - Math.min(.6, .05 * v.ups.armor);
  const regenOf = v => .5 + .6 * v.ups.regen;
  const speedOf = v => 200 * (1 + .07 * v.ups.speed);
  const magnetR = v => 70 + 18 * v.ups.magnet;
  const incomeOf = v => (0.2 + 1.2 * v.ups.income + 2.5 * v.pets.length) * (1 + .1 * (heroLvl(v) - 1));
  const touchW = () => { store.s.walk.upd = Date.now(); store.save(); };

  /* Кэш эмодзи как картинок — быстрее, чем fillText каждый кадр */
  const emojiCache = {};
  function emo(ch, size) {
    const k = ch + size;
    if (!emojiCache[k]) {
      const c = document.createElement('canvas'), s = Math.ceil(size * 1.4);
      c.width = c.height = s;
      const x = c.getContext('2d'); x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, s / 2, s / 2 + size * .05);
      emojiCache[k] = c;
    }
    return emojiCache[k];
  }
  function decoFor(li) { // детерминированные украшения локации
    let seed = 1234 + li * 977; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const out = [], L = LOCS[li];
    for (let k = 0; k < 340; k++) {
      const x = 30 + rnd() * (WW - 60), y = 30 + rnd() * (WH - 60);
      if (Math.hypot(x - CAMP.x, y - CAMP.y) < CAMP.r + 60) continue;
      out.push({ x, y, e: L.deco[Math.floor(rnd() * L.deco.length)], s: 22 + Math.floor(rnd() * 3) * 6 });
    }
    return out;
  }

  /* ====== Игра ====== */
  function view() {
    const v = WS();
    const root = document.getElementById('view');
    const area = h('div.page.walk');
    ui.clear(root).append(area);
    const narrow = (area.clientWidth || window.innerWidth) < 640;
    const VW = narrow ? 540 : 960, VH = narrow ? 640 : 600;
    const canvas = h('canvas.wk-canvas', { tabindex: 0, style: { aspectRatio: `${VW} / ${VH}` } });
    const ctx = setupCanvas(canvas, VW, VH);

    // оффлайн-доход
    const away = Math.min(4 * 3600, Math.max(0, (Date.now() - (v.last || Date.now())) / 1000));
    if (away > 60) { const g = incomeOf(v) * away * 0.5; v.coins += g; ui.toast(`🌙 Пока вас не было, ферма принесла ${fmt(g)} 🪙`, 'gold', 4500); }
    v.last = Date.now();
    if (v.hp == null || v.hp <= 0) v.hp = maxHp(v);
    store.save();

    const el = { coins: h('b.wk-coins', ''), inc: h('span.muted.small'), lvl: h('span.hud-pill'), loc: h('span.hud-pill.wk-locpill'), combo: h('span.hud-pill'), banner: h('div.wk-banner'),
      shop: h('button.btn.sm', { type: 'button', onclick: () => shop('hero') }, '🛒 Магазин'),
      snd: h('button.btn.sm', { type: 'button', onclick: () => { v.sound = !v.sound; touchW(); hud(); } }) };
    const src = G.srcSelect(() => newRound());
    area.append(
      h('div.wk-top', h('div', h('div.evo-coin-row', h('span.evo-coin', '🪙'), el.coins), el.inc), h('div.wk-pills', el.lvl, el.loc, el.combo)),
      h('div.wk-bar', el.shop, h('button.btn.sm', { type: 'button', onclick: () => mapDialog() }, '🗺️ Карта'), h('button.btn.sm', { type: 'button', onclick: () => heroPicker() }, '🐾 Герой'), el.snd, h('label.wk-src', h('span.muted.small', '🎯'), src)),
      el.banner, canvas,
      h('p.muted.small.center', 'WASD или стрелки (на телефоне — ведите пальцем по полю). Оружие бьёт само. Найдите знак из задания — получите монеты, опыт и лечение. Ошибка рождает кляксы с перепутанным знаком. В лагере 🏕️ кляксы не трогают, а здоровье быстро восстанавливается.'));

    let L = LOCS[v.loc], deco = decoFor(v.loc);
    const P = { x: CAMP.x, y: CAMP.y + 40, face: 1, bob: 0, moving: false, inv: 2, kx: 0, ky: 0 };
    const cam = { x: 0, y: 0 }, trail = [];
    let enemies = [], bubbles = [], drops = [], shots = [], fx = [], slashes = [], waves = [];
    let quest = null, combo = 0, hintShown = false, roundWrong = false, stop = false, raf = 0, last = performance.now();
    let spawnT = 0, saveT = 0, hudT = 0, shake = 0, hurtSfxT = 0, lastLvl = heroLvl(v), orbitA = 0;
    const wt = { brush: 0, glyph: 0, gong: 0 }, petT = [];
    const session = { right: 0, wrong: 0 };
    const queue = makeQueue(pool0, e => accOf(e) * 5);
    const ctl = controls(canvas);
    const cleanup = () => { stop = true; cancelAnimationFrame(raf); ctl.destroy(); v.last = Date.now(); store.save(); };
    HZ.router.onLeave(() => { cleanup(); const n = session.right; if (n >= 5) { HZ.gami.addXP(n); HZ.gami.onGame(n, n + session.wrong); } else if (n) HZ.gami.addXP(n); });

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const inCamp = p => dist(p, CAMP) < CAMP.r;
    const dmgMul = () => (1 + .06 * (heroLvl(v) - 1)) * (1 + .04 * Math.min(combo, 10));

    function hud() {
      const lv = heroLvl(v);
      el.coins.textContent = fmt(v.coins);
      el.inc.textContent = `+${fmt(incomeOf(v))} 🪙/с · кляксы: ${v.kills}`;
      el.lvl.textContent = `⭐ Ур. ${lv}`;
      el.loc.textContent = `${L.ico} ${L.name}`;
      el.combo.textContent = combo >= 2 ? `🔥 ×${combo} · +${Math.min(combo, 10) * 4}% урона` : 'Серия 0'; el.combo.classList.toggle('hot', combo >= 2);
      el.snd.textContent = v.sound ? '🔊' : '🔇';
      const aff = Object.keys(UPS).some(k => v.ups[k] < UPS[k].max && v.coins >= UPS[k].cost(v.ups[k])) || Object.keys(WEAPONS).some(k => v.wp[k] < WEAPONS[k].max && v.coins >= WEAPONS[k].cost(v.wp[k])) || (v.pets.length < PET_MAX && v.coins >= petCost(v.pets.length));
      el.shop.classList.toggle('afford', aff);
    }
    function banner() {
      if (!quest) return;
      const e = quest.e, hintDelay = Math.max(1.5, 9 - 1.2 * v.ups.wisdom), hintOn = hintShown || quest.wrong;
      ui.clear(el.banner).append(quest.type === 'm'
        ? h('div', h('span.muted', 'Найди знак: '), h('b.wk-target', firstGloss(e.m)), hintOn ? h('span.wk-hint', ' ', ui.py(e.py, 'lg')) : h('span.muted.small', ` · подсказка через ${Math.max(0, Math.ceil(hintDelay - (performance.now() - quest.t0) / 1000))} с`))
        : h('div', h('span.muted', 'Найди знак с чтением: '), h('b.wk-target', ui.py(e.py, 'lg')), hintOn ? h('span.wk-hint.muted', ' · ' + firstGloss(e.m)) : null));
      if (quest.wrong && quest.reveal) el.banner.append(h('div.small.wk-reveal', quest.reveal));
    }

    /* --- задание «найди знак» --- */
    function newRound() {
      const { e, pool } = queue.next();
      if (!e) return;
      const n = Math.min(7, 3 + Math.floor((heroLvl(v) - 1) / 3));
      const r = makeRound(e, pool, n);
      quest = { e, type: Math.random() < .65 ? 'm' : 'py', t0: performance.now(), wrong: false };
      hintShown = false; roundWrong = false; bubbles = [];
      r.items.forEach(it => {
        let p = null;
        for (let t = 0; t < 120 && !p; t++) {
          const a = Math.random() * 6.283, d = 260 + Math.random() * 380, x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
          if (x < 90 || y < 90 || x > WW - 90 || y > WH - 90) continue;
          if (dist({ x, y }, CAMP) < CAMP.r + 50 || bubbles.some(b => Math.hypot(b.x - x, b.y - y) < 150)) continue;
          p = { x, y };
        }
        if (!p) p = { x: Math.min(WW - 90, Math.max(90, P.x + (Math.random() - .5) * 600)), y: Math.min(WH - 90, Math.max(90, P.y + (Math.random() - .5) * 400)) };
        bubbles.push({ x: p.x, y: p.y, e: it, ok: it === e, ph: Math.random() * 6, r: 38, dead: 0, pop: 0 });
      });
      banner(); hud();
    }
    function onRight(b) {
      const e = quest.e, li = v.loc;
      combo++; v.right++; session.right++; v.bestCombo = Math.max(v.bestCombo, combo);
      const gain = Math.round((8 + heroLvl(v) * 2 + Math.min(combo, 15) * 2) * (1 + .15 * v.ups.reward) * LOCS[li].coin * (roundWrong ? .5 : 1));
      v.coins += gain;
      addXp(Math.round((12 + Math.min(combo, 10) * 2) * (1 + .25 * li)));
      v.hp = Math.min(maxHp(v), v.hp + maxHp(v) * .1);
      srs.record(keyOf(e), true);
      floatText(b.x, b.y - 30, '+' + gain + ' 🪙', '#e0a000'); burst(b.x, b.y, '#ffd34d', 18);
      ui.sfx('ok'); if (v.sound) ui.speak(e.ch);
      b.pop = 1; bubbles.forEach(x => { if (x !== b) x.dead = Math.max(x.dead, .01); });
      quest.done = true; touchW(); hud();
      setTimeout(() => { if (!stop) newRound(); }, 650);
    }
    function onWrong(b) {
      const e = quest.e;
      combo = 0; v.wrong++; session.wrong++;
      const loss = Math.round(v.coins * .04); v.coins -= loss;
      if (!roundWrong) { srs.record(keyOf(e), false); queue.again(e); }
      roundWrong = true; b.dead = .01;
      floatText(b.x, b.y - 30, 'Ошибка рождает кляксы!', '#d64545'); burst(b.x, b.y, '#d64545', 14); ui.sfx('bad');
      for (let i = 0; i < 2; i++) { const a = Math.random() * 6.283; spawnEnemy('small', b.x + Math.cos(a) * 60, b.y + Math.sin(a) * 60, b.e); }
      quest.wrong = true;
      quest.reveal = h('span', '«', b.e.ch, '» — ', ui.py(b.e.py), ' ', firstGloss(b.e.m));
      banner(); hud(); touchW();
    }

    /* --- опыт, уровни, локации --- */
    function addXp(n) {
      v.xp += n;
      const lv = heroLvl(v);
      if (lv > lastLvl) {
        lastLvl = lv; v.hp = maxHp(v);
        ui.toast(`⭐ Уровень героя ${lv}! Здоровье и сила выросли`, 'gold', 3000); ui.sfx('level'); ui.confetti(60);
        LOCS.forEach((l, i) => { if (lv >= l.req && i > v.maxLoc) { v.maxLoc = i; setTimeout(() => ui.toast(`🗺️ Открыта локация: ${l.ico} ${l.name}! Откройте «Карту»`, 'gold', 5000), 600); } });
        touchW();
      }
    }
    function travel(i) {
      if (i > v.maxLoc) return;
      v.loc = i; L = LOCS[i]; deco = decoFor(i);
      enemies = []; drops = []; shots = []; P.x = CAMP.x; P.y = CAMP.y + 40; P.inv = 2; trail.length = 0;
      touchW(); newRound(); hud();
      ui.toast(`${L.ico} ${L.name}`, 'gold', 2500);
    }

    /* --- кляксы --- */
    function spawnEnemy(type, x, y, glyph) {
      const T = ETYPES[type];
      const hp = Math.round(T.hp * L.mul);
      enemies.push({ type, x, y, r: T.r, hp, max: hp, sp: T.sp * (.9 + Math.random() * .2), dmg: T.dmg * L.dmg, xp: T.xp * L.xp, coin: T.coin * L.coin, kx: 0, ky: 0, hit: 0, ph: Math.random() * 6, wa: Math.random() * 6.283, wt: 0, oc: 0, glyph: glyph || null });
    }
    function spawnTick() {
      const li = v.loc, lv = heroLvl(v);
      const target = Math.min(24, 6 + 2 * li + Math.floor(lv / 3));
      if (enemies.length >= target) return;
      const far = Math.max(VW, VH) * .6 + 100;
      for (let t = 0; t < 30; t++) {
        const x = 60 + Math.random() * (WW - 120), y = 60 + Math.random() * (WH - 120);
        if (Math.hypot(x - P.x, y - P.y) < far || Math.hypot(x - CAMP.x, y - CAMP.y) < CAMP.r + 250) continue;
        const r = Math.random();
        const type = !enemies.some(e => e.type === 'king') && r < .03 ? 'king' : r < .15 + .03 * li ? 'big' : r < .55 ? 'mid' : 'small';
        const pool = pool0();
        spawnEnemy(type, x, y, (Math.random() < .22 || type === 'king') && pool.length ? pool[HZ.rand(pool.length)] : null);
        return;
      }
    }
    function hurt(e, dmg, kx, ky) {
      dmg = Math.round(dmg * dmgMul());
      e.hp -= dmg; e.hit = .12; e.kx += kx || 0; e.ky += ky || 0;
      fx.push({ type: 'num', x: e.x + (Math.random() - .5) * 10, y: e.y - e.r, text: String(dmg), t: 0 });
      if (e.hp <= 0 && !e.dead) kill(e);
    }
    function kill(e) {
      e.dead = true; v.kills++;
      addXp(Math.round(e.xp));
      const n = Math.min(6, Math.max(1, Math.round(e.coin / 4)));
      for (let i = 0; i < n; i++) drops.push({ type: 'coin', x: e.x + (Math.random() - .5) * e.r * 2, y: e.y + (Math.random() - .5) * e.r * 2, val: e.coin / n, t: 0 });
      if (Math.random() < (e.type === 'king' ? 1 : .06)) drops.push({ type: 'heart', x: e.x, y: e.y, t: 0 });
      burst(e.x, e.y, L.blob, e.type === 'king' ? 40 : 14);
      if (ETYPES[e.type].split) for (let i = 0; i < 2; i++) spawnEnemy('small', e.x + (i ? 18 : -18), e.y, null);
      if (e.glyph) { floatText(e.x, e.y - e.r - 16, `${e.glyph.ch} — ${firstGloss(e.glyph.m)}`, '#7a4dc9', 1.8); }
      if (e.type === 'king') { ui.toast('👑 Королевская клякса повержена!', 'gold', 3000); ui.confetti(90); }
    }

    /* --- эффекты --- */
    function floatText(x, y, text, color, life) { fx.push({ type: 'txt', x, y, text, color, t: 0, life: life || 1 }); }
    function burst(x, y, color, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 60 + Math.random() * 160; fx.push({ type: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, color }); } }

    function nearest(p, range, skip) {
      let best = null, bd = range;
      for (const e of enemies) { if (e.dead || (skip && skip.has(e))) continue; const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r; if (d < bd) { bd = d; best = e; } }
      return best;
    }

    /* ====== Обновление ====== */
    function update(dt) {
      const lv = heroLvl(v), mhp = maxHp(v);
      // движение героя
      const [dx, dy] = ctl.vec();
      const sp = speedOf(v);
      P.moving = Math.hypot(dx, dy) > .05;
      P.x += (dx * sp + P.kx) * dt; P.y += (dy * sp + P.ky) * dt;
      P.kx *= Math.exp(-8 * dt); P.ky *= Math.exp(-8 * dt);
      P.x = Math.max(30, Math.min(WW - 30, P.x)); P.y = Math.max(50, Math.min(WH - 20, P.y));
      if (dx > .1) P.face = 1; else if (dx < -.1) P.face = -1;
      if (P.moving) { trail.unshift({ x: P.x, y: P.y }); if (trail.length > 160) trail.length = 160; P.bob += dt * 12; }
      P.inv = Math.max(0, P.inv - dt);
      const camp = inCamp(P);
      v.hp = Math.min(mhp, v.hp + regenOf(v) * dt * (camp ? 8 : 1));
      v.coins += incomeOf(v) * dt;

      // кляксы
      spawnT -= dt; if (spawnT <= 0) { spawnT = 1; spawnTick(); }
      const aggro = 360 + 20 * v.loc;
      for (const e of enemies) {
        if (e.dead) continue;
        const ex = P.x - e.x, ey = P.y - e.y, d = Math.hypot(ex, ey) || 1;
        let mx, my;
        if (d < aggro && !camp) { mx = ex / d; my = ey / d; }
        else { e.wt -= dt; if (e.wt <= 0) { e.wa = Math.random() * 6.283; e.wt = 1.5 + Math.random() * 2; } mx = Math.cos(e.wa) * .45; my = Math.sin(e.wa) * .45; }
        e.x += (mx * e.sp + e.kx) * dt; e.y += (my * e.sp + e.ky) * dt;
        e.kx *= Math.exp(-6 * dt); e.ky *= Math.exp(-6 * dt);
        const dc = Math.hypot(e.x - CAMP.x, e.y - CAMP.y);
        if (dc < CAMP.r + e.r) { const k = (CAMP.r + e.r) / (dc || 1); e.x = CAMP.x + (e.x - CAMP.x) * k; e.y = CAMP.y + (e.y - CAMP.y) * k; e.wa += Math.PI; }
        e.x = Math.max(e.r, Math.min(WW - e.r, e.x)); e.y = Math.max(e.r, Math.min(WH - e.r, e.y));
        e.hit = Math.max(0, e.hit - dt); e.oc = Math.max(0, e.oc - dt);
        if (d < e.r + 22 && P.inv <= 0 && !camp) { // касание — урон герою
          const dmg = Math.round(e.dmg * armorMul(v));
          v.hp -= dmg; P.inv = .8; P.kx = -ex / d * 320; P.ky = -ey / d * 320; shake = .25;
          fx.push({ type: 'txt', x: P.x, y: P.y - 70, text: '−' + dmg, color: '#d64545', t: 0, life: .8 });
          if (hurtSfxT <= 0) { ui.sfx('bad'); hurtSfxT = .3; }
        }
      }
      hurtSfxT -= dt;
      for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) { // не слипаются
        const a = enemies[i], b = enemies[j], ddx = b.x - a.x, ddy = b.y - a.y, dd = Math.hypot(ddx, ddy) || 1, m = a.r + b.r;
        if (dd < m) { const push = (m - dd) / 2; a.x -= ddx / dd * push; a.y -= ddy / dd * push; b.x += ddx / dd * push; b.y += ddy / dd * push; }
      }
      if (v.hp <= 0) return die();

      // оружие
      const W = {}; Object.keys(WEAPONS).forEach(k => { if (v.wp[k] > 0) W[k] = WEAPONS[k].st(v.wp[k]); });
      if (W.brush) {
        wt.brush -= dt;
        const t = nearest(P, W.brush.range);
        if (wt.brush <= 0 && t) {
          wt.brush = W.brush.cd;
          const ang = Math.atan2(t.y - P.y, t.x - P.x);
          slashes.push({ x: P.x, y: P.y, a: ang, r: W.brush.range, t: 0 });
          for (const e of enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.x - P.x, e.y - P.y) - e.r, a = Math.atan2(e.y - P.y, e.x - P.x);
            let da = Math.abs(a - ang); if (da > Math.PI) da = 2 * Math.PI - da;
            if (d < W.brush.range && da < 1.1) hurt(e, W.brush.dmg, Math.cos(a) * 160, Math.sin(a) * 160);
          }
        }
      }
      if (W.glyph) {
        wt.glyph -= dt;
        if (wt.glyph <= 0) {
          const skip = new Set(); const pool = pool0();
          for (let i = 0; i < W.glyph.count; i++) {
            const t = nearest(P, W.glyph.range, skip); if (!t) break; skip.add(t);
            const a = Math.atan2(t.y - P.y, t.x - P.x);
            shots.push({ x: P.x, y: P.y - 30, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: W.glyph.dmg, life: 1.2, target: t, txt: pool.length ? pool[HZ.rand(pool.length)].ch.slice(0, 2) : '字', kind: 'glyph' });
          }
          wt.glyph = skip.size ? W.glyph.cd : .2;
        }
      }
      if (W.orbit) {
        orbitA += dt * 2.6;
        for (let i = 0; i < W.orbit.n; i++) {
          const a = orbitA + i * 6.283 / W.orbit.n, ox = P.x + Math.cos(a) * W.orbit.radius, oy = P.y - 24 + Math.sin(a) * W.orbit.radius;
          for (const e of enemies) if (!e.dead && e.oc <= 0 && Math.hypot(e.x - ox, e.y - oy) < e.r + 14) { e.oc = .35; hurt(e, W.orbit.dmg, (e.x - P.x) * .8, (e.y - P.y) * .8); }
        }
      }
      if (W.gong) {
        wt.gong -= dt;
        if (wt.gong <= 0 && nearest(P, W.gong.radius)) {
          wt.gong = W.gong.cd; waves.push({ x: P.x, y: P.y, max: W.gong.radius, t: 0 }); ui.sfx('click');
          for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; if (d - e.r < W.gong.radius) hurt(e, W.gong.dmg, (e.x - P.x) / d * 420, (e.y - P.y) / d * 420); }
        }
      }
      // питомцы стреляют
      v.pets.forEach((li2, i) => {
        petT[i] = (petT[i] || Math.random()) - dt;
        if (petT[i] > 0) return;
        const pp = trail[Math.min(trail.length - 1, (i + 1) * 16)] || P;
        const t = nearest(pp, 380);
        petT[i] = t ? 1.6 : .3;
        if (t) { const a = Math.atan2(t.y - pp.y, t.x - pp.x); shots.push({ x: pp.x, y: pp.y - 20, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, dmg: 4 + 1.5 * lv, life: 1, target: t, kind: 'pet' }); }
      });
      // снаряды
      for (const s of shots) {
        if (s.target && !s.target.dead) { const a = Math.atan2(s.target.y - s.y, s.target.x - s.x), sp2 = Math.hypot(s.vx, s.vy); s.vx += (Math.cos(a) * sp2 - s.vx) * Math.min(1, dt * 6); s.vy += (Math.sin(a) * sp2 - s.vy) * Math.min(1, dt * 6); }
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - s.x, e.y - s.y) < e.r + 10) { hurt(e, s.dmg, s.vx * .25, s.vy * .25); s.life = 0; break; }
      }
      shots = shots.filter(s => s.life > 0);
      enemies = enemies.filter(e => !e.dead);

      // монеты и сердца
      const mr = magnetR(v);
      for (const d of drops) {
        d.t += dt;
        const dd = Math.hypot(P.x - d.x, P.y - 20 - d.y);
        if (dd < mr) { const k = Math.min(1, dt * 7); d.x += (P.x - d.x) * k; d.y += (P.y - 20 - d.y) * k; }
        if (dd < 26) {
          d.got = true;
          if (d.type === 'coin') v.coins += d.val;
          else { v.hp = Math.min(mhp, v.hp + mhp * .25); floatText(P.x, P.y - 80, '+❤️', '#d64545'); }
        }
      }
      drops = drops.filter(d => !d.got && d.t < 45);

      // знаки задания
      if (quest && !quest.done) {
        const mag = 4 * v.ups.magnet;
        for (const b of bubbles) {
          if (b.dead || b.pop) continue;
          if (Math.hypot(b.x - P.x, b.y - P.y + 10) < 30 + b.r + mag) { if (b.ok) onRight(b); else onWrong(b); break; }
        }
        if (!hintShown && (performance.now() - quest.t0) / 1000 > Math.max(1.5, 9 - 1.2 * v.ups.wisdom)) { hintShown = true; banner(); }
        if (bubbles.length && bubbles.every(b => Math.hypot(b.x - P.x, b.y - P.y) > 1500)) newRound(); // ушли слишком далеко — новые знаки рядом
      }
      bubbles.forEach(b => { if (b.dead) b.dead += dt * 2; if (b.pop) b.pop += dt * 2; });
      bubbles = bubbles.filter(b => b.dead < 1 && b.pop < 1.2);
      fx.forEach(f => { f.t += dt; if (f.type === 'dot') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; } });
      fx = fx.filter(f => f.t < (f.life || (f.type === 'num' ? .6 : 1)));
      slashes.forEach(s => { s.t += dt; }); slashes = slashes.filter(s => s.t < .22);
      waves.forEach(w => { w.t += dt; }); waves = waves.filter(w => w.t < .45);
      shake = Math.max(0, shake - dt);

      // камера
      cam.x = Math.max(0, Math.min(WW - VW, P.x - VW / 2));
      cam.y = Math.max(0, Math.min(WH - VH, P.y - VH / 2));
    }

    function die() {
      v.deaths++;
      const loss = Math.floor(v.coins * .1); v.coins -= loss;
      v.hp = maxHp(v); combo = 0;
      P.x = CAMP.x; P.y = CAMP.y + 40; P.inv = 2.5; P.kx = P.ky = 0; trail.length = 0;
      enemies = enemies.filter(e => Math.hypot(e.x - CAMP.x, e.y - CAMP.y) > 800);
      ui.toast(`💀 Кляксы одолели вас! −${fmt(loss)} 🪙. Вы снова в лагере — усильте героя в магазине.`, 'warn', 4500);
      touchW(); newRound(); hud();
    }

    /* ====== Отрисовка ====== */
    function drawBlob(e, now, sx, sy) {
      const r = e.r, wob = now / 300 + e.ph;
      ctx.save(); ctx.translate(sx, sy);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, r * .85, r * .9, r * .28, 0, 0, 6.283); ctx.fill();
      ctx.beginPath();
      for (let k = 0; k <= 18; k++) {
        const a = k / 18 * 6.283, q = r * (1 + .08 * Math.sin(a * 3 + wob) + .05 * Math.sin(a * 5 - wob * 1.3));
        const x = Math.cos(a) * q, y = Math.sin(a) * q * .92;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = e.hit > 0 ? '#ffffff' : L.blob; ctx.fill();
      if (e.type === 'king') { ctx.lineWidth = 4; ctx.strokeStyle = '#f2b53a'; ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(-r * .35, -r * .4, r * .3, r * .18, -.5, 0, 6.283); ctx.fill();
      // глаза смотрят на героя
      const la = Math.atan2(P.y - e.y, P.x - e.x), ey = e.glyph ? -r * .42 : -r * .15, es = Math.max(3, r * .2);
      [-1, 1].forEach(sd => {
        const exx = sd * r * .32;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(exx, ey, es, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(exx + Math.cos(la) * es * .45, ey + Math.sin(la) * es * .45, es * .5, 0, 6.283); ctx.fill();
      });
      if (e.glyph) {
        const t = e.glyph.ch.slice(0, 2);
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(r * (t.length > 1 ? .62 : .9))}px "Noto Serif SC","Songti SC",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t, 0, r * .22);
      }
      if (e.type === 'king') ctx.drawImage(emo('👑', 26), -18, -r - 34);
      if (e.hp < e.max) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-r, -r - 12, r * 2, 5); ctx.fillStyle = '#e04b4b'; ctx.fillRect(-r, -r - 12, r * 2 * Math.max(0, e.hp / e.max), 5); }
      ctx.restore();
    }

    function draw(now) {
      const ox = cam.x + (shake ? (Math.random() - .5) * 10 * shake * 4 : 0), oy = cam.y + (shake ? (Math.random() - .5) * 10 * shake * 4 : 0);
      ctx.clearRect(0, 0, VW, VH);
      // земля
      const T = 64, i0 = Math.floor(ox / T), j0 = Math.floor(oy / T);
      for (let i = i0; i <= i0 + Math.ceil(VW / T) + 1; i++) for (let j = j0; j <= j0 + Math.ceil(VH / T) + 1; j++) {
        ctx.fillStyle = L.g[((i * 7 + j * 13) % 3 + 3) % 3 === 0 ? 2 : (i + j) % 2]; ctx.fillRect(i * T - ox, j * T - oy, T + 1, T + 1);
      }
      // лагерь
      const cx = CAMP.x - ox, cy = CAMP.y - oy;
      ctx.fillStyle = 'rgba(255,236,190,.45)'; ctx.beginPath(); ctx.arc(cx, cy, CAMP.r, 0, 6.283); ctx.fill();
      ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(160,110,40,.6)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      ctx.drawImage(emo('🏕️', 46), cx - 70, cy - 60); ctx.drawImage(emo('🔥', 30 + Math.round(Math.sin(now / 120) * 2)), cx + 10, cy - 10);
      // украшения
      for (const d of deco) { const x = d.x - ox, y = d.y - oy; if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) continue; const im = emo(d.e, d.s); ctx.drawImage(im, x - im.width / 2, y - im.height / 2); }
      // граница мира
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 6; ctx.strokeRect(-ox, -oy, WW, WH);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // монеты и сердца
      for (const d of drops) { const im = emo(d.type === 'coin' ? '🪙' : '❤️', d.type === 'coin' ? 18 : 22); ctx.drawImage(im, d.x - ox - im.width / 2, d.y - oy - im.height / 2 + Math.sin(now / 200 + d.x) * 2); }
      // знаки задания
      const glow = v.ups.wisdom >= 5 && hintShown;
      for (const b of bubbles) {
        const sx = b.x - ox, sy = b.y - oy;
        if (sx < -60 || sy < -60 || sx > VW + 60 || sy > VH + 60) continue;
        const bob = Math.sin(now / 400 + b.ph) * 4, a = b.dead ? Math.max(0, 1 - b.dead) : b.pop ? Math.max(0, 1 - b.pop) : 1, sc = b.pop ? 1 + b.pop * .5 : 1;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(sx, sy + bob); ctx.scale(sc, sc);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, b.r + 6, b.r * .8, 8, 0, 0, 6.283); ctx.fill();
        if (b.ok && glow && !b.pop) { ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 26; }
        ctx.fillStyle = b.dead ? '#f6c7c7' : '#fffdf6'; ctx.strokeStyle = b.dead ? '#d64545' : '#c9a35b'; ctx.lineWidth = 3;
        rr(ctx, -b.r, -b.r + 4, b.r * 2, b.r * 2 - 8, 16); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
        const lb = b.e.ch; ctx.fillStyle = '#2a2018'; ctx.font = `700 ${lb.length > 2 ? 22 : lb.length === 2 ? 30 : 38}px "Noto Serif SC","Songti SC",serif`;
        ctx.fillText(lb, 0, 2);
        ctx.restore();
      }
      // кляксы
      for (const e of enemies) { const sx = e.x - ox, sy = e.y - oy; if (sx < -80 || sy < -80 || sx > VW + 80 || sy > VH + 80) continue; drawBlob(e, now, sx, sy); }
      // волны гонга и взмахи кисти
      for (const w of waves) { const k = w.t / .45; ctx.strokeStyle = `rgba(242,181,58,${1 - k})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(w.x - ox, w.y - oy - 20, w.max * k, 0, 6.283); ctx.stroke(); }
      for (const s of slashes) { const k = s.t / .22; ctx.strokeStyle = `rgba(30,30,30,${.75 * (1 - k)})`; ctx.lineWidth = 10 * (1 - k) + 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(s.x - ox, s.y - oy - 24, s.r * (.6 + .4 * k), s.a - 1.0, s.a + 1.0); ctx.stroke(); }
      // снаряды
      for (const s of shots) {
        const sx = s.x - ox, sy = s.y - oy;
        if (s.kind === 'glyph') { ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#c9a35b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#b3261e'; ctx.font = `700 ${s.txt.length > 1 ? 11 : 17}px "Noto Serif SC",serif`; ctx.fillText(s.txt, sx, sy + 1); }
        else { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, 6.283); ctx.fill(); }
      }
      // питомцы
      const lv = heroLvl(v);
      v.pets.forEach((li, i) => {
        const p = trail[Math.min(trail.length - 1, (i + 1) * 16)] || { x: P.x - 30 * (i + 1), y: P.y };
        const im = spriteOf(li, Math.floor((lv - 1) / 6));
        if (im.complete && im.naturalWidth) { const hh = 40, ww = hh * im.naturalWidth / im.naturalHeight; ctx.drawImage(im, p.x - ox - ww / 2, p.y - oy - hh + 6 + Math.sin(now / 300 + i) * 2, ww, hh); }
      });
      // герой
      const im = spriteOf(v.skin, Math.floor((lv - 1) / 4));
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(P.x - ox, P.y - oy + 4, 26, 8, 0, 0, 6.283); ctx.fill();
      ctx.save();
      if (P.inv > 0 && Math.floor(now / 90) % 2) ctx.globalAlpha = .45;
      if (im.complete && im.naturalWidth) {
        const hh = 74, ww = hh * im.naturalWidth / im.naturalHeight, jump = P.moving ? Math.abs(Math.sin(P.bob)) * 6 : Math.sin(now / 500) * 1.5;
        ctx.translate(P.x - ox, P.y - oy - jump); ctx.scale(P.face, 1); ctx.drawImage(im, -ww / 2, -hh + 8, ww, hh);
      }
      ctx.restore();
      // фонари
      const ow = v.wp.orbit > 0 ? WEAPONS.orbit.st(v.wp.orbit) : null;
      if (ow) for (let i = 0; i < ow.n; i++) { const a = orbitA + i * 6.283 / ow.n, lim = emo('🏮', 24); ctx.drawImage(lim, P.x - ox + Math.cos(a) * ow.radius - lim.width / 2, P.y - oy - 24 + Math.sin(a) * ow.radius - lim.height / 2); }
      // эффекты
      for (const f of fx) {
        const sx = f.x - ox, sy = f.y - oy;
        if (f.type === 'txt') { ctx.globalAlpha = Math.max(0, 1 - f.t / (f.life || 1)); ctx.fillStyle = f.color; ctx.font = '700 20px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.strokeText(f.text, sx, sy - f.t * 40); ctx.fillText(f.text, sx, sy - f.t * 40); }
        else if (f.type === 'num') { ctx.globalAlpha = 1 - f.t / .6; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.font = '700 14px system-ui, sans-serif'; ctx.strokeText(f.text, sx, sy - f.t * 50); ctx.fillText(f.text, sx, sy - f.t * 50); }
        else { ctx.globalAlpha = 1 - f.t; ctx.fillStyle = f.color; ctx.fillRect(sx, sy, 5, 5); }
      }
      ctx.globalAlpha = 1;
      // указатели на знаки за краем экрана
      for (const b of bubbles) {
        if (b.dead || b.pop) continue;
        const sx = b.x - ox, sy = b.y - oy;
        if (sx > 0 && sy > 0 && sx < VW && sy < VH) continue;
        const dx = sx - VW / 2, dy = sy - VH / 2, k = Math.min((VW / 2 - 28) / Math.abs(dx || 1e-6), (VH / 2 - 28) / Math.abs(dy || 1e-6));
        const ix = VW / 2 + dx * k, iy = VH / 2 + dy * k, a = Math.atan2(dy, dx);
        ctx.fillStyle = 'rgba(255,253,246,.92)'; ctx.strokeStyle = '#c9a35b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * 26, iy + Math.sin(a) * 26); ctx.lineTo(ix + Math.cos(a + 2.5) * 18, iy + Math.sin(a + 2.5) * 18); ctx.lineTo(ix + Math.cos(a - 2.5) * 18, iy + Math.sin(a - 2.5) * 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(ix, iy, 18, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a2018'; ctx.font = `700 ${b.e.ch.length > 1 ? 11 : 16}px "Noto Serif SC",serif`; ctx.fillText(b.e.ch.slice(0, 3), ix, iy + 1);
      }
      // полоски здоровья и опыта
      const mhp = maxHp(v), xl = heroLvl(v), xa = xpAt(xl), xb = xpAt(xl + 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, 10, 10, 214, 44, 10); ctx.fill();
      ctx.fillStyle = '#5a1f1f'; ctx.fillRect(18, 17, 198, 13); ctx.fillStyle = '#e04b4b'; ctx.fillRect(18, 17, 198 * Math.max(0, v.hp / mhp), 13);
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(18, 35, 198, 9); ctx.fillStyle = '#f2b53a'; ctx.fillRect(18, 35, 198 * Math.min(1, (v.xp - xa) / (xb - xa)), 9);
      ctx.fillStyle = '#fff'; ctx.font = '700 11px system-ui, sans-serif'; ctx.fillText(`❤ ${Math.ceil(v.hp)} / ${mhp}`, 22, 24); ctx.fillText(`Ур. ${xl}`, 22, 40);
      ctx.textAlign = 'right'; ctx.font = '700 13px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(`${L.ico} ${L.name}`, VW - 12, 22); ctx.fillStyle = '#fff'; ctx.fillText(`${L.ico} ${L.name}`, VW - 12, 22); ctx.textAlign = 'left';
      // мини-карта
      const mw = narrow ? 120 : 150, mh = mw * WH / WW, mx = VW - mw - 10, my = VH - mh - 10, s = mw / WW;
      ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(ctx, mx - 3, my - 3, mw + 6, mh + 6, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,190,.7)'; ctx.beginPath(); ctx.arc(mx + CAMP.x * s, my + CAMP.y * s, CAMP.r * s + 1, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#e04b4b'; for (const e of enemies) ctx.fillRect(mx + e.x * s - 1, my + e.y * s - 1, e.type === 'king' ? 5 : 3, e.type === 'king' ? 5 : 3);
      ctx.fillStyle = '#ffd34d'; for (const b of bubbles) if (!b.dead && !b.pop) ctx.fillRect(mx + b.x * s - 2, my + b.y * s - 2, 4, 4);
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1; ctx.strokeRect(mx + cam.x * s, my + cam.y * s, VW * s, VH * s);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + P.x * s, my + P.y * s, 3, 0, 6.283); ctx.fill();
      ctx.textAlign = 'center';
      // «джойстик»
      if (ctl.joy.on) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ctl.joy.ox, ctl.joy.oy, 46, 0, 6.283); ctx.stroke();
        const jx = ctl.joy.x - ctl.joy.ox, jy = ctl.joy.y - ctl.joy.oy, jd = Math.min(46, Math.hypot(jx, jy)), ja = Math.atan2(jy, jx);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(ctl.joy.ox + Math.cos(ja) * jd, ctl.joy.oy + Math.sin(ja) * jd, 20, 0, 6.283); ctx.fill();
      }
    }

    function frame(ts) {
      if (stop) return;
      const dt = Math.min(.05, (ts - last) / 1000); last = ts;
      if (!document.getElementById('modal').classList.contains('open')) update(dt); else ctl.keys.clear();
      draw(ts);
      saveT += dt; hudT += dt;
      if (hudT > .25) { hudT = 0; hud(); if (quest && !quest.done && !hintShown) banner(); }
      if (saveT > 5) { saveT = 0; v.last = Date.now(); store.save(); }
      raf = requestAnimationFrame(frame);
    }

    /* ====== Магазин, карта, герой ====== */
    const row = (ico, title, desc, price, can, maxed, onclick) => h('button.btn.evo-up' + (can && !maxed ? '.afford' : ''), { type: 'button', onclick, disabled: maxed },
      h('span.ico', ico), h('span.evo-up-t', h('b', title), h('small.muted', desc)), h('span.evo-up-c', maxed ? 'MAX' : '🪙 ' + fmt(price)));
    function buyUp(k, tab) {
      const u = UPS[k], lv = v.ups[k]; if (lv >= u.max) return;
      const c = u.cost(lv); if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c; v.ups[k]++; if (k === 'hp') v.hp += 20;
      ui.sfx('ok'); touchW(); hud(); shop(tab);
    }
    function buyWeapon(k) {
      const w = WEAPONS[k], lv = v.wp[k]; if (lv >= w.max) return;
      const c = w.cost(lv); if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c; v.wp[k]++;
      if (lv === 0) { ui.sfx('level'); ui.confetti(50); ui.toast(`${w.ico} Новое оружие: ${w.name}!`, 'gold'); } else ui.sfx('ok');
      touchW(); hud(); shop('weapons');
    }
    function buyPet() {
      if (v.pets.length >= PET_MAX) return;
      const c = petCost(v.pets.length); if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c;
      const free = HZ.evo.LINES.map((_, i) => i).filter(i => i !== v.skin && !v.pets.includes(i));
      v.pets.push(free[HZ.rand(free.length)]);
      ui.sfx('level'); ui.confetti(50); touchW(); hud(); shop('eco');
    }
    function shop(tab) {
      const tabs = h('div.wk-tabs', [['hero', '🧍 Герой'], ['weapons', '⚔️ Оружие'], ['eco', '🌾 Хозяйство']].map(([k, t]) => h('button.btn.sm' + (k === tab ? '.primary' : ''), { type: 'button', onclick: () => shop(k) }, t)));
      let rows;
      if (tab === 'weapons') {
        rows = Object.keys(WEAPONS).map(k => {
          const w = WEAPONS[k], lv = v.wp[k], st = w.st(Math.max(1, lv)), nx = lv < w.max ? w.st(lv + 1) : null;
          return row(w.ico, lv ? `${w.name} · ур. ${lv}` : `${w.name} — купить`, lv ? `${w.desc}. Сейчас: ${w.info(st)}${nx ? ` → ${w.info(nx)}` : ''}` : `${w.desc}. ${w.info(st)}`, w.cost(lv), v.coins >= w.cost(lv), lv >= w.max, () => buyWeapon(k));
        });
      } else {
        rows = Object.keys(UPS).filter(k => UPS[k].tab === tab).map(k => { const u = UPS[k], lv = v.ups[k]; return row(u.ico, `${u.name} · ур. ${lv}`, u.desc(lv), u.cost(lv), v.coins >= u.cost(lv), lv >= u.max, () => buyUp(k, tab)); });
        if (tab === 'eco') { const pc = petCost(v.pets.length), full = v.pets.length >= PET_MAX; rows.push(row('🐾', `Питомцы · ${v.pets.length}/${PET_MAX}`, 'Бегут за героем, стреляют по кляксам и приносят +2,5 🪙/с каждый', pc, v.coins >= pc, full, buyPet)); }
      }
      const lv = heroLvl(v);
      const stats = h('p.muted.small', `Герой: ур. ${lv}, здоровье ${maxHp(v)}, броня −${Math.min(60, v.ups.armor * 5)}%, сила +${Math.round((dmgMul() - 1) * 100)}%. Кляксы побеждено: ${v.kills}.`);
      ui.modal('🛒 Магазин · 🪙 ' + fmt(v.coins), h('div.evo-ups', tabs, stats, ...rows), [{ label: 'Закрыть', primary: true }]);
    }
    function mapDialog() {
      const lv = heroLvl(v);
      ui.modal('🗺️ Карта локаций', h('div.wk-locs', LOCS.map((l, i) => {
        const open = i <= v.maxLoc || lv >= l.req, cur = i === v.loc;
        if (open && i > v.maxLoc) v.maxLoc = i;
        return h('button.wk-loc' + (cur ? '.on' : '') + (open ? '' : '.locked'), { type: 'button', disabled: !open, onclick: () => { document.getElementById('modal').classList.remove('open'); if (!cur) travel(i); } },
          h('span.wk-loc-ico', l.ico), h('span.wk-loc-t', h('b', l.name), h('small.muted', open ? `Кляксы ×${l.mul} по силе · монеты ×${l.coin}` : `Откроется на ${l.req} уровне героя (сейчас ${lv})`)), h('span.chip.sm' + (cur ? '.done' : ''), cur ? 'вы здесь' : open ? 'отправиться' : '🔒'));
      })), [{ label: 'Закрыть' }]);
    }
    function heroPicker() {
      const lv = heroLvl(v);
      const grid = h('div.wk-heroes', HZ.evo.LINES.map((Ln, i) => h('button.wk-hero' + (v.skin === i ? '.on' : ''), { type: 'button', onclick: () => { v.skin = i; v.pets = v.pets.filter(p => p !== i); touchW(); document.getElementById('modal').classList.remove('open'); } },
        h('img.evo-sprite', { src: `img/evo/${Ln[0]}-${Math.min(Ln[2] - 1, Math.floor((lv - 1) / 4))}.webp`, alt: Ln[1] }), h('small', Ln[1]))));
      ui.modal('Выберите героя', h('div', h('p.muted.small', 'Герой растёт вместе с уровнем: каждые 4 уровня — новая стадия.'), grid), [{ label: 'Закрыть' }]);
    }

    canvas._dbg = () => ({ P, enemies, bubbles, quest, v, drops, cam, spawn: spawnEnemy, travel });
    newRound(); hud();
    raf = requestAnimationFrame(frame);
    canvas.focus();
  }

  HZ.valley = { view, LOCS, WEAPONS };
})();
