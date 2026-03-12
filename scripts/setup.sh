#!/bin/sh
# Contribution Provenance — server-only setup for any repo
# Works with any language (Rust, Python, Go, etc.) — no Node.js required.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/danielkamen/osstool/main/scripts/setup.sh | sh
#
# What it does:
#   1. Creates .github/provenance.yml (Action config)
#   2. Creates .github/workflows/provenance.yml (Action workflow)
#   The GitHub Action scores PRs using server-side metrics
#   (commit patterns, file diffs, temporal analysis) — no contributor setup needed.

set -e

# Ensure we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: not a git repository." >&2
  exit 1
fi

# Create directories
mkdir -p .github/workflows

# Write .github/provenance.yml (skip if exists)
if [ -f .github/provenance.yml ]; then
  echo "  - .github/provenance.yml already exists, skipping"
else
  cat > .github/provenance.yml << 'YAML'
# Contribution Provenance — PR verification config
# Docs: https://github.com/danielkamen/osstool
version: 1
mode: oss
YAML
  echo "  ✓ .github/provenance.yml"
fi

# Write .github/workflows/provenance.yml (skip if exists)
if [ -f .github/workflows/provenance.yml ]; then
  echo "  - .github/workflows/provenance.yml already exists, skipping"
else
  cat > .github/workflows/provenance.yml << 'YAML'
name: Contribution Provenance
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write
  contents: read

jobs:
  provenance:
    runs-on: ubuntu-latest
    steps:
      - uses: danielkamen/osstool/packages/action@v1
YAML
  echo "  ✓ .github/workflows/provenance.yml"
fi

echo ""
echo "Provenance initialized (server-only)."
echo ""
echo "The GitHub Action will score PRs using server-side metrics"
echo "(commit patterns, file diffs, temporal analysis)."
echo "No client-side tooling required for contributors."
echo ""
echo "Next steps:"
echo "  1. Commit the generated files and push"
echo "  2. PRs will be automatically scored and labeled"
