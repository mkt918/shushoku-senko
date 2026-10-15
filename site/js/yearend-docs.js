'use strict';
/* ============================================================
   年度末の資料の HTML（画面と印刷で同じ）と Excel 出力
   進路先一覧（就職先／専修各種／四大・短大）・指定校一覧・進路指導まとめ
   ============================================================ */

const YE = {
  zero() { return !!(Store.data.settings.reports || {}).hideZero; },
  num(n) { return n ? zen(String(n)) : (this.zero() ? '' : zen('0')); },
  nz(n) { return n ? String(n) : ''; },
  head(title, sub) { return `<h2 class="ye-title">${esc(title)}</h2>${sub ? `<p class="ye-sub">${sub}</p>` : ''}`; },
  yh(ys) { return ys.map((y, i) => `<th class="n${i === 0 ? ' cur' : ''}">${Yr.label(y)}</th>`).join(''); },
  yc(x, ys) {
    return ys.map((y, i) => {
      const n = x.cells[i], mk = x.r.marks && x.r.marks[y];
      const t = n ? n + (mk && mk !== '※' ? '' : mk || '') : (mk || '');
      return `<td class="n${i === 0 ? ' cur' : ''}${n ? '' : ' z'}">${esc(t)}</td>`;
    }).join('');
  },
  foot() { return '<p class="ye-note">※校名変更や学部・学科改変に伴い、記載内容に変更がある場合があります。最新の情報で確認してください。</p>'; },

  /* ---------- 学校斡旋就職先一覧 ---------- */
  workHtml() {
    const t = History.workTable(), o = History.opts(), FY = Store.data.year;
    const body = t.groups.map(g => `<section class="ye-sec"><h3>${esc(g.label)}</h3><table class="ye-tbl"><thead><tr><th class="nm">会社名</th>${this.yh(t.years)}<th class="n">${esc(t.olderLabel)}</th></tr></thead><tbody>
      ${g.rows.map(x => `<tr><td class="nm">${esc(x.r.name)}</td>${this.yc(x, t.years)}<td class="n${x.older ? '' : ' z'}">${this.nz(x.older)}</td></tr>`).join('')}</tbody></table></section>`).join('');
    return `<div class="ye-doc">${this.head('年度別学校斡旋就職先一覧表', `${esc(Yr.long(FY))}版　／　${o.dropEmpty ? `過去${o.workRecent}年入社のない会社は載せていません　／　` : ''}業種は前年と違うことがあります`)}
      <div class="ye-cols">${body || '<p class="sub">データがありません。［過去の実績］で R7 の一覧を取り込むか、［進路決定］を入力してください。</p>'}</div>
      <p class="ye-note">年度別の合計：${t.years.map((y, i) => `${Yr.label(y)} ${t.totals[i]}人`).join('　')}　／　${esc(t.olderLabel)} ${t.olderTotal}人</p></div>`;
  },

  /* ---------- 専修・各種学校の進学先一覧 ---------- */
  senshuHtml() {
    const t = History.senshuTable();
    const tbl = (rows, nameHead) => `<table class="ye-tbl"><thead><tr><th class="nm">${nameHead}</th>${this.yh(t.years)}</tr></thead><tbody>${rows.map(x => `<tr><td class="nm">${esc(x.r.name)}</td>${this.yc(x, t.years)}</tr>`).join('')}</tbody></table>`;
    return `<div class="ye-doc">${this.head('年度別専修・各種学校進学先一覧表', `${esc(Yr.long(Store.data.year))}版`)}
      <div class="ye-cols"><section class="ye-sec"><h3>１．指定校推薦</h3>${tbl(t.shitei, '学校名')}</section>
      <section class="ye-sec ye-sec-open"><h3>２．公募制推薦・総合型選抜・一般選抜</h3></section>
      ${t.groups.map((g, i) => `<section class="ye-sec"><h3 class="sub">（${zen(String(i + 1))}）${esc(g.name)}</h3>${tbl(g.rows, '学校名')}</section>`).join('')}</div>${this.foot()}</div>`;
  },

  /* ---------- 四大・短大の進学先一覧 ---------- */
  univHtml() {
    const t = History.univTable();
    const titles = { 'univ|shitei': ['１．四年制大学', '（１）学校推薦型選抜（指定校推薦）'], 'univ|open': [null, '（２）学校推薦型選抜（公募制推薦・一般推薦）'], 'junior|shitei': ['２．短期大学', '（１）学校推薦型選抜（指定校推薦）'], 'junior|open': [null, '（２）学校推薦型選抜（公募制推薦・一般推薦）'] };
    const body = t.parts.map(p => {
      const [h1, h2] = titles[`${p.level}|${p.sec}`]; const junior = p.level === 'junior';
      return `${h1 ? `<h3 class="ye-h1">${h1}</h3>` : ''}<section class="ye-sec"><h3>${h2}</h3><table class="ye-tbl"><thead><tr><th class="nm">${junior ? '短大名' : '大学名'}</th><th class="nm">学${junior ? '科' : '部'}</th><th class="nm">${junior ? '専攻・コース' : '学科'}</th>${this.yh(t.years)}</tr></thead><tbody>
        ${p.rows.map(x => `<tr><td class="nm">${x.showSchool ? esc(x.r.school) : ''}</td><td class="nm">${x.showFaculty ? esc(x.r.faculty) : ''}</td><td class="nm">${esc(x.r.dept)}</td>${this.yc(x, t.years)}</tr>`).join('')}
        <tr class="ye-sum"><td colspan="3" class="nm">合計</td>${p.totals.map((v, i) => `<td class="n${i === 0 ? ' cur' : ''}">${this.nz(v)}</td>`).join('')}</tr></tbody></table></section>`;
    }).join('');
    return `<div class="ye-doc">${this.head('年度別四大・短大進学先一覧表', `${esc(Yr.long(Store.data.year))}版　／　※は注記のある推薦（例：県立商業科校長会推薦）`)}${body}${this.foot()}</div>`;
  },

  /* ---------- 指定校一覧（進路の手引の原稿） ---------- */
  MASTER: {
    univ: { title: '指定校一覧（四大）', head: [['name', '大学名'], ['faculty', '学部'], ['dept', '学科（コース）'], ['quota', '推薦人数'], ['grade', '推薦評定基準'], ['crit', '推薦基準項目'], ['exam', '試験内容'], ['addr', '学校所在地']] },
    junior: { title: '指定校一覧（短大）', head: [['name', '短期大学名'], ['dept', '学科（コース）'], ['quota', '推薦人数'], ['grade', '推薦基準'], ['crit', '推薦基準項目'], ['exam', '試験内容'], ['addr', '学校所在地']] },
    senshu: { title: '指定校一覧（専修各種）', head: [['name', '専修・各種学校名'], ['quota', '推薦人数'], ['dept', '学科（コース）'], ['grade', '推薦基準'], ['crit', '推薦基準項目'], ['exam', '試験内容'], ['addr', '学校所在地']] },
  },
  masterHtml(kind) {
    const M = Store.data.history.master, def = this.MASTER[kind];
    if (!M || !M[kind].length) return '<p class="sub">指定校一覧が未登録です。［過去の実績］で「進路の手引 指定校一覧原稿」を取り込んでください。</p>';
    return `<div class="ye-doc ye-master">${this.head(`${Yr.long(M.year)}${def.title}`)}<table class="ye-tbl ye-mt"><thead><tr>${def.head.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead>
      <tbody>${M[kind].map(r => `<tr data-id="${r.id}">${def.head.map(([k]) => `<td class="${k === 'name' ? 'nm b' : 'tx'}">${esc(r[k] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  },

  /* ---------- 進路指導まとめ ---------- */
  fwd(iso) { const d = parseISO(iso); return d ? `${fmtWareki(iso)}現在` : ''; },
  matomeHtml(o = {}) {
    const FY = Store.data.year, st = Store.data.settings, sc = st.school, ye = st.yearend;
    const sm = Outcomes.summary(), prev = Store.data.history.summary[FY - 1];
    const act = o.simple;
    const fmt = (n, a) => (n || !this.zero() ? zen(String(n)) : '') + (act && a ? `(${zen(String(a))})` : '');
    const asOf = ye.asOf || todayISO();
    const depts = [...new Map(st.departments.map(d => [d.name, d])).keys()];
    // 表1・昨年度
    const nums = Outcomes.summaryNumbers();
    const actN = { jobSchool: sm.active.jobSchool, jobOther: sm.active.jobOther, jobPublic: sm.active.jobPublic, univ: sm.active.univ, junior: sm.active.junior, senshu: sm.active.senshu, college: sm.active.college + sm.active.nurse, eduOther: sm.active.eduOther, other: sm.active.other };
    const t1 = (n, a, label) => {
      const job = n.jobSchool + n.jobOther + n.jobPublic, edu = n.univ + n.junior + n.senshu + n.college + n.eduOther, tot = job + edu + n.other;
      const ja = a ? a.jobSchool + a.jobOther + a.jobPublic : 0, ea = a ? a.univ + a.junior + a.senshu + a.college + a.eduOther : 0, ta = a ? ja + ea + a.other : 0;
      const c = k => `<td>${fmt(n[k], a && a[k])}</td>`;
      return `<table class="mt-tbl"><thead><tr><th colspan="3">就職者 (${zen(String(job))})</th><th colspan="5">進学者 (${zen(String(edu))})</th><th rowspan="2">その他</th><th rowspan="2">合計</th></tr>
        <tr><th>学校斡旋</th><th>斡旋外</th><th>公務</th><th>大学</th><th>短期大学</th><th>専門学校</th><th>大学校・准看護</th><th>その他</th></tr></thead>
        <tbody><tr>${['jobSchool', 'jobOther', 'jobPublic', 'univ', 'junior', 'senshu', 'college', 'eduOther', 'other'].map(c).join('')}<td>${fmt(tot, ta)}</td></tr></tbody></table>`;
    };
    // 表3 学科別
    const rows3 = [['就職', '学校斡旋', ['jobSchool']], ['就職', '斡旋外', ['jobOther']], ['就職', '公務', ['jobPublic']], ['進学', '大学', ['univ']], ['進学', '短期大学', ['junior']], ['進学', '専門学校', ['senshu']], ['進学', '大学校', ['college']], ['進学', '准看護', ['nurse']], ...(sm.all.eduOther ? [['進学', 'その他', ['eduOther']]] : []), ['その他', '', ['other']]];
    const dv = (d, g, ks) => ks.reduce((t, k) => t + (((sm.byDept[d] || {})[g] || {})[k] || 0), 0);
    const av = (d, g, ks) => 0;
    const t3 = `<table class="mt-tbl"><thead><tr><th colspan="2">種 別</th>${depts.map(d => `<th colspan="2">${esc(d)}</th>`).join('')}<th rowspan="2">合計</th></tr><tr><th colspan="2"></th>${depts.map(() => '<th>男</th><th>女</th>').join('')}</tr></thead><tbody>
      ${rows3.map(([a, b, ks]) => { const tot = ks.reduce((t, k) => t + sm.all[k], 0); const ac = ks.reduce((t, k) => t + sm.active[k], 0); return `<tr><td class="l">${a}</td><td class="l">${b}</td>${depts.map(d => `<td>${fmt(dv(d, '男', ks), 0)}</td><td>${fmt(dv(d, '女', ks), 0)}</td>`).join('')}<td>${fmt(tot, ac)}</td></tr>`; }).join('')}
      <tr class="mt-sum"><td class="l" colspan="2">合 計</td>${depts.map(d => `<td>${fmt(OC_KEYS.reduce((t, k) => t + dv(d, '男', [k]), 0), 0)}</td><td>${fmt(OC_KEYS.reduce((t, k) => t + dv(d, '女', [k]), 0), 0)}</td>`).join('')}<td>${fmt(sm.total, sm.activeTotal)}</td></tr></tbody></table>`;
    // 表4 職種内訳
    const jobs = Outcomes.list().filter(x => x.d.type === '就職' && x.d.status === '決定');
    const occCnt = (letter, d, g) => jobs.filter(x => (x.d.occ || '') === letter && (d ? x.dept === d : true) && (g ? x.gender === g : true)).length;
    const occKeys = [...OC.OCC_FIXED, ...Object.keys(OC.OCC_SHORT).filter(k => !OC.OCC_FIXED.includes(k) && jobs.some(x => x.d.occ === k))];
    const noOcc = jobs.filter(x => !x.d.occ).length;
    const t4 = `<table class="mt-tbl"><thead><tr><th>日本標準職業分類</th>${depts.map(d => `<th colspan="2">${esc(d)}</th>`).join('')}<th rowspan="2">合計</th></tr><tr><th></th>${depts.map(() => '<th>男</th><th>女</th>').join('')}</tr></thead><tbody>
      ${occKeys.map(k => `<tr><td class="l">${esc(OC.OCC_SHORT[k])}</td>${depts.map(d => `<td>${this.num(occCnt(k, d, '男'))}</td><td>${this.num(occCnt(k, d, '女'))}</td>`).join('')}<td>${this.num(occCnt(k))}</td></tr>`).join('')}
      ${noOcc ? `<tr><td class="l">（職業分類が未入力）</td>${depts.map(d => `<td>${this.num(jobs.filter(x => !x.d.occ && x.dept === d && x.gender === '男').length)}</td><td>${this.num(jobs.filter(x => !x.d.occ && x.dept === d && x.gender === '女').length)}</td>`).join('')}<td>${this.num(noOcc)}</td></tr>` : ''}
      <tr class="mt-sum"><td class="l">合 計</td>${depts.map(d => `<td>${this.num(jobs.filter(x => x.dept === d && x.gender === '男').length)}</td><td>${this.num(jobs.filter(x => x.dept === d && x.gender === '女').length)}</td>`).join('')}<td>${this.num(jobs.length)}</td></tr></tbody></table>`;
    // 表5 求人票数
    const trend = History.jobsTrend(act ? 11 : 9);
    const t5 = `<table class="mt-tbl"><thead><tr><th>年度</th>${trend.map(x => `<th>${Yr.label(x.y)}</th>`).join('')}</tr></thead><tbody><tr><td>求人数</td>${trend.map(x => `<td>${x.v ? x.v.toLocaleString('ja-JP') : ''}</td>`).join('')}</tr></tbody></table>`;
    // 表6 受験方法
    const exams = [['指定校推薦', '指定校推薦'], ['公募制推薦', '公募推薦'], ['総合型選抜', '総合型'], ['一般選抜', '一般']];
    const lv = [['大学', ['univ']], ['短期大学', ['junior']], ['専門学校', ['senshu']], ['大学校・准看護', ['college', 'nurse']], ['その他', ['eduOther']]];
    const ec = (ks, e) => ks.reduce((t, k) => t + (((sm.exam[k] || {})[e]) || 0), 0);
    const t6 = `<table class="mt-tbl"><thead><tr><th>種別</th>${exams.map(([, l]) => `<th>${l}</th>`).join('')}<th>合計</th></tr></thead><tbody>
      ${lv.map(([l, ks]) => `<tr><td class="l">${l}</td>${exams.map(([e]) => `<td>${this.num(ec(ks, e))}</td>`).join('')}<td>${this.num(ks.reduce((t, k) => t + sm.all[k], 0))}</td></tr>`).join('')}
      <tr class="mt-sum"><td class="l">合計</td>${exams.map(([e]) => `<td>${this.num(lv.reduce((t, [, ks]) => t + ec(ks, e), 0))}</td>`).join('')}<td>${this.num(lv.reduce((t, [, ks]) => t + ks.reduce((u, k) => u + sm.all[k], 0), 0))}</td></tr></tbody></table>`;
    // 就職先・進学先
    const list = Outcomes.list().filter(x => x.d.type && x.d.status === '決定');
    const byInd = new Map();
    list.filter(x => x.d.type === '就職' && x.d.jobKind === '学校斡旋' && x.d.company).forEach(x => { const k = x.d.ind || ''; const m = byInd.get(k) || new Map(); m.set(x.d.company, (m.get(x.d.company) || 0) + 1); byInd.set(k, m); });
    const workList = [...byInd.entries()].sort((a, b) => (a[0] || '~').localeCompare(b[0] || '~')).map(([k, m]) => `<p class="mt-grp"><b>【${esc(OC.IND_NAMES[k] || '業種未設定')}】</b><br>${esc([...m.entries()].sort((a, b) => b[1] - a[1] || History.collate(a[0], b[0])).map(([n]) => n).join('、'))}</p>`).join('');
    const sch = (lvs) => [...new Set(list.filter(x => x.d.type === '進学' && lvs.includes(x.d.level) && x.d.school).map(x => x.d.school))];
    const eduList = [['大学・短期大学', sch(['univ', 'junior'])], ['専門学校', sch(['senshu'])], ['大学校', sch(['college', 'nurse'])], ['その他', sch(['eduOther'])]].filter(([, a]) => a.length)
      .map(([l, a]) => `<p class="mt-grp"><b>【${l}】</b><br>${esc(a.join('、'))}</p>`).join('');
    // 学科別資料
    const byDept = depts.map(d => {
      const w = list.filter(x => x.dept === d && x.d.type === '就職'), e = list.filter(x => x.dept === d && x.d.type === '進学');
      return `<h4 class="mt-h4">【${esc(d)}】</h4><table class="mt-tbl mt-list"><tbody>${w.map(x => `<tr><td class="k">就 職</td><td class="l">${esc(x.d.companyFull || x.d.company || '（会社名未入力）')}</td><td class="l">${esc(x.d.jobTitle || '')}</td></tr>`).join('')}
        ${e.map(x => `<tr><td class="k">進 学</td><td class="l">${esc(x.d.school || '')}${x.d.faculty ? '　' + esc(x.d.faculty) : ''}${x.d.dept ? '　' + esc(x.d.dept) : ''}</td><td class="l">${esc(x.d.exam || '')}</td></tr>`).join('')}</tbody></table>`;
    }).join('');
    const dateTxt = `${fmtWareki(asOf)}現在`;
    const notes = String(ye.notes || '').trim();
    return `<div class="mt-doc">
      <p class="mt-r">${esc(dateTxt)}</p>
      <h1 class="mt-title">${esc(zen(Yr.long(FY)))}　進路指導まとめ${act ? '（簡易版）' : ''}</h1>
      <p class="mt-r">${esc(sc.name)}　${esc(sc.dept || '進路指導部')}</p>
      <h3 class="mt-h">１　${act ? '卒業予定者全体' : '卒業者全体'}</h3>${act ? '<p class="mt-small">※ ( )の数値は、全体の数値のうち、現在就職・進学活動中の生徒を表しています。</p>' : ''}
      ${t1(nums, actN)}
      ${prev ? `<p class="mt-cap">〔昨年度資料〕</p>${t1(prev, null)}` : ''}
      <h3 class="mt-h">２　学科別進路状況</h3>${t3}
      ${act ? '' : `<h3 class="mt-h">３　就職者の職種内訳</h3>${t4}`}
      <h3 class="mt-h">${act ? '３' : '４'}　求人票数の推移</h3>${act ? '<p class="mt-small">（データは12月末日現在のものです。）</p>' : ''}${t5}
      ${act ? `<h3 class="mt-h">今年度の特徴</h3><div class="mt-notes">${notes ? esc(notes).replace(/\n/g, '<br>') : '<span class="sub">［年度末の資料］の「今年度の特徴」に入力すると、ここに出ます。</span>'}</div>` : `
      <h3 class="mt-h">５　進学者の受験方法内訳</h3>${t6}
      <h3 class="mt-h">６　学校斡旋就職者の就職先〔産業分類別　順不同〕</h3>${workList || '<p class="sub">就職先がまだありません。</p>'}
      <h3 class="mt-h">７　進学先〔校種別　順不同〕</h3>${eduList || '<p class="sub">進学先がまだありません。</p>'}
      <h3 class="mt-h">８　学科別資料〔順不同〕</h3>${byDept}`}</div>`;
  },

  /* ---------- Excel 出力 ---------- */
  excel(kind) {
    const FY = Store.data.year, R = n => (n ? n : '');
    if (kind === 'work') {
      const t = History.workTable(), rows = [['業種', '会社名', ...t.years.map(Yr.label), t.olderLabel]];
      t.groups.forEach(g => g.rows.forEach(x => rows.push([g.label, x.r.name, ...x.cells.map(R), R(x.older)])));
      Excel.download(`年度別学校斡旋就職先一覧_${Yr.label(FY)}.xlsx`, [{ name: '就職', rows, widths: [26, 30, ...t.years.map(() => 6), 9] }]);
    } else if (kind === 'senshu') {
      const t = History.senshuTable(), rows = [['区分', '分野', '学校名', ...t.years.map(Yr.label)]];
      t.shitei.forEach(x => rows.push(['指定校推薦', '', x.r.name, ...x.cells.map(R)]));
      t.groups.forEach(g => g.rows.forEach(x => rows.push(['公募制推薦・総合型選抜・一般選抜', g.name, x.r.name, ...x.cells.map(R)])));
      Excel.download(`年度別専修各種進学先一覧_${Yr.label(FY)}.xlsx`, [{ name: '専修各種', rows, widths: [28, 18, 34, ...t.years.map(() => 6)] }]);
    } else if (kind === 'univ') {
      const t = History.univTable(), rows = [['校種', '区分', '学校名', '学部・学科', '学科・専攻', ...t.years.map(Yr.label)]];
      t.parts.forEach(p => p.rows.forEach(x => rows.push([p.level === 'univ' ? '四年制大学' : '短期大学', p.sec === 'shitei' ? '指定校推薦' : '公募制推薦・一般推薦', x.r.school, x.r.faculty, x.r.dept, ...x.cells.map(R)])));
      Excel.download(`年度別四大短大進学先一覧_${Yr.label(FY)}.xlsx`, [{ name: '大学短大', rows, widths: [10, 18, 22, 18, 22, ...t.years.map(() => 6)] }]);
    } else {
      const M = Store.data.history.master, def = this.MASTER[kind];
      Excel.download(`${Yr.long(M.year)}${def.title}.xlsx`, [{ name: def.title.slice(0, 20), rows: [def.head.map(h => h[1]), ...M[kind].map(r => def.head.map(([k]) => r[k] || ''))], widths: def.head.map(([k]) => k === 'name' ? 28 : k === 'addr' || k === 'exam' || k === 'crit' ? 30 : 16) }]);
    }
  },
};
const OC_KEYS = Outcomes.KEYS;
