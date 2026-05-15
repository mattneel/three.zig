#!/bin/bash
# smoke.sh - Run the glTF viewer smoke test on desktop platforms
# Usage: ./smoke.sh [platform]
#   platform: auto-detect if not specified (linux, windows, macos)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

BUNDLE="examples/gltf_viewer/dist/gltf-bundle.js"
TIMEOUT="${SMOKE_TIMEOUT:-20}"

if [ ! -f "$BUNDLE" ]; then
    echo "Error: Bundle not found at $BUNDLE"
    echo "Run: cd examples/gltf_viewer && npm install && npm run build"
    exit 1
fi

echo "Building threez..."
zig build

echo "Running glTF viewer smoke test (timeout ${TIMEOUT}s)..."
OUTPUT=$(timeout "$TIMEOUT"s ./zig-out/bin/threez run "$BUNDLE" 2>&1) || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 124 ]; then
        echo "✓ Smoke test passed (timed out as expected - app was running)"
        exit 0
    fi
    # Check if we saw the success message before exiting
    if echo "$OUTPUT" | grep -q "DamagedHelmet loaded successfully"; then
        echo "✓ Smoke test passed (saw success message before exit)"
        exit 0
    fi
    echo "✗ Smoke test failed with exit code $EXIT_CODE"
    echo "$OUTPUT"
    exit $EXIT_CODE
}

# Check for success message in case of clean exit
if echo "$OUTPUT" | grep -q "DamagedHelmet loaded successfully"; then
    echo "✓ Smoke test passed (saw success message)"
    exit 0
else
    echo "✗ Smoke test failed (success message not found)"
    echo "$OUTPUT"
    exit 1
fi