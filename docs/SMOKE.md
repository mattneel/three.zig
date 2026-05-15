# Smoke Testing Guide

This document describes how to run smoke tests across all supported platforms using the same glTF viewer bundle (DamagedHelmet).

## Prerequisites

### Common
- Zig 0.15.2
- CMake and Ninja
- C/C++ toolchain
- Built JavaScript bundle: `cd examples/gltf_viewer && npm install && npm run build`

### Platform-specific
- **Linux**: Vulkan driver, X11 development libraries
- **Windows**: Visual Studio Build Tools with LLVM/Clang, Windows SDK
- **Android**: Android SDK, Android NDK, connected Android device
- **macOS**: Docker with KVM support (see docs/MACOS-DOCKER.md)

## Quick Reference

| Platform | Command |
|----------|---------|
| Linux/WSL | `./scripts/smoke.sh` |
| Windows | `scripts\smoke.bat` |
| Android | `./scripts/smoke-android.sh full` |

## Desktop Smoke (Linux/Windows)

### Linux
```bash
./scripts/smoke.sh
```

### Windows
```cmd
scripts\smoke.bat
```

### Expected Output
The glTF viewer window should open displaying the DamagedHelmet model. After 20 seconds, the script will timeout with:
```
✓ Smoke test passed (timed out as expected - app was running)
```

Look for this log line in the output:
```
DamagedHelmet loaded successfully
```

### Manual Desktop Smoke
If you prefer manual control:
```bash
# Build
zig build

# Run (Linux/WSL)
./zig-out/bin/threez run examples/gltf_viewer/dist/gltf-bundle.js

# Run (Windows)
zig-out\bin\threez.exe run examples\gltf_viewer\dist\gltf-bundle.js
```

## Android Smoke

### Setup
Configure your environment (or set defaults in the script):
```bash
export ANDROID_HOME=/path/to/android/sdk
export ANDROID_NDK_HOME=/path/to/android/ndk
export ADB=/path/to/adb  # Optional: defaults to WSL path from handoff
```

### Full Smoke Test
```bash
./scripts/smoke-android.sh full
```

This will:
1. Build the APK (with automatic asset staging)
2. Install on connected device
3. Launch the app
4. Take a screenshot after 5 seconds
5. Save screenshot to `/tmp/threezig-android-smoke.png`

**Note**: The build system automatically stages the glTF viewer example assets
from `examples/gltf_viewer/` to `android-assets/` and bundles them into the APK.
No manual asset staging is required for the default example.

### Step-by-Step Android Smoke
```bash
# Build and install APK
./scripts/smoke-android.sh install

# Launch the app
./scripts/smoke-android.sh run

# View logs (Ctrl+C to exit)
./scripts/smoke-android.sh logs

# Take a screenshot
./scripts/smoke-android.sh screenshot /tmp/my-screenshot.png

# Test orientation changes
./scripts/smoke-android.sh rotation
```

### Expected Android Logs
```text
threez android_main started
AAssetManager registered
INIT_WINDOW: 1272x2772
creating GraphicsContext for ANativeWindow 1272x2772
surface configured: format=22 presentMode=1 alphaMode=4 size=1272x2772
Dawn GPU surface created
JS runtime initialized
Loaded app.js (2492973 bytes), evaluating...
DamagedHelmet loaded successfully
User script evaluated
GAINED_FOCUS
```

### Android Package Info
- Package: `com.threez.gltfviewer`
- Activity: `android.app.NativeActivity`
- Native library: `threez`

## macOS Smoke (Docker)

### Setup
See [docs/MACOS-DOCKER.md](docs/MACOS-DOCKER.md) for initial Docker setup.

### Performance Warning
**macOS Docker smoke tests will be very slow due to software virtio GPU rendering.**
- Ignore FPS metrics - focus on functionality only
- Expect long load times (models may take minutes to render)
- Use for CI/compatibility testing, not performance validation

### Manual macOS Smoke
```bash
# Start the container
docker compose -f docker-compose.macos.yml up -d

# Access via web browser at http://localhost:8006
# Complete initial macOS setup if first run

# In macOS Terminal, mount shared project directory:
sudo -S mount_9p shared

# Navigate to project (in Finder: Go → Computer → shared)
cd /shared

# Install Zig in macOS (follow Zig installation instructions)
# Then build and run:
zig build
./zig-out/bin/threez run examples/gltf_viewer/dist/gltf-bundle.js
```

