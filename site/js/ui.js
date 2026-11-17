'use strict';
/* ============================================================
   画面共通：ページ登録／ルーター／モーダル／通知／フォーム
   ============================================================ */

const Pages = {
  list: [],
  register(p) {
    this.list = this.list.filter(x => x.id !== p.id);
    this.list.push(p);
    this.list.sort((a, b) => (a.no ?? -1) - (b.no ?? -1));
  },
  get(id) { return this.list.find(p => p.id === id); },
};

const UI = {
  current: null,

  go(id) { location.hash = '#/' + id; },

  /** keep＝同じ画面の描き直し（スクロールの位置を保つ）。画面を移るときは先頭から */
  route(keep = false) {
    const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1] || 'dashboard';
    if (typeof Survey !== 'undefined' && !Store.readOnly) Survey.syncEmpty();   // 進路希望調査の回答を、生徒・成績の空欄に反映（閲覧専用では書き換えない）
    const page = Pages.get(id) || Pages.get('dashboard');
    const view0 = $('#view');
    const pos = keep && this.current === page ? { y: window.scrollY, v: view0.scrollTop, w: $$('.table-wrap', view0).map(w => [w.scrollTop, w.scrollLeft]) } : null;
    this.current = page;
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page.id));
    const view = $('#view');
    view.innerHTML = '';
    if (!pos) { view.scrollTop = 0; window.scrollTo(0, 0); }
    document.title = `${page.title}｜就職選考 統合管理`;
    if (page.ready === false) {
      view.innerHTML = `
        <div class="page-head"><h1>${esc(page.title)}</h1></div>
        <div class="empty"><p class="empty-title">この画面は準備中です</p>
        <p>${esc(page.plan || '')}</p></div>`;
      return;
    }
    page.render(view);
    if (pos) {
      const ws = $$('.table-wrap', view);
      pos.w.forEach(([t, l], i) => { if (ws[i]) { ws[i].scrollTop = t; ws[i].scrollLeft = l; } });
      view.scrollTop = pos.v; window.scrollTo(0, pos.y);
    }
  },

  refresh() { if (this.current && this.current.ready !== false) this.route(true); },

  renderNav() {
    let html = '';
    let group = null;
    for (const p of Pages.list) {
      if (p.group !== group) {
        group = p.group;
        if (group) html += `<div class="nav-group">${esc(group)}</div>`;
      }
      html += `<a href="#/${p.id}" data-page="${p.id}" class="${p.ready === false ? 'soon' : ''}">
        ${p.no != null ? `<span class="nav-no">${p.no}</span>` : '<span class="nav-no"></span>'}
        <span>${esc(p.title)}</span>${p.ready === false ? '<span class="nav-soon">準備中</span>' : ''}</a>`;
    }
    $('#nav').innerHTML = html;
  },

  renderFileBar() {
    const d = Store.data;
    $('#yearLabel').textContent = nendoLabel(d.year);
    if (Store.readOnly) { Share._bar(); return; }     // 閲覧専用：最終更新の時刻を出す
    $('#fileName').textContent = Store.fileName || '（未保存の新規データ）';
    const st = $('#saveState');
    st.textContent = Store.dirty ? '未保存の変更あり（Ctrl+S で保存）' : '保存済み';
    $('.top').classList.toggle('is-dirty-bar', !!Store.dirty);
    st.className = 'save-state ' + (Store.dirty ? 'is-dirty' : 'is-clean');
  },

  toast(msg, kind = 'ok') {
    const t = document.createElement('div');
    t.className = 'toast toast-' + kind;
    t.textContent = msg;
    $('#toast').appendChild(t);
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  },

  /** モーダル。buttons: [{label, kind, value}] → Promise(value) */
  /** guard＝入力を変えたまま ×・Esc・キャンセルで閉じるとき、確認する */
  modal({ title, body, buttons = [{ label: '閉じる', value: null }], wide = false, onOpen, guard = false }) {
    return new Promise(resolve => {
      const root = $('#modalRoot');
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `
        <div class="modal ${wide ? 'modal-wide' : ''} ${wide === 'xl' ? 'modal-xl' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="閉じる">×</button></div>
          <div class="modal-body"></div>
          <div class="modal-foot">${buttons.map((b, i) =>
            `<button class="btn ${b.kind ? 'btn-' + b.kind : ''}" data-i="${i}" ${b.title ? `title="${esc(b.title)}"` : ''}>${esc(b.label)}</button>`).join('')}</div>
        </div>`;
      const bodyEl = $('.modal-body', wrap);
      if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
      const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
      const snap = () => guard ? $$('input,select,textarea', bodyEl).map(x => x.type === 'checkbox' || x.type === 'radio' ? x.checked : x.value).join('\u0001') : '';
      let base = '';
      const tryClose = async v => {
        if (guard && v == null && snap() !== base && !await UI.confirm('入力した内容は保存されません。閉じますか？', { title: '入力を捨てますか', ok: '閉じる', danger: true })) return;
        close(v);
      };
      const onKey = e => { if (e.key === 'Escape' && root.lastElementChild === wrap) tryClose(null); };   // 重なっているときは、いちばん上の1枚だけ閉じる
      document.addEventListener('keydown', onKey);
      wrap.addEventListener('click', async e => {
        if (e.target.closest('[data-close]')) return tryClose(null);
        const btn = e.target.closest('[data-i]');
        if (!btn) return;
        const b = buttons[btn.dataset.i];
        if (b.onClick) { const r = await b.onClick(bodyEl); if (r === false) return; }
        tryClose(b.value);
      });
      root.appendChild(wrap);
      if (onOpen) onOpen(bodyEl);
      base = snap();
      const first = $('input,select,textarea', bodyEl);
      if (first) first.focus();
    });
  },

  /**
   * 「検索して1つ選ぶ」ダイアログ。返り値は { res, id }。
   * res＝'ok'（選んだ）／押した追加ボタンの値／'clear'（空にする）／null（取り消し）。id＝選んだ項目の id
   * items＝id を持つ項目の配列／text(x)＝検索に使う文字の配列／row(x)＝1行の中身（HTML）／immediate＝押した時点で決める／clear＝「空にする」ボタンの名前
   */
  async pick({ title, intro = '', placeholder = '', items, text, row, preset = '', buttons = [], okLabel = '決定', need = '選んでください', empty = '見つかりません', immediate = false, clear = '', limit = 80 }) {
    const body = document.createElement('div');
    body.innerHTML = `${intro}<input type="search" class="w-full pk-q" placeholder="${esc(placeholder)}" value="${esc(preset)}"><div class="pick-list pk-list"></div>${clear ? `<button type="button" class="btn btn-sm btn-danger-ghost pk-clear">${esc(clear)}</button>` : ''}`;
    let chosen = null, direct = null;
    const draw = () => {
      const q = toHalf($('.pk-q', body).value).trim().toLowerCase();
      const list = items.filter(x => !q || text(x).some(v => v && toHalf(v).toLowerCase().includes(q))).slice(0, limit);
      $('.pk-list', body).innerHTML = list.length ? list.map(x => `<button type="button" class="pick-item ${chosen === x.id ? 'on' : ''}" data-id="${esc(x.id)}">${row(x)}</button>`).join('') : `<p class="sub">${empty}</p>`;
    };
    const all = [...buttons, { label: 'キャンセル', value: null }];
    if (!immediate) all.push({ label: okLabel, kind: 'primary', value: 'ok', onClick: () => { if (!chosen) { UI.toast(need, 'warn'); return false; } } });
    const res = await this.modal({
      title, body, wide: true, buttons: all,
      onOpen: root => {
        draw();
        $('.pk-q', root).addEventListener('input', draw);
        root.addEventListener('click', e => {
          const shut = () => root.closest('.modal-backdrop').querySelector('[data-close]').click();
          const it = e.target.closest('.pick-item');
          if (it) { chosen = it.dataset.id; if (immediate) { direct = 'ok'; shut(); } else draw(); return; }
          if (e.target.closest('.pk-clear')) { chosen = ''; direct = 'clear'; shut(); }
        });
      },
    });
    return { res: direct || res, id: chosen };
  },

  /** パスワードを聞く。twice＝確認のためにもう一度入れる。取り消したら null */
  async askPassword({ title = 'パスワード', message = '', twice = false, ok = 'OK' } = {}) {
    const body = document.createElement('div');
    body.innerHTML = `${message ? `<p class="confirm-msg">${esc(message).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="field" style="margin-top:10px"><label class="label" for="pw1">パスワード</label><input type="password" id="pw1" autocomplete="off"></div>
      ${twice ? '<div class="field" style="margin-top:8px"><label class="label" for="pw2">もう一度</label><input type="password" id="pw2" autocomplete="off"></div>' : ''}`;
    let value = null;
    const res = await this.modal({
      title, body,
      buttons: [{ label: 'キャンセル', value: null }, {
        label: ok, kind: 'primary', value: 'ok', onClick: root => {
          const a = $('#pw1', root).value;
          if (a.length < 4) { UI.toast('パスワードは4文字以上にしてください', 'warn'); return false; }
          if (twice && a !== $('#pw2', root).value) { UI.toast('2つのパスワードが違います', 'warn'); return false; }
          value = a;
        },
      }],
      onOpen: root => root.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); root.closest('.modal').querySelector('.btn-primary').click(); } }),
    });
    return res === 'ok' ? value : null;
  },

  /** 「取り消す」ボタンつきの通知（ms ミリ秒で消える） */
  toastAction(msg, label, fn, ms = 30000) {
    const t = document.createElement('div');
    t.className = 'toast toast-action';
    t.innerHTML = `<span>${esc(msg)}</span><button class="btn btn-sm">${esc(label)}</button>`;
    $('#toast').appendChild(t);
    const done = () => { t.classList.add('out'); setTimeout(() => t.remove(), 400); };
    t.querySelector('button').addEventListener('click', () => { done(); fn(); });
    setTimeout(done, ms);
  },

  async confirm(message, { title = '確認', ok = 'OK', danger = false } = {}) {
    return await this.modal({
      title, body: `<p class="confirm-msg">${esc(message).replace(/\n/g, '<br>')}</p>`,
      buttons: [{ label: 'キャンセル', value: false }, { label: ok, kind: danger ? 'danger' : 'primary', value: true }],
    }) === true;
  },
};

/* ============================================================
   フォーム生成
   fields: [{sec:'見出し'} | {k, label, type, options, help, ph, wide, list, readonly}]
   ============================================================ */
const Form = {
  html(fields, obj = {}) {
    let out = '';
    let open = false;
    for (const f of fields) {
      if (f.sec) {
        if (open) out += '</div></fieldset>';
        out += `<fieldset class="fs ${f.full ? 'fs-full' : ''}"><legend>${esc(f.sec)}</legend>${f.note ? `<p class="fs-note">${esc(f.note)}</p>` : ''}<div class="grid ${f.cols ? 'cols' : ''}" ${f.cols ? `style="grid-template-columns:repeat(${f.cols},minmax(0,1fr))"` : ''}>`;
        open = true;
        continue;
      }
      if (f.type === 'caption') { out += `<div class="field fs-cap">${esc(f.label)}</div>`; continue; }
      if (f.type === 'blank') { out += '<div class="field"></div>'; continue; }
      if (f.type === 'derived') {
        out += `<div class="field wide">${f.label ? `<span class="label">${esc(f.label)}</span>` : ''}<div class="derived" data-derived="${f.k}"></div></div>`;
        continue;
      }
      const v = obj[f.k] ?? f.def ?? '';
      const id = 'f_' + f.k;
      let input;
      if (f.type === 'select') {
        input = `<select id="${id}" data-k="${f.k}">${f.options.map(o => {
          const [val, lab] = Array.isArray(o) ? o : [o, o];
          return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
        }).join('')}</select>`;
      } else if (f.type === 'textarea') {
        input = `<textarea id="${id}" data-k="${f.k}" rows="${f.rows || 2}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
      } else if (f.type === 'checkbox') {
        input = `<label class="check"><input type="checkbox" id="${id}" data-k="${f.k}" ${v ? 'checked' : ''}> ${esc(f.checkLabel || '')}</label>`;
      } else {
        const listId = f.list ? 'dl_' + f.k : '';
        input = `<input id="${id}" data-k="${f.k}" type="${f.type === 'number' ? 'text' : (f.type || 'text')}"
          ${f.type === 'number' ? 'inputmode="decimal"' : ''} value="${esc(v)}" placeholder="${esc(f.ph || '')}"
          ${listId ? `list="${listId}"` : ''} ${f.readonly ? 'readonly' : ''} autocomplete="off">`;
        if (listId) input += `<datalist id="${listId}">${f.list.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
      }
      out += `<div class="field ${f.wide ? 'wide' : ''} ${f.narrow ? 'narrow' : ''}">
        <label for="${id}" class="label">${esc(f.label)}${f.req ? ' <span class="req">必須</span>' : ''}</label>
        ${f.pref ? `<div class="in-row">${input}<button type="button" class="btn" data-pref="${f.k}" data-zip="${f.pref}" title="郵便番号から愛知県・岐阜県をつけます（名古屋市・岐阜市は、つけません）">県名をつける</button></div>` : input}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
    }
    if (open) out += '</div></fieldset>';
    return out;
  },

  read(root, fields) {
    const o = {};
    for (const f of fields) {
      if (!f.k || f.type === 'derived') continue;
      const el = $(`[data-k="${f.k}"]`, root);
      if (!el) continue;
      if (f.type === 'checkbox') o[f.k] = el.checked;
      else if (f.type === 'number') o[f.k] = num(el.value);
      else o[f.k] = el.value.trim();
    }
    return o;
  },
};

