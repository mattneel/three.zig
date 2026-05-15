# macOS Development Environment via Docker

This directory contains a Docker Compose configuration for running macOS 14 (Sonoma) in a container for development and testing of three.zig on macOS.

## Prerequisites

- Linux host with KVM support
- Docker or Podman CLI
- CPU virtualization extensions enabled in BIOS

Verify KVM support:
```bash
sudo apt install cpu-checker
sudo kvm-ok
```

## Usage

Start the macOS container:
```bash
docker compose -f docker-compose.macos.yml up -d
```

Access the web interface at http://localhost:8006

## Initial Setup

When you first connect to the web interface:

1. Choose **Disk Utility** and select the largest "Apple Inc. VirtIO Block Media" disk
2. Click **Erase** to format to APFS (name it whatever you like)
3. Close Disk Utility and click **Reinstall macOS**
4. Select the disk you created when prompted
5. Complete macOS setup:
   - Select region, language, keyboard
   - Migration Assistant: select **Not now** (bottom left)
   - Apple ID: select **Set Up Later** → **Skip**
   - Create a computer account with username and password

## File Sharing

The project directory is mounted at `/shared` inside macOS. To access it:

1. Open Terminal in macOS
2. Mount the shared folder:
```bash
sudo -S mount_9p shared
```
3. In Finder, click **Go → Computer** to access the shared folder

## Configuration

The container is configured with:
- **macOS Version**: 14 (Sonoma) - stable default
- **RAM**: 8GB
- **CPU Cores**: 4
- **Disk Size**: 128GB
- **Web Interface**: http://localhost:8006
- **VNC**: localhost:5900

**Note**: macOS 15 (Sequoia) is available but has limitations (Apple Account sign-in not supported). To use Sequoia instead, change `VERSION: "14"` to `VERSION: "15"` in `docker-compose.macos.yml`.

Adjust these in `docker-compose.macos.yml` if needed.

## Stopping

Stop the container:
```bash
docker compose -f docker-compose.macos.yml down
```

## Important Notes

- **EULA Compliance**: Only run this container on Apple hardware per Apple's EULA
- **Storage**: Disk image persists in `./macos-storage/` directory
- **Version**: macOS 14 (Sonoma) is used as stable default; Sequoia (15) available but has limitations

## Development Workflow

1. Start container: `docker compose -f docker-compose.macos.yml up -d`
2. Access via web browser at http://localhost:8006
3. Mount shared folder to access three.zig source code
4. Install Zig and other dependencies in macOS
5. Build and test three.zig on macOS
6. Stop container when done: `docker compose -f docker-compose.macos.yml down`