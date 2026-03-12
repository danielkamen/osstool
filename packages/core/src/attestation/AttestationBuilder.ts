import type { AttestationV1 } from "./types.js";
import type { SessionMetrics, GitDerivedMetrics, ProvenanceMetrics } from "../session/types.js";
import { getHeadSha, getRemoteUrl, parseRemoteToSlug } from "../util/git.js";
import { getIdentityHash } from "../crypto/identity.js";
import { isoNow } from "../util/time.js";
import { randomUUID } from "node:crypto";

export type UnsignedAttestation = Omit<AttestationV1, "signature" | "signature_format">;

function isSessionMetrics(m: ProvenanceMetrics): m is SessionMetrics {
  return "session_id" in m;
}

function buildSessionBlock(metrics: ProvenanceMetrics): UnsignedAttestation["session"] {
  if (isSessionMetrics(metrics)) {
    return {
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
      signal_source: metrics.signal_source ?? "vscode",
    };
  }

  // GitDerivedMetrics
  const now = isoNow();
  return {
    session_id: randomUUID(),
    started_at: now,
    ended_at: now,
    dwell_minutes: metrics.dwell_minutes,
    active_files: metrics.active_files,
    entropy_score: metrics.entropy_score,
    edit_displacement_sum: 0,
    temporal_jitter_ms: metrics.commit_temporal_jitter_ms,
    test_runs_total: 0,
    test_failures_observed: 0,
    test_failure_ratio: 0,
    editors_used: metrics.editors_used,
    partial_session: false,
    signal_source: "git",
    commit_count: metrics.commit_count,
    diff_churn: metrics.diff_churn,
  };
}

export async function buildAttestation(params: {
  metrics: ProvenanceMetrics;
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
    session: buildSessionBlock(metrics),
    disclosure: disclosure ?? null,
    tool_version: toolVersion,
    timestamp: isoNow(),
  };
}
