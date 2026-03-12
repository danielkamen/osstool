import type { AttestationV1, Check } from "@contrib-provenance/core";
import { AttestationSchemaV1 } from "@contrib-provenance/core";
import { verifyIdentity, verifyCommitBinding, checkFreshness } from "./verifyIdentity.js";
import { verifySignature } from "./verifySignature.js";
import { checkReplay } from "../replay/checkReplay.js";

interface VerificationContext {
  owner: string;
  repo: string;
  prNumber: number;
  commits: any[];
  octokit: any;
  prAuthor: string;
}

interface VerificationResult {
  checks: Check[];
  allPassed: boolean;
  attestation: AttestationV1;
}

export async function verifyAttestation(
  attestation: AttestationV1,
  ctx: VerificationContext,
): Promise<VerificationResult> {
  const checks: Check[] = [];

  // 1. Schema validation
  const schemaResult = AttestationSchemaV1.safeParse(attestation);
  checks.push({
    name: "schema",
    passed: schemaResult.success,
    detail: schemaResult.success ? undefined : schemaResult.error.message,
  });

  // 2. Commit binding
  const commitInPR = verifyCommitBinding(attestation.commit, ctx.commits);
  checks.push({ name: "commit_binding", passed: commitInPR });

  // 3. Identity binding
  const identityMatch = verifyIdentity(attestation.identity, ctx.commits);
  checks.push({ name: "identity_binding", passed: identityMatch });

  // 4. Signature verification
  const sigResult = await verifySignature(attestation, ctx.octokit, ctx.prAuthor);
  checks.push({
    name: "signature",
    passed: sigResult.valid,
    detail: sigResult.detail,
  });

  // 5. Freshness check
  const fresh = checkFreshness(attestation.timestamp, attestation.commit, ctx.commits);
  checks.push({ name: "freshness", passed: fresh });

  // 6. Replay detection
  const replayResult = await checkReplay(
    ctx.octokit,
    ctx.owner,
    ctx.repo,
    ctx.prNumber,
    attestation.session.session_id,
  );
  checks.push({
    name: "replay",
    passed: !replayResult.isReplay,
    detail: replayResult.detail,
  });

  return {
    checks,
    allPassed: checks.every((c) => c.passed),
    attestation,
  };
}

const ATTESTATION_MARKER = "<!-- provenance-attestation-v1";

export function findAttestationInComments(
  comments: Array<{ body?: string | null }>,
): AttestationV1 | null {
  // Search in reverse order (most recent first)
  for (let i = comments.length - 1; i >= 0; i--) {
    const body = comments[i].body ?? "";
    const startIdx = body.indexOf(ATTESTATION_MARKER);
    if (startIdx === -1) continue;

    const jsonStart = body.indexOf("\n", startIdx) + 1;
    const jsonEnd = body.indexOf("\n-->", jsonStart);
    if (jsonEnd === -1) continue;

    try {
      const json = body.slice(jsonStart, jsonEnd).trim();
      const attestation = JSON.parse(json);
      return AttestationSchemaV1.parse(attestation);
    } catch {
      continue;
    }
  }
  return null;
}
