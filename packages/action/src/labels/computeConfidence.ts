import type { ProvenanceYmlConfig } from "../config/configSchema.js";
import type { SignalSource } from "@contrib-provenance/core";

export type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceInput {
  metrics: {
    dwell_minutes: number;
    entropy_score: number;
    test_runs_total: number;
    signal_source?: SignalSource;
  };
  config: ProvenanceYmlConfig;
  verificationPassed: boolean;
  crossValidationScore?: number;
}

export function computeConfidence(input: ConfidenceInput): ConfidenceLevel {
  const { metrics, config } = input;
  const s = config.signals;
  const signalSource = metrics.signal_source ?? "vscode";

  // Must pass verification to be anything above "low"
  if (!input.verificationPassed) return "low";

  // Server-only metrics cap at medium.
  // Two paths: temporal spread (multi-commit) OR diff complexity
  // alone (single squashed commit with real work).
  if (signalSource === "server") {
    const hasEntropySignal =
      metrics.entropy_score >= s.min_entropy_score * 0.5;
    return hasEntropySignal ? "medium" : "low";
  }

  // HIGH: strong entropy + engaged session + test signal
  const isHigh =
    metrics.entropy_score >= s.min_entropy_score &&
    metrics.dwell_minutes >= s.min_dwell_minutes &&
    metrics.test_runs_total >= 1;

  if (isHigh) {
    // Git-only needs good cross-validation to reach high
    if (signalSource === "git") {
      return (input.crossValidationScore ?? 0) >= 0.75 ? "high" : "medium";
    }
    return "high";
  }

  // MEDIUM: moderate entropy + decent dwell
  const isMedium =
    metrics.entropy_score >= s.min_entropy_score * 0.5 &&
    metrics.dwell_minutes >= Math.max(10, s.min_dwell_minutes * 0.5);

  if (isMedium) return "medium";

  return "low";
}
