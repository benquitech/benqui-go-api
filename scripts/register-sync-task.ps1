# Crea (o actualiza) la tarea programada de Windows que sincroniza el catalogo todos los dias.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\register-sync-task.ps1 [-At 10:30]
# Borrarla: Unregister-ScheduledTask -TaskName "BenquiGo - Sync catalogo SEPA" -Confirm:$false
param([string]$At = '10:30')

$name = 'BenquiGo - Sync catalogo SEPA'
$script = Join-Path $PSScriptRoot 'sync-catalog-task.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`"" `
  -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -Daily -At $At
# StartWhenAvailable: si la PC estaba apagada o suspendida a esa hora, corre apenas se pueda.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RunOnlyIfNetworkAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Descarga los precios de SEPA y actualiza el catalogo de benqui-go-api. Log en logs\sync-*.log' -Force | Out-Null
Get-ScheduledTask -TaskName $name | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime
