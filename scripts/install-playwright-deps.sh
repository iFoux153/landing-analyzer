#!/bin/bash
# Install Playwright system deps without sudo (user space)
# Use this if you can't run `npx playwright install-deps chromium`

set -e
DEST="$HOME/.local/lib/playwright-deps"
mkdir -p "$DEST"
cd /tmp

LIBS="libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64 libpango-1.0-0 libcairo2 libatspi2.0-0t64"

echo "📦 Downloading libs..."
for lib in $LIBS; do
  apt-get download "$lib" 2>/dev/null && echo "  ✓ $lib" || echo "  ✗ $lib (skip)"
done

echo "📂 Extracting to $DEST..."
for deb in *.deb; do
  dpkg-deb -x "$deb" "$DEST/" 2>/dev/null
done

echo ""
echo "✅ Done. Add this to your .env:"
echo "PLAYWRIGHT_LIBS_PATH=$DEST/usr/lib/x86_64-linux-gnu"
