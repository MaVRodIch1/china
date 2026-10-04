/* «Долина знаков»: большая карта с камерой, 5 локаций с боссами, враги-кляксы, арсенал (47 видов оружия и щитов),
 * слоты экипировки, стихии (огонь, лёд, яд, кровотечение, пустота), модули, прокачка и анимированный герой.
 * Учёба: задание «найди знак» показывается прямо на экране — с самим иероглифом (режим «Знак») или только значением/чтением
 * (режим «Испытание», награда ×2). Верный знак даёт монеты, опыт, лечение и печать портала босса; в бою с боссом — «удар знания».
 * Ошибка порождает кляксы, которые несут на себе перепутанный знак. */
(function () {
  'use strict';
  const HZ = window.HZ, ui = HZ.ui, h = ui.h, store = HZ.store, srs = HZ.srs, G = HZ.games;
  const { makeRound, makeQueue, accOf, pool0, spriteOf, controls, setupCanvas, rr, firstGloss, keyOf, fmt, img } = HZ.play;

  /* ====== Мир ====== */
  const WW = 2400, WH = 1600;
  const CAMP = { x: WW / 2, y: WH / 2, r: 150 };
  const SEALS = 8; // столько верных знаков в локации открывают портал босса
  const LOCS = [
    { name: 'Бамбуковая роща', ico: '🎋', req: 1, g: ['#9fd37f', '#94cb74', '#a6d887'], deco: ['🎋', '🌳', '🌿', '🍄', '🌸', '🪨', '🌼'], blob: '#2c2838', mul: 1, dmg: 1, coin: 1, xp: 1, portal: { x: 2120, y: 280 },
      boss: { name: 'Чернильный великан', ch: '墨', hp: 2200, r: 70, color: '#15121f', sp: 65, dmg: 16, bdmg: 8, attacks: ['summon', 'charge', 'ring'], hat: '🎩' } },
    { name: 'Пустыня Гоби', ico: '🏜️', req: 5, g: ['#ead5a0', '#e2cb92', '#efdcac'], deco: ['🌵', '🪨', '🦴', '🏺', '🌾', '🐫'], blob: '#8a5226', mul: 2, dmg: 1.5, coin: 1.8, xp: 1.5, portal: { x: 280, y: 1320 },
      boss: { name: 'Песчаный змей', ch: '沙', hp: 6000, r: 66, color: '#a8702f', sp: 90, dmg: 22, bdmg: 11, attacks: ['charge', 'spray', 'ring', 'summon'], hat: '🦂' } },
    { name: 'Снежные горы', ico: '🏔️', req: 10, g: ['#e6eff6', '#dce8f1', '#eef4f9'], deco: ['🌲', '❄️', '⛄', '🪨', '🏔️', '🌨️'], blob: '#2f63a8', mul: 3.5, dmg: 2.1, coin: 3, xp: 2.2, portal: { x: 2120, y: 1320 },
      boss: { name: 'Ледяной дух', ch: '冰', hp: 14000, r: 64, color: '#5e9fd8', sp: 80, dmg: 28, bdmg: 14, attacks: ['spiral', 'ring', 'summon', 'spray'], hat: '❄️' } },
    { name: 'Огненная долина', ico: '🌋', req: 15, g: ['#6e4a3e', '#664338', '#76503f'], deco: ['🌋', '🔥', '🪨', '💀', '🌑', '♨️'], blob: '#d23f22', mul: 6, dmg: 2.9, coin: 5, xp: 3.2, portal: { x: 280, y: 280 },
      boss: { name: 'Огненный дракон', ch: '火', hp: 30000, r: 78, color: '#d9441f', sp: 85, dmg: 36, bdmg: 18, attacks: ['spray', 'rain', 'charge', 'ring'], hat: '🐲' } },
    { name: 'Небесный храм', ico: '⛩️', req: 20, g: ['#f2dbe7', '#ebd1df', '#f6e3ec'], deco: ['⛩️', '🏮', '🌸', '☁️', '🎐', '🐉'], blob: '#7b3db3', mul: 10, dmg: 4, coin: 8, xp: 4.5, portal: { x: 1200, y: 200 },
      boss: { name: 'Тёмный мудрец', ch: '暗', hp: 60000, r: 68, color: '#4b2385', sp: 75, dmg: 45, bdmg: 22, attacks: ['teleport', 'spiral', 'summon', 'rain', 'ring'], hat: '🔮' } }
  ];
  const ETYPES = {
    small: { r: 15, hp: 16, sp: 110, dmg: 5, xp: 3, coin: 2 },
    mid: { r: 23, hp: 40, sp: 76, dmg: 8, xp: 7, coin: 5 },
    big: { r: 34, hp: 100, sp: 50, dmg: 13, xp: 18, coin: 14, split: true },
    king: { r: 48, hp: 520, sp: 44, dmg: 20, xp: 90, coin: 80 }
  };
  const TONE_COL = ['#d93c4a', '#d98a0b', '#1f9d63', '#2e6fe0', '#8a8a8a'];

  /* ====== Прокачка ====== */
  const UPS = {
    hp: { tab: 'hero', ico: '❤️', name: 'Здоровье', desc: lv => `+20 к здоровью (сейчас +${lv * 20})`, cost: lv => Math.round(50 * Math.pow(1.6, lv)), max: 25 },
    armor: { tab: 'hero', ico: '🛡️', name: 'Броня', desc: lv => `−5% урона от клякс и боссов (сейчас −${Math.min(60, lv * 5)}%)`, cost: lv => Math.round(80 * Math.pow(1.75, lv)), max: 12 },
    regen: { tab: 'hero', ico: '💗', name: 'Восстановление', desc: lv => `Здоровье восстанавливается быстрее (${(.5 + .6 * lv).toFixed(1)}/с, в лагере ×8)`, cost: lv => Math.round(70 * Math.pow(1.7, lv)), max: 15 },
    speed: { tab: 'hero', ico: '👟', name: 'Быстрые ноги', desc: lv => `+7% к скорости (сейчас ×${(1 + .07 * lv).toFixed(2)})`, cost: lv => Math.round(40 * Math.pow(1.7, lv)), max: 12 },
    magnet: { tab: 'hero', ico: '🧲', name: 'Магнит', desc: lv => `Монеты притягиваются издалека, знаки подбираются легче (+${lv * 18} px)`, cost: lv => Math.round(60 * Math.pow(1.8, lv)), max: 10 },
    power: { tab: 'mods', ico: '💪', name: 'Сила', desc: lv => `+10% урона всего оружия (сейчас +${lv * 10}%)`, cost: lv => Math.round(100 * Math.pow(1.7, lv)), max: 25 },
    rate: { tab: 'mods', ico: '⏱️', name: 'Скорострельность', desc: lv => `Оружие перезаряжается на 4% быстрее (сейчас −${lv * 4}%)`, cost: lv => Math.round(150 * Math.pow(1.8, lv)), max: 12 },
    range: { tab: 'mods', ico: '🎯', name: 'Дальность', desc: lv => `+8% к дальности оружия (сейчас +${lv * 8}%)`, cost: lv => Math.round(120 * Math.pow(1.75, lv)), max: 8 },
    crit: { tab: 'mods', ico: '💥', name: 'Критический удар', desc: lv => `Шанс двойного урона ${lv * 5}%`, cost: lv => Math.round(200 * Math.pow(1.8, lv)), max: 10 },
    reload: { tab: 'mods', ico: '🔄', name: 'Перезарядка', desc: lv => `Магазины автоматов, ружей и огнемётов меняются быстрее (−${Math.round(100 - 100 / (1 + .12 * lv))}% времени; R — перезарядить вручную)`, cost: lv => Math.round(140 * Math.pow(1.65, lv)), max: 10 },
    elem: { tab: 'mods', ico: '🌈', name: 'Сила стихий', desc: lv => `+20% к урону поджога, яда и кровотечения, дольше замедление (сейчас +${lv * 20}%)`, cost: lv => Math.round(250 * Math.pow(1.8, lv)), max: 10 },
    income: { tab: 'eco', ico: '🌾', name: 'Ферма', desc: lv => `+1,2 🪙/с пассивно (сейчас +${(lv * 1.2).toFixed(1)})`, cost: lv => Math.round(50 * Math.pow(1.6, lv)), max: 30 },
    reward: { tab: 'eco', ico: '💎', name: 'Награда за знак', desc: lv => `+15% монет за верный знак (сейчас +${lv * 15}%)`, cost: lv => Math.round(80 * Math.pow(1.7, lv)), max: 30 },
    wisdom: { tab: 'eco', ico: '🧠', name: 'Мудрость', desc: lv => `В «Испытании» подсказка через ${Math.max(1.5, 9 - 1.2 * lv).toFixed(1)} с${lv >= 5 ? ', нужный знак светится' : ' (с 5 ур. нужный знак светится)'}`, cost: lv => Math.round(120 * Math.pow(2, lv)), max: 6 }
  };

  /* ====== Арсенал ======
   * cls — механика: melee (взмах), gun (пули/стрелы), rocket, cone (огнемёт и т. п.), boomerang, throw (сюрикены, кунаи),
   * grenade (навесом, взрыв, лужа), homing (самонаводящиеся), chain (молния), beam (луч), orbit (вращаются вокруг), aoe (волна).
   * unlock — индекс локации, босса которой нужно победить, чтобы купить. el — стихия. */
  const ELEM = { fire: { name: 'поджог', col: '#ff7a1a' }, ice: { name: 'замедление', col: '#5fc8ff' }, poison: { name: 'яд', col: '#7bd93a' }, bleed: { name: 'кровотечение', col: '#d4202c' }, void: { name: 'пустота: +50% по боссам', col: '#a35cff' } };
  const CATS = { melee: '⚔️ Ближний бой', ranged: '🏹 Стрелковое', thrown: '🌀 Метательное', grenade: '💣 Гранаты', magic: '🔮 Магия', special: '✨ Особое' };
  const AR = {}, AR_ORDER = [];
  const W = (id, o) => { AR[id] = Object.assign({ id, max: 10 }, o); AR_ORDER.push(id); };
  const L1 = l => l - 1;
  // ближний бой
  W('brush', { name: 'Кисть мастера', ico: '🖌️', cat: 'melee', cls: 'melee', price: 60, st: l => ({ dmg: 12 + 6 * L1(l), cd: Math.max(.35, .8 - .045 * L1(l)), range: 90 + 5 * L1(l), arc: 1.1 }) });
  W('knuckles', { name: 'Шипастый кастет', img: 'knuckles', cat: 'melee', cls: 'melee', price: 120, st: l => ({ dmg: 9 + 4 * L1(l), cd: Math.max(.16, .34 - .018 * L1(l)), range: 74, arc: .9 }) });
  W('sword', { name: 'Стальной меч', img: 'sword', cat: 'melee', cls: 'melee', price: 150, st: l => ({ dmg: 18 + 8 * L1(l), cd: Math.max(.38, .75 - .04 * L1(l)), range: 100 + 3 * l, arc: 1.2 }) });
  W('club', { name: 'Шипастая дубина', img: 'club', cat: 'melee', cls: 'melee', price: 220, st: l => ({ dmg: 26 + 11 * L1(l), cd: Math.max(.55, 1 - .05 * L1(l)), range: 96, arc: 1.3, kb: 420 }) });
  W('cleaver', { name: 'Кровавый тесак', img: 'cleaver', cat: 'melee', cls: 'melee', price: 260, el: 'bleed', st: l => ({ dmg: 22 + 9 * L1(l), cd: Math.max(.4, .72 - .035 * L1(l)), range: 100, arc: 1.0 }) });
  W('claw', { name: 'Когти зверя', img: 'claw', cat: 'melee', cls: 'melee', price: 300, st: l => ({ dmg: 11 + 5 * L1(l), cd: Math.max(.14, .3 - .016 * L1(l)), range: 82, arc: 1.0 }) });
  W('sickle', { name: 'Костяной серп', img: 'sickle', cat: 'melee', cls: 'melee', price: 350, el: 'bleed', st: l => ({ dmg: 20 + 9 * L1(l), cd: Math.max(.35, .62 - .03 * L1(l)), range: 112, arc: 1.6 }) });
  W('icesword', { name: 'Ледяной клинок', img: 'icesword', cat: 'melee', cls: 'melee', unlock: 0, price: 600, el: 'ice', st: l => ({ dmg: 28 + 11 * L1(l), cd: Math.max(.35, .65 - .03 * L1(l)), range: 110, arc: 1.2 }) });
  W('venomblade', { name: 'Ядовитый клинок', img: 'venomblade', cat: 'melee', cls: 'melee', unlock: 1, price: 1100, el: 'poison', st: l => ({ dmg: 30 + 12 * L1(l), cd: Math.max(.3, .5 - .02 * L1(l)), range: 105, arc: 1.1 }) });
  W('lavasword', { name: 'Лавовый меч', img: 'lavasword', cat: 'melee', cls: 'melee', unlock: 1, price: 1200, el: 'fire', st: l => ({ dmg: 40 + 16 * L1(l), cd: Math.max(.35, .66 - .03 * L1(l)), range: 115, arc: 1.2 }) });
  W('venomclaw', { name: 'Ядовитые когти', img: 'venomclaw', cat: 'melee', cls: 'melee', unlock: 2, price: 1800, el: 'poison', st: l => ({ dmg: 22 + 9 * L1(l), cd: Math.max(.12, .26 - .014 * L1(l)), range: 86, arc: 1.0 }) });
  W('skullaxe', { name: 'Секира черепа', img: 'skullaxe', cat: 'melee', cls: 'melee', unlock: 2, price: 2600, st: l => ({ dmg: 70 + 28 * L1(l), cd: Math.max(.6, 1.1 - .05 * L1(l)), range: 120, arc: 1.4, crit: .2 }) });
  W('hammer', { name: 'Боевой молот', img: 'hammer', cat: 'melee', cls: 'melee', unlock: 3, price: 4000, st: l => ({ dmg: 110 + 40 * L1(l), cd: Math.max(.8, 1.4 - .06 * L1(l)), range: 125, arc: 1.5, stun: .6, kb: 520 }) });
  W('scythe', { name: 'Коса пустоты', img: 'scythe', cat: 'melee', cls: 'melee', unlock: 4, price: 9000, el: 'void', st: l => ({ dmg: 120 + 45 * L1(l), cd: Math.max(.55, 1 - .045 * L1(l)), range: 150, arc: 3.15 }) });
  // стрелковое
  W('smg', { name: 'Автомат', img: 'smg', cat: 'ranged', cls: 'gun', price: 120, max: 12, st: l => ({ dmg: 5 + 2.5 * L1(l), cd: Math.max(.06, .15 - .008 * L1(l)), range: 380, speed: 820, spread: .07, col: '#ffe066' }) });
  W('blaster', { name: 'Бластер', img: 'blaster', cat: 'ranged', cls: 'gun', price: 250, st: l => ({ dmg: 14 + 6 * L1(l), cd: Math.max(.22, .45 - .02 * L1(l)), range: 420, speed: 700, pierce: 1, col: '#4fd6ff', w: 4 }) });
  W('crossbow', { name: 'Арбалет', img: 'crossbow', cat: 'ranged', cls: 'gun', price: 300, st: l => ({ dmg: 26 + 10 * L1(l), cd: Math.max(.5, .9 - .04 * L1(l)), range: 480, speed: 760, pierce: 2, arrow: true, col: '#8a5a2b' }) });
  W('naturebow', { name: 'Лиановый лук', img: 'naturebow', cat: 'ranged', cls: 'gun', price: 350, el: 'poison', st: l => ({ dmg: 20 + 8 * L1(l), cd: Math.max(.4, .7 - .03 * L1(l)), range: 460, speed: 680, pierce: 1, arrow: true, col: '#4caf50' }) });
  W('shotgun', { name: 'Дробовик', img: 'shotgun', cat: 'ranged', cls: 'gun', unlock: 0, price: 400, st: l => ({ dmg: 9 + 4 * L1(l), cd: Math.max(.5, 1.1 - .06 * L1(l)), range: 260, speed: 680, count: 5 + Math.floor(l / 3), spread: .13, col: '#ffb347', flash: true }) });
  W('gatling', { name: 'Гатлинг', img: 'gatling', cat: 'ranged', cls: 'gun', unlock: 1, price: 1600, st: l => ({ dmg: 7 + 3 * L1(l), cd: Math.max(.035, .07 - .003 * L1(l)), range: 400, speed: 900, spread: .12, col: '#ffd34d' }) });
  W('icecrossbow', { name: 'Ледяной арбалет', img: 'icecrossbow', cat: 'ranged', cls: 'gun', unlock: 1, price: 1400, el: 'ice', st: l => ({ dmg: 34 + 13 * L1(l), cd: Math.max(.5, .9 - .04 * L1(l)), range: 500, speed: 780, pierce: 2, arrow: true, col: '#5fc8ff' }) });
  W('icebow', { name: 'Ледяной лук', img: 'icebow', cat: 'ranged', cls: 'gun', unlock: 2, price: 1900, el: 'ice', st: l => ({ dmg: 30 + 12 * L1(l), cd: Math.max(.35, .6 - .025 * L1(l)), range: 480, speed: 720, count: 2, spread: .1, arrow: true, col: '#5fc8ff' }) });
  W('skullbow', { name: 'Лук черепа', img: 'skullbow', cat: 'ranged', cls: 'gun', unlock: 2, price: 2200, st: l => ({ dmg: 44 + 16 * L1(l), cd: Math.max(.45, .8 - .035 * L1(l)), range: 520, speed: 760, pierce: 1, crit: .25, arrow: true, col: '#d4202c' }) });
  W('sniper', { name: 'Снайперская винтовка', img: 'sniper', cat: 'ranged', cls: 'gun', unlock: 3, price: 3500, st: l => ({ dmg: 180 + 60 * L1(l), cd: Math.max(.9, 1.6 - .07 * L1(l)), range: 760, speed: 1500, pierce: 5, col: '#9ff', w: 3, trail: true }) });
  W('plasmarifle', { name: 'Плазменная винтовка', img: 'plasmarifle', cat: 'ranged', cls: 'gun', unlock: 3, price: 4200, el: 'void', st: l => ({ dmg: 45 + 18 * L1(l), cd: Math.max(.18, .35 - .015 * L1(l)), range: 520, speed: 900, pierce: 2, col: '#c77dff', w: 5 }) });
  W('rocket', { name: 'Ракетница «Акула»', img: 'bazooka', cat: 'ranged', cls: 'rocket', unlock: 1, price: 900, st: l => ({ dmg: 40 + 18 * L1(l), cd: Math.max(.9, 2.2 - .13 * L1(l)), range: 520, blast: 80 + 6 * l }) });
  W('plasmacannon', { name: 'Плазменная пушка', img: 'plasmacannon', cat: 'ranged', cls: 'rocket', unlock: 4, price: 9000, el: 'void', st: l => ({ dmg: 160 + 60 * L1(l), cd: Math.max(.9, 1.7 - .07 * L1(l)), range: 560, blast: 120 + 5 * l, plasma: true }) });
  W('acidgun', { name: 'Кислотная пушка', img: 'acidgun', cat: 'ranged', cls: 'cone', unlock: 1, price: 1300, el: 'poison', st: l => ({ dmg: 4 + 2 * L1(l), range: 165, ang: .42 }) });
  W('flamethrower', { name: 'Огнемёт', img: 'flamethrower', cat: 'ranged', cls: 'cone', unlock: 2, price: 2400, el: 'fire', st: l => ({ dmg: 6 + 2.5 * L1(l), range: 175, ang: .45 }) });
  W('freezeray', { name: 'Замораживатель', img: 'freezeray', cat: 'ranged', cls: 'cone', unlock: 2, price: 2400, el: 'ice', st: l => ({ dmg: 4 + 2 * L1(l), range: 195, ang: .32 }) });
  // метательное
  W('boomerang', { name: 'Бумеранг', img: 'boomerang', cat: 'thrown', cls: 'boomerang', price: 400, st: l => ({ dmg: 18 + 8 * L1(l), cd: Math.max(.6, 1.2 - .05 * L1(l)), range: 300 + 10 * l }) });
  W('shuriken', { name: 'Сюрикен', img: 'shuriken', cat: 'thrown', cls: 'throw', price: 450, st: l => ({ dmg: 14 + 6 * L1(l), cd: Math.max(.3, .55 - .022 * L1(l)), range: 420, speed: 620, pierce: 3, count: 1 + Math.floor(L1(l) / 4), spread: .25 }) });
  W('kunai', { name: 'Кунаи', img: 'kunai', cat: 'thrown', cls: 'throw', unlock: 0, price: 700, el: 'bleed', st: l => ({ dmg: 15 + 6 * L1(l), cd: Math.max(.4, .7 - .028 * L1(l)), range: 380, speed: 760, count: 3, spread: .2 }) });
  // гранаты
  W('firebomb', { name: 'Огненная бомба', img: 'firebomb', cat: 'grenade', cls: 'grenade', price: 500, el: 'fire', st: l => ({ dmg: 30 + 12 * L1(l), cd: Math.max(1.2, 2.2 - .09 * L1(l)), range: 380, blast: 80 + 4 * l }) });
  W('acidgrenade', { name: 'Кислотная граната', img: 'acidgrenade', cat: 'grenade', cls: 'grenade', unlock: 0, price: 800, el: 'poison', st: l => ({ dmg: 15 + 6 * L1(l), cd: Math.max(1.3, 2.4 - .1 * L1(l)), range: 380, blast: 90 + 4 * l, pool: 3 }) });
  W('icegrenade', { name: 'Ледяная граната', img: 'icegrenade', cat: 'grenade', cls: 'grenade', unlock: 1, price: 1300, el: 'ice', st: l => ({ dmg: 25 + 10 * L1(l), cd: Math.max(1.3, 2.4 - .1 * L1(l)), range: 400, blast: 100 + 5 * l }) });
  W('mechgrenade', { name: 'Кассетная граната', img: 'mechgrenade', cat: 'grenade', cls: 'grenade', unlock: 2, price: 2000, st: l => ({ dmg: 30 + 12 * L1(l), cd: Math.max(1.4, 2.6 - .1 * L1(l)), range: 400, blast: 70 + 3 * l, cluster: 4 }) });
  W('lavagrenade', { name: 'Лавовая граната', img: 'lavagrenade', cat: 'grenade', cls: 'grenade', unlock: 3, price: 3200, el: 'fire', st: l => ({ dmg: 45 + 18 * L1(l), cd: Math.max(1.3, 2.4 - .1 * L1(l)), range: 420, blast: 100 + 5 * l, pool: 3.5 }) });
  W('skullbomb', { name: 'Бомба-череп', img: 'skullbomb', cat: 'grenade', cls: 'grenade', unlock: 3, price: 4500, st: l => ({ dmg: 120 + 45 * L1(l), cd: Math.max(1.8, 3.2 - .12 * L1(l)), range: 420, blast: 140 + 6 * l }) });
  // магия
  W('glyph', { name: 'Летящие знаки', ico: '🀄', cat: 'magic', cls: 'homing', price: 150, st: l => ({ dmg: 9 + 5 * L1(l), cd: Math.max(.4, 1.2 - .08 * L1(l)), range: 430, count: 1 + Math.floor(L1(l) / 3), glyph: true }) });
  W('naturestaff', { name: 'Посох природы', img: 'naturestaff', cat: 'magic', cls: 'homing', unlock: 1, price: 1500, el: 'poison', st: l => ({ dmg: 16 + 7 * L1(l), cd: Math.max(.4, .75 - .03 * L1(l)), range: 440, count: 1 + Math.floor(L1(l) / 4), heal: 1 + .5 * l, col: '#7bd93a' }) });
  W('voidstaff', { name: 'Посох пустоты', img: 'voidstaff', cat: 'magic', cls: 'homing', unlock: 2, price: 2500, el: 'void', st: l => ({ dmg: 28 + 11 * L1(l), cd: Math.max(.45, .8 - .03 * L1(l)), range: 460, count: 2 + Math.floor(L1(l) / 4), col: '#a35cff' }) });
  W('lightning', { name: 'Молния', ico: '⚡', cat: 'magic', cls: 'chain', unlock: 2, price: 2000, st: l => ({ dmg: 30 + 14 * L1(l), cd: Math.max(.6, 1.6 - .1 * L1(l)), range: 400, chains: 2 + Math.floor(l / 2) }) });
  W('beam', { name: 'Луч дракона', ico: '☄️', cat: 'magic', cls: 'beam', unlock: 3, price: 4500, max: 8, st: l => ({ dps: 60 + 30 * L1(l), cd: Math.max(2, 3.6 - .2 * L1(l)), dur: 1.2 + .1 * l, range: 520 }) });
  // особое
  W('orbit', { name: 'Фонари-хранители', ico: '🏮', cat: 'special', cls: 'orbit', price: 300, max: 8, st: l => ({ dmg: 8 + 4 * L1(l), n: 1 + Math.floor(l / 2), radius: 72 + 5 * l, spin: 2.6, sprite: '🏮', hitR: 14 }) });
  W('sawblade', { name: 'Пила', img: 'sawblade', cat: 'special', cls: 'orbit', unlock: 0, price: 900, el: 'bleed', st: l => ({ dmg: 14 + 6 * L1(l), n: 1 + Math.floor(L1(l) / 3), radius: 96, spin: 3.6, hitR: 20 }) });
  W('flail', { name: 'Кистень', img: 'flail', cat: 'special', cls: 'orbit', unlock: 1, price: 1200, st: l => ({ dmg: 40 + 16 * L1(l), n: 1, radius: 128, spin: 3.2, hitR: 24, kb: 420 }) });
  W('gong', { name: 'Гонг', ico: '🔔', cat: 'special', cls: 'aoe', price: 500, max: 8, st: l => ({ dmg: 25 + 12 * L1(l), cd: Math.max(2.2, 6 - .45 * L1(l)), radius: 150 + 12 * l }) });
  const arCost = (d, lv) => Math.round(d.price * Math.pow(1.75, lv));
  function infoOf(d, s) {
    const p = [];
    if (s.dmg) p.push(`урон ${Math.round(s.dmg)}${d.cls === 'cone' ? '/0,1 с' : ''}`);
    if (s.dps) p.push(`${s.dps} урона/с`);
    if (s.count > 1) p.push(`×${s.count}`);
    if (s.cd) p.push(s.cd < .2 ? `${Math.round(1 / s.cd)} выстр./с` : `раз в ${s.cd.toFixed(2)} с`);
    if (s.pierce) p.push(`пробивает ${s.pierce}`);
    if (s.blast) p.push(`взрыв ${s.blast}`);
    if (s.n) p.push(`${s.n} шт.`);
    if (s.chains) p.push(`прыжков ${s.chains}`);
    if (s.crit) p.push(`+${Math.round(s.crit * 100)}% крит`);
    if (s.stun) p.push('оглушает');
    if (s.heal) p.push(`лечит ${s.heal}`);
    if (s.pool) p.push('лужа');
    if (s.cluster) p.push(`${s.cluster} осколка`);
    if (d.el) p.push(ELEM[d.el].name);
    return p.join(' · ');
  }
  const SHIELDS = {
    woodshield: { name: 'Деревянный щит', price: 200, armor: .08, desc: 'Надёжная простая защита' },
    lionshield: { name: 'Львиный щит', unlock: 0, price: 900, armor: .1, hpMul: .25, desc: '+25% к здоровью' },
    skullshield: { name: 'Щит черепа', unlock: 1, price: 1500, armor: .12, thorns: true, desc: 'Шипы: кляксы ранят себя о щит' },
    runeshield: { name: 'Рунный щит', unlock: 2, price: 2600, armor: .14, block: .3, desc: '30% шанс отразить снаряд босса' },
    demonshield: { name: 'Демонический щит', unlock: 3, price: 5000, armor: .16, steal: .02, desc: 'Вампиризм: 2% нанесённого урона лечат героя' }
  };
  const SH_MAX = 5;
  const shCost = (d, lv) => Math.round(d.price * Math.pow(1.9, lv));
  const SLOT_COST = [0, 0, 0, 500, 2500, 10000]; // прежние слоты — только для возврата монет
  const SOLO = 2.2; // одно оружие бьёт сильнее, чем раньше несколько
  const PET_MAX = 6;
  const petCost = n => Math.round(200 * Math.pow(2.5, n));

  function WS() {
    let v = store.s.walk;
    if (!v || typeof v !== 'object') v = store.s.walk = {};
    const d = { coins: 0, ups: {}, wp: {}, pets: [], skin: 'ninja', right: 0, wrong: 0, bestCombo: 0, sound: true, last: Date.now(), upd: 0, hp: null, loc: 0, maxLoc: 0, kills: 0, deaths: 0, mode: 'show', seals: {}, bossKills: [0, 0, 0, 0, 0], shl: {}, shield: null };
    if (v.xp === undefined) v.xp = (v.right || 0) * 10; // перенос прогресса из первой версии
    Object.keys(d).forEach(k => { if (v[k] === undefined) v[k] = d[k]; });
    const z = {}; Object.keys(UPS).forEach(k => { z[k] = 0; });
    v.ups = Object.assign(z, v.ups);
    const w = {}; AR_ORDER.forEach(k => { w[k] = k === 'brush' ? 1 : 0; });
    v.wp = Object.assign(w, v.wp);
    while (v.bossKills.length < LOCS.length) v.bossKills.push(0);
    if (!Array.isArray(v.eq)) { // переход на слоты: берём уже купленное (самое дорогое — первым)
      const owned = AR_ORDER.filter(k => v.wp[k] > 0).sort((a, b) => arCost(AR[b], v.wp[b]) - arCost(AR[a], v.wp[a]));
      v.slots = Math.max(3, Math.min(6, owned.length));
      v.eq = owned.slice(0, v.slots);
    }
    if (v.solo !== 1) { // одно оружие в руках: купленные слоты возвращаются монетами
      let back = 0; for (let k = 3; k < Math.min(6, v.slots || 3); k++) back += SLOT_COST[k];
      v.coins += back; v.solo = 1; v.slotRefund = back;
    }
    v.slots = 1;
    v.eq = v.eq.filter(k => AR[k] && v.wp[k] > 0).slice(0, 1);
    if (!v.eq.length) { const own = AR_ORDER.filter(k => v.wp[k] > 0).sort((a, b) => arCost(AR[b], v.wp[b]) - arCost(AR[a], v.wp[a])); if (own.length) v.eq = [own[0]]; }
    if (v.shield && !(v.shl[v.shield] > 0)) v.shield = null;
    if (v.heroV !== 2) { v.heroV = 2; v.skin = 'ninja'; } // новый герой — странник в соломенной шляпе
    if (v.skin !== 'ninja' && !HZ.evo.LINES[v.skin]) v.skin = 'ninja';
    if (!LOCS[v.loc]) v.loc = 0;
    return v;
  }
  const heroLvl = v => 1 + Math.floor(Math.sqrt(v.xp / 40));
  const xpAt = l => 40 * (l - 1) * (l - 1);
  const shieldOf = v => (v.shield && v.shl[v.shield] > 0 ? Object.assign({ id: v.shield, lv: v.shl[v.shield] }, SHIELDS[v.shield]) : null);
  const maxHp = v => { const s = shieldOf(v); return Math.round((100 + 20 * v.ups.hp + 10 * (heroLvl(v) - 1)) * (1 + (s && s.hpMul ? s.hpMul + .05 * (s.lv - 1) : 0))); };
  const armorMul = v => { const s = shieldOf(v); return 1 - Math.min(.75, .05 * v.ups.armor + (s ? s.armor + .02 * (s.lv - 1) : 0)); };
  const regenOf = v => .5 + .6 * v.ups.regen;
  const speedOf = v => 200 * (1 + .07 * v.ups.speed);
  const magnetR = v => 70 + 18 * v.ups.magnet;
  const incomeOf = v => (0.2 + 1.2 * v.ups.income + 2.5 * v.pets.length) * (1 + .1 * (heroLvl(v) - 1));
  const locOpen = (v, i) => i === 0 || i <= v.maxLoc || heroLvl(v) >= LOCS[i].req || v.bossKills[i - 1] > 0;
  const arOpen = (v, d) => d.unlock === undefined || v.bossKills[d.unlock] > 0;
  const touchW = () => { store.s.walk.upd = Date.now(); store.save(); };
  const SPR = name => img(`img/wpn/${name}.webp`);
  /* Герой-странник (img/hero, вырезан из листа поз): размер, опорная точка у ног (ax, ay), бёдра для шага, глаза */
  const NJ = {"idle":{"w":113,"h":201,"ax":67,"ay":200,"hipL":[42,143],"hipR":[78,143],"eyes":[[62,40,4,2],[79,43,3,2]]},"back":{"w":148,"h":207,"ax":60,"ay":206,"hipL":[33,157],"hipR":[90,157]},"slash":{"w":248,"h":193,"ax":152,"ay":191},"lantern":{"w":193,"h":202,"ax":102,"ay":201},"kick":{"w":196,"h":171,"ax":87,"ay":170},"dual":{"w":286,"h":187,"ax":159,"ay":186},"meditate":{"w":179,"h":152,"ax":91,"ay":152},"spear":{"w":301,"h":181,"ax":160,"ay":181},"dash":{"w":194,"h":176,"ax":138,"ay":175}};
  const NIMG = name => img(`img/hero/ninja-${name}.webp`);
  const NINJA_K = 96 / NJ.idle.h; // рост героя в мире — 96 px
  /* Декор и интерфейс «Долины» (img/scene — вырезано из листа ассетов) */
  const SCN = name => img(`img/scene/${name}.webp`);
  const SCN_OK = im => im && im.complete && im.naturalWidth;
  // оттенок земли для остальных локаций: [r, g, b, сила]
  const SCN_TINT = [null, [236, 204, 142, .86], [238, 245, 252, .82], [122, 80, 66, .82], [244, 208, 228, .72]];
  const TILES = ['tile-grass', 'tile-light', 'tile-grass', 'tile-flowers', 'tile-light', 'tile-grass', 'tile-flowers', 'tile-light', 'tile-rock', 'tile-grass', 'tile-path2', 'tile-light', 'tile-grass', 'tile-flowers'];
  const tileCache = {};
  function sceneCanvas(li, name, w, h) { // спрайт, заранее отмасштабированный и окрашенный под локацию
    const k = li + name + w + 'x' + h;
    if (tileCache[k]) return tileCache[k];
    const im = SCN(name); if (!SCN_OK(im)) return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
    const t = SCN_TINT[li];
    if (t) {
      const d = x.getImageData(0, 0, w, h), a = d.data, q = t[3];
      for (let i = 0; i < a.length; i += 4) { const l = (a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11) / 165; a[i] = a[i] * (1 - q) + t[0] * l * q; a[i + 1] = a[i + 1] * (1 - q) + t[1] * l * q; a[i + 2] = a[i + 2] * (1 - q) + t[2] * l * q; }
      x.putImageData(d, 0, 0);
    }
    return (tileCache[k] = c);
  }
  // декор бамбуковой рощи: [спрайт, ширина в мире, вес, высокий (рисуется по глубине)]
  const GROVE = [['cherry', 150, 3, 1], ['tree', 112, 5, 1], ['bamboo', 104, 4, 1], ['bamboo2', 48, 5, 1], ['mushroom', 40, 4, 1], ['rock-big', 72, 3, 1], ['rock', 70, 3, 1],
    ['rock-small', 38, 6, 0], ['bush1', 60, 2, 1], ['bush2', 40, 2, 1], ['bush3', 54, 2, 1], ['bush4', 50, 2, 1], ['bush5', 38, 2, 1], ['bush6', 58, 2, 1],
    ['tuft1', 32, 4, 0], ['tuft2', 32, 4, 0], ['tuft3', 26, 4, 0], ['flower1', 22, 3, 0], ['flower2', 16, 3, 0], ['flower3', 26, 3, 0], ['flower4', 22, 3, 0], ['flower5', 20, 3, 0], ['flower6', 30, 3, 0], ['flower7', 22, 3, 0],
    ['leaf1', 14, 1, 0], ['leaf2', 20, 1, 0], ['leaf3', 18, 1, 0], ['leaf4', 18, 1, 0], ['leaf5', 22, 1, 0], ['leaf6', 16, 1, 0],
    ['lantern', 50, 1.5, 1], ['fence', 92, 1.5, 1], ['fence2', 62, 1, 1], ['stick', 36, 2, 0], ['paperlantern', 16, 1, 0]];
  const GROVE_W = GROVE.reduce((a, g) => a + g[2], 0);
  // магазины и перезарядка: [патронов, секунд на перезарядку]
  const MAG = { smg: [30, 1.1], gatling: [90, 2.2], blaster: [15, 1], shotgun: [6, 1.5], sniper: [5, 1.8], plasmarifle: [20, 1.4], rocket: [3, 1.8], plasmacannon: [4, 2.1], acidgun: [40, 1.6], flamethrower: [40, 1.6], freezeray: [40, 1.6] };
  const SHELL = { smg: '#e6b54a', gatling: '#e6b54a', sniper: '#e6b54a', shotgun: '#d64545', blaster: null, plasmarifle: null };
  const MELEE_POSE = { knuckles: 'kick', claw: 'dual', venomclaw: 'dual', scythe: 'spear', hammer: 'spear', sickle: 'spear' };

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
  /* Красная вспышка героя при уроне: заранее окрашенная копия спрайта */
  const tintCache = new Map();
  function tinted(im, col) {
    const k = im.src + col;
    if (!tintCache.has(k) && im.complete && im.naturalWidth) {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
      tintCache.set(k, c);
    }
    return tintCache.get(k) || im;
  }
  function decoFor(li) { // детерминированные украшения локации
    let seed = 1234 + li * 977; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const out = [], L = LOCS[li];
    for (let k = 0; k < (li === 0 ? 420 : 340); k++) {
      const x = 30 + rnd() * (WW - 60), y = 30 + rnd() * (WH - 60);
      if (Math.hypot(x - CAMP.x, y - CAMP.y) < CAMP.r + 60 || Math.hypot(x - L.portal.x, y - L.portal.y) < 110) continue;
      if (li === 0) { // спрайты из листа ассетов
        let r = rnd() * GROVE_W, g = GROVE[0];
        for (const it of GROVE) { r -= it[2]; if (r <= 0) { g = it; break; } }
        out.push({ x, y, spr: g[0], w: g[1] * (.85 + rnd() * .3), tall: !!g[3], flip: rnd() < .5 });
      } else if (rnd() < .12) out.push({ x, y, spr: rnd() < .6 ? 'rock-small' : 'rock', w: 40 + rnd() * 30, tall: false, flip: rnd() < .5 });
      else out.push({ x, y, e: L.deco[Math.floor(rnd() * L.deco.length)], s: 22 + Math.floor(rnd() * 3) * 6 });
    }
    return out.sort((a, b) => a.y - b.y);
  }
  const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
  const angDiff = (a, b) => { let d = Math.abs(a - b) % 6.2832; return d > Math.PI ? 6.2832 - d : d; };

  /* ====== Игра ====== */
  function view() {
    const v = WS();
    const root = document.getElementById('view');
    const area = h('div.page.walk');
    ui.clear(root).append(area);
    const narrow = (area.clientWidth || window.innerWidth) < 640;
    const VW = narrow ? 540 : 960, VH = narrow ? 660 : 600;
    const canvas = h('canvas.wk-canvas', { tabindex: 0, style: { aspectRatio: `${VW} / ${VH}` } });
    const ctx = setupCanvas(canvas, VW, VH);

    // оффлайн-доход
    const away = Math.min(4 * 3600, Math.max(0, (Date.now() - (v.last || Date.now())) / 1000));
    if (away > 60) { const g = incomeOf(v) * away * 0.5; v.coins += g; ui.toast(`🌙 Пока вас не было, ферма принесла ${fmt(g)} 🪙`, 'gold', 4500); }
    v.last = Date.now();
    if (v.slotRefund) { ui.toast(`Теперь в руках одно оружие (сильнее в ${SOLO} раза). За прежние слоты возвращено ${fmt(v.slotRefund)} 🪙. Q / E — сменить оружие.`, 'gold', 6500); v.slotRefund = 0; }
    if (v.hp == null || v.hp <= 0) v.hp = maxHp(v);
    store.save();

    const el = { coins: h('b.wk-coins', ''), inc: h('span.muted.small'), lvl: h('span.hud-pill'), loc: h('span.hud-pill.wk-locpill'), combo: h('span.hud-pill'),
      shop: h('button.btn.sm', { type: 'button', onclick: () => shop('arsenal') }, '🛒 Арсенал'),
      mode: h('button.btn.sm', { type: 'button', onclick: () => { v.mode = v.mode === 'hard' ? 'show' : 'hard'; touchW(); hud(); ui.toast(v.mode === 'hard' ? '🧠 Испытание: на экране только значение или чтение — награда ×2' : '🎯 Знак на экране: показан сам иероглиф, стрелка ведёт к нему'); } }),
      snd: h('button.btn.sm', { type: 'button', onclick: () => { v.sound = !v.sound; touchW(); hud(); } }) };
    const src = G.srcSelect(() => newRound());
    area.append(
      h('div.wk-top', h('div', h('div.evo-coin-row', h('span.evo-coin', '🪙'), el.coins), el.inc), h('div.wk-pills', el.lvl, el.loc, el.combo)),
      h('div.wk-bar', el.shop, h('button.btn.sm', { type: 'button', onclick: () => mapDialog() }, '🗺️ Карта'), el.mode, h('button.btn.sm', { type: 'button', onclick: () => heroPicker() }, '🥷 Герой'), el.snd, h('label.wk-src', h('span.muted.small', '📚'), src)),
      canvas,
      h('p.muted.small.center', 'WASD или стрелки (на телефоне — ведите пальцем по полю), пробел или 💨 — рывок сквозь кляксы. Оружие в руках бьёт само; на компьютере герой целится в кляксу у курсора. Q / E — сменить оружие, R — перезарядка. Задание вверху экрана: найдите этот знак — получите монеты, опыт, лечение и печать 🌀. 8 печатей открывают портал босса. В бою с боссом верный знак наносит «удар знания». В лагере 🏕️ кляксы не трогают.'));

    let L = LOCS[v.loc], deco = decoFor(v.loc);
    const P = { x: CAMP.x, y: CAMP.y + 40, face: 1, walk: 0, moving: false, mx: 0, inv: 2, kx: 0, ky: 0, aim: 0, atkT: 0, swingT: 0, recoilT: 0, hurtT: 0, dustT: 0, lvlT: 0, pose: null, poseEnd: 0, dashT: 0, dashCd: 0, dvx: 0, dvy: 0, still: 0, up: false, ghostT: 0 };
    const cam = { x: 0, y: 0 }, trail = [];
    let enemies = [], bubbles = [], drops = [], shots = [], ebul = [], rains = [], pools = [], fx = [], slashes = [], waves = [], bolts = [], cones = [], beam = null, boss = null;
    let quest = null, combo = 0, hintShown = false, roundWrong = false, stop = false, raf = 0, last = performance.now(), reveal = null;
    let spawnT = 0, saveT = 0, hudT = 0, shake = 0, hurtSfxT = 0, lastLvl = heroLvl(v), spinA = 0;
    const wt = {}, petT = [], ammo = {}, rlT = {}, firedT = {};
    const rlTime = id => MAG[id][1] / (1 + .12 * v.ups.reload);
    function startReload(id) {
      if (!MAG[id] || rlT[id] > 0) return;
      rlT[id] = rlTime(id);
      const hw = heldWeapon();
      if (hw && hw.id === id) { // выпавший магазин
        fx.push({ type: 'mag', x: P.x + P.face * 10, y: P.y - 40, vx: -P.face * 60, vy: -120, rot: 0, t: 0, life: .7, col: SHELL[id] === undefined ? '#6b5a8f' : '#555' });
        if (v.sound) ui.sfx('click');
      }
    }
    function useAmmo(id) {
      firedT[id] = performance.now();
      if (!MAG[id]) return;
      ammo[id] = (ammo[id] == null ? MAG[id][0] : ammo[id]) - 1;
      if (ammo[id] <= 0) startReload(id);
      const hw = heldWeapon();
      if (hw && hw.id === id) {
        P.flashT = .07;
        const col = SHELL[id];
        if (col) { const a = P.aim + (Math.cos(P.aim) >= 0 ? -1.6 : 1.6); fx.push({ type: 'shell', x: P.x + Math.cos(P.aim) * 16, y: P.y - 42, vx: Math.cos(a) * 90 + (Math.random() - .5) * 30, vy: -140 - Math.random() * 60, rot: Math.random() * 6, vr: (Math.random() - .5) * 30, gy: P.y + 4, t: 0, life: .9, col }); }
      }
    }
    const onReloadKey = ev => {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName) || document.getElementById('modal').classList.contains('open')) return;
      if (ev.code === 'KeyQ' || ev.code === 'KeyE') { ev.preventDefault(); cycleWeapon(ev.code === 'KeyE' ? 1 : -1); return; }
      if (ev.code !== 'KeyR') return;
      let any = false;
      for (const id of v.eq) if (MAG[id] && !(rlT[id] > 0) && (ammo[id] == null ? MAG[id][0] : ammo[id]) < MAG[id][0]) { startReload(id); any = true; }
      if (any) floatText(P.x, P.y - 110, 'Перезарядка', '#ffc23d');
    };
    window.addEventListener('keydown', onReloadKey);
    const session = { right: 0, wrong: 0 };
    const queue = makeQueue(pool0, e => accOf(e) * 5);
    const ctl = controls(canvas);
    const onDashKey = ev => {
      if (!['Space', 'ShiftLeft', 'ShiftRight'].includes(ev.code) || ev.repeat) return;
      if (/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(document.activeElement && document.activeElement.tagName) || document.getElementById('modal').classList.contains('open')) return;
      ev.preventDefault(); dash();
    };
    window.addEventListener('keydown', onDashKey);
    // касание кнопки рывка и слотов оружия на холсте (раньше, чем «джойстик»)
    const dashBtn = () => ({ x: 52, y: VH - (boss && narrow ? 104 : 60), r: 34 });
    const slotsTop = () => (narrow ? 148 : 68);
    let mmZoom = 1;
    const miniRect = () => { const mw = narrow ? 128 : 160, mh = mw * WH / WW, mx = VW - mw - 14, my = VH - mh - 12; return { mx, my, mw, mh, zin: { x: mx + mw - 24, y: my + mh - 50, w: 22, h: 22 }, zout: { x: mx + mw - 24, y: my + mh - 25, w: 22, h: 22 } }; };
    const inRect = (x, y, b) => x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4;
    area.addEventListener('pointerdown', ev => {
      if (ev.target !== canvas) return;
      const r = canvas.getBoundingClientRect(), x = (ev.clientX - r.left) * VW / r.width, y = (ev.clientY - r.top) * VH / r.height;
      const db = dashBtn(), iy0 = slotsTop(), n = v.eq.length + (shieldOf(v) ? 1 : 0);
      const mm = miniRect();
      if (Math.hypot(x - db.x, y - db.y) < db.r + 8) { ev.stopPropagation(); ev.preventDefault(); dash(); }
      else if (qBtn.r && Math.hypot(x - qBtn.x, y - qBtn.y) < qBtn.r + 10) { ev.stopPropagation(); ev.preventDefault(); if (quest) ui.speak(quest.e.ch); }
      else if (inRect(x, y, mm.zin)) { ev.stopPropagation(); ev.preventDefault(); mmZoom = Math.min(3, mmZoom + 1); }
      else if (inRect(x, y, mm.zout)) { ev.stopPropagation(); ev.preventDefault(); mmZoom = Math.max(1, mmZoom - 1); }
      else if (x >= 6 && x <= 52 && y >= iy0 - 3 && y <= iy0 + n * 38) { ev.stopPropagation(); ev.preventDefault(); shop(y >= iy0 + v.eq.length * 38 ? 'shields' : 'arsenal'); }
    }, true);
    // прицел курсором (компьютер): герой стреляет в кляксу, ближайшую к курсору
    const mouse = { x: 0, y: 0, t: -1e9 };
    canvas.addEventListener('pointermove', ev => {
      if (ev.pointerType !== 'mouse') return;
      const r = canvas.getBoundingClientRect();
      mouse.x = cam.x + (ev.clientX - r.left) * VW / r.width; mouse.y = cam.y + (ev.clientY - r.top) * VH / r.height; mouse.t = performance.now();
    });
    canvas.addEventListener('pointerleave', () => { mouse.t = -1e9; });
    const mouseAim = () => performance.now() - mouse.t < 4000;
    const cleanup = () => { stop = true; cancelAnimationFrame(raf); ctl.destroy(); window.removeEventListener('keydown', onDashKey); window.removeEventListener('keydown', onReloadKey); v.last = Date.now(); store.save(); };
    HZ.router.onLeave(() => { cleanup(); const n = session.right; if (n >= 5) { HZ.gami.addXP(n); HZ.gami.onGame(n, n + session.wrong); } else if (n) HZ.gami.addXP(n); });

    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const inCamp = p => dist(p, CAMP) < CAMP.r;
    const dmgMul = () => (1 + .06 * (heroLvl(v) - 1)) * (1 + .04 * Math.min(combo, 10)) * (1 + .1 * v.ups.power);
    const seals = () => v.seals[v.loc] || 0;

    function hud() {
      const lv = heroLvl(v);
      el.coins.textContent = fmt(v.coins);
      el.inc.textContent = `+${fmt(incomeOf(v))} 🪙/с · кляксы: ${v.kills} · боссы: ${v.bossKills.reduce((a, b) => a + b, 0)}`;
      el.lvl.textContent = `⭐ Ур. ${lv}`;
      el.loc.textContent = `${L.ico} ${L.name}`;
      el.combo.textContent = combo >= 2 ? `🔥 ×${combo} · +${Math.min(combo, 10) * 4}% урона` : 'Серия 0'; el.combo.classList.toggle('hot', combo >= 2);
      el.mode.textContent = v.mode === 'hard' ? '🧠 Испытание ×2' : '🎯 Знак на экране';
      el.snd.textContent = v.sound ? '🔊' : '🔇';
      const aff = Object.keys(UPS).some(k => v.ups[k] < UPS[k].max && v.coins >= UPS[k].cost(v.ups[k])) || AR_ORDER.some(k => arOpen(v, AR[k]) && v.wp[k] < AR[k].max && v.coins >= arCost(AR[k], v.wp[k])) || (v.pets.length < PET_MAX && v.coins >= petCost(v.pets.length));
      el.shop.classList.toggle('afford', aff);
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
          if (dist({ x, y }, CAMP) < CAMP.r + 50 || dist({ x, y }, L.portal) < 100 || bubbles.some(b => Math.hypot(b.x - x, b.y - y) < 150)) continue;
          p = { x, y };
        }
        if (!p) p = { x: Math.min(WW - 90, Math.max(90, P.x + (Math.random() - .5) * 600)), y: Math.min(WH - 90, Math.max(90, P.y + (Math.random() - .5) * 400)) };
        bubbles.push({ x: p.x, y: p.y, e: it, ok: it === e, ph: Math.random() * 6, r: 38, dead: 0, pop: 0 });
      });
      hud();
    }
    function onRight(b) {
      const e = quest.e, li = v.loc, hard = v.mode === 'hard';
      combo++; v.right++; session.right++; v.bestCombo = Math.max(v.bestCombo, combo);
      const gain = Math.round((8 + heroLvl(v) * 2 + Math.min(combo, 15) * 2) * (1 + .15 * v.ups.reward) * LOCS[li].coin * (roundWrong ? .5 : 1) * (hard ? 2 : 1));
      v.coins += gain;
      addXp(Math.round((12 + Math.min(combo, 10) * 2) * (1 + .25 * li) * (hard ? 1.5 : 1)));
      v.hp = Math.min(maxHp(v), v.hp + maxHp(v) * .1);
      srs.record(keyOf(e), true);
      floatText(b.x, b.y - 30, '+' + gain + ' 🪙', '#e0a000'); burst(b.x, b.y, '#ffd34d', 18);
      ui.sfx('ok'); if (v.sound) ui.speak(e.ch);
      P.atkT = .2; P.lvlT = Math.max(P.lvlT, .5);
      if (boss) { // удар знания
        const d = Math.round(boss.max * .08);
        boss.hp -= d; boss.stun = 1.2; boss.hit = .3;
        floatText(boss.x, boss.y - boss.r - 30, `Удар знания! −${fmt(d)}`, '#7a4dc9', 1.8); burst(boss.x, boss.y, '#b48cff', 30); shake = .3;
        if (boss.hp <= 0) kill(boss);
      } else if (seals() < SEALS) {
        v.seals[li] = Math.min(SEALS, seals() + (hard ? 2 : 1));
        if (seals() >= SEALS) { ui.toast(`🌀 Портал босса открыт! «${L.boss.name}» ждёт — портал отмечен на мини-карте`, 'gold', 5000); ui.sfx('level'); }
      }
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
      quest.wrong = true; hintShown = true;
      reveal = { e: b.e, t: performance.now() };
      hud(); touchW();
    }

    /* --- опыт, уровни, локации --- */
    function addXp(n) {
      v.xp += n;
      const lv = heroLvl(v);
      if (lv > lastLvl) {
        lastLvl = lv; v.hp = maxHp(v); P.lvlT = 1.5;
        ui.toast(`⭐ Уровень героя ${lv}! Здоровье и сила выросли`, 'gold', 3000); ui.sfx('level'); ui.confetti(60);
        LOCS.forEach((l, i) => { if (locOpen(v, i) && i > v.maxLoc) { v.maxLoc = i; setTimeout(() => ui.toast(`🗺️ Открыта локация: ${l.ico} ${l.name}! Откройте «Карту»`, 'gold', 5000), 600); } });
        touchW();
      }
    }
    function travel(i) {
      if (!locOpen(v, i)) return;
      v.loc = i; L = LOCS[i]; deco = decoFor(i);
      enemies = []; drops = []; shots = []; ebul = []; rains = []; pools = []; boss = null; beam = null;
      P.x = CAMP.x; P.y = CAMP.y + 40; P.inv = 2; trail.length = 0;
      touchW(); newRound(); hud();
      ui.toast(`${L.ico} ${L.name}`, 'gold', 2500);
    }

    /* --- кляксы --- */
    function spawnEnemy(type, x, y, glyph) {
      const T = ETYPES[type];
      const hp = Math.round(T.hp * L.mul);
      const e = { type, x, y, r: T.r, hp, max: hp, sp: T.sp * (.9 + Math.random() * .2), dmg: T.dmg * L.dmg, xp: T.xp * L.xp, coin: T.coin * L.coin, kx: 0, ky: 0, hit: 0, ph: Math.random() * 6, wa: Math.random() * 6.283, wt: 0, oc: {}, glyph: glyph || null };
      enemies.push(e); return e;
    }
    function spawnTick() {
      const li = v.loc, lv = heroLvl(v);
      let target = Math.min(34, 9 + 3 * li + Math.floor(lv / 2));
      if (boss) target = Math.floor(target / 2);
      if (enemies.length >= target) return;
      const far = Math.max(VW, VH) * .55 + 40;
      for (let t = 0; t < 30; t++) {
        const x = 60 + Math.random() * (WW - 120), y = 60 + Math.random() * (WH - 120);
        if (Math.hypot(x - P.x, y - P.y) < far || Math.hypot(x - CAMP.x, y - CAMP.y) < CAMP.r + 250) continue;
        const r = Math.random();
        const type = !boss && !enemies.some(e => e.type === 'king') && r < .03 ? 'king' : r < .15 + .03 * li ? 'big' : r < .55 ? 'mid' : 'small';
        const pool = pool0();
        spawnEnemy(type, x, y, (Math.random() < .22 || type === 'king') && pool.length ? pool[HZ.rand(pool.length)] : null);
        return;
      }
    }
    /** Урон кляксе. o: {el, crit, stun, quiet} */
    function hurt(e, dmg, kx, ky, o) {
      if (e.dead) return;
      o = o || {};
      const crit = Math.random() < .05 * v.ups.crit + (o.crit || 0);
      dmg = dmg * dmgMul() * SOLO * (crit ? 2 : 1) * (o.el === 'void' ? (e.isBoss ? 1.5 : 1.2) : 1);
      dmg = Math.max(1, Math.round(dmg));
      e.hp -= dmg; e.hit = .12;
      const kb = e.isBoss ? .08 : 1; e.kx += (kx || 0) * kb; e.ky += (ky || 0) * kb;
      if (o.stun && !e.isBoss) e.stun = Math.max(e.stun || 0, o.stun);
      if (o.el) applyEl(e, o.el, dmg);
      const sh = shieldOf(v); if (sh && sh.steal) v.hp = Math.min(maxHp(v), v.hp + dmg * (sh.steal + .005 * (sh.lv - 1)));
      if (!o.quiet) fx.push({ type: 'num', x: e.x + (Math.random() - .5) * 14, y: e.y - e.r, text: crit ? dmg + '!' : String(dmg), crit, t: 0, col: o.el ? ELEM[o.el].col : null });
      if (e.hp <= 0) kill(e);
    }
    function applyEl(e, el, dmg) {
      const k = 1 + .2 * v.ups.elem;
      if (el === 'fire') e.burn = { t: 2.5, dps: Math.max(e.burn ? e.burn.dps : 0, dmg * .35 * k) };
      else if (el === 'poison') e.poison = { t: 3.2, dps: Math.max(e.poison ? e.poison.dps : 0, dmg * .28 * k) };
      else if (el === 'bleed') e.bleed = { t: 2.5, dps: Math.max(e.bleed ? e.bleed.dps : 0, dmg * .3 * k) };
      else if (el === 'ice') e.slow = { t: 1.6 + .15 * v.ups.elem, k: e.isBoss ? .3 : .55 };
    }
    function kill(e) {
      if (e.dead) return;
      e.dead = true;
      if (e.isBoss) return bossDown(e);
      v.kills++;
      addXp(Math.round(e.xp));
      const n = Math.min(6, Math.max(1, Math.round(e.coin / 4)));
      for (let i = 0; i < n; i++) drops.push({ type: 'coin', x: e.x + (Math.random() - .5) * e.r * 2, y: e.y + (Math.random() - .5) * e.r * 2, val: e.coin / n, t: 0 });
      if (Math.random() < (e.type === 'king' ? 1 : .06)) drops.push({ type: 'heart', x: e.x, y: e.y, t: 0 });
      burst(e.x, e.y, L.blob, e.type === 'king' ? 40 : 14);
      if (ETYPES[e.type].split) for (let i = 0; i < 2; i++) spawnEnemy('small', e.x + (i ? 18 : -18), e.y, null);
      if (e.glyph) floatText(e.x, e.y - e.r - 16, `${e.glyph.ch} — ${firstGloss(e.glyph.m)}`, '#7a4dc9', 1.8);
      if (e.type === 'king') { ui.toast('👑 Королевская клякса повержена!', 'gold', 3000); ui.confetti(90); }
    }

    /* --- боссы --- */
    function startBoss() {
      const B = L.boss;
      const lvl = v.bossKills[v.loc]; // повторные победы — босс сильнее
      const hp = Math.round(B.hp * (1 + .5 * lvl));
      boss = { isBoss: true, x: L.portal.x + (L.portal.x > WW / 2 ? -160 : 160), y: L.portal.y + (L.portal.y > WH / 2 ? -120 : 120), r: B.r, hp, max: hp, sp: B.sp, dmg: B.dmg, bdmg: B.bdmg * (1 + .3 * lvl),
        kx: 0, ky: 0, hit: 0, oc: {}, ph: 0, stun: 1.5, atkT: 2, state: 'move', stateT: 0, ang: 0, spT: 0, B };
      enemies.push(boss);
      v.seals[v.loc] = 0;
      shake = .5; ui.sfx('level');
      ui.toast(`⚠️ Босс: ${B.ch} ${B.name}! Верные знаки наносят «удар знания»`, 'warn', 4500);
      touchW();
    }
    function bossDown(b) {
      const li = v.loc, first = v.bossKills[li] === 0;
      v.bossKills[li]++;
      const coins = Math.round(500 * L.coin * (1 + .3 * (v.bossKills[li] - 1)));
      for (let i = 0; i < 18; i++) drops.push({ type: 'coin', x: b.x + (Math.random() - .5) * 160, y: b.y + (Math.random() - .5) * 160, val: coins / 18, t: 0 });
      for (let i = 0; i < 3; i++) drops.push({ type: 'heart', x: b.x + (Math.random() - .5) * 100, y: b.y + (Math.random() - .5) * 100, t: 0 });
      addXp(Math.round(300 * L.xp));
      burst(b.x, b.y, b.B.color, 70); shake = .6;
      ebul = []; rains = []; boss = null;
      ui.confetti(180); ui.sfx('level');
      HZ.gami.addXP(first ? 50 : 15);
      HZ.gami.flag('boss1');
      if (v.bossKills.every(x => x > 0)) HZ.gami.flag('bossAll');
      let msg = `🏆 ${b.B.name} повержен! +${fmt(coins)} 🪙`;
      if (first) {
        const opened = AR_ORDER.filter(k => AR[k].unlock === li).map(k => AR[k].name).concat(Object.keys(SHIELDS).filter(k => SHIELDS[k].unlock === li).map(k => SHIELDS[k].name));
        if (opened.length) msg += ` · В арсенале открыто: ${opened.join(', ')}`;
        if (li + 1 < LOCS.length && li + 1 > v.maxLoc) { v.maxLoc = li + 1; msg += ` · Открыта локация ${LOCS[li + 1].ico} ${LOCS[li + 1].name}`; }
      }
      ui.toast(msg, 'gold', 8000);
      touchW(); hud();
    }
    function efire(b, a, sp, r) { ebul.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: r || 9, dmg: b.bdmg, life: 4, color: b.B.color }); }
    function bossAI(b, dt, slowK) {
      b.hit = Math.max(0, b.hit - dt);
      if (b.stun > 0) { b.stun -= dt; return; }
      const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy) || 1, phase2 = b.hp < b.max / 2, spd = b.sp * (1 - slowK);
      if (b.state === 'tele') { b.stateT -= dt; if (b.stateT <= 0) { b.state = 'charging'; b.stateT = .55; } return; }
      if (b.state === 'charging') { b.x += Math.cos(b.ang) * 640 * (1 - slowK) * dt; b.y += Math.sin(b.ang) * 640 * (1 - slowK) * dt; b.stateT -= dt; if (b.stateT <= 0) b.state = 'move'; return; }
      if (b.state === 'spiral') { b.stateT -= dt; b.spT -= dt; if (b.spT <= 0) { b.spT = phase2 ? .04 : .06; b.ang += .42; efire(b, b.ang, 200); efire(b, b.ang + Math.PI, 200); } if (b.stateT <= 0) b.state = 'move'; return; }
      if (b.state === 'spray') { b.stateT -= dt; b.spT -= dt; if (b.spT <= 0) { b.spT = .16; const a0 = Math.atan2(dy, dx); for (let i = -2; i <= 2; i++) efire(b, a0 + i * .16, 300, 8); } if (b.stateT <= 0) b.state = 'move'; return; }
      if (d > b.r + 40) { b.x += dx / d * spd * (phase2 ? 1.25 : 1) * dt; b.y += dy / d * spd * (phase2 ? 1.25 : 1) * dt; }
      b.atkT -= dt;
      if (b.atkT > 0) return;
      b.atkT = phase2 ? 1.5 : 2.3;
      const atk = b.B.attacks[HZ.rand(b.B.attacks.length)];
      if (atk === 'ring') { const n = phase2 ? 24 : 16, o = Math.random(); for (let i = 0; i < n; i++) efire(b, o + i * 6.283 / n, 230); }
      else if (atk === 'spray') { b.state = 'spray'; b.stateT = .5; b.spT = 0; }
      else if (atk === 'spiral') { b.state = 'spiral'; b.stateT = 1.6; b.spT = 0; }
      else if (atk === 'charge') { b.state = 'tele'; b.stateT = .7; b.ang = Math.atan2(dy, dx); }
      else if (atk === 'summon') { const n = phase2 ? 5 : 3; for (let i = 0; i < n; i++) { const a = i * 6.283 / n; spawnEnemy('small', b.x + Math.cos(a) * (b.r + 30), b.y + Math.sin(a) * (b.r + 30), null); } floatText(b.x, b.y - b.r - 20, 'Призыв клякс!', '#d64545'); }
      else if (atk === 'rain') { const n = phase2 ? 9 : 6; for (let i = 0; i < n; i++) rains.push({ x: P.x + (Math.random() - .5) * 320, y: P.y + (Math.random() - .5) * 260, t: 0, delay: 1.1, r: 55, dmg: b.bdmg * 1.5 }); }
      else if (atk === 'teleport') { const a = Math.random() * 6.283; burst(b.x, b.y, b.B.color, 20); b.x = Math.max(b.r, Math.min(WW - b.r, P.x + Math.cos(a) * 300)); b.y = Math.max(b.r, Math.min(WH - b.r, P.y + Math.sin(a) * 300)); burst(b.x, b.y, b.B.color, 20); b.stun = .4; }
    }
    function hitPlayer(dmg, fromX, fromY, push, src) {
      if (P.inv > 0 || inCamp(P)) return false;
      dmg = Math.round(dmg * armorMul(v));
      v.hp -= dmg; P.inv = .8; P.hurtT = .3; shake = .25;
      const ex = P.x - fromX, ey = P.y - fromY, d = Math.hypot(ex, ey) || 1;
      P.kx = ex / d * (push || 320); P.ky = ey / d * (push || 320);
      fx.push({ type: 'txt', x: P.x, y: P.y - 70, text: '−' + dmg, color: '#d64545', t: 0, life: .8 });
      if (hurtSfxT <= 0) { ui.sfx('bad'); hurtSfxT = .3; }
      const sh = shieldOf(v);
      if (sh && sh.thorns && src && !src.dead) hurt(src, 20 + 10 * sh.lv + dmg, -ex / d * 200, -ey / d * 200);
      return true;
    }

    /* --- эффекты --- */
    function floatText(x, y, text, color, life) { fx.push({ type: 'txt', x, y, text, color, t: 0, life: life || 1 }); }
    function burst(x, y, color, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 60 + Math.random() * 160; fx.push({ type: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, color }); } }
    function nearest(p, range, skip) {
      if (p === P && mouseAim()) { // при прицеле курсором — клякса в досягаемости, ближайшая к курсору
        let best = null, bd = Infinity;
        for (const e of enemies) { if (e.dead || (skip && skip.has(e)) || Math.hypot(e.x - P.x, e.y - P.y) - e.r > range) continue; const d = Math.hypot(e.x - mouse.x, e.y - mouse.y + 20); if (d < bd) { bd = d; best = e; } }
        return best;
      }
      let best = null, bd = range;
      for (const e of enemies) { if (e.dead || (skip && skip.has(e))) continue; const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r; if (d < bd) { bd = d; best = e; } }
      return best;
    }
    function explode(x, y, r, dmg, el, col) {
      waves.push({ x, y: y + 20, max: r, t: 0, col: col || (el === 'ice' ? '95,200,255' : el === 'poison' ? '123,217,58' : el === 'void' ? '163,92,255' : '255,140,40') });
      for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y - y); if (d - e.r < r) hurt(e, dmg, (e.x - x) / (d || 1) * 300, (e.y - y) / (d || 1) * 300, { el }); }
      burst(x, y, el ? ELEM[el].col : '#ff8a30', 12);
    }
    function aimAt(t, melee, id) {
      P.aim = Math.atan2(t.y - (P.y - 30), t.x - P.x);
      if (!P.moving || melee) P.face = Math.cos(P.aim) >= 0 ? 1 : -1;
      P.atkT = .15;
      if (melee) { P.swingT = .25; setPose(MELEE_POSE[id] || 'slash', .24, .2); } else P.recoilT = .1;
    }
    // поза странника на время удара: не чаще, чем раз в gap секунд после прошлой
    function setPose(name, dur, gap) {
      if (v.skin !== 'ninja' || P.dashT > 0 || (P.pose && P.pose.t > 0)) return;
      const t = performance.now() / 1000;
      if (t - P.poseEnd < gap) return;
      P.pose = { name, t: dur, dur }; P.poseEnd = t + dur;
    }
    // рывок: пробел/Shift или кнопка 💨 — короткая неуязвимость и урон кляксам на пути
    function dash() {
      if (P.dashCd > 0 || P.dashT > 0) return;
      let [ax, ay] = ctl.vec();
      if (Math.hypot(ax, ay) < .1) { ax = P.face; ay = 0; }
      const m = Math.hypot(ax, ay);
      P.dvx = ax / m * 780; P.dvy = ay / m * 780; P.dashT = .2; P.dashCd = 1.3; P.inv = Math.max(P.inv, .35); P.pose = null;
      if (Math.abs(ax) > .1) P.face = ax > 0 ? 1 : -1;
      P.dashHit = new Set();
      if (v.sound) ui.sfx('click');
    }

    /* --- стрельба оружием из слотов --- */
    function fireWeapons(dt) {
      const M = { cd: 1 - .04 * v.ups.rate, rg: 1 + .08 * v.ups.range };
      const lv = heroLvl(v);
      spinA += dt;
      for (const id of v.eq) {
        const d = AR[id], wl = v.wp[id]; if (!d || !wl) continue;
        const s = d.st(wl); wt[id] = (wt[id] || 0) - dt;
        if (MAG[id]) { // магазин: пока идёт перезарядка — оружие молчит
          if (rlT[id] > 0) { rlT[id] -= dt; if (rlT[id] > 0) continue; rlT[id] = 0; ammo[id] = MAG[id][0]; }
          if (ammo[id] == null) ammo[id] = MAG[id][0];
        }
        const o = { el: d.el, crit: s.crit, stun: s.stun };
        if (d.cls === 'orbit') {
          const rad = s.radius * M.rg;
          for (let i = 0; i < s.n; i++) {
            const a = spinA * s.spin + i * 6.283 / s.n, ox = P.x + Math.cos(a) * rad, oy = P.y - 24 + Math.sin(a) * rad;
            for (const e of enemies) if (!e.dead && !(e.oc[id] > 0) && Math.hypot(e.x - ox, e.y - oy) < e.r + s.hitR) { e.oc[id] = .35; const kb = s.kb || 240; const dd = Math.hypot(e.x - P.x, e.y - P.y) || 1; hurt(e, s.dmg, (e.x - P.x) / dd * kb, (e.y - P.y) / dd * kb, o); }
          }
          continue;
        }
        if (d.cls === 'beam') {
          if (beam) {
            beam.t -= dt; beam.tick -= dt;
            const t = nearest(P, s.range * M.rg); if (t) { beam.a = Math.atan2(t.y - P.y + 24, t.x - P.x); aimAt(t); }
            if (beam.tick <= 0) {
              beam.tick = .1; const rg = s.range * M.rg, ax = P.x, ay = P.y - 30, bx = ax + Math.cos(beam.a) * rg, by = ay + Math.sin(beam.a) * rg;
              for (const e of enemies) if (!e.dead && segDist(e.x, e.y, ax, ay, bx, by) < e.r + 10) hurt(e, s.dps * .1, 0, 0, { quiet: Math.random() < .6 });
            }
            if (beam.t <= 0) { beam = null; wt[id] = s.cd * M.cd; }
          } else if (wt[id] <= 0) {
            const t = nearest(P, s.range * M.rg);
            if (t) { beam = { t: s.dur, tick: 0, a: Math.atan2(t.y - P.y, t.x - P.x), rg: s.range * M.rg }; aimAt(t); } else wt[id] = .3;
          }
          continue;
        }
        if (d.cls === 'cone') {
          if (wt[id] > 0) continue;
          const rg = s.range * M.rg, t = nearest(P, rg);
          if (!t) { wt[id] = .15; continue; }
          wt[id] = .1; aimAt(t);
          for (const e of enemies) { if (e.dead) continue; const dd = Math.hypot(e.x - P.x, e.y - P.y + 24); if (dd - e.r < rg && angDiff(Math.atan2(e.y - P.y + 24, e.x - P.x), P.aim) < s.ang) hurt(e, s.dmg, Math.cos(P.aim) * 40, Math.sin(P.aim) * 40, Object.assign({ quiet: Math.random() < .7 }, o)); }
          cones.push({ a: P.aim, rg, ang: s.ang, el: d.el, t: 0 }); useAmmo(id);
          continue;
        }
        if (wt[id] > 0) continue;
        const range = (s.range || 300) * M.rg;
        if (d.cls === 'aoe') {
          const rad = s.radius * M.rg;
          if (!nearest(P, rad)) { wt[id] = .2; continue; }
          wt[id] = s.cd * M.cd; waves.push({ x: P.x, y: P.y, max: rad, t: 0, col: '242,181,58' }); ui.sfx('click'); P.atkT = .2;
          for (const e of enemies) { if (e.dead) continue; const dd = Math.hypot(e.x - P.x, e.y - P.y) || 1; if (dd - e.r < rad) hurt(e, s.dmg, (e.x - P.x) / dd * 420, (e.y - P.y) / dd * 420, o); }
          continue;
        }
        const t = nearest(P, range);
        if (!t) { wt[id] = .15; continue; }
        wt[id] = s.cd * M.cd;
        if (!MAG[id]) firedT[id] = performance.now();
        if (d.cls === 'melee') {
          aimAt(t, true, id);
          const rg = s.range * M.rg;
          slashes.push({ x: P.x, y: P.y, a: P.aim, r: rg, arc: Math.min(3.1, s.arc), t: 0, col: d.el ? ELEM[d.el].col : null });
          for (const e of enemies) {
            if (e.dead) continue;
            const dd = Math.hypot(e.x - P.x, e.y - P.y + 24) - e.r, a = Math.atan2(e.y - P.y + 24, e.x - P.x);
            if (dd < rg && angDiff(a, P.aim) < s.arc) { const kb = s.kb || 160; hurt(e, s.dmg, Math.cos(a) * kb, Math.sin(a) * kb, o); }
          }
          if (s.stun) shake = Math.max(shake, .12);
        } else if (d.cls === 'gun') {
          aimAt(t);
          const n = s.count || 1, a0 = Math.atan2(t.y - P.y + 30, t.x - P.x);
          for (let i = 0; i < n; i++) {
            const a = a0 + (n > 1 ? (i - (n - 1) / 2) * (s.spread || .1) : (Math.random() - .5) * (s.spread || 0) * 2);
            shots.push({ kind: s.arrow ? 'arrow' : 'bullet', x: P.x + Math.cos(a0) * 26, y: P.y - 30 + Math.sin(a0) * 26, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, dmg: s.dmg, life: range / s.speed + .05, pierce: s.pierce || 0, hit: new Set(), o, col: s.col, w: s.w || 3, trail: s.trail });
          }
          if (s.flash || n > 2) waves.push({ x: P.x + Math.cos(a0) * 34, y: P.y - 10 + Math.sin(a0) * 34, max: 22, t: 0, col: '255,210,80' });
          useAmmo(id);
        } else if (d.cls === 'rocket') {
          aimAt(t);
          const a = Math.atan2(t.y - P.y, t.x - P.x);
          shots.push({ kind: 'rocket', x: P.x, y: P.y - 34, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: s.dmg, blast: s.blast * M.rg, life: 2.2, target: t, o, plasma: s.plasma });
          useAmmo(id);
        } else if (d.cls === 'boomerang') {
          aimAt(t);
          const a = Math.atan2(t.y - P.y + 24, t.x - P.x);
          shots.push({ kind: 'boomerang', x: P.x, y: P.y - 30, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: s.dmg, life: 5, out: true, dist: 0, max: range, hit: new Set(), o, spr: d.img });
        } else if (d.cls === 'throw') {
          aimAt(t);
          const n = s.count || 1, a0 = Math.atan2(t.y - P.y + 24, t.x - P.x);
          for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * (s.spread || .2); shots.push({ kind: 'throw', x: P.x, y: P.y - 30, vx: Math.cos(a) * s.speed, vy: Math.sin(a) * s.speed, dmg: s.dmg, life: range / s.speed + .1, pierce: s.pierce || 0, hit: new Set(), o, spr: d.img, spin: id === 'shuriken' }); }
        } else if (d.cls === 'grenade') {
          aimAt(t);
          shots.push({ kind: 'grenade', x0: P.x, y0: P.y - 30, tx: t.x, ty: t.y, x: P.x, y: P.y - 30, t: 0, dur: .65, dmg: s.dmg, blast: s.blast * M.rg, life: 9, o, spr: d.img, pool: s.pool, cluster: s.cluster });
        } else if (d.cls === 'homing') {
          aimAt(t); if (d.cat === 'magic' && d.img) setPose('lantern', .32, 1.1);
          const skip = new Set(), pool = pool0();
          for (let i = 0; i < (s.count || 1); i++) {
            const tt = nearest(P, range, skip) || t; skip.add(tt);
            const a = Math.atan2(tt.y - P.y, tt.x - P.x) + (i - (s.count - 1) / 2) * .3;
            shots.push({ kind: s.glyph ? 'glyph' : 'orb', x: P.x, y: P.y - 34, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: s.dmg, life: 1.4, target: tt, o, heal: s.heal, col: s.col, txt: s.glyph && pool.length ? pool[HZ.rand(pool.length)].ch.slice(0, 2) : '字' });
          }
        } else if (d.cls === 'chain') {
          aimAt(t);
          const hit = new Set([t]), pts = [{ x: P.x, y: P.y - 40 }, { x: t.x, y: t.y }]; hurt(t, s.dmg, 0, 0, o);
          let cur = t;
          for (let i = 0; i < s.chains; i++) { const n2 = nearest(cur, 190, hit); if (!n2) break; hit.add(n2); pts.push({ x: n2.x, y: n2.y }); hurt(n2, s.dmg * .8, 0, 0, o); cur = n2; }
          bolts.push({ pts, t: 0 });
        }
      }
      // питомцы стреляют
      v.pets.forEach((li2, i) => {
        petT[i] = (petT[i] || Math.random()) - dt;
        if (petT[i] > 0) return;
        const pp = trail[Math.min(trail.length - 1, (i + 1) * 16)] || P;
        const t = nearest(pp, 380);
        petT[i] = t ? 1.6 : .3;
        if (t) { const a = Math.atan2(t.y - pp.y, t.x - pp.x); shots.push({ kind: 'pet', x: pp.x, y: pp.y - 20, vx: Math.cos(a) * 460, vy: Math.sin(a) * 460, dmg: 4 + 1.5 * lv, life: 1, target: t, o: {} }); }
      });
    }

    function moveShots(dt) {
      for (const s of shots) {
        if (s.kind === 'grenade') {
          s.t += dt / s.dur;
          const k = Math.min(1, s.t);
          s.x = s.x0 + (s.tx - s.x0) * k; s.y = s.y0 + (s.ty - s.y0) * k; s.z = Math.sin(Math.PI * k) * 90;
          if (s.t >= 1) {
            s.life = 0;
            explode(s.tx, s.ty, s.blast, s.dmg, s.o.el);
            if (s.pool) pools.push({ x: s.tx, y: s.ty, r: s.blast * .8, t: 0, dur: s.pool, dps: s.dmg * .6, el: s.o.el });
            if (s.cluster) for (let i = 0; i < s.cluster; i++) { const a = i * 6.283 / s.cluster + Math.random() * .5, r = 70 + Math.random() * 40; shots.push({ kind: 'grenade', x0: s.tx, y0: s.ty, tx: s.tx + Math.cos(a) * r, ty: s.ty + Math.sin(a) * r, x: s.tx, y: s.ty, t: 0, dur: .35, dmg: s.dmg * .5, blast: s.blast * .6, life: 9, o: s.o, spr: s.spr, mini: true }); }
          }
          continue;
        }
        if (s.target && !s.target.dead) { const a = Math.atan2(s.target.y - s.y, s.target.x - s.x), sp2 = Math.hypot(s.vx, s.vy), k = s.kind === 'rocket' ? 3 : 6; s.vx += (Math.cos(a) * sp2 - s.vx) * Math.min(1, dt * k); s.vy += (Math.sin(a) * sp2 - s.vy) * Math.min(1, dt * k); }
        if (s.kind === 'boomerang') {
          s.dist += Math.hypot(s.vx, s.vy) * dt;
          if (s.out && s.dist >= s.max) { s.out = false; s.hit = new Set(); }
          if (!s.out) { const a = Math.atan2(P.y - 30 - s.y, P.x - s.x); s.vx = Math.cos(a) * 560; s.vy = Math.sin(a) * 560; if (Math.hypot(P.x - s.x, P.y - 30 - s.y) < 30) s.life = 0; }
        }
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        for (const e of enemies) {
          if (e.dead || (s.hit && s.hit.has(e))) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + (s.kind === 'rocket' ? 14 : 9)) {
            if (s.kind === 'rocket') { explode(s.x, s.y, s.blast, s.dmg, s.o.el, s.plasma ? '163,92,255' : null); s.life = 0; s.boom = true; break; }
            hurt(e, s.dmg, s.vx * .2, s.vy * .2, s.o);
            if (s.heal) v.hp = Math.min(maxHp(v), v.hp + s.heal);
            if (s.hit) s.hit.add(e);
            if (s.kind === 'boomerang') continue;
            if (s.pierce > 0) { s.pierce--; continue; }
            s.life = 0; break;
          }
        }
        if (s.life <= 0 && s.kind === 'rocket' && !s.boom) { s.boom = true; explode(s.x, s.y, s.blast, s.dmg, s.o.el, s.plasma ? '163,92,255' : null); }
      }
      shots = shots.filter(s => s.life > 0);
      for (const p of pools) {
        p.t += dt; p.tick = (p.tick || 0) - dt;
        if (p.tick <= 0) { p.tick = .25; for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < p.r + e.r * .5) hurt(e, p.dps * .25, 0, 0, { el: p.el, quiet: true }); }
      }
      pools = pools.filter(p => p.t < p.dur);
    }

    /* ====== Обновление ====== */
    function update(dt) {
      const mhp = maxHp(v);
      const [dx, dy] = ctl.vec();
      const sp = speedOf(v);
      P.moving = Math.hypot(dx, dy) > .05; P.mx = dx;
      P.x += (dx * sp + P.kx) * dt; P.y += (dy * sp + P.ky) * dt;
      P.kx *= Math.exp(-8 * dt); P.ky *= Math.exp(-8 * dt);
      P.x = Math.max(30, Math.min(WW - 30, P.x)); P.y = Math.max(50, Math.min(WH - 20, P.y));
      if (dx > .1) P.face = 1; else if (dx < -.1) P.face = -1;
      if (P.moving) {
        trail.unshift({ x: P.x, y: P.y }); if (trail.length > 160) trail.length = 160;
        P.walk += dt * 11;
        P.dustT -= dt; if (P.dustT <= 0) { P.dustT = .12; fx.push({ type: 'dust', x: P.x - dx * 14 + (Math.random() - .5) * 10, y: P.y + 2, t: 0, r: 4 + Math.random() * 4 }); }
        if (!P.atkT) P.aim = Math.atan2(dy, dx);
      }
      if (mouseAim() && P.atkT <= 0) { P.aim = Math.atan2(mouse.y - (P.y - 44), mouse.x - P.x); P.face = Math.cos(P.aim) >= 0 ? 1 : -1; }
      if (P.dashT > 0) {
        P.dashT -= dt; P.x += P.dvx * dt; P.y += P.dvy * dt;
        P.x = Math.max(30, Math.min(WW - 30, P.x)); P.y = Math.max(50, Math.min(WH - 20, P.y));
        P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = .035; fx.push({ type: 'ghost', x: P.x, y: P.y, face: P.face, t: 0, life: .28 }); }
        for (const e of enemies) if (!e.dead && !P.dashHit.has(e) && Math.hypot(e.x - P.x, e.y - P.y + 20) < e.r + 30) { P.dashHit.add(e); hurt(e, 14 + 2 * heroLvl(v), P.dvx * .25, P.dvy * .25, {}); }
      }
      P.dashCd = Math.max(0, P.dashCd - dt);
      if (P.pose) { P.pose.t -= dt; if (P.pose.t <= 0) P.pose = null; }
      P.still = P.moving || P.dashT > 0 ? 0 : P.still + dt;
      if (P.moving) P.up = dy < -.5 && Math.abs(dx) < .75;
      P.inv = Math.max(0, P.inv - dt); P.atkT = Math.max(0, P.atkT - dt); P.swingT = Math.max(0, P.swingT - dt); P.recoilT = Math.max(0, P.recoilT - dt); P.hurtT = Math.max(0, P.hurtT - dt); P.lvlT = Math.max(0, P.lvlT - dt);
      const camp = inCamp(P);
      v.hp = Math.min(mhp, v.hp + regenOf(v) * dt * (camp ? 8 : 1));
      v.coins += incomeOf(v) * dt;

      // портал босса
      if (!boss && seals() >= SEALS && dist(P, L.portal) < 60) startBoss();

      // кляксы
      spawnT -= dt; if (spawnT <= 0) { spawnT = .6; spawnTick(); }
      const aggro = 900 + 60 * v.loc; // кляксы замечают героя издалека и бегут на него
      for (const e of enemies) {
        if (e.dead) continue;
        // стихии: поджог, яд, кровотечение, замедление
        for (const k of ['burn', 'poison', 'bleed']) {
          const s = e[k]; if (!s) continue;
          s.t -= dt; e.hp -= s.dps * dt; s.acc = (s.acc || 0) + s.dps * dt;
          if (s.acc >= 8 || s.t <= 0) { if (s.acc >= 1) fx.push({ type: 'num', x: e.x + (Math.random() - .5) * 16, y: e.y - e.r, text: String(Math.round(s.acc)), t: 0, col: ELEM[k === 'burn' ? 'fire' : k].col }); s.acc = 0; }
          if (Math.random() < dt * 6) fx.push({ type: 'dot', x: e.x + (Math.random() - .5) * e.r, y: e.y - e.r * .3, vx: 0, vy: -40, t: .3, color: ELEM[k === 'burn' ? 'fire' : k].col });
          if (s.t <= 0) e[k] = null;
        }
        if (e.hp <= 0) { kill(e); continue; }
        if (e.slow) { e.slow.t -= dt; if (e.slow.t <= 0) e.slow = null; }
        const slowK = e.slow ? e.slow.k : 0;
        const ex = P.x - e.x, ey = P.y - e.y, d = Math.hypot(ex, ey) || 1;
        for (const k in e.oc) e.oc[k] -= dt;
        if (e.isBoss) bossAI(e, dt, slowK);
        else if (e.stun > 0) { e.stun -= dt; e.hit = Math.max(0, e.hit - dt); }
        else {
          let mx, my;
          if (d < aggro && !camp) { const rush = d < 260 ? 1.6 : 1.4; mx = ex / d * rush; my = ey / d * rush; }
          else { e.wt -= dt; if (e.wt <= 0) { e.wa = Math.random() * 6.283; e.wt = 1.5 + Math.random() * 2; } mx = Math.cos(e.wa) * .45; my = Math.sin(e.wa) * .45; }
          e.x += (mx * e.sp * (1 - slowK) + e.kx) * dt; e.y += (my * e.sp * (1 - slowK) + e.ky) * dt;
          e.hit = Math.max(0, e.hit - dt);
        }
        e.kx *= Math.exp(-6 * dt); e.ky *= Math.exp(-6 * dt);
        if (e.isBoss || e.stun > 0) { e.x += e.kx * dt; e.y += e.ky * dt; }
        const dc = Math.hypot(e.x - CAMP.x, e.y - CAMP.y);
        if (dc < CAMP.r + e.r) { const k = (CAMP.r + e.r) / (dc || 1); e.x = CAMP.x + (e.x - CAMP.x) * k; e.y = CAMP.y + (e.y - CAMP.y) * k; e.wa += Math.PI; }
        e.x = Math.max(e.r, Math.min(WW - e.r, e.x)); e.y = Math.max(e.r, Math.min(WH - e.r, e.y));
        if (d < e.r + 22) hitPlayer(e.dmg, e.x, e.y, e.isBoss ? 480 : 320, e);
      }
      hurtSfxT -= dt;
      for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) { // не слипаются
        const a = enemies[i], b = enemies[j], ddx = b.x - a.x, ddy = b.y - a.y, dd = Math.hypot(ddx, ddy) || 1, m = a.r + b.r;
        if (dd < m) { const wa = a.isBoss ? 0 : b.isBoss ? 1 : .5, push = m - dd; a.x -= ddx / dd * push * wa; a.y -= ddy / dd * push * wa; b.x += ddx / dd * push * (1 - wa); b.y += ddy / dd * push * (1 - wa); }
      }
      // снаряды босса и огненный дождь
      const sh = shieldOf(v);
      for (const b of ebul) {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (Math.hypot(b.x - P.x, b.y - (P.y - 24)) < b.r + 16 && P.inv <= 0 && !inCamp(P)) {
          if (sh && sh.block && Math.random() < sh.block + .03 * (sh.lv - 1)) { b.life = 0; floatText(P.x, P.y - 80, 'Блок!', '#5fc8ff'); P.inv = .2; }
          else if (hitPlayer(b.dmg, b.x, b.y, 200)) b.life = 0;
        }
        if (b.x < 0 || b.y < 0 || b.x > WW || b.y > WH) b.life = 0;
      }
      ebul = ebul.filter(b => b.life > 0);
      for (const r of rains) { r.t += dt; if (r.t >= r.delay && !r.done) { r.done = true; waves.push({ x: r.x, y: r.y, max: r.r, t: 0, col: '230,80,30' }); if (Math.hypot(P.x - r.x, P.y - r.y) < r.r + 14) hitPlayer(r.dmg, r.x, r.y, 260); } }
      rains = rains.filter(r => r.t < r.delay + .3);
      if (v.hp <= 0) return die();

      fireWeapons(dt);
      moveShots(dt);
      enemies = enemies.filter(e => !e.dead);
      if (boss && boss.dead) boss = null;

      // монеты и сердца
      const mr = magnetR(v);
      for (const d of drops) {
        d.t += dt;
        const dd = Math.hypot(P.x - d.x, P.y - 20 - d.y);
        if (dd < mr) { const k = Math.min(1, dt * 7); d.x += (P.x - d.x) * k; d.y += (P.y - 20 - d.y) * k; }
        if (dd < 26) { d.got = true; if (d.type === 'coin') v.coins += d.val; else { v.hp = Math.min(mhp, v.hp + mhp * .25); floatText(P.x, P.y - 80, '+❤️', '#d64545'); } }
      }
      drops = drops.filter(d => !d.got && d.t < 45);

      // знаки задания
      if (quest && !quest.done) {
        const mag = 4 * v.ups.magnet;
        for (const b of bubbles) {
          if (b.dead || b.pop) continue;
          if (Math.hypot(b.x - P.x, b.y - P.y + 10) < 30 + b.r + mag) { if (b.ok) onRight(b); else onWrong(b); break; }
        }
        if (!hintShown && (performance.now() - quest.t0) / 1000 > Math.max(1.5, 9 - 1.2 * v.ups.wisdom)) hintShown = true;
        if (bubbles.length && bubbles.every(b => Math.hypot(b.x - P.x, b.y - P.y) > 1500)) newRound();
      }
      bubbles.forEach(b => { if (b.dead) b.dead += dt * 2; if (b.pop) b.pop += dt * 2; });
      bubbles = bubbles.filter(b => b.dead < 1 && b.pop < 1.2);
      fx.forEach(f => {
        f.t += dt;
        if (f.type === 'dot') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; }
        else if (f.type === 'shell' || f.type === 'mag') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 700 * dt; f.rot += (f.vr || 8) * dt; const gy = f.gy || P.y + 4; if (f.y > gy && f.vy > 0) { f.y = gy; f.vy *= -.35; f.vx *= .5; f.vr = (f.vr || 8) * .5; } }
      });
      P.flashT = Math.max(0, (P.flashT || 0) - dt);
      fx = fx.filter(f => f.t < (f.life || (f.type === 'num' ? .6 : f.type === 'dust' ? .5 : 1)));
      slashes.forEach(s => { s.t += dt; }); slashes = slashes.filter(s => s.t < .22);
      waves.forEach(w => { w.t += dt; }); waves = waves.filter(w => w.t < .45);
      bolts.forEach(b => { b.t += dt; }); bolts = bolts.filter(b => b.t < .18);
      cones.forEach(c => { c.t += dt; }); cones = cones.filter(c => c.t < .12);
      shake = Math.max(0, shake - dt);
      cam.x = Math.max(0, Math.min(WW - VW, P.x - VW / 2));
      cam.y = Math.max(0, Math.min(WH - VH, P.y - VH / 2));
    }

    function die() {
      v.deaths++;
      const loss = Math.floor(v.coins * .1); v.coins -= loss;
      v.hp = maxHp(v); combo = 0;
      burst(P.x, P.y - 30, '#d64545', 30);
      P.x = CAMP.x; P.y = CAMP.y + 40; P.inv = 2.5; P.kx = P.ky = 0; trail.length = 0;
      let msg = `💀 Вас одолели! −${fmt(loss)} 🪙. Вы снова в лагере — усильте героя и оружие в арсенале.`;
      if (boss) { boss.dead = true; boss = null; v.seals[v.loc] = SEALS; msg += ' Портал босса остаётся открытым.'; }
      enemies = enemies.filter(e => !e.dead && Math.hypot(e.x - CAMP.x, e.y - CAMP.y) > 800);
      ebul = []; rains = []; beam = null;
      ui.toast(msg, 'warn', 5000);
      touchW(); newRound(); hud();
    }

    /* ====== Отрисовка ====== */
    function blobPath(r, wob) {
      ctx.beginPath();
      for (let k = 0; k <= 18; k++) {
        const a = k / 18 * 6.283, q = r * (1 + .08 * Math.sin(a * 3 + wob) + .05 * Math.sin(a * 5 - wob * 1.3));
        const x = Math.cos(a) * q, y = Math.sin(a) * q * .92;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
    function eyes(e, r, ey, angry) {
      const la = Math.atan2(P.y - e.y, P.x - e.x), es = Math.max(3, r * .2);
      [-1, 1].forEach(sd => {
        const exx = sd * r * .32;
        ctx.fillStyle = angry ? '#ffd2d2' : '#fff'; ctx.beginPath(); ctx.arc(exx, ey, es, 0, 6.283); ctx.fill();
        ctx.fillStyle = angry ? '#b3001b' : '#111'; ctx.beginPath(); ctx.arc(exx + Math.cos(la) * es * .45, ey + Math.sin(la) * es * .45, es * .5, 0, 6.283); ctx.fill();
        if (angry) { ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(exx - es * sd * 1.2, ey - es * 1.5); ctx.lineTo(exx + es * sd * .6, ey - es * .9); ctx.stroke(); }
      });
    }
    function statusTint(e) { // цвет стихии поверх кляксы
      if (e.slow) return 'rgba(95,200,255,.35)';
      if (e.burn) return 'rgba(255,122,26,.3)';
      if (e.poison) return 'rgba(123,217,58,.3)';
      if (e.bleed) return 'rgba(212,32,44,.25)';
      return null;
    }
    function drawBlob(e, now, sx, sy) {
      const r = e.r;
      ctx.save(); ctx.translate(sx, sy);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, r * .85, r * .9, r * .28, 0, 0, 6.283); ctx.fill();
      blobPath(r, now / 300 + e.ph);
      ctx.fillStyle = L.blob; ctx.fill();
      const st = statusTint(e); if (st) { ctx.fillStyle = st; ctx.fill(); }
      if (e.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(.75, e.hit * 6)})`; ctx.fill(); }
      if (e.type === 'king') { ctx.lineWidth = 4; ctx.strokeStyle = '#f2b53a'; ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(-r * .35, -r * .4, r * .3, r * .18, -.5, 0, 6.283); ctx.fill();
      eyes(e, r, e.glyph ? -r * .42 : -r * .15, false);
      if (e.glyph) {
        const t = e.glyph.ch.slice(0, 2);
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(r * (t.length > 1 ? .62 : .9))}px "Noto Serif SC","Songti SC",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t, 0, r * .22);
      }
      if (e.type === 'king') ctx.drawImage(emo('👑', 26), -18, -r - 34);
      if (e.stun > 0) ctx.drawImage(emo('💫', 16), -11, -r - 22);
      if (e.hp < e.max) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-r, -r - 12, r * 2, 5); ctx.fillStyle = '#e04b4b'; ctx.fillRect(-r, -r - 12, r * 2 * Math.max(0, e.hp / e.max), 5); }
      ctx.restore();
    }
    function drawBoss(b, now, sx, sy) {
      const r = b.r;
      if (b.state === 'tele') {
        ctx.strokeStyle = 'rgba(214,69,69,.6)'; ctx.lineWidth = r * 1.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(b.ang) * 360, sy + Math.sin(b.ang) * 360); ctx.stroke();
      }
      ctx.save(); ctx.translate(sx, sy);
      const pulse = 1 + Math.sin(now / 200) * .03;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, r * .9, r, r * .3, 0, 0, 6.283); ctx.fill();
      ctx.shadowColor = b.B.color; ctx.shadowBlur = 30;
      blobPath(r, now / 220);
      ctx.fillStyle = b.B.color; ctx.fill();
      const st = statusTint(b); if (st) { ctx.fillStyle = st; ctx.fill(); }
      if (b.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(.45, b.hit * 4)})`; ctx.fill(); }
      ctx.shadowBlur = 0; ctx.lineWidth = 5; ctx.strokeStyle = b.hp < b.max / 2 ? '#ff3b3b' : '#f2b53a'; ctx.stroke();
      eyes(b, r, -r * .38, true);
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = `700 ${Math.round(r * .8)}px "Noto Serif SC","Songti SC",serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.B.ch, 0, r * .3);
      const hat = emo(b.B.hat, 40); ctx.drawImage(hat, -hat.width / 2, -r - hat.height + 10);
      if (b.stun > 0) ctx.drawImage(emo('💫', 22), -15, -r - 66);
      ctx.restore();
    }
    function drawPy(text, cx, cy, size) {
      const parts = (text || '').split(/\s+/).filter(Boolean);
      ctx.font = `700 ${size}px system-ui, sans-serif`;
      const sp = ctx.measureText(' ').width, ws = parts.map(p => ctx.measureText(p).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (parts.length - 1);
      let x = cx - tw / 2; ctx.textAlign = 'left';
      parts.forEach((p, i) => { ctx.fillStyle = TONE_COL[HZ.toneOf(p) - 1]; ctx.fillText(p, x, cy); x += ws[i] + sp; });
      ctx.textAlign = 'center';
    }
    function fit(text, maxW) { if (ctx.measureText(text).width <= maxW) return text; let t = text; while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; }
    function drawQuest(now) {
      if (!quest) return;
      const e = quest.e, show = v.mode !== 'hard';
      const w = narrow ? VW - 20 : 470, x0 = (VW - w) / 2, y0 = narrow ? 62 : 8, hh = 78;
      const qi = SCN('quest');
      if (SCN_OK(qi)) { if (quest.done) { ctx.shadowColor = '#1f9d63'; ctx.shadowBlur = 18; } ctx.drawImage(qi, x0, y0, w, hh); ctx.shadowBlur = 0; }
      else { ctx.fillStyle = 'rgba(255,253,246,.95)'; ctx.strokeStyle = quest.done ? '#1f9d63' : '#c9a35b'; ctx.lineWidth = 3; rr(ctx, x0, y0, w, hh, 14); ctx.fill(); ctx.stroke(); }
      ctx.textBaseline = 'middle';
      qBtn.r = 0;
      if (show) {
        const ch = e.ch, fs = ch.length > 2 ? 28 : ch.length === 2 ? 38 : 48, bw = Math.max(78, fs * ch.length + 14);
        ctx.fillStyle = '#231a12'; ctx.font = `700 ${fs}px "Noto Serif SC","Songti SC",serif`; ctx.textAlign = 'center'; ctx.fillText(ch, x0 + 14 + bw / 2, y0 + hh / 2 + 2);
        const tx = x0 + bw + 26, tw = w - bw - 50;
        ctx.textAlign = 'left'; ctx.fillStyle = '#7a6a58'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillText(quest.done ? '✓ Найдено!' : 'Найди этот знак на карте:', tx, y0 + 17);
        const pyx = tx + Math.min(tw, 320) / 2; drawPy(e.py, pyx, y0 + 40, 19);
        ctx.font = '700 19px system-ui, sans-serif'; const pw = ctx.measureText(e.py).width;
        qBtn.x = Math.min(x0 + w - 70, pyx + pw / 2 + 22); qBtn.y = y0 + 40; qBtn.r = 12;
        ctx.fillStyle = '#2f8fe0'; ctx.beginPath(); ctx.arc(qBtn.x, qBtn.y, qBtn.r, 0, 6.283); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(qBtn.x - 6, qBtn.y - 3); ctx.lineTo(qBtn.x - 3, qBtn.y - 3); ctx.lineTo(qBtn.x + 1, qBtn.y - 7); ctx.lineTo(qBtn.x + 1, qBtn.y + 7); ctx.lineTo(qBtn.x - 3, qBtn.y + 3); ctx.lineTo(qBtn.x - 6, qBtn.y + 3); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(qBtn.x + 2, qBtn.y, 5, -.9, .9); ctx.stroke();
        ctx.textAlign = 'left'; ctx.fillStyle = '#231f1c'; ctx.font = '600 14px system-ui, sans-serif'; ctx.fillText(fit(firstGloss(e.m), tw), tx, y0 + 62);
      } else {
        ctx.textAlign = 'center'; ctx.fillStyle = '#7a726a'; ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillText(quest.done ? '✓ Найдено!' : quest.type === 'm' ? 'Найди знак со значением:' : 'Найди знак с чтением:', VW / 2, y0 + 14);
        if (quest.type === 'm') { ctx.fillStyle = '#e4572e'; ctx.font = '700 22px system-ui, sans-serif'; ctx.fillText(fit(firstGloss(e.m), w - 20), VW / 2, y0 + 38); }
        else drawPy(e.py, VW / 2, y0 + 38, 24);
        if (hintShown) { if (quest.type === 'm') drawPy(e.py, VW / 2, y0 + 58, 14); else { ctx.fillStyle = '#7a726a'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText(fit(firstGloss(e.m), w - 20), VW / 2, y0 + 58); } }
        else { ctx.fillStyle = '#a39d95'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText(`подсказка через ${Math.max(0, Math.ceil(Math.max(1.5, 9 - 1.2 * v.ups.wisdom) - (now - quest.t0) / 1000))} с · награда ×2`, VW / 2, y0 + 58); }
      }
      ctx.textAlign = 'right'; ctx.font = '800 14px system-ui, sans-serif'; ctx.fillStyle = seals() >= SEALS || boss ? '#6a35c9' : '#7a6a58';
      ctx.fillText(boss ? '⚔️ босс' : `${seals()}/${SEALS}`, x0 + w - 16, y0 + 18);
      if (!boss) { const pi = SCN('portal'); if (SCN_OK(pi)) ctx.drawImage(pi, x0 + w - 16 - ctx.measureText(`${seals()}/${SEALS}`).width - 22, y0 + 8, 19, 19); }
      if (reveal && now - reveal.t < 3500) {
        const msg = `«${reveal.e.ch}» — ${reveal.e.py} — ${firstGloss(reveal.e.m)}`;
        ctx.font = '700 14px system-ui, sans-serif'; ctx.textAlign = 'center';
        const mw2 = Math.min(w, ctx.measureText(msg).width + 24);
        ctx.fillStyle = 'rgba(214,69,69,.92)'; rr(ctx, VW / 2 - mw2 / 2, y0 + hh + 4, mw2, 26, 10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(fit(msg, mw2 - 16), VW / 2, y0 + hh + 17);
      }
      ctx.textAlign = 'center';
    }
    function drawDeco(d, ox, oy, alpha) {
      const x = d.x - ox, y = d.y - oy;
      if (d.spr) {
        const im = SCN(d.spr); if (!SCN_OK(im)) return;
        const w = d.w, hh = w * im.naturalHeight / im.naturalWidth;
        if (x < -w || x > VW + w || y < -10 || y - hh > VH + 10) return;
        const sway = d.spr === 'bamboo' || d.spr === 'bamboo2' ? Math.sin(performance.now() / 900 + d.x) * .025 : 0;
        ctx.save(); if (alpha < 1) ctx.globalAlpha = alpha; ctx.translate(x, y); if (sway) ctx.rotate(sway); if (d.flip) ctx.scale(-1, 1);
        if (v.loc && d.spr.startsWith('rock')) ctx.drawImage(im, -w / 2, -hh, w, hh); else ctx.drawImage(im, -w / 2, -hh, w, hh);
        ctx.restore();
      } else { if (x < -40 || y < -40 || x > VW + 40 || y > VH + 40) return; const im = emo(d.e, d.s); ctx.drawImage(im, x - im.width / 2, y - im.height / 2); }
    }
    const qBtn = { x: 0, y: 0, r: 0 }, frontDeco = []; // кнопка озвучки в карточке задания
    /** Картинка оружия: спрайт из листа или эмодзи */
    function wImg(d, size) { if (d.img) { const im = SPR(d.img); return im.complete && im.naturalWidth ? im : null; } return emo(d.ico, size); }
    function drawSpr(im, x, y, size, rot) {
      if (!im) return;
      const k = size / Math.max(im.width || im.naturalWidth, im.height || im.naturalHeight), w = (im.naturalWidth || im.width) * k, hh = (im.naturalHeight || im.height) * k;
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(im, -w / 2, -hh / 2, w, hh); ctx.restore();
    }

    /* Герой: ходьба (подпрыгивание, сжатие-растяжение, наклон), дыхание, удар, вспышка при уроне, оружие в руке */
    const heldWeapon = () => v.eq.map(k => AR[k]).find(d => d && v.wp[d.id] > 0 && d.cls !== 'orbit' && d.cls !== 'aoe');
    function ninjaPose() {
      if (P.dashT > 0) return 'dash';
      if (P.pose) return P.pose.name;
      if (!P.moving && P.still > 1.4 && inCamp(P) && !boss && !mouseAim()) return 'meditate';
      return null;
    }
    // красные концы шарфа развеваются за спиной (в координатах спрайта, «за спиной» — слева)
    function drawScarf(now, walking) {
      for (let j = 0; j < 2; j++) {
        const n = 9, len = 50 + j * 12 + (walking ? 22 : 0), amp = walking ? 8 : 3.5, w0 = 8 - 2 * j, pts = [];
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          pts.push([46 - u * len * (walking ? 1 : .5), 58 + j * 5 + u * len * (walking ? .2 : .8) + Math.sin(now / (walking ? 85 : 260) - u * 5 - j * 1.7) * amp * u]);
        }
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const w = w0 * (1 - i / n * .75); i ? ctx.lineTo(pts[i][0], pts[i][1] - w) : ctx.moveTo(pts[i][0], pts[i][1] - w); }
        for (let i = n; i >= 0; i--) { const w = w0 * (1 - i / n * .75); ctx.lineTo(pts[i][0], pts[i][1] + w); }
        ctx.closePath(); ctx.fillStyle = j ? '#a3121a' : '#d4232a'; ctx.fill();
        ctx.strokeStyle = 'rgba(45,0,0,.55)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    function drawEyes(now, m) {
      const blink = now % 3600 < 120, glow = P.atkT > 0 || boss;
      for (const [x, y, rx, ry] of m.eyes) {
        if (blink) { ctx.fillStyle = '#0c0909'; ctx.beginPath(); ctx.ellipse(x, y, rx + 2, ry + 2, 0, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,230,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - rx, y + 1); ctx.lineTo(x + rx, y + 1); ctx.stroke(); }
        else if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,60,40,.45)'; ctx.beginPath(); ctx.arc(x, y, rx * 2.6, 0, 6.283); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
    function drawNinja(now, sx, sy, lv) {
      const k = NINJA_K * (1 + Math.min(.2, (lv - 1) * .008));
      const pose = ninjaPose(), walking = P.moving && !pose, ph = P.walk * .8;
      const air = pose === 'meditate' ? 12 + Math.sin(now / 500) * 4 : pose === 'kick' ? 10 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(sx, sy + 3, 28 - air * .7, 8 - air * .2, 0, 0, 6.283); ctx.fill();
      if (P.lvlT > 0) { ctx.fillStyle = `rgba(255,211,77,${Math.min(.5, P.lvlT * .4)})`; ctx.beginPath(); ctx.arc(sx, sy - 44, 50 + (1.5 - P.lvlT) * 30, 0, 6.283); ctx.fill(); }
      if (pose === 'meditate') { ctx.fillStyle = `rgba(255,196,90,${.16 + .08 * Math.sin(now / 300)})`; ctx.beginPath(); ctx.arc(sx, sy - 42, 58, 0, 6.283); ctx.fill(); }
      const hand = pose ? null : heldWeapon(), behind = hand && Math.sin(P.aim) < -.3;
      if (behind) drawHand(hand, sx, sy, 49, true);
      const T = im => (P.hurtT > 0 ? tinted(im, 'rgba(255,40,40,.55)') : im), ok = im => im.complete && im.naturalWidth;
      ctx.save();
      if (P.inv > 0 && P.hurtT <= 0 && P.dashT <= 0 && Math.floor(now / 90) % 2) ctx.globalAlpha = .55;
      ctx.translate(sx, sy - air);
      if (pose) {
        const m = NJ[pose], im = NIMG(pose), pp = P.pose && P.pose.name === pose ? 1 - P.pose.t / P.pose.dur : 0, pop = 1 + .08 * Math.sin(pp * Math.PI);
        ctx.scale(P.face * k * pop, k * pop);
        if (ok(im)) ctx.drawImage(T(im), -m.ax, -m.ay, m.w, m.h);
      } else {
        const up = false, nm = 'idle', m = NJ[nm]; // всегда лицом к игроку
        const top = NIMG(nm + (hand ? '-top-nf' : '-top')), lg = NIMG(nm + '-legl'), rg = NIMG(nm + '-legr');
        const A = walking ? .17 : 0, s1 = Math.sin(ph), c1 = Math.cos(ph);
        const bob = walking ? -Math.abs(s1) * 5 : 0, br = walking ? 0 : Math.sin(now / 520) * .022;
        ctx.rotate(walking ? P.mx * .07 : 0);
        ctx.scale(P.face * k, k);
        ctx.translate(-m.ax, -m.ay);
        if (!up) drawScarf(now, walking);
        const leg = (im, hip, a, lift) => { if (!ok(im)) return; ctx.save(); ctx.translate(hip[0], hip[1] - lift); ctx.rotate(a); ctx.translate(-hip[0], -hip[1]); ctx.drawImage(T(im), 0, 0, m.w, m.h); ctx.restore(); };
        leg(lg, m.hipL, s1 * A, walking ? Math.max(0, c1) * 8 : 0);
        leg(rg, m.hipR, -s1 * A, walking ? Math.max(0, -c1) * 8 : 0);
        if (ok(top)) {
          ctx.save(); ctx.translate(m.ax, m.hipL[1] + bob); ctx.scale(1 - br * .5, 1 + br); ctx.translate(-m.ax, -m.hipL[1]);
          ctx.drawImage(T(top), 0, 0, m.w, m.h);
          if (!up) drawEyes(now, m);
          ctx.restore();
        }
      }
      ctx.restore();
      if (hand && !behind) drawHand(hand, sx, sy, 49, true);
    }
    function drawHero(now, ox, oy, lv) {
      if (v.skin === 'ninja') return drawNinja(now, P.x - ox, P.y - oy, lv);
      const im = spriteOf(v.skin, Math.floor((lv - 1) / 4));
      const walking = P.moving, cyc = P.walk;
      const hop = walking ? Math.abs(Math.sin(cyc)) * 8 : 0;
      const sq = walking ? Math.sin(cyc * 2) * .07 : Math.sin(now / 420) * .028;
      const atk = P.atkT > 0 ? P.atkT / .15 : 0;
      const lean = walking ? P.mx * .14 : 0;
      const sx = P.x - ox, sy = P.y - oy;
      // тень
      ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(sx, sy + 4, 26 * (1 - hop / 40), 8 * (1 - hop / 40), 0, 0, 6.283); ctx.fill();
      // свечение уровня
      if (P.lvlT > 0) { ctx.fillStyle = `rgba(255,211,77,${Math.min(.5, P.lvlT * .4)})`; ctx.beginPath(); ctx.arc(sx, sy - 34, 50 + (1.5 - P.lvlT) * 30, 0, 6.283); ctx.fill(); }
      // оружие за спиной (если целимся влево — рисуем позади героя)
      const hand = heldWeapon(), behind = hand && Math.sin(P.aim) < -.3;
      if (behind) drawHand(hand, sx, sy - hop);
      ctx.save();
      if (P.inv > 0 && P.hurtT <= 0 && Math.floor(now / 90) % 2) ctx.globalAlpha = .5;
      if (im.complete && im.naturalWidth) {
        const hh = 74, ww = hh * im.naturalWidth / im.naturalHeight;
        ctx.translate(sx, sy - hop);
        ctx.rotate(lean + (atk ? Math.cos(P.aim) * .1 * atk : 0));
        ctx.scale(P.face * (1 + sq + atk * .06), 1 - sq + atk * .06);
        ctx.drawImage(P.hurtT > 0 ? tinted(im, 'rgba(255,40,40,.55)') : im, -ww / 2, -hh + 8, ww, hh);
      }
      ctx.restore();
      if (hand && !behind) drawHand(hand, sx, sy - hop);
    }
    function fist(x, y, r) { // кулак странника (чёрная перчатка с бронзовым ободком)
      r *= .72;
      ctx.fillStyle = '#1b1416'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(110,70,35,.85)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(x - r * .3, y - r * .35, r * .3, 0, 6.283); ctx.fill();
    }
    function drawHand(d, sx, sy, hh0 = 32, held) {
      const im = wImg(d, 30); if (!im) return;
      const melee = d.cls === 'melee' || (d.cat === 'magic' && d.img);
      let a = P.aim;
      if (melee && P.swingT > 0) a += (P.swingT / .25 - .5) * -2.4 * (Math.cos(P.aim) >= 0 ? 1 : -1);
      const rec = P.recoilT > 0 ? P.recoilT / .1 * 9 : 0, now = performance.now();
      const reloading = MAG[d.id] && rlT[d.id] > 0, rp = reloading ? 1 - rlT[d.id] / rlTime(d.id) : 0;
      const bob = P.moving ? Math.sin(P.walk * 2) * 2.2 : Math.sin(now / 480) * 1.2;
      if (reloading) a += Math.sin(rp * Math.PI) * 1.1 * (Math.cos(P.aim) >= 0 ? 1 : -1); // наклон вниз и обратно при смене магазина
      const hx = held ? sx + P.face * 4 + Math.cos(P.aim) * (8 - rec) : sx + Math.cos(P.aim) * (18 - rec), hy = sy - hh0 + Math.sin(P.aim) * (held ? 6 : 10) + bob + (reloading ? Math.sin(rp * Math.PI) * 6 : 0);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
      if (Math.cos(a) < 0) ctx.scale(1, -1);
      if (melee) ctx.rotate(Math.PI / 2 - .2);
      const small = d.cls === 'grenade' || d.cls === 'throw' || d.cls === 'boomerang', size = (melee ? 54 : small ? 30 : 58) * (held ? .88 : 1);
      const k = size / Math.max(im.naturalWidth || im.width, im.naturalHeight || im.height), w = (im.naturalWidth || im.width) * k, hh = (im.naturalHeight || im.height) * k;
      if (d.el) { ctx.shadowColor = ELEM[d.el].col; ctx.shadowBlur = 10 + 5 * Math.sin(now / 180); }
      if (melee) ctx.drawImage(im, -w / 2, -hh * .85, w, hh); else ctx.drawImage(im, -w * .25, -hh / 2, w, hh);
      ctx.shadowBlur = 0;
      if (held) { // кулаки на рукояти: у меча — на рукояти, у ружья — на рукояти и цевье
        if (melee) fist(0, hh * .08, 5.2);
        else if (small) fist(-2, 2, 5);
        else { fist(-1, 3, 5.2); if (w > 34) fist(w * .32, 2, 4.8); }
      }
      if (!melee && P.flashT > 0 && !reloading) { // вспышка выстрела у дула
        const fx0 = w * .78, r0 = 9 + Math.random() * 6, col = d.el ? ELEM[d.el].col : AR[d.id].st(1).col || '#ffd34d';
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = col; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const rr0 = i % 2 ? r0 * .45 : r0, an = i / 10 * 6.283; ctx.lineTo(fx0 + Math.cos(an) * rr0 * 1.4, Math.sin(an) * rr0); }
        ctx.closePath(); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx0, 0, r0 * .35, 0, 6.283); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
      }
      if (d.cat === 'magic' && Math.random() < .25) fx.push({ type: 'dot', x: P.x + Math.cos(P.aim) * 30 + (Math.random() - .5) * 14, y: P.y - hh0 - 26 + (Math.random() - .5) * 14, vx: 0, vy: -50, t: .4, color: d.el ? ELEM[d.el].col : '#ffe07a' });
      ctx.restore();
      if (reloading) { // полоска перезарядки над героем
        const bx = sx - 26, by = sy - 112;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; rr(ctx, bx - 2, by - 2, 56, 10, 5); ctx.fill();
        ctx.fillStyle = '#ffc23d'; rr(ctx, bx, by, 52 * rp, 6, 3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '800 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('перезарядка', sx, by - 8);
      }
    }

    function draw(now) {
      const ox = cam.x + (shake ? (Math.random() - .5) * 40 * shake : 0), oy = cam.y + (shake ? (Math.random() - .5) * 40 * shake : 0);
      ctx.clearRect(0, 0, VW, VH);
      // земля: травяные плитки из листа ассетов (в других локациях — окрашенные)
      const T = 64, D = Math.round(T * 1.22), off = (D - T) / 2, i0 = Math.floor(ox / T), j0 = Math.floor(oy / T), tpx = Math.round(D * (canvas._dpr || 1));
      ctx.fillStyle = L.g[0]; ctx.fillRect(0, 0, VW, VH);
      for (let j = j0 - 1; j <= j0 + Math.ceil(VH / T) + 1; j++) for (let i = i0 - 1; i <= i0 + Math.ceil(VW / T) + 1; i++) {
        const hsh = (((i * 73856093) ^ (j * 19349663)) >>> 0) % 97, name = TILES[hsh % TILES.length];
        const tc = sceneCanvas(v.loc, name, tpx, tpx);
        if (tc) ctx.drawImage(tc, i * T - ox - off, j * T - oy - off, D, D);
        else { ctx.fillStyle = L.g[(i + j) & 1]; ctx.fillRect(i * T - ox, j * T - oy, T + 1, T + 1); }
      }
      // лагерь
      const cx = CAMP.x - ox, cy = CAMP.y - oy;
      ctx.fillStyle = 'rgba(255,236,190,.45)'; ctx.beginPath(); ctx.arc(cx, cy, CAMP.r, 0, 6.283); ctx.fill();
      ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(160,110,40,.6)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]);
      ctx.drawImage(emo('🏕️', 46), cx - 70, cy - 60); ctx.drawImage(emo('🔥', 30 + Math.round(Math.sin(now / 120) * 2)), cx + 10, cy - 10);
      for (const [lx, ly] of [[-110, 30], [96, 34]]) { const li = SCN('lantern'); if (SCN_OK(li)) ctx.drawImage(li, cx + lx - 22, cy + ly - 62, 44, 61); ctx.fillStyle = `rgba(255,200,90,${.18 + .06 * Math.sin(now / 200 + lx)})`; ctx.beginPath(); ctx.arc(cx + lx, cy + ly - 36, 26, 0, 6.283); ctx.fill(); }
      { const pl = SCN('paperlantern'); if (SCN_OK(pl)) for (const [lx, ly, ph] of [[-40, -78, 0], [36, -84, 1.3]]) { ctx.save(); ctx.translate(cx + lx, cy + ly); ctx.rotate(Math.sin(now / 500 + ph) * .12); ctx.drawImage(pl, -8, 0, 16, 23); ctx.restore(); } }
      // портал босса
      const px = L.portal.x - ox, py = L.portal.y - oy, open = seals() >= SEALS && !boss;
      ctx.save(); ctx.translate(px, py);
      ctx.fillStyle = open ? 'rgba(122,77,201,.35)' : 'rgba(80,80,80,.25)'; ctx.beginPath(); ctx.arc(0, 0, 58, 0, 6.283); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = open ? '#9b6bff' : 'rgba(80,80,80,.6)';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, 0, 22 + k * 14, now / (300 - k * 60) + k, now / (300 - k * 60) + k + 4); ctx.stroke(); }
      ctx.fillStyle = open ? '#fff' : '#555'; ctx.font = '700 26px "Noto Serif SC",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(L.boss.ch, 0, 2);
      ctx.font = '700 13px system-ui, sans-serif'; ctx.fillStyle = open ? '#4b2385' : '#444';
      ctx.fillText(boss ? 'Бой идёт!' : open ? 'Войдите — босс!' : `🔒 ${seals()}/${SEALS} печатей`, 0, 76);
      ctx.restore();
      // украшения
      for (const d of deco) { if (d.tall && d.y > P.y) continue; drawDeco(d, ox, oy, 1); }
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 6; ctx.strokeRect(-ox, -oy, WW, WH);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // лужи кислоты и лавы, огненный дождь
      for (const p of pools) { const k = 1 - p.t / p.dur; ctx.fillStyle = p.el === 'poison' ? `rgba(123,217,58,${.35 * k + .1})` : `rgba(255,110,30,${.35 * k + .1})`; ctx.beginPath(); ctx.ellipse(p.x - ox, p.y - oy, p.r, p.r * .6, 0, 0, 6.283); ctx.fill(); }
      for (const r of rains) { if (r.done) continue; const k = r.t / r.delay; ctx.fillStyle = `rgba(230,60,30,${.15 + .25 * k})`; ctx.beginPath(); ctx.arc(r.x - ox, r.y - oy, r.r, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(230,60,30,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x - ox, r.y - oy, r.r * k, 0, 6.283); ctx.stroke(); }
      // пыль из-под ног
      for (const f of fx) if (f.type === 'dust') { ctx.fillStyle = `rgba(160,140,110,${.35 * (1 - f.t / .5)})`; ctx.beginPath(); ctx.arc(f.x - ox, f.y - oy, f.r * (1 + f.t * 2), 0, 6.283); ctx.fill(); }
      // монеты и сердца
      for (const d of drops) { const im = emo(d.type === 'coin' ? '🪙' : '❤️', d.type === 'coin' ? 18 : 22); ctx.drawImage(im, d.x - ox - im.width / 2, d.y - oy - im.height / 2 + Math.sin(now / 200 + d.x) * 2); }
      // знаки задания
      const glow = (v.mode !== 'hard') || (v.ups.wisdom >= 5 && hintShown);
      for (const b of bubbles) {
        const sx = b.x - ox, sy = b.y - oy;
        if (sx < -60 || sy < -60 || sx > VW + 60 || sy > VH + 60) continue;
        const bob = Math.sin(now / 400 + b.ph) * 4, a = b.dead ? Math.max(0, 1 - b.dead) : b.pop ? Math.max(0, 1 - b.pop) : 1, sc = b.pop ? 1 + b.pop * .5 : 1;
        ctx.save(); ctx.globalAlpha = a; ctx.translate(sx, sy + bob); ctx.scale(sc, sc);
        const lb = b.e.ch, wide = lb.length > 1, cw = wide ? b.r * (lb.length > 2 ? 3.4 : 2.9) : b.r * 2.1, chh = b.r * 2.05, card = SCN(wide ? 'cardw' : 'card');
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, chh / 2 + 8 - bob, cw * .42, 9, 0, 0, 6.283); ctx.fill();
        if (b.ok && glow && v.mode === 'hard' && !b.pop) { ctx.shadowColor = '#ffd34d'; ctx.shadowBlur = 26; }
        if (SCN_OK(card)) ctx.drawImage(b.dead ? tinted(card, 'rgba(220,60,60,.45)') : card, -cw / 2, -chh / 2, cw, chh);
        else { ctx.fillStyle = b.dead ? '#f6c7c7' : '#fffdf6'; ctx.strokeStyle = b.dead ? '#d64545' : '#c9a35b'; ctx.lineWidth = 3; rr(ctx, -cw / 2, -chh / 2, cw, chh, 16); ctx.fill(); ctx.stroke(); }
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#2a2018'; ctx.font = `700 ${lb.length > 2 ? 24 : lb.length === 2 ? 31 : 40}px "Noto Serif SC","Songti SC",serif`;
        ctx.fillText(lb, 0, 3);
        ctx.restore();
      }
      // кляксы и босс
      for (const e of enemies) { const sx = e.x - ox, sy = e.y - oy; if (sx < -120 || sy < -120 || sx > VW + 120 || sy > VH + 120) continue; if (e.isBoss) drawBoss(e, now, sx, sy); else drawBlob(e, now, sx, sy); }
      for (const b of ebul) { ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x - ox, b.y - oy, b.r, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.stroke(); }
      // волны, взмахи, конусы, молнии, луч
      for (const w of waves) { const k = w.t / .45; ctx.strokeStyle = `rgba(${w.col || '242,181,58'},${1 - k})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(w.x - ox, w.y - oy - 20, w.max * k, 0, 6.283); ctx.stroke(); }
      for (const s of slashes) {
        const k = s.t / .22; ctx.strokeStyle = s.col ? s.col : `rgba(30,30,30,${.75 * (1 - k)})`; ctx.globalAlpha = s.col ? .8 * (1 - k) : 1;
        ctx.lineWidth = 12 * (1 - k) + 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(s.x - ox, s.y - oy - 24, s.r * (.6 + .4 * k), s.a - s.arc, s.a + s.arc); ctx.stroke(); ctx.globalAlpha = 1;
      }
      for (const c of cones) {
        const col = c.el === 'fire' ? '255,140,40' : c.el === 'ice' ? '120,210,255' : '123,217,58';
        const g = ctx.createRadialGradient(P.x - ox, P.y - oy - 30, 10, P.x - ox, P.y - oy - 30, c.rg);
        g.addColorStop(0, `rgba(${col},.75)`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(P.x - ox, P.y - oy - 30); ctx.arc(P.x - ox, P.y - oy - 30, c.rg, c.a - c.ang, c.a + c.ang); ctx.closePath(); ctx.fill();
      }
      for (const b of bolts) {
        ctx.strokeStyle = `rgba(140,200,255,${1 - b.t / .18})`; ctx.lineWidth = 4; ctx.beginPath();
        b.pts.forEach((p, i) => { if (!i) { ctx.moveTo(p.x - ox, p.y - oy); return; } const q = b.pts[i - 1]; for (let s = 1; s <= 4; s++) { const k = s / 4; ctx.lineTo(q.x + (p.x - q.x) * k - ox + (s < 4 ? (Math.random() - .5) * 18 : 0), q.y + (p.y - q.y) * k - oy + (s < 4 ? (Math.random() - .5) * 18 : 0)); } });
        ctx.stroke();
      }
      if (beam) {
        const ax = P.x - ox, ay = P.y - 30 - oy, bx = ax + Math.cos(beam.a) * beam.rg, by = ay + Math.sin(beam.a) * beam.rg;
        ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,120,40,.45)'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,180,.95)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      // снаряды героя
      for (const s of shots) {
        const sx = s.x - ox, sy = s.y - oy;
        if (s.kind === 'glyph') { ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#c9a35b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#b3261e'; ctx.font = `700 ${s.txt.length > 1 ? 11 : 17}px "Noto Serif SC",serif`; ctx.fillText(s.txt, sx, sy + 1); }
        else if (s.kind === 'orb') { ctx.shadowColor = s.col; ctx.shadowBlur = 14; ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(sx, sy, 9, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, 6.283); ctx.fill(); }
        else if (s.kind === 'rocket') {
          const a = Math.atan2(s.vy, s.vx);
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
          ctx.fillStyle = s.plasma ? '#c77dff' : '#ff8a30'; ctx.beginPath(); ctx.arc(-14, 0, 6 + Math.random() * 3, 0, 6.283); ctx.fill();
          if (s.plasma) { ctx.shadowColor = '#a35cff'; ctx.shadowBlur = 18; ctx.fillStyle = '#e3c4ff'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; }
          else { ctx.fillStyle = '#556b2f'; rr(ctx, -10, -5, 22, 10, 4); ctx.fill(); ctx.fillStyle = '#d64545'; ctx.beginPath(); ctx.moveTo(12, -5); ctx.lineTo(18, 0); ctx.lineTo(12, 5); ctx.fill(); }
          ctx.restore();
        }
        else if (s.kind === 'bullet') { ctx.strokeStyle = s.col || '#ffe066'; ctx.lineWidth = s.w || 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - s.vx * (s.trail ? .06 : .02), sy - s.vy * (s.trail ? .06 : .02)); ctx.stroke(); }
        else if (s.kind === 'arrow') {
          const a = Math.atan2(s.vy, s.vx);
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
          ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(8, 0); ctx.stroke();
          ctx.fillStyle = s.col || '#ccc'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.fill();
          ctx.strokeStyle = s.col || '#ccc'; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-22, -4); ctx.moveTo(-18, 0); ctx.lineTo(-22, 4); ctx.stroke();
          ctx.restore();
        }
        else if (s.kind === 'boomerang' || s.kind === 'throw') { const im = s.spr ? SPR(s.spr) : null; if (im && im.complete) drawSpr(im, sx, sy, s.kind === 'boomerang' ? 34 : 24, s.kind === 'boomerang' || s.spin ? now / 60 : Math.atan2(s.vy, s.vx) + Math.PI / 2); }
        else if (s.kind === 'grenade') { const im = s.spr ? SPR(s.spr) : null; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(sx, sy + 8, 9, 4, 0, 0, 6.283); ctx.fill(); if (im && im.complete) drawSpr(im, sx, sy - (s.z || 0), s.mini ? 16 : 26, now / 120); }
        else { ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, 6.283); ctx.fill(); }
      }
      // питомцы (подпрыгивают на ходу)
      const lv = heroLvl(v);
      v.pets.forEach((li, i) => {
        const p = trail[Math.min(trail.length - 1, (i + 1) * 16)] || { x: P.x - 30 * (i + 1), y: P.y };
        const im = spriteOf(li, Math.floor((lv - 1) / 6));
        if (im.complete && im.naturalWidth) {
          const hh = 40, ww = hh * im.naturalWidth / im.naturalHeight, hop = P.moving ? Math.abs(Math.sin(P.walk + i)) * 5 : 0, sq = P.moving ? Math.sin((P.walk + i) * 2) * .06 : Math.sin(now / 380 + i) * .03;
          ctx.save(); ctx.translate(p.x - ox, p.y - oy - hop); ctx.scale(1 + sq, 1 - sq); ctx.drawImage(im, -ww / 2, -hh + 6, ww, hh); ctx.restore();
        }
      });
      // высокий декор перед героем: прозрачный, если закрывает героя или знак
      for (const d of deco) {
        if (!d.tall || d.y <= P.y) continue;
        const near = Math.abs(d.x - P.x) < d.w * .5 + 20 && d.y - P.y < d.w * 1.3 || bubbles.some(b => !b.dead && Math.abs(d.x - b.x) < d.w * .5 + 30 && d.y > b.y && d.y - b.y < d.w * 1.3);
        frontDeco.push([d, near ? .5 : 1]);
      }
      for (const f of fx) if (f.type === 'ghost' && v.skin === 'ninja') {
        const m = NJ.dash, im = NIMG('dash'), k = NINJA_K; if (!im.complete || !im.naturalWidth) continue;
        ctx.save(); ctx.globalAlpha = .38 * (1 - f.t / f.life); ctx.translate(f.x - ox, f.y - oy); ctx.scale(f.face * k, k); ctx.drawImage(tinted(im, 'rgba(255,60,40,.5)'), -m.ax, -m.ay, m.w, m.h); ctx.restore();
      }
      drawHero(now, ox, oy, lv);
      for (const [d, a] of frontDeco) drawDeco(d, ox, oy, a);
      frontDeco.length = 0;
      // предметы, вращающиеся вокруг героя
      for (const id of v.eq) {
        const d = AR[id]; if (!d || d.cls !== 'orbit' || !v.wp[id]) continue;
        const s = d.st(v.wp[id]), rad = s.radius * (1 + .08 * v.ups.range), im = wImg(d, 24);
        for (let i = 0; i < s.n; i++) {
          const a = spinA * s.spin + i * 6.283 / s.n, x = P.x - ox + Math.cos(a) * rad, y = P.y - oy - 24 + Math.sin(a) * rad;
          if (id === 'flail') { ctx.strokeStyle = 'rgba(60,60,60,.7)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(P.x - ox, P.y - oy - 30); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]); }
          drawSpr(im, x, y, id === 'orbit' ? 26 : id === 'flail' ? 46 : 40, id === 'sawblade' ? now / 50 : id === 'flail' ? a : 0);
        }
      }
      // стрелка к нужному знаку (режим «Знак на экране»)
      const tb = bubbles.find(b => b.ok && !b.pop && !b.dead);
      if (tb && v.mode !== 'hard' && quest && !quest.done) {
        const a = Math.atan2(tb.y - P.y, tb.x - P.x), d = Math.hypot(tb.x - P.x, tb.y - P.y);
        if (d > 120) {
          const nj = v.skin === 'ninja', ar = nj ? 86 : 70, ax = P.x - ox + Math.cos(a) * ar, ay = P.y - oy - (nj ? 46 : 30) + Math.sin(a) * ar, pul = 1 + Math.sin(now / 150) * .12;
          ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.scale(pul, pul);
          // стрелка: остриё точно в сторону знака (+ хвост), с тенью и обводкой
          ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(24, 3); ctx.lineTo(2, -11); ctx.lineTo(2, -4); ctx.lineTo(-16, -4); ctx.lineTo(-16, 10); ctx.lineTo(2, 10); ctx.lineTo(2, 17); ctx.closePath(); ctx.fill();
          const ag = ctx.createLinearGradient(0, -14, 0, 14); ag.addColorStop(0, '#ffd56a'); ag.addColorStop(1, '#f08a1c');
          ctx.fillStyle = ag; ctx.strokeStyle = '#6b3a00'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(0, -14); ctx.lineTo(0, -6); ctx.lineTo(-18, -6); ctx.lineTo(-18, 6); ctx.lineTo(0, 6); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      }
      // эффекты
      for (const f of fx) {
        if (f.type === 'dust' || f.type === 'ghost') continue;
        const sx = f.x - ox, sy = f.y - oy;
        if (f.type === 'shell' || f.type === 'mag') { ctx.save(); ctx.globalAlpha = Math.min(1, 2 * (1 - f.t / f.life)); ctx.translate(sx, sy); ctx.rotate(f.rot); ctx.fillStyle = f.col; if (f.type === 'shell') ctx.fillRect(-3, -1.5, 6, 3); else { ctx.fillRect(-3, -6, 6, 12); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-3, -6, 2, 12); } ctx.restore(); continue; }
        if (f.type === 'txt') { ctx.globalAlpha = Math.max(0, 1 - f.t / (f.life || 1)); ctx.fillStyle = f.color; ctx.font = '700 20px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.strokeText(f.text, sx, sy - f.t * 40); ctx.fillText(f.text, sx, sy - f.t * 40); }
        else if (f.type === 'num') { ctx.globalAlpha = 1 - f.t / .6; ctx.fillStyle = f.crit ? '#ffd34d' : f.col || '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.font = `700 ${f.crit ? 18 : 14}px system-ui, sans-serif`; ctx.strokeText(f.text, sx, sy - f.t * 50); ctx.fillText(f.text, sx, sy - f.t * 50); }
        else { ctx.globalAlpha = Math.max(0, 1 - f.t); ctx.fillStyle = f.color; ctx.fillRect(sx, sy, 5, 5); }
      }
      ctx.globalAlpha = 1;
      // указатели на знаки и портал за краем экрана
      const edge = (wx, wy, label, col, font) => {
        const sx = wx - ox, sy = wy - oy;
        if (sx > 0 && sy > 0 && sx < VW && sy < VH) return;
        const dx = sx - VW / 2, dy = sy - VH / 2, k = Math.min((VW / 2 - 28) / Math.abs(dx || 1e-6), (VH / 2 - 28) / Math.abs(dy || 1e-6));
        const ix = VW / 2 + dx * k, iy = VH / 2 + dy * k, a = Math.atan2(dy, dx);
        ctx.fillStyle = col; ctx.strokeStyle = '#c9a35b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * 26, iy + Math.sin(a) * 26); ctx.lineTo(ix + Math.cos(a + 2.5) * 18, iy + Math.sin(a + 2.5) * 18); ctx.lineTo(ix + Math.cos(a - 2.5) * 18, iy + Math.sin(a - 2.5) * 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(ix, iy, 18, 0, 6.283); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a2018'; ctx.font = font; ctx.fillText(label, ix, iy + 1);
      };
      for (const b of bubbles) if (!b.dead && !b.pop) edge(b.x, b.y, b.e.ch.slice(0, 3), b.ok && v.mode !== 'hard' ? 'rgba(255,224,130,.97)' : 'rgba(255,253,246,.92)', `700 ${b.e.ch.length > 1 ? 11 : 16}px "Noto Serif SC",serif`);
      if (seals() >= SEALS && !boss) {
        edge(L.portal.x, L.portal.y, '', 'rgba(200,170,255,.95)', '16px serif');
        const sx = L.portal.x - ox, sy = L.portal.y - oy, pi = SCN('portal');
        if (!(sx > 0 && sy > 0 && sx < VW && sy < VH) && SCN_OK(pi)) { const dx = sx - VW / 2, dy = sy - VH / 2, k = Math.min((VW / 2 - 28) / Math.abs(dx || 1e-6), (VH / 2 - 28) / Math.abs(dy || 1e-6)); ctx.save(); ctx.translate(VW / 2 + dx * k, VH / 2 + dy * k); ctx.rotate(now / 600); ctx.drawImage(pi, -20, -20, 40, 40); ctx.restore(); }
      }
      if (boss) edge(boss.x, boss.y, boss.B.ch, 'rgba(255,170,170,.95)', '700 16px "Noto Serif SC",serif');
      // полоски здоровья и опыта
      const mhp = maxHp(v), xl = heroLvl(v), xa = xpAt(xl), xb = xpAt(xl + 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(38,44,34,.82)'; rr(ctx, 8, 8, 222, 52, 12); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.5; ctx.stroke();
      const bar = (x, y, w, h, k, c1, c2, bg) => {
        ctx.fillStyle = bg; rr(ctx, x, y, w, h, h / 2); ctx.fill();
        if (k > 0) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; rr(ctx, x, y, Math.max(h, w * Math.min(1, k)), h, h / 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(ctx, x + 3, y + 2, Math.max(0, w * Math.min(1, k) - 6), h * .3, h * .15); ctx.fill(); }
      };
      const hpk = Math.max(0, v.hp / mhp), lowHp = hpk < .3 && Math.floor(now / 300) % 2;
      bar(16, 14, 206, 18, hpk, lowHp ? '#ff8a8a' : '#ff5a5a', '#d62f2f', '#4a1c1c');
      bar(16, 37, 206, 15, (v.xp - xa) / (xb - xa), '#ffc23d', '#e8920f', '#2a2a22');
      ctx.fillStyle = '#fff'; ctx.font = '800 12px system-ui, sans-serif'; ctx.fillText(`❤ ${Math.ceil(v.hp)} / ${mhp}`, 24, 24); ctx.font = '800 11px system-ui, sans-serif'; ctx.fillText(`Ур. ${xl}`, 24, 45);
      // слоты оружия с перезарядкой
      const iy0 = slotsTop();
      v.eq.forEach((id, i) => {
        const d = AR[id]; if (!d) return;
        const s = d.st(v.wp[id] || 1), x = 12, y = iy0 + i * 38;
        const pulse = firedT[id] ? Math.max(0, 1 - (now - firedT[id]) / 160) : 0, rl = MAG[id] && rlT[id] > 0;
        ctx.fillStyle = rl ? 'rgba(80,60,0,.6)' : 'rgba(38,44,34,.78)'; rr(ctx, x, y, 34, 34, 8); ctx.fill();
        drawSpr(wImg(d, 22), x + 17, y + 17, 26 * (1 + pulse * .18), d.img && (d.cls === 'melee' || d.cat === 'magic') ? .6 : 0);
        const cd = s.cd ? s.cd * (1 - .04 * v.ups.rate) : 0, left = Math.max(0, wt[id] || 0);
        if (rl) { const k = 1 - rlT[id] / rlTime(id); ctx.strokeStyle = '#ffc23d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + 17, y + 17, 15, -Math.PI / 2, -Math.PI / 2 + 6.283 * k); ctx.stroke(); }
        else if (cd > .25 && left > 0) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.moveTo(x + 17, y + 17); ctx.arc(x + 17, y + 17, 17, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.min(1, left / cd)); ctx.closePath(); ctx.fill(); }
        if (MAG[id]) { const n = ammo[id] == null ? MAG[id][0] : ammo[id]; ctx.font = '800 10px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.8)'; const t = rl ? '⟳' : String(n); ctx.strokeText(t, x + 33, y + 31); ctx.fillStyle = rl ? '#ffc23d' : n <= MAG[id][0] * .25 ? '#ff7a7a' : '#fff'; ctx.fillText(t, x + 33, y + 31); ctx.textAlign = 'left'; }
        if (d.el) { ctx.fillStyle = ELEM[d.el].col; ctx.beginPath(); ctx.arc(x + 30, y + 4, 4, 0, 6.283); ctx.fill(); }
      });
      if (sh0()) { const s = sh0(), y = iy0 + v.eq.length * 38; ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, 12, y, 34, 34, 8); ctx.fill(); drawSpr(SPR(s.id), 29, y + 17, 28); }
      ctx.textAlign = 'center';
      drawQuest(now);
      { // кнопка рывка с перезарядкой
        const db = dashBtn(), cd = P.dashCd / 1.3;
        const g = ctx.createRadialGradient(db.x, db.y - 8, 4, db.x, db.y, db.r + 4); g.addColorStop(0, 'rgba(70,82,60,.92)'); g.addColorStop(1, 'rgba(40,48,34,.92)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(db.x, db.y, db.r, 0, 6.283); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3; ctx.stroke();
        if (cd > 0) { ctx.strokeStyle = '#ffc23d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(db.x, db.y, db.r - 2, -Math.PI / 2, -Math.PI / 2 + 6.283 * (1 - cd)); ctx.stroke(); }
        const kr = 13 + (cd > 0 ? 0 : Math.sin(now / 250) * 1.2), kg = ctx.createRadialGradient(db.x - 4, db.y - 8, 2, db.x, db.y - 4, kr);
        kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, cd > 0 ? '#9aa39a' : '#e8ece6');
        ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(db.x, db.y - 4, kr, 0, 6.283); ctx.fill();
        ctx.font = '800 11px system-ui, sans-serif'; ctx.textAlign = 'center'; const lbl = narrow ? 'рывок' : 'пробел', lw = ctx.measureText(lbl).width + 16;
        ctx.fillStyle = 'rgba(30,34,28,.95)'; rr(ctx, db.x - lw / 2, db.y + db.r - 12, lw, 18, 9); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(lbl, db.x, db.y + db.r - 2);
      }
      if (boss) {
        const bw = narrow ? VW - 170 : VW * .5, bx0 = narrow ? 12 : (VW - bw) / 2 - 60, by0 = VH - 40;
        ctx.fillStyle = 'rgba(0,0,0,.6)'; rr(ctx, bx0, by0, bw, 30, 8); ctx.fill();
        ctx.fillStyle = '#3a1020'; ctx.fillRect(bx0 + 6, by0 + 18, bw - 12, 7); ctx.fillStyle = boss.hp < boss.max / 2 ? '#ff3b3b' : '#b35cff'; ctx.fillRect(bx0 + 6, by0 + 18, (bw - 12) * Math.max(0, boss.hp / boss.max), 7);
        ctx.fillStyle = '#fff'; ctx.font = '700 12px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${boss.B.ch}  ${boss.B.name}${boss.hp < boss.max / 2 ? ' · ЯРОСТЬ' : ''}`, bx0 + 8, by0 + 10);
        ctx.textAlign = 'right'; ctx.fillText(`${fmt(Math.max(0, boss.hp))} / ${fmt(boss.max)}`, bx0 + bw - 8, by0 + 10); ctx.textAlign = 'center';
      }
      // мини-карта
      const mm = miniRect(), { mx, my, mw, mh } = mm, z = mmZoom, s = mw / WW * z;
      const vx0 = Math.max(0, Math.min(WW - WW / z, P.x - WW / z / 2)), vy0 = Math.max(0, Math.min(WH - WH / z, P.y - WH / z / 2));
      const MX = x => mx + (x - vx0) * s, MY = y => my + (y - vy0) * s;
      ctx.fillStyle = 'rgba(52,60,44,.9)'; rr(ctx, mx - 8, my - 30, mw + 16, mh + 38, 14); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = `800 ${narrow ? 11 : 12}px system-ui, sans-serif`; ctx.fillText(fit(`${L.ico} ${L.name}`, mw - 4), mx - 1, my - 15); ctx.textAlign = 'center';
      ctx.save(); rr(ctx, mx, my, mw, mh, 8); ctx.clip();
      ctx.fillStyle = 'rgba(28,34,24,.75)'; ctx.fillRect(mx, my, mw, mh);
      ctx.fillStyle = 'rgba(255,236,190,.8)'; ctx.beginPath(); ctx.arc(MX(CAMP.x), MY(CAMP.y), CAMP.r * s + 1, 0, 6.283); ctx.fill();
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(214,69,69,.5)'; ctx.beginPath(); ctx.arc(MX(CAMP.x), MY(CAMP.y), (CAMP.r + 260) * s, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = seals() >= SEALS || boss ? '#b48cff' : 'rgba(180,180,180,.7)'; ctx.beginPath(); ctx.arc(MX(L.portal.x), MY(L.portal.y), 4 + z, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#e04b4b'; for (const e of enemies) { const q = (e.isBoss ? 7 : e.type === 'king' ? 5 : 3) + (z > 1 ? 1 : 0); ctx.fillRect(MX(e.x) - q / 2, MY(e.y) - q / 2, q, q); }
      for (const b of bubbles) if (!b.dead && !b.pop) { ctx.fillStyle = b.ok && v.mode !== 'hard' ? '#ffd34d' : '#fff7d6'; ctx.fillRect(MX(b.x) - 2, MY(b.y) - 2, 4 + (z > 1), 4 + (z > 1)); }
      ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1; ctx.strokeRect(MX(cam.x), MY(cam.y), VW * s, VH * s);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(MX(P.x), MY(P.y), 3.5, 0, 6.283); ctx.fill();
      ctx.restore();
      for (const [lbl, b] of [['+', mm.zin], ['−', mm.zout]]) { ctx.fillStyle = 'rgba(25,28,22,.9)'; rr(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill(); ctx.fillStyle = (lbl === '+' ? z < 3 : z > 1) ? '#fff' : 'rgba(255,255,255,.35)'; ctx.font = '800 16px system-ui, sans-serif'; ctx.fillText(lbl, b.x + b.w / 2, b.y + b.h / 2 + 1); }
      if (ctl.joy.on) {
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ctl.joy.ox, ctl.joy.oy, 46, 0, 6.283); ctx.stroke();
        const jx = ctl.joy.x - ctl.joy.ox, jy = ctl.joy.y - ctl.joy.oy, jd = Math.min(46, Math.hypot(jx, jy)), ja = Math.atan2(jy, jx);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.arc(ctl.joy.ox + Math.cos(ja) * jd, ctl.joy.oy + Math.sin(ja) * jd, 20, 0, 6.283); ctx.fill();
      }
    }
    const sh0 = () => shieldOf(v);

    function frame(ts) {
      if (stop) return;
      const dt = Math.min(.05, (ts - last) / 1000); last = ts;
      if (!document.getElementById('modal').classList.contains('open')) update(dt); else ctl.keys.clear();
      draw(ts);
      saveT += dt; hudT += dt;
      if (hudT > .25) { hudT = 0; hud(); }
      if (saveT > 5) { saveT = 0; v.last = Date.now(); store.save(); }
      raf = requestAnimationFrame(frame);
    }

    /* ====== Арсенал, магазин, карта, герой ====== */
    let arCat = 'all';
    const row = (ico, title, desc, price, can, maxed, onclick, lockText) => h('button.btn.evo-up' + (can && !maxed && !lockText ? '.afford' : ''), { type: 'button', onclick, disabled: maxed || !!lockText },
      h('span.ico', ico), h('span.evo-up-t', h('b', title), h('small.muted', desc)), h('span.evo-up-c', lockText || (maxed ? 'MAX' : '🪙 ' + fmt(price))));
    function buyUp(k, tab) {
      const u = UPS[k], lv = v.ups[k]; if (lv >= u.max) return;
      const c = u.cost(lv); if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c; v.ups[k]++; if (k === 'hp') v.hp += 20;
      ui.sfx('ok'); touchW(); hud(); shop(tab);
    }
    function buyAr(id) {
      const d = AR[id], lv = v.wp[id]; if (lv >= d.max || !arOpen(v, d)) return;
      const c = arCost(d, lv); if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c; v.wp[id]++;
      if (lv === 0) {
        ui.sfx('level'); ui.confetti(50);
        v.eq = [id]; ui.toast(`Новое оружие: ${d.name} — сразу в руках! Q / E — сменить`, 'gold');
      } else ui.sfx('ok');
      touchW(); hud(); shop('arsenal');
    }
    function toggleEq(id) {
      if (v.eq[0] === id) return ui.toast('Это оружие уже в руках');
      takeWeapon(id); shop('arsenal');
    }
    function takeWeapon(id) {
      v.eq = [id]; P.pose = null; ui.sfx('ok'); touchW();
      floatText(P.x, P.y - 120, AR[id].name, '#ffd34d', 1.2);
    }
    // Q / E — предыдущее / следующее купленное оружие
    function cycleWeapon(dir) {
      const own = AR_ORDER.filter(k => v.wp[k] > 0); if (own.length < 2) return;
      const i = own.indexOf(v.eq[0]); takeWeapon(own[(i + dir + own.length) % own.length]);
    }
    function buyShield(id) {
      const d = SHIELDS[id], lv = v.shl[id] || 0; if (lv >= SH_MAX || !arOpen(v, d)) return;
      const c = shCost(d, lv); if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c; v.shl[id] = lv + 1; if (!lv) v.shield = id;
      ui.sfx(lv ? 'ok' : 'level'); touchW(); hud(); shop('shields');
    }
    function buyPet() {
      if (v.pets.length >= PET_MAX) return;
      const c = petCost(v.pets.length); if (v.coins < c) return ui.toast('Не хватает монет');
      v.coins -= c;
      const free = HZ.evo.LINES.map((_, i) => i).filter(i => i !== v.skin && !v.pets.includes(i));
      v.pets.push(free[HZ.rand(free.length)]);
      ui.sfx('level'); ui.confetti(50); touchW(); hud(); shop('eco');
    }
    const icoNode = d => d.img ? h('img.wk-wimg', { src: `img/wpn/${d.img}.webp`, alt: d.name }) : h('span.wk-wico', d.ico);
    function arsenalTab() {
      const cats = h('div.wk-tabs.small', [['all', 'Все'], ...Object.entries(CATS)].map(([k, t]) => h('button.btn.sm' + (k === arCat ? '.primary' : ''), { type: 'button', onclick: () => { arCat = k; shop('arsenal'); } }, t)));
      const cur = AR[v.eq[0]];
      const slotRow = h('div.wk-slots',
        h('div.wk-hand', cur ? h('div.wk-ar-img', icoNode(cur)) : null, h('div', h('b', cur ? `В руках: ${cur.name}` : 'В руках ничего нет'), h('small.muted', cur ? ` · ур. ${v.wp[cur.id]} · ${infoOf(cur, cur.st(v.wp[cur.id]))}` : ''))),
        h('small.muted', `Оружие одно — герой держит его в руках, и оно бьёт в ${SOLO} раза сильнее. «✋ В руки» — сменить; в игре Q / E листают купленное, на компьютере герой целится туда, куда смотрит курсор.`));
      const list = AR_ORDER.filter(id => arCat === 'all' || AR[id].cat === arCat).map(id => {
        const d = AR[id], lv = v.wp[id], open = arOpen(v, d), st = d.st(Math.max(1, lv)), nx = lv && lv < d.max ? d.st(lv + 1) : null, eq = v.eq.includes(id), c = arCost(d, lv);
        return h('div.wk-ar' + (eq ? '.eq' : '') + (open ? '' : '.locked'),
          h('div.wk-ar-img', icoNode(d)),
          h('div.wk-ar-t', h('b', d.name, lv ? h('span.muted', ` · ур. ${lv}/${d.max}`) : null, d.el ? h('span.wk-el', { style: { background: ELEM[d.el].col } }, ELEM[d.el].name.split(':')[0]) : null),
            h('small.muted', open ? (lv ? infoOf(d, st) + (nx ? `  →  ${infoOf(d, nx)}` : '') : infoOf(d, st)) : `🔒 Победите босса «${LOCS[d.unlock].boss.name}»`)),
          h('div.wk-ar-b',
            open && lv < d.max ? h('button.btn.sm' + (v.coins >= c ? '.afford' : ''), { type: 'button', onclick: () => buyAr(id) }, (lv ? '⬆ ' : 'Купить ') + '🪙 ' + fmt(c)) : lv >= d.max ? h('span.chip.sm.done', 'MAX') : null,
            lv ? h('button.btn.sm' + (eq ? '.primary' : ''), { type: 'button', onclick: () => toggleEq(id) }, eq ? '✓ В руках' : '✋ В руки') : null));
      });
      return [slotRow, cats, ...list];
    }
    function shieldsTab() {
      const cur = shieldOf(v);
      return [h('p.muted.small', cur ? `Надет: ${cur.name} (ур. ${cur.lv}) — броня −${Math.round((cur.armor + .02 * (cur.lv - 1)) * 100)}%. Щит не занимает слот оружия.` : 'Щит не занимает слот оружия: даёт броню и особое свойство.'),
        ...Object.keys(SHIELDS).map(id => {
          const d = SHIELDS[id], lv = v.shl[id] || 0, open = arOpen(v, d), on = v.shield === id, c = shCost(d, lv);
          return h('div.wk-ar' + (on ? '.eq' : '') + (open ? '' : '.locked'),
            h('div.wk-ar-img', h('img.wk-wimg', { src: `img/wpn/${id}.webp`, alt: d.name })),
            h('div.wk-ar-t', h('b', d.name, lv ? h('span.muted', ` · ур. ${lv}/${SH_MAX}`) : null), h('small.muted', open ? `Броня −${Math.round((d.armor + .02 * Math.max(0, lv - 1)) * 100)}% · ${d.desc}` : `🔒 Победите босса «${LOCS[d.unlock].boss.name}»`)),
            h('div.wk-ar-b',
              open && lv < SH_MAX ? h('button.btn.sm' + (v.coins >= c ? '.afford' : ''), { type: 'button', onclick: () => buyShield(id) }, (lv ? '⬆ ' : 'Купить ') + '🪙 ' + fmt(c)) : lv >= SH_MAX ? h('span.chip.sm.done', 'MAX') : null,
              lv ? h('button.btn.sm' + (on ? '.primary' : ''), { type: 'button', onclick: () => { v.shield = on ? null : id; touchW(); shop('shields'); } }, on ? '✓ Надет' : 'Надеть') : null));
        })];
    }
    function shop(tab) {
      const tabs = h('div.wk-tabs', [['arsenal', '⚔️ Арсенал'], ['shields', '🛡️ Щиты'], ['mods', '🔧 Модули'], ['hero', '🧍 Герой'], ['eco', '🌾 Хозяйство']].map(([k, t]) => h('button.btn.sm' + (k === tab ? '.primary' : ''), { type: 'button', onclick: () => shop(k) }, t)));
      let rows;
      if (tab === 'arsenal') rows = arsenalTab();
      else if (tab === 'shields') rows = shieldsTab();
      else {
        rows = Object.keys(UPS).filter(k => UPS[k].tab === tab).map(k => { const u = UPS[k], lv = v.ups[k]; return row(u.ico, `${u.name} · ур. ${lv}`, u.desc(lv), u.cost(lv), v.coins >= u.cost(lv), lv >= u.max, () => buyUp(k, tab)); });
        if (tab === 'eco') { const pc = petCost(v.pets.length), full = v.pets.length >= PET_MAX; rows.push(row('🐾', `Питомцы · ${v.pets.length}/${PET_MAX}`, 'Бегут за героем, стреляют по кляксам и приносят +2,5 🪙/с каждый', pc, v.coins >= pc, full, buyPet)); }
      }
      const lv = heroLvl(v);
      const stats = h('p.muted.small', `Герой: ур. ${lv}, здоровье ${maxHp(v)}, броня −${Math.round((1 - armorMul(v)) * 100)}%, урон ×${(dmgMul() * SOLO).toFixed(1)}. Клякс побеждено: ${v.kills}, боссов: ${v.bossKills.reduce((a, b) => a + b, 0)}.`);
      const scrollY = (document.querySelector('#modal .modal-body') || {}).scrollTop || 0;
      ui.modal('🛒 Арсенал и магазин · 🪙 ' + fmt(v.coins), h('div.evo-ups', tabs, stats, ...rows), [{ label: 'Закрыть', primary: true }]);
      const mb = document.querySelector('#modal .modal-body'); if (mb && scrollY) mb.scrollTop = scrollY;
    }
    function mapDialog() {
      const lv = heroLvl(v);
      ui.modal('🗺️ Карта локаций', h('div.wk-locs', LOCS.map((l, i) => {
        const open = locOpen(v, i), cur = i === v.loc;
        if (open && i > v.maxLoc) v.maxLoc = i;
        const bk = v.bossKills[i];
        return h('button.wk-loc' + (cur ? '.on' : '') + (open ? '' : '.locked'), { type: 'button', disabled: !open, onclick: () => { document.getElementById('modal').classList.remove('open'); if (!cur) travel(i); } },
          h('span.wk-loc-ico', l.ico),
          h('span.wk-loc-t', h('b', l.name), h('small.muted', open ? `Босс: ${l.boss.ch} ${l.boss.name}${bk ? ` · побеждён ×${bk}` : ''} · кляксы ×${l.mul} · монеты ×${l.coin}` : `Откроется: победите босса «${LOCS[i - 1].boss.name}» или достигните ${l.req} уровня (сейчас ${lv})`)),
          h('span.chip.sm' + (cur ? '.done' : ''), cur ? 'вы здесь' : open ? 'отправиться' : '🔒'));
      })), [{ label: 'Закрыть' }]);
    }
    function heroPicker() {
      const lv = heroLvl(v);
      const pick = i => { v.skin = i; v.pets = v.pets.filter(p => p !== i); touchW(); document.getElementById('modal').classList.remove('open'); };
      const ninja = h('button.wk-hero.wk-ninja' + (v.skin === 'ninja' ? '.on' : ''), { type: 'button', onclick: () => pick('ninja') },
        h('img', { src: 'img/hero/ninja-main.webp', alt: 'Странник' }), h('span', h('b', '侠 Странник'), h('small.muted', 'Анимированный герой: шаги, рывок 💨, удары мечом, копьём и ногой, медитация в лагере')));
      const grid = h('div.wk-heroes', HZ.evo.LINES.map((Ln, i) => h('button.wk-hero' + (v.skin === i ? '.on' : ''), { type: 'button', onclick: () => pick(i) },
        h('img.evo-sprite', { src: `img/evo/${Ln[0]}-${Math.min(Ln[2] - 1, Math.floor((lv - 1) / 4))}.webp`, alt: Ln[1] }), h('small', Ln[1]))));
      ui.modal('Выберите героя', h('div.wk-pick', ninja, h('p.muted.small', 'Или существо из «Эволюции» — оно растёт с уровнем: каждые 4 уровня — новая стадия.'), grid), [{ label: 'Закрыть' }]);
    }

    canvas._dbg = () => ({ P, enemies, bubbles, quest, v, drops, cam, boss, ebul, shots, pools, spawn: spawnEnemy, travel, startBoss, newRound, qBtn, ammo, reloading: Object.keys(rlT).some(k => rlT[k] > 0), mini: miniRect, zoom: () => mmZoom });
    newRound(); hud();
    raf = requestAnimationFrame(frame);
    canvas.focus();
  }

  HZ.valley = { view, LOCS, AR, SHIELDS };
})();
