@echo off
setlocal
call "%~dp0env.bat"
cd /d "%ROOT%"
node scripts\release.mjs %*
if errorlevel 1 ( echo Publication interrompue. & pause & exit /b 1 )
pause
