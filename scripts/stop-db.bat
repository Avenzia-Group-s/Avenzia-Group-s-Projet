@echo off
call "%~dp0env.bat"
pg_ctl -D "%TOOLS%\pgdata" stop
