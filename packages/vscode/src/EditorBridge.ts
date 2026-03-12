import * as vscode from "vscode";
import * as path from "node:path";
import type { FileEditEvent, PasteBurstEvent, FileOpenEvent } from "@contrib-provenance/core";
import { sha256, isPasteBurst } from "@contrib-provenance/core";
import { EventAccumulator } from "@contrib-provenance/core";

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
  accumulator: EventAccumulator,
): (FileEditEvent | PasteBurstEvent)[] {
  const events: (FileEditEvent | PasteBurstEvent)[] = [];
  const now = Date.now();
  const isSingleOp = event.contentChanges.length === 1;

  for (const change of event.contentChanges) {
    const linesInserted = change.text.split("\n").length - 1;
    const linesDeleted = change.range.end.line - change.range.start.line;

    // Paste burst detection
    if (isPasteBurst(linesInserted, isSingleOp)) {
      events.push({
        type: "paste_burst",
        timestamp: now,
        file_hash: fileHash,
        line_count: linesInserted,
      });
    }

    // Post-insert edit detection
    const bucket = Math.floor(change.range.start.line / 10);
    const isPostInsertEdit = accumulator.isPostInsertEdit(fileHash, bucket);

    events.push({
      type: "file_edit",
      timestamp: now,
      file_hash: fileHash,
      lines_inserted: linesInserted,
      lines_deleted: linesDeleted,
      is_post_insert_edit: isPostInsertEdit,
    });

    // Track insertions for future post-insert detection
    if (linesInserted > 0) {
      accumulator.recordInsertion(fileHash, change.range.start.line, linesInserted);
    }
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
