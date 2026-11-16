@echo off
setlocal

set "PACKAGE_MANAGER=%~1"
if "%PACKAGE_MANAGER%"=="" set "PACKAGE_MANAGER=bun"

if /I "%PACKAGE_MANAGER%"=="bun" goto use_bun
if /I "%PACKAGE_MANAGER%"=="npm" goto use_npm

echo ERROR: Unknown package manager "%PACKAGE_MANAGER%".
echo Usage: build.bat [bun^|npm]
exit /b 2

:use_bun
where bun >nul 2>nul
if errorlevel 1 (
    echo ERROR: Bun was not found. Install Bun and reopen Command Prompt.
    exit /b 1
)
set "RUNNER=bun"
set "BUILD_SCRIPT=build:bun"
echo Installing JavaScript dependencies with Bun...
call bun install --frozen-lockfile
if errorlevel 1 exit /b %errorlevel%
goto verify_tools

:use_npm
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found. Install Node.js 20.19+ or 22.12+.
    exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found. Reinstall Node.js with npm included.
    exit /b 1
)
set "RUNNER=npm"
set "BUILD_SCRIPT=build"
echo Installing JavaScript dependencies with npm...
call npm ci
if errorlevel 1 exit /b %errorlevel%

:verify_tools
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

echo Installing the WebAssembly Rust target...
call rustup target add wasm32-unknown-unknown
if errorlevel 1 exit /b %errorlevel%

echo Building Jabr with %PACKAGE_MANAGER%...
call %RUNNER% run %BUILD_SCRIPT%
if errorlevel 1 exit /b %errorlevel%
echo Build completed successfully. Production files are in dist/.
exit /b 0
