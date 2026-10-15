'use strict';
/* ============================================================
   進路希望調査（4月・Forms）：回答 CSV の取り込み → 集計 → 個人別一覧
   - Forms の様式は変えない。見出しの文言で列を見つける（列の順番・増減に強い）
   - 同じ番号の複数回答は、最新の1件だけ採用する
   - 名簿（生徒・成績）にいて回答がない生徒は「未回答」（集計では未定として数える）
   - 表示と印刷は同じ HTML（画面で見たとおりに印刷できる）
   ============================================================ */

/** 集計する項目の並び（ここにない回答は、末尾に足す＝Forms の選択肢が増えても消えない） */
const SURVEY_ORDER = {
  course: ['進学', '就職', '未定'],
  school: ['専門学校・各種学校', '大学', '短期大学', 'その他'],
  field: ['経済・経営・商学', '人文・心理', 'ビジネス', '情報', '教育', '看護', '福祉', '栄養', '芸術', '国際・外国語', '幼児・保育', '体育', '医療', '調理・製菓', '理美容', 'ファッション', 'その他'],
  jobMethod: ['学校斡旋', '自己開拓', '公務員', 'その他'],
  job: ['製造', '事務', '販売', '福祉・介護・看護', 'サービス', '未定', 'その他'],
  method: ['総合型選抜', '指定校推薦', '公募制推薦', '一般受験', '未定'],
  decided: ['はい', 'いいえ'],
};

