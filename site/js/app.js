'use strict';
/* ============================================================
   起動
   ============================================================ */
function main() {
  const r = Store.init();
  UI.renderNav();
  UI.renderFileBar();
  Store.on(() => UI.renderFileBar());

  const guard = async fn => {
    try { await fn(); }
    catch (e) { console.error(e); UI.toast(e.message || '処理に失敗しました', 'error'); }
  };

  $('#btnOpen').addEventListener('click', () => guard(async () => {
    if (Store.dirty && !await UI.confirm('保存していない変更があります。\n別のファイルを開くと、その変更は失われます。', { ok: '開く', danger: true })) return;
    if (await Store.open()) { UI.refresh(); UI.toast(`「${Store.fileName}」を開きました`); }
  }));
  $('#btnSave').addEventListener('click', () => guard(async () => {
    if (await Store.save()) UI.toast(`「${Store.fileName}」に保存しました`);
  }));
  $('#btnSaveAs').addEventListener('click', () => guard(async () => {
    if (await Store.saveAs()) UI.toast(`「${Store.fileName}」に保存しました`);
  }));

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      $('#btnSave').click();
    }
  });
  const flush = () => { if (Store._timer) { clearTimeout(Store._timer); Store._timer = null; Store._writeAutosave(); } };
  window.addEventListener('beforeunload', e => {
    flush();                                  // 0.4秒待たずに、一時保存を書いておく
    if (Store.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('pagehide', flush);
  // 同じブラウザの別のタブで、このデータの一時保存が書き換えられたら知らせる（同時に編集すると、後から書いた方だけが残る）
  let warned = 0;
  window.addEventListener('storage', e => {
    if (e.key !== APP.storageKey || Date.now() - warned < 60000) return;
    warned = Date.now();
    UI.toast('別のタブでもこのツールが開かれ、データが変更されました。同時に編集すると、後から保存した方だけが残ります。どちらか1つのタブで作業してください。', 'warn');
  });
  window.addEventListener('hashchange', () => UI.route());

  UI.route();
  if (r.restored && Store.dirty) {
    UI.toast('前回の作業内容を復元しました（ファイルには未保存です）', 'warn');
  }
  if (r.encrypted) guard(async () => {        // 暗号化した一時保存：パスワードを聞いて復元する
    const saved = r.encrypted;
    for (;;) {
      const pass = await UI.askPassword({ title: '前回の作業内容を復元', message: '前回の作業内容（暗号化されています）が、このブラウザに残っています。\nパスワードを入れると復元します。キャンセルすると、ファイルを「開く」から始めます。' });
      if (pass == null) { UI.toast('復元しませんでした。保存したファイルを「開く」で開いてください（何か入力すると、この一時保存は上書きされます）', 'warn'); return; }
      try {
        const o = await Crypt.open(saved.enc, pass);
        Store.data = normalizeData(o.data);
        Store.fileName = saved.fileName || '';
        Store.dirty = !!saved.dirty;
        Store.crypt = o.c;
        Store.emit(); UI.renderFileBar(); UI.refresh();
        UI.toast('前回の作業内容を復元しました');
        return;
      } catch (e) { UI.toast('パスワードが違います', 'warn'); }
    }
  });
}

Auth.gate(main);
