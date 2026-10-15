'use strict';
/* ============================================================
   0. ダッシュボード
   ============================================================ */

Pages.register({
  id: 'dashboard', no: null, group: null, title: 'ホーム',
  render(view) {
    const d = Store.data;
    const done = DEFAULT_TASKS.filter(t => d.tasks[t.id]).length;
    const students = d.students.length;
    const wantJob = d.students.filter(s => s.course === '就職').length;
    const decided = d.applications.filter(a => a.result === '内定').length;
    const neverSaved = !Store.fileName;

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
      </section>`;

    $$('[data-task]', view).forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) d.tasks[cb.dataset.task] = true; else delete d.tasks[cb.dataset.task];
      Store.changed();
      UI.refresh();
    }));
  },
});
