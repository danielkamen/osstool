import * as vscode from "vscode";
import { existsSync } from "node:fs";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { SessionEvent, SessionMetrics, CheckpointResult } from "@contrib-provenance/core";
import {
  SessionStore,
  SessionManager,
  computeMetrics,
  FLUSH_INTERVAL_MS,
  PROVENANCE_DIR,
} from "@contrib-provenance/core";
import {
  shouldTrackDocument,
  getFileHash,
  mapChangeToEvents,
  mapOpenToEvent,
  mapCloseToEvent,
} from "./EditorBridge.js";

export class SessionTracker implements vscode.Disposable {
  private eventBuffer: SessionEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | undefined;
  private sessionId: string | undefined;
  private disposables: vscode.Disposable[] = [];
  private checkpointWatcher: vscode.FileSystemWatcher | undefined;

  private idleThresholdMs: number | undefined;

  constructor(private workspaceRoot: string, options?: { idleThresholdMs?: number }) {
    this.idleThresholdMs = options?.idleThresholdMs;
  }

  get isTracking(): boolean {
    return this.sessionId !== undefined;
  }

  get currentSessionId(): string | undefined {
    return this.sessionId;
  }

  async start(): Promise<string> {
    const { sessionId } = await SessionManager.startSession(this.workspaceRoot, {
      editor: "vscode",
    });
    this.sessionId = sessionId;
    this.eventBuffer = [];
    this.flushInterval = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    return sessionId;
  }

  async end(): Promise<SessionMetrics> {
    if (!this.sessionId) {
      throw new Error("No active session");
    }
    await this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
    const metrics = await SessionManager.endSession(this.workspaceRoot, this.sessionId);
    this.sessionId = undefined;
    return metrics;
  }

  async checkpoint(): Promise<CheckpointResult> {
    if (!this.sessionId) {
      throw new Error("No active session");
    }
    await this.flush();
    const result = await SessionManager.checkpointSession(this.workspaceRoot, {
      sessionId: this.sessionId,
      editor: "vscode",
    });
    this.sessionId = result.newSessionId;
    return result;
  }

  onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    if (!this.sessionId) return;
    if (!shouldTrackDocument(event.document)) return;

    const fileHash = getFileHash(event.document.uri.fsPath, this.workspaceRoot);
    const events = mapChangeToEvents(event, fileHash);
    this.eventBuffer.push(...events);
  }

  onDocumentOpened(doc: vscode.TextDocument): void {
    if (!this.sessionId) return;
    if (!shouldTrackDocument(doc)) return;

    const fileHash = getFileHash(doc.uri.fsPath, this.workspaceRoot);
    this.eventBuffer.push(mapOpenToEvent(fileHash));
  }

  onDocumentClosed(doc: vscode.TextDocument): void {
    if (!this.sessionId) return;
    if (!shouldTrackDocument(doc)) return;

    const fileHash = getFileHash(doc.uri.fsPath, this.workspaceRoot);
    this.eventBuffer.push(mapCloseToEvent(fileHash));
  }

  recordFocusChange(focused: boolean): void {
    if (!this.sessionId) return;
    this.eventBuffer.push({
      type: "focus_change",
      timestamp: Date.now(),
      editor_active: focused,
    });
  }

  recordTestRun(commandType: "test" | "lint" | "build" | "typecheck", passed: boolean | null): void {
    if (!this.sessionId) return;
    this.eventBuffer.push({
      type: "test_run",
      timestamp: Date.now(),
      command_type: commandType,
      passed,
    });
  }

  async getMetrics(): Promise<SessionMetrics | null> {
    if (!this.sessionId) return null;
    await this.flush();
    const events = await SessionStore.readEvents(this.workspaceRoot, this.sessionId);
    return computeMetrics(events, this.sessionId, {
      idleThresholdMs: this.idleThresholdMs,
    });
  }

  async flush(): Promise<void> {
    if (!this.sessionId || this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    for (const event of events) {
      await SessionStore.appendEvent(this.workspaceRoot, this.sessionId, event);
    }
  }

  /**
   * Watch for checkpoint-trigger files from the pre-push hook.
   * When detected, checkpoint the session and write a done file
   * so the hook can read the metrics.
   */
  startCheckpointWatcher(): void {
    const provDir = join(this.workspaceRoot, PROVENANCE_DIR);
    const triggerPattern = new vscode.RelativePattern(provDir, "checkpoint-trigger");

    this.checkpointWatcher = vscode.workspace.createFileSystemWatcher(triggerPattern);
    this.checkpointWatcher.onDidCreate(async () => {
      await this.handleCheckpointTrigger();
    });
    this.checkpointWatcher.onDidChange(async () => {
      await this.handleCheckpointTrigger();
    });

    this.disposables.push(this.checkpointWatcher);
  }

  private async handleCheckpointTrigger(): Promise<void> {
    const provDir = join(this.workspaceRoot, PROVENANCE_DIR);
    const triggerPath = join(provDir, "checkpoint-trigger");

    if (!existsSync(triggerPath) || !this.isTracking) return;

    try {
      const nonce = (await readFile(triggerPath, "utf-8")).trim();
      const result = await this.checkpoint();
      const donePath = join(provDir, `checkpoint-done-${nonce}`);
      await writeFile(donePath, JSON.stringify(result.metrics));

      // Clean up trigger
      await unlink(triggerPath).catch(() => {});
    } catch {
      // Silent — don't interfere with the push
    }
  }

  dispose(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.checkpointWatcher) {
      this.checkpointWatcher.dispose();
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
