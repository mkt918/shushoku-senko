'use strict';
/* 保護者説明会スライドの CSS。アプリ起動時に <style> として入れる。
   同じ文字列を、ダウンロードする HTML にも埋め込む（slides.js の Slides.download） */
const SLIDE_CSS = `
/* ---------- 保護者説明会スライド（1枚＝1280×720px） ---------- */
.sl { width: 1280px; height: 720px; box-sizing: border-box; background: #fff; color: #23262b; font-family: var(--font); position: relative; overflow: hidden; display: flex; flex-direction: column; text-align: left; line-height: 1.4; }
.sl * { box-sizing: border-box; }
.sl .c-job, .sl-tile.c-job { --c: #1f5f8b; --cs: #e6eff6; }
.sl .c-edu, .sl-tile.c-edu { --c: #2e7d4f; --cs: #e5f2ea; }
.sl .c-oth, .sl-tile.c-oth { --c: #8a8576; --cs: #f1efe9; }
.sl-h { padding: 34px 64px 14px; border-bottom: 4px solid #1f5f8b; margin: 0 0 0; }
.sl-h h2 { margin: 0; font-size: 38px; color: #1b4a6b; }
.sl-b { flex: 1; padding: 30px 64px 10px; min-height: 0; }
.sl-f { display: flex; justify-content: space-between; padding: 0 64px 18px; font-size: 16px; color: #8a8576; }
.sl-cover { justify-content: center; padding: 0 110px; background: linear-gradient(135deg, #1b4a6b 0%, #1f5f8b 60%, #3a82b3 100%); color: #fff; }
.sl-cover h1 { font-size: 64px; margin: 0 0 40px; letter-spacing: .04em; }
.sl-c2 { font-size: 26px; margin: 0 0 70px; opacity: .92; }
.sl-c3 { font-size: 24px; margin: 0; opacity: .85; border-top: 2px solid rgba(255,255,255,.5); padding-top: 18px; }
.sl-tiles { display: flex; gap: 24px; }
.sl-tile { flex: 1; background: var(--cs); border-top: 8px solid var(--c); border-radius: 8px; padding: 22px 26px 20px; }
.sl-tl { font-size: 28px; font-weight: 700; color: var(--c); }
.sl-tv { font-size: 96px; font-weight: 700; line-height: 1.1; color: var(--c); font-variant-numeric: tabular-nums; }
.sl-tv small { font-size: 30px; margin-left: 6px; }
.sl-ts { font-size: 17px; color: #4a4e55; min-height: 48px; }
.sl-total { margin-top: 30px; font-size: 30px; text-align: center; }
.sl-total b { font-size: 44px; color: #1b4a6b; }
.sl-stacks { display: flex; flex-direction: column; gap: 18px; }
.sl-sr { display: flex; align-items: center; gap: 16px; font-size: 24px; }
.sl-sl { width: 170px; text-align: right; flex: none; }
.sl-st { flex: 1; display: flex; height: 52px; border-radius: 6px; overflow: hidden; background: #f1efe9; }
.sl-st i { background: var(--c); color: #fff; font-style: normal; font-size: 20px; display: flex; align-items: center; justify-content: center; white-space: nowrap; }
.sl-sr b { width: 90px; font-variant-numeric: tabular-nums; }
.sl-legend { margin-top: 26px; font-size: 20px; text-align: center; color: #4a4e55; }
.sl-legend i { display: inline-block; width: 18px; height: 18px; background: var(--c); border-radius: 3px; vertical-align: -2px; margin-left: 12px; }
.sl-bars { display: flex; flex-direction: column; gap: 14px; }
.sl-br { display: flex; align-items: center; gap: 16px; font-size: 24px; }
.sl-bl { width: 430px; text-align: right; flex: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-bt { flex: 1; height: 36px; background: #f1efe9; border-radius: 4px; }
.sl-bt i { display: block; height: 100%; background: #1f5f8b; border-radius: 4px; }
.sl-br b { width: 80px; font-variant-numeric: tabular-nums; }
.sl-cols { display: flex; align-items: flex-end; gap: 22px; height: 400px; padding-top: 10px; }
.sl-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; font-size: 22px; }
.sl-col i { width: 100%; background: #1f5f8b; border-radius: 4px 4px 0 0; }
.sl-col:last-child i { background: #e08a1e; }
.sl-col span { font-size: 22px; color: #4a4e55; }
.sl-chips { display: flex; flex-wrap: wrap; gap: 10px 12px; }
.sl-chips span { background: #e6eff6; color: #1b4a6b; border-radius: 999px; padding: 6px 18px; font-size: 22px; }
.sl-chips span.more { background: #f1efe9; color: #6a6e75; }
.sl-two { display: flex; gap: 40px; }
.sl-two > div { flex: 1; min-width: 0; }
.sl-two h3 { font-size: 26px; margin: 0 0 14px; color: #1b4a6b; }
.sl-two h3 small { font-size: 20px; color: #6a6e75; font-weight: 400; }
.sl-two .sl-chips span { font-size: 19px; padding: 4px 14px; }
.sl-ex { display: flex; flex-direction: column; gap: 14px; }
.sl-exr { display: flex; align-items: center; gap: 22px; background: #f7f6f2; border-radius: 8px; padding: 16px 24px; font-size: 22px; }
.sl-exr b { width: 170px; flex: none; font-size: 26px; color: #1b4a6b; }
.sl-exr span { flex: 1; }
.sl-exr em { font-style: normal; font-size: 30px; font-weight: 700; color: #2e7d4f; width: 90px; text-align: right; }
.sl-flow { list-style: none; margin: 0; padding: 0; border-left: 4px solid #1f5f8b; }
.sl-flow li { padding: 7px 0 7px 20px; font-size: 22px; }
.sl-flow b { display: inline-block; width: 140px; color: #1b4a6b; }
.sl-ask { margin: 0; padding-left: 26px; font-size: 24px; }
.sl-ask li { margin-bottom: 14px; }
.sl-note { font-size: 18px; color: #6a6e75; margin: 16px 0 0; }
.sl-empty { font-size: 26px; color: #8a8576; text-align: center; margin-top: 120px; }
/* 一覧（画面） */
.sl-rows { display: flex; flex-direction: column; gap: 18px; }
.sl-row { display: flex; gap: 18px; align-items: flex-start; }
.sl-thumb.is-off { opacity: .4; }
.sl-edit { flex: 1; min-width: 280px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 8px 14px; }
.sl-edit > summary { cursor: pointer; font-weight: 700; color: var(--accent); padding: 4px 0; }
.sl-edit[open] > summary { margin-bottom: 8px; }
.sl-edit .grid { grid-template-columns: 1fr; }
.sl-thumb { position: relative; width: 640px; flex: none; height: 360px; border: 1px solid var(--line-strong); border-radius: 6px; overflow: hidden; cursor: pointer; background: #fff; }
.sl-thumb:hover { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.sl-sc { transform-origin: 0 0; width: 1280px; height: 720px; pointer-events: none; }
.sl-no { position: absolute; left: 6px; bottom: 6px; background: rgba(0,0,0,.6); color: #fff; font-size: 12px; padding: 1px 8px; border-radius: 10px; }
/* 発表（全画面） */
#slideShow { position: fixed; inset: 0; z-index: 9999; background: #111; cursor: pointer; overflow: hidden; }
#slideShow .sl-stage { position: absolute; left: 50%; top: 50%; height: 720px; transform-origin: 50% 50%; }
#slideShow .sl-hint { position: absolute; right: 14px; bottom: 10px; color: #888; font-size: 12px; }
/* 印刷（16:9・1枚＝1ページ） */
.sl-print { width: 1280px; height: 719px; overflow: hidden; }

/* ---------- スライド：ひとこと・動き（発表のときだけ） ---------- */
.sl-memo { position: absolute; left: 64px; right: 64px; bottom: 54px; background: #fff4d6; border-left: 6px solid #e08a1e; padding: 10px 20px; font-size: 22px; border-radius: 4px; }
.sl-rows { display: flex; flex-direction: column; gap: 12px; }
.sl-ex .sl-exr span:only-child { font-size: 24px; }
@property --sw { syntax: '<angle>'; inherits: false; initial-value: 360deg; }
@keyframes slSweep { from { --sw: 0deg; } to { --sw: 360deg; } }
@keyframes slUp { from { opacity: 0; transform: translateY(34px); } to { opacity: 1; transform: none; } }
@keyframes slInR { from { opacity: 0; transform: translateX(90px); } to { opacity: 1; transform: none; } }
@keyframes slInL { from { opacity: 0; transform: translateX(-90px); } to { opacity: 1; transform: none; } }
@keyframes slPop { from { opacity: 0; transform: scale(.85) translateY(24px); } to { opacity: 1; transform: none; } }
@keyframes slGrowX { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes slGrowY { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes slBg { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes slLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }
#slideShow .sl.play-r { animation: slInR .55s cubic-bezier(.2,.7,.2,1) both; }
#slideShow .sl.play-l { animation: slInL .55s cubic-bezier(.2,.7,.2,1) both; }
#slideShow .sl[class*="play-"] :is(.sl-h h2, .sl-c2, .sl-c3, .sl-total, .sl-lead, .sl-br, .sl-exr, .sl-flow li, .sl-ask li, .sl-chips span, .sl-col, .sl-two h3, .sl-note, .sl-memo, .sl-empty, .sl-leg li, .sl-g, .sl-pts li, .sl-dc, .sl-rleg span, .sl-st4 > div, .sl-pills span, .sl-m, .sl-edu h3, .sl-edu h4) { animation: slUp .65s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(.2s + var(--i, 0) * .07s); }
#slideShow .sl[class*="play-"] .sl-cover h1, #slideShow .sl-cover[class*="play-"] h1 { animation: slUp .9s cubic-bezier(.2,.7,.2,1) both; animation-delay: .1s; }
#slideShow .sl[class*="play-"] .sl-tile { animation: slPop .7s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(.2s + var(--i, 0) * .12s); }
#slideShow .sl[class*="play-"] .sl-donut { animation: slSweep 1.3s cubic-bezier(.3,.6,.2,1) both; animation-delay: calc(.2s + var(--i, 0) * .07s); }
#slideShow .sl[class*="play-"] .sl-bt i { transform-origin: left; animation: slGrowX 1s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(.35s + var(--i, 0) * .07s); }
#slideShow .sl[class*="play-"] .sl-col i { transform-origin: bottom; animation: slGrowY .9s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(.35s + var(--i, 0) * .07s); }
#slideShow .sl[class*="play-"] .sl-h { position: relative; }
#slideShow .sl[class*="play-"] .sl-h::after { content: ''; position: absolute; left: 0; right: 0; bottom: -4px; height: 4px; background: #e08a1e; transform-origin: left; animation: slLine .9s .15s cubic-bezier(.2,.7,.2,1) both; }
#slideShow .sl-cover { background-size: 220% 220%; animation: slBg 14s ease-in-out infinite; }
#slideShow .sl-cover.play-r, #slideShow .sl-cover.play-l { animation: slInR .55s cubic-bezier(.2,.7,.2,1) both, slBg 14s ease-in-out infinite; }
#slideShow .sl-prog { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: rgba(255,255,255,.12); }
#slideShow .sl-prog i { display: block; height: 100%; background: #e08a1e; transition: width .5s ease; }
@media (prefers-reduced-motion: reduce) { #slideShow .sl-cover { animation: none; } }

/* ---------- スライド 4:3（960×720） ---------- */
.sl.sl-43 { width: 960px; }
.sl-43 .sl-h, .sl-43 .sl-b, .sl-43 .sl-f { padding-left: 48px; padding-right: 48px; }
.sl-43 .sl-h h2 { font-size: 34px; }
.sl-43 .sl-memo { left: 48px; right: 48px; }
.sl-43.sl-cover { padding: 0 80px; }
.sl-43.sl-cover h1 { font-size: 52px; }
.sl-43 .sl-c2 { font-size: 24px; }
.sl-43 .sl-tiles { gap: 16px; }
.sl-43 .sl-tile { padding: 20px 18px 16px; }
.sl-43 .sl-tv { font-size: 80px; }
.sl-43 .sl-ts { font-size: 15px; min-height: 66px; }
.sl-43 .sl-bl { width: 300px; font-size: 22px; }
.sl-43 .sl-two { gap: 24px; }
.sl-43 .sl-two h3 { font-size: 23px; }
.sl-43 .sl-flow b { width: 110px; }
.sl-43 .sl-flow li { font-size: 20px; }
.sl-43 .sl-ask { font-size: 21px; padding-left: 22px; }
.sl-43 .sl-col { font-size: 18px; }
.sl-43 .sl-col span { font-size: 18px; }
.sl-43 .sl-cols { gap: 12px; }
.sl-43 .sl-exr { font-size: 20px; gap: 16px; padding: 14px 18px; }
.sl-43 .sl-exr b { width: 150px; font-size: 23px; }
.sl-43 .sl-chips span { font-size: 20px; }
.sl-43 .sl-two .sl-chips span { font-size: 17px; }

/* ---------- 全体の4つの数字・円グラフ・産業分類別の就職先・まとめ ---------- */
.sl .c-all, .sl-tile.c-all { --c: #1b4a6b; --cs: #e8edf2; }
.sl .c-req, .sl-tile.c-req { --c: #e08a1e; --cs: #fbf1dc; }
.sl-t4 { gap: 20px; }
.sl-t4 .sl-tv { font-size: 64px; }
.sl-t4 .sl-tv small { font-size: 24px; }
.sl-t4 .sl-ts { min-height: 24px; font-size: 16px; }
.sl-t4 .sl-tile { padding: 16px 20px 12px; }
.sl-chart { display: flex; align-items: center; justify-content: center; gap: 56px; margin-top: 18px; }
.sl-donut-w { width: 270px; height: 270px; position: relative; flex: none; }
.sl-donut { position: absolute; inset: 0; border-radius: 50%; -webkit-mask: conic-gradient(#000 var(--sw), transparent 0); mask: conic-gradient(#000 var(--sw), transparent 0); }
.sl-donut::after { content: ''; position: absolute; inset: 62px; background: var(--hole, #fff); border-radius: 50%; }
.sl-dc { position: absolute; inset: 0; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.sl-dc b { font-size: 52px; color: #1b4a6b; }
.sl-dc small { font-size: 18px; color: #6a6e75; }
.sl-leg { list-style: none; margin: 0; padding: 0; min-width: 380px; }
.sl-leg li { display: flex; align-items: center; gap: 12px; font-size: 26px; padding: 7px 0; border-bottom: 1px solid #e8e6df; }
.sl-leg li i { width: 22px; height: 22px; border-radius: 4px; flex: none; }
.sl-leg li span { flex: 1; }
.sl-leg li b { font-variant-numeric: tabular-nums; }
.sl-leg li em { font-style: normal; width: 76px; text-align: right; color: #6a6e75; font-size: 22px; }
.sl-leg.sl-big li { font-size: 28px; }
.sl-leg.sl-big li b { color: #1b4a6b; }
.sl-pts { margin: 16px 0 0; padding-left: 24px; font-size: 21px; color: #3a3e45; }
.sl-pts li { margin-bottom: 8px; }
.sl-groups { column-count: 2; column-gap: 40px; }
.sl-g { break-inside: avoid; margin-bottom: 14px; }
.sl-g h4 { margin: 0 0 6px; font-size: 22px; color: #1b4a6b; }
.sl-g h4 small { font-size: 16px; color: #6a6e75; font-weight: 400; }
.sl-g .sl-chips span { font-size: 17px; padding: 3px 12px; }
.sl-two .sl-chart { flex-direction: column; gap: 14px; margin-top: 4px; }
.sl-two .sl-donut-w { width: 220px; height: 220px; }
.sl-two .sl-donut::after { inset: 50px; }
.sl-two .sl-dc b { font-size: 42px; }
.sl-two .sl-leg { min-width: 0; width: 100%; }
.sl-two .sl-leg li { font-size: 21px; padding: 4px 0; }
.sl-two .sl-bl { width: 170px; font-size: 21px; }
.sl-43 .sl-t4 { gap: 12px; }
.sl-43 .sl-t4 .sl-tv { font-size: 46px; }
.sl-43 .sl-t4 .sl-tv small { font-size: 18px; }
.sl-43 .sl-t4 .sl-tl { font-size: 22px; }
.sl-43 .sl-t4 .sl-tile { padding: 14px 12px 10px; }
.sl-43 .sl-t4 .sl-ts { font-size: 13px; }
.sl-43 .sl-chart { gap: 28px; }
.sl-43 .sl-leg { min-width: 300px; }
.sl-43 .sl-leg li { font-size: 22px; }
.sl-43 .sl-donut-w { width: 230px; height: 230px; }
.sl-43 .sl-donut::after { inset: 52px; }
.sl-43 .sl-two .sl-donut-w { width: 190px; height: 190px; }
.sl-43 .sl-two .sl-donut::after { inset: 44px; }
.sl-43 .sl-groups { column-gap: 24px; }
.sl-43 .sl-leg.sl-big li { font-size: 22px; }
.sl-43 .sl-pts { font-size: 18px; }

.sl-ex.tight { gap: 8px; }
.sl-ex.tight .sl-exr { padding: 8px 20px; font-size: 19px; line-height: 1.3; }
.sl-ex.tight .sl-exr b { font-size: 21px; width: 140px; }
.sl-ex.tight + .sl-note { margin-top: 10px; }
.sl-43 .sl-ex.tight .sl-exr { font-size: 17px; padding: 7px 14px; }
.sl-43 .sl-ex.tight .sl-exr b { font-size: 19px; width: 110px; }

/* ---------- 7 主な就職先（大きく）・9 主な進学先（大学を大きく）・10 総まとめ ---------- */
.sl-lead { font-size: 26px; color: #3a3e45; margin: 0 0 12px; }
.sl-lead b { font-size: 60px; line-height: 1; color: #e08a1e; margin: 0 4px; }
.sl-groups .sl-g h4 { font-size: 24px; }
.sl-groups .sl-chips span { background: #1b4a6b; color: #fff; font-weight: 700; }
.sl-groups .sl-chips span.more { background: #e8e6df; color: #6a6e75; font-weight: 400; }
.sl-groups.sl-lv1 .sl-chips span { font-size: 30px; padding: 8px 24px; }
.sl-groups.sl-lv1 .sl-g h4 { font-size: 26px; }
.sl-groups.sl-lv2 .sl-chips span { font-size: 22px; padding: 5px 16px; }
.sl-groups.sl-lv3 .sl-chips span { font-size: 17px; padding: 2px 10px; }
.sl-groups.sl-lv3 { column-gap: 28px; }
.sl-groups.sl-lv3 .sl-g { margin-bottom: 6px; }
.sl-groups.sl-lv3 .sl-g h4 { margin-bottom: 4px; }
.sl-groups.sl-lv3 .sl-g h4 { font-size: 19px; }
.sl-edu { display: flex; gap: 36px; }
.sl-edu-big { flex: 1.8; min-width: 0; }
.sl-edu-side { flex: 1; min-width: 0; }
.sl-edu h3 { font-size: 36px; margin: 0 0 14px; color: #1b4a6b; }
.sl-edu h3 b { font-size: 60px; color: #2e7d4f; line-height: 1; }
.sl-edu h3 small { font-size: 24px; color: #6a6e75; font-weight: 400; }
.sl-edu h4 { font-size: 21px; margin: 0 0 8px; color: #1b4a6b; }
.sl-edu h4 + .sl-chips { margin-bottom: 18px; }
.sl-edu h4 small { font-size: 16px; color: #6a6e75; font-weight: 400; }
.sl-edu-big .sl-chips span { background: #2e7d4f; color: #fff; font-weight: 700; }
.sl-edu-big .sl-chips span.more { background: #e8e6df; color: #6a6e75; font-weight: 400; }
.sl-edu-big.sl-lv1 .sl-chips span { font-size: 32px; padding: 8px 26px; }
.sl-edu-big.sl-lv2 .sl-chips span { font-size: 25px; padding: 6px 20px; }
.sl-edu-big.sl-lv3 .sl-chips span { font-size: 21px; padding: 4px 15px; }
.sl-edu-side .sl-chips span { font-size: 15px; padding: 3px 11px; background: #eef1f4; color: #3a3e45; }
.sl-dim { color: #8a8576; margin: 0 0 14px; }
/* 10 総まとめ（濃い背景） */
.sl.sl-dark { --hole: #16384f; background: radial-gradient(circle at 15% 20%, #2a6f9e 0%, #1b4a6b 35%, #0f2a3f 100%); color: #fff; }
.sl-dark .sl-h { border-bottom-color: #e08a1e; }
.sl-dark .sl-h h2 { color: #fff; }
.sl-dark .sl-f { color: #a9b8c6; }
.sl-dark .sl-dc b { color: #fff; }
.sl-dark .sl-dc small { color: #c9d3dc; }
.sl-sum { display: flex; flex-direction: column; gap: 18px; height: 100%; }
.sl-sum-top { display: flex; gap: 40px; align-items: center; }
.sl-sum-ring { display: flex; flex-direction: column; align-items: center; gap: 10px; flex: none; }
.sl-sum-ring .sl-donut-w { width: 230px; height: 230px; }
.sl-sum-ring .sl-donut::after { inset: 52px; }
.sl-sum-ring .sl-dc b { font-size: 50px; }
.sl-rleg { display: flex; gap: 14px; font-size: 18px; color: #dfe8ef; }
.sl-st4 { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.sl-st4 > div { background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.22); border-radius: 14px; padding: 12px 20px 10px; }
.sl-st4 em { display: block; font-style: normal; font-size: 18px; color: #c9d3dc; }
.sl-sv { display: block; line-height: 1.1; }
.sl-sv b { font-size: 54px; color: #ffc65a; font-variant-numeric: tabular-nums; }
.sl-sv small { font-size: 22px; color: #ffc65a; margin-left: 4px; }
.sl-st4 u { text-decoration: none; font-size: 15px; color: #a9b8c6; }
.sl-pills { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.sl-pills span { background: #e08a1e; color: #fff; font-weight: 700; font-size: 20px; border-radius: 999px; padding: 6px 22px; }
.sl-msgs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.sl-m { background: rgba(255,255,255,.08); border-top: 4px solid #e08a1e; border-radius: 6px; padding: 10px 16px 12px; }
.sl-m i { display: block; font-style: normal; font-size: 34px; font-weight: 700; color: #e08a1e; line-height: 1.1; }
.sl-m p { margin: 4px 0 0; font-size: 18px; line-height: 1.45; }
.sl-43 .sl-lead { font-size: 22px; }
.sl-43 .sl-lead b { font-size: 48px; }
.sl-43 .sl-groups.sl-lv1 .sl-chips span { font-size: 24px; padding: 6px 18px; }
.sl-43 .sl-groups.sl-lv2 .sl-chips span { font-size: 20px; padding: 5px 14px; }
.sl-43 .sl-groups.sl-lv3 .sl-chips span { font-size: 15px; padding: 2px 9px; }
.sl-43 .sl-edu { flex-direction: column; gap: 14px; }
.sl-43 .sl-edu h3 { font-size: 30px; margin-bottom: 8px; }
.sl-43 .sl-edu h3 b { font-size: 48px; }
.sl-43 .sl-edu-big.sl-lv1 .sl-chips span { font-size: 26px; padding: 6px 20px; }
.sl-43 .sl-edu-big.sl-lv2 .sl-chips span { font-size: 21px; padding: 5px 15px; }
.sl-43 .sl-edu-big.sl-lv3 .sl-chips span { font-size: 18px; padding: 3px 12px; }
.sl-43 .sl-edu-side .sl-chips span { font-size: 14px; }
.sl-43 .sl-sum-top { gap: 20px; }
.sl-43 .sl-sum-ring .sl-donut-w { width: 190px; height: 190px; }
.sl-43 .sl-sum-ring .sl-donut::after { inset: 44px; }
.sl-43 .sl-sv b { font-size: 40px; }
.sl-43 .sl-st4 > div { padding: 8px 14px; }
.sl-43 .sl-msgs { grid-template-columns: 1fr 1fr; }
.sl-43 .sl-m p { font-size: 16px; }
.sl-43 .sl-pills span { font-size: 16px; padding: 5px 16px; }
`;
(function () { const st = document.createElement('style'); st.id = 'slideCss'; st.textContent = SLIDE_CSS; document.head.appendChild(st); })();
