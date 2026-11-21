@echo off
setlocal
call "%~dp0env.bat"
cd /d "%ROOT%"
if not exist "%TOOLS%\node\node.exe" ( echo Lancez scripts\setup.bat. & pause & exit /b 1 )
if not exist node_modules ( echo Lancez scripts\setup.bat. & pause & exit /b 1 )
node scripts\doctor.mjs --config-only
if errorlevel 1 ( pause & exit /b 1 )
if not exist "%TOOLS%\pgdata\PG_VERSION" ( echo Lancez scripts\setup.bat pour initialiser PostgreSQL. & pause & exit /b 1 )
pg_ctl -D "%TOOLS%\pgdata" status >nul 2>&1
if errorlevel 1 (
  pg_ctl -D "%TOOLS%\pgdata" -o "-p 5433" -l "%TOOLS%\pg.log" start -w -t 60
  if errorlevel 1 ( echo Consultez .tools\pg.log. & pause & exit /b 1 )
)
start "Avenzia API" cmd /k "call scripts\env.bat && npm run dev:api"
start "Avenzia Bot" cmd /k "call scripts\env.bat && npm run dev:bot"
if /I "%~1"=="--services" exit /b 0
if /I "%~1"=="--web" (
  echo Interface navigateur disponible sur http://127.0.0.1:1420
  start "Avenzia Web" cmd /k "call scripts\env.bat && npm run dev:web"
  exit /b 0
)
start "Avenzia Desktop" cmd /k "call scripts\env.bat && npm run dev:desktop"
