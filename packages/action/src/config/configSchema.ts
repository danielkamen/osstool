import { z } from "zod";

export const ProvenanceYmlSchema = z.object({
  version: z.literal(1),
  mode: z.enum(["internal", "oss"]).default("internal"),

  require_attestation: z.boolean().default(false),
  attestation_reminder: z.boolean().default(true),

  labels: z
    .object({
      high: z.string().default("provenance-high"),
      medium: z.string().default("provenance-medium"),
      low: z.string().default("provenance-low"),
      none: z.string().optional(),
    })
    .default({}),

  signals: z
    .object({
      min_dwell_minutes: z.number().default(10),
      min_entropy_score: z.number().default(5.0),
      require_test_run: z.boolean().default(false),
      ai_disclosure_prompt: z.boolean().default(true),
    })
    .default({}),

  fast_lane: z
    .object({
      enabled: z.boolean().default(false),
      sla_hours: z.number().default(72),
      label: z.string().default("fast-lane"),
      standard_label: z.string().default("standard-queue"),
    })
    .default({}),

  privacy: z
    .object({
      upload_paste_content: z.literal(false).default(false),
      upload_command_args: z.literal(false).default(false),
    })
    .default({}),

  notifications: z
    .object({
      slack_webhook: z.string().nullable().default(null),
      comment_on_pr: z.boolean().default(true),
    })
    .default({}),

  bypass: z
    .object({
      users: z.array(z.string()).default([]),
      labels: z.array(z.string()).default(["dependencies", "automated"]),
    })
    .default({}),

  server_metrics: z.boolean().default(true),
  cross_validate: z.boolean().default(true),
  no_attestation_action: z
    .enum(["remind", "label-only", "ignore"])
    .default("remind"),
});

export type ProvenanceYmlConfig = z.infer<typeof ProvenanceYmlSchema>;
