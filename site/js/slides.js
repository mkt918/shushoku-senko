'use strict';
/* ============================================================
   保護者向け進路説明会のスライド（10枚）
   進路決定（今年度）と過去の実績（年度末の資料）から自動で組み立てる。
   - 文面は「文面を直す」で変えられる（settings.yearend.slides に保存。空欄なら既定の文）
   - 画面：縮小表示の一覧／全画面で発表（← → Space Esc・動きつき）／印刷・PDF（16:9）
   - 1枚は 1280×720px の固定サイズ。画面では transform で縮める
   ============================================================ */

const Slides = {
  H: 720,
  /** 縦横比：16:9（1280×720）／4:3（960×720）。設定 settings.yearend.slideRatio */
  ratio() { return (Store.data.settings.yearend || {}).slideRatio === '4:3' ? '4:3' : '16:9'; },
  get W() { return this.ratio() === '4:3' ? 960 : 1280; },

  /** 直せる文の既定。複数行は「見出し｜内容」を1行ずつ */
  DEF: {
    year: [
      '4月｜進路希望調査・面談。進路の方向を決める',
      '5〜6月｜進学：オープンキャンパス、出願の準備　就職：求人票の確認、職場見学の申込',
      '7月｜就職：求人票の受付開始（校内に公開）　進学：指定校推薦の校内選考',
      '8月｜職場見学・オープンキャンパス・面接練習',
      '9月｜就職：応募書類の提出・採用試験　進学：推薦・総合型選抜の出願',
      '10〜12月｜内定・合格の発表。決まらない人は2次応募や一般選抜へ',
      '1〜3月｜一般選抜・進路決定の報告・卒業',
    ].join('\n'),
    summary: [
      '一人ひとりの希望と適性をふまえて、進路を一緒に考えます',
      '就職は、求人票・職場見学・校内選考で、学校が応募を支援します',
      '進学は、指定校推薦・公募推薦・総合型選抜・一般選抜に対応します',
      '早めの情報収集と、周りの人への相談が、納得できる進路につながります',
    ].join('\n'),
  },
  NOTES: {
    year: '行事の時期は年度により変わります。詳しくは学校からの配付資料でお知らせします。',
  },

  /** 利用者が直した文面（settings.yearend.slides） */
  ov() { return (Store.data.settings.yearend || {}).slides || {}; },
  text(key) { const v = this.ov()[key]; return v != null && String(v).trim() ? String(v) : this.DEF[key]; },
  /** 「見出し｜内容」の行 → [[見出し, 内容], …] */
  rows(text) {
    return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const i = l.search(/[｜|]/); return i < 0 ? ['', l] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
  },

  /** 数字を出せる年度の一覧：今年度（進路決定が入っていれば）＋ 実績にある過去の年度 */
  sources() {
    const FY = Store.data.year, H = Store.data.history;
    const ys = Object.keys(H.summary).map(Number).filter(y => y < FY && this.total(H.summary[y]) > 0);
    if (Outcomes.hasData()) ys.push(FY);
    return ys.sort((a, b) => b - a);
  },
  total(n) { return n ? Object.values(n).reduce((t, v) => t + (v || 0), 0) : 0; },
  nums(y) { return y === Store.data.year ? Outcomes.summaryNumbers() : Store.data.history.summary[y] || null; },
  grp(n) {
    const job = n.jobSchool + n.jobOther + n.jobPublic, edu = n.univ + n.junior + n.senshu + n.college + n.eduOther;
    return { job, edu, other: n.other, total: job + edu + n.other };
  },
  pct(a, t) { return t ? Math.round(a / t * 100) : 0; },

  /* ---------- 部品 ---------- */
  PAL: ['#1f5f8b', '#2e7d4f', '#e08a1e', '#8a8576', '#7b5ea7', '#c0504d'],
  hbars(rows, unit = '人') {
    const max = Math.max(1, ...rows.map(r => r.v));
    return `<div class="sl-bars">${rows.map(r => `<div class="sl-br"><span class="sl-bl">${esc(r.l)}</span><span class="sl-bt"><i style="width:${(r.v / max * 100).toFixed(1)}%"></i></span><b>${r.v}${unit}</b></div>`).join('')}</div>`;
  },
  tile(label, v, sub, cls, unit = '人') { return `<div class="sl-tile ${cls || ''}"><div class="sl-tl">${esc(label)}</div><div class="sl-tv">${v}<small>${unit}</small></div><div class="sl-ts">${sub || ''}</div></div>`; },
  /** 円グラフの色の区切り（conic-gradient） */
  stops(items) {
    const t = items.reduce((a, x) => a + x.v, 0);
    let acc = 0;
    return items.map((x, i) => { const a0 = acc / t * 360; acc += x.v; return `${x.c || this.PAL[i]} ${a0.toFixed(1)}deg ${(acc / t * 360).toFixed(1)}deg`; }).join(',');
  },
  ring(items, size) {
    const t = items.reduce((a, x) => a + x.v, 0);
    return `<div class="sl-donut-w${size ? ' ' + size : ''}"><div class="sl-donut" style="background:conic-gradient(${this.stops(items)})"></div><div class="sl-dc"><b>${t}</b><small>人</small></div></div>`;
  },
  /** 円グラフ＋凡例。items: [{l, v, c}] */
  donut(items, size) {
    const t = items.reduce((a, x) => a + x.v, 0);
    if (!t) return '';
    return `<div class="sl-chart${size ? ' sl-chart-' + size : ''}">${this.ring(items)}
      <ul class="sl-leg">${items.map((x, i) => `<li><i style="background:${x.c || this.PAL[i]}"></i><span>${esc(x.l)}</span><b>${x.v}人</b><em>${this.pct(x.v, t)}％</em></li>`).join('')}</ul></div>`;
  },
  chips(list, max, pins) {
    const shown = list.slice(0, max);
    return `<div class="sl-chips">${shown.map(t => `<span${pins && pins.has(t) ? ' class="pin"' : ''}>${esc(t)}</span>`).join('')}${list.length > max ? `<span class="more">ほか ${list.length - max}</span>` : ''}</div>`;
  },
  /** 7枚目・9枚目で「優先して大きく出す」を選べる候補（その年度の就職先・進学先の名前） */
  cands(y) {
    const cnt = r => History.cnt(r, y), ordBy = (a, b) => (a.ord ?? 0) - (b.ord ?? 0);
    const u = (arr) => [...new Set(arr)];
    return {
      firms: u(History.merged('work').filter(cnt).sort(ordBy).map(r => r.name)),
      schools: u([...History.merged('univ').filter(cnt).sort(ordBy).map(r => r.school), ...History.merged('senshu').filter(cnt).sort(ordBy).map(r => r.name)]),
    };
  },
  /** 優先する名前を先頭に（元の並びは保つ） */
  pinFirst(list, pins) { return list.filter(x => pins.has(x)).concat(list.filter(x => !pins.has(x))); },
  empty(msg) { return `<p class="sl-empty">${esc(msg)}</p>`; },
  /** 見出し＋説明の行 */
  rowList(text) { const rs = this.rows(text); return `<div class="sl-ex${rs.length > 5 ? ' tight' : ''}">${rs.map(([a, b]) => `<div class="sl-exr">${a ? `<b>${esc(a)}</b>` : ''}<span>${esc(b)}</span></div>`).join('')}</div>`; },

  /* ---------- スライドの中身 ----------
     raw=true：直した文面・非表示を反映せず、全スライドの既定の題を返す（編集画面用） */
  build(y, raw, keepHidden) {
    const FY = Store.data.year, H = Store.data.history, sc = Store.data.settings.school;
    const isNow = y === FY, n = y ? this.nums(y) : null;
    if (!n || !this.total(n)) return [];
    const g = this.grp(n), yl = Yr.long(y);
    const ov = raw ? {} : this.ov(), T = (id, d) => (ov.titles && ov.titles[id]) || d;
    const out = [];
    const cnt = r => History.cnt(r, y);
    const add = (id, title, body, pp, dark) => out.push({ id, title: T(id, title), def: title, body, pp, dark: !!dark });
    const jobCount = isNow ? History.jobsTrend(1)[0].v : H.jobs[y] || 0;
    const P = this.PAL;

    // 1 表紙
    const cv2 = raw || !(ov.cover2 || '').trim() ? (isNow ? `${yl}卒業予定者の進路状況` : `${yl}卒業生の進路実績`) + 'と、進路指導のあらまし' : ov.cover2;
    const cv3 = `${sc.name || ''}${sc.dept ? '　' + sc.dept : ''}`;
    out.push({
      id: 'cover', cover: true, def: `${Yr.long(FY)}　進路説明会`, title: raw ? `${Yr.long(FY)}　進路説明会` : this.coverTitle(FY), lines: [cv2, cv3],
      body: `<p class="sl-c2">${esc(cv2)}</p><p class="sl-c3">${esc(cv3)}</p>`,
    });

    // 2 全体：卒業者・就職者・進学者・求人票を、まとめて言える
    const actN = isNow ? Outcomes.summary().activeTotal : 0;
    const tiles = [
      { label: isNow ? '卒業予定者' : '卒業者', value: g.total, unit: '人', sub: actN ? `うち活動中 ${actN}人` : '', cls: 'c-all', c: '#1b4a6b', soft: '#e8edf2' },
      { label: '就職者', value: g.job, unit: '人', sub: `${this.pct(g.job, g.total)}％`, cls: 'c-job', c: P[0], soft: '#e6eff6' },
      { label: '進学者', value: g.edu, unit: '人', sub: `${this.pct(g.edu, g.total)}％`, cls: 'c-edu', c: P[1], soft: '#e5f2ea' },
      { label: '求人票', value: jobCount, unit: '枚', sub: jobCount ? `${Yr.label(y)}年度に届いた数` : '未入力', cls: 'c-req', c: P[2], soft: '#fbf1dc' },
    ];
    const split = [{ l: '就職', v: g.job, c: P[0] }, { l: '進学', v: g.edu, c: P[1] }, { l: 'その他', v: g.other, c: P[3] }].filter(x => x.v);
    add('total', isNow ? `今年度の進路状況（${fmtWareki(todayISO())}現在）` : `${yl}卒業生の進路状況`,
      `<div class="sl-total-w"><div class="sl-tiles sl-t4">${tiles.map(t => this.tile(t.label, t.value.toLocaleString('ja-JP'), t.sub, t.cls, t.unit)).join('')}</div>${this.donut(split, 'col')}</div>`,
      { t: 'stack', w: [1, 2.3], parts: [{ t: 'tiles', items: tiles }, { t: 'donut', items: split }] });

    // 3 3年生の1年間（文面を直せる）
    add('year', '3年生の1年間の進路スケジュール', `${this.rowList(this.text('year'))}<p class="sl-note">${esc(this.NOTES.year)}</p>`,
      { t: 'stack', w: [6, 0.6], parts: [{ t: 'rows', items: this.rows(this.text('year')) }, { t: 'note', text: this.NOTES.year }] });

    // 4 就職の内訳
    const jk = [{ l: '学校斡旋', v: n.jobSchool, c: P[0] }, { l: '斡旋外（自己開拓・縁故など）', v: n.jobOther, c: P[2] }, { l: '公務', v: n.jobPublic, c: P[4] }].filter(x => x.v);
    add('jobMix', `就職の内訳（${g.job}人）`,
      jk.length ? `${this.donut(jk, 'xl')}<p class="sl-note">学校斡旋：学校に届いた求人票で応募し、校内選考を経て受験する方法です。</p>` : this.empty('就職者がまだ入力されていません。'),
      jk.length ? { t: 'stack', w: [6, 0.6], parts: [{ t: 'donut', items: jk }, { t: 'note', text: '学校斡旋：学校に届いた求人票で応募し、校内選考を経て受験する方法です。' }] } : { t: 'note', text: '就職者がまだ入力されていません。' });

    // 5 就職先の業種
    const work = History.merged('work').filter(r => cnt(r));
    const byInd = new Map();
    work.forEach(r => byInd.set(r.ind || '', (byInd.get(r.ind || '') || 0) + cnt(r)));
    const indRows = [...byInd.entries()].map(([k, v]) => ({ l: (OC.IND_NAMES[k] || 'その他').replace(/、/g, '・'), v })).sort((a, b) => b.v - a.v);
    add('ind', `学校斡旋で就職した人の業種（${work.reduce((t, r) => t + cnt(r), 0)}人）`,
      indRows.length ? this.hbars(indRows.slice(0, 9)) : this.empty('就職先（学校斡旋）の決定がまだ入力されていません。'),
      indRows.length ? { t: 'bars', items: indRows.slice(0, 9), fmt: '0"人"' } : { t: 'note', text: '就職先（学校斡旋）の決定がまだ入力されていません。' });

    // 6 求人票数の推移
    const trend = Array.from({ length: 9 }, (_, i) => y - 8 + i).map(v => ({ y: v, v: v === FY ? History.jobsTrend(1)[0].v : H.jobs[v] || 0 }));
    const tmax = Math.max(1, ...trend.map(t => t.v));
    add('jobs', '本校に届いた求人票の数',
      trend.some(t => t.v) ? `<div class="sl-cols">${trend.map(t => `<div class="sl-col"><b>${t.v ? t.v.toLocaleString('ja-JP') : '－'}</b><i style="height:${Math.round(t.v / tmax * 280)}px"></i><span>${Yr.label(t.y)}</span></div>`).join('')}</div><p class="sl-note">求人票は区分「一般」の枚数です。</p>` : this.empty('求人票数がまだ入力されていません。'),
      trend.some(t => t.v) ? { t: 'stack', w: [6, 0.5], parts: [{ t: 'colchart', items: trend.map(t => ({ l: Yr.label(t.y), v: t.v })), fmt: '#,##0' }, { t: 'note', text: '求人票は区分「一般」の枚数です。' }] } : { t: 'note', text: '求人票数がまだ入力されていません。' });

    // 7 主な就職先（産業分類別）：本校のアピールポイント。企業名を大きく見せる。優先する企業（pin）は先頭・強調で、かならず出す
    const pinF = new Set((ov.pin && ov.pin.firms) || []);
    const grp = new Map();
    [...work].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).forEach(r => { const k = r.ind || ''; (grp.get(k) || grp.set(k, []).get(k)).push(r.name); });
    const groups = [...grp.entries()].map(([k, names]) => ({ k, names: this.pinFirst(names, pinF), pins: names.filter(x => pinF.has(x)).length }))
      .sort((a, b) => b.pins - a.pins || b.names.length - a.names.length || (a.k || '~').localeCompare(b.k || '~'))
      .map(x => ({ h: (OC.IND_NAMES[x.k] || 'その他').replace(/、/g, '・'), names: x.names, pins: x.pins }));
    const r43 = this.ratio() === '4:3', gMax = r43 ? 8 : 10;
    const gShown = groups.slice(0, gMax);
    const nFirms = new Set(work.map(r => r.name)).size, nShown = gShown.reduce((t, x) => t + x.names.length, 0);
    const fLv = nShown <= 8 ? 1 : nShown <= 14 ? 2 : nShown <= 24 ? 3 : 4;              // 1＝いちばん大きい
    const fCap = [8, 14, 24, 34][fLv - 1] - (r43 ? 6 : 0);
    const fPer = nShown <= fCap ? 99 : Math.max(2, Math.floor(fCap / Math.max(1, gShown.length)));
    gShown.forEach(x => { x.per = Math.max(fPer, x.pins); });
    const firmLead = `学校斡旋で就職した企業`;
    add('firms', '主な就職先（産業分類別・順不同）',
      gShown.length ? `<div class="sl-lead">${firmLead}　<b>${nFirms}</b>社</div><div class="sl-groups sl-lv${fLv}">${gShown.map(x => `<div class="sl-g"><h4>${esc(x.h)}　<small>${x.names.length}社</small></h4>${this.chips(x.names, x.per, pinF)}</div>`).join('')}</div>${groups.length > gMax ? `<p class="sl-note">ほか ${groups.length - gMax} 分類</p>` : ''}` : this.empty('就職先がまだ入力されていません。'),
      gShown.length ? { t: 'stack', w: [0.7, 6], parts: [{ t: 'lead', text: firmLead, num: nFirms, unit: '社' }, { t: 'groups', lvl: fLv, items: gShown.map(x => ({ h: `${x.h}（${x.names.length}社）`, names: x.names.slice(0, x.per).concat(x.names.length > x.per ? [`ほか${x.names.length - x.per}`] : []) })) }] } : { t: 'note', text: '就職先がまだ入力されていません。' });

    // 8 進学の内訳（校種・受験方法）
    const lv = [{ l: '四年制大学', v: n.univ, c: P[0] }, { l: '短期大学', v: n.junior, c: P[1] }, { l: '専門学校', v: n.senshu, c: P[2] }, { l: '大学校・准看護', v: n.college, c: P[4] }, { l: 'その他', v: n.eduOther, c: P[3] }].filter(x => x.v);
    const ex = isNow ? Outcomes.summary().exam : null;
    const exTotal = m => ex ? Object.values(ex).reduce((t, e) => t + (e[m] || 0), 0) : 0;
    const exRows = ['指定校推薦', '公募制推薦', '総合型選抜', '一般選抜'].map(m => ({ l: m, v: exTotal(m) }));
    const hasEx = exRows.some(x => x.v);
    const Mst = H.master, mc = k => Mst && Mst[k] ? new Set(Mst[k].map(r => r.name)).size : 0;
    const mNote = Mst && (mc('univ') + mc('junior') + mc('senshu')) ? `本校への指定校推薦の依頼：四年制大学 ${mc('univ')}校・短期大学 ${mc('junior')}校・専修各種学校 ${mc('senshu')}校（${Yr.long(Mst.year)}）` : '';
    add('eduMix', `進学の内訳（${g.edu}人）`,
      lv.length ? `<div class="sl-two"><div><h3>進学先の種類</h3>${this.donut(lv)}</div>${hasEx ? `<div><h3>受験方法</h3>${this.hbars(exRows)}</div>` : ''}</div>${mNote ? `<p class="sl-note">${esc(mNote)}</p>` : ''}` : this.empty('進学者がまだ入力されていません。'),
      lv.length ? { t: 'stack', w: [6, 0.5], parts: [{ t: 'cols', parts: [{ t: 'donut', items: lv, title: '進学先の種類' }].concat(hasEx ? [{ t: 'bars', items: exRows, fmt: '0"人"', title: '受験方法' }] : []) }, { t: 'note', text: mNote }] } : { t: 'note', text: '進学者がまだ入力されていません。' });

    // 9 主な進学先：大学を大きく見せる。優先する学校（pin）は先頭・強調で、かならず出す
    const pinS = new Set((ov.pin && ov.pin.schools) || []);
    const univ = History.merged('univ').filter(r => cnt(r)), senshu = History.merged('senshu').filter(r => cnt(r));
    const ordBy = (a, b) => (a.ord ?? 0) - (b.ord ?? 0);
    const uni = this.pinFirst([...new Set(univ.filter(r => r.level !== 'junior').sort(ordBy).map(r => r.school))], pinS);
    const jun = this.pinFirst([...new Set(univ.filter(r => r.level === 'junior').sort(ordBy).map(r => r.school))], pinS);
    const sen = this.pinFirst([...new Set(senshu.sort(ordBy).map(r => r.name))], pinS);
    const uLv = uni.length <= 10 ? 1 : uni.length <= 18 ? 2 : uni.length <= 30 ? 3 : 4, uCap = ([10, 18, 30, 40][uLv - 1]) - (r43 ? 6 : 0);
    const uMax = Math.max(uCap, uni.filter(x => pinS.has(x)).length);
    const jMax = Math.max(10, jun.filter(x => pinS.has(x)).length), sMax = Math.max(12, sen.filter(x => pinS.has(x)).length);
    const more = (list, max) => list.slice(0, max).concat(list.length > max ? [`ほか${list.length - max}`] : []);
    add('eduSchools', '主な進学先（順不同）',
      `<div class="sl-edu"><div class="sl-edu-big sl-lv${uLv}"><h3>大学　<b>${n.univ}</b><small>人</small></h3>${uni.length ? this.chips(uni, uMax, pinS) : this.empty('入力待ちです')}</div>
          <div class="sl-edu-side"><h4>短期大学　<small>${n.junior}人</small></h4>${jun.length ? this.chips(jun, jMax, pinS) : '<p class="sl-dim">－</p>'}
            <h4>専門学校・大学校ほか　<small>${n.senshu + n.college + n.eduOther}人</small></h4>${sen.length ? this.chips(sen, sMax, pinS) : '<p class="sl-dim">－</p>'}</div></div>`,
      { t: 'cols', w: [2.2, 1], parts: [{ t: 'names', title: `大学（${n.univ}人）`, items: more(uni, uMax), size: [26, 22, 18, 15][uLv - 1], hd: 22 },
        { t: 'stack', parts: [{ t: 'names', title: `短期大学（${n.junior}人）`, items: more(jun, jMax), size: 14 }, { t: 'names', title: `専門学校・大学校ほか（${n.senshu + n.college + n.eduOther}人）`, items: more(sen, sMax), size: 14 }] }] });

    // 10 総まとめ（保護者・中学校の先生・生徒のどれにも使える）。白ベースに、数字・円グラフ・考え方のカード
    const pts = [];
    if (g.job) pts.push(`就職の ${this.pct(n.jobSchool, g.job)}％が学校斡旋`);
    if (indRows.length) pts.push(`就職先は「${indRows[0].l}」が最多`);
    if (lv.length) { const top = lv.slice().sort((a, b) => b.v - a.v)[0]; pts.push(`進学は「${top.l}」が最多`); }
    const msgs = this.rows(this.text('summary')).map(([a, b]) => a ? a + '　' + b : b);
    const stat4 = [
      { label: '就職者', value: g.job, unit: '人', sub: `${this.pct(g.job, g.total)}％` },
      { label: '進学者', value: g.edu, unit: '人', sub: `${this.pct(g.edu, g.total)}％` },
      { label: '就職先の企業', value: nFirms, unit: '社', sub: '学校斡旋' },
      { label: '求人票', value: jobCount, unit: '枚', sub: '本校に届いた数' },
    ];
    add('summary', '進路状況のまとめ',
      `<div class="sl-sum"><div class="sl-sum-top">
          <div class="sl-sum-ring">${this.ring(split.map((x, i) => Object.assign({}, x, { c: [P[0], P[1], P[3]][i] })))}<div class="sl-rleg">${split.map(x => `<span>${esc(x.l)} ${this.pct(x.v, g.total)}％</span>`).join('')}</div></div>
          <div class="sl-st4">${stat4.map(c => `<div><em>${esc(c.label)}</em><span class="sl-sv"><b class="sl-cnt">${c.value.toLocaleString('ja-JP')}</b><small>${c.unit}</small></span><u>${esc(c.sub)}</u></div>`).join('')}</div></div>
        ${pts.length ? `<div class="sl-pills">${pts.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="sl-msgs">${msgs.map((t, i) => `<div class="sl-m"><i>${String(i + 1).padStart(2, '0')}</i><p>${esc(t)}</p></div>`).join('')}</div></div>`,
      { t: 'stack', w: [2.3, 0.45, 1.6], parts: [
        { t: 'cols', w: [1, 1.7], parts: [{ t: 'donut', items: split }, { t: 'tiles', items: stat4.map((c, i) => Object.assign({}, c, { c: [P[0], P[1], P[2], '#1b4a6b'][i], soft: ['#e6eff6', '#e5f2ea', '#fbf1dc', '#e8edf2'][i] })) }] },
        { t: 'line', text: pts.join('　◆　') },
        { t: 'cols', parts: msgs.map((t, i) => ({ t: 'card', no: String(i + 1).padStart(2, '0'), text: t })) }] });

    if (raw) return out;
    // 非表示の枚を除き、ひとこと（補足）をつける
    const list = out.map(s => {
      const memo = ov.memo && String(ov.memo[s.id] || '').trim();
      return Object.assign(s, { hidden: !!(ov.hide && ov.hide[s.id]) }, memo ? { memo, body: s.body + `<div class="sl-memo">${esc(memo).replace(/\n/g, '<br>')}</div>` } : {});
    });
    return keepHidden ? list : list.filter(s => !s.hidden);
  },
  coverTitle(FY) { const t = String(this.ov().coverTitle || '').trim(); return t || `${Yr.long(FY)}　進路説明会`; },

  /** スライド1枚分の HTML */
  slide(s, i, n) {
    const sc = Store.data.settings.school;
    const r43 = this.ratio() === '4:3' ? ' sl-43' : '';
    if (s.cover) return `<div class="sl sl-cover${r43}"><h1>${esc(s.title)}</h1>${s.body}</div>`;
    return `<div class="sl${r43}${s.dark ? ' sl-dark' : ''}"><div class="sl-h"><h2>${esc(s.title)}</h2></div><div class="sl-b">${s.body}</div><div class="sl-f"><span>${esc(sc.name || '')}</span><span>${i + 1} / ${n}</span></div></div>`;
  },
  all(y) { const ss = this.build(y); return ss.map((s, i) => this.slide(s, i, ss.length)); },

  /* ---------- 全画面で発表（動きつき。実体は slidesPlayer） ---------- */
  ANIM: '.sl-h h2, .sl-cover h1, .sl-c2, .sl-c3, .sl-tile, .sl-total, .sl-lead, .sl-br, .sl-exr, .sl-flow li, .sl-ask li, .sl-donut, .sl-dc, .sl-leg li, .sl-rleg span, .sl-st4 > div, .sl-pills span, .sl-m, .sl-edu h3, .sl-edu h4, .sl-g, .sl-chips span, .sl-col, .sl-two h3, .sl-pts li, .sl-note, .sl-memo, .sl-empty',
  present(htmls, start = 0) {
    if (!htmls.length) return;
    const ov = document.createElement('div');
    ov.id = 'slideShow';
    document.body.appendChild(ov);
    const fs = () => { if (!document.fullscreenElement) close(); };
    const player = slidesPlayer({ host: ov, htmls, W: this.W, H: this.H, ANIM: this.ANIM, start, onClose: () => close(), hint: '← → で移動　Esc で終了' });
    function close() {
      document.removeEventListener('fullscreenchange', fs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      player.destroy(); ov.remove();
    }
    try { ov.requestFullscreen().then(() => document.addEventListener('fullscreenchange', fs)).catch(() => {}); } catch (e) { /* 全画面にできなくても、重ね表示で発表できる */ }
  },

  /* ---------- PowerPoint（.pptx）：文字・図形・グラフはすべて PowerPoint で直せる ---------- */
  async pptx(y, title) {
    if (!window.PptxGenJS) throw new Error('PowerPoint 用の部品（lib/pptxgen.bundle.js）が読み込まれていません');
    const ss = this.build(y);
    if (!ss.length) return;
    const sc = Store.data.settings.school, is43 = this.ratio() === '4:3';
    const W = is43 ? 10 : 13.333, FONT = 'Yu Gothic', GAP = 0.3, hx = c => String(c).replace('#', ''), FS = is43 ? 16 : 18;
    const pg = new window.PptxGenJS();
    pg.layout = is43 ? 'LAYOUT_4x3' : 'LAYOUT_WIDE';
    pg.title = title;
    const cur = { ink: '23262B', hd: '1B4A6B' };
    const txt = (sl, runs, r, o) => sl.addText(runs, Object.assign({ x: r.x, y: r.y, w: r.w, h: r.h, fontFace: FONT, fontSize: FS, color: cur.ink, valign: 'top', margin: 0.05, paraSpaceAfter: 6 }, o || {}));
    const head = (t, sz) => ({ text: t, options: { bold: true, color: cur.hd, fontSize: sz || FS + 2, breakLine: true } });
    const chartBase = r => ({ x: r.x, y: r.y, w: r.w, h: r.h, fontFace: FONT, showLegend: false });
    const place = (sl, p, r) => {
      if (p.t === 'stack' || p.t === 'cols') {
        const parts = p.parts.filter(q => !(q.t === 'note' && !q.text));
        const ws = p.w || parts.map(() => 1), tot = ws.reduce((a, b) => a + b, 0), vert = p.t === 'stack';
        const room = (vert ? r.h : r.w) - GAP * (parts.length - 1);
        let pos = vert ? r.y : r.x;
        parts.forEach((q, i) => {
          const len = room * ws[i] / tot;
          place(sl, q, vert ? { x: r.x, y: pos, w: r.w, h: len } : { x: pos, y: r.y, w: len, h: r.h });
          pos += len + GAP;
        });
      } else if (p.t === 'tiles') {
        const k = p.items.length, w = (r.w - 0.25 * (k - 1)) / k;
        p.items.forEach((it, i) => {
          const x = r.x + i * (w + 0.25), c = hx(it.c);
          sl.addShape('rect', { x, y: r.y, w, h: r.h, fill: { color: hx(it.soft) }, line: { color: hx(it.soft) } });
          if (p.cardTop !== false) sl.addShape('rect', { x, y: r.y, w, h: 0.08, fill: { color: c }, line: { color: c } });
          txt(sl, it.label, { x: x + 0.12, y: r.y + 0.12, w: w - 0.24, h: 0.4 }, { fontSize: p.cardTop === false ? 14 : 16, bold: true, color: p.cardTop === false ? 'FFFFFF' : c });
          const vs = String(it.value.toLocaleString('ja-JP')), big = Math.max(20, Math.min(is43 ? 34 : 44, Math.floor((w - 0.3) * 72 / (vs.length * 0.6 + 1.2))));
          txt(sl, [{ text: vs, options: { fontSize: big, bold: true, color: c } }, { text: it.unit, options: { fontSize: 16, color: c } }], { x: x + 0.12, y: r.y + (p.cardTop === false ? 0.45 : 0.55), w: w - 0.24, h: 0.9 }, { valign: 'middle' });
          if (it.sub) txt(sl, it.sub, { x: x + 0.12, y: r.y + (p.cardTop === false ? 1.3 : 1.45), w: w - 0.24, h: Math.max(0.3, r.h - 1.5) }, { fontSize: 12, color: p.cardTop === false ? 'C9D3DC' : '4A4E55' });
        });
      } else if (p.t === 'donut') {
        sl.addChart(pg.charts.DOUGHNUT, [{ name: '人数', labels: p.items.map(x => `${x.l} ${x.v}人`), values: p.items.map(x => x.v) }],
          Object.assign(chartBase(r), { holeSize: 52, chartColors: p.items.map(x => hx(x.c)), showLegend: true, legendPos: 'r', legendFontSize: 16, legendFontFace: FONT, legendColor: cur.ink, showPercent: true, showValue: false, showLabel: false, dataLabelColor: 'FFFFFF', dataLabelFontSize: 14, dataLabelFontBold: true, showTitle: !!p.title, title: p.title || '', titleFontSize: 18, titleFontFace: FONT, titleColor: '1B4A6B' }));
      } else if (p.t === 'bars') {
        sl.addChart(pg.charts.BAR, [{ name: '人数', labels: p.items.map(x => x.l), values: p.items.map(x => x.v) }],
          Object.assign(chartBase(r), { barDir: 'bar', catAxisOrientation: 'maxMin', chartColors: ['1F5F8B'], showValue: true, dataLabelFontSize: 14, dataLabelFormatCode: p.fmt || '0', dataLabelPosition: 'outEnd', catAxisLabelFontSize: 14, catAxisLabelFontFace: FONT, valAxisHidden: true, valGridLine: { style: 'none' }, barGapWidthPct: 40, showTitle: !!p.title, title: p.title || '', titleFontSize: 18, titleFontFace: FONT, titleColor: '1B4A6B' }));
      } else if (p.t === 'colchart') {
        sl.addChart(pg.charts.BAR, [{ name: '数', labels: p.items.map(x => x.l), values: p.items.map(x => x.v) }],
          Object.assign(chartBase(r), { barDir: 'col', chartColors: ['1F5F8B'], showValue: true, dataLabelFontSize: 14, dataLabelFormatCode: p.fmt || '0', dataLabelPosition: 'outEnd', catAxisLabelFontSize: 14, catAxisLabelFontFace: FONT, valAxisHidden: true, valGridLine: { style: 'none' }, barGapWidthPct: 40 }));
      } else if (p.t === 'rows') {
        const runs = p.title ? [head(p.title)] : [];
        p.items.forEach(([a, b]) => { if (a) runs.push({ text: a, options: { bold: true, color: '1B4A6B' } }, { text: '　' + b, options: { breakLine: true } }); else runs.push({ text: b, options: { breakLine: true } }); });
        txt(sl, runs, r);
      } else if (p.t === 'bullets') {
        const runs = p.title ? [head(p.title)] : [];
        p.items.forEach(t => runs.push({ text: t, options: { bullet: true, breakLine: true } }));
        txt(sl, runs, r);
      } else if (p.t === 'names') {
        txt(sl, [head(p.title, p.hd), { text: p.items.join('、'), options: { breakLine: true, fontSize: p.size || FS - 2 } }], r, { paraSpaceAfter: 8 });
      } else if (p.t === 'groups') {
        const half = Math.ceil(p.items.length / 2), w = (r.w - GAP) / 2;
        [p.items.slice(0, half), p.items.slice(half)].forEach((list, i) => {
          const runs = [];
          const nz = ([26, 22, 18, 14][(p.lvl || 3) - 1]) - (is43 ? 2 : 0);
          list.forEach(x => runs.push({ text: x.h, options: { bold: true, color: '1B4A6B', fontSize: nz - 3, breakLine: true } }, { text: x.names.join('、'), options: { bold: true, fontSize: nz, breakLine: true } }));
          txt(sl, runs, { x: r.x + i * (w + GAP), y: r.y, w, h: r.h }, { paraSpaceAfter: 8 });
        });
      } else if (p.t === 'lead') {
        txt(sl, [{ text: p.text + '　', options: { fontSize: FS + 2 } }, { text: String(p.num), options: { fontSize: 40, bold: true, color: 'E08A1E' } }, { text: p.unit, options: { fontSize: FS + 2 } }], r, { valign: 'middle' });
      } else if (p.t === 'line') {
        txt(sl, p.text, r, { fontSize: FS - 2, color: 'C06A10', align: 'center', valign: 'middle', bold: true });
      } else if (p.t === 'card') {
        sl.addShape('rect', { x: r.x, y: r.y, w: r.w, h: r.h, fill: { color: 'F1F5F8' }, line: { color: 'D3DDE6' } });
        txt(sl, p.no, { x: r.x + 0.1, y: r.y + 0.05, w: r.w - 0.2, h: 0.6 }, { fontSize: 28, bold: true, color: 'E08A1E' });
        txt(sl, p.text, { x: r.x + 0.1, y: r.y + 0.65, w: r.w - 0.2, h: r.h - 0.7 }, { fontSize: FS - 3, color: '23262B' });
      } else if (p.t === 'note') {
        txt(sl, p.text, r, { fontSize: 12, color: '6A6E75' });
      }
    };
    ss.forEach((s, i) => {
      const sl = pg.addSlide();
      cur.ink = '23262B'; cur.hd = '1B4A6B';
      if (s.cover) {
        sl.background = { color: '1F5F8B' };
        txt(sl, s.title, { x: 0.9, y: 1.7, w: W - 1.8, h: 1.2 }, { fontSize: is43 ? 38 : 48, bold: true, color: 'FFFFFF', valign: 'middle' });
        txt(sl, s.lines[0], { x: 0.9, y: 3.3, w: W - 1.8, h: 0.7 }, { fontSize: 24, color: 'E6EFF6' });
        sl.addShape('line', { x: 0.9, y: 5.4, w: W - 1.8, h: 0, line: { color: 'FFFFFF', width: 1.5 } });
        txt(sl, s.lines[1], { x: 0.9, y: 5.5, w: W - 1.8, h: 0.5 }, { fontSize: 18, color: 'E6EFF6' });
        return;
      }
      cur.ink = s.dark ? 'FFFFFF' : '23262B'; cur.hd = s.dark ? 'FFC65A' : '1B4A6B';
      if (s.dark) sl.background = { color: '12304A' };
      txt(sl, s.title, { x: 0.55, y: 0.3, w: W - 1.1, h: 0.85 }, { fontSize: is43 ? 26 : 30, bold: true, color: s.dark ? 'FFFFFF' : '1B4A6B', valign: 'middle' });
      sl.addShape('rect', { x: 0.55, y: 1.18, w: W - 1.1, h: 0.05, fill: { color: s.dark ? 'E08A1E' : '1F5F8B' }, line: { color: s.dark ? 'E08A1E' : '1F5F8B' } });
      const memo = s.memo ? 0.6 : 0;
      place(sl, s.pp, { x: 0.55, y: 1.45, w: W - 1.1, h: 5.2 - memo });
      if (s.memo) {
        sl.addShape('rect', { x: 0.55, y: 6.05, w: W - 1.1, h: 0.55, fill: { color: 'FFF4D6' }, line: { color: 'FFF4D6' } });
        txt(sl, s.memo, { x: 0.65, y: 6.05, w: W - 1.3, h: 0.55 }, { fontSize: 14, valign: 'middle' });
      }
      txt(sl, sc.name || '', { x: 0.55, y: 6.95, w: W / 2, h: 0.35 }, { fontSize: 11, color: s.dark ? 'A9B8C6' : '8A8576' });
      txt(sl, `${i + 1} / ${ss.length}`, { x: W - 2.55, y: 6.95, w: 2, h: 0.35 }, { fontSize: 11, color: s.dark ? 'A9B8C6' : '8A8576', align: 'right' });
    });
    await pg.writeFile({ fileName: `${title}.pptx` });
  },

  /** ダウンロード：開くだけで発表できる HTML 1ファイル（動きつき・通信なし） */
  download(htmls, title) {
    if (!htmls.length) return;
    const css = `:root{--font:${getComputedStyle(document.documentElement).getPropertyValue('--font') || 'sans-serif'}}html,body{margin:0;height:100%;background:#111}` + SLIDE_CSS;
    const data = JSON.stringify(htmls).replace(/</g, '\\u003c');
    const doc = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body><div id="slideShow"></div>
<script>${slidesPlayer.toString()}
slidesPlayer({ host: document.getElementById('slideShow'), htmls: ${data}, W: ${this.W}, H: ${this.H}, ANIM: ${JSON.stringify(this.ANIM)}, start: 0, hint: '← → で移動　F で全画面' });
<\/script></body></html>`;
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    const a = document.createElement('a'); a.href = url; a.download = `${title}.html`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  /** 印刷・PDF：1枚＝1ページ（16:9） */
  print(htmls, title) {
    const w = this.W;
    Print.open({ title, html: htmls.map(h => `<div class="p-page sl-print" style="width:${w}px">${h}</div>`).join(''), orientation: '', margin: '0', size: `${w === 960 ? '254' : '338.67'}mm 190.5mm` });
  },
};

/** 発表の実体：左右の移動・拡大縮小・LP風の動き・進行バー。アプリと、ダウンロードした HTML の両方で使う
    （ダウンロード側では toString() で埋め込むので、アプリの他の関数・変数に頼らないこと） */
function slidesPlayer(o) {
  const host = o.host, htmls = o.htmls, W = o.W, H = o.H;
  let i = Math.max(0, Math.min(o.start || 0, htmls.length - 1));
  host.innerHTML = '<div class="sl-stage"></div><div class="sl-prog"><i></i></div><div class="sl-hint">' + (o.hint || '') + '</div>';
  const stage = host.firstChild, bar = host.querySelector('.sl-prog i');
  stage.style.width = W + 'px';
  const fit = () => { stage.style.transform = 'translate(-50%,-50%) scale(' + Math.min(window.innerWidth / W, window.innerHeight / H) + ')'; };
  const animate = (sl, dir) => {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    [].slice.call(sl.querySelectorAll(o.ANIM)).forEach((el, n) => el.style.setProperty('--i', Math.min(n, 28)));
    sl.querySelectorAll('.sl-tv, .sl-total b, .sl-cnt, .sl-dc b').forEach(el => {
      const node = el.firstChild, raw = node ? String(node.nodeValue) : '', to = parseInt(raw.replace(/,/g, ''), 10), comma = raw.indexOf(',') >= 0;
      if (!node || node.nodeType !== 3 || !(to > 0)) return;
      const t0 = performance.now() + 250;
      const step = t => {
        const k = Math.max(0, Math.min(1, (t - t0) / 900));
        const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
        node.nodeValue = comma ? v.toLocaleString('en-US') : String(v);
        if (k < 1 && sl.isConnected) requestAnimationFrame(step);
      };
      node.nodeValue = '0'; requestAnimationFrame(step);
    });
    sl.classList.add(dir < 0 ? 'play-l' : 'play-r');
  };
  const draw = dir => {
    fit(); stage.innerHTML = htmls[i];
    bar.style.width = ((i + 1) / htmls.length * 100) + '%';
    animate(stage.firstChild, dir || 1);
  };
  const go = j => { j = Math.max(0, Math.min(j, htmls.length - 1)); if (j === i) return; const d = j > i ? 1 : -1; i = j; draw(d); };
  const key = e => {
    if (e.key === 'Escape') { if (o.onClose) { e.preventDefault(); o.onClose(); } return; }
    if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else if (host.requestFullscreen) host.requestFullscreen(); return; }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].indexOf(e.key) >= 0) go(i + 1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(e.key) >= 0) go(i - 1);
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(htmls.length - 1); else return;
    e.preventDefault();
  };
  const click = e => go(e.clientX < window.innerWidth / 3 ? i - 1 : i + 1);
  window.addEventListener('keydown', key, true); window.addEventListener('resize', fit); host.addEventListener('click', click);
  draw(1);
  return { destroy() { window.removeEventListener('keydown', key, true); window.removeEventListener('resize', fit); } };
}
