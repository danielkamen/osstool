import type { Check, AttestationV1 } from "@contrib-provenance/core";
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
  const icon = { high: "✅", medium: "⚠️", low: "🟡" }[confidence];
  const label = {
    high: "HIGH iteration signal",
    medium: "MEDIUM iteration signal",
    low: "LOW iteration signal",
  }[confidence];

  let body = `## ${icon} Contribution Provenance Report

| Field | Value |
|-------|-------|
| **Attestation** | ${result.allPassed ? "Verified" : "Verification issues (see below)"} (${a.signature_format}) |
| **Review confidence** | ${label} |
| **Active editing time** | ${a.session.dwell_minutes} min across ${a.session.active_files} files |
| **Iteration cycles** | ${a.session.iteration_cycles} distinct revision phases |
| **Post-insert edit ratio** | ${Math.round(a.session.post_insert_edit_ratio * 100)}% of inserted lines subsequently edited |
| **Test runs observed** | ${a.session.test_runs_observed} |
| **Largest paste burst** | ${a.session.largest_paste_lines} lines |
| **AI disclosure** | ${a.disclosure ?? "None provided"} |
| **Tool version** | contrib-provenance v${a.tool_version} |
`;

  if (!result.allPassed) {
    body += "\n### Verification Issues\n\n";
    for (const check of result.checks) {
      if (!check.passed) {
        body += `- ❌ **${check.name}**: ${check.detail ?? "Failed"}\n`;
      }
    }
    body += "\n";
  }

  body += `\n<sub>🔍 [What is this?](https://contrib-provenance.dev/docs/what-is-this) · Attestation is voluntary. No inference is made about PRs without attestation.</sub>
<!-- provenance-summary-v1 -->`;

  return body.trim();
}

export function renderReminder(config: ProvenanceYmlConfig): string {
  return `## 📋 Contribution Provenance

No attestation found for this PR.

Contribution provenance attestation is **optional** and helps reviewers understand your development process. To add one:

1. Install: \`npm install -g @contrib-provenance/cli\`
2. Track: \`provenance session start\` → make your changes → \`provenance session end\`
3. Export: \`provenance export\`
4. Attach: \`provenance attach <PR-number>\`

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
