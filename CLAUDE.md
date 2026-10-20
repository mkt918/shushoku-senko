# 就職選考統合サイト　開発メモ（引き継ぎ用）

校内の就職選考（学校斡旋）業務を、1つのスタンドアロン HTML に統合するプロジェクト。
設計の全体像と、移行・引き継ぎの手順は [設計書.md](設計書.md)、最初の計画と決定事項は [00_設計プラン.md](00_設計プラン.md) を参照。

## 絶対のルール

- **GitHub に上げてよいのは、プログラムと文書だけ**（2026-10-15 にユーザーが決めた。それまでは「上げない」だった）。**データは絶対に上げない**：生徒・教員・企業担当者の情報を含むもの（保存した JSON、旧 Excel/Word、CSV、PDF、`dist/` の zip、`.claude/summaries/`）。
  - `.gitignore` は**許可リスト方式**（書いたもの以外は、すべて無視する）。新しいファイルやフォルダを上げたいときは、そこに足す。
  - リポジトリ（`mkt918/shushoku-senko`）は**公開（public）**。2026-10-15 にユーザーが決め、学校情報を消して履歴を作り直したうえで公開し、GitHub Pages（`.github/workflows/pages.yml`、`site/` を配信）で使う形にした。
  - **学校を特定できる情報（学校名・住所・電話・学科名・管内の市町・校長や担当者の名前・メールアドレス）は、コード・文書・例のどこにも書かない**。既定は空欄で、利用者が「設定」に入力する（保存した JSON に入る）。画面の入力例は `〇〇` や `000-0000` にする。コミットの作者のメールは GitHub の noreply アドレスを使う。
  - Pages は誰でも開けるが、**データは入っていない**（生徒のデータは各自のブラウザと、自分で保存する JSON にしかない）。サイトを更新したいときは、push するだけで反映される。
  - 上げる前に、実名が混ざっていないかを確かめる（`dist` を作る `tools/build_zip.py` も、配布物には禁止ファイルが入らないことを確かめる）。
- **個人名を扱わない**：既存の Excel/Word には生徒・教員・企業担当者の実名が入っている。
  - 読むときは、構造（シート名・見出し・数式）と数値だけを出力する。氏名の列は print しない。
  - コード・コメント・ドキュメント・テストデータに実名を書かない。テストは「生徒1」「ダミー1株式会社」などのダミーを使う。
  - 校長名・進路指導主事名は `settings.school.principal / director`（空欄が既定）から差し込む。
- **ネットに接続しない**：外部の CDN やフォントは読み込まない。ライブラリは `site/lib/` に同梱する（今は SheetJS 0.20.3 のみ）。
- **学籍（1・2・3年の番号）はすべて4桁の数字**という前提。共通関数 `studentNo(v)`（4桁でなければ `''`）と `badStudentNo(v)`（取り込みで弾く理由）を使う（core.js）。`digits()` で直接取り出さない。クラスは `no3.charAt(1)`、学科は番号の範囲（`deptOf`）で決まる。
- **ES Modules を使わない**：`file://` で開くため、`<script src>` による通常スクリプトで読み込む。
- UI の変更後にスクリーンショットは撮らない（ユーザーの方針）。確認は `node --check` と、ブラウザのコンソールや JS 実行による軽い確認で行う。

## 起動と動作確認

- 利用者：`site/index.html` をダブルクリック（Edge / Chrome）。
- 起動用：`起動.bat`（プロジェクト直下。ASCII のみ・CRLF で保存すること。Edge → Chrome → 既定ブラウザの順に `--app` で開く。`起動.bat test` で URL だけ表示して終了する）
- 開発時の確認：プレビュー欄は `file://` のスクリプトを実行しない。`.claude/launch.json` の `site`（python http.server 8765）を `preview_start` で起動し、`javascript_tool` で動かして確かめる。
  - `window.print` は `window.print = () => {}` に差し替えてから試す。
  - 終わったら `localStorage.clear()` と `preview_stop` を行う。
- 構文チェック：`cd site && for f in js/*.js js/pages/*.js; do node --check "$f"; done`

## ファイル構成（site/）

