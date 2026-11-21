@echo off
setlocal
title Avenzia - Build et publication
call "%~dp0env.bat"
cd /d "%ROOT%"
rem Options : --no-bump  --no-release  --no-git
node scripts\build.mjs %*
if errorlevel 1 ( echo. & echo [ECHEC] Build interrompu : rien n'a ete publie. & pause & exit /b 1 )
echo. & echo [OK] Termine. & pause
