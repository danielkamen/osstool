#!/bin/bash
# Build and publish the CLI package to npm
set -e

cd "$(dirname "$0")/../packages/cli"

echo "Building CLI..."
npm run build

echo "Publishing to npm..."
npm publish --access public

echo "Done — published @contrib-provenance/cli@$(node -p "require('./package.json').version")"
