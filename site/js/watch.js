'use strict';
/* ============================================================
   取り込みフォルダ（Handy の求人票 CSV など、ダウンロードした CSV を置くフォルダ）
   - フォルダは一度だけ指定する（ハンドルはブラウザ内の IndexedDB に保存。ファイルの内容は保存しない）
   - 新しい CSV（取り込み済みの記録にないもの）を見つけて、取り込みダイアログに渡す
   - ブラウザの仕様で、権限の確認には画面の操作（ボタン）が要る。許可が残っていれば画面を開いただけで見つかる
   Edge / Chrome の File System Access API が必要。使えない環境ではこの機能を隠す
   ============================================================ */

const Watch = {
  KEY: 'importDir',
  supported() { return typeof window.showDirectoryPicker === 'function' && typeof indexedDB !== 'undefined'; },

  /* ---------- フォルダのハンドルの保存（IndexedDB） ---------- */
  _db() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('shushoku-senko', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('handles');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async _get() {
    try {
      const db = await this._db();
      return await new Promise((res, rej) => { const q = db.transaction('handles').objectStore('handles').get(this.KEY); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
    } catch (e) { return null; }
  },
  async _put(h) {
    const db = await this._db();
    await new Promise((res, rej) => { const t = db.transaction('handles', 'readwrite'); t.objectStore('handles').put(h, this.KEY); t.oncomplete = res; t.onerror = () => rej(t.error); });
  },
  async _del() {
    try { const db = await this._db(); await new Promise(res => { const t = db.transaction('handles', 'readwrite'); t.objectStore('handles').delete(this.KEY); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* 何もしない */ }
  },

  /** 指定済みのフォルダ（なければ null） */
  folder() { return this._get(); },

  /** フォルダを選んで保存する（画面の操作の中で呼ぶ） */
  async choose() {
    const h = await window.showDirectoryPicker({ id: 'handy-csv', mode: 'read' });
    await this._put(h);
    return h;
  },
  async forget() { await this._del(); },

  /** 権限の状態：'granted' | 'prompt' | 'denied' */
  async permission(h) {
    try { return await h.queryPermission({ mode: 'read' }); } catch (e) { return 'denied'; }
  },
  /** 権限を求める（ボタンを押した操作の中で呼ぶ） */
  async ask(h) {
    try { return (await h.requestPermission({ mode: 'read' })) === 'granted'; } catch (e) { return false; }
  },

  /* ---------- 取り込み済みの記録（データファイルに保存） ---------- */
  sig(file) { return `${file.name}|${file.size}|${file.lastModified}`; },
  done(file) { return Store.data.imports.some(x => x.sig === this.sig(file)); },
  mark(file, type) {
    Store.data.imports.push({ sig: this.sig(file), name: file.name, at: new Date().toISOString(), type });
    if (Store.data.imports.length > 200) Store.data.imports = Store.data.imports.slice(-200);
    Store.changed();
  },

  /** フォルダ内の、まだ取り込んでいない CSV（新しい順）。権限がなければ null */
  async scan(h) {
    const found = [];
    for await (const [name, entry] of h.entries()) {
      if (entry.kind !== 'file' || !/\.(csv|xlsx|xlsm)$/i.test(name) || name.startsWith('~$')) continue;
      const file = await entry.getFile();
      if (!this.done(file)) found.push(file);
    }
    return found.sort((a, b) => b.lastModified - a.lastModified);
  },

  /** 画面に出す案内のHTML用の状態を調べる */
  async status() {
    if (!this.supported()) return { state: 'unsupported' };
    const h = await this.folder();
    if (!h) return { state: 'none' };
    const perm = await this.permission(h);
    if (perm !== 'granted') return { state: 'locked', handle: h };
    try { return { state: 'ready', handle: h, files: await this.scan(h) }; }
    catch (e) { return { state: 'locked', handle: h }; }
  },
};

/** 求人票ページの上に出す「取り込みフォルダ」の帯 */
const WatchBar = {
  html(st) {
    if (st.state === 'unsupported') return '';
    const btn = (id, label, kind = '') => `<button class="btn btn-sm ${kind}" id="${id}">${label}</button>`;
    let msg, acts;
    if (st.state === 'none') {
      msg = '<b>取り込みフォルダ</b>　Handy からダウンロードした求人票の CSV を置くフォルダを指定すると、新しいファイルを見つけて取り込めます。';
      acts = btn('wbChoose', 'フォルダを指定する', 'btn-primary');
    } else if (st.state === 'locked') {
      msg = `<b>取り込みフォルダ：${esc(st.handle.name)}</b>　新しい CSV があるか確認します（ブラウザの許可が必要です）。`;
      acts = btn('wbCheck', '新しい CSV を確認', 'btn-primary') + btn('wbChoose', 'フォルダを変える') + btn('wbForget', '解除');
    } else if (st.files.length) {
      msg = `<b>新しい CSV が ${st.files.length} 件あります</b>　（${esc(st.handle.name)}）${st.files.slice(0, 3).map(f => `<span class="tag">${esc(f.name)}</span>`).join(' ')}`;
      acts = btn('wbImport', '取り込む', 'btn-primary') + btn('wbSkip', '取り込まない（確認済みにする）') + btn('wbChoose', 'フォルダを変える');
    } else {
      msg = `<b>取り込みフォルダ：${esc(st.handle.name)}</b>　新しい CSV はありません。`;
      acts = btn('wbRescan', '再確認') + btn('wbChoose', 'フォルダを変える') + btn('wbForget', '解除');
    }
    return `<div class="notice ${st.state === 'ready' && st.files.length ? 'notice-info' : ''} watchbar"><div>${msg}</div><div class="btn-row">${acts}</div></div>`;
  },

  async mount(el, onChange) {
    const st = await Watch.status();
    el.innerHTML = this.html(st);
    const on = (id, fn) => { const b = $('#' + id, el); if (b) b.addEventListener('click', async () => { try { await fn(); } catch (e) { if (e.name !== 'AbortError') UI.toast(e.message || '失敗しました', 'error'); } }); };
    on('wbChoose', async () => { const h = await Watch.choose(); await Watch.ask(h); this.mount(el, onChange); });
    on('wbForget', async () => { await Watch.forget(); this.mount(el, onChange); });
    on('wbRescan', () => this.mount(el, onChange));
    on('wbCheck', async () => { if (await Watch.ask(st.handle)) this.mount(el, onChange); else UI.toast('許可されませんでした', 'warn'); });
    on('wbSkip', async () => { st.files.forEach(f => Watch.mark(f, 'skipped')); this.mount(el, onChange); });
    on('wbImport', async () => {
      // 古い順に1件ずつ取り込む（同じ求人は求人番号で更新されるので、新しいものが最後に反映される）
      for (const f of st.files.slice().reverse()) {
        const wb = await Excel.readFile(f);
        const ok = await Importer.run('handy', wb, f);
        if (!ok) break;
      }
      this.mount(el, onChange);
      if (onChange) onChange();
    });
  },
};
