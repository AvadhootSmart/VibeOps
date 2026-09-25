#!/bin/bash
# Signs build/bin/VibeOps.app with a stable identity so macOS remembers the
# permissions you grant (folders, local network, notifications) across rebuilds
# and updates. `wails build` only ad-hoc signs, and TCC pins an ad-hoc app's
# grants to its exact binary hash — every build is a stranger, so every build
# prompts again. A real certificate makes the grant key "this bundle id, signed
# by this cert" instead.
#
# ponytail: self-signed, so Gatekeeper still warns on other machines. Swap
# IDENTITY for a "Developer ID Application" cert (and notarize) to fix that.
set -euo pipefail

IDENTITY="VibeOps Local Signing"
APP="${1:-build/bin/VibeOps.app}"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if ! security find-identity -v -p codesigning | grep -q "\"$IDENTITY\""; then
  echo "Creating the '$IDENTITY' certificate (one-time; macOS will ask for your password)..."
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -subj "/CN=$IDENTITY" \
    -keyout "$tmp/key.pem" -out "$tmp/cert.pem" \
    -addext "keyUsage=critical,digitalSignature" \
    -addext "extendedKeyUsage=critical,codeSigning" \
    -addext "basicConstraints=critical,CA:false" 2>/dev/null
  # -legacy: macOS's importer can't read OpenSSL 3's default p12 encryption.
  openssl pkcs12 -export -legacy -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
    -out "$tmp/id.p12" -passout pass:vibeops 2>/dev/null ||
    openssl pkcs12 -export -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
      -out "$tmp/id.p12" -passout pass:vibeops
  security import "$tmp/id.p12" -k "$KEYCHAIN" -P vibeops -T /usr/bin/codesign
  # codesign refuses a certificate the system doesn't trust for code signing.
  security add-trusted-cert -r trustRoot -p codeSign -k "$KEYCHAIN" "$tmp/cert.pem"
fi

codesign --force --deep --timestamp=none -s "$IDENTITY" "$APP"
codesign --verify --deep --strict "$APP"
echo "Signed $APP: $(codesign -dr - "$APP" 2>&1 | grep designated)"
