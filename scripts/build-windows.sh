#!/bin/bash
# Build for Windows (AMD64)
set -euo pipefail

cd "$(dirname "$0")/.."
VERSION=$(sed -n 's/.*"productVersion": "\(.*\)".*/\1/p' wails.json)

echo "Building for Windows (amd64)..."
wails build -platform windows/amd64 -clean

# Zipped to match the macOS artifact naming. Unsigned, so SmartScreen will warn
# on first run — see INSTALL.md.
(cd build/bin && zip -q "vibeops_windows_v${VERSION}.zip" VibeOps.exe)

echo "Build complete! build/bin/vibeops_windows_v${VERSION}.zip"
