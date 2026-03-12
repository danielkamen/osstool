import type { CommandModule } from "yargs";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isGitRepo,
  getRemoteUrl,
  parseRemoteToSlug,
  getDefaultBranch,
  getProvenanceDir,
  getSessionsDir,
  getAttestationsDir,
  getConfigPath,
  isoNow,
} from "@contrib-provenance/core";
import type { ProjectConfig } from "@contrib-provenance/core";
import { PRE_PUSH_HOOK, POST_COMMIT_HOOK } from "../hooks/pre-push.js";
import {
  writeProvenanceYml,
  writeWorkflow,
} from "../util/scaffoldGitHub.js";
import { addDevDependency } from "../util/packageManager.js";
import { installHook } from "../util/installHook.js";

interface InitArgs {
  signing: "gpg" | "ssh" | "auto" | "none";
  hooks: boolean;
  force: boolean;
  minimal: boolean;
  "server-only": boolean;
  "skip-install": boolean;
  "base-branch"?: string;
}

export const initCommand: CommandModule<object, InitArgs> = {
  command: "init",
  describe: "Initialize provenance tracking in this repository",
  builder: (yargs) =>
    yargs
      .option("signing", {
        type: "string",
        choices: ["gpg", "ssh", "auto", "none"] as const,
        default: "auto" as const,
        describe: "Signing method",
      })
      .option("hooks", {
        type: "boolean",
        default: true,
        describe: "Install git hooks",
      })
      .option("force", {
        type: "boolean",
        default: false,
        describe: "Reinitialize even if .provenance/ exists",
      })
      .option("minimal", {
        type: "boolean",
        default: false,
        describe:
          "Only create .provenance/ and hooks — skip GitHub Action setup",
      })
      .option("server-only", {
        type: "boolean",
        default: false,
        describe:
          "Only generate GitHub Action files — no .provenance/, hooks, or devDependency. Ideal for non-npm repos.",
      })
      .option("skip-install", {
        type: "boolean",
        default: false,
        describe: "Skip adding @contrib-provenance/cli as a devDependency",
      })
      .option("base-branch", {
        type: "string",
        describe: "Base branch to compare against (auto-detected if omitted)",
      }),
  handler: async (argv) => {
    const cwd = process.cwd();

    if (!isGitRepo(cwd)) {
      console.error("Error: Not a git repository. Run `git init` first.");
      process.exit(1);
    }

    const results: string[] = [];

    // --- Server-only mode: just the GitHub Action files ---
    if (argv["server-only"]) {
      const yml = await writeProvenanceYml(cwd, argv.force);
      if (yml.created) {
        results.push("  \u2713 .github/provenance.yml");
      } else {
        results.push("  - .github/provenance.yml (already exists)");
      }

      const wf = await writeWorkflow(cwd, argv.force);
      if (wf.created) {
        results.push("  \u2713 .github/workflows/provenance.yml");
      } else {
        results.push("  - .github/workflows/provenance.yml (already exists)");
      }

      console.log("\nProvenance initialized (server-only):\n");
      for (const line of results) {
        console.log(line);
      }

      console.log("\nThe GitHub Action will score PRs using server-side metrics");
      console.log("(commit patterns, file diffs, temporal analysis).");
      console.log("No client-side tooling required for contributors.\n");
      console.log("Next steps:");
      console.log("  1. Commit the generated files and push");
      console.log("  2. PRs will be automatically scored and labeled");
      return;
    }

    // --- Full mode ---
    const provDir = getProvenanceDir(cwd);
    if (existsSync(provDir) && !argv.force) {
      console.error(
        "Error: .provenance/ already exists. Use --force to reinitialize.",
      );
      process.exit(1);
    }

    // Create directories
    await mkdir(getSessionsDir(cwd), { recursive: true });
    await mkdir(getAttestationsDir(cwd), { recursive: true });

    // Write .gitignore — keep config.json committed so contributors
    // get automatic VS Code extension activation on clone
    await writeFile(
      join(provDir, ".gitignore"),
      "sessions/\nattestations/\ncheckpoint-*\n",
    );

    // Get remote
    let remote = "unknown";
    try {
      const remoteUrl = await getRemoteUrl(cwd);
      remote = parseRemoteToSlug(remoteUrl);
    } catch {
      // No remote configured
    }

    // Detect base branch
    let baseBranch = argv["base-branch"] ?? "main";
    if (!argv["base-branch"]) {
      try {
        baseBranch = await getDefaultBranch(cwd);
      } catch {
        // Keep default
      }
    }

    // Write config
    const config: ProjectConfig = {
      version: 1,
      remote,
      initialized_at: isoNow(),
      signing_method: argv.signing,
      hooks: {
        pre_push: false,
        post_commit: false,
      },
      base_branch: baseBranch,
      init_mode: argv.minimal ? "minimal" : "full",
    };
    await writeFile(getConfigPath(cwd), JSON.stringify(config, null, 2));

    // Install hooks (chaining with existing hooks if present)
    if (argv.hooks) {
      const hooksDir = join(cwd, ".git", "hooks");
      await mkdir(hooksDir, { recursive: true });

      await installHook(hooksDir, "pre-push", PRE_PUSH_HOOK);
      config.hooks.pre_push = true;

      await installHook(hooksDir, "post-commit", POST_COMMIT_HOOK);
      config.hooks.post_commit = true;

      await writeFile(getConfigPath(cwd), JSON.stringify(config, null, 2));
    }

    results.push("  \u2713 .provenance/config.json");

    if (argv.hooks) {
      results.push("  \u2713 Git hooks (pre-push, post-commit)");
    }

    // GitHub integration (unless --minimal)
    if (!argv.minimal) {
      const yml = await writeProvenanceYml(cwd, argv.force);
      if (yml.created) {
        results.push("  \u2713 .github/provenance.yml");
      } else {
        results.push("  - .github/provenance.yml (already exists)");
      }

      const wf = await writeWorkflow(cwd, argv.force);
      if (wf.created) {
        results.push("  \u2713 .github/workflows/provenance.yml");
      } else {
        results.push("  - .github/workflows/provenance.yml (already exists)");
      }

      if (!argv["skip-install"]) {
        const installed = await addDevDependency(cwd);
        if (installed) {
          results.push("  \u2713 @contrib-provenance/cli added as devDependency");
        } else {
          results.push(
            "  - Could not add devDependency (no package.json found or install failed)",
          );
        }
      }
    }

    console.log("\nProvenance initialized:\n");
    for (const line of results) {
      console.log(line);
    }

    console.log("\nNext steps:");
    console.log("  1. Commit the generated files and push");
    console.log(
      "  2. Contributors just clone + npm install \u2014 tracking is automatic",
    );
  },
};
