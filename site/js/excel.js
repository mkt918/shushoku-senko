'use strict';
/* ============================================================
   Excel 取り込み・出力（SheetJS 使用：lib/xlsx.full.min.js）
   ============================================================ */

const Excel = {
  ok() {
    if (typeof XLSX === 'undefined') { UI.toast('Excel 部品（lib/xlsx.full.min.js）が見つかりません', 'error'); return false; }
    return true;
  },

  /** ファイルを選ばせて workbook を返す */
  pickWorkbook() {
    return new Promise((resolve, reject) => {
      if (!this.ok()) return resolve(null);
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.xlsx,.xlsm,.xls,.csv';
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return resolve(null);
        try { resolve(await this.readFile(f)); }
        catch (e) { reject(new Error('ファイルを読めませんでした：' + e.message)); }
      };
      inp.click();
    });
  },

  /** バイト列を文字列に（BOM付き UTF-8／UTF-16／UTF-8／Shift_JIS を自動判別） */
  decodeText(buf) {
    const u = new Uint8Array(buf);
    if (u[0] === 0xEF && u[1] === 0xBB && u[2] === 0xBF) return { text: new TextDecoder('utf-8').decode(u.subarray(3)), enc: 'UTF-8' };
    if (u[0] === 0xFF && u[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(u.subarray(2)), enc: 'UTF-16' };
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(u), enc: 'UTF-8' }; } catch (e) { /* 次へ */ }
    return { text: new TextDecoder('shift_jis').decode(u), enc: 'Shift_JIS' };
  },

  /** File → workbook。CSV は値を文字列のまま読む（0 始まりの番号や 72-01 が日付・数値にならないように） */
  async readFile(file) {
    const buf = await file.arrayBuffer();
    let wb;
    if (/\.(csv|txt|tsv)$/i.test(file.name)) {
      const { text, enc } = this.decodeText(buf);
      wb = XLSX.read(text, { type: 'string', raw: true });
      wb._encoding = enc;
    } else {
      wb = XLSX.read(buf, { type: 'array', cellDates: true });
    }
    wb._fileName = file.name;
    return wb;
  },

  rows(ws) { return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true, blankrows: false }); },

  /** 見出しの正規化（全角→半角、空白・改行除去） */
  norm(v) { return toHalf(v == null ? '' : String(v)).replace(/[\s　]/g, '').replace(/[（]/g, '(').replace(/[）]/g, ')'); },

  /** 見出し行を探す：patterns のどれかに一致するセルを含む最初の行（先頭15行まで） */
  findHeader(rows, patterns) {
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const r = rows[i] || [];
      if (r.some(c => patterns.some(p => p.test(this.norm(c))))) return i;
    }
    return -1;
  },
  /** 見出し行。見つからなければ先頭の行（列の対応を画面で指定するとき用） */
  headerOr0(rows, patterns) { const i = this.findHeader(rows, patterns); return i >= 0 ? i : 0; },
  col(header, patterns) {
    for (const p of patterns) {
      const i = header.findIndex(c => p.test(this.norm(c)));
      if (i >= 0) return i;
    }
    return -1;
  },
  truthy(v) {
    if (v == null) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    return /^(〇|○|◯|●|1|あり|有|TRUE|✓|✔|レ|y|yes)$/i.test(toHalf(v).trim());
  },

  /** 取り込み用の様式をダウンロード：「入力」（見出しだけ）／「記入例」（ダミー）／「説明」 */
  template(fileName, headers, examples, notes, widths) {
    this.download(fileName, [
      { name: '入力', rows: [headers], widths },
      { name: '記入例', rows: [headers, ...examples], widths },
      { name: '説明', rows: notes.map(n => [n]), widths: [110] },
    ]);
  },

  /** CSV で出力（Excel でそのまま開けるよう、BOM 付き UTF-8・改行は CRLF） */
  downloadCsv(fileName, rows) {
    const q = v => { const t = v == null ? '' : String(v); return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const text = '\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
    downloadBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), fileName);
  },

  /** 出力：sheets = [{ name, rows: [[...]], widths: [..] }] */
  download(fileName, sheets) {
    if (!this.ok()) return;
    const wb = XLSX.utils.book_new();
    for (const sh of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(sh.rows);
      if (sh.widths) ws['!cols'] = sh.widths.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
    }
    XLSX.writeFile(wb, fileName);
  },
};

/* ============================================================
   取り込みの種類
   parse(rows) → { items: [...], skipped: [{row, reason}] }
   apply(items) → { added, updated }
   ============================================================ */
/** 求人票の項目名（取り込み画面の「列の対応」に出す） */
const COL_LABELS = {
  receiptNo: '受付番号', employment: '雇用形態', company: '事業所名（必須）', kana: 'フリガナ', zip: '郵便番号', address: '所在地',
  employees: '従業員数', jobTitle: '職種', capital: '資本金', business: '事業内容', workplace: '就業場所', salary: '基本給',
  industryCode: '産業分類', occupationCode: '職業分類', holidays: '年間休日', jobNumber: '求人番号', dept: '応募・選考の部署',
  contact: '応募・選考の担当者', tel: '電話番号', openings: '求人数', inPref: '県内（就業場所）の求人数', outPref: '県外（就業場所）の求人数',
  kind: '区分（一般／指名／事前選考）', office: '受付安定所', workAddress: '就業場所の住所（県内・県外の判定）', occ5: '職業分類（5桁）',
  occ3: '職業分類（3桁）', open1: '求人数（通勤）', open2: '求人数（住込）', open3: '求人数（不問）', visitOk: '職場見学の受け入れ', visitInfo: '職場見学の日程',
};

/** 求人票の取り込みで、既にある求人のどの項目が変わるか（事前チェック用） */
function jobsDiff(items, byJobNumber, skipBlank = true) {
  const changes = [];
  let created = 0;
  const seen = new Set();
  for (const it of items) {
    const hit = jobMatch(it, byJobNumber);
    if (!hit || seen.has(hit.id)) { if (!hit) created++; continue; }
    seen.add(hit.id);
    for (const [k, v] of Object.entries(it)) {
      if (skipBlank && (v === '' || v == null)) continue;
      const old = hit[k] == null ? '' : String(hit[k]);
      if (old !== String(v)) changes.push({ job: hit, k, from: old, to: String(v) });
    }
  }
  return { changes, created };
}

const NO3_PATTERNS = [/^3年.*番号/, /^(番号|学籍|学籍番号|CLNO|生徒番号|出席番号)$/i];

/** 取り込む求人が、登録済みのどれにあたるか。byJobNumber＝求人番号を最優先にする（Handy） */
function jobMatch(it, byJobNumber) {
  const jobs = Store.data.jobs;
  const jn = digits(it.jobNumber);
  if (byJobNumber && jn.length >= 5) { const h = jobs.find(j => digits(j.jobNumber) === jn); if (h) return h; }
  if (it.receiptNo) { const h = jobs.find(j => j.receiptNo === it.receiptNo); if (h) return h; }
  // 受付番号も求人番号もない求人（選考会議の取り込みなどで作ったもの）は、事業所名（＋職種）で照合して1つにまとめる
  const ck = companyKey(it.company), tk = companyKey(it.jobTitle);
  const loose = jobs.filter(j => !j.receiptNo && !digits(j.jobNumber) && ck && companyKey(j.company) === ck);
  const lh = loose.find(j => tk && companyKey(j.jobTitle) === tk) || (loose.length === 1 ? loose[0] : null);
  if (lh) return lh;
  if (it.receiptNo || (byJobNumber && jn.length >= 5)) return null;
  return jobs.find(j => j.company === it.company && j.jobTitle === it.jobTitle) || null;
}

/** 会社名の照合用（株式会社などの語・空白・記号を除く） */
function companyKey(s) {
  return toHalf(String(s ?? '')).replace(/[\s　]/g, '').replace(/㈱|㈲|\(株\)|\(有\)|株式会社|有限会社|合同会社|一般社団法人|社会福祉法人|医療法人|学校法人/g, '').toLowerCase();
}

/** 取り込む希望（番号・会社名・職種）が、登録済みのどの求人か。見つからなければ null */
function matchSelectionJob(sl) {
  const jobs = Store.data.jobs;
  const ck = companyKey(sl.company), tk = companyKey(sl.jobTitle);
  const sameCo = j => { const k = companyKey(j.company); return ck && k && (k === ck || k.includes(ck) || ck.includes(k)); };
  if (sl.num != null) {
    const hits = Jobs.byShort(sl.num);
    if (hits.length === 1 && (!ck || sameCo(hits[0]))) return hits[0];
    const byCo = hits.filter(sameCo);
    if (byCo.length) return byCo.find(j => tk && companyKey(j.jobTitle) === tk) || byCo[0];
    if (hits.length === 1 && !ck) return hits[0];
  }
  if (!ck) return null;
  const cands = jobs.filter(sameCo);
  return cands.find(j => tk && companyKey(j.jobTitle) === tk) || (cands.length === 1 && !tk ? cands[0] : null);
}

const SELECTION_SPECIAL = { '自己開拓': '自己開拓', '公務員': '公務員', '家事手伝': '家事手伝い', '家事手伝い': '家事手伝い', '選考見送り': '' };


