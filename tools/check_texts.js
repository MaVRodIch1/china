// Проверка текстов для чтения: все иероглифы должны быть не выше уровня текста. Запуск: node tools/check_texts.js
const fs = require('fs'), path = require('path');
global.window = global;
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
new Function('window', ['js/core.js', 'js/data/hsk-starter.js', 'js/data/hsk3-chars.js', 'js/data/hsk-words.js'].map(R).join('\n;'))(global);
const HZ = window.HZ;
const txt = R('tools/content/texts.txt').split('\n');
let cur = null, bad = 0, nt = 0, ns = 0;
const HAN = /[一-鿿]/;
for (const [i, l] of txt.entries()) {
  if (l.startsWith('===')) { const a = l.slice(3).split('|').map(x => x.trim()); cur = { id: a[0], lvl: +a[1], max: 0 }; nt++; continue; }
  if (!cur || !l.trim() || l.startsWith('#') || l.startsWith('?')) continue;
  const [zh, ru] = l.split('\t'); ns++;
  if (!ru) { console.log('NO RU', cur.id, i + 1, zh); bad++; continue; }
  for (const c of zh) if (HAN.test(c)) {
    const e = HZ.byChar[c];
    if (!e) { console.log(`${cur.id} L${cur.lvl} line ${i + 1}: «${c}» нет в базе — ${zh}`); bad++; }
    else if (e.h > cur.lvl) { console.log(`${cur.id} L${cur.lvl} line ${i + 1}: «${c}» уровень ${e.h} — ${zh}`); bad++; }
  }
}
console.log(`texts ${nt}, sentences ${ns}, problems ${bad}`);