| ファイル | 役割 |
|---|---|
| `index.html` | 画面の枠。スクリプトの読み込み順：lib → core → ui → excel → watch → docs → pages/planned → 各ページ → auth → app |
| `css/app.css` | 画面と印刷のスタイル。色は `:root` の変数。印刷用のクラスは `.p-page .p-title .p-meta .p-table .p-note .p-shade` |
| `js/core.js` | ユーティリティ（`$ esc uid toHalf num digits reiwa nendoLabel todayISO`）、分類マスタ、`defaultSettings`、`blankData/normalizeData`、`Derive`（求人の派生値）、`Store`（保存）、`blankStudent/Students`、`Points`（校内選考ポイント）、`blankApplication/Apps/RESULTS` |
| `js/ui.js` | `Pages`（登録とナビ）、`UI`（route/refresh/toast/modal/confirm）、`Form`（フィールド定義から入力欄を生成・読み取り）、`sortRows`、`Print.open` |
| `js/excel.js` | `Excel`（読み込み・`download` による出力）、`ImportTypes`（grades/course/special/jobs）、`Importer.run()`（取り込みダイアログ） |
| `js/pages/*.js` | 1画面1ファイル。最後に `Pages.register({ id, no, group, title, render })` |
| `js/pages/planned.js` | 準備中の画面の仮登録（今は空）。同じ id で本物を登録すると置き換わる |
| `js/docs.js` | 帳票（`Docs`）と応募書類の送付カード（`SendDocs`）。index.html では excel.js の次に読み込む |

## データ（JSON 1ファイル＝1年度）

```
{ app:'shushoku-senko', schema:1, year:2026, settings, tasks:{taskId:true}, imports:[], jobs:[], students:[], applications:[] }
```

- **jobs**：`JOB_FIELDS`（jobs.js）のキー。`kind`（一般／指名／事前選考）、`receiptNo`（下4桁は `Derive.short`）、`jobNumber`（先頭5桁で受理安定所と管内・管外を判定）、`openings`（本校への求人数）、`workplace / workArea`（県内・県外）、`industryCode / occupationCode`、`dept / contact`（応募窓口）、`sendZip / sendAddress / sendDept / sendContact`（送付先の変更。`Derive.sendTo(job)` で最終の宛先が得られる）
- **students**：`blankStudent()` を参照。`no3`（3年番号の文字列）で照合する。対象者の判定は `Students.isJobSeeker(s)`（進路＝就職、かつ受験方法が「学校斡旋」または空欄）
- **applications**：`blankApplication()` を参照。
  - 1次＝`round:1`、第1〜第5希望は `pref`。確定したものは `confirmed:true`。
  - 2次以降は `round:n`（`pref:1`、`confirmed:true`）。
  - 今の応募先は `Apps.current(studentId)`、全員分は `Apps.currents()`。
  - 職場見学の項目（`visitCaller visitDate visitTime visitNote visitDone`）は「職場見学」画面で入力する。

### 変更するときの作法

1. データを書き換える
2. `Store.changed()` を呼ぶ（一時保存と「未保存」表示）
3. 必要なら `UI.refresh()`

データ形式を変えたら `normalizeData` に移行処理を足し、古い JSON も開けるようにする。

## 検証済みのこと（壊さないこと）

- **`Points.calc`**：01「R8元データ（就職）」の169人について、学習P・生活P・特活P・最終P がすべて一致した。
- **`Points.ranking`**：最終P → 生活P → 特活P（それぞれ高い順）→ 模試（小さい順）で並べる。すべて同じなら同順位。
- **`Derive.zone`**：既存の管内・管外列との食い違い25件は、すべて既存の手入力の誤りだった。
- **取り込み**：01「元データ」（評定・出欠）、01「260713進路希望」、02「00_求人票データ」を、そのまま読める。
  - 01「R8元データ（就職）」は値がポイントのため、特活としての取り込みを拒否する（意図どおり）。

## 実装済みの帳票・画面（Sonnet が追加）