/* 並べ替え可能な表の小道具 */
function sortRows(rows, key, dir, getter) {
  const g = getter || (r => r[key]);
  return rows.slice().sort((a, b) => {
    const x = g(a, key), y = g(b, key);
    const xe = x == null || x === '', ye = y == null || y === '';
    if (xe && ye) return 0;
    if (xe) return 1;
    if (ye) return -1;
    const r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'ja', { numeric: true });
    return dir === 'desc' ? -r : r;
  });
}

/* ============================================================
   印刷：#printRoot に帳票HTMLを入れてブラウザ印刷
   Print.open({ title, html, orientation: 'portrait'|'landscape', margin: '12mm' })
   帳票側は .p-page（改ページ単位）、.p-title、.p-table などのクラスを使う
   ============================================================ */
const Print = {
  open({ title = '', html, orientation = 'portrait', margin = '12mm', size = 'A4' }) {
    let root = $('#printRoot');
    if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
    root.innerHTML = html;
    let st = $('#printPageStyle');
    if (!st) { st = document.createElement('style'); st.id = 'printPageStyle'; document.head.appendChild(st); }
    st.textContent = `@page { size: ${size} ${orientation}; margin: ${margin}; }`;
    const oldTitle = document.title;
    if (title) document.title = title;           // PDF保存時のファイル名になる
    document.body.classList.add('printing');
    const done = () => {
      document.body.classList.remove('printing');
      document.title = oldTitle;
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  },
};
