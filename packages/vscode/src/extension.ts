import * as vscode from "vscode";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SessionTracker } from "./SessionTracker.js";
import { StatusBarController } from "./StatusBarController.js";
import { TestRunWatcher } from "./TestRunWatcher.js";
import { registerCommands } from "./CommandRegistrar.js";
import { getWorkspaceRoot } from "./EditorBridge.js";
import { PROVENANCE_DIR } from "@contrib-provenance/core";

let tracker: SessionTracker | undefined;
let statusBar: StatusBarController | undefined;
let testWatcher: TestRunWatcher | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  const configPath = join(workspaceRoot, PROVENANCE_DIR, "config.json");
  if (!existsSync(configPath)) return;

  tracker = new SessionTracker(workspaceRoot);
  statusBar = new StatusBarController(tracker);
  testWatcher = new TestRunWatcher(tracker);

  context.subscriptions.push(tracker, statusBar, testWatcher);

  // Register commands
  registerCommands(context, tracker, statusBar);

  // Register document change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      tracker?.onDocumentChanged(event);
    }),
  );

  // Register document open listener
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      tracker?.onDocumentOpened(doc);
    }),
  );

  // Register focus change listener
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      tracker?.recordFocusChange(state.focused);
    }),
  );

  // Auto-start session — always on, no manual intervention needed
  try {
    await tracker.start();
    await statusBar.updateDisplay();
  } catch {
    // Session may already be active from CLI, silently ignore
  }

  // Start watching for checkpoint triggers from pre-push hook
  tracker.startCheckpointWatcher();
}

export async function deactivate(): Promise<void> {
  // Flush buffer only — do NOT end the session.
  // Session data persists for the pre-push hook to pick up.
  if (tracker?.isTracking) {
    try {
      await tracker.flush();
    } catch {
      // Best effort
    }
  }
}