const Survey = {
  /** Forms の見出し（空白を除き全角→半角にしたもの）→ 項目 */
  COLS: {
    id: [/^ID$/], done: [/完了時刻/], no: [/^番号/], gender: [/^性別/],
    course: [/希望する進路/],
    method: [/進学のみ.*方法/], field: [/進学のみ.*分野/], school: [/進学のみ.*(どの学校|学校への進学)/],
    decided: [/進学のみ.*(志望校は決定|志望校.*決定)/], destination: [/進学のみ.*(具体的|記入)/],
    jobMethod: [/就職のみ.*方法/], job: [/就職のみ.*職種/], worry: [/就職のみ.*(不安|悩)/],
    other: [/その他のみ/], reason: [/未定のみ/],
  },

  /* ---------- 回答の整形（旧「作成くん」の NORM シートと同じ区分） ---------- */
  normCourse(v) {
    const t = String(v ?? '');
    if (t.includes('就職')) return '就職';
    if (t.includes('進学')) return '進学';
    if (t.includes('未定')) return '未定';
    if (t.includes('その他')) return 'その他';
    return '（未記入）';
  },
  normMethod(v) {
    const t = String(v ?? '');
    if (t.includes('総合型')) return '総合型選抜';
    if (t.includes('指定校')) return '指定校推薦';
    if (t.includes('公募')) return '公募制推薦';
    if (t.includes('一般')) return '一般受験';
    if (t.includes('未定')) return '未定';
    return '';
  },
  normJobMethod(v) {
    const t = String(v ?? '');
    if (t.includes('公務員')) return '公務員';
    if (t.includes('学校斡旋')) return '学校斡旋';
    if (t.includes('自己開拓')) return '自己開拓';
    return t.trim() ? 'その他' : '';
  },
  /** 完了時刻 → 数値（並べ替え用）。形式：2026/4/14 8:32 ／ 2026/04/14 08:32:11 ／ 14/26/04 8:32:11（日/年/月）／ ISO */
  time(v) {
    const t = toHalf(String(v ?? '')).trim();
    let m = t.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    m = t.match(/^(\d{1,2})\/(\d{2})\/(\d{2}) (\d{1,2}):(\d{2})(?::(\d{2}))?/);   // 日/年(下2桁)/月
    if (m) return Date.UTC(2000 + +m[2], +m[3] - 1, +m[1], +m[4], +m[5], +(m[6] || 0));
    const d = Date.parse(t);
    return Number.isFinite(d) ? d : null;
  },

  /** rows（見出し行つき）→ { responses, rows, dup, skipped, info } */
  parse(rows) {
    const hi = Excel.findHeader(rows, [/希望する進路/]);
    if (hi < 0) throw new Error('進路希望調査の回答ではないようです（「希望する進路」の列が見つかりません）。');
    const raw = rows[hi];
    const h = raw.map(c => Excel.norm(c));
    const c = {};
    for (const [k, ps] of Object.entries(this.COLS)) c[k] = Excel.col(h, ps);
    if (c.no < 0) throw new Error('「番号」の列が見つかりません。');
    const used = new Set(Object.values(c).filter(v => v >= 0));
    const unknown = raw.map((x, i) => [x, i]).filter(([x, i]) => x != null && String(x).trim() && !used.has(i)).map(([x]) => String(x).replace(/\s+/g, ''));
    const get = (r, k) => (c[k] >= 0 && r[c[k]] != null) ? String(r[c[k]]).replace(/\r?\n/g, ' ').trim() : '';
    const body = rows.slice(hi + 1);
    const skipped = [], best = new Map();
    let n = 0;
    body.forEach((r, i) => {
      if (!r || !r.some(v => v != null && String(v).trim())) return;
      n++;
      const m = toHalf(get(r, 'no')).match(/\d{4}/);
      const no3 = m ? m[0] : '';
      if (!no3) { skipped.push({ row: hi + i + 2, reason: badStudentNo(get(r, 'no')) || '番号がありません' }); return; }
      const rec = {
        no3, gender: get(r, 'gender'), course: this.normCourse(get(r, 'course')),
        method: this.normMethod(get(r, 'method')), field: get(r, 'field'), school: get(r, 'school'), decided: get(r, 'decided'),
        destination: get(r, 'destination'), jobMethod: this.normJobMethod(get(r, 'jobMethod')), job: get(r, 'job'),
        worry: get(r, 'worry'), other: get(r, 'other'), reason: get(r, 'reason'),
        at: get(r, 'done'), _id: num(get(r, 'id')), _t: this.time(get(r, 'done')), _i: i, _count: 1,
      };
      const old = best.get(no3);
      if (!old) { best.set(no3, rec); return; }
      rec._count = old._count + 1;
      // 新しいほうを採用：ID → 完了時刻 → 行の順
      const newer = (rec._id != null && old._id != null) ? rec._id > old._id
        : (rec._t != null && old._t != null && rec._t !== old._t) ? rec._t > old._t : rec._i > old._i;
      best.set(no3, newer ? rec : Object.assign(old, { _count: rec._count }));
    });
    const responses = [...best.values()].sort((a, b) => a.no3.localeCompare(b.no3)).map(r => { const { _id, _t, _i, ...x } = r; return x; });
    const dup = responses.filter(r => r._count > 1).length;
    responses.forEach(r => { r.count = r._count; delete r._count; });
    const found = Object.entries(c).filter(([, v]) => v >= 0).length;
    return { responses, rows: n, dup, skipped, unknown, info: `回答 ${n} 件 → 生徒 ${responses.length} 人（複数回答の生徒 ${dup} 人は最新だけ採用）。認識した列 ${found} ／ ${Object.keys(this.COLS).length}` };
  },

  /* ---------- 人ごとの一覧（回答＋名簿の未回答者） ---------- */
  people(survey, students = Store.data.students) {
    const m = new Map();
    survey.responses.forEach(r => m.set(r.no3, Object.assign({}, r, { answered: true })));
    students.forEach(s => {
      if (!STUDENT_NO.test(s.no3) || m.has(s.no3)) return;
      m.set(s.no3, { no3: s.no3, gender: s.gender || '', course: '未定', answered: false, method: '', field: '', school: '', decided: '', destination: '', jobMethod: '', job: '' });
    });
    return [...m.values()].map(p => {
      const s = students.find(x => x.no3 === p.no3);
      if (s) { p.name = s.name || ''; if (!p.gender) p.gender = s.gender || ''; }
      p.cls = p.no3.charAt(1) + '組';
      return p;
    }).sort((a, b) => a.no3.localeCompare(b.no3));
  },
  classes(people) { return [...new Set(people.map(p => p.cls))].sort(); },

  /* ---------- 集計：1つの項目 × 組 × 男女 ---------- */
  sections(people, opts = {}) {
    const val = (p, k, empty) => (p[k] || '').trim() || empty;
    const defs = [
      { id: 'course', no: '①', title: '進路希望', label: '進路', pick: () => true, key: p => p.course, order: SURVEY_ORDER.course, who: '' },
      { id: 'school', no: '②', title: '学校種別', who: '進学者', pick: p => p.course === '進学', key: p => val(p, 'school', 'その他'), order: SURVEY_ORDER.school },
      { id: 'field', no: '③', title: '希望分野', who: '進学者', pick: p => p.course === '進学', key: p => val(p, 'field', 'その他'), order: SURVEY_ORDER.field },
      { id: 'jobMethod', no: '④', title: '就職方法', who: '就職者', pick: p => p.course === '就職', key: p => val(p, 'jobMethod', 'その他'), order: SURVEY_ORDER.jobMethod },
      { id: 'job', no: '⑤', title: '希望職種', who: '就職者・公務員除く', pick: p => p.course === '就職' && p.jobMethod !== '公務員', key: p => val(p, 'job', 'その他'), order: SURVEY_ORDER.job },
    ];
    if (opts.extra !== false) {
      defs.push(
        { id: 'method', no: '⑥', title: '進学の受験方法', who: '進学者', pick: p => p.course === '進学', key: p => p.method || '未定', order: SURVEY_ORDER.method },
        { id: 'decided', no: '⑦', title: '志望校の決定', who: '進学者', pick: p => p.course === '進学', key: p => p.decided || '（未記入）', order: SURVEY_ORDER.decided });
    }
    const classes = this.classes(people);
    return defs.map(d => {
      const items = people.filter(d.pick);
      const rows = d.order.map(label => ({ label, fixed: true }));
      items.forEach(p => { const k = d.key(p); if (!rows.some(r => r.label === k)) rows.push({ label: k, fixed: false }); });
      rows.forEach(r => {
        r.cells = {};
        classes.forEach(c => { r.cells[c] = { 男: 0, 女: 0 }; });
        r.all = { 男: 0, 女: 0, 計: 0 };
      });
      items.forEach(p => {
        const row = rows.find(r => r.label === d.key(p));
        const g = p.gender === '男' || p.gender === '女' ? p.gender : null;
        if (g) { row.cells[p.cls][g]++; row.all[g]++; }
        row.all.計++;
      });
      const shown = d.id === 'course' ? rows.filter(r => r.fixed || r.all.計 > 0) : rows.filter(r => r.fixed || r.all.計 > 0);
      const total = { cells: {}, all: { 男: 0, 女: 0, 計: 0 } };
      classes.forEach(c => { total.cells[c] = { 男: 0, 女: 0 }; });
      shown.forEach(r => { classes.forEach(c => { total.cells[c].男 += r.cells[c].男; total.cells[c].女 += r.cells[c].女; }); total.all.男 += r.all.男; total.all.女 += r.all.女; total.all.計 += r.all.計; });
      return { id: d.id, no: d.no, title: d.title, who: d.who, rows: shown, total, count: items.length, classes };
    });
  },

  /* ---------- 画面・印刷の HTML ---------- */
  hideZero() { return !!(Store.data.settings.reports || {}).hideZero; },
  z(n) { return (n === 0 && this.hideZero()) ? '' : n; },

  head(survey, people) {
    const ans = people.filter(p => p.answered).length;
    const male = people.filter(p => p.gender === '男').length, female = people.filter(p => p.gender === '女').length;
    const un = people.length - ans;
    return `<h2 class="sv-title">${esc(nendoLabel(survey.year))}　3年生　進路希望調査　集計</h2>
      <p class="sv-sub">（${esc(survey.label)}）　集計日 ${esc(survey.date || todayISO())}　／　全体 <b>${people.length}</b>名（男${male}・女${female}）　回答 <b>${ans}</b>名${un ? `　未回答 <b>${un}</b>名（未定として集計）` : ''}</p>`;
  },

  tableHtml(sec, o) {
    const cls = sec.classes, split = o.split !== false;
    const colsPer = split ? 2 : 1;
    const pct = o.pct ? (n, t) => (t ? (Math.round(n / t * 1000) / 10).toFixed(1) + '%' : '') : null;
    const g1 = `<tr><th rowspan="2" class="sv-lab">${esc(sec.no === '①' ? '区分' : '区分')}</th>${cls.map(c => `<th colspan="${colsPer}" class="sv-grp">${esc(c)}</th>`).join('')}<th colspan="${split ? 3 : 3}" class="sv-grp sv-all">全体</th>${pct ? '<th rowspan="2" class="sv-pct">割合</th>' : ''}</tr>`;
    const g2 = `<tr>${cls.map(() => split ? '<th class="sv-g first">男</th><th class="sv-g">女</th>' : '<th class="sv-g first">計</th>').join('')}<th class="sv-g first sv-all">男</th><th class="sv-g sv-all">女</th><th class="sv-g sv-all">計</th></tr>`;
    const cell = (v, first, extra = '') => `<td class="${first ? 'first ' : ''}${extra}">${this.z(v)}</td>`;
    const rowHtml = (r, cls0 = '') => `<tr class="${cls0}"><td class="sv-lab">${esc(r.label)}</td>${cls.map(c => split
      ? cell(r.cells[c].男, true) + cell(r.cells[c].女, false)
      : cell(r.cells[c].男 + r.cells[c].女, true)).join('')}${cell(r.all.男, true, 'sv-all')}${cell(r.all.女, false, 'sv-all')}${cell(r.all.計, false, 'sv-all sv-sum')}${pct ? `<td class="sv-pct">${pct(r.all.計, sec.total.all.計)}</td>` : ''}</tr>`;
    const body = sec.rows.map(r => rowHtml(r)).join('') + rowHtml({ label: '合計', cells: sec.total.cells, all: sec.total.all }, 'sv-total');
    return `<section class="sv-sec"><h3 class="sv-h"><span class="sv-no">${esc(sec.no)}</span> ${esc(sec.title)}${sec.who ? `<small>（${esc(sec.who)}）</small>` : ''}<span class="sv-cnt">計 ${sec.total.all.計}名</span></h3>
      <table class="sv-tbl"><thead>${g1}${g2}</thead><tbody>${body}</tbody></table></section>`;
  },

  summaryHtml(survey, o = {}) {
    const people = this.people(survey);
    const secs = this.sections(people, o);
    return `<div class="sv-doc">${this.head(survey, people)}${secs.map(s => this.tableHtml(s, o)).join('')}</div>`;
  },

  listHtml(survey, o = {}) {
    const people = this.people(survey);
    const cols = [['番号', p => p.no3, 'num'], ['氏名', p => p.name || '', 'nm'], ['性別', p => p.gender, 'c'], ['進路', p => p.answered ? p.course : '未回答', 'c b'],
      ['進学：受験方法', p => p.method, ''], ['分野', p => p.field, ''], ['学校種別', p => p.school, ''], ['志望校決定', p => p.decided, 'c'], ['志望先', p => p.destination, 'w'],
      ['就職：方法', p => p.jobMethod, 'c'], ['職種', p => p.job, '']];
    if (o.memo) cols.push(['悩み・理由・その他（取扱注意）', p => [p.worry, p.other, p.reason].filter(Boolean).join(' ／ '), 'w']);
    const byClass = new Map();
    people.forEach(p => { if (!byClass.has(p.cls)) byClass.set(p.cls, []); byClass.get(p.cls).push(p); });
    return [...byClass.entries()].map(([c, list]) => {
      const cnt = k => list.filter(p => p.course === k).length;
      return `<div class="p-page sv-doc sv-listpage"><h2 class="sv-title">${esc(nendoLabel(survey.year))}　3年生　進路希望調査　個人別一覧　<span class="sv-cls">${esc(c)}</span></h2>
        <p class="sv-sub">（${esc(survey.label)}）　${list.length}名　進学 ${cnt('進学')}・就職 ${cnt('就職')}・未定 ${cnt('未定')}　／　※取扱注意（個人情報）</p>
        <table class="sv-tbl sv-list"><thead><tr>${cols.map(([h]) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${list.map(p => `<tr data-no="${p.no3}" class="${p.answered ? '' : 'sv-un'} sv-c-${p.course === '就職' ? 'job' : p.course === '進学' ? 'edu' : 'x'}">${cols.map(([, f, k]) => `<td class="${k}">${esc(f(p))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }).join('');
  },

  /** 生徒・成績に反映する内容（進学／就職のはっきりした回答のみ） */
  plan(survey) {
    const people = this.people(survey).filter(p => p.answered);
    return people.map(p => {
      const s = Students.byNo(p.no3);
      const course = p.course === '進学' || p.course === '就職' ? p.course : '';
      return { p, s, course, isNew: !s };
    });
  },
  /** 1人の回答から、生徒・成績の進路希望に入れる内容（進学／就職のはっきりした回答のみ） */
  patch(p) {
    const o = {};
    if (!p || !p.answered) return o;
    const course = p.course === '進学' || p.course === '就職' ? p.course : '';
    if (course) o.course = course;
    if (course === '就職') {
      if (['学校斡旋', '自己開拓', '公務員'].includes(p.jobMethod)) o.method = p.jobMethod;
      if (p.job) o.hopeJob = p.job;
    }
    if (course === '進学' && p.destination) o.hope = p.destination;
    return o;
  },
  /** いちばん新しい調査 */
  latest() {
    return [...(Store.data.surveys || [])].sort((a, b) => String(a.date || a.label || '').localeCompare(String(b.date || b.label || ''))).pop() || null;
  },
  /** 最新の調査の回答を、生徒・成績の「空欄」に入れる（入力済みの欄は変えない）。画面を開くたびに呼ぶ */
  syncEmpty() {
    const sv = this.latest(); if (!sv || !Store.data) return 0;
    let n = 0;
    for (const p of this.people(sv).filter(x => x.answered)) {
      const s = Students.byNo(p.no3); if (!s) continue;
      for (const [k, v] of Object.entries(this.patch(p))) if (!String(s[k] || '').trim()) { s[k] = v; n++; }
    }
    if (n) Store.changed();
    return n;
  },
  applyToStudents(survey) {
    let added = 0, updated = 0;
    for (const x of this.plan(survey)) {
      let s = x.s;
      if (!s) { s = blankStudent(x.p.no3); Store.data.students.push(s); added++; } else updated++;
      if (x.p.gender && !s.gender) s.gender = x.p.gender;
      Object.assign(s, this.patch(x.p));
    }
    Store.changed();
    return { added, updated };
  },
};
