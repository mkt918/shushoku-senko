'use strict';
/* ============================================================
   5. 職場見学
   ============================================================ */

const VisitsPage = {
  state: { tab: 'plan', onlyOpen: true, sel: null, letter: 'both', start: 1, seatRows: 10, seatBlocks: 4, seatFront: 'top', seatJob: false, groupN: 4 },

  groups() { return Docs.jobGroups(a => a.confirmed && (!this.state.onlyOpen || !a.visitDone)); },

  render(view) {
    const st = this.state;
    const groups = this.groups();
    const tabs = [['plan', '電話連絡・日程'], ['letter', '依頼文・確認書'], ['label', '宛名ラベル'], ['guide', '事前指導（座席・出欠）']];
    view.innerHTML = `
      <div class="page-head"><div><h1>職場見学</h1>
      <p class="lead">選考会議で確定した応募先を求人ごとにまとめています。電話連絡の分担と日程を入力し、依頼文・確認書と宛名ラベルを印刷します。</p></div>
      <div class="head-actions"><label class="check"><input type="checkbox" id="vOnlyOpen" ${st.onlyOpen ? 'checked' : ''}> 見学が済んでいない分だけ</label></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      <div id="vBody"></div>`;
    $$('[data-tab]', view).forEach(b => b.addEventListener('click', () => { st.tab = b.dataset.tab; UI.refresh(); }));
    $('#vOnlyOpen', view).addEventListener('change', e => { st.onlyOpen = e.target.checked; st.sel = null; UI.refresh(); });
    if (!Apps.currents().length && st.tab !== 'guide') {
      $('#vBody', view).innerHTML = `<div class="empty"><p class="empty-title">確定した応募先がありません</p><p>「選考会議（1次）」で応募先を確定すると、ここに求人ごとに並びます。</p></div>`;
      return;
    }
    this['draw_' + st.tab]($('#vBody', view), groups);
  },

  /* 選択リスト（依頼文・ラベル用） */
  selectable(groups) {
    const st = this.state;
    if (!st.sel) st.sel = new Set(groups.map(g => g.job.id));
    return `<div class="table-wrap"><table class="tbl" id="vSel"><thead><tr><th><input type="checkbox" id="vAll" ${groups.length && groups.every(g => st.sel.has(g.job.id)) ? 'checked' : ''}></th>
      <th class="num">下4桁</th><th>事業所</th><th>職種</th><th>見学者</th><th>見学日</th><th>宛先</th></tr></thead>
      <tbody>${groups.map(g => { const dest = Derive.sendTo(g.job); const dates = [...new Set(g.apps.map(x => x.a.visitDate).filter(Boolean))]; return `<tr>
        <td><input type="checkbox" data-job="${g.job.id}" ${st.sel.has(g.job.id) ? 'checked' : ''}></td>
        <td class="num mono">${esc(Derive.short(g.job))}</td><td>${esc(g.job.company)}</td><td>${esc(g.job.jobTitle || '')}</td>
        <td class="sm num">${g.apps.length} 人</td><td class="sm">${dates.map(fmtMD).join('、') || '<span class="sub">未定</span>'}</td>
        <td class="sm">${dest.address ? esc(Derive.withPref(dest.address, dest.zip)) : '<span class="tag tag-warn">住所未入力</span>'}</td></tr>`; }).join('')}</tbody></table></div>`;
  },
  bindSelectable(root, groups) {
    const st = this.state;
    $('#vAll', root).addEventListener('change', e => { groups.forEach(g => e.target.checked ? st.sel.add(g.job.id) : st.sel.delete(g.job.id)); $$('[data-job]', root).forEach(c => { c.checked = e.target.checked; }); });
    $('#vSel', root).addEventListener('change', e => { const j = e.target.dataset.job; if (j) e.target.checked ? st.sel.add(j) : st.sel.delete(j); });
  },
  picked(groups) { return groups.filter(g => this.state.sel.has(g.job.id)); },

  /** 時間を hh:mm にそろえる（930→09:30、9:30→09:30）。「9:00～」のような書き方は、そのまま */
  hm(v) {
    const s = toHalf(String(v ?? '')).replace(/[：.]/g, ':').trim();
    const m = s.match(/^(\d{1,2}):?(\d{2})$/);
    if (!m) return s;
    return String(m[1]).padStart(2, '0') + ':' + m[2];
  },

  /* ---------- 電話連絡・日程 ---------- */
  draw_plan(el, groups) {
    const callers = [...new Set(Store.data.applications.map(a => a.visitCaller).filter(Boolean))];
    const inp = (a, k, type = 'text', cls = '') => `<input type="${type}" data-aid="${a.id}" data-f="${k}" value="${esc(a[k] || '')}" class="${cls}" ${k === 'visitCaller' ? 'list="callers"' : ''} ${k === 'visitTime' ? 'maxlength="5" placeholder="hh:mm"' : ''}>`;
    el.innerHTML = `
      <datalist id="callers">${callers.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="toolbar">
        <button class="btn btn-primary" id="vPrint">分担表を印刷</button>
        <button class="btn" id="vXlsx">Excel に出力</button>
        <span class="sub">${groups.length} 社／${groups.reduce((n, g) => n + g.apps.length, 0)} 人</span>
      </div>
      <div class="table-wrap"><table class="tbl tbl-edit tbl-visit">
        <thead><tr><th>担当</th><th class="num">番号</th><th>氏名</th><th>事業所</th><th>見学日</th><th>時間</th><th>備考（電話の内容など）</th><th>済</th></tr></thead>
        ${groups.map(g => { const j = g.job; const dest = Derive.sendTo(j); return `<tbody class="vgroup" data-job="${j.id}">
          <tr class="vc-head"><td colspan="8">
            <div class="vc-line"><h3 class="vc-title"><span class="mono">${esc(Derive.short(j))}</span> ${esc(j.company)}　<span class="sub">${esc(j.jobTitle || '')}</span>　<span class="tag">${g.apps.length}人</span></h3>
              <button class="btn btn-sm" data-edit="${j.id}">求人票を開く</button></div>
            <div class="sub">窓口：${esc([j.dept, j.contact].filter(Boolean).join('　') || '未入力')}　TEL：${esc(j.tel || '未入力')}　送付先：${esc(dest.address || '未入力')}${dest.changed ? '（変更あり）' : ''}${j.visitOk || j.visitInfo ? `　／　見学の受け入れ：${esc(j.visitOk || '')} ${esc(j.visitInfo || '')}` : ''}</div></td></tr>
          ${g.apps.map(({ a, s }) => `<tr class="vrow"><td>${inp(a, 'visitCaller', 'text', 'w-s')}</td><td class="num mono">${esc(s.no3)}</td><td class="nowrap">${esc(s.name)}</td>
            <td class="sm"><span class="mono">${esc(Derive.short(j))}</span> ${esc(j.company)}</td>
            <td>${inp(a, 'visitDate', 'date')}</td><td>${inp(a, 'visitTime', 'text', 'w-hm')}</td>
            <td>${inp(a, 'visitNote', 'text', 'w-memo2')}</td><td class="c"><input type="checkbox" data-aid="${a.id}" data-f="visitDone" ${a.visitDone ? 'checked' : ''}></td></tr>`).join('')}
        </tbody>`; }).join('')}
      </table></div>`;

    el.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.aid) {
        const a = Store.data.applications.find(x => x.id === t.dataset.aid);
        if (t.dataset.f === 'visitTime') t.value = VisitsPage.hm(t.value);
        a[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value.trim();
        Store.changed();
        if (t.dataset.f === 'visitDone' && this.state.onlyOpen) UI.refresh();
      }
    });
    el.addEventListener('click', e => {
      const ed = e.target.closest('[data-edit]');
      if (ed) return Jobs.edit(ed.dataset.edit).then(() => UI.refresh());
    });
    $('#vPrint', el).addEventListener('click', () => Docs.printCallTable(groups));
    $('#vXlsx', el).addEventListener('click', () => Docs.excelCallTable(groups));
  },

  /* ---------- 依頼文・確認書 ---------- */
  draw_letter(el, groups) {
    const st = this.state, d = Store.data.settings.docs;
    el.innerHTML = `
      ${Docs.principalMissing() ? '<div class="notice notice-warn">校長名・進路指導主事名が未入力です。「設定」で入力してください（依頼文に入ります）。</div>' : ''}
      <div class="toolbar">
        <label class="inline">依頼文の日付 <input id="lDate" value="${esc(d.visitLetterDate)}" placeholder="${esc(Docs.visitDateText())}" style="width:190px"></label>
        <select id="lWhat"><option value="both" ${st.letter === 'both' ? 'selected' : ''}>依頼文＋確認書</option><option value="letter" ${st.letter === 'letter' ? 'selected' : ''}>依頼文のみ</option><option value="confirm" ${st.letter === 'confirm' ? 'selected' : ''}>確認書のみ</option></select>
        <button class="btn btn-primary" id="lPrint">印刷（選んだ求人）</button>
      </div>
      <p class="help">1社につき、依頼文1枚＋確認書1枚（見学する生徒の氏名・職種・求人番号入り）です。見学日は、その求人の全員が同じ日のときだけ確認書に入ります。</p>
      ${this.selectable(groups)}`;
    this.bindSelectable(el, groups);
    $('#lDate', el).addEventListener('change', e => { Store.data.settings.docs.visitLetterDate = e.target.value.trim(); Store.changed(); });
    $('#lWhat', el).addEventListener('change', e => { st.letter = e.target.value; });
    $('#lPrint', el).addEventListener('click', () => Docs.printVisitDocs(this.picked(groups), st.letter));
  },

  /* ---------- 宛名ラベル ---------- */
  draw_label(el, groups) {
    const st = this.state, L = Store.data.settings.labels.visit;
    el.innerHTML = `
      <div class="toolbar">
        <label class="inline">開始位置 <input type="number" id="bStart" value="${st.start}" min="1" max="${L.cols * L.rows}" style="width:64px"></label>
        <span class="sub">用紙：${L.cols}列×${L.rows}段（幅 ${L.w}mm・高さ ${String(L.rowH || '').trim() ? '段ごとに設定' : L.h + 'mm'}）。使いかけの用紙は、空いている最初のラベルの番号（左上が1、右へ数える）を指定します。</span>
        <button class="btn btn-primary" id="bPrint">宛名ラベルを印刷（選んだ求人）</button>
      </div>
      <p class="help">宛先は求人票の「書類の送付先」があればそちら、なければ事業所の住所を使います。用紙の寸法は「設定」で変更できます。</p>
      ${this.selectable(groups)}`;
    this.bindSelectable(el, groups);
    $('#bPrint', el).addEventListener('click', () => { st.start = Math.max(1, num($('#bStart', el).value) || 1); Docs.printLabels(this.picked(groups), 'visit', st.start); });
  },

  /* ---------- 事前指導（座席表・出欠票） ---------- */
  draw_guide(el) {
    const st = this.state;
    const seekers = Selection.seekers().map(r => r.s);
    const noGroup = seekers.filter(s => !s.group).length;
    el.innerHTML = `
      <section class="card">
        <h2>グループ分け</h2>
        <p class="sub">職場見学のグループ（G分け）は「生徒・成績」の見学グループ欄で個別に直せます。ここでは就職順位の順に、グループへ交互に振り分けます。</p>
        <div class="toolbar"><label class="inline">グループ数 <input type="number" id="gN" value="${st.groupN}" min="1" max="20" style="width:64px"></label>
        <button class="btn" id="gAssign" ${seekers.length ? '' : 'disabled'}>就職希望者に割り振る</button>
        <span class="sub">${seekers.length} 人中、未設定 ${noGroup} 人</span></div>
      </section>
      <section class="card">
        <h2>事前指導の座席表</h2>
        <p class="sub">対象：応募先が確定している生徒（番号順）。2席×ブロック数で、ブロックごとに上から詰めます。</p>
        <div class="toolbar">
          <label class="inline">行数 <input type="number" id="sRows" value="${st.seatRows}" min="1" max="30" style="width:64px"></label>
          <label class="inline">ブロック数 <input type="number" id="sBlocks" value="${st.seatBlocks}" min="1" max="8" style="width:64px"></label>
          <label class="inline">黒板の位置 <select id="sFront"><option value="top" ${st.seatFront === 'top' ? 'selected' : ''}>上</option><option value="bottom" ${st.seatFront === 'bottom' ? 'selected' : ''}>下（後ろから見た向き）</option></select></label>
          <label class="check"><input type="checkbox" id="sJob" ${st.seatJob ? 'checked' : ''}> 就職先を書く</label>
          <button class="btn btn-primary" id="sPrint">座席表を印刷</button></div>
      </section>
      <section class="card">
        <h2>出欠・提出物の確認票</h2>
        <p class="sub">就職希望者をグループごとに1枚ずつ印刷します（学科・番号・氏名・出欠連絡・提出物・備考）。</p>
        <button class="btn btn-primary" id="aPrint" ${seekers.length ? '' : 'disabled'}>出欠票を印刷</button>
      </section>`;
    $('#gAssign', el).addEventListener('click', async () => {
      const n = Math.max(1, num($('#gN', el).value) || 1);
      st.groupN = n;
      if (noGroup < seekers.length && !await UI.confirm('すでにグループが入っている生徒も、割り振り直します。', { ok: '割り振る' })) return;
      seekers.forEach((s, i) => { s.group = String(i % n + 1); });
      Store.changed();
      UI.refresh();
      UI.toast(`${n} グループに割り振りました`);
    });
    $('#sPrint', el).addEventListener('click', () => {
      st.seatRows = Math.max(1, num($('#sRows', el).value) || 10);
      st.seatBlocks = Math.max(1, num($('#sBlocks', el).value) || 4);
      st.seatFront = $('#sFront', el).value; st.seatJob = $('#sJob', el).checked;
      const ids = new Set(Apps.currents().map(x => x.s.id));
      const students = Store.data.students.filter(s => ids.has(s.id)).sort((a, b) => num(a.no3) - num(b.no3));
      if (!students.length) { UI.toast('応募先が確定した生徒がいません', 'warn'); return; }
      const over = Docs.printSeating(students, { rows: st.seatRows, blocks: st.seatBlocks, front: st.seatFront, job: st.seatJob, note: nendoLabel(Store.data.year) });
      if (over > 0) UI.toast(`座席が ${over} 人分足りません。行数かブロック数を増やしてください`, 'warn');
    });
    $('#aPrint', el).addEventListener('click', () => Docs.printAttendance(seekers, `${nendoLabel(Store.data.year)}　職場見学　出欠・提出物確認票`));
  },
};

Pages.register({ id: 'visits', no: 5, group: '見学・応募', title: '職場見学', render: v => VisitsPage.render(v) });