### Expected macOS Behavior
- Build should succeed (may be slower than desktop)
- App should launch without crashing
- DamagedHelmet should eventually render (may take several minutes)
- **Ignore FPS values** - they will be very low due to software rendering
- Check logs for: `DamagedHelmet loaded successfully`

### Verification Focus for macOS
- [ ] Build succeeds without errors
- [ ] App launches without crash
- [ ] DamagedHelmet eventually renders (patience required)
- [ ] Log shows: `DamagedHelmet loaded successfully`
- [ ] No Metal backend errors in logs
- [ ] App can be closed normally

**Do not benchmark or measure performance on macOS Docker** - the virtio GPU is software-rendered and not representative of real Metal GPU performance.

## Verification Checklist

### Desktop (Linux/Windows)
- [ ] Build succeeds: `zig build`
- [ ] App launches without crash
- [ ] DamagedHelmet model renders in window
- [ ] FPS overlay visible in top-right corner
- [ ] Log shows: `DamagedHelmet loaded successfully`
- [ ] Window is responsive (can close normally)

### Android
- [ ] APK builds: `./smoke-android.sh install`
- [ ] APK installs on device
- [ ] App launches without crash
- [ ] DamagedHelmet model renders on device
- [ ] FPS overlay visible in top-right corner
- [ ] Log shows: `DamagedHelmet loaded successfully`
- [ ] App survives orientation changes
- [ ] Screenshot shows rendered model

### macOS (Docker)
- [ ] Docker container starts successfully
- [ ] macOS setup completed (if first run)
- [ ] Shared directory mounted in macOS
- [ ] Zig installed in macOS
- [ ] Build succeeds without errors
- [ ] App launches without crash
- [ ] DamagedHelmet eventually renders (ignore load time)
- [ ] Log shows: `DamagedHelmet loaded successfully`
- [ ] No Metal backend errors
- [ ] **FPS ignored** (software rendering expected)

## Troubleshooting

### Desktop: Bundle not found
```bash
cd examples/gltf_viewer
npm install
npm run build
cd ../..
```

### Desktop: Window doesn't appear
- Check GPU driver supports Vulkan (Linux) or D3D12 (Windows)
- Verify Dawn built successfully (check `.zig-cache/dawn/`)
- Run with `--strict` flag for more error details

### Android: Device not found
```bash
# List connected devices
adb devices

# If using WSL, ensure adb path is correct:
export ADB=/mnt/c/Users/YourUser/Downloads/platform-tools/adb.exe
```

### Android: Build fails
- Verify `ANDROID_HOME` and `ANDROID_NDK_HOME` are set
- Check SDK has build-tools 35.0.0 and platform android-35
- Ensure NDK is r27c or compatible

### Android: App crashes on launch
```bash
# Check crash logs
./scripts/smoke-android.sh logs

# Check crash buffer
adb logcat -b crash -d -v time
```

### macOS: Container won't start
```bash
# Verify KVM support
sudo apt install cpu-checker
sudo kvm-ok

# Check if KVM device exists
ls -la /dev/kvm

# Try with privileged mode if permissions are an issue
# Add `privileged: true` to docker-compose.macos.yml
```

### macOS: Extremely slow performance
- This is expected due to software virtio GPU
- Focus on functionality, not performance
- For real Metal GPU testing, you need actual Apple hardware

### macOS: Can't access shared directory
```bash
# In macOS Terminal, remount the shared directory:
sudo -S mount_9p shared

# Check if shared directory appears in Finder (Go → Computer)
```

## Continuous Integration

These smoke scripts are designed to be run in CI:

```yaml
# Example GitHub Actions
- name: Desktop smoke (Linux)
  run: ./scripts/smoke.sh

- name: Android smoke
  run: ./scripts/smoke-android.sh full
  env:
    ANDROID_HOME: ${{ steps.android-sdk.outputs.path }}
    ANDROID_NDK_HOME: ${{ steps.android-ndk.outputs.path }}
```

## Notes

- The smoke test uses the real glTF viewer bundle, not a trivial version check
- Desktop smoke uses a 20-second timeout (configurable via `SMOKE_TIMEOUT` env var)
- Android requires manual asset staging, which is automated by `smoke-android.sh`
- All platforms should use the same source bundle: `examples/gltf_viewer/dist/gltf-bundle.js`
- The DamagedHelmet.glb asset is expected at `examples/gltf_viewer/assets/DamagedHelmet.glb`
- macOS Docker performance is very slow due to software rendering - use for compatibility testing only
- For real Metal GPU performance testing, actual Apple hardware is required