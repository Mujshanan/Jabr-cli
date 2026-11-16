# Build Jabr CLI for production on Windows.
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

foreach ($tool in @("node", "pnpm", "rustup", "wasm-pack")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required tool '$tool' was not found. See README.md for installation instructions."
    }
}

Write-Host "Installing JavaScript dependencies..."
Invoke-Checked "pnpm" @("install", "--frozen-lockfile")

Write-Host "Installing the WebAssembly Rust target..."
Invoke-Checked "rustup" @("target", "add", "wasm32-unknown-unknown")

Write-Host "Building Jabr CLI..."
Invoke-Checked "pnpm" @("run", "build")

Write-Host "Build completed successfully. Production files are in dist/."
