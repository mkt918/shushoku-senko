'use strict';
/* ============================================================
   1. 求人票
   ============================================================ */

const JOB_FIELDS = [
  { sec: '求人票の番号' },
  { k: 'kind', label: '区分', type: 'select', options: ['一般', '指名', '事前選考'], def: '一般', narrow: true,
    help: '指名・事前選考は受付番号がなくても登録できます' },
  { k: 'receiptNo', label: '受付番号', ph: '07010011', help: '学校の受付番号。下4桁は自動で作られます' },
  { k: 'jobNumber', label: '求人番号', ph: '00000-12345', help: '先頭5桁から受理安定所と管内・管外を自動判定' },
  { k: 'openings', label: '本校への求人数', type: 'number', narrow: true, ph: '1' },
  { k: 'employment', label: '雇用形態', def: '正社員', list: ['正社員', '有期雇用', '無期雇用派遣労働者', '準職員'] },

  { sec: '事業所' },
  { k: 'company', label: '事業所名', req: true, wide: true, ph: '株式会社　〇〇　〇〇工場' },
  { k: 'kana', label: 'フリガナ', wide: true },
  { k: 'zip', label: '郵便番号', ph: '000-0000', narrow: true },
  { k: 'address', label: '所在地', wide: true },
  { k: 'tel', label: '電話番号', ph: '000-0000-0000' },
  { k: 'employees', label: '全従業員数', type: 'number', narrow: true },
  { k: 'capital', label: '資本金（万円）', type: 'number' },
  { k: 'business', label: '事業内容', type: 'textarea', wide: true },

  { sec: '仕事と条件' },
  { k: 'jobTitle', label: '職種', wide: true },
  { k: 'workplace', label: '就業場所', ph: '〇〇市' },
  { k: 'workArea', label: '就業場所の県内・県外', type: 'select', options: ['県内', '県外'], def: '県内', narrow: true },
  { k: 'salary', label: '基本給（円）', type: 'number' },
  { k: 'holidays', label: '年間休日', type: 'number', narrow: true },
  { k: 'visitOk', label: '職場見学の受け入れ', ph: '可／不可 など', narrow: true },
  { k: 'visitInfo', label: '見学の日程・条件', wide: true },

  { sec: '分類コード', note: '求人票に書かれた番号をそのまま入れると、統計用の分類が自動で決まります。' },
  { k: 'industryCode', label: '産業分類（3桁）', ph: '311', narrow: true },
  { type: 'derived', k: 'industry', label: '→ 産業（大分類）' },
  { k: 'occupationCode', label: '職業分類', ph: '69-08', narrow: true },
  { type: 'derived', k: 'occupation', label: '→ 職業（厚労省／総務省）' },
  { type: 'derived', k: 'size', label: '従業員規模（統計）' },
  { type: 'derived', k: 'zone', label: '受理安定所・区分' },
  { k: 'zoneOverride', label: '区分の手動指定', type: 'select', narrow: true,
    options: [['', '自動'], ['管内', '管内'], ['管外', '管外'], ['県外', '県外']], help: '自動判定が違うときだけ' },

  { sec: '応募・選考の窓口' },
  { k: 'dept', label: '担当部署', ph: '人事部　採用課' },
  { k: 'contact', label: '担当者名' },

  { sec: '書類の送付先（職場見学の電話で窓口と違うと分かった場合のみ）' },
  { k: 'sendZip', label: '郵便番号', narrow: true },
  { k: 'sendAddress', label: '住所', wide: true },
  { k: 'sendDept', label: '部署' },
  { k: 'sendContact', label: '担当者名' },

  { sec: 'メモ' },
  { k: 'memo', label: 'メモ（校内用）', type: 'textarea', wide: true },
];

