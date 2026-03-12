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

  // Entropy score
  let entropyScore = 0;
  if (commits.length >= 2 && diffChurn > 0) {
    // Multi-commit: temporal spread × file diversity
    const numerator = activeFiles * commitTemporalJitter;
    const denominator = Math.log(diffChurn + 1) || 1;
    const commitBoost = Math.log(commits.length + 1);
    entropyScore = Math.round(((numerator / denominator) * commitBoost) * 100) / 100;
  } else if (commits.length === 1 && diffChurn > 0) {
    // Single commit (squashed PR): score from diff complexity alone.
    // A real contribution touching multiple files with meaningful churn
    // should not be penalized for clean git hygiene.
    const fileBoost = Math.log(activeFiles + 1);
    const churnBoost = Math.log(Math.min(diffChurn, 2000) + 1);
    entropyScore = Math.round((fileBoost * churnBoost) * 100) / 100;
  }

  // Hottest file: file with most total churn
  const hottestFile = files.length > 0
    ? files.reduce((max, f) => (f.additions + f.deletions > max.additions + max.deletions ? f : max), files[0]).filename
    : undefined;

  // File types summary: group by extension
  const extCounts = new Map<string, number>();
  for (const f of files) {
    const ext = f.filename.includes(".") ? "." + f.filename.split(".").pop()! : "(no ext)";
    extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);
  }
  const fileTypesSummary = [...extCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => `${count} ${ext}`)
    .join(", ") || undefined;

  // Add/Delete ratio
  const totalAdditions = files.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0);
  let addDeleteRatio: string | undefined;
  if (totalDeletions === 0 && totalAdditions > 0) {
    addDeleteRatio = "pure additions";
  } else if (totalAdditions === 0 && totalDeletions > 0) {
    addDeleteRatio = "pure deletions";
  } else if (totalDeletions > 0) {
    const ratio = Math.round((totalAdditions / totalDeletions) * 10) / 10;
    addDeleteRatio = ratio >= 1 ? `${ratio}:1 add-heavy` : `1:${Math.round((totalDeletions / totalAdditions) * 10) / 10} delete-heavy`;
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
    hottest_file: hottestFile,
    file_types_summary: fileTypesSummary,
    add_delete_ratio: addDeleteRatio,
  };
}
