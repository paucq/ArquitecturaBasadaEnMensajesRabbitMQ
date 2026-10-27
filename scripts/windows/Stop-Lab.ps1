[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')][string]$ProjectName = 'arquitectura-basada-mensajes-rabbitmq',
    [ValidateRange(1,65535)][int]$ApiPort = 3000,
    [ValidateRange(1,65535)][int]$ManagementPort = 15672,
    [ValidateRange(1,65535)][int]$AmqpPort = 5672
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
    $compose = @('compose', '--project-name', $ProjectName, '--file', 'docker-compose.yml')
    & docker @compose down
    if ($LASTEXITCODE -ne 0) { throw 'Compose down fallo.' }
    Write-Host "Proyecto $ProjectName apagado. Volumen conservado; no se uso -v."
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process') }
    Pop-Location
}
