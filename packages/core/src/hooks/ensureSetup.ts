import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { getProvenanceDir, getSessionsDir, getAttestationsDir, getConfigPath } from "../storage/paths.js";
import { getGitHooksDir } from "../util/git.js";
import { installHook, isHookInstalled } from "./installHook.js";
import { PRE_PUSH_HOOK, POST_COMMIT_HOOK } from "./hookContent.js";

const execFile = promisify(execFileCb);

export interface SetupStatus {
  configFound: boolean;
  directoriesCreated: boolean;
  hooksInstalled: boolean;
}

/**
 * Idempotently ensure provenance infrastructure is ready.
 * Only acts if .provenance/config.json exists (repo has opted in).
 * Creates missing directories and installs missing hooks.
 */
export async function ensureProvenanceSetup(repoRoot: string): Promise<SetupStatus> {
  const configPath = getConfigPath(repoRoot);
  if (!existsSync(configPath)) {
    return { configFound: false, directoriesCreated: false, hooksInstalled: false };
  }

  // Ensure directories exist
  let directoriesCreated = false;
  const sessionsDir = getSessionsDir(repoRoot);
  const attestationsDir = getAttestationsDir(repoRoot);

  if (!existsSync(sessionsDir)) {
    await mkdir(sessionsDir, { recursive: true });
    directoriesCreated = true;
  }
  if (!existsSync(attestationsDir)) {
    await mkdir(attestationsDir, { recursive: true });
    directoriesCreated = true;
  }

  // Ensure .gitignore exists
  const provDir = getProvenanceDir(repoRoot);
  const gitignorePath = join(provDir, ".gitignore");
  if (!existsSync(gitignorePath)) {
    await writeFile(gitignorePath, "sessions/\nattestations/\ncheckpoint-*\n");
  }

  // Ensure hooks are installed
  let hooksInstalled = false;
  const hooksDir = await getGitHooksDir(repoRoot);
  await mkdir(hooksDir, { recursive: true });

  if (!isHookInstalled(hooksDir, "pre-push")) {
    await installHook(hooksDir, "pre-push", PRE_PUSH_HOOK);
    hooksInstalled = true;
  }
  if (!isHookInstalled(hooksDir, "post-commit")) {
    await installHook(hooksDir, "post-commit", POST_COMMIT_HOOK);
    hooksInstalled = true;
  }

  // Ensure git is configured to push provenance notes alongside branches.
  // This makes `git push` automatically include refs/notes/provenance.
  try {
    const { stdout } = await execFile(
      "git",
      ["config", "--get-all", "remote.origin.push"],
      { cwd: repoRoot, timeout: 3_000 },
    );
    if (!stdout.includes("refs/notes/provenance")) {
      await execFile(
        "git",
        ["config", "--add", "remote.origin.push", "refs/notes/provenance"],
        { cwd: repoRoot, timeout: 3_000 },
      );
    }
  } catch {
    // --get-all exits 1 if no push refspecs configured yet — add it
    try {
      await execFile(
        "git",
        ["config", "--add", "remote.origin.push", "refs/notes/provenance"],
        { cwd: repoRoot, timeout: 3_000 },
      );
    } catch {
      // Non-fatal — pre-push hook will still push notes explicitly
    }
  }

  return { configFound: true, directoriesCreated, hooksInstalled };
}
