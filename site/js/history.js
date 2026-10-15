'use strict';
/* ============================================================
   過去の実績（累積）：年度別の就職先・進学先の人数、指定校マスタ、前年度までのまとめ
   - R1〜R7 の「年度別 進路先一覧」Excel をそのまま取り込む（History.import*）
   - 今年度の列は、生徒ごとの進路決定（outcomes.js）から自動で数える
   - 年度更新のとき、今年度の分を実績に足して、次の年度に引き継ぐ（History.commit）
   - 年度は「年度の西暦」で持つ（令和7年度＝2025）。表示は R7／H30
   ============================================================ */

const Yr = {
  label(y) { return y >= 2019 ? 'R' + (y - 2018) : 'H' + (y - 1988); },
  long(y) { return y >= 2019 ? `令和${y - 2018}年度` : `平成${y - 1988}年度`; },
  /** 表の見出しの数字（7＝令和7、30＝平成30）→ 年度の西暦 */
  fromHead(n) { n = Number(n); return n >= 20 ? 1988 + n : 2018 + n; },
};

/** 会社名を一覧に載せる短い名前にする：株式会社などを除き、「〇〇工場」のような事業所名の語を落とす */
function shortCompany(s) {
  let t = String(s ?? '').replace(/[\s　]+/g, ' ').trim();
  t = t.replace(/(株式会社|有限会社|合同会社|合資会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|社会福祉法人|医療法人社団|医療法人財団|医療法人|学校法人|宗教法人|特定非営利活動法人|生活協同組合|農業協同組合)/g, ' ')
    .replace(/[（(]株[）)]|[（(]有[）)]|㈱|㈲/g, ' ');
  const site = /(本社|本店|支店|営業所|出張所|事業所|工場|支社|事業部|センター|店)$/;
  const toks = t.split(' ').filter(Boolean);
  const keep = toks.filter((w, i) => i === 0 || !site.test(w));
  return (keep.join('') || toks.join('')).trim();
}
/** 名前の照合用キー（全角半角・空白・記号を無視） */
function nameKey(s) {
  return String(s ?? '').normalize('NFKC').toLowerCase().replace(/[\s　・･\-ー－―‐\(\)（）「」『』【】]/g, '');
}
/** 学校名の照合用キー：「大学」「短期大学」「専門学校」などの語尾も無視する */
function schoolKey(s) {
  return nameKey(s).replace(/(大学短期大学部|短期大学部|短期大学|大学校|大学|短大|専門学校)$/g, '');
}

