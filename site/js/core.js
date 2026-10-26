'use strict';
/* ============================================================
   共通：ユーティリティ／マスタ／データ構造／保存
   ============================================================ */

const APP = {
  version: '0.6.0',
  schema: 1,
  storageKey: 'shushoku-senko:autosave',
};

/* ---------- 小さなユーティリティ ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => v == null ? '' : String(v).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => JSON.parse(JSON.stringify(o));

/** 全角英数・記号を半角に */
function toHalf(s) {
  return String(s ?? '')
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[－ー―‐]/g, '-');
}
/** 数値化（空・不正は null） */
function num(v) {
  if (v == null || v === '') return null;
  const n = Number(toHalf(v).replace(/[,，\s円人万]/g, ''));
  return Number.isFinite(n) ? n : null;
}
const digits = v => toHalf(v).replace(/\D/g, '');
/** 学籍番号（1〜3年）はすべて4桁の数字という前提。4桁でなければ '' を返す */
const STUDENT_NO = /^\d{4}$/;
function studentNo(v) { const d = digits(String(v ?? '').trim().replace(/\.0+$/, '')); return STUDENT_NO.test(d) ? d : ''; }
/** 取り込み用：学籍として読めないセルの理由（空のセルは null） */
function badStudentNo(v) {
  if (v == null || String(v).trim() === '') return null;
  return `学籍「${String(v).trim().slice(0, 12)}」が4桁の数字ではありません`;
}
const reiwa = y => y - 2018;
const nendoLabel = y => `令和${reiwa(y)}年度`;
function fmtNum(v) { return v == null || v === '' ? '' : Number(v).toLocaleString('ja-JP'); }
function todayISO() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
/** 現在の年度（4月始まり） */
function currentNendo(d = new Date()) { return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; }

/* ---------- 分類マスタ（既定値） ---------- */
// 日本標準産業分類（大分類）：[記号, 名称, 中分類コード開始, 終了]
const INDUSTRY_RANGES = [
  ['A', '農業・林業', 1, 2], ['B', '漁業', 3, 4], ['C', '鉱業、採石業、砂利採取業', 5, 5],
  ['D', '建設業', 6, 8], ['E', '製造業', 9, 32], ['F', '電気・ガス・熱供給・水道業', 33, 36],
  ['G', '情報通信業', 37, 41], ['H', '運輸業、郵便業', 42, 49], ['I', '卸売業、小売業', 50, 61],
  ['J', '金融業、保険業', 62, 67], ['K', '不動産業、物品賃貸業', 68, 70],
  ['L', '学術研究、専門・技術サービス業', 71, 74], ['M', '宿泊業、飲食サービス業', 75, 77],
  ['N', '生活関連サービス業、娯楽業', 78, 80], ['O', '教育、学習支援業', 81, 83],
  ['P', '医療、福祉', 84, 85], ['Q', '複合サービス事業', 86, 87],
  ['R', 'サービス業（他に分類されないもの）', 88, 97], ['S', '公務', 98, 98], ['T', '分類不能の産業', 99, 99],
];
// 職業分類：[厚労省記号, 厚労省名称, 総務省記号, 総務省名称, 中分類開始, 終了]
const OCCUPATION_RANGES = [
  ['A', '管理的職業', 'A', '管理的職業従事者', 1, 3],
  ['B', '研究・技術の職業', 'B', '専門的・技術的職業従事者', 4, 9],
  ['C', '法務・経営・文化芸術等の専門的職業', 'B', '専門的・技術的職業従事者', 10, 20],
  ['D', '医療・看護・保健の職業', 'B', '専門的・技術的職業従事者', 21, 28],
  ['E', '保育・教育の職業', 'B', '専門的・技術的職業従事者', 29, 32],
  ['F', '事務的職業', 'C', '事務従事者', 33, 43],
  ['G', '販売・営業の職業', 'D', '販売従事者', 44, 48],
  ['H', '福祉・介護の職業', 'E', 'サービス職業従事者', 49, 51],
  ['I', 'サービスの職業', 'E', 'サービス職業従事者', 52, 58],
  ['J', '警備・保安の職業', 'F', '保安職業従事者', 59, 63],
  ['K', '農林漁業の職業', 'G1', '農林業従事者', 64, 65],
  ['K', '農林漁業の職業', 'G2', '漁業従事者', 66, 66],
  ['L', '製造・修理・塗装・製図等の職業', 'H5', 'その他', 67, 69],
  ['L', '製造・修理・塗装・製図等の職業', 'H2', '機械組立従事者', 70, 70],
  ['L', '製造・修理・塗装・製図等の職業', 'H1', '製造・加工従事者', 71, 73],
  ['L', '製造・修理・塗装・製図等の職業', 'H2', '機械組立従事者', 74, 74],
  ['L', '製造・修理・塗装・製図等の職業', 'H3', '整備・修理従事者', 75, 75],
  ['L', '製造・修理・塗装・製図等の職業', 'H4', '検査従事者', 76, 79],
  ['L', '製造・修理・塗装・製図等の職業', 'H5', 'その他', 80, 81],
  ['M', '配送・輸送・機械運転の職業', 'I', '輸送・機械運転従事者', 82, 89],
  ['N', '建設・土木・電気工事の職業', 'J', '建設・採掘従事者', 90, 94],
  ['O', '運搬・清掃・包装・選別の職業', 'K', '運搬・清掃・包装等従事者', 95, 99],
];
// 従業員規模区分（統計調査）：[区分, 下限]
const SIZE_CLASSES = [[1, 1, '29人以下'], [2, 30, '30〜99人'], [3, 100, '100〜299人'], [4, 300, '300〜499人'], [5, 500, '500〜999人'], [6, 1000, '1000人以上']];

