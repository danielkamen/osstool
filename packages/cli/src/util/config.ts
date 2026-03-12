import { readFile } from "node:fs/promises";
import {
  getConfigPath,
  ProjectConfigSchema,
} from "@contrib-provenance/core";
import type { ProjectConfig } from "@contrib-provenance/core";

export async function readConfig(repoRoot: string): Promise<ProjectConfig> {
  const raw = await readFile(getConfigPath(repoRoot), "utf-8");
  return ProjectConfigSchema.parse(JSON.parse(raw));
}
