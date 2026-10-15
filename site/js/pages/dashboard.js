'use strict';
/* ============================================================
   0. ダッシュボード
   ============================================================ */

Pages.register({
  id: 'dashboard', no: null, group: null, title: 'ホーム',

  /** 内定状況：就職希望者（学校斡旋）ごとの今の状態 */
  status() {
    const seekers = Store.data.students.filter(s => Students.isJobSeeker(s));
    const rows = seekers.map(s => {
      const a = Apps.current(s.id);
      const state = !a ? 'none' : a.result === '内定' ? 'won' : (a.result === '不採用' || a.result === '辞退') ? 'next' : 'wait';
      return { s, a, state, dept: (Students.dept(s) || {}).name || '（学科なし）' };
    });
    const today = todayISO(), week = (() => { const x = new Date(); x.setDate(x.getDate() + 7); return new Date(x - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); })();   // 7日後（この PC の日付で）
    const cnt = k => rows.filter(r => r.state === k).length;
    return {
      seekers: rows.length, rows, won: cnt('won'), wait: cnt('wait'), next: cnt('next'), none: cnt('none'),
      unsent: rows.filter(r => r.a && !r.a.result && !r.a.docsSent).length,
      noReport: rows.filter(r => r.a && r.a.examDate && r.a.examDate <= today && !r.a.reportSubmitted).length,
      soon: rows.filter(r => r.a && !r.a.result && r.a.examDate && r.a.examDate >= today && r.a.examDate <= week).sort((x, y) => x.a.examDate.localeCompare(y.a.examDate)),
    };
  },
  statusHtml(st) {
    const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 + '%' : '—';
    const depts = [...new Set(st.rows.map(r => r.dept))];
    const line = (label, list) => {
      const g = k => list.filter(r => (k === '計' || r.s.gender === k));
      const w = k => g(k).filter(r => r.state === 'won').length;
      return `<tr><th>${esc(label)}</th>${['男', '女', '計'].map(k => `<td class="num">${g(k).length}</td>`).join('')}${['男', '女', '計'].map(k => `<td class="num">${w(k)}</td>`).join('')}<td class="num"><b>${pct(w('計'), g('計').length)}</b></td><td class="num">${list.filter(r => r.state !== 'won').length}</td></tr>`;
    };
    return `<section class="card">
      <div class="card-head"><h2>内定状況</h2><span class="sub">就職希望者（学校斡旋）${st.seekers} 人の、今の応募先の状態</span></div>
      <div class="stats stats-sm">
        <a class="stat" href="#/applications"><span class="stat-label">〇 内定</span><span class="stat-val">${st.won}</span><span class="stat-unit">人（${pct(st.won, st.seekers)}）</span></a>
        <a class="stat" href="#/applications"><span class="stat-label">結果待ち</span><span class="stat-val">${st.wait}</span><span class="stat-unit">人</span></a>
        <a class="stat" href="#/second"><span class="stat-label">次の応募先が必要</span><span class="stat-val">${st.next}</span><span class="stat-unit">人</span></a>
        <a class="stat" href="#/selection"><span class="stat-label">応募先が未確定</span><span class="stat-val">${st.none}</span><span class="stat-unit">人</span></a>
      </div>
      <div class="table-wrap"><table class="tbl tbl-compact dash-tbl">
        <thead><tr><th rowspan="2">学科</th><th colspan="3">就職希望者</th><th colspan="3">内定</th><th rowspan="2">内定率</th><th rowspan="2">未内定</th></tr>
          <tr><th>男</th><th>女</th><th>計</th><th>男</th><th>女</th><th>計</th></tr></thead>
        <tbody>${depts.map(dp => line(dp, st.rows.filter(r => r.dept === dp))).join('')}</tbody>
        <tfoot>${line('合計', st.rows)}</tfoot></table></div>
      <div class="dash-todo">
        ${st.unsent ? `<a href="#/applications" class="tag tag-warn">応募書類が未送付 ${st.unsent} 人</a>` : ''}
        ${st.noReport ? `<a href="#/applications" class="tag tag-warn">受験報告書が未提出 ${st.noReport} 人（試験日を過ぎた人）</a>` : ''}
        ${st.soon.length ? `<span class="sub">7日以内の試験：${st.soon.map(r => `${esc(r.a.examDate.slice(5).replace('-', '/'))} ${esc(r.s.name || r.s.no3)}（${esc((Apps.job(r.a) || {}).company || '')}）`).join('、')}</span>` : ''}
      </div>
    </section>`;
  },

  render(view) {
    const d = Store.data;
    const done = DEFAULT_TASKS.filter(t => d.tasks[t.id]).length;
    const students = d.students.length;
    const wantJob = d.students.filter(s => s.course === '就職').length;
    const decided = Apps.currents().filter(x => x.a.result === '内定').length;
    const neverSaved = !Store.fileName;
    const st = this.status();
    const online = /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);

    view.innerHTML = `
      <div class="page-head">
        <div><h1>${nendoLabel(d.year)}　就職選考</h1>
        <p class="lead">令和${reiwa(d.year) + 1}年3月卒業予定者の学校斡旋就職を、このページから順に進めます。</p></div>
      </div>

      ${!d.settings.school.name ? '<div class="notice notice-info"><b>最初に、<a href="#/settings">設定</a>で学校情報を入力してください。</b> 学校名・住所・電話・校長名・進路指導主事名・管内の市町などが、帳票や様式13に入ります。保存したデータファイルを開くと、そこに入っている学校情報が使われます。</div>' : ''}

      ${neverSaved ? `<div class="notice notice-warn">
        <b>まだデータファイルに保存していません。</b> 入力内容はこのブラウザに一時保存されていますが、PCの入れ替えやブラウザの掃除で消えることがあります。
        右上の「名前を付けて保存」で、共有しない場所（USB など）に保存してください。
      </div>` : ''}

      <div class="stats">
        <a class="stat" href="#/jobs"><span class="stat-label">求人票</span><span class="stat-val">${d.jobs.length}</span><span class="stat-unit">件</span></a>
        <a class="stat" href="#/students"><span class="stat-label">生徒（就職希望）</span><span class="stat-val">${wantJob}</span><span class="stat-unit">／ ${students} 人</span></a>
        <a class="stat" href="#/selection"><span class="stat-label">応募先の確定</span><span class="stat-val">${d.applications.filter(a => a.confirmed).length}</span><span class="stat-unit">件</span></a>
        <a class="stat" href="#/applications"><span class="stat-label">内定</span><span class="stat-val">${decided}</span><span class="stat-unit">人</span></a>
      </div>

      ${st.seekers ? this.statusHtml(st) : ''}

      <section class="card">
        <div class="card-head"><h2>年間の流れ</h2><span class="sub">${done} ／ ${DEFAULT_TASKS.length} 完了</span></div>
        <div class="progress"><span style="width:${Math.round(done / DEFAULT_TASKS.length * 100)}%"></span></div>
        <ol class="tasks">
          ${DEFAULT_TASKS.map(t => {
            const p = Pages.get(t.page);
            return `<li class="${d.tasks[t.id] ? 'is-done' : ''}">
              <label class="task-check"><input type="checkbox" data-task="${t.id}" ${d.tasks[t.id] ? 'checked' : ''}></label>
              <span class="task-when">${esc(t.when)}</span>
              <span class="task-title">${esc(t.title)}</span>
              ${p ? `<a class="task-link" href="#/${p.id}">${esc(p.title)} →</a>` : ''}
            </li>`;
          }).join('')}
        </ol>
      </section>

      <section class="card card-quiet">
        <h2>データの扱い</h2>
        <ul class="plain">
          <li>このサイトはインターネットに接続しません。データは保存した JSON ファイル1つにまとまります。</li>
          <li>生徒の個人情報を含むため、保存先は校内の決められた場所（または USB）にしてください。</li>
          <li>作業の終わりには右上の「上書き保存」（Ctrl+S）を押してください。</li>
        </ul>
      </section>

      ${online ? `<section class="card card-quiet">
        <h2>配布用の zip（USB・インターネットのない PC 用）</h2>
        <p>このサイト一式（プログラムと説明書。<b>データは入っていません</b>）を zip でダウンロードできます。展開して「起動.bat」をダブルクリックすると、インターネットなしで使えます。</p>
        <p><a class="btn btn-primary" href="download/shushoku-senko.zip" download>zip をダウンロード（v${esc(APP.version)}）</a></p>
        <p class="help">ダウンロードした zip は、右クリック →［プロパティ］→［許可する］にチェックを入れてから展開してください。zip の中のまま「起動.bat」を開くと動きません。</p>
      </section>` : ''}`;

    $$('[data-task]', view).forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) d.tasks[cb.dataset.task] = true; else delete d.tasks[cb.dataset.task];
      Store.changed();
      UI.refresh();
    }));
  },
});
