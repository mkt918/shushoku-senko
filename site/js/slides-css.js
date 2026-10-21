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
.sl-c1 { font-size: 34px; margin: 0 0 8px; }
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
#slideShow .sl[class*="play-"] :is(.sl-h h2, .sl-c1, .sl-c2, .sl-c3, .sl-total, .sl-br, .sl-exr, .sl-flow li, .sl-ask li, .sl-chips span, .sl-col, .sl-two h3, .sl-note, .sl-memo, .sl-empty) { animation: slUp .65s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(.2s + var(--i, 0) * .07s); }
#slideShow .sl[class*="play-"] .sl-cover h1, #slideShow .sl-cover[class*="play-"] h1 { animation: slUp .9s cubic-bezier(.2,.7,.2,1) both; animation-delay: .1s; }
#slideShow .sl[class*="play-"] .sl-tile { animation: slPop .7s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc(.2s + var(--i, 0) * .18s); }
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
`;
(function () { const st = document.createElement('style'); st.id = 'slideCss'; st.textContent = SLIDE_CSS; document.head.appendChild(st); })();
