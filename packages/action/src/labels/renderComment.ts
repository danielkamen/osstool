import type { Check, AttestationV1 } from "@contrib-provenance/core";
import type { GitDerivedMetrics } from "@contrib-provenance/core";
import type { ConfidenceLevel } from "./computeConfidence.js";
import type { ProvenanceYmlConfig } from "../config/configSchema.js";

interface RenderInput {
  checks: Check[];
  allPassed: boolean;
  attestation: AttestationV1;
}

export function renderComment(
  result: RenderInput,
  confidence: ConfidenceLevel,
  _config: ProvenanceYmlConfig,
): string {
  const a = result.attestation;
  const icon = { high: "\u2705", medium: "\u26a0\ufe0f", low: "\ud83d\udfe1" }[confidence];
  const label = {
    high: "HIGH entropy signal",
    medium: "MEDIUM entropy signal",
    low: "LOW entropy signal",
  }[confidence];

  const signalLabel = a.session.signal_source
    ? ` (${a.session.signal_source})`
    : "";
  const sigLine = a.signature_format
    ? `Verified (${a.signature_format.toUpperCase()})`
    : "Unsigned";

  let body = `## ${icon} Contribution Provenance Report

| Field | Value |
|-------|-------|
| **Attestation** | ${result.allPassed ? sigLine : "Verification issues (see below)"} |
| **Signal source** | ${a.session.signal_source ?? "vscode"}${signalLabel} |
| **Review confidence** | ${label} |
| **Active editing time** | ${a.session.dwell_minutes} min across ${a.session.active_files} files |
| **Entropy score** | ${a.session.entropy_score} |
| **Edit displacement** | ${a.session.edit_displacement_sum} |
| **Temporal jitter** | ${a.session.temporal_jitter_ms} ms |
| **Test runs** | ${a.session.test_runs_total} (${a.session.test_failures_observed} failed, ${Math.round(a.session.test_failure_ratio * 100)}% failure rate) |`;

  if (a.session.commit_count !== undefined) {
    body += `\n| **Commits** | ${a.session.commit_count} |`;
  }
  if (a.session.diff_churn !== undefined) {
    body += `\n| **Diff churn** | ${a.session.diff_churn} lines |`;
  }

  body += `\n| **AI disclosure** | ${a.disclosure ?? "None provided"} |
| **Tool version** | contrib-provenance v${a.tool_version} |
`;

  if (!result.allPassed) {
    body += "\n### Verification Issues\n\n";
    for (const check of result.checks) {
      if (!check.passed) {
        body += `- \u274c **${check.name}**: ${check.detail ?? "Failed"}\n`;
      }
    }
    body += "\n";
  }

  body += `\n<sub>\ud83d\udd0d [What is this?](https://contrib-provenance.dev/docs/what-is-this) \u00b7 Attestation is voluntary. No inference is made about PRs without attestation.</sub>
<!-- provenance-summary-v1 -->`;

  return body.trim();
}

export function renderServerOnlyReport(
  serverMetrics: GitDerivedMetrics,
  confidence: ConfidenceLevel,
): string {
  const icon = { high: "\u2705", medium: "\u26a0\ufe0f", low: "\ud83d\udfe1" }[confidence];

  return `## ${icon} Contribution Provenance Report (Server-Computed)

| Field | Value |
|-------|-------|
| **Signal source** | server (computed from PR data) |
| **Review confidence** | ${confidence.toUpperCase()} |
| **Estimated active time** | ${serverMetrics.dwell_minutes} min across ${serverMetrics.active_files} files |
| **Entropy score** | ${serverMetrics.entropy_score} |
| **Commits** | ${serverMetrics.commit_count} |
| **Diff churn** | ${serverMetrics.diff_churn} lines |

<sub>This report was computed from PR metadata. Install \`@contrib-provenance/cli\` as a devDependency for richer contributor-side metrics.</sub>
<!-- provenance-summary-v1 -->`.trim();
}

export function renderReminder(_config: ProvenanceYmlConfig): string {
  return `## \ud83d\udccb Contribution Provenance

No attestation found for this PR.

Contribution provenance is **automatic** when \`@contrib-provenance/cli\` is installed as a devDependency. Just \`npm install\` and push normally \u2014 provenance attaches automatically via git hooks.

<sub>This is a gentle reminder, not a requirement. PRs without attestation are reviewed normally.</sub>
<!-- provenance-summary-v1 -->`.trim();
}

const SUMMARY_MARKER = "<!-- provenance-summary-v1 -->";

export async function upsertSummaryComment(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  // Find existing summary comment
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const existing = comments.find((c: any) =>
    c.body?.includes(SUMMARY_MARKER),
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }
}

export async function applyLabel(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number,
  label: string,
): Promise<void> {
  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: [label],
    });
  } catch {
    // Label may not exist; try to create it
    try {
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: label,
        color: "0E8A16",
      });
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels: [label],
      });
    } catch {
      // Silently fail if label creation fails
    }
  }
}
