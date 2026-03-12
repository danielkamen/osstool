import { canonicalize } from "json-canonicalize";
import type { AttestationV1, SigningMethod } from "./types.js";
import type { UnsignedAttestation } from "./AttestationBuilder.js";
import { signWithGpg } from "../crypto/gpg.js";
import { signWithSsh } from "../crypto/ssh.js";

export function getCanonicalPayload(attestation: UnsignedAttestation): Buffer {
  const canonical = canonicalize(attestation);
  return Buffer.from(canonical, "utf-8");
}

export async function signAttestation(
  attestation: UnsignedAttestation,
  method: SigningMethod,
  keyId: string,
): Promise<AttestationV1> {
  const payload = getCanonicalPayload(attestation);

  let signature: string;
  if (method === "gpg") {
    signature = await signWithGpg(payload, keyId);
  } else {
    signature = await signWithSsh(payload, keyId);
  }

  return {
    ...attestation,
    signature,
    signature_format: method,
  };
}
