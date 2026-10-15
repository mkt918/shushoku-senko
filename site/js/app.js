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
}

Auth.gate(main);
