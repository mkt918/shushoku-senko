'use strict';
/* ============================================================
   7. 選考会議（2次）（1次で内定しなかった生徒の、2次以降の応募先と結果）
   ============================================================ */

/** 2次選考会議の確認リスト（空白→〇→済→空白 と押すたびに変わる）。生徒ごとに、いまの次（2次・3次…）の分を記録する */
const SECOND_CHECKS = [['meet', '選考会議'], ['form', '求職確認書'], ['addrTel', '送付先住所確認Tel'], ['mailTel', '郵送した旨Tel']];
const CHECK_STEPS = ['', '〇', '済'];
const SECOND_SHORT = { meet: '選考会議', form: '確認書', addrTel: '住所Tel', mailTel: '郵送Tel' };   // ボタンに出す短い名前

const SecondPage = {
  state: { filter: '' },

  /** 会議の確認リスト：横に4つ並べたボタン。押すたびに 空白→〇→済 と変わる */
  chkChips(s) {
    return `<div class="chk-row">${SECOND_CHECKS.map(([k, l]) => {
      const v = (s.second || {})[k] || '';
      return `<button type="button" class="chk-chip ${v === '済' ? 'is-done' : v ? 'is-on' : ''}" data-chk="${k}" data-sid="${s.id}" title="${l}（押すと 空白→〇→済 と変わります）"><span>${SECOND_SHORT[k]}</span><b>${esc(v)}</b></button>`;
    }).join('')}</div>`;
  },

  /** 1度でも不採用・辞退になった就職希望者（就職順位つき） */
  rows() {
    const rk = new Map(Points.ranking().map(r => [r.s.id, r]));
    return Store.data.students.filter(s => Students.isJobSeeker(s)).map(s => {
      const added = !!(s.second && s.second.added);
      const list = Apps.of(s.id).filter(a => a.confirmed);
      const cur = Apps.current(s.id);
      // 進路を変えて就職に加わった生徒は、1次に出せないので、最初から2次の対象にする
      const removed = !!(s.second && s.second.removed) && !list.length;      // 「外す」を押した（応募がまだない）
      const failed = !removed && (list.some(a => a.result === '不採用' || a.result === '辞退') || Students.lateEntrant(s) || added);
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
        <div><h1>選考会議（2次）</h1><p class="lead">1次で内定しなかった（不採用・辞退）生徒が、ここに自動で並びます。応募先を決め、試験日・合否まで続けて記録します。右端の確認欄（選考会議〜郵送した旨Tel）は、押すたびに 空白→〇→済 と変わり、会議資料にも同じ印が出ます。</p></div>
        <div class="head-actions">
          <button class="btn" id="scAdd" title="進路を変えた生徒など、1次に出ていない生徒をここに加えます">生徒を追加</button>
          <button class="btn btn-primary" id="scPrint" ${all.length ? '' : 'disabled'}>2次選考会議の資料を印刷</button>
        </div>
      </div>
      <div class="stats stats-sm">
        <div class="stat"><span class="stat-label">対象の生徒</span><span class="stat-val">${all.length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">応募先が未確定</span><span class="stat-val">${wait.length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">結果待ち</span><span class="stat-val">${going.length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">〇 内定</span><span class="stat-val">${won.length}</span><span class="stat-unit">人</span></div>
      </div>
      <div class="toolbar">
        <div class="seg">${[['', 'すべて'], ['未定', '応募先が未確定'], ['待', '結果待ち'], ['内定', '内定']]
          .map(([v, l]) => `<button class="${f === v ? 'on' : ''}" data-filter="${v}">${l}</button>`).join('')}</div>
      </div>
      ${rows.length ? `<div class="sc-list" id="scTable">${rows.map(x => this.rowHtml(x)).join('')}</div>`
        : `<div class="empty"><p class="empty-title">${all.length ? '該当する生徒はいません' : '2次の対象者はまだいません'}</p><p>「応募・受験」で合否を「不採用」または「辞退」にすると、ここに並びます。</p></div>`}
      ${Store.data.applications.some(a => a.confirmed && a.round >= 2) ? `<details class="card-fold" ${this.state.sendOpen ? 'open' : ''} id="scSend"><summary>応募書類の送付（2次以降の応募先の送付状・宛名ラベル）</summary>${(SendDocs.state.minRound = 2, SendDocs.html())}</details>` : ''}
`;
    $$('[data-filter]', view).forEach(b => b.addEventListener('click', () => { this.state.filter = b.dataset.filter; UI.refresh(); }));
    $('#scPrint', view).addEventListener('click', () => this.printMeeting());
    $('#scAdd', view).addEventListener('click', () => this.addStudent());
    $$('[data-unadd]', view).forEach(b => b.addEventListener('click', () => {
      const st = Students.byId(b.dataset.unadd); if (!st) return;
      st.second = Object.assign({}, st.second, { added: false, removed: true }); Store.changed(); UI.refresh(); UI.toast('2次の一覧から外しました（［生徒を追加］でまた加えられます）');
    }));
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
        UI.refresh();      // 並び（応募先が未確定／結果待ち）が変わるので、この画面は描き直す
      });
      tbl.addEventListener('click', async e => {
        const c = e.target.closest('[data-chk]');
        if (c) {
          const st = Students.byId(c.dataset.sid); if (!st) return;
          st.second = Object.assign({}, st.second);
          st.second[c.dataset.chk] = CHECK_STEPS[(CHECK_STEPS.indexOf(st.second[c.dataset.chk] || '') + 1) % CHECK_STEPS.length];
          const v = st.second[c.dataset.chk]; c.querySelector('b').textContent = v; c.className = 'chk-chip ' + (v === '済' ? 'is-done' : v ? 'is-on' : ''); Store.changed(); return;
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

  /** 1次に出ていない生徒（進路を変えた生徒など）を、2次の一覧に加える。就職希望でなければ、就職（学校斡旋）に変えて加える */
  async addStudent() {
    const inList = new Set(this.rows().map(x => x.s.id));
    const cands = Store.data.students.filter(s => STUDENT_NO.test(s.no3) && !inList.has(s.id) && !(Students.isJobSeeker(s) && Apps.current(s.id))).sort((a, b) => a.no3.localeCompare(b.no3));
    if (!cands.length) { UI.toast('追加できる生徒がいません', 'warn'); return; }
    const r = await UI.pick({
      title: '2次に生徒を追加', placeholder: '番号・氏名で検索', okLabel: '追加する', need: '生徒を選んでください',
      intro: '<p class="sub">1次の選考会議に出ていない生徒（進路を進学などから就職に変えた生徒）を、2次の一覧に加えます。</p>',
      items: cands, text: s => [s.no3, s.name],
      row: s => `<span class="mono">${esc(s.no3)}</span><span class="pk-main"><b>${esc(s.name)}</b><small>${esc((Students.dept(s) || {}).name || '')}</small></span><span class="tag">${esc(s.course || '未')}${s.course === '就職' && s.method && s.method !== '学校斡旋' ? '（' + esc(s.method) + '）' : ''}</span>`,
    });
    if (r.res !== 'ok') return;
    const s = Students.byId(r.id);
    if (!Students.isJobSeeker(s)) {
      const was = Outcomes.of(s);
      if (!await UI.confirm(`${Students.label(s)} は、いまの進路が「${was.type || s.course || '未入力'}」です。\n進路を「就職（学校斡旋）」に変えて、2次の一覧に加えます。\n（変更の履歴は進路決定に残ります）`, { title: '進路を就職に変えます', ok: '変えて追加する' })) return;
      Outcomes.change(s, { type: '就職', method: '学校斡旋', dest: { type: '就職', status: '活動中', jobKind: '学校斡旋' } });
    }
    s.second = Object.assign({}, s.second, { added: true, removed: false });
    Store.changed(); UI.refresh();
    UI.toast(`${s.name || s.no3} を2次の一覧に追加しました`);
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
        ${chk(s, 'meet')}${cell(a ? esc(when(a.visitDate, a.visitTime)) : '', 'sm')}${chk(s, 'form')}${chk(s, 'addrTel')}
        ${chk(s, 'mailTel')}${cell(a ? esc(when(a.examDate, a.examTime)) : '', 'sm')}
        ${cell(a && a.reportSubmitted ? '〇' : '')}${cell(a && a.result ? (a.result === '内定' ? '〇' : '×') : '')}</tr>`;
    };
    const blank = () => `<tr>${cell('', 'sc-no')}${'<td></td>'.repeat(12)}</tr>`;
    const body = all.map(rowHtml).join('') + Array(Math.max(0, 10 - all.length)).fill(blank()).join('');
    const circle = '<span class="sc-o"></span>';
    const sample = `<tr class="sc-ex"><td>例</td><td>〇〇　〇〇</td><td class="sc-dl r">50</td><td class="sc-dl l sm">ダミー1株式会社<br>〇〇工場</td><td class="sc-dl l xs">製造担当職</td>
      <td>${circle}</td><td class="sm l">1/10(金)14:09～</td><td>${circle}</td><td>${circle}</td><td>${circle}</td><td class="sm">職場見学と同日実施</td><td>${circle}</td><td>${circle}</td></tr>`;
    const th = (t, cls = '') => `<th class="${cls}">${t}</th>`;
    const head = `<tr>${th('生徒番号')}${th('氏名')}<th colspan="3">志望企業情報</th>${th('選考<br>会議', 'sm')}${th('職場見学日時')}${th('求職<br>確認書', 'sm')}${th('送付先住所<br>確認Tel', 'xxs')}${th('郵送した旨Tel<br><span class="xs">(試験日書面依頼)</span>', 'sm')}${th('試験日')}${th('結果<br>報告書', 'sm')}${th('合否')}</tr>`;
    const widths = [14.6, 20, 10.6, 32.7, 20, 8.2, 42, 10.1, 10.4, 27.4, 34, 11, 10.5];
    Print.open({
      title: `2次選考会議資料_${nendoLabel(Store.data.year)}`, orientation: 'landscape', margin: '8mm 6mm 6mm 6mm',
      html: `<div class="p-page sc-sheet">
        <div class="sc-head"><div><p class="sc-title">${esc(title)}</p><p class="sc-note">※網掛けは進路決定済みの生徒</p></div><div class="sc-warn">※取扱注意※</div></div>
        <table class="sc-tbl"><colgroup>${widths.map(w => `<col style="width:${w}mm">`).join('')}</colgroup>
        <thead>${head}</thead><tbody>${body}${sample}</tbody></table></div>`,
    });
  },

  /** 前の応募（合否を直せる）。応募先が未確定の人は、いちばん新しい応募（不採用にした応募）も直せる */
  histCell(s, includeCurrent) {
    const cur = Apps.current(s.id);
    const list = Apps.of(s.id).filter(a => a.confirmed && (includeCurrent || a !== cur)).sort((a, b) => a.round - b.round);
    if (!list.length) return '<span class="sub">なし</span>';
    return list.map(a => {
      const j = Apps.job(a);
      return `<div class="sc-h"><b>${a.round}次</b><span class="sc-hc" title="${esc(j ? j.company : '')}">${esc(j ? j.company : '?')}</span>
        ${AppsPage.resultSelect(a)}
        ${a.round >= 2 ? `<button class="link-btn" data-delapp="${a.id}" title="この応募を取り消す">取り消し</button>` : ''}</div>`;
    }).join('');
  },

  /** 生徒ごとのカード（左の色の帯：緑＝内定／青＝結果待ち／橙＝応募先が未確定） */
  rowHtml({ s, cur, wait, r }) {
    const lab = t => `<span class="sc-lab">${t}</span>`;
    const state = wait ? ['wait', '応募先が未確定'] : cur.result === '内定' ? ['won', '内定'] : cur.result ? ['lost', AppsPage.resultLabel(cur.result)] : ['go', '結果待ち'];
    const id = `<div class="sc-id"><span class="sc-rank" title="就職順位">${r?.jobRank ?? '—'}</span>
      <div><b class="sc-name">${esc(s.name)}</b>${s.second && (s.second.added || Students.lateEntrant(s)) && !cur ? ` <button class="link-btn" data-unadd="${s.id}" title="2次の一覧から外す（応募はまだありません）">外す</button>` : ''}
      <div class="sub mono">${esc(s.no3)}</div><span class="sc-state is-${state[0]}">${state[1]}</span></div></div>`;
    const prev = `<div class="sc-prev">${lab('前の応募（合否を直せます）')}${this.histCell(s, wait)}</div>`;
    const chk = `<div class="sc-chk">${lab('確認（押すと 空白→〇→済）')}${this.chkChips(s)}</div>`;
    if (wait) {
      const nr = cur ? cur.round + 1 : 2;
      return `<div class="sc-card is-wait">${id}
        <div class="sc-now"><button class="btn btn-primary" data-next="${s.id}">${nr}次の応募先を決める</button></div>
        <div class="sc-hint">応募先を決めると、試験日・合否を入れられます</div>${prev}${chk}</div>`;
    }
    const a = cur, job = Apps.job(a);
    const fld = (k, type = 'text', cls = '', ph = '') => `<input type="${type}" data-aid="${a.id}" data-f="${k}" value="${esc(a[k] || '')}" class="${cls}" ${ph ? `placeholder="${ph}"` : ''}>`;
    return `<div class="sc-card is-${state[0]}">${id}
      <div class="sc-now">${lab(`${a.round}次の応募先`)}${job ? `<div class="sc-co"><span class="mono">${esc(Derive.short(job))}</span> <b>${esc(job.company)}</b> <span class="sub">${esc(job.jobTitle || '')}</span></div>` : '—'}</div>
      <div class="sc-exam">${lab('試験日・時間')}<div class="sc-pair">${fld('examDate', 'date', 'w-date')}${fld('examTime', 'text', 'w-hm', 'hh:mm')}</div></div>
      <div class="sc-res">${lab('合否・結果日')}<div class="sc-pair">${AppsPage.resultSelect(a)}${fld('resultDate', 'date', 'w-date')}</div></div>
      ${prev}${chk}
      <div class="sc-memo">${lab('メモ')}${fld('note', 'text', 'w-memo', '')}${a.round >= 2 ? `<button class="link-btn" data-delapp="${a.id}" title="この応募を取り消す">取り消し</button>` : ''}</div></div>`;
  },
};

Pages.register({ id: 'second', no: 7, group: '見学・応募', title: '選考会議（2次）', render: v => SecondPage.render(v) });
