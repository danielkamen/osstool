import * as vscode from "vscode";
import type { SessionEvent, SessionMetrics, CheckpointResult } from "@contrib-provenance/core";
import {
  SessionStore,
  SessionManager,
  computeMetrics,
  FLUSH_INTERVAL_MS,
} from "@contrib-provenance/core";
import {
  shouldTrackDocument,
  getFileHash,
  getWorkspaceRoot,
  mapChangeToEvents,
  mapOpenToEvent,
} from "./EditorBridge.js";

export class SessionTracker implements vscode.Disposable {
  private eventBuffer: SessionEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | undefined;
  private sessionId: string | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(private workspaceRoot: string) {}

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
    return computeMetrics(events, this.sessionId);
  }

  private async flush(): Promise<void> {
    if (!this.sessionId || this.eventBuffer.length === 0) return;

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    for (const event of events) {
      await SessionStore.appendEvent(this.workspaceRoot, this.sessionId, event);
    }
  }

  dispose(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
