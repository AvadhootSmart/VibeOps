#!/bin/bash
# Builds every supported platform: macOS (Apple Silicon) and Windows.
set -e

# Only the first build cleans: -clean wipes build/bin, which would delete the
# build before it.
echo "Building for macOS (arm64)..."
wails build -platform darwin/arm64 -clean
./scripts/sign-macos.sh

echo "Building for Windows (amd64)..."
wails build -platform windows/amd64

echo "Build complete! Check build/bin/"