/* ============================================================
   進路決定の取り込み（進学・就職は別々）。CSV／Excel どちらも読める
   ============================================================ */
const OutImport = {
  /** 校種：「大学」「短大」「専門学校」などの文字、なければ学校名から推測。分からなければ ''、不正なら null */
  level(raw, school) {
    const guess = t => /短期大|短大/.test(t) ? 'junior' : /大学校/.test(t) ? 'college' : /四大|4大|四年|大学/.test(t) ? 'univ' : /准看護/.test(t) ? 'nurse'
      : /専門|専修|各種|学院|カレッジ|アカデミー|スクール/.test(t) ? 'senshu' : /その他/.test(t) ? 'eduOther' : '';
    const t = Excel.norm(raw);
    if (t) {
      const hit = OC.LEVELS.find(([k, n]) => k === t || n === t);
      return hit ? hit[0] : (guess(t) || null);
    }
    return guess(Excel.norm(school));
  },
  /** 方法：総合型・指定校・AO・公募型・一般 → 受験方法の名前。空欄は ''、不明は null */
  exam(raw) {
    const t = Excel.norm(raw).toUpperCase();
    if (!t) return '';
    return /指定/.test(t) ? '指定校推薦' : /公募/.test(t) ? '公募制推薦' : /総合|AO/.test(t) ? '総合型選抜' : /一般/.test(t) ? '一般選抜' : null;
  },
  /** 状態：空欄は 決定。不明は null */
  status(raw) {
    const t = Excel.norm(raw);
    return !t || /^決定/.test(t) ? '決定' : /活動|未/.test(t) ? '活動中' : null;
  },
  /** 記号（A〜T）または名前から記号を探す。空欄は ''、不明は null */
  letter(raw, names) {
    const t = Excel.norm(raw);
    if (!t) return '';
    const up = t.toUpperCase();
    if (names[up]) return up;
    const hit = Object.entries(names).find(([, n]) => Excel.norm(n) === t) || Object.entries(names).find(([, n]) => t.length >= 2 && Excel.norm(n).includes(t));
    return hit ? hit[0] : null;
  },
  /** 就職の種別。空欄は学校斡旋、不明は null */
  kind(raw) {
    const t = Excel.norm(raw);
    if (!t) return '学校斡旋';
    return /公務/.test(t) ? '公務' : /斡旋外|縁故|自己開拓|自営|家事/.test(t) ? '斡旋外' : /斡旋/.test(t) ? '学校斡旋' : null;
  },
  /** 番号を読む（名簿にない番号は読み飛ばす）。読めなければ '' */
  rowNo(r, c, hi, i, skipped) {
    const no3 = studentNo(r[c.no3]);
    if (!no3) { const why = badStudentNo(r[c.no3]); if (why) skipped.push({ row: hi + i + 2, reason: why }); return ''; }
    if (!Students.byNo(no3)) { skipped.push({ row: hi + i + 2, reason: `${no3}：名簿にない番号` }); return ''; }
    return no3;
  },
  /** 空欄でない項目だけ、今の進路先に上書きする（同じ区分の入力があればそれを残す） */
  apply(items, type) {
    let updated = 0;
    for (const it of items) {
      const s = Students.byNo(it.no3);
      if (!s) continue;
      const cur = s.dest && s.dest.type === type ? s.dest : {};
      const filled = Object.fromEntries(Object.entries(it.dest).filter(([, v]) => v !== '' && v != null));
      s.dest = Object.assign({}, cur, filled, { type });
      updated++;
    }
    return { added: 0, updated };
  },
};

