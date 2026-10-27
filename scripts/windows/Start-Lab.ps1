[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')][string]$ProjectName = 'arquitectura-basada-mensajes-rabbitmq',
    [ValidateRange(1,65535)][int]$ApiPort = 3000,
    [ValidateRange(1,65535)][int]$ManagementPort = 15672,
    [ValidateRange(1,65535)][int]$AmqpPort = 5672,
    [ValidateRange(30,3600)][int]$WaitTimeout = 120
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$names = @('API_PORT', 'RABBITMQ_MANAGEMENT_PORT', 'RABBITMQ_AMQP_PORT')
$old = @{}
foreach ($name in $names) { $old[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
Push-Location (Join-Path $PSScriptRoot '../../rabbitmq')
try {
    $env:API_PORT = [string]$ApiPort
    $env:RABBITMQ_MANAGEMENT_PORT = [string]$ManagementPort
    $env:RABBITMQ_AMQP_PORT = [string]$AmqpPort
    $engine = & docker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0) { throw 'Docker no esta disponible. Inicie Docker Desktop.' }
    if (($engine -join '').Trim() -ne 'linux') { throw 'Seleccione Linux containers en Docker Desktop.' }
    $compose = @('compose', '--project-name', $ProjectName, '--file', 'docker-compose.yml')
    & docker @compose up -d --build --wait --wait-timeout $WaitTimeout
    if ($LASTEXITCODE -ne 0) { throw 'Compose up fallo; revise puertos y logs del proyecto.' }
    $ids = @(& docker @compose ps --status running -q)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar Compose.' }
    $workers = @(& docker @compose ps --status running -q notification-worker)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar los workers.' }
    if ($ids.Count -ne 4 -or $workers.Count -ne 2) { throw 'Se esperaban 4 contenedores activos y 2 workers.' }
    $ready = $false
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/health" -TimeoutSec 5
            if ($health.status -eq 'ready') { $ready = $true; break }
        } catch { Write-Verbose $_.Exception.Message }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'La API no respondio ready dentro del plazo.' }
    Write-Host "API: http://localhost:$ApiPort | Management: http://localhost:$ManagementPort (admin/admin; solo laboratorio)"
    Write-Host "Proyecto: $ProjectName. Use los mismos parametros al probar y apagar."
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process') }
    Pop-Location
}
