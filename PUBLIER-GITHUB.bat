@echo off
setlocal
chcp 65001 >nul
call "%~dp0scripts\env.bat"
cd /d "%ROOT%"
echo Configuration : publication.json
echo.
node scripts\publish-configured.mjs %*
if errorlevel 1 (
  echo.
  echo [ECHEC] Publication interrompue. Corrigez le message ci-dessus puis relancez ce fichier.
  pause
  exit /b 1
)
echo.
echo [OK] Operation terminee.
pause
