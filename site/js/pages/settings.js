'use strict';
/* ============================================================
   8. 設定
   ============================================================ */

/** "a.b.0.c" 形式のパスで値を取得・設定 */
function getPath(o, path) { return path.split('.').reduce((x, k) => (x == null ? x : x[k]), o); }
function setPath(o, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  const t = ks.reduce((x, k) => x[k], o);
  t[last] = v;
}

const Settings = {
  render(view) {
    const d = Store.data;
    const s = d.settings;
    const inp = (path, { type = 'text', cls = '', ph = '' } = {}) =>
      `<input data-path="${path}" data-type="${type}" class="${cls}" value="${esc(getPath(s, path) ?? '')}" placeholder="${esc(ph)}" ${type === 'number' ? 'inputmode="decimal"' : ''} autocomplete="off">`;
    const pr = s.pointRules;

    view.innerHTML = `
      <div class="page-head"><div><h1>設定</h1>
      <p class="lead">帳票に入る学校情報や、学科の判定・校内選考規定の値をここで管理します。変更はすぐに反映されます。</p></div></div>
      <nav class="toc" id="setToc"></nav>

      <section class="card">
        <h2>年度</h2>
        <div class="grid">
          <div class="field narrow"><label class="label">年度（西暦）</label>
            <input id="setYear" value="${d.year}" inputmode="numeric"><span class="help">${nendoLabel(d.year)}／令和${reiwa(d.year) + 1}年3月卒業予定</span></div>
        </div>
      </section>

      <section class="card">
        <h2>学校情報</h2>
        <p class="sub">送付状・依頼文・報告書に入ります。校長名と進路指導主事名は年度ごとに確認してください。</p>
        <div class="grid">
          <div class="field wide"><label class="label">学校名</label>${inp('school.name')}</div>
          <div class="field"><label class="label">報告書での表記</label>${inp('school.reportName')}</div>
          <div class="field narrow"><label class="label">郵便番号</label>${inp('school.zip')}</div>
          <div class="field wide"><label class="label">所在地</label>${inp('school.address')}</div>
          <div class="field"><label class="label">電話</label>${inp('school.tel')}</div>
          <div class="field"><label class="label">FAX</label>${inp('school.fax')}</div>
          <div class="field"><label class="label">校長名</label>${inp('school.principal')}</div>
          <div class="field"><label class="label">進路指導主事名</label>${inp('school.director')}</div>
          <div class="field"><label class="label">連絡先の部署</label>${inp('school.dept')}</div>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>学科の判定（3年生の番号）</h2><button class="btn btn-sm" id="deptAdd">＋ 行を追加</button></div>
        <p class="sub">番号の範囲で学科を決めます。報告書の集計（大学科別）にも使います。</p>
        <div class="table-wrap"><table class="tbl tbl-edit">
          <thead><tr><th>開始番号</th><th>終了番号</th><th>大学科</th><th>学科名</th><th>略称</th><th>様式13の列</th><th>統計調査の学科</th><th>統計コード</th><th></th></tr></thead>
          <tbody>${s.departments.map((dp, i) => `<tr>
            <td>${inp(`departments.${i}.from`, { type: 'number', cls: 'w-num' })}</td>
            <td>${inp(`departments.${i}.to`, { type: 'number', cls: 'w-num' })}</td>
            <td>${inp(`departments.${i}.major`, { cls: 'w-s' })}</td>
            <td>${inp(`departments.${i}.name`)}</td>
            <td>${inp(`departments.${i}.short`, { cls: 'w-xs' })}</td>
            <td>${inp(`departments.${i}.report`, { cls: 'w-s' })}</td>
            <td>${inp(`departments.${i}.stat`)}</td>
            <td>${inp(`departments.${i}.statCode`, { cls: 'w-xs' })}</td>
            <td><button class="icon-btn" data-del-dept="${i}" aria-label="削除">×</button></td></tr>`).join('')}</tbody>
        </table></div>
      </section>

      <section class="card">
        <h2>管内・管外の判定</h2>
        <p class="sub">求人番号の先頭5桁（受理安定所）で判定します。先頭2桁が本校の都道府県番号なら「管外」、それ以外は「県外」です。</p>
        <div class="grid">
          <div class="field"><label class="label">管内の安定所コード（カンマ区切り）</label>
            <input id="kannaiCodes" value="${esc(s.kannaiOfficeCodes.join(', '))}">
            <span class="help">${s.kannaiOfficeCodes.map(c => `${c}＝${OFFICE_CODES[c] || '？'}`).join('、')}</span></div>
          <div class="field"><label class="label">様式13の「管内」の市町（カンマ区切り）</label>
            <input id="kannaiCities" value="${esc(s.kannaiCities.join(', '))}">
            <span class="help">就業場所の最初の地名で判定します</span></div>
          <div class="field narrow"><label class="label">本校の都道府県番号</label>${inp('homePref', { cls: 'w-xs' })}
            <span class="help">${esc(PREFS[Number(s.homePref)] || '')}</span></div>
        </div>
      </section>

      <section class="card">
        <h2>校内選考規定の値</h2>
        <p class="sub">「校内選考に関する規定（R2施行）」Ⅰ-2 の値です。規定が改正されたときだけ変更してください。</p>
        <div class="rule-grid">
          <div>
            <h3>欠席ポイント</h3>
            <table class="tbl tbl-edit tbl-compact"><thead><tr><th>欠席の合計（以下）</th><th>ポイント</th></tr></thead><tbody>
            ${pr.absence.map((r, i) => `<tr><td>${inp(`pointRules.absence.${i}.max`, { type: 'number', cls: 'w-num' })} 日</td><td>${inp(`pointRules.absence.${i}.p`, { type: 'number', cls: 'w-num' })}</td></tr>`).join('')}
            </tbody></table><p class="help">これを超えると加算なし</p>
          </div>
          <div>
            <h3>遅刻・早退ポイント</h3>
            <table class="tbl tbl-edit tbl-compact"><thead><tr><th>遅刻＋早退（以下）</th><th>ポイント</th></tr></thead><tbody>
            ${pr.lateEarly.map((r, i) => `<tr><td>${inp(`pointRules.lateEarly.${i}.max`, { type: 'number', cls: 'w-num' })} 回</td><td>${inp(`pointRules.lateEarly.${i}.p`, { type: 'number', cls: 'w-num' })}</td></tr>`).join('')}
            </tbody></table>
          </div>
          <div>
            <h3>その他の加算</h3>
            <table class="tbl tbl-edit tbl-compact"><tbody>
              <tr><td>3年で謹慎なし</td><td>${inp('pointRules.noDiscipline3', { type: 'number', cls: 'w-num' })}</td></tr>
              <tr><td>1・2年で謹慎なし</td><td>${inp('pointRules.noDiscipline12', { type: 'number', cls: 'w-num' })}</td></tr>
              <tr><td>3年で部活動在籍</td><td>${inp('pointRules.club', { type: 'number', cls: 'w-num' })}</td></tr>
              <tr><td>部長経験</td><td>${inp('pointRules.captain', { type: 'number', cls: 'w-num' })}</td></tr>
              <tr><td>生徒会役員（1期あたり）</td><td>${inp('pointRules.councilPer', { type: 'number', cls: 'w-num' })}</td></tr>
              <tr><td>生徒会の上限</td><td>${inp('pointRules.councilMax', { type: 'number', cls: 'w-num' })}</td></tr>
            </tbody></table>
          </div>
        </div>
      </section>

      <section class="card">
        <h2>時候の挨拶（送付状）</h2>
        <p class="sub">送付状の日付の月で自動的に選ばれます。</p>
        <div class="greet-grid">${s.greetings.map((g, i) => `<label><span>${i + 1}月</span>${inp(`greetings.${i}`)}</label>`).join('')}</div>
      </section>

      <section class="card">
        <h2>宛名ラベル用紙</h2>
        <p class="sub">初期値は、現行の様式（PDF）に合わせてあります。職場見学の宛名は A4 12面（2列×6段・幅 87.2mm・段の高さは下の「段ごとの高さ」）、応募書類（レターパック）の宛名は A4 4面（2列×2段・100.3×140.8mm・上 7.6mm・左 4.7mm）です。ラベルの寸法が違うときは、面数と寸法（mm）を入れ替えてください。</p>
        ${['visit', 'envelope'].map(k => `<h3>${esc(s.labels[k].name)}</h3>
        <div class="grid grid-labels">
          ${[['cols', '列数'], ['rows', '段数'], ['w', '幅'], ['h', '高さ'], ['top', '上余白'], ['left', '左余白'], ['gapX', '列の間隔'], ['gapY', '段の間隔']]
            .map(([f, l]) => `<div class="field narrow"><label class="label">${l}</label>${inp(`labels.${k}.${f}`, { type: 'number', cls: 'w-num' })}</div>`).join('')}
        </div>
        <div class="field"><label class="label">段ごとの高さ（mm・カンマ区切り。段数ぶん。空欄なら「高さ」をすべての段に使う）</label>${inp(`labels.${k}.rowH`, { ph: '例：39.2,39.2,39.2,43.5,43.5,43.5' })}</div>`).join('')}
      </section>

      <section class="card">
        <h2>自動バックアップ</h2>
        ${Backup.supported() ? `<p>バックアップのフォルダ：<b id="bkName">確認中…</b></p>
        <p class="help">フォルダを決めておくと、「上書き保存」「名前を付けて保存」のたびに、<b>日時入りのコピー</b>（例：就職選考データ_R8年度_バックアップ_20261016-1530.json）をそのフォルダに残します（10分に1回まで。新しい順に${Backup.KEEP}個を残し、古いものは消します）。暗号化の設定があれば、コピーも暗号化されます。保存先と同じく、校内の決められた場所（または USB）にしてください。</p>
        <div class="btn-row"><button class="btn btn-primary" id="bkChoose">フォルダを選ぶ</button><button class="btn" id="bkNow">今すぐバックアップ</button><button class="btn btn-danger-ghost" id="bkOff">自動バックアップをやめる</button></div>`
          : '<p class="help">このブラウザでは使えません（Edge／Chrome で開いてください）。</p>'}
      </section>

      <section class="card">
        <h2>みんなで見る（共有フォルダに公開）</h2>
        ${Share.supported() ? `<p>公開するフォルダ：<b id="shName">確認中…</b></p>
        <p class="help">SharePoint の同期フォルダの中に、このツールの <b>site フォルダ</b>を置き、ここでそのフォルダを一度だけ選びます。以後、<b>［上書き保存］のたびに</b>最新のデータが自動で公開されます。ほかの先生は、同じフォルダの<b>「閲覧.html」をダブルクリックするだけ</b>で、いつでも最新の内容を見られます（閲覧専用。約30秒ごとに自動で更新）。編集できるのは、ここで公開する人だけです。</p>
        <p class="help">${Store.crypt ? '暗号化の設定があるので、公開されるデータも暗号化されます。閲覧する人は、最初の1回だけパスワードを入れます。' : '<b>暗号化していません。</b>共有フォルダを見られる人は、中身をすべて読めます。生徒の個人情報が入るので、下の「データの暗号化」を設定してから公開することをおすすめします。'}</p>
        <div class="btn-row"><button class="btn btn-primary" id="shChoose">フォルダを選ぶ</button><button class="btn" id="shNow">今すぐ公開</button><button class="btn btn-danger-ghost" id="shOff">公開をやめる</button></div>`
          : '<p class="help">このブラウザでは使えません（Edge／Chrome で開いてください）。</p>'}
      </section>

      <section class="card">
        <h2>データの暗号化（保存ファイルにパスワード）</h2>
        ${Crypt.ok() ? `<p>今の状態：<b>${Store.crypt ? '暗号化して保存します' : '暗号化していません'}</b></p>
        <p class="help">暗号化すると、保存した JSON ファイルとこのブラウザの一時保存が、パスワードなしでは読めなくなります（AES-GCM）。USB の紛失などに備えられます。<b>パスワードを忘れると、ファイルは二度と開けません。</b>紙に書いて、決められた場所に保管してください。設定したら「上書き保存」をすると、ファイルが暗号化されます。</p>
        <div class="btn-row">${Store.crypt ? '<button class="btn" id="encChange">パスワードを変える</button><button class="btn btn-danger-ghost" id="encOff">暗号化をやめる</button>' : '<button class="btn btn-primary" id="encOn">パスワードを決めて暗号化する</button>'}</div>`
          : '<p class="help">このブラウザ（または開き方）では暗号化を使えません。Edge／Chrome の新しい版で開いてください。</p>'}
      </section>

      <section class="card">
        <h2>データ管理</h2>
        <div class="btn-row">
          <button class="btn" id="dataNew">新しい空のデータを作る</button>
          <button class="btn" id="authLock">ロックする（次に開くときパスワードを聞く）</button>
          <button class="btn btn-danger-ghost" id="clearCache">このブラウザの一時保存を消す</button>
        </div>
        <p class="help">新しい年度の準備：学校情報・学科・規定値などの設定を引き継ぎ、求人票・生徒・応募を空にした新年度のデータを作ります。元の年度のファイルはそのまま残ります（翌年4月の統計調査で使うため）。</p>
        <div class="btn-row"><button class="btn btn-primary" id="yearNext">新年度のデータを作る（年度更新）</button></div>
        <p class="help">アプリ版 ${APP.version}／データ形式 ${d.schema}</p>
      </section>`;

    // 値の即時反映
    $$('[data-path]', view).forEach(el => el.addEventListener('change', () => {
      const v = el.dataset.type === 'number' ? num(el.value) : el.value.trim();
      setPath(s, el.dataset.path, v);
      Store.changed();
    }));
    $('#setYear', view).addEventListener('change', e => {
      const y = num(e.target.value);
      if (!y || y < 2019 || y > 2100) { UI.toast('年度は西暦で入力してください', 'warn'); e.target.value = d.year; return; }
      d.year = y;
      Store.changed();
      UI.refresh();
    });
    $('#kannaiCodes', view).addEventListener('change', e => {
      s.kannaiOfficeCodes = e.target.value.split(/[,、\s]+/).map(digits).filter(Boolean);
      Store.changed();
      UI.refresh();
    });
    $('#kannaiCities', view).addEventListener('change', e => {
      s.kannaiCities = e.target.value.split(/[,、\s]+/).map(x => x.trim()).filter(Boolean);
      Store.changed();
    });
    $('#deptAdd', view).addEventListener('click', () => {
      s.departments.push({ from: null, to: null, major: '', name: '', short: '', report: '', stat: '', statCode: '' });
      Store.changed();
      UI.refresh();
    });
    $$('[data-del-dept]', view).forEach(b => b.addEventListener('click', async () => {
      const i = Number(b.dataset.delDept);
      if (!await UI.confirm(`学科「${s.departments[i].name || '（無名）'}」の行を削除します。`, { ok: '削除', danger: true })) return;
      s.departments.splice(i, 1);
      Store.changed();
      UI.refresh();
    }));
    $('#yearNext', view).addEventListener('click', () => this.nextYear());
    // 目次（長い画面なので、見出しへ飛べるようにする）
    const hs = $$('section.card > h2', view);
    hs.forEach((h, i) => { h.id = 'set-' + i; });
    $('#setToc', view).innerHTML = hs.map((h, i) => `<a href="#" data-to="set-${i}">${esc(h.textContent)}</a>`).join('');
    $('#setToc', view).addEventListener('click', e => { const a = e.target.closest('[data-to]'); if (!a) return; e.preventDefault(); document.getElementById(a.dataset.to).scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    // 自動バックアップ
    if (Backup.supported()) {
      const showBk = async () => {
        const h = await Backup.folder(), el = $('#bkName', view); if (!el) return;
        if (!h) { el.textContent = '未設定'; $('#bkNow', view).disabled = true; $('#bkOff', view).disabled = true; return; }
        const ok = await Backup.allowed(h, false), n = ok ? await Backup.count(h) : null;
        el.textContent = `${h.name}${ok ? `（バックアップ ${n} 個）` : '（次の保存のときに、書き込みの許可を聞きます）'}${Backup.lastName ? '　最後に作ったもの：' + Backup.lastName : ''}`;
      };
      showBk();
      $('#bkChoose', view).addEventListener('click', async () => {
        try { const h = await Backup.choose(); UI.toast(`バックアップのフォルダを「${h.name}」にしました`); showBk(); }
        catch (e) { if (e.name !== 'AbortError') UI.toast('フォルダを選べませんでした', 'warn'); }
      });
      $('#bkNow', view).addEventListener('click', async () => {
        const n = await Backup.after(await Store._payload(), Store.fileName, true);
        if (n) UI.toast('バックアップ：' + n);
        showBk();
      });
      $('#bkOff', view).addEventListener('click', async () => {
        if (!await UI.confirm('自動バックアップをやめます（フォルダの中のバックアップは消えません）。', { ok: 'やめる' })) return;
        await Backup.forget(); showBk();
      });
    }
    // 共有フォルダへの公開
    if (Share.supported()) {
      const showSh = async () => {
        const h = await Share.folder(), el = $('#shName', view); if (!el) return;
        if (!h) { el.textContent = '未設定'; $('#shNow', view).disabled = true; $('#shOff', view).disabled = true; return; }
        const at = await Share.publishedAt(h);
        el.textContent = `${h.name}${at ? `　最後に公開：${Share._stamp(at)}` : '（次の保存のときに、書き込みの許可を聞きます）'}`;
      };
      showSh();
      $('#shChoose', view).addEventListener('click', async () => {
        try {
          const r = await Share.choose();
          UI.toast(`公開するフォルダを「${r.handle.name}」にしました`);
          if (!r.hasApp) UI.toast('このフォルダには index.html がありません。site フォルダ（index.html と 閲覧.html のあるフォルダ）を選び直してください', 'warn');
          showSh();
        } catch (e) { if (e.name !== 'AbortError') UI.toast('フォルダを選べませんでした', 'warn'); }
      });
      $('#shNow', view).addEventListener('click', async () => {
        if (await Share.after(await Store._payload(), true)) showSh();
      });
      $('#shOff', view).addEventListener('click', async () => {
        if (!await UI.confirm('公開をやめます（フォルダの中の shared-data.js は消えません。消すと、閲覧する人には何も表示されなくなります）。', { ok: 'やめる' })) return;
        await Share.forget(); showSh();
      });
    }
    // 暗号化
    const encSet = async (title) => {
      const pass = await UI.askPassword({ title, twice: true, ok: '決める', message: 'パスワードを決めてください（4文字以上）。忘れるとファイルを開けなくなります。' });
      if (pass == null) return;
      Store.crypt = await Crypt.setup(pass);
      Store.changed();
      UI.refresh();
      UI.toast('暗号化の設定をしました。「上書き保存」で、ファイルが暗号化されます');
    };
    if ($('#encOn', view)) $('#encOn', view).addEventListener('click', () => encSet('暗号化する'));
    if ($('#encChange', view)) $('#encChange', view).addEventListener('click', () => encSet('パスワードを変える'));
    if ($('#encOff', view)) $('#encOff', view).addEventListener('click', async () => {
      if (!await UI.confirm('暗号化をやめます。次に保存すると、ファイルは暗号化されずに保存されます。', { ok: 'やめる', danger: true })) return;
      Store.crypt = null; Store.changed(); UI.refresh();
    });
    $('#dataNew', view).addEventListener('click', async () => {
      if (!await UI.confirm('空のデータで始めます。\n今のデータを保存していない場合は、先に「名前を付けて保存」をしてください。', { ok: '空のデータにする', danger: true })) return;
      Store.newFile(currentNendo());
      UI.go('dashboard');
    });
    $('#authLock', view).addEventListener('click', () => { Auth.lock(); location.reload(); });
    $('#clearCache', view).addEventListener('click', async () => {
      if (!await UI.confirm('このブラウザに残っている一時保存を消します。\n（保存済みのファイルは消えません）\n共用PCで作業を終えるときに使ってください。', { ok: '消す', danger: true })) return;
      localStorage.removeItem(APP.storageKey);
      Store.crypt = null;
      Store.data = blankData();
      Store.fileName = '';
      Store.fileHandle = null;
      Store.dirty = false;
      Store.emit();
      UI.go('dashboard');
      UI.refresh();
      UI.toast('一時保存を消しました');
    });
  },
};

Settings.nextYear = async function () {
  const d = Store.data;
  const body = document.createElement('div');
  body.innerHTML = `<p>${nendoLabel(d.year)} → <b>${nendoLabel(d.year + 1)}</b> のデータを作ります。</p>
    <ul class="plain"><li>引き継ぐ：学校情報・学科・管内の設定・規定値・ラベル用紙・時候の挨拶・帳票の設定・<b>過去の実績（就職先・進学先・指定校一覧。今年度の進路決定も足されます）</b></li>
    <li>空にする：生徒・応募・進路希望調査・年間タスクのチェック・求人票</li></ul>
    <label class="check" style="margin-top:10px"><input type="checkbox" id="ynJobs"> 求人票のうち、事業所の情報（名称・住所・電話・窓口など）だけ引き継ぐ</label>
    <p class="help">引き継ぐ場合も、受付番号・求人番号・求人数・職種は空にします。事業所の担当者や住所は変わっていることがあるため、使うときに確認してください。</p>`;
  const res = await UI.modal({ title: '年度更新', body, buttons: [{ label: 'キャンセル', value: null }, { label: '新年度のデータを作る', kind: 'primary', value: 'ok' }] });
  if (res !== 'ok') return;
  const carry = $('#ynJobs', body).checked;
  if (Store.dirty && !await UI.confirm('今の年度のデータが保存されていません。\n先に「上書き保存」を押してから、もう一度年度更新をしてください。\n（このまま続けると、未保存の変更は失われます）', { ok: 'このまま続ける', danger: true })) return;
  const next = blankData(d.year + 1);
  next.settings = clone(d.settings);
  next.settings.docs = { visitLetterDate: '', sendDate: '' };
  if (carry) {
    const seen = new Set();
    for (const j of d.jobs) {
      const key = j.company + '|' + (j.address || '');
      if (seen.has(key)) continue;
      seen.add(key);
      next.jobs.push({ id: uid(), kind: '一般', employment: '正社員', company: j.company, kana: j.kana, zip: j.zip, address: j.address, tel: j.tel,
        employees: j.employees, capital: j.capital, business: j.business, industryCode: j.industryCode, dept: j.dept, contact: j.contact, workArea: '県内' });
    }
  }
  const hist = History.committed();   // 過去の実績に、今年度の進路決定・求人票数を足したもの
  Store.newFile(d.year + 1);
  Store.data.history = hist;
  Store.data.settings = next.settings;
  Store.data.jobs = next.jobs;
  Store.changed();
  UI.go('dashboard');
  UI.toast(`${nendoLabel(d.year + 1)}のデータを作りました。「名前を付けて保存」で保存してください`);
};

Pages.register({ id: 'settings', no: 11, group: '管理', title: '設定', render: v => Settings.render(v) });
