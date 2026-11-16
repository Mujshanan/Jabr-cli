param(
    [ValidateSet("bun", "npm")]
    [string]$PackageManager = "bun"
)

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

$requiredTools = @("rustup", "cargo", "wasm-pack")
if ($PackageManager -eq "bun") {
    $requiredTools += "bun"
    $buildScript = "build:bun"
} else {
    $requiredTools += @("node", "npm")
    $buildScript = "build"
}

foreach ($tool in $requiredTools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required tool '$tool' was not found. See README.md for installation instructions."
    }
}

if (-not (Test-Path "engine/calcpad-core/Cargo.toml")) {
    throw "Vendored Jabr Calcpad core is missing from engine/calcpad-core."
}

if ($PackageManager -eq "bun") {
    Write-Host "Installing JavaScript dependencies with Bun..."
    Invoke-Checked "bun" @("install", "--frozen-lockfile")
    $runner = "bun"
} else {
    Write-Host "Installing JavaScript dependencies with npm..."
    Invoke-Checked "npm" @("ci")
    $runner = "npm"
}

Write-Host "Installing the WebAssembly Rust target..."
Invoke-Checked "rustup" @("target", "add", "wasm32-unknown-unknown")
Write-Host "Building the vendored Jabr Calcpad core, its WebAssembly bridge, Mathlex compatibility bridge, and Vite UI..."
Invoke-Checked $runner @("run", $buildScript)
Write-Host "Build completed successfully. Production files are in dist/."
