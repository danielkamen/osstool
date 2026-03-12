import type { AttestationV1 } from "@contrib-provenance/core";
import type { GitDerivedMetrics } from "@contrib-provenance/core";

export interface CrossValidationCheck {
  field: string;
  passed: boolean;
  detail: string;
}

export interface CrossValidationResult {
  checks: CrossValidationCheck[];
  allPassed: boolean;
  score: number; // 0-1, fraction of checks that passed
}

export function crossValidate(
  attestation: AttestationV1,
  serverMetrics: GitDerivedMetrics,
): CrossValidationResult {
  const checks: CrossValidationCheck[] = [];
  const session = attestation.session;

  // Active files: within 20% tolerance (contributor may have uncommitted edits)
  const fileTolerance = Math.max(1, Math.round(serverMetrics.active_files * 0.2));
  const filesDiff = Math.abs(session.active_files - serverMetrics.active_files);
  checks.push({
    field: "active_files",
    passed: filesDiff <= fileTolerance,
    detail: `contributor=${session.active_files} server=${serverMetrics.active_files} (tolerance=${fileTolerance})`,
  });

  // Commit count: exact match if present
  if (session.commit_count !== undefined) {
    checks.push({
      field: "commit_count",
      passed: session.commit_count === serverMetrics.commit_count,
      detail: `contributor=${session.commit_count} server=${serverMetrics.commit_count}`,
    });
  }

  // Dwell: contributor's should be >= server's (VS Code tracks sub-commit activity)
  // Allow up to 20% below server value (timing differences)
  const dwellFloor = serverMetrics.dwell_minutes * 0.8;
  checks.push({
    field: "dwell_minutes",
    passed: session.dwell_minutes >= dwellFloor,
    detail: `contributor=${session.dwell_minutes} server_min=${Math.round(dwellFloor)}`,
  });

  // Diff churn: within 10% if present
  if (session.diff_churn !== undefined && serverMetrics.diff_churn > 0) {
    const churnTolerance = Math.max(10, Math.round(serverMetrics.diff_churn * 0.1));
    const churnDiff = Math.abs(session.diff_churn - serverMetrics.diff_churn);
    checks.push({
      field: "diff_churn",
      passed: churnDiff <= churnTolerance,
      detail: `contributor=${session.diff_churn} server=${serverMetrics.diff_churn}`,
    });
  }

  const passed = checks.filter((c) => c.passed).length;
  return {
    checks,
    allPassed: checks.every((c) => c.passed),
    score: checks.length > 0 ? passed / checks.length : 1,
  };
}
