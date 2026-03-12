import { existsSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  computeGitMetrics,
  buildAttestation,
  signAttestation,
  discoverSigningKey,
  SessionStore,
  SessionManager,
  computeMetrics,
  getProvenanceDir,
  getDefaultBranch,
  getHeadSha,
  TOOL_VERSION,
  ensureProvenanceSetup,
} from "@contrib-provenance/core";
import type {
  ProvenanceMetrics,
  SessionMetrics,
  GitDerivedMetrics,
} from "@contrib-provenance/core";
import { readConfig } from "../util/config.js";

const CHECKPOINT_TIMEOUT_MS = 2_000;

async function tryCheckpointVsCode(
  repoRoot: string,
): Promise<SessionMetrics | null> {
  const provDir = getProvenanceDir(repoRoot);
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const triggerPath = join(provDir, "checkpoint-trigger");
  const donePath = join(provDir, `checkpoint-done-${nonce}`);

  // Check if there's an active session
  const active = await SessionStore.findActiveSession(repoRoot);
  if (!active) return null;

  // Write trigger file for VS Code extension
  try {
    await writeFile(triggerPath, nonce);
  } catch {
    return null;
  }

  // Wait for VS Code to checkpoint
  const deadline = Date.now() + CHECKPOINT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (existsSync(donePath)) {
      try {
        const content = await readFile(donePath, "utf-8");
        await unlink(donePath);
        await unlink(triggerPath).catch(() => {});
        return JSON.parse(content) as SessionMetrics;
      } catch {
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  // Timeout — clean up and fall back to direct checkpoint
  await unlink(triggerPath).catch(() => {});

  // Try direct checkpoint if VS Code didn't respond
  try {
    const result = await SessionManager.checkpointSession(repoRoot, {
      sessionId: active.session_id,
    });
    return result.metrics;
  } catch {
    return null;
  }
}

function mergeMetrics(
  session: SessionMetrics,
  git: GitDerivedMetrics,
): SessionMetrics {
  return {
    ...session,
    signal_source: "hybrid",
    // Enrich with git-derived data where session data is richer
    active_files: Math.max(session.active_files, git.active_files),
  };
}

export async function runPrePush(repoRoot: string, remote = "origin"): Promise<void> {
  // Guard against recursion: pushing notes from within pre-push would re-trigger this hook
  if (process.env.PROVENANCE_PUSHING_NOTES) return;

  const provDir = getProvenanceDir(repoRoot);
  if (!existsSync(provDir)) return;

  // Ensure directories exist (lazy init — defense in depth)
  await ensureProvenanceSetup(repoRoot);

  // Read config to get base branch
  let baseBranch = "main";
  try {
    const config = await readConfig(repoRoot);
    baseBranch = config.base_branch ?? (await getDefaultBranch(repoRoot));
  } catch {
    try {
      baseBranch = await getDefaultBranch(repoRoot);
    } catch {
      // Keep default
    }
  }

  // Try to get VS Code session metrics
  const sessionMetrics = await tryCheckpointVsCode(repoRoot);

  // Compute git-derived metrics
  const gitMetrics = await computeGitMetrics(repoRoot, baseBranch);

  // Determine final metrics
  let metrics: ProvenanceMetrics;
  if (sessionMetrics) {
    metrics = mergeMetrics(sessionMetrics, gitMetrics);
  } else {
    metrics = gitMetrics;
  }

  // Build attestation
  const unsigned = await buildAttestation({
    metrics,
    repoRoot,
    toolVersion: TOOL_VERSION,
  });

  // Try to sign opportunistically
  let attestation: typeof unsigned & { signature?: string; signature_format?: string };
  try {
    const keyInfo = await discoverSigningKey(repoRoot);
    attestation = await signAttestation(unsigned, keyInfo.method, keyInfo.keyId);
  } catch {
    // No signing key available — use unsigned
    attestation = unsigned;
  }

  // Store as git note on HEAD
  const headSha = await getHeadSha(repoRoot);
  const noteContent = JSON.stringify(attestation);

  try {
    const { execFile: execFileCb } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFile = promisify(execFileCb);

    await execFile(
      "git",
      ["notes", "--ref=provenance", "add", "-f", "-m", noteContent, headSha],
      { cwd: repoRoot, timeout: 5_000 },
    );

    // Push the notes ref so the GitHub Action can read it.
    // Use env var guard to prevent this push from re-triggering the pre-push hook.
    try {
      await execFile(
        "git",
        ["push", remote, "refs/notes/provenance"],
        {
          cwd: repoRoot,
          timeout: 10_000,
          env: { ...process.env, PROVENANCE_PUSHING_NOTES: "1" },
        },
      );
    } catch {
      // Notes push failed — not fatal, Action falls back to server-computed
      process.stderr.write(
        "contrib-provenance: could not push notes ref (attestation stays local)\n",
      );
    }

    // Log success to stderr (stdout is reserved for git protocol)
    process.stderr.write(
      `contrib-provenance: attestation attached (${attestation.session?.signal_source ?? "git"})\n`,
    );
  } catch {
    // Git notes failed — not fatal
    process.stderr.write("contrib-provenance: could not attach git note (push continues)\n");
  }
}