// 求人番号の先頭5桁 → 受理安定所（愛知・岐阜の主なもの。未登録は空欄）
const OFFICE_CODES = {
  '23010': '名古屋東', '23020': '名古屋中', '23030': '名古屋南', '23040': '豊橋', '23050': '岡崎',
  '23060': '一宮', '23070': '半田', '23080': '瀬戸', '23090': '豊田', '23100': '津島',
  '23110': '刈谷', '23120': '西尾', '23130': '犬山', '23140': '豊川', '23150': '新城',
  '23160': '蒲郡', '23170': '春日井', '23180': '碧南',
  '21010': '岐阜', '21020': '大垣', '21030': '多治見', '21040': '高山', '21050': '恵那', '21070': '美濃加茂',
};
const PREFS = ['', '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];


/* ============================================================
   帳票のレイアウト（依頼文・確認書・送付状・宛名ラベル）の既定値
   - 文書は「ブロック」の並び。ブロックは text（文章）／table（表）／form（記入欄）／space（余白）
   - 文章中の {会社名} {日付} などは、印刷のときに差し込まれる（一覧は「帳票の設定」画面に出る）
   - 設定は settings.docLayout[文書名]。null のあいだは、ここの既定値を使う
   ============================================================ */
const DOC_FONTS = { mincho: ['明朝体', '"BIZ UDPMincho", "MS PMincho", "Yu Mincho", serif'], gothic: ['ゴシック体', '"BIZ UDPGothic", "BIZ UDPゴシック", "Yu Gothic UI", "Meiryo UI", sans-serif'] };
const DOC_FIELDS = { dept: '学科', name: '氏名', no: '番号', gender: '性別', job: '職種', jobNumber: '求人番号', company: '事業所名', visitDate: '見学日', visitTime: '見学の時間', blank: '（空欄）' };
const DOC_PLACEHOLDERS = ['日付', '会社名', '宛先', '部署', '担当者', '職種', '求人番号', '見学日', '時候の挨拶', '卒業年', '学校名', '校長名', '主事名', '郵便番号', '住所', '電話', 'FAX'];

function defaultDocLayout() {
  const style = () => ({ font: 'mincho', size: 11, line: 1.9, margin: [18, 20, 18, 20] });   // 余白は 上・右・下・左（mm）
  const text = (t, o = {}) => Object.assign({ type: 'text', text: t, align: 'left', size: null, bold: false, indent: 0, left: 0, before: 0, after: 0, spacing: 0 }, o);
  const para = (t, o = {}) => text(t, Object.assign({ align: 'justify', indent: 1, after: 3 }, o));
  const title = t => text(t, { align: 'center', size: 16, bold: true, spacing: 0.3, before: 8, after: 6 });
  return {
    // 2026-10-20：利用者が示した現行の PDF（送付状・依頼文・確認書・宛名ラベル）の寸法に合わせた既定。
    //   縦の位置は「行の高さ（style.line）× 文字の大きさ」と、各ブロックの height / after で再現している。
    cover: {
      name: '応募書類の送付状', style: { font: 'mincho', size: 12, line: 1.81, margin: [18.4, 14, 18, 23.3] }, blocks: [
        text('{日付}', { align: 'right', right: 7.7, after: 4.6 }),
        text('{会社名}', { height: 8.2, fit: 99.7 }),
        text('{宛先}', { height: 8.2, left: 7.2, after: 2.4 }),
        text('{学校名}長', { align: 'right', right: 14.9, size: 11.5, height: 6.4 }),
        text('{校長名}', { align: 'right', right: 10.67, spacing: 1, height: 6.4, after: 7.4 }),
        text('就職応募書類の送付について', { align: 'center', size: 14, after: 5.4 }),
        para('{時候の挨拶}、ますます御清栄のこととお慶び申し上げます。', { indent: 1.7, right: 14.7, after: 0 }),
        para('日頃は本校生徒への求職活動につきまして、格別の御配慮を賜り厚く御礼申し上げます。', { indent: 1.7, right: 14.7, after: 0 }),
        para('さて、令和{卒業年}年３月に本校卒業予定の就職希望者のうち、下記の生徒が希望しております。', { indent: 1.7, right: 14.7, after: 0 }),
        para('つきましては、下記の生徒を推薦させていただきますとともに、統一応募書類を送付いたします。御査収の上、御高配を賜りますようお願い申し上げます。', { indent: 1.7, right: 14.7, after: 0 }),
        para('なお、就職試験に関する連絡や採用結果に関する書類をお送りいただきます場合は、進路指導部宛にお願いいたします。', { indent: 1.7, right: 14.7, after: 6.5 }),
        text('記', { align: 'center', after: 3.3 }),
        { type: 'table', look: 'plain', headerAlign: 'center', minRows: 5, rowHeight: 10.5, bodySize: 11, before: 0, after: 8.2, columns: [
          { header: '〔学科〕', field: 'dept', width: 49.9, align: 'center' },
          { header: '〔応募者氏名〕', field: 'name', width: 43.6, align: 'center' },
          { header: '〔応募職種〕', field: 'job', width: 0, align: 'center' }] },
        text('〔連絡先〕\n進路指導主事　{主事名}\n〒{郵便番号}\n{住所}\nＴＥＬ　{電話}\nＦＡＸ　{FAX}', { left: 86.9, lh: 1.1 }),
      ],
    },
    visitLetter: {
      name: '職場見学のお願い（依頼文）', style: { font: 'mincho', size: 12, line: 1.44, margin: [20, 19.8, 18, 20] }, blocks: [
        text('{日付}', { align: 'right', after: 6.05 }),
        text('{会社名}'),
        text('人事採用担当者　様', { left: 4, after: 6.1 }),
        text('{学校名}', { left: 121.4 }),
        text('校長　{校長名}', { align: 'right' }),
        text('(連絡先電話番号)\n{電話}\n(連絡先教諭名)\n進路指導主事　{主事名}', { left: 121.4, after: 7.55 }),
        text('職場見学のお願い', { align: 'center', size: 18, bold: true, after: 7.65 }),
        para('この度、別紙の生徒が見学を希望していますので、受入れ方よろしくお願いします。', { indent: 0.95, after: 0 }),
        para('また、職場見学をその後の就職指導に役立てるため、職場見学確認書に人事担当者の署名をいただいて帰るよう生徒に指導しています。誠に恐縮ですが、別紙の確認書にご記入の上、生徒にお渡しくださるようお願いいたします。', { indent: 0.95, after: 18.3 }),
        text('《お願い》'),
        para('職場見学は、生徒が応募先を決定するのに先立って、実際の仕事や職場への理解を深めるために行うものです。', { left: 4, right: 12.5, indent: 0.97, after: 0 }),
        para('そのため、職場見学の受入れに当たっては、採用選考とならないよう、次についてご留意いただくようお願いします。', { left: 4, right: 12.5, indent: 0.97, after: 9.4 }),
        text('○　応募書類をはじめとして生徒に書類の提出を求めないでください。\n○　採用選考に直接つながる質問をしたり、内定と受け取られるような話をしたりしないようにしてください。', { align: 'left', left: 7.9, right: 12.9, box: true, hang: 1 }),
      ],
    },
    visitConfirm: {
      name: '職場見学確認書', style: { font: 'mincho', size: 12, line: 1.44, margin: [20, 19.8, 18, 20] }, blocks: [
        text('会社名：{会社名}', { align: 'right', after: 7.6 }),
        text('職場見学確認書', { align: 'center', size: 18, bold: true, after: 7.6 }),
        text('見学日　{見学日}', { ul: 64.8 }),
        text('学校名　{学校名}', { ul: 64.8, after: 5.8 }),
        { type: 'table', look: 'dot', headerAlign: 'center', minRows: 5, rowHeight: 9.3, bodySize: 11, before: 0, after: 18.2, left: 8.2, right: 8.5, columns: [
          { header: '生徒氏名', field: 'name', width: 45.7, align: 'center' },
          { header: '希望職種', field: 'job', width: 45.7, align: 'center' },
          { header: '求人番号', field: 'jobNumber', width: 45.7, align: 'center' },
          { header: '参加', field: 'blank', width: 16.4, align: 'center' }] },
        text('◇　上記生徒のうち、参加欄に「○」を付けた生徒は、確かに当社を見学しました。', { align: 'left', after: 6.1 }),
        { type: 'form', labelWidth: 40.5, labelAlign: 'center', before: 0, after: 6, right: 0.6, rows: [
          { label: '担当者（役職名）\nご氏名', height: 24.6 }, { label: '学校への連絡', height: 24.6 }] },
        text('（注）　当日訪問しました生徒の参加欄に「○」を記入してください。\n特に、学校へ伝える事項がある場合は「学校への連絡」欄に記入してください。', { indent: -3.83 }),
      ],
    },
    // 宛名ラベル（職場見学）：PDF の位置に合わせた。各行は上端からの距離（mm）で置き、長い文字は枠の幅に収まるよう縮める
    label: { name: '宛名ラベル', zipSize: 10, addrSize: 10, coSize: 10, toSize: 10, align: 'left', padTop: 2, padSide: 0, indent: 4.4,
      addrTop: 4.4, coTop: 13.5, toTop: 18.2, fitAddr: 59.5, fitCo: 67, boldCompany: false, showZip: true },
  };
}

const HISTORY_SEED = {
  // 求人票数の推移（進路指導まとめの表より）
  jobs: { 2015: 943, 2016: 937, 2017: 1047, 2018: 1221, 2019: 1352, 2020: 1032, 2021: 1041, 2022: 1117, 2023: 1189, 2024: 1562, 2025: 1570 },
  // 卒業者全体（進路指導まとめの表1・昨年度資料）。年度＝卒業する年度
  summary: {
    2025: { jobSchool: 67, jobOther: 1, jobPublic: 0, univ: 32, junior: 7, senshu: 47, college: 2, eduOther: 0, other: 6 },
    2024: { jobSchool: 74, jobOther: 4, jobPublic: 2, univ: 34, junior: 3, senshu: 67, college: 0, eduOther: 0, other: 8 },
  },
};
function blankHistory() {
  return { jobs: clone(HISTORY_SEED.jobs), summary: clone(HISTORY_SEED.summary), work: [], senshu: [], univ: [], master: null, imported: {} };
}


/* ---------- 年間タスク（既定） ---------- */
const DEFAULT_TASKS = [
  { id: 't01', when: '4月', title: '前年度分の統計調査（事務より依頼・前年度のデータファイルで作成）', page: 'reports' },
  { id: 't02', when: '4月', title: '年度更新：今年度のデータファイルを作成', page: 'settings' },
  { id: 't02b', when: '4月', title: '3年生の進路希望調査（Forms）：回答を取り込み、集計・個人別一覧を印刷', page: 'survey' },
  { id: 't03', when: '6〜7月', title: '求人票の入力（7/1 公開分から随時）', page: 'jobs' },
  { id: 't04', when: '7月上旬', title: '進路希望調査の取りまとめ', page: 'students' },
  { id: 't05', when: '7月上旬', title: '評定・出欠・特別活動データの取り込み', page: 'students' },
  { id: 't06', when: '7月中旬', title: '校内順位（ポイント）の確定', page: 'ranking' },
  { id: 't07', when: '7月中旬', title: '選考会議：応募先の確定', page: 'selection' },
  { id: 't08', when: '7月下旬', title: '職場見学：電話連絡の分担・日程調整', page: 'visits' },
  { id: 't09', when: '7月下旬', title: '職場見学：依頼文・確認書・宛名ラベルの準備', page: 'visits' },
  { id: 't10', when: '8月', title: '職場見学の事前指導（座席表・出欠票）', page: 'visits' },
  { id: 't11', when: '8月下旬', title: '応募先の最終確定・書類送付先の変更を反映', page: 'applications' },
  { id: 't12', when: '8月下旬', title: '受験企業一覧（一斉起案）', page: 'applications' },
  { id: 't13', when: '9月上旬', title: '応募書類の送付（送付状・レターパックラベル）', page: 'applications' },
  { id: 't14', when: '9月中旬〜', title: '試験日・合否・受験報告書の管理', page: 'applications' },
  { id: 't15', when: '10月〜', title: '2次選考以降の応募', page: 'second' },
  { id: 't16', when: '毎月初', title: 'ハローワーク報告（様式13・前月末現在）※4月末現在分から', page: 'reports' },
  { id: 't17', when: '随時', title: '内定状況調査・就職者名簿', page: 'reports' },
  { id: 't18', when: '1月ごろ', title: '進路指導まとめ（簡易版）：進路決定を入力し、活動中の人数つきで作成', page: 'yearend' },
  { id: 't19', when: '年度末', title: '進路決定の入力 → 進路先一覧（就職先・専修各種・四大短大）・進路指導まとめ・指定校一覧', page: 'outcomes' },
];

/* ---------- 既定の設定 ---------- */
function defaultSettings() {
  return {
    school: {
      name: '',            // 学校名（「設定」で入力する。帳票・ラベルに入る）
      reportName: '',      // 報告書に載せる学校名（例：〇〇高等学校（全日制））
      zip: '',
      address: '',
      tel: '',
      fax: '',
      principal: '',       // 校長名
      director: '',        // 進路指導主事名
      dept: '進路指導部',
    },
    // 3年生の番号範囲 → 学科
    //   report: ハローワーク様式13の列（学科・課程別）
    //   stat / statCode: 統計調査（厚労省）の行
    departments: [
      { from: 3100, to: 3299, major: '商業', name: '商業科A', short: '商', report: '商業', stat: '商業科', statCode: '400' },
      { from: 3300, to: 3499, major: '商業', name: '商業科B', short: '商', report: '商業', stat: '商業科', statCode: '400' },
      { from: 3500, to: 3599, major: '家庭', name: '家庭科', short: '家', report: '生活文化', stat: '家庭科', statCode: '600' },
      { from: 3600, to: 3699, major: '福祉', name: '福祉科', short: '福', report: '福祉', stat: '福祉科', statCode: '750' },
    ],
    homePref: '',                // 本校の都道府県番号（例：愛知＝23）。「設定」で入力する
    kannaiOfficeCodes: [],       // 管内の安定所（求人番号の先頭5桁。例：23110）
    // 様式13「管内」＝その安定所の管轄地域の市町（就業場所で判定）。「設定」で入力する
    kannaiCities: [],
    // 校内選考規定（R2施行）Ⅰ-2
    pointRules: {
      absence: [{ max: 0, p: 0.2 }, { max: 5, p: 0.15 }, { max: 9, p: 0.1 }],
      lateEarly: [{ max: 0, p: 0.15 }, { max: 5, p: 0.1 }, { max: 9, p: 0.05 }],
      noDiscipline3: 0.1,
      noDiscipline12: 0.05,
      club: 0.1,
      captain: 0.1,
      councilPer: 0.05,
      councilMax: 0.1,
    },
    // 宛名ラベル用紙（2026-10-20：利用者の現行 PDF に合わせた。
    //   職場見学：A4 12面（2列×6段・87.2mm 幅。段の高さは PDF のとおり 39.2×3 段＋43.5×3 段）
    //   応募書類（レターパック）：A4 4面（2列×2段・100.3×140.8mm・上7.6 左4.7）
    //   rowH＝段ごとの高さ（mm・カンマ区切り）。空欄なら「高さ」を全段に使う）
    labels: {
      visit: { name: '職場見学の宛名', cols: 2, rows: 6, w: 87.2, h: 40.9, rowH: '39.2,39.2,39.2,43.5,43.5,43.5', top: 25.8, left: 27.3, gapX: 0, gapY: 0 },
      envelope: { name: '応募書類の宛名（レターパック）', cols: 2, rows: 2, w: 100.3, h: 140.8, rowH: '', top: 7.6, left: 4.7, gapX: 0, gapY: 0 },
    },
    // 帳票の日付
    docs: { visitLetterDate: '', sendDate: '' },
    // 報告・統計の表示
    reports: { hideZero: false, hideFail: false },   // true＝0は記載しない（空欄にする）
    // 年度末の資料
    yearend: { workRecent: 5, senshuYears: 7, univYears: 8, dropEmpty: true, asOf: '', notes: '' },
    // 帳票のレイアウト（null＝既定。「帳票の設定」画面で編集すると、ここに保存される）
    docLayout: { cover: null, visitLetter: null, visitConfirm: null, label: null },
    greetings: ['寒中', '残寒', '弥生', '陽春', '新緑', '深緑', '盛夏', '残暑', '爽秋', '清秋', '霜寒', '寒冷'].map(s => s + 'の候'),
  };
}

function blankData(year = currentNendo()) {
  return {
    app: 'shushoku-senko',
    schema: APP.schema,
    year,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: defaultSettings(),
    tasks: {},        // { taskId: true }
    imports: [],      // 取り込みフォルダから取り込んだ（または確認済みにした）ファイルの記録
    surveys: [],      // 進路希望調査（Forms）：{ id, year, label, date, responses: [...] }
    history: blankHistory(),   // 過去の実績（累積）：就職先・進学先の年度別人数、指定校マスタ、前年度までのまとめ
    jobs: [],
    students: [],
    applications: [],
  };
}

/** 古い／欠けたデータを現在の形に整える */
function normalizeData(d) {
  if (!d || d.app !== 'shushoku-senko') throw new Error('このアプリのデータファイルではありません。');
  const base = blankData(d.year);
  const out = Object.assign(base, d);
  out.settings = Object.assign(defaultSettings(), d.settings || {});
  out.settings.school = Object.assign(defaultSettings().school, (d.settings || {}).school || {});
  out.settings.pointRules = Object.assign(defaultSettings().pointRules, (d.settings || {}).pointRules || {});
  const defS = defaultSettings();
  out.settings.labels = { visit: Object.assign({}, defS.labels.visit, ((d.settings || {}).labels || {}).visit),
    envelope: Object.assign({}, defS.labels.envelope, ((d.settings || {}).labels || {}).envelope) };
  // 以前の既定（エーワン 31514／A4 4面）のまま使っていたデータは、新しい既定（現行 PDF の寸法）に置き換える
  const sameBox = (a, b) => ['cols', 'rows', 'w', 'h', 'top', 'left', 'gapX', 'gapY'].every(k => Number(a[k]) === b[k]);
  const lab = out.settings.labels;
  if (sameBox(lab.visit, { cols: 2, rows: 5, w: 91, h: 55, top: 11, left: 14, gapX: 0, gapY: 0 })) lab.visit = Object.assign({}, defS.labels.visit, { name: lab.visit.name });
  if (sameBox(lab.envelope, { cols: 2, rows: 2, w: 105, h: 148.5, top: 0, left: 0, gapX: 0, gapY: 0 })) lab.envelope = Object.assign({}, defS.labels.envelope, { name: lab.envelope.name });
  out.settings.docs = Object.assign({}, defS.docs, (d.settings || {}).docs || {});
  out.settings.docLayout = Object.assign({}, defS.docLayout, (d.settings || {}).docLayout || {});
  out.settings.reports = Object.assign({}, defS.reports, (d.settings || {}).reports || {});
  out.settings.yearend = Object.assign({}, defS.yearend, (d.settings || {}).yearend || {});
  // 学科に後から増えた項目（report/stat）を大学科から補う
  const defDept = defaultSettings().departments;
  out.settings.departments = out.settings.departments.map(dp => {
    const ref = defDept.find(x => x.major === dp.major) || {};
    return Object.assign({ report: ref.report || dp.major, stat: ref.stat || dp.name, statCode: ref.statCode || '' }, dp);
  });
  ['jobs', 'students', 'applications'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  out.tasks = out.tasks || {};
  if (!Array.isArray(out.imports)) out.imports = [];
  if (!Array.isArray(out.surveys)) out.surveys = [];
  { const bh = blankHistory(), h = d.history || {};
    out.history = Object.assign(bh, h);
    out.history.jobs = Object.assign({}, bh.jobs, h.jobs || {});
    out.history.summary = Object.assign({}, bh.summary, h.summary || {});
    ['work', 'senshu', 'univ'].forEach(k => { if (!Array.isArray(out.history[k])) out.history[k] = []; });
    if (!out.history.imported) out.history.imported = {}; }
  out.schema = APP.schema;
  return out;
}

/* ============================================================
   求人票の派生値
   ============================================================ */
const Derive = {
  /** 選考会議で使う短い番号：受付番号＝日付(4桁 0701)＋ナンバー＋枝番(最後の1桁。0もある)。日付を除いた「ナンバー＋枝番」を数値化して先頭0を除く。例：07010011→11、県外 070720010→20010 */
  short(job) {
    const d = digits(job.receiptNo);
    return d ? String(Number(d.length > 4 ? d.slice(4) : d)) : '';
  },
  industry(code) {
    const d = digits(code);
    if (!d) return null;
    const two = Number((d.length <= 2 ? d.padStart(3, '0') : d).slice(0, 2));
    const r = INDUSTRY_RANGES.find(x => two >= x[2] && two <= x[3]);
    return r ? { letter: r[0], name: r[1], mid: two } : null;
  },
  occupation(code) {
    const s = toHalf(code).trim();
    if (!s) return null;
    const two = Number(digits(s.split('-')[0]).slice(0, 2));
    const r = OCCUPATION_RANGES.find(x => two >= x[4] && two <= x[5]);
    return r ? { mhlw: r[0], mhlwName: r[1], mic: r[2], micName: r[3], mid: two } : null;
  },
  sizeClass(employees) {
    const n = num(employees);
    if (n == null || n <= 0) return null;
    let c = SIZE_CLASSES[0];
    for (const s of SIZE_CLASSES) if (n >= s[1]) c = s;
    return { cls: c[0], label: c[2] };
  },
  officeCode(job) { const d = digits(job.jobNumber); return d.length >= 5 ? d.slice(0, 5) : ''; },
  office(job) { return job.office || OFFICE_CODES[this.officeCode(job)] || ''; },
  /** 職安の区分：管内／管外（県内）／県外 */
  zone(job, settings) {
    if (job.zoneOverride) return job.zoneOverride;
    const oc = this.officeCode(job);
    if (!oc) return '';
    if ((settings.kannaiOfficeCodes || []).includes(oc)) return '管内';
    if (!settings.homePref) return '';                  // 本校の県が未設定なら判定しない
    if (oc.slice(0, 2) === settings.homePref) return '管外';
    return '県外';
  },
  pref(job) { const oc = this.officeCode(job); return oc ? (PREFS[Number(oc.slice(0, 2))] || '') : ''; },
  /** 就業場所の区分（様式13用）：管内（管轄市町）／管外（県内の他地域）／県外 */
  workZone(job, settings) {
    if (job.workZoneOverride) return job.workZoneOverride;
    if (job.workArea === '県外') return '県外';
    const first = toHalf(job.workplace || '').split(/[・、,，\/／\s]/)[0];
    if (first && (settings.kannaiCities || []).some(c => first.includes(c))) return '管内';
    return '管外';
  },
  /** 就業先の都道府県名（就職者名簿用） */
  workPref(job, settings) {
    if (job.workArea !== '県外') return PREFS[Number(settings.homePref)] || '';
    const m = String(job.workplace || job.address || '').match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/);
    return m ? m[1].replace(/[都府県]$/, '') : '';
  },
  /** 送付先（変更があればそちら） */
  /** 住所に県名がなければつける（愛知・岐阜のみ。名古屋市・岐阜市は、つけない）。郵便番号（440〜499＝愛知、500〜509＝岐阜）で判定する */
  withPref(address, zip) {
    const a = String(address || '').trim();
    if (!a) return a;
    const full = PREFS.filter(Boolean).map(p => (p === '北海道' ? p : p === '東京' ? '東京都' : p === '京都' || p === '大阪' ? p + '府' : p + '県'));
    if (full.some(p => a.startsWith(p)) || /^(名古屋市|岐阜市)/.test(a)) return a;
    const z = Number(String(zip || '').replace(/\D/g, '').slice(0, 3));
    let pref = z >= 440 && z <= 499 ? '愛知県' : z >= 500 && z <= 509 ? '岐阜県' : '';
    if (!pref && !z) {   // 郵便番号がないときは、市町村名で判定する
      const aichi = '豊橋 岡崎 一宮 瀬戸 半田 春日井 豊川 津島 碧南 刈谷 豊田 安城 西尾 蒲郡 犬山 常滑 江南 小牧 稲沢 新城 東海 大府 知多 知立 尾張旭 高浜 岩倉 豊明 日進 田原 愛西 清須 北名古屋 弥富 みよし あま 長久手 愛知郡 西春日井郡 丹羽郡 海部郡 知多郡 額田郡 北設楽郡'.split(' ');
      const gifu = '大垣 高山 多治見 関 中津川 美濃 瑞浪 羽島 恵那 美濃加茂 土岐 各務原 可児 山県 瑞穂 飛騨 本巣 郡上 下呂 海津 羽島郡 養老郡 不破郡 安八郡 揖斐郡 加茂郡 可児郡 大野郡'.split(' ');
      const hit = l => l.some(c => a.startsWith(/郡$/.test(c) ? c : c + '市'));
      pref = hit(aichi) ? '愛知県' : hit(gifu) ? '岐阜県' : '';
    }
    return pref + a;
  },
  sendTo(job) {
    const alt = job.sendZip || job.sendAddress || job.sendDept || job.sendContact;
    return alt ? {
      zip: job.sendZip || job.zip, address: job.sendAddress || job.address,
      dept: job.sendDept || job.dept || '', contact: job.sendContact || job.contact || '', changed: true,
    } : { zip: job.zip, address: job.address, dept: job.dept || '', contact: job.contact || '', changed: false };
  },
};

/** 番号から学科を判定 */
function deptOf(no, settings) {
  const n = num(no);
  if (n == null) return null;
  return settings.departments.find(d => n >= d.from && n <= d.to) || null;
}

/* ============================================================
   保存ファイルの暗号化（WebCrypto：PBKDF2-SHA256 で鍵を作り、AES-GCM で暗号化）
   - パスワードはメモリにだけ持つ（保存しない）。忘れると開けない
   ============================================================ */
const Crypt = {
  ITER: 200000,
  ok() { return !!(window.crypto && crypto.subtle && window.isSecureContext !== false); },
  b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
  unb64(s) { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
  /** パスワードと塩から鍵を作る（1回 0.1〜0.3 秒。セッション中は作った鍵を使い回す） */
  async setup(pass, saltB64, iter = this.ITER) {
    const salt = saltB64 ? this.unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return { key, salt: this.b64(salt), iter };
  },
  async encrypt(obj, c) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, c.key, new TextEncoder().encode(JSON.stringify(obj))));
    return { app: 'shushoku-senko', enc: 'AES-GCM/PBKDF2-SHA256', iter: c.iter, salt: c.salt, iv: this.b64(iv), data: this.b64(ct) };
  },
  /** 暗号化したものを開く。パスワードが違うと例外 */
  async open(w, pass) {
    const c = await this.setup(pass, w.salt, w.iter || this.ITER);
    return { data: await this.openWith(w, c), c };
  },
  /** 作ってある鍵（c）で開く。鍵が合わないと例外 */
  async openWith(w, c) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.unb64(w.iv) }, c.key, this.unb64(w.data));
    return JSON.parse(new TextDecoder().decode(pt));
  },
  isEnc(o) { return !!(o && o.app === 'shushoku-senko' && o.enc && o.data && o.iv && o.salt); },
};

