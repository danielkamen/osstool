import type { CommandModule } from "yargs";
import { existsSync } from "node:fs";
import {
  isGitRepo,
  getProvenanceDir,
  getSessionsDir,
  getAttestationsDir,
  getConfigPath,
  getGitHooksDir,
  isHookInstalled,
  ensureProvenanceSetup,
} from "@contrib-provenance/core";

interface DoctorArgs {
  fix: boolean;
}

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export const doctorCommand: CommandModule<object, DoctorArgs> = {
  command: "doctor",
  describe: "Diagnose provenance setup and auto-fix issues",
  builder: (yargs) =>
    yargs.option("fix", {
      type: "boolean",
      default: false,
      describe: "Automatically fix detected issues",
    }),
  handler: async (argv) => {
    const cwd = process.cwd();
    const checks: CheckResult[] = [];

    // 1. Git repo
    const isRepo = isGitRepo(cwd);
    checks.push({
      name: "Git repository",
      passed: isRepo,
      detail: isRepo ? "Found .git/" : "Not a git repository",
    });
    if (!isRepo) {
      printResults(checks);
      return;
    }

    // 2. Config file
    const configPath = getConfigPath(cwd);
    const hasConfig = existsSync(configPath);
    checks.push({
      name: ".provenance/config.json",
      passed: hasConfig,
      detail: hasConfig
        ? "Found"
        : "Missing — run `npx provenance init` to create it",
    });

    // 3. Sessions directory
    const sessionsDir = getSessionsDir(cwd);
    const hasSessions = existsSync(sessionsDir);
    checks.push({
      name: ".provenance/sessions/",
      passed: hasSessions,
      detail: hasSessions ? "Found" : "Missing",
    });

    // 4. Attestations directory
    const attestationsDir = getAttestationsDir(cwd);
    const hasAttestations = existsSync(attestationsDir);
    checks.push({
      name: ".provenance/attestations/",
      passed: hasAttestations,
      detail: hasAttestations ? "Found" : "Missing",
    });

    // 5. Git hooks
    const hooksDir = await getGitHooksDir(cwd);
    const hasPrePush = isHookInstalled(hooksDir, "pre-push");
    checks.push({
      name: "pre-push hook",
      passed: hasPrePush,
      detail: hasPrePush
        ? "Installed with contrib-provenance"
        : "Missing or does not contain contrib-provenance",
    });

    const hasPostCommit = isHookInstalled(hooksDir, "post-commit");
    checks.push({
      name: "post-commit hook",
      passed: hasPostCommit,
      detail: hasPostCommit
        ? "Installed with contrib-provenance"
        : "Missing or does not contain contrib-provenance",
    });

    // 6. Check for VS Code extension session data
    const provDir = getProvenanceDir(cwd);
    const hasCheckpointTrigger = existsSync(`${provDir}/checkpoint-trigger`);
    checks.push({
      name: "VS Code extension",
      passed: true, // informational only
      detail: hasCheckpointTrigger
        ? "Active (checkpoint trigger detected)"
        : "No active session detected (install contrib-provenance-vscode extension for richer metrics)",
    });

    printResults(checks);

    // Auto-fix if requested
    const failures = checks.filter((c) => !c.passed);
    if (failures.length > 0 && argv.fix) {
      if (!hasConfig) {
        console.log(
          "\nCannot auto-fix: .provenance/config.json is missing.",
        );
        console.log("Run `npx provenance init` first to initialize the project.");
        return;
      }

      console.log("\nFixing issues...\n");
      try {
        const status = await ensureProvenanceSetup(cwd);
        if (status.directoriesCreated) {
          console.log("  \u2713 Created missing directories");
        }
        if (status.hooksInstalled) {
          console.log("  \u2713 Installed missing git hooks");
        }
        console.log("\nDone! Run `npx provenance doctor` again to verify.");
      } catch (err: any) {
        console.error(`\nFix failed: ${err?.message ?? "unknown error"}`);
      }
    } else if (failures.length > 0 && !argv.fix) {
      console.log(`\nFound ${failures.length} issue(s). Run \`npx provenance doctor --fix\` to auto-repair.`);
    }
  },
};

function printResults(checks: CheckResult[]): void {
  console.log("\nProvenance Health Check\n");
  for (const check of checks) {
    const icon = check.passed ? "\u2705" : "\u274c";
    console.log(`  ${icon} ${check.name}: ${check.detail}`);
  }
}
