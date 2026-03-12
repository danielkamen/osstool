import { canonicalize } from "json-canonicalize";
import type { AttestationV1 } from "./types.js";
import { verifyGpgSignature } from "../crypto/gpg.js";

export function getVerificationPayload(attestation: AttestationV1): Buffer {
  const { signature, signature_format, ...rest } = attestation;
  const canonical = canonicalize(rest);
  return Buffer.from(canonical, "utf-8");
}

export async function verifyAttestationSignature(
  attestation: AttestationV1,
): Promise<boolean> {
  const payload = getVerificationPayload(attestation);

  if (attestation.signature_format === "gpg") {
    return verifyGpgSignature(payload, attestation.signature);
  }

  // SSH verification requires an allowed_signers file which we don't have locally
  // This is primarily used by the GitHub Action which fetches keys from the API
  throw new Error(
    "SSH signature verification requires an allowed_signers file. " +
    "Use the GitHub Action for SSH signature verification.",
  );
}
