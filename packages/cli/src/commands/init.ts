import type { CommandModule } from "yargs";
import { existsSync } from "node:fs";
import { mkdir, writeFile, chmod } from "node:fs/promises";
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

interface InitArgs {
  signing: "gpg" | "ssh" | "auto" | "none";
  hooks: boolean;
  force: boolean;
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
    };
    await writeFile(getConfigPath(cwd), JSON.stringify(config, null, 2));

    // Install hooks
    if (argv.hooks) {
      const hooksDir = join(cwd, ".git", "hooks");
      await mkdir(hooksDir, { recursive: true });

      // Pre-push hook
      const prePushPath = join(hooksDir, "pre-push");
      await writeFile(prePushPath, PRE_PUSH_HOOK);
      await chmod(prePushPath, 0o755);
      config.hooks.pre_push = true;

      // Post-commit hook
      const postCommitPath = join(hooksDir, "post-commit");
      await writeFile(postCommitPath, POST_COMMIT_HOOK);
      await chmod(postCommitPath, 0o755);
      config.hooks.post_commit = true;

      await writeFile(getConfigPath(cwd), JSON.stringify(config, null, 2));
    }

    console.log(`Provenance initialized in ${provDir}`);
    console.log(`  Remote: ${remote}`);
    console.log(`  Base branch: ${baseBranch}`);
    console.log(`  Signing: ${argv.signing}`);
    if (argv.hooks) {
      console.log("  Hooks: pre-push, post-commit installed");
    }
  },
};
