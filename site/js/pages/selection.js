'use strict';
/* ============================================================
   4. 選考会議（1次）：第1〜第5希望 → 応募先の確定
   ============================================================ */

const PREF_N = 5;

const Selection = {
  state: { show: 'all', sort: 'rank', dir: 'asc' },   // show: all／open（未確定のみ）。sort: 並べ替えの列（既定は就職順位の昇順）

  /** 表示する項目（この端末のブラウザに覚える。データには入らない） */
  VIEW_ITEMS: [
    ['列', [['gender', '性別'], ['final', '最終P'], ['life', '生活P'], ['special', '特活P'], ['mogi', '模試']]],
    ['各希望欄', [['job', '職種'], ['warn', '注意（上位で確定済みなど）'], ['whos', '他の希望者'], ['count', '求人数・希望人数']]],
  ],
  view() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('shushoku.selView') || '{}'); } catch (e) { /* 既定を使う */ }
    const v = {};
    this.VIEW_ITEMS.forEach(([, items]) => items.forEach(([k]) => { v[k] = saved[k] !== false; }));
    return v;
  },
  setView(k, on) {
    const v = this.view(); v[k] = on;
    try { localStorage.setItem('shushoku.selView', JSON.stringify(v)); } catch (e) { /* 覚えられなくても、この回は使える */ }
  },
  viewClass() { const v = this.view(); return Object.keys(v).filter(k => !v[k]).map(k => 'h-' + k).join(' '); },

  /** 表の並び順（既定は就職順位の昇順。見出しを押して変える） */
  sortedSeekers() {
    const st = this.state;
    const get = (r, k) => ({
      rank: r.jobRank ?? null, no3: num(r.s.no3), name: r.s.name, gender: r.s.gender,
      final: r.p.final, life: r.p.life, special: r.p.special, mogi: r.s.mogi,
    })[k];
    return sortRows(this.seekers(), st.sort, st.dir, get);
  },

  seekers() {
    const rk = Points.ranking();
    return sortRows(rk.filter(r => Students.isJobSeeker(r.s)), 'jobRank', 'asc', r => r.jobRank ?? null);
  },

  /** 求人ごとの集計（1次の希望・確定） */
  jobStats() {
    const m = new Map();
    // 順位が付かない（成績が未入力の）生徒も、並びの順で上下を決める
    const rank = new Map(this.seekers().map((r, i) => [r.s.id, r.jobRank ?? (1e6 + i)]));
    this._rank = rank;
    const hasConf = new Set(Store.data.applications.filter(a => a.round === 1 && a.confirmed).map(a => a.studentId));
    const get = id => { if (!m.has(id)) m.set(id, { job: Jobs.byId(id), prefs: Array(PREF_N + 1).fill(0), total: 0, confirmed: 0, students: [], entries: [] }); return m.get(id); };
    for (const a of Store.data.applications) {
      if (a.round !== 1) continue;
      const s = Students.byId(a.studentId);
      if (!s || !Students.isJobSeeker(s)) continue;
      const x = get(a.jobId);
      x.prefs[a.pref]++;
      x.total++;
      if (a.confirmed) x.confirmed++;
      x.students.push(a);
      // held＝その生徒がこの求人を押さえている（確定済み、または確定がまだの生徒の第1希望）
      x.entries.push({ a, s, rank: rank.get(s.id) ?? Infinity, held: a.confirmed || (a.pref === 1 && !hasConf.has(s.id)) });
    }
    for (const x of m.values()) {
      x.cap = x.job ? Jobs.capacity(x.job) : 1;
      x.capGiven = !!(x.job && num(x.job.openings) > 0);
      x.over = x.confirmed > x.cap;
      x.entries.sort((p, q) => p.rank - q.rank);
    }
    return m;
  },

  jobLabel(job) {
    if (!job) return '<span class="tag tag-warn">求人が削除されています</span>';
    return `<span class="slot-co">${esc(job.company)}</span><span class="slot-job">${esc(job.jobTitle || '')}</span>${job.kind !== '一般' ? `<span class="tag tag-warn">${esc(job.kind)}</span>` : ''}`;
  },

  render(view) {
    const seekers = this.seekers();
    const confirmed = seekers.filter(r => Apps.prefs(r.s.id) && Object.values(Apps.prefs(r.s.id)).some(a => a.confirmed)).length;
    view.innerHTML = `
      <div class="page-head">
        <div><h1>選考会議（1次）</h1>
        <p class="lead">就職順位の順に、第1〜第5希望を<b>求人票の下4桁</b>で入力します（「…」で検索して選ぶこともできます）。確定する希望の<b>チェック（☑）</b>を入れてください（もう一度押すと外れます）。基本は<b>1人1社・求人1枚に1人</b>です。上位の人が確定した求人（確定がまだの人は、その人の第1希望）は、下位の欄が<b>灰色＋取り消し線</b>になり、誰が希望しているかを表示します（選ぶことはできます。募集が複数人の求人は、求人数を直してください）。</p></div>
        <div class="head-actions">
          <button class="btn" id="selImport">Excel から取り込む</button>
          <button class="btn" id="selAuto" ${seekers.length ? '' : 'disabled'}>上位から確定案を作る</button>
          <button class="btn" id="selXlsx" ${seekers.length ? '' : 'disabled'}>Excel に出力</button>
          <button class="btn btn-primary" id="selPrint" ${seekers.length ? '' : 'disabled'}>会議資料を印刷</button>
        </div>
      </div>
      ${seekers.length ? `
      <div class="stats stats-sm">
        <div class="stat"><span class="stat-label">就職希望者（学校斡旋）</span><span class="stat-val">${seekers.length}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">確定済み</span><span class="stat-val">${confirmed}</span><span class="stat-unit">人</span></div>
        <div class="stat"><span class="stat-label">未確定</span><span class="stat-val">${seekers.length - confirmed}</span><span class="stat-unit">人</span></div>
      </div>
      <div class="toolbar">
        <div class="seg">
          <button class="${this.state.show === 'all' ? 'on' : ''}" data-show="all">全員</button>
          <button class="${this.state.show === 'open' ? 'on' : ''}" data-show="open">未確定のみ</button>
        </div>
        <details class="sel-opts" id="selOpts"><summary>表示する項目</summary>
          <div class="sel-opts-body">${this.VIEW_ITEMS.map(([g, items]) => `<div><b>${g}</b>${items.map(([k, l]) => `<label class="check"><input type="checkbox" data-view="${k}" ${this.view()[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>`).join('')}</div>
        </details>
        <span class="sub">見出しを押すと並び替えます（初めは就職順位の昇順）</span>
      </div>
      <div class="table-wrap"><table class="tbl tbl-sel ${this.viewClass()}" id="selTable">
        <thead><tr>${[['rank', '順位', 'num c-rank'], ['no3', '番号・氏名', 'c-name'], ['gender', '性別', 'c c-gender'], ['final', '最終P', 'num c-final'], ['life', '生活', 'num c-life'], ['special', '特活', 'num c-special'], ['mogi', '模試', 'num c-mogi']]
          .map(([k, l, c]) => `<th class="${c} sortable ${this.state.sort === k ? 'sorted-' + this.state.dir : ''}" data-sort="${k}">${l}</th>`).join('')}
        ${Array.from({ length: PREF_N }, (_, i) => `<th>第${i + 1}希望</th>`).join('')}</tr></thead>
        <tbody>${this.sortedSeekers().map(r => this.rowHtml(r)).join('')}</tbody>
      </table></div>
      <h2 class="section-title">求人ごとの希望状況</h2>
      <p class="help">確定数が本校への求人数を超えると赤く表示します。行をクリックすると希望者の一覧を開きます。</p>
      <div id="selJobs"></div>` : `<div class="empty"><p class="empty-title">就職希望者（学校斡旋）がいません</p>
        <p>「生徒・成績」で進路希望調査を取り込むと、就職希望者が順位順に並びます。</p></div>`}`;

    $('#selImport', view).addEventListener('click', () => Importer.run('selection'));
    if (!seekers.length) return;
    this.bindTable($('#selTable', view));
    this.drawJobs($('#selJobs', view));
    this.applyFilter(view);
    $$('th[data-sort]', view).forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.sort, st = this.state;
      if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc'; else { st.sort = k; st.dir = 'asc'; }
      UI.refresh();
    }));
    $$('input[data-view]', view).forEach(cb => cb.addEventListener('change', () => {
      this.setView(cb.dataset.view, cb.checked);
      $('#selTable', view).className = 'tbl tbl-sel ' + this.viewClass();
    }));
    if (this.state.optsOpen) $('#selOpts', view).open = true;
    $('#selOpts', view).addEventListener('toggle', e => { this.state.optsOpen = e.target.open; });
    $$('[data-show]', view).forEach(b => b.addEventListener('click', () => { this.state.show = b.dataset.show; UI.refresh(); }));
    $('#selAuto', view).addEventListener('click', () => this.autoPropose());
    $('#selPrint', view).addEventListener('click', () => this.print());
    $('#selXlsx', view).addEventListener('click', () => this.excel());
  },

  applyFilter(view) {
    if (this.state.show !== 'open') return;
    $$('#selTable tbody tr', view).forEach(tr => {
      if (tr.classList.contains('is-confirmed')) tr.style.display = 'none';
    });
  },

  rowHtml(r) {
    const s = r.s;
    const prefs = Apps.prefs(s.id);
    const stats = this._stats || (this._stats = this.jobStats());
    const conf = Object.values(prefs).find(a => a.confirmed);
    const myRank = (this._rank || new Map()).get(s.id) ?? Infinity;
    const cells = Array.from({ length: PREF_N }, (_, i) => {
      const p = i + 1;
      const a = prefs[p];
      const job = a ? Jobs.byId(a.jobId) : null;
      const x = a ? stats.get(a.jobId) : null;
      // 自分より上位で確定している人数／同順位で確定している人数
      const others = x ? x.entries.filter(e => e.s.id !== s.id) : [];
      const ahead = others.filter(e => e.a.confirmed && e.rank < myRank).length;
      const tie = others.filter(e => e.a.confirmed && e.rank === myRank && myRank < 1e6).length;
      const heldAhead = others.filter(e => e.held && e.rank < myRank).length;
      const taken = !!x && heldAhead >= x.cap;                      // 上位が押さえていて枠が埋まっている
      const takenConf = !!x && ahead >= x.cap;                      // うち、確定済みで埋まっている
      const over = !!(a && a.confirmed && x && (ahead + tie >= x.cap));   // 自分が確定すると枠を超える
      const who = others.map(e => `<span class="who ${e.a.confirmed ? 'who-conf' : ''}" title="${e.a.confirmed ? '確定' : '希望'}（第${e.a.pref}希望）">${e.rank === Infinity ? '–' : e.rank}位 ${esc(e.s.name || e.s.no3)}${e.a.confirmed ? '◎' : ''}</span>`).join('');
      return `<td class="slot ${a && a.confirmed ? 'is-conf' : ''} ${taken ? 'is-taken' : ''} ${over ? 'is-over' : ''}">
        <div class="slot-in">
          <input class="slot-no" data-sid="${s.id}" data-pref="${p}" value="${esc(job ? Derive.short(job) : '')}" placeholder="${esc(job && !Derive.short(job) ? job.kind : '')}" inputmode="numeric" aria-label="第${p}希望の下4桁">
          <button class="icon-btn slot-pick" data-sid="${s.id}" data-pref="${p}" title="求人を検索して選ぶ" aria-label="検索">…</button>
          ${a ? `<label class="slot-conf" title="この希望で確定"><input type="checkbox" data-sid="${s.id}" data-pref="${p}" ${a.confirmed ? 'checked' : ''}></label>` : ''}
        </div>
        ${a ? `<div class="slot-name">${this.jobLabel(job)}</div>
        <div class="slot-who slot-warn">${taken ? `<b class="who-taken">${over ? '枠を超えています' : (takenConf ? '上位で確定済み' : '上位の第1希望（未確定）')}</b>` : (over ? '<b class="who-taken">枠を超えます</b>' : '')}${tie && !taken ? '<b class="who-tie">同順位の人も確定</b>' : ''}</div>
        <div class="slot-who slot-whos">${who ? `<span class="who-lab">希望</span>${who}` : '<span class="sub">他に希望者なし</span>'}</div>
        ${x ? `<button class="link-btn slot-cnt" data-editjob="${a.jobId}" title="求人数を変える（求人票を開く）">求人${x.cap}人${x.capGiven ? '' : '（未入力）'}／${x.total}人希望</button>` : ''}` : ''}
      </td>`;
    }).join('');
    return `<tr data-sid="${s.id}" class="${conf ? 'is-confirmed' : ''}">
      <td class="num c-rank"><b>${r.jobRank ?? '—'}</b>${r.jobRankTie ? '<br><span class="tag tag-info">同順位</span>' : ''}</td>
      <td><button class="link-btn stu-link" data-stu="${s.id}" title="生徒の情報を見る・直す"><span class="mono">${esc(s.no3)}</span> ${esc(s.name)}</button><br><span class="sub">${esc((Students.dept(s) || {}).short || '')}${s.hope ? '　' + esc(s.hope) : ''}</span>
        ${conf ? `<br><button class="link-btn" data-unconf="${s.id}">確定を解除</button>` : ''}</td>
      <td class="c c-gender sel-g sel-g-${s.gender === '男' ? 'm' : s.gender === '女' ? 'f' : ''}">${esc(s.gender)}</td>
      <td class="num c-final"><b>${r.p.final ?? ''}</b></td><td class="num c-life">${r.p.life}</td><td class="num c-special">${r.p.special}</td><td class="num c-mogi">${s.mogi ?? ''}</td>
      ${cells}</tr>`;
  },

  /** 行を描き直す。Tab で次の欄へ移った直後でもフォーカスを保つため、次のタイミングで行う */
  redrawRows() {
    setTimeout(() => {
      this._stats = null;
      const tbody = $('#selTable tbody');
      if (!tbody) return;
      const ae = document.activeElement;
      const keep = ae && ae.classList && ae.classList.contains('slot-no') ? [ae.dataset.sid, ae.dataset.pref] : null;
      tbody.innerHTML = this.sortedSeekers().map(r => this.rowHtml(r)).join('');
      this.drawJobs($('#selJobs'));
      this.applyFilter(document);
      if (keep) {
        const el = $(`.slot-no[data-sid="${keep[0]}"][data-pref="${keep[1]}"]`, tbody);
        if (el) { el.focus(); el.select(); }
      }
    }, 0);
  },

  bindTable(tbl) {
    tbl.addEventListener('change', e => {
      const t = e.target;
      if (t.classList.contains('slot-no')) this.setSlotByShort(t.dataset.sid, Number(t.dataset.pref), t.value);
      else if (t.type === 'checkbox') this.confirm(t.dataset.sid, Number(t.dataset.pref), t.checked);
    });
    tbl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.classList.contains('slot-no')) { e.preventDefault(); e.target.blur(); }
    });
    tbl.addEventListener('click', e => {
      const stu = e.target.closest('[data-stu]');
      if (stu) { StudentsPage.edit(stu.dataset.stu, this.seekers().map(x => x.s.id)).then(() => this.redrawRows()); return; }
      const pick = e.target.closest('.slot-pick');
      if (pick) return this.pickJob(pick.dataset.sid, Number(pick.dataset.pref));
      const ej = e.target.closest('[data-editjob]');
      if (ej) { Jobs.edit(ej.dataset.editjob).then(() => this.redrawRows()); return; }
      const un = e.target.closest('[data-unconf]');
      if (un) { Apps.of(un.dataset.unconf).forEach(a => { if (a.round === 1) a.confirmed = false; }); Store.changed(); this.redrawRows(); }
    });
  },

  /** 希望の求人を入れる・変える・消す。確定済みや記録（見学・送付・合否）がある希望は確認し、記録は新しい求人に引き継がない */
  async setSlot(studentId, pref, jobId) {
    const a = Apps.prefs(studentId)[pref];
    if (a && a.jobId === jobId) { this.redrawRows(); return; }
    if (a && Apps.hasRecord(a)) {
      const j = Apps.job(a);
      const ok = await UI.confirm(`第${pref}希望（${j ? j.company : '求人なし'}）は${a.confirmed ? '確定済みで、' : ''}職場見学・応募・合否などの記録を持っています。\n${jobId ? '別の求人に変える' : '消す'}と、この記録は消えます（新しい求人には引き継ぎません）。`, { ok: jobId ? '変える' : '消す', danger: true });
      if (!ok) { this.redrawRows(); return; }
    }
    if (a) Store.data.applications = Store.data.applications.filter(x => x !== a);
    if (jobId) Store.data.applications.push(blankApplication(studentId, jobId, 1, pref));
    Store.changed();
    this.redrawRows();
  },

  async setSlotByShort(studentId, pref, value) {
    const v = digits(value);
    if (!v) { this.setSlot(studentId, pref, null); return; }
    const hits = Jobs.byShort(v);
    if (hits.length === 1) return this.setSlot(studentId, pref, hits[0].id);
    if (!hits.length) { UI.toast(`下4桁「${v}」の求人票がありません`, 'warn'); this.redrawRows(); return; }
    this.pickJob(studentId, pref, v);
  },

  /** 求人の検索・選択ダイアログ */
  async pickJob(studentId, pref, preset = '') {
    const body = document.createElement('div');
    body.innerHTML = `<input type="search" id="pkQ" class="w-full" placeholder="下4桁・事業所名・職種で検索" value="${esc(preset)}">
      <div id="pkList" class="pick-list"></div>
      <button class="btn btn-sm btn-danger-ghost" id="pkClear">この希望を空にする</button>`;
    let chosen;
    const draw = () => {
      const q = toHalf($('#pkQ', body).value).trim().toLowerCase();
      const list = Store.data.jobs.filter(j => !q || [Derive.short(j), j.company, j.jobTitle, j.kana].some(v => v && toHalf(v).toLowerCase().includes(q))).slice(0, 80);
      $('#pkList', body).innerHTML = list.length ? list.map(j => `<button class="pick-item" data-id="${j.id}">
        <span class="mono">${esc(Derive.short(j) || '—')}</span><span class="pk-main"><b>${esc(j.company)}</b><small>${esc(j.jobTitle || '')}</small></span>${j.kind !== '一般' ? `<span class="tag tag-warn">${esc(j.kind)}</span>` : '<span></span>'}</button>`).join('')
        : '<p class="sub">見つかりません。事前選考・指名求人は「求人票」で区分を選んで登録してください。</p>';
    };
    const p = UI.modal({
      title: `第${pref}希望の求人を選ぶ`, body, wide: true, buttons: [{ label: 'キャンセル', value: null }],
      onOpen: root => {
        draw();
        $('#pkQ', root).addEventListener('input', draw);
        root.addEventListener('click', e => {
          const it = e.target.closest('.pick-item');
          if (it) { chosen = it.dataset.id; root.closest('.modal-backdrop').querySelector('[data-close]').click(); }
          if (e.target.id === 'pkClear') { chosen = ''; root.closest('.modal-backdrop').querySelector('[data-close]').click(); }
        });
      },
    });
    await p;
    if (chosen !== undefined) this.setSlot(studentId, pref, chosen || null);
    else this.redrawRows();
  },

  /** 確定のチェック。入れると、その生徒はこの希望だけが確定（1人1社）。外すと確定なしに戻る */
  confirm(studentId, pref, on = true) {
    Apps.of(studentId).forEach(a => { if (a.round === 1) a.confirmed = on && a.pref === pref; });
    Store.changed();
    this.redrawRows();
  },

  drawJobs(el) {
    if (!el) return;
    const stats = [...this.jobStats().values()].sort((a, b) => (b.over - a.over) || (b.total - a.total));
    if (!stats.length) { el.innerHTML = '<p class="sub">まだ希望が入力されていません。</p>'; return; }
    el.innerHTML = `<div class="table-wrap"><table class="tbl tbl-click">
      <thead><tr><th class="num">下4桁</th><th>事業所</th><th>職種</th><th class="num">求人数</th>
      ${Array.from({ length: PREF_N }, (_, i) => `<th class="num">第${i + 1}</th>`).join('')}<th class="num">希望計</th><th class="num">確定</th><th>状態</th></tr></thead>
      <tbody>${stats.map(x => `<tr data-job="${x.job ? x.job.id : ''}" class="${x.over ? 'row-over' : ''}">
        <td class="num mono">${esc(x.job ? Derive.short(x.job) : '')}</td><td>${esc(x.job ? x.job.company : '（削除済み）')}</td><td>${esc(x.job ? x.job.jobTitle : '')}</td>
        <td class="num">${x.cap}${x.capGiven ? '' : ' <span class="sub">（未入力→1）</span>'}</td>
        ${x.prefs.slice(1).map(n => `<td class="num">${n || ''}</td>`).join('')}
        <td class="num">${x.total}</td><td class="num"><b>${x.confirmed || ''}</b></td>
        <td>${x.over ? '<span class="tag tag-danger">求人数超過</span>' : x.confirmed === x.cap ? '<span class="tag tag-accent">枠いっぱい</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
    $$('tbody tr', el).forEach(tr => tr.addEventListener('click', () => tr.dataset.job && this.showJob(tr.dataset.job)));
  },

  showJob(jobId) {
    const job = Jobs.byId(jobId);
    const rk = new Map(Points.ranking().map(r => [r.s.id, r]));
    const list = Store.data.applications.filter(a => a.round === 1 && a.jobId === jobId)
      .map(a => ({ a, r: rk.get(a.studentId) })).filter(x => x.r && Students.isJobSeeker(x.r.s))
      .sort((x, y) => (x.r.jobRank ?? 1e9) - (y.r.jobRank ?? 1e9));
    UI.modal({
      title: `${job.company}　${job.jobTitle || ''}（求人 ${Jobs.capacity(job)} 人）`, wide: true,
      body: `<table class="tbl"><thead><tr><th class="num">順位</th><th>番号・氏名</th><th class="c">性別</th><th class="num">最終P</th><th class="num">生活</th><th class="num">特活</th><th class="num">模試</th><th>希望順</th><th>確定</th></tr></thead>
        <tbody>${list.map(({ a, r }) => `<tr><td class="num">${r.jobRank ?? ''}${r.jobRankTie ? ' <span class="tag tag-info">同順位</span>' : ''}</td>
          <td>${esc(r.s.no3)} ${esc(r.s.name)}</td><td class="num">${r.p.final}</td><td class="num">${r.p.life}</td><td class="num">${r.p.special}</td><td class="num">${r.s.mogi ?? ''}</td>
          <td>第${a.pref}希望</td><td>${a.confirmed ? '<b>確定</b>' : (Apps.current(r.s.id) ? '<span class="sub">他で確定</span>' : '')}</td></tr>`).join('')}</tbody></table>`,
    });
  },

  /**
   * 上位から確定案：確定済みの生徒はそのまま。未確定の生徒を就職順位の順に、
   * 第1希望から「確定数 < 求人数」の求人に確定する（求人数未入力は枠なし扱い）。
   * 同順位の生徒が残り枠を取り合う場合は確定せず、会議で判断するよう一覧に出す。
   */
  async autoPropose() {
    const seekers = this.seekers();
    const open = seekers.filter(r => !Object.values(Apps.prefs(r.s.id)).some(a => a.confirmed));
    if (!open.length) { UI.toast('未確定の生徒はいません'); return; }
    if (!await UI.confirm(`未確定の ${open.length} 人に、就職順位の上位から確定案を入れます。\n確定済みの生徒は変更しません。結果は会議で確認・修正してください。`, { ok: '確定案を作る' })) return;

    const count = new Map();
    for (const r of seekers) for (const a of Object.values(Apps.prefs(r.s.id))) if (a.confirmed) count.set(a.jobId, (count.get(a.jobId) || 0) + 1);
    const cap = jobId => { const j = Jobs.byId(jobId); return j ? Jobs.capacity(j) : 0; };
    const left = jobId => cap(jobId) - (count.get(jobId) || 0);

    // 同順位ごとのグループ
    const groups = [];
    for (const r of open) {
      const g = groups[groups.length - 1];
      if (g && r.jobRank != null && g[0].jobRank === r.jobRank) g.push(r); else groups.push([r]);
    }
    let done = 0;
    const conflicts = [], none = [];
    for (const g of groups) {
      const choice = g.map(r => {
        const prefs = Apps.prefs(r.s.id);
        for (let p = 1; p <= PREF_N; p++) if (prefs[p] && left(prefs[p].jobId) > 0) return { r, a: prefs[p] };
        return { r, a: null };
      });
      const byJob = new Map();
      choice.forEach(c => { if (c.a) byJob.set(c.a.jobId, (byJob.get(c.a.jobId) || []).concat(c)); else none.push(c.r); });
      for (const [jobId, cs] of byJob) {
        if (cs.length > left(jobId)) { conflicts.push({ job: Jobs.byId(jobId), cs }); continue; }
        cs.forEach(c => { c.a.confirmed = true; count.set(jobId, (count.get(jobId) || 0) + 1); done++; });
      }
    }
    Store.changed();
    UI.refresh();
    const msg = [`${done} 人に確定案を入れました。`];
    if (conflicts.length) msg.push('', '■ 同順位で枠を取り合うため未確定（規定3：会議で判断）',
      ...conflicts.map(c => `・${c.job.company} ${c.job.jobTitle || ''}：${c.cs.map(x => `${x.r.s.no3} ${x.r.s.name}`).join('、')}`));
    if (none.length) msg.push('', '■ 第1〜第5希望がすべて枠いっぱい・未入力のため未確定', ...none.map(r => `・${r.s.no3} ${r.s.name}`));
    UI.modal({ title: '確定案の結果', body: `<pre class="pre">${esc(msg.join('\n'))}</pre>` });
  },

  /** 自分より上位の生徒で、この求人を確定している人（「何位 番号 氏名 指名済」） */
  nominatedBy(stats, r, jobId) {
    const x = stats.get(jobId); if (!x) return [];
    const mine = (this._rank || new Map()).get(r.s.id) ?? Infinity;
    return x.entries.filter(e => e.s.id !== r.s.id && e.a.confirmed && e.rank < mine)
      .map(e => `${e.rank < 1e6 ? e.rank + '位' : '順位なし'} ${e.s.no3} ${e.s.name || ''} 指名済`);
  },

  table() {
    const head = ['順位', '番号', '氏名', '性別', '学科', '最終P', '生活P', '特活P', '模試', ...Array.from({ length: PREF_N }, (_, i) => `第${i + 1}希望`), '確定'];
    const stats = this.jobStats();
    const body = this.seekers().map(r => {
      const prefs = Apps.prefs(r.s.id);
      const conf = Object.values(prefs).find(a => a.confirmed);
      const lab = a => { if (!a) return ''; const j = Jobs.byId(a.jobId); return j ? `${Derive.short(j) ? '[' + Derive.short(j) + '] ' : ''}${j.company}／${j.jobTitle || ''}／求人${Jobs.capacity(j)}人${this.nominatedBy(stats, r, a.jobId).map(n => '\n' + n).join('')}` : ''; };
      return [r.jobRank ?? '', Number(r.s.no3), r.s.name, r.s.gender, (Students.dept(r.s) || {}).short || '', r.p.final ?? '', r.p.life, r.p.special, r.s.mogi ?? '',
        ...Array.from({ length: PREF_N }, (_, i) => lab(prefs[i + 1])), conf ? `第${conf.pref}希望` : ''];
    });
    return { head, body };
  },

  print() {
    const rows = this.seekers();
    const title = `${nendoLabel(Store.data.year)}　学校斡旋就職希望者　選考会議資料`;
    const stats = this.jobStats();   // 上位の確定を調べる（順位は this._rank）
    const cell = (a, j, r) => {
      if (!a) return '';
      const nom = this.nominatedBy(stats, r, a.jobId);
      return `<div class="${a.confirmed ? 'p-conf' : ''}"><span class="${nom.length ? 'p-strike' : ''}">${a.confirmed ? '◎ ' : ''}${esc(j ? (Derive.short(j) ? Derive.short(j) + ' ' : '') + j.company : '')}<br>`
        + `<span class="sm">${esc(j ? j.jobTitle || '' : '')}${j ? `　求人${Jobs.capacity(j)}人` : ''}</span></span>`
        + nom.map(n => `<br><span class="sm p-nom">${esc(n)}</span>`).join('') + `</div>`;
    };
    Print.open({
      title, orientation: 'landscape', margin: '8mm',
      html: `<div class="p-page"><p class="p-title">${esc(title)}</p>
        <p class="p-meta"><span>◎＝確定　／　※取扱注意（個人情報）</span><span>${todayISO()}　${rows.length} 人</span></p>
        <table class="p-table p-sel"><thead><tr><th>順位</th><th>番号</th><th>氏名</th><th>性</th><th>最終P</th><th>生活</th><th>特活</th><th>模試</th>
        ${Array.from({ length: PREF_N }, (_, i) => `<th>第${i + 1}希望</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => {
          const prefs = Apps.prefs(r.s.id);
          return `<tr><td class="num">${r.jobRank ?? ''}${r.jobRankTie ? '<span class="sm">同</span>' : ''}</td><td>${esc(r.s.no3)}</td><td>${esc(r.s.name)}</td><td class="c">${esc(r.s.gender)}</td>
            <td class="num">${r.p.final ?? ''}</td><td class="num">${r.p.life}</td><td class="num">${r.p.special}</td><td class="num">${r.s.mogi ?? ''}</td>
            ${Array.from({ length: PREF_N }, (_, i) => { const a = prefs[i + 1]; return `<td class="sm ${a && a.confirmed ? 'p-shade' : ''}">${cell(a, a && Jobs.byId(a.jobId), r)}</td>`; }).join('')}</tr>`;
        }).join('')}</tbody></table>
        <p class="p-note">網掛け・◎は確定。取り消し線は、上位の人が確定済み（指名済）の求人。</p></div>`,
    });
  },

  excel() {
    const { head, body } = this.table();
    Excel.download(`選考会議資料_R${reiwa(Store.data.year)}.xlsx`, [{ name: '選考会議', rows: [head, ...body], widths: [5, 7, 14, 5, 5, 7, 6, 6, 6, 30, 30, 30, 30, 30, 9] }]);
  },
};

Pages.register({ id: 'selection', no: 4, group: '選考', title: '選考会議', render: v => { Selection._stats = null; Selection.render(v); } });