const Jobs = {
  state: { q: '', kind: '', zone: '', ind: '', sort: 'short', dir: 'asc' },

  all() { return Store.data.jobs; },
  byId(id) { return this.all().find(j => j.id === id); },
  /** 枠の数（求人数）。空欄・0 は 1 人として扱う（求人票1枚に対して1人が就職できる前提） */
  capacity(job) { const n = num(job && job.openings); return n > 0 ? n : 1; },
  /** 下4桁で検索（選考会議などで使う） */
  byShort(s) { const k = String(num(s) ?? s); return this.all().filter(j => Derive.short(j) === k); },

  /** 下4桁の重複 */
  duplicates() {
    const m = {};
    for (const j of this.all()) { const s = Derive.short(j); if (s) (m[s] = m[s] || []).push(j); }
    return Object.entries(m).filter(([, v]) => v.length > 1);
  },

  row(j) {
    const s = Store.data.settings;
    const ind = Derive.industry(j.industryCode);
    const size = Derive.sizeClass(j.employees);
    return {
      j, short: num(Derive.short(j)), company: j.company, jobTitle: j.jobTitle, workplace: j.workplace,
      openings: j.openings, zone: Derive.zone(j, s), office: Derive.office(j),
      ind: ind ? ind.letter : '', indName: ind ? ind.name : '', size: size ? size.cls : null, kind: j.kind || '一般',
    };
  },

  filtered() {
    const st = this.state;
    const q = toHalf(st.q).toLowerCase().trim();
    let rows = this.all().map(j => this.row(j));
    if (q) rows = rows.filter(r => [r.short, r.company, r.j.kana, r.jobTitle, r.workplace, r.j.jobNumber, r.j.receiptNo, r.office]
      .some(v => v != null && toHalf(v).toLowerCase().includes(q)));
    if (st.kind) rows = rows.filter(r => r.kind === st.kind);
    if (st.zone) rows = rows.filter(r => r.zone === st.zone);
    if (st.ind) rows = rows.filter(r => r.ind === st.ind);
    return sortRows(rows, st.sort, st.dir);
  },

  render(view) {
    const st = this.state;
    const dups = this.duplicates();
    const indOpts = [...new Set(INDUSTRY_RANGES.map(r => r[0]))];
    view.innerHTML = `
      <div class="page-head">
        <div><h1>求人票</h1><p class="lead">求人票を1か所で管理します。選考会議・職場見学・送付状・報告は、すべてここの情報を使います。</p></div>
        <div class="head-actions">
          ${this._undo ? `<button class="btn" id="jobUndo">直前の削除（${this._undo.length} 件）を元に戻す</button>` : ''}
          <button class="btn btn-danger-ghost" id="jobBulk" ${this.all().length ? '' : 'disabled'}>一括削除…</button>
          <button class="btn" id="jobImport">Excel から取り込む</button>
          <button class="btn" id="jobTpl">様式をダウンロード</button>
          <button class="btn btn-primary" id="jobNew">＋ 求人票を登録</button>
        </div>
      </div>
      ${dups.length ? `<div class="notice notice-warn">受付番号の下4桁が重複しています：${dups.map(([k, v]) => `<b>${esc(k)}</b>（${v.length}件）`).join('、')}。選考会議では下4桁で求人を指定するため、受付番号を確認してください。</div>` : ''}
      <div id="watchBar"></div>
      <div class="toolbar">
        <input type="search" id="jobQ" placeholder="事業所名・職種・番号・就業場所で検索" value="${esc(st.q)}" class="grow">
        <select id="jobKind"><option value="">区分：すべて</option>${['一般', '指名', '事前選考'].map(o => `<option ${st.kind === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
        <select id="jobZone"><option value="">職安：すべて</option>${['管内', '管外', '県外'].map(o => `<option ${st.zone === o ? 'selected' : ''}>${o}</option>`).join('')}</select>
        <select id="jobInd"><option value="">産業：すべて</option>${indOpts.map(o => `<option value="${o}" ${st.ind === o ? 'selected' : ''}>${o} ${esc(INDUSTRY_RANGES.find(r => r[0] === o)[1])}</option>`).join('')}</select>
      </div>
      <div id="jobTable"></div>`;

    const redraw = () => this.drawTable($('#jobTable', view));
    $('#jobQ', view).addEventListener('input', e => { st.q = e.target.value; redraw(); });
    $('#jobKind', view).addEventListener('change', e => { st.kind = e.target.value; redraw(); });
    $('#jobZone', view).addEventListener('change', e => { st.zone = e.target.value; redraw(); });
    $('#jobInd', view).addEventListener('change', e => { st.ind = e.target.value; redraw(); });
    $('#jobNew', view).addEventListener('click', () => this.edit(null));
    if (typeof WatchBar !== 'undefined') WatchBar.mount($('#watchBar', view), () => UI.refresh());
    $('#jobImport', view).addEventListener('click', () => Importer.run('jobs'));
    $('#jobBulk', view).addEventListener('click', () => this.bulkDelete());
    const un = $('#jobUndo', view);
    if (un) un.addEventListener('click', () => {
      Store.data.jobs.push(...this._undo);
      UI.toast(`${this._undo.length} 件を元に戻しました`);
      this._undo = null; Store.changed(); UI.refresh();
    });
    $('#jobTpl', view).addEventListener('click', () => Importer.templates(['jobs', 'handy']));
    redraw();
  },

  drawTable(el) {
    const rows = this.filtered();
    const st = this.state;
    const cols = [
      ['short', '下4桁', 'num'], ['company', '事業所名'], ['jobTitle', '職種'], ['workplace', '就業場所'],
      ['openings', '求人数', 'num'], ['zone', '職安'], ['ind', '産業'], ['size', '規模', 'num'], ['kind', '区分'],
    ];
    if (!this.all().length) {
      el.innerHTML = `<div class="empty"><p class="empty-title">求人票はまだ登録されていません</p>
        <p>「＋ 求人票を登録」から入力してください。同じ事業所の別職種は、登録画面の「この事業所で別の職種を追加」で入力の手間を省けます。</p></div>`;
      return;
    }
    el.innerHTML = `
      <p class="count">${rows.length} 件 ${rows.length !== this.all().length ? `／ 全 ${this.all().length} 件` : ''}${rows.length > this.SHOW ? `　<span class="sub">（先頭の ${this.SHOW} 件を表示。検索や絞り込みで探せます）</span>` : ''}</p>
      <div class="table-wrap"><table class="tbl tbl-click">
        <thead><tr>${cols.map(([k, l, c]) => `<th class="${c || ''} sortable ${st.sort === k ? 'sorted-' + st.dir : ''}" data-sort="${k}">${l}</th>`).join('')}</tr></thead>
        <tbody>${rows.slice(0, this.SHOW).map(r => `<tr data-id="${r.j.id}">
          <td class="num mono">${esc(r.short ?? '')}</td>
          <td>${esc(r.company)}${r.j.sendAddress || r.j.sendZip ? ' <span class="tag tag-info" title="送付先の変更あり">送付先変更</span>' : ''}</td>
          <td>${esc(r.jobTitle)}</td>
          <td>${esc(r.workplace)}${r.j.workArea === '県外' ? ' <span class="tag">県外</span>' : ''}</td>
          <td class="num">${esc(r.openings ?? '')}</td>
          <td>${r.zone ? `<span class="tag tag-${r.zone === '管内' ? 'accent' : 'plain'}">${r.zone}</span>` : ''} <span class="sub">${esc(r.office)}</span></td>
          <td title="${esc(r.indName)}">${esc(r.ind)}</td>
          <td class="num">${esc(r.size ?? '')}</td>
          <td>${r.kind !== '一般' ? `<span class="tag tag-warn">${esc(r.kind)}</span>` : '<span class="sub">一般</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    $$('th.sortable', el).forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = 'asc'; }
      this.drawTable(el);
    }));
    $$('tbody tr', el).forEach(tr => tr.addEventListener('click', () => this.edit(tr.dataset.id)));
  },

  batchTag() { return this._batch ? Object.assign({}, this._batch) : {}; },
  SHOW: 500,          // 一覧に出す最大件数（件数が多いと重くなるため）
  _undo: null,        // 直前の削除（元に戻す用。ブラウザを閉じると消える）

  /** 取り込みごとのまとまり（取り込みで追加した求人に目印が付く） */
  batches() {
    const m = new Map();
    for (const j of this.all()) if (j.impId) {
      if (!m.has(j.impId)) m.set(j.impId, { id: j.impId, at: j.impAt || '', name: j.impName || '', ids: [] });
      m.get(j.impId).ids.push(j.id);
    }
    return [...m.values()].sort((a, b) => b.at.localeCompare(a.at));
  },

  /** 求人票の一括削除（間違えて大量に取り込んだとき用） */
  async bulkDelete() {
    const used = new Set(Store.data.applications.map(a => a.jobId));
    const batches = this.batches();
    const shown = this.filtered().map(r => r.j.id);
    const opts = [
      ['filtered', `今、画面に出ている求人（検索・絞り込みの結果）　<b>${shown.length}</b> 件`],
      ...batches.map(b => ['b:' + b.id, `取り込み　${esc(b.at)}${b.name ? `「${esc(b.name)}」` : ''}で追加した求人　<b>${b.ids.length}</b> 件`]),
      ['unused', `応募・希望に使われていない求人すべて　<b>${this.all().filter(j => !used.has(j.id)).length}</b> 件`],
      ['all', `求人票のすべて　<b>${this.all().length}</b> 件`],
    ];
    const body = document.createElement('div');
    body.innerHTML = `<p>削除する求人を選んでください。${batches.length ? '' : '<span class="sub">（このデータでは、取り込みごとの目印はまだありません。これからの取り込み分には付きます）</span>'}</p>
      <div class="bulk-opts">${opts.map(([v, l], i) => `<label class="check"><input type="radio" name="bulk" value="${v}" ${i === 0 ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</div>
      <label class="check bulk-keep"><input type="checkbox" id="bulkKeep" checked> 選考会議・応募で使われている求人は残す</label>
      <div class="notice notice-warn" id="bulkSum"></div>
      <p class="sub">削除したあとは、この画面の「元に戻す」で戻せます（ブラウザを閉じるまで）。念のため、先に「名前を付けて保存」をおすすめします。</p>`;
    const pick = () => {
      const v = $('input[name=bulk]:checked', body).value, keep = $('#bulkKeep', body).checked;
      let ids = v === 'filtered' ? shown : v === 'all' ? this.all().map(j => j.id) : v === 'unused' ? this.all().filter(j => !used.has(j.id)).map(j => j.id)
        : (batches.find(b => 'b:' + b.id === v) || { ids: [] }).ids;
      const kept = keep || v === 'unused' ? ids.filter(id => used.has(id)) : [];
      ids = ids.filter(id => !kept.includes(id));
      return { ids, kept };
    };
    const sum = () => { const { ids, kept } = pick(); $('#bulkSum', body).innerHTML = `<b>${ids.length}</b> 件を削除します。${kept.length ? `（応募・希望で使われている ${kept.length} 件は残します）` : ''}`; };
    body.addEventListener('change', sum);
    sum();
    const res = await UI.modal({ title: '求人票の一括削除', body, wide: true, buttons: [{ label: 'キャンセル', value: null }, { label: '削除する', kind: 'danger', value: 'ok', onClick: () => { if (!pick().ids.length) { UI.toast('削除する求人がありません', 'warn'); return false; } } }], onOpen: sum });
    if (res !== 'ok') return;
    const { ids } = pick();
    if (!await UI.confirm(`求人票 ${ids.length} 件を削除します。よろしいですか？`, { ok: '削除する', danger: true })) return;
    const set = new Set(ids);
    this._undo = Store.data.jobs.filter(j => set.has(j.id));
    Store.data.jobs = Store.data.jobs.filter(j => !set.has(j.id));
    Store.changed();
    UI.refresh();
    UI.toast(`${ids.length} 件を削除しました`);
  },

  updateDerived(root) {
    const j = Form.read(root, JOB_FIELDS);
    const s = Store.data.settings;
    const ind = Derive.industry(j.industryCode);
    const occ = Derive.occupation(j.occupationCode);
    const size = Derive.sizeClass(j.employees);
    const zone = Derive.zone(j, s);
    const set = (k, html) => { const el = $(`[data-derived="${k}"]`, root); if (el) el.innerHTML = html; };
    set('industry', ind ? `<b>${ind.letter}</b> ${esc(ind.name)}` : '<span class="sub">コードを入れると表示</span>');
    set('occupation', occ ? `<b>${occ.mhlw}</b> ${esc(occ.mhlwName)}<br><span class="sub">総務省 ${occ.mic} ${esc(occ.micName)}</span>` : '<span class="sub">コードを入れると表示</span>');
    set('size', size ? `<b>${size.cls}</b> ${esc(size.label)}` : '<span class="sub">従業員数から自動</span>');
    const office = Derive.office(j);
    set('zone', zone ? `<b>${zone}</b> ${esc(office ? office + '安定所' : '')} ${Derive.pref(j) ? `<span class="sub">（${esc(Derive.pref(j))}）</span>` : ''}` : '<span class="sub">求人番号から自動</span>');
    const sh = Derive.short(j);
    const hint = $('[data-k="receiptNo"]', root).parentElement.querySelector('.help');
    if (hint) hint.textContent = sh ? `下4桁：${sh}` : '学校の受付番号。下4桁は自動で作られます';
  },

  async edit(id, preset) {
    const existing = id ? this.byId(id) : null;
    const obj = existing ? existing : (preset || { kind: '一般', employment: '正社員', workArea: '県内' });
    const body = document.createElement('div');
    body.className = 'form';
    body.innerHTML = Form.html(JOB_FIELDS, obj);
    body.addEventListener('input', () => this.updateDerived(body));
    body.addEventListener('change', () => this.updateDerived(body));

    const validate = root => {
      const v = Form.read(root, JOB_FIELDS);
      if (!v.company) { UI.toast('事業所名を入力してください', 'warn'); $('[data-k="company"]', root).focus(); return null; }
      return v;
    };
    const commit = v => {
      if (existing) Object.assign(existing, v);
      else Store.data.jobs.push(Object.assign({ id: uid() }, v));
      Store.changed();
    };

    const buttons = [];
    if (existing) buttons.push({ label: '削除', kind: 'danger-ghost', value: 'delete' });
    buttons.push({
      label: 'この事業所で別の職種を追加', kind: 'ghost', value: 'copy',
      onClick: root => { const v = validate(root); if (!v) return false; commit(v); this._copySrc = v; },
    });
    buttons.push({ label: 'キャンセル', value: null });
    buttons.push({ label: '保存', kind: 'primary', value: 'save', onClick: root => { const v = validate(root); if (!v) return false; commit(v); } });

    const res = await UI.modal({
      title: existing ? '求人票の編集' : '求人票の登録', body, wide: true, buttons,
      onOpen: root => this.updateDerived(root),
    });
    if (res) UI.refresh();

    if (res === 'delete') {
      const used = Store.data.applications.filter(a => a.jobId === existing.id).length;
      const ok = await UI.confirm(`「${existing.company}　${existing.jobTitle || ''}」を削除します。${used ? `\nこの求人は ${used} 件の応募・希望で使われています。` : ''}`, { ok: '削除する', danger: true });
      if (ok) {
        Store.data.jobs = Store.data.jobs.filter(j => j.id !== existing.id);
        Store.changed();
        UI.refresh();
        UI.toast('削除しました');
      }
    } else if (res === 'copy') {
      UI.toast('保存しました。続けて別の職種を入力してください');
      const src = this._copySrc;
      const keep = ['kind', 'employment', 'company', 'kana', 'zip', 'address', 'tel', 'employees', 'capital', 'business',
        'industryCode', 'dept', 'contact', 'sendZip', 'sendAddress', 'sendDept', 'sendContact', 'workplace', 'workArea', 'holidays'];
      const preset2 = {};
      keep.forEach(k => { preset2[k] = src[k]; });
      this.edit(null, preset2);
    } else if (res === 'save') {
      UI.toast('保存しました');
    }
  },
};

Pages.register({
  id: 'jobs', no: 1, group: '準備', title: '求人票',
  render: v => Jobs.render(v),
});
