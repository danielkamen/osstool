import type { ProvenanceYmlConfig } from "../config/configSchema.js";

export type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceInput {
  metrics: {
    dwell_minutes: number;
    entropy_score: number;
    test_runs_total: number;
  };
  config: ProvenanceYmlConfig;
  verificationPassed: boolean;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceLevel {
  const { metrics, config } = input;
  const s = config.signals;

  // Must pass verification to be anything above "low"
  if (!input.verificationPassed) return "low";

  // HIGH: strong entropy + engaged session + at least one test run
  const isHigh =
    metrics.entropy_score >= s.min_entropy_score &&
    metrics.dwell_minutes >= s.min_dwell_minutes &&
    metrics.test_runs_total >= 1;

  if (isHigh) return "high";

  // MEDIUM: moderate entropy + decent dwell
  const isMedium =
    metrics.entropy_score >= s.min_entropy_score * 0.5 &&
    metrics.dwell_minutes >= Math.max(10, s.min_dwell_minutes * 0.5);

  if (isMedium) return "medium";

  return "low";
}
