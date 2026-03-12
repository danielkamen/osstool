import type { CommandModule } from "yargs";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import {
  SessionStore,
  getProvenanceDir,
  getAttestationPath,
  getRemoteUrl,
  parseRemoteToSlug,
} from "@contrib-provenance/core";

const execFile = promisify(execFileCb);

interface AttachArgs {
  pr: string;
  session?: string;
  attestation?: string;
  dryRun: boolean;
}

async function getGitHubToken(): Promise<string> {
  // Try gh auth token
  try {
    const { stdout } = await execFile("gh", ["auth", "token"]);
    return stdout.trim();
  } catch {
    // Fall through
  }

  // Try GITHUB_TOKEN env
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  throw new Error(
    "GitHub authentication required. Run `gh auth login` or set GITHUB_TOKEN.",
  );
}

function parsePR(prArg: string, remoteSlug: string): { owner: string; repo: string; number: number } {
  // Handle full URL: https://github.com/owner/repo/pull/42
  const urlMatch = prArg.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], number: parseInt(urlMatch[3]) };
  }

  // Handle just a number
  const num = parseInt(prArg);
  if (!isNaN(num)) {
    // Parse owner/repo from remote slug (e.g., "github.com/owner/repo")
    const parts = remoteSlug.split("/");
    if (parts.length >= 3) {
      return { owner: parts[1], repo: parts[2], number: num };
    }
  }

  throw new Error(`Invalid PR argument: "${prArg}". Use a PR number or full URL.`);
}

export const attachCommand: CommandModule<object, AttachArgs> = {
  command: "attach <pr>",
  describe: "Attach an activity snapshot to a pull request",
  builder: (yargs) =>
    yargs
      .positional("pr", {
        type: "string",
        describe: "PR number or URL",
        demandOption: true,
      })
      .option("session", {
        type: "string",
        describe: "Session UUID (defaults to most recently exported session)",
      })
      .option("attestation", {
        type: "string",
        describe: "Path to attestation file",
      })
      .option("dry-run", {
        type: "boolean",
        default: false,
        describe: "Print what would be uploaded without uploading",
      }) as unknown as import("yargs").Argv<AttachArgs>,
  handler: async (argv) => {
    const cwd = process.cwd();

    if (!existsSync(getProvenanceDir(cwd))) {
      console.error("Error: Not initialized. Run `provenance init` first.");
      process.exit(1);
    }

    // Find attestation file
    let attestationPath: string;
    if (argv.attestation) {
      attestationPath = argv.attestation;
    } else {
      const sessions = await SessionStore.listSessions(cwd);
      let targetId: string;

      if (argv.session) {
        targetId = argv.session;
      } else {
        const exported = sessions
          .filter((s) => s.status === "exported")
          .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""));
        if (exported.length === 0) {
          console.error("Error: No exported sessions found. Run `provenance export` first.");
          process.exit(1);
        }
        targetId = exported[0].session_id;
      }

      attestationPath = getAttestationPath(cwd, targetId);
    }

    if (!existsSync(attestationPath)) {
      console.error(`Error: Attestation file not found: ${attestationPath}`);
      process.exit(1);
    }

    const attestationJson = await readFile(attestationPath, "utf-8");
    const attestation = JSON.parse(attestationJson);

    // Resolve PR info
    let remoteSlug: string;
    try {
      const remoteUrl = await getRemoteUrl(cwd);
      remoteSlug = parseRemoteToSlug(remoteUrl);
    } catch {
      console.error("Error: No GitHub remote found. Ensure `origin` points to GitHub.");
      process.exit(1);
    }

    const prInfo = parsePR(argv.pr, remoteSlug);

    // Format the visible summary + hidden machine-readable data
    const session = attestation.session ?? {};
    const signed = attestation.signature ? "Yes" : "No";
    const disclosure = attestation.disclosure ?? "None";
    const startedAt = session.started_at ? new Date(session.started_at).toUTCString() : "Unknown";
    const endedAt = session.ended_at ? new Date(session.ended_at).toUTCString() : "Unknown";
    const editors = (session.editors_used ?? []).join(", ") || "Unknown";

    const commentBody = [
      `## Contribution Provenance`,
      ``,
      `| Metric | Value |`,
      `| --- | --- |`,
      `| **Session** | ${startedAt} \u2192 ${endedAt} |`,
      `| **Active editing time** | ${session.dwell_minutes ?? "?"} min |`,
      `| **Files touched** | ${session.active_files ?? "?"} |`,
      `| **Edit complexity** | ${session.entropy_score ?? 0} |`,
      `| **Change spread** | ${session.edit_displacement_sum ?? 0} |`,
      `| **Pace variation** | ${session.temporal_jitter_ms ?? 0} ms |`,
      `| **Test runs** | ${session.test_runs_total ?? 0} (${session.test_failures_observed ?? 0} failed) |`,
      `| **Editor** | ${editors} |`,
      `| **AI disclosure** | ${disclosure} |`,
      `| **Signed** | ${signed} |`,
      ``,
      `<details>`,
      `<summary>Raw attestation JSON</summary>`,
      ``,
      "```json",
      JSON.stringify(attestation, null, 2),
      "```",
      ``,
      `</details>`,
      ``,
      `<!-- provenance-attestation-v1 ${JSON.stringify(attestation)} -->`,
    ].join("\n");

    if (argv.dryRun) {
      console.log("DRY RUN — Would post to:");
      console.log(`  PR: ${prInfo.owner}/${prInfo.repo}#${prInfo.number}`);
      console.log("");
      console.log("Comment body:");
      console.log(commentBody);
      return;
    }

    // Get token and post
    const token = await getGitHubToken();

    try {
      const { stdout } = await execFile("gh", [
        "api",
        `repos/${prInfo.owner}/${prInfo.repo}/issues/${prInfo.number}/comments`,
        "-f", `body=${commentBody}`,
        "--method", "POST",
      ], {
        env: { ...process.env, GH_TOKEN: token },
      });

      console.log(`Snapshot posted to ${prInfo.owner}/${prInfo.repo}#${prInfo.number}`);
    } catch (err) {
      console.error(`Failed to post snapshot: ${(err as Error).message}`);
      console.error(`Snapshot saved at: ${attestationPath}`);
      console.error("Upload manually or retry.");
      process.exit(1);
    }
  },
};
