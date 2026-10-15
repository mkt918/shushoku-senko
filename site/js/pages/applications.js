'use strict';
/* ============================================================
   6. 応募・受験（書類送付・試験日・合否・受験報告書・2次以降）
   ============================================================ */

const AppsPage = {
  state: { filter: '', sort: 'no3' },

  rows() {
    const rk = new Map(Points.ranking().map(r => [r.s.id, r]));
    return Apps.currents()
      .map(({ s, a }) => ({ s, a, job: Apps.job(a), r: rk.get(s.id) }))
      .filter(x => this.state.filter === '' ? true
        : this.state.filter === '未' ? !x.a.result
          : x.a.result === this.state.filter);
  },

  /** 応募先がない、または直近の応募が不採用・辞退で次が必要な就職希望者 */
  needNext() {
    return Store.data.students.filter(s => Students.isJobSeeker(s)).filter(s => {
      const a = Apps.current(s.id);
      return !a || a.result === '不採用' || a.result === '辞退';
    });
  },

  render(view) {
    const rows = sortRows(this.rows(), this.state.sort, 'asc', (x, k) => k === 'no3' ? num(x.s.no3) : k === 'exam' ? x.a.examDate : x.a.round);
    const all = Apps.currents();
    const cnt = k => all.filter(x => x.a.result === k).length;
    const need = this.needNext();
    view.innerHTML = `
      <div class="page-head">
        <div><h1>応募・受験</h1><p class="lead">確定した応募先ごとに、書類送付・試験日・合否・受験報告書を記録します。合否は様式13や統計に自動で反映されます。</p></div>
        <div class="head-actions">
          <button class="btn" id="apNextPrint" ${need.length ? '' : 'disabled'}>2次以降の選考資料を印刷</button>
        </div>
      </div>
      <div id="apStats">${this.statsHtml()}</div>

      ${all.length ? SendDocs.html() : ''}
      <div class="toolbar">
        <div class="seg">${[['', 'すべて'], ['未', '結果待ち'], ['内定', '〇 内定'], ['不採用', '× 不採用'], ['辞退', '辞退']]
          .map(([v, l]) => `<button class="${this.state.filter === v ? 'on' : ''}" data-filter="${v}">${l}</button>`).join('')}</div>
        <select id="apSort"><option value="no3">番号順</option><option value="exam" ${this.state.sort === 'exam' ? 'selected' : ''}>試験日順</option></select>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="tbl tbl-edit tbl-apps" id="apTable">
        <thead><tr><th class="num">番号</th><th>氏名</th><th>次</th><th>応募先</th><th>書類送付</th><th>試験日</th><th>時間</th><th>合否</th><th>結果日</th><th>報告書（3日以内）</th><th>メモ</th></tr></thead>
        <tbody>${rows.map(x => this.rowHtml(x)).join('')}</tbody></table></div>`
        : '<div class="empty"><p class="empty-title">該当する応募はありません</p><p>「選考会議」で応募先を確定すると、ここに並びます。</p></div>'}

      <div id="apNeed">${this.needHtml(need)}</div>
`;

    $$('[data-filter]', view).forEach(b => b.addEventListener('click', () => { this.state.filter = b.dataset.filter; UI.refresh(); }));
    $('#apSort', view).addEventListener('change', e => { this.state.sort = e.target.value; UI.refresh(); });
    view.addEventListener('click', e => { const b = e.target.closest('[data-next]'); if (b) this.addNext(b.dataset.next); });
    $('#apNextPrint', view).addEventListener('click', () => this.printNext());
    if (all.length) SendDocs.bind($('#sendCard', view));
    const tbl = $('#apTable', view);
    if (tbl) tbl.addEventListener('change', e => this.onEdit(e.target));
  },

  resultLabel(v) { return v === '内定' ? '〇 内定' : v === '不採用' ? '× 不採用' : (v || '—'); },

  statsHtml() {
    const all = Apps.currents(), need = this.needNext();
    const cnt = k => all.filter(x => x.a.result === k).length;
    return `<div class="stats stats-sm">
        <div class="stat"><span class="stat-label">応募中（確定済み）</span><span class="stat-val">${all.length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">〇 内定</span><span class="stat-val">${cnt('内定')}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">結果待ち</span><span class="stat-val">${all.filter(x => !x.a.result).length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">次の応募先が必要</span><span class="stat-val">${need.length}</span><span class="stat-unit">人</span></div>
      </div>`;
  },
  needHtml(need) {
    return need.length ? `<section class="card">
        <h2>次の応募先が必要な生徒</h2>
        <p class="sub">応募先が未確定、または直近の結果が不採用・辞退の就職希望者です。</p>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th class="num">番号</th><th>氏名</th><th>これまでの応募</th><th></th></tr></thead>
          <tbody>${need.map(s => `<tr><td class="num mono">${esc(s.no3)}</td><td>${esc(s.name)}</td>
            <td class="sm">${this.history(s.id) || '<span class="sub">なし</span>'}</td>
            <td><button class="btn btn-sm" data-next="${s.id}">応募先を決める</button></td></tr>`).join('')}</tbody>
        </table></div>
      </section>` : '';
  },
  /** 合否を変えたとき：上の人数と、下の「次の応募先が必要」だけ描き直す */
  redrawSummary() {
    const s = $('#apStats'), n = $('#apNeed');
    if (s) s.innerHTML = this.statsHtml();
    if (n) n.innerHTML = this.needHtml(this.needNext());
    const b = $('#apNextPrint'); if (b) b.disabled = !this.needNext().length;
  },

  history(studentId) {
    return Apps.of(studentId).filter(a => a.confirmed).sort((a, b) => a.round - b.round).map(a => {
      const j = Apps.job(a);
      return `${a.round}次 ${esc(j ? j.company : '?')}${a.result ? `→<b>${esc(this.resultLabel(a.result))}</b>` : '（結果待ち）'}`;
    }).join('<br>');
  },

  rowHtml({ s, a, job }) {
    const f = (k, type = 'text', cls = '') => `<input type="${type}" data-aid="${a.id}" data-f="${k}" value="${esc(a[k] || '')}" class="${cls}">`;
    const ck = k => `<input type="checkbox" data-aid="${a.id}" data-f="${k}" ${a[k] ? 'checked' : ''}>`;
    return `<tr class="res-${a.result || 'none'}">
      <td class="num mono">${esc(s.no3)}</td><td>${esc(s.name)}</td><td class="c">${a.round}</td>
      <td class="sm">${job ? `<span class="mono">${esc(Derive.short(job))}</span> ${esc(job.company)}<br><span class="sub">${esc(job.jobTitle || '')}</span>` : '—'}</td>
      <td class="nowrap">${ck('docsSent')} ${f('docsSentDate', 'date', 'w-date')}</td>
      <td>${f('examDate', 'date', 'w-date')}</td><td>${f('examTime', 'text', 'w-hm')}</td>
      <td><select data-aid="${a.id}" data-f="result">${RESULTS.map(r => `<option value="${r}" ${a.result === r ? 'selected' : ''}>${this.resultLabel(r)}</option>`).join('')}</select></td>
      <td>${f('resultDate', 'date', 'w-date')}</td><td class="c">${ck('reportSubmitted')}</td><td>${f('note', 'text', 'w-memo')}</td></tr>`;
  },

  onEdit(el) {
    const a = Store.data.applications.find(x => x.id === el.dataset.aid);
    if (!a) return;
    const k = el.dataset.f;
    a[k] = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (k === 'examTime') { a[k] = el.value = VisitsPage.hm(el.value); }
    if (k === 'docsSent' && el.checked && !a.docsSentDate) a.docsSentDate = todayISO();
    if (k === 'result') {      // 合否を選ぶと結果日に今日が入る（わからなければそのままでよい。空欄でも内定として数える）
      if (a.result && !a.resultDate) a.resultDate = todayISO();
      if (!a.result) a.resultDate = '';
    }
    Store.changed();
    if (k === 'result') {
      // 画面全体は描き直さず、この行の色と結果日、上の人数・下の一覧だけ更新する（毎回の再表示をしない）
      const tr = el.closest('tr'); if (tr) { tr.className = 'res-' + (a.result || 'none'); const d = tr.querySelector('[data-f="resultDate"]'); if (d) d.value = a.resultDate || ''; }
      this.redrawSummary();
    }
  },

  /** 次の応募先（2次以降）を決める */
  async addNext(studentId) {
    const s = Students.byId(studentId);
    const cur = Apps.current(studentId);
    const round = cur ? cur.round + 1 : 1;
    const body = document.createElement('div');
    body.innerHTML = `<p>${esc(Students.label(s))}　の <b>${round}次</b> の応募先</p>
      <input type="search" id="nxQ" class="w-full" placeholder="下4桁・事業所名・職種で検索"><div id="nxList" class="pick-list"></div>`;
    let chosen = null;
    const used = new Set(Apps.of(studentId).filter(a => a.confirmed).map(a => a.jobId));
    const draw = () => {
      const q = toHalf($('#nxQ', body).value).trim().toLowerCase();
      const list = Store.data.jobs.filter(j => !q || [Derive.short(j), j.company, j.jobTitle].some(v => v && toHalf(v).toLowerCase().includes(q))).slice(0, 80);
      $('#nxList', body).innerHTML = list.map(j => `<button class="pick-item ${chosen === j.id ? 'on' : ''}" data-id="${j.id}">
        <span class="mono">${esc(Derive.short(j) || '—')}</span><span class="pk-main"><b>${esc(j.company)}</b><small>${esc(j.jobTitle || '')}</small></span>${used.has(j.id) ? '<span class="tag">応募済み</span>' : '<span></span>'}</button>`).join('') || '<p class="sub">見つかりません</p>';
    };
    const res = await UI.modal({
      title: `${round}次の応募先`, body, wide: true,
      buttons: [{ label: 'キャンセル', value: null }, { label: '確定する', kind: 'primary', value: 'ok', onClick: () => { if (!chosen) { UI.toast('求人を選んでください', 'warn'); return false; } } }],
      onOpen: root => {
        draw();
        $('#nxQ', root).addEventListener('input', draw);
        root.addEventListener('click', e => { const it = e.target.closest('.pick-item'); if (it) { chosen = it.dataset.id; draw(); } });
      },
    });
    if (res !== 'ok') return;
    const a = blankApplication(studentId, chosen, round, 1);
    a.confirmed = true;
    Store.data.applications.push(a);
    Store.changed();
    UI.refresh();
    UI.toast(`${round}次の応募先を確定しました`);
  },

  printNext() {
    const rk = new Map(Points.ranking().map(r => [r.s.id, r]));
    const list = this.needNext().map(s => ({ s, r: rk.get(s.id) })).sort((x, y) => (x.r.jobRank ?? 1e9) - (y.r.jobRank ?? 1e9));
    const title = `${nendoLabel(Store.data.year)}　就職選考会議資料（2次以降）`;
    Print.open({
      title, orientation: 'portrait',
      html: `<div class="p-page"><p class="p-title">${esc(title)}</p><p class="p-meta"><span>※取扱注意（個人情報）</span><span>${todayISO()}　${list.length} 人</span></p>
        <table class="p-table"><thead><tr><th>就職順位</th><th>番号</th><th>氏名</th><th>性別</th><th>最終P</th><th>生活P</th><th>特活P</th><th>模試</th><th>これまでの応募</th><th>次の希望</th></tr></thead>
        <tbody>${list.map(({ s, r }) => `<tr><td class="num">${r.jobRank ?? ''}</td><td>${esc(s.no3)}</td><td>${esc(s.name)}</td><td class="c">${esc(s.gender)}</td>
          <td class="num">${r.p.final ?? ''}</td><td class="num">${r.p.life}</td><td class="num">${r.p.special}</td><td class="num">${s.mogi ?? ''}</td>
          <td class="sm">${this.history(s.id)}</td><td style="width:45mm"></td></tr>`).join('')}</tbody></table></div>`,
    });
  },
};

Pages.register({ id: 'applications', no: 6, group: '見学・応募', title: '応募・受験', render: v => AppsPage.render(v) });
