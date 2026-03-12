import type { AttestationV1 } from "@contrib-provenance/core";
import {
  getVerificationPayload,
  verifyGpgSignature,
  verifySshSignature,
} from "@contrib-provenance/core";

type Octokit = any;

interface SignatureResult {
  valid: boolean;
  detail?: string;
}

export async function verifySignature(
  attestation: AttestationV1,
  octokit: Octokit,
  prAuthor: string,
): Promise<SignatureResult> {
  const payload = getVerificationPayload(attestation);

  try {
    if (attestation.signature_format === "gpg") {
      return await verifyGpgSig(payload, attestation.signature, octokit, prAuthor);
    } else {
      return await verifySshSig(payload, attestation.signature, octokit, prAuthor);
    }
  } catch (err) {
    return {
      valid: false,
      detail: `Signature verification error: ${(err as Error).message}`,
    };
  }
}

async function verifyGpgSig(
  payload: Buffer,
  signature: string,
  octokit: Octokit,
  username: string,
): Promise<SignatureResult> {
  try {
    // Fetch user's GPG keys from GitHub
    const { data: keys } = await octokit.rest.users.listGpgKeysForUser({
      username,
    });

    if (keys.length === 0) {
      return {
        valid: false,
        detail:
          "No GPG keys found on GitHub. Upload your signing key to GitHub Settings > SSH and GPG keys.",
      };
    }

    // Try local GPG verification (keys may be in the runner's keyring)
    const result = await verifyGpgSignature(payload, signature);
    if (result) return { valid: true };

    return {
      valid: false,
      detail:
        "GPG signature could not be verified. Ensure your signing key is uploaded to GitHub.",
    };
  } catch {
    return {
      valid: false,
      detail: "Failed to fetch GPG keys or verify signature.",
    };
  }
}

async function verifySshSig(
  payload: Buffer,
  signature: string,
  octokit: Octokit,
  username: string,
): Promise<SignatureResult> {
  try {
    // Fetch user's SSH signing keys from GitHub
    const { data: keys } = await octokit.rest.users.listSshSigningKeysForUser({
      username,
    });

    if (keys.length === 0) {
      return {
        valid: false,
        detail:
          "No SSH signing keys found on GitHub. Upload your signing key to GitHub Settings > SSH and GPG keys.",
      };
    }

    // Build allowed_signers content from GitHub keys
    for (const key of keys) {
      const allowedSigners = `contributor ${key.key}`;
      const result = await verifySshSignature(payload, signature, allowedSigners);
      if (result) return { valid: true };
    }

    return {
      valid: false,
      detail:
        "SSH signature does not match any keys registered on GitHub.",
    };
  } catch {
    return {
      valid: false,
      detail: "Failed to fetch SSH keys or verify signature.",
    };
  }
}
