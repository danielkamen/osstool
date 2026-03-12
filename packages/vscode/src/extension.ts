import * as vscode from "vscode";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SessionTracker } from "./SessionTracker.js";
import { StatusBarController } from "./StatusBarController.js";
import { TestRunWatcher } from "./TestRunWatcher.js";
import { registerCommands, registerInitCommand } from "./CommandRegistrar.js";
import { getWorkspaceRoot } from "./EditorBridge.js";
import { PROVENANCE_DIR, ensureProvenanceSetup } from "@contrib-provenance/core";

let tracker: SessionTracker | undefined;
let statusBar: StatusBarController | undefined;
let testWatcher: TestRunWatcher | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  // Always register init command so it works even without .provenance/
  registerInitCommand(context);

  const configPath = join(workspaceRoot, PROVENANCE_DIR, "config.json");
  if (!existsSync(configPath)) return;

  // Ensure directories and hooks are set up (defense in depth)
  try {
    const status = await ensureProvenanceSetup(workspaceRoot);
    if (status.hooksInstalled) {
      vscode.window.showInformationMessage(
        "Contribution Provenance: git hooks installed for this repository."
      );
    }
  } catch {
    // Non-fatal — tracking still works without hooks
  }

  // Read extension settings
  const config = vscode.workspace.getConfiguration("provenance");
  const idleTimeoutMinutes = config.get<number>("idleTimeoutMinutes", 5);

  tracker = new SessionTracker(workspaceRoot, {
    idleThresholdMs: idleTimeoutMinutes * 60 * 1000,
  });
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

  // Register document close listener
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      tracker?.onDocumentClosed(doc);
    }),
  );

  // Register focus change listener
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      tracker?.recordFocusChange(state.focused);
    }),
  );

  // Auto-start session if configured (default: true)
  const autoStart = config.get<boolean>("autoStart", true);

  if (autoStart) {
    try {
      await tracker.start();
      await statusBar.updateDisplay();
    } catch {
      // Session may already be active from CLI, silently ignore
    }
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
