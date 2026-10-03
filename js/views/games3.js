/* Игры с управлением героем (WASD / стрелки / касание): общие помощники и «Змейка знаков». «Долина знаков» — в valley.js. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs, G = HZ.games;
  const firstGloss = m => (m || '').split(/[;,(]/)[0].trim();
  const keyOf = e => e.key || e.ch;

  /* ====== Общее: раунд «найди знак» ====== */
  /** Раунд: целевая запись + (n-1) отвлекающих, у которых другое значение и чтение. */
  function makeRound(e, pool, n) {
    const seenM = new Set([firstGloss(e.m)]), seenP = new Set([HZ.baseSyl(e.py)]), seenC = new Set([e.ch]);
    const ds = [];
    for (const x of HZ.shuffle(pool)) {
      const g = firstGloss(x.m), p = HZ.baseSyl(x.py);
      if (seenC.has(x.ch) || seenM.has(g) || seenP.has(p)) continue;
      seenC.add(x.ch); seenM.add(g); seenP.add(p); ds.push(x);
      if (ds.length >= n - 1) break;
    }
    return { ok: e, items: HZ.shuffle([e, ...ds]) };
  }
  /** Очередь целей: сначала знаки, которые знаете хуже; ошибки возвращаются раньше. */
  function makeQueue(getPool, mast) {
    let q = [], src = null;
    return {
      next() {
        const pool = getPool();
        if (src !== pool) { src = pool; q = []; }
        if (!q.length) q = HZ.shuffle(pool).sort((a, b) => (mast(a) - mast(b)) + (Math.random() - .5) * 1.5);
        return { e: q.shift(), pool };
      },
      again(e) { q.splice(Math.min(3, q.length), 0, e); }
    };
  }
  const accOf = e => { const c = srs.get(keyOf(e)); return c ? Math.min(1, srs.accuracy(c)) * Math.min(1, (c.ok + c.bad) / 4) : 0; };
  const pool0 = () => G.mixPool().filter(e => e.m && firstGloss(e.m).length <= 28);

  const imgs = {};
  function img(src) { if (!imgs[src]) { const i = new Image(); i.src = src; imgs[src] = i; } return imgs[src]; }
  function spriteOf(line, stage) { const L = HZ.evo.LINES[line]; return img(`img/evo/${L[0]}-${Math.min(L[2] - 1, stage)}.webp`); }

  /* ====== Управление: клавиатура (по коду клавиши — работает в любой раскладке) и касание ====== */
  function controls(canvas, onSwipe) {
    const keys = new Set();
    const map = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    const kd = ev => {
      const k = map[ev.code]; if (!k) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName)) return;
      ev.preventDefault(); keys.add(k); if (onSwipe) onSwipe(k);
    };
    const ku = ev => { const k = map[ev.code]; if (k) keys.delete(k); };
    const clr = () => keys.clear();
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', clr);
    const joy = { on: false, ox: 0, oy: 0, x: 0, y: 0, id: -1 };
    const pos = ev => { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) * canvas.width / r.width / (canvas._dpr || 1), (ev.clientY - r.top) * canvas.height / r.height / (canvas._dpr || 1)]; };
    canvas.addEventListener('pointerdown', ev => { const [x, y] = pos(ev); Object.assign(joy, { on: true, ox: x, oy: y, x, y, id: ev.pointerId }); canvas.setPointerCapture(ev.pointerId); });
    canvas.addEventListener('pointermove', ev => {
      if (!joy.on || ev.pointerId !== joy.id) return;
      const [x, y] = pos(ev); joy.x = x; joy.y = y;
      if (onSwipe) { const dx = x - joy.ox, dy = y - joy.oy; if (Math.hypot(dx, dy) > 28) { onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u')); joy.ox = x; joy.oy = y; } }
    });
    const end = ev => { if (ev.pointerId === joy.id) joy.on = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    return {
      keys, joy,
      vec() { // направление из клавиш или «джойстика»
        let x = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), y = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
        if (!x && !y && joy.on && !onSwipe) { const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy); if (d > 8) { const k = Math.min(1, d / 60); x = dx / d * k; y = dy / d * k; } }
        const m = Math.hypot(x, y); return m > 1 ? [x / m, y / m] : [x, y];
      },
      destroy() { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', clr); }
    };
  }

  function setupCanvas(canvas, W, H) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr; canvas._dpr = dpr;
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  const rr = (ctx, x, y, w, hh, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmt = n => (HZ.evo ? HZ.evo.fmt(n) : String(Math.floor(n)));

  /* ============================================================
   *  ЗМЕЙКА ЗНАКОВ
   * ============================================================ */
  function snake() {
    const pool = pool0();
    if (pool.length < 8) return ui.toast('Мало знаков для игры');
    const hud = h('span.game-hud');
    const { area, body } = G.frame('Змейка знаков', hud);
    const GW = 18, GH = 12, CS = 48, SW = GW * CS, SH = GH * CS;
    const canvas = h('canvas.wk-canvas', { tabindex: 0 });
    const ctx = setupCanvas(canvas, SW, SH);
    const banner = h('div.wk-banner');
    const pad = h('div.wk-pad', ['u', 'l', 'd', 'r'].map(k => h('button.btn.lg', { type: 'button', 'aria-label': k, onclick: () => turn(k) }, { u: '↑', l: '←', d: '↓', r: '→' }[k])));
    body.append(banner, canvas, pad, h('p.muted.small.center', 'WASD или стрелки (на телефоне — свайп по полю или кнопки). Съешьте знак, который подходит под задание: змейка растёт. Неверный знак — минус жизнь.'));
    let snakeCells = [{ x: 8, y: 6 }, { x: 7, y: 6 }, { x: 6, y: 6 }], dir = { x: 1, y: 0 }, queued = [], items = [], quest = null, score = 0, lives = 3, combo = 0, right = 0, wrong = 0, bestCombo = 0, stepMs = 190, acc = 0, last = performance.now(), raf = 0, over = false, grow = 0, flash = 0;
    const wrongSet = new Set();
    const queue = makeQueue(() => pool, e => accOf(e) * 5);
    const D = { u: { x: 0, y: -1 }, d: { x: 0, y: 1 }, l: { x: -1, y: 0 }, r: { x: 1, y: 0 } };
    function turn(k) {
      const nd = D[k], ref = queued.length ? queued[queued.length - 1] : dir;
      if (nd.x === -ref.x && nd.y === -ref.y) return; // нельзя развернуться на месте
      if (nd.x === ref.x && nd.y === ref.y) return;
      if (queued.length < 2) queued.push(nd);
    }
    const ctl = controls(canvas, turn);
    const cleanup = () => { over = true; cancelAnimationFrame(raf); ctl.destroy(); };
    HZ.router.onLeave(cleanup);
    const drawHud = () => ui.clear(hud).append(...[h('span.hud-pill', '❤️'.repeat(Math.max(0, lives)) || '💔'), h('span.hud-pill', '⭐ ' + score), h('span.hud-pill', '📏 ' + snakeCells.length), combo >= 2 ? h('span.hud-pill.hot', '🔥 ×' + combo) : null].filter(Boolean));
    const free = () => { for (let i = 0; i < 200; i++) { const c = { x: HZ.rand(GW), y: HZ.rand(GH) }; if (!snakeCells.some(s => s.x === c.x && s.y === c.y) && !items.some(s => s.x === c.x && s.y === c.y)) return c; } return { x: 0, y: 0 }; };

    function newRound() {
      const { e } = queue.next();
      const r = makeRound(e, pool, 4);
      quest = { e, type: Math.random() < .6 ? 'm' : 'py', wrong: false };
      items = r.items.map(it => Object.assign(free(), { e: it, ok: it === e }));
      ui.clear(banner).append(quest.type === 'm' ? h('div', h('span.muted', 'Съешьте знак: '), h('b.wk-target', firstGloss(e.m))) : h('div', h('span.muted', 'Съешьте знак с чтением: '), h('b.wk-target', ui.py(e.py, 'lg'))));
    }
    function loseLife(msg) {
      lives--; combo = 0; ui.sfx('bad'); flash = 1;
      if (msg) { ui.clear(banner).append(h('div', msg, h('div.small.muted', 'Нужный знак: «' + quest.e.ch + '» — ', ui.py(quest.e.py), ' ' + firstGloss(quest.e.m)))); }
      drawHud();
      if (lives <= 0) finish();
    }
    function step() {
      if (queued.length) dir = queued.shift();
      const head = { x: (snakeCells[0].x + dir.x + GW) % GW, y: (snakeCells[0].y + dir.y + GH) % GH };
      if (snakeCells.slice(0, -1).some(s => s.x === head.x && s.y === head.y)) { // врезались в себя
        snakeCells.length = Math.max(3, Math.floor(snakeCells.length / 2));
        loseLife('Вы врезались в себя!'); if (over) return;
      }
      snakeCells.unshift(head);
      const it = items.find(i => i.x === head.x && i.y === head.y);
      if (it) {
        if (it.ok) {
          right++; combo++; bestCombo = Math.max(bestCombo, combo); score += 10 + Math.min(combo, 10) * 2; grow += 1;
          srs.record(keyOf(it.e), true); ui.sfx('ok'); ui.speak(it.e.ch); stepMs = Math.max(105, stepMs - 4);
          newRound(); drawHud();
        } else {
          wrong++; wrongSet.add(keyOf(it.e)); srs.record(keyOf(quest.e), false); queue.again(quest.e);
          items = items.filter(i => i !== it);
          if (snakeCells.length > 3) snakeCells.length -= 1;
          loseLife('«' + it.e.ch + '» — это ' + firstGloss(it.e.m) + '.'); if (over) return;
        }
      }
      if (grow > 0) grow--; else snakeCells.pop();
    }
    function draw() {
      ctx.fillStyle = cssVar('--surface2') || '#f3eee6'; ctx.fillRect(0, 0, SW, SH);
      for (let i = 0; i < GW; i++) for (let j = 0; j < GH; j++) { if ((i + j) % 2) { ctx.fillStyle = 'rgba(120,160,100,.12)'; ctx.fillRect(i * CS, j * CS, CS, CS); } }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      items.forEach(it => {
        ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#c9a35b'; ctx.lineWidth = 2; rr(ctx, it.x * CS + 3, it.y * CS + 3, CS - 6, CS - 6, 10); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a2018'; const l = it.e.ch; ctx.font = `700 ${l.length > 2 ? 15 : l.length === 2 ? 21 : 28}px "Noto Serif SC", "Songti SC", serif`; ctx.fillText(l, it.x * CS + CS / 2, it.y * CS + CS / 2 + 1);
      });
      snakeCells.forEach((s, i) => {
        const t = 1 - i / (snakeCells.length + 4);
        ctx.fillStyle = i === 0 ? '#2e9e5b' : `hsl(${135 - i * 3}, 55%, ${38 + t * 14}%)`;
        rr(ctx, s.x * CS + 4, s.y * CS + 4, CS - 8, CS - 8, i === 0 ? 14 : 10); ctx.fill();
        if (i === 0) { ctx.fillStyle = '#fff'; const ex = dir.x * 6, ey = dir.y * 6; [-8, 8].forEach(o => { ctx.beginPath(); ctx.arc(s.x * CS + CS / 2 + ex + (dir.y ? o : 0), s.y * CS + CS / 2 + ey + (dir.x ? o : 0), 5, 0, 6.28); ctx.fill(); }); ctx.fillStyle = '#111'; [-8, 8].forEach(o => { ctx.beginPath(); ctx.arc(s.x * CS + CS / 2 + ex * 1.4 + (dir.y ? o : 0), s.y * CS + CS / 2 + ey * 1.4 + (dir.x ? o : 0), 2.5, 0, 6.28); ctx.fill(); }); }
      });
      if (flash > 0) { ctx.fillStyle = `rgba(214,69,69,${flash * .3})`; ctx.fillRect(0, 0, SW, SH); }
    }
    function loop(ts) {
      if (over) return;
      const dt = ts - last; last = ts; acc += Math.min(dt, 100); flash = Math.max(0, flash - dt / 400);
      while (acc >= stepMs && !over) { acc -= stepMs; step(); }
      draw(); raf = requestAnimationFrame(loop);
    }
    function finish() {
      over = true; cleanup();
      const prev = store.s.best.snake || 0, rec = score > prev && prev > 0;
      if (score > prev) store.s.best.snake = score;
      const xp = right * 3; HZ.gami.addXP(xp); HZ.gami.onGame(right, right + wrong); store.save();
      G.summary(area, { emoji: score >= 150 ? '🏆' : score >= 60 ? '👍' : '💪', title: 'Игра окончена', record: rec,
        stats: [[score, 'очков'], [right, 'верно'], [snakeCells.length, 'длина'], [bestCombo, 'лучшая серия'], ['+' + xp, 'XP']],
        bad: [...wrongSet].map(k => { const e = HZ.entry(k); return e ? h('div.sent-bad-row', h('span.zh', e.ch), h('small.muted', ui.py(e.py), ' · ', firstGloss(e.m))) : null; }).filter(Boolean), again: snake });
    }
    canvas._kill = () => { lives = 1; loseLife('тест'); };
    newRound(); drawHud(); canvas.focus();
    raf = requestAnimationFrame(loop);
  }

  HZ.play = { makeRound, makeQueue, accOf, pool0, img, spriteOf, controls, setupCanvas, rr, firstGloss, keyOf, fmt };
  G.extra = (G.extra || []).concat([
    { group: 'Idle и приключения', ico: '🌄', name: 'Долина знаков', desc: 'Ходите героем (WASD) по 5 локациям, ищите нужный знак, сражайтесь с кляксами и боссами, покупайте автомат, дробовик, ракетницу и другое оружие', go: () => HZ.router.go('#/valley') },
    { group: 'Аркады', ico: '🐍', name: 'Змейка знаков', get desc() { return 'Управляйте змейкой (WASD) и съедайте знак по заданию. Рекорд: ' + (store.s.best.snake || 0); }, go: snake }
  ]);
})();
