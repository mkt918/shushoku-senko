'use strict';
/* ============================================================
   進路決定（生徒ごとの進路先）と、年度末の表（今年度の列＋過去の実績）
   - 就職（学校斡旋）は、内定した求人から自動で入る。進学・斡旋外・公務などは入力
   - 年度末の表の「今年度の列」は、ここから自動で数える。過去の列は History（実績）
   ============================================================ */

const OC = {
  LEVELS: [['univ', '四年制大学'], ['junior', '短期大学'], ['senshu', '専門学校・各種学校'], ['college', '大学校'], ['nurse', '准看護学校'], ['eduOther', 'その他の進学']],
  EXAMS: ['指定校推薦', '公募制推薦', '総合型選抜', '一般選抜'],
  JOBKINDS: ['学校斡旋', '斡旋外', '公務'],
  STATUS: ['決定', '活動中'],
  // 業種の見出し（R7 の一覧表と同じ名称）
  IND_NAMES: { A: '農業・林業', B: '漁業', C: '鉱業、採石業、砂利採取業', D: '建設業', E: '製造業', F: '電気・ガス・熱供給・水道業', G: '情報通信業', H: '運輸業', I: '卸売業、小売業', J: '金融業、保険業', K: '不動産業、物品賃貸業', L: '学術研究、専門・技術サービス業', M: '宿泊業、飲食サービス業', N: '生活関連サービス業、娯楽業', O: '教育、学習支援業', P: '医療、福祉', Q: '複合サービス事業', R: 'サービス業（他に分類されないもの）', S: '公務', T: '分類不能の産業' },
  // 進路指導まとめ「就職者の職種内訳」の行（厚労省の職業分類）
  OCC_SHORT: { A: '管理的職業', B: '研究・技術', C: '法務・経営・文化芸術等', D: '医療・看護・保健', E: '保育・教育', F: '事務', G: '販売・営業', H: '福祉・介護', I: 'サービス', J: '警備・保安', K: '農林漁業', L: '製造・修理・塗装・製図等', M: '配送・輸送・機械運転', N: '建設・土木・電気工事', O: '運搬・清掃・包装・選別' },
  OCC_FIXED: ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'O'],
  fw(ch) { return ch ? String.fromCharCode(ch.charCodeAt(0) + 0xFEE0) : ''; },
  indLabel(l) { return l ? `${this.fw(l)}${this.IND_NAMES[l] || ''}` : 'その他（業種未設定）'; },
  levelName(k) { return (this.LEVELS.find(x => x[0] === k) || [])[1] || ''; },
};

