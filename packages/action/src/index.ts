import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadRepoConfig } from "./config/loadRepoConfig.js";
import { findAttestation } from "./notes/readProvenanceNote.js";
import { verifyAttestation } from "./verification/verifyAttestation.js";
import { crossValidate } from "./verification/crossValidate.js";
import { computeServerMetrics } from "./metrics/computeServerMetrics.js";
import { computeConfidence } from "./labels/computeConfidence.js";
import {
  renderComment,
  renderReminder,
  renderServerOnlyReport,
  upsertSummaryComment,
  applyLabel,
} from "./labels/renderComment.js";

async function run(): Promise<void> {
  try {
    const token = core.getInput("github-token");
    const octokit = github.getOctokit(token);
    const context = github.context;

    // 1. Determine PR number
    let prNumber: number;
    if (context.eventName === "pull_request") {
      prNumber = context.payload.pull_request!.number;
    } else if (context.eventName === "issue_comment") {
      prNumber = context.payload.issue!.number;
    } else {
      core.info("Unsupported event type, skipping.");
      return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;

    // 2. Load .github/provenance.yml from the repo
    const config = await loadRepoConfig(octokit, owner, repo);
    if (!config) {
      core.info("No .github/provenance.yml found, skipping.");
      return;
    }

    // 3. Check bypass rules
    const { data: pr } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    const prLabels = pr.labels.map((l: any) => l.name);
    const prAuthor = pr.user?.login ?? "";
    const headSha = pr.head.sha;

    if (config.bypass.users.includes(prAuthor)) {
      core.info(`User ${prAuthor} is in bypass list, skipping.`);
      return;
    }
    if (config.bypass.labels.some((l: string) => prLabels.includes(l))) {
      core.info("PR has a bypass label, skipping.");
      return;
    }

    // 4. Compute server-side metrics (for cross-validation and fallback)
    let serverMetrics = null;
    if (config.server_metrics) {
      const { data: commits } = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 250,
      });
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 300,
      });
      serverMetrics = computeServerMetrics({ commits, files });
    }

    // 5. Search for attestation: git notes first, then PR comments
    const attestation = await findAttestation(octokit, owner, repo, prNumber, headSha);

    if (!attestation) {
      // No attestation found
      if (serverMetrics && config.no_attestation_action !== "ignore") {
        // Post server-computed report
        const confidence = computeConfidence({
          metrics: { ...serverMetrics, test_runs_total: 0, signal_source: "server" as const },
          config,
          verificationPassed: true,
        });

        if (config.notifications.comment_on_pr && config.no_attestation_action === "remind") {
          const report = renderServerOnlyReport(serverMetrics, confidence);
          await upsertSummaryComment(octokit, owner, repo, prNumber, report);
        }

        const labelName = config.labels[confidence] ?? `provenance-${confidence}`;
        await applyLabel(octokit, owner, repo, prNumber, labelName);
        core.setOutput("confidence", confidence);
        core.setOutput("verified", "false");
        core.setOutput("signal_source", "server");
      } else if (config.no_attestation_action === "remind" && config.notifications.comment_on_pr) {
        const reminder = renderReminder(config);
        await upsertSummaryComment(octokit, owner, repo, prNumber, reminder);
        if (config.labels.none) {
          await applyLabel(octokit, owner, repo, prNumber, config.labels.none);
        }
        core.setOutput("confidence", "none");
        core.setOutput("verified", "false");
      }
      return;
    }

    // 6. Run verification pipeline
    const { data: prCommits } = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 250,
    });

    const result = await verifyAttestation(attestation, {
      owner,
      repo,
      prNumber,
      commits: prCommits,
      octokit,
      prAuthor,
    });

    // 7. Cross-validate if enabled and server metrics available
    let crossValidationScore: number | undefined;
    if (config.cross_validate && serverMetrics) {
      const cvResult = crossValidate(attestation, serverMetrics);
      crossValidationScore = cvResult.score;
      core.info(`Cross-validation: ${cvResult.score.toFixed(2)} (${cvResult.checks.length} checks)`);
    }

    // 8. Compute confidence
    const confidence = computeConfidence({
      metrics: attestation.session,
      config,
      verificationPassed: result.allPassed,
      crossValidationScore,
    });

    // 9. Post summary comment
    if (config.notifications.comment_on_pr) {
      const comment = renderComment(result, confidence, config);
      await upsertSummaryComment(octokit, owner, repo, prNumber, comment);
    }

    // 10. Apply labels
    const labelName = config.labels[confidence] ?? `provenance-${confidence}`;
    await applyLabel(octokit, owner, repo, prNumber, labelName);

    // 11. Set outputs
    core.setOutput("confidence", confidence);
    core.setOutput("verified", result.allPassed.toString());
    core.setOutput("signal_source", attestation.session.signal_source ?? "vscode");
  } catch (error) {
    core.setFailed(
      `Action failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

run();
