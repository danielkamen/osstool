import type { ProvenanceYmlConfig } from "../config/configSchema.js";

export type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceInput {
  metrics: {
    dwell_minutes: number;
    iteration_cycles: number;
    post_insert_edit_ratio: number;
    test_runs_observed: number;
  };
  config: ProvenanceYmlConfig;
  verificationPassed: boolean;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceLevel {
  const { metrics, config } = input;
  const s = config.signals;

  // Must pass verification to be anything above "low"
  if (!input.verificationPassed) return "low";

  // HIGH: all four criteria met
  const isHigh =
    metrics.dwell_minutes >= s.min_dwell_minutes &&
    metrics.iteration_cycles >= s.min_iteration_cycles &&
    metrics.post_insert_edit_ratio >= s.min_post_insert_ratio &&
    metrics.test_runs_observed >= 1;

  if (isHigh) return "high";

  // MEDIUM: partial criteria
  const isMedium =
    metrics.dwell_minutes >= Math.max(10, s.min_dwell_minutes * 0.5) &&
    (metrics.iteration_cycles >= 1 || metrics.post_insert_edit_ratio > 0.1);

  if (isMedium) return "medium";

  return "low";
}
