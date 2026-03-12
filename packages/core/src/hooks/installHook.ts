import { existsSync } from "node:fs";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";

/**
 * Install a git hook, chaining with any existing hook content
 * rather than overwriting it.
 */
export async function installHook(
  hooksDir: string,
  hookName: string,
  hookContent: string,
): Promise<void> {
  const hookPath = join(hooksDir, hookName);

  if (existsSync(hookPath)) {
    const existing = await readFile(hookPath, "utf-8");
    if (existing.includes("contrib-provenance")) return; // Already installed
    // Append our hook to the existing one
    const chained =
      existing.trimEnd() +
      "\n\n" +
      hookContent.replace("#!/bin/sh\n", "# contrib-provenance (chained)\n");
    await writeFile(hookPath, chained);
  } else {
    await writeFile(hookPath, hookContent);
  }
  await chmod(hookPath, 0o755);
}

/**
 * Check if a git hook contains contrib-provenance.
 */
export function isHookInstalled(hooksDir: string, hookName: string): boolean {
  const hookPath = join(hooksDir, hookName);
  if (!existsSync(hookPath)) return false;
  try {
    const { readFileSync } = require("node:fs");
    const content = readFileSync(hookPath, "utf-8");
    return content.includes("contrib-provenance");
  } catch {
    return false;
  }
}
