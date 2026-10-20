'use strict';
/* ============================================================
   帳票：職場見学の依頼文・確認書／送付状／宛名ラベル／座席表／出欠票／一覧
   すべて Print.open() で印刷する（ブラウザ印刷）。個人名は入力データから差し込む。
   ============================================================ */

const zen = v => String(v ?? '').replace(/[0-9]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
function parseISO(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
/** 2026-08-24 → 8月24日（月） */
function fmtMD(iso) { const d = parseISO(iso); return d ? `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）` : ''; }
/** 2026-09-01 → 令和８年９月１日 */
function fmtWareki(iso) { const d = parseISO(iso); return d ? `令和${zen(reiwa(d.getFullYear()))}年${zen(d.getMonth() + 1)}月${zen(d.getDate())}日` : ''; }

const Docs = {
  school() { return Store.data.settings.school; },
  gradYear() { return reiwa(Store.data.year) + 1; },

  /** 求人ごとにまとめた応募のグループ。filter は (application) → boolean */
  jobGroups(filter = a => a.confirmed) {
    const m = new Map();
    for (const a of Store.data.applications) {
      if (!filter(a)) continue;
      const s = Students.byId(a.studentId), job = Jobs.byId(a.jobId);
      if (!s || !job) continue;
      if (!m.has(job.id)) m.set(job.id, { job, apps: [] });
      m.get(job.id).apps.push({ a, s });
    }
    const list = [...m.values()];
    list.forEach(g => g.apps.sort((x, y) => num(x.s.no3) - num(y.s.no3)));
    return list.sort((x, y) => String(x.job.kana || x.job.company).localeCompare(String(y.job.kana || y.job.company), 'ja'));
  },

  /** 宛名の敬称行 */
  addressee(dest) {
    if (dest.contact) return `${dest.dept ? esc(dest.dept) + '　' : ''}${esc(dest.contact)}　様`;
    return dest.dept ? `${esc(dest.dept)}　御中` : '人事採用担当者　様';
  },

  principalMissing() { const s = this.school(); return !s.principal || !s.director; },

  /* ---------- 設定（帳票のレイアウト）に従って文書を組み立てる ---------- */
  /** 文書 key（cover／visitLetter／visitConfirm／label）のレイアウト。未設定なら既定 */
  layout(key) { return (Store.data.settings.docLayout || {})[key] || defaultDocLayout()[key]; },
  /** @page の余白（上 右 下 左）。mm */
  margin(key) { const m = this.layout(key).style.margin; return m.map(v => (num(v) ?? 0) + 'mm').join(' '); },

  visitDateText() {
    const t = (Store.data.settings.docs.visitLetterDate || '').trim();
    return t || `令和${zen(reiwa(Store.data.year))}年８月吉日`;
  },
  sendDateISO() { const d = Store.data.settings.docs.sendDate; return parseISO(d) ? d : todayISO(); },

  /** 文章に差し込む値。{会社名} などの名前 → 文字列 */
  context(key, g) {
    const sc = this.school();
    const job = g.job;
    const dest = Derive.sendTo(job);
    const iso = this.sendDateISO();
    const month = parseISO(iso).getMonth();
    const dates = [...new Set(g.apps.map(x => x.a.visitDate).filter(Boolean))];
    const fw = v => zen(v).replace(/-/g, '－');
    return {
      '日付': key === 'visitLetter' ? this.visitDateText() : fmtWareki(iso),
      '会社名': job.company || '',
      // 既定の「人事採用担当者　様」は、現行の送付状に合わせて字間を空ける（半角の半分＝EN SPACE）
      '宛先': dest.dept || dest.contact ? `${dest.dept ? dest.dept + '　' : ''}${dest.contact ? dest.contact + '　様' : '人事採用担当者　様'}` : [...'人事採用担当者'].join(' ') + '　　様',
      '部署': dest.dept || '', '担当者': dest.contact || '',
      '職種': job.jobTitle || '', '求人番号': job.jobNumber || '',
      '見学日': dates.length === 1 ? fmtMD(dates[0]) : '　　　月　　日（　　）',
      '時候の挨拶': Store.data.settings.greetings[month] || '',
      '卒業年': zen(this.gradYear()),
      '学校名': sc.name || '', '校長名': sc.principal || '', '主事名': sc.director || '',
      '郵便番号': fw(sc.zip || ''), '住所': sc.address || '', '電話': fw(sc.tel || ''), 'FAX': fw(sc.fax || ''),
    };
  },
  /** {名前} を値に置き換える（知らない名前はそのまま残す） */
  fill(text, ctx) { return String(text ?? '').replace(/\{([^{}]+)\}/g, (m, k) => (k in ctx ? ctx[k] : m)); },
  html(text, ctx) { return esc(this.fill(text, ctx)).replace(/\r?\n/g, '<br>'); },

  /** 表の1行ぶんの値 */
  cellValue(field, s, a, g) {
    switch (field) {
      case 'dept': return (Students.dept(s) || {}).name || '';
      case 'name': return s.name || '';
      case 'no': return s.no3 || '';
      case 'gender': return s.gender || '';
      case 'job': return g.job.jobTitle || '';
      case 'jobNumber': return g.job.jobNumber || '';
      case 'company': return g.job.company || '';
      case 'visitDate': return fmtMD(a.visitDate);
      case 'visitTime': return a.visitTime || '';
      default: return '';
    }
  },

  /** 文字列が mm の幅に収まるよう、文字の大きさ（pt）を縮める。全角は1字＝1em、半角は0.55em とみなす */
  fitSize(text, size, mm) {
    const em = [...String(text)].reduce((t, c) => t + (c.charCodeAt(0) < 0x100 || (c >= '｡' && c <= 'ﾟ') ? 0.55 : 1), 0);
    const need = em * size * 0.3528;
    return need > mm && em > 0 ? Math.floor(mm / (em * 0.3528) * 10) / 10 : size;
  },

  /** 表・記入欄の左右の余白（mm）。表の幅は残りいっぱい */
  tableBox(b) {
    const l = num(b.left) || 0, r = num(b.right) || 0;
    return `margin-left:${l}mm;width:calc(100% - ${l + r}mm)`;
  },

  blockHtml(b, ctx, g, base = 11) {
    const n = v => num(v);
    if (b.type === 'space') return `<div style="height:${n(b.height) ?? 5}mm"></div>`;
    if (b.type === 'text') {
      const st = [`text-align:${b.align || 'left'}`];
      let size = n(b.size);
      if (n(b.fit)) size = this.fitSize(this.fill(b.text, ctx).split('\n')[0], size || base, n(b.fit));
      if (size) st.push(`font-size:${size}pt`);
      if (b.bold) st.push('font-weight:700');
      if (n(b.lh)) st.push(`line-height:${n(b.lh)}`);
      const ind = n(b.indent) || 0, left = n(b.left) || 0;
      if (ind < 0) { st.push(`margin-left:${left}mm`, `padding-left:${-ind}em`, `text-indent:${ind}em`); }
      else { st.push(`margin-left:${left}mm`); if (ind) st.push(`text-indent:${ind}em`); }
      if (n(b.right)) st.push(`margin-right:${n(b.right)}mm`);
      if (n(b.before)) st.push(`margin-top:${n(b.before)}mm`);
      st.push(`margin-bottom:${n(b.after) || 0}mm`);
      if (n(b.spacing)) st.push(`letter-spacing:${n(b.spacing)}em`);
      if (b.box) st.push('border:0.2mm solid #000', 'padding:2.8mm 3mm 3.4mm 4.2mm', 'box-sizing:border-box');
      if (n(b.ul)) st.push(`width:${n(b.ul)}mm`, 'border-bottom:0.2mm solid #000', 'box-sizing:border-box');
      if (n(b.height)) {
        // 1行を、決まった高さの欄の真ん中に置く（Excel の行の高さに合わせる用）
        const just = { right: 'flex-end', center: 'center' }[b.align] || 'flex-start';
        return `<div class="dl-text" style="${st.join(';')};height:${n(b.height)}mm;display:flex;align-items:center;justify-content:${just}"><span style="white-space:nowrap">${this.html(b.text, ctx)}</span></div>`;
      }
      let body = this.html(b.text, ctx);
      if (n(b.hang)) body = this.fill(b.text, ctx).split(/\r?\n/).map(t => `<div style="padding-left:${n(b.hang)}em;text-indent:-${n(b.hang)}em">${esc(t)}</div>`).join('');
      return `<div class="dl-text" style="${st.join(';')}">${body}</div>`;
    }
    if (b.type === 'table') {
      const cols = b.columns || [];
      const rows = g.apps.map(({ s, a }) => cols.map(c => this.cellValue(c.field, s, a, g)));
      while (rows.length < (n(b.minRows) || 0)) rows.push(cols.map(() => '\u00a0'));
      const rh = n(b.rowHeight) ? `height:${n(b.rowHeight)}mm;padding-top:0;padding-bottom:0;line-height:1.2;` : '';
      const bs = n(b.bodySize) ? `font-size:${n(b.bodySize)}pt;` : '';
      const th = cols.map(c => `<th style="${rh}${n(c.width) ? `width:${n(c.width)}mm;` : ''}text-align:${b.headerAlign || 'center'}">${esc(c.header)}</th>`).join('');
      const body = rows.map(r => `<tr>${r.map((v, i) => `<td style="${rh}${bs}text-align:${cols[i].align || 'left'}">${esc(v)}</td>`).join('')}</tr>`).join('');
      return `<table class="doc-tbl ${b.look || ''}" style="${this.tableBox(b)};margin-top:${n(b.before) ?? 2}mm;margin-bottom:${n(b.after) ?? 4}mm${b.look ? ';table-layout:fixed' : ''}"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
    }
    if (b.type === 'form') {
      const al = b.labelAlign === 'center' ? 'text-align:center;vertical-align:middle;' : '';
      const rows = (b.rows || []).map(r => `<tr><th style="${al}width:${n(b.labelWidth) ?? 38}mm">${this.html(r.label, ctx)}</th><td style="height:${n(r.height) ?? 16}mm"></td></tr>`).join('');
      return `<table class="doc-tbl" style="${this.tableBox(b)};margin-top:${n(b.before) ?? 4}mm;margin-bottom:${n(b.after) ?? 0}mm"><tbody>${rows}</tbody></table>`;
    }
    return '';
  },

  /** 1枚ぶんの文書（key の設定に従う） */
  renderDoc(key, g) {
    const L = this.layout(key);
    const st = L.style;
    const ctx = this.context(key, g);
    // フォント名の " が style="..." を途切れさせ、文字の大きさ・行の高さが効かなかったので ' に直す
    const font = (DOC_FONTS[st.font] || DOC_FONTS.mincho)[1].replace(/"/g, "'");
    const base = num(st.size) || 11;
    return `<div class="p-page doc" style="font-family:${font};font-size:${base}pt;line-height:${num(st.line) || 1.9}">${(L.blocks || []).map(b => this.blockHtml(b, ctx, g, base)).join('')}</div>`;
  },

  /** 画面のプレビュー・試し刷り用の見本データ（実在の人物ではない） */
  sampleGroup() {
    const mk = (name, no3, gender, date) => ({ s: Object.assign(blankStudent(no3), { name, gender }), a: { visitDate: date, visitTime: '9:00～' } });
    return {
      job: { id: 'sample', company: 'サンプル株式会社　本社工場', jobTitle: '製造スタッフ', jobNumber: '00000-12345', address: '〇〇県サンプル市サンプル町1-2', zip: '480-0001', dept: '総務課', contact: '' },
      apps: [mk('サンプル 一郎', '3101', '男', '2026-08-24'), mk('サンプル 花子', '3305', '女', '2026-08-24')],
    };
  },

  visitLetter(g) { return this.renderDoc('visitLetter', g); },
  visitConfirm(g) { return this.renderDoc('visitConfirm', g); },
  cover(g) { return this.renderDoc('cover', g); },

  printVisitDocs(groups, what = 'both') {
    if (!groups.length) { UI.toast('印刷する求人を選んでください', 'warn'); return; }
    const html = groups.map(g => (what === 'confirm' ? '' : this.visitLetter(g)) + (what === 'letter' ? '' : this.visitConfirm(g))).join('');
    // 余白は依頼文の設定に合わせる（1つの印刷では、用紙の余白をそろえる）
    Print.open({ title: `職場見学依頼文・確認書_${groups.length}社`, html, orientation: 'portrait', margin: this.margin(what === 'confirm' ? 'visitConfirm' : 'visitLetter') });
  },
  printCovers(groups) {
    if (!groups.length) { UI.toast('印刷する求人を選んでください', 'warn'); return; }
    Print.open({ title: `応募書類送付状_${groups.length}社`, html: groups.map(g => this.cover(g)).join(''), orientation: 'portrait', margin: this.margin('cover') });
  },

  /* ---------- 宛名ラベル ---------- */
  /** 職場見学の宛名ラベル。各行を上端からの距離（mm）で置き、住所・事業所名は枠の幅に収まるよう縮める（現行 PDF の配置） */
  labelHtml(g) {
    const d = Derive.sendTo(g.job);
    const L = this.layout('label');
    const f = v => num(v) ?? 0;
    const side = f(L.padSide), ind = f(L.indent), top = f(L.padTop);
    const fit = (txt, size, mm) => (f(mm) > 0 ? this.fitSize(txt, f(size), f(mm)) : f(size));
    const row = (t, left, size, body, css = '') => `<div style="position:absolute;left:${left}mm;top:${t}mm;font-size:${size}pt;line-height:1;white-space:nowrap;${css}">${body}</div>`;
    const to = this.addressee(d);
    return `<div class="lb" style="position:relative;padding:0">
      ${L.showZip !== false && d.zip ? row(top, side + ind, f(L.zipSize), '〒' + esc(d.zip)) : ''}
      ${row(top + f(L.addrTop), side + ind, fit(d.address, L.addrSize, L.fitAddr), esc(d.address))}
      ${row(top + f(L.coTop), side, fit(g.job.company, L.coSize, L.fitCo), esc(g.job.company), L.boldCompany ? 'font-weight:700' : '')}
      ${row(top + f(L.toTop), side + ind, f(L.toSize), to)}</div>`;
  },
  /** レターパックプラス用の宛名ラベル（現行の PDF の配置。1片 100.3×140.8mm に、宛先・差出人・「就職応募書類在中」）。位置は片の左上からの距離（mm） */
  letterLabelHtml(g) {
    const d = Derive.sendTo(g.job), sc = this.school();
    const co = String(g.job.company || '');
    const to = [d.dept, d.contact].filter(Boolean).join('　') || '人事採用担当者';
    const t = String(sc.tel || '').split('-');
    const at = (top, left, size, body, css = '') => `<div style="position:absolute;top:${top}mm;left:${left}mm;font-size:${size}pt;line-height:1;white-space:nowrap;${css}">${body}</div>`;
    const wrap = (top, left, w, h, size, body) => `<div style="position:absolute;top:${top}mm;left:${left}mm;width:${w}mm;height:${h}mm;overflow:hidden;font-size:${size}pt;line-height:1.25">${body}</div>`;
    const line = top => `<div style="position:absolute;left:0;right:0;top:${top}mm;height:0.6mm;background:#000"></div>`;
    const X = 19.8, W = 78.4;
    return `<div class="lb" style="position:relative;padding:0;font-family:var(--font)">
      ${at(2.6, X, 10.3, d.zip ? '〒' + esc(d.zip) : '&nbsp;')}
      ${wrap(11.4, X, W, 26, 11, esc(d.address))}
      ${at(39, X, this.fitSize(co, 13.2, W), esc(co))}
      <div style="position:absolute;top:46.9mm;left:${X}mm;width:${W - 8.7}mm;text-align:right;white-space:nowrap;font-size:${this.fitSize(to, 13.2, W - 8.7)}pt;line-height:1">${esc(to)}</div>
      ${at(47.4, 93.8, 10.3, '様')}
      ${at(56.1, 47.5, 13.2, '(')}${at(56.1, 68.8, 13.2, ')')}
      ${g.job.tel ? `<div style="position:absolute;top:57mm;left:49.2mm;width:19.5mm;text-align:center;font-size:8pt;line-height:1">${esc(g.job.tel)}</div>` : ''}
      ${line(62.5)}
      ${at(64.3, X, 10.3, sc.zip ? '〒' + esc(sc.zip) : '&nbsp;')}
      ${wrap(71.2, X, W, 19, 10.3, esc(sc.address))}
      ${at(91.3, 20, 13.2, esc(sc.name))}
      ${at(98.1, 20, 13.2, esc(sc.dept || '進路指導部'))}
      ${t.length === 3 ? `${at(106.5, 32.8, 10.3, esc(t[0]))}${at(106.2, 47.5, 13.2, '(')}${at(106.4, 55.2, 11.3, esc(t[1]))}${at(106.2, 68.8, 13.2, ')')}${at(106.4, 77.4, 11.3, esc(t[2]))}` : at(106.4, 32.8, 11.3, 'TEL　' + esc(sc.tel || ''))}
      ${line(112.7)}
      <div style="position:absolute;top:124.8mm;left:${X}mm;width:${W}mm;text-align:center;white-space:nowrap;font-size:26.3pt;line-height:1">就職応募書類在中</div>
      <div style="position:absolute;top:0;bottom:0;right:0;width:0.6mm;background:#000"></div></div>`;
  },
  /** groups → 宛名ラベル。start＝最初に使うラベルの位置（使いかけの用紙用）。copies＝1件あたりの枚数 */
  printLabels(groups, layoutKey, start = 1, copies = 1) {
    if (!groups.length) { UI.toast('印刷する求人を選んでください', 'warn'); return; }
    const L = Store.data.settings.labels[layoutKey];
    const per = L.cols * L.rows;
    const cells = Array(Math.max(0, start - 1)).fill('<div class="lb"></div>');
    groups.forEach(g => { for (let i = 0; i < copies; i++) cells.push(layoutKey === 'envelope' ? this.letterLabelHtml(g) : this.labelHtml(g)); });
    const pages = [];
    for (let i = 0; i < cells.length; i += per) pages.push(cells.slice(i, i + per));
    // 段ごとの高さ（rowH：カンマ区切り）。空欄・段数が合わないときは「高さ」を全段に使う
    const hs = String(L.rowH || '').split(/[,、\s]+/).map(Number).filter(v => v > 0);
    const rows = hs.length === L.rows ? hs.map(v => v + 'mm').join(' ') : `repeat(${L.rows}, ${L.h}mm)`;
    const html = pages.map(p => `<div class="p-page lb-sheet ${layoutKey === 'envelope' ? 'lb-env' : ''}" style="
      padding:${L.top}mm 0 0 ${L.left}mm;
      grid-template-columns:repeat(${L.cols}, ${L.w}mm); grid-template-rows:${rows};
      column-gap:${L.gapX}mm; row-gap:${L.gapY}mm;">${p.join('')}</div>`).join('');
    Print.open({ title: `宛名ラベル_${groups.length}社`, html, orientation: 'portrait', margin: '0' });
  },

  /* ---------- 電話連絡分担表 ---------- */
  callTable(groups) {
    const head = ['担当', 'クラス', '番号', '氏名', '性別', '下4桁', '企業名', '職種', '窓口', 'TEL', '見学日', '時間', '備考', '済'];
    const body = [];
    groups.forEach(g => g.apps.forEach(({ a, s }) => {
      const d = Derive.sendTo(g.job);
      body.push([a.visitCaller || '', s.no3.charAt(1), Number(s.no3), s.name, s.gender, Derive.short(g.job), g.job.company, g.job.jobTitle || '',
        [g.job.dept, g.job.contact].filter(Boolean).join('　'), g.job.tel || '', fmtMD(a.visitDate), a.visitTime || '', a.visitNote || '', a.visitDone ? '〇' : '']);
    }));
    body.sort((x, y) => String(x[0] || '￿').localeCompare(String(y[0] || '￿'), 'ja') || String(x[6]).localeCompare(String(y[6]), 'ja') || x[2] - y[2]);
    return { head, body };
  },
  printCallTable(groups) {
    const { head, body } = this.callTable(groups);
    const title = `${nendoLabel(Store.data.year)}　職場見学　電話連絡分担表`;
    Print.open({
      title, orientation: 'landscape', margin: '8mm',
      html: `<div class="p-page"><p class="p-title">${esc(title)}</p><p class="p-meta"><span>※取扱注意（個人情報）</span><span>${todayISO()}</span></p>
        <table class="p-table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${body.map(r => `<tr>${r.map((v, i) => `<td class="${typeof v === 'number' ? 'num' : ''} ${i >= 8 ? 'sm' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`,
    });
  },
  excelCallTable(groups) {
    const { head, body } = this.callTable(groups);
    Excel.download(`職場見学電話連絡分担_R${reiwa(Store.data.year)}.xlsx`, [{ name: '電話連絡分担', rows: [head, ...body], widths: [8, 6, 7, 14, 5, 7, 28, 22, 22, 14, 12, 8, 20, 4] }]);
  },

  /* ---------- 事前指導の座席表 ---------- */
  /** rows×blocks の座席（1行に2席×ブロック数）。番号順にブロックごと・行ごとに詰める */
  printSeating(students, opts) {
    const rows = opts.rows, blocks = opts.blocks;
    const perBlock = rows * 2;
    const seats = Array(perBlock * blocks).fill(null);
    students.forEach((s, i) => { if (i < seats.length) seats[i] = s; });
    const over = students.length - seats.length;
    const cell = s => `<td class="seat"><div class="seat-no">${s ? esc(s.no3) : ''}</div><div class="seat-nm">${s ? esc(s.name) : ''}</div></td>`;
    let body = '';
    for (let r = 0; r < rows; r++) {
      body += '<tr>';
      for (let b = 0; b < blocks; b++) {
        const base = b * perBlock + r * 2;
        body += cell(seats[base]) + cell(seats[base + 1]) + (b < blocks - 1 ? '<td class="seat-gap"></td>' : '');
      }
      body += '</tr>';
    }
    const title = opts.title || '職場見学事前指導　座席表';
    Print.open({
      title, orientation: 'landscape', margin: '10mm',
      html: `<div class="p-page"><p class="p-title">${esc(title)}</p><p class="p-meta"><span>${esc(opts.note || '')}</span><span>${students.length} 人</span></p>
        <div class="seat-front">前（黒板）</div><table class="seat-tbl"><tbody>${body}</tbody></table>
        ${over > 0 ? `<p class="p-note">※座席が ${over} 人分足りません（行数を増やしてください）。</p>` : ''}</div>`,
    });
    return over;
  },

  /* ---------- 出欠票（グループごと） ---------- */
  printAttendance(students, title) {
    const byG = new Map();
    students.forEach(s => { const g = s.group || '（未設定）'; if (!byG.has(g)) byG.set(g, []); byG.get(g).push(s); });
    const keys = [...byG.keys()].sort((a, b) => String(a).localeCompare(String(b), 'ja', { numeric: true }));
    const html = keys.map(k => `<div class="p-page"><p class="p-title">${esc(title)}　第${esc(k)}グループ</p>
      <p class="p-meta"><span>${esc(Store.data.settings.school.name)}</span><span>${byG.get(k).length} 人</span></p>
      <table class="p-table"><thead><tr><th>学科</th><th>番号</th><th>氏名</th><th>性別</th><th>就職希望</th><th style="width:26mm">出欠連絡</th><th style="width:26mm">提出物</th><th>備考</th></tr></thead>
      <tbody>${byG.get(k).sort((a, b) => num(a.no3) - num(b.no3)).map(s => `<tr><td class="c">${esc((Students.dept(s) || {}).short || '')}</td><td>${esc(s.no3)}</td><td>${esc(s.name)}</td><td class="c">${esc(s.gender)}</td><td class="c">${s.course === '就職' ? '○' : ''}</td><td></td><td></td><td>${esc(s.note || '')}</td></tr>`).join('')}</tbody></table></div>`).join('');
    Print.open({ title, html, orientation: 'portrait', margin: '12mm' });
  },

  /* ---------- 受験企業一覧（一斉起案用） ---------- */
  examRows() {
    return Apps.currents().map(({ s, a }) => ({ s, a, job: Apps.job(a) })).filter(x => x.job)
      .sort((x, y) => String(x.job.kana || x.job.company).localeCompare(String(y.job.kana || y.job.company), 'ja') || num(x.s.no3) - num(y.s.no3));
  },
  printExamList() {
    const rows = this.examRows();
    if (!rows.length) { UI.toast('確定した応募がありません', 'warn'); return; }
    const n = new Set(rows.map(x => x.job.id)).size;
    const title = `${nendoLabel(Store.data.year)}　学校斡旋就職希望者　受験企業一覧`;
    Print.open({
      title, orientation: 'portrait', margin: '12mm',
      html: `<div class="p-page"><p class="p-title">${esc(title)}</p>
        <table class="p-table"><thead><tr><th>番号</th><th>氏名</th><th>性別</th><th>企業名</th><th>職種</th></tr></thead>
        <tbody>${rows.map(x => `<tr class="${x.s.gender === '男' ? 'p-shade' : ''}"><td>${esc(x.s.no3)}</td><td>${esc(x.s.name)}</td><td class="c">${esc(x.s.gender)}</td><td>${esc(x.job.company)}</td><td>${esc(x.job.jobTitle || '')}</td></tr>`).join('')}</tbody></table>
        <p class="p-note">受験企業数　${n} 社　／　受験者 ${rows.length} 人（網掛けは男子）</p></div>`,
    });
  },
  excelExamList() {
    const rows = this.examRows();
    Excel.download(`受験企業一覧_R${reiwa(Store.data.year)}.xlsx`, [{
      name: '受験企業一覧', widths: [7, 14, 5, 30, 24],
      rows: [['番号', '氏名', '性別', '企業名', '職種'], ...rows.map(x => [Number(x.s.no3), x.s.name, x.s.gender, x.job.company, x.job.jobTitle || ''])],
    }]);
  },
};

/* ============================================================
   応募書類の送付（応募・受験ページに組み込むカード）
   ============================================================ */
const SendDocs = {
  state: { sel: null, showSent: false, f: '' },

  /** 送付先の状態の絞り込み：changed＝事業所と違う送付先／unchecked＝まだ確認していない／noaddr＝住所が空 */
  match(job, f) {
    const d = Derive.sendTo(job);
    return f === 'changed' ? d.changed : f === 'unchecked' ? !job.sendChecked : f === 'noaddr' ? !d.address : true;
  },
  groups() {
    const min = this.state.minRound || 1;     // 2次応募の画面では 2（2次以降の応募先だけ）
    return Docs.jobGroups(a => a.confirmed && a.round >= min && (this.state.showSent || !a.docsSent)).filter(g => this.match(g.job, this.state.f));
  },
  /** 郵便番号を 000-0000 の形にそろえる */
  zip(v) {
    const d = toHalf(String(v ?? '')).replace(/[^0-9]/g, '');
    return d.length === 7 ? d.slice(0, 3) + '-' + d.slice(3) : String(v ?? '').trim();
  },

  html() {
    const groups = this.groups();
    const st = this.state;
    if (!st.sel) st.sel = new Set(groups.map(g => g.job.id));
    const d = Store.data.settings.docs;
    return `<section class="card" id="sendCard">
      <div class="card-head"><h2>応募書類の送付</h2>
        <label class="check sub"><input type="checkbox" id="sdShowSent" ${st.showSent ? 'checked' : ''}> 送付済みも表示</label></div>
      <p class="sub">確定した応募先を求人ごとにまとめています。送付状と宛名ラベル（送付先の変更は求人票の内容が使われます）を印刷し、発送したら「送付済みにする」を押します。</p>
      ${Docs.principalMissing() ? '<div class="notice notice-warn">校長名・進路指導主事名が未入力です。「設定」で入力してください（送付状・依頼文に入ります）。</div>' : ''}
      <div class="toolbar"><span class="sub">送付先の確認・修正</span><div class="seg">${[['', 'すべて'], ['changed', '事業所と違う送付先'], ['unchecked', '未確認'], ['noaddr', '住所が空']].map(([v, l]) => `<button class="${st.f === v ? 'on' : ''}" data-sf-filter="${v}">${l}${v ? ' ' + Docs.jobGroups(a => a.confirmed && a.round >= (st.minRound || 1) && (st.showSent || !a.docsSent)).filter(g => this.match(g.job, v)).length : ''}</button>`).join('')}</div></div>
      <p class="help">送付先は、空欄なら事業所の住所・部署・担当者を使います。変えたい項目だけ入力してください（直すと「確認」に自動でチェックが入ります）。</p>
      ${groups.length ? `<div class="table-wrap"><table class="tbl" id="sdTable">
        <thead><tr><th><input type="checkbox" id="sdAll" ${groups.every(g => st.sel.has(g.job.id)) ? 'checked' : ''}></th><th class="num">下4桁</th><th>事業所（事業所の所在地）</th><th>応募者</th><th>送付先〒</th><th>送付先の住所</th><th>部署</th><th>担当者</th><th title="送付先を確認したらチェック">確認</th><th></th></tr></thead>
        <tbody>${groups.map(g => { const j = g.job, dest = Derive.sendTo(j); const sf = (k, ph, cls) => `<input data-sj="${j.id}" data-sf="${k}" value="${esc(j[k] || '')}" placeholder="${esc(ph || '')}" class="${cls}" autocomplete="off">`; return `<tr data-row="${j.id}" class="${dest.changed ? 'sd-changed' : ''}">
          <td><input type="checkbox" data-job="${g.job.id}" ${st.sel.has(g.job.id) ? 'checked' : ''}></td>
          <td class="num mono">${esc(Derive.short(j))}</td>
          <td>${esc(j.company)} <span class="sd-tag">${dest.changed ? '<span class="tag tag-info">送付先を変更</span>' : ''}</span><br><span class="sub">${esc(j.jobTitle || '')}　〒${esc(j.zip || '')} ${esc(j.address || '（事業所の住所なし）')}</span></td>
          <td class="sm">${g.apps.map(x => esc(x.s.name) + (x.a.docsSent ? '<span class="tag tag-accent">済</span>' : '')).join('、')}</td>
          <td>${sf('sendZip', j.zip || '000-0000', 'w-zip')}</td><td>${sf('sendAddress', j.address || '住所', 'w-addr')}</td>
          <td>${sf('sendDept', j.dept || '', 'w-dept')}</td><td>${sf('sendContact', j.contact || '', 'w-dept')}</td>
          <td class="c"><input type="checkbox" data-sc="${j.id}" ${j.sendChecked ? 'checked' : ''}></td>
          <td>${dest.changed ? `<button class="link-btn" data-sreset="${j.id}" title="送付先の変更を消して、事業所の住所に戻す">事業所と同じに戻す</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="toolbar send-tools">
        <label class="inline">送付状の日付 <input type="date" id="sdDate" value="${esc(Docs.sendDateISO())}"></label>
        <label class="inline">ラベルの開始位置 <input type="number" id="sdStart" value="1" min="1" max="${Store.data.settings.labels.envelope.cols * Store.data.settings.labels.envelope.rows}" style="width:60px"></label>
        <button class="btn btn-primary" id="sdCover">送付状を印刷</button>
        <button class="btn btn-primary" id="sdLabel">宛名ラベルを印刷</button>
        <button class="btn" id="sdMark">選んだ分を送付済みにする</button>
      </div>` : '<p class="sub">送付が必要な応募はありません。</p>'}
      <div class="btn-row" style="margin-top:10px">
        <button class="btn" id="sdExam">受験企業一覧（一斉起案）を印刷</button>
        <button class="btn" id="sdExamX">Excel に出力</button>
      </div>
    </section>`;
  },

  selected() { const set = this.state.sel; return this.groups().filter(g => set.has(g.job.id)); },

  /** 送付カードだけを描き直す（送付済みの変更を反映） */
  redraw() {
    const c = $('#sendCard'); if (!c) return;
    this.state.sel = null;
    c.outerHTML = this.html();
    this.bind($('#sendCard'));
  },

  bind(root) {
    const st = this.state;
    const $c = s => $(s, root);
    $$('[data-sf-filter]', root).forEach(b => b.addEventListener('click', () => { st.f = b.dataset.sfFilter; st.sel = null; UI.refresh(); }));
    $c('#sdShowSent').addEventListener('change', e => { st.showSent = e.target.checked; st.sel = null; UI.refresh(); });
    $c('#sdExam').addEventListener('click', () => Docs.printExamList());
    $c('#sdExamX').addEventListener('click', () => Docs.excelExamList());
    const tbl = $c('#sdTable');
    if (!tbl) return;
    $c('#sdAll').addEventListener('change', e => { this.groups().forEach(g => e.target.checked ? st.sel.add(g.job.id) : st.sel.delete(g.job.id)); $$('[data-job]', tbl).forEach(c => { c.checked = e.target.checked; }); });
    tbl.addEventListener('change', e => {
      const t = e.target, j = t.dataset.job;
      if (j) { t.checked ? st.sel.add(j) : st.sel.delete(j); return; }
      if (t.dataset.sc) { const job = Jobs.byId(t.dataset.sc); if (job) { job.sendChecked = t.checked; Store.changed(); } return; }
      if (t.dataset.sf) {
        const job = Jobs.byId(t.dataset.sj); if (!job) return;
        let v = t.value.trim();
        if (t.dataset.sf === 'sendZip') { v = this.zip(v); t.value = v; }
        if (v) job[t.dataset.sf] = v; else delete job[t.dataset.sf];
        job.sendChecked = true;
        Store.changed();
        const row = t.closest('tr'), ch = Derive.sendTo(job).changed;
        row.classList.toggle('sd-changed', ch);
        $('.sd-tag', row).innerHTML = ch ? '<span class="tag tag-info">送付先を変更</span>' : '';
        const cb = $('[data-sc]', row); if (cb) cb.checked = true;
      }
    });
    tbl.addEventListener('click', e => {
      const b = e.target.closest('[data-sreset]'); if (!b) return;
      const job = Jobs.byId(b.dataset.sreset); if (!job) return;
      ['sendZip', 'sendAddress', 'sendDept', 'sendContact'].forEach(k => { delete job[k]; });
      Store.changed(); UI.refresh();
    });
    $c('#sdDate').addEventListener('change', e => { Store.data.settings.docs.sendDate = e.target.value; Store.changed(); });
    $c('#sdCover').addEventListener('click', () => Docs.printCovers(this.selected()));
    $c('#sdLabel').addEventListener('click', () => Docs.printLabels(this.selected(), 'envelope', Math.max(1, num($c('#sdStart').value) || 1)));
    $c('#sdMark').addEventListener('click', async () => {
      const gs = this.selected();
      if (!gs.length) { UI.toast('求人を選んでください', 'warn'); return; }
      const n = gs.reduce((t, g) => t + g.apps.length, 0);
      if (!await UI.confirm(`${gs.length} 社（${n} 人分）を、${fmtMD(Docs.sendDateISO())}付で「送付済み」にします。`, { ok: '送付済みにする' })) return;
      gs.forEach(g => g.apps.forEach(({ a }) => { a.docsSent = true; a.docsSentDate = Docs.sendDateISO(); }));
      st.sel = null;
      Store.changed();
      UI.refresh();
    });
  },
};
