@echo off
setlocal
call "%~dp0env.bat"
cd /d "%ROOT%"
node scripts\configure-updates.mjs %*
if errorlevel 1 ( echo Configuration interrompue. & pause & exit /b 1 )
pause
