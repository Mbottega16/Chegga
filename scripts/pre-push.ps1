<#
.SYNOPSIS
Chegga pre-push verification script for PowerShell.
Runs Vitest unit tests and TypeScript + Vite production build.
#>

[CmdletBinding()]
param(
    [switch]$RunSmoke,
    [switch]$Skip
)

$ErrorActionPreference = "Stop"

if ($Skip -or $env:CHEGGA_SKIP_PRE_PUSH -eq "1" -or $env:CHEGGA_SKIP_HOOKS -eq "1") {
    Write-Host "pre-push: skipped via skip flag or CHEGGA_SKIP_PRE_PUSH=1" -ForegroundColor Yellow
    exit 0
}

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    $repoRoot = Split-Path -Parent $PSScriptRoot
}
Set-Location $repoRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Chegga pre-push verification gate" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

Write-Host "--> Step 1/2: Running Vitest unit test suite (npm test)..." -ForegroundColor Cyan
& npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "pre-push: BLOCKED - Unit tests failed! Push aborted." -ForegroundColor Red
    Write-Host "          Run 'npm test' to inspect and fix failures." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "--> Step 2/2: Verifying typecheck and production build (npm run build)..." -ForegroundColor Cyan
& npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "pre-push: BLOCKED - Build/typecheck failed! Push aborted." -ForegroundColor Red
    Write-Host "          Run 'npm run build' to inspect and fix failures." -ForegroundColor Yellow
    exit 1
}

if ($RunSmoke -or $env:CHEGGA_RUN_SMOKE -eq "1" -or $env:CHEGGA_SMOKE -eq "1") {
    Write-Host ""
    Write-Host "--> Optional Step: Running Playwright desktop smoke tests..." -ForegroundColor Cyan
    & npx playwright test tests/e2e/smoke.spec.ts --project=desktop
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "pre-push: BLOCKED - Playwright smoke tests failed! Push aborted." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "pre-push: All checks passed cleanly. Proceeding with push." -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
exit 0
