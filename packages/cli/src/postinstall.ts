import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile, chmod } from "node:fs/promises";
import { join, dirname } from "node:path";
import { PRE_PUSH_HOOK, POST_COMMIT_HOOK } from "./hooks/pre-push.js";

function findGitRoot(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function installHook(
  hooksDir: string,
  hookName: string,
  hookContent: string,
): Promise<void> {
  const hookPath = join(hooksDir, hookName);

  if (existsSync(hookPath)) {
    // Chain with existing hook — don't overwrite
    const existing = await readFile(hookPath, "utf-8");
    if (existing.includes("contrib-provenance")) return; // Already installed
    // Append our hook to the existing one
    const chained = existing.trimEnd() + "\n\n" + hookContent.replace("#!/bin/sh\n", "# contrib-provenance (chained)\n");
    await writeFile(hookPath, chained);
  } else {
    await writeFile(hookPath, hookContent);
  }
  await chmod(hookPath, 0o755);
}

async function main(): Promise<void> {
  // Find the git root from wherever npm installed us
  const gitRoot = findGitRoot(process.cwd());
  if (!gitRoot) return; // Not in a git repo — exit silently

  const provDir = join(gitRoot, ".provenance");
  const hooksDir = join(gitRoot, ".git", "hooks");

  // Create .provenance/ structure if missing
  if (!existsSync(provDir)) {
    await mkdir(join(provDir, "sessions"), { recursive: true });
    await mkdir(join(provDir, "attestations"), { recursive: true });
    await writeFile(join(provDir, ".gitignore"), "sessions/\nattestations/\n");
  }

  // Install hooks
  await mkdir(hooksDir, { recursive: true });
  await installHook(hooksDir, "pre-push", PRE_PUSH_HOOK);
  await installHook(hooksDir, "post-commit", POST_COMMIT_HOOK);

  // Write default config if missing
  const configPath = join(provDir, "config.json");
  if (!existsSync(configPath)) {
    const config = {
      version: 1,
      remote: "unknown",
      initialized_at: new Date().toISOString(),
      signing_method: "auto",
      hooks: { pre_push: true, post_commit: true },
      base_branch: "main",
    };
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }

  process.stderr.write("contrib-provenance: hooks installed\n");
}

main().catch(() => {
  // Silent failure — never break npm install
});
