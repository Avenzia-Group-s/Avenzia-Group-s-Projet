# Installe TOUT dans le dossier du projet (.tools) : Node, Rust, PostgreSQL, dépendances, clé de signature.
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$NodeVersion = '22.11.0'
$PgVersion   = '16.4-1'   # binaires portables EDB ; vérifier la disponibilité de la version sur get.enterprisedb.com

$Root  = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Tools = Join-Path $Root '.tools'
New-Item -ItemType Directory -Force $Tools | Out-Null
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Fetch($url, $out) { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing }
function Rand($n = 32) { $b = New-Object byte[] ([int][Math]::Ceiling($n / 2)); $rng = [Security.Cryptography.RandomNumberGenerator]::Create(); try { $rng.GetBytes($b) } finally { $rng.Dispose() }; ([BitConverter]::ToString($b)).Replace('-', '').ToLowerInvariant().Substring(0, $n) }
function RandSecure($n = 24) { $b = New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b).Replace('+','A').Replace('/','B').Replace('=','') }

$env:CARGO_HOME = "$Tools\cargo"; $env:RUSTUP_HOME = "$Tools\rustup"; $env:npm_config_cache = "$Tools\npm-cache"
$env:PATH = "$Tools\node;$($env:CARGO_HOME)\bin;$Tools\pgsql\bin;$env:PATH"

# --- 0. Outils de compilation C++ (seule dépendance système : requise par Rust/Tauri sous Windows) ---
Step 'Vérification des outils Microsoft C++'
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasMsvc = (Test-Path $vswhere) -and (& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
if (-not $hasMsvc) {
  Write-Host 'Microsoft C++ Build Tools absents. Installation via winget (UAC requis)...' -ForegroundColor Yellow
  winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --accept-package-agreements --accept-source-agreements --override '--passive --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended'
  if ($LASTEXITCODE -ne 0) { throw 'Installez manuellement "Build Tools for Visual Studio 2022" (charge de travail Développement Desktop C++) puis relancez.' }
}

# --- 1. Node.js portable (hash SHA-256 vérifié) ---
if (-not (Test-Path "$Tools\node\node.exe")) {
  Step "Node.js $NodeVersion"
  $zip = "$Tools\node.zip"
  Fetch "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" $zip
  $sums = (Invoke-WebRequest "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt" -UseBasicParsing).Content
  $expected = (($sums -split "`n" | Where-Object { $_ -match "node-v$NodeVersion-win-x64\.zip" }) -split '\s+')[0]
  if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLower() -ne $expected.ToLower()) { Remove-Item $zip; throw 'Hash Node.js invalide : téléchargement corrompu ou altéré.' }
  Expand-Archive $zip $Tools -Force; Remove-Item $zip
  Rename-Item "$Tools\node-v$NodeVersion-win-x64" 'node'
}

# --- 2. Rust local (installeur vérifié par SHA-256 officiel) ---
if (-not (Test-Path "$($env:CARGO_HOME)\bin\cargo.exe")) {
  Step 'Rust (local)'
  $exe = "$Tools\rustup-init.exe"
  $rustupUrl = 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
  Fetch $rustupUrl $exe
  $checksumText = (Invoke-WebRequest -Uri "$rustupUrl.sha256" -UseBasicParsing).Content
  if ($checksumText -is [byte[]]) {
    $checksumText = [Text.Encoding]::UTF8.GetString($checksumText)
  }
  $expectedHash = (([string]$checksumText).Trim() -split '\s+')[0]
  if ($expectedHash -notmatch '^[a-fA-F0-9]{64}$') {
    Remove-Item -LiteralPath $exe
    throw 'Somme SHA-256 officielle de Rust illisible.'
  }
  if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash -ne $expectedHash) {
    Remove-Item -LiteralPath $exe
    throw 'SHA-256 de rustup-init incorrect : téléchargement corrompu ou altéré.'
  }
  & $exe -y --no-modify-path --profile minimal --default-toolchain stable --default-host x86_64-pc-windows-msvc
  if ($LASTEXITCODE -ne 0) { throw 'Installation de Rust échouée.' }
  Remove-Item $exe
}

