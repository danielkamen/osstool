#!/bin/bash
# Build, package, and publish the VS Code extension
set -e

cd "$(dirname "$0")/../packages/vscode"

echo "Building extension..."
npm run build

echo "Packaging..."
npx vsce package --no-dependencies

echo "Publishing..."
npx vsce publish --no-dependencies

echo "Done — published $(node -p "require('./package.json').version")"