- `js/docs.js`：`Docs`（依頼文・確認書・送付状・宛名ラベル・電話連絡分担表・座席表・出欠票・受験企業一覧）、`SendDocs`（応募・受験ページの送付カード）。帳票の本文はこのファイルの HTML。
- `js/pages/visits.js`：職場見学（電話連絡・日程／依頼文・確認書／宛名ラベル／事前指導）
- `js/pages/manual.js`：使い方（`DEFAULT_TASKS` と連動）
- `js/pages/second.js`：2次応募（メニュー7。不採用・辞退になった就職希望者を就職順位順に自動で並べ、2次以降の応募先・試験日・合否を続けて記録する。統計は生徒ごとに最新の応募先（`Apps.current`）で数えるので、1次と2次以降は自動で合算される）。メニュー番号は 8報告 9進路決定 10年度末 11設定 12帳票の設定 13使い方
- 設定：宛名ラベル用紙（`settings.labels.visit / envelope`）、年度更新（`Settings.nextYear`）。
- **宛名ラベル**（2026-10-20 に、ユーザーの現行 PDF の寸法に合わせた）：職場見学（`visit`）は A4 12面（2列×6段・幅87.2mm・上25.8mm・左27.3mm。段の高さは PDF のとおり `rowH`＝39.2×3＋43.5×3）、レターパック用（`envelope`）は A4 4面（2列×2段・100.3×140.8mm・上7.6mm・左4.7mm）。以前の既定（A-one 31514／105×148.5mm）のまま使っていたデータは、`normalizeData` が新しい既定に置き換える。各行の位置は片の左上（職場見学は郵便番号の行）からの距離（mm）で書いてあり、住所・事業所名は枠の幅に収まるよう縮める（`Docs.fitSize`）。別の用紙なら設定で変える。**未確認**：PDF の段の高さが不揃い（39.2／43.5）なのは原本のとおり。実際のシールの寸法とずれるときは、設定の「段ごとの高さ」を直す。PDF の右にある小さな連番（54〜65）は何の番号か分からず、出していない。

- **Handy進路指導室の求人票CSV**：`ImportTypes.handy`（excel.js）。見出し名で列を見つける（`map`）。求人番号で照合（`jobMatch(it, true)`）、既存の求人は**空欄で上書きしない**（送付先・区分・メモを残す）。`Excel.readFile` が CSV の文字コード（UTF-8／BOM／UTF-16／Shift_JIS）を自動判別し、値を文字列のまま読む。PDF（説明資料）の14ページの項目名をもとにしており、**実物の CSV の見出しで未確認**。実物が手に入ったら `map` を合わせる。
- **取り込みフォルダ**：`js/watch.js`（`Watch`＝フォルダのハンドルを IndexedDB に保存・新しい CSV の検出、`WatchBar`＝求人票ページ上部の帯）。File System Access API（Edge / Chrome）。取り込み済みは `data.imports`（名前|サイズ|更新日時）に記録して二重取り込みを防ぐ。権限の確認（`requestPermission`）はボタン操作の中でしか呼べない。実際のフォルダ選択ダイアログは自動テストできないため、模擬ハンドル（`name / queryPermission / requestPermission / entries()`）で検証した。**注意**：開発中のプレビューはブラウザがスクリプトをキャッシュするので、変更後は `fetch(url, {cache:'reload'})` してから再読み込みする。
- **選考会議の「枠」**：（2026-10-15 追記：確定の入力はチェックボックス。確定がまだの人は第1希望を「押さえている」とみなし、下位の同じ求人も取り消し線にする。成績未入力で順位がない人も並び順で上下を決める）求人票1枚に対して1人が就職できる前提。`Jobs.capacity(job)`＝求人数（空欄・0 は 1）。`Selection.rowHtml` が、自分より**上位**（`jobRank` が小さい）で確定した人数 ≧ 枠 のとき `is-taken`（縞の背景＋取り消し線）、自分が確定していて同順位も含めて枠を超えるとき `is-over`（赤）にする。取り消し線でも選択は禁止しない。希望者は `jobStats().entries`（順位つき）から表示。確定案（`autoPropose`）も同じ枠を使う。
- **取り込み様式のダウンロード**：`ImportTypes.<type>.template()`（grades / course / special / **jobs＝現行の形式** / **handy＝Handyの形式**）、一覧ダイアログは `Importer.templates(only)`（`only` に種類を渡すと、その様式だけを出す。求人票の画面は `['jobs','handy']`、生徒・成績は `['grades','course','special']`）。**求人票の様式は2種類**：`jobs` は旧「00_求人票データ」と同じ30列の見出し（＋追加欄 区分・電話番号）、`handy` は説明資料の「読み取り項目」70項目の見出し。どちらも自分の様式を取り込める（往復）ことと、実データ（02の958件・03の964件）が読めることを確認済み。ダウンロードしたファイルを再び取り込めること（往復）を確認済み。見出しの文字を変えたら、`detect` / `parse` と `template` の両方を直す。

