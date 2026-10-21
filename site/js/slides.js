'use strict';
/* ============================================================
   保護者向け進路説明会のスライド（10枚）
   進路決定（今年度）と過去の実績（年度末の資料）から自動で組み立てる。
   - 画面：縮小表示の一覧／全画面で発表（← → Space Esc）／印刷・PDF（16:9）
   - 1枚は 1280×720px の固定サイズ。画面では transform で縮める
   ============================================================ */

const Slides = {
  W: 1280, H: 720,

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
  stack(g, label) {
    const seg = (v, cls, name) => v ? `<i class="${cls}" style="flex:${v}" title="${name} ${v}人">${this.pct(v, g.total) >= 8 ? `${name} ${this.pct(v, g.total)}%` : ''}</i>` : '';
    return `<div class="sl-sr"><span class="sl-sl">${esc(label)}</span><span class="sl-st">${seg(g.job, 'c-job', '就職')}${seg(g.edu, 'c-edu', '進学')}${seg(g.other, 'c-oth', 'その他')}</span><b>${g.total}人</b></div>`;
  },
  tile(label, v, sub, cls) { return `<div class="sl-tile ${cls || ''}"><div class="sl-tl">${esc(label)}</div><div class="sl-tv">${v}<small>人</small></div><div class="sl-ts">${sub}</div></div>`; },
  chips(list, max) {
    const shown = list.slice(0, max);
    return `<div class="sl-chips">${shown.map(t => `<span>${esc(t)}</span>`).join('')}${list.length > max ? `<span class="more">ほか ${list.length - max}</span>` : ''}</div>`;
  },
  empty(msg) { return `<p class="sl-empty">${esc(msg)}</p>`; },

  /* ---------- スライドの中身（title と body の配列）---------- */
  build(y) {
    const FY = Store.data.year, H = Store.data.history, sc = Store.data.settings.school;
    const isNow = y === FY, n = y ? this.nums(y) : null;
    if (!n || !this.total(n)) return [];
    const g = this.grp(n), yl = Yr.long(y);
    const out = [];
    const cnt = (kind, r) => History.cnt(r, y);

    // 1 表紙
    out.push({
      cover: true, title: `${Yr.long(FY)}　進路説明会`,
      body: `<p class="sl-c1">保護者の皆様へ</p><p class="sl-c2">${isNow ? `${yl}卒業予定者の進路状況` : `${yl}卒業生の進路実績`}と、進路指導のあらまし</p>
        <p class="sl-c3">${esc(sc.name || '')}${sc.dept ? '　' + esc(sc.dept) : ''}</p>`,
    });

    // 2 全体
    const actN = isNow ? Outcomes.summary().activeTotal : 0;
    out.push({
      title: isNow ? `今年度の進路状況（${fmtWareki(todayISO())}現在）` : `${yl}卒業生の進路状況`,
      body: `<div class="sl-tiles">
          ${this.tile('就職', g.job, `${this.pct(g.job, g.total)}％　（学校斡旋 ${n.jobSchool}・斡旋外 ${n.jobOther}・公務 ${n.jobPublic}）`, 'c-job')}
          ${this.tile('進学', g.edu, `${this.pct(g.edu, g.total)}％　（大学 ${n.univ}・短大 ${n.junior}・専門学校 ${n.senshu}・大学校等 ${n.college}${n.eduOther ? `・その他 ${n.eduOther}` : ''}）`, 'c-edu')}
          ${this.tile('その他', g.other, `${this.pct(g.other, g.total)}％`, 'c-oth')}
        </div>
        <div class="sl-total">${isNow ? '卒業予定者' : '卒業者'}　<b>${g.total}</b> 人${actN ? `　／　うち就職・進学の活動中　<b>${actN}</b> 人` : ''}</div>`,
    });

    // 3 推移
    const past = Object.keys(H.summary).map(Number).filter(v => v <= y && this.total(this.nums(v)) > 0).sort((a, b) => a - b).slice(-6);
    out.push({
      title: '進路の推移（就職・進学の割合）',
      body: `<div class="sl-stacks">${past.map(v => this.stack(this.grp(this.nums(v)), Yr.label(v) + (v === FY ? '（今年度）' : ''))).join('')}</div>
        <div class="sl-legend"><i class="c-job"></i>就職　<i class="c-edu"></i>進学　<i class="c-oth"></i>その他</div>`,
    });

    // 4 学科別（今年度のみ）
    if (isNow) {
      const bd = Outcomes.summary().byDept;
      const rows = Object.keys(bd).map(d => {
        const s = Outcomes.KEYS.reduce((t, k) => (t[k] = bd[d]['男'][k] + bd[d]['女'][k] + bd[d]['他'][k], t), {});
        return { d, g: this.grp({ jobSchool: s.jobSchool, jobOther: s.jobOther, jobPublic: s.jobPublic, univ: s.univ, junior: s.junior, senshu: s.senshu, college: s.college + s.nurse, eduOther: s.eduOther, other: s.other }) };
      }).filter(x => x.g.total);
      out.push({
        title: '学科別の進路状況',
        body: `<div class="sl-stacks">${rows.map(x => this.stack(x.g, x.d)).join('')}</div><div class="sl-legend"><i class="c-job"></i>就職　<i class="c-edu"></i>進学　<i class="c-oth"></i>その他</div>`,
      });
    } else {
      out.push({ title: '学科別の進路状況', body: this.empty('学科別の数字は、今年度の進路決定を入力すると表示されます。') });
    }

    // 5 就職先の業種
    const work = History.merged('work').filter(r => cnt('work', r));
    const byInd = new Map();
    work.forEach(r => byInd.set(r.ind || '', (byInd.get(r.ind || '') || 0) + cnt('work', r)));
    const indRows = [...byInd.entries()].map(([k, v]) => ({ l: (OC.IND_NAMES[k] || 'その他').replace(/、/g, '・'), v })).sort((a, b) => b.v - a.v);
    out.push({
      title: `学校斡旋で就職した人の業種（${work.reduce((t, r) => t + cnt('work', r), 0)}人）`,
      body: indRows.length ? this.hbars(indRows.slice(0, 9)) : this.empty('就職先（学校斡旋）の決定がまだ入力されていません。'),
    });

    // 6 求人票数の推移
    const trend = Array.from({ length: 9 }, (_, i) => y - 8 + i).map(v => ({ y: v, v: v === FY ? History.jobsTrend(1)[0].v : H.jobs[v] || 0 }));
    const tmax = Math.max(1, ...trend.map(t => t.v));
    out.push({
      title: '本校に届いた求人票の数',
      body: trend.some(t => t.v) ? `<div class="sl-cols">${trend.map(t => `<div class="sl-col"><b>${t.v ? t.v.toLocaleString('ja-JP') : '－'}</b><i style="height:${Math.round(t.v / tmax * 280)}px"></i><span>${Yr.label(t.y)}</span></div>`).join('')}</div><p class="sl-note">求人票は区分「一般」の枚数です。</p>` : this.empty('求人票数がまだ入力されていません。'),
    });

    // 7 主な就職先
    const names = [...work].sort((a, b) => (a.ind || '~').localeCompare(b.ind || '~') || (a.ord ?? 0) - (b.ord ?? 0)).map(r => r.name);
    out.push({
      title: '主な就職先（学校斡旋・順不同）',
      body: names.length ? this.chips(names, 30) : this.empty('就職先がまだ入力されていません。'),
    });

    // 8 進学
    const univ = History.merged('univ').filter(r => cnt('univ', r)), senshu = History.merged('senshu').filter(r => cnt('senshu', r));
    const uni = [...new Set(univ.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).map(r => r.school))];
    const sen = [...new Set(senshu.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).map(r => r.name))];
    out.push({
      title: `進学した人の進路先（${g.edu}人）`,
      body: `<div class="sl-two">
          <div><h3>大学・短期大学　<small>${n.univ + n.junior}人</small></h3>${uni.length ? this.chips(uni, 16) : this.empty('入力待ちです')}</div>
          <div><h3>専門学校・大学校ほか　<small>${n.senshu + n.college + n.eduOther}人</small></h3>${sen.length ? this.chips(sen, 16) : this.empty('入力待ちです')}</div></div>`,
    });

    // 9 受験方法
    const M = H.master, mc = k => M && M[k] ? new Set(M[k].map(r => r.name)).size : 0;
    const ex = isNow ? Outcomes.summary().exam : null;
    const exTotal = m => ex ? Object.values(ex).reduce((t, e) => t + (e[m] || 0), 0) : 0;
    const exInfo = [['指定校推薦', '学校に届く推薦枠。評定などの基準があり、校内で選考します。'], ['公募制推薦', '出願条件を満たせば誰でも受けられる推薦。学校長の推薦が必要です。'], ['総合型選抜', '面接・小論文・活動実績などで人物を総合的に評価します。'], ['一般選抜', '学力試験で合否が決まります。']];
    out.push({
      title: '進学の受験方法',
      body: `<div class="sl-ex">${exInfo.map(([m, t]) => `<div class="sl-exr"><b>${m}</b><span>${t}</span>${ex ? `<em>${exTotal(m)}人</em>` : ''}</div>`).join('')}</div>
        ${M && (mc('univ') + mc('junior') + mc('senshu')) ? `<p class="sl-note">本校への指定校推薦の依頼：四年制大学 ${mc('univ')}校・短期大学 ${mc('junior')}校・専修各種学校 ${mc('senshu')}校（${Yr.long(M.year)}）</p>` : ''}`,
    });

    // 10 流れとお願い
    out.push({
      title: '就職希望者の流れと、ご家庭へのお願い',
      body: `<div class="sl-two">
          <div><h3>就職希望者の流れ（例年）</h3><ol class="sl-flow">
            <li><b>7月</b>求人票の受付開始。校内に公開</li><li><b>夏休み</b>職場見学・応募先の検討</li>
            <li><b>9月上旬</b>校内選考の後、応募書類を学校から企業へ</li><li><b>9月中旬〜</b>採用試験（面接など）</li>
            <li><b>10月〜</b>採用内定。不採用でも2次応募で続けられます</li></ol>
            <p class="sl-note">日付は年度により変わります。詳しくは学校からの配付資料でお知らせします。</p></div>
          <div><h3>ご家庭へのお願い</h3><ul class="sl-ask">
            <li>お子さんの考えをよく聞き、一緒に話し合ってください</li><li>提出書類や面談の期限を、ご家庭でもご確認ください</li>
            <li>学費・仕事・通勤など、不安なことは早めに担任・進路指導部へ</li><li>最後は本人が自分で決めることを、見守ってください</li></ul></div></div>`,
    });
    return out;
  },

  /** スライド1枚分の HTML */
  slide(s, i, n) {
    const sc = Store.data.settings.school;
    if (s.cover) return `<div class="sl sl-cover"><h1>${esc(s.title)}</h1>${s.body}</div>`;
    return `<div class="sl"><div class="sl-h"><h2>${esc(s.title)}</h2></div><div class="sl-b">${s.body}</div><div class="sl-f"><span>${esc(sc.name || '')}</span><span>${i + 1} / ${n}</span></div></div>`;
  },
  all(y) { const ss = this.build(y); return ss.map((s, i) => this.slide(s, i, ss.length)); },

  /** 画面の一覧：1280×720 の枠を 0.5 倍に縮めて並べる */
  thumbs(htmls) {
    return `<div class="sl-grid">${htmls.map((h, i) => `<div class="sl-thumb" data-go="${i}" title="クリックで、この枚から発表"><div class="sl-sc" style="transform:scale(.5)">${h}</div><span class="sl-no">${i + 1}</span></div>`).join('')}</div>`;
  },

  /* ---------- 全画面で発表 ---------- */
  present(htmls, start = 0) {
    if (!htmls.length) return;
    let i = Math.max(0, Math.min(start, htmls.length - 1));
    const ov = document.createElement('div');
    ov.id = 'slideShow';
    ov.innerHTML = '<div class="sl-stage"></div><div class="sl-hint">← → で移動　Esc で終了</div>';
    document.body.appendChild(ov);
    const stage = ov.firstChild;
    const draw = () => {
      const k = Math.min(window.innerWidth / this.W, window.innerHeight / this.H);
      stage.style.transform = `translate(-50%,-50%) scale(${k})`;
      stage.innerHTML = htmls[i];
    };
    const close = () => {
      window.removeEventListener('keydown', key, true); window.removeEventListener('resize', draw);
      document.removeEventListener('fullscreenchange', fs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      ov.remove();
    };
    const fs = () => { if (!document.fullscreenElement) close(); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) i = Math.min(i + 1, htmls.length - 1);
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) i = Math.max(i - 1, 0);
      else if (e.key === 'Home') i = 0; else if (e.key === 'End') i = htmls.length - 1; else return;
      e.preventDefault(); draw();
    };
    window.addEventListener('keydown', key, true); window.addEventListener('resize', draw);
    ov.addEventListener('click', e => { i = e.clientX < window.innerWidth / 3 ? Math.max(i - 1, 0) : Math.min(i + 1, htmls.length - 1); draw(); });
    draw();
    try { ov.requestFullscreen().then(() => document.addEventListener('fullscreenchange', fs)).catch(() => {}); } catch (e) { /* 全画面にできなくても、重ね表示で発表できる */ }
  },

  /** 印刷・PDF：1枚＝1ページ（16:9） */
  print(htmls, title) {
    Print.open({ title, html: htmls.map(h => `<div class="p-page sl-print">${h}</div>`).join(''), orientation: '', margin: '0', size: '338.67mm 190.5mm' });
  },
};
