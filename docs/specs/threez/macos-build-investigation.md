<!-- status: in-review -->
# macOS Build Investigation (Quickemu Harness)

## Scope

- Close T6b by validating kqueue on a real macOS environment.
- Reuse the same verification shape used for Linux/Windows.
- Record concrete evidence and promote T6b from Partial to Complete.

## Current State

- Host machine: WSL2 Ubuntu (KVM device present).
- QEMU stack installed on host (`qemu-system-x86_64`, `qemu-img`, `ovmf`, `swtpm`).
- Quickemu harness added:
  - [`scripts/quickemu-macos-setup.sh`](/home/autark/src/threez/scripts/quickemu-macos-setup.sh)
  - [`scripts/macos-guest-verify.sh`](/home/autark/src/threez/scripts/macos-guest-verify.sh)
- T6b is still open pending a real macOS run and logs.

## Host Setup (WSL2 Ubuntu)

1. Install prerequisites (already done on this host):
   - `sudo apt-get install qemu-system-x86 qemu-utils ovmf swtpm-tools zsync jq genisoimage socat`
2. Obtain quickemu/quickget:
   - Option A: install from package/ppa if available.
   - Option B: clone upstream and pass `--quickemu-root <path>`.
3. Ensure KVM access for the current user:
   - `sudo usermod -aG kvm "$USER"` then restart shell/session, or
   - temporary: `sudo setfacl -m u:$USER:rw /dev/kvm`

## Prepare macOS VM

1. Quick metadata check (no download):
   - `bash scripts/quickemu-macos-setup.sh --release sonoma --quickemu-root <quickemu-clone> --check-only`
2. Create VM assets + config:
   - `bash scripts/quickemu-macos-setup.sh --release sonoma --quickemu-root <quickemu-clone>`
3. Launch VM:
   - `quickemu --vm .quickemu/macos-sonoma.conf`

Notes:
- First boot is installer/recovery flow; follow quickemu macOS install prompts.
- After first install, re-run the same `quickemu --vm ...` command to boot into the installed macOS disk.

## Guest Verification Plan

Inside macOS guest:

1. Clone/open `threez`.
2. Run:
   - `bash scripts/macos-guest-verify.sh /path/to/threez`
3. Run manual runtime check:
   - `./zig-out/bin/threez run examples/gltf_viewer/dist/gltf-bundle.js`
   - Interact for >= 5 minutes (orbit + resize).
   - Record Activity Monitor CPU/GPU usage snapshot.

Expected artifacts:

- Verification log:
  - `/path/to/threez/.artifacts/macos/verification-<timestamp>.log`
- Runtime notes/screenshot evidence added to this file.

## Evidence Checklist (T6b Closure Gate)

- [ ] `zig build` passed on macOS guest
- [ ] `zig build test --summary all` passed on macOS guest
- [ ] `zig test src/io/kqueue.zig -O Debug` passed on macOS guest
- [ ] `zig build run -- run examples/gltf_viewer/dist/gltf-bundle.js` stable for >= 5 minutes
- [ ] CPU/GPU usage snapshot captured
- [ ] Commands + outputs appended below

## Run Log

### Host

- `qemu-system-x86_64`, `qemu-img`, `ovmf`, `swtpm-tools`, `spice-client-gtk` installed on WSL2 Ubuntu host
- `bash scripts/quickemu-macos-setup.sh --release sonoma --quickemu-root /tmp/quickemu-ref2 --check-only` -> pass
- `bash scripts/quickemu-macos-setup.sh --release sonoma --quickemu-root /tmp/quickemu-ref2` -> pass (downloaded RecoveryImage/OpenCore and generated `.quickemu/macos-sonoma.conf`)
- `quickemu --vm .quickemu/macos-sonoma.conf --display none` reaches VM start path; KVM user-access and MSR configuration must be finalized for sustained guest bring-up on this host session

### Guest

- Pending
