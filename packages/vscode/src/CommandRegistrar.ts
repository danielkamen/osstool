import * as vscode from "vscode";
import type { SessionTracker } from "./SessionTracker.js";
import type { StatusBarController } from "./StatusBarController.js";
import {
  SessionStore,
  computeMetrics,
} from "@contrib-provenance/core";
import { getWorkspaceRoot } from "./EditorBridge.js";

export function registerCommands(
  context: vscode.ExtensionContext,
  tracker: SessionTracker,
  statusBar: StatusBarController,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("provenance.sessionCheckpoint", async () => {
      if (!tracker.isTracking) {
        vscode.window.showWarningMessage("No active provenance session to checkpoint.");
        return;
      }
      try {
        const result = await tracker.checkpoint();
        await statusBar.updateDisplay();
        vscode.window.showInformationMessage(
          `Session captured: ${result.endedSessionId.slice(0, 8)}... ` +
          `(${result.metrics.dwell_minutes}m active, ${result.metrics.active_files} files). ` +
          `New session: ${result.newSessionId.slice(0, 8)}...`,
        );
      } catch (err) {
        vscode.window.showErrorMessage(
          `Checkpoint failed: ${(err as Error).message}`,
        );
      }
    }),

    vscode.commands.registerCommand("provenance.sessionStatus", async () => {
      if (!tracker.isTracking) {
        vscode.window.showInformationMessage("No active provenance session.");
        return;
      }
      const metrics = await tracker.getMetrics();
      if (!metrics) {
        vscode.window.showInformationMessage("No metrics available yet.");
        return;
      }
      const items = [
        `Active editing: ${metrics.dwell_minutes} min`,
        `Files edited: ${metrics.active_files}`,
        `Entropy: ${metrics.entropy_score}`,
        `Displacement: ${metrics.edit_displacement_sum}`,
        `Jitter: ${metrics.temporal_jitter_ms}ms`,
        `Test runs: ${metrics.test_runs_total} (${metrics.test_failures_observed} failed)`,
      ];
      vscode.window.showInformationMessage(items.join(" | "));
    }),

    vscode.commands.registerCommand("provenance.inspect", async () => {
      const wsRoot = getWorkspaceRoot();
      if (!wsRoot) return;

      const sessions = await SessionStore.listSessions(wsRoot);
      const ended = sessions
        .filter((s) => s.status === "ended" || s.status === "exported")
        .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""));

      if (ended.length === 0) {
        vscode.window.showInformationMessage("No completed sessions to inspect.");
        return;
      }

      const target = ended[0];
      const events = await SessionStore.readEvents(wsRoot, target.session_id);
      const metrics = computeMetrics(events, target.session_id);

      const output = vscode.window.createOutputChannel("Provenance Inspect");
      output.clear();
      output.appendLine(`Session: ${target.session_id}`);
      output.appendLine(`Status: ${target.status}`);
      output.appendLine(`Started: ${target.started_at}`);
      output.appendLine(`Ended: ${target.ended_at ?? "\u2014"}`);
      output.appendLine("");
      output.appendLine(`Active editing time: ${metrics.dwell_minutes} min`);
      output.appendLine(`Files edited: ${metrics.active_files}`);
      output.appendLine(`Entropy score: ${metrics.entropy_score}`);
      output.appendLine(`Edit displacement: ${metrics.edit_displacement_sum}`);
      output.appendLine(`Temporal jitter: ${metrics.temporal_jitter_ms} ms`);
      output.appendLine(`Test runs: ${metrics.test_runs_total} (${metrics.test_failures_observed} failed)`);
      output.appendLine(`Test failure ratio: ${Math.round(metrics.test_failure_ratio * 100)}%`);
      output.show();
    }),
  );
}