# --- 3. Fichier .env.local (secrets générés localement) ---
$envFile = Join-Path $Root '.env.local'
if (-not (Test-Path $envFile) -and (Test-Path (Join-Path $Root '.env'))) {
  Copy-Item -LiteralPath (Join-Path $Root '.env') -Destination $envFile
}
if (-not (Test-Path $envFile)) {
  Step 'Création de .env.local'
  $repo = 'OWNER/REPO'
  try { $u = git -C $Root remote get-url origin 2>$null; if ($u -match 'github\.com[:/](.+?)(\.git)?$') { $repo = $Matches[1] } } catch {}
  $txt = Get-Content (Join-Path $Root '.env.example') -Raw
  $txt = $txt -replace 'CHANGE_ME', (RandSecure 18)
  $txt = $txt -replace '(?m)^INTERNAL_API_SECRET=.*$', "INTERNAL_API_SECRET=$(Rand 48)"
  $txt = $txt -replace '(?m)^TAURI_SIGNING_PRIVATE_KEY_PASSWORD=.*$', "TAURI_SIGNING_PRIVATE_KEY_PASSWORD=$(RandSecure 24)"
  $txt = $txt -replace '(?m)^GITHUB_REPO=.*$', "GITHUB_REPO=$repo"
  Set-Content $envFile $txt -Encoding UTF8
}
$vars = @{}
Get-Content $envFile -Encoding UTF8 | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)=(.*)$') {
    $name = $Matches[1]
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    $vars[$name] = $value
    Set-Item "env:$name" $value
  }
}
if ($vars['DATABASE_URL'] -match 'CHANGE_ME' -or -not $vars['DATABASE_URL']) {
  throw 'DATABASE_URL doit contenir le mot de passe PostgreSQL. Vérifiez .env.local.'
}
if ($vars['INTERNAL_API_SECRET'].Length -lt 32) {
  throw 'INTERNAL_API_SECRET doit contenir au moins 32 caractères.'
}

