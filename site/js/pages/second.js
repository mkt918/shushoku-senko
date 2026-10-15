'use strict';
/* ============================================================
   7. 2次応募（1次で内定しなかった生徒の、2次以降の応募先と結果）
   ============================================================ */

const SecondPage = {
  state: { filter: '' },

  /** 1度でも不採用・辞退になった就職希望者（就職順位つき） */
  rows() {
    const rk = new Map(Points.ranking().map(r => [r.s.id, r]));
    return Store.data.students.filter(s => Students.isJobSeeker(s)).map(s => {
      const list = Apps.of(s.id).filter(a => a.confirmed);
      const cur = Apps.current(s.id);
      const failed = list.some(a => a.result === '不採用' || a.result === '辞退');
      const wait = !cur || cur.result === '不採用' || cur.result === '辞退';
      return { s, cur, failed, wait, r: rk.get(s.id) };
    }).filter(x => x.failed)
      .sort((a, b) => (a.r?.jobRank ?? 1e9) - (b.r?.jobRank ?? 1e9) || num(a.s.no3) - num(b.s.no3));
  },

  render(view) {
    const all = this.rows();
    const wait = all.filter(x => x.wait);
    const going = all.filter(x => !x.wait && !x.cur.result);
    const won = all.filter(x => !x.wait && x.cur.result === '内定');
    const f = this.state.filter;
    const rows = all.filter(x => f === '' ? true : f === '未定' ? x.wait : f === '待' ? (!x.wait && !x.cur.result) : (!x.wait && x.cur.result === '内定'));
    view.innerHTML = `
      <div class="page-head">
        <div><h1>2次応募</h1><p class="lead">1次で内定しなかった（不採用・辞退）生徒が、ここに自動で並びます。応募先を決め、試験日・合否まで続けて記録します。</p></div>
        <div class="head-actions">
          <button class="btn" id="scPrint" ${wait.length ? '' : 'disabled'}>2次以降の選考資料を印刷</button>
        </div>
      </div>
      <div class="stats stats-sm">
        <div class="stat"><span class="stat-label">対象の生徒</span><span class="stat-val">${all.length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">応募先が未定</span><span class="stat-val">${wait.length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">結果待ち</span><span class="stat-val">${going.length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">内定</span><span class="stat-val">${won.length}</span><span class="stat-unit">人</span></div>
      </div>
      <div class="toolbar">
        <div class="seg">${[['', 'すべて'], ['未定', '応募先が未定'], ['待', '結果待ち'], ['内定', '内定']]
          .map(([v, l]) => `<button class="${f === v ? 'on' : ''}" data-filter="${v}">${l}</button>`).join('')}</div>
      </div>
      ${Apps.currents().length ? SendDocs.html() : ''}
      ${rows.length ? `<div class="table-wrap"><table class="tbl tbl-edit tbl-apps" id="scTable">
        <thead><tr><th class="num">就職順位</th><th class="num">番号</th><th>氏名</th><th>これまでの応募</th><th>次</th><th>応募先</th><th>試験日</th><th>時間</th><th>合否</th><th>結果日</th><th>メモ</th></tr></thead>
        <tbody>${rows.map(x => this.rowHtml(x)).join('')}</tbody></table></div>`
        : `<div class="empty"><p class="empty-title">${all.length ? '該当する生徒はいません' : '2次応募の対象者はまだいません'}</p><p>「応募・受験」で合否を「不採用」または「辞退」にすると、ここに並びます。</p></div>`}
`;
    $$('[data-filter]', view).forEach(b => b.addEventListener('click', () => { this.state.filter = b.dataset.filter; UI.refresh(); }));
    $('#scPrint', view).addEventListener('click', () => AppsPage.printNext());
    $$('[data-next]', view).forEach(b => b.addEventListener('click', () => AppsPage.addNext(b.dataset.next)));
    if ($('#sendCard', view)) SendDocs.bind($('#sendCard', view));
    const tbl = $('#scTable', view);
    if (tbl) tbl.addEventListener('change', e => AppsPage.onEdit(e.target));
  },

  rowHtml({ s, cur, wait, r }) {
    const head = `<td class="num">${r?.jobRank ?? ''}</td><td class="num mono">${esc(s.no3)}</td><td>${esc(s.name)}</td><td class="sm">${AppsPage.history(s.id)}</td>`;
    if (wait) {
      return `<tr class="res-none">${head}<td class="c">${cur ? cur.round + 1 : 1}</td>
        <td colspan="7"><button class="btn btn-sm" data-next="${s.id}">${(cur ? cur.round + 1 : 1)}次の応募先を決める</button></td></tr>`;
    }
    const a = cur, job = Apps.job(a);
    const fld = (k, type = 'text', cls = '') => `<input type="${type}" data-aid="${a.id}" data-f="${k}" value="${esc(a[k] || '')}" class="${cls}">`;
    return `<tr class="res-${a.result || 'none'}">${head}<td class="c">${a.round}</td>
      <td class="sm">${job ? `<span class="mono">${esc(Derive.short(job))}</span> ${esc(job.company)}<br><span class="sub">${esc(job.jobTitle || '')}</span>` : '—'}</td>
      <td>${fld('examDate', 'date', 'w-date')}</td><td>${fld('examTime', 'text', 'w-time')}</td>
      <td><select data-aid="${a.id}" data-f="result">${RESULTS.map(v => `<option value="${v}" ${a.result === v ? 'selected' : ''}>${v || '—'}</option>`).join('')}</select></td>
      <td>${fld('resultDate', 'date', 'w-date')}</td><td>${fld('note', 'text', 'w-memo')}</td></tr>`;
  },
};

Pages.register({ id: 'second', no: 7, group: '見学・応募', title: '2次応募', render: v => SecondPage.render(v) });
