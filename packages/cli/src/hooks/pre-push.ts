export const PRE_PUSH_HOOK = `#!/bin/sh
# contrib-provenance pre-push hook
# This hook runs before push and reminds about unexported sessions.
# It NEVER blocks push.

PROVENANCE_DIR=".provenance"

if [ ! -d "$PROVENANCE_DIR" ]; then
  exit 0
fi

# Check for ended but unexported sessions
if command -v provenance >/dev/null 2>&1; then
  UNEXPORTED=$(provenance inspect --all 2>/dev/null | grep "ended" || true)
  if [ -n "$UNEXPORTED" ]; then
    echo ""
    echo "Contribution Provenance: You have an unexported session."
    echo "   Run 'provenance export' to create a signed attestation."
    echo "   (Push continues regardless)"
    echo ""
  fi
fi

exit 0
`;