/* ============================================================
   データ保存（メモリ ⇄ ブラウザ一時保存 ⇄ JSONファイル）
   ============================================================ */
const Store = {
  data: null,
  fileHandle: null,
  fileName: '',
  dirty: false,       // ファイルに未保存の変更がある
  crypt: null,        // 暗号化して保存するときの鍵（{ key, salt, iter }）。null＝暗号化しない
  listeners: [],
  _timer: null,
  readOnly: false,    // 閲覧専用（共有データを見るだけ。share.js が設定する）

  on(fn) { this.listeners.push(fn); },
  emit() { this.listeners.forEach(fn => fn()); },

  init() {
    if (this.readOnly) { this.data = blankData(); return { restored: false }; }   // 閲覧専用は、このブラウザの一時保存を使わない
    const saved = this._readAutosave();
    if (saved && saved.enc) {           // 暗号化した一時保存は、パスワードを聞いてから復元する（app.js）
      this.data = blankData();
      return { restored: false, encrypted: saved };
    }
    if (saved) {
      try {
        this.data = normalizeData(saved.data);
        this.fileName = saved.fileName || '';
        this.dirty = !!saved.dirty;
        return { restored: true, savedAt: saved.savedAt };
      } catch (e) { console.warn('一時保存の復元に失敗', e); }
    }
    this.data = blankData();
    return { restored: false };
  },

  /** 変更を通知（呼び出し側でデータを書き換えた後に呼ぶ） */
  changed() {
    if (this.readOnly) { Share.reject(); return; }
    this.data.updatedAt = new Date().toISOString();
    this.dirty = true;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._writeAutosave(), 400);
    this.emit();
  },

  _readAutosave() {
    try { const s = localStorage.getItem(APP.storageKey); return s ? JSON.parse(s) : null; }
    catch (e) { return null; }
  },
  _writeAutosave() {
    if (this.readOnly) return;
    const meta = { savedAt: new Date().toISOString(), fileName: this.fileName, dirty: this.dirty };
    if (this.crypt) {                   // 暗号化の設定があるときは、一時保存も暗号化する
      const c = this.crypt;
      Crypt.encrypt(this.data, c).then(w => {
        try { if (this.crypt === c) localStorage.setItem(APP.storageKey, JSON.stringify(Object.assign(meta, { enc: w }))); }
        catch (e) { console.warn('一時保存に失敗', e); }
      });
      return;
    }
    try {
      localStorage.setItem(APP.storageKey, JSON.stringify(Object.assign(meta, { data: this.data })));
    } catch (e) {
      console.warn('一時保存に失敗', e);
      UI && UI.toast('ブラウザへの一時保存に失敗しました。こまめにファイル保存してください。', 'warn');
    }
  },

  defaultFileName() { return `就職選考データ_R${reiwa(this.data.year)}年度.json`; },

  replace(data, fileName = '', handle = null) {
    this.data = normalizeData(data);
    this.fileName = fileName;
    this.fileHandle = handle;
    this.dirty = false;
    this._writeAutosave();
    this.emit();
  },

  newFile(year) { this.replace(blankData(year)); this.dirty = true; this._writeAutosave(); this.emit(); },

  async open() {
    if (this.readOnly) return false;
    if (window.showOpenFilePicker) {
      try {
        const [h] = await window.showOpenFilePicker({ types: [{ description: '就職選考データ', accept: { 'application/json': ['.json'] } }] });
        const f = await h.getFile();
        return await this._loadText(await f.text(), f.name, h);
      } catch (e) {
        if (e.name === 'AbortError') return false;
        if (e instanceof SyntaxError) throw new Error('ファイルの形式が正しくありません。');
        if (!(e.name === 'SecurityError' || e.name === 'NotAllowedError')) throw e;
      }
    }
    // フォールバック：<input type=file>
    return new Promise((resolve, reject) => {
      const inp = $('#fileInput');
      inp.value = '';
      inp.addEventListener('cancel', () => resolve(false), { once: true });   // ファイル選択を取り消したとき
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return resolve(false);
        try { resolve(await this._loadText(await f.text(), f.name, null)); }
        catch (e) { reject(e); }
      };
      inp.click();
    });
  },

  _json() { return JSON.stringify(this.data, null, 1); },
  /** ファイルに書く中身（暗号化の設定があれば暗号化する） */
  async _payload() { return this.crypt ? JSON.stringify(await Crypt.encrypt(this.data, this.crypt)) : this._json(); },
  /** 開いたファイルの中身を読み込む。暗号化されていればパスワードを聞く。取り消したら false */
  async _loadText(text, name, handle) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('ファイルの形式が正しくありません。'); }
    if (Crypt.isEnc(obj)) {
      if (!Crypt.ok()) throw new Error('このブラウザでは、暗号化したファイルを開けません（Edge／Chrome の新しい版を使ってください）。');
      for (;;) {
        const pass = await UI.askPassword({ title: 'パスワード', message: `「${name}」は暗号化されています。保存したときのパスワードを入れてください。` });
        if (pass == null) return false;
        try {
          const r = await Crypt.open(obj, pass);
          this.crypt = r.c;                // 先に鍵を持たせてから入れ替える（一時保存も暗号化される）
          this.replace(r.data, name, handle);
          return true;
        } catch (e) { UI.toast('パスワードが違います', 'warn'); }
      }
    }
    this.crypt = null;
    this.replace(obj, name, handle);
    return true;
  },

  async save() {
    if (this.readOnly) return false;
    if (this.fileHandle) {
      try {
        const body = await this._payload();
        const w = await this.fileHandle.createWritable();
        await w.write(body);
        await w.close();
        this._saved();
        this._backup(body);
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
        console.warn('上書き保存に失敗', e);
      }
    }
    return this.saveAs();
  },

  async saveAs() {
    if (this.readOnly) return false;
    const name = this.fileName || this.defaultFileName();
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: '就職選考データ', accept: { 'application/json': ['.json'] } }] });
        const body = await this._payload();
        const w = await h.createWritable();
        await w.write(body);
        await w.close();
        this.fileHandle = h;
        this.fileName = h.name;
        this._saved();
        this._backup(body);
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
        if (!(e.name === 'SecurityError' || e.name === 'NotAllowedError')) throw e;
      }
    }
    // フォールバック：ダウンロード
    downloadBlob(new Blob([await this._payload()], { type: 'application/json' }), name);
    this.fileName = name;
    this._saved();
    return true;
  },

  _saved() { this.dirty = false; this._writeAutosave(); this.emit(); },
  /** 自動バックアップ（設定でフォルダを決めてあれば、日時入りのコピーを書く。失敗しても保存は成功のまま） */
  _backup(body) {
    if (typeof Backup === 'undefined') return;
    Backup.after(body, this.fileName).then(n => { if (n && typeof UI !== 'undefined') UI.toast('バックアップ：' + n); }).catch(e => console.warn(e));
    if (typeof Share !== 'undefined') Share.after(body).catch(e => console.warn(e));   // 共有フォルダへの公開
  },
};

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ============================================================
   生徒
   ============================================================ */
