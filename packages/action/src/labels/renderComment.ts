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
  serverMetrics?: GitDerivedMetrics | null,
): string {
  const a = result.attestation;
  const icon = { high: "\u2705", medium: "\u26a0\ufe0f", low: "\ud83d\udfe1" }[confidence];
  const label = {
    high: "\ud83e\uddd1\u200d\ud83d\udcbb Human",
    medium: "\ud83e\udd16 Cyborg",
    low: "\ud83e\udd16 Bot",
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
| **Tracked by** | ${a.session.signal_source ?? "vscode"}${signalLabel} |
| **Activity level** | ${label} |
| **Active editing time** | ${a.session.dwell_minutes} min across ${a.session.active_files} files |
| **Change spread** | ${a.session.edit_displacement_sum} |
| **Pace variation** | ${a.session.temporal_jitter_ms} ms |
| **Test runs** | ${a.session.test_runs_total} (${a.session.test_failures_observed} failed, ${Math.round(a.session.test_failure_ratio * 100)}% failure rate) |`;

  if (serverMetrics?.hottest_file) {
    body += `\n| **Hottest file** | \`${serverMetrics.hottest_file}\` |`;
  }
  if (serverMetrics?.file_types_summary) {
    body += `\n| **File types** | ${serverMetrics.file_types_summary} |`;
  }
  if (serverMetrics?.add_delete_ratio) {
    body += `\n| **Add/Delete ratio** | ${serverMetrics.add_delete_ratio} |`;
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

  const activityLabel = { high: "\ud83e\uddd1\u200d\ud83d\udcbb Human", medium: "\u26a1 Mixed signals", low: "\ud83e\udd16 Likely automated" }[confidence];
  const churn = serverMetrics.diff_churn ?? 0;
  const commits = serverMetrics.commit_count ?? 0;

  let body = `## ${icon} Contribution Provenance Report (Server-Computed)

| | |
|---|---|
| \ud83d\udce1 **Source** | Server (computed from PR data) |
| ${icon} **Activity** | ${activityLabel} |
| \u23f1\ufe0f **Estimated active time** | ${serverMetrics.dwell_minutes} min across ${serverMetrics.active_files} file(s) |
| \ud83d\udcdd **Commits** | ${commits} |
| \ud83d\udd00 **Diff churn** | ${churn} lines |
| \ud83c\udfaf **Pace variation** | ${serverMetrics.commit_temporal_jitter_ms} ms |`;

  if (serverMetrics.hottest_file) {
    body += `\n| \ud83d\udd25 **Hottest file** | \`${serverMetrics.hottest_file}\` |`;
  }
  if (serverMetrics.file_types_summary) {
    body += `\n| \ud83d\udcc2 **File types** | ${serverMetrics.file_types_summary} |`;
  }
  if (serverMetrics.add_delete_ratio) {
    body += `\n| \u2696\ufe0f **Add/Delete ratio** | ${serverMetrics.add_delete_ratio} |`;
  }

  body += `

> \ud83d\udca1 **Want richer metrics?** Run \`npx provenance doctor --fix\` in your clone, or install the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=caiman.contrib-provenance-vscode) for automatic keystroke-level tracking.

<sub>This report was computed from PR metadata only. Contributor-side attestation provides editing patterns, test runs, and signed proof.</sub>
<!-- provenance-summary-v1 -->`;

  return body.trim();
}

export function renderReminder(_config: ProvenanceYmlConfig): string {
  return `## \ud83d\udccb Contribution Provenance

No attestation found for this PR. This usually means git hooks weren't set up.

### \ud83d\udd27 Quick fix

Run this in your local clone and push again:

\`\`\`sh
npx provenance doctor --fix
\`\`\`

### Why did this happen?

Provenance attaches automatically via a **pre-push git hook**. The hook is installed when:
- \`npm install\` runs and \`@contrib-provenance/cli\` is a devDependency, or
- The [VS Code extension](https://marketplace.visualstudio.com/items?itemName=caiman.contrib-provenance-vscode) detects \`.provenance/config.json\`

If neither happened, the hook is missing and no attestation gets created.

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
