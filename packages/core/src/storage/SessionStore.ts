import { readFile, writeFile, appendFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { SessionEvent, SessionMeta } from "../session/types.js";
import {
  getSessionEventPath,
  getSessionMetaPath,
  getSessionsDir,
} from "./paths.js";

export async function appendEvent(
  repoRoot: string,
  sessionId: string,
  event: SessionEvent,
): Promise<void> {
  const path = getSessionEventPath(repoRoot, sessionId);
  const dir = getSessionsDir(repoRoot);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await appendFile(path, JSON.stringify(event) + "\n");
}

export async function readEvents(
  repoRoot: string,
  sessionId: string,
): Promise<SessionEvent[]> {
  const path = getSessionEventPath(repoRoot, sessionId);
  if (!existsSync(path)) return [];

  const content = await readFile(path, "utf-8");
  const events: SessionEvent[] = [];

  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as SessionEvent);
    } catch {
      // Skip corrupt lines
    }
  }

  return events;
}

export async function writeSessionMeta(
  repoRoot: string,
  meta: SessionMeta,
): Promise<void> {
  const path = getSessionMetaPath(repoRoot, meta.session_id);
  const dir = getSessionsDir(repoRoot);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(path, JSON.stringify(meta, null, 2));
}

export async function readSessionMeta(
  repoRoot: string,
  sessionId: string,
): Promise<SessionMeta> {
  const path = getSessionMetaPath(repoRoot, sessionId);
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as SessionMeta;
}

export async function updateSessionMeta(
  repoRoot: string,
  sessionId: string,
  updates: Partial<SessionMeta>,
): Promise<void> {
  const meta = await readSessionMeta(repoRoot, sessionId);
  Object.assign(meta, updates);
  await writeSessionMeta(repoRoot, meta);
}

export async function listSessions(repoRoot: string): Promise<SessionMeta[]> {
  const dir = getSessionsDir(repoRoot);
  if (!existsSync(dir)) return [];

  const files = await readdir(dir);
  const metaFiles = files.filter((f) => f.endsWith(".meta.json"));

  const sessions: SessionMeta[] = [];
  for (const file of metaFiles) {
    try {
      const content = await readFile(`${dir}/${file}`, "utf-8");
      sessions.push(JSON.parse(content) as SessionMeta);
    } catch {
      // Skip corrupt files
    }
  }

  return sessions;
}

export async function findActiveSession(
  repoRoot: string,
): Promise<SessionMeta | null> {
  const sessions = await listSessions(repoRoot);
  return sessions.find((s) => s.status === "active") ?? null;
}
