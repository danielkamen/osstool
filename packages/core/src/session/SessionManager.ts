import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { SessionMeta, SessionMetrics, CheckpointResult } from "./types.js";
import * as SessionStore from "../storage/SessionStore.js";
import { computeMetrics } from "./MetricsComputer.js";
import { getProvenanceDir } from "../storage/paths.js";
import { getHeadSha, getRemoteUrl } from "../util/git.js";
import { isoNow } from "../util/time.js";
import { TOOL_VERSION } from "../config/defaults.js";

export async function startSession(
  repoRoot: string,
  options: { editor?: string } = {},
): Promise<{ sessionId: string }> {
  const provDir = getProvenanceDir(repoRoot);
  if (!existsSync(provDir)) {
    throw new Error("Not initialized. Run `provenance init` first.");
  }

  const existing = await SessionStore.findActiveSession(repoRoot);
  if (existing) {
    throw new Error(
      `Session ${existing.session_id} already active. End it first or use --force.`,
    );
  }

  const sessionId = randomUUID();
  const now = Date.now();

  let headSha: string;
  try {
    headSha = await getHeadSha(repoRoot);
  } catch {
    headSha = "0000000000000000000000000000000000000000";
  }

  let remote: string;
  try {
    remote = await getRemoteUrl(repoRoot);
  } catch {
    remote = "unknown";
  }

  const meta: SessionMeta = {
    session_id: sessionId,
    status: "active",
    started_at: new Date(now).toISOString(),
    ended_at: null,
    editor: options.editor ?? null,
    tool_version: TOOL_VERSION,
    repo_remote: remote,
    head_at_start: headSha,
  };

  await SessionStore.writeSessionMeta(repoRoot, meta);
  await SessionStore.appendEvent(repoRoot, sessionId, {
    type: "session_start",
    timestamp: now,
    session_id: sessionId,
    tool_version: TOOL_VERSION,
    editor: options.editor,
  });

  return { sessionId };
}

export async function endSession(
  repoRoot: string,
  sessionId?: string,
): Promise<SessionMetrics> {
  let meta: SessionMeta;

  if (sessionId) {
    meta = await SessionStore.readSessionMeta(repoRoot, sessionId);
  } else {
    const active = await SessionStore.findActiveSession(repoRoot);
    if (!active) {
      throw new Error("No active session found.");
    }
    meta = active;
  }

  if (meta.status !== "active") {
    throw new Error(`Session ${meta.session_id} is not active (status: ${meta.status}).`);
  }

  const now = Date.now();

  await SessionStore.appendEvent(repoRoot, meta.session_id, {
    type: "session_end",
    timestamp: now,
    session_id: meta.session_id,
    tool_version: TOOL_VERSION,
  });

  await SessionStore.updateSessionMeta(repoRoot, meta.session_id, {
    status: "ended",
    ended_at: new Date(now).toISOString(),
  });

  const events = await SessionStore.readEvents(repoRoot, meta.session_id);
  return computeMetrics(events, meta.session_id);
}

export async function checkpointSession(
  repoRoot: string,
  options: { sessionId?: string; editor?: string } = {},
): Promise<CheckpointResult> {
  // End the current session
  const metrics = await endSession(repoRoot, options.sessionId);

  // Start a new session immediately, linking it to the ended one
  const provDir = getProvenanceDir(repoRoot);
  if (!existsSync(provDir)) {
    throw new Error("Not initialized. Run `provenance init` first.");
  }

  const newSessionId = randomUUID();
  const now = Date.now();

  let headSha: string;
  try {
    headSha = await getHeadSha(repoRoot);
  } catch {
    headSha = "0000000000000000000000000000000000000000";
  }

  let remote: string;
  try {
    remote = await getRemoteUrl(repoRoot);
  } catch {
    remote = "unknown";
  }

  const meta: SessionMeta = {
    session_id: newSessionId,
    status: "active",
    started_at: new Date(now).toISOString(),
    ended_at: null,
    editor: options.editor ?? null,
    tool_version: TOOL_VERSION,
    repo_remote: remote,
    head_at_start: headSha,
    continues_from: metrics.session_id,
  };

  await SessionStore.writeSessionMeta(repoRoot, meta);
  await SessionStore.appendEvent(repoRoot, newSessionId, {
    type: "session_start",
    timestamp: now,
    session_id: newSessionId,
    tool_version: TOOL_VERSION,
    editor: options.editor,
  });

  return {
    endedSessionId: metrics.session_id,
    metrics,
    newSessionId,
  };
}

export async function getActiveSession(
  repoRoot: string,
): Promise<SessionMeta | null> {
  return SessionStore.findActiveSession(repoRoot);
}
