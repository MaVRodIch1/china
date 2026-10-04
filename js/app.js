/* Маршрутизатор и запуск приложения. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store;

  let leaveFns = [];
  // корневые разделы (пункты меню) и куда возвращаться, если истории нет
  const ROOTS = new Set(['home', 'games', 'evo', 'library', 'collections', 'stats']);
  const PARENT = { char: '#/library', word: '#/words', words: '#/library', texts: '#/library', text: '#/texts', collection: '#/collections', valley: '#/games', settings: '#/', study: '#/' };
  const stack = [];
  const routeName = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/')[0] || 'home';
  const exitBtn = () => document.querySelector('#view .study-head .icon-btn[aria-label="Выйти"]');
  function track() {
    const hsh = location.hash || '#/';
    if (stack.length > 1 && stack[stack.length - 2] === hsh) stack.pop();
    else if (stack[stack.length - 1] !== hsh) stack.push(hsh);
    if (stack.length > 60) stack.shift();
  }
  function updateBack() {
    const btn = document.getElementById('back-btn'); if (!btn) return;
    const show = !ROOTS.has(routeName()) || !!exitBtn();
    btn.hidden = !show; document.body.classList.toggle('has-back', show);
  }
  const slowMs = {};                          // сколько рисовался каждый экран в прошлый раз
  let pending = 0;
  function spinner(on) { document.body.classList.toggle('loading', on); }
  const router = {
    _slow: slowMs,
    back() {
      const ex = exitBtn();
      if (ex) return ex.click();                 // игра или сессия: выйти в меню
      if (stack.length > 1) return history.back();
      location.replace(PARENT[routeName()] || '#/');
    },
    updateBack,
    onLeave(fn) { leaveFns.push(fn); },
    go(hash) { if (location.hash === hash) router.render(); else location.hash = hash; },
    render() {
      // тяжёлый экран: сначала показать индикатор загрузки, а рисовать — в следующем кадре
      const nm = routeName(), id = ++pending;
      if ((slowMs[nm] || 0) > 90) { spinner(true); requestAnimationFrame(() => requestAnimationFrame(() => { if (id === pending) router.paint(); })); return; }
      router.paint();
    },
    paint() {
      const t0 = performance.now();
      leaveFns.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); leaveFns = [];
      track();
      document.getElementById('modal').classList.remove('open');
      const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent);
      const [name, a, b] = parts;
      const v = document.getElementById('view');
      window.scrollTo({ top: 0, behavior: 'instant' });
      let nav = name;
      try {
        switch (name) {
          case 'home': HZ.views.home(); break;
          case 'study': nav = 'study'; HZ.study.start(a, b); break;
          case 'games': HZ.games.hub(); break;
          case 'texts': nav = 'library'; HZ.views.texts(); break;
          case 'text': nav = 'library'; HZ.views.text(a); break;
          case 'valley': nav = 'games'; HZ.valley.view(); break;
          case 'evo': nav = 'evo'; HZ.evo.view(); break;
          case 'library': HZ.views.library(); break;
          case 'char': nav = 'library'; HZ.views.char(a); break;
          case 'words': nav = 'library'; HZ.views.words(); break;
          case 'word': nav = 'library'; HZ.views.word(a); break;
          case 'collections': HZ.views.collections(); break;
          case 'collection': nav = 'collections'; HZ.views.collection(parts.slice(1).join('/')); break;
          case 'stats': HZ.views.stats(); break;
          case 'settings': HZ.views.settings(); break;
          default: nav = 'home'; HZ.views.home();
        }
      } catch (err) {
        console.error(err);
        ui.clear(v).append(h('div.empty', h('h2', 'Что-то пошло не так'), h('p.muted', String(err.message)), h('a.btn', { href: '#/' }, 'На главную')));
      }
      document.querySelectorAll('[data-nav]').forEach(a2 => a2.classList.toggle('active', a2.dataset.nav === (nav === 'home' ? 'home' : nav)));
      document.body.classList.toggle('focus', name === 'study');
      // плавное появление страницы (анимация всего контейнера, без принудительной перекладки)
      if (v.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) v.animate([{ opacity: .35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 130, easing: 'ease-out' });
      spinner(false);
      slowMs[name || 'home'] = performance.now() - t0;
      updateBack();
      HZ.gami.refreshHeader();
    }
  };
  HZ.router = router;

  function welcome() {
    const s = store.s.settings;
    if (s.onboarded) return;
    s.onboarded = true; store.save();
    const sel = h('select.input', [3, 5, 10, 15, 20].map(n => h('option', { value: n }, n + ' в день')));
    sel.value = String(s.newPerDay);
    ui.modal('Добро пожаловать в Ханьцзы 汉字', h('div',
      h('p', 'Здесь иероглифы учатся через образы, ключи и интервальные повторения: приложение само подскажет, когда пора повторить каждый знак.'),
      h('label.field', h('span', 'Сколько новых иероглифов в день?'), sel)),
      [{ label: 'Пройти тест уровня', onclick: () => { s.newPerDay = +sel.value; store.save(); setTimeout(() => HZ.games.placement(), 50); } },
       { label: 'Начать с нуля', primary: true, onclick: () => { s.newPerDay = +sel.value; store.save(); router.render(); } }]);
  }

  function init() {
    HZ.applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', HZ.applyTheme);
    document.getElementById('theme-toggle').onclick = () => {
      const cur = document.documentElement.dataset.theme;
      store.s.settings.theme = cur === 'dark' ? 'light' : 'dark'; store.save(); HZ.applyTheme();
    };
    window.addEventListener('hashchange', router.render);
    // «Назад»: кнопка в шапке, Esc, свайп от левого края
    document.getElementById('back-btn').onclick = () => router.back();
    new MutationObserver(() => { cancelAnimationFrame(router._ub); router._ub = requestAnimationFrame(updateBack); }).observe(document.getElementById('view'), { childList: true, subtree: true });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.getElementById('modal').classList.contains('open')) return;
      const t = document.activeElement && document.activeElement.tagName;
      if (/^(INPUT|TEXTAREA|SELECT|CANVAS)$/.test(t) || document.getElementById('back-btn').hidden || document.querySelector('#view canvas')) return; // в играх Esc не уводит со страницы
      router.back();
    });
    let sw = null;
    document.addEventListener('touchstart', e => { const t = e.touches[0]; sw = e.touches.length === 1 && t.clientX < 24 && !e.target.closest('canvas') ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
    document.addEventListener('touchend', e => { if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = Math.abs(t.clientY - sw.y); sw = null; if (dx > 80 && dy < 60 && !document.getElementById('back-btn').hidden) router.back(); }, { passive: true });
    document.addEventListener('click', e => { const a = e.target.closest('a[href^="#/"]'); if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); router.render(); } });
    HZ.gami.questsToday();
    HZ.sync.onChange(() => { if (location.hash === '#/settings') HZ.views.settings(); });
    HZ.sync.init();
    router.render();
    welcome();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
