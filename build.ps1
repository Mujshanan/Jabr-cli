$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')"
    }
}

$requiredTools = @("bun", "rustup", "cargo", "wasm-pack")
foreach ($tool in $requiredTools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required tool '$tool' was not found. See README.md for installation instructions."
    }
}

if (-not (Test-Path "engine/calcpad-core/Cargo.toml")) {
    throw "Vendored Jabr Calcpad core is missing from engine/calcpad-core."
}

Write-Host "Installing JavaScript dependencies with Bun..."
Invoke-Checked "bun" @("install", "--frozen-lockfile")

Write-Host "Installing the WebAssembly Rust target..."
Invoke-Checked "rustup" @("target", "add", "wasm32-unknown-unknown")
Write-Host "Building the vendored Jabr Calcpad core, its WebAssembly bridge, Mathlex compatibility bridge, and Vite UI..."
Invoke-Checked "bun" @("run", "build:bun")
Write-Host "Build completed successfully. Production files are in dist/."
