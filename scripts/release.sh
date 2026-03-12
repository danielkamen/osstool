#!/bin/bash
# Full release: push + bump + publish npm + publish vscode + tag v1
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Push any pending changes
echo "=== Pushing to origin main ==="
git push origin main

# 2. Bump and publish CLI to npm
echo "=== Publishing CLI to npm ==="
cd "$ROOT/packages/cli"
npm version patch --no-git-tag-version
npm run build
npm publish --access public
echo "Published @contrib-provenance/cli@$(node -p "require('./package.json').version")"

# 3. Bump and publish VS Code extension
echo "=== Publishing VS Code extension ==="
cd "$ROOT/packages/vscode"
npm version patch --no-git-tag-version
npm run build
npx vsce publish --no-dependencies
echo "Published contrib-provenance-vscode@$(node -p "require('./package.json').version")"

# 4. Commit version bumps, tag, and push
cd "$ROOT"
git add packages/cli/package.json packages/vscode/package.json package-lock.json
git commit -m "chore: bump cli and vscode versions"
git tag -f v1
git push origin main
git push origin v1 --force

echo "=== All done — v1 now points to $(git rev-parse --short HEAD) ==="
