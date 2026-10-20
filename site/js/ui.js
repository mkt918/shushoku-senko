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

  route() {
    const id = (location.hash.match(/^#\/([\w-]+)/) || [])[1] || 'dashboard';
    if (typeof Survey !== 'undefined') Survey.syncEmpty();   // 進路希望調査の回答を、生徒・成績の空欄に反映
    const page = Pages.get(id) || Pages.get('dashboard');
    this.current = page;
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page.id));
    const view = $('#view');
    view.innerHTML = '';
    view.scrollTop = 0;
    document.title = `${page.title}｜就職選考 統合管理`;
    if (page.ready === false) {
      view.innerHTML = `
        <div class="page-head"><h1>${esc(page.title)}</h1></div>
        <div class="empty"><p class="empty-title">この画面は準備中です</p>
        <p>${esc(page.plan || '')}</p></div>`;
      return;
    }
    page.render(view);
  },

  refresh() { if (this.current && this.current.ready !== false) this.route(); },

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
    $('#fileName').textContent = Store.fileName || '（未保存の新規データ）';
    const st = $('#saveState');
    st.textContent = Store.dirty ? '未保存の変更あり' : '保存済み';
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
  modal({ title, body, buttons = [{ label: '閉じる', value: null }], wide = false, onOpen }) {
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
      const onKey = e => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      wrap.addEventListener('click', async e => {
        if (e.target.closest('[data-close]')) return close(null);
        const btn = e.target.closest('[data-i]');
        if (!btn) return;
        const b = buttons[btn.dataset.i];
        if (b.onClick) { const r = await b.onClick(bodyEl); if (r === false) return; }
        close(b.value);
      });
      root.appendChild(wrap);
      if (onOpen) onOpen(bodyEl);
      const first = $('input,select,textarea', bodyEl);
      if (first) first.focus();
    });
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
        ${input}${f.pref ? `<button type="button" class="btn btn-sm" data-pref="${f.k}" data-zip="${f.pref}" style="margin-top:4px">県名をつける</button>` : ''}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
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
