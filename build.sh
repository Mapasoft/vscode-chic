#!/usr/bin/env bash
set -euo pipefail
npm install
npm run compile
npx vsce package
echo "Done. Install with: code --install-extension vscode-chic-*.vsix"
