'use strict';
/* ============================================================
   7. 2次応募（1次で内定しなかった生徒の、2次以降の応募先と結果）
   ============================================================ */

/** 2次選考会議の確認リスト（空白→〇→済→空白 と押すたびに変わる）。生徒ごとに、いまの次（2次・3次…）の分を記録する */
const SECOND_CHECKS = [['line', '一覧表線引き'], ['form', '求職確認書'], ['meet', '選考会議'], ['addrTel', '送付先住所確認Tel'], ['mailTel', '郵送した旨Tel']];
const CHECK_STEPS = ['', '〇', '済'];

const SecondPage = {
  state: { filter: '' },

  chkCell(s) {
    return SECOND_CHECKS.map(([k, l]) => `<td class="c"><button type="button" class="chk-btn" data-chk="${k}" data-sid="${s.id}" title="${l}（押すと 空白→〇→済 と変わります）">${esc((s.second || {})[k] || '')}</button></td>`).join('');
  },

  /** 1度でも不採用・辞退になった就職希望者（就職順位つき） */
  rows() {
    const rk = new Map(Points.ranking().map(r => [r.s.id, r]));
    return Store.data.students.filter(s => Students.isJobSeeker(s)).map(s => {
      const list = Apps.of(s.id).filter(a => a.confirmed);
      const cur = Apps.current(s.id);
      // 進路を変えて就職に加わった生徒は、1次に出せないので、最初から2次の対象にする
      const failed = list.some(a => a.result === '不採用' || a.result === '辞退') || Students.lateEntrant(s);
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
        <div><h1>選考会議（2次）</h1><p class="lead">1次で内定しなかった（不採用・辞退）生徒が、ここに自動で並びます。応募先を決め、試験日・合否まで続けて記録します。右端の確認欄（一覧表線引き〜郵送した旨Tel）は、押すたびに 空白→〇→済 と変わり、会議資料にも同じ印が出ます。</p></div>
        <div class="head-actions">
          <button class="btn btn-primary" id="scPrint" ${all.length ? '' : 'disabled'}>2次選考会議の資料を印刷</button>
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
        <thead><tr><th class="num">就職順位</th><th class="num">番号</th><th>氏名</th><th>前の応募（合否を直せます）</th><th>何次</th><th>応募先</th><th>試験日</th><th>時間</th><th>合否</th><th>結果日</th><th>メモ</th>${SECOND_CHECKS.map(([, l]) => `<th class="chk-th">${l}</th>`).join('')}<th></th></tr></thead>
        <tbody>${rows.map(x => this.rowHtml(x)).join('')}</tbody></table></div>`
        : `<div class="empty"><p class="empty-title">${all.length ? '該当する生徒はいません' : '2次の対象者はまだいません'}</p><p>「応募・受験」で合否を「不採用」または「辞退」にすると、ここに並びます。</p></div>`}
      ${Store.data.applications.some(a => a.confirmed && a.round >= 2) ? `<details class="card-fold" ${this.state.sendOpen ? 'open' : ''} id="scSend"><summary>応募書類の送付（2次以降の応募先の送付状・宛名ラベル）</summary>${(SendDocs.state.minRound = 2, SendDocs.html())}</details>` : ''}
`;
    $$('[data-filter]', view).forEach(b => b.addEventListener('click', () => { this.state.filter = b.dataset.filter; UI.refresh(); }));
    $('#scPrint', view).addEventListener('click', () => this.printMeeting());
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
        const c = e.target.closest('[data-chk]');
        if (c) {
          const st = Students.byId(c.dataset.sid); if (!st) return;
          st.second = Object.assign({}, st.second);
          st.second[c.dataset.chk] = CHECK_STEPS[(CHECK_STEPS.indexOf(st.second[c.dataset.chk] || '') + 1) % CHECK_STEPS.length];
          c.textContent = st.second[c.dataset.chk]; Store.changed(); return;
        }
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

  /** 2次選考会議の資料（A4 横）。1度でも不採用・辞退になった就職希望者を並べ、会議で書き込む欄をつける。内定した人の行は網掛け */
  printMeeting() {
    const all = this.rows();
    const md = iso => { const d = parseISO(iso); return d ? `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})` : ''; };
    const when = (date, time) => [md(date), time].filter(Boolean).join('');
    const round = Math.max(2, ...all.filter(x => x.wait && x.cur).map(x => x.cur.round + 1));
    const title = `選考会議後の学校斡旋就職希望者（${round}次）`;
    const cell = (v, cls = '') => `<td class="${cls}">${v === '' ? '' : v}</td>`;
    const chk = (s, k) => { const v = (s.second || {})[k]; return `<td>${v === '〇' ? '<span class="sc-o"></span>' : v === '済' ? '済' : ''}</td>`; };
    const rowHtml = ({ s, cur, wait }) => {
      const a = wait ? null : cur, job = a ? Apps.job(a) : null, won = !!a && a.result === '内定';
      return `<tr class="${won ? 'p-shade' : ''}">${cell(esc(s.no3), 'sc-no')}${cell(esc(s.name))}
        ${cell(job ? esc(Derive.short(job)) : '', 'sc-dl r')}${cell(job ? esc(job.company) : '', 'sc-dl l sm')}${cell(job ? esc(job.jobTitle || '') : '', 'sc-dl l xs')}
        ${chk(s, 'line')}${cell(a ? esc(when(a.visitDate, a.visitTime)) : '', 'sm')}${chk(s, 'form')}${chk(s, 'meet')}${chk(s, 'addrTel')}
        ${cell(a && a.docsSent ? esc(md(a.docsSentDate) || '〇') : '', 'sm')}${chk(s, 'mailTel')}${cell(a ? esc(when(a.examDate, a.examTime)) : '', 'sm')}
        ${cell(a && a.reportSubmitted ? '〇' : '')}${cell(a && a.result ? (a.result === '内定' ? '〇' : '×') : '')}</tr>`;
    };
    const blank = () => `<tr>${cell('', 'sc-no')}${'<td></td>'.repeat(14)}</tr>`;
    const body = all.map(rowHtml).join('') + Array(Math.max(0, 10 - all.length)).fill(blank()).join('');
    const circle = '<span class="sc-o"></span>';
    const sample = `<tr class="sc-ex"><td>例</td><td>〇〇　〇〇</td><td class="sc-dl r">50</td><td class="sc-dl l sm">ダミー1株式会社<br>〇〇工場</td><td class="sc-dl l xs">製造担当職</td>
      <td>${circle}</td><td class="sm l">1/10(金)14:09～</td><td>${circle}</td><td>${circle}</td><td>${circle}</td><td class="xs">求人票マーカー先に送付<br>〇</td><td>${circle}</td><td class="sm">職場見学と同日実施</td><td>${circle}</td><td>${circle}</td></tr>`;
    const th = (t, cls = '') => `<th class="${cls}">${t}</th>`;
    const head = `<tr>${th('生徒番号')}${th('氏名')}<th colspan="3">志望企業情報</th>${th('一覧表<br>線引き', 'xs')}${th('職場見学日時')}${th('求職<br>確認書', 'sm')}${th('選考<br>会議', 'sm')}${th('送付先住所<br>確認Tel', 'xxs')}${th('書類送付')}${th('郵送した旨Tel<br><span class="xs">(試験日書面依頼)</span>', 'sm')}${th('試験日')}${th('結果<br>報告書', 'sm')}${th('合否')}</tr>`;
    const widths = [14.6, 20, 10.6, 32.7, 20, 8.2, 27.5, 10.1, 7.5, 10.4, 21.9, 21.6, 28.5, 9.2, 8.7];
    Print.open({
      title: `2次選考会議資料_${nendoLabel(Store.data.year)}`, orientation: 'landscape', margin: '8mm 6mm 6mm 6mm',
      html: `<div class="p-page sc-sheet">
        <div class="sc-head"><div><p class="sc-title">${esc(title)}</p><p class="sc-note">※網掛けは進路決定済みの生徒</p></div><div class="sc-warn">※取扱注意※</div></div>
        <table class="sc-tbl"><colgroup>${widths.map(w => `<col style="width:${w}mm">`).join('')}</colgroup>
        <thead>${head}</thead><tbody>${body}${sample}</tbody></table></div>`,
    });
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
      const nr = cur ? cur.round + 1 : 2;
      return `<tr class="res-none">${head}<td class="c">${nr}</td>
        <td colspan="6"><button class="btn btn-sm" data-next="${s.id}">${nr}次の応募先を決める</button></td>${this.chkCell(s)}<td></td></tr>`;
    }
    const a = cur, job = Apps.job(a);
    const fld = (k, type = 'text', cls = '') => `<input type="${type}" data-aid="${a.id}" data-f="${k}" value="${esc(a[k] || '')}" class="${cls}">`;
    return `<tr class="res-${a.result || 'none'}">${head}<td class="c">${a.round}</td>
      <td class="sm">${job ? `<span class="mono">${esc(Derive.short(job))}</span> ${esc(job.company)}<br><span class="sub">${esc(job.jobTitle || '')}</span>` : '—'}</td>
      <td>${fld('examDate', 'date', 'w-date')}</td><td>${fld('examTime', 'text', 'w-hm')}</td>
      <td><select data-aid="${a.id}" data-f="result">${RESULTS.map(v => `<option value="${v}" ${a.result === v ? 'selected' : ''}>${AppsPage.resultLabel(v)}</option>`).join('')}</select></td>
      <td>${fld('resultDate', 'date', 'w-date')}</td><td>${fld('note', 'text', 'w-memo')}</td>${this.chkCell(s)}
      <td>${a.round >= 2 ? `<button class="link-btn" data-delapp="${a.id}" title="この応募を取り消す">取り消し</button>` : ''}</td></tr>`;
  },
};

Pages.register({ id: 'second', no: 7, group: '見学・応募', title: '選考会議（2次）', render: v => SecondPage.render(v) });
