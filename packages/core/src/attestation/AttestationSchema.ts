import { z } from "zod";

export const AttestationSchemaV1 = z.object({
  schema: z.literal("contribution-provenance/v1"),
  repo: z.string(),
  commit: z.string().regex(/^[0-9a-f]{40}$/),
  identity: z.string().regex(/^[0-9a-f]{64}$/),
  session: z.object({
    session_id: z.string().uuid(),
    started_at: z.string().datetime(),
    ended_at: z.string().datetime(),
    dwell_minutes: z.number().min(0),
    active_files: z.number().int().min(0),
    entropy_score: z.number().min(0),
    edit_displacement_sum: z.number().min(0),
    temporal_jitter_ms: z.number().min(0),
    test_runs_total: z.number().int().min(0),
    test_failures_observed: z.number().int().min(0),
    test_failure_ratio: z.number().min(0).max(1),
    editors_used: z.array(z.string()),
    partial_session: z.boolean(),
    signal_source: z.enum(["vscode", "git", "hybrid", "server"]).optional(),
    commit_count: z.number().int().min(0).optional(),
    diff_churn: z.number().min(0).optional(),
  }),
  disclosure: z.string().nullable(),
  tool_version: z.string(),
  timestamp: z.string().datetime(),
  signature: z.string().optional(),
  signature_format: z.enum(["gpg", "ssh"]).optional(),
});

export type AttestationV1Parsed = z.infer<typeof AttestationSchemaV1>;

export function validateAttestation(data: unknown): AttestationV1Parsed {
  return AttestationSchemaV1.parse(data);
}
