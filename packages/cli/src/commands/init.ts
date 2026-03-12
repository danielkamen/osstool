import type { CommandModule } from "yargs";
import { existsSync } from "node:fs";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import {
  isGitRepo,
  getRemoteUrl,
  parseRemoteToSlug,
  getProvenanceDir,
  getSessionsDir,
  getAttestationsDir,
  getConfigPath,
  isoNow,
} from "@contrib-provenance/core";
import type { ProjectConfig } from "@contrib-provenance/core";
import { PRE_PUSH_HOOK } from "../hooks/pre-push.js";

interface InitArgs {
  signing: "gpg" | "ssh" | "auto";
  hooks: boolean;
  force: boolean;
}

export const initCommand: CommandModule<object, InitArgs> = {
  command: "init",
  describe: "Initialize provenance tracking in this repository",
  builder: (yargs) =>
    yargs
      .option("signing", {
        type: "string",
        choices: ["gpg", "ssh", "auto"] as const,
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
      "sessions/\nattestations/\n",
    );

    // Get remote
    let remote = "unknown";
    try {
      const remoteUrl = await getRemoteUrl(cwd);
      remote = parseRemoteToSlug(remoteUrl);
    } catch {
      // No remote configured
    }

    // Write config
    const config: ProjectConfig = {
      version: 1,
      remote,
      initialized_at: isoNow(),
      signing_method: argv.signing,
      hooks: {
        pre_push: false,
      },
    };
    await writeFile(getConfigPath(cwd), JSON.stringify(config, null, 2));

    // Install pre-push hook placeholder
    if (argv.hooks) {
      const hookPath = join(cwd, ".git", "hooks", "pre-push");
      const hookContent = PRE_PUSH_HOOK;
      await mkdir(join(cwd, ".git", "hooks"), { recursive: true });
      await writeFile(hookPath, hookContent);
      await chmod(hookPath, 0o755);
      config.hooks.pre_push = true;
      await writeFile(getConfigPath(cwd), JSON.stringify(config, null, 2));
    }

    console.log(`Provenance initialized in ${provDir}`);
    console.log(`  Remote: ${remote}`);
    console.log(`  Signing: ${argv.signing}`);
    if (argv.hooks) {
      console.log("  Pre-push hook: installed");
    }
  },
};