const ImportTypes = {
  selection: {
    label: '選考会議（就職選考会の形式）',
    desc: '就職順位・番号・第1〜第5希望（求人票番号の下4桁・企業名・職種）と「確定」の列を、選考会議に取り込みます。番号の生徒の希望を上書きし、確定の印も付けます。登録済みの求人は番号と企業名で照合し、なければ新しい求人票（「事前」は事前選考）を作ります。「自己開拓」「公務員」「家事手伝」は受験方法に反映します。',
    detect: rows => Excel.findHeader(rows, [/^就職順位$/]) >= 0 && Excel.findHeader(rows, [/^【1】求人票番号/]) >= 0,
    parse(rows) {
      const hi = Excel.findHeader(rows, [/^就職順位$/]);
      const h = rows[hi].map(c => Excel.norm(c));
      const c = { no3: Excel.col(h, [/^番号$/]), gender: Excel.col(h, [/^性別/]), mogi: Excel.col(h, [/^模試/]) };
      if (c.no3 < 0) throw new Error('「番号」の列が見つかりません。');
      const groups = [];
      for (let k = 1; k <= 5; k++) {
        const n = Excel.col(h, [new RegExp('^【' + k + '】求人票番号')]);
        if (n < 0) continue;
        groups.push({ pref: k, n, co: Excel.col(h, [new RegExp('^【' + k + '】企業名')]), jt: Excel.col(h, [new RegExp('^【' + k + '】職種')]), flag: n - 1 });
      }
      if (!groups.length) throw new Error('「【1】求人票番号」などの列が見つかりません。');
      const items = [], skipped = [];
      let matched = 0, toCreate = 0, special = 0;
      rows.slice(hi + 1).forEach((r, i) => {
        const no3 = studentNo(r[c.no3]);
        if (!no3) { if (r.some(v => v != null && String(v).trim())) skipped.push({ row: hi + i + 2, reason: badStudentNo(r[c.no3]) || '番号なし' }); return; }
        const slots = [];
        for (const g of groups) {
          const raw = r[g.n], co = g.co >= 0 ? String(r[g.co] ?? '').trim() : '', jt = g.jt >= 0 ? String(r[g.jt] ?? '').trim() : '';
          const rawS = raw == null ? '' : String(raw).trim();
          if (!rawS && !co) continue;
          const confirmed = g.flag >= 0 && String(r[g.flag] ?? '').trim() === '確定';
          const sp = Object.prototype.hasOwnProperty.call(SELECTION_SPECIAL, rawS);
          const nm = /^[0-9０-９]+$/.test(rawS) ? Number(toHalf(rawS)) : null;
          slots.push({ pref: g.pref, num: nm, mark: sp ? rawS : (nm == null ? rawS : ''), company: co, jobTitle: jt, confirmed, special: sp });
        }
        const gender = c.gender >= 0 ? String(r[c.gender] ?? '').trim() : '';
        const mogi = c.mogi >= 0 ? num(r[c.mogi]) : null;
        items.push({ no3, gender, mogi, slots });
        slots.forEach(s => { if (s.special) special++; else if (matchSelectionJob(s)) matched++; else toCreate++; });
      });
      return { items, skipped, info: (toCreate && toCreate >= matched ? '<注意> 登録済みの求人票と一致しない希望が多くあります。先に「求人票」で求人票を取り込んでから、この表を取り込んでください。' : '') + '希望 ' + (matched + toCreate + special) + ' 件のうち、登録済みの求人と一致 ' + matched + ' 件／新しく求人票を作る ' + toCreate + ' 件／求人以外（自己開拓・公務員・家事手伝・見送り）' + special + ' 件' };
    },
    apply(items) {
      let added = 0, updated = 0;
      for (const it of items) {
        let s = Students.byNo(it.no3);
        if (!s) { s = blankStudent(it.no3); Store.data.students.push(s); added++; } else updated++;
        if (it.gender && !s.gender) s.gender = it.gender;
        if (it.mogi != null && s.mogi == null) s.mogi = it.mogi;
        if (!s.course) s.course = '就職';
        let confirmedPref = 0;
        for (const sl of it.slots) {
          if (sl.special) {
            if (sl.confirmed && SELECTION_SPECIAL[sl.mark]) s.method = SELECTION_SPECIAL[sl.mark];
            continue;
          }
          let job = matchSelectionJob(sl);
          if (!job) {
            job = Object.assign({ id: uid(), company: sl.company || '（会社名なし）', jobTitle: sl.jobTitle, kind: sl.mark === '事前' ? '事前選考' : '一般', employment: '正社員', workArea: '県内' }, Jobs.batchTag());
            Store.data.jobs.push(job);
          }
          const cur = Apps.prefs(s.id)[sl.pref];
          if (!cur || cur.jobId !== job.id) {      // 別の求人になったら、記録は引き継がずに作り直す
            if (cur) Store.data.applications = Store.data.applications.filter(x => x !== cur);
            Store.data.applications.push(blankApplication(s.id, job.id, 1, sl.pref));
          }
          if (sl.confirmed) confirmedPref = sl.pref;
        }
        Apps.of(s.id).forEach(a => { if (a.round === 1) a.confirmed = a.pref === confirmedPref; });
      }
      return { added, updated };
    },
    template() {
      const head = ['就職順位', '番号', '性別', '最終P', '生活P', '特活P', '模試'];
      for (let k = 1; k <= 5; k++) head.push('確定', '【' + k + '】求人票番号下4桁', '【' + k + '】企業名', '【' + k + '】職種');
      const row = n => [n, 3100 + n, n % 2 ? '男' : '女', '', '', '', '', n === 1 ? '確定' : '', 1200 + n, 'ダミー' + n + '株式会社', '製造', n === 2 ? '確定' : '', 1300 + n, 'ダミー' + (n + 10) + '株式会社', '事務'];
      Excel.download('取り込み様式_選考会議.xlsx', [{ name: '選考会議', widths: [7, 7, 5, 6, 6, 6, 6, 6, 12, 26, 18, 6, 12, 26, 18], rows: [head, row(1), row(2)] }]);
    },
  },

  grades: {
    label: '名簿・評定・出欠（元データ形式）',
    desc: '1〜3年の番号、氏名、性別、各学年の評定、欠席・遅刻・早退。3年番号で照合し、評定と出欠を上書きします。',
    detect: rows => Excel.findHeader(rows, [/^[123]年評定/]) >= 0,
    parse(rows) {
      const hi = Excel.findHeader(rows, [/^[123]年評定/]);
      const h = rows[hi].map(c => Excel.norm(c));
      const c = {
        no1: Excel.col(h, [/^1年.*番号/]), no2: Excel.col(h, [/^2年.*番号/]), no3: Excel.col(h, NO3_PATTERNS),
        name: Excel.col(h, [/^(氏名|名前)/]), gender: Excel.col(h, [/^性別/]),
      };
      if (c.no3 < 0) throw new Error('「3年番号」の列が見つかりません。');
      // 評定ブロック：「n年評定」の列から、次の見出しがある列の手前まで
      const block = y => {
        const s = h.findIndex(x => new RegExp(`^${y}年評定`).test(x));
        if (s < 0) return null;
        let e = s + 1;
        while (e < h.length && !h[e]) e++;
        return [s, e >= h.length ? Infinity : e];   // 一番右の枠は、行の最後まで読む
      };
      const blocks = { y1: block(1), y2: block(2), y3: block(3) };
      const att = (kind, y) => Excel.col(h, [new RegExp(`^${y}年${kind}`)]);
      const items = [], skipped = [];
      rows.slice(hi + 1).forEach((r, i) => {
        const no3 = studentNo(r[c.no3]);
        if (!no3) { const why = badStudentNo(r[c.no3]) || (r.some(v => v != null) ? '3年番号なし' : null); if (why) skipped.push({ row: hi + i + 2, reason: why }); return; }
        const g = {};
        for (const y of ['y1', 'y2', 'y3']) {
          const b = blocks[y];
          g[y] = b ? r.slice(b[0], b[1]).map(num).filter(v => v != null && v >= 1 && v <= 5) : [];
        }
        const a3 = kind => [1, 2, 3].map(y => { const k = att(kind, y); return k >= 0 ? num(r[k]) : null; });
        items.push({
          no3, no1: c.no1 >= 0 ? studentNo(r[c.no1]) : '', no2: c.no2 >= 0 ? studentNo(r[c.no2]) : '',
          name: c.name >= 0 ? String(r[c.name] ?? '').trim() : '', gender: c.gender >= 0 ? String(r[c.gender] ?? '').trim() : '',
          grades: g, absent: a3('欠席'), late: a3('遅刻'), early: a3('早退'),
        });
      });
      const found = ['y1', 'y2', 'y3'].filter(y => blocks[y]).map(y => y[1] + '年');
      const mx = y => Math.max(0, ...items.map(it => it.grades[y].length));
      return { items, skipped, info: `評定の列：${found.join('・') || 'なし'}（科目数の最大：1年 ${mx('y1')}・2年 ${mx('y2')}・3年 ${mx('y3')}）／出欠の列：${['欠席', '遅刻', '早退'].filter(k => att(k, 1) >= 0).join('・') || 'なし'}` };
    },
    apply(items) {
      let added = 0, updated = 0;
      for (const it of items) {
        let s = Students.byNo(it.no3);
        if (!s) { s = blankStudent(it.no3); Store.data.students.push(s); added++; } else updated++;
        ['no1', 'no2', 'name', 'gender'].forEach(k => { if (it[k]) s[k] = it[k]; });
        s.grades = it.grades; s.absent = it.absent; s.late = it.late; s.early = it.early;
      }
      return { added, updated };
    },
    /** 取り込み用の様式 */
    template() {
      const SL = 20;   // 1年・2年の評定の枠（科目数）。3年は一番右なので、右へ続けて入力してよい
      const blanks = n => Array(n).fill(null);
      const pad = arr => [...arr, ...blanks(SL - arr.length)];
      const head = ['1年番号', '2年番号', '3年番号', '名前', '性別',
        '1年欠席', '2年欠席', '3年欠席', '1年遅刻', '2年遅刻', '3年遅刻', '1年早退', '2年早退', '3年早退',
        '1年評定', ...blanks(SL - 1), '2年評定', ...blanks(SL - 1), '3年評定', ...blanks(SL - 1)];
      const ex = [0, 1].map(i => [1201 + i, 2101 + i, 3101 + i, `（例）生徒${i + 1}`, i ? '女' : '男',
        i, 0, 0, i * 2, 1, 0, 0, 0, 0,
        ...pad([4, 3, 5, 4, 3, 4, 5, 4, 3, 4, 4, 5, 3, 4, 4]), ...pad([4, 4, 3, 5, 4, 3, 4, 5, 4, 3, 4, 4, 5, 3, 4, 4, 3]), ...pad([4, 4, 5, 3, 4, 4, 3, 5, 4, 4, 3, 4])]);
      Excel.template('取り込み用_名簿・評定・出欠.xlsx', head, ex, [
        '【名簿・評定・出欠】の入力のしかた',
        '・「入力」シートの2行目から、生徒1人を1行で入力します。「記入例」シートはダミーです（取り込む前に見本として確認してください）。',
        '・3年番号が必須です。学籍（1年・2年・3年の番号）はすべて「4桁の数字」で入力してください（例：3101）。4桁でない行は読み飛ばし、取り込み画面に理由が出ます。',
        '・氏名は空欄でも取り込めますが、帳票に出るので入れてください。',
        '・欠席・遅刻・早退：学年ごとの日数・回数を入力します（0 も入れてください）。未入力のままだと「出欠未入力」と注意が出ます。',
        '・評定は、シートの右側に「1年評定」「2年評定」「3年評定」の順に並んでいます。各見出しから右へ、科目ごとの評定（1〜5）を入力します。科目の数は人によって違っても構いません。',
        '　1年・2年は、次の見出しの手前（20科目）まで。3年は一番右なので、科目が多いときは右へそのまま続けて入力できます。',
        '　単位不認定の科目は評定「1」で入力します（追試に合格したら「2」に直します）。3年は1学期までの評定です。',
        '・見出しの文字は変えないでください（「1年評定」「3年番号」「1年欠席」など）。列の順番は入れ替えても構いませんが、評定の枠は各見出しの右に続けてください。',
        '・取り込み後の確認は「生徒・成績」画面で行えます。取り込み画面に「科目数の最大」が出るので、科目数が合っているか確かめてください。',
      ], [8, 8, 8, 16, 5, ...Array(9).fill(6), ...Array(SL * 3).fill(4.5)]);
    },
  },

  course: {
    label: '進路希望調査',
    desc: '学籍（3年番号）、進路希望（就職／進学…）、受験方法（学校斡旋など）、第1希望、職種、備考。',
    detect: rows => Excel.findHeader(rows, [/^進路希望$/]) >= 0,
    parse(rows) {
      const hi = Excel.findHeader(rows, [/^進路希望$/]);
      const h = rows[hi].map(c => Excel.norm(c));
      const c = {
        no3: Excel.col(h, NO3_PATTERNS), name: Excel.col(h, [/^(氏名|名前)/]), course: Excel.col(h, [/^進路希望$/]),
        method: Excel.col(h, [/^受験方法/]), hope: Excel.col(h, [/^第1希望/]), hopeJob: Excel.col(h, [/^職種/]), note: Excel.col(h, [/^備考/]),
      };
      if (c.no3 < 0) throw new Error('「学籍」または「番号」の列が見つかりません。');
      const items = [], skipped = [];
      rows.slice(hi + 1).forEach((r, i) => {
        const no3 = studentNo(r[c.no3]);
        if (!no3) { const why = badStudentNo(r[c.no3]); if (why) skipped.push({ row: hi + i + 2, reason: why }); return; }
        const raw = String(r[c.course] ?? '').trim();
        const course = /就職/.test(raw) ? '就職' : /進学/.test(raw) ? '進学' : raw ? 'その他' : '';
        const get = k => c[k] >= 0 ? String(r[c[k]] ?? '').trim() : '';
        items.push({ no3, name: get('name'), course, method: get('method'), hope: get('hope'), hopeJob: get('hopeJob'), note: get('note') });
      });
      return { items, skipped, info: `就職 ${items.filter(x => x.course === '就職').length} 人／進学 ${items.filter(x => x.course === '進学').length} 人` };
    },
    apply(items) {
      let added = 0, updated = 0;
      for (const it of items) {
        let s = Students.byNo(it.no3);
        if (!s) { s = blankStudent(it.no3); Store.data.students.push(s); added++; } else updated++;
        if (it.name && !s.name) s.name = it.name;
        s.course = it.course; s.method = it.method; s.hope = it.hope; s.hopeJob = it.hopeJob;
        if (it.note) s.note = it.note;
      }
      return { added, updated };
    },
    /** 取り込み用の様式（名簿が取り込み済みなら番号・氏名が入った状態で出力） */
    template() {
      const head = ['学籍', '氏名', '進路希望', '受験方法', '第1希望', '職種/学部・学科・コース', '備考（指名求人の際は企業名・担当者名・TEL番号）'];
      const have = Store.data.students.slice().sort((a, b) => a.no3.localeCompare(b.no3));
      const rows = have.map(s => [Number(s.no3), s.name, s.course || '', s.method || '', s.hope || '', s.hopeJob || '', s.note || '']);
      const w = [8, 16, 10, 12, 22, 24, 40];
      Excel.download('取り込み用_進路希望調査.xlsx', [
        { name: '入力', rows: [head, ...rows], widths: w },
        { name: '記入例', widths: w, rows: [head, [3101, '（例）生徒1', '就職', '学校斡旋', '', '', ''], [3102, '（例）生徒2', '進学', '', '○○大学', '経済学部', ''], [3103, '（例）生徒3', '就職', '縁故', '', '', '']] },
        { name: '説明', widths: [110], rows: [
          ['【進路希望調査】の入力のしかた'],
          ['・「学籍」は3年番号です。学籍はすべて4桁の数字で入力してください（例：3101）。名簿・評定の取り込み後にこの様式を出力すると、全員の番号と氏名が入った状態でダウンロードされます。'],
          ['・進路希望：「就職」「進学」「その他」のいずれかを入力します。'],
          ['・受験方法：就職の生徒は「学校斡旋」を入力します（空欄も学校斡旋として扱います）。縁故・公務員・自営など、学校斡旋以外のときはその内容を入力すると、選考の対象から外れます。'],
          ['・第1希望・職種・備考は任意です。見出しの文字は変えないでください。'],
        ] },
      ]);
    },
  },

  outShingaku: {
    label: '進路決定：進学',
    desc: '進学の進路先。列：番号（4桁）・方法（総合型／指定校／AO／公募型／一般）・校種（専門／短大／四大）・校名・学部・学科・専攻・専修・コース等・備考・状態（決定／活動中。空欄は決定）。校種が空欄でも、校名から判断します。「進路決定」の画面に入ります（就職は別の取り込みです）。',
    detect: rows => Excel.findHeader(rows, [/^(学校名|校名)$/]) >= 0 && Excel.findHeader(rows, [/^(受験)?方法$/]) >= 0,
    parse(rows) {
      const hi = Excel.findHeader(rows, [/^(学校名|校名)$/]);
      const h = rows[hi].map(c => Excel.norm(c));
      const c = { no3: Excel.col(h, [/^4?桁?番号$/, ...NO3_PATTERNS]), exam: Excel.col(h, [/^(受験)?方法$/]), level: Excel.col(h, [/^(校種|種別|区分)$/]),
        school: Excel.col(h, [/^(学校名|校名)$/]), faculty: Excel.col(h, [/^学部/]), dept: Excel.col(h, [/^学科/]),
        major: Excel.col(h, [/^(専攻|専修|コース)/]), remarks: Excel.col(h, [/^備考/]), status: Excel.col(h, [/^(状態|状況)$/]) };
      if (c.no3 < 0) throw new Error('「番号」の列が見つかりません。');
      const get = (r, k) => c[k] >= 0 ? String(r[c[k]] ?? '').trim() : '';
      const items = [], skipped = [];
      rows.slice(hi + 1).forEach((r, i) => {
        if (!r.some(x => x != null && String(x).trim() !== '')) return;
        const no3 = OutImport.rowNo(r, c, hi, i, skipped); if (!no3) return;
        const row = hi + i + 2, school = get(r, 'school');
        if (!school) { skipped.push({ row, reason: `${no3}：校名が空欄` }); return; }
        const exam = OutImport.exam(get(r, 'exam')); if (exam == null) { skipped.push({ row, reason: `${no3}：方法「${get(r, 'exam')}」が分かりません（総合型・指定校・AO・公募型・一般）` }); return; }
        const level = OutImport.level(get(r, 'level'), school); if (!level) { skipped.push({ row, reason: `${no3}：校種が分かりません（専門・短大・四大など）` }); return; }
        const status = OutImport.status(get(r, 'status')); if (!status) { skipped.push({ row, reason: `${no3}：状態は「決定」か「活動中」` }); return; }
        items.push({ no3, dest: { status, level, exam, school, faculty: get(r, 'faculty'), dept: get(r, 'dept'), major: get(r, 'major'), remarks: get(r, 'remarks') } });
      });
      return { items, skipped, info: `進学 ${items.length} 人（${OC.LEVELS.map(([k, n]) => [n, items.filter(x => x.dest.level === k).length]).filter(x => x[1]).map(x => x.join(' ')).join('／')}）` };
    },
    apply(items) { return OutImport.apply(items, '進学'); },
    template() {
      const head = ['番号', '方法', '校種', '校名', '学部', '学科', '専攻・専修・コース等', '備考', '状態', '氏名(参考)'];
      const rows = Outcomes.list().filter(x => x.d.type === '進学' || x.s.course === '進学').map(({ s }) => {
        const d = s.dest && s.dest.type === '進学' ? s.dest : {};
        return [s.no3, d.exam || '', { univ: '四大', junior: '短大', senshu: '専門' }[d.level] || OC.levelName(d.level), d.school || '', d.faculty || '', d.dept || '', d.major || '', d.remarks || '', d.status || '', s.name || ''];
      });
      Excel.downloadCsv('取り込み用_進路決定_進学.csv', [head, ...rows]);
    },
  },

  outShushoku: {
    label: '進路決定：就職',
    desc: '就職の進路先。列：番号（4桁）・種別（学校斡旋／斡旋外／公務。空欄は学校斡旋）・会社名・正式な会社名・業種（記号A〜Tまたは名前）・職業分類（記号A〜Oまたは名前）・職種・状態（決定／活動中。空欄は決定）。学校斡旋で内定した求人は自動で入るので、斡旋外・公務の人に使うと便利です。',
    detect: rows => Excel.findHeader(rows, [/^会社名$/]) >= 0 && Excel.findHeader(rows, [/^(番号|学籍|4桁番号)$/]) >= 0,
    parse(rows) {
      const hi = Excel.findHeader(rows, [/^会社名$/]);
      const h = rows[hi].map(c => Excel.norm(c));
      const c = { no3: Excel.col(h, [/^4?桁?番号$/, ...NO3_PATTERNS]), kind: Excel.col(h, [/^(種別|区分)$/]), company: Excel.col(h, [/^会社名$/]), full: Excel.col(h, [/^正式/]),
        ind: Excel.col(h, [/^業種/]), occ: Excel.col(h, [/^職業分類/]), jobTitle: Excel.col(h, [/^職種$/]), status: Excel.col(h, [/^(状態|状況)$/]) };
      if (c.no3 < 0) throw new Error('「番号」の列が見つかりません。');
      const get = (r, k) => c[k] >= 0 ? String(r[c[k]] ?? '').trim() : '';
      const items = [], skipped = [];
      rows.slice(hi + 1).forEach((r, i) => {
        if (!r.some(x => x != null && String(x).trim() !== '')) return;
        const no3 = OutImport.rowNo(r, c, hi, i, skipped); if (!no3) return;
        const row = hi + i + 2, company = get(r, 'company');
        if (!company) { skipped.push({ row, reason: `${no3}：会社名が空欄` }); return; }
        const jobKind = OutImport.kind(get(r, 'kind')); if (!jobKind) { skipped.push({ row, reason: `${no3}：種別「${get(r, 'kind')}」が分かりません（学校斡旋・斡旋外・公務）` }); return; }
        const ind = OutImport.letter(get(r, 'ind'), OC.IND_NAMES); if (ind == null) { skipped.push({ row, reason: `${no3}：業種「${get(r, 'ind')}」が分かりません（記号A〜Tまたは名前）` }); return; }
        const occ = OutImport.letter(get(r, 'occ'), OC.OCC_SHORT); if (occ == null) { skipped.push({ row, reason: `${no3}：職業分類「${get(r, 'occ')}」が分かりません（記号A〜Oまたは名前）` }); return; }
        const status = OutImport.status(get(r, 'status')); if (!status) { skipped.push({ row, reason: `${no3}：状態は「決定」か「活動中」` }); return; }
        items.push({ no3, dest: { status, jobKind, company, companyFull: get(r, 'full'), ind, occ, jobTitle: get(r, 'jobTitle') } });
      });
      return { items, skipped, info: `就職 ${items.length} 人（${OC.JOBKINDS.map(k => [k, items.filter(x => x.dest.jobKind === k).length]).filter(x => x[1]).map(x => x.join(' ')).join('／')}）` };
    },
    apply(items) { return OutImport.apply(items, '就職'); },
    template() {
      const head = ['番号', '種別', '会社名', '正式な会社名', '業種', '職業分類', '職種', '状態', '氏名(参考)'];
      const rows = Outcomes.list().filter(x => x.d.type === '就職' || x.s.course === '就職').map(({ s }) => {
        const d = s.dest && s.dest.type === '就職' ? s.dest : {};
        return [s.no3, d.jobKind || '', d.company || '', d.companyFull || '', d.ind || '', d.occ || '', d.jobTitle || '', d.status || '', s.name || ''];
      });
      Excel.downloadCsv('取り込み用_進路決定_就職.csv', [head, ...rows]);
    },
  },

  special: {
    label: '特別活動・模試（入力用テンプレート）',
    desc: '「生徒・成績」画面で出力した入力用テンプレートを取り込みます。〇・1・あり を「該当」とみなします。',
    detect: rows => Excel.findHeader(rows, [/謹慎あり/]) >= 0,
    parse(rows) {
      const hi = Excel.findHeader(rows, [/部活/, /模試/]);
      if (hi < 0) throw new Error('「部活」「模試」の列が見つかりません。入力用テンプレートを使ってください。');
      const h = rows[hi].map(c => Excel.norm(c));
      // 01ファイルのポイント計算シート（謹慎なし＝0.1 などの値）は意味が逆になるので受け付けない
      if (h.some(x => /ポイント|P$/.test(x))) throw new Error('ポイント計算済みのシートです（値が「加算ポイント」のため、そのまま取り込むと謹慎の意味が逆になります）。「特別活動・模試の入力用Excel」を出力して使ってください。');
      const c = {
        no3: Excel.col(h, NO3_PATTERNS), disc3: Excel.col(h, [/^3年.*謹慎あり/]), disc12: Excel.col(h, [/^1.*2年.*謹慎あり/]),
        club3: Excel.col(h, [/部活/]), captain: Excel.col(h, [/部長/]), council: Excel.col(h, [/生徒会/]),
        mogi: Excel.col(h, [/模試/]), disability: Excel.col(h, [/障害|手帳/]), group: Excel.col(h, [/グループ|^G$/]),
      };
      if (c.no3 < 0) throw new Error('「番号」の列が見つかりません。');
      const items = [], skipped = [];
      rows.slice(hi + 1).forEach((r, i) => {
        const no3 = studentNo(r[c.no3]);
        if (!no3) { const why = badStudentNo(r[c.no3]); if (why) skipped.push({ row: hi + i + 2, reason: why }); return; }
        if (!Students.byNo(no3)) { skipped.push({ row: hi + i + 2, reason: `${no3}：名簿にない番号` }); return; }
        const it = { no3 };
        ['disc3', 'disc12', 'club3', 'captain', 'disability'].forEach(k => { if (c[k] >= 0) it[k] = Excel.truthy(r[c[k]]); });
        if (c.council >= 0) it.council = num(r[c.council]) || 0;
        if (c.mogi >= 0) it.mogi = num(r[c.mogi]);
        if (c.group >= 0) it.group = String(r[c.group] ?? '').trim();
        items.push(it);
      });
      return { items, skipped, info: `列：${Object.entries(c).filter(([k, v]) => k !== 'no3' && v >= 0).length} 項目を認識` };
    },
    apply(items) {
      let updated = 0;
      for (const it of items) {
        const s = Students.byNo(it.no3);
        if (!s) continue;
        Object.keys(it).forEach(k => { if (k !== 'no3') s[k] = it[k]; });
        updated++;
      }
      return { added: 0, updated };
    },
    /** 入力用テンプレート（現在の値入り） */
    template() {
      const list = Store.data.students.filter(s => Students.isJobSeeker(s));
      const src = list.length ? list : Store.data.students;
      const mark = v => v ? '〇' : '';
      const rows = [['番号', '氏名', '3年謹慎あり', '1・2年謹慎あり', '3年部活在籍', '部長', '生徒会(期数)', '模試順位', '障害者手帳等', '見学グループ', ''],
        ...src.sort((a, b) => a.no3.localeCompare(b.no3)).map(s => [Number(s.no3), s.name, mark(s.disc3), mark(s.disc12), mark(s.club3), mark(s.captain), s.council || '', s.mogi ?? '', mark(s.disability), s.group || ''])];
      rows[0][10] = '※該当に「〇」。謹慎は「あり」の生徒だけ〇（〇でない生徒に加算されます）';
      Excel.download(`特別活動・模試_入力用_R${reiwa(Store.data.year)}.xlsx`, [
        { name: '入力', rows, widths: [8, 16, 11, 13, 11, 6, 11, 9, 11, 11, 40] },
        { name: '説明', widths: [110], rows: [
          ['【特別活動・模試】の入力のしかた'],
          ['・「入力」シートには、就職希望者の番号・氏名と、いま入っている内容が出ています。該当する欄を入力して、取り込み直します。'],
          ['・謹慎：「3年謹慎あり」「1・2年謹慎あり」は、特別指導（家庭謹慎・学校謹慎以上）を受けた生徒にだけ〇を付けます。〇のない生徒に、謹慎なしの加算がつきます。'],
          ['・部活：「3年部活在籍」は、規定の条件（3年次の新規登録でない、など）を満たす生徒に〇。「部長」は部長経験のある生徒に〇。'],
          ['・生徒会：役員を務めた期数を数字で入力します（1期ごとに加算、上限あり）。'],
          ['・模試順位：校内模試の順位（数字）。同点のときの順位決定だけに使います。'],
          ['・障害者手帳等：ハローワーク様式13の（ ）内数（障害者数）に数える生徒に〇。見学グループ：職場見学のグループ番号。'],
        ] },
      ]);
    },
  },

  /** Handy進路指導室「求人票一覧CSV」。見出し名で列を見つける（列の順番・増減に強い） */
  handy: {
    target: 'jobs',
    label: 'Handy進路指導室の求人票CSV',
    desc: 'Handy進路指導室の「求人票一覧ダウンロード（CSV）」をそのまま取り込みます。求人番号で照合し、同じ求人は上書き（空欄の項目では上書きしません。送付先の変更や区分は残ります）。',
    detect: rows => Excel.findHeader(rows, [/^(受付安定所|事業所番号|求人年度)$/]) >= 0 && Excel.findHeader(rows, [/^事業所名$/]) >= 0,
    map: {
      jobNumber: [/^求人番号$/], office: [/^受付安定所$/], receiptNo: [/^管理番号$/],
      company: [/^事業所名$/], kana: [/^事業所名(カナ|\(カナ\))$/], zip: [/^郵便番号\(所在地\)$/], address: [/^住所\(所在地\)$/],
      employees: [/^従業員数\(企業全体\)$/], capital: [/^資本金/], business: [/^事業内容$/],
      employment: [/^雇用形態$/], jobTitle: [/^職種$/], workAddress: [/^住所\(就業場所\)$/], workplace: [/^就業場所住所\(市区町村\)$/],
      salary: [/^基本給$/], holidays: [/^年間休日/], industryCode: [/^産業分類$/], occ5: [/^職業分類\(5桁\)$/], occ3: [/^職業分類\(3桁\)$/],
      dept: [/^課係名.*担当者/], contact: [/^氏名\(担当者\)$/], tel: [/^電話番号\(担当者\)$/],
      open1: [/^求人数\(通勤\)$/], open2: [/^求人数\(住込\)$/], open3: [/^求人数\(不問\)$/],
      visitOk: [/^職場見学の受(け)?入(れ)?$/], visitInfo: [/^職場見学の日程$/],
    },
    parse(rows) {
      const hi = Excel.headerOr0(rows, [/^事業所名$/]);
      const raw = rows[hi];
      const h = raw.map(c => Excel.norm(c));
      const c = {};
      const ov = Importer.colOverride || {};   // 取り込み画面で指定した列（-1＝使わない）
      for (const [k, ps] of Object.entries(this.map)) c[k] = ov[k] != null ? ov[k] : Excel.col(h, ps);
      if (c.company < 0) throw new Error('「事業所名」の列が見つかりません。');
      const used = new Set(Object.values(c).filter(v => v >= 0));
      const unknown = raw.map((x, i) => [x, i]).filter(([x, i]) => x != null && String(x).trim() && !used.has(i)).map(([x]) => String(x).replace(/\s+/g, ''));
      const items = [], skipped = [];
      const pref = Store.data.settings.homePref;
      rows.slice(hi + 1).forEach((r, i) => {
        const g = k => (c[k] >= 0 && r[c[k]] != null) ? String(r[c[k]]).replace(/\r?\n/g, ' ').trim() : '';
        const company = g('company');
        if (!company) { if (r.some(v => v != null && String(v).trim())) skipped.push({ row: hi + i + 2, reason: '事業所名なし' }); return; }
        const it = {
          company, kana: g('kana'), zip: g('zip'), address: g('address'), business: g('business'), employment: g('employment'), jobTitle: g('jobTitle'),
          jobNumber: g('jobNumber'), office: g('office'), workplace: g('workplace'), industryCode: g('industryCode'),
          occupationCode: g('occ5') || g('occ3'), dept: g('dept'), contact: g('contact'), tel: g('tel'),
          visitOk: g('visitOk'), visitInfo: g('visitInfo'),
          employees: num(g('employees')), capital: num(g('capital')), salary: num(g('salary')), holidays: num(g('holidays')),
        };
        const rc = digits(g('receiptNo'));
        if (rc) it.receiptNo = rc;
        const opens = ['open1', 'open2', 'open3'].map(k => num(g(k))).filter(v => v != null);
        it.openings = opens.length ? opens.reduce((a, b) => a + b, 0) : null;
        // 就業場所が本校の県外か（住所の都道府県で判定。都道府県が書かれていない、または本校の県が未設定なら県内）
        const m = g('workAddress').match(/^(北海道|東京都|(?:京都|大阪)府|.{2,3}?県)/);
        if (PREFS[Number(pref)]) it.workArea = m && !m[1].startsWith(PREFS[Number(pref)]) ? '県外' : '県内';   // 本校の県が未設定なら判定しない
        items.push(it);
      });
      const nrec = Object.values(c).filter(v => v >= 0).length;
      const noRc = items.filter(x => !x.receiptNo).length;
      return { items, skipped, info: `${PREFS[Number(pref)] ? '' : '<注意> 「設定」の本校の都道府県番号が未入力のため、県内・県外は判定していません。'}認識した列 ${nrec} ／ ${Object.keys(this.map).length}${noRc ? `。<注意> 管理番号が空の求人 ${noRc} 件（選考会議で下4桁を使うには、取り込み後に受付番号の入力が必要です）` : ''}${unknown.length ? `。使わない列 ${unknown.length} 個：${unknown.slice(0, 10).join('、')}${unknown.length > 10 ? ' …' : ''}` : ''}` };
    },
    /** 取り込み用の様式：Handy の「求人票一覧ダウンロード（CSV）」と同じ見出し（70項目：説明資料の「読み取り項目」の一覧） */
    template() {
      const head = ['求人年度', '求人番号', '受付安定所', '事業所番号', 'インターネットへの公開', '事業所名 カナ', '事業所名', '郵便番号（所在地）', '住所（所在地）', 'アクセス（所在地）', '代表者名', '法人番号', 'ホームページ', '従業員数（企業全体）', '従業員数（就業場所）', '設立', '資本金', '事業内容', '会社の特長', '雇用形態', '職種', '仕事の内容', '郵便番号（就業場所）', '住所（就業場所）', 'アクセス（就業場所）', '求人数（通勤）', '求人数（住込）', '求人数（不問）', '必要な知識・技能等', '転勤の可能性', '入居可能住宅（単身用）', '入居可能住宅（世帯用）', '基本給', '月給（a+b+c）', '賞与有無（新卒）', '休日等', '年間休日数', '複数応募の受け入れ', '複数応募の日程', '職場見学の受け入れ', '職場見学の日程', '課係名・役職名（担当者）', '氏名（担当者）', '電話番号（担当者）', 'FAX（担当者）', 'Eメール（担当者）', '補足事項', '特記事項', '産業分類', '職業分類（3桁）', '職業分類（5桁）', '就業場所住所（市区町村）', '管理番号', '対象学科', 'エリア', '卒業生の入社実績', 'その他分類', '来校の有無', '二次募集の有無', '備考', '申し送り事項', '公開日時', '最終更新日時', '元ファイル名', '職業分類（ハローワーク）大分類', '職業分類（ハローワーク）中分類', '職業分類（ハローワーク）小分類', '職業分類（Handy）大分類', '職業分類（Handy）中分類', 'お気に入り登録数'];
      const row = o => head.map(h => o[h] ?? '');
      const ex = [
        row({ '求人年度': 2027, '求人番号': '23110-10001', '受付安定所': '刈谷', '事業所番号': '2313-000001-1', 'インターネットへの公開': '可', '事業所名 カナ': 'テスト', '事業所名': '（例）テスト株式会社　本社工場', '郵便番号（所在地）': '480-0001', '住所（所在地）': '愛知県〇〇市△△町1-2', '従業員数（企業全体）': 250, '資本金': 5000, '事業内容': '自動車部品の製造', '雇用形態': '正社員', '職種': '製造スタッフ', '仕事の内容': '部品の組立・検査', '住所（就業場所）': '愛知県江南市', '求人数（通勤）': 2, '基本給': 210000, '年間休日数': 120, '職場見学の受け入れ': '可', '職場見学の日程': '8月中旬', '課係名・役職名（担当者）': '総務課', '氏名（担当者）': '担当 〇〇', '電話番号（担当者）': '0587-00-0000', '産業分類': '311', '職業分類（3桁）': '720', '職業分類（5桁）': '72-01', '就業場所住所（市区町村）': '江南市', '管理番号': '07010001', '対象学科': '全学科' }),
        row({ '求人年度': 2027, '求人番号': '13040-20002', '受付安定所': '飯田橋', '事業所名': '（例）サンプル商事　株式会社', '事業所名 カナ': 'サンプル', '郵便番号（所在地）': '100-0001', '住所（所在地）': '東京都千代田区〇〇1-1', '従業員数（企業全体）': 40, '雇用形態': '正社員', '職種': '営業事務', '住所（就業場所）': '東京都千代田区', '求人数（通勤）': 1, '基本給': 190000, '年間休日数': 105, '産業分類': '521', '職業分類（3桁）': '351', '就業場所住所（市区町村）': '千代田区', '管理番号': '' }),
      ];
      Excel.template('取り込み用_求人票（Handyの形式）.xlsx', head, ex, [
        '【求人票（Handyの形式）】のつかいかた',
        '・Handy進路指導室の「求人票一覧ダウンロード（CSV）」と同じ見出し（70項目）です。Handy から出した CSV は、この様式に直さなくても、そのまま「Excel から取り込む」で取り込めます。',
        '・この様式は、①Handy の CSV が手元にないときの手入力用、②CSV の列の見本、として使ってください。「記入例」シートはダミーです。',
        '・見出しは、Handy の説明資料（読み取り項目の一覧）にある項目名です。Handy 側の項目が増減したときは、見出しの文字が一致する列だけが読み取られ、取り込み画面に「使わない列」が出ます。',
        '・取り込みに使う列：求人番号／受付安定所／管理番号／事業所名／事業所名 カナ／郵便番号・住所（所在地）／従業員数（企業全体）／資本金／事業内容／雇用形態／職種／住所（就業場所）／就業場所住所（市区町村）／求人数（通勤・住込・不問の合計）／基本給／年間休日数／産業分類／職業分類（5桁があれば5桁、なければ3桁）／課係名・役職名／氏名／電話番号（担当者）／職場見学の受け入れ・日程',
        '・「管理番号」は、学校の受付番号にあたります。選考会議では、この下4桁で求人を指定します。空欄だと下4桁が空になるので、取り込んだあとに求人票で入力してください。',
        '・同じ求人番号の求人は、取り込み直すと更新されます（空欄の項目では上書きしません。送付先の変更や区分は残ります）。',
        '・指名求人・事前選考など、Handy にない求人は、［求人票］画面で登録するか、「現行の形式」の様式で取り込んでください。',
      ], [7, 14, 9, 13, 8, 14, 30, 10, 28, 12, 8, 12, 12, 10, 10, 8, 8, 20, 20, 10, 24, 20, 10, 24, 20, 8, 8, 8, 16, 8, 10, 10, 9, 9, 8, 14, 8, 8, 12, 9, 12, 16, 14, 14, 12, 16, 16, 16, 8, 8, 10, 14, 10, 8, 10, 12, 8, 8, 8, 16, 16, 16, 16, 12, 10, 10, 10, 10, 10, 8]);
    },
    apply(items) {
      let added = 0, updated = 0;
      for (const it of items) {
        const hit = jobMatch(it, true);
        if (hit) {
          for (const [k, v] of Object.entries(it)) if (v !== '' && v != null) hit[k] = v;   // 空欄では上書きしない
          updated++;
        } else {
          const n = Object.assign({ id: uid(), kind: '一般' }, it, Jobs.batchTag());
          Object.keys(n).forEach(k => { if (n[k] === '' || n[k] == null) delete n[k]; });
          Store.data.jobs.push(n);
          added++;
        }
      }
      return { added, updated };
    },
  },

  jobs: {
    target: 'jobs',
    label: '求人票（現行の求人票データ形式）',
    desc: '受付番号・事業所名・職種…の見出しを持つ表。受付番号（なければ事業所名＋職種）で照合し、上書きします。',
    detect: rows => Excel.findHeader(rows, [/^事業所名$/]) >= 0,
    map: {
      receiptNo: [/^受付番号$/], employment: [/^雇用形態/], company: [/^事業所名$/], kana: [/^フリガナ/], zip: [/^〒$|^郵便番号/],
      address: [/^所在地$/], employees: [/^全従業員数/], jobTitle: [/^職種$/], capital: [/^資本金/], business: [/^事業内容/],
      workplace: [/^就業場所$/], salary: [/^基本給/], industryCode: [/^産業分類$/], occupationCode: [/^職業分類$/],
      holidays: [/^年間休日/], jobNumber: [/^求人番号$/], dept: [/^応募.*部署/], contact: [/^応募.*担当者/], tel: [/^(電話|TEL)/i],
      openings: [/^求人数/], inPref: [/^県内/], outPref: [/^県外\(就業場所\)|^県外（就業場所）/], kind: [/^区分/],
    },
    parse(rows) {
      const hi = Excel.headerOr0(rows, [/^事業所名$/]);
      const h = rows[hi].map(c => Excel.norm(c));
      const c = {};
      const ov = Importer.colOverride || {};   // 取り込み画面で指定した列（-1＝使わない）
      for (const [k, ps] of Object.entries(this.map)) c[k] = ov[k] != null ? ov[k] : Excel.col(h, ps);
      const items = [], skipped = [];
      const numeric = ['employees', 'capital', 'salary', 'holidays', 'openings'];
      rows.slice(hi + 1).forEach((r, i) => {
        const company = c.company >= 0 ? String(r[c.company] ?? '').trim() : '';
        if (!company) return;
        const it = {};
        for (const k of Object.keys(this.map)) {
          if (c[k] < 0 || k === 'inPref' || k === 'outPref') continue;
          const v = r[c[k]];
          it[k] = numeric.includes(k) ? num(v) : (v == null ? '' : String(v).replace(/\r?\n/g, ' ').trim());
        }
        // 現行形式：県内／県外（就業場所）の列に求人数が入っている
        const inN = c.inPref >= 0 ? num(r[c.inPref]) : null, outN = c.outPref >= 0 ? num(r[c.outPref]) : null;
        if (c.inPref >= 0 || c.outPref >= 0) it.workArea = outN && !inN ? '県外' : '県内';   // 列があるときだけ
        if (it.openings == null && (inN || outN)) it.openings = inN || outN;
        if (it.receiptNo) it.receiptNo = digits(it.receiptNo).padStart(8, '0');
        if ('kind' in it && !['一般', '指名', '事前選考'].includes(it.kind)) delete it.kind;   // 区分の列があり、正しい値のときだけ
        items.push(it);
      });
      return { items, skipped, info: `認識した列：${Object.values(c).filter(v => v >= 0).length} ／ ${Object.keys(this.map).length}` };
    },
    /** 取り込み用の様式：これまでの「00_求人票データ」と同じ見出し（30列）＋追加欄（区分・電話番号） */
    template() {
      const head = ['受付番号', '受付下４桁', '雇用\n形態', '事業所名', 'フリガナ', '〒', '所在地', '全従業員数', '職種', '資本金（万円）', '事業内容', '就業場所', '基本給', '産業分類', '職業分類', '年間休日',
        '求人番号', '県内（就業場所）', '県外（就業場所）', '管内（職安）', '管外（職安）', '県外数', '応募・選考担当部署', '応募・選考担当者', '性別記号', '受理・受付', '県番', '産業', '職業', '従業員の\n規模\n1～6',
        '区分（追加）', '電話番号（追加）'];
      const ex = [
        ['07010001', 1, '正社員', '（例）テスト株式会社　本社工場', 'テスト', '480-0001', '〇〇県〇〇市△△町1-2', 250, '製造スタッフ', 5000, '自動車部品の製造', '〇〇市', 210000, '311', '72-01', 120,
          '23110-10001', 2, '', 2, '', '', '総務課', '担当 〇〇', 4, '刈谷', 231, 'Ｅ', 'Ｌ', 3, '一般', '000-0000-0000'],
        ['07010002', 2, '正社員', '（例）サンプル商事　株式会社', 'サンプル', '100-0001', '東京都千代田区〇〇1-1', 40, '営業事務', 1000, '食品の卸売', '東京都千代田区', 190000, '521', '35-01', 105,
          '13040-20002', '', 1, '', '', 1, '人事部', '', 4, '飯田橋', 13, 'Ｉ', 'Ｆ', 2, '一般', '03-0000-0000'],
        ['', '', '正社員', '（例）指名の会社　株式会社', 'シメイ', '000-0000', '〇〇県〇〇市〇〇', 30, '事務', 1000, '建設業', '〇〇市', 180000, '', '', '', '', 1, '', '', '', '', '', '', '', '', '', '', '', '', '指名', ''],
      ];
      Excel.template('取り込み用_求人票（現行の形式）.xlsx', head, ex, [
        '【求人票（現行の形式）】の入力のしかた',
        '・これまで使っていた「00_求人票データ」と同じ見出しです。今ある表（見出しの行から下）を、そのまま「入力」シートに貼り付けて取り込めます。「記入例」シートはダミーです。',
        '・取り込みに使う列：受付番号／雇用形態／事業所名／フリガナ／〒／所在地／全従業員数／職種／資本金／事業内容／就業場所／基本給／産業分類／職業分類／年間休日／求人番号／県内・県外（就業場所）／応募・選考担当部署／応募・選考担当者',
        '・受付下４桁・性別記号・受理・受付・県番・産業・職業・従業員の規模・管内／管外（職安）・県外数は、このサイトが番号から自動で判定するので、空欄でも構いません（貼り付けてあっても害はありません）。',
        '・「県内（就業場所）」「県外（就業場所）」の数字は、その地域での求人数です（1なら1人）。県外にだけ数字があると、就業場所は県外になります。',
        '・追加欄（右端の2列）：「区分」は 一般／指名／事前選考（空欄は一般）。指名求人・事前選考は、受付番号や求人番号がなくても登録できます。「電話番号」は職場見学の電話連絡で使います。現行の様式にはない欄なので、使わなければ消して構いません。',
        '・受付番号は8桁（例：07010001）。選考会議では下4桁（先頭の0を除いた数字）で指定します。',
        '・同じ受付番号の求人は上書きされます。受付番号がないときは、事業所名＋職種が同じものを上書きします。',
        '・見出しの文字は変えないでください（改行の有無は問いません）。列の順番は入れ替えても構いません。',
        '・Handy進路指導室のCSVを使うときは、もう一方の様式「Handyの形式」を使うか、CSVをそのまま取り込んでください。',
      ], [10, 7, 8, 30, 14, 10, 28, 9, 18, 9, 22, 14, 9, 8, 8, 8, 14, 8, 8, 8, 8, 7, 16, 16, 7, 9, 6, 6, 6, 8, 10, 14]);
    },
    apply(items) {
      let added = 0, updated = 0;
      for (const it of items) {
        const hit = jobMatch(it, false);
        const filled = Object.fromEntries(Object.entries(it).filter(([, v]) => v !== '' && v != null));
        if (hit) { Object.assign(hit, filled); updated++; }        // 空欄のセルでは上書きしない（手で直した値を残す）
        else { Store.data.jobs.push(Object.assign({ id: uid(), kind: '一般', workArea: '県内' }, filled, Jobs.batchTag())); added++; }
      }
      return { added, updated };
    },
  },
};

