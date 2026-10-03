/* Игры с управлением героем (WASD / стрелки / касание): «Долина знаков» (idle + приключение) и «Змейка знаков». */
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
   *  ДОЛИНА ЗНАКОВ — idle + приключение
   * ============================================================ */
  const W = 960, H = 600;
  const UPS = {
    speed: { ico: '👟', name: 'Быстрые ноги', desc: lv => `+8% к скорости (сейчас ×${(1 + .08 * lv).toFixed(2)})`, cost: lv => Math.round(40 * Math.pow(1.7, lv)), max: 15 },
    magnet: { ico: '🧲', name: 'Магнит', desc: lv => `Больше радиус подбора (+${lv * 6} px)`, cost: lv => Math.round(60 * Math.pow(1.8, lv)), max: 10 },
    income: { ico: '🌾', name: 'Ферма', desc: lv => `+1,2 🪙/с пассивно (сейчас +${(lv * 1.2).toFixed(1)})`, cost: lv => Math.round(50 * Math.pow(1.6, lv)), max: 30 },
    reward: { ico: '💎', name: 'Награда за знак', desc: lv => `+15% монет за верный знак (сейчас +${lv * 15}%)`, cost: lv => Math.round(80 * Math.pow(1.7, lv)), max: 30 },
    wisdom: { ico: '🧠', name: 'Мудрость', desc: lv => `Подсказка с чтением приходит через ${Math.max(1.5, 9 - 1.2 * lv).toFixed(1)} с${lv >= 5 ? ', нужный знак светится' : ' (с 5 ур. нужный знак светится)'}`, cost: lv => Math.round(120 * Math.pow(2, lv)), max: 6 }
  };
  const PET_MAX = 6;
  const petCost = n => Math.round(200 * Math.pow(2.5, n));

  function WS() {
    let v = store.s.walk;
    if (!v || typeof v !== 'object') v = store.s.walk = {};
    const d = { coins: 0, ups: { speed: 0, magnet: 0, income: 0, reward: 0, wisdom: 0 }, pets: [], skin: 0, right: 0, wrong: 0, bestCombo: 0, sound: true, last: Date.now(), upd: 0 };
    Object.keys(d).forEach(k => { if (v[k] === undefined) v[k] = d[k]; });
    v.ups = Object.assign({}, d.ups, v.ups);
    return v;
  }
  const levelOf = v => 1 + Math.floor(Math.sqrt(v.right / 2));
  const incomeOf = v => (0.2 + 1.2 * v.ups.income + 2.5 * v.pets.length) * (1 + 0.1 * (levelOf(v) - 1));
  const touchW = () => { store.s.walk.upd = Date.now(); store.save(); };

  let backdrop = null;
  function drawBackdrop() { // трава, тропинки, цветы — рисуется один раз
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const dark = document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    const g1 = dark ? '#2b4a2f' : '#9fd37f', g2 = dark ? '#305436' : '#92c973';
    for (let i = 0; i < W / 48; i++) for (let j = 0; j < H / 48; j++) { x.fillStyle = (i + j) % 2 ? g1 : g2; x.fillRect(i * 48, j * 48, 48, 48); }
    x.fillStyle = dark ? 'rgba(180,150,100,.18)' : 'rgba(214,190,140,.55)';
    x.beginPath(); x.ellipse(W / 2, H / 2, 330, 190, 0, 0, Math.PI * 2); x.fill();
    x.font = '26px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const deco = ['🌳', '🌸', '🌿', '🍄', '🪨', '🌼', '🌲'];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 46; k++) {
      const px = 20 + rnd() * (W - 40), py = 20 + rnd() * (H - 40);
      if (Math.hypot((px - W / 2) / 360, (py - H / 2) / 210) < 1) continue; // центр свободен
      x.globalAlpha = .9; x.fillText(deco[Math.floor(rnd() * deco.length)], px, py);
    }
    x.globalAlpha = 1;
    return c;
  }

  function valley() {
    const v = WS();
    const view = document.getElementById('view');
    const area = h('div.page.walk');
    ui.clear(view).append(area);
    const canvas = h('canvas.wk-canvas', { tabindex: 0 });
    const ctx = setupCanvas(canvas, W, H);
    backdrop = drawBackdrop();

    // оффлайн-доход
    const away = Math.min(4 * 3600, Math.max(0, (Date.now() - (v.last || Date.now())) / 1000));
    if (away > 60) { const g = incomeOf(v) * away * 0.5; v.coins += g; ui.toast(`🌙 Пока вас не было, долина принесла ${fmt(g)} 🪙`, 'gold', 4500); }
    v.last = Date.now(); store.save();

    const el = { coins: h('b.wk-coins', ''), inc: h('span.muted.small'), lvl: h('span.hud-pill'), combo: h('span.hud-pill'), banner: h('div.wk-banner'), shop: h('button.btn.sm', { type: 'button', onclick: () => shop() }, '🛒 Улучшения'), snd: h('button.btn.sm', { type: 'button', onclick: () => { v.sound = !v.sound; touchW(); hud(); } }) };
    const src = G.srcSelect(() => { newRound(); });
    area.append(
      h('div.wk-top', h('div', h('div.evo-coin-row', h('span.evo-coin', '🪙'), el.coins), el.inc), h('div.wk-pills', el.lvl, el.combo)),
      h('div.wk-bar', el.shop, h('button.btn.sm', { type: 'button', onclick: () => heroPicker() }, '🐾 Герой'), el.snd, h('label.wk-src', h('span.muted.small', '🎯'), src)),
      el.banner, canvas,
      h('p.muted.small.center', 'Ходите WASD или стрелками (на телефоне — ведите пальцем по полю). Коснитесь нужного знака, неверные ломаются. Монеты капают и сами — покупайте улучшения и питомцев.'));

    const P = { x: W / 2, y: H / 2 + 120, face: 1, bob: 0, moving: false };
    const trail = [];
    let bubbles = [], quest = null, combo = 0, fx = [], t0 = performance.now(), last = t0, raf = 0, saveT = 0, hudT = 0, roundWrong = false, stop = false, hintShown = false;
    const queue = makeQueue(pool0, e => accOf(e) * 5);
    const ctl = controls(canvas);
    const cleanup = () => { stop = true; cancelAnimationFrame(raf); ctl.destroy(); v.last = Date.now(); store.save(); };
    HZ.router.onLeave(() => { cleanup(); const n = session.right; if (n >= 5) { HZ.gami.addXP(n); HZ.gami.onGame(n, n + session.wrong); } else if (n) HZ.gami.addXP(n); });
    const session = { right: 0, wrong: 0 };

    function hud() {
      el.coins.textContent = fmt(v.coins);
      el.inc.textContent = `+${fmt(incomeOf(v))} 🪙/с`;
      el.lvl.textContent = `Ур. ${levelOf(v)} · ✔ ${v.right}`;
      el.combo.textContent = combo >= 2 ? `🔥 ×${combo}` : 'Серия 0'; el.combo.classList.toggle('hot', combo >= 2);
      el.snd.textContent = v.sound ? '🔊 Звук' : '🔇 Без звука';
      const aff = Object.keys(UPS).some(k => v.ups[k] < UPS[k].max && v.coins >= UPS[k].cost(v.ups[k])) || (v.pets.length < PET_MAX && v.coins >= petCost(v.pets.length));
      el.shop.classList.toggle('afford', aff);
    }
    function banner() {
      if (!quest) return;
      const e = quest.e, hintDelay = Math.max(1.5, 9 - 1.2 * v.ups.wisdom);
      const hintOn = hintShown || quest.wrong;
      ui.clear(el.banner).append(quest.type === 'm'
        ? h('div', h('span.muted', 'Найди знак: '), h('b.wk-target', firstGloss(e.m)), hintOn ? h('span.wk-hint', ' ', ui.py(e.py, 'lg')) : h('span.muted.small', ` · подсказка через ${Math.max(0, Math.ceil(hintDelay - (performance.now() - quest.t0) / 1000))} с`))
        : h('div', h('span.muted', 'Найди знак с чтением: '), h('b.wk-target', ui.py(e.py, 'lg')), hintOn ? h('span.wk-hint.muted', ' · ' + firstGloss(e.m)) : null));
      if (quest.wrong && quest.reveal) el.banner.append(h('div.small.wk-reveal', quest.reveal));
    }

    function newRound() {
      const { e, pool } = queue.next();
      if (!e) return;
      const n = Math.min(7, 3 + Math.floor(levelOf(v) / 2));
      const r = makeRound(e, pool, n);
      quest = { e, type: Math.random() < .65 ? 'm' : 'py', t0: performance.now(), wrong: false };
      hintShown = false; roundWrong = false;
      bubbles = []; const pts = [];
      r.items.forEach(it => {
        let p = null;
        for (let tries = 0; tries < 80 && !p; tries++) {
          const x = 80 + Math.random() * (W - 160), y = 110 + Math.random() * (H - 200);
          if (Math.hypot(x - P.x, y - P.y) >= 180 && !pts.some(q => Math.hypot(q[0] - x, q[1] - y) < 130)) p = [x, y];
        }
        if (!p) p = [80 + Math.random() * (W - 160), 110 + Math.random() * (H - 200)];
        pts.push(p);
        bubbles.push({ x: p[0], y: p[1], e: it, ok: it === e, ph: Math.random() * 6, r: 38, dead: 0, pop: 0 });
      });
      banner(); hud();
    }

    function floatText(x, y, text, color) { fx.push({ x, y, text, color, t: 0, type: 'txt' }); }
    function burst(x, y, color) { for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 140; fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, color, type: 'dot' }); } }

    function onRight(b) {
      const e = quest.e;
      combo++; v.right++; session.right++; v.bestCombo = Math.max(v.bestCombo, combo);
      const gain = Math.round((8 + levelOf(v) * 2 + Math.min(combo, 15) * 2) * (1 + .15 * v.ups.reward) * (roundWrong ? .5 : 1));
      v.coins += gain;
      srs.record(keyOf(e), true);
      floatText(b.x, b.y - 30, '+' + gain + ' 🪙', '#e0a000'); burst(b.x, b.y, '#ffd34d');
      ui.sfx('ok'); if (v.sound) ui.speak(e.ch);
      if (v.right % 25 === 0) { ui.toast(`🎉 Уровень долины ${levelOf(v)}!`, 'gold', 3000); ui.confetti(80); }
      b.pop = 1; bubbles.forEach(x => { if (x !== b) x.dead = Math.max(x.dead, .01); });
      quest.done = true; touchW(); hud();
      setTimeout(() => { if (!stop) newRound(); }, 650);
    }
    function onWrong(b) {
      const e = quest.e;
      combo = 0; v.wrong++; session.wrong++;
      const loss = Math.round(v.coins * .06); v.coins -= loss;
      if (!roundWrong) { srs.record(keyOf(e), false); queue.again(e); }
      roundWrong = true; b.dead = .01;
      floatText(b.x, b.y - 30, loss ? '−' + loss : '✕', '#d64545'); burst(b.x, b.y, '#d64545'); ui.sfx('bad');
      quest.wrong = true;
      quest.reveal = h('span', '«', b.e.ch, '» — ', ui.py(b.e.py), ' ', firstGloss(b.e.m));
      banner(); hud(); touchW();
    }

    function update(dt) {
      const modalOpen = document.getElementById('modal').classList.contains('open');
      const [dx, dy] = modalOpen ? [0, 0] : ctl.vec();
      const sp = 190 * (1 + .08 * v.ups.speed);
      P.moving = Math.hypot(dx, dy) > .05;
      P.x = Math.max(34, Math.min(W - 34, P.x + dx * sp * dt)); P.y = Math.max(58, Math.min(H - 20, P.y + dy * sp * dt));
      if (dx > .1) P.face = 1; else if (dx < -.1) P.face = -1;
      if (P.moving) { trail.unshift({ x: P.x, y: P.y }); if (trail.length > 160) trail.length = 160; P.bob += dt * 12; }
      // идл-доход
      v.coins += incomeOf(v) * dt;
      // сбор знаков
      if (quest && !quest.done) {
        const mag = 6 * v.ups.magnet;
        for (const b of bubbles) {
          if (b.dead || b.pop) continue;
          if (Math.hypot(b.x - P.x, (b.y - P.y + 10)) < 30 + b.r + mag) { if (b.ok) onRight(b); else onWrong(b); break; }
        }
        if (!hintShown && (performance.now() - quest.t0) / 1000 > Math.max(1.5, 9 - 1.2 * v.ups.wisdom)) { hintShown = true; banner(); }
      }
      bubbles.forEach(b => { if (b.dead) b.dead += dt * 2; if (b.pop) b.pop += dt * 2; });
      bubbles = bubbles.filter(b => b.dead < 1 && b.pop < 1.2);
      fx.forEach(f => { f.t += dt; if (f.type === 'dot') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; } });
      fx = fx.filter(f => f.t < 1);
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H); ctx.drawImage(backdrop, 0, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const wisdomGlow = v.ups.wisdom >= 5 && hintShown;
      // знаки
      bubbles.forEach(b => {
        const bob = Math.sin(now / 400 + b.ph) * 4, a = b.dead ? Math.max(0, 1 - b.dead) : b.pop ? Math.max(0, 1 - b.pop) : 1;
        const sc = b.pop ? 1 + b.pop * .5 : 1;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(b.x, b.y + bob); ctx.scale(sc, sc);
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(0, b.r + 6, b.r * .8, 8, 0, 0, 6.28); ctx.fill();
        if (b.ok && wisdomGlow && !b.pop) { ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 24; }
        ctx.fillStyle = b.dead ? '#f6c7c7' : '#fffdf6'; ctx.strokeStyle = b.dead ? '#d64545' : '#c9a35b'; ctx.lineWidth = 3;
        rr(ctx, -b.r, -b.r + 4, b.r * 2, b.r * 2 - 8, 16); ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
        const label = b.e.ch; ctx.fillStyle = '#2a2018';
        ctx.font = `700 ${label.length > 2 ? 22 : label.length === 2 ? 30 : 38}px "Noto Serif SC", "Songti SC", serif`;
        ctx.fillText(label, 0, 2);
        ctx.restore();
      });
      // питомцы (идут по следу героя)
      const lv = levelOf(v);
      v.pets.forEach((li, i) => {
        const p = trail[Math.min(trail.length - 1, (i + 1) * 16)] || { x: P.x - 30 * (i + 1), y: P.y };
        const im = spriteOf(li, Math.floor((lv - 1) / 6));
        if (im.complete && im.naturalWidth) { const hh = 40, ww = hh * im.naturalWidth / im.naturalHeight; ctx.drawImage(im, p.x - ww / 2, p.y - hh + 6 + Math.sin(now / 300 + i) * 2, ww, hh); }
      });
      // герой
      const im = spriteOf(v.skin, Math.floor((lv - 1) / 4));
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + 4, 26, 8, 0, 0, 6.28); ctx.fill();
      if (im.complete && im.naturalWidth) {
        const hh = 74, ww = hh * im.naturalWidth / im.naturalHeight, jump = P.moving ? Math.abs(Math.sin(P.bob)) * 6 : Math.sin(now / 500) * 1.5;
        ctx.save(); ctx.translate(P.x, P.y - jump); ctx.scale(P.face, 1); ctx.drawImage(im, -ww / 2, -hh + 8, ww, hh); ctx.restore();
      } else { ctx.font = '40px serif'; ctx.fillText('🙂', P.x, P.y - 30); }
      // эффекты
      fx.forEach(f => {
        if (f.type === 'txt') { ctx.globalAlpha = 1 - f.t; ctx.fillStyle = f.color; ctx.font = '700 22px system-ui, sans-serif'; ctx.fillText(f.text, f.x, f.y - f.t * 40); }
        else { ctx.globalAlpha = 1 - f.t; ctx.fillStyle = f.color; ctx.fillRect(f.x, f.y, 5, 5); }
      });
      ctx.globalAlpha = 1;
      // «джойстик» на касании
      if (ctl.joy.on) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ctl.joy.ox, ctl.joy.oy, 46, 0, 6.28); ctx.stroke();
        const dx = ctl.joy.x - ctl.joy.ox, dy = ctl.joy.y - ctl.joy.oy, d = Math.min(46, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(ctl.joy.ox + Math.cos(a) * d, ctl.joy.oy + Math.sin(a) * d, 20, 0, 6.28); ctx.fill();
      }
    }

    function frame(ts) {
      if (stop) return;
      const dt = Math.min(.05, (ts - last) / 1000); last = ts;
      update(dt); draw(ts);
      saveT += dt; hudT += dt;
      if (hudT > .25) { hudT = 0; hud(); if (quest && !quest.done && !hintShown) banner(); }
      if (saveT > 5) { saveT = 0; v.last = Date.now(); store.save(); }
      raf = requestAnimationFrame(frame);
    }

    /* Магазин и выбор героя */
    function buy(k) {
      const u = UPS[k], lv = v.ups[k];
      if (lv >= u.max) return;
      const c = u.cost(lv);
      if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c; v.ups[k]++; ui.sfx('ok'); touchW(); hud(); shop();
    }
    function buyPet() {
      if (v.pets.length >= PET_MAX) return;
      const c = petCost(v.pets.length);
      if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c;
      const free = HZ.evo.LINES.map((_, i) => i).filter(i => i !== v.skin && !v.pets.includes(i));
      v.pets.push(free[HZ.rand(free.length)]);
      ui.sfx('level'); ui.confetti(50); touchW(); hud(); shop();
    }
    function shop() {
      const rows = Object.keys(UPS).map(k => {
        const u = UPS[k], lv = v.ups[k], maxed = lv >= u.max;
        const b = h('button.btn.evo-up' + (!maxed && v.coins >= u.cost(lv) ? '.afford' : ''), { type: 'button', onclick: () => buy(k), disabled: maxed },
          h('span.ico', u.ico), h('span.evo-up-t', h('b', `${u.name} · ур. ${lv}`), h('small.muted', u.desc(lv))), h('span.evo-up-c', maxed ? 'MAX' : '🪙 ' + fmt(u.cost(lv))));
        return b;
      });
      const pc = petCost(v.pets.length), full = v.pets.length >= PET_MAX;
      rows.push(h('button.btn.evo-up' + (!full && v.coins >= pc ? '.afford' : ''), { type: 'button', onclick: buyPet, disabled: full },
        h('span.ico', '🐾'), h('span.evo-up-t', h('b', `Питомцы · ${v.pets.length}/${PET_MAX}`), h('small.muted', 'Следуют за вами и приносят +2,5 🪙/с каждый')), h('span.evo-up-c', full ? 'MAX' : '🪙 ' + fmt(pc))));
      ui.modal('🛒 Улучшения · 🪙 ' + fmt(v.coins), h('div.evo-ups', rows), [{ label: 'Закрыть', primary: true }]);
    }
    function heroPicker() {
      const lv = levelOf(v);
      const grid = h('div.wk-heroes', HZ.evo.LINES.map((L, i) => h('button.wk-hero' + (v.skin === i ? '.on' : ''), { type: 'button', onclick: () => { v.skin = i; v.pets = v.pets.filter(p => p !== i); touchW(); document.getElementById('modal').classList.remove('open'); } },
        h('img.evo-sprite', { src: `img/evo/${L[0]}-${Math.min(L[2] - 1, Math.floor((lv - 1) / 4))}.webp`, alt: L[1] }), h('small', L[1]))));
      ui.modal('Выберите героя', grid, [{ label: 'Закрыть' }]);
    }

    canvas._dbg = () => ({ P, bubbles, quest, v });
    newRound(); hud();
    raf = requestAnimationFrame(frame);
    canvas.focus();
  }

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

  HZ.valley = { view: valley };
  G.extra = (G.extra || []).concat([
    { group: 'Idle и приключения', ico: '🌄', name: 'Долина знаков', desc: 'Ходите героем (WASD), собирайте нужные знаки, копите монеты, покупайте питомцев — доход идёт и сам', go: () => HZ.router.go('#/valley') },
    { group: 'Аркады', ico: '🐍', name: 'Змейка знаков', get desc() { return 'Управляйте змейкой (WASD) и съедайте знак по заданию. Рекорд: ' + (store.s.best.snake || 0); }, go: snake }
  ]);
})();
