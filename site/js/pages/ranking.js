'use strict';
/* ============================================================
   3. 校内順位
   ============================================================ */

const RankingPage = {
  state: { scope: 'job' },   // job＝就職希望者（学校斡旋）／all＝全員

  rows() {
    const all = Points.ranking();
    const key = this.state.scope === 'job' ? 'jobRank' : 'overall';
    const list = this.state.scope === 'job' ? all.filter(r => Students.isJobSeeker(r.s)) : all;
    return { key, list: sortRows(list, key, 'asc', r => r[key] ?? null) };
  },

  render(view) {
    const st = this.state;
    const r = Store.data.settings.pointRules;
    const { key, list } = this.rows();
    const seekers = Store.data.students.filter(s => Students.isJobSeeker(s)).length;
    const warns = list.filter(x => x.p.warn.length).length;
    const ties = list.filter(x => x[key + 'Tie']).length;
    const noMogi = list.filter(x => x.s.mogi == null).length;

    view.innerHTML = `
      <div class="page-head">
        <div><h1>校内順位</h1><p class="lead">「校内選考に関する規定」Ⅰ-2 のとおりに計算します。入力を直すと即座に反映されます。</p></div>
        <div class="head-actions">
          <button class="btn" id="rkXlsx" ${list.length ? '' : 'disabled'}>Excel に出力</button>
          <button class="btn btn-primary" id="rkPrint" ${list.length ? '' : 'disabled'}>印刷</button>
        </div>
      </div>
      <details class="card card-quiet rule-box">
        <summary><b>計算のしかた</b>（クリックで表示）</summary>
        <ul class="plain">
          <li><b>学習P</b>＝1年〜3年1学期の評定平均（小数第2位を四捨五入）</li>
          <li><b>生活P</b>＝欠席（${r.absence.map(x => `${x.max}日以下 ${x.p}`).join('／')}）＋遅刻早退（${r.lateEarly.map(x => `${x.max}回以下 ${x.p}`).join('／')}）＋3年で謹慎なし ${r.noDiscipline3}＋1・2年で謹慎なし ${r.noDiscipline12}</li>
          <li><b>特活P</b>＝3年部活在籍 ${r.club}＋部長 ${r.captain}＋生徒会 1期 ${r.councilPer}（上限 ${r.councilMax}）</li>
          <li><b>順位</b>＝最終P → 生活P → 特活P（それぞれ高い順）→ 校内模試の順位（上位順）。すべて同じなら同順位とし、選考会議で判断（規定3）。</li>
        </ul>
      </details>
      <div class="toolbar">
        <div class="seg">
          <button class="${st.scope === 'job' ? 'on' : ''}" data-scope="job">就職希望者（学校斡旋）${seekers} 人</button>
          <button class="${st.scope === 'all' ? 'on' : ''}" data-scope="all">全員 ${Store.data.students.length} 人</button>
        </div>
      </div>
      ${warns ? `<div class="notice notice-warn">評定または出欠が入っていない生徒が ${warns} 人います（「注意」列）。</div>` : ''}
      ${ties ? `<div class="notice notice-info">同順位が ${ties} 人います。同じ求人を希望して求人数を超える場合は、選考会議で判断します。</div>` : ''}
      ${list.length && noMogi ? `<p class="help">模試順位が未入力：${noMogi} 人（同点時の順位決定にだけ使います）</p>` : ''}
      <div id="rkTable"></div>`;

    $$('[data-scope]', view).forEach(b => b.addEventListener('click', () => { st.scope = b.dataset.scope; UI.refresh(); }));
    $('#rkPrint', view).addEventListener('click', () => this.print());
    $('#rkXlsx', view).addEventListener('click', () => this.excel());
    this.drawTable($('#rkTable', view), key, list);
  },

  drawTable(el, key, list) {
    if (!list.length) {
      el.innerHTML = `<div class="empty"><p class="empty-title">対象の生徒がいません</p>
        <p>「生徒・成績」で名簿・評定・出欠と進路希望を取り込むと、ここに順位が表示されます。</p></div>`;
      return;
    }
    el.innerHTML = `<div class="table-wrap"><table class="tbl tbl-click">
      <thead><tr><th class="num">順位</th>${key === 'jobRank' ? '<th class="num">全体</th>' : ''}<th class="num">番号</th><th>氏名</th><th>性</th><th>学科</th>
      <th class="num">学習P</th><th class="num">生活P</th><th class="num">特活P</th><th class="num">最終P</th><th class="num">模試</th><th>注意</th></tr></thead>
      <tbody>${list.map(x => `<tr data-id="${x.s.id}">
        <td class="num"><b>${x[key] ?? '—'}</b>${x[key + 'Tie'] ? ' <span class="tag tag-info">同順位</span>' : ''}</td>
        ${key === 'jobRank' ? `<td class="num sub">${x.overall ?? ''}</td>` : ''}
        <td class="num mono">${esc(x.s.no3)}</td><td>${esc(x.s.name)}</td><td>${esc(x.s.gender)}</td><td>${esc((Students.dept(x.s) || {}).short || '')}</td>
        <td class="num">${x.p.learning ?? ''}</td>
        <td class="num" title="欠席${x.p.absentTotal}日→${x.p.absentP}／遅刻早退${x.p.lateTotal}回→${x.p.lateP}／謹慎なし ${x.p.d3P}+${x.p.d12P}">${x.p.life}</td>
        <td class="num" title="部活${x.p.clubP}／部長${x.p.capP}／生徒会${x.p.councilP}">${x.p.special}</td>
        <td class="num"><b>${x.p.final ?? ''}</b></td><td class="num">${x.s.mogi ?? ''}</td>
        <td>${x.p.warn.map(w => `<span class="tag tag-warn">${esc(w)}</span>`).join(' ')}</td></tr>`).join('')}
      </tbody></table></div>`;
    $$('tbody tr', el).forEach(tr => tr.addEventListener('click', () => StudentsPage.edit(tr.dataset.id)));
  },

  table() {
    const { key, list } = this.rows();
    const head = ['順位', ...(key === 'jobRank' ? ['全体'] : []), '番号', '氏名', '性別', '学科', '学習P', '生活P', '特活P', '最終P', '模試', '欠席計', '遅刻早退計', '備考'];
    const body = list.map(x => [x[key] ?? '', ...(key === 'jobRank' ? [x.overall ?? ''] : []), Number(x.s.no3), x.s.name, x.s.gender,
      (Students.dept(x.s) || {}).short || '', x.p.learning ?? '', x.p.life, x.p.special, x.p.final ?? '', x.s.mogi ?? '', x.p.absentTotal, x.p.lateTotal,
      [x[key + 'Tie'] ? '同順位' : '', ...x.p.warn].filter(Boolean).join('・')]);
    return { head, body, title: `${nendoLabel(Store.data.year)}　校内選考ポイント一覧（${key === 'jobRank' ? '就職希望者' : '全員'}）` };
  },

  print() {
    const { head, body, title } = this.table();
    Print.open({
      title, orientation: 'portrait',
      html: `<div class="p-page"><p class="p-title">${esc(title)}</p>
        <p class="p-meta"><span>${esc(Store.data.settings.school.name)}</span><span>${todayISO()} 現在　${body.length} 人</span></p>
        <table class="p-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body.map(r => `<tr>${r.map((v, i) => `<td class="${typeof v === 'number' ? 'num' : ''} ${i === r.length - 1 ? 'sm' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <p class="p-note">※取扱注意（個人情報）</p></div>`,
    });
  },

  excel() {
    const { head, body, title } = this.table();
    Excel.download(`校内選考ポイント_R${reiwa(Store.data.year)}.xlsx`, [{ name: '校内順位', rows: [[title], head, ...body], widths: [6, 6, 7, 16, 5, 5, 7, 7, 7, 7, 6, 7, 9, 16] }]);
  },
};

Pages.register({ id: 'ranking', no: 3, group: '選考', title: '校内順位', render: v => RankingPage.render(v) });
