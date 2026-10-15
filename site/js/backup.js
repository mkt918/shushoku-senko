'use strict';
/* ============================================================
   自動バックアップ
   - 「設定」でバックアップ用のフォルダを一度だけ選ぶ（ハンドルはブラウザ内の IndexedDB に保存）
   - 上書き保存・名前を付けて保存のたびに、日時入りのコピーをそのフォルダに書く（10分に1回まで）
   - 古いものから消して、最新の30個を残す。暗号化の設定があれば、コピーも暗号化される
   Edge / Chrome の File System Access API が必要。使えない環境では設定に出ない
   ============================================================ */

const Backup = {
  KEY: 'backupDir',
  KEEP: 30,                 // 残す数
  GAP: 10 * 60 * 1000,      // 次のバックアップまでの最短の間隔（ミリ秒）
  lastAt: 0,                // このセッションで最後に書いた時刻
  lastName: '',
  hinted: false,            // 「フォルダを決めると自動バックアップ」の案内を出したか

  supported() { return typeof window.showDirectoryPicker === 'function' && typeof indexedDB !== 'undefined'; },

  async _get() {
    try {
      const db = await Watch._db();
      return await new Promise((res, rej) => { const q = db.transaction('handles').objectStore('handles').get(this.KEY); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
    } catch (e) { return null; }
  },
  async _put(h) {
    const db = await Watch._db();
    await new Promise((res, rej) => { const t = db.transaction('handles', 'readwrite'); t.objectStore('handles').put(h, this.KEY); t.oncomplete = res; t.onerror = () => rej(t.error); });
  },
  async forget() {
    try { const db = await Watch._db(); await new Promise(res => { const t = db.transaction('handles', 'readwrite'); t.objectStore('handles').delete(this.KEY); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* 何もしない */ }
  },
  folder() { return this._get(); },

  /** フォルダを選ぶ（ボタンの操作の中で呼ぶ） */
  async choose() {
    const h = await window.showDirectoryPicker({ id: 'shushoku-backup', mode: 'readwrite' });
    await this._put(h);
    this.lastAt = 0;
    return h;
  },

  /** 書き込みの許可。ask＝許可を求める（ボタンの操作の直後でないと失敗することがある） */
  async allowed(h, ask) {
    try {
      let p = await h.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted' && ask) p = await h.requestPermission({ mode: 'readwrite' });
      return p === 'granted';
    } catch (e) { return false; }
  },

  stamp(d = new Date()) {
    const z = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  },

  /**
   * 保存したあとに呼ぶ。body＝ファイルに書いた中身、fileName＝保存したファイル名。
   * force＝間隔に関係なく書く（設定の［今すぐバックアップ］）
   */
  async after(body, fileName, force = false) {
    if (!this.supported()) return null;
    const h = await this.folder();
    if (!h) {
      if (!this.hinted) { this.hinted = true; UI.toast('「設定」で自動バックアップのフォルダを決めると、保存のたびに日時入りのコピーが残ります', 'warn'); }
      return null;
    }
    if (!force && Date.now() - this.lastAt < this.GAP) return null;
    if (!await this.allowed(h, true)) { UI.toast('バックアップのフォルダに書き込めませんでした。「設定」の自動バックアップで、フォルダを選び直してください', 'warn'); return null; }
    const base = String(fileName || Store.defaultFileName()).replace(/\.json$/i, '');
    const name = `${base}_バックアップ_${this.stamp()}.json`;
    try {
      const fh = await h.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(body);
      await w.close();
      this.lastAt = Date.now();
      this.lastName = name;
      await this.prune(h, base);
      return name;
    } catch (e) {
      console.warn('バックアップに失敗', e);
      UI.toast('バックアップに失敗しました（' + (e.message || e.name) + '）', 'warn');
      return null;
    }
  },

  /** 同じ名前のバックアップを、新しい順に KEEP 個だけ残す */
  async prune(h, base) {
    const list = [];
    for await (const [n, e] of h.entries()) if (e.kind === 'file' && n.startsWith(base + '_バックアップ_') && n.endsWith('.json')) list.push(n);
    list.sort().reverse();
    for (const n of list.slice(this.KEEP)) { try { await h.removeEntry(n); } catch (e) { /* 消せなくても続ける */ } }
  },

  /** フォルダの中のバックアップの数（設定の表示用） */
  async count(h) {
    let n = 0;
    try { for await (const [name, e] of h.entries()) if (e.kind === 'file' && name.includes('_バックアップ_')) n++; } catch (e) { return null; }
    return n;
  },
};