## 起動時のパスワード（簡易の鍵）

- `js/auth.js`（`Auth`）。このブラウザで初めて開くときだけ聞き、合っていれば覚える（localStorage にはハッシュだけ）。設定の「ロックする」で覚えを消せる。
- 初期のパスワードは暫定のもの（公開リポジトリのため、文書には書かない。ユーザーに聞く）。ソースにはハッシュ（SHA-256＋塩）だけを書く。変えるときは、コンソールで `Auth.make('新しいパスワード')` を実行し、出た文字列を `PASS_HASH` に貼る。
- **本当の防御ではない**（ソースを読める人は回避できる。生徒のデータも暗号化されない）。「うっかり開かれない」ための鍵。本気で守るなら、保存する JSON をパスワードで暗号化する機能（WebCrypto の AES-GCM）を足す。ユーザーにもそう説明済み。
- `app.js` の処理は `main()` にまとめてあり、`Auth.gate(main)` で始める。パスワードを通るまで、画面（ナビ・データ）は作られない。

## 自動バックアップ・配布 zip（2026-10-16）

- `js/backup.js`（`Backup`）：設定で選んだフォルダ（ハンドルは IndexedDB、キー `backupDir`。`Watch._db` を共用）に、保存のたびに `{ファイル名}_バックアップ_YYYYMMDD-HHMM.json` を書く。10分に1回まで、新しい30個を残す。`Store._backup(body)` から呼ぶ（失敗しても保存は成功のまま）。
- 配布 zip は、Pages のデプロイで `tools/build_zip.py` を実行し、`site/download/shushoku-senko.zip` に置く。ホームの「配布用の zip」はインターネット上（localhost 以外の http/https）で開いたときだけ出る。zip はリポジトリに入れない（`dist/` は上げない）。

## 保存ファイルの暗号化（2026-10-16）

- 設定の「データの暗号化」でパスワードを決めると、保存する JSON と一時保存（localStorage）を暗号化する。`core.js` の `Crypt`（PBKDF2-SHA256 20万回→AES-GCM 256）。鍵は `Store.crypt`（メモリだけ。パスワードは持たない）。
- ファイル：`{ app, enc, iter, salt, iv, data }`（`Crypt.isEnc`）。開くときは `Store._loadText` がパスワードを聞く。書くときは `Store._payload()`。
- 一時保存も暗号化され、起動時は `app.js` がパスワードを聞いて復元する（キャンセルすると空で始まり、何か入力すると上書きされる）。
- **パスワードを忘れると開けない。** WebCrypto が使えない環境（`Crypt.ok()` が偽）では設定に出ない。

## 帳票のレイアウト（設定で直せる）

