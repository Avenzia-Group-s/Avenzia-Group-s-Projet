@echo off
rem Active la toolchain 100% locale (dossier .tools du projet). Utilisé par tous les .bat.
set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
set "TOOLS=%ROOT%\.tools"
set "CARGO_HOME=%TOOLS%\cargo"
set "RUSTUP_HOME=%TOOLS%\rustup"
set "npm_config_cache=%TOOLS%\npm-cache"
set "PATH=%TOOLS%\node;%CARGO_HOME%\bin;%TOOLS%\pgsql\bin;%PATH%"
