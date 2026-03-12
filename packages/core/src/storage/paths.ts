import { join } from "node:path";
import { homedir } from "node:os";

export const PROVENANCE_DIR = ".provenance";

export function getProvenanceDir(repoRoot: string): string {
  return join(repoRoot, PROVENANCE_DIR);
}

export function getSessionsDir(repoRoot: string): string {
  return join(repoRoot, PROVENANCE_DIR, "sessions");
}

export function getAttestationsDir(repoRoot: string): string {
  return join(repoRoot, PROVENANCE_DIR, "attestations");
}

export function getConfigPath(repoRoot: string): string {
  return join(repoRoot, PROVENANCE_DIR, "config.json");
}

export function getSessionEventPath(repoRoot: string, sessionId: string): string {
  return join(getSessionsDir(repoRoot), `${sessionId}.ndjson`);
}

export function getSessionMetaPath(repoRoot: string, sessionId: string): string {
  return join(getSessionsDir(repoRoot), `${sessionId}.meta.json`);
}

export function getAttestationPath(repoRoot: string, sessionId: string): string {
  return join(getAttestationsDir(repoRoot), `${sessionId}.attestation.json`);
}

export function getGlobalConfigDir(): string {
  return join(homedir(), ".config", "provenance");
}

export function getGlobalConfigPath(): string {
  return join(getGlobalConfigDir(), "config.json");
}
