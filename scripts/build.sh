#!/bin/bash
# Simple production build for current platform

echo "Building for production..."
wails build -clean
[ "$(uname)" = Darwin ] && ./scripts/sign-macos.sh
echo "Build complete! Check build/bin/"
