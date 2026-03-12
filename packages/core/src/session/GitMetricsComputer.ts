import {
  getMergeBase,
  getCommitLog,
  getDiffNumstat,
  getDefaultBranch,
} from "../util/git.js";
import { IDLE_THRESHOLD_MS } from "../config/defaults.js";
import type { GitDerivedMetrics } from "./types.js";

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeGitEntropy(params: {
  commitCount: number;
  diffChurn: number;
  fileCount: number;
  temporalJitter: number;
}): number {
  const { commitCount, diffChurn, fileCount, temporalJitter } = params;
  if (commitCount < 2 || diffChurn === 0) return 0;

  // Adapted entropy: file dispersion * temporal jitter / log(churn)
  const numerator = fileCount * temporalJitter;
  const denominator = Math.log(diffChurn + 1) || 1;
  const commitBoost = Math.log(commitCount + 1);
  const score = (numerator / denominator) * commitBoost;

  return Math.round(score * 100) / 100;
}

export async function computeGitMetrics(
  repoRoot: string,
  baseBranch?: string,
): Promise<GitDerivedMetrics> {
  const resolvedBase = baseBranch ?? (await getDefaultBranch(repoRoot));
  const mergeBase = await getMergeBase(repoRoot, resolvedBase);
  const commits = await getCommitLog(repoRoot, mergeBase);
  const diffStats = await getDiffNumstat(repoRoot, mergeBase);

  // Dwell: time span between first and last commit, minus idle gaps
  let dwellMinutes = 0;
  if (commits.length >= 2) {
    const timestamps = commits
      .map((c) => new Date(c.timestamp).getTime())
      .sort((a, b) => a - b);

    let activeMs = 0;
    for (let i = 1; i < timestamps.length; i++) {
      const gap = timestamps[i] - timestamps[i - 1];
      if (gap < IDLE_THRESHOLD_MS) {
        activeMs += gap;
      }
    }
    dwellMinutes = Math.round(activeMs / 60_000);
  }

  // Active files
  const activeFiles = new Set(diffStats.map((d) => d.file)).size;

  // Diff churn
  const diffChurn = diffStats.reduce((sum, d) => sum + d.added + d.deleted, 0);

  // Commit temporal jitter
  const timestamps = commits
    .map((c) => new Date(c.timestamp).getTime())
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    gaps.push(timestamps[i] - timestamps[i - 1]);
  }
  const commitTemporalJitter = Math.round(stddev(gaps));

  // Entropy score
  const entropyScore = computeGitEntropy({
    commitCount: commits.length,
    diffChurn,
    fileCount: activeFiles,
    temporalJitter: commitTemporalJitter,
  });

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
