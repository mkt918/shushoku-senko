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
  window.addEventListener('beforeunload', e => {
    if (Store.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('hashchange', () => UI.route());

  UI.route();
  if (r.restored && Store.dirty) {
    UI.toast('前回の作業内容を復元しました（ファイルには未保存です）', 'warn');
  }
}

Auth.gate(main);
