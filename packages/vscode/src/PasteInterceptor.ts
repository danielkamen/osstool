import * as vscode from "vscode";
import { isPasteBurst } from "@contrib-provenance/core";

// Paste detection in VS Code is done via TextDocumentChangeEvent heuristics
// in EditorBridge.ts. This module provides additional utilities for paste detection.

export function detectPasteInChange(
  event: vscode.TextDocumentChangeEvent,
): boolean {
  if (event.contentChanges.length !== 1) return false;
  const change = event.contentChanges[0];
  const linesInserted = change.text.split("\n").length - 1;
  return isPasteBurst(linesInserted, true);
}
