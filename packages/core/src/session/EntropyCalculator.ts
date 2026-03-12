import type { FileEditEvent, TestRunEvent, SessionEvent } from "./types.js";

export interface EntropyComponents {
  entropy_score: number;
  edit_displacement_sum: number;
  temporal_jitter_ms: number;
  test_failure_ratio: number;
  test_failures_observed: number;
  test_runs_total: number;
}

/**
 * S = (Σ(D_i · Δt_i)) / log(N_lines + 1) · (1 + N_fails / N_total_runs)
 *
 * D_i = absolute line-distance between consecutive edits
 * Δt_i = stddev of inter-edit timing gaps (temporal jitter)
 * N_fails / N_total_runs = failure ratio from test runs
 */
export function computeEntropy(events: SessionEvent[]): EntropyComponents {
  const edits = events.filter((e): e is FileEditEvent => e.type === "file_edit");
  const testRuns = events.filter((e): e is TestRunEvent => e.type === "test_run");

  // Edit displacement: sum of absolute line-distance between consecutive edits
  let displacementSum = 0;
  for (let i = 1; i < edits.length; i++) {
    displacementSum += Math.abs(edits[i].line - edits[i - 1].line);
  }

  // Temporal jitter: stddev of inter-edit time gaps
  const gaps: number[] = [];
  for (let i = 1; i < edits.length; i++) {
    gaps.push(edits[i].timestamp - edits[i - 1].timestamp);
  }
  const jitterMs = stddev(gaps);

  // Total edited lines (insertions + deletions)
  const totalLines = edits.reduce((sum, e) => sum + e.lines_inserted + e.lines_deleted, 0);

  // Test failure ratio
  const totalRuns = testRuns.length;
  const knownResults = testRuns.filter((t) => t.passed !== null);
  const failures = knownResults.filter((t) => t.passed === false).length;
  const failureRatio = totalRuns > 0 ? failures / totalRuns : 0;

  // Entropy score
  const numerator = displacementSum * jitterMs;
  const denominator = Math.log(totalLines + 1) || 1; // avoid division by zero
  const failureBoost = 1 + failureRatio;
  const score = (numerator / denominator) * failureBoost;

  return {
    entropy_score: Math.round(score * 100) / 100,
    edit_displacement_sum: displacementSum,
    temporal_jitter_ms: Math.round(jitterMs),
    test_failure_ratio: Math.round(failureRatio * 100) / 100,
    test_failures_observed: failures,
    test_runs_total: totalRuns,
  };
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
