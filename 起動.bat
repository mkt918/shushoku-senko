@echo off
rem Launcher: opens site\index.html in an app window (Edge, then Chrome, then the default browser).
rem Keep this file next to the "site" folder. Do not run it from inside a zip: extract first.
setlocal DisableDelayedExpansion
set "PAGE=%~dp0site\index.html"
if not exist "%PAGE%" goto nofile
set "URL=file:///%PAGE:\=/%"
if /i "%~1"=="test" goto test

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" goto runedge
set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" goto runedge
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto runchrome
set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto runchrome
set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto runchrome
goto rundefault

:runedge
start "" "%EDGE%" --app="%URL%"
exit /b 0

:runchrome
start "" "%CHROME%" --app="%URL%"
exit /b 0

:rundefault
start "" "%PAGE%"
exit /b 0

:test
echo "%URL%"
exit /b 0

:nofile
echo.
echo site\index.html was not found.
echo Extract the whole zip first, and keep this file next to the "site" folder.
echo Looked for: "%PAGE%"
echo.
pause
exit /b 1
