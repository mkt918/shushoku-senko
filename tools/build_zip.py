"""配布用 zip を作る。

使い方（プロジェクト直下で）:
    python tools/build_zip.py

- 入れるもの：site/（プログラム）、起動.bat、はじめにお読みください.txt、docs/（設計書など）
- 入れないもの：旧 Excel/Word、.claude、tools、dist、データ（JSON）など
- 作る前に JS の構文と、index.html が読み込むファイルの存在を確かめる
- 出力：dist/就職選考統合管理_v{バージョン}.zip（フォルダ「就職選考統合管理」が1つ入る）
"""
import os, re, subprocess, sys, zipfile, shutil, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAME = '就職選考統合管理'
VERSION = re.search(r"version:\s*'([\d.]+)'", open(os.path.join(ROOT, 'site/js/core.js'), encoding='utf-8').read()).group(1)
OUT = os.path.join(ROOT, 'dist', f'{NAME}_v{VERSION}.zip')
README_SRC = os.path.join(ROOT, 'tools', 'readme_template.txt')

DOCS = ['パッチノート.md', '設計書.md', '00_設計プラン.md', 'CLAUDE.md']
BAD_EXT = {'.json', '.xlsx', '.xlsm', '.xls', '.docx', '.csv', '.log', '.pdf'}


def fail(msg):
    print('NG:', msg)
    sys.exit(1)


def check_site():
    site = os.path.join(ROOT, 'site')
    html = open(os.path.join(site, 'index.html'), encoding='utf-8').read()
    for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
        if ref.startswith(('http', '#')):
            fail(f'外部参照があります：{ref}')
        if not os.path.exists(os.path.join(site, ref)):
            fail(f'index.html が読み込むファイルがありません：{ref}')
    node = shutil.which('node')
    if node:
        for dp, _, fs in os.walk(os.path.join(site, 'js')):
            for f in fs:
                if f.endswith('.js'):
                    r = subprocess.run([node, '--check', os.path.join(dp, f)], capture_output=True, text=True)
                    if r.returncode:
                        fail(f'構文エラー {f}\n{r.stderr}')
    else:
        print('（node がないので構文チェックは省略）')
    # 部品以外のソースに外部通信がないこと
    for dp, _, fs in os.walk(os.path.join(site, 'js')):
        for f in fs:
            t = open(os.path.join(dp, f), encoding='utf-8').read()
            if re.search(r'''(fetch|XMLHttpRequest|WebSocket)\s*\(|https?://(?!www\.w3\.org)''', t):
                print('注意：外部通信らしき記述があります →', f)


def files():
    out = []
    site = os.path.join(ROOT, 'site')
    for dp, dn, fs in os.walk(site):
        dn[:] = [d for d in dn if not d.startswith('.')]
        for f in fs:
            full = os.path.join(dp, f)
            if os.path.splitext(f)[1].lower() in BAD_EXT:
                fail(f'配布に入れてはいけない種類のファイルがあります：{full}')
            out.append((full, os.path.relpath(full, ROOT).replace(os.sep, '/')))
    out.append((os.path.join(ROOT, '起動.bat'), '起動.bat'))
    for d in DOCS:
        out.append((os.path.join(ROOT, d), 'docs/' + d))
    return out


def main():
    check_site()
    date = datetime.date.today().isoformat()
    readme = open(README_SRC, encoding='utf-8').read().replace('{VERSION}', f'v{VERSION}（{date}）').replace('\r\n', '\n').replace('\n', '\r\n')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        os.remove(OUT)
    n = 0
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
        for src, arc in files():
            if not os.path.exists(src):
                fail(f'ファイルがありません：{src}')
            z.write(src, f'{NAME}/{arc}')
            n += 1
        z.writestr(f'{NAME}/はじめにお読みください.txt', '﻿' + readme)
        n += 1
    print(f'作成しました：{OUT}（{n} ファイル、{os.path.getsize(OUT) / 1024:.0f} KB）')


if __name__ == '__main__':
    main()
