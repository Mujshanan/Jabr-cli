$ErrorActionPreference = "Stop"

foreach ($tool in @("node", "pnpm", "cargo", "wasm-pack")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Required tool '$tool' was not found. See README.md for installation instructions."
    }
}

Write-Host "Running Jabr verification (TypeScript, Rust, browser build, MCP server)..."
& pnpm run verify
if ($LASTEXITCODE -ne 0) {
    throw "Jabr verification failed with exit code $LASTEXITCODE."
}

Write-Host "All Jabr verification checks passed."
