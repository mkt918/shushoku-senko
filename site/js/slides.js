'use strict';
/* ============================================================
   保護者向け進路説明会のスライド（10枚）
   進路決定（今年度）と過去の実績（年度末の資料）から自動で組み立てる。
   - 文面は「文面を直す」で変えられる（settings.yearend.slides に保存。空欄なら既定の文）
   - 画面：縮小表示の一覧／全画面で発表（← → Space Esc・動きつき）／印刷・PDF（16:9）
   - 1枚は 1280×720px の固定サイズ。画面では transform で縮める
   ============================================================ */

const Slides = {
  H: 720,
  /** 縦横比：16:9（1280×720）／4:3（960×720）。設定 settings.yearend.slideRatio */
  ratio() { return (Store.data.settings.yearend || {}).slideRatio === '4:3' ? '4:3' : '16:9'; },
  get W() { return this.ratio() === '4:3' ? 960 : 1280; },

  /** 直せる文の既定。複数行は「見出し｜内容」を1行ずつ */
  DEF: {
    cover1: '保護者の皆様へ',
    year: [
      '4月｜進路希望調査・面談。進路の方向を決める',
      '5〜6月｜進学：オープンキャンパス、出願の準備　就職：求人票の確認、職場見学の申込',
      '7月｜就職：求人票の受付開始（校内に公開）　進学：指定校推薦の校内選考',
      '8月｜職場見学・オープンキャンパス・面接練習',
      '9月｜就職：応募書類の提出・採用試験　進学：推薦・総合型選抜の出願',
      '10〜12月｜内定・合格の発表。決まらない人は2次応募や一般選抜へ',
      '1〜3月｜一般選抜・進路決定の報告・卒業',
    ].join('\n'),
    money: [
      '入学金・授業料｜国公立か私立か、学部・学科によって大きく違います。募集要項で早めに確認を',
      '奨学金｜日本学生支援機構などの貸与型・給付型があります。高校在学中に申し込む予約採用もあります',
      '修学支援新制度｜条件を満たす世帯は、授業料・入学金の減免と給付型奨学金を受けられます',
      '教育ローン｜国や金融機関の教育ローンもあります',
      'ご相談｜費用が心配なときは、早めに担任・進路指導部へ',
    ].join('\n'),
    flow: [
      '7月｜求人票の受付開始。校内に公開',
      '夏休み｜職場見学・応募先の検討',
      '9月上旬｜校内選考の後、応募書類を学校から企業へ',
      '9月中旬〜｜採用試験（面接など）',
      '10月〜｜採用内定。不採用でも2次応募で続けられます',
    ].join('\n'),
    ask: [
      'お子さんの考えをよく聞き、一緒に話し合ってください',
      '提出書類や面談の期限を、ご家庭でもご確認ください',
      '学費・仕事・通勤など、不安なことは早めに担任・進路指導部へ',
      '最後は本人が自分で決めることを、見守ってください',
    ].join('\n'),
  },
  NOTES: {
    year: '行事の時期は年度により変わります。詳しくは学校からの配付資料でお知らせします。',
    money: '制度や金額は変わることがあります。最新の情報は、各学校・機関でご確認ください。',
    flow: '日付は年度により変わります。詳しくは学校からの配付資料でお知らせします。',
  },

  /** 利用者が直した文面（settings.yearend.slides） */
  ov() { return (Store.data.settings.yearend || {}).slides || {}; },
  text(key) { const v = this.ov()[key]; return v != null && String(v).trim() ? String(v) : this.DEF[key]; },
  /** 「見出し｜内容」の行 → [[見出し, 内容], …] */
  rows(text) {
    return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => { const i = l.search(/[｜|]/); return i < 0 ? ['', l] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
  },

  /** 数字を出せる年度の一覧：今年度（進路決定が入っていれば）＋ 実績にある過去の年度 */
  sources() {
    const FY = Store.data.year, H = Store.data.history;
    const ys = Object.keys(H.summary).map(Number).filter(y => y < FY && this.total(H.summary[y]) > 0);
    if (Outcomes.hasData()) ys.push(FY);
    return ys.sort((a, b) => b - a);
  },
  total(n) { return n ? Object.values(n).reduce((t, v) => t + (v || 0), 0) : 0; },
  nums(y) { return y === Store.data.year ? Outcomes.summaryNumbers() : Store.data.history.summary[y] || null; },
  grp(n) {
    const job = n.jobSchool + n.jobOther + n.jobPublic, edu = n.univ + n.junior + n.senshu + n.college + n.eduOther;
    return { job, edu, other: n.other, total: job + edu + n.other };
  },
  pct(a, t) { return t ? Math.round(a / t * 100) : 0; },

  /* ---------- 部品 ---------- */
  hbars(rows, unit = '人') {
    const max = Math.max(1, ...rows.map(r => r.v));
    return `<div class="sl-bars">${rows.map(r => `<div class="sl-br"><span class="sl-bl">${esc(r.l)}</span><span class="sl-bt"><i style="width:${(r.v / max * 100).toFixed(1)}%"></i></span><b>${r.v}${unit}</b></div>`).join('')}</div>`;
  },
  tile(label, v, sub, cls) { return `<div class="sl-tile ${cls || ''}"><div class="sl-tl">${esc(label)}</div><div class="sl-tv">${v}<small>人</small></div><div class="sl-ts">${sub}</div></div>`; },
  chips(list, max) {
    const shown = list.slice(0, max);
    return `<div class="sl-chips">${shown.map(t => `<span>${esc(t)}</span>`).join('')}${list.length > max ? `<span class="more">ほか ${list.length - max}</span>` : ''}</div>`;
  },
  empty(msg) { return `<p class="sl-empty">${esc(msg)}</p>`; },
  /** 見出し＋説明の行 */
  rowList(text) { return `<div class="sl-ex">${this.rows(text).map(([a, b]) => `<div class="sl-exr">${a ? `<b>${esc(a)}</b>` : ''}<span>${esc(b)}</span></div>`).join('')}</div>`; },

  /* ---------- スライドの中身 ----------
     raw=true：直した文面・非表示を反映せず、全スライドの既定の題を返す（編集画面用） */
  build(y, raw, keepHidden) {
    const FY = Store.data.year, H = Store.data.history, sc = Store.data.settings.school;
    const isNow = y === FY, n = y ? this.nums(y) : null;
    if (!n || !this.total(n)) return [];
    const g = this.grp(n), yl = Yr.long(y);
    const ov = raw ? {} : this.ov(), T = (id, d) => (ov.titles && ov.titles[id]) || d;
    const out = [];
    const cnt = r => History.cnt(r, y);
    const add = (id, title, body) => out.push({ id, title: T(id, title), def: title, body });

    // 1 表紙
    out.push({
      id: 'cover', cover: true, def: `${Yr.long(FY)}　進路説明会`, title: raw ? `${Yr.long(FY)}　進路説明会` : this.coverTitle(FY),
      body: `<p class="sl-c1">${esc(raw ? this.DEF.cover1 : this.coverLine('cover1'))}</p>
        <p class="sl-c2">${esc(raw || !(ov.cover2 || '').trim() ? (isNow ? `${yl}卒業予定者の進路状況` : `${yl}卒業生の進路実績`) + 'と、進路指導のあらまし' : ov.cover2)}</p>
        <p class="sl-c3">${esc(sc.name || '')}${sc.dept ? '　' + esc(sc.dept) : ''}</p>`,
    });

    // 2 全体
    const actN = isNow ? Outcomes.summary().activeTotal : 0;
    add('total', isNow ? `今年度の進路状況（${fmtWareki(todayISO())}現在）` : `${yl}卒業生の進路状況`,
      `<div class="sl-tiles">
          ${this.tile('就職', g.job, `${this.pct(g.job, g.total)}％　（学校斡旋 ${n.jobSchool}・斡旋外 ${n.jobOther}・公務 ${n.jobPublic}）`, 'c-job')}
          ${this.tile('進学', g.edu, `${this.pct(g.edu, g.total)}％　（大学 ${n.univ}・短大 ${n.junior}・専門学校 ${n.senshu}・大学校等 ${n.college}${n.eduOther ? `・その他 ${n.eduOther}` : ''}）`, 'c-edu')}
          ${this.tile('その他', g.other, `${this.pct(g.other, g.total)}％`, 'c-oth')}
        </div>
        <div class="sl-total">${isNow ? '卒業予定者' : '卒業者'}　<b>${g.total}</b> 人${actN ? `　／　うち就職・進学の活動中　<b>${actN}</b> 人` : ''}</div>`);

    // 3 3年生の1年間（文面を直せる）
    add('year', '3年生の1年間の進路スケジュール', `${this.rowList(this.text('year'))}<p class="sl-note">${esc(this.NOTES.year)}</p>`);

    // 4 進学の費用と支援制度（文面を直せる）
    add('money', '進学にかかる費用と支援制度', `${this.rowList(this.text('money'))}<p class="sl-note">${esc(this.NOTES.money)}</p>`);

    // 5 就職先の業種
    const work = History.merged('work').filter(r => cnt(r));
    const byInd = new Map();
    work.forEach(r => byInd.set(r.ind || '', (byInd.get(r.ind || '') || 0) + cnt(r)));
    const indRows = [...byInd.entries()].map(([k, v]) => ({ l: (OC.IND_NAMES[k] || 'その他').replace(/、/g, '・'), v })).sort((a, b) => b.v - a.v);
    add('ind', `学校斡旋で就職した人の業種（${work.reduce((t, r) => t + cnt(r), 0)}人）`,
      indRows.length ? this.hbars(indRows.slice(0, 9)) : this.empty('就職先（学校斡旋）の決定がまだ入力されていません。'));

    // 6 求人票数の推移
    const trend = Array.from({ length: 9 }, (_, i) => y - 8 + i).map(v => ({ y: v, v: v === FY ? History.jobsTrend(1)[0].v : H.jobs[v] || 0 }));
    const tmax = Math.max(1, ...trend.map(t => t.v));
    add('jobs', '本校に届いた求人票の数',
      trend.some(t => t.v) ? `<div class="sl-cols">${trend.map(t => `<div class="sl-col"><b>${t.v ? t.v.toLocaleString('ja-JP') : '－'}</b><i style="height:${Math.round(t.v / tmax * 280)}px"></i><span>${Yr.label(t.y)}</span></div>`).join('')}</div><p class="sl-note">求人票は区分「一般」の枚数です。</p>` : this.empty('求人票数がまだ入力されていません。'));

    // 7 主な就職先
    const names = [...work].sort((a, b) => (a.ind || '~').localeCompare(b.ind || '~') || (a.ord ?? 0) - (b.ord ?? 0)).map(r => r.name);
    add('firms', '主な就職先（学校斡旋・順不同）', names.length ? this.chips(names, 30) : this.empty('就職先がまだ入力されていません。'));

    // 8 進学
    const univ = History.merged('univ').filter(r => cnt(r)), senshu = History.merged('senshu').filter(r => cnt(r));
    const uni = [...new Set(univ.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).map(r => r.school))];
    const sen = [...new Set(senshu.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).map(r => r.name))];
    add('edu', `進学した人の進路先（${g.edu}人）`,
      `<div class="sl-two">
          <div><h3>大学・短期大学　<small>${n.univ + n.junior}人</small></h3>${uni.length ? this.chips(uni, 16) : this.empty('入力待ちです')}</div>
          <div><h3>専門学校・大学校ほか　<small>${n.senshu + n.college + n.eduOther}人</small></h3>${sen.length ? this.chips(sen, 16) : this.empty('入力待ちです')}</div></div>`);

    // 9 受験方法
    const M = H.master, mc = k => M && M[k] ? new Set(M[k].map(r => r.name)).size : 0;
    const ex = isNow ? Outcomes.summary().exam : null;
    const exTotal = m => ex ? Object.values(ex).reduce((t, e) => t + (e[m] || 0), 0) : 0;
    const exInfo = [['指定校推薦', '学校に届く推薦枠。評定などの基準があり、校内で選考します。'], ['公募制推薦', '出願条件を満たせば誰でも受けられる推薦。学校長の推薦が必要です。'], ['総合型選抜', '面接・小論文・活動実績などで人物を総合的に評価します。'], ['一般選抜', '学力試験で合否が決まります。']];
    add('exam', '進学の受験方法',
      `<div class="sl-ex">${exInfo.map(([m, t]) => `<div class="sl-exr"><b>${m}</b><span>${t}</span>${ex ? `<em>${exTotal(m)}人</em>` : ''}</div>`).join('')}</div>
        ${M && (mc('univ') + mc('junior') + mc('senshu')) ? `<p class="sl-note">本校への指定校推薦の依頼：四年制大学 ${mc('univ')}校・短期大学 ${mc('junior')}校・専修各種学校 ${mc('senshu')}校（${Yr.long(M.year)}）</p>` : ''}`);

    // 10 流れとお願い（文面を直せる）
    add('flow', '就職希望者の流れと、ご家庭へのお願い',
      `<div class="sl-two">
          <div><h3>就職希望者の流れ（例年）</h3><ol class="sl-flow">${this.rows(this.text('flow')).map(([a, b]) => `<li>${a ? `<b>${esc(a)}</b>` : ''}${esc(b)}</li>`).join('')}</ol>
            <p class="sl-note">${esc(this.NOTES.flow)}</p></div>
          <div><h3>ご家庭へのお願い</h3><ul class="sl-ask">${this.rows(this.text('ask')).map(([a, b]) => `<li>${esc(a ? a + '　' + b : b)}</li>`).join('')}</ul></div></div>`);

    if (raw) return out;
    // 非表示の枚を除き、ひとこと（補足）をつける
    const list = out.map(s => {
      const memo = ov.memo && String(ov.memo[s.id] || '').trim();
      return Object.assign(s, { hidden: !!(ov.hide && ov.hide[s.id]) }, memo ? { body: s.body + `<div class="sl-memo">${esc(memo).replace(/\n/g, '<br>')}</div>` } : {});
    });
    return keepHidden ? list : list.filter(s => !s.hidden);
  },
  coverTitle(FY) { const t = String(this.ov().coverTitle || '').trim(); return t || `${Yr.long(FY)}　進路説明会`; },
  coverLine(k) { const t = String(this.ov()[k] || '').trim(); return t || this.DEF[k]; },

  /** スライド1枚分の HTML */
  slide(s, i, n) {
    const sc = Store.data.settings.school;
    const r43 = this.ratio() === '4:3' ? ' sl-43' : '';
    if (s.cover) return `<div class="sl sl-cover${r43}"><h1>${esc(s.title)}</h1>${s.body}</div>`;
    return `<div class="sl${r43}"><div class="sl-h"><h2>${esc(s.title)}</h2></div><div class="sl-b">${s.body}</div><div class="sl-f"><span>${esc(sc.name || '')}</span><span>${i + 1} / ${n}</span></div></div>`;
  },
  all(y) { const ss = this.build(y); return ss.map((s, i) => this.slide(s, i, ss.length)); },

  /* ---------- 全画面で発表（動きつき。実体は slidesPlayer） ---------- */
  ANIM: '.sl-h h2, .sl-cover h1, .sl-c1, .sl-c2, .sl-c3, .sl-tile, .sl-total, .sl-br, .sl-exr, .sl-flow li, .sl-ask li, .sl-chips span, .sl-col, .sl-two h3, .sl-note, .sl-memo, .sl-empty',
  present(htmls, start = 0) {
    if (!htmls.length) return;
    const ov = document.createElement('div');
    ov.id = 'slideShow';
    document.body.appendChild(ov);
    const fs = () => { if (!document.fullscreenElement) close(); };
    const player = slidesPlayer({ host: ov, htmls, W: this.W, H: this.H, ANIM: this.ANIM, start, onClose: () => close(), hint: '← → で移動　Esc で終了' });
    function close() {
      document.removeEventListener('fullscreenchange', fs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      player.destroy(); ov.remove();
    }
    try { ov.requestFullscreen().then(() => document.addEventListener('fullscreenchange', fs)).catch(() => {}); } catch (e) { /* 全画面にできなくても、重ね表示で発表できる */ }
  },

  /** ダウンロード：開くだけで発表できる HTML 1ファイル（動きつき・通信なし） */
  download(htmls, title) {
    if (!htmls.length) return;
    const css = `:root{--font:${getComputedStyle(document.documentElement).getPropertyValue('--font') || 'sans-serif'}}html,body{margin:0;height:100%;background:#111}` + SLIDE_CSS;
    const data = JSON.stringify(htmls).replace(/</g, '\\u003c');
    const doc = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}</style></head><body><div id="slideShow"></div>
<script>${slidesPlayer.toString()}
slidesPlayer({ host: document.getElementById('slideShow'), htmls: ${data}, W: ${this.W}, H: ${this.H}, ANIM: ${JSON.stringify(this.ANIM)}, start: 0, hint: '← → で移動　F で全画面' });
<\/script></body></html>`;
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    const a = document.createElement('a'); a.href = url; a.download = `${title}.html`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  /** 印刷・PDF：1枚＝1ページ（16:9） */
  print(htmls, title) {
    const w = this.W;
    Print.open({ title, html: htmls.map(h => `<div class="p-page sl-print" style="width:${w}px">${h}</div>`).join(''), orientation: '', margin: '0', size: `${w === 960 ? '254' : '338.67'}mm 190.5mm` });
  },
};

/** 発表の実体：左右の移動・拡大縮小・LP風の動き・進行バー。アプリと、ダウンロードした HTML の両方で使う
    （ダウンロード側では toString() で埋め込むので、アプリの他の関数・変数に頼らないこと） */
function slidesPlayer(o) {
  const host = o.host, htmls = o.htmls, W = o.W, H = o.H;
  let i = Math.max(0, Math.min(o.start || 0, htmls.length - 1));
  host.innerHTML = '<div class="sl-stage"></div><div class="sl-prog"><i></i></div><div class="sl-hint">' + (o.hint || '') + '</div>';
  const stage = host.firstChild, bar = host.querySelector('.sl-prog i');
  stage.style.width = W + 'px';
  const fit = () => { stage.style.transform = 'translate(-50%,-50%) scale(' + Math.min(window.innerWidth / W, window.innerHeight / H) + ')'; };
  const animate = (sl, dir) => {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    [].slice.call(sl.querySelectorAll(o.ANIM)).forEach((el, n) => el.style.setProperty('--i', Math.min(n, 28)));
    sl.querySelectorAll('.sl-tv, .sl-total b').forEach(el => {
      const node = el.firstChild, to = parseInt(node && node.nodeValue, 10);
      if (!node || node.nodeType !== 3 || !(to > 0)) return;
      const t0 = performance.now() + 250;
      const step = t => {
        const k = Math.max(0, Math.min(1, (t - t0) / 900));
        node.nodeValue = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1 && sl.isConnected) requestAnimationFrame(step);
      };
      node.nodeValue = '0'; requestAnimationFrame(step);
    });
    sl.classList.add(dir < 0 ? 'play-l' : 'play-r');
  };
  const draw = dir => {
    fit(); stage.innerHTML = htmls[i];
    bar.style.width = ((i + 1) / htmls.length * 100) + '%';
    animate(stage.firstChild, dir || 1);
  };
  const go = j => { j = Math.max(0, Math.min(j, htmls.length - 1)); if (j === i) return; const d = j > i ? 1 : -1; i = j; draw(d); };
  const key = e => {
    if (e.key === 'Escape') { if (o.onClose) { e.preventDefault(); o.onClose(); } return; }
    if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else if (host.requestFullscreen) host.requestFullscreen(); return; }
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].indexOf(e.key) >= 0) go(i + 1);
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].indexOf(e.key) >= 0) go(i - 1);
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(htmls.length - 1); else return;
    e.preventDefault();
  };
  const click = e => go(e.clientX < window.innerWidth / 3 ? i - 1 : i + 1);
  window.addEventListener('keydown', key, true); window.addEventListener('resize', fit); host.addEventListener('click', click);
  draw(1);
  return { destroy() { window.removeEventListener('keydown', key, true); window.removeEventListener('resize', fit); } };
}