- 依頼文（`visitLetter`）・確認書（`visitConfirm`）・送付状（`cover`）・宛名ラベル（`label`）は、**コードに文面を書かず、設定（`settings.docLayout[key]`）から組み立てる**。`null` のあいだは `defaultDocLayout()`（core.js）の既定を使う。
- 文書＝`{ name, style: { font, size, line, margin:[上,右,下,左] }, blocks: [...] }`。ブロックは `text`（text, align, size, bold, indent, left, before, after, spacing。2026-10-20 追加：`right`＝右の余白mm、`lh`＝行の高さ（倍）、`height`＝決まった高さの欄の真ん中に1行を置く、`fit`＝この幅mmに収まるよう縮める、`box`＝枠、`hang`＝行ごとのぶら下げ（字）、`ul`＝下線の幅mm）／`table`（columns: [{header, field, width, align}], headerAlign, minRows。追加：`look`＝plain（罫線なし）／dot（横罫線が点線）、`rowHeight`、`bodySize`、`left`・`right`）／`form`（rows: [{label, height}], labelWidth。追加：`labelAlign`、`left`・`right`）／`space`（height）。
- 差し込み：文中の `{会社名}` など（`DOC_PLACEHOLDERS`）を `Docs.context()` の値に置き換える。**言葉を足すときは、`Docs.context` と `DOC_PLACEHOLDERS` の両方**に足す。表の中身の種類は `DOC_FIELDS` と `Docs.cellValue`。
- 描画は `Docs.renderDoc(key, g)`、余白は `Docs.margin(key)`（`Print.open` の margin）。見本のデータは `Docs.sampleGroup()`（実在しない）。
- 編集画面は `js/pages/docset.js`（`DocSet`）。入力欄は `data-p="blocks.3.align"` のようなパスで `working` に書き込み、`save()` で settings に保存し、見本を描き直す。**入力の受け付け（`bindForm`）は画面を作るときに1回だけ付ける**（描き直しのたびに付けると、ボタンが二重に動く）。
- 既定の見た目（2026-10-20 に、ユーザーの現行 PDF〔送付状・依頼文・確認書〕の位置・大きさ・行の高さに合わせた。縦の位置は PDF と 0.3mm 以内で一致することを確かめた）：送付状は 12pt・行の高さ1.81・左23.3mm、表の見出しは「〔学科〕／〔応募者氏名〕／〔応募職種〕」（〔 〕あり・罫線なし）、連絡先は左揃えで右半分（左86.9mm）、校長名は字間をあけて右寄せ。依頼文・確認書は 12pt・行の高さ1.44・余白 上20 右19.8 左20、確認書の表は横罫線が点線。**以前の「〔 〕なし・右揃え」という指定は、この PDF で置き換えた。** 保存済みの設定（`docLayout` が null でないもの）は変わらない。
- **直したバグ**：`renderDoc` の style にフォント名の `"` が入り、`style="…"` が途中で切れて、文字の大きさ・行の高さの設定が一度も効いていなかった（`'` に直した）。
- ほかの帳票（一覧表・分担表・座席表・出欠票・様式13 など）は、まだ設定で直せない（`p-table` 系の固定レイアウト）。

## 進路希望調査（4月・Forms）

- 旧「進路希望調査_作成くん.xlsx」（DATA→NORM→集計／個人別一覧）の作り直し。Forms の様式は**変えない**。`js/survey.js`（`Survey`＝取り込み・整形・集計・HTML）と `js/pages/survey.js`（`SurveyPage`＝画面）。
- データ：`Store.data.surveys = [{ id, year, label, date, responses:[{ no3, gender, course, method, field, school, decided, destination, jobMethod, job, worry, other, reason, at, count, edited }] }]`。
- 取り込み（`Survey.parse`）：Forms の見出しの文言で列を見つける（`Survey.COLS`）。**同じ番号は最新の1件**（ID → 完了時刻 → 行の順）。完了時刻は `2026/4/14 8:32` と `10/26/04 8:32:11`（日/年/月）の両方を読む。
- 整形は旧 NORM と同じ区分（`normCourse` `normMethod` `normJobMethod`）。集計の項目と並びは `SURVEY_ORDER`（Forms の選択肢が増えても末尾に足されて消えない）。
- 人ごとの一覧（`Survey.people`）＝回答＋名簿の未回答者（未定として数える）。個別の直し・口頭の回答は `edited:true` で保存し、取り込み直しても残る。
- **検証済み**：2026年4月の実データ（CSV 181行→166人）と名簿169人で、確定データ（集計）の40行を突き合わせた。27行は完全一致、残りは「確定後に回答した3人」と「手で直された1人」だけの差で、その差の分まで説明がつく。
- 印刷（`.sv-*` のスタイル）は、画面と同じ HTML。A4 横・表は途中で切らない・組ごとに太線・合計行を強調・0 は空欄（`settings.reports.hideZero`）。旧ファイルが見にくかった原因は、16列の細い表を縦向き・印刷範囲なしで出していたため。

