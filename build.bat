@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found. Install Node.js 20.19+ or 22.12+.
    exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
    echo ERROR: pnpm was not found. Enable Corepack and activate pnpm 10.34.5.
    exit /b 1
)

where rustup >nul 2>nul
if errorlevel 1 (
    echo ERROR: rustup was not found. Install the Rust toolchain.
    exit /b 1
)

where wasm-pack >nul 2>nul
if errorlevel 1 (
    echo ERROR: wasm-pack was not found. Install wasm-pack 0.15.1.
    exit /b 1
)

echo Installing JavaScript dependencies...
call pnpm install --frozen-lockfile
if errorlevel 1 exit /b %errorlevel%

echo Installing the WebAssembly Rust target...
call rustup target add wasm32-unknown-unknown
if errorlevel 1 exit /b %errorlevel%

echo Building Jabr CLI...
call pnpm run build
if errorlevel 1 exit /b %errorlevel%

echo Build completed successfully. Production files are in dist/.
exit /b 0
