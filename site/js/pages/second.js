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
        <div class="stat"><span class="stat-label">〇 内定</span><span class="stat-val">${won.length}</span><span class="stat-unit">人</span></div>
      </div>
      <div class="toolbar">
        <div class="seg">${[['', 'すべて'], ['未定', '応募先が未定'], ['待', '結果待ち'], ['内定', '内定']]
          .map(([v, l]) => `<button class="${f === v ? 'on' : ''}" data-filter="${v}">${l}</button>`).join('')}</div>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="tbl tbl-edit tbl-apps" id="scTable">
        <thead><tr><th class="num">就職順位</th><th class="num">番号</th><th>氏名</th><th>前の応募（合否を直せます）</th><th>何次</th><th>応募先</th><th>試験日</th><th>時間</th><th>合否</th><th>結果日</th><th>メモ</th><th></th></tr></thead>
        <tbody>${rows.map(x => this.rowHtml(x)).join('')}</tbody></table></div>`
        : `<div class="empty"><p class="empty-title">${all.length ? '該当する生徒はいません' : '2次応募の対象者はまだいません'}</p><p>「応募・受験」で合否を「不採用」または「辞退」にすると、ここに並びます。</p></div>`}
      ${Store.data.applications.some(a => a.confirmed && a.round >= 2) ? `<details class="card-fold" ${this.state.sendOpen ? 'open' : ''} id="scSend"><summary>応募書類の送付（2次以降の応募先の送付状・宛名ラベル）</summary>${(SendDocs.state.minRound = 2, SendDocs.html())}</details>` : ''}
`;
    $$('[data-filter]', view).forEach(b => b.addEventListener('click', () => { this.state.filter = b.dataset.filter; UI.refresh(); }));
    $('#scPrint', view).addEventListener('click', () => AppsPage.printNext());
    $$('[data-next]', view).forEach(b => b.addEventListener('click', () => AppsPage.addNext(b.dataset.next)));
    if ($('#sendCard', view)) SendDocs.bind($('#sendCard', view));
    if ($('#scSend', view)) $('#scSend', view).addEventListener('toggle', e => { this.state.sendOpen = e.target.open; });
    const tbl = $('#scTable', view);
    if (tbl) {
      tbl.addEventListener('change', async e => {
        const t = e.target;
        AppsPage.onEdit(t);
        if (t.dataset.f !== 'result') return;
        // 前の応募の合否を「不採用・辞退」でなくしたとき：その後の2次以降の応募が残っていれば、取り消すか聞く
        const a = Store.data.applications.find(x => x.id === t.dataset.aid);
        if (a && a.result !== '不採用' && a.result !== '辞退') {
          const later = Apps.of(a.studentId).filter(x => x.confirmed && x.round > a.round);
          if (later.length && await UI.confirm(`合否を戻したので、この生徒の${later.map(x => x.round + '次').join('・')}の応募も取り消しますか？\n（取り消さないと、2次以降の応募が残ります）`, { ok: '2次以降も取り消す' })) {
            Store.data.applications = Store.data.applications.filter(x => !later.includes(x));
            Store.changed();
          }
        }
        UI.refresh();      // 並び（応募先が未定／結果待ち）が変わるので、この画面は描き直す
      });
      tbl.addEventListener('click', async e => {
        const b = e.target.closest('[data-delapp]'); if (!b) return;
        const a = Store.data.applications.find(x => x.id === b.dataset.delapp); if (!a) return;
        const j = Apps.job(a);
        if (!await UI.confirm(`${a.round}次の応募（${j ? j.company : '求人なし'}）を取り消します。\n応募の記録（試験日・合否など）は消えます。`, { ok: '取り消す', danger: true })) return;
        Store.data.applications = Store.data.applications.filter(x => x !== a);
        Store.changed(); UI.refresh();
        UI.toast(`${a.round}次の応募を取り消しました`);
      });
    }
  },

  /** 前の応募（合否を直せる）。応募先が未定の人は、いちばん新しい応募（不採用にした応募）も直せる */
  histCell(s, includeCurrent) {
    const cur = Apps.current(s.id);
    const list = Apps.of(s.id).filter(a => a.confirmed && (includeCurrent || a !== cur)).sort((a, b) => a.round - b.round);
    if (!list.length) return '<span class="sub">なし</span>';
    return list.map(a => {
      const j = Apps.job(a);
      return `<div class="sc-h"><b>${a.round}次</b> ${esc(j ? j.company : '?')}
        <select data-aid="${a.id}" data-f="result">${RESULTS.map(v => `<option value="${v}" ${a.result === v ? 'selected' : ''}>${AppsPage.resultLabel(v)}</option>`).join('')}</select>
        ${a.round >= 2 ? `<button class="link-btn" data-delapp="${a.id}" title="この応募を取り消す">取り消し</button>` : ''}</div>`;
    }).join('');
  },

  rowHtml({ s, cur, wait, r }) {
    const head = `<td class="num">${r?.jobRank ?? ''}</td><td class="num mono">${esc(s.no3)}</td><td>${esc(s.name)}</td><td class="sm">${this.histCell(s, wait)}</td>`;
    if (wait) {
      return `<tr class="res-none">${head}<td class="c">${cur ? cur.round + 1 : 1}</td>
        <td colspan="7"><button class="btn btn-sm" data-next="${s.id}">${(cur ? cur.round + 1 : 1)}次の応募先を決める</button></td></tr>`;
    }
    const a = cur, job = Apps.job(a);
    const fld = (k, type = 'text', cls = '') => `<input type="${type}" data-aid="${a.id}" data-f="${k}" value="${esc(a[k] || '')}" class="${cls}">`;
    return `<tr class="res-${a.result || 'none'}">${head}<td class="c">${a.round}</td>
      <td class="sm">${job ? `<span class="mono">${esc(Derive.short(job))}</span> ${esc(job.company)}<br><span class="sub">${esc(job.jobTitle || '')}</span>` : '—'}</td>
      <td>${fld('examDate', 'date', 'w-date')}</td><td>${fld('examTime', 'text', 'w-hm')}</td>
      <td><select data-aid="${a.id}" data-f="result">${RESULTS.map(v => `<option value="${v}" ${a.result === v ? 'selected' : ''}>${AppsPage.resultLabel(v)}</option>`).join('')}</select></td>
      <td>${fld('resultDate', 'date', 'w-date')}</td><td>${fld('note', 'text', 'w-memo')}</td>
      <td>${a.round >= 2 ? `<button class="link-btn" data-delapp="${a.id}" title="この応募を取り消す">取り消し</button>` : ''}</td></tr>`;
  },
};

Pages.register({ id: 'second', no: 7, group: '見学・応募', title: '2次応募', render: v => SecondPage.render(v) });
