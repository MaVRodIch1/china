/* Геймификация: XP, уровни, серия, достижения, ежедневные задания. */
(function () {
  'use strict';
  const HZ = window.HZ, store = HZ.store, ui = HZ.ui;

  const TITLES = ['Новичок', 'Ученик', 'Любопытный', 'Знаток черт', 'Каллиграф', 'Мастер ключей', 'Книжник', 'Учёный', 'Мудрец', 'Лунвэнь-мастер'];
  const levelOf = xp => Math.floor(Math.sqrt(xp / 40)) + 1;
  const xpFor = lvl => 40 * (lvl - 1) * (lvl - 1);
  function levelInfo(xp = store.s.xp) {
    const lvl = levelOf(xp), a = xpFor(lvl), b = xpFor(lvl + 1);
    return { lvl, title: TITLES[Math.min(TITLES.length - 1, Math.floor((lvl - 1) / 2))], into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
  }

  function addXP(n, why) {
    if (!n) return;
    const before = levelOf(store.s.xp);
    store.s.xp += n;
    store.today().xp += n;
    const after = levelOf(store.s.xp);
    store.save();
    if (after > before) {
      ui.sfx('level'); ui.confetti(140);
      ui.toast(`🎉 Новый уровень: ${after} — ${levelInfo().title}!`, 'gold', 4000);
    }
    refreshHeader();
    check();
  }

  /* ---------- Серия ---------- */
  function touch() { // любая учебная активность за день
    const s = store.s.streak, today = HZ.dayKey();
    if (s.last === today) return;
    const yest = HZ.dayKey(HZ.addDays(new Date(), -1));
    s.count = s.last === yest ? s.count + 1 : 1;
    s.best = Math.max(s.best, s.count);
    s.last = today;
    store.save();
    if ([3, 7, 14, 30, 60, 100, 365].includes(s.count)) {
      ui.toast(`🔥 Серия ${s.count} ${HZ.plural(s.count, 'день', 'дня', 'дней')}! Бонус +${s.count * 5} XP`, 'gold', 4000);
      store.s.xp += s.count * 5; store.today().xp += s.count * 5; ui.confetti(80);
    }
  }
  function streakNow() {
    const s = store.s.streak;
    if (!s.last) return 0;
    const today = HZ.dayKey(), yest = HZ.dayKey(HZ.addDays(new Date(), -1));
    return s.last === today || s.last === yest ? s.count : 0;
  }
  const activeToday = () => store.s.streak.last === HZ.dayKey();

  /** Событие: пройдена карточка в SRS. */
  function onReview(correct, wasNew) {
    const t = store.today();
    t.rev++; if (correct) t.ok++;
    if (wasNew) t.newc++;
    touch(); store.save();
    checkQuests(); check();
  }
  function onGame(correct, total) {
    const t = store.today();
    t.games++; touch(); store.save();
    checkQuests(); check();
  }

  /* ---------- Ежедневные задания ---------- */
  const QUEST_POOL = [
    { id: 'rev', label: n => `Повторить ${n} ${HZ.plural(n, 'карточку', 'карточки', 'карточек')}`, target: () => 15, metric: t => t.rev, xp: 30 },
    { id: 'new', label: n => `Выучить ${n} ${HZ.plural(n, 'новый иероглиф', 'новых иероглифа', 'новых иероглифов')}`, target: () => Math.max(1, Math.min(5, store.s.settings.newPerDay)), metric: t => t.newc, xp: 40 },
    { id: 'game', label: n => `Сыграть в ${n} ${HZ.plural(n, 'мини-игру', 'мини-игры', 'мини-игр')}`, target: () => 2, metric: t => t.games, xp: 25 },
    { id: 'ok', label: n => `Дать ${n} верных ответов в повторении`, target: () => 20, metric: t => t.ok, xp: 35 },
    { id: 'xp', label: n => `Набрать ${n} XP`, target: () => 120, metric: t => t.xp, xp: 20 }
  ];
  function questsToday() {
    const q = store.s.quests, today = HZ.dayKey();
    if (q.date !== today) { q.date = today; q.done = {}; q.ids = null; }
    if (!q.ids) {
      // 3 задания: повторение — всегда, остальные выбираются детерминированно по дате
      const rest = QUEST_POOL.filter(x => x.id !== 'rev');
      let seed = HZ.hash(today);
      const picked = [];
      while (picked.length < 2) { const i = seed % rest.length; picked.push(rest.splice(i, 1)[0].id); seed = Math.floor(seed / 7) + 13; }
      q.ids = ['rev', ...picked];
      store.save();
    }
    const t = store.today();
    return q.ids.map(id => {
      const d = QUEST_POOL.find(x => x.id === id), target = d.target();
      const val = Math.min(target, d.metric(t));
      return { id, text: d.label(target), target, val, done: !!q.done[id], xp: d.xp };
    });
  }
  function checkQuests() {
    const q = store.s.quests;
    questsToday().forEach(x => {
      if (x.val >= x.target && !q.done[x.id]) {
        q.done[x.id] = true; store.save();
        ui.toast(`✅ Задание выполнено: ${x.text} (+${x.xp} XP)`, 'gold', 3500);
        ui.confetti(50);
        addXP(x.xp, 'quest');
      }
    });
  }

  /* ---------- Достижения ---------- */
  const A = [
    { id: 'first', ico: '🌱', name: 'Первый шаг', desc: 'Изучить первый иероглиф', ok: c => c.started >= 1 },
    { id: 'l10', ico: '📘', name: 'Десяточка', desc: 'Начать изучать 10 иероглифов', ok: c => c.started >= 10 },
    { id: 'l50', ico: '📚', name: 'Полсотни', desc: 'Начать изучать 50 иероглифов', ok: c => c.started >= 50 },
    { id: 'l100', ico: '🏯', name: 'Сотня', desc: 'Начать изучать 100 иероглифов', ok: c => c.started >= 100 },
    { id: 'm10', ico: '🧠', name: 'Прочно в памяти', desc: '10 иероглифов с интервалом от 21 дня', ok: c => c.mastered >= 10 },
    { id: 'm50', ico: '🧙', name: 'Память-кремень', desc: '50 иероглифов с интервалом от 21 дня', ok: c => c.mastered >= 50 },
    { id: 'r100', ico: '🔁', name: 'Повторенье — мать учения', desc: '100 повторений', ok: c => c.reviews >= 100 },
    { id: 'r500', ico: '⚙️', name: 'Неутомимый', desc: '500 повторений', ok: c => c.reviews >= 500 },
    { id: 's3', ico: '🔥', name: 'Три дня подряд', desc: 'Серия 3 дня', ok: c => c.bestStreak >= 3 },
    { id: 's7', ico: '🔥', name: 'Неделя огня', desc: 'Серия 7 дней', ok: c => c.bestStreak >= 7 },
    { id: 's30', ico: '🌋', name: 'Месяц дисциплины', desc: 'Серия 30 дней', ok: c => c.bestStreak >= 30 },
    { id: 'g1', ico: '🎮', name: 'Игрок', desc: 'Сыграть в первую мини-игру', ok: c => c.games >= 1 },
    { id: 'g20', ico: '🕹️', name: 'Геймер', desc: 'Сыграть 20 мини-игр', ok: c => c.games >= 20 },
    { id: 'perfect', ico: '💯', name: 'Без единой ошибки', desc: 'Пройти викторину без ошибок', ok: c => !!c.flags.perfect },
    { id: 'speed', ico: '⚡', name: 'Молния', desc: 'Набрать 25 очков в игре на скорость', ok: c => (store.s.best.speed || 0) >= 25 },
    { id: 'note', ico: '✍️', name: 'Автор мнемоник', desc: 'Придумать свою ассоциацию', ok: c => c.notes >= 1 },
    { id: 'col', ico: '🗂️', name: 'Коллекционер', desc: 'Создать свою подборку', ok: c => store.s.collections.length >= 1 },
    { id: 'lv5', ico: '⭐', name: 'Уровень 5', desc: 'Достичь 5 уровня', ok: c => c.level >= 5 },
    { id: 'lv10', ico: '🌟', name: 'Уровень 10', desc: 'Достичь 10 уровня', ok: c => c.level >= 10 },
    { id: 'evo5', ico: '🧬', name: 'Эволюционист', desc: 'Открыть 5-й вид в «Эволюции»', ok: c => !!c.flags.evo5 },
    { id: 'evo100', ico: '🐸', name: 'Из грязи в князи', desc: '100 верных ответов в «Эволюции»', ok: c => c.evoRight >= 100 },
    { id: 'evoMax', ico: '👑', name: 'Владыка вселенной', desc: 'Вырастить «Вселенную» — 20-й вид в «Эволюции»', ok: c => !!c.flags.evoMax },
    { id: 'hsk1', ico: '🏅', name: 'HSK 1 покорён', desc: 'Начать изучать все иероглифы HSK 1 из набора', ok: c => c.hsk1 }
  ];
  function ctx() {
    const cs = {}; Object.keys(store.s.cards).forEach(k => { if (!HZ.isKey(k)) cs[k] = store.s.cards[k]; }); const all = Object.values(cs);
    const hsk1 = HZ.chars.filter(x => x.h === 1);
    let reviews = 0; Object.values(store.s.log).forEach(l => { reviews += l.rev; });
    let games = 0; Object.values(store.s.log).forEach(l => { games += l.games; });
    return {
      started: all.length, mastered: all.filter(HZ.srs.isMastered).length, reviews, games,
      bestStreak: store.s.streak.best, level: levelOf(store.s.xp),
      notes: Object.values(store.s.notes).filter(n => n.assoc && n.assoc.trim()).length,
      flags: store.s.flags || {}, evoRight: (store.s.evo && store.s.evo.right) || 0,
      hsk1: hsk1.length > 0 && hsk1.every(x => cs[x.ch])
    };
  }
  let checking = false;
  function check() {
    if (checking) return; checking = true;
    try {
      const c = ctx();
      A.forEach(a => {
        if (!store.s.ach[a.id] && a.ok(c)) {
          store.s.ach[a.id] = Date.now(); store.save();
          ui.toast(`${a.ico} Достижение: «${a.name}»`, 'gold', 4000);
          ui.sfx('level'); ui.confetti(70);
          store.s.xp += 25; store.today().xp += 25; store.save();
        }
      });
    } finally { checking = false; }
    refreshHeader();
  }
  function flag(name) { (store.s.flags = store.s.flags || {})[name] = true; store.save(); check(); }

  /* ---------- Верхняя панель ---------- */
  function refreshHeader() {
    const li = levelInfo(), box = document.getElementById('hud');
    if (!box) return;
    ui.clear(box);
    box.append(
      ui.h('a.hud-chip', { href: '#/stats', title: `Опыт: ${store.s.xp} XP` },
        ui.h('span.lvl', 'Ур. ' + li.lvl),
        ui.h('span.bar', ui.h('i', { style: { width: Math.round(li.pct * 100) + '%' } }))),
      ui.h('a.hud-chip.streak' + (activeToday() ? '.on' : ''), { href: '#/', title: 'Серия занятий' }, '🔥 ', String(streakNow())));
  }

  HZ.gami = { levelInfo, addXP, touch, streakNow, activeToday, onReview, onGame, questsToday, checkQuests, check, flag, ACHIEVEMENTS: A, refreshHeader, ctx };
})();
