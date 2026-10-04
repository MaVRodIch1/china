/* UI-утилиты: построитель DOM, тосты, модальные окна, конфетти, звук и озвучка. */
(function () {
  'use strict';
  const HZ = window.HZ;

  /** h('div.class#id', {attrs}, ...children) */
  function h(tag, attrs, ...kids) {
    const m = /^([a-z0-9]+)((?:[.#][\w-]+)*)$/i.exec(tag) || [null, tag, ''];
    const el = document.createElement(m[1]);
    (m[2].match(/[.#][\w-]+/g) || []).forEach(t => t[0] === '.' ? el.classList.add(t.slice(1)) : (el.id = t.slice(1)));
    if (attrs != null && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') v.split(' ').filter(Boolean).forEach(c => el.classList.add(c));
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    const add = k => {
      if (k == null || k === false) return;
      if (Array.isArray(k)) k.forEach(add);
      else el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    };
    kids.forEach(add);
    return el;
  }
  const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Пиньинь с цветом по тонам (слоги разделены пробелами) */
  function py(text, cls = '') {
    const span = h('span.py' + (cls ? '.' + cls : ''));
    (text || '').split(/(\s+)/).forEach(tok => {
      if (!tok.trim()) { span.appendChild(document.createTextNode(tok)); return; }
      const core = tok.replace(/[.,!?;:…。，！？]/g, '');
      span.appendChild(h('span.t' + HZ.toneOf(core), tok));
    });
    return span;
  }

  /* ---------- Тосты ---------- */
  function toast(msg, kind = '', ms = 2600) {
    const box = document.getElementById('toasts');
    const t = h('div.toast' + (kind ? '.' + kind : ''), { role: 'status' }, msg);
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
  }

  /* ---------- Модальное окно ---------- */
  function modal(title, body, actions = []) {
    const root = document.getElementById('modal');
    clear(root);
    const close = () => { root.classList.remove('open'); clear(root); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const box = h('div.modal-box', { role: 'dialog', 'aria-modal': 'true' },
      h('div.modal-head', h('h3', title), h('button.icon-btn', { onclick: close, 'aria-label': 'Закрыть' }, '✕')),
      h('div.modal-body', body),
      actions.length ? h('div.modal-actions', actions.map(a => h('button.btn' + (a.primary ? '.primary' : '') + (a.danger ? '.danger' : ''), {
        onclick: () => { if (a.onclick && a.onclick(close) === false) return; if (!a.keep) close(); }
      }, a.label))) : null);
    root.appendChild(box);
    root.classList.toggle('anim', !root.classList.contains('open')); // плавное появление — только при первом открытии
    root.classList.add('open');
    root.onclick = e => { if (e.target === root) close(); };
    const first = box.querySelector('input,textarea,select');
    if (first) setTimeout(() => first.focus(), 30);
    return close;
  }
  function confirmBox(title, text, okLabel, onOk, danger) {
    modal(title, h('p', text), [{ label: 'Отмена' }, { label: okLabel, primary: !danger, danger, onclick: () => { onOk(); } }]);
  }
  function prompt(title, label, value, okLabel, onOk) {
    const inp = h('input.input', { type: 'text', value: value || '', maxlength: 40, placeholder: label });
    modal(title, h('label.field', h('span', label), inp), [
      { label: 'Отмена' },
      { label: okLabel, primary: true, onclick: () => { const v = inp.value.trim(); if (!v) { inp.focus(); return false; } onOk(v); } }
    ]);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector('.modal-actions .primary').click(); });
  }

  /* ---------- Конфетти ---------- */
  function confetti(n = 90) {
    const cv = document.getElementById('confetti');
    if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const colors = ['#e4572e', '#f3a712', '#29a870', '#2e86de', '#9b59b6', '#ff6b9d'];
    const ps = Array.from({ length: n }, () => ({
      x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .4, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4,
      s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[HZ.rand(colors.length)], life: 0
    }));
    let frame = 0;
    (function step() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach(p => {
        p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - p.life / 110);
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      });
      if (++frame < 120) requestAnimationFrame(step); else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  /* ---------- Звук и озвучка ---------- */
  let actx;
  function beep(freq, dur, when = 0, type = 'sine', vol = .08) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + when;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch (e) { /* аудио недоступно */ }
  }
  function sfx(kind) {
    if (!HZ.store.s.settings.sfx) return;
    if (kind === 'ok') { beep(660, .12); beep(880, .18, .09); }
    else if (kind === 'bad') { beep(220, .25, 0, 'triangle', .1); }
    else if (kind === 'level') { [523, 659, 784, 1047].forEach((f, i) => beep(f, .2, i * .1)); }
    else if (kind === 'click') beep(500, .04, 0, 'sine', .03);
  }

  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
    return voice;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  /** Озвучка: сначала файл (если задан в данных), затем голос системы (zh-CN). */
  let noVoiceAt = 0;
  function speak(text, url) {
    if (url) { new Audio(url).play().catch(() => { }); return true; }
    if (!('speechSynthesis' in window)) { toast('Озвучка не поддерживается этим браузером', 'warn'); return false; }
    if (!pickVoice() && Date.now() - noVoiceAt > 30000) { noVoiceAt = Date.now(); toast('В системе нет китайского голоса — установите его в настройках ОС', 'warn', 4000); }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = HZ.store.s.settings.rate || .8;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
    return true;
  }
  const speakBtn = (text, cls = '') => h('button.icon-btn.speak' + (cls ? '.' + cls : ''), {
    type: 'button', title: 'Прослушать', 'aria-label': 'Прослушать',
    onclick: e => { e.stopPropagation(); speak(text); }
  }, '🔊');

  /* ---------- Hanzi Writer (порядок черт) ---------- */
  let hwPromise;
  function loadHanziWriter() {
    if (window.HanziWriter) return Promise.resolve();
    if (hwPromise) return hwPromise;
    hwPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5.0/dist/hanzi-writer.min.js';
      s.onload = res; s.onerror = () => { hwPromise = null; rej(new Error('offline')); };
      document.head.appendChild(s);
    });
    return hwPromise;
  }

  HZ.ui = { h, clear, esc, py, toast, modal, confirmBox, prompt, confetti, sfx, speak, speakBtn, loadHanziWriter };
})();
