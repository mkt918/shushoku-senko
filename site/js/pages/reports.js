'use strict';
/* ============================================================
   7. 報告・統計
   ============================================================ */

const MIC_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G1', 'G2', 'H1', 'H2', 'H3', 'H4', 'H5', 'I', 'J', 'K', 'L'];

const Reports = {
  state: { tab: 'form13', month: null, bMonth: null, scope: '' },

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

  /** 教育委員会への卒業予定者内定状況報告（年3回：10月・11月・2月）。学科は文部科学省の調査項目（dept.stat）で絞る。scope が空なら全体 */
  boardMonths() { return this.months().filter(x => [10, 11, 2].includes(x.m)); },
  board(asOf, scope) {
    const blank = () => ({ grad: 0, wIn: 0, wOut: 0, dIn: 0, dOut: 0 });
    const c = { 男: blank(), 女: blank() };
    const base = this.months().find(x => x.m === 10).asOf;
    let noGender = 0, noJob = 0;
    for (const st of Store.data.students) {
      const d = Students.dept(st);
      if (scope && (!d || d.stat !== scope)) continue;
      if (st.gender !== '男' && st.gender !== '女') { noGender++; continue; }
      const r = c[st.gender];
      r.grad++;
      if (!this.seekerAt(st, base)) continue;   // 就職希望者は10月末で確定し、11月・2月も減らさない（統計上の決まり）
      const a = Apps.current(st.id), job = Apps.job(a);
      if (!job) noJob++;
      const out = !!job && job.workArea === '県外';
      r[out ? 'wOut' : 'wIn']++;                // 応募先が未確定の人は、県内に数える（注記を出す）
      if (Students.isJobSeeker(st) && job && a.result === '内定' && (!a.resultDate || a.resultDate <= asOf)) r[out ? 'dOut' : 'dIn']++;
    }
    return { c, noGender, noJob };
  },
  /** その月末の時点で就職希望者だったか。進学から就職に切り替えた人は入れず、月末のあとで進学などに変えた人は入れる（進路の変更履歴で判断） */
  seekerAt(st, asOf) {
    const log = st.destLog || [];
    if (Students.isJobSeeker(st)) {
      const last = log[log.length - 1];
      return !(last && last.to === '就職' && last.from === '進学');   // 進学から就職に切り替えた生徒は、報告に入れない
    }
    const firstAfter = log.find(h => h.at > asOf);
    return !!firstAfter && firstAfter.from === '就職';
  },
  boardScopes() { return [...new Set(Store.data.settings.departments.map(d => d.stat).filter(Boolean))]; },
  boardRows(asOf, scope) {
    const { c, noGender, noJob } = this.board(asOf, scope);
    const tot = {}; for (const k of ['grad', 'wIn', 'wOut', 'dIn', 'dOut']) tot[k] = c.男[k] + c.女[k];
    const rate = r => { const A = r.wIn + r.wOut, B = r.dIn + r.dOut; return A ? (B / A * 100).toFixed(1) : ''; };
    const line = (label, r) => [label, r.grad, r.wIn, r.wOut, r.wIn + r.wOut, r.dIn, r.dOut, r.dIn + r.dOut, rate(r)];
    return { rows: [line('男', c.男), line('女', c.女), line('合計', tot)], noGender, noJob };
  },
  boardHtml(asOf, scope) {
    const { rows } = this.boardRows(asOf, scope);
    const unit = v => (v === '' || typeof v === 'string') ? v : this.zv(v) === '' ? '' : v + ' 人';
    const td = (v, j, i) => `<td class="num ${(j === 4 || j === 7 || j === 8 || i === 2) ? 'p-shade' : ''}">${j === 8 ? esc(v) : unit(v)}</td>`;
    return `<p class="p-sub">(1) 令和${reiwa(Store.data.year) + 1}年３月高等学校卒業（予定）者の就職（内定）状況${scope ? '　［' + esc(scope) + '］' : ''}</p>
      <table class="p-table f13"><thead>
        <tr><th rowspan="2"></th><th rowspan="2">卒業<br>（予定）<br>者数</th><th colspan="3">就職希望者数</th><th colspan="3">就職（内定）者数</th><th rowspan="2">就職<br>（内定）率<br>(B)/(A)×100</th></tr>
        <tr><th>県内</th><th>県外</th><th>小計(A)</th><th>県内</th><th>県外</th><th>小計(B)</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><th>${r[0]}</th>${r.slice(1).map((v, j) => td(v, j + 1, i)).join('')}</tr>`).join('')}</tbody></table>`;
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
    const tabs = [['form13', 'ハローワーク様式13'], ['list', '内定・受験一覧'], ['roster', '就職者名簿'], ['stat', '統計調査'], ['board', '教育委員会 内定状況']];
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

  /* ---------- 教育委員会 内定状況報告 ---------- */
  draw_board(el) {
    const st = this.state;
    const ms = this.boardMonths();
    if (!ms.some(x => x.m === st.bMonth)) { const p = ms.filter(x => x.asOf < todayISO()); st.bMonth = (p.length ? p[p.length - 1] : ms[0]).m; }
    const mo = ms.find(x => x.m === st.bMonth);
    const scopes = this.boardScopes();
    if (st.scope && st.scope !== '*' && !scopes.includes(st.scope)) st.scope = '';
    const list = st.scope === '*' ? scopes : [st.scope];
    const { noGender, noJob } = this.boardRows(mo.asOf, st.scope === '*' ? '' : st.scope);
    el.innerHTML = `
      <div class="toolbar">
        <select id="bdMonth">${ms.map(x => `<option value="${x.m}" ${x.m === st.bMonth ? 'selected' : ''}>${x.label}</option>`).join('')}</select>
        <select id="bdScope"><option value="">全学科（合計）</option><option value="*" ${st.scope === '*' ? 'selected' : ''}>学科別（すべて）</option>${scopes.map(x => `<option ${x === st.scope ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <button class="btn btn-primary" id="bdPrint">印刷</button>
        <button class="btn" id="bdXlsx">Excel に出力</button>
      </div>
      ${noGender ? `<div class="notice notice-warn">性別が未入力の生徒 ${noGender} 人は、集計から外れています。</div>` : ''}
      ${noJob ? `<div class="notice notice-info">応募先が未確定の就職希望者 ${noJob} 人は、「就職希望者数」の県内に数えています。</div>` : ''}
      ${list.map(x => `<div class="card f13-wrap">${this.boardHtml(mo.asOf, x)}</div>`).join('')}
      <p class="help">教育委員会へ年3回（10月・11月・2月）報告します。就職希望者数は<b>10月末で確定した人数を、3月まで減らしません</b>（統計上の決まり）。内定者は「${mo.label}」までに内定した人を数えるので、就職から進学に変えた生徒は希望者には残り、内定者には入らず、内定率は100%になりません。進学から就職に切り替えた生徒は、報告に入れません。県内・県外は求人票の就業場所です。就職（内定）率＝(B)÷(A)×100。学科は文部科学省の調査項目（設定の学科の「統計」）で分けます。</p>`;
    $('#bdMonth', el).addEventListener('change', e => { st.bMonth = Number(e.target.value); UI.refresh(); });
    $('#bdScope', el).addEventListener('change', e => { st.scope = e.target.value; UI.refresh(); });
    $('#bdPrint', el).addEventListener('click', () => {
      const sc = Store.data.settings.school;
      Print.open({
        title: `内定状況報告_${mo.label}`, orientation: 'landscape',
        html: `<div class="p-page"><p class="p-title">卒業予定者内定状況報告（${esc(mo.label)}）</p>
          <p class="p-meta"><span>${esc(sc.name)}</span><span>${esc(mo.label)}</span></p>${list.map(x => this.boardHtml(mo.asOf, x)).join('<div style="height:8mm"></div>')}</div>`,
      });
    });
    $('#bdXlsx', el).addEventListener('click', () => {
      Excel.download(`内定状況報告_${mo.label}.xlsx`, list.map(x => ({
        name: (x || '全学科').slice(0, 31), widths: [8, 12, 8, 8, 10, 8, 8, 10, 12],
        rows: [[`(1) 令和${reiwa(Store.data.year) + 1}年３月高等学校卒業（予定）者の就職（内定）状況${x ? '［' + x + '］' : ''}`],
          ['', '卒業（予定）者数', '就職希望者数', '', '', '就職（内定）者数', '', '', '就職（内定）率'],
          ['', '', '県内', '県外', '小計(A)', '県内', '県外', '小計(B)', '(B)/(A)×100'], ...this.boardRows(mo.asOf, x).rows],
      })));
    });
  },

  /** 表のセルの揃え：数は右、番号・コード（数字だけの文字列）は中央 */
  cellCls(v) { return typeof v === 'number' ? 'num' : /^[\d\-]+$/.test(String(v)) ? 'c code' : ''; },
  drawGeneric(el, title, head, body, shade, note, numeric) {
    body = body.map(r => r.map(v => this.zv(v)));   // 「0は記載しない」
    el.innerHTML = `
      <div class="toolbar"><button class="btn btn-primary" data-act="print">印刷</button><button class="btn" data-act="xlsx">Excel に出力</button>
      <span class="count">${numeric ? '' : body.length + ' 件'}</span></div>
      ${note ? `<p class="help">${esc(note)}</p>` : ''}
      ${body.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body.map(r => `<tr>${r.map(v => `<td class="${this.cellCls(v)}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : '<div class="empty"><p class="empty-title">まだデータがありません</p></div>'}`;
    const fullTitle = `${nendoLabel(Store.data.year)}　${title}`;
    $('[data-act="print"]', el).addEventListener('click', () => Print.open({
      title: fullTitle, orientation: 'landscape',
      html: `<div class="p-page"><p class="p-title">${esc(fullTitle)}</p><p class="p-meta"><span>${esc(Store.data.settings.school.name)}</span><span>${todayISO()} 現在</span></p>
        <table class="p-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body.map((r, i) => `<tr class="${shade[i] ? 'p-shade' : ''}">${r.map(v => `<td class="${this.cellCls(v)}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
        ${note ? `<p class="p-note">${esc(note)}</p>` : ''}</div>`,
    }));
    $('[data-act="xlsx"]', el).addEventListener('click', () =>
      Excel.download(`${title}_R${reiwa(Store.data.year)}.xlsx`, [{ name: title.slice(0, 31), rows: [head, ...body], widths: head.map(h => Math.max(6, String(h).length * 2 + 2)) }]));
  },
};

Pages.register({ id: 'reports', no: 8, group: '報告', title: '報告・統計', render: v => Reports.render(v) });
