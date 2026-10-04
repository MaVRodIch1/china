/* «Толпа знаний» — бег по дорожке в духе Join Clash: собирайте белых человечков в свою толпу,
 * проходите ворота с верным ответом (значение, чтение или сам иероглиф), обходите розовые щиты,
 * в конце уровня — стенка на стенку с красной толпой и её главарём. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs, G = HZ.games;
  const { makeRound, makeQueue, accOf, pool0, setupCanvas, rr, firstGloss, keyOf } = HZ.play;

  const VW = 540, VH = 760;
  const ROAD = 3.2;                       // полуширина дорожки (в метрах мира)
  const CAM_BACK = 6.5, CAM_H = 5, F = 400, HOR = 228;
  const COL = { me: '#ffc928', meD: '#c98f00', idle: '#f4f4f6', idleD: '#a9abb5', foe: '#ef4b4b', foeD: '#a32020' };
  const HOUSES = [['#7d7fc0', '#5b5d98'], ['#a46e8f', '#7d4f6b'], ['#6f93c4', '#4f6f9c'], ['#b57a63', '#8b5a47'], ['#8c9ab8', '#67758f'], ['#c9a46a', '#9c7c4c']];

  function crowd() {
    const pool = pool0();
    if (pool.length < 8) return ui.toast('Мало знаков для игры — добавьте подборку или выучите несколько знаков');
    const hud = h('span.game-hud');
    const { area, body } = G.frame('Толпа знаний', hud);
    const canvas = h('canvas.wk-canvas.cr-canvas', { tabindex: 0, style: { aspectRatio: `${VW} / ${VH}` } });
    const ctx = setupCanvas(canvas, VW, VH);
    body.append(canvas, h('p.muted.small.center', 'A / D, стрелки или ведите пальцем по полю — толпа бежит влево и вправо. Собирайте белых человечков, проходите в ворота с верным ответом (+люди), неверные ворота отнимают людей, розовые щиты сбивают. В конце — битва с красной толпой и её главарём.'));

    const level = store.s.crowdLvl || 1;
    const queue = makeQueue(() => pool, e => accOf(e) * 5);
    let raf = 0, over = false, left = false, last = performance.now(), t = 0;
    let state = 'run', speed = 11 + Math.min(6, level * .5), camZ = 0;
    const P = { x: 0, z: 0, tx: 0 };            // точка управления толпой
    let members = [{ ox: 0, oz: 0, ph: 0, lead: true }];
    let right = 0, wrong = 0, maxCrowd = 1, combo = 0;
    const wrongSet = new Set(), poofs = [], floats = [];
    const keys = new Set();

    /* ---------- трасса уровня ---------- */
    const Q = 5 + Math.min(5, level), LEN = 60 + Q * 46;
    const gates = [], idles = [], blocks = [], houses = [];
    let seed = level * 7919 + 13; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < Q; i++) {
      const gz = 46 + i * 46;
      const r = makeRound(queue.next().e, pool, level >= 3 ? 3 : 2);
      const kind = ['m', 'zh', 'py'][(i + level) % 3];
      gates.push({ z: gz, r, kind, passed: false, pick: -1 });
      // между воротами: группы белых человечков и щиты
      for (let k = 0; k < 2; k++) {
        const z = gz + 12 + k * 14 + rnd() * 6, x = -ROAD + .8 + rnd() * (ROAD * 2 - 1.6), n = 2 + Math.floor(rnd() * (3 + level / 2));
        idles.push(...Array.from({ length: n }, (_, j) => ({ x: x + (j % 3 - 1) * .55, z: z + Math.floor(j / 3) * .6, ph: rnd() * 6, taken: false })));
      }
      if (level >= 2 || i > 1) {
        const bz = gz + 25 + rnd() * 8, w = 1.5 + rnd() * 1.6, bx = -ROAD + rnd() * (ROAD * 2 - w);
        blocks.push({ x0: bx, x1: bx + w, z: bz, slide: level >= 4 && rnd() < .5 ? .8 + rnd() : 0, ph: rnd() * 6 });
      }
    }
    const FIN = LEN + 14;                        // где стоит красная толпа
    const foes = Array.from({ length: 6 + level * 4 }, (_, i) => ({ x: ((i % 6) - 2.5) * .62 + (Math.random() - .5) * .2, z: FIN + Math.floor(i / 6) * .7, ph: Math.random() * 6, dead: false }));
    const boss = { x: 0, z: FIN + Math.ceil(foes.length / 6) * .7 + 3, hp: 8 + level * 4, max: 8 + level * 4, hit: 0 };
    for (const side of [-1, 1]) {                // дома вдоль улицы
      let z = -10;
      while (z < boss.z + 60) { const d = 6 + rnd() * 5, c = HOUSES[Math.floor(rnd() * HOUSES.length)]; houses.push({ side, z0: z, z1: z + d, h: 4 + rnd() * 6, c }); z += d + .6 + rnd() * 1.2; }
    }

    /* ---------- проекция ---------- */
    const camX = () => P.x * .35;
    function pr(x, y, z) { const dz = z - camZ; if (dz < .4) return null; const s = F / dz; return { x: VW / 2 + (x - camX()) * s, y: HOR + (CAM_H - y) * s, s }; }
    function quad(pts, fill, stroke) {
      const q = pts.map(p => pr(p[0], p[1], p[2])); if (q.some(p => !p)) return;
      ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }

    /* ---------- человечек ---------- */
    function person(x, z, col, colD, ph, run, sc, hat, alpha) {
      const p = pr(x, 0, z); if (!p || p.y > VH + 40) return;
      const k = p.s * (sc || 1), H = 1.55 * k, sw = run ? Math.sin(ph) : Math.sin(ph * .3) * .15;
      if (alpha != null) ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, .32 * k, .1 * k, 0, 0, 6.283); ctx.fill();
      const hipY = p.y - H * .45, shY = p.y - H * .78, lw = Math.max(1.5, .14 * k);
      ctx.lineCap = 'round'; ctx.strokeStyle = colD; ctx.lineWidth = lw * 1.25;
      // ноги и руки
      ctx.beginPath(); ctx.moveTo(p.x - .06 * k, hipY); ctx.lineTo(p.x - .06 * k + sw * .22 * k, p.y - (sw > 0 ? sw * .08 * k : 0));
      ctx.moveTo(p.x + .06 * k, hipY); ctx.lineTo(p.x + .06 * k - sw * .22 * k, p.y - (sw < 0 ? -sw * .08 * k : 0)); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(p.x - .06 * k, hipY); ctx.lineTo(p.x - .06 * k + sw * .22 * k, p.y - .02 * k); ctx.moveTo(p.x + .06 * k, hipY); ctx.lineTo(p.x + .06 * k - sw * .22 * k, p.y - .02 * k); ctx.stroke();
      ctx.strokeStyle = colD; ctx.lineWidth = lw * .95;
      ctx.beginPath(); ctx.moveTo(p.x - .15 * k, shY); ctx.lineTo(p.x - .2 * k - sw * .16 * k, hipY + .05 * k); ctx.moveTo(p.x + .15 * k, shY); ctx.lineTo(p.x + .2 * k + sw * .16 * k, hipY + .05 * k); ctx.stroke();
      // туловище и голова
      ctx.fillStyle = col; ctx.strokeStyle = colD; ctx.lineWidth = Math.max(1, .04 * k);
      rr(ctx, p.x - .17 * k, shY - .05 * k, .34 * k, H * .4, .14 * k); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y - H * .9, .17 * k, 0, 6.283); ctx.fill(); ctx.stroke();
      if (hat) { // соломенная шляпа вожака
        ctx.fillStyle = '#c9a15a'; ctx.strokeStyle = '#7a5a22';
        ctx.beginPath(); ctx.moveTo(p.x - .36 * k, p.y - H * .95); ctx.lineTo(p.x, p.y - H * 1.2); ctx.lineTo(p.x + .36 * k, p.y - H * .95); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- ворота с вариантами ответа ---------- */
    const label = (g, e) => g.kind === 'zh' ? e.ch : g.kind === 'py' ? e.py : firstGloss(e.m);
    function question(g) {
      const e = g.r.ok;
      if (g.kind === 'zh') return { top: 'Найди знак:', big: firstGloss(e.m), sub: '', zh: false };
      if (g.kind === 'py') return { top: 'Как читается?', big: e.ch, sub: '', zh: true };
      return { top: 'Что значит?', big: e.ch, sub: e.py, zh: true };
    }
    function drawGate(g) {
      const n = g.r.items.length, w = ROAD * 2 / n;
      for (let i = 0; i < n; i++) {
        const x0 = -ROAD + i * w, x1 = x0 + w, e = g.r.items[i];
        const ok = e === g.r.ok, done = g.passed;
        const col = done ? (ok ? 'rgba(46,190,110,.55)' : i === g.pick ? 'rgba(230,60,60,.55)' : 'rgba(150,150,170,.35)') : 'rgba(120,200,255,.28)';
        quad([[x0 + .08, 0, g.z], [x1 - .08, 0, g.z], [x1 - .08, 2.4, g.z], [x0 + .08, 2.4, g.z]], col);
        for (const xx of [x0 + .08, x1 - .08]) { const a = pr(xx, 0, g.z), b = pr(xx, 3.2, g.z); if (a && b) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, .12 * a.s); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
        const a = pr(x0 + .14, 3.2, g.z), b = pr(x1 - .14, 2.45, g.z); if (!a || !b) continue;
        ctx.fillStyle = done && ok ? '#2ebe6e' : done && i === g.pick ? '#e64646' : '#fffaf0'; ctx.strokeStyle = '#7a5a22'; ctx.lineWidth = 2;
        rr(ctx, a.x, a.y, b.x - a.x, b.y - a.y, Math.min(10, (b.y - a.y) / 3)); ctx.fill(); ctx.stroke();
        const txt = label(g, e), bw = b.x - a.x, bh = b.y - a.y;
        if (bh < 6) continue;
        const zh = g.kind === 'zh', fs = Math.min(bh * (zh ? .72 : .42), bw / Math.max(1.5, txt.length * (zh ? 1 : .55)));
        ctx.fillStyle = done && (ok || i === g.pick) ? '#fff' : '#2a2018'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `700 ${Math.max(7, fs)}px ${zh ? '"Noto Serif SC","Songti SC",serif' : 'system-ui, sans-serif'}`;
        ctx.fillText(txt, (a.x + b.x) / 2, (a.y + b.y) / 2 + 1);
      }
    }
    function drawBlock(b) {
      const off = b.slide ? Math.sin(t * b.slide + b.ph) * 1.2 : 0, x0 = Math.max(-ROAD, b.x0 + off), x1 = Math.min(ROAD, b.x1 + off);
      for (const xx of [x0 + .2, x1 - .2]) quad([[xx - .06, 0, b.z], [xx + .06, 0, b.z], [xx + .06, 1.4, b.z], [xx - .06, 1.4, b.z]], '#2d3550');
      quad([[x0, 1.4, b.z - .25], [x1, 1.4, b.z - .25], [x1, 1.4, b.z], [x0, 1.4, b.z]], '#f06292');
      quad([[x0, .45, b.z], [x1, .45, b.z], [x1, 1.4, b.z], [x0, 1.4, b.z]], '#d81b60', '#8c0f3d');
    }
    function drawHouse(hs) {
      const xi = hs.side * 8.6, xo = hs.side * 15, [c, cd] = hs.c;
      quad([[xi, 0, hs.z0], [xi, 0, hs.z1], [xi, hs.h, hs.z1], [xi, hs.h, hs.z0]], cd);            // стена к улице
      if (hs.h < CAM_H) quad([[xi, hs.h, hs.z0], [xo, hs.h, hs.z0], [xo, hs.h, hs.z1], [xi, hs.h, hs.z1]], '#d9dbe3');
      quad([[xi, 0, hs.z0], [xo, 0, hs.z0], [xo, hs.h, hs.z0], [xi, hs.h, hs.z0]], c);              // фасад
      for (let fy = 1; fy + 1.2 < hs.h; fy += 2.2) for (let fz = hs.z0 + .8; fz + 1 < hs.z1; fz += 2.2) quad([[xi, fy, fz], [xi, fy, fz + 1], [xi, fy + 1.1, fz + 1], [xi, fy + 1.1, fz]], 'rgba(30,35,60,.55)');
      for (let fy = 1; fy + 1.2 < hs.h; fy += 2.2) { const a = xi + hs.side * 1.4, b2 = xi + hs.side * 2.6; quad([[a, fy, hs.z0], [b2, fy, hs.z0], [b2, fy + 1.1, hs.z0], [a, fy + 1.1, hs.z0]], 'rgba(255,255,255,.75)'); }
    }

    /* ---------- позиция участника толпы ---------- */
    function slots() {
      const n = members.length, k = Math.min(1, 2.5 / (.4 * Math.sqrt(Math.max(1, n))));
      members.forEach((m, i) => {
        if (m.lead) { m.tx = 0; m.tz = 0; return; }
        const r = .4 * Math.sqrt(i) * k, a = i * 2.39996;
        m.tx = Math.cos(a) * r; m.tz = Math.sin(a) * r * .8 - .2;
      });
    }
    const wpos = m => ({ x: Math.max(-ROAD + .2, Math.min(ROAD - .2, P.x + m.ox)), z: P.z + m.oz });
    function addMembers(n, x, z) {
      for (let i = 0; i < n; i++) members.push({ ox: (x == null ? (Math.random() - .5) * 2 : x - P.x), oz: (z == null ? -1 - Math.random() : z - P.z), ph: Math.random() * 6 });
      slots(); maxCrowd = Math.max(maxCrowd, members.length);
    }
    function killMember(m, col) {
      const i = members.indexOf(m); if (i < 0) return;
      const w = wpos(m); poofs.push({ x: w.x, z: w.z, t: 0, col: col || COL.me });
      members.splice(i, 1);
      if (m.lead && members.length) { members[0].lead = true; } // шляпа переходит следующему
      slots();
      if (!members.length) lose();
    }
    function floatMsg(text, col) { floats.push({ text, col, t: 0 }); }

    /* ---------- управление ---------- */
    const kd = ev => { if (['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) { keys.add(ev.code); ev.preventDefault(); } };
    const ku = ev => keys.delete(ev.code);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    let drag = null;
    canvas.addEventListener('pointerdown', ev => { canvas.setPointerCapture(ev.pointerId); drag = { x: ev.clientX, tx: P.tx }; });
    canvas.addEventListener('pointermove', ev => { if (!drag) return; const r = canvas.getBoundingClientRect(); P.tx = Math.max(-ROAD + .3, Math.min(ROAD - .3, drag.tx + (ev.clientX - drag.x) / r.width * ROAD * 2.6)); });
    const up = () => { drag = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    const cleanup = () => { over = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    HZ.router.onLeave(() => { left = true; cleanup(); });

    /* ---------- логика ---------- */
    function passGate(g) {
      const n = g.r.items.length, w = ROAD * 2 / n, i = Math.max(0, Math.min(n - 1, Math.floor((P.x + ROAD) / w)));
      g.passed = true; g.pick = i;
      const e = g.r.ok, ok = g.r.items[i] === e, K = 4 + Math.floor(level / 2) + Math.min(combo, 4);
      srs.record(keyOf(e), ok);
      if (ok) {
        right++; combo++; addMembers(K, P.x, P.z + .5); ui.sfx('ok'); ui.speak(e.ch);
        floatMsg(`+${K} 👥  ${e.ch} — ${firstGloss(e.m)}`, '#2ebe6e');
      } else {
        wrong++; combo = 0; wrongSet.add(keyOf(e)); queue.again(e); ui.sfx('bad');
        const lose = Math.min(K, members.length - 1);
        for (let j = 0; j < lose; j++) killMember(members[members.length - 1], COL.me);
        floatMsg(`−${lose} 👥  верно: ${e.ch} · ${e.py} · ${firstGloss(e.m)}`, '#e64646');
      }
    }
    function update(dt) {
      t += dt;
      let dir = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      if (dir) P.tx = Math.max(-ROAD + .3, Math.min(ROAD - .3, P.tx + dir * 7 * dt));
      P.x += Math.max(-9 * dt, Math.min(9 * dt, P.tx - P.x));
      if (state === 'run') {
        P.z += speed * dt;
        for (const g of gates) if (!g.passed && P.z >= g.z) passGate(g);
        for (const p of idles) if (!p.taken && Math.abs(p.z - P.z) < 1.4) {
          for (const m of members) { const w = wpos(m); if (Math.hypot(w.x - p.x, w.z - p.z) < .55) { p.taken = true; addMembers(1, p.x, p.z); break; } }
        }
        for (const b of blocks) {
          if (Math.abs(b.z - P.z) > 3) continue;
          const off = b.slide ? Math.sin(t * b.slide + b.ph) * 1.2 : 0, x0 = b.x0 + off, x1 = b.x1 + off;
          for (const m of members.slice()) { const w = wpos(m); if (w.x > x0 - .1 && w.x < x1 + .1 && Math.abs(w.z - b.z) < .3) { killMember(m); if (state !== 'run') return; } }
        }
        if (P.z >= FIN - 3) { state = 'clash'; ui.sfx('level'); floatMsg('⚔️ Битва!', '#ef4b4b'); }
      } else if (state === 'clash') {
        const alive = foes.filter(f => !f.dead);
        for (const f of alive) { // красные бегут навстречу
          const dx = P.x - f.x, dz = P.z - f.z, d = Math.hypot(dx, dz) || 1; f.x += dx / d * 4.5 * dt; f.z += dz / d * 4.5 * dt; f.ph += dt * 12;
          for (const m of members) { const w = wpos(m); if (Math.hypot(w.x - f.x, w.z - f.z) < .45) { f.dead = true; poofs.push({ x: f.x, z: f.z, t: 0, col: COL.foe }); killMember(m); break; } }
          if (state !== 'clash') return;
        }
        P.z += 2 * dt;
        if (!foes.some(f => !f.dead)) { state = 'boss'; floatMsg('👑 Главарь!', '#ef4b4b'); }
      } else if (state === 'boss') {
        P.z += 5 * dt; P.tx = boss.x;
        boss.hit = Math.max(0, boss.hit - dt);
        for (const m of members.slice()) {
          const w = wpos(m);
          if (Math.hypot(w.x - boss.x, w.z - boss.z) < 1.1) { killMember(m); boss.hp--; boss.hit = .15; ui.sfx('click'); if (boss.hp <= 0) return win(); if (state !== 'boss') return; }
        }
        if (P.z > boss.z + 2) P.z = boss.z + 2;
      }
      for (const m of members) { m.ox += (m.tx - m.ox) * Math.min(1, 6 * dt); m.oz += (m.tz - m.oz) * Math.min(1, 6 * dt); m.ph += dt * 13; }
      camZ = P.z - CAM_BACK;
      poofs.forEach(p => { p.t += dt; }); for (let i = poofs.length - 1; i >= 0; i--) if (poofs[i].t > .5) poofs.splice(i, 1);
      floats.forEach(f => { f.t += dt; }); while (floats.length && floats[0].t > 2.6) floats.shift();
    }

    /* ---------- отрисовка ---------- */
    function draw() {
      const sky = ctx.createLinearGradient(0, 0, 0, HOR + 40); sky.addColorStop(0, '#9fd3ff'); sky.addColorStop(1, '#e8f4ff');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
      ctx.fillStyle = '#b9bdc8'; ctx.fillRect(0, HOR, VW, VH - HOR);
      // тротуары и дорожка полосами
      const far = camZ + 150;
      for (let z = Math.floor(far / 4) * 4; z > camZ + .5; z -= 4) {
        const z0 = Math.max(camZ + .45, z - 4), alt = Math.floor(z / 4) % 2;
        quad([[-8.6, 0, z0], [-ROAD - .35, 0, z0], [-ROAD - .35, 0, z], [-8.6, 0, z]], alt ? '#cfd2da' : '#c6c9d2');
        quad([[ROAD + .35, 0, z0], [8.6, 0, z0], [8.6, 0, z], [ROAD + .35, 0, z]], alt ? '#cfd2da' : '#c6c9d2');
        quad([[-ROAD - .35, 0, z0], [ROAD + .35, 0, z0], [ROAD + .35, 0, z], [-ROAD - .35, 0, z]], '#2c5fb5');
        quad([[-ROAD, 0, z0], [ROAD, 0, z0], [ROAD, 0, z], [-ROAD, 0, z]], alt ? '#4a97ea' : '#4290e4');
      }
      // финиш
      quad([[-ROAD, 0, FIN - 3.3], [ROAD, 0, FIN - 3.3], [ROAD, 0, FIN - 2.7], [-ROAD, 0, FIN - 2.7]], '#ffffff');
      // всё объёмное — от дальнего к ближнему
      const items = [];
      for (const hs of houses) if (hs.z1 > camZ + .5 && hs.z0 < far) items.push([hs.z1 + 50, () => drawHouse(hs)]);
      for (const g of gates) if (g.z > camZ + .5 && g.z < far) items.push([g.z, () => drawGate(g)]);
      for (const b of blocks) if (b.z > camZ + .5 && b.z < far) items.push([b.z, () => drawBlock(b)]);
      for (const p of idles) if (!p.taken && p.z > camZ + .5 && p.z < far) items.push([p.z, () => person(p.x, p.z, COL.idle, COL.idleD, p.ph + t * 2, false)]);
      for (const f of foes) if (!f.dead && f.z < far) items.push([f.z, () => person(f.x, f.z, COL.foe, COL.foeD, f.ph, state === 'clash')]);
      if (boss.hp > 0 && boss.z < far) items.push([boss.z, () => { person(boss.x, boss.z, boss.hit > 0 ? '#ffffff' : COL.foe, COL.foeD, t * 2, false, 2.4); const p = pr(boss.x, 4.2, boss.z); if (p) { ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, p.x - 40, p.y - 9, 80, 10, 5); ctx.fill(); ctx.fillStyle = '#ef4b4b'; rr(ctx, p.x - 38, p.y - 7, 76 * boss.hp / boss.max, 6, 3); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('👑 ' + boss.hp, p.x, p.y - 16); } }]);
      for (const m of members) { const w = wpos(m); items.push([w.z, () => person(w.x, w.z, COL.me, COL.meD, m.ph, state !== 'boss' || true, 1, m.lead)]); }
      for (const p of poofs) items.push([p.z, () => { const q = pr(p.x, .8, p.z); if (!q) return; ctx.globalAlpha = 1 - p.t / .5; ctx.fillStyle = p.col; for (let i = 0; i < 6; i++) { const a = i * 1.047 + p.t * 3, r = (.2 + p.t * 1.6) * q.s; ctx.beginPath(); ctx.arc(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r * .6, Math.max(1.5, .09 * q.s), 0, 6.283); ctx.fill(); } ctx.globalAlpha = 1; }]);
      items.sort((a, b) => b[0] - a[0]).forEach(it => it[1]());
      // число людей над толпой
      const lp = pr(P.x, 2.6, P.z);
      if (lp) { const txt = '👥 ' + members.length; ctx.font = '800 16px system-ui, sans-serif'; const w = ctx.measureText(txt).width + 18; ctx.fillStyle = 'rgba(30,30,40,.75)'; rr(ctx, lp.x - w / 2, lp.y - 28, w, 24, 12); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, lp.x, lp.y - 16); }
      drawHud();
    }
    function drawHud() {
      // прогресс уровня
      ctx.fillStyle = 'rgba(20,30,50,.55)'; rr(ctx, 14, 12, VW - 28, 30, 15); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`Уровень ${level}`, 28, 27);
      const bx = 118, bw = VW - 150, k = Math.min(1, P.z / FIN);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(ctx, bx, 22, bw, 10, 5); ctx.fill(); ctx.fillStyle = '#ffd24a'; rr(ctx, bx, 22, Math.max(10, bw * k), 10, 5); ctx.fill();
      // вопрос ближайших ворот
      const g = gates.find(x => !x.passed);
      if (g && state === 'run' && g.z - P.z < 70) {
        const q = question(g), y0 = 52, hh = 84, x0 = 24, w = VW - 48;
        ctx.fillStyle = 'rgba(255,250,240,.96)'; ctx.strokeStyle = '#c9a35b'; ctx.lineWidth = 3; rr(ctx, x0, y0, w, hh, 16); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'center'; ctx.fillStyle = '#7a6a58'; ctx.font = '700 13px system-ui, sans-serif'; ctx.fillText(q.top + '  Беги в ворота с ответом', VW / 2, y0 + 16);
        ctx.fillStyle = '#231a12';
        ctx.font = q.zh ? `700 ${q.big.length > 2 ? 34 : 42}px "Noto Serif SC","Songti SC",serif` : '800 24px system-ui, sans-serif';
        let big = q.big; while (ctx.measureText(big).width > w - 30 && big.length > 3) big = big.slice(0, -2) + '…';
        ctx.fillText(big, VW / 2, y0 + (q.sub ? 46 : 52));
        if (q.sub) { ctx.font = '700 15px system-ui, sans-serif'; ctx.fillStyle = '#2e6fe0'; ctx.fillText(q.sub, VW / 2, y0 + 72); }
        // варианты в том же порядке, что и ворота (слева направо)
        const n = g.r.items.length, cw = (w - 16) / n, zh = g.kind === 'zh';
        g.r.items.forEach((e, i) => {
          const cx0 = x0 + 8 + i * cw, cy = y0 + hh + 6;
          ctx.fillStyle = 'rgba(255,250,240,.92)'; ctx.strokeStyle = '#c9a35b'; ctx.lineWidth = 2; rr(ctx, cx0 + 3, cy, cw - 6, 30, 10); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#2a2018'; ctx.font = zh ? '700 19px "Noto Serif SC","Songti SC",serif' : '700 14px system-ui, sans-serif';
          let tx = label(g, e); while (ctx.measureText(tx).width > cw - 16 && tx.length > 3) tx = tx.slice(0, -2) + '…';
          ctx.fillText(tx, cx0 + cw / 2, cy + 16);
          if (i < n - 1) { ctx.fillStyle = '#c9a35b'; ctx.font = '800 12px system-ui, sans-serif'; }
        });
        ctx.fillStyle = '#7a6a58'; ctx.font = '700 11px system-ui, sans-serif'; ctx.fillText('← ворота слева · справа →', VW / 2, y0 + hh + 48);
      }
      // сообщения
      floats.forEach((f, i) => {
        const a = Math.min(1, (2.6 - f.t) * 2), y = VH - 70 - i * 34 - f.t * 10;
        ctx.globalAlpha = a; ctx.font = '800 15px system-ui, sans-serif'; ctx.textAlign = 'center';
        let s = f.text; while (ctx.measureText(s).width > VW - 60 && s.length > 4) s = s.slice(0, -2) + '…';
        const w = ctx.measureText(s).width + 24; ctx.fillStyle = f.col; rr(ctx, VW / 2 - w / 2, y - 14, w, 28, 14); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(s, VW / 2, y + 1);
        ctx.globalAlpha = 1;
      });
      hud.textContent = `👥 ${members.length} · ✓ ${right} · ✗ ${wrong}`;
    }
    function loop(ts) {
      if (over) return;
      const dt = Math.min(.05, (ts - last) / 1000); last = ts;
      update(dt); if (!over) draw();
      raf = requestAnimationFrame(loop);
    }

    /* ---------- конец уровня ---------- */
    function end(won) {
      if (left) return;
      cleanup();
      if (won) store.s.crowdLvl = level + 1;
      const prev = store.s.best.crowd || 0, reached = won ? level : level - 1, rec = reached > prev && prev > 0;
      if (reached > prev) store.s.best.crowd = reached;
      const xp = right * 3 + (won ? 10 + level * 2 : 0); HZ.gami.addXP(xp); HZ.gami.onGame(right, right + wrong); store.save();
      if (won) ui.confetti(140);
      G.summary(area, { emoji: won ? '🏆' : '💪', title: won ? `Уровень ${level} пройден!` : 'Толпа рассеялась', record: rec,
        stats: [[level, 'уровень'], [right, 'верно'], [maxCrowd, 'макс. толпа'], ['+' + xp, 'XP']],
        bad: [...wrongSet].map(k => { const e = HZ.entry(k); return e ? h('div.sent-bad-row', h('span.zh', e.ch), h('small.muted', ui.py(e.py), ' · ', firstGloss(e.m))) : null; }).filter(Boolean),
        again: crowd });
    }
    function win() { state = 'won'; setTimeout(() => end(true), 900); ui.sfx('level'); floatMsg('🏆 Победа!', '#2ebe6e'); }
    function lose() { if (state === 'lost') return; state = 'lost'; setTimeout(() => end(false), 700); }

    canvas._dbg = () => ({ P, members, gates, foes, boss, idles, blocks, get state() { return state; }, passGate, addMembers, FIN, setZ: z => { P.z = z; } });
    slots(); canvas.focus();
    raf = requestAnimationFrame(loop);
  }

  G.extra = (G.extra || []).concat([
    { group: 'Аркады', ico: '🏃', name: 'Толпа знаний', get desc() { return 'Бегите толпой по улице: в воротах выбирайте верный перевод, чтение или знак — толпа растёт; в конце битва с красными. Уровень: ' + (store.s.crowdLvl || 1); }, go: crowd }
  ]);
  HZ.crowd = crowd;
})();
