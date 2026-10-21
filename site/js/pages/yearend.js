'use strict';
/* ============================================================
   9. 年度末の資料
   進路指導まとめ／進路先一覧（就職先・専修各種・四大短大）／指定校一覧／過去の実績（取り込み・編集）
   ============================================================ */

const YearendPage = {
  state: { tab: 'matome', simple: false, size: 'A4', master: 'univ', hk: 'work', hq: '' },

  render(view) {
    const st = this.state, ye = Store.data.settings.yearend;
    const tabs = [['matome', '進路指導まとめ'], ['work', '就職先一覧'], ['senshu', '専修各種'], ['univ', '四大・短大'], ['master', '指定校一覧'], ['slides', '保護者説明会スライド'], ['history', '過去の実績']];
    view.innerHTML = `
      <div class="page-head"><div><h1>年度末の資料</h1>
      <p class="lead">進路決定の内容と、過去の実績（R1〜）から、<b>進路先一覧・指定校一覧・進路指導まとめ</b>を作ります。今年度の列は自動で足されます。</p></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}
        <label class="check tabs-opt"><input type="checkbox" id="yeZero" ${YE.zero() ? 'checked' : ''}> 0は記載しない</label></div>
      <div id="yeBody"></div>`;
    $$('[data-tab]', view).forEach(b => b.addEventListener('click', () => { st.tab = b.dataset.tab; UI.refresh(); }));
    $('#yeZero', view).addEventListener('change', e => { Store.data.settings.reports = Object.assign({}, Store.data.settings.reports, { hideZero: e.target.checked }); Store.changed(); UI.refresh(); });
    this['draw_' + st.tab]($('#yeBody', view));
  },

  /* ---------- 共通：印刷バー ---------- */
  bar({ size = true, extra = '' } = {}) {
    return `<div class="toolbar">${extra}<span class="grow"></span>${size ? `<label class="inline">用紙 <select id="yeSize">${['A4', 'A3'].map(s => `<option ${this.state.size === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
      <button class="btn" id="yeXlsx">Excel に出力</button><button class="btn btn-primary" id="yePrint">印刷</button></div>`;
  },
  setting(k, v) { Store.data.settings.yearend = Object.assign({}, Store.data.settings.yearend, { [k]: v }); Store.changed(); UI.refresh(); },
  optsRow() {
    const o = History.opts();
    const n = (id, l, v, max) => `<label class="inline">${l} <input type="number" id="${id}" value="${v}" min="1" max="${max}" style="width:60px"> 年</label>`;
    return { work: n('yoW', '個別に並べる年数', o.workRecent, 9), senshu: n('yoS', '並べる年数', o.senshuYears, 12), univ: n('yoU', '並べる年数', o.univYears, 12) };
  },
  bindOpts(el, key, id) {
    const o = $('#' + id, el); if (o) o.addEventListener('change', e => this.setting(key, Math.max(1, Math.min(12, num(e.target.value) || 1))));
    const d = $('#yoDrop', el); if (d) d.addEventListener('change', e => this.setting('dropEmpty', e.target.checked));
  },
  printDoc(html, title, orientation = 'portrait', margin = '10mm') {
    Print.open({ title, html, orientation, margin, size: this.state.size });
  },

  /* ---------- 進路指導まとめ ---------- */
  draw_matome(el) {
    const st = this.state, ye = Store.data.settings.yearend;
    if (!Outcomes.list().length) { el.innerHTML = '<div class="empty"><p class="empty-title">生徒が登録されていません</p><p>［生徒・成績］で名簿を取り込み、［進路決定］を入力してください。</p></div>'; return; }
    const un = Outcomes.summary().blank;
    el.innerHTML = `<div class="toolbar"><div class="seg"><button class="${!st.simple ? 'on' : ''}" data-m="0">進路指導まとめ（年度末）</button><button class="${st.simple ? 'on' : ''}" data-m="1">簡易版（1月ごろ・活動中の人数つき）</button></div>
      <label class="inline">現在日 <input type="date" id="yeAsOf" value="${esc(ye.asOf || todayISO())}"></label><span class="grow"></span>
      <button class="btn btn-primary" id="yePrint">印刷</button></div>
      ${un ? `<div class="notice notice-warn">進路が未入力の生徒が ${un} 人います（集計に入っていません）。［進路決定］で入力してください。</div>` : ''}
      ${st.simple ? `<div class="field wide" style="margin-bottom:10px"><label class="label">今年度の特徴（簡易版に載せる文章）</label><textarea id="yeNotes" rows="5" placeholder="例：・進路希望は就職43％、進学56％で…">${esc(ye.notes || '')}</textarea></div>` : ''}
      <div class="card mt-screen">${YE.matomeHtml({ simple: st.simple })}</div>`;
    $$('[data-m]', el).forEach(b => b.addEventListener('click', () => { st.simple = b.dataset.m === '1'; UI.refresh(); }));
    $('#yeAsOf', el).addEventListener('change', e => this.setting('asOf', e.target.value));
    $('#yeNotes', el)?.addEventListener('change', e => { Store.data.settings.yearend = Object.assign({}, Store.data.settings.yearend, { notes: e.target.value }); Store.changed(); UI.refresh(); });
    $('#yePrint', el).addEventListener('click', () => Print.open({ title: `${Yr.long(Store.data.year)}進路指導まとめ`, html: `<div class="p-page">${YE.matomeHtml({ simple: st.simple })}</div>`, orientation: 'portrait', margin: '16mm 18mm' }));
  },

  /* ---------- 進路先一覧（3種） ---------- */
  draw_list(el, kind, html, title, orient) {
    const o = this.optsRow();
    const extra = `${kind === 'work' ? o.work : kind === 'senshu' ? o.senshu : o.univ}<label class="check"><input type="checkbox" id="yoDrop" ${History.opts().dropEmpty ? 'checked' : ''}> 表示する年に人数がない行は載せない</label>`;
    el.innerHTML = `${this.bar({ extra })}<div class="card ye-screen sv-scroll">${html}</div>`;
    this.bindOpts(el, kind === 'work' ? 'workRecent' : kind === 'senshu' ? 'senshuYears' : 'univYears', kind === 'work' ? 'yoW' : kind === 'senshu' ? 'yoS' : 'yoU');
    $('#yeSize', el).addEventListener('change', e => { this.state.size = e.target.value; });
    $('#yeXlsx', el).addEventListener('click', () => YE.excel(kind));
    $('#yePrint', el).addEventListener('click', () => this.printDoc(html, title, orient));
  },
  draw_work(el) { this.draw_list(el, 'work', YE.workHtml(), '年度別学校斡旋就職先一覧', 'portrait'); },
  draw_senshu(el) { this.draw_list(el, 'senshu', YE.senshuHtml(), '年度別専修各種進学先一覧', 'portrait'); },
  draw_univ(el) { this.draw_list(el, 'univ', YE.univHtml(), '年度別四大短大進学先一覧', 'portrait'); },

  /* ---------- 指定校一覧 ---------- */
  draw_master(el) {
    const st = this.state, H = Store.data.history, M = H.master;
    const kinds = [['univ', '四大'], ['junior', '短大'], ['senshu', '専修各種']];
    el.innerHTML = `<div class="toolbar"><div class="seg">${kinds.map(([k, l]) => `<button class="${st.master === k ? 'on' : ''}" data-mk="${k}">${l}${M ? `（${M[k].length}）` : ''}</button>`).join('')}</div>
        ${M ? `<label class="inline">年度 <input type="number" id="msYear" value="${M.year - 2018}" style="width:60px"> （令和 ${M.year - 2018} 年度）</label>` : ''}
        <button class="btn btn-sm" id="msAdd" ${M ? '' : 'disabled'}>＋ 行を追加</button><span class="sub">行を押すと直せます</span><span class="grow"></span>
        <button class="btn" id="yeXlsx" ${M ? '' : 'disabled'}>Excel に出力</button><button class="btn btn-primary" id="yePrint" ${M ? '' : 'disabled'}>印刷（A4横）</button></div>
      <div class="card sv-scroll ye-screen sv-clickable" id="msBody">${YE.masterHtml(st.master)}</div>
      <p class="help">指定校の推薦人数・基準・試験内容は、毎年の依頼状に合わせて直し、［過去の実績］の取り込みで丸ごと入れ替えることもできます。次の年度にも引き継がれます。</p>`;
    $$('[data-mk]', el).forEach(b => b.addEventListener('click', () => { st.master = b.dataset.mk; UI.refresh(); }));
    $('#msYear', el)?.addEventListener('change', e => { const y = num(e.target.value); if (y > 0) { M.year = 2018 + y; Store.changed(); UI.refresh(); } });
    $('#msAdd', el).addEventListener('click', () => this.editMaster(null));
    $('#msBody', el).addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) this.editMaster(tr.dataset.id); });
    $('#yeXlsx', el).addEventListener('click', () => YE.excel(st.master));
    $('#yePrint', el).addEventListener('click', () => this.printDoc(YE.masterHtml(st.master), `${Yr.long(M.year)}指定校一覧`, 'landscape', '10mm'));
  },
  async editMaster(id) {
    const kind = this.state.master, M = Store.data.history.master, def = YE.MASTER[kind];
    const row = id ? M[kind].find(r => r.id === id) : {};
    const body = document.createElement('div');
    body.innerHTML = `<div class="grid">${def.head.map(([k, l]) => `<label class="field ${['name', 'exam', 'crit', 'addr', 'dept', 'faculty'].includes(k) ? 'wide' : ''}"><span class="label">${esc(l)}</span><textarea data-k="${k}" rows="${['name', 'quota', 'grade'].includes(k) ? 1 : 2}">${esc(row[k] || '')}</textarea></label>`).join('')}</div>`;
    const buttons = []; if (id) buttons.push({ label: '削除', kind: 'danger-ghost', value: 'del' });
    buttons.push({ label: 'キャンセル', value: null }, { label: '保存', kind: 'primary', value: 'save' });
    const res = await UI.modal({ title: id ? '指定校の編集' : '指定校の追加', body, buttons, wide: true });
    if (res === 'save') {
      const v = {}; $$('[data-k]', body).forEach(e => { v[e.dataset.k] = e.value.trim(); });
      if (!v.name) { UI.toast('学校名を入力してください', 'warn'); return; }
      if (id) Object.assign(row, v); else M[kind].push(Object.assign({ id: uid(), faculty: '', dept: '', quota: '', grade: '', crit: '', exam: '', addr: '' }, v));
      Store.changed();
    } else if (res === 'del') { M[kind] = M[kind].filter(r => r.id !== id); Store.changed(); }
    if (res) UI.refresh();
  },

  /* ---------- 保護者説明会スライド ---------- */
  draw_slides(el) {
    const st = this.state, srcs = Slides.sources();
    if (!srcs.length) { el.innerHTML = '<div class="empty"><p class="empty-title">スライドにする数字がありません</p><p>［進路決定］を入力するか、［過去の実績］で前年度までの卒業者全体の人数を入れてください。</p></div>'; return; }
    if (!srcs.includes(st.sy)) st.sy = srcs[0];
    st.slOpen = st.slOpen || {};
    const ov = () => { const ye = Store.data.settings.yearend; return ye.slides = ye.slides || {}; };
    const raw = Slides.build(st.sy, true);
    const LISTS = { year: ['時期｜内容（1行＝1項目）', 6], money: ['見出し｜内容（1行＝1項目）', 6], flow: ['就職希望者の流れ　時期｜内容', 6], ask: ['ご家庭へのお願い（1行＝1項目）', 5] };
    const inp = (k, l, ph) => `<label class="field wide"><span class="label">${l}</span><input data-k="${k}" value="${esc(ov()[k] || '')}" placeholder="${esc(ph)}"></label>`;
    const area = k => `<label class="field wide"><span class="label">${LISTS[k][0]}</span><textarea data-k="${k}" rows="${LISTS[k][1]}" placeholder="${esc(Slides.DEF[k])}">${esc(ov()[k] || '')}</textarea></label>`;
    const editor = s => {
      const o = ov();
      const common = s.cover ? `${inp('coverTitle', '表紙の題', Slides.coverTitle(Store.data.year))}${inp('cover1', '1行目', Slides.DEF.cover1)}${inp('cover2', '2行目（空欄＝自動）', '例：令和〇年度卒業予定者の進路状況と、進路指導のあらまし')}`
        : `<label class="check"><input type="checkbox" data-hide="${s.id}" ${(o.hide || {})[s.id] ? '' : 'checked'}> このスライドを使う</label>
           <label class="field wide"><span class="label">題（空欄＝自動）</span><input data-title="${s.id}" value="${esc((o.titles || {})[s.id] || '')}" placeholder="${esc(s.def)}"></label>
           <label class="field wide"><span class="label">ひとこと（スライドの下に表示）</span><textarea data-memo="${s.id}" rows="2" placeholder="例：詳しくは個別面談でご説明します">${esc((o.memo || {})[s.id] || '')}</textarea></label>`;
      const extra = s.id === 'year' ? area('year') : s.id === 'money' ? area('money') : s.id === 'flow' ? area('flow') + area('ask') : '';
      return `<details class="sl-edit" data-open="${s.id}" ${st.slOpen[s.id] ? 'open' : ''}><summary>文面を直す</summary><div class="grid">${common}${extra}</div></details>`;
    };
    el.innerHTML = `<div class="toolbar"><label class="inline">使う数字 <select id="slSrc">${srcs.map(y => `<option value="${y}" ${y === st.sy ? 'selected' : ''}>${y === Store.data.year ? `今年度（${Yr.long(y)}・現状）` : `${Yr.long(y)}卒業生の実績`}</option>`).join('')}</select></label>
        <div class="seg" title="スライドの縦横比">${['16:9', '4:3'].map(r => `<button data-ratio="${r}" class="${Slides.ratio() === r ? 'on' : ''}">${r}</button>`).join('')}</div>
        <span class="sub" id="slCount"></span><span class="grow"></span>
        <button class="btn btn-sm" id="slReset">文面をすべて初期に戻す</button>
        <button class="btn" id="slPrint">印刷・PDF</button><button class="btn" id="slDl" title="開くだけで発表できる HTML ファイル（動きつき）">ダウンロード</button><button class="btn btn-primary" id="slShow">全画面で発表</button></div>
      <p class="help">進路決定と過去の実績から自動で作ります。数字を直すときは、［進路決定］や［過去の実績］を直してください。各スライドの右の「文面を直す」で、題・ひとこと・文章を変えられます（空欄＝初期の文）。発表では、スライドが順に入ってくる動きがつきます。</p>
      <div class="sl-rows">${raw.map(s => `<div class="sl-row" data-id="${s.id}"><div class="sl-thumb" title="クリックで、この枚から発表"><div class="sl-sc" style="transform:scale(.5)"></div><span class="sl-no"></span></div>${editor(s)}</div>`).join('')}</div>`;
    let htmls = [];
    /** 一覧の小さな画面だけを描き直す（入力欄は触らないので、続けて入力できる） */
    const drawThumbs = () => {
      htmls = Slides.all(st.sy);
      const all = Slides.build(st.sy, false, true), w = Slides.W;
      let vis = 0;
      all.forEach((s, ri) => {
        const row = $(`.sl-row[data-id="${s.id}"]`, el), th = $('.sl-thumb', row), off = !!s.hidden;
        th.style.width = (w / 2) + 'px'; th.style.height = '360px';
        const sc = $('.sl-sc', th); sc.style.width = w + 'px';
        sc.innerHTML = off ? Slides.slide(s, ri, all.length) : htmls[vis];
        th.classList.toggle('is-off', off);
        th.dataset.go = off ? '' : vis;
        $('.sl-no', th).textContent = off ? '使わない' : vis + 1;
        if (!off) vis++;
      });
      $('#slCount', el).textContent = `${htmls.length} 枚`;
    };
    drawThumbs();
    const put = (group, key, v) => {
      const o = ov(); v = v.trim();
      if (group) { o[group] = Object.assign({}, o[group]); if (v) o[group][key] = v; else delete o[group][key]; }
      else if (v) o[key] = v; else delete o[key];
      Store.changed(); drawThumbs();
    };
    $$('.sl-thumb', el).forEach(t => t.addEventListener('click', () => { if (t.dataset.go !== '') Slides.present(htmls, +t.dataset.go); }));
    $$('[data-open]', el).forEach(d => d.addEventListener('toggle', () => { st.slOpen[d.dataset.open] = d.open; }));
    $$('[data-title]', el).forEach(i => i.addEventListener('change', () => put('titles', i.dataset.title, i.value)));
    $$('[data-memo]', el).forEach(i => i.addEventListener('change', () => put('memo', i.dataset.memo, i.value)));
    $$('[data-k]', el).forEach(i => i.addEventListener('change', () => put(null, i.dataset.k, i.value)));
    $$('[data-hide]', el).forEach(i => i.addEventListener('change', () => { const o = ov(); o.hide = Object.assign({}, o.hide); if (i.checked) delete o.hide[i.dataset.hide]; else o.hide[i.dataset.hide] = true; Store.changed(); drawThumbs(); }));
    $('#slReset', el).addEventListener('click', async () => {
      if (!await UI.confirm('スライドの文面（題・ひとこと・使うかどうか・各枚の文）をすべて初期に戻します。よろしいですか？', { ok: '初期に戻す', danger: true })) return;
      Store.data.settings.yearend.slides = {}; Store.changed(); UI.refresh();
    });
    $('#slSrc', el).addEventListener('change', e => { st.sy = +e.target.value; UI.refresh(); });
    $$('[data-ratio]', el).forEach(b => b.addEventListener('click', () => { Store.data.settings.yearend.slideRatio = b.dataset.ratio; Store.changed(); UI.refresh(); }));
    $('#slShow', el).addEventListener('click', () => Slides.present(htmls, 0));
    $('#slPrint', el).addEventListener('click', () => Slides.print(htmls, `${Yr.long(Store.data.year)}進路説明会`));
    $('#slDl', el).addEventListener('click', () => Slides.download(htmls, `${Yr.long(Store.data.year)}進路説明会`));
  },

  /* ---------- 過去の実績 ---------- */
  draw_history(el) {
    const st = this.state, H = Store.data.history, FY = Store.data.year;
    const imp = (k, l, f) => `<div class="tpl-item"><div><b>${l}</b><div class="sub">${f}${H.imported[k] ? `<br>取り込み済み：${esc(H.imported[k].name)}（${H.imported[k].rows} 行）` : ''}</div></div><button class="btn btn-sm btn-primary" data-imp="${k}">取り込む</button></div>`;
    const sumYears = Object.keys(H.summary).map(Number).sort((a, b) => b - a);
    el.innerHTML = `
      <section class="card"><h2>R7 までの実績を取り込む</h2>
        <p class="sub">これまでの「年度別 進路先一覧」の Excel を、そのまま取り込めます。取り込むと、その種類の実績が<b>置き換わります</b>。令和${FY - 2018}年度以降は、［進路決定］から自動で足されます。</p>
        <div class="tpl-list">
          ${imp('work', '年度別学校斡旋就職先一覧（就職）', '「R7_進路先一覧（就職）ワークシート1枚」')}
          ${imp('senshu', '年度別専修・各種学校進学先一覧', '「R7_進学先一覧（専修各種）ワークシート1枚」')}
          ${imp('univ', '年度別四大・短大進学先一覧', '「R7_進学先一覧（四大・短大）ワークシート1枚」')}
          ${imp('master', '指定校一覧（進路の手引の原稿）', '「R7_進路の手引　指定校一覧原稿　ワークシート3枚」（四大・短大・専修各種）')}
        </div></section>
      <section class="card"><h2>求人票数の推移</h2>
        <p class="sub">過去の年は入力した値、<b>今年度（${Yr.label(FY)}）は求人票の件数から自動</b>です（区分が「一般」のもの）。</p>
        <div class="ds-row">${Array.from({ length: 11 }, (_, i) => FY - 11 + i).map(y => `<label class="ds-f"><span>${Yr.label(y)}</span><input type="number" data-jobs="${y}" value="${H.jobs[y] ?? ''}" class="w-num" style="width:70px"></label>`).join('')}
          <label class="ds-f"><span>${Yr.label(FY)}（自動）</span><input value="${History.jobsTrend(1)[0].v}" readonly class="w-num" style="width:70px"></label></div></section>
      <section class="card"><h2>前年度までの卒業者全体（まとめの「昨年度資料」）</h2>
        <p class="sub">年度更新のとき、その年度の進路決定から自動で足されます。過去の分はここで直せます。</p>
        <div class="field narrow"><label class="label">年度</label><select id="hsYear">${sumYears.map(y => `<option value="${y}" ${y === (st.hy || FY - 1) ? 'selected' : ''}>${Yr.label(y)}</option>`).join('')}</select></div>
        <div class="ds-row" id="hsFields"></div></section>
      <section class="card"><h2>実績の行を直す</h2>
        <div class="toolbar"><div class="seg">${[['work', '就職先'], ['senshu', '専修各種'], ['univ', '四大・短大']].map(([k, l]) => `<button class="${st.hk === k ? 'on' : ''}" data-hk="${k}">${l}（${H[k].length}）</button>`).join('')}</div>
          <input type="search" id="hsQ" class="grow" placeholder="名前で検索" value="${esc(st.hq)}"><button class="btn btn-sm" id="hsAdd">＋ 行を追加</button></div>
        <div id="hsRows"></div></section>`;
    $$('[data-imp]', el).forEach(b => b.addEventListener('click', () => this.importKind(b.dataset.imp)));
    $$('[data-jobs]', el).forEach(i => i.addEventListener('change', () => { const v = num(i.value); if (v == null) delete H.jobs[i.dataset.jobs]; else H.jobs[i.dataset.jobs] = v; Store.changed(); }));
    const drawSum = () => {
      const y = +$('#hsYear', el).value; st.hy = y; const s = H.summary[y] || {};
      const keys = [['jobSchool', '学校斡旋'], ['jobOther', '斡旋外'], ['jobPublic', '公務'], ['univ', '大学'], ['junior', '短期大学'], ['senshu', '専門学校'], ['college', '大学校・准看護'], ['eduOther', '進学その他'], ['other', 'その他']];
      $('#hsFields', el).innerHTML = keys.map(([k, l]) => `<label class="ds-f"><span>${l}</span><input type="number" data-sk="${k}" value="${s[k] ?? 0}" class="w-num" style="width:70px"></label>`).join('');
      $$('[data-sk]', el).forEach(i => i.addEventListener('change', () => { H.summary[y] = Object.assign({}, H.summary[y]); H.summary[y][i.dataset.sk] = num(i.value) || 0; Store.changed(); }));
    };
    $('#hsYear', el).addEventListener('change', drawSum); drawSum();
    $$('[data-hk]', el).forEach(b => b.addEventListener('click', () => { st.hk = b.dataset.hk; UI.refresh(); }));
    $('#hsQ', el).addEventListener('input', e => { st.hq = e.target.value; this.drawRows($('#hsRows', el)); });
    $('#hsAdd', el).addEventListener('click', () => this.editRow(null));
    this.drawRows($('#hsRows', el));
  },
  rowName(kind, r) { return kind === 'univ' ? [r.school, r.faculty, r.dept].filter(Boolean).join(' / ') : r.name; },
  drawRows(el) {
    const st = this.state, H = Store.data.history, FY = Store.data.year, q = nameKey(st.hq);
    const rows = H[st.hk].slice().sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).filter(r => !q || nameKey(this.rowName(st.hk, r)).includes(q));
    const ys = Array.from({ length: 7 }, (_, i) => FY - 1 - i);
    el.innerHTML = `<p class="count">${rows.length} 行${rows.length > 80 ? '（先頭の80行を表示。検索で絞り込めます）' : ''}</p><div class="table-wrap"><table class="tbl tbl-click"><thead><tr><th>名前</th><th>区分</th>${ys.map(y => `<th class="num">${Yr.label(y)}</th>`).join('')}<th class="num">それ以前</th></tr></thead><tbody>
      ${rows.slice(0, 80).map(r => `<tr data-id="${r.id}"><td>${esc(this.rowName(st.hk, r))}</td><td class="sm">${esc(st.hk === 'work' ? OC.indLabel(r.ind) : st.hk === 'senshu' ? (r.sec === 'shitei' ? '指定校' : r.field || '公募他') : `${r.level === 'univ' ? '大学' : '短大'}・${r.sec === 'shitei' ? '指定校' : '公募他'}`)}</td>
        ${ys.map(y => `<td class="num">${r.counts[y] || ''}</td>`).join('')}<td class="num">${Object.entries(r.counts).filter(([y]) => +y < ys[ys.length - 1]).reduce((t, [, v]) => t + v, 0) || ''}</td></tr>`).join('')}</tbody></table></div>`;
    $$('tbody tr', el).forEach(tr => tr.addEventListener('click', () => this.editRow(tr.dataset.id)));
  },
  async editRow(id) {
    const st = this.state, H = Store.data.history, FY = Store.data.year, kind = st.hk;
    const row = id ? H[kind].find(r => r.id === id) : { counts: {}, marks: {}, ord: (H[kind].reduce((m, r) => Math.max(m, r.ord ?? 0), 0)) + 1 };
    const f = (k, l, v, w = '') => `<label class="field ${w}"><span class="label">${l}</span><input data-k="${k}" value="${esc(v ?? '')}" autocomplete="off"></label>`;
    const years = Array.from({ length: 12 }, (_, i) => FY - 1 - i);
    const body = document.createElement('div');
    const head = kind === 'work' ? `${f('name', '会社名', row.name, 'wide')}<label class="field"><span class="label">業種</span><select data-k="ind"><option value="">（未設定）</option>${Object.entries(OC.IND_NAMES).map(([k, v]) => `<option value="${k}" ${row.ind === k ? 'selected' : ''}>${OC.fw(k)} ${v}</option>`).join('')}</select></label>`
      : kind === 'senshu' ? `${f('name', '学校名', row.name, 'wide')}<label class="field"><span class="label">区分</span><select data-k="sec"><option value="shitei" ${row.sec === 'shitei' ? 'selected' : ''}>指定校推薦</option><option value="open" ${row.sec !== 'shitei' ? 'selected' : ''}>公募制推薦・総合型・一般</option></select></label>${f('field', '分野（公募制ほかのとき）', row.field)}`
        : `${f('school', '学校名', row.school, 'wide')}${f('faculty', '学部（短大は学科）', row.faculty)}${f('dept', '学科（短大は専攻・コース）', row.dept)}<label class="field"><span class="label">校種</span><select data-k="level"><option value="univ" ${row.level !== 'junior' ? 'selected' : ''}>四年制大学</option><option value="junior" ${row.level === 'junior' ? 'selected' : ''}>短期大学</option></select></label><label class="field"><span class="label">区分</span><select data-k="sec"><option value="shitei" ${row.sec !== 'open' ? 'selected' : ''}>指定校推薦</option><option value="open" ${row.sec === 'open' ? 'selected' : ''}>公募制推薦・一般推薦ほか</option></select></label>`;
    body.innerHTML = `<div class="grid">${head}</div><h3 style="margin:12px 0 4px">年度ごとの人数（令和${FY - 2018}年度は［進路決定］から自動）</h3><div class="ds-row">${years.map(y => `<label class="ds-f"><span>${Yr.label(y)}</span><input type="number" data-y="${y}" value="${row.counts[y] || ''}" class="w-num" style="width:64px"></label>`).join('')}</div>`;
    const buttons = []; if (id) buttons.push({ label: '削除', kind: 'danger-ghost', value: 'del' });
    buttons.push({ label: 'キャンセル', value: null }, { label: '保存', kind: 'primary', value: 'save' });
    const res = await UI.modal({ title: '実績の行', body, buttons, wide: true });
    if (res === 'save') {
      const v = {}; $$('[data-k]', body).forEach(e => { v[e.dataset.k] = e.value.trim(); });
      if (!(v.name || v.school)) { UI.toast('名前を入力してください', 'warn'); return; }
      Object.assign(row, v);
      $$('[data-y]', body).forEach(e => { const n = num(e.value); if (n) row.counts[e.dataset.y] = n; else delete row.counts[e.dataset.y]; });
      if (kind === 'senshu' && row.sec === 'shitei') row.field = '';
      if (!id) { row.id = uid(); H[kind].push(row); }
      Store.changed();
    } else if (res === 'del') { H[kind] = H[kind].filter(r => r.id !== id); Store.changed(); }
    if (res) UI.refresh();
  },

  /* ---------- Excel の取り込み ---------- */
  async importKind(kind) {
    let wb;
    try { wb = await Excel.pickWorkbook(); } catch (e) { UI.toast(e.message, 'error'); return; }
    if (!wb) return;
    const H = Store.data.history;
    const sheet = names => wb.Sheets[wb.SheetNames.find(n => names.some(x => n.includes(x))) || wb.SheetNames[0]];
    let parsed, label;
    try {
      if (kind === 'work') { parsed = History.parseWork(sheet(['就職'])); label = '就職先'; }
      else if (kind === 'senshu') { parsed = History.parseSenshu(sheet(['専修'])); label = '専修・各種学校'; }
      else if (kind === 'univ') { parsed = History.parseUniv(sheet(['大学', '短大'])); label = '四大・短大'; }
      else { parsed = History.parseMaster(wb); parsed.rows = null; label = '指定校一覧'; }
    } catch (e) { UI.toast('読み取れませんでした：' + e.message, 'error'); return; }
    const n = kind === 'master' ? parsed.master.univ.length + parsed.master.junior.length + parsed.master.senshu.length : parsed.rows.length;
    if (!n) { UI.toast('取り込める行がありません。ファイルを確かめてください', 'warn'); return; }
    const old = kind === 'master' ? (H.master ? H.master.univ.length + H.master.junior.length + H.master.senshu.length : 0) : H[kind].length;
    const body = document.createElement('div');
    body.innerHTML = `<p class="sub">ファイル：${esc(wb._fileName)}</p>
      <div class="notice notice-info"><b>${label}</b>：${n} 行を読み取りました。${parsed.years ? `年度の列：${parsed.years.map(Yr.label).join('・')}` : ''}${kind === 'master' ? `（${Yr.long(parsed.master.year || Store.data.year)}　四大${parsed.master.univ.length}・短大${parsed.master.junior.length}・専修${parsed.master.senshu.length}）` : ''}</div>
      ${parsed.warns.length ? `<div class="notice notice-warn"><b>確認が必要な点（${parsed.warns.length}）</b><br>${parsed.warns.slice(0, 8).map(esc).join('<br>')}${parsed.warns.length > 8 ? '<br>…' : ''}</div>` : ''}
      ${old ? `<p class="help">いまの実績（${old} 行）は、取り込む内容で<b>置き換わります</b>。</p>` : ''}`;
    const ok = await UI.modal({ title: `${label}を取り込む`, body, buttons: [{ label: 'キャンセル', value: null }, { label: '取り込む', kind: 'primary', value: 'ok' }] });
    if (ok !== 'ok') return;
    if (kind === 'master') { H.master = parsed.master; if (!H.master.year) H.master.year = Store.data.year - 1; }
    else H[kind] = parsed.rows;
    H.imported[kind] = { name: wb._fileName, at: new Date().toISOString(), rows: n };
    Store.changed(); UI.toast(`取り込みました（${n} 行）`); UI.refresh();
  },
};

Pages.register({ id: 'yearend', no: 10, group: '年度末', title: '年度末の資料', render: v => YearendPage.render(v) });
