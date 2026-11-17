# Sincroniza el catalogo con SEPA desde esta PC (el sitio de SEPA bloquea los servidores de GitHub).
# Lo ejecuta la tarea programada "BenquiGo - Sync catalogo SEPA" (ver scripts/register-sync-task.ps1).
# Deja un log por dia en logs/sync-AAAA-MM-DD.log y borra los de mas de 30 dias.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ("sync-{0:yyyy-MM-dd}.log" -f (Get-Date))

# La tarea programada no carga el PATH de la terminal: se agrega la carpeta de Node (nvm4w).
$env:Path = "C:\nvm4w\nodejs;$env:Path"
$env:NODE_OPTIONS = '--max-old-space-size=4096'
$env:SYNC_REPORT_TOP = '0'

Set-Location $root
"=== Inicio $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Append -Encoding utf8
& cmd.exe /c "npm run sync:catalog >> `"$log`" 2>&1"
$code = $LASTEXITCODE
"=== Fin $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (codigo $code) ===" | Out-File $log -Append -Encoding utf8

Get-ChildItem $logDir -Filter 'sync-*.log' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
exit $code
