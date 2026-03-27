# PLECS Simulation Server Startup Script (PowerShell)
# Usage: Right-click -> Run with PowerShell, or:
#        .\start-plecs-server.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "PLECS Simulation Server Startup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check MATLAB
try {
    $matlabPath = Get-Command matlab -ErrorAction Stop
    Write-Host "[OK] MATLAB found: $($matlabPath.Source)" -ForegroundColor Green
} catch {
    Write-Host "[WARN] MATLAB not found in PATH" -ForegroundColor Yellow
    Write-Host "Please ensure MATLAB is installed" -ForegroundColor Yellow
}

# Check model file
if (Test-Path "SRC.plecs") {
    Write-Host "[OK] Model file found: SRC.plecs" -ForegroundColor Green
} else {
    Write-Host "[ERROR] SRC.plecs not found" -ForegroundColor Red
    Write-Host "Please copy your PLECS model to this directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Working directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "Server port: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Start server
node plecs-server.js
