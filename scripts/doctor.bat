@echo off
setlocal
call "%~dp0env.bat"
cd /d "%ROOT%"
node scripts\doctor.mjs
pause
