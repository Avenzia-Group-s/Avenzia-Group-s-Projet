@echo off
setlocal
title Avenzia - Installation locale
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
if errorlevel 1 ( echo. & echo [ECHEC] L'installation a echoue. Lisez le message ci-dessus. & pause & exit /b 1 )
echo. & echo [OK] Installation terminee. & pause