# --- 4. PostgreSQL portable ---
if (-not (Test-Path "$Tools\pgsql\bin\initdb.exe")) {
  Step "PostgreSQL $PgVersion (portable)"
  $zip = "$Tools\pg.zip"
  Fetch "https://get.enterprisedb.com/postgresql/postgresql-$PgVersion-windows-x64-binaries.zip" $zip
  Write-Host ("SHA-256 : " + (Get-FileHash $zip -Algorithm SHA256).Hash) -ForegroundColor DarkGray
  Expand-Archive $zip $Tools -Force; Remove-Item $zip
}
if (-not (Test-Path "$Tools\pgdata\PG_VERSION")) {
  Step 'Initialisation de la base'
  $pass = ($vars['DATABASE_URL'] -replace '^postgresql://avenzia:(.*)@localhost.*$', '$1')
  $pw = "$Tools\pw.tmp"; Set-Content $pw $pass -NoNewline
  try {
    initdb -D "$Tools\pgdata" -U avenzia -E UTF8 --auth=scram-sha-256 --pwfile=$pw
    if ($LASTEXITCODE -ne 0) { throw "Initialisation PostgreSQL échouée." }
  } finally { Remove-Item -LiteralPath $pw -ErrorAction SilentlyContinue }
}
Step 'Démarrage de PostgreSQL'
$pgStatus = Start-Process -FilePath "$Tools\pgsql\bin\pg_ctl.exe" -ArgumentList "-D `"$Tools\pgdata`" status" -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput "$Tools\pg-status.log" -RedirectStandardError "$Tools\pg-status-error.log"
if ($pgStatus.ExitCode -ne 0) {
  $pgStart = Start-Process -FilePath "$Tools\pgsql\bin\pg_ctl.exe" -ArgumentList "-D `"$Tools\pgdata`" -o `"-p 5433`" -l `"$Tools\pg.log`" start -w -t 45" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$Tools\pg-start.log" -RedirectStandardError "$Tools\pg-start-error.log"
  if (-not $pgStart.WaitForExit(50000)) { throw 'Délai de démarrage PostgreSQL dépassé.' }
  if ($pgStart.ExitCode -ne 0) { throw 'Démarrage de PostgreSQL échoué. Consultez .tools\pg.log et .tools\pg-start-error.log.' }
}
Step 'Création de la base avenzia'
$env:PGCONNECT_TIMEOUT = '10'
$env:PGPASSWORD = ($vars['DATABASE_URL'] -replace '^postgresql://avenzia:(.*)@localhost.*$', '$1')
$exists = psql -w -h localhost -p 5433 -U avenzia -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='avenzia'"
if ($LASTEXITCODE -ne 0) { throw 'Connexion à PostgreSQL échouée. Vérifiez DATABASE_URL dans .env.local.' }
if ($exists -ne '1') {
  createdb -w -h localhost -p 5433 -U avenzia avenzia
  if ($LASTEXITCODE -ne 0) { throw 'Création de la base avenzia échouée.' }
}

# --- 5. Dépendances (scripts d'installation désactivés par sécurité, puis étapes explicites) ---
Step 'Dépendances npm'
Set-Location $Root
if (Test-Path 'package-lock.json') { npm ci --ignore-scripts } else { npm install --ignore-scripts }
if ($LASTEXITCODE -ne 0) { throw 'npm a échoué.' }
npm run db:generate; if ($LASTEXITCODE -ne 0) { throw 'prisma generate a échoué.' }
npm run db:deploy; if ($LASTEXITCODE -ne 0) { throw 'Migration échouée.' }

# --- 6. Icônes + clé de signature des mises à jour ---
Set-Location "$Root\apps\desktop"
if (-not (Test-Path 'src-tauri\icons\icon.ico')) { Step 'Icônes'; npx tauri icon app-icon.png --output src-tauri/icons; if ($LASTEXITCODE -ne 0) { throw "Génération des icônes échouée." } }
$keyDir = Join-Path $Root '.keys'
if (-not (Test-Path "$keyDir\updater.key")) {
  Step 'Clé de signature des mises à jour'
  New-Item -ItemType Directory -Force $keyDir | Out-Null
  npx tauri signer generate -w "$keyDir\updater.key" -p $vars['TAURI_SIGNING_PRIVATE_KEY_PASSWORD'] --ci | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Génération de la clé de signature échouée.' }
  Write-Host 'SAUVEGARDEZ .keys\updater.key et le mot de passe (.env.local) : sans eux, plus aucune mise à jour possible.' -ForegroundColor Yellow
}
# Termine aussi la configuration après une installation interrompue.
$conf = "$Root\apps\desktop\src-tauri\tauri.conf.json"
$pub = (Get-Content "$keyDir\updater.key.pub" -Raw).Trim()
if (-not $pub) { throw 'Clé publique de signature vide.' }
$c = Get-Content $conf -Raw
$c = $c -replace '"pubkey":\s*"[^"]*"', ('"pubkey": "' + $pub + '"')
$c = $c -replace 'github\.com/[^/]+/[^/]+/releases', ('github.com/' + $vars['GITHUB_REPO'] + '/releases')
[IO.File]::WriteAllText($conf, $c, (New-Object Text.UTF8Encoding($false)))

Write-Host "`nProchaines étapes :" -ForegroundColor Green
Write-Host ' 1. Renseignez .env.local (Discord, GITHUB_TOKEN) - voir README.md'
Write-Host ' 2. scripts\start-dev.bat  pour développer  |  scripts\build.bat  pour compiler + publier'
