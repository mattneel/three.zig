#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  quickemu-macos-setup.sh [options]

Options:
  --release <name>        macOS release for quickget (default: sonoma)
  --vm-dir <path>         VM workspace directory (default: ./.quickemu)
  --quickemu-root <path>  Use quickemu/quickget from this clone if not in PATH
  --check-only            Validate upstream macOS image availability; no download
  --launch                Launch VM after quickget finishes
  -h, --help              Show this help

Examples:
  scripts/quickemu-macos-setup.sh --release sonoma --launch
  scripts/quickemu-macos-setup.sh --quickemu-root ~/src/quickemu
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

release="sonoma"
vm_dir="${PWD}/.quickemu"
quickemu_root="${QUICKEMU_ROOT:-}"
launch=0
check_only=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      [[ $# -ge 2 ]] || die "--release requires a value"
      release="$2"
      shift 2
      ;;
    --vm-dir)
      [[ $# -ge 2 ]] || die "--vm-dir requires a value"
      vm_dir="$2"
      shift 2
      ;;
    --quickemu-root)
      [[ $# -ge 2 ]] || die "--quickemu-root requires a value"
      quickemu_root="$2"
      shift 2
      ;;
    --launch)
      launch=1
      shift
      ;;
    --check-only)
      check_only=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

resolve_tool() {
  local tool="$1"
  if command -v "$tool" >/dev/null 2>&1; then
    command -v "$tool"
    return 0
  fi

  if [[ -n "${quickemu_root}" && -x "${quickemu_root}/${tool}" ]]; then
    echo "${quickemu_root}/${tool}"
    return 0
  fi

  return 1
}

quickget_bin="$(resolve_tool quickget || true)"
quickemu_bin="$(resolve_tool quickemu || true)"

[[ -n "${quickget_bin}" ]] || die "quickget not found (set --quickemu-root or install quickemu)"
[[ -n "${quickemu_bin}" ]] || die "quickemu not found (set --quickemu-root or install quickemu)"

if [[ -n "${quickemu_root}" ]]; then
  export PATH="${quickemu_root}:${PATH}"
fi

command -v qemu-system-x86_64 >/dev/null 2>&1 || die "qemu-system-x86_64 is required"
command -v qemu-img >/dev/null 2>&1 || die "qemu-img is required"

if [[ ! -e /dev/kvm ]]; then
  echo "WARNING: /dev/kvm not found; VM acceleration may be unavailable." >&2
elif [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  cat <<'EOF' >&2
WARNING: /dev/kvm is present but not writable by current user.
Typical fixes:
  sudo usermod -aG kvm "$USER"   # then restart shell/session
  sudo setfacl -m u:$USER:rw /dev/kvm   # temporary for current boot/session
EOF
fi

mkdir -p "${vm_dir}"
pushd "${vm_dir}" >/dev/null

conf_file="macos-${release}.conf"
if [[ "${check_only}" -eq 1 ]]; then
  echo "Checking upstream image availability with: ${quickget_bin} --check macos ${release}"
  "${quickget_bin}" --check macos "${release}"
  cat <<EOF
macOS image check succeeded for release '${release}'.
Run without --check-only to download and create the VM config.
EOF
  exit 0
elif [[ -f "${conf_file}" ]]; then
  echo "Using existing VM config: ${vm_dir}/${conf_file}"
else
  echo "Creating VM config with: ${quickget_bin} macos ${release}"
  "${quickget_bin}" macos "${release}"
fi

cat <<EOF
Quickemu macOS VM is prepared.

Next steps:
  1. Install macOS:
     ${quickemu_bin} --vm ${vm_dir}/${conf_file}
  2. After guest setup, run threez verification inside guest with:
     bash scripts/macos-guest-verify.sh /path/to/threez
EOF

if [[ "${launch}" -eq 1 ]]; then
  exec "${quickemu_bin}" --vm "${vm_dir}/${conf_file}"
fi