/* ============================================================
   取り込みダイアログ
   ============================================================ */
const Importer = {
  /** 取り込み用様式のダウンロード一覧 */
  templates(only) {
    const all = [['grades', '名簿・評定・出欠', '最初に取り込みます。1〜3年の評定、欠席・遅刻・早退。'],
      ['course', '進路希望調査', '就職・進学の別と受験方法。名簿の取り込み後に出力すると番号・氏名入りで出ます。'],
      ['special', '特別活動・模試', '謹慎・部活・部長・生徒会・模試順位・見学グループ。名簿の取り込み後に出力します。'],
      ['outShingaku', '進路決定：進学（CSV）', '番号・方法（総合型／指定校／AO／公募型）・校種（専門／短大／四大）・校名・学部・学科・専攻・専修・コース等・備考・状態。進学希望の生徒が入った状態で出ます。'],
      ['outShushoku', '進路決定：就職（CSV）', '番号・種別・会社名・業種・職業分類・職種・状態。就職希望の生徒が入った状態で出ます。斡旋外・公務の入力に便利です。'],
      ['jobs', '求人票：現行の形式', 'これまでの「00_求人票データ」と同じ見出し（30列）。今ある表を、そのまま貼り付けて取り込めます。指名求人・事前選考を登録するための「区分」欄も付いています。'],
      ['handy', '求人票：Handyの形式', 'Handy進路指導室の「求人票一覧ダウンロード（CSV）」と同じ見出し（70項目）。CSV はそのまま取り込めるので、この様式は見本・手入力用です。']];
    const list = only ? all.filter(x => only.includes(x[0])) : all;
    const body = document.createElement('div');
    body.innerHTML = `<p class="sub">Excel（または CSV）に入力して取り込みます。Excel の様式には、入力用・記入例・説明のシートがあります。CSV の様式は、見出し行（と名簿の生徒）だけが入っています。</p>
      <div class="tpl-list">${list.map(([k, n, d]) => `<div class="tpl-item"><div><b>${n}</b><div class="sub">${esc(d)}</div></div>
        <button class="btn btn-sm btn-primary" data-tpl="${k}" ${k === 'special' && !Store.data.students.length ? 'disabled title="先に名簿を取り込んでください"' : ''}>ダウンロード</button></div>`).join('')}</div>`;
    body.addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (b && Excel.ok()) ImportTypes[b.dataset.tpl].template(); });
    return UI.modal({ title: '取り込み用Excelの様式', body, buttons: [{ label: '閉じる', value: null }] });
  },

  /** preloaded＝あらかじめ読み込んだ workbook、file＝その元の File（取り込み済みの記録用） */
  async run(preferType, preloaded, file) {
    let wb = preloaded;
    if (!wb) {
      try { wb = await Excel.pickWorkbook(); } catch (e) { UI.toast(e.message, 'error'); return false; }
    }
    if (!wb) return false;
    const sheets = wb.SheetNames.map(n => {
      const rows = Excel.rows(wb.Sheets[n]);
      const type = Object.keys(ImportTypes).find(t => ImportTypes[t].detect(rows)) || '';
      return { n, rows, type };
    });
    const first = sheets.find(s => s.type === preferType) || sheets.find(s => s.type) || sheets[0];

    const body = document.createElement('div');
    body.innerHTML = `
      <p class="sub">ファイル：${esc(wb._fileName)}${wb._encoding ? `（文字コード：${wb._encoding}）` : ''}</p>
      <div class="grid">
        <div class="field"><label class="label">シート</label><select id="impSheet">${sheets.map(s =>
          `<option value="${esc(s.n)}" ${s === first ? 'selected' : ''}>${esc(s.n)}${s.type ? `（${ImportTypes[s.type].label}）` : ''}</option>`).join('')}</select></div>
        <div class="field"><label class="label">取り込む内容</label><select id="impType">${Object.entries(ImportTypes).map(([k, t]) =>
          `<option value="${k}">${esc(t.label)}</option>`).join('')}</select></div>
      </div>
      <p class="help">入力用の様式が必要なときは、<button class="link-btn" id="impTpl">取り込み用Excelの様式をダウンロード</button>してください。</p>
      <div id="impPreview" class="imp-preview"></div>`;
    let parsed = null;
    Importer.colOverride = {};
    /** 事前チェック：上書きされる項目の一覧 */
    const diffHtml = (type, items) => {
      const T = ImportTypes[type];
      if (T.target === 'jobs') {
        const { changes } = jobsDiff(items, type === 'handy');
        if (!changes.length) return '<p class="help">既にある求人票で、値が変わる項目はありません。</p>';
        const byField = {};
        changes.forEach(c => { byField[c.k] = (byField[c.k] || 0) + 1; });
        return `<details class="imp-diff"><summary>既にある求人票で値が変わる項目：${changes.length} か所（${Object.entries(byField).map(([k, n]) => esc(COL_LABELS[k] || k) + ' ' + n).join('、')}）</summary>
          <div class="table-wrap"><table class="tbl tbl-compact"><thead><tr><th>事業所</th><th>項目</th><th>今の値</th><th>取り込み後</th></tr></thead><tbody>
          ${changes.slice(0, 300).map(c => `<tr><td>${esc(c.job.company)}</td><td>${esc(COL_LABELS[c.k] || c.k)}</td><td class="sub">${esc(c.from) || '（空）'}</td><td><b>${esc(c.to)}</b></td></tr>`).join('')}
          </tbody></table></div>${changes.length > 300 ? '<p class="help">先頭の300か所だけ表示しています。</p>' : ''}</details>`;
      }
      if (type === 'selection') {
        let chg = 0, lost = 0;
        for (const it of items) {
          const s = Students.byNo(it.no3); if (!s) continue;
          const prefs = Apps.prefs(s.id);
          for (const sl of it.slots) {
            if (sl.special) continue;
            const cur = prefs[sl.pref]; const job = matchSelectionJob(sl);
            if (cur && (!job || cur.jobId !== job.id)) { chg++; if (Apps.hasRecord(Object.assign({}, cur, { confirmed: false }))) lost++; }
          }
        }
        return chg ? `<div class="notice notice-warn">今と違う希望が ${chg} 件あり、上書きします。${lost ? `<b>そのうち ${lost} 件は職場見学・応募・合否などの記録があり、記録は消えます。</b>` : ''}（取り込んだあと「取り消す」で戻せます）</div>` : '';
      }
      return '';
    };
    let mapOpen = false;
    /** 列の対応（求人票の取り込みだけ）：自動で見つけた列を表示し、違えば選び直せる */
    const mapHtml = (rows, T) => {
      const hi = Excel.headerOr0(rows, [/^事業所名$/]);
      const head = rows[hi] || [];
      const h = head.map(c => Excel.norm(c));
      const ov = Importer.colOverride;
      const opts = cur => `<option value="-1" ${cur < 0 ? 'selected' : ''}>（使わない）</option>` + head.map((x, i) => x == null || String(x).trim() === '' ? '' : `<option value="${i}" ${cur === i ? 'selected' : ''}>${esc(XLSX.utils.encode_col(i))}列：${esc(String(x).replace(/\s+/g, ' ').slice(0, 24))}</option>`).join('');
      const rowsHtml = Object.entries(T.map).map(([k, ps]) => {
        const cur = ov[k] != null ? ov[k] : Excel.col(h, ps);
        return `<label class="map-row"><span>${esc(COL_LABELS[k] || k)}</span><select data-map="${k}">${opts(cur)}</select></label>`;
      }).join('');
      return `<details class="imp-map" id="impMap" ${mapOpen ? 'open' : ''}><summary>列の対応を確認・変更する（見出しの名前が違うときは、ここで選び直します）</summary>
        <p class="help">見出し行：${hi + 1}行目。項目ごとに、取り込む列を選んでください。</p><div class="map-grid">${rowsHtml}</div></details>`;
    };
    const preview = () => {
      const sh = sheets.find(s => s.n === $('#impSheet', body).value);
      const type = $('#impType', body).value;
      const el = $('#impPreview', body);
      $('.imp-desc', body)?.remove();
      try {
        parsed = ImportTypes[type].parse(sh.rows);
        const isJobs = ImportTypes[type].target === 'jobs';
        const newCount = isJobs ? parsed.items.filter(it => !jobMatch(it, type === 'handy')).length : parsed.items.filter(it => !Students.byNo(it.no3)).length;
        el.innerHTML = `
          <p class="help">${esc(ImportTypes[type].desc)}</p>
          <div class="notice notice-info"><b>${parsed.items.length}</b> 件を読み取りました
          （${isJobs ? '新規' : '新しい生徒'} ${newCount} ${isJobs ? '件' : '人'}／既存の更新 ${parsed.items.length - newCount} ${isJobs ? '件' : '人'}）。
          ${parsed.info ? `<br><span class="sub">${esc(parsed.info)}</span>` : ''}</div>
          ${diffHtml(type, parsed.items)}
          ${parsed.skipped.length ? `<div class="notice notice-warn">読み飛ばし ${parsed.skipped.length} 行：${parsed.skipped.slice(0, 8).map(x => `${x.row}行目（${esc(x.reason)}）`).join('、')}${parsed.skipped.length > 8 ? ' …' : ''}</div>` : ''}`;
      } catch (e) {
        parsed = null;
        el.innerHTML = `<div class="notice notice-warn">${esc(e.message)}<br>シートか「取り込む内容」を選び直してください${ImportTypes[type].map ? '（または下の「列の対応」で列を選んでください）' : ''}。</div>`;
      }
      if (ImportTypes[type].map) {
        el.insertAdjacentHTML('beforeend', mapHtml(sh.rows, ImportTypes[type]));
        const d = $('#impMap', el);
        d.addEventListener('toggle', () => { mapOpen = d.open; });
        $$('[data-map]', d).forEach(s => s.addEventListener('change', () => { Importer.colOverride[s.dataset.map] = Number(s.value); preview(); }));
      }
    };
    const res = await UI.modal({
      title: 'Excel から取り込む', body, wide: true,
      buttons: [{ label: 'キャンセル', value: null }, {
        label: '取り込む', kind: 'primary', value: 'ok',
        onClick: () => { if (!parsed || !parsed.items.length) { UI.toast('取り込めるデータがありません', 'warn'); return false; } },
      }],
      onOpen: root => {
        $('#impType', root).value = first.type || preferType || 'grades';
        $('#impSheet', root).addEventListener('change', () => {
          Importer.colOverride = {};
          const sh = sheets.find(s => s.n === $('#impSheet', root).value);
          if (sh.type) $('#impType', root).value = sh.type;
          preview();
        });
        $('#impType', root).addEventListener('change', () => { Importer.colOverride = {}; preview(); });
        $('#impTpl', root).addEventListener('click', () => {
          const t = ImportTypes[$('#impType', root).value];
          if (t.template) t.template(); else UI.toast('この種類は様式がありません。Handy からダウンロードした CSV をそのまま選んでください');
        });
        preview();
      },
    });
    if (res !== 'ok') { Importer.colOverride = null; return false; }
    const type = $('#impType', body).value;
    Jobs._batch = { impId: uid(), impAt: new Date().toLocaleString('sv-SE').slice(0, 16), impName: (file && file.name) || '' };   // 求人票の取り込みごとの目印（一括削除用）
    // 取り込む前の状態を残す（取り込んだあと「取り消す」で戻せる）
    const snap = clone({ jobs: Store.data.jobs, students: Store.data.students, applications: Store.data.applications, imports: Store.data.imports });
    const r = ImportTypes[type].apply(parsed.items);
    Jobs._batch = null;
    Importer.colOverride = null;
    if (file && typeof Watch !== 'undefined') Watch.mark(file, type);
    Store.changed();
    UI.toastAction(`取り込みました（追加 ${r.added} 件／更新 ${r.updated} 件）`, '取り消す', () => {
      Object.assign(Store.data, snap);
      Store.changed(); UI.refresh();
      UI.toast('取り込みを取り消しました');
    });
    UI.refresh();
    return true;
  },
};
