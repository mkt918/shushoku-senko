'use strict';
/* ============================================================
   7. 報告・統計
   ============================================================ */

const MIC_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G1', 'G2', 'H1', 'H2', 'H3', 'H4', 'H5', 'I', 'J', 'K', 'L'];

const Reports = {
  state: { tab: 'form13', month: null },

  /** 報告の対象月の選択肢と月末日。4月末現在から、同一年度（4月〜翌年3月）で行う */
  months() {
    const y = Store.data.year;
    return [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map(m => {
      const yy = m >= 4 ? y : y + 1;
      const last = new Date(yy, m, 0).getDate();
      return { m, label: `${m}月末現在`, asOf: `${yy}-${String(m).padStart(2, '0')}-${last}` };
    });
  },
  /** 初めに選ぶ月：月末を過ぎた最新の月（年度が始まっていなければ4月） */
  defaultMonth() {
    const today = todayISO();
    const past = this.months().filter(x => x.asOf < today);
    return past.length ? past[past.length - 1].m : 4;
  },

  groups() { return [...new Set(Store.data.settings.departments.map(d => d.report))]; },

  /** 様式13の集計 */
  form13(asOf) {
    const s = Store.data.settings;
    const groups = this.groups();
    const blank = () => ({ want: 0, wantDis: 0, wantIn: 0, wantOut: 0, dec: 0, decDis: 0, decKannai: 0, decKangai: 0, decOut: 0 });
    const cell = {};   // cell[group][gender]
    for (const g of [...groups, '合計']) cell[g] = { 男: blank(), 女: blank(), 計: blank() };
    const unknown = [];
    const add = (g, gender, k) => {
      for (const gg of [g, '合計']) for (const ge of [gender, '計']) cell[gg][ge][k]++;
    };
    for (const st of Store.data.students.filter(x => Students.isJobSeeker(x))) {
      const d = Students.dept(st);
      const g = d ? d.report : null;
      const gender = st.gender === '男' || st.gender === '女' ? st.gender : null;
      if (!g || !gender) { unknown.push(st); continue; }
      const a = Apps.current(st.id);
      const job = Apps.job(a);
      add(g, gender, 'want');
      if (st.disability) add(g, gender, 'wantDis');
      if (job) add(g, gender, job.workArea === '県外' ? 'wantOut' : 'wantIn');
      if (a && a.result === '内定' && (!a.resultDate || a.resultDate <= asOf) && job) {
        add(g, gender, 'dec');
        if (st.disability) add(g, gender, 'decDis');
        const z = Derive.workZone(job, s);
        add(g, gender, z === '管内' ? 'decKannai' : z === '管外' ? 'decKangai' : 'decOut');
      }
    }
    return { groups, cell, unknown };
  },

  /** 内定・受験一覧（現在の応募先） */
  appList() {
    const s = Store.data.settings;
    return Apps.currents().sort((x, y) => num(x.s.no3) - num(y.s.no3)).map(({ s: st, a }) => {
      const job = Apps.job(a) || {};
      const d = Students.dept(st) || {};
      const ind = Derive.industry(job.industryCode), occ = Derive.occupation(job.occupationCode), size = Derive.sizeClass(job.employees);
      return {
        major: d.major || '', dept: d.name || '', no3: Number(st.no3), name: st.name, gender: st.gender,
        short: Derive.short(job), company: job.company || '', jobTitle: job.jobTitle || '', out: job.workArea === '県外' ? '外' : '',
        result: a.result, round: a.round, workZone: job.id ? Derive.workZone(job, s) : '', officeZone: job.id ? Derive.zone(job, s) : '',
        indCode: job.industryCode || '', ind: ind ? ind.letter : '', occCode: job.occupationCode || '', mhlw: occ ? occ.mhlw : '', mic: occ ? occ.mic : '',
        size: size ? size.cls : '', jobNumber: job.jobNumber || '', address: job.address || '', pref: job.id ? Derive.workPref(job, s) : '',
        disability: st.disability,
      };
    });
  },

  /** 統計調査（厚労省）：学科×性別 × 総務省職業分類 の内定者数 */
  stat() {
    const deps = Store.data.settings.departments;
    const rowsKey = [...new Map(deps.map(d => [d.stat, d])).values()];
    const table = [];
    const list = this.appList().filter(x => x.result === '内定');
    for (const d of rowsKey) for (const g of ['男', '女']) {
      const hits = list.filter(x => (deps.find(y => y.name === x.dept) || {}).stat === d.stat && x.gender === g);
      const counts = MIC_CODES.map(c => hits.filter(x => x.mic === c).length);
      table.push({ major: d.major, stat: d.stat, code: d.statCode, gender: g, counts, total: hits.length, noCode: hits.filter(x => !x.mic).length });
    }
    return table;
  },

  /** 「0は記載しない」がオンのとき、数字の 0 を空欄にする */
  hideZero() { return !!(Store.data.settings.reports || {}).hideZero; },
  zv(v) { return (v === 0 && this.hideZero()) ? '' : v; },

  render(view) {
    const st = this.state;
    if (st.month == null) st.month = this.defaultMonth();
    const tabs = [['form13', 'ハローワーク様式13'], ['list', '内定・受験一覧'], ['roster', '就職者名簿'], ['stat', '統計調査']];
    view.innerHTML = `
      <div class="page-head"><div><h1>報告・統計</h1>
      <p class="lead">選考会議の確定と「応募・受験」の合否から自動で集計します。Excel への転記は不要です。</p></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}
        <label class="check tabs-opt"><input type="checkbox" id="rpHideZero" ${this.hideZero() ? 'checked' : ''}> 0は記載しない（空欄にする）</label></div>
      <div id="rpBody"></div>`;
    $('#rpHideZero', view).addEventListener('change', e => {
      Store.data.settings.reports = Object.assign({}, Store.data.settings.reports, { hideZero: e.target.checked });
      Store.changed();
      UI.refresh();
    });
    $$('[data-tab]', view).forEach(b => b.addEventListener('click', () => { st.tab = b.dataset.tab; UI.refresh(); }));
    this['draw_' + st.tab]($('#rpBody', view));
  },

  /* ---------- 様式13 ---------- */
  form13Html(asOf, label) {
    const { groups, cell } = this.form13(asOf);
    const cols = ['合計', ...groups];
    const v = (g, k) => ['計', '男', '女'].map(ge => this.zv(cell[g][ge][k]));
    const paren = (g, k) => ['計', '男', '女'].map(ge => cell[g][ge][k] ? `(${cell[g][ge][k]})` : '(　)');
    const row = (label1, label2, k, isParen) => `<tr><th class="l">${label1}</th><th class="l">${label2}</th>${cols.map(g => (isParen ? paren(g, k) : v(g, k)).map(n => `<td class="num">${n}</td>`).join('')).join('')}</tr>`;
    return `
      <table class="p-table f13">
        <thead><tr><th colspan="2" rowspan="2">項目</th>${cols.map(g => `<th colspan="3">${esc(g)}</th>`).join('')}</tr>
        <tr>${cols.map(() => '<th>計</th><th>男</th><th>女</th>').join('')}</tr></thead>
        <tbody>
          ${row('① 学校又は安定所の紹介による就職希望者数', '', 'want')}
          ${row('', '（うち障害者数）', 'wantDis', true)}
          ${row('', 'うち県内', 'wantIn')}
          ${row('', 'うち県外', 'wantOut')}
          ${row('② 学校又は安定所の紹介による就職決定者数', '', 'dec')}
          ${row('', '（うち障害者数）', 'decDis', true)}
          ${row('', 'うち県内・管内', 'decKannai')}
          ${row('', 'うち県内・管外', 'decKangai')}
          ${row('', 'うち県外', 'decOut')}
        </tbody></table>
      <p class="p-note">${esc(label)}（${asOf} までに内定した者を計上）。管内＝${esc(Store.data.settings.kannaiCities.join('・'))}（就業場所で判定）。</p>`;
  },

  draw_form13(el) {
    const st = this.state;
    const mo = this.months().find(x => x.m === st.month);
    const { unknown } = this.form13(mo.asOf);
    const noJob = Store.data.students.filter(s => Students.isJobSeeker(s) && !Apps.current(s.id)).length;
    el.innerHTML = `
      <div class="toolbar">
        <select id="rpMonth">${this.months().map(x => `<option value="${x.m}" ${x.m === st.month ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
        <button class="btn btn-primary" id="rpPrint">印刷</button>
        <button class="btn" id="rpXlsx">Excel に出力</button>
      </div>
      ${unknown.length ? `<div class="notice notice-warn">学科または性別が判定できない就職希望者が ${unknown.length} 人います（${unknown.slice(0, 5).map(s => esc(s.no3)).join('、')}…）。集計から外れています。</div>` : ''}
      ${noJob ? `<div class="notice notice-info">応募先が未確定の就職希望者 ${noJob} 人は、①の合計には入りますが「うち県内・県外」には入りません。</div>` : ''}
      <div class="card f13-wrap">${this.form13Html(mo.asOf, mo.label)}</div>
      <p class="help">報告は<b>4月末現在から</b>、同一年度（4月〜翌年3月）で行います。選考開始以降の未就職者数は ①−② です。</p>`;
    $('#rpMonth', el).addEventListener('change', e => { st.month = Number(e.target.value); UI.refresh(); });
    $('#rpPrint', el).addEventListener('click', () => {
      const sc = Store.data.settings.school;
      Print.open({
        title: `様式13_${mo.label}`, orientation: 'landscape',
        html: `<div class="p-page"><p class="p-title">新規高等学校卒業（予定）者職業紹介状況報告書（様式13）</p>
          <p class="p-meta"><span>令和${reiwa(Store.data.year) + (st.month >= 4 ? 0 : 1)}年　${esc(mo.label)}</span><span>${esc(sc.reportName)}</span></p>
          ${this.form13Html(mo.asOf, mo.label)}</div>`,
      });
    });
    $('#rpXlsx', el).addEventListener('click', () => {
      const { groups, cell } = this.form13(mo.asOf);
      const cols = ['合計', ...groups];
      const head1 = ['項目', ''], head2 = ['', ''];
      cols.forEach(g => { head1.push(g, '', ''); head2.push('計', '男', '女'); });
      const line = (a, b, k) => [a, b, ...cols.flatMap(g => ['計', '男', '女'].map(ge => this.zv(cell[g][ge][k])))];
      Excel.download(`様式13_${mo.label}.xlsx`, [{
        name: mo.label, widths: [36, 16, ...cols.flatMap(() => [5, 5, 5])],
        rows: [[`様式13　${mo.label}　${Store.data.settings.school.reportName}`], head1, head2,
          line('①就職希望者数', '', 'want'), line('', 'うち障害者数', 'wantDis'), line('', 'うち県内', 'wantIn'), line('', 'うち県外', 'wantOut'),
          line('②就職決定者数', '', 'dec'), line('', 'うち障害者数', 'decDis'), line('', '県内・管内', 'decKannai'), line('', '県内・管外', 'decKangai'), line('', '県外', 'decOut')],
      }]);
    });
  },

  /* ---------- 内定・受験一覧（内定状況調査資料） ---------- */
  draw_list(el) {
    const hideFail = !!Store.data.settings.reports.hideFail;
    const list = this.appList().filter(x => !(hideFail && x.result === '不採用'));
    const head = ['大学科', '学科', '番号', '氏名', '性別', '次', '下4桁', '企業名', '職種', '就業場所', '合否', '就業区分', '職安区分', '産業', '職業(厚労省)', '職業(総務省)', '規模'];
    const body = list.map(x => [x.major, x.dept, x.no3, x.name, x.gender, x.round, x.short, x.company, x.jobTitle, x.out, x.result, x.workZone, x.officeZone, x.ind, x.mhlw, x.mic, x.size]);
    this.drawGeneric(el, '内定・受験一覧', head, body, list.map(x => x.gender === '男'),
      '「就業場所」は県外のとき「外」。網掛けは男子（印刷時）。');
    // 「不採用は表示しない」（画面・印刷・Excel に共通）
    const bar = $('.toolbar', el);
    bar.insertAdjacentHTML('beforeend', `<label class="check"><input type="checkbox" id="rpHideFail" ${hideFail ? 'checked' : ''}> 不採用は表示しない</label>`);
    $('#rpHideFail', el).addEventListener('change', e => {
      Store.data.settings.reports = Object.assign({}, Store.data.settings.reports, { hideFail: e.target.checked });
      Store.changed();
      UI.refresh();
    });
  },

  /* ---------- 就職者名簿 ---------- */
  draw_roster(el) {
    const list = this.appList().filter(x => x.result === '内定');
    const head = ['生徒番号', '性別', '学科', '事業所名', '就業先の都道府県名', '就業先所在地', '求人番号', '産業分類', '職業分類', '従業員の規模', '紹介経路', '備考'];
    const body = list.map(x => [x.no3, x.gender, x.dept, x.company, x.pref, x.address, x.jobNumber, x.indCode, x.occCode, x.size, '学校', '']);
    this.drawGeneric(el, '就職者名簿', head, body, [], '内定者のみ。所在地は求人票の事業所所在地です。');
  },

  /* ---------- 統計調査 ---------- */
  draw_stat(el) {
    const t = this.stat();
    const head = ['大学科', '学科', 'コード', '性別', ...MIC_CODES, '合計'];
    const body = t.map(r => [r.major, r.stat, r.code, r.gender, ...r.counts, r.total]);
    const noCode = t.reduce((n, r) => n + r.noCode, 0);
    this.drawGeneric(el, '統計調査（厚生労働省）', head, body, [],
      `内定者を日本標準職業分類（総務省）で数えています。${noCode ? `職業分類コードが未入力の内定者が ${noCode} 人います（求人票で入力してください）。` : ''}`, true);
  },

  drawGeneric(el, title, head, body, shade, note, numeric) {
    body = body.map(r => r.map(v => this.zv(v)));   // 「0は記載しない」
    el.innerHTML = `
      <div class="toolbar"><button class="btn btn-primary" data-act="print">印刷</button><button class="btn" data-act="xlsx">Excel に出力</button>
      <span class="count">${numeric ? '' : body.length + ' 件'}</span></div>
      ${note ? `<p class="help">${esc(note)}</p>` : ''}
      ${body.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body.map(r => `<tr>${r.map(v => `<td class="${typeof v === 'number' ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : '<div class="empty"><p class="empty-title">まだデータがありません</p></div>'}`;
    const fullTitle = `${nendoLabel(Store.data.year)}　${title}`;
    $('[data-act="print"]', el).addEventListener('click', () => Print.open({
      title: fullTitle, orientation: 'landscape',
      html: `<div class="p-page"><p class="p-title">${esc(fullTitle)}</p><p class="p-meta"><span>${esc(Store.data.settings.school.name)}</span><span>${todayISO()} 現在</span></p>
        <table class="p-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body.map((r, i) => `<tr class="${shade[i] ? 'p-shade' : ''}">${r.map(v => `<td class="${typeof v === 'number' ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        ${note ? `<p class="p-note">${esc(note)}</p>` : ''}</div>`,
    }));
    $('[data-act="xlsx"]', el).addEventListener('click', () =>
      Excel.download(`${title}_R${reiwa(Store.data.year)}.xlsx`, [{ name: title.slice(0, 31), rows: [head, ...body], widths: head.map(h => Math.max(6, String(h).length * 2 + 2)) }]));
  },
};

Pages.register({ id: 'reports', no: 8, group: '報告', title: '報告・統計', render: v => Reports.render(v) });