## 年度末の資料（進路先一覧・進路指導まとめ・指定校一覧）

- 旧「R7_進路先一覧（就職）／進学先一覧（専修各種・四大短大）／進路の手引 指定校一覧原稿／進路指導まとめ」の作り直し。**累積の表**（行＝会社・学校、列＝年度別の人数）に、今年度の列を自動で足す。
- データ：`Store.data.history`（`blankHistory()`／`normalizeData` で補う）
  - `work`＝就職先 `{ name, ind(業種の記号 A〜T), counts:{年度(西暦):人数}, ord }`、`senshu`＝専修各種 `{ sec:'shitei'|'open', field, fieldNo, name, counts, marks, ord }`、`univ`＝四大短大 `{ level:'univ'|'junior', sec, school, faculty, dept, counts, marks, ord }`
  - `jobs`＝求人票数の推移 `{年度:件数}`（今年度は求人票の件数から自動）、`summary`＝卒業者全体 `{年度:{jobSchool…other}}`、`master`＝指定校マスタ `{ year, univ[], junior[], senshu[] }`
  - 年度は**西暦の年度**（令和7年度＝2025）。表示は `Yr.label`（R7／H30）。`ord` は元の表の並び（読み順）。新しい行は同じグループ内の近い位置に入れる（`History.place`）。
- 進路決定：`student.dest = { type:'就職'|'進学'|'その他', status:'決定'|'活動中', jobKind, company, ind, occ, jobTitle, level, school, faculty, dept, exam, field, note }`。`Outcomes.of(s)` が、入力済みの内容＋内定した求人からの自動（会社名は `shortCompany`）を返す。
- 取り込み：`History.parseWork／parseSenshu／parseUnivi／parseMaster`（SheetJS の ws）。**検証済み**：2025年度（R7）の4つのExcelを読み、進路指導まとめの数字と一致（就職67／専修50＝専門48＋大学校2／大学31＝指定校18＋公募ほか13／短大7）。人数が20以上のセルは年度の入力ミスとして0にして警告（R7四大短大に「30」が3か所）。
- 表の組み立て：`History.workTable／senshuTable／univTable`（`merged()`＝実績＋今年度）。今年度の列は、`Outcomes.hasData()`（決定した人がいる）ときだけ進路決定から上書きする。HTML と Excel は `js/yearend-docs.js`（`YE`）。
- 年度更新：`History.committed()` が、今年度の分を足した実績を返し、`Settings.nextYear` が新しい年度のデータに渡す（古い年度のファイルは変えない）。
- 未確認・質問中：就職先一覧の最後の列は R7 では「1」（令和2年がない）で、今は「最近5年＋それ以前」にしている／求人票数の R7 は、完全版1,570・簡易版1,778で食い違い（1,570を採用）／求人票数は区分「一般」の枚数で数える。

## 配布（zip）

- **作り方**：`python tools/build_zip.py`（プロジェクト直下）→ `dist/就職選考統合管理_v{バージョン}.zip`。
  - **この PC では `python` が Windows のストア用ダミー（WindowsApps）に当たって失敗する**ことがある。実体は `%LocalAppData%\Python\bin\python.exe`（`.claude/launch.json` もこの実体のパスにしてある）。PATH や「アプリ実行エイリアス」の変更は、ユーザーの設定なので勝手に触らない。
  - バージョンは `site/js/core.js` の `APP.version`。配布のたびに上げる。
  - スクリプトが、JS の構文・index.html が読み込むファイルの存在・外部通信の有無・配布してはいけない種類のファイル（json／Excel／Word／CSV／PDF）を確かめてから作る。
