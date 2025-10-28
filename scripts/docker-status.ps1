# Docker Status Check Script
# Shows comprehensive status of all MiniWorld services

Write-Host "MiniWorld Docker Status" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green

$rootPath = Split-Path -Parent $PSScriptRoot
Set-Location $rootPath

Write-Host "`n[Services Status]" -ForegroundColor Yellow
docker-compose ps

Write-Host "`n[Health Checks]" -ForegroundColor Yellow
$services = @("postgres", "contracts", "backend", "game-client", "creator-dashboard")

foreach ($service in $services) {
    $health = docker inspect --format='{{.State.Health.Status}}' "miniworld-$service" 2>$null
    if ($health) {
        $color = if ($health -eq "healthy") { "Green" } else { "Red" }
        Write-Host "  $service : $health" -ForegroundColor $color
    } else {
        $running = docker inspect --format='{{.State.Running}}' "miniworld-$service" 2>$null
        if ($running -eq "true") {
            Write-Host "  $service : running (no health check)" -ForegroundColor Cyan
        } else {
            Write-Host "  $service : not running" -ForegroundColor Red
        }
    }
}

Write-Host "`n[Network Info]" -ForegroundColor Yellow
docker network inspect miniworld-network --format='{{range .Containers}}{{.Name}}: {{.IPv4Address}}{{println}}{{end}}' 2>$null

Write-Host "`n[Volume Usage]" -ForegroundColor Yellow
docker volume ls --filter name=miniworld

Write-Host "`n[Quick Actions]" -ForegroundColor Yellow
Write-Host "  View logs:       docker-compose logs -f [service]" -ForegroundColor Cyan
Write-Host "  Restart service: docker-compose restart [service]" -ForegroundColor Cyan
Write-Host "  Stop all:        .\scripts\docker-stop.ps1" -ForegroundColor Cyan
Write-Host "  Deploy contract: .\scripts\docker-deploy-contracts.ps1" -ForegroundColor Cyan

Write-Host "`n[Endpoints]" -ForegroundColor Yellow
$endpoints = @{
    "Game Client" = "http://localhost:3000"
    "Creator Dashboard" = "http://localhost:3001"
    "Backend API" = "http://localhost:4000/api"
    "Hardhat RPC" = "http://localhost:8545"
    "PostgreSQL" = "postgresql://postgres:postgres@localhost:5432/miniworld"
}

foreach ($name in $endpoints.Keys) {
    Write-Host "  ${name}: $($endpoints[$name])" -ForegroundColor Cyan
}