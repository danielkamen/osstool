import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { ProjectConfig } from "../config/ProjectConfig.js";
import type { GlobalConfig } from "../config/GlobalConfig.js";
import { getConfigPath, getGlobalConfigPath, getGlobalConfigDir } from "./paths.js";

export async function readProjectConfig(
  repoRoot: string,
): Promise<ProjectConfig | null> {
  const path = getConfigPath(repoRoot);
  if (!existsSync(path)) return null;
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as ProjectConfig;
}

export async function writeProjectConfig(
  repoRoot: string,
  config: ProjectConfig,
): Promise<void> {
  const path = getConfigPath(repoRoot);
  const dir = dirname(path);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(path, JSON.stringify(config, null, 2));
}

export async function readGlobalConfig(): Promise<GlobalConfig | null> {
  const path = getGlobalConfigPath();
  if (!existsSync(path)) return null;
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as GlobalConfig;
  } catch {
    return null;
  }
}

export async function writeGlobalConfig(config: GlobalConfig): Promise<void> {
  const dir = getGlobalConfigDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(getGlobalConfigPath(), JSON.stringify(config, null, 2));
}
