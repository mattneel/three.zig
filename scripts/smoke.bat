@echo off
REM smoke.bat - Run the glTF viewer smoke test on Windows
REM Usage: smoke.bat

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%"

set "BUNDLE=examples\gltf_viewer\dist\gltf-bundle.js"
set "TIMEOUT=%SMOKE_TIMEOUT%:20"

if not exist "%BUNDLE%" (
    echo Error: Bundle not found at %BUNDLE%
    echo Run: cd examples\gltf_viewer ^&^& npm install ^&^& npm run build
    exit /b 1
)

echo Building threez...
zig build

echo Running glTF viewer smoke test...
zig-out\bin\threez.exe run %BUNDLE%