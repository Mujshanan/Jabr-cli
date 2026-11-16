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

$requiredTools = @("rustup", "wasm-pack")
if ($PackageManager -eq "bun") {
    $requiredTools += "bun"
} else {
    $requiredTools += @("node", "npm")
}

foreach ($tool in $requiredTools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required tool '$tool' was not found. See README.md for installation instructions."
    }
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
Write-Host "Building Jabr CLI with $PackageManager..."
Invoke-Checked $runner @("run", "build")
Write-Host "Build completed successfully. Production files are in dist/."
