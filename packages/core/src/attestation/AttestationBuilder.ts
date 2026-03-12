import type { AttestationV1 } from "./types.js";
import type { SessionMetrics } from "../session/types.js";
import { getHeadSha, getRemoteUrl, parseRemoteToSlug } from "../util/git.js";
import { getIdentityHash } from "../crypto/identity.js";
import { isoNow } from "../util/time.js";

export type UnsignedAttestation = Omit<AttestationV1, "signature" | "signature_format">;

export async function buildAttestation(params: {
  metrics: SessionMetrics;
  repoRoot: string;
  disclosure?: string | null;
  toolVersion: string;
}): Promise<UnsignedAttestation> {
  const { metrics, repoRoot, disclosure, toolVersion } = params;

  const commit = await getHeadSha(repoRoot);
  const remoteUrl = await getRemoteUrl(repoRoot);
  const repo = parseRemoteToSlug(remoteUrl);
  const identity = await getIdentityHash(repoRoot);

  return {
    schema: "contribution-provenance/v1",
    repo,
    commit,
    identity,
    session: {
      session_id: metrics.session_id,
      started_at: metrics.started_at,
      ended_at: metrics.ended_at,
      dwell_minutes: metrics.dwell_minutes,
      active_files: metrics.active_files,
      entropy_score: metrics.entropy_score,
      edit_displacement_sum: metrics.edit_displacement_sum,
      temporal_jitter_ms: metrics.temporal_jitter_ms,
      test_runs_total: metrics.test_runs_total,
      test_failures_observed: metrics.test_failures_observed,
      test_failure_ratio: metrics.test_failure_ratio,
      editors_used: metrics.editors_used,
      partial_session: metrics.partial_session,
    },
    disclosure: disclosure ?? null,
    tool_version: toolVersion,
    timestamp: isoNow(),
  };
}
