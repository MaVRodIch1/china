/* Маршрутизатор и запуск приложения. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store;

  let leaveFns = [];
  const router = {
    onLeave(fn) { leaveFns.push(fn); },
    go(hash) { if (location.hash === hash) router.render(); else location.hash = hash; },
    render() {
      leaveFns.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); leaveFns = [];
      document.getElementById('modal').classList.remove('open');
      const parts = (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent);
      const [name, a, b] = parts;
      const v = document.getElementById('view');
      window.scrollTo(0, 0);
      let nav = name;
      try {
        switch (name) {
          case 'home': HZ.views.home(); break;
          case 'study': nav = 'study'; HZ.study.start(a, b); break;
          case 'games': HZ.games.hub(); break;
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
