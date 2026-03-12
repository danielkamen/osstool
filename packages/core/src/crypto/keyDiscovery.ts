import { getGitConfig } from "../util/git.js";
import type { SigningMethod } from "../attestation/types.js";

export interface SigningKeyInfo {
  method: SigningMethod;
  keyId: string;
}

export async function discoverSigningKey(repoRoot: string): Promise<SigningKeyInfo> {
  const format = await getGitConfig("gpg.format", repoRoot);
  const signingKey = await getGitConfig("user.signingkey", repoRoot);

  if (!signingKey) {
    throw new Error(
      "No signing key configured. Set one with:\n" +
      "  git config user.signingkey <KEY_ID>     (for GPG)\n" +
      "  git config user.signingkey ~/.ssh/id_ed25519.pub  (for SSH)\n" +
      "  git config gpg.format ssh               (to use SSH signing)",
    );
  }

  if (format === "ssh") {
    return { method: "ssh", keyId: signingKey };
  } else {
    return { method: "gpg", keyId: signingKey };
  }
}
