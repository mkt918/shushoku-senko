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
      { k: 'method', label: '受験方法', list: ['学校斡旋', '縁故', '公務員', '自営'], help: '「学校斡旋」または空欄で就職なら選考の対象' },
      { k: 'hope', label: '第1希望' },
      { k: 'hopeJob', label: '希望職種' },
      { sec: '③ 評定', note: '数字をスペースまたはカンマで区切って入力（単位不認定は 1）。', cols: 1 },
      { k: 'g1', label: '1年', wide: true }, { k: 'g2', label: '2年', wide: true }, { k: 'g3', label: '3年（1学期まで）', wide: true },
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
      { sec: '⑦ その他', full: true, cols: 2 },
      { k: 'disability', label: '報告書', type: 'checkbox', checkLabel: '様式13の（ ）内数（障害者数）に計上' },
      { k: 'group', label: '職場見学グループ', narrow: true },
      { k: 'note', label: 'メモ', type: 'textarea', wide: true },
    ];
  },

  toForm(s) {
    const o = Object.assign({}, s);
    ['y1', 'y2', 'y3'].forEach((y, i) => { o['g' + (i + 1)] = (s.grades[y] || []).join(' '); });
    [0, 1, 2].forEach(i => { o['a' + (i + 1)] = s.absent[i]; o['l' + (i + 1)] = s.late[i]; o['e' + (i + 1)] = s.early[i]; });
    return o;
  },
  fromForm(v, s) {
    const parseG = t => toHalf(t || '').split(/[\s,，、]+/).map(num).filter(x => x != null);
    ['no3', 'name', 'gender', 'no1', 'no2', 'course', 'method', 'hope', 'hopeJob', 'disc3', 'disc12', 'club3', 'captain', 'mogi', 'disability', 'group', 'note']
      .forEach(k => { s[k] = v[k]; });
    s.no3 = studentNo(v.no3);
    s.no1 = studentNo(v.no1);
    s.no2 = studentNo(v.no2);
    s.council = v.council || 0;
    s.grades = { y1: parseG(v.g1), y2: parseG(v.g2), y3: parseG(v.g3) };
    s.absent = [v.a1, v.a2, v.a3]; s.late = [v.l1, v.l2, v.l3]; s.early = [v.e1, v.e2, v.e3];
    return s;
  },

  showPoints(root) {
    const f = this.fields();
    const s = this.fromForm(Form.read(root, f), blankStudent());
    const p = Points.calc(s, Store.data.settings.pointRules);
    $('[data-derived="points"]', root).innerHTML = `
      <div class="pt-sum">
        <div class="pt"><span>学習</span><b>${p.learning ?? '—'}</b><small>評定 ${p.gradeCount} 個</small></div><span class="pt-op">＋</span>
        <div class="pt"><span>生活</span><b>${p.life}</b><small>欠席${p.absentTotal}日→${p.absentP}／遅刻早退${p.lateTotal}回→${p.lateP}／謹慎 3年${p.d3P}・1,2年${p.d12P}</small></div><span class="pt-op">＋</span>
        <div class="pt"><span>特活</span><b>${p.special}</b><small>部活${p.clubP}・部長${p.capP}・生徒会${p.councilP}</small></div><span class="pt-op">＝</span>
        <div class="pt pt-final"><span>最終</span><b>${p.final ?? '—'}</b></div>
      </div>`;
  },

  async edit(id) {
    const existing = id ? Students.byId(id) : null;
    const fields = this.fields();
    const body = document.createElement('div');
    body.innerHTML = `<div class="fs-cols">${Form.html(fields, this.toForm(existing || blankStudent()))}</div>`;
    body.addEventListener('input', () => this.showPoints(body));
    body.addEventListener('change', () => this.showPoints(body));
    const buttons = [];
    if (existing) buttons.push({ label: '削除', kind: 'danger-ghost', value: 'delete' });
    buttons.push({ label: 'キャンセル', value: null });
    buttons.push({
      label: '保存', kind: 'primary', value: 'save', onClick: root => {
        const v = Form.read(root, fields);
        const no = studentNo(v.no3);
        if (!no) { UI.toast('3年番号は4桁の数字で入力してください（例：3101）', 'warn'); return false; }
        for (const k of ['no1', 'no2']) if (v[k] && !studentNo(v[k])) { UI.toast(`${k === 'no1' ? '1' : '2'}年番号は4桁の数字で入力してください`, 'warn'); return false; }
        const dup = Students.byNo(no);
        if (dup && dup !== existing) { UI.toast(`番号 ${no} は既に登録されています`, 'warn'); return false; }
        const s = existing || blankStudent();
        this.fromForm(v, s);
        if (!existing) Store.data.students.push(s);
        Store.changed();
      },
    });
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
  },
};

Pages.register({ id: 'students', no: 2, group: '準備', title: '生徒・成績', render: v => StudentsPage.render(v) });
