import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { ensureProvenanceSetup } from "@contrib-provenance/core";

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

async function main(): Promise<void> {
  // INIT_CWD is set by npm to the directory where `npm install` was run.
  // This is far more reliable than process.cwd() which points to the
  // package's own directory inside node_modules/.
  const startDir = process.env.INIT_CWD ?? process.cwd();
  const gitRoot = findGitRoot(startDir);

  if (!gitRoot) {
    process.stderr.write("contrib-provenance: not a git repo, skipping setup\n");
    return;
  }

  const configPath = join(gitRoot, ".provenance", "config.json");
  if (!existsSync(configPath)) {
    process.stderr.write("contrib-provenance: no .provenance/config.json found, skipping hooks\n");
    process.stderr.write("contrib-provenance: run `npx provenance init` to set up provenance tracking\n");
    return;
  }

  const status = await ensureProvenanceSetup(gitRoot);

  if (status.hooksInstalled) {
    process.stderr.write("contrib-provenance: hooks installed\n");
  } else if (status.configFound) {
    process.stderr.write("contrib-provenance: hooks already present\n");
  }

  if (status.directoriesCreated) {
    process.stderr.write("contrib-provenance: directories created\n");
  }
}

main().catch((err) => {
  // Never break npm install, but do report the issue
  process.stderr.write(`contrib-provenance: setup skipped (${err?.message ?? "unknown error"})\n`);
});
