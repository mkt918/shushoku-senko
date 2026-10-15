'use strict';
/* ============================================================
   8. 進路決定：生徒ごとの進路先（就職・進学・その他）
   - 就職（学校斡旋）は、内定した求人から自動で入る
   - 進学・斡旋外・公務などは入力。人数は年度末の資料に自動で数えられる
   ============================================================ */

const OutcomesPage = {
  state: { q: '', f: '', dept: '' },

  render(view) {
    const st = this.state;
    const all = Outcomes.list();
    const sm = Outcomes.summary(all);
    const cnt = f => all.filter(f).length;
    const stat = (l, n, u = '人') => `<div class="stat"><span class="stat-label">${l}</span><span class="stat-val">${n}</span><span class="stat-unit">${u}</span></div>`;
    const depts = [...new Set(all.map(x => x.dept))];
    view.innerHTML = `
      <div class="page-head"><div><h1>進路決定</h1>
      <p class="lead">生徒ごとの進路先を記録します。<b>就職（学校斡旋）は内定した求人から自動</b>で入ります。進学・斡旋外・公務などは入力してください。ここの内容から、年度末の<b>進路先一覧・進路指導まとめ</b>が自動で作られます。</p></div></div>
      <div class="stats stats-sm">
        ${stat('決定', cnt(x => x.d.type && x.d.status === '決定'))}${stat('活動中', cnt(x => x.d.type && x.d.status === '活動中'))}${stat('未入力', cnt(x => !x.d.type))}
        ${stat('就職', sm.all.jobSchool + sm.all.jobOther + sm.all.jobPublic)}${stat('進学', sm.all.univ + sm.all.junior + sm.all.senshu + sm.all.college + sm.all.nurse + sm.all.eduOther)}
      </div>
      <div class="toolbar">
        <input type="search" id="ocQ" class="grow" placeholder="番号・氏名・進路先で検索" value="${esc(st.q)}">
        <select id="ocF">${[['', 'すべて'], ['未', '未入力'], ['活', '活動中'], ['就職', '就職'], ['進学', '進学'], ['その他', 'その他']].map(([v, l]) => `<option value="${v}" ${st.f === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select id="ocD"><option value="">学科：すべて</option>${depts.map(d => `<option ${st.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
      </div>
      <div id="ocTable"></div>`;
    const redraw = () => this.draw($('#ocTable', view));
    $('#ocQ', view).addEventListener('input', e => { st.q = e.target.value; redraw(); });
    $('#ocF', view).addEventListener('change', e => { st.f = e.target.value; redraw(); });
    $('#ocD', view).addEventListener('change', e => { st.dept = e.target.value; redraw(); });
    redraw();
  },

  desc(d) {
    if (d.type === '就職') return [d.jobKind, d.company, d.ind ? OC.IND_NAMES[d.ind] : '', d.jobTitle].filter(Boolean).join('　');
    if (d.type === '進学') return [OC.levelName(d.level), d.school, [d.faculty, d.dept].filter(Boolean).join(' '), d.exam].filter(Boolean).join('　');
    if (d.type === 'その他') return d.note || '';
    return '';
  },

  draw(el) {
    const st = this.state, q = toHalf(st.q).trim();
    let rows = Outcomes.list();
    if (q) rows = rows.filter(x => x.s.no3.includes(q) || (x.s.name || '').includes(q) || this.desc(x.d).includes(q));
    if (st.dept) rows = rows.filter(x => x.dept === st.dept);
    if (st.f === '未') rows = rows.filter(x => !x.d.type);
    else if (st.f === '活') rows = rows.filter(x => x.d.type && x.d.status === '活動中');
    else if (st.f) rows = rows.filter(x => x.d.type === st.f);
    if (!Store.data.students.length) { el.innerHTML = '<div class="empty"><p class="empty-title">生徒が登録されていません</p><p>［生徒・成績］で名簿を取り込んでください。</p></div>'; return; }
    el.innerHTML = `<p class="count">${rows.length} 人</p><div class="table-wrap"><table class="tbl tbl-click"><thead><tr><th class="num">番号</th><th>氏名</th><th>性</th><th>学科</th><th>区分</th><th>状態</th><th>進路先</th></tr></thead><tbody>
      ${rows.map(x => `<tr data-id="${x.s.id}"><td class="num mono">${esc(x.s.no3)}</td><td>${esc(x.s.name)}</td><td>${esc(x.gender)}</td><td>${esc(x.dept)}</td>
        <td>${x.d.type ? `<b>${esc(x.d.type)}</b>` : '<span class="tag tag-warn">未入力</span>'}</td>
        <td>${x.d.type ? `<span class="tag ${x.d.status === '決定' ? 'tag-accent' : 'tag-warn'}">${esc(x.d.status)}</span>${x.d.auto ? ' <span class="sub">（自動）</span>' : ''}` : ''}</td>
        <td class="sm">${esc(this.desc(x.d))}</td></tr>`).join('')}</tbody></table></div>`;
    $$('tbody tr', el).forEach(tr => tr.addEventListener('click', () => this.edit(tr.dataset.id)));
  },

  /* ---------- 入力 ---------- */
  names(kind) {
    const H = Store.data.history, M = H.master;
    if (kind === 'work') return [...new Set([...H.work.map(r => r.name), ...Store.data.jobs.map(j => shortCompany(j.shortName || j.company))])];
    const fromH = lv => H.univ.filter(r => lv.includes(r.level)).map(r => r.school);
    const fromM = k => (M && M[k] ? M[k].map(r => r.name) : []);
    if (kind === 'univ') return [...new Set([...fromH(['univ']), ...fromM('univ')])];
    if (kind === 'junior') return [...new Set([...fromH(['junior']), ...fromM('junior')])];
    return [...new Set([...H.senshu.map(r => r.name), ...fromM('senshu')])];
  },
  fields() { const H = Store.data.history.senshu, m = new Map(); H.filter(r => r.sec === 'open').forEach(r => { if (r.field && !m.has(r.field)) m.set(r.field, r.fieldNo || 99); }); return [...m.entries()].sort((a, b) => a[1] - b[1]).map(x => x[0]); },

  async edit(id) {
    const s = Students.byId(id), cur = Outcomes.of(s);
    const body = document.createElement('div');
    const sel = (k, opts, v) => `<select data-k="${k}">${opts.map(([a, b]) => `<option value="${esc(a)}" ${String(v ?? '') === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
    const inp = (k, v, ph = '', list = '') => `<input data-k="${k}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" ${list ? `list="${list}"` : ''} autocomplete="off">`;
    const f = (l, h, w = '') => `<label class="field ${w}"><span class="label">${l}</span>${h}</label>`;
    const dev = Apps.current(s.id);
    body.innerHTML = `<p class="sub">${esc(s.no3)}　${esc(s.name)}　${esc((Students.dept(s) || {}).name || '')}${dev && dev.result === '内定' ? '　／　内定あり（学校斡旋の就職先は、内定した求人から入ります）' : ''}</p>
      <div class="grid">
        ${f('区分', sel('type', [['', '（未入力）'], ['就職', '就職'], ['進学', '進学'], ['その他', 'その他']], cur.type))}
        ${f('状態', sel('status', OC.STATUS.map(x => [x, x === '決定' ? '決定（進路先が決まった）' : '活動中（まだ決まっていない）']), s.dest ? (s.dest.status || '決定') : '決定'))}
      </div>
      <div class="oc-sec" data-sec="就職"><h3>就職</h3><div class="grid">
        ${f('種別', sel('jobKind', OC.JOBKINDS.map(x => [x, x]), cur.jobKind || '学校斡旋'))}
        ${f('会社名（一覧に載せる名前）', inp('company', cur.company, '例：トヨタ自動車', 'dlWork'), 'wide')}
        ${f('正式な会社名（学科別資料用）', inp('companyFull', cur.companyFull), 'wide')}
        ${f('業種', sel('ind', [['', '（未設定）'], ...Object.entries(OC.IND_NAMES).map(([k, v]) => [k, `${OC.fw(k)} ${v}`])], cur.ind))}
        ${f('職業分類', sel('occ', [['', '（未設定）'], ...Object.entries(OC.OCC_SHORT).map(([k, v]) => [k, v])], cur.occ))}
        ${f('職種', inp('jobTitle', cur.jobTitle), 'wide')}</div></div>
      <div class="oc-sec" data-sec="進学"><h3>進学</h3><div class="grid">
        ${f('校種', sel('level', [['', '（選んでください）'], ...OC.LEVELS], cur.level))}
        ${f('受験方法', sel('exam', [['', '（未入力）'], ...OC.EXAMS.map(x => [x, x])], cur.exam))}
        ${f('学校名', inp('school', cur.school, '候補から選べます', 'dlSchool'), 'wide')}
        ${f('学部（短大は学科）', inp('faculty', cur.faculty, '', 'dlFac'))}
        ${f('学科（短大は専攻・コース）', inp('dept', cur.dept, '', 'dlDept'))}
        ${f('専修・各種の分野', sel('field', [['', '（自動／未設定）'], ...this.fields().map(x => [x, x])], cur.field), 'wide')}</div></div>
      <div class="oc-sec" data-sec="その他"><h3>その他</h3><div class="grid">${f('内容', inp('note', cur.note, '例：家事手伝い・未定'), 'wide')}</div></div>
      <datalist id="dlWork"></datalist><datalist id="dlSchool"></datalist><datalist id="dlFac"></datalist><datalist id="dlDept"></datalist>`;
    const upd = () => {
      const t = $('[data-k="type"]', body).value;
      $$('.oc-sec', body).forEach(x => { x.style.display = x.dataset.sec === t ? '' : 'none'; });
      const lv = $('[data-k="level"]', body).value;
      const dl = (id, arr) => { $(id, body).innerHTML = arr.map(x => `<option value="${esc(x)}">`).join(''); };
      dl('#dlWork', this.names('work'));
      dl('#dlSchool', this.names(lv === 'univ' ? 'univ' : lv === 'junior' ? 'junior' : 'senshu'));
      const sc = $('[data-k="school"]', body).value, key = schoolKey(sc);
      const hu = Store.data.history.univ.filter(r => schoolKey(r.school) === key), mu = ((Store.data.history.master || {})[lv === 'junior' ? 'junior' : 'univ'] || []).filter(r => schoolKey(r.name) === key);
      dl('#dlFac', [...new Set([...hu.map(r => r.faculty), ...mu.map(r => r.faculty)].filter(Boolean))]);
      dl('#dlDept', [...new Set([...hu.map(r => r.dept), ...mu.map(r => r.dept)].filter(Boolean))]);
      $('[data-k="field"]', body).closest('.field').style.display = ['senshu', 'college', 'nurse'].includes(lv) && $('[data-k="exam"]', body).value !== '指定校推薦' ? '' : 'none';
      $('[data-k="faculty"]', body).closest('.field').style.display = $('[data-k="dept"]', body).closest('.field').style.display = ['univ', 'junior'].includes(lv) ? '' : 'none';
    };
    body.addEventListener('input', upd); body.addEventListener('change', upd);
    const buttons = [];
    if (s.dest) buttons.push({ label: '入力を消して自動に戻す', kind: 'danger-ghost', value: 'clear' });
    buttons.push({ label: 'キャンセル', value: null }, { label: '保存', kind: 'primary', value: 'save' });
    const res = await UI.modal({ title: '進路先の入力', body, buttons, wide: true, onOpen: upd });
    if (res === 'save') {
      const v = {}; $$('[data-k]', body).forEach(e => { v[e.dataset.k] = e.value.trim(); });
      if (!v.type) delete s.dest;
      else {
        const d = { type: v.type, status: v.status || '決定' };
        if (v.type === '就職') Object.assign(d, { jobKind: v.jobKind, company: v.company, companyFull: v.companyFull, ind: v.ind, occ: v.occ, jobTitle: v.jobTitle });
        if (v.type === '進学') Object.assign(d, { level: v.level, exam: v.exam, school: v.school, faculty: v.faculty, dept: v.dept, field: v.field });
        if (v.type === 'その他') d.note = v.note;
        s.dest = d;
      }
      Store.changed(); UI.toast('保存しました');
    } else if (res === 'clear') { delete s.dest; Store.changed(); UI.toast('自動に戻しました'); }
    if (res) UI.refresh();
  },
};

Pages.register({ id: 'outcomes', no: 9, group: '年度末', title: '進路決定', render: v => OutcomesPage.render(v) });
