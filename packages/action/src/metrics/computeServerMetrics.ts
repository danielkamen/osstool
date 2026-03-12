import type { GitDerivedMetrics } from "@contrib-provenance/core";

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export interface ServerMetricsInput {
  commits: Array<{
    sha: string;
    commit: {
      author: { date?: string } | null;
      committer: { date?: string } | null;
    };
  }>;
  files: Array<{
    filename: string;
    additions: number;
    deletions: number;
  }>;
}

export function computeServerMetrics(input: ServerMetricsInput): GitDerivedMetrics {
  const { commits, files } = input;

  // Dwell: time from first to last commit, minus idle gaps > 5 min
  const IDLE_THRESHOLD_MS = 5 * 60 * 1000;
  const timestamps = commits
    .map((c) => {
      const dateStr = c.commit.author?.date ?? c.commit.committer?.date;
      return dateStr ? new Date(dateStr).getTime() : 0;
    })
    .filter((t) => t > 0)
    .sort((a, b) => a - b);

  let dwellMs = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1];
    if (gap < IDLE_THRESHOLD_MS) {
      dwellMs += gap;
    }
  }
  const dwellMinutes = Math.round(dwellMs / 60_000);

  // Active files
  const activeFiles = new Set(files.map((f) => f.filename)).size;

  // Diff churn
  const diffChurn = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);

  // Commit temporal jitter
  const gaps: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    gaps.push(timestamps[i] - timestamps[i - 1]);
  }
  const commitTemporalJitter = Math.round(stddev(gaps));

  // Entropy score (same adapted formula as core GitMetricsComputer)
  let entropyScore = 0;
  if (commits.length >= 2 && diffChurn > 0) {
    const numerator = activeFiles * commitTemporalJitter;
    const denominator = Math.log(diffChurn + 1) || 1;
    const commitBoost = Math.log(commits.length + 1);
    entropyScore = Math.round(((numerator / denominator) * commitBoost) * 100) / 100;
  }

  return {
    signal_source: "git",
    dwell_minutes: dwellMinutes,
    active_files: activeFiles,
    commit_count: commits.length,
    diff_churn: diffChurn,
    entropy_score: entropyScore,
    commit_temporal_jitter_ms: commitTemporalJitter,
    editors_used: [],
  };
}
