$ErrorActionPreference = "Stop"

Write-Host "Deedz Engine clean dependency install" -ForegroundColor Cyan
Write-Host "Project: $PSScriptRoot"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install Node.js 20.19 or newer, then reopen PowerShell."
}

$nodeVersion = node --version
$npmVersion = npm --version
Write-Host "Node $nodeVersion | npm $npmVersion"

$publicRegistry = "https://registry.npmjs.org/"
npm config set registry $publicRegistry --location=project

$nodeModules = Join-Path $PSScriptRoot "node_modules"
if (Test-Path $nodeModules) {
    Write-Host "Removing the existing node_modules folder..." -ForegroundColor Yellow
    try {
        Remove-Item $nodeModules -Recurse -Force -ErrorAction Stop
    }
    catch {
        cmd /c "rmdir /s /q node_modules"
    }
}

if (Test-Path $nodeModules) {
    throw "Windows still has files locked in node_modules. Close running Node/Vite terminals and editors, then run this script again."
}

npm cache verify
npm ping
npm ci --no-audit --no-fund

Write-Host "Dependencies installed successfully." -ForegroundColor Green
Write-Host "Next command: npm run validate"
Write-Host "Then start development with: npm run dev"
