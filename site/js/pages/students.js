'use strict';
/* ============================================================
   2. 生徒・成績
   ============================================================ */

const StudentsPage = {
  state: { q: '', course: '', dept: '', sort: 'no3', dir: 'asc' },

  render(view) {
    const st = this.state;
    const s = Store.data.settings;
    const total = Store.data.students.length;
    view.innerHTML = `
      <div class="page-head">
        <div><h1>生徒・成績</h1><p class="lead">名簿・評定・出欠は Excel から取り込みます。特別活動と模試は入力用テンプレートで一括入力できます。</p></div>
        <div class="head-actions">
          <button class="btn btn-primary" id="stImport">Excel から取り込む</button>
          <button class="btn" id="stTpl">取り込み用の様式をダウンロード</button>
          <button class="btn" id="stTemplate" ${total ? '' : 'disabled'}>特別活動・模試の入力用Excel</button>
          <button class="btn" id="stAdd">＋ 生徒を追加</button>
        </div>
      </div>
      ${Store.data.students.some(x => !STUDENT_NO.test(x.no3)) ? `<div class="notice notice-warn">学籍が4桁の数字でない生徒が ${Store.data.students.filter(x => !STUDENT_NO.test(x.no3)).length} 人います（${Store.data.students.filter(x => !STUDENT_NO.test(x.no3)).slice(0, 5).map(x => esc(x.no3 || '空')).join('、')}）。行を開いて直してください。</div>` : ''}
      ${total ? '' : `<div class="card">
        <h2>取り込みの順番</h2>
        <ol class="steps">
          <li><b>名簿・評定・出欠</b>：01「元データ」シートと同じ形の Excel（1〜3年の番号・氏名・性別・<b>1〜3年の評定</b>・欠席・遅刻・早退）</li>
          <li><b>進路希望調査</b>：学籍・進路希望・受験方法…の表（「就職」かつ受験方法が「学校斡旋」または空欄の生徒が選考の対象）</li>
          <li><b>特別活動・模試</b>：この画面の「特別活動・模試の入力用Excel」で出力 → 記入 → 取り込み</li>
        </ol>
        <p class="help">1つの Excel に複数のシートがあっても、シートごとに内容を自動で見分けます。</p>
      </div>`}
      <div class="toolbar">
        <input type="search" id="stQ" class="grow" placeholder="番号・氏名で検索" value="${esc(st.q)}">
        <select id="stCourse">
          ${[['', '進路：すべて'], ['就職', '就職（学校斡旋）'], ['就職他', '就職（斡旋以外）'], ['進学', '進学'], ['その他', 'その他'], ['未', '進路未入力']]
            .map(([v, l]) => `<option value="${v}" ${st.course === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <select id="stDept"><option value="">学科：すべて</option>${s.departments.map(d => `<option ${st.dept === d.name ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        ${total ? '<button class="btn btn-danger-ghost btn-sm" id="stClear">全員削除</button>' : ''}
      </div>
      <div id="stTable"></div>`;

    const redraw = () => this.drawTable($('#stTable', view));
    $('#stQ', view).addEventListener('input', e => { st.q = e.target.value; redraw(); });
    $('#stCourse', view).addEventListener('change', e => { st.course = e.target.value; redraw(); });
    $('#stDept', view).addEventListener('change', e => { st.dept = e.target.value; redraw(); });
    $('#stImport', view).addEventListener('click', () => Importer.run('grades'));
    $('#stTpl', view).addEventListener('click', () => Importer.templates(['grades', 'course', 'special']));
    $('#stTemplate', view).addEventListener('click', () => ImportTypes.special.template());
    $('#stAdd', view).addEventListener('click', () => this.edit(null));
    $('#stClear', view)?.addEventListener('click', async () => {
      if (!await UI.confirm(`生徒 ${total} 人と、その希望・応募の記録をすべて削除します。`, { ok: 'すべて削除', danger: true })) return;
      Store.data.students = [];
      Store.data.applications = [];
      Store.changed();
      UI.refresh();
    });
    redraw();
  },

  filtered() {
    const st = this.state;
    const q = toHalf(st.q).trim();
    const rules = Store.data.settings.pointRules;
    let rows = Store.data.students.map(s => {
      const p = Points.calc(s, rules);
      const d = Students.dept(s);
      return { s, p, no3: num(s.no3), name: s.name, dept: d ? d.short : '', course: s.course, final: p.final, learning: p.learning, absent: p.absentTotal, late: p.lateTotal, mogi: s.mogi };
    });
    if (q) rows = rows.filter(r => r.s.no3.includes(q) || (r.s.name || '').includes(q));
    if (st.course === '就職') rows = rows.filter(r => Students.isJobSeeker(r.s));
    else if (st.course === '就職他') rows = rows.filter(r => r.s.course === '就職' && !Students.isJobSeeker(r.s));
    else if (st.course === '未') rows = rows.filter(r => !r.s.course);
    else if (st.course) rows = rows.filter(r => r.s.course === st.course);
    if (st.dept) rows = rows.filter(r => (Students.dept(r.s) || {}).name === st.dept);
    return sortRows(rows, st.sort, st.dir);
  },

  drawTable(el) {
    const st = this.state;
    if (!Store.data.students.length) { el.innerHTML = ''; return; }
    const rows = this.filtered();
    const mk = v => v ? '〇' : '';
    const cols = [['no3', '番号', 'num'], ['name', '氏名'], ['gender', '性'], ['dept', '学科'], ['course', '進路'],
      ['learning', '評定平均', 'num'], ['absent', '欠席', 'num'], ['late', '遅刻早退', 'num'],
      ['disc', '謹慎'], ['club', '部活'], ['cap', '部長'], ['council', '生徒会', 'num'], ['mogi', '模試', 'num'], ['final', '最終P', 'num'], ['warn', '']];
    el.innerHTML = `
      <p class="count">${rows.length} 人 ${rows.length !== Store.data.students.length ? `／ 全 ${Store.data.students.length} 人` : ''}</p>
      <div class="table-wrap"><table class="tbl tbl-click">
      <thead><tr>${cols.map(([k, l, c]) => `<th class="${c || ''} ${['disc', 'club', 'cap', 'warn', 'gender'].includes(k) ? '' : 'sortable'} ${st.sort === k ? 'sorted-' + st.dir : ''}" data-sort="${k}">${l}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => {
        const s = r.s;
        return `<tr data-id="${s.id}">
          <td class="num mono">${esc(s.no3)}</td><td>${esc(s.name)}</td><td>${esc(s.gender)}</td><td>${esc(r.dept)}</td>
          <td>${s.course ? esc(s.course) + (s.course === '就職' && s.method && s.method !== '学校斡旋' ? `<span class="sub">（${esc(s.method)}）</span>` : '') : '<span class="sub">未</span>'}</td>
          <td class="num">${r.learning ?? ''}</td><td class="num">${r.p.absentTotal}</td><td class="num">${r.p.lateTotal}</td>
          <td>${s.disc3 ? '<span class="tag tag-warn">3年</span>' : ''}${s.disc12 ? '<span class="tag tag-warn">1・2年</span>' : ''}</td>
          <td class="c">${mk(s.club3)}</td><td class="c">${mk(s.captain)}</td><td class="num">${s.council || ''}</td>
          <td class="num">${s.mogi ?? ''}</td><td class="num"><b>${r.final ?? ''}</b></td>
          <td>${r.p.warn.map(w => `<span class="tag tag-warn">${esc(w)}</span>`).join(' ')}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    $$('th.sortable', el).forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = ['final', 'learning'].includes(k) ? 'desc' : 'asc'; }
      this.drawTable(el);
    }));
    $$('tbody tr', el).forEach(tr => tr.addEventListener('click', () => this.edit(tr.dataset.id)));
  },

  fields() {
    const att = k => [1, 2, 3].map(y => ({ k: k + y, label: `${y}年`, type: 'number', narrow: true }));
    return [
      { sec: '① 基本情報', cols: 2 },
      { k: 'no3', label: '3年番号', req: true, narrow: true, ph: '3101', help: '4桁の数字' },
      { k: 'name', label: '氏名' },
      { k: 'gender', label: '性別', type: 'select', options: ['', '男', '女'], narrow: true },
      { type: 'blank' },
      { k: 'no1', label: '1年のときの番号', narrow: true, help: '4桁の数字' },
      { k: 'no2', label: '2年のときの番号', narrow: true, help: '4桁の数字' },
      { sec: '② 進路希望', cols: 2 },
      { k: 'course', label: '進路', type: 'select', options: ['', '就職', '進学', 'その他'], narrow: true },
      { k: 'method', label: '受験方法', list: ['学校斡旋', '自己開拓', '縁故', '公務員', '自営', '家事手伝い'], help: '「学校斡旋」または空欄で就職なら選考の対象' },
      { k: 'hope', label: '第1希望' },
      { k: 'hopeJob', label: '希望職種' },
      { type: 'derived', k: 'survey', label: '' },
      { sec: '③ 評定', note: '科目ごとに 1〜5 を入力します（単位不認定は 1）。1つ入れると次の欄へ進みます。Excel などからの貼り付けもできます。', full: true, cols: 1 },
      { type: 'derived', k: 'grades', label: '' },
      { sec: '④ 出欠（日数・回数）', cols: 4 },
      { type: 'caption', label: '欠席（日）' }, ...att('a'),
      { type: 'caption', label: '遅刻（回）' }, ...att('l'),
      { type: 'caption', label: '早退（回）' }, ...att('e'),
      { sec: '⑤ 特別指導・特別活動・模試', cols: 2 },
      { k: 'disc3', label: '特別指導（3年）', type: 'checkbox', checkLabel: '謹慎以上の特別指導あり' },
      { k: 'disc12', label: '特別指導（1・2年）', type: 'checkbox', checkLabel: '謹慎以上の特別指導あり' },
      { k: 'club3', label: '部活動', type: 'checkbox', checkLabel: '3年で在籍（規定の条件を満たす）' },
      { k: 'captain', label: '部長', type: 'checkbox', checkLabel: '部長を務めた' },
      { k: 'council', label: '生徒会役員（期数）', type: 'number', narrow: true },
      { k: 'mogi', label: '校内模試の順位', type: 'number', narrow: true },
      { sec: '⑥ ポイント（自動計算）', note: '入力すると、その場で計算し直されます。' },
      { type: 'derived', k: 'points', label: '' },
      { sec: '⑦ その他', cols: 1 },
      { k: 'disability', label: '報告書', type: 'checkbox', checkLabel: '様式13の（ ）内数（障害者数）に計上' },
      { k: 'group', label: '職場見学グループ', narrow: true },
      { k: 'note', label: 'メモ', type: 'textarea', wide: true },
    ];
  },

  toForm(s) {
    const o = Object.assign({}, s);
    [0, 1, 2].forEach(i => { o['a' + (i + 1)] = s.absent[i]; o['l' + (i + 1)] = s.late[i]; o['e' + (i + 1)] = s.early[i]; });
    return o;
  },
  fromForm(v, s, grades) {
    ['no3', 'name', 'gender', 'no1', 'no2', 'course', 'method', 'hope', 'hopeJob', 'disc3', 'disc12', 'club3', 'captain', 'mogi', 'disability', 'group', 'note']
      .forEach(k => { s[k] = v[k]; });
    s.no3 = studentNo(v.no3);
    s.no1 = studentNo(v.no1);
    s.no2 = studentNo(v.no2);
    s.council = v.council || 0;
    if (grades) s.grades = grades;
    s.absent = [v.a1, v.a2, v.a3]; s.late = [v.l1, v.l2, v.l3]; s.early = [v.e1, v.e2, v.e3];
    return s;
  },

  /* ---------- 評定の表（科目ごとの欄） ---------- */
  GRADE_ROWS: [['y1', '1年'], ['y2', '2年'], ['y3', '3年（1学期まで）']],
  /** 画面の表から読む（空欄は null のまま、位置を保つ） */
  readGrades(root) {
    const o = {};
    for (const [y] of this.GRADE_ROWS) o[y] = $$('[data-gy="' + y + '"]', root).map(c => num(toHalf(c.value)));
    return o;
  },
  /** 空欄を詰めた形（保存用） */
  gradesToObj(raw) {
    const o = {};
    for (const [y] of this.GRADE_ROWS) o[y] = (raw[y] || []).filter(x => x != null);
    return o;
  },
  drawGrades(root, grades, extra = 0) {
    const el = $('[data-derived="grades"]', root); if (!el) return;
    const cols = Math.max(15, ...this.GRADE_ROWS.map(([y]) => (grades[y] || []).length)) + extra;
    const cell = (y, i) => '<td><input data-gy="' + y + '" data-gi="' + i + '" maxlength="1" inputmode="numeric" autocomplete="off" value="' + esc((grades[y] || [])[i] ?? '') + '"></td>';
    el.innerHTML = '<div class="g-wrap"><table class="gtbl"><thead><tr><th></th>' + Array.from({ length: cols }, (_, i) => '<th>' + (i + 1) + '</th>').join('') + '<th class="g-av">平均</th><th class="g-n">数</th></tr></thead><tbody>'
      + this.GRADE_ROWS.map(([y, l]) => '<tr><th class="g-lab">' + l + '</th>' + Array.from({ length: cols }, (_, i) => cell(y, i)).join('') + '<td class="g-av" data-ga="' + y + '"></td><td class="g-n" data-gn="' + y + '"></td></tr>').join('')
      + '</tbody></table></div><div class="g-foot"><button type="button" class="btn btn-sm" data-gadd>＋ 欄を増やす</button>'
      + '<span class="g-all">評定平均（1年〜3年1学期の全科目）　<b data-gall>—</b>　<small data-gpt></small></span></div>';
    this.updateGrades(root);
  },
  updateGrades(root) {
    const raw = this.readGrades(root), all = [];
    for (const [y] of this.GRADE_ROWS) {
      const v = raw[y].filter(x => x != null);
      all.push(...v);
      const a = $('[data-ga="' + y + '"]', root), n = $('[data-gn="' + y + '"]', root);
      if (a) a.textContent = v.length ? (v.reduce((p, q) => p + q, 0) / v.length).toFixed(3) : '';
      if (n) n.textContent = v.length || '';
    }
    const avg = all.length ? all.reduce((p, q) => p + q, 0) / all.length : null;
    const g = $('[data-gall]', root), pt = $('[data-gpt]', root);
    if (g) g.textContent = avg == null ? '—' : avg.toFixed(3);
    if (pt) pt.textContent = avg == null ? '' : '（学習ポイントでは小数第2位を四捨五入して ' + Points.round(avg, 1) + '）';
  },
  bindGrades(root) {
    const el = $('[data-derived="grades"]', root); if (!el) return;
    const rows = this.GRADE_ROWS.map(([y]) => y);
    el.addEventListener('input', e => {
      const t = e.target; if (!t.dataset.gy) return;
      t.value = toHalf(t.value).replace(/[^1-5]/g, '');
      if (t.value) { const nx = t.closest('td').nextElementSibling?.querySelector('input'); if (nx) { nx.focus(); nx.select(); } }
      this.updateGrades(root);
    });
    el.addEventListener('keydown', e => {
      const t = e.target; if (!t.dataset.gy) return;
      const cells = $$('[data-gy="' + t.dataset.gy + '"]', el), i = cells.indexOf(t);
      const go = c => { if (c) { e.preventDefault(); c.focus(); c.select(); } };
      if (e.key === 'ArrowRight') go(cells[i + 1]);
      else if (e.key === 'ArrowLeft') go(cells[i - 1]);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const r = rows.indexOf(t.dataset.gy) + (e.key === 'ArrowDown' ? 1 : -1); if (rows[r]) go($$('[data-gy="' + rows[r] + '"]', el)[i]); }
      else if (e.key === 'Backspace' && !t.value) go(cells[i - 1]);
    });
    el.addEventListener('paste', e => {
      const t = e.target; if (!t.dataset.gy) return;
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (!text || !/[\s,，、]/.test(text.trim())) return;
      e.preventDefault();
      const lines = text.trim().split(/\r?\n/).map(l => toHalf(l).split(/[\s,，、]+/).filter(Boolean));
      const r0 = rows.indexOf(t.dataset.gy), c0 = Number(t.dataset.gi);
      const need = c0 + Math.max(...lines.map(r => r.length));
      const have = $$('[data-gy="y1"]', el).length;
      const keep = this.readGrades(root);
      if (need > have) this.drawGrades(root, keep, need - Math.max(15, ...rows.map(y => keep[y].length)));
      lines.forEach((ln, ri) => { const y = rows[r0 + ri]; if (!y) return; const cells = $$('[data-gy="' + y + '"]', el); ln.forEach((v, ci) => { if (cells[c0 + ci] && /^[1-5]$/.test(v)) cells[c0 + ci].value = v; }); });
      this.updateGrades(root); this.showPoints(root);
    });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-gadd]')) this.drawGrades(root, this.readGrades(root), 1);
    });
  },

  /* ---------- 進路希望調査との連動 ---------- */
  drawSurvey(root, autofill, force = false) {
    const el = $('[data-derived="survey"]', root); if (!el) return;
    const no = studentNo($('[data-k="no3"]', root).value);
    const sv = Survey.latest();
    const p = sv && no ? Survey.people(sv).find(x => x.no3 === no) : null;
    const box = html => { el.innerHTML = '<div class="sv-link">' + html + '</div>'; };
    if (!sv) { box('<b>進路希望調査</b>　まだ取り込まれていません。［進路希望調査］でFormsの回答を取り込むと、ここに回答が出ます。'); return; }
    if (!no) { box('<b>進路希望調査（' + esc(sv.label) + '）</b>　3年番号を入れると、その生徒の回答が出ます。'); return; }
    if (!p || !p.answered) { box('<b>進路希望調査（' + esc(sv.label) + '）</b>　<span class="tag tag-warn">未回答</span>'); return; }
    const patch = Survey.patch(p);
    const labels = { course: '進路', method: '受験方法', hopeJob: '希望職種', hope: '第1希望' };
    if (autofill || force) {
      let n = 0;
      for (const k of Object.keys(patch)) {
        const inp = $('[data-k="' + k + '"]', root);
        if (inp && (force || !String(inp.value).trim()) && inp.value !== patch[k]) { inp.value = patch[k]; n++; }
      }
      if (n && !force) UI.toast('進路希望調査の回答を、進路希望の空欄に入れました');
    }
    const now = Form.read(root, this.fields());
    const diff = Object.keys(patch).filter(k => String(now[k] || '') !== String(patch[k]));
    const line = (k, v) => v ? '<span class="sv-i"><small>' + k + '</small>' + esc(v) + '</span>' : '';
    box('<div class="sv-h"><b>進路希望調査（' + esc(sv.label) + '）の回答</b>'
      + (diff.length ? '<span class="tag tag-warn">入力欄と違う：' + diff.map(k => labels[k]).join('・') + '</span><button type="button" class="btn btn-sm" data-svapply>回答を入力欄に反映</button>' : '<span class="tag tag-accent">入力欄と一致</span>') + '</div>'
      + '<div class="sv-b">' + line('進路', p.course) + line('就職方法', p.jobMethod) + line('希望職種', p.job) + line('学校種別', p.school) + line('希望分野', p.field) + line('志望先', p.destination) + line('受験方法', p.method) + line('悩み', p.worry) + line('その他', p.other) + line('未定の理由', p.reason) + '</div>');
  },

  showPoints(root) {
    const f = this.fields();
    const s = this.fromForm(Form.read(root, f), blankStudent(), this.gradesToObj(this.readGrades(root)));
    const p = Points.calc(s, Store.data.settings.pointRules);
    $('[data-derived="points"]', root).innerHTML = `
      <div class="pt-sum">
        <div class="pt"><span>学習</span><b>${p.learning ?? '—'}</b><small>評定 ${p.gradeCount} 個</small></div><span class="pt-op">＋</span>
        <div class="pt"><span>生活</span><b>${p.life}</b><small>欠席${p.absentTotal}日→${p.absentP}／遅刻早退${p.lateTotal}回→${p.lateP}／謹慎 3年${p.d3P}・1,2年${p.d12P}</small></div><span class="pt-op">＋</span>
        <div class="pt"><span>特活</span><b>${p.special}</b><small>部活${p.clubP}・部長${p.capP}・生徒会${p.councilP}</small></div><span class="pt-op">＝</span>
        <div class="pt pt-final"><span>最終</span><b>${p.final ?? '—'}</b></div>
      </div>`;
  },

  /** orderIds＝前後の生徒に移るときの並び（省略すると一覧の並び） */
  async edit(id, orderIds) {
    const existing = id ? Students.byId(id) : null;
    const fields = this.fields();
    const body = document.createElement('div');
    body.innerHTML = `<div class="fs-cols">${Form.html(fields, this.toForm(existing || blankStudent()))}</div>`;
    this.drawGrades(body, existing ? existing.grades : blankStudent().grades);
    this.bindGrades(body);
    this.drawSurvey(body, !existing);   // 新しく追加する生徒だけ、空欄に調査の回答を入れる（既存の生徒は自動反映ずみ）
    body.addEventListener('input', e => { if (e.target.matches('[data-k="no3"]')) this.drawSurvey(body, false); this.showPoints(body); });
    body.addEventListener('change', () => this.showPoints(body));
    body.addEventListener('click', e => {
      if (e.target.closest('[data-svapply]')) { this.drawSurvey(body, false, true); this.showPoints(body); }
    });
    // 一覧の並び（検索・並び替えのまま）で、前後の生徒
    const order = existing ? (orderIds || this.filtered().map(x => x.s.id)) : [];
    const at = order.indexOf(id), prevId = at > 0 ? order[at - 1] : null, nextId = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
    const buttons = [];
    if (existing) buttons.push({ label: '削除', kind: 'danger-ghost', value: 'delete' });
    const save = root => {
        const v = Form.read(root, fields);
        const no = studentNo(v.no3);
        if (!no) { UI.toast('3年番号は4桁の数字で入力してください（例：3101）', 'warn'); return false; }
        for (const k of ['no1', 'no2']) if (v[k] && !studentNo(v[k])) { UI.toast(`${k === 'no1' ? '1' : '2'}年番号は4桁の数字で入力してください`, 'warn'); return false; }
        const dup = Students.byNo(no);
        if (dup && dup !== existing) { UI.toast(`番号 ${no} は既に登録されています`, 'warn'); return false; }
        const s = existing || blankStudent();
        this.fromForm(v, s, this.gradesToObj(this.readGrades(root)));
        if (!existing) Store.data.students.push(s);
        Store.changed();
    };
    if (existing) {
      const nb = (id2) => { const s2 = id2 && Students.byId(id2); return s2 ? Students.label(s2) : ''; };
      if (prevId) buttons.push({ label: '◀ 前の生徒', value: 'prev', onClick: save, title: nb(prevId) });
      if (nextId) buttons.push({ label: '次の生徒 ▶', value: 'next', onClick: save, title: nb(nextId) });
    }
    buttons.push({ label: 'キャンセル', value: null });
    buttons.push({ label: '保存', kind: 'primary', value: 'save', onClick: save });
    const res = await UI.modal({ title: existing ? `生徒の編集　${Students.label(existing)}` : '生徒の追加', body, wide: 'xl', buttons, onOpen: r => this.showPoints(r) });
    if (res === 'delete') {
      const apps = Apps.of(existing.id).length;
      if (await UI.confirm(`${Students.label(existing)} を削除します。${apps ? `\n希望・応募の記録 ${apps} 件も削除されます。` : ''}`, { ok: '削除', danger: true })) {
        Store.data.students = Store.data.students.filter(x => x !== existing);
        Store.data.applications = Store.data.applications.filter(a => a.studentId !== existing.id);
        Store.changed();
      }
    }
    if (res) UI.refresh();
    if (res === 'prev' || res === 'next') this.edit(res === 'prev' ? prevId : nextId, orderIds);   // 保存して、前後の生徒を開く
  },
};

Pages.register({ id: 'students', no: 2, group: '準備', title: '生徒・成績', render: v => StudentsPage.render(v) });