function blankStudent(no3) {
  return {
    id: uid(), no3: String(no3 ?? ''), no1: '', no2: '', name: '', gender: '',
    grades: { y1: [], y2: [], y3: [] },       // 評定（単位不認定は 1 で入力）
    absent: [null, null, null],               // 1〜3年の欠席日数
    late: [null, null, null],                 // 遅刻回数
    early: [null, null, null],                // 早退回数
    disc3: false,       // 3年で家庭（学校）謹慎以上の特別指導あり
    disc12: false,      // 1・2年で同上あり
    club3: false,       // 3年で部活動在籍（規定の条件を満たす）
    captain: false,     // 部長経験
    council: 0,         // 生徒会役員の期数
    mogi: null,         // 校内模試の順位（小さいほど上位）
    course: '',         // 進路希望：就職／進学／その他
    method: '',         // 受験方法：学校斡旋／縁故／公務員 など
    hope: '',           // 第1希望（進路希望調査の記述）
    hopeJob: '',        // 希望職種
    dest: null,         // 進路先（進路決定）：{ type, status, jobKind, company, ind, occ, jobTitle, level, school, faculty, dept, exam, field, note }
    disability: false,  // 様式13の（ ）内数に計上
    group: '',          // 職場見学のグループ（G分け）
    note: '',
  };
}

