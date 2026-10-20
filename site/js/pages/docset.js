'use strict';
/* ============================================================
   帳票の設定：依頼文・確認書・送付状・宛名ラベルの文面と見た目を、見本を見ながら直す
   - 文書は「ブロック」の並び（文章／表／記入欄／余白）。順番の入れ替え・追加・削除ができる
   - 変更はすぐ保存される（settings.docLayout[文書名]）。「初期値に戻す」で既定に戻る
   - 実際の印刷（職場見学・応募・受験の各画面）も、この設定を使う
   ============================================================ */

const DocSet = {
  state: { key: 'cover', open: new Set(), last: null },
  working: null,      // 編集中の文書（layout のコピー）

  keys() { return [['cover', '送付状'], ['visitLetter', '職場見学の依頼文'], ['visitConfirm', '職場見学確認書'], ['label', '宛名ラベル']]; },

  load() {
    this.working = clone(Docs.layout(this.state.key));
    (this.working.blocks || []).forEach(b => { b.bid = b.bid || uid(); });
  },
  /** 変更を保存する（編集中のコピーを settings に書く） */
  save() {
    clearTimeout(this._tm); this._pend = null;
    Store.data.settings.docLayout[this.state.key] = clone(this.working);
    Store.changed();
  },
  /** 入力中は、少し待ってからまとめて保存する（スライダーを動かすたびに保存しない） */
  saveLater() {
    this._pend = { key: this.state.key, doc: this.working };
    clearTimeout(this._tm);
    this._tm = setTimeout(() => this.flush(), 300);
  },
  flush() {
    clearTimeout(this._tm);
    const p = this._pend; if (!p) return;
    this._pend = null;
    Store.data.settings.docLayout[p.key] = clone(p.doc);
    Store.changed();
  },

  render(view) {
    this.flush();
    this.load();
    const k = this.state.key;
    view.innerHTML = `
      <div class="page-head"><div><h1>帳票の設定</h1>
      <p class="lead">依頼文・確認書・送付状・宛名ラベルの<b>文面と見た目</b>を、見本を見ながら直せます。数字は<b>入力欄でもスライダーでも</b>変えられ、右の見本にすぐ反映されます。変更は自動で保存され、印刷にも使われます。</p></div>
      <div class="head-actions"><button class="btn btn-primary" id="dsPrint">見本を試し刷り</button><button class="btn btn-danger-ghost" id="dsReset">初期値に戻す</button></div></div>
      <div class="tabs">${this.keys().map(([id, l]) => `<button class="${k === id ? 'on' : ''}" data-key="${id}">${l}</button>`).join('')}</div>
      <div class="ds-grid">
        <div class="ds-form" id="dsForm"></div>
        <div class="ds-side"><div class="ds-sticky"><div class="ds-pv-head"><b>見本</b><span class="sub">（実在しない見本のデータです）</span></div><div class="ds-paper-wrap" id="dsWrap"><div class="ds-paper" id="dsPaper"></div></div></div></div>
      </div>`;
    $$('[data-key]', view).forEach(b => b.addEventListener('click', () => { this.state.key = b.dataset.key; UI.refresh(); }));
    $('#dsReset', view).addEventListener('click', async () => {
      if (!await UI.confirm(`「${this.working.name || this.state.key}」の設定を、初期値に戻します。\nこの文書の文面・見た目の変更は消えます。`, { ok: '初期値に戻す', danger: true })) return;
      clearTimeout(this._tm); this._pend = null;
      Store.data.settings.docLayout[this.state.key] = null;
      Store.changed();
      UI.refresh();
    });
    $('#dsPrint', view).addEventListener('click', () => this.printSample());
    this.bindForm($('#dsForm', view));   // 受け付けは、画面を作るときに1回だけ付ける
    this.drawForm();
    this.preview();
    window.removeEventListener('resize', this._rz);
    window.addEventListener('resize', this._rz = () => this.fit());
  },

  /* ---------- 見本 ---------- */
  sampleHtml() {
    const g = Docs.sampleGroup();
    if (this.state.key === 'label') {
      const L = Store.data.settings.labels.visit;
      return `<div class="lb-demo" style="width:${L.w}mm;height:${L.h}mm">${Docs.labelHtml(g)}</div>`;
    }
    return Docs.renderDoc(this.state.key, g);
  },
  /** 見本の描き直しは、1コマに1回までにまとめる */
  previewSoon() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.preview(); });
  },
  preview() {
    const paper = $('#dsPaper'); if (!paper) return;
    if (this.state.key === 'label') { paper.style.cssText = 'padding:6mm'; paper.innerHTML = this.sampleHtml(); }
    else {
      const m = this.working.style.margin.map(v => (num(v) ?? 0) + 'mm').join(' ');
      paper.style.cssText = `padding:${m}`;
      paper.innerHTML = this.sampleHtml();
    }
    this.fit();
  },
  /** 見本の用紙を、横幅に合わせて縮小する */
  fit() {
    const wrap = $('#dsWrap'), paper = $('#dsPaper'); if (!wrap || !paper) return;
    paper.style.zoom = 1;
    const w = this.state.key === 'label' ? 380 : 794;      // A4 横幅(px)
    const avail = wrap.clientWidth - 2;
    paper.style.width = this.state.key === 'label' ? 'auto' : '210mm';
    paper.style.zoom = this.state.key === 'label' ? 1.4 : Math.min(1, avail / w);
  },
  printSample() {
    const k = this.state.key;
    if (k === 'label') { UI.toast('宛名ラベルは、職場見学・応募・受験の画面から印刷してください', 'warn'); return; }
    Print.open({ title: `見本_${this.working.name}`, html: Docs.renderDoc(k, Docs.sampleGroup()), orientation: 'portrait', margin: Docs.margin(k) });
  },

  /* ---------- 入力欄 ---------- */
  /** 入力欄の名前から、スライダーの範囲を決める */
  range(path, val) {
    const k = path.split('.').pop(), whole = /^style.margin./.test(path);
    let r = whole ? [0, 60, 1] : ({
      size: [6, 40, 0.5], zipSize: [6, 40, 0.5], addrSize: [6, 40, 0.5], coSize: [6, 40, 0.5], toSize: [6, 40, 0.5],
      line: [1, 3, 0.05], indent: [-5, 5, 0.5], left: [0, 80, 1], before: [0, 60, 1], after: [0, 60, 1], spacing: [0, 3, 0.1],
      height: [0, 120, 1], labelWidth: [10, 120, 1], minRows: [0, 30, 1], padTop: [0, 30, 0.5], padSide: [0, 30, 0.5], gap: [0, 20, 0.5],
    }[k] || [0, 100, 1]);
    const v = num(val);
    if (v != null) r = [Math.min(r[0], v), Math.max(r[1], v), r[2]];
    return r;
  },
  inp(path, val, { type = 'text', cls = '', ph = '', step, slider = true } = {}) {
    if (type === 'number' && slider) {
      const [mn, mx, st] = this.range(path, val), v = num(val);
      return `<span class="ds-num"><input type="range" data-sl min="${mn}" max="${mx}" step="${st}" value="${v ?? ''}" aria-label="スライダー">${this.inp(path, val, { type, cls, ph, step, slider: false })}</span>`;
    }
    return `<input data-p="${path}" data-t="${type}" class="${cls}" value="${esc(val ?? '')}" placeholder="${esc(ph)}" ${type === 'number' ? `inputmode="decimal"` : ''} ${step ? `data-step="${step}"` : ''} autocomplete="off">`;
  },
  sel(path, val, opts, cls = '') {
    return `<select data-p="${path}" data-t="text" class="${cls}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  },
  lab(label, html, cls = '') { return `<label class="ds-f ${cls}"><span>${esc(label)}</span>${html}</label>`; },
  ALIGN: [['left', '左'], ['center', '中央'], ['right', '右'], ['justify', '両端']],
  ALIGN3: [['left', '左'], ['center', '中央'], ['right', '右']],

  drawForm() {
    const el = $('#dsForm'); if (!el) return;
    const w = this.working;
    if (this.state.key === 'label') { el.innerHTML = this.labelForm(w); return; }
    const st = w.style, m = st.margin;
    const chips = DOC_PLACEHOLDERS.map(n => `<button type="button" class="chip" data-ph="${n}" title="カーソルの位置に入れます">{${n}}</button>`).join('');
    el.innerHTML = `
      <section class="card">
        <h2>全体</h2>
        <div class="ds-row">
          ${this.lab('書体', this.sel('style.font', st.font, Object.entries(DOC_FONTS).map(([v, a]) => [v, a[0]])))}
          ${this.lab('文字の大きさ(pt)', this.inp('style.size', st.size, { type: 'number', cls: 'w-num' }))}
          ${this.lab('行の高さ(倍)', this.inp('style.line', st.line, { type: 'number', cls: 'w-num' }))}
        </div>
        <div class="ds-row">
          <span class="ds-cap">用紙の余白(mm)</span>
          ${this.lab('上', this.inp('style.margin.0', m[0], { type: 'number', cls: 'w-num' }))}
          ${this.lab('右', this.inp('style.margin.1', m[1], { type: 'number', cls: 'w-num' }))}
          ${this.lab('下', this.inp('style.margin.2', m[2], { type: 'number', cls: 'w-num' }))}
          ${this.lab('左', this.inp('style.margin.3', m[3], { type: 'number', cls: 'w-num' }))}
        </div>
      </section>
      <section class="card ds-ph"><h2>文章に入れられる言葉</h2>
        <p class="sub">文章の中に <code>{会社名}</code> のように書くと、印刷のとき実際の内容に置き換わります。下の言葉を押すと、直前に触った文章の欄に入ります。</p>
        <div class="chips">${chips}</div></section>
      <div class="ds-blocks">${(w.blocks || []).map((b, i) => this.blockHtml(b, i)).join('')}</div>
      <div class="ds-add"><span class="ds-cap">ブロックを追加</span>
        <button class="btn btn-sm" data-add="text">＋ 文章</button><button class="btn btn-sm" data-add="table">＋ 表</button><button class="btn btn-sm" data-add="form">＋ 記入欄</button><button class="btn btn-sm" data-add="space">＋ 余白</button></div>`;
  },

  blockTitle(b) {
    if (b.type === 'text') return '文章：' + String(b.text || '').replace(/\s+/g, ' ').slice(0, 28);
    if (b.type === 'table') return '表：' + (b.columns || []).map(c => c.header).join('／');
    if (b.type === 'form') return '記入欄：' + (b.rows || []).map(r => String(r.label).replace(/\s+/g, ' ')).join('／').slice(0, 24);
    return '余白';
  },

  blockHtml(b, i) {
    const P = `blocks.${i}.`;
    let body = '';
    if (b.type === 'text') {
      body = `<textarea data-p="${P}text" data-t="text" rows="${Math.min(8, Math.max(2, String(b.text || '').split('\n').length + 1))}">${esc(b.text)}</textarea>
        <div class="ds-row">
          ${this.lab('揃え', this.sel(P + 'align', b.align, this.ALIGN))}
          ${this.lab('文字の大きさ(pt)', this.inp(P + 'size', b.size, { type: 'number', cls: 'w-num', ph: '全体' }))}
          ${this.lab('字下げ(字)', this.inp(P + 'indent', b.indent, { type: 'number', cls: 'w-num' }))}
          ${this.lab('左の余白(mm)', this.inp(P + 'left', b.left, { type: 'number', cls: 'w-num' }))}
          ${this.lab('上の間(mm)', this.inp(P + 'before', b.before, { type: 'number', cls: 'w-num' }))}
          ${this.lab('下の間(mm)', this.inp(P + 'after', b.after, { type: 'number', cls: 'w-num' }))}
          ${this.lab('字の間隔(字)', this.inp(P + 'spacing', b.spacing, { type: 'number', cls: 'w-num' }))}
          <label class="ds-f ds-ck"><input type="checkbox" data-p="${P}bold" data-t="bool" ${b.bold ? 'checked' : ''}><span>太字</span></label>
        </div>
        <p class="help">字下げ：1＝先頭を1字下げ／マイナス＝2行目以降を下げる（「○　…」の箇条書き用）</p>`;
    } else if (b.type === 'table') {
      const fields = Object.entries(DOC_FIELDS);
      body = `<div class="ds-row">
          ${this.lab('見出しの揃え', this.sel(P + 'headerAlign', b.headerAlign, this.ALIGN3))}
          ${this.lab('最低の行数', this.inp(P + 'minRows', b.minRows, { type: 'number', cls: 'w-num' }))}
          ${this.lab('上の間(mm)', this.inp(P + 'before', b.before, { type: 'number', cls: 'w-num' }))}
          ${this.lab('下の間(mm)', this.inp(P + 'after', b.after, { type: 'number', cls: 'w-num' }))}
        </div>
        <table class="tbl tbl-edit tbl-compact"><thead><tr><th>見出し</th><th>中身</th><th>幅(mm)</th><th>中身の揃え</th><th></th></tr></thead><tbody>
          ${(b.columns || []).map((c, j) => `<tr>
            <td>${this.inp(`${P}columns.${j}.header`, c.header)}</td>
            <td>${this.sel(`${P}columns.${j}.field`, c.field, fields)}</td>
            <td>${this.inp(`${P}columns.${j}.width`, c.width || '', { type: 'number', cls: 'w-num', ph: '自動', slider: false })}</td>
            <td>${this.sel(`${P}columns.${j}.align`, c.align, this.ALIGN3)}</td>
            <td><button class="icon-btn" data-colup="${i}.${j}" title="左へ">←</button><button class="icon-btn" data-coldown="${i}.${j}" title="右へ">→</button><button class="icon-btn" data-coldel="${i}.${j}" title="列を削除">×</button></td></tr>`).join('')}
        </tbody></table>
        <button class="btn btn-sm" data-coladd="${i}">＋ 列を追加</button>
        <p class="help">表の中身は、見学・応募する生徒の人数ぶん並びます。</p>`;
    } else if (b.type === 'form') {
      body = `<div class="ds-row">
          ${this.lab('左の項目の幅(mm)', this.inp(P + 'labelWidth', b.labelWidth, { type: 'number', cls: 'w-num' }))}
          ${this.lab('上の間(mm)', this.inp(P + 'before', b.before, { type: 'number', cls: 'w-num' }))}
          ${this.lab('下の間(mm)', this.inp(P + 'after', b.after, { type: 'number', cls: 'w-num' }))}
        </div>
        ${(b.rows || []).map((r, j) => `<div class="ds-formrow">${this.lab('項目名', `<textarea data-p="${P}rows.${j}.label" data-t="text" rows="2">${esc(r.label)}</textarea>`, 'grow')}
          ${this.lab('記入欄の高さ(mm)', this.inp(`${P}rows.${j}.height`, r.height, { type: 'number', cls: 'w-num' }))}
          <button class="icon-btn" data-rowdel="${i}.${j}" title="この行を削除">×</button></div>`).join('')}
        <button class="btn btn-sm" data-rowadd="${i}">＋ 行を追加</button>`;
    } else {
      body = `<div class="ds-row">${this.lab('余白の高さ(mm)', this.inp(P + 'height', b.height, { type: 'number', cls: 'w-num' }))}</div>`;
    }
    return `<details class="ds-blk" data-bid="${b.bid}" ${this.state.open.has(b.bid) ? 'open' : ''}>
      <summary><span class="ds-n">${i + 1}</span><span class="ds-t">${esc(this.blockTitle(b))}</span>
        <span class="ds-btns"><button class="icon-btn" data-up="${i}" title="上へ">↑</button><button class="icon-btn" data-down="${i}" title="下へ">↓</button><button class="icon-btn" data-dup="${i}" title="複製">⧉</button><button class="icon-btn" data-del="${i}" title="削除">×</button></span></summary>
      <div class="ds-body">${body}</div></details>`;
  },

  labelForm(L) {
    const f = (label, path, val) => this.lab(label, this.inp(path, val, { type: 'number', cls: 'w-num' }));
    return `<section class="card"><h2>宛名ラベルの文字</h2>
      <p class="sub">用紙の面数・大きさは「設定」の「宛名ラベル用紙」にあります。ここでは、ラベルの中の文字を整えます。</p>
      <div class="ds-row">${this.lab('揃え', this.sel('align', L.align, this.ALIGN3))}
        <label class="ds-f ds-ck"><input type="checkbox" data-p="showZip" data-t="bool" ${L.showZip !== false ? 'checked' : ''}><span>郵便番号を入れる</span></label>
        <label class="ds-f ds-ck"><input type="checkbox" data-p="boldCompany" data-t="bool" ${L.boldCompany !== false ? 'checked' : ''}><span>事業所名を太字にする</span></label></div>
      <div class="ds-row">${f('郵便番号の大きさ(pt)', 'zipSize', L.zipSize)}${f('住所の大きさ(pt)', 'addrSize', L.addrSize)}${f('事業所名の大きさ(pt)', 'coSize', L.coSize)}${f('宛先の大きさ(pt)', 'toSize', L.toSize)}</div>
      <div class="ds-row">${f('上の余白(mm)', 'padTop', L.padTop)}${f('左の余白(mm)', 'padSide', L.padSide)}${f('字下げ(mm)', 'indent', L.indent)}</div>
      <div class="ds-row">${f('住所の位置(mm)', 'addrTop', L.addrTop)}${f('事業所名の位置(mm)', 'coTop', L.coTop)}${f('宛先の位置(mm)', 'toTop', L.toTop)}</div>
      <div class="ds-row">${f('住所を収める幅(mm)', 'fitAddr', L.fitAddr)}${f('事業所名を収める幅(mm)', 'fitCo', L.fitCo)}</div>
      <p class="sub">位置は、郵便番号の行の上端からの距離です。住所・事業所名は、収める幅より長いとき、文字を縮めて1行にします（0＝縮めない）。</p></section>`;
  },

  /* ---------- 操作 ---------- */
  bindForm(el) {
    const st = this.state;
    el.addEventListener('focusin', e => { if (e.target.matches('textarea, input[type=text], input:not([type])') && e.target.dataset.p) st.last = e.target; });
    el.addEventListener('toggle', e => { const d = e.target.closest?.('details.ds-blk'); if (d) { d.open ? st.open.add(d.dataset.bid) : st.open.delete(d.dataset.bid); } }, true);
    el.addEventListener('change', e => this.onInput(e.target));
    el.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('[data-sl]')) {                    // スライダー → 隣の数字欄に反映
        const n = t.parentElement.querySelector('input[data-p]'); n.value = t.value; this.onInput(n, true); return;
      }
      if (t.tagName === 'TEXTAREA' || ['text', 'number'].includes(t.dataset.t)) {
        this.onInput(t, true);
        const sl = t.parentElement.querySelector?.('[data-sl]');   // 数字欄 → スライダーに反映
        if (sl && t.value.trim() !== '') sl.value = t.value;
      }
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const ds = b.dataset, blocks = this.working.blocks;
      if (ds.ph) { this.insertPh(ds.ph); return; }
      const keep = () => { e.preventDefault(); e.stopPropagation(); };
      const redraw = () => { this.save(); this.drawForm(); this.preview(); };
      if (ds.up !== undefined) { keep(); const i = +ds.up; if (i > 0) { [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]]; redraw(); } }
      else if (ds.down !== undefined) { keep(); const i = +ds.down; if (i < blocks.length - 1) { [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]]; redraw(); } }
      else if (ds.dup !== undefined) { keep(); const c = clone(blocks[+ds.dup]); c.bid = uid(); blocks.splice(+ds.dup + 1, 0, c); st.open.add(c.bid); redraw(); }
      else if (ds.del !== undefined) { keep(); UI.confirm('このブロックを削除します。', { ok: '削除', danger: true }).then(ok => { if (ok) { blocks.splice(+ds.del, 1); redraw(); } }); }
      else if (ds.add) {
        const nb = { text: { type: 'text', text: '新しい文章', align: 'left', size: null, bold: false, indent: 0, left: 0, before: 0, after: 3, spacing: 0 },
          table: { type: 'table', headerAlign: 'center', minRows: 0, before: 2, after: 4, columns: [{ header: '氏名', field: 'name', width: 0, align: 'center' }, { header: '職種', field: 'job', width: 0, align: 'center' }] },
          form: { type: 'form', labelWidth: 38, before: 4, after: 0, rows: [{ label: '項目', height: 16 }] }, space: { type: 'space', height: 8 } }[ds.add];
        nb.bid = uid(); blocks.push(nb); st.open.add(nb.bid); redraw();
      } else if (ds.coladd) { blocks[+ds.coladd].columns.push({ header: '見出し', field: 'name', width: 0, align: 'center' }); redraw(); }
      else if (ds.coldel) { const [i, j] = ds.coldel.split('.').map(Number); blocks[i].columns.splice(j, 1); redraw(); }
      else if (ds.colup) { const [i, j] = ds.colup.split('.').map(Number); const c = blocks[i].columns; if (j > 0) { [c[j - 1], c[j]] = [c[j], c[j - 1]]; redraw(); } }
      else if (ds.coldown) { const [i, j] = ds.coldown.split('.').map(Number); const c = blocks[i].columns; if (j < c.length - 1) { [c[j + 1], c[j]] = [c[j], c[j + 1]]; redraw(); } }
      else if (ds.rowadd) { blocks[+ds.rowadd].rows.push({ label: '項目', height: 16 }); redraw(); }
      else if (ds.rowdel) { const [i, j] = ds.rowdel.split('.').map(Number); blocks[i].rows.splice(j, 1); redraw(); }
    });
  },

  onInput(t, live) {
    const p = t.dataset.p; if (!p) return;
    let v = t.dataset.t === 'bool' ? t.checked : t.value;
    if (t.dataset.t === 'number') v = t.value.trim() === '' ? null : num(t.value);
    setPath(this.working, p, v);
    if (live) { this.saveLater(); this.previewSoon(); } else { this.save(); this.preview(); }
    if (!live) { const sum = t.closest('details')?.querySelector('.ds-t'); if (sum) { const i = +p.split('.')[1]; if (this.working.blocks[i]) sum.textContent = this.blockTitle(this.working.blocks[i]); } }
  },

  /** 直前に触った文章の欄に、{言葉} を入れる */
  insertPh(name) {
    const el = this.state.last;
    if (!el || !document.body.contains(el)) { UI.toast('先に、言葉を入れたい文章の欄をクリックしてください', 'warn'); return; }
    const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
    el.value = el.value.slice(0, s) + `{${name}}` + el.value.slice(e);
    el.focus(); el.selectionStart = el.selectionEnd = s + name.length + 2;
    this.onInput(el, true);
  },
};

Pages.register({ id: 'docset', no: 12, group: '管理', title: '帳票の設定', render: v => DocSet.render(v) });