const History = {
  /* ---------- Excel のセルの読み取り（SheetJS の ws） ---------- */
  cell(ws, r, c) { const x = ws[XLSX.utils.encode_cell({ r, c })]; return (x == null || x.v == null || x.v === '') ? null : x; },
  text(x) { return x == null ? '' : String(x.w ?? x.v).replace(/[\s　]+/g, '').trim(); },
  /** 人数のセル：数字、「1※」（印つき）、「募集停止」「名称改定」（文字だけ）に対応 */
  count(x, warns, where) {
    if (x == null) return { n: 0 };
    if (typeof x.v === 'number') {
      if (x.v >= 20) { warns.push(`${where}：人数が ${x.v} です（年度の入力ミスの可能性。0 として取り込みました）`); return { n: 0 }; }
      return { n: x.v };
    }
    const s = String(x.v).replace(/[\s　]+/g, '');
    const m = s.match(/^(\d+)(.*)$/);
    if (m) return { n: Math.min(+m[1], 99), mark: m[2] };
    return { n: 0, mark: s };
  },
  rowsOf(ws) { const r = XLSX.utils.decode_range(ws['!ref']); return r.e.r + 1; },
  isFoot(t) { return /^[※・↑*＊]/.test(t) || /最新の情報|校名変更|確認して|ください。?$/.test(t); },

  /* ============ ① 年度別 学校斡旋就職先一覧表 ============ */
  IND_HEAD: /^([Ａ-Ｔ])(農業|林業|漁業|鉱業|建設業|製造業|電気|情報通信業|運輸|卸売|小売|金融|不動産|学術研究|宿泊|飲食|生活関連|教育|医療|複合サービス|サービス業|公務|分類不能)/,
  parseWork(ws) {
    const warns = [], map = new Map(), n = this.rowsOf(ws);
    let years = null, seq = 0;
    for (const c0 of [0, 8]) {
      let ind = null, yrs = years;
      for (let r = 0; r < n; r++) {
        const a = this.cell(ws, r, c0), t = this.text(a);
        if (typeof a?.v === 'string' && this.IND_HEAD.test(t)) { ind = t.replace(/[（(]続き[）)]/, '').charAt(0).normalize('NFKC'); continue; }
        if (t === '会社名') {
          const ys = [];
          for (let k = 1; k <= 6; k++) { const v = this.cell(ws, r, c0 + k); ys.push(v == null ? null : Yr.fromHead(v.v)); }
          if (ys.some(v => v != null)) { yrs = ys.map((v, i) => v ?? (yrs ? yrs[i] : null)); if (!years) years = yrs; }
          continue;
        }
        if (r < 3 || !ind || !yrs) continue;
        const cs = []; let any = false;
        for (let k = 1; k <= 6; k++) { const x = this.cell(ws, r, c0 + k); const v = this.count(x, warns, `就職 ${r + 1}行`); cs.push(v.n); if (v.n) any = true; }
        if (!a) { if (any) warns.push(`就職 ${r + 1}行：会社名がなく人数だけの行があります（取り込みません）`); continue; }
        if (typeof a.v !== 'string' || this.isFoot(t)) continue;
        const key = ind + '|' + nameKey(t);
        if (!map.has(key)) map.set(key, { id: uid(), name: t, ind, counts: {}, ord: seq++ });
        const row = map.get(key);
        cs.forEach((v, i) => { if (v && yrs[i] != null) row.counts[yrs[i]] = (row.counts[yrs[i]] || 0) + v; });
      }
    }
    return { rows: [...map.values()], years, warns };
  },

  /* ============ ② 年度別 専修・各種学校進学先一覧表 ============ */
  parseSenshu(ws) {
    const warns = [], rows = [], n = this.rowsOf(ws);
    let years = null, seq = 0;
    for (const [c0, start] of [[0, null], [9, null]]) {
      let sec = start, field = '', fieldNo = 0;
      for (let r = 0; r < n; r++) {
        const a = this.cell(ws, r, c0), t = this.text(a);
        if (!t) continue;
        if (/^[１1][．.]/.test(t)) { sec = 'shitei'; field = ''; continue; }
        if (/^[２2][．.]/.test(t)) { sec = 'open'; field = ''; continue; }
        let m = t.match(/^[（(]([０-９0-9]+)[）)](.+)$/);
        if (m) { sec = 'open'; field = m[2]; fieldNo = +m[1].normalize('NFKC'); continue; }
        if (t === '学校名') {
          const ys = []; for (let k = 1; k <= 7; k++) { const v = this.cell(ws, r, c0 + k); ys.push(v == null ? null : Yr.fromHead(v.v)); }
          if (!years && ys.every(v => v != null)) years = ys;
          continue;
        }
        if (r < 3 || !sec || !years || this.isFoot(t)) continue;
        const counts = {}, marks = {};
        for (let k = 1; k <= 7; k++) {
          const v = this.count(this.cell(ws, r, c0 + k), warns, `専修各種 ${r + 1}行`);
          if (v.n) counts[years[k - 1]] = v.n;
          if (v.mark) marks[years[k - 1]] = v.mark;
        }
        rows.push({ id: uid(), sec, field, fieldNo, name: t, counts, marks, ord: seq++ });
      }
    }
    return { rows, years, warns };
  },

  /* ============ ③ 年度別 四大・短大進学先一覧表 ============ */
  parseUniv(ws) {
    const warns = [], rows = [], n = this.rowsOf(ws);
    let seq = 0, years = null, level = null, sec = null, school = '', faculty = '';
    for (let r = 0; r < n; r++) {
      const a = this.cell(ws, r, 0), b = this.cell(ws, r, 1), c = this.cell(ws, r, 2);
      const ta = this.text(a), tb = this.text(b), tc = this.text(c);
      if (/^[１1][．.]/.test(ta)) { level = 'univ'; sec = null; school = faculty = ''; continue; }
      if (/^[２2][．.]/.test(ta)) { level = 'junior'; sec = null; school = faculty = ''; continue; }
      if (/^[（(][０-９0-9]+[）)]/.test(ta)) { sec = /指定校/.test(ta) ? 'shitei' : 'open'; school = faculty = ''; continue; }
      if (ta === '大学名' || ta === '短大名') {
        if (!years) { const ys = []; for (let k = 3; k <= 10; k++) { const v = this.cell(ws, r, k); ys.push(v == null ? null : Yr.fromHead(v.v)); } years = ys; }
        continue;
      }
      if (r < 3 || !level || !sec || !years) continue;
      if (this.isFoot(ta) || this.isFoot(tb) || this.isFoot(tc)) continue;
      const counts = {}, marks = {}; let any = false;
      for (let k = 3; k <= 10; k++) {
        const v = this.count(this.cell(ws, r, k), warns, `四大短大 ${r + 1}行`);
        if (v.n) { counts[years[k - 3]] = v.n; any = true; }
        if (v.mark) marks[years[k - 3]] = v.mark;
      }
      if (!ta && !tb && !tc && !any && !Object.keys(marks).length) continue;
      if (ta) { school = ta; faculty = tb; }
      else if (tb) faculty = tb;
      if (!school) { if (any) warns.push(`四大短大 ${r + 1}行：学校名がなく人数だけの行があります（取り込みません）`); continue; }
      rows.push({ id: uid(), level, sec, school, faculty: ta || tb ? (tb || faculty) : faculty, dept: tc, counts, marks, ord: seq++ });
    }
    return { rows, years, warns };
  },

  /* ============ ④ 指定校一覧（進路の手引の原稿）＝指定校マスタ ============ */
  parseMaster(wb) {
    const warns = [], out = { year: null, univ: [], junior: [], senshu: [] };
    const sheets = { univ: ['四大'], junior: ['短大'], senshu: ['専修各種', '専修'] };
    for (const [kind, names] of Object.entries(sheets)) {
      const sn = wb.SheetNames.find(x => names.some(n => x.includes(n)));
      if (!sn) { warns.push(`指定校一覧：「${names[0]}」のシートが見つかりません`); continue; }
      const ws = wb.Sheets[sn], n = this.rowsOf(ws);
      const title = this.text(this.cell(ws, 0, 0));
      const ym = title.normalize('NFKC').match(/令和(\d+)年度/);
      if (ym && !out.year) out.year = 2018 + +ym[1];
      let hr = -1;
      for (let r = 0; r < Math.min(n, 6); r++) if (/(大学名|短期大学名|学校名)/.test(this.text(this.cell(ws, r, 0)))) { hr = r; break; }
      if (hr < 0) { warns.push(`指定校一覧「${sn}」：見出し行が見つかりません`); continue; }
      const heads = []; for (let k = 0; k < 12; k++) heads.push(this.text(this.cell(ws, hr, k)));
      const col = re => heads.findIndex(h => re.test(h));
      const ix = { name: 0, faculty: col(/^学部$/), dept: col(/学科|コース/), quota: col(/人数/), grade: col(/(推薦)?(評定)?基準$|評定基準|推薦基準$/), crit: col(/基準項目/), exam: col(/試験/), addr: col(/所在地/) };
      for (let r = hr + 1; r < n; r++) {
        const g = k => { const x = k >= 0 ? this.cell(ws, r, k) : null; return x == null ? '' : String(x.w ?? x.v).replace(/\r\n?/g, '\n').trim(); };
        const name = g(0).replace(/[\s　]+/g, '');
        if (!name || this.isFoot(name)) continue;
        out[kind].push({ id: uid(), name, faculty: g(ix.faculty), dept: g(ix.dept), quota: g(ix.quota), grade: g(ix.grade), crit: g(ix.crit), exam: g(ix.exam), addr: g(ix.addr) });
      }
    }
    return { master: out, warns };
  },
};
