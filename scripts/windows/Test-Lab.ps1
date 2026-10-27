[CmdletBinding()]
param(
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')][string]$ProjectName = 'arquitectura-basada-mensajes-rabbitmq',
    [ValidateRange(1,65535)][int]$ApiPort = 3000,
    [ValidateRange(1,65535)][int]$ManagementPort = 15672,
    [ValidateRange(1,65535)][int]$AmqpPort = 5672
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$names = @('API_PORT', 'RABBITMQ_MANAGEMENT_PORT', 'RABBITMQ_AMQP_PORT', 'COMPOSE_PROJECT_NAME', 'API_URL', 'RABBITMQ_UI_URL')
$old = @{}
foreach ($name in $names) { $old[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
Push-Location (Join-Path $PSScriptRoot '../../rabbitmq')
try {
    $env:API_PORT = [string]$ApiPort
    $env:RABBITMQ_MANAGEMENT_PORT = [string]$ManagementPort
    $env:RABBITMQ_AMQP_PORT = [string]$AmqpPort
    $env:COMPOSE_PROJECT_NAME = $ProjectName
    $env:API_URL = "http://127.0.0.1:$ApiPort"
    $env:RABBITMQ_UI_URL = "http://127.0.0.1:$ManagementPort"
    $compose = @('compose', '--project-name', $ProjectName, '--file', 'docker-compose.yml')
    $binding = @(& docker @compose port orders-api 3000)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el puerto API del proyecto.' }
    if ($binding.Count -ne 1 -or $binding[0].Trim() -ne "127.0.0.1:$ApiPort") {
        throw 'ApiPort no coincide con el proyecto activo. Use los parametros de Start-Lab.'
    }
    $managementBinding = @(& docker @compose port rabbitmq 15672)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar el puerto Management.' }
    if ($managementBinding.Count -ne 1 -or $managementBinding[0].Trim() -ne "127.0.0.1:$ManagementPort") {
        throw 'ManagementPort no coincide con el proyecto activo.'
    }
    & node --version
    if ($LASTEXITCODE -ne 0) { throw 'Instale Node.js 24 para ejecutar el runner en Windows.' }
    Write-Warning 'Prueba exclusiva del laboratorio: detiene ambos workers, publica pedidos y reencola hasta 100 mensajes. No ejecutar en paralelo.'
    $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($null -eq $npmCommand) { $npmCommand = Get-Command npm -ErrorAction Stop }
    & $npmCommand.Source ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci fallo.' }
    & $npmCommand.Source test
    if ($LASTEXITCODE -ne 0) { throw 'Las pruebas de integracion fallaron.' }
    Write-Host 'Runner terminado: revise que ambos tests pasaron (positivo y cantidad cero). No equivale a los diez casos formales.'
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $old[$name], 'Process') }
    Pop-Location
}