- **入るもの**：`site/`、`起動.bat`、`はじめにお読みください.txt`（`tools/readme_template.txt` から作る。UTF-8 BOM・CRLF）、`docs/`（設計書・設計プラン・CLAUDE.md）。**データ（JSON）や旧 Excel は入れない。**
- **利用側に Python は不要**（Edge／Chrome だけ。どちらもなければ既定のブラウザ）。
- 検証済み：展開先が「ダウンロード (1)\work dir」のような場所でも `起動.bat` の URL が正しく作られ、展開した中身だけで全画面・帳票が動く。
- **要注意**：インターネットや SharePoint から落とした zip は「ブロック」が付く。README に、プロパティで［許可する］→ 展開、と書いてある。zip の中で直接 `起動.bat` を開くと動かない。
- `起動.bat` を直すときは、(1) ASCII のみ・CRLF、(2) `(` `)` のブロックと遅延展開を使わない（フォルダ名に `&` `!` `( )` があっても壊れないように `goto` と引用符で書いてある）、(3) 表示用の `echo` でもパスは引用符で囲む。フォルダ名が `x (y) & z!` のような場合まで確認済み。

## 未確認・今後の候補

- 実際のプリンターでの印刷位置（ラベルのずれ）と、Edge / Chrome でファイルをダブルクリックして開いたときの保存・Excel 取り込みは、実機で確かめていない。
- レターパック用ラベルは、旧03の4つ目のシート「【応募書類ラベル】レターパックプラス」の配置を `Docs.letterLabelHtml` に写した（A4 4面・105×148.5mm。宛先／差出人（settings.school）／「就職応募書類在中」の枠）。実際のプリンターでの位置は未確認。
- 送付状の宛先は「部署＋担当者様（なければ人事採用担当者様）」。旧様式と違う点があれば `Docs.cover` を直す。

## 帳票の本文（既存の Word・Excel から。個人名は除いてある）

### 依頼文の本文（04 docx）
- 日付：`令和X年８月吉日`
- 宛名：（事業所名）／人事採用担当者　様
- 差出人：学校名、校長名（settings）、連絡先電話番号、連絡先教諭名＝進路指導主事（settings）
- 件名：**職場見学のお願い**
- 本文：
  > この度、別紙の生徒が見学を希望していますので、受入れ方よろしくお願いします。
  > また、職場見学をその後の就職指導に役立てるため、職場見学確認書に人事担当者の署名をいただいて帰るよう生徒に指導しています。誠に恐縮ですが、別紙の確認書にご記入の上、生徒にお渡しくださるようお願いいたします。
- 《お願い》：
  > 職場見学は、生徒が応募先を決定するのに先立って、実際の仕事や職場への理解を深めるために行うものです。そのため、職場見学の受入れに当たっては、採用選考とならないよう、次についてご留意いただくようお願いします。
  > ○ 応募書類をはじめとして生徒に書類の提出を求めないでください。
  > ○ 採用選考に直接つながる質問をしたり、内定と受け取られるような話をしたりしないようにしてください。
- **職場見学確認書**：
  - 会社名、見学日（　月　日（　））、学校名
  - 表：生徒氏名／希望職種／求人番号／参加
  - 「◇ 上記生徒のうち、参加欄に「○」を付けた生徒は、確かに当社を見学しました。」
  - （注）当日訪問した生徒の参加欄に「○」を記入してください。特に学校へ伝える事項がある場合は「学校への連絡」欄に記入してください。
  - 担当者（役職名）ご氏名欄、学校への連絡欄

### 送付状の本文（03「応募書類」シート）
- 日付：`令和X年９月１日`（設定または入力）
- 宛名：（事業所名）／人事採用担当者
- 差出人：学校名＋「長」
- 件名：**就職応募書類の送付について**
- 本文：
  > （時候の挨拶）、ますます御清栄のこととお慶び申し上げます。
  > 日頃は本校生徒への求職活動につきまして、格別の御配慮を賜り厚く御礼申し上げます。
  > さて、令和（卒業年）年３月に本校卒業予定の就職希望者のうち、下記の生徒が希望しております。
  > つきましては、下記の生徒を推薦させていただきますとともに、統一応募書類を送付いたします。御査収の上、御高配を賜りますようお願い申し上げます。
  > なお、就職試験に関する連絡や採用結果に関する書類をお送りいただきます場合は、進路指導部宛にお願いいたします。
- 記：〔学科〕〔応募者氏名〕〔応募職種〕
- 〔連絡先〕：進路指導主事、〒・住所・TEL・FAX（settings.school）
