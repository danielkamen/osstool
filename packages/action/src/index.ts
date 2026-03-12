import * as core from "@actions/core";
import * as github from "@actions/github";
import { loadRepoConfig } from "./config/loadRepoConfig.js";
import { findAttestationInComments, verifyAttestation } from "./verification/verifyAttestation.js";
import { computeConfidence } from "./labels/computeConfidence.js";
import {
  renderComment,
  renderReminder,
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

    if (config.bypass.users.includes(prAuthor)) {
      core.info(`User ${prAuthor} is in bypass list, skipping.`);
      return;
    }
    if (config.bypass.labels.some((l: string) => prLabels.includes(l))) {
      core.info("PR has a bypass label, skipping.");
      return;
    }

    // 4. Search PR comments for attestation
    const allComments: any[] = [];
    let page = 1;
    while (true) {
      const { data: comments } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
        per_page: 100,
        page,
      });
      allComments.push(...comments);
      if (comments.length < 100) break;
      page++;
    }

    const attestation = findAttestationInComments(allComments);

    if (!attestation) {
      // No attestation found
      if (config.attestation_reminder && config.notifications.comment_on_pr) {
        const reminder = renderReminder(config);
        await upsertSummaryComment(octokit, owner, repo, prNumber, reminder);
      }
      if (config.labels.none) {
        await applyLabel(octokit, owner, repo, prNumber, config.labels.none);
      }
      core.setOutput("confidence", "none");
      core.setOutput("verified", "false");
      return;
    }

    // 5. Run verification pipeline
    const { data: commits } = await octokit.rest.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 250,
    });

    const result = await verifyAttestation(attestation, {
      owner,
      repo,
      prNumber,
      commits,
      octokit,
      prAuthor,
    });

    // 6. Compute confidence
    const confidence = computeConfidence({
      metrics: attestation.session,
      config,
      verificationPassed: result.allPassed,
    });

    // 7. Post summary comment
    if (config.notifications.comment_on_pr) {
      const comment = renderComment(result, confidence, config);
      await upsertSummaryComment(octokit, owner, repo, prNumber, comment);
    }

    // 8. Apply labels
    const labelName = config.labels[confidence] ?? `provenance-${confidence}`;
    await applyLabel(octokit, owner, repo, prNumber, labelName);

    // 9. Set outputs
    core.setOutput("confidence", confidence);
    core.setOutput("verified", result.allPassed.toString());
  } catch (error) {
    core.setFailed(
      `Action failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

run();
