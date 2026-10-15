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
        <p class="sub">職場見学の宛名の初期値はエーワン 31514（A4・10面・1片 91×55mm・四辺余白付）、応募書類（レターパック）の宛名の初期値は A4 4面（2列×2段・105×148.5mm・余白なし）です。ラベルの寸法が違うときを使うときは、面数と寸法（mm）を入れ替えてください。</p>
        ${['visit', 'envelope'].map(k => `<h3>${esc(s.labels[k].name)}</h3>
        <div class="grid grid-labels">
          ${[['cols', '列数'], ['rows', '段数'], ['w', '幅'], ['h', '高さ'], ['top', '上余白'], ['left', '左余白'], ['gapX', '列の間隔'], ['gapY', '段の間隔']]
            .map(([f, l]) => `<div class="field narrow"><label class="label">${l}</label>${inp(`labels.${k}.${f}`, { type: 'number', cls: 'w-num' })}</div>`).join('')}
        </div>`).join('')}
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
    $('#dataNew', view).addEventListener('click', async () => {
      if (!await UI.confirm('空のデータで始めます。\n今のデータを保存していない場合は、先に「名前を付けて保存」をしてください。', { ok: '空のデータにする', danger: true })) return;
      Store.newFile(currentNendo());
      UI.go('dashboard');
    });
    $('#authLock', view).addEventListener('click', () => { Auth.lock(); location.reload(); });
    $('#clearCache', view).addEventListener('click', async () => {
      if (!await UI.confirm('このブラウザに残っている一時保存を消します。\n（保存済みのファイルは消えません）\n共用PCで作業を終えるときに使ってください。', { ok: '消す', danger: true })) return;
      localStorage.removeItem(APP.storageKey);
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