const Students = {
  all() { return Store.data.students; },
  byId(id) { return Store.data.students.find(s => s.id === id); },
  byNo(no) { const k = String(num(no) ?? no); return Store.data.students.find(s => s.no3 === k); },
  dept(s) { return deptOf(s.no3, Store.data.settings); },
  /** 就職（学校斡旋）対象か */
  isJobSeeker(s) { return s.course === '就職' && (!s.method || s.method === '学校斡旋'); },
  /** 進路を変えて（進学などから）就職に加わった生徒。1次の選考会議には出せず、2次以降から応募する */
  lateEntrant(s) { const l = s.destLog || []; return s.course === '就職' && l.length > 0 && l[l.length - 1].to === '就職'; },
  label(s) { return `${s.no3} ${s.name || ''}`.trim(); },
};

/* ============================================================
   校内選考ポイント（校内選考に関する規定 Ⅰ-2）
   ============================================================ */
const Points = {
  /** Excel の ROUND と同じ四捨五入（誤差よけ付き） */
  round(v, d) { const f = 10 ** d; return Math.round((v + Math.sign(v) * 1e-9) * f) / f; },
  sum(a) { return (a || []).reduce((t, v) => t + (num(v) || 0), 0); },
  step(total, table) {
    for (const r of table.slice().sort((a, b) => a.max - b.max)) if (total <= r.max) return r.p;
    return 0;
  },
  /** 学習状況ポイント：1年〜3年1学期の評定平均（小数第2位を四捨五入） */
  learning(s) {
    const all = [].concat(s.grades.y1 || [], s.grades.y2 || [], s.grades.y3 || []).map(num).filter(v => v != null);
    if (!all.length) return null;
    return this.round(all.reduce((a, b) => a + b, 0) / all.length, 1);
  },
  calc(s, rules) {
    const learning = this.learning(s);
    const absentTotal = this.sum(s.absent);
    const lateTotal = this.sum(s.late) + this.sum(s.early);
    const absentP = this.step(absentTotal, rules.absence);
    const lateP = this.step(lateTotal, rules.lateEarly);
    const d3P = s.disc3 ? 0 : rules.noDiscipline3;
    const d12P = s.disc12 ? 0 : rules.noDiscipline12;
    const life = this.round(absentP + lateP + d3P + d12P, 2);
    const clubP = s.club3 ? rules.club : 0;
    const capP = s.captain ? rules.captain : 0;
    const councilP = Math.min((num(s.council) || 0) * rules.councilPer, rules.councilMax);
    const special = this.round(clubP + capP + councilP, 2);
    const noAttendance = [].concat(s.absent, s.late, s.early).every(v => v == null || v === '');
    return {
      learning, life, special,
      final: learning == null ? null : this.round(learning + life + special, 2),
      absentTotal, lateTotal, absentP, lateP, d3P, d12P, clubP, capP, councilP: this.round(councilP, 2),
      gradeCount: [].concat(s.grades.y1 || [], s.grades.y2 || [], s.grades.y3 || []).filter(v => num(v) != null).length,
      warn: [learning == null ? '評定なし' : '', noAttendance ? '出欠未入力' : ''].filter(Boolean),
    };
  },
  /** 並び順の比較：最終P → 生活P → 特活P（高い順）→ 模試順位（小さい順） */
  compare(a, b) {
    const k = (x, y) => (y ?? -1) - (x ?? -1);
    return k(a.p.final, b.p.final) || k(a.p.life, b.p.life) || k(a.p.special, b.p.special)
      || ((a.s.mogi ?? 1e9) - (b.s.mogi ?? 1e9));
  },
  /**
   * 順位表を作る。全体順位 overall と 就職順位 jobRank（就職希望者内）を付ける。
   * 規定の①〜④がすべて同じなら同順位（tie=true、選考会議で判断）。
   */
  ranking(students = Store.data.students, rules = Store.data.settings.pointRules) {
    const rows = students.map(s => ({ s, p: this.calc(s, rules) }));
    const assign = (list, key) => {
      const sorted = list.filter(r => r.p.final != null).sort((a, b) => this.compare(a, b));
      sorted.forEach((r, i) => {
        const prev = sorted[i - 1];
        r[key] = prev && this.compare(prev, r) === 0 ? prev[key] : i + 1;
      });
      sorted.forEach((r, i) => {
        if ((sorted[i - 1] && sorted[i - 1][key] === r[key]) || (sorted[i + 1] && sorted[i + 1][key] === r[key])) r[key + 'Tie'] = true;
      });
    };
    assign(rows, 'overall');
    assign(rows.filter(r => Students.isJobSeeker(r.s)), 'jobRank');
    return rows;
  },
};

