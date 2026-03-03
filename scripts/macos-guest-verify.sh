#!/usr/bin/env bash
set -euo pipefail

project_root="${1:-$HOME/threez}"
if [[ ! -d "${project_root}" ]]; then
  echo "ERROR: project root not found: ${project_root}" >&2
  exit 1
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
log_dir="${project_root}/.artifacts/macos"
log_file="${log_dir}/verification-${timestamp}.log"
mkdir -p "${log_dir}"

exec > >(tee -a "${log_file}") 2>&1

echo "threez macOS guest verification"
echo "project_root=${project_root}"
echo "log_file=${log_file}"

run_step() {
  local name="$1"
  shift
  echo ""
  echo "== ${name} =="
  "$@"
}

cd "${project_root}"

run_step "zig build" zig build
run_step "zig build test" zig build test --summary all
run_step "kqueue-specific tests" zig test src/io/kqueue.zig -O Debug

if [[ -d "${project_root}/deps/zig-quickjs-ng" ]]; then
  run_step "quickjs-ng upstream tests" bash -lc "cd '${project_root}/deps/zig-quickjs-ng' && zig build test"
fi

if command -v npm >/dev/null 2>&1; then
  run_step "bootstrap ts build" bash -lc "cd '${project_root}/src/ts' && npm run build"
  run_step "bootstrap ts typecheck" bash -lc "cd '${project_root}/src/ts' && npm run typecheck"
else
  echo "WARNING: npm not found; skipping TypeScript checks."
fi

echo ""
echo "Manual runtime checks (required to close T6b/T23 confidence):"
echo "  1. ./zig-out/bin/threez run examples/gltf_viewer/dist/gltf-bundle.js"
echo "  2. Interact for >= 5 minutes (orbit + resize) and confirm stability."
echo "  3. Capture CPU/GPU usage snapshot in Activity Monitor."
echo ""
echo "Done. Attach ${log_file} to docs/specs/threez/macos-build-investigation.md"

