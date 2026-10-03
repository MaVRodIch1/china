/* Облачная синхронизация прогресса через Supabase (необязательная).
 * Вход по ссылке из письма (magic link). Слияние: по каждой карточке побеждает более свежая. */
(function () {
  'use strict';
  const HZ = window.HZ, store = HZ.store;
  const cfg = HZ.config || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const listeners = [];
  let client = null, user = null, status = enabled ? 'idle' : 'off', lastSync = null, pushTimer = null, busy = false, error = '';

  const set = (s, err) => { status = s; error = err || ''; listeners.forEach(f => f()); };

  /** Слияние двух состояний (чистая функция — легко тестировать). */
  function merge(a, b) {
    const out = JSON.parse(JSON.stringify(a));
    // карточки: свежая по last (или по времени введения)
    Object.keys(b.cards || {}).forEach(ch => {
      const x = out.cards[ch], y = b.cards[ch];
      if (!x) { out.cards[ch] = y; return; }
      const tx = Math.max(x.last || 0, x.intro || 0), ty = Math.max(y.last || 0, y.intro || 0);
      if (ty > tx) out.cards[ch] = y;
    });
    Object.keys(b.notes || {}).forEach(ch => {
      const x = out.notes[ch], y = b.notes[ch];
      if (!x) out.notes[ch] = y;
      else { if (!x.assoc && y.assoc) x.assoc = y.assoc; if (!x.note && y.note) x.note = y.note; }
    });
    (b.collections || []).forEach(c => {
      const x = out.collections.find(k => k.id === c.id);
      if (!x) out.collections.push(c);
      else { c.chars.forEach(ch => { if (!x.chars.includes(ch)) x.chars.push(ch); }); (c.words || []).forEach(k => { x.words = x.words || []; if (!x.words.includes(k)) x.words.push(k); }); }
    });
    out.xp = Math.max(a.xp || 0, b.xp || 0);
    out.ach = Object.assign({}, b.ach, a.ach);
    Object.keys(b.ach || {}).forEach(k => { if (a.ach[k]) out.ach[k] = Math.min(a.ach[k], b.ach[k]); });
    const sa = a.streak || {}, sb = b.streak || {};
    const newer = (sb.last || '') > (sa.last || '') ? sb : sa;
    out.streak = { count: newer.count || 0, last: newer.last || null, best: Math.max(sa.best || 0, sb.best || 0) };
    Object.keys(b.log || {}).forEach(d => {
      const x = out.log[d], y = b.log[d];
      if (!x) out.log[d] = y; else Object.keys(y).forEach(k => { x[k] = Math.max(x[k] || 0, y[k] || 0); });
    });
    if (!out.quests || (b.quests && b.quests.date > (out.quests.date || ''))) out.quests = b.quests || {};
    out.best = Object.assign({}, b.best);
    Object.keys(a.best || {}).forEach(k => { out.best[k] = Math.max(a.best[k] || 0, (b.best || {})[k] || 0); });
    out.flags = Object.assign({}, b.flags, a.flags);
    out.myWords = Object.assign({}, a.myWords);
    Object.keys(b.myWords || {}).forEach(k => { const x = out.myWords[k], y = b.myWords[k]; if (!x || (y.t || 0) > (x.t || 0)) out.myWords[k] = y; });
    out.texts = Object.assign({}, b.texts);
    Object.keys(a.texts || {}).forEach(id => { const x = a.texts[id], y = (b.texts || {})[id]; out.texts[id] = y ? { done: Math.min(x.done, y.done), best: Math.max(x.best, y.best), n: Math.max(x.n, y.n) } : x; });
    if (b.walk && (!a.walk || (b.walk.upd || 0) > (a.walk.upd || 0))) out.walk = b.walk; // «Долина знаков»: побеждает более свежее состояние
    if (b.evo && (!a.evo || (b.evo.upd || 0) > (a.evo.upd || 0))) out.evo = b.evo; // игра «Эволюция»: побеждает более свежее состояние
    return out;
  }

  async function loadLib() {
    if (window.supabase) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      s.onload = res; s.onerror = () => rej(new Error('Не удалось загрузить библиотеку Supabase (нет интернета?)'));
      document.head.appendChild(s);
    });
  }

  async function pull() {
    const { data, error: e } = await client.from('progress').select('data').eq('user_id', user.id).maybeSingle();
    if (e) throw e;
    if (data && data.data) {
      const merged = merge(store.s, data.data);
      merged.settings = store.s.settings; // настройки устройства остаются локальными
      store.replace(merged);
      if (HZ.applyMyWords) HZ.applyMyWords();
    }
  }
  async function push() {
    const payload = JSON.parse(JSON.stringify(store.s));
    const { error: e } = await client.from('progress').upsert({ user_id: user.id, data: payload, updated_at: new Date().toISOString() });
    if (e) throw e;
  }

  async function syncNow() {
    if (!client || !user || busy) return;
    busy = true; set('syncing');
    try { await pull(); await push(); lastSync = Date.now(); set('ok'); if (HZ.gami) HZ.gami.refreshHeader(); }
    catch (e) { set('error', e.message || String(e)); }
    finally { busy = false; }
  }

  function schedulePush() {
    if (!client || !user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      if (busy) return schedulePush();
      busy = true;
      try { await push(); lastSync = Date.now(); set('ok'); } catch (e) { set('error', e.message || String(e)); } finally { busy = false; }
    }, 3000);
  }

  async function init() {
    if (!enabled) return;
    try {
      await loadLib();
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } });
      const { data } = await client.auth.getSession();
      user = data.session ? data.session.user : null;
      client.auth.onAuthStateChange((ev, session) => {
        const was = user; user = session ? session.user : null;
        if (user && (!was || was.id !== user.id)) syncNow(); else set(user ? 'ok' : 'idle');
      });
      store.onSave(schedulePush);
      window.addEventListener('online', () => user && syncNow());
      if (user) syncNow(); else set('idle');
    } catch (e) { set('error', e.message || String(e)); }
  }

  async function signIn(email) {
    if (!client) await init();
    if (!client) throw new Error(error || 'Облако недоступно');
    const { error: e } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (e) throw e;
  }
  async function signOut() { if (client) await client.auth.signOut(); user = null; set('idle'); }
  /** Удалить облачную копию (при сбросе прогресса). */
  async function wipe() { if (client && user) { try { await client.from('progress').delete().eq('user_id', user.id); } catch (e) { /* ignore */ } } }

  HZ.sync = {
    enabled, merge, init, signIn, signOut, syncNow, wipe,
    get user() { return user; }, get status() { return status; }, get error() { return error; }, get lastSync() { return lastSync; },
    onChange(f) { listeners.push(f); }
  };
})();
