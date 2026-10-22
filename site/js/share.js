'use strict';
/* ============================================================
   共有（みんなが同じ最新のデータを見る）
   - 編集する人：「設定」で公開フォルダ（SharePoint の同期フォルダの中の site）を一度だけ選ぶ。
     以後、上書き保存のたびに、そのフォルダへ shared-data.js を書く（暗号化の設定があれば暗号化したまま）。
     SharePoint（OneDrive の同期）が、それをほかの人のパソコンへ運ぶ。
   - 見る人：同じフォルダの「閲覧.html」をダブルクリックするだけ（index.html?view=1 が開く）。
     shared-data.js を <script> で読み込み（file:// でも動く）、30秒ごとに新しくなっていないか確かめて、画面を更新する。
     閲覧専用：データは書き換えられない（変更しても元に戻す）。このブラウザの一時保存も使わない。
   - 暗号化されているときは、閲覧する人は最初の1回だけパスワードを入れる（鍵は、このブラウザの IndexedDB に覚える）
   ============================================================ */

const Share = {
  DIR_KEY: 'shareDir',
  KEY_KEY: 'shareKey',
  FILE: 'shared-data.js',
  POLL: 30 * 1000,                 // 閲覧側が新しさを確かめる間隔（ミリ秒）
  viewer: /[?&]view=1(&|$)/.test(location.search),
  savedAt: '',                     // 閲覧側：いま見ているデータが公開された時刻
  lastAt: '',                      // 編集側：このセッションで最後に公開した時刻
  _text: '',                       // 閲覧側：いま見ているデータ（元に戻す用）
  _timer: null,
  _busy: false,
  _warnAt: 0,

  supported() { return Backup.supported(); },

  /* ---------------- 編集する人 ---------------- */

  async _get(key) {
    try {
      const db = await Watch._db();
      return await new Promise((res, rej) => { const q = db.transaction('handles').objectStore('handles').get(key); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
    } catch (e) { return null; }
  },
  async _put(key, v) {
    const db = await Watch._db();
    await new Promise((res, rej) => { const t = db.transaction('handles', 'readwrite'); t.objectStore('handles').put(v, key); t.oncomplete = res; t.onerror = () => rej(t.error); });
  },
  async _del(key) {
    try { const db = await Watch._db(); await new Promise(res => { const t = db.transaction('handles', 'readwrite'); t.objectStore('handles').delete(key); t.oncomplete = res; t.onerror = res; }); } catch (e) { /* 何もしない */ }
  },
  folder() { return this._get(this.DIR_KEY); },
  forget() { return this._del(this.DIR_KEY); },

  /** 公開フォルダを選ぶ（ボタンの操作の中で呼ぶ）。index.html のないフォルダなら、warn に true を返す */
  async choose() {
    const h = await window.showDirectoryPicker({ id: 'shushoku-share', mode: 'readwrite' });
    await this._put(this.DIR_KEY, h);
    let hasApp = true;
    try { await h.getFileHandle('index.html'); } catch (e) { hasApp = false; }
    return { handle: h, hasApp };
  },

  /** 公開した最後の時刻（フォルダの中のファイルから。許可がないとき、ファイルがないときは null） */
  async publishedAt(h) {
    try {
      if (!await Backup.allowed(h, false)) return null;
      const f = await (await h.getFileHandle(this.FILE)).getFile();
      return new Date(f.lastModified);
    } catch (e) { return null; }
  },

  /** 保存したあとに呼ぶ。body＝保存した中身（JSON の文字列）。公開フォルダが決まっていなければ何もしない */
  async after(body, ask = true) {
    if (Store.readOnly || !this.supported()) return null;
    const h = await this.folder();
    if (!h) return null;
    if (!await Backup.allowed(h, ask)) { UI.toast('共有フォルダに書き込めませんでした。「設定」の共有で、フォルダを選び直してください', 'warn'); return null; }
    const at = new Date().toISOString();
    // body は JSON なので、そのまま JavaScript の式として埋め込める
    const text = `/* 就職選考 統合管理：共有データ（閲覧用）。編集しないでください */\nwindow.SHARED_DATA={"savedAt":${JSON.stringify(at)},"payload":${body}};\n`;
    try {
      const fh = await h.getFileHandle(this.FILE, { create: true });
      const w = await fh.createWritable();
      await w.write(text);
      await w.close();
      this.lastAt = at;
      UI.toast('共有フォルダに公開しました');
      return at;
    } catch (e) {
      console.warn('共有フォルダへの公開に失敗', e);
      UI.toast('共有フォルダへの公開に失敗しました（' + (e.message || e.name) + '）', 'warn');
      return null;
    }
  },

  /* ---------------- 見る人 ---------------- */

  /** shared-data.js を読み込み直す（キャッシュを避けるため、毎回違う URL にする）。なければ null */
  _load() {
    return new Promise(resolve => {
      try { delete window.SHARED_DATA; } catch (e) { window.SHARED_DATA = undefined; }
      const s = document.createElement('script');
      s.src = this.FILE + '?t=' + Date.now();
      s.onload = () => { s.remove(); resolve(window.SHARED_DATA || null); };
      s.onerror = () => { s.remove(); resolve(null); };
      document.head.appendChild(s);
    });
  },

  /** 公開されたデータを開く（暗号化されていれば、覚えた鍵 → パスワードの順）。取り消したら null */
  async _open(sh) {
    const p = sh.payload;
    if (!Crypt.isEnc(p)) return p;
    if (!Crypt.ok()) throw new Error('このブラウザでは、暗号化したデータを開けません（Edge／Chrome の新しい版を使ってください）。');
    const c = await this._get(this.KEY_KEY);
    if (c && c.salt === p.salt) { try { return await Crypt.openWith(p, c); } catch (e) { /* パスワードが変わった。聞き直す */ } }
    for (;;) {
      const pass = await UI.askPassword({ title: '共有データのパスワード', message: '共有データは暗号化されています。\n編集を担当している人から聞いたパスワードを入れてください（このブラウザでは最初の1回だけです）。' });
      if (pass == null) return null;
      try {
        const r = await Crypt.open(p, pass);
        try { await this._put(this.KEY_KEY, r.c); } catch (e) { /* 覚えられなくても、この回は見られる */ }
        return r.data;
      } catch (e) { UI.toast('パスワードが違います', 'warn'); }
    }
  },

  _stamp(iso) {
    const d = new Date(iso), z = n => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${z(d.getHours())}:${z(d.getMinutes())}`;
  },

  _bar() {
    $('#fileName').textContent = '共有データ（閲覧専用）';
    const st = $('#saveState');
    st.textContent = this.savedAt ? `最終更新 ${this._stamp(this.savedAt)}（自動で更新されます）` : 'まだ公開されていません';
    st.className = 'save-state is-clean';
  },

  _empty() {
    $('#view').innerHTML = `<div class="empty"><p class="empty-title">共有データがまだありません</p>
      <p>編集を担当している人が、「設定」で共有フォルダを決めて［上書き保存］をすると、ここに自動で表示されます。<br>この画面は開いたままで大丈夫です（${this.POLL / 1000}秒ごとに確かめます）。</p></div>`;
  },

  /** 閲覧モードの起動（app.js から）。最初のデータが読めたら画面を出し、あとは定期的に確かめる */
  async boot() {
    document.body.classList.add('view-only');
    document.title = '閲覧｜就職選考 統合管理';
    this._bar();
    try {
      const sh = await this._load();
      if (sh) await this._apply(sh, true); else this._empty();
    } catch (e) { console.error(e); UI.toast(e.message || '共有データを読み込めませんでした', 'error'); this._empty(); }
    this._timer = setInterval(() => this.check(), this.POLL);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.check(); });
  },

  async _apply(sh, first) {
    const data = await this._open(sh);
    if (!data) { if (first) this._empty(); return false; }
    this._text = JSON.stringify(data);
    this.savedAt = sh.savedAt;
    Store.replace(JSON.parse(this._text), '共有データ');
    this._bar();
    if (first) UI.route(); else UI.refresh();
    return true;
  },

  /** 新しくなっていれば読み込み直す */
  async check() {
    if (this._busy || document.hidden) return;
    if ($('#modalRoot').children.length) return;       // ダイアログを開いている間は、画面を入れ替えない
    this._busy = true;
    try {
      const sh = await this._load();
      if (sh && sh.savedAt !== this.savedAt) {
        const first = !this.savedAt;
        if (await this._apply(sh, first) && !first) UI.toast('最新のデータに更新しました');
      }
    } catch (e) { console.warn('共有データの更新に失敗', e); }
    finally { this._busy = false; }
  },

  /** 閲覧専用のときに、データを書き換える操作があった（Store.changed から）。元に戻す */
  reject() {
    if (!this._text) return;
    Store.data = normalizeData(JSON.parse(this._text));
    if (Date.now() - this._warnAt > 3000) { this._warnAt = Date.now(); UI.toast('閲覧専用です。変更は保存されません（元の状態に戻しました）', 'warn'); }
    setTimeout(() => UI.refresh(), 0);
  },
};

Store.readOnly = Share.viewer;