/* ============================================================
   応募（希望・確定・見学・受験・合否）
   ============================================================ */
function blankApplication(studentId, jobId, round = 1, pref = 1) {
  return {
    id: uid(), studentId, jobId,
    round,              // 1＝1次（選考会議）、2＝2次…
    pref,               // 希望順（1次の第1〜第5希望）。2次以降は 1
    confirmed: false,   // 応募先として確定
    // 職場見学
    visitCaller: '',    // 電話連絡の担当教員
    visitDate: '', visitTime: '', visitNote: '',
    visitDone: false,   // 見学済み（確認書回収）
    // 応募・受験
    docsSent: false,    // 応募書類送付済み
    docsSentDate: '',
    examDate: '', examTime: '',
    result: '',         // ''（未定）／内定／不採用／辞退
    resultDate: '',     // 合否が出た日（様式13の月末集計に使う）
    reportSubmitted: false, // 受験報告書の提出
    note: '',
  };
}

const RESULTS = ['', '内定', '不採用', '辞退'];

const Apps = {
  all() { return Store.data.applications; },
  of(studentId) { return Store.data.applications.filter(a => a.studentId === studentId); },
  /** 1次の希望（第1〜第5） */
  prefs(studentId) {
    const m = {};
    this.of(studentId).filter(a => a.round === 1).forEach(a => { m[a.pref] = a; });
    return m;
  },
  /** 今の応募先＝確定済みのうち最も新しい次の応募 */
  current(studentId) {
    return this.of(studentId).filter(a => a.confirmed).sort((a, b) => b.round - a.round)[0] || null;
  },
  /** 全生徒の現在の応募先 */
  currents() {
    return Store.data.students.map(s => ({ s, a: this.current(s.id) })).filter(x => x.a);
  },
  job(a) { return a ? Jobs.byId(a.jobId) : null; },
  /** 職場見学・送付・試験・合否などの記録がある（確定済みも含む）。消す・付け替えるときは確認する */
  hasRecord(a) {
    return !!(a && (a.confirmed || a.visitCaller || a.visitDate || a.visitTime || a.visitNote || a.visitDone || a.docsSent
      || a.examDate || a.examTime || a.result || a.resultDate || a.reportSubmitted || a.note));
  },
  /** 内定者（基準日以前に内定したもの） */
  decided(asOf) {
    return this.currents().filter(({ a }) => a.result === '内定' && (!asOf || !a.resultDate || a.resultDate <= asOf));
  },
};
