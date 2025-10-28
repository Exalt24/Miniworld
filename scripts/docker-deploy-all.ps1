# MiniWorld Complete Docker Deployment Script
# DEFAULT: Cleans all data for fresh deployment
# Usage: .\scripts\docker-deploy-all.ps1 [dev|prod] [-PreserveData]

param(
    [string]$Environment = "dev",
    [switch]$PreserveData = $false,
    [switch]$SkipBuild = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   MiniWorld Full Stack Deployment     " -ForegroundColor Cyan
Write-Host "   Environment: $($Environment.ToUpper().PadRight(24))" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$rootPath = Split-Path -Parent $PSScriptRoot
Set-Location $rootPath

# Validation
if ($Environment -ne "dev" -and $Environment -ne "prod") {
    Write-Host "`nERROR: Invalid environment '$Environment'" -ForegroundColor Red
    Write-Host "Usage: .\scripts\docker-deploy-all.ps1 [dev|prod] [-PreserveData]" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# STEP 1: Stop and Clean Previous Deployment
# ============================================================================
if ($PreserveData) {
    Write-Host "`n[1/9] Stopping services (preserving data)..." -ForegroundColor Yellow
    docker-compose down 2>&1 | Out-Null
    Write-Host "SUCCESS: Services stopped, data preserved" -ForegroundColor Green
} else {
    Write-Host "`n[1/9] Cleaning previous deployment..." -ForegroundColor Yellow
    Write-Host "  Removing containers, networks, and volumes..." -ForegroundColor Gray
    docker-compose down -v 2>&1 | Out-Null
    Write-Host "SUCCESS: Full cleanup completed" -ForegroundColor Green
}

# ============================================================================
# STEP 2: Start Core Services (PostgreSQL + Hardhat)
# ============================================================================
Write-Host "`n[2/9] Starting core services..." -ForegroundColor Yellow

if ($Environment -eq "dev") {
    docker-compose up -d postgres contracts
} else {
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres contracts
}

Write-Host "SUCCESS: Core services starting" -ForegroundColor Green

# ============================================================================
# STEP 3: Wait for Services to be Healthy
# ============================================================================
Write-Host "`n[3/9] Waiting for services to be healthy..." -ForegroundColor Yellow

$maxWait = 120  # 2 minutes
$waited = 0
$pgHealthy = $false
$hardhatHealthy = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 5
    $waited += 5
    
    # Check PostgreSQL health
    if (-not $pgHealthy) {
        $pgHealth = docker inspect --format='{{.State.Health.Status}}' miniworld-postgres 2>$null
        if ($pgHealth -eq "healthy") {
            $pgHealthy = $true
            Write-Host "  SUCCESS: PostgreSQL is healthy" -ForegroundColor Green
        }
    }
    
    # Check Hardhat RPC (not health check - it's a persistent process)
    if (-not $hardhatHealthy) {
        try {
            $rpcTest = Invoke-RestMethod -Uri "http://localhost:8545" -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($rpcTest.result) {
                $hardhatHealthy = $true
                Write-Host "  SUCCESS: Hardhat RPC is responding" -ForegroundColor Green
            }
        } catch {
            # Still waiting
        }
    }
    
    if ($pgHealthy -and $hardhatHealthy) {
        break
    }
    
    $pgStatus = if ($pgHealthy) { "healthy" } else { "waiting" }
    $hardhatStatus = if ($hardhatHealthy) { "ready" } else { "waiting" }
    Write-Host "  Waiting... $waited/$maxWait seconds (PostgreSQL: $pgStatus, Hardhat: $hardhatStatus)" -ForegroundColor Gray
}

if (-not $pgHealthy -or -not $hardhatHealthy) {
    Write-Host "`nERROR: Services failed to become healthy after $maxWait seconds" -ForegroundColor Red
    Write-Host "PostgreSQL: $(if ($pgHealthy) { 'OK' } else { 'FAILED' })" -ForegroundColor $(if ($pgHealthy) { 'Green' } else { 'Red' })
    Write-Host "Hardhat RPC: $(if ($hardhatHealthy) { 'OK' } else { 'FAILED' })" -ForegroundColor $(if ($hardhatHealthy) { 'Green' } else { 'Red' })
    Write-Host "`nCheck logs with: docker-compose logs postgres contracts" -ForegroundColor Yellow
    exit 1
}

Write-Host "SUCCESS: All core services healthy!" -ForegroundColor Green

# ============================================================================
# STEP 4: Verify Database Connection
# ============================================================================
Write-Host "`n[4/9] Verifying database..." -ForegroundColor Yellow

Start-Sleep -Seconds 2

$dbReady = $false
$attempts = 0

while (-not $dbReady -and $attempts -lt 10) {
    $attempts++
    $dbCheck = docker-compose exec -T postgres psql -U postgres -d miniworld -c "SELECT 1;" 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        $dbReady = $true
        Write-Host "SUCCESS: Database is ready and accepting connections" -ForegroundColor Green
        Write-Host "  Note: Migrations will run automatically when backend starts" -ForegroundColor Gray
        break
    } else {
        Write-Host "  Waiting for database... attempt $attempts/10" -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $dbReady) {
    Write-Host "ERROR: Database connection failed after $attempts attempts" -ForegroundColor Red
    Write-Host "Check logs: docker-compose logs postgres" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# STEP 5: Deploy Smart Contracts
# ============================================================================
Write-Host "`n[5/9] Deploying smart contracts..." -ForegroundColor Yellow

$deployOutput = docker-compose exec -T contracts npx hardhat ignition deploy ignition/modules/MiniWorld.ts --network localhost 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Contract deployment failed!" -ForegroundColor Red
    Write-Host $deployOutput
    Write-Host "`nTry: docker-compose logs contracts" -ForegroundColor Yellow
    exit 1
}

Write-Host "SUCCESS: Contracts deployed successfully" -ForegroundColor Green

# ============================================================================
# STEP 6: Extract Contract Address
# ============================================================================
Write-Host "`n[6/9] Extracting contract address..." -ForegroundColor Yellow

try {
    $contractJson = docker-compose exec -T contracts cat ignition/deployments/chain-31337/deployed_addresses.json 2>&1 | ConvertFrom-Json
    $contractAddress = $contractJson.'MiniWorldModule#MiniWorld'
    
    if (-not $contractAddress) {
        throw "Contract address not found in deployment file"
    }
    
    Write-Host "SUCCESS: Contract Address: $contractAddress" -ForegroundColor Green
} catch {
    Write-Host "`nERROR: Could not extract contract address!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# ============================================================================
# STEP 6.5: Verify Contract Artifacts Exist (CRITICAL FOR BUILDS)
# ============================================================================
Write-Host "`n[6.5/9] Verifying contract artifacts..." -ForegroundColor Yellow

$artifactPath = "contracts/artifacts/contracts/MiniWorld.sol/MiniWorld.json"
$artifactDir = "contracts/artifacts/contracts/MiniWorld.sol"

if (-not (Test-Path $artifactPath)) {
    Write-Host "`nWARNING: Contract ABI not found at expected location!" -ForegroundColor Yellow
    Write-Host "   Expected: $artifactPath" -ForegroundColor Gray
    Write-Host "`n   Attempting to copy from contracts container..." -ForegroundColor Cyan
    
    # Ensure directory exists
    if (-not (Test-Path $artifactDir)) {
        New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
    }
    
    # Try to copy from container
    Write-Host "   Running: docker cp miniworld-contracts:/app/artifacts/..." -ForegroundColor Gray
    $copyResult = docker cp "miniworld-contracts:/app/artifacts/contracts/MiniWorld.sol/MiniWorld.json" $artifactPath 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: Could not copy ABI from container!" -ForegroundColor Red
        Write-Host "Container output: $copyResult" -ForegroundColor Gray
        Write-Host "`nThis means contract deployment may have failed." -ForegroundColor Red
        Write-Host "Check deployment logs: docker-compose logs contracts" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "   SUCCESS: Copied ABI from contracts container" -ForegroundColor Green
}

# Verify ABI file is valid JSON and has content
try {
    $abiContent = Get-Content $artifactPath -Raw | ConvertFrom-Json
    
    if (-not $abiContent.abi) {
        throw "ABI property not found in artifact"
    }
    
    $abiLength = $abiContent.abi.Count
    
    if ($abiLength -eq 0) {
        throw "ABI is empty"
    }
    
    Write-Host "SUCCESS: Contract ABI verified: $abiLength functions/events" -ForegroundColor Green
    Write-Host "  Location: $artifactPath" -ForegroundColor Gray
    
} catch {
    Write-Host "`nERROR: ABI file is invalid!" -ForegroundColor Red
    Write-Host "  File exists but content is corrupt or malformed" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Gray
    Write-Host "`nDelete the file and try deployment again:" -ForegroundColor Yellow
    Write-Host "  Remove-Item '$artifactPath' -Force" -ForegroundColor Cyan
    exit 1
}

Write-Host "`nNOTE: This ABI will be:" -ForegroundColor Cyan
Write-Host "   - Copied into backend Docker image" -ForegroundColor Gray
Write-Host "   - Used by SDK prebuild to generate contractABI.ts" -ForegroundColor Gray
Write-Host "   - Bundled into frontend JavaScript" -ForegroundColor Gray

# ============================================================================
# STEP 7: Update Environment Files
# ============================================================================
Write-Host "`n[7/9] Updating environment files..." -ForegroundColor Yellow

$envFiles = @(
    ".env",
    "backend/.env",
    "game-client/.env",
    "creator-dashboard/.env"
)

foreach ($envFile in $envFiles) {
    if (Test-Path $envFile) {
        $content = Get-Content $envFile -Raw
        $content = $content -replace 'CONTRACT_ADDRESS=.*', "CONTRACT_ADDRESS=$contractAddress"
        Set-Content $envFile $content -NoNewline
        Write-Host "  SUCCESS: Updated: $envFile" -ForegroundColor Cyan
    } else {
        Write-Host "  WARNING: Not found: $envFile (will use defaults)" -ForegroundColor Yellow
    }
}

# Export for docker-compose to use
$env:CONTRACT_ADDRESS = $contractAddress
$env:VITE_CONTRACT_ADDRESS = $contractAddress

Write-Host "SUCCESS: All environment files updated" -ForegroundColor Green

# ============================================================================
# STEP 8: Build and Start All Services
# ============================================================================
Write-Host "`n[8/9] Building and starting all services..." -ForegroundColor Yellow

if (-not $SkipBuild) {
    Write-Host "  Building backend..." -ForegroundColor Cyan
    docker-compose build backend
    
    Write-Host "  Building game-client (with contract address)..." -ForegroundColor Cyan
    docker-compose build --no-cache game-client
    
    Write-Host "  Building creator-dashboard (with contract address)..." -ForegroundColor Cyan
    docker-compose build --no-cache creator-dashboard
    
    Write-Host "SUCCESS: All services built" -ForegroundColor Green
} else {
    Write-Host "WARNING: Skipping build (--SkipBuild flag)" -ForegroundColor Yellow
}

Write-Host "  Starting all services..." -ForegroundColor Cyan

if ($Environment -eq "dev") {
    docker-compose up -d
} else {
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
}

Write-Host "SUCCESS: All services started" -ForegroundColor Green

# ============================================================================
# STEP 9: Validate Deployment
# ============================================================================
Write-Host "`n[9/9] Validating deployment..." -ForegroundColor Yellow

Start-Sleep -Seconds 10  # Give services time to initialize

$validationPassed = $true

# Check PostgreSQL
try {
    $pgCheck = docker-compose exec -T postgres pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  SUCCESS: PostgreSQL: Healthy" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: PostgreSQL: Not ready" -ForegroundColor Red
        $validationPassed = $false
    }
} catch {
    Write-Host "  ERROR: PostgreSQL: Failed to check" -ForegroundColor Red
    $validationPassed = $false
}

# Check Backend API
try {
    $apiResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/health" -TimeoutSec 5 -ErrorAction Stop
    if ($apiResponse.status -eq "healthy") {
        Write-Host "  SUCCESS: Backend API: Healthy" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Backend API: Unhealthy response" -ForegroundColor Red
        $validationPassed = $false
    }
} catch {
    Write-Host "  ERROR: Backend API: Not responding (may still be initializing)" -ForegroundColor Yellow
    Write-Host "     Wait 30 seconds and check: http://localhost:4000/api/health" -ForegroundColor Gray
}

# Check World State
try {
    $worldResponse = Invoke-RestMethod -Uri "http://localhost:4000/api/world" -TimeoutSec 5 -ErrorAction Stop
    if ($worldResponse.tiles -and $worldResponse.tiles.Count -eq 100) {
        Write-Host "  SUCCESS: World State: 100 tiles initialized" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: World State: Unexpected tile count" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  WARNING: World State: Backend still initializing database" -ForegroundColor Yellow
}

# Check Game Client
try {
    $gameResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -ErrorAction Stop
    if ($gameResponse.StatusCode -eq 200) {
        Write-Host "  SUCCESS: Game Client: Accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "  ERROR: Game Client: Not accessible" -ForegroundColor Red
    $validationPassed = $false
}

# Check Creator Dashboard
try {
    $dashResponse = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5 -ErrorAction Stop
    if ($dashResponse.StatusCode -eq 200) {
        Write-Host "  SUCCESS: Creator Dashboard: Accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "  ERROR: Creator Dashboard: Not accessible" -ForegroundColor Red
    $validationPassed = $false
}

# ============================================================================
# Final Status
# ============================================================================
Write-Host "`n" -NoNewline
if ($validationPassed) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "     DEPLOYMENT SUCCESSFUL!             " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "   DEPLOYMENT COMPLETED WITH WARNINGS   " -ForegroundColor Yellow
    Write-Host "   CHECK LOGS                           " -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
}

Write-Host "`nService Information:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Gray

Write-Host "`nPlayer Applications:" -ForegroundColor Yellow
Write-Host "   Game Client:        http://localhost:3000" -ForegroundColor White
Write-Host "   Creator Dashboard:  http://localhost:3001" -ForegroundColor White

Write-Host "`nBackend Services:" -ForegroundColor Yellow
Write-Host "   API Endpoint:       http://localhost:4000/api" -ForegroundColor White
Write-Host "   Health Check:       http://localhost:4000/api/health" -ForegroundColor White
Write-Host "   WebSocket:          ws://localhost:4000" -ForegroundColor White

Write-Host "`nBlockchain:" -ForegroundColor Yellow
Write-Host "   Hardhat RPC:        http://localhost:8545" -ForegroundColor White
Write-Host "   Contract Address:   $contractAddress" -ForegroundColor White
Write-Host "   Chain ID:           31337" -ForegroundColor White

Write-Host "`nDatabase:" -ForegroundColor Yellow
Write-Host "   PostgreSQL:         localhost:5432" -ForegroundColor White
Write-Host "   Database:           miniworld" -ForegroundColor White
Write-Host "   Status:             Fresh database initialized" -ForegroundColor White

Write-Host "`n========================================" -ForegroundColor Gray

Write-Host "`nUseful Commands:" -ForegroundColor Cyan
Write-Host "   View logs:          docker-compose logs -f" -ForegroundColor Gray
Write-Host "   View backend logs:  docker-compose logs -f backend" -ForegroundColor Gray
Write-Host "   Check status:       docker-compose ps" -ForegroundColor Gray
Write-Host "   Stop services:      docker-compose down" -ForegroundColor Gray

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "   1. Open Game Client:        http://localhost:3000" -ForegroundColor White
Write-Host "   2. Connect MetaMask wallet" -ForegroundColor White
Write-Host "      - Network: Hardhat (Chain ID: 31337)" -ForegroundColor Gray
Write-Host "      - RPC URL: http://localhost:8545" -ForegroundColor Gray
Write-Host "   3. Import test account from Hardhat console" -ForegroundColor White
Write-Host "   4. Start playing! Claim tiles and place items" -ForegroundColor White

if (-not $validationPassed) {
    Write-Host "`nWARNING: Some services had issues. Check logs:" -ForegroundColor Yellow
    Write-Host "   docker-compose logs backend" -ForegroundColor Gray
}

if (-not $PreserveData) {
    Write-Host "`nTIP: Use -PreserveData flag to keep database between deployments" -ForegroundColor Cyan
}

Write-Host ""