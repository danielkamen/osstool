export const PRE_PUSH_HOOK = `#!/bin/sh
# contrib-provenance pre-push hook
# Computes provenance metrics and attaches them to the push.
# This hook NEVER blocks push.

if command -v npx >/dev/null 2>&1; then
  npx --yes @contrib-provenance/cli hook pre-push "$@" 2>/dev/null || true
fi

exit 0
`;

export const POST_COMMIT_HOOK = `#!/bin/sh
# contrib-provenance post-commit hook
# Records commit markers in active provenance sessions.
# This hook NEVER blocks commits.

if command -v npx >/dev/null 2>&1; then
  npx --yes @contrib-provenance/cli hook post-commit 2>/dev/null || true
fi

exit 0
`;
