'use strict';
/* 準備中の画面の仮登録（現在はすべて実装済みのため空）。新しい画面を予告するときにここへ { id, no, group, title, plan } を足す */
[].forEach(p => Pages.register(Object.assign({ ready: false }, p)));
