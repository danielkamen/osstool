import * as vscode from "vscode";
import * as path from "node:path";
import type { FileEditEvent, FileOpenEvent, FileCloseEvent } from "@contrib-provenance/core";
import { sha256 } from "@contrib-provenance/core";

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function getFileHash(filePath: string, workspaceRoot: string): string {
  const relativePath = path.relative(workspaceRoot, filePath);
  return sha256(relativePath);
}

export function shouldTrackDocument(doc: vscode.TextDocument): boolean {
  if (doc.uri.scheme !== "file") return false;
  const wsRoot = getWorkspaceRoot();
  if (!wsRoot) return false;
  return doc.uri.fsPath.startsWith(wsRoot);
}

export function mapChangeToEvents(
  event: vscode.TextDocumentChangeEvent,
  fileHash: string,
): FileEditEvent[] {
  const events: FileEditEvent[] = [];
  const now = Date.now();

  for (const change of event.contentChanges) {
    const linesInserted = change.text.split("\n").length - 1;
    const linesDeleted = change.range.end.line - change.range.start.line;

    events.push({
      type: "file_edit",
      timestamp: now,
      file_hash: fileHash,
      line: change.range.start.line,
      lines_inserted: linesInserted,
      lines_deleted: linesDeleted,
    });
  }

  return events;
}

export function mapOpenToEvent(fileHash: string): FileOpenEvent {
  return {
    type: "file_open",
    timestamp: Date.now(),
    file_hash: fileHash,
  };
}

export function mapCloseToEvent(fileHash: string): FileCloseEvent {
  return {
    type: "file_close",
    timestamp: Date.now(),
    file_hash: fileHash,
  };
}