const Outcomes = {
  jobKindFromMethod(m) { return m === '自己開拓' || m === '縁故' ? '斡旋外' : m === '公務員' ? '公務' : '学校斡旋'; },

  /** 生徒の進路先（入力した内容＋内定からの自動）。status：決定／活動中 */
  of(s) {
    const d = Object.assign({ type: '', status: '' }, s.dest || {});
    const a = Apps.current(s.id);
    const job = a && a.result === '内定' ? Apps.job(a) : null;
    if (!d.type) {
      if (job) { d.type = '就職'; d.jobKind = '学校斡旋'; d.status = '決定'; d.auto = true; }
      else if (s.course === '就職') { d.type = '就職'; d.jobKind = this.jobKindFromMethod(s.method); d.status = '活動中'; d.auto = true; }
      else if (s.course === '進学') { d.type = '進学'; d.status = '活動中'; d.auto = true; }
    }
    if (d.type === '就職' && d.jobKind === '学校斡旋' && job) {
      const ind = Derive.industry(job.industryCode), occ = Derive.occupation(job.occupationCode);
      d.company = d.company || shortCompany(job.shortName || job.company);
      d.companyFull = d.companyFull || job.company;
      d.ind = d.ind || (ind ? ind.letter : '');
      d.occ = d.occ || (occ ? occ.mhlw : '');
      d.jobTitle = d.jobTitle || job.jobTitle || '';
      d.status = d.status || '決定';
    }
    if (d.type && !d.status) d.status = '決定';
    return d;
  },
  list() {
    return Store.data.students.filter(s => STUDENT_NO.test(s.no3)).sort((a, b) => a.no3.localeCompare(b.no3)).map(s => {
      const dp = Students.dept(s);
      return { s, d: this.of(s), dept: dp ? dp.name : '（学科不明）', gender: s.gender === '男' || s.gender === '女' ? s.gender : '' };
    });
  },
  /** 1人が「決定」している進路先を持つか */
  hasData() { return this.list().some(x => x.d.type && x.d.status === '決定'); },

  /* ---------- まとめの集計（表1・表3・表6） ---------- */
  KEYS: ['jobSchool', 'jobOther', 'jobPublic', 'univ', 'junior', 'senshu', 'college', 'nurse', 'eduOther', 'other'],
  keyOf(d) {
    if (d.type === '就職') return { 学校斡旋: 'jobSchool', 斡旋外: 'jobOther', 公務: 'jobPublic' }[d.jobKind] || 'jobSchool';
    if (d.type === '進学') return d.level || 'eduOther';
    if (d.type === 'その他') return 'other';
    return null;
  },
  summary(list = this.list()) {
    const zero = () => Object.fromEntries(this.KEYS.map(k => [k, 0]));
    const out = { all: zero(), active: zero(), total: 0, activeTotal: 0, byDept: {}, blank: 0, exam: {} };
    list.forEach(x => {
      const k = this.keyOf(x.d);
      if (!k) { out.blank++; return; }
      out.all[k]++; out.total++;
      const act = x.d.status === '活動中';
      if (act) { out.active[k]++; out.activeTotal++; }
      const bd = (out.byDept[x.dept] = out.byDept[x.dept] || { 男: zero(), 女: zero(), 他: zero() });
      bd[x.gender || '他'][k]++;
      if (x.d.type === '進学' && x.d.exam) { const e = (out.exam[k] = out.exam[k] || {}); e[x.d.exam] = (e[x.d.exam] || 0) + 1; }
    });
    return out;
  },
  /** 履歴に残す数字（大学校と准看護は合算：進路指導まとめの表1と同じ） */
  summaryNumbers(list) {
    const s = this.summary(list).all;
    return { jobSchool: s.jobSchool, jobOther: s.jobOther, jobPublic: s.jobPublic, univ: s.univ, junior: s.junior, senshu: s.senshu, college: s.college + s.nurse, eduOther: s.eduOther, other: s.other };
  },

  /* ---------- 年度末の表の「今年度の列」を作る元（決定した人だけ） ---------- */
  currentCounts(kind) {
    const m = new Map();
    const add = (key, proto) => { const e = m.get(key) || { proto, n: 0 }; e.n++; m.set(key, e); };
    const H = Store.data.history;
    this.list().forEach(({ d }) => {
      if (!d.type || d.status !== '決定') return;
      if (kind === 'work' && d.type === '就職' && d.jobKind === '学校斡旋' && d.company) {
        const r = { name: d.company, ind: d.ind || '' };
        add(History.keyOf('work', r), r);
      } else if (kind === 'senshu' && d.type === '進学' && ['senshu', 'college', 'nurse'].includes(d.level) && d.school) {
        const sec = d.exam === '指定校推薦' ? 'shitei' : 'open';
        let field = sec === 'open' ? (d.field || '') : '';
        if (sec === 'open' && !field) {
          const fs = [...new Set(H.senshu.filter(r => r.sec === 'open' && schoolKey(r.name) === schoolKey(d.school)).map(r => r.field))];
          if (fs.length === 1) field = fs[0];
        }
        const r = { sec, field, fieldNo: 99, name: d.school };
        add(History.keyOf('senshu', r), r);
      } else if (kind === 'univ' && d.type === '進学' && ['univ', 'junior'].includes(d.level) && d.school) {
        const r = { level: d.level, sec: d.exam === '指定校推薦' ? 'shitei' : 'open', school: d.school, faculty: d.faculty || '', dept: d.dept || '' };
        add(History.keyOf('univ', r), r);
      }
    });
    return m;
  },
};

