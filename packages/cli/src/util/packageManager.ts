import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export type PackageManager = "npm" | "yarn" | "pnpm";

export function detectPackageManager(cwd: string): PackageManager | null {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "package-lock.json"))) return "npm";
  if (existsSync(join(cwd, "package.json"))) return "npm";
  return null;
}

const INSTALL_ARGS: Record<PackageManager, string[]> = {
  npm: ["install", "--save-dev"],
  yarn: ["add", "--dev"],
  pnpm: ["add", "--save-dev"],
};

export async function addDevDependency(cwd: string): Promise<boolean> {
  const pm = detectPackageManager(cwd);
  if (!pm) return false;

  const args = [...INSTALL_ARGS[pm], "@contrib-provenance/cli"];

  try {
    await execFile(pm, args, { cwd, timeout: 60_000 });
    return true;
  } catch {
    return false;
  }
}
