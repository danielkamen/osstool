import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";

const PROVENANCE_YML = `# Contribution Provenance — PR verification config
# Docs: https://github.com/danielkamen/osstool
version: 1
mode: oss
`;

const WORKFLOW_YML = `name: Contribution Provenance
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write
  contents: read

jobs:
  provenance:
    runs-on: ubuntu-latest
    steps:
      - uses: danielkamen/osstool/packages/action@v1
`;

export async function writeProvenanceYml(
  cwd: string,
  force: boolean,
): Promise<{ path: string; created: boolean }> {
  const path = join(cwd, ".github", "provenance.yml");

  if (existsSync(path) && !force) {
    return { path, created: false };
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, PROVENANCE_YML);
  return { path, created: true };
}

export async function writeWorkflow(
  cwd: string,
  force: boolean,
): Promise<{ path: string; created: boolean }> {
  const path = join(cwd, ".github", "workflows", "provenance.yml");

  if (existsSync(path) && !force) {
    return { path, created: false };
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, WORKFLOW_YML);
  return { path, created: true };
}
