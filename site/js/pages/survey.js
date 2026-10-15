'use strict';
/* ============================================================
   0. 進路希望調査（4月・Forms）
   Forms の回答（CSV／Excel）を取り込み → 集計・個人別一覧・未回答者・自由記述 → 印刷／Excel／生徒・成績へ反映
   ============================================================ */

const SurveyPage = {
  state: { id: null, tab: 'summary', split: true, pct: false, extra: true, memo: false, cls: '' },

  all() { return Store.data.surveys; },
  cur() { const l = this.all(); return l.find(s => s.id === this.state.id) || l[l.length - 1] || null; },

  render(view) {
    const st = this.state;
    const sv = this.cur();
    if (sv) st.id = sv.id;
    const tabs = [['summary', '集計'], ['list', '個人別一覧'], ['un', '未回答者'], ['memo', '自由記述（悩み・理由）']];
    view.innerHTML = `
      <div class="page-head"><div><h1>進路希望調査</h1>
      <p class="lead">4月の進路希望調査（Forms）の回答を取り込むと、<b>集計</b>と<b>個人別一覧</b>を作ります。Forms の様式は変えずに使えます。</p></div>
      <div class="head-actions"><button class="btn btn-primary" id="svImport">Forms の回答を取り込む</button></div></div>
      ${sv ? this.body(sv, tabs) : this.empty()}`;
    $('#svImport', view).addEventListener('click', () => this.importFile());
    if (sv) this.bind(view, sv);
  },

  empty() {
    return `<div class="card"><h2>はじめかた</h2>
      <ol class="steps">
        <li><b>Forms</b>の「進路希望調査」で、生徒が回答します（Forms の様式はそのまま使えます。年度ごとに変えるのは、日付と年度だけです）。</li>
        <li>Forms の［回答］→［Excel で開く］などで、回答を<b>CSV または Excel</b>にして保存します。前年度の回答は、Forms 側で削除しておきます。</li>
        <li>この画面の<b>［Forms の回答を取り込む］</b>でそのファイルを選びます。集計・個人別一覧・未回答者が自動でできます。</li>
        <li>名簿（［生徒・成績］の［名簿・評定・出欠］）を先に取り込んでおくと、<b>氏名の表示と未回答者の判定</b>ができます。</li>
      </ol>
      <p class="help">同じ番号の生徒が複数回答したときは、最新の1件だけを使います。回答後の直しは、個人別一覧の行を押して直せます。</p></div>`;
  },

  body(sv, tabs) {
    const st = this.state;
    const people = Survey.people(sv);
    const ans = people.filter(p => p.answered).length;
    const chk = (id, label, on) => `<label class="check"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
    return `
      <div class="toolbar sv-bar">
        ${this.all().length > 1 ? `<select id="svSel">${this.all().map(s => `<option value="${s.id}" ${s.id === sv.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>` : ''}
        <label class="inline">名称 <input id="svLabel" value="${esc(sv.label)}" style="width:170px"></label>
        <label class="inline">集計日 <input type="date" id="svDate" value="${esc(sv.date || '')}"></label>
        <span class="sub">回答 ${ans} ／ 全体 ${people.length} 名${people.length > ans ? `（未回答 ${people.length - ans}）` : ''}</span>
        <button class="btn btn-danger-ghost btn-sm" id="svDel">この調査を削除</button>
      </div>
      <div class="toolbar sv-bar">
        ${chk('svSplit', '男女を分けて表示', st.split)}${chk('svPct', '割合（％）も表示', st.pct)}${chk('svExtra', '受験方法・志望校決定の表も出す', st.extra)}
        ${chk('svZero', '0は記載しない（空欄にする）', Survey.hideZero())}
        <span class="grow"></span>
        <button class="btn" id="svApply" title="進学・就職の回答を、生徒・成績の進路希望に反映します">生徒・成績に反映</button>
        <button class="btn" id="svXlsx">Excel に出力</button>
        <button class="btn btn-primary" id="svPrint">${st.tab === 'list' ? '個人別一覧を印刷' : st.tab === 'un' ? '未回答者を印刷' : st.tab === 'memo' ? '自由記述を印刷' : '集計を印刷'}</button>
      </div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div class="card sv-screen" id="svBody">${this.tabHtml(sv, people)}</div>`;
  },

  opts() { const s = this.state; return { split: s.split, pct: s.pct, extra: s.extra, memo: s.memo }; },

  tabHtml(sv, people) {
    const st = this.state;
    if (st.tab === 'summary') return `<div class="sv-scroll">${Survey.summaryHtml(sv, this.opts())}</div>`;
    if (st.tab === 'list') {
      const cls = Survey.classes(people);
      return `<div class="toolbar"><label class="check"><input type="checkbox" id="svMemo" ${st.memo ? 'checked' : ''}> 悩み・理由などの自由記述も表示（取扱注意）</label>
        <span class="sub">行を押すと、その生徒の回答を直せます。</span></div><div class="sv-scroll sv-clickable" id="svList">${Survey.listHtml(sv, this.opts())}</div>`;
    }
    if (st.tab === 'un') {
      const un = people.filter(p => !p.answered);
      if (!Store.data.students.length) return '<div class="notice notice-info">名簿が未取り込みのため、未回答者がわかりません。［生徒・成績］で名簿を取り込んでください。</div>';
      return un.length ? `<p class="sub">未回答 ${un.length} 名（集計では「未定」として数えています）。口頭などで聞き取った場合は、［回答を入力］で追加できます。</p>
        <table class="tbl"><thead><tr><th>組</th><th class="num">番号</th><th>氏名</th><th>性別</th><th></th></tr></thead><tbody>${un.map(p => `<tr><td>${esc(p.cls)}</td><td class="num mono">${esc(p.no3)}</td><td>${esc(p.name || '')}</td><td>${esc(p.gender || '')}</td><td><button class="btn btn-sm" data-edit="${p.no3}">回答を入力</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="sub">未回答者はいません。</p>';
    }
    const items = people.filter(p => p.answered && (p.worry || p.other || p.reason));
    return `<div class="notice notice-warn">自由記述は個人の悩みなどを含みます。印刷・共有の扱いに注意してください。</div>
      ${items.length ? `<table class="tbl"><thead><tr><th>組</th><th class="num">番号</th><th>氏名</th><th>進路</th><th>種別</th><th>内容</th></tr></thead><tbody>${items.flatMap(p => [['就職の悩み', p.worry], ['その他の進路', p.other], ['未定の理由', p.reason]].filter(x => x[1]).map(([k, v]) => `<tr><td>${esc(p.cls)}</td><td class="num mono">${esc(p.no3)}</td><td>${esc(p.name || '')}</td><td>${esc(p.course)}</td><td>${k}</td><td>${esc(v)}</td></tr>`)).join('')}</tbody></table>` : '<p class="sub">自由記述はありません。</p>'}`;
  },

  bind(view, sv) {
    const st = this.state;
    $$('[data-tab]', view).forEach(b => b.addEventListener('click', () => { st.tab = b.dataset.tab; UI.refresh(); }));
    $('#svSel', view)?.addEventListener('change', e => { st.id = e.target.value; UI.refresh(); });
    $('#svLabel', view).addEventListener('change', e => { sv.label = e.target.value.trim() || sv.label; Store.changed(); UI.refresh(); });
    $('#svDate', view).addEventListener('change', e => { sv.date = e.target.value; Store.changed(); UI.refresh(); });
    $('#svDel', view).addEventListener('click', async () => {
      if (!await UI.confirm(`調査「${sv.label}」（回答 ${sv.responses.length} 件）を削除します。`, { ok: '削除', danger: true })) return;
      Store.data.surveys = Store.data.surveys.filter(x => x !== sv); st.id = null; Store.changed(); UI.refresh();
    });
    const opt = (id, key) => $('#' + id, view).addEventListener('change', e => { st[key] = e.target.checked; UI.refresh(); });
    opt('svSplit', 'split'); opt('svPct', 'pct'); opt('svExtra', 'extra');
    $('#svZero', view).addEventListener('change', e => {
      Store.data.settings.reports = Object.assign({}, Store.data.settings.reports, { hideZero: e.target.checked });
      Store.changed(); UI.refresh();
    });
    $('#svMemo', view)?.addEventListener('change', e => { st.memo = e.target.checked; UI.refresh(); });
    $('#svApply', view).addEventListener('click', () => this.apply(sv));
    $('#svXlsx', view).addEventListener('click', () => this.excel(sv));
    $('#svPrint', view).addEventListener('click', () => this.print(sv));
    $$('[data-edit]', view).forEach(b => b.addEventListener('click', () => this.edit(sv, b.dataset.edit)));
    const list = $('#svList', view);
    if (list) list.addEventListener('click', e => { const tr = e.target.closest('tr[data-no]'); if (tr) this.edit(sv, tr.dataset.no); });
  },

  /* ---------- 印刷・Excel ---------- */
  print(sv) {
    const st = this.state, title = `${nendoLabel(sv.year)}_進路希望調査`;
    const people = Survey.people(sv);
    let html;
    if (st.tab === 'list') html = Survey.listHtml(sv, this.opts());
    else if (st.tab === 'un') {
      const un = people.filter(p => !p.answered);
      if (!un.length) { UI.toast('未回答者はいません', 'warn'); return; }
      html = `<div class="p-page sv-doc"><h2 class="sv-title">${esc(nendoLabel(sv.year))}　3年生　進路希望調査　未回答者</h2><p class="sv-sub">（${esc(sv.label)}）　${un.length}名　※取扱注意</p>
        <table class="sv-tbl sv-list"><thead><tr><th>組</th><th>番号</th><th>氏名</th><th>性別</th><th class="w">連絡メモ</th></tr></thead><tbody>${un.map(p => `<tr><td class="c">${esc(p.cls)}</td><td class="num">${esc(p.no3)}</td><td class="nm">${esc(p.name || '')}</td><td class="c">${esc(p.gender || '')}</td><td></td></tr>`).join('')}</tbody></table></div>`;
    } else if (st.tab === 'memo') {
      const items = people.filter(p => p.answered && (p.worry || p.other || p.reason));
      html = `<div class="p-page sv-doc"><h2 class="sv-title">${esc(nendoLabel(sv.year))}　3年生　進路希望調査　自由記述</h2><p class="sv-sub">（${esc(sv.label)}）　※取扱注意（個人情報）</p>
        <table class="sv-tbl sv-list"><thead><tr><th>組</th><th>番号</th><th>氏名</th><th>進路</th><th>種別</th><th class="w">内容</th></tr></thead><tbody>${items.flatMap(p => [['就職の悩み', p.worry], ['その他の進路', p.other], ['未定の理由', p.reason]].filter(x => x[1]).map(([k, v]) => `<tr><td class="c">${esc(p.cls)}</td><td class="num">${esc(p.no3)}</td><td class="nm">${esc(p.name || '')}</td><td class="c">${esc(p.course)}</td><td>${k}</td><td class="w">${esc(v)}</td></tr>`)).join('')}</tbody></table></div>`;
    } else html = `<div class="p-page">${Survey.summaryHtml(sv, this.opts())}</div>`;
    Print.open({ title: `${title}_${{ summary: '集計', list: '個人別一覧', un: '未回答者', memo: '自由記述' }[st.tab]}`, html, orientation: 'landscape', margin: '12mm' });
  },

  excel(sv) {
    const people = Survey.people(sv);
    const secs = Survey.sections(people, this.opts());
    const classes = secs[0].classes;
    const z = n => Survey.z(n);
    const sum = [[`${nendoLabel(sv.year)}　3年生　進路希望調査　集計（${sv.label}）`], [`全体 ${people.length}名　回答 ${people.filter(p => p.answered).length}名`], []];
    secs.forEach(s => {
      sum.push([`${s.no} ${s.title}${s.who ? '（' + s.who + '）' : ''}　計 ${s.total.all.計}名`]);
      sum.push(['区分', ...classes.flatMap(c => [c + ' 男', c + ' 女']), '全体 男', '全体 女', '全体 計']);
      [...s.rows, { label: '合計', cells: s.total.cells, all: s.total.all }].forEach(r => sum.push([r.label, ...classes.flatMap(c => [z(r.cells[c].男), z(r.cells[c].女)]), z(r.all.男), z(r.all.女), z(r.all.計)]));
      sum.push([]);
    });
    const list = [['組', '番号', '氏名', '性別', '進路', '受験方法(進学)', '分野', '学校種別', '志望校決定', '志望先', '就職方法', '職種', '悩み', 'その他の進路', '未定の理由', '回答']];
    people.forEach(p => list.push([p.cls, Number(p.no3), p.name || '', p.gender || '', p.answered ? p.course : '未回答', p.method || '', p.field || '', p.school || '', p.decided || '', p.destination || '', p.jobMethod || '', p.job || '', p.worry || '', p.other || '', p.reason || '', p.answered ? (p.edited ? '修正あり' : '') : '']));
    Excel.download(`進路希望調査_${nendoLabel(sv.year)}.xlsx`, [
      { name: '集計', rows: sum, widths: [24, ...Array(classes.length * 2 + 3).fill(7)] },
      { name: '個人別一覧', rows: list, widths: [6, 7, 14, 5, 8, 12, 16, 18, 9, 28, 9, 14, 24, 24, 24, 8] },
    ]);
  },

  /* ---------- 生徒・成績に反映 ---------- */
  async apply(sv) {
    const plan = Survey.plan(sv);
    const clear = plan.filter(x => x.course);
    const n = clear.length, nn = clear.filter(x => x.isNew).length;
    const jobs = clear.filter(x => x.course === '就職').length, edu = clear.filter(x => x.course === '進学').length;
    if (!n) { UI.toast('反映できる回答がありません', 'warn'); return; }
    const ok = await UI.confirm(`進学 ${edu} 人・就職 ${jobs} 人の回答を、［生徒・成績］の進路希望に反映します。\n・進路／就職の受験方法（学校斡旋・自己開拓・公務員）／希望職種／進学の志望先\n・名簿にいない生徒 ${nn} 人は、新しく追加します（氏名は空欄）\n・未定・その他・未回答の生徒の進路は、変更しません`, { ok: '反映する' });
    if (!ok) return;
    const r = Survey.applyToStudents(sv);
    UI.toast(`反映しました（更新 ${r.updated} 人／追加 ${r.added} 人）`);
    UI.refresh();
  },

  /* ---------- 回答の直し・未回答者の入力 ---------- */
  async edit(sv, no3) {
    const people = Survey.people(sv);
    const p = people.find(x => x.no3 === no3); if (!p) return;
    const opt = (list, blank = true) => [...(blank ? [['', '（なし）']] : []), ...list.map(x => [x, x])];
    const fields = [
      { sec: `${p.cls}　${p.no3}　${p.name || '（氏名は名簿を取り込むと表示）'}` },
      { k: 'course', label: '進路', type: 'select', options: opt(['進学', '就職', '未定', 'その他'], false), narrow: true },
      { k: 'gender', label: '性別', type: 'select', options: opt(['男', '女']), narrow: true },
      { sec: '進学の場合' },
      { k: 'method', label: '受験方法', type: 'select', options: opt(SURVEY_ORDER.method) },
      { k: 'field', label: '分野', type: 'select', options: opt(SURVEY_ORDER.field) },
      { k: 'school', label: '学校種別', type: 'select', options: opt(SURVEY_ORDER.school) },
      { k: 'decided', label: '志望校決定', type: 'select', options: opt(SURVEY_ORDER.decided), narrow: true },
      { k: 'destination', label: '志望先', wide: true },
      { sec: '就職の場合' },
      { k: 'jobMethod', label: '就職方法', type: 'select', options: opt(SURVEY_ORDER.jobMethod) },
      { k: 'job', label: '希望職種', type: 'select', options: opt(SURVEY_ORDER.job) },
      { sec: '自由記述（取扱注意）' },
      { k: 'worry', label: '就職の悩み', type: 'textarea', wide: true }, { k: 'other', label: 'その他の進路', type: 'textarea', wide: true }, { k: 'reason', label: '未定の理由', type: 'textarea', wide: true },
    ];
    const body = document.createElement('div');
    body.innerHTML = Form.html(fields, p);
    const buttons = [];
    if (p.answered) buttons.push({ label: p.edited ? '回答を取り消す' : 'この回答を削除（未回答に戻す）', kind: 'danger-ghost', value: 'del' });
    buttons.push({ label: 'キャンセル', value: null }, { label: '保存', kind: 'primary', value: 'save' });
    const res = await UI.modal({ title: p.answered ? '回答を直す' : '回答を入力', body, buttons, wide: true });
    if (res === 'save') {
      const v = Form.read(body, fields);
      const rec = Object.assign({}, p, v, { edited: true, answered: undefined });
      ['cls', 'name', 'answered', 'count'].forEach(k => delete rec[k]);
      rec.no3 = no3;
      sv.responses = sv.responses.filter(r => r.no3 !== no3).concat([rec]).sort((a, b) => a.no3.localeCompare(b.no3));
      Store.changed(); UI.toast('保存しました');
    } else if (res === 'del') {
      sv.responses = sv.responses.filter(r => r.no3 !== no3); Store.changed(); UI.toast('未回答に戻しました');
    }
    if (res) UI.refresh();
  },

  /* ---------- Forms の回答の取り込み ---------- */
  async importFile() {
    let wb;
    try { wb = await Excel.pickWorkbook(); } catch (e) { UI.toast(e.message, 'error'); return; }
    if (!wb) return;
    let parsed = null;
    for (const n of wb.SheetNames) {
      const rows = Excel.rows(wb.Sheets[n]);
      if (Excel.findHeader(rows, [/希望する進路/]) >= 0) { try { parsed = Survey.parse(rows); } catch (e) { UI.toast(e.message, 'error'); return; } break; }
    }
    if (!parsed) { UI.toast('進路希望調査の回答が見つかりません（「希望する進路」の列があるファイルを選んでください）', 'error'); return; }
    if (!parsed.responses.length) { UI.toast('取り込める回答がありません', 'warn'); return; }
    const d = new Date(), y = Store.data.year;
    const existing = this.all();
    const body = document.createElement('div');
    body.innerHTML = `<p class="sub">ファイル：${esc(wb._fileName)}${wb._encoding ? `（文字コード：${wb._encoding}）` : ''}</p>
      <div class="notice notice-info">${esc(parsed.info)}</div>
      ${parsed.skipped.length ? `<div class="notice notice-warn">読み飛ばし ${parsed.skipped.length} 行：${parsed.skipped.slice(0, 6).map(x => `${x.row}行目（${esc(x.reason)}）`).join('、')}</div>` : ''}
      ${parsed.unknown.length ? `<p class="help">使わない列 ${parsed.unknown.length} 個：${esc(parsed.unknown.slice(0, 6).join('、'))}</p>` : ''}
      <div class="grid">
        <div class="field"><label class="label">名称</label><input id="ivLabel" value="${esc(`令和${reiwa(y)}年${d.getMonth() + 1}月実施`)}"></div>
        <div class="field narrow"><label class="label">集計日</label><input type="date" id="ivDate" value="${todayISO()}"></div>
        ${existing.length ? `<div class="field wide"><label class="label">取り込み先</label><select id="ivTo"><option value="">新しい調査として追加</option>${existing.map(s => `<option value="${s.id}">「${esc(s.label)}」を置き換える（回答を直した人は、直した内容を残します）</option>`).join('')}</select></div>` : ''}
      </div>`;
    const res = await UI.modal({ title: 'Forms の回答を取り込む', body, wide: true, buttons: [{ label: 'キャンセル', value: null }, { label: '取り込む', kind: 'primary', value: 'ok' }] });
    if (res !== 'ok') return;
    const label = $('#ivLabel', body).value.trim() || '進路希望調査', date = $('#ivDate', body).value;
    const toId = $('#ivTo', body)?.value;
    if (toId) {
      const sv = existing.find(s => s.id === toId);
      const kept = sv.responses.filter(r => r.edited);
      const keptNo = new Set(kept.map(r => r.no3));
      sv.responses = parsed.responses.filter(r => !keptNo.has(r.no3)).concat(kept).sort((a, b) => a.no3.localeCompare(b.no3));
      sv.label = label; sv.date = date; sv.importedAt = new Date().toISOString(); sv.fileName = wb._fileName;
      this.state.id = sv.id;
    } else {
      const sv = { id: uid(), year: Store.data.year, label, date, importedAt: new Date().toISOString(), fileName: wb._fileName, responses: parsed.responses };
      this.all().push(sv); this.state.id = sv.id;
    }
    Store.changed();
    UI.toast(`取り込みました（${parsed.responses.length} 人）`);
    UI.refresh();
  },
};

Pages.register({ id: 'survey', no: 0, group: '準備', title: '進路希望調査', render: v => SurveyPage.render(v) });