/* ============================================================
   History の続き：今年度を足した行、表の組み立て、年度更新での引き継ぎ
   ============================================================ */
const facKey = s => nameKey(s).replace(/(学部|学科|コース|専攻)$/, '');
Object.assign(History, {
  keyOf(kind, r) {
    if (kind === 'work') return `${r.ind || ''}|${nameKey(r.name)}`;
    if (kind === 'senshu') return `${r.sec}|${r.sec === 'open' ? r.field || '' : ''}|${schoolKey(r.name)}`;
    return `${r.level}|${r.sec}|${schoolKey(r.school)}|${facKey(r.faculty)}|${facKey(r.dept)}`;
  },

  /** 保存済みの実績 ＋ 今年度（進路決定から自動）。進路決定が空なら、保存済みの実績のまま */
  merged(kind) {
    const H = Store.data.history, FY = Store.data.year;
    const rows = H[kind].map(r => clone(r));
    if (!Outcomes.hasData()) return rows;
    const idx = new Map();
    rows.forEach(r => { delete r.counts[FY]; idx.set(this.keyOf(kind, r), r); });
    Outcomes.currentCounts(kind).forEach(({ proto, n }, key) => {
      let r = idx.get(key);
      if (!r) { r = Object.assign({ id: uid(), counts: {}, marks: {}, isNew: true }, proto); rows.push(r); idx.set(key, r); }
      r.counts[FY] = n;
    });
    return this.place(kind, rows);
  },
  /** 並び順（ord）。元の表の順を保ち、新しい行は同じグループの中で名前の近い位置に入れる */
  place(kind, rows) {
    const grp = r => kind === 'work' ? r.ind || '' : kind === 'senshu' ? `${r.sec}|${r.sec === 'open' ? r.field || '' : ''}` : `${r.level}|${r.sec}`;
    const label = r => kind === 'univ' ? r.school : r.name;
    const have = rows.filter(r => r.ord != null).sort((a, b) => a.ord - b.ord);
    rows.filter(r => r.ord == null).forEach(r => {
      const peers = have.filter(x => grp(x) === grp(r));
      const next = peers.find(x => this.collate(nameKey(label(x)), nameKey(label(r))) > 0);
      r.ord = next ? next.ord - 0.5 : (peers.length ? peers[peers.length - 1].ord + 0.5 : (have.length ? have[have.length - 1].ord + 1 : 0));
      have.push(r); have.sort((a, b) => a.ord - b.ord);
    });
    return rows;
  },
  cnt(r, y) { return r.counts[y] || 0; },
  sumYears(r, ys) { return ys.reduce((t, y) => t + this.cnt(r, y), 0); },
  collate: (a, b) => String(a).localeCompare(String(b), 'ja'),
  yearsBack(n) { const FY = Store.data.year; return Array.from({ length: n }, (_, i) => FY - i); },
  opts() { return Object.assign({ workRecent: 5, senshuYears: 7, univYears: 8, dropEmpty: true }, Store.data.settings.yearend || {}); },

  /** 学校斡旋の就職先一覧：最近の N 年＋それ以前 */
  workTable() {
    const o = this.opts(), ys = this.yearsBack(o.workRecent), older = ys[ys.length - 1] - 1;
    const rows = this.merged('work').map(r => ({ r, cells: ys.map(y => this.cnt(r, y)), older: Object.entries(r.counts).filter(([y]) => +y <= older).reduce((t, [, v]) => t + v, 0) }))
      .filter(x => !o.dropEmpty || x.cells.some(v => v));
    const groups = {};
    rows.forEach(x => { (groups[x.r.ind || ''] = groups[x.r.ind || ''] || []).push(x); });
    const order = Object.keys(groups).sort((a, b) => (a || '~').localeCompare(b || '~'));
    return {
      years: ys, olderLabel: `${Yr.label(older)}以前`,
      groups: order.map(k => ({ ind: k, label: OC.indLabel(k), rows: groups[k].sort((a, b) => a.r.ord - b.r.ord) })),
      totals: ys.map((y, i) => rows.reduce((t, x) => t + x.cells[i], 0)), olderTotal: rows.reduce((t, x) => t + x.older, 0), count: rows.length,
    };
  },

  /** 専修・各種学校の進学先：指定校推薦／公募制推薦・総合型選抜・一般選抜（分野ごと） */
  senshuTable() {
    const o = this.opts(), ys = this.yearsBack(o.senshuYears);
    const rows = this.merged('senshu').map(r => ({ r, cells: ys.map(y => this.cnt(r, y)) })).filter(x => !o.dropEmpty || x.cells.some(v => v));
    const shitei = rows.filter(x => x.r.sec === 'shitei').sort((a, b) => a.r.ord - b.r.ord);
    const fields = new Map();
    rows.filter(x => x.r.sec === 'open').forEach(x => { const k = x.r.field || 'その他'; if (!fields.has(k)) fields.set(k, { name: k, no: x.r.fieldNo || 99, rows: [] }); fields.get(k).rows.push(x); });
    const groups = [...fields.values()].sort((a, b) => a.no - b.no).map(g => Object.assign(g, { rows: g.rows.sort((a, b) => a.r.ord - b.r.ord) }));
    const tot = list => ys.map((y, i) => list.reduce((t, x) => t + x.cells[i], 0));
    return { years: ys, shitei, groups, totals: { shitei: tot(shitei), open: tot(groups.flatMap(g => g.rows)) }, count: rows.length };
  },

  /** 四大・短大の進学先：校種 × （指定校推薦／公募制推薦ほか） */
  univTable() {
    const o = this.opts(), ys = this.yearsBack(o.univYears);
    const rows = this.merged('univ').map(r => ({ r, cells: ys.map(y => this.cnt(r, y)) })).filter(x => !o.dropEmpty || x.cells.some(v => v));
    const mk = (level, sec) => {
      const list = rows.filter(x => x.r.level === level && x.r.sec === sec)
        .sort((a, b) => a.r.ord - b.r.ord);
      let prevS = null, prevF = null;
      list.forEach(x => { x.showSchool = x.r.school !== prevS; x.showFaculty = x.showSchool || x.r.faculty !== prevF; prevS = x.r.school; prevF = x.r.faculty; });
      return { level, sec, rows: list, totals: ys.map((y, i) => list.reduce((t, x) => t + x.cells[i], 0)) };
    };
    return { years: ys, parts: [mk('univ', 'shitei'), mk('univ', 'open'), mk('junior', 'shitei'), mk('junior', 'open')], count: rows.length };
  },

  /** 求人票数の推移（過去は実績、今年度は求人票の件数から自動） */
  jobsTrend(n = 11) {
    const FY = Store.data.year, H = Store.data.history.jobs;
    const cur = Store.data.jobs.filter(j => (j.kind || '一般') === '一般').length;
    return Array.from({ length: n }, (_, i) => FY - n + 1 + i).map(y => ({ y, v: y === FY ? (cur || H[y] || 0) : (H[y] || 0), auto: y === FY && cur > 0 }));
  },

  /** 年度更新で次の年度に渡す実績：今年度の分を足す */
  committed() {
    const H = clone(Store.data.history), FY = Store.data.year;
    if (Outcomes.hasData()) {
      for (const k of ['work', 'senshu', 'univ']) H[k] = this.merged(k).sort((a, b) => a.ord - b.ord).map((r, i) => { const { isNew, ...x } = r; x.ord = i; return x; });
      H.summary[FY] = Outcomes.summaryNumbers();
    }
    H.jobs[FY] = this.jobsTrend(1)[0].v;
    return H;
  },
});
