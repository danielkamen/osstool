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
    iteration_cycles: z.number().int().min(0),
    post_insert_edit_ratio: z.number().min(0).max(1),
    test_runs_observed: z.number().int().min(0),
    largest_paste_lines: z.number().int().min(0),
    paste_burst_count: z.number().int().min(0),
    editors_used: z.array(z.string()),
    partial_session: z.boolean(),
  }),
  disclosure: z.string().nullable(),
  tool_version: z.string(),
  timestamp: z.string().datetime(),
  signature: z.string(),
  signature_format: z.enum(["gpg", "ssh"]),
});

export type AttestationV1Parsed = z.infer<typeof AttestationSchemaV1>;

export function validateAttestation(data: unknown): AttestationV1Parsed {
  return AttestationSchemaV1.parse(data);
}
