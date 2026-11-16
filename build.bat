@echo off
setlocal

where bun >nul 2>nul
if errorlevel 1 (
    echo ERROR: Bun was not found. Install Bun and reopen Command Prompt.
    exit /b 1
)
where rustup >nul 2>nul
if errorlevel 1 (
    echo ERROR: rustup was not found. Install the Rust toolchain.
    exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
    echo ERROR: cargo was not found. Install the Rust toolchain.
    exit /b 1
)
where wasm-pack >nul 2>nul
if errorlevel 1 (
    echo ERROR: wasm-pack was not found. Install wasm-pack 0.15.1.
    exit /b 1
)
if not exist "engine\calcpad-core\Cargo.toml" (
    echo ERROR: Vendored Jabr Calcpad core is missing from engine\calcpad-core.
    exit /b 1
)

echo Installing JavaScript dependencies with Bun...
call bun install --frozen-lockfile
if errorlevel 1 exit /b %errorlevel%

echo Installing the WebAssembly Rust target...
call rustup target add wasm32-unknown-unknown
if errorlevel 1 exit /b %errorlevel%

echo Building Jabr with Bun...
call bun run build:bun
if errorlevel 1 exit /b %errorlevel%
echo Build completed successfully. Production files are in dist/.
exit /b 0
